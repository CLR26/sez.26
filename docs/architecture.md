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

## Écarts résiduels de la baseline (comparaison live du 2026-09-30)

La baseline décrit les tables, colonnes, enums, contraintes métier, fonctions applicatives, déclencheurs de table, politiques RLS et index observés. La comparaison en lecture seule a relevé les limites suivantes :

- `agents.team` est en texte libre et vaut `cs` pour les quatre agents live; la baseline conserve son défaut observé `cs`, alors que l’enum `case_team` ne contient que `mada_ops` et `sez_ops`.
- Le snapshot public ne recrée pas les schémas gérés (`auth`, `extensions`, `vault`), rôles système, comptes, ni la configuration d’instance. La référence `auth.users` suppose un projet Supabase initialisé.
- Les privilèges de tables live accordent les sept droits (`DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`) à `anon`, `authenticated` et `service_role` sur les tables et la vue publiques. Ce vaste ensemble de droits dépend des valeurs par défaut Supabase et n’est pas reproduit par la baseline. Les politiques RLS limitent les accès applicatifs; vérifier les ACL sur un projet jetable avant toute restauration.
- Les ACL effectives des fonctions applicatives ne sont pas reproduites en totalité. En particulier, `delete_case(bigint)` n’est accordée qu’à `authenticated` et `service_role` dans le live, alors que l’en-tête ACL par défaut visible pour plusieurs fonctions inclut aussi `PUBLIC` et `anon`. La baseline ne reconstitue pas tous ces grants/revokes.
- Le code de la fonction d’événement DDL `rls_auto_enable` est représenté dans le snapshot, mais son rattachement par `CREATE EVENT TRIGGER` est omis : c’est un objet global géré au niveau de l’instance.
- Le snapshot ne recrée pas la publication Realtime; elle contient actuellement zéro table. Les extensions live effectivement installées (`pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault`) sont gérées séparément.
- Les identités, séquences, propriétaires des objets, ACL de la vue, configuration globale de RLS et des rôles n’ont pas été certifiés par une restauration réelle. La base de données signale également zéro migration enregistrée alors que ces objets existent.

La baseline est un instantané de référence et n’a pas été restaurée sur un projet jetable. Ces différences doivent être vérifiées pendant ce test avant de la considérer comme une méthode de recréation complète.

## Historique des migrations

Les migrations déjà appliquées au live sont archivées sous `supabase/history/` uniquement pour audit; **ne jamais les réexécuter**. Toute nouvelle migration timestampée va dans `supabase/migrations/` avec ses instructions de retour arrière.
