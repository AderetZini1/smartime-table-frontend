import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getTeachers, deleteTeacher } from '../services/api';

const TABS = [
  { id: 'schedule', label: 'מערכת שעות', icon: 'ti-calendar' },
  { id: 'notifications', label: 'התראות', icon: 'ti-bell' },
  { id: 'teachers', label: 'מורים', icon: 'ti-users' },
  { id: 'rooms', label: 'חדרים', icon: 'ti-building' },
  { id: 'subjects', label: 'מקצועות', icon: 'ti-book' },
  { id: 'groups', label: 'קבוצות', icon: 'ti-school' },
];

const s = {
  layout: { display: 'flex', backgroundColor: '#FAF7F2', minHeight: '100vh', direction: 'rtl' },
  sidebar: { width: '260px', backgroundColor: '#fff', borderLeft: '1px solid #e2dacc', display: 'flex', flexDirection: 'column', padding: '28px 0', flexShrink: 0 },
  sidebarTop: { padding: '0 24px', marginBottom: '32px' },
  brand: { fontSize: '11px', letterSpacing: '0.14em', color: '#c8baa6', marginBottom: '4px' },
  brandName: { fontSize: '17px', color: '#4a3f35' },
  navItem: (active) => ({
    padding: '13px 24px', fontSize: '15px',
    color: active ? '#4a3f35' : '#8a7a6e',
    display: 'flex', alignItems: 'center', gap: '12px',
    cursor: 'pointer',
    borderRight: active ? '3px solid #8a9e78' : '3px solid transparent',
    backgroundColor: active ? '#FAF7F2' : 'transparent',
    border: 'none', width: '100%', textAlign: 'right',
    fontFamily: 'Varela Round, sans-serif',
  }),
  divider: { margin: '12px 24px', borderBottom: '1px solid #e2dacc' },
  main: { flex: 1, padding: '40px 48px' },
  pageTitle: { fontSize: '22px', color: '#4a3f35', margin: 0 },
  titleLine: { width: '28px', height: '1.5px', backgroundColor: '#8a9e78', marginTop: '8px' },
  card: { backgroundColor: '#fff', borderRadius: '14px', border: '1px solid #e2dacc', padding: '24px' },
  statCard: { backgroundColor: '#fff', border: '1px solid #e2dacc', borderRadius: '14px', padding: '18px 22px', flex: 1 },
  statLabel: { fontSize: '12px', color: '#c8baa6', marginBottom: '6px' },
  statValue: { fontSize: '26px', color: '#4a3f35' },
  btnAdd: { backgroundColor: '#8a9e78', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Varela Round, sans-serif' },
  tableHeader: { display: 'flex', fontSize: '12px', color: '#c8baa6', paddingBottom: '12px', borderBottom: '1px solid #e2dacc', gap: '12px' },
  tableRow: { display: 'flex', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f0ebe3', fontSize: '14px', color: '#4a3f35', gap: '12px' },
  avatar: { width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#EDF4E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#6b8f5e', flexShrink: 0 },
  badge: { fontSize: '12px', padding: '4px 12px', borderRadius: '20px', backgroundColor: '#EDF4E8', color: '#6b8f5e' },
};

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('schedule');
  const [teachers, setTeachers] = useState([]);

  useEffect(() => {
    if (activeTab === 'teachers') {
      getTeachers().then(res => setTeachers(res.data));
    }
  }, [activeTab]);

  const handleDelete = async (id) => {
    if (window.confirm('למחוק את המורה?')) {
      await deleteTeacher(id);
      setTeachers(teachers.filter(t => t.id !== id));
    }
  };

  const initials = (t) => `${t.first_name?.[0] || ''}${t.last_name?.[0] || ''}`;

  return (
    <div style={s.layout}>

      <div style={s.sidebar}>
        <div style={s.sidebarTop}>
          <div style={s.brand}>SMARTIME</div>
          <div style={s.brandName}>פאנל ניהול</div>
        </div>

        <nav style={{ flex: 1 }}>
          <button key="schedule" onClick={() => setActiveTab('schedule')} style={s.navItem(activeTab === 'schedule')}>
            <i className="ti ti-calendar" style={{ fontSize: '18px' }} aria-hidden="true"></i>
            מערכת שעות
          </button>
          <button key="notifications" onClick={() => setActiveTab('notifications')} style={s.navItem(activeTab === 'notifications')}>
            <i className="ti ti-bell" style={{ fontSize: '18px' }} aria-hidden="true"></i>
            התראות
            <span style={{ marginRight: 'auto', backgroundColor: '#FAE8E8', color: '#c0705a', borderRadius: '10px', padding: '2px 8px', fontSize: '12px' }}>3</span>
          </button>

          <div style={s.divider}></div>

          <button key="teachers" onClick={() => setActiveTab('teachers')} style={s.navItem(activeTab === 'teachers')}>
            <i className="ti ti-users" style={{ fontSize: '18px' }} aria-hidden="true"></i>
            מורים
          </button>
          <button key="rooms" onClick={() => setActiveTab('rooms')} style={s.navItem(activeTab === 'rooms')}>
            <i className="ti ti-building" style={{ fontSize: '18px' }} aria-hidden="true"></i>
            חדרים
          </button>
          <button key="subjects" onClick={() => setActiveTab('subjects')} style={s.navItem(activeTab === 'subjects')}>
            <i className="ti ti-book" style={{ fontSize: '18px' }} aria-hidden="true"></i>
            מקצועות
          </button>
          <button key="groups" onClick={() => setActiveTab('groups')} style={s.navItem(activeTab === 'groups')}>
            <i className="ti ti-school" style={{ fontSize: '18px' }} aria-hidden="true"></i>
            קבוצות
          </button>
        </nav>

        <div style={{ padding: '0 24px' }}>
          <div style={{ fontSize: '12px', color: '#c8baa6', marginBottom: '8px' }}>{user?.first_name} {user?.last_name}</div>
          <button onClick={logout} style={{ fontSize: '13px', color: '#8a7a6e', background: 'none', border: '1px solid #e2dacc', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', width: '100%', fontFamily: 'Varela Round, sans-serif' }}>
            התנתק
          </button>
        </div>
      </div>

      <div style={s.main}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h1 style={s.pageTitle}>{TABS.find(t => t.id === activeTab)?.label}</h1>
            <div style={s.titleLine}></div>
          </div>
          {activeTab === 'teachers' && (
            <button style={s.btnAdd}>
              <i className="ti ti-plus" aria-hidden="true"></i>
              הוסף מורה
            </button>
          )}
        </div>

        {activeTab === 'teachers' && (
          <>
            <div style={{ display: 'flex', gap: '14px', marginBottom: '28px' }}>
              <div style={s.statCard}>
                <div style={s.statLabel}>סה"כ מורים</div>
                <div style={s.statValue}>{teachers.length}</div>
              </div>
              <div style={s.statCard}>
                <div style={s.statLabel}>ממוצע שעות</div>
                <div style={s.statValue}>
                  {teachers.length ? Math.round(teachers.reduce((a, t) => a + (t.weekly_hours_quota || 0), 0) / teachers.length) : 0}
                </div>
              </div>
              <div style={s.statCard}>
                <div style={s.statLabel}>אילוצים פתוחים</div>
                <div style={{ ...s.statValue, color: '#c0705a' }}>—</div>
              </div>
            </div>

            <div style={s.card}>
              <div style={s.tableHeader}>
                <div style={{ width: '34px' }}></div>
                <div style={{ flex: 3 }}>שם</div>
                <div style={{ flex: 3 }}>אימייל</div>
                <div style={{ flex: 1 }}>שעות</div>
                <div style={{ flex: 1 }}>תפקיד</div>
                <div style={{ width: '52px' }}></div>
              </div>

              {teachers.map((teacher, i) => (
                <div key={teacher.id} style={{ ...s.tableRow, borderBottom: i === teachers.length - 1 ? 'none' : '1px solid #f0ebe3' }}>
                  <div style={s.avatar}>{initials(teacher)}</div>
                  <div style={{ flex: 3 }}>{teacher.first_name} {teacher.last_name}</div>
                  <div style={{ flex: 3, color: '#8a7a6e' }}>{teacher.email}</div>
                  <div style={{ flex: 1 }}>{teacher.weekly_hours_quota}</div>
                  <div style={{ flex: 1 }}>
                    <span style={{ ...s.badge, ...(teacher.is_admin ? { backgroundColor: '#E8F2FA', color: '#5a8ac0' } : {}) }}>
                      {teacher.is_admin ? 'מנהל' : 'מורה'}
                    </span>
                  </div>
                  <div style={{ width: '52px', display: 'flex', gap: '10px' }}>
                    <i className="ti ti-edit" style={{ fontSize: '16px', color: '#c8baa6', cursor: 'pointer' }} aria-hidden="true"></i>
                    <i className="ti ti-trash" onClick={() => handleDelete(teacher.id)} style={{ fontSize: '16px', color: '#c8baa6', cursor: 'pointer' }} aria-hidden="true"></i>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab !== 'teachers' && (
          <div style={{ ...s.card, minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: '#c8baa6' }}>
              <i className={`ti ${TABS.find(t => t.id === activeTab)?.icon}`} style={{ fontSize: '36px', display: 'block', marginBottom: '14px' }} aria-hidden="true"></i>
              <div style={{ fontSize: '15px' }}>ניהול {TABS.find(t => t.id === activeTab)?.label} — בקרוב</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}