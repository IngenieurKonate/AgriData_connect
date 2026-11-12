import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ActionLink, Badge, Button, Field, PageHeading, SelectField } from '../../components/ui';
import { useSession } from '../../app/SessionProvider';
import { api } from '../../services/apiClient';
import type { OfferView } from '../../services/contracts';
import { useAction, useApi } from '../../services/useApi';
import { Feedback, money, ProduceVisual } from './shared';

export function CatalogPage() {
  const [q, setQ] = useState('');
  const [product, setProduct] = useState('');
  const [city, setCity] = useState('');
  const [sort, setSort] = useState('recent');
  const [available, setAvailable] = useState(false);
  const query = new URLSearchParams({ q, product, city, sort, available: String(available) });
  const result = useApi<OfferView[]>(`offers?${query}`);
  const reset = () => { setQ(''); setProduct(''); setCity(''); setSort('recent'); setAvailable(false); };
  return <>
    <PageHeading eyebrow="Directement des producteurs" title="Le catalogue" description="Tomates et oignons : choisissez votre lot, retrouvez ses conditions et préparez votre achat." />
    <section className="catalog-banner"><div><p className="eyebrow">Des récoltes, des rencontres</p><h2>Le prochain lot pour<br />votre activité.</h2><p>Des origines claires et des conditions partagées.</p></div><span className="catalog-season">Tomates & oignons<br /><strong>Au fil des récoltes</strong></span></section>
    <section className="panel catalog-filters" aria-label="Rechercher et filtrer les lots">
      <Field label="Rechercher un lot" id="search" type="search" placeholder="Produit, titre, origine…" value={q} onChange={e => setQ(e.target.value)} />
      <SelectField label="Produit" id="product" value={product} onChange={e => setProduct(e.target.value)}><option value="">Tous les produits</option><option value="tomato">Tomates</option><option value="onion">Oignons</option></SelectField>
      <Field label="Ville" id="city" type="search" placeholder="Toutes les villes" value={city} onChange={e => setCity(e.target.value)} />
      <SelectField label="Trier par" id="sort" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">Publication récente</option><option value="price-asc">Prix croissant</option><option value="price-desc">Prix décroissant</option></SelectField>
      <label className="checkbox-field"><input type="checkbox" checked={available} onChange={e => setAvailable(e.target.checked)} />Commandables maintenant</label><Button onClick={reset}>Réinitialiser les filtres</Button>
    </section>
    <Feedback {...result} retry={result.reload}>
      <p className="muted" role="status">{result.data?.length ?? 0} lots trouvés</p>
      {result.data?.length === 0 && <div className="panel purchase-panel"><h2>Aucun lot ne correspond à votre recherche</h2><p>Modifiez votre recherche ou réinitialisez les filtres.</p><Button onClick={reset}>Voir tous les lots</Button></div>}
      <div className="offer-grid">{result.data?.map(offer => <article className="panel offer-card" key={offer.id}><Link to={`/offres/${offer.id}`} aria-label={`Voir ${offer.title}`}><ProduceVisual product={offer.product} offerId={offer.id} imageId={offer.imageIds[0]} /></Link><div className="offer-card-content"><div className="card-meta"><span>{offer.city}</span><Badge>{offer.grade}</Badge></div><h2><Link to={`/offres/${offer.id}`}>{offer.title}</Link></h2><p className="muted">{offer.sellerName}</p><p className="offer-price">{money(offer.pricePerKgCents)}<small> / kg</small></p><p>{offer.availableKg.toLocaleString('fr-FR')} kg disponibles<br /><span className="muted">Minimum : {offer.minimumOrderKg} kg</span></p><ActionLink to={`/offres/${offer.id}`}>Voir le lot</ActionLink></div></article>)}</div>
    </Feedback>
  </>;
}

export function OfferPage() {
  const { id } = useParams();
  const { profile } = useSession();
  const result = useApi<OfferView>(`offers/${encodeURIComponent(id ?? '')}`);
  const action = useAction();
  const navigate = useNavigate();
  const offer = result.data;
  return <><PageHeading eyebrow="Le catalogue" title={offer?.title ?? 'Détail du lot'} description="Les informations du producteur et les conditions de votre achat." action={<ActionLink to="/offres">Revenir au catalogue</ActionLink>} /><Feedback {...result} retry={result.reload}>{offer && <div className="purchase-grid"><section className="panel offer-detail"><ProduceVisual product={offer.product} offerId={offer.id} imageId={offer.imageIds[0]} /><div className="purchase-panel"><Badge>{offer.grade}</Badge><h2>{offer.sellerName}</h2><p>{offer.description}</p><h3>Lieu de collecte</h3><p>{offer.collectionAddress}, {offer.city}</p></div></section><section className="panel purchase-panel"><p className="eyebrow">Conditions de vente</p><p className="offer-price">{money(offer.pricePerKgCents)}<small> / kg</small></p><dl className="amounts"><div><dt>Disponible</dt><dd>{offer.availableKg} kg</dd></div><div><dt>Minimum de commande</dt><dd>{offer.minimumOrderKg} kg</dd></div></dl><p className="muted">Livraison estimée à J+2, à confirmer lors de la planification.</p>{profile?.role === 'buyer' && offer.status === 'published' && offer.availableKg >= offer.minimumOrderKg ? <div className="action-stack"><ActionLink primary to={`/commande/nouvelle?offre=${offer.id}`}>Commander</ActionLink><Button disabled={action.pending} onClick={() => void action.run(async () => { const conversation = await api.createConversation({ offerId: offer.id }) as { id: string }; navigate(`/messages/${conversation.id}`); })}>Discuter avec le producteur</Button></div> : !profile ? <ActionLink primary to="/connexion">Choisir un profil pour commander</ActionLink> : <p>{profile.role === 'buyer' ? 'Ce lot ne peut pas être commandé actuellement.' : 'Les commandes sont réservées aux acheteurs.'}</p>}<Feedback error={action.error} /></section></div>}</Feedback></>;
}
