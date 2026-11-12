import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { createHandlers } from './index';
import { BUSINESS_STORAGE_KEY, DemoRepository, type StoragePort } from '../repository/demoRepository';

const values = new Map<string, string>();
let writeFails = false;
const storage: StoragePort = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (writeFails) throw new Error('Quota'); values.set(key, value); }, removeItem: key => { values.delete(key); } };
const repository = new DemoRepository(storage);
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => { writeFails = false; values.clear(); repository.reset(); server.resetHandlers(...createHandlers(repository, { latencyMs: 0 })); });
async function call(path: string, user?: string, method = 'GET', body?: unknown, key = 'reliability-test-key') {
  return fetch(`http://localhost/api/${path}`, { method, headers: { ...(user ? { 'X-Demo-User-Id': user } : {}), 'Content-Type': 'application/json', 'Idempotency-Key': key }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const orderBody = { offerId: 'offer-tomato-round-m', quantityKg: 500, expectedOfferVersion: 1 };

describe('Permissions et absence de mutations partielles', () => {
  const adminEndpoints = [
    ['admin/dashboard', 'GET'], ['admin/payments', 'GET'], ['admin/disputes', 'GET'], ['admin/moderation', 'GET'], ['admin/users', 'GET'], ['admin/offers', 'GET'], ['admin/transport-partners', 'GET'],
    ['admin/orders/order-awaiting-payment/delivery', 'POST'], ['admin/orders/order-scheduled/delivery-transition', 'POST'], ['admin/orders/order-awaiting-reception/remind', 'POST'], ['admin/orders/order-awaiting-reception/payout', 'POST'],
    ['admin/disputes/unknown/review', 'POST'], ['admin/disputes/unknown/decision', 'POST'], ['admin/disputes/unknown/execute', 'POST'], ['admin/users/farmer-coop/status', 'PATCH'], ['admin/announcements/offer/offer-tomato-round-m/status', 'PATCH'],
    ['demo/reset', 'POST'], ['demo/force-error', 'POST'], ['demo/emails', 'GET'], ['demo/orders/order-awaiting-payment/expire', 'POST'],
  ];
  it.each(adminEndpoints)('protège %s (%s) sans altérer le dépôt', async (path, method) => {
    const before = values.get(BUSINESS_STORAGE_KEY);
    for (const user of [undefined, 'buyer-pro', 'farmer-coop']) {
      const response = await call(path, user, method, method === 'GET' ? undefined : {});
      expect(response.status).toBe(user ? 403 : 401);
      expect((await response.json()).error.message).toBeTruthy();
      expect(values.get(BUSINESS_STORAGE_KEY)).toBe(before);
    }
  });
  it.each([
    ['offers/offer-tomato-round-m', 'farmer-farm', 'PATCH', { pricePerKgCents: 400 }],
    ['requests/request-onion-rabat', 'buyer-pro', 'PATCH', { quantityKg: 900 }],
    ['conversations/conversation-offer/messages', 'buyer-private', 'POST', { text: 'Intrusion' }],
    ['conversations/conversation-offer/proposals', 'buyer-private', 'POST', { offerId: 'offer-tomato-round-m', quantityKg: 500, pricePerKgCents: 300 }],
    ['proposals/proposal-offer-pending/accept', 'buyer-private', 'POST', {}],
    ['proposals/proposal-offer-pending/reject', 'farmer-coop', 'POST', {}],
    ['orders/order-in-transit', 'buyer-pro', 'GET', undefined],
    ['orders/order-awaiting-payment/payment-attempts', 'buyer-private', 'POST', { method: 'naps' }],
    ['orders/order-awaiting-reception/accept-reception', 'buyer-private', 'POST', {}],
    ['orders/order-awaiting-payment/cancel', 'buyer-private', 'POST', {}],
    ['orders/order-awaiting-reception/disputes', 'buyer-private', 'POST', { reason: 'other', description: 'Problème' }],
    ['offers', 'buyer-pro', 'POST', {}], ['requests', 'farmer-coop', 'POST', {}], ['orders', 'farmer-coop', 'POST', orderBody], ['quotes', 'farmer-coop', 'POST', orderBody],
  ] as const)('vérifie le propriétaire ou rôle sur %s', async (path, user, method, body) => {
    const before = values.get(BUSINESS_STORAGE_KEY);
    expect((await call(path, user, method, body)).status).toBe(403);
    expect(values.get(BUSINESS_STORAGE_KEY)).toBe(before);
  });
  it('retourne une erreur forcée une fois et permet une nouvelle tentative', async () => {
    const before = values.get(BUSINESS_STORAGE_KEY);
    expect((await call('demo/force-error', 'admin', 'POST')).status).toBe(200);
    const failed = await call('orders', 'buyer-pro', 'POST', orderBody);
    expect(failed.status).toBe(500); expect((await failed.json()).error.code).toBe('FORCED_ERROR');
    expect(values.get(BUSINESS_STORAGE_KEY)).toBe(before);
    expect((await call('orders', 'buyer-pro', 'POST', orderBody)).status).toBe(200);
  });
  it('annule toute mutation en cas d’échec de sauvegarde puis conserve un seul résultat', async () => {
    const before = repository.snapshot().data; const serialized = values.get(BUSINESS_STORAGE_KEY);
    writeFails = true;
    const response = await call('orders', 'buyer-pro', 'POST', orderBody);
    expect(response.status).toBe(503); expect((await response.json()).error.code).toBe('STORAGE_UNAVAILABLE');
    expect(repository.snapshot().data).toEqual(before); expect(values.get(BUSINESS_STORAGE_KEY)).toBe(serialized);
    writeFails = false;
    const result = await (await call('orders', 'buyer-pro', 'POST', orderBody)).json();
    const reloaded = new DemoRepository(storage).load().data!;
    expect(reloaded.orders.filter(order => order.id === result.data.id)).toHaveLength(1);
    expect(reloaded.reservations.filter(item => item.orderId === result.data.id)).toHaveLength(1);
  });
  it('exige une confirmation de reset et conserve les clés des autres applications', async () => {
    values.set('another-app', 'keep');
    await call('me', 'buyer-pro', 'PATCH', { city: 'Tanger' });
    const before = values.get(BUSINESS_STORAGE_KEY);
    expect((await call('demo/reset', 'admin', 'POST', {})).status).toBe(400);
    expect(values.get(BUSINESS_STORAGE_KEY)).toBe(before);
    expect((await call('demo/reset', 'admin', 'POST', { confirm: true })).status).toBe(200);
    expect(new DemoRepository(storage).load().data!.users.find(user => user.id === 'buyer-pro')!.city).toBe('Casablanca');
    expect(values.get('another-app')).toBe('keep');
  });
  it('signale les données corrompues sans les écraser puis autorise un reset confirmé', async () => {
    values.set(BUSINESS_STORAGE_KEY, '{broken');
    const response = await call('offers');
    expect(response.status).toBe(503); expect((await response.json()).error.code).toBe('DATA_CORRUPT');
    expect((await call('orders', 'buyer-pro', 'POST', orderBody)).status).toBe(503);
    expect(values.get(BUSINESS_STORAGE_KEY)).toBe('{broken');
    expect((await call('demo/reset', 'admin', 'POST', { confirm: true })).status).toBe(200);
    expect((await call('offers')).status).toBe(200);
  });
  it('applique la latence configurée avant la réponse', async () => {
    server.resetHandlers(...createHandlers(repository, { latencyMs: 40 }));
    const start = performance.now(); await call('offers'); expect(performance.now() - start).toBeGreaterThanOrEqual(35);
  });
  it('protège les résultats de paiement et les notifications d’un autre compte', async () => {
    const before = values.get(BUSINESS_STORAGE_KEY);
    expect((await call('demo/payments/attempt-pending/result', 'buyer-private', 'POST', { result: 'success' })).status).toBe(403);
    const notification = repository.snapshot().data!.notifications.find(item => item.userId !== 'buyer-private')!;
    expect((await call(`notifications/${notification.id}`, 'buyer-private', 'PATCH')).status).toBe(403);
    expect(values.get(BUSINESS_STORAGE_KEY)).toBe(before);
  });
  it('confirme Cash Plus une seule fois et publie un seul ensemble d’événements', async () => {
    const created = await (await call('orders', 'buyer-pro', 'POST', orderBody)).json();
    const payment = await (await call(`orders/${created.data.id}/payment-attempts`, 'buyer-pro', 'POST', { method: 'cash_plus' }, 'cash-duplicate-key')).json();
    expect((await call(`demo/payments/${payment.data.id}/result`, 'buyer-pro', 'POST', { result: 'success' })).status).toBe(403);
    expect((await call(`demo/payments/${payment.data.id}/result`, 'admin', 'POST', { result: 'success' })).status).toBe(200);
    const before = repository.snapshot().data;
    expect((await call(`demo/payments/${payment.data.id}/result`, 'admin', 'POST', { result: 'success' })).status).toBe(200);
    expect(repository.snapshot().data).toEqual(before);
  });
  it.each(['full_refund', 'replacement'])('annule toute exécution de %s si la sauvegarde échoue, puis rejoue une seule fois', async resolution => {
    expect((await call('admin/disputes/dispute-delivery/review', 'admin', 'POST')).status).toBe(200);
    expect((await call('admin/disputes/dispute-delivery/decision', 'admin', 'POST', { resolution, decisionNote: 'Accord des parties', replacementQuantityKg: 100 })).status).toBe(200);
    const before = repository.snapshot().data;
    const serialized = values.get(BUSINESS_STORAGE_KEY);
    writeFails = true;
    expect((await call('admin/disputes/dispute-delivery/execute', 'admin', 'POST')).status).toBe(503);
    expect(repository.snapshot().data).toEqual(before); expect(values.get(BUSINESS_STORAGE_KEY)).toBe(serialized);
    writeFails = false;
    expect((await call('admin/disputes/dispute-delivery/execute', 'admin', 'POST')).status).toBe(200);
    const executed = repository.snapshot().data;
    expect((await call('admin/disputes/dispute-delivery/execute', 'admin', 'POST')).status).toBe(200);
    expect(repository.snapshot().data).toEqual(executed);
    expect(new DemoRepository(storage).load().data).toEqual(executed);
  });
  it.each([
    ['disputes/dispute-delivery', 'GET', undefined],
    ['disputes/dispute-delivery/comments', 'POST', { text: 'Intrusion' }],
    ['orders/order-disputed/replacement-issue', 'POST', { reason: 'other', description: 'Intrusion' }],
  ] as const)('refuse les accès au dossier d’autrui : %s', async (path, method, body) => {
    const before = values.get(BUSINESS_STORAGE_KEY);
    expect((await call(path, 'buyer-private', method, body)).status).toBe(403);
    expect(values.get(BUSINESS_STORAGE_KEY)).toBe(before);
  });
  it('préserve la modération lors d’une erreur de stockage et exige un motif', async () => {
    const path = 'admin/users/buyer-pro/status';
    const before = repository.snapshot().data;
    expect((await call(path, 'admin', 'PATCH', { status: 'suspended' })).status).toBe(400);
    writeFails = true;
    expect((await call(path, 'admin', 'PATCH', { status: 'suspended', reason: 'Contrôle du compte' })).status).toBe(503);
    expect(repository.snapshot().data).toEqual(before);
    writeFails = false;
    expect((await call(path, 'admin', 'PATCH', { status: 'suspended', reason: 'Contrôle du compte' })).status).toBe(200);
    expect((await call('orders/order-awaiting-reception/accept-reception', 'buyer-pro', 'POST')).status).toBe(200);
    expect((await call('orders', 'buyer-pro', 'POST', orderBody)).status).toBe(403);
  });
  it('autorise les champs propres au profil sans modification de rôle', async () => {
    expect((await call('me', 'farmer-coop', 'PATCH', { description: 'Coopérative de producteurs à Agadir.' })).status).toBe(200);
    expect((await call('me', 'buyer-pro', 'PATCH', { buyerType: 'private' })).status).toBe(200);
    const before = values.get(BUSINESS_STORAGE_KEY);
    for (const [user, body] of [['farmer-coop', { buyerType: 'private' }], ['buyer-pro', { buyerType: 'admin' }], ['buyer-pro', { role: 'admin' }], ['buyer-pro', { description: 'Interdit' }]] as const) {
      expect((await call('me', user, 'PATCH', body)).status).toBe(400);
      expect(values.get(BUSINESS_STORAGE_KEY)).toBe(before);
    }
  });
});
