"""Idempotent, scheduled EC2 idle/usage watchdog. DynamoDB is durable across tasks.

Runtime is an approximate 5-minute sampled quota, NOT a financial billing cap.
Do not trigger costs on behalf of visitors who never explicitly enabled Story Time.
"""
import os
import time
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

INSTANCE_ID = os.getenv("INSTANCE_ID", "")
TABLE_NAME = os.getenv("TABLE_NAME", "")
IDLE = int(os.getenv("IDLE_SECONDS", "1800"))
LIMIT = int(os.getenv("MAX_MONTHLY_SECONDS", "216000"))


def month_of(timestamp):
    return datetime.fromtimestamp(timestamp, timezone.utc).strftime("%Y-%m")


def reconcile(row, now, running):
    """Pure accounting; run time since last probe is charged only when running."""
    month = month_of(now)
    previous_month = str(row.get("month", ""))
    used = int(row.get("used_seconds", 0)) if previous_month == month else 0
    last_probe = int(row.get("last_probe_epoch", now))
    if running and previous_month == month and 0 < now - last_probe < 900:
        used += now - last_probe
    last_request = int(row.get("last_request_epoch", 0))
    should_stop = running and (used >= LIMIT or (now - last_request >= IDLE))
    return {"month": month, "used_seconds": used,
            "last_probe_epoch": now, "should_stop": should_stop,
            "idle": now - last_request >= IDLE, "quota_exhausted": used >= LIMIT}


def handler(event, context):
    now = int(time.time())
    ec2 = boto3.client("ec2")
    table = boto3.resource("dynamodb").Table(TABLE_NAME)
    row = table.get_item(Key={"id": "narrator"}, ConsistentRead=True).get("Item", {})
    instance = ec2.describe_instances(InstanceIds=[INSTANCE_ID])["Reservations"][0]["Instances"][0]
    state = instance["State"]["Name"]
    launch_epoch = int(instance["LaunchTime"].timestamp())
    result = reconcile(row, now, state == "running")
    table.update_item(Key={"id": "narrator"}, UpdateExpression="SET #m=:m, used_seconds=:u, last_probe_epoch=:n",
        ExpressionAttributeNames={"#m": "month"},
        ExpressionAttributeValues={":m": result["month"], ":u": result["used_seconds"], ":n": now})
    # Re-read lease before stopping, since backend may have acquired it during probe.
    # First startup may need several minutes to pull the image. Let it finish;
    # the operator still needs to stop the instance after verification.
    if result["should_stop"] and state == "running" and now - launch_epoch >= 1200:
        latest = table.get_item(Key={"id": "narrator"}, ConsistentRead=True).get("Item", {})
        if result["quota_exhausted"] or now - int(latest.get("last_request_epoch", 0)) >= IDLE:
            try:
                ec2.stop_instances(InstanceIds=[INSTANCE_ID])
                return {"status": "stopping", "reason": "quota" if result["quota_exhausted"] else "idle",
                        "used_seconds": result["used_seconds"]}
            except ClientError as exc:
                if exc.response.get("Error", {}).get("Code") not in {"IncorrectInstanceState", "InvalidInstanceID.NotFound"}:
                    raise
    return {"status": state, "used_seconds": result["used_seconds"]}
