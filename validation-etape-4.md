# Validation de la publication et de la négociation

Date : 11 novembre 2026. Tests locaux sous Windows, avec le build Vite servi par HTTP et Microsoft Edge piloté par Playwright.

## Périmètre livré

- Huit photos de bibliothèque locales pour les offres initiales ; choix de photo par produit à la publication et à la modification d’un lot. Sources et crédits dans `public/produce/CREDITS.md`.
- Publication, modification, désactivation et republication des offres du producteur ; contrôle des champs, du propriétaire, de la version et des réservations existantes.
- Publication, modification et fermeture des demandes de l’acheteur ; réponse avec un lot appartenant au producteur et correspondant au produit demandé.
- Conversations, messages datés, propositions, contre-propositions, acceptation et refus, avec notifications persistantes et journal des e-mails fictifs.
- Acceptation distincte de la création de commande. Aucun stock réservé à l’accord. Récapitulatif réservé à l’acheteur, prix et quantité verrouillés, conditions de qualité conservées dans la commande.
- Une proposition ne produit qu’une commande. Une demande ne produit qu’une commande active ; les accords concurrents sont invalidés. L’annulation avant paiement rouvre le besoin et libère le stock sans réactiver les anciennes propositions.

## Résultats

| Vérification | Résultat |
| --- | --- |
| `npm run build` | TypeScript strict et build réussis |
| `npm test` | 108 tests réussis : 14 Node et 94 Vitest, dont 30 nouveaux tests de négociation et d’API |
| `npm run test:e2e` | 31 scénarios réussis en 3,8 minutes : 22 existants et 9 nouveaux |
| Vérification finale ciblée | 9 scénarios réussis en 1,1 minute après ajustement du filtre de ville et de l’attente du contenu et des photos dans les captures |
| Photos | Huit JPEG décodés dans le navigateur, largeur minimale 1 000 px ; choix de photo retrouvé dans le catalogue et après rechargement |
| Revue visuelle | Photos sources inspectées ; captures ordinateur et mobile conservées dans `.cache/screenshots/` |

La vérification navigateur a utilisé l’autorisation de lancer Edge hors du bac à sable. Les captures complètes attendent le chargement des photos situées sous la zone visible et le contenu métier, afin de ne pas confondre un écran de chargement avec un écran validé.

## Critères d’acceptation

| Critère | Preuve |
| --- | --- |
| AC01 | Publication d’un lot par Coopérative Atlas, choix de photo, consultation par Restaurant Jardin, modification du prix, désactivation puis retrait du catalogue |
| AC11 | Contre-proposition de 600 kg à 3,10 MAD/kg acceptée par le producteur ; aucune commande à l’acceptation ; récapitulatif à 2 160 MAD ; commande unique, quantité/prix figés et stock revérifié |
| AC12 | Nouvelle demande de 700 kg à Tanger ; réponse avec un lot de tomates du producteur ; accord, commande liée à la demande et récapitulatif à 2 565 MAD |
| AC13 | Modification d’une demande après acceptation : accord invalidé et producteur notifié ; nouvelle proposition puis fermeture : nouvelle invalidation vérifiée |
| Unicité et réouverture | Une seule commande pour chaque accord ; un seul achat actif pour chaque demande ; après annulation, demande ouverte, réservation libérée et accord utilisé pointant vers la commande annulée |
| Permissions | Destinataire seul autorisé à accepter/refuser, propriétaire seul autorisé à modifier, acheteur seul autorisé à commander ; accès direct à une autre conversation refusé |
| Persistance et erreurs | Accord et messages conservés après rechargement ; échec de sauvegarde sans mutation partielle de la demande, des accords ou des notifications |

Les tests de domaine vérifient aussi les accords concurrents de deux producteurs, les produits incompatibles, les substitutions de quantité/prix, les demandes fermées, le stock devenu insuffisant et l’impossibilité de contourner une suspension d’offre.

## Fichiers de vérification

- `src/domain/trading.test.ts` : règles de publication, demandes, messages, accords et commandes négociées.
- `src/mocks/handlers/trading.test.ts` : autorisations, persistance, erreurs de sauvegarde et parcours API.
- `tests/trading.spec.ts` : cinq parcours fonctionnels et quatre largeurs, 1440, 1366, 390 et 360 px.
- `tests/purchase.spec.ts` : parcours d’achat existant et captures du catalogue avec les photos chargées.

## Limites restantes

Les polices officielles et leurs licences restent à intégrer. Les litiges, la modération et la recette globale AC01 à AC29 relèvent des étapes 5 et 6. L’annulation avant paiement est disponible pour vérifier la réouverture d’une demande ; l’expiration administrative et les autres exceptions nécessitent encore leur recette d’étape 5. Les intégrations restent locales et simulées, dans un seul onglet. Aucun nouvel audit de dépendances n’a été effectué pendant cette étape.

## Rejouer

```powershell
npm run build
npm test
npm run test:e2e
```

Laisser le port 4173 libre pour Playwright. Pour une vérification manuelle, lancer `npm run dev`, puis utiliser les parcours décrits dans le README.
