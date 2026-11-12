import { useRef, useState } from 'react';
import { DisputePanel, ReportProblem } from '../admin/DisputePages';
import { Link, useParams } from 'react-router-dom';
import { useSession } from '../../app/SessionProvider';
import { ActionLink, Badge, Button, Dialog, Field, PageHeading, SelectField } from '../../components/ui';
import type { OrderRecord, PaymentAttempt, PaymentMethod } from '../../domain/types';
import { api, apiRequest } from '../../services/apiClient';
import type { OrderView } from '../../services/contracts';
import { useAction, useApi } from '../../services/useApi';
import { date, Feedback, labels, money, Totals } from './shared';

export function OrdersPage() {
  const { profile } = useSession();
  const result = useApi<OrderRecord[]>('orders');
  const [status, setStatus] = useState('');
  const rows = result.data?.filter(order => !status || order.status === status).slice().reverse();
  return <><PageHeading eyebrow="Du lot à la réception" title={profile?.role === 'admin' ? 'Commandes et livraisons' : profile?.role === 'farmer' ? 'Commandes reçues' : 'Mes commandes'} description="Retrouvez les conditions de chaque achat et son avancement." /><SelectField id="order-status" label="État de la commande" value={status} onChange={e => setStatus(e.target.value)}><option value="">Toutes les commandes</option><option value="active">En cours</option><option value="closed">Clôturées</option><option value="cancelled">Annulées</option></SelectField><Feedback {...result} retry={result.reload}><div className="order-list">{rows?.map(order => <Link key={order.id} className="panel order-list-item" to={`/commandes/${order.id}`}><div><span className="eyebrow">{order.reference}</span><h2>{order.item.title}</h2><p>{order.quantityKg} kg · {order.buyerAddress.city} · {date(order.createdAt)}</p></div><div><Badge>{labels[order.status]}</Badge><p>{labels[order.paymentStatus]}</p><strong>{money(order.totalCents)}</strong></div></Link>)}</div>{rows?.length === 0 && <p className="panel purchase-panel">Aucune commande ne correspond à cet état.</p>}</Feedback></>;
}

export function PaymentPage() {
  const { id = '' } = useParams();
  const result = useApi<OrderView>(`orders/${id}`);
  const action = useAction();
  const [method, setMethod] = useState<PaymentMethod>('naps');
  const key = useRef(crypto.randomUUID());
  const order = result.data;
  const attempt = order?.attempts.find(item => item.status === 'pending');
  const eligible = order?.status === 'active' && ['pending', 'failed'].includes(order.paymentStatus);
  const outcome = (value: 'success' | 'failure') => void action.run(async () => { await api.paymentResult(attempt!.id, value); key.current = crypto.randomUUID(); result.reload(); });
  return <><PageHeading eyebrow={order?.reference ?? 'Votre commande'} title="Paiement" description="Choisissez votre moyen de règlement et retrouvez les tentatives enregistrées." action={<ActionLink to={`/commandes/${id}`}>Suivre la commande</ActionLink>} /><Feedback {...result} retry={result.reload}>{order && <div className="purchase-grid"><section className="panel purchase-panel"><h2>{order.item.title}</h2><Totals {...order} /><Badge>{labels[order.paymentStatus]}</Badge>{eligible && <><SelectField id="payment-method" label="Moyen de paiement" value={method} onChange={e => { setMethod(e.target.value as PaymentMethod); key.current = crypto.randomUUID(); }}><option value="naps">Carte Naps</option><option value="cash_plus">Agence Cash Plus</option></SelectField><Button variant="primary" disabled={action.pending} onClick={() => void action.run(async () => { await api.createPaymentAttempt(order.id, method, key.current); result.reload(); })}>{attempt ? 'Utiliser ce moyen de paiement' : 'Préparer le paiement'}</Button></>}<Feedback error={action.error} /></section><section className="panel purchase-panel"><h2>État du règlement</h2>{eligible && attempt ? <><p className="reference">{attempt.reference}</p>{attempt.method === 'cash_plus' ? <div className="notice"><h3>En attente de paiement en agence</h3><p>Montant : {money(attempt.amountCents)}. Le paiement sera confirmé après enregistrement de l’encaissement par l’administration.</p></div> : <div className="action-stack"><p>Carte Naps · {money(attempt.amountCents)}</p><Button variant="primary" disabled={action.pending} onClick={() => outcome('success')}>Valider le paiement</Button><Button disabled={action.pending} onClick={() => outcome('failure')}>Déclarer un refus de paiement</Button></div>}</> : <p>{order.paymentStatus === 'paid' ? 'Paiement confirmé. La collecte peut être organisée.' : order.paymentStatus === 'failed' ? 'Le paiement a été refusé. Préparez une nouvelle tentative ou changez de moyen de paiement.' : 'Retrouvez ici les informations de votre règlement.'}</p>}<h3>Historique des tentatives</h3><AttemptList attempts={order.attempts} /></section></div>}</Feedback></>;
}

function AttemptList({ attempts }: { attempts: PaymentAttempt[] }) {
  return attempts.length ? <ul className="activity-list">{attempts.slice().reverse().map(item => <li key={item.id}><strong>{item.method === 'naps' ? 'Carte Naps' : 'Cash Plus'} · {labels[item.status]}</strong><p className="reference">{item.reference}</p><small>{date(item.createdAt)} · {money(item.amountCents)}</small></li>)}</ul> : <p className="muted">Aucune tentative enregistrée.</p>;
}

export function OrderPage() {
  const { id = '' } = useParams();
  const { profile } = useSession();
  const result = useApi<OrderView>(`orders/${id}`);
  const action = useAction();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [expireOpen, setExpireOpen] = useState(false);
  const [problemOpen, setProblemOpen] = useState(false);
  const [partner, setPartner] = useState('');
  const [collection, setCollection] = useState('');
  const [arrival, setArrival] = useState('');
  const [notice, setNotice] = useState('');
  const payoutKey = useRef(crypto.randomUUID());
  const order = result.data;
  const cycle = order?.deliveryCycles.find(item => item.id === order.currentDeliveryCycleId);
  const replacement = Boolean(order?.dispute && order.dispute.resolutionType === 'replacement' && order.dispute.status === 'decision_recorded' && order.dispute.replacementCycleId === cycle?.id && !order.dispute.replacementIssueAt);
  const canAdvance = !order?.disputeId || replacement;
  const admin = profile?.role === 'admin';
  const buyer = profile?.id === order?.buyerId;
  const steps = ['scheduled', 'collected', 'in_transit', 'handover_reported', 'accepted'];
  const next: Record<string, { status: string; label: string }> = { scheduled: { status: 'collected', label: 'Confirmer la collecte' }, collected: { status: 'in_transit', label: 'Démarrer la livraison' }, in_transit: { status: 'handover_reported', label: 'Signaler la remise' } };
  const perform = (work: () => Promise<unknown>, message = '') => void action.run(async () => { await work(); setNotice(message); result.reload(); });
  return <><PageHeading eyebrow={order?.reference ?? 'Votre suivi'} title="Suivi de commande" description="Des conditions conservées et une chronologie partagée entre acheteur, producteur et administration." />
    <Feedback {...result} retry={result.reload}>{order && <><div className="order-status-bar"><Badge>{labels[order.status]}</Badge><span>Paiement : {labels[order.paymentStatus]}</span><span>{labels[cycle?.status ?? 'not_started']}</span></div><div className="purchase-grid"><section className="panel purchase-panel"><h2>{order.item.title}</h2><p>{order.item.grade} · {order.quantityKg} kg · {money(order.goodsCents / order.quantityKg)} / kg</p><p>Producteur : {order.item.sellerName}</p><Totals {...order} /><div className="address-grid"><div><h3>Collecte</h3><p>{order.sellerAddress.address}<br />{order.sellerAddress.city}</p></div><div><h3>Livraison</h3><p>{order.buyerAddress.address}<br />{order.buyerAddress.city}</p></div></div>{!buyer && <dl className="amounts"><div><dt>Commission</dt><dd>{money(order.payout?.commissionCents ?? Math.round(order.goodsCents * order.commissionRateBps / 10000))}</dd></div><div><dt>Net agriculteur</dt><dd>{money(order.payout?.netCents ?? order.goodsCents - Math.round(order.goodsCents * order.commissionRateBps / 10000))}</dd></div></dl>}{order.payout?.status === 'paid' && <div className="notice"><strong>Versement effectué</strong><p>{money(order.payout.netCents)} · {order.payout.reference}</p>{order.payout.paidAt && <small>{date(order.payout.paidAt)}</small>}</div>}</section>
    <section className="panel purchase-panel"><h2>Prochaine étape</h2>{buyer && order.status === 'active' && ['pending', 'failed'].includes(order.paymentStatus) && <ActionLink primary to={`/commandes/${id}/paiement`}>Régler la commande</ActionLink>}
      {['pending', 'failed'].includes(order.paymentStatus) && order.status === 'active' && <p>La collecte sera possible après confirmation du paiement.</p>}
      {buyer && order.status === 'active' && ['pending', 'failed'].includes(order.paymentStatus) && <Button disabled={action.pending} onClick={() => setCancelOpen(true)}>Annuler la commande</Button>}
      {order.qualityNotes && <><h3>Qualité convenue</h3><p className="preserve-text">{order.qualityNotes}</p></>}
      {order.status === 'cancelled' && <p>Cette commande est annulée. Sa réservation a été libérée.</p>}
      {admin && order.status === 'active' && order.paymentStatus === 'paid' && canAdvance && (!cycle || cycle.status === 'not_started') && <form onSubmit={e => { e.preventDefault(); perform(() => api.scheduleDelivery(id, { partnerId: partner || order.transportPartners[0]?.id, collectionPlannedAt: new Date(collection).toISOString(), arrivalEstimatedAt: new Date(arrival).toISOString() })); }}><fieldset disabled={action.pending}><SelectField label="Transporteur" id="partner" value={partner || order.transportPartners[0]?.id} onChange={e => setPartner(e.target.value)}>{order.transportPartners.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField><Field id="collection" label="Date et heure de collecte" type="datetime-local" required value={collection} onChange={e => setCollection(e.target.value)} /><Field id="arrival" label="Arrivée estimée" type="datetime-local" min={collection} required value={arrival} onChange={e => setArrival(e.target.value)} /><Button type="submit" variant="primary">Planifier la collecte</Button></fieldset></form>}
      {admin && cycle && next[cycle.status] && canAdvance && <Button variant="primary" disabled={action.pending} onClick={() => perform(() => api.transitionDelivery(id, next[cycle.status].status))}>{next[cycle.status].label}</Button>}
      {cycle?.status === 'handover_reported' && canAdvance && <><p>{buyer ? 'En attente de votre confirmation' : 'En attente de confirmation par l’acheteur. Le versement reste bloqué.'}</p>{buyer && <Button variant="primary" disabled={action.pending} onClick={() => setConfirmOpen(true)}>Confirmer la réception conforme</Button>}{admin && <Button disabled={action.pending} onClick={() => perform(() => apiRequest(`admin/orders/${id}/remind`, { method: 'POST' }), 'Le rappel a été envoyé à l’acheteur.')}>Relancer l’acheteur</Button>}</>}
      {order.disputeId && <p>Un litige est associé à cette commande. <a className="text-link" href="#dossier">Consulter le dossier ci-dessous</a>{admin && <ActionLink to={`/admin/litiges/${order.disputeId}`}>Traiter le litige</ActionLink>}</p>}
      {buyer && cycle?.status === 'handover_reported' && order.status === 'active' && canAdvance && <Button disabled={action.pending} onClick={() => setProblemOpen(true)}>{replacement ? 'Signaler un problème sur le remplacement' : 'Signaler un problème'}</Button>}
      {admin && order.status === 'active' && ['pending', 'failed'].includes(order.paymentStatus) && <Button disabled={action.pending} onClick={() => setExpireOpen(true)}>Expirer la commande</Button>}
      {cycle?.status === 'accepted' && order.status !== 'closed' && <p>Réception conforme confirmée. Le versement peut être traité par l’administration.</p>}
      {admin && order.payout?.status === 'ready' && <Button variant="primary" disabled={action.pending} onClick={() => perform(() => api.payout(id, payoutKey.current))}>Effectuer le versement</Button>}
      {order.status === 'closed' && <p>Cette commande est clôturée.</p>}
      {notice && <p role="status" className="notice">{notice}</p>}<Feedback error={action.error} />
      {cycle?.partnerId && <><h3>Transport</h3><p>{order.transportPartners.find(item => item.id === cycle.partnerId)?.name}</p>{cycle.collectionPlannedAt && <p>Collecte : {date(cycle.collectionPlannedAt)}</p>}{cycle.arrivalEstimatedAt && <p>Arrivée estimée : {date(cycle.arrivalEstimatedAt)}</p>}</>}
    </section></div><section className="panel purchase-panel timeline-panel"><h2>Historique de la commande</h2><div className="cycle-list">{order.deliveryCycles.map(item => <div className="cycle-card" key={item.id}><h3>Cycle {item.cycleNumber}{item.id === order.dispute?.replacementCycleId ? ' : remplacement' : ''}</h3><p>{item.quantityKg} kg · {labels[item.status]}</p>{item.collectionPlannedAt && <p>Collecte : {date(item.collectionPlannedAt)}</p>}{item.arrivalEstimatedAt && <p>Arrivée estimée : {date(item.arrivalEstimatedAt)}</p>}</div>)}</div><ol className="delivery-steps">{steps.map((step, index) => <li key={step} className={index <= steps.indexOf(cycle?.status ?? '') ? 'reached' : ''}>{labels[step]}</li>)}</ol><ol className="activity-list">{order.events.map(event => <li key={event.id}><time dateTime={event.createdAt}>{date(event.createdAt)}</time><h3>{event.label}</h3><p>{event.details}</p></li>)}</ol></section>
      {order.financial.refundedCents > 0 && <section className="panel purchase-panel"><h2>Réconciliation financière</h2><dl className="amounts">{[['Payé par l’acheteur', order.financial.paidCents], ['Remboursé à l’acheteur', order.financial.refundedCents], ['Net agriculteur', order.financial.netCents], ['Commission recalculée', order.financial.commissionCents], ['Transport conservé', order.financial.retainedDeliveryCents]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{money(Number(value))}</dd></div>)}</dl><p>{order.financial.balanced ? 'Les montants se réconcilient.' : 'Les montants nécessitent une vérification.'}</p></section>}
      {order.disputeId && <div id="dossier"><DisputePanel id={order.disputeId} onChanged={result.reload} /></div>}</>}</Feedback>
    <Dialog open={confirmOpen} onClose={() => { if (!action.pending) setConfirmOpen(false); }} title="Confirmer la réception conforme"><p>Vous confirmez que le lot reçu est conforme. Cette confirmation autorise le versement à l’agriculteur.</p><Button variant="primary" disabled={action.pending} onClick={() => void action.run(async () => { await api.acceptReception(id); setConfirmOpen(false); result.reload(); })}>Oui, le lot est conforme</Button><Feedback error={action.error} /></Dialog>
    <Dialog open={problemOpen} onClose={() => { if (!action.pending) setProblemOpen(false); }} title={replacement ? 'Signaler un problème sur le remplacement' : 'Signaler un problème'}>{problemOpen && order && <ReportProblem order={order} replacement={replacement} onSaved={() => { setProblemOpen(false); result.reload(); }} />}</Dialog>
    <Dialog open={expireOpen} onClose={() => { if (!action.pending) setExpireOpen(false); }} title="Expirer la commande"><p>La réservation et les tentatives de paiement en attente seront libérées ou invalidées. Aucun encaissement ne sera effectué.</p><Feedback error={action.error} /><Button variant="danger" disabled={action.pending} onClick={() => void action.run(async () => { await apiRequest(`demo/orders/${id}/expire`, { method: 'POST' }); setExpireOpen(false); result.reload(); })}>Confirmer l’expiration</Button></Dialog>
    <Dialog open={cancelOpen} onClose={() => { if (!action.pending) setCancelOpen(false); }} title="Annuler la commande"><p>La réservation sera libérée. Si cette commande provient d’une demande, celle-ci sera rouverte et les propositions précédentes resteront inutilisables.</p><Button variant="danger" disabled={action.pending} onClick={() => void action.run(async () => { await api.cancelOrder(id); setCancelOpen(false); setNotice('La commande a été annulée.'); result.reload(); })}>Confirmer l’annulation</Button><Feedback error={action.error} /></Dialog>
  </>;
}
