# 0018. Tailwind dans le MVP : valeurs arbitraires, thème v4 lu statiquement

- Statut : acceptée
- Date : 2026-11-10
- Référence : complète [D7](0007-analyse-statique.md), [D8](0008-peu-de-regles.md) et [D11](0011-couverture-expliquee.md)

## Contexte

Tailwind est devenu un mode d'écriture courant des interfaces React, et il est encore plus fréquent dans le code produit par les agents. Avant ce changement, DS Guard ne lisait pas les classes : une application Tailwind obtenait une couverture sous-estimée, et ses valeurs codées en dur (`bg-[#5b6472]`, `p-[13px]`) passaient sans être vues. L'étude de marché montre que les sites en Tailwind v4 ont une couverture de tokens bien plus élevée que les versions précédentes. En v4, le thème est déclaré en CSS (`@theme`), donc on peut le lire sans exécuter de code. En v3, il vit dans un `tailwind.config.js`, qu'il faudrait exécuter.

## Décision

1. **Les classes sont traduites en déclarations de style** dans `core`, qui reste isomorphe. On lit les chaînes littérales de `className`/`class`, celles passées aux fonctions de composition de classes (`cn`, `clsx`, `classnames`, `cx`, `twMerge`, `twJoin`), la base, les variantes et `compoundVariants[].class` de `cva` et `tv`, et `@apply` en CSS. `bg-[#5b6472]` devient `background-color: #5b6472` : les règles `no-hardcoded-*` existantes s'appliquent telles quelles, avec les **mêmes identifiants**. Le correctif proposé est la classe du thème (`bg-brand`, `p-3`, `rounded-card`). Si le token est hors de l'espace de noms Tailwind, on propose `bg-[var(--token)]`, valable en v3 comme en v4.
2. **Une seule règle nouvelle, `no-off-theme-utility`**, et seulement pour Tailwind v4. Le contrat lit statiquement les blocs `@theme` du paquet du DS : variables définies et espaces de noms réinitialisés (`--color-*: initial`, `--*: initial`). Une classe de l'échelle par défaut de Tailwind (`bg-blue-500`, `text-white`, `rounded-lg`, `text-sm`, `p-4` sans `--spacing`) est signalée seulement si le DS, ou l'application dans son propre `@theme`, a réinitialisé cet espace de noms et ne la redéfinit pas. Dans ce cas, la classe ne produit aucun style. Sans réinitialisation, la règle reste muette.
3. **Un DS Tailwind v4 qui ne fournit que du CSS** a ses fichiers `@theme` découverts comme fichiers de tokens. `--text-*` y devient une taille de police, et la base `--spacing` donne une échelle : `p-[12px]` correspond à `p-3`, et `p-[13px]` renvoie à la valeur la plus proche (pas entier ou demi-pas).
4. **Les classes du thème qui pointent vers un token du DS comptent comme usages du DS** dans les mesures, et les dépréciations de tokens s'y appliquent. Définition des mesures 1.1.
5. **Les chaînes calculées sont ignorées.** Un mot accolé à une interpolation ou à une concaténation (`` `bg-${tone}-500` ``, `'p-' + n`) n'est pas lu. Une variable qui contient des classes non plus. Une valeur arbitraire qu'on ne sait pas classer avec certitude (`bg-[url(…)]`, `border-[3px]`, `calc()`) ne produit rien.

**Tailwind v3 (`tailwind.config.js`) est hors périmètre** : il faudrait exécuter du JavaScript, ce qui contredit l'analyse statique et le local d'abord. Les valeurs arbitraires sont vérifiées quelle que soit la version, puisque leur syntaxe est la même. Seule la règle `no-off-theme-utility` n'existe pas pour v3. À rouvrir si les retours de la phase 3 le demandent, par exemple avec un export JSON du thème généré par l'utilisateur.

## Alternatives écartées

- **Exécuter Tailwind** (ou sa config) pour obtenir le CSS généré : exact, mais cela exige Node et les dépendances du projet, et rend le moteur non isomorphe.
- **Des règles `tailwind-*` séparées** : cela doublerait les identifiants pour la même dette. Un rayon codé en dur reste un rayon codé en dur, en CSS ou en classe.
- **Signaler toute classe de palette par défaut** même sans réinitialisation : cela produirait des faux positifs sur chaque DS qui étend la palette au lieu de la remplacer.

## Conséquences

- Contrôle sur shadcn/ui (`apps/v4`, 344 fichiers TSX, 11 605 classes lues, 0 erreur d'analyse, le 10 novembre 2026). La règle `no-unknown-token` produisait de faux positifs sur des variables posées à l'exécution via `style={{ '--x': v } as CSSProperties}`. Ils sont corrigés : les conversions `as` et `satisfies` sont déballées, et `[--x:…]` définit `--x`. En simulant une réinitialisation de la palette, `no-off-theme-utility` a signalé 110 classes, toutes de la palette par défaut, et aucune classe hors palette (`bg-cover`, `text-center`…).
- Dans le plugin ESLint, qui analyse fichier par fichier, une couleur ajoutée par l'application dans le `@theme` d'un autre fichier n'est pas connue. En revanche, une réinitialisation déclarée seulement dans le CSS de l'application n'y est pas vue non plus, et la règle reste muette. Le risque est donc l'oubli, pas le faux positif.
- Limites : pas d'ombres ni de largeurs de bordure. Les variantes personnalisées (`@custom-variant`) et le préfixe Tailwind (`tw:`) ne sont pas interprétés. Une variable locale qui relaie un token du DS (`--color-primary: var(--ds-primary)`) n'est pas suivie jusqu'au token pour la couverture.
- `EXTRACTOR_VERSION` passe à 3 : les contrats en cache sont reconstruits.
