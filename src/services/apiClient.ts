import { readSession } from './demoSession';
import type { ConversationSummary, ConversationView, OfferView, OrderView, QuoteView } from './contracts';
import type { Conversation, OfferRecord, OrderRecord, PaymentAttempt, Proposal, PurchaseRequest } from '../domain/types';

export interface ApiFailure { code: string; message: string; fieldErrors?: Record<string, string> }
let activeRequests = 0;
export const hasPendingApiRequests = () => activeRequests > 0;
const signal = (name: string) => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(name)); };
export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  const profileId = readSession();
  if (profileId) headers.set('X-Demo-User-Id', profileId);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  activeRequests += 1;
  signal('api-pending');
  try {
    const response = await fetch(path.startsWith('/api/') ? path : `/api/${path.replace(/^\/+/, '')}`, { ...init, headers });
    const payload = await response.json().catch(() => null) as { data?: T; error?: ApiFailure } | null;
    if (!response.ok || !payload || !('data' in payload)) {
      const error = payload?.error;
      throw new ApiError(response.status, error?.code ?? 'INVALID_RESPONSE', error?.message ?? 'La réponse du service est invalide.', error?.fieldErrors);
    }
    if (init.method && init.method !== 'GET') signal('business-updated');
    return payload.data as T;
  } finally {
    activeRequests -= 1;
    signal('api-pending');
  }
}

export const api = {
  createOffer: (input: unknown) => apiRequest<OfferRecord>('offers', { method: 'POST', body: JSON.stringify(input) }),
  updateOffer: (id: string, input: unknown) => apiRequest<OfferRecord>(`offers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  profiles: () => apiRequest('/demo/profiles'),
  me: () => apiRequest('me'),
  offers: (query = '') => apiRequest<OfferView[]>(`offers${query ? `?${query}` : ''}`),
  offer: (id: string) => apiRequest<OfferView>(`offers/${encodeURIComponent(id)}`),
  requests: () => apiRequest<PurchaseRequest[]>('requests'),
  request: (id: string) => apiRequest<PurchaseRequest>(`requests/${encodeURIComponent(id)}`),
  createRequest: (input: unknown) => apiRequest<PurchaseRequest>('requests', { method: 'POST', body: JSON.stringify(input) }),
  updateRequest: (id: string, input: unknown) => apiRequest<PurchaseRequest>(`requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  conversations: () => apiRequest<ConversationSummary[]>('conversations'),
  conversation: (id: string) => apiRequest<ConversationView>(`conversations/${encodeURIComponent(id)}`),
  createConversation: (input: unknown) => apiRequest<Conversation>('conversations', { method: 'POST', body: JSON.stringify(input) }),
  sendMessage: (id: string, text: string) => apiRequest(`conversations/${encodeURIComponent(id)}/messages`, { method: 'POST', body: JSON.stringify({ text }) }),
  createProposal: (id: string, input: unknown) => apiRequest<Proposal>(`conversations/${encodeURIComponent(id)}/proposals`, { method: 'POST', body: JSON.stringify(input) }),
  respondToProposal: (id: string, accept: boolean) => apiRequest<Proposal>(`proposals/${encodeURIComponent(id)}/${accept ? 'accept' : 'reject'}`, { method: 'POST' }),
  quote: (input: unknown) => apiRequest<QuoteView>('quotes', { method: 'POST', body: JSON.stringify(input) }),
  orders: () => apiRequest<OrderRecord[]>('orders'),
  order: (id: string) => apiRequest<OrderView>(`orders/${encodeURIComponent(id)}`),
  createOrder: (input: unknown, key: string) => apiRequest<OrderRecord>('orders', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(input) }),
  cancelOrder: (id: string) => apiRequest(`orders/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  createPaymentAttempt: (id: string, method: 'naps' | 'cash_plus', key: string) => apiRequest<PaymentAttempt>(`orders/${encodeURIComponent(id)}/payment-attempts`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ method }) }),
  paymentResult: (id: string, result: 'success' | 'failure') => apiRequest(`demo/payments/${encodeURIComponent(id)}/result`, { method: 'POST', body: JSON.stringify({ result }) }),
  scheduleDelivery: (id: string, input: unknown) => apiRequest(`admin/orders/${encodeURIComponent(id)}/delivery`, { method: 'POST', body: JSON.stringify(input) }),
  transitionDelivery: (id: string, status: string) => apiRequest(`admin/orders/${encodeURIComponent(id)}/delivery-transition`, { method: 'POST', body: JSON.stringify({ status }) }),
  acceptReception: (id: string) => apiRequest(`orders/${encodeURIComponent(id)}/accept-reception`, { method: 'POST' }),
  openDispute: (id: string, input: unknown) => apiRequest(`orders/${encodeURIComponent(id)}/disputes`, { method: 'POST', body: JSON.stringify(input) }),
  commentDispute: (id: string, text: string) => apiRequest(`disputes/${encodeURIComponent(id)}/comments`, { method: 'POST', body: JSON.stringify({ text }) }),
  reviewDispute: (id: string) => apiRequest(`admin/disputes/${encodeURIComponent(id)}/review`, { method: 'POST' }),
  decideDispute: (id: string, input: unknown) => apiRequest(`admin/disputes/${encodeURIComponent(id)}/decision`, { method: 'POST', body: JSON.stringify(input) }),
  executeDispute: (id: string, key: string) => apiRequest(`admin/disputes/${encodeURIComponent(id)}/execute`, { method: 'POST', headers: { 'Idempotency-Key': key } }),
  payout: (id: string, key: string) => apiRequest(`admin/orders/${encodeURIComponent(id)}/payout`, { method: 'POST', headers: { 'Idempotency-Key': key } }),
  notifications: () => apiRequest('notifications'),
  payouts: () => apiRequest('payouts'),
  adminDashboard: () => apiRequest('admin/dashboard'),
  adminPayments: () => apiRequest('admin/payments'),
  adminDisputes: () => apiRequest('admin/disputes'),
  adminUsers: () => apiRequest('admin/users'),
  adminOffers: () => apiRequest('admin/offers'),
  dispute: (id: string) => apiRequest(`disputes/${encodeURIComponent(id)}`),
};
