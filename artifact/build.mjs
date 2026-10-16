// Bundles artifact/src into ONE html fragment for the Artifact tool, which wraps it in the
// document skeleton itself (so no doctype/html/head/body here).
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const REACT = "https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js";
const REACT_DOM = "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js";

const reactFromGlobal = {
  name: "react-from-global",
  setup(b) {
    b.onResolve({ filter: /^react$/ }, () => ({ path: resolve(here, "src/shims/react.ts") }));
    b.onResolve({ filter: /^react-dom\/client$/ }, () => ({ path: resolve(here, "src/shims/react-dom-client.ts") }));
  },
};

// Two outputs from one source: the fragment for the claude.ai Artifact tool (React from cdnjs, data in the artifact's
// db) and a standalone page for the Android app (React inlined, no network at all, data kept on the device).
async function bundle(standalone) {
  const result = await build({
    entryPoints: [resolve(here, "src/main.tsx")],
    bundle: true,
    write: false,
    minify: true,
    format: "iife",
    target: "es2020",
    // Classic JSX: React.createElement, with React coming from the UMD global. The root tsconfig
    // says "react-jsx" (for Next, on React 19), which would bundle React 19's jsx-runtime and
    // build elements that the page's React 18 refuses to render, so override it explicitly.
    jsx: "transform",
    tsconfigRaw: { compilerOptions: { jsx: "react" } },
    plugins: [reactFromGlobal],
    define: { __STANDALONE__: String(standalone) },
    logLevel: "warning",
  });
  const bundled = result.outputFiles[0].text;
  // Elements built by React 19's runtime would crash the page's React 18 (error #31). Never ship that.
  if (/react\.transitional\.element|react-jsx-runtime/.test(bundled)) {
    throw new Error("The bundle contains React's own JSX runtime; React must come from the CDN global only.");
  }
  return bundled.replace(/<\/script/gi, "<\\/script");
}

const template = readFileSync(resolve(here, "template.html"), "utf8");
if (!template.includes("<!--SCRIPTS-->")) throw new Error("template.html is missing <!--SCRIPTS-->");
const size = (...parts) => (parts.reduce((n, p) => n + Buffer.byteLength(p), 0) / 1024) | 0;

// 1. the Artifact fragment
{
  const js = await bundle(false);
  const scripts = [`<script src="${REACT}"></script>`, `<script src="${REACT_DOM}"></script>`, `<script>${js}</script>`].join("\n");
  const out = resolve(here, "dist/meal-planner.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, template.replace("<!--SCRIPTS-->", () => scripts));
  console.log(`wrote ${out} (${size(template, scripts)} KB)`);
}

// 2. the standalone page for the Android app: a whole document, React inlined (the pinned copies the tests use),
//    no web fonts and no network, and the page keeps its data on the device.
{
  const js = await bundle(true);
  const vendor = (f) => readFileSync(resolve(here, "test/vendor", f), "utf8").replace(/<\/script/gi, "<\\/script");
  const scripts = [`<script>${vendor("react.production.min.js")}</script>`, `<script>${vendor("react-dom.production.min.js")}</script>`, `<script>${js}</script>`].join("\n");
  // the fonts travel inside the page (latin subsets of Cinzel and Spectral; Arabic uses the phone's serif fonts)
  const face = (family, weight, file) =>
    `@font-face{font-family:${family};font-weight:${weight};font-style:normal;font-display:swap;src:url(data:font/woff2;base64,${readFileSync(resolve(here, "fonts", file)).toString("base64")}) format("woff2")}`;
  const fonts = `<style>${[
    ...[400, 600, 700].map((w) => face("Cinzel", w, `cinzel-latin-${w}-normal.woff2`)),
    ...[400, 500, 600].map((w) => face("Spectral", w, `spectral-latin-${w}-normal.woff2`)),
  ].join("")}</style>`;
  const fragment = template
    .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\n?/, () => fonts)
    .replace(/<meta name="claude:viewport-fit-sides"[^>]*>\n?/, "")
    .replace("<!--SCRIPTS-->", () => scripts);
  const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="color-scheme" content="dark"><style>:root{color-scheme:dark;background:#1a0f0a;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>
${fragment}
</body></html>
`;
  const out = resolve(here, "dist/standalone/index.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`wrote ${out} (${size(html)} KB)`);
}
