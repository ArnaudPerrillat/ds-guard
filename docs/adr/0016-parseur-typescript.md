# 0016. Parseur : TypeScript compiler API plutôt qu'oxc

- Statut : acceptée
- Date : 2026-11-09
- Référence : remplace le choix « oxc-parser (build WASM) » de la section « Architecture et stack technique » de [la vision produit](../vision.md)

## Contexte

La vision prévoyait oxc-parser pour le JSX et la TypeScript compiler API pour les types du DS. Le spike de phase 0 a tout fait avec la seule TypeScript compiler API (contrat et JSX) et a obtenu 0 % de faux positifs après correction ; l'analyse complète de github/docs prend 3 à 16 s, dominée par la construction du programme TypeScript côté contrat, pas par le parsing.

## Décision

`core` parse le TSX avec `ts.createSourceFile` (aucun accès au système de fichiers, donc isomorphe) et les styles avec PostCSS. Le type checker n'est utilisé que dans `@ds-guard/contract` (Node), qui produit un contrat JSON consommé par `core`.

## Alternatives écartées

- oxc-parser (WASM) dans `core` : plus rapide et plus léger, mais une deuxième dépendance de parsing à maintenir alors que le type checker reste nécessaire pour le contrat, et un AST différent entre contrat et règles.

## Conséquences

- Une seule dépendance de parsing, un seul AST, le code du spike sert de référence.
- `typescript` pèse environ 3 Mo minifié : gênant pour un plugin Figma ou une exécution dans le navigateur. À réévaluer en phase 4 si le plugin Figma se fait ; l'interface `toDocuments()` isole le parseur pour pouvoir le remplacer.
