import {handle,json,sameOrigin} from '@/lib/server';

export const dynamic = 'force-dynamic';

const MAX_BODY = 8192;

export async function POST(req:Request) {
  return handle(async () => {
    if (!sameOrigin(req)) return json({error:'Invalid request origin.'},403);
    if (!(req.headers.get('content-type') || '').includes('application/json')) {
      return json({error:'Expected a JSON error report.'},415);
    }

    const raw = await req.text();
    if (raw.length > MAX_BODY) return json({error:'Error report is too large.'},413);

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({error:'Invalid JSON.'},400);
    }

    const record = body && typeof body === 'object' ? body as Record<string,unknown> : {};
    const text = (key:string, max:number) => {
      const value = record[key];
      return typeof value === 'string' ? value.slice(0, max) : undefined;
    };
    const message = text('message', 1000);
    if (!message) return json({error:'A message is required.'},400);

    console.error(JSON.stringify({
      level: 'error',
      event: 'client_error',
      message,
      stack: text('stack', 6000),
      url: text('url', 2000),
      context: text('context', 120),
      userAgent: req.headers.get('user-agent')?.slice(0, 300),
    }));

    return new Response(null, {status:204, headers:{'Cache-Control':'no-store'}});
  });
}
