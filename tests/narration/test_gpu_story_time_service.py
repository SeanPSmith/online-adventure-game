"""Static/code-level safety checks for the unreleased dedicated G6f integration."""
from pathlib import Path
import os
import subprocess
from app.narration import routes
from tests.support import PROJECT_ROOT


def load(relative):
    return (PROJECT_ROOT / relative).read_text()


def test_gpu_separate_from_cpu_and_gated():
    source = load('infra/bin/adventure-platform.ts')
    assert '"AdventurePlatformNarratorGpu-staging"' in source
    assert '"AdventurePlatformNarrator-staging"' in source
    assert 'process.env.TOT_ENABLE_GPU_NARRATOR_STACK === "1"' in source
    assert 'process.env.TOT_STORY_TIME_GPU_CUTOVER === "1"' in source
    assert 'if (gpuCutover && !gpuNarrator)' in source
    assert 'const narrator = gpuCutover ? gpuNarrator : cpuNarrator;' in source


def test_gpu_boot_isolated_model_and_private_ingress():
    src = load('infra/lib/narrator-stack.ts')
    boot = load('infra/narrator/gpu-bootstrap.sh')
    assert 'backendSecurityGroup' in src
    assert 'sg.addIngressRule(props.backendSecurityGroup, ec2.Port.tcp(8880)' in src
    assert '"g6f.large"' in src
    assert 'fromSsmParameter(' in src
    assert 'vm.overcommit_memory = 1' in boot
    assert 'kernel-modules-extra-$RUNNING_KERNEL' in boot
    assert '580.159.03-grid-aws.run' in boot
    assert 'ghcr.io/remsky/kokoro-fastapi-gpu:v0.9.0-cu126' in boot
    assert 'tot-story-time-gpu.service' in boot
    assert 'systemctl enable --now tot-story-time-gpu.service' in boot
    subprocess.run(['bash','-n',str(PROJECT_ROOT/'infra/narrator/gpu-bootstrap.sh')], check=True)


def test_watchdog_separate_gpu_idle_and_active_job_protection():
    src = load('infra/lib/narrator-stack.ts')
    assert 'ROOM_IDLE_SECONDS: gpu ? "300" : "900"' in src
    assert 'MIN_UPTIME_SECONDS: gpu ? "600" : "1200"' in src
    assert 'MAX_MONTHLY_SECONDS: gpu ? "108000" : "216000"' in src
    assert 'KOKORO_MAX_MONTHLY_SECONDS' in load("infra/lib/backend-stack.ts")
    assert 'kokoroMaxMonthlySeconds: gpuCutover ? 108000 : 216000' in load("infra/bin/adventure-platform.ts")
    watchdog = load('infra/narrator/watchdog.py')
    assert 'MIN_UPTIME = int(os.getenv("MIN_UPTIME_SECONDS", "1200"))' in watchdog
    assert 'not job_active and not room_still_active' in watchdog
    assert 'now - launch_epoch >= MIN_UPTIME' in watchdog


def test_cpu_and_gpu_cache_keys_are_distinct(monkeypatch):
    monkeypatch.delenv('KOKORO_CACHE_VERSION', raising=False)
    cpu = routes._audio_key('Same story text', 'am_michael')
    monkeypatch.setenv('KOKORO_CACHE_VERSION', 'kokoro-gpu-v0.9.0-cu126')
    gpu = routes._audio_key('Same story text', 'am_michael')
    assert cpu != gpu
    monkeypatch.setenv('KOKORO_CACHE_VERSION', '')
    assert routes._audio_key('Same story text', 'am_michael') == cpu


def test_operator_script_explicit_and_safe():
    script = PROJECT_ROOT / 'scripts/aws/story-time-gpu-service.sh'
    subprocess.run(['bash','-n',str(script)],check=True)
    txt = script.read_text()
    for marker in ['CREATE DEDICATED GPU NARRATOR', 'DEPLOY DEDICATED GPU',
                   'START DEDICATED GPU', 'SWITCH STAGING TO GPU', 'RESTORE CPU NARRATOR']:
        assert marker in txt
    assert 'smoke # Refuse to switch' in txt
    backend = load('scripts/aws/deploy-backend.sh')
    assert 'Refusing ambiguous Backend CDK deployment.' in backend


def test_gpu_launch_template_name_generated_by_cloudformation():
    src = load('infra/lib/narrator-stack.ts')
    assert 'cdk.Aspects.of(this).add({' in src
    assert 'node instanceof ec2.CfnLaunchTemplate' in src
    assert 'node.addPropertyDeletionOverride("LaunchTemplateName")' in src
    assert 'GPU instance LaunchTemplate child not found' not in src
    script = load('scripts/aws/story-time-gpu-service.sh')
    assert 'verify_gpu_synth' in script
    assert 'verify-gpu-cdk-template.py' in script
    assert script.index('verify_gpu_synth\n    (cd') < script.index("ask 'DEPLOY DEDICATED GPU'")


def test_gpu_create_rollback_cleanup_is_scoped_to_failed_stack():
    script = load('scripts/aws/story-time-gpu-service.sh')
    assert 'current_status="$(stack_status "$GPU_STACK")"' in script
    assert '"$current_status" != ROLLBACK_COMPLETE' in script
    assert "ask 'DELETE FAILED GPU STACK'" in script
    assert 'aws cloudformation delete-stack --stack-name "$GPU_STACK"' in script
    assert 'aws cloudformation wait stack-delete-complete --stack-name "$GPU_STACK"' in script
    subprocess.run(['bash', '-n', str(PROJECT_ROOT / 'scripts/aws/story-time-gpu-service.sh')], check=True)


def test_gpu_stack_rollback_cleanup_state_machine(tmp_path):
    import sys
    import textwrap

    aws = tmp_path / 'aws'
    aws.write_text(textwrap.dedent(f'''\
        #!{sys.executable}
        import os, sys
        from pathlib import Path
        args = sys.argv[1:]
        if args[:2] == ['sts', 'get-caller-identity']:
            print('120737642380' if 'Account' in args else 'arn:aws:sts::120737642380:assumed-role/ReadOnly/session')
        elif args[:2] == ['cloudformation', 'describe-stacks']:
            status = os.environ.get('FAKE_STACK_STATUS', '')
            if status == 'AUTH_FAILURE':
                sys.stderr.write('Error when retrieving token from sso: Token has expired\\n')
                sys.exit(255)
            if status == 'ABSENT':
                sys.stderr.write('Stack with id AdventurePlatformNarratorGpu-staging does not exist\\n')
                sys.exit(255)
            print(status)
        elif args[:2] == ['cloudformation', 'delete-stack']:
            Path(os.environ['FAKE_AWS_LOG']).write_text(' '.join(args))
        elif args[:2] == ['cloudformation', 'wait']:
            pass
        else:
            sys.stderr.write('Unexpected AWS action: ' + ' '.join(args) + '\\n')
            sys.exit(111)
    '''))
    aws.chmod(0o755)
    script = PROJECT_ROOT / 'scripts/aws/story-time-gpu-service.sh'
    env = dict(os.environ, PATH=str(tmp_path) + os.pathsep + os.environ['PATH'], FAKE_AWS_LOG=str(tmp_path / 'log'))
    for status, allowed in [('ROLLBACK_COMPLETE', True), ('CREATE_COMPLETE', False), ('ROLLBACK_IN_PROGRESS', False), ('AUTH_FAILURE', False)]:
        (tmp_path / 'log').unlink(missing_ok=True)
        result = subprocess.run(['bash', str(script), 'clear-rollback'], input='DELETE FAILED GPU STACK\n',
                                env=dict(env, FAKE_STACK_STATUS=status), text=True, capture_output=True)
        assert (result.returncode == 0) is allowed, (status, result.stdout, result.stderr)
        assert (tmp_path / 'log').exists() is allowed
        if allowed:
            assert (tmp_path / 'log').read_text() == 'cloudformation delete-stack --stack-name AdventurePlatformNarratorGpu-staging'
