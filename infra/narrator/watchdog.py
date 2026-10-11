"""Scheduled Story Time EC2 watchdog, with durable inference and maintenance leases.

DynamoDB is the coordination point for the existing Fargate backend and the
watchdog. This is an approximate runtime quota, not a hard AWS billing ceiling.
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


def reconcile(row, now, running, *, generation_active=False):
    """Pure decision: never interrupt an active generation for idle or quota.

    A maintenance hold prevents IDLE stops only; it cannot override the quota.
    Expiring leases protect against forgotten/stale operator sessions and jobs.
    """
    month = month_of(now)
    previous_month = str(row.get("month", ""))
    used = int(row.get("used_seconds", 0)) if previous_month == month else 0
    last_probe = int(row.get("last_probe_epoch", now))
    if running and previous_month == month and 0 < now - last_probe < 900:
        used += now - last_probe
    last_request = int(row.get("last_request_epoch", 0))
    idle = now - last_request >= IDLE
    quota = used >= LIMIT
    maintenance = int(row.get("manual_lease_until_epoch", 0)) > now
    should_stop = running and not generation_active and (quota or (idle and not maintenance))
    return {"month": month, "used_seconds": used,
            "last_probe_epoch": now, "should_stop": should_stop,
            "idle": idle, "quota_exhausted": quota,
            "maintenance_active": maintenance, "generation_active": generation_active}


def active_generation(table, now):
    """Check the durable job leases; a dead worker's lease expires naturally.

    A scan is sufficient for the private beta's tiny activity table. Paginate
    to avoid missing jobs if its contents later grow beyond a single page.
    """
    params = {
        "ConsistentRead": True,
        "FilterExpression": "begins_with(#i, :p) AND expires_at_epoch > :n",
        "ExpressionAttributeNames": {"#i": "id"},
        "ExpressionAttributeValues": {":p": "generation#", ":n": now},
        "ProjectionExpression": "#i",
    }
    while True:
        page = table.scan(**params)
        if page.get("Items"):
            return True
        next_key = page.get("LastEvaluatedKey")
        if not next_key:
            return False
        params["ExclusiveStartKey"] = next_key


def handler(event, context):
    now = int(time.time())
    ec2 = boto3.client("ec2")
    table = boto3.resource("dynamodb").Table(TABLE_NAME)
    row = table.get_item(Key={"id": "narrator"}, ConsistentRead=True).get("Item", {})
    instance = ec2.describe_instances(InstanceIds=[INSTANCE_ID])["Reservations"][0]["Instances"][0]
    state = instance["State"]["Name"]
    launch_epoch = int(instance["LaunchTime"].timestamp())
    live_job = active_generation(table, now) if state == "running" else False
    result = reconcile(row, now, state == "running", generation_active=live_job)
    table.update_item(Key={"id": "narrator"}, UpdateExpression="SET #m=:m, used_seconds=:u, last_probe_epoch=:n",
        ExpressionAttributeNames={"#m": "month"},
        ExpressionAttributeValues={":m": result["month"], ":u": result["used_seconds"], ":n": now})
    # The initial image pull can take time. A running request or manual hold
    # prevents automatic idle stop. Re-check everything before issuing Stop.
    if result["should_stop"] and state == "running" and now - launch_epoch >= 1200:
        check_at = int(time.time())
        latest = table.get_item(Key={"id": "narrator"}, ConsistentRead=True).get("Item", {})
        still_idle = check_at - int(latest.get("last_request_epoch", 0)) >= IDLE
        manual_active = int(latest.get("manual_lease_until_epoch", 0)) > check_at
        job_active = active_generation(table, check_at)
        if not job_active and (result["quota_exhausted"] or (still_idle and not manual_active)):
            try:
                ec2.stop_instances(InstanceIds=[INSTANCE_ID])
                return {"status": "stopping", "reason": "quota" if result["quota_exhausted"] else "idle",
                        "used_seconds": result["used_seconds"]}
            except ClientError as exc:
                if exc.response.get("Error", {}).get("Code") not in {"IncorrectInstanceState", "InvalidInstanceID.NotFound"}:
                    raise
    return {"status": state, "used_seconds": result["used_seconds"],
            "generation_active": live_job, "maintenance_active": result["maintenance_active"]}
