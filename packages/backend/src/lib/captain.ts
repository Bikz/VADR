/**
 * Captain API Client
 * 
 * Integration with Captain (YC F25) for business data enrichment.
 * Used for after-call enrichment to fill missing fields in Call.extractedData.
 */

interface CaptainQueryResponse {
  status: string;
  response: string;
  relevant_files?: Array<{
    file_name: string;
    relevancy_score: number;
    file_type: string;
    file_id: string;
  }>;
  query: string;
  database_name: string;
  processing_metrics?: {
    total_files_processed: number;
    total_tokens: number;
    execution_time_ms: number;
  };
}

interface CaptainQueryOptions {
  query: string;
  databaseName?: string;
  includeFiles?: boolean;
}

export class CaptainClient {
  private baseUrl = 'https://api.runcaptain.com';
  private apiKey: string;
  private organizationId: string;

  constructor(apiKey: string, organizationId: string) {
    this.apiKey = apiKey;
    this.organizationId = organizationId;
  }

  /**
   * Query Captain database using natural language
   */
  async query(options: CaptainQueryOptions): Promise<CaptainQueryResponse> {
    const { query, databaseName = 'business_data', includeFiles = false } = options;

    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Organization-ID': this.organizationId,
    };

    // URL encode the query parameter properly
    const params = new URLSearchParams();
    params.append('query', query);
    params.append('database_name', databaseName);
    params.append('include_files', includeFiles.toString());

    const response = await fetch(`${this.baseUrl}/v1/query`, {
      method: 'POST',
      headers,
      body: params.toString(),
      signal: AbortSignal.timeout(120000), // 120 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Captain API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<CaptainQueryResponse>;
  }

  /**
   * Enrich business information by querying Captain
   * Returns structured data that can fill missing fields in extractedData
   */
  async enrichBusinessInfo(
    businessName: string,
    businessAddress?: string,
    transcript?: string
  ): Promise<{
    hours?: string;
    insuranceAccepted?: string;
    skus?: string;
    priceRange?: string;
    notes?: string;
  }> {
    // Build a comprehensive query to find missing business information
    const queryParts = [
      `Find information about ${businessName}`,
    ];

    if (businessAddress) {
      queryParts.push(`located at ${businessAddress}`);
    }

    queryParts.push(
      'Specifically, I need:',
      '- Business hours or operating hours',
      '- Insurance accepted (if applicable)',
      '- Product SKUs or service codes (if applicable)',
      '- Price ranges for services or products'
    );

    if (transcript) {
      queryParts.push(
        '\nDuring a recent call, the following was discussed:',
        transcript.slice(0, 500) // Limit transcript context to avoid token limits
      );
    }

    const query = queryParts.join('\n');

    try {
      const response = await this.query({
        query,
        includeFiles: false,
      });

      // Parse the response to extract structured information
      return this.parseEnrichmentResponse(response.response, businessName);
    } catch (error) {
      console.error('[captain] Failed to enrich business info', {
        businessName,
        error: error instanceof Error ? error.message : String(error),
      });
      // Return empty object on error - don't throw, just log
      return {};
    }
  }

  /**
   * Parse Captain's natural language response into structured data
   */
  private parseEnrichmentResponse(response: string, businessName: string): {
    hours?: string;
    insuranceAccepted?: string;
    skus?: string;
    priceRange?: string;
    notes?: string;
  } {
    const result: {
      hours?: string;
      insuranceAccepted?: string;
      skus?: string;
      priceRange?: string;
      notes?: string;
    } = {};

    const lowerResponse = response.toLowerCase();

    // Extract hours
    const hoursPatterns = [
      /(?:hours?|open|operating|business hours?)[\s:]+([^\n]+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)[^\n]+)/i,
      /(?:hours?)[\s:]+([^\n]{0,200})/i,
      /open[\s:]+([^\n]+)/i,
    ];
    for (const pattern of hoursPatterns) {
      const match = response.match(pattern);
      if (match && match[1]) {
        result.hours = match[1].trim();
        break;
      }
    }

    // Extract insurance
    if (lowerResponse.includes('insurance')) {
      const insurancePatterns = [
        /(?:insurance|accepts insurance|takes insurance)[\s:]+([^\n]+)/i,
        /(?:medicare|medicaid|blue cross|aetna|unitedhealthcare|cigna)(?:\s+accepted)?/i,
      ];
      for (const pattern of insurancePatterns) {
        const match = response.match(pattern);
        if (match) {
          result.insuranceAccepted = match[1]?.trim() || match[0].trim();
          break;
        }
      }
      if (!result.insuranceAccepted) {
        // If insurance is mentioned but no specific info, note it
        result.insuranceAccepted = 'Insurance information available - see notes';
      }
    }

    // Extract SKUs
    const skuPatterns = [
      /(?:sku|product code|service code|item number)[\s:]+([^\n]+)/i,
      /sku[s]?:?\s*([A-Z0-9-]+)/i,
    ];
    for (const pattern of skuPatterns) {
      const match = response.match(pattern);
      if (match && match[1]) {
        result.skus = match[1].trim();
        break;
      }
    }

    // Extract price range
    const pricePatterns = [
      /\$[\d,]+(?:\s*-\s*\$?[\d,]+)?/g,
      /(?:price|cost|fee)[\s:]+([^\n]*\$[^\n]+)/i,
      /(?:ranges?|prices?)\s+(?:from|start|at)\s+\$?[\d,]+/i,
    ];
    for (const pattern of pricePatterns) {
      const matches = response.match(pattern);
      if (matches) {
        result.priceRange = Array.isArray(matches) ? matches.join(', ') : matches[0];
        break;
      }
    }

    // Store the full response as notes if we got valuable info
    if (response.length > 50 && (result.hours || result.insuranceAccepted || result.skus || result.priceRange)) {
      result.notes = `Enriched via Captain API: ${response.slice(0, 300)}${response.length > 300 ? '...' : ''}`;
    }

    return result;
  }
}

/**
 * Get Captain client instance from environment variables
 */
export function getCaptainClient(): CaptainClient | null {
  // Use dynamic import to avoid potential circular dependencies
  let apiKey: string | undefined;
  let organizationId: string | undefined;
  
  try {
    const env = require('./env').env;
    apiKey = env.captainApiKey();
    organizationId = env.captainOrganizationId();
  } catch (error) {
    console.warn('[captain] Failed to load env config', error);
    return null;
  }

  if (!apiKey || !organizationId) {
    console.warn('[captain] Captain API credentials not configured. Skipping enrichment.');
    return null;
  }

  return new CaptainClient(apiKey, organizationId);
}
