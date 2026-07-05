import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { forgotPassword, verifyResetCode, setNewPassword } from '../services/api';

// Password rule check (matches the backend: 8+ chars, upper, lower, number, special)
function passwordProblem(pw) {
  if (pw.length < 8) return 'הסיסמה חייבת להכיל לפחות 8 תווים';
  if (!/[A-Z]/.test(pw)) return 'הסיסמה חייבת לכלול אות גדולה באנגלית';
  if (!/[a-z]/.test(pw)) return 'הסיסמה חייבת לכלול אות קטנה באנגלית';
  if (!/[0-9]/.test(pw)) return 'הסיסמה חייבת לכלול ספרה';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'הסיסמה חייבת לכלול תו מיוחד';
  return null;
}

const box = {
  width: '100%', padding: '12px 16px', border: '1px solid #e2dacc',
  borderRadius: '10px', fontSize: '14px', color: '#4a3f35',
  backgroundColor: '#FAF7F2', outline: 'none', boxSizing: 'border-box',
};
const label = { display: 'block', fontSize: '12px', color: '#8a7a6e', marginBottom: '8px', letterSpacing: '0.05em' };
const primaryBtn = (loading) => ({
  width: '100%', padding: '13px', backgroundColor: '#8a9e78', color: '#fff',
  border: 'none', borderRadius: '10px', fontSize: '15px',
  cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s',
});

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1=email, 2=code, 3=new password
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const sendCode = async (e) => {
    e.preventDefault();
    setError(''); setInfo(''); setLoading(true);
    try {
      await forgotPassword(email.trim());
      setInfo('נשלח קוד אימות לכתובת המייל שלך.');
      setStep(2);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setError('כתובת המייל אינה רשומה במערכת.');
      } else if (err.response && err.response.status === 400) {
        setError('יש להזין כתובת מייל.');
      } else {
        setError('אירעה שגיאה בשליחת הקוד. נסה שוב.');
      }
    } finally {
      setLoading(false);
    }
  };

  const checkCode = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await verifyResetCode(email.trim(), code.trim());
      setStep(3);
    } catch (err) {
      setError('הקוד שגוי או שפג תוקפו.');
    } finally {
      setLoading(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('הסיסמאות אינן תואמות.'); return; }
    const problem = passwordProblem(password);
    if (problem) { setError(problem); return; }
    setLoading(true);
    try {
      await setNewPassword(email.trim(), code.trim(), password, confirm);
      setInfo('הסיסמה עודכנה בהצלחה! מעביר לעמוד ההתחברות...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError('אירעה שגיאה בעדכון הסיסמה. ייתכן שהקוד פג תוקף.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FAF7F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }} dir="rtl">
      <div style={{ backgroundColor: '#fff', borderRadius: '20px', border: '1px solid #e2dacc', padding: '48px', width: '100%', maxWidth: '420px' }}>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '13px', letterSpacing: '0.15em', color: '#c8baa6', marginBottom: '8px' }}>SMARTIME</div>
          <h1 style={{ fontSize: '24px', color: '#4a3f35', margin: 0 }}>איפוס סיסמה</h1>
          <div style={{ width: '40px', height: '1px', backgroundColor: '#8a9e78', margin: '16px auto 0' }}></div>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '28px' }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{ width: '28px', height: '4px', borderRadius: '2px', backgroundColor: step >= n ? '#8a9e78' : '#e2dacc' }}></div>
          ))}
        </div>

        {/* Step 1 — email */}
        {step === 1 && (
          <form onSubmit={sendCode}>
            <p style={{ fontSize: '13px', color: '#8a7a6e', textAlign: 'center', marginBottom: '20px' }}>
              הזן את כתובת המייל שלך ונשלח אליך קוד אימות.
            </p>
            <div style={{ marginBottom: '24px' }}>
              <label style={label}>כתובת מייל</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@school.com" required style={box} />
            </div>
            {error && <p style={{ color: '#c0705a', fontSize: '13px', textAlign: 'center', marginBottom: '16px' }}>{error}</p>}
            <button type="submit" disabled={loading} style={primaryBtn(loading)}>
              {loading ? 'שולח...' : 'שלח קוד'}
            </button>
          </form>
        )}

        {/* Step 2 — code */}
        {step === 2 && (
          <form onSubmit={checkCode}>
            <p style={{ fontSize: '13px', color: '#8a7a6e', textAlign: 'center', marginBottom: '20px' }}>
              הזן את קוד האימות שנשלח לכתובת המייל שלך.
            </p>
            {info && <p style={{ color: '#6b8f5e', fontSize: '13px', textAlign: 'center', marginBottom: '16px' }}>{info}</p>}
            <div style={{ marginBottom: '24px' }}>
              <label style={label}>קוד אימות</label>
              <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="______" required
                style={{ ...box, textAlign: 'center', letterSpacing: '0.4em', fontSize: '18px' }} />
            </div>
            {error && <p style={{ color: '#c0705a', fontSize: '13px', textAlign: 'center', marginBottom: '16px' }}>{error}</p>}
            <button type="submit" disabled={loading} style={primaryBtn(loading)}>
              {loading ? 'בודק...' : 'אמת קוד'}
            </button>
            <button type="button" onClick={() => { setStep(1); setError(''); setInfo(''); }}
              style={{ width: '100%', marginTop: '12px', padding: '10px', background: 'none', border: 'none', color: '#8a7a6e', fontSize: '13px', cursor: 'pointer' }}>
              לא קיבלת קוד? חזרה
            </button>
          </form>
        )}

        {/* Step 3 — new password */}
        {step === 3 && (
          <form onSubmit={savePassword}>
            <p style={{ fontSize: '13px', color: '#8a7a6e', textAlign: 'center', marginBottom: '20px' }}>
              בחר סיסמה חדשה. לפחות 8 תווים, אות גדולה, אות קטנה, ספרה ותו מיוחד.
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label style={label}>סיסמה חדשה</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={box} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={label}>אימות סיסמה</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={box} />
            </div>
            {error && <p style={{ color: '#c0705a', fontSize: '13px', textAlign: 'center', marginBottom: '16px' }}>{error}</p>}
            {info && <p style={{ color: '#6b8f5e', fontSize: '13px', textAlign: 'center', marginBottom: '16px' }}>{info}</p>}
            <button type="submit" disabled={loading} style={primaryBtn(loading)}>
              {loading ? 'שומר...' : 'עדכן סיסמה'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: '#8a7a6e', fontSize: '13px', cursor: 'pointer' }}>
            חזרה להתחברות
          </button>
        </div>
      </div>
    </div>
  );
}
