"""Pass 61C.6: offline regression for producer-before-consumer CDK deployment.

These tests do not call AWS or CDK.
"""
from pathlib import Path
import subprocess
from tests.support import PROJECT_ROOT

SCRIPT = PROJECT_ROOT / 'scripts/aws/story-time-gpu-service.sh'


def test_shell_syntax():
    subprocess.run(['bash', '-n', str(SCRIPT)], check=True)


def test_cdkaction_producer_deploys_before_backend():
    script = SCRIPT.read_text()
    action = script.split('cdk_action() {', 1)[1].split('\ncase "$ACTION" in', 1)[0]
    producer_diff = 'npx cdk diff "$target_stack" --exclusively'
    producer_deploy = 'npx cdk deploy "$target_stack" --exclusively'
    backend_diff = 'npx cdk diff "$BACKEND_STACK" --exclusively'
    backend_deploy = 'npx cdk deploy "$BACKEND_STACK" --exclusively'
    assert all(x in action for x in (producer_diff, producer_deploy, backend_diff, backend_deploy))
    assert action.index(producer_diff) < action.index(producer_deploy)
    assert action.index(producer_deploy) < action.index(backend_diff)
    assert action.index(backend_diff) < action.index(backend_deploy)


def test_selected_narrator_is_export_producer():
    action = SCRIPT.read_text().split('cdk_action() {', 1)[1].split('\ncase "$ACTION" in', 1)[0]
    assert 'export TOT_STORY_TIME_GPU_CUTOVER="$selected"' in action
    assert 'target_stack="$GPU_STACK"' in action
    assert 'target_stack="$CPU_STACK"' in action
    assert "publish_confirmation='PUBLISH GPU NARRATOR EXPORTS'" in action
    assert "publish_confirmation='PUBLISH CPU NARRATOR EXPORTS'" in action


def test_backend_deploy_is_fail_closed_on_producer_failure():
    action = SCRIPT.read_text().split('cdk_action() {', 1)[1].split('\ncase "$ACTION" in', 1)[0]
    assert 'set -euo pipefail' in SCRIPT.read_text()
    assert 'ask "$publish_confirmation"' in action
    assert 'ask "$switch_confirmation"' in action
    assert action.index('ask "$publish_confirmation"') < action.index('npx cdk deploy "$target_stack"')
    assert action.index('ask "$switch_confirmation"') < action.index('npx cdk deploy "$BACKEND_STACK"')
    # No `|| true`, conditional swallowing, or CDK dependency auto-deployment.
    assert '|| true' not in action


def test_no_delete_recreate_in_cutover_action():
    action = SCRIPT.read_text().split('cdk_action() {', 1)[1].split('\ncase "$ACTION" in', 1)[0]
    assert 'delete-stack' not in action
    assert 'terminate-instances' not in action
    assert 'start-instances' not in action
