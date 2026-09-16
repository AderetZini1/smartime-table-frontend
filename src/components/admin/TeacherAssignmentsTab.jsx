import { useState, useEffect } from 'react';
import { PageHeader, FONT, GRADE_LETTERS, fullName, initials, colorForTeacher, Modal, byName } from './adminShared';
import {
  getStudentGroups, getSubjects, getTeachers, getCurriculumByGroup,
  getTeacherAssignments, getTeacherLoads, getAllTeacherSubjects, getAllTeacherGradeLevels,
  createAssignment, updateAssignment, deleteAssignment,
} from '../../services/api';
import { styles } from '../../pages/adminDashboard.styles';

// grade letter (א-ו) → integer 1-6, from a group name like "כיתה א1".
// Strips the word "כיתה" first so its ה doesn't match by mistake.
function groupGrade(group) {
  const letter = group.group_name.replace(/כיתה\s*/g, '').match(/([א-ו])/)?.[1];
  const idx = letter ? GRADE_LETTERS.indexOf(letter) : -1;
  return idx >= 0 ? idx + 1 : null;
}

// { 'א': [group,...], ... } — same derivation the curriculum screen uses.
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
  // reference data (loaded once)
  const [groups, setGroups] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loads, setLoads] = useState([]);
  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [teacherGrades, setTeacherGrades] = useState([]);

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [curriculum, setCurriculum] = useState([]);
  const [loading, setLoading] = useState(true);

  // teacher-picker modal: the curriculum row being assigned, or null
  const [picker, setPicker] = useState(null);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [pickerError, setPickerError] = useState('');

  // one-time load of everything the screen needs
  useEffect(() => {
    Promise.all([
      getStudentGroups(),
      getSubjects(),
      getTeachers(),
      getTeacherAssignments(),
      getTeacherLoads(),
      getAllTeacherSubjects(),
      getAllTeacherGradeLevels(),
    ]).then(([g, s, t, a, l, ts, tg]) => {
      setGroups(g.data);
      setSubjects(s.data);
      setTeachers(t.data);
      setAssignments(a.data);
      setLoads(l.data);
      setTeacherSubjects(ts.data);
      setTeacherGrades(tg.data);
      if (g.data.length > 0) setSelectedGroup(g.data[0]);
    }).catch(() => { }).finally(() => setLoading(false));
  }, []);

  // curriculum (subjects + hours) for the selected group
  useEffect(() => {
    if (!selectedGroup) { setCurriculum([]); return; }
    getCurriculumByGroup(selectedGroup.id).then(r => setCurriculum(r.data)).catch(() => setCurriculum([]));
  }, [selectedGroup]);

  const subjectName = (id) => subjects.find(s => s.id === id)?.subject_name || `#${id}`;
  const teacherById = (id) => teachers.find(t => t.id === id) || null;
  const assignmentFor = (curReqId) => assignments.find(a => a.cur_requirement_id === curReqId) || null;
  const loadFor = (teacherId) => loads.find(l => l.teacher_id === teacherId) || null;

  const prefersSubject = (teacherId, subjectId) =>
    teacherSubjects.some(ts => ts.teacher_id === teacherId && ts.subject_id === subjectId);
  const prefersGrade = (teacherId, grade) =>
    grade != null && teacherGrades.some(tg => tg.teacher_id === teacherId && tg.grade_level === grade);

  const isOverQuota = (teacherId) => {
    const ld = loadFor(teacherId);
    return ld && ld.has_quota && ld.remaining < 0;
  };

  // refetch just the two things that change after a write
  const refreshAfterWrite = async () => {
    const [a, l] = await Promise.all([getTeacherAssignments(), getTeacherLoads()]);
    setAssignments(a.data);
    setLoads(l.data);
  };

  const openPicker = (curriculumRow) => {
    setPickerError('');
    setPicker(curriculumRow);
  };
  const closePicker = () => { setPicker(null); setPickerError(''); };

  const assign = async (teacherId) => {
    const existing = assignmentFor(picker.id);
    if (existing && existing.teacher_id === teacherId) { closePicker(); return; } // no change
    setPickerBusy(true);
    setPickerError('');
    try {
      if (existing) {
        await updateAssignment(existing.id, { teacher_id: teacherId, cur_requirement_id: picker.id });
      } else {
        await createAssignment({ teacher_id: teacherId, cur_requirement_id: picker.id });
      }
      await refreshAfterWrite();
      closePicker();
    } catch (e) {
      setPickerError('השיוך נכשל. נסה/י שוב.');
    } finally {
      setPickerBusy(false);
    }
  };

  const removeAssignment = async () => {
    const existing = assignmentFor(picker.id);
    if (!existing) { closePicker(); return; }
    setPickerBusy(true);
    setPickerError('');
    try {
      await deleteAssignment(existing.id);
      await refreshAfterWrite();
      closePicker();
    } catch (e) {
      setPickerError('הסרת השיוך נכשלה. נסה/י שוב.');
    } finally {
      setPickerBusy(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title={title} />
        <div style={{ textAlign: 'center', color: '#c8baa6', padding: '60px', fontSize: '14px' }}>טוען נתונים…</div>
      </>
    );
  }

  const unassignedCount = curriculum.filter(c => !assignmentFor(c.id)).length;

  return (
    <>
      <PageHeader title={title} />

      <div style={styles.card}>
        <div style={{ fontSize: '15px', color: '#4a3f35', marginBottom: '4px' }}>שיוך מורים למקצועות</div>
        <div style={{ fontSize: '12px', color: '#8a7a6e', marginBottom: '18px', lineHeight: 1.5 }}>
          בחר/י כיתה, ולכל מקצוע שהיא לומדת שייך/י את המורה שילמד אותו. השיוך הזה הוא מה שהאלגוריתם משתמש בו בעת יצירת מערכת השעות.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '16px' }}>
          {/* class selector */}
          <div style={{ backgroundColor: '#FAF7F2', borderRadius: '10px', border: '1px solid #e2dacc', padding: '10px', maxHeight: '560px', overflowY: 'auto' }}>
            {Object.entries(groupsByGrade(groups)).map(([grade, gradeGroups]) => (
              <div key={grade} style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', color: '#c8baa6', padding: '4px 6px', marginBottom: '2px' }}>שכבת {grade}</div>
                {gradeGroups.map(g => {
                  const active = selectedGroup?.id === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGroup(g)}
                      style={{ display: 'block', width: '100%', textAlign: 'right', padding: '7px 10px', borderRadius: '7px', border: 'none', background: active ? '#EDF4E8' : 'transparent', fontSize: '13px', color: active ? '#3d6b2e' : '#8a7a6e', cursor: 'pointer', marginBottom: '2px', fontFamily: FONT, fontWeight: active ? '500' : 'normal' }}
                    >
                      {g.group_name}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* subject rows for the selected class */}
          <div>
            {selectedGroup ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#4a3f35' }}>כיתה {selectedGroup.group_name}</span>
                  <span style={{ fontSize: '12px', color: '#8a7a6e' }}>
                    {curriculum.length} מקצועות
                    {unassignedCount > 0 && <span style={{ color: '#c0705a' }}> · {unassignedCount} לא משויכים</span>}
                  </span>
                </div>

                {curriculum.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>אין תכנית לימודים לכיתה זו</div>
                ) : curriculum.map(c => {
                  const asg = assignmentFor(c.id);
                  const teacher = asg ? teacherById(asg.teacher_id) : null;
                  const over = teacher && isOverQuota(teacher.id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => openPicker(c)}
                      style={{ display: 'flex', alignItems: 'center', padding: '10px 8px', borderBottom: '1px solid #f0ebe3', gap: '12px', cursor: 'pointer', borderRadius: '8px' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FAF7F2'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div style={{ flex: 1, fontSize: '14px', color: '#4a3f35' }}>{subjectName(c.subject_id)}</div>
                      <span style={{ fontSize: '12px', color: '#8a7a6e', minWidth: '54px', textAlign: 'center' }}>{c.weekly_hours} ש'</span>

                      {teacher ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px' }}>
                          <span style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: colorForTeacher(teacher.id).bg, color: colorForTeacher(teacher.id).color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>
                            {initials(teacher)}
                          </span>
                          <span style={{ fontSize: '13px', color: '#4a3f35' }}>{fullName(teacher)}</span>
                          {over && <span title="המורה משובץ מעבר למכסת השעות" style={{ color: '#c0705a', fontSize: '14px' }}>⚠</span>}
                        </div>
                      ) : (
                        <div style={{ minWidth: '200px', fontSize: '13px', color: '#c0705a' }}>לא משויך — לחצ/י לשיוך</div>
                      )}
                      <i className="ti ti-pencil" style={{ color: '#c8baa6', fontSize: '16px' }} aria-hidden="true"></i>
                    </div>
                  );
                })}
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>בחר/י כיתה מהרשימה</div>
            )}
          </div>
        </div>
      </div>

      {picker && (
        <TeacherPicker
          curriculumRow={picker}
          group={selectedGroup}
          subjectName={subjectName(picker.subject_id)}
          teachers={teachers}
          currentTeacherId={assignmentFor(picker.id)?.teacher_id ?? null}
          grade={groupGrade(selectedGroup)}
          loadFor={loadFor}
          prefersSubject={(tid) => prefersSubject(tid, picker.subject_id)}
          prefersGrade={(tid) => prefersGrade(tid, groupGrade(selectedGroup))}
          busy={pickerBusy}
          error={pickerError}
          onPick={assign}
          onRemove={removeAssignment}
          onClose={closePicker}
        />
      )}
    </>
  );
}

// ---- teacher picker modal ----------------------------------------------------

const chip = (bg, color, icon, label) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', backgroundColor: bg, color, borderRadius: '20px', padding: '2px 9px' }}>
    <i className={`ti ${icon}`} style={{ fontSize: '13px' }} aria-hidden="true"></i>{label}
  </span>
);

function TeacherPicker({
  curriculumRow, group, subjectName, teachers, currentTeacherId, grade,
  loadFor, prefersSubject, prefersGrade, busy, error, onPick, onRemove, onClose,
}) {
  const hours = curriculumRow.weekly_hours;

  // score for ordering: prefers-subject (2) weighs more than prefers-grade (1)
  const scored = teachers.map(t => ({
    t,
    ps: prefersSubject(t.id),
    pg: prefersGrade(t.id),
  }));
  scored.sort((a, b) => {
    const sa = (a.ps ? 2 : 0) + (a.pg ? 1 : 0);
    const sb = (b.ps ? 2 : 0) + (b.pg ? 1 : 0);
    if (sa !== sb) return sb - sa;
    return byName(a.t, b.t);
  });

  // shows how the teacher stands vs their quota if this subject is assigned to them
  const remainingBadge = (teacherId) => {
    const ld = loadFor(teacherId);
    if (!ld || !ld.has_quota) {
      return <span style={{ fontSize: '11px', color: '#8a7a6e', backgroundColor: '#f0ebe3', borderRadius: '20px', padding: '3px 10px' }}>אין מכסה</span>;
    }
    const rem = ld.remaining;              // remaining before this subject
    const after = rem - hours;             // remaining if assigned here
    if (rem < 0) {
      return <span style={{ fontSize: '11px', color: '#c0705a', backgroundColor: '#FAE8E8', borderRadius: '20px', padding: '3px 10px' }}>חורג ב-{Math.abs(rem)} ש'</span>;
    }
    if (after < 0) {
      return <span style={{ fontSize: '11px', color: '#a08c30', backgroundColor: '#FFF3A3', borderRadius: '20px', padding: '3px 10px' }}>יחרוג ב-{Math.abs(after)} ש'</span>;
    }
    return <span style={{ fontSize: '11px', color: '#3d6b2e', backgroundColor: '#EDF4E8', borderRadius: '20px', padding: '3px 10px' }}>נותרו {rem} ש'</span>;
  };

  return (
    <Modal
      title={`בחירת מורה · ${subjectName}`}
      subtitle={`כיתה ${group.group_name} · ${hours} שעות שבועיות`}
      width="520px"
      maxHeight="80vh"
      onClose={onClose}
    >
      {error && (
        <div style={{ fontSize: '13px', color: '#c0705a', backgroundColor: '#fff3f0', border: '1px solid #f0c9be', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px' }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', fontSize: '11px', color: '#8a7a6e' }}>
        {chip('#EDF4E8', '#6b8f5e', 'ti-book', 'מלמד/ת מקצוע זה')}
        {chip('#D6E4F5', '#33578f', 'ti-school', 'מלמד/ת שכבה זו')}
      </div>

      <div style={{ maxHeight: '52vh', overflowY: 'auto', margin: '0 -6px' }}>
        {scored.map(({ t, ps, pg }) => {
          const isCurrent = t.id === currentTeacherId;
          return (
            <div
              key={t.id}
              onClick={() => !busy && onPick(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', cursor: busy ? 'default' : 'pointer', border: isCurrent ? '1px solid #8a9e78' : '1px solid transparent', backgroundColor: isCurrent ? '#F5F8F2' : 'transparent', marginBottom: '2px' }}
              onMouseEnter={e => { if (!busy && !isCurrent) e.currentTarget.style.backgroundColor = '#FAF7F2'; }}
              onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <span style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: colorForTeacher(t.id).bg, color: colorForTeacher(t.id).color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, flexShrink: 0 }}>
                {initials(t)}
              </span>
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

      {currentTeacherId != null && (
        <div style={{ borderTop: '1px solid #f0ebe3', marginTop: '12px', paddingTop: '14px', display: 'flex', justifyContent: 'flex-start' }}>
          <button
            onClick={() => !busy && onRemove()}
            disabled={busy}
            style={{ backgroundColor: '#fff', color: '#c0705a', border: '1px solid #e2c4bb', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: busy ? 'default' : 'pointer', fontFamily: FONT }}
          >
            <i className="ti ti-user-off" aria-hidden="true"></i> הסר שיוך
          </button>
        </div>
      )}
    </Modal>
  );
}
