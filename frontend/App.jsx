import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import LeadDetail from "./components/LeadDetail";
import "./App.css";

const ENRICHMENT_ENDPOINT =
  import.meta.env.VITE_ENRICHMENT_WEBHOOK_PATH || "/api/leads/enrich";
const LEADS_ENDPOINT = import.meta.env.VITE_LEADS_ENDPOINT || "/api/leads";
const GMAIL_STATUS_ENDPOINT = import.meta.env.VITE_GMAIL_STATUS_ENDPOINT || "/api/gmail/status";
const GMAIL_CONNECT_ENDPOINT = import.meta.env.VITE_GMAIL_CONNECT_ENDPOINT || "/api/gmail/connect";

const MOCK_LEADS = [
  {
    id: 1,
    firstName: "Sarah",
    lastName: "Chen",
    email: "s.chen@greywoodprops.com",
    company: "Greywood Properties",
    address: "4821 Lakeview Drive",
    city: "Austin",
    state: "TX",
    source: "gmail",
    status: "enriched",
    score: 78,
    scoreLabel: "Hot",
    scorecard: {
      total: 78,
      label: "Hot",
      assumptions: [
        "Larger multifamily footprints usually create stronger ROI for EliseAI because inbound leasing volume is harder to manage manually.",
        "Lower review quality at meaningful review volume can signal service friction that conversational automation may help absorb.",
        "Growth and market pressure matter most when they reinforce real operational need rather than replace it.",
      ],
      categories: {
        scale: {
          key: "scale",
          score: 82,
          weight: 0.2,
          weightedContribution: 16.4,
          insight: "Dense multifamily footprint in ZIP 78702 suggests meaningful portfolio scale.",
        },
        operationalPain: {
          key: "operationalPain",
          score: 74,
          weight: 0.25,
          weightedContribution: 18.5,
          insight: "Reviews suggest real operational friction that leasing automation could help absorb.",
        },
        incomeFit: {
          key: "incomeFit",
          score: 68,
          weight: 0.15,
          weightedContribution: 10.2,
          insight: "Median household income supports a stronger renter base and a healthier leasing profile.",
        },
        growth: {
          key: "growth",
          score: 79,
          weight: 0.2,
          weightedContribution: 15.8,
          insight: "Recent company mentions suggest expansion or momentum worth prioritizing.",
        },
        marketPressure: {
          key: "marketPressure",
          score: 86,
          weight: 0.2,
          weightedContribution: 17.2,
          insight: "Market pressure is elevated enough to make response speed and conversion efficiency matter.",
        },
      },
    },
    enrichedAt: "just now",
    signals: {
      medianIncome: {
        label: "Median household income",
        value: "$68,400",
        detail: "Used as a proxy for renter economics and budget resilience in the market.",
      },
      portfolioScale: {
        label: "Multifamily concentration",
        value: "64%",
        detail: "Higher concentration suggests more leasing complexity and stronger automation ROI.",
      },
      reviews: {
        label: "Public review profile",
        value: "3.7 / 5",
        detail: "142 public reviews were available as external operating signals.",
      },
      growth: {
        label: "Recent growth signals",
        value: "4 matches",
        detail: "Matched expansion and hiring activity in recent coverage.",
      },
      marketPressure: {
        label: "Market pressure score",
        value: "86 / 100",
        detail: "Built from vacancy and rent-trend pressure in the local rental market.",
      },
      opsScore: {
        label: "Operational pain score",
        value: "74 / 100",
        detail: "Derived from review rating and review volume to estimate service friction.",
      },
    },
    insights: {
      summary: "Greywood Properties looks like a strong automation prospect right now.",
      overallAnalysis: "Greywood stands out because the signals stack in the same direction instead of pulling against each other. The market looks active, the portfolio proxy is large enough to suggest real process complexity, and the review profile hints at some operational strain. For EliseAI, that combination is attractive because it creates both ROI potential and a credible opening message. A rep can frame the conversation around leasing responsiveness rather than a generic automation pitch. The strongest version of this outreach is not just that the property is large, but that it appears large enough for process drag to matter and active enough for faster follow-up to be commercially relevant. If discovery confirms heavy inquiry volume or thin leasing coverage, this should behave like a genuinely high-priority account.",
      scoreSummary: "Greywood earns a high score because scale, growth, market urgency, and signs of operational friction all reinforce one another instead of cancelling out.",
      nextBestAction: "Lead with response-time pain and recent growth momentum in the first touch.",
      repTalkingPoints: [
        "Position EliseAI as a way to keep inquiry response times tight without adding manual leasing headcount.",
        "Use the review footprint as outside evidence that lead handling and resident communication may already be under pressure.",
        "Tie the pitch to current growth so automation feels like infrastructure for expansion, not just cost reduction.",
      ],
      market: "Austin, TX",
      medianIncome: "$68,400",
      matchedAddress: "4821 Lakeview Drive, Austin, TX",
      zipCode: "78702",
      portfolioScaleProxy: "64% multifamily share",
      reviews: "3.7 stars across 142 reviews",
      reviewSignal: "Review friction suggests operational pain",
      growthSignals: "Greywood expands Austin leasing footprint | Greywood hiring across central Texas",
      marketPressure: "Vacancy 5.8% and rent CPI trend 3.7%",
      scoreDrivers: "Scale 82, ops 74, income 68, growth 79, market 86",
    },
    narrative: {
      summary: "Greywood Properties looks like a strong automation prospect right now.",
      overallAnalysis: "Greywood stands out because the signals stack in the same direction instead of pulling against each other. The market looks active, the portfolio proxy is large enough to suggest real process complexity, and the review profile hints at some operational strain. For EliseAI, that combination is attractive because it creates both ROI potential and a credible opening message. A rep can frame the conversation around leasing responsiveness rather than a generic automation pitch. The strongest version of this outreach is not just that the property is large, but that it appears large enough for process drag to matter and active enough for faster follow-up to be commercially relevant. If discovery confirms heavy inquiry volume or thin leasing coverage, this should behave like a genuinely high-priority account.",
      nextBestAction: "Lead with response-time pain and recent growth momentum in the first touch.",
      repTalkingPoints: [
        "Position EliseAI as a way to keep inquiry response times tight without adding manual leasing headcount.",
        "Use the review footprint as outside evidence that lead handling and resident communication may already be under pressure.",
        "Tie the pitch to current growth so automation feels like infrastructure for expansion, not just cost reduction.",
      ],
      reasons: [
        {
          category: "marketPressure",
          title: "Market urgency is elevated",
          body: "Austin pressure looks high enough that faster inquiry coverage and conversion can matter materially.",
          implication: "This gives the rep a business urgency angle instead of a pure product pitch.",
        },
        {
          category: "operationalPain",
          title: "Reviews hint at service strain",
          body: "The public review profile suggests enough leasing friction to make an automation conversation credible.",
          implication: "This helps justify why process improvement should feel timely, not theoretical.",
        },
        {
          category: "growth",
          title: "Expansion gives the pitch timing",
          body: "Recent momentum signals make this feel like a scale-up conversation rather than a speculative check-in.",
          implication: "A rep can connect automation to operational readiness during growth.",
        },
      ],
    },
    draftEmail: `Subject: Automate leasing at Greywood Properties

Hi Sarah,

I noticed Greywood Properties manages multifamily units in Austin — a market where renter demand has stayed strong (64% renter ratio). Teams managing properties at that walkability tier typically see the highest volume of inbound leasing inquiries.

EliseAI automates those conversations 24/7 so your team can focus on tours and closing. Happy to show you a 10-min demo tailored to Austin-market properties.

Worth a quick call this week?

Best,
[Your name]`,
  },
  {
    id: 2,
    firstName: "Marcus",
    lastName: "Reid",
    email: "m.reid@apexliving.com",
    company: "Apex Living Group",
    address: "220 Riverside Blvd",
    city: "Denver",
    state: "CO",
    source: "sheet",
    status: "enriched",
    score: 54,
    scoreLabel: "Warm",
    scorecard: {
      total: 54,
      label: "Warm",
      assumptions: [
        "Larger multifamily footprints usually create stronger ROI for EliseAI because inbound leasing volume is harder to manage manually.",
        "Lower review quality at meaningful review volume can signal service friction that conversational automation may help absorb.",
        "Growth and market pressure matter most when they reinforce real operational need rather than replace it.",
      ],
      categories: {
        scale: {
          key: "scale",
          score: 49,
          weight: 0.2,
          weightedContribution: 9.8,
          insight: "Moderate multifamily density suggests a smaller or mixed-property opportunity set.",
        },
        operationalPain: {
          key: "operationalPain",
          score: 57,
          weight: 0.25,
          weightedContribution: 14.3,
          insight: "Public review signals are relatively stable, so pain may be present but less urgent.",
        },
        incomeFit: {
          key: "incomeFit",
          score: 72,
          weight: 0.15,
          weightedContribution: 10.8,
          insight: "Median household income supports a stronger renter base and a healthier leasing profile.",
        },
        growth: {
          key: "growth",
          score: 38,
          weight: 0.2,
          weightedContribution: 7.6,
          insight: "External growth signals are limited, so this lead looks more operational than expansion-driven.",
        },
        marketPressure: {
          key: "marketPressure",
          score: 58,
          weight: 0.2,
          weightedContribution: 11.6,
          insight: "Market pressure appears manageable, so urgency may depend more on company-level issues.",
        },
      },
    },
    enrichedAt: "3 min ago",
    signals: {
      medianIncome: {
        label: "Median household income",
        value: "$74,200",
        detail: "Used as a proxy for renter economics and budget resilience in the market.",
      },
      portfolioScale: {
        label: "Multifamily concentration",
        value: "51%",
        detail: "Suggests a moderate multifamily footprint rather than a clearly scaled operator.",
      },
      reviews: {
        label: "Public review profile",
        value: "4.1 / 5",
        detail: "37 public reviews were available as external operating signals.",
      },
      growth: {
        label: "Recent growth signals",
        value: "1 match",
        detail: "Only light external momentum was detected, so growth should be validated in discovery.",
      },
      marketPressure: {
        label: "Market pressure score",
        value: "58 / 100",
        detail: "Market conditions are relevant but not intense enough to create urgency by themselves.",
      },
      opsScore: {
        label: "Operational pain score",
        value: "57 / 100",
        detail: "Some friction may be present, but public proof is moderate rather than strong.",
      },
    },
    insights: {
      summary: "Apex Living Group looks worth pursuing, with a few signals to validate in discovery.",
      overallAnalysis: "Apex is a decent lead, but the case is less self-evident than Greywood. The surrounding renter economics are healthy and there are some operational indicators worth probing, but the portfolio and growth signals are more moderate. That means EliseAI may still be a fit, though the rep will need discovery to confirm whether the team is truly feeling enough leasing pain for automation to be urgent. This is more of a qualify-and-shape opportunity than an obvious fast-track account. The main question is not whether the company is bad fit, but whether there is enough inquiry volume, staffing pressure, or inconsistency in follow-up to justify near-term action. If the rep hears that leasing teams are stretched, after-hours coverage is weak, or response speed is slipping, the opportunity should move up quickly.",
      scoreSummary: "Apex scores in the middle because the economic backdrop is decent, but the outside evidence for urgency and scale is only moderate.",
      nextBestAction: "Confirm current staffing and leasing workflow pain before positioning automation as urgent.",
      repTalkingPoints: [
        "Open with the cost of delayed responses and after-hours inquiry gaps rather than assuming a scale story.",
        "Use the stable income profile to support ROI, but validate whether leasing volume is large enough to matter.",
        "Ask directly about current CRM, tour scheduling workflow, and who owns inbound follow-up today.",
      ],
      market: "Denver, CO",
      medianIncome: "$74,200",
      matchedAddress: "220 Riverside Blvd, Denver, CO",
      zipCode: "80202",
      portfolioScaleProxy: "51% multifamily share",
      reviews: "4.1 stars across 37 reviews",
      reviewSignal: "Mixed public review profile",
      growthSignals: "No strong recent headline matches",
      marketPressure: "Vacancy 5.1% and rent CPI trend 2.9%",
      scoreDrivers: "Scale 49, ops 57, income 72, growth 38, market 58",
    },
    narrative: {
      summary: "Apex Living Group looks worth pursuing, with a few signals to validate in discovery.",
      overallAnalysis: "Apex is a decent lead, but the case is less self-evident than Greywood. The surrounding renter economics are healthy and there are some operational indicators worth probing, but the portfolio and growth signals are more moderate. That means EliseAI may still be a fit, though the rep will need discovery to confirm whether the team is truly feeling enough leasing pain for automation to be urgent. This is more of a qualify-and-shape opportunity than an obvious fast-track account. The main question is not whether the company is bad fit, but whether there is enough inquiry volume, staffing pressure, or inconsistency in follow-up to justify near-term action. If the rep hears that leasing teams are stretched, after-hours coverage is weak, or response speed is slipping, the opportunity should move up quickly.",
      nextBestAction: "Confirm current staffing and leasing workflow pain before positioning automation as urgent.",
      repTalkingPoints: [
        "Open with the cost of delayed responses and after-hours inquiry gaps rather than assuming a scale story.",
        "Use the stable income profile to support ROI, but validate whether leasing volume is large enough to matter.",
        "Ask directly about current CRM, tour scheduling workflow, and who owns inbound follow-up today.",
      ],
      reasons: [
        {
          category: "incomeFit",
          title: "Healthy renter economics",
          body: "The surrounding income profile supports a stable leasing environment and a more credible ROI story.",
          implication: "This helps support budget and value language, but it is not enough by itself to create urgency.",
        },
        {
          category: "operationalPain",
          title: "Some pain, not a flashing red light",
          body: "Public reviews suggest there may be friction, but not enough on their own to make the case feel urgent.",
          implication: "Discovery quality matters more here because external proof is only moderate.",
        },
      ],
    },
    draftEmail: `Subject: Leasing automation for Apex Living

Hi Marcus,

Apex Living Group caught my eye — Denver's rental market is competitive and response time to inquiries can make or break a lease.

EliseAI handles inbound prospects 24/7, books tours automatically, and keeps your team focused on closings. I'd love to show you what it looks like for a Denver portfolio.

Open for a quick call?

Best,
[Your name]`,
  },
  {
    id: 3,
    firstName: "Janet",
    lastName: "Liu",
    email: "j.liu@blueskyrentals.com",
    company: "BlueSky Rentals",
    address: "88 Harbor View Ct",
    city: "Seattle",
    state: "WA",
    source: "gmail",
    status: "enriching",
    score: null,
    scoreLabel: null,
  },
];

async function fetchStoredLeads() {
  const response = await fetch(LEADS_ENDPOINT);
  if (!response.ok) {
    throw new Error("Failed to load lead queue");
  }

  const data = await response.json();
  return Array.isArray(data.leads) ? data.leads : [];
}

async function requestEnrichment(lead) {
  const response = await fetch(ENRICHMENT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input_type: "manual",
      source: lead.source || "manual",
      firstName: lead.firstName || "",
      lastName: lead.lastName || "",
      email: lead.email || "",
      company: lead.company || "",
      address: lead.address || "",
      city: lead.city || "",
      state: lead.state || "",
    }),
  });

  const contentType = response.headers.get("content-type") || "";
  let data;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();
    throw new Error(
      `Webhook returned ${response.status} ${response.statusText} with content-type "${contentType || "unknown"}". ` +
        `Endpoint: ${ENRICHMENT_ENDPOINT}. Response started with: ${text.slice(0, 120)}`
    );
  }

  if (!response.ok) {
    throw new Error(data.error || "Lead enrichment failed");
  }

  return data;
}

async function fetchGmailStatus() {
  const response = await fetch(GMAIL_STATUS_ENDPOINT);
  if (!response.ok) {
    throw new Error("Failed to load Gmail status");
  }

  return response.json();
}

async function fetchGmailConnectUrl() {
  const response = await fetch(GMAIL_CONNECT_ENDPOINT, {
    method: "POST",
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Failed to start Gmail connection");
  }

  return payload.url;
}

export default function App() {
  const [leads, setLeads] = useState(MOCK_LEADS);
  const [selectedId, setSelectedId] = useState(1);
  const [n8nStatus, setN8nStatus] = useState({
    gmail: false,
    gmailAccount: null,
    gmailLastSyncAt: null,
    gmailLastSeenAt: null,
    gmailLastSkippedReason: null,
    gmailLastError: null,
    gmailLastMessageSubject: null,
    sheets: true,
    connected: true,
  });
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailConnectError, setGmailConnectError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function syncLeads() {
      try {
        const storedLeads = await fetchStoredLeads();
        const gmailStatus = await fetchGmailStatus().catch(() => null);

        if (gmailStatus && !cancelled) {
          setGmailConnected(Boolean(gmailStatus.connected));
          setN8nStatus((current) => ({
            ...current,
            gmail: Boolean(gmailStatus.connected),
            gmailAccount: gmailStatus.email || null,
            gmailLastSyncAt: gmailStatus.lastSyncAt || null,
            gmailLastSeenAt: gmailStatus.lastSeenAt || null,
            gmailLastSkippedReason: gmailStatus.lastSkippedReason || null,
            gmailLastError: gmailStatus.lastError || null,
            gmailLastMessageSubject: gmailStatus.lastMessageSubject || null,
            connected: Boolean(gmailStatus.automationReady),
          }));
        }

        if (!cancelled && storedLeads.length > 0) {
          let newestWasNew = false;
          setLeads((prev) => {
            const existing = new Map(prev.map((lead) => [lead.id, lead]));
            newestWasNew = !existing.has(storedLeads[0].id);
            storedLeads.forEach((lead) => existing.set(lead.id, lead));
            return Array.from(existing.values()).sort(
              (a, b) => new Date(b.receivedAt || 0).getTime() - new Date(a.receivedAt || 0).getTime()
            );
          });
          setSelectedId((current) =>
            newestWasNew || !current ? storedLeads[0]?.id || current : current
          );
        }
      } catch {
        // ignore queue polling issues so manual enrichment still works
      }
    }

    syncLeads();
    const timer = setInterval(syncLeads, 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const selectedLead = leads.find((l) => l.id === selectedId);

  async function addLead(lead) {
    const newLead = {
      ...lead,
      id: Date.now(),
      status: "enriching",
      score: null,
      scoreLabel: null,
      source: lead.source || "manual",
      enrichedAt: "enriching...",
    };
    setLeads((prev) => [newLead, ...prev]);
    setSelectedId(newLead.id);

    try {
      const enriched = await requestEnrichment(lead);
      setLeads((prev) =>
        prev.map((l) =>
          l.id === newLead.id
            ? enriched
            : l
        )
      );
      setSelectedId(enriched.id);
    } catch (error) {
      setLeads((prev) =>
        prev.map((l) =>
          l.id === newLead.id
            ? {
                ...l,
                status: "failed",
                enrichedAt: "failed",
                error: error instanceof Error ? error.message : "Lead enrichment failed",
              }
            : l
        )
      );
    }
  }

  async function connectGmail() {
    try {
      setGmailConnectError("");
      const url = await fetchGmailConnectUrl();
      window.open(url, "gmail-connect", "width=560,height=720");
    } catch (error) {
      setGmailConnectError(
        error instanceof Error ? error.message : "Failed to start Gmail connection"
      );
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        leads={leads}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAddLead={addLead}
        n8nStatus={n8nStatus}
        gmailConnected={gmailConnected}
        gmailConnectError={gmailConnectError}
        onConnectGmail={connectGmail}
      />
      <LeadDetail lead={selectedLead} />
    </div>
  );
}
