# 0003. Exceptions dès le MVP

- Statut : acceptée
- Date : 2026-11-03
- Référence : D3 dans [la vision produit](../vision.md)

## Décision

Le registre d'exceptions (`ds-exceptions.yml`, annotations `// ds-exception: ID`) fait partie du MVP et devient le premier argument du produit.

## Alternative écartée

Un lint pur, plus simple.

## Pourquoi

Sans exception, le bot met le dev en porte-à-faux entre maquette validée et règles du DS, et finit désactivé. L'étude de marché montre que c'est la première critique adressée à Figma Check designs.

## Ce qu'on accepte de perdre

Un peu de complexité et des concepts à expliquer dès le départ.
