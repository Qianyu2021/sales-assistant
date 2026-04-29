import http from "node:http";
import { enrichLead } from "./lib/enrichment.js";
import { createGmailService } from "./lib/gmail.js";
import { loadEnvFile } from "./lib/loadEnv.js";
import { classifyInboundEmail } from "./lib/inboundQualification.js";
import { extractLeadFromEmail } from "./lib/emailLeadExtraction.js";
import { readJson, sendJson } from "./lib/http.js";

loadEnvFile();

const config = {
  freePublicApisOnly: process.env.FREE_PUBLIC_APIS_ONLY !== "false",
  port: Number(process.env.PORT || 8787),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  censusGeocoderBaseUrl:
    process.env.CENSUS_GEOCODER_BASE_URL || "https://geocoding.geo.census.gov",
  censusDataBaseUrl: process.env.CENSUS_DATA_BASE_URL || "https://api.census.gov",
  censusApiKey: process.env.CENSUS_API_KEY || "",
  newsApiKey: process.env.NEWS_API_KEY || "",
  newsApiBaseUrl: process.env.NEWS_API_BASE_URL || "https://newsapi.org",
  gdeltDocBaseUrl: process.env.GDELT_DOC_BASE_URL || "https://api.gdeltproject.org",
  fredApiKey: process.env.FRED_API_KEY || "",
  fredApiBaseUrl: process.env.FRED_API_BASE_URL || "https://api.stlouisfed.org",
  googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || process.env.Google_PLACE_API_KEY || "",
  googleGeminiApiKey:
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GOOGLE_Gemini_API_KEY ||
    process.env.Google_Gemini_API_KEY ||
    "",
  googleGeminiModel: process.env.GOOGLE_GEMINI_MODEL || process.env.Google_model || "gemini-2.5-flash",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  gmailClientId: process.env.GMAIL_CLIENT_ID || "",
  gmailClientSecret: process.env.GMAIL_CLIENT_SECRET || "",
  gmailRedirectUri:
    process.env.GMAIL_REDIRECT_URI || "http://localhost:8787/api/gmail/oauth/callback",
  gmailSearchQuery:
    process.env.GMAIL_SEARCH_QUERY || "in:inbox newer_than:7d -category:social -category:promotions",
};

let nextLeadId = 1;
const leads = [];

function persistLead(lead, intake = {}) {
  const storedLead = {
    id: nextLeadId++,
    receivedAt: new Date().toISOString(),
    ...lead,
    intake,
  };

  leads.unshift(storedLead);
  return storedLead;
}

async function processInboundEmail(message) {
  console.log(`Gmail inbound received: ${message.subject || "(no subject)"}`);
  const qualification = await classifyInboundEmail(message, config);
  if (!qualification.isPotentialCustomer) {
    console.log(`Gmail inbound skipped: ${qualification.reason}`);
    return { skipped: true, reason: qualification.reason };
  }

  const hints = await extractLeadFromEmail(message, config);
  console.log(`Gmail extracted lead: ${JSON.stringify(hints)}`);

  const enrichedLead = await enrichLead(
    {
      input_type: "email",
      source: "gmail",
      raw_input: [
        `From: ${message.from || ""}`,
        `Subject: ${message.subject || ""}`,
        "Body:",
        message.textPlain || message.snippet || "",
      ].join("\n"),
      firstName: hints.firstName,
      lastName: hints.lastName,
      senderNameSource: hints.senderNameSource,
      email: hints.email,
      company: hints.company,
      propertyName: hints.propertyName,
      apartmentName: hints.apartmentName,
      operatorName: hints.operatorName,
      senderCompany: hints.senderCompany,
      operatorAddress: hints.operatorAddress,
      senderCompanyAddress: hints.senderCompanyAddress,
      address: hints.address,
      city: hints.city,
      state: hints.state,
    },
    config
  );

  const storedLead = persistLead(enrichedLead, {
    source: "gmail",
    trigger: "gmail_connected_inbox",
    qualificationReason: qualification.reason,
    messageId: message.messageId,
    threadId: message.threadId,
  });

  gmailService.noteQualifiedLead();
  return storedLead;
}

const gmailService = createGmailService({
  config,
  onQualifiedMessage: processInboundEmail,
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {}, config.corsOrigin);
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true }, config.corsOrigin);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/leads") {
    sendJson(res, 200, { leads }, config.corsOrigin);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/gmail/status") {
    sendJson(res, 200, gmailService.getStatus(), config.corsOrigin);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/gmail/connect") {
    try {
      sendJson(res, 200, { url: gmailService.buildConnectUrl() }, config.corsOrigin);
    } catch (error) {
      sendJson(
        res,
        400,
        { error: error instanceof Error ? error.message : "Failed to start Gmail connect flow" },
        config.corsOrigin
      );
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/gmail/oauth/callback") {
    try {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!code || !state) {
        throw new Error("Missing OAuth callback parameters");
      }

      await gmailService.connectWithCode(code, state);

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <html>
          <body style="font-family: sans-serif; padding: 24px;">
            <h2>Gmail connected</h2>
            <p>You can close this window and return to EliseAI.</p>
            <script>window.close();</script>
          </body>
        </html>
      `);
    } catch (error) {
      res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <html>
          <body style="font-family: sans-serif; padding: 24px;">
            <h2>Gmail connection failed</h2>
            <p>${error instanceof Error ? error.message : "Unknown error"}</p>
          </body>
        </html>
      `);
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/leads/enrich") {
    try {
      const body = await readJson(req);
      const enrichedLead = await enrichLead(body, config);
      const storedLead = persistLead(enrichedLead, {
        source: body.source || "manual",
        trigger: body._trigger || body.input_type || "direct",
      });
      sendJson(res, 200, storedLead, config.corsOrigin);
    } catch (error) {
      sendJson(
        res,
        400,
        {
          error: error instanceof Error ? error.message : "Lead enrichment failed",
        },
        config.corsOrigin
      );
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" }, config.corsOrigin);
});

server.listen(config.port, () => {
  console.log(`Lead enrichment API listening on http://localhost:${config.port}`);
});
