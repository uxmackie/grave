import test from 'node:test';
import assert from 'node:assert/strict';
import {applySecurityHeaders} from '../lib/security-headers.ts';

test('security headers apply to every dynamic response', async () => {
  const response = applySecurityHeaders(
    new Response('ok', {headers:{'Content-Type':'text/plain'}}),
    'http://localhost:5173/api/health',
  );
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(response.headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.match(response.headers.get('permissions-policy') ?? '', /camera=\(\)/);
  assert.equal(response.headers.get('strict-transport-security'), null);
  assert.equal(await response.text(), 'ok');
});

test('HSTS is only sent over public HTTPS', () => {
  const secure = applySecurityHeaders(new Response('ok'), 'https://docs.example.com/');
  assert.equal(secure.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
  const local = applySecurityHeaders(new Response('ok'), 'https://localhost:5173/');
  assert.equal(local.headers.get('strict-transport-security'), null);
  const http = applySecurityHeaders(new Response('ok'), 'http://docs.example.com/');
  assert.equal(http.headers.get('strict-transport-security'), null);
});

test('CSP is report-only, production-only, and limited to HTML', () => {
  const html = applySecurityHeaders(
    new Response('<main>Grave</main>', {headers:{'Content-Type':'text/html; charset=utf-8'}}),
    'https://docs.example.com/',
    true,
  );
  const policy = html.headers.get('content-security-policy-report-only') ?? '';
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.equal(html.headers.get('content-security-policy'), null);

  const api = applySecurityHeaders(
    new Response('{}', {headers:{'Content-Type':'application/json'}}),
    'https://docs.example.com/api/health',
    true,
  );
  assert.equal(api.headers.get('content-security-policy-report-only'), null);

  const development = applySecurityHeaders(
    new Response('<main>Grave</main>', {headers:{'Content-Type':'text/html'}}),
    'http://localhost:5173/',
    false,
  );
  assert.equal(development.headers.get('content-security-policy-report-only'), null);
});

test('header rewriting preserves status and empty responses', () => {
  const empty = applySecurityHeaders(new Response(null, {status:204}), 'https://docs.example.com/');
  assert.equal(empty.status, 204);
  assert.equal(empty.body, null);
  assert.equal(empty.headers.get('x-content-type-options'), 'nosniff');
});
