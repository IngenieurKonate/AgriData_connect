import { test, expect } from '@playwright/test';

test('double clic de réservation, profil verrouillé et erreur de stockage récupérable', async ({ page }) => {
  await page.goto('/connexion'); await page.getByRole('button', { name: /Restaurant Jardin/ }).click();
  await page.goto('/commande/nouvelle?offre=offer-tomato-round-m');
  await page.getByRole('button', { name: 'Calculer le récapitulatif' }).click();
  await expect(page.getByRole('button', { name: 'Confirmer et réserver' })).toBeVisible();
  const before = await page.evaluate(() => localStorage.getItem('agridataconnect.demo.v1'));
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Object.assign(window, { restoreStorage: () => { Storage.prototype.setItem = original; } });
    Storage.prototype.setItem = function(key: string, value: string) { if (key === 'agridataconnect.demo.v1') throw new DOMException('Quota', 'QuotaExceededError'); return original.call(this, key, value); };
  });
  await page.getByRole('button', { name: 'Confirmer et réserver' }).click();
  await expect(page.locator('.profile-switch')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('button', { name: 'Se déconnecter' })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('ne peuvent pas être enregistrées');
  expect(await page.evaluate(() => localStorage.getItem('agridataconnect.demo.v1'))).toBe(before);
  await page.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage());
  await page.getByRole('button', { name: 'Confirmer et réserver' }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page).toHaveURL(/\/commandes\/[^/]+\/paiement$/);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('agridataconnect.demo.v1')!));
  expect(state.orders).toHaveLength(8); expect(state.reservations.filter((item: { status: string }) => item.status === 'active')).toHaveLength(2);
});

test('navigation clavier, focus et notifications persistantes', async ({ page }) => {
  await page.goto('/connexion');
  const choice = page.getByRole('button', { name: /Restaurant Jardin/ });
  await choice.focus(); await page.keyboard.press('Enter'); await expect(page).toHaveURL('/offres');
  await page.goto('/commandes/order-awaiting-reception');
  const confirmation = page.getByRole('button', { name: 'Confirmer la réception conforme' });
  await confirmation.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Oui, le lot est conforme' })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(confirmation).toBeFocused();
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  const notification = page.locator('.notification-link').first();
  await expect(notification).toBeVisible();
  await notification.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Lue');
});
