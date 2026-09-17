import { useState, useEffect } from 'react';
import { getTeachers, getSubjects, getStudentGroups, getMyConstraints, getTeacherPreferencesById, getTeacherSubjectsById, getTeacherGradeLevelsById, getTeacherHomeroomById, saveTeacherPreferencesById, addTeacherSubjectById, removeTeacherSubjectById, addTeacherGradeLevelById, removeTeacherGradeLevelById, saveTeacherHomeroomById, createConstraint, deleteConstraint } from '../../services/api';
import { styles } from '../../pages/adminDashboard.styles';
import { colorForTeacher, initials, fullName, byName, PageHeader, ConfirmDialog, PrimaryButton, DAY_NAMES, HOURS, gradeClassLabel, GRADES, timeslotId, timeslotParts, SectionBox, Chip, ToggleRow } from './adminShared';

export default function TeacherPrefsTab({ title, onViewSchedule }) {
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    getTeachers().then(r => setTeachers(r.data)).catch(() => { });
    getSubjects().then(r => setSubjects(r.data)).catch(() => { });
  }, []);

  if (selected) {
    return (
      <>
        <PageHeader title={title} />
        <TeacherPrefsDetail
          key={selected.id}
          teacher={selected}
          subjects={subjects}
          onBack={() => setSelected(null)}
          onViewSchedule={() => onViewSchedule(selected)}
        />
      </>
    );
  }

  const nonAdmins = teachers.filter(t => !t.is_admin);
  const total = nonAdmins.length;
  const visible = nonAdmins
    .filter(t => fullName(t).includes(search.trim()))
    .sort(byName);

  return (
    <>
      <PageHeader title={title} />
      <div style={{ ...styles.card, maxWidth: '640px', margin: '0 auto 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
            <i className="ti ti-search" aria-hidden="true" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#c8baa6', fontSize: '16px', lineHeight: 1 }}></i>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש מורה…"
              style={{ ...styles.input, paddingRight: '36px', textAlign: 'right' }}
            />
          </div>
          <span style={{ fontSize: '12px', color: '#8a7a6e' }}>
            {search.trim() ? `${visible.length} מתוך ${total} מורים` : `${total} מורים`}
          </span>
        </div>
        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#c8baa6', padding: '24px', fontSize: '14px' }}>לא נמצאו מורים</div>
        ) : visible.map((t, i) => {
          const c = colorForTeacher(t.id);
          return (
            <div
              key={t.id}
              onClick={() => setSelected(t)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 8px', borderBottom: i < visible.length - 1 ? '1px solid #f0ebe3' : 'none', cursor: 'pointer' }}
            >
              <div style={{ ...styles.avatar, backgroundColor: c.bg, color: c.color }}>{initials(t)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '15px', color: '#4a3f35', fontWeight: 700 }}>{fullName(t)}</div>
                <div style={{ fontSize: '12px', color: '#8a7a6e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.email}</div>
              </div>
              <i className="ti ti-chevron-left" style={{ color: '#c8baa6' }} aria-hidden="true"></i>
            </div>
          );
        })}
      </div>
    </>
  );
}

// Outline button with an icon: icon and label vertically centered on one line.
const iconButton = { ...styles.btnOutline, fontSize: '13px', padding: '8px 16px', gap: '6px', alignItems: 'center', lineHeight: 1 };
const buttonIcon = { fontSize: '15px', lineHeight: 1, display: 'block' };

const normalizeConstraintType = (c) => (c.constraint_type === 'hard' ? 'hard' : 'soft');

async function loadTeacherData(teacherId) {
  const [prefs, subjects, grades, homeroom, constraints] = await Promise.all([
    getTeacherPreferencesById(teacherId).then(r => r.data).catch(() => null),
    getTeacherSubjectsById(teacherId).then(r => r.data).catch(() => []),
    getTeacherGradeLevelsById(teacherId).then(r => r.data).catch(() => []),
    getTeacherHomeroomById(teacherId).then(r => r.data).catch(() => ({})),
    getMyConstraints().then(r => r.data.filter(c => c.teacher_id === teacherId)).catch(() => []),
  ]);
  return { prefs, subjects, grades, homeroom, constraints };
}

function buildDraft(data) {
  const p = data.prefs;
  return {
    prefs: {
      min_hours: p?.min_hours ?? 18,
      max_hours: p?.max_hours ?? 26,
      priority_early_finish: p?.priority_early_finish ? 1 : 0,
      priority_no_gaps: p?.priority_no_gaps ? 1 : 0,
      priority_free_day: p?.priority_free_day ? 1 : 0,
      priority_consecutive: p?.priority_consecutive ? 1 : 0,
      preferred_consecutive: p?.preferred_consecutive ?? false,
    },
    subjectIds: data.subjects.map(s => s.subject_id),
    grades: data.grades.map(g => g.grade_level),
    homeroom: {
      wants_homeroom: data.homeroom?.wants_homeroom ?? false,
      preferred_group_id: data.homeroom?.preferred_group_id ?? null,
      wants_continue_with_previous: data.homeroom?.wants_continue_with_previous ?? false,
    },
    // { [timeslotId]: 'soft' | 'hard' }
    constraints: Object.fromEntries(data.constraints.map(c => [c.timeslot_id, normalizeConstraintType(c)])),
  };
}

const added = (next, prev) => next.filter(x => !prev.includes(x));

async function saveTeacherPrefs(teacherId, data, draft) {
  // 1. Preferences (priorities + carried-through hours)
  await saveTeacherPreferencesById(teacherId, {
    min_hours: data.prefs?.min_hours ?? 18,
    max_hours: data.prefs?.max_hours ?? 26,
    ...draft.prefs,
  });

  // 2. Subjects: add newly-checked, remove newly-unchecked
  const originalSubjects = data.subjects.map(s => s.subject_id);
  for (const sid of added(draft.subjectIds, originalSubjects)) {
    try {
      await addTeacherSubjectById(teacherId, sid);
    } catch (e) {
      if (e?.response?.status !== 400) throw e; // ignore "already exists", surface real errors
    }
  }
  for (const sid of added(originalSubjects, draft.subjectIds)) {
    await removeTeacherSubjectById(teacherId, sid);
  }

  // 3. Grade levels
  const originalGrades = data.grades.map(g => g.grade_level);
  for (const gl of added(draft.grades, originalGrades)) await addTeacherGradeLevelById(teacherId, gl);
  for (const gl of added(originalGrades, draft.grades)) await removeTeacherGradeLevelById(teacherId, gl);

  // 4. Homeroom preference (single upsert)
  const h = draft.homeroom;
  await saveTeacherHomeroomById(teacherId, {
    wants_homeroom: h.wants_homeroom,
    preferred_group_id: h.wants_homeroom ? h.preferred_group_id : null,
    wants_continue_with_previous: h.wants_homeroom ? h.wants_continue_with_previous : false,
  });

  // 5. Availability constraints: diff draft vs original (changed = delete + create)
  const original = Object.fromEntries(data.constraints.map(c => [c.timeslot_id, { type: normalizeConstraintType(c), id: c.id }]));
  const allTimeslots = new Set([...Object.keys(original), ...Object.keys(draft.constraints)].map(Number));
  for (const tsId of allTimeslots) {
    const orig = original[tsId];
    const next = draft.constraints[tsId];
    if (orig && (!next || orig.type !== next)) await deleteConstraint(orig.id);
    if (next && (!orig || orig.type !== next)) {
      await createConstraint({ teacher_id: teacherId, timeslot_id: tsId, weight: 1, constraint_type: next });
    }
  }
}

function TeacherPrefsDetail({ teacher, subjects, onBack, onViewSchedule }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmSchedule, setConfirmSchedule] = useState(false);

  useEffect(() => {
    getStudentGroups().then(r => setGroups(r.data)).catch(() => { });
    loadTeacherData(teacher.id).then(setData).finally(() => setLoading(false));
  }, [teacher.id]);

  // patch('prefs', p => ({...p, x: 1})) or patch('grades', [1, 2])
  const patch = (key, value) =>
    setDraft(d => ({ ...d, [key]: typeof value === 'function' ? value(d[key]) : value }));

  const startEdit = () => {
    setDraft(buildDraft(data));
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveTeacherPrefs(teacher.id, data, draft);
      setData(await loadTeacherData(teacher.id));
      setEditing(false);
    } catch (err) {
      alert('השמירה נכשלה. נסה/י שוב.');
    } finally {
      setSaving(false);
    }
  };

  const color = colorForTeacher(teacher.id);
  const sectionProps = { data, draft, editing, patch };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <button onClick={onBack} style={{ ...iconButton, padding: '6px 12px', marginBottom: '16px' }}>
        <i className="ti ti-chevron-right" style={buttonIcon} aria-hidden="true"></i>
        <span>חזרה לרשימה</span>
      </button>

      {confirmSchedule && (
        <ConfirmDialog
          title="מעבר לתצוגת מערכת שעות"
          message="המעבר יציג את מערכת השעות של המורה, ולא את עמוד ההעדפות."
          warning="שים/י לב: אם התחלת לערוך ולא שמרת, השינויים לא יישמרו."
          confirmLabel="כן, אני רוצה לצפות במערכת"
          cancelLabel="להישאר בעמוד ההעדפות בינתיים"
          maxWidth="440px"
          onConfirm={onViewSchedule}
          onCancel={() => setConfirmSchedule(false)}
        />
      )}

      <div style={{ ...styles.card, borderTop: `4px solid ${color.color}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingBottom: '18px', marginBottom: '18px', borderBottom: '1px solid #ece7dd' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: color.bg, color: color.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
            {initials(teacher)}
          </div>
          <div style={{ minWidth: 0, textAlign: 'right' }}>
            <div style={{ fontSize: '17px', color: '#4a3f35', fontWeight: 700 }}>{fullName(teacher)}</div>
            <div style={{ fontSize: '12px', color: '#8a7a6e' }}>{teacher.email} · מכסה: {teacher.weekly_hours_quota ?? '—'} שעות</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto', flexShrink: 0 }}>
            <button onClick={() => setConfirmSchedule(true)} style={iconButton}>
              <i className="ti ti-calendar" style={buttonIcon} aria-hidden="true"></i>
              <span>צפה במערכת</span>
            </button>
            {!editing ? (
              <button onClick={startEdit} disabled={!data} style={iconButton}>
                <i className="ti ti-pencil" style={buttonIcon} aria-hidden="true"></i>
                <span>עריכה</span>
              </button>
            ) : (
              <>
                <PrimaryButton onClick={save} busy={saving}>שמור</PrimaryButton>
                <button onClick={() => setEditing(false)} disabled={saving} style={iconButton}>ביטול</button>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>טוען…</div>
        ) : !data ? (
          <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>לא נמצאו נתונים</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <SubjectsGradesSection {...sectionProps} subjects={subjects} />
            <HomeroomSection {...sectionProps} groups={groups} />
            <PrioritySection {...sectionProps} teacher={teacher} />
            <AvailabilitySection {...sectionProps} />
          </div>
        )}
      </div>
    </div>
  );
}

// Every section receives: data (saved values), draft (edit values), editing, patch(key, valueOrUpdater)

const subLabel = { fontSize: '12px', color: '#8a7a6e', marginBottom: '8px' };
const muted = { fontSize: '13px', color: '#c8baa6' };
const infoText = { fontSize: '13px', color: '#8a7a6e', lineHeight: 1.8 };
const chipRow = { display: 'flex', flexWrap: 'wrap', gap: '8px' };

const toggleIn = (list, value) => (list.includes(value) ? list.filter(x => x !== value) : [...list, value]);

function SubjectsGradesSection({ data, draft, editing, patch, subjects }) {
  return (
    <SectionBox title="מקצועות ושכבות">
      <div style={subLabel}>מקצועות שהמורה מלמד/ת</div>
      {!editing ? (
        data.subjects.length === 0 ? (
          <div style={{ ...muted, marginBottom: '14px' }}>לא נבחרו מקצועות</div>
        ) : (
          <div style={{ ...chipRow, marginBottom: '14px' }}>
            {data.subjects.map(s => (
              <span key={s.subject_id} style={{ padding: '5px 12px', borderRadius: '20px', backgroundColor: '#EDF4E8', color: '#4a7c3f', fontSize: '13px' }}>
                {subjects.find(x => x.id === s.subject_id)?.subject_name || `#${s.subject_id}`}
              </span>
            ))}
          </div>
        )
      ) : (
        <div style={{ ...chipRow, marginBottom: '14px' }}>
          {subjects.map(subj => (
            <Chip key={subj.id} selected={draft.subjectIds.includes(subj.id)} onClick={() => patch('subjectIds', ids => toggleIn(ids, subj.id))}>
              {subj.subject_name}
            </Chip>
          ))}
        </div>
      )}

      <div style={subLabel}>שכבות מועדפות</div>
      {!editing ? (
        data.grades.length === 0 ? (
          <div style={muted}>לא נבחרו שכבות</div>
        ) : (
          <div style={chipRow}>
            {data.grades.map(g => (
              <span key={g.grade_level} style={{ padding: '5px 12px', borderRadius: '20px', backgroundColor: '#f5f2ee', color: '#8a7a6e', fontSize: '13px' }}>
                {gradeClassLabel(g.grade_level)}
              </span>
            ))}
          </div>
        )
      ) : (
        <div style={chipRow}>
          {GRADES.map(gl => (
            <Chip key={gl} selected={draft.grades.includes(gl)} onClick={() => patch('grades', list => toggleIn(list, gl))}>
              {gradeClassLabel(gl)}
            </Chip>
          ))}
        </div>
      )}
    </SectionBox>
  );
}

function HomeroomSection({ data, draft, editing, patch, groups }) {
  if (!editing) {
    const h = data.homeroom;
    return (
      <SectionBox title="חינוך כיתה">
        <div style={infoText}>
          <div>{h?.wants_homeroom ? 'המורה מעוניין/ת בחינוך כיתה' : 'המורה לא ביקש/ה חינוך כיתה'}</div>
          {h?.wants_homeroom && (
            <>
              <div>כיתה מועדפת: {groups.find(g => g.id === h.preferred_group_id)?.group_name || 'לא נבחרה'}</div>
              <div>המשך עם הכיתה הקודמת: {h.wants_continue_with_previous ? 'כן' : 'לא'}</div>
            </>
          )}
        </div>
      </SectionBox>
    );
  }

  const h = draft.homeroom;
  const setH = (field, value) => patch('homeroom', prev => ({ ...prev, [field]: value }));

  return (
    <SectionBox title="חינוך כיתה">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <ToggleRow label="מעוניין/ת בחינוך כיתה" on={h.wants_homeroom} onClick={() => setH('wants_homeroom', !h.wants_homeroom)} />
        {h.wants_homeroom && (
          <>
            <div style={{ maxWidth: '320px' }}>
              <div style={{ fontSize: '13px', color: '#4a3f35', marginBottom: '6px' }}>כיתה מועדפת</div>
              <select
                value={h.preferred_group_id ?? ''}
                onChange={e => setH('preferred_group_id', e.target.value ? parseInt(e.target.value) : null)}
                style={{ ...styles.input, width: '100%' }}
              >
                <option value="">ללא העדפה</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
              </select>
            </div>
            <ToggleRow label="המשך עם הכיתה הקודמת" on={h.wants_continue_with_previous} onClick={() => setH('wants_continue_with_previous', !h.wants_continue_with_previous)} />
          </>
        )}
      </div>
    </SectionBox>
  );
}

const PRIORITY_FIELDS = [
  { field: 'priority_early_finish', label: 'סיום מוקדם', readLabel: 'סיום מוקדם' },
  { field: 'priority_no_gaps', label: 'הימנעות מחלונות', readLabel: 'ללא חלונות' },
  { field: 'priority_free_day', label: 'יום חופשי', readLabel: 'יום חופשי' },
  { field: 'priority_consecutive', label: 'שיעורים רצופים', readLabel: 'שיעורים רצופים' },
];

function PrioritySection({ data, draft, editing, patch, teacher }) {
  const p = data.prefs;
  return (
    <SectionBox title="העדפות שיבוץ">
      {/* מכסה (קריאה בלבד) + טווח מבוקש (ניתן לעריכה ע"י המנהל) */}
      <div style={{ ...infoText, marginBottom: editing ? '14px' : '0' }}>
        <div>מכסת השעות של המורה: {teacher.weekly_hours_quota ?? '—'}</div>
        {!editing ? (
          p && <div>טווח שעות מבוקש: {p.min_hours}–{p.max_hours}</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
            <span style={{ fontSize: '13px', color: '#4a3f35' }}>טווח שעות מבוקש:</span>
            <span style={{ fontSize: '12px', color: '#8a7a6e' }}>מינ'
              <input type="number" min="0" max="40" value={draft.prefs.min_hours}
                onChange={e => patch('prefs', prev => ({ ...prev, min_hours: parseInt(e.target.value) || 0 }))}
                style={{ width: '52px', margin: '0 4px', padding: '4px 6px', textAlign: 'center', border: '1px solid #e2dacc', borderRadius: '6px', fontSize: '13px' }} />
            </span>
            <span style={{ fontSize: '12px', color: '#8a7a6e' }}>מקס'
              <input type="number" min="0" max="40" value={draft.prefs.max_hours}
                onChange={e => patch('prefs', prev => ({ ...prev, max_hours: parseInt(e.target.value) || 0 }))}
                style={{ width: '52px', margin: '0 4px', padding: '4px 6px', textAlign: 'center', border: '1px solid #e2dacc', borderRadius: '6px', fontSize: '13px' }} />
            </span>
          </div>
        )}
      </div>

      {!editing ? (
        !p ? (
          <div style={muted}>לא הוגדרו העדפות</div>
        ) : (
          <div style={infoText}>
            {PRIORITY_FIELDS.map(({ field, readLabel }) => (
              <div key={field}>{readLabel}: {p[field] ? 'מועדף' : 'ללא'}</div>
            ))}
            <div>העדפת שיעורים: {p.preferred_consecutive ? 'רצופים' : 'עם הפסקות'}</div>
          </div>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {PRIORITY_FIELDS.map(({ field, label }) => (
            <ToggleRow
              key={field}
              label={label}
              on={!!draft.prefs[field]}
              onClick={() => patch('prefs', prev => ({ ...prev, [field]: prev[field] ? 0 : 1 }))}
            />
          ))}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '320px', marginTop: '4px' }}>
            <span style={{ fontSize: '13px', color: '#4a3f35' }}>העדפת שיעורים</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <Chip selected={draft.prefs.preferred_consecutive} onClick={() => patch('prefs', prev => ({ ...prev, preferred_consecutive: true }))}>רצופים</Chip>
              <Chip selected={!draft.prefs.preferred_consecutive} onClick={() => patch('prefs', prev => ({ ...prev, preferred_consecutive: false }))}>עם הפסקות</Chip>
            </div>
          </div>
        </div>
      )}
    </SectionBox>
  );
}

const CONSTRAINT_LOOK = {
  hard: { bg: '#FAE8E8', color: '#c0705a', mark: '✕', label: 'לא יכול' },
  soft: { bg: '#FFF3A3', color: '#a08c30', mark: '–', label: 'מעדיף שלא' },
};

// Friday has only 4 lessons.
const isBlockedSlot = (dayIdx, hour) => dayIdx === 5 && hour > 4;

// blank -> soft (מעדיף שלא) -> hard (לא יכול) -> blank
const nextState = (cur) => (!cur ? 'soft' : cur === 'soft' ? 'hard' : undefined);

function AvailabilitySection({ data, draft, editing, patch }) {
  const cycle = (tsId) =>
    patch('constraints', prev => {
      const next = { ...prev };
      const state = nextState(prev[tsId]);
      if (state) next[tsId] = state; else delete next[tsId];
      return next;
    });

  return (
    <SectionBox title="אילוצי זמינות">
      <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '12px', color: '#8a7a6e' }}>
        {['soft', 'hard'].map(type => (
          <span key={type}>
            <span style={{ display: 'inline-block', width: '11px', height: '11px', borderRadius: '3px', backgroundColor: CONSTRAINT_LOOK[type].bg, marginLeft: '5px', verticalAlign: 'middle' }}></span>
            {CONSTRAINT_LOOK[type].label}
          </span>
        ))}
        {editing && <span style={{ color: '#c8baa6' }}>לחיצה מחליפה בין המצבים</span>}
      </div>

      {!editing ? (
        data.constraints.length === 0 ? (
          <div style={muted}>אין אילוצי זמינות</div>
        ) : (
          <div style={chipRow}>
            {[...data.constraints].sort((a, b) => a.timeslot_id - b.timeslot_id).map(c => {
              const { dayIdx, hour } = timeslotParts(c.timeslot_id);
              const look = CONSTRAINT_LOOK[c.constraint_type === 'hard' ? 'hard' : 'soft'];
              return (
                <span key={c.id} style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '12px', backgroundColor: look.bg, color: look.color }}>
                  יום {DAY_NAMES[dayIdx]} · שעה {hour} · {look.label}
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
              {DAY_NAMES.map(d => (
                <th key={d} style={{ fontSize: '12px', color: '#4a3f35', fontWeight: 600, padding: '2px 6px' }}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map(hour => (
              <tr key={hour}>
                <td style={{ fontSize: '12px', color: '#8a7a6e', padding: '2px 6px', whiteSpace: 'nowrap' }}>שיעור {hour}</td>
                {DAY_NAMES.map((dayName, dayIdx) => {
                  if (isBlockedSlot(dayIdx, hour)) {
                    return (
                      <td key={dayIdx}>
                        <div style={{ width: '38px', height: '34px', borderRadius: '8px', border: '1px solid #e2dacc', background: 'repeating-linear-gradient(135deg,#f5f2ee,#f5f2ee 5px,#efece6 5px,#efece6 10px)' }}></div>
                      </td>
                    );
                  }
                  const tsId = timeslotId(dayIdx, hour);
                  const look = CONSTRAINT_LOOK[draft.constraints[tsId]];
                  return (
                    <td key={dayIdx}>
                      <button
                        onClick={() => cycle(tsId)}
                        aria-label={`יום ${dayName} שעה ${hour}`}
                        style={{ width: '38px', height: '34px', borderRadius: '8px', border: '1px solid #e2dacc', backgroundColor: look ? look.bg : '#f7f4ef', color: look ? look.color : '#a08c30', cursor: 'pointer', fontSize: '15px', lineHeight: 1 }}
                      >
                        {look ? look.mark : ''}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionBox>
  );
}
