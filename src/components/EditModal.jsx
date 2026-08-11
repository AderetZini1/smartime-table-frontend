import { useState } from 'react';

/**
 * Generic edit modal, styled to match AddTeacherModal.
 *
 * Props:
 *   title    - heading text, e.g. "עריכת חדר"
 *   fields   - [{ key, label, type: 'text'|'number'|'select', options?, optional? }]
 *              options (for select): [{ value, label }]
 *   initial  - object of current values keyed by field.key
 *   onSave   - async (values) => {}   (called with the edited object)
 *   onClose  - () => {}
 */
export default function EditModal({ title, fields, initial, onSave, onClose }) {
  const [values, setValues] = useState(() => {
    const v = {};
    fields.forEach(f => { v[f.key] = initial?.[f.key] ?? ''; });
    return v;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setField = (key, val) => setValues(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    // basic required check (fields not marked optional)
    for (const f of fields) {
      if (!f.optional && (values[f.key] === '' || values[f.key] === null || values[f.key] === undefined)) {
        setError(`יש למלא: ${f.label}`);
        return;
      }
    }
    setError('');
    setSaving(true);
    try {
      // coerce numbers + empty selects to null
      const payload = {};
      fields.forEach(f => {
        let val = values[f.key];
        if (f.type === 'number') val = val === '' ? null : Number(val);
        if (f.type === 'select') val = val === '' ? null : (isNaN(Number(val)) ? val : Number(val));
        payload[f.key] = val;
      });
      await onSave(payload);
      onClose();
    } catch (err) {
      console.error(err);
      setError('השמירה נכשלה. נסו שוב.');
      setSaving(false);
    }
  };

  const labelStyle = { display: 'block', fontSize: '12px', color: '#8a7a6e', marginBottom: '6px' };
  const inputStyle = {
    width: '100%', padding: '10px 14px', border: '1px solid #e2dacc',
    borderRadius: '8px', fontSize: '14px', color: '#4a3f35',
    backgroundColor: '#FAF7F2', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'Varela Round, sans-serif',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2dacc', padding: '36px', width: '460px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()} dir="rtl">

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h2 style={{ fontSize: '18px', color: '#4a3f35', margin: 0 }}>{title}</h2>
            <div style={{ width: '24px', height: '1.5px', backgroundColor: '#8a9e78', marginTop: '6px' }}></div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8baa6', fontSize: '20px' }}>✕</button>
        </div>

        {fields.map(f => (
          <div key={f.key} style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>
              {f.label}{f.optional && <span style={{ color: '#c8baa6', fontSize: '11px' }}> (אופציונלי)</span>}
            </label>
            {f.type === 'select' ? (
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={values[f.key] ?? ''} onChange={e => setField(f.key, e.target.value)}>
                <option value="">— ללא —</option>
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input
                type={f.type === 'number' ? 'number' : 'text'}
                style={inputStyle}
                value={values[f.key] ?? ''}
                onChange={e => setField(f.key, e.target.value)}
              />
            )}
          </div>
        ))}

        {error && <div style={{ fontSize: '12px', color: '#c0705a', marginBottom: '14px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', border: '1px solid #e2dacc', borderRadius: '8px', background: 'none', color: '#8a7a6e', cursor: 'pointer', fontSize: '14px', fontFamily: 'Varela Round, sans-serif' }}>
            ביטול
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', backgroundColor: '#8a9e78', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'Varela Round, sans-serif', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'שומר...' : 'שמור שינויים'}
          </button>
        </div>
      </div>
    </div>
  );
}
