function seededNumber(seed) {
  let hash = 7;
  for (const char of seed) {
    hash = (hash * 37 + char.charCodeAt(0)) % 2147483647;
  }
  return hash;
}

function reviewSummary(rating, count) {
  if (rating <= 3.5 && count >= 20) return "Review friction suggests operational pain";
  if (rating >= 4.3 && count >= 20) return "Strong review profile";
  if (count < 8) return "Limited review footprint";
  return "Mixed public review profile";
}

function fallbackReviews(lead) {
  const seed = seededNumber([lead.company, lead.city, lead.state].filter(Boolean).join("|"));
  const rating = Number((3.2 + (seed % 18) / 10).toFixed(1));
  const reviewCount = 5 + (seed % 90);

  return {
    rating,
    reviewCount,
    reviewSignal: reviewSummary(rating, reviewCount),
    placeName: lead.company || null,
    websiteUri: null,
    googleMapsUri: null,
    source: "fallback",
  };
}

async function lookupPlaceId(query, apiKey) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Places search failed with ${response.status}`);
  }

  const payload = await response.json();
  return payload?.places?.[0] || null;
}

async function lookupPlaceDetails(placeId, apiKey) {
  const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "id,displayName,rating,userRatingCount,formattedAddress,primaryType,location,websiteUri,googleMapsUri",
    },
  });

  if (!response.ok) {
    throw new Error(`Place details failed with ${response.status}`);
  }

  return response.json();
}

async function legacyPlaceSearch(query, apiKey) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", query);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Legacy Places search failed with ${response.status}`);
  }

  const payload = await response.json();
  if (payload.status && !["OK", "ZERO_RESULTS"].includes(payload.status)) {
    throw new Error(`Legacy Places search failed with ${payload.status}`);
  }

  return payload.results?.[0] || null;
}

async function legacyPlaceDetails(placeId, apiKey) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "name,rating,user_ratings_total,formatted_address,type,website,url");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Legacy Places details failed with ${response.status}`);
  }

  const payload = await response.json();
  if (payload.status && payload.status !== "OK") {
    throw new Error(`Legacy Places details failed with ${payload.status}`);
  }

  return payload.result || null;
}

async function findReviewsWithLegacyPlaces(lead, location, apiKey) {
  const query = [lead.company, location.formattedAddress].filter(Boolean).join(" ");
  const place = await legacyPlaceSearch(query, apiKey);
  if (!place?.place_id) {
    return null;
  }

  const details = await legacyPlaceDetails(place.place_id, apiKey);
  if (!details) {
    return null;
  }

  const rating = Number(details.rating || place.rating || 0);
  const reviewCount = Number(details.user_ratings_total || place.user_ratings_total || 0);

  return {
    rating,
    reviewCount,
    reviewSignal: reviewSummary(rating, reviewCount),
    placeName: details.name || place.name || lead.company || null,
    primaryType: details.types?.[0] || place.types?.[0] || null,
    websiteUri: details.website || null,
    googleMapsUri: details.url || null,
    source: "google_places_legacy",
  };
}

export async function findReviews(lead, location, config) {
  if (!config.googlePlacesApiKey) {
    return fallbackReviews(lead);
  }

  try {
    const query = [lead.company, location.formattedAddress].filter(Boolean).join(" ");
    const place = await lookupPlaceId(query, config.googlePlacesApiKey);
    if (!place?.id) {
      return fallbackReviews(lead);
    }

    const details = await lookupPlaceDetails(place.id, config.googlePlacesApiKey);
    const rating = Number(details.rating || 0);
    const reviewCount = Number(details.userRatingCount || 0);

    return {
      rating,
      reviewCount,
      reviewSignal: reviewSummary(rating, reviewCount),
      placeName: details.displayName?.text || place.displayName?.text || lead.company || null,
      primaryType: details.primaryType || null,
      websiteUri: details.websiteUri || null,
      googleMapsUri: details.googleMapsUri || null,
      source: "google_places",
    };
  } catch {
    try {
      return (await findReviewsWithLegacyPlaces(lead, location, config.googlePlacesApiKey)) || fallbackReviews(lead);
    } catch {
      return fallbackReviews(lead);
    }
  }
}
