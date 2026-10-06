from __future__ import annotations

from fastapi import APIRouter, Cookie, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.auth.sessions import SESSION_COOKIE_NAME
from app.auth.service import auth_service
from app.notifications.service import notification_service


router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class PreferencesRequest(BaseModel):
    push_enabled: bool = False
    email_enabled: bool = False
    sms_enabled: bool = False
    room_invite: bool = True
    partner_joined: bool = True
    partner_locked: bool = True
    results_ready: bool = False


class PushSubscriptionKeys(BaseModel):
    p256dh: str = Field(min_length=1, max_length=1000)
    auth: str = Field(min_length=1, max_length=1000)


class PushSubscriptionRequest(BaseModel):
    endpoint: str = Field(min_length=1, max_length=4000)
    keys: PushSubscriptionKeys


class PushUnsubscribeRequest(BaseModel):
    endpoint: str = Field(min_length=1, max_length=4000)


class PhoneRequest(BaseModel):
    phone_number: str = Field(min_length=8, max_length=32)


class PhoneVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


async def require_user(
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    user = await auth_service.authenticate_session(session_token)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    return user


@router.get("/settings")
async def get_settings(
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    user = await require_user(session_token)
    preferences = await notification_service.preferences_for(user.user_id)
    channels = await notification_service.channel_status()
    return {
        "preferences": preferences.public_data(),
        "channels": {
            "push_available": channels["push_available"],
            "email_available": channels["email_available"],
            "sms_available": channels["sms_available"],
            "email_address": user.email,
        },
    }


@router.put("/settings")
async def update_settings(
    payload: PreferencesRequest,
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    user = await require_user(session_token)
    preferences = await notification_service.save_preferences(
        user.user_id,
        **payload.model_dump(),
    )
    channels = await notification_service.channel_status()
    return {
        "preferences": preferences.public_data(),
        "channels": {
            "push_available": channels["push_available"],
            "email_available": channels["email_available"],
            "sms_available": channels["sms_available"],
            "email_address": user.email,
        },
    }


@router.get("/vapid-public-key")
async def vapid_public_key(
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    await require_user(session_token)
    channels = await notification_service.channel_status()
    if not channels["vapid_public_key"]:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Web Push is not available.")
    return {"public_key": channels["vapid_public_key"]}


@router.post("/push-subscriptions")
async def subscribe_push(
    payload: PushSubscriptionRequest,
    request: Request,
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    user = await require_user(session_token)
    try:
        preferences = await notification_service.register_push_subscription(
            user_id=user.user_id,
            endpoint=payload.endpoint,
            p256dh=payload.keys.p256dh,
            auth=payload.keys.auth,
            user_agent=request.headers.get("user-agent", ""),
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    return {"preferences": preferences.public_data()}


@router.delete("/push-subscriptions")
async def unsubscribe_push(
    payload: PushUnsubscribeRequest,
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    user = await require_user(session_token)
    await notification_service.unregister_push_subscription(user.user_id, payload.endpoint)
    return {"ok": True}


@router.post("/phone/request-code")
async def request_phone_code(
    payload: PhoneRequest,
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    user = await require_user(session_token)
    try:
        await notification_service.request_phone_verification(user.user_id, payload.phone_number)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    return {"message": "Verification code sent."}


@router.post("/phone/verify")
async def verify_phone_code(
    payload: PhoneVerifyRequest,
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    user = await require_user(session_token)
    try:
        preferences = await notification_service.verify_phone(user.user_id, payload.code)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    return {"preferences": preferences.public_data()}
