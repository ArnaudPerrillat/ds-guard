# Résultats du spike — phase 0

Date : 6 novembre 2026. Code : `analyze.ts` (analyse), `sample.ts` (échantillon pour revue manuelle). Relancer : `npm i`, récupérer les fixtures (voir plus bas), puis `npm run analyze`.

## Question

Peut-on détecter de façon fiable l'usage d'un DS et les valeurs codées en dur sur du vrai code React ?

## Ce qui a été testé

- **DS** : Primer React `38.19.0` et `@primer/primitives` `11.3.1`, installés dans `fixtures/ds-install` aux versions **lues dans le lockfile de l'application** (le script refuse de tourner si les versions installées diffèrent).
- **Application** : [github/docs](https://github.com/github/docs) (docs.github.com), clone partiel de `src/` (811 fichiers TS/TSX dont 200 TSX, 93 SCSS/CSS). Choisie parce que c'est une vraie application de production, de grande taille, qui épingle `@primer/react` et mélange modules SCSS, styles en ligne, wrappers maison et un second DS (`@primer/react-brand`).
- **Outils** : TypeScript compiler API (contrat et JSX), postcss-scss (styles). Pas de oxc : une seule dépendance de parsing suffisait pour le spike.

## Chiffres

| Mesure | Résultat |
|---|---|
| Contrat : composants extraits des `.d.ts` (entrée principale) | 67 (le `generated/components.json` de Primer en liste 77, sous-entrées `experimental`/`drafts` comprises) |
| Contrat : tokens extraits (thème clair, tailles, bordures) | 1 887 |
| Fichiers qui importent `@primer/react` | 14 (contre 33 pour `@primer/react-brand`) |
| Usages JSX directs du DS | 56 |
| Wrappers maison détectés / réels (vérifiés à la main) | 2 / 2 (`Picker` → `ActionMenu`, `Fields` → `ActionList`), 0 lien erroné |
| Version du DS lue dans `package-lock.json` | `38.19.0`, correct |
| Constats « valeur codée en dur », v1 | 313 (12 couleurs, 301 espacements) dans 52 fichiers |
| **Revue manuelle v1, 50 constats tirés à intervalle régulier** | **1 faux positif / 50 = 2 %** |
| Faux positifs connus sur la population v1 complète | 11 / 313 = 3,5 % (3 replis dans `var()`, 8 décalages de ±1px) |
| Constats v2 (après correction des deux classes) | 302 (9 couleurs, 293 espacements) |
| Revue manuelle v2, 50 nouveaux constats | 0 faux positif / 50 |
| Durée d'une analyse complète | 3 à 16 s (la construction du programme TypeScript domine) |

Définition retenue d'un faux positif : la valeur signalée n'est pas une valeur littérale que le DS voudrait voir remplacée par un token (valeur de repli d'un token, décalage optique de 1px, commentaire, etc.). Une valeur hors échelle mais réelle (`padding-bottom: 185px`, `padding-left: 41px`) est un **vrai positif** : c'est précisément un candidat à une exception déclarée.

## Qualité des suggestions de token

- **Espacements** : 273 des 293 constats ont un token de valeur exacte (`base-size-N`, puis `stack-gap-*` en alternative) ; les 20 autres reçoivent le token le plus proche, signalé comme approximatif. En v1, les tokens `control-*` étaient proposés pour des marges de mise en page (suggestion juste en valeur, fausse en sens) ; v2 ne les propose plus que pour les sélecteurs de type contrôle. Choisir entre `base-size` et `stack-*` ne se décide pas à partir de la valeur seule.
- **Couleurs** : seulement 2 couleurs sur 9 ont un token exact (par exemple `rgba(129,139,152,0.15)` → `control-transparent-bgColor-active`). 6 sur 9 sont des couleurs d'ombre (`box-shadow`) : Primer expose des tokens d'ombre composites (`--shadow-*`) que le spike ne compare pas.

## Ce qui a échoué ou n'a pas été couvert

1. **Classes utilitaires Primer CSS** (`mt-4`, `d-flex`…) : 127 attributs `className` contiennent des utilitaires d'espacement. Ce sont des usages du DS, mais le spike ne les compte pas. La couverture serait donc fortement sous-estimée sur ce type d'application.
2. **Second DS** : `@primer/react-brand` (33 fichiers) n'est pas dans le contrat. Il faut pouvoir déclarer plusieurs paquets DS.
3. **Sous-entrées** (`@primer/react/experimental`) : `DataTable` et `Table.*` sont vus comme « hors contrat ». Il faut lire toutes les entrées `exports` du paquet.
4. **Contrat** : il faut les dépendances du DS installées. Sur le seul tarball, les types non résolus deviennent `any` (32 composants au lieu de 67). En pratique, le produit lira le `node_modules` de l'application, ce qui va dans le sens de « version résolue dans le lockfile ».
5. **Wrappers** : seule la définition « composant dont la racine rendue est un composant du DS » est gérée (y compris à travers `forwardRef`/`memo` après correction). Les compositions (DS rendu dans un `<div>`) ne sont pas des wrappers et sont ignorées ; à confirmer sur une application qui en a davantage (2 cas seulement ici).
6. **Non testé sur cette application** : `sx`/styled-components (aucun `sx`, 5 constats dans des `style={{}}`), Tailwind et CSS-in-JS par templates. Le lockfile pnpm a un lecteur rudimentaire, non testé.
7. **Rappel (oublis) non mesuré** : la revue porte sur la précision uniquement.

## Verdict

**GO** au regard de la porte de sortie : 2 % de faux positifs à l'aveugle (v1), 0 % après correction, et 3,5 % sur la population complète avant correction, tous sous le seuil de 10 %. La détection de valeurs codées en dur dans CSS/SCSS et dans les objets `style` est fiable.

Garder pour la phase 1, avec ces réserves :

- ignorer les valeurs de repli dans `var()` et les ±1px dès la première règle ;
- regrouper les constats (97 % sont des espacements, 302 constats pour 52 fichiers : le volume brut serait du bruit en commentaire de PR) ;
- traiter les classes utilitaires et le multi-paquets avant d'afficher un chiffre de couverture ;
- valider `sx`, styled-components et Tailwind sur une deuxième application avant d'annoncer ces surfaces.

## Fixtures (non versionnées)

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/github/docs fixtures/docs-app
# dans fixtures/docs-app, avec MSYS_NO_PATHCONV=1 sous Git Bash :
git sparse-checkout set --no-cone '/src/**/*.tsx' '/src/**/*.ts' '/src/**/*.scss' '/src/**/*.css' '/package.json' '/package-lock.json'
# dans fixtures/ds-install :
npm i --ignore-scripts @primer/react@38.19.0 @primer/primitives@11.3.1 react@19 react-dom@19 @types/react@19 @types/react-dom@19
```
