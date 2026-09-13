export const pad = (n) => String(n).padStart(2, "0");
export const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function addDaysKey(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return keyOf(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

export function todayK() {
  const t = new Date();
  return keyOf(t.getFullYear(), t.getMonth(), t.getDate());
}

export function diffDays(a, b) {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
}
