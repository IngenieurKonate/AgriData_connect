import { beforeAll, afterAll, beforeEach, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { createHandlers } from './index';
import { BUSINESS_STORAGE_KEY, DemoRepository } from '../repository/demoRepository';

const values = new Map<string, string>();
let failWrite = false;
const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { if (failWrite) throw new Error('full'); values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
const repository = new DemoRepository(storage);
const server = setupServer(...createHandlers(repository, { latencyMs: 0 }));
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => { failWrite = false; repository.reset(); });
const call = (path: string, user: string, method = 'GET', body?: unknown, key?: string) => fetch(`http://localhost/api/${path}`, { method, headers: { 'X-Demo-User-Id': user, 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });

it('persiste l’acceptation sans réservation et protège l’accès à la proposition', async () => {
  expect((await call('proposals/proposal-offer-pending/accept', 'farmer-coop', 'POST')).status).toBe(403);
  expect((await call('proposals/proposal-offer-pending', 'buyer-private')).status).toBe(404);
  expect((await call('proposals/proposal-offer-pending/accept', 'buyer-pro', 'POST')).status).toBe(200);
  const reloaded = new DemoRepository(storage).load().data!;
  expect(reloaded.proposals[0].status).toBe('accepted'); expect(reloaded.orders).toHaveLength(7);
  const detail = await (await call('conversations/conversation-offer', 'buyer-pro')).json();
  expect(detail.data.buyerName).toBe('Restaurant Jardin'); expect(detail.data.offers[0].availableKg).toBeGreaterThan(0);
  const response = await call('orders', 'buyer-pro', 'POST', { proposalId: 'proposal-offer-pending' }, 'api-proposal-order');
  expect(response.status).toBe(200);
  const order = (await response.json()).data;
  expect(order.goodsCents).toBe(165000);
  expect((await call('orders', 'buyer-pro', 'POST', { proposalId: 'proposal-offer-pending' }, 'different-proposal-key')).status).toBe(409);
  const replay = (await (await call('orders', 'buyer-pro', 'POST', { proposalId: 'proposal-offer-pending' }, 'api-proposal-order')).json()).data;
  expect(replay.id).toBe(order.id);
});

it('conserve demande, propositions et notifications si leur sauvegarde échoue', async () => {
  const before = storage.getItem(BUSINESS_STORAGE_KEY);
  failWrite = true;
  expect((await call('requests/request-onion-rabat', 'buyer-private', 'PATCH', { destination: 'Salé' })).status).toBe(503);
  expect(storage.getItem(BUSINESS_STORAGE_KEY)).toBe(before);
  failWrite = false;
  expect((await call('requests/request-onion-rabat', 'buyer-private', 'PATCH', { destination: 'Salé' })).status).toBe(200);
  const restored = new DemoRepository(storage).load().data!;
  expect(restored.proposals[1].status).toBe('invalidated'); expect(restored.notifications.at(-1)?.userId).toBe('farmer-farm');
});

it('refuse une publication ou une demande malformée sans mutation partielle', async () => {
  const before = storage.getItem(BUSINESS_STORAGE_KEY);
  expect((await call('offers/offer-tomato-round-m', 'farmer-coop', 'PATCH', { title: '', pricePerKgCents: 50 })).status).toBe(400);
  expect((await call('requests/request-onion-rabat', 'buyer-private', 'PATCH', { desiredDate: 'invalid' })).status).toBe(400);
  expect(storage.getItem(BUSINESS_STORAGE_KEY)).toBe(before);
});

it('rend le même accord accessible à l’acheteur auteur après acceptation du producteur', async () => {
  const response = await call('conversations/conversation-offer/proposals', 'buyer-pro', 'POST', { offerId: 'offer-tomato-round-m', quantityKg: 600, pricePerKgCents: 310 });
  const proposal = (await response.json()).data;
  expect((await call(`proposals/${proposal.id}/accept`, 'farmer-coop', 'POST')).status).toBe(200);
  expect((await call(`proposals/${proposal.id}`, 'buyer-pro')).status).toBe(200);
  expect((await call('quotes', 'buyer-pro', 'POST', { proposalId: proposal.id })).status).toBe(200);
  expect((await call('orders', 'farmer-coop', 'POST', { proposalId: proposal.id }, 'farmer-cannot-order')).status).toBe(403);
});
