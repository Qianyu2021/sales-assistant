function seededNumber(seed) {
  let hash = 23;
  for (const char of seed) {
    hash = (hash * 43 + char.charCodeAt(0)) % 2147483647;
  }
  return hash;
}

const SIGNAL_RULES = [
  {
    category: "portfolioSize",
    label: "Portfolio size",
    score: 18,
    words: [
      "communities",
      "properties",
      "portfolio",
      "units",
      "apartment homes",
      "managed by",
      "management company",
      "multifamily portfolio",
    ],
  },
  {
    category: "responsePain",
    label: "Response and staffing pain",
    score: 18,
    words: [
      "phone",
      "call",
      "voicemail",
      "respond",
      "response",
      "unresponsive",
      "no one answers",
      "never answer",
      "maintenance",
      "leasing office",
      "staff",
      "understaffed",
    ],
  },
  {
    category: "rentalFit",
    label: "Rental business fit",
    score: 14,
    words: ["apartment", "apartments", "rent", "rental", "lease", "leasing", "property management", "multifamily"],
  },
  {
    category: "leasingActivity",
    label: "Leasing activity",
    score: 18,
    words: [
      "available units",
      "availability",
      "floor plans",
      "schedule a tour",
      "apply now",
      "apartments for rent",
      "zillow",
      "apartments.com",
      "forrent",
    ],
  },
  {
    category: "growth",
    label: "Growth or expansion",
    score: 16,
    words: ["hiring", "jobs", "expansion", "acquisition", "acquired", "new development", "portfolio", "units"],
  },
  {
    category: "reputation",
    label: "Reputation pressure",
    score: 12,
    words: ["reviews", "complaints", "bbb", "yelp", "tenant", "resident", "rating"],
  },
  {
    category: "aiOpportunity",
    label: "AI opportunity signal",
    score: 10,
    words: [
      "call us",
      "phone",
      "email us",
      "contact us",
      "text us",
      "sms",
      "leasing office",
      "office hours",
    ],
  },
  {
    category: "chatbotPresent",
    label: "Existing chatbot signal",
    score: 6,
    words: [
      "chatbot",
      "chat bot",
      "virtual assistant",
      "ai assistant",
      "live chat",
      "virtual tour",
      "self-guided tour",
      "online tour",
      "chat",
      "text us",
      "resident portal",
      "online application",
      "rentcafe",
      "entrata",
      "appfolio",
      "yardi",
      "knock",
    ],
  },
];

const KNOWN_OPERATOR_DOMAINS = [
  {
    domain: "equityapartments.com",
    name: "Equity Residential",
    portfolio: {
      properties: 312,
      units: 85190,
      description:
        "Equity Residential is an S&P 500 apartment REIT/operator with 312 rental properties and 85,190 apartment units reported in its Q4 2025 portfolio summary.",
    },
    insight:
      "The property appears on EquityApartments.com, which indicates it is operated by Equity Residential rather than only a standalone apartment office.",
  },
  {
    domain: "essexapartmenthomes.com",
    name: "Essex Property Trust",
    portfolio: {
      properties: 257,
      units: 62000,
      description:
        "Essex Property Trust is an S&P 500 apartment REIT/operator with ownership interests in 257 apartment home communities comprising over 62,000 apartment homes, reported in its Q3 2025 corporate profile.",
    },
    insight: "The property appears on Essex Apartment Homes, indicating a larger apartment operator behind the community.",
  },
  {
    domain: "greystar.com",
    name: "Greystar",
    portfolio: null,
    insight: "The property appears on Greystar, indicating a large multifamily management platform behind the community.",
  },
  {
    domain: "bozzuto.com",
    name: "Bozzuto",
    portfolio: null,
    insight: "The property appears on Bozzuto, indicating a larger property management/operator context.",
  },
  {
    domain: "udr.com",
    name: "UDR",
    portfolio: null,
    insight: "The property appears on UDR, indicating a larger apartment REIT/operator behind the community.",
  },
  {
    domain: "avaloncommunities.com",
    name: "AvalonBay Communities",
    portfolio: null,
    insight: "The property appears on AvalonBay, indicating a larger apartment REIT/operator behind the community.",
  },
];

function compactText(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function stripHtml(html = "") {
  return compactText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function emailDomain(email = "") {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (!domain || /(gmail|yahoo|hotmail|outlook|icloud|aol|example)\./.test(domain)) return "";
  return domain;
}

function extractLinks(html = "", baseUrl) {
  const links = [];
  const pattern = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = pattern.exec(html))) {
    try {
      const href = new URL(match[1], baseUrl).toString();
      if (
        /(floor|availability|available|apartments|properties|communities|contact|tour|careers|jobs|leasing|apply)/i.test(
          href
        )
      ) {
        links.push(href);
      }
    } catch {
      // Ignore malformed links.
    }
  }
  return Array.from(new Set(links)).slice(0, 5);
}

function quote(value) {
  return `"${String(value).replace(/"/g, "")}"`;
}

function leadNames(lead) {
  return Array.from(
    new Set([lead.company, lead.propertyName, lead.apartmentName, lead.operatorName, lead.senderCompany].filter(Boolean))
  );
}

function leadAddresses(lead, location) {
  return Array.from(
    new Set(
      [
        lead.address,
        location.formattedAddress,
        lead.operatorAddress,
        lead.senderCompanyAddress,
      ].filter(Boolean)
    )
  );
}

function buildGdeltQueries(lead, location) {
  const names = leadNames(lead);
  const company = names[0] ? quote(names[0]) : "";
  const alternateNameClauses = names.slice(1, 4).map((name) => quote(name));
  const address = leadAddresses(lead, location)[0] || "";
  const addressClause = address ? quote(address) : "";
  const market = [location.city || lead.city, location.state || lead.state].filter(Boolean).join(" ");
  const marketClause = market ? quote(market) : "";

  return [
    ...alternateNameClauses.map((name) => `(${name}${addressClause ? ` AND ${addressClause}` : ""})`),
    ...alternateNameClauses.map((name) => `(${name} AND (operator OR owner OR managed OR management OR leasing OR apartments))`),
    `(${company}${addressClause ? ` AND ${addressClause}` : ""})`,
    `(${company}${marketClause ? ` AND ${marketClause}` : ""} AND (Equity OR operator OR owner OR managed OR management))`,
    `(${company} AND (communities OR properties OR portfolio OR units OR "apartment homes" OR multifamily))`,
    `(${company} AND (apartment OR apartments OR rental OR leasing OR multifamily OR "property management"))`,
    `(${company} AND ("available units" OR availability OR "floor plans" OR "schedule a tour" OR "apply now" OR "apartments for rent"))`,
    `(${company} AND (reviews OR complaints OR tenant OR resident OR maintenance OR phone OR response OR unresponsive))`,
    `(${company} AND ("leasing agent" OR "leasing consultant" OR hiring OR jobs OR careers))`,
    `(${company} AND ("call us" OR phone OR "email us" OR "contact us" OR "text us" OR "leasing office" OR "office hours"))`,
    `(${company} AND (chatbot OR "chat bot" OR "virtual assistant" OR "AI assistant" OR "live chat" OR "resident portal" OR RentCafe OR Entrata OR AppFolio OR Yardi))`,
    `(${company} AND (growth OR hiring OR acquisition OR expansion OR development OR portfolio OR units)${marketClause ? ` AND ${marketClause}` : ""})`,
  ].filter((query) => query.includes("\""));
}

function buildWebSearchQueries(lead, location) {
  const names = leadNames(lead);
  const company = names.join(" ");
  const addresses = leadAddresses(lead, location);
  const address = addresses[0] || "";
  const market = [location.city || lead.city, location.state || lead.state].filter(Boolean).join(" ");
  const base = [company, address, market].filter(Boolean).join(" ");

  return [
    ...names.map((name) => [name, address, market, "operator owner management company"].filter(Boolean).join(" ")),
    ...addresses.slice(1, 3).map((otherAddress) =>
      [company, otherAddress, "operator property management company"].filter(Boolean).join(" ")
    ),
    ...names.map((name) => [name, address, market, "official apartment website"].filter(Boolean).join(" ")),
    `${base} operator owner management company`,
    `${base} managed by operated by property management`,
    `${base} official apartment website`,
    `${base} available units floor plans schedule tour`,
    `${base} Zillow Apartments.com Realtor available units`,
  ].filter(Boolean);
}

function buildListingUrls(lead, location) {
  const listingName = lead.propertyName || lead.apartmentName || lead.company || "";
  const companySlug = listingName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const city = (location.city || lead.city || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const state = (location.state || lead.state || "").toLowerCase();

  if (!companySlug || !city || !state) return [];

  return [
    `https://www.apartments.com/${companySlug}-${city}-${state}/`,
    `https://www.zillow.com/apartments/${city}-${state}/${companySlug}/`,
  ];
}

function slug(value = "") {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function classifyResults(results) {
  let searchSignalScore = 0;
  const categories = new Map();
  const evidence = [];

  for (const result of results) {
    const haystack = `${result.title} ${result.snippet}`.toLowerCase();
    const matchedLabels = [];

    for (const rule of SIGNAL_RULES) {
      if (rule.words.some((word) => haystack.includes(word))) {
        searchSignalScore += rule.score;
        matchedLabels.push(rule.label);
        categories.set(rule.category, {
          key: rule.category,
          label: rule.label,
          count: (categories.get(rule.category)?.count || 0) + 1,
        });
      }
    }

    if (matchedLabels.length > 0) {
      evidence.push({
        title: result.title,
        link: result.link,
        snippet: result.snippet,
        signals: Array.from(new Set(matchedLabels)),
      });
    }
  }

  return {
    searchSignalScore: Math.min(100, searchSignalScore),
    matchedSignals: Array.from(categories.values()).sort((a, b) => b.count - a.count),
    evidence: evidence.slice(0, 5),
  };
}

function sameNormalizedName(a = "", b = "") {
  const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalize(a) && normalize(a) === normalize(b);
}

function explicitOperatorFromLead(lead) {
  const operatorName = lead.operatorName || lead.senderCompany || "";
  if (!operatorName) return null;

  const propertyNames = [lead.propertyName, lead.apartmentName].filter(Boolean);
  if (propertyNames.some((name) => sameNormalizedName(name, operatorName))) return null;

  return {
    name: operatorName,
    domain: null,
    portfolio: null,
    sourceUrl: null,
    confidence: lead.operatorName ? 78 : 65,
    source: lead.operatorName ? "email_operator" : "email_signature",
    insight: lead.operatorAddress || lead.senderCompanyAddress
      ? `The inbound email signature identifies ${operatorName} with office address ${lead.operatorAddress || lead.senderCompanyAddress}, suggesting this is the operating or sender company to qualify.`
      : `The inbound email identifies ${operatorName} as the operating or sender company to qualify.`,
  };
}

function detectParentCompany(results, lead) {
  const explicitOperator = explicitOperatorFromLead(lead);

  for (const result of results) {
    const haystack = `${result.title} ${result.link} ${result.displayLink} ${result.snippet}`.toLowerCase();
    const matched = KNOWN_OPERATOR_DOMAINS.find((operator) => haystack.includes(operator.domain));
    if (matched) {
      return {
        name: matched.name,
        domain: matched.domain,
        portfolio: matched.portfolio,
        sourceUrl: result.link,
        confidence: 90,
        insight: matched.insight,
      };
    }
  }

  const operatorResult = results.find((result) =>
    /\b(managed by|property management|management company|operated by|owned by)\b/i.test(
      `${result.title} ${result.snippet}`
    )
  );

  if (!operatorResult) return explicitOperator;

  const text = compactText(`${operatorResult.title} ${operatorResult.snippet}`);
  const nameMatch = text.match(
    /\b(?:managed by|operated by|owned by|property management(?: by)?|management company)\s+([A-Z][A-Za-z0-9&.,' -]{2,80})/i
  );
  const extractedName = nameMatch?.[1]
    ?.replace(/\b(?:and|with|for|in|at|on)\b.*$/i, "")
    .replace(/[.,"' ]+$/g, "")
    .trim();

  return {
    name: extractedName || null,
    domain: operatorResult.displayLink || null,
    sourceUrl: operatorResult.link,
    confidence: extractedName ? 70 : 55,
    insight: extractedName
      ? `Public evidence suggests the property is managed or operated by ${extractedName}.`
      : "Public evidence suggests a separate owner/operator or management-company context; verify the parent company in discovery.",
  };
}

function fallbackSearch(lead) {
  const seed = seededNumber([lead.company, lead.address, lead.city, lead.state].filter(Boolean).join("|"));
  const score = 15 + (seed % 30);

  return {
    queryCount: 0,
    resultCount: 0,
    searchSignalScore: score,
    matchedSignals: [],
    evidence: [],
    topResults: [],
    parentCompany: null,
    source: "fallback",
    configured: false,
  };
}

async function searchGdelt(query, config) {
  const url = new URL("/api/v2/doc/doc", config.gdeltDocBaseUrl || "https://api.gdeltproject.org");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", "10");
  url.searchParams.set("timespan", "3months");
  url.searchParams.set("sort", "datedesc");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GDELT search failed with ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.articles) ? payload.articles : [];
}

function decodeDuckDuckGoUrl(value) {
  try {
    const url = new URL(value, "https://duckduckgo.com");
    const uddg = url.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : url.toString();
  } catch {
    return value;
  }
}

function decodeHtmlEntities(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function searchDuckDuckGo(query) {
  const url = new URL("https://duckduckgo.com/html/");
  url.searchParams.set("q", query);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 lead-research-bot",
    },
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo search failed with ${response.status}`);
  }

  const html = await response.text();
  const results = [];
  const pattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = pattern.exec(html)) && results.length < 8) {
    const link = decodeDuckDuckGoUrl(decodeHtmlEntities(match[1]));
    results.push({
      title: stripHtml(decodeHtmlEntities(match[2])),
      link,
      displayLink: (() => {
        try {
          return new URL(link).hostname;
        } catch {
          return "";
        }
      })(),
      snippet: stripHtml(decodeHtmlEntities(match[3])),
    });
  }

  return results;
}

async function fetchWebsitePage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 lead-research-bot",
    },
  });
  if (!response.ok) {
    throw new Error(`Website fetch failed with ${response.status}`);
  }

  const html = await response.text();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || url;

  return {
    title: compactText(title),
    link: url,
    displayLink: new URL(url).hostname,
    snippet: stripHtml(html).slice(0, 800),
    html,
  };
}

async function searchWebsiteFromUrl(homepage) {
  if (!homepage) return [];

  try {
    const firstPage = await fetchWebsitePage(homepage);
    const links = extractLinks(firstPage.html, homepage);
    const pages = [firstPage];

    for (const link of links.slice(0, 4)) {
      try {
        pages.push(await fetchWebsitePage(link));
      } catch {
        // Keep the homepage evidence even if a subpage blocks requests.
      }
    }

    return pages.map(({ html, ...page }) => page);
  } catch {
    return [];
  }
}

async function searchCompanyWebsites(lead, reviews) {
  const urls = [];
  const domain = emailDomain(lead.email);
  if (domain) urls.push(`https://${domain}`);
  if (reviews?.websiteUri) urls.push(reviews.websiteUri);

  const pages = [];
  for (const url of Array.from(new Set(urls))) {
    pages.push(...(await searchWebsiteFromUrl(url)));
  }
  return pages;
}

async function searchLikelyListingPages(lead, location) {
  const pages = [];
  for (const url of buildListingUrls(lead, location)) {
    try {
      pages.push(await fetchWebsitePage(url));
    } catch {
      // Listing sites often block direct fetches; ignore and keep other sources.
    }
  }
  return pages.map(({ html, ...page }) => page);
}

export async function findSearchSignals(lead, location, config, reviews = {}) {
  if (!lead.company) {
    return fallbackSearch(lead);
  }

  const queries = buildGdeltQueries(lead, location);
  const webQueries = buildWebSearchQueries(lead, location);
  const allResults = [];
  const seenLinks = new Set();

  try {
    for (const query of queries) {
      const items = await searchGdelt(query, config);
      for (const item of items) {
        const link = item.url || item.link;
        if (!link || seenLinks.has(link)) continue;
        seenLinks.add(link);
        allResults.push({
          title: compactText(item.title || ""),
          link,
          displayLink: item.domain || "",
          snippet: compactText(
            [item.title, item.domain, item.sourcecountry, item.language, item.seendate]
              .filter(Boolean)
              .join(" ")
          ),
        });
      }
    }
  } catch {
    // GDELT is useful when it has coverage, but property/operator discovery should continue without it.
  }

  for (const query of webQueries) {
    try {
      const items = await searchDuckDuckGo(query);
      for (const item of items) {
        if (!item.link || seenLinks.has(item.link)) continue;
        seenLinks.add(item.link);
        allResults.push(item);
      }
    } catch {
      // Continue with other free sources.
    }
  }

  try {
    for (const page of await searchCompanyWebsites(lead, reviews)) {
      if (!page.link || seenLinks.has(page.link)) continue;
      seenLinks.add(page.link);
      allResults.push(page);
    }
  } catch {
    // Continue with listing evidence.
  }

  try {
    for (const page of await searchLikelyListingPages(lead, location)) {
      if (!page.link || seenLinks.has(page.link)) continue;
      seenLinks.add(page.link);
      allResults.push(page);
    }
  } catch {
    // Continue with whatever evidence has already been collected.
  }

  const classified = classifyResults(allResults);
  const parentCompany = detectParentCompany(allResults, lead);

  if (allResults.length === 0) {
    const fallback = fallbackSearch(lead);
    return {
      ...fallback,
      parentCompany: explicitOperatorFromLead(lead),
      source: "gdelt_fallback",
    };
  }

  return {
    queryCount: queries.length + webQueries.length,
    resultCount: allResults.length,
    searchSignalScore: classified.searchSignalScore,
    matchedSignals: classified.matchedSignals,
    evidence: classified.evidence,
    topResults: allResults.slice(0, 6),
    parentCompany,
    source: "public_web_search",
    configured: true,
  };
}
