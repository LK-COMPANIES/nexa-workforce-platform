from contextlib import asynccontextmanager

import pytest
from fastapi import HTTPException

import app.agents.bpo_qa.agent as bpo_qa_agent

from .conftest import DEFAULT_USER_ID, ORG_A


def _patch_tenant_transaction(monkeypatch):
    @asynccontextmanager
    async def fake_tenant_transaction(_tenant_id: str, _user_id: str | None = None):
        yield object()

    monkeypatch.setattr(bpo_qa_agent, "tenant_transaction", fake_tenant_transaction)


async def test_create_job_rejects_contract_type_not_bpo_relevant(monkeypatch):
    _patch_tenant_transaction(monkeypatch)

    async def fake_get_contract(_connection, contract_id: str):
        return {"id": contract_id, "organization_id": ORG_A, "contract_type": "PERMANENT_EMPLOYMENT"}

    monkeypatch.setattr(bpo_qa_agent.contract_repository, "get_contract", fake_get_contract)

    with pytest.raises(HTTPException) as exc_info:
        await bpo_qa_agent.create_job(
            organization_id=ORG_A,
            user_id=DEFAULT_USER_ID,
            contract_id="some-id",
            interaction_transcript="Agent: hello.",
            qa_criteria=None,
        )
    assert exc_info.value.status_code == 422


async def test_create_job_accepts_outsourced_workforce_contract_type(monkeypatch):
    _patch_tenant_transaction(monkeypatch)

    async def fake_get_contract(_connection, contract_id: str):
        return {"id": contract_id, "organization_id": ORG_A, "contract_type": "OUTSOURCED_WORKFORCE"}

    async def fake_create_job(_connection, **_kwargs):
        return {"id": "job-1", "organization_id": ORG_A, "agent_type": "BPO_QA", "status": "PENDING"}

    monkeypatch.setattr(bpo_qa_agent.contract_repository, "get_contract", fake_get_contract)
    monkeypatch.setattr(bpo_qa_agent.ai_job_repository, "create_job", fake_create_job)

    job = await bpo_qa_agent.create_job(
        organization_id=ORG_A,
        user_id=DEFAULT_USER_ID,
        contract_id="some-id",
        interaction_transcript="Agent: hello.",
        qa_criteria=None,
    )
    assert job["status"] == "PENDING"


async def test_create_job_404s_when_contract_not_found(monkeypatch):
    _patch_tenant_transaction(monkeypatch)

    async def fake_get_contract(_connection, _contract_id: str):
        return None

    monkeypatch.setattr(bpo_qa_agent.contract_repository, "get_contract", fake_get_contract)

    with pytest.raises(HTTPException) as exc_info:
        await bpo_qa_agent.create_job(
            organization_id=ORG_A,
            user_id=DEFAULT_USER_ID,
            contract_id="missing-id",
            interaction_transcript="Agent: hello.",
            qa_criteria=None,
        )
    assert exc_info.value.status_code == 404
