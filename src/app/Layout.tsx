import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, Sprout, SwitchCamera } from 'lucide-react';
import { Dialog, EmptyState } from '../components/ui';
import { useSession } from './SessionProvider';
import { useBusinessData } from './BusinessDataProvider';
import { navigation, publicNavigation } from './navigation';
import { roleLabels } from './profiles';
import { usePendingRequests } from '../services/useApi';
import { Notifications } from '../features/workspace/Notifications';

export function Layout() {
  const { profile, logout, storageWarning } = useSession();
  const { error: dataError, data } = useBusinessData();
  const pending = usePendingRequests();
  const unread = data?.notifications.filter(item => item.userId === profile?.id && !item.readAt).length ?? 0;
  const currentProfile = data?.users.find(item => item.id === profile?.id);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const items = profile ? navigation[profile.role] : publicNavigation;
  useEffect(() => {
    const handler = (event: Event) => navigate((event as CustomEvent<string>).detail);
    window.addEventListener('notification-navigate', handler);
    return () => window.removeEventListener('notification-navigate', handler);
  }, [navigate]);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
    const heading = document.querySelector('h1');
    if (heading) {
      document.title = `${heading.textContent} | AgriData Connect`;
      heading.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  const sidebarContent = <>
    <Link className="wordmark" to="/" aria-label="AgriData Connect, accueil"><img className="brand-logo" src="/brand/logo-compact-inverse.png" alt="AgriData Connect" /></Link>
    <div className="sidebar-label">{profile ? `Espace ${roleLabels[profile.role].toLowerCase()}` : 'Découvrir la plateforme'}</div>
    <nav aria-label="Navigation principale">{items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/' || to === '/admin'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Icon size={19} strokeWidth={1.7} aria-hidden="true" /><span>{label}</span></NavLink>)}</nav>
    <div className="sidebar-bottom"><div className="sidebar-note"><Sprout size={25} strokeWidth={1.4} aria-hidden="true" /><p>De la terre à l'acheteur.<br /><strong>Chaque étape compte.</strong></p><span>Tomates & oignons · Maroc</span></div></div>
    <div className="sidebar-footer">AgriData Connect</div>
  </>;

  return <>
    <a href="#contenu" className="skip-link">Aller au contenu</a>
    <aside className="sidebar">{sidebarContent}</aside>
    <div className="workspace">
      <header className="topbar">
        <div className="topbar-context"><button className="icon-button mobile-menu" aria-label="Ouvrir le menu" onClick={() => setMenuOpen(true)}><Menu size={22} /></button><span className="topbar-title">{profile ? roleLabels[profile.role] : 'Bienvenue'}</span><span className="topbar-divider">/</span><span className="muted">AgriData Connect</span></div>
        <div className="account-actions">
          <Link className="profile-switch" to="/connexion" aria-disabled={pending} onClick={event => { if (pending) event.preventDefault(); }} aria-label={profile ? 'Changer de profil' : 'Choisir un profil'} title={profile ? 'Changer de profil' : 'Choisir un profil'}><SwitchCamera size={18} /><span>{profile ? 'Changer de profil' : 'Choisir un profil'}</span></Link>
          <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotificationsOpen(true)}><Bell size={20} />{unread > 0 && <span className="notification-count" aria-hidden="true">{unread}</span>}</button>
          {profile ? <><Link to="/profil" className="account-link" aria-label="Mon profil"><span className="avatar">{profile.initials}</span><span className="account-text"><strong>{currentProfile?.organization ?? profile.organization}</strong><small>{currentProfile?.city ?? profile.city}</small></span></Link><button disabled={pending} className="icon-button" aria-label="Se déconnecter" title="Se déconnecter" onClick={logout}><LogOut size={18} /></button></> : <Link className="guest-link" to="/connexion"><span className="avatar">V</span><span>Visiteur</span></Link>}
        </div>
      </header>
      {storageWarning && <div role="alert" className="storage-warning">Le navigateur ne peut pas conserver votre profil. Vous pouvez continuer ; il faudra le choisir à nouveau après rechargement.</div>}
      {dataError && <div role="alert" className="storage-warning">{dataError === 'STORAGE_UNAVAILABLE' ? 'Le navigateur ne peut pas enregistrer les modifications. Réessayez après avoir rétabli le stockage.' : 'Les données enregistrées ne peuvent pas être lues.'} {profile?.role === 'admin' && <Link className="text-link" to="/outils-techniques">Ouvrir les outils de récupération</Link>}</div>}
      <main id="contenu" className="main-content"><Outlet key={profile?.id ?? 'visitor'} /></main>
      <footer className="page-footer"><span>AgriData Connect</span><span>Des échanges clairs, du lot au règlement.</span><span>Maroc</span></footer>
    </div>
    <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title="Navigation"><div className="mobile-navigation">{sidebarContent}</div></Dialog>
    <Dialog open={notificationsOpen} onClose={() => setNotificationsOpen(false)} title="Notifications">{notificationsOpen && profile ? <Notifications key={profile.id} close={() => setNotificationsOpen(false)} /> : <EmptyState icon={Bell} title="Vos notifications">Choisissez un profil pour consulter vos notifications.</EmptyState>}</Dialog>
  </>;
}
