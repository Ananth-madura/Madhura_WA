import React from "react";
import { Sparkles, Bot, Shield, CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useBranch } from "../../context/BranchContext";

export default function BranchAiAgents() {
  const { activeBranch } = useBranch();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Sparkles size={22} className="text-emerald-400" />
            Branch AI Copilot & Knowledge Policies
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Autonomous AI assistant guidelines and copilot response suggestions customized for {activeBranch?.name}.
          </p>
        </div>

        <Link
          to="/whatsapp/ai"
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all"
        >
          <Sparkles size={14} />
          <span>Configure AI Models</span>
        </Link>
      </div>

      <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
        <Sparkles size={36} className="mx-auto text-emerald-400 mb-2" />
        <h4 className="text-sm font-semibold text-slate-200">Local Knowledge Grounding Active</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          AI Copilot assists agents in {activeBranch?.name} with store hours, local catalog answers, and instant response suggestions.
        </p>
        <div className="mt-4">
          <Link
            to="/whatsapp/ai"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
          >
            <span>Open Global AI Agent Studio</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
