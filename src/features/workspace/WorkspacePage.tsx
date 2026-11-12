import { ArrowUpRight, ClipboardList, CreditCard, Handshake, MessageSquare, Package, Scale, ShieldCheck, ShoppingBasket, Sprout, Truck, Wallet, type LucideIcon } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ActionLink, Badge, EmptyState, PageHeading } from '../../components/ui';
import { useSession } from '../../app/SessionProvider';
import { useBusinessData } from '../../app/BusinessDataProvider';
import type { BusinessData } from '../../domain/types';
import { api, ApiError } from '../../services/apiClient';

export type ModuleId = 'catalog' | 'offer-detail' | 'farmer-offers' | 'buyer-requests' | 'requests' | 'request-detail' | 'messages' | 'conversation' | 'checkout' | 'payment' | 'buyer-orders' | 'farmer-orders' | 'order-detail' | 'payouts' | 'admin-orders' | 'admin-payments' | 'disputes' | 'dispute-detail' | 'moderation';

interface RecordRow { id: string; title: string; detail: string; status?: string; to?: string }
const money = (cents: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 2 }).format(cents / 100);
const statusLabels: Record<string, string> = { pending: 'En attente', paid: 'Réglé', failed: 'Échec', active: 'En cours', cancelled: 'Annulée', closed: 'Clôturée', scheduled: 'Planifiée', collected: 'Collectée', in_transit: 'En livraison', handover_reported: 'Remise signalée', accepted: 'Réception confirmée', open: 'Ouvert', reviewing: 'En cours d’examen', blocked: 'En attente', ready: 'À verser', published: 'Publiée', disabled: 'Désactivée', suspended: 'Suspendue' };

function getRecords(data: BusinessData, module: ModuleId, profileId?: string, recordId?: string): RecordRow[] {
  const offers = data.offers.filter(offer => offer.status === 'published' && offer.stockRemainingKg > 0);
  const visibleOrders = data.orders.filter(order => !profileId || order.buyerId === profileId || order.sellerId === profileId || profileId === 'admin');
  const orderRow = (order: BusinessData['orders'][number]): RecordRow => {
    const delivery = data.deliveryCycles.find(cycle => cycle.id === order.currentDeliveryCycleId);
    return { id: order.id, title: `${order.reference} · ${order.item.title}`, detail: `${order.quantityKg} kg · ${money(order.totalCents)} · ${statusLabels[delivery?.status ?? order.paymentStatus] ?? order.paymentStatus}`, status: statusLabels[order.status] };
  };
  switch (module) {
    case 'catalog': return offers.map(offer => ({ id: offer.id, to: `/offres/${offer.id}`, title: offer.title, detail: `${offer.city} · ${offer.grade} · ${offer.stockRemainingKg} kg disponibles · ${money(offer.pricePerKgCents)}/kg` }));
    case 'offer-detail': { const offer = offers.find(item => item.id === recordId); return offer ? [{ id: offer.id, title: offer.title, detail: `${offer.description} · ${offer.stockRemainingKg} kg disponibles · ${money(offer.pricePerKgCents)}/kg` }] : []; }
    case 'farmer-offers': return data.offers.filter(offer => offer.sellerId === profileId).map(offer => ({ id: offer.id, title: offer.title, detail: `${offer.stockRemainingKg} kg disponibles · ${money(offer.pricePerKgCents)}/kg`, status: statusLabels[offer.status] }));
    case 'buyer-requests': return data.purchaseRequests.filter(request => request.buyerId === profileId).map(request => ({ id: request.id, title: `${request.quantityKg} kg de ${request.product === 'tomato' ? 'tomates' : 'oignons'}`, detail: `${request.destination} · ${request.grade}`, status: statusLabels[request.status] }));
    case 'requests': return data.purchaseRequests.filter(request => request.status === 'open').map(request => ({ id: request.id, to: `/demandes/${request.id}`, title: `${request.quantityKg} kg de ${request.product === 'tomato' ? 'tomates' : 'oignons'}`, detail: `${request.destination} · ${request.grade}`, status: statusLabels[request.status] }));
    case 'request-detail': { const request = data.purchaseRequests.find(item => item.id === recordId); return request ? [{ id: request.id, title: `${request.quantityKg} kg de ${request.product === 'tomato' ? 'tomates' : 'oignons'}`, detail: `${request.destination} · ${request.grade} · ${request.description}`, status: statusLabels[request.status] }] : []; }
    case 'messages': return data.conversations.filter(conversation => conversation.buyerId === profileId || conversation.sellerId === profileId).map(conversation => ({ id: conversation.id, to: `/messages/${conversation.id}`, title: data.offers.find(offer => offer.id === conversation.offerId)?.title ?? 'Demande d’achat', detail: `${data.messages.filter(message => message.conversationId === conversation.id).length} messages` }));
    case 'conversation': return data.messages.filter(message => message.conversationId === recordId).map(message => ({ id: message.id, title: data.users.find(user => user.id === message.senderId)?.displayName ?? 'Message', detail: message.text }));
    case 'buyer-orders': return visibleOrders.filter(order => order.buyerId === profileId).map(order => ({ ...orderRow(order), to: `/commandes/${order.id}` }));
    case 'farmer-orders': return visibleOrders.filter(order => order.sellerId === profileId).map(order => ({ ...orderRow(order), to: `/commandes/${order.id}` }));
    case 'admin-orders': return data.orders.map(order => ({ ...orderRow(order), to: `/commandes/${order.id}` }));
    case 'order-detail': case 'payment': case 'checkout': { const order = data.orders.find(item => item.id === recordId); return order ? [orderRow(order)] : []; }
    case 'payouts': return data.payouts.filter(payout => payout.sellerId === profileId).map(payout => ({ id: payout.orderId, title: data.orders.find(order => order.id === payout.orderId)?.reference ?? 'Versement', detail: `${money(payout.netCents)} nets · commission ${money(payout.commissionCents)}`, status: statusLabels[payout.status] }));
    case 'admin-payments': return data.paymentAttempts.map(attempt => ({ id: attempt.id, title: attempt.reference, detail: `${money(attempt.amountCents)} · ${attempt.method === 'naps' ? 'Naps' : 'Cash Plus'}`, status: statusLabels[attempt.status] }));
    case 'disputes': case 'dispute-detail': return data.disputes.filter(dispute => module === 'disputes' || dispute.id === recordId).map(dispute => ({ id: dispute.id, to: `/admin/litiges/${dispute.id}`, title: data.orders.find(order => order.id === dispute.orderId)?.reference ?? 'Commande', detail: dispute.description, status: statusLabels[dispute.status] }));
    case 'moderation': return [...data.users.map(user => ({ id: user.id, title: user.displayName, detail: user.city, status: statusLabels[user.status] })), ...data.offers.map(offer => ({ id: offer.id, title: offer.title, detail: `${offer.stockRemainingKg} kg · ${money(offer.pricePerKgCents)}/kg`, status: statusLabels[offer.status] }))];
    default: return [];
  }
}

function RecordList({ rows, emptyTitle, emptyText, icon, action, loading, error }: { rows: RecordRow[]; emptyTitle: string; emptyText: string; icon: LucideIcon; action: ReactNode; loading: boolean; error: string | null }) {
  if (loading) return <p className="record-feedback" role="status">Chargement des informations…</p>;
  if (error) return <div className="record-feedback" role="alert"><p>{error}</p>{action}</div>;
  if (!rows.length) return <EmptyState icon={icon} title={emptyTitle} action={action}>{emptyText}</EmptyState>;
  return <div className="record-list">{rows.map(row => <article className="record-row" key={row.id}><div>{row.to ? <Link className="record-link" to={row.to}><h3>{row.title}</h3></Link> : <h3>{row.title}</h3>}<p>{row.detail}</p></div>{row.status && <Badge>{row.status}</Badge>}</article>)}</div>;
}

function apiIds(value: unknown): string[] {
  const items = Array.isArray(value) ? value : [value];
  return items.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const key = typeof record.orderId === 'string' ? record.orderId : record.id;
    return typeof key === 'string' ? [key] : [];
  });
}

async function loadModuleIds(module: ModuleId, id?: string): Promise<string[]> {
  switch (module) {
    case 'catalog': return apiIds(await api.offers());
    case 'offer-detail': return apiIds(await api.offer(id ?? ''));
    case 'farmer-offers': return apiIds(await api.offers('mine=true'));
    case 'buyer-requests': case 'requests': return apiIds(await api.requests());
    case 'request-detail': return apiIds(await api.request(id ?? ''));
    case 'messages': return apiIds(await api.conversations());
    case 'conversation': {
      const detail = await api.conversation(id ?? '') as { messages?: unknown[] };
      return apiIds(detail.messages ?? []);
    }
    case 'buyer-orders': case 'farmer-orders': case 'admin-orders': return apiIds(await api.orders());
    case 'order-detail': case 'payment': return apiIds(await api.order(id ?? ''));
    case 'payouts': return apiIds(await api.payouts());
    case 'admin-payments': {
      const result = await api.adminPayments() as { attempts?: unknown[] };
      return apiIds(result.attempts ?? []);
    }
    case 'disputes': return apiIds(await api.adminDisputes());
    case 'dispute-detail': return apiIds(await api.dispute(id ?? ''));
    case 'moderation': {
      const [users, offers] = await Promise.all([api.adminUsers(), api.adminOffers()]);
      return [...apiIds(users), ...apiIds(offers)];
    }
    case 'checkout': return [];
    default: return [];
  }
}

interface ModuleInfo { title: string; eyebrow: string; description: string; emptyTitle: string; emptyText: string; icon: LucideIcon; labels: string[] }
const modules: Record<ModuleId, ModuleInfo> = {
  catalog: { title: 'Le catalogue', eyebrow: 'Du producteur à votre activité', description: 'Les lots de tomates et d’oignons, leurs prix et leurs conditions de vente.', emptyTitle: 'Aucun lot disponible', emptyText: 'Le catalogue ne contient aucune offre pour le moment.', icon: ShoppingBasket, labels: ['Lots et disponibilités', 'Prix en MAD/kg', 'Origine et calibre'] },
  'offer-detail': { title: 'Détail du lot', eyebrow: 'Le catalogue', description: 'Toutes les informations pour préparer votre achat.', emptyTitle: 'Lot introuvable', emptyText: 'Ce lot n’est pas accessible. Consultez le catalogue pour retrouver les offres disponibles.', icon: Sprout, labels: ['Produit et origine', 'Prix et quantité', 'Conditions de vente'] },
  'farmer-offers': { title: 'Mes offres', eyebrow: 'Votre production, bien présentée', description: 'Un espace pour vos lots, leurs disponibilités et leurs conditions de vente.', emptyTitle: 'Aucune offre publiée', emptyText: 'Vous n’avez aucun lot en vente pour le moment.', icon: Sprout, labels: ['Lots publiés', 'Quantités disponibles', 'Conditions de vente'] },
  'buyer-requests': { title: 'Mes demandes', eyebrow: 'Exprimez votre besoin', description: 'Le bon produit, la bonne quantité et votre destination.', emptyTitle: 'Aucune demande en cours', emptyText: 'Vous n’avez aucune demande d’achat en cours.', icon: ClipboardList, labels: ['Produit recherché', 'Quantité et destination', 'Propositions reçues'] },
  requests: { title: 'Demandes d’achat', eyebrow: 'À la rencontre des acheteurs', description: 'Les besoins des acheteurs pour vos produits et vos disponibilités.', emptyTitle: 'Aucune demande ouverte', emptyText: 'Aucun besoin d’achat n’est publié pour le moment.', icon: ClipboardList, labels: ['Besoins ouverts', 'Produit et calibre', 'Votre proposition'] },
  'request-detail': { title: 'Détail de la demande', eyebrow: 'Demandes d’achat', description: 'Les conditions d’un besoin avant de faire votre proposition.', emptyTitle: 'Demande introuvable', emptyText: 'Cette demande n’est pas accessible. Consultez la liste des demandes ouvertes.', icon: ClipboardList, labels: ['Produit demandé', 'Destination', 'Conditions souhaitées'] },
  messages: { title: 'Messages', eyebrow: 'Le dialogue fait avancer les échanges', description: 'Vos conversations et vos propositions, réunies au même endroit.', emptyTitle: 'Aucune conversation', emptyText: 'Vous n’avez aucun échange en cours avec un acheteur ou un producteur.', icon: MessageSquare, labels: ['Conversations', 'Propositions', 'Accords'] },
  conversation: { title: 'Conversation', eyebrow: 'Vos échanges', description: 'Messages et propositions liés à un lot ou une demande.', emptyTitle: 'Conversation introuvable', emptyText: 'Cette conversation n’est pas accessible depuis votre compte.', icon: MessageSquare, labels: ['Messages datés', 'Prix et quantité', 'Acceptation ou refus'] },
  checkout: { title: 'Nouvelle commande', eyebrow: 'Avant de confirmer', description: 'Vérifiez le lot, les quantités, les adresses et le montant total.', emptyTitle: 'Choisissez d’abord un lot', emptyText: 'Consultez le catalogue pour sélectionner le produit et la quantité souhaités.', icon: ShoppingBasket, labels: ['Montant des produits', 'Frais de livraison', 'Total à payer'] },
  payment: { title: 'Paiement', eyebrow: 'Règlement de la commande', description: 'Retrouvez le montant et le moyen de paiement de votre commande.', emptyTitle: 'Aucune commande à régler', emptyText: 'Aucun paiement n’est associé à cette commande.', icon: CreditCard, labels: ['Carte Naps', 'Agence Cash Plus', 'Confirmation du paiement'] },
  'buyer-orders': { title: 'Mes commandes', eyebrow: 'Gardez le fil de vos achats', description: 'Du récapitulatif à la réception, retrouvez chaque étape de vos commandes.', emptyTitle: 'Aucune commande', emptyText: 'Vous n’avez aucune commande à suivre pour le moment.', icon: Package, labels: ['Paiement', 'Livraison', 'Réception'] },
  'farmer-orders': { title: 'Commandes reçues', eyebrow: 'Vos ventes, étape par étape', description: 'Les lots commandés et leur progression jusqu’à la livraison.', emptyTitle: 'Aucune commande reçue', emptyText: 'Aucun acheteur n’a encore commandé vos lots.', icon: Package, labels: ['Commandes', 'Collectes', 'Livraisons'] },
  'order-detail': { title: 'Suivi de commande', eyebrow: 'Un historique partagé', description: 'Paiement, livraison et réception dans une même chronologie.', emptyTitle: 'Commande introuvable', emptyText: 'Cette commande n’est pas accessible depuis votre compte.', icon: Truck, labels: ['Paiement confirmé', 'Remise signalée', 'Réception conforme'] },
  payouts: { title: 'Mes règlements', eyebrow: 'Une vue claire de vos ventes', description: 'Vos montants à recevoir et les versements effectués.', emptyTitle: 'Aucun règlement', emptyText: 'Aucun versement n’est associé à vos ventes pour le moment.', icon: Wallet, labels: ['Montant des produits', 'Commission', 'Net à recevoir'] },
  'admin-orders': { title: 'Commandes et livraisons', eyebrow: 'Coordination des opérations', description: 'Organisez les transports et suivez l’avancement des commandes.', emptyTitle: 'Aucune commande à suivre', emptyText: 'Aucune commande ni mission de livraison n’est enregistrée pour le moment.', icon: Truck, labels: ['Commandes', 'Collectes planifiées', 'Livraisons'] },
  'admin-payments': { title: 'Paiements et versements', eyebrow: 'Suivi financier', description: 'Tentatives, paiements, remboursements et versements.', emptyTitle: 'Aucune opération financière', emptyText: 'Aucun paiement, remboursement ou versement n’est enregistré pour le moment.', icon: CreditCard, labels: ['Paiements', 'Remboursements', 'Versements'] },
  disputes: { title: 'Litiges', eyebrow: 'Accompagner la résolution', description: 'Les problèmes signalés à la réception et les actions à mener.', emptyTitle: 'Aucun litige en cours', emptyText: 'Aucun problème de réception n’a été signalé.', icon: Scale, labels: ['Signalements', 'Décisions', 'Résolutions exécutées'] },
  'dispute-detail': { title: 'Dossier de litige', eyebrow: 'Traitement du signalement', description: 'Échanges, décision et suivi de la résolution.', emptyTitle: 'Dossier introuvable', emptyText: 'Ce dossier n’est pas accessible. Consultez la liste des litiges pour retrouver un signalement.', icon: Scale, labels: ['Motif et preuves', 'Échanges', 'Résolution'] },
  moderation: { title: 'Utilisateurs et annonces', eyebrow: 'Veiller au bon déroulement des échanges', description: 'Supervisez les comptes et les annonces de la plateforme.', emptyTitle: 'Aucun élément à modérer', emptyText: 'Aucun compte ni aucune annonce ne nécessite d’intervention pour le moment.', icon: ShieldCheck, labels: ['Comptes', 'Annonces', 'Motifs de suspension'] },
};

export function WorkspacePage({ module }: { module: ModuleId }) {
  const info = modules[module];
  const { profile } = useSession();
  const { data } = useBusinessData();
  const { id } = useParams();
  const [visibleIds, setVisibleIds] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setVisibleIds(null); setLoadError(null);
    loadModuleIds(module, id).then(result => { if (active) setVisibleIds(result); }).catch(error => {
      if (active) setLoadError(error instanceof ApiError ? error.message : 'Les informations ne peuvent pas être chargées pour le moment.');
    });
    return () => { active = false; };
  }, [module, id, profile?.id]);
  const records = data && visibleIds ? getRecords(data, module, profile?.id, id).filter(row => visibleIds.includes(row.id)) : [];
  const loading = visibleIds === null && loadError === null && module !== 'checkout';
  const isOffers = module === 'catalog' || module === 'farmer-offers';
  const returnLinks: Partial<Record<ModuleId, { to: string; label: string }>> = {
    'offer-detail': { to: '/offres', label: 'Revenir au catalogue' },
    checkout: { to: '/offres', label: 'Consulter le catalogue' },
    'request-detail': { to: '/demandes', label: 'Voir les demandes' },
    conversation: { to: '/messages', label: 'Revenir aux messages' },
    'dispute-detail': { to: '/admin/litiges', label: 'Voir les litiges' },
  };
  const returnLink = returnLinks[module] ?? { to: profile ? '/profil' : '/connexion', label: profile ? 'Consulter mon profil' : 'Choisir un profil' };
  return <>
    <PageHeading eyebrow={info.eyebrow} title={info.title} description={info.description} />
    {isOffers && <section className="workspace-intro"><div><p className="eyebrow">{module === 'catalog' ? 'Des lots, des producteurs, des possibilités' : `Bienvenue, ${profile?.organization ?? 'producteur'}`}</p><h2>{module === 'catalog' ? 'Préparez vos prochains achats.' : 'Votre récolte mérite un suivi clair.'}</h2><p>{module === 'catalog' ? 'Tomates et oignons : les disponibilités, les origines et les conditions de vente réunies au même endroit.' : 'Réunissez vos offres, les demandes des acheteurs et vos commandes dans un espace pensé pour votre activité.'}</p></div><div className="produce-labels" aria-label="Filières agricoles"><span className="produce-label tomato-label"><Sprout size={24} />Tomates<small>Filière maraîchère</small></span><span className="produce-label onion-label"><Sprout size={24} />Oignons<small>Filière maraîchère</small></span></div></section>}
    <div className="module-grid"><section className="panel module-main"><div className="panel-toolbar"><span><info.icon size={18} />{isOffers ? 'Les lots' : 'Votre suivi'}</span>{records.length > 0 && <Badge>{records.length} résultat{records.length > 1 ? 's' : ''}</Badge>}</div><RecordList rows={records} icon={info.icon} emptyTitle={info.emptyTitle} emptyText={info.emptyText} action={<ActionLink to={returnLink.to}>{returnLink.label}</ActionLink>} loading={loading} error={loadError} /></section><aside className="module-aside"><div className="panel overview-panel"><p className="eyebrow">Dans cet espace</p>{info.labels.map((label, i) => <div className="overview-row" key={label}><span className="overview-number">0{i + 1}</span><span>{label}</span></div>)}</div><div className="quiet-note"><Handshake size={23} strokeWidth={1.4} /><h3>Des conditions partagées</h3><p>Chaque commande réunit les conditions convenues entre l’acheteur et le producteur.</p></div></aside></div>
  </>;
}

export function AdminPage() {
  return <><PageHeading eyebrow="Vue d’ensemble" title="Tableau de bord" description="Coordonnez les commandes et accompagnez chaque transaction jusqu’à sa clôture." action={<Badge>Administration</Badge>} /><section className="admin-intro"><div><p className="eyebrow">Au cœur des échanges</p><h2>Le bon suivi,<br />au bon moment.</h2><p>Une vue commune pour organiser les transports, traiter les signalements et finaliser les règlements.</p></div><div className="admin-principle"><ShieldCheck size={34} strokeWidth={1.3} /><strong>La réception reste entre<br />les mains de l’acheteur.</strong><span>Le versement normal intervient après sa confirmation.</span></div></section><div className="admin-cards">{[
    { to: '/admin/commandes', icon: Truck, title: 'Commandes et livraisons', text: 'Planifier les collectes et suivre les étapes.' },
    { to: '/admin/paiements', icon: Wallet, title: 'Paiements et versements', text: 'Retrouver les opérations et les montants.' },
    { to: '/admin/litiges', icon: Scale, title: 'Litiges', text: 'Accompagner les parties vers une résolution.' },
    { to: '/admin/moderation', icon: ShieldCheck, title: 'Utilisateurs et annonces', text: 'Encadrer les publications et les accès.' },
  ].map(({ to, icon: Icon, title, text }) => <Link to={to} className="admin-card" key={to}><span className="step-icon"><Icon size={25} strokeWidth={1.5} /></span><ArrowUpRight className="card-arrow" size={20} /><h2>{title}</h2><p>{text}</p><span className="text-link">Ouvrir l’espace</span></Link>)}</div></>;
}

