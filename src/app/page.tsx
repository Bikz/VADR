'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Sparkles, Search, Plus, ArrowUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CallGrid } from '@/components/call-grid';
import type { Call, Lead, VADRRun } from '@/types';
import { apiClient } from '@/lib/api-client';
import { buildCallPrep } from '@/lib/call-prep';

const EXAMPLE_QUERIES = [
  'hair salons with same-day appointments',
  'drywall contractors',
  'massage therapists available today',
  'barbershops that accept walk-ins',
  'tailors offering alterations',
];

const SUGGESTION_PROMPTS = [
  'Find 5 salons near me accepting walk-ins today for under $60',
  'Get quotes for 3 drywall contractors available this week',
  'Find a couples massage for next Friday close to the downtown Hilton in LA',
  'Book a 5 person reservation for a restaurant tomorrow night. Make sure they have dishes with no egg in them.',
];

type Stage = 'search' | 'review' | 'calling' | 'summary';

type GeolocationPermissionState = 'granted' | 'prompt' | 'denied';

type GeolocationPermissionStatus = {
  state: GeolocationPermissionState;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

interface RunSummary {
  highlights: string[];
  recommendation: string;
  nextSteps: string[];
}

function generateRunSummary(query: string, calls: Call[]): RunSummary {
  if (!calls.length) {
    return {
      highlights: [`No calls were placed for "${query}".`],
      recommendation: 'Try refining the query and launching a new search.',
      nextSteps: [
        'Adjust the prompt with more specific requirements.',
        'Expand the acceptable budget or distance.',
        'Run TARA again to gather a new list of leads.'
      ],
    };
  }

  // Analyze query for keywords
  const hasPriceConstraint = /\$\d+|under \$|below \$|budget|price|cost|affordable|cheap/i.test(query);
  const hasTimeConstraint = /today|tomorrow|same.?day|available (today|now)|immediate|asap/i.test(query);
  const hasLocationConstraint = /near me|close|distance|walking distance|local/i.test(query);
  const hasRatingConstraint = /\d+\+ stars|\d+\+ rating|rated|reviews|best|top/i.test(query);
  const hasBookingConstraint = /walk.?in|walkin|appointment|booking|reservation|book/i.test(query);

  const completed = calls.filter(call => call.state === 'completed');
  const voicemail = calls.filter(call => call.state === 'voicemail');
  const failed = calls.filter(call => call.state === 'failed');
  const avgRating = calls.reduce((acc, call) => acc + (call.lead.rating ?? 0), 0) / calls.length;

  // Find best call considering multiple factors
  const bestCall = [...completed]
    .sort((a, b) => {
      if (b.lead.rating !== a.lead.rating) return b.lead.rating - a.lead.rating;
      if ((a.lead as any).distance != null && (b.lead as any).distance != null) {
        return (a.lead as any).distance - (b.lead as any).distance;
      }
      if (a.sentiment === 'positive' && b.sentiment !== 'positive') return -1;
      if (b.sentiment === 'positive' && a.sentiment !== 'positive') return 1;
      return 0;
    })[0] ?? [...calls].sort((a, b) => b.lead.rating - a.lead.rating)[0];

  // Generate highlights
  const highlights: string[] = [];
  highlights.push(
    `Connected with ${completed.length} of ${calls.length} businesses for "${query}" (${voicemail.length} voicemail, ${failed.length} unavailable).`
  );

  if (!Number.isNaN(avgRating) && calls.length > 0) {
    highlights.push(`Average public rating across the selected leads was ${avgRating.toFixed(1)}/5.`);
  }

  if (bestCall) {
    highlights.push(
      `${bestCall.lead.name} stood out with a ${bestCall.lead.rating.toFixed(1)}/5 rating on ${bestCall.lead.source}.`
    );
    
    if (bestCall.sentiment === 'positive') {
      highlights.push(`The conversation with ${bestCall.lead.name} had a positive sentiment.`);
    }
    
    if (bestCall.extractedData?.price) {
      highlights.push(`Pricing information gathered: ${bestCall.lead.name} quoted ${bestCall.extractedData.price}.`);
    }
    
    if (bestCall.extractedData?.availability) {
      highlights.push(`Availability confirmed: ${bestCall.lead.name} has ${bestCall.extractedData.availability}.`);
    }
    
    if ((bestCall.lead as any).distance != null) {
      highlights.push(`${bestCall.lead.name} is ${(bestCall.lead as any).distance.toFixed(1)} miles away.`);
    }
  }

  // Generate contextual recommendations
  const recommendations: string[] = [];
  
  if (bestCall) {
    recommendations.push(
      `Recommend following up with ${bestCall.lead.name} at ${bestCall.lead.phone}. They were rated ${bestCall.lead.rating.toFixed(1)}/5, and the call sentiment was ${bestCall.sentiment}.`
    );
    
    if (bestCall.extractedData?.price) {
      recommendations.push(`Pricing: ${bestCall.extractedData.price} - confirm if this fits your budget.`);
    }
    
    if (bestCall.extractedData?.availability) {
      recommendations.push(`Availability: ${bestCall.extractedData.availability} - verify timing works for your schedule.`);
    }
    
    if (hasLocationConstraint && (bestCall.lead as any).distance != null) {
      recommendations.push(`Location: ${(bestCall.lead as any).distance.toFixed(1)} miles away - convenient for your needs.`);
    }
    
    if (bestCall.sentiment === 'positive') {
      recommendations.push(`The positive conversation indicates good rapport - prioritize this lead.`);
    }
  } else {
    recommendations.push('Recommend refining the search criteria and running TARA again; no strong matches surfaced in this round.');
  }

  // Generate contextual next steps
  const nextSteps: string[] = [];
  
  if (bestCall) {
    nextSteps.push(`Call ${bestCall.lead.name} directly at ${bestCall.lead.phone} to confirm availability, pricing, and next steps.`);
    
    if (bestCall.extractedData) {
      nextSteps.push('Review the extracted data in the transcripts to confirm all details match your requirements.');
    } else {
      nextSteps.push('Review the call transcripts to capture any follow-up questions or details discussed.');
    }
    
    if (hasTimeConstraint) {
      nextSteps.push('Since you need immediate availability, follow up promptly to secure your preferred time slot.');
    }
    
    if (hasPriceConstraint) {
      nextSteps.push('Compare the pricing information with your budget to ensure it aligns with your expectations.');
    }
    
    if (hasBookingConstraint) {
      nextSteps.push('Book your appointment or reservation as soon as possible, especially if walk-ins were mentioned.');
    }
    
    if (voicemail.length > 0) {
      nextSteps.push(`Check back with the ${voicemail.length} business${voicemail.length > 1 ? 'es' : ''} that left voicemail messages - they may have responded.`);
    }
    
    if (completed.length > 1) {
      nextSteps.push('Compare options between the successful calls to make your final decision.');
    }
    
    nextSteps.push('Run another TARA search if you need backup options or broader coverage.');
  } else {
    if (hasPriceConstraint) {
      nextSteps.push('Consider adjusting your budget range - try expanding or being more flexible on price.');
    }
    
    if (hasTimeConstraint) {
      nextSteps.push('Try expanding your time window - same-day availability can be limited.');
    }
    
    if (hasLocationConstraint) {
      nextSteps.push('Broaden your search radius - you may need to travel slightly farther for the best options.');
    }
    
    if (hasRatingConstraint) {
      nextSteps.push('Consider slightly lower-rated businesses that might still meet your needs.');
    }
    
    nextSteps.push('Adjust the search prompt with more specific qualifiers (price, time, location).');
    nextSteps.push('Launch another TARA search once the criteria are refined.');
  }

  return { 
    highlights, 
    recommendation: recommendations.join(' ') || 'Review the results and proceed with the best match.',
    nextSteps 
  };
}

export default function Home() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('search');
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<Lead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Record<string, boolean>>({});
  const [currentRun, setCurrentRun] = useState<VADRRun | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<GeolocationPermissionState | 'unknown'>('unknown');

  // Reverse geocode coordinates to get city name
  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string | null> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`
      );
      const data = await response.json();
      
      if (data.address) {
        const city = data.address.city || data.address.town || data.address.village || 
                     data.address.municipality || data.address.county || '';
        const state = data.address.state || '';
        return city && state ? `${city}, ${state}` : city || state || null;
      }
      return null;
    } catch (error) {
      console.warn('Reverse geocoding error:', error);
      return null;
    }
  }, []);

  const handleRequestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported in this browser.');
      setPermissionState('denied');
      return;
    }

    setIsRequestingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(coords);
        setPermissionState('granted');

        const cityName = await reverseGeocode(coords.lat, coords.lng);
        if (cityName) {
          setLocationName(cityName);
        }
        setIsRequestingLocation(false);
      },
      (error) => {
        console.warn('Geolocation error:', error);
        setIsRequestingLocation(false);
        if (error.code === error.PERMISSION_DENIED) {
          setPermissionState('denied');
          setLocationError('Location access was denied. Enable it in your browser settings or enter a different location.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError('We could not determine your location. Please try again or check your connection.');
        } else if (error.code === error.TIMEOUT) {
          setLocationError('Location request timed out. Please try again.');
        } else {
          setLocationError('We were unable to access your location. Please try again.');
        }
      },
      { timeout: 15000, enableHighAccuracy: true }
    );
  }, [reverseGeocode]);

  useEffect(() => {
    if (!('permissions' in navigator)) {
      return;
    }

    let cancelled = false;
    let permissionStatus: GeolocationPermissionStatus | null = null;

    const anyNavigator = navigator as any;
    const handlePermissionChange = () => {
      if (!permissionStatus) return;
      setPermissionState(permissionStatus.state);
      if (permissionStatus.state === 'granted' && !userLocation && !isRequestingLocation) {
        handleRequestLocation();
      }
    };

    anyNavigator.permissions
      .query({ name: 'geolocation' })
      .then((status: GeolocationPermissionStatus) => {
        if (cancelled) return;
        permissionStatus = status;
        setPermissionState(status.state);
        status.addEventListener?.('change', handlePermissionChange);

        if (status.state === 'granted' && !userLocation) {
          handleRequestLocation();
        }
      })
      .catch(() => {
        setPermissionState('unknown');
      });

    return () => {
      cancelled = true;
      permissionStatus?.removeEventListener?.('change', handlePermissionChange);
    };
  }, [handleRequestLocation, isRequestingLocation, userLocation]);

  const selectedCount = useMemo(
    () => candidates.filter(lead => selectedLeadIds[lead.id]).length,
    [candidates, selectedLeadIds]
  );

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    if (!userLocation) {
      setSearchError('Location is required. Click "Use my location" and approve access, then try again.');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setCandidates([]);
    setSelectedLeadIds({});
    setQuery(searchQuery);

    try {
      const leads = await apiClient.searchLeads({
        query: searchQuery.trim(),
        lat: userLocation.lat,
        lng: userLocation.lng,
      });

      if (leads.length === 0) {
        setSearchError('No businesses found. Try a different search query.');
        setIsSearching(false);
        return;
      }

      const defaults = leads.reduce<Record<string, boolean>>((acc, lead) => {
        acc[lead.id] = true;
        return acc;
      }, {});

      setCandidates(leads);
      setSelectedLeadIds(defaults);
      setCurrentRun(null);
      setSummary(null);
      setStage('review');
    } catch (error) {
      console.error('Search error:', error);
      let errorMessage = 'Failed to search for businesses. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message;
        // Provide more helpful error messages
        if (error.message.includes('Failed to connect') || error.message.includes('fetch') || error.message.includes('Cannot connect')) {
          errorMessage = 'Cannot connect to backend server. Make sure the backend is running on port 3001 (check: http://localhost:3001/health). If using a different port, set NEXT_PUBLIC_BACKEND_URL in .env.local';
        } else if (error.message.includes('Google Places API key')) {
          errorMessage = 'Backend configuration error: Google Places API key is missing or invalid.';
        }
      }
      setSearchError(errorMessage);
      setIsSearching(false);
    }
  };

  const handleToggleLead = (id: string) => {
    setSelectedLeadIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleAll = (value: boolean) => {
    setSelectedLeadIds(
      candidates.reduce<Record<string, boolean>>((acc, lead) => {
        acc[lead.id] = value;
        return acc;
      }, {})
    );
  };

  const handleStartCalls = async () => {
    const selectedLeads = candidates.filter(lead => selectedLeadIds[lead.id]);
    if (!selectedLeads.length) return;

    // For now, just forward to the call page with the selected businesses
    const businessesJson = encodeURIComponent(JSON.stringify(selectedLeads));
    const queryParam = encodeURIComponent(query);
    router.push(`/calls?businesses=${businessesJson}&query=${queryParam}`);
  };

  const handleRunUpdate = (updatedRun: VADRRun) => {
    setCurrentRun(updatedRun);
  };

  const handleRunComplete = (calls: Call[]) => {
    let computedSummary: RunSummary | null = null;
    setCurrentRun(prev => {
      if (!prev) return prev;
      const updated = { ...prev, calls, status: 'completed' as const };
      computedSummary = generateRunSummary(prev.query, calls);
      return updated;
    });

    if (computedSummary) {
      setSummary(computedSummary);
      setStage('summary');
    }
  };

  const handleReset = () => {
    setQuery('');
    setCandidates([]);
    setSelectedLeadIds({});
    setCurrentRun(null);
    setSummary(null);
    setSearchError(null);
    setIsSearching(false);
    setStage('search');
  };

  const renderSearchStage = () => (
    <div className="min-h-screen bg-[#F4E4CB] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-4xl flex flex-col items-center gap-12">
        {/* Logo and Brand */}
        <button
          onClick={handleReset}
          className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <div className="relative w-[74px] h-[74px]">
            <svg width="74" height="74" viewBox="0 0 74 74" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="37" cy="37" r="37" fill="#D4A574"/>
              <circle cx="37" cy="37" r="28" fill="#8B5E3C"/>
              <path d="M20 37C20 27.6 27.6 20 37 20C46.4 20 54 27.6 54 37C54 46.4 46.4 54 37 54" stroke="#F4E4CB" strokeWidth="3"/>
            </svg>
          </div>
          <h1 className="text-[82px] font-normal tracking-[-3.27px] leading-none text-[#523429]" style={{ fontFamily: 'Kodchasan, Inter, -apple-system, sans-serif' }}>
            TARA
          </h1>
        </button>

        <h2 className="text-[50px] font-medium tracking-[-2px] leading-none text-[#513529]">
          How can I help?
        </h2>

        {/* Location status - subtle integration */}
        {isRequestingLocation ? (
          <div className="flex items-center justify-center gap-2 text-sm text-[#523429]/70">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#523429]/30 border-t-[#523429]" />
            <span>Getting your location...</span>
          </div>
        ) : !userLocation && (
          <div className="flex flex-col items-center gap-2">
            {locationError ? (
              <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                {locationError}
              </div>
            ) : (
              <Button
                onClick={handleRequestLocation}
                disabled={isRequestingLocation}
                size="sm"
                className="rounded-full bg-[#523429] px-4 py-2 text-sm font-semibold text-white hover:bg-[#523429]/90 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600"
              >
                Enable location
              </Button>
            )}
          </div>
        )}

        {/* Search input */}
        <div className="w-full relative">
          <div className="absolute inset-0 rounded-[77px] bg-[#EDD2B0]" />
          <div className="absolute inset-0 rounded-[77px] border-[3px] border-[#523429]" />
          
          <div className="relative flex items-center gap-3 px-5 py-4">
            <button 
              className="flex-shrink-0 flex items-center justify-center w-[45px] h-[45px] rounded-full bg-[#F4E4CB] hover:bg-[#F4E4CB]/80 transition-all"
              aria-label="Add attachment"
            >
              <Plus className="w-6 h-6 text-[#523429]" strokeWidth={3} />
            </button>

            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && query.trim() && !isSearching && userLocation && handleSearch(query)}
              placeholder=""
              disabled={isSearching || isRequestingLocation || !userLocation}
              className="flex-1 h-10 border-0 bg-transparent text-base placeholder:text-[#523429]/40 focus-visible:ring-0 focus-visible:ring-offset-0 px-4 disabled:cursor-not-allowed disabled:opacity-50"
            />

            <button
              className="flex-shrink-0 flex items-center justify-center w-[45px] h-[45px] rounded-full bg-[#F4E4CB] hover:bg-[#F4E4CB]/80 transition-all"
              aria-label="Voice input"
            >
              <svg width="29" height="36" viewBox="0 0 29 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M14.5 0.90912C13.2236 0.90912 11.9833 1.38366 11.0571 2.25258C10.597 2.67883 10.2295 3.19509 9.97726 3.76935C9.72502 4.34361 9.59352 4.96358 9.59091 5.59075V14.2291C9.59091 15.4973 10.1276 16.6951 11.0571 17.5673C11.9833 18.4346 13.222 18.9108 14.5 18.9108C15.7764 18.9108 17.0167 18.4362 17.9429 17.5673C18.4032 17.1408 18.7709 16.6243 19.0231 16.0498C19.2753 15.4752 19.4067 14.8549 19.4091 14.2275V5.58912C19.4091 4.32091 18.8707 3.12314 17.9429 2.25093C17.0067 1.38349 15.7762 0.903893 14.5 0.90912ZM12.736 4.04279C13.217 3.60162 13.8473 3.35893 14.5 3.36366C15.1758 3.36366 15.8091 3.61571 16.264 4.04279C16.7156 4.46817 16.9545 5.02619 16.9545 5.59075V14.2291C16.9545 14.7937 16.7156 15.3517 16.264 15.7771C15.7827 16.2177 15.1525 16.4597 14.5 16.4546C13.8242 16.4546 13.1909 16.2026 12.736 15.7755C12.2844 15.35 12.0455 14.792 12.0455 14.2275V5.58912C12.0455 5.02456 12.2844 4.46817 12.736 4.04279Z" fill="#513529"/>
                <path d="M7.95455 11.9546C7.95455 11.6291 7.82523 11.3169 7.59508 11.0868C7.36493 10.8566 7.05279 10.7273 6.72727 10.7273C6.40176 10.7273 6.08962 10.8566 5.85947 11.0868C5.62932 11.3169 5.5 11.6291 5.5 11.9546V14.2209C5.50273 15.3822 5.73851 16.5312 6.19363 17.5996C6.64875 18.668 7.31368 19.6342 8.14932 20.4407C9.54783 21.7939 11.3438 22.6623 13.2727 22.9182V24.6364H10.4091C10.0836 24.6364 9.77145 24.7657 9.5413 24.9958C9.31115 25.226 9.18182 25.5382 9.18182 25.8637C9.18182 26.1892 9.31115 26.5013 9.5413 26.7315C9.77145 26.9616 10.0836 27.0909 10.4091 27.0909H18.5909C18.9164 27.0909 19.2286 26.9616 19.4587 26.7315C19.6889 26.5013 19.8182 26.1892 19.8182 25.8637C19.8182 25.5382 19.6889 25.226 19.4587 24.9958C19.2286 24.7657 18.9164 24.6364 18.5909 24.6364H15.7273V22.9182C17.6563 22.6623 19.4522 21.7939 20.8507 20.4407C21.6864 19.6342 22.3513 18.668 22.8064 17.5996C23.2615 16.5312 23.4973 15.3822 23.5 14.2209V11.9546C23.5 11.6291 23.3707 11.3169 23.1405 11.0868C22.9104 10.8566 22.5982 10.7273 22.2727 10.7273C21.9472 10.7273 21.6351 10.8566 21.4049 11.0868C21.1748 11.3169 21.0455 11.6291 21.0455 11.9546V14.2209C21.0428 15.0539 20.8728 15.8778 20.5456 16.6438C20.2184 17.4098 19.7407 18.1022 19.1407 18.68C17.8948 19.881 16.2305 20.55 14.5 20.5455C12.7695 20.55 11.1052 19.881 9.85932 18.68C9.25932 18.1022 8.78162 17.4098 8.45442 16.6438C8.12722 15.8778 7.95717 15.0539 7.95455 14.2209V11.9546Z" fill="#513529"/>
              </svg>
            </button>

            <button 
              onClick={() => query.trim() && !isSearching && userLocation && handleSearch(query)}
              disabled={!query.trim() || isSearching || !userLocation}
              className="flex-shrink-0 flex items-center justify-center w-[45px] h-[45px] rounded-full bg-[#523429] hover:bg-[#523429]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              aria-label="Submit search"
            >
              <ArrowUp className="w-6 h-6 text-white" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {searchError && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 max-w-2xl w-full">
            {searchError}
          </div>
        )}

        {isSearching && (
          <div className="flex items-center justify-center gap-2 text-sm text-[#523429]/70">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#523429]/30 border-t-[#523429]" />
            <span>Searching businesses near you...</span>
          </div>
        )}

        {/* Suggestion prompts */}
        <div className="w-full flex flex-col items-center gap-6">
          <h3 className="text-2xl font-medium tracking-[-0.96px] text-[#513529]">
            Let Tara:
          </h3>

          <div className="w-full flex flex-col items-center gap-4">
            {SUGGESTION_PROMPTS.map((prompt, index) => (
              <button
                key={index}
                onClick={() => {
                  setQuery(prompt);
                  if (userLocation && !isSearching) {
                    handleSearch(prompt);
                  }
                }}
                disabled={isSearching || isRequestingLocation || !userLocation}
                className="inline-flex items-center justify-center px-[21px] py-[13px] rounded-[70px] border-2 border-[#513529] bg-[#E8BE8C] hover:bg-[#E8BE8C]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-lg font-medium tracking-[-0.72px] text-black">
                  {prompt}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderReviewStage = () => (
    <div className="min-h-screen bg-[#F4E4CB] px-14 py-8">
      <button
        onClick={handleReset}
        className="mb-16 flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
      >
        <div className="relative h-[22px] w-[22px] flex-shrink-0">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="11" cy="11" r="11" fill="#D4A574"/>
            <circle cx="11" cy="11" r="8.3" fill="#8B5E3C"/>
            <path d="M5.9 11C5.9 8.2 8.2 5.9 11 5.9C13.8 5.9 16.1 8.2 16.1 11C16.1 13.8 13.8 16.1 11 16.1" stroke="#F4E4CB" strokeWidth="0.9"/>
          </svg>
        </div>
        <h1 className="font-kodchasan text-[25px] font-normal tracking-[-0.991px] leading-none text-[#523429]">
          TARA
        </h1>
      </button>

      <div className="mb-14">
        <p className="mb-2 font-inter text-[30px] font-medium tracking-[-1.2px] leading-normal text-[#513529]/50">
          REVIEW LEADS
        </p>
        <h2 className="mb-4 font-inter text-[50px] font-medium tracking-[-2px] leading-normal text-[#513529]">
          Pick the businesses Tara will call
        </h2>
        <p className="font-inter text-[24px] font-medium tracking-[-0.96px] leading-normal text-[#513529]/50">
          Uncheck any businesses that do not your criteria. Tara will call the remaining {selectedCount} leads in parallel
        </p>
      </div>

      <div className="relative">
        <div className="rounded-[39px] border-[3px] border-[#523429] bg-white overflow-hidden">
          <div className="rounded-t-[39px] bg-[#EDD2B0] border-b-[3px] border-[#523429] h-[100px]">
          </div>

          <div>
            {candidates.map((lead, index) => {
              const checked = !!selectedLeadIds[lead.id];
              return (
                <div key={lead.id}>
                  <div className="flex items-center px-8 py-12 min-h-[162px] bg-[#F4E4CB]">
                    <button
                      onClick={() => handleToggleLead(lead.id)}
                      className="flex-shrink-0 mr-6"
                      aria-label={`${checked ? 'Uncheck' : 'Check'} ${lead.name}`}
                    >
                      {checked ? (
                        <svg width="55" height="55" viewBox="0 0 55 55" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" clipRule="evenodd" d="M50.4168 27.5C50.4168 40.1564 40.1566 50.4167 27.5002 50.4167C14.8436 50.4167 4.5835 40.1564 4.5835 27.5C4.5835 14.8435 14.8436 4.58334 27.5002 4.58334C40.1566 4.58334 50.4168 14.8435 50.4168 27.5ZM36.7363 20.5555C37.4075 21.2267 37.4075 22.315 36.7363 22.9861L25.2779 34.4444C24.6067 35.1157 23.5186 35.1157 22.8473 34.4444L18.264 29.8611C17.5928 29.1899 17.5928 28.1018 18.264 27.4306C18.9352 26.7593 20.0235 26.7593 20.6947 27.4306L24.0627 30.7984L29.1841 25.677L34.3057 20.5555C34.977 19.8843 36.065 19.8843 36.7363 20.5555Z" fill="#4FB8FF"/>
                        </svg>
                      ) : (
                        <svg width="55" height="55" viewBox="0 0 55 55" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="27.5" cy="27.5" r="25.9167" stroke="#523429" strokeWidth="3.16667"/>
                        </svg>
                      )}
                    </button>

                    <div className="flex-1">
                      <h3 className="font-inter text-xl font-semibold text-[#513529] mb-1">{lead.name}</h3>
                      <p className="font-inter text-base text-[#513529]/70 mb-2">{lead.phone}</p>
                      <p className="font-inter text-sm text-[#513529]/60">{lead.description}</p>
                      <div className="flex items-center gap-4 mt-2">
                        {lead.distance != null && (
                          <span className="font-inter text-sm text-[#513529]/50">{lead.distance.toFixed(1)} mi away</span>
                        )}
                        <span className="font-inter text-sm text-[#513529]/50">{lead.rating.toFixed(1)}/5 · {lead.source}</span>
                      </div>
                    </div>
                  </div>
                  {index < candidates.length - 1 && (
                    <div className="h-[3px] bg-[#523429]" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="font-inter text-lg text-[#513529]/70">
          {selectedCount} of {candidates.length} businesses selected
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => setStage('search')}
            className="rounded-full border-2 border-[#523429] bg-transparent px-6 py-3 font-inter text-base font-medium text-[#523429] hover:bg-[#523429]/10"
          >
            Edit search
          </Button>
          <Button
            onClick={handleStartCalls}
            disabled={!selectedCount}
            className="rounded-full bg-[#523429] px-8 py-3 font-inter text-base font-semibold text-white hover:bg-[#523429]/90 disabled:cursor-not-allowed disabled:bg-[#523429]/30"
          >
            {`Start ${selectedCount} calls`}
          </Button>
        </div>
      </div>
      {launchError && (
        <div className="mt-4 rounded-lg border-2 border-red-400 bg-red-50 px-4 py-3 font-inter text-sm text-red-700">
          {launchError}
        </div>
      )}
    </div>
  );

  const renderCallingStage = () => (
    currentRun && (
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-4 pb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Active query</p>
            <h2 className="text-3xl font-medium text-gray-900">{currentRun.query}</h2>
          </div>
          <p className="text-sm text-gray-500">
            Calls spin up instantly and update in real time. Each tile is one lead in motion.
          </p>
        </div>
        <CallGrid run={currentRun} onRunUpdate={handleRunUpdate} onComplete={handleRunComplete} />
      </div>
    )
  );

  const renderSummaryStage = () => (
    currentRun && summary && (
      <div className="mx-auto w-full max-w-4xl px-6 py-16">
        <div className="flex flex-col items-center gap-10 text-center">
          <div className="space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="text-3xl font-semibold text-gray-900">Summary for "{currentRun.query}"</h2>
            <p className="text-sm text-gray-500">
              TARA completed {currentRun.calls.length} calls and synthesized the key takeaways for you.
            </p>
          </div>

          <div className="w-full space-y-6 text-left">
            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-xs uppercase tracking-[0.3em] text-gray-400">Highlights</h3>
              <ul className="mt-4 space-y-3 text-sm text-gray-600">
                {summary.highlights.map((item, index) => (
                  <li key={index} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-xs uppercase tracking-[0.3em] text-gray-400">Recommendation</h3>
              <p className="mt-4 text-sm leading-relaxed text-gray-700">{summary.recommendation}</p>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-xs uppercase tracking-[0.3em] text-gray-400">Next steps</h3>
              <ul className="mt-4 space-y-3 text-sm text-gray-600">
                {summary.nextSteps.map((item, index) => (
                  <li key={index} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={handleReset} className="rounded-full bg-black px-6 py-2 text-sm font-semibold text-white hover:bg-gray-900">
              Start new search
            </Button>
            <Button
              variant="outline"
              onClick={() => setStage('calling')}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Review call grid
            </Button>
          </div>
        </div>
      </div>
    )
  );

  return (
    <div className={`flex min-h-screen flex-col ${stage === 'search' || stage === 'review' ? 'bg-[#F4E4CB]' : 'bg-white'} text-gray-900`}>
      {stage !== 'search' && stage !== 'review' && (
        <header className="flex items-center justify-end gap-3 px-6 py-4 text-sm text-gray-600">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/calls')}
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            Dev: Call Page
          </Button>
          {stage === 'calling' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              New search
            </Button>
          )}
          {stage === 'summary' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              New search
            </Button>
          )}
        </header>
      )}
      
      {/* Dev button - always visible */}
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/calls')}
          className="border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 shadow-md"
        >
          Dev: Call Page
        </Button>
      </div>

      <main className="flex-1">
        {stage === 'search' && renderSearchStage()}
        {stage === 'review' && renderReviewStage()}
        {stage === 'calling' && renderCallingStage()}
        {stage === 'summary' && renderSummaryStage()}
      </main>

      {stage !== 'search' && stage !== 'review' && (
        <footer className="border-t border-gray-200">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-6 py-5 text-xs text-gray-500 md:flex-row">
            <div className="flex flex-wrap items-center gap-4">
              <span>TARA demo</span>
              <span>Parallel voice research</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <span>Privacy</span>
              <span>Terms</span>
              <span>About</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
