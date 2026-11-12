# Présentation AgriData Connect : 6 minutes

## Préparer la séance

```powershell
npm ci
npm test
npm run build
npm run test:e2e
npm run preview
```

Les tests navigateur démarrent leur propre serveur sur 4173 : lancer `preview` après leur fin. Ouvrir ensuite http://127.0.0.1:4173 dans un seul onglet. Pour un poste déjà installé, commencer à `npm test`. Les logos, images et polices sont locaux.

Choisir Administration sur `/connexion`, ouvrir `/outils-techniques`, cliquer sur « Réinitialiser les données », puis confirmer. Le jeu initial contient sept commandes et un litige ouvert. Ne pas réinitialiser entre les différentes parties de la démonstration. Conserver les références des nouvelles commandes et utiliser le sélecteur de profil de l’en-tête.

Dire à l’oral que les acteurs, paiements, e-mails et transports sont simulés localement. L’interface utilise les libellés métier convenus ; aucune opération bancaire réelle n’est réalisée.

## Parcours principal chronométré

| Temps | Écran et action | Point à expliquer |
| --- | --- | --- |
| 0:00 à 0:35 | Accueil puis catalogue | Mise en relation de producteurs et acheteurs de tomates et d’oignons au Maroc. Présenter rapidement prix, minimum, origine et stock disponible. |
| 0:35 à 1:25 | Restaurant Jardin, tomates rondes de Coopérative Atlas, « Commander » | Choisir 500 kg à 3,40 MAD/kg. Calculer : 1 700 MAD de produits + 275 MAD de livraison = 1 975 MAD. Les adresses et les conditions sont figées dans la commande. Confirmer et réserver. |
| 1:25 à 2:05 | Paiement Naps | Préparer, déclarer un refus, préparer à nouveau puis valider. Une seule commande et une seule vente de stock ; le refus conserve l’historique. |
| 2:05 à 3:10 | Administration, même commande | Planifier avec un transporteur, une collecte et une arrivée cohérentes. Avancer collecte, livraison et remise. La remise du transporteur laisse le versement bloqué. |
| 3:10 à 3:40 | Restaurant Jardin, même commande | Montrer la chronologie partagée puis confirmer la réception conforme. |
| 3:40 à 4:20 | Administration puis Coopérative Atlas | Verser 1 632 MAD au producteur : 1 700 MAD moins 68 MAD de commission. La commande est clôturée ; le règlement apparaît chez le producteur. |
| 4:20 à 5:25 | Administration, `/admin/litiges/dispute-delivery` | Ouvrir le dossier de la commande distincte déjà livrée. Prendre en charge, choisir le remboursement total et motiver. Enregistrer la décision : aucun argent ne bouge encore. Exécuter puis confirmer : 990 MAD remboursés, aucun versement et clôture. |
| 5:25 à 6:00 | `/admin/paiements` puis `/admin` | Montrer remboursement, commissions et montants dus calculés. Recharger une commande pour prouver la persistance. Expliquer que les suspensions empêchent de nouvelles transactions tout en préservant le suivi des commandes existantes. |

Pour tenir cinq minutes, ne montrer que le paiement réussi et décrire le refus. Pour aller à sept minutes, ouvrir la notification de réception ou détailler le motif de modération. Ne pas accélérer les étapes de livraison en sautant un état.

## Démonstrations complémentaires indépendantes

**Cash Plus.** Utiliser la commande initiale `/commandes/order-awaiting-payment/paiement`, distincte de l’achat principal. Choisir Cash Plus puis utiliser ce moyen. Relever la référence `DEMO-CP-`, recharger et constater l’attente. Administration ouvre `/admin/paiements` et confirme cet encaissement. La collecte devient possible. Variante : passer à Naps avant confirmation ; l’ancienne référence devient invalidée.

**Négociation.** Restaurant Jardin ouvre `/messages/conversation-offer` et fait une contre-proposition de 600 kg à 3,10 MAD/kg. Coopérative Atlas accepte. Restaurant Jardin prépare une nouvelle commande : produits 1 860 MAD, livraison 300 MAD, total 2 160 MAD. L’acceptation seule n’avait réservé aucun stock. Cette commande reste distincte du parcours principal.

**Litige partiel.** Après une nouvelle réinitialisation, Administration ouvre `dispute-delivery`. Prendre en charge, choisir l’accord financier partiel, saisir 100 MAD de produits et 50 MAD de transport remboursés, motiver, enregistrer puis exécuter. La commande reste ouverte. Vérifier : 990 MAD payés = 150 remboursés + 662,40 nets producteur + 27,60 de commission + 150 de transport conservé. Effectuer le versement pour clôturer.

**Remplacement.** Après réinitialisation, traiter le même dossier avec 100 kg du même lot. Exécuter une fois : stock diminué de 100 kg et cycle 2 visible. Planifier et avancer ce cycle jusqu’à la remise. Restaurant Jardin confirme, puis Administration verse 758,40 MAD. Le premier cycle est conservé et aucun nouveau paiement acheteur n’a été créé.

**Remplacement défectueux.** Au lieu de confirmer le cycle 2, l’acheteur choisit « Signaler un problème sur le remplacement », renseigne motif et description. Le même dossier revient en traitement. L’administration choisit désormais une résolution financière ; un deuxième remplacement n’est pas proposé.

**Modération.** Sur `/admin/moderation`, sélectionner Offres, suspendre les tomates rondes avec un motif. Le lot disparaît des nouvelles ventes ; une commande déjà créée reste consultable et traitable. Réactiver avec un nouveau motif. L’historique conserve les deux interventions.

## Reprise en cas d’imprévu

- Paiement refusé : préparer une nouvelle tentative. Ne pas recréer la commande.
- Erreur de sauvegarde : rétablir le stockage puis relancer la même action. Aucun succès n’est annoncé avant sauvegarde.
- Stock insuffisant pour remplacer : fermer la confirmation, choisir « Revoir la décision », puis un remboursement.
- Données d’un essai précédent : utiliser le reset confirmé des outils techniques avant de recommencer le scénario complet.
- Après la séance : arrêter le serveur avec Ctrl+C. Les données restent dans le navigateur utilisé.
