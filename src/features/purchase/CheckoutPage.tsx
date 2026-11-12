import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ActionLink, Button, Field, PageHeading } from '../../components/ui';
import type { UserRecord } from '../../domain/types';
import { api } from '../../services/apiClient';
import type { OfferView, ProposalView, QuoteView } from '../../services/contracts';
import { useAction, useApi } from '../../services/useApi';
import { Feedback, money, Totals } from './shared';

export function CheckoutPage() {
  const [params] = useSearchParams();
  const proposalId = params.get('proposition');
  const offerId = params.get('offre');
  const offerResult = useApi<OfferView>(offerId && !proposalId ? `offers/${encodeURIComponent(offerId)}` : null);
  const proposalResult = useApi<ProposalView>(proposalId ? `proposals/${encodeURIComponent(proposalId)}` : null);
  const userResult = useApi<UserRecord>('me');
  const [quantity, setQuantity] = useState(500);
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [quote, setQuote] = useState<QuoteView | null>(null);
  const key = useRef(crypto.randomUUID());
  const action = useAction();
  const navigate = useNavigate();
  useEffect(() => { if (userResult.data) { setCity(userResult.data.city); setAddress(userResult.data.address); } }, [userResult.data]);
  useEffect(() => { if (offerResult.data) setQuantity(Math.max(500, offerResult.data.minimumOrderKg)); }, [offerResult.data]);
  useEffect(() => { setQuote(null); key.current = crypto.randomUUID(); }, [offerId, proposalId]);
  const proposal = proposalResult.data;
  const offer = proposalId ? proposal?.offer : offerResult.data;
  const effectiveQuantity = proposal?.quantityKg ?? quantity;
  const invalidate = () => { setQuote(null); key.current = crypto.randomUUID(); };
  const reload = () => { invalidate(); offerResult.reload(); proposalResult.reload(); };
  const valid = offer && Number.isInteger(effectiveQuantity) && effectiveQuantity >= offer.minimumOrderKg && effectiveQuantity <= offer.availableKg && offer.status === 'published' && (!proposalId || proposal?.status === 'accepted' && !proposal.orderId);
  const input = () => proposalId ? { proposalId } : { offerId: offer!.id, quantityKg: quantity, expectedOfferVersion: offer!.version };
  return <><PageHeading eyebrow="Votre achat" title="Nouvelle commande" description="Vérifiez la quantité, les adresses et le total avant de réserver le lot." />
    {!offerId && !proposalId ? <section className="panel purchase-panel"><h2>Choisissez d’abord un lot</h2><ActionLink to="/offres">Consulter le catalogue</ActionLink></section> : <Feedback loading={offerResult.loading || proposalResult.loading || userResult.loading} error={offerResult.error ?? proposalResult.error ?? userResult.error} retry={() => { reload(); userResult.reload(); }}>
      {proposal?.orderId ? <section className="panel purchase-panel"><h2>Cet accord a déjà produit une commande</h2><ActionLink to={`/commandes/${proposal.orderId}`}>Voir la commande liée</ActionLink></section> : proposal && proposal.status !== 'accepted' ? <section className="panel purchase-panel"><h2>Cette proposition ne peut pas être commandée</h2><p>Retrouvez l’état de l’accord dans votre conversation.</p><ActionLink to={`/messages/${proposal.conversationId}`}>Revenir à la conversation</ActionLink></section> : offer && <div className="purchase-grid">
        <section className="panel purchase-panel"><h2>{offer.title}</h2><p>{offer.grade} · {money(proposal?.pricePerKgCents ?? offer.pricePerKgCents)} / kg · {offer.sellerName}</p>
          <form onSubmit={event => { event.preventDefault(); void action.run(async () => { setQuote(null); setQuote(await api.quote(input())); }); }}><fieldset disabled={action.pending}>
            <Field id="quantity" label="Quantité (kg)" type="number" min={offer.minimumOrderKg} max={offer.availableKg} step={1} required readOnly={Boolean(proposalId)} value={effectiveQuantity} onChange={event => { setQuantity(Number(event.target.value)); invalidate(); }} />
            {proposal && <><p className="notice">Prix et quantité fixés par votre accord. Toute modification exige une nouvelle proposition.</p><p className="preserve-text">{proposal.qualityNotes}</p><ActionLink to={`/messages/${proposal.conversationId}`}>Revenir à la négociation</ActionLink></>}
            <p className="muted">Minimum {offer.minimumOrderKg} kg · Disponible {offer.availableKg} kg</p>{!valid && <p role="alert">La quantité doit être entière, comprise entre le minimum et le disponible, pour un lot actif.</p>}
            <h3>Adresse de livraison</h3><Field id="delivery-city" label="Ville de livraison" required maxLength={120} value={city} onChange={event => { setCity(event.target.value); invalidate(); }} /><Field id="delivery-address" label="Adresse de livraison" required maxLength={200} value={address} onChange={event => { setAddress(event.target.value); invalidate(); }} /><h3>Adresse de collecte</h3><p>{offer.collectionAddress}, {offer.city}</p><Button variant="primary" type="submit" disabled={!valid || !city.trim() || !address.trim()}>Calculer le récapitulatif</Button>
          </fieldset></form>
        </section>
        <section className="panel purchase-panel"><h2>Votre récapitulatif</h2>{quote ? <><p>{quote.quantityKg} kg à {money(quote.pricePerKgCents)} / kg</p><Totals {...quote} /><p className="muted">Livraison estimée à J+2, à confirmer lors de la planification. Transport : 150 MAD + 0,25 MAD/kg.</p><Button variant="primary" disabled={action.pending} onClick={() => void action.run(async () => { const order = await api.createOrder({ ...(proposalId ? { proposalId } : { offerId: offer.id, quantityKg: quote.quantityKg, expectedOfferVersion: quote.offerVersion }), buyerAddress: { city, address } }, key.current); navigate(`/commandes/${order.id}/paiement`); })}>Confirmer et réserver</Button></> : <p>Calculez le récapitulatif pour vérifier le montant de votre commande.</p>}<Feedback error={action.error} /><Button onClick={reload} disabled={action.pending}>Actualiser les conditions du lot</Button></section>
      </div>}
    </Feedback>}
  </>;
}
