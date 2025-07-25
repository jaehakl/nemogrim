cd %cd%\apps\video_backend\app
poetry run uvicorn main:app --reload --host 0.0.0.0 --port 8000 --no-access-log





