// Print-only token override: printed pages always use the light palette on white paper,
// even when the viewer is in dark mode. Values mirror the light theme tokens in globals.css.
const css = `
@media print {
  html { background: #ffffff !important; color-scheme: light !important; }
  .print-area, .dark .print-area {
    --background: #ffffff; --foreground: #0f172a; --surface: #ffffff; --surface-elevated: #ffffff;
    --muted: #f1f5f9; --muted-foreground: #64748b; --subtle: #f8fafc; --border: #e2e8f0; --input: #e2e8f0;
    --primary-soft: #eef2ff; --primary-soft-foreground: #4338ca;
    --success: #059669; --success-soft: #ecfdf5; --success-soft-foreground: #047857;
    --warning: #d97706; --warning-soft: #fffbeb; --warning-soft-foreground: #b45309;
    --destructive-soft: #fff1f2; --destructive-soft-foreground: #be123c;
    --info-soft: #eff6ff; --info-soft-foreground: #1d4ed8;
    --chart-1: #6366f1; --chart-2: #10b981; --chart-3: #f59e0b; --chart-4: #f43f5e; --chart-5: #0ea5e9; --chart-6: #a855f7; --chart-grid: #e2e8f0;
    background: var(--surface) !important; color: var(--foreground) !important;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .print-area .print-break-avoid { break-inside: avoid; }
}`;

export function PrintLightTheme() {
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
