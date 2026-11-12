import { test, expect, type Page } from '@playwright/test';

async function choose(page: Page, name: string) {
  await page.goto('/connexion');
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Accédez à votre espace');
}
async function createOrder(page: Page) {
  await choose(page, 'Restaurant Jardin');
  await page.goto('/offres/offer-tomato-round-m');
  await page.getByRole('link', { name: 'Commander', exact: true }).click();
  await page.getByLabel('Quantité (kg)', { exact: true }).fill('500');
  await page.getByRole('button', { name: 'Calculer le récapitulatif' }).click();
  await expect(page.getByText('1 975,00 MAD', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmer et réserver' }).click();
  await expect(page).toHaveURL(/\/commandes\/[^/]+\/paiement$/);
  const id = page.url().split('/').at(-2)!;
  await expect(page.getByRole('button', { name: 'Préparer le paiement' })).toBeVisible();
  return id;
}

test('achat Naps refusé puis réussi, livraison, réception et versement', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const id = await createOrder(page);
  await page.getByRole('button', { name: 'Préparer le paiement' }).click();
  await page.getByRole('button', { name: 'Déclarer un refus de paiement' }).click();
  await expect(page.getByText('Le paiement a été refusé.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Préparer le paiement' }).click();
  await page.getByRole('button', { name: 'Valider le paiement', exact: true }).click();
  await expect(page.getByText('Paiement confirmé. La collecte peut être organisée.')).toBeVisible();
  await page.reload(); await expect(page.getByText('Paiement confirmé. La collecte peut être organisée.')).toBeVisible();
  await choose(page, 'Administration'); await page.goto(`/commandes/${id}`);
  await page.getByLabel('Date et heure de collecte').fill('2026-11-12T10:00');
  await page.getByLabel('Arrivée estimée').fill('2026-11-13T12:00');
  await page.getByRole('button', { name: 'Planifier la collecte' }).click();
  for (const name of ['Confirmer la collecte', 'Démarrer la livraison', 'Signaler la remise']) await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Effectuer le versement' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Relancer l’acheteur' }).click();
  await expect(page.getByText('Le rappel a été envoyé à l’acheteur.')).toBeVisible();
  await choose(page, 'Coopérative Atlas'); await page.goto(`/commandes/${id}`);
  await expect(page.getByRole('heading', { name: 'Remise signalée', exact: true })).toBeVisible();
  await expect(page.getByText('1 632,00 MAD', { exact: true })).toBeVisible();
  await choose(page, 'Restaurant Jardin'); await page.goto(`/commandes/${id}`);
  await page.getByRole('button', { name: 'Confirmer la réception conforme' }).click();
  await page.getByRole('button', { name: 'Oui, le lot est conforme' }).click();
  await expect(page.getByText('Réception conforme confirmée.', { exact: false })).toBeVisible();
  await choose(page, 'Administration'); await page.goto(`/commandes/${id}`);
  await page.getByRole('button', { name: 'Effectuer le versement' }).click();
  await expect(page.getByText('Cette commande est clôturée.')).toBeVisible();
  await page.reload(); await expect(page.getByText('Cette commande est clôturée.')).toBeVisible();
  await page.screenshot({ path: '.cache/screenshots/order-complete.png', fullPage: true });
  const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('agridataconnect.demo.v1')!));
  expect(snapshot.stockMovements.filter((entry: { orderId: string }) => entry.orderId === id)).toHaveLength(1);
  expect(snapshot.payouts.filter((entry: { orderId: string }) => entry.orderId === id)).toHaveLength(1);
  expect(snapshot.payouts.find((entry: { orderId: string }) => entry.orderId === id).netCents).toBe(163200);
  expect(errors).toEqual([]);
});

test('Cash Plus attend une confirmation explicite et conserve la réservation', async ({ page }) => {
  const id = await createOrder(page);
  await page.getByLabel('Moyen de paiement').selectOption('cash_plus');
  await page.getByRole('button', { name: 'Préparer le paiement' }).click();
  await expect(page.getByRole('heading', { name: 'En attente de paiement en agence' })).toBeVisible();
  const reference = await page.locator('.reference').first().innerText(); expect(reference).toMatch(/^DEMO-CP-/);
  await page.reload(); await expect(page.getByRole('heading', { name: 'En attente de paiement en agence' })).toBeVisible();
  await choose(page, 'Administration'); await page.goto(`/commandes/${id}`);
  await expect(page.getByText('La collecte sera possible après confirmation du paiement.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Planifier la collecte' })).toHaveCount(0);
  await page.goto('/admin/paiements');
  const paymentRow = page.locator('li').filter({ has: page.getByRole('link', { name: reference, exact: true }) });
  await paymentRow.getByRole('button', { name: 'Confirmer l’encaissement' }).click();
  await expect(paymentRow).toContainText('Confirmé');
  await page.goto(`/commandes/${id}`); await expect(page.getByRole('button', { name: 'Planifier la collecte' })).toBeVisible();
});

test('filtres, limites de quantité, coordonnées et erreurs récupérables', async ({ page }) => {
  await choose(page, 'Restaurant Jardin');
  await page.getByLabel('Rechercher un lot').fill('introuvable');
  await expect(page.getByText('Aucun lot ne correspond à votre recherche')).toBeVisible();
  await page.getByRole('button', { name: 'Réinitialiser les filtres' }).click();
  await expect(page.locator('.offer-card')).toHaveCount(6);
  await page.goto('/profil'); await page.getByLabel('Ville', { exact: true }).fill('Tanger');
  await page.getByRole('button', { name: 'Enregistrer les coordonnées' }).click();
  await expect(page.getByText('Vos coordonnées ont été enregistrées.')).toBeVisible();
  await page.reload(); await expect(page.getByLabel('Ville', { exact: true })).toHaveValue('Tanger');
  await page.goto('/commande/nouvelle?offre=offer-tomato-round-m');
  await expect(page.getByLabel('Ville de livraison')).toHaveValue('Tanger');
  await page.getByLabel('Quantité (kg)', { exact: true }).fill('1');
  await expect(page.getByRole('button', { name: 'Calculer le récapitulatif' })).toBeDisabled();
  await choose(page, 'Administration'); await page.goto('/outils-techniques');
  await page.getByRole('button', { name: 'Forcer une erreur sur la prochaine requête' }).click();
  await expect(page.getByText('La prochaine requête API échouera', { exact: false })).toBeVisible();
  await page.locator('.sidebar').getByRole('link', { name: 'AgriData Connect, accueil' }).click();
  await page.getByRole('link', { name: 'Voir le catalogue' }).click();
  await expect(page.getByRole('alert')).toContainText('Une erreur');
  await page.getByRole('button', { name: 'Réessayer' }).click(); await expect(page.locator('.offer-card')).toHaveCount(6);
});

test('reset confirmé, annulation du dialogue et préservation des autres données', async ({ page }) => {
  await choose(page, 'Administration'); await page.goto('/outils-techniques');
  await page.evaluate(() => localStorage.setItem('unrelated-app', 'keep'));
  await page.getByRole('button', { name: 'Réinitialiser les données', exact: true }).click();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Réinitialiser les données', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer la réinitialisation' }).click();
  await expect(page.getByText('Le jeu initial a été restauré.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('unrelated-app'))).toBe('keep');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('agridataconnect.demo.v1')!).orders.length)).toBe(7);
});

for (const width of [1440, 1366, 390, 360]) {
  test(`catalogue, commande et paiement sans débordement à ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 900 });
    await choose(page, 'Restaurant Jardin');
    for (const path of ['/offres', '/offres/offer-tomato-round-m', '/commande/nouvelle?offre=offer-tomato-round-m', '/commandes/order-awaiting-payment/paiement', '/commandes/order-awaiting-reception']) {
      await page.goto(path); await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('Chargement des informations…')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (path === '/offres') {
        for (const image of await page.locator('.produce-visual img').all()) {
          await image.scrollIntoViewIfNeeded();
          await image.evaluate((element: HTMLImageElement) => element.decode());
        }
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: `.cache/screenshots/${width}-catalog.png`, fullPage: true });
      }
      if (path === '/commandes/order-awaiting-reception') await page.screenshot({ path: `.cache/screenshots/${width}-order.png`, fullPage: true });
    }
  });
}
