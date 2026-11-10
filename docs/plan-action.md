# Plan d'action

Établi le 6 novembre 2026. Horizon : avril 2027. Hypothèse : travail à temps partiel. Chaque phase a une **porte de sortie** : un critère fixé à l'avance qui décide si on continue, si on réduit le périmètre ou si on s'arrête.

Statut : **phase 0 terminée** (verdict GO, voir `spike/RESULTS.md`) ; **phase 1 en cours**.

## Phase 0 — Faisabilité (9 → 22 novembre 2026)

Lever le plus gros risque technique avant d'écrire le produit : la fiabilité de la détection sur du vrai code.

- [x] Choisir un DS open source (Primer par défaut) et une application open source qui l'utilise.
- [x] Script jetable dans `spike/` : extraire composants, props et tokens du package.
- [x] Lister les usages du DS dans l'application.
- [x] Détecter les couleurs et espacements codés en dur, et proposer le token correspondant.
- [x] Suivre les wrappers maison jusqu'au composant du DS.
- [x] Lire la version du DS dans le lockfile.
- [x] Vérifier 50 constats à la main et compter les faux positifs.

**Porte de sortie** : moins de 10 % de faux positifs sur les valeurs codées en dur. Sinon, réduire le périmètre des règles avant la phase 1.

## Phase 1 — MVP (23 novembre 2026 → début janvier 2027)

Uniquement les trois pistes prioritaires (exceptions, relecteur indépendant, règles générées) et le strict nécessaire.

- [x] Monorepo (pnpm + Turborepo), paquet `core` isomorphe.
- [x] Contrat déduit du package, une version à la fois.
- [x] Une dizaine de règles, exportées aussi en plugin ESLint (15 règles + 4 règles du registre, voir `docs/regles.md`).
- [x] Registre d'exceptions (`ds-exceptions.yml` et annotations).
- [x] Tailwind (ADR 0018) : valeurs arbitraires dans `className`, `cn`/`clsx`/`classnames`, `cva`/`tv` et `@apply`, avec les mêmes règles `no-hardcoded-*` et un correctif en classe du thème ; thème v4 lu statiquement dans `@theme` et nouvelle règle `no-off-theme-utility` ; fixture `fixtures/pulse-app`. Tailwind v3 (`tailwind.config.js`) reporté.
- [x] Pilotage des exceptions dans Git (ADR 0017) : `ds-guard exceptions` (échéances, responsables, constats couverts, exceptions similaires par règle) et `add | renew | close` ; section dans le rapport HTML, une ligne dans le rapport direction ; modèle de workflow hebdomadaire qui ouvre une issue « exceptions à revoir » ; approbation par PR avec l'équipe DS dans `CODEOWNERS`. Le tableau de bord multi-dépôts reste en v4.
- [x] GitHub Action qui commente les PR, non bloquante (`action.yml` ; bloque seulement sur l'accessibilité des lignes modifiées, désactivable).
- [x] Rapport local : couverture expliquée, conformité, versions, page pour la direction (CLI `ds-guard scan|report`, définition dans `docs/mesures.md`).
- [x] Dépôt de démo : portail patient fictif « Orvella » et son DS (`@orvella/ui`, `@orvella/tokens` 1.4 et 2.0), six branches de PR scénarisées vérifiées en local avec la CLI empaquetée (dépôt `ds-guard-demo`, voir `docs/plan-demo.md`). Reste : créer le dépôt GitHub et pousser (avec ce dépôt, pour que l'Action soit résolvable), puis ouvrir les PR.

**Porte de sortie** : une personne extérieure installe l'outil seule en moins de 15 minutes.

Où on en est (9 novembre 2026) : depuis l'archive `npm pack`, `init` puis `scan` prennent 13 s sur la fixture (installation comprise). Pas encore testé par une personne extérieure ni sur sa propre application ; dépend aussi de la publication npm (phase 2).

## Phase 2 — Publication et signaux d'usage (janvier 2027)

Les signaux d'usage réels remplacent les entretiens.

- [x] Relire `docs/` et retirer les formulations personnelles et les références à des entreprises réelles prises comme cibles avant de rendre le dépôt public.
- [ ] Historique Git public sans ces mentions (choix de méthode en attente).
- [x] Paquet CLI prêt pour npm (métadonnées, licence, `files`) et workflow de release ; section « Privacy » dans le README et test qui vérifie qu'un scan ne fait aucun accès réseau.
- [ ] Vérifier les noms, créer les dépôts GitHub, pousser, ouvrir les six PR de démo, publier sur npm (après accord et périmètre final).
- [ ] Publier en open source, avec une vidéo de 3 minutes.
- [ ] Article 1 : version publique de l'étude de marché.
- [ ] Article 2 : les exceptions intentionnelles, chaînon manquant de la gouvernance des DS.
- [ ] Diffuser (LinkedIn, communautés DS) sans sollicitation individuelle.

**Signaux suivis** : issues ouvertes par de vrais utilisateurs, installations effectives, demandes de règles, messages entrants. Les étoiles GitHub comptent peu.

## Phase 3 — Premiers retours qualifiés (fin janvier → début février 2027)

- [ ] Partager l'article et la démo avec quelques contacts DS choisis, en proposant de lancer la CLI en local, sans aucun détail interne demandé.

## Phase 4 — Itération (février → mars 2027)

- [ ] Prioriser ce que demandent les utilisateurs réels.
- [ ] À défaut : plugin Figma limité aux exceptions et au lien avec le code, puis serveur MCP `validate` si les retours parlent des agents.

## Phase 5 — Bilan (avril 2027)

- [ ] Décider : produit, projet open source sans offre payante, ou arrêt.
- [ ] Mettre à jour la vision et les ADR avec ce qui a été appris.

## Ce qu'on ne fait pas avant la phase 2

Pas de SaaS, pas de tableau de bord hébergé (y compris pour les exceptions, ADR 0017), pas de nom définitif ni de landing page, pas de plugin Figma.
