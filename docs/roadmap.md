# Feuille de route

## Phase actuelle — Audit et amélioration

Aligner les documents, vérifier la baseline, stabiliser le déploiement continu et améliorer la structure produit sans écriture dans la base live.

## À venir

- Centre de notifications selon [decisions.md](decisions.md), avec délai de rappel Sez Ops choisi à l’escalade.
- Espace d’administration : définir un rôle administrateur; remplacer les listes fixes de catégories et canaux par des tables modifiables; prévoir une extension ultérieure aux agents, équipes et délais de rappel.
- Restaurer et vérifier la baseline sur un projet jetable.
- Vérifier si la base Supabase bénéficie de sauvegardes automatiques.
- Réconcilier la valeur d’équipe `cs` avec le modèle métier, après confirmation.

## Problèmes connus

- Les quatre agents live sont enregistrés dans l’équipe `cs`, alors que l’application n’attend que `mada_ops` ou `sez_ops`; le type TypeScript `CaseTeam` ne permet pas `cs`.
- Supabase rapporte zéro migration enregistrée bien que la base contienne les objets applicatifs. L’ancien script a été rangé dans `supabase/history/` et ne doit jamais être rejoué.
- La publication Realtime n’inclut aucune table actuellement.
- La baseline est un snapshot de référence non restauré; ses écarts résiduels sont détaillés dans [architecture.md](architecture.md).
- Les parcours nécessitant un compte de test n’ont pas été validés dans un navigateur pendant cet audit.
