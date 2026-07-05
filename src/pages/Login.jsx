import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, getMe, login8001 } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(username, password);
      const token = res.data.access_token;
      localStorage.setItem('token', token);
      const meRes = await getMe();
      loginUser(token, meRes.data);

      // Also log in to the 8001 backend (same credentials), for generation
      // and schedule. If it fails, the main login still works.
      try {
        const res2 = await login8001(username, password);
        localStorage.setItem('token8001', res2.data.access_token);
      } catch (e) {
        console.warn('8001 login failed (generation/schedule may be unavailable)', e);
      }
      if (meRes.data.is_admin) {
        navigate('/admin');
      } else {
        navigate('/teacher');
      }
    } catch (err) {
      setError('תעודת זהות או סיסמה שגויים');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FAF7F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }} dir="rtl">
      <div style={{ backgroundColor: '#fff', borderRadius: '20px', border: '1px solid #e2dacc', padding: '48px', width: '100%', maxWidth: '420px' }}>
        
        {/* לוגו */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '13px', letterSpacing: '0.15em', color: '#c8baa6', marginBottom: '8px' }}>SMARTIME</div>
          <h1 style={{ fontSize: '28px', color: '#4a3f35', margin: 0 }}>מערכת שעות חכמה</h1>
          <div style={{ width: '40px', height: '1px', backgroundColor: '#8a9e78', margin: '16px auto 0' }}></div>
        </div>

        <form onSubmit={handleSubmit}>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#8a7a6e', marginBottom: '8px', letterSpacing: '0.05em' }}>
              תעודת זהות
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="הכנס תעודת זהות"
              required
              style={{
                width: '100%', padding: '12px 16px', border: '1px solid #e2dacc',
                borderRadius: '10px', fontSize: '14px', color: '#4a3f35',
                backgroundColor: '#FAF7F2', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#8a7a6e', marginBottom: '8px', letterSpacing: '0.05em' }}>
              סיסמה
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="הכנס סיסמה"
              required
              style={{
                width: '100%', padding: '12px 16px', border: '1px solid #e2dacc',
                borderRadius: '10px', fontSize: '14px', color: '#4a3f35',
                backgroundColor: '#FAF7F2', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <p style={{ color: '#c0705a', fontSize: '13px', textAlign: 'center', marginBottom: '16px' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '13px', backgroundColor: '#8a9e78',
              color: '#fff', border: 'none', borderRadius: '10px',
              fontSize: '15px', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s'
            }}
          >
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>

        </form>
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            type="button"
            onClick={() => navigate('/forgot-password')}
            style={{ background: 'none', border: 'none', color: '#8a7a6e', fontSize: '13px', cursor: 'pointer' }}
          >
            שכחת סיסמה?
          </button>
        </div>
      </div>
    </div>
  );
}
