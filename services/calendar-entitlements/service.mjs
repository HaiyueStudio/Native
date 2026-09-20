import { createHash, createSign } from 'node:crypto';

export const PRODUCT = 'calendar_puzzle_full_unlock';
export const PACKAGE = 'org.haiyue.games.calendarpuzzle';
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
export function signLease(value, privateKey) {
  const payload = b64(value);
  return `${payload}.${createSign('RSA-SHA256').update(payload).sign(privateKey).toString('base64url')}`;
}
export function createVerifier({ publisher, privateKey, now = () => Math.floor(Date.now() / 1000), lifetime = 7 * 86400 }) {
  if (!privateKey || lifetime <= 0 || lifetime > 7 * 86400) throw new Error('Invalid signing configuration');
  const inFlight = new Map();
  async function inspect(token) {
    const purchase = await publisher.get(token);
    const items = purchase.productLineItem ?? [];
    const item = items.find(item => item.productId === PRODUCT);
    if (items.length !== 1 || !item) throw new Error('Product mismatch');
    const offer = item.productOfferDetails ?? {};
    const state = purchase.purchaseStateContext?.purchaseState;
    if (!['PURCHASED', 'PENDING', 'CANCELLED'].includes(state)) throw new Error('Unknown purchase state');
    const revoked = state === 'CANCELLED' || offer.refundableQuantity === 0;
    const owned = state === 'PURCHASED' && !revoked;
    if (owned) {
      if (offer.rentOfferDetails || offer.quantity !== 1 || offer.refundableQuantity !== 1
        || offer.consumptionState !== 'CONSUMPTION_STATE_YET_TO_BE_CONSUMED') throw new Error('Not a non-consumable purchase');
      if (purchase.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING') {
        await publisher.acknowledge(token);
      } else if (purchase.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') throw new Error('Unknown acknowledgement state');
    }
    return { owned, pending: state === 'PENDING', revoked };
  }
  return async input => {
    if (input?.productId !== PRODUCT || typeof input.purchaseToken !== 'string' || input.purchaseToken.length < 8
      || input.purchaseToken.length > 8192 || typeof input.installationId !== 'string'
      || !/^[a-zA-Z0-9-]{16,80}$/.test(input.installationId)) throw new TypeError('Invalid request');
    const token = input.purchaseToken;
    let check = inFlight.get(token);
    if (!check) {
      check = inspect(token).finally(() => inFlight.delete(token));
      inFlight.set(token, check);
    }
    const rights = await check;
    const issuedAt = now();
    return { lease: signLease({ ...rights, productId: PRODUCT, packageName: PACKAGE,
      installationId: input.installationId, tokenHash: createHash('sha256').update(token).digest('hex'),
      issuedAt, expiresAt: issuedAt + lifetime }, privateKey) };
  };
}

// Service-account credentials stay on the server. Access tokens are never returned to the app.
export function createPublisher(credentials, fetcher = fetch) {
  let accessToken = '', expiresAt = 0, refreshing;
  async function authorization() {
    if (accessToken && Date.now() < expiresAt) return accessToken;
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const iat = Math.floor(Date.now() / 1000);
      const head = b64({ alg: 'RS256', typ: 'JWT' });
      const body = b64({ iss: credentials.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher',
        aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 });
      const unsigned = `${head}.${body}`;
      const assertion = `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(credentials.private_key).toString('base64url')}`;
      const response = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }), signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('Google authentication unavailable');
      const data = await response.json();
      if (typeof data.access_token !== 'string') throw new Error('Missing access token');
      accessToken = data.access_token; expiresAt = Date.now() + (Number(data.expires_in) - 60) * 1000;
      return accessToken;
    })().finally(() => { refreshing = undefined; });
    return refreshing;
  }
  async function request(path, method = 'GET') {
    const response = await fetcher(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}/${path}`, {
      method, headers: { authorization: `Bearer ${await authorization()}`, 'content-type': 'application/json' },
      ...(method === 'POST' ? { body: '{}' } : {}), signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      if (response.status === 401) { accessToken = ''; expiresAt = 0; }
      const error = new Error('Google purchase verification unavailable');
      error.status = response.status;
      throw error;
    }
    return method === 'POST' || response.status === 204 ? {} : response.json();
  }
  return {
    get: token => request(`purchases/productsv2/tokens/${encodeURIComponent(token)}`),
    acknowledge: async token => {
      try { await request(`purchases/products/${PRODUCT}/tokens/${encodeURIComponent(token)}:acknowledge`, 'POST'); }
      catch (error) {
        // Another instance can acknowledge between GET and POST. Re-read the authoritative state.
        if (![400, 409].includes(error.status)) throw error;
        const purchase = await request(`purchases/productsv2/tokens/${encodeURIComponent(token)}`);
        if (purchase.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'
          || purchase.purchaseStateContext?.purchaseState !== 'PURCHASED') throw error;
      }
    },
  };
}
