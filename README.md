# Nemogrim - AI 기반 멀티미디어 관리 플랫폼

Nemogrim은 AI 기술을 활용한 이미지 생성 및 관리, 비디오 시청 기록 추적을 위한 통합 웹 플랫폼입니다. pnpm workspace를 기반으로 한 monorepo 구조로 구성되어 있으며, 각 앱은 독립적으로 실행 가능하면서도 공통 기술 스택을 공유합니다.

## 🏗️ 프로젝트 구조

```
nemogrim/
├── apps/
│   ├── imagene/                 # AI 이미지 생성 및 관리 시스템
│   │   ├── api/                # FastAPI 백엔드
│   │   │   ├── app/
│   │   │   │   ├── main.py     # API 엔드포인트
│   │   │   │   ├── db.py       # 데이터베이스 모델
│   │   │   │   ├── service/    # 비즈니스 로직
│   │   │   │   └── utils/      # AI 유틸리티
│   │   │   └── pyproject.toml  # Python 의존성
│   │   └── ui/                 # React 프론트엔드
│   │       ├── src/
│   │       │   ├── App.jsx     # 메인 컴포넌트
│   │       │   ├── components/ # UI 컴포넌트
│   │       │   └── api/        # API 클라이언트
│   │       └── package.json    # Node.js 의존성
│   └── video/                  # 비디오 관리 및 시청 기록 시스템
│       ├── api/                # FastAPI 백엔드
│       │   ├── app/
│       │   │   ├── main.py     # API 엔드포인트
│       │   │   ├── db.py       # 데이터베이스 모델
│       │   │   └── service/    # 비즈니스 로직
│       │   └── pyproject.toml  # Python 의존성
│       ├── ui/                 # React 프론트엔드
│       │   ├── src/
│       │   │   ├── components/ # React 컴포넌트
│       │   │   ├── api/        # API 통신 함수
│       │   │   └── App.jsx     # 메인 앱 컴포넌트
│       │   └── package.json    # Node.js 의존성
│       └── video_files/        # 비디오 파일 저장 디렉토리
├── package.json                # 루트 패키지 설정
├── pnpm-workspace.yaml         # pnpm workspace 설정
└── README.md                   # 프로젝트 문서
```

## 🚀 주요 앱

### 1. Imagene - AI 이미지 생성 및 관리 시스템

Stable Diffusion 기반의 AI 이미지 생성 및 관리 시스템으로, 연구자와 아티스트가 대량의 이미지를 효율적으로 생성하고 체계적으로 관리할 수 있도록 돕는 전문 도구입니다.

#### 주요 기능
- **AI 이미지 생성**: Stable Diffusion XL 모델을 사용한 고품질 이미지 생성
- **고급 파라미터 제어**: Seed, Steps, CFG 등 다양한 생성 파라미터 설정
- **자동 반복 생성**: 대량의 데이터셋 구축을 위한 자동화된 이미지 생성
- **프롬프트 생성기**: 효과적인 프롬프트 생성을 위한 키워드 관리 시스템
- **이미지 관리**: 그리드 갤러리, 키워드 검색, 그룹화 기능
- **통계 분석**: 생성 파라미터, 프롬프트 길이, 키워드 빈도 분석
- **DNA 기반 생성**: 유전 알고리즘을 활용한 이미지 생성 최적화

#### 기술 스택
- **Backend**: FastAPI, SQLAlchemy, PostgreSQL + pgvector, PyTorch, SentenceTransformers
- **Frontend**: React 18, RSuite, Recharts, Context API

### 2. Video - 비디오 관리 및 시청 기록 시스템

비디오 업로드, 재생, 시청 기록 관리, 즐겨찾기 기능을 제공하는 종합 비디오 관리 플랫폼입니다.

#### 주요 기능
- **비디오 관리**: 파일 업로드, 메타데이터 설정, 목록 조회 및 필터링
- **시청 기록 추적**: 비디오 재생 시점과 시간 기록, 키워드 태깅
- **즐겨찾기**: 중요 시청 기록 즐겨찾기 표시
- **썸네일 생성**: 시청 시점의 썸네일 자동 생성
- **파일 동기화**: 로컬 비디오 파일 자동 스캔 및 등록

#### 기술 스택
- **Backend**: FastAPI, SQLAlchemy, SQLite, OpenCV, Pillow
- **Frontend**: React 19, React Router, Vite, Axios, RSuite, Recharts

## 🛠️ 공통 기술 스택

### Backend
- **FastAPI**: 고성능 Python 웹 프레임워크
- **SQLAlchemy**: ORM 및 데이터베이스 관리
- **Poetry**: Python 패키지 관리

### Frontend
- **React 19**: 최신 React 버전
- **Vite**: 빠른 개발 서버 및 빌드 도구
- **Axios**: HTTP 클라이언트
- **RSuite**: UI 컴포넌트 라이브러리

## 🚀 설치 및 실행

### 사전 요구사항
- Python 3.11 이상
- Node.js 18 이상
- Poetry (Python 패키지 관리자)
- pnpm (Node.js 패키지 관리자)

### 1. 프로젝트 클론 및 의존성 설치

```bash
# 프로젝트 클론
git clone <repository-url>
cd nemogrim

# 루트 의존성 설치
pnpm install
```

### 2. Imagene 앱 설정

```bash
# 백엔드 설정
cd apps/imagene/api
poetry install

# 프론트엔드 설정
cd apps/imagene/ui
pnpm install
```

### 3. Video 앱 설정

```bash
# 백엔드 설정
cd apps/video/api
poetry install

# 프론트엔드 설정
cd apps/video/ui
pnpm install
```

### 4. 환경 변수 설정

#### Imagene 앱
1. `apps/imagene/api/env.example` 파일을 참고하여 `apps/imagene/api/.env` 파일 생성
2. 실제 데이터베이스 정보로 수정

```bash
cp apps/imagene/api/env.example apps/imagene/api/.env
# .env 파일을 편집하여 실제 값으로 수정
```

#### Video 앱
1. `apps/video/api/env.example` 파일을 참고하여 `apps/video/api/.env` 파일 생성 (선택사항)
2. 필요한 경우 설정 값 수정

```bash
cp apps/video/api/env.example apps/video/api/.env
# .env 파일을 편집하여 필요한 값으로 수정
```

**⚠️ 보안 주의사항**: 
- 실제 비밀번호와 데이터베이스 정보는 절대 Git에 커밋하지 마세요
- `.env` 파일은 `.gitignore`에 포함되어 있어 자동으로 제외됩니다

### 5. 데이터베이스 설정

#### Imagene (PostgreSQL + pgvector)
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

#### Video (SQLite)
자동으로 생성되며 별도 설정 불필요

### 6. 애플리케이션 실행

#### Windows에서 실행 (배치 파일 사용)
```bash
# Imagene 앱 실행
run_imagene.bat

# Video 앱 실행
run_video.bat
```

#### 수동 실행

**Imagene 앱:**
```bash
# 백엔드 (포트 8000)
cd apps/imagene/api
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 프론트엔드 (포트 5173)
cd apps/imagene/ui
pnpm run dev
```

**Video 앱:**
```bash
# 백엔드 (포트 8001)
cd apps/video/api/app
poetry run uvicorn main:app --reload --host 0.0.0.0 --port 8001

# 프론트엔드 (포트 5174)
cd apps/video/ui
pnpm run dev
```

### 7. 접속 정보

#### Imagene 앱
- **프론트엔드**: http://localhost:5173
- **백엔드 API**: http://localhost:8000
- **API 문서**: http://localhost:8000/docs

#### Video 앱
- **프론트엔드**: http://localhost:5174
- **백엔드 API**: http://localhost:8001
- **API 문서**: http://localhost:8001/docs

## 📊 주요 API 엔드포인트

### Imagene API
- `POST /add-figure/` - 새 이미지 추가
- `POST /update-figure/` - 이미지 정보 업데이트
- `GET /get-figure/{figure_id}` - 특정 이미지 조회
- `GET /delete-figure/{figure_id}` - 이미지 삭제
- `GET /random-prompt/` - 랜덤 프롬프트 생성
- `POST /figures-from-prompt/` - 프롬프트로 유사 이미지 검색
- `POST /generate-image/` - AI 이미지 생성
- `POST /generate-offsprings/` - DNA 기반 이미지 생성
- `GET /statistics/` - 이미지 생성 통계 조회

### Video API
- `POST /upload-video/` - 비디오 업로드
- `GET /list-videos/` - 비디오 목록 조회
- `GET /video/{video_id}` - 특정 비디오 조회
- `POST /video-update/{video_id}` - 비디오 정보 수정
- `DELETE /video/{video_id}` - 비디오 삭제
- `POST /sync-video-files/` - 로컬 파일 동기화
- `POST /history/` - 시청 기록 생성
- `GET /history/{video_id}` - 비디오별 시청 기록 조회
- `GET /favorites/` - 즐겨찾기 목록 조회

## 🎯 주요 기능 상세

### AI 이미지 생성 (Imagene)
- Stable Diffusion XL 모델을 사용한 고품질 이미지 생성
- Seed, Steps, CFG 등 다양한 생성 파라미터 제어
- 자동 반복 생성으로 대량 데이터셋 구축
- DNA 기반 유전 알고리즘을 활용한 이미지 생성 최적화
- 프롬프트 생성기와 키워드 관리 시스템

### 비디오 파일 동기화 (Video)
- `video_files/` 디렉토리의 비디오 파일을 자동으로 스캔
- 파일명에서 배우와 제목을 자동 추출 (언더스코어 또는 하이픈 기준)
- 지원 형식: MP4, AVI, MKV, MOV, WMV, FLV

### 키워드 기반 필터링
- 비디오별 키워드 태깅
- 시청 기록별 추가 키워드
- 다중 키워드 교집합 필터링

### 썸네일 생성
- 시청 시점의 비디오 프레임을 자동 캡처
- OpenCV를 사용한 고성능 이미지 처리
- 일괄 썸네일 생성 지원

## 🔧 개발 가이드

### 새로운 앱 추가
1. `apps/` 디렉토리에 새 앱 폴더 생성
2. `pnpm-workspace.yaml`에 새 앱 경로 추가
3. 앱별 `package.json` 및 `pyproject.toml` 설정
4. 공통 기술 스택 활용
5. 환경변수 예시 파일 (`env.example`) 생성

### 기존 앱 수정
각 앱은 독립적으로 개발 가능하며, 공통 컴포넌트나 유틸리티는 루트 레벨에서 관리할 수 있습니다.

### 보안 가이드라인
- 민감한 정보(비밀번호, API 키 등)는 절대 소스 코드에 하드코딩하지 마세요
- 환경변수를 통해 설정을 관리하세요
- `.env` 파일은 `.gitignore`에 포함되어 있어야 합니다
- 공개 저장소에 업로드하기 전에 민감정보 검토를 수행하세요

## 🐛 문제 해결

### 일반적인 문제들

1. **포트 충돌**
   - 각 앱이 다른 포트를 사용하도록 설정 확인
   - Imagene: 8000 (백엔드), 5173 (프론트엔드)
   - Video: 8001 (백엔드), 5174 (프론트엔드)

2. **데이터베이스 연결 오류**
   - 환경 변수 설정 확인
   - PostgreSQL 서비스 실행 상태 확인
   - pgvector 확장 설치 확인
   - CUDA 지원 GPU 확인 (Imagene 앱)

3. **의존성 설치 오류**
   - Poetry 버전 확인 (`poetry --version`)
   - pnpm 버전 확인 (`pnpm --version`)
   - Node.js 버전 확인 (`node --version`)

## 🤝 기여하기

1. 이 저장소를 포크합니다
2. 기능 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋합니다 (`git commit -m 'Add some amazing feature'`)
4. 브랜치에 푸시합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성합니다

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

### 라이선스 요약
- **사용**: 개인 및 상업적 목적으로 자유롭게 사용 가능
- **수정**: 소스 코드 수정 및 배포 가능
- **배포**: 수정된 버전의 배포 가능
- **조건**: 원본 라이선스 및 저작권 고지 필요
- **책임**: 소프트웨어는 "있는 그대로" 제공되며, 어떠한 보증도 없음

## 👨‍💻 개발자

- **Jaehak Lee** - 프로젝트 개발자
- 이메일: leejaehak87@gmail.com

## 🔄 업데이트 로그

- **v1.0.0**: 초기 버전 - Imagene 및 Video 앱 통합
- **v0.0.1**: Imagene 앱 - AI 이미지 생성 및 관리 기능 구현
- **v0.0.1**: Video 앱 - 비디오 관리 및 시청 기록 기능 구현

---

**참고**: 이 애플리케이션은 로컬 환경에서 실행되도록 설계되었습니다. 프로덕션 환경에서 사용하려면 적절한 보안 설정과 데이터베이스 최적화가 필요합니다.
