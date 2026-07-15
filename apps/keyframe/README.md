# Keyframe

로컬 영상의 특정 시점을 Scene으로 기록하고, 이후 키워드와 임베딩을 이용해 장면 단위로 탐색하기 위한 도구입니다.

현재 버전은 영상 라이브러리, 브라우저 호환 원본 재생, 영상별 Scene 생성과 AI 분석을 제공합니다. 원본 영상은 복사하거나 이동하지 않고 절대 경로만 등록합니다.

## 현재 제공 기능

- 별도 STA PowerShell 프로세스의 Windows 네이티브 탐색기에서 여러 영상 파일 또는 폴더 선택
- 폴더 선택 시 하위 폴더까지 재귀 검색
- 정규화 절대 경로 기준 중복 제외 및 새 파일만 등록
- FFprobe 기반 길이·해상도·FPS 분석
- FFmpeg 기반 WebP 대표 썸네일 백그라운드 생성
- 밝은 카드형 영상 라이브러리와 무한 스크롤
- 영상·Scene 상세의 공용 플레이어와 10초·1분·5분 키보드 탐색
- 브라우저 호환 원본의 Range 스트리밍과 비호환 codec 재생 차단
- 현재 재생 위치의 Scene snapshot 생성
- GP Station `ai.clip.image` handler 기반 OpenAI CLIP `ViT-L/14` 768차원 이미지 embedding
- GP Station `ai.wd14.tags` handler 기반 `SmilingWolf/wd-eva02-large-tagger-v3` prompt·keyword 추출
- 최신순 Scene tile grid와 무한 스크롤 탐색
- GP Station `ai.clip.text`와 이미지 embedding cosine similarity 기반 Scene 검색
- Scene timestamp 자동 재생 상세 화면과 이미지 embedding 기반 유사 Scene 탐색
- 영상 snapshot의 WD14 prompt와 SDXL i2i를 이용한 이미지 생성 workspace
- 생성 이미지 CLIP embedding 저장과 전역 최신순 무한스크롤 Image 피드
- 서버 재시작 시 중단된 메타데이터·Scene 분석 재개

신규 등록 지원 확장자: `.mp4`, `.m4v`, `.webm`

## 프로젝트 구조

```text
apps/keyframe/
├── api/                 # FastAPI, SQLAlchemy, SQLite
│   ├── app/
│   │   ├── routers/     # health, movies, scenes API
│   │   └── services/    # 선택기, import, 조회, 재생·Scene 처리·queue
│   ├── tests/
│   ├── .env.example
│   └── pyproject.toml
├── ui/                  # React 19, TypeScript, React Router, Vite
│   └── src/             # api, layout, page, component, hook 모듈
├── vendor/
│   └── gpstation-master-python/ # Keyframe 전용 vendored Python master SDK
└── data/                # 실행 시 생성, Git 제외
    ├── keyframe.sqlite3
    ├── thumbnails/
    ├── images/
    └── scenes/{movie_id}/
```

## 사전 요구사항

- Python 3.11 이상 3.14 미만
- Poetry
- Node.js 18 이상
- pnpm (`corepack pnpm` 권장)
- PATH에서 실행 가능한 `ffmpeg`, `ffprobe`
- Windows PowerShell 5.1 및 .NET Framework 4.8 WinForms
- 실행 중인 GP Station v1 server
- `ai` 앱을 광고하며 연결된 launcher와 GP Station AI slave
- `client` scope를 가진 GP Station Access Token

현재 앱은 Windows 단일 사용자 로컬 실행을 전제로 합니다. FastAPI는 `powershell.exe -NoProfile -STA`로 별도 WinForms 선택기를 실행하므로 API worker thread와 파일 탐색기의 UI thread가 분리됩니다. CLIP·WD14 추론은 Keyframe 프로세스가 아닌 GP Station AI slave 호스트에서 실행됩니다.

## 설치

```powershell
cd E:\nemogrim\apps\keyframe\api
poetry install
Copy-Item .env.example .env

cd E:\nemogrim
corepack pnpm install
```

`api/.env`의 `GPSTATION_API_BASE_URL`과 `GPSTATION_CLIENT_TOKEN`을 실제 server URL과 `client` scope Access Token으로 바꿉니다. `GPSTATION_JOB_TIMEOUT_SECONDS`의 기본 예시는 600초입니다.

## 실행

저장소 루트에서 다음 배치 파일을 실행하면 API와 UI가 각각 새 창에서 시작됩니다.

```powershell
.\run_keyframe.bat
```

개별 실행:

```powershell
cd E:\nemogrim\apps\keyframe\api
poetry run uvicorn app.main:app --reload --host 127.0.0.1 --port 8002

cd E:\nemogrim\apps\keyframe\ui
corepack pnpm dev
```

- UI: http://127.0.0.1:5175
- API: http://127.0.0.1:8002
- API 문서: http://127.0.0.1:8002/docs

API 시작 시 별도 asyncio thread에서 GP Station client 하나를 만들고 `/v1/launchers`를 호출해 URL과 bearer token을 검증합니다. 인증 또는 연결 검증이 실패하면 Keyframe도 시작하지 않으며, 인증에 성공한 빈 launcher 목록은 허용합니다.

## 데이터베이스

### `movie_files`

원본 경로, 파일 메타데이터, codec, 썸네일과 직접 재생 판정 상태를 저장합니다. `normalized_path`는 대소문자와 경로 표현을 정규화한 unique 값입니다.

### `scenes`

`movie_file_id`, `timestamp_ms`, prompt, keywords, embedding, snapshot 경로, 분석 상태와 재생 횟수를 저장합니다. `(movie_file_id, timestamp_ms)`는 unique이며 영상 삭제 시 Scene도 함께 삭제됩니다.

기존 SQLite는 시작 시 컬럼 존재 여부를 확인하는 additive migration으로 보존합니다. `processing` 상태에서 중단된 작업은 다음 시작 시 `pending`으로 복구됩니다.

### `images`

SDXL로 생성된 이미지의 상대 파일 경로, WD14 prompt와 OpenAI CLIP `ViT-L/14` 768차원 embedding을 저장합니다. 생성 이미지는 `data/images`에 보관되며 영화와 관계없이 ID 내림차순의 전역 피드로 조회됩니다.

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | DB와 FFmpeg 상태 확인 |
| GET | `/api/movies` | ID 커서 기반 영상 목록 |
| POST | `/api/movies/import/files` | 복수 파일 선택 및 등록 |
| POST | `/api/movies/import/folder` | 폴더 재귀 검색 및 등록 |
| POST | `/api/movies/statuses` | 백그라운드 처리 상태 일괄 조회 |
| GET | `/api/movies/{id}` | 영상 상세·codec·재생 상태·Scene 개수 조회 |
| POST | `/api/movies/{id}/playback/prepare` | 원본의 브라우저 직접 재생 가능 여부 판정 |
| GET | `/api/movies/{id}/stream` | 호환 원본 영상 Range 스트리밍 |
| GET | `/api/movies/{id}/thumbnail` | 생성된 WebP 썸네일 조회 |
| GET | `/api/movies/{id}/scenes` | timestamp 오름차순 Scene 목록 |
| POST | `/api/movies/{id}/scenes` | 현재 timestamp의 Scene 등록 및 분석 예약 |
| GET | `/api/scenes` | 최신순 Scene 목록 또는 CLIP 검색 결과 (`query`, `offset`, `limit`) |
| GET | `/api/scenes/{id}` | 영상 제목을 포함한 Scene 상세 정보 |
| GET | `/api/scenes/{id}/similar` | CLIP 이미지 embedding 기반 유사 Scene 목록 (`offset`, `limit`) |
| GET | `/api/scenes/{id}/snapshot` | 생성된 Scene WebP snapshot 조회 |
| POST | `/api/scenes/{id}/retry` | 실패한 Scene 분석 재예약 |
| GET | `/api/images` | 생성 이미지 최신순 cursor 목록 |
| GET | `/api/images/models` | GP Station SDXL 모델과 공개 기본 설정 조회 |
| GET | `/api/images/{id}/file` | 생성 이미지 파일 조회 |
| POST | `/api/movies/{id}/images` | 현재 timestamp snapshot 기반 SDXL i2i 이미지 생성 |

## 영상 재생과 Scene 분석

- MP4/M4V H.264와 VP8·VP9 WebM은 원본을 직접 재생합니다.
- 다른 확장자나 비호환 codec은 변환하지 않고 상세 페이지에서 재생을 차단합니다.
- 이전에 등록된 AVI·MKV 레코드와 기존 `data/playback` 캐시는 삭제하지 않지만 재생에는 사용하지 않습니다.
- 플레이어에서 `←`/`→`는 10초, `Ctrl` 조합은 1분, `Shift` 조합은 5분 이동합니다. `Shift`와 `Ctrl`이 함께 눌리면 5분이 우선합니다.
- `S` 또는 **현재 위치에 Scene 생성** 버튼으로 Scene을 등록합니다. snapshot을 먼저 표시하고 CLIP·WD14 분석은 단일 백그라운드 작업열에서 이어서 실행됩니다.
- 한 Scene은 하나의 GP Station job session에서 `ai.clip.image` 다음 `ai.wd14.tags` 순서로 처리합니다. 두 결과가 모두 유효할 때만 embedding·prompt·keyword를 함께 저장합니다.
- WebP snapshot attachment의 상한은 20 MiB입니다. 모델 다운로드와 cache는 Keyframe의 `data/models`가 아니라 AI slave 호스트에 생성됩니다. 기존 Keyframe `data/models`가 있더라도 자동 삭제하지 않습니다.

## Scene 탐색과 검색

- 사이드바의 **Scene 탐색**에서 모든 Scene을 최신순 tile grid로 확인할 수 있습니다.
- 목록과 검색 결과는 48개씩 불러오며 페이지 하단에 도달하면 다음 결과를 자동으로 추가합니다.
- Scene tile을 선택하면 상세 페이지로 이동하고 원본 영상을 해당 Scene timestamp부터 자동 재생합니다. 브라우저의 자동 재생 정책에 의해 차단되면 같은 위치에서 직접 재생할 수 있습니다.
- Scene 상세에서도 `S` 또는 생성 버튼으로 현재 재생 위치의 Scene을 등록할 수 있으며, 생성 후에도 현재 상세 페이지와 재생 위치를 유지합니다.
- 검색어를 전송하면 기존 OpenAI CLIP `ViT-L/14`의 텍스트 임베딩을 생성하고, 같은 모델로 분석 완료된 Scene 이미지 임베딩과 cosine similarity를 비교해 가까운 순서로 정렬합니다.
- 상세 페이지의 **비슷한 Scene**은 현재 Scene의 이미지 embedding과 다른 Scene 이미지 embedding을 직접 비교하며, 현재 Scene을 제외한 전체 라이브러리 결과를 24개씩 자동으로 추가합니다.
- 원본 OpenAI CLIP 특성상 영어 검색어를 사용할 때 더 안정적인 검색 품질을 기대할 수 있습니다.
- 아직 분석 중이거나 실패했거나 호환되는 CLIP embedding이 없는 Scene은 기본 목록에는 표시되지만 검색 결과에서는 제외됩니다.

## 이미지 생성

- 사이드바의 **이미지 생성**에서 영상을 선택한 뒤 player와 SDXL 설정 패널을 사용합니다.
- player의 **이미지 생성** 버튼은 현재 timestamp에서 임시 WebP snapshot을 만들고, GP Station의 `ai.wd14.tags`로 prompt를 추출한 다음 `ai.sdxl.i2i`에 전달합니다.
- WD14, SDXL i2i, 결과별 `ai.clip.image` 호출은 하나의 WebRTC job session에서 순차 실행해 연결 비용을 줄입니다.
- 생성 개수는 최대 8장이며 모델, negative prompt, seed, step, CFG, strength, 출력 크기와 PNG/JPG 형식을 설정할 수 있습니다.
- 요청은 생성 완료까지 기다리며 모든 결과의 파일·embedding 저장이 성공한 경우에만 Image 피드에 반영됩니다.

## GP Station Python SDK vendoring

Keyframe은 외부 checkout을 런타임 path로 참조하지 않고 `vendor/gpstation-master-python`의 editable dependency를 사용합니다. 현재 사본은 upstream `D:\dev\gpstation\app_v1\sdk\master\python`의 GP Station commit `bf76e6c1e3a9a0bbdc5dcb6ffb192c18ebf1e67a`에서 tracked 파일 19개를 복제한 것입니다.

SDK 수정은 먼저 GP Station upstream에 반영하고 commit한 뒤, `gpstation_master/`, `tests/`, `README.md`, `pyproject.toml`, `poetry.lock`의 tracked 파일을 이 vendor 디렉터리에 다시 복제합니다. `.venv`, `dist`, pytest/cache 파일은 복제하지 않습니다.

## 테스트와 빌드

```powershell
cd E:\nemogrim\apps\keyframe\api
poetry run pytest
poetry check --lock

cd E:\nemogrim\apps\keyframe\vendor\gpstation-master-python
poetry install
poetry run pytest
poetry check --lock

cd E:\nemogrim\apps\keyframe\ui
corepack pnpm test
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
```

## 향후 기능

- Scene 연속 재생
- Scene 수정·삭제와 batch 생성
- 재생 기록과 통계

원본 파일이 이동하거나 삭제되어도 현재 DB 레코드는 유지됩니다. 경로 재연결과 삭제 기능은 후속 범위입니다.
