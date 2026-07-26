import { useState, useEffect } from "react";
import api from "../lib/api";
import {
  RotateCw,
  Info,
  CheckCircle2,
  Clock,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useFilter } from "../context/FilterContext";
import { DataTable, type Column } from "../components/DataTable";

export interface ConfiguredBatch {
  id: string;
  label: string;
  isConfigured: boolean;
}

export interface ConfiguredBatchRow extends ConfiguredBatch, Record<string, unknown> {}

export interface OverviewData {
  entriesNeedingReview: number;
  entriesNeedingReviewBreakdown: {
    unparseable_duration: number;
    unparseable_start_date: number;
    unparseable_end_date: number;
    certification_style: number;
  };
}

export function SettingsPage() {
  const { selectedBatch } = useFilter();
  const [batches, setBatches] = useState<ConfiguredBatch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState<boolean>(true);
  const [batchesError, setBatchesError] = useState<string | null>(null);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState<boolean>(true);
  const [showReviewDetails, setShowReviewDetails] = useState<boolean>(false);

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchBatches = async () => {
    setBatchesLoading(true);
    setBatchesError(null);
    try {
      const res = await api.get<ConfiguredBatch[]>("/api/config/batches");
      setBatches(res.data);
    } catch (err: any) {
      console.error("[SettingsPage] Error fetching batches:", err);
      setBatchesError("Failed to load batch configuration");
    } finally {
      setBatchesLoading(false);
    }
  };

  const fetchOverview = async () => {
    setOverviewLoading(true);
    try {
      const res = await api.get<OverviewData>("/api/analytics/overview", {
        params: { batch: selectedBatch },
      });
      setOverview(res.data);
    } catch (err) {
      console.error("[SettingsPage] Error fetching overview data:", err);
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchOverview();
  }, [selectedBatch]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    setToastMessage(null);
    try {
      await api.get("/api/students", {
        params: { batch: selectedBatch, refresh: "true" },
      });
      const nowStr = new Date().toLocaleTimeString();
      setLastRefreshed(nowStr);
      setToastMessage(`Data cache successfully refreshed for batch ${selectedBatch} at ${nowStr}`);
      // Re-fetch overview stats
      await fetchOverview();
    } catch (err: any) {
      console.error("[SettingsPage] Error refreshing data:", err);
      setToastMessage(`Failed to refresh data: ${err.message || "Server error"}`);
    } finally {
      setRefreshing(false);
    }
  };

  const batchRows: ConfiguredBatchRow[] = batches.map((b) => ({ ...b }));

  const batchColumns: Column<ConfiguredBatchRow>[] = [
    {
      key: "label",
      label: "Batch Label",
      sortable: true,
      render: (row) => (
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {row.label} ({row.id})
        </span>
      ),
    },
    {
      key: "isConfigured",
      label: "Configuration Status",
      sortable: true,
      render: (row) =>
        row.isConfigured ? (
          <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Configured & Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            Not yet configured
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Settings & Batch Configuration
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage system batch data source configuration, data refreshes, and data quality health.
        </p>
      </div>

      {/* Success Toast / Refresh Status Banner */}
      {toastMessage && (
        <div className="animate-fade-in rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="font-medium text-emerald-700 hover:underline dark:text-emerald-300"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Section 1: Manual Refresh Control */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Live Data Sync & Cache Refresh
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Bypass local 5-minute cache and fetch latest row data directly from Google Sheets for batch <strong className="text-slate-700 dark:text-slate-300">{selectedBatch}</strong>.
            </p>
            {lastRefreshed && (
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                Last refreshed: <span className="tabular-nums font-semibold">{lastRefreshed}</span>
              </p>
            )}
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="inline-flex self-start sm:self-auto items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-default hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-500"
          >
            <RotateCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Refreshing Data..." : "Refresh Data Now"}</span>
          </button>
        </div>
      </div>

      {/* Section 2: Batch Configuration Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Configured Batches
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Read-only configuration registry
          </span>
        </div>

        {/* Read-Only Notice */}
        <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-100/70 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400 dark:text-slate-500" />
          <p className="leading-relaxed">
            Batch configuration is managed by the development team. To add a new batch, a new spreadsheet must be created and shared with the dashboard's service account, then added to the backend configuration.
          </p>
        </div>

        {batchesError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
            {batchesError}
          </div>
        ) : batchesLoading ? (
          <div className="h-40 animate-pulse rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50" />
        ) : (
          <DataTable
            columns={batchColumns}
            data={batchRows}
            searchable={false}
            pageSize={10}
          />
        )}
      </div>

      {/* Section 3: Permanent Data Quality Reference */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Data Quality & Health Reference
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Permanent summary of legacy data format issues needing review for batch <strong>{selectedBatch}</strong>.
            </p>
          </div>

          <button
            onClick={() => setShowReviewDetails((prev) => !prev)}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <span>{showReviewDetails ? "Hide Details" : "Show Details"}</span>
            {showReviewDetails ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {overviewLoading ? (
          <div className="mt-4 h-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        ) : overview ? (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Total Entries Needing Review:</span>
              <span className="tabular-nums font-bold text-slate-900 dark:text-slate-100">
                {overview.entriesNeedingReview}
              </span>
            </div>

            {showReviewDetails && (
              <div className="rounded-md bg-slate-50 p-4 dark:bg-slate-800/60">
                <p className="mb-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Breakdown by Reason Category:
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                  <div className="rounded border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                    <span className="text-slate-500 dark:text-slate-400">Unparseable Duration</span>
                    <p className="tabular-nums mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {overview.entriesNeedingReviewBreakdown.unparseable_duration}
                    </p>
                  </div>

                  <div className="rounded border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                    <span className="text-slate-500 dark:text-slate-400">Certification-Style</span>
                    <p className="tabular-nums mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {overview.entriesNeedingReviewBreakdown.certification_style}
                    </p>
                  </div>

                  <div className="rounded border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                    <span className="text-slate-500 dark:text-slate-400">Unparseable Start Date</span>
                    <p className="tabular-nums mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {overview.entriesNeedingReviewBreakdown.unparseable_start_date}
                    </p>
                  </div>

                  <div className="rounded border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                    <span className="text-slate-500 dark:text-slate-400">Unparseable End Date</span>
                    <p className="tabular-nums mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {overview.entriesNeedingReviewBreakdown.unparseable_end_date}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
