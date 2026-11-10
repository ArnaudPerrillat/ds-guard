# 0012. Contrat versionné, évalué face à la version du lockfile

- Statut : acceptée
- Date : 2026-11-03
- Référence : D12 dans [la vision produit](../vision.md)

## Décision

Un contrat est extrait par version publiée du DS ; chaque produit est évalué face à la version résolue dans son lockfile.

## Alternative écartée

Évaluer tous les produits face à la dernière version.

## Pourquoi

Sinon, chaque produit en retard est noyé sous les faux positifs.

## Ce qu'on accepte de perdre

Le coût d'extraire et de stocker un contrat par version.
