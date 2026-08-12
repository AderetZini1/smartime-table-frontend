import * as XLSX from 'xlsx';

const DAYS = [
  { num: 1, name: 'ראשון' },
  { num: 2, name: 'שני' },
  { num: 3, name: 'שלישי' },
  { num: 4, name: 'רביעי' },
  { num: 5, name: 'חמישי' },
  { num: 6, name: 'שישי' },
];
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8];

// Excel sheet names can't contain : \ / ? * [ ] and must be <= 31 chars.
function safeSheetName(name, fallback) {
  let n = (name || fallback || 'גיליון').replace(/[:\\/?*[\]]/g, ' ').trim();
  if (n.length > 31) n = n.slice(0, 31);
  return n || fallback || 'גיליון';
}

// Build a 2D array (grid) from a list of lesson entries.
// entries: [{ day_of_week, hour_of_day, subject_name, group_name, room_name }, ...]
// showGroup: include the class name in the cell (true for admin views that
//            aren't already per-class; a teacher's own grid shows the class too).
function entriesToGrid(entries, { showGroup = true } = {}) {
  const header = ['שעה', ...DAYS.map(d => d.name)];
  const rows = [header];

  for (const hour of HOURS) {
    const row = [`שיעור ${hour}`];
    for (const day of DAYS) {
      const cell = entries.filter(e => e.day_of_week === day.num && e.hour_of_day === hour);
      if (cell.length === 0) {
        row.push('');
      } else {
        const text = cell.map(e => {
          const parts = [e.subject_name];
          if (showGroup && e.group_name) parts.push(e.group_name);
          if (e.room_name) parts.push(e.room_name);
          return parts.join(' | ');
        }).join('  +  ');
        row.push(text);
      }
    }
    rows.push(row);
  }
  return rows;
}

function styleSheet(ws) {
  // Column widths: first (hour) narrow, day columns wider.
  ws['!cols'] = [{ wch: 10 }, ...DAYS.map(() => ({ wch: 22 }))];
  // Right-to-left sheet.
  ws['!sheetViews'] = [{ rightToLeft: true }];
  return ws;
}

/**
 * Export a SINGLE schedule (one grid) to an .xlsx file.
 */
export function exportSingleSchedule(entries, { fileName = 'מערכת_שעות', sheetName = 'מערכת', showGroup = true } = {}) {
  const grid = entriesToGrid(entries, { showGroup });
  const ws = styleSheet(XLSX.utils.aoa_to_sheet(grid));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(sheetName, 'מערכת'));
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/**
 * Export MULTIPLE schedules, each on its own sheet (tab), in one file.
 * groups: [{ name, entries }, ...]  -> one sheet per group.
 */
export function exportMultiSchedule(groups, { fileName = 'מערכות_שעות', showGroup = true } = {}) {
  const wb = XLSX.utils.book_new();
  const used = new Set();
  groups.forEach((g, i) => {
    let name = safeSheetName(g.name, `גיליון ${i + 1}`);
    // sheet names must be unique
    let unique = name, k = 2;
    while (used.has(unique)) { unique = safeSheetName(`${name} ${k++}`, `גיליון ${i + 1}`); }
    used.add(unique);
    const ws = styleSheet(XLSX.utils.aoa_to_sheet(entriesToGrid(g.entries, { showGroup })));
    XLSX.utils.book_append_sheet(wb, ws, unique);
  });
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
