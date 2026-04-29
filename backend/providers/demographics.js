const ACS_PORTFOLIO_FIELDS = [
  "B25032_001E",
  "B25032_007E",
  "B25032_008E",
  "B25032_009E",
  "B25032_010E",
  "B25032_018E",
  "B25032_019E",
  "B25032_020E",
  "B25032_021E",
  "B19013_001E",
];

function seededNumber(seed) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 2147483647;
  }
  return hash;
}

function fallbackMetrics(lead, location) {
  const seed = seededNumber(
    [lead.company, lead.address, lead.city, lead.state, location.zipCode]
      .filter(Boolean)
      .join("|")
  );
  const medianIncome = 52000 + (seed % 43000);
  const renterRatio = 42 + (seed % 28);
  const multiUnitShare = Number((0.22 + (seed % 45) / 100).toFixed(2));

  return {
    medianIncome,
    renterRatio,
    multiUnitShare,
    totalHousingUnits: 0,
    source: "fallback",
  };
}

function parseAcsRow([, total, owner59, owner1019, owner2049, owner50, renter59, renter1019, renter2049, renter50, income]) {
  const totalHousingUnits = Number(total || 0);
  const multiUnitUnits =
    Number(owner59 || 0) +
    Number(owner1019 || 0) +
    Number(owner2049 || 0) +
    Number(owner50 || 0) +
    Number(renter59 || 0) +
    Number(renter1019 || 0) +
    Number(renter2049 || 0) +
    Number(renter50 || 0);

  return {
    totalHousingUnits,
    multiUnitShare: totalHousingUnits
      ? Number((multiUnitUnits / totalHousingUnits).toFixed(3))
      : 0,
    medianIncome: Number(income || 0),
  };
}

export async function findDemographics(lead, location, config) {
  if (!location.zipCode) {
    return fallbackMetrics(lead, location);
  }

  try {
    const url = new URL("/data/2023/acs/acs5", config.censusDataBaseUrl);
    url.searchParams.set("get", ["NAME", ...ACS_PORTFOLIO_FIELDS].join(","));
    url.searchParams.set("for", `zip code tabulation area:${location.zipCode}`);

    if (config.censusApiKey) {
      url.searchParams.set("key", config.censusApiKey);
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ACS request failed with ${response.status}`);
    }

    const data = await response.json();
    const row = data?.[1];
    if (!row) {
      return fallbackMetrics(lead, location);
    }

    const parsed = parseAcsRow(row);
    const renterRatio = Math.round(parsed.multiUnitShare * 100);

    return {
      ...parsed,
      renterRatio,
      source: "census_acs_2023_5yr",
    };
  } catch {
    return fallbackMetrics(lead, location);
  }
}
