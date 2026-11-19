"""A small in-memory limiter for failed login attempts.

It is per server process. That is enough to slow down password guessing on a
single instance; behind several instances, use a shared store such as Redis.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

from .config import settings
from .errors import AppError


class FailedAttemptLimiter:
    def __init__(self) -> None:
        self._failures: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def _prune(self, key: str, now: float) -> deque[float]:
        window = settings.login_window_seconds
        attempts = self._failures[key]
        while attempts and now - attempts[0] > window:
            attempts.popleft()
        return attempts

    def check(self, key: str) -> None:
        if settings.login_max_attempts <= 0:
            return
        with self._lock:
            attempts = self._prune(key, time.monotonic())
            if len(attempts) >= settings.login_max_attempts:
                minutes = max(1, settings.login_window_seconds // 60)
                raise AppError(
                    429,
                    "too_many_attempts",
                    f"Too many failed sign-in attempts. Wait up to {minutes} minutes and try again.",
                )

    def record_failure(self, key: str) -> None:
        with self._lock:
            self._failures[key].append(time.monotonic())

    def reset(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._failures.clear()


login_limiter = FailedAttemptLimiter()
