import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ActionLink, Badge, Button, PageHeading, TextAreaField } from '../../components/ui';
import { useSession } from '../../app/SessionProvider';
import type { Proposal } from '../../domain/types';
import type { ConversationSummary, ConversationView } from '../../services/contracts';
import { api } from '../../services/apiClient';
import { useAction, useApi } from '../../services/useApi';
import { date, Feedback, money } from '../purchase/shared';
import { ProposalForm } from './ProposalForm';

const proposalLabels = { pending: 'En attente', accepted: 'Acceptée', rejected: 'Refusée', superseded: 'Remplacée', invalidated: 'Invalidée' };
export function ConversationsPage() {
  const { profile } = useSession();
  const result = useApi<ConversationSummary[]>('conversations');
  return <><PageHeading eyebrow="Vos échanges" title="Messages" description="Retrouvez vos conversations, vos propositions et vos accords." /><Feedback {...result} retry={result.reload}>
    {!result.data?.length && <section className="panel purchase-panel"><h2>Aucune conversation pour le moment</h2><p>Commencez un échange depuis un lot ou une demande.</p><ActionLink to={profile?.role === 'buyer' ? '/offres' : '/demandes'}>{profile?.role === 'buyer' ? 'Consulter le catalogue' : 'Voir les demandes'}</ActionLink></section>}
    <div className="conversation-list">{result.data?.map(item => <article key={item.id} className="panel purchase-panel"><div className="card-meta"><span>{profile?.role === 'buyer' ? item.sellerName : item.buyerName}</span><Badge>{item.requestId ? 'Demande d’achat' : 'Lot du catalogue'}</Badge></div><h2>{item.title}</h2>{item.lastMessage ? <><p className="message-preview">{item.lastMessage.text}</p><time dateTime={item.lastMessage.createdAt}>{date(item.lastMessage.createdAt)}</time></> : <p>Aucun message échangé.</p>}<p>{item.proposalCount} proposition(s) en attente</p><ActionLink to={`/messages/${item.id}`}>Ouvrir la conversation</ActionLink></article>)}</div>
  </Feedback></>;
}

export function ConversationPage() {
  const { id } = useParams();
  const { profile } = useSession();
  const result = useApi<ConversationView>(`conversations/${encodeURIComponent(id ?? '')}`);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<Proposal | 'new' | null>(null);
  const [notice, setNotice] = useState('');
  const action = useAction();
  const conversation = result.data;
  const canPropose = conversation && (!conversation.request || conversation.request.status === 'open');
  const name = (userId: string) => userId === conversation?.buyerId ? conversation.buyerName : conversation?.sellerName;
  return <><PageHeading eyebrow="Vos échanges" title="Conversation" description={conversation ? `${conversation.title} · ${conversation.buyerName} et ${conversation.sellerName}` : 'Messages et propositions liés à votre échange.'} action={<ActionLink to="/messages">Toutes les conversations</ActionLink>} />
    {notice && <p className="notice" role="status">{notice}</p>}<Feedback {...result} retry={result.reload}>{conversation && <div className="conversation-grid">
      <section className="panel purchase-panel"><h2>Messages</h2><ol className="message-thread" aria-label="Historique des messages">{conversation.messages.map(item => <li key={item.id} className={item.senderId === profile?.id ? 'message-own' : ''}><strong>{name(item.senderId)}</strong><p>{item.text}</p><time dateTime={item.createdAt}>{date(item.createdAt)}</time></li>)}</ol>{!conversation.messages.length && <p className="muted">Écrivez le premier message pour préciser votre besoin.</p>}
        <form onSubmit={event => { event.preventDefault(); void action.run(async () => { await api.sendMessage(conversation.id, message); setMessage(''); setNotice('Votre message a été envoyé.'); result.reload(); }); }}><fieldset disabled={action.pending}><TextAreaField id="message" label="Votre message" value={message} onChange={event => setMessage(event.target.value)} rows={4} maxLength={2000} required /><Button variant="primary" type="submit" disabled={!message.trim()}>Envoyer le message</Button></fieldset></form>
      </section>
      <section className="panel purchase-panel"><h2>Propositions commerciales</h2><p className="muted">Accepter un accord ne réserve pas de stock. L’acheteur vérifie le récapitulatif puis confirme sa commande.</p>{conversation.request && <p className="notice">Demande : {conversation.request.quantityKg} kg · {conversation.request.destination}. {conversation.request.status === 'ordered' ? 'Une commande est déjà liée à cette demande.' : conversation.request.status !== 'open' ? 'Cette demande est fermée ou indisponible.' : 'Une seule commande peut être créée pour ce besoin.'}</p>}
        <div className="proposal-list">{[...conversation.proposals].reverse().map(proposal => <article className="proposal-card" key={proposal.id}><div className="card-meta"><Badge>{proposalLabels[proposal.status]}</Badge><span>De {name(proposal.authorId)}</span></div><h3>{conversation.offers.find(offer => offer.id === proposal.offerId)?.title ?? 'Lot proposé'}</h3><p className="proposal-terms">{proposal.quantityKg} kg à {money(proposal.pricePerKgCents)} / kg</p><p className="preserve-text">{proposal.qualityNotes || 'Aucune condition de qualité supplémentaire.'}</p><time dateTime={proposal.createdAt}>{date(proposal.createdAt)}</time><div className="action-row">
          {proposal.orderId ? <ActionLink to={`/commandes/${proposal.orderId}`}>Voir la commande liée</ActionLink> : proposal.status === 'accepted' && profile?.id === conversation.buyerId ? <ActionLink primary to={`/commande/nouvelle?proposition=${proposal.id}`}>Préparer la commande</ActionLink> : proposal.status === 'accepted' ? <p>L’acheteur peut maintenant préparer sa commande.</p> : null}
          {proposal.status === 'pending' && proposal.recipientId === profile?.id && <><Button variant="primary" disabled={action.pending || Boolean(draft)} onClick={() => void action.run(async () => { await api.respondToProposal(proposal.id, true); setNotice('Proposition acceptée. Le stock sera vérifié à la commande.'); result.reload(); })}>Accepter la proposition</Button><Button disabled={action.pending || Boolean(draft)} onClick={() => void action.run(async () => { await api.respondToProposal(proposal.id, false); setNotice('La proposition a été refusée.'); result.reload(); })}>Refuser la proposition</Button>{canPropose && <Button disabled={action.pending || Boolean(draft)} onClick={() => setDraft(proposal)}>Faire une contre-proposition</Button>}</>}
        </div></article>)}</div>
        {!conversation.proposals.length && <p>Aucune proposition pour le moment.</p>}
        {canPropose && !draft && <Button disabled={action.pending} onClick={() => setDraft('new')}>Nouvelle proposition</Button>}
        {draft && canPropose && <div className="proposal-editor"><h3>{draft === 'new' ? 'Nouvelles conditions' : 'Votre contre-proposition'}</h3><ProposalForm key={draft === 'new' ? 'new' : draft.id} offers={conversation.offers} requestedKg={conversation.request?.quantityKg} previous={draft === 'new' ? undefined : draft} onCancel={() => setDraft(null)} onSubmit={async input => { await api.createProposal(conversation.id, input); setDraft(null); setNotice('Votre proposition a été envoyée.'); result.reload(); }} /></div>}
      </section>
    </div>}</Feedback><Feedback error={action.error} /></>;
}
