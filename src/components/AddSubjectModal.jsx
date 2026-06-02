import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { createSubject } from '../services/api';

const schema = yup.object({
  subject_name: yup.string().required('שם המקצוע הוא שדה חובה'),
  required_room_id: yup.mixed().nullable().transform(v => v === '' ? null : Number(v) || null),
});

export default function AddSubjectModal({ onClose, onAdded, rooms }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { required_room_id: '' }
  });

  const onSubmit = async (data) => {
    try {
      const res = await createSubject(data);
      onAdded(res.data);
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const inputStyle = (hasError) => ({
    width: '100%', padding: '10px 14px',
    border: `1px solid ${hasError ? '#c0705a' : '#e2dacc'}`,
    borderRadius: '8px', fontSize: '14px', color: '#4a3f35',
    backgroundColor: hasError ? '#fff8f6' : '#FAF7F2',
    outline: 'none', boxSizing: 'border-box',
    fontFamily: 'Varela Round, sans-serif'
  });

  const labelStyle = { display: 'block', fontSize: '12px', color: '#8a7a6e', marginBottom: '6px' };
  const errorStyle = { fontSize: '11px', color: '#c0705a', marginTop: '4px' };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2dacc', padding: '36px', width: '420px' }} onClick={e => e.stopPropagation()} dir="rtl">

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h2 style={{ fontSize: '18px', color: '#4a3f35', margin: 0 }}>הוסף מקצוע</h2>
            <div style={{ width: '24px', height: '1.5px', backgroundColor: '#8a9e78', marginTop: '6px' }}></div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8baa6', fontSize: '20px' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>שם המקצוע *</label>
            <input {...register('subject_name')} style={inputStyle(errors.subject_name)} placeholder="מתמטיקה / אנגלית / ספורט" />
            {errors.subject_name && <p style={errorStyle}>{errors.subject_name.message}</p>}
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label style={labelStyle}>חדר ייעודי <span style={{ color: '#c8baa6', fontSize: '11px' }}>(אופציונלי)</span></label>
            <select {...register('required_room_id')} style={{ ...inputStyle(false), cursor: 'pointer' }}>
              <option value="">ללא חדר ייעודי</option>
              {rooms?.map(room => (
                <option key={room.id} value={room.id}>{room.room_name} ({room.capacity} מקומות)</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', border: '1px solid #e2dacc', borderRadius: '8px', background: 'none', color: '#8a7a6e', cursor: 'pointer', fontSize: '14px', fontFamily: 'Varela Round, sans-serif' }}>
              ביטול
            </button>
            <button type="submit" disabled={isSubmitting} style={{ padding: '10px 24px', backgroundColor: '#8a9e78', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'Varela Round, sans-serif', opacity: isSubmitting ? 0.7 : 1 }}>
              {isSubmitting ? 'שומר...' : 'הוסף מקצוע'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}