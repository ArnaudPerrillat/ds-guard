# 0017. Pilotage des exceptions dans Git, sans interface hébergée

- Statut : acceptée
- Date : 2026-11-10
- Référence : complète [D3](0003-exceptions-des-le-mvp.md) et [D4](0004-local-first-open-source.md)

## Contexte

Les exceptions vivent dans le `ds-exceptions.yml` de chaque dépôt : on peut les déclarer et elles expirent, mais rien n'aide à les piloter. On ne voit pas lesquelles expirent bientôt, qui doit agir, ni quelles exceptions se ressemblent d'une équipe à l'autre (signe qu'un composant ou un token manque au DS). Il n'y a pas non plus de circuit d'approbation.

## Décision

Git reste la source de vérité, et le pilotage passe par les outils que les équipes ont déjà :

- **Approbation** : toute création, prolongation ou clôture est une PR sur `ds-exceptions.yml`. L'équipe DS est propriétaire du fichier dans `CODEOWNERS`, avec la revue des propriétaires de code obligatoire sur la branche principale.
- **Édition** : `ds-guard exceptions add | renew | close` modifie le fichier proprement (commentaires et ordre conservés), pour ne pas éditer le YAML à la main.
- **Suivi** : `ds-guard exceptions` liste les exceptions par échéance (échues, à échéance sous N jours), avec responsable, constats couverts et groupes d'exceptions similaires par règle. La même vue figure dans le rapport HTML ; le rapport direction en donne une ligne.
- **Relance** : un workflow hebdomadaire (modèle fourni, non bloquant) ouvre ou met à jour une issue « exceptions à revoir » 14 jours avant l'échéance et l'assigne aux responsables.

La logique (statuts, groupes, édition du YAML, contenu de l'issue) est dans `core`, isomorphe ; les lectures et écritures de fichiers sont dans la CLI.

## Alternatives écartées

- Une interface hébergée (tableau de bord multi-dépôts, approbation en un clic) : contraire au « local d'abord » à ce stade, et coûteuse à maintenir. Reportée en v4, après des signaux d'usage réels.
- Un statut « approuvée » dans le fichier : redondant avec la revue de PR, et falsifiable sans elle.

## Conséquences

- Pas de vue consolidée entre dépôts dans le MVP : chaque dépôt a la sienne. Les groupes d'exceptions similaires ne se voient qu'à l'intérieur d'un dépôt (un monorepo en profite pleinement).
- L'approbation dépend de la configuration GitHub du client (`CODEOWNERS` et protection de branche) : on la documente, on ne la vérifie pas.
- Clore une exception la retire du fichier ; l'historique Git garde la trace.
- GitHub n'assigne que des utilisateurs : un responsable de la forme `@org/equipe` est mentionné dans l'issue, pas assigné.
