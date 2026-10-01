from __future__ import annotations

from abc import ABC, abstractmethod

from app.auth.models import StoredUser


# =========================================================
# AUTH ERRORS
# =========================================================

class AuthError(Exception):
    pass


class RegistrationError(AuthError):
    pass


class InvalidCredentialsError(AuthError):
    pass


class InactiveUserError(AuthError):
    pass


# =========================================================
# AUTH PROVIDER INTERFACE
# =========================================================

class AuthProvider(ABC):

    """
    Authentication provider contract.

    The rest of the application talks to this interface,
    not directly to a specific credential system.

    Today:
        LocalAuthProvider

    Later:
        CognitoAuthProvider
    """

    provider_name: str

    @abstractmethod
    async def register(
        self,
        email: str,
        username: str,
        password: str,
    ) -> StoredUser:

        raise NotImplementedError

    @abstractmethod
    async def authenticate(
        self,
        identifier: str,
        password: str,
    ) -> StoredUser:

        raise NotImplementedError