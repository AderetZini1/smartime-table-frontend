import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getStudentGroups } from '../services/api';

const styles = {
  layout: { backgroundColor: '#FAF7F2', minHeight: '100vh', direction: 'rtl' },
  topbar: { display: 'flex', alignItems: 'center', gap: '16px', padding: '24px 48px', borderBottom: '1px solid #e2dacc', backgroundColor: '#fff' },
  backBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid #e2dacc', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', color: '#8a7a6e', cursor: 'pointer', fontFamily: 'Varela Round, sans-serif' },
  title: { fontSize: '20px', color: '#4a3f35', margin: 0 },
  main: { padding: '40px 48px' },
  card: { backgroundColor: '#fff', borderRadius: '14px', border: '1px solid #e2dacc', padding: '24px', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};

export default function ClassSchedule() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);

  useEffect(() => {
    getStudentGroups().then(r => {
      const found = r.data.find(g => String(g.id) === String(groupId));
      setGroup(found || null);
    }).catch(() => {});
  }, [groupId]);

  return (
    <div style={styles.layout}>
      <div style={styles.topbar}>
        <button onClick={() => navigate('/admin')} style={styles.backBtn}>
          <i className="ti ti-arrow-right" aria-hidden="true"></i> חזרה
        </button>
        <h1 style={styles.title}>
          מערכת שעות — {group ? group.group_name : `כיתה ${groupId}`}
        </h1>
      </div>

      <div style={styles.main}>
        {/* כאשר האלגוריתם יוכן, כאן יוצג רכיב מערכת השעות בפועל עבור הכיתה הזו */}
        <div style={styles.card}>
          <div style={{ textAlign: 'center', color: '#c8baa6' }}>
            <i className="ti ti-calendar-off" style={{ fontSize: '36px', display: 'block', marginBottom: '14px' }} aria-hidden="true"></i>
            <div style={{ fontSize: '15px', color: '#8a7a6e', marginBottom: '4px' }}>טרם נוצרה מערכת שעות</div>
            <div style={{ fontSize: '13px' }}>המערכת תוצג כאן לאחר הרצת אלגוריתם השיבוץ</div>
          </div>
        </div>
      </div>
    </div>
  );
}