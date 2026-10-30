// Client-side PDF generation (jsPDF + jspdf-autotable). Vector text only — no screenshots.
// Libraries are loaded on demand so they never weigh on the initial page bundle.
import type { Company, PayrollItem } from "@/types";
import { formatDateTime } from "@/lib/dates";
import { now } from "@/lib/dates";
import { formatAmount } from "@/lib/utils";

type RGB = [number, number, number];
const INDIGO: RGB = [79, 70, 229];
const INDIGO_SOFT: RGB = [238, 242, 255];
const INK: RGB = [15, 23, 42];
const MUTED: RGB = [100, 116, 139];
const BORDER: RGB = [226, 232, 240];
const SUBTLE: RGB = [248, 250, 252];

/** Standard PDF fonts only cover Latin-1 — map common typographic characters to safe ones. */
export function pdfText(value: unknown): string {
  return String(value ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/→/g, "->")
    .replace(/…/g, "...")
    .replace(/[^\x00-\xFF]/g, "");
}

async function loadPdf() {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  return { jsPDF, autoTable: autoTableMod.default };
}

type Doc = InstanceType<Awaited<ReturnType<typeof loadPdf>>["jsPDF"]>;
const lastY = (doc: Doc) => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 0;

/** Draws the company logo (uploaded image or the brand glyph as vector shapes). */
function drawLogo(doc: Doc, logo: string | null, x: number, y: number, size: number) {
  if (logo) {
    try {
      const fmt = logo.startsWith("data:image/jpeg") || logo.startsWith("data:image/jpg") ? "JPEG" : "PNG";
      doc.addImage(logo, fmt, x, y, size, size);
      return;
    } catch {
      // fall back to the glyph
    }
  }
  doc.setFillColor(...INDIGO);
  doc.roundedRect(x, y, size, size, size * 0.25, size * 0.25, "F");
  const u = size / 32;
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(3 * u);
  doc.setLineCap("round");
  doc.line(x + 9 * u, y + 10.5 * u, x + 23 * u, y + 10.5 * u);
  doc.line(x + 16 * u, y + 10.5 * u, x + 16 * u, y + 23 * u);
  doc.setFillColor(199, 210, 254);
  doc.circle(x + 22.5 * u, y + 21.5 * u, 2.5 * u, "F");
  doc.setLineCap("butt");
}

function drawFooter(doc: Doc, text: string) {
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(14, h - 14, w - 14, h - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(pdfText(text), 14, h - 9);
    doc.text(`Page ${i} of ${pages}`, w - 14, h - 9, { align: "right" });
  }
}

// ------------------------------------------------------------------
// Report PDF
// ------------------------------------------------------------------
export interface ReportPdfOptions {
  title: string;
  subtitle?: string;
  companyName?: string;
  filters?: { label: string; value: string }[];
  summary?: { label: string; value: string }[];
  columns: string[];
  rows: (string | number)[][];
  /** Indexes of numeric columns to right-align. */
  numericColumns?: number[];
  /** Indexes of numeric columns to format as money (2 decimals, thousands separators). */
  moneyColumns?: number[];
  filename: string;
  generatedBy?: string;
  orientation?: "portrait" | "landscape";
}

export async function createReportPdf(opts: ReportPdfOptions) {
  const { jsPDF, autoTable } = await loadPdf();
  const orientation = opts.orientation ?? (opts.columns.length > 6 ? "landscape" : "portrait");
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  drawLogo(doc, null, 14, 12, 9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(pdfText(opts.companyName ?? "TechNova Solutions"), 26, 15.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(pdfText(`Generated ${formatDateTime(now().toISOString())}${opts.generatedBy ? ` by ${opts.generatedBy}` : ""}`), 26, 19.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...INK);
  doc.text(pdfText(opts.title), 14, 32);
  let y = 32;
  if (opts.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    const lines = doc.splitTextToSize(pdfText(opts.subtitle), w - 28);
    doc.text(lines, 14, y + 6);
    y += 6 + (lines.length - 1) * 4.5;
  }

  if (opts.filters?.length) {
    y += 5;
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    const text = opts.filters.map((f) => `${f.label}: ${f.value}`).join("   |   ");
    const lines = doc.splitTextToSize(pdfText(`Filters applied - ${text}`), w - 28);
    doc.text(lines, 14, y + 2);
    y += 2 + (lines.length - 1) * 4;
  }

  if (opts.summary?.length) {
    y += 5;
    const perRow = orientation === "landscape" ? 6 : 4;
    const rows: string[][] = [];
    for (let i = 0; i < opts.summary.length; i += perRow) {
      const chunk = opts.summary.slice(i, i + perRow);
      rows.push(chunk.map((s) => `${pdfText(s.label)}\n${pdfText(s.value)}`));
    }
    autoTable(doc, {
      startY: y,
      body: rows,
      theme: "plain",
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 }, textColor: INK, fillColor: SUBTLE, lineColor: BORDER, lineWidth: 0.2 },
      didParseCell: (data) => {
        data.cell.styles.fontStyle = "normal";
      },
    });
    y = lastY(doc);
  }

  const numeric = new Set([...(opts.numericColumns ?? []), ...(opts.moneyColumns ?? [])]);
  const money = new Set(opts.moneyColumns ?? []);
  const cell = (v: string | number, i: number) => (money.has(i) && typeof v === "number" ? formatAmount(v) : pdfText(v));
  autoTable(doc, {
    startY: y + 6,
    head: [opts.columns.map(pdfText)],
    body: opts.rows.length ? opts.rows.map((r) => r.map(cell)) : [[{ content: "No records match the selected filters.", colSpan: opts.columns.length, styles: { halign: "center", textColor: MUTED } }]],
    theme: "striped",
    margin: { left: 14, right: 14, bottom: 20 },
    styles: { fontSize: 8, cellPadding: 2.2, textColor: INK, lineColor: BORDER },
    headStyles: { fillColor: INDIGO, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: SUBTLE },
    columnStyles: Object.fromEntries([...numeric].map((i) => [i, { halign: "right" as const }])),
    didParseCell: (data) => {
      if (data.section === "head" && numeric.has(data.column.index)) data.cell.styles.halign = "right";
    },
  });

  drawFooter(doc, `${opts.companyName ?? "TechNova Solutions"} - ${opts.title} - demo data, illustrative values`);
  doc.save(opts.filename);
}

// ------------------------------------------------------------------
// Payslip PDF
// ------------------------------------------------------------------
export interface PayslipPdfInput {
  company: Company;
  payslipId: string;
  periodLabel: string;
  payDate: string; // formatted
  employee: {
    id: string;
    name: string;
    designation: string;
    department: string;
    joinDate: string; // formatted
    email: string;
  };
  item: PayrollItem;
  amountInWords: string;
  rates: { epfEmployee: number; epfEmployer: number; etf: number };
  filename: string;
}

export async function generatePayslipPdf(p: PayslipPdfInput) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const cur = p.company.currency || "LKR";
  const m = (v: number) => formatAmount(v);

  // Header
  drawLogo(doc, p.company.logo, 14, 14, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(pdfText(p.company.legalName), 32, 19);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(pdfText(p.company.address), 32, 24);
  doc.text(pdfText(`${p.company.email}  |  ${p.company.phone}  |  Reg. ${p.company.registrationNo}`), 32, 28.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INDIGO);
  doc.text("PAYSLIP", w - 14, 18, { align: "right" });
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(pdfText(p.periodLabel), w - 14, 24, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(pdfText(p.payslipId), w - 14, 28.5, { align: "right" });

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(14, 34, w - 14, 34);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text(pdfText(`Payslip for ${p.periodLabel}`), 14, 43);

  // Employee details
  const details: [string, string, string, string][] = [
    ["Employee name", p.employee.name, "Pay date", p.payDate],
    ["Employee ID", p.employee.id, "Working days", String(p.item.workingDays)],
    ["Designation", p.employee.designation, "Payment status", "Paid"],
    ["Department", p.employee.department, "Join date", p.employee.joinDate],
  ];
  autoTable(doc, {
    startY: 48,
    body: details.map((r) => r.map(pdfText)),
    theme: "plain",
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9, cellPadding: { top: 1.6, bottom: 1.6, left: 3, right: 3 }, textColor: INK },
    columnStyles: {
      0: { textColor: MUTED, cellWidth: 34 },
      1: { fontStyle: "bold", cellWidth: 57 },
      2: { textColor: MUTED, cellWidth: 34 },
      3: { fontStyle: "bold" },
    },
    tableLineColor: BORDER,
    tableLineWidth: 0.3,
  });

  // Earnings & deductions side by side
  const it = p.item;
  const earnings: [string, number][] = [
    ["Basic salary", it.basic],
    ["Transport allowance", it.transportAllowance],
    ["Meal allowance", it.mealAllowance],
    ["Other allowances", it.otherAllowance],
    ["Overtime", it.overtimePay],
    ["Bonus", it.bonus],
  ];
  const deductions: [string, number][] = [
    [`EPF employee (${p.rates.epfEmployee}%)`, it.epfEmployee],
    ["APIT (PAYE)", it.apit],
    ["Loan deduction", it.loanDeduction],
    ["Other deductions", it.otherDeduction],
    [`Unpaid leave${it.unpaidLeaveDays ? ` (${it.unpaidLeaveDays} day${it.unpaidLeaveDays === 1 ? "" : "s"})` : ""}`, it.unpaidLeaveDeduction],
  ];
  const startY = lastY(doc) + 8;
  const colW = (w - 28 - 6) / 2;
  const tableStyle = {
    theme: "plain" as const,
    styles: { fontSize: 9, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 }, textColor: INK, lineColor: BORDER },
    headStyles: { fillColor: INDIGO_SOFT, textColor: [55, 48, 163] as RGB, fontStyle: "bold" as const },
    footStyles: { fillColor: SUBTLE, textColor: INK, fontStyle: "bold" as const },
    columnStyles: { 1: { halign: "right" as const } },
    tableLineColor: BORDER,
    tableLineWidth: 0.3,
    didParseCell: (data: { section: string; column: { index: number }; cell: { styles: { halign: string } } }) => {
      if (data.column.index === 1) data.cell.styles.halign = "right";
    },
  };
  autoTable(doc, {
    ...tableStyle,
    startY,
    margin: { left: 14 },
    tableWidth: colW,
    head: [["Earnings", `Amount (${cur})`]],
    body: earnings.map(([l, v]) => [pdfText(l), m(v)]),
    foot: [["Gross earnings", m(it.gross)]],
  });
  const leftEnd = lastY(doc);
  autoTable(doc, {
    ...tableStyle,
    startY,
    margin: { left: 14 + colW + 6 },
    tableWidth: colW,
    head: [["Deductions", `Amount (${cur})`]],
    body: deductions.map(([l, v]) => [pdfText(l), m(v)]),
    foot: [["Total deductions", m(it.totalDeductions)]],
  });
  let y = Math.max(leftEnd, lastY(doc)) + 8;

  // Net pay
  doc.setFillColor(...INDIGO_SOFT);
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(14, y, w - 28, 24, 2.5, 2.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(55, 48, 163);
  doc.text("NET PAY", 19, y + 7.5);
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text(`${cur} ${m(it.net)}`, 19, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const words = doc.splitTextToSize(pdfText(p.amountInWords), w / 2 - 10);
  doc.text(words, w - 19, y + 9, { align: "right" });
  doc.text(pdfText(`Gross ${cur} ${m(it.gross)}  -  Deductions ${cur} ${m(it.totalDeductions)}`), w - 19, y + 19, { align: "right" });
  y += 32;

  // Employer contributions
  autoTable(doc, {
    startY: y,
    head: [["Employer contributions (not deducted from pay)", `Amount (${cur})`]],
    body: [
      [pdfText(`EPF employer (${p.rates.epfEmployer}%)`), m(it.epfEmployer)],
      [pdfText(`ETF (${p.rates.etf}%)`), m(it.etfEmployer)],
    ],
    theme: "plain",
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8.5, cellPadding: { top: 1.8, bottom: 1.8, left: 3, right: 3 }, textColor: INK },
    headStyles: { fillColor: SUBTLE, textColor: MUTED, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" } },
    didParseCell: (data) => {
      if (data.column.index === 1) data.cell.styles.halign = "right";
    },
    tableLineColor: BORDER,
    tableLineWidth: 0.3,
  });
  y = lastY(doc) + 6;

  if (it.warnings.length) {
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(doc.splitTextToSize(pdfText(`Notes: ${it.warnings.join(" ")}`), w - 28), 14, y);
  }

  drawFooter(doc, `Computer-generated payslip (demo) - illustrative statutory values. ${p.company.legalName}`);
  doc.save(p.filename);
}
