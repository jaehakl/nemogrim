import React, { useState, useEffect } from 'react';
import { to_hiragana } from '../service/hangul-to-hiragana';
import './WordInputModal.css';
import { useUser } from '../contexts/UserContext';

const WordInputModal = ({ word, isOpen, onClose, onSubmit, onDelete }) => {
  const { user } = useUser();
  const [wordForm, setWordForm] = useState({
    lemma_id: '',
    lemma: '',
    jp_pron: '',
    kr_pron: '',
    kr_mean: '',
    level: 'N1',
    tags: '',
    reading_mastered: false,
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileTags, setFileTags] = useState([]);

  // word prop이 변경될 때마다 폼 데이터 초기화
  useEffect(() => {
    if (word) {
      const formData = {
        lemma_id: word.lemma_id || '',
        lemma: word.lemma || '',
        jp_pron: word.jp_pron || '',
        kr_pron: word.kr_pron || '',
        kr_mean: word.kr_mean || '',
        level: word.level || 'N1',
        reading_mastered: false,
      };
      word.user_word_skills.forEach(skill => {
        if (skill.reading > 80) {
          formData.reading_mastered = true;
        }
      });
      setWordForm(formData);
    }
  }, [word]);

  // 폼 입력 처리
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    if (name === 'kr_pron') {
      const kana = to_hiragana(value);
      setWordForm(prev => ({
        ...prev,
        'jp_pron': kana,
        'kr_pron': value
      }));
    } else if (name === 'reading_mastered') {
      setWordForm(prev => ({
        ...prev,
        [name]: !prev.reading_mastered
      }));
    } else {
      setWordForm(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // 파일 선택 처리
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    
    // 파일별로 태그 초기화
    const initialTags = files.map(file => ({
      lemma_id: wordForm.lemma_id,
      lemma: wordForm.lemma,
    }));
    setFileTags(initialTags);
  };

  // 파일 태그 변경 처리
  const handleFileTagChange = (index, value) => {
    const newFileTags = [...fileTags];
    newFileTags[index] = { ...newFileTags[index], lemma_id: wordForm.lemma_id, lemma: wordForm.lemma };
    setFileTags(newFileTags);
  };

  // 폼 제출 처리
  const handleSubmit = () => {
    if (!wordForm.lemma.trim()) {
      alert('단어를 입력해주세요.');
      return;
    }

    console.log(wordForm);
    // FormData 생성
    const fd = new FormData();
    fd.append("data_json", JSON.stringify([wordForm]));
    
    // 파일 메타데이터 추가
    const fileMetaData = selectedFiles.map((file, index) => ({
      lemma_id: wordForm.lemma_id,
      lemma: wordForm.lemma,
      tags: fileTags[index]?.tags || wordForm.tags
    }));
    fd.append("file_meta_json", JSON.stringify(fileMetaData));
    
    // 파일들 추가
    selectedFiles.forEach(file => {
      fd.append("files", file);
    });

    onSubmit(fd);
    handleClose();
  };

  // 삭제 처리
  const handleDelete = () => {
    if (window.confirm('정말로 이 단어를 삭제하시겠습니까?')) {
      onDelete(word.word_id);
      handleClose();
    }
  };

  // 모달 닫기
  const handleClose = () => {
    setWordForm({
      lemma_id: '',
      lemma: '',
      jp_pron: '',
      kr_pron: '',
      kr_mean: '',
      level: 'N1',
      tags: '',
      reading_mastered: false,
    });
    setSelectedFiles([]);
    setFileTags([]);
    onClose();
  };

  if (!isOpen) return null;

  return (    
    <div className="word-input-modal-overlay">
      <div className="word-input-modal-content">
        <div className="word-input-modal-body">
          <div className="word-input-modal-form-row">
            <div className="word-input-modal-form-group">
              <h2 className="word-input-modal-word">{wordForm.lemma}</h2>
            </div>
            <div className="word-input-modal-form-group">
              <label>일본어 발음:</label>
              <input
                type="text"
                name="jp_pron"
                value={wordForm.jp_pron}
                onChange={handleFormChange}
                placeholder="일본어 발음을 입력하세요"
              />
            </div>
          </div>
          <div className="word-input-modal-form-row">
          <div className="word-input-modal-form-group">
             <label>한국어 뜻:</label>
              <input
                type="text"
                name="kr_mean"
                value={wordForm.kr_mean}
                onChange={handleFormChange}
                placeholder="한국어 뜻을 입력하세요"
              />
            </div>

            <div className="word-input-modal-form-group">
              <label>한국어 발음:</label>
              <input
                type="text"
                name="kr_pron"
                value={wordForm.kr_pron}
                onChange={handleFormChange}
                placeholder="한국어 발음을 입력하세요"
              />
            </div>
          </div>
          <div className="word-input-modal-form-row">

            <div className="word-input-modal-form-group">
              <label>난이도:</label>
              <select
                name="level"
                value={wordForm.level}
                onChange={handleFormChange}                  
              >
                <option value="N5">(N5) 초급</option>
                <option value="N4">(N4) 초중급</option>
                <option value="N3">(N3) 중급</option>
                <option value="N2">(N2) 중고급</option>
                <option value="N1">(N1) 고급</option>
              </select>
            </div>
            </div>
        </div>
        <div className="word-input-modal-footer">
          <div className="word-input-modal-footer-left">
            {word?.user_id === user?.id && (
              <button onClick={handleDelete} className="word-input-modal-delete-btn">
                삭제
              </button>
            )}
            <input type="checkbox" name="reading_mastered" checked={wordForm.reading_mastered} onChange={handleFormChange} />
            <label>Master</label>
            {!(user && user.roles.includes('user')) && (
              <h5>로그인 후 저장 가능합니다.</h5>
            )}
          </div>
          <div className="word-input-modal-footer-right">
            <button onClick={handleClose} className="word-input-modal-cancel-btn">
              취소
            </button>
            {user && user.roles.includes('user') && (
            <button onClick={handleSubmit} className="word-input-modal-add-btn">
              {word?.user_id === user?.id ? '수정' : '추가'}
            </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WordInputModal;
