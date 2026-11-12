# To-do : AgriData Connect

Dernière mise à jour : 11 novembre 2026.

## Règles de suivi

Ce fichier suit les tâches nécessaires pour terminer le prototype défini dans le [PRD](PRD_Prototype_AgriData_Connect.md), notamment ses sections 12 et 14.

- Mettre à jour ce fichier automatiquement au fil du travail, sans attendre une demande de Bachirou.
- Cocher une tâche uniquement lorsque sa réalisation et les vérifications correspondantes sont terminées.
- Signaler une tâche commencée par la mention « En cours » et préciser le travail restant ; conserver sa case décochée.
- Signaler les blocages et ajouter les sous-tâches nécessaires lorsqu'ils sont identifiés.
- Après chaque étape terminée, actualiser le tableau d'avancement et la prochaine action ; indiquer brièvement les vérifications effectuées.
- Annoncer à Bachirou quand toutes les exigences P0 et la recette finale sont validées. Les options P1 ne bloquent pas cette livraison.

`bachirou.md` est réservé exclusivement aux notes demandées explicitement par Bachirou. Il reste vide tant qu'aucune note n'est demandée. Le niveau d'explication convenu pour ces notes est intermédiaire.

Légende : `[ ]` à faire ou à vérifier ; `[x]` terminé et vérifié.

## Avancement actuel

Les six étapes P0 sont terminées et vérifiées. Les logos, huit photos et trois polices officielles avec leurs licences sont locaux. Achats, négociation, litiges, modération et suivi financier sont validés, ainsi que la persistance, les permissions, les erreurs et l’affichage mobile. La recette AC01 à AC29 et le scénario oral sont documentés.

| Étape | État |
| --- | --- |
| 1. Fondations | Terminée : navigation, profils, logos et polices officielles intégrés et vérifiés |
| 2. Données et backend simulé | Terminée : API, permissions, persistance, idempotence, erreurs et reset validés |
| 3. Premier parcours complet | Terminée : Naps, Cash Plus et photos locales vérifiés |
| 4. Publication, demandes et négociation | Terminée : AC01 et AC11 à AC13 validés, y compris la réouverture après annulation |
| 5. Exceptions et contrôle administratif | Terminée : résolutions, expiration et modération vérifiées |
| 6. Finition, recette et présentation | Terminée : ressources locales, recette AC01 à AC29, documentation et présentation de 6 minutes |

**Prochaine action :** présenter le prototype depuis le build local en suivant `presentation-demo.md`. Les options P1 restent facultatives et hors de cette livraison.

## Liste des tâches

Les tests accompagnent chaque étape. Les repères AC renvoient aux critères d'acceptation du PRD ; ils doivent être vérifiés sur le build de démonstration.

### Préparation documentaire

- [x] Lire intégralement le PRD et le guide du dépôt.
- [x] Lire les 17 pages de la charte et examiner ses visuels.
- [x] Examiner le schéma de parcours présent dans le dossier.
- [x] Séparer les notes personnelles dans `bachirou.md` et le suivi automatique des tâches dans `to-do.md`.
- [x] Intégrer les logos officiels du dossier `Logos/`, les favicons et l’icône d’application.
- [x] Intégrer les polices officielles et leurs licences : Hepta Slab, Readex Pro et Martian Mono sont servies localement depuis `public/fonts/`, chargement vérifié dans le navigateur. Sources et licences SIL OFL conservées. Les pictogrammes d’interface utilisent Lucide.

### Étape 1 : fondations

**Objectif :** obtenir une application navigable avec les trois espaces.

- [x] Vérifier Node.js, npm et Git, puis retenir les versions compatibles et les documenter dans le README.
- [x] Initialiser React, TypeScript strict et Vite en conservant les documents présents ; créer le fichier de verrouillage des dépendances.
- [x] Mettre en place Git et un `.gitignore` adapté pour suivre les changements.
- [x] Créer les dossiers prévus, les types de base et les commandes de développement, build et tests.
- [x] Installer React Router et préparer les routes E01 à E20 du PRD, avec les accès selon le rôle. Navigation et accès directs validés par Playwright ; le contenu métier restant relève des étapes 4 à 6.
- [x] Construire les styles de marque, les composants communs et les structures de navigation ordinateur/mobile. Captures et absence de débordement vérifiées à 1440, 1366, 390 et 360 px ; polices finales suivies séparément.
- [x] Préparer la sélection de profil, la déconnexion et l’écran de profil, avec changement de profil dans l’en-tête. Les cinq profils, le rechargement, les dialogues et les coordonnées modifiables sont vérifiés dans le navigateur.

- [x] Retirer les mentions visibles de démonstration, prototype, simulation et fonctions à venir : bandeau, aide, réinitialisation, noms des profils, badges, pieds de page, métadonnées et états vides. Build et 5 tests réussis après modification.

**Décision de présentation de Bachirou :** l'interface doit employer les libellés d'une plateforme métier, sans commentaire sur sa fabrication ou son statut de démonstration. Cette instruction remplace l'obligation de bandeau indiquée dans le PRD. Conserver cette règle pour les prochaines pages. Le fonctionnement reste local et simulé ; la documentation technique en conserve la description. Ne pas remplacer une fonction absente par un faux résultat de transaction.

**Vérification ensemble :** passer d'un rôle à l'autre et retrouver une navigation adaptée ; aucun accès protégé ne doit dépendre seulement d'un bouton masqué.

**Résultats vérifiés le 10 novembre 2026 :**

- Node.js 20.19.2, npm 10.8.2 et Git 2.47.1 disponibles ; dépendances figées et installées depuis le cache local.
- `npm test` : 5 tests réussis, couvrant les droits, les profils fictifs, la conservation de session, la déconnexion et le stockage indisponible.
- `npm run build` : TypeScript strict et build Vite réussis ; fichiers générés dans `dist/`.
- `npm run dev` : démarrage réussi à `http://127.0.0.1:5173/` ; réponses HTTP 200 pour l'accueil, la connexion, une route profonde et les modules React contrôlés. Cela ne valide pas encore leur rendu visuel.
- `npm run preview` : démarrage réussi sur le port 4173 ; la route `/commandes/exemple` et les ressources JavaScript/CSS du build répondent en HTTP 200.
- `bachirou.md` est resté vide. Le PRD, la charte et le schéma sont conservés.

**Mise à jour du 11 novembre 2026 :** le blocage `spawn EPERM` est levé en lançant Playwright hors du bac à sable avec autorisation. Les parcours navigateur des fondations sont validés, avec captures dans `.cache/screenshots/`. Les erreurs d’encodage des anciens écrans sont corrigées. Vitest est installé et utilisé. Les polices encore absentes lors de cette première vérification ont ensuite été intégrées et vérifiées à l’étape 6.

### Étape 2 : données et backend simulé

**Objectif :** rendre les actions persistantes et cohérentes entre les profils.

- [x] Installer Vitest et configurer les tests des règles métier.

- [x] Ajouter MSW et générer `public/mockServiceWorker.js`.

- [x] Modéliser les entités et états de la section 8 du PRD, y compris réservations, mouvements de stock et cycles de livraison.
- [x] Préparer une graine reproductible : deux agriculteurs, deux acheteurs, un administrateur, huit offres, trois demandes, deux conversations et deux transporteurs.
- [x] Ajouter des commandes représentatives de plusieurs états, les notifications et les événements associés.
- [x] Construire le dépôt partagé, la sauvegarde JSON versionnée et une session distincte des données métier.
- [x] Gérer les données corrompues ou incompatibles et l'échec de stockage sans effacement silencieux ni mutation partielle.
- [x] Raccorder les données initiales au catalogue et aux listes métier en lecture seule.
- [x] Créer le client API et les premiers handlers de lecture pour profils, offres, demandes, conversations, commandes, notifications, versements et vues administratives.
- [x] Démarrer MSW avant le rendu, y compris dans le build, et retourner une erreur explicite pour les routes API inconnues.
- [x] Vérifier les contrôles d'accès des endpoints implémentés et la sauvegarde d'une modification de profil.
- [x] Compléter les handlers de la section 11 avec les mutations métier : offres, demandes, messages, propositions, commandes, paiements, livraisons, litiges, remboursements, remplacement et versements.
- [x] Vérifier le rôle et le propriétaire dans tous les handlers ; uniformiser les réponses de réussite et d'erreur.
- [x] Préparer une latence déterministe, l'erreur forcée, les clés d'idempotence et le blocage du changement de profil pendant une opération.
- [x] Préparer un mécanisme de réinitialisation des données, avec confirmation et limité aux clés du projet, en dehors des écrans métier présentés aux utilisateurs.
- [x] Tester la persistance, les permissions et l'annulation des changements en cas d'échec de sauvegarde.
- [x] Corriger les 8 alertes élevées relevées par `npm audit` : mise à jour des dépendances transitives et des versions directes épinglées. Bachirou a confirmé `npm audit` : 0 vulnérabilité.

**Vérifications du 11 novembre 2026 :** TypeScript et build réussis. `npm test` passe avec 14 tests de fondation et 64 tests Vitest. Les tests couvrent les rôles/propriétaires, erreurs forcées, reset confirmé, latence, rollback, paiement unique, notifications et persistance. Le verrouillage de profil pendant une réservation et la reprise après échec de stockage sont vérifiés dans le navigateur. Le contrôle d’erreur forcée est en mémoire : utiliser la navigation interne, sans recharger la page. Le résultat `npm audit` à 0 vulnérabilité est celui confirmé par Bachirou le 10 novembre, pas un nouvel audit.

Les règles de négociation ont été auditées et corrigées à l’étape 4. L’audit des handlers de litige et de modération est désormais réalisé à l’étape 5, avec tests de droits, stock, idempotence et rollback.

**Vérification ensemble :** modifier une donnée, changer de profil, recharger, puis réinitialiser. Les résultats doivent rester cohérents. Repères : AC22 à AC25.

### Étape 3 : premier parcours complet

**Objectif :** acheter un lot existant et aller jusqu'au versement.

- [x] Construire le catalogue, la recherche, les filtres, le tri, les états vides et le détail d'offre.
- [x] Ajouter l'édition des coordonnées et le récapitulatif avec adresses, quantité, transport et total.
- [x] Centraliser les calculs, vérifier stock et version du prix, figer les conditions et réserver à la confirmation.
- [x] Simuler Naps : paiement refusé, nouvelle tentative et paiement réussi sans double vente.
- [x] Simuler Cash Plus : référence `DEMO-CP-`, attente et confirmation explicite du paiement.
- [x] Afficher les listes de commandes et le détail partagé avec les actions propres à chaque rôle.
- [x] Construire la planification du transport et les transitions successives de livraison avec historique daté.
- [x] Ajouter la confirmation acheteur, la relance sans automatisme, le versement unique et la clôture.
- [x] Relier les événements aux notifications et aux e-mails fictifs dès ce parcours.
- [x] Tester les calculs, réservations, transitions et répétitions ; parcourir l'achat complet sur le build.

**Vérification ensemble :** retrouver le total de 1 975 MAD et le net agriculteur de 1 632 MAD, avec collecte interdite avant paiement et versement interdit avant réception conforme. Repères : AC02 à AC08 et AC14 à AC17.

**Recette fonctionnelle du 11 novembre 2026 :** achat Naps refusé puis réussi, commande persistante, planification et transitions, réception acheteur, relance sans clôture automatique, versement unique de 1 632 MAD. Cash Plus reste en attente jusqu’à confirmation administrative. Les montants, réservations, dates, permissions et notifications sont vérifiés. Voir `validation-etapes-1-3.md` pour les preuves et limites.

- [x] Remplacer les illustrations CSS de produits par des photos de bibliothèque locales. Huit JPEG présents dans `public/produce/`, sources et crédits conservés ; décodage navigateur, affichage du catalogue et sélection dans la publication vérifiés. Captures ordinateur et mobile revues le 11 novembre 2026.

### Étape 4 : publication, demandes et négociation

**Objectif :** permettre aux deux parties de créer et négocier leurs propres transactions.

- [x] Permettre à l'agriculteur de publier, modifier et désactiver une offre avec une image locale.
- [x] Permettre à l'acheteur de publier, modifier et fermer une demande.
- [x] Permettre une réponse avec un lot du bon produit appartenant à l'agriculteur.
- [x] Construire les conversations, les messages datés et leurs notifications, sans réponse automatique fictivement attribuée à une personne.
- [x] Ajouter propositions, contre-propositions, acceptation et refus avec contrôle du destinataire.
- [x] Créer une commande depuis une proposition acceptée en conservant exactement son prix et sa quantité.
- [x] Invalider les propositions concernées après modification ou fermeture d'une demande ; empêcher leur réutilisation.
- [x] Limiter une demande P0 à une commande ; gérer sa réouverture après annulation avant paiement sans réactiver les anciennes propositions.
- [x] Tester le parcours négocié et le parcours depuis une demande avec changement de profil.

**Vérification ensemble :** publier en agriculteur, retrouver en acheteur, négocier puis commander sans dupliquer la transaction. Repères : AC01 et AC11 à AC13.

**Recette du 11 novembre 2026 :** build réussi, 108 tests Node/Vitest et 31 scénarios Playwright réussis. Après ajustement du filtre de ville et de l’attente des images pour les captures, 9 scénarios ciblés supplémentaires réussis. La commande négociée conserve les conditions de l’accord, y compris lorsque le producteur accepte une contre-proposition de l’acheteur. L’acceptation ne crée aucune commande ni réservation. Les contrôles d’unicité, de stock et d’invalidation sont vérifiés, ainsi que les largeurs 1440, 1366, 390 et 360 px. Voir `validation-etape-4.md`.

### Étape 5 : exceptions et contrôle administratif

**Objectif :** traiter les situations qui interrompent le parcours normal.

- [x] Ajouter l'annulation et l'expiration manuelle d'une commande non payée, avec libération de réservation. Annulation acheteur et expiration administrative vérifiées ; les tentatives en attente sont invalidées.
- [x] Invalider les anciennes tentatives Cash Plus après changement de moyen et refuser leur confirmation tardive.
- [x] Ouvrir un litige après remise et avant confirmation conforme, avec motif, description, preuve locale facultative et commentaires autorisés.
- [x] Séparer l'enregistrement d'une décision de son exécution ; garder le versement bloqué tant que nécessaire.
- [x] Exécuter le remboursement total avec clôture et absence de versement au producteur.
- [x] Exécuter l'accord partiel, recalculer commission et net, puis clôturer après versement si un montant reste dû.
- [x] Exécuter un remplacement : vérifier et déduire le stock une fois, créer un nouveau cycle et conserver l'ancien historique sans second paiement acheteur.
- [x] Permettre le signalement d'un problème sur ce remplacement dans le même dossier ; limiter P0 à un cycle de remplacement.
- [x] Ajouter la suspension et la réactivation des comptes et annonces avec motif, sans empêcher le traitement des commandes existantes.
- [x] Tester les remboursements, la réconciliation financière, les permissions, le stock insuffisant et les opérations répétées.

**Vérification ensemble :** rejouer les trois résolutions et constater que chaque clôture correspond aux opérations réellement exécutées. Repères : AC09, AC10, AC18 à AC22 et AC29.

**Recette du 11 novembre 2026 :** 144 tests Node/Vitest/API réussis. Les six parcours navigateur de litige et modération passent : remboursement total avec preuve/commentaire, accord partiel et versement, remplacement conforme, problème sur le remplacement, Cash Plus invalidé et expiration, suspension sans blocage des commandes existantes. Le stock insuffisant, les répétitions, les permissions et le rollback de sauvegarde sont couverts par les tests métier/API.

### Étape 6 : finition, recette et présentation

**Objectif :** obtenir une démonstration fiable et explicable.

- [x] Finaliser les tableaux de bord calculés, les paiements, les règlements et les vues administratives.
- [x] Finaliser compteur de notifications, lecture, liens vers les objets et journal d’e-mails fictifs pour le parcours d’achat direct. Notifications et e-mails des messages, accords, litiges et résolutions également vérifiés.
- [x] Vérifier les écrans E01 à E20 et leurs états chargement, vide, erreur, interdit et introuvable.
- [x] Intégrer les ressources officielles de marque et héberger localement polices, licences et images nécessaires.
- [x] Vérifier les tailles 1440 × 900, 1366 × 768, puis 390 et 360 px de large sans débordement global.
- [x] Vérifier clavier, focus visible, libellés, fermeture des dialogues et cibles tactiles de 44 × 44 px espacées de 8 px.
- [x] Vérifier les routes rechargées directement dans le build, le contrôle des accès et l'absence d'erreurs de console sur les parcours principaux.
- [x] Exécuter les tests unitaires, l'intégration MSW et les parcours navigateur : achat carte, attente Cash Plus et remboursement après litige.
- [x] Valider tous les critères AC01 à AC29 de la section 12 sur le build et consigner les résultats, anomalies et corrections.
- [x] Rédiger le README : installation, commandes, profils, limites, réinitialisation et scénario de présentation.
- [x] Préparer l'oral principal de 5 à 7 minutes et des commandes distinctes pour Cash Plus, négociation et litige.
- [x] Rejouer la démonstration depuis la graine et préparer un build servi localement avec ses ressources.

**Critère de fin :** toutes les fonctions P0 sont réalisées et vérifiées ; les montants se réconcilient, les scénarios sont rejouables et les ressources visuelles finales sont présentes. Repères transversaux : AC23 à AC28, puis recette complète AC01 à AC29.

**Recette finale du 11 novembre 2026 :** build TypeScript/Vite réussi, 145 tests Node/Vitest/API et 45 scénarios Playwright réussis (7,9 minutes). Après les derniers ajustements de libellés, de contraste et d’attente des ressources dans les captures : build reconstruit et 9 scénarios ciblés réussis (1,8 minute). Les vingt écrans, AC01 à AC29, les quatre largeurs, le clavier, les ressources locales et les reprises sont validés. Captures d’accueil, catalogue, tableaux de bord, finance et formulaires inspectées. Le README, `validation-finale.md` et `presentation-demo.md` sont finalisés ; `bachirou.md` reste vide. Build servi localement à `http://127.0.0.1:4173/`.

**Documentation de remise :** README refondu à la demande de Bachirou avec présentation et fonctionnalités par rôle, prérequis et versions vérifiés, procédures d’installation/démarrage/test, schéma d’architecture, arborescence, règles métier, stockage et reset, dépannage, préparation de la remise, ressources et limites. Liens internes et commandes contrôlés contre les fichiers du projet. Modification documentaire uniquement ; les résultats de recette restent ceux de `validation-finale.md`.

### Options P1 : seulement après P0

- [ ] Inscription locale et récupération de mot de passe simulée.
- [ ] Comparateur dédié de deux ou trois offres comparables.
- [ ] Graphique de prix avec historique explicitement fictif et sourcé.
- [ ] Import d'images personnelles.
- [ ] Export d'un récapitulatif de commande.

La comparaison par consultation du catalogue appartient déjà à P0. Les accès aux options P1 non développées doivent rester masqués ; leur absence sera documentée.
