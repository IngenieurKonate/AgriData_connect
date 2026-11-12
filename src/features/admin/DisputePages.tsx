import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSession } from '../../app/SessionProvider';
import { ActionLink, Badge, Button, Dialog, Field, PageHeading, SelectField, TextAreaField } from '../../components/ui';
import { photoLibrary } from '../../assets/produce';
import type { DisputeRecord, DisputeResolution } from '../../domain/types';
import type { DisputeView, OrderView } from '../../services/contracts';
import { api, apiRequest } from '../../services/apiClient';
import { useAction, useApi } from '../../services/useApi';
import { date, Feedback, money } from '../purchase/shared';

export const disputeLabels = { open: 'Ouvert', reviewing: 'En traitement', decision_recorded: 'Décision enregistrée', resolved: 'Résolu' };
const reasons = { non_conforming: 'Produit non conforme', missing_quantity: 'Quantité manquante', damaged: 'Produit abîmé', other: 'Autre problème' };
const resolutions = { full_refund: 'Remboursement total', partial_refund: 'Accord financier partiel', replacement: 'Remplacement' };

export function ReportProblem({ order, replacement = false, onSaved }: { order: OrderView; replacement?: boolean; onSaved: () => void }) {
  const action = useAction();
  return <form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); const proof = String(form.get('proof') ?? ''); const input = { reason: form.get('reason'), description: form.get('description'), evidenceImageIds: proof ? [proof] : [] }; void action.run(async () => { if (replacement) await apiRequest(`orders/${order.id}/replacement-issue`, { method: 'POST', body: JSON.stringify(input) }); else await api.openDispute(order.id, input); onSaved(); }); }}><fieldset disabled={action.pending}>
    <SelectField id="problem-reason" name="reason" label="Motif du signalement" required>{Object.entries(reasons).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</SelectField>
    <TextAreaField id="problem-description" name="description" label="Description du problème" maxLength={2000} rows={4} required />
    {!replacement && <SelectField id="problem-proof" name="proof" label="Preuve locale (facultative)"><option value="">Aucune photo jointe</option>{photoLibrary.filter(photo => photo.product === order.item.product).map(photo => <option value={photo.id} key={photo.id}>{photo.alt}</option>)}</SelectField>}
    <p>Le versement restera bloqué pendant l’examen du dossier.</p><Feedback error={action.error} /><Button variant="primary" type="submit">Envoyer le signalement</Button>
  </fieldset></form>;
}

function DecisionForm({ dispute, onSaved }: { dispute: DisputeView; onSaved: () => void }) {
  const [resolution, setResolution] = useState<DisputeResolution>('full_refund');
  const action = useAction();
  return <form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void action.run(async () => { await api.decideDispute(dispute.id, { resolution, decisionNote: form.get('note'), ...(resolution === 'partial_refund' ? { refundGoodsCents: Math.round(Number(form.get('goods')) * 100), refundDeliveryCents: Math.round(Number(form.get('delivery')) * 100) } : resolution === 'replacement' ? { replacementQuantityKg: Number(form.get('quantity')) } : {}) }); onSaved(); }); }}><fieldset disabled={action.pending}>
    <SelectField id="resolution" label="Résolution" value={resolution} onChange={event => setResolution(event.target.value as DisputeResolution)}>{Object.entries(resolutions).filter(([value]) => value !== 'replacement' || !dispute.replacementCycleId).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField>
    {resolution === 'full_refund' && <p>Total à rembourser : <strong>{money(dispute.order.totalCents)}</strong>, produits et transport inclus.</p>}
    {resolution === 'partial_refund' && <div className="form-grid"><Field id="refund-goods" name="goods" label="Remboursement produits (MAD)" type="number" min="0" max={dispute.order.goodsCents / 100} step="0.01" defaultValue="0" required /><Field id="refund-delivery" name="delivery" label="Remboursement transport (MAD)" type="number" min="0" max={dispute.order.deliveryCents / 100} step="0.01" defaultValue="0" required /></div>}
    {resolution === 'replacement' && <Field id="replacement-quantity" name="quantity" label="Quantité à remplacer (kg)" type="number" min="1" max={dispute.order.quantityKg} step="1" defaultValue={dispute.order.quantityKg} required />}
    <TextAreaField id="decision-note" name="note" label="Motif de décision et accord des parties" rows={3} maxLength={2000} required />
    <p className="muted">L’enregistrement de la décision n’exécute aucune opération financière ou de stock.</p><Feedback error={action.error} /><Button variant="primary" type="submit">Enregistrer la décision</Button>
  </fieldset></form>;
}

export function DisputePanel({ id, onChanged }: { id: string; onChanged?: () => void }) {
  const { profile } = useSession();
  const result = useApi<DisputeView>(`disputes/${encodeURIComponent(id)}`);
  const action = useAction();
  const [comment, setComment] = useState('');
  const [confirm, setConfirm] = useState(false);
  const key = useRef(crypto.randomUUID());
  const refresh = () => { result.reload(); onChanged?.(); };
  const dispute = result.data;
  const admin = profile?.role === 'admin';
  const executable = dispute?.status === 'decision_recorded' && (dispute.resolutionType !== 'replacement' || !dispute.replacementCycleId);
  return <section className="panel purchase-panel dispute-panel"><h2>Dossier de litige</h2><Feedback {...result} retry={result.reload}>{dispute && <>
    <div className="card-meta"><Badge>{disputeLabels[dispute.status]}</Badge><time dateTime={dispute.createdAt}>{date(dispute.createdAt)}</time></div><h3>{reasons[dispute.reason]}</h3><p className="preserve-text">{dispute.description}</p>
    {dispute.evidenceImageIds.length > 0 && <div className="evidence-gallery">{dispute.evidenceImageIds.map(imageId => { const photo = photoLibrary.find(item => item.id === imageId); return photo && <figure key={imageId}><img src={`/produce/${photo.file}`} alt={`Preuve jointe : ${photo.alt}`} /><figcaption>{photo.alt}</figcaption></figure>; })}</div>}
    {dispute.resolutionType && <div className="notice"><h3>{resolutions[dispute.resolutionType]}</h3><p className="preserve-text">{dispute.decisionNote}</p>{dispute.resolutionType === 'partial_refund' && <p>Produits : {money(dispute.refundGoodsCents ?? 0)} · Transport : {money(dispute.refundDeliveryCents ?? 0)}</p>}{dispute.resolutionType === 'full_refund' && <p>Montant total : {money(dispute.order.totalCents)}.</p>}{dispute.resolutionType === 'replacement' && <p>{dispute.replacementQuantityKg} kg du même lot. {dispute.replacementCycleId ? 'Le cycle de remplacement est créé.' : 'Le stock sera vérifié à l’exécution.'}</p>}{executable && <strong>Décision en attente d’exécution. Le versement reste bloqué.</strong>}</div>}
    {admin && dispute.status === 'open' && <Button variant="primary" disabled={action.pending} onClick={() => void action.run(async () => { await api.reviewDispute(id); refresh(); })}>Prendre en charge le dossier</Button>}
    {admin && dispute.status === 'reviewing' && <DecisionForm dispute={dispute} onSaved={() => { key.current = crypto.randomUUID(); refresh(); }} />}
    {admin && executable && <div className="action-row"><Button variant="primary" disabled={action.pending} onClick={() => setConfirm(true)}>Exécuter la décision</Button>{!dispute.replacementCycleId && <Button disabled={action.pending} onClick={() => void action.run(async () => { await api.reviewDispute(id); refresh(); })}>Revoir la décision</Button>}</div>}
    {dispute.replacementCycleId && <p><ActionLink to={`/commandes/${dispute.orderId}`}>Suivre le cycle de remplacement</ActionLink></p>}
    {dispute.order.refunds.map(refund => <div className="notice" key={refund.id}><strong>Remboursement exécuté : {money(refund.amountCents)}</strong><p className="reference">{refund.reference}</p><time dateTime={refund.executedAt}>{date(refund.executedAt)}</time></div>)}
    {dispute.status === 'resolved' && <p className="notice">Dossier résolu. {dispute.order.payout?.status === 'ready' ? 'Le versement restant peut être effectué.' : dispute.order.payout?.status === 'not_applicable' ? 'Aucun versement au producteur.' : ''}</p>}
    <Feedback error={action.error} /><h3>Échanges du dossier</h3><ol className="activity-list">{dispute.comments.map(item => <li key={item.id}><strong>{dispute.participants.find(person => person.id === item.authorId)?.displayName ?? 'Participant'}</strong><time dateTime={item.createdAt}>{date(item.createdAt)}</time><p className="preserve-text">{item.text}</p></li>)}</ol>{!dispute.comments.length && <p>Aucun commentaire pour le moment.</p>}
    <form onSubmit={event => { event.preventDefault(); void action.run(async () => { await api.commentDispute(id, comment); setComment(''); result.reload(); }); }}><fieldset disabled={action.pending}><TextAreaField id={`dispute-comment-${id}`} label="Votre commentaire" value={comment} onChange={event => setComment(event.target.value)} maxLength={2000} rows={3} required /><Button type="submit" disabled={!comment.trim()}>Ajouter le commentaire</Button></fieldset></form>
    <Dialog open={confirm} title="Confirmer l’exécution" onClose={() => { if (!action.pending) setConfirm(false); }}><p>{dispute.resolutionType === 'replacement' ? `Déduire ${dispute.replacementQuantityKg} kg du stock disponible et ouvrir un nouveau cycle, sans paiement supplémentaire.` : `Enregistrer le remboursement de ${money(dispute.resolutionType === 'full_refund' ? dispute.order.totalCents : (dispute.refundGoodsCents ?? 0) + (dispute.refundDeliveryCents ?? 0))}.`}</p><Feedback error={action.error} /><Button variant="primary" disabled={action.pending} onClick={() => void action.run(async () => { await api.executeDispute(id, key.current); setConfirm(false); refresh(); })}>Confirmer l’exécution</Button></Dialog>
  </>}</Feedback></section>;
}

export function DisputesPage() {
  const result = useApi<DisputeRecord[]>('admin/disputes');
  const [filter, setFilter] = useState('');
  const rows = result.data?.filter(item => !filter || item.status === filter);
  return <><PageHeading eyebrow="Administration" title="Litiges" description="Examinez les signalements et suivez l’exécution des résolutions." /><SelectField id="dispute-filter" label="État du dossier" value={filter} onChange={event => setFilter(event.target.value)}><option value="">Tous les dossiers</option>{Object.entries(disputeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField><Feedback {...result} retry={result.reload}><div className="request-grid">{rows?.map(item => <article className="panel purchase-panel" key={item.id}><Badge>{disputeLabels[item.status]}</Badge><h2>{reasons[item.reason]}</h2><p>{item.description}</p><p className="muted">{date(item.createdAt)}</p><ActionLink to={`/admin/litiges/${item.id}`}>Examiner le dossier</ActionLink></article>)}</div>{rows?.length === 0 && <p className="panel purchase-panel">Aucun dossier ne correspond à cet état.</p>}</Feedback></>;
}
export function DisputePage() {
  const { id = '' } = useParams();
  const result = useApi<DisputeView>(`disputes/${encodeURIComponent(id)}`);
  return <><PageHeading eyebrow={result.data?.order.reference ?? 'Administration'} title="Traitement du litige" description="Une décision enregistrée doit ensuite être exécutée." action={<ActionLink to="/admin/litiges">Tous les litiges</ActionLink>} />{result.data && <p><ActionLink to={`/commandes/${result.data.orderId}`}>Consulter la commande</ActionLink></p>}<DisputePanel key={id} id={id} /></>;
}
