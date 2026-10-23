"""Offline contract tests for the Mac SSM CPU benchmark preflight (no AWS calls)."""
from pathlib import Path
import os
import shutil
import subprocess
import tempfile
import textwrap

ROOT = Path(__file__).resolve().parents[2]

MOCK_AWS = r'''#!/usr/bin/env bash
set -euo pipefail
printf '%s %s\n' "${1:-}" "${2:-}" >> "$MOCK_AWS_LOG"
service="${1:-}"; command="${2:-}"
case "$service $command" in
  'cloudformation describe-stacks') echo 'i-03940f7c36796a2fa' ;;
  'ec2 describe-instances')
    if [[ " $* " == *'State.Name'* ]]; then echo running
    else printf 'arn:aws:iam::test:instance-profile/role\t1.2.3.4\tsubnet-test\n'; fi ;;
  'ec2 describe-instance-status') printf 'ok\tok\n' ;;
  'ssm describe-instance-information')
    n=0; [[ ! -f "$MOCK_SSM_COUNTER" ]] || n=$(<"$MOCK_SSM_COUNTER")
    echo "$(( n + 1 ))" > "$MOCK_SSM_COUNTER"
    IFS=',' read -ra seq <<< "${MOCK_SSM_SEQUENCE:-None}"
    (( n < ${#seq[@]} )) || n=$(( ${#seq[@]} - 1 ))
    echo "${seq[n]}" ;;
  'ssm send-command')
    n=0; [[ ! -f "$MOCK_SEND_COUNTER" ]] || n=$(<"$MOCK_SEND_COUNTER")
    echo "$(( n + 1 ))" > "$MOCK_SEND_COUNTER"
    if (( n < ${MOCK_INVALID_BEFORE_SUCCESS:-0} )); then
      echo 'An error occurred (InvalidInstanceId) when calling the SendCommand operation:' >&2
      exit 255
    fi
    echo mock-command-id ;;
  'ssm get-command-invocation')
    if [[ " $* " == *'--query Status '* ]]; then echo Failed
    else echo 'Intentional test failure'; fi ;;
  *) echo "Unexpected AWS command: $*" >&2; exit 5 ;;
esac
''' 


def run_script(sequence: str, *, wait: str = '0', invalid_before_success: int = 0):
    with tempfile.TemporaryDirectory() as td:
        base = Path(td)
        aws_dir = base / 'bin'
        aws_dir.mkdir()
        aws = aws_dir / 'aws'
        aws.write_text(MOCK_AWS)
        aws.chmod(0o755)
        sleep = aws_dir / 'sleep'
        sleep.write_text('#!/bin/sh\nexit 0\n')
        sleep.chmod(0o755)
        # Emulate BSD/macOS mktemp: the template must END in XXXXXX.
        # GNU mktemp accepts some suffixes that silently break on macOS.
        portable_mktemp = aws_dir / 'mktemp'
        portable_mktemp.write_text(
            '#!/usr/bin/env bash\n'
            '[[ "${1:-}" == *XXXXXX ]] || { echo "mktemp: template must end in XXXXXX" >&2; exit 1; }\n'
            'exec /usr/bin/mktemp "$@"\n'
        )
        portable_mktemp.chmod(0o755)
        project = base / 'root'
        for name in ('benchmark-story-time-remote.sh', 'benchmark-story-time-ec2.sh', 'story-time-mp3-duration.py'):
            original = ROOT / 'scripts' / 'aws' / name
            dest = project / 'scripts' / 'aws' / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(original, dest)
        check = project / 'scripts' / 'aws' / 'check-aws.sh'
        check.write_text('#!/bin/sh\nexit 0\n')
        check.chmod(0o755)
        log = base / 'aws.log'
        env = os.environ.copy()
        env.update(PATH=f'{aws_dir}:{env.get("PATH", "")}',
                   MOCK_AWS_LOG=str(log), MOCK_SSM_COUNTER=str(base / 'ssm.count'),
                   MOCK_SEND_COUNTER=str(base / 'send.count'),
                   MOCK_SSM_SEQUENCE=sequence,
                   MOCK_INVALID_BEFORE_SUCCESS=str(invalid_before_success),
                   STORY_TIME_SSM_WAIT_SECONDS=wait,
                   STORY_TIME_SSM_POLL_SECONDS='1',
                   STORY_TIME_SSM_RETRY_SECONDS='0',
                   STORY_TIME_CPU_RESULTS_DIR=str(base / 'results'))
        process = subprocess.run(['bash', str(project / 'scripts' / 'aws' / 'benchmark-story-time-remote.sh')],
                                 text=True, input='y\n', capture_output=True, env=env, timeout=45)
        return process, log.read_text(), int((base / 'send.count').read_text()) if (base / 'send.count').exists() else 0


def test_offline_node_never_receives_command():
    result, log, sends = run_script('None', wait='0')
    assert result.returncode == 3
    assert "SSM node is 'None'" in result.stderr
    assert 'No benchmark was submitted' in result.stderr
    assert 'ec2 describe-instance-status' in log
    assert sends == 0


def test_agent_becoming_online_can_submit_benchmark():
    result, log, sends = run_script('None,Online', wait='2')
    assert 'SSM managed node: Online' in result.stdout
    assert result.returncode == 1  # mocked invocation intentionally fails
    assert 'SSM status: Failed' in result.stdout
    assert sends == 1


def test_invalid_instance_id_only_retried_bounded_number():
    result, log, sends = run_script('Online', wait='0', invalid_before_success=2)
    assert result.returncode == 1  # mocked command invocation intentionally fails
    assert 'Retrying in 5s' in result.stderr
    assert sends == 3


def test_ssm_still_unavailable_after_poll_does_not_submit():
    result, log, sends = run_script('ConnectionLost', wait='2')
    assert result.returncode == 3
    assert 'ConnectionLost' in result.stderr
    assert sends == 0


def test_benchmark_uses_bsd_compatible_temporary_templates():
    source = (ROOT / 'scripts' / 'aws' / 'benchmark-story-time-remote.sh').read_text()
    import re
    templates = re.findall(r'mktemp\s+"([^"\n]+)"', source)
    assert len(templates) == 3
    assert all(t.endswith('XXXXXX') for t in templates), templates
