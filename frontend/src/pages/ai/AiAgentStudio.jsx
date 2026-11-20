import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Bot,
  Brain,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Play,
  Sliders,
  Settings,
  ArrowRight,
  Database,
  Cpu,
  Lock,
  MessageSquare
} from "lucide-react";

const AGENT_PRESETS = [
  {
    id: "agent_sales",
    name: "Autonomous Inbound Sales Copilot",
    role: "Sales & Inquiries",
    model: "Google Gemini 2.0 Flash",
    status: "ACTIVE",
    knowledgeSources: 3,
    conversationsHandled: 840,
    handoffRate: "12%",
    description: "Qualifies incoming customer leads, answers product questions, and schedules sales callbacks."
  },
  {
    id: "agent_support",
    name: "Customer Support Tier 1 Resolver",
    role: "Support & Troubleshooting",
    model: "OpenAI GPT-4o Mini",
    status: "ACTIVE",
    knowledgeSources: 8,
    conversationsHandled: 1250,
    handoffRate: "18%",
    description: "Answers order status queries, returns policies, and FAQs before transferring to human agents."
  },
  {
    id: "agent_booking",
    name: "Appointment & Service Booking Agent",
    role: "Scheduling & Booking",
    model: "Groq (Llama 3.3 70B)",
    status: "STANDBY",
    knowledgeSources: 2,
    conversationsHandled: 310,
    handoffRate: "8%",
    description: "Books doctor or service appointments with slot conflict checks and automated reminders."
  }
];

export default function AiAgentStudio() {
  const [agents, setAgents] = useState(AGENT_PRESETS);
  const [selectedAgent, setSelectedAgent] = useState(AGENT_PRESETS[0]);
  const [testInput, setTestInput] = useState("");
  const [testChat, setTestChat] = useState([
    { role: "assistant", text: "Hello! I am your AI sales assistant for Madhura. How can I help you today?" }
  ]);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleSendTestMessage = (e) => {
    e.preventDefault();
    const clean = testInput.trim();
    if (!clean) return;

    const userMsg = { role: "user", text: clean };
    setTestChat((prev) => [...prev, userMsg]);
    setTestInput("");
    setIsSimulating(true);

    setTimeout(() => {
      setTestChat((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Thank you for asking about "${clean}". Based on our product knowledge base, our enterprise WhatsApp plan supports unlimited broadcast campaigns and direct Meta Cloud API throughput.`
        }
      ]);
      setIsSimulating(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Strip */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Autonomous AI Workforce</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                AI Agents &amp; Knowledge Copilots
              </h1>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Configure autonomous AI agents for sales qualification, appointment booking, and customer support with knowledge base grounding and human handover rules.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/whatsapp/flows"
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-sm"
              >
                Chatbot Flowbots
              </Link>
              <Link
                to="/whatsapp/inbox"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
              >
                Team Inbox
              </Link>
            </div>
          </div>
        </div>

        {/* Main Grid: Agent Selector + Live Test Playground */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Configured AI Agents */}
          <div className="lg:col-span-6 space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Configured Enterprise Agents
            </h2>

            <div className="space-y-3">
              {agents.map((ag) => {
                const isSelected = selectedAgent.id === ag.id;
                return (
                  <div
                    key={ag.id}
                    onClick={() => setSelectedAgent(ag)}
                    className={`p-5 rounded-2xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? "border-emerald-600 bg-white shadow-sm ring-2 ring-emerald-600/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                          <Bot className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{ag.name}</h3>
                          <span className="text-[11px] text-slate-500 font-medium">{ag.role}</span>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {ag.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                      {ag.description}
                    </p>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                      <div>
                        <span className="block font-medium">Model</span>
                        <span className="font-bold text-slate-800">{ag.model}</span>
                      </div>
                      <div>
                        <span className="block font-medium">Grounding Docs</span>
                        <span className="font-bold text-slate-800">{ag.knowledgeSources} sources</span>
                      </div>
                      <div>
                        <span className="block font-medium">Handoff</span>
                        <span className="font-bold text-emerald-700">{ag.handoffRate}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Interactive Test Console */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-900">
                    Live Evaluation Playground: {selectedAgent.name}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">Sandbox Environment</span>
              </div>

              {/* Chat Simulation Window */}
              <div className="space-y-3 min-h-[260px] max-h-[340px] overflow-y-auto p-3 bg-slate-50 rounded-2xl border border-slate-200/60 mb-4">
                {testChat.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                        m.role === "user"
                          ? "bg-emerald-700 text-white rounded-br-none"
                          : "bg-white text-slate-900 border border-slate-200 shadow-sm rounded-bl-none"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {isSimulating && (
                  <div className="flex justify-start">
                    <div className="bg-white p-2.5 rounded-2xl text-xs text-slate-400 border border-slate-200 italic animate-pulse">
                      Generating grounded AI response...
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendTestMessage} className="flex gap-2">
              <input
                type="text"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Ask a question or test qualification..."
                className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              <button
                type="submit"
                disabled={isSimulating || !testInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
