# Décisions

## 2026-09-29 — Retrait de Google AI Studio

Google AI Studio est retiré du projet. Le déploiement suit GitHub `main` vers Cloudflare Pages.

## 2026-09-29 — Suppression définitive par tombstone

La suppression visible masque les dossiers au moyen de `permanently_deleted_at`; dossiers et journal restent conservés dans la base. La restauration d’une tombstone est interdite.

## 2026-09-29 — Centre de notifications — accepté, pas encore implémenté

Les déclencheurs de base écriront des lignes dans une table de notifications; l’application écoutera Supabase Realtime, sans interrogation périodique. Le son sera généré dans le navigateur, sans fichier audio, et réservé aux événements essentiels.

Routage accepté : escalade vers les agents de l’équipe cible sauf l’auteur; dossier résolu par une personne autre que le propriétaire vers le propriétaire; note rédigée par une autre personne vers le propriétaire sous forme de badge silencieux. Lors d’une escalade vers Sez Ops, l’agent choisit le délai de rappel du propriétaire : 24, 48 ou 72 heures, avec 48 heures comme défaut proposé. Ce choix nécessite un nouveau champ sur le dossier; il n’est pas implémenté.

Solutions écartées : interrogation périodique, routage dans le navigateur, notifications Web push (à réexaminer plus tard si nécessaire).
