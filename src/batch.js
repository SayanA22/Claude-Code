import fs from 'node:fs';
import path from 'node:path';

/**
 * Minimal CSV reader — handles quoted fields and embedded commas/newlines.
 * Avoids a dependency for what is, in practice, a two-column prospect list.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else if (c !== '\r') {
      field += c;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  if (!rows.length) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const obj = {};
    header.forEach((h, i) => { obj[h] = (r[i] ?? '').trim(); });
    return obj;
  });
}

export function readProspects(csvPath) {
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  return rows
    .map((r) => ({
      url: r.url || r.website || r.site || r.domain || '',
      name: r.name || r.company || r.business || '',
      contact: r.contact || r.contact_name || '',
      email: r.email || '',
      notes: r.notes || '',
    }))
    .filter((r) => r.url);
}

/**
 * Filesystem-safe slug for a prospect's output files. Includes the path when
 * there is one: a prospect list containing two URLs on the same host would
 * otherwise write both reports to the same filename — and with batch
 * concurrency, write them at the same time.
 */
export function slugify(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, '').replace(/[^a-z0-9.-]/gi, '-').toLowerCase();
    const pathPart = u.pathname
      .replace(/\.(html?|php|aspx?)$/i, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    return pathPart ? `${host}-${pathPart}`.slice(0, 80) : host;
  } catch {
    return String(url).replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 60);
  }
}

/**
 * Guarantee a slug is unique within a run. Two prospects can still normalise to
 * the same name (duplicate rows, www vs non-www); overwriting one report with
 * another loses work silently, so disambiguate instead.
 */
export function uniqueSlug(slug, used) {
  if (!used.has(slug)) {
    used.add(slug);
    return slug;
  }
  let n = 2;
  while (used.has(`${slug}-${n}`)) n++;
  const result = `${slug}-${n}`;
  used.add(result);
  return result;
}

/** Appended to after each prospect so a long run can be resumed and tracked. */
export function appendSummaryRow(summaryPath, row) {
  const exists = fs.existsSync(summaryPath);
  const cols = ['domain', 'name', 'score', 'grade', 'critical', 'serious', 'totalFailures', 'quoteLow', 'quoteHigh', 'reportPath', 'status'];
  if (!exists) {
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    fs.writeFileSync(summaryPath, cols.join(',') + '\n');
  }
  const line = cols
    .map((c) => {
      const v = row[c] ?? '';
      return /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
    })
    .join(',');
  fs.appendFileSync(summaryPath, line + '\n');
}
