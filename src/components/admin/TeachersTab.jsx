import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getTeachers, deleteTeacher } from '../../services/api';
import { styles } from '../../pages/adminDashboard.styles';
import AddTeacherModal from '../AddTeacherModal';
import { GridTable, PageHeader, AddButton, ConfirmDeleteModal, colorForTeacher, initials, fullName, byName } from './adminShared';

export default function TeachersTab({ title }) {
  const { user } = useAuth();
  const isMe = (t) => user?.id != null && Number(t.id) === Number(user.id);
  const [teachers, setTeachers] = useState([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const load = () => getTeachers().then(r => setTeachers(r.data)).catch(() => { });
  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    await deleteTeacher(toDelete.id);
    setTeachers(prev => prev.filter(t => t.id !== toDelete.id));
    setToDelete(null);
  };

  const rows = [...teachers].sort(byName).map(teacher => {
    const c = colorForTeacher(teacher.id);
    return {
      key: teacher.id,
      cells: [
        <>
          <div style={{ ...styles.avatar, backgroundColor: c.bg, color: c.color }}>{initials(teacher)}</div>
          <span>{fullName(teacher)}</span>
        </>,
        <span style={{ color: '#8a7a6e' }}>{teacher.email}</span>,
        teacher.weekly_hours_quota ?? '—',
        <span style={{ ...styles.badge, ...(teacher.is_admin ? { backgroundColor: '#E8F2FA', color: '#5a8ac0' } : {}) }}>
          {teacher.is_admin ? 'מנהל' : 'מורה'}
        </span>,
      ],
      onRowClick: () => setEditing(teacher),
      actions: [
        { label: 'עריכה', icon: 'ti-edit', onClick: () => setEditing(teacher) },
        !isMe(teacher) && { label: 'מחיקה', icon: 'ti-trash', danger: true, onClick: () => setToDelete({ id: teacher.id, name: fullName(teacher) }) },
      ],
    };
  });

  return (
    <>
      <PageHeader title={title} action={<AddButton label="הוסף מורה" onClick={() => setAdding(true)} />} />
      <GridTable headers={['שם', 'אימייל', 'שעות', 'תפקיד']} rows={rows} emptyText="אין מורים עדיין" />

      {adding && <AddTeacherModal onClose={() => setAdding(false)} onAdded={t => setTeachers(prev => [...prev, t])} />}
      {editing && <AddTeacherModal teacher={editing} onClose={() => setEditing(null)} onUpdated={load} />}
      {toDelete && <ConfirmDeleteModal name={toDelete.name} onConfirm={handleDelete} onCancel={() => setToDelete(null)} />}
    </>
  );
}