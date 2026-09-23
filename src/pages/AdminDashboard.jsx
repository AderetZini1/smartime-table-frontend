import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMyRequests } from '../services/api';
import { styles } from './adminDashboard.styles';
import { TABS, MAIN_NAV, DATA_NAV, fullName, PageHeader, Toast, FONT } from '../components/admin/adminShared';
import ScheduleTab from '../components/admin/ScheduleTab';
import RequestsTab from '../components/admin/RequestsTab';
import TeacherPrefsTab from '../components/admin/TeacherPrefsTab';
import WindowsTab from '../components/admin/WindowsTab';
import NotificationsTab from '../components/admin/NotificationsTab';
import SchoolSettingsTab from '../components/admin/SchoolSettingsTab';
import TeachersTab from '../components/admin/TeachersTab';
import RoomsTab from '../components/admin/RoomsTab';
import SubjectsTab from '../components/admin/SubjectsTab';
import GroupsTab from '../components/admin/GroupsTab';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('adminActiveTab');
    return TABS.some(t => t.id === saved) ? saved : 'schedule';
  });
  const [pendingCount, setPendingCount] = useState(0);
  // Handoff into ScheduleTab: { type: 'class'|'teacher'|'subject'|'grade', value } | null
  const [scheduleJump, setScheduleJump] = useState(null);
  const [toast, setToast] = useState(null); // { message, ms }

  useEffect(() => {
    localStorage.setItem('adminActiveTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    getMyRequests().then(r => setPendingCount(r.data.filter(x => x.status === 'pending').length)).catch(() => { });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.ms);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (message, ms = 4000) => setToast({ message, ms });

  const viewTeacherSchedule = (teacher) => {
    setScheduleJump({ type: 'teacher', value: fullName(teacher) });
    setActiveTab('schedule');
  };

  const title = TABS.find(t => t.id === activeTab)?.label;

  const renderTab = () => {
    switch (activeTab) {
      case 'schedule':
        return (
          <>
            <PageHeader title={title} />
            <ScheduleTab
              jumpTarget={scheduleJump}
              onJumpHandled={() => setScheduleJump(null)}
              onRunSelected={() => showToast('המערכת הנבחרת עודכנה. ניתן לצפות בה כעת ולפרסם לצוות.', 5000)}
              onRunDeleted={() => showToast('המערכת נמחקה מההיסטוריה.')}
            />
          </>
        );
      case 'requests': return <RequestsTab title={title} onPendingCountChange={setPendingCount} />;
      case 'teacherprefs': return <TeacherPrefsTab title={title} onViewSchedule={viewTeacherSchedule} />;
      case 'windows': return <WindowsTab title={title} />;
      case 'notifications': return <NotificationsTab title={title} />;
      case 'school': return <SchoolSettingsTab title={title} />;
      case 'teachers': return <TeachersTab title={title} />;
      case 'rooms': return <RoomsTab title={title} />;
      case 'subjects': return <SubjectsTab title={title} />;
      case 'groups': return <GroupsTab title={title} />;
      default: return null;
    }
  };

  const navButton = (id) => {
    const tab = TABS.find(t => t.id === id);
    return (
      <button key={id} onClick={() => setActiveTab(id)} style={styles.navItem(activeTab === id)}>
        <i className={`ti ${tab.icon}`} style={{ fontSize: '18px' }} aria-hidden="true"></i>
        {tab.label}
        {id === 'requests' && pendingCount > 0 && (
          <span style={{ marginRight: 'auto', backgroundColor: '#FAE8E8', color: '#c0705a', borderRadius: '10px', padding: '2px 8px', fontSize: '12px' }}>{pendingCount}</span>
        )}
      </button>
    );
  };

  return (
    <div style={styles.layout}>
      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator {
          cursor: pointer;
          opacity: 0.55;
        }
        button .ti {
          line-height: 1;
          vertical-align: middle;
        }
        input[type="date"]::-webkit-calendar-picker-indicator:hover,
        input[type="time"]::-webkit-calendar-picker-indicator:hover {
          opacity: 0.9;
        }
      `}</style>

      <div style={styles.sidebar}>
        <div style={styles.sidebarTop}>
          <div style={styles.brand}>SMARTIME</div>
          <div style={styles.brandName}>פאנל ניהול</div>
        </div>
        <nav style={{ flex: 1 }}>
          {MAIN_NAV.map(navButton)}
          <div style={styles.divider}></div>
          {DATA_NAV.map(navButton)}
        </nav>
        <div style={{ padding: '0 24px' }}>
          <div style={{ fontSize: '12px', color: '#c8baa6', marginBottom: '8px' }}>{user?.first_name} {user?.last_name}</div>
          <button
            onClick={() => navigate('/teacher')}
            style={{ fontSize: '13px', color: '#8a9e78', background: 'none', border: '1px solid #8a9e78', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', width: '100%', marginBottom: '8px', fontFamily: FONT }}
          >
            <i className="ti ti-user" aria-hidden="true"></i> עבור לתצוגת מורה
          </button>
          <button onClick={logout} style={{ ...styles.btnOutline, width: '100%' }}>התנתק</button>
        </div>
      </div>

      <div style={styles.main}>
        {renderTab()}
      </div>

      <Toast message={toast?.message} />
    </div>
  );
}