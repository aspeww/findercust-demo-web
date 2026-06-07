"use server";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { TR_CITIES, TR_CITIES_WITH_DISTRICTS, SECTORS } from "@/lib/geo-data";

const GOOGLE_PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const GOOGLE_PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places";
const GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const GOOGLE_PLACES_PAGE_SIZE = 20;
const GOOGLE_LOCATION_BIAS_RADIUS_M = 7000;
const EXTERNAL_FETCH_TIMEOUT_MS = 8000;
const GOOGLE_DETAILS_CONCURRENCY = 12;
const GOOGLE_QUERY_PLAN_CONCURRENCY = 4;
const WEBSITE_EMAIL_CONCURRENCY = 6;
const WEBSITE_FETCH_TIMEOUT_MS = 6000;
const WEBSITE_MAX_CONTENT_LENGTH = 1_000_000;

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user.id;
}

// ---------------------------------------------------------------------------
// Result type & Google Places integration
// ---------------------------------------------------------------------------

export type SearchResult = {
  placeId: string;
  name: string;
  category: string;
  city: string;
  district: string | null;
  address: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  social: { instagram?: string; facebook?: string } | null;
  rating: number;
  reviewsCount: number;
  lat: number;
  lng: number;
  status: "new" | "contacted" | "interested" | "negotiating" | "won" | "lost";
};

type GeocodeResponse = {
  status: string;
  results?: Array<{
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
};

type PlacesSearchResponse = {
  nextPageToken?: string;
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    rating?: number;
    userRatingCount?: number;
    primaryTypeDisplayName?: { text?: string };
  }>;
};

type PlaceDetailsResponse = {
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
};

function buildLayeredCategory(
  selectedSector: string,
  rawGoogleCategory: string | undefined,
): string {
  const raw = (rawGoogleCategory ?? "").trim();
  if (!raw) return selectedSector;
  if (raw.toLocaleLowerCase("tr") === selectedSector.toLocaleLowerCase("tr")) {
    return selectedSector;
  }
  return `${selectedSector} > ${raw}`;
}

function getMapsApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error("GOOGLE_MAPS_API_KEY bulunamadı. Lütfen .env dosyasına ekleyin.");
  }
  return key;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = EXTERNAL_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function isPrivateIpAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const normalized = ip.toLowerCase();
    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }

  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;

  const [a, b] = parts;
  if (a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

async function isSafeWebsiteHost(hostname: string): Promise<boolean> {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost")) return false;

  const ipType = isIP(hostname);
  if (ipType > 0) return !isPrivateIpAddress(hostname);

  try {
    const addresses = await lookup(hostname, { all: true });
    if (addresses.length === 0) return false;
    return addresses.every((item) => !isPrivateIpAddress(item.address));
  } catch {
    return false;
  }
}

function normalizeWebsiteUrl(rawWebsite: string): URL | null {
  try {
    const firstPass = new URL(rawWebsite);
    if (firstPass.protocol !== "http:" && firstPass.protocol !== "https:") {
      return null;
    }
    return firstPass;
  } catch {
    try {
      const withHttps = new URL(`https://${rawWebsite}`);
      if (withHttps.protocol !== "http:" && withHttps.protocol !== "https:") {
        return null;
      }
      return withHttps;
    } catch {
      return null;
    }
  }
}

function extractEmails(html: string): string[] {
  const emailSet = new Set<string>();

  const mailtoMatches = html.match(/mailto:([^"'\s>]+)/gi) ?? [];
  for (const match of mailtoMatches) {
    const email = match.replace(/^mailto:/i, "").split(/[?&#]/)[0]?.trim();
    if (email) emailSet.add(email.toLowerCase());
  }

  const plainMatches = html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  for (const email of plainMatches) {
    emailSet.add(email.toLowerCase());
  }

  return Array.from(emailSet).filter((email) => {
    if (!email.includes("@")) return false;
    if (email.length > 120) return false;
    if (email.endsWith(".png") || email.endsWith(".jpg") || email.endsWith(".jpeg") || email.endsWith(".webp")) {
      return false;
    }
    return true;
  });
}

function pickPreferredEmail(emails: string[]): string | null {
  if (emails.length === 0) return null;
  const priorities = [
    "info@",
    "iletisim@",
    "contact@",
    "hello@",
    "destek@",
    "support@",
  ];
  for (const prefix of priorities) {
    const found = emails.find((email) => email.startsWith(prefix));
    if (found) return found;
  }
  return emails[0] ?? null;
}

async function fetchHtmlForEmail(url: URL): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBSITE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FinderCustBot/1.0)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) return null;
    const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/html")) return null;

    const contentLength = Number(res.headers.get("content-length") ?? "0");
    if (contentLength > WEBSITE_MAX_CONTENT_LENGTH) return null;

    const text = await res.text();
    if (text.length > WEBSITE_MAX_CONTENT_LENGTH) {
      return text.slice(0, WEBSITE_MAX_CONTENT_LENGTH);
    }
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchEmailFromWebsite(website: string): Promise<string | null> {
  const baseUrl = normalizeWebsiteUrl(website);
  if (!baseUrl) return null;

  const safe = await isSafeWebsiteHost(baseUrl.hostname);
  if (!safe) return null;

  const candidateUrls = [
    new URL("/", baseUrl.origin),
    new URL("/iletisim", baseUrl.origin),
    new URL("/contact", baseUrl.origin),
    new URL("/hakkimizda", baseUrl.origin),
    new URL("/about", baseUrl.origin),
  ];

  const seen = new Set<string>();
  for (const candidate of candidateUrls) {
    if (seen.has(candidate.toString())) continue;
    seen.add(candidate.toString());

    const html = await fetchHtmlForEmail(candidate);
    if (!html) continue;
    const email = pickPreferredEmail(extractEmails(html));
    if (email) return email;
  }

  return null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const current = index;
      index++;
      if (current >= items.length) break;
      results[current] = await mapper(items[current], current);
    }
  });

  await Promise.all(workers);
  return results;
}

async function enrichResultsWithWebsiteEmails(results: SearchResult[]): Promise<SearchResult[]> {
  return mapWithConcurrency(results, WEBSITE_EMAIL_CONCURRENCY, async (result) => {
    if (result.email || !result.website) return result;
    const email = await fetchEmailFromWebsite(result.website);
    if (!email) return result;
    return { ...result, email };
  });
}

async function geocodeArea(input: {
  city: string;
  district: string | null;
  country: string;
  apiKey: string;
}): Promise<{ lat: number; lng: number } | null> {
  const query = [input.district, input.city, input.country].filter(Boolean).join(", ");
  const url = `${GOOGLE_GEOCODE_URL}?address=${encodeURIComponent(query)}&key=${encodeURIComponent(input.apiKey)}`;

  const res = await fetchWithTimeout(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) return null;

  const data = (await res.json()) as GeocodeResponse;
  if (data.status !== "OK") return null;

  const location = data.results?.[0]?.geometry?.location;
  if (typeof location?.lat !== "number" || typeof location?.lng !== "number") {
    return null;
  }

  return { lat: location.lat, lng: location.lng };
}

async function fetchPlaceDetails(
  placeId: string,
  apiKey: string,
): Promise<PlaceDetailsResponse | null> {
  const url = `${GOOGLE_PLACE_DETAILS_URL}/${encodeURIComponent(placeId)}`;
  const res = await fetchWithTimeout(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "websiteUri,nationalPhoneNumber,internationalPhoneNumber",
    },
  });

  if (!res.ok) return null;
  return (await res.json()) as PlaceDetailsResponse;
}

async function searchPlacesByTextQuery(
  textQuery: string,
  apiKey: string,
  center?: { lat: number; lng: number } | null,
): Promise<NonNullable<PlacesSearchResponse["places"]>> {
  const places: NonNullable<PlacesSearchResponse["places"]> = [];
  const seenPageTokens = new Set<string>();
  let pageToken: string | undefined;

  while (true) {
    if (pageToken) {
      if (seenPageTokens.has(pageToken)) break;
      seenPageTokens.add(pageToken);
    }

    const payload: Record<string, unknown> = {
      textQuery,
      languageCode: "tr",
      regionCode: "TR",
      pageSize: GOOGLE_PLACES_PAGE_SIZE,
    };

    if (center) {
      payload.locationBias = {
        circle: {
          center: {
            latitude: center.lat,
            longitude: center.lng,
          },
          radius: GOOGLE_LOCATION_BIAS_RADIUS_M,
        },
      };
    }

    if (pageToken) payload.pageToken = pageToken;

    const searchRes = await fetchWithTimeout(GOOGLE_PLACES_SEARCH_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.location",
          "places.rating",
          "places.userRatingCount",
          "places.primaryTypeDisplayName",
          "nextPageToken",
        ].join(","),
      },
      body: JSON.stringify(payload),
    });

    if (!searchRes.ok) {
      const body = await searchRes.text();
      throw new Error(`Google Places araması başarısız oldu (${searchRes.status}): ${body}`);
    }

    const searchData = (await searchRes.json()) as PlacesSearchResponse;
    const batch = searchData.places ?? [];
    places.push(...batch);

    const nextPageToken = searchData.nextPageToken;
    if (!nextPageToken) break;
    pageToken = nextPageToken;
  }

  return places;
}

async function fetchGooglePlaces(input: {
  city: string;
  district: string | null;
  country: string;
  sector: string;
}): Promise<SearchResult[]> {
  const apiKey = getMapsApiKey();
  const center = await geocodeArea({
    city: input.city,
    district: input.district,
    country: input.country,
    apiKey,
  });

  const places: NonNullable<PlacesSearchResponse["places"]> = [];
  const districtScopes = input.district
    ? [input.district]
    : (TR_CITIES_WITH_DISTRICTS[input.city] ?? []);

  const queryPlans = await mapWithConcurrency(
    districtScopes,
    GOOGLE_QUERY_PLAN_CONCURRENCY,
    async (districtScope) => {
      const scopedCenter = await geocodeArea({
        city: input.city,
        district: districtScope,
        country: input.country,
        apiKey,
      });
      const textQuery = [
        input.sector,
        districtScope,
        input.city,
        input.country,
      ]
        .filter(Boolean)
        .join(" ");
      return { textQuery, scopedCenter };
    },
  );

  if (!input.district) {
    queryPlans.push({
      textQuery: [input.sector, input.city, input.country].filter(Boolean).join(" "),
      scopedCenter: center,
    });
  }

  for (const plan of queryPlans) {
    const batch = await searchPlacesByTextQuery(
      plan.textQuery,
      apiKey,
      plan.scopedCenter,
    );
    places.push(...batch);
  }

  const uniquePlaces = Array.from(
    new Map(
      places
        .filter((p) => Boolean(p.id))
        .map((p) => [p.id as string, p]),
    ).values(),
  );

  const detailPairs = await mapWithConcurrency(
    uniquePlaces,
    GOOGLE_DETAILS_CONCURRENCY,
    async (place) => {
      if (!place.id) return null;
      const details = await fetchPlaceDetails(place.id, apiKey);
      return { placeId: place.id, details };
    },
  );

  const detailMap = new Map<string, PlaceDetailsResponse | null>(
    detailPairs
      .filter((pair): pair is { placeId: string; details: PlaceDetailsResponse | null } => Boolean(pair))
      .map((pair) => [pair.placeId, pair.details]),
  );

  const seen = new Set<string>();
  const results: SearchResult[] = [];

  for (const place of uniquePlaces) {
    const placeId = place.id;
    if (!placeId || seen.has(placeId)) continue;
    seen.add(placeId);

    const details = detailMap.get(placeId) ?? null;
    const phone = details?.nationalPhoneNumber ?? details?.internationalPhoneNumber ?? null;

    results.push({
      placeId,
      name: place.displayName?.text ?? "İsimsiz İşletme",
      category: buildLayeredCategory(input.sector, place.primaryTypeDisplayName?.text),
      city: input.city,
      district: input.district,
      address: place.formattedAddress ?? `${input.district ? `${input.district}, ` : ""}${input.city}`,
      phone,
      email: null,
      website: details?.websiteUri ?? null,
      social: null,
      rating: place.rating ?? 0,
      reviewsCount: place.userRatingCount ?? 0,
      lat: place.location?.latitude ?? center?.lat ?? 0,
      lng: place.location?.longitude ?? center?.lng ?? 0,
      status: "new",
    });
  }

  return enrichResultsWithWebsiteEmails(results);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const newSearchSchema = z.object({
  country: z.string().min(2),
  city: z.enum(TR_CITIES as [string, ...string[]]),
  district: z.string().optional().nullable(),
  sector: z.enum(SECTORS as unknown as [string, ...string[]]),
  segment: z.string().optional().nullable(),
});

export type NewSearchState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------

export async function createSearch(
  _prev: NewSearchState | undefined,
  formData: FormData,
): Promise<NewSearchState> {
  const userId = await requireUserId();

  const parsed = newSearchSchema.safeParse({
    country: formData.get("country"),
    city: formData.get("city"),
    district: formData.get("district") || null,
    sector: formData.get("sector"),
    segment: formData.get("segment") || null,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let results: SearchResult[] = [];
  try {
    results = await fetchGooglePlaces({
      city: parsed.data.city,
      district: parsed.data.district ?? null,
      country: parsed.data.country,
      sector: parsed.data.sector,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Places aramasında beklenmeyen bir hata oluştu.";
    return { error: message };
  }

  const search = await prisma.search.create({
    data: {
      ownerId: userId,
      country: parsed.data.country,
      city: parsed.data.city,
      district: parsed.data.district ?? null,
      radiusKm: 0,
      sector: parsed.data.sector,
      segment: parsed.data.segment ?? null,
      status: "partial",
      resultCount: results.length,
      resultsJson: JSON.stringify(results),
    },
  });

  revalidatePath("/discover");
  redirect(`/discover/${search.id}`);
}

export async function deleteSearch(id: string) {
  const userId = await requireUserId();
  await prisma.search.deleteMany({ where: { id, ownerId: userId } });
  revalidatePath("/discover");
}

export async function importSearchResults(
  searchId: string,
  placeIds: string[],
): Promise<{ imported: number }> {
  const userId = await requireUserId();
  const search = await prisma.search.findFirst({
    where: { id: searchId, ownerId: userId },
  });
  if (!search) return { imported: 0 };

  const results = JSON.parse(search.resultsJson) as SearchResult[];
  const toImport = results.filter((r) => placeIds.includes(r.placeId));

  let imported = 0;
  for (const r of toImport) {
    const existing = await prisma.lead.findFirst({
      where: { ownerId: userId, placeId: r.placeId },
    });
    if (existing) continue;
    await prisma.lead.create({
      data: {
        placeId: r.placeId,
        name: r.name,
        category: r.category,
        city: r.city,
        country: search.country,
        address: r.address,
        phone: r.phone,
        email: r.email,
        website: r.website,
        rating: r.rating,
        reviewsCount: r.reviewsCount,
        lat: r.lat,
        lng: r.lng,
        status: "new",
        source: "google_maps",
        notes: search.segment ? `Hedef segment: ${search.segment}` : null,
        ownerId: userId,
      },
    });
    imported++;
  }

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { imported };
}
