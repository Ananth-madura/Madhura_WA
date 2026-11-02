"use strict";

const OPERATORS = new Set([
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "gt",
  "gte",
  "lt",
  "lte",
  "exists",
  "not_exists",
  "is_empty",
  "is_not_empty",
  "date_before",
  "date_after",
  "date_between",
]);

function normalizeRuleItem(item) {
  if (!item || typeof item !== "object") {
    throw new Error("Invalid condition rule object.");
  }

  // Nested group: { match: 'all'|'any', rules: [...] }
  if (Array.isArray(item.rules) || item.match) {
    return normalizeConditions(item);
  }

  if (typeof item.field !== "string" || !/^[a-zA-Z0-9_.-]+$/.test(item.field)) {
    throw new Error("Each condition needs a valid alphanumeric field name.");
  }

  if (!OPERATORS.has(item.operator)) {
    throw new Error(`Unsupported condition operator: ${item.operator}`);
  }

  const noValueOps = ["exists", "not_exists", "is_empty", "is_not_empty"];
  if (!noValueOps.includes(item.operator) && item.value == null) {
    throw new Error(`Operator '${item.operator}' requires a comparison value.`);
  }

  return {
    field: item.field.trim(),
    operator: item.operator,
    value: item.value !== undefined ? item.value : null,
  };
}

function normalizeConditions(raw) {
  if (raw == null || raw === "") return { match: "all", rules: [] };
  const value = typeof raw === "string" ? JSON.parse(raw) : raw;
  const group = Array.isArray(value) ? { match: "all", rules: value } : value;
  if (!group || !["all", "any"].includes(group.match) || !Array.isArray(group.rules) || group.rules.length > 50) {
    throw new Error("Conditions must contain match (all or any) and up to 50 rules.");
  }
  return {
    match: group.match,
    rules: group.rules.map(normalizeRuleItem),
  };
}

function fieldValue(data, field) {
  if (!data || typeof data !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(data, field)) return data[field];
  return field.split(".").reduce(
    (val, key) =>
      val && typeof val === "object" && Object.prototype.hasOwnProperty.call(val, key)
        ? val[key]
        : undefined,
    data
  );
}

function evaluateSingleRule(rule, data) {
  const actual = fieldValue(data, rule.field);
  const exists = actual != null && String(actual).trim() !== "";

  let passed = false;
  let reason = "";

  switch (rule.operator) {
    case "exists":
      passed = actual != null;
      reason = passed ? "Field exists" : "Field does not exist";
      break;

    case "not_exists":
      passed = actual == null;
      reason = passed ? "Field does not exist" : "Field exists";
      break;

    case "is_empty":
      passed = !exists;
      reason = passed ? "Field is empty" : "Field has content";
      break;

    case "is_not_empty":
      passed = exists;
      reason = passed ? "Field has content" : "Field is empty";
      break;

    case "equals": {
      if (!exists && rule.value != null && String(rule.value).trim() !== "") {
        passed = false;
        reason = "Field is missing/empty";
      } else {
        const a = String(actual ?? "").toLowerCase().trim();
        const b = String(rule.value ?? "").toLowerCase().trim();
        passed = a === b;
        reason = passed ? `Matched '${b}'` : `Expected '${b}', found '${a}'`;
      }
      break;
    }

    case "not_equals": {
      const a = String(actual ?? "").toLowerCase().trim();
      const b = String(rule.value ?? "").toLowerCase().trim();
      passed = a !== b;
      reason = passed ? `Differs from '${b}'` : `Matches '${b}'`;
      break;
    }

    case "contains": {
      if (!exists) {
        passed = false;
        reason = "Field is missing/empty";
      } else {
        const a = String(actual).toLowerCase();
        const b = String(rule.value ?? "").toLowerCase().trim();
        passed = a.includes(b);
        reason = passed ? `Contains '${b}'` : `Missing '${b}' in '${a}'`;
      }
      break;
    }

    case "not_contains": {
      if (!exists) {
        passed = true;
        reason = "Field is empty (does not contain value)";
      } else {
        const a = String(actual).toLowerCase();
        const b = String(rule.value ?? "").toLowerCase().trim();
        passed = !a.includes(b);
        reason = passed ? `Does not contain '${b}'` : `Contains '${b}' in '${a}'`;
      }
      break;
    }

    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const x = Number(actual);
      const y = Number(rule.value);
      if (!Number.isFinite(x) || !Number.isFinite(y) || String(rule.value ?? "").trim() === "") {
        passed = false;
        reason = "Non-numeric values for numeric comparison";
      } else {
        const comp = { gt: x > y, gte: x >= y, lt: x < y, lte: x <= y };
        passed = comp[rule.operator] === true;
        reason = passed
          ? `Numeric condition met: ${x} ${rule.operator} ${y}`
          : `Numeric comparison failed: ${x} ${rule.operator} ${y}`;
      }
      break;
    }

    case "date_before": {
      const actualDate = new Date(actual).getTime();
      const targetDate = new Date(rule.value).getTime();
      if (!Number.isFinite(actualDate) || !Number.isFinite(targetDate)) {
        passed = false;
        reason = "Invalid date format for date comparison";
      } else {
        passed = actualDate < targetDate;
        reason = passed ? "Date is before target" : "Date is not before target";
      }
      break;
    }

    case "date_after": {
      const actualDate = new Date(actual).getTime();
      const targetDate = new Date(rule.value).getTime();
      if (!Number.isFinite(actualDate) || !Number.isFinite(targetDate)) {
        passed = false;
        reason = "Invalid date format for date comparison";
      } else {
        passed = actualDate > targetDate;
        reason = passed ? "Date is after target" : "Date is not after target";
      }
      break;
    }

    case "date_between": {
      const actualDate = new Date(actual).getTime();
      let parts = Array.isArray(rule.value) ? rule.value : String(rule.value || "").split(",");
      const startDate = new Date(parts[0]?.trim()).getTime();
      const endDate = new Date(parts[1]?.trim()).getTime();
      if (!Number.isFinite(actualDate) || !Number.isFinite(startDate) || !Number.isFinite(endDate)) {
        passed = false;
        reason = "Invalid date range in date_between comparison";
      } else {
        passed = actualDate >= startDate && actualDate <= endDate;
        reason = passed ? "Date falls within range" : "Date is outside range";
      }
      break;
    }

    default:
      passed = false;
      reason = "Unknown operator";
  }

  return {
    field: rule.field,
    operator: rule.operator,
    expectedValue: rule.value,
    actualValue: actual !== undefined ? actual : null,
    passed,
    reason,
  };
}

function evaluateConditionsWithDiagnostics(raw, data = {}) {
  let group;
  try {
    group = normalizeConditions(raw);
  } catch (err) {
    return {
      matched: false,
      error: err.message,
      diagnostics: [{ field: "conditions", passed: false, reason: "Malformed conditions: " + err.message }],
    };
  }

  if (!group.rules.length) {
    return { matched: true, diagnostics: [] };
  }

  const diagnostics = [];

  function evaluateGroup(grp) {
    const isAny = grp.match === "any";
    let groupMatched = isAny ? false : true;

    for (const item of grp.rules) {
      if (item.rules) {
        // Nested sub-group
        const subResult = evaluateGroup(item);
        diagnostics.push({
          isGroup: true,
          match: item.match,
          passed: subResult,
          subRulesCount: item.rules.length,
        });
        if (isAny && subResult) groupMatched = true;
        if (!isAny && !subResult) groupMatched = false;
      } else {
        const result = evaluateSingleRule(item, data);
        diagnostics.push(result);
        if (isAny && result.passed) groupMatched = true;
        if (!isAny && !result.passed) groupMatched = false;
      }
    }

    return groupMatched;
  }

  const matched = evaluateGroup(group);
  return { matched, diagnostics };
}

function matchesConditions(raw, data = {}) {
  const { matched } = evaluateConditionsWithDiagnostics(raw, data);
  return matched;
}

module.exports = {
  OPERATORS,
  normalizeConditions,
  matchesConditions,
  evaluateConditionsWithDiagnostics,
  fieldValue,
};
