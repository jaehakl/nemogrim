// 로컬스토리지 관련 유틸리티 함수들
export const saveQuizRecordToLocal = (quizRecord) => {
    try {
      const existingRecords = JSON.parse(localStorage.getItem('quizRecords') || '[]');
      const newRecord = {
        ...quizRecord,
        id: Date.now() + Math.random(), // 고유 ID 생성
        timestamp: new Date().toISOString()
      };
      existingRecords.push(newRecord);
      localStorage.setItem('quizRecords', JSON.stringify(existingRecords));
      return newRecord;
    } catch (error) {
      console.error('로컬스토리지 저장 실패:', error);
      return null;
    }
  };

  export const getQuizRecordsFromLocal = (filters = {}) => {
    try {
      const records = JSON.parse(localStorage.getItem('quizRecords') || '[]');
      
      // 필터링 적용
      let filteredRecords = records;
      
      if (filters.word_id) {
        filteredRecords = filteredRecords.filter(r => r.wordId === filters.word_id);
      }
      
      if (filters.quiz_type) {
        filteredRecords = filteredRecords.filter(r => r.type === filters.quiz_type);
      }
      
      if (filters.is_correct !== undefined) {
        filteredRecords = filteredRecords.filter(r => r.isCorrect === filters.is_correct);
      }
      
      if (filters.start_date) {
        filteredRecords = filteredRecords.filter(r => r.timestamp >= filters.start_date);
      }
      
      if (filters.end_date) {
        filteredRecords = filteredRecords.filter(r => r.timestamp <= filters.end_date);
      }
      
      // 정렬 (최신순)
      filteredRecords.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // 제한 조건
      if (filters.limit) {
        const start = filters.offset || 0;
        filteredRecords = filteredRecords.slice(start, start + filters.limit);
      }
      
      return filteredRecords;
    } catch (error) {
      console.error('로컬스토리지 조회 실패:', error);
      return [];
    }
  };

  export const clearQuizRecords = () => {
    if (window.confirm('모든 퀴즈 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      localStorage.removeItem('quizRecords');
      setAllQuizRecords([]);
      setQuizStatistics(getQuizStatisticsFromLocal());
      alert('퀴즈 기록이 초기화되었습니다.');
    }
  };

  export const exportQuizRecords = () => {
    try {
      const records = localStorage.getItem('quizRecords') || '[]';
      const blob = new Blob([records], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quiz-records-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert('퀴즈 기록이 내보내기되었습니다.');
    } catch (error) {
      console.error('내보내기 실패:', error);
      alert('내보내기에 실패했습니다.');
    }
  };

  export const importQuizRecords = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const records = JSON.parse(event.target.result);
            if (Array.isArray(records)) {
              localStorage.setItem('quizRecords', JSON.stringify(records));
              setAllQuizRecords(getQuizRecordsFromLocal());
              setQuizStatistics(getQuizStatisticsFromLocal());
              alert('퀴즈 기록이 가져와졌습니다.');
            } else {
              alert('올바른 형식의 파일이 아닙니다.');
            }
          } catch (error) {
            console.error('가져오기 실패:', error);
            alert('파일을 읽는 중 오류가 발생했습니다.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  export const getQuizStatisticsFromLocal = (filters = {}) => {
    try {
      const records = JSON.parse(localStorage.getItem('quizRecords') || '[]');
      
      // 필터링 적용
      let filteredRecords = records;
      
      if (filters.word_id) {
        filteredRecords = filteredRecords.filter(r => r.wordId === filters.word_id);
      }
      
      if (filters.quiz_type) {
        filteredRecords = filteredRecords.filter(r => r.type === filters.quiz_type);
      }
      
      if (filters.start_date) {
        filteredRecords = filteredRecords.filter(r => r.timestamp >= filters.start_date);
      }
      
      if (filters.end_date) {
        filteredRecords = filteredRecords.filter(r => r.timestamp <= filters.end_date);
      }
      
      const totalQuizzes = filteredRecords.length;
      const correctQuizzes = filteredRecords.filter(r => r.isCorrect).length;
      const avgTimeSpent = totalQuizzes > 0 
        ? filteredRecords.reduce((sum, r) => sum + r.timeSpent, 0) / totalQuizzes 
        : 0;
      
      // 유형별 통계
      const typeStats = {};
      filteredRecords.forEach(record => {
        if (!typeStats[record.type]) {
          typeStats[record.type] = {
            total: 0,
            correct: 0,
            totalTime: 0
          };
        }
        typeStats[record.type].total++;
        if (record.isCorrect) {
          typeStats[record.type].correct++;
        }
        typeStats[record.type].totalTime += record.timeSpent;
      });
      
      const typeStatistics = Object.entries(typeStats).map(([type, stats]) => ({
        type,
        total: stats.total,
        correct: stats.correct,
        accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
        avg_time: stats.total > 0 ? stats.totalTime / stats.total : 0
      }));
      
      return {
        total_quizzes: totalQuizzes,
        correct_quizzes: correctQuizzes,
        accuracy: totalQuizzes > 0 ? (correctQuizzes / totalQuizzes) * 100 : 0,
        avg_time_spent: avgTimeSpent,
        min_time_spent: totalQuizzes > 0 ? Math.min(...filteredRecords.map(r => r.timeSpent)) : 0,
        max_time_spent: totalQuizzes > 0 ? Math.max(...filteredRecords.map(r => r.timeSpent)) : 0,
        type_statistics: typeStatistics
      };
    } catch (error) {
      console.error('로컬스토리지 통계 조회 실패:', error);
      return {
        total_quizzes: 0,
        correct_quizzes: 0,
        accuracy: 0,
        avg_time_spent: 0,
        min_time_spent: 0,
        max_time_spent: 0,
        type_statistics: []
      };
    }
  };