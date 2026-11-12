# Recette finale : AgriData Connect

Date : 11 novembre 2026. Périmètre : exigences P0 du PRD, étapes 1 à 6. L’interface française suit la décision de Bachirou concernant les libellés métier. Les identités, transactions, transports et messages restent locaux et simulés.

## Résultats d’exécution

- `npm test` : 14 tests Node et 131 tests Vitest/API réussis, soit 145 tests.
- `npm run build` : TypeScript strict et build Vite réussis ; ressources regroupées dans `dist/`.
- `npm run test:e2e` : 45 scénarios réussis en 7,9 minutes, sans échec.
- Après les derniers ajustements de présentation, nouveau build réussi et neuf scénarios ciblés réussis en 1,8 minute : libellés, litiges, vingt écrans, clavier et captures aux quatre largeurs. Les captures attendent désormais le chargement des polices et le décodage des images.

Environnement : Windows, Node.js 20.19.2, npm 10.8.2, Microsoft Edge sans interface piloté par Playwright. Le navigateur utilise le build servi par Vite sur `127.0.0.1:4173`, avec MSW actif. Les tests partent chacun d’un contexte navigateur neuf. Les parcours testent de vrais rechargements et changements de profil, sans appeler un backend distant.

Les preuves exécutables sont dans `tests/*.spec.ts`, `tests/foundations.test.mjs`, `src/domain/*.test.ts` et `src/mocks/handlers/*.test.ts`. Les captures sont dans `.cache/screenshots/`, les traces d’échec éventuelles dans `test-results/`. Ces fichiers générés ne sont pas suivis par Git.

## Matrice AC01 à AC29

Les 29 critères ci-dessous sont validés par la régression complète, les tests métier/API et les derniers contrôles ciblés du build final.

| Critère | Vérification et résultat attendu |
| --- | --- |
| AC01 | `trading.spec.ts` : publication avec photo, même lot retrouvé au catalogue après changement de rôle. |
| AC02 | `purchase.spec.ts` : recherche sans résultat, message vide, réinitialisation des filtres. |
| AC03 | `purchase.test.ts`, `trading.test.ts`, `purchase.spec.ts` : quantité minimale et stock, aucune réservation invalide, revérification à la commande. |
| AC04 | Achat navigateur de 500 kg : 1 700 MAD de produits + 275 MAD de transport = 1 975 MAD. |
| AC05 | Commande persistante et accessible aux parties ; collecte absente tant que le paiement n’est pas confirmé. Contrôles API des trois rôles. |
| AC06 | Naps refusé puis réussi : une commande, une vente de stock, tentatives historisées. |
| AC07 | Cash Plus attend explicitement l’encaissement administratif, y compris après rechargement ; collecte impossible. |
| AC08 | `reliability.test.ts` : répétition de confirmation Cash Plus sans nouveau paiement, mouvement, événement ou notification. |
| AC09 | `exceptions.spec.ts` : passage de Cash Plus à Naps, ancienne confirmation refusée par l’API avec 409. |
| AC10 | Annulation acheteur et expiration administrative : réservation libérée, historique conservé, tentatives invalidées et demande éventuelle rouverte. |
| AC11 | Accord accepté sans réservation ; commande au prix et à la quantité de l’accord, contrôle du stock et de l’unicité. Acceptation vérifiée dans les deux sens. |
| AC12 | Demande publiée, réponse avec lot du bon produit, conversation, acceptation et commande liée ; scénario navigateur complet. |
| AC13 | Modification/fermeture de demande : anciens accords invalidés, interlocuteurs notifiés, aucune réutilisation possible. |
| AC14 | Livraison séquentielle, événements datés, chronologie et notifications conservées chez acheteur et producteur. |
| AC15 | Remise signalée sans réception conforme : versement absent et action prématurée refusée. |
| AC16 | Réception acheteur puis versement administratif unique : net 1 632 MAD et clôture. |
| AC17 | Relance visible, notification persistante, commande laissée ouverte sans réponse de l’acheteur. |
| AC18 | Signalement après remise, photo locale et commentaire producteur visibles dans le dossier ; blocage du versement et contrôles d’accès. |
| AC19 | Décision seule sans remboursement ; exécution totale unique, montant produits + transport, aucun versement, clôture et aucun retour automatique de stock. |
| AC20 | Remboursement de 150 MAD : 662,40 MAD nets, 27,60 MAD de commission, 150 MAD de transport conservé ; clôture après versement. Cas net nul et montants invalides testés. |
| AC21 | Cycle 2 créé et stock déduit une seule fois ; cycle 1 intact, aucun nouveau paiement, réception conforme puis versement. Problème du remplacement traité dans le même dossier ; second remplacement interdit. |
| AC22 | Routes protégées et API 401/403 selon session/rôle/propriétaire, notamment litiges, commentaires, modération et opérations financières. Dépôt inchangé après refus. |
| AC23 | Rechargements et changements de rôle sur achats, offres, demandes, messages, litiges, remboursements et notifications. Contrôle du JSON persisté et du dépôt rechargé. |
| AC24 | Reset confirmé : sept commandes initiales, graine complète, session et clés des autres applications préservées. Annulation du dialogue testée. |
| AC25 | Erreur forcée, reprise, stockage indisponible/corrompu ; rollback des commandes, demandes, remboursements, remplacements et suspensions. |
| AC26 | Accueil, catalogue, publication, conversations, commande et administration vérifiés à 1440, 1366, 390 et 360 px. Absence de débordement global mesurée. |
| AC27 | Navigation Tab/Entrée/Échap, focus visible de 3 px, boucle de focus du dialogue, retour au déclencheur et champs étiquetés. Dimensions des cibles et espacements des groupes d’actions contrôlés. |
| AC28 | Ouverture directe et rechargement des routes privées dans le build ; contrôle d’accès maintenu, aucune page blanche. |
| AC29 | Suspension avec motif de l’offre achetée : nouvelle commande refusée, réception et versement de l’ancienne commande possibles. Test supplémentaire avec acheteur suspendu. |

## Revue des écrans

`final-review.spec.ts` ouvre les routes suivantes avec le rôle autorisé, attend le chargement, vérifie l’absence d’alerte inattendue et d’erreur de console, mesure le débordement et les dimensions des éléments interactifs. Les scénarios fonctionnels vérifient les mutations associées.

| Écran | Route vérifiée | États particuliers couverts |
| --- | --- | --- |
| E01 | `/` | Accueil public, navigation, ressources locales. |
| E02 | `/connexion` | Cinq profils, session invalide, stockage indisponible. |
| E03 | `/offres` | Liste chargée, recherche vide, erreur forcée et nouvelle tentative. |
| E04 | `/offres/offer-tomato-round-m` | Détail, achat/discussion ; identifiant inconnu et offre suspendue. |
| E05 | `/profil` | Sauvegarde et persistance, description d’exploitation, type d’acheteur. |
| E06 | `/messages`, `/messages/conversation-offer` | Conversation, propositions, refus/acceptation ; accès d’autrui interdit. |
| E07 | `/acheteur/demandes` | Publication, modification, fermeture, propositions invalidées. |
| E08 | `/commande/nouvelle?offre=offer-tomato-round-m` | Récapitulatif, limites de quantité, accord négocié, échec de sauvegarde. |
| E09 | `/commandes/order-awaiting-payment/paiement` | Naps refusé/réussi, Cash Plus en attente et invalidé. |
| E10 | `/acheteur/commandes` | Liste persistante et filtres, historique d’annulation. |
| E11 | `/commandes/order-awaiting-reception` | Livraison, réception, litige, cycles, remboursement, versement ; 403 et introuvable. |
| E12 | `/agriculteur/offres` | Publication avec photo, modification, désactivation, suspensions. |
| E13 | `/demandes`, `/demandes/request-onion-rabat` | Détail et réponse depuis un lot compatible, droits selon le profil. |
| E14 | `/agriculteur/commandes` | Conditions et progression partagées avec l’acheteur. |
| E15 | `/agriculteur/reglements` | Montants dus, blocage par réception/litige et versement effectué. |
| E16 | `/admin` | Indicateurs calculés et séparation encaissements/commission. |
| E17 | `/admin/commandes` | Liste et filtre, accès aux actions de livraison et expiration. |
| E18 | `/admin/paiements` | Tentatives, confirmation Cash Plus, remboursements et versements. |
| E19 | `/admin/litiges`, `/admin/litiges/dispute-delivery` | Filtre vide, preuve, commentaires, trois décisions, confirmation d’exécution et dossier introuvable. |
| E20 | `/admin/moderation` | Comptes/offres/demandes, motif obligatoire, suspension/réactivation ; erreur récupérable et accès interdit. |

Les états de chargement et d’erreur reposent sur le composant partagé `Feedback`. Les pages publiques statiques n’ont pas d’état de chargement métier. La matrice couvre les états pertinents aux scénarios, pas toutes les combinaisons artificielles possibles de chaque écran et de chaque erreur.

## Corrections effectuées pendant les étapes 5 et 6

- Réutilisation du versement bloqué existant après résolution, pour éviter deux versements attachés à une commande.
- Création d’un cycle de remplacement distinct, planifiable, avec stock déduit une seule fois et paiement acheteur inchangé.
- Signalement du remplacement attaché à l’identifiant de commande puis au même dossier ; résolution financière imposée après un nouvel échec.
- Séparation stricte entre décision et exécution ; contrôle des montants partiels, idempotence et refus du stock insuffisant sans mutation.
- Suspension compatible avec le règlement des engagements existants. Réactivation d’une demande selon son état antérieur ou sa commande, sans ressusciter d’anciennes propositions.
- Interdiction de préparer un paiement après un remboursement partiel, même si le versement producteur laisse encore la commande ouverte.
- Suppression d’un débordement de l’en-tête administrateur à 360 px ; retour à une disposition verticale des messages de décision.
- Champs de profil prévus dans F01 ajoutés : courte présentation agricole et type d’acheteur, avec validation des champs autorisés par rôle.
- Hepta Slab, Readex Pro et Martian Mono chargées localement, avec licences SIL OFL. Le navigateur vérifie le chargement des trois familles et l’absence de requête externe sur les vues administratives.

Les premières exécutions de tests ont aussi révélé deux erreurs de scénario : nom incorrect du journal d’e-mails et attente d’une conversation vide alors que la graine en contient une. Ces assertions ont été corrigées en fonction des données prévues, sans modifier la graine.

## Ressources, présentation et limites

Les logos officiels, les huit photos et les trois polices sont dans `public/` et copiés dans le build. Les sources/licences sont dans `public/produce/CREDITS.md` et `public/fonts/CREDITS.md`. Les captures de catalogue, de formulaire de décision, de modération et de tableau de bord sont inspectées sur ordinateur et mobile.

Le README donne installation, commandes, profils, stockage et réinitialisation. `presentation-demo.md` fournit un oral principal de six minutes, des commandes distinctes pour Cash Plus/négociation/litige et des variantes remboursement partiel/remplacement. Les tests rejouent ces parcours depuis la graine.

La validation porte sur un prototype local à un onglet, sur Edge/Chromium. Elle ne constitue pas une homologation bancaire, un audit de sécurité de production, une conformité d’accessibilité exhaustive ni une validation Safari/Firefox. Les opérations réelles, comptes clients réels, synchronisation multi-appareil et options P1 restent hors périmètre. `bachirou.md` est conservé vide.
