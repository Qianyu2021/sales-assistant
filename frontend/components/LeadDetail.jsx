import { useState } from "react";

const SOURCE_LABEL = {
  gmail: "via Gmail inquiry",
  sheet: "via Google Sheet submission",
  manual: "Manual entry",
  csv: "via CSV",
};

function triggerLabel(source) {
  if (source === "gmail") return "Triggered from a Gmail inquiry.";
  if (source === "sheet") return "Triggered from a Google Sheet submission.";
  return "Triggered manually for enrichment.";
}

function ScoreBar({ score }) {
  const color = score >= 70 ? "#1D9E75" : score >= 45 ? "#BA7517" : "#888780";
  return (
    <div className="score-bar-bg">
      <div className="score-bar-fill" style={{ width: `${score}%`, background: color }} />
    </div>
  );
}

function categoryLabel(key) {
  const labels = {
    portfolioFitSize: "Portfolio fit and size",
    leasingDemand: "Leasing demand",
    operationalPain: "Operational pain",
    marketAttractiveness: "Market attractiveness",
    aiOpportunity: "AI opportunity",
  };
  return labels[key] || key;
}

function categoryTone(score) {
  if (score >= 70) return "category-strong";
  if (score >= 45) return "category-mid";
  return "category-light";
}

function normalizeCategoryReasonMap(reasons = []) {
  return reasons.reduce((acc, reason) => {
    acc[reason.category] = reason;
    return acc;
  }, {});
}

function ScoreSection({ lead }) {
  if (lead.status === "enriching") {
    return (
      <div className="section">
        <div className="section-head"><span className="section-title">Lead score</span></div>
        <div className="section-body enriching-state">
          <div className="enrich-spinner" />
          <div className="enrich-msg">{triggerLabel(lead.source)} Calling enrichment APIs...</div>
          <div className="enrich-steps">
            <span className="step step-done">Census API</span>
            <span className="step step-active">Places + News</span>
            <span className="step">Market scoring</span>
            <span className="step">AI agents</span>
          </div>
        </div>
      </div>
    );
  }

  if (lead.status === "failed") {
    return (
      <div className="section">
        <div className="section-head"><span className="section-title">Lead score</span></div>
        <div className="section-body">
          <div className="error-card">
            <div className="error-title">Enrichment failed</div>
            <div className="error-text">{lead.error || "We could not score this property."}</div>
          </div>
        </div>
      </div>
    );
  }

  const totalScore = lead.scorecard?.total ?? lead.score ?? 0;
  const scoreLabel = lead.scorecard?.label ?? lead.scoreLabel;
  const categories = Object.values(lead.scorecard?.categories || {});
  const reasonByCategory = normalizeCategoryReasonMap(lead.narrative?.reasons);
  const labelClass = scoreLabel === "Hot" ? "pill-hot" : scoreLabel === "Warm" ? "pill-warm" : "pill-cold";

  return (
    <div className="section">
      <div className="section-head">
        <span className="section-title">Lead score</span>
        <span className={`pill ${labelClass}`}>{scoreLabel} — {totalScore} / 100</span>
      </div>
      <div className="section-body">
        <div className="score-layout">
          <div className="score-number" style={{ color: totalScore >= 70 ? "#085041" : totalScore >= 45 ? "#633806" : "#444441" }}>
            {totalScore}
          </div>
          <div className="score-right">
            <ScoreBar score={totalScore} />
            {lead.narrative?.summary && (
              <p className="score-summary">{lead.narrative.summary}</p>
            )}
          </div>
        </div>
        {categories.length > 0 && (
          <div className="category-grid">
            {categories.map((category) => (
              <div key={category.key} className={`category-card ${categoryTone(category.percentScore ?? category.score)}`}>
                <div className="category-head">
                  <span className="category-title">{categoryLabel(category.key)}</span>
                  <span className="category-score">{category.score}/{category.maxScore || 100}</span>
                </div>
                <ScoreBar score={category.percentScore ?? category.score} />
                <div className="category-meta">
                  <span>{category.maxScore || Math.round(category.weight * 100)} pts max</span>
                  <span>{Math.round(category.percentScore ?? category.score)}%</span>
                </div>
                <p className="category-copy">{category.insight}</p>
                {lead.signals?.[category.key]?.detail && (
                  <p className="category-deep">{lead.signals[category.key].detail}</p>
                )}
                {reasonByCategory[category.key]?.body && (
                  <p className="category-deep">{reasonByCategory[category.key].body}</p>
                )}
                {reasonByCategory[category.key]?.implication && (
                  <div className="category-implication">{reasonByCategory[category.key].implication}</div>
                )}
              </div>
            ))}
          </div>
        )}
        {Array.isArray(lead.scorecard?.assumptions) && lead.scorecard.assumptions.length > 0 && (
          <div className="assumptions-block">
            <div className="assumptions-title">Lead scoring assumptions</div>
            <div className="assumptions-list">
              {lead.scorecard.assumptions.map((assumption) => (
                <div key={assumption} className="assumption-item">{assumption}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmailSection({ email }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!email) return null;

  return (
    <div className="section">
      <div className="section-head">
        <span className="section-title">Draft outreach email</span>
        <button className="copy-btn" onClick={copy}>{copied ? "Copied!" : "Copy"}</button>
      </div>
      <div className="section-body">
        <pre className="email-text">{email}</pre>
      </div>
    </div>
  );
}

function InsightsSection({ insights }) {
  if (!insights) return null;
  return (
    <div className="section">
      <div className="section-head"><span className="section-title">Sales insights</span></div>
      <div className="section-body">
        {insights.summary && <p className="insight-summary">{insights.summary}</p>}
        {insights.scoreSummary && (
          <div className="overall-analysis">
            <div className="action-label">Score interpretation</div>
            <div className="analysis-text">{insights.scoreSummary}</div>
          </div>
        )}
        {insights.overallAnalysis && (
          <div className="overall-analysis">
            <div className="action-label">Overall analysis</div>
            <div className="analysis-text">{insights.overallAnalysis}</div>
          </div>
        )}
        {insights.nextBestAction && (
          <div className="action-callout">
            <div className="action-label">Recommended next step</div>
            <div className="action-text">{insights.nextBestAction}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeadDetail({ lead }) {
  if (!lead) return (
    <div className="detail-empty">Select a lead to view enrichment</div>
  );

  const emailDraft = lead.draftEmail || "Draft outreach email will appear here after enrichment completes.";

  return (
    <main className="detail">
      <div className="detail-header">
        <div>
          <div className="detail-title">{lead.firstName} {lead.lastName} · {lead.company}</div>
          <div className="detail-meta">
            {lead.address && `${lead.address}, `}{lead.city} {lead.state}
            {lead.enrichedAt && ` · enriched ${lead.enrichedAt}`}
          </div>
        </div>
        <span className="source-tag">{SOURCE_LABEL[lead.source]}</span>
      </div>

      <div className="detail-body">
        <ScoreSection lead={lead} />
        {lead.status === "enriched" && (
          <>
            <InsightsSection insights={lead.insights} />
            <EmailSection email={emailDraft} />
          </>
        )}
        {lead.status !== "enriched" && <EmailSection email={emailDraft} />}
      </div>
    </main>
  );
}
