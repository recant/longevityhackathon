"""Optional HTTP Basic Auth for private demo links (set SHARE_USER + SHARE_PASSWORD)."""

from __future__ import annotations

import base64
import os
from secrets import compare_digest

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

SHARE_USER = os.getenv("SHARE_USER", "").strip()
SHARE_PASSWORD = os.getenv("SHARE_PASSWORD", "").strip()
SHARE_REALM = os.getenv("SHARE_REALM", "Longevitree demo").strip() or "Longevitree demo"

# Health checks and CORS preflight should not require a password.
_PUBLIC_PATHS = frozenset({"/api/health"})


def share_auth_enabled() -> bool:
    return bool(SHARE_USER and SHARE_PASSWORD)


class ShareAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not share_auth_enabled():
            return await call_next(request)
        if request.method == "OPTIONS" or request.url.path in _PUBLIC_PATHS:
            return await call_next(request)
        if _check_basic(request):
            return await call_next(request)
        return Response(
            status_code=401,
            headers={"WWW-Authenticate": f'Basic realm="{SHARE_REALM}"'},
            content="This demo is password-protected. Use the username and password you were given.",
            media_type="text/plain",
        )


def _check_basic(request: Request) -> bool:
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Basic "):
        return False
    try:
        raw = base64.b64decode(auth[6:].encode("ascii"), validate=True).decode("utf-8")
    except (ValueError, UnicodeDecodeError):
        return False
    user, sep, password = raw.partition(":")
    if not sep:
        return False
    return compare_digest(user, SHARE_USER) and compare_digest(password, SHARE_PASSWORD)
