# Architecture

## Application et déploiement

Interface React 19 et TypeScript, compilée avec Vite 8. Supabase fournit l’authentification et PostgreSQL. Le dépôt GitHub `CLR26/sez.26` déploie automatiquement la branche `main` vers Cloudflare Pages.

## Configuration

- `VITE_SUPABASE_URL` : URL publique du projet Supabase.
- `VITE_SUPABASE_ANON_KEY` : clé publique anon/publishable utilisée dans le navigateur.

Ces variables sont intégrées à la compilation. Aucun secret de service ne doit être utilisé dans le navigateur.

## Flux de données

Le navigateur se connecte avec Supabase Auth, charge le profil dans `agents`, puis lit et écrit les dossiers et entrées du journal via le client Supabase sous RLS. La base maintient les dates de résolution et d’archivage et protège la responsabilité. Les rapports proviennent de la fonction SQL `kpi_report`. Les communications client et retours de Sez Ops sont saisis par les agents.

## Schéma live observé

Trois tables publiques avec RLS activé :

- `agents` : `id` (référence à `auth.users`), `full_name`, `team` (texte, valeur par défaut `cs`), `active`.
- `cases` : identifiant bigint, sujet, client, contact facultatif, canal, catégorie, statut, propriétaire, équipe affectée facultative, dates de création/résolution, champs d’archivage `deleted_at`/`deleted_by`, tombstone `permanently_deleted_at`.
- `case_events` : identifiant, dossier, auteur, type, canal facultatif, texte, date. Clés étrangères vers dossier, agent auteur et agent propriétaire/archiveur.
- Vue `kpi_cases` : comptages et durée moyenne par catégorie/canal, hors dossiers archivés ou tombstonés.

Types enum : `case_channel` (whatsapp, email), `case_category` (customs, delivery, billing, account, other), `case_status` (new, in_progress, escalated, resolved), `case_team` (mada_ops, sez_ops). Les types d’entrée sont du texte contraint par `case_events_kind_check`.

Fonctions : `is_active_agent`, `set_resolved_at`, `lock_owner`, `guard_archive`, `guard_case_tombstone`, `delete_case`, `kpi_report`, ainsi que le déclencheur d’événement DDL Supabase `rls_auto_enable`. Déclencheurs de dossiers : dates de résolution, verrou du propriétaire, archivage et protection tombstone. Index : clés primaires, statut, création, dossiers actifs/visibles, événements par dossier/date.

Politiques RLS : les agents authentifiés actifs lisent les agents et dossiers non tombstonés; ils créent un dossier seulement à leur propre nom d’utilisateur, modifient des dossiers non tombstonés, lisent les journaux de dossiers non tombstonés et ajoutent des entrées sous leur propre identité. Les dossiers escaladés doivent avoir une équipe affectée.

La publication `supabase_realtime` ne contient actuellement aucune table. Extensions effectivement installées : `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault`.

## Invariants et écart de synchronisation

Le propriétaire est immuable, le statut résolu pilote `resolved_at`, l’archivage est réversible, une tombstone est définitive et conserve dossier/journal, et RLS reste actif. La liste des migrations enregistrées par Supabase est vide alors que le dépôt contient une migration de tombstone ; la base live contient déjà ses objets. Il faut donc établir une baseline fidèle avant d’utiliser le suivi de migrations comme source de synchronisation.

Écart important à traiter avec le propriétaire : `agents.team` est librement textuel en base et les agents live ont tous `cs`, contre `mada_ops`/`sez_ops` dans les types du code. Le code et la base doivent être réconciliés séparément après confirmation métier. Aucun objet de notification ou abonnement Realtime applicatif n’est présent.
