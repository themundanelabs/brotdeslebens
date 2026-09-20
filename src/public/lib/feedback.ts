// "Angaben stimmen / Angaben falsch" feedback capture. Per explicit user
// direction: writes into a JSON file living in this GitHub repo via the
// Contents API, using a fine-grained PAT (Contents:write, this repo only)
// embedded in the public build. The user has accepted that this token is
// readable by anyone inspecting the site's JS bundle — do not widen its
// scope or reuse it elsewhere.
//
// Writes go to a dedicated branch (not main) so a vote never triggers the
// Pages deploy workflow, which only watches `main`.
//
// VITE_FEEDBACK_GH_TOKEN is not yet set anywhere — until the user creates
// the token and adds it to .env.public, submitFeedback() records the vote
// locally only and logs a warning instead of calling the GitHub API.

const TOKEN = import.meta.env.VITE_FEEDBACK_GH_TOKEN as string | undefined;
const REPO = "themundanelabs/brotdeslebens";
const BRANCH = "feedback-data";
const PATH = "feedback/votes.json";
const STORAGE_KEY = "bdl-accuracy-votes";

export type Vote = "accurate" | "false";

interface FeedbackEntry {
  eventId: number;
  vote: Vote;
  ts: string;
}

function b64EncodeUtf8(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64DecodeUtf8(b64: string): string {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
}

export function readLocalVotes(): Record<number, Vote> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}
function writeLocalVotes(v: Record<number, Vote>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
}

function ghHeaders(): HeadersInit {
  return { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" };
}

async function ensureBranch(): Promise<void> {
  const check = await fetch(`https://api.github.com/repos/${REPO}/git/ref/heads/${BRANCH}`, { headers: ghHeaders() });
  if (check.status === 200) return;
  const main = await fetch(`https://api.github.com/repos/${REPO}/git/ref/heads/main`, { headers: ghHeaders() });
  if (!main.ok) throw new Error(`could not resolve main branch: ${main.status}`);
  const { object } = await main.json();
  const create = await fetch(`https://api.github.com/repos/${REPO}/git/refs`, {
    method: "POST",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha: object.sha }),
  });
  // 422 = ref already exists (a concurrent vote created it first) — fine.
  if (!create.ok && create.status !== 422) throw new Error(`branch create failed: ${create.status}`);
}

async function appendEntry(entry: FeedbackEntry, attempt = 0): Promise<void> {
  const contentsUrl = `https://api.github.com/repos/${REPO}/contents/${PATH}`;
  const getRes = await fetch(`${contentsUrl}?ref=${BRANCH}`, { headers: ghHeaders() });

  let sha: string | undefined;
  let list: FeedbackEntry[] = [];
  if (getRes.status === 200) {
    const data = await getRes.json();
    sha = data.sha;
    list = JSON.parse(b64DecodeUtf8(data.content));
  } else if (getRes.status !== 404) {
    throw new Error(`GET votes.json failed: ${getRes.status}`);
  }

  list.push(entry);
  const putRes = await fetch(contentsUrl, {
    method: "PUT",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `feedback: event ${entry.eventId} -> ${entry.vote}`,
      content: b64EncodeUtf8(JSON.stringify(list, null, 2)),
      branch: BRANCH,
      sha,
    }),
  });
  if (putRes.status === 409 && attempt < 3) {
    // Someone else's vote landed between our GET and PUT — refetch and retry.
    return appendEntry(entry, attempt + 1);
  }
  if (!putRes.ok) throw new Error(`PUT votes.json failed: ${putRes.status}`);
}

/** Always records the vote locally (optimistic UI state); also submits to
 * the GitHub-hosted JSON store when a token is configured. Returns whether
 * the remote submission succeeded (false when no token is set yet, or on
 * network/API failure — the local vote still stands either way). */
export async function submitFeedback(eventId: number, vote: Vote): Promise<boolean> {
  const local = readLocalVotes();
  local[eventId] = vote;
  writeLocalVotes(local);

  if (!TOKEN) {
    console.warn(
      "[feedback] VITE_FEEDBACK_GH_TOKEN is not set — vote recorded locally only. " +
        "Create a fine-grained GitHub PAT (Contents: write, restricted to themundanelabs/brotdeslebens) " +
        "and add it to .env.public to enable real submission."
    );
    return false;
  }

  try {
    await ensureBranch();
    await appendEntry({ eventId, vote, ts: new Date().toISOString() });
    return true;
  } catch (err) {
    console.error("[feedback] submission failed", err);
    return false;
  }
}
