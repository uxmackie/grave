'use client';

/* A full document navigation is intentional here: this component can replace
   the root layout in the global error boundary, where the app router is gone. */
/* eslint-disable @next/next/no-html-link-for-pages */

import {useEffect} from 'react';
import {reportClientError} from '@/lib/client-errors';

export function ErrorView({
  error,
  reset,
}: {
  error: Error & {digest?: string};
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, 'react-error-boundary');
  }, [error]);

  return (
    <main className="empty-state fatal-page" id="main">
      <div aria-hidden="true">
        <img className="standalone-logo logo-light" src="/brand/wordmark-light.png" alt="" />
        <img className="standalone-logo logo-dark" src="/brand/wordmark-dark.png" alt="" />
      </div>
      <p className="eyebrow">Something went wrong</p>
      <h1>This page couldn&apos;t load.</h1>
      <p>The error was logged. Try again, or head back to the documentation.</p>
      <div>
        <button className="button primary" type="button" onClick={reset}>
          Try again
        </button>
        <a className="button" href="/">
          Go to documentation
        </a>
      </div>
      {error.digest ? <p className="muted">Reference: {error.digest}</p> : null}
    </main>
  );
}
