import type { Call, CallPrep, Lead, TranscriptTurn, CallState, Sentiment } from '@/types';

const businessNames = [
  "Serenity Spa & Wellness",
  "Bella Hair Studio",
  "Premier Drywall Services",
  "Urban Cuts Barbershop",
  "Zen Massage Therapy",
  "ProFix Contractors",
  "Style Studio Hair Salon",
  "Relaxation Point Spa",
  "Expert Home Repairs",
  "The Grooming Lounge"
];

const businessDescriptions = [
  "Full-service spa offering Swedish, deep tissue, and hot stone massages with same-day availability.",
  "Neighborhood salon specializing in cuts, color, and styling with flexible booking.",
  "Licensed drywall specialists handling repairs and full room resurfacing on short timelines.",
  "Modern barbershop focused on fades, beard trims, and walk-in availability.",
  "Therapeutic massage studio with online booking and bundled session pricing.",
  "Family-owned contractor handling drywall, paint, and light renovations for residential jobs.",
  "Boutique salon with senior stylists and express blowout services.",
  "Day spa featuring aromatherapy, couples massages, and loyalty pricing tiers.",
  "General home repair crew managing drywall, patching, and finishing work.",
  "Upscale grooming lounge offering straight-razor shaves and same-day appointments."
];

const sources = ["Google", "Yelp", "Google", "Yelp", "Google"]; // bias toward major review platforms

export function generateMockLeads(count: number): Lead[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `lead-${i + 1}`,
    name: businessNames[i % businessNames.length],
    phone: `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    source: sources[i % sources.length],
    url: `https://example.com/business-${i + 1}`,
    confidence: 0.7 + Math.random() * 0.3,
    rating: Number((4 + Math.random() * 1).toFixed(1)),
    reviewCount: 40 + Math.floor(Math.random() * 260),
    description: businessDescriptions[i % businessDescriptions.length]
  }));
}

export function createInitialCall(lead: Lead): Call {
  return {
    id: `call-${lead.id}`,
    leadId: lead.id,
    lead,
    state: 'idle',
    duration: 0,
    transcript: [],
    sentiment: 'neutral',
    isListening: false,
    isTakenOver: false
  };
}

const sampleTranscripts = {
  spa: [
    { speaker: 'human' as const, texts: [
      "Hello, Serenity Spa, how can I help you?",
      "Yes, we do have availability today.",
      "We have a slot at 4:15 PM for a Swedish massage.",
      "The price is $55 for a 60-minute session.",
      "Great, can I get your name please?"
    ]},
    { speaker: 'ai' as const, texts: [
      "Hi, I'm calling to inquire about same-day massage appointments.",
      "Wonderful! Do you have anything available around 4 PM?",
      "That sounds perfect. What's the pricing?",
      "Excellent. I'd like to book that appointment.",
      "Sure, it's for Sarah Johnson."
    ]}
  ],
  salon: [
    { speaker: 'human' as const, texts: [
      "Good afternoon, Bella Hair Studio speaking.",
      "I'm sorry, we're fully booked for today.",
      "Our earliest availability is tomorrow at 11 AM.",
      "A standard cut and style is $45."
    ]},
    { speaker: 'ai' as const, texts: [
      "Hi there! I'm looking for a same-day haircut appointment.",
      "Oh, I understand. What about tomorrow?",
      "That could work. What are your rates?",
      "Thank you for the information. I'll call back to confirm."
    ]}
  ],
  contractor: [
    { speaker: 'human' as const, texts: [
      "Premier Drywall, this is Mike.",
      "Sure, we can do next-day service depending on the size.",
      "For a standard room, we charge $800 to $1200.",
      "I can come out tomorrow morning to give you a proper quote.",
      "What's your address?"
    ]},
    { speaker: 'ai' as const, texts: [
      "Hi Mike, I need drywall repair with next-day availability.",
      "It's a living room, about 12 by 14 feet.",
      "That works for me. What's the price range?",
      "Perfect. Let me get back to you on the address.",
      "I'll call you back within the hour. Thanks!"
    ]}
  ]
};

export function getRandomTranscriptSet() {
  const sets = Object.values(sampleTranscripts);
  return sets[Math.floor(Math.random() * sets.length)];
}

export function generateTranscriptTurn(
  callId: string,
  turnIndex: number,
  speaker: 'ai' | 'human',
  text: string,
  baseTime: number
): TranscriptTurn {
  const t0 = baseTime + turnIndex * 3000 + Math.random() * 2000;
  const duration = text.length * 50 + Math.random() * 500;
  const uniqueSuffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id: `${callId}-turn-${turnIndex}-${uniqueSuffix}`,
    speaker,
    text,
    timestamp: Date.now(),
    t0_ms: t0,
    t1_ms: t0 + duration
  };
}

export const mockCallPrep: CallPrep = {
  objective: "Find same-day massage appointments within 2 miles, under $60, available around 4 PM",
  script: `1. Greet professionally
2. Ask about same-day availability for massage
3. Inquire about pricing
4. Confirm time slots near 4 PM
5. Note any special requirements (parking, payment methods)
6. Thank them and end call politely`,
  variables: {
    service_type: "massage therapy",
    preferred_time: "4:00 PM",
    max_price: "$60",
    distance: "2 miles"
  },
  redFlags: [
    "Price over $60",
    "No same-day availability",
    "Cash only (if customer needs card)",
    "Unprofessional responses"
  ],
  disallowedTopics: [
    "Medical advice",
    "Diagnoses",
    "Prescription recommendations",
    "Personal information sharing"
  ]
};

export function getStateColor(state: CallState): string {
  switch (state) {
    case 'dialing':
      return 'border border-gray-300 bg-gray-100 text-gray-600';
    case 'ringing':
      return 'border border-gray-200 bg-gray-50 text-gray-600';
    case 'connected':
      return 'border border-gray-900 bg-gray-900 text-white';
    case 'voicemail':
      return 'border border-gray-300 bg-gray-200 text-gray-700';
    case 'completed':
      return 'border border-gray-200 bg-gray-100 text-gray-500';
    case 'failed':
      return 'border border-gray-300 bg-gray-200 text-gray-700';
    default:
      return 'border border-gray-200 bg-gray-100 text-gray-500';
  }
}

export function getSentimentColor(sentiment: Sentiment): string {
  switch (sentiment) {
    case 'positive':
      return 'border border-gray-900 bg-gray-900 text-white';
    case 'negative':
      return 'border border-gray-300 bg-gray-200 text-gray-700';
    default:
      return 'border border-gray-200 bg-gray-100 text-gray-600';
  }
}
