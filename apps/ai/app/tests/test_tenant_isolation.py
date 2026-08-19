"""Covers the brief's mandatory test: "Tenant A JWT + Tenant B request body
= REJECT". See conftest.py's module docstring for what this environment can
and cannot verify — these tests fake the agent-layer create_job() functions
rather than hit a live Postgres, but they exercise the REAL router wiring
(auth dependency, request/response schemas, status codes) and the exact
application-level contract production code relies on: create_job() 404s
when the requested contract does not resolve within the caller's own
tenant. In production that resolution is RLS (contract_repository.
get_contract has no organization_id filter of its own — see its
docstring) rather than the dict lookup used here; RLS itself is covered by
apps/api's own Prisma/RLS integration tests since it is shared, identical
infrastructure.
"""

from contextlib import asynccontextmanager

from fastapi import HTTPException, status
from fastapi.testclient import TestClient

import app.agents.bpo_qa.agent as bpo_qa_agent
import app.agents.contract_audit.agent as contract_audit_agent
import app.routers.jobs as jobs_router_module
from app.main import app

from .conftest import ORG_A, ORG_B, make_access_token

CONTRACT_OWNED_BY_A = "c0000000-0000-0000-0000-00000000000a"
CONTRACT_OWNED_BY_B = "c0000000-0000-0000-0000-00000000000b"

# Simulates the tenant boundary contract_repository.get_contract enforces
# via RLS in production: a contract_id resolves only within its owning
# organization.
_FAKE_CONTRACT_OWNERS = {
    CONTRACT_OWNED_BY_A: ORG_A,
    CONTRACT_OWNED_BY_B: ORG_B,
}


async def _fake_execute_job(*_args, **_kwargs) -> None:
    return None


async def _fake_contract_audit_create_job(*, organization_id: str, user_id: str, contract_id: str) -> dict:
    if _FAKE_CONTRACT_OWNERS.get(contract_id) != organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
    return {"id": "11111111-2222-3333-4444-555555555555", "status": "PENDING"}


async def _fake_bpo_qa_create_job(
    *, organization_id: str, user_id: str, contract_id: str, interaction_transcript: str, qa_criteria
) -> dict:
    if _FAKE_CONTRACT_OWNERS.get(contract_id) != organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
    return {"id": "66666666-7777-8888-9999-000000000000", "status": "PENDING"}


def test_contract_audit_rejects_tenant_a_jwt_with_tenant_b_contract_id(monkeypatch):
    monkeypatch.setattr(contract_audit_agent, "create_job", _fake_contract_audit_create_job)
    monkeypatch.setattr(contract_audit_agent, "execute_job", _fake_execute_job)

    token = make_access_token(organization_id=ORG_A)
    client = TestClient(app)

    response = client.post(
        "/agents/contract-audit",
        json={"contract_id": CONTRACT_OWNED_BY_B},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404


def test_contract_audit_accepts_tenant_a_jwt_with_tenant_a_contract_id(monkeypatch):
    monkeypatch.setattr(contract_audit_agent, "create_job", _fake_contract_audit_create_job)
    monkeypatch.setattr(contract_audit_agent, "execute_job", _fake_execute_job)

    token = make_access_token(organization_id=ORG_A)
    client = TestClient(app)

    response = client.post(
        "/agents/contract-audit",
        json={"contract_id": CONTRACT_OWNED_BY_A},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "PENDING"
    assert "job_id" in body


def test_contract_audit_rejects_missing_token():
    client = TestClient(app)
    response = client.post("/agents/contract-audit", json={"contract_id": CONTRACT_OWNED_BY_A})
    assert response.status_code == 401


def test_contract_audit_rejects_body_organization_id_is_ignored_not_trusted(monkeypatch):
    """Even if a caller tries to smuggle an organization_id into the body,
    ContractAuditRequest has no such field — FastAPI/Pydantic silently
    ignores unknown fields by default, so this proves the field cannot
    influence tenant scoping at all, rather than merely being overridden."""
    monkeypatch.setattr(contract_audit_agent, "create_job", _fake_contract_audit_create_job)
    monkeypatch.setattr(contract_audit_agent, "execute_job", _fake_execute_job)

    token = make_access_token(organization_id=ORG_A)
    client = TestClient(app)

    response = client.post(
        "/agents/contract-audit",
        json={"contract_id": CONTRACT_OWNED_BY_B, "organization_id": ORG_B},
        headers={"Authorization": f"Bearer {token}"},
    )

    # Still 404: the smuggled organization_id in the body changed nothing.
    assert response.status_code == 404


def test_bpo_qa_rejects_tenant_a_jwt_with_tenant_b_contract_id(monkeypatch):
    monkeypatch.setattr(bpo_qa_agent, "create_job", _fake_bpo_qa_create_job)
    monkeypatch.setattr(bpo_qa_agent, "execute_job", _fake_execute_job)

    token = make_access_token(organization_id=ORG_A)
    client = TestClient(app)

    response = client.post(
        "/agents/bpo-qa",
        json={
            "contract_id": CONTRACT_OWNED_BY_B,
            "interaction_transcript": "Agent: Hello, how can I help? Customer: My invoice is wrong.",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404


def test_bpo_qa_accepts_tenant_a_jwt_with_tenant_a_contract_id(monkeypatch):
    monkeypatch.setattr(bpo_qa_agent, "create_job", _fake_bpo_qa_create_job)
    monkeypatch.setattr(bpo_qa_agent, "execute_job", _fake_execute_job)

    token = make_access_token(organization_id=ORG_A)
    client = TestClient(app)

    response = client.post(
        "/agents/bpo-qa",
        json={
            "contract_id": CONTRACT_OWNED_BY_A,
            "interaction_transcript": "Agent: Hello, how can I help? Customer: My invoice is wrong.",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 202


def test_job_status_endpoint_hides_another_tenants_job(monkeypatch):
    @asynccontextmanager
    async def fake_tenant_transaction(_tenant_id: str, _user_id: str | None = None):
        yield object()

    async def fake_get_job(_connection, _job_id: str):
        # Simulates RLS: the job exists, but not within this tenant's scope.
        return None

    monkeypatch.setattr(jobs_router_module, "tenant_transaction", fake_tenant_transaction)
    monkeypatch.setattr(jobs_router_module.ai_job_repository, "get_job", fake_get_job)

    token = make_access_token(organization_id=ORG_A)
    client = TestClient(app)

    response = client.get(
        "/agents/jobs/99999999-8888-7777-6666-555555555555",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
