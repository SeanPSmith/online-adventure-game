"""Pure-local Pass 61B regression coverage of benchmark acceptance decisions."""
import csv
import importlib.util
from pathlib import Path
import subprocess
import sys

import pytest

PROJECT = Path(__file__).resolve().parents[2]
COMPARE = PROJECT / "scripts/aws/story-time-compare-benchmarks.py"
spec = importlib.util.spec_from_file_location("benchmark_comparison", COMPARE)
comparison = importlib.util.module_from_spec(spec)
spec.loader.exec_module(comparison)

VOICES = {"michael_short": "am_michael", "bella_short": "af_bella", "michael_long": "am_michael"}


def csv_file(tmp_path, name, *, gpu=False, override=None):
    path = tmp_path / name
    with path.open("w", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=["id", "voice", "input_chars", "wall_seconds", "audio_seconds", "http_status"])
        writer.writeheader()
        for sample, voice in VOICES.items():
            row = {"id": sample, "voice": voice, "input_chars": 80 if sample != "michael_long" else 475,
                   "wall_seconds": 2.0 if gpu else 20.0, "audio_seconds": 12.0,
                   "http_status": 200}
            if override and sample == "michael_long":
                row.update(override)
            writer.writerow(row)
    return path


def test_report_requires_same_audio_and_text_metadata(tmp_path):
    cpu = csv_file(tmp_path, "cpu.csv")
    gpu = csv_file(tmp_path, "gpu.csv", gpu=True)
    report = comparison.compare(cpu, gpu)
    assert "10.00×" in report
    assert "6.00×" in report
    assert "quality must be approved" in report
    assert "not a production latency" in report
    assert "michael_long" in report


@pytest.mark.parametrize("bad", [{"voice": "af_bella"}, {"input_chars": "100"},
                                   {"wall_seconds": "0"}, {"audio_seconds": "n/a"},
                                   {"http_status": "503"}, {"wall_seconds": "nan"}])
def test_invalid_comparisons_are_refused(tmp_path, bad):
    cpu = csv_file(tmp_path, "cpu.csv")
    gpu = csv_file(tmp_path, "gpu.csv", gpu=True, override=bad)
    with pytest.raises(comparison.BenchmarkError):
        comparison.compare(cpu, gpu)


def test_report_flags_throughput_and_audio_duration_changes(tmp_path):
    cpu = csv_file(tmp_path, "cpu.csv")
    gpu = csv_file(tmp_path, "gpu.csv", gpu=True, override={"wall_seconds": "9", "audio_seconds": "7"})
    report = comparison.compare(cpu, gpu)
    assert "audio duration differs" in report
    assert "below 2× real-time" in report


def test_script_generates_offline_report(tmp_path):
    cpu = csv_file(tmp_path, "cpu.csv")
    gpu = csv_file(tmp_path, "gpu.csv", gpu=True)
    report_path = tmp_path / "report.md"
    result = subprocess.run([sys.executable, str(COMPARE), "--cpu", str(cpu), "--gpu", str(gpu),
                             "--output", str(report_path)], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert report_path.is_file()
    assert "CPU vs GPU benchmark" in report_path.read_text()


def test_gpu_pilot_stop_on_benchmark_failure_and_no_automatic_deploy():
    content = (PROJECT / "scripts/aws/story-time-gpu-pilot.sh").read_text()
    assert "trap 'rm -f \"$PARAMS\"; stop_gpu_on_exit' EXIT" in content
    assert 'trap stop_gpu_on_exit EXIT' in content
    assert 'benchmark)' in content
    assert 'deploy)' in content


def test_cpu_benchmark_exports_duration_and_cpu_csv():
    ec2 = (PROJECT / "scripts/aws/benchmark-story-time-ec2.sh").read_text()
    remote = (PROJECT / "scripts/aws/benchmark-story-time-remote.sh").read_text()
    assert 'python3 "$DURATION_TOOL" "$outputfile"' in ec2
    assert "__TOT_CPU_RESULTS_BEGIN__" in remote
    assert 'LOCAL_DIR/results.csv' in remote
    assert 'story-time-mp3-duration.py' in remote
