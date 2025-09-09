import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { saveQuizRecordToLocal, getQuizRecordsFromLocal, getQuizStatisticsFromLocal, clearQuizRecords, exportQuizRecords, importQuizRecords } from '../api/quizRecords';
import { getRandomWordsToLearn } from '../api/api';
import { to_hiragana } from '../service/hangul-to-hiragana';
import './Quiz.css';


const Quiz = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { words = [], sourceText = '' } = location.state || {};

  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [userHangulType, setUserHangulType] = useState('');
  const [isCorrect, setIsCorrect] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [quizHistory, setQuizHistory] = useState([]);
  const [quizCount, setQuizCount] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [showDetailedResults, setShowDetailedResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [allQuizRecords, setAllQuizRecords] = useState([]);
  const [quizStatistics, setQuizStatistics] = useState(null);
  const [isLoadingRandomWords, setIsLoadingRandomWords] = useState(false);

  useEffect(() => {
    setUserAnswer(to_hiragana(userHangulType));
  }, [userHangulType]);

  // 퀴즈 유형 정의
  const quizTypes = [
    {
      id: 'word-meaning',
      name: '단어 ↔ 뜻 맞히기',
      description: '단어를 보고 뜻을 맞히거나, 뜻을 보고 단어를 맞히세요.'
    },
    //{
    //  id: 'translation',
    //  name: '예문 ↔ 뜻 번역하기',
    //  description: '일본어 예문을 한국어로 번역하거나, 한국어 뜻을 일본어로 번역하세요.'
    //}
  ];

  // 퀴즈 생성 함수들
  const generateWordMeaningQuiz = (word) => {
    const isWordToMeaning = Math.random() > 0.5;
    const otherWords = words.filter(w => w.word_id !== word.word_id);
    const options = [word.kr_mean];
    
    // 다른 단어들의 뜻을 옵션으로 추가
    while (options.length < 4 && otherWords.length > 0) {
      const randomWord = otherWords[Math.floor(Math.random() * otherWords.length)];
      if (!options.includes(randomWord.kr_mean)) {
        options.push(randomWord.kr_mean);
      }
      otherWords.splice(otherWords.indexOf(randomWord), 1);
    }
    
    // 옵션 셔플
    const shuffledOptions = options.sort(() => Math.random() - 0.5);
    
    return {
      type: 'word-meaning',
      question: isWordToMeaning ? word.word : word.kr_mean,
      correctAnswer: isWordToMeaning ? word.kr_mean : word.jp_pron,
      options: isWordToMeaning ? shuffledOptions : null,
      explanation: `${word.word} (${word.jp_pron}) - ${word.kr_mean}`,
      wordId: word.word_id
    };
  };

  const generateTranslationQuiz = (word) => {
    if (!word.examples || word.examples.length === 0) return null;
    
    const example = word.examples[Math.floor(Math.random() * word.examples.length)];
    const isJapaneseToKorean = Math.random() > 0.5;
    
    return {
      type: 'translation',
      question: isJapaneseToKorean ? example.jp_text : example.kr_mean,
      correctAnswer: isJapaneseToKorean ? example.kr_mean : example.jp_text,
      options: null,
      explanation: `${example.jp_text} - ${example.kr_mean}`,
      wordId: word.word_id
    };
  };

  // 새로운 퀴즈 생성
  const generateNewQuiz = () => {
    if (words.length === 0) return null;
    
    const randomWord = words[Math.floor(Math.random() * words.length)];
    const randomType = quizTypes[Math.floor(Math.random() * quizTypes.length)];
    
    let quiz = null;
    
    switch (randomType.id) {
      case 'word-meaning':
        quiz = generateWordMeaningQuiz(randomWord);
        break;
      case 'translation':
        quiz = generateTranslationQuiz(randomWord);
        break;
      default:
        quiz = generateWordMeaningQuiz(randomWord);
    }
    
    // 예문이 필요한 퀴즈인데 예문이 없는 경우 다른 유형으로 재시도
    if (!quiz && (randomType.id === 'translation')) {
      return generateNewQuiz();
    }
    
    return quiz;
  };

  // 퀴즈 시작
  const startQuiz = () => {
    const newQuiz = generateNewQuiz();
    if (newQuiz) {
      setCurrentQuiz(newQuiz);
      setUserAnswer('');
      setIsCorrect(null);
      setFeedback('');
      setStartTime(Date.now());
    }
  };

  // 답변 제출
  const submitAnswer = async () => {
    if (!userAnswer.trim() || !currentQuiz) return;
    
    const endTime = Date.now();
    const timeSpent = (endTime - startTime) / 1000; // 초 단위
    
    let correct = false;
    
    // 퀴즈 유형에 따른 정답 체크
    if (currentQuiz.type === 'sentence-order') {
      // 단어 배열 퀴즈: 공백만 정규화하고 순서는 유지
      const normalizeAnswer = (answer) => {
        return answer.trim().toLowerCase().replace(/\s+/g, ' ');
      };
      correct = normalizeAnswer(userAnswer) === normalizeAnswer(currentQuiz.correctAnswer);
    } else {
      // 일반적인 퀴즈: 정확한 문자열 비교
      correct = userAnswer.trim().toLowerCase() === currentQuiz.correctAnswer.toLowerCase();
    }
    setIsCorrect(correct);
    
    const feedbackText = correct 
      ? '정답입니다! 🎉' 
      : `틀렸습니다. 정답은 "${currentQuiz.correctAnswer}" 입니다.`;
    
    setFeedback(feedbackText);
    
    // 퀴즈 기록 저장
    const quizRecord = {
      wordId: currentQuiz.wordId,
      type: currentQuiz.type,
      isCorrect: correct,
      timeSpent: timeSpent,
      userAnswer: userAnswer.trim(),
      correctAnswer: currentQuiz.correctAnswer,
      timestamp: new Date().toISOString()
    };
    
    setQuizHistory(prev => [...prev, quizRecord]);
    setQuizCount(prev => prev + 1);
    
    // 로컬스토리지에 퀴즈 기록 저장
    saveQuizRecordToLocal(quizRecord);
  };

  // 다음 퀴즈로 이동
  const nextQuiz = () => {
    setTimeout(() => {
      startQuiz();
    }, 1500);
  };

  // 학습 종료
  const endStudy = () => {
    setShowResults(true);
    
    // 로컬스토리지에서 전체 퀴즈 기록과 통계 조회
    const records = getQuizRecordsFromLocal();
    const statistics = getQuizStatisticsFromLocal();
    
    setAllQuizRecords(records);
    setQuizStatistics(statistics);
  };

  // 결과 분석
  const getResults = () => {
    const totalQuizzes = quizHistory.length;
    const correctQuizzes = quizHistory.filter(q => q.isCorrect).length;
    const averageTime = quizHistory.reduce((sum, q) => sum + q.timeSpent, 0) / totalQuizzes;
    
    const typeStats = {};
    quizTypes.forEach(type => {
      const typeQuizzes = quizHistory.filter(q => q.type === type.id);
      if (typeQuizzes.length > 0) {
        typeStats[type.id] = {
          total: typeQuizzes.length,
          correct: typeQuizzes.filter(q => q.isCorrect).length,
          averageTime: typeQuizzes.reduce((sum, q) => sum + q.timeSpent, 0) / typeQuizzes.length
        };
      }
    });
    
    return {
      total: totalQuizzes,
      correct: correctQuizzes,
      accuracy: totalQuizzes > 0 ? (correctQuizzes / totalQuizzes * 100).toFixed(1) : 0,
      averageTime: averageTime.toFixed(1),
      typeStats
    };
  };

  // 무작위 단어 가져오기
  const fetchRandomWords = async () => {
    setIsLoadingRandomWords(true);
    try { 
      const response = await getRandomWordsToLearn(50);
      if (response.data && response.data.length > 0) {
        // location.state를 업데이트하여 새로운 단어들로 설정
        console.log(response.data, 'response.data');
        navigate('/quiz', { 
          state: { 
            words: response.data, 
            sourceText: '무작위 단어 50개' 
          },
          replace: true 
        });
      } else {
        alert('가져올 단어가 없습니다.');
      }
    } catch (error) {
      console.error('무작위 단어 가져오기 실패:', error);
      alert('단어를 가져오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingRandomWords(false);
    }
  };

  // 컴포넌트 마운트 시 첫 퀴즈 시작
  useEffect(() => {
    if (words.length > 0) {
      startQuiz();
    }
  }, []);

  // 단어가 없으면 메인 페이지로 리다이렉트
  if (words.length === 0) {
    return (
      <div className="quiz-container">
        <div className="quiz-header">
          <h1>단어 퀴즈</h1>
          <p>분석된 단어가 없습니다.</p>
          <div className="quiz-actions">
            <button 
              onClick={fetchRandomWords} 
              disabled={isLoadingRandomWords}
              className="btn-primary"
              style={{ marginBottom: '10px' }}
            >
              {isLoadingRandomWords ? '단어 가져오는 중...' : '학습할 단어 가져오기 (50개)'}
            </button>
            <button onClick={() => navigate('/word-analysis')} className="btn-secondary">
              단어 분석으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showResults) {
    const results = getResults();
    
    return (
      <div className="quiz-container">
        <div className="quiz-header">
          <h1>학습 결과</h1>
          <div className="results-summary">
            <div className="result-item">
              <span className="result-label">총 퀴즈 수:</span>
              <span className="result-value">{results.total}</span>
            </div>
            <div className="result-item">
              <span className="result-label">정답 수:</span>
              <span className="result-value">{results.correct}</span>
            </div>
            <div className="result-item">
              <span className="result-label">정답률:</span>
              <span className="result-value">{results.accuracy}%</span>
            </div>
            <div className="result-item">
              <span className="result-label">평균 소요 시간:</span>
              <span className="result-value">{results.averageTime}초</span>
            </div>
          </div>
          
          <div className="type-results">
            <h3>유형별 결과</h3>
            {Object.entries(results.typeStats).map(([typeId, stats]) => {
              const type = quizTypes.find(t => t.id === typeId);
              return (
                <div key={typeId} className="type-result">
                  <h4>{type.name}</h4>
                  <p>정답률: {((stats.correct / stats.total) * 100).toFixed(1)}% ({stats.correct}/{stats.total})</p>
                  <p>평균 시간: {stats.averageTime.toFixed(1)}초</p>
                </div>
              );
            })}
          </div>
          
          <div className="quiz-actions">
            <button onClick={() => setShowDetailedResults(true)} className="btn-primary">
              상세 기록 보기
            </button>
            <button onClick={() => setShowResults(false)} className="btn-secondary">
              계속 학습하기
            </button>
            <button onClick={() => navigate('/word-analysis')} className="btn-secondary">
              단어 분석으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showDetailedResults) {
    return (
      <div className="quiz-container">
        <div className="quiz-header">
          <h1>상세 학습 기록</h1>
          <div className="quiz-actions">
            <button onClick={() => setShowDetailedResults(false)} className="btn-secondary">
              결과 요약으로 돌아가기
            </button>
            <button onClick={() => navigate('/word-analysis')} className="btn-secondary">
              단어 분석으로 돌아가기
            </button>
            <button onClick={exportQuizRecords} className="btn-secondary" style={{ background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' }}>
              기록 내보내기
            </button>
            <button onClick={importQuizRecords} className="btn-secondary" style={{ background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)' }}>
              기록 가져오기
            </button>
            <button onClick={clearQuizRecords} className="btn-secondary" style={{ background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)' }}>
              기록 초기화
            </button>
          </div>
        </div>

        {quizStatistics && (
          <div className="detailed-results">
            <div className="statistics-section">
              <h2>전체 통계</h2>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">총 퀴즈 수</span>
                  <span className="stat-value">{quizStatistics.total_quizzes}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">정답 수</span>
                  <span className="stat-value">{quizStatistics.correct_quizzes}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">정답률</span>
                  <span className="stat-value">{quizStatistics.accuracy.toFixed(1)}%</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">평균 시간</span>
                  <span className="stat-value">{quizStatistics.avg_time_spent.toFixed(1)}초</span>
                </div>
              </div>
            </div>

            {quizStatistics.type_statistics && quizStatistics.type_statistics.length > 0 && (
              <div className="type-statistics-section">
                <h2>유형별 통계</h2>
                <div className="type-stats-grid">
                  {quizStatistics.type_statistics.map((typeStat, index) => (
                    <div key={index} className="type-stat-item">
                      <h3>{typeStat.type}</h3>
                      <div className="type-stat-details">
                        <p>총 퀴즈: {typeStat.total}</p>
                        <p>정답: {typeStat.correct}</p>
                        <p>정답률: {typeStat.accuracy.toFixed(1)}%</p>
                        <p>평균 시간: {typeStat.avg_time.toFixed(1)}초</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="records-section">
              <h2>최근 퀴즈 기록</h2>
              <div className="records-table">
                <table>
                  <thead>
                    <tr>
                      <th>단어</th>
                      <th>유형</th>
                      <th>정답 여부</th>
                      <th>소요 시간</th>
                      <th>사용자 답변</th>
                      <th>정답</th>
                      <th>날짜</th>
                    </tr>
                  </thead>
                  <tbody>
                                         {allQuizRecords.slice(0, 20).map((record, index) => (
                       <tr key={index} className={record.isCorrect ? 'correct-row' : 'incorrect-row'}>
                         <td>{`ID: ${record.wordId}`}</td>
                         <td>{record.type}</td>
                         <td>
                           <span className={`result-badge ${record.isCorrect ? 'correct' : 'incorrect'}`}>
                             {record.isCorrect ? '정답' : '오답'}
                           </span>
                         </td>
                         <td>{record.timeSpent.toFixed(1)}초</td>
                         <td>{record.userAnswer}</td>
                         <td>{record.correctAnswer}</td>
                         <td>{new Date(record.timestamp).toLocaleDateString()}</td>
                       </tr>
                     ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <h1>단어 퀴즈</h1>
        <div className="quiz-info">
          <span>퀴즈 수: {quizCount}</span>
          <span>정답률: {quizHistory.length > 0 ? ((quizHistory.filter(q => q.isCorrect).length / quizHistory.length) * 100).toFixed(1) : 0}%</span>
          <span>단어 수: {words.length}개</span>
        </div>
        <div className="quiz-actions">
          <button 
            onClick={fetchRandomWords} 
            disabled={isLoadingRandomWords}
            className="btn-secondary"
            style={{ marginRight: '10px' }}
          >
            {isLoadingRandomWords ? '단어 가져오는 중...' : '새로운 단어 가져오기'}
          </button>
          <button onClick={endStudy} className="btn-secondary">
            학습 종료
          </button>
        </div>
      </div>

      {currentQuiz && (
        <div className="quiz-content">
          <div className="quiz-type">
            {quizTypes.find(t => t.id === currentQuiz.type)?.name}
          </div>
          
          <div className="question-container">
            <h2 className="question">{currentQuiz.question}</h2>
            
            {currentQuiz.options && (
              <div className="options-container">
                {currentQuiz.options.map((option, index) => (
                  <button
                    key={index}
                    className={`option-btn ${userAnswer === option ? 'selected' : ''}`}
                    onClick={() => setUserAnswer(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
            
            {!currentQuiz.options && (
              <div className="answer-input">
                <h4>{userAnswer}</h4><br/>
                <input
                  type="text"
                  value={userHangulType}
                  onChange={(e) => setUserHangulType(e.target.value)}
                  placeholder="답을 입력하세요..."
                  className="answer-field"
                  onKeyPress={(e) => e.key === 'Enter' && submitAnswer()}
                />
              </div>
            )}
          </div>

          <div className="quiz-actions">
            {isCorrect === null ? (
              <button 
                onClick={submitAnswer} 
                disabled={!userAnswer.trim()}
                className="btn-primary"
              >
                답변 제출
              </button>
            ) : (
              <div className="feedback-container">
                <div className={`feedback ${isCorrect ? 'correct' : 'incorrect'}`}>
                  {feedback}
                </div>
                <div className="explanation">
                  <strong>해설:</strong> {currentQuiz.explanation}
                </div>
                <button onClick={nextQuiz} className="btn-primary">
                  다음 퀴즈
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Quiz;
