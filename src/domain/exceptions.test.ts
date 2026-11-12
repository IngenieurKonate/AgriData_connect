import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialData } from '../mocks/seed/seedData';
import { acceptReception, availableStock, cancelOrder, commentDispute, createOffer, createOrder, createPayment, decideDispute, executeDispute, expireOrder, moderateAnnouncement, moderateUser, openDispute, paymentResult, payout, planDelivery, replacementIssue, reviewDispute, sendMessage, transitionDelivery, updateOffer } from './businessOperations';
import { dashboard, financialSummary } from './finance';
import type { BusinessData } from './types';

let data: BusinessData;
beforeEach(() => { data = createInitialData(Date.parse('2026-11-11T10:00:00Z')); });
const user = (id = 'admin') => data.users.find(item => item.id === id)!;
const order = () => data.orders.find(item => item.id === 'order-disputed')!;
const decide = (input: Record<string, unknown>) => { reviewDispute(data, user(), 'dispute-delivery'); return decideDispute(data, user(), 'dispute-delivery', { decisionNote: 'Accord des deux parties consigné', ...input }); };
const execute = (key = 'dispute-execution-key') => executeDispute(data, user(), 'dispute-delivery', key);
const plan = () => planDelivery(data, user(), order().id, { partnerId: 'transport-atlas', collectionPlannedAt: '2026-11-12T10:00:00Z', arrivalEstimatedAt: '2026-11-13T12:00:00Z' });
const deliver = () => { plan(); for (const status of ['collected', 'in_transit', 'handover_reported']) transitionDelivery(data, user(), order().id, { status }); };

describe('Litiges et réconciliation', () => {
  it('interdit un nouveau paiement après remboursement partiel avant le versement', () => {
    decide({ resolution: 'partial_refund', refundGoodsCents: 10000, refundDeliveryCents: 5000 }); execute();
    const before = structuredClone(data);
    expect(() => createPayment(data, user('buyer-pro'), order().id, { method: 'naps' }, 'after-refund-payment-key')).toThrow();
    expect(data).toEqual(before);
  });
  it('ouvre après remise, conserve la preuve et bloque le versement', () => {
    const dispute = openDispute(data, user('buyer-pro'), 'order-awaiting-reception', { reason: 'damaged', description: 'Une caisse abîmée', evidenceImageIds: ['offer-tomato-round-m'] });
    expect(dispute.evidenceImageIds).toEqual(['offer-tomato-round-m']);
    expect(data.payouts.find(item => item.orderId === dispute.orderId)?.status).toBe('blocked');
    expect(() => payout(data, user(), dispute.orderId, 'blocked-payout-key')).toThrow();
    expect(() => openDispute(data, user('buyer-pro'), dispute.orderId, { reason: 'other', description: 'Second dossier' })).toThrow();
  });
  it.each(['order-awaiting-payment', 'order-scheduled', 'order-closed'])('refuse un litige au mauvais stade : %s', id => {
    const item = data.orders.find(item => item.id === id)!;
    expect(() => openDispute(data, user(item.buyerId), id, { reason: 'damaged', description: 'Problème' })).toThrow();
  });
  it('réserve le signalement à son acheteur et les preuves à la bibliothèque', () => {
    expect(() => openDispute(data, user('buyer-private'), 'order-awaiting-reception', { reason: 'other', description: 'Problème' })).toThrow();
    expect(() => openDispute(data, user('buyer-pro'), 'order-awaiting-reception', { reason: 'other', description: 'Problème', evidenceImageIds: ['https://external.example/file'] })).toThrow();
  });
  it('sépare décision et exécution, rembourse une fois et remplace le versement bloqué existant', () => {
    const beforeStock = availableStock(data, order().offerId);
    decide({ resolution: 'full_refund' });
    expect(data.refunds).toHaveLength(0); expect(data.payouts.find(item => item.orderId === order().id)?.status).toBe('blocked');
    expect(() => acceptReception(data, user('buyer-pro'), order().id)).toThrow();
    execute();
    expect(order().status).toBe('closed'); expect(order().paymentStatus).toBe('refunded');
    expect(data.payouts.filter(item => item.orderId === order().id)).toHaveLength(1);
    expect(data.payouts.find(item => item.orderId === order().id)).toMatchObject({ status: 'not_applicable', netCents: 0, commissionCents: 0 });
    const after = structuredClone(data); execute(); execute('another-execution-key'); expect(data).toEqual(after);
    expect(availableStock(data, order().offerId)).toBe(beforeStock);
    expect(financialSummary(data, order())).toMatchObject({ paidCents: 99000, refundedCents: 99000, netCents: 0, retainedDeliveryCents: 0, balanced: true });
  });
  it('réconcilie remboursement partiel, commission, transport et versement unique', () => {
    decide({ resolution: 'partial_refund', refundGoodsCents: 10000, refundDeliveryCents: 5000 }); execute();
    expect(order().status).toBe('active'); expect(order().paymentStatus).toBe('partially_refunded');
    expect(financialSummary(data, order())).toMatchObject({ paidCents: 99000, refundedCents: 15000, commissionCents: 2760, netCents: 66240, retainedDeliveryCents: 15000, balanced: true });
    expect(data.payouts.filter(item => item.orderId === order().id)).toHaveLength(1);
    payout(data, user(), order().id, 'partial-payout-key');
    expect(order().status).toBe('closed'); expect(financialSummary(data, order()).remainingToSellerCents).toBe(0);
    const after = structuredClone(data); payout(data, user(), order().id, 'partial-payout-key'); expect(data).toEqual(after);
  });
  it('clôture sans versement si tous les produits sont remboursés, même avec du transport conservé', () => {
    decide({ resolution: 'partial_refund', refundGoodsCents: 79000, refundDeliveryCents: 0 }); execute();
    expect(order().status).toBe('closed');
    expect(financialSummary(data, order())).toMatchObject({ netCents: 0, commissionCents: 0, retainedDeliveryCents: 20000, balanced: true });
  });
  it.each([[-1, 0], [0, 0], [79001, 0], [0, 20001], [79000, 20000], [1.2, 0]])('refuse un remboursement partiel invalide (%s, %s) sans mutation', (goods, delivery) => {
    reviewDispute(data, user(), 'dispute-delivery'); const before = structuredClone(data);
    expect(() => decideDispute(data, user(), 'dispute-delivery', { resolution: 'partial_refund', refundGoodsCents: goods, refundDeliveryCents: delivery, decisionNote: 'Accord' })).toThrow();
    expect(data).toEqual(before);
  });
  it('refuse une clé de remboursement déjà utilisée par un autre dossier', () => {
    decide({ resolution: 'full_refund' }); execute();
    const another = openDispute(data, user('buyer-pro'), 'order-awaiting-reception', { reason: 'other', description: 'Autre commande' });
    reviewDispute(data, user(), another.id); decideDispute(data, user(), another.id, { resolution: 'full_refund', decisionNote: 'Accord' });
    const before = structuredClone(data);
    expect(() => executeDispute(data, user(), another.id, 'dispute-execution-key')).toThrow(/clé/); expect(data).toEqual(before);
  });
  it('déduit un remplacement une fois, conserve le premier cycle et exige la nouvelle réception', () => {
    const original = structuredClone(data.deliveryCycles.find(item => item.id === order().currentDeliveryCycleId)!);
    const beforeStock = availableStock(data, order().offerId); const attempts = structuredClone(data.paymentAttempts);
    decide({ resolution: 'replacement', replacementQuantityKg: 100 });
    expect(() => acceptReception(data, user('buyer-pro'), order().id)).toThrow();
    execute(); const after = structuredClone(data); execute(); execute('repeat-replacement'); expect(data).toEqual(after);
    expect(availableStock(data, order().offerId)).toBe(beforeStock - 100);
    expect(data.deliveryCycles.find(item => item.id === original.id)).toEqual(original);
    expect(data.deliveryCycles.find(item => item.id === order().currentDeliveryCycleId)).toMatchObject({ cycleNumber: 2, quantityKg: 100, status: 'not_started' });
    expect(() => acceptReception(data, user('buyer-pro'), order().id)).toThrow();
    deliver(); expect(data.deliveryCycles.filter(item => item.orderId === order().id)).toHaveLength(2);
    expect(() => payout(data, user(), order().id, 'replacement-too-early')).toThrow();
    acceptReception(data, user('buyer-pro'), order().id);
    expect(data.disputes[0].status).toBe('resolved'); payout(data, user(), order().id, 'replacement-payout');
    expect(order().status).toBe('closed'); expect(data.paymentAttempts).toEqual(attempts);
  });
  it('empêche un second remplacement et une réception conforme après un nouveau problème', () => {
    decide({ resolution: 'replacement', replacementQuantityKg: 100 }); execute(); deliver();
    expect(() => replacementIssue(data, user('buyer-pro'), order().id, { description: 'Motif absent' })).toThrow();
    replacementIssue(data, user('buyer-pro'), order().id, { reason: 'damaged', description: 'Remplacement également abîmé' });
    const after = structuredClone(data); replacementIssue(data, user('buyer-pro'), order().id, { reason: 'damaged', description: 'Remplacement également abîmé' }); expect(data).toEqual(after);
    expect(data.disputes).toHaveLength(1); expect(() => acceptReception(data, user('buyer-pro'), order().id)).toThrow();
    expect(() => decideDispute(data, user(), 'dispute-delivery', { resolution: 'replacement', replacementQuantityKg: 10, decisionNote: 'Nouvel essai' })).toThrow(/seul remplacement/);
    decideDispute(data, user(), 'dispute-delivery', { resolution: 'full_refund', decisionNote: 'Accord après échec du remplacement' }); execute('replacement-refund');
    expect(order().status).toBe('closed'); expect(data.stockMovements.filter(item => item.orderId === order().id && item.type === 'replacement')).toHaveLength(1);
  });
  it('bloque le stock insuffisant sans mutation et permet de choisir une résolution financière', () => {
    decide({ resolution: 'replacement', replacementQuantityKg: 200 });
    data.offers.find(item => item.id === order().offerId)!.stockRemainingKg = 100;
    const before = structuredClone(data); expect(() => execute()).toThrow(/stock/); expect(data).toEqual(before);
    reviewDispute(data, user(), 'dispute-delivery'); decideDispute(data, user(), 'dispute-delivery', { resolution: 'full_refund', decisionNote: 'Stock indisponible' }); execute(); expect(order().status).toBe('closed');
  });
  it('autorise les commentaires des parties sans changement de statut et notifie les autres', () => {
    commentDispute(data, user('farmer-farm'), 'dispute-delivery', 'Je confirme la caisse concernée.');
    expect(data.disputes[0].status).toBe('open'); expect(data.notifications.at(-1)?.type).toBe('dispute_comment');
    expect(() => commentDispute(data, user('farmer-coop'), 'dispute-delivery', 'Intrusion')).toThrow();
    expect(() => reviewDispute(data, user('buyer-pro'), 'dispute-delivery')).toThrow();
    expect(() => executeDispute(data, user('farmer-farm'), 'dispute-delivery', 'forbidden-execution')).toThrow();
  });
});

describe('Expiration et modération', () => {
  it('expire sans encaissement, libère le stock et invalide les références', () => {
    const pending = data.orders[0]; const before = availableStock(data, pending.offerId);
    const cash = createPayment(data, user(pending.buyerId), pending.id, { method: 'cash_plus' }, 'expiring-cash-key');
    expireOrder(data, user(), pending.id);
    expect(availableStock(data, pending.offerId)).toBe(before + pending.quantityKg); expect(cash.status).toBe('invalidated');
    expect(() => paymentResult(data, user(), cash.id, 'success')).toThrow();
    const after = structuredClone(data); expireOrder(data, user(), pending.id); expect(data).toEqual(after);
    expect(() => expireOrder(data, user(), 'order-closed')).toThrow();
  });
  it('suspend une offre sans interrompre une commande existante', () => {
    moderateAnnouncement(data, user(), 'offer', 'offer-tomato-round-m', { status: 'suspended', reason: 'Vérification du lot' });
    expect(() => createOrder(data, user('buyer-pro'), { offerId: 'offer-tomato-round-m', quantityKg: 500, expectedOfferVersion: 2 }, 'suspended-new-order')).toThrow();
    expect(() => updateOffer(data, user('farmer-coop'), 'offer-tomato-round-m', { status: 'published' })).toThrow();
    acceptReception(data, user('buyer-pro'), 'order-awaiting-reception'); payout(data, user(), 'order-awaiting-reception', 'suspended-offer-payout');
    moderateAnnouncement(data, user(), 'offer', 'offer-tomato-round-m', { status: 'published', reason: 'Vérification terminée' });
    expect(data.moderationEvents).toHaveLength(2);
  });
  it('un compte suspendu suit, paie, reçoit et commente ses commandes, sans nouveau commerce', () => {
    moderateUser(data, user(), 'buyer-pro', { status: 'suspended', reason: 'Contrôle du compte' });
    expect(() => createOrder(data, user('buyer-pro'), { offerId: 'offer-tomato-round-m', quantityKg: 500, expectedOfferVersion: 1 }, 'suspended-buyer-order')).toThrow();
    sendMessage(data, user('buyer-pro'), 'conversation-offer', 'Au sujet de ma commande existante');
    commentDispute(data, user('buyer-pro'), 'dispute-delivery', 'Je confirme le problème');
    acceptReception(data, user('buyer-pro'), 'order-awaiting-reception');
    const attempt = createPayment(data, user('buyer-pro'), 'order-awaiting-payment', { method: 'cash_plus' }, 'suspended-payment'); expect(attempt.status).toBe('pending');
    cancelOrder(data, user('buyer-pro'), 'order-awaiting-payment');
    moderateUser(data, user(), 'farmer-farm', { status: 'suspended', reason: 'Vérification' });
    expect(() => createOffer(data, user('farmer-farm'), {})).toThrow();
    commentDispute(data, user('farmer-farm'), 'dispute-delivery', 'Je reste disponible');
  });
  it('exige un motif et refuse les interventions non administratives sans mutation', () => {
    const before = structuredClone(data);
    expect(() => moderateUser(data, user(), 'buyer-pro', { status: 'suspended', reason: '' })).toThrow();
    expect(() => moderateUser(data, user('buyer-pro'), 'farmer-farm', { status: 'suspended', reason: 'Intrusion' })).toThrow();
    expect(() => moderateUser(data, user(), 'admin', { status: 'suspended', reason: 'Impossible' })).toThrow();
    expect(data).toEqual(before);
  });
  it('invalide les accords d’une demande suspendue sans les restaurer à la réactivation', () => {
    data.proposals[1].status = 'accepted';
    moderateAnnouncement(data, user(), 'request', 'request-onion-rabat', { status: 'suspended', reason: 'À vérifier' });
    expect(data.proposals[1].status).toBe('invalidated');
    moderateAnnouncement(data, user(), 'request', 'request-onion-rabat', { status: 'open', reason: 'Vérification terminée' });
    expect(data.purchaseRequests[1].status).toBe('open'); expect(data.proposals[1].status).toBe('invalidated');
  });
  it.each(['open', 'ordered', 'closed'] as const)('restaure le contexte %s d’une demande après suspension', status => {
    const request = data.purchaseRequests[1]; request.status = status;
    if (status === 'ordered') request.orderId = 'order-in-transit';
    moderateAnnouncement(data, user(), 'request', request.id, { status: 'suspended', reason: 'Contrôle' });
    moderateAnnouncement(data, user(), 'request', request.id, { status: 'open', reason: 'Fin de contrôle' });
    expect(request.status).toBe(status);
  });
  it('calcule les indicateurs depuis les encaissements et remboursements effectifs', () => {
    const before = dashboard(data); decide({ resolution: 'full_refund' }); execute(); const after = dashboard(data);
    expect(after.paidCents).toBe(before.paidCents); expect(after.refundedCents - before.refundedCents).toBe(order().totalCents);
    expect(after.openDisputes).toBe(0);
    for (const item of data.orders) expect(financialSummary(data, item).balanced).toBe(true);
  });
});
