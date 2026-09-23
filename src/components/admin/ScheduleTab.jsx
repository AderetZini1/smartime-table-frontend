import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import {
    runMemeticGeneration, getGenerationStatus, getCurrentSchedule,
    publishSchedule, getViolations, getSchoolSettings,
} from '../../services/api';
import { exportSingleSchedule, exportMultiSchedule } from '../../utils/exportSchedule';
import { exportSinglePDF, exportMultiPDF } from '../../utils/exportSchedulePDF';
import { styles } from '../../pages/adminDashboard.styles';
import { fmtDate, fmtDateTime } from '../../utils/format';
import ScheduleEditor from './ScheduleEditor';
import HistoryTab from './HistoryTab';
import { Toggle } from './adminShared';
import LoadingScreen from '../LoadingScreen';

const VIEW_TYPES = [
    { id: 'class', label: 'כיתה' },
    { id: 'teacher', label: 'מורה' },
    { id: 'subject', label: 'מקצוע' },
    { id: 'grade', label: 'שכבה' },
];

const DAY_NAMES_BY_NUM = { 1: 'ראשון', 2: 'שני', 3: 'שלישי', 4: 'רביעי', 5: 'חמישי', 6: 'שישי' };
const DAY_ORDER = [1, 2, 3, 4, 5, 6];
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8];

const ACTIVE_JOB_KEY = 'activeGenJob';
const VIEW_STATE_KEY = 'scheduleViewState';
const SHOW_SCORE_KEY = 'showViolationScore';

function periodsUntil(startStr, endStr, breaks) {
    const toMin = s => { if (!s) return null; const p = String(s).split(':'); return (+p[0]) * 60 + (+p[1]); };
    const start = toMin(startStr), end = toMin(endStr);
    if (start == null || end == null || end <= start) return null;
    const sorted = [...(breaks || [])].sort((a, b) => a.after_lesson - b.after_lesson);
    let t = start, n = 0;
    while (t + 45 <= end) { n += 1; t += 45; const br = sorted.find(b => b.after_lesson === n); if (br && t + br.duration_minutes + 45 <= end) t += br.duration_minutes; }
    return n;
}

const DIM_LABEL = { class: 'כיתה', teacher: 'מורה', subject: 'מקצוע', grade: 'שכבה' };
const ALGO_LABELS = { CSP: 'CSP', HILL_CLIMBING: 'טיפוס גבעות', GENETIC: 'גנטי', GENETIC_MEMETIC: 'גנטי משופר' };

// בתצוגת מורה כל השיעורים שייכים לאותו מורה, ובתצוגת מקצוע כולם מאותו מקצוע —
// ולכן צביעה לפי אותו ממד תיתן לוח בצבע אחד. בתצוגות האלה נכפה את הצביעה
// המועילה ולא נציג את הפקד בכלל.
const FORCED_COLOR_MODE = { teacher: 'subject', subject: 'teacher' };
const COLOR_MODES = [
    { id: 'subject', label: 'לפי מקצוע' },
    { id: 'teacher', label: 'לפי מורה' },
];

const VIOLATION_TYPE_LABELS = {
    // מבנה יום ושכבה
    student_gap: 'חלונות ריקים באמצע יום הכיתה',
    student_late_start: 'יום שלא מתחיל בשעה הראשונה',
    empty_day: 'יום לימודים ריק לחלוטין',
    grade_dismissal: 'שיעורים אחרי שעת הסיום של השכבה',
    grade_max_per_day: 'מעל מקסימום השיעורים ליום (שכבה)',
    daily_balance: 'חוסר איזון בין הימים',
    // אילוצים פדגוגיים (הגדרות מוסד)
    ped_max_per_day: 'מקצוע מעל המקסימום ליום',
    ped_not_last: 'מקצוע בשיעור האחרון של היום',
    ped_morning_only: 'מקצוע שלא בשעות הבוקר',
    ped_not_consecutive: 'מקצועות צמודים (למרות בקשה שלא)',
    ped_min_gap: 'רווח מינימלי בין שיעורי מקצוע',
    // מורים
    teacher_double_booked: 'מורה בשני מקומות בו-זמנית',
    group_double_booked: 'כיתה עם שני שיעורים בו-זמנית',
    weekly_hours: 'אי-התאמה במכסת השעות השבועית',
    room_capacity: 'בעיית חדר / קיבולת',
    sync_block: 'בעיית סנכרון בין שיעורים מקבילים',
    teacher_cannot: 'מורה אינו יכול ללמד (אילוץ קשיח)',
    teacher_prefers_not: 'מורה מעדיף שלא (אילוץ רך)',
    hours_range: 'מורה מחוץ לטווח השעות שלו',
    free_day: 'מורה ללא יום חופשי',
    teacher_gaps: 'חלונות בין שיעורים אצל מורה',
    early_finish: 'מורה אינו מסיים מוקדם כמבוקש',
    consecutive: 'שיעורי מורה לא רצופים',
    subject_distribution: 'אותו מקצוע מרוכז ביום אחד',
};

// נרמול טקסט לחיפוש: מתעלם מניקוד, מאחיד גרש/גרשיים ורווחים, ולא רגיש לאותיות גדולות.
const normalizeSearch = (str) => String(str || '')
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/[׳`’‘]/g, "'")
    .replace(/[״“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// הפרה תואמת אם כל מילה בחיפוש מופיעה בפרטי ההפרה, בשם סוג ההפרה או בחומרה שלה.
const violationMatches = (v, query) => {
    const words = normalizeSearch(query).split(' ').filter(Boolean);
    if (words.length === 0) return true;
    const haystack = normalizeSearch([
        v.detail,
        VIOLATION_TYPE_LABELS[v.type] || v.type,
        v.severity === 'hard' ? 'קשיחה' : 'רכה',
    ].join(' '));
    return words.every(w => haystack.includes(w));
};

const extractGrade = (groupName) => {
    const match = groupName.match(/כיתה\s*([א-ת])/);
    if (match) return match[1];
    const fallback = groupName.match(/[א-ת]/);
    return fallback ? fallback[0] : 'אחר';
};

// המפתח שלפיו שיעור משויך לערך בתצוגה הנוכחית (כיתה / מורה / מקצוע / שכבה).
const dimKeyOf = (entry, dim) => {
    if (dim === 'class') return entry.group_name;
    if (dim === 'teacher') return `${entry.teacher_first_name} ${entry.teacher_last_name}`;
    if (dim === 'subject') return entry.subject_name;
    if (dim === 'grade') return extractGrade(entry.group_name);
    return null;
};

// Curated pastel palette (replaces the earlier ad-hoc colors). Each subject
// gets a stable entry via a hash of its id/name, so the same subject always
// gets the same color without a "color" field in the database. A real
// per-subject custom color (chosen by the admin) is a separate feature for
// later — this is just a nicer automatic default.
const SUBJECT_COLOR_PALETTE = [
    { bg: '#CDE7D8', accent: '#4f9c73' },
    { bg: '#D6E4F5', accent: '#4f7fc2' },
    { bg: '#F6DCC9', accent: '#c98a4b' },
    { bg: '#E7D8F2', accent: '#9068b8' },
    { bg: '#F5D8DF', accent: '#c25c7c' },
    { bg: '#D9EDEA', accent: '#3f9e8f' },
    { bg: '#F2E6C9', accent: '#b3922e' },
    { bg: '#DADEF2', accent: '#5f68c2' },
];

function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
    }
    return hash;
}

function colorForEntry(entry, mode = 'subject') {
    const key = mode === 'teacher'
        ? (entry.teacher_id != null ? `t${entry.teacher_id}` : `${entry.teacher_first_name || ''}${entry.teacher_last_name || ''}`)
        : (entry.subject_id != null ? String(entry.subject_id) : (entry.subject_name || ''));
    const idx = hashString(key) % SUBJECT_COLOR_PALETTE.length;
    return SUBJECT_COLOR_PALETTE[idx];
}

const gridStyles = {
    gridCell: { border: '1px solid #f0ebe3', padding: '6px', verticalAlign: 'top', height: '64px' },
    gridHourCell: { border: '1px solid #f0ebe3', padding: '6px', textAlign: 'center', color: '#c8baa6', fontSize: '12px', backgroundColor: '#FAF7F2', whiteSpace: 'nowrap' },
    gridHeadCell: { border: '1px solid #e2dacc', padding: '10px', textAlign: 'center', color: '#4a3f35', fontSize: '13px' },
    lessonBox: { borderRadius: '8px', padding: '5px 7px', marginBottom: '4px', fontSize: '11px', color: '#4a3f35', lineHeight: 1.35 },
    freeCell: { border: '1.5px dashed #d8d0c0', borderRadius: '8px', padding: '5px 7px', textAlign: 'center', color: '#c8baa6', fontSize: '11px' },
    naCell: { background: 'repeating-linear-gradient(135deg,#f5f2ee,#f5f2ee 6px,#efece6 6px,#efece6 12px)' },
};

const menuItemStyle = (emphasis) => ({
    display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
    padding: '9px 10px', fontSize: '13px', textAlign: 'right',
    background: emphasis ? '#EDF4E8' : 'none', border: 'none', borderRadius: '8px',
    cursor: 'pointer', color: '#4a3f35', fontFamily: 'Varela Round, sans-serif',
    marginBottom: '2px',
});

// פילים קטנות בסגנון בורר התצוגה שמעליהן, כדי ששתי האפשרויות יהיו גלויות
// ולא יצטרכו ניחוש של "מה יקרה אם אלחץ".
const colorPillStyle = (active) => ({
    width: 'fit-content', padding: '8px 16px', borderRadius: '9px', fontSize: '14px',
    border: 'none', cursor: 'pointer', fontFamily: 'Varela Round, sans-serif',
    backgroundColor: active ? '#8a9e78' : 'transparent',
    color: active ? '#fff' : '#8a7a6e',
});

function todayAppDay() {
    const jsDay = new Date().getDay();
    return jsDay === 6 ? null : jsDay + 1;
}

// A few skeleton rows used as a placeholder for "no schedule chosen yet" —
// so the area never looks like a blank hole in the page.
const SKELETON_ROWS = [1, 2, 3, 4, 5, 6, 7, 8];

const EMPTY_LESSONS = [];

const readViewState = () => {
    try { return JSON.parse(localStorage.getItem(VIEW_STATE_KEY)) || {}; }
    catch (e) { return {}; }
};

export default function ScheduleTab({ jumpTarget, onJumpHandled, onRunSelected, onRunDeleted }) {
    const [entries, setEntries] = useState([]);
    const [runInfo, setRunInfo] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [genError, setGenError] = useState('');
    const [publishMsg, setPublishMsg] = useState('');
    const [violationsSummary, setViolationsSummary] = useState(null);
    const [violations, setViolations] = useState(null);
    const [showViolations, setShowViolations] = useState(false);
    const [violationSearch, setViolationSearch] = useState('');
    const [openViolationGroups, setOpenViolationGroups] = useState({});
    const [comboOpen, setComboOpen] = useState(false);
    const [comboInput, setComboInput] = useState('');
    const [showPublishConfirm, setShowPublishConfirm] = useState(false);
    const [confirmGenerateType, setConfirmGenerateType] = useState(null);
    const [schoolSettings, setSchoolSettings] = useState(null);
    const [editMode, setEditMode] = useState(false);
    // עמוד פנימי בתוך הטאב: null = מערכת השעות, 'history' = היסטוריית מערכות
    const [subPage, setSubPage] = useState(null);
    const [moreOpen, setMoreOpen] = useState(false);
    // הניקוד בחלון ההפרות מוסתר כברירת מחדל ומוצג רק למי שמבקש
    const [showScore, setShowScore] = useState(() => localStorage.getItem(SHOW_SCORE_KEY) === '1');

    // מצב התצוגה נשמר מקומית, כך שמעבר בין טאבים או רענון של הדף מחזירים
    // את המשתמש/ת בדיוק למה שהיה פתוח.
    const [filterType, setFilterType] = useState(() => readViewState().filterType || null);
    const [selectedValues, setSelectedValues] = useState(() => readViewState().selectedValues || []);
    const [colorMode, setColorMode] = useState(() => readViewState().colorMode || 'subject');

    // Export: single button, two stages — pick a format first, then pick a target.
    const [exportOpen, setExportOpen] = useState(false);
    const [exportStage, setExportStage] = useState('format'); // 'format' | 'target' | 'dim'
    const [exportFormat, setExportFormat] = useState('excel');
    const [exportDim, setExportDim] = useState(null);
    const [exportSearch, setExportSearch] = useState('');
    const [exportMsg, setExportMsg] = useState('');

    const pollTimer = useRef(null);

    const stopPolling = () => {
        if (pollTimer.current) { clearTimeout(pollTimer.current); pollTimer.current = null; }
    };

    const finishJob = () => {
        stopPolling();
        setGenerating(false);
        localStorage.removeItem(ACTIVE_JOB_KEY);
    };

    // מעקב אחיד אחרי כל ריצת יצירה — רגילה, משופרת, או כזו שהתחילה לפני
    // שעזבו את הטאב. קודם היו שלושה מימושים כמעט זהים, ורק אחד מהם שמר את
    // מזהה הריצה, כך שריצה משופרת "נעלמה" ביציאה מהטאב.
    const trackJob = (jobId, { delay = 3000, failMsg = 'יצירת המערכת נכשלה. אפשר לנסות שוב.' } = {}) => {
        if (!jobId) return;
        localStorage.setItem(ACTIVE_JOB_KEY, jobId);
        setGenerating(true);
        const poll = async () => {
            try {
                const s = await getGenerationStatus(jobId);
                if (s.data.status === 'completed') { finishJob(); await loadSchedule(); }
                else if (s.data.status === 'failed') { finishJob(); setGenError(failMsg); }
                else pollTimer.current = setTimeout(poll, 3000);
            } catch (e) {
                finishJob();
                setGenError('שגיאה בבדיקת מצב היצירה');
            }
        };
        pollTimer.current = setTimeout(poll, delay);
    };

    useEffect(() => {
        loadSchedule();
        getSchoolSettings().then(r => setSchoolSettings(r.data)).catch(() => { });
        const savedJob = localStorage.getItem(ACTIVE_JOB_KEY);
        if (savedJob) trackJob(savedJob, { delay: 1500 });
        return stopPolling;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        localStorage.setItem(VIEW_STATE_KEY, JSON.stringify({ filterType, selectedValues, colorMode }));
    }, [filterType, selectedValues, colorMode]);

    useEffect(() => {
        localStorage.setItem(SHOW_SCORE_KEY, showScore ? '1' : '0');
    }, [showScore]);

    useEffect(() => {
        if (jumpTarget) {
            setFilterType(jumpTarget.type);
            setSelectedValues([jumpTarget.value]);
            onJumpHandled();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jumpTarget]);

    const loadSchedule = async () => {
        setGenError('');
        try {
            const res = await getCurrentSchedule();
            setEntries(res.data.entries || []);
            setRunInfo(res.data.run || null);
            if (res.data.run) {
                getViolations().then(r => {
                    const list = r.data.violations || [];
                    setViolationsSummary({
                        hard: list.filter(v => v.severity === 'hard').length,
                        soft: list.filter(v => v.severity === 'soft').length,
                    });
                }).catch(() => setViolationsSummary(null));
            } else {
                setViolationsSummary(null);
            }
        } catch (e) {
            setEntries([]);
            setRunInfo(null);
            setViolationsSummary(null);
        }
    };

    // "יצירת מערכת חדשה" — הצינור המלא בשרת: CSP -> GA ממטי -> תיקון הפרות
    // (endpoint /generation/run-memetic). זהו הכפתור היחיד ליצירה.
    const handleGenerate = async () => {
        setGenError('');
        setGenerating(true);
        try {
            const start = await runMemeticGeneration();
            trackJob(start.data.job_id);
        } catch (e) {
            setGenerating(false);
            if (e.response && e.response.status === 409) setGenError('יצירת מערכת כבר רצה כרגע. אפשר לנסות שוב עוד רגע.');
            else setGenError('לא ניתן להתחיל יצירת מערכת');
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

    const requestGenerate = (type) => setConfirmGenerateType(type);
    const runConfirmedGenerate = () => {
        setConfirmGenerateType(null);
        handleGenerate();
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

    const valuesForDim = (dim) => {
        const set = new Set();
        entries.forEach(e => { const k = dimKeyOf(e, dim); if (k) set.add(k); });
        return [...set].sort((a, b) => String(a).localeCompare(String(b), 'he'));
    };

    const entriesForDim = (dim, val) => entries.filter(e => dimKeyOf(e, dim) === val);
    const entriesFor = (val) => entriesForDim(filterType, val);

    const options = useMemo(
        () => (filterType ? valuesForDim(filterType) : []),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [entries, filterType]
    );

    // אם נטענה מערכת אחרת, ערך שנשמר מקודם עלול כבר לא להתקיים בה —
    // מסירים אותו כדי לא להציג לוח ריק בלי הסבר.
    useEffect(() => {
        if (!filterType || entries.length === 0) return;
        const valid = new Set(options);
        setSelectedValues(prev => {
            const next = prev.filter(v => valid.has(v));
            return next.length === prev.length ? prev : next;
        });
    }, [options, filterType, entries.length]);

    const tileLabel = (val) => (filterType === 'grade' ? `שכבת ${val}׳` : val);
    const comboFilteredOptions = options.filter(o => !comboInput.trim() || tileLabel(o).includes(comboInput.trim()));

    const selectView = (type) => {
        setFilterType(prev => prev === type ? null : type);
        setSelectedValues([]);
        setComboInput('');
        setComboOpen(false);
    };

    const toggleValue = (val) => {
        setSelectedValues(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
    };

    // מפה אחת של שיעורים לפי ערך ולפי משבצת. קודם כל משבצת סיננה מחדש את כל
    // רשימת השיעורים (48 מעברים מלאים לכל מערכת מוצגת, בכל רינדור) — כאן זה
    // חישוב אחד וגישה ישירה.
    const cellMaps = useMemo(() => {
        const byVal = new Map();
        if (!filterType) return byVal;
        entries.forEach(e => {
            const key = dimKeyOf(e, filterType);
            if (!key) return;
            let cells = byVal.get(key);
            if (!cells) { cells = new Map(); byVal.set(key, cells); }
            const ck = `${e.day_of_week}-${e.hour_of_day}`;
            const list = cells.get(ck);
            if (list) list.push(e); else cells.set(ck, [e]);
        });
        return byVal;
    }, [entries, filterType]);

    const lessonsAt = (val, day, hour) => cellMaps.get(val)?.get(`${day}-${hour}`) || EMPTY_LESSONS;

    const breaks = schoolSettings?.breaks || [];
    const activeDays = schoolSettings?.active_days || DAY_ORDER;
    const visibleDays = DAY_ORDER.filter(d => activeDays.includes(d));

    // מספר השיעורים בפועל לכל יום — פעם אחת, במקום חישוב חוזר לכל משבצת.
    const maxPeriodByDay = useMemo(() => {
        const map = {};
        DAY_ORDER.forEach(day => {
            if (!schoolSettings) { map[day] = HOURS.length; return; }
            let end;
            if (day === 6) end = schoolSettings.friday_end_time;
            else {
                const ends = Object.values(schoolSettings.grade_end_times || {}).filter(Boolean).sort();
                end = ends[ends.length - 1];
            }
            const n = periodsUntil(schoolSettings.start_time, end, schoolSettings.breaks || []);
            map[day] = n ? Math.min(n, HOURS.length) : HOURS.length;
        });
        return map;
    }, [schoolSettings]);

    // מציגים רק שורות שקיימות לפחות ביום אחד, במקום שורות מפוספסות עד 8.
    const visibleHours = useMemo(() => {
        const max = visibleDays.reduce((m, d) => Math.max(m, maxPeriodByDay[d] || 0), 0);
        return HOURS.filter(h => h <= (max || HOURS.length));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [maxPeriodByDay, visibleDays.join(',')]);

    const naCell = (day, hour) => hour > (maxPeriodByDay[day] || HOURS.length);

    const showColorControl = filterType === 'class' || filterType === 'grade';
    const effectiveColorMode = FORCED_COLOR_MODE[filterType] || colorMode;
    const hasOpenSchedule = selectedValues.length > 0;

    const closeExport = () => { setExportOpen(false); setExportStage('format'); setExportDim(null); setExportSearch(''); setExportMsg(''); };

    const exportOneValue = async (dim, val, format = 'excel') => {
        const showGroup = dim !== 'class';
        const showTeacher = dim !== 'teacher';
        const ents = entriesForDim(dim, val);
        if (format === 'pdf') {
            await exportSinglePDF(ents, { fileName: `מערכת_${DIM_LABEL[dim]}_${val}`, title: String(val), showGroup, showTeacher });
        } else {
            await exportSingleSchedule(ents, { fileName: `מערכת_${DIM_LABEL[dim]}_${val}`, sheetName: String(val), showGroup, showTeacher });
        }
        closeExport();
    };

    const exportAllOfDim = async (dim, format = 'excel') => {
        const showGroup = dim !== 'class';
        const showTeacher = dim !== 'teacher';
        const groups = valuesForDim(dim).map(val => ({ name: String(val), entries: entriesForDim(dim, val) }));
        if (format === 'pdf') {
            await exportMultiPDF(groups, { fileName: `מערכות_לפי_${DIM_LABEL[dim]}`, showGroup, showTeacher });
        } else {
            await exportMultiSchedule(groups, { fileName: `מערכות_לפי_${DIM_LABEL[dim]}`, showGroup, showTeacher });
        }
        closeExport();
    };

    const exportCurrent = async (format = 'excel') => {
        if (!hasOpenSchedule) {
            setExportMsg('אין פריט שפתוח כרגע');
            return;
        }
        setExportMsg('');
        if (selectedValues.length === 1) {
            await exportOneValue(filterType, selectedValues[0], format);
        } else {
            const groups = selectedValues.map(val => ({ name: String(val), entries: entriesFor(val) }));
            const showTeacherCur = filterType !== 'teacher';
            if (format === 'pdf') {
                await exportMultiPDF(groups, { fileName: 'מערכת_נבחרת', showGroup: filterType !== 'class', showTeacher: showTeacherCur });
            } else {
                await exportMultiSchedule(groups, { fileName: 'מערכת_נבחרת', showGroup: filterType !== 'class', showTeacher: showTeacherCur });
            }
            closeExport();
        }
    };

    const today = todayAppDay();
    const totalViolations = violationsSummary ? violationsSummary.hard + violationsSummary.soft : 0;

    if (editMode) {
        return (
            <ScheduleEditor
                initialEntries={entries}
                runId={runInfo?.id}
                onFinish={() => { setEditMode(false); loadSchedule(); }}
                onCancel={() => setEditMode(false)}
            />
        );
    }

    if (subPage === 'history') {
        return (
            <>
                <button onClick={() => setSubPage(null)} style={{ width: 'fit-content', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', padding: 0, marginBottom: '14px', color: '#8a7a6e', fontSize: '14px', cursor: 'pointer', fontFamily: 'Varela Round, sans-serif' }}>
                    <i className="ti ti-chevron-right" aria-hidden="true"></i> חזרה למערכת השעות
                </button>
                <h2 style={{ fontSize: '20px', fontWeight: 400, color: '#4a3f35', margin: '0 0 20px 0' }}>היסטוריית מערכות</h2>
                <HistoryTab
                    onRunSelected={() => { setSubPage(null); loadSchedule(); if (onRunSelected) onRunSelected(); }}
                    onRunDeleted={() => { if (onRunDeleted) onRunDeleted(); }}
                />
            </>
        );
    }

    return (
        <>
            {generating && <LoadingScreen floating offset="280px" tagline="יוצר מערכת שעות" />}
            <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '16px', color: '#8a7a6e' }}>מערכת השעות הפעילה של בית הספר</div>
                <div style={{ fontSize: '15px', color: '#8a7a6e', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {runInfo ? (
                        <>
                            <span style={{ fontSize: '13px', padding: '4px 14px', borderRadius: '20px', backgroundColor: runInfo.is_published ? '#EDF4E8' : '#FFF3D6', color: runInfo.is_published ? '#4a7c3f' : '#a08c30' }}>
                                {runInfo.is_published ? 'פורסם' : 'טיוטה'}
                            </span>
                            <span>נוצר ב-{fmtDate(runInfo.run_at)}</span>
                        </>
                    ) : (
                        <span>אין מערכת שעות פעילה כרגע</span>
                    )}
                </div>
            </div>

            {violationsSummary && violationsSummary.hard > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#FAE8E8', border: '1px solid #f0c7c0', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#8a3a2c' }}>
                    <i className="ti ti-alert-triangle" style={{ fontSize: '16px', flexShrink: 0 }} aria-hidden="true"></i>
                    <span style={{ flex: 1 }}>נמצאו {violationsSummary.hard} הפרות קשיחות שדורשות תשומת לב</span>
                    <button onClick={openViolations} style={{ width: 'fit-content', background: 'none', border: 'none', color: '#8a3a2c', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px', fontFamily: 'Varela Round, sans-serif' }}>צפייה בפירוט</button>
                </div>
            )}

            {generating && <div style={{ fontSize: '12px', color: '#8a7a6e', marginBottom: '12px' }}>היצירה עשויה לקחת עד כ-3 דקות. אפשר להמתין כאן.</div>}
            {genError && <div style={{ fontSize: '12px', color: '#c0705a', marginBottom: '12px' }}>{genError}</div>}
            {publishMsg && <div style={{ fontSize: '12px', color: '#6b8f5e', marginBottom: '12px' }}>{publishMsg}</div>}

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <button onClick={() => setShowPublishConfirm(true)} disabled={publishing || !runInfo} style={{ ...styles.btnAdd, padding: '13px 26px', fontSize: '16px', backgroundColor: '#6b8f5e', opacity: (publishing || !runInfo) ? 0.5 : 1, cursor: (publishing || !runInfo) ? 'not-allowed' : 'pointer' }}>
                    <i className="ti ti-send" aria-hidden="true"></i>
                    {publishing ? 'מפרסם…' : (runInfo?.is_published ? 'פרסום מחדש' : 'פרסום לצוות')}
                </button>

                <button onClick={() => requestGenerate('new')} disabled={generating} style={{ ...styles.btnOutline, padding: '13px 24px', fontSize: '16px', opacity: generating ? 0.5 : 1, cursor: generating ? 'not-allowed' : 'pointer' }}>
                    <i className={`ti ${generating ? 'ti-loader' : 'ti-wand'}`} aria-hidden="true"></i> יצירת מערכת חדשה
                </button>

                <button onClick={() => setEditMode(true)} disabled={!runInfo} style={{ ...styles.btnOutline, padding: '13px 24px', fontSize: '16px', opacity: !runInfo ? 0.5 : 1, cursor: !runInfo ? 'not-allowed' : 'pointer' }}>
                    <i className="ti ti-edit" aria-hidden="true"></i> עריכה ידנית
                </button>

                <div style={{ position: 'relative' }}>
                    <button onClick={() => setMoreOpen(o => !o)} aria-haspopup="menu" aria-expanded={moreOpen} style={{ ...styles.btnOutline, position: 'relative', padding: '13px 22px', fontSize: '16px', cursor: 'pointer' }}>
                        <i className="ti ti-layout-grid" aria-hidden="true"></i> אפשרויות נוספות <i className="ti ti-chevron-down" style={{ fontSize: '13px' }} aria-hidden="true"></i>
                        {violationsSummary && violationsSummary.hard > 0 && (
                            <span aria-hidden="true" style={{ position: 'absolute', top: '6px', left: '8px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#c0705a' }}></span>
                        )}
                    </button>

                    {moreOpen && (
                        <>
                            <div onClick={() => setMoreOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
                            <div role="menu" dir="rtl" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 901, backgroundColor: '#fff', border: '1px solid #e2dacc', borderRadius: '12px', boxShadow: '0 8px 24px rgba(74,63,53,0.14)', width: '240px', padding: '8px' }}>
                                <button
                                    role="menuitem"
                                    onClick={() => { if (!runInfo) return; setMoreOpen(false); openViolations(); }}
                                    style={{ ...menuItemStyle(false), fontSize: '14px', padding: '11px 12px', opacity: !runInfo ? 0.5 : 1, cursor: !runInfo ? 'not-allowed' : 'pointer' }}
                                >
                                    <i className="ti ti-alert-triangle" aria-hidden="true"></i> צפייה בהפרות
                                    {totalViolations > 0 && (
                                        <span style={{ marginRight: 'auto', fontSize: '11px', backgroundColor: '#FAE8E8', color: '#c0705a', borderRadius: '10px', padding: '1px 8px' }}>{totalViolations}</span>
                                    )}
                                </button>
                                <button
                                    role="menuitem"
                                    onClick={() => { setMoreOpen(false); setSubPage('history'); }}
                                    style={{ ...menuItemStyle(false), fontSize: '14px', padding: '11px 12px' }}
                                >
                                    <i className="ti ti-history" aria-hidden="true"></i> היסטוריית מערכות
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {!runInfo ? (
                <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <i className="ti ti-calendar-off" style={{ fontSize: '34px', color: '#c8baa6', display: 'block', marginBottom: '14px' }} aria-hidden="true"></i>
                    <div style={{ fontSize: '15px', color: '#4a3f35', marginBottom: '6px' }}>אין מערכת שעות עדיין</div>
                    <div style={{ fontSize: '13px', color: '#8a7a6e', marginBottom: '18px', lineHeight: 1.6 }}>
                        אפשר ליצור מערכת חדשה, או לפתוח מערכת קיימת מההיסטוריה.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                        <button onClick={() => requestGenerate('new')} disabled={generating} style={{ ...styles.btnAdd, opacity: generating ? 0.7 : 1, cursor: generating ? 'not-allowed' : 'pointer' }}>
                            <i className={`ti ${generating ? 'ti-loader' : 'ti-wand'}`} aria-hidden="true"></i>
                            {generating ? 'בתהליך יצירה…' : 'יצירת מערכת חדשה'}
                        </button>
                        <button onClick={() => setSubPage('history')} style={{ width: 'fit-content', background: 'none', border: 'none', color: '#8a9e78', fontSize: '13px', cursor: 'pointer', fontFamily: 'Varela Round, sans-serif', textDecoration: 'underline' }}>
                            פתיחת מערכת קיימת
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                        <div style={{ display: 'inline-flex', backgroundColor: '#f5f2ee', borderRadius: '12px', padding: '5px', gap: '2px' }}>
                            {VIEW_TYPES.map(v => (
                                <button key={v.id} onClick={() => selectView(v.id)}
                                    style={{ width: 'fit-content', padding: '12px 26px', borderRadius: '10px', fontSize: '16px', border: 'none', cursor: 'pointer', fontFamily: 'Varela Round, sans-serif', backgroundColor: filterType === v.id ? '#8a9e78' : 'transparent', color: filterType === v.id ? '#fff' : '#8a7a6e' }}>
                                    {v.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {filterType && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                            <div style={{ width: '540px', maxWidth: '100%', position: 'relative' }}>
                                <div onClick={() => setComboOpen(true)} style={{ border: '1px solid #e2dacc', borderRadius: '12px', padding: '12px 16px', backgroundColor: '#fff', cursor: 'text' }}>
                                    {selectedValues.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '8px' }}>
                                            {selectedValues.map(val => (
                                                <span key={val} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#EDF4E8', color: '#4a7c3f', fontSize: '14px', padding: '5px 12px', borderRadius: '20px' }}>
                                                    {tileLabel(val)}
                                                    <i className="ti ti-x" onClick={(e) => { e.stopPropagation(); toggleValue(val); }} style={{ fontSize: '12px', cursor: 'pointer' }} aria-hidden="true"></i>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                        <i className="ti ti-search" style={{ fontSize: '16px', color: '#c8baa6' }} aria-hidden="true"></i>
                                        <input
                                            value={comboInput}
                                            onChange={e => { setComboInput(e.target.value); setComboOpen(true); }}
                                            onFocus={() => setComboOpen(true)}
                                            placeholder={`חיפוש ${DIM_LABEL[filterType]} או בחירה מהרשימה…`}
                                            style={{ border: 'none', outline: 'none', flex: 1, fontSize: '15px', backgroundColor: 'transparent', color: '#4a3f35', fontFamily: 'Varela Round, sans-serif' }}
                                        />
                                    </div>
                                </div>

                                {comboOpen && (
                                    <>
                                        <div onClick={() => { setComboOpen(false); setComboInput(''); }} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
                                        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, left: 0, zIndex: 901, backgroundColor: '#fff', border: '1px solid #e2dacc', borderRadius: '10px', boxShadow: '0 8px 24px rgba(74,63,53,0.14)', maxHeight: '240px', overflowY: 'auto', padding: '6px' }}>
                                            {comboFilteredOptions.length === 0 ? (
                                                <div style={{ padding: '10px', fontSize: '14px', color: '#c8baa6', textAlign: 'center' }}>לא נמצאו תוצאות</div>
                                            ) : comboFilteredOptions.map(o => {
                                                const active = selectedValues.includes(o);
                                                return (
                                                    <button key={o} onClick={() => { toggleValue(o); setComboInput(''); }} style={{ ...menuItemStyle(active), fontSize: '14px', padding: '11px 12px' }}>
                                                        <i className={`ti ${active ? 'ti-check' : ''}`} style={{ width: '16px' }} aria-hidden="true"></i>
                                                        {tileLabel(o)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* שורת התצוגה — מופיעה רק כשיש מערכת פתוחה בפועל.
                        לפני כן אין מה לצבוע ואין מה לייצא. */}
                    {hasOpenSchedule && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px', flexWrap: 'wrap' }}>
                            {showColorControl && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '14px', color: '#8a7a6e' }}>צבעי המערכת:</span>
                                    <div style={{ display: 'inline-flex', backgroundColor: '#f5f2ee', borderRadius: '11px', padding: '4px', gap: '2px' }}>
                                        {COLOR_MODES.map(m => (
                                            <button key={m.id} onClick={() => setColorMode(m.id)} style={colorPillStyle(colorMode === m.id)}>
                                                {m.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{ position: 'relative', marginRight: 'auto' }}>
                                <button
                                    onClick={() => { if (exportOpen) { closeExport(); } else { setExportOpen(true); setExportStage('format'); } }}
                                    style={{ ...styles.btnOutline, padding: '13px 22px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '7px' }}
                                >
                                    <i className="ti ti-download" aria-hidden="true"></i> ייצוא <i className="ti ti-chevron-down" style={{ fontSize: '13px' }} aria-hidden="true"></i>
                                </button>

                                {exportOpen && (
                                    <>
                                        <div onClick={closeExport} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
                                        <div dir="rtl" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 901, backgroundColor: '#fff', border: '1px solid #e2dacc', borderRadius: '12px', boxShadow: '0 8px 24px rgba(74,63,53,0.14)', width: '280px', padding: '8px', maxHeight: '360px', overflowY: 'auto' }}>
                                            {exportMsg && (
                                                <div style={{ fontSize: '12px', color: '#c0705a', backgroundColor: '#fff8f6', border: '1px solid #edc9bf', borderRadius: '8px', padding: '8px 10px', marginBottom: '8px', textAlign: 'center' }}>
                                                    {exportMsg}
                                                </div>
                                            )}
                                            {exportStage === 'format' ? (
                                                <>
                                                    <button onClick={() => { setExportFormat('excel'); setExportStage('target'); }} style={menuItemStyle(false)}>
                                                        <i className="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel
                                                    </button>
                                                    <button onClick={() => { setExportFormat('pdf'); setExportStage('target'); }} style={menuItemStyle(false)}>
                                                        <i className="ti ti-file-type-pdf" aria-hidden="true"></i> PDF
                                                    </button>
                                                </>
                                            ) : exportStage === 'target' ? (
                                                <>
                                                    <button onClick={() => setExportStage('format')} style={{ ...menuItemStyle(false), color: '#8a7a6e' }}>
                                                        <i className="ti ti-chevron-right" aria-hidden="true"></i> חזרה
                                                    </button>
                                                    <button onClick={() => exportCurrent(exportFormat)} style={menuItemStyle(true)}>
                                                        <i className="ti ti-eye" aria-hidden="true"></i> ייצוא מה שפתוח כרגע
                                                    </button>
                                                    <div style={{ height: '1px', backgroundColor: '#f0ebe3', margin: '6px 4px' }} />
                                                    {['class', 'teacher', 'subject', 'grade'].map(dim => (
                                                        <button key={dim} onClick={() => { setExportDim(dim); setExportSearch(''); setExportStage('dim'); }} style={menuItemStyle(false)}>
                                                            <span>ייצוא לפי {DIM_LABEL[dim]}</span>
                                                            <i className="ti ti-chevron-left" style={{ marginRight: 'auto' }} aria-hidden="true"></i>
                                                        </button>
                                                    ))}
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => setExportStage('target')} style={{ ...menuItemStyle(false), color: '#8a7a6e' }}>
                                                        <i className="ti ti-chevron-right" aria-hidden="true"></i> חזרה
                                                    </button>
                                                    <button onClick={() => exportAllOfDim(exportDim, exportFormat)} style={menuItemStyle(true)}>
                                                        <i className="ti ti-stack-2" aria-hidden="true"></i> ייצוא הכל (כל {DIM_LABEL[exportDim]})
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
                                                            <button key={v} onClick={() => exportOneValue(exportDim, v, exportFormat)} style={menuItemStyle(false)}>
                                                                {exportDim === 'grade' ? `שכבת ${v}׳` : v}
                                                            </button>
                                                        ))}
                                                </>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {!hasOpenSchedule ? (
                        <div style={{ position: 'relative', border: '1px solid #ece7dd', borderRadius: '12px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', opacity: 0.7 }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: '60px', padding: '10px', border: '1px solid #ece7dd', backgroundColor: '#f5f2ee', fontSize: '12px', color: '#a49c8e' }}>שעה</th>
                                        {visibleDays.map(d => <th key={d} style={{ padding: '10px', border: '1px solid #ece7dd', backgroundColor: '#f5f2ee', fontSize: '13px', color: '#a49c8e' }}>{DAY_NAMES_BY_NUM[d]}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {SKELETON_ROWS.map(hour => (
                                        <tr key={hour}>
                                            <td style={{ border: '1px solid #ece7dd', padding: '6px', textAlign: 'center', color: '#b0a897', fontSize: '12px' }}>{hour}</td>
                                            {visibleDays.map(d => (
                                                <td key={d} style={{ border: '1px solid #ece7dd', padding: '6px', height: '58px' }}>
                                                    <div style={{ backgroundColor: '#EFEAE1', border: '1px solid #e2dacc', borderRadius: '8px', height: '100%' }}></div>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: '64%', minHeight: '210px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', border: '1px solid #e2dacc', borderRadius: '14px', boxShadow: '0 8px 24px rgba(74,63,53,0.14)', textAlign: 'center', padding: '20px' }}>
                                    <i className="ti ti-calendar-search" style={{ fontSize: '30px', color: '#8a9e78', display: 'block', marginBottom: '12px' }} aria-hidden="true"></i>
                                    <div style={{ fontSize: '15px', color: '#4a3f35', lineHeight: 1.5 }}>
                                        {!filterType ? 'יש לבחור כיתה, מורה, מקצוע או שכבה כדי להתחיל' : 'יש לבחור מהרשימה כדי להציג מערכת שעות'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        selectedValues.map(val => (
                            <div key={val} style={{ ...styles.card, boxShadow: '0 1px 3px rgba(74,63,53,0.06)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                    <h3 style={{ fontSize: '16px', color: '#4a3f35', margin: 0 }}>{tileLabel(val)}</h3>
                                    <button onClick={() => toggleValue(val)} style={{ width: 'fit-content', background: 'none', border: 'none', cursor: 'pointer', color: '#c8baa6', fontSize: '13px', fontFamily: 'Varela Round, sans-serif' }}>
                                        <i className="ti ti-x" aria-hidden="true"></i> הסתרה
                                    </button>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ ...gridStyles.gridHeadCell, width: '60px', backgroundColor: '#EDF4E8' }}>שעה</th>
                                                {visibleDays.map(d => (
                                                    <th key={d} style={{ ...gridStyles.gridHeadCell, backgroundColor: d === today ? '#dcebd0' : '#EDF4E8' }}>
                                                        {DAY_NAMES_BY_NUM[d]}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleHours.map(hour => {
                                                const breakAfter = breaks.find(b => b.after_lesson === hour);
                                                const isLastVisibleHour = hour === visibleHours[visibleHours.length - 1];
                                                return (
                                                    <Fragment key={hour}>
                                                        <tr>
                                                            <td style={gridStyles.gridHourCell}>שיעור {hour}</td>
                                                            {visibleDays.map(day => {
                                                                if (naCell(day, hour)) {
                                                                    return <td key={day} style={{ ...gridStyles.gridCell, ...gridStyles.naCell }}></td>;
                                                                }
                                                                const lessons = lessonsAt(val, day, hour);
                                                                return (
                                                                    <td key={day} style={{ ...gridStyles.gridCell, backgroundColor: day === today ? '#f7faf5' : undefined }}>
                                                                        {lessons.length === 0 ? (
                                                                            <div style={gridStyles.freeCell}>פנוי</div>
                                                                        ) : lessons.map((e, idx) => {
                                                                            const color = colorForEntry(e, effectiveColorMode);
                                                                            return (
                                                                                <div key={idx} className="lesson-box" style={{ ...gridStyles.lessonBox, backgroundColor: color.bg, borderRight: `3px solid ${color.accent}` }}>
                                                                                    <div style={{ fontWeight: 700 }}>{e.subject_name}</div>
                                                                                    {filterType !== 'teacher' && <div style={{ color: '#8a7a6e' }}>{e.teacher_first_name} {e.teacher_last_name}</div>}
                                                                                    {filterType !== 'class' && <div style={{ color: '#8a7a6e' }}>{e.group_name}</div>}
                                                                                    {e.room_name && <div style={{ color: '#a99', fontSize: '10px' }}>{e.room_name}</div>}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                        {breakAfter && !isLastVisibleHour && (
                                                            <tr>
                                                                <td colSpan={visibleDays.length + 1} style={{ padding: '5px', background: '#f0ebe0', fontSize: '11px', color: '#8a7a6e', textAlign: 'center', border: '1px solid #e2dacc' }}>
                                                                    הפסקה · {breakAfter.duration_minutes} דקות
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))
                    )}

                    <div style={{ textAlign: 'left', fontSize: '11px', color: '#c8baa6', marginTop: '18px' }}>
                        עודכן לאחרונה: {fmtDateTime(runInfo.run_at)}
                    </div>
                </>
            )}

            {confirmGenerateType && (
                <div onClick={() => setConfirmGenerateType(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#FAF7F2', border: '1px solid #e2dacc', borderRadius: '14px', padding: '24px', width: '90%', maxWidth: '420px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', color: '#4a3f35' }}>
                            {confirmGenerateType === 'new' ? 'ליצור מערכת שעות חדשה?' : 'לשפר את המערכת הקיימת?'}
                        </h3>
                        <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#4a3f35', lineHeight: 1.6 }}>
                            {confirmGenerateType === 'new'
                                ? 'התהליך עשוי לקחת עד כ-3 דקות. המערכת הנוכחית תישמר בהיסטוריה ולא תימחק.'
                                : 'תיבנה גרסה משופרת על בסיס המערכת הנוכחית. התהליך עשוי לקחת עד כ-3 דקות, והמערכת הנוכחית תישמר בהיסטוריה.'}
                        </p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-start' }}>
                            <button onClick={runConfirmedGenerate} style={{ backgroundColor: '#8a9e78', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '14px', cursor: 'pointer' }}>{confirmGenerateType === 'new' ? 'יצירה' : 'שיפור'}</button>
                            <button onClick={() => setConfirmGenerateType(null)} style={{ ...styles.btnOutline, padding: '9px 18px', fontSize: '14px' }}>ביטול</button>
                        </div>
                    </div>
                </div>
            )}

            {showPublishConfirm && (
                <div onClick={() => setShowPublishConfirm(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#FAF7F2', border: '1px solid #e2dacc', borderRadius: '14px', padding: '24px', width: '90%', maxWidth: '420px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', color: '#4a3f35' }}>לפרסם את המערכת לצוות?</h3>
                        <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#4a3f35', lineHeight: 1.6 }}>
                            המערכת הנוכחית תהיה גלויה לכל המורים. כל מורה יצפה במערכת האישית שלו
                        </p>
                        {violationsSummary && violationsSummary.hard > 0 && (
                            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#8a3a2c', lineHeight: 1.6, backgroundColor: '#FAE8E8', border: '1px solid #f0c7c0', borderRadius: '8px', padding: '8px 12px' }}>
                                <i className="ti ti-alert-triangle" style={{ fontSize: '14px', marginLeft: '4px' }} aria-hidden="true"></i>
                                יש {violationsSummary.hard} הפרות קשיחות שטרם נפתרו.
                            </p>
                        )}
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-start' }}>
                            <button onClick={() => { setShowPublishConfirm(false); handlePublish(); }} style={{ backgroundColor: '#6b8f5e', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '14px', cursor: 'pointer' }}>פרסום</button>
                            <button onClick={() => setShowPublishConfirm(false)} style={{ ...styles.btnOutline, padding: '9px 18px', fontSize: '14px' }}>ביטול</button>
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
                        ) : (() => {
                            const q = violationSearch.trim();
                            const filtered = q ? violations.filter(v => violationMatches(v, q)) : violations;
                            const groups = {};
                            filtered.forEach(v => { (groups[v.type] = groups[v.type] || []).push(v); });
                            const groupKeys = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
                            return (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                        <input
                                            value={violationSearch}
                                            onChange={e => setViolationSearch(e.target.value)}
                                            placeholder="חיפוש בפרטי ההפרה (כיתה, מקצוע, מורה…)"
                                            style={{ flex: 1, minWidth: '200px', padding: '8px 12px', fontSize: '13px', border: '1px solid #e2dacc', borderRadius: '8px', fontFamily: 'Varela Round, sans-serif', color: '#4a3f35' }}
                                        />
                                        {violationSearch && (
                                            <button onClick={() => setViolationSearch('')} style={{ padding: '8px 14px', fontSize: '13px', border: '1px solid #e2dacc', borderRadius: '8px', background: '#f5f2ee', color: '#8a7a6e', cursor: 'pointer', fontFamily: 'Varela Round, sans-serif', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                                <i className="ti ti-filter-off" aria-hidden="true"></i> ניקוי סינון
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                        <Toggle on={showScore} onClick={() => setShowScore(s => !s)} label="הצגת ניקוד" />
                                        <span style={{ fontSize: '13px', color: '#4a3f35' }}>הצגת ניקוד</span>
                                    </div>
                                    {showScore && (
                                        <div style={{ fontSize: '13px', color: '#4a3f35', backgroundColor: '#FAF7F2', border: '1px solid #ece7dd', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', lineHeight: 1.6 }}>
                                            <strong>ניקוד המערכת: {(runInfo?.score ?? violations.reduce((sum, v) => sum + (v.penalty || 0), 0)).toLocaleString()}</strong>
                                            {' · '}כל הפרה מוסיפה קנס לניקוד. ככל שהניקוד נמוך יותר, המערכת טובה יותר.
                                        </div>
                                    )}
                                    <div style={{ fontSize: '13px', color: '#8a7a6e', marginBottom: '14px' }}>
                                        {q ? `${filtered.length} מתוך ${violations.length} הפרות` : `סה״כ ${violations.length} הפרות`} · קשיחות: {filtered.filter(v => v.severity === 'hard').length} · רכות: {filtered.filter(v => v.severity === 'soft').length}
                                    </div>
                                    {filtered.length === 0 ? (
                                        <div style={{ textAlign: 'center', color: '#c8baa6', padding: '20px', fontSize: '13px' }}>אין הפרות שתואמות את החיפוש.</div>
                                    ) : groupKeys.map(type => {
                                        const rows = groups[type];
                                        // בזמן חיפוש הקבוצות נפתחות אוטומטית כדי שהתוצאות ייראו מיד
                                        const isOpen = q ? openViolationGroups[type] !== false : !!openViolationGroups[type];
                                        const totalPenalty = rows.reduce((s, v) => s + (v.penalty || 0), 0);
                                        const anyHard = rows.some(v => v.severity === 'hard');
                                        return (
                                            <div key={type} style={{ border: '1px solid #ece7dd', borderRadius: '10px', marginBottom: '10px', overflow: 'hidden' }}>
                                                <button
                                                    onClick={() => setOpenViolationGroups(p => ({ ...p, [type]: !isOpen }))}
                                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: '#FAF7F2', border: 'none', cursor: 'pointer', fontFamily: 'Varela Round, sans-serif', textAlign: 'right' }}
                                                >
                                                    <i className={`ti ${isOpen ? 'ti-chevron-down' : 'ti-chevron-left'}`} style={{ color: '#8a7a6e' }} aria-hidden="true"></i>
                                                    <span style={{ flexShrink: 0, width: '9px', height: '9px', borderRadius: '50%', backgroundColor: anyHard ? '#c0705a' : '#d8bb3a' }}></span>
                                                    <span style={{ flex: 1, fontSize: '14px', color: '#4a3f35', fontWeight: 700 }}>{VIOLATION_TYPE_LABELS[type] || type}</span>
                                                    <span style={{ flexShrink: 0, fontSize: '12px', color: '#8a7a6e', backgroundColor: '#ece7dd', borderRadius: '10px', padding: '2px 9px' }}>{rows.length}</span>
                                                    {showScore && <span style={{ flexShrink: 0, fontSize: '12px', color: '#8a7a6e', fontWeight: 600, minWidth: '54px', textAlign: 'left' }}>+{totalPenalty.toLocaleString()}</span>}
                                                </button>
                                                {isOpen && (
                                                    <div style={{ padding: '4px 14px 8px' }}>
                                                        {rows.map((v, i) => (
                                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 0', borderBottom: i < rows.length - 1 ? '1px solid #f0ebe3' : 'none' }}>
                                                                <span style={{ flexShrink: 0, fontSize: '11px', padding: '3px 10px', borderRadius: '20px', backgroundColor: v.severity === 'hard' ? '#FAE8E8' : '#FFF3A3', color: v.severity === 'hard' ? '#c0705a' : '#a08c30' }}>
                                                                    {v.severity === 'hard' ? 'קשיחה' : 'רכה'}
                                                                </span>
                                                                <span style={{ flex: 1, fontSize: '13px', color: '#4a3f35' }}>{v.detail}</span>
                                                                {showScore && <span style={{ flexShrink: 0, fontSize: '13px', color: '#8a7a6e', fontWeight: 600 }}>+{v.penalty.toLocaleString()}</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}

            <style>{`
        .lesson-box { transition: box-shadow 0.12s ease; }
        .lesson-box:hover { box-shadow: 0 1px 4px rgba(74,63,53,0.18); }
      `}</style>
        </>
    );
}
