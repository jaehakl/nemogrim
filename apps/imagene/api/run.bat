cd ./app
poetry run uvicorn main:app --reload --host 0.0.0.0
rem cd ./app
rem call ./_creator/.venv/Scripts/activate.bat
rem uvicorn _creator_main:app --reload --host 0.0.0.0



