import { useState, useEffect } from 'react';
import { getStudentGroups, getRooms, deleteStudentGroup, updateStudentGroup } from '../../services/api';
import AddGroupModal from '../AddGroupModal';
import EditModal from '../EditModal';
import { GridTable, PageHeader, AddButton, ConfirmDeleteModal } from './adminShared';

export default function GroupsTab({ title }) {
  const [groups, setGroups] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const load = () => getStudentGroups().then(r => setGroups(r.data)).catch(() => { });
  useEffect(() => {
    load();
    getRooms().then(r => setRooms(r.data)).catch(() => { });
  }, []);

  const handleSave = async (payload) => {
    await updateStudentGroup(editing.id, payload);
    load();
  };

  const handleDelete = async () => {
    await deleteStudentGroup(toDelete.id);
    setGroups(prev => prev.filter(g => g.id !== toDelete.id));
    setToDelete(null);
  };

  const rows = groups.map(group => ({
    key: group.id,
    cells: [
      group.group_name,
      group.student_count,
      <span style={{ color: '#8a7a6e' }}>{rooms.find(r => r.id === group.home_room_id)?.room_name || '—'}</span>,
    ],
    onRowClick: () => setEditing(group),
    actions: [
      { label: 'עריכה', icon: 'ti-edit', onClick: () => setEditing(group) },
      { label: 'מחיקה', icon: 'ti-trash', danger: true, onClick: () => setToDelete({ id: group.id, name: group.group_name }) },
    ],
  }));

  const fields = [
    { key: 'group_name', label: 'שם הקבוצה', type: 'text' },
    { key: 'student_count', label: 'מספר תלמידים', type: 'number' },
    { key: 'home_room_id', label: 'חדר בית', type: 'select', optional: true, options: rooms.map(r => ({ value: r.id, label: r.room_name })) },
  ];

  return (
    <>
      <PageHeader title={title} action={<AddButton label="הוסף קבוצה" onClick={() => setAdding(true)} />} />
      <GridTable headers={['שם הקבוצה', 'תלמידים', 'חדר בית']} rows={rows} emptyText="אין קבוצות עדיין" />

      {adding && <AddGroupModal rooms={rooms} onClose={() => setAdding(false)} onAdded={g => setGroups(prev => [...prev, g])} />}
      {editing && <EditModal title="עריכת קבוצה" initial={editing} fields={fields} onClose={() => setEditing(null)} onSave={handleSave} />}
      {toDelete && <ConfirmDeleteModal name={toDelete.name} onConfirm={handleDelete} onCancel={() => setToDelete(null)} />}
    </>
  );
}