"use strict";

function localParts(date, timezone) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

// Solve local midnight as a UTC instant, including zones with DST transitions.
function calendarCutoff(timezone = "UTC", now = new Date()) {
  const today = localParts(now, timezone);
  const target = Date.UTC(today.year, today.month - 1, today.day - 6);
  let instant = target;
  for (let i = 0; i < 4; i++) {
    const parts = localParts(new Date(instant), timezone);
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const delta = target - represented;
    instant += delta;
    if (!delta) break;
  }
  return new Date(instant).toISOString().slice(0, 19).replace("T", " ");
}

module.exports = { calendarCutoff };
