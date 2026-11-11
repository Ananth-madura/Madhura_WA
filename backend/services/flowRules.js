"use strict";

const OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "gte",
  "greater_or_equal",
  "greater_than",
  "less_than",
  "less_or_equal",
  "is_numeric",
  "is_not_empty",
  "is_empty",
  "in",
  "matches_regex",
];

const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function resolveVar(vars, key) {
  if (!vars || !key || typeof key !== "string") return undefined;
  const cleaned = key.trim();
  if (!cleaned) return undefined;
  if (Object.hasOwn(vars, cleaned)) return vars[cleaned];
  const parts = cleaned.split(".");
  if (parts.some((p) => RESERVED_KEYS.has(p))) return undefined;
  let cur = vars;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object" || !Object.hasOwn(cur, part)) return undefined;
    cur = cur[part];
  }
  return cur;
}

function interpolateText(text, vars = {}, maxLen = 4096) {
  return String(text ?? "")
    .replace(/\{\{?([\w.]+)\}?\}/g, (all, key) => {
      const val = resolveVar(vars, key);
      if (val === undefined) return all;
      if (val === null) return "";
      return typeof val === "object" ? JSON.stringify(val) : String(val);
    })
    .slice(0, maxLen);
}

function compare(rule, vars) {
  const key = rule.field || rule.variable || rule.subject_key;
  const resolved = resolveVar(vars, key);
  const value = resolved === undefined || resolved === null ? "" : String(resolved);
  const expected = String(rule.value ?? "").replace(/\{\{?([\w.]+)\}?\}/g, (all, k) => {
    const v = resolveVar(vars, k);
    return v !== undefined ? String(v ?? "") : all;
  });
  const a = value.toLowerCase();
  const b = expected.toLowerCase();
  const numeric =
    value.trim() !== "" &&
    Number.isFinite(Number(value)) &&
    expected.trim() !== "" &&
    Number.isFinite(Number(expected));

  switch (rule.operator || "equals") {
    case "equals":
      return a === b;
    case "not_equals":
      return a !== b;
    case "contains":
      return a.includes(b);
    case "not_contains":
      return !a.includes(b);
    case "starts_with":
      return a.startsWith(b);
    case "ends_with":
      return a.endsWith(b);
    case "greater_than":
      return numeric && Number(value) > Number(expected);
    case "less_than":
      return numeric && Number(value) < Number(expected);
    case "less_or_equal":
      return numeric && Number(value) <= Number(expected);
    case "greater_or_equal":
    case "gte":
      return numeric && Number(value) >= Number(expected);
    case "is_numeric":
      return value.trim() !== "" && Number.isFinite(Number(value));
    case "is_not_empty":
      return Boolean(value.trim());
    case "is_empty":
      return !value.trim();
    case "in":
      return b
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .includes(a);
    case "matches_regex": {
      if (!expected || expected.length > 250) return false;
      try {
        return new RegExp(expected, "i").test(value);
      } catch (_) {
        return false;
      }
    }
    default:
      throw new Error("Unsupported condition operator");
  }
}

function evaluate(config, vars) {
  const rules = config.rules?.length
    ? config.rules
    : [{ field: config.variable || config.subject_key || config.field, operator: config.operator, value: config.value }];
  return config.match === "any"
    ? rules.some((rule) => compare(rule, vars))
    : rules.every((rule) => compare(rule, vars));
}

function openHours(config, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: config.timezone || "Asia/Kolkata",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  const minute = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
  const time = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const start = time(config.start || "09:00");
  const end = time(config.end || "18:00");
  const days = config.days || [1, 2, 3, 4, 5];
  return start < end
    ? days.includes(day) && minute >= start && minute < end
    : (days.includes(day) && minute >= start) || (days.includes((day + 6) % 7) && minute < end);
}

function secureUrl(template, vars = {}) {
  const parsed = new URL(template);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || /[{}]/.test(parsed.host)) {
    throw new Error("Use a fixed HTTPS destination without embedded credentials");
  }
  const value = String(template).replace(/\{\{?([\w.]+)\}?\}/g, (_, key) => {
    const resolved = resolveVar(vars, key);
    return encodeURIComponent(String(resolved ?? ""));
  });
  if (new URL(value).origin !== parsed.origin) {
    throw new Error("Link variables must not change the destination domain");
  }
  return value;
}

function mediaUrl(template, vars = {}, { env = process.env } = {}) {
  const raw = String(template || "").trim();
  if (!raw) throw new Error("Media URL is required");
  if (raw.startsWith("/api/v2/wa/media-stream/") || raw.startsWith("/api/whatsapp/media-stream/") || raw.startsWith("/uploads/")) {
    const interpolated = interpolateText(raw, vars, 2000);
    if (interpolated.includes("..")) throw new Error("Invalid media path");
    const base = String(env.PUBLIC_BASE_URL || env.REACT_APP_API_URL || "").replace(/\/+$/, "");
    return base ? `${base}${interpolated}` : interpolated;
  }
  return secureUrl(raw, vars);
}

function transformValue(rawExpr, vars = {}, mode = "template", arg = "") {
  const rendered = interpolateText(rawExpr ?? "", vars);
  const renderedArg = interpolateText(arg ?? "", vars);
  switch (mode || "template") {
    case "uppercase":
      return rendered.toUpperCase();
    case "lowercase":
      return rendered.toLowerCase();
    case "trim":
      return rendered.trim();
    case "number_add": {
      const a = Number(rendered), b = Number(renderedArg || 0);
      return Number.isFinite(a) && Number.isFinite(b) ? String(a + b) : rendered;
    }
    case "number_subtract": {
      const a = Number(rendered), b = Number(renderedArg || 0);
      return Number.isFinite(a) && Number.isFinite(b) ? String(a - b) : rendered;
    }
    case "number_multiply": {
      const a = Number(rendered), b = Number(renderedArg || 1);
      return Number.isFinite(a) && Number.isFinite(b) ? String(a * b) : rendered;
    }
    case "number_divide": {
      const a = Number(rendered), b = Number(renderedArg || 1);
      return Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? String(Number((a / b).toFixed(4))) : rendered;
    }
    case "date_offset_days": {
      const base = rendered.trim() ? new Date(rendered) : new Date();
      if (Number.isNaN(base.getTime())) return rendered;
      const offset = Number.parseInt(renderedArg || "0", 10) || 0;
      base.setUTCDate(base.getUTCDate() + offset);
      return base.toISOString().slice(0, 10);
    }
    case "json_extract": {
      try {
        const obj = typeof rawExpr === "string" && rawExpr.trim().startsWith("{")
          ? JSON.parse(rendered)
          : resolveVar(vars, String(rawExpr || "").replace(/[{}]/g, ""));
        const parsedObj = typeof obj === "string" ? JSON.parse(obj) : obj;
        const val = resolveVar(parsedObj, renderedArg);
        if (val === undefined || val === null) return "";
        return typeof val === "object" ? JSON.stringify(val) : String(val);
      } catch (_) {
        return "";
      }
    }
    case "fallback_default":
      return rendered.trim() ? rendered : renderedArg;
    case "template":
    default:
      return rendered;
  }
}

module.exports = {
  OPERATORS,
  RESERVED_KEYS,
  resolveVar,
  interpolateText,
  compare,
  evaluate,
  openHours,
  secureUrl,
  mediaUrl,
  transformValue,
};
