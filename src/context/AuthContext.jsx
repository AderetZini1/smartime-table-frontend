import { createContext, useContext, useState, useEffect } from 'react';
import { getMe, resetSessionExpiredFlag } from '../services/api';

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
      // Show the modal over the CURRENT page. Do NOT clear user here, or the
      // app's auth routing would immediately redirect to /login and the modal
      // would appear over the login page instead of where the user was.
      setSessionExpired(true);
    };
    window.addEventListener('session-expired', handleExpired);
    return () => window.removeEventListener('session-expired', handleExpired);
  }, []);

  const loginUser = (token, userData) => {
    localStorage.setItem('token', token);
    resetSessionExpiredFlag();
    setSessionExpired(false);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const goToLogin = () => {
    // Session expired → mark this as a RE-login (Login will send the user back
    // to the page they were on) and do a clean full navigation to /login.
    // A full load avoids the blank page the half-torn-down dashboard was left in.
    localStorage.setItem('reloginPending', '1');
    localStorage.removeItem('token');
    localStorage.removeItem('token8001');
    window.location.assign('/login');
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
