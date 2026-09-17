import { useState, useEffect, useMemo } from 'react';
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
function colorFor(e, mode) {
    const key = mode === 'teacher'
        ? (e.teacher_id != null ? `t${e.teacher_id}` : `${e.teacher_first_name}${e.teacher_last_name}`)
        : (e.subject_id != null ? String(e.subject_id) : (e.subject_name || ''));
    return PALETTE[hashString(key) % PALETTE.length];
}
const slotLabel = (e) => `יום ${DAY_NAMES[e.day_of_week] || e.day_of_week} · שעה ${e.hour_of_day}`;
const btn = (bg, color, extra = {}) => ({
    padding: '10px 18px', fontSize: '14px', border: '1px solid #e2dacc', borderRadius: '10px',
    cursor: 'pointer', fontFamily: 'Varela Round, sans-serif', backgroundColor: bg, color, ...extra,
});

export default function ScheduleEditor({ initialEntries, runId, onFinish, onCancel }) {
    // Deep-copied working copy of the FULL schedule (all classes).
    const [entries, setEntries] = useState(() => initialEntries.map(e => ({ ...e })));
    const [past, setPast] = useState([]);
    const [future, setFuture] = useState([]);

    const [tsMap, setTsMap] = useState(null);          // "day-hour" -> timeslot_id
    const [hardCant, setHardCant] = useState(new Set()); // "teacher-timeslot" hard "can't"
    const [softNot, setSoftNot] = useState(new Set());   // "teacher-timeslot" soft "prefers not"

    const [selectedClasses, setSelectedClasses] = useState([]);
    const [selectedId, setSelectedId] = useState(null); // clicked lesson (for target highlight)
    const [dragId, setDragId] = useState(null);
    const [colorMode, setColorMode] = useState('subject'); // 'subject' | 'teacher'

    const [occMenu, setOccMenu] = useState(null);
    const [altsFor, setAltsFor] = useState(null);      // 'source' | 'occupant' | null

    const [previewViols, setPreviewViols] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const [showSuggest, setShowSuggest] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [draftFound, setDraftFound] = useState(false);

    const draftKey = `scheduleEditDraft:${runId}`;

    useEffect(() => {
        getTimeslots().then(r => {
            const m = {};
            (r.data || []).forEach(t => { m[`${t.day_of_week}-${t.hour_of_day}`] = t.id; });
            setTsMap(m);
        }).catch(() => setTsMap({}));
        getMyConstraints().then(r => {
            const hard = new Set(), soft = new Set();
            (r.data || []).forEach(c => {
                const k = `${c.teacher_id}-${c.timeslot_id}`;
                if (c.constraint_type === 'hard') hard.add(k);
                else if (c.constraint_type === 'soft') soft.add(k);
            });
            setHardCant(hard); setSoftNot(soft);
        }).catch(() => { });
        try { if (localStorage.getItem(draftKey)) setDraftFound(true); } catch { /* */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const dirty = useMemo(
        () => JSON.stringify(entries) !== JSON.stringify(initialEntries),
        [entries, initialEntries]
    );

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

    // ---- live physical-conflict detection (blocking) ----
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
            group(e => e.teacher_id).forEach(g => items.push({ detail: `${g[0].teacher_first_name} ${g[0].teacher_last_name}: ${g.length} שיעורים ב${label}` }));
            group(e => e.group_id).forEach(g => items.push({ detail: `${g[0].group_name}: ${g.length} שיעורים ב${label}` }));
            group(e => (e.room_id != null ? e.room_id : null)).forEach(g => items.push({ detail: `${g[0].room_name || 'חדר'}: ${g.length} שיעורים ב${label}` }));
        });
        return items;
    }, [entries]);

    // ---- advisory (non-blocking) teacher-constraint warnings ----
    const advisories = useMemo(() => {
        const list = [];
        entries.forEach(e => {
            const k = `${e.teacher_id}-${e.timeslot_id}`;
            if (hardCant.has(k)) list.push({ sev: 'hard', text: `${e.teacher_first_name} ${e.teacher_last_name}: "לא יכול" (${slotLabel(e)}, ${e.group_name})` });
            else if (softNot.has(k)) list.push({ sev: 'soft', text: `${e.teacher_first_name} ${e.teacher_last_name}: "מעדיף שלא" (${slotLabel(e)}, ${e.group_name})` });
        });
        return list;
    }, [entries, hardCant, softNot]);

    const blocking = conflicts.length > 0;

    // ---- undo / redo ----
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
    const applyMove = (id, ts, day, hour) => { commit(moveEntry(id, ts, day, hour)); setSelectedId(null); };
    const cellFor = (cls, day, hour) =>
        entries.filter(e => e.group_name === cls && e.day_of_week === day && e.hour_of_day === hour);

    // valid target slots for an entry: class free, teacher free, no hard "can't"
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
    const bestAltFor = (entry) => {
        const alts = validAltsFor(entry);
        if (!alts.length) return null;
        return alts.find(a => !softNot.has(`${entry.teacher_id}-${a.ts}`)) || alts[0];
    };

    // ---- highlight targets for the clicked / dragged lesson ----
    const highlightId = selectedId != null ? selectedId : dragId;
    const highlightEntry = useMemo(() => entries.find(e => e.id === highlightId) || null, [entries, highlightId]);
    const highlightSlots = useMemo(() => {
        const s = new Set();
        if (!highlightEntry) return s;
        validAltsFor(highlightEntry).forEach(a => s.add(`${a.day}-${a.hour}`));
        return s;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightEntry, entries, tsMap, hardCant]);

    // ---- improvement suggestions (constraint-based) ----
    const suggestions = useMemo(() => {
        if (!tsMap) return [];
        const out = [];
        entries.forEach(e => {
            const k = `${e.teacher_id}-${e.timeslot_id}`;
            const hard = hardCant.has(k), soft = softNot.has(k);
            if (!hard && !soft) return;
            const alt = bestAltFor(e);
            if (alt) out.push({ id: e.id, alt, sev: hard ? 'hard' : 'soft', entry: e });
        });
        return out.slice(0, 25);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entries, hardCant, softNot, tsMap]);

    // ---- drag & drop ----
    const onDrop = (cls, day, hour) => {
        const id = dragId; setDragId(null);
        if (id == null) return;
        const src = entries.find(e => e.id === id);
        if (!src || src.group_name !== cls) return;
        const ts = tsId(day, hour);
        if (ts == null || src.timeslot_id === ts) return;
        const sameCls = entries.some(e => e.id !== id && e.group_id === src.group_id && e.timeslot_id === ts);
        const teacherBusy = entries.some(e => e.id !== id && e.teacher_id === src.teacher_id && e.timeslot_id === ts);
        const roomBusy = src.room_id != null && entries.some(e => e.id !== id && e.room_id === src.room_id && e.timeslot_id === ts);
        if (!sameCls && !teacherBusy && !roomBusy) { applyMove(id, ts, day, hour); return; }
        setAltsFor(null);
        setOccMenu({ srcId: id, ts, day, hour });
    };

    // ---- occupied / conflicting-cell actions ----
    const occDerived = () => {
        if (!occMenu) return null;
        const src = entries.find(e => e.id === occMenu.srcId);
        if (!src) return null;
        const sameCls = entries.filter(e => e.id !== src.id && e.group_id === src.group_id && e.timeslot_id === occMenu.ts);
        const teacherBusy = entries.filter(e => e.id !== src.id && e.teacher_id === src.teacher_id && e.timeslot_id === occMenu.ts);
        const roomBusy = src.room_id != null ? entries.filter(e => e.id !== src.id && e.room_id === src.room_id && e.timeslot_id === occMenu.ts) : [];
        return { src, sameCls, teacherBusy, roomBusy, occ: sameCls[0] || null };
    };
    const doSwap = () => {
        const d = occDerived(); if (!d || !d.occ) return;
        const { src } = d; const { ts, day, hour } = occMenu;
        let next = moveEntry(src.id, ts, day, hour);
        next = next.map(e => (e.id === d.occ.id ? { ...e, timeslot_id: src.timeslot_id, day_of_week: src.day_of_week, hour_of_day: src.hour_of_day } : e));
        commit(next); setOccMenu(null); setSelectedId(null);
    };
    const doPlaceAnyway = () => { applyMove(occMenu.srcId, occMenu.ts, occMenu.day, occMenu.hour); setOccMenu(null); };
    const chooseAltForSource = (alt) => { applyMove(occMenu.srcId, alt.ts, alt.day, alt.hour); setOccMenu(null); };
    const chooseAltForOccupant = (alt) => {
        const d = occDerived(); if (!d || !d.occ) return;
        const { ts, day, hour, srcId } = occMenu;
        let next = moveEntry(d.occ.id, alt.ts, alt.day, alt.hour);
        next = next.map(e => (e.id === srcId ? { ...e, timeslot_id: ts, day_of_week: day, hour_of_day: hour } : e));
        commit(next); setOccMenu(null); setSelectedId(null);
    };

    // ---- finish / cancel / preview ----
    const payload = () => entries.map(e => ({ tea_assignment_id: e.tea_assignment_id, timeslot_id: e.timeslot_id, room_id: e.room_id ?? null }));
    const finish = async () => {
        if (blocking) return;
        setSaving(true); setSaveError('');
        try {
            await saveScheduleEdits(runId, payload());
            try { localStorage.removeItem(draftKey); } catch { /* */ }
            onFinish();
        } catch { setSaveError('שמירה נכשלה. נסי שוב.'); setSaving(false); }
    };
    const cancel = () => {
        if (dirty && !window.confirm('לצאת בלי לשמור? השינויים יאבדו.')) return;
        try { localStorage.removeItem(draftKey); } catch { /* */ }
        onCancel();
    };
    const reDetect = async () => {
        try { const r = await previewScheduleViolations(payload()); setPreviewViols(r.data.violations || []); setShowPreview(true); }
        catch { setPreviewViols([]); setShowPreview(true); }
    };
    const restoreDraft = () => {
        try { const raw = localStorage.getItem(draftKey); if (raw) setEntries(JSON.parse(raw)); } catch { /* */ }
        setDraftFound(false);
    };

    const d = occDerived();

    return (
        <div dir="rtl">
            {/* toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <h2 style={{ fontSize: '18px', color: '#4a3f35', margin: 0, marginLeft: 'auto' }}>עריכת מערכת שעות</h2>
                <button onClick={() => setColorMode(m => m === 'subject' ? 'teacher' : 'subject')} style={btn('#fff', '#4a3f35')}>
                    צבעים: {colorMode === 'subject' ? 'לפי מקצוע' : 'לפי מורה'}
                </button>
                <button onClick={() => setShowSuggest(true)} style={btn('#EDF4E8', '#4a7c3f')}>
                    הצעות לשיפור{suggestions.length > 0 && ` (${suggestions.length})`}
                </button>
                <button onClick={undo} disabled={!past.length} style={btn('#fff', '#4a3f35', { opacity: past.length ? 1 : 0.4 })}>↶ בטל</button>
                <button onClick={redo} disabled={!future.length} style={btn('#fff', '#4a3f35', { opacity: future.length ? 1 : 0.4 })}>↷ בצע שוב</button>
                <button onClick={reDetect} style={btn('#fff', '#4a3f35')}>זיהוי הפרות מחודש</button>
                <button onClick={cancel} style={btn('#fff', '#8a7a6e')}>ביטול</button>
                <button onClick={finish} disabled={blocking || saving}
                    style={btn(blocking || saving ? '#cdd6c4' : '#6b8f5e', '#fff', { border: 'none', cursor: blocking || saving ? 'not-allowed' : 'pointer' })}>
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
                <div style={{ flex: 1, minWidth: 0 }}>
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
                                            {DAY_ORDER.map(dd => (
                                                <th key={dd} style={{ border: '1px solid #e2dacc', padding: '8px', backgroundColor: '#EDF4E8', fontSize: '13px', color: '#4a3f35' }}>{DAY_NAMES[dd]}</th>
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
                                                    const isTarget = highlightEntry && highlightEntry.group_name === cls && highlightSlots.has(`${day}-${hour}`);
                                                    let bg;
                                                    if (overloaded) bg = '#FAE8E8';
                                                    else if (isTarget) bg = '#e4f0da';
                                                    return (
                                                        <td key={day}
                                                            onDragOver={(e) => e.preventDefault()}
                                                            onDrop={() => onDrop(cls, day, hour)}
                                                            style={{ border: isTarget ? '1.5px solid #6b8f5e' : '1px solid #f0ebe3', padding: '5px', verticalAlign: 'top', height: '62px', backgroundColor: bg }}>
                                                            {lessons.length === 0 ? (
                                                                <div style={{ border: '1.5px dashed #d8d0c0', borderRadius: '8px', padding: '5px', textAlign: 'center', color: isTarget ? '#4a7c3f' : '#c8baa6', fontSize: '11px', height: '100%' }}>{isTarget ? 'יעד אפשרי' : 'פנוי'}</div>
                                                            ) : lessons.map(e => {
                                                                const c = colorFor(e, colorMode);
                                                                const k = `${e.teacher_id}-${e.timeslot_id}`;
                                                                const cant = hardCant.has(k);
                                                                const pref = softNot.has(k);
                                                                const sel = selectedId === e.id;
                                                                return (
                                                                    <div key={e.id} draggable
                                                                        onDragStart={() => setDragId(e.id)}
                                                                        onDragEnd={() => setDragId(null)}
                                                                        onClick={() => setSelectedId(prev => prev === e.id ? null : e.id)}
                                                                        title={cant ? 'המורה סימן/ה "לא יכול" בזמן זה' : (pref ? 'המורה סימן/ה "מעדיף שלא"' : '')}
                                                                        style={{ borderRadius: '8px', padding: '5px 7px', marginBottom: '4px', fontSize: '11px', color: '#4a3f35', lineHeight: 1.35, backgroundColor: c.bg, borderRight: `3px solid ${c.accent}`, cursor: 'grab', outline: sel ? '2px solid #4a7c3f' : (cant ? '2px solid #c0705a' : (pref ? '2px dashed #d8bb3a' : 'none')) }}>
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

                {/* side panel */}
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

                        {advisories.length > 0 && (
                            <>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#8a7a6e', margin: '14px 0 8px' }}>אזהרות (לא חוסמות)</div>
                                {advisories.map((a, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '7px', alignItems: 'flex-start', fontSize: '12px', color: a.sev === 'hard' ? '#8a3a2c' : '#8a6d1e', backgroundColor: a.sev === 'hard' ? '#FAE8E8' : '#FFF3A3', borderRadius: '8px', padding: '7px 9px', marginBottom: '6px' }}>
                                        <span style={{ flexShrink: 0, fontSize: '10px', padding: '1px 7px', borderRadius: '10px', backgroundColor: '#fff' }}>{a.sev === 'hard' ? 'קשיח' : 'רך'}</span>
                                        <span style={{ flex: 1 }}>{a.text}</span>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* conflicting-cell menu */}
            {occMenu && d && (
                <div onClick={() => { setOccMenu(null); setAltsFor(null); }} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div onClick={e => e.stopPropagation()} dir="rtl" style={{ backgroundColor: '#FAF7F2', border: '1px solid #e2dacc', borderRadius: '14px', padding: '22px', width: '92%', maxWidth: '470px', maxHeight: '82vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                        <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: '#4a3f35' }}>המעבר יוצר התנגשות</h3>
                        <div style={{ fontSize: '13px', color: '#8a3a2c', marginBottom: '14px' }}>
                            העברת <b>{d.src.subject_name}</b> ל{slotLabel({ day_of_week: occMenu.day, hour_of_day: occMenu.hour })}:
                            <ul style={{ margin: '8px 0 0', paddingRight: '18px', lineHeight: 1.7 }}>
                                {d.sameCls.map(o => <li key={`c${o.id}`}>התא תפוס ע״י {o.subject_name} ({o.teacher_first_name} {o.teacher_last_name})</li>)}
                                {d.teacherBusy.filter(o => !d.sameCls.includes(o)).map(o => <li key={`t${o.id}`}>{o.teacher_first_name} {o.teacher_last_name} כבר מלמד/ת {o.subject_name} של {o.group_name} בשעה זו</li>)}
                                {d.roomBusy.filter(o => !d.sameCls.includes(o) && !d.teacherBusy.includes(o)).map(o => <li key={`r${o.id}`}>{o.room_name} תפוס ע״י {o.subject_name} של {o.group_name}</li>)}
                            </ul>
                        </div>

                        {altsFor === null && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {d.occ && <button onClick={doSwap} style={btn('#EDF4E8', '#4a7c3f', { textAlign: 'right' })}>החלפה — {d.src.subject_name} ↔ {d.occ.subject_name}</button>}
                                <button onClick={() => setAltsFor('source')} style={btn('#fff', '#4a3f35', { textAlign: 'right' })}>הצעות חלופיות ל־{d.src.subject_name}</button>
                                {d.occ && <button onClick={() => setAltsFor('occupant')} style={btn('#fff', '#4a3f35', { textAlign: 'right' })}>הצעות חלופיות ל־{d.occ.subject_name}</button>}
                                <button onClick={doPlaceAnyway} style={btn('#fff', '#a08c30', { textAlign: 'right' })}>הצב בכל זאת (תיווצר התנגשות)</button>
                                <button onClick={() => setOccMenu(null)} style={btn('#fff', '#8a7a6e', { textAlign: 'right' })}>ביטול</button>
                            </div>
                        )}

                        {altsFor && (() => {
                            const target = altsFor === 'source' ? d.src : d.occ;
                            const alts = validAltsFor(target);
                            const pick = altsFor === 'source' ? chooseAltForSource : chooseAltForOccupant;
                            return (
                                <div>
                                    <button onClick={() => setAltsFor(null)} style={{ ...btn('#fff', '#8a7a6e', { padding: '6px 12px', fontSize: '13px' }), marginBottom: '10px' }}>← חזרה</button>
                                    <div style={{ fontSize: '13px', color: '#4a3f35', marginBottom: '8px' }}>משבצות פנויות ל־{target.subject_name}:</div>
                                    {alts.length === 0 ? (
                                        <div style={{ fontSize: '13px', color: '#c0705a' }}>אין משבצת חלופית תקינה.</div>
                                    ) : (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                                            {alts.map(a => (
                                                <button key={`${a.day}-${a.hour}`} onClick={() => pick(a)} style={btn(softNot.has(`${target.teacher_id}-${a.ts}`) ? '#FFF3A3' : '#EDF4E8', softNot.has(`${target.teacher_id}-${a.ts}`) ? '#8a6d1e' : '#4a7c3f', { padding: '7px 12px', fontSize: '13px', border: 'none' })}>
                                                    {DAY_NAMES[a.day]} · שעה {a.hour}{softNot.has(`${target.teacher_id}-${a.ts}`) ? ' (רך)' : ''}
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

            {/* improvement suggestions */}
            {showSuggest && (
                <div onClick={() => setShowSuggest(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div onClick={e => e.stopPropagation()} dir="rtl" style={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2dacc', padding: '24px', width: '620px', maxWidth: '92vw', maxHeight: '80vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <h2 style={{ fontSize: '17px', color: '#4a3f35', margin: 0 }}>הצעות לשיפור</h2>
                            <button onClick={() => setShowSuggest(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8baa6', fontSize: '20px' }}>✕</button>
                        </div>
                        {suggestions.length === 0 ? (
                            <div style={{ color: '#6b8f5e', fontSize: '14px' }}>אין הפרות אילוץ־מורה לתקן. (לתמונה הרכה המלאה — "זיהוי הפרות מחודש".)</div>
                        ) : suggestions.map((s, i) => (
                            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f0ebe3' }}>
                                <span style={{ flexShrink: 0, fontSize: '11px', padding: '3px 10px', borderRadius: '20px', backgroundColor: s.sev === 'hard' ? '#FAE8E8' : '#FFF3A3', color: s.sev === 'hard' ? '#c0705a' : '#a08c30' }}>{s.sev === 'hard' ? 'קשיח' : 'רך'}</span>
                                <span style={{ flex: 1, fontSize: '13px', color: '#4a3f35' }}>
                                    {s.entry.subject_name} · {s.entry.teacher_first_name} {s.entry.teacher_last_name}: מ{slotLabel(s.entry)} ← {DAY_NAMES[s.alt.day]} שעה {s.alt.hour}
                                </span>
                                <button onClick={() => applyMove(s.id, s.alt.ts, s.alt.day, s.alt.hour)} style={btn('#6b8f5e', '#fff', { padding: '7px 14px', fontSize: '13px', border: 'none' })}>החל</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* re-detect violations */}
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
