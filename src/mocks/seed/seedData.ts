import type { BusinessData, DeliveryCycle, OrderRecord, OrderStatus, Product, PaymentStatus, Role } from '../../domain/types';
import { demoProfiles } from '../../app/profiles';

export const DAY = 86_400_000;
export const SCHEMA_VERSION = 1;
export const SEED_VERSION = 1;

export function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function user(role: Role, id: string) {
  const profile = demoProfiles.find(item => item.id === id)!;
  return {
    id, role, displayName: profile.displayName,
    ...(id === 'buyer-pro' ? { buyerType: 'professional' as const, organization: profile.organization } : {}),
    ...(id === 'buyer-private' ? { buyerType: 'private' as const } : {}),
    ...(role === 'farmer' ? { organization: profile.organization } : {}),
    email: profile.email, phone: '', city: profile.city, address: profile.address, status: 'active' as const,
  };
}

export function createInitialData(anchor = Date.now()): BusinessData {
  const time = (offsetDays: number) => new Date(anchor + offsetDays * DAY).toISOString();
  const adminId = 'admin';
  const farmerOne = 'farmer-coop';
  const farmerTwo = 'farmer-farm';
  const buyerOne = 'buyer-pro';
  const buyerTwo = 'buyer-private';
  const offers = [
    ['offer-tomato-round-m', farmerOne, 'Tomates rondes, calibre M', 'Tomates rondes récoltées dans la région d’Agadir.', 'M · 57-67 mm', 340, 4000, 250, 'Agadir', 'tomato'],
    ['offer-tomato-elongated-l', farmerTwo, 'Tomates allongées, calibre L', 'Lot de tomates allongées triées.', 'L · 67-82 mm', 395, 3200, 300, 'Meknès', 'tomato'],
    ['offer-tomato-cherry', farmerOne, 'Tomates cerises', 'Tomates cerises en caisses.', 'Non précisé', 1180, 1000, 100, 'Agadir', 'tomato'],
    ['offer-tomato-greenhouse', farmerTwo, 'Tomates de serre', 'Tomates récoltées et triées à la ferme.', 'M · 57-67 mm', 375, 0, 100, 'Meknès', 'tomato'],
    ['offer-tomato-disabled', farmerTwo, 'Tomates rondes, grand calibre', 'Annonce indisponible aux nouvelles commandes.', 'XL · plus de 82 mm', 410, 1500, 250, 'Meknès', 'tomato'],
    ['offer-onion-yellow', farmerTwo, 'Oignons jaunes, calibre 50-70', 'Oignons jaunes conditionnés en filets.', '50-70 mm', 215, 7000, 500, 'Meknès', 'onion'],
    ['offer-onion-red', farmerOne, 'Oignons rouges', 'Oignons rouges triés, prêts à enlever.', '60-80 mm', 290, 5000, 300, 'Agadir', 'onion'],
    ['offer-onion-white', farmerTwo, 'Oignons blancs', 'Oignons blancs de calibre régulier.', '45-65 mm', 260, 2600, 300, 'Meknès', 'onion'],
  ].map(([id_, sellerId, title, description, grade, pricePerKgCents, stockRemainingKg, minimumOrderKg, city, product]) => ({
    id: id_ as string, sellerId: sellerId as string, product: product as Product, title: title as string,
    description: description as string, grade: grade as string, pricePerKgCents: pricePerKgCents as number,
    stockRemainingKg: stockRemainingKg as number, minimumOrderKg: minimumOrderKg as number, city: city as string,
    collectionAddress: `Lieu de collecte, ${city as string}`, imageIds: [product as string],
    status: id_ === 'offer-tomato-greenhouse' ? 'published' as const : id_ === 'offer-tomato-disabled' ? 'disabled' as const : 'published' as const,
    version: 1, createdAt: time(-7),
  }));

  const purchaseRequests: BusinessData['purchaseRequests'] = [
    { id: 'request-tomato-casablanca', buyerId: buyerOne, product: 'tomato', quantityKg: 1500, grade: 'M ou L', destination: 'Casablanca', desiredDate: time(7), targetPriceCents: 330, description: 'Approvisionnement en tomates pour le restaurant.', status: 'open', createdAt: time(-1) },
    { id: 'request-onion-rabat', buyerId: buyerTwo, product: 'onion', quantityKg: 800, grade: '50-70 mm', destination: 'Rabat', desiredDate: time(10), description: 'Oignons jaunes pour achat en gros.', status: 'open', createdAt: time(-2) },
    { id: 'request-tomato-meknes', buyerId: buyerOne, product: 'tomato', quantityKg: 600, grade: 'M', destination: 'Meknès', desiredDate: time(5), targetPriceCents: 355, description: 'Tomates rondes, quantité confirmée avant enlèvement.', status: 'open', createdAt: time(-3) },
  ];
  const conversations: BusinessData['conversations'] = [
    { id: 'conversation-offer', buyerId: buyerOne, sellerId: farmerOne, offerId: 'offer-tomato-round-m', createdAt: time(-2) },
    { id: 'conversation-request', buyerId: buyerTwo, sellerId: farmerTwo, requestId: 'request-onion-rabat', createdAt: time(-1) },
  ];
  const messages: BusinessData['messages'] = [
    { id: 'message-offer-question', conversationId: 'conversation-offer', senderId: buyerOne, text: 'Le lot est-il disponible en 500 kg ?', createdAt: time(-2) },
    { id: 'message-offer-answer', conversationId: 'conversation-offer', senderId: farmerOne, text: 'Oui, je peux préparer cette quantité.', createdAt: time(-1) },
  ];
  const proposals: BusinessData['proposals'] = [
    { id: 'proposal-offer-pending', conversationId: 'conversation-offer', offerId: 'offer-tomato-round-m', authorId: farmerOne, recipientId: buyerOne, quantityKg: 500, pricePerKgCents: 330, qualityNotes: 'Calibre M, prix à confirmer.', status: 'pending', createdAt: time(-1) },
    { id: 'proposal-request-pending', conversationId: 'conversation-request', offerId: 'offer-onion-yellow', requestId: 'request-onion-rabat', authorId: farmerTwo, recipientId: buyerTwo, quantityKg: 800, pricePerKgCents: 215, qualityNotes: 'Calibre 50-70 mm.', status: 'pending', createdAt: time(-1) },
  ];

  const rawOrders = [
    ['order-awaiting-payment', buyerOne, farmerOne, 'offer-tomato-round-m', 'offer-tomato-round-m', 500, 340, 'active', 'pending', 'naps', 'not_started', -1],
    ['order-scheduled', buyerOne, farmerTwo, 'offer-onion-yellow', 'offer-onion-yellow', 300, 215, 'active', 'paid', 'naps', 'scheduled', -2],
    ['order-in-transit', buyerTwo, farmerOne, 'offer-onion-red', 'offer-onion-red', 2500, 290, 'active', 'paid', 'cash_plus', 'in_transit', -4],
    ['order-awaiting-reception', buyerOne, farmerOne, 'offer-tomato-round-m', 'offer-tomato-round-m', 500, 340, 'active', 'paid', 'naps', 'handover_reported', -3],
    ['order-closed', buyerTwo, farmerTwo, 'offer-onion-yellow', 'offer-onion-yellow', 1000, 215, 'closed', 'paid', 'naps', 'accepted', -8],
    ['order-disputed', buyerOne, farmerTwo, 'offer-tomato-elongated-l', 'offer-tomato-elongated-l', 200, 395, 'active', 'paid', 'naps', 'handover_reported', -5],
    ['order-cancelled', buyerTwo, farmerOne, 'offer-tomato-round-m', 'offer-tomato-round-m', 250, 340, 'cancelled', 'pending', 'naps', 'not_started', -7],
  ] as const;
  const orders: OrderRecord[] = rawOrders.map(([id_, buyerId, sellerId, offerId, itemId, quantityKg, priceCents, status, paymentStatus, , deliveryStatus, offset]) => {
    const offer = offers.find(entry => entry.id === itemId)!;
    const goodsCents = quantityKg * priceCents;
    const deliveryCents = 15000 + 25 * quantityKg;
    return {
      id: id_, reference: `CMD-2026-${String(Math.abs(offset) + 1).padStart(2, '0')}-${String(Math.abs(offset) + 18).padStart(4, '0')}`,
      buyerId, sellerId, offerId, item: { product: offer.product, title: offer.title, grade: offer.grade, sellerName: user('farmer', sellerId).displayName, imageId: offer.product },
      buyerAddress: { city: user('buyer', buyerId).city, address: user('buyer', buyerId).address },
      sellerAddress: { city: offer.city, address: offer.collectionAddress },
      quantityKg, goodsCents, deliveryCents, totalCents: goodsCents + deliveryCents,
      pricing: { deliveryBaseCents: 15000, deliveryPerKgCents: 25, commissionRateBps: 400 }, commissionRateBps: 400,
      status: status as OrderStatus, paymentStatus: paymentStatus as PaymentStatus,
      currentDeliveryCycleId: deliveryStatus === 'not_started' ? undefined : `cycle-${id_}`,
      disputeId: id_ === 'order-disputed' ? 'dispute-delivery' : undefined,
      createdAt: time(offset), updatedAt: time(offset),
    };
  });

  const deliveryCycles: DeliveryCycle[] = rawOrders
    .filter(([id_]) => id_ !== 'order-awaiting-payment' && id_ !== 'order-cancelled')
    .map(([id_, , , , , quantityKg, , , , , deliveryStatus, offset]) => ({
      id: `cycle-${id_}`, orderId: id_, cycleNumber: 1, quantityKg,
      partnerId: 'transport-atlas',
      collectionPlannedAt: time(offset + (deliveryStatus === 'scheduled' ? 1 : 0)),
      arrivalEstimatedAt: time(offset + (deliveryStatus === 'scheduled' ? 4 : 1)),
      status: deliveryStatus,
    }));

  const events: BusinessData['events'] = orders.flatMap(order => {
    const history = [{ type: order.status === 'cancelled' ? 'order_cancelled' : 'order_created', label: order.status === 'cancelled' ? 'Commande annulée' : 'Commande confirmée', details: order.status === 'cancelled' ? 'La commande a été annulée avant paiement et la réservation libérée.' : 'Conditions de commande enregistrées.', day: 0 }];
    if (order.paymentStatus === 'paid') history.push({ type: 'payment_confirmed', label: 'Paiement confirmé', details: 'Paiement enregistré.', day: 0 });
    if (order.currentDeliveryCycleId) {
      const status = deliveryCycles.find(cycle => cycle.id === order.currentDeliveryCycleId)?.status;
      if (status === 'scheduled' || status === 'collected' || status === 'in_transit' || status === 'handover_reported' || status === 'accepted') history.push({ type: 'delivery_scheduled', label: 'Collecte planifiée', details: 'Collecte coordonnée avec un transporteur partenaire.', day: 1 });
      if (status === 'collected' || status === 'in_transit' || status === 'handover_reported' || status === 'accepted') history.push({ type: 'delivery_collected', label: 'Produits récupérés', details: 'Les produits ont été récupérés.', day: 1 });
      if (status === 'in_transit' || status === 'handover_reported' || status === 'accepted') history.push({ type: 'delivery_in_transit', label: 'En livraison', details: 'Les produits sont en cours d’acheminement.', day: 1 });
      if (status === 'handover_reported' || status === 'accepted') history.push({ type: 'handover_reported', label: 'Remise signalée', details: 'La remise a été signalée à l’acheteur.', day: 1 });
      if (status === 'accepted') history.push({ type: 'reception_accepted', label: 'Réception confirmée', details: 'L’acheteur a confirmé la réception.', day: 2 });
    }
    const orderAgeInDays = (new Date(order.createdAt).getTime() - anchor) / DAY;
    return history.map((entry, index) => ({
      id: `event-${order.id}-${index + 1}`, orderId: order.id,
      actorId: entry.type === 'order_created' ? order.buyerId : entry.type === 'reception_accepted' ? order.buyerId : adminId,
      type: entry.type, label: entry.label, details: entry.details, deliveryCycleId: order.currentDeliveryCycleId,
      createdAt: time(orderAgeInDays + entry.day),
    }));
  });

  const reservations: BusinessData['reservations'] = [...orders.filter(order => order.paymentStatus !== 'paid').map(order => ({
    id: `reservation-${order.id}`, orderId: order.id, offerId: order.offerId, quantityKg: order.quantityKg,
    status: order.status === 'cancelled' ? 'released' as const : 'active' as const, createdAt: order.createdAt,
  })), ...orders.filter(order => order.paymentStatus === 'paid').map(order => ({
    id: `reservation-${order.id}`, orderId: order.id, offerId: order.offerId, quantityKg: order.quantityKg,
    status: 'consumed' as const, createdAt: order.createdAt,
  }))];
  const stockMovements = orders.filter(order => order.paymentStatus === 'paid').map(order => ({
    id: `movement-${order.id}`, offerId: order.offerId, orderId: order.id, type: 'sale' as const,
    quantityKg: order.quantityKg, createdAt: order.createdAt,
  }));
  for (const offer of offers) {
    const soldKg = stockMovements.filter(movement => movement.offerId === offer.id).reduce((sum, movement) => sum + movement.quantityKg, 0);
    offer.stockRemainingKg = Math.max(0, offer.stockRemainingKg - soldKg);
  }
  const successfulAttempts = orders.filter(order => order.paymentStatus === 'paid').map((order, index) => ({
    id: `attempt-${order.id}`, orderId: order.id, method: rawOrders.find(row => row[0] === order.id)![9], status: 'succeeded' as const,
    reference: `PAY-${String(index + 1).padStart(5, '0')}`, amountCents: order.totalCents,
    idempotencyKey: `seed-${order.id}`, createdAt: order.createdAt,
    confirmedAt: time((new Date(order.createdAt).getTime() - anchor) / DAY + 1 / 24),
  }));
  const paymentAttempts: BusinessData['paymentAttempts'] = [
    ...successfulAttempts,
    { id: 'attempt-pending', orderId: 'order-awaiting-payment', method: 'naps', status: 'pending', reference: 'NAPS-00001', amountCents: orders[0].totalCents, idempotencyKey: 'seed-order-awaiting-payment', createdAt: orders[0].createdAt },
  ];
  const disputes: BusinessData['disputes'] = [{
    id: 'dispute-delivery', orderId: 'order-disputed', reason: 'damaged',
    description: 'Une partie du lot est arrivée abîmée. Merci de vérifier les produits concernés.', evidenceImageIds: [],
    status: 'open', comments: [{ id: 'comment-dispute-buyer', authorId: buyerOne, authorRole: 'buyer', text: 'J’ai signalé le problème à la réception.', createdAt: time(-1) }], createdAt: orders.find(order => order.id === 'order-disputed')!.createdAt,
  }];
  const payouts: BusinessData['payouts'] = [
    { id: 'payout-order-closed', orderId: 'order-closed', sellerId: farmerTwo, status: 'paid', netCents: 206400, commissionCents: 8600, reference: 'VIR-2026-0001', idempotencyKey: 'seed-payout-order-closed', paidAt: time(-2) },
    { id: 'payout-order-disputed', orderId: 'order-disputed', sellerId: farmerTwo, status: 'blocked', netCents: 75840, commissionCents: 3160 },
  ];

  return {
    config: { schemaVersion: SCHEMA_VERSION, seedVersion: SEED_VERSION, seedAnchorTime: new Date(anchor).toISOString(), commissionRateBps: 400, deliveryBaseCents: 15000, deliveryPerKgCents: 25 },
    users: [user('buyer', buyerOne), user('buyer', buyerTwo), user('farmer', farmerOne), user('farmer', farmerTwo), user('admin', adminId)],
    offers, purchaseRequests, conversations, messages, proposals, orders, reservations, stockMovements, paymentAttempts,
    deliveryCycles, events,
    disputes,
    refunds: [], payouts,
    notifications: [
      { id: 'notification-new-proposal', userId: buyerOne, type: 'proposal_received', text: 'Une nouvelle proposition attend votre réponse.', targetPath: '/messages/conversation-offer', createdAt: time(-1) },
      { id: 'notification-order-transit', userId: buyerTwo, type: 'delivery_update', text: 'Votre commande est en livraison.', targetPath: '/commandes/order-in-transit', createdAt: time(-1) },
      { id: 'notification-handover', userId: buyerOne, type: 'delivery_handover', text: 'La remise de votre commande a été signalée. Confirmez la réception après avoir vérifié le lot.', targetPath: '/commandes/order-awaiting-reception', createdAt: time(-1) },
      { id: 'notification-dispute', userId: farmerTwo, type: 'dispute_opened', text: 'Un problème de réception nécessite votre attention.', targetPath: '/commandes/order-disputed', createdAt: time(-1) },
      { id: 'notification-payout', userId: farmerTwo, type: 'payout_sent', text: 'Un versement a été effectué.', targetPath: '/agriculteur/reglements', readAt: time(-1), createdAt: time(-2) },
    ],
    emails: [],
    transportPartners: [
      { id: 'transport-atlas', name: 'Transport Atlas', contact: 'transport.atlas@agridata.example' },
      { id: 'transport-souss', name: 'Logistique Souss', contact: 'logistique.souss@agridata.example' },
    ],
  };
}
