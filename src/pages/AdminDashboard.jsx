import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getTeachers, deleteTeacher, getRooms, deleteRoom, getSubjects, deleteSubject, getStudentGroups, deleteStudentGroup, getMyRequests, respondToRequest, getSubmissionWindows, createSubmissionWindow, deleteSubmissionWindow, runGeneration, getGenerationStatus, getCurrentSchedule, publishSchedule, getViolations, sendNotification, getNotifications, updateRoom, updateSubject, updateStudentGroup, updateTeacher, getMyConstraints, getTeacherPreferencesById, getTeacherSubjectsById, getTeacherGradeLevelsById, getTeacherHomeroomById, saveTeacherPreferencesById, addTeacherSubjectById, removeTeacherSubjectById, addTeacherGradeLevelById, removeTeacherGradeLevelById, saveTeacherHomeroomById, createConstraint, deleteConstraint, getScheduleRuns, selectScheduleRun, deleteScheduleRun } from '../services/api';
import AddTeacherModal from '../components/AddTeacherModal';
import EditModal from '../components/EditModal';
import AddRoomModal from '../components/AddRoomModal';
import AddSubjectModal from '../components/AddSubjectModal';
import AddGroupModal from '../components/AddGroupModal';
import { exportSingleSchedule, exportMultiSchedule } from '../utils/exportSchedule';
import { useNavigate } from 'react-router-dom';
import { exportSinglePDF, exportMultiPDF } from '../utils/exportSchedulePDF';


function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

const TABS = [
  { id: 'schedule', label: 'מערכת שעות', icon: 'ti-calendar' },
  { id: 'history', label: 'היסטוריית מערכות', icon: 'ti-history' },
  { id: 'requests', label: 'פניות מורים', icon: 'ti-message' },
  { id: 'teacherprefs', label: 'העדפות מורים', icon: 'ti-clipboard-text' },
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

const VIEW_TYPES = [
  { id: 'class', label: 'כיתה' },
  { id: 'teacher', label: 'מורה' },
  { id: 'subject', label: 'מקצוע' },
  { id: 'grade', label: 'שכבה' },
];

const DAY_NAMES_BY_NUM = { 1: 'ראשון', 2: 'שני', 3: 'שלישי', 4: 'רביעי', 5: 'חמישי', 6: 'שישי' };
const DAY_ORDER = [1, 2, 3, 4, 5, 6];
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8];

const statusLabel = (s) => ({ pending: 'ממתין', approved: 'אושר', rejected: 'נדחה' }[s] || s);
const statusColor = (s) => ({ pending: '#c8baa6', approved: '#8a9e78', rejected: '#c0705a' }[s] || '#c8baa6');

const extractGrade = (groupName) => {
  const match = groupName.match(/כיתה\s*([א-ת])/);
  if (match) return match[1];
  const fallback = groupName.match(/[א-ת]/);
  return fallback ? fallback[0] : 'אחר';
};

const styles = {
  layout: { display: 'flex', backgroundColor: '#FAF7F2', minHeight: '100vh', direction: 'rtl' },
  sidebar: { width: '260px', backgroundColor: '#fff', borderLeft: '1px solid #e2dacc', display: 'flex', flexDirection: 'column', padding: '28px 0', flexShrink: 0 },
  sidebarTop: { padding: '0 24px', marginBottom: '32px' },
  brand: { fontSize: '11px', letterSpacing: '0.14em', color: '#c8baa6', marginBottom: '4px' },
  brandName: { fontSize: '17px', color: '#4a3f35' },
  navItem: (active) => ({ padding: '13px 24px', fontSize: '15px', color: active ? '#4a3f35' : '#8a7a6e', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', borderRight: active ? '3px solid #8a9e78' : '3px solid transparent', backgroundColor: active ? '#FAF7F2' : 'transparent', border: 'none', width: '100%', textAlign: 'right', fontFamily: 'Varela Round, sans-serif' }),
  divider: { margin: '12px 24px', borderBottom: '1px solid #e2dacc' },
  main: { flex: 1, minWidth: 0, maxWidth: '100%', padding: '40px 48px', overflowX: 'hidden' },
  pageTitle: { fontSize: '22px', color: '#4a3f35', margin: 0 },
  titleLine: { width: '28px', height: '1.5px', backgroundColor: '#8a9e78', marginTop: '8px' },
  card: { backgroundColor: '#fff', borderRadius: '14px', border: '1px solid #e2dacc', padding: '24px', marginBottom: '24px' },
  btnAdd: { backgroundColor: '#8a9e78', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Varela Round, sans-serif' },
  btnOutline: { backgroundColor: 'transparent', color: '#8a7a6e', border: '1px solid #e2dacc', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', cursor: 'pointer', fontFamily: 'Varela Round, sans-serif' },
  tableHeader: { display: 'flex', fontSize: '12px', color: '#c8baa6', paddingBottom: '12px', borderBottom: '1px solid #e2dacc', gap: '12px' },
  tableRow: { display: 'flex', alignItems: 'center', padding: '14px 0', fontSize: '14px', color: '#4a3f35', gap: '12px' },
  avatar: { width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#EDF4E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#6b8f5e', flexShrink: 0 },
  badge: { fontSize: '12px', padding: '4px 12px', borderRadius: '20px', backgroundColor: '#EDF4E8', color: '#6b8f5e' },
  iconBtn: { fontSize: '16px', color: '#c8baa6', cursor: 'pointer' },
  input: { width: '100%', padding: '10px 14px', border: '1px solid #e2dacc', borderRadius: '8px', fontSize: '14px', color: '#4a3f35', backgroundColor: '#FAF7F2', outline: 'none', boxSizing: 'border-box', fontFamily: 'Varela Round, sans-serif' },
  label: { display: 'block', fontSize: '12px', color: '#8a7a6e', marginBottom: '6px' },
  viewBtn: (active) => ({ padding: '9px 20px', borderRadius: '10px', fontSize: '14px', cursor: 'pointer', backgroundColor: active ? '#8a9e78' : '#f5f2ee', color: active ? '#fff' : '#8a7a6e', border: `1px solid ${active ? '#8a9e78' : '#e2dacc'}`, fontFamily: 'Varela Round, sans-serif' }),
  search: { padding: '9px 14px', border: '1px solid #e2dacc', borderRadius: '10px', fontSize: '14px', color: '#4a3f35', backgroundColor: '#FAF7F2', outline: 'none', fontFamily: 'Varela Round, sans-serif', minWidth: '220px' },
  tile: (active) => ({ flexShrink: 0, backgroundColor: active ? '#EDF4E8' : '#FAF7F2', border: `1px solid ${active ? '#8a9e78' : '#e2dacc'}`, borderRadius: '12px', padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Varela Round, sans-serif', fontSize: '14px', color: '#4a3f35', whiteSpace: 'nowrap' }),
  arrowBtn: { flexShrink: 0, width: '38px', height: '38px', borderRadius: '10px', border: '1px solid #e2dacc', backgroundColor: '#fff', color: '#8a7a6e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' },
  gridCell: { border: '1px solid #f0ebe3', padding: '6px', verticalAlign: 'top', height: '64px' },
  gridHourCell: { border: '1px solid #f0ebe3', padding: '6px', textAlign: 'center', color: '#c8baa6', fontSize: '12px', backgroundColor: '#FAF7F2', whiteSpace: 'nowrap' },
  gridHeadCell: { border: '1px solid #e2dacc', padding: '10px', textAlign: 'center', color: '#4a3f35', fontSize: '13px', backgroundColor: '#EDF4E8' },
  lessonBox: { backgroundColor: '#F5F8F2', border: '1px solid #e3ecdb', borderRadius: '8px', padding: '5px 7px', marginBottom: '4px', fontSize: '11px', color: '#4a3f35', lineHeight: 1.35 },
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
  const [confirmModal, setConfirmModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [editTeacher, setEditTeacher] = useState(null);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifErrors, setNotifErrors] = useState({ title: false, body: false, recipients: false });
  const [notifSuccess, setNotifSuccess] = useState('');
  const [notifMode, setNotifMode] = useState('all');
  const [notifTeacherIds, setNotifTeacherIds] = useState([]);
  const [notifTeacherSearch, setNotifTeacherSearch] = useState('');
  const [notifSending, setNotifSending] = useState(false);
  const [showNotifForm, setShowNotifForm] = useState(false);
  const [sentNotifs, setSentNotifs] = useState([]);
  const [entries, setEntries] = useState([]);
  const [runInfo, setRunInfo] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [runs, setRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [genError, setGenError] = useState('');
  const [publishMsg, setPublishMsg] = useState('');
  const [violations, setViolations] = useState(null);
  const [showViolations, setShowViolations] = useState(false);
  const [filterType, setFilterType] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportDim, setExportDim] = useState(null);   // null = main menu; else 'class'|'teacher'|'subject'|'grade'
  const [exportSearch, setExportSearch] = useState('');
  const [exportFormat, setExportFormat] = useState('excel');
  const [selectedValues, setSelectedValues] = useState([]);
  const [exportMsg, setExportMsg] = useState('');
  const [search, setSearch] = useState('');
  const [tilesExpanded, setTilesExpanded] = useState(false);
  const [prefTeacher, setPrefTeacher] = useState(null);
  const [prefEditing, setPrefEditing] = useState(false);
  const [prefDraft, setPrefDraft] = useState({});
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefSubjectsDraft, setPrefSubjectsDraft] = useState([]);
  const [prefGradesDraft, setPrefGradesDraft] = useState([]);
  const [prefHomeroomDraft, setPrefHomeroomDraft] = useState({ wants_homeroom: false, preferred_group_id: null, wants_continue_with_previous: false });
  const [allGroups, setAllGroups] = useState([]);
  const [prefConstraintsDraft, setPrefConstraintsDraft] = useState({});
  const [showScheduleConfirm, setShowScheduleConfirm] = useState(false);
  const [prefData, setPrefData] = useState(null);
  const [prefLoading, setPrefLoading] = useState(false);
  const [prefSearch, setPrefSearch] = useState('');

  useEffect(() => {
    getTeachers().then(r => setTeachers(r.data));
    if (activeTab === 'rooms') getRooms().then(r => setRooms(r.data));
    if (activeTab === 'subjects') { getRooms().then(r => setRooms(r.data)); getSubjects().then(r => setSubjects(r.data)); }
    if (activeTab === 'groups') { getRooms().then(r => setRooms(r.data)); getStudentGroups().then(r => setGroups(r.data)); }
    if (activeTab === 'schedule') { getStudentGroups().then(r => setGroups(r.data)); loadSchedule(); }
    if (activeTab === 'history') { setRunsLoading(true); getScheduleRuns().then(r => setRuns(r.data)).catch(() => {}).finally(() => setRunsLoading(false)); }
    if (activeTab === 'requests') getMyRequests().then(r => { setRequests(r.data); setPendingCount(r.data.filter(x => x.status === 'pending').length); });
    if (activeTab === 'windows') getSubmissionWindows().then(r => setWindows(r.data));
    if (activeTab === 'teacherprefs') {
      getTeachers().then(r => setTeachers(r.data)).catch(() => {});
      getSubjects().then(r => setSubjects(r.data)).catch(() => {});
    }
    if (activeTab === 'notifications') {
      getNotifications().then(r => setSentNotifs(r.data)).catch(() => {});
      getTeachers().then(r => setTeachers(r.data)).catch(() => {});
    }
    
    
  }, [activeTab]);

  useEffect(() => {
    getMyRequests().then(r => setPendingCount(r.data.filter(x => x.status === 'pending').length)).catch(() => {});
  }, []);

  const loadSchedule = async () => {
    setGenError('');
    try {
      const res = await getCurrentSchedule();
      setEntries(res.data.entries || []);
      setRunInfo(res.data.run || null);
    } catch (e) {
      setEntries([]);
      setRunInfo(null);
    }
  };

  const exportItemStyle = (emphasis) => ({
    display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
    padding: '9px 10px', fontSize: '13px', textAlign: 'right',
    background: emphasis ? '#EDF4E8' : 'none', border: 'none', borderRadius: '8px',
    cursor: 'pointer', color: '#4a3f35', fontFamily: 'Varela Round, sans-serif',
    marginBottom: '2px',
  });

  const handleEditSave = async (payload) => {
    const { type, id } = editModal;
    if (type === 'room') { await updateRoom(id, payload); getRooms().then(r => setRooms(r.data)); }
    else if (type === 'subject') { await updateSubject(id, payload); getSubjects().then(r => setSubjects(r.data)); }
    else if (type === 'group') { await updateStudentGroup(id, payload); getStudentGroups().then(r => setGroups(r.data)); }
  };
  
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
            setTimeout(poll, 3000);
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
  
  const handlePublish = async () => {
    setPublishing(true);
    setPublishMsg('');
    try {
      await publishSchedule();
      setPublishMsg('פורסם לצוות ✓');
      setTimeout(() => setPublishMsg(''), 15000);
      await loadSchedule();
    } catch (e) {
      setPublishMsg('שגיאה בפרסום');
    } finally {
      setPublishing(false);
    }
  };

  const viewTeacherSchedule = () => {
    setActiveTab('schedule');
    setFilterType('teacher');
    setSelectedValues([`${prefTeacher.first_name} ${prefTeacher.last_name}`]);
    setShowScheduleConfirm(false);
    setPrefEditing(false);
    setPrefDraft({});
  };

    const startPrefEdit = () => {
    setPrefDraft({
      priority_early_finish: prefData.prefs?.priority_early_finish ? 1 : 0,
      priority_no_gaps: prefData.prefs?.priority_no_gaps ? 1 : 0,
      priority_free_day: prefData.prefs?.priority_free_day ? 1 : 0,
      priority_consecutive: prefData.prefs?.priority_consecutive ? 1 : 0,
      preferred_consecutive: prefData.prefs?.preferred_consecutive ?? false,
    });
    setPrefSubjectsDraft(prefData.subjects.map(s => s.subject_id));
    setPrefGradesDraft(prefData.grades.map(g => g.grade_level));
    setPrefHomeroomDraft({
      wants_homeroom: prefData.homeroom?.wants_homeroom ?? false,
      preferred_group_id: prefData.homeroom?.preferred_group_id ?? null,
      wants_continue_with_previous: prefData.homeroom?.wants_continue_with_previous ?? false,
    });
    const cDraft = {};
    prefData.constraints.forEach(c => { cDraft[c.timeslot_id] = c.constraint_type === 'hard' ? 'hard' : 'soft'; });
    setPrefConstraintsDraft(cDraft);
    setPrefEditing(true);
  };

  const cancelPrefEdit = () => {
    setPrefEditing(false);
  };

  const savePrefEdit = async () => {
    setPrefSaving(true);
    try {
      // 1. Preferences (priorities + carried-through hours)
      const payload = {
        min_hours: prefData.prefs?.min_hours ?? 18,
        max_hours: prefData.prefs?.max_hours ?? 26,
        preferred_consecutive: prefDraft.preferred_consecutive,
        priority_early_finish: prefDraft.priority_early_finish,
        priority_no_gaps: prefDraft.priority_no_gaps,
        priority_free_day: prefDraft.priority_free_day,
        priority_consecutive: prefDraft.priority_consecutive,
      };
      const prefRes = await saveTeacherPreferencesById(prefTeacher.id, payload);

      // 2. Subjects: add newly-checked, remove newly-unchecked
      const originalSubjectIds = prefData.subjects.map(s => s.subject_id);
      const subjToAdd = prefSubjectsDraft.filter(id => !originalSubjectIds.includes(id));
      const subjToRemove = originalSubjectIds.filter(id => !prefSubjectsDraft.includes(id));
      for (const sid of subjToAdd) {
        try {
          await addTeacherSubjectById(prefTeacher.id, sid);
        } catch (e) {
          if (e?.response?.status !== 400) throw e; // ignore "already exists", surface real errors
        }
      }
      for (const sid of subjToRemove) {
        await removeTeacherSubjectById(prefTeacher.id, sid);
      }

      // 3. Grade levels: add newly-checked, remove newly-unchecked
      const originalGrades = prefData.grades.map(g => g.grade_level);
      const gradeToAdd = prefGradesDraft.filter(gl => !originalGrades.includes(gl));
      const gradeToRemove = originalGrades.filter(gl => !prefGradesDraft.includes(gl));
      for (const gl of gradeToAdd) {
        await addTeacherGradeLevelById(prefTeacher.id, gl);
      }
      for (const gl of gradeToRemove) {
        await removeTeacherGradeLevelById(prefTeacher.id, gl);
      }

      // 4. Homeroom preference (single upsert)
      await saveTeacherHomeroomById(prefTeacher.id, {
        wants_homeroom: prefHomeroomDraft.wants_homeroom,
        preferred_group_id: prefHomeroomDraft.wants_homeroom ? prefHomeroomDraft.preferred_group_id : null,
        wants_continue_with_previous: prefHomeroomDraft.wants_homeroom ? prefHomeroomDraft.wants_continue_with_previous : false,
      });

      // 5. Availability constraints: diff draft vs original (create/delete; changed = delete+create)
      const originalCon = {};
      prefData.constraints.forEach(c => { originalCon[c.timeslot_id] = { type: c.constraint_type === 'hard' ? 'hard' : 'soft', id: c.id }; });
      const allTimeslots = new Set([...Object.keys(originalCon), ...Object.keys(prefConstraintsDraft)].map(Number));
      for (const tsId of allTimeslots) {
        const orig = originalCon[tsId];
        const draft = prefConstraintsDraft[tsId];
        if (orig && !draft) {
          await deleteConstraint(orig.id);                         // removed
        } else if (!orig && draft) {
          await createConstraint({ teacher_id: prefTeacher.id, timeslot_id: tsId, weight: 1, constraint_type: draft });  // added
        } else if (orig && draft && orig.type !== draft) {
          await deleteConstraint(orig.id);                         // changed: delete old...
          await createConstraint({ teacher_id: prefTeacher.id, timeslot_id: tsId, weight: 1, constraint_type: draft });  // ...create new
        }
      }

      // 6. Refetch everything so the read-only view shows canonical rows
      const subjectsRes = await getTeacherSubjectsById(prefTeacher.id);
      const gradesRes = await getTeacherGradeLevelsById(prefTeacher.id);
      const homeroomRes = await getTeacherHomeroomById(prefTeacher.id);
      const conRes = await getMyConstraints();

      setPrefData(prev => ({ ...prev, prefs: prefRes.data, subjects: subjectsRes.data, grades: gradesRes.data, homeroom: homeroomRes.data, constraints: conRes.data.filter(c => c.teacher_id === prefTeacher.id) }));
      setPrefEditing(false);
    } catch (err) {
      alert('השמירה נכשלה. נסה/י שוב.');
    } finally {
      setPrefSaving(false);
    }
  };

  const cyclePrefCell = (timeslotId) => {
    setPrefConstraintsDraft(d => {
      const next = { ...d };
      const cur = next[timeslotId];
      if (!cur) next[timeslotId] = 'soft';           // blank -> מעדיף שלא
      else if (cur === 'soft') next[timeslotId] = 'hard';  // soft -> לא יכול
      else delete next[timeslotId];                  // hard -> blank
      return next;
    });
  };

  const openTeacherPrefs = async (teacher) => {
    setPrefEditing(false);
    setPrefDraft({});
    getStudentGroups().then(r => setAllGroups(r.data)).catch(() => {});
    setPrefTeacher(teacher);
    setPrefLoading(true);
    setPrefData(null);
    try {
      const [prefs, subjects, grades, homeroom, allCon] = await Promise.all([
        getTeacherPreferencesById(teacher.id).then(r => r.data).catch(() => null),
        getTeacherSubjectsById(teacher.id).then(r => r.data).catch(() => []),
        getTeacherGradeLevelsById(teacher.id).then(r => r.data).catch(() => []),
        getTeacherHomeroomById(teacher.id).then(r => r.data).catch(() => ({})),
        getMyConstraints().then(r => r.data.filter(c => c.teacher_id === teacher.id)).catch(() => []),
      ]);
      setPrefData({ prefs, subjects, grades, homeroom, constraints: allCon });
    } finally {
      setPrefLoading(false);
    }
  };

  const openViolations = async () => {
    setShowViolations(true);
    try {
      const res = await getViolations();
      setViolations(res.data.violations || []);
    } catch (e) {
      setViolations([]);
    }
  };

  const handleDelete = async (type, id) => {
    if (type === 'teacher') { await deleteTeacher(id); setTeachers(prev => prev.filter(x => x.id !== id)); }
    if (type === 'room') { await deleteRoom(id); setRooms(prev => prev.filter(x => x.id !== id)); }
    if (type === 'subject') { await deleteSubject(id); setSubjects(prev => prev.filter(x => x.id !== id)); }
    if (type === 'group') { await deleteStudentGroup(id); setGroups(prev => prev.filter(x => x.id !== id)); }
    if (type === 'window') { await deleteSubmissionWindow(id); setWindows(prev => prev.filter(x => x.id !== id)); }
    setConfirmModal(null);
  };

  const handleRespond = async () => {
    await respondToRequest(respondModal.id, response);
    setRequests(prev => prev.map(r => r.id === respondModal.id ? { ...r, ...response } : r));
    setPendingCount(prev => response.status !== 'pending' ? prev - 1 : prev);
    setRespondModal(null);
    setResponse({ status: 'approved', admin_response: '' });
  };

  const handleCreateWindow = async () => {
    if (!newWindow.title || !newWindow.start_date || !newWindow.end_date) return;
    try {
      const res = await createSubmissionWindow(newWindow);
      setWindows(prev => [...prev, res.data]);
      setNewWindow({ title: '', start_date: '', end_date: '' });
    } catch (err) {
      console.log('error:', err);
    }
  };

  const handleSendNotification = async () => {
    // validate
    const errors = {
      title: !notifTitle.trim(),
      body: !notifBody.trim(),
      recipients: notifMode === 'specific' && notifTeacherIds.length === 0,
    };
    setNotifErrors(errors);
    if (errors.title || errors.body || errors.recipients) return;  // stop, show messages

    setNotifSending(true);
    try {
      await sendNotification({
        title: notifTitle,
        body: notifBody,
        teacher_ids: notifMode === 'specific' ? notifTeacherIds : null,
      });
      setSentNotifs(prev => [{ id: Date.now(), title: notifTitle, body: notifBody, created_at: new Date() }, ...prev]);
      const count = notifMode === 'specific' ? notifTeacherIds.length : null;
      setNotifTitle(''); setNotifBody('');
      setNotifMode('all'); setNotifTeacherIds([]);
      setNotifErrors({ title: false, body: false, recipients: false });
      setShowNotifForm(false);
      // success toast (auto-clears)
      setNotifSuccess(count !== null ? `✓ ההתראה נשלחה ל-${count} מורים` : '✓ ההתראה נשלחה לכל המורים');
      setTimeout(() => setNotifSuccess(''), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setNotifSending(false);
    }
  };

  const initials = (t) => `${t.first_name?.[0] || ''}${t.last_name?.[0] || ''}`;

  const closeNotifForm = () => {
    setNotifTitle('');
    setNotifBody('');
    setNotifMode('all');
    setNotifTeacherIds([]);
    setNotifTeacherSearch('');
    setNotifErrors({ title: false, body: false, recipients: false });
    setShowNotifForm(false);
  };
  
  const tileOptions = () => {
    const set = new Set();
    entries.forEach(e => {
      if (filterType === 'class') set.add(e.group_name);
      else if (filterType === 'teacher') set.add(`${e.teacher_first_name} ${e.teacher_last_name}`);
      else if (filterType === 'subject') set.add(e.subject_name);
      else if (filterType === 'grade') set.add(extractGrade(e.group_name));
    });
    return Array.from(set).filter(Boolean).filter(o => !search || o.includes(search)).sort((a, b) => a.localeCompare(b, 'he'));
  };

  const options = activeTab === 'schedule' ? tileOptions() : [];

  const selectView = (type) => {
    setFilterType(prev => prev === type ? null : type);  // click same → collapse
    setSelectedValues([]);
    setSearch('');
    setTilesExpanded(false);
  };

  const toggleValue = (val) => {
    setSelectedValues(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const entriesFor = (val) => entries.filter(e => {
    if (filterType === 'class') return e.group_name === val;
    if (filterType === 'teacher') return `${e.teacher_first_name} ${e.teacher_last_name}` === val;
    if (filterType === 'subject') return e.subject_name === val;
    if (filterType === 'grade') return extractGrade(e.group_name) === val;
    return false;
  });

    // All distinct values for a given dimension (independent of current filterType).
  const valuesForDim = (dim) => {
    const set = new Set();
    entries.forEach(e => {
      if (dim === 'class') set.add(e.group_name);
      else if (dim === 'teacher') set.add(`${e.teacher_first_name} ${e.teacher_last_name}`);
      else if (dim === 'subject') set.add(e.subject_name);
      else if (dim === 'grade') set.add(extractGrade(e.group_name));
    });
    return [...set].filter(Boolean).sort((a, b) => String(a).localeCompare(String(b), 'he'));
  };

  // Entries for one value within a dimension (mirrors entriesFor but dim-explicit).
  const entriesForDim = (dim, val) => entries.filter(e => {
    if (dim === 'class') return e.group_name === val;
    if (dim === 'teacher') return `${e.teacher_first_name} ${e.teacher_last_name}` === val;
    if (dim === 'subject') return e.subject_name === val;
    if (dim === 'grade') return extractGrade(e.group_name) === val;
    return false;
  });

  const DIM_LABEL = { class: 'כיתה', teacher: 'מורה', subject: 'מקצוע', grade: 'שכבה' };

  const closeExport = () => { setExportOpen(false); setExportDim(null); setExportSearch(''); setExportMsg(''); };

  // Export ONE value (single sheet).
  const exportOneValue = async (dim, val, format = 'excel') => {
    const showGroup = dim !== 'class';
    const entries = entriesForDim(dim, val);
    if (format === 'pdf') {
      await exportSinglePDF(entries, { fileName: `מערכת_${DIM_LABEL[dim]}_${val}`, title: String(val), showGroup });
    } else {
      await exportSingleSchedule(entries, { fileName: `מערכת_${DIM_LABEL[dim]}_${val}`, sheetName: String(val), showGroup });
    }
    closeExport();
  };

  const exportAllOfDim = async (dim, format = 'excel') => {
    const showGroup = dim !== 'class';
    const groups = valuesForDim(dim).map(val => ({ name: String(val), entries: entriesForDim(dim, val) }));
    if (format === 'pdf') {
      await exportMultiPDF(groups, { fileName: `מערכות_לפי_${DIM_LABEL[dim]}`, showGroup });
    } else {
      await exportMultiSchedule(groups, { fileName: `מערכות_לפי_${DIM_LABEL[dim]}`, showGroup });
    }
    closeExport();
  };

  // "Export what's open now" = all values of the CURRENT view (filterType).
  const exportCurrent = async (format = 'excel') => {
    if (!selectedValues || selectedValues.length === 0) {
      setExportMsg('אין פריט שפתוח כרגע');
      return;
    }
    setExportMsg('');
    if (selectedValues && selectedValues.length > 0) {
      if (selectedValues.length === 1) {
        await exportOneValue(filterType, selectedValues[0], format);
      } else {
        const groups = selectedValues.map(val => ({ name: String(val), entries: entriesFor(val) }));
        if (format === 'pdf') {
          await exportMultiPDF(groups, { fileName: 'מערכת_נבחרת', showGroup: filterType !== 'class' });
        } else {
          await exportMultiSchedule(groups, { fileName: 'מערכת_נבחרת', showGroup: filterType !== 'class' });
        }
        closeExport();
      }
    } else {
      await exportAllOfDim(filterType, format);
    }
  };

  const tileLabel = (val) => (filterType === 'grade' ? `שכבת ${val}׳` : val);

  return (
    <div style={styles.layout}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarTop}>
          <div style={styles.brand}>SMARTIME</div>
          <div style={styles.brandName}>פאנל ניהול</div>
        </div>
        <nav style={{ flex: 1 }}>
          {['schedule', 'requests', 'teacherprefs', 'windows', 'notifications'].map(id => {
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
          <button
          onClick={() => navigate('/teacher')}
          style={{ fontSize: '13px', color: '#8a9e78', background: 'none', border: '1px solid #8a9e78', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', width: '100%', marginBottom: '8px', fontFamily: 'Varela Round, sans-serif' }}
        >
          <i className="ti ti-user" aria-hidden="true"></i> עבור לתצוגת מורה
        </button>
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
          
          {activeTab === 'notifications' && (
            <button style={styles.btnAdd} onClick={() => { setNotifErrors({ title: false, body: false, recipients: false }); setShowNotifForm(true); }}>
              <i className="ti ti-plus" aria-hidden="true"></i> התראה חדשה
            </button>
          )}
        </div>

        {activeTab === 'history' && (
          <div style={styles.card}>
            {runsLoading ? (
              <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>טוען…</div>
            ) : runs.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px', fontSize: '14px' }}>אין מערכות שמורות עדיין</div>
            ) : (
              <>
                <div style={styles.tableHeader}>
                  <div style={{ flex: 2 }}>תאריך</div>
                  <div style={{ flex: 2 }}>אלגוריתם</div>
                  <div style={{ flex: 1 }}>ציון</div>
                  <div style={{ flex: 2 }}>סטטוס</div>
                </div>
                {runs.slice(0, 20).map((run, i, arr) => {
                  const algoLabels = { CSP: 'CSP', HILL_CLIMBING: 'טיפוס גבעות', GENETIC: 'גנטי' };
                  return (
                    <div key={run.id} style={{ ...styles.tableRow, borderBottom: i < arr.length - 1 ? '1px solid #f0ebe3' : 'none' }}>
                      <div style={{ flex: 2, color: '#8a7a6e' }}>{run.run_at ? new Date(run.run_at).toLocaleString('he-IL') : '—'}</div>
                      <div style={{ flex: 2 }}>{algoLabels[run.algorithm] || run.algorithm}</div>
                      <div style={{ flex: 1 }}>{run.score ?? '—'}</div>
                      <div style={{ flex: 2, display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {run.is_selected && <span style={{ ...styles.badge, backgroundColor: '#EDF4E8', color: '#6b8f5e' }}>נוכחית</span>}
                        {run.is_published && <span style={{ ...styles.badge, backgroundColor: '#E8F2FA', color: '#5a8ac0' }}>פורסם</span>}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

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
                      <button onClick={() => { setRespondModal(req); setResponse({ status: 'approved', admin_response: '' }); }} style={styles.btnAdd}>טפל</button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#c8baa6' }}>{new Date(req.created_at).toLocaleDateString('he-IL')}</div>
              </div>
            ))}
          </div>
        )}

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
                      <i className="ti ti-trash" onClick={() => setConfirmModal({ type: 'window', id: w.id, name: w.title })} style={styles.iconBtn} aria-hidden="true"></i>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'teacherprefs' && (
            <div style={styles.card}>
              {!prefTeacher ? (
                <>
                  <input
                    value={prefSearch}
                    onChange={e => setPrefSearch(e.target.value)}
                    placeholder="חיפוש מורה…"
                    style={{ ...styles.input, marginBottom: '16px' }}
                  />
                  {teachers.filter(t => !t.is_admin && `${t.first_name} ${t.last_name}`.includes(prefSearch.trim())).map((t, i, arr) => (
                    <div
                      key={t.id}
                      onClick={() => openTeacherPrefs(t)}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 8px', borderBottom: i < arr.length - 1 ? '1px solid #f0ebe3' : 'none', cursor: 'pointer' }}
                    >
                      <div style={styles.avatar}>{initials(t)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '15px', color: '#4a3f35' }}>{t.first_name} {t.last_name}</div>
                        <div style={{ fontSize: '12px', color: '#8a7a6e' }}>{t.email}</div>
                      </div>
                      <i className="ti ti-chevron-left" style={{ color: '#c8baa6' }} aria-hidden="true"></i>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <button onClick={() => { setPrefTeacher(null); setPrefData(null); setPrefEditing(false); setPrefDraft({}); }} style={{ ...styles.btnOutline, fontSize: '13px', padding: '6px 12px' }}>
                      <i className="ti ti-chevron-right" aria-hidden="true"></i> חזרה לרשימה
                    </button>                      
                    <button onClick={() => setShowScheduleConfirm(true)} style={{ ...styles.btnOutline, fontSize: '13px', padding: '6px 12px' }}>
                      <i className="ti ti-calendar" aria-hidden="true"></i> צפה במערכת של המורה
                    </button>
                    {prefData && (
                      !prefEditing ? (
                        <button onClick={startPrefEdit} style={{ ...styles.btnOutline, fontSize: '13px', padding: '6px 12px' }}>
                          <i className="ti ti-edit" aria-hidden="true"></i> ערוך
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={savePrefEdit} disabled={prefSaving} style={{ backgroundColor: '#8a9e78', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', cursor: prefSaving ? 'default' : 'pointer', opacity: prefSaving ? 0.6 : 1 }}>
                            {prefSaving ? 'שומר…' : 'שמור'}
                          </button>
                          <button onClick={cancelPrefEdit} disabled={prefSaving} style={{ ...styles.btnOutline, fontSize: '13px', padding: '6px 14px' }}>ביטול</button>
                        </div>
                      )
                    )}
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '22px', color: '#4a3f35', margin: '0 0 8px 0', fontWeight: 700 }}>
                      העדפות של <span style={{ color: '#4a3f35' }}>{prefTeacher.first_name} {prefTeacher.last_name}</span>
                    </h3>
                    <div style={{ width: '48px', height: '3px', backgroundColor: '#8a9e78', borderRadius: '2px' }}></div>
                  </div>

                  {showScheduleConfirm && (
                    <div onClick={() => setShowScheduleConfirm(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#FAF7F2', border: '1px solid #e2dacc', borderRadius: '14px', padding: '24px', width: '90%', maxWidth: '440px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', color: '#4a3f35' }}>מעבר לתצוגת מערכת שעות</h3>
                        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#4a3f35', lineHeight: 1.6 }}>המעבר יציג את מערכת השעות של המורה, ולא את עמוד ההעדפות.</p>
                        <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#c0705a', lineHeight: 1.6 }}>שים/י לב: אם התחלת לערוך ולא שמרת, השינויים לא יישמרו.</p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-start' }}>
                          <button onClick={viewTeacherSchedule} style={{ backgroundColor: '#8a9e78', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '14px', cursor: 'pointer' }}>כן, אני רוצה לצפות במערכת</button>
                          <button onClick={() => setShowScheduleConfirm(false)} style={{ ...styles.btnOutline, padding: '9px 16px', fontSize: '14px' }}>להישאר בעמוד ההעדפות בינתיים</button>
                        </div>
                      </div>
                    </div>
                  )}
  
                  {prefLoading ? (
                    <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>טוען…</div>
                  ) : !prefData ? (
                    <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>לא נמצאו נתונים</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
  
                      {/* Subjects */}
                      <div>
                        <div style={{ fontSize: '14px', color: '#4a3f35', fontWeight: 600, marginBottom: '8px' }}>מקצועות שהמורה מלמד/ת</div>
                        {!prefEditing ? (
                          prefData.subjects.length === 0 ? (
                            <div style={{ fontSize: '13px', color: '#c8baa6' }}>לא נבחרו מקצועות</div>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {prefData.subjects.map(s => {
                                const subj = subjects.find(x => x.id === s.subject_id);
                                return <span key={s.subject_id} style={{ padding: '5px 12px', borderRadius: '20px', backgroundColor: '#EDF4E8', color: '#4a7c3f', fontSize: '13px' }}>{subj ? subj.subject_name : `#${s.subject_id}`}</span>;
                              })}
                            </div>
                          )
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {subjects.map(subj => {
                              const selected = prefSubjectsDraft.includes(subj.id);
                              return (
                                <button
                                  key={subj.id}
                                  onClick={() => setPrefSubjectsDraft(d => d.includes(subj.id) ? d.filter(x => x !== subj.id) : [...d, subj.id])}
                                  style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', border: selected ? '1px solid #8a9e78' : '1px solid #e2dacc', backgroundColor: selected ? '#EDF4E8' : '#fff', color: selected ? '#4a7c3f' : '#8a7a6e' }}
                                >
                                  {subj.subject_name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
  
                      {/* Grade levels */}
                      <div>
                        <div style={{ fontSize: '14px', color: '#4a3f35', fontWeight: 600, marginBottom: '8px' }}>שכבות מועדפות</div>
                        {!prefEditing ? (
                          prefData.grades.length === 0 ? (
                            <div style={{ fontSize: '13px', color: '#c8baa6' }}>לא נבחרו שכבות</div>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {prefData.grades.map(g => <span key={g.grade_level} style={{ padding: '5px 12px', borderRadius: '20px', backgroundColor: '#EDF4E8', color: '#4a7c3f', fontSize: '13px' }}>כיתה {['א', 'ב', 'ג', 'ד', 'ה', 'ו'][g.grade_level - 1]}'</span>)}
                            </div>
                          )
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {[1, 2, 3, 4, 5, 6].map(gl => {
                              const selected = prefGradesDraft.includes(gl);
                              return (
                                <button
                                  key={gl}
                                  onClick={() => setPrefGradesDraft(d => d.includes(gl) ? d.filter(x => x !== gl) : [...d, gl])}
                                  style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', border: selected ? '1px solid #8a9e78' : '1px solid #e2dacc', backgroundColor: selected ? '#EDF4E8' : '#fff', color: selected ? '#4a7c3f' : '#8a7a6e' }}
                                >
                                  כיתה {['א', 'ב', 'ג', 'ד', 'ה', 'ו'][gl - 1]}'
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
  
                      {/* Homeroom */}
                      <div>
                        <div style={{ fontSize: '14px', color: '#4a3f35', fontWeight: 600, marginBottom: '8px' }}>חינוך כיתה</div>
                        {!prefEditing ? (
                          <div style={{ fontSize: '13px', color: '#8a7a6e', lineHeight: 1.8 }}>
                            <div>
                              {prefData.homeroom && prefData.homeroom.wants_homeroom
                                ? 'המורה מעוניין/ת בחינוך כיתה'
                                : 'המורה לא ביקש/ה חינוך כיתה'}
                            </div>
                            {prefData.homeroom?.wants_homeroom && (
                              <>
                                <div>כיתה מועדפת: {allGroups.find(g => g.id === prefData.homeroom.preferred_group_id)?.group_name || 'לא נבחרה'}</div>
                                <div>המשך עם הכיתה הקודמת: {prefData.homeroom.wants_continue_with_previous ? 'כן' : 'לא'}</div>
                              </>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '320px' }}>
                              <span style={{ fontSize: '13px', color: '#4a3f35' }}>מעוניין/ת בחינוך כיתה</span>
                              <button
                                onClick={() => setPrefHomeroomDraft(d => ({ ...d, wants_homeroom: !d.wants_homeroom }))}
                                style={{ width: '52px', height: '28px', borderRadius: '20px', border: 'none', cursor: 'pointer', backgroundColor: prefHomeroomDraft.wants_homeroom ? '#8a9e78' : '#d8d0c4', position: 'relative', transition: 'background-color 0.15s' }}
                                aria-label="מעוניין בחינוך כיתה"
                              >
                                <span style={{ position: 'absolute', top: '3px', [prefHomeroomDraft.wants_homeroom ? 'left' : 'right']: '3px', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#fff' }}></span>
                              </button>
                            </div>
                            {prefHomeroomDraft.wants_homeroom && (
                              <>
                                <div style={{ maxWidth: '320px' }}>
                                  <div style={{ fontSize: '13px', color: '#4a3f35', marginBottom: '6px' }}>כיתה מועדפת</div>
                                  <select
                                    value={prefHomeroomDraft.preferred_group_id ?? ''}
                                    onChange={e => setPrefHomeroomDraft(d => ({ ...d, preferred_group_id: e.target.value ? parseInt(e.target.value) : null }))}
                                    style={{ ...styles.input, width: '100%' }}
                                  >
                                    <option value="">ללא העדפה</option>
                                    {allGroups.map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
                                  </select>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '320px' }}>
                                  <span style={{ fontSize: '13px', color: '#4a3f35' }}>המשך עם הכיתה הקודמת</span>
                                  <button
                                    onClick={() => setPrefHomeroomDraft(d => ({ ...d, wants_continue_with_previous: !d.wants_continue_with_previous }))}
                                    style={{ width: '52px', height: '28px', borderRadius: '20px', border: 'none', cursor: 'pointer', backgroundColor: prefHomeroomDraft.wants_continue_with_previous ? '#8a9e78' : '#d8d0c4', position: 'relative', transition: 'background-color 0.15s' }}
                                    aria-label="המשך עם הכיתה הקודמת"
                                  >
                                    <span style={{ position: 'absolute', top: '3px', [prefHomeroomDraft.wants_continue_with_previous ? 'left' : 'right']: '3px', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#fff' }}></span>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
  
                      {/* Priority preferences */}
                      <div>
                        <div style={{ fontSize: '14px', color: '#4a3f35', fontWeight: 600, marginBottom: '8px' }}>העדפות שיבוץ</div>

                        {/* Read-only hours facts (never editable by the principal) */}
                        <div style={{ fontSize: '13px', color: '#8a7a6e', lineHeight: 1.8, marginBottom: prefEditing ? '14px' : '0' }}>
                          <div>מכסת השעות של המורה: {prefTeacher.weekly_hours_quota ?? '—'}</div>
                          {prefData.prefs && <div>טווח שעות מבוקש: {prefData.prefs.min_hours}–{prefData.prefs.max_hours}</div>}
                        </div>

                        {!prefEditing ? (
                          !prefData.prefs ? (
                            <div style={{ fontSize: '13px', color: '#c8baa6' }}>לא הוגדרו העדפות</div>
                          ) : (
                            <div style={{ fontSize: '13px', color: '#8a7a6e', lineHeight: 1.8 }}>
                              <div>סיום מוקדם: {prefData.prefs.priority_early_finish ? 'מועדף' : 'ללא'}</div>
                              <div>ללא חלונות: {prefData.prefs.priority_no_gaps ? 'מועדף' : 'ללא'}</div>
                              <div>יום חופשי: {prefData.prefs.priority_free_day ? 'מועדף' : 'ללא'}</div>
                              <div>שיעורים רצופים: {prefData.prefs.priority_consecutive ? 'מועדף' : 'ללא'}</div>
                              <div>העדפת שיעורים: {prefData.prefs.preferred_consecutive ? 'רצופים' : 'עם הפסקות'}</div>
                            </div>
                          )
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {[
                              { field: 'priority_early_finish', label: 'סיום מוקדם' },
                              { field: 'priority_no_gaps', label: 'הימנעות מחלונות' },
                              { field: 'priority_free_day', label: 'יום חופשי' },
                              { field: 'priority_consecutive', label: 'שיעורים רצופים' },
                            ].map(({ field, label }) => (
                              <div key={field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '320px' }}>
                                <span style={{ fontSize: '13px', color: '#4a3f35' }}>{label}</span>
                                <button
                                  onClick={() => setPrefDraft(d => ({ ...d, [field]: d[field] ? 0 : 1 }))}
                                  style={{ width: '52px', height: '28px', borderRadius: '20px', border: 'none', cursor: 'pointer', backgroundColor: prefDraft[field] ? '#8a9e78' : '#d8d0c4', position: 'relative', transition: 'background-color 0.15s' }}
                                  aria-label={label}
                                >
                                  <span style={{ position: 'absolute', top: '3px', [prefDraft[field] ? 'left' : 'right']: '3px', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#fff' }}></span>
                                </button>
                              </div>
                            ))}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '320px', marginTop: '4px' }}>
                              <span style={{ fontSize: '13px', color: '#4a3f35' }}>העדפת שיעורים</span>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  onClick={() => setPrefDraft(d => ({ ...d, preferred_consecutive: true }))}
                                  style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', border: prefDraft.preferred_consecutive ? '1px solid #8a9e78' : '1px solid #e2dacc', backgroundColor: prefDraft.preferred_consecutive ? '#EDF4E8' : '#fff', color: prefDraft.preferred_consecutive ? '#4a7c3f' : '#8a7a6e' }}
                                >
                                  רצופים
                                </button>
                                <button
                                  onClick={() => setPrefDraft(d => ({ ...d, preferred_consecutive: false }))}
                                  style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', border: !prefDraft.preferred_consecutive ? '1px solid #8a9e78' : '1px solid #e2dacc', backgroundColor: !prefDraft.preferred_consecutive ? '#EDF4E8' : '#fff', color: !prefDraft.preferred_consecutive ? '#4a7c3f' : '#8a7a6e' }}
                                >
                                  עם הפסקות
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
  
                      {/* Availability constraints */}
                      <div>
                        <div style={{ fontSize: '14px', color: '#4a3f35', fontWeight: 600, marginBottom: '8px' }}>אילוצי זמינות</div>
                        {!prefEditing ? (
                          prefData.constraints.length === 0 ? (
                            <div style={{ fontSize: '13px', color: '#c8baa6' }}>אין אילוצי זמינות</div>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {prefData.constraints
                                .slice()
                                .sort((a, b) => a.timeslot_id - b.timeslot_id)
                                .map(c => {
                                  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
                                  const dayIdx = Math.floor((c.timeslot_id - 1) / 8);
                                  const hour = ((c.timeslot_id - 1) % 8) + 1;
                                  const hard = c.constraint_type === 'hard';
                                  return (
                                    <span key={c.id} style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '12px', backgroundColor: hard ? '#FAE8E8' : '#FFF3A3', color: hard ? '#c0705a' : '#a08c30' }}>
                                      יום {dayNames[dayIdx]} · שעה {hour} · {hard ? 'לא יכול' : 'מעדיף שלא'}
                                    </span>
                                  );
                                })}
                            </div>
                          )
                        ) : (
                          <div>
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', fontSize: '12px', color: '#8a7a6e' }}>
                              <span><span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#FFF3A3', marginLeft: '5px', verticalAlign: 'middle' }}></span>מעדיף שלא</span>
                              <span><span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#FAE8E8', marginLeft: '5px', verticalAlign: 'middle' }}></span>לא יכול</span>
                              <span style={{ color: '#c8baa6' }}>לחיצה מחליפה בין המצבים</span>
                            </div>
                            <table style={{ borderCollapse: 'separate', borderSpacing: '4px' }}>
                              <thead>
                                <tr>
                                  <th></th>
                                  {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'].map((d, di) => (
                                    <th key={di} style={{ fontSize: '12px', color: '#4a3f35', fontWeight: 600, padding: '2px 6px' }}>{d}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(hour => (
                                  <tr key={hour}>
                                    <td style={{ fontSize: '12px', color: '#8a7a6e', padding: '2px 6px', whiteSpace: 'nowrap' }}>שיעור {hour}</td>
                                    {[0, 1, 2, 3, 4, 5].map(dayIdx => {
                                      if (dayIdx === 5 && hour > 4) return <td key={dayIdx}></td>;  // Friday has hours 1-4 only
                                      const tsId = dayIdx * 8 + hour;
                                      const state = prefConstraintsDraft[tsId];
                                      const bg = state === 'hard' ? '#FAE8E8' : state === 'soft' ? '#FFF3A3' : '#f7f4ef';
                                      const mark = state === 'hard' ? '✕' : state === 'soft' ? '–' : '';
                                      const color = state === 'hard' ? '#c0705a' : '#a08c30';
                                      return (
                                        <td key={dayIdx}>
                                          <button
                                            onClick={() => cyclePrefCell(tsId)}
                                            style={{ width: '38px', height: '34px', borderRadius: '8px', border: '1px solid #e2dacc', backgroundColor: bg, color, cursor: 'pointer', fontSize: '15px', lineHeight: 1 }}
                                            aria-label={`יום ${['ראשון','שני','שלישי','רביעי','חמישי','שישי'][dayIdx]} שעה ${hour}`}
                                          >{mark}</button>
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
  
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        
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
                  <i className="ti ti-edit" onClick={() => setEditTeacher(teacher)} style={styles.iconBtn} aria-hidden="true"></i>
                  <i className="ti ti-trash" onClick={() => setConfirmModal({ type: 'teacher', id: teacher.id, name: `${teacher.first_name} ${teacher.last_name}` })} style={styles.iconBtn} aria-hidden="true"></i>
                </div>
              </div>
            ))}
          </div>
        )}

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
                  <i className="ti ti-edit" onClick={() => setEditModal({ type: 'room', id: room.id, values: room })} style={styles.iconBtn} aria-hidden="true"></i>
                  <i className="ti ti-trash" onClick={() => setConfirmModal({ type: 'room', id: room.id, name: room.room_name })} style={styles.iconBtn} aria-hidden="true"></i>
                </div>
              </div>
            ))}
          </div>
        )}

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
                  <i className="ti ti-edit" onClick={() => setEditModal({ type: 'subject', id: subject.id, values: subject })} style={styles.iconBtn} aria-hidden="true"></i>
                  <i className="ti ti-trash" onClick={() => setConfirmModal({ type: 'subject', id: subject.id, name: subject.subject_name })} style={styles.iconBtn} aria-hidden="true"></i>
                </div>
              </div>
            ))}
          </div>
        )}

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
                  <i className="ti ti-edit" onClick={() => setEditModal({ type: 'group', id: group.id, values: group })} style={styles.iconBtn} aria-hidden="true"></i>
                  <i className="ti ti-trash" onClick={() => setConfirmModal({ type: 'group', id: group.id, name: group.group_name })} style={styles.iconBtn} aria-hidden="true"></i>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'schedule' && (
          <>
            <div style={{ ...styles.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button onClick={handleGenerate} disabled={generating} style={{ ...styles.btnAdd, opacity: generating ? 0.7 : 1, cursor: generating ? 'not-allowed' : 'pointer' }}>
                  <i className={`ti ${generating ? 'ti-loader' : 'ti-wand'}`} aria-hidden="true"></i>
                  {generating ? 'בתהליך יצירה…' : 'צור מערכת שעות'}
                </button>
                <button onClick={handlePublish} disabled={publishing || !runInfo} style={{ ...styles.btnAdd, backgroundColor: '#6b8f5e', opacity: (publishing || !runInfo) ? 0.55 : 1, cursor: (publishing || !runInfo) ? 'not-allowed' : 'pointer' }}>
                  <i className="ti ti-send" aria-hidden="true"></i>
                  {publishing ? 'מפרסם…' : (runInfo?.is_published ? 'פרסם מחדש' : 'פרסם לצוות')}
                </button>
              </div>
              <div style={{ fontSize: '12px', color: '#8a7a6e', textAlign: 'left' }}>
                {generating && <div>היצירה עשויה לקחת עד כ-3 דקות. אפשר להמתין כאן.</div>}
                {genError && <div style={{ color: '#c0705a' }}>{genError}</div>}
                {publishMsg && <div style={{ color: '#6b8f5e' }}>{publishMsg}</div>}
                {runInfo && !generating && (
                  <div>
                    <div>המערכת נוצרה ע״י <strong>{runInfo.algorithm}</strong> · ציון {runInfo.score}{runInfo.run_at ? ` · תאריך: ${fmtDate(runInfo.run_at)}` : ''}</div>
                    <div style={{ marginTop: '2px' }}>{runInfo.is_published ? `פורסם ב-${fmtDate(runInfo.published_at)}` : 'טרם פורסם'}</div>
                  </div>
                )}
                {runInfo && <button onClick={openViolations} style={{ ...styles.btnOutline, marginTop: '8px' }}><i className="ti ti-alert-triangle" aria-hidden="true"></i> הפרות שנמצאו</button>}
              </div>
            </div>

            {!runInfo ? (
              <div style={{ ...styles.card, minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: '#c8baa6' }}>
                  <i className="ti ti-calendar" style={{ fontSize: '36px', display: 'block', marginBottom: '14px' }} aria-hidden="true"></i>
                  <div style={{ fontSize: '15px' }}>עדיין לא נוצרה מערכת שעות. לחצי על "צור מערכת שעות".</div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ ...styles.card, display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                  <span style={{ fontSize: '13px', color: '#8a7a6e', marginLeft: '8px' }}>ייצוא:</span>
                  <button
                    onClick={() => { setExportFormat('excel'); setExportOpen(true); setExportDim(null); setExportSearch(''); setExportMsg(''); }}
                    style={{ ...styles.viewBtn(false), display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <i className="ti ti-file-spreadsheet" aria-hidden="true"></i> ייצוא ל-EXCEL
                  </button>
                  <button
                    onClick={() => { setExportFormat('pdf'); setExportOpen(true); setExportDim(null); setExportSearch(''); setExportMsg(''); }}
                    style={{ ...styles.viewBtn(false), display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <i className="ti ti-file-type-pdf" aria-hidden="true"></i> ייצוא ל-PDF
                  </button>

                  {exportOpen && (
                    <>
                      <div onClick={closeExport} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
                      <div dir="rtl" style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 901, backgroundColor: '#fff', border: '1px solid #e2dacc', borderRadius: '12px', boxShadow: '0 8px 24px rgba(74,63,53,0.14)', width: '280px', padding: '8px', maxHeight: '360px', overflowY: 'auto' }}>
                        {exportMsg && (
                          <div style={{ fontSize: '12px', color: '#c0705a', backgroundColor: '#fff8f6', border: '1px solid #edc9bf', borderRadius: '8px', padding: '8px 10px', marginBottom: '8px', textAlign: 'center' }}>
                            {exportMsg}
                          </div>
                        )}
                        {exportDim === null ? (
                          <>
                            <button onClick={() => exportCurrent(exportFormat)} style={exportItemStyle(true)}>
                              <i className="ti ti-eye" aria-hidden="true"></i> ייצא את מה שפתוח כרגע
                            </button>
                            <div style={{ height: '1px', backgroundColor: '#f0ebe3', margin: '6px 4px' }} />
                            {['class', 'teacher', 'subject', 'grade'].map(dim => (
                              <button key={dim} onClick={() => { setExportDim(dim); setExportSearch(''); }} style={exportItemStyle(false)}>
                                <span>ייצוא לפי {DIM_LABEL[dim]}</span>
                                <i className="ti ti-chevron-left" style={{ marginRight: 'auto' }} aria-hidden="true"></i>
                              </button>
                            ))}
                          </>
                        ) : (
                          <>
                            <button onClick={() => setExportDim(null)} style={{ ...exportItemStyle(false), color: '#8a7a6e' }}>
                              <i className="ti ti-chevron-right" aria-hidden="true"></i> חזרה
                            </button>
                            <button onClick={() => exportAllOfDim(exportDim, exportFormat)} style={exportItemStyle(true)}>
                              <i className="ti ti-stack-2" aria-hidden="true"></i> ייצא הכל (כל {DIM_LABEL[exportDim]})
                            </button>
                            <input
                              autoFocus
                              value={exportSearch}
                              onChange={e => setExportSearch(e.target.value)}
                              placeholder={`חיפוש ${DIM_LABEL[exportDim]}…`}
                              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', margin: '6px 0', border: '1px solid #e2dacc', borderRadius: '8px', fontSize: '13px', fontFamily: 'Varela Round, sans-serif', backgroundColor: '#FAF7F2' }}
                            />
                            {valuesForDim(exportDim)
                              .filter(v => String(v).includes(exportSearch.trim()))
                              .map(v => (
                                <button key={v} onClick={() => exportOneValue(exportDim, v, exportFormat)} style={exportItemStyle(false)}>
                                  {exportDim === 'grade' ? `שכבת ${v}׳` : v}
                                </button>
                              ))}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
                
                <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {VIEW_TYPES.map(v => (
                      <button key={v.id} onClick={() => selectView(v.id)} style={styles.viewBtn(filterType === v.id)}>{v.label}</button>
                    ))}
                    <input style={{ ...styles.search, marginRight: 'auto' }} placeholder="חיפוש…" value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  {filterType && <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', width: '100%', minWidth: 0 }}>
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', gap: '10px', overflowX: tilesExpanded ? 'visible' : 'auto', flexWrap: tilesExpanded ? 'wrap' : 'nowrap', paddingBottom: '8px' }}>
                        {options.length === 0 ? (
                          <div style={{ color: '#c8baa6', fontSize: '13px', padding: '8px' }}>לא נמצאו תוצאות</div>
                        ) : options.map(o => {
                          const active = selectedValues.includes(o);
                          return (
                            <button key={o} onClick={() => toggleValue(o)} style={styles.tile(active)}>
                              <i className="ti ti-calendar-event" style={{ fontSize: '15px', color: active ? '#6b8f5e' : '#c8baa6' }} aria-hidden="true"></i>
                              {tileLabel(o)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {options.length > 0 && (
                      <button style={styles.arrowBtn} title={tilesExpanded ? 'צמצם' : 'הצג הכל'} onClick={() => setTilesExpanded(v => !v)}>
                        <i className={`ti ${tilesExpanded ? 'ti-chevron-up' : 'ti-chevron-left'}`} aria-hidden="true"></i>
                      </button>
                    )}
                  </div>}
                </div>
      
                {selectedValues.length === 0 ? (
                  !filterType ? (
                    <div style={{ textAlign: 'center', color: '#c8baa6', padding: '12px', fontSize: '13px' }}>
                      בחר/י תצוגה (כיתה / מורה / מקצוע / שכבה) כדי להתחיל.
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#c8baa6', padding: '12px', fontSize: '13px' }}>
                      בחר/י פריט אחד או יותר מהשורה למעלה כדי להציג מערכת שעות.
                    </div>
                  )
                ) : (
                  selectedValues.map(val => {
                    const valEntries = entriesFor(val);
                    const cellFor = (day, hour) => valEntries.filter(e => e.day_of_week === day && e.hour_of_day === hour);
                    return (
                      <div key={val} style={styles.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                          <h3 style={{ fontSize: '16px', color: '#4a3f35', margin: 0 }}>{tileLabel(val)}</h3>
                          <button onClick={() => toggleValue(val)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8baa6', fontSize: '13px', fontFamily: 'Varela Round, sans-serif' }}>
                            <i className="ti ti-x" aria-hidden="true"></i> הסתר
                          </button>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
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
                                    const lessons = cellFor(day, hour);
                                    return (
                                      <td key={day} style={styles.gridCell}>
                                        {lessons.map((e, idx) => (
                                          <div key={idx} style={styles.lessonBox}>
                                            <div style={{ fontWeight: 600 }}>{e.subject_name}</div>
                                            {filterType !== 'teacher' && <div style={{ color: '#8a7a6e' }}>{e.teacher_first_name} {e.teacher_last_name}</div>}
                                            {filterType !== 'class' && <div style={{ color: '#8a7a6e' }}>{e.group_name}</div>}
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
                      </div>
                    );
                  })
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'notifications' && (
          <>
            {notifSuccess && (
              <div style={{ backgroundColor: '#EDF4E8', color: '#4a7c3f', border: '1px solid #cfe3c4', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px', textAlign: 'center' }}>
                {notifSuccess}
              </div>
            )}
          <div style={styles.card}>
            {sentNotifs.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px', fontSize: '14px' }}>אין התראות עדיין</div>
            ) : sentNotifs.map((n, i) => (
              <div key={n.id} style={{ padding: '16px 0', borderBottom: i < sentNotifs.length - 1 ? '1px solid #f0ebe3' : 'none' }}>
                <div style={{ fontSize: '14px', color: '#4a3f35', marginBottom: '4px' }}>{n.title}</div>
                <div style={{ fontSize: '13px', color: '#8a7a6e', marginBottom: '6px' }}>{n.body}</div>
                <div style={{ fontSize: '11px', color: '#c8baa6' }}>{new Date(n.created_at).toLocaleString('he-IL')}</div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>
      
      {modal === 'teacher' && <AddTeacherModal onClose={() => setModal(null)} onAdded={t => setTeachers(prev => [...prev, t])} />}
      
      {editModal && (
        <EditModal
          title={editModal.type === 'room' ? 'עריכת חדר' : editModal.type === 'subject' ? 'עריכת מקצוע' : 'עריכת קבוצה'}
          initial={editModal.values}
          onClose={() => setEditModal(null)}
          onSave={handleEditSave}
          fields={
            editModal.type === 'room'
              ? [
                  { key: 'room_name', label: 'שם החדר', type: 'text' },
                  { key: 'capacity', label: 'קיבולת', type: 'number' },
                  { key: 'room_type', label: 'סוג חדר', type: 'text', optional: true },
                ]
              : editModal.type === 'subject'
              ? [
                  { key: 'subject_name', label: 'שם המקצוע', type: 'text' },
                  { key: 'required_room_id', label: 'חדר נדרש', type: 'select', optional: true,
                    options: rooms.map(r => ({ value: r.id, label: r.room_name })) },
                ]
              : [
                  { key: 'group_name', label: 'שם הקבוצה', type: 'text' },
                  { key: 'student_count', label: 'מספר תלמידים', type: 'number' },
                  { key: 'home_room_id', label: 'חדר בית', type: 'select', optional: true,
                    options: rooms.map(r => ({ value: r.id, label: r.room_name })) },
                ]
          }
        />
      )}
      
      {editTeacher && (
        <AddTeacherModal
          teacher={editTeacher}
          onClose={() => setEditTeacher(null)}
          onUpdated={() => { getTeachers().then(r => setTeachers(r.data)); }}
        />
      )}
      
      {modal === 'room' && <AddRoomModal onClose={() => setModal(null)} onAdded={r => setRooms(prev => [...prev, r])} />}
      {modal === 'subject' && <AddSubjectModal onClose={() => setModal(null)} onAdded={sub => setSubjects(prev => [...prev, sub])} rooms={rooms} />}
      {modal === 'group' && <AddGroupModal onClose={() => setModal(null)} onAdded={g => setGroups(prev => [...prev, g])} rooms={rooms} />}

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

      {showViolations && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowViolations(false)}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2dacc', padding: '28px', width: '640px', maxWidth: '92vw', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()} dir="rtl">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', color: '#4a3f35', margin: 0 }}>הפרות שנמצאו במערכת</h2>
              <button onClick={() => setShowViolations(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8baa6', fontSize: '20px' }}>✕</button>
            </div>
            {violations === null ? (
              <div style={{ textAlign: 'center', color: '#c8baa6', padding: '30px' }}>טוען…</div>
            ) : violations.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#6b8f5e', padding: '30px' }}>
                <i className="ti ti-circle-check" style={{ fontSize: '32px', display: 'block', marginBottom: '10px' }} aria-hidden="true"></i>
                לא נמצאו הפרות — מערכת מושלמת!
              </div>
            ) : (
              <>
                <div style={{ fontSize: '13px', color: '#8a7a6e', marginBottom: '14px' }}>
                  סה״כ {violations.length} הפרות · קשיחות: {violations.filter(v => v.severity === 'hard').length} · רכות: {violations.filter(v => v.severity === 'soft').length}
                </div>
                {violations.map((v, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < violations.length - 1 ? '1px solid #f0ebe3' : 'none' }}>
                    <span style={{ flexShrink: 0, fontSize: '11px', padding: '3px 10px', borderRadius: '20px', backgroundColor: v.severity === 'hard' ? '#FAE8E8' : '#FFF3A3', color: v.severity === 'hard' ? '#c0705a' : '#a08c30' }}>
                      {v.severity === 'hard' ? 'קשיחה' : 'רכה'}
                    </span>
                    <span style={{ flex: 1, fontSize: '13px', color: '#4a3f35' }}>{v.detail}</span>
                    <span style={{ flexShrink: 0, fontSize: '13px', color: '#8a7a6e', fontWeight: 600 }}>+{v.penalty.toLocaleString()}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setConfirmModal(null)}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2dacc', padding: '36px', width: '400px' }} onClick={e => e.stopPropagation()} dir="rtl">
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <i className="ti ti-trash" style={{ fontSize: '32px', color: '#c0705a', display: 'block', marginBottom: '12px' }} aria-hidden="true"></i>
              <div style={{ fontSize: '16px', color: '#4a3f35', marginBottom: '8px' }}>מחיקה</div>
              <div style={{ fontSize: '13px', color: '#8a7a6e' }}>האם למחוק את <strong>{confirmModal.name}</strong>?</div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => setConfirmModal(null)} style={styles.btnOutline}>ביטול</button>
              <button onClick={() => handleDelete(confirmModal.type, confirmModal.id)} style={{ ...styles.btnAdd, backgroundColor: '#c0705a' }}>מחק</button>
            </div>
          </div>
        </div>
      )}

      {showNotifForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={closeNotifForm}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2dacc', padding: '36px', width: '460px' }} onClick={e => e.stopPropagation()} dir="rtl">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', color: '#4a3f35', margin: 0 }}>שלח התראה חדשה</h2>
              <button onClick={closeNotifForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8baa6', fontSize: '20px' }}>✕</button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={styles.label}>כותרת</label>
              <input style={{ ...styles.input, borderColor: notifErrors.title ? '#c0705a' : undefined, backgroundColor: notifErrors.title ? '#fff8f6' : undefined }} value={notifTitle} onChange={e => { setNotifTitle(e.target.value); if (notifErrors.title) setNotifErrors(p => ({ ...p, title: false })); }} placeholder="נושא ההתראה" />
              {notifErrors.title && <div style={{ fontSize: '11px', color: '#c0705a', marginTop: '4px' }}>נא להזין כותרת</div>}
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={styles.label}>תוכן ההודעה</label>
              <textarea style={{ ...styles.input, height: '100px', resize: 'vertical', borderColor: notifErrors.body ? '#c0705a' : undefined, backgroundColor: notifErrors.body ? '#fff8f6' : undefined }} value={notifBody} onChange={e => { setNotifBody(e.target.value); if (notifErrors.body) setNotifErrors(p => ({ ...p, body: false })); }} placeholder="כתוב את ההודעה כאן..." />
              {notifErrors.body && <div style={{ fontSize: '11px', color: '#c0705a', marginTop: '4px' }}>נא להזין תוכן</div>}
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={styles.label}>אל</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: notifMode === 'specific' ? '12px' : 0 }}>
                <button onClick={() => setNotifMode('all')} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', border: '1px solid #e2dacc', backgroundColor: notifMode === 'all' ? '#8a9e78' : '#f5f2ee', color: notifMode === 'all' ? '#fff' : '#8a7a6e', fontFamily: 'Varela Round, sans-serif' }}>כל המורים</button>
                <button onClick={() => setNotifMode('specific')} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', border: '1px solid #e2dacc', backgroundColor: notifMode === 'specific' ? '#8a9e78' : '#f5f2ee', color: notifMode === 'specific' ? '#fff' : '#8a7a6e', fontFamily: 'Varela Round, sans-serif' }}>מורים ספציפיים</button>
              </div>

              {notifMode === 'specific' && (
                <div style={{ border: '1px solid #e2dacc', borderRadius: '10px', padding: '10px', maxHeight: '200px', overflowY: 'auto', backgroundColor: '#FAF7F2' }}>
                  <input value={notifTeacherSearch} onChange={e => setNotifTeacherSearch(e.target.value)} placeholder="חיפוש מורה…" style={{ ...styles.input, marginBottom: '8px' }} />
                  {teachers.filter(t => !t.is_admin && `${t.first_name} ${t.last_name}`.includes(notifTeacherSearch.trim())).map(t => {
                    const checked = notifTeacherIds.includes(t.id);
                    return (
                      <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 6px', cursor: 'pointer', borderRadius: '6px', backgroundColor: checked ? '#EDF4E8' : 'transparent' }}>
                        <input type="checkbox" checked={checked} onChange={() => setNotifTeacherIds(prev => checked ? prev.filter(id => id !== t.id) : [...prev, t.id])} />
                        <span style={{ fontSize: '14px', color: '#4a3f35' }}>{t.first_name} {t.last_name}</span>
                      </label>
                    );
                  })}
                  <div style={{ fontSize: '11px', color: '#c8baa6', marginTop: '6px', textAlign: 'left' }}>{notifTeacherIds.length} נבחרו</div>
                </div>
              )}
            </div>
            {notifErrors.recipients && (
              <div style={{ fontSize: '12px', color: '#c0705a', backgroundColor: '#fff8f6', border: '1px solid #edc9bf', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', textAlign: 'center' }}>
                נא לבחור לפחות מורה אחד
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={closeNotifForm} style={styles.btnOutline}>ביטול</button>
              <button onClick={handleSendNotification} style={styles.btnAdd} disabled={notifSending}>
                <i className="ti ti-send" aria-hidden="true"></i>
                {notifSending ? 'שולח...' : (notifMode === 'specific' ? `שלח ל-${notifTeacherIds.length}` : 'שלח לכולם')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
