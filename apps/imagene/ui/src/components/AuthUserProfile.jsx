import { useEffect, useState } from "react";
import { API_URL, fetchMe, startGoogleLogin, logout, getUserSummaryUser } from "../api/api";
import './AuthUserProfile.css';
import { useUser } from '../contexts/UserContext';
import { useNavigate } from "react-router-dom";

function AuthUserProfile() {
  const { user, setUser } = useUser();
  const [userSummary, setUserSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const data = await fetchMe();
      setUser(data);
      setLoading(false);
      // 사용자 정보가 있으면 상세 정보도 가져오기
      if (data) {
        fetchUserSummary();
      }
    })();
  }, []);

  const fetchUserSummary = async () => {
    try {
      setProfileLoading(true);
      setProfileError(null);
      
      const response = await getUserSummaryUser();
      
      if (response.data) {
        setUserSummary(response.data);
      }
    } catch (err) {
      setProfileError('사용자 정보를 가져오는데 실패했습니다.');
      console.error('Error fetching user summary:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  if (loading) return <div className="sidebar-loading">Loading…</div>;

  return (
    <div className="sidebar-user-profile">
      {!user ? (
        <div className="login-section">
          <p className="login-text">로그인이 필요합니다</p>
          <button className="action-button primary" onClick={startGoogleLogin}>
            Google로 로그인
          </button>
        </div>
      ) : (
        <>
          {/* 컴팩트한 사용자 프로필 */}
          <div className="user-profile-compact">
            <div className="user-header">
              <div className="user-avatar-small">
                {user.display_name ? user.display_name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="user-details">
                <h4 className="user-name">{user.display_name || '이름 없음'}</h4>
                <p className="user-email-compact">{user.email || '이메일 없음'}</p>
              </div>
            </div>

            {/* 간단한 통계 */}
            {!profileLoading && !profileError && userSummary && (
              <div className="stats-compact">
                <div className="stat-compact">
                  <span className="stat-icon-small">📚</span>
                  <span className="stat-number-small">{userSummary.stats.total_words}</span>
                </div>
                <div className="stat-compact">
                  <span className="stat-icon-small">💬</span>
                  <span className="stat-number-small">{userSummary.stats.total_examples}</span>
                </div>
                <div className="stat-compact">
                  <span className="stat-icon-small">📝</span>
                  <span className="stat-number-small">{userSummary.stats.total_texts}</span>
                </div>
              </div>
            )}

            {/* 액션 버튼들 */}
            <div className="profile-actions">
              <button 
                className="action-button primary"
                onClick={() => navigate(`/user-word-skills`)}
              >
                ステータス
              </button>
              <button 
                className="action-button secondary"
                onClick={async () => { 
                  await logout(); 
                  setUser(null); 
                  setUserSummary(null); 
                }}
              >
                ログアウト
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AuthUserProfile;
