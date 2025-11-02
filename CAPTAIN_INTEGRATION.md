# Captain API Integration for After-Call Enrichment

## Overview

VADR now includes integration with Captain (YC F25) for automatic enrichment of call data after completion. This feature fills missing fields in `Call.extractedData` by querying Captain's indexed business data.

## How It Works

1. **After Call Completion**: When a call reaches the `completed` state, an automatic enrichment process is triggered
2. **Captain Query**: The system queries Captain using:
   - Business name
   - Business address (if available)
   - Call transcript (for context)
3. **Data Extraction**: Captain's response is parsed to extract:
   - Business hours
   - Insurance accepted
   - SKUs/product codes
   - Price ranges
4. **Data Merge**: Extracted data is merged with existing `extractedData` and saved to the database

## Setup

### 1. Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Captain API Configuration
CAPTAIN_API_KEY=cap_dev_ntWWrmra24fjcsBgTrtyCeFbZqiEXzBL
CAPTAIN_ORGANIZATION_ID=armaanb7@ucla.edu
```

**Note**: Your organization ID (`armaanb7@ucla.edu`) is configured. If you encounter authentication errors, verify this matches your Captain account identifier.

### 2. Captain Database Setup

Before enrichment can work, you need to index business data into Captain:

1. **Create a Database**: Use Captain's API to create a database (e.g., `business_data`)
2. **Index Sources**: Index your business data sources:
   - Public business directories (Google Places, Yelp, etc.)
   - Connected sources (S3 buckets, GCS buckets)
   - Business websites
   - Product catalogs

Example indexing workflow:
```typescript
// Index S3 bucket
POST /v1/index-s3
{
  database_name: 'business_data',
  bucket_name: 'my-business-docs',
  aws_access_key_id: '...',
  aws_secret_access_key: '...',
  bucket_region: 'us-east-1'
}
```

### 3. Database Migration

Run the Prisma migration to add the `extractedData` field:

```bash
cd backend
bunx prisma migrate dev --name add_extracted_data
```

## Configuration

### Database Name

By default, the integration queries a database named `business_data`. To use a different database, modify the `enrichBusinessInfo` method in `backend/src/lib/captain.ts`:

```typescript
const response = await this.query({
  query,
  databaseName: 'your_database_name', // Change this
  includeFiles: false,
});
```

### Enrichment Fields

The system enriches the following fields in `Call.extractedData`:

- `hours`: Business operating hours
- `insuranceAccepted`: Insurance information
- `skus`: Product/service SKUs
- `priceRange`: Price range information
- `price`: Individual price (existing)
- `availability`: Availability information (existing)
- `notes`: Additional notes (existing)

## API Reference

### Captain Client

Located in `backend/src/lib/captain.ts`:

```typescript
const client = getCaptainClient();
if (client) {
  const enrichment = await client.enrichBusinessInfo(
    businessName,
    businessAddress,
    transcriptText
  );
}
```

### Enrichment Service

Located in `backend/src/lib/call-enrichment.ts`:

```typescript
import { enrichCallData } from '@/lib/call-enrichment';

const enriched = await enrichCallData(call);
```

## How It Works Internally

1. **Call Completion Hook**: When a call completes (`handleStatus` or `endCall`), `enrichCompletedCall` is called
2. **Background Processing**: Enrichment runs asynchronously using `setImmediate` to avoid blocking call completion
3. **Data Query**: Captain is queried with a natural language query built from:
   - Business name
   - Address (if available)
   - Call transcript (first 500 chars for context)
4. **Response Parsing**: Captain's response is parsed using regex patterns to extract structured data
5. **Database Update**: Extracted data is merged with existing `extractedData` and saved via `updateCallState`

## Response Parsing

The system uses pattern matching to extract structured data from Captain's natural language responses:

- **Hours**: Matches patterns like "hours: Monday-Friday 9am-5pm"
- **Insurance**: Detects mentions of insurance, Medicare, Medicaid, etc.
- **SKUs**: Finds SKU/product code patterns
- **Price Range**: Extracts dollar amounts and price ranges

## Error Handling

- Enrichment failures are logged but do not block call completion
- If Captain API is unavailable, enrichment is silently skipped
- Missing environment variables result in a warning and skipped enrichment

## Testing

To test the integration:

1. Complete a call through the normal flow
2. Check the console logs for enrichment messages
3. Query the database to verify `extractedData` is populated:

```typescript
const call = await prisma.call.findUnique({
  where: { id: callId },
  select: { extractedData: true }
});
```

## Troubleshooting

### Enrichment Not Running

1. Check environment variables are set correctly
2. Verify Captain API key has access to the database
3. Check console logs for warnings/errors

### No Data Extracted

1. Verify your Captain database has indexed business data
2. Check that business names match between your leads and indexed data
3. Review Captain query response in logs (if enabled)

### Organization ID Missing

The organization ID is required but not provided in the API key. You'll need to:
1. Check your Captain dashboard
2. Contact Captain support
3. Or extract it from a successful API call

## Future Enhancements

Potential improvements:
- Support for multiple Captain databases (dev/staging/prod)
- More sophisticated parsing using LLM extraction
- Caching of enrichment results
- Batch enrichment for multiple calls
- Configurable field mapping

## Related Files

- `backend/src/lib/captain.ts` - Captain API client
- `backend/src/lib/call-enrichment.ts` - Enrichment service
- `backend/src/server/services/call-service.ts` - Call completion hooks
- `backend/src/server/store/prisma-call-store.ts` - Database persistence
- `packages/shared/src/types.ts` - TypeScript types

