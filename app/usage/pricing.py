from __future__ import annotations

import json
import os
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Any


@dataclass(frozen=True)
class ModelPrice:
    input_per_million: Decimal
    cached_input_per_million: Decimal
    output_per_million: Decimal


# Defaults mirror the current standard API prices for the models this project uses.
# They remain environment-overridable so pricing changes never require a deploy.
_DEFAULT_PRICES: dict[str, ModelPrice] = {
    "gpt-5.6-sol": ModelPrice(Decimal("4.00"), Decimal("0.40"), Decimal("20.00")),
    "gpt-5.6-terra": ModelPrice(Decimal("2.00"), Decimal("0.20"), Decimal("12.00")),
    "gpt-5.6-luna": ModelPrice(Decimal("0.20"), Decimal("0.02"), Decimal("1.20")),
    "gpt-5.6": ModelPrice(Decimal("4.00"), Decimal("0.40"), Decimal("20.00")),
}


def _decimal(value: Any, fallback: Decimal) -> Decimal:
    try:
        return Decimal(str(value))
    except Exception:
        return fallback


def _configured_prices() -> dict[str, ModelPrice]:
    prices = dict(_DEFAULT_PRICES)
    raw = os.getenv("TOT_AI_MODEL_PRICING_JSON", "").strip()
    if not raw:
        return prices
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return prices
    if not isinstance(data, dict):
        return prices
    for model, payload in data.items():
        if not isinstance(payload, dict):
            continue
        key = str(model).strip().lower()
        if not key:
            continue
        fallback = prices.get(
            key,
            ModelPrice(Decimal("5.00"), Decimal("0.50"), Decimal("30.00")),
        )
        prices[key] = ModelPrice(
            _decimal(payload.get("input"), fallback.input_per_million),
            _decimal(payload.get("cached_input"), fallback.cached_input_per_million),
            _decimal(payload.get("output"), fallback.output_per_million),
        )
    return prices


def model_price(model: str) -> ModelPrice:
    key = str(model or "").strip().lower()
    prices = _configured_prices()
    if key in prices:
        return prices[key]
    # Snapshot / dated model names inherit their family price.
    for prefix, price in prices.items():
        if key.startswith(prefix + "-"):
            return price
    return ModelPrice(
        _decimal(os.getenv("TOT_AI_UNKNOWN_INPUT_USD_PER_M", "5.00"), Decimal("5.00")),
        _decimal(os.getenv("TOT_AI_UNKNOWN_CACHED_INPUT_USD_PER_M", "0.50"), Decimal("0.50")),
        _decimal(os.getenv("TOT_AI_UNKNOWN_OUTPUT_USD_PER_M", "30.00"), Decimal("30.00")),
    )


def estimate_cost_microusd(
    *,
    model: str,
    input_tokens: int,
    output_tokens: int,
    cached_input_tokens: int = 0,
) -> int:
    price = model_price(model)
    input_tokens = max(0, int(input_tokens or 0))
    output_tokens = max(0, int(output_tokens or 0))
    cached_input_tokens = max(0, min(input_tokens, int(cached_input_tokens or 0)))
    uncached_input = input_tokens - cached_input_tokens

    input_multiplier = Decimal("2") if input_tokens > 272_000 else Decimal("1")
    output_multiplier = Decimal("1.5") if input_tokens > 272_000 else Decimal("1")

    # USD per million tokens -> micro-USD per token numerically equals the rate.
    value = (
        Decimal(uncached_input) * price.input_per_million * input_multiplier
        + Decimal(cached_input_tokens) * price.cached_input_per_million * input_multiplier
        + Decimal(output_tokens) * price.output_per_million * output_multiplier
    )
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def dollars_from_microusd(value: int) -> float:
    return round(max(0, int(value or 0)) / 1_000_000, 6)
