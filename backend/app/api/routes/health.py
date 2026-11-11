from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.database import check_database

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/ready")
def ready() -> JSONResponse:
    try:
        check_database()
    except Exception:  # noqa: BLE001 - readiness must never raise
        return JSONResponse({"status": "degraded", "database": "unavailable"}, status_code=503)
    return JSONResponse({"status": "ok", "database": "ok"})
