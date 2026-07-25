import { AlertTriangle } from "lucide-react";

interface Props {
  /** When false, Supabase was unreachable and numbers may be uncorrected. */
  overridesApplied: boolean;
}

/**
 * Shown when the backend fell back to raw sheet data because Supabase was
 * temporarily unreachable. Numbers displayed may not reflect faculty decisions.
 */
export function OverridesWarningBanner({ overridesApplied }: Props) {
  if (overridesApplied) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500 dark:text-amber-400" />
      <p className="leading-relaxed">
        <span className="font-semibold">Review data temporarily unavailable</span> — the review
        database could not be reached. Credits and approval status shown below are{" "}
        <span className="font-semibold">uncorrected sheet values</span> and do not reflect any
        faculty decisions. Refresh the page to try again.
      </p>
    </div>
  );
}
