import { useState, useEffect, useMemo } from "react";
import api from "../lib/api";
import {
  Award,
  BarChart2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RotateCw,
  Filter,
  AlertCircle,
} from "lucide-react";
import { OverridesWarningBanner } from "../components/OverridesWarningBanner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { KPICard } from "../components/KPICard";
import { DataTable, type Column } from "../components/DataTable";
import { useFilter, DIVISIONS } from "../context/FilterContext";

export interface CreditDistributionItem {
  creditValue: number;
  studentCount: number;
}

export interface StudentCreditItem {
  name: string;
  prn: string;
  division: string;
  internshipCount: number;
  totalCreditsCalculated: number;
  sheetReportedTotalCredits: string;
  discrepancy: boolean;
  needsReview: boolean;
}

export interface CreditsApiResponse {
  overridesApplied: boolean;
  totalCreditsCalculated: number;
  averageCreditsPerStudent: number;
  distribution: CreditDistributionItem[];
  studentList: StudentCreditItem[];
  reviewSummary: {
    unparseable_duration: number;
    unparseable_start_date: number;
    unparseable_end_date: number;
    certification_style: number;
    possible_duplicate_split: number;
  };
}

export interface StudentCreditRow extends StudentCreditItem, Record<string, unknown> {
  sheetTotalNumeric: number;
}

export function CreditsPage() {
  const { selectedBatch, selectedDivision, setSelectedDivision } = useFilter();
  const [data, setData] = useState<CreditsApiResponse | null>(null);
  const [overridesApplied, setOverridesApplied] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showReviewBreakdown, setShowReviewBreakdown] = useState<boolean>(false);
  const [discrepancyOnlyFilter, setDiscrepancyOnlyFilter] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { batch: selectedBatch };
      if (selectedDivision) {
        params.division = selectedDivision;
      }
      const res = await api.get<CreditsApiResponse>("/api/analytics/credits", { params });
      setData(res.data);
      setOverridesApplied(res.data.overridesApplied);
    } catch (err: any) {
      console.error("[CreditsPage] Error fetching credit analytics:", err);
      const msg =
        err.response?.data?.error || err.message || "Failed to load credit analytics";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBatch, selectedDivision]);

  // Compute table rows
  const tableData: StudentCreditRow[] = useMemo(() => {
    if (!data) return [];
    let list = data.studentList.map((item) => ({
      ...item,
      sheetTotalNumeric: parseFloat(item.sheetReportedTotalCredits) || 0,
    }));

    if (discrepancyOnlyFilter) {
      list = list.filter((item) => item.discrepancy);
    }

    return list;
  }, [data, discrepancyOnlyFilter]);

  const totalReviewEntries = data
    ? data.reviewSummary.unparseable_duration +
      data.reviewSummary.unparseable_start_date +
      data.reviewSummary.unparseable_end_date +
      data.reviewSummary.certification_style
    : 0;

  const tableColumns: Column<StudentCreditRow>[] = [
    {
      key: "name",
      label: "Student Name",
      sortable: true,
      render: (row) => (
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {row.name}
        </span>
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
      label: "Calculated Total Credits",
      sortable: true,
      render: (row) => (
        <span className="tabular-nums text-base font-bold text-slate-900 dark:text-slate-100">
          {row.totalCreditsCalculated}
        </span>
      ),
    },
    {
      key: "sheetReportedTotalCredits",
      label: "Sheet Reported",
      sortable: true,
      render: (row) => (
        <span className="tabular-nums text-xs text-slate-500 dark:text-slate-400">
          {row.sheetReportedTotalCredits || "0"}
        </span>
      ),
    },
    {
      key: "discrepancy",
      label: "Discrepancy",
      sortable: true,
      render: (row) => {
        if (!row.discrepancy) return null; // Hidden entirely when calculated matches sheet

        const tooltipText = `Calculated from internship data: ${row.totalCreditsCalculated}. Sheet shows: ${row.sheetReportedTotalCredits || "0"}.`;

        return (
          <div
            title={tooltipText}
            className="inline-flex cursor-help items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
          >
            <AlertCircle className="h-3 w-3" />
            <span>Audit Diff</span>
          </div>
        );
      },
    },
  ];

  const filterControls = (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
        <input
          type="checkbox"
          checked={discrepancyOnlyFilter}
          onChange={(e) => setDiscrepancyOnlyFilter(e.target.checked)}
          className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800"
        />
        <span>Show Discrepancies Only</span>
      </label>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Credit Analytics & Audit
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Calculated credit totals, distribution, and sheet discrepancy auditing.
          </p>
        </div>

        {/* Division Filter Dropdown */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <label
            htmlFor="credits-division-select"
            className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            <Filter className="h-3.5 w-3.5" />
            Division:
          </label>
          <select
            id="credits-division-select"
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

      {/* Supabase override unavailability banner */}
      <OverridesWarningBanner overridesApplied={overridesApplied} />

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50"
              />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50" />
        </div>
      ) : data ? (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

            {/* Review-Related Credit Entries Card - Neutral Slate Treatment */}
            <div className="relative animate-fade-in rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Review-Related Credit Entries
                  </p>
                  <p className="tabular-nums mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {totalReviewEntries}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0 rounded-md bg-slate-100 p-2.5 dark:bg-slate-800">
                  <HelpCircle className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                </div>
              </div>

              {/* Expand Reason Breakdown */}
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

              {/* Expanded Breakdown */}
              {showReviewBreakdown && (
                <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <li className="flex justify-between">
                      <span>Unparseable Duration:</span>
                      <span className="tabular-nums font-semibold">
                        {data.reviewSummary.unparseable_duration}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Certification-Style (Hours):</span>
                      <span className="tabular-nums font-semibold">
                        {data.reviewSummary.certification_style}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Unparseable Start Date:</span>
                      <span className="tabular-nums font-semibold">
                        {data.reviewSummary.unparseable_start_date}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Unparseable End Date:</span>
                      <span className="tabular-nums font-semibold">
                        {data.reviewSummary.unparseable_end_date}
                      </span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Credit Distribution Bar Chart */}
          <div className="animate-fade-in rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Credit Distribution Across Students
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bucketed by total calculated credits per student
              </p>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.distribution}
                  margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                >
                  <CartesianGrid horizontal={false} vertical={false} />
                  <XAxis
                    dataKey="creditValue"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    tickFormatter={(val) => `${val} Cr`}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(100, 116, 139, 0.08)" }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item: CreditDistributionItem = payload[0].payload;
                        return (
                          <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg dark:border-slate-800 dark:bg-slate-900">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {item.creditValue} {item.creditValue === 1 ? "Credit" : "Credits"}
                            </p>
                            <p className="mt-1 text-slate-600 dark:text-slate-300">
                              Students: <span className="tabular-nums font-semibold">{item.studentCount}</span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="studentCount"
                    fill="#4f46e5"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Student-Wise Credit Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Student Credit Audit Table
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Click headers to sort; hover discrepancy badges to compare calculated vs sheet values
              </span>
            </div>

            <DataTable
              columns={tableColumns}
              data={tableData}
              searchable={true}
              searchPlaceholder="Search student name or PRN..."
              pageSize={20}
              getRowKey={(row) => row.prn}
              extraHeaderControls={filterControls}
              initialSortKey="totalCreditsCalculated"
              initialSortDir="desc"
              filterPredicate={(row, query) =>
                row.name.toLowerCase().includes(query) ||
                row.prn.toLowerCase().includes(query)
              }
            />
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          No credit data available for the selected filter combination.
        </div>
      )}
    </div>
  );
}
