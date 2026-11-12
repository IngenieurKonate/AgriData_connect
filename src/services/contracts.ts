import type { Conversation, Message, Proposal, PurchaseRequest, DeliveryCycle, DisputeRecord, RefundRecord, OfferRecord, OrderEvent, OrderRecord, PaymentAttempt, PayoutRecord, TransportPartner, UserRecord, ModerationEvent } from '../domain/types';
import type { dashboard, financialSummary } from '../domain/finance';

export interface OfferView extends OfferRecord { availableKg: number; sellerName: string }
export interface ConversationSummary extends Conversation { title: string; buyerName: string; sellerName: string; lastMessage?: Message; proposalCount: number }
export interface ConversationView extends ConversationSummary { messages: Message[]; proposals: Proposal[]; offers: OfferView[]; request?: PurchaseRequest }
export interface ProposalView extends Proposal { offer: OfferView }
export interface QuoteView {
  offerId: string; proposalId?: string; offerVersion: number; quantityKg: number; pricePerKgCents: number;
  goodsCents: number; deliveryCents: number; totalCents: number; commissionCents: number; netCents: number;
}
export interface OrderView extends OrderRecord {
  events: OrderEvent[]; deliveryCycles: DeliveryCycle[]; attempts: PaymentAttempt[];
  payout?: PayoutRecord; transportPartners: TransportPartner[];
  dispute?: DisputeRecord; refunds: RefundRecord[]; financial: ReturnType<typeof financialSummary>;
}
export interface DisputeView extends DisputeRecord { order: OrderView; participants: Pick<UserRecord, 'id' | 'displayName'>[] }
export interface PayoutView extends PayoutRecord { orderReference: string; blockReason: string }
export interface FinanceView { attempts: PaymentAttempt[]; refunds: RefundRecord[]; payouts: PayoutView[]; orders: OrderRecord[]; totals: ReturnType<typeof dashboard> }
export interface ModerationView { users: UserRecord[]; offers: OfferRecord[]; requests: PurchaseRequest[]; events: ModerationEvent[] }
