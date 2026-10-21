import {env} from 'cloudflare:workers';
import {db,handle,json} from '@/lib/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => {
    const started = Date.now();
    try {
      const row = await db().prepare('SELECT 1 AS ok').first<{ok:number}>();
      const healthy = row?.ok === 1;
      return json({
        status: healthy ? 'ok' : 'degraded',
        service: 'grave',
        version: (env as unknown as Record<string,string|undefined>).GRAVE_COMMIT ?? null,
        database: healthy ? 'ok' : 'error',
        latencyMs: Date.now() - started,
        timestamp: new Date().toISOString(),
      }, healthy ? 200 : 503);
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        event: 'health_check_failed',
        message: error instanceof Error ? error.message : String(error),
      }));
      return json({
        status: 'degraded',
        service: 'grave',
        database: 'error',
        latencyMs: Date.now() - started,
        timestamp: new Date().toISOString(),
      }, 503);
    }
  });
}
