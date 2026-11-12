import type { BusinessData, OrderRecord } from './types';

export function financialSummary(data: BusinessData, order: OrderRecord) {
  const paidCents = data.paymentAttempts.filter(item => item.orderId === order.id && item.status === 'succeeded').reduce((sum, item) => sum + item.amountCents, 0);
  const refunds = data.refunds.filter(item => item.orderId === order.id);
  const dispute = data.disputes.find(item => item.id === order.disputeId);
  const refundedCents = refunds.reduce((sum, item) => sum + item.amountCents, 0);
  const refundedGoodsCents = refunds.reduce((sum, item) => sum + (item.goodsCents ?? (item.amountCents === order.totalCents ? order.goodsCents : dispute?.refundGoodsCents ?? 0)), 0);
  const refundedDeliveryCents = refundedCents - refundedGoodsCents;
  const retainedGoodsCents = paidCents > 0 ? order.goodsCents - refundedGoodsCents : 0;
  const retainedDeliveryCents = paidCents > 0 ? order.deliveryCents - refundedDeliveryCents : 0;
  const commissionCents = Math.round(retainedGoodsCents * order.commissionRateBps / 10000);
  const netCents = retainedGoodsCents - commissionCents;
  const payout = data.payouts.find(item => item.orderId === order.id);
  const paidToSellerCents = payout?.status === 'paid' ? payout.netCents : 0;
  return { paidCents, refundedCents, refundedGoodsCents, refundedDeliveryCents, retainedGoodsCents, retainedDeliveryCents, commissionCents, netCents, paidToSellerCents, remainingToSellerCents: netCents - paidToSellerCents, balanced: paidCents - refundedCents === netCents + commissionCents + retainedDeliveryCents };
}
export function dashboard(data: BusinessData) {
  const totals = data.orders.map(order => financialSummary(data, order));
  const sum = (key: 'paidCents' | 'refundedCents' | 'retainedDeliveryCents' | 'commissionCents' | 'paidToSellerCents' | 'remainingToSellerCents') => totals.reduce((value, item) => value + item[key], 0);
  return { orders: data.orders.length, activeOrders: data.orders.filter(item => item.status === 'active').length, openDisputes: data.disputes.filter(item => item.status !== 'resolved').length, pendingPayments: data.orders.filter(item => item.status === 'active' && ['pending', 'failed'].includes(item.paymentStatus)).length, publishedOffers: data.offers.filter(item => item.status === 'published').length, collections: data.orders.filter(order => order.status === 'active' && order.paymentStatus === 'paid' && ['not_started', 'scheduled'].includes(data.deliveryCycles.find(item => item.id === order.currentDeliveryCycleId)?.status ?? 'not_started')).length, readyPayouts: data.payouts.filter(item => item.status === 'ready').length, paidCents: sum('paidCents'), refundedCents: sum('refundedCents'), retainedDeliveryCents: sum('retainedDeliveryCents'), commissionCents: sum('commissionCents'), paidToSellerCents: sum('paidToSellerCents'), remainingToSellerCents: sum('remainingToSellerCents') };
}
