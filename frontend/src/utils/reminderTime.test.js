import {
  parseReminderTime,
  parseReminderCommand,
  formatReminderTime,
  toDateTimeLocalValue,
  quickReminderPresets,
  toReminderDate,
} from "./reminderTime";

// Fixed "now": Sunday 25 October 2026, 08:00 local time. Every expectation below
// is written in local time on purpose - the parser must never silently switch
// to UTC, or a reminder set for "9am" would fire at the wrong hour for the user.
const NOW = new Date(2026, 9, 25, 8, 0, 0);

const at = (y, m, d, h, min = 0) => new Date(y, m, d, h, min, 0, 0).getTime();

describe("parseReminderTime", () => {
  test("relative hours and days", () => {
    expect(parseReminderTime("in 2 hours", NOW).getTime()).toBe(
      NOW.getTime() + 2 * 60 * 60 * 1000
    );
    expect(parseReminderTime("in 45 minutes", NOW).getTime()).toBe(
      NOW.getTime() + 45 * 60 * 1000
    );
    expect(parseReminderTime("tomorrow 10am", NOW).getTime()).toBe(at(2026, 9, 26, 10));
    expect(parseReminderTime("today 6pm", NOW).getTime()).toBe(at(2026, 9, 25, 18));
  });

  test("weekdays resolve to the next occurrence", () => {
    expect(parseReminderTime("monday 9am", NOW).getTime()).toBe(at(2026, 9, 26, 9));
    expect(parseReminderTime("next monday 9:30 am", NOW).getTime()).toBe(
      at(2026, 9, 26, 9, 30)
    );
    // Today is Sunday, so asking for Sunday must not return a past timestamp.
    expect(parseReminderTime("sunday 7pm", NOW).getTime()).toBe(at(2026, 10, 1, 19));
  });

  test("absolute dates with and without a year", () => {
    expect(parseReminderTime("25 Oct 5pm", NOW).getTime()).toBe(at(2026, 9, 25, 17));
    expect(parseReminderTime("1 Nov 9am", NOW).getTime()).toBe(at(2026, 10, 1, 9));
    expect(parseReminderTime("2027-01-05 11am", NOW).getTime()).toBe(at(2027, 0, 5, 11));
    expect(parseReminderTime("5/1 11am", NOW).getTime()).toBe(at(2027, 0, 5, 11));
  });

  test("a past time with no date rolls to tomorrow", () => {
    expect(parseReminderTime("7am", NOW).getTime()).toBe(at(2026, 9, 26, 7));
  });

  test("text with no recognisable time returns null", () => {
    expect(parseReminderTime("call the customer", NOW)).toBeNull();
    expect(parseReminderTime("", NOW)).toBeNull();
    expect(parseReminderTime(null, NOW)).toBeNull();
  });

  test("a past absolute date without a year rolls forward a year", () => {
    expect(parseReminderTime("1 Jan 9am", NOW).getTime()).toBe(at(2027, 0, 1, 9));
  });
});

describe("parseReminderCommand", () => {
  test("splits the time phrase from the note", () => {
    const parsed = parseReminderCommand("tomorrow 10am call about the invoice", NOW);
    expect(parsed.date.getTime()).toBe(at(2026, 9, 26, 10));
    expect(parsed.note).toBe("call about the invoice");
  });

  test("keeps a note that has no time, leaving the date empty", () => {
    const parsed = parseReminderCommand("ring the supplier", NOW);
    expect(parsed.date).toBeNull();
    expect(parsed.note).toBe("ring the supplier");
  });

  test("an empty command yields no date and no note", () => {
    expect(parseReminderCommand("   ", NOW)).toEqual({
      date: null,
      note: "",
      matchedText: "",
    });
  });
});

describe("display helpers", () => {
  test("formatReminderTime uses relative day labels", () => {
    expect(formatReminderTime(at(2026, 9, 25, 18), NOW)).toMatch(/^Today,/);
    expect(formatReminderTime(at(2026, 9, 26, 9), NOW)).toMatch(/^Tomorrow,/);
    expect(formatReminderTime(at(2026, 9, 24, 9), NOW)).toMatch(/^Yesterday,/);
    expect(formatReminderTime(null, NOW)).toBe("Not scheduled");
  });

  test("SQL datetimes are read as local time, not UTC", () => {
    const parsed = toReminderDate("2026-10-26 09:30:00");
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(9);
    expect(parsed.getDate()).toBe(26);
    expect(parsed.getHours()).toBe(9);
    expect(parsed.getMinutes()).toBe(30);
  });

  test("datetime-local values round-trip", () => {
    expect(toDateTimeLocalValue(at(2026, 9, 26, 9, 30))).toBe("2026-10-26T09:30");
  });

  test("quick presets are all in the future", () => {
    const presets = quickReminderPresets(NOW);
    expect(presets.length).toBeGreaterThan(0);
    for (const preset of presets) {
      expect(preset.date.getTime()).toBeGreaterThan(NOW.getTime());
      expect(preset.label).toBeTruthy();
    }
  });
});
