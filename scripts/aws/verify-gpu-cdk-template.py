#!/usr/bin/env python3
"""Fail closed if the isolated GPU CDK synth would reuse an EC2 Launch Template name.

Usage: python3 scripts/aws/verify-gpu-cdk-template.py path/to/AdventurePlatformNarratorGpu-staging.template.json
No AWS calls or mutations. Run as part of story-time-gpu-service.sh provision.
"""
import json
import sys
from pathlib import Path


def validate(template: dict) -> None:
    resources = template.get("Resources")
    if not isinstance(resources, dict):
        raise ValueError("Synth has no Resources mapping")
    templates = [
        (key, resource) for key, resource in resources.items()
        if isinstance(resource, dict) and resource.get("Type") == "AWS::EC2::LaunchTemplate"
    ]
    if len(templates) != 1:
        raise ValueError(f"Expected exactly one GPU EC2 Launch Template, found {len(templates)}")
    _, resource = templates[0]
    props = resource.get("Properties", {})
    if not isinstance(props, dict):
        raise ValueError("Launch Template properties are invalid")
    if "LaunchTemplateName" in props:
        raise ValueError("LaunchTemplateName is explicitly set; can collide with existing AWS templates")
    data = props.get("LaunchTemplateData")
    if not isinstance(data, dict):
        raise ValueError("GPU Launch Template lacks LaunchTemplateData")
    # CDK Instance may configure InstanceType on its AWS::EC2::Instance rather
    # than the associated Launch Template; check both locations.
    instance_types = [data.get("InstanceType")]
    instance_types.extend(
        item.get("Properties", {}).get("InstanceType")
        for item in resources.values()
        if isinstance(item, dict) and item.get("Type") == "AWS::EC2::Instance"
        and isinstance(item.get("Properties", {}), dict)
    )
    if "g6f.large" not in instance_types:
        raise ValueError("Synth does not contain g6f.large GPU instance type")


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("Usage: verify-gpu-cdk-template.py <GPU CloudFormation template.json>", file=sys.stderr)
        return 2
    try:
        template = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
        validate(template)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"FAIL: GPU CDK template: {exc}", file=sys.stderr)
        return 1
    print("PASS: GPU synth contains one g6f.large Launch Template with CloudFormation-generated name")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
