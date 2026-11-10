# 0013. Analyse statique pour la couverture ; mesure au rendu reportée

- Statut : acceptée
- Date : 2026-11-03
- Référence : D13 dans [la vision produit](../vision.md)

## Décision

La couverture est calculée statiquement ; la mesure dans le DOM est une option tardive.

## Alternative écartée

Marquer le DOM au build et compter au rendu, comme Mews.

## Pourquoi

Le rendu est facile à imiter, dépend de la taille du DOM et du trafic, et demande d'instrumenter la production.

## Ce qu'on accepte de perdre

Les états dynamiques (modales, menus) moins bien vus.
