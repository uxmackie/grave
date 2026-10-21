import type {Metadata} from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page not found — Grave',
};

export default function NotFound() {
  return (
    <main className="empty-state" id="main">
      <p className="eyebrow">404</p>
      <h1>Page not found.</h1>
      <p>The page may have moved, or the link may be out of date.</p>
      <Link className="button primary" href="/">
        Go to documentation
      </Link>
    </main>
  );
}
