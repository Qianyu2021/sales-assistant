import { titleCase } from "../lib/format.js";

function buildQuery(lead) {
  return [lead.address, lead.city, lead.state].filter(Boolean).join(", ");
}

function fallbackLocation(lead) {
  const location = buildQuery(lead);

  return {
    formattedAddress: location || lead.address || "Unknown location",
    city: titleCase(lead.city || "Unknown"),
    state: (lead.state || "").toUpperCase(),
    zipCode: lead.zip || null,
    county: null,
    tract: null,
    latitude: null,
    longitude: null,
    confidence: location ? 68 : 35,
    source: "fallback",
  };
}

function parseGeoLookup(result) {
  const geography = result.geographies || {};
  const censusBlocks = geography["Census Blocks"] || [];
  const counties = geography.Counties || [];
  const place = censusBlocks[0] || {};
  const county = counties[0] || {};

  return {
    county: county.NAME || county.BASENAME || null,
    countyFips: county.COUNTY || null,
    tract: place.TRACT || null,
    block: place.BLOCK || null,
  };
}

export async function findLocation(lead, config) {
  if (!lead.address && !(lead.propertyName || lead.apartmentName)) {
    return fallbackLocation(lead);
  }

  try {
    const url = new URL(
      "/geocoder/geographies/onelineaddress",
      config.censusGeocoderBaseUrl
    );
    const query = buildQuery(lead) || [lead.propertyName || lead.apartmentName, lead.city, lead.state].filter(Boolean).join(", ");
    url.searchParams.set("address", query);
    url.searchParams.set("benchmark", "Public_AR_Current");
    url.searchParams.set("vintage", "Current_Current");
    url.searchParams.set("format", "json");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Census geocoder failed with ${response.status}`);
    }

    const payload = await response.json();
    const match =
      payload?.result?.addressMatches?.[0] ||
      payload?.result?.matches?.[0] ||
      null;

    if (!match) {
      return fallbackLocation(lead);
    }

    const lookup = parseGeoLookup(match);
    const coordinates = match.coordinates || {};
    const components = match.addressComponents || {};

    return {
      formattedAddress: match.matchedAddress || buildQuery(lead),
      city: titleCase(components.city || lead.city || ""),
      state: (components.state || lead.state || "").toUpperCase(),
      zipCode: components.zip || lead.zip || null,
      county: lookup.county,
      countyFips: lookup.countyFips,
      tract: lookup.tract,
      block: lookup.block,
      latitude: coordinates.y ?? null,
      longitude: coordinates.x ?? null,
      confidence: 95,
      source: "census_geocoder",
    };
  } catch {
    return fallbackLocation(lead);
  }
}
