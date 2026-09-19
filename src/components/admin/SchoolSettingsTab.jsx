import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  PageHeader, FONT, DAYS, GRADES, GRADE_LABELS, GRADE_LETTERS, PEDAGOGICAL_TYPES, pedTypeLabel,
  ConfirmDeleteModal, Modal, fullName, initials, colorForTeacher, byName,
} from './adminShared';
import {
  getSchoolSettings, saveSchoolSettings, getSubjects, getStudentGroups, getTeachers,
  getPedagogicalConstraints, addPedagogicalConstraint, deletePedagogicalConstraint,
  getCurriculumByGroup, createCurriculumRequirement, updateCurriculumRequirement, deleteCurriculumRequirement,
  getTeacherAssignments, getTeacherLoads, getAllTeacherSubjects, getAllTeacherGradeLevels,
  createAssignment, updateAssignment, deleteAssignment,
} from '../../services/api';

// הגדרות מוסד — קובץ אחד:
//   1. מסגרת הלשוניות          (SchoolSettingsTab)
//   2. מבנה יום                 (DayStructureSection)
//   3. אילוצים פדגוגיים         (PedagogicalSection)
//   4. תכנית לימודים            (CurriculumSection)
//   5. שיוך מורים               (TeacherAssignmentsSection)
//   6. רכיבים ועזרים משותפים    (בתחתית הקובץ)

// Order follows the real workflow: day → curriculum → teachers → rules.
const TABS = [
  { id: 'day', label: 'מבנה יום', Component: DayStructureSection },
  { id: 'curriculum', label: 'תכנית לימודים', Component: CurriculumSection },
  { id: 'assignments', label: 'שיוך מורים', Component: TeacherAssignmentsSection },
  { id: 'ped', label: 'אילוצים פדגוגיים', Component: PedagogicalSection },
];

export default function SchoolSettingsTab({ title }) {
  const [tab, setTab] = useState('day');
  const { Component } = TABS.find(t => t.id === tab);

  return (
    <div className="ss-root">
      <style>{SS_CSS}</style>
      <PageHeader title={title} />
      <div role="tablist" style={{ display: 'flex', borderBottom: `1px solid ${C.field}`, marginBottom: '24px' }}>
        {TABS.map(t => {
          const active = t.id === tab;
          return (
            <button key={t.id} role="tab" aria-selected={active} type="button" onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '15px 8px 11px', lineHeight: 1, fontSize: '15px', fontFamily: FONT, textAlign: 'center', cursor: 'pointer',
                border: 'none', background: 'transparent', color: active ? C.text : C.soft, fontWeight: active ? 600 : 400,
                borderBottom: `3px solid ${active ? C.matcha : 'transparent'}`,
              }}>
              {t.label}
            </button>
          );
        })}
      </div>
      <Component />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// מבנה יום
// ════════════════════════════════════════════════════════════════════════════
const DEFAULT_SETTINGS = { active_days: [1, 2, 3, 4, 5], start_time: '08:00', friday_end_time: '', breaks: [], grade_end_times: {} };

function DayStructureSection() {
  const [settings, setSettings] = useState(null);
  const [breakForm, setBreakForm] = useState(null); // null | { mode: 'add' | <after_lesson being edited>, after_lesson, duration_minutes }
  const [breakError, setBreakError] = useState('');
  const { status, track } = useSaveTracker();
  const skipNextSave = useRef(true);

  useEffect(() => {
    getSchoolSettings()
      .then(r => setSettings({
        ...DEFAULT_SETTINGS, ...r.data,
        start_time: hhmm(r.data.start_time) || DEFAULT_SETTINGS.start_time,
        friday_end_time: hhmm(r.data.friday_end_time) || '',
        grade_end_times: Object.fromEntries(Object.entries(r.data.grade_end_times || {}).map(([k, v]) => [k, hhmm(v)])),
        breaks: r.data.breaks || [],
      }))
      .catch(() => setSettings(DEFAULT_SETTINGS));
  }, []);

  // autosave, 700ms after the last change
  useEffect(() => {
    if (!settings) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    const t = setTimeout(() => { track(saveSchoolSettings(settings)).catch(() => { }); }, 700);
    return () => clearTimeout(t);
  }, [settings, track]);

  if (!settings) return <Quiet>טוען…</Quiet>;

  const update = (patch) => setSettings(prev => ({ ...prev, ...patch }));
  const days = settings.active_days || [];
  const toggleDay = (d) => update({ active_days: days.includes(d) ? days.filter(x => x !== d) : [...days, d].sort() });

  // add or edit one break; one break per lesson
  const saveBreak = () => {
    const after = parseInt(breakForm.after_lesson), mins = parseInt(breakForm.duration_minutes);
    if (!(after >= 1)) return setBreakError('יש להזין מספר שיעור (1 ומעלה)');
    if (!(mins >= 1)) return setBreakError('יש להזין אורך בדקות (1 ומעלה)');
    const others = (settings.breaks || []).filter(x => x.after_lesson !== breakForm.mode);
    if (others.some(x => x.after_lesson === after)) return setBreakError(`כבר יש הפסקה אחרי שיעור ${after}`);
    update({ breaks: [...others, { after_lesson: after, duration_minutes: mins }].sort((x, y) => x.after_lesson - y.after_lesson) });
    setBreakForm(null); setBreakError('');
  };
  const openBreakForm = (mode, values) => { setBreakError(''); setBreakForm({ mode, ...values }); };
  const removeBreak = (after) => {
    update({ breaks: settings.breaks.filter(x => x.after_lesson !== after) });
    if (breakForm?.mode === after) setBreakForm(null);
  };

  const breakFields = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '14px', color: C.muted }}>
      <span>אחרי שיעור</span>
      <input type="number" min="1" max="12" aria-label="אחרי שיעור" value={breakForm?.after_lesson ?? ''} autoFocus
        onChange={e => setBreakForm(f => ({ ...f, after_lesson: e.target.value }))} style={numberStyle('52px')} />
      <span>באורך</span>
      <input type="number" min="1" max="90" aria-label="אורך בדקות" value={breakForm?.duration_minutes ?? ''}
        onChange={e => setBreakForm(f => ({ ...f, duration_minutes: e.target.value }))} style={numberStyle('52px')} />
      <span>דקות</span>
      <Btn size="sm" onClick={saveBreak} style={{ marginRight: '6px' }}>שמירה</Btn>
      <Btn variant="neutral" size="sm" onClick={() => { setBreakForm(null); setBreakError(''); }}>ביטול</Btn>
      {breakError && <span role="alert" style={{ fontSize: '13px', color: C.warmText }}>{breakError}</span>}
    </span>
  );

  const lessonsText = (grade) => {
    const end = settings.grade_end_times[String(grade)];
    if (!end) return { text: 'לא הוגדר', color: C.soft };
    if (!settings.start_time || end <= settings.start_time) return { text: 'מוקדם מההתחלה', color: C.warmText };
    const { lessons } = computeDay(settings, grade);
    if (lessons === 0) return { text: 'אין מקום לשיעור', color: C.warmText };
    return { text: lessons === 1 ? 'שיעור אחד ביום' : `${lessons} שיעורים ביום`, color: C.greenText };
  };

  const fridayText = () => {
    const end = settings.friday_end_time;
    if (!(days || []).includes(6)) return { text: 'יום שישי לא פעיל', color: C.soft };
    if (!end) return { text: 'לא הוגדר', color: C.soft };
    if (!settings.start_time || end <= settings.start_time) return { text: 'מוקדם מההתחלה', color: C.warmText };
    const n = lessonsBetween(settings, end);
    return { text: n === 0 ? 'אין מקום לשיעור' : (n === 1 ? 'שיעור אחד ביום שישי' : `${n} שיעורים ביום שישי`), color: C.greenText };
  };
  const weekdayRangeLabel = (activeDays) => {
    const wd = (activeDays || []).filter(d => d !== 6).sort((a, b) => a - b);
    if (wd.length === 0) return 'ימים א׳–ה׳';
    const contiguous = wd.every((d, i) => i === 0 || d === wd[i - 1] + 1);
    return contiguous ? `ימים ${DAYS[wd[0]]}–${DAYS[wd[wd.length - 1]]}` : `ימים ${wd.map(d => DAYS[d]).join(', ')}`;
  };

  const section = { display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '18px', borderTop: `1px solid ${C.lineSoft}` };

  // actual clock times of each break, and the grades whose day ends before it
  const breakRows = breakSchedule(settings).map(b => ({
    ...b,
    skipped: GRADES.filter(g => computeDay(settings, g).lessons <= b.after_lesson).map(g => GRADE_LABELS[g]),
  }));


  return (
    <div style={{ maxWidth: '820px', margin: '0 auto' }}>
      <Card>
        <CardTitle title="מבנה יום הלימודים" hint="ימים, שעות והפסקות. השינויים נשמרים מיד." aside={<SaveStatus status={status} />} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Label>ימי לימוד</Label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {Object.entries(DAYS).map(([num, name]) => {
              const d = parseInt(num), on = days.includes(d);
              return (
                <Btn key={num} size="sm" variant={on ? 'primary' : 'neutral'} aria-pressed={on} onClick={() => toggleDay(d)}
                  style={{ borderRadius: '20px', minWidth: '62px', ...(on ? {} : { background: '#F5F2EE', color: C.muted }) }}>
                  {name}
                </Btn>
              );
            })}
          </div>
        </div>

        <div style={{ ...section, flexDirection: 'row', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Label htmlFor="start-time">שעת התחלה</Label>
            <input id="start-time" type="time" value={settings.start_time || ''} onChange={e => update({ start_time: e.target.value })} style={{ ...timeStyle, alignSelf: 'flex-start' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Label htmlFor="friday-end">שעת סיום ביום שישי</Label>
            <input id="friday-end" type="time" value={settings.friday_end_time || ''} onChange={e => update({ friday_end_time: e.target.value })} style={{ ...timeStyle, alignSelf: 'flex-start' }} />
            <span style={{ fontSize: '12px', color: fridayText().color, whiteSpace: 'nowrap' }}>{fridayText().text}</span>
          </div>
        </div>

        <div style={section}>
          <Label>שעת סיום לפי שכבה · {weekdayRangeLabel(days)}</Label>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${GRADES.length}, minmax(0, 1fr))`, gap: '8px' }}>
            {GRADES.map(g => {
              const res = lessonsText(g);
              return (
                <label key={g} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '10px 4px', background: C.cream, borderRadius: '12px', fontSize: '13px', color: C.muted, minWidth: 0 }}>
                  כיתות {GRADE_LABELS[g]}
                  <input type="time" value={settings.grade_end_times[String(g)] || ''}
                    onChange={e => update({ grade_end_times: { ...settings.grade_end_times, [String(g)]: e.target.value } })}
                    style={timeStyle} />
                  <span style={{ fontSize: '12px', color: res.color, whiteSpace: 'nowrap' }}>{res.text}</span>
                </label>
              );
            })}
          </div>
          <span style={{ fontSize: '12px', color: C.soft }}>מספר השיעורים מחושב לפי שיעור של {LESSON_MINUTES} דקות וההפסקות שמוגדרות למטה.</span>
        </div>

        <div style={{ ...section, gap: '12px' }}>
          <Label>הפסקות</Label>

          {breakForm?.mode === 'add' ? (
            <div style={{ width: 'fit-content', background: C.cream, borderRadius: '12px', padding: '10px 14px' }}>{breakFields}</div>
          ) : (
            <button type="button" onClick={() => openBreakForm('add', { after_lesson: '', duration_minutes: 10 })}
              style={{ width: 'fit-content', display: 'inline-flex', alignItems: 'center', gap: '10px', border: 'none', background: 'transparent', padding: '4px 0', cursor: 'pointer', fontFamily: FONT, fontSize: '14px', color: C.green }}>
              <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', background: C.green, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-plus" style={{ fontSize: '16px' }}></i>
              </span>
              <span style={{ lineHeight: 1, paddingTop: '2px' }}>הוספת הפסקה חדשה</span>
            </button>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: C.muted }}>הפסקות פעילות</span>
            {breakRows.length === 0 ? (
              <span style={{ fontSize: '13px', color: C.soft }}>אין הפסקות עדיין.</span>
            ) : (
              <div style={{ ...TABLE_WRAP, margin: 0 }}>
                <table style={TABLE}>
                  <tbody>
                    {breakRows.map(b => breakForm?.mode === b.after_lesson ? (
                      <tr key={b.after_lesson}>
                        <td colSpan={4} style={{ ...TD, background: '#FBFCF8' }}>{breakFields}</td>
                      </tr>
                    ) : (
                      <tr key={b.after_lesson}>
                        <td style={{ ...TD, direction: 'ltr', textAlign: 'right', fontSize: '15px', fontWeight: 500 }}>{b.from}–{b.to}</td>
                        <td style={{ ...TD, fontSize: '14px' }}>אחרי שיעור {b.after_lesson}</td>
                        <td style={{ ...TD, fontSize: '14px', color: C.soft }}>
                          {b.duration_minutes} דקות
                          {b.skipped.length > 0 && <span style={{ color: C.warmText, fontSize: '12px' }}> · לא חלה על {b.skipped.join(', ')}</span>}
                        </td>
                        <td style={{ ...TD, paddingInline: '6px' }}>
                          <span style={{ display: 'flex', gap: '2px' }}>
                            <IconBtn label={`עריכת ההפסקה אחרי שיעור ${b.after_lesson}`} icon="ti-pencil"
                              onClick={() => openBreakForm(b.after_lesson, { after_lesson: b.after_lesson, duration_minutes: b.duration_minutes })} />
                            <IconBtn label={`מחיקת ההפסקה אחרי שיעור ${b.after_lesson}`} icon="ti-trash" onClick={() => removeBreak(b.after_lesson)} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// אילוצים פדגוגיים
// ════════════════════════════════════════════════════════════════════════════
const EMPTY_DRAFT = { constraint_type: '', subject_a_id: '', subject_b_id: '', numeric_value: '' };
const hasSecondSubject = (t) => t === 'not_consecutive' || t === 'min_gap';
const hasNumber = (t) => t === 'max_per_day' || t === 'min_gap';

const TYPE_HINTS = {
  max_per_day: 'המקצוע לא יופיע יותר מהמספר הזה של פעמים באותו יום.',
  not_consecutive: 'שני המקצועות לא ישובצו בשיעורים צמודים.',
  min_gap: 'יישארו לפחות כמה שיעורים בין שני המקצועות באותו יום.',
};

function validate(d) {
  const t = d.constraint_type;
  if (!t) return 'יש לבחור סוג אילוץ';
  if (!d.subject_a_id) return 'יש לבחור מקצוע';
  if (t === 'not_consecutive') {
    if (!d.subject_b_id) return 'יש לבחור מקצוע שני';
    if (d.subject_a_id === d.subject_b_id) return 'יש לבחור שני מקצועות שונים';
  }
  if (t === 'max_per_day' && !(parseInt(d.numeric_value) >= 1)) return 'יש להזין מספר (1 ומעלה)';
  return '';
}

function toPayload(d) {
  const t = d.constraint_type;
  return {
    constraint_type: t,
    subject_a_id: d.subject_a_id ? parseInt(d.subject_a_id) : null,
    // min_gap with an empty second subject means "the same subject"
    subject_b_id: d.subject_b_id ? parseInt(d.subject_b_id) : (t === 'min_gap' ? parseInt(d.subject_a_id) : null),
    numeric_value: t === 'min_gap' ? (parseInt(d.numeric_value) || 0) : (d.numeric_value ? parseInt(d.numeric_value) : null),
    raw_text: null,
  };
}

const toDraft = (p) => ({
  constraint_type: p.constraint_type,
  subject_a_id: p.subject_a_id != null ? String(p.subject_a_id) : '',
  subject_b_id: p.subject_b_id != null && !(p.constraint_type === 'min_gap' && p.subject_b_id === p.subject_a_id) ? String(p.subject_b_id) : '',
  numeric_value: p.numeric_value != null ? String(p.numeric_value) : '',
});

function PedagogicalSection() {
  const [subjects, setSubjects] = useState([]);
  const [constraints, setConstraints] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const load = () => getPedagogicalConstraints().then(r => setConstraints(r.data)).catch(() => setConstraints([]));
  useEffect(() => {
    load();
    getSubjects().then(r => setSubjects(r.data)).catch(() => { });
  }, []);

  const subjectName = (id) => subjects.find(s => s.id === id)?.subject_name || '';

  const handleAdd = async () => {
    const err = validate(draft);
    setAddError(err);
    if (err) return;
    setAdding(true);
    try {
      await addPedagogicalConstraint(toPayload(draft));
      await load();
      setDraft(EMPTY_DRAFT);
    } catch { setAddError('ההוספה נכשלה. נסו שוב.'); }
    finally { setAdding(false); }
  };

  // There is no update endpoint, so an edit is delete + create.
  const saveEdit = async () => {
    const err = validate(editDraft);
    setEditError(err);
    if (err) return;
    setSavingEdit(true);
    try {
      await deletePedagogicalConstraint(editingId);
      await addPedagogicalConstraint(toPayload(editDraft));
      await load();
      setEditingId(null);
    } catch { setEditError('השמירה נכשלה. נסו שוב.'); await load(); }
    finally { setSavingEdit(false); }
  };

  const handleDelete = async () => {
    await deletePedagogicalConstraint(toDelete.id);
    setConstraints(prev => prev.filter(p => p.id !== toDelete.id));
    setToDelete(null);
  };

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto' }}>
      <Card>
        <CardTitle title="אילוצים פדגוגיים" hint="כללים שהאלגוריתם מקפיד עליהם בכל הכיתות." />

        <div style={{ background: C.cream, border: `1px solid ${C.line}`, borderRadius: '12px', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Label htmlFor="new-type">אילוץ חדש</Label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <select id="new-type" value={draft.constraint_type} style={fieldStyle('240px')}
              onChange={e => { setAddError(''); setDraft({ ...EMPTY_DRAFT, constraint_type: e.target.value }); }}>
              <option value="">בחירת סוג אילוץ</option>
              {PEDAGOGICAL_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
            </select>
            {draft.constraint_type && <TypePill type={draft.constraint_type} />}
          </div>
          {draft.constraint_type && (
            <>
              <ConstraintSentence draft={draft} subjects={subjects} onChange={patch => setDraft(d => ({ ...d, ...patch }))} />
              {TYPE_HINTS[draft.constraint_type] && <div style={{ fontSize: '13px', color: C.soft }}>{TYPE_HINTS[draft.constraint_type]}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Btn onClick={handleAdd} disabled={adding}>{adding ? 'מוסיף…' : '+ הוספת האילוץ'}</Btn>
                {addError && <span role="alert" style={{ fontSize: '13px', color: C.warmText }}>{addError}</span>}
              </div>
            </>
          )}
        </div>

        {constraints === null ? <Quiet>טוען…</Quiet>
          : constraints.length === 0 ? <Quiet>אין אילוצים עדיין. אפשר להוסיף אחד בטופס שלמעלה.</Quiet>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Label>אילוצים פעילים ({constraints.length})</Label>
                <div style={{ ...TABLE_WRAP, margin: 0 }}>
                  <table style={TABLE}>
                    <tbody>
                      {constraints.map(p => editingId === p.id ? (
                        <tr key={p.id}>
                          <td colSpan={3} style={{ ...TD, whiteSpace: 'normal', background: '#FBFCF8' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <TypePill type={p.constraint_type} />
                                <ConstraintSentence draft={editDraft} subjects={subjects} onChange={patch => setEditDraft(d => ({ ...d, ...patch }))} />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Btn size="sm" onClick={saveEdit} disabled={savingEdit}>{savingEdit ? 'שומר…' : 'שמירה'}</Btn>
                                <Btn variant="neutral" size="sm" onClick={() => setEditingId(null)} disabled={savingEdit}>ביטול</Btn>
                                {editError && <span role="alert" style={{ fontSize: '13px', color: C.warmText }}>{editError}</span>}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={p.id}>
                          <td style={TD}><TypePill type={p.constraint_type} /></td>
                          <td style={{ ...TD, fontSize: '15px' }}>{describe(p, subjectName)}</td>
                          <td style={{ ...TD, paddingInline: '8px' }}>
                            <span style={{ display: 'flex', gap: '2px' }}>
                              <IconBtn label="עריכה" icon="ti-pencil" onClick={() => { setEditError(''); setEditingId(p.id); setEditDraft(toDraft(p)); }} />
                              <IconBtn label="מחיקה" icon="ti-trash" onClick={() => setToDelete({ id: p.id, name: `${pedTypeLabel(p.constraint_type)} – ${subjectName(p.subject_a_id)}` })} />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

        {toDelete && <ConfirmDeleteModal name={toDelete.name} onConfirm={handleDelete} onCancel={() => setToDelete(null)} />}
      </Card>
    </div>
  );
}

const B = ({ children }) => <b style={{ fontWeight: 500 }}>{children}</b>;

function describe(p, name) {
  const a = name(p.subject_a_id), b = name(p.subject_b_id);
  switch (p.constraint_type) {
    case 'max_per_day': return <>לכל היותר <B>{p.numeric_value}</B> שיעורי <B>{a}</B> ביום</>;
    case 'not_consecutive': return <><B>{a}</B> ו<B>{b}</B> לא בשיעורים צמודים</>;
    case 'min_gap': return p.subject_b_id === p.subject_a_id || !p.subject_b_id
      ? <>לפחות <B>{p.numeric_value ?? 0}</B> שיעורים בין שני שיעורי <B>{a}</B></>
      : <>לפחות <B>{p.numeric_value ?? 0}</B> שיעורים בין <B>{a}</B> ל<B>{b}</B></>;
    default: return <><B>{a}</B>{b ? <> ו<B>{b}</B></> : null}{p.numeric_value != null ? ` · ${p.numeric_value}` : ''}</>;
  }
}

// Each constraint type gets its own color, by its position in PEDAGOGICAL_TYPES — no two types share one.
const TYPE_COLORS = [
  ['#EDF4E8', '#3d6b2e'], // green
  ['#E6EDF6', '#33578f'], // blue
  ['#FFF1C7', '#76621a'], // yellow
  ['#F3E8F0', '#7a3f6b'], // plum
  ['#E2F1EF', '#2d6660'], // teal
  ['#FBEAE3', '#9a4a33'], // terracotta
  ['#ECEAF7', '#4f4a8a'], // lavender
  ['#F6EBDD', '#855423'], // caramel
  ['#FCE9EE', '#8e3a52'], // rose
  ['#ECEBE6', '#55503f'], // olive-grey
];
function typeColor(type) {
  const i = PEDAGOGICAL_TYPES.findIndex(pt => pt.value === type);
  return TYPE_COLORS[(i >= 0 ? i : PEDAGOGICAL_TYPES.length) % TYPE_COLORS.length];
}
function TypePill({ type }) {
  const [bg, fg] = typeColor(type);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'fit-content', whiteSpace: 'nowrap', fontSize: '12px', lineHeight: 1, background: bg, color: fg, borderRadius: '20px', padding: '6px 12px 4px' }}>
      {pedTypeLabel(type)}
    </span>
  );
}

// The fields read as a sentence, each sized to its content.
function ConstraintSentence({ draft, subjects, onChange }) {
  const t = draft.constraint_type;
  const text = { fontSize: '14px', color: C.muted };
  const subjectSelect = (key, placeholder, label) => (
    <select aria-label={label} value={draft[key]} onChange={e => onChange({ [key]: e.target.value })} style={fieldStyle('150px')}>
      <option value="">{placeholder}</option>
      {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
    </select>
  );
  const number = (label) => (
    <input type="number" min={t === 'min_gap' ? 0 : 1} aria-label={label} value={draft.numeric_value}
      onChange={e => onChange({ numeric_value: e.target.value })} style={numberStyle('60px')} placeholder={t === 'min_gap' ? '0' : '2'} />
  );
  const row = (children) => <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>{children}</div>;

  if (t === 'max_per_day') return row(<>
    <span style={text}>לכל היותר</span>{number('מספר שיעורים')}<span style={text}>שיעורי</span>
    {subjectSelect('subject_a_id', 'בחירת מקצוע', 'מקצוע')}<span style={text}>ביום</span>
  </>);
  if (t === 'not_consecutive') return row(<>
    {subjectSelect('subject_a_id', 'מקצוע ראשון', 'מקצוע ראשון')}<span style={text}>ו</span>
    {subjectSelect('subject_b_id', 'מקצוע שני', 'מקצוע שני')}<span style={text}>לא בשיעורים צמודים</span>
  </>);
  if (t === 'min_gap') return row(<>
    <span style={text}>לפחות</span>{number('מספר שיעורים')}<span style={text}>שיעורים בין</span>
    {subjectSelect('subject_a_id', 'מקצוע ראשון', 'מקצוע ראשון')}<span style={text}>ל</span>
    {subjectSelect('subject_b_id', 'אותו מקצוע', 'מקצוע שני')}
  </>);
  return row(<>
    {subjectSelect('subject_a_id', 'בחירת מקצוע', 'מקצוע')}
    {hasSecondSubject(t) && subjectSelect('subject_b_id', 'מקצוע שני', 'מקצוע שני')}
    {hasNumber(t) && number('ערך')}
  </>);
}

// ════════════════════════════════════════════════════════════════════════════
// תכנית לימודים
// ════════════════════════════════════════════════════════════════════════════
const MAX_HOURS = 15;
const DEBOUNCE_MS = 500;

const hoursMap = (rows) => Object.fromEntries((rows || []).map(r => [r.subject_id, r.weekly_hours]));
const sum = (obj) => Object.values(obj).reduce((a, b) => a + (Number(b) || 0), 0);

function CurriculumSection() {
  const [subjects, setSubjects] = useState([]);
  const [groups, setGroups] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  // server rows per class; the ref is the source of truth for persisting, the state re-renders chips
  const rowsRef = useRef({});
  const [rowsByGroup, setRowsByGroup] = useState({});
  const publishRows = () => setRowsByGroup({ ...rowsRef.current });

  const [selected, setSelected] = useState(null);
  const [hours, setHours] = useState({});            // { subject_id: hours } for the selected class
  const [blankStarted, setBlankStarted] = useState({}); // { group_id: true } — "start from an empty page" chosen
  const [copyOpen, setCopyOpen] = useState(false);
  const [copySrc, setCopySrc] = useState('');

  const { status, track } = useSaveTracker();
  const timers = useRef({});
  const chains = useRef({});

  useEffect(() => {
    Promise.all([getSubjects(), getStudentGroups(), getSchoolSettings().catch(() => ({ data: null }))])
      .then(async ([s, g, st]) => {
        setSubjects(s.data);
        setGroups(g.data);
        setSettings(st.data);
        const lists = await Promise.all(g.data.map(gr => getCurriculumByGroup(gr.id).then(r => r.data).catch(() => [])));
        g.data.forEach((gr, i) => { rowsRef.current[gr.id] = lists[i]; });
        publishRows();
        if (g.data.length) selectGroup(g.data[0]);
      })
      .finally(() => setLoading(false));
    return () => Object.values(timers.current).forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRef = useRef(null);
  const selectGroup = (g) => {
    selectedRef.current = g;
    setSelected(g);
    setHours(hoursMap(rowsRef.current[g.id]));
    setCopyOpen(false);
    setCopySrc('');
  };

  // Write one subject's hours for one class. Calls for the same pair run in order, never in parallel.
  const persist = useCallback((groupId, subjectId, value) => {
    const key = `${groupId}:${subjectId}`;
    const run = async () => {
      const rows = rowsRef.current[groupId] || [];
      const existing = rows.find(r => r.subject_id === subjectId);
      if (existing) {
        if (value <= 0) {
          await deleteCurriculumRequirement(existing.id);
          rowsRef.current[groupId] = rows.filter(r => r.id !== existing.id);
        } else if (existing.weekly_hours !== value) {
          await updateCurriculumRequirement(existing.id, { weekly_hours: value });
          rowsRef.current[groupId] = rows.map(r => r.id === existing.id ? { ...r, weekly_hours: value } : r);
        }
      } else if (value > 0) {
        const res = await createCurriculumRequirement({ subject_id: subjectId, student_group_id: groupId, weekly_hours: value });
        if (res?.data?.id) rowsRef.current[groupId] = [...rows, res.data];
        else rowsRef.current[groupId] = (await getCurriculumByGroup(groupId)).data;
      }
      publishRows();
    };
    const next = (chains.current[key] || Promise.resolve()).catch(() => { }).then(run);
    chains.current[key] = next;
    return track(next);
  }, [track]);

  // on failure, show what the server actually has
  const resync = async (groupId) => {
    try {
      rowsRef.current[groupId] = (await getCurriculumByGroup(groupId)).data;
      publishRows();
      if (selectedRef.current?.id === groupId) setHours(hoursMap(rowsRef.current[groupId]));
    } catch { /* keep local view */ }
  };

  const setHour = (subjectId, value) => {
    const groupId = selected.id;
    const v = Math.max(0, Math.min(MAX_HOURS, value));
    setHours(h => ({ ...h, [subjectId]: v }));
    const key = `${groupId}:${subjectId}`;
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => { persist(groupId, subjectId, v).catch(() => resync(groupId)); }, DEBOUNCE_MS);
  };

  const copyFrom = (srcId) => {
    const groupId = selected.id;
    const src = hoursMap(rowsRef.current[srcId]);
    const next = {};
    subjects.forEach(s => { next[s.id] = src[s.id] || 0; });
    setHours(next);
    setCopyOpen(false);
    const current = hoursMap(rowsRef.current[groupId]);
    Promise.all(subjects
      .filter(s => (current[s.id] || 0) !== next[s.id])
      .map(s => { clearTimeout(timers.current[`${groupId}:${s.id}`]); return persist(groupId, s.id, next[s.id]); }))
      .catch(() => resync(groupId));
  };

  if (loading) return <Quiet>טוען…</Quiet>;
  if (!groups.length) return <Quiet>אין כיתות במערכת. אפשר להוסיף כיתות בעמוד ״קבוצות״.</Quiet>;

  const withPlan = (g) => (rowsRef.current[g.id] || []).length > 0;
  const chipStatus = (g) => {
    const total = g.id === selected?.id ? sum(hours) : sum(hoursMap(rowsByGroup[g.id]));
    return total > 0 ? { text: `${total} שעות`, tone: 'done' } : { text: 'אין תכנית', tone: 'empty' };
  };

  const total = sum(hours);
  const isEmpty = selected && total === 0 && !withPlan(selected) && !blankStarted[selected.id];
  const taught = subjects.filter(s => (hours[s.id] || 0) > 0);
  const notTaught = subjects.filter(s => !(hours[s.id] > 0));

  // weekly ceiling from the day structure
  const grade = selected ? groupGrade(selected) : null;
  const lessonsPerDay = settings && grade ? computeDay(settings, grade).lessons : 0;
  const capacity = lessonsPerDay * (settings?.active_days?.length || 0);

  // copy sources: other classes that have a plan, parallel classes first
  const sources = groups
    .filter(g => g.id !== selected?.id && withPlan(g))
    .sort((a, b) => (gradeLetter(b) === gradeLetter(selected)) - (gradeLetter(a) === gradeLetter(selected)) || a.group_name.localeCompare(b.group_name, 'he'));
  const effectiveSrc = copySrc || (sources[0] ? String(sources[0].id) : '');
  const name = selected ? shortName(selected) : '';

  const copyControls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
      <span style={{ fontSize: '15px' }}>להעתיק את התכנית של כיתה</span>
      <select aria-label="כיתת מקור" value={effectiveSrc} onChange={e => setCopySrc(e.target.value)} style={{ ...fieldStyle('110px'), height: '46px', fontSize: '15px' }}>
        {sources.map(g => <option key={g.id} value={g.id}>{shortName(g)}</option>)}
      </select>
      <Btn size="lg" onClick={() => copyFrom(Number(effectiveSrc))} disabled={!effectiveSrc}>העתקה</Btn>
    </div>
  );

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ fontSize: '15px', color: C.muted, lineHeight: 1.6 }}>
        כאן קובעים כמה שעות בשבוע כל כיתה לומדת כל מקצוע. השינויים נשמרים מיד.
      </div>

      <Card>
        <CardTitle number={1} title="בחירת כיתה" />
        <ClassPicker groups={groups} selectedId={selected?.id} onSelect={selectGroup} status={chipStatus} large />
      </Card>

      {selected && (
        <Card>
          <CardTitle number={2} title={`השעות של כיתה ${name}`} aside={<SaveStatus status={status} />} />

          {isEmpty ? (
            <div style={{ background: C.cream, border: '1px dashed #D2C6B4', borderRadius: '14px', padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', textAlign: 'center' }}>
              <div style={{ fontSize: '18px' }}>לכיתה {name} עדיין אין תכנית לימודים</div>
              {sources.length > 0 ? (
                <>
                  <div style={{ fontSize: '14px', color: C.muted }}>הדרך הכי מהירה: להעתיק מכיתה מקבילה, ואז לתקן מה שצריך.</div>
                  {copyControls}
                  <Btn variant="neutral" onClick={() => setBlankStarted(b => ({ ...b, [selected.id]: true }))}>או להתחיל מדף ריק</Btn>
                </>
              ) : (
                <Btn size="lg" onClick={() => setBlankStarted(b => ({ ...b, [selected.id]: true }))}>התחלת תכנית חדשה</Btn>
              )}
            </div>
          ) : (
            <>
              <div style={{ background: C.cream, borderRadius: '12px', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '15px' }}>סה״כ <b style={{ fontSize: '20px', fontWeight: 600 }}>{total}</b> שעות בשבוע</span>
                  {capacity > 0 && (
                    <span style={{ fontSize: '13px', color: total > capacity ? C.warmText : C.muted }}>
                      {total > capacity
                        ? `יותר מדי – במערכת יש מקום רק ל־${capacity} שעות`
                        : `יש מקום ל־${capacity} · נשארו ${capacity - total}`}
                    </span>
                  )}
                </div>
                {capacity > 0 && <ProgressBar pct={(total / capacity) * 100} color={total > capacity ? C.warmBar : C.matcha} height={8} />}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '14px', color: C.muted, paddingBottom: '6px' }}>מקצועות שהכיתה לומדת</div>
                {taught.length === 0 && <div style={{ fontSize: '14px', color: C.soft, padding: '12px 0' }}>עדיין לא נבחרו מקצועות. לחיצה על מקצוע למטה מוסיפה אותו.</div>}
                {taught.map(s => {
                  const h = hours[s.id];
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 4px', borderBottom: `1px solid ${C.lineSoft}` }}>
                      <span style={{ flexGrow: 1, fontSize: '17px' }}>{s.subject_name}</span>
                      <RoundBtn label={`שעה אחת פחות ל${s.subject_name}`} icon="ti-minus" onClick={() => setHour(s.id, h - 1)} />
                      <span style={{ width: '92px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }} aria-live="polite">
                        <span style={{ fontSize: '24px', fontWeight: 600, lineHeight: 1.1 }}>{h}</span>
                        <span style={{ fontSize: '12px', color: C.soft }}>{h === 1 ? 'שעה בשבוע' : 'שעות בשבוע'}</span>
                      </span>
                      <RoundBtn label={`עוד שעה ל${s.subject_name}`} icon="ti-plus" primary disabled={h >= MAX_HOURS} onClick={() => setHour(s.id, h + 1)} />
                      <Btn variant="danger" size="sm" onClick={() => setHour(s.id, 0)} style={{ marginRight: '6px' }}>הסרה</Btn>
                    </div>
                  );
                })}
              </div>

              {notTaught.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '14px', color: C.muted }}>מקצועות שהכיתה לא לומדת · לחיצה מוסיפה</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {notTaught.map(s => (
                      <Btn key={s.id} variant="outline" onClick={() => setHour(s.id, 1)}
                        style={{ borderRadius: '20px', borderStyle: 'dashed', borderColor: C.pistache }}>
                        + {s.subject_name}
                      </Btn>
                    ))}
                  </div>
                </div>
              )}

              {sources.length > 0 && (
                <div style={{ borderTop: `1px solid ${C.lineSoft}`, paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {!copyOpen ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: C.muted }}>
                      <span>רוצים להתחיל מתכנית של כיתה אחרת?</span>
                      <Btn variant="neutral" size="sm" onClick={() => setCopyOpen(true)}>העתקה מכיתה אחרת</Btn>
                    </div>
                  ) : (
                    <div style={{ background: C.warmBg, borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontSize: '14px', color: C.warmText }}>שימו לב: השעות הנוכחיות של כיתה {name} יוחלפו.</div>
                      {copyControls}
                      <Btn variant="ghost" size="sm" onClick={() => setCopyOpen(false)}>ביטול</Btn>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}

function RoundBtn({ label, icon, onClick, primary, disabled }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      style={{
        width: 44, height: 44, flexShrink: 0, borderRadius: '50%', cursor: disabled ? 'default' : 'pointer', fontFamily: FONT,
        border: primary ? 'none' : '1px solid #D2C6B4', background: primary ? C.greenBg : '#fff', color: primary ? C.greenText : C.text,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1,
      }}>
      <i className={`ti ${icon}`} style={{ fontSize: '18px' }} aria-hidden="true"></i>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// שיוך מורים
// ════════════════════════════════════════════════════════════════════════════
function TeacherAssignmentsSection() {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loads, setLoads] = useState([]);
  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [teacherGrades, setTeacherGrades] = useState([]);
  const [rowsByGroup, setRowsByGroup] = useState({});

  const [view, setView] = useState('class');
  const [selected, setSelected] = useState(null);
  const [pickerRow, setPickerRow] = useState(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copySrc, setCopySrc] = useState('');
  const [notice, setNotice] = useState(null); // { tone, text }

  useEffect(() => {
    Promise.all([
      getStudentGroups(), getSubjects(), getTeachers(), getTeacherAssignments(),
      getTeacherLoads(), getAllTeacherSubjects(), getAllTeacherGradeLevels(),
    ]).then(async ([g, s, t, a, l, ts, tg]) => {
      setGroups(g.data); setSubjects(s.data); setTeachers(t.data); setAssignments(a.data);
      setLoads(l.data); setTeacherSubjects(ts.data); setTeacherGrades(tg.data);
      const lists = await Promise.all(g.data.map(gr => getCurriculumByGroup(gr.id).then(r => r.data).catch(() => [])));
      setRowsByGroup(Object.fromEntries(g.data.map((gr, i) => [gr.id, lists[i]])));
      const firstWithRows = g.data.find((gr, i) => lists[i].length > 0) || g.data[0];
      setSelected(firstWithRows || null);
    }).catch(() => setNotice({ tone: 'warm', text: 'טעינת הנתונים נכשלה. רעננו את הדף ונסו שוב.' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!notice || notice.tone === 'warm') return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  // ─── lookups ──────────────────────────────────────────────────────────────
  const rowById = useMemo(() => {
    const m = {};
    Object.entries(rowsByGroup).forEach(([gid, rows]) => rows.forEach(r => { m[r.id] = { ...r, group_id: Number(gid) }; }));
    return m;
  }, [rowsByGroup]);
  const groupById = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups]);
  const asgByRow = useMemo(() => Object.fromEntries(assignments.map(a => [a.cur_requirement_id, a])), [assignments]);

  const subjectName = (id) => subjects.find(s => s.id === id)?.subject_name || `#${id}`;
  const teacherById = (id) => teachers.find(t => t.id === id) || null;
  const loadFor = (tid) => loads.find(l => l.teacher_id === tid) || null;
  const isOver = (tid) => { const ld = loadFor(tid); return !!(ld && ld.has_quota && ld.remaining < 0); };

  // ─── writes ───────────────────────────────────────────────────────────────
  const refresh = async () => {
    const [a, l] = await Promise.all([getTeacherAssignments(), getTeacherLoads()]);
    setAssignments(a.data); setLoads(l.data);
  };

  const assignRow = async (rowId, teacherId) => {
    const existing = asgByRow[rowId];
    if (existing?.teacher_id === teacherId) return false;
    if (existing) await updateAssignment(existing.id, { teacher_id: teacherId, cur_requirement_id: rowId });
    else await createAssignment({ teacher_id: teacherId, cur_requirement_id: rowId });
    return true;
  };

  const copyAssignments = async (srcId) => {
    const src = Number(srcId);
    const srcRows = rowsByGroup[src] || [];
    const pairs = (rowsByGroup[selected.id] || [])
      .map(row => {
        const srcRow = srcRows.find(r => r.subject_id === row.subject_id);
        const srcAsg = srcRow && asgByRow[srcRow.id];
        return srcAsg ? [row.id, srcAsg.teacher_id] : null;
      })
      .filter(Boolean);
    try {
      let changed = 0;
      for (const [rowId, tid] of pairs) if (await assignRow(rowId, tid)) changed += 1;
      await refresh();
      setCopyOpen(false);
      setNotice({ tone: 'green', text: changed ? `הועתקו ${changed} שיוכים מכיתה ${shortName(groupById[src])}` : 'לא נמצאו שיוכים חדשים להעתקה' });
    } catch {
      await refresh().catch(() => { });
      setNotice({ tone: 'warm', text: 'ההעתקה נעצרה באמצע. מה שמוצג עכשיו הוא מה שנשמר בפועל.' });
    }
  };

  if (loading) return <Quiet>טוען…</Quiet>;
  if (!groups.length) return <Quiet>אין כיתות במערכת. אפשר להוסיף כיתות בעמוד ״קבוצות״.</Quiet>;

  // ─── summary ──────────────────────────────────────────────────────────────
  const allRows = Object.values(rowById);
  const assignedCount = allRows.filter(r => asgByRow[r.id]).length;
  const groupsWithRows = groups.filter(g => (rowsByGroup[g.id] || []).length > 0);
  const completeCount = groupsWithRows.filter(g => rowsByGroup[g.id].every(r => asgByRow[r.id])).length;
  const overCount = teachers.filter(t => isOver(t.id)).length;

  const chipStatus = (g) => {
    const rows = rowsByGroup[g.id] || [];
    if (!rows.length) return { text: 'אין תכנית', tone: 'empty' };
    const done = rows.filter(r => asgByRow[r.id]).length;
    return { text: `${done}/${rows.length}`, tone: done === rows.length ? 'done' : 'partial', pct: Math.round((done / rows.length) * 100) };
  };

  const rows = selected ? (rowsByGroup[selected.id] || []) : [];
  const missing = rows.filter(r => !asgByRow[r.id]).length;
  const copySources = groupsWithRows.filter(g => g.id !== selected?.id && rowsByGroup[g.id].some(r => asgByRow[r.id]));
  const effectiveCopySrc = copySrc || (copySources.find(g => gradeLetter(g) === gradeLetter(selected)) || copySources[0])?.id || '';

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <Card>
        <CardTitle
          title="שיוך מורים"
          hint="לכל מקצוע בכיתה – המורה שילמד אותו. האלגוריתם בונה את המערכת לפי השיוכים האלה."
          aside={
            <div role="tablist" style={{ display: 'flex', background: C.sand, borderRadius: '10px', padding: '4px', gap: '4px' }}>
              {[['class', 'לפי כיתה'], ['teacher', 'לפי מורה']].map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}
                  style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, padding: '10px 18px 6px', lineHeight: 1, borderRadius: '8px', fontSize: '13px', whiteSpace: 'nowrap', background: view === id ? '#fff' : 'transparent', color: view === id ? C.text : C.soft }}>
                  {label}
                </button>
              ))}
            </div>
          }
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px' }}>
          <Stat label="שיעורים משויכים" value={assignedCount} of={allRows.length}>
            <ProgressBar pct={allRows.length ? (assignedCount / allRows.length) * 100 : 0} />
          </Stat>
          <Stat label="כיתות שהושלמו" value={completeCount} of={groupsWithRows.length} />
          <Stat label="חריגות ממכסה" value={overCount} unit={overCount === 1 ? 'מורה' : 'מורים'} warm={overCount > 0} />
        </div>

        {notice && (
          <div role="status" style={{ fontSize: '14px', borderRadius: '10px', padding: '10px 14px', background: notice.tone === 'green' ? C.greenBg : C.warmBg, color: notice.tone === 'green' ? C.greenText : C.warmText }}>
            {notice.text}
          </div>
        )}

        {view === 'class' ? (
          <>
            <ClassPicker groups={groups} selectedId={selected?.id} onSelect={g => { setSelected(g); setCopyOpen(false); setCopySrc(''); }} status={chipStatus} />

            {selected && (
              <div style={TABLE_WRAP}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', padding: '12px 16px', background: C.cream, borderBottom: `1px solid ${C.line}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '17px', fontWeight: 500 }}>כיתה {shortName(selected)}</span>
                    <span style={{ fontSize: '13px', color: C.soft }}>{rows.length} מקצועות · {rows.reduce((x, r) => x + r.weekly_hours, 0)} ש׳ שבועיות</span>
                    {missing > 0 && <Pill tone="warm">{missing} לא משויכים</Pill>}
                  </div>
                  {copySources.length > 0 && rows.length > 0 && (
                    <Btn variant="neutral" size="sm" onClick={() => setCopyOpen(o => !o)}>
                      <i className="ti ti-copy" aria-hidden="true"></i> העתקה מכיתה אחרת
                    </Btn>
                  )}
                </div>

                {copyOpen && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '10px 16px', background: '#FDFBF8', borderBottom: `1px solid ${C.line}`, fontSize: '14px', color: C.muted }}>
                    <span>להעתיק את המורים של כיתה</span>
                    <select aria-label="כיתת מקור" value={effectiveCopySrc} onChange={e => setCopySrc(e.target.value)} style={fieldStyle('90px')}>
                      {copySources.map(g => <option key={g.id} value={g.id}>{shortName(g)}</option>)}
                    </select>
                    <Btn size="sm" onClick={() => copyAssignments(effectiveCopySrc)}>העתקה</Btn>
                    <Btn variant="ghost" size="sm" onClick={() => setCopyOpen(false)}>ביטול</Btn>
                  </div>
                )}

                {rows.length === 0 ? (
                  <Quiet>לכיתה הזו עדיין אין תכנית לימודים. קודם צריך למלא אותה בלשונית ״תכנית לימודים״.</Quiet>
                ) : (
                  <table style={TABLE}>
                    <thead>
                      <tr><th style={TH}>מקצוע</th><th style={TH}>שעות</th><th style={TH}>מורה</th><th style={TH} aria-label="עריכה"></th></tr>
                    </thead>
                    <tbody>
                      {rows.map(row => {
                        const asg = asgByRow[row.id];
                        const teacher = asg ? teacherById(asg.teacher_id) : null;
                        return (
                          <tr key={row.id} onClick={() => setPickerRow({ ...row, group_id: selected.id })} style={{ cursor: 'pointer' }}>
                            <td style={{ ...TD, fontSize: '15px' }}>{subjectName(row.subject_id)}</td>
                            <td style={{ ...TD, fontSize: '13px', color: C.soft }}>{row.weekly_hours} ש׳</td>
                            <td style={TD}>
                              {/* the click bubbles up to the row; the button makes it reachable by keyboard */}
                              <button type="button"
                                aria-label={`${subjectName(row.subject_id)} – ${teacher ? `${fullName(teacher)}, לחיצה לשינוי` : 'לא משויך, לחיצה לשיוך'}`}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: FONT, color: C.text }}>
                                {teacher ? (
                                  <>
                                    <Avatar t={teacher} />
                                    <span style={{ fontSize: '14px' }}>{fullName(teacher)}</span>
                                    {isOver(teacher.id) && <Pill tone="warm">חריגה ב־{Math.abs(loadFor(teacher.id).remaining)} ש׳</Pill>}
                                  </>
                                ) : (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', lineHeight: 1, color: C.green, border: `1px dashed ${C.pistache}`, borderRadius: '8px', padding: '9px 12px 6px' }}>
                                    <i className="ti ti-plus" aria-hidden="true"></i> שיוך מורה
                                  </span>
                                )}
                              </button>
                            </td>
                            <td style={{ ...TD, paddingInline: '8px', color: '#B5A898' }}>
                              {teacher && <i className="ti ti-pencil" style={{ fontSize: '17px' }} aria-hidden="true"></i>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        ) : (
          <TeacherView teachers={teachers} assignments={assignments} rowById={rowById} groupById={groupById} subjectName={subjectName} loadFor={loadFor} />
        )}
      </Card>

      {pickerRow && (
        <TeacherPicker
          row={pickerRow}
          group={groupById[pickerRow.group_id]}
          subjectName={subjectName(pickerRow.subject_id)}
          teachers={teachers}
          current={asgByRow[pickerRow.id] || null}
          loadFor={loadFor}
          prefersSubject={(tid) => teacherSubjects.some(x => x.teacher_id === tid && x.subject_id === pickerRow.subject_id)}
          prefersGrade={(tid) => { const gr = groupGrade(groupById[pickerRow.group_id]); return gr != null && teacherGrades.some(x => x.teacher_id === tid && x.grade_level === gr); }}
          parallels={groups
            .filter(g => g.id !== pickerRow.group_id && gradeLetter(g) === gradeLetter(groupById[pickerRow.group_id]))
            .map(g => ({ group: g, row: (rowsByGroup[g.id] || []).find(r => r.subject_id === pickerRow.subject_id) }))
            .filter(p => p.row)
            .map(p => ({ ...p, teacher: asgByRow[p.row.id] ? teacherById(asgByRow[p.row.id].teacher_id) : null }))}
          onAssign={async (teacherId, parallelRows) => {
            for (const rid of [pickerRow.id, ...parallelRows]) await assignRow(rid, teacherId);
            await refresh();
          }}
          onRemove={async () => {
            await deleteAssignment(asgByRow[pickerRow.id].id);
            await refresh();
          }}
          onClose={() => setPickerRow(null)}
        />
      )}
    </div>
  );
}

// ─── pieces ─────────────────────────────────────────────────────────────────
function Stat({ label, value, of, unit, warm, children }) {
  return (
    <div style={{ background: warm ? C.warmBg : C.cream, borderRadius: '12px', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ fontSize: '12px', color: warm ? C.warmText : C.soft }}>{label}</span>
      <span style={{ fontSize: '22px', color: warm ? C.warmText : C.text }}>
        {value}{' '}
        <span style={{ fontSize: '14px', color: warm ? C.warmText : C.soft }}>{of != null ? `מתוך ${of}` : unit}</span>
      </span>
      {children}
    </div>
  );
}

function Avatar({ t, size = 30 }) {
  const col = colorForTeacher(t.id);
  return (
    <span aria-hidden="true" style={{ width: size, height: size, flexShrink: 0, borderRadius: '50%', background: col.bg, color: col.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size > 30 ? '13px' : '12px', fontWeight: 600 }}>
      {initials(t)}
    </span>
  );
}

function TeacherView({ teachers, assignments, rowById, groupById, subjectName, loadFor }) {
  const list = [...teachers].sort(byName).map(t => {
    const mine = assignments.filter(a => a.teacher_id === t.id).map(a => rowById[a.cur_requirement_id]).filter(Boolean);
    const hours = mine.reduce((s, r) => s + r.weekly_hours, 0);
    const ld = loadFor(t.id);
    const quota = ld?.has_quota ? hours + ld.remaining : null;
    return { t, mine, hours, quota, over: quota != null && hours > quota };
  });

  if (list.length === 0) return <Quiet>אין מורים במערכת.</Quiet>;
  return (
    <div style={TABLE_WRAP}>
      <table style={TABLE}>
        <thead>
          <tr><th style={TH}>מורה</th><th style={TH}>עומס שבועי</th><th style={TH}>משויך/ת ל־</th></tr>
        </thead>
        <tbody>
          {list.map(({ t, mine, hours, quota, over }) => (
            <tr key={t.id}>
              <td style={TD}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Avatar t={t} size={32} />
                  <span style={{ fontSize: '14px' }}>{fullName(t)}</span>
                </span>
              </td>
              <td style={TD}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '120px' }}>
                  <span style={{ fontSize: '13px', color: over ? C.warmText : C.text }}>
                    {quota != null ? `${hours} / ${quota} ש׳${over ? ' · חריגה' : ''}` : `${hours} ש׳ · אין מכסה`}
                  </span>
                  {quota != null && <ProgressBar pct={quota ? (hours / quota) * 100 : 100} color={over ? C.warmBar : C.matcha} height={5} />}
                </span>
              </td>
              <td style={{ ...TD, whiteSpace: 'normal' }}>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '380px' }}>
                  {mine.length === 0
                    ? <span style={{ fontSize: '13px', color: C.soft }}>עדיין לא משויך/ת</span>
                    : mine.map(r => <Pill key={r.id}>{subjectName(r.subject_id)} · {shortName(groupById[r.group_id])}</Pill>)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeacherPicker({ row, group, subjectName, teachers, current, loadFor, prefersSubject, prefersGrade, parallels, onAssign, onRemove, onClose }) {
  const hours = row.weekly_hours;
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState(current?.teacher_id ?? null);
  const [applyParallel, setApplyParallel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const remaining = (tid) => { const ld = loadFor(tid); return ld?.has_quota ? ld.remaining : Infinity; };
  const q = query.trim();
  const scored = teachers
    .filter(t => !q || fullName(t).includes(q))
    .map(t => ({ t, ps: prefersSubject(t.id), pg: prefersGrade(t.id) }));
  const byFit = (a, b) => ((b.ps ? 2 : 0) + (b.pg ? 1 : 0)) - ((a.ps ? 2 : 0) + (a.pg ? 1 : 0)) || remaining(b.t.id) - remaining(a.t.id) || byName(a.t, b.t);
  const recommended = scored.filter(x => x.ps || x.pg).sort(byFit);
  const others = scored.filter(x => !x.ps && !x.pg).sort((a, b) => remaining(b.t.id) - remaining(a.t.id) || byName(a.t, b.t));

  const badge = (tid) => {
    const ld = loadFor(tid);
    if (!ld?.has_quota) return <Pill>אין מכסה</Pill>;
    const isCurrent = tid === current?.teacher_id;
    const rem = ld.remaining;
    const after = isCurrent ? rem : rem - hours;
    if (isCurrent && rem < 0) return <Pill tone="warm">חריגה ב־{-rem} ש׳</Pill>;
    if (after < 0) return <Pill tone="yellow">נותרו {Math.max(rem, 0)} · תהיה חריגה ב־{-after}</Pill>;
    return <Pill tone="green">נותרו {rem} ש׳</Pill>;
  };

  const run = async (fn) => {
    setBusy(true); setError('');
    try { await fn(); onClose(); }
    catch { setError('הפעולה נכשלה. נסו שוב.'); }
    finally { setBusy(false); }
  };

  const chosenTeacher = teachers.find(t => t.id === chosen);
  const unchanged = chosen === (current?.teacher_id ?? null) && !applyParallel;

  const item = ({ t, ps, pg }) => {
    const isCurrent = t.id === current?.teacher_id;
    const isChosen = t.id === chosen;
    return (
      <button key={t.id} type="button" aria-pressed={isChosen} onClick={() => setChosen(t.id)} disabled={busy}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', marginBottom: '2px', borderRadius: '12px',
          cursor: busy ? 'default' : 'pointer', fontFamily: FONT, textAlign: 'right', color: C.text,
          border: `1.5px solid ${isChosen ? C.matcha : 'transparent'}`, background: isChosen ? '#F5F8F2' : isCurrent ? C.cream : 'transparent',
        }}>
        <Avatar t={t} size={34} />
        <span style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '14px' }}>{fullName(t)}{isCurrent && <span style={{ fontSize: '12px', color: C.soft }}> · משויך/ת כעת</span>}</span>
          {(ps || pg) && (
            <span style={{ display: 'flex', gap: '6px' }}>
              {ps && <Pill tone="green">מקצוע</Pill>}
              {pg && <Pill tone="blue">שכבה</Pill>}
            </span>
          )}
        </span>
        {badge(t.id)}
        {isChosen && <i className="ti ti-check" style={{ color: C.matcha, fontSize: '18px' }} aria-hidden="true"></i>}
      </button>
    );
  };

  const parallelNames = parallels.map(p => shortName(p.group)).join(', ');

  return (
    <Modal title={`בחירת מורה · ${subjectName}`} subtitle={`כיתה ${shortName(group)} · ${hours} שעות שבועיות`} width="560px" maxHeight="86vh" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', border: `1px solid ${C.field}`, borderRadius: '10px', padding: '0 12px', height: '42px', background: C.cream }}>
          <i className="ti ti-search" style={{ color: C.soft }} aria-hidden="true"></i>
          <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="חיפוש מורה…" aria-label="חיפוש מורה"
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '14px', flexGrow: 1, fontFamily: FONT, color: C.text }} />
        </label>

        {error && <div role="alert" style={{ fontSize: '13px', color: C.warmText, background: C.warmBg, borderRadius: '8px', padding: '8px 12px' }}>{error}</div>}

        <div style={{ maxHeight: '46vh', overflowY: 'auto', margin: '0 -6px', padding: '0 6px' }}>
          {recommended.length > 0 && (
            <>
              <div style={{ fontSize: '12px', color: '#5f7550', fontWeight: 500, padding: '4px 4px 6px' }}>מומלצים · מלמדים מקצוע או שכבה זו</div>
              {recommended.map(item)}
            </>
          )}
          {others.length > 0 && (
            <>
              <div style={{ fontSize: '12px', color: C.soft, fontWeight: 500, padding: '12px 4px 6px', borderTop: recommended.length ? `1px solid ${C.lineSoft}` : 'none', marginTop: recommended.length ? '6px' : 0 }}>
                {recommended.length ? 'שאר המורים · לפי שעות פנויות' : 'כל המורים · לפי שעות פנויות'}
              </div>
              {others.map(item)}
            </>
          )}
          {!recommended.length && !others.length && <Quiet>לא נמצא מורה בשם הזה.</Quiet>}
        </div>

        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {parallels.length > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
              <input type="checkbox" checked={applyParallel} onChange={e => setApplyParallel(e.target.checked)} style={{ width: 18, height: 18, accentColor: C.matcha }} />
              <span>
                להחיל גם על {parallelNames}
                <span style={{ color: C.soft, fontSize: '13px' }}>
                  {' '}({parallels.map(p => `${shortName(p.group)}: ${p.teacher ? fullName(p.teacher) : 'לא משויך'}`).join(' · ')})
                </span>
              </span>
            </label>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            {current ? (
              <Btn variant="danger" size="sm" disabled={busy} onClick={() => run(onRemove)}>
                <i className="ti ti-trash" aria-hidden="true"></i> הסרת השיוך
              </Btn>
            ) : <span />}
            <div style={{ display: 'flex', gap: '8px' }}>
              <Btn variant="neutral" disabled={busy} onClick={onClose}>ביטול</Btn>
              <Btn disabled={busy || !chosen || unchanged}
                onClick={() => run(() => onAssign(chosen, applyParallel ? parallels.map(p => p.row.id) : []))}>
                {busy ? 'שומר…' : chosenTeacher ? `שיוך ${fullName(chosenTeacher)}` : 'שיוך'}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// רכיבים ועזרים משותפים
// ════════════════════════════════════════════════════════════════════════════
// ─── palette ────────────────────────────────────────────────────────────────
const C = {
  text: '#4a3f35',
  muted: '#6f6156',
  soft: '#7a6a5e',
  line: '#EDE6DB',
  lineSoft: '#F0EBE3',
  field: '#E2DACC',
  cream: '#FAF7F2',
  sand: '#F5F2EC',
  green: '#5f7550',        // filled buttons (white text passes contrast)
  matcha: '#809671',       // accents, bars
  greenBg: '#EDF4E8',
  greenText: '#3d6b2e',
  pistache: '#B3B792',
  warmBg: '#FBF1EC',
  warmText: '#9a5540',
  warmBar: '#C0705A',
  yellowBg: '#FFF4CC',
  yellowText: '#7d6a1e',
  blueBg: '#E6EDF6',
  blueText: '#33578f',
  chai: '#D2AB80',
};

// Lesson length used for the day preview and the weekly-hours ceiling.
const LESSON_MINUTES = 45;

// ─── class helpers ──────────────────────────────────────────────────────────
// grade letter (א-ו) from a name like "כיתה ב1" — "כיתה" is removed first so its ה is not matched.
function gradeLetter(group) {
  return group.group_name.replace(/כיתה\s*/g, '').match(/([א-ו])/)?.[1] || null;
}

// grade number 1-6, or null
function groupGrade(group) {
  const idx = GRADE_LETTERS.indexOf(gradeLetter(group));
  return idx >= 0 ? idx + 1 : null;
}

// [{ letter: 'א', groups: [...] }, ...] in grade order, "אחר" last
function groupsByGrade(groups) {
  const map = {};
  groups.forEach(g => {
    const k = gradeLetter(g) || 'אחר';
    (map[k] = map[k] || []).push(g);
  });
  const order = [...GRADE_LETTERS, 'אחר'];
  return Object.keys(map)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map(letter => ({ letter, groups: map[letter].sort((a, b) => a.group_name.localeCompare(b.group_name, 'he')) }));
}

const shortName = (group) => group.group_name.replace(/כיתה\s*/g, '').trim();

// ─── day math ───────────────────────────────────────────────────────────────
const toMin = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// Lessons and breaks that fit between the start time and the grade's end time.
// Clock times of every break, assuming the day runs long enough to reach it.
function breakSchedule(settings) {
  const start = toMin(settings?.start_time);
  if (start == null) return [];
  const sorted = [...(settings.breaks || [])].sort((a, b) => a.after_lesson - b.after_lesson);
  let before = 0; // minutes of earlier breaks
  return sorted.map(b => {
    const from = start + b.after_lesson * LESSON_MINUTES + before;
    before += b.duration_minutes;
    return { ...b, from: toHHMM(from), to: toHHMM(from + b.duration_minutes) };
  });
}

function computeDay(settings, grade) {
  const start = toMin(settings?.start_time);
  const end = toMin(settings?.grade_end_times?.[String(grade)]);
  if (start == null || end == null || end <= start) return { segments: [], lessons: 0 };
  const breaks = [...(settings.breaks || [])].sort((a, b) => a.after_lesson - b.after_lesson);
  const segments = [];
  let t = start, n = 0;
  while (t + LESSON_MINUTES <= end) {
    n += 1;
    segments.push({ kind: 'lesson', n, minutes: LESSON_MINUTES, from: toHHMM(t) });
    t += LESSON_MINUTES;
    const br = breaks.find(b => b.after_lesson === n);
    if (br && t + br.duration_minutes + LESSON_MINUTES <= end) {
      segments.push({ kind: 'break', minutes: br.duration_minutes, from: toHHMM(t) });
      t += br.duration_minutes;
    }
  }
  return { segments, lessons: n, endsAt: toHHMM(t) };
}

function lessonsBetween(settings, endStr) {
  const start = toMin(settings?.start_time);
  const end = toMin(endStr);
  if (start == null || end == null || end <= start) return 0;
  const breaks = [...(settings.breaks || [])].sort((a, b) => a.after_lesson - b.after_lesson);
  let t = start, n = 0;
  while (t + LESSON_MINUTES <= end) {
    n += 1; t += LESSON_MINUTES;
    const br = breaks.find(b => b.after_lesson === n);
    if (br && t + br.duration_minutes + LESSON_MINUTES <= end) t += br.duration_minutes;
  }
  return n;
}

// ─── save tracking ──────────────────────────────────────────────────────────
// track(promise) → status goes 'saving' while anything is pending, then 'saved' or 'error'.
function useSaveTracker() {
  const [status, setStatus] = useState('idle');
  const pending = useRef(0);
  const failed = useRef(false);
  const track = useCallback((promise) => {
    pending.current += 1;
    setStatus('saving');
    return Promise.resolve(promise)
      .catch(err => { failed.current = true; throw err; })
      .finally(() => {
        pending.current -= 1;
        if (pending.current === 0) {
          setStatus(failed.current ? 'error' : 'saved');
          failed.current = false;
        }
      });
  }, []);
  return { status, track };
}

function SaveStatus({ status }) {
  if (status === 'idle') return null;
  const map = {
    saving: { bg: C.sand, fg: C.soft, text: 'שומר…' },
    saved: { bg: C.greenBg, fg: C.greenText, text: '✓ נשמר אוטומטית' },
    error: { bg: C.warmBg, fg: C.warmText, text: 'השמירה נכשלה – בדקו את החיבור ונסו שוב' },
  }[status];
  return (
    <span role="status" style={{ width: 'fit-content', whiteSpace: 'nowrap', fontSize: '13px', background: map.bg, color: map.fg, borderRadius: '20px', padding: '5px 14px' }}>
      {map.text}
    </span>
  );
}

// ─── primitives ─────────────────────────────────────────────────────────────
const BTN = {
  primary: { background: C.green, color: '#fff', border: `1px solid ${C.green}` },
  outline: { background: '#fff', color: C.green, border: `1px solid ${C.matcha}` },
  neutral: { background: '#fff', color: C.text, border: `1px solid ${C.field}` },
  ghost: { background: 'transparent', color: C.text, border: '1px solid transparent' },
  danger: { background: 'transparent', color: C.warmText, border: '1px solid transparent' },
};
// Hebrew glyphs sit high in the line box, so the top padding is a bit larger than the bottom.
const SIZE = {
  sm: { fontSize: '13px', padding: '8px 14px 5px', minHeight: '34px', borderRadius: '8px' },
  md: { fontSize: '14px', padding: '10px 18px 7px', minHeight: '40px', borderRadius: '10px' },
  lg: { fontSize: '15px', padding: '12px 22px 9px', minHeight: '46px', borderRadius: '10px' },
};

// Button that is exactly as wide as its text.
function Btn({ variant = 'primary', size = 'md', disabled, style, children, ...rest }) {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        width: 'fit-content', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        textAlign: 'center', whiteSpace: 'nowrap', lineHeight: 1, fontFamily: FONT, cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1, ...BTN[variant], ...SIZE[size], ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

function IconBtn({ label, icon, onClick, size = 36, style }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      style={{ width: size, height: size, flexShrink: 0, border: 'none', borderRadius: '8px', background: 'transparent', color: '#9a8a7e', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}>
      <i className={`ti ${icon}`} style={{ fontSize: '17px' }} aria-hidden="true"></i>
    </button>
  );
}

const fieldStyle = (width) => ({
  width, height: '40px', boxSizing: 'border-box', padding: '0 10px', fontFamily: FONT, fontSize: '14px',
  color: C.text, background: '#fff', border: `1px solid ${C.field}`, borderRadius: '8px',
  textAlign: 'center', textAlignLast: 'center', cursor: 'pointer',
});
const numberStyle = (width = '64px') => ({ ...fieldStyle(width), padding: '0 4px', cursor: 'text' });
// width auto → the clock icon sits right next to the time instead of at the far edge
const timeStyle = { ...fieldStyle('auto'), direction: 'ltr', padding: '0 8px', cursor: 'text' };

const hhmm = (v) => (v || '').slice(0, 5); // server may send "08:00:00"

// tables are only as wide as their content
const TABLE_WRAP = { width: 'fit-content', maxWidth: '100%', margin: '0 auto', border: `1px solid ${C.line}`, borderRadius: '14px', overflow: 'hidden', background: '#fff' };
const TABLE = { borderCollapse: 'collapse', width: '100%' };
const TH = { padding: '10px 16px', fontSize: '12px', fontWeight: 400, color: C.soft, textAlign: 'right', whiteSpace: 'nowrap', background: C.cream, borderBottom: `1px solid ${C.line}` };
const TD = { padding: '10px 16px', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap', color: C.text, borderBottom: `1px solid ${C.lineSoft}` };

// small global fixes, scoped to this screen
const SS_CSS = `
  .ss-root input[type="number"]::-webkit-inner-spin-button,
  .ss-root input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  .ss-root input[type="number"] { -moz-appearance: textfield; }
  .ss-root input[type="time"]::-webkit-datetime-edit { padding: 0; }
  .ss-root input[type="time"]::-webkit-calendar-picker-indicator { margin-left: 6px; }
  .ss-root tbody tr:last-child td { border-bottom: none; }
  .ss-root tbody tr[style*="pointer"]:hover td { background: #FAF7F2; }
`;

function Card({ children, style }) {
  return (
    <section style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: '16px', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '18px', ...style }}>
      {children}
    </section>
  );
}

function CardTitle({ title, hint, number, aside }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {number != null && (
          <span style={{ width: 32, height: 32, borderRadius: '50%', background: C.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 600, flexShrink: 0 }}>{number}</span>
        )}
        <div>
          <div style={{ fontSize: '18px', fontWeight: 500, color: C.text }}>{title}</div>
          {hint && <div style={{ fontSize: '13px', color: C.soft, marginTop: '2px' }}>{hint}</div>}
        </div>
      </div>
      {aside}
    </div>
  );
}

const Label = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} style={{ fontSize: '14px', fontWeight: 500, color: C.text }}>{children}</label>
);

function Pill({ tone = 'neutral', children }) {
  const t = {
    neutral: [C.sand, C.muted], green: [C.greenBg, C.greenText], warm: [C.warmBg, C.warmText],
    yellow: [C.yellowBg, C.yellowText], blue: [C.blueBg, C.blueText],
  }[tone];
  return <span style={{ display: 'inline-flex', alignItems: 'center', width: 'fit-content', whiteSpace: 'nowrap', fontSize: '12px', lineHeight: 1, background: t[0], color: t[1], borderRadius: '20px', padding: '6px 11px 4px' }}>{children}</span>;
}

function ProgressBar({ pct, color = C.matcha, height = 6 }) {
  return (
    <div style={{ height, background: '#EAE3D8', borderRadius: height, overflow: 'hidden', width: '100%' }}>
      <div style={{ height, width: `${Math.max(0, Math.min(100, pct))}%`, background: color, borderRadius: height, transition: 'width .25s' }} />
    </div>
  );
}

// Class picker grouped by grade.
// status(group) → { text, tone: 'done' | 'partial' | 'empty', pct? }
function ClassPicker({ groups, selectedId, onSelect, status, large = false }) {
  const grades = groupsByGrade(groups);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(grades.length, 1)}, minmax(0, 1fr))`, gap: '12px' }}>
      {grades.map(({ letter, groups: gs }) => (
        <div key={letter} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: C.soft }}>שכבה {letter}</span>
          {gs.map(g => {
            const sel = g.id === selectedId;
            const s = status(g);
            const border = sel ? C.green : s.tone === 'empty' ? '#E8C9BC' : s.tone === 'done' ? '#C9D8BE' : C.field;
            return (
              <button key={g.id} type="button" aria-pressed={sel} onClick={() => onSelect(g)}
                style={{
                  width: large ? '100px' : '92px', minHeight: large ? '60px' : '54px', cursor: 'pointer', fontFamily: FONT,
                  borderRadius: '12px', border: `2px solid ${border}`, background: sel ? C.green : '#fff', color: sel ? '#fff' : C.text,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', padding: '6px 8px', textAlign: 'center',
                }}>
                <span style={{ fontSize: large ? '18px' : '16px', fontWeight: 500 }}>{shortName(g)}</span>
                <span style={{ fontSize: '11px', color: sel ? '#EAF1E4' : s.tone === 'empty' ? C.warmText : C.soft }}>{s.text}</span>
                {s.pct != null && (
                  <span style={{ width: '100%', height: 4, borderRadius: 4, background: sel ? 'rgba(255,255,255,.3)' : '#EFE9DF', overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: 4, width: `${s.pct}%`, background: sel ? '#fff' : s.tone === 'done' ? C.matcha : C.chai }} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Centered message for loading / empty states.
const Quiet = ({ children }) => (
  <div style={{ textAlign: 'center', color: C.soft, padding: '40px 20px', fontSize: '14px' }}>{children}</div>
);
