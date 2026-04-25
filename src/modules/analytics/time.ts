/**
 * Pure date-bucketing helpers used by analytics dashboards.
 */

export type MonthBucket = { key: string; label: string; from: Date; to: Date };

/** Last `n` months including current, oldest-first. */
export function lastNMonths(n: number, ref = new Date()): MonthBucket[] {
  const months: MonthBucket[] = [];
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  for (let i = n - 1; i >= 0; i--) {
    const from = new Date(Date.UTC(y, m - i, 1));
    const to = new Date(Date.UTC(y, m - i + 1, 1));
    const key = `${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = from.toLocaleString("en", { month: "short", timeZone: "UTC" });
    months.push({ key, label, from, to });
  }
  return months;
}

/** Bucket a list of {createdAt, value?} rows into the supplied month buckets. */
export function bucketByMonth<T extends { createdAt: Date }>(
  rows: T[],
  buckets: MonthBucket[],
  pick: (row: T) => number = () => 1,
): { label: string; value: number }[] {
  const map = new Map(buckets.map((b) => [b.key, 0]));
  for (const row of rows) {
    const k = `${row.createdAt.getUTCFullYear()}-${String(row.createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
    if (map.has(k)) map.set(k, (map.get(k) ?? 0) + pick(row));
  }
  return buckets.map((b) => ({ label: b.label, value: map.get(b.key) ?? 0 }));
}
