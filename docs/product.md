# Produit et règles métier

Application interne pour le suivi des dossiers du service client. Elle est conçue d’abord pour un ordinateur portable et reste utilisable sur écran plus étroit. Les échanges clients par WhatsApp et e-mail sont saisis manuellement.

## Équipes, comptes et responsabilité

- L’application est réservée aux agents actifs connectés. Le compte lié à un agent doit être actif dans `agents`.
- La responsabilité (`owner_id`) est fixée à la création et ne peut pas être transférée après, d’après le déclencheur de base.
- Les équipes prévues par le code sont Ops Madagascar (`mada_ops`) et Ops Seychelles (`sez_ops`). Sez Ops est une équipe externe : elle n’a aucun compte dans l’application. Son avancement est consigné manuellement par le propriétaire du dossier.
- Écart à confirmer : les quatre agents en base sont actuellement affectés à l’équipe `cs`, que le code ne prévoit pas.

## Dossiers

- Canaux : WhatsApp, e-mail. Catégories : douane, livraison, facturation, compte client, autre.
- Statuts : nouveau, en cours, escaladé, résolu. Une escalade exige une équipe cible (`assigned_team`). Le passage en résolu horodate `resolved_at`; quitter ce statut l’efface.
- Vues : mes dossiers, tous, escaladés, résolus et archivés. La recherche porte sur sujet, nom client et numéro.
- L’archivage est réversible : `deleted_at` et `deleted_by` masquent le dossier des vues actives et des rapports, puis restauration possible.
- La suppression définitive apparente est une tombstone : `permanently_deleted_at` masque le dossier et son journal des usages applicatifs, mais conserve les lignes en base. Une tombstone ne peut être annulée.

## Journal

Le journal conserve des entrées ajoutées par un agent et triées des plus récentes aux plus anciennes. Types : note interne (`note`), échange client (`customer_update`), escalade (`escalation`), changement de statut (`status_change`). Le canal d’une entrée est facultatif et nul pour les événements internes. Les entrées sont append-only selon les règles applicatives et les permissions d’insertion ; le journal ne propose pas de modification/suppression.

## Rapports

La fonction `kpi_report(period_days)` fournit les dossiers ouverts actuellement (tout statut sauf résolu), les dossiers résolus pendant la période choisie (7, 30 ou 90 jours), et leur temps moyen de résolution depuis la création. Les chiffres sont déclinés par canal et catégorie. Les dossiers archivés et tombstonés sont exclus. Le taux affiché est le nombre résolu dans la période divisé par la somme des ouverts actuels et résolus dans la période.

## Accès

La connexion utilise Supabase Auth. Seuls les agents actifs authentifiés peuvent lire les agents, dossiers et journaux visibles ou créer des dossiers et entrées. Le créateur devient propriétaire. La base contrôle aussi le statut actif, l’auteur d’une entrée, l’immuabilité du propriétaire et l’exclusion des dossiers tombstonés. Aucun rôle administrateur distinct n’apparaît dans l’application.

## Contraintes

Le service doit rester gratuit. La progression de Sez Ops, WhatsApp et e-mail n’est pas synchronisée automatiquement avec des services tiers.

Les catégories et les canaux doivent pouvoir être modifiés par un administrateur sans changement de code. Les valeurs actuelles décrivent les options disponibles aujourd’hui; la liste de référence devra être administrable.
