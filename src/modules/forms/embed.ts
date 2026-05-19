/**
 * Form embed widget — pure HTML/JS string builders. Two outputs:
 *
 *   buildEmbedSnippet(opts)  → small <script> tag the user copy/pastes onto
 *                              their site. It loads the loader from /api/forms/widget.js.
 *
 *   buildLoaderJs(opts)      → the loader script body. Renders the form into a
 *                              <div data-form-id> placeholder by injecting an
 *                              <iframe> pointing at /forms/[publicId]/embed.
 *
 * Zero-dep, no React. Keeping this in a pure module means we can unit-test it
 * without touching JSDOM, then ship the same string from a route handler.
 */

export interface EmbedSnippetOptions {
  publicId: string;
  origin: string; // e.g. "https://example.com"
  height?: number; // default 600
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function buildEmbedSnippet(opts: EmbedSnippetOptions): string {
  const url = `${opts.origin.replace(/\/+$/, "")}/api/forms/widget.js`;
  const height = opts.height ?? 600;
  return (
    `<div data-zc-form="${escapeAttr(opts.publicId)}" data-zc-height="${height}"></div>\n` +
    `<script async src="${escapeAttr(url)}"></script>`
  );
}

export interface LoaderJsOptions {
  origin: string; // base URL of the SaaS host (e.g. https://app.example.com)
}

/**
 * Body of /api/forms/widget.js. Iterates every <div data-zc-form> on the host
 * page and replaces it with a same-origin sandboxed iframe to /forms/[id]/embed.
 *
 * Auto-resizes via postMessage events ({type: "zc-form-resize", id, height})
 * dispatched from the embedded page.
 */
export function buildLoaderJs(opts: LoaderJsOptions): string {
  const origin = JSON.stringify(opts.origin.replace(/\/+$/, ""));
  // Keep this body small — it ships to every embedding site.
  return [
    `(function () {`,
    `  var ORIGIN = ${origin};`,
    `  function mount(div) {`,
    `    if (div.getAttribute("data-zc-mounted") === "1") return;`,
    `    div.setAttribute("data-zc-mounted", "1");`,
    `    var id = div.getAttribute("data-zc-form");`,
    `    var height = parseInt(div.getAttribute("data-zc-height") || "600", 10) || 600;`,
    `    if (!id) return;`,
    `    var iframe = document.createElement("iframe");`,
    `    iframe.src = ORIGIN + "/forms/" + encodeURIComponent(id) + "/embed";`,
    `    iframe.title = "Form";`,
    `    iframe.loading = "lazy";`,
    `    iframe.setAttribute("allow", "clipboard-write");`,
    `    iframe.setAttribute("frameborder", "0");`,
    `    iframe.style.width = "100%";`,
    `    iframe.style.height = height + "px";`,
    `    iframe.style.border = "0";`,
    `    div.appendChild(iframe);`,
    `    div.setAttribute("data-zc-iframe-id", id);`,
    `  }`,
    `  function init() {`,
    `    var nodes = document.querySelectorAll("div[data-zc-form]");`,
    `    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);`,
    `  }`,
    `  window.addEventListener("message", function (ev) {`,
    `    if (!ev || !ev.data || ev.data.type !== "zc-form-resize") return;`,
    `    if (ev.origin !== ORIGIN) return;`,
    `    var id = ev.data.id;`,
    `    var h = parseInt(ev.data.height, 10);`,
    `    if (!id || !isFinite(h) || h < 80) return;`,
    `    var div = document.querySelector('div[data-zc-iframe-id="' + id.replace(/"/g, "") + '"]');`,
    `    if (!div) return;`,
    `    var f = div.querySelector("iframe");`,
    `    if (f) f.style.height = h + "px";`,
    `  });`,
    `  if (document.readyState === "loading") {`,
    `    document.addEventListener("DOMContentLoaded", init);`,
    `  } else {`,
    `    init();`,
    `  }`,
    `})();`,
  ].join("\n");
}

/**
 * Resize-helper script that the embedded /forms/[id]/embed page injects to
 * notify the parent window of layout changes. Pure string for testability.
 */
export function buildEmbedResizeJs(formId: string, parentOrigin: string): string {
  const id = JSON.stringify(formId);
  const origin = JSON.stringify(parentOrigin);
  return [
    `(function () {`,
    `  var ID = ${id};`,
    `  var TARGET = ${origin};`,
    `  function send() {`,
    `    var h = Math.max(`,
    `      document.documentElement.scrollHeight,`,
    `      document.body ? document.body.scrollHeight : 0`,
    `    );`,
    `    parent.postMessage({ type: "zc-form-resize", id: ID, height: h }, TARGET);`,
    `  }`,
    `  if (typeof ResizeObserver !== "undefined") {`,
    `    new ResizeObserver(send).observe(document.documentElement);`,
    `  } else {`,
    `    window.addEventListener("load", send);`,
    `    window.addEventListener("resize", send);`,
    `  }`,
    `})();`,
  ].join("\n");
}
