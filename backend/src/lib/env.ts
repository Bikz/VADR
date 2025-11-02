const cache = new Map<string, string | undefined>();

function readEnv(key: string, required = true): string | undefined {
  if (cache.has(key)) {
    return cache.get(key);
  }

  const value = process.env[key];
  cache.set(key, value);

  if (!value && required) {
    console.warn(`Missing expected environment variable "${key}".`);
  }

  return value;
}

export const env = {
  twilioAccountSid: () => readEnv('TWILIO_ACCOUNT_SID'),
  twilioAuthToken: () => readEnv('TWILIO_AUTH_TOKEN'),
  twilioPhoneNumber: () => readEnv('TWILIO_PHONE_NUMBER'),
  publicBaseUrl: () => readEnv('PUBLIC_BASE_URL', false) ?? readEnv('NEXT_PUBLIC_BASE_URL', false),
  openAiApiKey: () => readEnv('OPENAI_API_KEY'),
  openAiModel: () => readEnv('VOICE_AGENT_MODEL', false) ?? 'gpt-4o-mini',
  twilioVoiceName: () => readEnv('TWILIO_VOICE_NAME', false) ?? 'Polly.Joanna',
  captainApiKey: () => readEnv('CAPTAIN_API_KEY', false),
  captainOrganizationId: () => readEnv('CAPTAIN_ORGANIZATION_ID', false),
};

export function assertEnv() {
  const required: Array<[string, () => string | undefined]> = [
    ['TWILIO_ACCOUNT_SID', env.twilioAccountSid],
    ['TWILIO_AUTH_TOKEN', env.twilioAuthToken],
    ['TWILIO_PHONE_NUMBER', env.twilioPhoneNumber],
    ['OPENAI_API_KEY', env.openAiApiKey],
  ];

  const missing = required
    .map(([key, getter]) => (!getter() ? key : undefined))
    .filter((value): value is string => Boolean(value));

  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
}

function normalizeBaseUrl(url: string | undefined | null) {
  if (!url) return undefined;

  const trimmed = url.trim();
  if (!trimmed) return undefined;

  const withProtocol = /^(https?:)?\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/$/, '');
}

export function resolvePublicBaseUrl() {
  const explicit = normalizeBaseUrl(env.publicBaseUrl());
  if (explicit) return explicit;

  const railwayPublicDomain = normalizeBaseUrl(process.env.RAILWAY_PUBLIC_DOMAIN);
  if (railwayPublicDomain) return railwayPublicDomain;

  const railwayStaticUrl = normalizeBaseUrl(process.env.RAILWAY_STATIC_URL);
  if (railwayStaticUrl) return railwayStaticUrl;

  const railwayUrl = normalizeBaseUrl(process.env.RAILWAY_URL);
  if (railwayUrl) return railwayUrl;

  const vercelUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_VERCEL_URL);
  if (vercelUrl) return vercelUrl;

  const fallbackPort = Number.parseInt(process.env.PORT ?? '', 10) || 3001;
  return `http://localhost:${fallbackPort}`;
}

