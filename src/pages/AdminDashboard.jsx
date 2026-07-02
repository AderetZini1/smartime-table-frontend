import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getTeachers, deleteTeacher, getRooms, deleteRoom, getSubjects, deleteSubject,
  getStudentGroups, deleteStudentGroup,
  runGeneration, getGenerationStatus, getCurrentSchedule,
} from '../services/api';
import AddTeacherModal from '../components/AddTeacherModal';
import AddRoomModal from '../components/AddRoomModal';
import AddSubjectModal from '../components/AddSubjectModal';
import AddGroupModal from '../components/AddGroupModal';

const TABS = [
  { id: 'schedule', label: 'מערכת שעות', icon: 'ti-calendar' },
  { id: 'notifications', label: 'התראות', icon: 'ti-bell' },
  { id: 'teachers', label: 'מורים', icon: 'ti-users' },
  { id: 'rooms', label: 'חדרים', icon: 'ti-building' },
  { id: 'subjects', label: 'מקצועות', icon: 'ti-book' },
  { id: 'groups', label: 'קבוצות', icon: 'ti-school' },
];

// Day 1 = Sunday ... Day 6 = Friday. Hours 1-8 (Friday only reaches 4).
const DAY_NAMES = { 1: 'ראשון', 2: 'שני', 3: 'שלישי', 4: 'רביעי', 5: 'חמישי', 6: 'שישי' };
const DAY_ORDER = [1, 2, 3, 4, 5, 6];
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8];

// Grade level from a group name like "כיתה א1" -> the letter "א".
// (Groups are named <grade letter><number>, e.g. א1, א2, ב1 ...)
function gradeOf(groupName) {
  if (!groupName) return '';
  const m = groupName.match(/כיתה\s*(.)/);
  return m ? m[1] : groupName;
}

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
  card: { backgroundColor: '#fff', borderRadius: '14px', border: '1px solid #e2dacc', padding: '24px' },
  btnAdd: { backgroundColor: '#8a9e78', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Varela Round, sans-serif' },
  tableHeader: { display: 'flex', fontSize: '12px', color: '#c8baa6', paddingBottom: '12px', borderBottom: '1px solid #e2dacc', gap: '12px' },
  tableRow: { display: 'flex', alignItems: 'center', padding: '14px 0', fontSize: '14px', color: '#4a3f35', gap: '12px' },
  avatar: { width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#EDF4E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#6b8f5e', flexShrink: 0 },
  badge: { fontSize: '12px', padding: '4px 12px', borderRadius: '20px', backgroundColor: '#EDF4E8', color: '#6b8f5e' },
  iconBtn: { fontSize: '16px', color: '#c8baa6', cursor: 'pointer' },
  // schedule-specific
  select: { padding: '9px 14px', border: '1px solid #e2dacc', borderRadius: '10px', fontSize: '14px', color: '#4a3f35', backgroundColor: '#fff', outline: 'none', fontFamily: 'Varela Round, sans-serif', cursor: 'pointer' },
  gridCell: { border: '1px solid #f0ebe3', padding: '6px', verticalAlign: 'top', height: '64px', width: '13%' },
  gridHourCell: { border: '1px solid #f0ebe3', padding: '6px', textAlign: 'center', color: '#c8baa6', fontSize: '12px', backgroundColor: '#FAF7F2', whiteSpace: 'nowrap' },
  gridHeadCell: { border: '1px solid #e2dacc', padding: '10px', textAlign: 'center', color: '#4a3f35', fontSize: '13px', backgroundColor: '#EDF4E8' },
  lessonBox: { backgroundColor: '#F5F8F2', border: '1px solid #e3ecdb', borderRadius: '8px', padding: '5px 7px', marginBottom: '4px', fontSize: '11px', color: '#4a3f35', lineHeight: 1.35 },
};

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('schedule');
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [groups, setGroups] = useState([]);
  const [modal, setModal] = useState(null);

  // ---- schedule state ----
  const [entries, setEntries] = useState([]);
  const [runInfo, setRunInfo] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [filterType, setFilterType] = useState('class'); // class | teacher | subject | grade
  const [filterValue, setFilterValue] = useState('');

  useEffect(() => {
    if (activeTab === 'teachers') getTeachers().then(r => setTeachers(r.data));
    if (activeTab === 'rooms') getRooms().then(r => setRooms(r.data));
    if (activeTab === 'subjects') {
      getRooms().then(r => setRooms(r.data));
      getSubjects().then(r => setSubjects(r.data));
    }
    if (activeTab === 'groups') {
      getRooms().then(r => setRooms(r.data));
      getStudentGroups().then(r => setGroups(r.data));
    }
    if (activeTab === 'schedule') loadSchedule();
  }, [activeTab]);

  const loadSchedule = async () => {
    setScheduleLoading(true);
    setGenError('');
    try {
      const res = await getCurrentSchedule();
      setEntries(res.data.entries || []);
      setRunInfo(res.data.run || null);
    } catch (e) {
      setGenError('שגיאה בטעינת מערכת השעות מהשרת');
    } finally {
      setScheduleLoading(false);
    }
  };

  // Trigger a generation run, then poll until it finishes.
  const handleGenerate = async () => {
    setGenError('');
    setGenerating(true);
    try {
      const start = await runGeneration();
      const jobId = start.data.job_id;

      const poll = async () => {
        try {
          const s = await getGenerationStatus(jobId);
          if (s.data.status === 'completed') {
            setGenerating(false);
            await loadSchedule();
          } else if (s.data.status === 'failed') {
            setGenerating(false);
            setGenError('יצירת המערכת נכשלה. נסי שוב.');
          } else {
            setTimeout(poll, 3000); // still running - check again in 3s
          }
        } catch (e) {
          setGenerating(false);
          setGenError('שגיאה בבדיקת מצב היצירה');
        }
      };
      setTimeout(poll, 3000);
    } catch (e) {
      setGenerating(false);
      if (e.response && e.response.status === 409) {
        setGenError('יצירת מערכת כבר רצה כרגע. נסי שוב עוד רגע.');
      } else {
        setGenError('לא ניתן להתחיל יצירת מערכת');
      }
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('למחוק?')) return;
    if (type === 'teacher') { await deleteTeacher(id); setTeachers(prev => prev.filter(x => x.id !== id)); }
    if (type === 'room') { await deleteRoom(id); setRooms(prev => prev.filter(x => x.id !== id)); }
    if (type === 'subject') { await deleteSubject(id); setSubjects(prev => prev.filter(x => x.id !== id)); }
    if (type === 'group') { await deleteStudentGroup(id); setGroups(prev => prev.filter(x => x.id !== id)); }
  };

  const initials = (t) => `${t.first_name?.[0] || ''}${t.last_name?.[0] || ''}`;

  // ---- build the list of options for the current filter type ----
  const optionsForFilter = () => {
    const set = new Set();
    entries.forEach(e => {
      if (filterType === 'class') set.add(e.group_name);
      else if (filterType === 'teacher') set.add(`${e.teacher_first_name} ${e.teacher_last_name}`);
      else if (filterType === 'subject') set.add(e.subject_name);
      else if (filterType === 'grade') set.add(gradeOf(e.group_name));
    });
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, 'he'));
  };

  // ---- which entries match the chosen filter value ----
  const matches = (e) => {
    if (!filterValue) return false;
    if (filterType === 'class') return e.group_name === filterValue;
    if (filterType === 'teacher') return `${e.teacher_first_name} ${e.teacher_last_name}` === filterValue;
    if (filterType === 'subject') return e.subject_name === filterValue;
    if (filterType === 'grade') return gradeOf(e.group_name) === filterValue;
    return false;
  };

  const shown = entries.filter(matches);

  // lessons that fall on a given day+hour (usually 1, but can be several
  // for subject/grade views where many classes share a slot)
  const cell = (day, hour) => shown.filter(e => e.day_of_week === day && e.hour_of_day === hour);

  const options = activeTab === 'schedule' ? optionsForFilter() : [];

  return (
    <div style={styles.layout}>

      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarTop}>
          <div style={styles.brand}>SMARTIME</div>
          <div style={styles.brandName}>פאנל ניהול</div>
        </div>
        <nav style={{ flex: 1 }}>
          {['schedule', 'notifications'].map(id => {
            const tab = TABS.find(t => t.id === id);
            return (
              <button key={id} onClick={() => setActiveTab(id)} style={styles.navItem(activeTab === id)}>
                <i className={`ti ${tab.icon}`} style={{ fontSize: '18px' }} aria-hidden="true"></i>
                {tab.label}
                {id === 'notifications' && <span style={{ marginRight: 'auto', backgroundColor: '#FAE8E8', color: '#c0705a', borderRadius: '10px', padding: '2px 8px', fontSize: '12px' }}>3</span>}
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
          <button onClick={logout} style={{ fontSize: '13px', color: '#8a7a6e', background: 'none', border: '1px solid #e2dacc', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', width: '100%', fontFamily: 'Varela Round, sans-serif' }}>התנתק</button>
        </div>
      </div>

      {/* Main */}
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

        {/* Teachers */}
        {activeTab === 'teachers' && (
          <div style={styles.card}>
            <div style={styles.tableHeader}>
              <div style={{ width: '34px' }}></div>
              <div style={{ flex: 3 }}>שם</div>
              <div style={{ flex: 3 }}>אימייל</div>
              <div style={{ flex: 1 }}>שעות</div>
              <div style={{ flex: 1 }}>תפקיד</div>
              <div style={{ width: '52px' }}></div>
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
                <div style={{ width: '52px', display: 'flex', gap: '10px' }}>
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

        {/* Notifications placeholder (unchanged) */}
        {activeTab === 'notifications' && (
          <div style={{ ...styles.card, minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: '#c8baa6' }}>
              <i className="ti ti-bell" style={{ fontSize: '36px', display: 'block', marginBottom: '14px' }} aria-hidden="true"></i>
              <div style={{ fontSize: '15px' }}>התראות — בקרוב</div>
            </div>
          </div>
        )}

        {/* ================= SCHEDULE ================= */}
        {activeTab === 'schedule' && (
          <>
            {/* Generate bar */}
            <div style={{ ...styles.card, marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{ ...styles.btnAdd, opacity: generating ? 0.7 : 1, cursor: generating ? 'not-allowed' : 'pointer' }}
                >
                  <i className={`ti ${generating ? 'ti-loader' : 'ti-wand'}`} aria-hidden="true"></i>
                  {generating ? 'בתהליך יצירה…' : 'צור מערכת שעות'}
                </button>
                {generating && (
                  <div style={{ fontSize: '12px', color: '#8a7a6e', marginTop: '8px' }}>
                    היצירה עשויה לקחת עד כ-3 דקות. אפשר להמתין כאן.
                  </div>
                )}
                {genError && (
                  <div style={{ fontSize: '13px', color: '#c0705a', marginTop: '8px' }}>{genError}</div>
                )}
              </div>
              {runInfo && (
                <div style={{ fontSize: '12px', color: '#8a7a6e', textAlign: 'left' }}>
                  <div>המערכת הנוכחית נוצרה ע״י אלגוריתם <strong>{runInfo.algorithm}</strong></div>
                  <div>ציון: {runInfo.score}</div>
                </div>
              )}
            </div>

            {/* Filter bar */}
            <div style={{ ...styles.card, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', color: '#8a7a6e' }}>הצג לפי:</span>
              <select
                style={styles.select}
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value); setFilterValue(''); }}
              >
                <option value="class">כיתה</option>
                <option value="teacher">מורה</option>
                <option value="subject">מקצוע</option>
                <option value="grade">שכבה</option>
              </select>
              <select
                style={{ ...styles.select, minWidth: '180px' }}
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
              >
                <option value="">— בחר/י —</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            {/* Grid */}
            <div style={styles.card}>
              {scheduleLoading ? (
                <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>טוען…</div>
              ) : !runInfo ? (
                <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>
                  עדיין לא נוצרה מערכת שעות. לחצי על "צור מערכת שעות".
                </div>
              ) : !filterValue ? (
                <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>
                  בחר/י ערך מהרשימה למעלה כדי להציג מערכת שעות.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.gridHeadCell, width: '60px' }}>שעה</th>
                        {DAY_ORDER.map(d => <th key={d} style={styles.gridHeadCell}>{DAY_NAMES[d]}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {HOURS.map(hour => (
                        <tr key={hour}>
                          <td style={styles.gridHourCell}>שיעור {hour}</td>
                          {DAY_ORDER.map(day => {
                            const lessons = cell(day, hour);
                            return (
                              <td key={day} style={styles.gridCell}>
                                {lessons.map((e, idx) => (
                                  <div key={idx} style={styles.lessonBox}>
                                    <div style={{ fontWeight: 600 }}>{e.subject_name}</div>
                                    {filterType !== 'teacher' && (
                                      <div style={{ color: '#8a7a6e' }}>{e.teacher_first_name} {e.teacher_last_name}</div>
                                    )}
                                    {filterType !== 'class' && (
                                      <div style={{ color: '#8a7a6e' }}>{e.group_name}</div>
                                    )}
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

      {modal === 'teacher' && <AddTeacherModal onClose={() => setModal(null)} onAdded={t => setTeachers(prev => [...prev, t])} />}
      {modal === 'room' && <AddRoomModal onClose={() => setModal(null)} onAdded={r => setRooms(prev => [...prev, r])} />}
      {modal === 'subject' && <AddSubjectModal onClose={() => setModal(null)} onAdded={sub => setSubjects(prev => [...prev, sub])} rooms={rooms} />}
      {modal === 'group' && <AddGroupModal onClose={() => setModal(null)} onAdded={g => setGroups(prev => [...prev, g])} rooms={rooms} />}

    </div>
  );
}
