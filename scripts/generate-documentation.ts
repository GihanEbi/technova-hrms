// Builds the browsable documentation from the Markdown guides and the captured media:
//   1. converts the Playwright WebM walkthroughs to MP4 (when ffmpeg is installed)
//   2. renders every guide to a styled HTML page in docs/ (index.html, user-guide.html, …)
//   3. prints the User Guide to docs/USER_GUIDE.pdf with Playwright's Chromium
//   4. runs the documentation verifier
// Screenshots and videos are captured beforehand by `npm run docs:screenshots` / `docs:videos`
// (`npm run docs:generate` runs all of it in order).
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { marked } from "marked";
import { chromium } from "@playwright/test";

const DOCS = join(process.cwd(), "docs");
const VIDEOS = join(DOCS, "videos");

const guides = [
  { md: "QUICK_START.md", html: "quick-start.html", title: "Quick Start" },
  { md: "USER_GUIDE.md", html: "user-guide.html", title: "User Guide" },
  { md: "ADMIN_GUIDE.md", html: "admin-guide.html", title: "Admin Guide" },
  { md: "EMPLOYEE_GUIDE.md", html: "employee-guide.html", title: "Employee Guide" },
  { md: "VIDEO_GUIDE.md", html: "video-guide.html", title: "Video Guide" },
];

function step(msg: string) {
  console.log(`\n▶ ${msg}`);
}

// ---------------------------------------------------------------- 1. MP4 conversion
function convertVideos() {
  step("Converting walkthrough videos to MP4");
  const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
  if (!hasFfmpeg) {
    console.log("  ffmpeg not found — skipping MP4 conversion (WebM files are still available).");
    return;
  }
  if (!existsSync(VIDEOS)) throw new Error("docs/videos does not exist. Run `npm run docs:videos` first.");
  for (const f of readdirSync(VIDEOS).filter((f) => f.endsWith(".webm")).sort()) {
    const src = join(VIDEOS, f);
    const out = src.replace(/\.webm$/, ".mp4");
    if (existsSync(out) && statSync(out).mtimeMs > statSync(src).mtimeMs) {
      console.log(`  ✓ ${f.replace(".webm", ".mp4")} (up to date)`);
      continue;
    }
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", out]);
    console.log(`  ✓ ${f.replace(".webm", ".mp4")} (${(statSync(out).size / 1e6).toFixed(1)} MB)`);
  }
}

// ---------------------------------------------------------------- 2. HTML
const css = `
:root{--bg:#f8fafc;--surface:#fff;--fg:#0f172a;--muted:#64748b;--border:#e2e8f0;--primary:#6366f1;--primary-soft:#eef2ff}
@media (prefers-color-scheme:dark){:root{--bg:#09090f;--surface:#15151f;--fg:#f8fafc;--muted:#94a3b8;--border:#272735;--primary:#818cf8;--primary-soft:rgba(99,102,241,.16)}}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.65 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
.layout{display:grid;grid-template-columns:260px minmax(0,1fr);min-height:100vh}
nav.side{position:sticky;top:0;height:100vh;overflow:auto;border-right:1px solid var(--border);background:var(--surface);padding:24px 16px}
nav.side .brand{display:flex;gap:10px;align-items:center;font-weight:600;margin-bottom:24px}
nav.side .brand span{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:8px;background:#6366f1;color:#fff;font-weight:700}
nav.side a{display:block;padding:7px 10px;border-radius:6px;color:var(--fg);text-decoration:none;font-size:14px}
nav.side a:hover{background:var(--primary-soft)}nav.side a.active{background:var(--primary-soft);color:var(--primary);font-weight:600}
main{max-width:960px;padding:40px 48px 80px;min-width:0}
h1{font-size:30px;letter-spacing:-.02em;margin:0 0 16px}h2{font-size:22px;margin-top:48px;padding-top:16px;border-top:1px solid var(--border);letter-spacing:-.01em}
h3{font-size:17px;margin-top:32px}a{color:var(--primary)}code{background:var(--primary-soft);padding:1px 6px;border-radius:4px;font-size:.9em}
pre{background:#0f172a;color:#e2e8f0;padding:14px 16px;border-radius:10px;overflow:auto}pre code{background:none;color:inherit;padding:0}
img{max-width:100%;border:1px solid var(--border);border-radius:10px;box-shadow:0 4px 16px -6px rgba(15,23,42,.18);margin:8px 0}
table{border-collapse:collapse;width:100%;margin:16px 0;font-size:14px;display:block;overflow:auto}th,td{border:1px solid var(--border);padding:8px 10px;text-align:left;vertical-align:top}th{background:var(--primary-soft)}
td img{max-width:260px}blockquote{margin:16px 0;padding:10px 16px;border-left:4px solid var(--primary);background:var(--primary-soft);border-radius:0 8px 8px 0}
video{width:100%;border-radius:10px;border:1px solid var(--border);background:#000;margin:8px 0 20px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin:24px 0}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px;text-decoration:none;color:var(--fg)}
.card:hover{border-color:var(--primary)}.card b{display:block;margin-bottom:4px}.card small{color:var(--muted)}
@media (max-width:860px){.layout{grid-template-columns:1fr}nav.side{position:static;height:auto}main{padding:24px 18px}}
@media print{nav.side{display:none}.layout{display:block}main{max-width:none;padding:0}h2{break-before:page;border:none}img{break-inside:avoid;box-shadow:none;max-height:115mm;width:auto}body{background:#fff;color:#0f172a}}
`;

function page(title: string, active: string, body: string) {
  const links = [{ html: "index.html", title: "Overview" }, ...guides]
    .map((g) => `<a href="${g.html}" class="${g.html === active ? "active" : ""}">${g.title}</a>`)
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · TechNova HR & Payroll</title><style>${css}</style></head>
<body><div class="layout"><nav class="side" aria-label="Documentation"><div class="brand"><span>T</span>TechNova HR docs</div>${links}</nav>
<main>${body}</main></div></body></html>`;
}

function rewriteLinks(html: string) {
  let out = html;
  for (const g of guides) out = out.replaceAll(`href="${g.md}`, `href="${g.html}`);
  return out;
}

function embedVideos(html: string) {
  // In the video guide, add an inline player under the table for each walkthrough.
  const files = existsSync(VIDEOS) ? readdirSync(VIDEOS).filter((f) => f.endsWith(".webm")).sort() : [];
  const players = files
    .map((f) => {
      const base = f.replace(".webm", "");
      const mp4 = existsSync(join(VIDEOS, `${base}.mp4`)) ? `<source src="videos/${base}.mp4" type="video/mp4">` : "";
      return `<h3>${base.replace(/^(\d+)-/, "$1 · ").replace(/-/g, " ")}</h3><video controls preload="metadata">${mp4}<source src="videos/${f}" type="video/webm"></video>`;
    })
    .join("\n");
  return html.replace(/<h2[^>]*>Regenerating the videos<\/h2>/, `<h2>Watch the walkthroughs</h2>${players}$&`);
}

function buildHtml() {
  step("Rendering HTML documentation");
  marked.setOptions({ gfm: true });
  for (const g of guides) {
    const md = readFileSync(join(DOCS, g.md), "utf8");
    let body = rewriteLinks(marked.parse(md) as string);
    // heading ids so in-page anchors (#1-login-and-demo-role-selection) work
    body = body.replace(/<h2>(.*?)<\/h2>/g, (_m, t: string) => {
      const id = t.replace(/<[^>]+>/g, "").toLowerCase().replace(/&amp;/g, "").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
      return `<h2 id="${id}">${t}</h2>`;
    });
    if (g.md === "VIDEO_GUIDE.md") body = embedVideos(body);
    writeFileSync(join(DOCS, g.html), page(g.title, g.html, body));
    console.log(`  ✓ docs/${g.html}`);
  }
  const cards = guides.map((g) => `<a class="card" href="${g.html}"><b>${g.title}</b><small>${g.md}</small></a>`).join("");
  const index = `<h1>TechNova HR & Payroll — Documentation</h1>
<p>Guides for the frontend prototype, generated from the Markdown sources in <code>docs/</code> with real Playwright screenshots and screen recordings.</p>
<div class="cards">${cards}<a class="card" href="USER_GUIDE.pdf"><b>User Guide (PDF)</b><small>Printable version</small></a></div>
<img src="screenshots/desktop/02-dashboard-admin.png" alt="Admin dashboard">`;
  writeFileSync(join(DOCS, "index.html"), page("Documentation", "index.html", index));
  console.log("  ✓ docs/index.html");
}

// ---------------------------------------------------------------- 3. PDF
async function buildPdf() {
  step("Printing USER_GUIDE.pdf");
  const browser = await chromium.launch();
  const p = await browser.newPage();
  await p.emulateMedia({ media: "print", colorScheme: "light" });
  await p.goto(pathToFileURL(join(DOCS, "user-guide.html")).href, { waitUntil: "load" });
  await p.evaluate(() => Promise.all(Array.from(document.images).map((i) => (i.complete ? null : new Promise((r) => ((i.onload = r), (i.onerror = r)))))));
  await p.pdf({
    path: join(DOCS, "USER_GUIDE.pdf"),
    format: "A4",
    printBackground: true,
    margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#64748b">TechNova HR & Payroll — User Guide · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  });
  await browser.close();
  console.log(`  ✓ docs/USER_GUIDE.pdf (${(statSync(join(DOCS, "USER_GUIDE.pdf")).size / 1e6).toFixed(1)} MB)`);
}

(async () => {
  convertVideos();
  buildHtml();
  await buildPdf();
  step("Verifying documentation");
  const res = spawnSync("npx", ["tsx", "scripts/verify-documentation.ts"], { stdio: "inherit" });
  process.exit(res.status ?? 1);
})().catch((err) => {
  console.error(`\n✗ Documentation generation failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
