/**
 * Google Places API Client (Text Search)
 * Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
 */

interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address?: string;
  website?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  rating?: number;
  user_ratings_total?: number;
  url?: string;
  business_status?: string;
  types?: string[];
}

interface TextSearchResult {
  results: Array<{
    place_id: string;
    name: string;
    formatted_address?: string;
    rating?: number;
    user_ratings_total?: number;
    business_status?: string;
    types?: string[];
  }>;
  status: string;
}

const BASE_URL = "https://maps.googleapis.com/maps/api/place";

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    throw new Error("GOOGLE_PLACES_API_KEY not configured");
  }
  return key;
}

export async function textSearch(
  query: string,
  region = "fr"
): Promise<TextSearchResult["results"]> {
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    query,
    key: apiKey,
    region,
    language: "fr",
  });

  const res = await fetch(`${BASE_URL}/textsearch/json?${params}`);

  if (!res.ok) {
    throw new Error(`Google Places text search failed: ${res.status}`);
  }

  const data: TextSearchResult = await res.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Google Places API error: ${data.status}`);
  }

  return data.results || [];
}

export async function getPlaceDetails(placeId: string): Promise<GooglePlace | null> {
  const apiKey = getApiKey();
  const fields = "place_id,name,formatted_address,website,formatted_phone_number,international_phone_number,rating,user_ratings_total,url,business_status,types";

  const params = new URLSearchParams({
    place_id: placeId,
    key: apiKey,
    fields,
    language: "fr",
  });

  const res = await fetch(`${BASE_URL}/details/json?${params}`);

  if (!res.ok) {
    throw new Error(`Google Places details failed: ${res.status}`);
  }

  const data = await res.json();

  if (data.status !== "OK") {
    if (data.status === "NOT_FOUND") return null;
    throw new Error(`Google Places details error: ${data.status}`);
  }

  return data.result || null;
}

export async function searchCompany(
  companyName: string,
  city?: string
): Promise<{ place: GooglePlace | null; creditsUsed: number }> {
  const query = city ? `${companyName} ${city}` : companyName;
  let creditsUsed = 1; // Text search costs 1 credit

  const results = await textSearch(query);

  if (results.length === 0) {
    return { place: null, creditsUsed };
  }

  // Get details for the first result
  const bestMatch = results[0];
  creditsUsed += 1; // Details costs 1 credit

  const details = await getPlaceDetails(bestMatch.place_id);

  return { place: details, creditsUsed };
}

export function parseGoogleToProspectData(place: GooglePlace) {
  return {
    googlePlaceId: place.place_id,
    hasGooglePresence: true,
    googleRating: place.rating ?? undefined,
    website: place.website || undefined,
    phone: place.international_phone_number || place.formatted_phone_number || undefined,
  };
}

export type { GooglePlace };
