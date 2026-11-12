import { ArrowDown, ArrowRight, ClipboardCheck, Handshake, MapPin, Package, ShieldCheck, ShoppingBasket, Sprout, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ActionLink } from '../../components/ui';

const steps = [
  { icon: ShoppingBasket, title: 'Trouvez le bon lot', text: 'Consultez les offres et les conditions de chaque producteur.' },
  { icon: Handshake, title: 'Convenez des conditions', text: 'Achetez au prix affiché ou échangez pour négocier.' },
  { icon: Truck, title: 'Suivez la livraison', text: 'Retrouvez les étapes de collecte et de livraison au même endroit.' },
];

export function HomePage() {
  return <>
    <div className="welcome-topline"><span className="eyebrow">Le lien entre vos récoltes et vos achats</span><span className="location-label"><MapPin size={15} />Maroc</span></div>
    <section className="home-hero">
      <div className="hero-copy"><span className="hero-kicker"><span className="status-dot" />Commerce agricole de proximité</span><h1 tabIndex={-1}>De bons produits.<br />Des échanges<br /><em>bien suivis.</em></h1><p>Producteurs et acheteurs en gros, retrouvez vos offres, vos commandes et vos livraisons dans un même espace.</p><div className="hero-actions"><ActionLink to="/connexion" primary>Accéder à mon espace</ActionLink><Link className="text-link" to="/offres">Voir le catalogue<ArrowRight size={17} /></Link></div><div className="hero-caption"><Sprout size={17} />Tomates et oignons<span />Du producteur à l'acheteur</div></div>
      <div className="journey-panel"><div className="journey-panel-header"><span className="eyebrow">Une commande, un fil commun</span><Package size={23} strokeWidth={1.4} /></div><div className="field-art" aria-hidden="true"><div className="field-sun" /><div className="field-row field-row-one" /><div className="field-row field-row-two" /><div className="field-row field-row-three" /><span className="field-caption">Cultiver le lien.</span></div><div className="journey-card"><span className="journey-number">01</span><div><strong>Du lot à la commande</strong><span>Prix, quantité et conditions réunis</span></div><ClipboardCheck size={21} /></div><div className="journey-connector"><ArrowDown size={17} /></div><div className="journey-card"><span className="journey-number">02</span><div><strong>De la livraison au règlement</strong><span>Chaque étape reste visible</span></div><Truck size={21} /></div><p className="journey-footnote"><ShieldCheck size={16} />Réception confirmée avant versement normal</p></div>
    </section>
    <section className="how-section" aria-labelledby="how-title"><div className="section-heading"><div><p className="eyebrow">Un parcours partagé</p><h2 id="how-title">Chacun son rôle. Un même suivi.</h2></div><span className="section-note">Simple à parcourir, étape par étape.</span></div><div className="step-grid">{steps.map(({ icon: Icon, title, text }, index) => <article className="step-card" key={title}><div className="step-card-top"><span className="step-icon"><Icon size={25} strokeWidth={1.5} /></span><span className="step-index">0{index + 1}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div></section>
  </>;
}
