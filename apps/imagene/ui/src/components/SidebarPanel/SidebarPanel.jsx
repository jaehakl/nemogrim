import React, { useMemo, useState, useRef } from 'react';
import { Button, Divider, Stack } from 'rsuite';
import { useImageFilter } from '../../contexts/ImageFilterContext';
import { CustomTagPicker } from '../CustomTagPicker/CustomTagPicker';
import { ImageGenModal } from '../ImageGenModal/ImageGenModal';
import './SidebarPanel.css';

export const SidebarPanel = () => {
  const {
    imagesByGroup,
    groupPreview,
    keywordsByKey,
    selectedKeywords,
    toggleGroupName,
    setSearchFromKeywords,
    bulkDeleteKeywords,
    refreshImages,
  } = useImageFilter();

  const [openGen, setOpenGen] = useState(false);
  const [isRandomGenerating, setIsRandomGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const autoGenerateRef = useRef(false);

  // 무작위 키워드 선택 함수
  const getRandomKeywords = (keyType, count = 40) => {
    if (!keywordsByKey || !keywordsByKey[keyType]) return [];
    
    const keywords = keywordsByKey[keyType];
    const shuffled = [...keywords].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).map(kw => kw.value);
  };

  // 랜덤 이미지 생성 함수
  const generateRandomImages = async (nGen = 1) => {    
    // 무작위 설정값 생성
    const randomSteps = Math.floor(Math.random() * 31) + 20; // 20-50
    const randomCfg = Math.round((Math.random() * 5 + 5) * 10) / 10; // 5.0-10.0
    const randomHeight = [512, 768, 1024, 1280][Math.floor(Math.random() * 5)];
    const randomWidth = [512, 768, 1024, 1280, 1536][Math.floor(Math.random() * 5)];

    const dnaList = [];

    for (let i = 0; i < nGen; i++) {
    
      const randomPositivePromptLength = Math.floor(Math.random() * 31) + 1; // 1-30
      const randomNegativePromptLength = Math.floor(Math.random() * 21) + 1; // 1-20
      // 무작위 키워드 생성
      const randomPositive = getRandomKeywords('positive', randomPositivePromptLength);
      const randomNegative = getRandomKeywords('negative', randomNegativePromptLength);

      // DNA 배열 생성
      const dna = [];
      
      randomPositive.forEach((value) => {
        dna.push({ key: 'positive', value, direction: 1 });
      });
      
      randomNegative.forEach((value) => {
        dna.push({ key: 'negative', value, direction: -1 });
      });
      
      dna.push({ key: 'steps', value: String(randomSteps), direction: 0 });
      dna.push({ key: 'cfg', value: String(randomCfg), direction: 0 });
      dna.push({ key: 'height', value: String(randomHeight), direction: 0 });
      dna.push({ key: 'width', value: String(randomWidth), direction: 0 });
      dna.push({ key: 'len_positive_prompt', value: String(randomPositivePromptLength), direction: 0 });
      dna.push({ key: 'len_negative_prompt', value: String(randomNegativePromptLength), direction: 0 });
      dnaList.push(dna);
    }
    console.log("dnaList", dnaList);

    // API 호출
    const { createImagesBatch } = await import('../../api/api');
    await createImagesBatch(dnaList);
    
    // 이미지 목록 새로고침
    await refreshImages();
  };

  // 자동 랜덤 생성 루프 시작/중지
  const toggleRandomGeneration = async () => {
    if (isRandomGenerating) {
      // 중지 - ref를 먼저 false로 설정
      autoGenerateRef.current = false;
      // 상태 업데이트는 다음 렌더링에서 처리
      setTimeout(() => {
        setIsRandomGenerating(false);
      }, 100);
    } else {
      // 시작
      setIsRandomGenerating(true);
      setGeneratedCount(0);
      autoGenerateRef.current = true;
      
      const autoGenerateLoop = async () => {
        while (autoGenerateRef.current) {
          try {
            // 무작위 이미지 생성
            await generateRandomImages(16);
            
            // 생성 카운트 증가
            setGeneratedCount(prev => prev + 1);
            
            // 다음 생성 전 잠시 대기 (서버 부하 방지)
            await new Promise(resolve => setTimeout(resolve, 2000));
            
          } catch (error) {
            console.error('자동 랜덤 생성 중 오류 발생:', error);
            // 오류가 발생해도 계속 진행
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        // 루프가 종료되면 상태 업데이트
        setIsRandomGenerating(false);
      };
      
      autoGenerateLoop();
    }
  };

  const keywordOptions = useMemo(() => {
    const list = [];
    const seenValues = new Set();
    
    Object.entries(keywordsByKey || {}).forEach(([key, arr]) => {
      arr.sort((a, b) => (b.n_created || 0) - (a.n_created || 0));
      arr.forEach((kw) => {
        let value = `${key}:${kw.value}`;
        if (!seenValues.has(value)) {
          seenValues.add(value);
          list.push({ label: kw.value, value: value, 
                      del_rate: kw.del_rate });
        }
      });
    });
    return list;
  }, [keywordsByKey]);

  return (
    <div className="SidebarPanel">
      <div className="SidebarPanel-header">
        <Stack spacing={10}>
          <Button appearance="primary" block onClick={() => setOpenGen(true)}>
            이미지 생성
          </Button>
          <Button 
            appearance={isRandomGenerating ? "primary" : "ghost"}
            color={isRandomGenerating ? "red" : "orange"}
            block 
            onClick={toggleRandomGeneration}
            //loading={isRandomGenerating}
          >
            {isRandomGenerating ? `⏹️ 중단 (${generatedCount}개 생성됨)` : '🎲 랜덤 생성 시작'}
          </Button>
          {selectedKeywords.length > 0 && (
            <Button 
              appearance="subtle" 
              color="red" 
              block 
              onClick={bulkDeleteKeywords}
            >
              키워드 삭제 ({selectedKeywords.length}개)
            </Button>
          )}
        </Stack>
      </div>

      <Divider>Groups</Divider>
      <div className="SidebarPanel-groups">
        {Object.entries(groupPreview || {}).map(([groupName, images]) => {
          const hasImages = imagesByGroup && imagesByGroup[groupName] && imagesByGroup[groupName].length > 0;
          const includeUngrouped = imagesByGroup && imagesByGroup['_ungrouped_'];
          return (
            <button 
              key={groupName} 
              className={`SidebarPanel-groupbtn ${hasImages && !includeUngrouped ? 'SidebarPanel-groupbtn--selected' : 'SidebarPanel-groupbtn--not-selected'}`} 
              onClick={() => toggleGroupName(groupName)}
            >
              <div className="SidebarPanel-groupname">{groupName}</div>
              <div className="SidebarPanel-groupthumbs">
                {(images || []).slice(0, 5).map((img, index) => (
                  <img key={`${groupName}-${img.id}-${index}`} src={"http://localhost:8000/"+img.url} alt={groupName} />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <Divider>Keywords</Divider>
      <CustomTagPicker
        data={keywordOptions}
        value={selectedKeywords}
        onChange={(vals) => setSearchFromKeywords(vals || [])}
        placeholder="키워드 선택"
        searchable
      />

      <ImageGenModal open={openGen} onClose={() => setOpenGen(false)} />
    </div>
  );
};