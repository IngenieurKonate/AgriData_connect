import type { BusinessData } from '../../domain/types';
import { financialSummary } from '../../domain/finance';
import { createInitialData, SCHEMA_VERSION } from '../seed/seedData';

export const BUSINESS_STORAGE_KEY = 'agridataconnect.demo.v1';

export type RepositoryErrorCode = 'STORAGE_UNAVAILABLE' | 'DATA_CORRUPT' | 'SCHEMA_VERSION_MISMATCH';
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export interface RepositoryResult { data: BusinessData | null; error: RepositoryErrorCode | null; persistent: boolean }

export function getLocalStorage(): StoragePort | null {
  try { return window.localStorage; }
  catch { return null; }
}

export function isBusinessData(value: unknown): value is BusinessData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BusinessData>;
  const collections: (keyof BusinessData)[] = [
    'users', 'offers', 'purchaseRequests', 'conversations', 'messages', 'proposals', 'orders',
    'reservations', 'stockMovements', 'paymentAttempts', 'deliveryCycles', 'events', 'disputes',
    'refunds', 'payouts', 'notifications', 'emails', 'transportPartners',
  ];
  return Number.isInteger(candidate.config?.schemaVersion)
    && typeof candidate.config?.seedAnchorTime === 'string'
    && collections.every(key => Array.isArray(candidate[key]));
}

export class DemoRepository {
  private readonly storage: StoragePort | null;
  private readonly key: string;
  private current: BusinessData | null = null;
  private status: RepositoryErrorCode | null = null;

  constructor(storage: StoragePort | null = getLocalStorage(), key = BUSINESS_STORAGE_KEY) {
    this.storage = storage;
    this.key = key;
  }

  load(): RepositoryResult {
    if (!this.storage) return this.result(null, 'STORAGE_UNAVAILABLE', false);
    let serialized: string | null;
    try { serialized = this.storage.getItem(this.key); }
    catch { return this.result(null, 'STORAGE_UNAVAILABLE', false); }

    if (serialized === null) return this.initialize();
    let value: unknown;
    try { value = JSON.parse(serialized); }
    catch { return this.result(null, 'DATA_CORRUPT', true); }
    if (!isBusinessData(value)) return this.result(null, 'DATA_CORRUPT', true);
    if (value.config.schemaVersion !== SCHEMA_VERSION) return this.result(null, 'SCHEMA_VERSION_MISMATCH', true);
    let dataUpdated = false;
    if (value.config.commissionRateBps !== 300) {
      value.config.commissionRateBps = 300;
      dataUpdated = true;
    }
    for (const order of value.orders) {
      if (order.commissionRateBps !== 300 || order.pricing.commissionRateBps !== 300) dataUpdated = true;
      order.commissionRateBps = 300;
      order.pricing.commissionRateBps = 300;
    }
    for (const payout of value.payouts) {
      const order = value.orders.find(item => item.id === payout.orderId);
      if (!order) continue;
      const summary = financialSummary(value, order);
      if (payout.commissionCents !== summary.commissionCents || payout.netCents !== summary.netCents) dataUpdated = true;
      payout.commissionCents = summary.commissionCents;
      payout.netCents = summary.netCents;
    }
    const amane = value.users.find(user => user.id === 'farmer-farm');
    if (amane) {
      dataUpdated ||= amane.city !== 'Tanger' || amane.address.includes('Meknès');
      amane.city = 'Tanger';
      amane.address = amane.address.replace('Meknès', 'Tanger');
    }
    for (const offer of value.offers) {
      if (offer.sellerId !== 'farmer-farm') continue;
      dataUpdated ||= offer.city !== 'Tanger' || offer.collectionAddress.includes('Meknès');
      offer.city = 'Tanger';
      offer.collectionAddress = offer.collectionAddress.replace('Meknès', 'Tanger');
    }
    for (const order of value.orders) {
      if (order.sellerId !== 'farmer-farm') continue;
      dataUpdated ||= order.sellerAddress.city !== 'Tanger' || order.sellerAddress.address.includes('Meknès');
      order.sellerAddress.city = 'Tanger';
      order.sellerAddress.address = order.sellerAddress.address.replace('Meknès', 'Tanger');
    }
    try { if (dataUpdated) this.storage.setItem(this.key, JSON.stringify(value)); }
    catch { /* The updated location remains available for this session. */ }
    this.current = value;
    this.status = null;
    return this.result(value, null, true);
  }

  snapshot(): RepositoryResult {
    if (!this.current) return this.result(null, this.status ?? 'DATA_CORRUPT', Boolean(this.storage));
    return this.result(structuredClone(this.current), this.status, Boolean(this.storage));
  }

  update<T>(mutator: (draft: BusinessData) => T): { result: T; data: BusinessData } {
    if (!this.current) throw new RepositoryOperationError(this.status ?? 'DATA_CORRUPT');
    if (!this.storage) throw new RepositoryOperationError('STORAGE_UNAVAILABLE');
    const previous = this.current;
    const next = structuredClone(previous);
    const operationResult = mutator(next);
    const serialized = JSON.stringify(next);
    try { this.storage.setItem(this.key, serialized); }
    catch { throw new RepositoryOperationError('STORAGE_UNAVAILABLE'); }
    this.current = next;
    this.status = null;
    return { result: operationResult, data: structuredClone(next) };
  }

  reset(anchor = Date.now()): RepositoryResult {
    if (!this.storage) return this.result(this.current ? structuredClone(this.current) : null, 'STORAGE_UNAVAILABLE', false);
    const previous = this.current;
    const next = createInitialData(anchor);
    try { this.storage.setItem(this.key, JSON.stringify(next)); }
    catch {
      this.current = previous;
      return this.result(previous ? structuredClone(previous) : null, 'STORAGE_UNAVAILABLE', true);
    }
    this.current = next;
    this.status = null;
    return this.result(structuredClone(next), null, true);
  }

  clear(): void {
    if (!this.storage) throw new RepositoryOperationError('STORAGE_UNAVAILABLE');
    this.storage.removeItem(this.key);
    this.current = null;
  }

  private initialize(): RepositoryResult {
    if (!this.storage) return this.result(null, 'STORAGE_UNAVAILABLE', false);
    const next = createInitialData();
    try { this.storage.setItem(this.key, JSON.stringify(next)); }
    catch { return this.result(next, 'STORAGE_UNAVAILABLE', false); }
    this.current = next;
    this.status = null;
    return this.result(structuredClone(next), null, true);
  }

  private result(data: BusinessData | null, error: RepositoryErrorCode | null, persistent: boolean): RepositoryResult {
    this.status = error;
    return { data, error, persistent };
  }
}

export class RepositoryOperationError extends Error {
  constructor(public readonly code: RepositoryErrorCode) {
    super(code);
    this.name = 'RepositoryOperationError';
  }
}
