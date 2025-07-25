import cv2
import os
from PIL import Image
import io
from typing import Optional
from pathlib import Path
from initserver import VIDEO_DIR

class ThumbnailService:
    @staticmethod
    def create_thumbnail_from_video(video_path: str, timestamp: float, duration: float = 15.0, video_fps: float = 29.97) -> Optional[str]:
        """
        비디오에서 특정 시간부터 15초간의 썸네일을 생성합니다.
        
        Args:
            video_path: 비디오 파일 경로
            timestamp: 시작 시간 (초)
            duration: 썸네일 생성할 시간 (초)
            video_duration: 비디오 총 길이 (초)
        Returns:
            생성된 썸네일 파일 경로 또는 None
        """
        try:
            # 비디오 파일 열기
            print("비디오 파일 열기")
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                print(f"비디오 파일을 열 수 없습니다: {video_path}")
                return None
            
            # 비디오 정보 가져오기 
            print("비디오 정보 가져오기")   
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = video_fps

            # 시작 프레임 계산
            meta_fps = cap.get(cv2.CAP_PROP_FPS)
            start_frame = int(timestamp * fps)
            end_frame = min(start_frame + int(duration * fps), total_frames)
            print("start_frame:",start_frame, "end_frame:",end_frame)
                        
            cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
            print("시작 위치로 이동했습니다.")

            # 프레임들을 저장할 리스트
            frames = []
            # 지정된 시간 동안 프레임들을 읽어옴
            for frame_idx in range(start_frame, end_frame):
                ret, frame = cap.read()
                if not ret:
                    break
                    
                # BGR에서 RGB로 변환
                #frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                #frames.append(frame_rgb)
                frames.append(frame)
            
            cap.release()
            
            if not frames:
                print("프레임을 읽을 수 없습니다.")
                return None
                        
            # 썸네일 파일명 생성 (비디오 파일명 + 타임스탬프)
            video_name = Path(video_path).stem
            thumbnail_filename = f"{video_name}_{int(timestamp)}s.webp"
            thumbnail_path = os.path.join(VIDEO_DIR, thumbnail_filename)
            
            # 모든 프레임을 PIL Image로 변환하고 크기 조정
            pil_frames = []
            target_width = 320
            
            for frame in frames:
                # BGR에서 RGB로 변환 (이미 변환되어 있지만 확실히 하기 위해)
                if len(frame.shape) == 3 and frame.shape[2] == 3:
                    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                else:
                    frame_rgb = frame
                
                pil_image = Image.fromarray(frame_rgb)
                
                # 썸네일 크기 조정 (가로 320px, 비율 유지)
                aspect_ratio = pil_image.width / pil_image.height
                target_height = int(target_width / aspect_ratio)
                
                pil_image = pil_image.resize((target_width, target_height), Image.Resampling.LANCZOS)
                pil_frames.append(pil_image)
            
            # 애니메이션 WebP로 저장
            if pil_frames:
                # 첫 번째 프레임을 기본으로 하고 나머지를 애니메이션으로 추가
                pil_frames[0].save(
                    thumbnail_path,
                    "WEBP",
                    save_all=True,
                    append_images=pil_frames[1:],
                    duration=int(1000 / meta_fps),  # 프레임 간격 (밀리초)
                    loop=0,  # 무한 반복
                    quality=85,
                    optimize=True
                )
            
            return str(thumbnail_filename)
            
        except Exception as e:
            print(f"썸네일 생성 중 오류 발생: {str(e)}")
            return None
    
    @staticmethod
    def delete_thumbnail(thumbnail_path: str) -> bool:
        """
        썸네일 파일을 삭제합니다.
        
        Args:
            thumbnail_path: 삭제할 썸네일 파일 경로
            
        Returns:
            삭제 성공 여부
        """
        try:
            if os.path.exists(thumbnail_path):
                os.remove(thumbnail_path)
                return True
            return False
        except Exception as e:
            print(f"썸네일 삭제 중 오류 발생: {str(e)}")
            return False 