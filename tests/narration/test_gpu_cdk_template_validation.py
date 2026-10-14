"""Offline checks for the dedicated G6f Launch Template synthesized-template guard."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import pytest
from tests.support import PROJECT_ROOT

SCRIPT = PROJECT_ROOT / 'scripts/aws/verify-gpu-cdk-template.py'


def run_template(tmp_path, template):
    path = tmp_path / 'gpu.template.json'
    path.write_text(json.dumps(template))
    return subprocess.run([sys.executable, str(SCRIPT), str(path)], text=True, capture_output=True)


def tmpl(name=None, gpu='g6f.large'):
    props = {'LaunchTemplateData': {'InstanceType': gpu}}
    if name is not None:
        props['LaunchTemplateName'] = name
    return {'Resources': {'GPU': {'Type': 'AWS::EC2::LaunchTemplate', 'Properties': props}}}


def test_accept_unique_cloudformation_generated_gpu_launch_template(tmp_path):
    result = run_template(tmp_path, tmpl())
    assert result.returncode == 0, result.stderr
    assert 'PASS:' in result.stdout


def test_reject_fixed_name_collision(tmp_path):
    result = run_template(tmp_path, tmpl('tot-story-time-gpu'))
    assert result.returncode == 1
    assert 'LaunchTemplateName' in result.stderr


def test_reject_missing_or_extra_launch_templates(tmp_path):
    assert run_template(tmp_path, {'Resources': {}}).returncode == 1
    with_two = tmpl()
    with_two['Resources']['OTHER'] = with_two['Resources']['GPU'].copy()
    assert run_template(tmp_path, with_two).returncode == 1


def test_accept_instance_type_in_ec2_instance_resource(tmp_path):
    cf = tmpl(gpu=None)
    cf['Resources']['INSTANCE'] = {'Type': 'AWS::EC2::Instance', 'Properties': {'InstanceType': 'g6f.large'}}
    assert run_template(tmp_path, cf).returncode == 0


def test_reject_non_gpu_instance_and_malformed_template(tmp_path):
    assert run_template(tmp_path, tmpl(gpu='t3.medium')).returncode == 1
    path = tmp_path / 'broken.json'
    path.write_text('not json')
    proc = subprocess.run([sys.executable, str(SCRIPT), str(path)], text=True, capture_output=True)
    assert proc.returncode == 1
