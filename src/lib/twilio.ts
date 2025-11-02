import type { Twilio } from 'twilio';
import twilio from 'twilio';
import { assertEnv, env } from './env';

let cachedClient: Twilio | null = null;

export function getTwilioClient(): Twilio {
  if (!cachedClient) {
    assertEnv();
    const accountSid = env.twilioAccountSid();
    const authToken = env.twilioAuthToken();

    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials are not configured.');
    }

    cachedClient = twilio(accountSid, authToken);
  }

  return cachedClient;
}

export const VoiceResponse = twilio.twiml.VoiceResponse;

