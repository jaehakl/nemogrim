# Cura - AI 이미지 관리 및 검색 시스템

Cura는 AI 임베딩 기반의 이미지 관리 및 검색 시스템입니다. 사용자가 이미지와 관련 메타데이터를 업로드하고, 텍스트 프롬프트를 통해 유사한 이미지를 검색할 수 있는 웹 애플리케이션입니다.

## 🚀 주요 기능

### 백엔드 (FastAPI)
- **이미지 업로드 및 관리**: 이미지 파일과 메타데이터 저장
- **AI 임베딩 기반 검색**: SentenceTransformer를 사용한 텍스트-이미지 유사도 검색
- **PostgreSQL + pgvector**: 벡터 데이터베이스를 활용한 고성능 유사도 검색
- **RESTful API**: CRUD 작업을 위한 완전한 API 제공

### 프론트엔드 (React)
- **직관적인 UI**: RSuite 컴포넌트를 사용한 모던한 인터페이스
- **실시간 검색**: 프롬프트 입력 시 즉시 유사 이미지 검색
- **감상모드**: 전체화면 이미지 감상 기능
- **메타데이터 관리**: 체계적인 이미지 분류 및 태깅

## 🏗️ 아키텍처

```
cura/
├── api/                    # FastAPI 백엔드
│   ├── app/
│   │   ├── main.py        # API 엔드포인트
│   │   ├── db.py          # 데이터베이스 모델
│   │   ├── service/       # 비즈니스 로직
│   │   └── analysis/      # AI 분석 모듈
│   └── pyproject.toml     # Python 의존성
└── ui/                    # React 프론트엔드
    ├── src/
    │   ├── App.jsx        # 메인 컴포넌트
    │   ├── components/    # UI 컴포넌트
    │   └── api/           # API 클라이언트
    └── package.json       # Node.js 의존성
```

## 🛠️ 기술 스택

### 백엔드
- **FastAPI**: 고성능 Python 웹 프레임워크
- **SQLAlchemy**: ORM 및 데이터베이스 관리
- **PostgreSQL + pgvector**: 벡터 데이터베이스
- **SentenceTransformer**: 텍스트 임베딩 생성
- **Poetry**: Python 패키지 관리

### 프론트엔드
- **React 19**: 최신 React 버전
- **RSuite**: UI 컴포넌트 라이브러리
- **Vite**: 빠른 개발 서버 및 빌드 도구
- **Axios**: HTTP 클라이언트


## 🚀 설치 및 실행

### 1. 환경 설정

#### 백엔드 설정
```bash
cd apps/cura/api
poetry install
```

#### 프론트엔드 설정
```bash
cd apps/cura/ui
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 `apps/cura/api/` 디렉토리에 생성하고 다음을 설정:

```env
QUTAT_NEMOGRIM_CURA_DB_URL=postgresql+asyncpg://username:password@localhost:5432/database_name
```

### 3. 데이터베이스 설정

PostgreSQL에 pgvector 확장을 설치하고 데이터베이스를 생성:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 4. 애플리케이션 실행

#### 백엔드 실행
```bash
cd apps/cura/api
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 프론트엔드 실행
```bash
cd apps/cura/ui
npm run dev
```

또는 배치 파일 사용:
```bash
# 백엔드
apps/cura/api/run.bat

# 프론트엔드
apps/cura/ui/run.bat
```

## 📖 API 문서

### 주요 엔드포인트

- `POST /add-figure/`: 새 이미지 추가
- `POST /update-figure/`: 이미지 정보 업데이트
- `GET /get-figure/{figure_id}`: 특정 이미지 조회
- `GET /delete-figure/{figure_id}`: 이미지 삭제
- `GET /random-prompt/`: 랜덤 프롬프트 생성
- `POST /figures-from-prompt/`: 프롬프트로 유사 이미지 검색

### 사용 예시

```javascript
// 이미지 검색
const response = await fetch('/figures-from-prompt/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: "행복한 여성, 실외 배경" })
});

// 랜덤 프롬프트 가져오기
const randomPrompt = await fetch('/random-prompt/');
```

## 🎯 주요 기능 설명

### 1. AI 임베딩 검색
- SentenceTransformer 모델을 사용하여 텍스트를 768차원 벡터로 변환
- 코사인 유사도를 기반으로 가장 유사한 이미지 검색
- PostgreSQL의 pgvector 확장을 활용한 고성능 벡터 검색

### 2. 감상모드
- 전체화면 이미지 감상 기능
- 5초마다 자동으로 유사 이미지 전환
- ESC 키나 버튼으로 종료 가능

## 🔧 개발 가이드

### 새로운 필드 추가
1. `db.py`의 `Figure` 모델에 새 컬럼 추가
2. `figure_service.py`의 `FIGURE_FIELDS`에 필드 정의
3. 프론트엔드 폼 컴포넌트 업데이트

### AI 모델 변경
`analysis/embedding.py`에서 SentenceTransformer 모델을 변경할 수 있습니다:

```python
get_text_embedding.model = SentenceTransformer("새로운_모델_이름")
```

## 📝 라이선스

이 프로젝트는 개인/교육 목적으로 개발되었습니다.

## 👥 기여자

- **Jaehak Lee** - 프로젝트 개발자
- 이메일: leejaehak87@gmail.com

## 🔄 업데이트 로그

- **v0.0.1**: 초기 버전 - 기본 CRUD 및 검색 기능 구현
