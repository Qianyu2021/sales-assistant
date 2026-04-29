const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TOKEN_PATH = path.resolve(dirname, "../.gmail-token.json");

function encodeState(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeState(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function decodeBase64Url(input = "") {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function findHeader(headers = [], name) {
  return headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

function collectText(parts = []) {
  let plain = "";
  let html = "";

  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      plain += `${decodeBase64Url(part.body.data)}\n`;
    } else if (part.mimeType === "text/html" && part.body?.data) {
      html += `${decodeBase64Url(part.body.data)}\n`;
    }

    if (Array.isArray(part.parts) && part.parts.length > 0) {
      const nested = collectText(part.parts);
      plain += nested.plain;
      html += nested.html;
    }
  }

  return { plain: plain.trim(), html: html.trim() };
}

function extractMessageBody(payload = {}) {
  if (payload.body?.data && payload.mimeType === "text/plain") {
    return { plain: decodeBase64Url(payload.body.data), html: "" };
  }

  if (payload.body?.data && payload.mimeType === "text/html") {
    return { plain: "", html: decodeBase64Url(payload.body.data) };
  }

  return collectText(payload.parts || []);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error_description || payload.error?.message || `Request failed with ${response.status}`);
  }

  return payload;
}

async function exchangeCodeForTokens(code, config) {
  const body = new URLSearchParams({
    code,
    client_id: config.gmailClientId,
    client_secret: config.gmailClientSecret,
    redirect_uri: config.gmailRedirectUri,
    grant_type: "authorization_code",
  });

  return fetchJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

async function refreshAccessToken(refreshToken, config) {
  const body = new URLSearchParams({
    client_id: config.gmailClientId,
    client_secret: config.gmailClientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  return fetchJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

function buildAuthUrl(config) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.gmailClientId);
  url.searchParams.set("redirect_uri", config.gmailRedirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", encodeState({ t: Date.now() }));
  return url.toString();
}

async function gmailFetch(path, accessToken, searchParams = {}) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/${path}`);
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return fetchJson(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function createGmailService({ config, onQualifiedMessage }) {
  const state = {
    connected: false,
    profileEmail: null,
    refreshToken: null,
    accessToken: null,
    accessTokenExpiry: 0,
    lastSyncAt: null,
    lastQualifiedAt: null,
    lastSeenAt: null,
    lastError: null,
    lastSkippedReason: null,
    lastMessageSubject: null,
    processedMessageIds: new Set(),
    syncTimer: null,
  };

  const tokenPath = config.gmailTokenPath || DEFAULT_TOKEN_PATH;

  function saveToken() {
    if (!state.refreshToken) return;
    try {
      fs.writeFileSync(
        tokenPath,
        JSON.stringify(
          {
            refreshToken: state.refreshToken,
            profileEmail: state.profileEmail,
          },
          null,
          2
        )
      );
    } catch (error) {
      console.error("Failed to save Gmail token:", error);
    }
  }

  function loadToken() {
    try {
      if (!fs.existsSync(tokenPath)) return false;
      const payload = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
      if (!payload.refreshToken) return false;
      state.refreshToken = payload.refreshToken;
      state.profileEmail = payload.profileEmail || null;
      state.connected = true;
      return true;
    } catch (error) {
      console.error("Failed to load Gmail token:", error);
      return false;
    }
  }

  async function ensureAccessToken() {
    if (!state.refreshToken) {
      throw new Error("Gmail account is not connected");
    }

    if (state.accessToken && Date.now() < state.accessTokenExpiry - 60_000) {
      return state.accessToken;
    }

    const refreshed = await refreshAccessToken(state.refreshToken, config);
    state.accessToken = refreshed.access_token;
    state.accessTokenExpiry = Date.now() + Number(refreshed.expires_in || 3600) * 1000;
    return state.accessToken;
  }

  async function fetchProfile() {
    const accessToken = await ensureAccessToken();
    const profile = await gmailFetch("users/me/profile", accessToken);
    state.profileEmail = profile.emailAddress || state.profileEmail;
    return profile;
  }

  async function listUnreadMessages() {
    const accessToken = await ensureAccessToken();
    const payload = await gmailFetch("users/me/messages", accessToken, {
      q: config.gmailSearchQuery || "in:inbox newer_than:7d -category:social -category:promotions",
      maxResults: 10,
    });

    return Array.isArray(payload.messages) ? payload.messages : [];
  }

  async function getMessage(messageId) {
    const accessToken = await ensureAccessToken();
    return gmailFetch(`users/me/messages/${messageId}`, accessToken, {
      format: "full",
    });
  }

  async function syncInbox() {
    if (!state.connected) return;

    try {
      const messages = await listUnreadMessages();
      state.lastError = null;

      for (const message of messages) {
        if (state.processedMessageIds.has(message.id)) continue;

        const full = await getMessage(message.id);
        const headers = full.payload?.headers || [];
        const body = extractMessageBody(full.payload);

        state.processedMessageIds.add(message.id);
        state.lastSeenAt = new Date().toISOString();
        state.lastMessageSubject = findHeader(headers, "Subject");

        const result = await onQualifiedMessage({
          provider: "gmail",
          messageId: message.id,
          threadId: full.threadId,
          internalDate: full.internalDate,
          from: findHeader(headers, "From"),
          subject: findHeader(headers, "Subject"),
          snippet: full.snippet || "",
          textPlain: body.plain,
          textHtml: body.html,
        });

        if (result?.skipped) {
          state.lastSkippedReason = result.reason || "Inbound email was skipped";
        }
      }

      state.lastSyncAt = new Date().toISOString();
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : "Gmail sync failed";
      console.error("Gmail sync failed:", error);
    }
  }

  function startPolling() {
    if (state.syncTimer) clearInterval(state.syncTimer);
    state.syncTimer = setInterval(syncInbox, 60_000);
    syncInbox();
  }

  if (loadToken()) {
    fetchProfile()
      .catch((error) => {
        state.lastError = error instanceof Error ? error.message : "Failed to restore Gmail connection";
        console.error("Failed to restore Gmail connection:", error);
      })
      .finally(startPolling);
  }

  async function connectWithCode(code, returnedState) {
    decodeState(returnedState);

    const tokenPayload = await exchangeCodeForTokens(code, config);
    state.refreshToken = tokenPayload.refresh_token || state.refreshToken;
    state.accessToken = tokenPayload.access_token;
    state.accessTokenExpiry = Date.now() + Number(tokenPayload.expires_in || 3600) * 1000;
    state.connected = true;

    await fetchProfile();
    saveToken();
    startPolling();
    return getStatus();
  }

  function getStatus() {
    return {
      connected: state.connected,
      email: state.profileEmail,
      lastSyncAt: state.lastSyncAt,
      lastQualifiedAt: state.lastQualifiedAt,
      lastSeenAt: state.lastSeenAt,
      lastError: state.lastError,
      lastSkippedReason: state.lastSkippedReason,
      lastMessageSubject: state.lastMessageSubject,
      automationReady:
        Boolean(config.gmailClientId) &&
        Boolean(config.gmailClientSecret) &&
        Boolean(config.gmailRedirectUri),
    };
  }

  function buildConnectUrl() {
    if (!config.gmailClientId || !config.gmailClientSecret || !config.gmailRedirectUri) {
      throw new Error("Gmail OAuth is not configured on the server");
    }

    return buildAuthUrl(config);
  }

  function noteQualifiedLead() {
    state.lastQualifiedAt = new Date().toISOString();
  }

  return {
    getStatus,
    buildConnectUrl,
    connectWithCode,
    noteQualifiedLead,
    syncInbox,
  };
}
