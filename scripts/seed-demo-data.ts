// Generates the deterministic demo dataset, runs integrity checks and prints a summary.
// Usage: npx tsx scripts/seed-demo-data.ts [--date 2026-10-30T10:30:00] [--out docs/.tmp/seed.json]
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createSeedData } from "../src/data/seed-data/generate";
import { runTotals } from "../src/lib/payroll";

const args = process.argv.slice(2);
const opt = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const reference = opt("--date") ? new Date(opt("--date")!) : new Date();
const out = opt("--out");
const data = createSeedData(reference);

const ids = new Set(data.employees.map((e) => e.id));
const problems: string[] = [];
if (ids.size !== data.employees.length) problems.push("Duplicate employee IDs");
for (const e of data.employees) {
  if (!data.departments.some((d) => d.id === e.departmentId)) problems.push(`${e.id} has an unknown department`);
  if (e.managerId && !ids.has(e.managerId)) problems.push(`${e.id} reports to an unknown manager`);
}
for (const s of data.salaries) if (!ids.has(s.employeeId)) problems.push(`Salary for unknown ${s.employeeId}`);
for (const l of data.leaveRequests) if (!ids.has(l.employeeId)) problems.push(`Leave for unknown ${l.employeeId}`);
for (const a of data.attendance) if (!ids.has(a.employeeId)) problems.push(`Attendance for unknown ${a.employeeId}`);
const second = JSON.stringify(createSeedData(reference));
if (second !== JSON.stringify(data)) problems.push("Seed is not deterministic for the same reference date");

console.log(`Reference date: ${reference.toString()}`);
console.table({
  departments: data.departments.length,
  designations: data.designations.length,
  employees: data.employees.length,
  salaryStructures: data.salaries.length,
  attendanceRecords: data.attendance.length,
  attendanceDays: new Set(data.attendance.map((a) => a.date)).size,
  leaveRequests: data.leaveRequests.length,
  payrollMonths: data.payrollRuns.length,
  evaluations: data.evaluations.length,
  goals: data.goals.length,
  notifications: data.notifications.length,
  demoUsers: data.demoUsers.length,
});
for (const r of data.payrollRuns) {
  const t = runTotals(r.items);
  console.log(`${r.period}: ${r.items.length} employees · net LKR ${t.net.toFixed(2)} · ${t.warnings} warning(s)`);
}
console.log("Leave statuses:", data.leaveRequests.reduce<Record<string, number>>((m, l) => ((m[l.status] = (m[l.status] ?? 0) + 1), m), {}));
console.log(`Serialized size: ${(JSON.stringify(data).length / 1024).toFixed(0)} KB`);
if (problems.length) {
  console.error("Integrity problems:\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log("Integrity checks passed.");
if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(data, null, 2));
  console.log(`Wrote ${out}`);
}
