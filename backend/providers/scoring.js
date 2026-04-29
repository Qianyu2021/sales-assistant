function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const MAX_POINTS = {
  portfolioFitSize: 30,
  leasingDemand: 25,
  operationalPain: 25,
  marketAttractiveness: 15,
  aiOpportunity: 5,
};

const SCORING_ASSUMPTIONS = [
  "Portfolio fit and size is scored out of 30 points. Multiple apartment communities, student housing, commercial/residential rental operations, or a parent management company increase automation ROI.",
  "Leasing demand is scored out of 25 points. Active availability pages, floor plans, tour CTAs, listings, low vacancy, rent pressure, and growth all suggest lead flow.",
  "Operational pain is scored out of 25 points. Staffing pressure, response complaints, weak reviews at meaningful review volume, and resident communication load create urgency.",
  "Market attractiveness is scored out of 15 points. Dense, competitive, high-rent metro markets make speed-to-lead more valuable.",
  "AI opportunity is scored out of 5 points. If a company relies on phone, text, email, and contact forms without visible chatbot/AI coverage, there is more room for EliseAI.",
  "Agent findings can adjust category scores when public evidence is more specific than structured APIs.",
];

const CATEGORY_LABELS = {
  portfolioFitSize: "Portfolio fit and size",
  leasingDemand: "Leasing demand",
  operationalPain: "Operational pain",
  marketAttractiveness: "Market attractiveness",
  aiOpportunity: "AI opportunity",
};

function incomeFitScore(medianIncome) {
  return clamp(Math.round(((medianIncome - 45000) / 70000) * 100), 0, 100);
}

function multiUnitScore(multiUnitShare) {
  return clamp(Math.round(multiUnitShare * 100), 0, 100);
}

function reviewBaseScore(reviewCount) {
  return clamp(Math.round((Math.log10(reviewCount + 1) / 2.2) * 100), 0, 100);
}

function reviewPainScore(rating, reviewCount) {
  const ratingStress = clamp(Math.round(((5 - rating) / 2.5) * 100), 0, 100);
  return Math.round(ratingStress * 0.65 + reviewBaseScore(reviewCount) * 0.35);
}

function signalCount(search = {}, keys = []) {
  return (search.matchedSignals || [])
    .filter((signal) => keys.includes(signal.key))
    .reduce((sum, signal) => sum + Number(signal.count || 1), 0);
}

function signalScore(search = {}, keys = []) {
  return clamp(signalCount(search, keys) * 22, 0, 100);
}

function portfolioFitSizePercent({ demographics, reviews, search }) {
  const fitSignals = signalScore(search, ["portfolioSize", "rentalFit"]);
  const residentBase = reviewBaseScore(reviews.reviewCount);
  const parentOperator = search.parentCompany?.portfolio ? 100 : search.parentCompany ? 85 : 0;
  const score = Math.round(
    multiUnitScore(demographics.multiUnitShare) * 0.25 +
      fitSignals * 0.35 +
      residentBase * 0.15 +
      parentOperator * 0.25
  );

  if (search.parentCompany?.portfolio) {
    return Math.max(score, 80);
  }

  if (search.parentCompany) {
    return Math.max(score, 68);
  }

  return score;
}

function leasingDemandPercent({ growth, market, search }) {
  const listingSignals = signalScore(search, ["leasingActivity", "rentalFit"]);
  return Math.round(listingSignals * 0.5 + market.marketPressureScore * 0.3 + growth.growthSignalScore * 0.2);
}

function operationalPainPercent({ reviews, search }) {
  const staffingAndResponse = signalScore(search, ["responsePain", "reputation", "growth"]);
  const communicationLoad = reviewBaseScore(reviews.reviewCount);
  const parentComplexity = search.parentCompany ? 70 : 0;
  return Math.round(
    reviewPainScore(reviews.rating, reviews.reviewCount) * 0.25 +
      communicationLoad * 0.35 +
      staffingAndResponse * 0.3 +
      parentComplexity * 0.1
  );
}

function marketAttractivenessPercent({ demographics, market, location }) {
  const metroSignal = location.city && location.state ? 60 : 35;
  return Math.round(
    market.marketPressureScore * 0.45 +
      incomeFitScore(demographics.medianIncome) * 0.3 +
      multiUnitScore(demographics.multiUnitShare) * 0.15 +
      metroSignal * 0.1
  );
}

function aiOpportunityPercent({ search }) {
  const traditionalContact = signalScore(search, ["aiOpportunity"]);
  const existingChat = signalScore(search, ["chatbotPresent"]);

  if (traditionalContact > 0 && existingChat === 0) return 100;
  if (traditionalContact > 0 && existingChat > 0) return 45;
  if (existingChat > 0) return 20;
  return 55;
}

function toPoints(percentScore, maxScore) {
  return Number(((clamp(percentScore, 0, 100) / 100) * maxScore).toFixed(1));
}

function buildCategoryInsights(categoryPercentScores, categoryPoints, metrics) {
  const agentNote = ["openai_agents", "gemini_agents"].includes(metrics.agentSource)
    ? " AI agent review also informed this score."
    : "";

  return {
    portfolioFitSize:
      categoryPercentScores.portfolioFitSize >= 70
        ? `Strong scale signal: public evidence points toward multiple rental properties, apartment communities, student housing, or a larger parent/operator.${metrics.parentCompany ? ` Detected operator: ${metrics.parentCompany.name || metrics.parentCompany.domain}${metrics.parentCompany.portfolio ? ` (${metrics.parentCompany.portfolio.properties} properties / ${metrics.parentCompany.portfolio.units.toLocaleString()} units)` : ""}.` : ""}${agentNote}`
        : `Portfolio size or parent-company scale is not strongly verified yet, so reps should confirm communities, unit count, and management company ownership early.`,
    leasingDemand:
      categoryPercentScores.leasingDemand >= 70
        ? `Leasing demand looks active through availability/listing signals, market pressure, tour CTAs, or growth evidence.${agentNote}`
        : `Leasing activity is not clearly visible, so inquiry volume, active listings, and vacancy should be validated before prioritizing heavily.`,
    operationalPain:
      categoryPercentScores.operationalPain >= 70
        ? `Operational pain looks meaningful through reviews, staffing/response signals, hiring, or resident communication load.${agentNote}`
        : `Operational pain is not obvious from public data, so discovery should focus on missed calls, slow follow-up, leasing workload, and resident volume.`,
    marketAttractiveness:
      categoryPercentScores.marketAttractiveness >= 70
        ? `The market profile suggests competitive leasing conditions where speed and conversion can matter.`
        : `Market demand appears more moderate, so urgency depends more on company-level scale and pain.`,
    aiOpportunity:
      categoryPercentScores.aiOpportunity >= 70
        ? `The public contact model appears phone/text/email/contact-form heavy without clear chatbot coverage, leaving room for EliseAI.`
        : `AI opportunity is lighter because the public web evidence either shows existing chat/automation or does not reveal the contact workflow clearly.`,
  };
}

function applyAgentAdjustments(categoryPercentScores, agentEvaluation) {
  const adjustments = agentEvaluation?.scoreAdjustments || {};

  return Object.entries(categoryPercentScores).reduce((acc, [key, value]) => {
    const adjustment = Number(adjustments[key] || 0);
    acc[key] = clamp(Math.round(value + clamp(adjustment, -25, 25)), 0, 100);
    return acc;
  }, {});
}

export function scoreProperty({
  lead,
  location,
  demographics,
  reviews,
  growth,
  market,
  search,
  agentEvaluation,
  agentSource,
}) {
  const baselineCategoryPercentScores = {
    portfolioFitSize: portfolioFitSizePercent({ demographics, reviews, search }),
    leasingDemand: leasingDemandPercent({ growth, market, search }),
    operationalPain: operationalPainPercent({ reviews, search }),
    marketAttractiveness: marketAttractivenessPercent({ demographics, market, location }),
    aiOpportunity: aiOpportunityPercent({ search }),
  };

  const categoryPercentScores = agentEvaluation
    ? applyAgentAdjustments(baselineCategoryPercentScores, agentEvaluation)
    : baselineCategoryPercentScores;

  const categoryScores = Object.entries(categoryPercentScores).reduce((acc, [key, percentScore]) => {
    acc[key] = toPoints(percentScore, MAX_POINTS[key]);
    return acc;
  }, {});

  const score = Number(
    Object.values(categoryScores)
      .reduce((sum, value) => sum + value, 0)
      .toFixed(1)
  );
  const roundedScore = Math.round(score);
  const scoreLabel = roundedScore >= 75 ? "Hot" : roundedScore >= 55 ? "Warm" : "Cold";

  const categoryInsights = buildCategoryInsights(categoryPercentScores, categoryScores, {
    zipCode: location.zipCode,
    company: lead.company,
    searchSource: search?.source,
    agentSource,
    parentCompany: search?.parentCompany,
  });

  const categories = Object.entries(categoryScores).reduce((acc, [key, points]) => {
    const maxScore = MAX_POINTS[key];
    acc[key] = {
      key,
      label: CATEGORY_LABELS[key],
      score: points,
      maxScore,
      percentScore: categoryPercentScores[key],
      weight: maxScore / 100,
      weightedContribution: points,
      insight: categoryInsights[key],
    };
    return acc;
  }, {});

  return {
    score: roundedScore,
    rawScore: score,
    scoreLabel,
    assumptions: SCORING_ASSUMPTIONS,
    baselineCategoryPercentScores,
    categoryPercentScores,
    categoryScores,
    maxPoints: MAX_POINTS,
    weights: Object.fromEntries(Object.entries(MAX_POINTS).map(([key, value]) => [key, value / 100])),
    categoryInsights,
    categories,
    agentAdjusted: Boolean(agentEvaluation),
  };
}
