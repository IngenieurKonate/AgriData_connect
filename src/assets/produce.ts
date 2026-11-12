type ProducePhoto = { file: string; alt: string; contained?: boolean };

// Local library photos: sources and licenses in public/produce/CREDITS.md.
// Stable offer IDs also cover data already saved in the browser.
const photos: Record<string, ProducePhoto> = {
  'offer-tomato-round-m': { file: 'tomates-rondes-m.jpg', alt: 'Tomates rouges rondes avec leurs pédoncules' },
  'offer-tomato-elongated-l': { file: 'tomates-allongees-l.jpg', alt: 'Récolte de tomates rouges allongées' },
  'offer-tomato-cherry': { file: 'tomates-cerises.jpg', alt: 'Tomates cerises rouges en grappe' },
  'offer-tomato-greenhouse': { file: 'tomates-serre.jpg', alt: 'Tomates mûres sur leurs plants' },
  'offer-tomato-disabled': { file: 'tomates-rondes-xl.jpg', alt: 'Récolte de tomates rouges rondes' },
  'offer-onion-yellow': { file: 'oignons-jaunes.jpg', alt: 'Oignons à peau jaune dorée' },
  'offer-onion-red': { file: 'oignons-rouges.jpg', alt: 'Récolte d’oignons rouges' },
  'offer-onion-white': { file: 'oignons-blancs.jpg', alt: 'Oignon blanc sur fond clair', contained: true },
};

export const photoLibrary = Object.entries(photos).map(([id, photo]) => ({ id, product: id.includes('tomato') ? 'tomato' as const : 'onion' as const, ...photo }));

export function producePhoto(offerId: string, product: 'tomato' | 'onion', imageId?: string): ProducePhoto {
  return photos[imageId ?? ''] ?? photos[offerId] ?? photos[product === 'tomato' ? 'offer-tomato-round-m' : 'offer-onion-yellow'];
}
