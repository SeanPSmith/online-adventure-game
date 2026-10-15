"""GPU narration metering deployment guardrails (no real AWS calls)."""
from pathlib import Path
import os
import re
import shutil
import subprocess
import textwrap

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/aws/deploy-story-time-guardrails.sh'


def test_shell_syntax():
    subprocess.run(['bash', '-n', str(SCRIPT)], check=True)


def test_only_backend_stack_is_deployed_and_gpu_cutover_remains_active():
    data = SCRIPT.read_text()
    assert 'export TOT_ENABLE_GPU_NARRATOR_STACK=1' in data
    assert 'export TOT_STORY_TIME_GPU_CUTOVER=1' in data
    assert 'export TOT_ENABLE_NARRATOR_STACK=0' in data
    assert 'npx cdk deploy "$BACKEND_STACK" --exclusively' in data
    assert 'npx cdk deploy "$GPU_STACK"' not in data
    assert 'ec2 start-instances' not in data
    assert 'ec2 stop-instances' not in data
    assert 'aws ecs describe-task-definition' in data
    assert 'STORY_TIME_METER_TABLE' in data
    assert 'check_routing' in data
    assert 'DEPLOY NARRATOR METER' in data


def ecs_query(variable):
    source = SCRIPT.read_text()
    # Extract the real expression from the AWS CLI command, rather than
    # hard-code a second version of the implementation in the test.
    match = re.search(r'--query "(taskDefinition\.containerDefinitions\[[^"\n]*' + variable + r'[^"\n]*)" --output text', source)
    assert match, f'No AWS ECS query found for {variable}'
    return match.group(1)


@pytest.fixture
def task_json():
    return {
        'taskDefinition': {
            'containerDefinitions': [
                {'name': 'sidecar', 'environment': [{'name': 'KOKORO_INSTANCE_ID', 'value': 'i-wrong'}]},
                {'name': 'backend', 'environment': [
                    {'name': 'PYTHONUNBUFFERED', 'value': '1'},
                    {'name': 'KOKORO_INSTANCE_ID', 'value': 'i-0c640e1e1de05a336'},
                    {'name': 'STORY_TIME_METER_TABLE', 'value': 'storytime-meter-staging'},
                ]},
            ]
        }
    }


def test_nested_ecs_query_reads_correct_gpu_instance(task_json):
    jmespath = pytest.importorskip('jmespath')
    assert jmespath.search(ecs_query('KOKORO_INSTANCE_ID'), task_json) == 'i-0c640e1e1de05a336'


def test_nested_ecs_query_reads_meter_table(task_json):
    jmespath = pytest.importorskip('jmespath')
    assert jmespath.search(ecs_query('STORY_TIME_METER_TABLE'), task_json) == 'storytime-meter-staging'


def test_missing_backend_or_missing_id_is_not_reported_as_gpu(task_json):
    jmespath = pytest.importorskip('jmespath')
    query = ecs_query('KOKORO_INSTANCE_ID')
    assert jmespath.search(query, {'taskDefinition': {'containerDefinitions': [task_json['taskDefinition']['containerDefinitions'][0]]}}) is None
    backend = task_json['taskDefinition']['containerDefinitions'][1]
    backend['environment'] = [{'name': 'PYTHONUNBUFFERED', 'value': '1'}]
    assert jmespath.search(query, task_json) is None


def test_prior_nested_query_produced_false_none(task_json):
    jmespath = pytest.importorskip('jmespath')
    broken = "taskDefinition.containerDefinitions[?name=='backend'].environment[?name=='KOKORO_INSTANCE_ID'].value | [0]"
    assert jmespath.search(broken, task_json) is None
    assert jmespath.search(ecs_query('KOKORO_INSTANCE_ID'), task_json) == 'i-0c640e1e1de05a336'


def mock_operator(tmp_path):
    """Run the actual shell script against an AWS-compatible query stub."""
    pytest.importorskip('jmespath')
    root = tmp_path / 'project'
    shell_dir = root / 'scripts' / 'aws'
    shell_dir.mkdir(parents=True)
    (root / 'infra').mkdir()
    shutil.copy2(SCRIPT, shell_dir / SCRIPT.name)
    (shell_dir / 'check-aws.sh').write_text('#!/bin/sh\necho "AWS staging identity check: PASS (mock)"\n')
    (shell_dir / 'check-aws.sh').chmod(0o755)
    bin_dir = tmp_path / 'bin'
    bin_dir.mkdir()
    (bin_dir / 'aws').write_text(textwrap.dedent('''\
        #!/usr/bin/env python3
        import json, os, sys, jmespath
        args=sys.argv[1:]
        kind=' '.join(args[:2])
        gpu_id=os.environ.get('MOCK_ACTIVE_GPU', 'i-0c640e1e1de05a336')
        meter=os.environ.get('MOCK_METER', 'storytime-meter-staging')
        if kind=='cloudformation describe-stacks':
            stack=args[args.index('--stack-name')+1]
            data={'Stacks':[{'StackStatus':'UPDATE_COMPLETE','Outputs':[{'OutputKey':'NarratorInstanceId','OutputValue':'i-0c640e1e1de05a336'}]}]}
        elif kind=='ecs describe-services':
            data={'services':[{'taskDefinition':'arn:aws:ecs:us-east-1:123:task-definition/backend:9'}]}
        elif kind=='ecs describe-task-definition':
            data={'taskDefinition':{'containerDefinitions':[
                {'name':'other','environment':[{'name':'KOKORO_INSTANCE_ID','value':'i-other'}]},
                {'name':'backend','environment':[{'name':'KOKORO_INSTANCE_ID','value':gpu_id},
                     {'name':'STORY_TIME_METER_TABLE','value':meter}]}
            ]}}
        elif kind=='dynamodb describe-table':
            data={'Table':{'TableName':meter,'TableStatus':'ACTIVE','GlobalSecondaryIndexes':[{'IndexStatus':'ACTIVE'}]}}
        else:
            raise SystemExit('unexpected mocked AWS command: '+kind)
        result=jmespath.search(args[args.index('--query')+1],data)
        if result is None: print('None')
        elif isinstance(result,list): print('\\t'.join(str(x) for x in result))
        elif isinstance(result,dict): print(json.dumps(result))
        else: print(result)
    '''))
    for tool in ('npm', 'npx'):
        f = bin_dir / tool
        f.write_text('#!/bin/sh\necho "'+tool+' $*" >> "$MOCK_COMMAND_LOG"\n')
        f.chmod(0o755)
    (bin_dir / 'aws').chmod(0o755)
    env = dict(os.environ, PATH=f'{bin_dir}:{os.environ["PATH"]}', MOCK_COMMAND_LOG=str(tmp_path / 'commands.log'))
    return shell_dir / SCRIPT.name, env, tmp_path / 'commands.log'


def test_plan_routes_to_existing_gpu_without_aws_mutations(tmp_path):
    script, env, log = mock_operator(tmp_path)
    result = subprocess.run(['bash', str(script), 'plan'], text=True, capture_output=True, env=env, timeout=10)
    assert result.returncode == 0, result.stdout + result.stderr
    assert 'PASS: existing backend narrator is the dedicated GPU' in result.stdout
    assert 'Plan only.' in result.stdout
    assert 'npm run build' in log.read_text()
    assert 'npx cdk diff' in log.read_text()
    assert 'cdk deploy' not in log.read_text()


def test_mismatched_actual_route_blocks_before_cdk(tmp_path):
    script, env, log = mock_operator(tmp_path)
    env['MOCK_ACTIVE_GPU'] = 'i-different'
    result = subprocess.run(['bash', str(script), 'plan'], text=True, capture_output=True, env=env, timeout=10)
    assert result.returncode != 0
    assert 'Refusing to synthesize a different narrator route' in result.stderr
    assert not log.exists(), 'No CDK calls are allowed when route mismatches'


def test_verify_reads_real_table_and_does_not_modify_aws(tmp_path):
    script, env, log = mock_operator(tmp_path)
    result = subprocess.run(['bash', str(script), 'verify'], text=True, capture_output=True, env=env, timeout=10)
    assert result.returncode == 0, result.stdout + result.stderr
    assert 'PASS: configured ECS metering table: storytime-meter-staging' in result.stdout
    assert not log.exists(), 'Verify must not synthesize or deploy anything'
