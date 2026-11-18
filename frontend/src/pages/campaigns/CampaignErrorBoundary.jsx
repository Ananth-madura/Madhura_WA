import React from "react";
import { Link } from "react-router-dom";

export default class CampaignErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Unexpected rendering error in Campaign workspace.",
    };
  }

  componentDidCatch(error) {
    console.error("[CampaignErrorBoundary]", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="max-w-2xl mx-auto my-12 p-6 bg-white rounded-xl border border-rose-200 shadow-sm space-y-3" role="alert">
        <h2 className="text-lg font-bold text-slate-900">Campaign page encountered an error</h2>
        <p className="text-sm text-rose-700 bg-rose-50 p-3 rounded-lg border border-rose-100 font-mono text-xs">
          {this.state.errorMessage}
        </p>
        <p className="text-xs text-slate-600">
          Make sure the backend server has been restarted with the latest Enterprise Campaign routes, then retry.
        </p>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, errorMessage: "" })}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
          >
            Retry View
          </button>
          <Link
            to="/dashboard/campaigns"
            onClick={() => this.setState({ hasError: false, errorMessage: "" })}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold"
          >
            Back to Command Center
          </Link>
        </div>
      </div>
    );
  }
}
