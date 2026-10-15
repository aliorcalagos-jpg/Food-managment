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
  logLevel: "warning",
});

const bundled = result.outputFiles[0].text;
// Elements built by React 19's runtime would crash the page's React 18 (error #31). Never ship that.
if (/react\.transitional\.element|react-jsx-runtime/.test(bundled)) {
  throw new Error("The bundle contains React's own JSX runtime; React must come from the CDN global only.");
}
const js = bundled.replace(/<\/script/gi, "<\\/script");
const template = readFileSync(resolve(here, "template.html"), "utf8");
const scripts = [`<script src="${REACT}"></script>`, `<script src="${REACT_DOM}"></script>`, `<script>${js}</script>`].join("\n");
if (!template.includes("<!--SCRIPTS-->")) throw new Error("template.html is missing <!--SCRIPTS-->");

const out = resolve(here, "dist/meal-planner.html");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, template.replace("<!--SCRIPTS-->", () => scripts));
console.log(`wrote ${out} (${(Buffer.byteLength(template) + Buffer.byteLength(scripts)) / 1024 | 0} KB)`);
