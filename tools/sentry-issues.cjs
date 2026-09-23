/**
 * One GitHub issue per unresolved Sentry issue, carrying what it takes to study
 * it without opening Sentry.
 *
 *   node tools/sentry-issues.cjs              opens the missing ones
 *   node tools/sentry-issues.cjs --refresh    also rewrites the existing ones
 *   node tools/sentry-issues.cjs --dry-run    prints the bodies, touches nothing
 *
 * Run by `.github/workflows/sentry-issues.yml`, which explains why this polls
 * rather than using Sentry's own integration. Needs `SENTRY_API_TOKEN` (a
 * personal token with `project:read` and `event:read`) and, unless dry, a `gh`
 * that can write issues.
 *
 * A Sentry link alone is useless to whoever reads the issue without a Sentry
 * login, which includes any agent asked to look at it. So the body carries the
 * latest event: the exception, the stack with the app's own frames first, the
 * `screen` context `reportGeometry` sets, the `extra` `report` passes, the
 * tags and the last breadcrumbs. One event, not all of them: the tags say
 * enough about how widespread it is, and Sentry has the rest.
 */
const { execFileSync } = require("child_process");

const TOKEN = process.env.SENTRY_API_TOKEN;
const ORG = process.env.SENTRY_ORG || "moox";
const PROJECT = process.env.SENTRY_PROJECT || "hide-the-notch";
const REFRESH = process.argv.includes("--refresh");
const DRY = process.argv.includes("--dry-run");

const LABEL = "sentry";
// GitHub refuses a body over 65536 characters.
const MAX_BODY = 60000;
const MAX_BREADCRUMBS = 20;

async function sentry(path) {
  const res = await fetch(`https://sentry.io/api/0/${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Sentry ${res.status} on ${path}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

function gh(args, input) {
  return execFileSync("gh", args, { input, encoding: "utf8" });
}

// --- markdown ---------------------------------------------------------------

const cell = (v) =>
  String(v ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .slice(0, 300);

function table(rows) {
  const kept = rows.filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!kept.length) return "";
  return ["| | |", "| --- | --- |", ...kept.map(([k, v]) => `| ${cell(k)} | ${cell(v)} |`)].join(
    "\n",
  );
}

function details(summary, content) {
  return content ? `<details><summary>${summary}</summary>\n\n${content}\n\n</details>` : "";
}

function fence(content, lang = "") {
  const ticks = content.includes("```") ? "````" : "```";
  return `${ticks}${lang}\n${content}\n${ticks}`;
}

const json = (v) => fence(JSON.stringify(v, null, 2), "json");

// --- event ------------------------------------------------------------------

const entry = (event, type) => (event.entries || []).find((e) => e.type === type)?.data;

function where(frame) {
  const file = frame.filename || frame.absPath || frame.module || "?";
  const pos = [frame.lineNo, frame.colNo].filter((n) => n != null).join(":");
  return `${file}${pos ? `:${pos}` : ""}`;
}

function frameLine(frame) {
  return `${frame.function || "<anonymous>"} at ${where(frame)}`;
}

function frameWithCode(frame) {
  const head = `**\`${frameLine(frame)}\`**`;
  if (!frame.context?.length) return head;
  const width = String(frame.context[frame.context.length - 1][0]).length;
  const code = frame.context
    .map(([n, line]) => `${n === frame.lineNo ? ">" : " "} ${String(n).padStart(width)} ${line}`)
    .join("\n");
  return `${head}\n\n${fence(code)}`;
}

/** Most recent call first, the app's frames shown with their code. */
function stack(stacktrace) {
  const frames = [...(stacktrace?.frames || [])].reverse();
  if (!frames.length) return "";
  const own = frames.filter((f) => f.inApp);
  const shown = own.length ? own : frames.slice(0, 10);
  const rest = frames.filter((f) => !shown.includes(f));
  return [
    shown.map(frameWithCode).join("\n\n"),
    details(
      `${rest.length} more frame${rest.length === 1 ? "" : "s"}`,
      rest.length ? fence(rest.map(frameLine).join("\n")) : "",
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function exceptions(event) {
  const values = entry(event, "exception")?.values || [];
  // Sentry lists a chain cause first; the one that was thrown comes last.
  const parts = [...values].reverse().map((v) => {
    const mech = v.mechanism
      ? ` (${v.mechanism.type}, ${v.mechanism.handled === false ? "unhandled" : "handled"})`
      : "";
    return [`### ${v.type || "Error"}${mech}`, fence(String(v.value ?? "")), stack(v.stacktrace)]
      .filter(Boolean)
      .join("\n\n");
  });
  if (parts.length) return parts.join("\n\n");

  // Hangs and native crashes carry their stack on a thread instead.
  const threads = entry(event, "threads")?.values || [];
  const thread = threads.find((t) => t.crashed) || threads.find((t) => t.current) || threads[0];
  if (thread?.stacktrace) {
    return `### Thread ${thread.name || thread.id}${thread.crashed ? " (crashed)" : ""}\n\n${stack(thread.stacktrace)}`;
  }
  return "";
}

function breadcrumbs(event) {
  const values = (entry(event, "breadcrumbs")?.values || []).slice(-MAX_BREADCRUMBS);
  if (!values.length) return "";
  const rows = values.map((b) =>
    [b.timestamp, b.category, b.level, b.message || (b.data ? JSON.stringify(b.data) : "")]
      .map(cell)
      .join(" | "),
  );
  return details(
    `Last ${values.length} breadcrumb${values.length === 1 ? "" : "s"}`,
    [
      "| Time | Category | Level | Message |",
      "| --- | --- | --- | --- |",
      ...rows.map((r) => `| ${r} |`),
    ].join("\n"),
  );
}

// --- body -------------------------------------------------------------------

function body(issue, event) {
  const tags = Object.fromEntries((event?.tags || []).map((t) => [t.key, t.value]));
  const contexts = event?.contexts || {};
  const { screen, ...otherContexts } = contexts;
  const extra = event?.context && Object.keys(event.context).length ? event.context : null;
  const message = entry(event || {}, "message");

  const sections = [
    `**Sentry:** [${issue.shortId}](${issue.permalink})`,
    table([
      ["Level", issue.level],
      ["Where", issue.culprit && `\`${issue.culprit.replace(/`/g, "'")}\``],
      ["Tag `where`", tags.where],
      ["Release", tags.release],
      ["Events", issue.count],
      ["Users", issue.userCount],
      ["First seen", issue.firstSeen],
      ["Last seen", issue.lastSeen],
    ]),
  ];

  if (!event) {
    sections.push("_The latest event could not be fetched; see Sentry._");
  } else {
    sections.push(
      `## Latest event\n\n[${event.eventID}](${issue.permalink}events/${event.eventID}/), ${event.dateCreated}`,
    );
    if (message?.formatted) sections.push(fence(message.formatted));
    const exc = exceptions(event);
    if (exc) sections.push(exc);
    if (screen) {
      const { type: _type, ...rest } = screen;
      sections.push(`## Screen\n\n${table(Object.entries(rest))}`);
    }
    if (extra) sections.push(`## Extra\n\n${json(extra)}`);
    sections.push(`## Tags\n\n${table(Object.entries(tags))}`);
    if (Object.keys(otherContexts).length) sections.push(details("Contexts", json(otherContexts)));
    const crumbs = breadcrumbs(event);
    if (crumbs) sections.push(crumbs);
  }

  sections.push(
    `---\nOpened by \`tools/sentry-issues.cjs\`. Resolve it in Sentry, or with \`Fixes ${issue.shortId}\` in a commit message.`,
  );

  const text = sections.filter(Boolean).join("\n\n");
  return text.length > MAX_BODY
    ? `${text.slice(0, MAX_BODY)}\n\n_Truncated, the rest is in Sentry._`
    : text;
}

// --- sync -------------------------------------------------------------------

async function main() {
  if (!TOKEN) {
    // A warning rather than a failure: the workflow runs every day, and a red
    // run every day is a mail every day.
    console.log("::warning::SENTRY_API_TOKEN is not set, nothing to do.");
    return;
  }

  const issues = await sentry(`projects/${ORG}/${PROJECT}/issues/?query=is:unresolved&limit=100`);

  const known = new Map();
  if (!DRY) {
    gh([
      "label",
      "create",
      LABEL,
      "--color",
      "362d59",
      "--description",
      "Opened from a Sentry issue",
      "--force",
    ]);
    const listed = JSON.parse(
      gh([
        "issue",
        "list",
        "--label",
        LABEL,
        "--state",
        "all",
        "--limit",
        "1000",
        "--json",
        "number,title",
      ]),
    );
    for (const { number, title } of listed) {
      const id = title.match(/^\[([A-Z0-9-]+)\]/)?.[1];
      if (id) known.set(id, number);
    }
  }

  for (const issue of issues) {
    const number = known.get(issue.shortId);
    if (number && !REFRESH) continue;

    let event = null;
    try {
      event = await sentry(`organizations/${ORG}/issues/${issue.id}/events/latest/`);
    } catch (err) {
      console.log(`::warning::${issue.shortId}: ${err.message}`);
    }
    const text = body(issue, event);

    if (DRY) {
      console.log(`\n===== ${issue.shortId}${number ? ` (#${number})` : ""}\n\n${text}`);
    } else if (number) {
      gh(["issue", "edit", String(number), "--body-file", "-"], text);
      console.log(`${issue.shortId}: refreshed #${number}`);
    } else {
      const title = `[${issue.shortId}] ${issue.title}`.slice(0, 250);
      const url = gh(
        ["issue", "create", "--label", LABEL, "--title", title, "--body-file", "-"],
        text,
      ).trim();
      console.log(`${issue.shortId}: opened ${url}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
