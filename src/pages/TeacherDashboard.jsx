import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateTeacher, getMyConstraints, createConstraint, deleteConstraint, getActiveWindow, getMyRequests, createRequest, getSubjects, getMySubjects, addMySubject, removeMySubject, getStudentGroups, getMyGradeLevels, addMyGradeLevel, removeMyGradeLevel, getMyHomeroomPref, saveMyHomeroomPref, getMySchedule, getMyPreferences, saveMyPreferences } from '../services/api';
import { exportSingleSchedule } from '../utils/exportSchedule';
import { useNavigate } from 'react-router-dom';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8];
const GRADES = [1, 2, 3, 4, 5, 6];
const GRADE_LABELS = { 1: "א'", 2: "ב'", 3: "ג'", 4: "ד'", 5: "ה'", 6: "ו'" };

// For the "my schedule" grid: day_of_week 1..6 -> Hebrew name
const DAY_NAMES_BY_NUM = { 1: 'ראשון', 2: 'שני', 3: 'שלישי', 4: 'רביעי', 5: 'חמישי', 6: 'שישי' };
const DAY_ORDER = [1, 2, 3, 4, 5, 6];

// dd.mm.yyyy from an ISO timestamp
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

const REQUEST_TYPES = [
  { value: 'constraint_change', label: 'שינוי אילוץ' },
  { value: 'absence', label: 'בקשת היעדרות' },
  { value: 'general', label: 'פנייה כללית' },
];

const CELL_COLORS = {
  free: { bg: '#f5f2ee', border: '#e2dacc', icon: null },
  preferred_not: { bg: '#FFF3A3', border: '#e8d88a', icon: 'ti-minus', color: '#a08c30' },
  unavailable: { bg: '#FAE8E8', border: '#e8c0b0', icon: 'ti-x', color: '#c0705a' },
};

const STATE_LABELS = { preferred_not: 'מעדיף שלא', unavailable: 'לא יכול' };

const styles = {
  layout: { display: 'flex', backgroundColor: '#FAF7F2', minHeight: '100vh', direction: 'rtl' },
  sidebar: { width: '240px', backgroundColor: '#fff', borderLeft: '1px solid #e2dacc', display: 'flex', flexDirection: 'column', padding: '28px 0', flexShrink: 0 },
  brand: { fontSize: '11px', letterSpacing: '0.14em', color: '#c8baa6', marginBottom: '4px' },
  brandName: { fontSize: '17px', color: '#4a3f35' },
  navItem: (active) => ({ padding: '13px 24px', fontSize: '15px', color: active ? '#4a3f35' : '#8a7a6e', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', borderRight: active ? '3px solid #8a9e78' : '3px solid transparent', backgroundColor: active ? '#FAF7F2' : 'transparent', border: 'none', width: '100%', textAlign: 'right', fontFamily: 'Varela Round, sans-serif' }),
  main: { flex: 1, padding: '40px 48px' },
  card: { backgroundColor: '#fff', borderRadius: '14px', border: '1px solid #e2dacc', padding: '24px', marginBottom: '24px' },
  input: { width: '100%', padding: '10px 14px', border: '1px solid #e2dacc', borderRadius: '8px', fontSize: '14px', color: '#4a3f35', backgroundColor: '#FAF7F2', outline: 'none', boxSizing: 'border-box', fontFamily: 'Varela Round, sans-serif' },
  label: { display: 'block', fontSize: '12px', color: '#8a7a6e', marginBottom: '6px' },
  readonlyField: { width: '100%', padding: '10px 14px', border: '1px solid #f0ebe3', borderRadius: '8px', fontSize: '14px', color: '#4a3f35', backgroundColor: '#f9f6f1', boxSizing: 'border-box' },
  btnSave: { backgroundColor: '#8a9e78', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer', fontFamily: 'Varela Round, sans-serif' },
  btnOutline: { backgroundColor: 'transparent', color: '#8a7a6e', border: '1px solid #e2dacc', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontFamily: 'Varela Round, sans-serif' },
  chipBtn: (selected) => ({ padding: '6px 14px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', backgroundColor: selected ? '#8a9e78' : '#f5f2ee', color: selected ? '#fff' : '#8a7a6e', border: `1px solid ${selected ? '#8a9e78' : '#e2dacc'}`, fontFamily: 'Varela Round, sans-serif' }),
  gridCell: { border: '1px solid #f0ebe3', padding: '6px', verticalAlign: 'top', height: '64px' },
  gridHourCell: { border: '1px solid #f0ebe3', padding: '6px', textAlign: 'center', color: '#c8baa6', fontSize: '12px', backgroundColor: '#FAF7F2', whiteSpace: 'nowrap' },
  gridHeadCell: { border: '1px solid #e2dacc', padding: '10px', textAlign: 'center', color: '#4a3f35', fontSize: '13px', backgroundColor: '#EDF4E8' },
  lessonBox: { backgroundColor: '#F5F8F2', border: '1px solid #e3ecdb', borderRadius: '8px', padding: '6px 8px', fontSize: '12px', color: '#4a3f35', lineHeight: 1.4 },
};

const TABS = [
  { id: 'profile', label: 'פרופיל אישי', icon: 'ti-user' },
  { id: 'constraints', label: 'העדפות שעות', icon: 'ti-clock' },
  { id: 'requests', label: 'פניות ובקשות', icon: 'ti-message' },
  { id: 'schedule', label: 'מערכת השעות שלי', icon: 'ti-calendar' },
];

const statusLabel = (s) => ({ pending: 'ממתין', approved: 'אושר', rejected: 'נדחה' }[s] || s);
const statusColor = (s) => ({ pending: '#c8baa6', approved: '#8a9e78', rejected: '#c0705a' }[s] || '#c8baa6');

// Small on/off toggle switch (RTL: knob sits right when ON)
function Toggle({ on, onClick }) {
  return (
    <button onClick={onClick} type="button" style={{
      width: '46px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
      backgroundColor: on ? '#8a9e78' : '#e2dacc', position: 'relative', transition: 'background-color 0.15s', flexShrink: 0, padding: 0,
    }}>
      <span style={{
        position: 'absolute', top: '3px', right: on ? '3px' : '23px',
        width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#fff',
        transition: 'right 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
      }} />
    </button>
  );
}

// ── קומפוננטה: רשת מקצועות עם checkboxes ──────────────────────────────────
function SubjectCheckboxGrid({ subjects, mySubjects, onToggle }) {
  const columns = [[], [], []];
  subjects.forEach((s, i) => columns[i % 3].push(s));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 24px', marginTop: '8px' }}>
      {columns.map((col, colIdx) => (
        <div key={colIdx}>
          {col.map(subject => {
            const selected = mySubjects.includes(subject.id);
            return (
              <label
                key={subject.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px',
                  borderRadius: '8px', cursor: 'pointer', marginBottom: '4px',
                  backgroundColor: selected ? '#EDF4E8' : 'transparent',
                  transition: 'background-color 0.12s', userSelect: 'none',
                }}
                onMouseEnter={e => { if (!selected) e.currentTarget.style.backgroundColor = '#f5f2ee'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = selected ? '#EDF4E8' : 'transparent'; }}
              >
                <span style={{
                  width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
                  border: `1.5px solid ${selected ? '#8a9e78' : '#c8baa6'}`,
                  backgroundColor: selected ? '#8a9e78' : '#FAF7F2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s',
                }}
                  onClick={() => onToggle(subject)}
                >
                  {selected && <i className="ti ti-check" style={{ fontSize: '12px', color: '#fff' }} aria-hidden="true" />}
                </span>
                <span
                  style={{ fontSize: '14px', color: selected ? '#4a3f35' : '#8a7a6e', transition: 'color 0.12s' }}
                  onClick={() => onToggle(subject)}
                >
                  {subject.subject_name}
                </span>
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [constraints, setConstraints] = useState([]);
  const [activeWindow, setActiveWindow] = useState(null);
  const [windowLoaded, setWindowLoaded] = useState(false);
  const [requests, setRequests] = useState([]);
  const [newRequest, setNewRequest] = useState({ request_type: 'constraint_change', description: '' });
  const [requestSent, setRequestSent] = useState(false);
  const [profile, setProfile] = useState({ first_name: '', last_name: '', email: '', phone_number: '' });
  const [profileBaseline, setProfileBaseline] = useState({ first_name: '', last_name: '', email: '', phone_number: '' });
  const [profileSaved, setProfileSaved] = useState(false);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const prevAnsweredCount = useRef(0);
  const [subjects, setSubjects] = useState([]);
  const [mySubjects, setMySubjects] = useState([]);
  const [myGradeLevels, setMyGradeLevels] = useState([]);
  const [groups, setGroups] = useState([]);
  const [homeroomPref, setHomeroomPref] = useState({ wants_homeroom: null, preferred_group_id: null });
  const [cellStates, setCellStates] = useState({});
  const [reasonModal, setReasonModal] = useState(null);
  const [quickPick, setQuickPick] = useState(null);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [preferences, setPreferences] = useState({
    min_hours: 18, max_hours: 26,
    preferred_consecutive: false,
    priority_early_finish: 0, priority_no_gaps: 0, priority_free_day: 0, priority_consecutive: 0,
  });

  // ---- my published schedule (port 8001) ----
  const [myEntries, setMyEntries] = useState([]);
  const [myRun, setMyRun] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  useEffect(() => {
    if (user) {
      const p = { first_name: user.first_name || '', last_name: user.last_name || '', email: user.email || '', phone_number: user.phone_number || '' };
      setProfile(p);
      setProfileBaseline(p);
    }
  }, [user]);

  useEffect(() => {
    getSubjects().then(r => setSubjects(r.data)).catch(() => {});
    getMySubjects().then(r => setMySubjects(r.data.map(s => s.subject_id))).catch(() => {});
    getStudentGroups().then(r => setGroups(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'constraints') {
      getActiveWindow().then(r => { setActiveWindow(r.data); setWindowLoaded(true); }).catch(() => { setActiveWindow(null); setWindowLoaded(true); });
      getMyConstraints().then(r => {
        setConstraints(r.data);
        const states = {};
        r.data.forEach(c => {
          const key = `${Math.floor((c.timeslot_id - 1) / 8)}-${((c.timeslot_id - 1) % 8) + 1}`;
          const stateByApiType = { hard: 'unavailable', soft: 'preferred_not' };
          states[key] = { state: stateByApiType[c.constraint_type] || 'preferred_not', id: c.id, reason: c.reason || '' };
        });
        setCellStates(states);
      });
      getMyGradeLevels().then(r => setMyGradeLevels(r.data.map(g => g.grade_level))).catch(() => {});
      getMyHomeroomPref().then(r => {
        if (r.data && r.data.id) {
          setHomeroomPref({
            wants_homeroom: r.data.wants_homeroom ?? null,
            preferred_group_id: r.data.preferred_group_id ?? null,
          });
        }
      }).catch(() => {});
      getMyPreferences().then(r => {
        if (r.data) {
          setPreferences(prev => ({
            ...prev,
            min_hours: r.data.min_hours ?? prev.min_hours,
            max_hours: r.data.max_hours ?? prev.max_hours,
            preferred_consecutive: !!r.data.preferred_consecutive,
            priority_early_finish: r.data.priority_early_finish ? 1 : 0,
            priority_no_gaps: r.data.priority_no_gaps ? 1 : 0,
            priority_free_day: r.data.priority_free_day ? 1 : 0,
            priority_consecutive: r.data.priority_consecutive ? 1 : 0,
          }));
        }
      }).catch(() => {});
    }
    if (activeTab === 'requests') {
      getMyRequests().then(r => setRequests(r.data));
      setHasNewNotification(false);
    }
    if (activeTab === 'schedule') {
      setScheduleLoading(true);
      setScheduleError('');
      getMySchedule()
        .then(r => { setMyEntries(r.data.entries || []); setMyRun(r.data.run || null); })
        .catch(() => setScheduleError('שגיאה בטעינת מערכת השעות'))
        .finally(() => setScheduleLoading(false));
    }
  }, [activeTab]);

  useEffect(() => {
    const interval = setInterval(() => {
      getMyRequests().then(r => {
        const answered = r.data.filter(req => req.status !== 'pending' && req.admin_response);
        if (answered.length > prevAnsweredCount.current) setHasNewNotification(true);
        prevAnsweredCount.current = answered.length;
        if (activeTab === 'requests') setRequests(r.data);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const handleCellClick = async (dayIdx, hour) => {
    const key = `${dayIdx}-${hour}`;
    const current = cellStates[key];
    const timeslot_id = dayIdx * 8 + hour;

    // empty -> prefers-not (soft) -> cannot (hard) -> empty
    if (!current) {
      const res = await createConstraint({ teacher_id: user.id, timeslot_id, weight: 1, constraint_type: 'soft' });
      setCellStates(prev => ({ ...prev, [key]: { state: 'preferred_not', id: res.data.id, reason: '' } }));
    } else if (current.state === 'preferred_not') {
      await deleteConstraint(current.id);
      const res = await createConstraint({ teacher_id: user.id, timeslot_id, weight: 1, constraint_type: 'hard' });
      setReasonModal({ dayIdx, hour, constraintId: res.data.id, reason: '' });
      setCellStates(prev => ({ ...prev, [key]: { state: 'unavailable', id: res.data.id, reason: '' } }));
    } else {
      await deleteConstraint(current.id);
      setCellStates(prev => { const next = { ...prev }; delete next[key]; return next; });
    }
  };

  const handleQuickPick = async (dayIdx, hour, targetState) => {
    const key = `${dayIdx}-${hour}`;
    const current = cellStates[key];
    const timeslot_id = dayIdx * 8 + hour;

    if (current) await deleteConstraint(current.id);

    if (targetState === 'free') {
      setCellStates(prev => { const next = { ...prev }; delete next[key]; return next; });
      setQuickPick(null);
      return;
    }

    const apiTypeByState = { preferred_not: 'soft', unavailable: 'hard' };
    const res = await createConstraint({ teacher_id: user.id, timeslot_id, weight: 1, constraint_type: apiTypeByState[targetState] });
    setCellStates(prev => ({ ...prev, [key]: { state: targetState, id: res.data.id, reason: '' } }));
    setQuickPick(null);
    if (targetState === 'unavailable') {
      setReasonModal({ dayIdx, hour, constraintId: res.data.id, reason: '' });
    }
  };

  const handleSaveReason = () => {
    if (!reasonModal) return;
    const key = `${reasonModal.dayIdx}-${reasonModal.hour}`;
    setCellStates(prev => ({ ...prev, [key]: { ...prev[key], reason: reasonModal.reason } }));
    setReasonModal(null);
  };

  const handleSendRequest = async () => {
    if (!newRequest.description.trim()) return;
    await createRequest(newRequest);
    setRequestSent(true);
    setNewRequest({ request_type: 'constraint_change', description: '' });
    getMyRequests().then(r => setRequests(r.data));
    setTimeout(() => setRequestSent(false), 3000);
  };

  // Homeroom now auto-saves on every change (no button).
  const saveHomeroom = async (next) => {
    try { await saveMyHomeroomPref(next); } catch (e) { /* silent */ }
  };

  const profileDirty = JSON.stringify(profile) !== JSON.stringify(profileBaseline);

  const handleSaveProfile = async () => {
    try {
      await updateTeacher(user.id, {
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        phone_number: profile.phone_number,
      });
      setProfileBaseline(profile);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (e) { /* silent */ }
  };

  const handleCancelProfile = () => setProfile(profileBaseline);

  const handleToggleSubject = (subject) => {
    const selected = mySubjects.includes(subject.id);
    // Optimistic: flip the UI immediately, then sync to the server.
    // This also prevents the rapid-click duplicate-add (400) bug.
    setMySubjects(prev => selected ? prev.filter(id => id !== subject.id) : [...prev, subject.id]);
    const call = selected ? removeMySubject(subject.id) : addMySubject(subject.id);
    call.catch(() => {
      // revert if the server rejected it
      setMySubjects(prev => selected ? [...prev, subject.id] : prev.filter(id => id !== subject.id));
    });
  };

  // Preferences auto-save (sends the whole preferences object every time).
  const savePreferences = async (p) => {
    try {
      await saveMyPreferences({
        min_hours: p.min_hours,
        max_hours: p.max_hours,
        preferred_consecutive: p.preferred_consecutive,
        priority_early_finish: p.priority_early_finish,
        priority_no_gaps: p.priority_no_gaps,
        priority_free_day: p.priority_free_day,
        priority_consecutive: p.priority_consecutive,
      });
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 1500);
    } catch (e) { /* silent */ }
  };

  const togglePriority = (field) => {
    const next = { ...preferences, [field]: preferences[field] ? 0 : 1 };
    setPreferences(next);
    savePreferences(next);
  };

  const setConsecutive = (val) => {
    const next = { ...preferences, preferred_consecutive: val };
    setPreferences(next);
    savePreferences(next);
  };

  const scheduleCell = (day, hour) => myEntries.filter(e => e.day_of_week === day && e.hour_of_day === hour);

  const handleExportMySchedule = async () => {
    await exportSingleSchedule(myEntries, {
      fileName: `מערכת_שעות_${user?.first_name || ''}_${user?.last_name || ''}`.trim(),
      sheetName: 'מערכת השעות שלי',
      showGroup: true,
    });
  };

  const PriorityToggle = ({ label, field }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #f0ebe3' }}>
      <span style={{ fontSize: '14px', color: '#4a3f35' }}>{label}</span>
      <Toggle on={!!preferences[field]} onClick={() => togglePriority(field)} />
    </div>
  );

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
              {tab.id === 'requests' && hasNewNotification && (
                <span style={{ marginRight: 'auto', backgroundColor: '#FAE8E8', color: '#c0705a', borderRadius: '10px', padding: '2px 8px', fontSize: '12px' }}>!</span>
              )}
            </button>
          ))}
        </nav>
        <div style={{ padding: '0 24px' }}>
          <div style={{ fontSize: '12px', color: '#c8baa6', marginBottom: '8px' }}>{user?.first_name} {user?.last_name}</div>
          {user?.is_admin && (
            <button
              onClick={() => navigate('/admin')}
              style={{ fontSize: '13px', color: '#8a9e78', background: 'none', border: '1px solid #8a9e78', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', width: '100%', marginBottom: '8px', fontFamily: 'Varela Round, sans-serif' }}
            >
              <i className="ti ti-arrow-right" aria-hidden="true"></i> חזרה לניהול
            </button>
          )}
          <button onClick={logout} style={{ fontSize: '13px', color: '#8a7a6e', background: 'none', border: '1px solid #e2dacc', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', width: '100%', fontFamily: 'Varela Round, sans-serif' }}>התנתק</button>
        </div>
      </div>

      <div style={styles.main}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', color: '#4a3f35', margin: 0 }}>{TABS.find(t => t.id === activeTab)?.label}</h1>
          <div style={{ width: '28px', height: '1.5px', backgroundColor: '#8a9e78', marginTop: '8px' }}></div>
        </div>

        {/* פרופיל */}
        {activeTab === 'profile' && (
          <div style={styles.card}>
            <div style={{ fontSize: '12px', color: '#c8baa6', marginBottom: '18px' }}>
              ניתן לעדכן את הפרטים האישיים. השינויים יישמרו לאחר לחיצה על "שמור שינויים".
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={styles.label}>שם פרטי</label>
                <input style={styles.input} value={profile.first_name} onChange={e => setProfile(p => ({ ...p, first_name: e.target.value }))} />
              </div>
              <div>
                <label style={styles.label}>שם משפחה</label>
                <input style={styles.input} value={profile.last_name} onChange={e => setProfile(p => ({ ...p, last_name: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={styles.label}>אימייל</label>
              <input style={styles.input} value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label style={styles.label}>טלפון</label>
              <input style={styles.input} value={profile.phone_number} onChange={e => setProfile(p => ({ ...p, phone_number: e.target.value }))} placeholder="05X-XXXXXXX" />
            </div>

            {(profileDirty || profileSaved) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f0ebe3' }}>
                {profileDirty && (
                  <>
                    <button onClick={handleSaveProfile} style={styles.btnSave}>שמור שינויים</button>
                    <button onClick={handleCancelProfile} style={styles.btnOutline}>ביטול</button>
                  </>
                )}
                {profileSaved && !profileDirty && <span style={{ fontSize: '13px', color: '#8a9e78' }}>✓ נשמר בהצלחה</span>}
              </div>
            )}
          </div>
        )}

        {/* העדפות שעות */}
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
              <>
                <div style={{ fontSize: '12px', color: '#8a9e78', marginBottom: '14px', height: '16px' }}>
                  {prefsSaved ? '✓ ההעדפות נשמרו' : 'כל שינוי נשמר אוטומטית'}
                </div>

                <div style={styles.card}>
                  <div style={{ fontSize: '15px', color: '#4a3f35', marginBottom: '20px' }}>נתוני הוראה</div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ ...styles.label, fontSize: '13px', marginBottom: '2px' }}>מקצועות שאני מלמד</label>
                    <div style={{ fontSize: '11px', color: '#c8baa6', marginBottom: '8px' }}>
                      {mySubjects.length === 0 ? 'לא נבחרו מקצועות' : `${mySubjects.length} מקצועות נבחרו`}
                    </div>
                    {subjects.length === 0 ? (
                      <div style={{ fontSize: '13px', color: '#c8baa6', padding: '12px 0' }}>טוען מקצועות...</div>
                    ) : (
                      <SubjectCheckboxGrid subjects={subjects} mySubjects={mySubjects} onToggle={handleToggleSubject} />
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid #f0ebe3', margin: '4px 0 20px' }} />

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ ...styles.label, fontSize: '13px' }}>סמן/י את שכבות הגיל (א'-ו') שבהן תרצה ללמד. ניתן לבחור יותר מאחת. </label>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      {GRADES.map(grade => {
                        const selected = myGradeLevels.includes(grade);
                        return (
                          <button key={grade} onClick={() => {
                            setMyGradeLevels(prev => selected ? prev.filter(g => g !== grade) : [...prev, grade]);
                            const call = selected ? removeMyGradeLevel(grade) : addMyGradeLevel(grade);
                            call.catch(() => setMyGradeLevels(prev => selected ? [...prev, grade] : prev.filter(g => g !== grade)));
                          }} style={styles.chipBtn(selected)}>
                            כיתה {GRADE_LABELS[grade]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #f0ebe3', margin: '4px 0 20px' }} />

                  <div>
                    <label style={{ ...styles.label, fontSize: '13px' }}>חינוך</label>
                    <div style={{ fontSize: '11px', color: '#c8baa6', marginBottom: '10px' }}>
                      האם תרצה לשמש כמחנך השנה?
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                      <button
                        onClick={() => { const next = { ...homeroomPref, wants_homeroom: true }; setHomeroomPref(next); saveHomeroom(next); }}
                        style={styles.chipBtn(homeroomPref.wants_homeroom === true)}
                      >
                        כן, אני רוצה לחנך
                      </button>
                      <button
                        onClick={() => { const next = { wants_homeroom: false, preferred_group_id: null }; setHomeroomPref(next); saveHomeroom(next); }}
                        style={styles.chipBtn(homeroomPref.wants_homeroom === false)}
                      >
                        לא
                      </button>
                    </div>

                    {homeroomPref.wants_homeroom === true && (
                      <div style={{ backgroundColor: '#f5f2ee', borderRadius: '10px', padding: '16px' }}>
                        <label style={{ ...styles.label, fontSize: '13px' }}>כיתה מועדפת לחינוך</label>
                        <div style={{ fontSize: '11px', color: '#c8baa6', marginBottom: '10px' }}>
                          אם אין העדפה, השאר ריק
                        </div>
                        <select
                          value={homeroomPref.preferred_group_id || ''}
                          onChange={e => { const next = { ...homeroomPref, preferred_group_id: e.target.value ? parseInt(e.target.value) : null }; setHomeroomPref(next); saveHomeroom(next); }}
                          style={{ ...styles.input, cursor: 'pointer' }}
                        >
                          <option value="">אין העדפה מיוחדת</option>
                          {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.group_name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                <div style={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '15px', color: '#4a3f35', marginBottom: '4px' }}>סמן זמינות</div>
                      <div style={{ fontSize: '12px', color: '#8a7a6e' }}>
                        סמנו את המגבלות שלכם בקליק על התא: תא ריק = פנוי ללמד. לחיצה אחת - מעדיף שלא, לחיצה שנייה - לא יכול כלל, ולחיצה שלישית מנקה את הסימון וחוזרת למצב "פנוי".
                      </div>
                      <div style={{ fontSize: '12px', color: '#8a7a6e', marginTop: '4px' }}>
                        לבחירה ישירה ומהירה, ניתן ללחוץ קליק ימני על התא ולבחור את האפשרות הרצויה מהתפריט.
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8a7a6e' }}>
                        <div style={{ width: '14px', height: '14px', borderRadius: '4px', backgroundColor: '#FFF3A3', border: '1px solid #e8d88a' }}></div>
                        מעדיף שלא
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8a7a6e' }}>
                        <div style={{ width: '14px', height: '14px', borderRadius: '4px', backgroundColor: '#FAE8E8', border: '1px solid #e8c0b0' }}></div>
                        לא יכול
                      </div>
                    </div>
                  </div>
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
                            <td style={{ padding: '8px 12px', color: '#c8baa6', whiteSpace: 'nowrap' }}>שיעור {hour}</td>
                            {DAYS.map((day, dayIdx) => {
                              const key = `${dayIdx}-${hour}`;
                              const cell = cellStates[key];
                              const state = cell?.state || 'free';
                              const colors = CELL_COLORS[state];
                              return (
                                <td key={day} style={{ padding: '4px 8px', textAlign: 'center' }}>
                                  <div
                                    onClick={() => handleCellClick(dayIdx, hour)}
                                    onContextMenu={e => {
                                      e.preventDefault();
                                      setQuickPick({ dayIdx, hour, x: e.clientX, y: e.clientY });
                                    }}
                                    title={cell?.reason || 'לחיצה ימנית לבחירה ישירה'}
                                    style={{ width: '40px', height: '40px', borderRadius: '8px', margin: '0 auto', cursor: 'pointer', backgroundColor: colors.bg, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', position: 'relative' }}>
                                    {colors.icon && <i className={`ti ${colors.icon}`} style={{ fontSize: '14px', color: colors.color }} aria-hidden="true"></i>}
                                    {cell?.reason && <div style={{ position: 'absolute', top: '2px', right: '2px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#8a9e78' }}></div>}
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

                <div style={styles.card}>
                  <div style={{ fontSize: '15px', color: '#4a3f35', marginBottom: '16px' }}>שעות שבועיות</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '8px' }}>
                    <div>
                      <label style={styles.label}>מינימום שעות</label>
                      <input type="number" min="1" max="40" value={preferences.min_hours}
                        onChange={e => setPreferences(p => ({ ...p, min_hours: parseInt(e.target.value) || 0 }))}
                        onBlur={() => savePreferences(preferences)}
                        style={styles.input} />
                    </div>
                    <div>
                      <label style={styles.label}>מכסת שעות (נקבע ע״י המנהל)</label>
                      <div style={styles.readonlyField}>{user?.weekly_hours_quota ?? '—'}</div>
                    </div>
                    <div>
                      <label style={styles.label}>מקסימום שעות</label>
                      <input type="number" min="1" max="40" value={preferences.max_hours}
                        onChange={e => setPreferences(p => ({ ...p, max_hours: parseInt(e.target.value) || 0 }))}
                        onBlur={() => savePreferences(preferences)}
                        style={styles.input} />
                    </div>
                  </div>
                  <div>
                    <label style={styles.label}>העדפת שיעורים</label>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <button onClick={() => setConsecutive(true)} style={styles.chipBtn(preferences.preferred_consecutive)}>רצופים</button>
                      <button onClick={() => setConsecutive(false)} style={styles.chipBtn(!preferences.preferred_consecutive)}>עם הפסקות</button>
                    </div>
                  </div>
                </div>

                <div style={styles.card}>
                  <div style={{ fontSize: '15px', color: '#4a3f35', marginBottom: '4px' }}>עדיפויות</div>
                  <div style={{ fontSize: '12px', color: '#8a7a6e', marginBottom: '8px' }}>הפעל/י את מה שחשוב לך במערכת השעות. מה שמופעל יילקח בחשבון כהעדפה רכה.</div>
                  <PriorityToggle label="סיום מוקדם" field="priority_early_finish" />
                  <PriorityToggle label="הימנעות מחלונות" field="priority_no_gaps" />
                  <PriorityToggle label="יום חופשי" field="priority_free_day" />
                  <PriorityToggle label="שיעורים רצופים" field="priority_consecutive" />
                </div>
              </>
            )}
          </>
        )}

        {/* פניות */}
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

        {/* מערכת השעות שלי — הגריד האמיתי מהמערכת שפורסמה */}
        {activeTab === 'schedule' && (
          <>
            {myRun && myEntries.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
                <button onClick={handleExportMySchedule} style={{ ...styles.btnOutline, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="ti ti-file-spreadsheet" aria-hidden="true"></i> ייצוא לאקסל
                </button>
              </div>
            )}
          <div style={styles.card}>
            {scheduleLoading ? (
              <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>טוען…</div>
            ) : scheduleError ? (
              <div style={{ textAlign: 'center', color: '#c0705a', padding: '40px' }}>{scheduleError}</div>
            ) : !myRun ? (
              <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>
                <i className="ti ti-calendar" style={{ fontSize: '36px', display: 'block', marginBottom: '14px' }} aria-hidden="true"></i>
                <div style={{ fontSize: '15px' }}>מערכת השעות עדיין לא פורסמה</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                {myRun?.published_at && (
                  <div style={{ textAlign: 'left', fontSize: '12px', color: '#8a7a6e', marginBottom: '10px' }}>
                    פורסם ב-{fmtDate(myRun.published_at)}
                  </div>
                )}
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.gridHeadCell, width: '60px' }}>שעה</th>
                      {DAY_ORDER.map(d => <th key={d} style={styles.gridHeadCell}>{DAY_NAMES_BY_NUM[d]}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {HOURS.map(hour => (
                      <tr key={hour}>
                        <td style={styles.gridHourCell}>שיעור {hour}</td>
                        {DAY_ORDER.map(day => {
                          const lessons = scheduleCell(day, hour);
                          return (
                            <td key={day} style={styles.gridCell}>
                              {lessons.map((e, idx) => (
                                <div key={idx} style={styles.lessonBox}>
                                  <div style={{ fontWeight: 600 }}>{e.subject_name}</div>
                                  <div style={{ color: '#8a7a6e' }}>{e.group_name}</div>
                                  {e.room_name && <div style={{ color: '#a99', fontSize: '10px' }}>{e.room_name}</div>}
                                </div>
                              ))}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </>
        )}
      </div>

      {/* מודאל סיבה */}
      {reasonModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setReasonModal(null)}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2dacc', padding: '32px', width: '400px' }} onClick={e => e.stopPropagation()} dir="rtl">
            <h3 style={{ fontSize: '16px', color: '#4a3f35', marginBottom: '16px' }}>סיבת האילוץ (אופציונלי)</h3>
            <textarea value={reasonModal.reason} onChange={e => setReasonModal(prev => ({ ...prev, reason: e.target.value }))}
              style={{ ...styles.input, height: '80px', resize: 'vertical', marginBottom: '16px' }}
              placeholder="למשל: טיפול רפואי, הסעת ילדים..." />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setReasonModal(null)} style={styles.btnOutline}>דלג</button>
              <button onClick={handleSaveReason} style={styles.btnSave}>שמור</button>
            </div>
          </div>
        </div>
      )}

      {/* תפריט בחירה ישירה — קליק ימני על תא */}
      {quickPick && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100 }} onClick={() => setQuickPick(null)} onContextMenu={e => { e.preventDefault(); setQuickPick(null); }}>
          <div
            onClick={e => e.stopPropagation()}
            dir="rtl"
            style={{
              position: 'fixed',
              top: Math.min(quickPick.y, window.innerHeight - 220),
              left: Math.min(quickPick.x, window.innerWidth - 180),
              backgroundColor: '#fff',
              border: '1px solid #e2dacc',
              borderRadius: '10px',
              boxShadow: '0 6px 20px rgba(74,63,53,0.15)',
              padding: '6px',
              width: '170px',
            }}
          >
            {['preferred_not', 'unavailable', 'free'].map(state => {
              const isFree = state === 'free';
              const colors = isFree ? { color: '#8a7a6e' } : CELL_COLORS[state];
              return (
                <button
                  key={state}
                  onClick={() => handleQuickPick(quickPick.dayIdx, quickPick.hour, state)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                    padding: '8px 10px', fontSize: '13px', color: '#4a3f35',
                    background: 'none', border: 'none', borderRadius: '6px', cursor: 'pointer',
                    textAlign: 'right', fontFamily: 'Varela Round, sans-serif',
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FAF7F2'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: isFree ? '#f5f2ee' : colors.bg, border: `1px solid ${isFree ? '#e2dacc' : colors.border}`, flexShrink: 0 }}></span>
                  {isFree ? 'נקה' : STATE_LABELS[state]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
