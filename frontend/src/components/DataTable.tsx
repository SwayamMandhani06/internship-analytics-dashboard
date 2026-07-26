import React, { useState, useMemo, type ReactNode } from "react";
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";

export interface Column<T> {
  key: keyof T & string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  renderExpandedRow?: (row: T) => ReactNode;
  getRowKey?: (row: T, idx: number) => string;
  extraHeaderControls?: ReactNode;
  initialSortKey?: string;
  initialSortDir?: "asc" | "desc";
  filterPredicate?: (row: T, query: string) => boolean;
}

type SortDirection = "asc" | "desc";

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  searchable = true,
  searchPlaceholder = "Search...",
  pageSize = 10,
  renderExpandedRow,
  getRowKey,
  extraHeaderControls,
  initialSortKey = null as unknown as string,
  initialSortDir = "asc",
  filterPredicate,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey || null);
  const [sortDir, setSortDir] = useState<SortDirection>(initialSortDir);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRowKeys, setExpandedRowKeys] = useState<Set<string>>(new Set());

  const getKey = (row: T, idx: number): string => {
    if (getRowKey) return getRowKey(row, idx);
    if ("prn" in row && typeof row.prn === "string") return row.prn;
    if ("id" in row && typeof row.id === "string") return row.id;
    return String(idx);
  };

  // Filter data by search query
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();

    if (filterPredicate) {
      return data.filter((row) => filterPredicate(row, q));
    }

    return data.filter((row) =>
      columns.some((col) => {
        const val = row[col.key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, searchQuery, columns, filterPredicate]);

  // Sort filtered data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let cmp: number;
      if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredData, sortKey, sortDir]);

  // Paginate
  const totalItems = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  const pageData = sortedData.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  // Reset page to 1 when search or sort changes
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, sortKey, sortDir]);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleRowExpanded(key: string) {
    setExpandedRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="animate-fade-in rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* Search bar & Extra Header Controls */}
      {(searchable || extraHeaderControls) && (
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
          {searchable ? (
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 shadow-sm transition-default placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:placeholder:text-slate-500"
              />
            </div>
          ) : (
            <div />
          )}

          {extraHeaderControls && (
            <div className="flex flex-wrap items-center gap-2">
              {extraHeaderControls}
            </div>
          )}
        </div>
      )}

      {/* Row count summary bar */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-2 text-xs text-slate-500 dark:border-slate-800/60 dark:bg-slate-900/40 dark:text-slate-400">
        <span className="tabular-nums">
          Showing <span className="font-medium text-slate-700 dark:text-slate-300">{startItem}–{endItem}</span> of <span className="font-medium text-slate-700 dark:text-slate-300">{totalItems}</span> students
        </span>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="text-xs text-primary-600 hover:underline dark:text-primary-400"
          >
            Clear search
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/80">
              {renderExpandedRow && (
                <th className="w-10 px-3 py-3 text-xs font-medium text-slate-400" />
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    "px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400",
                    col.sortable && "cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1">
                    <span>{col.label}</span>
                    {col.sortable && sortKey === col.key && (
                      sortDir === "asc" ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (renderExpandedRow ? 1 : 0)}
                  className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  No results found matching the current search & filters.
                </td>
              </tr>
            ) : (
              pageData.map((row, idx) => {
                const key = getKey(row, idx);
                const isExpanded = expandedRowKeys.has(key);

                return (
                  <React.Fragment key={key}>
                    <tr
                      onClick={renderExpandedRow ? () => toggleRowExpanded(key) : undefined}
                      className={clsx(
                        "border-b border-slate-100 transition-colors duration-150 dark:border-slate-800/50",
                        renderExpandedRow && "cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/60",
                        isExpanded && "bg-slate-50/60 dark:bg-slate-800/40"
                      )}
                    >
                      {renderExpandedRow && (
                        <td className="w-10 px-3 py-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRowExpanded(key);
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                            aria-label={isExpanded ? "Collapse row" : "Expand row"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300"
                        >
                          {col.render ? col.render(row) : String(row[col.key] ?? "")}
                        </td>
                      ))}
                    </tr>

                    {/* Expanded Content Row */}
                    {renderExpandedRow && isExpanded && (
                      <tr className="border-b border-slate-200 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-900/90">
                        <td
                          colSpan={columns.length + 1}
                          className="p-4 transition-all duration-150 ease-in-out"
                        >
                          {renderExpandedRow(row)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <p className="tabular-nums text-xs text-slate-500 dark:text-slate-400">
            Page {safePage} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-slate-800"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-slate-800"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
