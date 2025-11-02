import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    replaysSessionSampleRate: Number.parseFloat(process.env.SENTRY_REPLAYS_SESSION_SAMPLE_RATE ?? '0'),
    replaysOnErrorSampleRate: Number.parseFloat(process.env.SENTRY_REPLAYS_ERROR_SAMPLE_RATE ?? '0'),
  });
}

