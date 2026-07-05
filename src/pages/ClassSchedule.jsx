import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getStudentGroups, getCurrentSchedule } from '../services/api';

// Day 1 = Sunday ... 6 = Friday. Friday only reaches hour 4.
const DAY_NAMES = { 1: 'ראשון', 2: 'שני', 3: 'שלישי', 4: 'רביעי', 5: 'חמישי', 6: 'שישי' };
const DAY_ORDER = [1, 2, 3, 4, 5, 6];
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8];

// Grade letter from "כיתה א1" -> "א"
function gradeOf(groupName) {
  if (!groupName) return '';
  const m = groupName.match(/כיתה\s*(.)/);
  return m ? m[1] : groupName;
}

const styles = {
  layout: { backgroundColor: '#FAF7F2', minHeight: '100vh', direction: 'rtl' },
  topbar: { display: 'flex', alignItems: 'center', gap: '16px', padding: '24px 48px', borderBottom: '1px solid #e2dacc', backgroundColor: '#fff' },
  backBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid #e2dacc', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', color: '#8a7a6e', cursor: 'pointer', fontFamily: 'Varela Round, sans-serif' },
  title: { fontSize: '20px', color: '#4a3f35', margin: 0 },
  main: { padding: '32px 48px' },
  card: { backgroundColor: '#fff', borderRadius: '14px', border: '1px solid #e2dacc', padding: '24px', marginBottom: '20px' },
  select: { padding: '9px 14px', border: '1px solid #e2dacc', borderRadius: '10px', fontSize: '14px', color: '#4a3f35', backgroundColor: '#fff', outline: 'none', fontFamily: 'Varela Round, sans-serif', cursor: 'pointer' },
  search: { padding: '9px 14px', border: '1px solid #e2dacc', borderRadius: '10px', fontSize: '14px', color: '#4a3f35', backgroundColor: '#FAF7F2', outline: 'none', fontFamily: 'Varela Round, sans-serif', minWidth: '200px' },
  gridCell: { border: '1px solid #f0ebe3', padding: '6px', verticalAlign: 'top', height: '64px' },
  gridHourCell: { border: '1px solid #f0ebe3', padding: '6px', textAlign: 'center', color: '#c8baa6', fontSize: '12px', backgroundColor: '#FAF7F2', whiteSpace: 'nowrap' },
  gridHeadCell: { border: '1px solid #e2dacc', padding: '10px', textAlign: 'center', color: '#4a3f35', fontSize: '13px', backgroundColor: '#EDF4E8' },
  lessonBox: { backgroundColor: '#F5F8F2', border: '1px solid #e3ecdb', borderRadius: '8px', padding: '5px 7px', marginBottom: '4px', fontSize: '11px', color: '#4a3f35', lineHeight: 1.35 },
};

export default function ClassSchedule() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [entries, setEntries] = useState([]);
  const [runInfo, setRunInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const [filterType, setFilterType] = useState('class'); // class | teacher | subject | grade
  const [filterValue, setFilterValue] = useState('');
  const [search, setSearch] = useState('');

  // Load the class (for its name) and the current schedule.
  useEffect(() => {
    getStudentGroups().then(r => {
      const found = r.data.find(g => String(g.id) === String(groupId));
      setGroup(found || null);
      // default the class filter to the class we navigated in from
      if (found) setFilterValue(found.group_name);
    }).catch(() => {});
  }, [groupId]);

  useEffect(() => {
    setLoading(true);
    getCurrentSchedule()
      .then(r => { setEntries(r.data.entries || []); setRunInfo(r.data.run || null); })
      .catch(() => { setEntries([]); setRunInfo(null); })
      .finally(() => setLoading(false));
  }, []);

  const optionsForFilter = () => {
    const set = new Set();
    entries.forEach(e => {
      if (filterType === 'class') set.add(e.group_name);
      else if (filterType === 'teacher') set.add(`${e.teacher_first_name} ${e.teacher_last_name}`);
      else if (filterType === 'subject') set.add(e.subject_name);
      else if (filterType === 'grade') set.add(gradeOf(e.group_name));
    });
    return Array.from(set)
      .filter(Boolean)
      .filter(o => !search || o.includes(search))
      .sort((a, b) => a.localeCompare(b, 'he'));
  };

  const matches = (e) => {
    if (!filterValue) return false;
    if (filterType === 'class') return e.group_name === filterValue;
    if (filterType === 'teacher') return `${e.teacher_first_name} ${e.teacher_last_name}` === filterValue;
    if (filterType === 'subject') return e.subject_name === filterValue;
    if (filterType === 'grade') return gradeOf(e.group_name) === filterValue;
    return false;
  };

  const shown = entries.filter(matches);
  const cell = (day, hour) => shown.filter(e => e.day_of_week === day && e.hour_of_day === hour);
  const options = optionsForFilter();

  return (
    <div style={styles.layout}>
      <div style={styles.topbar}>
        <button onClick={() => navigate('/admin')} style={styles.backBtn}>
          <i className="ti ti-arrow-right" aria-hidden="true"></i> חזרה
        </button>
        <h1 style={styles.title}>
          מערכת שעות{group ? ` — ${group.group_name}` : ''}
        </h1>
      </div>

      <div style={styles.main}>
        {/* Filter + search bar */}
        <div style={{ ...styles.card, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: '#8a7a6e' }}>הצג לפי:</span>
          <select
            style={styles.select}
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setFilterValue(''); setSearch(''); }}
          >
            <option value="class">כיתה</option>
            <option value="teacher">מורה</option>
            <option value="subject">מקצוע</option>
            <option value="grade">שכבה</option>
          </select>
          <input
            style={styles.search}
            placeholder="חיפוש…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            style={{ ...styles.select, minWidth: '180px' }}
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
          >
            <option value="">— בחר/י —</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {/* Grid */}
        <div style={styles.card}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>טוען…</div>
          ) : !runInfo ? (
            <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>
              <i className="ti ti-calendar-off" style={{ fontSize: '36px', display: 'block', marginBottom: '14px' }} aria-hidden="true"></i>
              <div style={{ fontSize: '15px' }}>טרם נוצרה מערכת שעות</div>
            </div>
          ) : !filterValue ? (
            <div style={{ textAlign: 'center', color: '#c8baa6', padding: '40px' }}>
              בחר/י ערך מהרשימה למעלה כדי להציג מערכת שעות.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ ...styles.gridHeadCell, width: '60px' }}>שעה</th>
                    {DAY_ORDER.map(d => <th key={d} style={styles.gridHeadCell}>{DAY_NAMES[d]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {HOURS.map(hour => (
                    <tr key={hour}>
                      <td style={styles.gridHourCell}>שיעור {hour}</td>
                      {DAY_ORDER.map(day => {
                        const lessons = cell(day, hour);
                        return (
                          <td key={day} style={styles.gridCell}>
                            {lessons.map((e, idx) => (
                              <div key={idx} style={styles.lessonBox}>
                                <div style={{ fontWeight: 600 }}>{e.subject_name}</div>
                                {filterType !== 'teacher' && (
                                  <div style={{ color: '#8a7a6e' }}>{e.teacher_first_name} {e.teacher_last_name}</div>
                                )}
                                {filterType !== 'class' && (
                                  <div style={{ color: '#8a7a6e' }}>{e.group_name}</div>
                                )}
                                {e.room_name && <div style={{ color: '#a99', fontSize: '10px' }}>{e.room_name}</div>}
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
