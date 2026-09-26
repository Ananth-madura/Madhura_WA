// Test comprehensive dynamic keywords resolution in WhatsApp automations
const { formatMessagePlaceholders } = require("../services/waAutomationService");

function runTests() {
  console.log("🧪 STARTING COMPREHENSIVE DYNAMIC KEYWORD TESTS");

  const sampleData = {
    name: "Murugan Swaminathan",
    phone: "919629955582",
    company: "Madhura Commercial Tech",
    service: "AC Chiller Overhaul & AMC",
    amount: "28500",
    due_date: "2026-09-30",
    invoice_no: "INV-2026-999",
    city: "Tirupur",
  };

  const testCases = [
    {
      title: "Tomorrow Date & Tomorrow Day Name (Direct & Variations)",
      template: "Hi {name}, reminder for tomorrow: {tomorrow} which is {tomorrow_day}! Alt: {tomorrow_date} on {tomorrow_day_name}.",
      checks: [
        (res) => !res.includes("{tomorrow}") && !res.includes("{tomorrow_day}"),
        (res) => !res.includes("{tomorrow_date}") && !res.includes("{tomorrow_day_name}"),
        (res) => /reminder for tomorrow: \d{2} \w+ \d{4} which is \w+!/.test(res),
      ],
    },
    {
      title: "Phonetic / Typo Variations (tommowe, tomarrow, tommow)",
      template: "Hello {name}, your appointment is on {tommowe} ({tommowe_day}) or {tomarrow} ({tomarrow_day}) or {tomorow}.",
      checks: [
        (res) => !res.includes("{tommowe}") && !res.includes("{tommowe_day}"),
        (res) => !res.includes("{tomarrow}") && !res.includes("{tomarrow_day}"),
        (res) => !res.includes("{tomorow}"),
        (res) => res.includes("Murugan Swaminathan"),
      ],
    },
    {
      title: "Spaced & Hyphenated Tokens ({tomorrow date}, {tomorrow day}, {service name}, {due date})",
      template: "Dear {name}, on {tomorrow date} ({tomorrow day}), your {service name} for {amount} is due on {due date}.",
      checks: [
        (res) => !res.includes("{tomorrow date}") && !res.includes("{tomorrow day}"),
        (res) => !res.includes("{service name}") && !res.includes("{due date}"),
        (res) => res.includes("₹28500"),
        (res) => res.includes("AC Chiller Overhaul & AMC"),
      ],
    },
    {
      title: "Live Date, Time & Date-Time ({date}, {time}, {date_time}, {day_name})",
      template: "Current status on {day_name} ({date}) at {time}. Combined: {date_time}. Greeting: {greeting_time}.",
      checks: [
        (res) => !res.includes("{day_name}") && !res.includes("{date}") && !res.includes("{time}"),
        (res) => !res.includes("{date_time}") && !res.includes("{greeting_time}"),
        (res) => res.includes("Good "),
      ],
    },
    {
      title: "Spintax & Variables Coexistence",
      template: "[Hello|Hi|Greetings] {name}! Tomorrow is {tomorrow}. {Good morning|Have a great day}!",
      checks: [
        (res) => !res.includes("{name}") && !res.includes("{tomorrow}"),
        (res) => res.includes("Murugan Swaminathan"),
        (res) => !res.includes("[") && !res.includes("]"),
      ],
    },
    {
      title: "Double Curly Brackets {{tomorrow}} and {{tomorrow_day}}",
      template: "Welcome {{name}} to {{company}}! Tomorrow {{tomorrow}} is {{tomorrow_day}}.",
      checks: [
        (res) => !res.includes("{{name}}") && !res.includes("{{company}}"),
        (res) => !res.includes("{{tomorrow}}") && !res.includes("{{tomorrow_day}}"),
        (res) => res.includes("Madhura Commercial Tech"),
      ],
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const output = formatMessagePlaceholders(tc.template, sampleData.name, sampleData);
    let ok = true;
    for (const check of tc.checks) {
      if (!check(output)) {
        ok = false;
        break;
      }
    }

    if (ok) {
      console.log(`✅ PASS: ${tc.title}`);
      console.log(`   Output: "${output.trim()}"`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${tc.title}`);
      console.error(`   Output: "${output.trim()}"`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
