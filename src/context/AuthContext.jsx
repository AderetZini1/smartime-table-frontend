import { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    // בדוק אם יש token שמור מהפעם הקודמת
    const token = localStorage.getItem('token');
    if (token) {
      getMe()
        .then((res) => setUser(res.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      setSessionExpired(true);
    };
    window.addEventListener('session-expired', handleExpired);
    return () => window.removeEventListener('session-expired', handleExpired);
  }, []);

  const loginUser = (token, userData) => {
    localStorage.setItem('token', token);
    setSessionExpired(false);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const goToLogin = () => {
    setSessionExpired(false);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logout }}>
      {!loading && children}
      {sessionExpired && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#FAF7F2', border: '1px solid #e2dacc', borderRadius: '14px', padding: '28px', width: '90%', maxWidth: '380px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', textAlign: 'center' }}>
            <p style={{ margin: '0 0 20px 0', fontSize: '15px', color: '#4a3f35', lineHeight: 1.6 }}>החיבור פג. יש להתחבר מחדש</p>
            <button onClick={goToLogin} style={{ backgroundColor: '#8a9e78', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '14px', cursor: 'pointer' }}>התחבר מחדש</button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
