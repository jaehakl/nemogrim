import { useState, useEffect } from 'react';
import { 
  fetchFigure, updateFigure,
} from '../api/api';

// 공통 단일 항목 훅
function useItem(fetchFn, updateFn, id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchFn(id)
      .then(res => setData(res.data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id, fetchFn]);

  const save = async (updateData) => {
    setLoading(true);
    try {
      await updateFn(updateData);
      await fetchFn(id).then(res => setData(res.data));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, save };
}

// Figure 훅
export function useFigure(figureId) {
  return useItem(fetchFigure, updateFigure, figureId);
}

