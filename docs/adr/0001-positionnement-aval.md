# 0001. Se positionner sur la vérification en aval

- Statut : acceptée
- Date : 2026-11-03
- Référence : D1 dans [la vision produit](../vision.md)

## Décision

DS Guard vérifie ce qui sort (PR, générations d'agents, maquettes) au lieu de fournir le contexte du DS aux agents.

## Alternative écartée

Fournir le contexte DS aux agents (serveur de contexte, documentation pour LLM).

## Pourquoi

Figma, Storybook, Supernova et Knapsack occupent déjà l'amont ; la vérification en aval, sur toutes les surfaces, n'est couverte par personne.

## Ce qu'on accepte de perdre

La visibilité d'un produit « IA » tendance.
