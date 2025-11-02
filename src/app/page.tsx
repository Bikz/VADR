'use client';

import { useMemo, useState, useEffect } from 'react';
import { Sparkles, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CallGrid } from '@/components/call-grid';
import type { Call, Lead, VADRRun } from '@/types';
import { createInitialCall } from '@/lib/mock-data';

const EXAMPLE_QUERIES = [
  'hair salons with same-day appointments',
  'drywall contractors',
  'massage therapists available today',
  'barbershops that accept walk-ins',
  'tailors offering alterations',
];

type Stage = 'search' | 'review' | 'calling' | 'summary';

interface RunSummary {
  highlights: string[];
  recommendation: string;
  nextSteps: string[];
}

function getManualTestLead(): Lead | null {
  const overridePhone = process.env.NEXT_PUBLIC_TEST_PHONE;
  if (!overridePhone) return null;

  const overrideName = process.env.NEXT_PUBLIC_TEST_NAME ?? 'Test Call Target';

  return {
    id: 'test-lead',
    name: overrideName,
    phone: overridePhone,
    source: 'Manual',
    confidence: 1,
    rating: 5,
    reviewCount: 1,
    description: 'Manually configured test recipient',
  } satisfies Lead;
}

function generateRunSummary(query: string, calls: Call[]): RunSummary {
  if (!calls.length) {
    return {
      highlights: [`No calls were placed for "${query}".`],
      recommendation: 'Try refining the query and launching a new search.',
      nextSteps: [
        'Adjust the prompt with more specific requirements.',
        'Expand the acceptable budget or distance.',
        'Run VADR again to gather a new list of leads.',
      ],
    };
  }

  const completed = calls.filter(call => call.state === 'completed');
  const voicemail = calls.filter(call => call.state === 'voicemail');
  const failed = calls.filter(call => call.state === 'failed');
  const avgRating = calls.reduce((acc, call) => acc + (call.lead.rating ?? 0), 0) / calls.length;

  const bestCall = [...completed]
    .sort((a, b) => {
      if (b.lead.rating !== a.lead.rating) return b.lead.rating - a.lead.rating;
      if ((a.lead as any).distance != null && (b.lead as any).distance != null) {
        return (a.lead as any).distance - (b.lead as any).distance;
      }
      return 0;
    })[0] ?? [...calls].sort((a, b) => b.lead.rating - a.lead.rating)[0];

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
  }

  const recommendation = bestCall
    ? `Recommend following up with ${bestCall.lead.name} at ${bestCall.lead.phone}. They were rated ${bestCall.lead.rating.toFixed(1)}/5, and the call sentiment was ${bestCall.sentiment}. Their team noted: ${bestCall.lead.description}`
    : 'Recommend refining the search criteria and running VADR again; no strong matches surfaced in this round.';

  const nextSteps = bestCall
    ? [
        `Call ${bestCall.lead.name} directly to confirm availability, pricing, and next steps.`,
        'Review the transcripts to capture any follow-up questions or details.',
        'Run another VADR search if you need backup options or broader coverage.',
      ]
    : [
        'Adjust the search prompt with more specific qualifiers (price, time, location).',
        'Consider broadening the acceptable distance or service scope.',
        'Launch another VADR search once the criteria are refined.',
      ];

  return { highlights, recommendation, nextSteps };
}

export default function Home() {
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
  const [isRequestingLocation, setIsRequestingLocation] = useState(true);

  // Reverse geocode coordinates to get city name
  const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
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
  };

  // Auto-request location on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      setIsRequestingLocation(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(coords);
          
          const cityName = await reverseGeocode(coords.lat, coords.lng);
          if (cityName) {
            setLocationName(cityName);
          }
          setIsRequestingLocation(false);
        },
        (error) => {
          console.warn('Geolocation error:', error);
          setLocationError('Location access denied. Please enable location access to use VADR.');
          setIsRequestingLocation(false);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    } else {
      setLocationError('Geolocation not supported in your browser.');
      setIsRequestingLocation(false);
    }
  }, []);

  const selectedCount = useMemo(
    () => candidates.filter(lead => selectedLeadIds[lead.id]).length,
    [candidates, selectedLeadIds]
  );

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    if (!userLocation) {
      setSearchError('Location is required. Please enable location access.');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setCandidates([]);
    setSelectedLeadIds({});
    setQuery(searchQuery);

    try {
      const searchParams = new URLSearchParams({
        q: searchQuery.trim(),
        lat: userLocation.lat.toString(),
        lng: userLocation.lng.toString(),
      });

      const response = await fetch(`/api/search?${searchParams.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Search failed: ${response.status}`);
      }

      const results = await response.json();
      
      const leads: Lead[] = results.map((result: any, index: number) => ({
        id: `lead-${Date.now()}-${index}`,
        name: result.name,
        phone: result.phone,
        source: result.source ?? 'Search',
        url: result.url ?? undefined,
        confidence: 0.9,
        rating: result.rating != null ? Number(result.rating.toFixed(1)) : 0,
        reviewCount: 0,
        description: result.description ?? 'No description available',
        distance: result.distance ?? null,
      }));

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
      setSearchError(error instanceof Error ? error.message : 'Failed to search for businesses. Please try again.');
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

    const calls = selectedLeads.map(createInitialCall);
    const run: VADRRun = {
      id: `run-${Date.now()}`,
      query,
      createdBy: 'demo-user',
      startedAt: Date.now(),
      status: 'calling',
      calls,
    };

    setCurrentRun(run);
    setStage('calling');
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
    <div className="mx-auto flex min-h-[calc(100vh-200px)] w-full max-w-3xl flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="select-none text-6xl font-semibold tracking-tight">
        <span className="text-gray-900">V</span>
        <span className="text-gray-900">A</span>
        <span className="text-gray-900">D</span>
        <span className="text-gray-900">R</span>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        {/* Location status */}
        <div className="flex flex-col gap-2">
          {isRequestingLocation ? (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
              <span>Getting your precise location...</span>
            </div>
          ) : userLocation ? (
            <div className="flex flex-col items-center gap-1">
              <p className="text-sm text-gray-600">
                📍 Searching near: <span className="font-medium text-gray-900">{locationName || 'Your location'}</span>
              </p>
            </div>
          ) : locationError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {locationError}
            </div>
          ) : null}
        </div>

        {/* Search bar */}
        <div className="group relative flex items-center rounded-full border border-gray-200 bg-white px-5 py-3 shadow-sm hover:shadow md:px-6">
          <Search className={`mr-3 h-5 w-5 ${isSearching ? 'text-gray-300' : 'text-gray-400'}`} />
          <Input
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && !isSearching && userLocation && handleSearch(query)}
            placeholder="Enter your search query (e.g., 'hair salons with same-day appointments')"
            disabled={isSearching || isRequestingLocation || !userLocation}
            className="h-8 flex-1 border-0 p-0 text-base placeholder:text-gray-400 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="ml-3 flex items-center gap-2 text-gray-400">
            {isSearching ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
            ) : (
              <span className="text-lg" aria-hidden>
                🎤
              </span>
            )}
          </div>
        </div>

        <Button
          onClick={() => handleSearch(query)}
          disabled={isSearching || isRequestingLocation || !userLocation || !query.trim()}
          variant="secondary"
          className="w-full rounded bg-gray-100 px-5 py-2 text-sm text-gray-800 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSearching ? 'Searching...' : 'VADR Search'}
        </Button>

        {searchError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {searchError}
          </div>
        )}

        {isSearching && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
            <span>Searching businesses near you...</span>
          </div>
        )}

        {/* Example queries as buttons */}
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Or try one of these:</p>
          <div className="flex flex-col gap-2">
            {EXAMPLE_QUERIES.map((example, index) => (
              <Button
                key={index}
                onClick={() => handleSearch(example)}
                disabled={isSearching || isRequestingLocation || !userLocation}
                variant="outline"
                className="w-full justify-start border-gray-200 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="mr-2">🎤</span>
                {example}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderReviewStage = () => (
    <div className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="flex flex-col gap-2 pb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Review leads</p>
        <h2 className="text-3xl font-semibold text-gray-900">Pick the businesses VADR will call</h2>
        <p className="text-sm text-gray-500">
          Uncheck any businesses that do not fit the search intent. VADR will call the remaining {selectedCount} leads in parallel.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs uppercase tracking-[0.2em] text-gray-500">
              <th className="px-5 py-4">
                <input
                  type="checkbox"
                  checked={selectedCount === candidates.length}
                  ref={input => {
                    if (input) {
                      input.indeterminate = selectedCount > 0 && selectedCount < candidates.length;
                    }
                  }}
                  onChange={event => handleToggleAll(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </th>
              <th className="px-5 py-4 text-sm font-medium">Business</th>
              <th className="px-5 py-4 text-sm font-medium">Contact</th>
              <th className="px-5 py-4 text-sm font-medium">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {candidates.map(lead => {
              const checked = !!selectedLeadIds[lead.id];
              return (
                <tr key={lead.id} className="text-sm text-gray-600">
                  <td className="px-5 py-4 align-top">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleLead(lead.id)}
                      className="mt-1 h-4 w-4 rounded border-gray-300"
                    />
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="font-semibold text-gray-900">{lead.name}</div>
                    {(lead as any).distance != null && (
                      <p className="text-xs text-gray-500">{(lead as any).distance} mi away</p>
                    )}
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="font-mono text-sm text-gray-700">{lead.phone}</div>
                    <p className="text-xs text-gray-500">{lead.source}</p>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <p className="text-sm text-gray-600">{lead.description}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-gray-500">
          {selectedCount} of {candidates.length} businesses selected
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStage('search')}
            className="border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Edit search
          </Button>
          <Button
            onClick={handleStartCalls}
            disabled={!selectedCount || isLaunching}
            className="rounded-full bg-black px-6 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
          >
            {isLaunching ? 'Launching calls…' : `Go · ${selectedCount} calls`}
          </Button>
        </div>
      </div>
      {launchError && (
        <p className="mt-3 text-sm text-red-500">{launchError}</p>
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
              VADR completed {currentRun.calls.length} calls and synthesized the key takeaways for you.
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
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <header className="flex items-center justify-end gap-3 px-6 py-4 text-sm text-gray-600">
        {stage === 'review' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStage('search')}
            className="text-gray-500 hover:text-gray-900"
          >
            Back to search
          </Button>
        )}
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

      <main className="flex-1">
        {stage === 'search' && renderSearchStage()}
        {stage === 'review' && renderReviewStage()}
        {stage === 'calling' && renderCallingStage()}
        {stage === 'summary' && renderSummaryStage()}
      </main>

      <footer className="border-t border-gray-200">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-6 py-5 text-xs text-gray-500 md:flex-row">
          <div className="flex flex-wrap items-center gap-4">
            <span>VADR demo</span>
            <span>Parallel voice research</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span>Privacy</span>
            <span>Terms</span>
            <span>About</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
