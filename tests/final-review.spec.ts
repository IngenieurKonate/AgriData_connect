import { test, expect, type Page } from '@playwright/test';

async function choose(page: Page, name: string) {
  await page.goto('/connexion'); await page.getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Accédez à votre espace');
}
async function ready(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Chargement des informations…')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}
const screens = [
  { role: '', paths: ['/', '/connexion', '/offres', '/offres/offer-tomato-round-m'] },
  { role: 'Restaurant Jardin', paths: ['/profil', '/messages', '/messages/conversation-offer', '/acheteur/demandes', '/commande/nouvelle?offre=offer-tomato-round-m', '/commandes/order-awaiting-payment/paiement', '/acheteur/commandes', '/commandes/order-awaiting-reception'] },
  { role: 'Coopérative Atlas', paths: ['/agriculteur/offres', '/demandes', '/demandes/request-onion-rabat', '/agriculteur/commandes', '/agriculteur/reglements'] },
  { role: 'Administration', paths: ['/admin', '/admin/commandes', '/admin/paiements', '/admin/litiges', '/admin/litiges/dispute-delivery', '/admin/moderation'] },
];

for (const width of [1440, 360]) {
  test(`recette des écrans E01 à E20, ressources et cibles tactiles à ${width} px`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    for (const group of screens) {
      if (group.role) await choose(page, group.role);
      for (const path of group.paths) {
        await page.goto(path); await ready(page);
        await expect(page.getByRole('alert')).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
        const small = await page.locator('a,button,input,select,textarea').evaluateAll(elements => elements.flatMap(el => {
          if (!el.getClientRects().length || el.closest('dialog:not([open])') || el.classList.contains('skip-link')) return [];
          const target = el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type) ? el.labels?.[0] ?? el : el;
          const box = target.getBoundingClientRect();
          if (box.width < 43.5 || box.height < 43.5) return [{ text: el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 60) ?? el.id, width: box.width, height: box.height }];
          return [];
        }));
        expect(small, path).toEqual([]);
        const gaps = await page.locator('.account-actions,.action-row,.action-stack,.profile-options').evaluateAll(groups => groups.filter(el => el.getClientRects().length && el.children.length > 1).map(el => {
          const style = getComputedStyle(el);
          return Math.min(parseFloat(style.columnGap), parseFloat(style.rowGap));
        }));
        expect(gaps.every(gap => gap >= 8), `${path} : espacement des actions`).toBe(true);
      }
    }
    expect(errors).toEqual([]);
  });
}

test('états vides, erreur récupérable, objet introuvable et accès interdit', async ({ page }) => {
  await choose(page, 'Administration'); await page.goto('/admin/litiges'); await ready(page);
  await page.getByLabel('État du dossier').selectOption('resolved');
  await expect(page.getByText('Aucun dossier ne correspond à cet état.')).toBeVisible();
  await page.goto('/admin/commandes'); await ready(page);
  await page.getByLabel('État de la commande').selectOption('closed');
  await expect(page.locator('.order-list-item')).toHaveCount(1);
  await page.goto('/outils-techniques');
  await page.getByRole('button', { name: 'Forcer une erreur sur la prochaine requête' }).click();
  await expect(page.getByText('La prochaine requête API échouera', { exact: false })).toBeVisible();
  await page.locator('.sidebar').getByRole('link', { name: 'Utilisateurs et annonces', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Une erreur');
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await expect(page.locator('article.moderation-row')).toHaveCount(5);
  for (const path of ['/admin/litiges/inconnu', '/commandes/inconnue']) {
    await page.goto(path); await expect(page.getByRole('alert')).toContainText('introuvable');
  }
  await choose(page, 'Acheteur particulier');
  await page.goto('/messages'); await ready(page);
  await page.goto('/admin/moderation'); await expect(page.getByRole('heading', { name: 'Accès non autorisé' })).toBeVisible();
  await page.goto('/commandes/order-disputed'); await expect(page.getByRole('alert')).toContainText('autre compte');
});

test('formulaire de modération au clavier et champs propres au profil persistants', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await choose(page, 'Coopérative Atlas'); await page.goto('/profil');
  await page.getByLabel('Présentation de l’exploitation').fill('Coopérative de producteurs de tomates et oignons.');
  await page.getByRole('button', { name: 'Enregistrer les coordonnées' }).click();
  await expect(page.getByText('Vos coordonnées ont été enregistrées.')).toBeVisible();
  await page.reload(); await expect(page.getByLabel('Présentation de l’exploitation')).toHaveValue('Coopérative de producteurs de tomates et oignons.');
  await choose(page, 'Restaurant Jardin'); await page.goto('/profil');
  await page.getByLabel('Type d’acheteur').selectOption('private');
  await page.getByRole('button', { name: 'Enregistrer les coordonnées' }).click();
  await expect(page.getByText('Vos coordonnées ont été enregistrées.')).toBeVisible();
  await page.reload(); await expect(page.getByLabel('Type d’acheteur')).toHaveValue('private');
  await choose(page, 'Administration'); await page.goto('/admin/moderation');
  const trigger = page.getByRole('button', { name: 'Suspendre', exact: true }).first();
  await trigger.focus(); await page.keyboard.press('Enter');
  const close = page.getByRole('button', { name: 'Fermer', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByLabel('Motif de l’intervention')).toBeFocused();
  expect(await page.getByLabel('Motif de l’intervention').evaluate(el => getComputedStyle(el).outlineWidth)).toBe('3px');
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Confirmer le changement de statut' })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(close).toBeFocused();
  const box = await close.boundingBox(); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.cache/screenshots/360-moderation-dialog.png', fullPage: true });
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
});
