"use strict";
const serverChatStorageEnabled = () => process.env.WA_SERVER_CHAT_STORAGE === "1";
const PRIVATE_COLUMNS = {
  conversations: new Set(["last_message_text", "subject"]),
  wa_message_logs: new Set(["message_text", "metadata", "interactive_payload", "media_url", "media_filename"]),
  wa_contacts: new Set(["last_message_text"]),
  wa_webhook_events: new Set(["payload"]),
  wa_flow_run_events: new Set(["payload"]),
  wa_interactive_reminders: new Set(["response_text"]),
};
// Split SQL expressions without splitting function arguments or quoted strings.
function splitExpressions(text) {
  const result = []; let start = 0, depth = 0, quote = null;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote) { if (char === quote && text[i - 1] !== "\\") quote = null; continue; }
    if (["'", '"', '`'].includes(char)) quote = char;
    else if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ',' && depth === 0) { result.push(text.slice(start, i)); start = i + 1; }
  }
  result.push(text.slice(start)); return result;
}
function redactChatWrite(sql, params = []) {
  if (serverChatStorageEnabled() || typeof sql !== "string") return { sql, params };
  if (/^\s*UPDATE\s+wa_flow_runs\s+SET/i.test(sql) && /status\s*=\s*'(completed|failed|handed_off|timed_out)'/i.test(sql) && !/\bvars\s*=/i.test(sql)) {
    sql = sql.replace(/\bSET\s+/i, "SET vars = NULL, ");
  }
  const insert = sql.match(/INSERT\s+(?:IGNORE\s+)?INTO\s+`?(\w+)`?\s*\(([^)]+)\)\s*VALUES\s*/i);
  const update = sql.match(/UPDATE\s+`?(\w+)`?\s+SET\s+([\s\S]+?)(?=\s+WHERE\s+|$)/i);
  const table = (insert?.[1] || update?.[1] || '').toLowerCase();
  const privateColumns = PRIVATE_COLUMNS[table];
  if (!privateColumns) return { sql, params };
  const values = Array.isArray(params) ? [...params] : [];
  if (insert) {
    const columns = splitExpressions(insert[2]).map((field) => field.trim().replace(/`/g, '').toLowerCase());
    const offset = insert.index + insert[0].length;
    if (sql[offset] === '?') {
      return { sql, params: [values[0].map((row) => row.map((value, index) => privateColumns.has(columns[index]) ? null : value)), ...values.slice(1)] };
    }
    if (sql[offset] !== '(') return { sql, params };
    let end = offset + 1, depth = 1, quote = null;
    for (; end < sql.length && depth; end++) {
      const char = sql[end];
      if (quote) { if (char === quote && sql[end - 1] !== '\\') quote = null; }
      else if (["'", '"'].includes(char)) quote = char;
      else if (char === '(') depth++;
      else if (char === ')') depth--;
    }
    let index = 0;
    const expressions = splitExpressions(sql.slice(offset + 1, end - 1));
    const rewritten = expressions.map((expression, column) => {
      const count = (expression.match(/\?/g) || []).length;
      if (privateColumns.has(columns[column])) { for (let n = 0; n < count; n++) values[index + n] = null; }
      index += count;
      return privateColumns.has(columns[column]) && !count ? 'NULL' : expression;
    });
    return { sql: sql.slice(0, offset + 1) + rewritten.join(',') + sql.slice(end - 1), params: values };
  }
  let index = 0;
  const assignments = splitExpressions(update[2]).map((expression) => {
    const field = expression.match(/^\s*`?(\w+)`?\s*=/)?.[1]?.toLowerCase();
    const count = (expression.match(/\?/g) || []).length;
    if (privateColumns.has(field)) { for (let n = 0; n < count; n++) values[index + n] = null; }
    index += count;
    return privateColumns.has(field) && !count ? `${field}=NULL` : expression;
  });
  return { sql: sql.slice(0, update.index) + update[0].replace(update[2], assignments.join(',')) + sql.slice(update.index + update[0].length), params: values };
}
module.exports = { serverChatStorageEnabled, redactChatWrite };
