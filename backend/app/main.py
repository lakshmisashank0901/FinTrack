import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from psycopg import errors as pg_errors
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.routes import (
    accounts,
    analytics,
    budgets,
    categories,
    data,
    health,
    profile,
    recurring,
    savings,
    transactions,
)
from app.core.config import get_settings
from app.core.database import close_pool, open_pool
from app.core.errors import AppError
from app.core.limits import BodySizeLimitMiddleware
from app.core.logging import AccessLogMiddleware, configure_logging

logger = logging.getLogger("fintrack")


def _error(status: int, code: str, message: str, details: list | None = None,
           headers: dict[str, str] | None = None) -> JSONResponse:
    body: dict = {"error": {"code": code, "message": message}}
    if details:
        body["error"]["details"] = details
    return JSONResponse(body, status_code=status, headers=headers)


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        open_pool(settings)
        yield
        close_pool()

    app = FastAPI(
        title="FinTrack API",
        description="Track smarter. Spend better. Save more. — Personal finance REST API. "
                    "All amounts are integers in paise.",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.enable_docs else None,
        redoc_url="/redoc" if settings.enable_docs else None,
        openapi_url="/openapi.json" if settings.enable_docs else None,
    )

    app.add_middleware(AccessLogMiddleware)
    app.add_middleware(BodySizeLimitMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,  # bearer tokens, not cookies
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-Id"],
        expose_headers=["Content-Disposition", "X-Request-Id"],
        max_age=600,
    )

    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError) -> JSONResponse:
        headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
        return _error(exc.status_code, exc.code, exc.message, exc.details, headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [{"loc": list(e.get("loc", [])), "msg": e.get("msg", "invalid")} for e in exc.errors()[:50]]
        return _error(422, "validation_error", "Some fields are invalid.", details)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        codes = {401: "unauthorized", 403: "forbidden", 404: "not_found", 405: "method_not_allowed"}
        return _error(exc.status_code, codes.get(exc.status_code, "error"), str(exc.detail))

    @app.exception_handler(pg_errors.UniqueViolation)
    async def unique_violation(_: Request, exc: pg_errors.UniqueViolation) -> JSONResponse:
        return _error(409, "conflict", "A record with these details already exists.")

    @app.exception_handler(pg_errors.ForeignKeyViolation)
    async def fk_violation(_: Request, exc: pg_errors.ForeignKeyViolation) -> JSONResponse:
        return _error(409, "reference_conflict", "This record is referenced by, or references, another record.")

    @app.exception_handler(pg_errors.CheckViolation)
    async def check_violation(_: Request, exc: pg_errors.CheckViolation) -> JSONResponse:
        return _error(422, "constraint_violation", "The data violates a validation rule.")

    @app.exception_handler(pg_errors.InsufficientPrivilege)
    async def forbidden(_: Request, exc: pg_errors.InsufficientPrivilege) -> JSONResponse:
        logger.warning("database privilege violation")
        return _error(403, "forbidden", "You do not have access to this resource.")

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception) -> JSONResponse:
        # Log the exception type only: messages may contain financial values.
        logger.error("unhandled error: %s", type(exc).__name__,
                     exc_info=settings.environment == "development")
        return _error(500, "internal_error", "Something went wrong. Please try again.")

    api = APIRouter(prefix="/api")
    for module in (profile, accounts, categories, transactions, budgets, savings, recurring, analytics, data):
        api.include_router(module.router)
    app.include_router(health.router)
    app.include_router(api)
    return app


app = create_app()
