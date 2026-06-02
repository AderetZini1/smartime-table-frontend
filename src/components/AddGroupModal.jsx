import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { createStudentGroup } from '../services/api';

const schema = yup.object({
  group_name: yup.string().required('שם הקבוצה הוא שדה חובה'),
  student_count: yup.number().typeError('יש להזין מספר').required('מספר תלמידים הוא שדה חובה').min(1, 'מינימום תלמיד אחד').max(50, 'מקסימום 50 תלמידים'),
  home_room_id: yup.number().typeError('יש לבחור חדר').required('חדר בית הוא שדה חובה'),
});

export default function AddGroupModal({ onClose, onAdded, rooms }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: yupResolver(schema)
  });

  const onSubmit = async (data) => {
    try {
      const res = await createStudentGroup(data);
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
            <h2 style={{ fontSize: '18px', color: '#4a3f35', margin: 0 }}>הוסף קבוצה</h2>
            <div style={{ width: '24px', height: '1.5px', backgroundColor: '#8a9e78', marginTop: '6px' }}></div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8baa6', fontSize: '20px' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>שם הקבוצה *</label>
            <input {...register('group_name')} style={inputStyle(errors.group_name)} placeholder="כיתה א׳1 / י׳2" />
            {errors.group_name && <p style={errorStyle}>{errors.group_name.message}</p>}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>מספר תלמידים * <span style={{ color: '#c8baa6', fontSize: '11px' }}>(1-50)</span></label>
            <input {...register('student_count')} type="number" style={inputStyle(errors.student_count)} placeholder="30" min="1" max="50" />
            {errors.student_count && <p style={errorStyle}>{errors.student_count.message}</p>}
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label style={labelStyle}>חדר בית *</label>
            <select {...register('home_room_id')} style={{ ...inputStyle(errors.home_room_id), cursor: 'pointer' }}>
              <option value="">בחר חדר בית</option>
              {rooms?.map(room => (
                <option key={room.id} value={room.id}>{room.room_name} ({room.capacity} מקומות)</option>
              ))}
            </select>
            {errors.home_room_id && <p style={errorStyle}>{errors.home_room_id.message}</p>}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', border: '1px solid #e2dacc', borderRadius: '8px', background: 'none', color: '#8a7a6e', cursor: 'pointer', fontSize: '14px', fontFamily: 'Varela Round, sans-serif' }}>
              ביטול
            </button>
            <button type="submit" disabled={isSubmitting} style={{ padding: '10px 24px', backgroundColor: '#8a9e78', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'Varela Round, sans-serif', opacity: isSubmitting ? 0.7 : 1 }}>
              {isSubmitting ? 'שומר...' : 'הוסף קבוצה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}