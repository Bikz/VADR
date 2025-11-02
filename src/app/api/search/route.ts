import { NextRequest, NextResponse } from 'next/server';
import { Metorial } from 'metorial';

const metorial = new Metorial({
  apiKey: process.env.METORIAL_API_KEY || '',
});

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || 'AIzaSyA6ndDKx6PlVu2MMBFIX1IuG5r5ccdFlhY';

interface BusinessLead {
  name: string;
  phone: string;
  source: string;
  url?: string;
  rating: number;
  description: string;
  distance: number | null;
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
): Promise<BusinessLead[]> {
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

    const data = await response.json();
    const places = data.places || [];

    const leads: BusinessLead[] = places
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
        
        // Calculate distance
        let distance: number | null = null;
        if (place.location?.latitude && place.location?.longitude) {
          distance = calculateDistance(
            lat,
            lng,
            place.location.latitude,
            place.location.longitude
          );
        }
        
        return {
          name: place.displayName.text,
          phone: phone.replace(/\D/g, ''), // Remove formatting, keep digits only
          source: 'Search',
          url: place.websiteUri || undefined,
          rating: place.rating ? Number(place.rating.toFixed(1)) : 0,
          description: place.editorialSummary?.text || place.formattedAddress || 'Business listing',
          distance: distance ? Number(distance.toFixed(1)) : null,
        };
      })
      .sort((a: BusinessLead, b: BusinessLead) => {
        // Sort by distance (closest first)
        if (a.distance !== null && b.distance !== null) {
          return a.distance - b.distance;
        }
        if (a.distance !== null) return -1;
        if (b.distance !== null) return 1;
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
): Promise<BusinessLead[]> {
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
    const leads: BusinessLead[] = [];
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
          const data = await response.json();
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
              const phoneDigits = phone.replace(/\D/g, '');
              
              // Avoid duplicates
              if (!processedPhones.has(phoneDigits)) {
                processedPhones.add(phoneDigits);
                
                leads.push({
                  name: closestPlace.displayName.text,
                  phone: phoneDigits,
                  source: 'Search',
                  url: closestPlace.websiteUri || undefined,
                  rating: closestPlace.rating ? Number(closestPlace.rating.toFixed(1)) : 0,
                  description: closestPlace.editorialSummary?.text || closestPlace.formattedAddress || 'Business listing',
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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Latitude and longitude parameters are required' },
        { status: 400 }
      );
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: 'Invalid latitude or longitude' },
        { status: 400 }
      );
    }

    if (!GOOGLE_PLACES_API_KEY) {
      return NextResponse.json(
        { error: 'Google Places API key is not configured' },
        { status: 500 }
      );
    }

    // Clean query
    const cleanedQuery = query
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
    const allLeads = [...directResults, ...exaResults];
    const seen = new Map<string, BusinessLead>();
    
    for (const lead of allLeads) {
      const key = lead.phone;
      if (!seen.has(key)) {
        seen.set(key, lead);
      } else {
        // If duplicate, keep the one with distance info or closer one
        const existing = seen.get(key)!;
        if (lead.distance !== null && (existing.distance === null || lead.distance < existing.distance)) {
          seen.set(key, lead);
        }
      }
    }

    // Sort by distance (closest first), then take top 10
    const uniqueLeads = Array.from(seen.values())
      .sort((a: BusinessLead, b: BusinessLead) => {
        if (a.distance !== null && b.distance !== null) {
          return a.distance - b.distance;
        }
        if (a.distance !== null) return -1;
        if (b.distance !== null) return 1;
        return 0;
      })
      .slice(0, 10);

    console.log(`Returning ${uniqueLeads.length} unique businesses`);

    return NextResponse.json(uniqueLeads);
  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Search failed', 
        details: error.stack 
      },
      { status: 500 }
    );
  }
}
