export type Role = 'buyer' | 'farmer' | 'admin';

export interface DemoProfile {
  id: string;
  role: Role;
  displayName: string;
  organization: string;
  city: string;
  address: string;
  email: string;
  initials: string;
  description: string;
}

export type UserStatus = 'active' | 'suspended';
export type Product = 'tomato' | 'onion';
export type OfferStatus = 'published' | 'disabled' | 'suspended';
export type RequestStatus = 'open' | 'ordered' | 'closed' | 'suspended';
export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'superseded' | 'invalidated';
export type StockRecordStatus = 'active' | 'consumed' | 'released';
export type PaymentMethod = 'naps' | 'cash_plus';
export type PaymentAttemptStatus = 'pending' | 'failed' | 'succeeded' | 'invalidated';
export type DisputeResolution = 'full_refund' | 'partial_refund' | 'replacement';
export type CommentAuthorRole = Role;

export interface UserRecord {
  id: string; role: Role; displayName: string; buyerType?: 'professional' | 'private';
  organization?: string; description?: string; email: string; phone: string; city: string; address: string; status: UserStatus;
}
export interface OfferRecord {
  id: string; sellerId: string; product: Product; title: string; description: string; grade: string;
  pricePerKgCents: number; stockRemainingKg: number; minimumOrderKg: number; city: string;
  collectionAddress: string; imageIds: string[]; status: OfferStatus; version: number; createdAt: string;
}
export interface PurchaseRequest {
  id: string; buyerId: string; product: Product; quantityKg: number; grade: string; destination: string;
  desiredDate: string; targetPriceCents?: number; description: string; status: RequestStatus; orderId?: string;
  createdAt: string; statusBeforeSuspension?: 'open' | 'ordered' | 'closed';
}
export interface Conversation { id: string; buyerId: string; sellerId: string; offerId?: string; requestId?: string; createdAt: string }
export interface Message { id: string; conversationId: string; senderId: string; text: string; createdAt: string }
export interface Proposal {
  id: string; conversationId: string; offerId: string; requestId?: string; authorId: string; recipientId: string;
  quantityKg: number; pricePerKgCents: number; qualityNotes: string; status: ProposalStatus; orderId?: string; createdAt: string;
}
export interface AddressSnapshot { city: string; address: string }
export interface OrderSnapshot { product: Product; title: string; grade: string; sellerName: string; imageId: string }
export interface PricingSnapshot { deliveryBaseCents: number; deliveryPerKgCents: number; commissionRateBps: number }
export interface OrderRecord {
  id: string; reference: string; buyerId: string; sellerId: string; offerId: string; proposalId?: string; requestId?: string;
  idempotencyKey?: string;
  item: OrderSnapshot; buyerAddress: AddressSnapshot; sellerAddress: AddressSnapshot;
  quantityKg: number; goodsCents: number; deliveryCents: number; totalCents: number;
  pricing: PricingSnapshot; qualityNotes?: string; commissionRateBps: number; status: OrderStatus; paymentStatus: PaymentStatus;
  currentDeliveryCycleId?: string; disputeId?: string; createdAt: string; updatedAt: string;
}
export interface StockReservation { id: string; orderId: string; offerId: string; quantityKg: number; status: StockRecordStatus; createdAt: string }
export interface StockMovement { id: string; offerId: string; orderId?: string; type: 'sale' | 'replacement' | 'adjustment'; quantityKg: number; createdAt: string }
export interface PaymentAttempt {
  id: string; orderId: string; method: PaymentMethod; status: PaymentAttemptStatus; reference: string;
  amountCents: number; idempotencyKey: string; createdAt: string; confirmedAt?: string;
}
export interface TransportPartner { id: string; name: string; contact: string }
export interface DeliveryCycle {
  id: string; orderId: string; cycleNumber: number; quantityKg: number; partnerId?: string;
  collectionPlannedAt?: string; arrivalEstimatedAt?: string; status: DeliveryStatus;
}
export interface OrderEvent {
  id: string; orderId: string; actorId?: string; type: string; label: string; details: string;
  deliveryCycleId?: string; createdAt: string;
}
export interface DisputeComment { id: string; authorId: string; authorRole: CommentAuthorRole; text: string; createdAt: string }
export interface DisputeRecord {
  id: string; orderId: string; reason: 'non_conforming' | 'missing_quantity' | 'damaged' | 'other';
  description: string; evidenceImageIds: string[]; status: DisputeStatus; resolutionType?: DisputeResolution;
  decisionNote?: string; refundGoodsCents?: number; refundDeliveryCents?: number;
  replacementQuantityKg?: number; replacementCycleId?: string; replacementExecutionKey?: string; replacementIssueAt?: string; comments: DisputeComment[]; createdAt: string;
}
export interface RefundRecord {
  id: string; orderId: string; disputeId: string; amountCents: number; goodsCents?: number; deliveryCents?: number; reference: string; idempotencyKey: string; executedAt: string;
}
export interface PayoutRecord {
  id: string; orderId: string; sellerId: string; status: PayoutStatus; netCents: number;
  commissionCents: number; reference?: string; idempotencyKey?: string; paidAt?: string;
}
export interface NotificationRecord {
  id: string; userId: string; type: string; text: string; targetPath: string; readAt?: string; createdAt: string;
}
export interface ActivityEvent {
  id: string; recipientUserId: string; subject: string; body: string; sourceEventId: string; createdAt: string;
}
export interface ModerationEvent {
  id: string; actorId: string; targetType: 'user' | 'offer' | 'request'; targetId: string;
  previousStatus: string; nextStatus: string; reason: string; createdAt: string;
}
export interface DemoConfig {
  schemaVersion: number; seedVersion: number; seedAnchorTime: string;
  commissionRateBps: number; deliveryBaseCents: number; deliveryPerKgCents: number;
}
export interface BusinessData {
  config: DemoConfig; users: UserRecord[]; offers: OfferRecord[]; purchaseRequests: PurchaseRequest[];
  conversations: Conversation[]; messages: Message[]; proposals: Proposal[]; orders: OrderRecord[];
  reservations: StockReservation[]; stockMovements: StockMovement[]; paymentAttempts: PaymentAttempt[];
  deliveryCycles: DeliveryCycle[]; events: OrderEvent[]; disputes: DisputeRecord[]; refunds: RefundRecord[];
  payouts: PayoutRecord[]; notifications: NotificationRecord[]; emails: ActivityEvent[]; transportPartners: TransportPartner[];
  moderationEvents?: ModerationEvent[];
}

export type OrderStatus = 'active' | 'cancelled' | 'closed';
export type PaymentStatus = 'pending' | 'failed' | 'paid' | 'partially_refunded' | 'refunded';
export type DeliveryStatus = 'not_started' | 'scheduled' | 'collected' | 'in_transit' | 'handover_reported' | 'accepted';
export type DisputeStatus = 'open' | 'reviewing' | 'decision_recorded' | 'resolved';
export type PayoutStatus = 'blocked' | 'ready' | 'paid' | 'not_applicable';
