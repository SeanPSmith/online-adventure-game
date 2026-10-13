#!/usr/bin/env python3
"""Pass 61B: compare isolated Kokoro CPU/GPU synthesis measurements.

Inputs are the three FIXED public test passages, not users' story content.
No AWS connection, network requests, external packages, or service mutations.
"""
from __future__ import annotations

import argparse
import csv
import math
from pathlib import Path
import sys

EXPECTED = {
    "michael_short": "am_michael",
    "bella_short": "af_bella",
    "michael_long": "am_michael",
}


class BenchmarkError(ValueError):
    pass


def read_results(path: Path, label: str) -> dict[str, dict]:
    try:
        with path.open(newline="", encoding="utf-8-sig") as stream:
            reader = csv.DictReader(stream)
            required = {"id", "voice", "input_chars", "wall_seconds", "audio_seconds"}
            if not reader.fieldnames or not required.issubset(reader.fieldnames):
                raise BenchmarkError(f"{label}: missing CSV columns: {', '.join(sorted(required - set(reader.fieldnames or [])))}")
            rows = list(reader)
    except OSError as exc:
        raise BenchmarkError(f"{label}: cannot read {path}: {exc}") from exc

    results = {}
    for row in rows:
        sample = (row.get("id") or "").strip()
        if sample not in EXPECTED:
            raise BenchmarkError(f"{label}: unexpected sample {sample!r}")
        if sample in results:
            raise BenchmarkError(f"{label}: duplicate sample {sample}")
        voice = (row.get("voice") or "").strip()
        if voice != EXPECTED[sample]:
            raise BenchmarkError(f"{label}: {sample} expected {EXPECTED[sample]}, got {voice}")
        try:
            chars = int(row["input_chars"])
            wall = float(row["wall_seconds"])
            audio = float(row["audio_seconds"])
        except (ValueError, TypeError, KeyError) as exc:
            raise BenchmarkError(f"{label}: invalid measurements for {sample}") from exc
        if chars <= 0 or not all(math.isfinite(value) and value > 0 for value in (wall, audio)):
            raise BenchmarkError(f"{label}: nonpositive, missing, or nonfinite measurements for {sample}")
        status = (row.get("http_status") or "200").strip()
        if status != "200":
            raise BenchmarkError(f"{label}: {sample} HTTP status {status} is not 200")
        results[sample] = {"voice": voice, "chars": chars, "wall": wall, "audio": audio,
                           "rtf": audio / wall}
    if set(results) != set(EXPECTED):
        raise BenchmarkError(f"{label}: expected all three samples; missing {', '.join(sorted(set(EXPECTED)-set(results)))}")
    return results


def compare(cpu_file: Path, gpu_file: Path) -> str:
    cpu = read_results(cpu_file, "CPU")
    gpu = read_results(gpu_file, "GPU")
    lines = [
        "# Tales of Two — Story Time CPU vs GPU benchmark",
        "",
        "**Scope:** exploratory single-pass synthesis of three fixed samples, not a production latency or quality guarantee.",
        "CPU and GPU image versions may differ. Audio quality must be approved by listening; throughput alone cannot approve a migration.",
        "",
        "| Sample | Voice | CPU wall | GPU wall | GPU speedup | CPU audio/wall | GPU audio/wall |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    alerts = []
    for sample in EXPECTED:
        c, g = cpu[sample], gpu[sample]
        if c["chars"] != g["chars"]:
            raise BenchmarkError(f"Sample mismatch for {sample}: CPU {c['chars']} chars, GPU {g['chars']} chars")
        speedup = c["wall"] / g["wall"]
        lines.append(f"| {sample} | `{c['voice']}` | {c['wall']:.2f}s | {g['wall']:.2f}s | {speedup:.2f}× | {c['rtf']:.2f}× | {g['rtf']:.2f}× |")
        duration_delta = abs(c["audio"] - g["audio"]) / c["audio"]
        if duration_delta > 0.15:
            alerts.append(f"- **Listen closely:** {sample} audio duration differs by {duration_delta:.0%} (CPU {c['audio']:.2f}s vs GPU {g['audio']:.2f}s).")
        if g["rtf"] < 2:
            alerts.append(f"- **Throughput:** GPU {sample} is below 2× real-time; insufficient headroom for 2× playback.")
        elif g["rtf"] < 5:
            alerts.append(f"- **Throughput:** GPU {sample} is below preferred 5× headroom for concurrency and buffering.")
    lines += ["", "## Flags", ""] + (alerts or ["- No numeric comparison flags. This does **not** verify voice quality."])
    lines += [
        "", "## Manual voice-quality listening checklist", "",
        "Play **each CPU and GPU recording** back-to-back at the same volume (Michael short, Bella short, Michael long).",
        "Rate each as Pass / Needs investigation / Fail for: pronunciation, missing or repeated words, natural rhythm,",
        "pauses/emphasis, warmth/timbre, and MP3 artifacts. Check both voices, not only aggregate speed.",
        "Do not accept a GPU cutover if either voice sounds worse or transcripts differ, even when faster.",
        "", "## Interpretation limits", "",
        "- Wall time here includes a localhost HTTP request and full MP3 response; it is **not** user-perceived time-to-first-audio.",
        "- Single samples do not measure distribution, cold starts, queueing, two-user contention, or sustained throughput.",
        "- Browser Pass 61A WAIT/SERVER/INFERENCE numbers should separately be collected during real play.",
        "- No GPU production switch, listener routing, automatic billing or staging deployment is authorized by this report.",
        "", "## Next decision", "",
        "Proceed only after quality passes, GPU quota approval, repeated loaded/idle benchmarks and a documented cost/latency review.",
        "",
    ]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cpu", required=True, type=Path, help="CPU results.csv (from benchmark-story-time-remote.sh)")
    parser.add_argument("--gpu", required=True, type=Path, help="GPU results.csv (from story-time-gpu-pilot.sh fetch)")
    parser.add_argument("--output", type=Path, help="Optional Markdown report file; printed to console either way")
    args = parser.parse_args(argv)
    try:
        report = compare(args.cpu, args.gpu)
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(report, encoding="utf-8")
            print(f"Report written: {args.output}", file=sys.stderr)
    except (BenchmarkError, OSError) as exc:
        print(f"BENCHMARK ERROR: {exc}", file=sys.stderr)
        return 2
    print(report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
