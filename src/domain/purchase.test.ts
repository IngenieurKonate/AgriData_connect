import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialData } from '../mocks/seed/seedData';
import { acceptReception, amounts, availableStock, createOrder, createPayment, paymentResult, payout, planDelivery, quote, remindReception, transitionDelivery } from './businessOperations';
import type { BusinessData, OrderRecord } from './types';

let data: BusinessData;
beforeEach(() => { data = createInitialData(Date.parse('2026-11-11T10:00:00Z')); });
const buyer = () => data.users.find(user => user.id === 'buyer-pro')!;
const admin = () => data.users.find(user => user.id === 'admin')!;
const input = { offerId: 'offer-tomato-round-m', quantityKg: 500, expectedOfferVersion: 1 };
const create = () => createOrder(data, buyer(), input, 'purchase-order-key');
const pay = (order: OrderRecord) => {
  const attempt = createPayment(data, buyer(), order.id, { method: 'naps' }, 'payment-key-test');
  paymentResult(data, buyer(), attempt.id, 'success'); return attempt;
};
const plan = (order: OrderRecord) => planDelivery(data, admin(), order.id, { partnerId: data.transportPartners[0].id, collectionPlannedAt: '2026-11-12T10:00:00Z', arrivalEstimatedAt: '2026-11-13T12:00:00Z' });

describe('Achat direct et invariants', () => {
  it('réconcilie produits, livraison, commission et net en centimes', () => {
    expect(amounts(data, 500, 340)).toEqual({ goodsCents: 170000, deliveryCents: 27500, totalCents: 197500, commissionCents: 6800, netCents: 163200 });
    expect(amounts(data, 1, 333).commissionCents).toBe(13);
  });
  it.each([0, -1, 1.5, 249, 999999])('refuse une quantité invalide %s sans mutation', quantityKg => {
    const before = structuredClone(data);
    expect(() => createOrder(data, buyer(), { ...input, quantityKg }, 'quantity-test-key')).toThrow();
    expect(data).toEqual(before);
  });
  it('revérifie la version du prix à la confirmation et réserve une seule fois', () => {
    expect(quote(data, buyer(), input).totalCents).toBe(197500);
    const stock = availableStock(data, input.offerId);
    const order = create();
    expect(create()).toBe(order);
    expect(availableStock(data, input.offerId)).toBe(stock - 500);
    expect(() => createOrder(data, buyer(), { ...input, quantityKg: 600 }, 'purchase-order-key')).toThrow();
    data.offers.find(item => item.id === input.offerId)!.version++;
    expect(() => createOrder(data, buyer(), input, 'new-order-key')).toThrow(/changé/);
  });
  it('fige les coordonnées et conditions après modification du profil et du lot', () => {
    const order = create(); const before = structuredClone(order);
    buyer().address = 'Nouvelle adresse';
    data.offers.find(item => item.id === order.offerId)!.pricePerKgCents = 900;
    expect(order).toEqual(before);
  });
  it('conserve la réservation après refus et ne vend le stock qu’une fois', () => {
    const order = create(); const stock = data.offers.find(item => item.id === order.offerId)!.stockRemainingKg;
    const first = createPayment(data, buyer(), order.id, { method: 'naps' }, 'first-payment-key');
    paymentResult(data, buyer(), first.id, 'failure');
    expect(order.paymentStatus).toBe('failed');
    expect(data.offers.find(item => item.id === order.offerId)!.stockRemainingKg).toBe(stock);
    const second = createPayment(data, buyer(), order.id, { method: 'naps' }, 'second-payment-key');
    expect(order.paymentStatus).toBe('pending');
    paymentResult(data, buyer(), second.id, 'success');
    const after = structuredClone(data);
    paymentResult(data, buyer(), second.id, 'success');
    expect(data).toEqual(after);
    expect(data.offers.find(item => item.id === order.offerId)!.stockRemainingKg).toBe(stock - 500);
    expect(data.stockMovements.filter(item => item.orderId === order.id)).toHaveLength(1);
  });
  it('réserve la confirmation Cash Plus à l’administration et invalide l’ancienne référence', () => {
    const order = create();
    const cash = createPayment(data, buyer(), order.id, { method: 'cash_plus' }, 'cash-payment-key');
    expect(cash.reference).toMatch(/^DEMO-CP-/);
    expect(() => plan(order)).toThrow();
    expect(() => paymentResult(data, buyer(), cash.id, 'success')).toThrow();
    createPayment(data, buyer(), order.id, { method: 'naps' }, 'naps-payment-key');
    expect(cash.status).toBe('invalidated');
    expect(() => paymentResult(data, admin(), cash.id, 'success')).toThrow();
  });
  it('refuse un second moyen de paiement avec la même clé', () => {
    const order = create();
    createPayment(data, buyer(), order.id, { method: 'cash_plus' }, 'same-payment-key');
    expect(() => createPayment(data, buyer(), order.id, { method: 'naps' }, 'same-payment-key')).toThrow();
  });
  it('exige un montant exact et une commande active pour confirmer le paiement', () => {
    const order = create(); const attempt = createPayment(data, buyer(), order.id, { method: 'naps' }, 'valid-payment-key');
    attempt.amountCents--;
    expect(() => paymentResult(data, buyer(), attempt.id, 'success')).toThrow();
    attempt.amountCents++; order.status = 'cancelled';
    expect(() => paymentResult(data, buyer(), attempt.id, 'success')).toThrow();
  });
  it('respecte chaque transition, la réception acheteur et le versement unique', () => {
    const order = create();
    expect(() => plan(order)).toThrow();
    pay(order); const cycle = plan(order);
    expect(() => plan(order)).toThrow();
    expect(() => transitionDelivery(data, admin(), order.id, { status: 'handover_reported' })).toThrow();
    for (const status of ['collected', 'in_transit', 'handover_reported']) transitionDelivery(data, admin(), order.id, { status });
    expect(() => payout(data, admin(), order.id, 'payout-too-early')).toThrow();
    remindReception(data, admin(), order.id);
    expect(order.status).toBe('active'); expect(cycle.status).toBe('handover_reported');
    acceptReception(data, buyer(), order.id);
    const accepted = structuredClone(data); acceptReception(data, buyer(), order.id); expect(data).toEqual(accepted);
    const record = payout(data, admin(), order.id, 'final-payout-key');
    expect(record.netCents).toBe(163200); expect(order.status).toBe('closed');
    const closed = structuredClone(data); payout(data, admin(), order.id, 'final-payout-key'); payout(data, admin(), order.id, 'another-payout-key'); expect(data).toEqual(closed);
    for (const type of ['delivery_collected', 'delivery_in_transit', 'handover_reported']) {
      const event = data.events.find(item => item.orderId === order.id && item.type === type)!;
      expect(data.emails.filter(item => item.sourceEventId === event.id).map(item => item.recipientUserId)).toEqual(expect.arrayContaining([order.buyerId, order.sellerId]));
    }
  });
  it('protège les commandes existantes après désactivation du lot', () => {
    const order = create(); data.offers.find(item => item.id === order.offerId)!.status = 'suspended';
    expect(() => createOrder(data, buyer(), input, 'another-order-key')).toThrow();
    pay(order); expect(plan(order).status).toBe('scheduled');
  });
});
