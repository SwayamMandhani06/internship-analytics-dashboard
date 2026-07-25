import { useState } from "react";
import api from "../lib/api";
import {
  CheckCircle,
  XCircle,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  GitMerge,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { EnrichedInternship } from "../pages/StudentsPage";

interface ReviewPanelProps {
  batchId: string;
  division: string;
  prn: string;
  internship: EnrichedInternship;
  onReviewComplete: () => void;
  /** Optional inline mode flag (default true) */
  compact?: boolean;
}

const REASON_LABELS: Record<string, string> = {
  unparseable_duration: "Unparseable Duration",
  unparseable_start_date: "Unparseable Start Date",
  unparseable_end_date: "Unparseable End Date",
  certification_style: "Certification-Style (Hours)",
  possible_duplicate_split: "Possible Duplicate Split Internship",
  split_sibling: "Split Internship Sibling Slot",
};

export function ReviewPanel({
  batchId,
  division,
  prn,
  internship,
  onReviewComplete,
}: ReviewPanelProps) {
  const existingOverride = internship.reviewOverride;
  const currentDecision = existingOverride?.decision ?? null;

  // Form states
  const [decision, setDecision] = useState<"approved" | "declined" | null>(
    currentDecision === "approved" || currentDecision === "declined" ? currentDecision : "approved"
  );
  const [classification, setClassification] = useState<"company" | "certification">(
    existingOverride?.classification ?? internship.classification ?? "company"
  );
  const [mergeDecision, setMergeDecision] = useState<"confirm_merge" | "reject_merge">(
    existingOverride?.mergeDecision === "reject_merge" ? "reject_merge" : "confirm_merge"
  );
  const [overrideCredits, setOverrideCredits] = useState<string>(
    existingOverride?.overrideCredits !== null && existingOverride?.overrideCredits !== undefined
      ? String(existingOverride.overrideCredits)
      : ""
  );
  const [reviewedBy, setReviewedBy] = useState<string>(
    existingOverride?.reviewedBy ?? localStorage.getItem("faculty_name") ?? ""
  );
  const [note, setNote] = useState<string>(existingOverride?.note ?? "");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (targetDecision?: "approved" | "declined") => {
    const finalDecision = targetDecision ?? decision;
    if (!finalDecision) {
      setError("Please select Approved or Declined.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (reviewedBy.trim()) {
        localStorage.setItem("faculty_name", reviewedBy.trim());
      }

      await api.post("/api/reviews", {
        batchId,
        division,
        prn,
        semesterLabel: internship.semesterLabel,
        siblingSemesterLabel: internship.splitSiblingLabel ?? null,
        internshipNameSnapshot: internship.company || "Unnamed Internship",
        decision: finalDecision,
        classification,
        mergeDecision: internship.possibleSplitInternship ? mergeDecision : null,
        overrideCredits: overrideCredits !== "" ? Number(overrideCredits) : null,
        reviewedBy: reviewedBy.trim() || null,
        note: note.trim() || null,
      });

      onReviewComplete();
    } catch (err: any) {
      console.error("[ReviewPanel] Error saving review:", err);
      const msg = err.response?.data?.error || err.message || "Failed to save review";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPending = async () => {
    if (!confirm(`Reset review decision for ${internship.semesterLabel} back to pending?`)) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const semEncoded = encodeURIComponent(internship.semesterLabel);
      await api.delete(`/api/reviews/${batchId}/${division}/${prn}/${semEncoded}`);
      onReviewComplete();
    } catch (err: any) {
      console.error("[ReviewPanel] Error resetting review:", err);
      const msg = err.response?.data?.error || err.message || "Failed to reset review";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const formattedReviewedAt = existingOverride?.reviewedAt
    ? new Date(existingOverride.reviewedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
      {/* Existing Decision Status Banner if already reviewed */}
      {currentDecision && currentDecision !== "pending" && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2">
            {currentDecision === "approved" ? (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle className="h-3.5 w-3.5" /> Approved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                <XCircle className="h-3.5 w-3.5" /> Declined
              </span>
            )}
            <span className="text-slate-600 dark:text-slate-400">
              Reviewed by{" "}
              <strong className="font-semibold text-slate-800 dark:text-slate-200">
                {existingOverride?.reviewedBy || "Faculty"}
              </strong>
              {formattedReviewedAt ? ` on ${formattedReviewedAt}` : ""}
            </span>
            {existingOverride?.note && (
              <span className="italic text-slate-500">"{existingOverride.note}"</span>
            )}
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={handleResetPending}
            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <RotateCcw className="h-3 w-3" /> Reset to Pending
          </button>
        </div>
      )}

      {/* Review Information & Diagnostics */}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Raw Sheet Values */}
        <div className="rounded border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-950">
          <p className="mb-1.5 font-semibold text-slate-700 dark:text-slate-300">
            Sheet Input Data
          </p>
          <div className="space-y-1 text-slate-600 dark:text-slate-400">
            <div>
              <span className="text-slate-400">Company:</span>{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {internship.company || "(Empty)"}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Raw Duration:</span>{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {internship.durationRaw || "(Empty)"}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Raw Start/End:</span>{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {internship.startDateRaw || "\u2014"} / {internship.endDateRaw || "\u2014"}
              </span>
            </div>
          </div>
        </div>

        {/* Diagnostic Flag Reasons */}
        <div className="rounded border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-950">
          <p className="mb-1.5 font-semibold text-slate-700 dark:text-slate-300">
            Flag Reasons & Auto-Calculation
          </p>
          {internship.reviewReasons.length > 0 ? (
            <div className="flex flex-wrap gap-1 mb-2">
              {internship.reviewReasons.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300"
                >
                  <AlertCircle className="h-3 w-3" />
                  {REASON_LABELS[r] || r}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 italic mb-2">No data flags detected</p>
          )}

          <div className="text-slate-600 dark:text-slate-400">
            <div>
              <span className="text-slate-400">Auto Calculated Credits:</span>{" "}
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {internship.creditsCalculated !== null ? `${internship.creditsCalculated} Cr` : "Null (Needs Review)"}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Classification:</span>{" "}
              <span className="capitalize font-medium text-slate-800 dark:text-slate-200">
                {internship.classification}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Controls */}
      <div className="space-y-3 rounded border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
        <p className="font-semibold text-slate-800 dark:text-slate-200">
          Faculty Decision & Overrides
        </p>

        {/* 1. Decision Buttons */}
        <div className="flex items-center gap-3">
          <span className="font-medium text-slate-600 dark:text-slate-400">Decision:</span>
          <button
            type="button"
            onClick={() => {
              setDecision("approved");
              handleSubmit("approved");
            }}
            disabled={submitting}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
              decision === "approved"
                ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300"
            }`}
          >
            <CheckCircle className="h-3.5 w-3.5" /> Approve Entry
          </button>
          <button
            type="button"
            onClick={() => {
              setDecision("declined");
              handleSubmit("declined");
            }}
            disabled={submitting}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
              decision === "declined"
                ? "bg-red-600 text-white shadow-sm hover:bg-red-700"
                : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 dark:bg-red-950/50 dark:border-red-800 dark:text-red-300"
            }`}
          >
            <XCircle className="h-3.5 w-3.5" /> Decline Entry
          </button>
        </div>

        {/* 2. Reclassify Control */}
        <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="font-medium text-slate-600 dark:text-slate-400">Reclassify:</span>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={`classification-${prn}-${internship.semesterLabel}`}
              value="company"
              checked={classification === "company"}
              onChange={() => setClassification("company")}
              className="text-primary-600 focus:ring-primary-500"
            />
            <span className="text-slate-700 dark:text-slate-300 font-medium">Employer Internship</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={`classification-${prn}-${internship.semesterLabel}`}
              value="certification"
              checked={classification === "certification"}
              onChange={() => setClassification("certification")}
              className="text-primary-600 focus:ring-primary-500"
            />
            <span className="text-slate-700 dark:text-slate-300 font-medium">Course / Certification</span>
          </label>
        </div>

        {/* 3. Split Internship Control (if applicable) */}
        {internship.possibleSplitInternship && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold">
              <GitMerge className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Cross-Semester Split Handling ({internship.semesterLabel} + {internship.splitSiblingLabel})</span>
            </div>
            <div className="flex flex-col gap-1.5 pl-5">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`merge-${prn}-${internship.semesterLabel}`}
                  value="confirm_merge"
                  checked={mergeDecision === "confirm_merge"}
                  onChange={() => setMergeDecision("confirm_merge")}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 dark:text-slate-300">
                  Confirm as <strong>single continuous internship</strong> (credits calculated once)
                </span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`merge-${prn}-${internship.semesterLabel}`}
                  value="reject_merge"
                  checked={mergeDecision === "reject_merge"}
                  onChange={() => setMergeDecision("reject_merge")}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 dark:text-slate-300">
                  Reject merge — treat as <strong>two separate internships</strong> (credit each independently)
                </span>
              </label>
            </div>
          </div>
        )}

        {/* 4. Optional Fields (Note, Custom Credits, Faculty Name) */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">
              Custom Credits (Optional)
            </label>
            <input
              type="number"
              min="0"
              max="20"
              placeholder="Auto"
              value={overrideCredits}
              onChange={(e) => setOverrideCredits(e.target.value)}
              className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">
              Reviewed By
            </label>
            <input
              type="text"
              placeholder="Faculty Name"
              value={reviewedBy}
              onChange={(e) => setReviewedBy(e.target.value)}
              className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">
              Review Note / Reason
            </label>
            <input
              type="text"
              placeholder="e.g. Verified with offer letter"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
        </div>

        {/* Error message if any */}
        {error && (
          <p className="text-xs text-red-600 font-medium">{error}</p>
        )}

        {/* Submit Button for custom settings */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit()}
            className="inline-flex items-center gap-1 rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {submitting ? "Saving..." : "Save Custom Decision"}
          </button>
        </div>
      </div>
    </div>
  );
}
