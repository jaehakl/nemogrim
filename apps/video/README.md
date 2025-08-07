# Nemogrim Video App

비디오 관리 및 시청 기록 추적을 위한 웹 애플리케이션입니다. FastAPI 백엔드와 React 프론트엔드로 구성되어 있으며, 비디오 업로드, 재생, 시청 기록 관리, 즐겨찾기 기능을 제공합니다.

## 🚀 주요 기능

### 비디오 관리
- **비디오 업로드**: 파일 업로드와 메타데이터(배우, 제목, 키워드) 설정
- **비디오 목록**: 등록된 모든 비디오 조회 및 필터링
- **비디오 재생**: 웹 기반 비디오 플레이어로 재생
- **파일 동기화**: 로컬 비디오 파일 자동 스캔 및 등록
- **메타데이터 편집**: 비디오 정보 수정 및 삭제

### 시청 기록 관리
- **시청 기록 추적**: 비디오 재생 시점과 시간 기록
- **키워드 태깅**: 시청 기록에 키워드 추가
- **즐겨찾기**: 중요 시청 기록 즐겨찾기 표시
- **썸네일 생성**: 시청 시점의 썸네일 자동 생성

### 사용자 인터페이스
- **반응형 디자인**: 다양한 화면 크기에 최적화
- **키워드 필터링**: 키워드 기반 비디오 검색 및 필터링
- **페이지네이션**: 대량의 비디오 효율적 표시
- **모달 업로드**: 간편한 비디오 업로드 인터페이스

## 🏗️ 기술 스택

### Backend (FastAPI)
- **Python 3.11+**
- **FastAPI**: RESTful API 프레임워크
- **SQLAlchemy**: ORM 및 데이터베이스 관리
- **SQLite**: 로컬 데이터베이스
- **OpenCV**: 비디오 처리 및 썸네일 생성
- **Pillow**: 이미지 처리
- **Poetry**: 의존성 관리

### Frontend (React)
- **React 19**: 사용자 인터페이스 라이브러리
- **React Router**: 클라이언트 사이드 라우팅
- **Vite**: 빌드 도구 및 개발 서버
- **Axios**: HTTP 클라이언트
- **RSuite**: UI 컴포넌트 라이브러리
- **React Icons**: 아이콘 라이브러리
- **Recharts**: 차트 및 데이터 시각화

## 📁 프로젝트 구조

```
apps/video/
├── api/                          # Backend API
│   ├── app/
│   │   ├── main.py              # FastAPI 애플리케이션 진입점
│   │   ├── db.py                # 데이터베이스 모델 및 설정
│   │   ├── initserver.py        # 서버 초기화 설정
│   │   └── service/             # 비즈니스 로직 서비스
│   │       ├── video_service.py     # 비디오 관리 서비스
│   │       ├── history_service.py   # 시청 기록 서비스
│   │       └── thumbnail_service.py # 썸네일 생성 서비스
│   ├── pyproject.toml           # Python 의존성 관리
│   └── run.bat                  # 백엔드 실행 스크립트
├── ui/                          # Frontend React 앱
│   ├── src/
│   │   ├── components/          # React 컴포넌트
│   │   │   ├── VideoFeed.jsx        # 메인 비디오 피드
│   │   │   ├── VideoPlayer.jsx      # 비디오 플레이어
│   │   │   ├── VideoUpload.jsx      # 업로드 컴포넌트
│   │   │   ├── VideoDetail.jsx      # 비디오 상세 페이지
│   │   │   ├── FavoritesPage.jsx    # 즐겨찾기 페이지
│   │   │   ├── VideoListPage.jsx    # 비디오 목록 페이지
│   │   │   └── Navbar.jsx           # 네비게이션 바
│   │   ├── api/
│   │   │   └── api.js           # API 통신 함수
│   │   ├── App.jsx              # 메인 앱 컴포넌트
│   │   └── main.jsx             # React 앱 진입점
│   ├── package.json             # Node.js 의존성 관리
│   └── run.bat                  # 프론트엔드 실행 스크립트
├── video_files/                 # 비디오 파일 저장 디렉토리
└── db.sqlite3                   # SQLite 데이터베이스 파일
```

## 🚀 설치 및 실행

### 사전 요구사항
- Python 3.11 이상
- Node.js 18 이상
- Poetry (Python 패키지 관리자)

### 1. 백엔드 설정

```bash
cd apps/video/api
poetry install
```

### 2. 프론트엔드 설정

```bash
cd apps/video/ui
npm install
```

### 3. 애플리케이션 실행

#### Windows에서 실행
```bash
# 백엔드 실행 (새 터미널)
cd apps/video/api
run.bat

# 프론트엔드 실행 (새 터미널)
cd apps/video/ui
run.bat
```

#### 수동 실행
```bash
# 백엔드 (포트 8000)
cd apps/video/api/app
poetry run uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 프론트엔드 (포트 5173)
cd apps/video/ui
npm run dev
```

### 4. 접속
- **프론트엔드**: http://localhost:5173
- **백엔드 API**: http://localhost:8000
- **API 문서**: http://localhost:8000/docs

## 📊 데이터베이스 스키마

### Video 테이블
- `id`: 비디오 고유 ID
- `actor`: 배우/출연자
- `title`: 비디오 제목
- `filename`: 파일명
- `keywords`: 키워드 (JSON 배열)
- `fps`: 프레임 레이트

### VideoHistory 테이블
- `id`: 시청 기록 고유 ID
- `video_id`: 비디오 ID (외래키)
- `timestamp`: 시청 시간
- `current_time`: 재생 시점 (초)
- `thumbnail`: 썸네일 파일명
- `keywords`: 시청 시 추가된 키워드
- `is_favorite`: 즐겨찾기 여부

## 🔧 API 엔드포인트

### 비디오 관리
- `POST /upload-video/` - 비디오 업로드
- `GET /list-videos/` - 비디오 목록 조회
- `GET /video/{video_id}` - 특정 비디오 조회
- `POST /video-update/{video_id}` - 비디오 정보 수정
- `DELETE /video/{video_id}` - 비디오 삭제
- `POST /sync-video-files/` - 로컬 파일 동기화

### 시청 기록 관리
- `POST /history/` - 시청 기록 생성
- `GET /history/{video_id}` - 비디오별 시청 기록 조회
- `GET /favorites/` - 즐겨찾기 목록 조회
- `PUT /history/{history_id}/favorite` - 즐겨찾기 토글
- `DELETE /history/{history_id}` - 시청 기록 삭제

### 썸네일 관리
- `POST /history/{history_id}/thumbnail` - 개별 썸네일 생성
- `POST /history/batch-create-thumbnails` - 일괄 썸네일 생성

## 🎯 주요 기능 상세

### 비디오 파일 동기화
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

## 🔒 환경 설정

### 비디오 디렉토리 설정
`api/app/initserver.py`에서 `VIDEO_DIR` 경로를 설정할 수 있습니다:

```python
VIDEO_DIR = "path/to/your/video/files"
```

### 데이터베이스 설정
기본적으로 SQLite를 사용하며, `api/app/db.py`에서 데이터베이스 URL을 수정할 수 있습니다:

```python
DATABASE_URL = "sqlite:///./path/to/database.db"
```

## 🐛 문제 해결

### 일반적인 문제들

1. **비디오 파일이 표시되지 않음**
   - `video_files/` 디렉토리에 비디오 파일이 있는지 확인
   - 지원되는 형식인지 확인 (MP4, AVI, MKV, MOV, WMV, FLV)
   - 파일 동기화 버튼 클릭

2. **썸네일이 생성되지 않음**
   - OpenCV가 올바르게 설치되었는지 확인
   - 비디오 파일이 손상되지 않았는지 확인
   - 충분한 디스크 공간이 있는지 확인

3. **API 연결 오류**
   - 백엔드 서버가 실행 중인지 확인 (포트 8000)
   - CORS 설정 확인
   - 네트워크 연결 상태 확인

## 🤝 기여하기

1. 이 저장소를 포크합니다
2. 기능 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋합니다 (`git commit -m 'Add some amazing feature'`)
4. 브랜치에 푸시합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성합니다

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 👨‍💻 개발자

- **Jaehak Lee** - <leejaehak87@gmail.com>

---

**참고**: 이 애플리케이션은 로컬 환경에서 실행되도록 설계되었습니다. 프로덕션 환경에서 사용하려면 적절한 보안 설정과 데이터베이스 최적화가 필요합니다.
