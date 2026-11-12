import { test, expect, type Page } from '@playwright/test';
import type { BusinessData } from '../src/domain/types';

async function choose(page: Page, name: string) {
  await page.goto('/connexion');
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await expect(page).not.toHaveURL(/\/connexion$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Chargement des informations…')).toHaveCount(0);
}
const state = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('agridataconnect.demo.v1')!) as BusinessData);
const ready = async (page: Page) => { await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); await expect(page.getByText('Chargement des informations…')).toHaveCount(0); };

test('photos locales décodées, publication, modification et désactivation d’un lot', async ({ page }) => {
  test.setTimeout(75_000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await choose(page, 'Coopérative Atlas');
  await page.getByRole('button', { name: 'Publier une offre', exact: true }).click();
  await page.getByLabel('Titre du lot').fill('Tomates du verger');
  await page.getByLabel('Prix (MAD/kg)', { exact: true }).fill('3.25');
  await page.getByLabel('Stock total restant (kg)').fill('1200');
  await page.getByLabel('Minimum de commande (kg)').fill('200');
  await page.getByLabel('Ville de collecte').fill('Taroudant');
  await page.getByLabel('Description du lot').fill('Tomates triées en caisses de récolte.');
  await page.getByRole('radio', { name: 'Tomates cerises rouges en grappe' }).check();
  await page.getByRole('button', { name: 'Publier le lot', exact: true }).click();
  await expect(page.getByText('Votre lot est publié dans le catalogue.')).toBeVisible();
  const id = (await state(page)).offers.find(item => item.title === 'Tomates du verger')!.id;
  await choose(page, 'Restaurant Jardin');
  await page.getByLabel('Ville', { exact: true }).fill('Taroudant');
  await page.getByLabel('Rechercher un lot').fill('Tomates du verger');
  const card = page.locator('.offer-card').filter({ hasText: 'Tomates du verger' });
  await expect(card).toHaveCount(1);
  await expect(card.locator('img')).toHaveAttribute('src', '/produce/tomates-cerises.jpg');
  await expect(card).toContainText('3,25 MAD');
  await card.getByRole('link', { name: 'Voir le lot', exact: true }).click();
  await expect(page.locator('.offer-detail img')).toHaveAttribute('src', '/produce/tomates-cerises.jpg');
  await page.reload(); await expect(page.getByRole('heading', { name: 'Tomates du verger', exact: true })).toBeVisible();
  const photos = ['tomates-rondes-m', 'tomates-allongees-l', 'tomates-cerises', 'tomates-serre', 'tomates-rondes-xl', 'oignons-jaunes', 'oignons-rouges', 'oignons-blancs'];
  expect(await page.evaluate(async files => Promise.all(files.map(async name => { const img = new Image(); img.src = `/produce/${name}.jpg`; await img.decode(); return img.naturalWidth >= 1000 && img.naturalHeight > 0; })), photos)).toEqual(photos.map(() => true));
  await choose(page, 'Coopérative Atlas');
  const own = page.locator('.offer-card').filter({ hasText: 'Tomates du verger' });
  await own.getByRole('button', { name: 'Modifier le lot' }).click();
  await page.getByLabel('Prix (MAD/kg)', { exact: true }).fill('3.45');
  await page.getByRole('button', { name: 'Enregistrer le lot' }).click();
  await expect(own).toContainText('3,45 MAD');
  await own.getByRole('button', { name: 'Désactiver le lot' }).click();
  await page.getByRole('button', { name: 'Confirmer la désactivation' }).click();
  await expect(own).toContainText('Désactivée');
  await choose(page, 'Restaurant Jardin');
  await page.getByLabel('Rechercher un lot').fill('Tomates du verger');
  await expect(page.getByText('Aucun lot ne correspond à votre recherche')).toBeVisible();
  await page.goto(`/offres/${id}`); await expect(page.getByRole('alert')).toContainText('introuvable');
  expect(errors).toEqual([]);
});

test('messages, contre-proposition acheteur acceptée par le producteur et commande unique', async ({ page }) => {
  test.setTimeout(75_000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await choose(page, 'Restaurant Jardin');
  await page.goto('/messages/conversation-offer');
  await page.getByLabel('Votre message').fill('Je souhaite 600 kg en caisses.');
  await page.getByRole('button', { name: 'Envoyer le message' }).click();
  await expect(page.locator('.message-thread')).toContainText('Je souhaite 600 kg en caisses.');
  await page.getByRole('button', { name: 'Faire une contre-proposition' }).click();
  await page.getByLabel('Quantité proposée (kg)').fill('600');
  await page.getByLabel('Prix proposé (MAD/kg)').fill('3.10');
  await page.getByLabel('Conditions de qualité convenues').fill('Calibre M, caisses triées');
  await page.getByRole('button', { name: 'Envoyer la contre-proposition' }).click();
  await expect(page.locator('.proposal-card')).toHaveCount(2);
  await expect(page.locator('.proposal-card').last()).toContainText('Remplacée');
  await expect(page.getByRole('button', { name: 'Accepter la proposition' })).toHaveCount(0);
  await choose(page, 'Coopérative Atlas');
  await page.goto('/messages/conversation-offer');
  await expect(page.locator('.message-thread')).toContainText('Je souhaite 600 kg en caisses.');
  await page.getByRole('button', { name: 'Accepter la proposition' }).click();
  await expect(page.locator('.proposal-card').first()).toContainText('Acceptée');
  expect((await state(page)).orders).toHaveLength(7);
  expect((await state(page)).reservations.filter(item => item.status === 'active')).toHaveLength(1);
  await choose(page, 'Restaurant Jardin'); await page.goto('/messages/conversation-offer');
  await page.getByRole('link', { name: 'Préparer la commande' }).click();
  await expect(page.getByLabel('Quantité (kg)', { exact: true })).toHaveValue('600');
  await expect(page.getByLabel('Quantité (kg)', { exact: true })).toHaveAttribute('readonly', '');
  await page.getByRole('button', { name: 'Calculer le récapitulatif' }).click();
  await expect(page.getByText('2 160,00 MAD', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmer et réserver' }).click();
  await expect(page).toHaveURL(/\/commandes\/[^/]+\/paiement$/);
  const orderId = page.url().split('/').at(-2)!;
  await ready(page);
  await page.goto('/messages/conversation-offer');
  await expect(page.getByRole('link', { name: 'Voir la commande liée' })).toHaveAttribute('href', `/commandes/${orderId}`);
  await expect(page.getByRole('link', { name: 'Préparer la commande' })).toHaveCount(0);
  await page.reload(); await ready(page);
  const order = (await state(page)).orders.find(item => item.id === orderId)!;
  expect(order.quantityKg).toBe(600); expect(order.goodsCents).toBe(186000); expect(order.qualityNotes).toBe('Calibre M, caisses triées');
  expect((await state(page)).orders).toHaveLength(8);
  expect(errors).toEqual([]);
});

test('demande publiée, réponse, acceptation, commande puis réouverture après annulation', async ({ page }) => {
  test.setTimeout(90_000);
  await choose(page, 'Restaurant Jardin'); await page.goto('/acheteur/demandes');
  await page.getByRole('button', { name: 'Publier une demande', exact: true }).click();
  await page.getByLabel('Quantité souhaitée (kg)').fill('700');
  await page.getByLabel('Destination', { exact: true }).fill('Tanger');
  await page.getByLabel('Date souhaitée', { exact: true }).fill('2026-12-15');
  await page.getByLabel('Description du besoin').fill('Approvisionnement du restaurant à Tanger.');
  await page.getByRole('button', { name: 'Publier la demande', exact: true }).click();
  await expect(page.getByText('Votre demande est publiée.')).toBeVisible();
  const requestId = (await state(page)).purchaseRequests.find(item => item.destination === 'Tanger')!.id;
  await choose(page, 'Coopérative Atlas'); await page.goto(`/demandes/${requestId}`);
  await expect(page.getByLabel('Lot proposé').locator('option')).toHaveCount(2);
  await page.getByLabel('Prix proposé (MAD/kg)').fill('3.20');
  await page.getByRole('button', { name: 'Envoyer la proposition' }).click();
  await expect(page).toHaveURL(/\/messages\/conversation-/); await ready(page);
  const conversationUrl = new URL(page.url()).pathname;
  await choose(page, 'Restaurant Jardin'); await page.goto('/acheteur/demandes');
  const requestCard = page.locator('.request-grid article').filter({ hasText: 'Approvisionnement du restaurant à Tanger.' });
  await requestCard.getByRole('link', { name: 'Échanger avec Coopérative Atlas' }).click();
  await page.getByRole('button', { name: 'Accepter la proposition' }).click();
  await page.getByRole('link', { name: 'Préparer la commande' }).click();
  await page.getByRole('button', { name: 'Calculer le récapitulatif' }).click();
  await expect(page.getByText('2 565,00 MAD', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmer et réserver' }).click();
  await expect(page).toHaveURL(/\/commandes\/[^/]+\/paiement$/); await ready(page);
  const orderId = page.url().split('/').at(-2)!;
  await page.goto('/acheteur/demandes'); await expect(requestCard).toContainText('Commandée');
  await expect(requestCard.getByRole('button', { name: 'Modifier la demande' })).toHaveCount(0);
  await page.goto(`/commandes/${orderId}`);
  await page.getByRole('button', { name: 'Annuler la commande', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer l’annulation' }).click();
  await expect(page.getByText('Cette commande est annulée. Sa réservation a été libérée.')).toBeVisible();
  await page.goto('/acheteur/demandes'); await expect(requestCard).toContainText('Ouverte');
  await page.goto(conversationUrl); await expect(page.getByRole('link', { name: 'Voir la commande liée' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Préparer la commande' })).toHaveCount(0);
  const data = await state(page);
  expect(data.purchaseRequests.find(item => item.id === requestId)?.orderId).toBeUndefined();
  expect(data.reservations.find(item => item.orderId === orderId)?.status).toBe('released');
});

test('modification et fermeture invalident les accords et avertissent les producteurs', async ({ page }) => {
  test.setTimeout(75_000);
  await choose(page, 'Acheteur particulier'); await page.goto('/messages/conversation-request');
  await page.getByRole('button', { name: 'Accepter la proposition' }).click();
  await expect(page.getByRole('link', { name: 'Préparer la commande' })).toBeVisible();
  await page.goto('/acheteur/demandes');
  await page.getByRole('button', { name: 'Modifier la demande' }).click();
  await page.getByLabel('Destination', { exact: true }).fill('Salé');
  await page.getByRole('button', { name: 'Enregistrer la demande' }).click();
  await expect(page.getByText('Votre demande a été modifiée.', { exact: false })).toBeVisible();
  await choose(page, 'Ferme Amane'); await page.goto('/messages/conversation-request');
  await expect(page.locator('.proposal-card')).toContainText('Invalidée');
  const notice = (await state(page)).notifications.find(item => item.type === 'request_changed' && item.userId === 'farmer-farm');
  expect(notice?.targetPath).toBe('/messages/conversation-request');
  await page.getByRole('button', { name: 'Nouvelle proposition' }).click();
  await page.getByRole('button', { name: 'Envoyer la proposition' }).click();
  await expect(page.locator('.proposal-card')).toHaveCount(2);
  await choose(page, 'Acheteur particulier'); await page.goto('/acheteur/demandes');
  await page.getByRole('button', { name: 'Fermer la demande', exact: true }).click();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Fermer la demande', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer la fermeture' }).click();
  await expect(page.getByText('La demande a été fermée.', { exact: true })).toBeVisible();
  await choose(page, 'Ferme Amane'); await page.goto('/messages/conversation-request');
  await expect(page.getByText('Invalidée', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Nouvelle proposition' })).toHaveCount(0);
  await page.goto('/demandes/request-onion-rabat'); await expect(page.getByRole('alert')).toContainText('introuvable');
});

test('refus de proposition et accès direct interdit à un autre participant', async ({ page }) => {
  await choose(page, 'Restaurant Jardin'); await page.goto('/messages/conversation-offer');
  await page.getByRole('button', { name: 'Refuser la proposition' }).click();
  await expect(page.locator('.proposal-card')).toContainText('Refusée');
  await page.reload(); await expect(page.getByRole('button', { name: 'Accepter la proposition' })).toHaveCount(0);
  await choose(page, 'Acheteur particulier'); await page.goto('/messages/conversation-offer');
  await expect(page.getByRole('alert')).toContainText('autre compte');
  await expect(page.getByLabel('Votre message')).toHaveCount(0);
});

for (const width of [1440, 1366, 390, 360]) {
  test(`publication, demandes et conversations sans débordement à ${width} px`, async ({ page }) => {
    test.setTimeout(75_000);
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 900 });
    await choose(page, 'Coopérative Atlas');
    await page.getByRole('button', { name: 'Publier une offre' }).click();
    await expect(page.getByRole('heading', { name: 'Publier un lot' })).toBeVisible();
    for (const image of await page.locator('.produce-visual img').all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((element: HTMLImageElement) => element.decode());
    }
    await page.evaluate(() => scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.cache/screenshots/${width}-publication.png`, fullPage: true });
    for (const path of ['/demandes', '/demandes/request-tomato-casablanca', '/messages', '/messages/conversation-offer']) {
      await page.goto(path); await ready(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await expect(page.getByLabel('Votre message')).toBeVisible();
    await page.screenshot({ path: `.cache/screenshots/${width}-conversation.png`, fullPage: true });
    await choose(page, 'Restaurant Jardin'); await page.goto('/acheteur/demandes');
    await page.getByRole('button', { name: 'Publier une demande' }).click();
    await expect(page.getByLabel('Quantité souhaitée (kg)')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.cache/screenshots/${width}-demandes.png`, fullPage: true });
  });
}
