import { asCurrency } from "./format.js";
import { normalizeLead } from "../providers/company.js";
import { findLocation } from "../providers/location.js";
import { findDemographics } from "../providers/demographics.js";
import { findReviews } from "../providers/reviews.js";
import { findGrowthSignals } from "../providers/news.js";
import { findMarketPressure } from "../providers/market.js";
import { findSearchSignals } from "../providers/search.js";
import { runLeadAgents } from "../providers/agents.js";
import { scoreProperty } from "../providers/scoring.js";
import { writeLeadNarrative } from "../providers/narrative.js";

function extractQuestion(rawInput = "") {
  const question = rawInput
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => line.endsWith("?"));
  return question || "";
}

function greetingName(lead) {
  if (lead.source === "gmail" && !["from_header", "signature", "ai"].includes(lead.senderNameSource)) {
    return "there";
  }
  return lead.firstName || "there";
}

function composeGmailReplyEmail(lead, location, scoring, search, narrative) {
  const propertyReference = lead.propertyName || lead.apartmentName || lead.company;
  const operatorReference = search.parentCompany?.name || lead.operatorName || lead.company;
  const question = extractQuestion(lead.rawInput);
  const cityReference = [location.city, location.state].filter(Boolean).join(", ");
  const inquiryContext = question
    ? `your question: "${question}"`
    : `EliseAI for ${propertyReference || "your property team"}`;

  return `Subject: Re: ${propertyReference || "Leasing AI inquiry"}

Hi ${greetingName(lead)},

Thanks for reaching out about ${inquiryContext}. Happy to help.

EliseAI is built for apartment operators and property management teams that want faster leasing follow-up, stronger lead conversion, and fewer missed resident or prospect conversations. For ${operatorReference}${cityReference ? ` in ${cityReference}` : ""}, the most relevant fit would likely be automating repetitive leasing questions, tour follow-up, availability questions, and handoff to the right team.

At a high level, EliseAI can help with:
- respond to leasing inquiries across web, text, email, and phone-style workflows
- answer common questions about availability, tours, pricing, amenities, and next steps
- route qualified prospects to the right leasing team
- reduce repetitive manual follow-up while keeping the prospect experience consistent

To make sure I point you in the right direction, a few helpful questions:
- How many leasing inquiries does your team handle each week?
- Which channels create the most missed or delayed responses today?
- Are you looking to support one community first, or multiple properties under the same operator?

Would you be open to a quick call this week to understand your current leasing workflow and see whether EliseAI is a fit?

Best,
[Your name]`;
}

function composeProspectingEmail(lead, location, scoring, demographics, reviews, growth, search, narrative) {
  const searchSignals = search.matchedSignals?.map((signal) => signal.label.toLowerCase()) || [];
  const momentum = searchSignals.length
    ? `Public search results also point to ${searchSignals.slice(0, 2).join(" and ")}.`
    : growth.matchedTopics.length
    ? `Recent signals point to ${growth.matchedTopics.join(", ")} activity.`
    : "The market profile suggests there is room to improve leasing responsiveness.";
  const cityReference = [location.city, location.state].filter(Boolean).join(", ");
  const firstReasonTitle = narrative.reasons?.[0]?.title || "Operational fit";
  const firstReasonBody = narrative.reasons?.[0]?.body || "leasing response speed and coverage stands out as a likely area of value";
  const opener =
    reviews.reviewCount >= 20
      ? `I took a look at ${lead.company}${cityReference ? ` in ${cityReference}` : ""} and noticed a public review profile of ${reviews.rating} stars across ${reviews.reviewCount} reviews.`
      : `I took a look at ${lead.company}${cityReference ? ` in ${cityReference}` : ""} and found a market with median income around ${asCurrency(demographics.medianIncome)}.`;

  return `Subject: Leasing performance at ${lead.company}

Hi ${greetingName(lead)},

${opener}

One thing that stood out is the ${firstReasonTitle.toLowerCase()} signal: ${firstReasonBody}

${momentum} EliseAI is usually a fit when teams need better after-hours coverage, faster follow-up, and more consistent tour conversion without adding manual workload.

Based on the signals we pulled, this looks like a ${scoring.scoreLabel.toLowerCase()}-priority opportunity for automation, especially if leasing demand is already creating operational drag.

Would you be open to a quick demo this week?

Best,
[Your name]`;
}

function composeDraftEmail(lead, location, scoring, demographics, reviews, growth, search, narrative) {
  if (lead.source === "gmail") {
    return composeGmailReplyEmail(lead, location, scoring, search, narrative);
  }

  return composeProspectingEmail(lead, location, scoring, demographics, reviews, growth, search, narrative);
}

function buildSignals(lead, demographics, reviews, growth, market, search, scoring) {
  const operator = search.parentCompany;
  const operatorText = operator
    ? operator.portfolio
      ? `${operator.name || operator.domain} detected as operator (${operator.portfolio.properties} properties / ${operator.portfolio.units.toLocaleString()} units)`
      : `${operator.name || operator.domain} detected as operator`
    : lead.operatorName || lead.senderCompany
      ? `${lead.operatorName || lead.senderCompany} came from the inbound email/signature but still needs public verification`
      : "no parent/operator confirmed";
  const operatorAddress = lead.operatorAddress || lead.senderCompanyAddress;
  const operatorAddressText = operatorAddress ? ` Operator/sender office address captured: ${operatorAddress}.` : "";
  const websiteText = search.topResults?.[0]?.link ? ` Top public evidence: ${search.topResults[0].title}.` : "";

  return {
    portfolioFitSize: {
      label: "Portfolio evidence",
      value: `${scoring.categoryScores.portfolioFitSize} / ${scoring.maxPoints.portfolioFitSize}`,
      detail: `${Math.round(demographics.multiUnitShare * 100)}% multifamily concentration, ${reviews.reviewCount} reviews, ${search.resultCount} public web results checked, and ${operatorText}.${operatorAddressText}${websiteText}`,
    },
    leasingDemand: {
      label: "Leasing demand evidence",
      value: `${scoring.categoryScores.leasingDemand} / ${scoring.maxPoints.leasingDemand}`,
      detail: `Built from listing/availability clues, growth topics (${growth.matchedTopics.join(", ") || "none"}), vacancy (${market.rentalVacancyRate}%), and rent trend (${market.rentInflationYoY}%).`,
    },
    operationalPain: {
      label: "Operational pain evidence",
      value: `${scoring.categoryScores.operationalPain} / ${scoring.maxPoints.operationalPain}`,
      detail: `${reviews.rating} stars across ${reviews.reviewCount} reviews plus staffing, response, and resident communication signals. Search evidence checked for phone, response, maintenance, leasing-office, staffing, hiring, and review pressure.`,
    },
    marketAttractiveness: {
      label: "Market evidence",
      value: `${scoring.categoryScores.marketAttractiveness} / ${scoring.maxPoints.marketAttractiveness}`,
      detail: `${asCurrency(demographics.medianIncome)} median income, ${Math.round(demographics.multiUnitShare * 100)}% multifamily concentration, vacancy ${market.rentalVacancyRate}%.`,
    },
    aiOpportunity: {
      label: "AI opportunity evidence",
      value: `${scoring.categoryScores.aiOpportunity} / ${scoring.maxPoints.aiOpportunity}`,
      detail: "Scores higher when public evidence shows phone, text, email, or contact-form workflows without visible chatbot coverage; visible chat/automation lowers this category.",
    },
  };
}

function buildScorecard(scoring) {
  return {
    total: scoring.score,
    label: scoring.scoreLabel,
    assumptions: scoring.assumptions,
    categories: scoring.categories,
  };
}

function buildInsights(location, demographics, reviews, growth, market, search, agentAnalysis, scoring, narrative) {
  const finalEvaluation = agentAnalysis?.finalEvaluation;

  return {
    summary: narrative.summary,
    scoreSummary: narrative.scoreSummary,
    overallAnalysis: narrative.overallAnalysis,
    nextBestAction: narrative.nextBestAction,
    repTalkingPoints: narrative.repTalkingPoints,
    market: [location.city, location.state].filter(Boolean).join(", ") || location.formattedAddress,
    matchedAddress: location.formattedAddress,
    zipCode: location.zipCode || "Unavailable",
    medianIncome: asCurrency(demographics.medianIncome),
    portfolioScaleProxy: `${Math.round(demographics.multiUnitShare * 100)}% multifamily share`,
    reviews: `${reviews.rating} stars across ${reviews.reviewCount} reviews`,
    reviewSignal: reviews.reviewSignal,
    growthSignals: growth.headlines.length
      ? growth.headlines.join(" | ")
      : "No strong recent headline matches",
    searchFindings: search.evidence?.length
      ? search.evidence
          .slice(0, 3)
          .map((item) => `${item.title}: ${item.signals.join(", ")}`)
          .join(" | ")
      : "No strong public web evidence captured",
    agentEvaluation: finalEvaluation
      ? `${finalEvaluation.finalLabel} at ${finalEvaluation.finalScore}/100 confidence ${finalEvaluation.confidence}/100`
      : "Agent evaluation unavailable",
    agentRationale: finalEvaluation?.rationale || "No agent rationale available",
    companyOverview: finalEvaluation?.companyOverview || "Company overview not available from public evidence.",
    parentCompanyInsight:
      finalEvaluation?.parentCompanyInsight ||
      (search.parentCompany?.portfolio
        ? `${search.parentCompany.insight} ${search.parentCompany.portfolio.description}`
        : search.parentCompany?.insight) ||
      "Parent/operator relationship not confirmed from public evidence.",
    marketPressure: `Vacancy ${market.rentalVacancyRate}% and rent CPI trend ${market.rentInflationYoY}%`,
    scoreDrivers: `Portfolio ${scoring.categoryScores.portfolioFitSize}/${scoring.maxPoints.portfolioFitSize}, leasing ${scoring.categoryScores.leasingDemand}/${scoring.maxPoints.leasingDemand}, ops ${scoring.categoryScores.operationalPain}/${scoring.maxPoints.operationalPain}, market ${scoring.categoryScores.marketAttractiveness}/${scoring.maxPoints.marketAttractiveness}, AI opportunity ${scoring.categoryScores.aiOpportunity}/${scoring.maxPoints.aiOpportunity}`,
  };
}

export async function enrichLead(input, config) {
  const lead = normalizeLead(input);
  if (!lead.email) {
    throw new Error("Email is required");
  }

  const location = await findLocation(lead, config);
  const demographics = await findDemographics(lead, location, config);
  const reviews = await findReviews(lead, location, config);
  const growth = await findGrowthSignals(lead, config);
  const market = await findMarketPressure(lead, config);
  const search = await findSearchSignals(lead, location, config, reviews);
  const baselineScoring = scoreProperty({ lead, location, demographics, reviews, growth, market, search });
  const agentAnalysis = await runLeadAgents(
    { lead, location, demographics, reviews, growth, market, search, baselineScoring },
    config
  );
  const scoring = scoreProperty({
    lead,
    location,
    demographics,
    reviews,
    growth,
    market,
    search,
    agentEvaluation: agentAnalysis.finalEvaluation,
    agentSource: agentAnalysis.source,
  });
  const normalizedAgentAnalysis = {
    ...agentAnalysis,
    finalEvaluation: {
      ...agentAnalysis.finalEvaluation,
      finalScore: scoring.score,
      finalLabel: scoring.scoreLabel,
    },
  };
  const scorecard = buildScorecard(scoring);
  const narrative = await writeLeadNarrative(
    { lead, location, demographics, reviews, growth, market, search, agentAnalysis: normalizedAgentAnalysis, scoring, scorecard },
    config
  );

  return {
    ...lead,
    status: "enriched",
    enrichedAt: "just now",
    score: scoring.score,
    scoreLabel: scoring.scoreLabel,
    scorecard,
    signals: buildSignals(lead, demographics, reviews, growth, market, search, scoring),
    insights: buildInsights(location, demographics, reviews, growth, market, search, normalizedAgentAnalysis, scoring, narrative),
    narrative,
    draftEmail: composeDraftEmail(lead, location, scoring, demographics, reviews, growth, search, narrative),
    enrichmentMeta: {
      providers: {
        location: location.source,
        demographics: demographics.source,
        reviews: reviews.source,
        growth: growth.source,
        search: search.source,
        market: market.source,
      },
      location,
      demographics,
      reviews,
      growth,
      search,
      market,
      agentAnalysis: normalizedAgentAnalysis,
      baselineCategoryScores: scoring.baselineCategoryScores,
      categoryScores: scoring.categoryScores,
      scoreWeights: scoring.weights,
      scoringAssumptions: scoring.assumptions,
      categoryInsights: scoring.categoryInsights,
      scorecard,
      narrative,
    },
  };
}
