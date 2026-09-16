import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getNotifications, getTeachers, deleteNotification, sendNotification } from '../../services/api';
import { styles } from '../../pages/adminDashboard.styles';
import { fmtDateTime } from '../../utils/format';
import { PageHeader, AddButton, EmptyCard, FilterPills, ConfirmDeleteModal, fullName, Modal, FieldError, errorFieldStyle, FONT } from './adminShared';

const VIEWS = [
  { id: 'all', label: 'הכל' },
  { id: 'messages', label: 'הודעות ששלחת' },
  { id: 'system', label: 'התראות מערכת' },
];

const EMPTY_TEXT = { all: 'התראות', messages: 'הודעות', system: 'התראות מערכת' };

const MINE_LOOK = { bg: '#EDF4E8', color: '#6b8f5e', icon: 'ti-send', tag: 'הודעה' };
const SYSTEM_LOOK = { bg: '#E8F2FA', color: '#5a8ac0', icon: 'ti-bell', tag: 'מערכת' };

export default function NotificationsTab({ title }) {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [view, setView] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState('');
  const [toDelete, setToDelete] = useState(null);

  const load = () => getNotifications().then(r => setNotifs(r.data)).catch(() => { });

  useEffect(() => {
    load();
    getTeachers().then(r => setTeachers(r.data)).catch(() => { });
  }, []);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(t);
  }, [success]);

  // Classify by who authored the row: things the admin personally wrote
  // (created_by === own id) are "messages"; anything else — e.g. a teacher
  // submitting their preferences — is a "system" event.
  const myId = user?.id != null ? Number(user.id) : null;
  const isMine = (n) => myId != null && Number(n.created_by) === myId;

  const rows = view === 'messages' ? notifs.filter(isMine)
    : view === 'system' ? notifs.filter(n => !isMine(n))
      : notifs;

  const handleSent = (count) => {
    // Re-fetch instead of guessing a local id — the create endpoint doesn't
    // return the new row's real id.
    load();
    setShowForm(false);
    setSuccess(count !== null ? `✓ ההודעה נשלחה ל-${count} מורים` : '✓ ההודעה נשלחה לכל המורים');
  };

  const handleDelete = async () => {
    try {
      await deleteNotification(toDelete.id);
    } catch (e) {
      if (e?.response?.status !== 404) throw e; // 404 = already gone
    }
    setNotifs(prev => prev.filter(n => n.id !== toDelete.id));
    setToDelete(null);
  };

  return (
    <>
      <PageHeader title={title} action={<AddButton label="הודעה חדשה" onClick={() => setShowForm(true)} />} />

      {success && (
        <div style={{ backgroundColor: '#EDF4E8', color: '#4a7c3f', border: '1px solid #cfe3c4', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px', textAlign: 'center' }}>
          {success}
        </div>
      )}

      <FilterPills options={VIEWS} value={view} onChange={setView} />

      {rows.length === 0 ? (
        <EmptyCard>אין {EMPTY_TEXT[view]} להצגה</EmptyCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '700px', margin: '0 auto' }}>
          {rows.map(n => (
            <NotificationCard
              key={n.id}
              notif={n}
              mine={isMine(n)}
              showTag={view === 'all'}
              onDelete={() => setToDelete({ id: n.id, name: n.title })}
            />
          ))}
        </div>
      )}

      {showForm && <NotificationFormModal teachers={teachers} onClose={() => setShowForm(false)} onSent={handleSent} />}
      {toDelete && <ConfirmDeleteModal name={toDelete.name} onConfirm={handleDelete} onCancel={() => setToDelete(null)} />}
    </>
  );
}

function NotificationCard({ notif: n, mine, showTag, onDelete }) {
  const look = mine ? MINE_LOOK : SYSTEM_LOOK;
  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #e2dacc', borderRadius: '12px', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '10px', backgroundColor: look.bg, color: look.color, flexShrink: 0 }}>
          <i className={`ti ${look.icon}`} style={{ fontSize: '17px' }} aria-hidden="true"></i>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '14px', color: '#4a3f35', fontWeight: 700 }}>{n.title}</span>
            {showTag && (
              <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '20px', backgroundColor: look.bg, color: look.color, flexShrink: 0 }}>{look.tag}</span>
            )}
          </div>
          <div style={{ fontSize: '13px', color: '#4a3f35', marginBottom: '8px' }}>{n.body}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#c8baa6' }}>{fmtDateTime(n.created_at)}</span>
            {mine && <i className="ti ti-trash" onClick={onDelete} style={{ ...styles.iconBtn, fontSize: '18px' }} aria-hidden="true"></i>}
          </div>
        </div>
      </div>
    </div>
  );
}

const NO_ERRORS = { title: false, body: false, recipients: false };

const modeButton = (active) => ({
  padding: '6px 14px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', border: '1px solid #e2dacc',
  backgroundColor: active ? '#8a9e78' : '#f5f2ee', color: active ? '#fff' : '#8a7a6e', fontFamily: FONT,
});

function NotificationFormModal({ teachers, onClose, onSent }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mode, setMode] = useState('all'); // 'all' | 'specific'
  const [teacherIds, setTeacherIds] = useState([]);
  const [search, setSearch] = useState('');
  const [errors, setErrors] = useState(NO_ERRORS);
  const [sending, setSending] = useState(false);

  const specific = mode === 'specific';

  const send = async () => {
    const errs = { title: !title.trim(), body: !body.trim(), recipients: specific && teacherIds.length === 0 };
    setErrors(errs);
    if (errs.title || errs.body || errs.recipients) return;

    setSending(true);
    try {
      await sendNotification({ title, body, teacher_ids: specific ? teacherIds : null });
      onSent(specific ? teacherIds.length : null);
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const toggleTeacher = (id) =>
    setTeacherIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  return (
    <Modal title="שלח הודעה חדשה" onClose={onClose}>
      <div style={{ marginBottom: '16px' }}>
        <label style={styles.label}>כותרת</label>
        <input
          style={{ ...styles.input, ...errorFieldStyle(errors.title) }}
          value={title}
          onChange={e => { setTitle(e.target.value); if (errors.title) setErrors(p => ({ ...p, title: false })); }}
          placeholder="נושא ההודעה"
        />
        {errors.title && <FieldError>נא להזין כותרת</FieldError>}
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={styles.label}>תוכן ההודעה</label>
        <textarea
          style={{ ...styles.input, height: '100px', resize: 'vertical', ...errorFieldStyle(errors.body) }}
          value={body}
          onChange={e => { setBody(e.target.value); if (errors.body) setErrors(p => ({ ...p, body: false })); }}
          placeholder="כתוב את ההודעה כאן..."
        />
        {errors.body && <FieldError>נא להזין תוכן</FieldError>}
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={styles.label}>אל</label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: specific ? '12px' : 0 }}>
          <button onClick={() => setMode('all')} style={modeButton(!specific)}>כל המורים</button>
          <button onClick={() => setMode('specific')} style={modeButton(specific)}>מורים ספציפיים</button>
        </div>

        {specific && (
          <div style={{ border: '1px solid #e2dacc', borderRadius: '10px', padding: '10px', maxHeight: '200px', overflowY: 'auto', backgroundColor: '#FAF7F2' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש מורה…" style={{ ...styles.input, marginBottom: '8px' }} />
            {teachers.filter(t => !t.is_admin && fullName(t).includes(search.trim())).map(t => {
              const checked = teacherIds.includes(t.id);
              return (
                <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 6px', cursor: 'pointer', borderRadius: '6px', backgroundColor: checked ? '#EDF4E8' : 'transparent' }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleTeacher(t.id)} />
                  <span style={{ fontSize: '14px', color: '#4a3f35' }}>{fullName(t)}</span>
                </label>
              );
            })}
            <div style={{ fontSize: '11px', color: '#c8baa6', marginTop: '6px', textAlign: 'left' }}>{teacherIds.length} נבחרו</div>
          </div>
        )}
      </div>

      {errors.recipients && (
        <div style={{ fontSize: '12px', color: '#c0705a', backgroundColor: '#fff8f6', border: '1px solid #edc9bf', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', textAlign: 'center' }}>
          נא לבחור לפחות מורה אחד
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={styles.btnOutline}>ביטול</button>
        <button onClick={send} style={styles.btnAdd} disabled={sending}>
          <i className="ti ti-send" aria-hidden="true"></i>
          {sending ? 'שולח...' : (specific ? `שלח ל-${teacherIds.length}` : 'שלח לכולם')}
        </button>
      </div>
    </Modal>
  );
}
