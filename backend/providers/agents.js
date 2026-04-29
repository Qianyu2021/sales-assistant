import { hasLlm, requestStructuredJson } from "../lib/llm.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const CATEGORY_KEYS = [
  "portfolioFitSize",
  "leasingDemand",
  "operationalPain",
  "marketAttractiveness",
  "aiOpportunity",
];

function specialistSchema(name) {
  return {
    name,
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        agent: { type: "string" },
        score: { type: "number" },
        confidence: { type: "number" },
        summary: { type: "string" },
        findings: {
          type: "array",
          items: { type: "string" },
        },
        concerns: {
          type: "array",
          items: { type: "string" },
        },
        evidenceRefs: {
          type: "array",
          items: { type: "string" },
        },
        recommendedDiscoveryQuestions: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: [
        "agent",
        "score",
        "confidence",
        "summary",
        "findings",
        "concerns",
        "evidenceRefs",
        "recommendedDiscoveryQuestions",
      ],
    },
  };
}

function evaluatorSchema() {
  return {
    name: "final_lead_evaluator",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        finalScore: { type: "number" },
        finalLabel: { type: "string", enum: ["Hot", "Warm", "Cold"] },
        confidence: { type: "number" },
        rationale: { type: "string" },
        scoreAdjustments: {
          type: "object",
          additionalProperties: false,
          properties: CATEGORY_KEYS.reduce((acc, key) => {
            acc[key] = { type: "number" };
            return acc;
          }, {}),
          required: CATEGORY_KEYS,
        },
        repTalkingPoints: {
          type: "array",
          items: { type: "string" },
        },
        discoveryQuestions: {
          type: "array",
          items: { type: "string" },
        },
        risks: {
          type: "array",
          items: { type: "string" },
        },
        nextBestAction: { type: "string" },
        companyOverview: { type: "string" },
        parentCompanyInsight: { type: "string" },
      },
      required: [
        "finalScore",
        "finalLabel",
        "confidence",
        "rationale",
        "scoreAdjustments",
        "repTalkingPoints",
        "discoveryQuestions",
        "risks",
        "nextBestAction",
        "companyOverview",
        "parentCompanyInsight",
      ],
    },
  };
}

function evidencePayload(context) {
  const { lead, location, demographics, reviews, growth, market, search, baselineScoring } = context;
  return {
    company: lead.company,
    propertyName: lead.propertyName || lead.apartmentName || null,
    operatorName: lead.operatorName || null,
    senderCompany: lead.senderCompany || null,
    operatorAddress: lead.operatorAddress || null,
    senderCompanyAddress: lead.senderCompanyAddress || null,
    contact: [lead.firstName, lead.lastName].filter(Boolean).join(" ") || null,
    address: location.formattedAddress,
    market: {
      city: location.city,
      state: location.state,
      zipCode: location.zipCode,
    },
    providerSources: {
      location: location.source,
      demographics: demographics.source,
      reviews: reviews.source,
      growth: growth.source,
      market: market.source,
      search: search.source,
    },
    metrics: {
      medianIncome: demographics.medianIncome,
      renterRatio: demographics.renterRatio,
      multiUnitShare: demographics.multiUnitShare,
      reviewRating: reviews.rating,
      reviewCount: reviews.reviewCount,
      reviewSignal: reviews.reviewSignal,
      growthArticleCount: growth.articleCount,
      growthTopics: growth.matchedTopics,
      growthHeadlines: growth.headlines,
      searchSignalScore: search.searchSignalScore,
      searchMatchedSignals: search.matchedSignals,
      searchEvidence: search.evidence,
      searchTopResults: search.topResults,
      parentCompany: search.parentCompany,
      parentCompanyProfile: search.parentCompany?.portfolio || null,
      propertyWebsite: reviews.websiteUri,
      rentalVacancyRate: market.rentalVacancyRate,
      rentInflationYoY: market.rentInflationYoY,
      marketPressureScore: market.marketPressureScore,
    },
    baseline: baselineScoring
      ? {
          score: baselineScoring.score,
          label: baselineScoring.scoreLabel,
          categoryScores: baselineScoring.categoryScores,
          categoryPercentScores: baselineScoring.categoryPercentScores,
        }
      : null,
  };
}

function specialistInput(agent, instruction, context) {
  return [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text:
            `${agent}: You are one specialist in a multi-agent sales research workflow for EliseAI. ` +
            "Analyze only the supplied evidence. Do not invent facts, ratings, staffing claims, or growth claims. " +
            "Return structured JSON only. Scores are 0-100, where 100 means very strong evidence for prioritizing this lead.",
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
              assignment: instruction,
              evidence: evidencePayload(context),
            },
            null,
            2
          ),
        },
      ],
    },
  ];
}

function evaluatorInput(context, specialistReviews) {
  return [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text:
            "You are the final evaluator in a multi-agent sales qualification workflow for EliseAI. " +
            "You combine structured API data with specialist agent reviews to produce a final score. " +
            "Be conservative: strong scores require enough scale, real rental-business fit, and credible urgency or pain. " +
            "Do not invent facts. Return JSON only.",
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
              evaluationGuidance: [
                "Reward evidence that the company manages apartments, multifamily, rentals, or leasing workflows.",
                "Reward verified or strongly inferred portfolio scale: many communities, many units, large resident base, or centralized management.",
                "Reward active leasing demand: available units, floor plans, online listings, tour CTAs, apartment website availability, or ILS evidence.",
                "Reward operational pain: leasing-agent hiring, missed-call/response complaints, weak reviews at meaningful review volume, maintenance/communication pressure.",
                "Reward AI opportunity lightly: phone, text, email, and contact-form-heavy workflows without visible chatbot/AI coverage leave more room for EliseAI.",
                "If the contact appears to be one apartment/property, check whether a larger parent or management company operates it and score that parent/operator context.",
                "Penalize weak or generic evidence, unclear multifamily fit, one-property/small-building signals, and stale or low-confidence signals.",
                "Use scoreAdjustments to nudge deterministic category scores up or down by roughly -20 to +20.",
                "Final score should follow this point model after category review: portfolioFitSize /30, leasingDemand /25, operationalPain /25, marketAttractiveness /15, aiOpportunity /5.",
                "Include a concise company overview and parent-company/operator insight from the supplied public search evidence.",
              ],
              evidence: evidencePayload(context),
              specialistReviews,
            },
            null,
            2
          ),
        },
      ],
    },
  ];
}

function labelFor(score) {
  if (score >= 75) return "Hot";
  if (score >= 55) return "Warm";
  return "Cold";
}

function fallbackSpecialists({ reviews, growth, market, search, baselineScoring }) {
  const rentalFitSignals =
    search.matchedSignals?.filter((signal) => ["portfolioSize", "rentalFit"].includes(signal.key)) || [];
  const leasingSignals =
    search.matchedSignals?.filter((signal) => ["leasingActivity", "rentalFit"].includes(signal.key)) || [];
  const reviewPain = reviews.reviewCount >= 20 && reviews.rating <= 3.8;
  const growthScore = clamp(Math.round((growth.growthSignalScore + (market.marketPressureScore || 0)) / 2), 0, 100);

  return [
    {
      agent: "Search Research Agent",
      score: clamp(search.searchSignalScore || 0, 0, 100),
      confidence: search.resultCount > 0 ? 70 : 35,
      summary:
        search.resultCount > 0
          ? "Search results provide public context for rental fit, company activity, and possible pain."
          : "Search evidence is unavailable or light, so this agent is low confidence.",
      findings: [...rentalFitSignals, ...leasingSignals].map((signal) => `${signal.label} appeared in search evidence.`),
      concerns: search.resultCount > 0 ? [] : ["Public search did not return strong evidence."],
      evidenceRefs: search.evidence?.slice(0, 3).map((item) => item.title) || [],
      recommendedDiscoveryQuestions: [
        "How many leasing inquiries does the team handle each week?",
        "Which channels create the most missed or delayed follow-up?",
      ],
    },
    {
      agent: "Review Pain Agent",
      score: reviewPain ? 78 : baselineScoring.categoryPercentScores.operationalPain,
      confidence: reviews.reviewCount >= 20 ? 75 : 45,
      summary: reviewPain
        ? "Review volume and rating suggest renter-experience friction worth validating."
        : "Review data does not show a strong public pain signal by itself.",
      findings: reviewPain ? [`${reviews.rating} stars across ${reviews.reviewCount} reviews.`] : [],
      concerns: reviews.reviewCount < 20 ? ["Review footprint is too small to carry the pitch alone."] : [],
      evidenceRefs: [reviews.reviewSignal].filter(Boolean),
      recommendedDiscoveryQuestions: [
        "Where do prospects or residents experience slow response today?",
        "How does the team handle after-hours leasing requests?",
      ],
    },
    {
      agent: "Growth And Market Agent",
      score: Math.max(growthScore, baselineScoring.categoryPercentScores.marketAttractiveness),
      confidence: growth.articleCount > 0 || market.source !== "fallback" ? 65 : 45,
      summary: "Growth and market indicators estimate whether the lead has urgency beyond generic fit.",
      findings: [
        ...growth.matchedTopics.map((topic) => `Matched growth topic: ${topic}.`),
        `Market pressure score is ${market.marketPressureScore}/100.`,
      ],
      concerns: growth.articleCount === 0 ? ["Recent company-level growth coverage is limited."] : [],
      evidenceRefs: growth.headlines?.slice(0, 3) || [],
      recommendedDiscoveryQuestions: [
        "Is the portfolio adding units, communities, or leasing headcount this year?",
        "What conversion or occupancy goals are most important this quarter?",
      ],
    },
  ];
}

function fallbackEvaluation(context, specialistReviews) {
  const { baselineScoring } = context;
  const finalScore = baselineScoring.score;

  return {
    finalScore,
    finalLabel: labelFor(finalScore),
    confidence: Math.round(
      specialistReviews.reduce((sum, review) => sum + Number(review.confidence || 0), 0) /
        Math.max(1, specialistReviews.length)
    ),
    rationale:
      "Fallback evaluator blended the deterministic score with specialist heuristic reviews because live AI agent analysis was unavailable.",
    scoreAdjustments: CATEGORY_KEYS.reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {}),
    repTalkingPoints: specialistReviews
      .flatMap((review) => review.findings)
      .filter(Boolean)
      .slice(0, 3),
    discoveryQuestions: specialistReviews
      .flatMap((review) => review.recommendedDiscoveryQuestions)
      .filter(Boolean)
      .slice(0, 4),
    risks: specialistReviews.flatMap((review) => review.concerns).filter(Boolean).slice(0, 4),
    nextBestAction:
      finalScore >= 75
        ? "Prioritize outreach and validate leasing response volume early."
        : finalScore >= 55
          ? "Work the lead after confirming rental portfolio fit and response pain."
          : "Do light discovery before investing heavy rep time.",
    companyOverview: "Company overview is unavailable from live AI analysis; use public search evidence and discovery to confirm business model.",
    parentCompanyInsight: "Parent/operator relationship is not confirmed from fallback analysis.",
  };
}

export async function runLeadAgents(context, config) {
  const fallbackReviews = fallbackSpecialists(context);

  if (!hasLlm(config)) {
    return {
      source: "fallback_agents",
      model: null,
      specialistReviews: fallbackReviews,
      finalEvaluation: fallbackEvaluation(context, fallbackReviews),
    };
  }

  try {
    const agentTasks = [
      {
        name: "search_research_agent",
        agent: "Search Research Agent",
        instruction:
          "Review public web search results and company/listing evidence. Identify whether the contacted property has a larger parent or management company. Score portfolio fit and size, multifamily focus, active leasing pages or listings, AI opportunity from phone/text/email workflows without chatbot coverage, and whether the evidence gives a rep a credible outreach hook.",
      },
      {
        name: "review_pain_agent",
        agent: "Review Pain Agent",
        instruction:
          "Review public ratings, review count, staffing/hiring signals, resident communication load, response complaints, and review/search complaint evidence. Decide whether operational pain is strong enough for EliseAI.",
      },
      {
        name: "growth_market_agent",
        agent: "Growth And Market Agent",
        instruction:
          "Review growth, acquisitions, new developments, geographic market, rent/income pressure, and multifamily density. Decide whether market attractiveness and scale timing make this lead worth sales attention.",
      },
    ];

    const specialistReviews = await Promise.all(
      agentTasks.map((task) =>
        requestStructuredJson({
          config,
          input: specialistInput(task.agent, task.instruction, context),
          schema: specialistSchema(task.name),
        }).then((result) => result.data)
      )
    );

    const finalEvaluationResult = await requestStructuredJson({
      config,
      input: evaluatorInput(context, specialistReviews),
      schema: evaluatorSchema(),
    });
    const finalEvaluation = finalEvaluationResult.data;

    return {
      source: `${finalEvaluationResult.source}_agents`,
      model: finalEvaluationResult.model,
      specialistReviews,
      finalEvaluation: {
        ...finalEvaluation,
        finalScore: clamp(Math.round(finalEvaluation.finalScore), 0, 100),
        finalLabel: labelFor(clamp(Math.round(finalEvaluation.finalScore), 0, 100)),
        confidence: clamp(Math.round(finalEvaluation.confidence), 0, 100),
      },
    };
  } catch {
    return {
      source: "fallback_agents",
      model: null,
      specialistReviews: fallbackReviews,
      finalEvaluation: fallbackEvaluation(context, fallbackReviews),
    };
  }
}
