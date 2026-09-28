// Keep business calculations outside the model. Dates have month precision;
// year-only intervals use January boundaries and are explicitly marked approximate.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

export function resumeDate(value: unknown) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (/^(present|current|currently|now|ongoing)$/i.test(text)) {
    return { label: 'Present', month: null, ongoing: true, approximate: false };
  }
  let year: number;
  let month = 0;
  let approximate = false;
  const named = text.match(/^([a-z]+)\.?\s+(\d{4})$/i);
  const numeric = text.match(/^(\d{4})[-/](\d{1,2})$/);
  const reverse = text.match(/^(\d{1,2})[/-](\d{4})$/);
  if (/^\d{4}$/.test(text)) {
    year = Number(text);
    approximate = true;
  } else if (named) {
    year = Number(named[2]);
    month = MONTHS.findIndex(name => name.toLowerCase() === named[1].toLowerCase()
      || name.slice(0, 3).toLowerCase() === named[1].toLowerCase()
      || (name === 'September' && named[1].toLowerCase() === 'sept'));
  } else if (numeric || reverse) {
    year = Number(numeric ? numeric[1] : reverse![2]);
    month = Number(numeric ? numeric[2] : reverse![1]) - 1;
  } else return null;
  if (year < 1900 || year > 2100 || month < 0 || month > 11) return null;
  return { label: approximate ? `${year}` : `${MONTHS[month]} ${year}`,
    month: year * 12 + month, ongoing: false, approximate };
}

export const evidenceKey = (value: string) => value.normalize('NFKC').toLowerCase()
  .replace(/[^\p{L}\p{N}+#]+/gu, ' ').trim().replace(/\s+/g, ' ');

export function supportedValue(value: string | null, source: string) {
  if (!value || !source) return value;
  const needle = evidenceKey(value);
  return needle && ` ${evidenceKey(source)} `.includes(` ${needle} `) ? value : null;
}

export function supportedDate(value: string | null, source: string) {
  const parsed = resumeDate(value);
  if (!parsed || !source) return value;
  const candidates = source.match(/\b(?:[A-Za-z]+\.?\s+\d{4}|\d{4}[-/]\d{1,2}|\d{1,2}[/-]\d{4}|\d{4}|present|current|currently|now|ongoing)\b/gi) ?? [];
  return candidates.some(candidate => resumeDate(candidate)?.label === parsed.label) ? parsed.label : null;
}

type Position = { company: string | null; jobTitle: string | null; startDate: string | null; endDate: string | null };

export function normalizeWorkDates(positions: Position[], now = new Date()) {
  const currentMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const unique = new Map<string, Position>();
  let invalid = false;
  let approximate = false;
  let future = false;
  for (const position of positions) {
    const start = resumeDate(position.startDate);
    const end = resumeDate(position.endDate);
    const normalized = { ...position,
      startDate: start && !start.ongoing ? start.label : position.startDate,
      endDate: end?.label ?? position.endDate };
    const key = [normalized.company, normalized.jobTitle, normalized.startDate, normalized.endDate]
      .map(value => evidenceKey(value ?? '')).join('|');
    unique.set(key, normalized);
  }
  const result = [...unique.values()].sort((a, b) => {
    const aEnd = resumeDate(a.endDate);
    const bEnd = resumeDate(b.endDate);
    return Number(bEnd?.ongoing ?? false) - Number(aEnd?.ongoing ?? false)
      || (bEnd?.month ?? -1) - (aEnd?.month ?? -1)
      || (resumeDate(b.startDate)?.month ?? -1) - (resumeDate(a.startDate)?.month ?? -1)
      || JSON.stringify(a).localeCompare(JSON.stringify(b), 'en');
  });
  const intervals: Array<{ start: number; end: number }> = [];
  for (const position of result) {
    const start = resumeDate(position.startDate);
    const end = resumeDate(position.endDate);
    const finish = end?.ongoing ? currentMonth : end?.month;
    if (start?.month == null || finish == null || finish < start.month) {
      invalid = true;
      continue;
    }
    approximate ||= start.approximate || !!end?.approximate;
    future ||= start.month > currentMonth || finish > currentMonth;
    // Scheduled employment is retained but never counted as elapsed experience.
    intervals.push({ start: start.month, end: Math.min(finish, currentMonth) });
  }
  let total = 0;
  let coveredUntil = -1;
  for (const interval of intervals.sort((a, b) => a.start - b.start)) {
    total += Math.max(0, interval.end - Math.max(interval.start, coveredUntil));
    coveredUntil = Math.max(coveredUntil, interval.end);
  }
  const years = Math.floor(total / 12);
  const months = total % 12;
  const duration = invalid || !result.length ? null
    : [years ? `${years} ${years === 1 ? 'year' : 'years'}` : '', months ? `${months} ${months === 1 ? 'month' : 'months'}` : '']
      .filter(Boolean).join(' ') || '0 months';
  return { positions: result, duration, invalid, approximate, future };
}

export function normalizedNamedValues(items: unknown, source: string) {
  if (!Array.isArray(items)) return [];
  const values = new Map<string, string>();
  for (const item of items) {
    if (typeof item?.SkillName !== 'string') continue;
    const value = item.SkillName.normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, 100);
    if (!value || !supportedValue(value, source)) continue;
    const key = evidenceKey(value);
    // Prefer the spelling/case printed in the source where possible.
    const index = source.toLowerCase().indexOf(value.toLowerCase());
    const label = index >= 0 ? source.slice(index, index + value.length) : value;
    const previous = values.get(key);
    if (!previous || label < previous) values.set(key, label);
  }
  return [...values.values()].sort((a, b) => a.localeCompare(b, 'en'))
    .slice(0, 50).map(SkillName => ({ SkillName }));
}
