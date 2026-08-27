import asyncio
import time
from dataclasses import dataclass
from typing import Type, TypeVar

from anthropic import APIError, AsyncAnthropic
from pydantic import BaseModel, ValidationError

from ..config import get_settings

T = TypeVar("T", bound=BaseModel)

_TOOL_NAME = "emit_result"


class StructuredCallError(Exception):
    """Raised when the provider call fails, times out, or the model's tool
    input fails Pydantic validation. Callers (agents/*/agent.py) catch this
    and record the failure to both AiJob and AIAuditLog — a validation
    failure is treated the same as a provider failure, never silently
    coerced or partially accepted."""


@dataclass
class StructuredCallResult:
    output: BaseModel
    prompt_tokens: int
    completion_tokens: int
    latency_ms: int


async def call_structured(
    *,
    model: str,
    system_prompt: str,
    user_prompt: str,
    output_schema: Type[T],
    max_tokens: int = 4096,
) -> StructuredCallResult:
    """Forces Claude to respond via a single tool call whose input_schema is
    output_schema's JSON schema, then validates the tool input against the
    same Pydantic model before returning — this is the "strict
    Pydantic-schema-validated Claude outputs" mechanism the brief requires.
    A model response that doesn't match the schema raises here rather than
    ever reaching a caller as loosely-typed JSON.
    """
    settings = get_settings()
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    started_at = time.monotonic()
    try:
        response = await asyncio.wait_for(
            client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
                tools=[
                    {
                        "name": _TOOL_NAME,
                        "description": "Emit the structured analysis result. Always call this tool exactly once.",
                        "input_schema": output_schema.model_json_schema(),
                    }
                ],
                tool_choice={"type": "tool", "name": _TOOL_NAME},
            ),
            timeout=settings.ai_request_timeout,
        )
    except asyncio.TimeoutError as exc:
        raise StructuredCallError(f"Provider call exceeded {settings.ai_request_timeout}s timeout") from exc
    except APIError as exc:
        raise StructuredCallError(f"Provider call failed: {exc}") from exc

    latency_ms = int((time.monotonic() - started_at) * 1000)

    tool_use_block = next(
        (block for block in response.content if getattr(block, "type", None) == "tool_use"), None
    )
    if tool_use_block is None:
        raise StructuredCallError("Model did not return a tool_use block")

    try:
        validated = output_schema.model_validate(tool_use_block.input)
    except ValidationError as exc:
        raise StructuredCallError(f"Model output failed schema validation: {exc}") from exc

    return StructuredCallResult(
        output=validated,
        prompt_tokens=response.usage.input_tokens,
        completion_tokens=response.usage.output_tokens,
        latency_ms=latency_ms,
    )
