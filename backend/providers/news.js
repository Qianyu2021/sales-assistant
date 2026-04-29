function seededNumber(seed) {
  let hash = 17;
  for (const char of seed) {
    hash = (hash * 41 + char.charCodeAt(0)) % 2147483647;
  }
  return hash;
}

const KEYWORDS = [
  { word: "expand", score: 24, category: "expansion" },
  { word: "acquire", score: 28, category: "acquisition" },
  { word: "funding", score: 26, category: "funding" },
  { word: "launch", score: 18, category: "launch" },
  { word: "development", score: 20, category: "development" },
  { word: "hiring", score: 14, category: "hiring" },
];

function classifyArticles(articles) {
  let growthSignalScore = 0;
  const matchedTopics = new Set();

  for (const article of articles) {
    const haystack = `${article.title || ""} ${article.description || ""}`.toLowerCase();
    for (const keyword of KEYWORDS) {
      if (haystack.includes(keyword.word)) {
        growthSignalScore += keyword.score;
        matchedTopics.add(keyword.category);
      }
    }
  }

  return {
    growthSignalScore: Math.min(100, growthSignalScore),
    matchedTopics: Array.from(matchedTopics),
  };
}

function fallbackNews(lead) {
  const seed = seededNumber([lead.company, lead.city, lead.state].filter(Boolean).join("|"));
  const growthSignalScore = 20 + (seed % 35);

  return {
    articleCount: 0,
    growthSignalScore,
    matchedTopics: [],
    headlines: [],
    source: "fallback",
  };
}

export async function findGrowthSignals(lead, config) {
  if (!config.newsApiKey || !lead.company) {
    return fallbackNews(lead);
  }

  try {
    const url = new URL("/v2/everything", config.newsApiBaseUrl);
    url.searchParams.set("q", `"${lead.company}"`);
    url.searchParams.set("pageSize", "5");
    url.searchParams.set("sortBy", "publishedAt");
    url.searchParams.set("language", "en");
    url.searchParams.set("apiKey", config.newsApiKey);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`News lookup failed with ${response.status}`);
    }

    const payload = await response.json();
    const articles = Array.isArray(payload.articles) ? payload.articles : [];
    const classified = classifyArticles(articles);

    return {
      articleCount: articles.length,
      growthSignalScore: classified.growthSignalScore,
      matchedTopics: classified.matchedTopics,
      headlines: articles.slice(0, 3).map((article) => article.title).filter(Boolean),
      source: "newsapi",
    };
  } catch {
    return fallbackNews(lead);
  }
}
