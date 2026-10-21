from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import paths
from app.errors import ConflictError, NotFoundError, register_exception_handlers


def test_resolve_data_path_only_returns_existing_files_inside_data_dir(data_dir, tmp_path):
    inside = data_dir / "scenes" / "1" / "1.webp"
    inside.parent.mkdir(parents=True)
    inside.write_bytes(b"webp")
    outside = tmp_path / "secret.txt"
    outside.write_text("secret", encoding="utf-8")

    assert paths.resolve_data_path("scenes/1/1.webp") == inside.resolve()
    assert paths.resolve_data_path("../secret.txt") is None
    assert paths.resolve_data_path(str(outside)) is None
    assert paths.resolve_data_path("scenes/1/missing.webp") is None
    assert paths.resolve_data_path("scenes") is None
    assert paths.resolve_data_path(None) is None
    assert paths.to_data_relative(inside) == "scenes/1/1.webp"


def test_domain_errors_map_to_status_codes_with_detail_body():
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/missing")
    def missing():
        raise NotFoundError("없습니다")

    @app.get("/conflict")
    def conflict():
        raise ConflictError("충돌")

    client = TestClient(app)
    assert client.get("/missing").status_code == 404
    assert client.get("/missing").json() == {"detail": "없습니다"}
    assert client.get("/conflict").status_code == 409
