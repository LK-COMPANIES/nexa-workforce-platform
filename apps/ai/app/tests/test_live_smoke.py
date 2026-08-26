"""Optional live Anthropic smoke test (brief §29). Excluded from ordinary
pytest runs by the `live_smoke` marker (see pytest.ini) — only the manually
triggered `ai-live-smoke-test` GitHub Actions job (workflow_dispatch,
protected environment, real ANTHROPIC_API_KEY secret) ever selects it via
`pytest -m live_smoke`. Never required for pull-request CI.

Unlike every other test in this suite, this one deliberately makes a real
network call — it exists specifically to catch the class of failure unit
tests structurally cannot: an expired/revoked API key, a model name that's
been deprecated, or a genuine Anthropic outage.
"""

import pytest

from app.config import get_settings
from app.orchestration.client import call_structured
from app.schemas.contract_audit import ContractAuditResult


@pytest.mark.live_smoke
async def test_live_call_structured_returns_schema_valid_output():
    settings = get_settings()
    result = await call_structured(
        model=settings.anthropic_model_contract_audit,
        system_prompt=(
            "You are a test harness. Call the emit_result tool with a trivial, "
            "clearly-labeled test payload — do not perform real contract analysis."
        ),
        user_prompt=(
            "This is an automated CI smoke test, not a real contract. Respond with "
            "summary='CI smoke test', overall_assessment='LOOKS_SOUND', findings=[]."
        ),
        output_schema=ContractAuditResult,
    )

    assert isinstance(result.output, ContractAuditResult)
    assert result.prompt_tokens > 0
    assert result.completion_tokens > 0
