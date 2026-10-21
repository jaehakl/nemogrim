"""도메인 예외와 HTTP 응답 매핑.

서비스 계층은 HTTP를 모른 채 이 예외만 던지고, 응답 변환은 exception handler 한 곳에서 한다.
응답 본문은 FastAPI 기본 형식과 같은 `{"detail": message}`이다.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class KeyframeError(Exception):
    status_code = 500

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFoundError(KeyframeError):
    status_code = 404


class ConflictError(KeyframeError):
    status_code = 409


class InvalidRequestError(KeyframeError):
    status_code = 422


class PlaybackUnavailableError(KeyframeError):
    status_code = 409


class ServiceUnavailableError(KeyframeError):
    status_code = 503


class AiUnavailableError(ServiceUnavailableError):
    """AI 런타임이 시작되지 않았거나 모델을 불러오지 못했거나 응답 대기 시간이 초과됨."""


class AiInferenceError(KeyframeError):
    """모델은 준비됐지만 추론 중 오류가 발생함."""


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(KeyframeError)
    async def handle_keyframe_error(_request: Request, error: KeyframeError) -> JSONResponse:
        return JSONResponse({"detail": error.message}, status_code=error.status_code)
