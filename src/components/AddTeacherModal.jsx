import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { createTeacher, updateTeacher } from '../services/api';

// In edit mode the password is optional (blank = keep current) and the
// teacher_identity (ID) is read-only. In add mode both are required as before.
const makeSchema = (isEdit) => yup.object({
  first_name: yup.string().required('שם פרטי הוא שדה חובה'),
  last_name: yup.string().required('שם משפחה הוא שדה חובה'),
  teacher_identity: isEdit
    ? yup.string().nullable()
    : yup
        .string()
        .required('תעודת זהות היא שדה חובה')
        .matches(/^[0-9]{9}$/, 'תעודת זהות חייבת להכיל בדיוק 9 ספרות'),
  email: yup.string().required('אימייל הוא שדה חובה').email('כתובת אימייל לא תקינה'),
  phone_number: yup
    .string()
    .matches(/^05[0-9]{8}$/, 'מספר טלפון לא תקין')
    .nullable()
    .transform(v => v === '' ? null : v),
  weekly_hours_quota: yup
    .number()
    .typeError('יש להזין מספר')
    .required('מכסת שעות היא שדה חובה')
    .min(1, 'מינימום שעה אחת')
    .max(40, 'מקסימום 40 שעות'),
  password: isEdit
    ? yup.string().transform(v => v === '' ? undefined : v).min(6, 'סיסמה חייבת להכיל לפחות 6 תווים').notRequired()
    : yup.string().required('סיסמה היא שדה חובה').min(6, 'סיסמה חייבת להכיל לפחות 6 תווים'),
  teacher_color: yup.string().default('#8a9e78'),
});

export default function AddTeacherModal({ onClose, onAdded, onUpdated, teacher }) {
  const isEdit = !!teacher;

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: yupResolver(makeSchema(isEdit)),
    defaultValues: isEdit
      ? {
          first_name: teacher.first_name || '',
          last_name: teacher.last_name || '',
          teacher_identity: teacher.teacher_identity || '',
          email: teacher.email || '',
          phone_number: teacher.phone_number || '',
          weekly_hours_quota: teacher.weekly_hours_quota ?? '',
          teacher_color: teacher.teacher_color || '#8a9e78',
          password: '',
        }
      : { teacher_color: '#8a9e78' },
  });

  const onSubmit = async (data) => {
    try {
      if (isEdit) {
        // Only send fields the update endpoint accepts; omit blank password
        // and never send teacher_identity (it can't change).
        const payload = {
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone_number: data.phone_number || null,
          weekly_hours_quota: data.weekly_hours_quota,
          teacher_color: data.teacher_color,
        };
        if (data.password) payload.password = data.password;
        const res = await updateTeacher(teacher.id, payload);
        if (onUpdated) onUpdated(res.data);
      } else {
        const res = await createTeacher(data);
        if (onAdded) onAdded(res.data);
      }
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const pwd = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setValue('password', pwd);
  };

  const inputStyle = (hasError, disabled) => ({
    width: '100%', padding: '10px 14px',
    border: `1px solid ${hasError ? '#c0705a' : '#e2dacc'}`,
    borderRadius: '8px', fontSize: '14px', color: disabled ? '#8a7a6e' : '#4a3f35',
    backgroundColor: disabled ? '#f0ebe3' : (hasError ? '#fff8f6' : '#FAF7F2'),
    outline: 'none', boxSizing: 'border-box',
    fontFamily: 'Varela Round, sans-serif',
    cursor: disabled ? 'not-allowed' : 'text',
  });

  const labelStyle = { display: 'block', fontSize: '12px', color: '#8a7a6e', marginBottom: '6px' };
  const errorStyle = { fontSize: '11px', color: '#c0705a', marginTop: '4px' };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2dacc', padding: '36px', width: '500px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()} dir="rtl">

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h2 style={{ fontSize: '18px', color: '#4a3f35', margin: 0 }}>{isEdit ? 'עריכת מורה' : 'הוסף מורה'}</h2>
            <div style={{ width: '24px', height: '1.5px', backgroundColor: '#8a9e78', marginTop: '6px' }}></div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8baa6', fontSize: '20px' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>שם פרטי *</label>
              <input {...register('first_name')} style={inputStyle(errors.first_name)} placeholder="שם פרטי" />
              {errors.first_name && <p style={errorStyle}>{errors.first_name.message}</p>}
            </div>
            <div>
              <label style={labelStyle}>שם משפחה *</label>
              <input {...register('last_name')} style={inputStyle(errors.last_name)} placeholder="שם משפחה" />
              {errors.last_name && <p style={errorStyle}>{errors.last_name.message}</p>}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>
              תעודת זהות {isEdit ? <span style={{ color: '#c8baa6', fontSize: '11px' }}>(לא ניתן לשינוי)</span> : <span style={{ color: '#c8baa6', fontSize: '11px' }}>(9 ספרות)</span>}
            </label>
            <input {...register('teacher_identity')} style={inputStyle(errors.teacher_identity, isEdit)} placeholder="123456789" maxLength={9} readOnly={isEdit} />
            {errors.teacher_identity && <p style={errorStyle}>{errors.teacher_identity.message}</p>}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>אימייל *</label>
            <input {...register('email')} type="email" style={inputStyle(errors.email)} placeholder="example@school.com" />
            {errors.email && <p style={errorStyle}>{errors.email.message}</p>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>טלפון <span style={{ color: '#c8baa6', fontSize: '11px' }}>(אופציונלי)</span></label>
              <input {...register('phone_number')} style={inputStyle(errors.phone_number)} placeholder="05X-XXXXXXX" />
              {errors.phone_number && <p style={errorStyle}>{errors.phone_number.message}</p>}
            </div>
            <div>
              <label style={labelStyle}>מכסת שעות שבועית * <span style={{ color: '#c8baa6', fontSize: '11px' }}>(1-40)</span></label>
              <input {...register('weekly_hours_quota')} type="number" style={inputStyle(errors.weekly_hours_quota)} placeholder="22" min="1" max="40" />
              {errors.weekly_hours_quota && <p style={errorStyle}>{errors.weekly_hours_quota.message}</p>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
            <div>
              <label style={labelStyle}>
                {isEdit ? 'איפוס סיסמה' : 'סיסמה זמנית *'}
                {isEdit
                  ? <span style={{ color: '#c8baa6', fontSize: '11px' }}> (השאר ריק לשמירת הקיימת)</span>
                  : <span style={{ color: '#c8baa6', fontSize: '11px' }}> (מינימום 6 תווים)</span>}
              </label>
              <button type="button" onClick={generatePassword} style={{ marginBottom: '8px', padding: '7px 12px', backgroundColor: 'transparent', border: '1px solid #e2dacc', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: '#8a7a6e', fontFamily: 'Varela Round, sans-serif' }}>
                צור סיסמה אוטומטית
              </button>
              <input {...register('password')} type="text" style={inputStyle(errors.password)} placeholder={isEdit ? 'סיסמה חדשה (רק אם רוצים לאפס)' : 'סיסמה ראשונית'} />
              {errors.password && <p style={errorStyle}>{errors.password.message}</p>}
            </div>
            <div>
              <label style={labelStyle}>צבע תצוגה</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input {...register('teacher_color')} type="color" style={{ width: '40px', height: '40px', border: '1px solid #e2dacc', borderRadius: '8px', cursor: 'pointer', padding: '2px' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', border: '1px solid #e2dacc', borderRadius: '8px', background: 'none', color: '#8a7a6e', cursor: 'pointer', fontSize: '14px', fontFamily: 'Varela Round, sans-serif' }}>
              ביטול
            </button>
            <button type="submit" disabled={isSubmitting} style={{ padding: '10px 24px', backgroundColor: '#8a9e78', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'Varela Round, sans-serif', opacity: isSubmitting ? 0.7 : 1 }}>
              {isSubmitting ? 'שומר...' : (isEdit ? 'שמור שינויים' : 'הוסף מורה')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
