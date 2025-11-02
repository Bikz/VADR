import type { Call, Lead, TranscriptTurn } from '@/types';

/**
 * Generate test call data for benchmarking when real calls don't work
 */
export function generateTestCalls(query: string): Call[] {
  const testLeads: Lead[] = [
    {
      id: 'test-lead-1',
      name: 'Elite Salon & Spa',
      phone: '+14155551234',
      source: 'Google',
      confidence: 0.95,
      rating: 4.8,
      reviewCount: 247,
      description: 'Premium full-service salon offering hair, nails, and massage services',
      distance: 0.8,
    },
    {
      id: 'test-lead-2',
      name: 'Modern Barber Shop',
      phone: '+14155552345',
      source: 'Yelp',
      confidence: 0.92,
      rating: 4.6,
      reviewCount: 189,
      description: 'Contemporary barbershop with walk-in availability and online booking',
      distance: 1.2,
    },
    {
      id: 'test-lead-3',
      name: 'Wellness Massage Center',
      phone: '+14155553456',
      source: 'Google',
      confidence: 0.88,
      rating: 4.9,
      reviewCount: 312,
      description: 'Therapeutic massage and wellness treatments, accepts same-day appointments',
      distance: 2.1,
    },
    {
      id: 'test-lead-4',
      name: 'Quick Cuts Hair Studio',
      phone: '+14155554567',
      source: 'Yelp',
      confidence: 0.85,
      rating: 4.4,
      reviewCount: 156,
      description: 'Affordable haircuts with walk-in availability, popular with locals',
      distance: 0.5,
    },
    {
      id: 'test-lead-5',
      name: 'Luxury Spa Retreat',
      phone: '+14155555678',
      source: 'Google',
      confidence: 0.93,
      rating: 4.7,
      reviewCount: 428,
      description: 'Upscale spa offering facials, massages, and wellness packages',
      distance: 3.2,
    },
  ];

  const transcriptTemplates: Record<string, TranscriptTurn[][]> = {
    'test-lead-1': [
      [
        {
          id: 't1-1',
          speaker: 'ai',
          text: "Hi, I'm calling from VADR about same-day appointment availability. Is this Elite Salon & Spa?",
          timestamp: Date.now() - 360000,
          t0_ms: 0,
          t1_ms: 3500,
        },
        {
          id: 't1-2',
          speaker: 'human',
          text: 'Yes, this is Elite Salon. How can I help you?',
          timestamp: Date.now() - 357000,
          t0_ms: 3500,
          t1_ms: 6200,
        },
        {
          id: 't1-3',
          speaker: 'ai',
          text: "Great! I'm looking for a hair appointment today. Do you have any availability?",
          timestamp: Date.now() - 354000,
          t0_ms: 6200,
          t1_ms: 9800,
        },
        {
          id: 't1-4',
          speaker: 'human',
          text: "We do have a few slots available. What time works best for you?",
          timestamp: Date.now() - 351000,
          t0_ms: 9800,
          t1_ms: 12500,
        },
        {
          id: 't1-5',
          speaker: 'ai',
          text: "Any time after 2 PM would be perfect. What's your pricing like?",
          timestamp: Date.now() - 348000,
          t0_ms: 12500,
          t1_ms: 16200,
        },
        {
          id: 't1-6',
          speaker: 'human',
          text: 'A basic cut is $65, and we have availability at 3 PM and 4:30 PM today.',
          timestamp: Date.now() - 345000,
          t0_ms: 16200,
          t1_ms: 19800,
        },
        {
          id: 't1-7',
          speaker: 'ai',
          text: 'Perfect! I will check with my client and get back to you. Thank you so much for your time!',
          timestamp: Date.now() - 342000,
          t0_ms: 19800,
          t1_ms: 22800,
        },
      ],
    ],
    'test-lead-2': [
      [
        {
          id: 't2-1',
          speaker: 'ai',
          text: 'Hello, is this Modern Barber Shop?',
          timestamp: Date.now() - 240000,
          t0_ms: 0,
          t1_ms: 2800,
        },
        {
          id: 't2-2',
          speaker: 'human',
          text: 'Yes, speaking. What can I do for you?',
          timestamp: Date.now() - 238000,
          t0_ms: 2800,
          t1_ms: 5200,
        },
        {
          id: 't2-3',
          speaker: 'ai',
          text: "I'm calling about walk-in availability. Do you accept walk-ins today?",
          timestamp: Date.now() - 235000,
          t0_ms: 5200,
          t1_ms: 8900,
        },
        {
          id: 't2-4',
          speaker: 'human',
          text: "Yes, we do! We're not too busy right now. When are you thinking?",
          timestamp: Date.now() - 232000,
          t0_ms: 8900,
          t1_ms: 12100,
        },
        {
          id: 't2-5',
          speaker: 'ai',
          text: 'Great! And what are your prices?',
          timestamp: Date.now() - 229000,
          t0_ms: 12100,
          t1_ms: 14500,
        },
        {
          id: 't2-6',
          speaker: 'human',
          text: 'A standard cut is $35. We have walk-in availability all afternoon.',
          timestamp: Date.now() - 226000,
          t0_ms: 14500,
          t1_ms: 17800,
        },
        {
          id: 't2-7',
          speaker: 'ai',
          text: "That sounds great. I'll pass this along. Thank you!",
          timestamp: Date.now() - 223000,
          t0_ms: 17800,
          t1_ms: 20500,
        },
      ],
    ],
    'test-lead-3': [
      [
        {
          id: 't3-1',
          speaker: 'ai',
          text: 'Hi, I am calling about massage appointments. Is this Wellness Massage Center?',
          timestamp: Date.now() - 180000,
          t0_ms: 0,
          t1_ms: 4200,
        },
        {
          id: 't3-2',
          speaker: 'human',
          text: 'Yes, this is Wellness Massage Center. How may I assist you?',
          timestamp: Date.now() - 177000,
          t0_ms: 4200,
          t1_ms: 7800,
        },
        {
          id: 't3-3',
          speaker: 'ai',
          text: "Do you have same-day availability for a couples massage?",
          timestamp: Date.now() - 174000,
          t0_ms: 7800,
          t1_ms: 11200,
        },
        {
          id: 't3-4',
          speaker: 'human',
          text: "We do! We have availability at 6 PM and 7:30 PM today. It's $180 for a 60-minute couples massage.",
          timestamp: Date.now() - 171000,
          t0_ms: 11200,
          t1_ms: 16500,
        },
        {
          id: 't3-5',
          speaker: 'ai',
          text: "That's perfect. I'll let my clients know. Thank you so much!",
          timestamp: Date.now() - 168000,
          t0_ms: 16500,
          t1_ms: 19200,
        },
      ],
    ],
    'test-lead-4': [
      [
        {
          id: 't4-1',
          speaker: 'ai',
          text: 'Hello, is this Quick Cuts?',
          timestamp: Date.now() - 120000,
          t0_ms: 0,
          t1_ms: 2400,
        },
        {
          id: 't4-2',
          speaker: 'human',
          text: 'You have reached the voicemail of Quick Cuts Hair Studio. Please leave a message after the beep.',
          timestamp: Date.now() - 117000,
          t0_ms: 2400,
          t1_ms: 8500,
        },
        {
          id: 't4-3',
          speaker: 'ai',
          text: 'Hi, this is VADR calling about walk-in availability. Please call us back when you have a chance. Thank you!',
          timestamp: Date.now() - 114000,
          t0_ms: 8500,
          t1_ms: 13800,
        },
      ],
    ],
    'test-lead-5': [
      [
        {
          id: 't5-1',
          speaker: 'ai',
          text: 'Hi, is this Luxury Spa Retreat?',
          timestamp: Date.now() - 60000,
          t0_ms: 0,
          t1_ms: 2600,
        },
        {
          id: 't5-2',
          speaker: 'human',
          text: 'I am sorry, we are currently closed. Our hours are 9 AM to 7 PM.',
          timestamp: Date.now() - 57000,
          t0_ms: 2600,
          t1_ms: 7200,
        },
        {
          id: 't5-3',
          speaker: 'ai',
          text: 'Thank you for letting me know. I will call back during business hours.',
          timestamp: Date.now() - 54000,
          t0_ms: 7200,
          t1_ms: 10200,
        },
      ],
    ],
  };

  const calls: Call[] = testLeads.map((lead, index) => {
    const transcript = transcriptTemplates[lead.id]?.[0] || [];
    const startedAt = Date.now() - (360000 - index * 60000);
    const endedAt = transcript.length > 0 ? startedAt + (transcript[transcript.length - 1].t1_ms || 0) : startedAt + 30000;
    const duration = Math.floor((endedAt - startedAt) / 1000);

    let state: Call['state'] = 'completed';
    let sentiment: Call['sentiment'] = 'positive';

    if (lead.id === 'test-lead-4') {
      state = 'voicemail';
      sentiment = 'neutral';
    } else if (lead.id === 'test-lead-5') {
      state = 'failed';
      sentiment = 'neutral';
    } else if (transcript.length > 5) {
      sentiment = 'positive';
    } else {
      sentiment = 'neutral';
    }

    return {
      id: `call-${lead.id}-${Date.now()}-${index}`,
      leadId: lead.id,
      lead,
      state,
      startedAt,
      endedAt,
      duration,
      transcript,
      sentiment,
      isListening: false,
      isTakenOver: false,
      extractedData: state === 'completed' && transcript.length > 4
        ? {
            price: lead.id === 'test-lead-1' ? '$65' : lead.id === 'test-lead-2' ? '$35' : lead.id === 'test-lead-3' ? '$180' : undefined,
            availability: lead.id === 'test-lead-1' ? '3 PM, 4:30 PM' : lead.id === 'test-lead-2' ? 'All afternoon' : lead.id === 'test-lead-3' ? '6 PM, 7:30 PM' : undefined,
            notes: `Contacted about ${query.toLowerCase()}`,
          }
        : undefined,
    };
  });

  return calls;
}

