from __future__ import annotations

from http.cookies import SimpleCookie

from app.auth.models import User
from app.auth.service import auth_service
from app.auth.sessions import SESSION_COOKIE_NAME


# =========================================================
# SOCKET AUTH MANAGER
# =========================================================

class SocketAuthManager:

    def __init__(
        self,
    ) -> None:

        self._users_by_sid: dict[
            str,
            User,
        ] = {}

    # -----------------------------------------------------
    # COOKIE EXTRACTION
    # -----------------------------------------------------

    @staticmethod
    def _extract_cookie_header(
        environ: dict,
    ) -> str | None:

        
        #python-socketio may expose the cookie through the
        #traditional WSGI-style environment or the underlying
        #ASGI scope.
        ##
        #We support both forms.

        cookie_header = environ.get(
            "HTTP_COOKIE"
        )

        if cookie_header:

            return str(
                cookie_header
            )


        scope = environ.get(
            "asgi.scope"
        )

        if not isinstance(
            scope,
            dict,
        ):

            return None


        headers = scope.get(
            "headers",
            []
        )


        for (
            raw_name,
            raw_value,
        ) in headers:

            try:

                name = raw_name.decode(
                    "latin-1"
                )

            except AttributeError:

                name = str(
                    raw_name
                )


            if name.lower() != "cookie":

                continue


            try:

                return raw_value.decode(
                    "latin-1"
                )

            except AttributeError:

                return str(
                    raw_value
                )


        return None

    # -----------------------------------------------------
    # SESSION TOKEN EXTRACTION
    # -----------------------------------------------------

    def extract_session_token(
        self,
        environ: dict,
    ) -> str | None:

        cookie_header = (
            self._extract_cookie_header(
                environ
            )
        )


        if not cookie_header:

            return None


        cookie = SimpleCookie()


        try:

            cookie.load(
                cookie_header
            )

        except Exception:

            return None


        morsel = cookie.get(
            SESSION_COOKIE_NAME
        )


        if morsel is None:

            return None


        token = str(
            morsel.value
        ).strip()


        return (
            token
            if token
            else None
        )

    # -----------------------------------------------------
    # AUTHENTICATE SOCKET
    # -----------------------------------------------------

    async def authenticate(
        self,
        sid: str,
        environ: dict,
    ) -> User | None:

        token = (
            self.extract_session_token(
                environ
            )
        )


        if not token:

            return None


        user = (
            await auth_service.authenticate_session(
                token
            )
        )


        if user is None:

            return None


        self._users_by_sid[
            sid
        ] = user


        return user

    # -----------------------------------------------------
    # LOOKUPS
    # -----------------------------------------------------

    def get_user(
        self,
        sid: str,
    ) -> User | None:

        return self._users_by_sid.get(
            sid
        )

    def get_user_id(
        self,
        sid: str,
    ) -> str | None:

        user = self.get_user(
            sid
        )


        if user is None:

            return None


        return user.user_id

    # -----------------------------------------------------
    # REMOVE SOCKET
    # -----------------------------------------------------

    def disconnect(
        self,
        sid: str,
    ) -> None:

        self._users_by_sid.pop(
            sid,
            None,
        )

    # -----------------------------------------------------
    # RESET
    # -----------------------------------------------------

    def clear(
        self,
    ) -> None:

        self._users_by_sid.clear()


socket_auth = SocketAuthManager()