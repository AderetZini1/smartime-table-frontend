import { useState, useEffect } from 'react';
import { SCHOOL_TABS, PageHeader, FONT, DAYS, GRADES, GRADE_LABELS, PEDAGOGICAL_TYPES, pedTypeLabel, ConfirmDeleteModal, PrimaryButton } from './adminShared';
import { getSchoolSettings, saveSchoolSettings, getSubjects, getPedagogicalConstraints, addPedagogicalConstraint, deletePedagogicalConstraint, getStudentGroups, getCurriculumByGroup, createCurriculumRequirement, updateCurriculumRequirement, deleteCurriculumRequirement } from '../../services/api';
import { styles } from '../../pages/adminDashboard.styles';

const SECTIONS = {
  day: DayStructureSection,
  ped: PedagogicalSection,
  curriculum: CurriculumSection,
};

export default function SchoolSettingsTab({ title }) {
  const [section, setSection] = useState('day');
  const Section = SECTIONS[section];

  return (
    <>
      <PageHeader title={title} />
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid #e2dacc' }}>
        {SCHOOL_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            style={{ flex: 1, padding: '12px 16px', fontSize: '16px', border: 'none', background: 'transparent', color: section === t.id ? '#4a3f35' : '#8a7a6e', cursor: 'pointer', borderBottom: section === t.id ? '3px solid #8a9e78' : '3px solid transparent', fontFamily: FONT, fontWeight: 700, textAlign: 'center' }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Section />
    </>
  );
}

const DEFAULT_SETTINGS = { active_days: [1, 2, 3, 4, 5, 6], start_time: '08:00', breaks: [], grade_end_times: {} };
const DEFAULT_BREAK = { after_lesson: 2, duration_minutes: 10 };

function DayStructureSection() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [newBreak, setNewBreak] = useState(DEFAULT_BREAK);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSchoolSettings()
      .then(r => setSettings({ ...r.data, grade_end_times: r.data.grade_end_times || {} }))
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  const update = (patch) => setSettings(prev => ({ ...prev, ...patch }));

  const toggleDay = (day) => {
    const days = settings.active_days || [];
    update({ active_days: days.includes(day) ? days.filter(x => x !== day) : [...days, day] });
  };

  const addBreak = () => {
    update({ breaks: [...(settings.breaks || []), newBreak] });
    setNewBreak(DEFAULT_BREAK);
  };

  const removeBreak = (idx) => update({ breaks: settings.breaks.filter((_, i) => i !== idx) });

  const save = async () => {
    try {
      await saveSchoolSettings(settings);
      setSaved(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
    <div style={styles.card}>
      <div style={{ fontSize: '15px', color: '#4a3f35', marginBottom: '20px' }}>מבנה יום הלימודים</div>

      <div style={{ marginBottom: '20px' }}>
        <label style={styles.label}>ימי לימוד</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {Object.entries(DAYS).map(([num, name]) => {
            const day = parseInt(num);
            const selected = (settings.active_days || []).includes(day);
            return (
              <button
                key={num}
                onClick={() => toggleDay(day)}
                style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', backgroundColor: selected ? '#8a9e78' : '#f5f2ee', color: selected ? '#fff' : '#8a7a6e', border: `1px solid ${selected ? '#8a9e78' : '#e2dacc'}`, fontFamily: FONT }}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div>
          <label style={styles.label}>שעת התחלה</label>
          <input type="time" style={styles.input} value={settings.start_time || '08:00'} onChange={e => update({ start_time: e.target.value })} />
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={styles.label}>שעת סיום לפי שכבה</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          {GRADES.map(grade => (
            <div key={grade} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <label style={{ ...styles.label, marginBottom: 0, width: '70px' }}>כיתות {GRADE_LABELS[grade]}</label>
              <input
                type="time"
                style={{ ...styles.input, width: '160px' }}
                value={(settings.grade_end_times || {})[String(grade)] || ''}
                onChange={e => update({ grade_end_times: { ...(settings.grade_end_times || {}), [String(grade)]: e.target.value } })}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={styles.label}>הפסקות</label>
        {(settings.breaks || []).map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f0ebe3' }}>
            <span style={{ fontSize: '13px', color: '#4a3f35' }}>אחרי שיעור {b.after_lesson}</span>
            <span style={{ fontSize: '13px', color: '#8a7a6e' }}>{b.duration_minutes} דקות</span>
            <i className="ti ti-trash" onClick={() => removeBreak(i)} style={{ ...styles.iconBtn, marginRight: 'auto' }} aria-hidden="true"></i>
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
          <button onClick={addBreak} style={styles.btnOutline}>+ הוסף הפסקה</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={save} style={styles.btnAdd}>שמור הגדרות יום</button>
        {saved && <span style={{ fontSize: '13px', color: '#8a9e78' }}>✓ נשמר</span>}
      </div>
    </div>
    </div>
  );
}

const EMPTY_DRAFT = { constraint_type: '', subject_a_id: '', subject_b_id: '', numeric_value: '' };

const hasSecondSubject = (t) => t === 'not_consecutive' || t === 'min_gap';
const hasNumber = (t) => t === 'max_per_day' || t === 'min_gap';

// Returns an error message, or '' when the draft is valid.
function validate(d) {
  const t = d.constraint_type;
  if (!t) return 'יש לבחור סוג אילוץ';
  if (!d.subject_a_id) return 'יש לבחור מקצוע';
  if (t === 'not_consecutive') {
    if (!d.subject_b_id) return 'יש לבחור מקצוע שני';
    if (d.subject_a_id === d.subject_b_id) return 'יש לבחור שני מקצועות שונים';
  }
  if (t === 'max_per_day' && !(parseInt(d.numeric_value) >= 1)) return 'יש להזין ערך מספרי (1 ומעלה)';
  return '';
}

function toPayload(d) {
  const t = d.constraint_type;
  return {
    constraint_type: t,
    subject_a_id: d.subject_a_id ? parseInt(d.subject_a_id) : null,
    // min_gap with an empty second subject means "the same subject"
    subject_b_id: d.subject_b_id ? parseInt(d.subject_b_id) : (t === 'min_gap' ? parseInt(d.subject_a_id) : null),
    numeric_value: t === 'min_gap'
      ? (parseInt(d.numeric_value) || 0)
      : (d.numeric_value ? parseInt(d.numeric_value) : null),
    raw_text: null,
  };
}

const toDraft = (p) => ({
  constraint_type: p.constraint_type,
  subject_a_id: p.subject_a_id != null ? String(p.subject_a_id) : '',
  subject_b_id: p.subject_b_id != null ? String(p.subject_b_id) : '',
  numeric_value: p.numeric_value != null ? String(p.numeric_value) : '',
});

function PedagogicalSection() {
  const [subjects, setSubjects] = useState([]);
  const [constraints, setConstraints] = useState([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const load = () => getPedagogicalConstraints().then(r => setConstraints(r.data)).catch(() => { });

  useEffect(() => {
    load();
    getSubjects().then(r => setSubjects(r.data)).catch(() => { });
  }, []);

  const subjectName = (id) => subjects.find(s => s.id === id)?.subject_name || '';

  const handleAdd = async () => {
    const err = validate(draft);
    setError(err);
    if (err) return;
    await addPedagogicalConstraint(toPayload(draft));
    load();
    setDraft(EMPTY_DRAFT);
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditDraft(toDraft(p));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  // No update endpoint exists for pedagogical constraints, so an "edit" is
  // implemented as delete-old + create-new.
  const saveEdit = async () => {
    const err = validate(editDraft);
    setError(err);
    if (err) return;
    setSavingEdit(true);
    try {
      await deletePedagogicalConstraint(editingId);
      await addPedagogicalConstraint(toPayload(editDraft));
      await load();
      cancelEdit();
    } catch (e) {
      alert('השמירה נכשלה. נסה/י שוב.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    await deletePedagogicalConstraint(toDelete.id);
    setConstraints(prev => prev.filter(p => p.id !== toDelete.id));
    setToDelete(null);
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
    <div style={styles.card}>
      <div style={{ fontSize: '15px', color: '#4a3f35', marginBottom: '16px' }}>אילוצים פדגוגיים</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px', maxWidth: '340px' }}>
        <PedagogicalFields
          labeled
          draft={draft}
          subjects={subjects}
          onChange={(patch) => {
            if ('constraint_type' in patch) setError('');
            setDraft(d => ({ ...d, ...patch }));
          }}
        />
        {error && editingId === null && <div style={{ color: '#c0392b', fontSize: '13px' }}>{error}</div>}
        <button onClick={handleAdd} style={styles.btnAdd}>+ הוסף</button>
      </div>

      {constraints.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#c8baa6', padding: '24px', fontSize: '14px' }}>אין אילוצים פדגוגיים עדיין</div>
      ) : constraints.map((p, i) => {
        const border = i < constraints.length - 1 ? '1px solid #f0ebe3' : 'none';

        if (editingId === p.id) {
          return (
            <div key={p.id} style={{ padding: '14px 0', borderBottom: border, display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '340px' }}>
              <PedagogicalFields draft={editDraft} subjects={subjects} onChange={(patch) => setEditDraft(d => ({ ...d, ...patch }))} />
              {error && <div style={{ color: '#c0392b', fontSize: '13px' }}>{error}</div>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <PrimaryButton onClick={saveEdit} busy={savingEdit} style={{ padding: '7px 16px' }}>שמור</PrimaryButton>
                <button onClick={cancelEdit} disabled={savingEdit} style={{ ...styles.btnOutline, padding: '7px 16px', fontSize: '13px' }}>ביטול</button>
              </div>
            </div>
          );
        }

        return (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: border }}>
            <span style={{ fontSize: '12px', backgroundColor: '#EDF4E8', color: '#6b8f5e', borderRadius: '20px', padding: '3px 10px', marginLeft: '10px' }}>
              {pedTypeLabel(p.constraint_type)}
            </span>
            <span style={{ fontSize: '13px', color: '#4a3f35', flex: 1 }}>
              {subjectName(p.subject_a_id)}
              {p.subject_b_id ? ` ⟷ ${subjectName(p.subject_b_id)}` : ''}
              {p.numeric_value ? ` — ${p.numeric_value}` : ''}
            </span>
            <i className="ti ti-pencil" onClick={() => startEdit(p)} style={{ ...styles.iconBtn, marginLeft: '12px' }} aria-hidden="true"></i>
            <i
              className="ti ti-trash"
              onClick={() => {
                const name = subjectName(p.subject_a_id);
                setToDelete({ id: p.id, name: name ? `${pedTypeLabel(p.constraint_type)} – ${name}` : pedTypeLabel(p.constraint_type) });
              }}
              style={styles.iconBtn}
              aria-hidden="true"
            ></i>
          </div>
        );
      })}

      {toDelete && <ConfirmDeleteModal name={toDelete.name} onConfirm={handleDelete} onCancel={() => setToDelete(null)} />}
    </div>
    </div>
  );
}

// Shared by the "add" form (labeled) and the inline edit form (placeholders only).
function PedagogicalFields({ draft, subjects, onChange, labeled = false }) {
  const t = draft.constraint_type;
  const select = { ...styles.input, cursor: 'pointer' };
  const wrap = (label, node) => (labeled ? <div><label style={styles.label}>{label}</label>{node}</div> : node);
  const subjectOptions = subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>);

  return (
    <>
      {wrap('סוג אילוץ',
        <select
          value={t}
          onChange={e => onChange({ constraint_type: e.target.value, subject_a_id: '', subject_b_id: '', numeric_value: '' })}
          style={select}
        >
          {labeled && <option value="">בחר אילוץ להחיל על המערכת</option>}
          {PEDAGOGICAL_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
        </select>
      )}

      {t && wrap(hasSecondSubject(t) ? 'מקצוע ראשון' : 'מקצוע',
        <select value={draft.subject_a_id} onChange={e => onChange({ subject_a_id: e.target.value })} style={select}>
          <option value="">{labeled ? 'בחר מקצוע' : (hasSecondSubject(t) ? 'מקצוע ראשון' : 'בחר מקצוע')}</option>
          {subjectOptions}
        </select>
      )}

      {hasSecondSubject(t) && wrap(`מקצוע שני${t === 'min_gap' ? ' (ריק = אותו מקצוע)' : ''}`,
        <select value={draft.subject_b_id} onChange={e => onChange({ subject_b_id: e.target.value })} style={select}>
          <option value="">{labeled ? 'בחר מקצוע' : (t === 'min_gap' ? 'מקצוע שני (ריק = אותו מקצוע)' : 'מקצוע שני')}</option>
          {subjectOptions}
        </select>
      )}

      {hasNumber(t) && wrap(t === 'max_per_day' ? 'ערך (מקסימום שיעורים ביום)' : 'מינימום הפרדה (0 = צמודים)',
        <input
          type="number"
          min="0"
          value={draft.numeric_value}
          onChange={e => onChange({ numeric_value: e.target.value })}
          style={{ ...styles.input, width: '100px' }}
          placeholder={t === 'max_per_day' ? (labeled ? 'למשל: 2' : 'מקסימום') : '0'}
        />
      )}
    </>
  );
}

// { 'א': [group, ...], 'ב': [...], 'אחר': [...] } — grade is the first letter א-ו
// after removing the word "כיתה" (otherwise "כיתה ב1" would match the ה in כיתה).
function groupsByGrade(groups) {
  const result = {};
  groups.forEach(g => {
    const match = g.group_name.replace(/כיתה\s*/g, '').match(/([א-ו])/);
    const grade = match ? match[1] : 'אחר';
    (result[grade] = result[grade] || []).push(g);
  });
  return result;
}

const hoursMap = (rows) => Object.fromEntries(rows.map(c => [c.subject_id, c.weekly_hours]));

function CurriculumSection() {
  const [subjects, setSubjects] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null); // null = "בחר כיתה"
  const [curriculum, setCurriculum] = useState([]);
  const [hours, setHours] = useState({});
  const [copyFrom, setCopyFrom] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    getSubjects().then(r => setSubjects(r.data)).catch(() => { });
    getStudentGroups().then(r => setGroups(r.data)).catch(() => { });
  }, []);

  const loadCurriculum = (groupId) =>
    getCurriculumByGroup(groupId).then(r => {
      setCurriculum(r.data);
      setHours(hoursMap(r.data));
    }).catch(() => { });

  useEffect(() => {
    setSaveError('');
    if (selectedGroup) loadCurriculum(selectedGroup.id);
    else { setCurriculum([]); setHours({}); }
  }, [selectedGroup]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  const save = async () => {
    if (!selectedGroup) return;
    setSaving(true);
    setSaveError('');
    try {
      for (const subject of subjects) {
        const existing = curriculum.find(c => c.subject_id === subject.id);
        const value = parseInt(hours[subject.id] || 0);
        if (existing) {
          if (value === 0) await deleteCurriculumRequirement(existing.id);          // 0 hours = remove the row
          else if (existing.weekly_hours !== value) await updateCurriculumRequirement(existing.id, { weekly_hours: value });
        } else if (value > 0) {
          await createCurriculumRequirement({ subject_id: subject.id, student_group_id: selectedGroup.id, weekly_hours: value });
        }
      }
      setSaved(true);
    } catch (err) {
      setSaveError('השמירה נכשלה באמצע. הטופס מציג עכשיו את מה שנשמר בפועל — בדוק/י ונסה/י שוב.');
    } finally {
      await loadCurriculum(selectedGroup.id);
      setSaving(false);
    }
  };

  const copy = async () => {
    if (!copyFrom) return;
    const res = await getCurriculumByGroup(parseInt(copyFrom));
    setHours(hoursMap(res.data));
  };

  const total = Object.values(hours).reduce((a, b) => a + (parseInt(b) || 0), 0);
  const selectedName = selectedGroup ? selectedGroup.group_name : null;
  const selectStyle = { fontFamily: FONT, fontSize: '13px', color: '#4a3f35', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2dacc', backgroundColor: '#fff', minWidth: '180px', cursor: 'pointer' };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '15px', color: '#4a3f35' }}>תכנית לימודים שבועית</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {saved && <span style={{ fontSize: '13px', color: '#8a9e78' }}>✓ נשמר</span>}
            <button onClick={save} disabled={saving || !selectedGroup} style={{ ...styles.btnAdd, opacity: (saving || !selectedGroup) ? 0.6 : 1 }}>{saving ? 'שומר…' : 'שמור שינויים'}</button>
          </div>
        </div>
        {saveError && (
          <div style={{ fontSize: '13px', color: '#c0705a', backgroundColor: '#fff3f0', border: '1px solid #f0c9be', borderRadius: '8px', padding: '8px 12px', marginBottom: '14px' }}>{saveError}</div>
        )}

        {/* class selection */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <span style={{ fontSize: '13px', color: '#8a7a6e' }}>כיתה:</span>
          <select value={selectedGroup?.id ?? ''} onChange={e => setSelectedGroup(groups.find(x => x.id === Number(e.target.value)) || null)} style={selectStyle}>
            <option value="">בחר כיתה</option>
            {Object.entries(groupsByGrade(groups)).map(([grade, gs]) => (
              <optgroup key={grade} label={`שכבה ${grade}`}>
                {gs.map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
              </optgroup>
            ))}
          </select>
          {selectedGroup && <span style={{ marginRight: 'auto', backgroundColor: '#EDF4E8', color: '#3d6b2e', borderRadius: '20px', padding: '4px 12px', fontSize: '12px' }}>סה"כ {total} שעות</span>}
        </div>

        {/* copy-from — visually separate box */}
        {selectedGroup && (
          <div style={{ backgroundColor: '#FAF7F2', border: '1px solid #e2dacc', borderRadius: '8px', padding: '10px 12px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#8a7a6e' }}>העתקת תכנית מכיתה אחרת:</span>
              <select value={copyFrom} onChange={e => setCopyFrom(e.target.value)} style={{ ...selectStyle, minWidth: '150px', fontSize: '12px', padding: '5px 10px' }}>
                <option value="">בחר כיתת מקור</option>
                {groups.filter(g => g.id !== selectedGroup?.id).map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
              </select>
              <button onClick={copy} disabled={!copyFrom} style={{ ...styles.btnOutline, fontSize: '12px', padding: '5px 12px', opacity: copyFrom ? 1 : 0.5 }}>העתק</button>
            </div>
            <div style={{ fontSize: '11px', color: '#c8baa6', marginTop: '6px', lineHeight: 1.5 }}>
              מעתיק את שעות התכנית מכיתת המקור אל {selectedName ? `כיתה ${selectedName}` : 'הכיתה הנבחרת'}, ומחליף את הערכים בטופס. נשמר רק בלחיצה על "שמור שינויים".
            </div>
          </div>
        )}

        {/* subject list */}
        {!selectedGroup ? (
          <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px', fontSize: '13px' }}>בחר/י כיתה כדי להתחיל</div>
        ) : subjects.map(subject => {
          const value = hours[subject.id] || 0;
          const filled = value > 0;
          return (
            <div key={subject.id} style={{ display: 'flex', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #f0ebe3', gap: '10px' }}>
              <div style={{ flex: 1, fontSize: '14px', color: '#4a3f35' }}>{subject.subject_name}</div>
              <input
                type="number"
                min="0"
                max="15"
                value={value}
                onChange={e => setHours(prev => ({ ...prev, [subject.id]: parseInt(e.target.value) || 0 }))}
                style={{ width: '44px', height: '44px', textAlign: 'center', fontSize: '16px', fontWeight: '500', border: `1.5px solid ${filled ? '#8a9e78' : '#e2dacc'}`, borderRadius: '8px', background: filled ? '#EDF4E8' : '#FAF7F2', color: filled ? '#3d6b2e' : '#4a3f35', outline: 'none', MozAppearance: 'textfield' }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
