"""Small on-demand EC2 adapter. Never called from game/dice/Director flows.

AWS clients are created lazily; local development needs no AWS credentials.
All blocking SDK calls are invoked through asyncio.to_thread by routes.
"""
from __future__ import annotations

import os
import time
import uuid
from datetime import datetime, timezone
from urllib.request import urlopen

MAX_MONTHLY_SECONDS = 60 * 60 * 60


def configured() -> bool:
    return all(os.getenv(key, "").strip() for key in (
        "KOKORO_BASE_URL", "KOKORO_INSTANCE_ID", "KOKORO_ACTIVITY_TABLE"))


def _clients():
    import boto3  # Optional outside AWS; requirements installs it for Fargate.
    return boto3.client("ec2"), boto3.resource("dynamodb").Table(os.environ["KOKORO_ACTIVITY_TABLE"])


def month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def touch(*, wake: bool) -> dict:
    """Record a recent opted-in listener and optionally start the shared instance.

    This is best-effort, and only called by the narration routes. Nothing in
    gameplay depends on the response. The watchdog owns the stop decision.
    """
    if not configured():
        return {"state": "unconfigured"}
    ec2, table = _clients()
    row = table.get_item(Key={"id": "narrator"}, ConsistentRead=True).get("Item", {})
    if row.get("disabled") is True or (row.get("month") == month() and
       int(row.get("used_seconds", 0)) >= MAX_MONTHLY_SECONDS):
        return {"state": "budget_exhausted"}
    instance_id = os.environ["KOKORO_INSTANCE_ID"]
    instance = ec2.describe_instances(InstanceIds=[instance_id])["Reservations"][0]["Instances"][0]
    state = instance["State"]["Name"]
    if state in {"shutting-down", "terminated"}:
        return {"state": "unavailable"}
    table.update_item(Key={"id": "narrator"},
        UpdateExpression="SET last_request_epoch=:now",
        ExpressionAttributeValues={":now": int(time.time())})
    if wake and state == "stopped":
        try:
            ec2.start_instances(InstanceIds=[instance_id])
        except Exception as exc:
            # Simultaneous requests to wake the same stopped instance may race.
            code = getattr(exc, "response", {}).get("Error", {}).get("Code")
            if code not in {"IncorrectInstanceState"}:
                raise
        state = "pending"
    return {"state": state}


def healthy(endpoint: str) -> bool:
    try:
        base = endpoint.split("/v1/audio/speech", 1)[0]
        with urlopen(base + "/v1/audio/voices", timeout=1.8) as response:
            return response.status == 200
    except (OSError, ValueError):
        return False


# A live synthesis request must outlive the idle watchdog's last-request clock.
# _read_kokoro has a 90s HTTP timeout; this 180s lease also covers SDK setup.
GENERATION_LEASE_SECONDS = 180


def begin_generation() -> str | None:
    """Register an expiring, unique job lease before contacting Kokoro.

    A failed lease acquisition should prevent an optional voice request rather
    than risk the watchdog stopping EC2 in the middle of synthesis.
    """
    if not configured():
        return None
    import boto3
    job_id = "generation#" + uuid.uuid4().hex
    boto3.resource("dynamodb").Table(os.environ["KOKORO_ACTIVITY_TABLE"]).put_item(
        Item={"id": job_id, "expires_at_epoch": int(time.time()) + GENERATION_LEASE_SECONDS})
    return job_id


def finish_generation(job_id: str | None) -> None:
    """Release the completed job. An abandoned job auto-expires."""
    if not job_id or not configured():
        return
    try:
        import boto3
        boto3.resource("dynamodb").Table(os.environ["KOKORO_ACTIVITY_TABLE"]).delete_item(
            Key={"id": job_id})
    except Exception:
        # Lease is bounded and will expire; never invalidate generated audio.
        pass


def renew_generation(job_id: str | None) -> None:
    """Keep a long-running speech request leased while inference is active."""
    if not job_id or not configured():
        return
    import boto3
    boto3.resource("dynamodb").Table(os.environ["KOKORO_ACTIVITY_TABLE"]).update_item(
        Key={"id": job_id},
        UpdateExpression="SET expires_at_epoch = :expires",
        ConditionExpression="attribute_exists(id)",
        ExpressionAttributeValues={":expires": int(time.time()) + GENERATION_LEASE_SECONDS})
