# Règles et exceptions

Référence des règles du MVP (ADR 0008 : peu de règles, à forte confiance). Les identifiants sont stables : on n'en renomme jamais un, on le remplace.

Une règle ne se déclenche que si le contrat lui donne une référence : sans échelle d'espacement dans les tokens, `no-hardcoded-spacing` reste muette.

## Règles

| Identifiant | Sévérité | Ce qui est signalé | Correctif |
| --- | --- | --- | --- |
| `no-hardcoded-color` | warning | Couleur littérale (`#hex`, `rgb()`, nom) dans une propriété de couleur, en CSS/SCSS ou dans `style={{}}`/`sx` | Token de même valeur, nommé selon la propriété (`fg` pour `color`, `bg` pour `background`…) |
| `no-hardcoded-spacing` | warning | `margin`, `padding`, `gap` en px/rem | Token exact, sinon token le plus proche (indicatif) |
| `no-hardcoded-radius` | warning | `border-radius` en px/rem | Token exact ou le plus proche |
| `no-hardcoded-font-size` | warning | `font-size` en px/rem | Token exact ou le plus proche |
| `no-off-theme-utility` | warning | Classe Tailwind de l'échelle par défaut (`bg-blue-500`, `rounded-lg`, `text-sm`) alors que le `@theme` v4 du DS (ou de l'application) a réinitialisé cet espace de noms (`--color-*: initial`) : elle ne produit aucun style | Classes du thème |
| `no-unknown-token` | warning | `var(--x)` qui ressemble à un token du DS (même préfixe) mais n'existe pas dans la version installée | — |
| `no-deprecated-token` | warning | Token marqué `$deprecated` | Message de dépréciation |
| `no-deprecated-component` | warning | Composant `@deprecated` | Message de dépréciation |
| `no-deprecated-prop` | warning | Prop `@deprecated` | Message de dépréciation |
| `no-invalid-prop-value` | warning | Valeur littérale hors de l'union de chaînes acceptée par la prop | Valeur corrigée si seule la casse diffère |
| `no-deep-import` | warning | Import d'un chemin interne du DS au lieu d'une entrée publique (`exports`) | Entrées publiques |
| `prefer-ds-component` | info | `<button>`, `<a>`, `<input>`, `<h1>`… quand le DS fournit l'équivalent | Composant du DS |
| `a11y-accessible-name` | **error** | `<button>` ou `<a href>` sans nom accessible | Texte visible ou `aria-label` |
| `a11y-img-alt` | **error** | `<img>` sans `alt` | `alt=""` si décorative |
| `a11y-no-positive-tabindex` | **error** | `tabIndex` > 0 | `tabIndex={0}` |
| `exception-expired` | warning | Exception échue : les constats qu'elle couvrait comptent de nouveau | Renouveler ou corriger |
| `exception-unknown` | warning | Annotation vers un identifiant absent du registre | — |
| `exception-invalid` | warning | Entrée du registre incomplète ou mal formée | — |
| `exception-unused` | info | Annotation qui ne couvre plus aucun constat | Supprimer l'annotation |

Seules les règles d'accessibilité sont bloquantes par défaut (ADR 0010) ; chaque équipe peut changer la sévérité ou désactiver une règle (`"off"`) dans `ds-guard.config.json`.

Tailwind (ADR 0018) : les classes lues dans `className`, `cn`/`clsx`/`classnames`/`cx`/`twMerge`, `cva`/`tv` et `@apply` passent par les mêmes règles. `bg-[#5b6472]` est signalé par `no-hardcoded-color`, et le correctif propose la classe du thème (`bg-brand`, `p-3`, `rounded-card`). Les chaînes calculées (`` `bg-${tone}-500` ``) et les valeurs arbitraires ambiguës (`bg-[url(…)]`, `border-[3px]`) sont ignorées.

Garde-fous issus de la phase 0 : les valeurs de repli dans `var()` et les décalages de ±1px ne sont jamais signalés ; les variables (`$x`, `--x`), `calc()`, `inherit`, `auto`… non plus. Les props ne sont vérifiées que sur un usage direct du composant, pas à travers un wrapper maison (ses props sont les siennes).

Limites connues : pas encore de styled-components ni de templates CSS-in-JS ; Tailwind v3 n'est couvert que pour les valeurs arbitraires (le `tailwind.config.js` n'est pas lu) ; les ombres composites (`box-shadow`) ne sont pas comparées.

## Exceptions intentionnelles

Une exception est un écart **déclaré**, avec un responsable et une date d'expiration (ADR 0003). Elle vit dans `ds-exceptions.yml`, à la racine du projet :

```yaml
exceptions:
  - id: EXC-012
    rules: [no-hardcoded-spacing]
    reason: Le bandeau d'accueil utilise un espacement hors échelle validé en revue design.
    owner: "@equipe-parcours-patient"
    expires: 2027-03-31
    link: https://exemple.test/decision/42   # facultatif
  - id: EXC-013
    rules: [no-hardcoded-color, no-hardcoded-spacing]
    reason: Module de facturation hérité, réécrit au T2.
    owner: "@equipe-facturation"
    expires: 2027-06-30
    files: ["src/legacy/billing/**"]          # facultatif : couvre ces fichiers sans annotation
```

Dans le code, une annotation couvre sa ligne et la suivante, et seulement pour les règles déclarées :

```tsx
{/* ds-exception: EXC-012 */}
<section style={{ paddingTop: 185 }}>
```

```scss
.hero {
  /* ds-exception: EXC-012 */
  padding-bottom: 185px;
}
```

Champs obligatoires : `id`, `rules`, `reason`, `owner`, `expires` (AAAA-MM-JJ, inclus). Une exception échue cesse de couvrir : les constats redeviennent des écarts et `exception-expired` le signale. Une exception couverte n'apparaît pas comme un écart, mais compte dans la couverture expliquée et dans le rapport.

## Piloter les exceptions (ADR 0017)

Git est la source de vérité : toute exception créée, prolongée ou close passe par une PR sur `ds-exceptions.yml`.

**Approbation par `CODEOWNERS`.** L'équipe DS est propriétaire du registre et de la configuration ; activer « Require review from Code Owners » dans la protection de la branche principale :

```
# .github/CODEOWNERS
**/ds-exceptions.yml      @acme/design-system
**/ds-guard.config.json   @acme/design-system
```

**Commandes.** Elles modifient le fichier en place (commentaires et ordre conservés) ; reste à committer dans une PR.

| Commande | Effet |
| --- | --- |
| `ds-guard exceptions [--within 30]` | Liste par échéance : échues, à échéance sous N jours, actives ; responsable, constats couverts ; groupes d'exceptions similaires. `--format json` ou `issue` pour l'automatisation. |
| `ds-guard exceptions add --rule <id> --reason … --owner @… --until AAAA-MM-JJ [--files <glob>] [--id …] [--link …]` | Ajoute une entrée (identifiant suivant proposé, règles vérifiées). |
| `ds-guard exceptions renew <id> --until AAAA-MM-JJ` | Prolonge ; la PR dit pourquoi l'écart reste nécessaire. |
| `ds-guard exceptions close <id>` | Retire l'entrée (l'historique Git la garde) et liste les annotations restantes à supprimer. |

**Exceptions similaires.** Plusieurs exceptions sur une même règle, surtout portées par des équipes différentes, signalent souvent un composant ou un token qui manque au DS. Elles sont regroupées dans la commande, le rapport HTML et l'issue de relance.

**Relance hebdomadaire.** Le modèle [`templates/ds-guard-exceptions.yml`](../templates/ds-guard-exceptions.yml), à copier dans `.github/workflows/`, tourne chaque lundi : il ouvre ou met à jour une seule issue « DS Guard: exceptions to review » avec les exceptions échues ou à échéance sous 14 jours, l'assigne aux responsables (les équipes `@org/equipe` sont mentionnées, GitHub n'assignant que des personnes) et la ferme quand plus rien n'est dû. Il n'échoue jamais. Permissions : `contents: read`, `issues: write`.

## Plugin ESLint

Les mêmes règles, fichier par fichier (sans le suivi des wrappers entre fichiers) :

```js
// eslint.config.js
import dsGuard from '@ds-guard/eslint-plugin'
export default [{ files: ['**/*.{tsx,jsx}'], ...dsGuard.configs.recommended }]
```

Le plugin lit `.ds-guard/contract.json`, écrit par `npx ds-guard contract` (à relancer après chaque mise à jour du DS), et `ds-exceptions.yml`.
