import React from "react";
import { X, CreditCard, Loader2 } from "lucide-react";

export default function WAAccountBalanceModal({ isOpen, onClose, balance, loading }) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="hl-card w-full max-w-md p-4 sm:p-6 relative max-h-[92dvh] overflow-y-auto wa-custom-scrollbar overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-5 border-b border-[var(--color-rule)] pb-3">
          <div className="p-3 rounded-xl bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)]">
            <CreditCard size={24} />
          </div>
          <div>
            <h3 className="hl-title">WhatsApp Engine & Quota Balance</h3>
            <p className="text-xs text-[var(--color-ink-2)]">Live messaging analytics and connection status</p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <Loader2 size={32} className="animate-spin text-[var(--color-ink)] mx-auto mb-3" />
            <p className="text-sm font-semibold text-[var(--color-ink-2)]">Checking account quota balance...</p>
          </div>
        ) : balance?.error ? (
          <div className="hl-card p-4 bg-[var(--color-error)] text-[var(--color-error)] rounded-xl text-xs font-semibold">
            {balance.error}
          </div>
        ) : balance ? (
          <div className="space-y-4">
            <div className="hl-card bg-[var(--color-paper-2)] p-4 rounded-xl space-y-2 border border-[var(--color-rule)]">
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--color-ink-2)] font-medium">Connection Status:</span>
                <span
                  className={`hl-badge font-bold px-2.5 py-0.5 text-xs flex items-center gap-1 ${
                    balance.connected ? "hl-badge-success" : "hl-badge-error"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      balance.connected ? "bg-[var(--color-success)] animate-pulse" : "bg-[var(--color-error)]"
                    }`}
                  ></span>
                  {balance.connected ? "Connected & Active" : "Disconnected"}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--color-ink-2)] font-medium">Active Engine:</span>
                <span className="hl-badge hl-badge-info px-2 py-0.5 rounded text-xs">
                  {balance.activeEngine || "Standard"}
                </span>
              </div>
              {balance.phone && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--color-ink-2)] font-medium">Sender Number:</span>
                  <span className="hl-id">+{balance.phone}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="hl-card bg-[var(--color-paper)] border border-[var(--color-rule)] p-3 rounded-xl">
                <p className="hl-section-label text-[10px] font-bold uppercase text-[var(--color-ink)]">Messages Today</p>
                <p className="hl-kpi-num mt-1">{balance.todaySent?.toLocaleString() ?? 0}</p>
              </div>
              <div className="hl-card bg-[var(--color-paper)] border border-[var(--color-rule)] p-3 rounded-xl">
                <p className="hl-section-label text-[10px] font-bold uppercase text-[var(--color-ink)]">Total Outbound</p>
                <p className="hl-kpi-num mt-1">{balance.totalSent?.toLocaleString() ?? 0}</p>
              </div>
              <div className="hl-card bg-[var(--color-paper)] border border-[var(--color-rule)] p-3 rounded-xl">
                <p className="hl-section-label text-[10px] font-bold uppercase text-[var(--color-ink)]">Delivered</p>
                <p className="hl-kpi-num mt-1">{balance.totalDelivered?.toLocaleString() ?? 0}</p>
              </div>
              <div className="hl-card bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-3 rounded-xl">
                <p className="hl-section-label text-[10px] font-bold uppercase text-[var(--color-ink-2)]">Failed / Bounced</p>
                <p className="hl-kpi-num mt-1">{balance.totalFailed?.toLocaleString() ?? 0}</p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={onClose}
                className="hl-btn-primary px-5 py-2 bg-[var(--color-ink)] text-[var(--color-paper-2)] rounded-lg text-xs font-bold hover:bg-[var(--color-ink)] transition shadow"
              >
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
