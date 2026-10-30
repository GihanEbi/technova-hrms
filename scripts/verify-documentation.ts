// Verifies the documentation deliverables:
//  - every required guide exists
//  - every image / video / document link in the Markdown and HTML guides points to an existing, non-empty file
//  - all eight walkthrough videos and the required screenshot folders exist
// Exits with a non-zero code and a helpful message when something is missing.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const DOCS = join(process.cwd(), "docs");
const problems: string[] = [];
const ok = (m: string) => console.log(`  ✓ ${m}`);

const requiredDocs = ["USER_GUIDE.md", "QUICK_START.md", "ADMIN_GUIDE.md", "EMPLOYEE_GUIDE.md", "VIDEO_GUIDE.md"];
const requiredVideos = [
  "01-application-overview",
  "02-employee-management",
  "03-attendance-management",
  "04-leave-management",
  "05-payroll-management",
  "06-performance-management",
  "07-ai-assistant",
  "08-employee-self-service",
];
const requiredShotDirs = ["desktop", "tablet", "mobile", "dark-mode", "workflows"];

function nonEmpty(file: string, min = 1000) {
  return existsSync(file) && statSync(file).isFile() && statSync(file).size >= min;
}

console.log("Checking guides…");
for (const d of requiredDocs) (nonEmpty(join(DOCS, d), 500) ? ok(d) : problems.push(`Missing guide: docs/${d}`));

console.log("Checking walkthrough videos…");
for (const v of requiredVideos) {
  const webm = join(DOCS, "videos", `${v}.webm`);
  if (nonEmpty(webm, 50_000)) ok(`${v}.webm (${(statSync(webm).size / 1e6).toFixed(1)} MB)`);
  else problems.push(`Missing or empty video: docs/videos/${v}.webm — run \`npm run docs:videos\``);
}

console.log("Checking screenshot folders…");
for (const d of requiredShotDirs) {
  const dir = join(DOCS, "screenshots", d);
  const n = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".png")).length : 0;
  if (n > 0) ok(`screenshots/${d}: ${n} images`);
  else problems.push(`No screenshots in docs/screenshots/${d} — run \`npm run docs:screenshots\``);
}

console.log("Checking links in guides…");
const linkFiles = readdirSync(DOCS).filter((f) => f.endsWith(".md") || f.endsWith(".html"));
let checked = 0;
for (const f of linkFiles) {
  const text = readFileSync(join(DOCS, f), "utf8");
  const targets = new Set<string>();
  for (const m of text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)) targets.add(m[1]);
  for (const m of text.matchAll(/(?:src|href)="([^"]+)"/g)) targets.add(m[1]);
  for (const raw of targets) {
    if (/^(https?:|mailto:|#|data:)/.test(raw)) continue;
    const path = decodeURIComponent(raw.split("#")[0]);
    if (!path) continue;
    // MP4 copies and the PDF are optional outputs of docs:generate (ffmpeg / Chromium)
    const optional = /\.mp4$/.test(path) || path === "USER_GUIDE.pdf";
    const abs = normalize(join(dirname(join(DOCS, f)), path));
    checked++;
    if (!existsSync(abs)) {
      if (!optional) problems.push(`${f}: broken link → ${raw}`);
    } else if (statSync(abs).isFile() && statSync(abs).size === 0) problems.push(`${f}: empty file → ${raw}`);
  }
}
ok(`${checked} links checked across ${linkFiles.length} files`);

if (problems.length) {
  console.error(`\n✗ Documentation verification failed (${problems.length} problem${problems.length === 1 ? "" : "s"}):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("\n✓ All documentation files and media references are valid.");
