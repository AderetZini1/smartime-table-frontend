import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, getMe, login8001 } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useGoogleOAuth } from '@react-oauth/google';
import axios from 'axios';
import LoadingScreen from '../components/LoadingScreen';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const { clientId } = useGoogleOAuth(); // אותו Client ID שמוגדר ב-GoogleOAuthProvider
  const googleHandled = useRef(false);

  // Keep the splash on screen long enough for the logo animation to finish,
  // even when the server answers immediately.
  const MIN_SPLASH_MS = 2000;
  const holdSplash = (startedAt) => {
    const left = MIN_SPLASH_MS - (Date.now() - startedAt);
    return left > 0 ? new Promise((r) => setTimeout(r, left)) : Promise.resolve();
  };

  // Fresh login → land on the default page (clear the remembered admin tab).
  // Re-login after a session expiry → keep it, so the user returns where they were.
  const applyPostLoginTab = () => {
    const wasRelogin = localStorage.getItem('reloginPending') === '1';
    localStorage.removeItem('reloginPending');
    if (!wasRelogin) localStorage.removeItem('adminActiveTab');
  };

  const handleAfterLogin = (token, userData) => {
    localStorage.setItem('token', token);
    loginUser(token, userData);
    applyPostLoginTab();
    if (userData.is_admin) {
      navigate('/admin');
    } else {
      navigate('/teacher');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const startedAt = Date.now();
    try {
      const res = await login(username, password);
      const token = res.data.access_token;
      localStorage.setItem('token', token);
      const meRes = await getMe();
      loginUser(token, meRes.data);

      try {
        const res2 = await login8001(username, password);
        localStorage.setItem('token8001', res2.data.access_token);
      } catch (e) {
        console.warn('8001 login failed (generation/schedule may be unavailable)', e);
      }

      applyPostLoginTab();
      await holdSplash(startedAt);
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

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    const startedAt = Date.now();
    try {
      const res = await axios.post('/auth/google-oauth/', {
        credential: credentialResponse.credential,
      });
      const { access_token, ...userData } = res.data;
      await holdSplash(startedAt);
      handleAfterLogin(access_token, userData);
    } catch (err) {
      const msg = err?.response?.data?.detail;
      setError(typeof msg === 'string' ? msg : 'שגיאה בהתחברות עם גוגל');
    } finally {
      setLoading(false);
    }
  };

  // מעבר מלא לעמוד הכניסה של Google (בלי חלונית קופצת)
  const startGoogleLogin = () => {
    const nonce = crypto.randomUUID();
    const state = crypto.randomUUID();
    sessionStorage.setItem('googleNonce', nonce);
    sessionStorage.setItem('googleState', state);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${window.location.origin}/login`,
      response_type: 'id_token',
      scope: 'openid email profile',
      prompt: 'select_account',
      nonce,
      state,
    });
    window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  };

  // חזרה מ-Google: הטוקן מגיע בכתובת (#id_token=...)
  useEffect(() => {
    if (googleHandled.current) return;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const idToken = hash.get('id_token');
    const googleError = hash.get('error');
    if (!idToken && !googleError) return;
    googleHandled.current = true;
    window.history.replaceState(null, '', window.location.pathname);

    const expectedState = sessionStorage.getItem('googleState');
    const expectedNonce = sessionStorage.getItem('googleNonce');
    sessionStorage.removeItem('googleState');
    sessionStorage.removeItem('googleNonce');

    if (googleError) {
      if (googleError !== 'access_denied') setError('שגיאה בהתחברות עם גוגל');
      return;
    }
    try {
      const b64 = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(b64));
      if (hash.get('state') !== expectedState || payload.nonce !== expectedNonce) {
        setError('שגיאה בהתחברות עם גוגל');
        return;
      }
    } catch {
      setError('שגיאה בהתחברות עם גוגל');
      return;
    }
    handleGoogleSuccess({ credential: idToken });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FAF7F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }} dir="rtl">
      {loading && <LoadingScreen tagline="מתחבר..." cycle="3s" />}

      <div style={{ backgroundColor: '#fff', borderRadius: '24px', border: '1px solid #e2dacc', padding: '48px 64px', width: '100%', maxWidth: '520px', boxSizing: 'border-box' }}>

        {/* לוגו */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <img src="/favicon.ico" alt="Smartime" style={{ width: '64px', height: '64px', display: 'block', margin: '0 auto 16px' }} />
          <h1 style={{ fontSize: '34px', fontWeight: 400, color: '#4a3f35', margin: 0 }}>מערכת שעות חכמה</h1>
          <div style={{ width: '48px', height: '1px', backgroundColor: '#8a9e78', margin: '18px auto 0' }}></div>
        </div>

        {error && (
          <p style={{ color: '#c0705a', fontSize: '13px', textAlign: 'center', marginBottom: '16px', backgroundColor: '#fff8f6', border: '1px solid #f0c9bc', borderRadius: '8px', padding: '10px' }}>{error}</p>
        )}

        {/* כפתור גוגל */}
        <button
          type="button"
          onClick={startGoogleLogin}
          disabled={loading}
          style={{
            width: '100%', minHeight: '50px', padding: '13px', backgroundColor: '#FAF7F2',
            color: '#4a3f35', border: '1px solid #e2dacc', borderRadius: '999px',
            fontSize: '16px', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.150 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          <span>כניסה עם Google</span>
        </button>

        {/* מפריד */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '26px 0' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e2dacc' }}></div>
          <span style={{ fontSize: '13px', color: '#a8957c', whiteSpace: 'nowrap' }}>או התחברות עם תעודת זהות</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e2dacc' }}></div>
        </div>

        {/* טופס קיים — ללא שינוי */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', color: '#7a6a5e', marginBottom: '8px' }}>
              תעודת זהות
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                width: '100%', padding: '14px 18px', border: '1px solid #e2dacc',
                borderRadius: '12px', fontSize: '15px', fontFamily: 'inherit', color: '#4a3f35',
                backgroundColor: '#FAF7F2', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', fontSize: '14px', color: '#7a6a5e', marginBottom: '8px' }}>
              סיסמה
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%', padding: '14px 18px', border: '1px solid #e2dacc',
                borderRadius: '12px', fontSize: '15px', fontFamily: 'inherit', color: '#4a3f35',
                backgroundColor: '#FAF7F2', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'block', margin: '0 auto', minHeight: '50px', padding: '13px 56px', backgroundColor: '#6f8560',
              color: '#fff', border: 'none', borderRadius: '999px',
              fontSize: '16px', fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s'
            }}
          >
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '22px' }}>
          <button
            type="button"
            onClick={() => navigate('/forgot-password')}
            style={{ background: 'none', border: 'none', color: '#8a7a6e', fontSize: '14px', fontFamily: 'inherit', cursor: 'pointer' }}
          >
            שכחת סיסמה?
          </button>
        </div>
      </div>
    </div>
  );
}