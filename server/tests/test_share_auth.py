"""Share-auth middleware (optional env-gated demo protection)."""

import base64
import importlib

from starlette.requests import Request
from starlette.responses import Response


async def _noop(request: Request):
    return Response("ok")


def test_share_auth_disabled_by_default(monkeypatch):
    monkeypatch.delenv("SHARE_USER", raising=False)
    monkeypatch.delenv("SHARE_PASSWORD", raising=False)
    import share_auth

    importlib.reload(share_auth)
    assert share_auth.share_auth_enabled() is False


def test_share_auth_blocks_without_credentials(monkeypatch):
    monkeypatch.setenv("SHARE_USER", "demo")
    monkeypatch.setenv("SHARE_PASSWORD", "secret")
    import share_auth

    importlib.reload(share_auth)
    mw = share_auth.ShareAuthMiddleware(app=None)
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [],
        "query_string": b"",
        "client": ("testclient", 50000),
        "server": ("testserver", 80),
        "scheme": "http",
        "root_path": "",
    }
    request = Request(scope)

    async def run():
        return await mw.dispatch(request, _noop)

    import asyncio

    resp = asyncio.run(run())
    assert resp.status_code == 401


def test_share_auth_allows_valid_basic(monkeypatch):
    monkeypatch.setenv("SHARE_USER", "demo")
    monkeypatch.setenv("SHARE_PASSWORD", "secret")
    import share_auth

    importlib.reload(share_auth)
    token = base64.b64encode(b"demo:secret").decode("ascii")
    mw = share_auth.ShareAuthMiddleware(app=None)
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/v2/",
        "headers": [(b"authorization", f"Basic {token}".encode())],
        "query_string": b"",
        "client": ("testclient", 50000),
        "server": ("testserver", 80),
        "scheme": "http",
        "root_path": "",
    }
    request = Request(scope)

    async def run():
        return await mw.dispatch(request, _noop)

    import asyncio

    resp = asyncio.run(run())
    assert resp.status_code == 200
