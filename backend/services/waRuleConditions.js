"use strict";

const OPERATORS = new Set(["equals", "not_equals", "contains", "gt", "gte", "lt", "lte", "exists", "not_exists"]);

function normalizeConditions(raw) {
  if (raw == null || raw === "") return { match: "all", rules: [] };
  const value = typeof raw === "string" ? JSON.parse(raw) : raw;
  const group = Array.isArray(value) ? { match: "all", rules: value } : value;
  if (!group || !["all", "any"].includes(group.match) || !Array.isArray(group.rules) || group.rules.length > 30) {
    throw new Error("Conditions must contain match (all or any) and up to 30 rules.");
  }
  for (const rule of group.rules) {
    if (!rule || typeof rule.field !== "string" || !/^[a-zA-Z0-9_.-]+$/.test(rule.field) || !OPERATORS.has(rule.operator)) {
      throw new Error("Each condition needs a field and a supported operator.");
    }
    if (!['exists', 'not_exists'].includes(rule.operator) && (rule.value == null || typeof rule.value === 'object')) {
      throw new Error("Each comparison needs a text, number, or boolean value.");
    }
  }
  return group;
}

function fieldValue(data, field) {
  if (Object.prototype.hasOwnProperty.call(data, field)) return data[field];
  return field.split('.').reduce((value, key) => value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined, data);
}

function matchesConditions(raw, data = {}) {
  // Invalid stored conditions must never cause an unconditional send.
  let group;
  try { group = normalizeConditions(raw); } catch (_) { return false; }
  if (!group.rules.length) return true;
  const compare = (rule) => {
    const actual = fieldValue(data, rule.field);
    const exists = actual != null && actual !== '';
    if (rule.operator === 'exists') return exists;
    if (rule.operator === 'not_exists') return !exists;
    if (!exists) return false;
    const a = String(actual).toLowerCase();
    const b = String(rule.value).toLowerCase();
    if (rule.operator === 'equals') return a === b;
    if (rule.operator === 'not_equals') return a !== b;
    if (rule.operator === 'contains') return a.includes(b);
    const x = Number(actual), y = Number(rule.value);
    if (!Number.isFinite(x) || !Number.isFinite(y) || String(rule.value).trim() === '') return false;
    return { gt: x > y, gte: x >= y, lt: x < y, lte: x <= y }[rule.operator] === true;
  };
  return group.match === 'any' ? group.rules.some(compare) : group.rules.every(compare);
}

module.exports = { normalizeConditions, matchesConditions, fieldValue };
