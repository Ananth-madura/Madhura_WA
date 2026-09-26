import React, { useState } from "react";
import { Sparkles, User, MapPin, Clock, FileText, Briefcase, Shuffle, Plus } from "lucide-react";

export const VARIABLE_GROUPS = [
  {
    id: "contact",
    label: "👤 Contact",
    icon: User,
    color: "text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100",
    variables: [
      { tag: "{{name}}", label: "Full Name", sample: "Rahul Sharma" },
      { tag: "{{first_name}}", label: "First Name", sample: "Rahul" },
      { tag: "{{company}}", label: "Company Name", sample: "Apex Logistics" },
      { tag: "{{phone}}", label: "Mobile Number", sample: "+91 98765 43210" },
      { tag: "{{email}}", label: "Email Address", sample: "rahul@example.com" },
    ],
  },
  {
    id: "location",
    label: "📍 Location",
    icon: MapPin,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
    variables: [
      { tag: "{{address}}", label: "Full Address", sample: "Plot 42, MIDC Ind. Area" },
      { tag: "{{city}}", label: "City", sample: "Mumbai" },
      { tag: "{{state}}", label: "State", sample: "Maharashtra" },
      { tag: "{{pincode}}", label: "Pincode", sample: "400001" },
    ],
  },
  {
    id: "time",
    label: "⏰ Time & Date",
    icon: Clock,
    color: "text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100",
    variables: [
      { tag: "{{tomorrow}}", label: "Tomorrow Date", sample: "Tomorrow's date (e.g. 10 Sep 2026)" },
      { tag: "{{tomorrow_day}}", label: "Tomorrow Day Name", sample: "Tomorrow's weekday (e.g. Thursday)" },
      { tag: "{{tomorrow_date}}", label: "Tomorrow Date (Alt)", sample: "10 Sep 2026" },
      { tag: "{{day}}", label: "Today's Day", sample: "Wednesday" },
      { tag: "{{day_name}}", label: "Day Name", sample: "Wednesday" },
      { tag: "{{date}}", label: "Today's Date", sample: "09 Sep 2026" },
      { tag: "{{time}}", label: "Current Time", sample: "11:58 AM" },
      { tag: "{{date_time}}", label: "Live Date & Time", sample: "09 Sep 2026, 11:58 AM" },
      { tag: "{{greeting_time}}", label: "Smart Greeting", sample: "Good morning / afternoon" },
    ],
  },
  {
    id: "billing",
    label: "🧾 Billing & Service",
    icon: FileText,
    color: "text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100",
    variables: [
      { tag: "{{service}}", label: "Service / Product", sample: "AC AMC Maintenance" },
      { tag: "{{invoice_no}}", label: "Invoice #", sample: "INV-2026-084" },
      { tag: "{{amount}}", label: "Due Amount", sample: "₹12,500" },
      { tag: "{{due_date}}", label: "Due Date", sample: "2026-08-30" },
      { tag: "{{agent_name}}", label: "Assigned Executive", sample: "Pooja Mehta" },
    ],
  },
  {
    id: "spintax",
    label: "🎲 Anti-Ban Spintax",
    icon: Shuffle,
    color: "text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100",
    variables: [
      { tag: "[Hi|Hello|Hey|Greetings]", label: "Greeting Spintax", sample: "Random unique greeting per message" },
      { tag: "[Thank you|Thanks|We appreciate you]", label: "Thanks Spintax", sample: "Random thank you" },
      { tag: "[Regards|Best regards|Warm wishes]", label: "Sign-off Spintax", sample: "Random sign-off" },
    ],
  },
];

/**
 * Universal evaluator for template tags and spintax for live previews across frontend.
 * Matches backend waAutomationService.js behavior exactly.
 */
export function evaluateMessagePlaceholders(text, overrides = {}) {
  if (!text) return "";
  const now = new Date();
  const istTz = "Asia/Kolkata";
  const dateOptions = { day: "2-digit", month: "short", year: "numeric", timeZone: istTz };
  const formattedDate = now.toLocaleDateString("en-IN", dateOptions);
  const formattedTime = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: istTz });
  const dayName = now.toLocaleDateString("en-IN", { weekday: "long", timeZone: istTz });

  const currentHour = now.getHours();
  const greetingTime = currentHour < 12 ? "Good morning" : currentHour < 17 ? "Good afternoon" : "Good evening";

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowFormatted = tomorrow.toLocaleDateString("en-IN", dateOptions);
  const tomorrowDayName = tomorrow.toLocaleDateString("en-IN", { weekday: "long", timeZone: istTz });

  const sampleValues = {
    name: "Rahul Sharma",
    full_name: "Rahul Sharma",
    first_name: "Rahul",
    company: "Apex Logistics",
    company_name: "Apex Logistics",
    phone: "+91 98765 43210",
    phone_number: "+91 98765 43210",
    email: "rahul@apexlogistics.com",
    address: "Plot 42, MIDC Industrial Area",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    service: "HVAC Maintenance AMC",
    service_name: "HVAC Maintenance AMC",
    invoice_no: "INV-2026-092",
    amount: "₹14,800",
    due_date: "2026-08-30",
    agent_name: "Pooja Mehta",
    technician: "Senior Engineer Suresh",

    // Time & Date
    greeting_time: greetingTime,
    greeting: greetingTime,
    greetings: greetingTime,
    time: formattedTime,
    current_time: formattedTime,
    live_time: formattedTime,
    now: formattedTime,
    date: formattedDate,
    current_date: formattedDate,
    today: formattedDate,
    today_date: formattedDate,
    day: dayName,
    day_name: dayName,
    today_day: dayName,
    current_day: dayName,
    datetime: `${formattedDate}, ${formattedTime}`,
    date_time: `${formattedDate}, ${formattedTime}`,

    // Tomorrow ("tommowe mean tomarrow date and day name and all ways")
    tomorrow: tomorrowFormatted,
    tomorrow_date: tomorrowFormatted,
    tommowe: tomorrowFormatted,
    tommowe_date: tomorrowFormatted,
    tomarrow: tomorrowFormatted,
    tomarrow_date: tomorrowFormatted,
    tomorow: tomorrowFormatted,
    tommorow: tomorrowFormatted,

    tomorrow_day: tomorrowDayName,
    tomorrow_day_name: tomorrowDayName,
    tommowe_day: tomorrowDayName,
    tomarrow_day: tomorrowDayName,
    tomorow_day: tomorrowDayName,

    tomorrow_datetime: `${tomorrowFormatted}, ${formattedTime}`,
    tomorrow_date_time: `${tomorrowFormatted}, ${formattedTime}`,

    ...overrides,
  };

  // 1. Resolve tokens (supporting {{tag}}, {tag}, %tag% and spaces/hyphens inside)
  const tokenRegex = /(?:\{\{|\{|\%)\s*([^{}%|]+?)\s*(?:\}\}|\}|\%)/g;
  let result = text.replace(tokenRegex, (match, rawToken) => {
    const rawLower = rawToken.trim().toLowerCase();
    const normalizedKey = rawLower.replace(/[\s\-\.]+/g, "_");
    if (sampleValues[rawLower] != null) return sampleValues[rawLower];
    if (sampleValues[normalizedKey] != null) return sampleValues[normalizedKey];
    return match;
  });

  // 2. Resolve square bracket spintax [Option 1|Option 2]
  result = result.replace(/\[([^\[\]]+)\]/g, (_, choices) => {
    if (!choices.includes("|")) return _;
    const arr = choices.split("|");
    return arr[Math.floor(Math.random() * arr.length)].trim();
  });

  // 3. Resolve curly bracket spintax {Option 1|Option 2}
  result = result.replace(/\{([^{}]+)\}/g, (_, choices) => {
    if (!choices.includes("|")) return `{${choices}}`;
    const arr = choices.split("|");
    return arr[Math.floor(Math.random() * arr.length)].trim();
  });

  return result;
}

export default function WAVariablePicker({ onInsert, className = "" }) {
  const [selectedGroup, setSelectedGroup] = useState("all");

  const handleSelect = (tag) => {
    if (onInsert) {
      onInsert(tag);
    }
  };

  const displayedGroups = selectedGroup === "all"
    ? VARIABLE_GROUPS
    : VARIABLE_GROUPS.filter((g) => g.id === selectedGroup);

  return (
    <div className={`p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 text-xs ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-1.5 font-bold text-gray-700">
          <Sparkles size={14} className="text-purple-600" />
          <span>Insert Dynamic Personalized Variables:</span>
        </div>

        {/* Group Filter Chips */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setSelectedGroup("all")}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${
              selectedGroup === "all"
                ? "bg-purple-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            All
          </button>
          {VARIABLE_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedGroup(g.id)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${
                selectedGroup === g.id
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Variables List */}
      <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1">
        {displayedGroups.flatMap((group) =>
          group.variables.map((v) => (
            <button
              key={v.tag}
              type="button"
              onClick={() => handleSelect(v.tag)}
              title={`${v.label} (Example: ${v.sample}) — Click to insert`}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs ${group.color}`}
            >
              <Plus size={11} className="opacity-70" />
              <span className="font-mono font-bold">{v.tag}</span>
              <span className="text-[10px] opacity-75 font-sans">({v.label})</span>
            </button>
          ))
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-slate-200/60">
        <span>💡 Click any variable above to insert it at your cursor.</span>
        <span>Supports both <code>{"{{variable}}"}</code> and <code>{"{variable}"}</code>.</span>
      </div>
    </div>
  );
}
