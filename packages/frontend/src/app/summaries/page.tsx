'use client';

import { useState, useEffect, useMemo } from 'react';
import { Sparkles, Phone, Clock, TrendingUp } from 'lucide-react';
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

  const overallSummary = useMemo(() => {
    if (calls.length === 0) return null;

    const completed = calls.filter(c => c.state === 'completed');
    const voicemail = calls.filter(c => c.state === 'voicemail');
    const pickedUp = completed.length;
    const total = calls.length;

    // Find best call (highest rating + positive sentiment)
    const bestCall = [...completed].sort((a, b) => {
      const scoreA = a.lead.rating + (a.sentiment === 'positive' ? 1 : 0);
      const scoreB = b.lead.rating + (b.sentiment === 'positive' ? 1 : 0);
      return scoreB - scoreA;
    })[0];

    // Generate conversational summary
    const mainSummary = `I made ${total} call${total !== 1 ? 's' : ''} for you. ${pickedUp} business${pickedUp !== 1 ? 'es' : ''} picked up${voicemail.length > 0 ? `, ${voicemail.length} went to voicemail` : ''}.`;

    let findings = '';
    if (pickedUp > 0) {
      const pricesFound = completed.filter(c => c.extractedData?.price).length;
      const availabilityFound = completed.filter(c => c.extractedData?.availability).length;

      if (pricesFound > 0 || availabilityFound > 0) {
        findings = `From the conversations, I gathered ${pricesFound > 0 ? `pricing information from ${pricesFound} business${pricesFound !== 1 ? 'es' : ''}` : ''}${pricesFound > 0 && availabilityFound > 0 ? ' and ' : ''}${availabilityFound > 0 ? `availability details from ${availabilityFound} location${availabilityFound !== 1 ? 's' : ''}` : ''}.`;
      }
    }

    let recommendation = '';
    if (bestCall) {
      recommendation = `I'd recommend following up with ${bestCall.lead.name} - they have a ${bestCall.lead.rating.toFixed(1)}/5 rating and the conversation went really well.`;
      if (bestCall.extractedData?.price) {
        recommendation += ` They mentioned pricing at ${bestCall.extractedData.price}.`;
      }
      if (bestCall.extractedData?.availability) {
        recommendation += ` Availability: ${bestCall.extractedData.availability}.`;
      }
    } else if (voicemail.length > 0) {
      recommendation = `Since ${voicemail.length} call${voicemail.length !== 1 ? 's' : ''} went to voicemail, I'd suggest trying again later or sending a follow-up message.`;
    } else {
      recommendation = `Unfortunately, none of the calls were successful. You might want to refine your search criteria and try again.`;
    }

    return { mainSummary, findings, recommendation, bestCall };
  }, [calls]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4E4CB]">
        <div className="flex items-center gap-2 text-[#513529]/70">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#523429]/30 border-t-[#523429]" />
          <span className="font-inter">Loading call summaries...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4E4CB]">
      {/* Header */}
      <header className="border-b-[3px] border-[#523429] bg-[#EDD2B0]">
        <div className="mx-auto w-full max-w-6xl px-14 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
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
              <div>
                <p className="font-inter text-[14px] font-medium text-[#513529]/50 uppercase tracking-[0.2em] mb-1">Call Summaries</p>
                <h2 className="font-inter text-[28px] font-bold tracking-[-1.12px] text-[#513529]">Complete overview of all calls</h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-[#523429]/50" />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-14 py-8">
        {/* Stats Overview */}
        {calls.length > 0 && (
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[20px] border-2 border-[#523429] bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-inter text-[12px] font-medium text-[#513529]/50 uppercase tracking-[0.2em]">Total Calls</p>
                  <p className="font-inter text-[32px] font-bold text-[#513529] tracking-[-1.28px]">{stats.total}</p>
                </div>
                <Phone className="h-8 w-8 text-[#523429]/40" />
              </div>
            </div>

            <div className="rounded-[20px] border-2 border-[#523429] bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-inter text-[12px] font-medium text-[#513529]/50 uppercase tracking-[0.2em]">Completed</p>
                  <p className="font-inter text-[32px] font-bold text-[#82EE71] tracking-[-1.28px]">{stats.completed}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-[#82EE71]" />
              </div>
            </div>

            <div className="rounded-[20px] border-2 border-[#523429] bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-inter text-[12px] font-medium text-[#513529]/50 uppercase tracking-[0.2em]">Duration</p>
                  <p className="font-inter text-[32px] font-bold text-[#513529] tracking-[-1.28px]">{formatDuration(stats.totalDuration)}</p>
                </div>
                <Clock className="h-8 w-8 text-[#523429]/40" />
              </div>
            </div>

            <div className="rounded-[20px] border-2 border-[#523429] bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-inter text-[12px] font-medium text-[#513529]/50 uppercase tracking-[0.2em]">Avg Rating</p>
                  <p className="font-inter text-[32px] font-bold text-[#513529] tracking-[-1.28px]">{stats.avgRating.toFixed(1)}</p>
                </div>
                <Sparkles className="h-8 w-8 text-[#FFC105]" />
              </div>
            </div>
          </div>
        )}

        {/* Overall Summary */}
        {overallSummary && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-[#523429]" />
              <h2 className="font-inter text-[24px] font-bold tracking-[-0.96px] text-[#513529]">Here's what I found</h2>
            </div>

            <div className="rounded-[20px] border-2 border-[#523429] bg-white p-8 space-y-6">
              {/* Main Summary */}
              <div>
                <p className="font-inter text-[18px] leading-relaxed text-[#513529]">
                  {overallSummary.mainSummary}
                </p>
              </div>

              {/* Findings */}
              {overallSummary.findings && (
                <div className="border-t-2 border-[#523429] pt-6">
                  <h3 className="mb-3 font-inter text-[14px] font-bold uppercase tracking-[0.3em] text-[#513529]/50">What I learned</h3>
                  <p className="font-inter text-[16px] leading-relaxed text-[#513529]">
                    {overallSummary.findings}
                  </p>
                </div>
              )}

              {/* Recommendation */}
              <div className="rounded-[16px] border-2 border-[#523429] bg-[#EDD2B0]/30 p-6">
                <h3 className="mb-3 font-inter text-[14px] font-bold uppercase tracking-[0.3em] text-[#513529]/50">My recommendation</h3>
                <p className="font-inter text-[16px] leading-relaxed text-[#513529]">
                  {overallSummary.recommendation}
                </p>
                {overallSummary.bestCall && (
                  <div className="mt-4 pt-4 border-t border-[#523429]/20">
                    <p className="font-inter text-[14px] font-bold text-[#513529]">
                      {overallSummary.bestCall.lead.name}
                    </p>
                    <p className="font-inter text-[14px] text-[#513529]/70">
                      {overallSummary.bestCall.lead.phone}
                    </p>
                    {overallSummary.bestCall.lead.address && (
                      <p className="mt-1 font-inter text-[13px] text-[#513529]/60">
                        {overallSummary.bestCall.lead.address}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!overallSummary && summaries.length === 0 && (
          <div className="rounded-[20px] border-2 border-[#523429] bg-white p-12 text-center">
            <p className="font-inter text-[16px] text-[#513529]/70">No call summaries available yet.</p>
            <p className="mt-2 font-inter text-[14px] text-[#513529]/50">Start a call run to see summaries here.</p>
          </div>
        )}
      </main>
    </div>
  );
}
