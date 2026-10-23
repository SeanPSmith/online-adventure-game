"""Pass 59B: isolated GPU pilot safety and MP3 duration regressions."""
import importlib.util
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[2]
DURATION = PROJECT / 'scripts/aws/story-time-mp3-duration.py'
PILOT = PROJECT / 'infra/gpu-pilot/story-time-gpu-pilot.yaml'
HELPER = PROJECT / 'scripts/aws/story-time-gpu-pilot.sh'
BENCH = PROJECT / 'scripts/aws/story-time-gpu-benchmark-ec2.sh'

spec = importlib.util.spec_from_file_location('story_time_mp3_duration', DURATION)
mp3 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mp3)


def _mpeg2_mp3_frame():
    # MPEG2, Layer III, 128 kbit/s, 24 kHz => 576 samples / 384 bytes.
    h = (0x7ff << 21) | (2 << 19) | (1 << 17) | (1 << 16) | (12 << 12) | (1 << 10)
    return h.to_bytes(4, 'big') + bytes(380)


def test_mp3_duration_counts_frames_without_ffprobe(tmp_path):
    p = tmp_path / 'audio.mp3'
    p.write_bytes(_mpeg2_mp3_frame() * 125)
    assert abs(mp3.duration_seconds(p) - 3.0) < 0.0001


def test_mp3_duration_skips_id3v2(tmp_path):
    p = tmp_path / 'audio.mp3'
    p.write_bytes(b'ID3\x04\x00\x00\x00\x00\x00\x00' + _mpeg2_mp3_frame() * 25)
    assert abs(mp3.duration_seconds(p) - 0.6) < 0.0001


def test_mp3_duration_rejects_invalid_input(tmp_path):
    p = tmp_path / 'bad.mp3'
    p.write_bytes(b'not audio')
    try:
        mp3.duration_seconds(p)
    except ValueError:
        pass
    else:
        raise AssertionError('Invalid MP3 was accepted')


def test_gpu_instance_is_isolated_and_auto_stopped():
    source = PILOT.read_text()
    assert 'SecurityGroupIngress: []' in source
    assert '127.0.0.1:8880:8880' in source
    assert 'ghcr.io/remsky/kokoro-fastapi-gpu:v0.9.0-cu126' in source
    assert 'AmazonSSMManagedInstanceCore' in source
    assert 'HardStopSeconds:' in source
    assert 'ec2.stop_instances(InstanceIds=[iid])' in source
    assert 'rate(5 minutes)' in source
    assert 'NarratorInstanceId' not in source
    assert 'KOKORO_BASE_URL' not in source


def test_benchmark_uses_identical_cpu_baseline_text_and_voices():
    original = (PROJECT / 'scripts/aws/benchmark-story-time-ec2.sh').read_text()
    gpu = BENCH.read_text()
    for text in [
        'Welcome to Quillairo. In the shadows of the castle, the adventure begins.',
        'The ancient lantern flickered as the travelers entered the ruined observatory.',
        'One traveler took a careful step forward. The other followed, and together they listened as the hidden machinery began to wake.',
    ]:
        assert text in original and text in gpu
    for voice in ['am_michael', 'af_bella']:
        assert voice in gpu
    assert 'story-time-mp3-duration.py' in gpu
    assert 's3://${STORY_TIME_RESULTS_BUCKET}/results/' in gpu


def test_pilot_control_cannot_update_original_narrator_stack():
    source = HELPER.read_text()
    assert 'AdventurePlatformNarratorGpuPilot-staging' in source
    assert 'AdventurePlatformNarrator-staging' in source  # reads CPU VPC/subnet only
    assert 'aws cloudformation deploy --stack-name "$STACK"' in source
    assert 'aws cloudformation delete-stack --stack-name "$STACK"' in source
    assert 'UPDATE CPU' not in source
