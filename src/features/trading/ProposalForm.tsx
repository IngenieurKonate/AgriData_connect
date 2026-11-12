import { useState } from 'react';
import { Button, Field, SelectField, TextAreaField } from '../../components/ui';
import type { Proposal } from '../../domain/types';
import type { OfferView } from '../../services/contracts';
import { useAction } from '../../services/useApi';
import { Feedback, money } from '../purchase/shared';

export interface ProposalInput { offerId: string; quantityKg: number; pricePerKgCents: number; qualityNotes: string }
export function ProposalForm({ offers, previous, requestedKg, onSubmit, onCancel }: { offers: OfferView[]; previous?: Proposal; requestedKg?: number; onSubmit: (input: ProposalInput) => Promise<void>; onCancel?: () => void }) {
  const choices = offers.filter(offer => offer.status === 'published' && offer.availableKg >= offer.minimumOrderKg && (requestedKg === undefined || requestedKg >= offer.minimumOrderKg));
  const initial = choices.find(offer => offer.id === previous?.offerId) ?? choices[0];
  const [offerId, setOfferId] = useState(initial?.id ?? '');
  const [quantity, setQuantity] = useState(previous?.quantityKg ?? (initial ? Math.min(requestedKg ?? Math.max(500, initial.minimumOrderKg), initial.availableKg) : 0));
  const [price, setPrice] = useState((previous?.pricePerKgCents ?? initial?.pricePerKgCents ?? 0) / 100);
  const [notes, setNotes] = useState(previous?.qualityNotes ?? '');
  const action = useAction();
  const offer = choices.find(item => item.id === offerId);
  if (!initial) return <p className="notice">Aucun lot disponible ne correspond à ce besoin. Publiez un lot du bon produit ou ajustez son stock avant de proposer vos conditions.</p>;
  const maximum = Math.min(offer?.availableKg ?? 0, requestedKg ?? Infinity);
  return <form className="proposal-form" onSubmit={event => { event.preventDefault(); void action.run(() => onSubmit({ offerId, quantityKg: quantity, pricePerKgCents: Math.round(price * 100), qualityNotes: notes })); }}><fieldset disabled={action.pending}>
    <SelectField id="proposal-offer" label="Lot proposé" value={offerId} required onChange={event => { const item = choices.find(item => item.id === event.target.value)!; setOfferId(item.id); setPrice(item.pricePerKgCents / 100); setQuantity(Math.min(requestedKg ?? Math.max(500, item.minimumOrderKg), item.availableKg)); }}>{choices.map(item => <option key={item.id} value={item.id}>{item.title} · {item.availableKg} kg · {money(item.pricePerKgCents)}/kg</option>)}</SelectField>
    <div className="form-grid"><Field id="proposal-quantity" label="Quantité proposée (kg)" type="number" min={offer?.minimumOrderKg} max={maximum} step="1" required value={quantity} onChange={event => setQuantity(Number(event.target.value))} /><Field id="proposal-price" label="Prix proposé (MAD/kg)" type="number" min="0.01" step="0.01" required value={price} onChange={event => setPrice(Number(event.target.value))} /></div>
    <TextAreaField id="proposal-notes" label="Conditions de qualité convenues" maxLength={1000} rows={3} value={notes} onChange={event => setNotes(event.target.value)} />
    <p className="muted">L’accord ne réserve pas de stock. La disponibilité sera vérifiée à la commande.</p><Feedback error={action.error} /><div className="action-row"><Button variant="primary" type="submit">{action.pending ? 'Envoi…' : previous ? 'Envoyer la contre-proposition' : 'Envoyer la proposition'}</Button>{onCancel && <Button type="button" onClick={onCancel}>Annuler</Button>}</div>
  </fieldset></form>;
}
