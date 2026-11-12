import { test, expect, type Page } from '@playwright/test';

async function choose(page: Page, name: string) {
  await page.goto('/connexion');
  await page.getByRole('button', { name: new RegExp(name) }).click();
}

async function readyForCapture(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Chargement des informations…')).toHaveCount(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map(image => { image.loading = 'eager'; return image.decode(); }));
  });
}

test('accueil public, navigation et pages inconnues', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('De bons produits');
  await page.getByRole('link', { name: 'Voir le catalogue' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Le catalogue');
  await page.goto('/inconnue');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ce chemin ne mène à aucune page');
  await page.getByRole('link', { name: 'Revenir à l’accueil' }).click();
  await expect(page).toHaveURL('/');
  expect(errors).toEqual([]);
});

const protectedPaths = ['/profil', '/messages', '/messages/example', '/acheteur/demandes', '/commande/nouvelle', '/commandes/example/paiement', '/acheteur/commandes', '/commandes/example', '/agriculteur/offres', '/demandes', '/demandes/example', '/agriculteur/commandes', '/agriculteur/reglements', '/admin', '/admin/commandes', '/admin/paiements', '/admin/litiges', '/admin/litiges/example', '/admin/moderation'];

test('un visiteur ne peut pas ouvrir les routes privées directement', async ({ page }) => {
  for (const path of protectedPaths) {
    await page.goto(path);
    await expect(page).toHaveURL('/connexion');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Accédez à votre espace');
  }
});

const roleCases = [
  { name: 'Restaurant Jardin', home: '/offres', denied: ['/admin', '/agriculteur/offres', '/demandes', '/admin/litiges/example'], allowed: ['/offres', '/offres/example', '/profil', '/messages', '/messages/example', '/acheteur/demandes', '/commande/nouvelle', '/commandes/example/paiement', '/acheteur/commandes', '/commandes/example'] },
  { name: 'Coopérative Atlas', home: '/agriculteur/offres', denied: ['/admin/paiements', '/acheteur/demandes', '/commande/nouvelle', '/commandes/example/paiement'], allowed: ['/agriculteur/offres', '/profil', '/messages', '/messages/example', '/demandes', '/demandes/example', '/agriculteur/commandes', '/agriculteur/reglements', '/commandes/example'] },
  { name: 'Administration', home: '/admin', denied: ['/messages', '/messages/example', '/commande/nouvelle', '/agriculteur/offres'], allowed: ['/admin', '/profil', '/admin/commandes', '/admin/paiements', '/admin/litiges', '/admin/litiges/example', '/admin/moderation', '/commandes/example'] },
];

for (const role of roleCases) {
  test(`routes et liens du profil ${role.name}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await choose(page, role.name);
    await expect(page).toHaveURL(role.home);
    const links = await page.locator('.sidebar nav a').evaluateAll(elements => elements.map(el => el.getAttribute('href')!));
    for (const href of links) {
      await page.locator(`.sidebar nav a[href="${href}"]`).click();
      await expect(page).toHaveURL(href);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator(`.sidebar nav a[href="${href}"]`)).toHaveAttribute('aria-current', 'page');
    }
    for (const path of role.allowed) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('Accès non autorisé', { exact: true })).toHaveCount(0);
    }
    for (const path of role.denied) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: 'Accès non autorisé' })).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}

test('cinq profils, rechargement, changement de rôle et déconnexion', async ({ page }) => {
  for (const profile of [
    { name: 'Restaurant Jardin', home: '/offres' },
    { name: 'Acheteur particulier', home: '/offres' },
    { name: 'Coopérative Atlas', home: '/agriculteur/offres' },
    { name: 'Ferme Amane', home: '/agriculteur/offres' },
    { name: 'Administration', home: '/admin' },
  ]) {
    await choose(page, profile.name);
    await expect(page).toHaveURL(profile.home);
    await page.reload();
    await expect(page).toHaveURL(profile.home);
    await page.goto('/profil');
    await expect(page.getByLabel('Nom affiché')).toHaveValue(profile.name);
    await expect(page.getByLabel('Adresse e-mail')).toHaveValue(/\.example$/);
  }
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/admin');
  await expect(page).toHaveURL('/connexion');
});

test('notifications accessibles et changement de profil sans effacer les autres données', async ({ page }) => {
  await choose(page, 'Coopérative Atlas');
  await page.evaluate(() => { localStorage.setItem('unrelated-app', 'keep'); sessionStorage.setItem('unrelated-session', 'keep'); });
  const bell = page.getByRole('button', { name: 'Notifications', exact: true });
  await bell.click();
  await expect(page.getByRole('dialog', { name: 'Notifications', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(bell).toBeFocused();
  await page.getByRole('link', { name: 'Changer de profil', exact: true }).click();
  await expect(page).toHaveURL('/connexion');
  await page.getByRole('button', { name: /Restaurant Jardin/ }).click();
  await expect(page).toHaveURL('/offres');
  expect(await page.evaluate(() => sessionStorage.getItem('agridataconnect.demo.session.v1'))).toBe('buyer-pro');
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL('/');
  expect(await page.evaluate(() => localStorage.getItem('unrelated-app'))).toBe('keep');
  expect(await page.evaluate(() => sessionStorage.getItem('unrelated-session'))).toBe('keep');
  expect(await page.evaluate(() => sessionStorage.getItem('agridataconnect.demo.session.v1'))).toBeNull();
});

test('profil invalide et stockage indisponible', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => sessionStorage.setItem('agridataconnect.demo.session.v1', 'unknown-profile'));
  await page.goto('/admin');
  await expect(page).toHaveURL('/connexion');
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Unavailable', 'QuotaExceededError'); }; });
  await choose(page, 'Ferme Amane');
  await expect(page).toHaveURL('/agriculteur/offres');
  await expect(page.getByRole('alert')).toContainText('ne peut pas conserver votre profil');
});

for (const width of [1440, 1366, 390, 360]) {
  test(`mise en page et menu à ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : width > 700 ? 900 : 844 });
    for (const path of ['/', '/connexion']) {
      await page.goto(path);
      await readyForCapture(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `.cache/screenshots/${width}-${path === '/' ? 'home' : 'profiles'}.png`, fullPage: true });
    }
    await choose(page, 'Coopérative Atlas');
    await readyForCapture(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `.cache/screenshots/${width}-farmer.png`, fullPage: true });
    if (width < 1000) {
      await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
      await page.getByRole('dialog', { name: 'Navigation', exact: true }).getByRole('link', { name: 'Mon profil' }).click();
      await expect(page).toHaveURL('/profil');
      await expect(page.getByRole('dialog', { name: 'Navigation', exact: true })).not.toBeVisible();
    } else {
      await page.goto('/profil');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await choose(page, 'Administration');
    await readyForCapture(page);
    await page.screenshot({ path: `.cache/screenshots/${width}-admin.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
