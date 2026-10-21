# Keyframe

Keyframe은 로컬 영상의 특정 시점을 Scene으로 기록하고, 태그와 이미지 임베딩으로 장면을 찾아보는 도구입니다.

- **AI는 모두 이 PC에서 실행됩니다.** CLIP과 WD14 모델이 API 프로세스 안에서 직접 동작하며, 외부 AI 서버가 필요 없습니다.
- **원본 영상은 그대로 둡니다.** 복사하거나 이동하지 않고 절대 경로만 등록합니다.

## 기능

- **영상 등록**
  - Windows 탐색기 창에서 여러 파일이나 폴더를 고릅니다. 폴더를 고르면 하위 폴더까지 찾습니다.
  - 이미 등록된 경로는 건너뜁니다.
- **메타데이터와 썸네일**: FFprobe로 길이·해상도·FPS·codec을 읽고, FFmpeg로 WebP 썸네일을 백그라운드에서 만듭니다.
- **재생**: 브라우저가 지원하는 원본만 Range 스트리밍으로 재생합니다. 지원하지 않는 codec은 변환하지 않고 재생을 막습니다.
- **Scene 만들기**: 플레이어에서 `S` 키를 누르면 현재 위치에 Scene이 생기고 snapshot이 저장됩니다.
- **로컬 AI 분석**
  - OpenAI CLIP ViT-L/14로 768차원 이미지 임베딩을 만듭니다.
  - SmilingWolf WD14 EVA02-Large v3로 태그를 뽑습니다.
- **검색**
  - **CLIP 텍스트 검색**: 상단 검색창에 장면을 글로 적으면 비슷한 Scene을 찾습니다. 단축키는 `/`입니다.
  - **비슷한 Scene**: Scene 상세 화면에서 이미지 임베딩이 가까운 Scene을 보여줍니다.
  - **태그 칩**: 칩을 누르면 그 태그로 검색합니다.
- **화면**: 어두운 미디어 라이브러리 UI입니다. 사이드바를 접을 수 있고, 좁은 화면에서는 drawer로 바뀝니다. 목록은 무한 스크롤입니다.
- **작업 복구**: 서버가 다시 시작되면 중단됐던 메타데이터와 Scene 분석 작업을 이어서 처리합니다.

등록할 수 있는 확장자: `.mp4`, `.m4v`, `.webm`

## 프로젝트 구조

```text
apps/keyframe/
├── api/                       # FastAPI · SQLAlchemy · SQLite
│   ├── app/
│   │   ├── ai/                # 로컬 AI: runtime(단일 워커), clip, tagger, device, types
│   │   ├── routers/           # health, ai, movies, scenes (얇은 HTTP 계층)
│   │   ├── services/          # import·조회·재생·FFmpeg·Scene 처리·벡터 인덱스·작업 큐
│   │   ├── db.py              # 모델, 엔진, 스키마 버전
│   │   ├── errors.py          # 도메인 예외 → HTTP 응답 매핑
│   │   ├── paths.py           # data 디렉터리 경로와 경로 이탈 방지
│   │   ├── schemas.py         # 요청/응답 스키마
│   │   └── settings.py        # KEYFRAME_* 설정
│   ├── scripts/ai_smoke.py    # 실제 모델 동작 확인 + 모델 사전 다운로드
│   └── tests/
├── ui/                        # React 19 · TypeScript · React Router · TanStack Query · Vite
│   └── src/
│       ├── api/               # fetch 클라이언트, 타입, query key
│       ├── hooks/             # 서버 상태 훅(TanStack Query), 무한 스크롤
│       ├── components/        # layout, ui(공용), media(카드), player
│       ├── pages/             # 영상 라이브러리·영상 상세·Scene 탐색·Scene 상세
│       ├── lib/               # 포맷터, 상태 라벨, 키보드 유틸
│       └── styles/            # 디자인 토큰, 전역 스타일
└── data/                      # 실행 중에 생성됨, Git 제외
    ├── keyframe.sqlite3
    ├── models/                # Hugging Face 모델 캐시 (약 2.8GB)
    ├── thumbnails/
    └── scenes/{movie_id}/
```

## 사전 요구사항

- Windows. 파일 선택 창에 PowerShell 5.1과 .NET Framework 4.8 WinForms를 사용합니다.
- Python 3.12 이상 3.14 미만, Poetry
- Node.js 18 이상
- PATH에서 실행할 수 있는 `ffmpeg`, `ffprobe`
- 권장: CUDA 12.8을 지원하는 NVIDIA GPU. 없으면 CPU로 실행되며, Scene 하나를 분석하는 데 약 4초가 걸립니다.

## 설치

```powershell
cd E:\nemogrim\apps\keyframe\api
poetry install                          # torch cu128 포함
poetry run python scripts/ai_smoke.py   # 선택: 모델(약 2.8GB)을 미리 내려받고 GPU 동작 확인

cd ..\ui
npm install
```

설정 파일은 필수가 아닙니다. 기본값을 바꾸려면 `api/.env.example`을 `api/.env`로 복사해 고칩니다.

| 환경 변수 | 기본값 | 설명 |
|---|---|---|
| `KEYFRAME_AI_DEVICE` | `auto` | `auto`는 CUDA가 있으면 GPU를 씁니다. `cuda`, `cpu`도 지정할 수 있습니다. |
| `KEYFRAME_AI_MODEL_CACHE_DIR` | `data/models` | 모델 파일을 저장할 위치 |
| `KEYFRAME_AI_WARMUP` | `false` | 기동 직후 백그라운드에서 모델을 미리 불러옵니다. |
| `KEYFRAME_AI_OFFLINE` | `false` | 내려받아 둔 모델만 쓰고 네트워크 다운로드를 하지 않습니다. |
| `KEYFRAME_AI_REQUEST_TIMEOUT_SECONDS` | `180` | 텍스트 검색 요청이 AI 응답을 기다리는 최대 시간(초) |
| `KEYFRAME_WD14_GENERAL_THRESHOLD` / `_CHARACTER_THRESHOLD` / `_MAX_TAGS` | `0.35` / `0.85` / `64` | 태그를 고르는 기준 |
| `KEYFRAME_CORS_ORIGINS` | `["http://127.0.0.1:5175","http://localhost:5175"]` | API를 직접 호출할 수 있는 origin |

> 예전 버전의 `GPSTATION_*` 값이 `api/.env`에 남아 있어도 무시됩니다. 지워도 됩니다.

## 실행

저장소 루트에서 실행하면 API와 UI가 각각 새 창에서 시작됩니다.

```powershell
.\run_keyframe.bat
```

따로 실행하려면:

```powershell
cd E:\nemogrim\apps\keyframe\api
poetry run uvicorn app.main:app --reload --host 127.0.0.1 --port 8002

cd E:\nemogrim\apps\keyframe\ui
npm run dev
```

- UI: http://127.0.0.1:5175
- API: http://127.0.0.1:8002 (문서: `/docs`)

## 로컬 AI

- **기동 시**: API를 시작하면 실행 장치만 확인하고 모델은 불러오지 않습니다.
- **모델 로드 시점**: 첫 Scene 분석이나 첫 검색 때 불러옵니다. 사이드바의 **모델 미리 불러오기**를 눌러도 됩니다.
  - 처음에는 내려받느라 몇 분 걸립니다.
  - 이미 받아 둔 모델은 약 15초 만에 불러옵니다.
- **실행 방식**: 모든 추론은 `keyframe-ai` 워커 스레드 하나에서 차례로 실행되어 GPU 메모리를 안정적으로 씁니다. 모델이 올라간 뒤에는 Scene 하나에 약 0.1초(RTX 3090 Ti)가 걸립니다.
- **CLIP**: `open_clip`의 `ViT-L-14`(`pretrained="openai"`, QuickGELU)를 씁니다. 이미지와 텍스트 임베딩은 L2 정규화한 float32 768차원 값입니다.
- **WD14**: `SmilingWolf/wd-eva02-large-tagger-v3`의 timm 가중치를 torch로 실행합니다. ONNX Runtime은 쓰지 않습니다.
  - 전처리: 흰 배경에 패딩한 정사각형 → 448px bicubic → 정규화 → BGR
  - 태그 순서: character 태그가 먼저 오고, 그다음 general 태그가 신뢰도 순으로 옵니다. rating 태그는 제외합니다.
- **상태 확인**: 모델 상태와 실행 장치는 사이드바 하단이나 `GET /api/ai/status`에서 볼 수 있습니다.
- **모델 로드 실패**: 그 Scene은 `failed`가 되고 **재시도**할 수 있습니다. 검색은 503과 함께 이유를 알려줍니다.
- **개발 중 주의**: `--reload`로 실행하면 코드가 바뀔 때마다 모델을 다시 불러옵니다.

## 데이터베이스

- **`movie_files`**: 원본 경로와 파일 메타데이터, codec, 썸네일 경로, 직접 재생 판정(`unprepared` | `direct` | `failed`)을 저장합니다.
- **`scenes`**: `timestamp_ms`, 태그 prompt와 keywords, CLIP 임베딩(3072바이트 BLOB), snapshot 경로, 분석 상태를 저장합니다.
  - `(movie_file_id, timestamp_ms)` 조합은 중복될 수 없습니다.
  - 영상을 삭제하면 그 영상의 Scene도 함께 삭제됩니다.

**스키마 버전**: 스키마 버전은 SQLite `PRAGMA user_version`으로 관리하며 현재는 v2입니다. 마이그레이션은 하지 않습니다. 버전이 다른 DB 파일이 있으면 기동을 멈추고 안내를 출력합니다. 그때는 `data/keyframe.sqlite3*`를 백업한 뒤 삭제하고 다시 시작하세요.

**작업 복구**: `processing` 상태에서 중단된 작업은 다음에 시작할 때 `pending`으로 돌아가 다시 처리됩니다.

## API

목록 API는 모두 `cursor`와 `limit`를 받고 `{items, total, next_cursor}`를 돌려줍니다. 응답의 `next_cursor`를 다음 요청의 `cursor`로 넘기면 되고, 마지막 페이지에서는 `null`입니다. 오류 응답은 `{"detail": "메시지"}` 형식입니다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | DB, FFmpeg, AI 상태 |
| GET | `/api/ai/status` | 실행 장치와 모델별 로드 상태 |
| POST | `/api/ai/warmup` | 모델을 백그라운드에서 미리 불러옴 (202) |
| GET | `/api/movies` | 영상 목록. id 내림차순이며 `processing_count`를 포함함 |
| POST | `/api/movies/import/files` | 여러 파일을 골라 등록 |
| POST | `/api/movies/import/folder` | 폴더를 하위 폴더까지 찾아 등록 |
| GET | `/api/movies/{id}` | 영상 상세, codec, 재생 상태, Scene 개수 |
| POST | `/api/movies/{id}/playback/prepare` | 원본을 브라우저에서 직접 재생할 수 있는지 판정 |
| GET | `/api/movies/{id}/stream` | 원본 영상 Range 스트리밍 |
| GET | `/api/movies/{id}/thumbnail` | WebP 썸네일 |
| GET | `/api/movies/{id}/scenes` | 영상의 Scene 목록 (timestamp 오름차순) |
| POST | `/api/movies/{id}/scenes` | Scene 등록 후 분석 예약 (201, 중복이면 409) |
| GET | `/api/scenes` | 검색어가 없으면 최신순, `query`가 있으면 CLIP 유사도순 |
| GET | `/api/scenes/{id}` | Scene 상세 (영상 제목 포함) |
| DELETE | `/api/scenes/{id}` | Scene과 snapshot 삭제 (204) |
| GET | `/api/scenes/{id}/similar` | 비슷한 Scene 목록 (`available` 포함) |
| GET | `/api/scenes/{id}/snapshot` | Scene WebP snapshot |
| POST | `/api/scenes/{id}/retry` | 실패한 분석 다시 예약 |

## 재생과 Scene 단축키

- MP4/M4V(H.264)와 WebM(VP8·VP9)만 원본 그대로 재생합니다. 그 밖의 형식은 변환하지 않고 재생을 막습니다.
- 위치 이동
  - `←` / `→`: 10초
  - `Ctrl`과 함께: 1분
  - `Shift`와 함께: 5분. `Ctrl`과 `Shift`를 함께 누르면 5분이 우선합니다.
- 기타 단축키
  - `S`: 현재 위치에 Scene 생성
  - `/`: 검색창으로 이동
- Scene 상세는 해당 위치부터 자동 재생합니다. 브라우저가 자동 재생을 막아도 위치는 맞춰져 있습니다.
- 검색은 Scene 이미지와 검색어 사이의 cosine 유사도로 순위를 매기며, 영어 검색어가 가장 정확합니다. 분석이 끝난 Scene만 검색 결과에 나옵니다.

## 테스트와 빌드

```powershell
cd E:\nemogrim\apps\keyframe\api
poetry run pytest                       # 모델 없이 대체 객체로 실행
$env:KEYFRAME_RUN_MODEL_TESTS="1"; poetry run pytest -m models   # 실제 모델 테스트 (선택)

cd ..\ui
npm test
npm run typecheck
npm run lint
npm run build
```
