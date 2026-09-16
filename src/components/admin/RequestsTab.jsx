import { useState, useEffect } from 'react';
import { getMyRequests, getTeachers, respondToRequest, sendNotification } from '../../services/api';
import { styles } from '../../pages/adminDashboard.styles';
import { fmtDate } from '../../utils/format';
import { REQUEST_TYPES, statusLabel, colorForTeacher, initials, fullName, byName, PageHeader, EmptyCard, FilterPills, Modal, apiErrorMessage } from './adminShared';

const STATUS_STYLE = {
  approved: { bg: '#EDF4E8', color: '#4a7c3f' },
  rejected: { bg: '#FAE8E8', color: '#c0705a' },
  pending: { bg: '#FFF3D6', color: '#a08c30' },
};

const filterSelect = (minWidth) => ({ ...styles.input, width: 'auto', minWidth, padding: '12px 16px', fontSize: '15px', cursor: 'pointer' });
const countPending = (list) => list.filter(r => r.status === 'pending').length;

export default function RequestsTab({ title, onPendingCountChange }) {
  const [requests, setRequests] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [primaryFilter, setPrimaryFilter] = useState('all'); // 'all' | 'pending' | 'resolved'
  const [statusFilter, setStatusFilter] = useState('all');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [respondTo, setRespondTo] = useState(null);

  useEffect(() => {
    getTeachers().then(r => setTeachers(r.data)).catch(() => { });
    getMyRequests().then(r => {
      setRequests(r.data);
      onPendingCountChange(countPending(r.data));
    }).catch(() => { });
  }, []);

  const pending = countPending(requests);
  const hasFilters = statusFilter !== 'all' || teacherFilter !== 'all' || typeFilter !== 'all';

  const filtered = requests
    .filter(r => {
      if (primaryFilter === 'pending' && r.status !== 'pending') return false;
      if (primaryFilter === 'resolved' && r.status === 'pending') return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (teacherFilter !== 'all' && r.teacher_id !== parseInt(teacherFilter)) return false;
      if (typeFilter !== 'all' && r.request_type !== typeFilter) return false;
      return true;
    })
    .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1));

  const handleResponded = (id, response) => {
    const next = requests.map(r => (r.id === id ? { ...r, ...response } : r));
    setRequests(next);
    onPendingCountChange(countPending(next));
    setRespondTo(null);
  };

  const clearFilters = () => { setStatusFilter('all'); setTeacherFilter('all'); setTypeFilter('all'); };

  return (
    <>
      <PageHeader title={title} />

      <FilterPills
        marginBottom="18px"
        value={primaryFilter}
        onChange={setPrimaryFilter}
        options={[
          { id: 'all', label: 'הכל' },
          { id: 'pending', label: `ממתינות לטיפול${pending ? ` (${pending})` : ''}` },
          { id: 'resolved', label: 'טופלו' },
        ]}
      />

      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={filterSelect('160px')}>
          <option value="all">כל הסטטוסים</option>
          <option value="pending">ממתין</option>
          <option value="approved">אושר</option>
          <option value="rejected">נדחה</option>
        </select>
        <select value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)} style={filterSelect('180px')}>
          <option value="all">כל המורים</option>
          {teachers.filter(t => !t.is_admin).sort(byName).map(t => (
            <option key={t.id} value={t.id}>{fullName(t)}</option>
          ))}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={filterSelect('170px')}>
          <option value="all">כל הנושאים</option>
          {Object.entries(REQUEST_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        {hasFilters && (
          <button onClick={clearFilters} style={{ ...styles.btnOutline, padding: '12px 18px', fontSize: '15px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <i className="ti ti-filter-off" aria-hidden="true"></i> נקה סינון
          </button>
        )}
      </div>

      {requests.length === 0 ? (
        <EmptyCard>אין פניות עדיין</EmptyCard>
      ) : filtered.length === 0 ? (
        <EmptyCard>אין פניות התואמות את הסינון</EmptyCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '700px', margin: '0 auto' }}>
          {filtered.map(req => (
            <RequestCard
              key={req.id}
              request={req}
              teacher={teachers.find(t => t.id === req.teacher_id)}
              onRespond={() => setRespondTo(req)}
            />
          ))}
        </div>
      )}

      {respondTo && <RespondModal request={respondTo} onClose={() => setRespondTo(null)} onDone={handleResponded} />}
    </>
  );
}

function RequestCard({ request: req, teacher, onRespond }) {
  const teacherColor = colorForTeacher(req.teacher_id);
  const statusStyle = STATUS_STYLE[req.status] || STATUS_STYLE.pending;
  const resolved = req.status !== 'pending';

  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #e2dacc', borderRadius: '12px', padding: '16px 18px', opacity: resolved ? 0.8 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ ...styles.avatar, backgroundColor: teacherColor.bg, color: teacherColor.color }}>{initials(teacher)}</div>
          <span style={{ fontSize: '14px', color: '#4a3f35', fontWeight: 700 }}>{fullName(teacher)}</span>
          <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '20px', backgroundColor: '#f5f2ee', color: '#8a7a6e' }}>
            {REQUEST_TYPES[req.request_type] || req.request_type}
          </span>
        </div>
        <span style={{ fontSize: '14px', padding: '6px 16px', borderRadius: '20px', backgroundColor: statusStyle.bg, color: statusStyle.color }}>
          {statusLabel(req.status)}
        </span>
      </div>
      <div style={{ fontSize: '13px', color: '#4a3f35', marginBottom: '10px' }}>{req.description}</div>
      {req.admin_response && (
        <div style={{ backgroundColor: '#FAF7F2', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
          <div style={{ fontSize: '11px', color: '#c8baa6', marginBottom: '3px' }}>תשובת ההנהלה</div>
          <div style={{ fontSize: '13px', color: '#4a3f35' }}>{req.admin_response}</div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: '#c8baa6' }}>{fmtDate(req.created_at)}</span>
        {!resolved && <button onClick={onRespond} style={styles.btnAdd}>טפל</button>}
      </div>
    </div>
  );
}

function RespondModal({ request, onClose, onDone }) {
  const [response, setResponse] = useState({ status: 'approved', admin_response: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await respondToRequest(request.id, response);
    } catch (err) {
      setError(apiErrorMessage(err, 'שמירת התשובה נכשלה. נסה/י שוב.'));
      setBusy(false);
      return;
    }

    // Let the teacher know their request was handled. A failure here
    // shouldn't undo the response itself, so it's isolated in its own try/catch.
    if (request.teacher_id) {
      try {
        const typeLabel = REQUEST_TYPES[request.request_type] || request.request_type;
        const approved = response.status === 'approved';
        const note = response.admin_response?.trim();
        await sendNotification({
          title: approved ? 'הפנייה שלך אושרה' : 'הפנייה שלך נדחתה',
          body: note || `הפנייה שלך בנושא "${typeLabel}" ${approved ? 'אושרה' : 'נדחתה'} על ידי ההנהלה.`,
          teacher_ids: [request.teacher_id],
        });
      } catch (e) {
        console.error('Failed to notify teacher about request response', e);
      }
    }

    onDone(request.id, response);
  };

  return (
    <Modal title="טיפול בפנייה" onClose={onClose}>
      <div style={{ backgroundColor: '#FAF7F2', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#4a3f35' }}>
        {request.description}
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={styles.label}>החלטה</label>
        <select value={response.status} onChange={e => setResponse({ ...response, status: e.target.value })} style={{ ...styles.input, cursor: 'pointer' }}>
          <option value="approved">אשר</option>
          <option value="rejected">דחה</option>
        </select>
      </div>
      <div style={{ marginBottom: '24px' }}>
        <label style={styles.label}>תשובה למורה (אופציונלי)</label>
        <textarea value={response.admin_response} onChange={e => setResponse({ ...response, admin_response: e.target.value })} style={{ ...styles.input, height: '80px', resize: 'vertical' }} placeholder="הסבר את ההחלטה..." />
      </div>
      {error && (
        <div style={{ fontSize: '13px', color: '#c0705a', backgroundColor: '#fff3f0', border: '1px solid #f0c9be', borderRadius: '8px', padding: '8px 12px', marginBottom: '16px' }}>{error}</div>
      )}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button onClick={onClose} disabled={busy} style={styles.btnOutline}>ביטול</button>
        <button onClick={submit} disabled={busy} style={{ ...styles.btnAdd, opacity: busy ? 0.6 : 1 }}>{busy ? 'שולח…' : 'שלח תשובה'}</button>
      </div>
    </Modal>
  );
}