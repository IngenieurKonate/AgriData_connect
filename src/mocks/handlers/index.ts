import { http, HttpResponse, type HttpHandler } from 'msw';
import { demoProfiles } from '../../app/profiles';
import { dashboard, financialSummary } from '../../domain/finance';
import { DemoRepository } from '../repository/demoRepository';
import type { BusinessData, Conversation, OfferRecord } from '../../domain/types';
import {
  OperationError, availableStock, acceptReception, expireOrder, moderateUser, moderateAnnouncement, cancelOrder, commentDispute, createConversation,
  createOffer, createOrder, createPayment, createProposal, createRequest, decideDispute, executeDispute,
  openDispute, payout, paymentResult, planDelivery, quote, remindReception, replacementIssue,
  respondToProposal, reviewDispute, sendMessage, transitionDelivery, updateOffer, updateRequest,
} from '../../domain/businessOperations';

type ApiErrorCode = string;
const failure = (status: number, code: ApiErrorCode, message: string) => HttpResponse.json({ error: { code, message } }, { status });
const offerView = (data: BusinessData, offer: OfferRecord) => ({ ...offer, availableKg: availableStock(data, offer.id), sellerName: data.users.find(user => user.id === offer.sellerId)?.displayName ?? 'Producteur' });
const conversationSummary = (data: BusinessData, conversation: Conversation) => {
  const request = data.purchaseRequests.find(item => item.id === conversation.requestId);
  return { ...conversation, title: data.offers.find(item => item.id === conversation.offerId)?.title ?? `${request?.quantityKg ?? ''} kg de ${request?.product === 'onion' ? 'oignons' : 'tomates'}`, buyerName: data.users.find(item => item.id === conversation.buyerId)?.displayName ?? 'Acheteur', sellerName: data.users.find(item => item.id === conversation.sellerId)?.displayName ?? 'Producteur', lastMessage: data.messages.filter(item => item.conversationId === conversation.id).at(-1), proposalCount: data.proposals.filter(item => item.conversationId === conversation.id && item.status === 'pending').length };
};

const orderView = (data: BusinessData, order: BusinessData['orders'][number]) => ({ ...order, events: data.events.filter(item => item.orderId === order.id), deliveryCycles: data.deliveryCycles.filter(item => item.orderId === order.id), attempts: data.paymentAttempts.filter(item => item.orderId === order.id), payout: data.payouts.find(item => item.orderId === order.id), transportPartners: data.transportPartners, dispute: data.disputes.find(item => item.id === order.disputeId), refunds: data.refunds.filter(item => item.orderId === order.id), financial: financialSummary(data, order) });
const payoutViews = (data: BusinessData) => data.orders.filter(order => data.paymentAttempts.some(item => item.orderId === order.id && item.status === 'succeeded')).map(order => {
  const record = data.payouts.find(item => item.orderId === order.id);
  const totals = financialSummary(data, order);
  const blockedByDispute = order.disputeId && data.disputes.find(item => item.id === order.disputeId)?.status !== 'resolved';
  return { ...(record ?? { id: 'pending-' + order.id, orderId: order.id, sellerId: order.sellerId, status: 'blocked' as const, netCents: totals.netCents, commissionCents: totals.commissionCents }), orderReference: order.reference, blockReason: blockedByDispute ? 'Bloqué : litige' : 'En attente de réception' };
});

export function createHandlers(repository: DemoRepository, options: { latencyMs?: number } = {}): HttpHandler[] {
  let forceNextError = false;
  const latencyMs = options.latencyMs ?? 300;
  const load = () => repository.load();
  const currentUser = (request: Request) => {
    const userId = request.headers.get('X-Demo-User-Id');
    return load().data?.users.find(user => user.id === userId) ?? null;
  };
  const requireUser = (request: Request) => currentUser(request);
  const canAccessOrder = (user: NonNullable<ReturnType<typeof currentUser>>, order: { buyerId: string; sellerId: string }) =>
    user.role === 'admin' || user.id === order.buyerId || user.id === order.sellerId;
  const readBody = async (request: Request): Promise<Record<string, unknown> | null> => {
    const body = await request.json().catch(() => null);
    return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
  };
  const mutate = (request: Request, operation: (data: import('../../domain/types').BusinessData, user: ReturnType<typeof currentUser>) => unknown) => {
    try {
      const user = currentUser(request);
      const result = repository.update(data => operation(data, user));
      return HttpResponse.json({ data: result.result });
    } catch (error) {
      if (error instanceof OperationError) return failure(error.status, error.code, error.message);
      if (error instanceof Error && 'code' in error) return failure(503, String(error.code), 'Les données ne peuvent pas être enregistrées.');
      return failure(500, 'INTERNAL_ERROR', 'Une erreur empêche de terminer cette action.');
    }
  };

  return [
    http.all('*/api/*', async ({ request }) => {
      if (forceNextError) { forceNextError = false; return failure(500, 'FORCED_ERROR', 'Une erreur a été demandée pour cette requête.'); }
      if (latencyMs > 0) await new Promise(resolve => setTimeout(resolve, latencyMs));
      const path = new URL(request.url).pathname;
      const state = load();
      if (state.error && !['/api/demo/reset', '/api/demo/profiles', '/api/demo/session'].includes(path)) return failure(503, state.error, 'Les données ne peuvent pas être lues ou enregistrées. Réessayez ou ouvrez les outils techniques.');
      const user = currentUser(request);
      if (path.startsWith('/api/admin/') || ['/api/demo/reset', '/api/demo/force-error', '/api/demo/emails'].includes(path)) {
        const role = user?.role ?? (path === '/api/demo/reset' && state.error ? demoProfiles.find(p => p.id === request.headers.get('X-Demo-User-Id'))?.role : undefined);
        if (role !== 'admin') return failure(role ? 403 : 401, role ? 'FORBIDDEN' : 'UNAUTHENTICATED', 'Action réservée à l’administration.');
      }
      const data = state.data;
      const parts = path.split('/').filter(Boolean);
      const orderId = parts[1] === 'orders' ? parts[2] : undefined;
      const order = data?.orders.find(item => item.id === orderId);
      if (order && user && !canAccessOrder(user, order)) return failure(403, 'FORBIDDEN', 'Cette commande appartient à un autre compte.');
      const owned = parts[1] === 'conversations' ? data?.conversations.find(item => item.id === parts[2]) : undefined;
      if (owned && user && owned.buyerId !== user.id && owned.sellerId !== user.id) return failure(403, 'FORBIDDEN', 'Cette conversation appartient à un autre compte.');
      const purchaseRequest = parts[1] === 'requests' ? data?.purchaseRequests.find(item => item.id === parts[2]) : undefined;
      if (purchaseRequest && user?.role === 'buyer' && purchaseRequest.buyerId !== user.id) return failure(403, 'FORBIDDEN', 'Cette demande appartient à un autre compte.');
      const proposal = parts[1] === 'proposals' ? data?.proposals.find(item => item.id === parts[2]) : undefined;
      if (proposal && user && request.method !== 'GET' && proposal.recipientId !== user.id) return failure(403, 'FORBIDDEN', 'Seul le destinataire peut répondre.');
      const dispute = parts[1] === 'disputes' ? data?.disputes.find(item => item.id === parts[2]) : undefined;
      const disputeOrder = data?.orders.find(item => item.id === dispute?.orderId);
      if (disputeOrder && user && !canAccessOrder(user, disputeOrder)) return failure(403, 'FORBIDDEN', 'Ce dossier appartient à un autre compte.');
      const notification = parts[1] === 'notifications' ? data?.notifications.find(item => item.id === parts[2]) : undefined;
      if (notification && user && notification.userId !== user.id) return failure(403, 'FORBIDDEN', 'Cette notification appartient à un autre compte.');
      return undefined;
    }),
    http.get('*/api/demo/profiles', () => HttpResponse.json({ data: demoProfiles })),
    http.post('*/api/demo/session', async ({ request }) => {
      const body = await request.json().catch(() => null) as { profileId?: string } | null;
      const profile = demoProfiles.find(item => item.id === body?.profileId);
      return profile ? HttpResponse.json({ data: profile }) : failure(400, 'INVALID_DATA', 'Ce profil est introuvable.');
    }),
    http.get('*/api/me', ({ request }) => {
      const user = requireUser(request);
      if (!user) return failure(401, 'UNAUTHENTICATED', 'Choisissez un profil pour continuer.');
      return HttpResponse.json({ data: user });
    }),
    http.patch('*/api/me', async ({ request }) => {
      const user = requireUser(request);
      if (!user) return failure(401, 'UNAUTHENTICATED', 'Choisissez un profil pour continuer.');
      const body = await request.json().catch(() => null) as Record<string, unknown> | null;
      const allowed = ['displayName', 'organization', 'phone', 'city', 'address', ...(user.role === 'farmer' ? ['description'] : user.role === 'buyer' ? ['buyerType'] : [])];
      if (!body || Array.isArray(body) || !Object.keys(body).length || Object.keys(body).some(key => !allowed.includes(key)) || Object.entries(body).some(([key, value]) => typeof value !== 'string' || value.length > 200 || (['displayName', 'city', 'address'].includes(key) && !value.trim()))) {
        return failure(400, 'INVALID_DATA', 'Les informations transmises ne sont pas valides.');
      }
      if (body.buyerType !== undefined && !['professional', 'private'].includes(String(body.buyerType))) return failure(400, 'INVALID_DATA', 'Choisissez un type d’acheteur valide.');
      try {
        repository.update(data => Object.assign(data.users.find(item => item.id === user.id)!, body));
        return HttpResponse.json({ data: repository.snapshot().data!.users.find(item => item.id === user.id) });
      } catch {
        return failure(503, 'STORAGE_UNAVAILABLE', 'Les modifications ne peuvent pas être enregistrées.');
      }
    }),
    http.get('*/api/offers', ({ request }) => {
      const url = new URL(request.url);
      const mine = url.searchParams.get('mine') === 'true';
      let offers = load().data?.offers ?? [];
      if (mine) {
        const user = requireUser(request);
        if (!user) return failure(401, 'UNAUTHENTICATED', 'Choisissez un profil pour continuer.');
        if (user.role !== 'farmer') return failure(403, 'FORBIDDEN', 'Cet espace est réservé aux agriculteurs.');
        offers = offers.filter(offer => offer.sellerId === user.id);
      } else offers = offers.filter(offer => offer.status === 'published' && offer.stockRemainingKg > 0 && load().data?.users.find(user => user.id === offer.sellerId)?.status === 'active');
      const q = url.searchParams.get('q')?.trim().toLocaleLowerCase('fr') ?? '';
      const product = url.searchParams.get('product');
      const city = url.searchParams.get('city')?.trim().toLocaleLowerCase('fr');
      if (q) offers = offers.filter(offer => `${offer.title} ${offer.description} ${offer.product} ${offer.city}`.toLocaleLowerCase('fr').includes(q));
      if (product === 'tomato' || product === 'onion') offers = offers.filter(offer => offer.product === product);
      if (city) offers = offers.filter(offer => offer.city.toLocaleLowerCase('fr').includes(city));
      const sort = url.searchParams.get('sort');
      if (sort === 'price-asc') offers = [...offers].sort((a, b) => a.pricePerKgCents - b.pricePerKgCents);
      if (sort === 'price-desc') offers = [...offers].sort((a, b) => b.pricePerKgCents - a.pricePerKgCents);
      if (sort === 'recent') offers = [...offers].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const data = load().data!;
      if (url.searchParams.get('available') === 'true') offers = offers.filter(offer => availableStock(data, offer.id) >= offer.minimumOrderKg);
      return HttpResponse.json({ data: offers.map(offer => ({ ...offer, availableKg: availableStock(data, offer.id), sellerName: data.users.find(user => user.id === offer.sellerId)?.displayName })) });
    }),
    http.get('*/api/offers/:id', ({ request, params }) => {
      const offer = load().data?.offers.find(item => item.id === params.id);
      if (!offer) return failure(404, 'NOT_FOUND', 'Cette offre est introuvable.');
      const user = currentUser(request);
      if (offer.status !== 'published' && user?.id !== offer.sellerId && user?.role !== 'admin') return failure(404, 'NOT_FOUND', 'Cette offre est introuvable.');
      const data = load().data!;
      return HttpResponse.json({ data: { ...offer, availableKg: availableStock(data, offer.id), sellerName: data.users.find(user => user.id === offer.sellerId)?.displayName } });
    }),
    http.get('*/api/requests', ({ request }) => {
      const user = currentUser(request);
      if (!user) return failure(401, 'UNAUTHENTICATED', 'Choisissez un profil pour continuer.');
      const requests = load().data?.purchaseRequests ?? [];
      return HttpResponse.json({ data: user.role === 'buyer' ? requests.filter(item => item.buyerId === user.id) : requests.filter(item => item.status === 'open') });
    }),
    http.get('*/api/requests/:id', ({ request, params }) => {
      const user = currentUser(request);
      const item = load().data?.purchaseRequests.find(record => record.id === params.id);
      if (!user) return failure(401, 'UNAUTHENTICATED', 'Choisissez un profil pour continuer.');
      if (!item || (user.role === 'buyer' ? item.buyerId !== user.id : user.role === 'farmer' ? item.status !== 'open' : false)) return failure(404, 'NOT_FOUND', 'Cette demande est introuvable.');
      return HttpResponse.json({ data: item });
    }),
    http.get('*/api/conversations', ({ request }) => {
      const user = requireUser(request);
      if (!user) return failure(401, 'UNAUTHENTICATED', 'Choisissez un profil pour continuer.');
      const conversations = load().data?.conversations.filter(item => item.buyerId === user.id || item.sellerId === user.id) ?? [];
      return HttpResponse.json({ data: conversations.map(item => conversationSummary(load().data!, item)) });
    }),
    http.get('*/api/conversations/:id', ({ request, params }) => {
      const user = requireUser(request);
      if (!user) return failure(401, 'UNAUTHENTICATED', 'Choisissez un profil pour continuer.');
      const data = load().data;
      const conversation = data?.conversations.find(item => item.id === params.id);
      if (!conversation || (conversation.buyerId !== user.id && conversation.sellerId !== user.id)) return failure(404, 'NOT_FOUND', 'Cette conversation est introuvable.');
      const relatedRequest = data!.purchaseRequests.find(item => item.id === conversation.requestId);
      return HttpResponse.json({ data: { ...conversationSummary(data!, conversation), request: relatedRequest, offers: data!.offers.filter(item => item.sellerId === conversation.sellerId && (conversation.offerId ? item.id === conversation.offerId : item.product === relatedRequest?.product)).map(item => offerView(data!, item)), messages: data!.messages.filter(item => item.conversationId === conversation.id), proposals: data!.proposals.filter(item => item.conversationId === conversation.id) } });
    }),
    http.get('*/api/proposals/:id', ({ request, params }) => {
      const user = requireUser(request);
      if (!user) return failure(401, 'UNAUTHENTICATED', 'Choisissez un profil pour continuer.');
      const data = load().data!;
      const proposal = data.proposals.find(item => item.id === params.id);
      const conversation = data.conversations.find(item => item.id === proposal?.conversationId);
      if (!proposal || !conversation || (conversation.buyerId !== user.id && conversation.sellerId !== user.id)) return failure(404, 'NOT_FOUND', 'Cette proposition est introuvable.');
      return HttpResponse.json({ data: { ...proposal, offer: offerView(data, data.offers.find(item => item.id === proposal.offerId)!) } });
    }),
    http.get('*/api/orders', ({ request }) => {
      const user = requireUser(request);
      if (!user) return failure(401, 'UNAUTHENTICATED', 'Choisissez un profil pour continuer.');
      const orders = load().data?.orders.filter(item => canAccessOrder(user, item)) ?? [];
      return HttpResponse.json({ data: orders });
    }),
    http.get('*/api/orders/:id', ({ request, params }) => {
      const user = requireUser(request);
      if (!user) return failure(401, 'UNAUTHENTICATED', 'Choisissez un profil pour continuer.');
      const data = load().data;
      const order = data?.orders.find(item => item.id === params.id);
      if (!order || !canAccessOrder(user, order)) return failure(404, 'NOT_FOUND', 'Cette commande est introuvable.');
      return HttpResponse.json({ data: orderView(data!, order) });
    }),
    http.get('*/api/notifications', ({ request }) => {
      const user = requireUser(request);
      if (!user) return failure(401, 'UNAUTHENTICATED', 'Choisissez un profil pour continuer.');
      return HttpResponse.json({ data: load().data?.notifications.filter(item => item.userId === user.id) ?? [] });
    }),
    http.get('*/api/payouts', ({ request }) => {
      const user = requireUser(request);
      if (!user) return failure(401, 'UNAUTHENTICATED', 'Choisissez un profil pour continuer.');
      if (user.role !== 'farmer' && user.role !== 'admin') return failure(403, 'FORBIDDEN', 'Cet espace est réservé aux agriculteurs.');
      return HttpResponse.json({ data: payoutViews(load().data!).filter(item => user.role === 'admin' || item.sellerId === user.id) });
    }),
    http.get('*/api/admin/dashboard', ({ request }) => {
      const user = requireUser(request);
      if (!user) return failure(401, 'UNAUTHENTICATED', 'Choisissez un profil pour continuer.');
      if (user.role !== 'admin') return failure(403, 'FORBIDDEN', 'Cet espace est réservé à l’administration.');
      const data = load().data!;
      return HttpResponse.json({ data: dashboard(data) });
    }),
    http.get('*/api/admin/payments', ({ request }) => {
      const user = requireUser(request);
      if (!user) return failure(401, 'UNAUTHENTICATED', 'Choisissez un profil pour continuer.');
      if (user.role !== 'admin') return failure(403, 'FORBIDDEN', 'Cet espace est réservé à l’administration.');
      const data = load().data!;
      return HttpResponse.json({ data: { attempts: data.paymentAttempts, refunds: data.refunds, payouts: payoutViews(data), orders: data.orders, totals: dashboard(data) } });
    }),
    http.get('*/api/admin/disputes', ({ request }) => {
      const user = requireUser(request);
      if (!user) return failure(401, 'UNAUTHENTICATED', 'Choisissez un profil pour continuer.');
      if (user.role !== 'admin') return failure(403, 'FORBIDDEN', 'Cet espace est réservé à l’administration.');
      return HttpResponse.json({ data: load().data?.disputes ?? [] });
    }),
    http.get('*/api/admin/transport-partners', ({ request }) => {
      const user = requireUser(request);
      if (!user) return failure(401, 'UNAUTHENTICATED', 'Choisissez un profil pour continuer.');
      if (user.role !== 'admin') return failure(403, 'FORBIDDEN', 'Cet espace est réservé à l’administration.');
      return HttpResponse.json({ data: load().data?.transportPartners ?? [] });
    }),
    http.get('*/api/admin/users', ({ request }) => {
      const user = requireUser(request);
      if (!user) return failure(401, 'UNAUTHENTICATED', 'Choisissez un profil pour continuer.');
      if (user.role !== 'admin') return failure(403, 'FORBIDDEN', 'Action réservée à l’administration.');
      return HttpResponse.json({ data: load().data?.users ?? [] });
    }),
    http.get('*/api/admin/offers', ({ request }) => {
      const user = requireUser(request);
      if (!user) return failure(401, 'UNAUTHENTICATED', 'Choisissez un profil pour continuer.');
      if (user.role !== 'admin') return failure(403, 'FORBIDDEN', 'Action réservée à l’administration.');
      return HttpResponse.json({ data: load().data?.offers ?? [] });
    }),
    http.post('*/api/offers', async ({ request }) => {
      const body = await readBody(request); if (!body) return failure(400, 'INVALID_DATA', 'Le contenu transmis est invalide.');
      return mutate(request, (data, user) => createOffer(data, user, body));
    }),
    http.patch('*/api/offers/:id', async ({ request, params }) => {
      const body = await readBody(request); if (!body) return failure(400, 'INVALID_DATA', 'Le contenu transmis est invalide.');
      return mutate(request, (data, user) => updateOffer(data, user, String(params.id), body));
    }),
    http.post('*/api/requests', async ({ request }) => {
      const body = await readBody(request); if (!body) return failure(400, 'INVALID_DATA', 'Le contenu transmis est invalide.');
      return mutate(request, (data, user) => createRequest(data, user, body));
    }),
    http.patch('*/api/requests/:id', async ({ request, params }) => {
      const body = await readBody(request); if (!body) return failure(400, 'INVALID_DATA', 'Le contenu transmis est invalide.');
      return mutate(request, (data, user) => updateRequest(data, user, String(params.id), body));
    }),
    http.post('*/api/conversations', async ({ request }) => {
      const body = await readBody(request); if (!body) return failure(400, 'INVALID_DATA', 'Le contenu transmis est invalide.');
      return mutate(request, (data, user) => createConversation(data, user, body));
    }),
    http.post('*/api/conversations/:id/messages', async ({ request, params }) => {
      const body = await readBody(request); if (!body) return failure(400, 'INVALID_DATA', 'Le contenu transmis est invalide.');
      return mutate(request, (data, user) => sendMessage(data, user, String(params.id), body.text));
    }),
    http.post('*/api/conversations/:id/proposals', async ({ request, params }) => {
      const body = await readBody(request); if (!body) return failure(400, 'INVALID_DATA', 'Le contenu transmis est invalide.');
      return mutate(request, (data, user) => createProposal(data, user, String(params.id), body));
    }),
    http.post('*/api/proposals/:id/accept', ({ request, params }) => mutate(request, (data, user) => respondToProposal(data, user, String(params.id), true))),
    http.post('*/api/proposals/:id/reject', ({ request, params }) => mutate(request, (data, user) => respondToProposal(data, user, String(params.id), false))),
    http.post('*/api/quotes', async ({ request }) => {
      const body = await readBody(request); if (!body) return failure(400, 'INVALID_DATA', 'Le contenu transmis est invalide.');
      try { return HttpResponse.json({ data: quote(load().data!, currentUser(request), body) }); }
      catch (error) { return error instanceof OperationError ? failure(error.status, error.code, error.message) : failure(500, 'INTERNAL_ERROR', 'Le récapitulatif ne peut pas être calculé.'); }
    }),
    http.post('*/api/orders', async ({ request }) => {
      const body = await readBody(request); if (!body) return failure(400, 'INVALID_DATA', 'Le contenu transmis est invalide.');
      return mutate(request, (data, user) => createOrder(data, user, body, request.headers.get('Idempotency-Key')));
    }),
    http.post('*/api/orders/:id/cancel', ({ request, params }) => mutate(request, (data, user) => cancelOrder(data, user, String(params.id)))),
    http.post('*/api/orders/:id/payment-attempts', async ({ request, params }) => {
      const body = await readBody(request); if (!body) return failure(400, 'INVALID_DATA', 'Le contenu transmis est invalide.');
      return mutate(request, (data, user) => createPayment(data, user, String(params.id), body, request.headers.get('Idempotency-Key')));
    }),
    http.post('*/api/demo/payments/:id/result', async ({ request, params }) => {
      const body = await readBody(request); if (!body) return failure(400, 'INVALID_DATA', 'Le contenu transmis est invalide.');
      return mutate(request, (data, user) => paymentResult(data, user, String(params.id), body.result));
    }),
    http.post('*/api/admin/orders/:id/delivery', async ({ request, params }) => {
      const body = await readBody(request); if (!body) return failure(400, 'INVALID_DATA', 'Le contenu transmis est invalide.');
      return mutate(request, (data, user) => planDelivery(data, user, String(params.id), body));
    }),
    http.post('*/api/admin/orders/:id/delivery-transition', async ({ request, params }) => {
      const body = await readBody(request); if (!body) return failure(400, 'INVALID_DATA', 'Le contenu transmis est invalide.');
      return mutate(request, (data, user) => transitionDelivery(data, user, String(params.id), body));
    }),
    http.post('*/api/orders/:id/accept-reception', ({ request, params }) => mutate(request, (data, user) => acceptReception(data, user, String(params.id)))),
    http.post('*/api/admin/orders/:id/remind', ({ request, params }) => mutate(request, (data, user) => remindReception(data, user, String(params.id)))),
    http.post('*/api/orders/:id/disputes', async ({ request, params }) => {
      const body = await readBody(request); if (!body) return failure(400, 'INVALID_DATA', 'Le contenu transmis est invalide.');
      return mutate(request, (data, user) => openDispute(data, user, String(params.id), body));
    }),
    http.get('*/api/disputes/:id', ({ request, params }) => {
      const user = requireUser(request); if (!user) return failure(401, 'UNAUTHENTICATED', 'Choisissez un profil pour continuer.');
      const data = load().data!; const dispute = data.disputes.find(item => item.id === params.id);
      const order = dispute && data.orders.find(item => item.id === dispute.orderId);
      if (!dispute || !order || !canAccessOrder(user, order)) return failure(404, 'NOT_FOUND', 'Ce dossier est introuvable.');
      return HttpResponse.json({ data: { ...dispute, order: orderView(data, order), participants: data.users.filter(item => [order.buyerId, order.sellerId, 'admin'].includes(item.id)).map(item => ({ id: item.id, displayName: item.displayName })) } });
    }),
    http.post('*/api/disputes/:id/comments', async ({ request, params }) => {
      const body = await readBody(request); if (!body) return failure(400, 'INVALID_DATA', 'Le contenu transmis est invalide.');
      return mutate(request, (data, user) => commentDispute(data, user, String(params.id), body.text));
    }),
    http.post('*/api/admin/disputes/:id/review', ({ request, params }) => mutate(request, (data, user) => reviewDispute(data, user, String(params.id)))),
    http.post('*/api/admin/disputes/:id/decision', async ({ request, params }) => {
      const body = await readBody(request); if (!body) return failure(400, 'INVALID_DATA', 'Le contenu transmis est invalide.');
      return mutate(request, (data, user) => decideDispute(data, user, String(params.id), body));
    }),
    http.post('*/api/admin/disputes/:id/execute', ({ request, params }) => mutate(request, (data, user) => executeDispute(data, user, String(params.id), request.headers.get('Idempotency-Key')))),
    http.post('*/api/orders/:id/replacement-issue', async ({ request, params }) => {
      const body = await readBody(request); if (!body) return failure(400, 'INVALID_DATA', 'Le contenu transmis est invalide.');
      return mutate(request, (data, user) => replacementIssue(data, user, String(params.id), body));
    }),
    http.post('*/api/admin/orders/:id/payout', ({ request, params }) => mutate(request, (data, user) => payout(data, user, String(params.id), request.headers.get('Idempotency-Key')))),
    http.patch('*/api/notifications/:id', ({ request, params }) => mutate(request, (data, user) => {
      if (!user) throw new OperationError(401, 'UNAUTHENTICATED', 'Choisissez un profil pour continuer.');
      const notification = data.notifications.find(item => item.id === params.id && item.userId === user.id);
      if (!notification) throw new OperationError(404, 'NOT_FOUND', 'Cette notification est introuvable.');
      notification.readAt ??= new Date().toISOString(); return notification;
    })),
    http.get('*/api/admin/moderation', () => {
      const data = load().data!;
      return HttpResponse.json({ data: { users: data.users, offers: data.offers, requests: data.purchaseRequests, events: data.moderationEvents ?? [] } });
    }),
    http.patch('*/api/admin/users/:id/status', async ({ request, params }) => {
      const body = await readBody(request); if (!body) return failure(400, 'INVALID_DATA', 'Le contenu transmis est invalide.');
      return mutate(request, (data, user) => moderateUser(data, user, String(params.id), body));
    }),
    http.patch('*/api/admin/announcements/:type/:id/status', async ({ request, params }) => {
      const body = await readBody(request); if (!body) return failure(400, 'INVALID_DATA', 'Le contenu transmis est invalide.');
      return mutate(request, (data, user) => moderateAnnouncement(data, user, String(params.type), String(params.id), body));
    }),
    http.post('*/api/demo/force-error', ({ request }) => {
      const user = requireUser(request); if (!user || user.role !== 'admin') return failure(user ? 403 : 401, user ? 'FORBIDDEN' : 'UNAUTHENTICATED', 'Action réservée à l’administration.');
      forceNextError = true; return HttpResponse.json({ data: { armed: true } });
    }),
    http.post('*/api/demo/orders/:id/expire', ({ request, params }) => mutate(request, (data, user) => expireOrder(data, user, String(params.id)))),
    http.post('*/api/demo/logout', ({ request }) => {
      const user = requireUser(request);
      return user ? HttpResponse.json({ data: { loggedOut: true } }) : failure(401, 'UNAUTHENTICATED', 'Aucun profil actif.');
    }),
    http.post('*/api/demo/reset', async ({ request }) => {
      const user = requireUser(request) ?? demoProfiles.find(p => p.id === request.headers.get('X-Demo-User-Id')); const body = await readBody(request);
      if (!user || user.role !== 'admin') return failure(user ? 403 : 401, user ? 'FORBIDDEN' : 'UNAUTHENTICATED', 'Action réservée à l’administration.');
      if (body?.confirm !== true) return failure(400, 'CONFIRMATION_REQUIRED', 'Confirmez explicitement la réinitialisation.');
      const result = repository.reset();
      return result.error ? failure(503, result.error, 'Les données n’ont pas pu être réinitialisées.') : HttpResponse.json({ data: { reset: true } });
    }),
    http.get('*/api/demo/emails', ({ request }) => {
      const user = requireUser(request); if (!user || user.role !== 'admin') return failure(user ? 403 : 401, user ? 'FORBIDDEN' : 'UNAUTHENTICATED', 'Action réservée à l’administration.');
      return HttpResponse.json({ data: load().data?.emails ?? [] });
    }),
    http.all('*/api/*', () => failure(501, 'NOT_FOUND', 'Cette route API n’est pas disponible.')),
  ];
}

