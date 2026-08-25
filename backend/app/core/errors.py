"""Application-specific exceptions.

Route/business logic raises an `AppError` subclass instead of FastAPI's `HTTPException` directly,
so every error response — regardless of which router raised it — goes through one place
(`exception_handlers.py`) and comes back in the same JSON envelope. Add a new subclass here rather
than raising `HTTPException` inline in a router.
"""

from __future__ import annotations


class AppError(Exception):
    """Base class for all application-raised errors. Never raised directly — use a subclass so the
    status code is unambiguous at the raise site."""

    status_code: int = 500
    default_message: str = "An unexpected error occurred."

    def __init__(self, message: str | None = None) -> None:
        self.message = message or self.default_message
        super().__init__(self.message)


class BadRequestError(AppError):
    status_code = 400
    default_message = "The request could not be processed."


class NotFoundError(AppError):
    status_code = 404
    default_message = "The requested resource was not found."


class ServiceUnavailableError(AppError):
    status_code = 503
    default_message = "The service is temporarily unavailable."
