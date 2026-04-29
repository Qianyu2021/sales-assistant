function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function seededNumber(seed) {
  let hash = 23;
  for (const char of seed) {
    hash = (hash * 29 + char.charCodeAt(0)) % 2147483647;
  }
  return hash;
}

function fallbackMarket(lead) {
  const seed = seededNumber([lead.city, lead.state].filter(Boolean).join("|"));
  const rentalVacancyRate = Number((5.2 + (seed % 30) / 10).toFixed(1));
  const rentInflationYoY = Number((1.4 + (seed % 28) / 10).toFixed(1));

  return {
    rentalVacancyRate,
    rentInflationYoY,
    marketPressureScore: clamp(Math.round(rentalVacancyRate * 8 + rentInflationYoY * 6), 0, 100),
    source: "fallback",
  };
}

async function fredLatest(seriesId, apiKey, baseUrl) {
  const url = new URL("/fred/series/observations", baseUrl);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "2");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FRED request failed with ${response.status}`);
  }

  const payload = await response.json();
  const observations = payload.observations || [];
  return observations
    .map((item) => Number(item.value))
    .filter((value) => !Number.isNaN(value) && Number.isFinite(value));
}

export async function findMarketPressure(lead, config) {
  if (!config.fredApiKey) {
    return fallbackMarket(lead);
  }

  try {
    const [vacancySeries, rentSeries] = await Promise.all([
      fredLatest("RRVRUSQ156N", config.fredApiKey, config.fredApiBaseUrl),
      fredLatest("CUUR0000SEHA", config.fredApiKey, config.fredApiBaseUrl),
    ]);

    const rentalVacancyRate = vacancySeries[0] || 0;
    const latestRent = rentSeries[0] || 0;
    const previousRent = rentSeries[1] || latestRent;
    const rentInflationYoY = previousRent
      ? Number((((latestRent - previousRent) / previousRent) * 100).toFixed(1))
      : 0;

    return {
      rentalVacancyRate,
      rentInflationYoY,
      marketPressureScore: clamp(Math.round(rentalVacancyRate * 8 + rentInflationYoY * 6), 0, 100),
      source: "fred",
    };
  } catch {
    return fallbackMarket(lead);
  }
}
