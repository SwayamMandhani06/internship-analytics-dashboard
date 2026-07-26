import { useState, useEffect } from "react";
import axios from "axios";
import {
  Users,
  UserCheck,
  UserX,
  Building2,
  Award,
  BarChart2,
  Briefcase,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RotateCw,
  Filter,
} from "lucide-react";
import { KPICard } from "../components/KPICard";
import { useFilter, DIVISIONS } from "../context/FilterContext";

export interface OverviewResponse {
  totalStudents: number;
  studentsWithAtLeastOneInternship: number;
  studentsWithNoInternship: number;
  totalUniqueCompanies: number;
  totalCreditsCalculated: number;
  averageCreditsPerStudent: number;
  totalInternshipEntries: number;
  entriesNeedingReview: number;
  entriesNeedingReviewBreakdown: {
    unparseable_duration: number;
    unparseable_start_date: number;
    unparseable_end_date: number;
    certification_style: number;
  };
  divisionBreakdown: Array<{
    division: string;
    studentCount: number;
    totalCreditsCalculated: number;
    averageCreditsPerStudent: number;
  }>;
}

export function DashboardPage() {
  const { selectedBatch, selectedDivision, setSelectedDivision } = useFilter();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showReviewBreakdown, setShowReviewBreakdown] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { batch: selectedBatch };
      if (selectedDivision) {
        params.division = selectedDivision;
      }
      const res = await axios.get<OverviewResponse>("/api/analytics/overview", { params });
      setData(res.data);
    } catch (err: any) {
      console.error("[DashboardPage] Error fetching overview data:", err);
      const msg =
        err.response?.data?.error || err.message || "Failed to load dashboard overview";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBatch, selectedDivision]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Dashboard Overview
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            High-level aggregation of student internships, credits, and review status.
          </p>
        </div>

        {/* Division Filter Dropdown in Page Header */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <label
            htmlFor="header-division-select"
            className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            <Filter className="h-3.5 w-3.5" />
            Division:
          </label>
          <select
            id="header-division-select"
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
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800"
            >
              <RotateCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50"
            />
          ))}
        </div>
      ) : data ? (
        <>
          {/* Primary KPI Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard label="Total Students" value={data.totalStudents} icon={Users} />
            <KPICard
              label="Students With Internship"
              value={data.studentsWithAtLeastOneInternship}
              icon={UserCheck}
            />
            <KPICard
              label="Students Without Internship"
              value={data.studentsWithNoInternship}
              icon={UserX}
            />
            <KPICard
              label="Total Unique Companies"
              value={data.totalUniqueCompanies}
              icon={Building2}
            />
            <KPICard
              label="Total Credits Calculated"
              value={data.totalCreditsCalculated}
              icon={Award}
            />
            <KPICard
              label="Average Credits per Student"
              value={data.averageCreditsPerStudent}
              icon={BarChart2}
            />
            <KPICard
              label="Total Internship Entries"
              value={data.totalInternshipEntries}
              icon={Briefcase}
            />

            {/* Entries Needing Review Card - Visually Neutral Slate */}
            <div className="relative animate-fade-in rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Entries Needing Review
                  </p>
                  <p className="tabular-nums mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {data.entriesNeedingReview}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0 rounded-md bg-slate-100 p-2.5 dark:bg-slate-800">
                  <HelpCircle className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                </div>
              </div>

              {/* Expand Breakdown Toggle */}
              <button
                onClick={() => setShowReviewBreakdown((prev) => !prev)}
                className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <span>{showReviewBreakdown ? "Hide reason breakdown" : "Show reason breakdown"}</span>
                {showReviewBreakdown ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {/* Expanded Reason Breakdown */}
              {showReviewBreakdown && (
                <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <p className="mb-2 text-[11px] text-slate-400 dark:text-slate-500">
                    Legacy formats requiring manual verification:
                  </p>
                  <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <li className="flex justify-between">
                      <span>Unparseable Duration:</span>
                      <span className="tabular-nums font-semibold">
                        {data.entriesNeedingReviewBreakdown.unparseable_duration}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Unparseable Start Date:</span>
                      <span className="tabular-nums font-semibold">
                        {data.entriesNeedingReviewBreakdown.unparseable_start_date}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Unparseable End Date:</span>
                      <span className="tabular-nums font-semibold">
                        {data.entriesNeedingReviewBreakdown.unparseable_end_date}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Certification-Style:</span>
                      <span className="tabular-nums font-semibold">
                        {data.entriesNeedingReviewBreakdown.certification_style}
                      </span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Division Breakdown Section (Shown when selectedDivision is empty / All Divisions) */}
          {!selectedDivision && (
            <div className="animate-fade-in space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Division Comparison Breakdown
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Comparing all 4 divisions for {selectedBatch}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {data.divisionBreakdown.map((div) => (
                  <div
                    key={div.division}
                    className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-default hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {div.division}
                      </span>
                      <span className="tabular-nums text-xs text-slate-500 dark:text-slate-400">
                        {div.studentCount} Students
                      </span>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Avg Credits / Student:</span>
                        <span className="tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                          {div.averageCreditsPerStudent}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>Total Credits Calculated:</span>
                        <span className="tabular-nums font-medium text-slate-700 dark:text-slate-300">
                          {div.totalCreditsCalculated}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar representing relative credits */}
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full bg-primary-600 transition-all duration-300"
                        style={{
                          width: `${Math.min(100, (div.averageCreditsPerStudent / 4) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          No data available for the selected filter combination.
        </div>
      )}
    </div>
  );
}
