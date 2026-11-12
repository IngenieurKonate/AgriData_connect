import { ShoppingBasket, ClipboardList, MessageSquare, Package, Sprout, Wallet, LayoutDashboard, Truck, CreditCard, ShieldCheck, Scale, UserRound, House, type LucideIcon } from 'lucide-react';
import type { Role } from '../domain/types';

export interface NavItem { to: string; label: string; icon: LucideIcon }
export const publicNavigation: NavItem[] = [
  { to: '/', label: 'Bienvenue', icon: House },
  { to: '/offres', label: 'Le catalogue', icon: ShoppingBasket },
  { to: '/connexion', label: 'Choisir un profil', icon: UserRound },
];
export const navigation: Record<Role, NavItem[]> = {
  buyer: [
    { to: '/offres', label: 'Le catalogue', icon: ShoppingBasket },
    { to: '/acheteur/demandes', label: 'Mes demandes', icon: ClipboardList },
    { to: '/messages', label: 'Messages', icon: MessageSquare },
    { to: '/acheteur/commandes', label: 'Mes commandes', icon: Package },
    { to: '/profil', label: 'Mon profil', icon: UserRound },
  ],
  farmer: [
    { to: '/agriculteur/offres', label: 'Mes offres', icon: Sprout },
    { to: '/demandes', label: "Demandes d'achat", icon: ClipboardList },
    { to: '/messages', label: 'Messages', icon: MessageSquare },
    { to: '/agriculteur/commandes', label: 'Commandes reçues', icon: Package },
    { to: '/agriculteur/reglements', label: 'Mes règlements', icon: Wallet },
    { to: '/profil', label: 'Mon profil', icon: UserRound },
  ],
  admin: [
    { to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard },
    { to: '/admin/commandes', label: 'Commandes et livraisons', icon: Truck },
    { to: '/admin/paiements', label: 'Paiements et versements', icon: CreditCard },
    { to: '/admin/litiges', label: 'Litiges', icon: Scale },
    { to: '/admin/moderation', label: 'Utilisateurs et annonces', icon: ShieldCheck },
  ],
};
