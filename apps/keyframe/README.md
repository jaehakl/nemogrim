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
- OpenAI CLIP `ViT-L/14` 768차원 이미지 embedding
- `SmilingWolf/wd-eva02-large-tagger-v3` 기반 prompt·keyword 추출
- 최신순 Scene tile grid와 무한 스크롤 탐색
- OpenAI CLIP 텍스트·이미지 embedding cosine similarity 기반 Scene 검색
- Scene timestamp 자동 재생 상세 화면과 이미지 embedding 기반 유사 Scene 탐색
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
│   └── pyproject.toml
├── ui/                  # React 19, TypeScript, React Router, Vite
│   └── src/             # api, layout, page, component, hook 모듈
└── data/                # 실행 시 생성, Git 제외
    ├── keyframe.sqlite3
    ├── thumbnails/
    ├── scenes/{movie_id}/
    └── models/          # CLIP·WD14 다운로드 캐시
```

## 사전 요구사항

- Python 3.11 이상 3.14 미만
- Poetry
- Node.js 18 이상
- pnpm (`corepack pnpm` 권장)
- PATH에서 실행 가능한 `ffmpeg`, `ffprobe`
- Windows PowerShell 5.1 및 .NET Framework 4.8 WinForms
- NVIDIA GPU 사용 시 CUDA 12.8 계열 드라이버 호환 환경

현재 앱은 Windows 단일 사용자 로컬 실행을 전제로 합니다. FastAPI는 `powershell.exe -NoProfile -STA`로 별도 WinForms 선택기를 실행하므로 API worker thread와 파일 탐색기의 UI thread가 분리됩니다. CLIP과 WD14는 CUDA를 우선 사용하며 CUDA를 사용할 수 없으면 CPU로 fallback합니다.

## 설치

```powershell
cd E:\nemogrim\apps\keyframe\api
poetry install

cd E:\nemogrim
corepack pnpm install
```

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

## 데이터베이스

### `movie_files`

원본 경로, 파일 메타데이터, codec, 썸네일과 직접 재생 판정 상태를 저장합니다. `normalized_path`는 대소문자와 경로 표현을 정규화한 unique 값입니다.

### `scenes`

`movie_file_id`, `timestamp_ms`, prompt, keywords, embedding, snapshot 경로, 분석 상태와 재생 횟수를 저장합니다. `(movie_file_id, timestamp_ms)`는 unique이며 영상 삭제 시 Scene도 함께 삭제됩니다.

기존 SQLite는 시작 시 컬럼 존재 여부를 확인하는 additive migration으로 보존합니다. `processing` 상태에서 중단된 작업은 다음 시작 시 `pending`으로 복구됩니다.

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

## 영상 재생과 Scene 분석

- MP4/M4V H.264와 VP8·VP9 WebM은 원본을 직접 재생합니다.
- 다른 확장자나 비호환 codec은 변환하지 않고 상세 페이지에서 재생을 차단합니다.
- 이전에 등록된 AVI·MKV 레코드와 기존 `data/playback` 캐시는 삭제하지 않지만 재생에는 사용하지 않습니다.
- 플레이어에서 `←`/`→`는 10초, `Ctrl` 조합은 1분, `Shift` 조합은 5분 이동합니다. `Shift`와 `Ctrl`이 함께 눌리면 5분이 우선합니다.
- `S` 또는 **현재 위치에 Scene 생성** 버튼으로 Scene을 등록합니다. snapshot을 먼저 표시하고 CLIP·WD14 분석은 단일 백그라운드 작업열에서 이어서 실행됩니다.
- 첫 Scene 분석 때 모델을 `data/models`에 다운로드합니다. 모델 캐시는 이후 실행에서도 재사용되며 첫 작업은 네트워크와 모델 로드 때문에 오래 걸릴 수 있습니다.

## Scene 탐색과 검색

- 사이드바의 **Scene 탐색**에서 모든 Scene을 최신순 tile grid로 확인할 수 있습니다.
- 목록과 검색 결과는 48개씩 불러오며 페이지 하단에 도달하면 다음 결과를 자동으로 추가합니다.
- Scene tile을 선택하면 상세 페이지로 이동하고 원본 영상을 해당 Scene timestamp부터 자동 재생합니다. 브라우저의 자동 재생 정책에 의해 차단되면 같은 위치에서 직접 재생할 수 있습니다.
- Scene 상세에서도 `S` 또는 생성 버튼으로 현재 재생 위치의 Scene을 등록할 수 있으며, 생성 후에도 현재 상세 페이지와 재생 위치를 유지합니다.
- 검색어를 전송하면 기존 OpenAI CLIP `ViT-L/14`의 텍스트 임베딩을 생성하고, 같은 모델로 분석 완료된 Scene 이미지 임베딩과 cosine similarity를 비교해 가까운 순서로 정렬합니다.
- 상세 페이지의 **비슷한 Scene**은 현재 Scene의 이미지 embedding과 다른 Scene 이미지 embedding을 직접 비교하며, 현재 Scene을 제외한 전체 라이브러리 결과를 24개씩 자동으로 추가합니다.
- 원본 OpenAI CLIP 특성상 영어 검색어를 사용할 때 더 안정적인 검색 품질을 기대할 수 있습니다.
- 아직 분석 중이거나 실패했거나 호환되는 CLIP embedding이 없는 Scene은 기본 목록에는 표시되지만 검색 결과에서는 제외됩니다.

## 테스트와 빌드

```powershell
cd E:\nemogrim\apps\keyframe\api
poetry run pytest

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
