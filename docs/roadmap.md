# Feuille de route

## Phase actuelle — Audit et amélioration

Aligner la documentation et le dépôt sur le fonctionnement observé. La baseline doit permettre de recréer le schéma live sans données.

## À venir

- Centre de notifications : règles acceptées dans [decisions.md](decisions.md), conception en attente d’une confirmation pour le rappel Sez Ops.
- Réconcilier l’équipe `cs` constatée sur les quatre agents live avec les deux équipes métier prévues au produit.
- Rétablir la synchronisation formelle des migrations à partir de la baseline, après comparaison prudente avec le schéma live.

## Problèmes connus

- Supabase rapporte zéro migration enregistrée alors que la base contient les tables et objets applicatifs et le dépôt une migration de tombstone.
- La valeur d’équipe `cs` en production n’est pas représentée dans les types du code.
- La publication Realtime n’inclut aucune table actuellement.
- Les parcours nécessitant un compte de test n’ont pas été validés dans un navigateur pendant cet audit.
