import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { createHandlers } from './index';
import { BUSINESS_STORAGE_KEY, DemoRepository, type StoragePort } from '../repository/demoRepository';

function memoryStorage(): StoragePort {
  const values = new Map<string, string>();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
}

const storage = memoryStorage();
const repository = new DemoRepository(storage);
repository.load();
const server = setupServer(...createHandlers(repository, { latencyMs: 0 }));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => repository.reset());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function request(path: string, profileId?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (profileId) headers.set('X-Demo-User-Id', profileId);
  return fetch(new URL(path, 'http://localhost'), { ...init, headers });
}

describe('API simulée et autorisations', () => {
  it('sert uniquement les offres publiées avec du stock disponible', async () => {
    const response = await request('/api/offers');
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.length).toBe(6);
    expect(body.data.every((offer: { status: string; stockRemainingKg: number }) => offer.status === 'published' && offer.stockRemainingKg > 0)).toBe(true);
  });

  it('filtre les offres du producteur connecté', async () => {
    const response = await request('/api/offers?mine=true', 'farmer-coop');
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.length).toBe(3);
    expect(body.data.every((offer: { sellerId: string }) => offer.sellerId === 'farmer-coop')).toBe(true);
    const forbidden = await request('/api/offers?mine=true', 'buyer-pro');
    expect(forbidden.status).toBe(403);
  });

  it('restreint les commandes à leurs parties et à l’administration', async () => {
    expect((await request('/api/orders/order-in-transit', 'buyer-private')).status).toBe(200);
    expect((await request('/api/orders/order-in-transit', 'buyer-pro')).status).toBe(403);
    expect((await request('/api/orders/order-in-transit')).status).toBe(401);
  });

  it('réserve les demandes ouvertes aux profils connectés et protège les demandes privées', async () => {
    expect((await request('/api/requests')).status).toBe(401);
    expect((await request('/api/requests/request-tomato-casablanca', 'farmer-coop')).status).toBe(200);
    expect((await request('/api/requests/request-onion-rabat', 'buyer-pro')).status).toBe(403);
    expect((await request('/api/requests/request-onion-rabat', 'buyer-private')).status).toBe(200);
  });

  it('refuse le tableau de bord aux rôles non administrateurs', async () => {
    expect((await request('/api/admin/dashboard', 'farmer-coop')).status).toBe(403);
    const response = await request('/api/admin/dashboard', 'admin');
    expect((await response.json()).data.orders).toBe(7);
  });

  it('persiste une modification de profil et la retrouve après rechargement', async () => {
    const response = await request('/api/me', 'farmer-coop', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ city: 'Biougra' }),
    });
    expect(response.status).toBe(200);
    expect(new DemoRepository(storage).load().data?.users.find(user => user.id === 'farmer-coop')?.city).toBe('Biougra');
    expect(storage.getItem(BUSINESS_STORAGE_KEY)).not.toBeNull();
  });

  it('répond explicitement pour une route API inconnue', async () => {
    const response = await request('/api/unknown');
    expect(response.status).toBe(501);
  });

  it('enforce l’appartenance d’une offre avant modification', async () => {
    const response = await request('/api/offers/offer-tomato-round-m', 'farmer-farm', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pricePerKgCents: 999 }),
    });
    expect(response.status).toBe(403);
    expect(new DemoRepository(storage).load().data?.offers.find(offer => offer.id === 'offer-tomato-round-m')?.pricePerKgCents).toBe(340);
  });

  it('rejoue la commande sans doubler la réservation ni le paiement', async () => {
    const headers = { 'Content-Type': 'application/json', 'Idempotency-Key': 'order-create-001' };
    const create = () => request('/api/orders', 'buyer-pro', { method: 'POST', headers, body: JSON.stringify({ offerId: 'offer-tomato-cherry', quantityKg: 200, expectedOfferVersion: 1 }) });
    const first = await create(); const firstBody = await first.json();
    const replay = await create(); const replayBody = await replay.json();
    expect(first.status).toBe(200);
    expect(replayBody.data.id).toBe(firstBody.data.id);
    expect(new DemoRepository(storage).load().data?.reservations.filter(item => item.orderId === firstBody.data.id)).toHaveLength(1);
    const payment = await request(`/api/orders/${firstBody.data.id}/payment-attempts`, 'buyer-pro', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'payment-attempt-001' },
      body: JSON.stringify({ method: 'naps' }),
    });
    const attempt = (await payment.json()).data;
    const confirm = () => request(`/api/demo/payments/${attempt.id}/result`, 'admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ result: 'success' }),
    });
    expect(payment.status).toBe(200);
    expect((await confirm()).status).toBe(200);
    expect((await confirm()).status).toBe(200);
    const afterPayment = new DemoRepository(storage).load().data!;
    expect(afterPayment.offers.find(offer => offer.id === 'offer-tomato-cherry')?.stockRemainingKg).toBe(800);
    expect(afterPayment.stockMovements.filter(item => item.orderId === firstBody.data.id && item.type === 'sale')).toHaveLength(1);
  });
});
