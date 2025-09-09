import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllUsersAdmin, deleteUserAdmin } from '../api/api';
import './UserManagement.css';

const UserManagement = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [deletingUsers, setDeletingUsers] = useState(new Set());
  const usersPerPage = 20;

  useEffect(() => {
    if (currentPage === 1) {
      fetchUsers(true);
    } else {
      fetchUsers(false);
    }
  }, [currentPage]);

  const fetchUsers = async (isFirstLoad = true) => {
    try {
      if (isFirstLoad) {
        setLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      
      const offset = (currentPage - 1) * usersPerPage;
      const response = await getAllUsersAdmin(usersPerPage, offset);
      
      if (response.data && Array.isArray(response.data)) {
        if (isFirstLoad) {
          setUsers(response.data);
        } else {
          setUsers(prevUsers => [...prevUsers, ...response.data]);
        }
        // 현재 페이지에서 가져온 사용자 수가 페이지당 사용자 수보다 적으면 더 이상 사용자가 없음
        setHasMoreUsers(response.data.length === usersPerPage);
      }
    } catch (err) {
      setError('사용자 목록을 가져오는데 실패했습니다.');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('정말로 이 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      setDeletingUsers(prev => new Set(prev).add(userId));
      
      const response = await deleteUserAdmin(userId);
      
      if (response.data && response.data === true) {
        // 삭제된 사용자를 목록에서 제거
        setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
        alert('사용자가 성공적으로 삭제되었습니다.');
      } else {
        alert('사용자 삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('사용자 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const canGoNext = hasMoreUsers;

  return (
    <div className="user-management">
      <div className="user-management-header">
        <h1>사용자 관리</h1>
        <p className="header-description">시스템에 등록된 모든 사용자를 관리합니다.</p>
        {users.length > 0 && (
          <div className="user-count-info">
            <span>총 {users.length}명의 사용자가 등록되어 있습니다.</span>
            {currentPage > 1 && (
              <span className="page-info"> (페이지 {currentPage})</span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>데이터를 불러오는 중...</p>
        </div>
      ) : (
        <>
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>사용자 ID</th>
                  <th>이메일</th>
                  <th>표시명</th>
                  <th>상태</th>
                  <th>가입일</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="user-row">
                    <td className="user-id">{user.id.substring(0, 8)}...</td>
                    <td className="user-email">{user.email || 'N/A'}</td>
                    <td className="user-display-name">{user.display_name || 'N/A'}</td>
                    <td className="user-status">
                      <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                        {user.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="user-created">{formatDate(user.created_at)}</td>
                    <td className="user-actions">
                      <button 
                        className="delete-user-button"
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={deletingUsers.has(user.id)}
                      >
                        {deletingUsers.has(user.id) ? '삭제 중...' : '삭제'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMoreUsers && (
            <div className="load-more-container">
              <button 
                className="load-more-button"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? '로딩 중...' : '더 보기'}
              </button>
            </div>
          )}
          
          {currentPage > 1 && (
            <div className="pagination">
              <button 
                className="page-button"
                onClick={() => setCurrentPage(1)}
              >
                처음으로
              </button>
            </div>
          )}

          {users.length === 0 && !loading && (
            <div className="no-users">
              <p>등록된 사용자가 없습니다.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UserManagement;
