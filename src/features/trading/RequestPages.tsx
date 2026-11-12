import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ActionLink, Badge, Button, Dialog, Field, PageHeading, SelectField, TextAreaField } from '../../components/ui';
import type { PurchaseRequest, UserRecord } from '../../domain/types';
import type { ConversationSummary, OfferView } from '../../services/contracts';
import { api } from '../../services/apiClient';
import { useAction, useApi } from '../../services/useApi';
import { Feedback, money } from '../purchase/shared';
import { ProposalForm } from './ProposalForm';

const requestLabel = { open: 'Ouverte', ordered: 'Commandée', closed: 'Fermée', suspended: 'Suspendue' };
const productName = (request: PurchaseRequest) => request.product === 'tomato' ? 'tomates' : 'oignons';
function RequestDetails({ request }: { request: PurchaseRequest }) {
  return <><div className="card-meta"><Badge>{requestLabel[request.status]}</Badge><span>{request.destination}</span></div><h2>{request.quantityKg} kg de {productName(request)}</h2><p>{request.grade} · souhaités le {new Date(request.desiredDate).toLocaleDateString('fr-FR')}</p>{request.targetPriceCents && <p>Prix souhaité : {money(request.targetPriceCents)} / kg</p>}<p className="preserve-text">{request.description}</p></>;
}
function RequestForm({ request, destination, onSaved, onCancel }: { request?: PurchaseRequest; destination: string; onSaved: () => void; onCancel: () => void }) {
  const action = useAction();
  return <section className="panel purchase-panel"><h2>{request ? 'Modifier le besoin' : 'Publier un besoin'}</h2><form onSubmit={event => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const price = String(form.get('price') ?? '');
    const input = { product: form.get('product'), quantityKg: Number(form.get('quantity')), grade: form.get('grade'), destination: form.get('destination'), desiredDate: form.get('date'), description: form.get('description'), ...(price ? { targetPriceCents: Math.round(Number(price) * 100) } : request ? { targetPriceCents: null } : {}) };
    void action.run(async () => { if (request) await api.updateRequest(request.id, input); else await api.createRequest(input); onSaved(); });
  }}><fieldset disabled={action.pending}><div className="form-grid">
    <SelectField id="request-product" name="product" label="Produit recherché" defaultValue={request?.product ?? 'tomato'}><option value="tomato">Tomates</option><option value="onion">Oignons</option></SelectField><Field id="request-quantity" name="quantity" label="Quantité souhaitée (kg)" type="number" min="1" step="1" defaultValue={request?.quantityKg} required />
    <Field id="request-grade" name="grade" label="Qualité / calibre souhaité" defaultValue={request?.grade ?? 'Non précisé'} maxLength={80} required /><Field id="request-destination" name="destination" label="Destination" defaultValue={request?.destination ?? destination} maxLength={120} required />
    <Field id="request-date" name="date" label="Date souhaitée" type="date" defaultValue={request?.desiredDate.slice(0, 10)} required /><Field id="request-price" name="price" label="Prix souhaité (MAD/kg, facultatif)" type="number" min="0.01" step="0.01" defaultValue={request?.targetPriceCents ? request.targetPriceCents / 100 : ''} />
  </div><TextAreaField id="request-description" name="description" label="Description du besoin" defaultValue={request?.description} rows={3} maxLength={1000} required />
    {request && <p className="notice">Enregistrer cette modification invalidera les propositions en attente et les accords non encore commandés. Les producteurs concernés seront avertis.</p>}
    <Feedback error={action.error} /><div className="action-row"><Button variant="primary" type="submit">{action.pending ? 'Enregistrement…' : request ? 'Enregistrer la demande' : 'Publier la demande'}</Button><Button type="button" onClick={onCancel}>Annuler</Button></div>
  </fieldset></form></section>;
}

export function RequestsPage({ mine = false }: { mine?: boolean }) {
  const result = useApi<PurchaseRequest[]>('requests');
  const user = useApi<UserRecord>(mine ? 'me' : null);
  const conversations = useApi<ConversationSummary[]>(mine ? 'conversations' : null);
  const [editing, setEditing] = useState<PurchaseRequest | 'new' | null>(null);
  const [closing, setClosing] = useState<PurchaseRequest | null>(null);
  const [notice, setNotice] = useState('');
  const action = useAction();
  return <><PageHeading eyebrow={mine ? 'Exprimez votre besoin' : 'À la rencontre des acheteurs'} title={mine ? 'Mes demandes' : 'Demandes d’achat'} description={mine ? 'Précisez votre besoin et retrouvez les propositions des producteurs.' : 'Répondez à un besoin avec un lot de votre exploitation.'} action={mine && <Button variant="primary" disabled={Boolean(editing)} onClick={() => setEditing('new')}>Publier une demande</Button>} />
    {notice && <p className="notice" role="status">{notice}</p>}<Feedback loading={result.loading || user.loading || conversations.loading} error={result.error ?? user.error ?? conversations.error} retry={() => { result.reload(); user.reload(); conversations.reload(); }}>
      {editing && <RequestForm key={editing === 'new' ? 'new' : editing.id} request={editing === 'new' ? undefined : editing} destination={user.data?.city ?? ''} onCancel={() => setEditing(null)} onSaved={() => { setNotice(editing === 'new' ? 'Votre demande est publiée.' : 'Votre demande a été modifiée. Les anciennes propositions ne sont plus utilisables.'); setEditing(null); result.reload(); conversations.reload(); }} />}
      {!result.data?.length && <p className="panel purchase-panel">Aucune demande {mine ? 'publiée pour le moment' : 'ouverte actuellement'}.</p>}
      <div className="request-grid">{result.data?.map(request => <article className="panel purchase-panel" key={request.id}><RequestDetails request={request} /><div className="action-row">{mine ? request.status === 'open' && <><Button disabled={Boolean(editing) || action.pending} onClick={() => { setEditing(request); window.scrollTo(0, 0); }}>Modifier la demande</Button><Button disabled={action.pending} onClick={() => setClosing(request)}>Fermer la demande</Button></> : <ActionLink primary to={`/demandes/${request.id}`}>Répondre à la demande</ActionLink>}{request.orderId && <ActionLink to={`/commandes/${request.orderId}`}>Voir la commande</ActionLink>}</div>{mine && conversations.data?.filter(item => item.requestId === request.id).map(item => <div className="request-response" key={item.id}><ActionLink to={`/messages/${item.id}`}>Échanger avec {item.sellerName}</ActionLink><span>{item.proposalCount} proposition(s) en attente</span></div>)}</article>)}</div>
    </Feedback><Dialog open={Boolean(closing)} title="Fermer cette demande" onClose={() => { if (!action.pending) setClosing(null); }}><p>Les propositions en attente et les accords non commandés seront invalidés. Les producteurs concernés recevront une notification.</p><Feedback error={action.error} /><Button variant="danger" disabled={action.pending} onClick={() => void action.run(async () => { if (!closing) return; await api.updateRequest(closing.id, { status: 'closed' }); setClosing(null); result.reload(); conversations.reload(); setNotice('La demande a été fermée.'); })}>Confirmer la fermeture</Button></Dialog>
  </>;
}

export function RequestPage() {
  const { id } = useParams();
  const result = useApi<PurchaseRequest>(`requests/${encodeURIComponent(id ?? '')}`);
  const offers = useApi<OfferView[]>('offers?mine=true');
  const navigate = useNavigate();
  return <><PageHeading eyebrow="Demandes d’achat" title="Détail de la demande" description="Proposez un lot et vos conditions à l’acheteur." action={<ActionLink to="/demandes">Revenir aux demandes</ActionLink>} /><Feedback loading={result.loading || offers.loading} error={result.error ?? offers.error} retry={() => { result.reload(); offers.reload(); }}>{result.data && <div className="purchase-grid"><section className="panel purchase-panel"><RequestDetails request={result.data} /><p className="muted">Une demande donne lieu à une seule commande. Une quantité partielle peut être convenue.</p></section><section className="panel purchase-panel"><h2>Votre proposition</h2><ProposalForm offers={offers.data?.filter(offer => offer.product === result.data!.product) ?? []} requestedKg={result.data.quantityKg} onSubmit={async input => { const conversation = await api.createConversation({ requestId: id }); await api.createProposal(conversation.id, input); navigate(`/messages/${conversation.id}`); }} /></section></div>}</Feedback></>;
}
