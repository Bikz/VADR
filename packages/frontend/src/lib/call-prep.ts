import type { CallPrep, Lead } from '@vadr/shared';

function formatSampleLead(leads: Lead[]): string {
  if (!leads.length) {
    return 'the selected businesses';
  }

  const [first, second] = leads;
  if (!second) {
    return first.name;
  }

  return `${first.name} and ${second.name}`;
}

export function buildCallPrep(query: string, leads: Lead[]): CallPrep {
  const descriptionSample = leads[0]?.description ?? '';
  const bestRating = leads
    .map((lead) => lead.rating)
    .filter((rating) => typeof rating === 'number' && Number.isFinite(rating))
    .sort((a, b) => b - a)[0];

  const variables: Record<string, string> = {
    research_query: query,
    primary_targets: formatSampleLead(leads),
  };

  if (bestRating && bestRating > 0) {
    variables.top_rating = `${bestRating.toFixed(1)}/5`;
  }

  if (descriptionSample) {
    variables.sample_description = descriptionSample.slice(0, 180);
  }

  return {
    objective: `Speak with businesses that match "${query}" to capture availability, pricing, and follow-up actions.`,
    script: `1. Greet the contact politely and confirm you are speaking to the right business.
2. Explain that you're researching "${query}" and want to understand availability, pricing, and differentiators.
3. Ask about same-day or near-term availability and capture any scheduling constraints.
4. Confirm pricing or packages, noting any promotions or special requirements.
5. Capture notes about the experience or key differentiators.
6. Thank them for their time and outline next steps or follow-up.`,
    variables,
    redFlags: [
      'No phone contact possible',
      'Contact refuses to share availability or pricing',
      'Business is permanently closed or number disconnected',
    ],
    disallowedTopics: [
      'Making contractual promises on behalf of the customer',
      'Collecting payment information or deposits',
      'Sharing personal or sensitive customer details',
    ],
  };
}
