"""Offline contract tests for the Mac SSM CPU benchmark preflight (no AWS calls)."""
from pathlib import Path
import os
import shutil
import subprocess
import tempfile
import textwrap

ROOT = Path(__file__).resolve().parents[2]

MOCK_AWS = '''#!/usr/bin/env python3
import os, pathlib, sys
args = sys.argv[1:]
log = pathlib.Path(os.environ['MOCK_AWS_LOG'])
with log.open('a') as f:
    f.write(' '.join(args[:2]) + '\\n')
cmd = args[:2]
if cmd == ['cloudformation', 'describe-stacks']:
    print('i-03940f7c36796a2fa')
elif cmd == ['ec2', 'describe-instances']:
    query = args[args.index('--query')+1]
    if 'State.Name' in query: print('running')
    else: print('arn:aws:iam::test:instance-profile/role\\t1.2.3.4\\tsubnet-test')
elif cmd == ['ec2', 'describe-instance-status']:
    print('ok\\tok')
elif cmd == ['ssm', 'describe-instance-information']:
    sequence = os.getenv('MOCK_SSM_SEQUENCE', 'None').split(',')
    counter = pathlib.Path(os.environ['MOCK_SSM_COUNTER'])
    n = int(counter.read_text()) if counter.exists() else 0
    counter.write_text(str(n+1))
    print(sequence[min(n,len(sequence)-1)])
elif cmd == ['ssm', 'send-command']:
    counter = pathlib.Path(os.environ['MOCK_SEND_COUNTER'])
    n = int(counter.read_text()) if counter.exists() else 0
    counter.write_text(str(n+1))
    if n < int(os.getenv('MOCK_INVALID_BEFORE_SUCCESS','0')):
        print('An error occurred (InvalidInstanceId) when calling the SendCommand operation:',file=sys.stderr)
        sys.exit(255)
    print('mock-command-id')
elif cmd == ['ssm', 'get-command-invocation']:
    query = args[args.index('--query')+1]
    print('Failed' if query == 'Status' else 'Intentional test failure')
else:
    raise RuntimeError('Unexpected AWS command: ' + ' '.join(args))
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
                   STORY_TIME_CPU_RESULTS_DIR=str(base / 'results'))
        process = subprocess.run(['bash', str(project / 'scripts' / 'aws' / 'benchmark-story-time-remote.sh')],
                                 text=True, input='y\n', capture_output=True, env=env, timeout=10)
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
