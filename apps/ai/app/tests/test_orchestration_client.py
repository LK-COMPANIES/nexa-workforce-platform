import asyncio
from types import SimpleNamespace

import pytest

from app.orchestration.client import StructuredCallError, call_structured
from app.schemas.contract_audit import ContractAuditResult


class _FakeToolUseBlock:
    type = "tool_use"

    def __init__(self, input_data: dict):
        self.input = input_data


class _FakeMessages:
    def __init__(self, response=None, exc: Exception | None = None, hang: bool = False):
        self._response = response
        self._exc = exc
        self._hang = hang

    async def create(self, **_kwargs):
        if self._hang:
            await asyncio.sleep(3600)
        if self._exc:
            raise self._exc
        return self._response


class _FakeAnthropicClient:
    def __init__(self, response=None, exc: Exception | None = None, hang: bool = False):
        self.messages = _FakeMessages(response=response, exc=exc, hang=hang)


VALID_PAYLOAD = {
    "summary": "The contract is clearly drafted.",
    "overall_assessment": "LOOKS_SOUND",
    "findings": [],
}


async def test_call_structured_returns_validated_output(monkeypatch):
    fake_response = SimpleNamespace(
        content=[_FakeToolUseBlock(VALID_PAYLOAD)],
        usage=SimpleNamespace(input_tokens=10, output_tokens=20),
    )
    monkeypatch.setattr(
        "app.orchestration.client.AsyncAnthropic", lambda api_key: _FakeAnthropicClient(response=fake_response)
    )

    result = await call_structured(
        model="claude-sonnet-5", system_prompt="sys", user_prompt="user", output_schema=ContractAuditResult
    )

    assert isinstance(result.output, ContractAuditResult)
    assert result.output.overall_assessment == "LOOKS_SOUND"
    assert result.prompt_tokens == 10
    assert result.completion_tokens == 20


async def test_call_structured_raises_on_schema_mismatch(monkeypatch):
    invalid_payload = {"summary": "s"}  # missing required overall_assessment / findings
    fake_response = SimpleNamespace(
        content=[_FakeToolUseBlock(invalid_payload)],
        usage=SimpleNamespace(input_tokens=1, output_tokens=1),
    )
    monkeypatch.setattr(
        "app.orchestration.client.AsyncAnthropic", lambda api_key: _FakeAnthropicClient(response=fake_response)
    )

    with pytest.raises(StructuredCallError):
        await call_structured(
            model="claude-sonnet-5", system_prompt="sys", user_prompt="user", output_schema=ContractAuditResult
        )


async def test_call_structured_raises_when_no_tool_use_block(monkeypatch):
    fake_response = SimpleNamespace(content=[], usage=SimpleNamespace(input_tokens=1, output_tokens=1))
    monkeypatch.setattr(
        "app.orchestration.client.AsyncAnthropic", lambda api_key: _FakeAnthropicClient(response=fake_response)
    )

    with pytest.raises(StructuredCallError, match="tool_use"):
        await call_structured(
            model="claude-sonnet-5", system_prompt="sys", user_prompt="user", output_schema=ContractAuditResult
        )


async def test_call_structured_raises_on_provider_timeout(monkeypatch):
    monkeypatch.setenv("AI_REQUEST_TIMEOUT", "0.01")
    from app.config import get_settings

    get_settings.cache_clear()

    monkeypatch.setattr(
        "app.orchestration.client.AsyncAnthropic", lambda api_key: _FakeAnthropicClient(hang=True)
    )

    with pytest.raises(StructuredCallError, match="timeout"):
        await call_structured(
            model="claude-sonnet-5", system_prompt="sys", user_prompt="user", output_schema=ContractAuditResult
        )
