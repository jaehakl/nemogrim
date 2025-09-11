1. 모든 스타일 관련 코드는 CSS 파일로 분리한다.
2. CSS 파일은 각 jsx 파일 마다 동일한 '파일명'에 확장자만 바꿔서 생성한다.
3. 각 파일의 CSS 파일의 class 이름은 반드시 '파일명' 으로 시작해야 한다. (e.g.: "imageViewer.css >> .image-viewer-header, .image-viewer-button )
4. App.jsx 는 최대한 짧게 유지한다. Page 는 App.jsx 에 절대로 직접 구현하지 말고 pages 폴더에 정의하여 import 한다.
5. page 들의 구현도, 가급적 3개 정도의 components 로 나누어 components 폴더에 정의하여 import 한다.

