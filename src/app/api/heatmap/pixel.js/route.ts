import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/heatmap/pixel.js?key=<trackerKey>
 *
 * Returns a small client-side tracker that:
 *   - Captures pageviews on load + history change
 *   - Samples clicks (recording xPercent/yPercent + selector)
 *   - Throttle-records scroll-depth percentages
 * Posts events as a single JSON beacon every ~3s to /api/heatmap/track.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const keyFromQuery = url.searchParams.get("key") ?? "";
  const safeKey = JSON.stringify(keyFromQuery.replace(/[^a-zA-Z0-9_-]/g, ""));
  const safeOrigin = JSON.stringify(url.origin);

  const script = `(function(){
  if (window.__omniHeatLoaded) return;
  window.__omniHeatLoaded = true;
  var KEY = ${safeKey};
  var ORIGIN = ${safeOrigin};
  if (!KEY) { console.warn("[omni-heat] missing key"); return; }

  var queue = [];
  var maxScroll = 0;
  var lastPath = location.pathname;

  function selectorFor(el){
    if (!el || !el.tagName) return null;
    if (el.id) return "#" + el.id;
    var n = el.tagName.toLowerCase();
    if (el.className && typeof el.className === "string") {
      n += "." + el.className.trim().split(/\\s+/).slice(0,2).join(".");
    }
    return n.slice(0, 200);
  }

  function flush(useBeacon){
    if (queue.length === 0) return;
    var payload = {
      key: KEY,
      path: location.pathname,
      events: queue,
      viewport: window.innerWidth,
    };
    queue = [];
    var url = ORIGIN + "/api/heatmap/track";
    var body = JSON.stringify(payload);
    if (useBeacon && navigator.sendBeacon) {
      try {
        var blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(url, blob);
        return;
      } catch (_e) { /* fall through */ }
    }
    try {
      fetch(url, { method: "POST", body: body, headers: { "Content-Type": "application/json" }, keepalive: true });
    } catch (_e) { /* ignore */ }
  }

  function onClick(e){
    var t = e.target;
    if (!t) return;
    var rect = document.documentElement.getBoundingClientRect();
    var x = (e.clientX / Math.max(1, window.innerWidth)) * 100;
    var y = ((e.clientY - rect.top) / Math.max(1, document.documentElement.scrollHeight)) * 100;
    queue.push({ kind: "CLICK", x: round(x), y: round(y), sel: selectorFor(t) });
  }

  function onScroll(){
    var h = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    var pct = (window.scrollY / h) * 100;
    if (pct > maxScroll + 5) {
      maxScroll = pct;
      queue.push({ kind: "SCROLL", x: 0, y: round(pct) });
    }
  }

  function round(n){ return Math.round(n * 100) / 100; }

  function pageview(){
    queue.push({ kind: "MOVE", x: 0, y: 0, sel: "pageview" });
    flush(false);
  }

  document.addEventListener("click", onClick, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  setInterval(function(){ flush(false); }, 3000);
  window.addEventListener("beforeunload", function(){ flush(true); });
  window.addEventListener("popstate", function(){
    if (location.pathname !== lastPath) { lastPath = location.pathname; pageview(); }
  });
  pageview();
})();`;

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
