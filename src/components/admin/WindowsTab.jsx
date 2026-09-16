import { useState, useEffect } from 'react';
import { getSubmissionWindows, createSubmissionWindow, deleteSubmissionWindow, sendNotification } from '../../services/api';
import { styles } from '../../pages/adminDashboard.styles';
import { fmtDate, fmtDateTime } from '../../utils/format';
import { PageHeader, AddButton, ConfirmDeleteModal, ConfirmDialog, Modal, FieldError, errorFieldStyle, GridTable, bigIcon, FONT } from './adminShared';

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS = {
  active: { label: 'פעיל', bg: '#EDF4E8', color: '#4a7c3f', order: 0 },
  upcoming: { label: 'עתידי', bg: '#E8F2FA', color: '#5a8ac0', order: 1 },
  ended: { label: 'הסתיים', bg: '#f0ebe3', color: '#8a7a6e', order: 2 },
};

const DURATION_PRESETS = [
  { id: 7, label: 'שבוע' },
  { id: 14, label: 'שבועיים' },
  { id: 30, label: 'חודש' },
  { id: 'custom', label: 'מותאם' },
];

// --- date helpers (values are local "YYYY-MM-DDTHH:MM" strings) ---
const pad = (n) => String(n).padStart(2, '0');
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const addDaysAt = (value, days, time) => {
  const d = new Date(value);
  d.setDate(d.getDate() + days);
  const [hh, mm] = time.split(':').map(Number);
  d.setHours(hh, mm, 0, 0);
  return toLocalInput(d);
};

const todayAt = (time) => {
  const d = new Date();
  const [hh, mm] = time.split(':').map(Number);
  d.setHours(hh, mm, 0, 0);
  return toLocalInput(d);
};

function windowStatus(w, now = new Date()) {
  const start = new Date(w.start_date);
  const end = new Date(w.end_date);
  if (start > now) return 'upcoming';
  if (end >= now && w.is_active !== false) return 'active';
  return 'ended';
}

const overlaps = (aStart, aEnd, bStart, bEnd) => new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);

const daysUntil = (date) => Math.max(0, Math.ceil((new Date(date) - new Date()) / DAY_MS));

const daysLabel = (n) => (n === 0 ? 'היום' : n === 1 ? 'יום אחד' : `${n} ימים`);

export default function WindowsTab({ title }) {
  const [windows, setWindows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalInitial, setModalInitial] = useState(null); // null = closed
  const [toDelete, setToDelete] = useState(null);
  const [confirmReminder, setConfirmReminder] = useState(null);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [toast, setToast] = useState('');

  const load = () =>
    getSubmissionWindows().then(r => setWindows(r.data)).catch(() => { }).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const withStatus = windows
    .map(w => ({ ...w, status: windowStatus(w) }))
    .sort((a, b) => {
      if (STATUS[a.status].order !== STATUS[b.status].order) return STATUS[a.status].order - STATUS[b.status].order;
      // upcoming: soonest first; active/ended: most recent first
      const diff = new Date(a.start_date) - new Date(b.start_date);
      return a.status === 'upcoming' ? diff : -diff;
    });

  const active = withStatus.find(w => w.status === 'active');
  const nextUpcoming = withStatus.find(w => w.status === 'upcoming');

  const openCreate = () => setModalInitial({});

  const openCopy = (w) => {
    const days = Math.max(1, Math.round((new Date(w.end_date) - new Date(w.start_date)) / DAY_MS));
    setModalInitial({ title: `${w.title} (עותק)`, days });
  };

  const handleDelete = async () => {
    await deleteSubmissionWindow(toDelete.id);
    setWindows(prev => prev.filter(w => w.id !== toDelete.id));
    setToDelete(null);
  };

  const handleCreated = (msg) => {
    setModalInitial(null);
    load();
    setToast(msg);
  };

  const sendReminder = async () => {
    setSendingReminder(true);
    try {
      const w = confirmReminder;
      await sendNotification({
        title: 'תזכורת: הגשת העדפות',
        body: `חלון ההגשה "${w.title}" נסגר ב-${fmtDateTime(w.end_date)}. מי שעדיין לא הגיש/ה העדפות — זה הזמן.`,
        teacher_ids: null,
      });
      setConfirmReminder(null);
      setToast('✓ התזכורת נשלחה לכל המורים');
    } catch (e) {
      alert('שליחת התזכורת נכשלה. נסה/י שוב.');
    } finally {
      setSendingReminder(false);
    }
  };

  const rows = withStatus.map(w => {
    const s = STATUS[w.status];
    const ended = w.status === 'ended';
    return {
      key: w.id,
      highlight: w.status === 'active',
      cells: [
        <span style={{ color: ended ? '#8a7a6e' : '#4a3f35' }}>{w.title}</span>,
        <span style={{ color: '#8a7a6e' }}>{fmtDateTime(w.start_date)}</span>,
        <span style={{ color: '#8a7a6e' }}>{fmtDateTime(w.end_date)}</span>,
        <span style={{ ...styles.badge, backgroundColor: s.bg, color: s.color }}>{s.label}</span>,
        <>
          <i className="ti ti-copy" title="צור חלון דומה" onClick={() => openCopy(w)} style={bigIcon} aria-hidden="true"></i>
          <i className="ti ti-trash" title="מחיקה" onClick={() => setToDelete({ id: w.id, name: w.title })} style={bigIcon} aria-hidden="true"></i>
        </>,
      ],
    };
  });

  return (
    <>
      <PageHeader title={title} action={<AddButton label="חלון חדש" onClick={openCreate} />} />

      {toast && (
        <div style={{ backgroundColor: '#EDF4E8', color: '#4a7c3f', border: '1px solid #cfe3c4', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px', textAlign: 'center', maxWidth: '760px', marginInline: 'auto' }}>
          {toast}
        </div>
      )}

      {loading ? (
        <div style={{ ...styles.card, textAlign: 'center', color: '#c8baa6', padding: '40px' }}>טוען…</div>
      ) : (
        <>
          <div style={{ maxWidth: '760px', margin: '0 auto' }}>
            {active ? (
              <ActiveWindowCard window={active} onRemind={() => setConfirmReminder(active)} />
            ) : (
              <NoActiveCard next={nextUpcoming} onCreate={openCreate} />
            )}
          </div>

          <GridTable
            headers={['כותרת', 'פתיחה', 'סגירה', 'סטטוס', 'פעולות']}
            rows={rows}
            emptyText="עוד לא נוצרו חלונות הגשה"
          />
        </>
      )}

      {modalInitial && (
        <CreateWindowModal
          initial={modalInitial}
          existing={windows}
          onClose={() => setModalInitial(null)}
          onCreated={handleCreated}
        />
      )}

      {toDelete && <ConfirmDeleteModal name={toDelete.name} onConfirm={handleDelete} onCancel={() => setToDelete(null)} />}

      {confirmReminder && (
        <ConfirmDialog
          title="לשלוח תזכורת לצוות?"
          message={`כל המורים יקבלו התראה שחלון "${confirmReminder.title}" נסגר ב-${fmtDateTime(confirmReminder.end_date)}.`}
          confirmLabel="שלח תזכורת"
          busyLabel="שולח…"
          busy={sendingReminder}
          onConfirm={sendReminder}
          onCancel={() => setConfirmReminder(null)}
        />
      )}
    </>
  );
}

function ActiveWindowCard({ window: w, onRemind }) {
  const start = new Date(w.start_date);
  const end = new Date(w.end_date);
  const now = new Date();
  const progress = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
  const left = daysUntil(w.end_date);
  const urgent = left <= 2;

  return (
    <div style={{ ...styles.card, border: '2px solid #8a9e78' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '14px' }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ ...styles.badge, backgroundColor: '#EDF4E8', color: '#4a7c3f', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <i className="ti ti-circle-dot" aria-hidden="true"></i> פתוח עכשיו
          </span>
          <div style={{ fontSize: '18px', color: '#4a3f35', fontWeight: 700, marginTop: '10px' }}>{w.title}</div>
          <div style={{ fontSize: '13px', color: '#8a7a6e', marginTop: '4px' }}>
            {fmtDateTime(w.start_date)} &nbsp;←&nbsp; {fmtDateTime(w.end_date)}
          </div>
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: '30px', lineHeight: 1, color: urgent ? '#c0705a' : '#6b8f5e', fontWeight: 700 }}>{left}</div>
          <div style={{ fontSize: '12px', color: '#8a7a6e', marginTop: '4px' }}>{left === 1 ? 'יום לסגירה' : 'ימים לסגירה'}</div>
        </div>
      </div>

      <div style={{ height: '6px', backgroundColor: '#f0ebe3', borderRadius: '3px', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ width: `${progress}%`, height: '100%', backgroundColor: urgent ? '#c0705a' : '#8a9e78' }}></div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={onRemind} style={{ ...styles.btnOutline, gap: '6px' }}>
          <i className="ti ti-bell" aria-hidden="true"></i> שלח תזכורת לצוות
        </button>
      </div>
    </div>
  );
}

function NoActiveCard({ next, onCreate }) {
  return (
    <div style={{ ...styles.card, display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
      <span style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#f5f2ee', color: '#8a7a6e', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className="ti ti-calendar-pause" style={{ fontSize: '22px' }} aria-hidden="true"></i>
      </span>
      <div style={{ flex: 1, minWidth: '200px' }}>
        <div style={{ fontSize: '16px', color: '#4a3f35', fontWeight: 700 }}>אין חלון הגשה פתוח כרגע</div>
        <div style={{ fontSize: '13px', color: '#8a7a6e', marginTop: '4px' }}>
          {next
            ? `"${next.title}" נפתח בעוד ${daysLabel(daysUntil(next.start_date))} (${fmtDate(next.start_date)})`
            : 'מורים לא יכולים להגיש העדפות עד שייפתח חלון.'}
        </div>
      </div>
      {!next && <AddButton label="פתח חלון" onClick={onCreate} />}
    </div>
  );
}

const presetButton = (active) => ({
  padding: '6px 14px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', fontFamily: FONT,
  border: `1px solid ${active ? '#8a9e78' : '#e2dacc'}`,
  backgroundColor: active ? '#EDF4E8' : '#fff',
  color: active ? '#4a7c3f' : '#8a7a6e',
});

const NO_ERRORS = { title: false, start_date: false, end_date: false };

function CreateWindowModal({ initial, existing, onClose, onCreated }) {
  const initialDays = initial.days && [7, 14, 30].includes(initial.days) ? initial.days : (initial.days ? 'custom' : 14);
  const initialStart = todayAt('08:00');

  const [draft, setDraft] = useState({
    title: initial.title || '',
    start_date: initialStart,
    end_date: addDaysAt(initialStart, initial.days || 14, '23:59'),
  });
  const [preset, setPreset] = useState(initialDays);
  const [notify, setNotify] = useState(true);
  const [errors, setErrors] = useState(NO_ERRORS);
  const [dateError, setDateError] = useState('');
  const [saving, setSaving] = useState(false);

  const setField = (field, value) => {
    setDraft(d => {
      const next = { ...d, [field]: value };
      // keep the chosen duration when the start moves
      if (field === 'start_date' && value && preset !== 'custom') {
        next.end_date = addDaysAt(value, preset, '23:59');
      }
      return next;
    });
    if (field === 'end_date') setPreset('custom');
    if (errors[field]) setErrors(e => ({ ...e, [field]: false }));
    if (field !== 'title') setDateError('');
  };

  const choosePreset = (id) => {
    setPreset(id);
    setDateError('');
    if (id !== 'custom' && draft.start_date) {
      setDraft(d => ({ ...d, end_date: addDaysAt(d.start_date, id, '23:59') }));
    }
  };

  const overlapping = draft.start_date && draft.end_date
    ? existing.filter(w => overlaps(draft.start_date, draft.end_date, w.start_date, w.end_date))
    : [];

  const submit = async () => {
    setDateError('');
    const errs = { title: !draft.title.trim(), start_date: !draft.start_date, end_date: !draft.end_date };
    if (errs.title || errs.start_date || errs.end_date) { setErrors(errs); return; }
    setErrors(NO_ERRORS);
    if (new Date(draft.end_date) <= new Date(draft.start_date)) {
      setDateError('תאריך הסגירה חייב להיות אחרי תאריך הפתיחה.');
      return;
    }

    setSaving(true);
    try {
      await createSubmissionWindow({ ...draft, title: draft.title.trim() });
    } catch (e) {
      setSaving(false);
      setDateError('יצירת החלון נכשלה. נסה/י שוב.');
      return;
    }

    let notified = false;
    if (notify) {
      try {
        const opensNow = new Date(draft.start_date) <= new Date();
        await sendNotification({
          title: opensNow ? 'נפתח חלון להגשת העדפות' : 'חלון הגשת העדפות ייפתח בקרוב',
          body: `"${draft.title.trim()}": ${fmtDateTime(draft.start_date)} עד ${fmtDateTime(draft.end_date)}.`,
          teacher_ids: null,
        });
        notified = true;
      } catch (e) {
        console.error('Failed to notify teachers about new window', e);
      }
    }

    setSaving(false);
    onCreated(notified ? '✓ החלון נוצר והודעה נשלחה לצוות' : '✓ החלון נוצר');
  };

  return (
    <Modal title="חלון הגשה חדש" onClose={onClose}>
      <div style={{ marginBottom: '16px' }}>
        <label style={styles.label}>כותרת</label>
        <input
          style={{ ...styles.input, ...errorFieldStyle(errors.title) }}
          value={draft.title}
          onChange={e => setField('title', e.target.value)}
          placeholder="העדפות מחצית א׳"
          autoFocus
        />
        {errors.title && <FieldError>נא להזין כותרת</FieldError>}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={styles.label}>משך</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {DURATION_PRESETS.map(p => (
            <button key={p.id} onClick={() => choosePreset(p.id)} style={presetButton(preset === p.id)}>{p.label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
        <DateTimeField
          label="נפתח"
          value={draft.start_date}
          defaultTime="08:00"
          error={errors.start_date}
          errorText="נא לבחור תאריך פתיחה"
          onChange={v => setField('start_date', v)}
        />
        <DateTimeField
          label="נסגר"
          value={draft.end_date}
          defaultTime="23:59"
          error={errors.end_date}
          errorText="נא לבחור תאריך סגירה"
          onChange={v => setField('end_date', v)}
        />
      </div>

      {dateError && (
        <div style={{ fontSize: '12px', color: '#c0705a', marginBottom: '12px', padding: '8px 12px', backgroundColor: '#fff3f0', border: '1px solid #f0c9be', borderRadius: '8px' }}>{dateError}</div>
      )}

      {overlapping.length > 0 && (
        <div style={{ fontSize: '13px', color: '#a08c30', backgroundColor: '#FFF3D6', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', lineHeight: 1.5 }}>
          <i className="ti ti-alert-triangle" aria-hidden="true" style={{ marginLeft: '4px' }}></i>
          חופף ל{overlapping.map(w => `"${w.title}" (${fmtDate(w.start_date)}–${fmtDate(w.end_date)})`).join(', ')}
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#4a3f35', marginBottom: '22px', cursor: 'pointer' }}>
        <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} style={{ accentColor: '#8a9e78', width: '16px', height: '16px', cursor: 'pointer', margin: 0 }} />
        שלח הודעה לכל המורים על החלון
      </label>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button onClick={onClose} disabled={saving} style={styles.btnOutline}>ביטול</button>
        <button onClick={submit} disabled={saving} style={{ ...styles.btnAdd, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'יוצר…' : 'צור חלון'}
        </button>
      </div>
    </Modal>
  );
}

// Date + time pair stored as a single "YYYY-MM-DDTHH:MM" string.
function DateTimeField({ label, value, defaultTime, error, errorText, onChange }) {
  const [date = '', time] = (value || '').split('T');
  const currentTime = time || defaultTime;
  const errStyle = errorFieldStyle(error);

  return (
    <div>
      <label style={styles.label}>{label}</label>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="date"
          style={{ ...styles.input, ...styles.dateTimePart, ...errStyle }}
          value={date}
          onChange={e => onChange(e.target.value ? `${e.target.value}T${currentTime}` : '')}
        />
        <input
          type="time"
          style={{ ...styles.input, ...styles.dateTimePart, width: '120px', flex: '0 0 auto', ...errStyle }}
          value={currentTime}
          onChange={e => { if (date) onChange(`${date}T${e.target.value}`); }}
        />
      </div>
      {error && <FieldError>{errorText}</FieldError>}
    </div>
  );
}