"""Central exception-handler registration.

Every error response — an `AppError` raised by our own code, FastAPI's own `HTTPException`, a
request validation failure, or a genuinely unhandled exception — comes back in the same JSON
envelope: `{"error": {"code": <str>, "message": <str>}}`. Registered once, in `main.py`, via
`register_exception_handlers(app)`; routers should never register their own `@app.exception_handler`.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.errors import AppError

# Registered on Starlette's base HTTPException, not fastapi.HTTPException (a subclass of it):
# FastAPI's routing layer raises the *base* class directly for things like "no route matched"
# (e.g. a 404 on an unknown path), which a handler registered only for the subclass would miss —
# this is FastAPI's own documented way to override those defaults.

logger = logging.getLogger(__name__)


def _error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"code": code, "message": message}})


async def _handle_app_error(request: Request, exc: AppError) -> JSONResponse:
    return _error_response(exc.status_code, type(exc).__name__, exc.message)


async def _handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return _error_response(exc.status_code, "HTTPException", str(exc.detail))


async def _handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    return _error_response(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "ValidationError",
        "Request validation failed.",
    )


async def _handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    # Never leak internals (stack traces, raw exception text) in the response — log server-side
    # instead and return a generic message. Same "don't overexpose" posture this project already
    # takes with clinical data, applied here to error responses.
    logger.exception("Unhandled exception while processing %s %s", request.method, request.url.path)
    return _error_response(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        "InternalServerError",
        "An unexpected error occurred.",
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _handle_app_error)
    app.add_exception_handler(StarletteHTTPException, _handle_http_exception)
    app.add_exception_handler(RequestValidationError, _handle_validation_error)
    app.add_exception_handler(Exception, _handle_unexpected_error)
