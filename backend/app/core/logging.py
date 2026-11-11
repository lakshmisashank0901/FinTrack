import logging
import re
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("fintrack.access")
_SAFE_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,64}")


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=level.upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


class AccessLogMiddleware(BaseHTTPMiddleware):
    """Logs method, route path, status and latency only.

    Query strings, bodies and headers are deliberately never logged: they can
    contain financial details, search terms and tokens.
    """

    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        # Client-supplied IDs are echoed and logged: accept only short, safe values.
        supplied = request.headers.get("x-request-id", "")
        request_id = supplied if _SAFE_REQUEST_ID.fullmatch(supplied) else uuid.uuid4().hex[:16]
        start = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            response.headers["x-request-id"] = request_id
            return response
        finally:
            logger.info(
                "request_id=%s method=%s path=%s status=%s duration_ms=%.1f",
                request_id, request.method, request.url.path, status,
                (time.perf_counter() - start) * 1000,
            )
