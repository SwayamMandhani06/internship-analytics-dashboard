import { useState, useEffect } from "react";
import api from "../lib/api";
import {
  Info,
  AlertTriangle,
  RotateCw,
  ListOrdered,
  Filter,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { DataTable, type Column } from "../components/DataTable";
import { OverridesWarningBanner } from "../components/OverridesWarningBanner";
import { useFilter, DIVISIONS } from "../context/FilterContext";

/** Max characters for Y-axis labels before truncating with ellipsis */
const LABEL_MAX_LENGTH = 30;
/** Height in px allocated per bar row */
const ROW_HEIGHT = 40;
/** Bar thickness in px */
const BAR_SIZE = 22;
/** Max visible height (px) for the scrollable "show all" container */
const SHOW_ALL_MAX_HEIGHT = 700;

function truncateLabel(text: string, max = LABEL_MAX_LENGTH): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export interface CompanyItem {
  company: string;
  studentCount: number;
  internshipCount: number;
  divisionBreakdown: {
    "Div-A": number;
    "Div-B": number;
    "Div-C": number;
    "Div-D": number;
  };
}

export interface CompaniesApiResponse {
  overridesApplied: boolean;
  companies: CompanyItem[];
}

export interface CompanyTableRow extends CompanyItem, Record<string, unknown> {
  rank: number;
}

export function CompaniesPage() {
  const { selectedBatch, selectedDivision, setSelectedDivision } = useFilter();
  const [data, setData] = useState<CompanyItem[]>([]);
  const [overridesApplied, setOverridesApplied] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllChart, setShowAllChart] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { batch: selectedBatch };
      if (selectedDivision) {
        params.division = selectedDivision;
      }
      const res = await api.get<CompaniesApiResponse>("/api/analytics/companies", { params });
      setData(res.data.companies);
      setOverridesApplied(res.data.overridesApplied);
    } catch (err: any) {
      console.error("[CompaniesPage] Error fetching companies:", err);
      const msg =
        err.response?.data?.error || err.message || "Failed to load company analytics";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBatch, selectedDivision]);

  // Chart items: Top 15 by default unless showAllChart is toggled
  const chartItems = showAllChart ? data : data.slice(0, 15);

  // Table rows with rank assigned
  const tableData: CompanyTableRow[] = data.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));

  const tableColumns: Column<CompanyTableRow>[] = [
    {
      key: "rank",
      label: "Rank",
      sortable: true,
      render: (row) => (
        <span className="tabular-nums font-semibold text-slate-500 dark:text-slate-400">
          #{row.rank}
        </span>
      ),
    },
    {
      key: "company",
      label: "Company / Program Name",
      sortable: true,
      render: (row) => (
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {row.company}
        </span>
      ),
    },
    {
      key: "studentCount",
      label: "Students",
      sortable: true,
      render: (row) => (
        <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">
          {row.studentCount}
        </span>
      ),
    },
    {
      key: "internshipCount",
      label: "Internships",
      sortable: true,
      render: (row) => (
        <span className="tabular-nums text-slate-600 dark:text-slate-400">
          {row.internshipCount}
        </span>
      ),
    },
    {
      key: "divisionBreakdown",
      label: "Division Breakdown",
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs tabular-nums text-slate-500 dark:text-slate-400">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
            A: {row.divisionBreakdown["Div-A"]}
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
            B: {row.divisionBreakdown["Div-B"]}
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
            C: {row.divisionBreakdown["Div-C"]}
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
            D: {row.divisionBreakdown["Div-D"]}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Company & Certification Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Student participation grouped by company and program entries.
          </p>
        </div>

        {/* Division Filter Dropdown */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <label
            htmlFor="company-division-select"
            className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            <Filter className="h-3.5 w-3.5" />
            Division:
          </label>
          <select
            id="company-division-select"
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

      {/* Supabase override unavailability banner */}
      <OverridesWarningBanner overridesApplied={overridesApplied} />

      {/* Data Quality Helper Note */}
      <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-100/70 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400 dark:text-slate-500" />
        <p className="leading-relaxed">
          Company names are shown as entered in the source sheet and may include near-duplicates or combined entries (e.g. multiple internships listed in one cell). This list is not deduplicated automatically to avoid misrepresenting the source data.
        </p>
      </div>

      {/* Error State */}
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
        <div className="space-y-6">
          <div className="h-96 animate-pulse rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50" />
          <div className="h-64 animate-pulse rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50" />
        </div>
      ) : data.length > 0 ? (
        <>
          {/* Horizontal Bar Chart Section */}
          <div className="animate-fade-in rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Student Count per Company
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Showing {chartItems.length} of {data.length} unique company/program entries
                </p>
              </div>

              {data.length > 15 && (
                <button
                  onClick={() => setShowAllChart((prev) => !prev)}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-default hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {showAllChart ? "Show Top 15 Only" : `Show All (${data.length})`}
                </button>
              )}
            </div>

            {/* Recharts Horizontal Bar Chart */}
            <div
              className="w-full"
              style={showAllChart ? {
                maxHeight: SHOW_ALL_MAX_HEIGHT,
                overflowY: "auto",
                overflowX: "hidden",
              } : undefined}
            >
              <div
                style={{ height: Math.max(400, chartItems.length * ROW_HEIGHT) }}
                className="w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartItems}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                    barSize={BAR_SIZE}
                    barCategoryGap="20%"
                  >
                    <CartesianGrid horizontal={false} vertical={false} />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#64748b", fontSize: 12 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="company"
                      tickLine={false}
                      axisLine={false}
                      width={220}
                      tick={(props: any) => {
                        const { x, y, payload } = props;
                        const fullName: string = payload.value;
                        const display = truncateLabel(fullName);
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <title>{fullName}</title>
                            <text
                              x={0}
                              y={0}
                              dy={4}
                              textAnchor="end"
                              fill="#64748b"
                              fontSize={12}
                              style={{ cursor: fullName.length > LABEL_MAX_LENGTH ? "help" : "default" }}
                            >
                              {display}
                            </text>
                          </g>
                        );
                      }}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(100, 116, 139, 0.08)" }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item: CompanyItem = payload[0].payload;
                          return (
                            <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg dark:border-slate-800 dark:bg-slate-900">
                              <p className="max-w-xs font-semibold text-slate-900 dark:text-slate-100">
                                {item.company}
                              </p>
                              <div className="mt-1.5 space-y-1 text-slate-600 dark:text-slate-300">
                                <p>Students: <span className="tabular-nums font-semibold">{item.studentCount}</span></p>
                                <p>Internships: <span className="tabular-nums font-semibold">{item.internshipCount}</span></p>
                                <p className="pt-1 text-[11px] text-slate-400">
                                  Div-A: {item.divisionBreakdown["Div-A"]} | Div-B: {item.divisionBreakdown["Div-B"]} | Div-C: {item.divisionBreakdown["Div-C"]} | Div-D: {item.divisionBreakdown["Div-D"]}
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="studentCount"
                      fill="#4f46e5"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Ranking Table */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ListOrdered className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Company Rankings
              </h2>
            </div>
            <DataTable columns={tableColumns} data={tableData} pageSize={15} />
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          No company data available for the selected filter combination.
        </div>
      )}
    </div>
  );
}
