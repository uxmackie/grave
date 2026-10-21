'use client';

import './globals.css';
import {ErrorView} from '@/components/error-view';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & {digest?: string};
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ErrorView error={error} reset={reset} />
      </body>
    </html>
  );
}
