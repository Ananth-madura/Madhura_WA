import React from "react";
import { Bot, Plus, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useBranch } from "../../context/BranchContext";

export default function BranchFlows() {
  const { activeBranch } = useBranch();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Bot size={22} className="text-emerald-400" />
            Branch Chatbots & Interactive Flows
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Meta WhatsApp interactive menu and chatbot flows responding to {activeBranch?.name} inbounds.
          </p>
        </div>

        <Link
          to="/whatsapp/flows"
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all"
        >
          <Plus size={14} />
          <span>Design New Flow</span>
        </Link>
      </div>

      <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
        <Bot size={36} className="mx-auto text-slate-600 mb-2" />
        <h4 className="text-sm font-semibold text-slate-200">Interactive Flows Active</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Flows can be assigned to dedicated branch senders or shared menus to route customer requests.
        </p>
        <div className="mt-4">
          <Link
            to="/whatsapp/flows"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
          >
            <span>Open Global Flow Builder</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
