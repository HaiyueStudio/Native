import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { createVerifier, createPublisher, PRODUCT, PACKAGE } from '../service.mjs';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const request = { productId: PRODUCT, purchaseToken: 'test-token-one', installationId: '12345678-1234-1234-1234-123456789abc' };
function fixture() {
  const f = { acks: 0, reads: 0, data: { purchaseStateContext: { purchaseState: 'PURCHASED' }, acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING', productLineItem: [{ productId: PRODUCT, productOfferDetails: { quantity: 1, refundableQuantity: 1, consumptionState: 'CONSUMPTION_STATE_YET_TO_BE_CONSUMED' } }] } };
  f.publisher = { get: async () => { f.reads++; return f.data; }, acknowledge: async () => { f.acks++; f.data.acknowledgementState = 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'; } };
  f.verify = createVerifier({ publisher: f.publisher, privateKey, now: () => 1000 });
  return f;
}
function decode({ lease }) {
  const [payload, signature] = lease.split('.');
  assert.equal(createVerify('RSA-SHA256').update(payload).verify(publicKey, Buffer.from(signature, 'base64url')), true);
  return JSON.parse(Buffer.from(payload, 'base64url'));
}
test('verified non-consumable acknowledged before signed ownership; duplicates coalesce', async () => {
  const f = fixture(); const results = await Promise.all(Array.from({ length: 20 }, () => f.verify(request)));
  assert.equal(f.reads, 1); assert.equal(f.acks, 1);
  const value = decode(results[0]); assert.equal(value.owned, true); assert.equal(value.packageName, PACKAGE);
  assert.equal(value.productId, PRODUCT); assert.equal(value.installationId, request.installationId);
  assert.equal(value.expiresAt - value.issuedAt, 7 * 86400);
  await f.verify(request); assert.equal(f.acks, 1);
  const [payload, signature] = results[0].lease.split('.');
  assert.equal(createVerify('RSA-SHA256').update(payload + 'x').verify(publicKey, Buffer.from(signature, 'base64url')), false);
});
test('pending, cancelled and refunded tokens never acknowledge or unlock', async () => {
  for (const state of ['PENDING', 'CANCELLED', 'refunded']) {
    const f = fixture(); if (state === 'refunded') f.data.productLineItem[0].productOfferDetails.refundableQuantity = 0;
    else f.data.purchaseStateContext.purchaseState = state;
    const rights = decode(await f.verify(request)); assert.equal(rights.owned, false); assert.equal(f.acks, 0);
    assert.equal(rights.pending, state === 'PENDING'); assert.equal(rights.revoked, state !== 'PENDING');
  }
});
test('mismatched products, consumed/rental products and malformed input fail closed', async () => {
  for (const mutate of [f => f.data.productLineItem[0].productId = 'other', f => f.data.productLineItem[0].productOfferDetails.rentOfferDetails = {}, f => f.data.productLineItem[0].productOfferDetails.consumptionState = 'CONSUMPTION_STATE_CONSUMED', f => f.data.purchaseStateContext.purchaseState = 'UNKNOWN']) {
    const f = fixture(); mutate(f); await assert.rejects(f.verify(request)); assert.equal(f.acks, 0);
  }
  await assert.rejects(fixture().verify({ ...request, productId: 'other' }));
  await assert.rejects(fixture().verify({ ...request, installationId: '../x' }));
});
test('ack failure issues no grant, and retry can succeed', async () => {
  const f = fixture(); const ack = f.publisher.acknowledge;
  f.publisher.acknowledge = async () => { throw Error('offline'); };
  await assert.rejects(f.verify(request)); f.publisher.acknowledge = ack;
  assert.equal(decode(await f.verify(request)).owned, true);
});
test('publisher uses Google verification and acknowledgement endpoints, never consumption', async () => {
  const calls = [];
  const credentials = { client_email: 'unit@example.invalid', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const fetcher = async (url, options) => { calls.push({ url, options }); return { ok: true, status: 200, json: async () => { if (url.endsWith(':acknowledge')) throw Error('empty acknowledgement body'); return url.includes('oauth2') ? { access_token: 'unit-access', expires_in: 3600 } : {}; } }; };
  const publisher = createPublisher(credentials, fetcher);
  await publisher.get('token/one'); await publisher.acknowledge('token/one');
  assert.equal(calls.length, 3);
  assert.ok(calls[1].url.endsWith('/purchases/productsv2/tokens/token%2Fone'));
  assert.ok(calls[2].url.endsWith(`/purchases/products/${PRODUCT}/tokens/token%2Fone:acknowledge`));
  assert.equal(calls[2].options.method, 'POST'); assert.equal(calls[1].options.headers.authorization, 'Bearer unit-access');
});
