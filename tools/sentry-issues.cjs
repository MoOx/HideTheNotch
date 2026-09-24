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

const tagsOf = (event) => Object.fromEntries((event?.tags || []).map((t) => [t.key, t.value]));

function summary(issue, event) {
  const tags = tagsOf(event);
  return table([
    ["Level", issue.level],
    ["Where", issue.culprit && `\`${issue.culprit.replace(/`/g, "'")}\``],
    ["Tag `where`", tags.where],
    ["Release", tags.release],
    ["Events", issue.count],
    ["Users", issue.userCount],
    ["First seen", issue.firstSeen],
    ["Last seen", issue.lastSeen],
  ]);
}

function latest(issue, event) {
  if (!event) return ["_The latest event could not be fetched; see Sentry._"];
  const tags = tagsOf(event);
  const { screen, ...otherContexts } = event.contexts || {};
  const extra = event.context && Object.keys(event.context).length ? event.context : null;
  const message = entry(event, "message");

  const sections = [
    `## Latest event\n\n[${event.eventID}](${issue.permalink}events/${event.eventID}/), ${event.dateCreated}`,
  ];
  if (message?.formatted) sections.push(fence(message.formatted));
  sections.push(exceptions(event));
  if (screen) {
    const { type: _type, ...rest } = screen;
    sections.push(`## Screen\n\n${table(Object.entries(rest))}`);
  }
  if (extra) sections.push(`## Extra\n\n${json(extra)}`);
  sections.push(`## Tags\n\n${table(Object.entries(tags))}`);
  if (Object.keys(otherContexts).length) sections.push(details("Contexts", json(otherContexts)));
  sections.push(breadcrumbs(event));
  return sections;
}

function cap(sections) {
  const text = sections.filter(Boolean).join("\n\n");
  return text.length > MAX_BODY
    ? `${text.slice(0, MAX_BODY)}\n\n_Truncated, the rest is in Sentry._`
    : text;
}

function body(issue, event) {
  return cap([
    `**Sentry:** [${issue.shortId}](${issue.permalink})`,
    summary(issue, event),
    ...latest(issue, event),
    `---\nOpened by \`tools/sentry-issues.cjs\`. Once fixed, close it here and resolve it in Sentry. If it comes back, it is reopened here with a comment.`,
  ]);
}

/** Posted when a closed issue comes back, so the thread keeps its history. */
function comment(issue, event) {
  return cap([
    `**Back in Sentry**, last seen ${issue.lastSeen}.`,
    summary(issue, event),
    ...latest(issue, event),
  ]);
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
        "number,title,state,closedAt",
      ]),
    );
    for (const gi of listed) {
      const id = gi.title.match(/^\[([A-Z0-9-]+)\]/)?.[1];
      if (id) known.set(id, gi);
    }
  }

  for (const issue of issues) {
    const gi = known.get(issue.shortId);
    // Closed here but unresolved in Sentry, with an event after the closing:
    // it came back. Closed with nothing since means it was closed here and not
    // yet resolved in Sentry, which is not news.
    const back = gi?.state === "CLOSED" && new Date(issue.lastSeen) > new Date(gi.closedAt ?? 0);
    if (gi && !back && !REFRESH) continue;

    let event = null;
    try {
      event = await sentry(`organizations/${ORG}/issues/${issue.id}/events/latest/`);
    } catch (err) {
      console.log(`::warning::${issue.shortId}: ${err.message}`);
    }

    if (DRY) {
      const text = back ? comment(issue, event) : body(issue, event);
      console.log(`\n===== ${issue.shortId}${gi ? ` (#${gi.number})` : ""}\n\n${text}`);
    } else if (back) {
      gh(["issue", "reopen", String(gi.number)]);
      gh(["issue", "comment", String(gi.number), "--body-file", "-"], comment(issue, event));
      console.log(`${issue.shortId}: back, reopened #${gi.number}`);
    } else if (gi) {
      gh(["issue", "edit", String(gi.number), "--body-file", "-"], body(issue, event));
      console.log(`${issue.shortId}: refreshed #${gi.number}`);
    } else {
      const title = `[${issue.shortId}] ${issue.title}`.slice(0, 250);
      const url = gh(
        ["issue", "create", "--label", LABEL, "--title", title, "--body-file", "-"],
        body(issue, event),
      ).trim();
      console.log(`${issue.shortId}: opened ${url}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
