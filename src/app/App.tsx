import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Compass, LockKeyhole } from 'lucide-react';
import { ActionLink, EmptyState, PageHeading } from '../components/ui';
import type { Role } from '../domain/types';
import { checkAccess } from '../domain/access';
import { HomePage } from '../features/home/HomePage';
import { ProfilesPage } from '../features/session/ProfilesPage';
import { ProfilePage } from '../features/session/ProfilePage';
import { WorkspacePage, type ModuleId } from '../features/workspace/WorkspacePage';
import { Layout } from './Layout';
import { BusinessDataProvider } from './BusinessDataProvider';
import { SessionProvider, useSession } from './SessionProvider';
import { roleHomes } from './profiles';
import { CatalogPage, OfferPage } from '../features/purchase/CatalogPage';
import { CheckoutPage } from '../features/purchase/CheckoutPage';
import { OrderPage, OrdersPage, PaymentPage } from '../features/purchase/OrderPages';
import { FinancePage } from '../features/admin/FinancePage';
import { DashboardPage } from '../features/admin/DashboardPage';
import { DisputePage, DisputesPage } from '../features/admin/DisputePages';
import { ModerationPage } from '../features/admin/ModerationPage';
import { TechnicalPage } from '../features/workspace/TechnicalPage';
import { OfferManagerPage } from '../features/trading/OfferManagerPage';
import { RequestPage, RequestsPage } from '../features/trading/RequestPages';
import { ConversationPage, ConversationsPage } from '../features/trading/ConversationPages';

interface ModuleRoute { path: string; module: ModuleId; roles?: Role[] }
const participantRoles: Role[] = ['buyer', 'farmer'];
const allRoles: Role[] = ['buyer', 'farmer', 'admin'];
const moduleRoutes: ModuleRoute[] = [
  { path: '/offres', module: 'catalog' },
  { path: '/offres/:id', module: 'offer-detail' },
  { path: '/messages', module: 'messages', roles: participantRoles },
  { path: '/messages/:id', module: 'conversation', roles: participantRoles },
  { path: '/acheteur/demandes', module: 'buyer-requests', roles: ['buyer'] },
  { path: '/commande/nouvelle', module: 'checkout', roles: ['buyer'] },
  { path: '/commandes/:id/paiement', module: 'payment', roles: ['buyer'] },
  { path: '/acheteur/commandes', module: 'buyer-orders', roles: ['buyer'] },
  { path: '/commandes/:id', module: 'order-detail', roles: allRoles },
  { path: '/agriculteur/offres', module: 'farmer-offers', roles: ['farmer'] },
  { path: '/demandes', module: 'requests', roles: ['farmer'] },
  { path: '/demandes/:id', module: 'request-detail', roles: ['farmer'] },
  { path: '/agriculteur/commandes', module: 'farmer-orders', roles: ['farmer'] },
  { path: '/agriculteur/reglements', module: 'payouts', roles: ['farmer'] },
  { path: '/admin/commandes', module: 'admin-orders', roles: ['admin'] },
  { path: '/admin/paiements', module: 'admin-payments', roles: ['admin'] },
  { path: '/admin/litiges', module: 'disputes', roles: ['admin'] },
  { path: '/admin/litiges/:id', module: 'dispute-detail', roles: ['admin'] },
  { path: '/admin/moderation', module: 'moderation', roles: ['admin'] },
];

function Guard({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { profile } = useSession();
  const access = checkAccess(profile?.role ?? null, roles);
  if (access === 'sign-in') return <Navigate to="/connexion" replace />;
  if (access === 'forbidden' && profile) return <><PageHeading eyebrow="Accès à l’espace" title="Cet espace est réservé à un autre rôle" description="Votre profil actuel ne peut pas consulter cette page." /><section className="panel"><EmptyState icon={LockKeyhole} title="Accès non autorisé" action={<ActionLink to={roleHomes[profile.role]}>Revenir à mon espace</ActionLink>}>Utilisez le profil associé à cet espace pour y accéder.</EmptyState></section></>;
  return children;
}

function NotFoundPage() {
  return <><PageHeading eyebrow="Page introuvable" title="Ce chemin ne mène à aucune page" description="L’adresse est peut-être incorrecte ou la page a été déplacée." /><section className="panel"><EmptyState icon={Compass} title="Retrouvons votre chemin" action={<ActionLink to="/">Revenir à l’accueil</ActionLink>}>La navigation vous permet de retrouver les espaces disponibles.</EmptyState></section></>;
}

function ModulePage({ module }: { module: ModuleId }) {
  switch (module) {
    case 'catalog': return <CatalogPage />;
    case 'offer-detail': return <OfferPage />;
    case 'farmer-offers': return <OfferManagerPage />;
    case 'buyer-requests': return <RequestsPage mine />;
    case 'requests': return <RequestsPage />;
    case 'request-detail': return <RequestPage />;
    case 'messages': return <ConversationsPage />;
    case 'conversation': return <ConversationPage key={window.location.pathname} />;
    case 'checkout': return <CheckoutPage />;
    case 'payment': return <PaymentPage />;
    case 'order-detail': return <OrderPage />;
    case 'buyer-orders': case 'farmer-orders': case 'admin-orders': return <OrdersPage />;
    case 'payouts': return <FinancePage />;
    case 'admin-payments': return <FinancePage admin />;
    case 'disputes': return <DisputesPage />;
    case 'dispute-detail': return <DisputePage />;
    case 'moderation': return <ModerationPage />;
    default: return <WorkspacePage module={module} />;
  }
}

export function App() {
  return <BrowserRouter><BusinessDataProvider><SessionProvider><Routes><Route element={<Layout />}>
    <Route path="/" element={<HomePage />} />
    <Route path="/connexion" element={<ProfilesPage />} />
    <Route path="/profil" element={<Guard roles={allRoles}><ProfilePage /></Guard>} />
    <Route path="/admin" element={<Guard roles={['admin']}><DashboardPage /></Guard>} />
    <Route path="/outils-techniques" element={<Guard roles={['admin']}><TechnicalPage /></Guard>} />
    {moduleRoutes.map(({ path, module, roles }) => <Route key={path} path={path} element={<Guard roles={roles}><ModulePage module={module} /></Guard>} />)}
    <Route path="*" element={<NotFoundPage />} />
  </Route></Routes></SessionProvider></BusinessDataProvider></BrowserRouter>;
}
