'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-gray-300">
            Our team has been notified. You can try the action again or refresh the page.
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-200"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="rounded-full border border-gray-500 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
            >
              Reload
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && error?.digest && (
            <p className="text-xs text-gray-500">Error digest: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
