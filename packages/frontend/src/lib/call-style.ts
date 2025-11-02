import type { CallState, Sentiment } from '@vadr/shared';

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
      return 'border border-red-300 bg-red-50 text-red-700';
    default:
      return 'border border-gray-200 bg-gray-100 text-gray-500';
  }
}

export function getSentimentColor(sentiment: Sentiment): string {
  switch (sentiment) {
    case 'positive':
      return 'border border-gray-900 bg-gray-900 text-white';
    case 'negative':
      return 'border border-red-300 bg-red-50 text-red-700';
    default:
      return 'border border-gray-200 bg-gray-100 text-gray-600';
  }
}
