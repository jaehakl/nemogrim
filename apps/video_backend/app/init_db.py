from db import Base, engine

def init_db():
    """데이터베이스 테이블을 생성합니다."""
    Base.metadata.create_all(bind=engine)
    print("데이터베이스 테이블이 성공적으로 생성되었습니다.")

if __name__ == "__main__":
    init_db() 