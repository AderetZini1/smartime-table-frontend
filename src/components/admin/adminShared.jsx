import { useState, useEffect } from 'react';
import { styles } from '../../pages/adminDashboard.styles';

export const TABS = [
  { id: 'schedule', label: 'מערכת שעות', icon: 'ti-calendar' },
  { id: 'history', label: 'היסטוריית מערכות', icon: 'ti-history' },
  { id: 'requests', label: 'פניות מורים', icon: 'ti-message' },
  { id: 'teacherprefs', label: 'העדפות מורים', icon: 'ti-clipboard-text' },
  { id: 'windows', label: 'חלונות הגשה', icon: 'ti-calendar-event' },
  { id: 'notifications', label: 'התראות', icon: 'ti-bell' },
  { id: 'school', label: 'הגדרות מוסד', icon: 'ti-settings' },
  { id: 'assignments', label: 'שיוך מורים', icon: 'ti-user-check' },
  { id: 'teachers', label: 'מורים', icon: 'ti-users' },
  { id: 'rooms', label: 'חדרים', icon: 'ti-building' },
  { id: 'subjects', label: 'מקצועות', icon: 'ti-book' },
  { id: 'groups', label: 'קבוצות', icon: 'ti-school' },
];

// Sidebar groups (a divider is drawn between them)
export const MAIN_NAV = ['schedule', 'history', 'requests', 'teacherprefs', 'windows', 'notifications', 'school', 'assignments'];
export const DATA_NAV = ['teachers', 'rooms', 'subjects', 'groups'];

export const SCHOOL_TABS = [
  { id: 'day', label: 'מבנה יום' },
  { id: 'ped', label: 'אילוצים פדגוגיים' },
  { id: 'curriculum', label: 'תכנית לימודים' },
];

export const DAYS = { 1: 'ראשון', 2: 'שני', 3: 'שלישי', 4: 'רביעי', 5: 'חמישי', 6: 'שישי' };
export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
export const DAY_ORDER = [1, 2, 3, 4, 5, 6];
export const HOURS = [1, 2, 3, 4, 5, 6, 7, 8];

export const GRADES = [1, 2, 3, 4, 5, 6];
export const GRADE_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
export const GRADE_LABELS = { 1: "א'", 2: "ב'", 3: "ג'", 4: "ד'", 5: "ה'", 6: "ו'" };
export const gradeClassLabel = (gl) => `כיתה ${GRADE_LETTERS[gl - 1]}'`;

// Timeslot ids are 1-based: 8 lessons per day, day index 0 = Sunday.
export const LESSONS_PER_DAY = 8;
export const timeslotId = (dayIdx, hour) => dayIdx * LESSONS_PER_DAY + hour;
export const timeslotParts = (id) => ({
  dayIdx: Math.floor((id - 1) / LESSONS_PER_DAY),
  hour: ((id - 1) % LESSONS_PER_DAY) + 1,
});

export const PEDAGOGICAL_TYPES = [
  { value: 'max_per_day', label: 'מקסימום שיעורים ביום' },
  { value: 'not_last', label: 'לא בשיעור האחרון' },
  { value: 'morning_only', label: 'בבוקר בלבד' },
  { value: 'not_consecutive', label: 'לא ברצף עם מקצוע אחר' },
  { value: 'min_gap', label: 'מינימום הפסקה בין שיעורים' },
];
export const pedTypeLabel = (value) => PEDAGOGICAL_TYPES.find(t => t.value === value)?.label || value;

export const REQUEST_TYPES = {
  constraint_change: 'שינוי אילוץ',
  absence: 'בקשת היעדרות',
  general: 'פנייה כללית',
};

export const statusLabel = (s) => ({ pending: 'ממתין', approved: 'אושר', rejected: 'נדחה' }[s] || s);

export const formatAlgo = (algo) => {
  if (!algo) return '—';
  if (algo.toUpperCase() === 'CSP') return 'CSP';
  return algo.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
};

// Stable per-teacher avatar color, hashed from the teacher id.
const TEACHER_COLOR_PALETTE = [
  { bg: '#CDE7D8', color: '#2f6b4a' },
  { bg: '#D6E4F5', color: '#33578f' },
  { bg: '#F6DCC9', color: '#8f5b28' },
  { bg: '#E7D8F2', color: '#5f4080' },
  { bg: '#F5D8DF', color: '#8a3a54' },
  { bg: '#D9EDEA', color: '#286e60' },
  { bg: '#F2E6C9', color: '#7a611c' },
  { bg: '#DADEF2', color: '#3c4494' },
];

export const colorForTeacher = (id) => {
  const s = String(id ?? '');
  let hash = 5381;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) + hash + s.charCodeAt(i)) >>> 0;
  return TEACHER_COLOR_PALETTE[hash % TEACHER_COLOR_PALETTE.length];
};

export const initials = (t) => (t ? `${t.first_name?.[0] || ''}${t.last_name?.[0] || ''}` : '?');
export const fullName = (t) => (t ? `${t.first_name} ${t.last_name}` : '—');
export const byName = (a, b) => fullName(a).localeCompare(fullName(b), 'he');

export const FONT = 'Varela Round, sans-serif';

export function PageHeader({ title, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
      <div>
        <h1 style={styles.pageTitle}>{title}</h1>
        <div style={styles.titleLine}></div>
      </div>
      {action}
    </div>
  );
}

export function AddButton({ label, onClick }) {
  return (
    <button style={styles.btnAdd} onClick={onClick}>
      <i className="ti ti-plus" aria-hidden="true"></i> {label}
    </button>
  );
}

export function EmptyCard({ children }) {
  return <div style={{ ...styles.card, textAlign: 'center', color: '#c8baa6', padding: '40px', fontSize: '14px' }}>{children}</div>;
}

export function FieldError({ children }) {
  return <div style={{ fontSize: '11px', color: '#c0705a', marginTop: '4px' }}>{children}</div>;
}

export const errorFieldStyle = (hasError) => (hasError ? { borderColor: '#c0705a', backgroundColor: '#fff8f6' } : {});

export function PrimaryButton({ onClick, busy, busyLabel = 'שומר…', children, style }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{ backgroundColor: '#8a9e78', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, ...style }}
    >
      {busy ? busyLabel : children}
    </button>
  );
}

// White modal with a title row and a close (✕) button.
export function Modal({ title, subtitle, titleSize = '18px', onClose, width = '460px', padding = '36px', overlay = 0.2, maxHeight, children }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: `rgba(74,63,53,${overlay})`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2dacc', padding, width, maxWidth: '94vw', maxHeight, overflowY: maxHeight ? 'auto' : undefined }}
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {title && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: titleSize, color: '#4a3f35', margin: subtitle ? '0 0 4px 0' : 0 }}>{title}</h2>
              {subtitle && <div style={{ fontSize: '12px', color: '#8a7a6e' }}>{subtitle}</div>}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8baa6', fontSize: '20px' }}>✕</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// Cream confirm dialog (select run, delete run, leave page, ...).
export function ConfirmDialog({ title, message, warning, confirmLabel, busyLabel, busy = false, danger = false, cancelLabel = 'ביטול', maxWidth = '420px', onConfirm, onCancel }) {
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} dir="rtl" style={{ backgroundColor: '#FAF7F2', border: '1px solid #e2dacc', borderRadius: '14px', padding: '24px', width: '90%', maxWidth, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
        {title && <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', color: '#4a3f35' }}>{title}</h3>}
        <p style={{ margin: warning ? '0 0 8px 0' : '0 0 20px 0', fontSize: title ? '14px' : '15px', color: '#4a3f35', lineHeight: 1.6 }}>{message}</p>
        {warning && <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#c0705a', lineHeight: 1.6 }}>{warning}</p>}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-start' }}>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{ backgroundColor: danger ? '#c0705a' : '#8a9e78', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '14px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}
          >
            {busy && busyLabel ? busyLabel : confirmLabel}
          </button>
          <button onClick={onCancel} disabled={busy} style={{ ...styles.btnOutline, padding: '9px 18px', fontSize: '14px' }}>{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
}

// The "האם למחוק את X?" dialog used before every delete.
// Best-effort readable message from a failed API call.
export function apiErrorMessage(err, fallback) {
  const data = err?.response?.data;
  const msg = typeof data === 'string' ? data : (data?.detail || data?.message || data?.error);
  return typeof msg === 'string' && msg.trim() ? msg : fallback;
}

// onConfirm must throw on failure — the error is shown inside the dialog
// instead of the dialog silently staying open.
export function ConfirmDeleteModal({ name, onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      setError(apiErrorMessage(err, 'המחיקה נכשלה. ייתכן שהפריט עדיין בשימוש, למשל משובץ במערכת השעות.'));
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(74,63,53,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onCancel}>
      <div style={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2dacc', padding: '36px', width: '400px' }} onClick={e => e.stopPropagation()} dir="rtl">
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <i className="ti ti-trash" style={{ fontSize: '32px', color: '#c0705a', display: 'block', marginBottom: '12px' }} aria-hidden="true"></i>
          <div style={{ fontSize: '16px', color: '#4a3f35', marginBottom: '8px' }}>מחיקה</div>
          <div style={{ fontSize: '13px', color: '#8a7a6e' }}>האם למחוק את <strong>{name}</strong>?</div>
        </div>
        {error && (
          <div style={{ fontSize: '13px', color: '#c0705a', backgroundColor: '#fff3f0', border: '1px solid #f0c9be', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', textAlign: 'center', lineHeight: 1.5 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button onClick={onCancel} disabled={busy} style={styles.btnOutline}>ביטול</button>
          <button onClick={confirm} disabled={busy} style={{ ...styles.btnAdd, backgroundColor: '#c0705a', opacity: busy ? 0.6 : 1 }}>{busy ? 'מוחק…' : 'מחק'}</button>
        </div>
      </div>
    </div>
  );
}

export function Toggle({ on, onClick, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{ width: '52px', height: '28px', borderRadius: '20px', border: 'none', cursor: 'pointer', backgroundColor: on ? '#8a9e78' : '#d8d0c4', position: 'relative', transition: 'background-color 0.15s' }}
    >
      <span style={{ position: 'absolute', top: '3px', [on ? 'left' : 'right']: '3px', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#fff' }}></span>
    </button>
  );
}

export function ToggleRow({ label, on, onClick }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '320px' }}>
      <span style={{ fontSize: '13px', color: '#4a3f35' }}>{label}</span>
      <Toggle on={on} onClick={onClick} label={label} />
    </div>
  );
}

// Selectable rounded chip (subjects, grades, ...).
export function Chip({ selected, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', border: selected ? '1px solid #8a9e78' : '1px solid #e2dacc', backgroundColor: selected ? '#EDF4E8' : '#fff', color: selected ? '#4a7c3f' : '#8a7a6e' }}
    >
      {children}
    </button>
  );
}

// Large centered pill filters (requests, notifications).
export function FilterPills({ options, value, onChange, marginBottom = '20px' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom }}>
      {options.map(o => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          style={{ width: 'fit-content', padding: '10px 22px', borderRadius: '22px', fontSize: '15px', cursor: 'pointer', border: '1px solid #e2dacc', backgroundColor: value === o.id ? '#8a9e78' : '#f5f2ee', color: value === o.id ? '#fff' : '#8a7a6e', fontFamily: FONT, textAlign: 'center' }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#6b8f5e', color: '#fff', padding: '12px 24px', borderRadius: '10px', fontSize: '14px', boxShadow: '0 6px 20px rgba(0,0,0,0.15)', zIndex: 9999 }}>
      {message}
    </div>
  );
}

// Light section box with a bold heading (teacher preferences page).
export function SectionBox({ title, children }) {
  return (
    <div style={{ backgroundColor: '#FAF7F2', borderRadius: '10px', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
        <span style={{ fontSize: '14px', color: '#4a3f35', fontWeight: 700 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

// Bigger edit/delete icons for the data tables.
export const bigIcon = { ...styles.iconBtn, fontSize: '22px' };

const gridCell = (lastCol, lastRow, header, background) => ({
  padding: '12px 18px',
  fontSize: '14px',
  color: '#4a3f35',
  fontWeight: header ? 700 : 'normal',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  gap: '10px',
  whiteSpace: 'nowrap',
  backgroundColor: background,
  borderLeft: lastCol ? 'none' : '1px solid #ece7dd',
  transition: 'background-color 0.12s',
  borderBottom: header ? '1px solid #e2dacc' : (lastRow ? 'none' : '1px solid #f0ebe3'),
});

const ROW_HOVER_BG = '#FAF7F2';
const ROW_HIGHLIGHT_BG = '#F5F8F2';
const MENU_ITEM_HEIGHT = 40;

// Every data table shares one width so switching tabs doesn't jump.
export const TABLE_WIDTH = '900px';


// Centered card of TABLE_WIDTH; data columns share the width equally.
//
// rows: [{
//   key,
//   cells: [node, ...],
//   highlight?: bool,                      // e.g. the current schedule
//   onRowClick?: () => void,               // main action (usually edit / view)
//   actions?: [{ label, icon, onClick, danger?, disabled?, hint? } | false]
//            "⋮" menu; falsy entries are skipped. A disabled item stays visible
//            (greyed) with `hint` explaining why, so the menu never looks incomplete.
// }]
// headers: ['label', ...] or [{ label, weight }, ...] — weight is the column's share
//          of the width (default 1), e.g. a name column 2 and a number column 1.
// footer: optional node under the table (e.g. "show all").
export function GridTable({ headers, rows, emptyText, footer }) {
  const n = headers.length;
  const labels = headers.map(h => (typeof h === 'string' ? h : h.label));
  const weights = headers.map(h => (typeof h === 'string' ? 1 : (h.weight ?? 1)));
  const hasActions = rows.some(r => r.actions && r.actions.some(Boolean));
  const [hovered, setHovered] = useState(null);
  const [menu, setMenu] = useState(null); // { key, top, left, actions }

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menu]);

  const toggleMenu = (e, row) => {
    e.stopPropagation();
    if (menu?.key === row.key) { setMenu(null); return; }
    const actions = row.actions.filter(Boolean);
    const rect = e.currentTarget.getBoundingClientRect();
    const height = actions.reduce((h, a) => h + MENU_ITEM_HEIGHT + (a.disabled && a.hint ? 16 : 0), 20);
    const fitsBelow = rect.bottom + 4 + height <= window.innerHeight;
    setMenu({
      key: row.key,
      actions,
      left: rect.left,
      top: fitsBelow ? rect.bottom + 4 : Math.max(8, rect.top - 4 - height),
    });
  };

  const columns = weights.map(w => `minmax(max-content, ${w}fr)`).join(' ') + (hasActions ? ' 56px' : '');

  return (
    <div style={{ ...styles.card, width: TABLE_WIDTH, maxWidth: '100%', boxSizing: 'border-box', margin: '0 auto 24px', overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: columns }}>
        {labels.map((h, i) => (
          <div key={i} style={{ ...gridCell(i === n - 1, false, true), fontSize: '13px', color: '#8a7a6e' }}>{h}</div>
        ))}
        {hasActions && <div style={gridCell(true, false, true)}></div>}

        {rows.map((row, r) => {
          const lastRow = r === rows.length - 1;
          const isHovered = hovered === row.key;
          const menuOpen = menu?.key === row.key;
          const bg = isHovered || menuOpen ? ROW_HOVER_BG : (row.highlight ? ROW_HIGHLIGHT_BG : undefined);
          const rowHandlers = {
            onMouseEnter: () => setHovered(row.key),
            onMouseLeave: () => setHovered(h => (h === row.key ? null : h)),
            onClick: row.onRowClick,
          };
          const clickable = row.onRowClick ? { cursor: 'pointer' } : {};
          const rowActions = (row.actions || []).filter(Boolean);

          return (
            <div key={row.key} style={{ display: 'contents' }}>
              {row.cells.map((cell, i) => (
                <div key={i} {...rowHandlers} style={{ ...gridCell(i === n - 1, lastRow, false, bg), ...clickable }}>{cell}</div>
              ))}
              {hasActions && (
                <div {...rowHandlers} style={{ ...gridCell(true, lastRow, false, bg), ...clickable, padding: '8px 10px' }}>
                  {rowActions.length > 0 && (
                    <button
                      onClick={(e) => toggleMenu(e, row)}
                      aria-label="פעולות"
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      style={{
                        width: '32px', height: '32px', padding: 0, borderRadius: '8px', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        border: `1px solid ${isHovered || menuOpen ? '#e2dacc' : 'transparent'}`,
                        backgroundColor: isHovered || menuOpen ? '#fff' : 'transparent',
                        color: isHovered || menuOpen ? '#4a3f35' : '#c8baa6',
                      }}
                    >
                      <i className="ti ti-dots-vertical" style={{ fontSize: '18px', lineHeight: 1 }} aria-hidden="true"></i>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {rows.length === 0 && emptyText && (
        <div style={{ textAlign: 'center', color: '#c8baa6', padding: '24px', fontSize: '14px' }}>{emptyText}</div>
      )}
      {footer}

      {menu && (
        <>
          <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
          <div
            role="menu"
            dir="rtl"
            style={{ position: 'fixed', top: menu.top, left: menu.left, zIndex: 901, width: '190px', backgroundColor: '#fff', border: '1px solid #e2dacc', borderRadius: '12px', boxShadow: '0 8px 24px rgba(74,63,53,0.14)', padding: '6px' }}
          >
            {menu.actions.map((action, i) => (
              <div key={i}>
                {action.danger && i > 0 && <div style={{ height: '1px', backgroundColor: '#f0ebe3', margin: '4px 6px' }} />}
                <MenuItem
                  action={action}
                  onSelect={() => { if (action.disabled) return; setMenu(null); action.onClick(); }}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({ action, onSelect }) {
  const [hover, setHover] = useState(false);
  const { disabled, danger, hint } = action;
  const color = disabled ? '#c8baa6' : (danger ? '#c0705a' : '#4a3f35');
  const bg = hover && !disabled ? (danger ? '#FAE8E8' : '#FAF7F2') : 'transparent';
  const showHint = disabled && hint;
  return (
    <button
      role="menuitem"
      aria-disabled={disabled || undefined}
      title={disabled ? hint : undefined}
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', minHeight: `${MENU_ITEM_HEIGHT - 4}px`, padding: showHint ? '6px 10px' : '0 10px', margin: '2px 0', border: 'none', borderRadius: '8px', backgroundColor: bg, color, fontSize: '14px', cursor: disabled ? 'default' : 'pointer', textAlign: 'right', fontFamily: FONT }}
    >
      {action.icon && <i className={`ti ${action.icon}`} style={{ fontSize: '17px', lineHeight: 1 }} aria-hidden="true"></i>}
      <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span>{action.label}</span>
        {showHint && <span style={{ fontSize: '11px', color: '#c8baa6' }}>{hint}</span>}
      </span>
    </button>
  );
}
