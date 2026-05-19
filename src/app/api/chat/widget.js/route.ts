import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/chat/widget.js?slug=<workspace-slug>&color=<hex>
 *
 * Returns a tiny self-contained launcher script that mounts a floating
 * "Chat with us" button. Clicking it opens an iframe pointing at
 * /chat/embed/<slug>. Designed to be embedded with a single <script src>.
 *
 * The slug is read from the script's own `src` query string so the host
 * page only needs:
 *   <script async src="https://your-app/api/chat/widget.js?slug=acme"></script>
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slugFromQuery = url.searchParams.get("slug") ?? "";
  const colorFromQuery = url.searchParams.get("color") ?? "#0F172A";

  const safeSlug = JSON.stringify(slugFromQuery.replace(/[^a-zA-Z0-9_-]/g, ""));
  const safeColor = JSON.stringify(
    /^#[0-9a-fA-F]{3,8}$/.test(colorFromQuery) ? colorFromQuery : "#0F172A",
  );
  const safeOrigin = JSON.stringify(url.origin);

  const script = `(function(){
  if (window.__omniChatLoaded) return;
  window.__omniChatLoaded = true;
  var ORIGIN = ${safeOrigin};
  var SLUG = ${safeSlug};
  var COLOR = ${safeColor};
  if (!SLUG) { console.warn("[omni-chat] missing slug"); return; }

  function ready(fn){
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function(){
    var btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", "Open chat");
    btn.style.cssText = [
      "position:fixed","right:20px","bottom:20px","z-index:2147483640",
      "width:56px","height:56px","border-radius:50%","border:0",
      "background:" + COLOR, "color:#fff","font-size:24px","cursor:pointer",
      "box-shadow:0 6px 24px rgba(0,0,0,.18)",
      "font-family:system-ui,-apple-system,Segoe UI,sans-serif"
    ].join(";");
    btn.textContent = "\\u{1F4AC}";

    var frameWrap = document.createElement("div");
    frameWrap.style.cssText = [
      "position:fixed","right:20px","bottom:88px","z-index:2147483641",
      "width:360px","height:520px","max-height:80vh","max-width:calc(100vw - 40px)",
      "border-radius:12px","overflow:hidden","display:none",
      "box-shadow:0 12px 32px rgba(0,0,0,.22)","background:#fff"
    ].join(";");

    var frame = document.createElement("iframe");
    frame.src = ORIGIN + "/chat/embed/" + encodeURIComponent(SLUG);
    frame.title = "Live chat";
    frame.style.cssText = "width:100%;height:100%;border:0";
    frame.allow = "clipboard-write";
    frameWrap.appendChild(frame);

    var open = false;
    function toggle(){
      open = !open;
      frameWrap.style.display = open ? "block" : "none";
      btn.textContent = open ? "\\u00D7" : "\\u{1F4AC}";
    }
    btn.addEventListener("click", toggle);
    document.body.appendChild(frameWrap);
    document.body.appendChild(btn);

    window.addEventListener("message", function(ev){
      if (ev.origin !== ORIGIN) return;
      if (ev.data && ev.data.type === "omni-chat:close") toggle();
    });
  });
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
