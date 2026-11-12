import type { ReactNode } from 'react';
import { Button } from '../../components/ui';
import { producePhoto } from '../../assets/produce';

export const money = (cents: number) => `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)} MAD`;
export const date = (value: string) => new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
export const labels: Record<string, string> = {
  active: 'En cours', closed: 'Clôturée', cancelled: 'Annulée', pending: 'En attente', failed: 'Refusé', paid: 'Payé',
  succeeded: 'Confirmé', invalidated: 'Remplacée', scheduled: 'Collecte planifiée', collected: 'Produits récupérés',
  in_transit: 'En livraison', handover_reported: 'Remise signalée', accepted: 'Réception conforme', not_started: 'À planifier',
  blocked: 'Bloqué', ready: 'À verser', not_applicable: 'Aucun versement', refunded: 'Remboursé', partially_refunded: 'Partiellement remboursé',
};
export function Feedback({ loading, error, retry, children }: { loading?: boolean; error?: string | null; retry?: () => void; children?: ReactNode }) {
  if (loading) return <p role="status" className="panel purchase-panel">Chargement des informations…</p>;
  if (error) return <div className="notice error-notice" role="alert"><p>{error}</p>{retry && <Button onClick={retry}>Réessayer</Button>}</div>;
  return <>{children}</>;
}
export function Totals({ goodsCents, deliveryCents, totalCents }: { goodsCents: number; deliveryCents: number; totalCents: number }) {
  return <dl className="amounts"><div><dt>Montant des produits</dt><dd>{money(goodsCents)}</dd></div><div><dt>Livraison</dt><dd>{money(deliveryCents)}</dd></div><div className="amount-total"><dt>Total à payer</dt><dd>{money(totalCents)}</dd></div></dl>;
}
export function ProduceVisual({ product, offerId, imageId }: { product: 'tomato' | 'onion'; offerId: string; imageId?: string }) {
  const photo = producePhoto(offerId, product, imageId);
  return <div className={`produce-visual${photo.contained ? ' produce-contained' : ''}`}><img src={`/produce/${photo.file}`} alt={photo.alt} loading="lazy" decoding="async" /></div>;
}
