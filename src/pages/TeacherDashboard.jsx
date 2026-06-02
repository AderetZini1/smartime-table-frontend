import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateTeacher, getMyConstraints, createConstraint, deleteConstraint, getActiveWindow, getMyRequests, createRequest } from '../services/api';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8];

const REQUEST_TYPES = [
  { value: 'constraint_change', label: 'שינוי אילוץ' },
  { value: 'absence', label: 'בקשת היעדרות' },
  { value: 'general', label: 'פנייה כללית' },
];

const styles = {
  layout: { display: 'flex', backgroundColor: '#FAF7F2', minHeight: '100vh', direction: 'rtl' },
  sidebar: { width: '240px', backgroundColor: '#fff', borderLeft: '1px solid #e2dacc', display: 'flex', flexDirection: 'column', padding: '28px 0', flexShrink: 0 },
  brand: { fontSize: '11px', letterSpacing: '0.14em', color: '#c8baa6', marginBottom: '4px' },
  brandName: { fontSize: '17px', color: '#4a3f35' },
  navItem: (active) => ({ padding: '13px 24px', fontSize: '15px', color: active ? '#4a3f35' : '#8a7a6e', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', borderRight: active ? '3px solid #8a9e78' : '3px solid transparent', backgroundColor: active ? '#FAF7F2' : 'transparent', border: 'none', width: '100%', textAlign: 'right', fontFamily: 'Varela Round, sans-serif' }),
  divider: { margin: '12px 24px', borderBottom: '1px solid #e2dacc' },
  main: { flex: 1, padding: '40px 48px' },
  card: { backgroundColor: '#fff', borderRadius: '14px', border: '1px solid #e2dacc', padding: '24px', marginBottom: '24px' },
  input: { width: '100%', padding: '10px 14px', border: '1px solid #e2dacc', borderRadius: '8px', fontSize: '14px', color: '#4a3f35', backgroundColor: '#FAF7F2', outline: 'none', boxSizing: 'border-box', fontFamily: 'Varela Round, sans-serif' },
  label: { display: 'block', fontSize: '12px', color: '#8a7a6e', marginBottom: '6px' },
  btnSave: { backgroundColor: '#8a9e78', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer', fontFamily: 'Varela Round, sans-serif' },
};

const TABS = [
  { id: 'profile', label: 'פרופיל אישי', icon: 'ti-user' },
  { id: 'constraints', label: 'העדפות שעות', icon: 'ti-clock' },
  { id: 'requests', label: 'פניות ובקשות', icon: 'ti-message' },
  { id: 'schedule', label: 'מערכת השעות שלי', icon: 'ti-calendar' },
];

const statusLabel = (s) => ({ pending: 'ממתין', approved: 'אושר', rejected: 'נדחה' }[s] || s);
const statusColor = (s) => ({ pending: '#c8baa6', approved: '#8a9e78', rejected: '#c0705a' }[s] || '#c8baa6');

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [constraints, setConstraints] = useState([]);
  const [activeWindow, setActiveWindow] = useState(null);
  const [windowLoaded, setWindowLoaded] = useState(false);
  const [requests, setRequests] = useState([]);
  const [newRequest, setNewRequest] = useState({ request_type: 'constraint_change', description: '' });
  const [requestSent, setRequestSent] = useState(false);
  const [profile, setProfile] = useState({ first_name: '', last_name: '', email: '', phone_number: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) setProfile({ first_name: user.first_name, last_name: user.last_name, email: user.email, phone_number: user.phone_number || '' });
  }, [user]);

  useEffect(() => {
    if (activeTab === 'constraints') {
      getActiveWindow().then(r => { setActiveWindow(r.data); setWindowLoaded(true); }).catch(() => { setActiveWindow(null); setWindowLoaded(true); });
      getMyConstraints().then(r => setConstraints(r.data));
    }
    if (activeTab === 'requests') {
      getMyRequests().then(r => setRequests(r.data));
    }
  }, [activeTab]);

  const handleSaveProfile = async () => {
    await updateTeacher(user.id, profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSendRequest = async () => {
    if (!newRequest.description.trim()) return;
    await createRequest(newRequest);
    setRequestSent(true);
    setNewRequest({ request_type: 'constraint_change', description: '' });
    getMyRequests().then(r => setRequests(r.data));
    setTimeout(() => setRequestSent(false), 3000);
  };

  return (
    <div style={styles.layout}>
      <div style={styles.sidebar}>
        <div style={{ padding: '0 24px', marginBottom: '32px' }}>
          <div style={styles.brand}>SMARTIME</div>
          <div style={styles.brandName}>אזור אישי</div>
        </div>
        <nav style={{ flex: 1 }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={styles.navItem(activeTab === tab.id)}>
              <i className={`ti ${tab.icon}`} style={{ fontSize: '18px' }} aria-hidden="true"></i>
              {tab.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: '0 24px' }}>
          <div style={{ fontSize: '12px', color: '#c8baa6', marginBottom: '8px' }}>{user?.first_name} {user?.last_name}</div>
          <button onClick={logout} style={{ fontSize: '13px', color: '#8a7a6e', background: 'none', border: '1px solid #e2dacc', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', width: '100%', fontFamily: 'Varela Round, sans-serif' }}>התנתק</button>
        </div>
      </div>

      <div style={styles.main}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', color: '#4a3f35', margin: 0 }}>{TABS.find(t => t.id === activeTab)?.label}</h1>
          <div style={{ width: '28px', height: '1.5px', backgroundColor: '#8a9e78', marginTop: '8px' }}></div>
        </div>

        {activeTab === 'profile' && (
          <div style={styles.card}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={styles.label}>שם פרטי</label>
                <input style={styles.input} value={profile.first_name} onChange={e => setProfile({ ...profile, first_name: e.target.value })} />
              </div>
              <div>
                <label style={styles.label}>שם משפחה</label>
                <input style={styles.input} value={profile.last_name} onChange={e => setProfile({ ...profile, last_name: e.target.value })} />
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={styles.label}>אימייל</label>
              <input style={styles.input} value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={styles.label}>טלפון</label>
              <input style={styles.input} value={profile.phone_number} onChange={e => setProfile({ ...profile, phone_number: e.target.value })} placeholder="05X-XXXXXXX" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button onClick={handleSaveProfile} style={styles.btnSave}>שמור שינויים</button>
              {saved && <span style={{ fontSize: '13px', color: '#8a9e78' }}>✓ נשמר בהצלחה</span>}
            </div>
          </div>
        )}

        {activeTab === 'constraints' && (
          <>
            {!windowLoaded ? (
              <div style={{ ...styles.card, textAlign: 'center', color: '#c8baa6' }}>טוען...</div>
            ) : !activeWindow ? (
              <div style={styles.card}>
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <i className="ti ti-lock" style={{ fontSize: '36px', color: '#c8baa6', display: 'block', marginBottom: '12px' }} aria-hidden="true"></i>
                  <div style={{ fontSize: '16px', color: '#4a3f35', marginBottom: '8px' }}>טופס ההעדפות אינו פתוח כרגע</div>
                  <div style={{ fontSize: '13px', color: '#8a7a6e', marginBottom: '24px' }}>ניתן לשלוח פנייה מיוחדת למנהל המערכת</div>
                  <button onClick={() => setActiveTab('requests')} style={styles.btnSave}>
                    <i className="ti ti-message" aria-hidden="true"></i> שלח פנייה
                  </button>
                </div>
              </div>
            ) : (
              <div style={styles.card}>
                <div style={{ backgroundColor: '#EDF4E8', borderRadius: '8px', padding: '10px 16px', marginBottom: '20px', fontSize: '13px', color: '#6b8f5e' }}>
                  <i className="ti ti-clock" aria-hidden="true"></i> {activeWindow.title} — פתוח עד {new Date(activeWindow.end_date).toLocaleDateString('he-IL')}
                </div>
                <p style={{ fontSize: '13px', color: '#8a7a6e', marginBottom: '20px' }}>לחצי על שעה כדי לסמן אותה כלא מועדפת.</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px 12px', color: '#c8baa6', fontWeight: 'normal', textAlign: 'right' }}>שעה / יום</th>
                        {DAYS.map(d => <th key={d} style={{ padding: '8px 12px', color: '#4a3f35', fontWeight: 'normal', textAlign: 'center', minWidth: '70px' }}>{d}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {HOURS.map(hour => (
                        <tr key={hour}>
                          <td style={{ padding: '8px 12px', color: '#c8baa6' }}>שיעור {hour}</td>
                          {DAYS.map((day, dayIdx) => {
                            const constrained = constraints.find(c => c.timeslot_id === (dayIdx * 8 + hour));
                            return (
                              <td key={day} style={{ padding: '4px 8px', textAlign: 'center' }}>
                                <div
                                  onClick={() => constrained
                                    ? deleteConstraint(constrained.id).then(() => setConstraints(prev => prev.filter(c => c.id !== constrained.id)))
                                    : createConstraint({ teacher_id: user.id, timeslot_id: dayIdx * 8 + hour, weight: 5 }).then(r => setConstraints(prev => [...prev, r.data]))
                                  }
                                  style={{ width: '36px', height: '36px', borderRadius: '8px', margin: '0 auto', cursor: 'pointer', backgroundColor: constrained ? '#FAE8E8' : '#f5f2ee', border: `1px solid ${constrained ? '#e8c0b0' : '#e2dacc'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                                >
                                  {constrained && <i className="ti ti-x" style={{ fontSize: '13px', color: '#c0705a' }} aria-hidden="true"></i>}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'requests' && (
          <>
            <div style={styles.card}>
              <h3 style={{ fontSize: '15px', color: '#4a3f35', marginBottom: '16px' }}>פנייה חדשה</h3>
              <div style={{ marginBottom: '16px' }}>
                <label style={styles.label}>סוג הפנייה</label>
                <select value={newRequest.request_type} onChange={e => setNewRequest({ ...newRequest, request_type: e.target.value })} style={{ ...styles.input, cursor: 'pointer' }}>
                  {REQUEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={styles.label}>תיאור הפנייה</label>
                <textarea value={newRequest.description} onChange={e => setNewRequest({ ...newRequest, description: e.target.value })} style={{ ...styles.input, height: '100px', resize: 'vertical' }} placeholder="תאר את הבקשה שלך..." />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={handleSendRequest} style={styles.btnSave}>שלח פנייה</button>
                {requestSent && <span style={{ fontSize: '13px', color: '#8a9e78' }}>✓ הפנייה נשלחה</span>}
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={{ fontSize: '15px', color: '#4a3f35', marginBottom: '16px' }}>הפניות שלי</h3>
              {requests.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#c8baa6', padding: '24px', fontSize: '14px' }}>אין פניות עדיין</div>
              ) : requests.map((req, i) => (
                <div key={req.id} style={{ padding: '16px 0', borderBottom: i < requests.length - 1 ? '1px solid #f0ebe3' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px', color: '#4a3f35' }}>{REQUEST_TYPES.find(t => t.value === req.request_type)?.label}</span>
                    <span style={{ fontSize: '12px', color: statusColor(req.status), backgroundColor: `${statusColor(req.status)}20`, padding: '2px 10px', borderRadius: '20px' }}>{statusLabel(req.status)}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#8a7a6e', marginBottom: req.admin_response ? '8px' : 0 }}>{req.description}</div>
                  {req.admin_response && (
                    <div style={{ fontSize: '12px', color: '#6b8f5e', backgroundColor: '#EDF4E8', borderRadius: '6px', padding: '8px 12px' }}>
                      <strong>תשובת המנהל:</strong> {req.admin_response}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'schedule' && (
          <div style={{ ...styles.card, minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: '#c8baa6' }}>
              <i className="ti ti-calendar" style={{ fontSize: '36px', display: 'block', marginBottom: '14px' }} aria-hidden="true"></i>
              <div style={{ fontSize: '15px' }}>מערכת השעות תוצג כאן לאחר יצירתה</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}