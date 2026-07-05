import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTeachers, deleteTeacher, getRooms, deleteRoom, getSubjects, deleteSubject, getStudentGroups, deleteStudentGroup, getMyRequests, respondToRequest, getSubmissionWindows, createSubmissionWindow, deleteSubmissionWindow } from '../services/api';
import AddTeacherModal from '../components/AddTeacherModal';
import AddRoomModal from '../components/AddRoomModal';
import AddSubjectModal from '../components/AddSubjectModal';
import AddGroupModal from '../components/AddGroupModal';

const TABS = [
  { id: 'schedule', label: 'מערכת שעות', icon: 'ti-calendar' },
  { id: 'requests', label: 'פניות מורים', icon: 'ti-message' },
  { id: 'windows', label: 'חלונות הגשה', icon: 'ti-calendar-event' },
  { id: 'notifications', label: 'התראות', icon: 'ti-bell' },
  { id: 'teachers', label: 'מורים', icon: 'ti-users' },
  { id: 'rooms', label: 'חדרים', icon: 'ti-building' },
  { id: 'subjects', label: 'מקצועות', icon: 'ti-book' },
  { id: 'groups', label: 'קבוצות', icon: 'ti-school' },
];

const REQUEST_TYPES = {
  constraint_change: 'שינוי אילוץ',
  absence: 'בקשת היעדרות',
  general: 'פנייה כללית',
};

const statusLabel = (s) => ({ pending: 'ממתין', approved: 'אושר', rejected: 'נדחה' }[s] || s);
const statusColor = (s) => ({ pending: '#c8baa6', approved: '#8a9e78', rejected: '#c0705a' }[s] || '#c8baa6');

// מחלץ את שכבת הגיל משם הכיתה — "כיתה א1" → "א", "כיתה ו2" → "ו"
// מחפש את האות שמגיעה אחרי "כיתה " (לא את האות הראשונה במחרוזת, כי "כיתה" עצמה מתחילה ב-כ')
const extractGrade = (groupName) => {
  const match = groupName.match(/כיתה\s*([א-ת])/);
  if (match) return match[1];
  // נפילה לאחור: אם אין "כיתה" במחרוזת, לוקחים את האות הראשונה בכל זאת
  const fallback = groupName.match(/[א-ת]/);
  return fallback ? fallback[0] : 'אחר';
};

// TODO: כשהאלגוריתם יוכן, להחליף בקריאת API אמיתית שבודקת אם קיימת מערכת שעות לכיתה (טבלת schedule)
const hasScheduleGenerated = () => false;

const styles = {
  layout: { display: 'flex', backgroundColor: '#FAF7F2', minHeight: '100vh', direction: 'rtl' },
  sidebar: { width: '260px', backgroundColor: '#fff', borderLeft: '1px solid #e2dacc', display: 'flex', flexDirection: 'column', padding: '28px 0', flexShrink: 0 },
  sidebarTop: { padding: '0 24px', marginBottom: '32px' },
  brand: { fontSize: '11px', letterSpacing: '0.14em', color: '#c8baa6', marginBottom: '4px' },
  brandName: { fontSize: '17px', color: '#4a3f35' },
  navItem: (active) => ({ padding: '13px 24px', fontSize: '15px', color: active ? '#4a3f35' : '#8a7a6e', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', borderRight: active ? '3px solid #8a9e78' : '3px solid transparent', backgroundColor: active ? '#FAF7F2' : 'transparent', border: 'none', width: '100%', textAlign: 'right', fontFamily: 'Varela Round, sans-serif' }),
  divider: { margin: '12px 24px', borderBottom: '1px solid #e2dacc' },
  main: { flex: 1, padding: '40px 48px' },
  pageTitle: { fontSize: '22px', color: '#4a3f35', margin: 0 },
  titleLine: { width: '28px', height: '1.5px', backgroundColor: '#8a9e78', marginTop: '8px' },
  card: { backgroundColor: '#fff', borderRadius: '14px', border: '1px solid #e2dacc', padding: '24px', marginBottom: '24px' },
  statCard: { backgroundColor: '#fff', border: '1px solid #e2dacc', borderRadius: '14px', padding: '18px 22px', flex: 1 },
  statLabel: { fontSize: '12px', color: '#c8baa6', marginBottom: '6px' },
  statValue: { fontSize: '26px', color: '#4a3f35' },
  btnAdd: { backgroundColor: '#8a9e78', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Varela Round, sans-serif' },
  btnOutline: { backgroundColor: 'transparent', color: '#8a7a6e', border: '1px solid #e2dacc', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', cursor: 'pointer', fontFamily: 'Varela Round, sans-serif' },
  tableHeader: { display: 'flex', fontSize: '12px', color: '#c8baa6', paddingBottom: '12px', borderBottom: '1px solid #e2dacc', gap: '12px' },
  tableRow: { display: 'flex', alignItems: 'center', padding: '14px 0', fontSize: '14px', color: '#4a3f35', gap: '12px' },
  avatar: { width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#EDF4E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#6b8f5e', flexShrink: 0 },
  badge: { fontSize: '12px', padding: '4px 12px', borderRadius: '20px', backgroundColor: '#EDF4E8', color: '#6b8f5e' },
  iconBtn: { fontSize: '16px', color: '#c8baa6', cursor: 'pointer' },
  input: { width: '100%', padding: '10px 14px', border: '1px solid #e2dacc', borderRadius: '8px', fontSize: '14px', color: '#4a3f35', backgroundColor: '#FAF7F2', outline: 'none', boxSizing: 'border-box', fontFamily: 'Varela Round, sans-serif' },
  label: { display: 'block', fontSize: '12px', color: '#8a7a6e', marginBottom: '6px' },
};

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('schedule');
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [groups, setGroups] = useState([]);
  const [requests, setRequests] = useState([]);
  const [windows, setWindows] = useState([]);
  const [modal, setModal] = useState(null);
  const [respondModal, setRespondModal] = useState(null);
  const [response, setResponse] = useState({ status: 'approved', admin_response: '' });
  const [newWindow, setNewWindow] = useState({ title: '', start_date: '', end_date: '' });
  const [pendingCount, setPendingCount] = useState(0);
  const [scheduleModalTeacher, setScheduleModalTeacher] = useState(null);
  const [openGrades, setOpenGrades] = useState({});

  useEffect(() => {
    getTeachers().then(r => setTeachers(r.data));
    if (activeTab === 'rooms') getRooms().then(r => setRooms(r.data));
    if (activeTab === 'subjects') { getRooms().then(r => setRooms(r.data)); getSubjects().then(r => setSubjects(r.data)); }
    if (activeTab === 'groups') { getRooms().then(r => setRooms(r.data)); getStudentGroups().then(r => setGroups(r.data)); }
    if (activeTab === 'schedule') { getStudentGroups().then(r => setGroups(r.data)); }
    if (activeTab === 'requests') getMyRequests().then(r => { setRequests(r.data); setPendingCount(r.data.filter(x => x.status === 'pending').length); });
    if (activeTab === 'windows') getSubmissionWindows().then(r => setWindows(r.data));
  }, [activeTab]);

  useEffect(() => {
    getMyRequests().then(r => setPendingCount(r.data.filter(x => x.status === 'pending').length)).catch(() => {});
  }, []);

  const handleDelete = async (type, id) => {
    if (!window.confirm('למחוק?')) return;
    if (type === 'teacher') { await deleteTeacher(id); setTeachers(prev => prev.filter(x => x.id !== id)); }
    if (type === 'room') { await deleteRoom(id); setRooms(prev => prev.filter(x => x.id !== id)); }
    if (type === 'subject') { await deleteSubject(id); setSubjects(prev => prev.filter(x => x.id !== id)); }
    if (type === 'group') { await deleteStudentGroup(id); setGroups(prev => prev.filter(x => x.id !== id)); }
    if (type === 'window') { await deleteSubmissionWindow(id); setWindows(prev => prev.filter(x => x.id !== id)); }
  };

  const handleRespond = async () => {
    await respondToRequest(respondModal.id, response);
    setRequests(prev => prev.map(r => r.id === respondModal.id ? { ...r, ...response } : r));
    setPendingCount(prev => response.status !== 'pending' ? prev - 1 : prev);
    setRespondModal(null);
    setResponse({ status: 'approved', admin_response: '' });
  };

  const handleCreateWindow = async () => {
    console.log('newWindow:', newWindow);
    if (!newWindow.title || !newWindow.start_date || !newWindow.end_date) return;
    try {
      const res = await createSubmissionWindow(newWindow);
      console.log('res:', res);
      setWindows(prev => [...prev, res.data]);
      setNewWindow({ title: '', start_date: '', end_date: '' });
    } catch (err) {
      console.log('error:', err);
    }
  };

  const initials = (t) => `${t.first_name?.[0] || ''}${t.last_name?.[0] || ''}`;

  return (
    <div style={styles.layout}>

      <div style={styles.sidebar}>
        <div style={styles.sidebarTop}>
          <div style={styles.brand}>SMARTIME</div>
          <div style={styles.brandName}>פאנל ניהול</div>
        </div>
        <nav style={{ flex: 1 }}>
          {['schedule', 'requests', 'windows', 'notifications'].map(id => {
            const tab = TABS.find(t => t.id === id);
            return (
              <button key={id} onClick={() => setActiveTab(id)} style={styles.navItem(activeTab === id)}>
                <i className={`ti ${tab.icon}`} style={{ fontSize: '18px' }} aria-hidden="true"></i>
                {tab.label}
                {id === 'requests' && pendingCount > 0 && (
                  <span style={{ marginRight: 'auto', backgroundColor: '#FAE8E8', color: '#c0705a', borderRadius: '10px', padding: '2px 8px', fontSize: '12px' }}>{pendingCount}</span>
                )}
              </button>
            );
          })}
          <div style={styles.divider}></div>
          {['teachers', 'rooms', 'subjects', 'groups'].map(id => {
            const tab = TABS.find(t => t.id === id);
            return (
              <button key={id} onClick={() => setActiveTab(id)} style={styles.navItem(activeTab === id)}>
                <i className={`ti ${tab.icon}`} style={{ fontSize: '18px' }} aria-hidden="true"></i>
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div style={{ padding: '0 24px' }}>
          <div style={{ fontSize: '12px', color: '#c8baa6', marginBottom: '8px' }}>{user?.first_name} {user?.last_name}</div>
          <button onClick={logout} style={{ ...styles.btnOutline, width: '100%' }}>התנתק</button>
        </div>
      </div>

      <div style={styles.main}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h1 style={styles.pageTitle}>{TABS.find(t => t.id === activeTab)?.label}</h1>
            <div style={styles.titleLine}></div>
          </div>
          {activeTab === 'teachers' && <button style={styles.btnAdd} onClick={() => setModal('teacher')}><i className="ti ti-plus" aria-hidden="true"></i> הוסף מורה</button>}
          {activeTab === 'rooms' && <button style={styles.btnAdd} onClick={() => setModal('room')}><i className="ti ti-plus" aria-hidden="true"></i> הוסף חדר</button>}
          {activeTab === 'subjects' && <button style={styles.btnAdd} onClick={() => setModal('subject')}><i className="ti ti-plus" aria-hidden="true"></i> הוסף מקצוע</button>}
          {activeTab === 'groups' && <button style={styles.btnAdd} onClick={() => setModal('group')}><i className="ti ti-plus" aria-hidden="true"></i> הוסף קבוצה</button>}
        </div>

        {/* פניות מורים */}
        {activeTab === 'requests' && (
          <div style={styles.card}>
            {requests.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px', fontSize: '14px' }}>אין פניות עדיין</div>
            ) : requests.map((req, i) => (
              <div key={req.id} style={{ padding: '16px 0', borderBottom: i < requests.length - 1 ? '1px solid #f0ebe3' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '14px', color: '#4a3f35', marginBottom: '4px' }}>
                      {REQUEST_TYPES[req.request_type] || req.request_type}
                      <span style={{ fontSize: '12px', color: '#c8baa6', marginRight: '8px' }}>
                        {teachers.find(t => t.id === req.teacher_id)?.first_name} {teachers.find(t => t.id === req.teacher_id)?.last_name}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#8a7a6e' }}>{req.description}</div>
                    {req.admin_response && (
                      <div style={{ fontSize: '12px', color: '#6b8f5e', backgroundColor: '#EDF4E8', borderRadius: '6px', padding: '6px 10px', marginTop: '8px' }}>
                        תשובה: {req.admin_response}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span style={{ fontSize: '12px', color: statusColor(req.status), backgroundColor: `${statusColor(req.status)}20`, padding: '3px 10px', borderRadius: '20px' }}>
                      {statusLabel(req.status)}
                    </span>
                    {req.status === 'pending' && (
                      <button onClick={() => { setRespondModal(req); setResponse({ status: 'approved', admin_response: '' }); }} style={styles.btnAdd}>
                        טפל
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#c8baa6' }}>{new Date(req.created_at).toLocaleDateString('he-IL')}</div>
              </div>
            ))}
          </div>
        )}

        {/* חלונות הגשה */}
        {activeTab === 'windows' && (
          <>
            <div style={styles.card}>
              <h3 style={{ fontSize: '15px', color: '#4a3f35', marginBottom: '16px' }}>פתח חלון הגשה חדש</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={styles.label}>כותרת</label>
                  <input style={styles.input} value={newWindow.title} onChange={e => setNewWindow({ ...newWindow, title: e.target.value })} placeholder='העדפות מחצית א׳' />
                </div>
                <div>
                  <label style={styles.label}>תאריך פתיחה</label>
                  <input type="datetime-local" style={styles.input} value={newWindow.start_date} onChange={e => setNewWindow({ ...newWindow, start_date: e.target.value })} />
                </div>
                <div>
                  <label style={styles.label}>תאריך סגירה</label>
                  <input type="datetime-local" style={styles.input} value={newWindow.end_date} onChange={e => setNewWindow({ ...newWindow, end_date: e.target.value })} />
                </div>
              </div>
              <button onClick={handleCreateWindow} style={styles.btnAdd}>
                <i className="ti ti-plus" aria-hidden="true"></i> צור חלון
              </button>
            </div>

            <div style={styles.card}>
              <div style={styles.tableHeader}>
                <div style={{ flex: 3 }}>כותרת</div>
                <div style={{ flex: 2 }}>פתיחה</div>
                <div style={{ flex: 2 }}>סגירה</div>
                <div style={{ flex: 1 }}>סטטוס</div>
                <div style={{ width: '40px' }}></div>
              </div>
              {windows.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#c8baa6', padding: '24px', fontSize: '14px' }}>אין חלונות הגשה</div>
              ) : windows.map((w, i) => {
                const now = new Date();
                const start = new Date(w.start_date);
                const end = new Date(w.end_date);
                const isActive = start <= now && end >= now && w.is_active;
                return (
                  <div key={w.id} style={{ ...styles.tableRow, borderBottom: i < windows.length - 1 ? '1px solid #f0ebe3' : 'none' }}>
                    <div style={{ flex: 3 }}>{w.title}</div>
                    <div style={{ flex: 2, color: '#8a7a6e' }}>{new Date(w.start_date).toLocaleString('he-IL')}</div>
                    <div style={{ flex: 2, color: '#8a7a6e' }}>{new Date(w.end_date).toLocaleString('he-IL')}</div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '20px', backgroundColor: isActive ? '#EDF4E8' : '#f0ebe3', color: isActive ? '#6b8f5e' : '#c8baa6' }}>
                        {isActive ? 'פעיל' : 'לא פעיל'}
                      </span>
                    </div>
                    <div style={{ width: '40px' }}>
                      <i className="ti ti-trash" onClick={() => handleDelete('window', w.id)} style={styles.iconBtn} aria-hidden="true"></i>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Teachers */}
        {activeTab === 'teachers' && (
          <div style={styles.card}>
            <div style={styles.tableHeader}>
              <div style={{ width: '34px' }}></div>
              <div style={{ flex: 3 }}>שם</div>
              <div style={{ flex: 3 }}>אימייל</div>
              <div style={{ flex: 1 }}>שעות</div>
              <div style={{ flex: 1 }}>תפקיד</div>
              <div style={{ width: '88px' }}></div>
            </div>
            {teachers.map((teacher, i) => (
              <div key={teacher.id} style={{ ...styles.tableRow, borderBottom: i < teachers.length - 1 ? '1px solid #f0ebe3' : 'none' }}>
                <div style={styles.avatar}>{initials(teacher)}</div>
                <div style={{ flex: 3 }}>{teacher.first_name} {teacher.last_name}</div>
                <div style={{ flex: 3, color: '#8a7a6e' }}>{teacher.email}</div>
                <div style={{ flex: 1 }}>{teacher.weekly_hours_quota}</div>
                <div style={{ flex: 1 }}>
                  <span style={{ ...styles.badge, ...(teacher.is_admin ? { backgroundColor: '#E8F2FA', color: '#5a8ac0' } : {}) }}>
                    {teacher.is_admin ? 'מנהל' : 'מורה'}
                  </span>
                </div>
                <div style={{ width: '88px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <i
                    className="ti ti-calendar"
                    onClick={() => setScheduleModalTeacher(teacher)}
                    style={styles.iconBtn}
                    title="מערכת שעות אישית"
                    aria-hidden="true"
                  ></i>
                  <i className="ti ti-edit" style={styles.iconBtn} aria-hidden="true"></i>
                  <i className="ti ti-trash" onClick={() => handleDelete('teacher', teacher.id)} style={styles.iconBtn} aria-hidden="true"></i>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rooms */}
        {activeTab === 'rooms' && (
          <div style={styles.card}>
            <div style={styles.tableHeader}>
              <div style={{ flex: 3 }}>שם החדר</div>
              <div style={{ flex: 1 }}>קיבולת</div>
              <div style={{ width: '52px' }}></div>
            </div>
            {rooms.map((room, i) => (
              <div key={room.id} style={{ ...styles.tableRow, borderBottom: i < rooms.length - 1 ? '1px solid #f0ebe3' : 'none' }}>
                <div style={{ flex: 3 }}>{room.room_name}</div>
                <div style={{ flex: 1 }}>{room.capacity} מקומות</div>
                <div style={{ width: '52px', display: 'flex', gap: '10px' }}>
                  <i className="ti ti-edit" style={styles.iconBtn} aria-hidden="true"></i>
                  <i className="ti ti-trash" onClick={() => handleDelete('room', room.id)} style={styles.iconBtn} aria-hidden="true"></i>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Subjects */}
        {activeTab === 'subjects' && (
          <div style={styles.card}>
            <div style={styles.tableHeader}>
              <div style={{ flex: 3 }}>שם המקצוע</div>
              <div style={{ flex: 2 }}>חדר ייעודי</div>
              <div style={{ width: '52px' }}></div>
            </div>
            {subjects.map((subject, i) => (
              <div key={subject.id} style={{ ...styles.tableRow, borderBottom: i < subjects.length - 1 ? '1px solid #f0ebe3' : 'none' }}>
                <div style={{ flex: 3 }}>{subject.subject_name}</div>
                <div style={{ flex: 2, color: '#8a7a6e' }}>
                  {subject.required_room_id ? rooms.find(r => r.id === subject.required_room_id)?.room_name || '—' : '—'}
                </div>
                <div style={{ width: '52px', display: 'flex', gap: '10px' }}>
                  <i className="ti ti-edit" style={styles.iconBtn} aria-hidden="true"></i>
                  <i className="ti ti-trash" onClick={() => handleDelete('subject', subject.id)} style={styles.iconBtn} aria-hidden="true"></i>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Groups */}
        {activeTab === 'groups' && (
          <div style={styles.card}>
            <div style={styles.tableHeader}>
              <div style={{ flex: 3 }}>שם הקבוצה</div>
              <div style={{ flex: 1 }}>תלמידים</div>
              <div style={{ flex: 2 }}>חדר בית</div>
              <div style={{ width: '52px' }}></div>
            </div>
            {groups.map((group, i) => (
              <div key={group.id} style={{ ...styles.tableRow, borderBottom: i < groups.length - 1 ? '1px solid #f0ebe3' : 'none' }}>
                <div style={{ flex: 3 }}>{group.group_name}</div>
                <div style={{ flex: 1 }}>{group.student_count}</div>
                <div style={{ flex: 2, color: '#8a7a6e' }}>{rooms.find(r => r.id === group.home_room_id)?.room_name || '—'}</div>
                <div style={{ width: '52px', display: 'flex', gap: '10px' }}>
                  <i className="ti ti-edit" style={styles.iconBtn} aria-hidden="true"></i>
                  <i className="ti ti-trash" onClick={() => handleDelete('group', group.id)} style={styles.iconBtn} aria-hidden="true"></i>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* מערכת שעות — אקורדיון לפי שכבת גיל */}
        {activeTab === 'schedule' && (
          groups.length === 0 ? (
            <div style={{ ...styles.card, minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: '#c8baa6' }}>
                <i className="ti ti-calendar" style={{ fontSize: '36px', display: 'block', marginBottom: '14px' }} aria-hidden="true"></i>
                <div style={{ fontSize: '15px' }}>אין עדיין כיתות במערכת</div>
              </div>
            </div>
          ) : (
            (() => {
              // קיבוץ הכיתות לפי שכבת גיל, בסדר א'-ת'
              const byGrade = {};
              groups.forEach(g => {
                const grade = extractGrade(g.group_name);
                if (!byGrade[grade]) byGrade[grade] = [];
                byGrade[grade].push(g);
              });
              const gradeOrder = Object.keys(byGrade).sort((a, b) => a.localeCompare(b, 'he'));

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {gradeOrder.map(grade => {
                    const classesInGrade = byGrade[grade];
                    const readyCount = classesInGrade.filter(g => hasScheduleGenerated(g.id)).length;
                    const isOpen = !!openGrades[grade];

                    return (
                      <div key={grade} style={{ backgroundColor: '#fff', borderRadius: '14px', border: '1px solid #e2dacc', overflow: 'hidden' }}>
                        {/* כותרת שכבה — לחיצה פותחת/סוגרת */}
                        <button
                          onClick={() => setOpenGrades(prev => ({ ...prev, [grade]: !prev[grade] }))}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '18px 24px', background: 'none', border: 'none', cursor: 'pointer',
                            fontFamily: 'Varela Round, sans-serif',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <i className={`ti ${isOpen ? 'ti-chevron-down' : 'ti-chevron-left'}`} style={{ fontSize: '16px', color: '#c8baa6' }} aria-hidden="true"></i>
                            <span style={{ fontSize: '15px', color: '#4a3f35' }}>שכבת {grade}׳</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '12px', color: '#8a7a6e' }}>
                              {readyCount} מתוך {classesInGrade.length} מוכנות
                            </span>
                            <span style={{
                              fontSize: '12px', padding: '3px 10px', borderRadius: '20px',
                              backgroundColor: readyCount === classesInGrade.length ? '#EDF4E8' : '#f0ebe3',
                              color: readyCount === classesInGrade.length ? '#6b8f5e' : '#c8baa6',
                            }}>
                              {classesInGrade.length} כיתות
                            </span>
                          </div>
                        </button>

                        {/* תוכן השכבה — כרטיסיות הכיתות */}
                        {isOpen && (
                          <div style={{ padding: '4px 24px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 150px))', gap: '14px' }}>
                            {classesInGrade.map(group => {
                              const ready = hasScheduleGenerated(group.id);
                              return (
                                <button
                                  key={group.id}
                                  onClick={() => navigate(`/admin/class/${group.id}`)}
                                  style={{
                                    backgroundColor: '#FAF7F2',
                                    border: '1px solid #e2dacc',
                                    borderRadius: '12px',
                                    padding: '20px 14px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '10px',
                                    fontFamily: 'Varela Round, sans-serif',
                                    position: 'relative',
                                    transition: 'border-color 0.15s',
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#8a9e78'; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2dacc'; }}
                                >
                                  {/* אינדיקציית מוכנות */}
                                  <div style={{
                                    position: 'absolute', top: '10px', left: '10px',
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    backgroundColor: ready ? '#8a9e78' : '#e2dacc',
                                  }} title={ready ? 'מערכת שעות קיימת' : 'טרם נוצרה מערכת שעות'}></div>

                                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: ready ? '#EDF4E8' : '#f0ebe3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <i className="ti ti-calendar-event" style={{ fontSize: '18px', color: ready ? '#6b8f5e' : '#c8baa6' }} aria-hidden="true"></i>
                                  </div>
                                  <span style={{ fontSize: '14px', color: '#4a3f35' }}>{group.group_name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )
        )}

        {activeTab === 'notifications' && (
          <div style={{ ...styles.card, minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: '#c8baa6' }}>
              <i className={`ti ${TABS.find(t => t.id === activeTab)?.icon}`} style={{ fontSize: '36px', display: 'block', marginBottom: '14px' }} aria-hidden="true"></i>
              <div style={{ fontSize: '15px' }}>{TABS.find(t => t.id === activeTab)?.label} — בקרוב</div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {modal === 'teacher' && <AddTeacherModal onClose={() => setModal(null)} onAdded={t => setTeachers(prev => [...prev, t])} />}
      {modal === 'room' && <AddRoomModal onClose={() => setModal(null)} onAdded={r => setRooms(prev => [...prev, r])} />}
      {modal === 'subject' && <AddSubjectModal onClose={() => setModal(null)} onAdded={sub => setSubjects(prev => [...prev, sub])} rooms={rooms} />}
      {modal === 'group' && <AddGroupModal onClose={() => setModal(null)} onAdded={g => setGroups(prev => [...prev, g])} rooms={rooms} />}

      {/* Respond Modal */}
      {respondModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setRespondModal(null)}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2dacc', padding: '36px', width: '460px' }} onClick={e => e.stopPropagation()} dir="rtl">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', color: '#4a3f35', margin: 0 }}>טיפול בפנייה</h2>
              <button onClick={() => setRespondModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8baa6', fontSize: '20px' }}>✕</button>
            </div>
            <div style={{ backgroundColor: '#FAF7F2', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#4a3f35' }}>
              {respondModal.description}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={styles.label}>החלטה</label>
              <select value={response.status} onChange={e => setResponse({ ...response, status: e.target.value })} style={{ ...styles.input, cursor: 'pointer' }}>
                <option value="approved">אשר</option>
                <option value="rejected">דחה</option>
              </select>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={styles.label}>תשובה למורה (אופציונלי)</label>
              <textarea value={response.admin_response} onChange={e => setResponse({ ...response, admin_response: e.target.value })} style={{ ...styles.input, height: '80px', resize: 'vertical' }} placeholder="הסבר את ההחלטה..." />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setRespondModal(null)} style={styles.btnOutline}>ביטול</button>
              <button onClick={handleRespond} style={styles.btnAdd}>שלח תשובה</button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {scheduleModalTeacher && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setScheduleModalTeacher(null)}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2dacc', padding: '36px', width: '520px', maxWidth: '90vw' }} onClick={e => e.stopPropagation()} dir="rtl">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', color: '#4a3f35', margin: 0 }}>
                מערכת שעות — {scheduleModalTeacher.first_name} {scheduleModalTeacher.last_name}
              </h2>
              <button onClick={() => setScheduleModalTeacher(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8baa6', fontSize: '20px' }}>✕</button>
            </div>

            {/* כאשר האלגוריתם יוכן, כאן יוצג אותו רכיב מערכת השעות שמוצג למורה בטאב "מערכת השעות שלי" */}
            <div style={{ minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF7F2', borderRadius: '12px', border: '1px solid #e2dacc' }}>
              <div style={{ textAlign: 'center', color: '#c8baa6' }}>
                <i className="ti ti-calendar-off" style={{ fontSize: '36px', display: 'block', marginBottom: '14px' }} aria-hidden="true"></i>
                <div style={{ fontSize: '15px', color: '#8a7a6e', marginBottom: '4px' }}>טרם נוצרה מערכת שעות</div>
                <div style={{ fontSize: '13px' }}>המערכת תוצג כאן לאחר יצירתה</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}