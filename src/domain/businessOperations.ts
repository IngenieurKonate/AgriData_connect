import type { BusinessData, DeliveryStatus, DisputeResolution, OrderRecord, PaymentMethod, Product, Proposal, Role, UserRecord } from './types';
import { photoLibrary } from '../assets/produce';

const now = () => new Date().toISOString();
const id = (type: string) => `${type}-${crypto.randomUUID()}`;
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;

export class OperationError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); this.name = 'OperationError'; }
}
function fail(status: number, code: string, message: string): never { throw new OperationError(status, code, message); }
const text = (value: unknown, name: string, max = 500) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(400, 'INVALID_DATA', `Le champ ${name} est invalide.`);
  return value.trim();
};
const actor = (user: UserRecord | null, roles: Role[], allowSuspended = false) => {
  if (!user) fail(401, 'UNAUTHENTICATED', 'Choisissez un profil pour continuer.');
  if (!roles.includes(user.role) || !allowSuspended && user.status !== 'active') fail(403, 'FORBIDDEN', 'Cette action n’est pas autorisée pour votre profil.');
  return user;
};
const product = (value: unknown): Product => value === 'tomato' || value === 'onion' ? value : fail(400, 'INVALID_DATA', 'Le produit doit être une tomate ou un oignon.');
const offerOf = (data: BusinessData, id_: unknown) => {
  const offer = data.offers.find(item => item.id === id_);
  if (!offer) fail(404, 'NOT_FOUND', 'Cette offre est introuvable.');
  return offer;
};
const orderOf = (data: BusinessData, id_: string) => {
  const order = data.orders.find(item => item.id === id_);
  if (!order) fail(404, 'NOT_FOUND', 'Cette commande est introuvable.');
  return order;
};
const keyOf = (value: unknown) => {
  const key = text(value, 'Idempotency-Key', 120);
  if (key.length < 8) fail(400, 'INVALID_DATA', 'La clé d’idempotence est trop courte.');
  return key;
};
export const availableStock = (data: BusinessData, offerId: string) => offerOf(data, offerId).stockRemainingKg - data.reservations.filter(item => item.offerId === offerId && item.status === 'active').reduce((sum, item) => sum + item.quantityKg, 0);
export const amounts = (data: BusinessData, kg: number, unitCents: number) => {
  const goodsCents = kg * unitCents;
  const deliveryCents = data.config.deliveryBaseCents + data.config.deliveryPerKgCents * kg;
  const commissionCents = Math.round(goodsCents * data.config.commissionRateBps / 10_000);
  return { goodsCents, deliveryCents, totalCents: goodsCents + deliveryCents, commissionCents, netCents: goodsCents - commissionCents };
};
const logEvent = (data: BusinessData, order: OrderRecord, actorId: string | undefined, type: string, label: string, details: string, deliveryCycleId?: string) => {
  const record = { id: id('event'), orderId: order.id, actorId, type, label, details, deliveryCycleId, createdAt: now() };
  data.events.push(record); return record;
};
const notify = (data: BusinessData, userId: string, type: string, message: string, path: string, sourceEventId: string) => {
  const createdAt = now();
  data.notifications.push({ id: id('notification'), userId, type, text: message, targetPath: path, createdAt });
  data.emails.push({ id: id('email'), recipientUserId: userId, subject: message.split(/[.!?]/)[0], body: message, sourceEventId, createdAt });
};

function offerImages(value: unknown, kind: Product): string[] {
  if (value === undefined) return [photoLibrary.find(photo => photo.product === kind)!.id];
  if (!Array.isArray(value) || value.length !== 1 || !photoLibrary.some(photo => photo.id === value[0] && photo.product === kind)) fail(400, 'INVALID_DATA', 'Choisissez une photo de la bibliothèque pour ce produit.');
  return [value[0] as string];
}
function desiredDate(value: unknown) {
  const result = text(value, 'date souhaitée', 40);
  if (!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result.slice(0, 10)) fail(400, 'INVALID_DATA', 'La date souhaitée est invalide.');
  return result;
}
export function invalidateRequestProposals(data: BusinessData, requestId: string) {
  const conversations = new Set<string>();
  data.proposals.filter(item => item.requestId === requestId && !item.orderId && ['pending', 'accepted'].includes(item.status)).forEach(item => {
    item.status = 'invalidated'; conversations.add(item.conversationId);
  });
  conversations.forEach(conversationId => {
    const conversation = data.conversations.find(item => item.id === conversationId)!;
    notify(data, conversation.sellerId, 'request_changed', 'La demande a changé. Les propositions précédentes ne sont plus utilisables.', `/messages/${conversationId}`, id('request-change'));
  });
}
function checkProposalContext(data: BusinessData, proposal: BusinessData['proposals'][number]) {
  const conversation = data.conversations.find(item => item.id === proposal.conversationId);
  const offer = offerOf(data, proposal.offerId);
  if (!conversation || offer.sellerId !== conversation.sellerId || conversation.offerId && conversation.offerId !== offer.id) fail(409, 'INVALID_PROPOSAL', 'Le lot ne correspond pas à cette conversation.');
  if (offer.status !== 'published' || !data.users.some(item => item.id === conversation.sellerId && item.status === 'active') || !data.users.some(item => item.id === conversation.buyerId && item.status === 'active')) fail(409, 'OFFER_UNAVAILABLE', 'Les conditions de cet échange ne permettent plus de nouvel accord.');
  if (conversation.requestId) {
    const request = data.purchaseRequests.find(item => item.id === conversation.requestId);
    if (!request || proposal.requestId !== request.id || request.buyerId !== conversation.buyerId || request.status !== 'open' || request.orderId || request.product !== offer.product || proposal.quantityKg > request.quantityKg) fail(409, 'REQUEST_UNAVAILABLE', 'Cette demande ne permet plus de commander cette proposition.');
  }
  return offer;
}
function acceptedProposal(data: BusinessData, buyer: UserRecord, input: Record<string, unknown>) {
  if (input.proposalId === undefined) return undefined;
  const proposal = data.proposals.find(item => item.id === input.proposalId);
  const conversation = data.conversations.find(item => item.id === proposal?.conversationId);
  if (!proposal || conversation?.buyerId !== buyer.id) fail(404, 'NOT_FOUND', 'Cette proposition est introuvable.');
  if (proposal.orderId) fail(409, 'PROPOSAL_ALREADY_ORDERED', 'Cette proposition a déjà produit une commande. Retrouvez-la dans la conversation.');
  if (proposal.status !== 'accepted') fail(409, 'INVALID_TRANSITION', 'La proposition doit être acceptée avant de commander.');
  checkProposalContext(data, proposal);
  if (input.offerId !== undefined && input.offerId !== proposal.offerId || input.quantityKg !== undefined && input.quantityKg !== proposal.quantityKg || input.pricePerKgCents !== undefined && input.pricePerKgCents !== proposal.pricePerKgCents) fail(409, 'PROPOSAL_MISMATCH', 'Un changement de prix ou de quantité exige une nouvelle proposition.');
  return proposal;
}

export function createOffer(data: BusinessData, user: UserRecord | null, input: Record<string, unknown>) {
  const seller = actor(user, ['farmer']);
  if (!positive(input.stockRemainingKg) || !positive(input.pricePerKgCents) || !positive(input.minimumOrderKg)) fail(400, 'INVALID_DATA', 'Le prix, le stock et la commande minimale doivent être positifs.');
  if (input.minimumOrderKg > input.stockRemainingKg) fail(400, 'INVALID_DATA', 'Le minimum de commande dépasse le stock.');
  const record = { id: id('offer'), sellerId: seller.id, product: product(input.product), title: text(input.title, 'titre', 120), description: text(input.description, 'description', 1000), grade: text(input.grade, 'calibre', 80), pricePerKgCents: input.pricePerKgCents, stockRemainingKg: input.stockRemainingKg, minimumOrderKg: input.minimumOrderKg, city: text(input.city, 'ville', 120), collectionAddress: text(input.collectionAddress, 'lieu de collecte', 200), imageIds: offerImages(input.imageIds, product(input.product)), status: 'published' as const, version: 1, createdAt: now() };
  data.offers.push(record); return record;
}

export function updateOffer(data: BusinessData, user: UserRecord | null, offerId: string, input: Record<string, unknown>) {
  const seller = actor(user, ['farmer']); const offer = offerOf(data, offerId);
  if (offer.sellerId !== seller.id) fail(403, 'FORBIDDEN', 'Vous ne pouvez modifier que vos offres.');
  if (offer.status === 'suspended') fail(403, 'FORBIDDEN', 'Seule l’administration peut réactiver une offre suspendue.');
  if (input.version !== undefined && input.version !== offer.version) fail(409, 'VERSION_CONFLICT', 'Cette offre a changé. Rechargez-la.');
  const allowed = ['title', 'description', 'grade', 'city', 'collectionAddress', 'pricePerKgCents', 'stockRemainingKg', 'minimumOrderKg', 'imageIds', 'status'];
  const changes = Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'version'));
  if (!Object.keys(changes).length || Object.keys(changes).some(key => !allowed.includes(key))) fail(400, 'INVALID_DATA', 'Les champs transmis ne sont pas valides.');
  if (changes.pricePerKgCents !== undefined && !positive(changes.pricePerKgCents) || changes.minimumOrderKg !== undefined && !positive(changes.minimumOrderKg)) fail(400, 'INVALID_DATA', 'Le prix et la commande minimale doivent être positifs.');
  if (changes.stockRemainingKg !== undefined && (!Number.isSafeInteger(changes.stockRemainingKg) || Number(changes.stockRemainingKg) < data.reservations.filter(item => item.offerId === offer.id && item.status === 'active').reduce((sum, item) => sum + item.quantityKg, 0))) fail(409, 'INSUFFICIENT_STOCK', 'Le stock ne peut pas être inférieur aux réservations actives.');
  if (changes.status !== undefined && !['published', 'disabled'].includes(String(changes.status))) fail(400, 'INVALID_DATA', 'Le statut de l’offre est invalide.');
  for (const [field, max] of Object.entries({ title: 120, description: 1000, grade: 80, city: 120, collectionAddress: 200 })) if (changes[field] !== undefined) changes[field] = text(changes[field], field, max);
  if (changes.imageIds !== undefined) changes.imageIds = offerImages(changes.imageIds, offer.product);
  if ((changes.stockRemainingKg !== undefined || changes.minimumOrderKg !== undefined) && Number(changes.stockRemainingKg ?? offer.stockRemainingKg) > 0 && Number(changes.minimumOrderKg ?? offer.minimumOrderKg) > Number(changes.stockRemainingKg ?? offer.stockRemainingKg)) fail(400, 'INVALID_DATA', 'Le minimum de commande dépasse le stock.');
  Object.assign(offer, changes); offer.version += 1; return offer;
}

export function createRequest(data: BusinessData, user: UserRecord | null, input: Record<string, unknown>) {
  const buyer = actor(user, ['buyer']);
  if (!positive(input.quantityKg)) fail(400, 'INVALID_DATA', 'La quantité doit être un entier positif.');
  if (input.targetPriceCents !== undefined && !positive(input.targetPriceCents)) fail(400, 'INVALID_DATA', 'Le prix souhaité doit être positif.');
  const record = { id: id('request'), buyerId: buyer.id, product: product(input.product), quantityKg: input.quantityKg, grade: text(input.grade, 'calibre', 80), destination: text(input.destination, 'destination', 120), desiredDate: desiredDate(input.desiredDate), ...(positive(input.targetPriceCents) ? { targetPriceCents: input.targetPriceCents } : {}), description: text(input.description, 'description', 1000), status: 'open' as const, createdAt: now() };
  data.purchaseRequests.push(record); return record;
}

export function updateRequest(data: BusinessData, user: UserRecord | null, requestId: string, input: Record<string, unknown>) {
  const buyer = actor(user, ['buyer']); const request = data.purchaseRequests.find(item => item.id === requestId);
  if (!request || request.buyerId !== buyer.id) fail(404, 'NOT_FOUND', 'Cette demande est introuvable.');
  if (request.orderId || request.status === 'ordered') fail(409, 'REQUEST_ALREADY_ORDERED', 'Cette demande est déjà liée à une commande.');
  if (request.status !== 'open') fail(409, 'REQUEST_UNAVAILABLE', 'Seules les demandes ouvertes peuvent être modifiées.');
  const allowed = ['product', 'quantityKg', 'grade', 'destination', 'desiredDate', 'targetPriceCents', 'description', 'status'];
  if (!Object.keys(input).length || Object.keys(input).some(key => !allowed.includes(key))) fail(400, 'INVALID_DATA', 'Les champs transmis ne sont pas valides.');
  if (input.status !== undefined && !['open', 'closed'].includes(String(input.status)) || input.quantityKg !== undefined && !positive(input.quantityKg)) fail(400, 'INVALID_DATA', 'Le statut ou la quantité est invalide.');
  const changes = { ...input };
  if (changes.product !== undefined) changes.product = product(changes.product);
  for (const [field, max] of Object.entries({ grade: 80, destination: 120, description: 1000 })) if (changes[field] !== undefined) changes[field] = text(changes[field], field, max);
  if (changes.desiredDate !== undefined) changes.desiredDate = desiredDate(changes.desiredDate);
  if (changes.targetPriceCents !== undefined && changes.targetPriceCents !== null && !positive(changes.targetPriceCents)) fail(400, 'INVALID_DATA', 'Le prix souhaité doit être positif.');
  Object.assign(request, changes);
  if (changes.targetPriceCents === null) delete request.targetPriceCents;
  invalidateRequestProposals(data, request.id);
  return request;
}

export function quote(data: BusinessData, user: UserRecord | null, input: Record<string, unknown>) {
  const buyer = actor(user, ['buyer']);
  const proposal = acceptedProposal(data, buyer, input);
  const offer = offerOf(data, proposal?.offerId ?? input.offerId);
  const quantityKg = proposal?.quantityKg ?? input.quantityKg;
  if (data.users.find(item => item.id === offer.sellerId)?.status !== 'active') fail(403, 'FORBIDDEN', 'Ce producteur ne peut pas recevoir de nouvelle commande.');
  if (offer.status !== 'published' || !positive(quantityKg) || quantityKg < offer.minimumOrderKg || quantityKg > availableStock(data, offer.id)) fail(409, 'INSUFFICIENT_STOCK', 'La quantité demandée n’est pas disponible.');
  if (!proposal && input.expectedOfferVersion !== offer.version) fail(409, 'PRICE_CHANGED', 'L’offre a changé. Recalculez le récapitulatif.');
  const pricePerKgCents = proposal?.pricePerKgCents ?? offer.pricePerKgCents;
  return { offerId: offer.id, proposalId: proposal?.id, quantityKg, pricePerKgCents, offerVersion: offer.version, ...amounts(data, quantityKg, pricePerKgCents) };
}

export function createConversation(data: BusinessData, user: UserRecord | null, input: Record<string, unknown>) {
  const current = actor(user, ['buyer', 'farmer']);
  const offerId = typeof input.offerId === 'string' ? input.offerId : undefined;
  const requestId = typeof input.requestId === 'string' ? input.requestId : undefined;
  if (Boolean(offerId) === Boolean(requestId)) fail(400, 'INVALID_DATA', 'Indiquez une offre ou une demande.');
  let buyerId: string; let sellerId: string;
  if (offerId) {
    const offer = offerOf(data, offerId);
    if (offer.status !== 'published' || offer.stockRemainingKg < offer.minimumOrderKg) fail(409, 'OFFER_UNAVAILABLE', 'Cette offre n’est pas disponible.');
    buyerId = current.role === 'buyer' ? current.id : text(input.buyerId, 'buyerId', 100);
    sellerId = offer.sellerId;
  } else {
    const request = data.purchaseRequests.find(item => item.id === requestId && item.status === 'open');
    if (!request) fail(404, 'NOT_FOUND', 'Cette demande est introuvable.');
    buyerId = request.buyerId;
    sellerId = current.role === 'farmer' ? current.id : text(input.sellerId, 'sellerId', 100);
  }
  if (current.role === 'buyer' && current.id !== buyerId || current.role === 'farmer' && current.id !== sellerId) fail(403, 'FORBIDDEN', 'Cette conversation n’est pas autorisée.');
  if (!data.users.some(item => item.id === buyerId && item.role === 'buyer' && item.status === 'active') || !data.users.some(item => item.id === sellerId && item.role === 'farmer' && item.status === 'active')) fail(400, 'INVALID_DATA', 'Les participants sont indisponibles.');
  const existing = data.conversations.find(item => item.buyerId === buyerId && item.sellerId === sellerId && (offerId ? item.offerId === offerId : item.requestId === requestId));
  if (existing) return existing;
  const conversation = { id: id('conversation'), buyerId, sellerId, ...(offerId ? { offerId } : { requestId }), createdAt: now() };
  data.conversations.push(conversation); return conversation;
}

export function sendMessage(data: BusinessData, user: UserRecord | null, conversationId: string, value: unknown) {
  const current = actor(user, ['buyer', 'farmer'], true);
  const conversation = data.conversations.find(item => item.id === conversationId);
  if (!conversation || (conversation.buyerId !== current.id && conversation.sellerId !== current.id)) fail(404, 'NOT_FOUND', 'Cette conversation est introuvable.');
  if (current.status === 'suspended' && !data.orders.some(order => order.buyerId === conversation.buyerId && order.sellerId === conversation.sellerId && (conversation.offerId ? order.offerId === conversation.offerId : order.requestId === conversation.requestId))) fail(403, 'FORBIDDEN', 'Les échanges restent ouverts uniquement pour vos commandes existantes.');
  const message = { id: id('message'), conversationId, senderId: current.id, text: text(value, 'text', 2000), createdAt: now() };
  data.messages.push(message);
  const recipient = current.id === conversation.buyerId ? conversation.sellerId : conversation.buyerId;
  notify(data, recipient, 'new_message', 'Vous avez reçu un nouveau message.', `/messages/${conversationId}`, message.id);
  return message;
}

export function createProposal(data: BusinessData, user: UserRecord | null, conversationId: string, input: Record<string, unknown>): Proposal {
  const current = actor(user, ['buyer', 'farmer']);
  const conversation = data.conversations.find(item => item.id === conversationId);
  if (!conversation || (conversation.buyerId !== current.id && conversation.sellerId !== current.id)) fail(404, 'NOT_FOUND', 'Cette conversation est introuvable.');
  const offer = offerOf(data, input.offerId);
  if (conversation.offerId && offer.id !== conversation.offerId) fail(409, 'INVALID_PROPOSAL', 'La proposition doit concerner le lot de cette conversation.');
  if (!data.users.some(item => item.id === conversation.buyerId && item.status === 'active') || !data.users.some(item => item.id === conversation.sellerId && item.status === 'active')) fail(403, 'FORBIDDEN', 'Un participant ne peut pas conclure de nouvel accord.');
  if (offer.sellerId !== conversation.sellerId || offer.status !== 'published') fail(403, 'FORBIDDEN', 'La proposition doit utiliser une offre active de cet agriculteur.');
  if (!positive(input.quantityKg) || input.quantityKg < offer.minimumOrderKg || input.quantityKg > availableStock(data, offer.id) || !positive(input.pricePerKgCents)) fail(409, 'INSUFFICIENT_STOCK', 'La quantité ou le prix de la proposition est invalide.');
  const request = conversation.requestId ? data.purchaseRequests.find(item => item.id === conversation.requestId) : undefined;
  if (conversation.requestId && (!request || request.status !== 'open' || request.orderId || request.product !== offer.product || input.quantityKg > request.quantityKg)) fail(409, 'REQUEST_UNAVAILABLE', 'La proposition ne correspond plus à la demande.');
  if (input.qualityNotes !== undefined && (typeof input.qualityNotes !== 'string' || input.qualityNotes.length > 1000)) fail(400, 'INVALID_DATA', 'Les conditions de qualité sont trop longues.');
  const recipientId = current.id === conversation.buyerId ? conversation.sellerId : conversation.buyerId;
  const proposal = { id: id('proposal'), conversationId, offerId: offer.id, ...(request ? { requestId: request.id } : {}), authorId: current.id, recipientId, quantityKg: input.quantityKg, pricePerKgCents: input.pricePerKgCents, qualityNotes: typeof input.qualityNotes === 'string' ? input.qualityNotes.trim() : '', status: 'pending' as const, createdAt: now() };
  data.proposals.filter(item => item.conversationId === conversationId && item.status === 'pending').forEach(item => { item.status = 'superseded'; });
  data.proposals.push(proposal);
  notify(data, recipientId, 'proposal_received', 'Une proposition attend votre réponse.', `/messages/${conversationId}`, proposal.id);
  return proposal;
}

export function respondToProposal(data: BusinessData, user: UserRecord | null, proposalId: string, accept: boolean) {
  const current = actor(user, ['buyer', 'farmer']);
  const proposal = data.proposals.find(item => item.id === proposalId);
  if (!proposal || proposal.recipientId !== current.id) fail(404, 'NOT_FOUND', 'Cette proposition est introuvable.');
  if (proposal.status === (accept ? 'accepted' : 'rejected')) return proposal;
  if (proposal.status !== 'pending') fail(409, 'INVALID_TRANSITION', 'Cette proposition n’est plus en attente.');
  if (accept) checkProposalContext(data, proposal);
  proposal.status = accept ? 'accepted' : 'rejected';
  notify(data, proposal.authorId, accept ? 'proposal_accepted' : 'proposal_rejected', accept ? 'Votre proposition a été acceptée. L’acheteur peut préparer sa commande.' : 'Votre proposition a été refusée.', `/messages/${proposal.conversationId}`, proposal.id);
  return proposal;
}

export function createOrder(data: BusinessData, user: UserRecord | null, input: Record<string, unknown>, keyValue: unknown) {
  const buyer = actor(user, ['buyer']); const key = keyOf(keyValue);
  const existing = data.orders.find(item => item.idempotencyKey === key);
  if (existing) {
    const address = input.buyerAddress as { city?: unknown; address?: unknown } | undefined;
    if (existing.buyerId !== buyer.id || input.offerId && input.offerId !== existing.offerId || input.quantityKg !== undefined && input.quantityKg !== existing.quantityKg || input.proposalId !== undefined && input.proposalId !== existing.proposalId || address && (address.city !== existing.buyerAddress.city || address.address !== existing.buyerAddress.address)) fail(409, 'IDEMPOTENCY_CONFLICT', 'Cette clé a déjà servi à une autre commande.');
    return existing;
  }
  const proposal = acceptedProposal(data, buyer, input);
  const offer = offerOf(data, proposal?.offerId ?? input.offerId);
  const quantityKg = proposal?.quantityKg ?? input.quantityKg;
  if (offer.status !== 'published' || !positive(quantityKg) || quantityKg < offer.minimumOrderKg || quantityKg > availableStock(data, offer.id)) fail(409, 'INSUFFICIENT_STOCK', 'Le stock disponible ne permet pas cette commande.');
  if (!proposal && input.expectedOfferVersion !== offer.version) fail(409, 'PRICE_CHANGED', 'L’offre a changé. Recalculez le récapitulatif avant de commander.');
  const seller = data.users.find(item => item.id === offer.sellerId)!;
  if (seller.status !== 'active') fail(403, 'FORBIDDEN', 'Ce producteur ne peut pas recevoir de nouvelle commande.');
  const address = input.buyerAddress as { city?: unknown; address?: unknown } | undefined;
  const price = proposal?.pricePerKgCents ?? offer.pricePerKgCents;
  const sums = amounts(data, quantityKg, price);
  const { commissionCents: _commission, netCents: _net, ...orderSums } = sums;
  const createdAt = now();
  const order: OrderRecord = {
    id: id('order'), idempotencyKey: key, reference: `CMD-${new Date().getFullYear()}-${String(data.orders.length + 1).padStart(5, '0')}`,
    buyerId: buyer.id, sellerId: offer.sellerId, offerId: offer.id, ...(proposal ? { proposalId: proposal.id } : {}), ...(proposal?.requestId ? { requestId: proposal.requestId } : {}),
    item: { product: offer.product, title: offer.title, grade: offer.grade, sellerName: seller.displayName, imageId: offer.imageIds[0] ?? offer.product },
    buyerAddress: { city: text(address?.city ?? buyer.city, 'buyerAddress.city', 120), address: text(address?.address ?? buyer.address, 'buyerAddress.address', 200) },
    sellerAddress: { city: text(offer.city, 'sellerAddress.city', 120), address: text(offer.collectionAddress, 'sellerAddress.address', 200) }, quantityKg, ...orderSums,
    pricing: { deliveryBaseCents: data.config.deliveryBaseCents, deliveryPerKgCents: data.config.deliveryPerKgCents, commissionRateBps: data.config.commissionRateBps },
    ...(proposal ? { qualityNotes: proposal.qualityNotes } : {}), commissionRateBps: data.config.commissionRateBps, status: 'active', paymentStatus: 'pending', createdAt, updatedAt: createdAt,
  };
  data.orders.push(order);
  data.reservations.push({ id: id('reservation'), orderId: order.id, offerId: offer.id, quantityKg, status: 'active', createdAt });
  if (proposal) { proposal.status = 'accepted'; proposal.orderId = order.id; }
  if (proposal?.requestId) {
    const request = data.purchaseRequests.find(item => item.id === proposal.requestId)!; request.status = 'ordered'; request.orderId = order.id;
    invalidateRequestProposals(data, request.id);
  }
  const created = logEvent(data, order, buyer.id, 'order_created', 'Commande créée', 'La quantité est réservée en attendant le paiement.');
  notify(data, seller.id, 'new_order', `Une nouvelle commande ${order.reference} attend son paiement.`, `/commandes/${order.id}`, created.id);
  notify(data, buyer.id, 'new_order', `Votre commande ${order.reference} est réservée.`, `/commandes/${order.id}`, created.id);
  notify(data, 'admin', 'new_order', `La commande ${order.reference} attend son paiement.`, `/commandes/${order.id}`, created.id);
  return order;
}

export function cancelOrder(data: BusinessData, user: UserRecord | null, orderId: string) {
  const buyer = actor(user, ['buyer'], true); const order = orderOf(data, orderId);
  if (order.buyerId !== buyer.id) fail(404, 'NOT_FOUND', 'Cette commande est introuvable.');
  return cancelUnpaid(data, buyer, order, false);
}
export function expireOrder(data: BusinessData, user: UserRecord | null, orderId: string) {
  const admin = actor(user, ['admin']);
  return cancelUnpaid(data, admin, orderOf(data, orderId), true);
}
function cancelUnpaid(data: BusinessData, current: UserRecord, order: OrderRecord, expired: boolean) {
  if (order.status === 'cancelled') return order;
  if (order.status !== 'active' || order.paymentStatus === 'paid' || order.paymentStatus === 'partially_refunded' || order.paymentStatus === 'refunded') fail(409, 'INVALID_TRANSITION', 'Cette commande ne peut plus être annulée.');
  order.status = 'cancelled'; order.updatedAt = now();
  if (order.requestId) {
    const request = data.purchaseRequests.find(item => item.id === order.requestId && item.orderId === order.id);
    if (request) { if (request.status === 'suspended') request.statusBeforeSuspension = 'open'; else request.status = 'open'; delete request.orderId; }
  }
  data.reservations.filter(item => item.orderId === order.id && item.status === 'active').forEach(item => { item.status = 'released'; });
  data.paymentAttempts.filter(item => item.orderId === order.id && item.status === 'pending').forEach(item => { item.status = 'invalidated'; });
  const created = logEvent(data, order, current.id, expired ? 'order_expired' : 'order_cancelled', expired ? 'Commande expirée' : 'Commande annulée', 'La réservation de stock a été libérée.');
  notifyParties(data, order, 'order_cancelled', `La commande ${order.reference} a été ${expired ? 'expirée' : 'annulée'}.`, created.id);
  return order;
}

export function createPayment(data: BusinessData, user: UserRecord | null, orderId: string, input: Record<string, unknown>, keyValue: unknown) {
  const buyer = actor(user, ['buyer'], true); const order = orderOf(data, orderId); const key = keyOf(keyValue);
  if (order.buyerId !== buyer.id) fail(404, 'NOT_FOUND', 'Cette commande est introuvable.');
  const existing = data.paymentAttempts.find(item => item.idempotencyKey === key);
  if (existing) { if (existing.orderId !== order.id || input.method !== existing.method) fail(409, 'IDEMPOTENCY_CONFLICT', 'Cette clé a déjà servi à un autre paiement.'); return existing; }
  if (order.status !== 'active' || !['pending', 'failed'].includes(order.paymentStatus)) fail(409, 'INVALID_TRANSITION', 'Cette commande ne peut pas être payée.');
  if (input.method !== 'naps' && input.method !== 'cash_plus') fail(400, 'INVALID_DATA', 'Choisissez un moyen de paiement disponible.');
  const method = input.method as PaymentMethod;
  const pending = data.paymentAttempts.find(item => item.orderId === order.id && item.status === 'pending' && item.method === method);
  if (pending) return pending;
  data.paymentAttempts.filter(item => item.orderId === order.id && item.status === 'pending').forEach(item => { item.status = 'invalidated'; });
  order.paymentStatus = 'pending'; order.updatedAt = now();
  const attempt = { id: id('attempt'), orderId: order.id, method, status: 'pending' as const, reference: `${method === 'naps' ? 'NAPS' : 'DEMO-CP'}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, amountCents: order.totalCents, idempotencyKey: key, createdAt: now() };
  data.paymentAttempts.push(attempt); return attempt;
}

export function paymentResult(data: BusinessData, user: UserRecord | null, attemptId: string, result: unknown) {
  const admin = actor(user, ['admin', 'buyer'], true); const attempt = data.paymentAttempts.find(item => item.id === attemptId);
  if (!attempt) fail(404, 'NOT_FOUND', 'Cette tentative de paiement est introuvable.');
  const order = orderOf(data, attempt.orderId);
  if (admin.role !== 'admin' && (order.buyerId !== admin.id || attempt.method !== 'naps')) fail(403, 'FORBIDDEN', 'Cette confirmation est réservée à l’administration.');
  if (result !== 'success' && result !== 'failure') fail(400, 'INVALID_DATA', 'Le résultat de paiement est invalide.');
  if (attempt.status === 'invalidated') fail(409, 'INVALID_TRANSITION', 'Cette tentative de paiement a été invalidée.');
  if (attempt.status === 'succeeded') return { attempt, order };
  if (order.status !== 'active' || order.paymentStatus === 'paid' || attempt.amountCents !== order.totalCents) fail(409, 'INVALID_TRANSITION', 'Cette commande ne peut plus recevoir ce paiement.');
  if (attempt.status !== 'pending' || result !== 'success' && result !== 'failure') fail(400, 'INVALID_DATA', 'Le résultat de paiement est invalide.');
  if (result === 'failure') {
    attempt.status = 'failed'; order.paymentStatus = 'failed'; order.updatedAt = now();
    const created = logEvent(data, order, admin.id, 'payment_failed', 'Paiement refusé', 'Le paiement n’a pas été confirmé.');
    notify(data, order.buyerId, 'payment_failed', 'Le paiement a été refusé. Vous pouvez choisir une nouvelle tentative.', `/commandes/${order.id}/paiement`, created.id);
    return { attempt, order };
  }
  const reservation = data.reservations.find(item => item.orderId === order.id && item.status === 'active'); const offer = offerOf(data, order.offerId);
  if (!reservation || reservation.quantityKg > offer.stockRemainingKg) fail(409, 'INSUFFICIENT_STOCK', 'La réservation ne peut plus être convertie en vente.');
  attempt.status = 'succeeded'; attempt.confirmedAt = now(); order.paymentStatus = 'paid'; order.updatedAt = now();
  reservation.status = 'consumed'; offer.stockRemainingKg -= reservation.quantityKg; offer.version += 1;
  data.paymentAttempts.filter(item => item.orderId === order.id && item.id !== attempt.id && item.status === 'pending').forEach(item => { item.status = 'invalidated'; });
  data.stockMovements.push({ id: id('movement'), offerId: offer.id, orderId: order.id, type: 'sale', quantityKg: reservation.quantityKg, createdAt: now() });
  const created = logEvent(data, order, admin.id, 'payment_confirmed', 'Paiement confirmé', 'Le paiement est enregistré.');
  notify(data, order.buyerId, 'payment_confirmed', 'Le paiement de votre commande est confirmé.', `/commandes/${order.id}`, created.id);
  notify(data, order.sellerId, 'payment_confirmed', 'Le paiement de la commande est confirmé.', `/commandes/${order.id}`, created.id);
  notify(data, 'admin', 'payment_confirmed', 'Une commande payée attend sa collecte.', `/commandes/${order.id}`, created.id);
  return { attempt, order };
}

const deliveryNext: Partial<Record<DeliveryStatus, DeliveryStatus>> = { scheduled: 'collected', collected: 'in_transit', in_transit: 'handover_reported' };
function replacementActive(data: BusinessData, order: OrderRecord) {
  const dispute = data.disputes.find(item => item.id === order.disputeId);
  return Boolean(dispute && dispute.resolutionType === 'replacement' && dispute.status === 'decision_recorded' && dispute.replacementCycleId === order.currentDeliveryCycleId && !dispute.replacementIssueAt);
}
function settlement(data: BusinessData, order: OrderRecord, goodsCents: number, status: 'blocked' | 'ready' | 'not_applicable') {
  const commissionCents = Math.round(goodsCents * order.commissionRateBps / 10_000);
  const netCents = goodsCents - commissionCents;
  let record = data.payouts.find(item => item.orderId === order.id);
  if (!record) { record = { id: id('payout'), orderId: order.id, sellerId: order.sellerId, status, netCents, commissionCents }; data.payouts.push(record); }
  else { record.status = status; record.netCents = netCents; record.commissionCents = commissionCents; }
  return record;
}
function notifyParties(data: BusinessData, order: OrderRecord, type: string, message: string, eventId: string) {
  for (const userId of [order.buyerId, order.sellerId]) notify(data, userId, type, message, `/commandes/${order.id}`, eventId);
}
export function planDelivery(data: BusinessData, user: UserRecord | null, orderId: string, input: Record<string, unknown>) {
  const admin = actor(user, ['admin']); const order = orderOf(data, orderId);
  if (order.paymentStatus !== 'paid' || order.status !== 'active' || order.disputeId && !replacementActive(data, order)) fail(409, 'INVALID_TRANSITION', 'La livraison ne peut pas être planifiée à ce stade.');
  let cycle = data.deliveryCycles.find(item => item.id === order.currentDeliveryCycleId);
  if (cycle && cycle.status !== 'not_started') fail(409, 'INVALID_TRANSITION', 'Une collecte est déjà planifiée pour cette commande.');
  const partnerId = text(input.partnerId, 'transporteur', 100);
  if (!data.transportPartners.some(item => item.id === partnerId)) fail(400, 'INVALID_DATA', 'Ce transporteur est introuvable.');
  const collectionPlannedAt = text(input.collectionPlannedAt, 'date de collecte', 40);
  const arrivalEstimatedAt = text(input.arrivalEstimatedAt, 'date d’arrivée', 40);
  if (!Number.isFinite(Date.parse(collectionPlannedAt)) || !Number.isFinite(Date.parse(arrivalEstimatedAt)) || Date.parse(arrivalEstimatedAt) < Date.parse(collectionPlannedAt)) fail(400, 'INVALID_DATA', 'Les dates du cycle de livraison sont invalides.');
  if (!cycle) {
    cycle = { id: id('cycle'), orderId: order.id, cycleNumber: data.deliveryCycles.filter(item => item.orderId === order.id).length + 1, quantityKg: order.quantityKg, status: 'not_started' };
    data.deliveryCycles.push(cycle); order.currentDeliveryCycleId = cycle.id;
  }
  Object.assign(cycle, { partnerId, collectionPlannedAt, arrivalEstimatedAt, status: 'scheduled' });
  order.updatedAt = now();
  const created = logEvent(data, order, admin.id, 'delivery_scheduled', 'Collecte planifiée', 'La collecte est organisée avec un transporteur partenaire.', cycle.id);
  notifyParties(data, order, 'delivery_update', 'La collecte de la commande est planifiée.', created.id);
  return cycle;
}
export function transitionDelivery(data: BusinessData, user: UserRecord | null, orderId: string, input: Record<string, unknown>) {
  const admin = actor(user, ['admin']); const order = orderOf(data, orderId);
  const cycle = data.deliveryCycles.find(item => item.id === order.currentDeliveryCycleId);
  if (order.status !== 'active' || order.paymentStatus !== 'paid' || order.disputeId && !replacementActive(data, order)) fail(409, 'INVALID_TRANSITION', 'La livraison ne peut pas avancer à cette étape.');
  if (!cycle || !deliveryNext[cycle.status] || input.status !== deliveryNext[cycle.status]) fail(409, 'INVALID_TRANSITION', 'Cette étape ne suit pas la transition autorisée.');
  cycle.status = input.status as DeliveryStatus;
  const labels: Record<string, [string, string, string]> = {
    collected: ['delivery_collected', 'Produits récupérés', 'Les produits ont été récupérés.'],
    in_transit: ['delivery_in_transit', 'En livraison', 'Les produits sont en cours d’acheminement.'],
    handover_reported: ['handover_reported', 'Remise signalée', 'La remise a été signalée à l’acheteur.'],
  };
  const [type, label, details] = labels[cycle.status];
  const created = logEvent(data, order, admin.id, type, label, details, cycle.id);
  order.updatedAt = now(); notifyParties(data, order, 'delivery_update', details, created.id);
  if (cycle.status === 'handover_reported') notify(data, order.buyerId, 'delivery_handover', 'Vérifiez le lot, puis confirmez la réception ou signalez un problème.', `/commandes/${order.id}`, created.id);
  return cycle;
}
export function acceptReception(data: BusinessData, user: UserRecord | null, orderId: string) {
  const buyer = actor(user, ['buyer'], true); const order = orderOf(data, orderId);
  if (order.buyerId !== buyer.id) fail(403, 'FORBIDDEN', 'Cette commande appartient à un autre acheteur.');
  const cycle = data.deliveryCycles.find(item => item.id === order.currentDeliveryCycleId);
  if (cycle?.status === 'accepted') return order;
  if (order.status !== 'active' || order.paymentStatus !== 'paid' || !cycle || cycle.status !== 'handover_reported') fail(409, 'INVALID_TRANSITION', 'La réception attend le signalement de la remise.');
  if (order.disputeId && !replacementActive(data, order)) fail(409, 'DISPUTE_BLOCKS_PAYOUT', 'Le litige doit être résolu avant cette confirmation.');
  const dispute = data.disputes.find(item => item.id === order.disputeId);
  cycle.status = 'accepted'; order.updatedAt = now();
  settlement(data, order, order.goodsCents, 'ready');
  if (dispute) {
    dispute.status = 'resolved';
    const resolved = logEvent(data, order, buyer.id, 'dispute_resolved', 'Litige résolu', 'Le remplacement a été reçu conforme.', cycle.id);
    notifyParties(data, order, 'dispute_resolved', 'Le litige est résolu après réception du remplacement.', resolved.id);
  }
  const created = logEvent(data, order, buyer.id, 'reception_accepted', 'Réception confirmée', 'L’acheteur a confirmé la réception.', cycle.id);
  notify(data, order.sellerId, 'reception_accepted', 'La réception est confirmée. Le versement peut être traité.', `/commandes/${order.id}`, created.id);
  notify(data, 'admin', 'reception_accepted', 'Une réception est confirmée. Le versement est disponible.', `/commandes/${order.id}`, created.id);
  return order;
}
export function remindReception(data: BusinessData, user: UserRecord | null, orderId: string) {
  const admin = actor(user, ['admin']); const order = orderOf(data, orderId);
  const cycle = data.deliveryCycles.find(item => item.id === order.currentDeliveryCycleId);
  if (order.status !== 'active' || order.paymentStatus !== 'paid' || !cycle || cycle.status !== 'handover_reported' || order.disputeId && !replacementActive(data, order)) fail(409, 'INVALID_TRANSITION', 'Aucune confirmation de réception n’est attendue.');
  const created = logEvent(data, order, admin.id, 'reception_reminder', 'Rappel de réception', 'Un rappel a été adressé à l’acheteur.', cycle.id);
  notify(data, order.buyerId, 'reception_reminder', 'Pensez à confirmer la réception ou à signaler un problème.', `/commandes/${order.id}`, created.id);
  return { sent: true };
}
function disputeOf(data: BusinessData, disputeId: string) {
  const dispute = data.disputes.find(item => item.id === disputeId);
  if (!dispute) fail(404, 'NOT_FOUND', 'Ce dossier est introuvable.');
  return dispute;
}
function reasonOf(value: unknown): 'non_conforming' | 'missing_quantity' | 'damaged' | 'other' {
  if (!['non_conforming', 'missing_quantity', 'damaged', 'other'].includes(String(value))) fail(400, 'INVALID_DATA', 'Choisissez un motif de signalement.');
  return value as 'non_conforming' | 'missing_quantity' | 'damaged' | 'other';
}
export function openDispute(data: BusinessData, user: UserRecord | null, orderId: string, input: Record<string, unknown>) {
  const buyer = actor(user, ['buyer'], true); const order = orderOf(data, orderId);
  if (order.buyerId !== buyer.id) fail(403, 'FORBIDDEN', 'Cette commande appartient à un autre acheteur.');
  const cycle = data.deliveryCycles.find(item => item.id === order.currentDeliveryCycleId);
  if (order.status !== 'active' || order.paymentStatus !== 'paid' || !cycle || cycle.status !== 'handover_reported' || data.payouts.some(item => item.orderId === order.id && item.status === 'paid')) fail(409, 'INVALID_TRANSITION', 'Un problème peut être signalé après la remise et avant la confirmation conforme.');
  if (order.disputeId) fail(409, 'DISPUTE_EXISTS', 'Cette commande a déjà un dossier de litige.');
  const evidence = input.evidenceImageIds ?? [];
  if (!Array.isArray(evidence) || evidence.length > 3 || evidence.some(value => !photoLibrary.some(photo => photo.id === value))) fail(400, 'INVALID_DATA', 'Choisissez une preuve dans la bibliothèque locale.');
  const dispute: BusinessData['disputes'][number] = { id: id('dispute'), orderId: order.id, reason: reasonOf(input.reason), description: text(input.description, 'description', 2000), evidenceImageIds: [...new Set(evidence as string[])], status: 'open', comments: [], createdAt: now() };
  data.disputes.push(dispute); order.disputeId = dispute.id; order.updatedAt = now();
  settlement(data, order, order.goodsCents, 'blocked');
  const created = logEvent(data, order, buyer.id, 'dispute_opened', 'Signalement ouvert', 'Un problème de réception doit être examiné.', cycle.id);
  notify(data, order.sellerId, 'dispute_opened', 'Un problème a été signalé sur une commande.', `/commandes/${order.id}`, created.id);
  notify(data, 'admin', 'dispute_opened', 'Un nouveau dossier nécessite un examen.', `/admin/litiges/${dispute.id}`, created.id);
  return dispute;
}
export function replacementIssue(data: BusinessData, user: UserRecord | null, orderId: string, input: Record<string, unknown>) {
  const buyer = actor(user, ['buyer'], true); const order = orderOf(data, orderId);
  if (order.buyerId !== buyer.id) fail(403, 'FORBIDDEN', 'Cette commande appartient à un autre acheteur.');
  const dispute = disputeOf(data, order.disputeId ?? '');
  const cycle = data.deliveryCycles.find(item => item.id === order.currentDeliveryCycleId);
  const reason = reasonOf(input.reason); const description = text(input.description, 'description', 2000);
  if (dispute.status === 'reviewing' && dispute.replacementIssueAt) return dispute;
  if (!replacementActive(data, order) || cycle?.status !== 'handover_reported' || order.status !== 'active') fail(409, 'INVALID_TRANSITION', 'Le problème doit concerner le remplacement remis et non encore accepté.');
  dispute.status = 'reviewing'; dispute.replacementIssueAt = now();
  const reasonLabel = { non_conforming: 'Produit non conforme', missing_quantity: 'Quantité manquante', damaged: 'Produit abîmé', other: 'Autre problème' }[reason];
  dispute.comments.push({ id: id('comment'), authorId: buyer.id, authorRole: buyer.role, text: `${reasonLabel} : ${description}`, createdAt: now() });
  settlement(data, order, order.goodsCents, 'blocked'); order.updatedAt = now();
  const created = logEvent(data, order, buyer.id, 'replacement_issue', 'Problème sur le remplacement', description, cycle.id);
  notify(data, order.sellerId, 'dispute_reopened', 'Le remplacement nécessite un règlement financier.', `/commandes/${order.id}`, created.id);
  notify(data, 'admin', 'dispute_reopened', 'Un problème a été signalé après un remplacement.', `/admin/litiges/${dispute.id}`, created.id);
  return dispute;
}
export function commentDispute(data: BusinessData, user: UserRecord | null, disputeId: string, value: unknown) {
  const current = actor(user, ['buyer', 'farmer', 'admin'], true); const dispute = disputeOf(data, disputeId);
  const order = orderOf(data, dispute.orderId);
  if (current.role !== 'admin' && current.id !== order.buyerId && current.id !== order.sellerId) fail(403, 'FORBIDDEN', 'Ce dossier appartient à un autre compte.');
  const comment = { id: id('comment'), authorId: current.id, authorRole: current.role, text: text(value, 'commentaire', 2000), createdAt: now() };
  dispute.comments.push(comment);
  for (const recipient of [order.buyerId, order.sellerId, 'admin'].filter(userId => userId !== current.id)) notify(data, recipient, 'dispute_comment', 'Un commentaire a été ajouté au dossier.', recipient === 'admin' ? `/admin/litiges/${dispute.id}` : `/commandes/${order.id}`, comment.id);
  return comment;
}
export function reviewDispute(data: BusinessData, user: UserRecord | null, disputeId: string) {
  const admin = actor(user, ['admin']); const dispute = disputeOf(data, disputeId);
  if (dispute.status === 'reviewing') return dispute;
  if (dispute.status !== 'open' && !(dispute.status === 'decision_recorded' && !dispute.replacementCycleId)) fail(409, 'INVALID_TRANSITION', 'Ce dossier ne peut pas être remis en traitement.');
  dispute.status = 'reviewing';
  logEvent(data, orderOf(data, dispute.orderId), admin.id, 'dispute_reviewing', 'Dossier en traitement', 'L’administration examine le signalement.');
  return dispute;
}
export function decideDispute(data: BusinessData, user: UserRecord | null, disputeId: string, input: Record<string, unknown>) {
  const admin = actor(user, ['admin']); const dispute = disputeOf(data, disputeId);
  if (dispute.status !== 'reviewing') fail(409, 'INVALID_TRANSITION', 'Le dossier doit être en traitement avant une décision.');
  const order = orderOf(data, dispute.orderId); const resolution = input.resolution as DisputeResolution;
  if (order.status !== 'active' || order.paymentStatus !== 'paid') fail(409, 'INVALID_TRANSITION', 'Cette commande ne peut plus recevoir de décision.');
  if (!['full_refund', 'partial_refund', 'replacement'].includes(resolution)) fail(400, 'INVALID_DATA', 'Le type de résolution est invalide.');
  const decisionNote = text(input.decisionNote, 'motif de décision et accord des parties', 2000);
  const goods = Number(input.refundGoodsCents); const delivery = Number(input.refundDeliveryCents);
  if (resolution === 'partial_refund' && (!Number.isSafeInteger(input.refundGoodsCents) || !Number.isSafeInteger(input.refundDeliveryCents) || goods < 0 || delivery < 0 || goods > order.goodsCents || delivery > order.deliveryCents || goods + delivery <= 0 || goods + delivery >= order.totalCents)) fail(400, 'INVALID_DATA', 'Les montants du remboursement partiel sont invalides.');
  if (resolution === 'replacement') {
    if (dispute.replacementCycleId || data.stockMovements.some(item => item.orderId === order.id && item.type === 'replacement')) fail(409, 'REPLACEMENT_LIMIT', 'Un seul remplacement est autorisé. Choisissez une résolution financière.');
    if (!positive(input.replacementQuantityKg) || input.replacementQuantityKg > order.quantityKg) fail(400, 'INVALID_DATA', 'La quantité de remplacement est invalide.');
  }
  dispute.resolutionType = resolution; dispute.decisionNote = decisionNote;
  delete dispute.refundGoodsCents; delete dispute.refundDeliveryCents;
  if (resolution === 'partial_refund') { dispute.refundGoodsCents = goods; dispute.refundDeliveryCents = delivery; }
  if (resolution === 'replacement') dispute.replacementQuantityKg = Number(input.replacementQuantityKg);
  dispute.status = 'decision_recorded';
  const details = `${decisionNote} · ${resolution === 'replacement' ? `${dispute.replacementQuantityKg} kg à remplacer` : resolution === 'full_refund' ? `${order.totalCents / 100} MAD à rembourser` : `${goods / 100} MAD de produits et ${delivery / 100} MAD de transport à rembourser`}`;
  const created = logEvent(data, order, admin.id, 'dispute_decision', 'Décision enregistrée', details);
  notifyParties(data, order, 'dispute_decision', 'Une décision est enregistrée. Son exécution reste à effectuer.', created.id);
  return dispute;
}
export function executeDispute(data: BusinessData, user: UserRecord | null, disputeId: string, keyValue: unknown) {
  const admin = actor(user, ['admin']); const dispute = disputeOf(data, disputeId);
  const order = orderOf(data, dispute.orderId); const key = keyOf(keyValue);
  const prior = data.refunds.find(item => item.idempotencyKey === key);
  const priorReplacement = data.disputes.find(item => item.replacementExecutionKey === key);
  if (prior && prior.disputeId !== dispute.id || priorReplacement && priorReplacement.id !== dispute.id) fail(409, 'IDEMPOTENCY_CONFLICT', 'Cette clé a déjà servi à une autre résolution.');
  if (prior) return { dispute, order, refund: prior };
  if (priorReplacement) return { dispute, order };
  const existingRefund = data.refunds.find(item => item.disputeId === dispute.id);
  if (existingRefund) return { dispute, order, refund: existingRefund };
  if (dispute.resolutionType === 'replacement' && dispute.replacementCycleId) return { dispute, order };
  if (dispute.status !== 'decision_recorded' || !dispute.resolutionType || order.status !== 'active' || order.paymentStatus !== 'paid') fail(409, 'INVALID_TRANSITION', 'Aucune décision exécutable n’est enregistrée.');
  if (dispute.resolutionType === 'replacement') {
    const offer = offerOf(data, order.offerId); const quantity = dispute.replacementQuantityKg!;
    if (quantity > availableStock(data, offer.id)) fail(409, 'INSUFFICIENT_STOCK', 'Le stock ne permet pas le remplacement. Revenez en traitement pour choisir un remboursement.');
    const cycle = { id: id('cycle'), orderId: order.id, cycleNumber: data.deliveryCycles.filter(item => item.orderId === order.id).length + 1, quantityKg: quantity, status: 'not_started' as const };
    data.deliveryCycles.push(cycle); order.currentDeliveryCycleId = cycle.id;
    offer.stockRemainingKg -= quantity; offer.version += 1;
    data.stockMovements.push({ id: id('movement'), offerId: offer.id, orderId: order.id, type: 'replacement', quantityKg: quantity, createdAt: now() });
    dispute.replacementCycleId = cycle.id; dispute.replacementExecutionKey = key;
    settlement(data, order, order.goodsCents, 'blocked'); order.updatedAt = now();
    const created = logEvent(data, order, admin.id, 'replacement_started', 'Remplacement en cours', 'Un nouveau cycle de livraison a été créé, sans nouveau paiement.', cycle.id);
    notifyParties(data, order, 'replacement_started', 'Le remplacement est prêt à être organisé.', created.id);
    return { dispute, order };
  }
  const goodsCents = dispute.resolutionType === 'full_refund' ? order.goodsCents : dispute.refundGoodsCents!;
  const deliveryCents = dispute.resolutionType === 'full_refund' ? order.deliveryCents : dispute.refundDeliveryCents!;
  const refund = { id: id('refund'), orderId: order.id, disputeId: dispute.id, amountCents: goodsCents + deliveryCents, goodsCents, deliveryCents, reference: `RMB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, idempotencyKey: key, executedAt: now() };
  data.refunds.push(refund); order.paymentStatus = dispute.resolutionType === 'full_refund' ? 'refunded' : 'partially_refunded'; dispute.status = 'resolved';
  const retainedGoods = order.goodsCents - goodsCents;
  const record = settlement(data, order, retainedGoods, retainedGoods > 0 ? 'ready' : 'not_applicable');
  if (record.netCents === 0) order.status = 'closed';
  order.updatedAt = now();
  const created = logEvent(data, order, admin.id, 'dispute_executed', 'Résolution exécutée', `Remboursement de ${refund.amountCents / 100} MAD enregistré sous ${refund.reference}.`);
  notifyParties(data, order, 'dispute_resolved', 'La résolution du dossier a été exécutée. Le remboursement est enregistré.', created.id);
  return { dispute, order, refund };
}

export function payout(data: BusinessData, user: UserRecord | null, orderId: string, keyValue: unknown) {
  const admin = actor(user, ['admin']); const order = orderOf(data, orderId); const key = keyOf(keyValue);
  const existing = data.payouts.find(item => item.idempotencyKey === key);
  if (existing) { if (existing.orderId !== order.id) fail(409, 'IDEMPOTENCY_CONFLICT', 'Cette clé a déjà servi.'); return existing; }
  const record = data.payouts.find(item => item.orderId === order.id);
  if (record?.status === 'paid') return record;
  if (!record || record.status !== 'ready' || order.status !== 'active') fail(409, 'DISPUTE_BLOCKS_PAYOUT', 'Aucun versement ne peut être effectué à cette étape.');
  if (order.disputeId && data.disputes.find(item => item.id === order.disputeId)?.status !== 'resolved') fail(409, 'DISPUTE_BLOCKS_PAYOUT', 'Le litige bloque encore le versement.');
  record.status = 'paid'; record.idempotencyKey = key; record.reference = `VIR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`; record.paidAt = now();
  order.status = 'closed'; order.updatedAt = now();
  const created = logEvent(data, order, admin.id, 'payout_paid', 'Versement effectué', 'Le versement a été enregistré.');
  notify(data, order.sellerId, 'payout_sent', 'Un versement a été effectué.', '/agriculteur/reglements', created.id);
  return record;
}

export function appendModeration(data: BusinessData, admin: UserRecord, targetType: 'user' | 'offer' | 'request', targetId: string, previousStatus: string, nextStatus: string, reason: string) {
  (data.moderationEvents ??= []).push({ id: id('moderation'), actorId: admin.id, targetType, targetId, previousStatus, nextStatus, reason: text(reason, 'reason', 500), createdAt: now() });
}

export function moderateUser(data: BusinessData, user: UserRecord | null, targetId: string, input: Record<string, unknown>) {
  const admin = actor(user, ['admin']);
  const target = data.users.find(item => item.id === targetId);
  if (!target) fail(404, 'NOT_FOUND', 'Ce compte est introuvable.');
  const reason = text(input.reason, 'motif', 500);
  if (target.role === 'admin' || !['active', 'suspended'].includes(String(input.status))) fail(400, 'INVALID_DATA', 'Le statut demandé est invalide.');
  if (target.status === input.status) return target;
  const previous = target.status; target.status = input.status as 'active' | 'suspended';
  appendModeration(data, admin, 'user', target.id, previous, target.status, reason);
  notify(data, target.id, 'account_moderated', `Votre compte est ${target.status === 'active' ? 'réactivé' : 'suspendu'} : ${reason}`, '/profil', id('moderation'));
  return target;
}
export function moderateAnnouncement(data: BusinessData, user: UserRecord | null, type: string, targetId: string, input: Record<string, unknown>) {
  const admin = actor(user, ['admin']); const reason = text(input.reason, 'motif', 500);
  if (type === 'offer') {
    const offer = offerOf(data, targetId);
    if (!['published', 'disabled', 'suspended'].includes(String(input.status))) fail(400, 'INVALID_DATA', 'Le statut est invalide.');
    if (offer.status === input.status) return offer;
    const previous = offer.status; offer.status = input.status as 'published' | 'disabled' | 'suspended'; offer.version++;
    appendModeration(data, admin, 'offer', targetId, previous, offer.status, reason);
    notify(data, offer.sellerId, 'offer_moderated', `Le statut de votre offre a changé : ${reason}`, '/agriculteur/offres', id('moderation'));
    return offer;
  }
  if (type !== 'request') fail(404, 'NOT_FOUND', 'Ce type d’annonce est introuvable.');
  const request = data.purchaseRequests.find(item => item.id === targetId);
  if (!request) fail(404, 'NOT_FOUND', 'Cette demande est introuvable.');
  if (!['open', 'closed', 'suspended'].includes(String(input.status))) fail(400, 'INVALID_DATA', 'Le statut est invalide.');
  let status = input.status as 'open' | 'closed' | 'suspended' | 'ordered';
  if (status === 'open') {
    const order = data.orders.find(item => item.id === request.orderId);
    status = order && order.status !== 'cancelled' ? order.status === 'closed' ? 'closed' : 'ordered' : request.statusBeforeSuspension === 'closed' ? 'closed' : 'open';
  }
  if (request.status === status) return request;
  const previous = request.status;
  if (status === 'suspended' && previous !== 'suspended') request.statusBeforeSuspension = previous;
  request.status = status;
  if (status !== 'open') invalidateRequestProposals(data, request.id);
  if (status !== 'suspended') delete request.statusBeforeSuspension;
  appendModeration(data, admin, 'request', targetId, previous, status, reason);
  notify(data, request.buyerId, 'request_moderated', `Le statut de votre demande a changé : ${reason}`, '/acheteur/demandes', id('moderation'));
  return request;
}
