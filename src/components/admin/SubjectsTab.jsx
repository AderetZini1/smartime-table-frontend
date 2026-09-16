import { useState, useEffect } from 'react';
import { getSubjects, getRooms, deleteSubject, updateSubject } from '../../services/api';
import AddSubjectModal from '../AddSubjectModal';
import EditModal from '../EditModal';
import { GridTable, PageHeader, AddButton, ConfirmDeleteModal } from './adminShared';

export default function SubjectsTab({ title }) {
  const [subjects, setSubjects] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const load = () => getSubjects().then(r => setSubjects(r.data)).catch(() => { });
  useEffect(() => {
    load();
    getRooms().then(r => setRooms(r.data)).catch(() => { });
  }, []);

  const handleSave = async (payload) => {
    await updateSubject(editing.id, payload);
    load();
  };

  const handleDelete = async () => {
    await deleteSubject(toDelete.id);
    setSubjects(prev => prev.filter(s => s.id !== toDelete.id));
    setToDelete(null);
  };

  const roomName = (id) => (id ? rooms.find(r => r.id === id)?.room_name || '—' : '—');

  const rows = subjects.map(subject => ({
    key: subject.id,
    cells: [
      subject.subject_name,
      <span style={{ color: '#8a7a6e' }}>{roomName(subject.required_room_id)}</span>,
    ],
    onRowClick: () => setEditing(subject),
    actions: [
      { label: 'עריכה', icon: 'ti-edit', onClick: () => setEditing(subject) },
      { label: 'מחיקה', icon: 'ti-trash', danger: true, onClick: () => setToDelete({ id: subject.id, name: subject.subject_name }) },
    ],
  }));

  const fields = [
    { key: 'subject_name', label: 'שם המקצוע', type: 'text' },
    { key: 'required_room_id', label: 'חדר נדרש', type: 'select', optional: true, options: rooms.map(r => ({ value: r.id, label: r.room_name })) },
  ];

  return (
    <>
      <PageHeader title={title} action={<AddButton label="הוסף מקצוע" onClick={() => setAdding(true)} />} />
      <GridTable headers={['שם המקצוע', 'חדר ייעודי']} rows={rows} emptyText="אין מקצועות עדיין" />

      {adding && <AddSubjectModal rooms={rooms} onClose={() => setAdding(false)} onAdded={s => setSubjects(prev => [...prev, s])} />}
      {editing && <EditModal title="עריכת מקצוע" initial={editing} fields={fields} onClose={() => setEditing(null)} onSave={handleSave} />}
      {toDelete && <ConfirmDeleteModal name={toDelete.name} onConfirm={handleDelete} onCancel={() => setToDelete(null)} />}
    </>
  );
}