import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const DAYS = [
  { num: 1, name: 'ראשון' },
  { num: 2, name: 'שני' },
  { num: 3, name: 'שלישי' },
  { num: 4, name: 'רביעי' },
  { num: 5, name: 'חמישי' },
  { num: 6, name: 'שישי' },
];
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8];

const GREEN = '#8a9e78';
const GREEN_LIGHT = '#EDF4E8';
const TEXT = '#4a3f35';
const BORDER = '#e2dacc';

const SUBJECT_PALETTE = [
  { bg: '#CDE7D8', accent: '#4f9c73' },
  { bg: '#D6E4F5', accent: '#4f7fc2' },
  { bg: '#F6DCC9', accent: '#c98a4b' },
  { bg: '#E7D8F2', accent: '#9068b8' },
  { bg: '#F5D8DF', accent: '#c25c7c' },
  { bg: '#D9EDEA', accent: '#3f9e8f' },
  { bg: '#F2E6C9', accent: '#b3922e' },
  { bg: '#DADEF2', accent: '#5f68c2' },
];
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  return hash;
}
function colorForEntry(e) {
  const key = e.subject_id != null ? String(e.subject_id) : (e.subject_name || '');
  return SUBJECT_PALETTE[hashString(key) % SUBJECT_PALETTE.length];
}

// Build an off-screen HTML table for one schedule, styled + RTL.
function buildScheduleElement(title, entries, showGroup, showTeacher) {
  const wrap = document.createElement('div');
  wrap.setAttribute('dir', 'rtl');
  wrap.style.cssText = `
    position: fixed; left: -10000px; top: 0;
    width: 1100px; background: #fff; padding: 28px;
    font-family: 'Varela Round', Arial, sans-serif; box-sizing: border-box;
  `;

  if (title) {
    const h = document.createElement('div');
    h.textContent = title;
    h.style.cssText = `font-size: 22px; font-weight: 700; color: ${TEXT}; margin-bottom: 16px; text-align: right;`;
    wrap.appendChild(h);
  }

  const table = document.createElement('table');
  table.style.cssText = `width: 100%; border-collapse: collapse; table-layout: fixed;`;

  // header row
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  const th0 = document.createElement('th');
  th0.textContent = 'שעה';
  th0.style.cssText = `width: 70px; background: ${GREEN}; color: #fff; font-weight: 700; font-size: 14px; padding: 10px 6px; border: 1px solid ${BORDER};`;
  hr.appendChild(th0);
  for (const d of DAYS) {
    const th = document.createElement('th');
    th.textContent = d.name;
    th.style.cssText = `background: ${GREEN}; color: #fff; font-weight: 700; font-size: 14px; padding: 10px 6px; border: 1px solid ${BORDER};`;
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  table.appendChild(thead);

  // body
  const tbody = document.createElement('tbody');
  for (const hour of HOURS) {
    const tr = document.createElement('tr');
    const hc = document.createElement('td');
    hc.textContent = `שיעור ${hour}`;
    hc.style.cssText = `background: ${GREEN_LIGHT}; color: ${TEXT}; font-weight: 700; font-size: 13px; text-align: center; padding: 8px 6px; border: 1px solid ${BORDER};`;
    tr.appendChild(hc);

    for (const d of DAYS) {
      const td = document.createElement('td');
      td.style.cssText = `height: 66px; font-size: 12px; color: ${TEXT}; text-align: center; vertical-align: middle; padding: 6px; border: 1px solid ${BORDER};`;
      const slot = entries.filter(e => e.day_of_week === d.num && e.hour_of_day === hour);
      if (slot.length) {
        slot.forEach((e) => {
          const pal = colorForEntry(e);
          const block = document.createElement('div');
          block.style.cssText = `background: ${pal.bg}; border-right: 3px solid ${pal.accent}; border-radius: 8px; padding: 5px 7px; margin-bottom: 4px;`;
          const sub = document.createElement('div');
          sub.textContent = e.subject_name || '';
          sub.style.cssText = 'font-weight: 700; color: #4a3f35;';
          block.appendChild(sub);
          if (showGroup && e.group_name) {
            const g = document.createElement('div');
            g.textContent = e.group_name;
            g.style.cssText = 'color: #6b6258; font-size: 11px;';
            block.appendChild(g);
          }
          if (showTeacher && (e.teacher_first_name || e.teacher_last_name)) {
            const t = document.createElement('div');
            t.textContent = `${e.teacher_first_name || ''} ${e.teacher_last_name || ''}`.trim();
            t.style.cssText = 'color: #6b6258; font-size: 11px;';
            block.appendChild(t);
          }
          if (e.room_name) {
            const r = document.createElement('div');
            r.textContent = e.room_name;
            r.style.cssText = 'color: #8a7a6e; font-size: 10px;';
            block.appendChild(r);
          }
          td.appendChild(block);
        });
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

// Render one element to a canvas, return image data + dimensions.
async function elementToImage(el) {
  document.body.appendChild(el);
  try {
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false });
    return { data: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height };
  } finally {
    document.body.removeChild(el);
  }
}

// place an image onto a landscape A4 page, fitted with margins
function addImageFitted(pdf, img, isFirstPage) {
  if (!isFirstPage) pdf.addPage('a4', 'landscape');
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8; // mm
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2;
  const ratio = img.w / img.h;
  let drawW = availW;
  let drawH = drawW / ratio;
  if (drawH > availH) { drawH = availH; drawW = drawH * ratio; }
  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;
  pdf.addImage(img.data, 'PNG', x, y, drawW, drawH);
}

/** Export a SINGLE schedule to a one-page landscape PDF. */
export async function exportSinglePDF(entries, { fileName = 'מערכת_שעות', title = '', showGroup = true, showTeacher = true } = {}) {
  const el = buildScheduleElement(title, entries, showGroup, showTeacher);
  const img = await elementToImage(el);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  addImageFitted(pdf, img, true);
  pdf.save(`${fileName}.pdf`);
}

/** Export MULTIPLE schedules, one per page, in one PDF. */
export async function exportMultiPDF(groups, { fileName = 'מערכות_שעות', showGroup = true, showTeacher = true } = {}) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const el = buildScheduleElement(String(g.name || `גיליון ${i + 1}`), g.entries, showGroup, showTeacher);
    const img = await elementToImage(el);
    addImageFitted(pdf, img, i === 0);
  }
  pdf.save(`${fileName}.pdf`);
}
