import { Sun, Moon, Filter } from "lucide-react";
import { useFilter, BATCHES, DIVISIONS } from "../context/FilterContext";
import { useTheme } from "../context/ThemeContext";

export function Topbar() {
  const { selectedBatch, setSelectedBatch, selectedDivision, setSelectedDivision } = useFilter();
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <div className="flex flex-1 items-center justify-between gap-4">
      {/* Selectors */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Batch selector */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="batch-selector"
            className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            Batch
          </label>
          <select
            id="batch-selector"
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-default focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            {BATCHES.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.label}
              </option>
            ))}
          </select>
        </div>

        {/* Division selector */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="division-selector"
            className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            <Filter className="h-3 w-3" />
            Division
          </label>
          <select
            id="division-selector"
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

      {/* Dark mode toggle */}
      <button
        onClick={toggleDarkMode}
        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        {darkMode ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
      </button>
    </div>
  );
}
