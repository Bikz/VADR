/**
 * Call Enrichment Service
 * 
 * Enriches call data after completion using Captain API to fill missing fields
 * in Call.extractedData (hours, insurance accepted, SKUs, price ranges).
 */

import type { Call } from '@/types';
import { getCaptainClient } from './captain';

interface EnrichmentResult {
  hours?: string;
  insuranceAccepted?: string;
  skus?: string;
  priceRange?: string;
  notes?: string;
  // Keep existing fields
  price?: string;
  availability?: string;
}

/**
 * Enrich a completed call with additional business data from Captain
 */
export async function enrichCallData(call: Call): Promise<EnrichmentResult | null> {
  // Only enrich if call is completed
  if (call.state !== 'completed') {
    return null;
  }

  const client = getCaptainClient();
  if (!client) {
    console.log('[call-enrichment] Captain client not available, skipping enrichment');
    return null;
  }

  // Check if we already have all the data we need
  const existingData = call.extractedData;
  const hasAllFields = existingData?.hours && existingData?.insuranceAccepted && 
                       existingData?.skus && existingData?.priceRange;
  
  if (hasAllFields) {
    console.log('[call-enrichment] Call already has all enrichment fields, skipping', {
      callId: call.id,
      leadName: call.lead.name,
    });
    return null;
  }

  try {
    // Build transcript text for context
    const transcriptText = call.transcript
      .map(turn => `${turn.speaker === 'ai' ? 'AI' : 'Customer'}: ${turn.text}`)
      .join('\n');

    console.log('[call-enrichment] Starting enrichment', {
      callId: call.id,
      leadName: call.lead.name,
      hasTranscript: transcriptText.length > 0,
    });

    // Query Captain for business information
    const enrichment = await client.enrichBusinessInfo(
      call.lead.name,
      call.lead.address,
      transcriptText
    );

    // Merge with existing extractedData
    const merged: EnrichmentResult = {
      ...existingData,
      ...enrichment,
    };

    // If we got new data, log it
    const hasNewData = Boolean(enrichment.hours || enrichment.insuranceAccepted || 
                               enrichment.skus || enrichment.priceRange);
    
    if (hasNewData) {
      console.log('[call-enrichment] Enrichment successful', {
        callId: call.id,
        leadName: call.lead.name,
        enrichedFields: Object.keys(enrichment).filter(k => enrichment[k as keyof typeof enrichment]),
      });
    } else {
      console.log('[call-enrichment] No new data found', {
        callId: call.id,
        leadName: call.lead.name,
      });
    }

    return merged;
  } catch (error) {
    console.error('[call-enrichment] Enrichment failed', {
      callId: call.id,
      leadName: call.lead.name,
      error: error instanceof Error ? error.message : String(error),
    });
    // Return existing data on error, don't throw
    return existingData || null;
  }
}

/**
 * Determine which fields are missing from extractedData
 */
export function getMissingFields(extractedData?: Call['extractedData']): string[] {
  if (!extractedData) {
    return ['hours', 'insuranceAccepted', 'skus', 'priceRange', 'price', 'availability'];
  }

  const missing: string[] = [];
  if (!extractedData.hours) missing.push('hours');
  if (!extractedData.insuranceAccepted) missing.push('insuranceAccepted');
  if (!extractedData.skus) missing.push('skus');
  if (!extractedData.priceRange && !extractedData.price) missing.push('priceRange');
  if (!extractedData.availability) missing.push('availability');

  return missing;
}
