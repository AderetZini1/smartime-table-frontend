import { useState, useEffect } from 'react';
import { getScheduleRuns, selectScheduleRun, deleteScheduleRun, updateScheduleRunNote, getScheduleRunEntries } from '../../services/api';
import { styles } from '../../pages/adminDashboard.styles';
import { fmtDate, fmtDateTime } from '../../utils/format';
import { formatAlgo, PageHeader, ConfirmDialog, Modal, PrimaryButton, FONT, DAYS, DAY_ORDER, HOURS, GridTable } from './adminShared';

const PAGE_SIZE = 5;

export default function HistoryTab({ title, onRunSelected, onRunDeleted }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [viewing, setViewing] = useState(null);
  const [confirmSelect, setConfirmSelect] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [noteView, setNoteView] = useState(null);
  const [noteEdit, setNoteEdit] = useState(null);

  useEffect(() => {
    getScheduleRuns().then(r => setRuns(r.data)).catch(() => { }).finally(() => setLoading(false));
  }, []);

  const handleSelect = async () => {
    setSelecting(true);
    try {
      await selectScheduleRun(confirmSelect.id);
      setConfirmSelect(null);
      onRunSelected();
    } catch (err) {
      alert('עדכון המערכת נכשל. נסה/י שוב.');
    } finally {
      setSelecting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteScheduleRun(confirmDelete.id);
      setRuns(prev => prev.filter(r => r.id !== confirmDelete.id));
      setConfirmDelete(null);
      onRunDeleted();
    } catch (err) {
      alert('מחיקת המערכת נכשלה. ייתכן שזו המערכת הנוכחית או המפורסמת.');
    } finally {
      setDeleting(false);
    }
  };

  const handleNoteSaved = (runId, note) => {
    setRuns(prev => prev.map(r => (r.id === runId ? { ...r, admin_note: note } : r)));
    setNoteEdit(null);
  };

  const visibleRuns = runs.slice(0, visibleCount);

  const rows = visibleRuns.map(run => {
    const deletable = !run.is_selected && !run.is_published;
    return {
      key: run.id,
      highlight: run.is_selected,
      onRowClick: () => setViewing(run),
      cells: [
        <span style={{ color: '#8a7a6e' }}>{run.run_at ? fmtDate(run.run_at) : '—'}</span>,
        formatAlgo(run.algorithm),
        run.score ?? '—',
        <RunStatus run={run} />,
        <NoteButton run={run} onView={() => setNoteView(run)} onAdd={() => setNoteEdit(run)} />,
      ],
      actions: [
        { label: 'צפייה במערכת', icon: 'ti-eye', onClick: () => setViewing(run) },
        {
          label: 'החלפה למערכת זו',
          icon: 'ti-refresh',
          onClick: () => setConfirmSelect(run),
          disabled: !!run.is_selected,
          hint: 'זו כבר המערכת הנוכחית',
        },
        {
          label: 'מחיקה',
          icon: 'ti-trash',
          danger: true,
          onClick: () => setConfirmDelete(run),
          disabled: !deletable,
          hint: run.is_selected ? 'לא ניתן למחוק את המערכת הנוכחית' : 'לא ניתן למחוק מערכת שפורסמה',
        },
      ],
    };
  });

  const footer = runs.length > PAGE_SIZE ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '14px', fontSize: '13px', color: '#8a7a6e' }}>
      <span>{`מוצגות ${visibleRuns.length} מתוך ${runs.length}`}</span>
      {visibleRuns.length < runs.length && (
        <button onClick={() => setVisibleCount(c => c + PAGE_SIZE)} style={styles.btnOutline}>הצגת עוד</button>
      )}
    </div>
  ) : null;

  return (
    <>
      {title && <PageHeader title={title} />}

      {loading ? (
        <div style={{ ...styles.card, textAlign: 'center', color: '#c8baa6', padding: '40px' }}>טוען…</div>
      ) : (
        <GridTable
          headers={[{ label: 'תאריך', weight: 1.2 }, { label: 'אלגוריתם', weight: 1.2 }, { label: 'ציון', weight: 0.8 }, { label: 'סטטוס', weight: 1.4 }, { label: 'הערות', weight: 1.2 }]}
          rows={rows}
          emptyText="אין מערכות שמורות עדיין"
          footer={footer}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          message="למחוק מערכת זו מההיסטוריה? לא ניתן לשחזר פעולה זו."
          confirmLabel="מחק"
          busyLabel="מוחק…"
          busy={deleting}
          danger
          maxWidth="400px"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {confirmSelect && (
        <ConfirmDialog
          message="להחליף למערכת זו? המערכת הנבחרת הנוכחית תוחלף. הפרסום לצוות לא ישתנה עד שתפרסמ/י מחדש."
          confirmLabel="אישור"
          busyLabel="מעדכן…"
          busy={selecting}
          onConfirm={handleSelect}
          onCancel={() => setConfirmSelect(null)}
        />
      )}

      {viewing && <RunViewerModal run={viewing} onClose={() => setViewing(null)} />}

      {noteView && (
        <NoteViewModal
          run={noteView}
          onClose={() => setNoteView(null)}
          onEdit={() => { setNoteEdit(noteView); setNoteView(null); }}
        />
      )}

      {noteEdit && <NoteEditModal run={noteEdit} onClose={() => setNoteEdit(null)} onSaved={handleNoteSaved} />}
    </>
  );
}

function RunStatus({ run }) {
  if (!run.is_selected && !run.is_published) {
    return <span style={{ ...styles.badge, backgroundColor: '#f0ebe3', color: '#8a7a6e' }}>בארכיון</span>;
  }
  return (
    <>
      {run.is_selected && <span style={{ ...styles.badge, backgroundColor: '#EDF4E8', color: '#6b8f5e' }}>נוכחית</span>}
      {run.is_published && <span style={{ ...styles.badge, backgroundColor: '#E8F2FA', color: '#5a8ac0' }}>פורסם</span>}
    </>
  );
}

// Notes live in their own column (not in the ⋮ menu). Clicks here must not
// trigger the row click (which opens the schedule viewer).
function NoteButton({ run, onView, onAdd }) {
  const handle = (fn) => (e) => { e.stopPropagation(); fn(); };
  if (run.admin_note) {
    return (
      <button onClick={handle(onView)} title={run.admin_note} style={{ backgroundColor: '#EDF4E8', border: '1px solid #cfe0c2', color: '#4a7c3f', borderRadius: '7px', padding: '5px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: FONT }}>
        <i className="ti ti-note" aria-hidden="true"></i> צפה בהערה
      </button>
    );
  }
  return (
    <button onClick={handle(onAdd)} style={{ backgroundColor: 'transparent', border: '1px dashed #d8d0c4', color: '#c8baa6', borderRadius: '7px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: FONT }}>
      <i className="ti ti-plus" aria-hidden="true"></i> הוסף הערה
    </button>
  );
}

function NoteViewModal({ run, onClose, onEdit }) {
  return (
    <Modal title="הערה" titleSize="16px" width="420px" padding="32px" onClose={onClose}>
      <p style={{ fontSize: '14px', color: '#4a3f35', lineHeight: 1.6, marginBottom: '26px', overflowWrap: 'anywhere' }}>{run.admin_note}</p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-start' }}>
        <button onClick={onEdit} style={styles.btnOutline}>
          <i className="ti ti-pencil" aria-hidden="true"></i> ערוך
        </button>
        <button onClick={onClose} style={styles.btnOutline}>סגור</button>
      </div>
    </Modal>
  );
}

const NOTE_MAX = 150;

function NoteEditModal({ run, onClose, onSaved }) {
  const [draft, setDraft] = useState(run.admin_note || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await updateScheduleRunNote(run.id, draft.trim());
      onSaved(run.id, res.data.admin_note);
    } catch (err) {
      alert('שמירת ההערה נכשלה. נסה/י שוב.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={run.admin_note ? 'עריכת הערה' : 'הוספת הערה'} titleSize="16px" padding="32px" onClose={onClose}>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        maxLength={NOTE_MAX}
        placeholder="כתבו כאן הערה על המערכת…"
        autoFocus
        style={{ ...styles.input, width: '100%', minHeight: '110px', resize: 'vertical', fontSize: '14px', lineHeight: 1.6, fontFamily: FONT }}
      />
      <div style={{ fontSize: '11px', color: '#c8baa6', textAlign: 'left', marginTop: '4px' }}>{draft.length}/{NOTE_MAX}</div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-start', marginTop: '18px' }}>
        <PrimaryButton onClick={save} busy={saving} style={{ padding: '9px 20px', fontSize: '14px', fontFamily: FONT }}>שמור</PrimaryButton>
        <button onClick={onClose} disabled={saving} style={styles.btnOutline}>ביטול</button>
      </div>
    </Modal>
  );
}

const classNames = (entries) =>
  [...new Set(entries.map(e => e.group_name))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'he'));

const thStyle = { padding: '8px', border: '1px solid #e2dacc', backgroundColor: '#EDF4E8', fontSize: '12px', color: '#4a3f35' };

function RunViewerModal({ run, onClose }) {
  const [entries, setEntries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);

  useEffect(() => {
    getScheduleRunEntries(run.id)
      .then(res => {
        const list = res.data.entries || res.data || [];
        setEntries(list);
        setSelectedClass(classNames(list)[0] || null);
      })
      .catch(() => setError('עדיין אי אפשר לצפות במערכות היסטוריות — צריך endpoint חדש בבקאנד (getScheduleRunEntries).'))
      .finally(() => setLoading(false));
  }, [run.id]);

  return (
    <Modal
      title="צפייה במערכת (לקריאה בלבד)"
      subtitle={`${fmtDateTime(run.run_at)} · ציון ${run.score ?? '—'}`}
      width="820px"
      padding="28px"
      overlay={0.25}
      maxHeight="86vh"
      onClose={onClose}
    >
      {loading ? (
        <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>טוען…</div>
      ) : error ? (
        <div style={{ textAlign: 'center', color: '#c0705a', padding: '30px', fontSize: '13px', lineHeight: 1.6 }}>{error}</div>
      ) : !entries || entries.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#c8baa6', padding: '30px', fontSize: '13px' }}>לא נמצאו שיעורים במערכת הזו.</div>
      ) : (
        <>
          <select
            value={selectedClass || ''}
            onChange={e => setSelectedClass(e.target.value)}
            style={{ ...styles.input, width: 'auto', minWidth: '200px', cursor: 'pointer', marginBottom: '16px' }}
          >
            {classNames(entries).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: '56px' }}>שעה</th>
                  {DAY_ORDER.map(d => <th key={d} style={thStyle}>{DAYS[d]}</th>)}
                </tr>
              </thead>
              <tbody>
                {HOURS.map(hour => (
                  <tr key={hour}>
                    <td style={{ border: '1px solid #f0ebe3', padding: '5px', textAlign: 'center', color: '#c8baa6', fontSize: '11px', backgroundColor: '#FAF7F2' }}>{hour}</td>
                    {DAY_ORDER.map(day => {
                      const lessons = entries.filter(e => e.group_name === selectedClass && e.day_of_week === day && e.hour_of_day === hour);
                      return (
                        <td key={day} style={{ border: '1px solid #f0ebe3', padding: '5px', verticalAlign: 'top', height: '52px' }}>
                          {lessons.map((e, idx) => (
                            <div key={idx} style={{ backgroundColor: '#F5F8F2', border: '1px solid #e3ecdb', borderRadius: '7px', padding: '4px 6px', fontSize: '10px', color: '#4a3f35', marginBottom: '3px' }}>
                              <div style={{ fontWeight: 700 }}>{e.subject_name}</div>
                              <div style={{ color: '#8a7a6e' }}>{e.teacher_first_name} {e.teacher_last_name}</div>
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}