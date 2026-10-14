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

MAX_MONTHLY_SECONDS = int(os.getenv("KOKORO_MAX_MONTHLY_SECONDS", "216000"))


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


# Room leases are per authenticated listener, not per browser tab. Every lease
# expires without relying on DynamoDB TTL's asynchronous deletion.
ROOM_LEASE_SECONDS = 300


def _room_key(room_code: str, user_id: str) -> str:
    import hashlib
    digest = hashlib.sha256(f"{room_code.upper()}\0{user_id}".encode()).hexdigest()
    return "room#" + digest


def lease_room(room_code: str, user_id: str, *, enabled: bool = True) -> dict:
    """Only call after the route verifies the user's live room membership.

    Write the lease BEFORE waking EC2 so the watchdog sees the listener while
    the instance starts. A disabled listener removes only their own lease.
    """
    if not configured():
        return {"state": "unconfigured"}
    _, table = _clients()
    key = {"id": _room_key(room_code, user_id)}
    if not enabled:
        table.delete_item(Key=key)
        return {"state": "disabled"}
    now = int(time.time())
    # Inspect the monthly budget before establishing a new opt-in lease.
    # A previously running room may renew beyond quota; new rooms cannot.
    existing = table.get_item(Key=key, ConsistentRead=True).get("Item", {})
    eligible = int(existing.get("expires_at_epoch", 0)) > now
    state = touch(wake=False)
    if state.get("state") == "budget_exhausted" and eligible:
        # Do not start new compute beyond the budget, but an already running
        # room must be allowed to finish its adventure without interruption.
        ec2 = _clients()[0]
        instance = ec2.describe_instances(InstanceIds=[os.environ["KOKORO_INSTANCE_ID"]])["Reservations"][0]["Instances"][0]
        if instance["State"]["Name"] != "running":
            return state
        state = {"state": "running_budget_grace"}
    elif state.get("state") in {"budget_exhausted", "unavailable", "unconfigured"}:
        return state
    # Establish the durable lease BEFORE StartInstances is requested.
    table.put_item(Item={"id": key["id"], "expires_at_epoch": now + ROOM_LEASE_SECONDS})
    if state.get("state") == "stopped":
        state = touch(wake=True)
    table.update_item(Key={"id": "narrator"},
                      UpdateExpression="SET last_room_request_epoch=:now, last_request_epoch=:now",
                      ExpressionAttributeValues={":now": now})
    return state


def has_live_room(room_code: str) -> bool:
    """Conservative opt-in check before allocating expensive background TTS.

    Hash room membership in stored rows; no room names, prose or user IDs are
    written to DynamoDB. Per-room keyed lookups avoid full-table scans.
    """
    if not configured():
        return False
    # The backend's room registry is authoritative for which members to check.
    from app import main
    room = main.rooms.room_by_code(room_code)
    if room is None:
        return False
    table = _clients()[1]
    now = int(time.time())
    for member in room.players.values():
        if not member.is_online:
            continue
        row = table.get_item(Key={"id": _room_key(room_code, str(member.user_id))},
                             ConsistentRead=True).get("Item", {})
        if int(row.get("expires_at_epoch", 0)) > now:
            return True
    return False
