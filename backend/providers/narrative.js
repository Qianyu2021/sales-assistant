import { hasLlm, requestStructuredJson } from "../lib/llm.js";

const CATEGORY_LABELS = {
  portfolioFitSize: "Portfolio fit and size",
  leasingDemand: "Leasing demand",
  operationalPain: "Operational pain",
  marketAttractiveness: "Market attractiveness",
  aiOpportunity: "AI opportunity",
};

function fallbackHeadline(scoreLabel, company) {
  if (scoreLabel === "Hot") {
    return `${company} looks like a strong automation prospect right now.`;
  }
  if (scoreLabel === "Warm") {
    return `${company} looks worth pursuing, with a few signals to validate in discovery.`;
  }
  return `${company} is a lighter-priority lead unless stronger pain or expansion signals emerge.`;
}

function rankCategories(scorecard) {
  return Object.values(scorecard.categories)
    .sort((a, b) => b.weightedContribution - a.weightedContribution)
    .slice(0, 3);
}

function buildFallbackNarrative({ lead, scorecard, scoring, growth, reviews, market, search, agentAnalysis }) {
  const topCategories = rankCategories(scorecard);
  const finalEvaluation = agentAnalysis?.finalEvaluation;
  const reasons = topCategories.map((category) => ({
    category: category.key,
    title: CATEGORY_LABELS[category.key],
    body:
      scoring.categoryInsights[category.key] ||
      `${CATEGORY_LABELS[category.key]} scored ${category.score}/${category.maxScore}.`,
    implication:
      category.percentScore >= 70
        ? "This is a meaningful positive signal for outreach prioritization."
        : category.percentScore >= 45
          ? "This is directionally helpful, but a rep should validate it during discovery."
          : "This is a weaker signal and should not carry the pitch by itself.",
  }));

  const nextBestAction =
    reviews.reviewCount >= 20 && reviews.rating <= 3.8
      ? "Lead with renter experience and response-time pain in outreach."
      : search?.evidence?.length > 0
        ? "Lead with the strongest public search evidence, then validate current leasing workflow and response coverage."
      : growth.articleCount > 0
        ? "Reference the recent company momentum and position automation as a scaling lever."
        : market.marketPressureScore >= 60
          ? "Lead with leasing speed and conversion coverage in a competitive market."
          : "Use discovery to confirm portfolio size, current tooling, and leasing bottlenecks.";

  return {
    summary: fallbackHeadline(scorecard.label, lead.company),
    scoreSummary:
      scorecard.label === "Hot"
        ? "This lead scores well because multiple signals point in the same direction: fit, urgency, and likely ROI."
        : scorecard.label === "Warm"
          ? "This lead has enough positive evidence to pursue, but discovery still needs to confirm urgency and operational pain."
          : "This lead has some useful signals, but not enough evidence yet to justify top-tier prioritization.",
    overallAnalysis:
      (finalEvaluation?.companyOverview ? `${finalEvaluation.companyOverview} ` : "") +
      (finalEvaluation?.parentCompanyInsight ? `${finalEvaluation.parentCompanyInsight} ` : "") +
      `${lead.company} scored ${scorecard.total}/100, which puts it in the ${scorecard.label.toLowerCase()} bucket. ` +
      `The strongest current signals come from ${topCategories.map((category) => CATEGORY_LABELS[category.key].toLowerCase()).join(", ")}. ` +
      (finalEvaluation?.rationale ? `The agent evaluator added: ${finalEvaluation.rationale} ` : "") +
      `That mix suggests the rep should think about both fit and urgency: whether this operator is large or active enough for automation ROI to be obvious, and whether there is enough visible friction to make the conversation timely. ` +
      `For EliseAI, that usually means the opportunity is best framed around leasing efficiency, response coverage, and whether the team is operating at enough scale for automation to matter. ` +
      `If discovery confirms real inquiry volume, staffing pressure, or inconsistent follow-up, this score likely understates the upside. If those operational realities are absent, the lead may still be viable but should be worked more selectively.`,
    reasons,
    repTalkingPoints: [
      ...(finalEvaluation?.repTalkingPoints || []).slice(0, 2),
      reviews.reviewCount >= 20
        ? `Public reviews are substantial enough to use as external proof points: ${reviews.rating} stars across ${reviews.reviewCount} reviews.`
        : "The public review footprint is light, so use reviews as a soft signal rather than a primary argument.",
      growth.articleCount > 0
        ? `Recent company mentions suggest current momentum, which gives the rep a timely reason to reach out.`
        : "External growth coverage is thin, so the first call should confirm expansion plans before leaning on a scale narrative.",
      search?.evidence?.length > 0
        ? `Public web search found evidence around ${search.matchedSignals.map((signal) => signal.label.toLowerCase()).join(", ") || "company fit"}, which can make outreach more specific.`
        : "Public web evidence is light, so use the call to verify rental portfolio fit and response-time pain.",
      market.marketPressureScore >= 60
        ? "Market conditions make speed-to-lead and after-hours coverage more relevant to the pitch."
        : "Market pressure alone does not create urgency, so discovery should focus more on workflow pain and staffing coverage.",
    ],
    nextBestAction,
    source: "fallback",
  };
}

function buildSchema() {
  return {
    name: "lead_score_narrative",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        scoreSummary: { type: "string" },
        overallAnalysis: { type: "string" },
        reasons: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              category: {
                type: "string",
                enum: ["portfolioFitSize", "leasingDemand", "operationalPain", "marketAttractiveness", "aiOpportunity"],
              },
              title: { type: "string" },
              body: { type: "string" },
              implication: { type: "string" },
            },
            required: ["category", "title", "body", "implication"],
          },
        },
        repTalkingPoints: {
          type: "array",
          items: { type: "string" },
        },
        nextBestAction: { type: "string" },
      },
      required: ["summary", "scoreSummary", "overallAnalysis", "reasons", "repTalkingPoints", "nextBestAction"],
    },
  };
}

function buildInput({ lead, location, demographics, reviews, growth, market, search, agentAnalysis, scorecard }) {
  return [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text:
            "You are an AI sales research analyst for EliseAI. You evaluate property management and multifamily leads so reps do not have to manually research every company. Return JSON only. Be specific, grounded in the supplied data, and do not invent facts. Start the overall analysis with a brief company/operator introduction when public evidence supports it, including parent or management-company context if the contacted property appears to be run by a larger operator. Analyze portfolio fit and size, leasing demand, operational pain, market attractiveness, and AI opportunity. Explain how each category affects automation ROI.",
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: JSON.stringify(
            {
              company: lead.company,
              contact: [lead.firstName, lead.lastName].filter(Boolean).join(" ") || null,
              market: {
                city: location.city,
                state: location.state,
                zipCode: location.zipCode,
                formattedAddress: location.formattedAddress,
              },
              scorecard,
              scoringAssumptions: [
                "Portfolio fit and size is scored out of 30 points because many apartment units, student housing, commercial/residential rentals, or parent-company properties create more automation ROI.",
                "Leasing demand is scored out of 25 points because active listings, availability pages, vacancy pressure, floor plans, and tour CTAs indicate real lead flow.",
                "Operational pain is scored out of 25 points because staffing pressure, review friction, missed calls, and resident communication load create urgency.",
                "Market attractiveness is scored out of 15 points because dense, competitive, higher-rent metros benefit more from speed-to-lead.",
                "AI opportunity is scored out of 5 points because phone/text/email/contact-form-heavy workflows without visible chatbot coverage leave more room for EliseAI.",
                "If the contacted apartment is run by a parent company or management company, include that parent/operator context in the overall analysis.",
              ],
              evidence: {
                medianIncome: demographics.medianIncome,
                renterRatio: demographics.renterRatio,
                multiUnitShare: demographics.multiUnitShare,
                reviewRating: reviews.rating,
                reviewCount: reviews.reviewCount,
                reviewSignal: reviews.reviewSignal,
                growthArticleCount: growth.articleCount,
                growthTopics: growth.matchedTopics,
                growthHeadlines: growth.headlines,
                publicWebSearch: {
                  source: search.source,
                  resultCount: search.resultCount,
                  searchSignalScore: search.searchSignalScore,
                  matchedSignals: search.matchedSignals,
                  evidence: search.evidence,
                  topResults: search.topResults,
                  parentCompany: search.parentCompany,
                  parentCompanyProfile: search.parentCompany?.portfolio || null,
                },
                agentAnalysis: {
                  source: agentAnalysis?.source,
                  specialistReviews: agentAnalysis?.specialistReviews,
                  finalEvaluation: agentAnalysis?.finalEvaluation,
                },
                rentalVacancyRate: market.rentalVacancyRate,
                rentInflationYoY: market.rentInflationYoY,
              },
              instructions: {
                summaryLength: "2-3 sentences",
                overallAnalysisLength: "6-8 sentences",
                categoryAnalysisLength: "2-3 sentences per category",
                talkingPointsCount: 3,
              },
            },
            null,
            2
          ),
        },
      ],
    },
  ];
}

async function requestNarrative(context, config) {
  const result = await requestStructuredJson({
    config,
    input: buildInput(context),
    schema: buildSchema(),
  });

  return {
    ...result.data,
    source: result.source,
    model: result.model,
  };
}

export async function writeLeadNarrative(context, config) {
  if (!hasLlm(config)) {
    return buildFallbackNarrative(context);
  }

  try {
    return await requestNarrative(context, config);
  } catch {
    return buildFallbackNarrative(context);
  }
}
