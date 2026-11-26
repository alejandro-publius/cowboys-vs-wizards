// Lighthouse-style audit of the served pages, in Chrome: accessibility, search and link-preview metadata, legible
// text, touch targets, keyboard focus, layout fit, console errors and load timing. QA instrumentation only.
//   node scripts/build-graybox.mjs && node prototypes/showdown/build.mjs
//   npx -y -p playwright-core@1.64.1 node scripts/browser-page-audit.mjs dist/cowboys-vs-wizards-board-duel.html [dist/showdown.html]
//        [--out .artifacts/page-audit/report.json] [--perf-runs 3]
// Each page is served gzip-compressed on loopback under /cowboys-vs-wizards/ (and /cowboys-vs-wizards/showdown/), as Pages
// serves it. The graybox is walked through its screens (title, Camp, Camp with every disclosure open, Boot Hill, a picked
// card, the deck builder) at 1440x900 and at a 390x844 phone; the reference page is audited as it opens. Rules follow
// axe-core and Lighthouse names where they overlap, but this is an independent approximation: neither tool is a
// dependency here, and the report never claims a Lighthouse score. Load timing uses a 412x823 phone with the CPU slowed
// four times; loopback is not network-throttled. CHROME_PATH overrides the Chrome binary. Exit 1 on any violation.
import {createRequire} from "node:module";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import http from "node:http";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import zlib from "node:zlib";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : fallback; };
const pages = args.filter((arg, i) => !arg.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!pages.length) {
  console.error("usage: node scripts/browser-page-audit.mjs <graybox.html> [<showdown.html>] [--out FILE] [--perf-runs N]");
  process.exit(2);
}
const out = path.resolve(option("--out", ".artifacts/page-audit/report.json"));
const perfRuns = Number(option("--perf-runs", 3));
const CHROME = process.env.CHROME_PATH ?? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome"].find(existsSync);

function loadPlaywright() {
  const tryFrom = (base) => { try { return createRequire(base)("playwright-core"); } catch { return null; } };
  const local = tryFrom(path.join(root, "package.json"));
  if (local) return local;
  const bin = (process.env.PATH ?? "").split(path.delimiter).find((dir) => existsSync(path.join(dir, "playwright-core")));
  const found = bin && tryFrom(pathToFileURL(path.join(bin, "..", "x.js")));
  if (found) return found;
  throw new Error("playwright-core not found. Run as: npx -y -p playwright-core@1.64.1 node scripts/browser-page-audit.mjs ...");
}

// ---- The in-page audit (serialized into the page) ---------------------------------------------------------------
function auditPage() {
  const V = {}, P = {}, I = {};
  const short = (el) => {
    if (!el || el.nodeType !== 1) return String(el);
    const cls = el.classList.length ? `.${[...el.classList].slice(0, 2).join(".")}` : "";
    const text = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 48);
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${cls}${text ? ` "${text}"` : ""}`;
  };
  const fail = (rule, el, detail = "") => (V[rule] ??= []).push(short(el) + (detail ? ` [${detail}]` : ""));
  const pass = (rule) => { P[rule] = (P[rule] ?? 0) + 1; };
  const unsure = (rule, el, detail) => (I[rule] ??= []).push(`${short(el)} [${detail}]`);
  const rendered = (el) => {
    if (!el.checkVisibility({visibilityProperty: true})) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const ariaHidden = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) if (n.getAttribute("aria-hidden") === "true" || n.inert) return true; return false; };
  const inTree = (el) => rendered(el) && !ariaHidden(el);
  const pseudo = (el, which) => { const m = getComputedStyle(el, which).content.match(/^"(.*)"$/s); return m ? m[1] : ""; };
  const textOf = (node, top = true) => {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1) return "";
    if (!top && (!node.checkVisibility({visibilityProperty: true}) || node.getAttribute("aria-hidden") === "true")) return "";
    if (!top && node.getAttribute("aria-label")?.trim()) return ` ${node.getAttribute("aria-label")} `;
    if (node.tagName === "IMG") return node.getAttribute("alt") ?? "";
    let s = pseudo(node, "::before");
    for (const child of node.childNodes) s += textOf(child, false);
    s += pseudo(node, "::after");
    return getComputedStyle(node).display.startsWith("inline") ? s : ` ${s} `;
  };
  const FROM_CONTENT = new Set(["BUTTON", "A", "SUMMARY", "OPTION", "LEGEND", "TH", "TD", "H1", "H2", "H3", "H4", "H5", "H6", "LABEL"]);
  const nameOf = (el) => {
    const by = el.getAttribute("aria-labelledby");
    if (by) {
      const t = by.split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean).map((n) => textOf(n)).join(" ").replace(/\s+/g, " ").trim();
      if (t) return t;
    }
    if (el.getAttribute("aria-label")?.trim()) return el.getAttribute("aria-label").trim();
    if (el.labels?.length) { const t = [...el.labels].map((l) => textOf(l)).join(" ").replace(/\s+/g, " ").trim(); if (t) return t; }
    if (el.tagName === "INPUT" && ["submit", "reset", "button"].includes(el.type)) return el.value;
    if (FROM_CONTENT.has(el.tagName) || ["button", "link", "tab", "menuitem", "option", "heading", "checkbox", "radio", "switch"].includes(el.getAttribute("role"))) {
      const t = textOf(el).replace(/\s+/g, " ").trim();
      if (t) return t;
    }
    return (el.getAttribute("title") || el.getAttribute("placeholder") || "").trim();
  };
  const focusable = (el) => {
    if (el.disabled) return false;
    const tabindex = el.getAttribute("tabindex");
    if (tabindex !== null) return Number(tabindex) >= 0;
    if (el.tagName === "A") return el.hasAttribute("href");
    if (["BUTTON", "INPUT", "SELECT", "TEXTAREA", "IFRAME"].includes(el.tagName)) return el.type !== "hidden";
    return el.tagName === "SUMMARY" || el.isContentEditable;
  };
  const all = [...document.querySelectorAll("*")];

  // Document.
  if (document.title.trim()) pass("document-title"); else fail("document-title", document.documentElement);
  if (/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(document.documentElement.lang)) pass("html-has-lang"); else fail("html-has-lang", document.documentElement);
  const viewport = document.querySelector('meta[name="viewport"]')?.content.toLowerCase();
  const maxScale = viewport?.match(/maximum-scale\s*=\s*([\d.]+)/);
  if (viewport && !/user-scalable\s*=\s*(no|0)/.test(viewport) && !(maxScale && Number(maxScale[1]) < 5)) pass("meta-viewport"); else fail("meta-viewport", document.documentElement, viewport ?? "missing");
  const ids = new Map();
  for (const el of document.querySelectorAll("[id]")) ids.set(el.id, (ids.get(el.id) ?? 0) + 1);
  for (const [id, n] of ids) if (n > 1) fail("duplicate-id", document.getElementById(id), `${n} elements`);

  // ARIA.
  const ARIA = new Set("activedescendant atomic autocomplete braillelabel brailleroledescription busy checked colcount colindex colindextext colspan controls current describedby description details disabled dropeffect errormessage expanded flowto grabbed haspopup hidden invalid keyshortcuts label labelledby level live modal multiline multiselectable orientation owns placeholder posinset pressed readonly relevant required roledescription rowcount rowindex rowindextext rowspan selected setsize sort valuemax valuemin valuenow valuetext".split(" "));
  const ROLES = new Set("alert alertdialog application article banner blockquote button caption cell checkbox code columnheader combobox complementary contentinfo definition deletion dialog directory document emphasis feed figure form generic grid gridcell group heading img insertion link list listbox listitem log main mark marquee math menu menubar menuitem menuitemcheckbox menuitemradio meter navigation none note option paragraph presentation progressbar radio radiogroup region row rowgroup rowheader scrollbar search searchbox separator slider spinbutton status strong subscript superscript switch tab table tablist tabpanel term textbox time timer toolbar tooltip tree treegrid treeitem".split(" "));
  const UNNAMED_ROLES = new Set(["generic", "none", "presentation", "paragraph", "code", "deletion", "emphasis", "insertion", "strong", "subscript", "superscript", "time", "caption", "mark", "term"]);
  const GENERIC_TAGS = new Set(["DIV", "SPAN", "B", "I", "U", "S", "SMALL", "P", "CODE", "STRONG", "EM", "DEL", "INS", "SUB", "SUP", "TIME", "MARK", "PRE", "Q"]);
  for (const el of all) {
    for (const attr of ["aria-labelledby", "aria-describedby", "aria-controls", "aria-owns", "aria-activedescendant", "aria-errormessage", "aria-details"]) {
      const value = el.getAttribute(attr);
      if (value === null) continue;
      const missing = value.split(/\s+/).filter((id) => id && !document.getElementById(id));
      if (missing.length) fail("aria-valid-attr-value", el, `${attr} -> ${missing.join(",")}`); else pass("aria-valid-attr-value");
    }
    for (const attr of el.getAttributeNames()) if (attr.startsWith("aria-")) { if (ARIA.has(attr.slice(5))) pass("aria-valid-attr"); else fail("aria-valid-attr", el, attr); }
    const role = el.getAttribute("role")?.trim().split(/\s+/)[0];
    if (role !== undefined) { if (ROLES.has(role)) pass("aria-roles"); else fail("aria-roles", el, role); }
    if ((el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby")) && (role ? UNNAMED_ROLES.has(role) : GENERIC_TAGS.has(el.tagName))) fail("aria-prohibited-attr", el, `named ${role ?? el.tagName.toLowerCase()}`);
    if (ariaHidden(el) && focusable(el) && rendered(el)) fail("aria-hidden-focus", el);
  }

  // Names, nesting, lists, headings, landmarks.
  for (const el of all) {
    if (!inTree(el)) continue;
    const role = el.getAttribute("role");
    if (el.tagName === "IMG" && role !== "none" && role !== "presentation") { if (el.hasAttribute("alt") || nameOf(el)) pass("image-alt"); else fail("image-alt", el); }
    if (role === "img") { if (nameOf(el)) pass("role-img-alt"); else fail("role-img-alt", el); }
    if (el.tagName === "BUTTON" || el.tagName === "SUMMARY" || role === "button" || (el.tagName === "INPUT" && ["button", "submit", "reset"].includes(el.type))) { if (nameOf(el)) pass("button-name"); else fail("button-name", el); }
    if (el.tagName === "A" && el.hasAttribute("href")) { if (nameOf(el)) pass("link-name"); else fail("link-name", el); }
    if (["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName) && !["hidden", "button", "submit", "reset", "image"].includes(el.type)) { if (nameOf(el)) pass("label"); else fail("label", el); }
    if (/^H[1-6]$/.test(el.tagName) || role === "heading") { if (textOf(el).trim()) pass("empty-heading"); else fail("empty-heading", el); }
    if (el.matches("button, a[href], summary, [role=button], [role=link]")) {
      const inner = el.querySelector("button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex='-1']), [role=button], [role=link]");
      if (inner) fail("nested-interactive", el, short(inner)); else pass("nested-interactive");
    }
  }
  for (const list of document.querySelectorAll("ul, ol")) {
    if (list.getAttribute("role") && list.getAttribute("role") !== "list") continue;
    const stray = [...list.children].filter((c) => !["LI", "SCRIPT", "TEMPLATE"].includes(c.tagName));
    if (stray.length) fail("list", list, stray.map((c) => c.tagName.toLowerCase()).join(",")); else pass("list");
  }
  for (const item of document.querySelectorAll("li")) {
    const parent = item.parentElement;
    if (parent && (["UL", "OL", "MENU"].includes(parent.tagName) || parent.getAttribute("role") === "list")) pass("listitem"); else fail("listitem", item);
  }
  for (const el of document.querySelectorAll("[tabindex]")) if (Number(el.getAttribute("tabindex")) > 0) fail("tabindex", el);
  let previous = 0;
  const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]")].filter(inTree);
  for (const h of headings) {
    const level = Number(h.getAttribute("aria-level") ?? h.tagName.slice(1)) || 2;
    if (previous && level > previous + 1) fail("heading-order", h, `h${previous} -> h${level}`); else pass("heading-order");
    previous = level;
  }
  if (headings.some((h) => h.tagName === "H1" || h.getAttribute("aria-level") === "1")) pass("page-has-heading-one"); else fail("page-has-heading-one", document.body);
  const mains = [...document.querySelectorAll("main, [role=main]")].filter(inTree);
  if (mains.length === 1) pass("landmark-one-main"); else fail("landmark-one-main", document.body, `${mains.length} main landmarks shown`);
  for (const el of all) {
    if (!rendered(el) || el === document.documentElement || el === document.body) continue;
    const s = getComputedStyle(el);
    const scrolls = (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) || (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1);
    if (!scrolls) continue;
    if (focusable(el) || [...el.querySelectorAll("*")].some((c) => focusable(c) && rendered(c))) pass("scrollable-region-focusable"); else fail("scrollable-region-focusable", el);
  }

  // Colour contrast, WCAG 1.4.3 AA (ancestor backgrounds composited; a background image leaves the result unsure).
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return {r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1}; };
  const over = (top, bottom) => {
    const a = top.a + bottom.a * (1 - top.a);
    const mix = (k) => (top[k] * top.a + bottom[k] * bottom.a * (1 - top.a)) / (a || 1);
    return {r: mix("r"), g: mix("g"), b: mix("b"), a};
  };
  const luminance = ({r, g, b}) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (x, y) => { const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
  const backdrop = (el) => {
    const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage !== "none") return {unsure: `background image on ${short(n)}`};
      const c = parse(s.backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let bg = {r: 255, g: 255, b: 255, a: 1};
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
    return {bg};
  };
  const ratios = [];
  const seenText = new Set();
  for (const el of all) {
    if (!rendered(el) || !([...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()))) continue;
    if (el.closest(":disabled, [aria-disabled=true]")) continue; // inactive controls are exempt
    const s = getComputedStyle(el);
    let opacity = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity);
    const back = backdrop(el);
    if (back.unsure) { unsure("color-contrast", el, back.unsure); continue; }
    const fg0 = parse(s.color);
    const fg = over({...fg0, a: fg0.a * opacity}, back.bg);
    const size = parseFloat(s.fontSize), large = size >= 24 || (Number(s.fontWeight) >= 700 && size >= 18.66);
    const r = ratio(fg, back.bg), need = large ? 3 : 4.5;
    ratios.push(r);
    if (seenText.has(short(el))) continue;
    seenText.add(short(el));
    if (r + 1e-6 < need) fail("color-contrast", el, `${r.toFixed(2)}:1 < ${need}:1 at ${size}px`); else pass("color-contrast");
  }
  for (const a of document.querySelectorAll("a[href]")) {
    if (!inTree(a) || ![...a.parentElement.childNodes].some((c) => c !== a && c.nodeType === 3 && c.textContent.trim().length > 1)) continue;
    const s = getComputedStyle(a), ps = getComputedStyle(a.parentElement);
    if (s.textDecorationLine.includes("underline") || s.borderBottomStyle !== "none" || ratio(parse(s.color), parse(ps.color)) >= 3) pass("link-in-text-block");
    else fail("link-in-text-block", a, "no underline and under 3:1 against its text");
  }

  // Touch targets: WCAG 2.5.8 (24 px, with its spacing exception) as a rule; the 44 px size (WCAG 2.5.5) is counted.
  const targets = all.filter((el) => inTree(el) && focusable(el) && el.tagName !== "TEXTAREA" && el.getAttribute("role") !== "region")
    .map((el) => ({el, r: el.getBoundingClientRect()}));
  const inline = (el) => el.tagName === "A" && [...el.parentElement.childNodes].some((c) => c !== el && c.nodeType === 3 && c.textContent.trim().length > 1);
  const smallTargets = [];
  for (const {el, r} of targets) {
    if (r.width < 44 || r.height < 44) smallTargets.push({control: short(el), width: Math.round(r.width), height: Math.round(r.height)});
    if ((r.width >= 24 && r.height >= 24) || inline(el)) { pass("target-size"); continue; }
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const crowded = targets.some(({el: o, r: q}) => {
      if (o === el || o.contains(el) || el.contains(o)) return false;
      if (Math.hypot(Math.max(q.left - cx, 0, cx - q.right), Math.max(q.top - cy, 0, cy - q.bottom)) < 12) return true;
      return (q.width < 24 || q.height < 24) && Math.hypot(q.left + q.width / 2 - cx, q.top + q.height / 2 - cy) < 24;
    });
    if (crowded) fail("target-size", el, `${Math.round(r.width)}x${Math.round(r.height)}`); else pass("target-size");
  }

  // Legible text (Lighthouse's font-size audit wants 60% of text at 12 px or more; this reports the share below 12 px).
  let chars = 0, small = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const n = t.textContent.replace(/\s+/g, "").length;
    if (!n || !t.parentElement || !rendered(t.parentElement)) continue;
    chars += n;
    if (parseFloat(getComputedStyle(t.parentElement).fontSize) < 12) small += n;
  }

  const meta = (selector) => document.querySelector(selector)?.getAttribute("content") ?? null;
  return {
    violations: V, unsure: I, passes: P, elements: all.length,
    minContrast: ratios.length ? Number(Math.min(...ratios).toFixed(2)) : null,
    textUnder12px: chars ? Number((small / chars).toFixed(4)) : 0,
    targets: {count: targets.length, under44: smallTargets.length, smallTargets},
    horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    seo: {
      title: document.title, description: meta('meta[name="description"]'), robots: meta('meta[name="robots"]'),
      canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
      preview: Object.fromEntries(["og:title", "og:description", "og:image", "og:url", "og:type"].map((p) => [p, meta(`meta[property="${p}"]`)])
        .concat([["twitter:card", meta('meta[name="twitter:card"]')]])),
      genericLinkText: [...document.querySelectorAll("a[href]")].filter((a) => /^(click here|here|more|read more|learn more|link)$/i.test(nameOf(a))).map(short),
    },
  };
}

// ---- Driver -----------------------------------------------------------------------------------------------------
const {chromium} = loadPlaywright();
const routes = new Map([["/cowboys-vs-wizards/", pages[0]], ...(pages[1] ? [["/cowboys-vs-wizards/showdown/", pages[1]]] : [])]);
const server = http.createServer((req, res) => {
  const file = routes.get(new URL(req.url, "http://127.0.0.1").pathname);
  if (!file) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {"content-type": "text/html; charset=utf-8", "content-encoding": "gzip", "cache-control": "no-store"});
  res.end(zlib.gzipSync(readFileSync(file), {level: 9}));
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({executablePath: CHROME, headless: true, args: process.getuid?.() === 0 ? ["--no-sandbox"] : []});
const DESKTOP = {viewport: {width: 1440, height: 900}};
const PHONE = {viewport: {width: 390, height: 844}, deviceScaleFactor: 3, isMobile: true, hasTouch: true};
const SLOW_PHONE = {viewport: {width: 412, height: 823}, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true};

// Tab through the screen; a stop with no visible change on focus (outline, shadow, border, colour) has no indicator.
async function focusWalk(page, max = 90) {
  const stops = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const label = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} "${(el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40)}"`;
      const look = (s) => [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor, s.textDecorationLine, s.color].join("|");
      const focused = look(getComputedStyle(el));
      const ring = getComputedStyle(el).outlineStyle !== "none" && parseFloat(getComputedStyle(el).outlineWidth) > 0;
      el.blur();
      const blurred = look(getComputedStyle(el));
      el.focus();
      return {label, indicator: ring || focused !== blurred};
    });
    if (!stop) continue;
    if (stops.length && stop.label === stops[0].label) break;
    stops.push(stop);
  }
  return {stops: stops.length, noIndicator: stops.filter((s) => !s.indicator).map((s) => s.label)};
}

async function walk(profile, name, url) {
  const context = await browser.newContext(profile);
  const page = await context.newPage();
  const problems = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on("response", (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`); });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Audits.enable");
  cdp.on("Audits.issueAdded", ({issue}) => problems.push(`chrome issue ${issue.code}`));
  const screens = {};
  const audit = async (screen) => {
    await page.waitForTimeout(250);
    screens[screen] = await page.evaluate(auditPage);
    await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
    screens[screen].focus = await focusWalk(page);
  };
  await page.goto(url, {waitUntil: "load"});
  if (name === "graybox") {
    await audit("title");
    await page.click("#menu-play");
    await audit("camp");
    await page.evaluate(() => document.querySelectorAll("#showdown-camp details").forEach((d) => { d.open = true; }));
    await audit("camp, disclosures open");
    await page.evaluate(() => document.querySelectorAll("#showdown-camp details").forEach((d) => { d.open = false; }));
    await page.click("#showdown-camp [data-duel]:not(:disabled)");
    await audit("Boot Hill");
    const card = await page.$("#sd-hand button:not(:disabled)");
    if (card) { await card.click(); await audit("Boot Hill, card picked"); }
    await page.click("#sd-home");
    const build = await page.$("#camp-build:not(:disabled)");
    if (build) { await build.click(); await audit("deck builder"); }
    // The Wizard preview opens on its own at ?wizard=1 (in the Camp it waits for a Boot Hill win).
    await page.goto(`${url}&wizard=1`, {waitUntil: "load"});
    if (await page.$("#camp-wizard:not([hidden])")) {
      await audit("Wizard preview");
      const tile = await page.$("[data-wizard-duel]:not(:disabled)");
      if (tile) { await tile.click(); await audit("Wizard preview duel"); }
    }
  } else await audit("opening");
  await context.close();
  return {screens, problems: [...new Set(problems)]};
}

async function timing(url) {
  const context = await browser.newContext(SLOW_PHONE);
  const page = await context.newPage();
  await page.addInitScript(() => {
    const p = window.__timing = {lcp: 0, cls: 0, long: []};
    new PerformanceObserver((l) => { for (const e of l.getEntries()) p.lcp = e.renderTime || e.loadTime || e.startTime; }).observe({type: "largest-contentful-paint", buffered: true});
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) p.cls += e.value; }).observe({type: "layout-shift", buffered: true});
    new PerformanceObserver((l) => { for (const e of l.getEntries()) p.long.push([e.startTime, e.duration]); }).observe({type: "longtask", buffered: true});
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", {cacheDisabled: true});
  await cdp.send("Emulation.setCPUThrottlingRate", {rate: 4});
  let bytes = 0;
  cdp.on("Network.loadingFinished", (e) => { bytes += e.encodedDataLength; });
  await page.goto(url, {waitUntil: "load"});
  await page.waitForTimeout(2500);
  const result = await page.evaluate(() => {
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null;
    const {lcp, cls, long} = window.__timing;
    const tbt = long.reduce((sum, [start, duration]) => sum + Math.max(0, duration - 50 - Math.max(0, fcp - start)), 0);
    return {fcp, lcp, cls, tbt, load: performance.getEntriesByType("navigation")[0].loadEventEnd};
  });
  await page.evaluate(() => {
    window.__events = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__events.push(e.duration); }).observe({type: "event", durationThreshold: 16, buffered: true});
  });
  for (const selector of ["#menu-play", "#showdown-camp [data-duel]:not(:disabled)", "#sd-hand button:not(:disabled)"]) {
    await page.tap(selector).catch(() => page.click(selector));
    await page.waitForTimeout(700);
  }
  const events = await page.evaluate(() => window.__events);
  await context.close();
  return {...result, bytes, worstInteraction: events.length ? Math.max(...events) : null};
}

const report = {at: new Date().toISOString(), chrome: browser.version(), pages: {}, timing: null};
const targets = [["graybox", `${base}/cowboys-vs-wizards/?seed=0`], ...(pages[1] ? [["showdown", `${base}/cowboys-vs-wizards/showdown/`]] : [])];
for (const [name, url] of targets) report.pages[name] = {desktop: await walk(DESKTOP, name, url), phone: await walk(PHONE, name, url)};
const runs = [];
for (let i = 0; i < perfRuns; i++) runs.push(await timing(targets[0][1]));
const median = (key) => { const v = runs.map((r) => r[key]).filter((x) => x !== null).sort((a, b) => a - b); return v.length ? v[Math.floor((v.length - 1) / 2)] : null; };
report.timing = {profile: "412x823 phone, CPU x4, loopback (no network throttling)", runs, median: Object.fromEntries(["fcp", "lcp", "cls", "tbt", "load", "bytes", "worstInteraction"].map((k) => [k, median(k)]))};
await browser.close();
server.close();
mkdirSync(path.dirname(out), {recursive: true});
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);

let violations = 0;
for (const [name, profiles] of Object.entries(report.pages)) {
  for (const [profile, {screens, problems}] of Object.entries(profiles)) {
    console.log(`${name} / ${profile}: ${problems.length} console errors, failed requests or Chrome issues${problems.length ? `: ${problems.join("; ")}` : ""}`);
    for (const [screen, s] of Object.entries(screens)) {
      const found = Object.entries(s.violations).map(([rule, list]) => `${rule} ${list.length}`);
      violations += Object.values(s.violations).reduce((n, list) => n + list.length, 0) + s.focus.noIndicator.length;
      console.log(`  ${screen}: ${found.length ? found.join(", ") : "no violations"} · focus stops ${s.focus.stops} (${s.focus.noIndicator.length} without indicator)`
        + ` · text under 12 px ${(s.textUnder12px * 100).toFixed(1)}% · targets under 44 px ${s.targets.under44}/${s.targets.count} · min contrast ${s.minContrast}:1`);
    }
    violations += problems.length;
  }
}
console.log(`timing (${report.timing.profile}, median of ${perfRuns}): ${JSON.stringify(report.timing.median)}`);
console.log(`${violations} violations; report ${path.relative(process.cwd(), out)}`);
process.exitCode = violations ? 1 : 0;
