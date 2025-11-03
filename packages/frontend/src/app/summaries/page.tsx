'use client';

import { useState, useEffect, useMemo } from 'react';
import { Sparkles, Phone, Clock, TrendingUp, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import type { Call } from '@vadr/shared';
import { getSentimentColor } from '@/lib/call-style';

interface CallSummary {
  call: Call;
  keyPoints: string[];
  outcome: string;
  extractedInfo: {
    price?: string;
    availability?: string;
    notes?: string;
  };
}

function generateCallSummary(call: Call): CallSummary {
  const keyPoints: string[] = [];
  const extractedInfo: { price?: string; availability?: string; notes?: string } = {
    ...call.extractedData,
  };

  // Analyze transcript for key points
  if (call.transcript.length > 0) {
    const humanTurns = call.transcript.filter(t => t.speaker === 'human');
    const aiTurns = call.transcript.filter(t => t.speaker === 'ai');

    // Extract key information from transcript
    const transcriptText = call.transcript.map(t => t.text).join(' ').toLowerCase();

    if (transcriptText.includes('available') || transcriptText.includes('availability')) {
      keyPoints.push('Discussed availability');
    }
    if (transcriptText.includes('price') || transcriptText.includes('$') || transcriptText.includes('cost')) {
      keyPoints.push('Pricing discussed');
    }
    if (transcriptText.includes('appointment') || transcriptText.includes('booking')) {
      keyPoints.push('Appointment booking mentioned');
    }
    if (transcriptText.includes('walk-in') || transcriptText.includes('walk in')) {
      keyPoints.push('Walk-in availability confirmed');
    }

    // Count interactions
    if (humanTurns.length >= 3 && aiTurns.length >= 3) {
      keyPoints.push('Engaged in detailed conversation');
    }
  }

  // Generate outcome based on state
  let outcome = '';
  switch (call.state) {
    case 'completed':
      if (call.sentiment === 'positive') {
        outcome = `Successfully connected with ${call.lead.name}. The conversation was positive and productive.`;
      } else if (call.sentiment === 'neutral') {
        outcome = `Connected with ${call.lead.name}. Collected basic information during the call.`;
      } else {
        outcome = `Connected with ${call.lead.name}. The conversation had some challenges.`;
      }
      break;
    case 'voicemail':
      outcome = `Left a voicemail message at ${call.lead.name}. They did not answer the call.`;
      break;
    case 'failed':
      outcome = `Could not reach ${call.lead.name}. The call was unsuccessful.`;
      break;
    default:
      outcome = `Call to ${call.lead.name} ${call.state}.`;
  }

  return {
    call,
    keyPoints: keyPoints.length > 0 ? keyPoints : ['Basic information exchanged'],
    outcome,
    extractedInfo,
  };
}

export default function SummariesPage() {
  const router = useRouter();
  const [calls, setCalls] = useState<Call[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const callsParam = params.get('calls');

    // If calls are provided in URL, use them
    if (callsParam) {
      try {
        const callsFromUrl = JSON.parse(decodeURIComponent(callsParam)) as Call[];
        setCalls(callsFromUrl);
        setIsLoading(false);
        return;
      } catch (error) {
        console.error('Failed to parse calls from URL:', error);
      }
    }

    // No calls provided - show empty state
    setCalls([]);
    setIsLoading(false);
  }, []);

  const summaries = useMemo(() => {
    return calls.map(call => generateCallSummary(call));
  }, [calls]);

  const stats = useMemo(() => {
    const completed = calls.filter(c => c.state === 'completed').length;
    const voicemail = calls.filter(c => c.state === 'voicemail').length;
    const failed = calls.filter(c => c.state === 'failed').length;
    const totalDuration = calls.reduce((acc, c) => acc + c.duration, 0);
    const avgRating = calls.reduce((acc, c) => acc + (c.lead.rating ?? 0), 0) / calls.length;
    const positiveSentiment = calls.filter(c => c.sentiment === 'positive').length;

    return {
      total: calls.length,
      completed,
      voicemail,
      failed,
      totalDuration,
      avgRating: isNaN(avgRating) ? 0 : avgRating,
      positiveSentiment,
    };
  }, [calls]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex items-center gap-2 text-gray-600">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          <span>Loading call summaries...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Call Summaries</h1>
                <p className="text-sm text-gray-500">Complete overview of all calls</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        {/* Stats Overview */}
        {calls.length > 0 && (
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Calls</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
                </div>
                <Phone className="h-8 w-8 text-gray-400" />
              </div>
            </Card>

            <Card className="border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="text-2xl font-semibold text-green-600">{stats.completed}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </Card>

            <Card className="border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Duration</p>
                  <p className="text-2xl font-semibold text-gray-900">{formatDuration(stats.totalDuration)}</p>
                </div>
                <Clock className="h-8 w-8 text-gray-400" />
              </div>
            </Card>

            <Card className="border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Avg Rating</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.avgRating.toFixed(1)}</p>
                </div>
                <Sparkles className="h-8 w-8 text-yellow-500" />
              </div>
            </Card>
          </div>
        )}

        {/* Call Summaries */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Individual Call Details</h2>
            <Badge variant="outline" className="border-gray-300 text-gray-600">
              {summaries.length} calls
            </Badge>
          </div>

          {summaries.map((summary) => (
            <Card key={summary.call.id} className="border-gray-200 p-6">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-gray-200 pb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{summary.call.lead.name}</h3>
                    <p className="mt-1 text-sm text-gray-500">{summary.call.lead.phone}</p>
                    <p className="mt-1 text-sm text-gray-600">{summary.call.lead.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge
                      variant="outline"
                      className={`${getSentimentColor(summary.call.sentiment)} shrink-0 text-xs uppercase tracking-[0.25em]`}
                    >
                      {summary.call.sentiment}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-gray-300 text-xs uppercase tracking-[0.25em] text-gray-600"
                    >
                      {summary.call.state}
                    </Badge>
                    <span className="text-xs text-gray-500">{formatDuration(summary.call.duration)}</span>
                  </div>
                </div>

                {/* Outcome */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">Outcome</h4>
                  <p className="text-sm leading-relaxed text-gray-700">{summary.outcome}</p>
                </div>

                {/* Key Points */}
                {summary.keyPoints.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">Key Points</h4>
                    <ul className="space-y-1">
                      {summary.keyPoints.map((point, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Extracted Data */}
                {summary.extractedInfo && (summary.extractedInfo.price || summary.extractedInfo.availability) && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">Extracted Information</h4>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {summary.extractedInfo.price && (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <p className="text-xs font-medium text-gray-500">Price</p>
                          <p className="mt-1 text-sm font-semibold text-gray-900">{summary.extractedInfo.price}</p>
                        </div>
                      )}
                      {summary.extractedInfo.availability && (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <p className="text-xs font-medium text-gray-500">Availability</p>
                          <p className="mt-1 text-sm font-semibold text-gray-900">{summary.extractedInfo.availability}</p>
                        </div>
                      )}
                    </div>
                    {summary.extractedInfo.notes && (
                      <p className="mt-2 text-xs text-gray-500">{summary.extractedInfo.notes}</p>
                    )}
                  </div>
                )}

                {/* Transcript Preview */}
                {summary.call.transcript.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">Transcript Preview</h4>
                    <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
                      {summary.call.transcript.slice(0, 3).map((turn) => (
                        <div key={turn.id} className="text-xs">
                          <span className={`font-semibold ${turn.speaker === 'ai' ? 'text-gray-900' : 'text-gray-500'}`}>
                            {turn.speaker === 'ai' ? 'TARA' : summary.call.lead.name.split(' ')[0]}:{' '}
                          </span>
                          <span className="text-gray-700">{turn.text}</span>
                        </div>
                      ))}
                      {summary.call.transcript.length > 3 && (
                        <p className="text-xs text-gray-400 italic">
                          ... and {summary.call.transcript.length - 3} more exchanges
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Call Metadata */}
                <div className="flex items-center gap-4 border-t border-gray-200 pt-4 text-xs text-gray-500">
                  <span>Rating: {summary.call.lead.rating.toFixed(1)}/5</span>
                  <span>•</span>
                  <span>Source: {summary.call.lead.source}</span>
                  {summary.call.lead.distance != null && (
                    <>
                      <span>•</span>
                      <span>{summary.call.lead.distance.toFixed(1)} mi away</span>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}

          {summaries.length === 0 && (
            <Card className="border-gray-200 p-12 text-center">
              <p className="text-gray-500">No call summaries available yet.</p>
              <p className="mt-2 text-sm text-gray-400">Start a call run to see summaries here.</p>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
