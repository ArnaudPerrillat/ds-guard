# DS Guard — contexte du projet

DS Guard (nom de travail) est la couche de conformité d'un design system : il vérifie chaque PR, chaque génération d'agent et, plus tard, chaque maquette face au contrat du DS et à l'accessibilité, distingue une dérive accidentelle d'une exception assumée, et mesure l'adoption dans le temps.

## Où trouver quoi

- `docs/vision.md` — vision produit complète : problème, utilisateurs, cas d'usage, concepts, scope, architecture, décisions, risques.
- `docs/etude-marche.md` — étude de marché documentaire (novembre 2026) : signaux, besoins, concurrence, contraintes, pièges, opportunités.
- `docs/plan-action.md` — phases 0 à 5 avec leurs portes de sortie. **Lire en premier pour savoir où on en est.**
- `docs/adr/` — une fiche par décision structurante (D1 à D15). Une décision qui change = la fiche est mise à jour, pas supprimée.
- `docs/regles.md`, `docs/mesures.md`, `docs/plan-demo.md` — référence des règles et exceptions, définition versionnée des mesures, plan du dépôt de démo.
- `packages/` — produit (phase 1) : `core` (moteur isomorphe), `contract`, `cli`, `eslint-plugin`, `github-action` (bundle commité dans `action/`). `fixtures/vitals-app` : application et DS fictifs pour les tests.
- `spike/` — code jetable de la phase 0. Rien de ce dossier ne doit être réutilisé tel quel dans le produit.

## La thèse en cinq points

1. Les agents multiplient la production d'interface ; le DS devient une politique à faire appliquer, pas une bibliothèque à consulter.
2. Le marché outille le contexte en amont (Figma MCP, Storybook MCP) ; personne ne vérifie en aval sur toutes les surfaces.
3. Premier argument : les **exceptions intentionnelles** (un écart déclaré, avec responsable et expiration), que ni Figma *Check designs* ni les linters ne savent gérer.
4. Le frein principal à l'adoption est le manque de mandat : le produit sert aussi la direction (rapport d'une page), pas seulement l'équipe DS.
5. La mesure brute de couverture est banalisée : la valeur est dans une mesure fiable (couverture expliquée, définition versionnée) reliée à des décisions.

## Périmètre du MVP

React + TypeScript uniquement. CLI locale hors ligne, GitHub Action non bloquante par défaut, contrat déduit du package DS pour chaque version publiée, règles générées et exportées en plugin ESLint, registre d'exceptions (`ds-exceptions.yml` + annotations `// ds-exception: ID`), couverture expliquée et conformité, rapport de versions, rapport direction d'une page.

**Hors MVP** : Vue/Angular/Svelte, GitLab, tableau de bord SaaS, plugin Figma, serveur MCP, mesure au rendu, aperçu de mise à jour. Ne pas les ajouter sans mettre à jour `docs/plan-action.md` et l'ADR concernée.

## Principes non négociables

- **Local d'abord** : le code analysé ne quitte jamais la machine ou la CI du client ; seules des métriques agrégées sortent, et seulement sur choix explicite.
- **Un moteur, trois surfaces** : `core` est isomorphe — aucune dépendance au système de fichiers ni au réseau — pour tourner à l'identique dans la CLI, la CI, un serveur MCP et un plugin Figma.
- **Peu de règles, à forte confiance** : un faux positif coûte plus cher qu'un oubli. Chaque règle a un identifiant stable, une sévérité, et propose un correctif quand c'est possible.
- **Non bloquant par défaut**, sauf accessibilité ; le blocage se décide par équipe.
- **Le contrat est évalué face à la version du DS résolue dans le lockfile**, jamais face à la dernière.

## Stack prévue

TypeScript, Node 22+, pnpm + Turborepo. Parsing : TypeScript compiler API (`ts.createSourceFile`, voir ADR 0016). Types du DS : TypeScript compiler API, react-docgen-typescript. Styles : PostCSS, templates CSS-in-JS, valeurs arbitraires Tailwind. Tokens : format pivot DTCG. Corpus de test : DS open source (Primer, Carbon, Polaris, React Spectrum) et des applications qui les utilisent. Détails et raisons : `docs/vision.md`, section « Architecture et stack technique ».

## Conventions

- Documentation produit en français ; code, identifiants, messages de commit et commentaires de code en anglais.
- Toute décision structurante passe par une fiche dans `docs/adr/` (format : contexte, décision, alternatives, conséquences).
- Le dépôt est destiné à être public : pas de tutoiement, de notes personnelles, de chemins locaux ni d'entreprises réelles citées comme cibles ou sources privées dans `docs/` ; seules des sources publiques sont citées.
