/**
 * Best-effort extraction of the table a single INSERT/UPDATE/DELETE statement
 * targets, used only to decide whether to nudge a Drive-linked table to
 * re-sync after a SQL edit. Not a SQL parser — multi-statement scripts or
 * exotic syntax simply won't trigger auto-sync (the manual sync button in
 * the sidebar always still works).
 */
export function extractDmlTargetTable(sql: string): string | null {
  const statement = sql.trim().split(";")[0]?.trim() ?? "";
  const patterns = [
    /^insert\s+into\s+"?([\w.]+)"?/iu,
    /^update\s+"?([\w.]+)"?\s+set/iu,
    /^delete\s+from\s+"?([\w.]+)"?/iu,
  ];
  for (const pattern of patterns) {
    const match = statement.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}
