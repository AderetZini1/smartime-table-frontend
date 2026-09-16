import { useState, useEffect } from 'react';
import { PageHeader, FONT, GRADE_LETTERS, fullName, initials, colorForTeacher } from './adminShared';
import {
  getStudentGroups, getSubjects, getTeachers, getCurriculumByGroup,
  getTeacherAssignments, getTeacherLoads, getAllTeacherSubjects, getAllTeacherGradeLevels,
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

  // is the assigned teacher over their quota? (for the ⚠ on a row)
  const isOverQuota = (teacherId) => {
    const ld = loadFor(teacherId);
    return ld && ld.has_quota && ld.remaining < 0;
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
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f0ebe3', gap: '12px' }}>
                      <div style={{ flex: 1, fontSize: '14px', color: '#4a3f35' }}>{subjectName(c.subject_id)}</div>
                      <span style={{ fontSize: '12px', color: '#8a7a6e', minWidth: '54px', textAlign: 'center' }}>{c.weekly_hours} ש'</span>

                      {teacher ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '180px' }}>
                          <span style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: colorForTeacher(teacher.id).bg, color: colorForTeacher(teacher.id).color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>
                            {initials(teacher)}
                          </span>
                          <span style={{ fontSize: '13px', color: '#4a3f35' }}>{fullName(teacher)}</span>
                          {over && <span title="המורה משובץ מעבר למכסת השעות" style={{ color: '#c0705a', fontSize: '14px' }}>⚠</span>}
                        </div>
                      ) : (
                        <div style={{ minWidth: '180px', fontSize: '13px', color: '#c0705a' }}>לא משויך</div>
                      )}
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
    </>
  );
}
