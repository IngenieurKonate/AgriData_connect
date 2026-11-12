import { ArrowRight, Check, MapPin, ShoppingBasket, Sprout, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeading } from '../../components/ui';
import { demoProfiles, roleHomes, roleLabels } from '../../app/profiles';
import { useSession } from '../../app/SessionProvider';
import type { Role } from '../../domain/types';
import { usePendingRequests } from '../../services/useApi';

const roles: { role: Role; icon: typeof Sprout; description: string }[] = [
  { role: 'buyer', icon: ShoppingBasket, description: 'Trouvez des lots, exprimez vos besoins et suivez vos achats.' },
  { role: 'farmer', icon: Sprout, description: 'Présentez vos récoltes, échangez et suivez vos ventes.' },
  { role: 'admin', icon: ShieldCheck, description: 'Coordonnez les livraisons et accompagnez les transactions.' },
];

export function ProfilesPage() {
  const { profile, selectProfile } = useSession();
  const navigate = useNavigate();
  const pending = usePendingRequests();
  return <>
    <PageHeading eyebrow="Votre activité, votre espace" title="Accédez à votre espace" description="Sélectionnez votre profil pour retrouver vos offres, vos échanges et vos commandes." />
    <div className="profile-choice-grid">{roles.map(({ role, icon: Icon, description }, index) => <section className={`profile-choice role-${role}`} key={role}><div className="profile-choice-heading"><span className="role-symbol"><Icon size={30} strokeWidth={1.4} /></span><span className="step-index">0{index + 1}</span></div><h2>{roleLabels[role]}</h2><p>{description}</p><div className="profile-options">{demoProfiles.filter(p => p.role === role).map(p => <button disabled={pending} key={p.id} className={`profile-option ${profile?.id === p.id ? 'selected' : ''}`} onClick={() => { if (selectProfile(p.id)) navigate(roleHomes[role]); }}><span className="profile-option-copy"><strong>{p.displayName}</strong><span><MapPin size={13} />{p.city} · {p.description}</span></span>{profile?.id === p.id ? <Check size={19} /> : <ArrowRight size={19} />}</button>)}</div></section>)}</div>
  </>;
}
