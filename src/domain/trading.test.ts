import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialData } from '../mocks/seed/seedData';
import { availableStock, cancelOrder, createConversation, createOffer, createOrder, createProposal, createRequest, quote, respondToProposal, sendMessage, updateOffer, updateRequest } from './businessOperations';
import type { BusinessData } from './types';

let data: BusinessData;
beforeEach(() => { data = createInitialData(Date.parse('2026-11-11T10:00:00Z')); });
const user = (id = 'buyer-pro') => data.users.find(item => item.id === id)!;
const proposalInput = { offerId: 'offer-tomato-round-m', quantityKg: 500, pricePerKgCents: 315, qualityNotes: 'Calibre M, caisses triées' };
const offerInput = { product: 'tomato', title: 'Récolte de novembre', description: 'Tomates en caisses', grade: 'M', pricePerKgCents: 325, stockRemainingKg: 1500, minimumOrderKg: 250, city: 'Agadir', collectionAddress: 'Hangar 2' };
const requestInput = { product: 'tomato', quantityKg: 1000, grade: 'M', destination: 'Rabat', desiredDate: '2026-11-25', description: 'Pour un restaurant' };
const acceptSeed = () => respondToProposal(data, user(), 'proposal-offer-pending', true);

describe('Publication et négociation', () => {
  it('publie un lot avec sa photo par défaut et protège les commandes figées', () => {
    const offer = createOffer(data, user('farmer-coop'), offerInput);
    expect(offer.imageIds).toEqual(['offer-tomato-round-m']);
    const order = createOrder(data, user(), { offerId: offer.id, quantityKg: 500, expectedOfferVersion: 1 }, 'new-lot-order');
    const frozen = structuredClone(order);
    updateOffer(data, user('farmer-coop'), offer.id, { pricePerKgCents: 500, imageIds: ['offer-tomato-cherry'], version: 1 });
    expect(order).toEqual(frozen);
    expect(() => updateOffer(data, user('farmer-coop'), offer.id, { version: 1, title: 'Obsolète' })).toThrow(/changé/);
    expect(() => updateOffer(data, user('farmer-coop'), offer.id, { stockRemainingKg: 499 })).toThrow(/réservations/);
    updateOffer(data, user('farmer-coop'), offer.id, { status: 'disabled' });
    expect(() => createOrder(data, user(), { offerId: offer.id, quantityKg: 500, expectedOfferVersion: offer.version }, 'disabled-lot-order')).toThrow();
  });
  it.each([{ title: ' ' }, { description: 1 }, { imageIds: ['https://example.com/photo.jpg'] }, { imageIds: ['offer-onion-red'] }, { pricePerKgCents: -1 }, { minimumOrderKg: 90000 }])('refuse les modifications de lot invalides %j', changes => {
    const before = structuredClone(data);
    expect(() => updateOffer(data, user('farmer-coop'), 'offer-tomato-round-m', changes)).toThrow();
    expect(data).toEqual(before);
  });
  it('réserve publication et modification au propriétaire actif sans contournement de suspension', () => {
    expect(() => createOffer(data, user(), offerInput)).toThrow();
    expect(() => updateOffer(data, user('farmer-farm'), 'offer-tomato-round-m', { title: 'Non' })).toThrow();
    data.offers[0].status = 'suspended';
    expect(() => updateOffer(data, user('farmer-coop'), data.offers[0].id, { status: 'published' })).toThrow();
    user('farmer-coop').status = 'suspended';
    expect(() => createOffer(data, user('farmer-coop'), offerInput)).toThrow();
  });
  it.each([{ quantityKg: 0 }, { desiredDate: '2026-02-31' }, { desiredDate: 'abc' }, { targetPriceCents: -1 }, { product: 'potato' }, { description: '' }])('refuse une demande invalide %j', invalid => {
    const before = structuredClone(data);
    expect(() => createRequest(data, user(), { ...requestInput, ...invalid })).toThrow();
    expect(data).toEqual(before);
  });
  it('réutilise la conversation et conserve exactement le message, son auteur et ses notifications', () => {
    const conversation = createConversation(data, user(), { offerId: proposalInput.offerId });
    expect(conversation.id).toBe('conversation-offer');
    expect(data.conversations).toHaveLength(2);
    const message = sendMessage(data, user(), conversation.id, '  Livraison en caisses ?  ');
    expect(message.text).toBe('Livraison en caisses ?'); expect(message.senderId).toBe(user().id);
    expect(data.notifications.at(-1)?.userId).toBe('farmer-coop');
    expect(data.emails.at(-1)?.sourceEventId).toBe(message.id);
    expect(() => sendMessage(data, user('buyer-private'), conversation.id, 'Intrusion')).toThrow();
    expect(data.messages).toHaveLength(3);
  });
  it('accepte sans réserver ni commander et notifie une seule fois', () => {
    const beforeStock = availableStock(data, proposalInput.offerId);
    const proposal = acceptSeed();
    expect(proposal.status).toBe('accepted'); expect(proposal.orderId).toBeUndefined();
    expect(data.orders).toHaveLength(7); expect(availableStock(data, proposalInput.offerId)).toBe(beforeStock);
    expect(data.notifications.at(-1)?.type).toBe('proposal_accepted');
    const before = structuredClone(data); acceptSeed(); expect(data).toEqual(before);
  });
  it('autorise uniquement le destinataire à accepter ou refuser et conserve un refus', () => {
    expect(() => respondToProposal(data, user('farmer-coop'), 'proposal-offer-pending', true)).toThrow();
    expect(() => respondToProposal(data, user('buyer-private'), 'proposal-offer-pending', false)).toThrow();
    respondToProposal(data, user(), 'proposal-offer-pending', false);
    expect(() => respondToProposal(data, user(), 'proposal-offer-pending', true)).toThrow();
    expect(data.notifications.at(-1)?.type).toBe('proposal_rejected');
  });
  it('accepte une contre-proposition acheteur côté agriculteur puis commande côté acheteur', () => {
    const proposal = createProposal(data, user(), 'conversation-offer', proposalInput);
    expect(data.proposals[0].status).toBe('superseded');
    respondToProposal(data, user('farmer-coop'), proposal.id, true);
    const result = quote(data, user(), { proposalId: proposal.id });
    expect(result.pricePerKgCents).toBe(315); expect(result.quantityKg).toBe(500);
    const order = createOrder(data, user(), { proposalId: proposal.id }, 'negotiated-order');
    expect(order.goodsCents).toBe(157500); expect(order.qualityNotes).toBe(proposalInput.qualityNotes);
    expect(proposal.orderId).toBe(order.id);
    expect(createOrder(data, user(), { proposalId: proposal.id }, 'negotiated-order')).toBe(order);
    expect(() => createOrder(data, user(), { proposalId: proposal.id }, 'different-order-key')).toThrow(/déjà/);
    cancelOrder(data, user(), order.id);
    expect(() => createOrder(data, user(), { proposalId: proposal.id }, 'cancelled-proposal-key')).toThrow(/déjà/);
  });
  it('refuse toute substitution de lot, produit, propriétaire, quantité ou prix', () => {
    expect(() => createProposal(data, user(), 'conversation-offer', { ...proposalInput, offerId: 'offer-tomato-cherry' })).toThrow();
    expect(() => createProposal(data, user('farmer-coop'), 'conversation-request', proposalInput)).toThrow();
    expect(() => createProposal(data, user('farmer-farm'), 'conversation-request', { ...proposalInput, offerId: 'offer-tomato-elongated-l' })).toThrow();
    const proposal = acceptSeed();
    for (const invalid of [{ quantityKg: 501 }, { pricePerKgCents: 1 }, { offerId: 'offer-onion-red' }]) expect(() => createOrder(data, user(), { proposalId: proposal.id, ...invalid }, 'tampered-proposal-key')).toThrow();
  });
  it('refuse un accord non accepté, introuvable ou appartenant à un autre acheteur sans revenir à un achat direct', () => {
    for (const proposalId of ['proposal-offer-pending', 'does-not-exist', 'proposal-request-pending']) {
      const input = { proposalId, offerId: proposalInput.offerId, quantityKg: 500, expectedOfferVersion: 1 };
      expect(() => quote(data, user(), input)).toThrow();
      expect(() => createOrder(data, user(), input, 'invalid-proposal-order')).toThrow();
    }
    expect(data.orders).toHaveLength(7);
  });
  it('revérifie le stock à la confirmation et conserve le prix accepté après changement de prix catalogue', () => {
    const proposal = acceptSeed();
    updateOffer(data, user('farmer-coop'), proposal.offerId, { pricePerKgCents: 700 });
    expect(quote(data, user(), { proposalId: proposal.id }).pricePerKgCents).toBe(330);
    data.offers[0].stockRemainingKg = 500;
    expect(() => createOrder(data, user(), { proposalId: proposal.id }, 'stock-changed-order')).toThrow(/stock/);
    expect(proposal.orderId).toBeUndefined();
  });
  it.each(['pending', 'accepted'] as const)('invalide un accord %s lors de la modification et notifie les producteurs', status => {
    const proposal = data.proposals.find(item => item.id === 'proposal-request-pending')!;
    proposal.status = status;
    updateRequest(data, user('buyer-private'), 'request-onion-rabat', { destination: 'Salé' });
    expect(proposal.status).toBe('invalidated');
    expect(data.notifications.at(-1)).toMatchObject({ userId: 'farmer-farm', type: 'request_changed' });
    expect(() => createOrder(data, user('buyer-private'), { proposalId: proposal.id }, 'changed-request-order')).toThrow();
  });
  it('ferme une demande et interdit les nouveaux accords ainsi que la modification d’une demande fermée', () => {
    updateRequest(data, user('buyer-private'), 'request-onion-rabat', { status: 'closed' });
    expect(data.proposals[1].status).toBe('invalidated');
    expect(() => createProposal(data, user('farmer-farm'), 'conversation-request', { offerId: 'offer-onion-yellow', quantityKg: 800, pricePerKgCents: 215 })).toThrow();
    expect(() => updateRequest(data, user('buyer-private'), 'request-onion-rabat', { status: 'open' })).toThrow();
  });
  it('limite la demande à une commande, invalide tous les accords concurrents et rouvre après annulation', () => {
    const request = data.purchaseRequests.find(item => item.id === 'request-onion-rabat')!;
    const otherConversation = createConversation(data, user('farmer-coop'), { requestId: request.id });
    const other = createProposal(data, user('farmer-coop'), otherConversation.id, { offerId: 'offer-onion-red', quantityKg: 800, pricePerKgCents: 200 });
    respondToProposal(data, user('buyer-private'), other.id, true);
    respondToProposal(data, user('buyer-private'), 'proposal-request-pending', true);
    const order = createOrder(data, user('buyer-private'), { proposalId: 'proposal-request-pending' }, 'request-first-order');
    expect(request.status).toBe('ordered'); expect(request.orderId).toBe(order.id); expect(other.status).toBe('invalidated');
    expect(() => createOrder(data, user('buyer-private'), { proposalId: other.id }, 'request-second-order')).toThrow();
    expect(() => updateRequest(data, user('buyer-private'), request.id, { quantityKg: 600 })).toThrow();
    cancelOrder(data, user('buyer-private'), order.id);
    expect(request.status).toBe('open'); expect(request.orderId).toBeUndefined(); expect(other.status).toBe('invalidated');
    expect(data.proposals[1].orderId).toBe(order.id);
    const renewed = createProposal(data, user('farmer-coop'), otherConversation.id, { offerId: 'offer-onion-red', quantityKg: 800, pricePerKgCents: 205 });
    respondToProposal(data, user('buyer-private'), renewed.id, true);
    expect(createOrder(data, user('buyer-private'), { proposalId: renewed.id }, 'renewed-order-key').requestId).toBe(request.id);
  });
  it('une demande doit être encore ouverte même si un accord stocké semble accepté', () => {
    const proposal = data.proposals[1]; proposal.status = 'accepted';
    data.purchaseRequests.find(item => item.id === proposal.requestId)!.status = 'closed';
    expect(() => quote(data, user('buyer-private'), { proposalId: proposal.id })).toThrow(/demande/);
  });
});
