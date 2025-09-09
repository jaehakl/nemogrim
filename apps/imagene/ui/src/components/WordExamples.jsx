import React from 'react';
import ExampleCard from './ExampleCard';
import './WordExamples.css';

const WordExamples = ({ wordsSet }) => {
  if (!wordsSet || Object.keys(wordsSet).length === 0) {
    return null;
  }

  const copyToClipboard = () => {
    try {
      // TSV 헤더 생성
      const headers = ['ID','단어(기본형)', '레벨', '발음(히라가나)', '발음(한글)', '뜻(한국어)'];
      
      // TSV 데이터 생성
      const tsvData = Object.keys(wordsSet).map(word_id => 
          [
            word_id,
            wordsSet[word_id].word || '',
            wordsSet[word_id].level || '',
            wordsSet[word_id].jp_pron || '',
            wordsSet[word_id].kr_pron || '',
            wordsSet[word_id].kr_mean || '',
          ].join('\t'))        

      // 헤더와 데이터를 결합
      const fullTsv = [headers.join('\t'), ...tsvData].join('\n');
      
      // 클립보드에 복사
      navigator.clipboard.writeText(fullTsv).then(() => {
        alert('TSV 형식으로 클립보드에 복사되었습니다!');
      }).catch(err => {
        console.error('클립보드 복사 실패:', err);
        alert('클립보드 복사에 실패했습니다.');
      });
    } catch (error) {
      console.error('TSV 변환 오류:', error);
      alert('데이터 변환 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="word-examples-section">
      <h2>단어별 예문</h2>
      <button onClick={copyToClipboard} className="word-examples-copy-button">클립보드에 복사</button>
      <div className="word-examples-container">
        {Object.values(wordsSet).map((word, wordIndex) => (
          word.examples && !word.user_word_skills.some(skill => skill.reading > 80) && (
            <div 
              key={`word-${wordIndex}`} 
              className="word-examples-item"
            >
              <div className="word-examples-header">
                <h3 className="word-examples-title">
                  <span className="word-examples-lemma">{word.lemma}</span>
                  <span className="word-examples-level">({word.level})</span>
                </h3>
                <div className="word-examples-details">
                  <span className="word-examples-pronunciation">{word.jp_pron}</span>
                  <span className="word-examples-pronunciation">{word.kr_pron}</span>
                  <span className="word-examples-meaning">{word.kr_mean}</span>
                </div>
              </div>
              <div className="word-examples-list">
                {word.examples.map((example, exampleIndex) => (
                  <ExampleCard 
                    key={`example-${wordIndex}-${exampleIndex}`} 
                    example={example} 
                    isMain={false} 
                  />
                ))}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
};

export default WordExamples;
