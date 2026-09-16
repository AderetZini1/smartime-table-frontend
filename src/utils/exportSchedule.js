import ExcelJS from 'exceljs';

const DAYS = [
  { num: 1, name: 'ראשון' },
  { num: 2, name: 'שני' },
  { num: 3, name: 'שלישי' },
  { num: 4, name: 'רביעי' },
  { num: 5, name: 'חמישי' },
  { num: 6, name: 'שישי' },
];
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8];

// Theme colors (ARGB, no '#')
const GREEN = 'FF8A9E78';
const GREEN_LIGHT = 'FFEDF4E8';
const TEXT = 'FF4A3F35';
const BORDER = 'FFE2DACC';

const TEACHER_PALETTE = [
  { bg: '#CDE7D8', color: '#2f6b4a' },
  { bg: '#D6E4F5', color: '#33578f' },
  { bg: '#F6DCC9', color: '#8f5b28' },
  { bg: '#E7D8F2', color: '#5f4080' },
  { bg: '#F5D8DF', color: '#8a3a54' },
  { bg: '#D9EDEA', color: '#286e60' },
  { bg: '#F2E6C9', color: '#7a611c' },
  { bg: '#DADEF2', color: '#3c4494' },
];
function colorForTeacher(key) {
  const s = String(key ?? '');
  let hash = 5381;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) + hash + s.charCodeAt(i)) >>> 0;
  return TEACHER_PALETTE[hash % TEACHER_PALETTE.length];
}
function teacherKey(e) {
  return e.teacher_id ?? e.teacher_color ?? `${e.teacher_first_name || ''} ${e.teacher_last_name || ''}`.trim();
}
function hexToArgb(hex) {
  return 'FF' + String(hex).replace('#', '').toUpperCase();
}

// Excel sheet names can't contain : \ / ? * [ ] and must be <= 31 chars.
function safeSheetName(name, fallback) {
  let n = (name || fallback || 'גיליון').replace(/[:\\/?*[\]]/g, ' ').trim();
  if (n.length > 31) n = n.slice(0, 31);
  return n || fallback || 'גיליון';
}

// subject / class / room, each on its own line; two lessons split by divider.
function cellText(entries, showGroup, showTeacher) {
  if (entries.length === 0) return '';
  return entries.map(e => {
    const lines = [e.subject_name];
    if (showGroup && e.group_name) lines.push(e.group_name);
    if (showTeacher && (e.teacher_first_name || e.teacher_last_name)) lines.push(`${e.teacher_first_name || ''} ${e.teacher_last_name || ''}`.trim());
    if (e.room_name) lines.push(e.room_name);
    return lines.join('\n');
  }).join('\n\u2014\u2014\u2014\n');
}

function buildSheet(wb, sheetName, entries, showGroup, showTeacher) {
  const ws = wb.addWorksheet(safeSheetName(sheetName, 'מערכת'), {
    views: [{ rightToLeft: true }],
  });

  ws.columns = [{ width: 12 }, ...DAYS.map(() => ({ width: 24 }))];

  const thin = { style: 'thin', color: { argb: BORDER } };
  const allBorders = { top: thin, left: thin, bottom: thin, right: thin };

  const header = ws.addRow(['שעה', ...DAYS.map(d => d.name)]);
  header.height = 26;
  header.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
    cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true, readingOrder: 'rtl' };
    cell.border = allBorders;
  });

  for (const hour of HOURS) {
    const rowValues = ['שיעור ' + hour];
    const rowSlots = [null];
    for (const day of DAYS) {
      const slot = entries.filter(e => e.day_of_week === day.num && e.hour_of_day === hour);
      rowValues.push(cellText(slot, showGroup, showTeacher));
      rowSlots.push(slot);
    }
    const row = ws.addRow(rowValues);
    row.height = 58;
    row.eachCell((cell, colNumber) => {
      const isHourCol = colNumber === 1;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true, readingOrder: 'rtl' };
      cell.border = allBorders;
      if (isHourCol) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_LIGHT } };
        cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: TEXT } };
      } else {
        const slot = rowSlots[colNumber - 1] || [];
        const pal = slot.length ? colorForTeacher(teacherKey(slot[0])) : null;
        if (pal) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(pal.bg) } };
          cell.font = { name: 'Arial', size: 11, color: { argb: hexToArgb(pal.color) } };
        } else {
          cell.font = { name: 'Arial', size: 11, color: { argb: TEXT } };
        }
      }
    });
  }

  return ws;
}

async function download(wb, fileName) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName + '.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

/** Export a SINGLE schedule (one grid) to an .xlsx file. */
export async function exportSingleSchedule(entries, { fileName = 'מערכת_שעות', sheetName = 'מערכת', showGroup = true, showTeacher = true } = {}) {
  const wb = new ExcelJS.Workbook();
  buildSheet(wb, sheetName, entries, showGroup, showTeacher);
  await download(wb, fileName);
}

/** Export MULTIPLE schedules, each on its own sheet (tab), in one file. */
export async function exportMultiSchedule(groups, { fileName = 'מערכות_שעות', showGroup = true, showTeacher = true } = {}) {
  const wb = new ExcelJS.Workbook();
  groups.forEach((g, i) => buildSheet(wb, g.name || ('גיליון ' + (i + 1)), g.entries, showGroup, showTeacher));
  await download(wb, fileName);
}
