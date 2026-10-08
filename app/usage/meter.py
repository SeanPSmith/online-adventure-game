from __future__ import annotations

import time
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, replace
from typing import Any, Awaitable, Callable

from app.usage.pricing import estimate_cost_microusd
from app.usage.store import ai_usage_store


@dataclass(frozen=True)
class UsageScope:
    user_id: str | None = None
    room_code: str | None = None
    adventure_id: str | None = None
    generated_adventure_id: str | None = None
    surface: str = "unknown"


_scope: ContextVar[UsageScope] = ContextVar("tales_of_two_ai_usage_scope", default=UsageScope())


@contextmanager
def ai_usage_scope(**updates):
    current = _scope.get()
    next_scope = replace(current, **{key: value for key, value in updates.items() if value is not None})
    token = _scope.set(next_scope)
    try:
        yield next_scope
    finally:
        _scope.reset(token)


def current_usage_scope() -> UsageScope:
    return _scope.get()


def estimate_input_tokens(value: Any) -> int:
    if value is None:
        return 0
    if not isinstance(value, str):
        value = str(value)
    # Deliberately conservative for guardrail reservations; exact usage replaces it.
    return max(1, (len(value) + 2) // 3)


def response_usage(response: Any) -> dict[str, int]:
    usage = getattr(response, "usage", None)
    if usage is None:
        return {}
    result: dict[str, int] = {}
    for name in ("input_tokens", "output_tokens", "total_tokens"):
        value = getattr(usage, name, None)
        if value is not None:
            result[name] = max(0, int(value))
    details = getattr(usage, "input_tokens_details", None)
    cached = getattr(details, "cached_tokens", None) if details is not None else None
    if cached is not None:
        result["cached_input_tokens"] = max(0, int(cached))
    return result


async def metered_openai_call(
    *,
    operation: str,
    model: str,
    max_output_tokens: int,
    input_hint: Any,
    request: Callable[[], Awaitable[Any]],
    metadata: dict[str, Any] | None = None,
):
    scope = _scope.get()
    # Unit tests and internal tooling may invoke provider methods outside a request scope.
    # Production HTTP/socket paths install a user scope before reaching the provider.
    if not scope.user_id:
        return await request()

    estimated_input = estimate_input_tokens(input_hint)
    reserve = estimate_cost_microusd(
        model=model,
        input_tokens=estimated_input,
        output_tokens=max(0, int(max_output_tokens or 0)),
    )
    event_id = await ai_usage_store.begin_event(
        user_id=scope.user_id,
        room_code=scope.room_code,
        adventure_id=scope.adventure_id,
        generated_adventure_id=scope.generated_adventure_id,
        surface=scope.surface,
        operation=operation,
        provider="openai",
        model=model,
        reserved_cost_microusd=reserve,
        metadata=metadata,
    )
    started = time.perf_counter()
    try:
        response = await request()
    except Exception as error:
        await ai_usage_store.finish_event(
            event_id=event_id,
            status="failed",
            latency_ms=int((time.perf_counter() - started) * 1000),
            error_type=type(error).__name__,
        )
        raise

    usage = response_usage(response)
    input_tokens = int(usage.get("input_tokens", 0) or 0)
    output_tokens = int(usage.get("output_tokens", 0) or 0)
    cached_input_tokens = int(usage.get("cached_input_tokens", 0) or 0)
    if usage:
        cost = estimate_cost_microusd(
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cached_input_tokens=cached_input_tokens,
        )
    else:
        # Successful provider calls without usage metadata remain conservatively estimated.
        cost = reserve

    await ai_usage_store.finish_event(
        event_id=event_id,
        status="succeeded",
        input_tokens=input_tokens,
        cached_input_tokens=cached_input_tokens,
        output_tokens=output_tokens,
        total_tokens=int(usage.get("total_tokens", input_tokens + output_tokens) or 0),
        estimated_cost_microusd=cost,
        latency_ms=int((time.perf_counter() - started) * 1000),
    )
    return response
