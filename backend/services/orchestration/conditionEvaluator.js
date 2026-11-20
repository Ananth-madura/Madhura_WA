"use strict";

/**
 * conditionEvaluator.js
 *
 * Shared, safe evaluation engine used by both the Flowbot Runtime and
 * Business Automation Engine:
 *   1. Grouped logical conditions (AND / OR / NOT, nested arbitrarily up to depth 8).
 *   2. All 20 comparison operators including ReDoS-safe regex matching.
 *   3. Validation & sanitization for all 18 Flowbot data-capture input types.
 *   4. Variable interpolation ({{customer.name}}, {{flow.budget|N/A}}).
 *   5. Secret masking for Execution Inspector logs.
 */

const MAX_REGEX_LEN = 120;
const MAX_GROUP_DEPTH = 8;

function getPathValue(context, path) {
  if (!path || typeof path !== "string") return undefined;
  const parts = path.trim().split(".");
  let cur = context;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

function isEmptyVal(val) {
  if (val === null || val === undefined) return true;
  if (typeof val === "string") return val.trim() === "";
  if (Array.isArray(val)) return val.length === 0;
  if (typeof val === "object") return Object.keys(val).length === 0;
  return false;
}

function toNum(val) {
  if (typeof val === "number") return Number.isFinite(val) ? val : NaN;
  const cleaned = String(val ?? "").replace(/[₹$,\s]/g, "");
  if (!cleaned) return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function toTimestamp(val) {
  if (val instanceof Date) return val.getTime();
  const ts = Date.parse(String(val ?? ""));
  return Number.isNaN(ts) ? NaN : ts;
}

function safeRegexTest(pattern, input) {
  const p = String(pattern || "");
  if (!p || p.length > MAX_REGEX_LEN) return false;
  // Reject classic nested quantifier patterns to prevent catastrophic backtracking
  if (/(\+|\*|\{\d+,\d*\})\s*\)\s*(\+|\*|\{)/.test(p)) return false;
  try {
    const re = new RegExp(p, "i");
    return re.test(String(input ?? "").slice(0, 2000));
  } catch {
    return false;
  }
}

function resolveValue(val, context) {
  if (typeof val === "string" && /^\{\{[^}]+\}\}$/.test(val.trim())) {
    const key = val.trim().slice(2, -2).trim();
    return getPathValue(context, key);
  }
  return val;
}

function evaluateRule(rule, context) {
  if (!rule || typeof rule !== "object") return false;
  const op = String(rule.operator || "equals").toLowerCase();
  const actual = getPathValue(context, rule.field);
  const expected = resolveValue(rule.value, context);

  switch (op) {
    case "equals":
    case "eq":
    case "==":
      return String(actual ?? "").trim().toLowerCase() === String(expected ?? "").trim().toLowerCase();
    case "not_equals":
    case "neq":
    case "!=":
      return String(actual ?? "").trim().toLowerCase() !== String(expected ?? "").trim().toLowerCase();
    case "contains":
      if (Array.isArray(actual)) {
        return actual.some((item) => String(item).toLowerCase() === String(expected ?? "").toLowerCase());
      }
      return String(actual ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase());
    case "not_contains":
      if (Array.isArray(actual)) {
        return !actual.some((item) => String(item).toLowerCase() === String(expected ?? "").toLowerCase());
      }
      return !String(actual ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase());
    case "starts_with":
      return String(actual ?? "").toLowerCase().startsWith(String(expected ?? "").toLowerCase());
    case "ends_with":
      return String(actual ?? "").toLowerCase().endsWith(String(expected ?? "").toLowerCase());
    case "greater_than":
    case "gt":
    case ">": {
      const a = toNum(actual);
      const b = toNum(expected);
      return !Number.isNaN(a) && !Number.isNaN(b) && a > b;
    }
    case "less_than":
    case "lt":
    case "<": {
      const a = toNum(actual);
      const b = toNum(expected);
      return !Number.isNaN(a) && !Number.isNaN(b) && a < b;
    }
    case "greater_than_or_equal":
    case "gte":
    case ">=": {
      const a = toNum(actual);
      const b = toNum(expected);
      return !Number.isNaN(a) && !Number.isNaN(b) && a >= b;
    }
    case "less_than_or_equal":
    case "lte":
    case "<=": {
      const a = toNum(actual);
      const b = toNum(expected);
      return !Number.isNaN(a) && !Number.isNaN(b) && a <= b;
    }
    case "is_empty":
      return isEmptyVal(actual);
    case "is_not_empty":
      return !isEmptyVal(actual);
    case "exists":
      return actual !== undefined && actual !== null;
    case "not_exists":
      return actual === undefined || actual === null;
    case "in": {
      const list = Array.isArray(expected) ? expected : String(expected || "").split(",").map((s) => s.trim());
      return list.some((v) => String(v).toLowerCase() === String(actual ?? "").toLowerCase());
    }
    case "not_in": {
      const list = Array.isArray(expected) ? expected : String(expected || "").split(",").map((s) => s.trim());
      return !list.some((v) => String(v).toLowerCase() === String(actual ?? "").toLowerCase());
    }
    case "before_date": {
      const a = toTimestamp(actual);
      const b = toTimestamp(expected);
      return !Number.isNaN(a) && !Number.isNaN(b) && a < b;
    }
    case "after_date": {
      const a = toTimestamp(actual);
      const b = toTimestamp(expected);
      return !Number.isNaN(a) && !Number.isNaN(b) && a > b;
    }
    case "between_dates": {
      const a = toTimestamp(actual);
      const start = toTimestamp(Array.isArray(expected) ? expected[0] : rule.value_start);
      const end = toTimestamp(Array.isArray(expected) ? expected[1] : rule.value_end);
      return !Number.isNaN(a) && !Number.isNaN(start) && !Number.isNaN(end) && a >= start && a <= end;
    }
    case "is_valid": {
      const checkType = String(expected || "text");
      return validateCapturedInput(actual, { input_type: checkType, required: true }).valid;
    }
    case "is_invalid": {
      const checkType = String(expected || "text");
      return !validateCapturedInput(actual, { input_type: checkType, required: true }).valid;
    }
    case "regex":
      return safeRegexTest(expected, actual);
    default:
      return false;
  }
}

function evaluateConditionGroup(group, context, depth = 0) {
  if (!group) return true;
  if (depth > MAX_GROUP_DEPTH) return false;

  // Single rule shorthand
  if (group.field && !group.conditions && !group.rules) {
    return evaluateRule(group, context);
  }

  const logic = String(group.logic || group.operator || "AND").toUpperCase();
  const items = Array.isArray(group.conditions)
    ? group.conditions
    : Array.isArray(group.rules)
    ? group.rules
    : [];

  if (items.length === 0) return true;

  const evalItem = (item) =>
    item && (item.conditions || item.rules || item.logic)
      ? evaluateConditionGroup(item, context, depth + 1)
      : evaluateRule(item, context);

  if (logic === "NOT") {
    return !items.every(evalItem);
  }
  if (logic === "OR") {
    return items.some(evalItem);
  }
  return items.every(evalItem);
}

function sanitizeText(raw, maxLen = 2000) {
  return String(raw ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .trim()
    .slice(0, maxLen);
}

/**
 * Validates and sanitizes customer-submitted input across all 18 Flowbot input types.
 */
function validateCapturedInput(rawInput, config = {}) {
  const inputType = String(config.input_type || config.type || "text").toLowerCase();
  const required = config.required !== false;
  const cleaned = sanitizeText(rawInput, inputType === "long_text" ? 4000 : 1000);

  if (!cleaned) {
    if (!required) return { valid: true, value: config.fallback_value ?? "" };
    return { valid: false, error: config.error_response || "This field is required. Please provide a valid response." };
  }

  if (config.min_length && cleaned.length < Number(config.min_length)) {
    return { valid: false, error: config.error_response || `Please enter at least ${config.min_length} characters.` };
  }
  if (config.max_length && cleaned.length > Number(config.max_length)) {
    return { valid: false, error: config.error_response || `Please keep your response under ${config.max_length} characters.` };
  }

  switch (inputType) {
    case "name":
      if (cleaned.length < 2 || /\d{5,}/.test(cleaned)) {
        return { valid: false, error: config.error_response || "Please enter a valid name." };
      }
      return { valid: true, value: cleaned };

    case "phone": {
      const digits = cleaned.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) {
        return { valid: false, error: config.error_response || "Please enter a valid 10 to 15 digit phone number." };
      }
      const normalized = digits.length === 10 ? `91${digits}` : digits;
      return { valid: true, value: normalized };
    }

    case "email": {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!emailRe.test(cleaned)) {
        return { valid: false, error: config.error_response || "Please enter a valid email address (for example, name@company.com)." };
      }
      return { valid: true, value: cleaned.toLowerCase() };
    }

    case "number":
    case "currency": {
      const num = toNum(cleaned);
      if (Number.isNaN(num)) {
        return { valid: false, error: config.error_response || "Please enter a valid number." };
      }
      if (config.min !== undefined && config.min !== null && num < Number(config.min)) {
        return { valid: false, error: config.error_response || `Value must be at least ${config.min}.` };
      }
      if (config.max !== undefined && config.max !== null && num > Number(config.max)) {
        return { valid: false, error: config.error_response || `Value must be at most ${config.max}.` };
      }
      return { valid: true, value: num };
    }

    case "date": {
      const ts = toTimestamp(cleaned);
      if (Number.isNaN(ts)) {
        return { valid: false, error: config.error_response || "Please enter a valid date (for example, YYYY-MM-DD)." };
      }
      return { valid: true, value: new Date(ts).toISOString().slice(0, 10) };
    }

    case "time": {
      if (!/^([01]?\d|2[0-3]):[0-5]\d(\s?(am|pm))?$/i.test(cleaned)) {
        return { valid: false, error: config.error_response || "Please enter a valid time (for example, 14:30 or 2:30 PM)." };
      }
      return { valid: true, value: cleaned };
    }

    case "yes_no": {
      const lc = cleaned.toLowerCase();
      if (["yes", "y", "true", "1", "confirm", "ok", "sure"].includes(lc)) return { valid: true, value: true };
      if (["no", "n", "false", "0", "cancel", "nope"].includes(lc)) return { valid: true, value: false };
      return { valid: false, error: config.error_response || "Please reply with Yes or No." };
    }

    case "dropdown":
    case "product_selection": {
      const opts = Array.isArray(config.options) ? config.options : [];
      if (opts.length > 0) {
        const match = opts.find((o) => {
          const label = typeof o === "string" ? o : (o.label || o.id || o.value);
          const id = typeof o === "string" ? o : (o.id || o.value || o.label);
          return String(label).toLowerCase() === cleaned.toLowerCase() || String(id).toLowerCase() === cleaned.toLowerCase();
        });
        // Allow numeric index selection (e.g., "1", "2")
        const idxMatch = /^\d+$/.test(cleaned) ? opts[Number(cleaned) - 1] : null;
        const resolved = match || idxMatch;
        if (!resolved) {
          return { valid: false, error: config.error_response || "Please choose one of the listed options." };
        }
        return { valid: true, value: typeof resolved === "string" ? resolved : (resolved.value || resolved.id || resolved.label) };
      }
      return { valid: true, value: cleaned };
    }

    case "multi_select": {
      const parts = cleaned.split(",").map((s) => s.trim()).filter(Boolean);
      const opts = Array.isArray(config.options) ? config.options : [];
      if (opts.length > 0) {
        const validSet = new Set(opts.map((o) => String(typeof o === "string" ? o : (o.value || o.id || o.label)).toLowerCase()));
        const invalid = parts.filter((p) => !validSet.has(p.toLowerCase()));
        if (invalid.length > 0) {
          return { valid: false, error: config.error_response || "Please select valid options separated by commas." };
        }
      }
      return { valid: true, value: parts };
    }

    case "file_ref":
    case "location":
    case "address":
    case "company":
    case "text":
    case "long_text":
    case "custom_field":
    default: {
      if (config.format_regex && !safeRegexTest(config.format_regex, cleaned)) {
        return { valid: false, error: config.error_response || "Input format did not match the expected pattern." };
      }
      return { valid: true, value: cleaned };
    }
  }
}

/**
 * Interpolates {{path.to.var}} or {{path.to.var|fallback}} placeholders.
 */
function interpolateText(template, context = {}) {
  if (!template || typeof template !== "string") return "";
  return template.replace(/\{\{\s*([^}|]+?)(?:\|([^}]*))?\s*\}\}/g, (_, key, fallback) => {
    const val = getPathValue(context, key.trim());
    if (val === undefined || val === null || val === "") {
      return fallback !== undefined ? fallback.trim() : "";
    }
    return typeof val === "object" ? JSON.stringify(val) : String(val);
  });
}

const SENSITIVE_KEY_RE = /(password|secret|token|api_?key|authorization|credit_?card|cvv|private_?key|bearer)/i;

function maskSensitiveData(obj, depth = 0) {
  if (obj === null || obj === undefined || depth > 8) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((item) => maskSensitiveData(item, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEY_RE.test(k)) {
      out[k] = v ? "***REDACTED***" : v;
    } else {
      out[k] = maskSensitiveData(v, depth + 1);
    }
  }
  return out;
}

module.exports = {
  getPathValue,
  evaluateRule,
  evaluateConditionGroup,
  validateCapturedInput,
  sanitizeText,
  interpolateText,
  maskSensitiveData,
};
