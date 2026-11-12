import type { DemoProfile, Role } from '../domain/types';

export const roleLabels: Record<Role, string> = {
  buyer: 'Acheteur', farmer: 'Agriculteur', admin: 'Administrateur',
};

export const roleHomes: Record<Role, string> = {
  buyer: '/offres', farmer: '/agriculteur/offres', admin: '/admin',
};

export const demoProfiles: DemoProfile[] = [
  { id: 'buyer-pro', role: 'buyer', displayName: 'Restaurant Jardin', organization: 'Restaurant Jardin', city: 'Casablanca', address: 'Casablanca', email: 'restaurant@agridata.example', initials: 'RJ', description: 'Acheteur professionnel' },
  { id: 'buyer-private', role: 'buyer', displayName: 'Acheteur particulier', organization: 'Achat en gros à titre particulier', city: 'Rabat', address: 'Rabat', email: 'acheteur@agridata.example', initials: 'AP', description: 'Particulier achetant en gros' },
  { id: 'farmer-coop', role: 'farmer', displayName: 'Coopérative Atlas', organization: 'Coopérative Atlas', city: 'Agadir', address: 'Agadir', email: 'atlas@agridata.example', initials: 'CA', description: 'Coopérative agricole' },
  { id: 'farmer-farm', role: 'farmer', displayName: 'Ferme Amane', organization: 'Ferme Amane', city: 'Meknès', address: 'Meknès', email: 'amane@agridata.example', initials: 'FA', description: 'Exploitation agricole' },
  { id: 'admin', role: 'admin', displayName: 'Administration', organization: 'AgriData Connect', city: 'Casablanca', address: 'Casablanca', email: 'administration@agridata.example', initials: 'AD', description: 'Coordination de la plateforme' },
];
