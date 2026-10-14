// ==UserScript==
// @name         GitHub Account Switcher
// @namespace    https://github.com/mxttbennett
// @version      1.0.0
// @description  Automatically switches GitHub accounts based on configurable URL rules
// @match        https://github.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @noframes
// ==/UserScript==

(async () => {
  const COOLDOWN_MS = 5000;
  const SWITCH_ATTEMPT_TTL_MS = 60000;
  const DEFAULT_SETTINGS = {
    defaultAccount: "mxttbennett",
    rules: [
      { type: "org", value: "EnterBridge-Technologies", account: "mattbennett-ebt" },
      { type: "regex", value: "mxttbennett", account: "mxttbennett" },
      { type: "regex", value: "mattbennett-ebt", account: "mattbennett-ebt" },
    ],
  };
  const RULE_TYPES = ["org", "page_id", "path_prefix", "regex"];
  const AUTH_SEGMENTS = new Set([
    "login", "logout", "signup", "sessions", "password_reset",
    "account_verifications", "users",
  ]);
  const SYSTEM_PATHS = new Set([
    "settings", "notifications", "dashboard", "pulls", "issues",
    "explore", "trending", "new", "login", "logout", "signup",
    "features", "marketplace", "sponsors", "codespaces", "copilot",
    "stars", "watching", "collections", "topics", "events",
    "account", "sessions", "password_reset", "enterprises",
    "organizations", "apps", "pages",
  ]);

  let lastSwitchTime = 0;

  const loadSettings = () => ({
    rules: GM_getValue("rules", DEFAULT_SETTINGS.rules),
    defaultAccount: GM_getValue("defaultAccount", DEFAULT_SETTINGS.defaultAccount),
  });

  const meta = (name) =>
    document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ?? null;

  const githubHeaders = (nonce) => ({
    accept: "application/json",
    "x-requested-with": "XMLHttpRequest",
    "github-verified-fetch": "true",
    "x-fetch-nonce": nonce,
  });

  async function fetchStashedAccounts() {
    const nonce = meta("fetch-nonce");
    if (!nonce) return [];
    const res = await fetch("https://github.com/_side-panels/user.json", {
      headers: githubHeaders(nonce),
      credentials: "same-origin",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.stashedAccounts || [];
  }

  async function switchToSession(sessionId) {
    const nonce = meta("fetch-nonce");
    if (!nonce) return false;
    const body = new FormData();
    body.append("user_session_id", String(sessionId));
    body.append("from", "nav_panel");
    const res = await fetch("https://github.com/switch_account", {
      method: "POST",
      headers: githubHeaders(nonce),
      body,
      credentials: "same-origin",
    });
    return res.ok;
  }

  function isAuthFlow(url) {
    const segments = url.pathname.split("/").filter(Boolean);
    return (
      AUTH_SEGMENTS.has(segments[0]) ||
      /^\/orgs\/[^/]+\/sso(?:\/|$)/.test(url.pathname) ||
      /^\/enterprises\/[^/]+\/sso(?:\/|$)/.test(url.pathname)
    );
  }

  function matchRule(rule, url) {
    const path = url.pathname;
    switch (rule.type) {
      case "org": {
        const first = path.split("/").filter(Boolean)[0];
        const orgs = path.match(/^\/orgs\/([^/]+)/);
        return first === rule.value || (orgs && orgs[1] === rule.value);
      }
      case "page_id":
        return url.searchParams.get("page_id") === rule.value;
      case "path_prefix":
        return path.startsWith(rule.value);
      case "regex":
        try {
          return new RegExp(rule.value).test(url.href);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  function targetAccountFor(url) {
    if (isAuthFlow(url)) return null;
    const { rules, defaultAccount } = loadSettings();
    const rule = rules.find((r) => matchRule(r, url));
    if (rule) return rule.account;
    const first = url.pathname.split("/").filter(Boolean)[0];
    if (!first || SYSTEM_PATHS.has(first)) return null;
    return defaultAccount;
  }

  // Per-tab so a tab that gave up does not block a retry in another tab.
  const attemptKey = (url, account) => `${account}:${url.pathname}${url.search}`;

  function readAttempts() {
    try {
      return JSON.parse(sessionStorage.getItem("ghSwitcherAttempts")) || {};
    } catch {
      return {};
    }
  }

  function hasRecentAttempt(url, account) {
    const at = readAttempts()[attemptKey(url, account)];
    return typeof at === "number" && Date.now() - at < SWITCH_ATTEMPT_TTL_MS;
  }

  function markAttempt(url, account) {
    const now = Date.now();
    const kept = Object.fromEntries(
      Object.entries(readAttempts()).filter(([, t]) => now - t < SWITCH_ATTEMPT_TTL_MS)
    );
    kept[attemptKey(url, account)] = now;
    sessionStorage.setItem("ghSwitcherAttempts", JSON.stringify(kept));
  }

  async function checkAndSwitch() {
    if (Date.now() - lastSwitchTime < COOLDOWN_MS) return;
    const current = meta("user-login");
    if (!current) return;

    const url = new URL(location.href);
    const target = targetAccountFor(url);
    if (!target || target === current) return;

    if (hasRecentAttempt(url, target)) {
      console.warn(`[GH Switcher] Already tried "${target}" for this URL; skipping to avoid a redirect loop.`);
      return;
    }

    console.log(`[GH Switcher] Have "${current}", need "${target}". Switching...`);
    lastSwitchTime = Date.now();
    markAttempt(url, target);

    const account = (await fetchStashedAccounts()).find((a) => a.login === target);
    if (!account) {
      console.error(`[GH Switcher] "${target}" is not a stashed account`);
      return;
    }
    if (await switchToSession(account.userSessionId)) location.reload();
  }

  function openSettings() {
    if (document.getElementById("gh-switcher-settings")) return;
    const { rules, defaultAccount } = loadSettings();

    const host = document.createElement("div");
    host.id = "gh-switcher-settings";
    host.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { all: initial }
        .card { font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fff; color: #1f2328; border: 1px solid #d1d9e0; border-radius: 8px; padding: 24px; width: min(680px, 92vw); max-height: 85vh; overflow: auto }
        @media (prefers-color-scheme: dark) { .card { background: #0d1117; color: #e6edf3; border-color: #30363d } input, select { background: #0d1117 !important; color: #e6edf3 !important; border-color: #30363d !important } }
        h1 { font-size: 20px; margin: 0 0 16px }
        label { display: block; font-size: 12px; color: #656d76; margin: 12px 0 4px }
        input, select { font: inherit; padding: 6px 10px; border: 1px solid #d1d9e0; border-radius: 6px; width: 100%; box-sizing: border-box; background: #fff; color: #1f2328 }
        .row { display: grid; grid-template-columns: 130px 1fr 1fr 32px; gap: 8px; margin-bottom: 8px }
        button { font: inherit; padding: 6px 14px; border: 1px solid #d1d9e0; border-radius: 6px; cursor: pointer; background: transparent; color: inherit }
        button.primary { background: #1a7f37; border-color: #1a7f37; color: #fff }
        .actions { display: flex; gap: 8px; margin-top: 16px }
      </style>
      <div class="card" role="dialog" aria-label="GitHub Account Switcher settings">
        <h1>GitHub Account Switcher</h1>
        <label>Default account (fallback when no rule matches)</label>
        <input id="default" autocomplete="off">
        <label>Rules (first match wins)</label>
        <div id="rules"></div>
        <div class="actions">
          <button id="add">Add rule</button>
          <button id="save" class="primary">Save</button>
          <button id="cancel">Cancel</button>
        </div>
      </div>`;

    const rulesEl = root.getElementById("rules");
    const addRow = (rule) => {
      const row = document.createElement("div");
      row.className = "row";
      const select = document.createElement("select");
      for (const t of RULE_TYPES) select.add(new Option(t, t, false, t === rule.type));
      const value = Object.assign(document.createElement("input"), { value: rule.value || "", placeholder: "Match value" });
      const account = Object.assign(document.createElement("input"), { value: rule.account || "", placeholder: "Account login" });
      const del = Object.assign(document.createElement("button"), { textContent: "×", ariaLabel: "Delete rule" });
      del.onclick = () => row.remove();
      row.append(select, value, account, del);
      rulesEl.append(row);
    };

    root.getElementById("default").value = defaultAccount || "";
    rules.forEach(addRow);
    root.getElementById("add").onclick = () => addRow({ type: "org" });
    root.getElementById("cancel").onclick = () => host.remove();
    host.addEventListener("keydown", (e) => e.key === "Escape" && host.remove());
    root.getElementById("save").onclick = () => {
      const next = [...rulesEl.children].map((row) => {
        const [select, value, account] = row.querySelectorAll("select, input");
        return { type: select.value, value: value.value, account: account.value.trim() };
      });
      GM_setValue("rules", next.filter((r) => r.value && r.account));
      GM_setValue("defaultAccount", root.getElementById("default").value.trim() || null);
      host.remove();
    };
    document.body.append(host);
  }

  GM_registerMenuCommand("Settings…", openSettings);

  const current = meta("user-login");
  if (current) {
    fetchStashedAccounts()
      .then((stashed) => {
        for (const a of stashed) {
          GM_registerMenuCommand(`Switch to ${a.login}`, async () => {
            if (await switchToSession(a.userSessionId)) location.reload();
          });
        }
      })
      .catch(() => {});
  }

  await checkAndSwitch();

  document.addEventListener("turbo:render", checkAndSwitch);
  document.addEventListener("turbo:load", checkAndSwitch);

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      checkAndSwitch();
    }
  }).observe(document.head, { childList: true, subtree: true });
})();
