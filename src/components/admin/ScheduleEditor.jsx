import { useState, useEffect, useMemo, Fragment } from 'react';
import {
    getTimeslots, getMyConstraints,
    previewScheduleViolations, saveScheduleEdits,
} from '../../services/api';

const DAY_NAMES = { 1: 'ראשון', 2: 'שני', 3: 'שלישי', 4: 'רביעי', 5: 'חמישי', 6: 'שישי' };
const DAY_ORDER = [1, 2, 3, 4, 5, 6];
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8];

const PALETTE = [
    { bg: '#CDE7D8', accent: '#4f9c73' }, { bg: '#D6E4F5', accent: '#4f7fc2' },
    { bg: '#F6DCC9', accent: '#c98a4b' }, { bg: '#E7D8F2', accent: '#9068b8' },
    { bg: '#F5D8DF', accent: '#c25c7c' }, { bg: '#D9EDEA', accent: '#3f9e8f' },
    { bg: '#F2E6C9', accent: '#b3922e' }, { bg: '#DADEF2', accent: '#5f68c2' },
];
function hashString(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h;
}
function colorFor(e) {
    const key = e.subject_id != null ? String(e.subject_id) : (e.subject_name || '');
    return PALETTE[hashString(key) % PALETTE.length];
}
const slotLabel = (e) => `יום ${DAY_NAMES[e.day_of_week] || e.day_of_week} · שעה ${e.hour_of_day}`;
const btn = (bg, color, extra = {}) => ({
    padding: '10px 18px', fontSize: '14px', border: '1px solid #e2dacc', borderRadius: '10px',
    cursor: 'pointer', fontFamily: 'Varela Round, sans-serif', backgroundColor: bg, color, ...extra,
});

export default function ScheduleEditor({ initialEntries, runId, onFinish, onCancel }) {
    // Deep-copied working copy of the FULL schedule (all classes), so cross-class
    // conflicts (a teacher double-booked across two classes) are detectable and
    // the save writes the whole run — even if only one class is displayed.
    const [entries, setEntries] = useState(() => initialEntries.map(e => ({ ...e })));
    const [past, setPast] = useState([]);
    const [future, setFuture] = useState([]);

    const [tsMap, setTsMap] = useState(null);        // "day-hour" -> timeslot_id
    const [hardCant, setHardCant] = useState(new Set()); // "teacher_id-timeslot_id"

    const [selectedClasses, setSelectedClasses] = useState([]);
    const [occMenu, setOccMenu] = useState(null);    // occupied-cell menu
    const [altsFor, setAltsFor] = useState(null);    // 'source' | 'occupant' | null
    const [dragId, setDragId] = useState(null);

    const [previewViols, setPreviewViols] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [draftFound, setDraftFound] = useState(false);

    const draftKey = `scheduleEditDraft:${runId}`;

    // Load reference data (timeslots + all hard constraints) once.
    useEffect(() => {
        getTimeslots().then(r => {
            const m = {};
            (r.data || []).forEach(t => { m[`${t.day_of_week}-${t.hour_of_day}`] = t.id; });
            setTsMap(m);
        }).catch(() => setTsMap({}));
        getMyConstraints().then(r => {
            const s = new Set();
            (r.data || []).forEach(c => {
                if (c.constraint_type === 'hard') s.add(`${c.teacher_id}-${c.timeslot_id}`);
            });
            setHardCant(s);
        }).catch(() => { });
        // Offer to restore an unsaved draft from a previous edit session.
        try {
            const raw = localStorage.getItem(draftKey);
            if (raw) setDraftFound(true);
        } catch { /* ignore */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const dirty = useMemo(
        () => JSON.stringify(entries) !== JSON.stringify(initialEntries),
        [entries, initialEntries]
    );

    // Persist a draft on every change; warn before leaving with unsaved work.
    useEffect(() => {
        if (dirty) { try { localStorage.setItem(draftKey, JSON.stringify(entries)); } catch { /* */ } }
        const warn = (ev) => { if (dirty) { ev.preventDefault(); ev.returnValue = ''; } };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [entries, dirty, draftKey]);

    const tsId = (day, hour) => (tsMap ? tsMap[`${day}-${hour}`] : undefined);

    const classNames = useMemo(
        () => [...new Set(entries.map(e => e.group_name))].filter(Boolean)
            .sort((a, b) => a.localeCompare(b, 'he')),
        [entries]
    );

    // ---- live conflict detection over the full working copy ----
    const conflicts = useMemo(() => {
        const bySlot = {};
        entries.forEach(e => { (bySlot[e.timeslot_id] = bySlot[e.timeslot_id] || []).push(e); });
        const items = [];
        Object.values(bySlot).forEach(list => {
            const label = slotLabel(list[0]);
            const group = (keyFn) => {
                const m = {};
                list.forEach(e => { const k = keyFn(e); if (k != null) (m[k] = m[k] || []).push(e); });
                return Object.values(m).filter(g => g.length > 1);
            };
            group(e => e.teacher_id).forEach(g => items.push({
                kind: 'teacher', detail: `${g[0].teacher_first_name} ${g[0].teacher_last_name}: ${g.length} שיעורים ב${label}`,
            }));
            group(e => e.group_id).forEach(g => items.push({
                kind: 'group', detail: `${g[0].group_name}: ${g.length} שיעורים ב${label}`,
            }));
            group(e => (e.room_id != null ? e.room_id : null)).forEach(g => items.push({
                kind: 'room', detail: `${g[0].room_name || 'חדר'}: ${g.length} שיעורים ב${label}`,
            }));
        });
        return items;
    }, [entries]);

    const constraintWarnings = useMemo(
        () => entries.filter(e => hardCant.has(`${e.teacher_id}-${e.timeslot_id}`))
            .map(e => `${e.teacher_first_name} ${e.teacher_last_name}: משובץ/ת ב"לא יכול" (${slotLabel(e)}, ${e.group_name})`),
        [entries, hardCant]
    );

    const blocking = conflicts.length > 0;

    // ---- mutation with undo/redo ----
    const commit = (next) => { setPast(p => [...p, entries]); setFuture([]); setEntries(next); };
    const undo = () => { if (!past.length) return; setFuture(f => [entries, ...f]); setEntries(past[past.length - 1]); setPast(past.slice(0, -1)); };
    const redo = () => { if (!future.length) return; setPast(p => [...p, entries]); setEntries(future[0]); setFuture(future.slice(1)); };

    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const moveEntry = (id, ts, day, hour) =>
        entries.map(e => (e.id === id ? { ...e, timeslot_id: ts, day_of_week: day, hour_of_day: hour } : e));

    const applyMove = (id, ts, day, hour) => commit(moveEntry(id, ts, day, hour));

    const cellFor = (cls, day, hour) =>
        entries.filter(e => e.group_name === cls && e.day_of_week === day && e.hour_of_day === hour);

    // ---- drag & drop ----
    const onDrop = (cls, day, hour) => {
        const id = dragId;
        setDragId(null);
        if (id == null) return;
        const src = entries.find(e => e.id === id);
        if (!src || src.group_name !== cls) return;      // move only within its own class grid
        const ts = tsId(day, hour);
        if (ts == null) return;                           // invalid slot (e.g. Fri >4)
        if (src.timeslot_id === ts) return;
        const occupants = cellFor(cls, day, hour).filter(e => e.id !== id);
        if (occupants.length === 0) { applyMove(id, ts, day, hour); return; }
        setAltsFor(null);
        setOccMenu({ srcId: id, occId: occupants[0].id, ts, day, hour });
    };

    // ---- occupied-cell actions ----
    const doSwap = () => {
        const { srcId, occId, ts, day, hour } = occMenu;
        const src = entries.find(e => e.id === srcId);
        let next = moveEntry(srcId, ts, day, hour);
        next = next.map(e => (e.id === occId
            ? { ...e, timeslot_id: src.timeslot_id, day_of_week: src.day_of_week, hour_of_day: src.hour_of_day } : e));
        commit(next); setOccMenu(null);
    };
    const doPlaceTogether = () => {
        const { srcId, ts, day, hour } = occMenu;
        applyMove(srcId, ts, day, hour); setOccMenu(null);   // creates an overlap -> shows in the conflict list
    };
    const validAltsFor = (entry) => {
        if (!entry || !tsMap) return [];
        const out = [];
        DAY_ORDER.forEach(day => HOURS.forEach(hour => {
            const ts = tsId(day, hour);
            if (ts == null || ts === entry.timeslot_id) return;
            const classBusy = entries.some(e => e.group_id === entry.group_id && e.timeslot_id === ts && e.id !== entry.id);
            const teacherBusy = entries.some(e => e.teacher_id === entry.teacher_id && e.timeslot_id === ts && e.id !== entry.id);
            const cant = hardCant.has(`${entry.teacher_id}-${ts}`);
            if (!classBusy && !teacherBusy && !cant) out.push({ ts, day, hour });
        }));
        return out;
    };
    const chooseAltForSource = (alt) => { applyMove(occMenu.srcId, alt.ts, alt.day, alt.hour); setOccMenu(null); };
    const chooseAltForOccupant = (alt) => {
        const { srcId, occId, ts, day, hour } = occMenu;
        let next = moveEntry(occId, alt.ts, alt.day, alt.hour);   // occupant leaves
        next = next.map(e => (e.id === srcId ? { ...e, timeslot_id: ts, day_of_week: day, hour_of_day: hour } : e)); // source takes the cell
        commit(next); setOccMenu(null);
    };

    // ---- finish / cancel / preview ----
    const payload = () => entries.map(e => ({
        tea_assignment_id: e.tea_assignment_id, timeslot_id: e.timeslot_id, room_id: e.room_id ?? null,
    }));
    const finish = async () => {
        if (blocking) return;
        setSaving(true); setSaveError('');
        try {
            await saveScheduleEdits(runId, payload());
            try { localStorage.removeItem(draftKey); } catch { /* */ }
            onFinish();
        } catch (e) { setSaveError('שמירה נכשלה. נסי שוב.'); setSaving(false); }
    };
    const cancel = () => {
        if (dirty && !window.confirm('לצאת בלי לשמור? השינויים יאבדו.')) return;
        try { localStorage.removeItem(draftKey); } catch { /* */ }
        onCancel();
    };
    const reDetect = async () => {
        try {
            const r = await previewScheduleViolations(payload());
            setPreviewViols(r.data.violations || []); setShowPreview(true);
        } catch { setPreviewViols([]); setShowPreview(true); }
    };
    const restoreDraft = () => {
        try {
            const raw = localStorage.getItem(draftKey);
            if (raw) setEntries(JSON.parse(raw));
        } catch { /* */ }
        setDraftFound(false);
    };

    const occSrc = occMenu ? entries.find(e => e.id === occMenu.srcId) : null;
    const occTgt = occMenu ? entries.find(e => e.id === occMenu.occId) : null;

    return (
        <div dir="rtl">
            {/* toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <h2 style={{ fontSize: '18px', color: '#4a3f35', margin: 0, marginLeft: 'auto' }}>עריכת מערכת שעות</h2>
                <button onClick={undo} disabled={!past.length} style={btn('#fff', '#4a3f35', { opacity: past.length ? 1 : 0.4 })}>↶ בטל</button>
                <button onClick={redo} disabled={!future.length} style={btn('#fff', '#4a3f35', { opacity: future.length ? 1 : 0.4 })}>↷ בצע שוב</button>
                <button onClick={reDetect} style={btn('#EDF4E8', '#4a7c3f')}>זיהוי הפרות מחודש</button>
                <button onClick={cancel} style={btn('#fff', '#8a7a6e')}>ביטול</button>
                <button onClick={finish} disabled={blocking || saving}
                    style={btn(blocking || saving ? '#cdd6c4' : '#6b8f5e', '#fff',
                        { border: 'none', cursor: blocking || saving ? 'not-allowed' : 'pointer' })}>
                    {saving ? 'שומר…' : 'סיום עריכת מערכת שעות'}
                </button>
            </div>

            {saveError && <div style={{ color: '#c0705a', fontSize: '13px', marginBottom: '10px' }}>{saveError}</div>}

            {draftFound && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#FFF3D6', border: '1px solid #e8d9a8', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: '#8a6d1e' }}>
                    <span style={{ flex: 1 }}>נמצאה טיוטה לא שמורה מעריכה קודמת.</span>
                    <button onClick={restoreDraft} style={btn('#fff', '#4a7c3f', { padding: '6px 12px', fontSize: '13px' })}>שחזר</button>
                    <button onClick={() => { try { localStorage.removeItem(draftKey); } catch { /* */ } setDraftFound(false); }} style={btn('#fff', '#8a7a6e', { padding: '6px 12px', fontSize: '13px' })}>התעלם</button>
                </div>
            )}

            {blocking && (
                <div style={{ backgroundColor: '#FAE8E8', border: '1px solid #f0c7c0', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#8a3a2c' }}>
                    לא ניתן לסיים — יש {conflicts.length} התנגשויות פעילות. פתרו אותן כדי לשמור.
                </div>
            )}

            <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-start' }}>
                {/* main editing area */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* class chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '14px' }}>
                        {classNames.map(c => {
                            const on = selectedClasses.includes(c);
                            return (
                                <button key={c} onClick={() => setSelectedClasses(p => on ? p.filter(x => x !== c) : [...p, c])}
                                    style={btn(on ? '#8a9e78' : '#f5f2ee', on ? '#fff' : '#8a7a6e', { padding: '7px 14px', fontSize: '13px', border: 'none' })}>
                                    {c}
                                </button>
                            );
                        })}
                    </div>

                    {selectedClasses.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px', fontSize: '14px', border: '1px dashed #d8d0c0', borderRadius: '12px' }}>
                            בחרי כיתה אחת או יותר לעריכה. אפשר להציג כמה כיתות במקביל.
                        </div>
                    ) : selectedClasses.map(cls => (
                        <div key={cls} style={{ marginBottom: '22px' }}>
                            <h3 style={{ fontSize: '15px', color: '#4a3f35', margin: '0 0 10px' }}>{cls}</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: '58px', border: '1px solid #e2dacc', padding: '8px', backgroundColor: '#EDF4E8', fontSize: '12px', color: '#4a3f35' }}>שעה</th>
                                            {DAY_ORDER.map(d => (
                                                <th key={d} style={{ border: '1px solid #e2dacc', padding: '8px', backgroundColor: '#EDF4E8', fontSize: '13px', color: '#4a3f35' }}>{DAY_NAMES[d]}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {HOURS.map(hour => (
                                            <tr key={hour}>
                                                <td style={{ border: '1px solid #f0ebe3', padding: '6px', textAlign: 'center', color: '#c8baa6', fontSize: '12px', backgroundColor: '#FAF7F2' }}>שיעור {hour}</td>
                                                {DAY_ORDER.map(day => {
                                                    if (day === 6 && hour > 4) {
                                                        return <td key={day} style={{ border: '1px solid #f0ebe3', background: 'repeating-linear-gradient(135deg,#f5f2ee,#f5f2ee 6px,#efece6 6px,#efece6 12px)' }} />;
                                                    }
                                                    const lessons = cellFor(cls, day, hour);
                                                    const overloaded = lessons.length > 1;
                                                    return (
                                                        <td key={day}
                                                            onDragOver={(e) => e.preventDefault()}
                                                            onDrop={() => onDrop(cls, day, hour)}
                                                            style={{ border: '1px solid #f0ebe3', padding: '5px', verticalAlign: 'top', height: '62px', backgroundColor: overloaded ? '#FAE8E8' : undefined }}>
                                                            {lessons.length === 0 ? (
                                                                <div style={{ border: '1.5px dashed #d8d0c0', borderRadius: '8px', padding: '5px', textAlign: 'center', color: '#c8baa6', fontSize: '11px', height: '100%' }}>פנוי</div>
                                                            ) : lessons.map(e => {
                                                                const c = colorFor(e);
                                                                const cant = hardCant.has(`${e.teacher_id}-${e.timeslot_id}`);
                                                                return (
                                                                    <div key={e.id} draggable
                                                                        onDragStart={() => setDragId(e.id)}
                                                                        title={cant ? 'המורה סימן/ה "לא יכול" בזמן זה' : ''}
                                                                        style={{ borderRadius: '8px', padding: '5px 7px', marginBottom: '4px', fontSize: '11px', color: '#4a3f35', lineHeight: 1.35, backgroundColor: c.bg, borderRight: `3px solid ${c.accent}`, cursor: 'grab', outline: cant ? '2px solid #c0705a' : 'none' }}>
                                                                        <div style={{ fontWeight: 700 }}>{e.subject_name}</div>
                                                                        <div style={{ color: '#8a7a6e' }}>{e.teacher_first_name} {e.teacher_last_name}</div>
                                                                        {e.room_name && <div style={{ color: '#a99', fontSize: '10px' }}>{e.room_name}</div>}
                                                                    </div>
                                                                );
                                                            })}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>

                {/* side panel: active conflicts + advisory warnings */}
                <div style={{ width: '300px', flexShrink: 0 }}>
                    <div style={{ border: '1px solid #e2dacc', borderRadius: '12px', padding: '14px', backgroundColor: '#fff', position: 'sticky', top: '10px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#4a3f35', marginBottom: '10px' }}>
                            התנגשויות פעילות {conflicts.length > 0 && <span style={{ color: '#c0705a' }}>({conflicts.length})</span>}
                        </div>
                        {conflicts.length === 0 ? (
                            <div style={{ fontSize: '13px', color: '#6b8f5e' }}>אין התנגשויות. אפשר לסיים.</div>
                        ) : conflicts.map((c, i) => (
                            <div key={i} style={{ fontSize: '12px', color: '#8a3a2c', backgroundColor: '#FAE8E8', border: '1px solid #f0c7c0', borderRadius: '8px', padding: '7px 9px', marginBottom: '6px' }}>{c.detail}</div>
                        ))}

                        {constraintWarnings.length > 0 && (
                            <>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#a08c30', margin: '14px 0 8px' }}>אזהרות (לא חוסמות)</div>
                                {constraintWarnings.map((w, i) => (
                                    <div key={i} style={{ fontSize: '12px', color: '#8a6d1e', backgroundColor: '#FFF3A3', borderRadius: '8px', padding: '7px 9px', marginBottom: '6px' }}>{w}</div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* occupied-cell menu */}
            {occMenu && occSrc && occTgt && (
                <div onClick={() => { setOccMenu(null); setAltsFor(null); }} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div onClick={e => e.stopPropagation()} dir="rtl" style={{ backgroundColor: '#FAF7F2', border: '1px solid #e2dacc', borderRadius: '14px', padding: '22px', width: '92%', maxWidth: '460px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                        <h3 style={{ margin: '0 0 6px', fontSize: '16px', color: '#4a3f35' }}>התא תפוס</h3>
                        <p style={{ fontSize: '13px', color: '#8a7a6e', margin: '0 0 16px', lineHeight: 1.6 }}>
                            רוצה להעביר את <b>{occSrc.subject_name}</b> ל{slotLabel({ day_of_week: occMenu.day, hour_of_day: occMenu.hour })}, שם כבר יש <b>{occTgt.subject_name}</b> ({occTgt.teacher_first_name} {occTgt.teacher_last_name}).
                        </p>

                        {altsFor === null && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <button onClick={doSwap} style={btn('#EDF4E8', '#4a7c3f', { textAlign: 'right' })}>החלפה — {occSrc.subject_name} ↔ {occTgt.subject_name}</button>
                                <button onClick={() => setAltsFor('source')} style={btn('#fff', '#4a3f35', { textAlign: 'right' })}>הצעות חלופיות ל־{occSrc.subject_name}</button>
                                <button onClick={() => setAltsFor('occupant')} style={btn('#fff', '#4a3f35', { textAlign: 'right' })}>הצעות חלופיות ל־{occTgt.subject_name}</button>
                                <button onClick={doPlaceTogether} style={btn('#fff', '#a08c30', { textAlign: 'right' })}>השאר את שניהם יחד (תיווצר התנגשות)</button>
                                <button onClick={() => setOccMenu(null)} style={btn('#fff', '#8a7a6e', { textAlign: 'right' })}>ביטול</button>
                            </div>
                        )}

                        {altsFor && (() => {
                            const target = altsFor === 'source' ? occSrc : occTgt;
                            const alts = validAltsFor(target);
                            const pick = altsFor === 'source' ? chooseAltForSource : chooseAltForOccupant;
                            return (
                                <div>
                                    <button onClick={() => setAltsFor(null)} style={{ ...btn('#fff', '#8a7a6e', { padding: '6px 12px', fontSize: '13px' }), marginBottom: '10px' }}>← חזרה</button>
                                    <div style={{ fontSize: '13px', color: '#4a3f35', marginBottom: '8px' }}>
                                        משבצות פנויות ל־{target.subject_name} (ללא התנגשות מורה/כיתה ואילוץ קשיח):
                                    </div>
                                    {alts.length === 0 ? (
                                        <div style={{ fontSize: '13px', color: '#c0705a' }}>אין משבצת חלופית תקינה.</div>
                                    ) : (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                                            {alts.map(a => (
                                                <button key={`${a.day}-${a.hour}`} onClick={() => pick(a)} style={btn('#EDF4E8', '#4a7c3f', { padding: '7px 12px', fontSize: '13px', border: 'none' })}>
                                                    {DAY_NAMES[a.day]} · שעה {a.hour}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* re-detect violations result */}
            {showPreview && (
                <div onClick={() => setShowPreview(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div onClick={e => e.stopPropagation()} dir="rtl" style={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2dacc', padding: '24px', width: '620px', maxWidth: '92vw', maxHeight: '80vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <h2 style={{ fontSize: '17px', color: '#4a3f35', margin: 0 }}>הפרות במערכת המוצעת</h2>
                            <button onClick={() => setShowPreview(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8baa6', fontSize: '20px' }}>✕</button>
                        </div>
                        {previewViols === null ? <div>טוען…</div>
                            : previewViols.length === 0 ? <div style={{ color: '#6b8f5e' }}>לא נמצאו הפרות.</div>
                                : previewViols.map((v, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0ebe3' }}>
                                        <span style={{ flexShrink: 0, fontSize: '11px', padding: '3px 10px', borderRadius: '20px', backgroundColor: v.severity === 'hard' ? '#FAE8E8' : '#FFF3A3', color: v.severity === 'hard' ? '#c0705a' : '#a08c30' }}>{v.severity === 'hard' ? 'קשיחה' : 'רכה'}</span>
                                        <span style={{ flex: 1, fontSize: '13px', color: '#4a3f35' }}>{v.detail}</span>
                                        <span style={{ fontSize: '13px', color: '#8a7a6e' }}>+{(v.penalty || 0).toLocaleString()}</span>
                                    </div>
                                ))}
                    </div>
                </div>
            )}
        </div>
    );
}
