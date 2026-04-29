import { hasLlm, requestStructuredJson } from "./llm.js";

const BUYING_PATTERNS = [
  /\bdemo\b/i,
  /\bpricing\b/i,
  /\bquote\b/i,
  /\bintegration\b/i,
  /\byardi\b/i,
  /\bappfolio\b/i,
  /\bleasing\b/i,
  /\bautomation\b/i,
  /\bproperty management\b/i,
  /\bmultifamily\b/i,
  /\bunits?\b/i,
  /\bportfolio\b/i,
  /\bafter hours\b/i,
  /\bavailability\b/i,
  /\bchatbot\b/i,
  /\bchat bot\b/i,
  /\bai assistant\b/i,
  /\bvirtual assistant\b/i,
  /\binterested\b/i,
  /\bcontact\b/i,
  /\bsales\b/i,
  /\bapartment\b/i,
  /\bproperty\b/i,
  /\btour\b/i,
];

const NON_BUYER_PATTERNS = [
  /\bjob\b/i,
  /\bresume\b/i,
  /\bcareer\b/i,
  /\brecruit/i,
  /\bnewsletter\b/i,
  /\bunsubscribe\b/i,
  /\bpress\b/i,
  /\bmedia\b/i,
  /\bpartnership\b/i,
  /\binvoice\b/i,
  /\bbilling\b/i,
  /\bsupport ticket\b/i,
];

function heuristicQualification(message) {
  const haystack = [
    message.from,
    message.subject,
    message.textPlain,
    message.snippet,
  ]
    .filter(Boolean)
    .join("\n");

  const buyerHits = BUYING_PATTERNS.filter((pattern) => pattern.test(haystack)).length;
  const nonBuyerHits = NON_BUYER_PATTERNS.filter((pattern) => pattern.test(haystack)).length;

  if (buyerHits >= 2 && nonBuyerHits === 0) {
    return {
      isPotentialCustomer: true,
      reason: "Inbound email contains multiple buying-intent signals related to leasing, pricing, or property operations.",
    };
  }

  if (nonBuyerHits > buyerHits) {
    return {
      isPotentialCustomer: false,
      reason: "Inbound email looks more like recruiting, support, media, or general noise than a customer inquiry.",
    };
  }

  return {
    isPotentialCustomer: buyerHits > 0,
    reason: buyerHits > 0
      ? "Inbound email contains at least one relevant buying-intent signal and should be reviewed as a potential customer inquiry."
      : "Inbound email did not contain enough customer-intent evidence to qualify automatically.",
  };
}

async function llmQualification(message, config) {
  const result = await requestStructuredJson({
    config,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "Classify inbound emails for a B2B sales inbox. Return JSON only. Determine whether the email is a likely customer inquiry about EliseAI, leasing automation, integrations, pricing, demos, property operations, or other buying intent.",
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
      name: "inbound_email_qualification",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          isPotentialCustomer: { type: "boolean" },
          reason: { type: "string" },
        },
        required: ["isPotentialCustomer", "reason"],
      },
    },
  });

  return result.data;
}

export async function classifyInboundEmail(message, config) {
  if (!hasLlm(config)) {
    return heuristicQualification(message);
  }

  try {
    return await llmQualification(message, config);
  } catch {
    return heuristicQualification(message);
  }
}
