import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';
import app from '../src/app.js';

function request(port, { method = 'GET', path = '/health', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('Express CORS allows the configured origin, rejects others, and handles preflight and no Origin', async (t) => {
  const previousOrigin = process.env.CORS_ORIGIN;
  process.env.CORS_ORIGIN = 'http://localhost:4200';

  const server = app.listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (previousOrigin === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = previousOrigin;
  });

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const { port } = server.address();

  const allowed = await request(port, { headers: { Origin: 'http://localhost:4200' } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:4200');
  assert.deepEqual(JSON.parse(allowed.body), { status: 'ok' });

  const rejected = await request(port, { headers: { Origin: 'https://example.com' } });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers['access-control-allow-origin'], undefined);
  assert.deepEqual(JSON.parse(rejected.body), {
    error: { code: 'ORIGIN_NOT_ALLOWED', message: 'El origen de la solicitud no está permitido.' },
  });

  const preflight = await request(port, {
    method: 'OPTIONS',
    path: '/api/products',
    headers: {
      Origin: 'http://localhost:4200',
      'Access-Control-Request-Method': 'PATCH',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers['access-control-allow-origin'], 'http://localhost:4200');
  assert.equal(preflight.headers['access-control-allow-methods'], 'GET, POST, PATCH, DELETE, OPTIONS');
  assert.equal(preflight.headers['access-control-allow-headers'], 'Content-Type');

  const withoutOrigin = await request(port);
  assert.equal(withoutOrigin.status, 200);
  assert.equal(withoutOrigin.headers['access-control-allow-origin'], undefined);
});
