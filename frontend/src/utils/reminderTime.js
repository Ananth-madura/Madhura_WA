/**
 * reminderTime.js
 *
 * Deterministic natural-language time parsing for chat reminders.
 * No LLM, no network: every phrase resolves to a local Date or null.
 */

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const MONTHS = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const MONTH_PATTERN = Object.keys(MONTHS).join("|");

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

function withTime(date, hour, minute = 0) {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTime(text) {
  let match = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/);
  if (match) {
    let hour = Number(match[1]);
    const minute = match[2] ? Number(match[2]) : 0;
    const isPm = match[3].startsWith("p");
    if (hour === 12) hour = isPm ? 12 : 0;
    else if (isPm) hour += 12;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute, matched: match[0].trim() };
    }
  }

  match = text.match(/\b(?:at\s+)?(\d{1,2}):(\d{2})\b/);
  if (match) {
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute, matched: match[0].trim() };
    }
  }

  match = text.match(/\b(noon|midday|midnight|morning|afternoon|evening|night|tonight)\b/);
  if (match) {
    const word = match[1];
    const hour =
      word === "noon" || word === "midday"
        ? 12
        : word === "midnight"
        ? 0
        : word === "morning"
        ? 9
        : word === "afternoon"
        ? 14
        : word === "evening"
        ? 18
        : 20;
    return { hour, minute: 0, matched: match[0] };
  }

  return null;
}

function extractDate(text, now) {
  let match = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (!Number.isNaN(date.getTime())) {
      return { date: startOfDay(date), matched: match[0], absolute: true, hasYear: true };
    }
  }

  match = text.match(/\bin\s+(\d+)\s*(minutes?|mins?|hours?|hrs?|days?|weeks?)\b/);
  if (match) {
    const amount = Number(match[1]);
    const unit = match[2];
    const date = new Date(now);
    if (/^min/.test(unit)) date.setMinutes(date.getMinutes() + amount);
    else if (/^(hour|hr)/.test(unit)) date.setHours(date.getHours() + amount);
    else if (/^day/.test(unit)) date.setDate(date.getDate() + amount);
    else date.setDate(date.getDate() + amount * 7);
    return { date, matched: match[0], precise: true };
  }

  if (/\b(tomorrow|tmrw|tmr)\b/.test(text)) {
    return {
      date: addDays(startOfDay(now), 1),
      matched: text.match(/\b(tomorrow|tmrw|tmr)\b/)[0],
      precise: false,
    };
  }

  if (/\btoday\b/.test(text)) {
    return { date: startOfDay(now), matched: "today", precise: false };
  }

  if (/\btonight\b/.test(text)) {
    return { date: startOfDay(now), matched: "tonight", precise: false };
  }

  if (/\bnext\s+week\b/.test(text)) {
    return { date: addDays(startOfDay(now), 7), matched: "next week", precise: false };
  }

  if (/\bnext\s+month\b/.test(text)) {
    return { date: addMonths(startOfDay(now), 1), matched: "next month", precise: false };
  }

  if (/\bnext\s+year\b/.test(text)) {
    return { date: addMonths(startOfDay(now), 12), matched: "next year", precise: false };
  }

  match = text.match(
    new RegExp(`\\b(next\\s+)?(${WEEKDAYS.join("|")})\\b`)
  );
  if (match) {
    const isNext = Boolean(match[1]);
    const target = WEEKDAYS.indexOf(match[2]);
    let delta = (target - now.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    // "next monday" means the coming Monday, exactly like plain "monday".
    // Keeping both forms identical avoids the off-by-one-week surprise.
    void isNext;
    return { date: addDays(startOfDay(now), delta), matched: match[0], precise: false };
  }

  match = text.match(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})\\b(?:\\s+(\\d{4}))?`)
  );
  if (!match) {
    match = text.match(
      new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s+(\\d{4}))?`)
    );
    if (match) {
      const month = MONTHS[match[1]];
      const day = Number(match[2]);
      const year = match[3] ? Number(match[3]) : now.getFullYear();
      const date = new Date(year, month, day);
      return {
        date: startOfDay(date),
        matched: match[0],
        absolute: true,
        hasYear: Boolean(match[3]),
        monthDay: { month, day },
      };
    }
  } else {
    const day = Number(match[1]);
    const month = MONTHS[match[2]];
    const year = match[3] ? Number(match[3]) : now.getFullYear();
    const date = new Date(year, month, day);
    return {
      date: startOfDay(date),
      matched: match[0],
      absolute: true,
      hasYear: Boolean(match[3]),
      monthDay: { month, day },
    };
  }

  match = text.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
  if (match) {
    let day = Number(match[1]);
    let month = Number(match[2]) - 1;
    // Day-first unless the first number cannot be a day.
    if (day > 12 && month + 1 <= 12) {
      // already day-first
    } else if (month + 1 > 12 && day <= 12) {
      const swap = day;
      day = month + 1;
      month = swap - 1;
    }
    let year = match[3] ? Number(match[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    const date = new Date(year, month, day);
    if (!Number.isNaN(date.getTime())) {
      return {
        date: startOfDay(date),
        matched: match[0],
        absolute: true,
        hasYear: Boolean(match[3]),
        monthDay: { month, day },
      };
    }
  }

  return null;
}

/**
 * Parse a free-text reminder time. Returns a Date strictly in the future, or
 * null when the text carries no recognisable time.
 */
export function parseReminderTime(input, now = new Date()) {
  const text = normalize(input);
  if (!text) return null;

  const timeInfo = extractTime(text);
  const dateInfo = extractDate(text, now);
  if (!timeInfo && !dateInfo) return null;

  let base;
  if (dateInfo) {
    base = dateInfo.precise ? new Date(dateInfo.date) : startOfDay(dateInfo.date);
  } else {
    base = startOfDay(now);
  }

  let result;
  if (timeInfo) {
    result = withTime(base, timeInfo.hour, timeInfo.minute);
  } else if (dateInfo?.precise) {
    result = new Date(base);
  } else {
    result = withTime(base, 9, 0);
  }

  if (result.getTime() <= now.getTime()) {
    if (dateInfo?.absolute) {
      if (dateInfo.hasYear) return null;
      if (dateInfo.monthDay) {
        const next = new Date(result);
        next.setFullYear(next.getFullYear() + 1);
        result = next;
      } else {
        result = addDays(result, 1);
      }
    } else if (timeInfo) {
      result = addDays(result, 1);
    } else if (dateInfo && !dateInfo.absolute) {
      // "today" without a time, or a precise relative value that landed in the
      // past because of clock skew - move to the next day at the same time.
      result = addDays(result, 1);
    } else {
      return null;
    }
  }

  return result.getTime() > now.getTime() ? result : null;
}

/**
 * Splits a `/remind` command into a date and the remaining note.
 * "tomorrow 10am call about invoice" -> { date, note: "call about invoice" }
 */
export function parseReminderCommand(input, now = new Date()) {
  const text = String(input || "").trim();
  if (!text) return { date: null, note: "", matchedText: "" };

  const normalizedText = normalize(text);
  const timeInfo = extractTime(normalizedText);
  const dateInfo = extractDate(normalizedText, now);
  const matchedText = [dateInfo?.matched, timeInfo?.matched]
    .filter(Boolean)
    .join(" ")
    .trim();

  let note = text;
  for (const part of [dateInfo?.matched, timeInfo?.matched].filter(Boolean)) {
    const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    note = note.replace(new RegExp(escaped, "i"), " ");
  }
  note = note
    .replace(/^\s*(at|on|by|for)\b/i, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    date: parseReminderTime(text, now),
    note,
    matchedText,
  };
}

/** Accepts a Date, an ISO string or a SQL "YYYY-MM-DD HH:MM:SS" string. */
export function toReminderDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const text = String(value);
  const isNaiveSql = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/.test(text) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(text);
  const date = isNaiveSql ? new Date(text.replace(" ", "T")) : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatReminderTime(value, now = new Date()) {
  const date = toReminderDate(value);
  if (!date) return "Not scheduled";
  const time = date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const today = startOfDay(now);
  const target = startOfDay(date);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Tomorrow, ${time}`;
  if (diffDays === -1) return `Yesterday, ${time}`;
  const sameYear = date.getFullYear() === now.getFullYear();
  const day = date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `${day}, ${time}`;
}

export function formatReminderTimeShort(value, now = new Date()) {
  const date = toReminderDate(value);
  if (!date) return "";
  return formatReminderTime(date, now);
}

export function toDateTimeLocalValue(value) {
  const date = toReminderDate(value);
  if (!date) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function quickReminderPresets(now = new Date()) {
  const tonight = withTime(startOfDay(now), 20, 0);
  const nextMonday = (() => {
    let delta = (1 - now.getDay() + 7) % 7;
    if (delta <= 0) delta += 7;
    return withTime(addDays(startOfDay(now), delta), 9, 0);
  })();

  const options = [
    {
      id: "1h",
      label: "In 1 hour",
      date: new Date(now.getTime() + 60 * 60 * 1000),
    },
    {
      id: "tonight",
      label: "Tonight 8pm",
      date: tonight.getTime() > now.getTime() ? tonight : addDays(tonight, 1),
    },
    {
      id: "tomorrow",
      label: "Tomorrow 9am",
      date: withTime(addDays(startOfDay(now), 1), 9, 0),
    },
    {
      id: "3d",
      label: "In 3 days, 9am",
      date: withTime(addDays(startOfDay(now), 3), 9, 0),
    },
    {
      id: "monday",
      label: "Next Monday 9am",
      date: nextMonday,
    },
  ];

  return options;
}
