/**
 * The deck, live, in a browser.
 *
 * `compose.cjs` already produces one complete HTML document per slot and only
 * hands it to headless Chromium at the very end. So a preview is not a second
 * renderer: it is that same document, served instead of photographed. Anything
 * that differed between the two would be a lie, and a workbench that lies is
 * worse than no workbench, which is why the only difference is where the
 * pictures come from (a URL here, a data URI there) and it lives in one
 * function over in the compositor.
 *
 *   npm run marketing:serve            then open http://localhost:4321
 *   npm run marketing:serve -- --port 5000
 *
 * The page reloads itself when a spec, a capture, a font or the compositor
 * changes. Nothing is rendered until it is looked at, so a change costs a
 * reload rather than the five minutes a full deck takes.
 */
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const { readSpec, slotName, applyDevice, page, render, deckFont, ROOT } = require("./compose.cjs");
const { LIMITS, PLAY_LOCALE } = require("./listing.cjs");
const { check } = require("./fingerprint.cjs");

const DECKS = {
  "app-store": "marketing/shots.json",
  play: "marketing/shots-play.json",
};

/** What the page watches, and what a change to it means: reload everything. */
const WATCHED = [
  "marketing/shots.json",
  "marketing/shots-play.json",
  "marketing/listing.json",
  "marketing/captures",
  "marketing/fonts",
  "tools/marketing/compose.cjs",
];

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const PORT = Number(arg("port", 4321));

// --- the pieces of a deck ---------------------------------------------------

/**
 * A spec, read fresh on every request.
 *
 * Deliberately not cached: the whole point is that editing the file and
 * reloading shows the edit. A spec is a few kilobytes of JSON.
 */
function deckOf(name, locale) {
  const spec = readSpec(DECKS[name]);
  applyDevice(spec.spec.device);
  const first = Object.keys(spec.spec.locales)[0];
  const wanted = spec.spec.locales[locale] ? locale : first;
  return { name, locale: wanted, spec: spec.spec, ...spec.shots(wanted) };
}

/** Served assets, the one thing a page in a browser does differently. */
const served = (abs) => `/file/${path.relative(ROOT, abs).split(path.sep).join("/")}`;

/**
 * One slot's document.
 *
 * `asset` is the whole difference between the two things this server does. The
 * page in the browser gets URLs, because inlining four megabytes per reload
 * would make this slower than the thing it replaces. The page that gets
 * photographed gets nothing here and falls back to the compositor's own
 * inlining, because a headless render is a single navigation off a temporary
 * file with no server behind it: a `/file/...` URL there resolves against the
 * filesystem root and the shot comes out black. Which it did, once.
 */
function shotPage(name, locale, id, asset) {
  const d = deckOf(name, locale);
  const shot = d.shots.find((s) => s.id === id);
  if (!shot) {
    throw new Error(`no shot "${id}" in ${name}`);
  }
  return page(shot, d.deck, deckFont(), asset);
}

// --- the index --------------------------------------------------------------

const esc = (s) => String(s).replace(/</g, "&lt;");

/**
 * Every slot of every deck, at a size that fits on a screen.
 *
 * Each slot is an iframe of exactly the store's pixels, scaled down by a CSS
 * transform. A transform does not reflow, so what is on screen is the layout
 * that gets photographed rather than a narrower one that happens to look fine.
 */
function index(locale) {
  const decks = Object.keys(DECKS).map((name) => {
    const d = deckOf(name, locale);
    const w = d.spec.device?.shot?.w ?? 1320;
    const h = d.spec.device?.shot?.h ?? 2868;
    const k = 300 / w;
    const cells = d.shots
      .map(
        (shot, i) => `
      <figure class="cell">
        <div class="frame" style="width:${w * k}px;height:${h * k}px">
          <iframe src="/shot/${name}/${d.locale}/${shot.id}" width="${w}" height="${h}"
                  style="transform:scale(${k})" scrolling="no" loading="lazy"></iframe>
        </div>
        <figcaption>
          <b>${esc(slotName(d.spec, shot, i))}</b>
          <button onclick="shoot(this,'${name}','${d.locale}','${shot.id}')">Shoot this one</button>
        </figcaption>
      </figure>`,
      )
      .join("");
    return `<section><h2>${name} <small>${d.locale}, ${w} x ${h}</small></h2>
      <div class="row">${cells}</div></section>`;
  });

  const locales = Object.keys(readSpec(DECKS["app-store"]).spec.locales)
    .map((l) => `<a href="/?locale=${l}" class="${l === locale ? "on" : ""}">${l}</a>`)
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Deck</title><style>
  body { margin: 0; padding: 24px; background: #0b0c10; color: #e8e9ee;
         font: 14px -apple-system, "Segoe UI", sans-serif; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h2 { font-size: 14px; font-weight: 600; margin: 28px 0 10px; text-transform: uppercase;
       letter-spacing: 0.08em; opacity: 0.7; }
  small { text-transform: none; letter-spacing: 0; opacity: 0.7; font-weight: 400; }
  nav { display: flex; gap: 8px; margin-bottom: 8px; }
  nav a { color: #9aa0b4; text-decoration: none; padding: 3px 9px; border-radius: 999px;
          background: #16181f; }
  nav a.on { background: #2b6cf6; color: #fff; }
  .row { display: flex; gap: 16px; flex-wrap: wrap; }
  .cell { margin: 0; }
  .frame { position: relative; overflow: hidden; border-radius: 12px; background: #000; }
  iframe { position: absolute; top: 0; left: 0; border: 0; transform-origin: top left; }
  figcaption { display: flex; align-items: center; gap: 8px; margin-top: 6px;
               font-size: 11px; color: #9aa0b4; }
  button { font: inherit; color: #e8e9ee; background: #22252e; border: 0; border-radius: 6px;
           padding: 3px 8px; cursor: pointer; }
  .note { opacity: 0.6; font-size: 12px; margin-top: 4px; }
</style></head><body>
  <h1>Hide The Notch, the deck</h1>
  <div class="note">Edit a spec or retake a capture and this page reloads itself.
    "Shoot this one" runs the real headless render and puts the PNG in the frame.
    <a href="/listing" style="color:#7aa2f7">The store texts, in every language</a>.</div>
  <nav>${locales}</nav>
  ${decks.join("")}
<script>
  new EventSource("/events").onmessage = () => location.reload();
  async function shoot(button, deck, locale, id) {
    button.textContent = "shooting…";
    const frame = button.closest(".cell").querySelector(".frame");
    const res = await fetch("/render/" + deck + "/" + locale + "/" + id);
    if (!res.ok) { button.textContent = "failed"; return; }
    const url = URL.createObjectURL(await res.blob());
    frame.innerHTML = '<img src="' + url + '" style="width:100%;height:100%">';
    button.textContent = "shot";
  }
</script>
</body></html>`;
}

/**
 * Every store text, in every language, against the limit it has to fit.
 *
 * The copy lives in one file and is written out to two folder trees nobody
 * reads for pleasure, so this is where it gets looked at: one column per
 * language, one row per field, with the count next to each and anything over
 * the limit in red. `npm run store:listing` refuses to write an over-length string,
 * but finding out here beats finding out there.
 */
function listing() {
  const spec = JSON.parse(fs.readFileSync(path.join(ROOT, "marketing/listing.json"), "utf8"));
  const locales = Object.keys(spec.locales);

  const rows = Object.entries(LIMITS)
    .map(([field, [limit, what]]) => {
      const cells = locales
        .map((l) => {
          const value = spec.locales[l][field] ?? "";
          const n = [...value].length;
          const over = n > limit;
          return `<td class="${over ? "over" : ""}">
            <div class="count">${n} / ${limit}</div>
            <div class="copy">${esc(value)}</div>
          </td>`;
        })
        .join("");
      return `<tr><th><b>${field}</b><small>${esc(what)}</small></th>${cells}</tr>`;
    })
    .join("");

  const heads = locales
    .map((l) => `<th>${l}<small>Play: ${PLAY_LOCALE[l] ?? "?"}</small></th>`)
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Listing</title><style>
  body { margin: 0; padding: 24px; background: #0b0c10; color: #e8e9ee;
         font: 13px -apple-system, "Segoe UI", sans-serif; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .note { opacity: 0.6; font-size: 12px; margin-bottom: 16px; }
  a { color: #7aa2f7; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  th, td { border: 1px solid #22252e; padding: 8px 10px; vertical-align: top; text-align: left; }
  thead th { position: sticky; top: 0; background: #12141a; z-index: 1; }
  tbody th { width: 150px; background: #12141a; }
  th small, td .count { display: block; font-weight: 400; opacity: 0.55; font-size: 11px;
                        margin-top: 2px; }
  .copy { white-space: pre-wrap; margin-top: 6px; line-height: 1.45; }
  td.over { background: #2a1216; }
  td.over .count { color: #ff8080; opacity: 1; font-weight: 600; }
</style></head><body>
  <h1>The store listing</h1>
  <div class="note">One source, <code>marketing/listing.json</code>, both stores.
    <a href="/">Back to the deck</a>. This page reloads itself when that file changes.</div>
  <table><thead><tr><th></th>${heads}</tr></thead><tbody>${rows}</tbody></table>
<script>new EventSource("/events").onmessage = () => location.reload();</script>
</body></html>`;
}

// --- the server -------------------------------------------------------------

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".json": "application/json",
};

/** Everyone currently looking, so a change can tell all of them. */
const watchers = new Set();

function fail(res, e) {
  if (res.headersSent) {
    return res.end();
  }
  res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
  res.end(`<body style="background:#0b0c10;color:#ff8080;font:14px monospace;padding:24px">
    <pre>${esc(e.stack || e.message)}</pre></body>`);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);

  try {
    // Every body is built before a header is written: a page that throws
    // halfway would otherwise be a broken response with a 200 on it, and being
    // told what is missing is the entire point of throwing.
    if (url.pathname === "/") {
      const html = index(url.searchParams.get("locale") ?? "en-US");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(html);
    }

    if (url.pathname === "/listing") {
      const html = listing();
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(html);
    }

    if (parts[0] === "events") {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      res.write("retry: 500\n\n");
      watchers.add(res);
      req.on("close", () => watchers.delete(res));
      return undefined;
    }

    if (parts[0] === "shot" && parts.length === 4) {
      const html = shotPage(parts[1], parts[2], parts[3], served);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(html);
    }

    if (parts[0] === "render" && parts.length === 4) {
      const html = shotPage(parts[1], parts[2], parts[3]);
      const out = path.join(os.tmpdir(), `deck-${parts[3]}.png`);
      render(html, out);
      const png = fs.readFileSync(out);
      fs.rmSync(out, { force: true });
      res.writeHead(200, { "content-type": "image/png" });
      return res.end(png);
    }

    if (parts[0] === "file") {
      // Under the repository and nowhere else: a preview server is a server.
      const abs = path.join(ROOT, ...parts.slice(1));
      if (!abs.startsWith(ROOT + path.sep) || !fs.existsSync(abs)) {
        res.writeHead(404);
        return res.end("no");
      }
      res.writeHead(200, {
        "content-type": MIME[path.extname(abs)] ?? "application/octet-stream",
      });
      return res.end(fs.readFileSync(abs));
    }

    res.writeHead(404);
    return res.end("no");
  } catch (e) {
    return fail(res, e);
  }
});

// --- watching ---------------------------------------------------------------

let pending = null;
function changed() {
  // Editors write a file in several steps, and a capture run writes forty of
  // them. One reload after the dust settles, not one per write.
  clearTimeout(pending);
  pending = setTimeout(() => {
    for (const w of watchers) {
      w.write("data: changed\n\n");
    }
  }, 150);
}

for (const target of WATCHED) {
  const abs = path.join(ROOT, target);
  if (!fs.existsSync(abs)) {
    continue;
  }
  fs.watch(abs, { recursive: fs.statSync(abs).isDirectory() }, changed);
}

server.listen(PORT, () => {
  console.log(`\n  the deck   http://localhost:${PORT}\n`);
  check(true);
});
