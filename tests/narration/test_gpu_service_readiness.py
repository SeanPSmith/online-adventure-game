"""Pass 61C.5: offline regression for live GPU readiness/diagnostics via SSM."""
import json
import os
from pathlib import Path
import subprocess
import sys
import textwrap

from tests.support import PROJECT_ROOT

SCRIPT = PROJECT_ROOT / 'scripts/aws/story-time-gpu-service.sh'


def test_service_script_shell_syntax():
    subprocess.run(['bash', '-n', str(SCRIPT)], check=True)


def _run(tmp_path, action, ssm_result='Success'):
    fake_aws = tmp_path / 'aws'
    fake_aws.write_text('#!' + sys.executable + '\n' + textwrap.dedent('''\
        import json, os, pathlib, sys
        args = sys.argv[1:]
        if args[:2] == ['sts','get-caller-identity']:
            print('120737642380' if 'Account' in args else 'arn:aws:sts::120737642380:assumed-role/SimuloreAdministratorAccess/test')
        elif args[:2] == ['cloudformation','describe-stacks']:
            if 'NarratorInstanceId' in ' '.join(args): print('i-0c640e1e1de05a336')
            else: print('CREATE_COMPLETE')
        elif args[:2] == ['ec2','describe-instances']:
            print('running')
        elif args[:2] == ['ssm','describe-instance-information']:
            print('Online')
        elif args[:2] == ['ssm','send-command']:
            param = args[args.index('--parameters')+1]
            document = json.loads(pathlib.Path(param.removeprefix('file://')).read_text())
            pathlib.Path(os.environ['FAKE_SSM_COMMANDS']).write_text(json.dumps(document))
            print('fake-ssm-command')
        elif args[:2] == ['ssm','get-command-invocation']:
            if 'Status' in args: print(os.environ['FAKE_SSM_RESULT'])
            else: print('MOCK SSM output (bounded by real implementation)')
        else:
            print('Unexpected AWS call: '+repr(args),file=sys.stderr)
            sys.exit(111)
    '''))
    fake_aws.chmod(0o755)
    result = subprocess.run(['bash', str(SCRIPT), action], capture_output=True, text=True, env={
        **os.environ,
        'PATH': str(tmp_path)+os.pathsep+os.environ['PATH'],
        'FAKE_SSM_RESULT': ssm_result,
        'FAKE_SSM_COMMANDS': str(tmp_path/'commands.json'),
    }, timeout=20)
    content = json.loads((tmp_path/'commands.json').read_text())
    return result, '\n'.join(content['commands']), content


def test_smoke_waits_and_reports_a_stuck_or_crashed_kokoro(tmp_path):
    result, commands, document = _run(tmp_path, 'smoke')
    assert result.returncode == 0, result.stderr
    assert 'GPU narrator smoke PASS' in result.stdout
    assert '36' in commands and 'sleep 2' in commands
    assert '/v1/audio/voices' in commands
    assert 'curl -fsS --max-time 3' in commands
    assert '=== Container state ===' in commands
    assert 'docker logs --tail 75' in commands
    assert 'OOMKilled' in commands
    assert 'exit 41' in commands
    assert '/v1/audio/speech' in commands and 'am_michael' in commands
    assert 'Tales of Two narrator health check.' in commands
    assert 'audio_bytes=$(wc -c' in commands
    assert document['executionTimeout'] == ['600']
    subprocess.run(['bash','-n'], input=commands, text=True, check=True)


def test_diagnose_is_observational_and_does_not_start_an_instance(tmp_path):
    result, commands, document = _run(tmp_path, 'diagnose')
    assert result.returncode == 0, result.stderr
    assert 'docker logs --tail 85' in commands
    assert 'systemctl status tot-story-time-gpu.service' in commands
    assert 'curl -fsSv --max-time 6' in commands
    assert 'nvidia-smi' in commands and 'OOMKilled' in commands
    assert 'ec2 start-instances' not in commands
    assert 'docker start' not in commands
    assert document['executionTimeout'] == ['600']
    subprocess.run(['bash','-n'], input=commands, text=True, check=True)


def test_failed_smoke_branch_stays_fail_closed():
    text = SCRIPT.read_text()
    assert 'Failed|Cancelled|TimedOut|Cancelling)' in text
    assert 'GPU $action FAILED:' in text
    assert "return 1 ;;" in text
