import React, { useState, useEffect, useMemo } from 'react';
import { getUserWordSkillsUser, createWordsPersonal, deleteWordsBatch } from '../api/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './UserWordSkills.css';
import WordInputModal from '../components/WordInputModal';

const LEVELS_ORDER = ['N5', 'N4', 'N3', 'N2', 'N1'];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const COLORS = {
  N1: '#5B8FF9',
  N2: '#61DDAA',
  N3: '#65789B',
  N4: '#F6BD16',
  N5: '#7262fd',
};

const UserWordSkills = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedWord, setSelectedWord] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getUserWordSkillsUser();
      setRawData(res?.data || null);
      setError(null);
    } catch (e) {
      console.error(e);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLemmaClick = (w) => {
    // WordInputModal에서 기대하는 형태로 변환
    const wordForModal = {
      word_id: w.id,
      lemma_id: w.lemma_id || '',
      lemma: w.lemma,
      jp_pron: w.jp_pron,
      kr_pron: w.kr_pron,
      kr_mean: w.kr_mean,
      level: w.level,
      user_word_skills: [
        {
          reading: w.reading,
          listening: w.listening,
          speaking: w.speaking,
        },
      ],
      user_id: rawData?.user_id,
    };
    setSelectedWord(wordForModal);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedWord(null);
  };

  const handleAddOrUpdateWord = async (formData) => {
    try {
      await createWordsPersonal(formData);
      await fetchData();
    } catch (error) {
      console.error('단어 저장 오류:', error);
      alert('단어 저장 중 오류가 발생했습니다.');
    } finally {
      handleCloseModal();
    }
  };

  const handleDeleteWord = async (wordId) => {
    try {
      const response = await deleteWordsBatch([wordId]);
      if (response?.status === 200) {
        alert('단어가 성공적으로 삭제되었습니다.');
      }
      await fetchData();
    } catch (error) {
      console.error('단어 삭제 오류:', error);
      alert('단어 삭제 중 오류가 발생했습니다.');
    } finally {
      handleCloseModal();
    }
  };

  const { skilledWordsByLevel, timeSeries } = useMemo(() => {
    const result = { skilledWordsByLevel: {}, timeSeries: [] };
    if (!rawData || !rawData.learned_words) return result;

    // 1) 레벨별 숙련 단어 필터링 (reading >= 80, updated_at 존재)
    const byLevel = {};
    LEVELS_ORDER.forEach((lv) => (byLevel[lv] = []));

    Object.entries(rawData.learned_words).forEach(([levelKey, words]) => {
      words.forEach((w) => {
        const reading = Number(w.reading ?? 0);
        if (reading >= 80 && w.updated_at) {
          const dt = new Date(w.updated_at);
          if (!isNaN(dt.getTime())) {
            byLevel[levelKey].push({ ...w, _skilledAt: startOfDay(dt) });
          }
        }
      });
    });

    // 2) 레벨별 숙련 일자 배열 (오름차순)
    const levelDates = {};
    LEVELS_ORDER.forEach((lv) => {
      levelDates[lv] = byLevel[lv]
        .map((w) => w._skilledAt)
        .sort((a, b) => a - b);
    });

    // 3) 전체 구간의 날짜 범위 산출
    const allDates = LEVELS_ORDER.flatMap((lv) => levelDates[lv]);
    if (allDates.length === 0) {
      return { skilledWordsByLevel: byLevel, timeSeries: [] };
    }
    const minDate = startOfDay(new Date(Math.min(...allDates)));
    const maxDate = startOfDay(new Date(Math.max(...allDates)));

    // 하루 단위로 전 구간 날짜 생성
    const days = [];
    for (let d = new Date(minDate); d <= maxDate; d = addDays(d, 1)) {
      days.push(startOfDay(d));
    }

    // 4) 투 포인터로 누적 개수 계산
    const indices = Object.fromEntries(LEVELS_ORDER.map((lv) => [lv, 0]));
    const series = days.map((day) => {
      const row = { date: formatYYYYMMDD(day) };
      LEVELS_ORDER.forEach((lv) => {
        const dates = levelDates[lv];
        let i = indices[lv];
        while (i < dates.length && dates[i] <= day) i += 1;
        indices[lv] = i;
        row[lv] = i; // 누적 개수
      });
      return row;
    });

    return { skilledWordsByLevel: byLevel, timeSeries: series };
  }, [rawData]);

  if (loading) {
    return <div className="user-word-skills-page"><div className="loading">불러오는 중...</div></div>;
  }

  if (error) {
    return <div className="user-word-skills-page"><div className="error">{error}</div></div>;
  }

  const totalSkilled = LEVELS_ORDER.reduce((sum, lv) => sum + (skilledWordsByLevel[lv]?.length || 0), 0);

  return (
    <div className="user-word-skills-page">
      <div className="header">
        <h1>숙련 단어 추이</h1>
        <div className="meta">
          <span>숙련 기준: 읽기 ≥ 80</span>
          <span>총 숙련 단어: {totalSkilled}개</span>
        </div>
      </div>

      <div className="card">
        <h2>누적 영역 차트 (난이도별)</h2>
        <div className="chart-container">
          {timeSeries.length === 0 ? (
            <div className="empty">숙련된 단어가 없습니다.</div>
          ) : (
            <ResponsiveContainer width="100%" height={380}>
              <AreaChart data={timeSeries} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="N1" stackId="1" stroke={COLORS.N1} fill={COLORS.N1} />
                <Area type="monotone" dataKey="N2" stackId="1" stroke={COLORS.N2} fill={COLORS.N2} />
                <Area type="monotone" dataKey="N3" stackId="1" stroke={COLORS.N3} fill={COLORS.N3} />
                <Area type="monotone" dataKey="N4" stackId="1" stroke={COLORS.N4} fill={COLORS.N4} />
                <Area type="monotone" dataKey="N5" stackId="1" stroke={COLORS.N5} fill={COLORS.N5} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="legend-note">X축: 일(day), Y축: 해당 날짜까지의 숙련 단어 누적 수</div>
      </div>

      <div className="card">
        <h2>난이도별 숙련 단어 (lemma)</h2>
        <div className="lemma-grid">
          {LEVELS_ORDER.map((lv) => (
            <div className="lemma-level" key={lv}>
              <div className="level-header">
                <span className="level-badge" style={{ backgroundColor: COLORS[lv] }}>{lv.toUpperCase()}</span>
                <span className="level-count">{skilledWordsByLevel[lv]?.length || 0}개</span>
              </div>
              <div className="lemma-list">
                {(skilledWordsByLevel[lv] || []).map((w) => (
                  <span className="lemma-chip" key={`${lv}-${w.id}`} onClick={() => handleLemmaClick(w)}>{w.lemma}</span>
                ))}
                {(skilledWordsByLevel[lv] || []).length === 0 && (
                  <span className="empty">없음</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <WordInputModal
        word={selectedWord}
        isOpen={showModal}
        onClose={handleCloseModal}
        onSubmit={handleAddOrUpdateWord}
        onDelete={handleDeleteWord}
      />
    </div>
  );
};

export default UserWordSkills;
