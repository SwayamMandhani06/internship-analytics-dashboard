import React, { useState, useEffect, useMemo, Fragment } from "react";
import api from "../lib/api";
import {
  AlertTriangle,
  RotateCw,
  Building2,
  Calendar,
  Filter,
  GitMerge,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { DataTable, type Column } from "../components/DataTable";
import { OverridesWarningBanner } from "../components/OverridesWarningBanner";
import { ReviewPanel } from "../components/ReviewPanel";
import { useFilter, DIVISIONS } from "../context/FilterContext";

export interface ReviewOverrideInfo {
  decision: "approved" | "declined" | "pending" | null;
  classification: "company" | "certification" | null;
  mergeDecision: "confirm_merge" | "reject_merge" | null;
  overrideCredits: number | null;
  reviewedBy: string | null;
  note: string | null;
  reviewedAt: string | null;
}

export interface EnrichedInternship {
  semesterLabel: string;
  company: string;
  startDateRaw: string;
  endDateRaw: string;
  startDate: string | null;
  endDate: string | null;
  durationRaw: string;
  durationMonths: number | null;
  isCertificationStyle: boolean;
  classification: "company" | "certification";
  status: string;
  creditsCalculated: number | null;
  needsReview: boolean;
  reviewReasons: string[];
  reviewOverride: ReviewOverrideInfo | null;
  possibleSplitInternship: boolean;
  splitMergeRole: "primary" | "sibling" | null;
  splitSiblingLabel: string | null;
  splitOriginalCredits: number | null;
}

export interface EnrichedStudent {
  prn: string;
  name: string;
  division: string;
  internships: EnrichedInternship[];
  totalCreditsCalculated: number;
  sheetReportedTotalCredits: string;
  sheetReportedRemainingCredits: string;
}

export interface StudentsApiResponse {
  overridesApplied: boolean;
  count: number;
  totalInternshipEntries: number;
  needsReviewCount: number;
  needsReviewSummary: any[];
  data: EnrichedStudent[];
}

export interface StudentTableRow extends EnrichedStudent, Record<string, unknown> {
  internshipCount: number;
  reviewCount: number;
}

const SEMESTERS = [
  "FY Sem I",
  "FY Sem II",
  "SY Sem III",
  "SY Sem IV",
  "TY Sem V",
  "TY Sem VI",
  "B.Tech Sem VII",
];

function formatDateDisplay(isoDate: string | null, rawDate: string): string {
  if (isoDate) {
    try {
      const d = new Date(isoDate);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      }
    } catch {
      // fallback
    }
  }
  return rawDate || "\u2014";
}

function renderStatusBadge(internship: EnrichedInternship) {
  const { status, needsReview, reviewReasons } = internship;

  if (needsReview || status === "Needs Review" || status === "Unknown") {
    const tooltipText =
      reviewReasons.length > 0
        ? `Needs Review: ${reviewReasons.join(", ")}`
        : "Entry requires manual review";
    return (
      <span
        title={tooltipText}
        className="inline-flex cursor-help items-center rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300"
      >
        Needs Review
      </span>
    );
  }

  if (status === "Completed") {
    return (
      <span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
        Completed
      </span>
    );
  }

  if (status === "Ongoing") {
    return (
      <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
        Ongoing
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {status || "Not Started"}
    </span>
  );
}

function renderCreditsCell(internship: EnrichedInternship) {
  if (internship.creditsCalculated !== null && !internship.isCertificationStyle) {
    return (
      <span className="tabular-nums font-semibold text-slate-900 dark:text-slate-100">
        {internship.creditsCalculated}
      </span>
    );
  }

  const tooltipText = internship.isCertificationStyle
    ? "Certification-style hours course \u2014 requires manual review (not month-based)"
    : internship.reviewReasons.includes("unparseable_duration")
    ? "Unparseable duration format \u2014 credits cannot be automatically calculated"
    : "Requires manual credit verification";

  return (
    <span
      title={tooltipText}
      className="cursor-help font-semibold text-slate-400 dark:text-slate-500"
    >
      \u2014
    </span>
  );
}

export function StudentsPage() {
  const { selectedBatch, selectedDivision, setSelectedDivision } = useFilter();
  const [students, setStudents] = useState<EnrichedStudent[]>([]);
  const [overridesApplied, setOverridesApplied] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Local filter states
  const [companyFilter, setCompanyFilter] = useState<string>("");
  const [semesterFilter, setSemesterFilter] = useState<string>("");
  const [reviewOnlyFilter, setReviewOnlyFilter] = useState<string>("ALL"); // "ALL" | "REVIEW"
  const [activeReviewKey, setActiveReviewKey] = useState<string | null>(null);

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { batch: selectedBatch };
      if (selectedDivision) {
        params.division = selectedDivision;
      }
      const res = await api.get<StudentsApiResponse>("/api/students", { params });
      setStudents(res.data.data);
      setOverridesApplied(res.data.overridesApplied);
    } catch (err: any) {
      console.error("[StudentsPage] Error fetching students:", err);
      const msg =
        err.response?.data?.error || err.message || "Failed to load student directory";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [selectedBatch, selectedDivision]);

  // Extract unique company list across all students for dropdown
  const uniqueCompanies = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      s.internships.forEach((i) => {
        if (i.company && i.company.trim()) {
          set.add(i.company.trim());
        }
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [students]);

  // Filter students based on local dropdowns (company, semester, review status)
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Company filter
      if (companyFilter) {
        const hasCompany = s.internships.some(
          (i) => i.company && i.company.trim() === companyFilter
        );
        if (!hasCompany) return false;
      }

      // Semester filter
      if (semesterFilter) {
        const hasSem = s.internships.some(
          (i) => i.semesterLabel === semesterFilter
        );
        if (!hasSem) return false;
      }

      // Review filter
      if (reviewOnlyFilter === "REVIEW") {
        const hasReview = s.internships.some((i) => i.needsReview);
        if (!hasReview) return false;
      }

      return true;
    });
  }, [students, companyFilter, semesterFilter, reviewOnlyFilter]);

  // Map to table rows with pre-calculated counts
  const tableData: StudentTableRow[] = useMemo(() => {
    return filteredStudents.map((s) => ({
      ...s,
      internshipCount: s.internships.length,
      reviewCount: s.internships.filter((i) => i.needsReview).length,
    }));
  }, [filteredStudents]);

  const columns: Column<StudentTableRow>[] = [
    {
      key: "name",
      label: "Student Name",
      sortable: true,
      render: (row) => (
        <div className="font-semibold text-slate-900 dark:text-slate-100">
          {row.name}
        </div>
      ),
    },
    {
      key: "prn",
      label: "PRN",
      sortable: true,
      render: (row) => (
        <span className="tabular-nums font-mono text-xs text-slate-600 dark:text-slate-400">
          {row.prn}
        </span>
      ),
    },
    {
      key: "division",
      label: "Division",
      sortable: true,
      render: (row) => (
        <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {row.division}
        </span>
      ),
    },
    {
      key: "internshipCount",
      label: "Internships",
      sortable: true,
      render: (row) => (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {row.internshipCount}
        </span>
      ),
    },
    {
      key: "totalCreditsCalculated",
      label: "Total Credits",
      sortable: true,
      render: (row) => (
        <span className="tabular-nums text-base font-bold text-slate-900 dark:text-slate-100">
          {row.totalCreditsCalculated}
        </span>
      ),
    },
    {
      key: "reviewCount",
      label: "Data Quality",
      sortable: true,
      render: (row) => {
        if (row.reviewCount === 0) return null; // Hidden entirely if 0
        return (
          <span
            title={`${row.reviewCount} entry/entries flagged for manual review`}
            className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          >
            {row.reviewCount} review
          </span>
        );
      },
    },
  ];

  // Render expanded row containing nested sub-table
  const renderExpandedRow = (row: StudentTableRow) => {
    if (!row.internships || row.internships.length === 0) {
      return (
        <div className="py-3 text-center text-xs italic text-slate-500 dark:text-slate-400">
          No internship entries recorded for this student.
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Internship Entries ({row.internships.length})
          </h4>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Sheet Reported Credits: {row.sheetReportedTotalCredits || "0"}
          </span>
        </div>

        <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
                <th className="px-3 py-2 font-medium">Semester</th>
                <th className="px-3 py-2 font-medium">Company / Internship Name</th>
                <th className="px-3 py-2 font-medium">Duration</th>
                <th className="px-3 py-2 font-medium">Start Date</th>
                <th className="px-3 py-2 font-medium">End Date</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Credits</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {row.internships.map((item, idx) => {
                const reviewKey = `${row.prn}-${item.semesterLabel}`;
                const isReviewOpen = activeReviewKey === reviewKey;

                return (
                  <React.Fragment key={idx}>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                        {item.semesterLabel}
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-900 dark:text-slate-100">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{item.company || "\u2014"}</span>
                          {item.possibleSplitInternship && (
                            <span
                              title={`Cross-semester split internship \u2014 merged with ${item.splitSiblingLabel || "adjacent semester"}`}
                              className="inline-flex cursor-help items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                            >
                              <GitMerge className="h-3 w-3" />
                              <span>Merged</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-300">
                        {item.durationMonths !== null
                          ? `${item.durationMonths} Mo${item.durationMonths === 1 ? "" : "s"}`
                          : item.durationRaw || "\u2014"}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-400">
                        {formatDateDisplay(item.startDate, item.startDateRaw)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-400">
                        {formatDateDisplay(item.endDate, item.endDateRaw)}
                      </td>
                      <td className="px-3 py-2">{renderStatusBadge(item)}</td>
                      <td className="px-3 py-2">{renderCreditsCell(item)}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setActiveReviewKey(isReviewOpen ? null : reviewKey)}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <span>
                            {item.reviewOverride?.decision
                              ? `Reviewed (${item.reviewOverride.decision})`
                              : item.needsReview
                              ? "Review Flag"
                              : "Review"}
                          </span>
                          {isReviewOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      </td>
                    </tr>
                    {isReviewOpen && (
                      <tr>
                        <td colSpan={8} className="p-2.5 bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                          <ReviewPanel
                            batchId={selectedBatch}
                            division={row.division}
                            prn={row.prn}
                            internship={item}
                            onReviewComplete={fetchStudents}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Custom filter controls rendered in DataTable header
  const filterControls = (
    <div className="flex flex-wrap items-center gap-2">
      {/* Company filter */}
      <div className="flex items-center gap-1">
        <Building2 className="h-3.5 w-3.5 text-slate-400" />
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-default focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          <option value="">All Companies ({uniqueCompanies.length})</option>
          {uniqueCompanies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Semester filter */}
      <div className="flex items-center gap-1">
        <Calendar className="h-3.5 w-3.5 text-slate-400" />
        <select
          value={semesterFilter}
          onChange={(e) => setSemesterFilter(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-default focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          <option value="">All Semesters</option>
          {SEMESTERS.map((sem) => (
            <option key={sem} value={sem}>
              {sem}
            </option>
          ))}
        </select>
      </div>

      {/* Review filter */}
      <div className="flex items-center gap-1">
        <select
          value={reviewOnlyFilter}
          onChange={(e) => setReviewOnlyFilter(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-default focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          <option value="ALL">All Records</option>
          <option value="REVIEW">Flagged for Review</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Student Directory
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Dense, wide-format student directory with multi-internship breakdown per student.
          </p>
        </div>

        {/* Division Filter Dropdown in Header */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <label
            htmlFor="student-division-select"
            className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            <Filter className="h-3.5 w-3.5" />
            Division:
          </label>
          <select
            id="student-division-select"
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-default focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <option value="">All Divisions</option>
            {DIVISIONS.map((div) => (
              <option key={div} value={div}>
                {div}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
            <button
              onClick={fetchStudents}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800"
            >
              <RotateCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        </div>
      )}

      {/* Supabase override unavailability banner */}
      <OverridesWarningBanner overridesApplied={overridesApplied} />

      {/* Loading state */}
      {loading ? (
        <div className="space-y-4">
          <div className="h-16 animate-pulse rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50" />
          <div className="h-96 animate-pulse rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={tableData}
          searchable={true}
          searchPlaceholder="Search student name or PRN..."
          pageSize={20}
          renderExpandedRow={renderExpandedRow}
          getRowKey={(row) => row.prn}
          extraHeaderControls={filterControls}
          initialSortKey="totalCreditsCalculated"
          initialSortDir="desc"
          filterPredicate={(row, query) =>
            row.name.toLowerCase().includes(query) ||
            row.prn.toLowerCase().includes(query)
          }
        />
      )}
    </div>
  );
}
