# Validation des étapes 1 à 3

Date : 11 novembre 2026. Exécution locale sur Windows, Node.js 20.19.2, avec Microsoft Edge piloté par Playwright et le build Vite servi par HTTP.

## Résultats

| Vérification | Résultat |
| --- | --- |
| `npm run build` | TypeScript strict et build de production réussis |
| `npm test` | 78 tests réussis : 14 Node et 64 Vitest |
| `npm run test:e2e` | 22 scénarios réussis sur le build, en 2,4 minutes |
| Captures | Générées dans `.cache/screenshots/` ; revue du catalogue, de l’administration et du suivi de commande sur ordinateur et mobile |
| Logos | Variante inverse, favicons et icône d’application officiels servis localement |
| Notes personnelles | `bachirou.md` est resté vide |

Les essais navigateur ont nécessité l’autorisation de lancer les processus hors du bac à sable. Les premiers échecs ont permis de corriger la redirection de déconnexion et le cycle de tabulation des dialogues. Les scénarios Cash Plus attendent maintenant la confirmation effective de la mutation avant de recharger une page. L’erreur forcée est testée par navigation interne, car ce contrôle est volontairement conservé en mémoire.

## Périmètre vérifié

| Repère | Preuve et résultat |
| --- | --- |
| AC02 | Recherche sans résultat, remise à zéro et récupération du catalogue dans le navigateur |
| AC03 | Quantités nulles, négatives, fractionnaires, sous le minimum et au-delà du disponible refusées ; confirmation désactivée dans l’interface |
| AC04 | 500 kg à 3,40 MAD/kg : 1 700 MAD de produits, 275 MAD de livraison, 1 975 MAD au total, vérifiés par tests de domaine et navigateur |
| AC05 | Commande persistante et autorisations des parties ; collecte impossible avant paiement, vérifiée dans l’API et le parcours Cash Plus |
| AC06 | Naps refusé puis réussi : une commande, deux tentatives, une seule vente de stock ; vérification après rechargement |
| AC07 | Référence `DEMO-CP-`, attente persistante et absence d’action de collecte avant encaissement |
| AC08 | Confirmation Cash Plus répétée : un paiement, une vente de stock et un seul ensemble d’événements ; test API |
| AC14 | Transitions successives, chronologie partagée et notifications acheteur/agriculteur ; parcours administrateur puis producteur et acheteur |
| AC15 | La remise laisse le versement indisponible jusqu’à confirmation de réception |
| AC16 | Commission de 68 MAD, net agriculteur de 1 632 MAD, versement unique et commande clôturée ; vérifiés dans le navigateur et le dépôt |
| AC17 | Relance explicite, notification persistante, aucune réception ou clôture automatique |
| AC22 | Matrices de rôles, propriétaires et accès directs ; réponse 403 pour les accès interdits testés, données inchangées |
| AC23 | Coordonnées, commande et paiement conservés au rechargement et au changement de profil ; les adresses de commande restent figées |
| AC24 | Reset confirmé depuis les outils techniques, annulation du dialogue possible, restauration des sept commandes initiales et préservation des autres clés |
| AC25 | Erreur forcée récupérable ; échec de stockage sans mutation partielle ; nouvelle tentative réussie et double clic sans double réservation |
| AC26 | Aucun débordement global sur les pages testées à 1440 × 900, 1366 × 768, 390 et 360 px ; menus mobiles utilisables |
| AC27 | Navigation clavier, focus initial et retour du focus, boucle Tab/Shift+Tab des dialogues, fermeture par Échap et notification ouverte au clavier ; contrôle ciblé, audit global restant à l’étape 6 |
| AC28 | Rechargement direct des routes du build et des commandes, contrôle des accès et absence d’erreurs JavaScript dans les parcours surveillés |

Des tests de domaine couvrent aussi l’invalidation d’une ancienne tentative Cash Plus après changement de moyen et la poursuite d’une commande après suspension de son offre. Ils ne remplacent pas la recette complète des exceptions de l’étape 5.

## Fichiers de tests

- `tests/foundations.test.mjs` : session, accès, graine, version du stockage et dépôt.
- `src/domain/purchase.test.ts` : calculs, stock, versions, paiements, transitions, réception et versement.
- `src/mocks/handlers/index.test.ts` : lectures, profils, autorisations et premières mutations.
- `src/mocks/handlers/reliability.test.ts` : permissions, latence, erreurs, rollback, reset et confirmation Cash Plus répétée.
- `tests/foundations.spec.ts` : navigation, profils, routes et mises en page.
- `tests/purchase.spec.ts` : achat complet, Cash Plus, filtres, coordonnées, erreurs et reset.
- `tests/reliability.spec.ts` : double clic, profil verrouillé, stockage indisponible, clavier et notifications.

## Limites conservées dans le suivi

- Polices officielles et licences absentes : familles de remplacement explicites dans `tokens.css` et le README.
- Photos de bibliothèque : le blocage initial Wikimedia a été résolu par l’intégration de huit JPEG locaux avec leurs crédits. Décodage et affichage vérifiés sur le build lors de la validation de l’étape 4.
- Publication, demandes et négociation terminées et vérifiées : voir `validation-etape-4.md`. Les litiges et la modération restent à terminer et à auditer à l’étape 5.
- La recette globale AC01 à AC29 et l’audit complet d’accessibilité attendent la finition du prototype.
- Aucun nouvel `npm audit` n’a été exécuté dans cette session. Le résultat antérieur à zéro vulnérabilité demeure daté du 10 novembre 2026.
- Le scénario garanti reste local, fictif et limité à un seul onglet.

## Relancer la vérification

```powershell
npm run build
npm test
npm run test:e2e
```

Laisser le port 4173 disponible : Playwright démarre et arrête lui-même le serveur du build. Pour explorer l’application manuellement, utiliser `npm run dev`, puis ouvrir `http://127.0.0.1:5173/`.
