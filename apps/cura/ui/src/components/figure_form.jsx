import React, { useState, useEffect, useRef } from 'react';
import { Container, Content, Sidebar, Button, Form, Input } from 'rsuite';
import { useNavigate } from 'react-router-dom';
import { getRandomPrompt } from '../api/api';
import { addFigure, deleteFigure } from '../api/api';

// Figure 테이블의 컬럼명 (embedding, file_path, id 제외) + 한글 라벨, 그룹별

const FIGURE_FIELDS = {
    "상태": {
        action: "행동",
        girl_type: "직업",
        girl_emotion: "기분",
    },
    "여성": {
        girl_head: "얼굴",
        girl_body: "체형",
        girl_pose: "자세",
    },
    "의상":{
        girl_top: "상의",
        girl_bottom: "하의",
        girl_underwear: "속옷",
    },
    "상황":{
        people: "인물",
        situation: "상황",
        background: "배경",
    }
  };
  
  export default function FigureForm({ defaultPrompt, onPromptChange, onSave }) {
    const [formValue, setFormValue] = useState({});
    const [file, setFile] = useState(null);
    const [filePreviewUrl, setFilePreviewUrl] = useState(null);

    const handleFileChange = (e) => {
      const f = e.target.files[0];    
      setFile(f);
      if (f && f.type.startsWith("image/")) {
        setFilePreviewUrl(URL.createObjectURL(f));
      }
    };
  
    // prompt 생성 (모든 그룹 필드 순회)
    let prompt = '';
    Object.entries(FIGURE_FIELDS).forEach(([group]) => {
        let group_prompt = '';
        Object.entries(FIGURE_FIELDS[group]).forEach(([field, label]) => {
            if (formValue[field]) {
                group_prompt += `${formValue[field]} ,`;
            }
        });        
        prompt += group_prompt;
    });

    const handleFind = async () => {
        onPromptChange(prompt);
    }
  
    const handleSubmit = async () => {
        const formData = new FormData();
        Object.entries(formValue).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            formData.append(key, value);
          }
        });
        if (!file) {
            if (formValue.id){
                onSave(formData);
            } else {
            throw new Error("파일을 선택해 주세요.");
            }
      } else {
        formData.append("file", file);    
        const result = await addFigure(formData);
      }
    };

    const handleDelete = async () => {
      if (formValue.id) {
        await deleteFigure(formValue.id);
      }
    }

    const randomizePrompt = async () => {
      const res = await getRandomPrompt();
      setFormValue(res.data);
    }
  
    useEffect(() => {
      setFile(null);
      fileInputRef.current.value = null;
      setFilePreviewUrl(null);
      if (defaultPrompt) {
        setFormValue(defaultPrompt);
      }
    }, [defaultPrompt]);

    const fileInputRef = useRef(null);
  
    return (
      <Form fluid>
        <div style={{ display: "flex", flexDirection: "row", gap: 32, minWidth: 300 }}>
          {/* 왼쪽: 입력 필드 그룹 */}
          <div style={{ flex: 2 }}>
            {Object.entries(FIGURE_FIELDS).map(([group, fields]) => (
              <div key={group} style={{ marginBottom: -10 }}>
                <h5 style={{ margin: "8px 0" }}>{group}</h5>
                <div style={{ display: "flex", gap: 8 }}>
                  {Object.entries(fields).map(([field, label]) => (
                    <Form.Group key={field} style={{ flex: 1 }}>
                      <Form.ControlLabel>{label}</Form.ControlLabel>
                      <Form.Control
                        name={field}
                        accepter={Input}
                        value={formValue[field] ?? ""}
                        onChange={val => setFormValue(fv => ({ ...fv, [field]: val }))}
                      />
                    </Form.Group>
                  ))}
                </div>
              </div>
            ))}
            <Form.Group style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <input ref={fileInputRef} type="file" name="file_path" onChange={handleFileChange} style={{ flex: 1 }} />
            </Form.Group>
            <div style={{ flex: 1, display: "flex", flexDirection: "row", gap: 12, marginBottom: 12 }}>
            <Button onClick={randomizePrompt}>랜덤 프롬프트</Button>
            <Button size="sm" style={{ marginTop: 4 }} onClick={() => {
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(prompt);
                } else {
                    // fallback for old browsers
                    const textarea = document.createElement('textarea');
                    textarea.value = prompt;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                }
                }}>클립보드에 프롬프트 복사</Button>            
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "row", gap: 12, marginBottom: 12 }}>
              <Button appearance="primary" onClick={handleFind} style={{ width: "100%" }}>찾기</Button>
              <Button appearance="primary" onClick={handleSubmit} style={{ width: "100%" }}>저장</Button>
              <Button appearance="primary" onClick={handleDelete} style={{ width: "100%" }}>삭제</Button>
            </div>
            {filePreviewUrl && (
            <div style={{ marginBottom: 12, gridColumn: "1 / -1" }}>
              {filePreviewUrl ? (
                <img src={filePreviewUrl} alt="미리보기" style={{ maxWidth: 480, maxHeight: 480, display: "block" }} />
              ) : <></>}
            </div>
          )}
          </div>          
        </div>
      </Form>
    );
  }