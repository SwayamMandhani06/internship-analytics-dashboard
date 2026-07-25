import { useState } from "react";
import api from "../lib/api";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

interface BulkActionsBarProps {
  batchId: string;
  division?: string;
  visibleEntryCount: number;
  onComplete: () => void;
}

export function BulkActionsBar({
  batchId,
  division,
  visibleEntryCount,
  onComplete,
}: BulkActionsBarProps) {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleBulkAction = async (decision: "approved" | "declined") => {
    const actionLabel = decision === "approved" ? "approve" : "decline";
    const confirmed = window.confirm(
      `This will ${actionLabel} ${visibleEntryCount} visible entries for batch ${batchId}${
        division ? ` (Division ${division})` : ""
      }.\n\nAre you sure you want to continue?`
    );

    if (!confirmed) return;

    setSubmitting(true);
    setError(null);

    const facultyName = localStorage.getItem("faculty_name") || "Faculty Admin";

    try {
      await api.post("/api/reviews/bulk", {
        batchId,
        division: division || undefined,
        filter: "needsReview",
        action: { decision },
        reviewedBy: facultyName,
      });

      onComplete();
    } catch (err: any) {
      console.error("[BulkActionsBar] Error performing bulk action:", err);
      const msg = err.response?.data?.error || err.message || "Failed to perform bulk review";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50/80 px-4 py-2.5 text-xs text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200">
      <div className="flex items-center gap-2 font-medium">
        <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        <span>
          Bulk Faculty Actions &mdash; <strong>{visibleEntryCount}</strong> entry/entries needing review in current view
        </span>
      </div>

      <div className="flex items-center gap-2">
        {error && <span className="font-semibold text-red-600 mr-2">{error}</span>}

        <button
          type="button"
          disabled={submitting || visibleEntryCount === 0}
          onClick={() => handleBulkAction("approved")}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Approve All Visible
        </button>

        <button
          type="button"
          disabled={submitting || visibleEntryCount === 0}
          onClick={() => handleBulkAction("declined")}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          <XCircle className="h-3.5 w-3.5" /> Decline All Visible
        </button>
      </div>
    </div>
  );
}
