import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getTeachers, deleteTeacher, getRooms, deleteRoom, getSubjects, deleteSubject, getStudentGroups, deleteStudentGroup, getMyRequests, respondToRequest, getSubmissionWindows, createSubmissionWindow, deleteSubmissionWindow, sendNotification, getNotifications, deleteNotification, updateRoom, updateSubject, updateStudentGroup, updateTeacher, getMyConstraints, getTeacherPreferencesById, getTeacherSubjectsById, getTeacherGradeLevelsById, getTeacherHomeroomById, saveTeacherPreferencesById, addTeacherSubjectById, removeTeacherSubjectById, addTeacherGradeLevelById, removeTeacherGradeLevelById, saveTeacherHomeroomById, createConstraint, deleteConstraint, getScheduleRuns, selectScheduleRun, deleteScheduleRun, updateScheduleRunNote, getScheduleRunEntries, getSchoolSettings, saveSchoolSettings, getGradeLimits, saveGradeLimit, getPedagogicalConstraints, addPedagogicalConstraint, deletePedagogicalConstraint, getCurriculumByGroup, createCurriculumRequirement, updateCurriculumRequirement, deleteCurriculumRequirement } from '../services/api';
import AddTeacherModal from '../components/AddTeacherModal';
import EditModal from '../components/EditModal';
import AddRoomModal from '../components/AddRoomModal';
import AddSubjectModal from '../components/AddSubjectModal';
import AddGroupModal from '../components/AddGroupModal';
import ScheduleTab from '../components/ScheduleTab';
import { useNavigate } from 'react-router-dom';
import { styles } from './adminDashboard.styles';
import { fmtDate, fmtDateTime } from '../utils/format';

const TABS = [
  { id: 'schedule', label: 'מערכת שעות', icon: 'ti-calendar' },
  { id: 'history', label: 'היסטוריית מערכות', icon: 'ti-history' },
  { id: 'requests', label: 'פניות מורים', icon: 'ti-message' },
  { id: 'teacherprefs', label: 'העדפות מורים', icon: 'ti-clipboard-text' },
  { id: 'windows', label: 'חלונות הגשה', icon: 'ti-calendar-event' },
  { id: 'notifications', label: 'התראות', icon: 'ti-bell' },
  { id: 'school', label: 'הגדרות מוסד', icon: 'ti-settings' },
  { id: 'teachers', label: 'מורים', icon: 'ti-users' },
  { id: 'rooms', label: 'חדרים', icon: 'ti-building' },
  { id: 'subjects', label: 'מקצועות', icon: 'ti-book' },
  { id: 'groups', label: 'קבוצות', icon: 'ti-school' },
];

const SCHOOL_TABS = [
  { id: 'day', label: 'מבנה יום' },
  { id: 'ped', label: 'אילוצים פדגוגיים' },
  { id: 'curriculum', label: 'תכנית לימודים' },
];

const DAYS = { 1: 'ראשון', 2: 'שני', 3: 'שלישי', 4: 'רביעי', 5: 'חמישי', 6: 'שישי' };
const VIEWER_DAY_ORDER = [1, 2, 3, 4, 5, 6];
const VIEWER_HOURS = [1, 2, 3, 4, 5, 6, 7, 8];
const GRADES = [1, 2, 3, 4, 5, 6];
const GRADE_LABELS = { 1: "א'", 2: "ב'", 3: "ג'", 4: "ד'", 5: "ה'", 6: "ו'" };

const PEDAGOGICAL_TYPES = [
  { value: 'max_per_day', label: 'מקסימום שיעורים ביום' },
  { value: 'not_last', label: 'לא בשיעור האחרון' },
  { value: 'morning_only', label: 'בבוקר בלבד' },
  { value: 'not_consecutive', label: 'לא ברצף עם מקצוע אחר' },
  { value: 'min_gap', label: 'מינימום הפסקה בין שיעורים' },
];

const REQUEST_TYPES = {
  constraint_change: 'שינוי אילוץ',
  absence: 'בקשת היעדרות',
  general: 'פנייה כללית',
};

const statusLabel = (s) => ({ pending: 'ממתין', approved: 'אושר', rejected: 'נדחה' }[s] || s);
const statusColor = (s) => ({ pending: '#c8baa6', approved: '#8a9e78', rejected: '#c0705a' }[s] || '#c8baa6');

// Stable per-teacher avatar color (same hash-based approach as subject
// colors in ScheduleTab, kept local here since it's a different concern).
const TEACHER_COLOR_PALETTE = [
  { bg: '#CDE7D8', color: '#2f6b4a' },
  { bg: '#D6E4F5', color: '#33578f' },
  { bg: '#F6DCC9', color: '#8f5b28' },
  { bg: '#E7D8F2', color: '#5f4080' },
  { bg: '#F5D8DF', color: '#8a3a54' },
  { bg: '#D9EDEA', color: '#286e60' },
  { bg: '#F2E6C9', color: '#7a611c' },
  { bg: '#DADEF2', color: '#3c4494' },
];
const colorForTeacher = (id) => {
  const s = String(id ?? '');
  let hash = 5381;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) + hash + s.charCodeAt(i)) >>> 0;
  return TEACHER_COLOR_PALETTE[hash % TEACHER_COLOR_PALETTE.length];
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
  const [reqPrimaryFilter, setReqPrimaryFilter] = useState('all'); // 'all' | 'pending' | 'resolved'
  const [reqStatusFilter, setReqStatusFilter] = useState('all');
  const [reqTeacherFilter, setReqTeacherFilter] = useState('all');
  const [reqTypeFilter, setReqTypeFilter] = useState('all');
  const [windows, setWindows] = useState([]);
  const [modal, setModal] = useState(null);
  const [respondModal, setRespondModal] = useState(null);
  const [response, setResponse] = useState({ status: 'approved', admin_response: '' });
  const [newWindow, setNewWindow] = useState({ title: '', start_date: '', end_date: '' });
  const [windowErrors, setWindowErrors] = useState({ title: false, start_date: false, end_date: false });
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
  const [allNotifs, setAllNotifs] = useState([]);
  const [notifView, setNotifView] = useState('all'); // 'all' | 'messages' (I sent) | 'system' (someone else triggered)
  const [runs, setRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [confirmSelectRun, setConfirmSelectRun] = useState(null);
  const [viewingRun, setViewingRun] = useState(null);
  const [viewingNote, setViewingNote] = useState(null);
  const [viewingEntries, setViewingEntries] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [viewingError, setViewingError] = useState('');
  const [viewingClass, setViewingClass] = useState(null);
  const [selectingRun, setSelectingRun] = useState(false);
  const [confirmDeleteRun, setConfirmDeleteRun] = useState(null);
  const [deletingRun, setDeletingRun] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [historyMsg, setHistoryMsg] = useState('');
  // Handoff into ScheduleTab: { type: 'class'|'teacher'|'subject'|'grade', value } | null
  const [scheduleJump, setScheduleJump] = useState(null);
  // School Settings
  const [schoolTab, setSchoolTab] = useState('day');
  const [schoolSettings, setSchoolSettings] = useState({ active_days: [1, 2, 3, 4, 5, 6], start_time: '08:00', breaks: [], grade_end_times: {} });
  const [gradeLimits, setGradeLimits] = useState({});
  const [pedagogical, setPedagogical] = useState([]);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [newBreak, setNewBreak] = useState({ after_lesson: 2, duration_minutes: 10 });
  const [newPedagogical, setNewPedagogical] = useState({ constraint_type: '', subject_a_id: '', subject_b_id: '', numeric_value: '', raw_text: '' });
  const [pedError, setPedError] = useState('');
  const [editingPedId, setEditingPedId] = useState(null);
  const [editPedDraft, setEditPedDraft] = useState(null);
  const [savingPed, setSavingPed] = useState(false);

  // Curriculum
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [curriculumData, setCurriculumData] = useState([]);
  const [curriculumHours, setCurriculumHours] = useState({});
  const [curriculumSaved, setCurriculumSaved] = useState(false);
  const [copyFromGroup, setCopyFromGroup] = useState('');
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
    if (activeTab === 'history') { setRunsLoading(true); getScheduleRuns().then(r => setRuns(r.data)).catch(() => { }).finally(() => setRunsLoading(false)); }
    if (activeTab === 'requests') getMyRequests().then(r => { setRequests(r.data); setPendingCount(r.data.filter(x => x.status === 'pending').length); });
    if (activeTab === 'windows') getSubmissionWindows().then(r => setWindows(r.data));
    if (activeTab === 'teacherprefs') {
      getTeachers().then(r => setTeachers(r.data)).catch(() => { });
      getSubjects().then(r => setSubjects(r.data)).catch(() => { });
    }
    if (activeTab === 'notifications') {
      getNotifications().then(r => setAllNotifs(r.data)).catch(() => { });
      getTeachers().then(r => setTeachers(r.data)).catch(() => { });
    }

    if (activeTab === 'school') {
      getSchoolSettings().then(r => setSchoolSettings({ ...r.data, grade_end_times: r.data.grade_end_times || {} })).catch(() => { });
      getGradeLimits().then(r => {
        const obj = {};
        r.data.forEach(g => { obj[g.grade_level] = g.max_lessons_per_day; });
        setGradeLimits(obj);
      }).catch(() => { });
      getPedagogicalConstraints().then(r => setPedagogical(r.data)).catch(() => { });
      getSubjects().then(r => setSubjects(r.data)).catch(() => { });
      getStudentGroups().then(r => {
        setGroups(r.data);
        if (r.data.length > 0 && !selectedGroup) setSelectedGroup(r.data[0]);
      }).catch(() => { });
    }


  }, [activeTab]);


  useEffect(() => {
    if (selectedGroup) {
      getCurriculumByGroup(selectedGroup.id).then(r => setCurriculumData(r.data)).catch(() => { });
    }
  }, [selectedGroup]);

  useEffect(() => {
    const hours = {};
    curriculumData.forEach(c => { hours[c.subject_id] = c.weekly_hours; });
    setCurriculumHours(hours);
  }, [curriculumData]);


  useEffect(() => {
    getMyRequests().then(r => setPendingCount(r.data.filter(x => x.status === 'pending').length)).catch(() => { });
  }, []);

  const handleEditSave = async (payload) => {
    const { type, id } = editModal;
    if (type === 'room') { await updateRoom(id, payload); getRooms().then(r => setRooms(r.data)); }
    else if (type === 'subject') { await updateSubject(id, payload); getSubjects().then(r => setSubjects(r.data)); }
    else if (type === 'group') { await updateStudentGroup(id, payload); getStudentGroups().then(r => setGroups(r.data)); }
  };

  const handleSaveSchoolSettings = async () => {
    try {
      await saveSchoolSettings(schoolSettings);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (e) { console.error(e); }
  };

  const handleAddBreak = () => {
    setSchoolSettings(prev => ({ ...prev, breaks: [...(prev.breaks || []), newBreak] }));
    setNewBreak({ after_lesson: 2, duration_minutes: 10 });
  };

  const handleRemoveBreak = (idx) => {
    setSchoolSettings(prev => ({ ...prev, breaks: prev.breaks.filter((_, i) => i !== idx) }));
  };

  const handleSaveGradeLimit = async (grade, value) => {
    await saveGradeLimit({ grade_level: grade, max_lessons_per_day: parseInt(value) });
    setGradeLimits(prev => ({ ...prev, [grade]: parseInt(value) }));
  };

  const handleAddPedagogical = async () => {
    const t = newPedagogical.constraint_type;
    if (!t) { setPedError('יש לבחור סוג אילוץ'); return; }
    if (!newPedagogical.subject_a_id) { setPedError('יש לבחור מקצוע'); return; }
    if (t === 'not_consecutive') {
      if (!newPedagogical.subject_b_id) { setPedError('יש לבחור מקצוע שני'); return; }
      if (newPedagogical.subject_a_id === newPedagogical.subject_b_id) { setPedError('יש לבחור שני מקצועות שונים'); return; }
    }
    if (t === 'max_per_day' && (!parseInt(newPedagogical.numeric_value) || parseInt(newPedagogical.numeric_value) < 1)) {
      setPedError('יש להזין ערך מספרי (1 ומעלה)'); return;
    }
    setPedError('');
    const data = {
      constraint_type: t,
      subject_a_id: newPedagogical.subject_a_id ? parseInt(newPedagogical.subject_a_id) : null,
      subject_b_id: newPedagogical.subject_b_id
        ? parseInt(newPedagogical.subject_b_id)
        : (t === 'min_gap' ? parseInt(newPedagogical.subject_a_id) : null),
      numeric_value: t === 'min_gap'
        ? (parseInt(newPedagogical.numeric_value) || 0)
        : (newPedagogical.numeric_value ? parseInt(newPedagogical.numeric_value) : null),
      raw_text: newPedagogical.raw_text || null,
    };
    await addPedagogicalConstraint(data);
    getPedagogicalConstraints().then(r => setPedagogical(r.data));
    setNewPedagogical({ constraint_type: '', subject_a_id: '', subject_b_id: '', numeric_value: '', raw_text: '' });
  };

  const handleDeletePedagogical = async (id) => {
    await deletePedagogicalConstraint(id);
    setPedagogical(prev => prev.filter(p => p.id !== id));
  };

  const startEditPed = (p) => {
    setEditingPedId(p.id);
    setEditPedDraft({
      constraint_type: p.constraint_type,
      subject_a_id: p.subject_a_id != null ? String(p.subject_a_id) : '',
      subject_b_id: p.subject_b_id != null ? String(p.subject_b_id) : '',
      numeric_value: p.numeric_value != null ? String(p.numeric_value) : '',
    });
  };

  const cancelEditPed = () => {
    setEditingPedId(null);
    setEditPedDraft(null);
  };

  // No update endpoint exists for pedagogical constraints, so an "edit" is
  // implemented as delete-old + create-new using the two calls that already work.
  const saveEditPed = async () => {
    if (!editPedDraft) return;
    setSavingPed(true);
    try {
      await deletePedagogicalConstraint(editingPedId);
      await addPedagogicalConstraint({
        constraint_type: editPedDraft.constraint_type,
        subject_a_id: editPedDraft.subject_a_id ? parseInt(editPedDraft.subject_a_id) : null,
        subject_b_id: editPedDraft.subject_b_id ? parseInt(editPedDraft.subject_b_id) : null,
        numeric_value: editPedDraft.numeric_value ? parseInt(editPedDraft.numeric_value) : null,
        raw_text: null,
      });
      const res = await getPedagogicalConstraints();
      setPedagogical(res.data);
      setEditingPedId(null);
      setEditPedDraft(null);
    } catch (err) {
      alert('השמירה נכשלה. נסה/י שוב.');
    } finally {
      setSavingPed(false);
    }
  };

  const handleSaveCurriculum = async () => {
    if (!selectedGroup) return;
    for (const subject of subjects) {
      const existing = curriculumData.find(c => c.subject_id === subject.id);
      const hours = parseInt(curriculumHours[subject.id] || 0);
      if (existing) {
        if (existing.weekly_hours !== hours) {
          await updateCurriculumRequirement(existing.id, { weekly_hours: hours });
        }
      } else if (hours > 0) {
        await createCurriculumRequirement({ subject_id: subject.id, student_group_id: selectedGroup.id, weekly_hours: hours });
      }
    }
    getCurriculumByGroup(selectedGroup.id).then(r => setCurriculumData(r.data));
    setCurriculumSaved(true);
    setTimeout(() => setCurriculumSaved(false), 2000);
  };

  const handleCopyFrom = async () => {
    if (!copyFromGroup) return;
    const fromGroup = groups.find(g => g.id === parseInt(copyFromGroup));
    if (!fromGroup) return;
    const res = await getCurriculumByGroup(fromGroup.id);
    const newHours = {};
    res.data.forEach(c => { newHours[c.subject_id] = c.weekly_hours; });
    setCurriculumHours(newHours);
  };

  const groupsByGrade = () => {
    const obj = {};
    groups.forEach(g => {
      const match = g.group_name.match(/([א-ו])/);
      const grade = match ? match[1] : 'אחר';
      if (!obj[grade]) obj[grade] = [];
      obj[grade].push(g);
    });
    return obj;
  };

  const viewTeacherSchedule = () => {
    setActiveTab('schedule');
    setScheduleJump({ type: 'teacher', value: `${prefTeacher.first_name} ${prefTeacher.last_name}` });
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

  const startNoteEdit = (run) => {
    setEditingNoteId(run.id);
    setNoteDraft(run.admin_note || '');
  };

  const cancelNoteEdit = () => {
    setEditingNoteId(null);
    setNoteDraft('');
  };

  const saveNote = async (runId) => {
    setSavingNote(true);
    try {
      const res = await updateScheduleRunNote(runId, noteDraft.trim());
      setRuns(prev => prev.map(r => r.id === runId ? { ...r, admin_note: res.data.admin_note } : r));
      setEditingNoteId(null);
      setNoteDraft('');
    } catch (err) {
      alert('שמירת ההערה נכשלה. נסה/י שוב.');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteRun = async () => {
    if (!confirmDeleteRun) return;
    setDeletingRun(true);
    try {
      await deleteScheduleRun(confirmDeleteRun.id);
      setRuns(prev => prev.filter(r => r.id !== confirmDeleteRun.id));
      setConfirmDeleteRun(null);
      setHistoryMsg('המערכת נמחקה מההיסטוריה.');
      setTimeout(() => setHistoryMsg(''), 4000);
    } catch (err) {
      alert('מחיקת המערכת נכשלה. ייתכן שזו המערכת הנוכחית או המפורסמת.');
    } finally {
      setDeletingRun(false);
    }
  };

  const handleSelectRun = async () => {
    if (!confirmSelectRun) return;
    setSelectingRun(true);
    try {
      await selectScheduleRun(confirmSelectRun.id);
      setConfirmSelectRun(null);
      setActiveTab('schedule');
      setHistoryMsg('המערכת הנבחרת עודכנה. ניתן לצפות בה כעת ולפרסם לצוות.');
      setTimeout(() => setHistoryMsg(''), 5000);
    } catch (err) {
      alert('עדכון המערכת נכשל. נסה/י שוב.');
    } finally {
      setSelectingRun(false);
    }
  };

  const openRunView = async (run) => {
    setViewingRun(run);
    setViewingEntries(null);
    setViewingError('');
    setViewingClass(null);
    setViewingLoading(true);
    try {
      const res = await getScheduleRunEntries(run.id);
      const entries = res.data.entries || res.data || [];
      setViewingEntries(entries);
      const firstClass = [...new Set(entries.map(e => e.group_name))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'he'))[0];
      setViewingClass(firstClass || null);
    } catch (err) {
      setViewingError('עדיין אי אפשר לצפות במערכות היסטוריות — צריך endpoint חדש בבקאנד (getScheduleRunEntries).');
    } finally {
      setViewingLoading(false);
    }
  };

  const openTeacherPrefs = async (teacher) => {
    setPrefEditing(false);
    setPrefDraft({});
    getStudentGroups().then(r => setAllGroups(r.data)).catch(() => { });
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

  const handleDelete = async (type, id) => {
    if (type === 'teacher') { await deleteTeacher(id); setTeachers(prev => prev.filter(x => x.id !== id)); }
    if (type === 'room') { await deleteRoom(id); setRooms(prev => prev.filter(x => x.id !== id)); }
    if (type === 'subject') { await deleteSubject(id); setSubjects(prev => prev.filter(x => x.id !== id)); }
    if (type === 'group') { await deleteStudentGroup(id); setGroups(prev => prev.filter(x => x.id !== id)); }
    if (type === 'window') { await deleteSubmissionWindow(id); setWindows(prev => prev.filter(x => x.id !== id)); }
    if (type === 'notification') {
      try {
        await deleteNotification(id);
      } catch (e) {
        if (e?.response?.status !== 404) throw e; // 404 = already gone; anything else is a real failure
      }
      setAllNotifs(prev => prev.filter(x => x.id !== id));
    }
    setConfirmModal(null);
  };

  const handleRespond = async () => {
    const targetTeacherId = respondModal.teacher_id;
    const requestTypeLabel = REQUEST_TYPES[respondModal.request_type] || respondModal.request_type;
    await respondToRequest(respondModal.id, response);
    setRequests(prev => prev.map(r => r.id === respondModal.id ? { ...r, ...response } : r));
    setPendingCount(prev => response.status !== 'pending' ? prev - 1 : prev);

    // Let the teacher know their request was handled. A failure here
    // shouldn't undo the response itself, so it's isolated in its own try/catch.
    if (targetTeacherId) {
      try {
        const decided = response.status === 'approved' ? 'אושרה' : 'נדחתה';
        await sendNotification({
          title: response.status === 'approved' ? 'הפנייה שלך אושרה' : 'הפנייה שלך נדחתה',
          body: response.admin_response?.trim()
            ? response.admin_response.trim()
            : `הפנייה שלך בנושא "${requestTypeLabel}" ${decided} על ידי ההנהלה.`,
          teacher_ids: [targetTeacherId],
        });
      } catch (e) {
        console.error('Failed to notify teacher about request response', e);
      }
    }

    setRespondModal(null);
    setResponse({ status: 'approved', admin_response: '' });
  };

  const handleCreateWindow = async () => {
    const errs = {
      title: !newWindow.title.trim(),
      start_date: !newWindow.start_date,
      end_date: !newWindow.end_date,
    };
    if (errs.title || errs.start_date || errs.end_date) { setWindowErrors(errs); return; }
    if (new Date(newWindow.end_date) <= new Date(newWindow.start_date)) {
      setWindowErrors({ title: false, start_date: false, end_date: true });
      alert('תאריך הסגירה חייב להיות אחרי תאריך הפתיחה.');
      return;
    }
    setWindowErrors({ title: false, start_date: false, end_date: false });
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
      // Re-fetch from the server instead of guessing a local id — the
      // create endpoint doesn't return the new row's real id, and a made-up
      // id (e.g. Date.now()) doesn't match the database, which broke delete.
      getNotifications().then(r => setAllNotifs(r.data)).catch(() => { });
      const count = notifMode === 'specific' ? notifTeacherIds.length : null;
      setNotifTitle(''); setNotifBody('');
      setNotifMode('all'); setNotifTeacherIds([]);
      setNotifErrors({ title: false, body: false, recipients: false });
      setShowNotifForm(false);
      // success toast (auto-clears)
      setNotifSuccess(count !== null ? `✓ ההודעה נשלחה ל-${count} מורים` : '✓ ההודעה נשלחה לכל המורים');
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

  return (
    <div style={styles.layout}>
      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator {
          cursor: pointer;
          opacity: 0.55;
        }
        input[type="date"]::-webkit-calendar-picker-indicator:hover,
        input[type="time"]::-webkit-calendar-picker-indicator:hover {
          opacity: 0.9;
        }
      `}</style>
      <div style={styles.sidebar}>
        <div style={styles.sidebarTop}>
          <div style={styles.brand}>SMARTIME</div>
          <div style={styles.brandName}>פאנל ניהול</div>
        </div>
        <nav style={{ flex: 1 }}>
          {['schedule', 'history', 'requests', 'teacherprefs', 'windows', 'notifications', 'school'].map(id => {
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
              <i className="ti ti-plus" aria-hidden="true"></i> הודעה חדשה
            </button>
          )}
        </div>

        {historyMsg && (
          <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#6b8f5e', color: '#fff', padding: '12px 24px', borderRadius: '10px', fontSize: '14px', boxShadow: '0 6px 20px rgba(0,0,0,0.15)', zIndex: 9999 }}>
            {historyMsg}
          </div>
        )}

        {confirmDeleteRun && (
          <div onClick={() => setConfirmDeleteRun(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#FAF7F2', border: '1px solid #e2dacc', borderRadius: '14px', padding: '24px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
              <p style={{ margin: '0 0 20px 0', fontSize: '15px', color: '#4a3f35', lineHeight: 1.6 }}>למחוק מערכת זו מההיסטוריה? לא ניתן לשחזר פעולה זו.</p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-start' }}>
                <button onClick={handleDeleteRun} disabled={deletingRun} style={{ backgroundColor: '#c0705a', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '14px', cursor: deletingRun ? 'default' : 'pointer', opacity: deletingRun ? 0.6 : 1 }}>{deletingRun ? 'מוחק…' : 'מחק'}</button>
                <button onClick={() => setConfirmDeleteRun(null)} disabled={deletingRun} style={{ ...styles.btnOutline, padding: '9px 18px', fontSize: '14px' }}>ביטול</button>
              </div>
            </div>
          </div>
        )}

        {confirmSelectRun && (
          <div onClick={() => setConfirmSelectRun(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#FAF7F2', border: '1px solid #e2dacc', borderRadius: '14px', padding: '24px', width: '90%', maxWidth: '420px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
              <p style={{ margin: '0 0 20px 0', fontSize: '15px', color: '#4a3f35', lineHeight: 1.6 }}>להחליף למערכת זו? המערכת הנבחרת הנוכחית תוחלף. הפרסום לצוות לא ישתנה עד שתפרסמ/י מחדש.</p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-start' }}>
                <button onClick={handleSelectRun} disabled={selectingRun} style={{ backgroundColor: '#8a9e78', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '14px', cursor: selectingRun ? 'default' : 'pointer', opacity: selectingRun ? 0.6 : 1 }}>{selectingRun ? 'מעדכן…' : 'אישור'}</button>
                <button onClick={() => setConfirmSelectRun(null)} disabled={selectingRun} style={{ ...styles.btnOutline, padding: '9px 18px', fontSize: '14px' }}>ביטול</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div style={{ ...styles.card, maxWidth: '900px', margin: '0 auto' }}>
            {runsLoading ? (
              <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>טוען…</div>
            ) : runs.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px', fontSize: '14px' }}>אין מערכות שמורות עדיין</div>
            ) : (
              <>
                <div style={{ ...styles.tableHeader, fontSize: '14px', fontWeight: 700, color: '#4a3f35' }}>
                  <div style={{ width: '130px', borderLeft: '1px solid #ece7dd' }}>פעולות</div>
                  <div style={{ width: '130px', borderLeft: '1px solid #ece7dd' }}>תאריך</div>
                  <div style={{ width: '130px', borderLeft: '1px solid #ece7dd' }}>אלגוריתם</div>
                  <div style={{ width: '130px', borderLeft: '1px solid #ece7dd' }}>ציון</div>
                  <div style={{ width: '130px', borderLeft: '1px solid #ece7dd' }}>סטטוס</div>
                  <div style={{ width: '130px' }}>הערות</div>
                </div>
                {runs.slice(0, 20).map((run, i, arr) => {
                  const formatAlgo = (algo) => {
                    if (!algo) return '—';
                    if (algo.toUpperCase() === 'CSP') return 'CSP';
                    return algo.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
                  };
                  return (
                    <div key={run.id} style={{ ...styles.tableRow, borderBottom: i < arr.length - 1 ? '1px solid #e2dacc' : 'none' }}>
                      <div style={{ width: '130px', display: 'flex', gap: '14px', borderLeft: '1px solid #ece7dd' }}>
                        <i className="ti ti-eye" title="צפה במערכת" onClick={() => openRunView(run)} style={{ ...styles.iconBtn, fontSize: '22px' }} aria-hidden="true"></i>
                        {!run.is_selected && (
                          <i className="ti ti-refresh" title="בחר מערכת זו" onClick={() => setConfirmSelectRun(run)} style={{ ...styles.iconBtn, fontSize: '22px' }} aria-hidden="true"></i>
                        )}
                        {!run.is_selected && !run.is_published && (
                          <i className="ti ti-trash" title="מחק" onClick={() => setConfirmDeleteRun(run)} style={{ ...styles.iconBtn, fontSize: '22px' }} aria-hidden="true"></i>
                        )}
                      </div>
                      <div style={{ width: '130px', color: '#8a7a6e', borderLeft: '1px solid #ece7dd' }}>{run.run_at ? fmtDate(run.run_at) : '—'}</div>
                      <div style={{ width: '130px', borderLeft: '1px solid #ece7dd' }}>{formatAlgo(run.algorithm)}</div>
                      <div style={{ width: '130px', borderLeft: '1px solid #ece7dd' }}>{run.score ?? '—'}</div>
                      <div style={{ width: '130px', display: 'flex', gap: '6px', flexWrap: 'wrap', borderLeft: '1px solid #ece7dd' }}>
                        {run.is_selected && <span style={{ ...styles.badge, backgroundColor: '#EDF4E8', color: '#6b8f5e' }}>נוכחית</span>}
                        {run.is_published && <span style={{ ...styles.badge, backgroundColor: '#E8F2FA', color: '#5a8ac0' }}>פורסם</span>}
                        {!run.is_selected && !run.is_published && <span style={{ ...styles.badge, backgroundColor: '#f0ebe3', color: '#8a7a6e' }}>בארכיון</span>}
                      </div>
                      <div style={{ width: '130px', minWidth: 0 }}>
                        {editingNoteId === run.id ? (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <input
                              value={noteDraft}
                              onChange={e => setNoteDraft(e.target.value)}
                              maxLength={150}
                              placeholder="הערה…"
                              style={{ ...styles.input, padding: '6px 10px', fontSize: '13px', flex: 1 }}
                              autoFocus
                            />
                            <button onClick={() => saveNote(run.id)} disabled={savingNote} style={{ backgroundColor: '#8a9e78', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}>{savingNote ? '…' : 'שמור'}</button>
                            <button onClick={cancelNoteEdit} disabled={savingNote} style={{ ...styles.btnOutline, padding: '6px 10px', fontSize: '12px' }}>ביטול</button>
                          </div>
                        ) : run.admin_note ? (
                          <button onClick={() => setViewingNote(run)} style={{ ...styles.btnOutline, padding: '4px 10px', fontSize: '12px' }}>
                            <i className="ti ti-note" aria-hidden="true"></i> צפה בהערה
                          </button>
                        ) : (
                          <button onClick={() => startNoteEdit(run)} style={{ ...styles.btnOutline, padding: '4px 10px', fontSize: '12px' }}>
                            <i className="ti ti-plus" aria-hidden="true"></i> הוסף הערה
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '18px' }}>
              {[
                { id: 'all', label: 'הכל' },
                { id: 'pending', label: `ממתינות לטיפול${requests.filter(r => r.status === 'pending').length ? ` (${requests.filter(r => r.status === 'pending').length})` : ''}` },
                { id: 'resolved', label: 'טופלו' },
              ].map(f => (
                <button key={f.id} onClick={() => setReqPrimaryFilter(f.id)} style={{ width: 'fit-content', padding: '10px 22px', borderRadius: '22px', fontSize: '15px', cursor: 'pointer', border: '1px solid #e2dacc', backgroundColor: reqPrimaryFilter === f.id ? '#8a9e78' : '#f5f2ee', color: reqPrimaryFilter === f.id ? '#fff' : '#8a7a6e', fontFamily: 'Varela Round, sans-serif', textAlign: 'center' }}>
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <select value={reqStatusFilter} onChange={e => setReqStatusFilter(e.target.value)} style={{ ...styles.input, width: 'auto', minWidth: '160px', padding: '12px 16px', fontSize: '15px', cursor: 'pointer' }}>
                <option value="all">כל הסטטוסים</option>
                <option value="pending">ממתין</option>
                <option value="approved">אושר</option>
                <option value="rejected">נדחה</option>
              </select>
              <select value={reqTeacherFilter} onChange={e => setReqTeacherFilter(e.target.value)} style={{ ...styles.input, width: 'auto', minWidth: '180px', padding: '12px 16px', fontSize: '15px', cursor: 'pointer' }}>
                <option value="all">כל המורים</option>
                {teachers.filter(t => !t.is_admin).sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'he')).map(t => (
                  <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                ))}
              </select>
              <select value={reqTypeFilter} onChange={e => setReqTypeFilter(e.target.value)} style={{ ...styles.input, width: 'auto', minWidth: '170px', padding: '12px 16px', fontSize: '15px', cursor: 'pointer' }}>
                <option value="all">כל הנושאים</option>
                {Object.entries(REQUEST_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>

            {(() => {
              const filtered = requests
                .filter(r => {
                  if (reqPrimaryFilter === 'pending' && r.status !== 'pending') return false;
                  if (reqPrimaryFilter === 'resolved' && r.status === 'pending') return false;
                  if (reqStatusFilter !== 'all' && r.status !== reqStatusFilter) return false;
                  if (reqTeacherFilter !== 'all' && r.teacher_id !== parseInt(reqTeacherFilter)) return false;
                  if (reqTypeFilter !== 'all' && r.request_type !== reqTypeFilter) return false;
                  return true;
                })
                .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1));

              if (requests.length === 0) {
                return <div style={{ ...styles.card, textAlign: 'center', color: '#c8baa6', padding: '40px', fontSize: '14px' }}>אין פניות עדיין</div>;
              }
              if (filtered.length === 0) {
                return <div style={{ ...styles.card, textAlign: 'center', color: '#c8baa6', padding: '40px', fontSize: '14px' }}>אין פניות התואמות את הסינון</div>;
              }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '700px', margin: '0 auto' }}>
                  {filtered.map(req => {
                    const teacher = teachers.find(t => t.id === req.teacher_id);
                    const teacherName = teacher ? `${teacher.first_name} ${teacher.last_name}` : '—';
                    const initials = teacher ? `${teacher.first_name?.[0] || ''}${teacher.last_name?.[0] || ''}` : '?';
                    const teacherColor = colorForTeacher(req.teacher_id);
                    const resolved = req.status !== 'pending';
                    const statusStyle = req.status === 'approved'
                      ? { bg: '#EDF4E8', color: '#4a7c3f' }
                      : req.status === 'rejected'
                        ? { bg: '#FAE8E8', color: '#c0705a' }
                        : { bg: '#FFF3D6', color: '#a08c30' };
                    return (
                      <div key={req.id} style={{ backgroundColor: '#fff', border: '1px solid #e2dacc', borderRadius: '12px', padding: '16px 18px', opacity: resolved ? 0.8 : 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ ...styles.avatar, backgroundColor: teacherColor.bg, color: teacherColor.color }}>{initials}</div>
                            <span style={{ fontSize: '14px', color: '#4a3f35', fontWeight: 700 }}>{teacherName}</span>
                            <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '20px', backgroundColor: '#f5f2ee', color: '#8a7a6e' }}>
                              {REQUEST_TYPES[req.request_type] || req.request_type}
                            </span>
                          </div>
                          <span style={{ fontSize: '14px', padding: '6px 16px', borderRadius: '20px', backgroundColor: statusStyle.bg, color: statusStyle.color }}>
                            {statusLabel(req.status)}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#4a3f35', marginBottom: req.admin_response ? '10px' : '10px' }}>{req.description}</div>
                        {req.admin_response && (
                          <div style={{ backgroundColor: '#FAF7F2', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
                            <div style={{ fontSize: '11px', color: '#c8baa6', marginBottom: '3px' }}>תשובת ההנהלה</div>
                            <div style={{ fontSize: '13px', color: '#4a3f35' }}>{req.admin_response}</div>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: '#c8baa6' }}>{fmtDate(req.created_at)}</span>
                          {req.status === 'pending' && (
                            <button onClick={() => { setRespondModal(req); setResponse({ status: 'approved', admin_response: '' }); }} style={styles.btnAdd}>טפל</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </>
        )}

        {activeTab === 'windows' && (
          <>
            <div style={styles.card}>
              <h3 style={{ fontSize: '15px', color: '#4a3f35', marginBottom: '16px' }}>פתח חלון הגשה חדש</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={styles.label}>כותרת</label>
                  <input style={{ ...styles.input, borderColor: windowErrors.title ? '#c0705a' : undefined, backgroundColor: windowErrors.title ? '#fff8f6' : undefined }} value={newWindow.title} onChange={e => { setNewWindow({ ...newWindow, title: e.target.value }); if (windowErrors.title) setWindowErrors(p => ({ ...p, title: false })); }} placeholder='העדפות מחצית א׳' />
                  {windowErrors.title && <div style={{ fontSize: '11px', color: '#c0705a', marginTop: '4px' }}>נא להזין כותרת</div>}
                </div>
                <div>
                  <label style={styles.label}>תאריך פתיחה</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="date" style={{ ...styles.input, ...styles.dateTimePart, borderColor: windowErrors.start_date ? '#c0705a' : undefined, backgroundColor: windowErrors.start_date ? '#fff8f6' : undefined }}
                      value={(newWindow.start_date || '').split('T')[0] || ''}
                      onChange={e => { const time = (newWindow.start_date || '').split('T')[1] || '08:00'; setNewWindow({ ...newWindow, start_date: e.target.value ? `${e.target.value}T${time}` : '' }); if (windowErrors.start_date) setWindowErrors(p => ({ ...p, start_date: false })); }} />
                    <input type="time" style={{ ...styles.input, ...styles.dateTimePart, width: '110px', flex: '0 0 auto', borderColor: windowErrors.start_date ? '#c0705a' : undefined, backgroundColor: windowErrors.start_date ? '#fff8f6' : undefined }}
                      value={(newWindow.start_date || '').split('T')[1] || '08:00'}
                      onChange={e => { const date = (newWindow.start_date || '').split('T')[0]; if (!date) return; setNewWindow({ ...newWindow, start_date: `${date}T${e.target.value}` }); if (windowErrors.start_date) setWindowErrors(p => ({ ...p, start_date: false })); }} />
                  </div>
                  {windowErrors.start_date && <div style={{ fontSize: '11px', color: '#c0705a', marginTop: '4px' }}>נא לבחור תאריך פתיחה</div>}
                </div>
                <div>
                  <label style={styles.label}>תאריך סגירה</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="date" style={{ ...styles.input, ...styles.dateTimePart, borderColor: windowErrors.end_date ? '#c0705a' : undefined, backgroundColor: windowErrors.end_date ? '#fff8f6' : undefined }}
                      value={(newWindow.end_date || '').split('T')[0] || ''}
                      onChange={e => { const time = (newWindow.end_date || '').split('T')[1] || '23:59'; setNewWindow({ ...newWindow, end_date: e.target.value ? `${e.target.value}T${time}` : '' }); if (windowErrors.end_date) setWindowErrors(p => ({ ...p, end_date: false })); }} />
                    <input type="time" style={{ ...styles.input, ...styles.dateTimePart, width: '110px', flex: '0 0 auto', borderColor: windowErrors.end_date ? '#c0705a' : undefined, backgroundColor: windowErrors.end_date ? '#fff8f6' : undefined }}
                      value={(newWindow.end_date || '').split('T')[1] || '23:59'}
                      onChange={e => { const date = (newWindow.end_date || '').split('T')[0]; if (!date) return; setNewWindow({ ...newWindow, end_date: `${date}T${e.target.value}` }); if (windowErrors.end_date) setWindowErrors(p => ({ ...p, end_date: false })); }} />
                  </div>
                  {windowErrors.end_date && <div style={{ fontSize: '11px', color: '#c0705a', marginTop: '4px' }}>נא לבחור תאריך סגירה</div>}
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
                    <div style={{ flex: 2, color: '#8a7a6e' }}>{fmtDateTime(w.start_date)}</div>
                    <div style={{ flex: 2, color: '#8a7a6e' }}>{fmtDateTime(w.end_date)}</div>
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
          !prefTeacher ? (
            <div style={styles.card}>
              <>
                <input
                  value={prefSearch}
                  onChange={e => setPrefSearch(e.target.value)}
                  placeholder="חיפוש מורה…"
                  style={{ ...styles.input, marginBottom: '16px' }}
                />
                {teachers
                  .filter(t => !t.is_admin && `${t.first_name} ${t.last_name}`.includes(prefSearch.trim()))
                  .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'he'))
                  .map((t, i, arr) => {
                    const tColor = colorForTeacher(t.id);
                    return (
                      <div
                        key={t.id}
                        onClick={() => openTeacherPrefs(t)}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 8px', borderBottom: i < arr.length - 1 ? '1px solid #f0ebe3' : 'none', cursor: 'pointer' }}
                      >
                        <div style={{ ...styles.avatar, backgroundColor: tColor.bg, color: tColor.color }}>{initials(t)}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '15px', color: '#4a3f35', fontWeight: 700 }}>{t.first_name} {t.last_name}</div>
                          <div style={{ fontSize: '12px', color: '#8a7a6e' }}>{t.email}</div>
                        </div>
                        <i className="ti ti-chevron-left" style={{ color: '#c8baa6' }} aria-hidden="true"></i>
                      </div>
                    );
                  })}
              </>
            </div>
          ) : (
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
              <>
                <button onClick={() => { setPrefTeacher(null); setPrefData(null); setPrefEditing(false); setPrefDraft({}); }} style={{ ...styles.btnOutline, fontSize: '13px', padding: '6px 12px', marginBottom: '16px' }}>
                  <i className="ti ti-chevron-right" aria-hidden="true"></i> חזרה לרשימה
                </button>

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

                <div style={{ ...styles.card, borderTop: `4px solid ${colorForTeacher(prefTeacher.id).color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingBottom: '18px', marginBottom: '18px', borderBottom: '1px solid #ece7dd' }}>
                    {!prefEditing ? (
                      <i className="ti ti-pencil" onClick={startPrefEdit} title="ערוך" style={{ ...styles.iconBtn, fontSize: '18px', marginRight: 'auto' }} aria-hidden="true"></i>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', marginRight: 'auto' }}>
                        <button onClick={savePrefEdit} disabled={prefSaving} style={{ backgroundColor: '#8a9e78', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', cursor: prefSaving ? 'default' : 'pointer', opacity: prefSaving ? 0.6 : 1 }}>
                          {prefSaving ? 'שומר…' : 'שמור'}
                        </button>
                        <button onClick={cancelPrefEdit} disabled={prefSaving} style={{ ...styles.btnOutline, fontSize: '13px', padding: '8px 18px' }}>ביטול</button>
                      </div>
                    )}
                    <button onClick={() => setShowScheduleConfirm(true)} style={{ ...styles.btnOutline, fontSize: '13px', padding: '8px 16px' }}>
                      <i className="ti ti-calendar" aria-hidden="true"></i> צפה במערכת
                    </button>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={{ fontSize: '17px', color: '#4a3f35', fontWeight: 700 }}>{prefTeacher.first_name} {prefTeacher.last_name}</div>
                      <div style={{ fontSize: '12px', color: '#8a7a6e' }}>{prefTeacher.email} · מכסה: {prefTeacher.weekly_hours_quota ?? '—'} שעות</div>
                    </div>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: colorForTeacher(prefTeacher.id).bg, color: colorForTeacher(prefTeacher.id).color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                      {initials(prefTeacher)}
                    </div>
                  </div>

                  {prefLoading ? (
                    <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>טוען…</div>
                  ) : !prefData ? (
                    <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>לא נמצאו נתונים</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                      {/* Subjects + grades */}
                      <div style={{ backgroundColor: '#FAF7F2', borderRadius: '10px', padding: '16px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px', gap: '10px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '8px', backgroundColor: '#EDF4E8', color: '#6b8f5e' }}>
                            <i className="ti ti-books" style={{ fontSize: '16px' }} aria-hidden="true"></i>
                          </span>
                          <span style={{ fontSize: '14px', color: '#4a3f35', fontWeight: 700 }}>מקצועות ושכבות</span>
                        </div>

                        <div style={{ fontSize: '12px', color: '#8a7a6e', marginBottom: '8px' }}>מקצועות שהמורה מלמד/ת</div>
                        {!prefEditing ? (
                          prefData.subjects.length === 0 ? (
                            <div style={{ fontSize: '13px', color: '#c8baa6', marginBottom: '14px' }}>לא נבחרו מקצועות</div>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                              {prefData.subjects.map(s => {
                                const subj = subjects.find(x => x.id === s.subject_id);
                                return <span key={s.subject_id} style={{ padding: '5px 12px', borderRadius: '20px', backgroundColor: '#EDF4E8', color: '#4a7c3f', fontSize: '13px' }}>{subj ? subj.subject_name : `#${s.subject_id}`}</span>;
                              })}
                            </div>
                          )
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
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

                        <div style={{ fontSize: '12px', color: '#8a7a6e', marginBottom: '8px' }}>שכבות מועדפות</div>
                        {!prefEditing ? (
                          prefData.grades.length === 0 ? (
                            <div style={{ fontSize: '13px', color: '#c8baa6' }}>לא נבחרו שכבות</div>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {prefData.grades.map(g => <span key={g.grade_level} style={{ padding: '5px 12px', borderRadius: '20px', backgroundColor: '#f5f2ee', color: '#8a7a6e', fontSize: '13px' }}>כיתה {['א', 'ב', 'ג', 'ד', 'ה', 'ו'][g.grade_level - 1]}'</span>)}
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
                      <div style={{ backgroundColor: '#FAF7F2', borderRadius: '10px', padding: '16px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px', gap: '10px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '8px', backgroundColor: '#E8F2FA', color: '#5a8ac0' }}>
                            <i className="ti ti-home" style={{ fontSize: '16px' }} aria-hidden="true"></i>
                          </span>
                          <span style={{ fontSize: '14px', color: '#4a3f35', fontWeight: 700 }}>חינוך כיתה</span>
                        </div>
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
                      <div style={{ backgroundColor: '#FAF7F2', borderRadius: '10px', padding: '16px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px', gap: '10px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '8px', backgroundColor: '#F1EAFB', color: '#8a6fc2' }}>
                            <i className="ti ti-adjustments" style={{ fontSize: '16px' }} aria-hidden="true"></i>
                          </span>
                          <span style={{ fontSize: '14px', color: '#4a3f35', fontWeight: 700 }}>העדפות שיבוץ</span>
                        </div>

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
                      <div style={{ backgroundColor: '#FAF7F2', borderRadius: '10px', padding: '16px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px', gap: '10px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '8px', backgroundColor: '#FFF3D6', color: '#a08c30' }}>
                            <i className="ti ti-calendar-time" style={{ fontSize: '16px' }} aria-hidden="true"></i>
                          </span>
                          <span style={{ fontSize: '14px', color: '#4a3f35', fontWeight: 700 }}>אילוצי זמינות</span>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '12px', color: '#8a7a6e' }}>
                          <span><span style={{ display: 'inline-block', width: '11px', height: '11px', borderRadius: '3px', backgroundColor: '#FFF3A3', marginLeft: '5px', verticalAlign: 'middle' }}></span>מעדיף שלא</span>
                          <span><span style={{ display: 'inline-block', width: '11px', height: '11px', borderRadius: '3px', backgroundColor: '#FAE8E8', marginLeft: '5px', verticalAlign: 'middle' }}></span>לא יכול</span>
                          {prefEditing && <span style={{ color: '#c8baa6' }}>לחיצה מחליפה בין המצבים</span>}
                        </div>

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
                                    if (dayIdx === 5 && hour > 4) {
                                      return <td key={dayIdx}><div style={{ width: '38px', height: '34px', borderRadius: '8px', border: '1px solid #e2dacc', background: 'repeating-linear-gradient(135deg,#f5f2ee,#f5f2ee 5px,#efece6 5px,#efece6 10px)' }}></div></td>;
                                    }
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
                                          aria-label={`יום ${['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'][dayIdx]} שעה ${hour}`}
                                        >{mark}</button>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              </>
            </div>
          )
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
            {[...teachers].sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'he')).map((teacher, i) => (
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
          <ScheduleTab
            jumpTarget={scheduleJump}
            onJumpHandled={() => setScheduleJump(null)}
            onNavigateToHistory={() => setActiveTab('history')}
          />
        )}

        {activeTab === 'notifications' && (
          <>
            {notifSuccess && (
              <div style={{ backgroundColor: '#EDF4E8', color: '#4a7c3f', border: '1px solid #cfe3c4', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px', textAlign: 'center' }}>
                {notifSuccess}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
              <button onClick={() => setNotifView('all')} style={{ width: 'fit-content', padding: '10px 22px', borderRadius: '22px', fontSize: '15px', cursor: 'pointer', border: '1px solid #e2dacc', backgroundColor: notifView === 'all' ? '#8a9e78' : '#f5f2ee', color: notifView === 'all' ? '#fff' : '#8a7a6e', fontFamily: 'Varela Round, sans-serif', textAlign: 'center' }}>
                הכל
              </button>
              <button onClick={() => setNotifView('messages')} style={{ width: 'fit-content', padding: '10px 22px', borderRadius: '22px', fontSize: '15px', cursor: 'pointer', border: '1px solid #e2dacc', backgroundColor: notifView === 'messages' ? '#8a9e78' : '#f5f2ee', color: notifView === 'messages' ? '#fff' : '#8a7a6e', fontFamily: 'Varela Round, sans-serif', textAlign: 'center' }}>
                הודעות ששלחת
              </button>
              <button onClick={() => setNotifView('system')} style={{ width: 'fit-content', padding: '10px 22px', borderRadius: '22px', fontSize: '15px', cursor: 'pointer', border: '1px solid #e2dacc', backgroundColor: notifView === 'system' ? '#8a9e78' : '#f5f2ee', color: notifView === 'system' ? '#fff' : '#8a7a6e', fontFamily: 'Varela Round, sans-serif', textAlign: 'center' }}>
                התראות מערכת
              </button>
            </div>

            {(() => {
              // Classify by who authored the row, not by a sent/received
              // direction: things the admin personally wrote (created_by
              // === his own id) are "messages"; anything else — e.g. a
              // teacher submitting their preferences — is a "system" event.
              const myId = user?.id != null ? Number(user.id) : null;
              const isMine = (n) => myId != null && Number(n.created_by) === myId;
              let rows;
              if (notifView === 'messages') rows = allNotifs.filter(isMine);
              else if (notifView === 'system') rows = allNotifs.filter(n => !isMine(n));
              else rows = allNotifs;

              if (rows.length === 0) {
                return <div style={{ ...styles.card, textAlign: 'center', color: '#c8baa6', padding: '40px', fontSize: '14px' }}>אין {notifView === 'messages' ? 'הודעות' : notifView === 'system' ? 'התראות מערכת' : 'התראות'} להצגה</div>;
              }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '700px', margin: '0 auto' }}>
                  {rows.map(n => {
                    const mine = isMine(n);
                    const iconStyle = mine
                      ? { bg: '#EDF4E8', color: '#6b8f5e', icon: 'ti-send' }
                      : { bg: '#E8F2FA', color: '#5a8ac0', icon: 'ti-bell' };
                    return (
                      <div key={n.id} style={{ backgroundColor: '#fff', border: '1px solid #e2dacc', borderRadius: '12px', padding: '16px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '10px', backgroundColor: iconStyle.bg, color: iconStyle.color, flexShrink: 0 }}>
                            <i className={`ti ${iconStyle.icon}`} style={{ fontSize: '17px' }} aria-hidden="true"></i>
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '14px', color: '#4a3f35', fontWeight: 700 }}>{n.title}</span>
                              {notifView === 'all' && (
                                <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '20px', backgroundColor: iconStyle.bg, color: iconStyle.color, flexShrink: 0 }}>
                                  {mine ? 'הודעה' : 'מערכת'}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '13px', color: '#4a3f35', marginBottom: '8px' }}>{n.body}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', color: '#c8baa6' }}>{fmtDateTime(n.created_at)}</span>
                              {mine && (
                                <i className="ti ti-trash" onClick={() => setConfirmModal({ type: 'notification', id: n.id, name: n.title })} style={{ ...styles.iconBtn, fontSize: '18px' }} aria-hidden="true"></i>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </>
        )}

        {/* ============ SCHOOL SETTINGS TAB ============ */}
        {activeTab === 'school' && (
          <>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid #e2dacc' }}>
              {SCHOOL_TABS.map(t => (
                <button key={t.id} onClick={() => setSchoolTab(t.id)}
                  style={{ flex: 1, padding: '12px 16px', fontSize: '16px', border: 'none', background: 'transparent', color: schoolTab === t.id ? '#4a3f35' : '#8a7a6e', cursor: 'pointer', borderBottom: schoolTab === t.id ? '3px solid #8a9e78' : '3px solid transparent', fontFamily: 'Varela Round, sans-serif', fontWeight: 700, textAlign: 'center' }}>
                  {t.label}
                </button>
              ))}
            </div>

            {schoolTab === 'day' && (
              <div style={styles.card}>
                <div style={{ fontSize: '15px', color: '#4a3f35', marginBottom: '20px' }}>מבנה יום הלימודים</div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={styles.label}>ימי לימוד</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {Object.entries(DAYS).map(([num, name]) => {
                      const selected = (schoolSettings.active_days || []).includes(parseInt(num));
                      return (
                        <button key={num} onClick={() => {
                          const d = parseInt(num);
                          setSchoolSettings(prev => ({
                            ...prev,
                            active_days: selected ? prev.active_days.filter(x => x !== d) : [...(prev.active_days || []), d]
                          }));
                        }} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', backgroundColor: selected ? '#8a9e78' : '#f5f2ee', color: selected ? '#fff' : '#8a7a6e', border: `1px solid ${selected ? '#8a9e78' : '#e2dacc'}`, fontFamily: 'Varela Round, sans-serif' }}>{name}</button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <label style={styles.label}>שעת התחלה</label>
                    <input type="time" style={styles.input} value={schoolSettings.start_time || '08:00'} onChange={e => setSchoolSettings(prev => ({ ...prev, start_time: e.target.value }))} />
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={styles.label}>שעת סיום לפי שכבה</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {GRADES.map(grade => (
                      <div key={grade} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <label style={{ ...styles.label, marginBottom: 0, width: '70px' }}>כיתות {GRADE_LABELS[grade]}</label>
                        <input type="time" style={{ ...styles.input, width: '120px' }}
                          value={(schoolSettings.grade_end_times || {})[String(grade)] || ''}
                          onChange={e => setSchoolSettings(prev => ({
                            ...prev,
                            grade_end_times: { ...(prev.grade_end_times || {}), [String(grade)]: e.target.value }
                          }))} />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={styles.label}>הפסקות</label>
                  {(schoolSettings.breaks || []).map((b, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f0ebe3' }}>
                      <span style={{ fontSize: '13px', color: '#4a3f35' }}>אחרי שיעור {b.after_lesson}</span>
                      <span style={{ fontSize: '13px', color: '#8a7a6e' }}>{b.duration_minutes} דקות</span>
                      <i className="ti ti-trash" onClick={() => handleRemoveBreak(i)} style={{ ...styles.iconBtn, marginRight: 'auto' }} aria-hidden="true"></i>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px', alignItems: 'flex-end' }}>
                    <div>
                      <label style={styles.label}>אחרי שיעור</label>
                      <input type="number" min="1" max="8" value={newBreak.after_lesson} onChange={e => setNewBreak(p => ({ ...p, after_lesson: parseInt(e.target.value) }))} style={{ ...styles.input, width: '80px' }} />
                    </div>
                    <div>
                      <label style={styles.label}>דקות</label>
                      <input type="number" min="5" max="60" value={newBreak.duration_minutes} onChange={e => setNewBreak(p => ({ ...p, duration_minutes: parseInt(e.target.value) }))} style={{ ...styles.input, width: '80px' }} />
                    </div>
                    <button onClick={handleAddBreak} style={styles.btnOutline}>+ הוסף הפסקה</button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button onClick={handleSaveSchoolSettings} style={styles.btnAdd}>שמור הגדרות יום</button>
                  {settingsSaved && <span style={{ fontSize: '13px', color: '#8a9e78' }}>✓ נשמר</span>}
                </div>
              </div>
            )}

            {schoolTab === 'ped' && (
              <div style={styles.card}>
                <div style={{ fontSize: '15px', color: '#4a3f35', marginBottom: '16px' }}>אילוצים פדגוגיים</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px', maxWidth: '340px' }}>
                  <div>
                    <label style={styles.label}>סוג אילוץ</label>
                    <select value={newPedagogical.constraint_type} onChange={e => { setPedError(''); setNewPedagogical(p => ({ ...p, constraint_type: e.target.value, subject_a_id: '', subject_b_id: '', numeric_value: '' })); }} style={{ ...styles.input, cursor: 'pointer' }}>
                      <option value="">בחר אילוץ להחיל על המערכת</option>
                      {PEDAGOGICAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  {newPedagogical.constraint_type && (
                    <div>
                      <label style={styles.label}>{(newPedagogical.constraint_type === 'not_consecutive' || newPedagogical.constraint_type === 'min_gap') ? 'מקצוע ראשון' : 'מקצוע'}</label>
                      <select value={newPedagogical.subject_a_id} onChange={e => setNewPedagogical(p => ({ ...p, subject_a_id: e.target.value }))} style={{ ...styles.input, cursor: 'pointer' }}>
                        <option value="">בחר מקצוע</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                      </select>
                    </div>
                  )}
                  {(newPedagogical.constraint_type === 'not_consecutive' || newPedagogical.constraint_type === 'min_gap') && (
                    <div>
                      <label style={styles.label}>מקצוע שני{newPedagogical.constraint_type === 'min_gap' ? ' (ריק = אותו מקצוע)' : ''}</label>
                      <select value={newPedagogical.subject_b_id} onChange={e => setNewPedagogical(p => ({ ...p, subject_b_id: e.target.value }))} style={{ ...styles.input, cursor: 'pointer' }}>
                        <option value="">בחר מקצוע</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                      </select>
                    </div>
                  )}
                  {(newPedagogical.constraint_type === 'max_per_day' || newPedagogical.constraint_type === 'min_gap') && (
                    <div>
                      <label style={styles.label}>{newPedagogical.constraint_type === 'max_per_day' ? 'ערך (מקסימום שיעורים ביום)' : 'מינימום הפרדה (0 = צמודים)'}</label>
                      <input type="number" min="0" value={newPedagogical.numeric_value} onChange={e => setNewPedagogical(p => ({ ...p, numeric_value: e.target.value }))} style={{ ...styles.input, width: '100px' }} placeholder={newPedagogical.constraint_type === 'max_per_day' ? 'למשל: 2' : '0'} />
                    </div>
                  )}
                  {pedError && <div style={{ color: '#c0392b', fontSize: '13px' }}>{pedError}</div>}
                  <button onClick={handleAddPedagogical} style={styles.btnAdd}>+ הוסף</button>
                </div>
                {pedagogical.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#c8baa6', padding: '24px', fontSize: '14px' }}>אין אילוצים פדגוגיים עדיין</div>
                ) : pedagogical.map((p, i) => (
                  editingPedId === p.id ? (
                    <div key={p.id} style={{ padding: '14px 0', borderBottom: i < pedagogical.length - 1 ? '1px solid #f0ebe3' : 'none', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '340px' }}>
                      <select value={editPedDraft.constraint_type} onChange={e => setEditPedDraft(d => ({ ...d, constraint_type: e.target.value, subject_a_id: '', subject_b_id: '', numeric_value: '' }))} style={{ ...styles.input, cursor: 'pointer' }}>
                        {PEDAGOGICAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      {editPedDraft.constraint_type && (
                        <select value={editPedDraft.subject_a_id} onChange={e => setEditPedDraft(d => ({ ...d, subject_a_id: e.target.value }))} style={{ ...styles.input, cursor: 'pointer' }}>
                          <option value="">{(editPedDraft.constraint_type === 'not_consecutive' || editPedDraft.constraint_type === 'min_gap') ? 'מקצוע ראשון' : 'בחר מקצוע'}</option>
                          {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                        </select>
                      )}
                      {(editPedDraft.constraint_type === 'not_consecutive' || editPedDraft.constraint_type === 'min_gap') && (
                        <select value={editPedDraft.subject_b_id} onChange={e => setEditPedDraft(d => ({ ...d, subject_b_id: e.target.value }))} style={{ ...styles.input, cursor: 'pointer' }}>
                          <option value="">{editPedDraft.constraint_type === 'min_gap' ? 'מקצוע שני (ריק = אותו מקצוע)' : 'מקצוע שני'}</option>
                          {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                        </select>
                      )}
                      {(editPedDraft.constraint_type === 'max_per_day' || editPedDraft.constraint_type === 'min_gap') && (
                        <input type="number" min="0" value={editPedDraft.numeric_value} onChange={e => setEditPedDraft(d => ({ ...d, numeric_value: e.target.value }))} style={{ ...styles.input, width: '100px' }} placeholder={editPedDraft.constraint_type === 'max_per_day' ? 'מקסימום' : '0'} />
                      )}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={saveEditPed} disabled={savingPed} style={{ backgroundColor: '#8a9e78', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '13px', cursor: savingPed ? 'default' : 'pointer', opacity: savingPed ? 0.6 : 1 }}>{savingPed ? 'שומר…' : 'שמור'}</button>
                        <button onClick={cancelEditPed} disabled={savingPed} style={{ ...styles.btnOutline, padding: '7px 16px', fontSize: '13px' }}>ביטול</button>
                      </div>
                    </div>
                  ) : (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: i < pedagogical.length - 1 ? '1px solid #f0ebe3' : 'none' }}>
                      <span style={{ fontSize: '12px', backgroundColor: '#EDF4E8', color: '#6b8f5e', borderRadius: '20px', padding: '3px 10px', marginLeft: '10px' }}>
                        {PEDAGOGICAL_TYPES.find(t => t.value === p.constraint_type)?.label || p.constraint_type}
                      </span>
                      <span style={{ fontSize: '13px', color: '#4a3f35', flex: 1 }}>
                        {subjects.find(s => s.id === p.subject_a_id)?.subject_name || ''}
                        {p.subject_b_id ? ` ⟷ ${subjects.find(s => s.id === p.subject_b_id)?.subject_name || ''}` : ''}
                        {p.numeric_value ? ` — ${p.numeric_value}` : ''}
                      </span>
                      <i className="ti ti-pencil" onClick={() => startEditPed(p)} style={{ ...styles.iconBtn, marginLeft: '12px' }} aria-hidden="true"></i>
                      <i className="ti ti-trash" onClick={() => handleDeletePedagogical(p.id)} style={styles.iconBtn} aria-hidden="true"></i>
                    </div>
                  )
                ))}
              </div>
            )}

            {schoolTab === 'curriculum' && (
              <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ fontSize: '15px', color: '#4a3f35' }}>תכנית לימודים שבועית</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {curriculumSaved && <span style={{ fontSize: '13px', color: '#8a9e78' }}>✓ נשמר</span>}
                    <button onClick={handleSaveCurriculum} style={styles.btnAdd}>שמור שינויים</button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#8a7a6e' }}>העתק מכיתה:</span>
                  <select value={copyFromGroup} onChange={e => setCopyFromGroup(e.target.value)} style={{ ...styles.input, width: 'auto', fontSize: '12px', padding: '5px 10px' }}>
                    <option value="">בחר כיתה</option>
                    {groups.filter(g => g.id !== selectedGroup?.id).map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
                  </select>
                  <button onClick={handleCopyFrom} style={{ ...styles.btnOutline, fontSize: '12px', padding: '5px 12px' }}>העתק</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '16px' }}>
                  <div style={{ backgroundColor: '#FAF7F2', borderRadius: '10px', border: '1px solid #e2dacc', padding: '10px', maxHeight: '500px', overflowY: 'auto' }}>
                    {Object.entries(groupsByGrade()).map(([grade, gradeGroups]) => (
                      <div key={grade} style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#c8baa6', padding: '4px 6px', marginBottom: '2px' }}>שכבת {grade}</div>
                        {gradeGroups.map(g => (
                          <button key={g.id} onClick={() => setSelectedGroup(g)}
                            style={{ display: 'block', width: '100%', textAlign: 'right', padding: '7px 10px', borderRadius: '7px', border: 'none', background: selectedGroup?.id === g.id ? '#EDF4E8' : 'transparent', fontSize: '13px', color: selectedGroup?.id === g.id ? '#3d6b2e' : '#8a7a6e', cursor: 'pointer', marginBottom: '2px', fontFamily: 'Varela Round, sans-serif', fontWeight: selectedGroup?.id === g.id ? '500' : 'normal' }}>
                            {g.group_name}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div>
                    {selectedGroup ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '500', color: '#4a3f35' }}>כיתה {selectedGroup.group_name}</span>
                          <span style={{ backgroundColor: '#EDF4E8', color: '#3d6b2e', borderRadius: '20px', padding: '4px 12px', fontSize: '12px' }}>
                            סה"כ {Object.values(curriculumHours).reduce((a, b) => a + (parseInt(b) || 0), 0)} שעות
                          </span>
                        </div>
                        {subjects.map(subject => (
                          <div key={subject.id} style={{ display: 'flex', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #f0ebe3', gap: '10px' }}>
                            <div style={{ flex: 1, fontSize: '14px', color: '#4a3f35' }}>{subject.subject_name}</div>
                            <input type="number" min="0" max="15"
                              value={curriculumHours[subject.id] || 0}
                              onChange={e => setCurriculumHours(prev => ({ ...prev, [subject.id]: parseInt(e.target.value) || 0 }))}
                              style={{ width: '44px', height: '44px', textAlign: 'center', fontSize: '16px', fontWeight: '500', border: `1.5px solid ${(curriculumHours[subject.id] || 0) > 0 ? '#8a9e78' : '#e2dacc'}`, borderRadius: '8px', background: (curriculumHours[subject.id] || 0) > 0 ? '#EDF4E8' : '#FAF7F2', color: (curriculumHours[subject.id] || 0) > 0 ? '#3d6b2e' : '#4a3f35', outline: 'none', MozAppearance: 'textfield' }} />
                          </div>
                        ))}
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>בחר כיתה מהרשימה</div>
                    )}
                  </div>
                </div>
              </div>
            )}
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
                  {
                    key: 'required_room_id', label: 'חדר נדרש', type: 'select', optional: true,
                    options: rooms.map(r => ({ value: r.id, label: r.room_name }))
                  },
                ]
                : [
                  { key: 'group_name', label: 'שם הקבוצה', type: 'text' },
                  { key: 'student_count', label: 'מספר תלמידים', type: 'number' },
                  {
                    key: 'home_room_id', label: 'חדר בית', type: 'select', optional: true,
                    options: rooms.map(r => ({ value: r.id, label: r.room_name }))
                  },
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

      {viewingRun && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setViewingRun(null)}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2dacc', padding: '28px', width: '820px', maxWidth: '94vw', maxHeight: '86vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()} dir="rtl">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '18px', color: '#4a3f35', margin: '0 0 4px 0' }}>צפייה במערכת (לקריאה בלבד)</h2>
                <div style={{ fontSize: '12px', color: '#8a7a6e' }}>{fmtDateTime(viewingRun.run_at)} · ציון {viewingRun.score ?? '—'}</div>
              </div>
              <button onClick={() => setViewingRun(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8baa6', fontSize: '20px' }}>✕</button>
            </div>

            {viewingLoading ? (
              <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>טוען…</div>
            ) : viewingError ? (
              <div style={{ textAlign: 'center', color: '#c0705a', padding: '30px', fontSize: '13px', lineHeight: 1.6 }}>{viewingError}</div>
            ) : !viewingEntries || viewingEntries.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#c8baa6', padding: '30px', fontSize: '13px' }}>לא נמצאו שיעורים במערכת הזו.</div>
            ) : (
              <>
                <select
                  value={viewingClass || ''}
                  onChange={e => setViewingClass(e.target.value)}
                  style={{ ...styles.input, width: 'auto', minWidth: '200px', cursor: 'pointer', marginBottom: '16px' }}
                >
                  {[...new Set(viewingEntries.map(e => e.group_name))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'he')).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '56px', padding: '8px', border: '1px solid #e2dacc', backgroundColor: '#EDF4E8', fontSize: '12px', color: '#4a3f35' }}>שעה</th>
                        {VIEWER_DAY_ORDER.map(d => <th key={d} style={{ padding: '8px', border: '1px solid #e2dacc', backgroundColor: '#EDF4E8', fontSize: '12px', color: '#4a3f35' }}>{DAYS[d]}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {VIEWER_HOURS.map(hour => (
                        <tr key={hour}>
                          <td style={{ border: '1px solid #f0ebe3', padding: '5px', textAlign: 'center', color: '#c8baa6', fontSize: '11px', backgroundColor: '#FAF7F2' }}>{hour}</td>
                          {VIEWER_DAY_ORDER.map(day => {
                            const lessons = viewingEntries.filter(e => e.group_name === viewingClass && e.day_of_week === day && e.hour_of_day === hour);
                            return (
                              <td key={day} style={{ border: '1px solid #f0ebe3', padding: '5px', verticalAlign: 'top', height: '52px' }}>
                                {lessons.map((e, idx) => (
                                  <div key={idx} style={{ backgroundColor: '#F5F8F2', border: '1px solid #e3ecdb', borderRadius: '7px', padding: '4px 6px', fontSize: '10px', color: '#4a3f35', marginBottom: '3px' }}>
                                    <div style={{ fontWeight: 700 }}>{e.subject_name}</div>
                                    <div style={{ color: '#8a7a6e' }}>{e.teacher_first_name} {e.teacher_last_name}</div>
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
              </>
            )}
          </div>
        </div>
      )}

      {viewingNote && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setViewingNote(null)}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2dacc', padding: '32px', width: '420px' }} onClick={e => e.stopPropagation()} dir="rtl">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '16px', color: '#4a3f35', margin: 0 }}>הערה</h3>
              <button onClick={() => setViewingNote(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8baa6', fontSize: '20px' }}>✕</button>
            </div>
            <p style={{ fontSize: '14px', color: '#4a3f35', lineHeight: 1.6, marginBottom: '26px', overflowWrap: 'anywhere' }}>{viewingNote.admin_note}</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-start' }}>
              <button onClick={() => { startNoteEdit(viewingNote); setViewingNote(null); }} style={styles.btnOutline}>
                <i className="ti ti-pencil" aria-hidden="true"></i> ערוך
              </button>
              <button onClick={() => setViewingNote(null)} style={styles.btnOutline}>סגור</button>
            </div>
          </div>
        </div>
      )}

      {showNotifForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={closeNotifForm}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2dacc', padding: '36px', width: '460px' }} onClick={e => e.stopPropagation()} dir="rtl">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', color: '#4a3f35', margin: 0 }}>שלח הודעה חדשה</h2>
              <button onClick={closeNotifForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8baa6', fontSize: '20px' }}>✕</button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={styles.label}>כותרת</label>
              <input style={{ ...styles.input, borderColor: notifErrors.title ? '#c0705a' : undefined, backgroundColor: notifErrors.title ? '#fff8f6' : undefined }} value={notifTitle} onChange={e => { setNotifTitle(e.target.value); if (notifErrors.title) setNotifErrors(p => ({ ...p, title: false })); }} placeholder="נושא ההודעה" />
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
