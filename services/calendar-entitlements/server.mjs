import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createVerifier, createPublisher } from './service.mjs';

const credentials = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
const privateKey = readFileSync(process.env.ENTITLEMENT_PRIVATE_KEY_FILE, 'utf8');
const verify = createVerifier({ publisher: createPublisher(credentials), privateKey });
// Run behind an HTTPS proxy with request/rate limits. Never log purchase tokens or signed leases.
createServer(async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST' || req.url !== '/v1/google/verify') { res.writeHead(404).end('{}'); return; }
  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body) > 16384) { res.writeHead(413).end('{}'); return; }
    }
    let input;
    try { input = JSON.parse(body); } catch { throw new TypeError('Invalid JSON'); }
    const result = await verify(input);
    res.end(JSON.stringify(result));
  } catch (error) {
    res.writeHead(error instanceof TypeError ? 400 : 503).end(JSON.stringify({ error: 'verification_unavailable' }));
  }
}).listen(Number(process.env.PORT ?? 8080), process.env.HOST ?? '127.0.0.1');
