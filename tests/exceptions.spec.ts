import { test, expect, type Page } from '@playwright/test';

async function choose(page: Page, name: string) {
  await page.goto('/connexion');
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Accédez à votre espace');
}
async function snapshot(page: Page) { return page.evaluate(() => JSON.parse(localStorage.getItem('agridataconnect.demo.v1')!)); }
async function call(page: Page, path: string, user = 'admin', method = 'GET', body?: unknown) {
  return page.evaluate(async ({ path, user, method, body }) => {
    const response = await fetch(`/api/${path}`, { method, headers: { 'X-Demo-User-Id': user, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  }, { path, user, method, body });
}
async function decision(page: Page, resolution: string, extra?: () => Promise<void>) {
  await page.getByRole('button', { name: 'Prendre en charge le dossier' }).click();
  await page.getByLabel('Résolution', { exact: true }).selectOption(resolution);
  await extra?.();
  await page.getByLabel('Motif de décision et accord des parties').fill('Accord des parties après examen des photos et du lot.');
  await page.getByRole('button', { name: 'Enregistrer la décision' }).click();
  await expect(page.getByText('Décision en attente d’exécution.', { exact: false })).toBeVisible();
}
async function execute(page: Page) {
  await page.getByRole('button', { name: 'Exécuter la décision', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer l’exécution', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
}
async function deliver(page: Page) {
  await page.getByLabel('Date et heure de collecte').fill('2026-11-12T10:00');
  await page.getByLabel('Arrivée estimée').fill('2026-11-13T12:00');
  await page.getByRole('button', { name: 'Planifier la collecte' }).click();
  for (const name of ['Confirmer la collecte', 'Démarrer la livraison', 'Signaler la remise']) await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Relancer l’acheteur' })).toBeVisible();
}

test('signalement avec preuve, commentaires des parties, décision puis remboursement total persistant', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await choose(page, 'Restaurant Jardin'); await page.goto('/commandes/order-awaiting-reception');
  const trigger = page.getByRole('button', { name: 'Signaler un problème', exact: true });
  await trigger.click(); await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByLabel('Motif du signalement').selectOption('damaged');
  await page.getByLabel('Description du problème').fill('Une caisse de tomates est abîmée à la réception.');
  await page.getByLabel('Preuve locale (facultative)').selectOption('offer-tomato-round-m');
  await page.getByRole('button', { name: 'Envoyer le signalement' }).click();
  await expect(page.getByRole('heading', { name: 'Dossier de litige' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Preuve jointe/ })).toBeVisible();
  const data = await snapshot(page); const dispute = data.disputes.find((d: { orderId: string }) => d.orderId === 'order-awaiting-reception');
  await choose(page, 'Coopérative Atlas'); await page.goto('/commandes/order-awaiting-reception');
  await page.getByLabel('Votre commentaire').fill('Je confirme l’accord pour un remboursement total.');
  await page.getByRole('button', { name: 'Ajouter le commentaire' }).click();
  await expect(page.getByText('Je confirme l’accord pour un remboursement total.', { exact: true })).toBeVisible();
  await choose(page, 'Administration'); await page.goto(`/admin/litiges/${dispute.id}`);
  await decision(page, 'full_refund');
  expect((await snapshot(page)).refunds).toHaveLength(0);
  await execute(page);
  await expect(page.getByText('Remboursement exécuté : 1 975,00 MAD')).toBeVisible();
  await page.reload(); await expect(page.getByText('Dossier résolu.', { exact: false })).toBeVisible();
  await page.goto('/commandes/order-awaiting-reception');
  await expect(page.getByText('Cette commande est clôturée.')).toBeVisible();
  await expect(page.getByText('Les montants se réconcilient.')).toBeVisible();
  const final = await snapshot(page);
  expect(final.refunds).toHaveLength(1);
  expect(final.payouts.find((p: { orderId: string }) => p.orderId === 'order-awaiting-reception').status).toBe('not_applicable');
  expect(final.notifications.some((n: { type: string }) => n.type === 'dispute_resolved')).toBe(true);
  expect(final.emails.length).toBeGreaterThan(data.emails.length);
  expect(errors).toEqual([]);
});

test('accord partiel : 150 MAD remboursés, 662,40 MAD versés et clôture', async ({ page }) => {
  await choose(page, 'Administration'); await page.goto('/admin/litiges/dispute-delivery');
  await decision(page, 'partial_refund', async () => {
    await page.getByLabel('Remboursement produits (MAD)').fill('100');
    await page.getByLabel('Remboursement transport (MAD)').fill('50');
  });
  await execute(page); await page.goto('/commandes/order-disputed');
  await expect(page.getByText('Les montants se réconcilient.')).toBeVisible();
  await expect(page.getByText('Cette commande est clôturée.')).toHaveCount(0);
  const reconciliation = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Réconciliation financière' }) });
  await expect(reconciliation).toContainText('662,40 MAD');
  await expect(reconciliation).toContainText('27,60 MAD');
  await expect(reconciliation).toContainText('150,00 MAD');
  await page.getByRole('button', { name: 'Effectuer le versement' }).click();
  await expect(page.getByText('Cette commande est clôturée.')).toBeVisible();
  await page.goto('/admin/paiements');
  await expect(page.getByText('150,00 MAD remboursés')).toBeVisible();
  const data = await snapshot(page);
  expect(data.payouts.filter((p: { orderId: string }) => p.orderId === 'order-disputed')).toHaveLength(1);
  expect(data.payouts.find((p: { orderId: string }) => p.orderId === 'order-disputed').netCents).toBe(66240);
});

for (const problem of [false, true]) {
  test(`remplacement sans second paiement : ${problem ? 'nouveau problème dans le même dossier' : 'réception conforme et versement'}`, async ({ page }) => {
    test.setTimeout(90000);
    await choose(page, 'Administration'); await page.goto('/admin/litiges/dispute-delivery');
    const before = await snapshot(page);
    await decision(page, 'replacement', async () => { await page.getByLabel('Quantité à remplacer (kg)').fill('100'); });
    await execute(page); await page.goto('/commandes/order-disputed');
    await expect(page.getByRole('heading', { name: 'Cycle 2 : remplacement' })).toBeVisible();
    await deliver(page);
    await choose(page, 'Restaurant Jardin'); await page.goto('/commandes/order-disputed');
    if (problem) {
      await page.getByRole('button', { name: 'Signaler un problème sur le remplacement', exact: true }).click();
      await page.getByLabel('Motif du signalement').selectOption('missing_quantity');
      await page.getByLabel('Description du problème').fill('Le remplacement est incomplet.');
      await page.getByRole('button', { name: 'Envoyer le signalement' }).click();
      await expect(page.getByRole('button', { name: 'Confirmer la réception conforme', exact: true })).toHaveCount(0);
      await expect(page.getByText('Quantité manquante : Le remplacement est incomplet.', { exact: true })).toBeVisible();
      await choose(page, 'Administration'); await page.goto('/admin/litiges/dispute-delivery');
      await expect(page.getByLabel('Résolution', { exact: true }).locator('option')).toHaveCount(2);
      await page.getByLabel('Motif de décision et accord des parties').fill('Le remplacement a échoué, accord de remboursement total.');
      await page.getByRole('button', { name: 'Enregistrer la décision' }).click();
      await execute(page); await page.goto('/commandes/order-disputed');
    } else {
      await page.getByRole('button', { name: 'Confirmer la réception conforme', exact: true }).click();
      await page.getByRole('button', { name: 'Oui, le lot est conforme' }).click();
      await expect(page.getByText('Réception conforme confirmée.', { exact: false })).toBeVisible();
      await choose(page, 'Administration'); await page.goto('/commandes/order-disputed');
      await page.getByRole('button', { name: 'Effectuer le versement' }).click();
    }
    await expect(page.getByText('Cette commande est clôturée.')).toBeVisible();
    const data = await snapshot(page);
    expect(data.disputes).toHaveLength(before.disputes.length);
    expect(data.deliveryCycles.filter((c: { orderId: string }) => c.orderId === 'order-disputed')).toHaveLength(2);
    expect(data.paymentAttempts).toHaveLength(before.paymentAttempts.length);
    expect(data.stockMovements.filter((s: { orderId: string; type: string }) => s.orderId === 'order-disputed' && s.type === 'replacement')).toHaveLength(1);
    expect(data.deliveryCycles.find((c: { id: string }) => c.id === before.orders.find((o: { id: string }) => o.id === 'order-disputed').currentDeliveryCycleId)).toEqual(before.deliveryCycles.find((c: { id: string }) => c.id === before.orders.find((o: { id: string }) => o.id === 'order-disputed').currentDeliveryCycleId));
  });
}

test('Cash Plus invalidé après changement de moyen et expiration administrative', async ({ page }) => {
  await choose(page, 'Restaurant Jardin'); await page.goto('/commandes/order-awaiting-payment/paiement');
  await page.getByLabel('Moyen de paiement').selectOption('cash_plus');
  await page.getByRole('button', { name: /ce moyen de paiement|Préparer le paiement/ }).click();
  await expect(page.getByRole('heading', { name: 'En attente de paiement en agence' })).toBeVisible();
  const cash = (await snapshot(page)).paymentAttempts.find((a: { orderId: string; status: string }) => a.orderId === 'order-awaiting-payment' && a.status === 'pending');
  await page.getByLabel('Moyen de paiement').selectOption('naps');
  await page.getByRole('button', { name: 'Utiliser ce moyen de paiement' }).click();
  await expect(page.getByRole('button', { name: 'Valider le paiement', exact: true })).toBeVisible();
  expect((await call(page, `demo/payments/${cash.id}/result`, 'admin', 'POST', { result: 'success' })).status).toBe(409);
  await choose(page, 'Administration'); await page.goto('/commandes/order-awaiting-payment');
  await page.getByRole('button', { name: 'Expirer la commande', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer l’expiration' }).click();
  await expect(page.getByText('Cette commande est annulée. Sa réservation a été libérée.')).toBeVisible();
  const data = await snapshot(page);
  expect(data.reservations.find((r: { orderId: string }) => r.orderId === 'order-awaiting-payment').status).toBe('released');
  expect(data.paymentAttempts.filter((a: { orderId: string; status: string }) => a.orderId === 'order-awaiting-payment' && a.status === 'pending')).toHaveLength(0);
});

test('modération avec motif, nouvelle vente interdite et commande existante traitable', async ({ page }) => {
  test.setTimeout(90000);
  await choose(page, 'Administration'); await page.goto('/admin/moderation');
  await page.getByLabel('Éléments à consulter').selectOption('offer');
  const row = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Tomates rondes, calibre M', exact: true }) });
  await row.getByRole('button', { name: 'Suspendre' }).click();
  await page.getByLabel('Motif de l’intervention').fill('Vérification du lot restant après signalement.');
  await page.getByRole('button', { name: 'Confirmer le changement de statut' }).click();
  await expect(row.getByRole('button', { name: 'Réactiver' })).toBeVisible();
  expect((await call(page, 'orders', 'buyer-pro', 'POST', { offerId: 'offer-tomato-round-m', quantityKg: 500, expectedOfferVersion: 2 })).status).toBe(409);
  await page.getByLabel('Éléments à consulter').selectOption('user');
  const buyer = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Restaurant Jardin', exact: true }) });
  await buyer.getByRole('button', { name: 'Suspendre' }).click();
  await page.getByLabel('Motif de l’intervention').fill('Contrôle des coordonnées du compte.');
  await page.getByRole('button', { name: 'Confirmer le changement de statut' }).click();
  await expect(buyer.getByRole('button', { name: 'Réactiver' })).toBeVisible();
  await choose(page, 'Restaurant Jardin'); await page.goto('/commandes/order-awaiting-reception');
  await page.getByRole('button', { name: 'Confirmer la réception conforme', exact: true }).click();
  await page.getByRole('button', { name: 'Oui, le lot est conforme' }).click();
  await expect(page.getByText('Réception conforme confirmée.', { exact: false })).toBeVisible();
  await choose(page, 'Administration'); await page.goto('/commandes/order-awaiting-reception');
  await page.getByRole('button', { name: 'Effectuer le versement' }).click();
  await expect(page.getByText('Cette commande est clôturée.')).toBeVisible();
  await page.goto('/admin/moderation'); await page.getByLabel('Éléments à consulter').selectOption('offer');
  await row.getByRole('button', { name: 'Réactiver' }).click();
  await page.getByLabel('Motif de l’intervention').fill('Lot restant contrôlé et conforme.');
  await page.getByRole('button', { name: 'Confirmer le changement de statut' }).click();
  await expect(row.getByRole('button', { name: 'Suspendre' })).toBeVisible();
  expect((await snapshot(page)).moderationEvents).toHaveLength(3);
});

for (const width of [1440, 1366, 390, 360]) {
  test(`administration, litige et polices locales à ${width} px`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 900 });
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    const external: string[] = []; page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:4173') && !r.url().startsWith('data:')) external.push(r.url()); });
    await choose(page, 'Administration');
    for (const path of ['/admin', '/admin/paiements', '/admin/moderation', '/admin/litiges', '/admin/litiges/dispute-delivery']) {
      await page.goto(path); await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('Chargement des informations…')).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `.cache/screenshots/${width}-${path.replaceAll('/', '_')}.png`, fullPage: true });
    }
    await page.getByRole('button', { name: 'Prendre en charge le dossier' }).click();
    await page.getByLabel('Résolution', { exact: true }).selectOption('partial_refund');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.cache/screenshots/${width}-decision-form.png`, fullPage: true });
    const fonts = await page.evaluate(async () => { const families = ['Hepta Slab', 'Readex Pro', 'Martian Mono']; return Promise.all(families.map(async family => (await document.fonts.load(`16px "${family}"`)).length)); });
    expect(fonts).toEqual([1, 1, 1]);
    expect(errors).toEqual([]); expect(external).toEqual([]);
  });
}
