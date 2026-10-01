from __future__ import annotations

import asyncio
import json
import os
import sys
import time

from openai import AsyncOpenAI


PING_TIMEOUT_SECONDS = 20.0


def env(name: str, default: str) -> str:
    return (os.getenv(name, default) or default).strip()


def print_header(title: str) -> None:
    print()
    print("=" * 68)
    print(title)
    print("=" * 68)


async def timed(label: str, coro):
    start = time.perf_counter()
    try:
        result = await asyncio.wait_for(coro, timeout=PING_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        elapsed = time.perf_counter() - start
        print(f"[FAIL] {label} exceeded {elapsed:.2f}s hard timeout.")
        return None
    except Exception as exc:
        elapsed = time.perf_counter() - start
        print(f"[FAIL] {label} failed after {elapsed:.2f}s.")
        print(f"[ERROR] {type(exc).__name__}: {exc}")
        return None

    elapsed = time.perf_counter() - start
    print(f"[OK] {label} returned in {elapsed:.2f}s.")
    return result


async def main() -> int:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("[FAIL] OPENAI_API_KEY is not set in this shell/process.")
        return 1

    model = env(
        "TOT_OPENAI_DIRECTOR_STORY_MODEL",
        env("TOT_OPENAI_STORY_MODEL", "gpt-5.6-sol"),
    )

    print_header("TALES OF TWO // OPENAI DIRECTOR DIAGNOSTIC")
    print(f"Model: {model}")
    print(f"Hard timeout per test: {PING_TIMEOUT_SECONDS:.0f}s")
    print("Retries: 0")
    print("API key: present (value not printed)")

    client = AsyncOpenAI(
        api_key=api_key,
        timeout=PING_TIMEOUT_SECONDS,
        max_retries=0,
    )

    print_header("TEST 1 // MINIMAL TEXT PING")
    response = await timed(
        "minimal text request",
        client.responses.create(
            model=model,
            instructions="Return the requested text exactly. Do not add anything.",
            input="Reply with exactly: DIRECTOR_OK",
            reasoning={"effort": "none"},
            max_output_tokens=32,
            store=False,
        ),
    )

    if response is None:
        print()
        print("RESULT: Basic Director-model API connectivity is failing or hanging.")
        return 2

    output = (getattr(response, "output_text", "") or "").strip()
    print(f"[RESPONSE] {output!r}")

    if "DIRECTOR_OK" not in output:
        print("[WARN] Request returned, but not with the expected text.")

    print_header("TEST 2 // STRUCTURED OUTPUT PING")
    schema = {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "enum": ["DIRECTOR_OK"],
            }
        },
        "required": ["status"],
        "additionalProperties": False,
    }

    structured = await timed(
        "structured Responses API request",
        client.responses.create(
            model=model,
            instructions="Return only data matching the requested schema.",
            input="Confirm the Director API path is working.",
            reasoning={"effort": "none"},
            max_output_tokens=64,
            text={
                "format": {
                    "type": "json_schema",
                    "name": "director_diagnostic",
                    "strict": True,
                    "schema": schema,
                }
            },
            store=False,
        ),
    )

    if structured is None:
        print()
        print("RESULT: Plain text works, but structured output is failing/hanging.")
        print("That points directly at the structured Director request path.")
        return 3

    structured_text = (getattr(structured, "output_text", "") or "").strip()
    print(f"[RESPONSE] {structured_text!r}")

    try:
        parsed = json.loads(structured_text)
    except json.JSONDecodeError as exc:
        print(f"[FAIL] Structured response was not valid JSON: {exc}")
        return 4

    if parsed.get("status") != "DIRECTOR_OK":
        print("[FAIL] Structured response did not contain DIRECTOR_OK.")
        return 5

    print_header("RESULT")
    print("OPENAI DIRECTOR TRANSPORT + STRUCTURED OUTPUT ARE WORKING.")
    print()
    print("If the live turn still hangs, the problem is above the transport layer:")
    print("the real Director payload/schema/context, or the server task that handles it.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
