const SQL_KEYWORDS = new Set([
  "ADD",
  "ALL",
  "ALTER",
  "AND",
  "AS",
  "ASC",
  "BEGIN",
  "BETWEEN",
  "BY",
  "CASCADE",
  "CASE",
  "CAST",
  "CHECK",
  "COLUMN",
  "COMMIT",
  "CONSTRAINT",
  "CREATE",
  "CROSS",
  "CURRENT",
  "DATABASE",
  "DEFAULT",
  "DELETE",
  "DESC",
  "DISTINCT",
  "DROP",
  "ELSE",
  "END",
  "EXCEPT",
  "EXISTS",
  "FILTER",
  "FOREIGN",
  "FROM",
  "FULL",
  "GROUP",
  "HAVING",
  "IF",
  "ILIKE",
  "IN",
  "INDEX",
  "INNER",
  "INSERT",
  "INTERSECT",
  "INTERVAL",
  "INTO",
  "IS",
  "JOIN",
  "KEY",
  "LEFT",
  "LIKE",
  "LIMIT",
  "NATURAL",
  "NOT",
  "NULL",
  "OFFSET",
  "ON",
  "OR",
  "ORDER",
  "OUTER",
  "OVER",
  "PARTITION",
  "PRIMARY",
  "RECURSIVE",
  "REFERENCES",
  "RENAME",
  "RIGHT",
  "ROLLBACK",
  "SELECT",
  "SET",
  "TABLE",
  "TEMPORARY",
  "THEN",
  "TO",
  "TRANSACTION",
  "UNION",
  "UNIQUE",
  "UPDATE",
  "USING",
  "VALUES",
  "VIEW",
  "WHEN",
  "WHERE",
  "WINDOW",
  "WITH",
  "BLOCK",
]);

const SQL_TYPES = new Set([
  "BIGINT",
  "BLOB",
  "BOOLEAN",
  "DATE",
  "DECIMAL",
  "DOUBLE",
  "FLOAT",
  "INTEGER",
  "REAL",
  "TEXT",
  "TIME",
  "TIMESTAMP",
  "VARCHAR",
]);

const TOKEN_RX =
  /(--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|\\'|[^'])*'|"(?:""|\\"|[^"])*"|`(?:``|\\`|[^`])*`|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\b[A-Za-z_][A-Za-z0-9_$]*\b|[^\sA-Za-z0-9_]+)/g;

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function span(className: string, text: string): string {
  return `<span class="${className}">${esc(text)}</span>`;
}

export function highlightSql(sql: string): string {
  let html = "";
  let lastIndex = 0;
  for (const match of sql.matchAll(TOKEN_RX)) {
    const index = match.index ?? 0;
    html += esc(sql.slice(lastIndex, index));
    const token = match[0];
    if (token.startsWith("--") || token.startsWith("/*")) {
      html += span("italic text-zinc-500", token);
    } else if (
      token.startsWith("'") ||
      token.startsWith('"') ||
      token.startsWith("`")
    ) {
      html += span("text-emerald-300", token);
    } else if (/^\d/.test(token)) {
      html += span("text-amber-300", token);
    } else if (
      /^[A-Za-z_]/.test(token) &&
      (SQL_KEYWORDS.has(token.toUpperCase()) || SQL_TYPES.has(token.toUpperCase()))
    ) {
      html += span("text-sky-300", token);
    } else {
      html += esc(token);
    }
    lastIndex = index + token.length;
  }
  html += esc(sql.slice(lastIndex));
  return html;
}