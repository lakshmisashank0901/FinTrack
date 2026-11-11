"""Request body size limits (protects the API from memory-exhaustion uploads)."""
import json

from starlette.types import ASGIApp, Message, Receive, Scope, Send

DEFAULT_MAX_BODY = 1 * 1024 * 1024  # 1 MiB for ordinary JSON requests
# Backup restores may carry up to 100k transactions + 100k contributions.
LARGE_BODY_PATHS = {"/api/data/restore": 64 * 1024 * 1024}


class BodyTooLarge(Exception):
    pass


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        limit = LARGE_BODY_PATHS.get(scope["path"].rstrip("/"), DEFAULT_MAX_BODY)

        for name, value in scope.get("headers", []):
            if name == b"content-length":
                try:
                    if int(value) > limit:
                        await _reject(send)
                        return
                except ValueError:
                    pass

        received = 0
        response_started = False

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise BodyTooLarge
            return message

        async def tracking_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracking_send)
        except* BodyTooLarge:  # may arrive wrapped in an ExceptionGroup by BaseHTTPMiddleware task groups
            if not response_started:
                await _reject(send)


async def _reject(send: Send) -> None:
    body = json.dumps({"error": {"code": "payload_too_large", "message": "Request body is too large."}}).encode()
    await send({"type": "http.response.start", "status": 413,
                "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
    await send({"type": "http.response.body", "body": body})
