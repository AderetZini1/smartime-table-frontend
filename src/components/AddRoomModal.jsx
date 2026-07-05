import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { createRoom } from '../services/api';

const schema = yup.object({
  room_name: yup.string().required('שם החדר הוא שדה חובה'),
  capacity: yup.number().typeError('יש להזין מספר').required('קיבולת היא שדה חובה').min(1, 'מינימום מקום אחד').max(100, 'מקסימום 100 מקומות'),
});

export default function AddRoomModal({ onClose, onAdded }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: yupResolver(schema)
  });
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  const onSubmit = async (data) => {
    setSubmitError('');
    try {
      const res = await createRoom(data);
      onAdded(res.data);
      setSuccess(true);
      // סוגרים את המודאל אחרי שהמשתמשת רואה את הודעת ההצלחה לרגע
      setTimeout(() => onClose(), 900);
    } catch (err) {
      console.error(err);
      // מציגים שגיאה ברורה במקום לבלוע אותה בשקט
      const serverMessage = err?.response?.data?.detail;
      setSubmitError(
        typeof serverMessage === 'string'
          ? serverMessage
          : 'אירעה שגיאה בהוספת החדר. נסה/י שוב.'
      );
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
            <h2 style={{ fontSize: '18px', color: '#4a3f35', margin: 0 }}>הוסף חדר</h2>
            <div style={{ width: '24px', height: '1.5px', backgroundColor: '#8a9e78', marginTop: '6px' }}></div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8baa6', fontSize: '20px' }}>✕</button>
        </div>

        {success ? (
          // מצב הצלחה — מוצג לרגע לפני סגירה אוטומטית
          <div style={{ textAlign: 'center', padding: '20px 0 28px' }}>
            <i className="ti ti-circle-check" style={{ fontSize: '40px', color: '#8a9e78', display: 'block', marginBottom: '12px' }} aria-hidden="true"></i>
            <div style={{ fontSize: '15px', color: '#4a3f35' }}>החדר נוסף בהצלחה</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>שם החדר *</label>
              <input {...register('room_name')} style={inputStyle(errors.room_name)} placeholder="כיתה א׳ / מעבדה / אולם ספורט" />
              {errors.room_name && <p style={errorStyle}>{errors.room_name.message}</p>}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>קיבולת * <span style={{ color: '#c8baa6', fontSize: '11px' }}>(מספר מקומות)</span></label>
              <input {...register('capacity')} type="number" style={inputStyle(errors.capacity)} placeholder="30" min="1" max="100" />
              {errors.capacity && <p style={errorStyle}>{errors.capacity.message}</p>}
            </div>

            {/* שגיאת שרת — מוצגת רק אם הבקשה נכשלה בפועל, כדי שלא נישאר תקועים בשקט */}
            {submitError && (
              <div style={{ marginBottom: '20px', backgroundColor: '#fff8f6', border: '1px solid #f0c9bc', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ti ti-alert-circle" style={{ fontSize: '16px', color: '#c0705a', flexShrink: 0 }} aria-hidden="true"></i>
                <span style={{ fontSize: '12px', color: '#a8503c' }}>{submitError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} style={{ padding: '10px 20px', border: '1px solid #e2dacc', borderRadius: '8px', background: 'none', color: '#8a7a6e', cursor: 'pointer', fontSize: '14px', fontFamily: 'Varela Round, sans-serif' }}>
                ביטול
              </button>
              <button type="submit" disabled={isSubmitting} style={{ padding: '10px 24px', backgroundColor: '#8a9e78', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'Varela Round, sans-serif', opacity: isSubmitting ? 0.7 : 1 }}>
                {isSubmitting ? 'שומר...' : 'הוסף חדר'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}