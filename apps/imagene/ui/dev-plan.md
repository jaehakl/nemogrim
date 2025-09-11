- App 전체
    - ImageFilterData BaseModel과 같은 imageFilterData State 가 있고, imageFilterData 가 변경될 때 마다 filterImages API 를 활용하여 이미지 목록을 가져옴. 가져온 데이터는 Contents 영역으로 보냄.
        * 활용 API : filterImages

- Sidebar 영역
    - 맨 위에는 image 생성 버튼이 있고, 누르면 'image 생성 모달' 표시
    - Group 목록을 가져와서 각각 toggle 가능한 버튼들로 표시(이때, 미리보기 이미지 5장 정도를 버튼에서 보여줌)
        * 활용 API : getGroupPreviewBatch
        - Group toggle 시, 선택된 Group 들의 name 을 list 로 만들어 imageFilterData.group_names 에 set
    - keyword 목록을 가져와서 각각 toggle 가능한 버튼들로 표시 (key 값별, n_created 순 정렬)
        * 활용 API : sortKeywordsByKey
	    - keyword toggle 시, 선택된 keyword 들의 value 를 , 로 구분된 문자열로 합쳐, imageFilterData.search_value 값으로 set

- Content 영역
    - Group 별로 패널을 넣고 각 패널에 Group 의 이미지들을 모두 표시 ("_ungrouped_" Group 패널도 표시하되, 디자인은 차별화되게)
        * 패널에는 클라이언트 자체에서 페이지네이션 기능 구현 (즉,image 데이터는 모두 있더라도 <img src> 로 표시하는 것은 조금씩 보여주게 )
    - 표시된 이미지는 체크하여 선택 후 일괄 상호작용 가능
        - 삭제 : deleteImagesBatch API 사용
        - 그룹 지정 : setImageGroupBatch API 사용
            - 선택된 채로 Group 생성 버튼을 누르면 Group 명 입력 모달 팝업 > 입력 후 제출
            - Drag 하여 다른 Group 패널에 Drop 하면 해당 Group 명으로 입력 후 제출
            - 선택된 이미지가 없을 때, 이미지 하나만 마우스로 Drag 하여 다른 패널에 Drop 하면 해당 이미지 하나만 제출

- image 생성 모달(Form)
    - 편집하는 데이터 
        - positive_keywords (str): textarea, 
        - negative_keywords (str): textarea,
        - steps (0~50 사이의 int): 숫자 입력 막대
        - cfg (0~10 사이의 float): 숫자 입력 막대 (1 tick : 0.1)
        - height (int), width (int) : input
    - onSubmit
        제출할 데이터 : dna = [] (리스트 형태)
        1. positive_keywords.split(",") 한 후, 각각을 {"key":"default", "value":value, "direction":1} 로 하여 dna 에 순서대로 append
        2. positive_keywords.split(",") 한 후, 각각을 {"key":"default", "value":value, "direction":-1} 로 하여 dna 에 순서대로 append
        3. {"key":"steps", "value": int(steps), "direction":0} append to dna
        4. {"key":"cfg", "value": float(cfg), "direction":0} append to dna
        5. {"key":"height", "value": int(height), "direction":0} append to dna
        6. {"key":"width", "value": int(width), "direction":0} append to dna
        
        7. 완성된 dna 를 createImage API 로 전송
