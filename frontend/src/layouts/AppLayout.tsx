import { useState, useCallback } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";
import { FilterProvider } from "../context/FilterContext";
import { ThemeProvider } from "../context/ThemeContext";
import { Menu } from "lucide-react";
import clsx from "clsx";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <ThemeProvider>
      <FilterProvider>
        <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-20 bg-black/30 lg:hidden"
              onClick={closeSidebar}
              aria-hidden="true"
            />
          )}

          {/* Sidebar */}
          <aside
            className={clsx(
              "fixed inset-y-0 left-0 z-30 w-60 flex-shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
              "transform transition-transform duration-150 ease-in-out lg:static lg:translate-x-0",
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <Sidebar onNavigate={closeSidebar} />
          </aside>

          {/* Main content area */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Topbar */}
            <header className="flex h-14 flex-shrink-0 items-center border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 lg:px-6">
              <button
                onClick={toggleSidebar}
                className="mr-3 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 lg:hidden"
                aria-label="Toggle sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
              <Topbar />
            </header>

            {/* Page content */}
            <main className="flex-1 overflow-y-auto p-4 lg:p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </FilterProvider>
    </ThemeProvider>
  );
}
