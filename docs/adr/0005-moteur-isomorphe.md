# 0005. Un moteur isomorphe et un arbre d'interface commun

- Statut : acceptée
- Date : 2026-11-03
- Référence : D5 dans [la vision produit](../vision.md)

## Décision

Chaque surface est traduite en un arbre d'interface normalisé, analysé par un seul moteur de règles sans dépendance au système de fichiers ni au réseau.

## Alternative écartée

Un outil distinct par surface.

## Pourquoi

Les mêmes règles partout, sans dérive entre surfaces ; le même code tourne dans la CLI, la CI, un serveur MCP et un plugin Figma.

## Ce qu'on accepte de perdre

Plus de travail d'abstraction au début ; l'arbre ne couvrira pas toutes les finesses de chaque surface.
