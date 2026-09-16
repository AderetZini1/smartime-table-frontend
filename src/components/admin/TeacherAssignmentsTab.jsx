import { useState, useEffect } from 'react';
import { PageHeader, FONT, GRADE_LETTERS, fullName, initials, colorForTeacher, Modal, byName } from './adminShared';
import {
  getStudentGroups, getSubjects, getTeachers, getCurriculumByGroup,
  getTeacherAssignments, getTeacherLoads, getAllTeacherSubjects, getAllTeacherGradeLevels,
  createAssignment, updateAssignment,
} from '../../services/api';
import { styles } from '../../pages/adminDashboard.styles';

const PANEL_WIDTH = '840px';

// grade letter (א-ו) -> integer 1-6, from a group name like "כיתה א1".
function groupGrade(group) {
  const letter = group.group_name.replace(/כיתה\s*/g, '').match(/([א-ו])/)?.[1];
  const idx = letter ? GRADE_LETTERS.indexOf(letter) : -1;
  return idx >= 0 ? idx + 1 : null;
}

// { 'א': [group,...], ... } — for grouping the dropdown by grade.
function groupsByGrade(groups) {
  const result = {};
  groups.forEach(g => {
    const match = g.group_name.replace(/כיתה\s*/g, '').match(/([א-ו])/);
    const grade = match ? match[1] : 'אחר';
    (result[grade] = result[grade] || []).push(g);
  });
  return result;
}

export default function TeacherAssignmentsTab({ title }) {
  const [groups, setGroups] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loads, setLoads] = useState([]);
  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [teacherGrades, setTeacherGrades] = useState([]);

  const [selectedGroup, setSelectedGroup] = useState(null); // null = "בחר כיתה"
  const [curriculum, setCurriculum] = useState([]);
  const [loading, setLoading] = useState(true);

  const [picker, setPicker] = useState(null);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [pickerError, setPickerError] = useState('');

  useEffect(() => {
    Promise.all([
      getStudentGroups(), getSubjects(), getTeachers(), getTeacherAssignments(),
      getTeacherLoads(), getAllTeacherSubjects(), getAllTeacherGradeLevels(),
    ]).then(([g, s, t, a, l, ts, tg]) => {
      setGroups(g.data); setSubjects(s.data); setTeachers(t.data); setAssignments(a.data);
      setLoads(l.data); setTeacherSubjects(ts.data); setTeacherGrades(tg.data);
    }).catch(() => { }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedGroup) { setCurriculum([]); return; }
    getCurriculumByGroup(selectedGroup.id).then(r => setCurriculum(r.data)).catch(() => setCurriculum([]));
  }, [selectedGroup]);

  const subjectName = (id) => subjects.find(s => s.id === id)?.subject_name || `#${id}`;
  const teacherById = (id) => teachers.find(t => t.id === id) || null;
  const assignmentFor = (curReqId) => assignments.find(a => a.cur_requirement_id === curReqId) || null;
  const loadFor = (teacherId) => loads.find(l => l.teacher_id === teacherId) || null;
  const prefersSubject = (tid, sid) => teacherSubjects.some(x => x.teacher_id === tid && x.subject_id === sid);
  const prefersGrade = (tid, grade) => grade != null && teacherGrades.some(x => x.teacher_id === tid && x.grade_level === grade);
  const isOverQuota = (tid) => { const ld = loadFor(tid); return ld && ld.has_quota && ld.remaining < 0; };

  const refreshAfterWrite = async () => {
    const [a, l] = await Promise.all([getTeacherAssignments(), getTeacherLoads()]);
    setAssignments(a.data); setLoads(l.data);
  };

  const openPicker = (row) => { setPickerError(''); setPicker(row); };
  const closePicker = () => { setPicker(null); setPickerError(''); };

  const assign = async (teacherId) => {
    const existing = assignmentFor(picker.id);
    if (existing && existing.teacher_id === teacherId) { closePicker(); return; }
    setPickerBusy(true); setPickerError('');
    try {
      if (existing) await updateAssignment(existing.id, { teacher_id: teacherId, cur_requirement_id: picker.id });
      else await createAssignment({ teacher_id: teacherId, cur_requirement_id: picker.id });
      await refreshAfterWrite();
      closePicker();
    } catch (e) { setPickerError('השיוך נכשל. נסה/י שוב.'); }
    finally { setPickerBusy(false); }
  };

  const selectStyle = {
    fontFamily: FONT, fontSize: '13px', color: '#4a3f35', padding: '8px 12px',
    borderRadius: '8px', border: '1px solid #e2dacc', backgroundColor: '#fff',
    minWidth: '200px', cursor: 'pointer',
  };

  if (loading) {
    return (<><PageHeader title={title} />
      <div style={{ textAlign: 'center', color: '#c8baa6', padding: '60px', fontSize: '14px' }}>טוען נתונים…</div></>);
  }

  const unassignedCount = curriculum.filter(c => !assignmentFor(c.id)).length;

  return (
    <>
      <PageHeader title={title} />

      <div style={{ maxWidth: '620px', margin: '0 auto' }}>
        <div style={styles.card}>
          <div style={{ fontSize: '15px', color: '#4a3f35', marginBottom: '4px' }}>שיוך מורים למקצועות</div>
          <div style={{ fontSize: '12px', color: '#8a7a6e', marginBottom: '16px', lineHeight: 1.5 }}>
            בחר/י כיתה, ולכל מקצוע שייך/י את המורה שילמד אותו. שיוך זה הוא מה שהאלגוריתם משתמש בו ביצירת מערכת השעות.
          </div>

          {/* class dropdown, top-left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
            <select
              value={selectedGroup?.id ?? ''}
              onChange={e => setSelectedGroup(groups.find(x => x.id === Number(e.target.value)) || null)}
              style={selectStyle}
            >
              <option value="">בחר כיתה</option>
              {Object.entries(groupsByGrade(groups)).map(([grade, gs]) => (
                <optgroup key={grade} label={`שכבה ${grade}`}>
                  {gs.map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
                </optgroup>
              ))}
            </select>
            {selectedGroup && (
              <span style={{ fontSize: '12px', color: '#8a7a6e', marginRight: 'auto' }}>
                {curriculum.length} מקצועות
                {unassignedCount > 0 && <span style={{ color: '#c0705a' }}> · {unassignedCount} לא משויכים</span>}
              </span>
            )}
          </div>

          {!selectedGroup ? (
            <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px', fontSize: '13px' }}>בחר/י כיתה כדי להתחיל</div>
          ) : curriculum.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>אין תכנית לימודים לכיתה זו</div>
          ) : curriculum.map(c => {
            const asg = assignmentFor(c.id);
            const teacher = asg ? teacherById(asg.teacher_id) : null;
            const over = teacher && isOverQuota(teacher.id);
            return (
              <div key={c.id} onClick={() => openPicker(c)}
                style={{ display: 'grid', gridTemplateColumns: '160px 60px 220px', justifyContent: 'center', alignItems: 'center', gap: '28px', padding: '11px 12px', borderBottom: '1px solid #f0ebe3', cursor: 'pointer', borderRadius: '8px' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FAF7F2'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <div style={{ fontSize: '14px', color: '#4a3f35' }}>{subjectName(c.subject_id)}</div>
                <div style={{ fontSize: '12px', color: '#8a7a6e', textAlign: 'center' }}>{c.weekly_hours} ש'</div>
                {teacher ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: colorForTeacher(teacher.id).bg, color: colorForTeacher(teacher.id).color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>{initials(teacher)}</span>
                    <span style={{ fontSize: '13px', color: '#4a3f35' }}>{fullName(teacher)}</span>
                    {over && <span title="משובץ מעבר למכסה" style={{ color: '#c0705a', fontSize: '14px' }}>⚠</span>}
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: '#c0705a' }}>לא משויך — לחצ/י לשיוך</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {picker && (
        <TeacherPicker
          curriculumRow={picker} group={selectedGroup} subjectName={subjectName(picker.subject_id)}
          teachers={teachers} currentTeacherId={assignmentFor(picker.id)?.teacher_id ?? null}
          loadFor={loadFor}
          prefersSubject={(tid) => prefersSubject(tid, picker.subject_id)}
          prefersGrade={(tid) => prefersGrade(tid, groupGrade(selectedGroup))}
          busy={pickerBusy} error={pickerError} onPick={assign} onClose={closePicker}
        />
      )}
    </>
  );
}

const chip = (bg, color, icon, label) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', backgroundColor: bg, color, borderRadius: '20px', padding: '2px 9px' }}>
    <i className={`ti ${icon}`} style={{ fontSize: '13px' }} aria-hidden="true"></i>{label}
  </span>
);

function TeacherPicker({ curriculumRow, group, subjectName, teachers, currentTeacherId, loadFor, prefersSubject, prefersGrade, busy, error, onPick, onClose }) {
  const hours = curriculumRow.weekly_hours;
  const scored = teachers.map(t => ({ t, ps: prefersSubject(t.id), pg: prefersGrade(t.id) }));
  scored.sort((a, b) => {
    const sa = (a.ps ? 2 : 0) + (a.pg ? 1 : 0), sb = (b.ps ? 2 : 0) + (b.pg ? 1 : 0);
    return sa !== sb ? sb - sa : byName(a.t, b.t);
  });

  const remainingBadge = (tid) => {
    const ld = loadFor(tid);
    if (!ld || !ld.has_quota) return <span style={{ fontSize: '11px', color: '#8a7a6e', backgroundColor: '#f0ebe3', borderRadius: '20px', padding: '3px 10px' }}>אין מכסה</span>;
    const rem = ld.remaining, after = rem - hours;
    if (rem < 0) return <span style={{ fontSize: '11px', color: '#c0705a', backgroundColor: '#FAE8E8', borderRadius: '20px', padding: '3px 10px' }}>חורג ב-{Math.abs(rem)} ש'</span>;
    if (after < 0) return <span style={{ fontSize: '11px', color: '#a08c30', backgroundColor: '#FFF3A3', borderRadius: '20px', padding: '3px 10px' }}>יחרוג ב-{Math.abs(after)} ש'</span>;
    return <span style={{ fontSize: '11px', color: '#3d6b2e', backgroundColor: '#EDF4E8', borderRadius: '20px', padding: '3px 10px' }}>נותרו {rem} ש'</span>;
  };

  return (
    <Modal title={`בחירת מורה · ${subjectName}`} subtitle={`כיתה ${group.group_name} · ${hours} שעות שבועיות`} width="520px" maxHeight="80vh" onClose={onClose}>
      {error && <div style={{ fontSize: '13px', color: '#c0705a', backgroundColor: '#fff3f0', border: '1px solid #f0c9be', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
        {chip('#EDF4E8', '#6b8f5e', 'ti-book', 'מלמד/ת מקצוע זה')}
        {chip('#D6E4F5', '#33578f', 'ti-school', 'מלמד/ת שכבה זו')}
      </div>
      <div style={{ maxHeight: '52vh', overflowY: 'auto', margin: '0 -6px' }}>
        {scored.map(({ t, ps, pg }) => {
          const isCurrent = t.id === currentTeacherId;
          return (
            <div key={t.id} onClick={() => !busy && onPick(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', cursor: busy ? 'default' : 'pointer', border: isCurrent ? '1px solid #8a9e78' : '1px solid transparent', backgroundColor: isCurrent ? '#F5F8F2' : 'transparent', marginBottom: '2px' }}
              onMouseEnter={e => { if (!busy && !isCurrent) e.currentTarget.style.backgroundColor = '#FAF7F2'; }}
              onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent'; }}>
              <span style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: colorForTeacher(t.id).bg, color: colorForTeacher(t.id).color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, flexShrink: 0 }}>{initials(t)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', color: '#4a3f35' }}>{fullName(t)}</span>
                  {isCurrent && <span style={{ fontSize: '11px', color: '#3d6b2e' }}>· משויך/ת כעת</span>}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                  {ps && chip('#EDF4E8', '#6b8f5e', 'ti-book', 'מקצוע')}
                  {pg && chip('#D6E4F5', '#33578f', 'ti-school', 'שכבה')}
                </div>
              </div>
              {remainingBadge(t.id)}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
