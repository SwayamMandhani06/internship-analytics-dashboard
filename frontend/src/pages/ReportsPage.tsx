import { useState, useEffect } from "react";
import api from "../lib/api";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  RotateCw,
  Filter,
  Users,
  Award,
  Building2,
} from "lucide-react";
import { OverridesWarningBanner } from "../components/OverridesWarningBanner";
import { useFilter, DIVISIONS } from "../context/FilterContext";

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
  status: string;
  creditsCalculated: number | null;
  needsReview: boolean;
  reviewReasons: string[];
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

export function ReportsPage() {
  const { selectedBatch, selectedDivision, setSelectedDivision } = useFilter();
  const [students, setStudents] = useState<EnrichedStudent[]>([]);
  const [overridesApplied, setOverridesApplied] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
      console.error("[ReportsPage] Error fetching students:", err);
      const msg =
        err.response?.data?.error || err.message || "Failed to load report data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [selectedBatch, selectedDivision]);

  const scopeSuffix = selectedDivision ? selectedDivision : "all-divisions";
  const scopeLabel = selectedDivision ? selectedDivision : "All Divisions";

  // -------------------------------------------------------------------------
  // 1. Student List Report (Flat: one row per internship entry)
  // -------------------------------------------------------------------------
  const generateStudentListFlatData = () => {
    const rows: any[] = [];
    students.forEach((student) => {
      if (student.internships.length === 0) {
        rows.push({
          "Student Name": student.name,
          "PRN": student.prn,
          "Division": student.division,
          "Semester": "—",
          "Company / Internship Name": "No Internships Reported",
          "Duration": "—",
          "Start Date": "—",
          "End Date": "—",
          "Status": "Not Started",
          "Credits": 0,
        });
      } else {
        student.internships.forEach((item) => {
          rows.push({
            "Student Name": student.name,
            "PRN": student.prn,
            "Division": student.division,
            "Semester": item.semesterLabel,
            "Company / Internship Name": item.company || "—",
            "Duration":
              item.durationMonths !== null
                ? `${item.durationMonths} Mos`
                : item.durationRaw || "—",
            "Start Date": item.startDateRaw || "—",
            "End Date": item.endDateRaw || "—",
            "Status": item.needsReview ? "Needs Review" : item.status,
            "Credits": item.creditsCalculated !== null ? item.creditsCalculated : "—",
          });
        });
      }
    });
    return rows;
  };

  const exportStudentListExcel = () => {
    const data = generateStudentListFlatData();
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Student Internships");
    const filename = `student_list_${selectedBatch}_${scopeSuffix}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const exportStudentListPDF = () => {
    const doc = new jsPDF("landscape");
    const data = generateStudentListFlatData();

    doc.setFontSize(14);
    doc.text("Student Internship Entries Report", 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Batch: ${selectedBatch} | Division: ${scopeLabel} | Generated: ${new Date().toLocaleString()}`, 14, 22);

    const headers = [
      "Student Name",
      "PRN",
      "Division",
      "Semester",
      "Company Name",
      "Duration",
      "Start Date",
      "End Date",
      "Status",
      "Credits",
    ];

    const body = data.map((r) => [
      r["Student Name"],
      r["PRN"],
      r["Division"],
      r["Semester"],
      r["Company / Internship Name"],
      r["Duration"],
      r["Start Date"],
      r["End Date"],
      r["Status"],
      r["Credits"],
    ]);

    autoTable(doc, {
      head: [headers],
      body: body,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    const filename = `student_list_${selectedBatch}_${scopeSuffix}.pdf`;
    doc.save(filename);
  };

  // -------------------------------------------------------------------------
  // 2. Credit Summary Report (One row per student)
  // -------------------------------------------------------------------------
  const generateCreditReportData = () => {
    return students.map((student) => {
      const sheetTotal = parseFloat(student.sheetReportedTotalCredits) || 0;
      const hasDiscrepancy = student.totalCreditsCalculated !== sheetTotal;

      return {
        "Student Name": student.name,
        "PRN": student.prn,
        "Division": student.division,
        "Internship Count": student.internships.length,
        "Calculated Credits": student.totalCreditsCalculated,
        "Sheet Reported Credits": student.sheetReportedTotalCredits || "0",
        "Discrepancy": hasDiscrepancy ? "Yes" : "No",
      };
    });
  };

  const exportCreditReportExcel = () => {
    const data = generateCreditReportData();
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Credit Summary");
    const filename = `credit_report_${selectedBatch}_${scopeSuffix}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const exportCreditReportPDF = () => {
    const doc = new jsPDF("portrait");
    const data = generateCreditReportData();

    doc.setFontSize(14);
    doc.text("Student Credit Audit & Summary Report", 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Batch: ${selectedBatch} | Division: ${scopeLabel} | Generated: ${new Date().toLocaleString()}`, 14, 22);

    const headers = [
      "Student Name",
      "PRN",
      "Division",
      "Internships",
      "Calculated Credits",
      "Sheet Reported",
      "Discrepancy",
    ];

    const body = data.map((r) => [
      r["Student Name"],
      r["PRN"],
      r["Division"],
      r["Internship Count"],
      r["Calculated Credits"],
      r["Sheet Reported Credits"],
      r["Discrepancy"],
    ]);

    autoTable(doc, {
      head: [headers],
      body: body,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    const filename = `credit_report_${selectedBatch}_${scopeSuffix}.pdf`;
    doc.save(filename);
  };

  // -------------------------------------------------------------------------
  // 3. Company Participation Report (One row per company)
  // -------------------------------------------------------------------------
  const generateCompanyReportData = () => {
    const companyMap = new Map<
      string,
      {
        company: string;
        studentPrns: Set<string>;
        internshipCount: number;
        divA: Set<string>;
        divB: Set<string>;
        divC: Set<string>;
        divD: Set<string>;
      }
    >();

    students.forEach((student) => {
      student.internships.forEach((internship) => {
        if (!internship.company || !internship.company.trim()) return;
        const rawCompany = internship.company.trim();
        const normKey = rawCompany.toLowerCase().replace(/\s+/g, " ");

        let group = companyMap.get(normKey);
        if (!group) {
          group = {
            company: rawCompany,
            studentPrns: new Set(),
            internshipCount: 0,
            divA: new Set(),
            divB: new Set(),
            divC: new Set(),
            divD: new Set(),
          };
          companyMap.set(normKey, group);
        }

        group.studentPrns.add(student.prn);
        group.internshipCount++;

        if (student.division === "Div-A") group.divA.add(student.prn);
        if (student.division === "Div-B") group.divB.add(student.prn);
        if (student.division === "Div-C") group.divC.add(student.prn);
        if (student.division === "Div-D") group.divD.add(student.prn);
      });
    });

    return Array.from(companyMap.values())
      .map((g) => ({
        "Company / Program Name": g.company,
        "Student Count": g.studentPrns.size,
        "Internship Count": g.internshipCount,
        "Div-A Count": g.divA.size,
        "Div-B Count": g.divB.size,
        "Div-C Count": g.divC.size,
        "Div-D Count": g.divD.size,
      }))
      .sort((a, b) => b["Student Count"] - a["Student Count"]);
  };

  const exportCompanyReportExcel = () => {
    const data = generateCompanyReportData();
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Company Summary");
    const filename = `company_report_${selectedBatch}_${scopeSuffix}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const exportCompanyReportPDF = () => {
    const doc = new jsPDF("portrait");
    const data = generateCompanyReportData();

    doc.setFontSize(14);
    doc.text("Company Participation Report", 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Batch: ${selectedBatch} | Division: ${scopeLabel} | Generated: ${new Date().toLocaleString()}`, 14, 22);

    const headers = [
      "Company / Program Name",
      "Students",
      "Internships",
      "Div-A",
      "Div-B",
      "Div-C",
      "Div-D",
    ];

    const body = data.map((r) => [
      r["Company / Program Name"],
      r["Student Count"],
      r["Internship Count"],
      r["Div-A Count"],
      r["Div-B Count"],
      r["Div-C Count"],
      r["Div-D Count"],
    ]);

    autoTable(doc, {
      head: [headers],
      body: body,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    const filename = `company_report_${selectedBatch}_${scopeSuffix}.pdf`;
    doc.save(filename);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Reports & Export Center
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Generate and download Excel spreadsheets or formatted PDF reports.
          </p>
        </div>

        {/* Division Filter Dropdown */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <label
            htmlFor="reports-division-select"
            className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            <Filter className="h-3.5 w-3.5" />
            Division:
          </label>
          <select
            id="reports-division-select"
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

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Card 1: Student List Report */}
          <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-slate-100 p-2.5 dark:bg-slate-800">
                  <Users className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                </div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Student List Report
                </h2>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Flat entry-level export (one row per internship entry). Includes Student Name, PRN, Division, Semester, Company, Duration, Dates, Status, and Calculated Credits.
              </p>
            </div>

            <div className="mt-6 flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={exportStudentListExcel}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-default hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Export Excel</span>
              </button>
              <button
                onClick={exportStudentListPDF}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-default hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          {/* Card 2: Credit Report */}
          <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-slate-100 p-2.5 dark:bg-slate-800">
                  <Award className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                </div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Credit Summary Report
                </h2>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Student-wise credit audit report (one row per student). Includes Name, PRN, Division, Internship Count, Calculated Credits, Sheet Reported Credits, and Discrepancy status.
              </p>
            </div>

            <div className="mt-6 flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={exportCreditReportExcel}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-default hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Export Excel</span>
              </button>
              <button
                onClick={exportCreditReportPDF}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-default hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          {/* Card 3: Company Report */}
          <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-slate-100 p-2.5 dark:bg-slate-800">
                  <Building2 className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                </div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Company Report
                </h2>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Company participation summary report (one row per company). Includes Company Name, Student Count, Internship Count, and per-division breakdown counts (Div-A, B, C, D).
              </p>
            </div>

            <div className="mt-6 flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={exportCompanyReportExcel}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-default hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Export Excel</span>
              </button>
              <button
                onClick={exportCompanyReportPDF}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-default hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
