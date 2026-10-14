"""Offline safety checks for the isolated, inexpensive GPU pilot."""
import os
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
PILOT = ROOT / "scripts/aws/story-time-gpu-pilot.sh"
BUDGET = ROOT / "scripts/aws/story-time-gpu-budget.sh"
TEMPLATE = ROOT / "infra/gpu-pilot/story-time-gpu-pilot.yaml"


def test_shell_scripts_parse():
    for path in (PILOT, BUDGET):
        subprocess.run(["bash", "-n", str(path)], check=True)


def test_budget_has_separate_resources_and_safe_memory():
    code = PILOT.read_text()
    template = TEMPLATE.read_text()
    assert "STACK='AdventurePlatformNarratorGpuBudgetPilot-staging'" in code
    assert "STACK='AdventurePlatformNarratorGpuPilot-staging'" in code
    assert "DEFAULT_GPU_TYPE='g6f.large'" in code
    assert "CONTAINER_MEMORY_GIB=6" in code
    assert "ROOT_VOLUME_GIB=50" in code
    assert "MAX_RUN_SECONDS=1800" in code
    assert "al2023-ami-kernel-6.1-x86_64" in code
    assert "base-oss-nvidia-driver" not in code
    assert "CREATE BUDGET GPU PILOT" in code
    assert "DELETE BUDGET GPU PILOT" in code
    assert "AllowedValues: [g4dn.xlarge, g6.xlarge, g6f.large]" in template
    assert "--memory=${ContainerMemoryGiB}g" in template
    assert "VolumeSize: !Ref RootVolumeGiB" in template
    assert "SecurityGroupIngress: []" in template
    assert "-p 127.0.0.1:8880:8880" in template
    assert "arn:${AWS::Partition}:iam::aws:policy/AmazonSSMManagedInstanceCore" in template
    assert "IsFractionalGpu: !Equals [!Ref InstanceType, g6f.large]" in template
    assert "ReadAwsGridDriverForBudgetOnly" in template
    assert "s3:ListBucket" in template and "s3:GetObject" in template
    assert "ec2-linux-nvidia-drivers" in template
    assert 'RUNNING_KERNEL="$(uname -r)"' in template
    assert 'kernel-devel-$RUNNING_KERNEL' in template
    assert 'kernel6.12-devel-$RUNNING_KERNEL' in template
    assert 'kernel6.18-devel-$RUNNING_KERNEL' in template
    assert 'test -d "/usr/src/kernels/$RUNNING_KERNEL"' in template
    assert 'kernel-devel-$(uname -r)' not in template
    assert "nvidia-container-toolkit" in template
    assert r"580\.159\.03" in template
    assert r"580\.126\.09" in template
    assert "--kernel-module-type=proprietary" in template
    assert "nvidia-smi ||" in template
    assert "--gpus all" in template
    assert "No pinned supported GRID" in template
    assert "s3://ec2-linux-nvidia-drivers/latest/" not in template


def test_budget_and_standard_plan_are_isolated(tmp_path):
    aws = tmp_path / "aws"
    aws.write_text("""#!/usr/bin/env bash
if [[ "$1" == sts && "$2" == get-caller-identity ]]; then
  if [[ " $* " == *' --query Account '* ]]; then echo 120737642380; else echo arn:aws:iam::120737642380:role/fake; fi
  exit 0
fi
exit 99
""")
    aws.chmod(0o755)
    env = dict(os.environ, PATH=str(tmp_path) + os.pathsep + os.environ["PATH"])
    budget = subprocess.run(["bash", str(BUDGET), "plan"], env=env, capture_output=True, text=True)
    standard = subprocess.run(["bash", str(PILOT), "plan"], env=env, capture_output=True, text=True)
    assert budget.returncode == standard.returncode == 0, budget.stderr + standard.stderr
    assert "g6f.large" in budget.stdout
    assert "CREATE" not in budget.stdout or "NOTHING CREATED" in budget.stdout
    assert "g4dn.xlarge" in standard.stdout
    assert "g6f.large" not in standard.stdout
    assert "Nothing" not in standard.stderr


def test_budget_deploy_requires_exact_confirmation_and_does_not_mutate_existing_pilot(tmp_path):
    aws = tmp_path / "aws"
    events = tmp_path / "events.txt"
    aws.write_text("""#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$AWS_STUB_EVENTS"
if [[ "$1" == sts ]]; then
  if [[ " $* " == *' --query Account '* ]]; then echo 120737642380; else echo arn:aws:iam::120737642380:role/fake; fi
elif [[ "$1" == cloudformation && "$2" == describe-stacks ]]; then
  if [[ " $* " == *'AdventurePlatformNarratorGpuBudgetPilot-staging'* ]]; then exit 254; fi
  echo i-01cpu
elif [[ "$1" == ec2 && "$2" == describe-instances ]]; then
  echo 'vpc-010 subnet-010'
elif [[ "$1" == ec2 && "$2" == describe-images ]]; then
  echo 100
elif [[ "$1" == ssm && "$2" == get-parameter ]]; then
  echo ami-0123456789
elif [[ "$1" == cloudformation && "$2" == deploy ]]; then
  echo 'DEPLOY NOT EXPECTED' >&2
  exit 111
fi
""")
    aws.chmod(0o755)
    env = dict(os.environ, PATH=str(tmp_path) + os.pathsep + os.environ["PATH"], AWS_STUB_EVENTS=str(events))
    result = subprocess.run(["bash", str(BUDGET), "deploy"], input="n\n", env=env, capture_output=True, text=True)
    assert result.returncode != 0
    assert "CREATE BUDGET GPU PILOT" in result.stdout
    assert "g6f.large" in result.stdout
    assert "1800s" in result.stdout
    assert "100 GiB" in result.stdout
    assert "DEPLOY NOT EXPECTED" not in result.stderr
    assert "--stack-name AdventurePlatformNarratorGpuBudgetPilot-staging" in events.read_text()
    assert "--name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-x86_64" in events.read_text()
    assert "cloudformation deploy" not in events.read_text()


def test_budget_userdata_shell_is_parseable_and_standard_userdata_stays_separate():
    import yaml

    class Loader(yaml.SafeLoader):
        pass

    def ref(loader, node):
        return loader.construct_scalar(node)

    def sub(loader, node):
        return loader.construct_scalar(node)

    Loader.add_constructor('!Ref', ref)
    Loader.add_constructor('!Sub', sub)
    Loader.add_constructor('!GetAtt', ref)
    Loader.add_constructor('!Equals', lambda l,n: l.construct_sequence(n))
    Loader.add_constructor('!If', lambda l,n: l.construct_sequence(n))

    parsed = yaml.load(TEMPLATE.read_text(), Loader=Loader)
    assert parsed['Conditions']['IsFractionalGpu'][1] == 'g6f.large'
    userdata = parsed['Resources']['PilotInstance']['Properties']['UserData']
    assert len(userdata) == 3
    budget = userdata[1]['Fn::Base64']
    standard = userdata[2]['Fn::Base64']
    assert "--kernel-module-type=proprietary" in budget
    assert 'aws s3 ls s3://ec2-linux-nvidia-drivers/' in budget
    assert '--kernel-module-type=proprietary' not in standard
    assert 'ghcr.io/remsky/kokoro-fastapi-gpu:v0.9.0-cu126' in standard
    for script in (budget, standard):
        result = subprocess.run(['bash', '-n'], input=script, capture_output=True, text=True)
        assert result.returncode == 0, result.stderr


@pytest.mark.parametrize('kernel,expected', [
    ('6.1.159-198.299.amzn2023.x86_64', 'kernel-devel-6.1.159-198.299.amzn2023.x86_64'),
    ('6.12.27-33.amzn2023.x86_64', 'kernel6.12-devel-6.12.27-33.amzn2023.x86_64'),
    ('6.18.54-121.166.amzn2023.x86_64', 'kernel6.18-devel-6.18.54-121.166.amzn2023.x86_64'),
    ('6.99.1-custom', None),
])
def test_budget_kernel_devel_package_is_selected_for_running_kernel(kernel, expected, tmp_path):
    """Reproduce the observed 6.18 mismatch without contacting AWS."""
    import yaml

    class Loader(yaml.SafeLoader):
        pass
    Loader.add_constructor('!Ref', lambda loader,node: loader.construct_scalar(node))
    Loader.add_constructor('!Sub', lambda loader,node: loader.construct_scalar(node))
    Loader.add_constructor('!GetAtt', lambda loader,node: loader.construct_scalar(node))
    Loader.add_constructor('!Equals', lambda loader,node: loader.construct_sequence(node))
    Loader.add_constructor('!If', lambda loader,node: loader.construct_sequence(node))
    script=yaml.load(TEMPLATE.read_text(), Loader=Loader)['Resources']['PilotInstance']['Properties']['UserData'][1]['Fn::Base64']
    start=script.index('RUNNING_KERNEL="$(uname -r)"')
    end=script.index('echo "Installing matching kernel build headers and DRM modules: $KERNEL_DEV_PKG $KERNEL_EXTRA_PKG"')
    selector=script[start:end] + 'printf "%s\n" "$KERNEL_DEV_PKG"\n'
    uname=tmp_path/'uname'
    uname.write_text('#!/bin/sh\nprintf "%s\n" "' + kernel + '"\n')
    uname.chmod(0o755)
    env=dict(os.environ, PATH=str(tmp_path)+os.pathsep+os.environ['PATH'])
    result=subprocess.run(['bash','-c',selector],env=env,capture_output=True,text=True)
    if expected:
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == expected
    else:
        assert result.returncode != 0
        assert 'Unsupported AL2023 GPU kernel' in result.stderr


def test_budget_diagnose_stopped_instance_is_read_only(tmp_path):
    """Diagnostics from a stopped GPU must never start it or submit SSM."""
    aws = tmp_path / "aws"
    calls = tmp_path / "aws-events.txt"
    aws.write_text('''#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$AWS_STUB_EVENTS"
case "$1 $2" in
  "sts get-caller-identity")
    if [[ " $* " == *' --query Account '* ]]; then echo 120737642380; else echo arn:aws:iam::120737642380:role/fake; fi;;
  "cloudformation describe-stacks")
    if [[ " $* " == *' --query Stacks[0].StackStatus '* ]]; then echo CREATE_COMPLETE
    elif [[ " $* " == *'GpuPilotInstanceId'* ]]; then echo i-budget123
    else echo not-used; fi;;
  "ec2 describe-instances") echo stopped;;
  "ec2 get-console-output") echo 'user-data: driver package install failed';;
  *) echo "UNEXPECTED AWS CALL: $*" >&2; exit 99;;
esac
''')
    aws.chmod(0o755)
    env = dict(os.environ, PATH=str(tmp_path) + os.pathsep + os.environ["PATH"], AWS_STUB_EVENTS=str(calls))
    proc = subprocess.run(["bash", str(BUDGET), "diagnose"], env=env, capture_output=True, text=True)
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "driver package install failed" in proc.stdout
    assert "No instance was started" in proc.stdout
    commands = calls.read_text()
    assert "ec2 get-console-output" in commands
    assert "ec2 start-instances" not in commands
    assert "ec2 stop-instances" not in commands
    assert "ssm send-command" not in commands


def test_budget_diagnose_can_gracefully_handle_empty_console_log(tmp_path):
    aws = tmp_path / "aws"
    aws.write_text('''#!/usr/bin/env bash
case "$1 $2" in
  "sts get-caller-identity")
    if [[ " $* " == *' --query Account '* ]]; then echo 120737642380; else echo arn:aws:iam::120737642380:role/fake; fi;;
  "cloudformation describe-stacks")
    if [[ " $* " == *'GpuPilotInstanceId'* ]]; then echo i-budget123; else echo CREATE_COMPLETE; fi;;
  "ec2 describe-instances") echo stopped;;
  "ec2 get-console-output") echo None;;
  *) exit 99;;
esac
''')
    aws.chmod(0o755)
    env = dict(os.environ, PATH=str(tmp_path) + os.pathsep + os.environ["PATH"])
    proc = subprocess.run(["bash", str(BUDGET), "diagnose"], env=env, capture_output=True, text=True)
    assert proc.returncode == 0
    assert "No console output returned" in proc.stdout
    assert "No instance was started" in proc.stdout


def test_budget_curl_minimal_does_not_conflict_with_full_curl():
    """Regress the exact DNF transaction abort observed on 2026-10-13.

    AL2023 already includes curl-minimal. The G6f cloud-init must not request
    the mutually exclusive full curl RPM, nor swap packages just for HTTPS.
    """
    import yaml

    class Loader(yaml.SafeLoader):
        pass
    Loader.add_constructor('!Ref', lambda loader, node: loader.construct_scalar(node))
    Loader.add_constructor('!Sub', lambda loader, node: loader.construct_scalar(node))
    Loader.add_constructor('!GetAtt', lambda loader, node: loader.construct_scalar(node))
    Loader.add_constructor('!Equals', lambda loader, node: loader.construct_sequence(node))
    Loader.add_constructor('!If', lambda loader, node: loader.construct_sequence(node))
    budget = yaml.load(TEMPLATE.read_text(), Loader=Loader)['Resources']['PilotInstance']['Properties']['UserData'][1]['Fn::Base64']
    # The package-install transaction must never install the full curl package.
    dnf_transactions = [line.strip() for line in budget.splitlines() if 'dnf install -y' in line]
    assert dnf_transactions
    assert not any(' perl curl ' in line or ' curl ' in line for line in dnf_transactions)
    assert 'dnf swap curl-minimal' not in budget
    assert 'command -v curl' in budget
    assert 'curl -fsSL https://nvidia.github.io' in budget


def test_gpu_benchmark_waits_for_real_bootstrap_before_inference():
    """Being SSM Online alone must not trigger a premature benchmark."""
    code = PILOT.read_text()
    assert 'cloud-init status --wait --long' in code
    assert 'command -v nvidia-smi && nvidia-smi' in code
    assert 'docker inspect --format' in code
    assert code.index('cloud-init status --wait --long') < code.index("f'aws s3 cp s3://{bucket}/scripts/benchmark.sh")
    assert 'trap stop_gpu_on_exit EXIT' in code



def test_nvidia_diagnose_prioritizes_bounded_driver_errors_and_is_read_only(tmp_path):
    """Regression: SSM's 24KB inline response cut off the driver's real error."""
    import json
    aws = tmp_path / 'aws'
    captured = tmp_path / 'params.json'
    aws.write_text('''#!/usr/bin/env bash
case "$1 $2" in
  "sts get-caller-identity")
    if [[ " $* " == *' --query Account '* ]]; then echo 120737642380; else echo arn:aws:iam::120737642380:role/fake; fi;;
  "cloudformation describe-stacks")
    if [[ " $* " == *'GpuPilotInstanceId'* ]]; then echo i-budget123; else echo CREATE_COMPLETE; fi;;
  "ec2 describe-instances") echo running;;
  "ec2 get-console-output") echo None;;
  "ssm describe-instance-information") echo Online;;
  "ssm send-command")
    for x in "$@"; do
      case "$x" in file://*) cp "${x#file://}" "$AWS_DIAG_CAPTURE";; esac
    done
    echo aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee;;
  "ssm get-command-invocation")
    if [[ " $* " == *' --query Status '* ]]; then echo Success; else echo 'mock diagnostic report'; fi;;
  *) echo "UNEXPECTED AWS CALL $*" >&2; exit 99;;
esac
''')
    aws.chmod(0o755)
    env = dict(os.environ, PATH=str(tmp_path) + os.pathsep + os.environ['PATH'], AWS_DIAG_CAPTURE=str(captured))
    result = subprocess.run(['bash', str(BUDGET), 'diagnose'], env=env, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    commands = json.loads(captured.read_text())['commands']
    joined = '\n'.join(commands)
    assert 'LAST RUNTIME REPAIR' in commands[0]
    assert 'tot-gpu-runtime-ssm.log' in commands[0]
    assert 'tot-nvidia-container-cli.log' in commands[1]
    assert 'Kernel allocation' in commands[2]
    assert 'journalctl -k -b -1' in commands[2]
    assert 'vm.overcommit_memory' in commands[3]
    assert 'NVIDIA installer: errors with context' in commands[4]
    assert 'nvidia-installer.log' in commands[4]
    assert not any('sysctl -w' in command or 'docker run' in command for command in commands)
    assert 'journalctl -k -b -1' in joined
    assert 'nvidia.ko' not in joined  # no assumptions about root cause
    assert 'tail -n 100 /var/log/tot-story-time-gpu-setup.log' not in joined
    assert 'tail -n 40 /var/log/cloud-init-output.log' not in joined
    assert 'kernel-devel' in joined
    assert 'ec2 start-instances' not in result.stdout
    assert 'Diagnostics complete' in result.stdout
    assert 'No resources were started/stopped' in result.stdout


def test_budget_extra_kernel_modules_and_drm_match_running_kernel():
    import yaml

    class Loader(yaml.SafeLoader):
        pass
    Loader.add_constructor('!Ref', lambda l, n: l.construct_scalar(n))
    Loader.add_constructor('!Sub', lambda l, n: l.construct_scalar(n))
    Loader.add_constructor('!GetAtt', lambda l, n: l.construct_scalar(n))
    Loader.add_constructor('!Equals', lambda l, n: l.construct_sequence(n))
    Loader.add_constructor('!If', lambda l, n: l.construct_sequence(n))
    user_data = yaml.load(TEMPLATE.read_text(), Loader=Loader)['Resources']['PilotInstance']['Properties']['UserData'][1]['Fn::Base64']
    assert 'KERNEL_EXTRA_PKG="kernel-modules-extra-$RUNNING_KERNEL"' in user_data
    assert 'KERNEL_EXTRA_PKG="kernel6.12-modules-extra-$RUNNING_KERNEL"' in user_data
    assert 'KERNEL_EXTRA_PKG="kernel6.18-modules-extra-$RUNNING_KERNEL"' in user_data
    assert '"$KERNEL_DEV_PKG" "$KERNEL_EXTRA_PKG"' in user_data
    assert user_data.index('modprobe drm ||') < user_data.index('sh /tmp/tot-grid-driver.run')
    assert 'drm_gem_object_free' in user_data


def test_budget_repair_script_is_safely_scoped():
    repair = (ROOT / 'scripts/aws/story-time-gpu-budget-repair-ec2.sh').read_text()
    pilot = PILOT.read_text()
    assert 'kernel-modules-extra-$RUNNING_KERNEL' in repair
    assert 'modprobe drm' in repair
    assert repair.index('dnf install -y "$KERNEL_EXTRA_PKG"') < repair.index('sh "$GRID_RUN"')
    assert 'touch "$marker"' in repair
    assert repair.index('touch "$marker"') > repair.index('docker inspect')
    assert '[[ "$VARIANT" == budget ]]' in pilot
    assert '[[ "$TYPE" == g6f.large && "$STATE" == stopped ]]' in pilot
    assert 'REPAIR BUDGET GPU PILOT' in pilot
    assert 'trap stop_budget_after_repair EXIT' in pilot
    assert 'cloud-init status --wait --long' in pilot
    assert '/var/lib/tot-story-time-gpu-budget-repaired' in pilot
    assert 'command -v nvidia-smi && nvidia-smi' in pilot
    subprocess.run(['bash','-n',str(ROOT / 'scripts/aws/story-time-gpu-budget-repair-ec2.sh')],check=True)


def test_budget_repair_refuses_wrong_variant_and_rejects_without_confirmation(tmp_path):
    aws = tmp_path / 'aws'
    calls = tmp_path / 'events'
    aws.write_text('''#!/usr/bin/env bash
printf '%s\n' "$*" >> "$AWS_STUB_EVENTS"
case "$1 $2" in
  "sts get-caller-identity")
    if [[ " $* " == *' --query Account '* ]]; then echo 120737642380; else echo arn:aws:iam::120737642380:role/fake; fi;;
  "cloudformation describe-stacks")
    if [[ " $* " == *'GpuPilotInstanceId'* ]]; then echo i-budget123; else echo CREATE_COMPLETE; fi;;
  "ec2 describe-instances")
    if [[ " $* " == *'InstanceType'* ]]; then echo g6f.large; else echo stopped; fi;;
  *) echo "UNEXPECTED $*" >&2; exit 99;;
esac
''')
    aws.chmod(0o755)
    env = dict(os.environ, PATH=str(tmp_path) + os.pathsep + os.environ['PATH'], AWS_STUB_EVENTS=str(calls))
    declined = subprocess.run(['bash',str(BUDGET),'repair'],input='n\n',env=env,capture_output=True,text=True)
    assert declined.returncode != 0
    assert 'REPAIR BUDGET GPU PILOT' in declined.stdout
    assert 'start-instances' not in calls.read_text()
    standard = subprocess.run(['bash',str(PILOT),'repair'],input='REPAIR BUDGET GPU PILOT\n',env=env,capture_output=True,text=True)
    assert standard.returncode != 0
    assert 'only supported for the budget' in standard.stderr
    assert 'start-instances' not in calls.read_text()


def test_budget_runtime_repair_is_scoped_and_smoke_tested():
    pilot = PILOT.read_text()
    runtime = (ROOT / 'scripts/aws/story-time-gpu-budget-runtime-ec2.sh').read_text()
    subprocess.run(['bash','-n',str(ROOT / 'scripts/aws/story-time-gpu-budget-runtime-ec2.sh')],check=True)
    assert 'runtime-repair)' in pilot
    assert 'FIX GPU CONTAINER RUNTIME' in pilot
    assert '[[ "$VARIANT" == budget ]]' in pilot
    assert '[[ "$TYPE" == g6f.large && "$STATE" == stopped ]]' in pilot
    assert 'trap stop_budget_after_runtime EXIT' in pilot
    assert 'nvidia-smi -pm 1' in runtime
    assert 'nvidia-container-cli -k -d' in runtime
    assert 'docker run --rm --gpus all --entrypoint nvidia-smi' in runtime
    assert runtime.index('docker run --rm --gpus all') < runtime.index('docker run -d --name story-time-gpu')
    assert runtime.index('http://127.0.0.1:8880/docs') < runtime.index('touch "$MARKER"')
    assert 'nvidia-installer' not in runtime
    assert 'dnf install' not in runtime
    assert 'aws ec2' not in runtime
    assert 'systemctl enable tot-budget-gpu-persistence.service' in runtime
    assert '--restart unless-stopped' in runtime


def test_budget_runtime_repair_refuses_unapproved_or_wrong_instance(tmp_path):
    aws = tmp_path / 'aws'
    calls = tmp_path / 'aws.log'
    aws.write_text('''#!/usr/bin/env bash
printf '%s\n' "$*" >> "$AWS_STUB_EVENTS"
case "$1 $2" in
  "sts get-caller-identity")
    if [[ " $* " == *' --query Account '* ]]; then echo 120737642380; else echo arn:aws:iam::120737642380:role/fake; fi;;
  "cloudformation describe-stacks")
    if [[ " $* " == *'GpuPilotInstanceId'* ]]; then echo i-budget123; else echo CREATE_COMPLETE; fi;;
  "ec2 describe-instances")
    if [[ " $* " == *'InstanceType'* ]]; then echo "${AWS_FAKE_TYPE:-g6f.large}"; else echo "${AWS_FAKE_STATE:-stopped}"; fi;;
  *) echo "UNEXPECTED $*" >&2; exit 99;;
esac
''')
    aws.chmod(0o755)
    env=dict(os.environ, PATH=str(tmp_path)+os.pathsep+os.environ['PATH'], AWS_STUB_EVENTS=str(calls))
    declined=subprocess.run(['bash',str(BUDGET),'runtime-repair'],input='n\n',env=env,capture_output=True,text=True)
    assert declined.returncode != 0
    assert 'FIX GPU CONTAINER RUNTIME' in declined.stdout
    assert 'start-instances' not in calls.read_text()
    wrong=subprocess.run(['bash',str(BUDGET),'runtime-repair'],input='FIX GPU CONTAINER RUNTIME\n',env={**env,'AWS_FAKE_TYPE':'g4dn.xlarge'},capture_output=True,text=True)
    assert wrong.returncode != 0
    assert 'requires a stopped g6f.large' in wrong.stderr
    assert 'start-instances' not in calls.read_text()
    live=subprocess.run(['bash',str(BUDGET),'runtime-repair'],input='FIX GPU CONTAINER RUNTIME\n',env={**env,'AWS_FAKE_STATE':'running'},capture_output=True,text=True)
    assert live.returncode != 0
    assert 'requires a stopped g6f.large' in live.stderr
    assert 'start-instances' not in calls.read_text()
    standard=subprocess.run(['bash',str(PILOT),'runtime-repair'],input='FIX GPU CONTAINER RUNTIME\n',env=env,capture_output=True,text=True)
    assert standard.returncode != 0
    assert 'budget g6f.large only' in standard.stderr
    assert 'start-instances' not in calls.read_text()


def test_budget_memory_repair_is_bounded_and_restores_on_failure():
    """Regression: nvc virtual commit failures must not trigger a new EC2 stack."""
    pilot = PILOT.read_text()
    memory = (ROOT / 'scripts/aws/story-time-gpu-budget-memory-ec2.sh').read_text()
    subprocess.run(['bash', '-n', str(ROOT / 'scripts/aws/story-time-gpu-budget-memory-ec2.sh')], check=True)
    assert 'memory-repair)' in pilot
    assert 'TEST GPU MEMORY OVERCOMMIT' in pilot
    assert '[[ "$VARIANT" == budget ]]' in pilot
    assert '[[ "$TYPE" == g6f.large && "$STATE" == stopped ]]' in pilot
    assert 'trap stop_budget_after_memory EXIT' in pilot
    assert 'vm.overcommit_memory=1' in memory
    assert 'vm.overcommit_memory=$OLD_MODE' in memory
    assert 'rm -f "$SYSCTL_FILE"' in memory
    assert 'docker run --rm --gpus all --entrypoint nvidia-smi' in memory
    assert 'http://127.0.0.1:8880/docs' in memory
    assert memory.index('docker run --rm --gpus all') < memory.index('docker run -d --name story-time-gpu')
    assert memory.index('http://127.0.0.1:8880/docs') < memory.index('echo \'vm.overcommit_memory = 1\' > "$SYSCTL_FILE"')
    assert 'touch "$MARKER"' in memory
    assert '--memory=6g' in memory
    assert 'dnf install' not in memory
    assert 'aws ec2' not in memory
    assert 'cloudformation deploy' not in pilot.split('  memory-repair)')[1].split('  benchmark)')[0]


def test_budget_memory_repair_refuses_without_confirmation_or_wrong_instance(tmp_path):
    aws = tmp_path / 'aws'
    events = tmp_path / 'events'
    aws.write_text('''#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$AWS_STUB_EVENTS"
case "$1 $2" in
  "sts get-caller-identity")
    if [[ " $* " == *' --query Account '* ]]; then echo 120737642380; else echo arn:aws:iam::120737642380:role/fake; fi;;
  "cloudformation describe-stacks")
    if [[ " $* " == *'GpuPilotInstanceId'* ]]; then echo i-budget123; else echo CREATE_COMPLETE; fi;;
  "ec2 describe-instances")
    if [[ " $* " == *'InstanceType'* ]]; then echo "${AWS_FAKE_TYPE:-g6f.large}"; else echo "${AWS_FAKE_STATE:-stopped}"; fi;;
  *) echo "UNEXPECTED $*" >&2; exit 99;;
esac
''')
    aws.chmod(0o755)
    env = dict(os.environ, PATH=str(tmp_path) + os.pathsep + os.environ['PATH'], AWS_STUB_EVENTS=str(events))
    cases = [
        (BUDGET, 'n\n', {}, 'TEST GPU MEMORY OVERCOMMIT'),
        (BUDGET, 'TEST GPU MEMORY OVERCOMMIT\n', {'AWS_FAKE_TYPE': 'g4dn.xlarge'}, 'requires a stopped g6f.large'),
        (BUDGET, 'TEST GPU MEMORY OVERCOMMIT\n', {'AWS_FAKE_STATE': 'running'}, 'requires a stopped g6f.large'),
        (PILOT, 'TEST GPU MEMORY OVERCOMMIT\n', {}, 'budget g6f.large only'),
    ]
    for script, answer, overrides, expected in cases:
        proc = subprocess.run(['bash', str(script), 'memory-repair'], input=answer, env={**env, **overrides}, capture_output=True, text=True)
        assert proc.returncode != 0
        assert expected in proc.stdout + proc.stderr
    assert 'start-instances' not in events.read_text()
    assert 's3 cp' not in events.read_text()
