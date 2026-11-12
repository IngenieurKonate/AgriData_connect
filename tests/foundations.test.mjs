import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// These modules contain only type imports. Transpile and run the actual source
// in-process so the foundational checks also work without child processes.
const imported = new Map();
async function importSource(path) {
  const absolutePath = new URL(path, import.meta.url);
  if (!absolutePath.pathname.endsWith('.ts') && !absolutePath.pathname.endsWith('.tsx')) absolutePath.pathname += '.ts';
  if (imported.has(absolutePath.href)) return imported.get(absolutePath.href);
  const pending = (async () => {
    const source = await readFile(absolutePath, 'utf8');
    let { outputText } = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    });
    const replacementPattern = /(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g;
    const imports = [...outputText.matchAll(replacementPattern)];
    for (const [, prefix, specifier, suffix] of imports) {
      const dependencyUrl = new URL(specifier, absolutePath);
      if (!dependencyUrl.pathname.endsWith('.ts') && !dependencyUrl.pathname.endsWith('.tsx')) dependencyUrl.pathname += '.ts';
      const dependency = await importSource(dependencyUrl);
      const dataUrl = dependency.__moduleUrl;
      outputText = outputText.replace(`${prefix}${specifier}${suffix}`, `${prefix}${dataUrl}${suffix}`);
    }
    const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
    const namespace = await import(moduleUrl);
    return Object.assign(Object.create(null), namespace, { __moduleUrl: moduleUrl });
  })();
  imported.set(absolutePath.href, pending);
  return pending;
}

const { checkAccess } = await importSource('../src/domain/access.ts');
const { readSession, writeSession } = await importSource('../src/services/demoSession.ts');
const { demoProfiles, roleHomes } = await importSource('../src/app/profiles.ts');

test('les visiteurs peuvent consulter le catalogue, mais doivent choisir un profil pour un espace privé', () => {
  assert.equal(checkAccess(null), 'allowed');
  assert.equal(checkAccess(null, ['buyer', 'farmer', 'admin']), 'sign-in');
});

test('un changement de rôle ne donne pas accès aux espaces des autres acteurs', () => {
  assert.equal(checkAccess('buyer', ['admin']), 'forbidden');
  assert.equal(checkAccess('farmer', ['buyer']), 'forbidden');
  assert.equal(checkAccess('admin', ['buyer', 'farmer']), 'forbidden');
  assert.equal(checkAccess('admin', ['admin']), 'allowed');
  for (const role of ['buyer', 'farmer', 'admin']) {
    assert.equal(checkAccess(role, ['buyer', 'farmer', 'admin']), 'allowed');
    assert.equal(checkAccess(role, []), 'forbidden');
  }
});

test('les cinq profils fictifs couvrent les trois espaces sans identifiant dupliqué', () => {
  assert.equal(demoProfiles.length, 5);
  assert.equal(new Set(demoProfiles.map(p => p.id)).size, 5);
  assert.deepEqual(demoProfiles.map(p => p.role).sort(), ['admin', 'buyer', 'buyer', 'farmer', 'farmer']);
  for (const profile of demoProfiles) {
    assert.ok(profile.email.endsWith('.example'));
    assert.ok(roleHomes[profile.role].startsWith('/'));
  }
});

test('la session conserve le profil et ne supprime pas les données des autres applications', () => {
  const data = new Map([['other-app', 'keep']]);
  globalThis.sessionStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  };
  assert.equal(readSession(), null);
  assert.equal(writeSession('farmer-coop'), true);
  assert.equal(readSession(), 'farmer-coop');
  assert.equal(writeSession('buyer-pro'), true);
  assert.equal(readSession(), 'buyer-pro');
  assert.equal(writeSession(null), true);
  assert.equal(readSession(), null);
  assert.equal(data.get('other-app'), 'keep');
});

test('un stockage indisponible est signalé sans faire échouer la navigation', () => {
  const fail = () => { throw new Error('Storage unavailable'); };
  globalThis.sessionStorage = { getItem: fail, setItem: fail, removeItem: fail };
  assert.equal(readSession(), null);
  assert.equal(writeSession('buyer-pro'), false);
  assert.equal(writeSession(null), false);
});

const { createInitialData, SCHEMA_VERSION } = await importSource('../src/mocks/seed/seedData.ts');
const { BUSINESS_STORAGE_KEY, DemoRepository, isBusinessData, RepositoryOperationError } = await importSource('../src/mocks/repository/demoRepository.ts');

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: key => map.get(key) ?? null,
    setItem(key, value) { if (this.failWrites) throw new Error('Quota exceeded'); map.set(key, value); },
    removeItem: key => map.delete(key),
    map,
    failWrites: false,
  };
}

test('la graine prépare les trois rôles et le jeu complet de données cohérentes', () => {
  const anchor = Date.UTC(2026, 10, 10, 12);
  const data = createInitialData(anchor);
  assert.equal(new Date(data.config.seedAnchorTime).getTime(), anchor);
  assert.equal(data.config.schemaVersion, SCHEMA_VERSION);
  assert.equal(data.config.seedVersion, 1);
  assert.deepEqual(data.users.map(user => user.role).sort(), ['admin', 'buyer', 'buyer', 'farmer', 'farmer']);
  assert.equal(data.offers.length, 8);
  assert.equal(data.offers.filter(offer => offer.product === 'tomato').length, 5);
  assert.equal(data.offers.filter(offer => offer.product === 'onion').length, 3);
  assert.equal(data.purchaseRequests.length, 3);
  assert.equal(data.conversations.length, 2);
  assert.equal(data.transportPartners.length, 2);
  assert.ok(data.orders.some(order => order.paymentStatus === 'pending'));
  assert.ok(data.orders.some(order => order.paymentStatus === 'paid'));
  assert.ok(data.orders.some(order => order.status === 'cancelled'));
  assert.ok(data.orders.some(order => order.status === 'closed'));
  assert.ok(data.deliveryCycles.some(cycle => cycle.status === 'in_transit'));
  assert.ok(data.deliveryCycles.some(cycle => cycle.status === 'handover_reported'));
  assert.equal(data.disputes[0].status, 'open');
  assert.ok(data.users.every(user => user.email.endsWith('.example')));
});

test('chaque mouvement de stock correspond à une vente et les réservations non payées restent distinctes', () => {
  const data = createInitialData(Date.UTC(2026, 10, 10, 12));
  for (const offer of data.offers) {
    assert.ok(offer.stockRemainingKg >= 0);
    const sold = data.stockMovements.filter(movement => movement.offerId === offer.id).reduce((sum, movement) => sum + movement.quantityKg, 0);
    const startedWith = offer.stockRemainingKg + sold;
    const expected = ({
      'offer-tomato-round-m': 4000,
      'offer-tomato-elongated-l': 3200,
      'offer-onion-yellow': 7000,
      'offer-onion-red': 5000,
    })[offer.id] ?? offer.stockRemainingKg;
    assert.equal(startedWith, expected);
  }
  const waitingOrder = data.orders.find(order => order.id === 'order-awaiting-payment');
  const heldReservation = data.reservations.find(reservation => reservation.orderId === waitingOrder.id);
  assert.equal(heldReservation.status, 'active');
  assert.equal(heldReservation.quantityKg, waitingOrder.quantityKg);
  assert.equal(data.reservations.find(item => item.orderId === 'order-cancelled').status, 'released');
  assert.equal(data.payouts.find(payout => payout.orderId === 'order-disputed').status, 'blocked');
  assert.equal(data.payouts.find(payout => payout.orderId === 'order-closed').netCents, 206400);
});

test('les références, dates et étapes de livraison du jeu initial sont cohérentes', () => {
  const anchor = Date.UTC(2026, 10, 10, 12);
  const data = createInitialData(anchor);
  for (const order of data.orders) {
    assert.equal(order.goodsCents, order.quantityKg * data.offers.find(offer => offer.id === order.offerId).pricePerKgCents);
    assert.equal(order.totalCents, order.goodsCents + order.deliveryCents);
    assert.ok(!order.reference.includes('undefined'));
    assert.ok(order.buyerId && order.sellerId);
  }
  for (const cycle of data.deliveryCycles) {
    const scheduled = Date.parse(cycle.collectionPlannedAt);
    const estimated = Date.parse(cycle.arrivalEstimatedAt);
    assert.ok(scheduled >= Date.parse(data.config.seedAnchorTime) - 8 * 86_400_000);
    assert.ok(estimated >= scheduled);
  }
  for (const event of data.events) assert.ok(Date.parse(event.createdAt) <= anchor);
  assert.equal(new Set(data.events.map(event => event.id)).size, data.events.length);
});

test('le dépôt initialise une seule graine et conserve les mises à jour au rechargement', () => {
  const storage = memoryStorage();
  const repository = new DemoRepository(storage);
  const first = repository.load();
  assert.equal(first.error, null);
  assert.equal(first.persistent, true);
  assert.equal(first.data.offers.length, 8);
  assert.ok(storage.getItem(BUSINESS_STORAGE_KEY));
  first.data.offers[0].title = 'Mutation externe impossible';
  assert.notEqual(repository.snapshot().data.offers[0].title, 'Mutation externe impossible');
  repository.update(data => { data.users.find(user => user.id === 'farmer-coop').city = 'Biougra'; });
  const reloaded = new DemoRepository(storage).load();
  assert.equal(reloaded.data.users.find(user => user.id === 'farmer-coop').city, 'Biougra');
  assert.equal(reloaded.data.offers.length, 8);
});

test('une erreur d’écriture ne publie pas de mutation en mémoire', () => {
  const storage = memoryStorage();
  const repository = new DemoRepository(storage);
  repository.load();
  const before = storage.getItem(BUSINESS_STORAGE_KEY);
  storage.failWrites = true;
  assert.throws(() => repository.update(data => { data.offers[0].stockRemainingKg = 0; }), RepositoryOperationError);
  assert.equal(storage.getItem(BUSINESS_STORAGE_KEY), before);
  assert.notEqual(repository.snapshot().data.offers[0].stockRemainingKg, 0);
});

test('les données illisibles et une ancienne version restent intactes jusqu’à réinitialisation explicite', () => {
  const corrupt = memoryStorage({ [BUSINESS_STORAGE_KEY]: '{not-json' });
  assert.equal(new DemoRepository(corrupt).load().error, 'DATA_CORRUPT');
  assert.equal(corrupt.getItem(BUSINESS_STORAGE_KEY), '{not-json');

  const unsupportedData = createInitialData(1);
  unsupportedData.config.schemaVersion = SCHEMA_VERSION + 1;
  const outdated = memoryStorage({ [BUSINESS_STORAGE_KEY]: JSON.stringify(unsupportedData) });
  assert.equal(new DemoRepository(outdated).load().error, 'SCHEMA_VERSION_MISMATCH');
  assert.equal(JSON.parse(outdated.getItem(BUSINESS_STORAGE_KEY)).config.schemaVersion, SCHEMA_VERSION + 1);
  const reset = new DemoRepository(outdated).reset(Date.UTC(2026, 10, 10, 12));
  assert.equal(reset.error, null);
  assert.equal(reset.data.config.schemaVersion, SCHEMA_VERSION);
  assert.equal(outdated.map.size, 1);
});

test('un stockage absent, indisponible ou plein ne signale jamais de sauvegarde réussie', () => {
  assert.equal(new DemoRepository(null).load().error, 'STORAGE_UNAVAILABLE');
  const denied = { getItem() { throw new Error('Access denied'); }, setItem() {}, removeItem() {} };
  assert.equal(new DemoRepository(denied).load().error, 'STORAGE_UNAVAILABLE');
  const storage = memoryStorage();
  storage.failWrites = true;
  const failed = new DemoRepository(storage).load();
  assert.equal(failed.error, 'STORAGE_UNAVAILABLE');
  assert.equal(storage.getItem(BUSINESS_STORAGE_KEY), null);
  assert.equal(new DemoRepository(null).reset().error, 'STORAGE_UNAVAILABLE');
});

test('la réinitialisation remplace uniquement la clé du projet', () => {
  const storage = memoryStorage({ 'application-tierce': 'conserver', 'autre-cle': 'conserver aussi' });
  const repository = new DemoRepository(storage);
  repository.load();
  repository.update(data => { data.orders.length = 0; });
  const result = repository.reset(Date.UTC(2026, 10, 10, 12));
  assert.equal(result.error, null);
  assert.equal(result.data.orders.length, 7);
  assert.equal(storage.getItem('application-tierce'), 'conserver');
  assert.equal(storage.getItem('autre-cle'), 'conserver aussi');
  assert.deepEqual([...storage.map.keys()].sort(), ['application-tierce', 'agridataconnect.demo.v1', 'autre-cle'].sort());
});

test('le dépôt refuse toute mutation lorsque le document est corrompu', () => {
  const storage = memoryStorage({ [BUSINESS_STORAGE_KEY]: 'null' });
  const repository = new DemoRepository(storage);
  assert.equal(repository.load().error, 'DATA_CORRUPT');
  assert.throws(() => repository.update(data => { data.users.length = 0; }), RepositoryOperationError);
  assert.equal(storage.getItem(BUSINESS_STORAGE_KEY), 'null');
  assert.equal(isBusinessData({ config: {}, users: [] }), false);
});

