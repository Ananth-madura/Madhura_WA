import { automationIssues, sampleMatches, sampleMessage } from "./automationDraft";
const valid = { sender_id:1, name: "Invoice", trigger_type: "invoice_created", msg_kind: "text", message_text: "Hello {name}", delay_minutes: 0, enable_sequence: false };
const conditions = { match: "all", rules: [] };

test("readiness rejects incomplete follow-ups and fractional or excessive delays", () => {
  expect(automationIssues(valid, conditions, [], [], [],[{id:1,status:"connected"}])).toEqual([]);
  expect(automationIssues({ ...valid, enable_sequence: true, followup_msg_kind: "media", followup_media_url: "http://example.com/file.pdf", sequence_delay_seconds: 7 }, conditions, [], [], [],[{id:1,status:"connected"}]).join(" ")).toMatch(/HTTPS/);
  for (const delay_minutes of ["", "bad", -1, 1.5, 43201]) expect(automationIssues({ ...valid, delay_minutes }, conditions, [], [], [],[{id:1,status:"connected"}]).length).toBeGreaterThan(0);
});

test("sample conditions preserve zero, false and missing-field behavior", () => {
  expect(sampleMatches({ match: "all", rules: [{ field: "amount", operator: "gte", value: 0 }, { field: "customer.active", operator: "equals", value: false }] }, { amount: 0, customer: { active: false } })).toBe(true);
  expect(sampleMatches({ match: "any", rules: [{ field: "missing", operator: "not_equals", value: "x" }] }, {})).toBe(false);
  expect(sampleMessage("{amount}, {{customer.active}}, {unknown}", { amount: 0, customer: { active: false } })).toBe("0, false, {unknown}");
});
