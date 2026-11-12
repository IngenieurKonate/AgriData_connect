import { useState } from 'react';
import { ActionLink, Badge, Button, Dialog, Field, PageHeading, SelectField, TextAreaField } from '../../components/ui';
import { photoLibrary } from '../../assets/produce';
import type { Product, UserRecord } from '../../domain/types';
import type { OfferView } from '../../services/contracts';
import { api } from '../../services/apiClient';
import { useAction, useApi } from '../../services/useApi';
import { Feedback, money, ProduceVisual } from '../purchase/shared';

function OfferForm({ offer, user, onSaved, onCancel }: { offer?: OfferView; user: UserRecord; onSaved: () => void; onCancel: () => void }) {
  const [product, setProduct] = useState<Product>(offer?.product ?? 'tomato');
  const [imageId, setImageId] = useState(offer?.imageIds.find(id => photoLibrary.some(photo => photo.id === id)) ?? (offer && photoLibrary.some(photo => photo.id === offer.id) ? offer.id : photoLibrary.find(photo => photo.product === product)!.id));
  const action = useAction();
  return <section className="panel purchase-panel"><h2>{offer ? 'Modifier le lot' : 'Publier un lot'}</h2><form onSubmit={event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = { title: form.get('title'), description: form.get('description'), grade: form.get('grade'), pricePerKgCents: Math.round(Number(form.get('price')) * 100), stockRemainingKg: Number(form.get('stock')), minimumOrderKg: Number(form.get('minimum')), city: form.get('city'), collectionAddress: form.get('address'), imageIds: [imageId] };
    void action.run(async () => { if (offer) await api.updateOffer(offer.id, { ...input, version: offer.version }); else await api.createOffer({ ...input, product }); onSaved(); });
  }}><fieldset disabled={action.pending}>
    <div className="form-grid"><SelectField id="offer-product" label="Produit" value={product} disabled={Boolean(offer)} onChange={event => { const value = event.target.value as Product; setProduct(value); setImageId(photoLibrary.find(photo => photo.product === value)!.id); }}><option value="tomato">Tomates</option><option value="onion">Oignons</option></SelectField><Field id="offer-title" name="title" label="Titre du lot" defaultValue={offer?.title} maxLength={120} required />
      <Field id="offer-grade" name="grade" label="Calibre / qualité" defaultValue={offer?.grade ?? 'Non précisé'} maxLength={80} required /><Field id="offer-price" name="price" label="Prix (MAD/kg)" type="number" min="0.01" step="0.01" defaultValue={offer ? offer.pricePerKgCents / 100 : undefined} required />
      <Field id="offer-stock" name="stock" label="Stock total restant (kg)" type="number" min={offer ? offer.stockRemainingKg - offer.availableKg : 1} step="1" defaultValue={offer?.stockRemainingKg} required /><Field id="offer-minimum" name="minimum" label="Minimum de commande (kg)" type="number" min="1" step="1" defaultValue={offer?.minimumOrderKg ?? 100} required />
      <Field id="offer-city" name="city" label="Ville de collecte" defaultValue={offer?.city ?? user.city} maxLength={120} required /><Field id="offer-address" name="address" label="Lieu de collecte" defaultValue={offer?.collectionAddress ?? user.address} maxLength={200} required /></div>
    {offer && <p className="muted">{offer.stockRemainingKg - offer.availableKg} kg sont réservés. Les commandes existantes conservent leurs conditions.</p>}
    <TextAreaField id="offer-description" name="description" label="Description du lot" defaultValue={offer?.description} rows={3} maxLength={1000} required />
    <fieldset className="photo-picker"><legend>Photo du lot</legend><div className="photo-options">{photoLibrary.filter(photo => photo.product === product).map(photo => <label className={`photo-option${imageId === photo.id ? ' selected' : ''}`} key={photo.id}><input type="radio" name="photo" value={photo.id} checked={imageId === photo.id} onChange={() => setImageId(photo.id)} /><img src={`/produce/${photo.file}`} alt="" /><span>{photo.alt}</span></label>)}</div></fieldset>
    <Feedback error={action.error} /><div className="action-row"><Button variant="primary" type="submit">{action.pending ? 'Enregistrement…' : offer ? 'Enregistrer le lot' : 'Publier le lot'}</Button><Button type="button" onClick={onCancel}>Annuler</Button></div>
  </fieldset></form></section>;
}

export function OfferManagerPage() {
  const result = useApi<OfferView[]>('offers?mine=true');
  const user = useApi<UserRecord>('me');
  const [editing, setEditing] = useState<OfferView | 'new' | null>(null);
  const [deactivating, setDeactivating] = useState<OfferView | null>(null);
  const [notice, setNotice] = useState('');
  const action = useAction();
  return <><PageHeading eyebrow="Votre production" title="Mes offres" description="Publiez vos lots et ajustez leurs conditions de vente." action={<Button variant="primary" disabled={Boolean(editing)} onClick={() => { setEditing('new'); setNotice(''); }}>Publier une offre</Button>} />
    {notice && <p className="notice" role="status">{notice}</p>}
    <Feedback loading={result.loading || user.loading} error={result.error ?? user.error} retry={() => { result.reload(); user.reload(); }}>
      {editing && user.data && <OfferForm key={typeof editing === 'string' ? 'new' : editing.id} offer={typeof editing === 'string' ? undefined : editing} user={user.data} onCancel={() => setEditing(null)} onSaved={() => { setNotice(editing === 'new' ? 'Votre lot est publié dans le catalogue.' : 'Les conditions du lot ont été enregistrées.'); setEditing(null); result.reload(); }} />}
      {result.data?.length === 0 && <p className="panel purchase-panel">Vous n’avez pas encore publié de lot.</p>}
      <div className="offer-grid">{result.data?.map(offer => <article className="panel offer-card" key={offer.id}><ProduceVisual product={offer.product} offerId={offer.id} imageId={offer.imageIds[0]} /><div className="offer-card-content"><Badge>{offer.status === 'published' ? 'Publiée' : offer.status === 'disabled' ? 'Désactivée' : 'Suspendue'}</Badge><h2>{offer.title}</h2><p className="offer-price">{money(offer.pricePerKgCents)}<small> / kg</small></p><p>{offer.availableKg} kg disponibles · minimum {offer.minimumOrderKg} kg</p><div className="action-stack"><ActionLink to={`/offres/${offer.id}`}>Voir le lot</ActionLink>{offer.status !== 'suspended' && <><Button disabled={action.pending || Boolean(editing)} onClick={() => { setEditing(offer); setNotice(''); window.scrollTo(0, 0); }}>Modifier le lot</Button><Button disabled={action.pending} onClick={() => { if (offer.status === 'published') setDeactivating(offer); else void action.run(async () => { await api.updateOffer(offer.id, { status: 'published', version: offer.version }); result.reload(); setNotice('Votre lot est de nouveau publié.'); }); }}>{offer.status === 'published' ? 'Désactiver le lot' : 'Republier le lot'}</Button></>}</div></div></article>)}</div>
    </Feedback><Feedback error={action.error} />
    <Dialog open={Boolean(deactivating)} title="Désactiver ce lot" onClose={() => { if (!action.pending) setDeactivating(null); }}><p>Ce lot ne pourra plus recevoir de nouvelle commande. Les commandes déjà créées poursuivent leur livraison.</p><Feedback error={action.error} /><Button variant="danger" disabled={action.pending} onClick={() => void action.run(async () => { if (!deactivating) return; await api.updateOffer(deactivating.id, { status: 'disabled', version: deactivating.version }); setDeactivating(null); result.reload(); setNotice('Le lot a été désactivé.'); })}>Confirmer la désactivation</Button></Dialog>
  </>;
}
