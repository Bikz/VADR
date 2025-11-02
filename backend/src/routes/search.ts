import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Metorial } from 'metorial';
import { leadSchema, type Lead } from '../types/index.js';

const metorial = new Metorial({
  apiKey: process.env.METORIAL_API_KEY || '',
});

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || 'AIzaSyA6ndDKx6PlVu2MMBFIX1IuG5r5ccdFlhY';

function normalisePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function computeConfidence(rating?: number, reviewCount?: number): number {
  const ratingScore = rating ? rating / 5 : 0.4;
  const volumeScore = reviewCount ? Math.min(reviewCount, 200) / 200 : 0.2;
  const confidence = 0.2 + ratingScore * 0.5 + volumeScore * 0.3;
  return Number(Math.min(1, Math.max(0.1, confidence)).toFixed(2));
}

/**
 * Calculate distance between two coordinates using Haversine formula (returns miles)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Search Google Places API for businesses near a location
 */
async function searchGooglePlaces(
  query: string,
  lat: number,
  lng: number,
  apiKey: string
): Promise<Lead[]> {
  try {
    // Enhance query with location context for better results
    // Google Places will prioritize results near the locationBias, but including location in query helps
    const locationQuery = query; // Already location-aware via locationBias
    
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.rating,places.userRatingCount,places.websiteUri,places.editorialSummary,places.businessStatus,places.location',
      },
      body: JSON.stringify({
        textQuery: locationQuery,
        maxResultCount: 20, // Get more results to filter by distance
        includedType: 'establishment',
        languageCode: 'en',
        locationBias: {
          circle: {
            center: {
              latitude: lat,
              longitude: lng,
            },
            radius: 25000.0, // 25km radius - results will be biased toward this area
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Places API error:', response.status, errorText);
      return [];
    }

    const data = await response.json() as any;
    const places = data.places || [];

    const leads: Lead[] = places
      .filter((place: any) => {
        // Only include places with phone numbers and active businesses
        if (!(place.nationalPhoneNumber || place.internationalPhoneNumber) || 
            place.businessStatus === 'CLOSED_PERMANENTLY') {
          return false;
        }

        // Calculate distance and filter out results too far away
        if (place.location?.latitude && place.location?.longitude) {
          const distance = calculateDistance(
            lat,
            lng,
            place.location.latitude,
            place.location.longitude
          );
          
          // Only include results within 25 miles (40km)
          if (distance > 25) {
            return false;
          }
        }
        
        return true;
      })
      .map((place: any) => {
        const phone = place.nationalPhoneNumber || place.internationalPhoneNumber || '';
        const phoneDigits = normalisePhone(phone);

        let distance: number | null = null;
        if (place.location?.latitude && place.location?.longitude) {
          distance = calculateDistance(
            lat,
            lng,
            place.location.latitude,
            place.location.longitude
          );
        }

        const rating = place.rating ? Number(place.rating.toFixed(1)) : 0;
        const reviewCount = typeof place.userRatingCount === 'number' ? place.userRatingCount : 0;

        return {
          id: place.id ?? `google-${phoneDigits}`,
          name: place.displayName.text,
          phone: phoneDigits,
          source: 'Google Places',
          url: place.websiteUri || undefined,
          address: place.formattedAddress || undefined,
          confidence: computeConfidence(rating, reviewCount),
          rating,
          reviewCount,
          description: place.editorialSummary?.text || place.formattedAddress || 'Business listing',
          distance: distance !== null ? Number(distance.toFixed(1)) : null,
        } satisfies Lead;
      })
      .sort((a: Lead, b: Lead) => {
        const aDistance = a.distance ?? Infinity;
        const bDistance = b.distance ?? Infinity;

        if (Number.isFinite(aDistance) || Number.isFinite(bDistance)) {
          return aDistance - bDistance;
        }

        return 0;
      });

    return leads;
  } catch (error) {
    console.error('Error searching Google Places:', error);
    return [];
  }
}

/**
 * Use Exa to find business names, then enrich with Google Places
 */
async function searchWithExaAndEnrich(
  query: string,
  lat: number,
  lng: number,
  googleApiKey: string
): Promise<Lead[]> {
  try {
    // Step 1: Use Exa to find business names from web search
    const exaResponse = await metorial.mcp.withSession(
      {
        serverDeployments: ['svd_0mhhcb7z0wvg34K6xJugat'],
      },
      async (session) => {
        const toolManager = await session.getToolManager();
        
        // Build location-aware query for Exa - include coordinates for location-based search
        const locationQuery = `${query} near coordinates ${lat},${lng}`;
        
        const response = await toolManager.callTool('exa-search', {
          query: locationQuery,
          type: 'neural',
          num_results: 15,
          use_autoprompt: true,
          contents: {
            text: true,
            highlights: true,
          },
        });

        return response;
      }
    );

    // Parse Exa results
    let exaResults: any[] = [];
    if (exaResponse?.contents && Array.isArray(exaResponse.contents) && exaResponse.contents.length > 0) {
      const firstContent = exaResponse.contents[0];
      if (firstContent.text) {
        try {
          const parsed = JSON.parse(firstContent.text);
          exaResults = parsed.results || [];
        } catch {
          exaResults = exaResponse.results || [];
        }
      }
    }

    // Step 2: Extract business names from Exa results
    const businessNames = new Set<string>();
    for (const result of exaResults) {
      let name = result.title || '';
      
      // Clean up and extract business name
      name = name
        .replace(/\s*-\s*(Yelp|Google|Maps|Business|Contact|Phone|Hours|Updated.*?)$/i, '')
        .replace(/\s*\|\s*.*$/i, '')
        .replace(/\s*:\s*.*$/i, '')
        .replace(/\b(top|best|cheap|affordable|find|search)\s+\d+\b/gi, '')
        .replace(/\bupdated\s+\d{4}\b/gi, '')
        .trim();

      // Skip generic/list pages
      if (
        name.toLowerCase().includes('near me') ||
        name.toLowerCase().includes('experts in') ||
        name.toLowerCase().includes('pros in') ||
        name.toLowerCase().includes('top rated') ||
        name.length < 3
      ) {
        continue;
      }

      // Extract from Yelp URLs if available
      if (result.url?.includes('yelp.com/biz/')) {
        try {
          const urlParts = result.url.split('/biz/')[1];
          if (urlParts) {
            const parts = urlParts.split('-');
            name = parts.slice(0, -2).join(' ').replace(/-/g, ' ');
          }
        } catch {}
      }

      if (name.length >= 3 && name.length < 100) {
        businessNames.add(name);
      }
    }

    // Step 3: Enrich each business name with Google Places to get phone numbers
    const leads: Lead[] = [];
    const processedPhones = new Set<string>();

    for (const businessName of Array.from(businessNames).slice(0, 10)) {
      try {
        // Search Google Places for this specific business near user's location
        const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': googleApiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.rating,places.userRatingCount,places.websiteUri,places.editorialSummary,places.location',
          },
          body: JSON.stringify({
            textQuery: businessName,
            maxResultCount: 3, // Get a few results to find the closest one
            languageCode: 'en',
            locationBias: {
              circle: {
                center: { latitude: lat, longitude: lng },
                radius: 25000.0, // 25km radius - results biased toward user location
              },
            },
          }),
        });

        if (response.ok) {
          const data = await response.json() as any;
          const places = data.places || [];

          // Find the closest place to user's location
          let closestPlace: any = null;
          let minDistance = Infinity;

          for (const place of places) {
            if (place.location?.latitude && place.location?.longitude) {
              const distance = calculateDistance(
                lat,
                lng,
                place.location.latitude,
                place.location.longitude
              );
              
              // Only consider places within 25 miles
              if (distance <= 25 && distance < minDistance) {
                minDistance = distance;
                closestPlace = place;
              }
            }
          }

          // If no place found within radius, try first place (fallback)
          if (!closestPlace && places.length > 0) {
            closestPlace = places[0];
            if (closestPlace.location?.latitude && closestPlace.location?.longitude) {
              minDistance = calculateDistance(
                lat,
                lng,
                closestPlace.location.latitude,
                closestPlace.location.longitude
              );
              // Still filter by distance
              if (minDistance > 25) {
                closestPlace = null;
              }
            }
          }

          if (closestPlace) {
            const phone = closestPlace.nationalPhoneNumber || closestPlace.internationalPhoneNumber;
            if (phone) {
              const phoneDigits = normalisePhone(phone);

              if (!processedPhones.has(phoneDigits)) {
                processedPhones.add(phoneDigits);

                const rating = closestPlace.rating ? Number(closestPlace.rating.toFixed(1)) : 0;
                const reviewCount = typeof closestPlace.userRatingCount === 'number' ? closestPlace.userRatingCount : 0;

                leads.push({
                  id: closestPlace.id ?? `exa-${phoneDigits}`,
                  name: closestPlace.displayName.text,
                  phone: phoneDigits,
                  source: 'Google Places',
                  url: closestPlace.websiteUri || undefined,
                  address: closestPlace.formattedAddress || undefined,
                  confidence: computeConfidence(rating, reviewCount),
                  rating,
                  reviewCount,
                  description:
                    closestPlace.editorialSummary?.text || closestPlace.formattedAddress || 'Business listing',
                  distance: minDistance !== Infinity ? Number(minDistance.toFixed(1)) : null,
                });
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Error enriching "${businessName}":`, error);
      }
    }

    return leads;
  } catch (error) {
    console.error('Error in Exa search:', error);
    return [];
  }
}

export async function searchRoutes(fastify: FastifyInstance) {
  fastify.get('/search', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { q, lat, lng } = request.query as { q?: string; lat?: string; lng?: string };

      if (!q) {
        return reply.code(400).send({ error: 'Query parameter "q" is required' });
      }

      if (!lat || !lng) {
        return reply.code(400).send({ error: 'Latitude and longitude parameters are required' });
      }

      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);

      if (isNaN(latitude) || isNaN(longitude)) {
        return reply.code(400).send({ error: 'Invalid latitude or longitude' });
      }

      if (!GOOGLE_PLACES_API_KEY) {
        return reply.code(500).send({ error: 'Google Places API key is not configured' });
      }

      // Clean query
      const cleanedQuery = q
        .replace(/\b(find|get|search|top|best|cheap|affordable)\s+\d+/gi, '')
        .replace(/\bnear me\b/gi, '')
        .trim();

      console.log(`Searching for "${cleanedQuery}" near ${latitude}, ${longitude}`);

      // Strategy 1: Direct Google Places search (primary)
      const directResults = await searchGooglePlaces(cleanedQuery, latitude, longitude, GOOGLE_PLACES_API_KEY);
      console.log(`Direct Google Places found ${directResults.length} businesses`);

      // Strategy 2: Use Exa to discover businesses, then enrich with Google Places (backup/enhancement)
      const exaResults = await searchWithExaAndEnrich(cleanedQuery, latitude, longitude, GOOGLE_PLACES_API_KEY);
      console.log(`Exa + Google Places found ${exaResults.length} businesses`);

      // Combine and deduplicate by phone number, then sort by distance
      const allLeads: Lead[] = [...directResults, ...exaResults];
      const seen = new Map<string, Lead>();

      for (const lead of allLeads) {
        const key = lead.phone;
        if (!seen.has(key)) {
          seen.set(key, lead);
        } else {
          // If duplicate, keep the one with distance info or closer one
          const existing = seen.get(key)!;
        const leadDistance = lead.distance ?? Infinity;
        const existingDistance = existing.distance ?? Infinity;

        if (leadDistance < existingDistance) {
          seen.set(key, lead);
        }
      }
      }

      // Sort by distance (closest first), then take top 10
      const uniqueLeads = Array.from(seen.values())
        .sort((a: Lead, b: Lead) => {
          const aDistance = a.distance ?? Infinity;
          const bDistance = b.distance ?? Infinity;
          return aDistance - bDistance;
        })
        .slice(0, 10);

      console.log(`Returning ${uniqueLeads.length} unique businesses`);

      const parsed = leadSchema.array().parse(uniqueLeads);
      return reply.send(parsed);
    } catch (error: any) {
      console.error('Search error:', error);
      return reply.code(500).send({
        error: error.message || 'Search failed',
        details: error.stack,
      });
    }
  });
}
