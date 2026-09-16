import { useState, useEffect } from 'react';
import { getRooms, deleteRoom, updateRoom } from '../../services/api';
import AddRoomModal from '../AddRoomModal';
import EditModal from '../EditModal';
import { GridTable, PageHeader, AddButton, ConfirmDeleteModal } from './adminShared';

const ROOM_FIELDS = [
  { key: 'room_name', label: 'שם החדר', type: 'text' },
  { key: 'capacity', label: 'קיבולת', type: 'number' },
  { key: 'room_type', label: 'סוג חדר', type: 'text', optional: true },
];

export default function RoomsTab({ title }) {
  const [rooms, setRooms] = useState([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const load = () => getRooms().then(r => setRooms(r.data)).catch(() => { });
  useEffect(() => { load(); }, []);

  const handleSave = async (payload) => {
    await updateRoom(editing.id, payload);
    load();
  };

  const handleDelete = async () => {
    await deleteRoom(toDelete.id);
    setRooms(prev => prev.filter(r => r.id !== toDelete.id));
    setToDelete(null);
  };

  const rows = rooms.map(room => ({
    key: room.id,
    cells: [
      room.room_name,
      `${room.capacity} מקומות`,
    ],
    onRowClick: () => setEditing(room),
    actions: [
      { label: 'עריכה', icon: 'ti-edit', onClick: () => setEditing(room) },
      { label: 'מחיקה', icon: 'ti-trash', danger: true, onClick: () => setToDelete({ id: room.id, name: room.room_name }) },
    ],
  }));

  return (
    <>
      <PageHeader title={title} action={<AddButton label="הוסף חדר" onClick={() => setAdding(true)} />} />
      <GridTable headers={['שם החדר', 'קיבולת']} rows={rows} emptyText="אין חדרים עדיין" />

      {adding && <AddRoomModal onClose={() => setAdding(false)} onAdded={r => setRooms(prev => [...prev, r])} />}
      {editing && <EditModal title="עריכת חדר" initial={editing} fields={ROOM_FIELDS} onClose={() => setEditing(null)} onSave={handleSave} />}
      {toDelete && <ConfirmDeleteModal name={toDelete.name} onConfirm={handleDelete} onCancel={() => setToDelete(null)} />}
    </>
  );
}