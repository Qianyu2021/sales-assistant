import { hasLlm, requestStructuredJson } from "./llm.js";

const ADDRESS_PATTERN =
  /\b\d{2,6}\s+[A-Za-z0-9 .'-]+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Court|Ct|Place|Pl|Parkway|Pkwy|Highway|Hwy)\b(?:[,\s]+[A-Za-z .'-]+)?(?:[,\s]+[A-Z]{2})?(?:\s+\d{5})?/i;
const COMPANY_SUFFIX_PATTERN =
  /\b(?:Apartments|Apartment Homes|Apts|Homes|Properties|Property Management|Residential|Communities|Realty|Management|Group|LLC|L\.L\.C\.|Inc\.?|Corporation|Corp\.?|Company|Partners|Holdings|Real Estate|REIT)\b/i;
const SIGNATURE_STOP_PATTERN = /^(best|thanks|thank you|regards|sincerely|cheers|respectfully|warmly|--)\b/i;
const PERSONAL_TITLE_PATTERN =
  /\b(?:manager|director|leasing|consultant|specialist|associate|coordinator|representative|agent|president|founder|owner|vp|vice president)\b/i;
const KNOWN_EMAIL_COMPANIES = {
  equityapartments: "Equity Residential",
  fpimgt: "FPI Management",
};

function clean(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function titleCase(value = "") {
  return clean(value).replace(/\b\w/g, (char) => char.toUpperCase());
}

function cleanCompanyName(value = "") {
  return clean(value)
    .replace(/^(?:company|management company|operator|owner|from|at)\s*[:\-]\s*/i, "")
    .replace(/\s+\|.*$/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[,;]+$/g, "")
    .trim();
}

function splitLines(text = "") {
  return String(text)
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => clean(line.replace(/<[^>]+>/g, " ")))
    .filter(Boolean);
}

export function extractSenderEmail(from = "") {
  return from.match(/<([^>]+)>/)?.[1] || from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
}

export function extractSenderName(from = "") {
  const beforeAddress = clean(from.replace(/<[^>]+>/g, " ").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " "));
  return beforeAddress
    .replace(/^["']|["']$/g, "")
    .replace(/\s+via\s+.+$/i, "")
    .trim();
}

function splitPersonName(value = "") {
  const cleaned = clean(value)
    .replace(/^["']|["']$/g, "")
    .replace(/\([^)]*\)/g, "")
    .trim();
  if (!cleaned || /@|no-?reply|support|leasing|info|sales/i.test(cleaned)) {
    return { firstName: "", lastName: "" };
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0 || parts.length > 4) return { firstName: "", lastName: "" };
  return {
    firstName: titleCase(parts[0]),
    lastName: titleCase(parts.slice(1).join(" ")),
  };
}

export function inferCompanyFromEmail(email = "") {
  const domain = email.split("@")[1] || "";
  const root = domain.split(".")[0] || "";
  if (!root || /^(gmail|yahoo|hotmail|outlook|icloud|aol|example)$/i.test(root)) return "";
  if (KNOWN_EMAIL_COMPANIES[root.toLowerCase()]) return KNOWN_EMAIL_COMPANIES[root.toLowerCase()];
  return titleCase(root.replace(/[-_]+/g, " "));
}

function extractLabel(text, labels) {
  const pattern = new RegExp(`\\b(?:${labels.join("|")})\\s*[:\\-]\\s*([^\\n]+)`, "i");
  return clean(text.match(pattern)?.[1] || "").replace(/[,;]+$/g, "");
}

function extractAddressFromValue(value = "") {
  return clean(value.match(ADDRESS_PATTERN)?.[0] || value)
    .replace(/\b(?:we|i|our|looking|interested)\b.*$/i, "")
    .replace(/[. ]+$/g, "")
    .trim();
}

function normalizedAddress(value = "") {
  return clean(value)
    .toLowerCase()
    .replace(/\b(?:street|st\.?)\b/g, "st")
    .replace(/\b(?:road|rd\.?)\b/g, "rd")
    .replace(/\b(?:avenue|ave\.?)\b/g, "ave")
    .replace(/\b(?:drive|dr\.?)\b/g, "dr")
    .replace(/\b(?:boulevard|blvd\.?)\b/g, "blvd")
    .replace(/\b(?:lane|ln\.?)\b/g, "ln")
    .replace(/\b(?:suite|ste\.?|unit|apt|#)\s*\w+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function sameAddressEnough(a = "", b = "") {
  const first = normalizedAddress(a);
  const second = normalizedAddress(b);
  if (!first || !second) return false;
  return first.includes(second) || second.includes(first);
}

function sameNormalizedName(a = "", b = "") {
  const normalize = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalize(a) && normalize(a) === normalize(b);
}

function extractNameAfterContext(text, contexts, suffixes) {
  for (const context of contexts) {
    for (const suffix of suffixes) {
      const pattern = new RegExp(`\\b${context}\\s+([A-Z][A-Za-z0-9&' -]{2,80}${suffix})\\b`, "i");
      const match = text.match(pattern);
      if (match?.[1]) return clean(match[1]);
    }
  }
  return "";
}

function extractCompanyLikeName(text) {
  const patterns = [
    /\b([A-Z][A-Za-z0-9&' -]{2,80}(?:Apartments|Apartment Homes|Apts|Homes|Properties|Property Management|Residential|Communities|Realty|Management|Group|LLC|Inc\.?|Corporation|Corp\.?|Company|Partners|Holdings|Real Estate|REIT))\b/,
    /\b(?:at|for|from)\s+([A-Z][A-Za-z0-9&' -]{2,80}(?:Apartments|Apartment Homes|Properties|Communities|Residential))\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }

  return "";
}

function extractSignatureBlock(text = "") {
  const lines = splitLines(text);
  if (lines.length === 0) return "";

  const signoffIndex = lines.findIndex((line) => SIGNATURE_STOP_PATTERN.test(line));
  if (signoffIndex >= 0) {
    return lines.slice(signoffIndex + 1, signoffIndex + 12).join("\n");
  }

  return lines.slice(-12).join("\n");
}

function extractMessageBeforeSignature(text = "") {
  const lines = splitLines(text);
  const signoffIndex = lines.findIndex((line) => SIGNATURE_STOP_PATTERN.test(line));
  if (signoffIndex >= 0) {
    return lines.slice(0, signoffIndex).join("\n");
  }
  return lines.join("\n");
}

function extractPropertyNameFromContext(text = "") {
  const patterns = [
    /\b(?:property|apartment|community|building)\s+(?:called|named)\s+([A-Z][A-Za-z0-9&' -]{2,80})/i,
    /\b(?:for|about|regarding|at)\s+([A-Z][A-Za-z0-9&' -]{2,80})(?:[.?,;\n]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = clean(match?.[1] || "")
      .replace(/\b(?:pricing|availability|leasing|chatbot|product|service|demo|call)\b.*$/i, "")
      .replace(/[.,"' ]+$/g, "");
    if (value && value.length >= 3) return value;
  }

  return "";
}

function isLikelySignatureCompanyLine(line = "", senderEmail = "") {
  if (!line || line.length < 3 || line.length > 90) return false;
  if (/@|www\.|https?:|^\d|^\+|\b(?:tel|phone|mobile|fax)\b/i.test(line)) return false;
  if (ADDRESS_PATTERN.test(line)) return false;

  const domainRoot = (senderEmail.split("@")[1] || "").split(".")[0] || "";
  const normalizedLine = line.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedRoot = domainRoot.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hasCompanySuffix = COMPANY_SUFFIX_PATTERN.test(line);
  const matchesDomain = normalizedRoot.length >= 4 && normalizedLine.includes(normalizedRoot);
  const looksLikeName = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$/.test(line);
  const looksLikeTitle = PERSONAL_TITLE_PATTERN.test(line) && !hasCompanySuffix;

  return hasCompanySuffix || (matchesDomain && !looksLikeName && !looksLikeTitle);
}

function extractSignatureCompany(signature = "", senderEmail = "") {
  const lines = splitLines(signature);
  for (const line of lines) {
    if (isLikelySignatureCompanyLine(line, senderEmail)) {
      return cleanCompanyName(line);
    }
  }
  return "";
}

function extractSignaturePersonName(signature = "") {
  const lines = splitLines(signature);
  for (const line of lines.slice(0, 3)) {
    if (
      line &&
      !COMPANY_SUFFIX_PATTERN.test(line) &&
      !PERSONAL_TITLE_PATTERN.test(line) &&
      !ADDRESS_PATTERN.test(line) &&
      !/@|www\.|https?:|^\d|^\+|\b(?:tel|phone|mobile|fax)\b/i.test(line)
    ) {
      const parsed = splitPersonName(line);
      if (parsed.firstName) return parsed;
    }
  }
  return { firstName: "", lastName: "" };
}

function extractSignatureAddress(signature = "") {
  const lines = splitLines(signature);
  for (let index = 0; index < lines.length; index += 1) {
    const combined = [lines[index], lines[index + 1]].filter(Boolean).join(", ");
    const match = combined.match(ADDRESS_PATTERN);
    if (match?.[0]) return clean(match[0]).replace(/[. ]+$/g, "");
  }
  return "";
}

export function heuristicExtractLeadFromEmail(message) {
  const text = [message.subject, message.textPlain, message.textHtml, message.snippet]
    .filter(Boolean)
    .join("\n");
  const senderEmail = extractSenderEmail(message.from);
  const bodyText = [message.textPlain, message.textHtml, message.snippet].filter(Boolean).join("\n");
  const signature = extractSignatureBlock(bodyText);
  const displayName = splitPersonName(extractSenderName(message.from));
  const signatureName = extractSignaturePersonName(signature);
  const senderName = displayName.firstName ? displayName : signatureName;
  const senderNameSource = displayName.firstName ? "from_header" : signatureName.firstName ? "signature" : "";
  const messageBeforeSignature = [message.subject, extractMessageBeforeSignature(bodyText)].filter(Boolean).join("\n");
  const signatureCompany = extractSignatureCompany(signature, senderEmail);
  const signatureAddress = extractSignatureAddress(signature);
  const senderDomainCompany = inferCompanyFromEmail(senderEmail);
  const propertyName =
    extractLabel(messageBeforeSignature, ["apartment", "property", "community", "property name", "apartment name"]) ||
    extractPropertyNameFromContext(messageBeforeSignature) ||
    extractNameAfterContext(messageBeforeSignature, ["operate", "operates", "running", "at", "for"], [
      "Apartments",
      "Apartment Homes",
      "Apts",
      "Homes",
      "Communities",
    ]) ||
    extractCompanyLikeName(messageBeforeSignature);
  const companyName =
    extractLabel(text, ["management company", "operator", "owner", "company"]) ||
    signatureCompany ||
    senderDomainCompany;
  const address = (
    extractLabel(messageBeforeSignature, ["address", "property address", "apartment address", "property location", "location"]) ||
    clean(messageBeforeSignature.match(ADDRESS_PATTERN)?.[0] || "")
  )
    ? extractAddressFromValue(
        extractLabel(messageBeforeSignature, [
          "address",
          "property address",
          "apartment address",
          "property location",
          "location",
        ]) || clean(messageBeforeSignature.match(ADDRESS_PATTERN)?.[0] || "")
      )
    : "";

  return {
    firstName: senderName.firstName,
    lastName: senderName.lastName,
    senderNameSource,
    email: senderEmail || "unknown@gmail-inquiry.local",
    company: companyName || propertyName || "Gmail inquiry",
    propertyName,
    apartmentName: propertyName,
    operatorName: companyName,
    senderCompany: signatureCompany || senderDomainCompany,
    operatorAddress: signatureAddress,
    senderCompanyAddress: signatureAddress,
    address,
    city: "",
    state: "",
    confidence: propertyName || companyName || address || signatureCompany ? 65 : 20,
    source: "heuristic",
  };
}

async function llmExtractLeadFromEmail(message, config) {
  const result = await requestStructuredJson({
    config,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "Extract structured lead information from a sales inquiry email. Return JSON only. " +
              "Identify whether names refer to the sender company, apartment/community/property, owner/operator/management company, and property address. Do not invent facts. " +
              "Extract firstName and lastName from the From header display name or the sender signature; use empty strings if no real person name is visible. Set senderNameSource to from_header, signature, ai, or empty string. " +
              "The address in the email body/content is usually the apartment/property location and must go in address. " +
              "Pay special attention to the sender signature/footer. If the signature contains an organization name, treat it as senderCompany and, when it appears to be a property manager/operator, operatorName. Keep sender/operator office address separate from the apartment/property address.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(message, null, 2),
          },
        ],
      },
    ],
    schema: {
      name: "email_lead_extraction",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          email: { type: "string" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          senderNameSource: { type: "string" },
          company: { type: "string" },
          propertyName: { type: "string" },
          apartmentName: { type: "string" },
          operatorName: { type: "string" },
          senderCompany: { type: "string" },
          operatorAddress: { type: "string" },
          senderCompanyAddress: { type: "string" },
          address: { type: "string" },
          city: { type: "string" },
          state: { type: "string" },
          confidence: { type: "number" },
        },
        required: [
          "email",
          "firstName",
          "lastName",
          "senderNameSource",
          "company",
          "propertyName",
          "apartmentName",
          "operatorName",
          "senderCompany",
          "operatorAddress",
          "senderCompanyAddress",
          "address",
          "city",
          "state",
          "confidence",
        ],
      },
    },
  });

  return {
    ...result.data,
    source: result.source,
  };
}

export async function extractLeadFromEmail(message, config) {
  const fallback = heuristicExtractLeadFromEmail(message);
  if (!hasLlm(config)) return fallback;

  try {
    const extracted = await llmExtractLeadFromEmail(message, config);
    const email = extractSenderEmail(message.from);
    const extractedAddress = clean(extracted.address || "");
    const extractedOperatorAddress = clean(extracted.operatorAddress || "");
    const extractedSenderAddress = clean(extracted.senderCompanyAddress || "");
    const extractedLooksLikeOperatorAddress =
      sameAddressEnough(extractedAddress, extractedOperatorAddress) ||
      sameAddressEnough(extractedAddress, extractedSenderAddress) ||
      sameAddressEnough(extractedAddress, fallback.operatorAddress) ||
      sameAddressEnough(extractedAddress, fallback.senderCompanyAddress);
    const propertyAddress = fallback.address || (extractedAddress && !extractedLooksLikeOperatorAddress ? extractedAddress : "");
    const propertyName = extracted.propertyName || extracted.apartmentName || fallback.propertyName;
    const extractedOperatorIsProperty =
      sameNormalizedName(extracted.operatorName, propertyName) ||
      sameNormalizedName(extracted.operatorName, fallback.apartmentName);
    const operatorName = extractedOperatorIsProperty
      ? fallback.operatorName
      : extracted.operatorName || fallback.operatorName;
    return {
      ...fallback,
      ...Object.fromEntries(
        Object.entries(extracted).map(([key, value]) => [key, typeof value === "string" ? clean(value) : value])
      ),
      email: extracted.email && extracted.email.includes("@") ? extracted.email : fallback.email || email,
      firstName: extracted.firstName || fallback.firstName,
      lastName: extracted.lastName || fallback.lastName,
      senderNameSource: extracted.senderNameSource || (extracted.firstName ? "ai" : fallback.senderNameSource),
      company: operatorName || extracted.company || propertyName || fallback.company,
      propertyName,
      apartmentName: extracted.apartmentName || extracted.propertyName || fallback.apartmentName,
      operatorName,
      senderCompany: extracted.senderCompany || fallback.senderCompany,
      operatorAddress: extracted.operatorAddress || fallback.operatorAddress,
      senderCompanyAddress: extracted.senderCompanyAddress || fallback.senderCompanyAddress,
      address: propertyAddress,
      confidence: Math.max(Number(extracted.confidence || 0), fallback.confidence),
      source: extracted.source,
    };
  } catch {
    return fallback;
  }
}
