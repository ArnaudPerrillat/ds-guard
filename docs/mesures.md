# Définition des mesures — version 1.1

Les deux pourcentages publiés (ADR 0011) et la façon dont ils sont comptés. Toute modification du comptage change la version (`METRICS_DEFINITION` dans `packages/core/src/metrics.ts`) et s'ajoute en bas de ce fichier : une évolution d'un chiffre doit pouvoir s'expliquer par le code, pas par un changement de définition.

## Ce qui est compté

Deux familles d'unités d'interface :

- **Composants** : chaque élément JSX qui vient du DS (directement, ou à travers un wrapper maison dont la racine rendue est un composant du DS) compte comme « DS ». Chaque élément natif pour lequel le DS fournit un équivalent (`<button>` → `Button`, `<a>` → `Link`, `<input>`, `<select>`, `<textarea>`, `<h1>`…`<h6>`, `<table>`, `<dialog>`) compte comme « maison ». Les autres éléments (`<div>`, `<span>`, composants locaux) ne comptent pas : ce sont des compositions.
- **Valeurs de style** : dans les propriétés de couleur, d'espacement, de rayon et de taille de police (CSS, SCSS, `style={{}}`, `sx`, classes Tailwind), chaque référence à un token du DS compte comme « DS », chaque valeur littérale signalée par une règle `no-hardcoded-*` compte comme « maison ». Les valeurs neutres (`0`, `inherit`, `auto`, ±1px, variables locales) ne comptent pas.

Une unité « maison » couverte par une exception active compte comme **exceptée**.

## Les deux chiffres

- **Couverture expliquée** = (DS + excepté) / (DS + excepté + non expliqué). La couverture brute (DS seul) est donnée à côté. 100 % n'est pas l'objectif : seul l'écart non expliqué est une dette.
- **Conformité** = part des usages du DS sans écart au contrat de la version installée : ni composant, prop ou token déprécié, ni valeur de prop invalide, ni token inexistant. Comptée une fois par ligne.

Les deux sont calculés face à la version du DS **résolue dans le lockfile** (ADR 0012).

Classes Tailwind (ADR 0018) : une classe du thème qui pointe vers un token du DS (`bg-brand`, `p-4` avec la base `--spacing` du DS) compte comme « DS ». Une valeur arbitraire signalée (`p-[13px]`) ou une classe hors thème signalée par `no-off-theme-utility` compte comme « maison ». Les autres classes ne comptent pas.

## Ce qui n'est pas compté (version 1.1)

Classes utilitaires maison (hors Tailwind), Tailwind v3 au-delà des valeurs arbitraires, styled-components et templates CSS-in-JS, ombres composites. Sur une application qui repose sur des classes utilitaires, la couverture est donc sous-estimée (constat de la phase 0).

## Contrôle sur du vrai code (9 novembre 2026)

github/docs (904 fichiers) face à Primer React 38.19.0 : 293 espacements et 3 couleurs codés en dur (identique au spike v2, dont la revue manuelle a donné 0 faux positif sur 50 ; les 6 couleurs d'ombre ne sont plus comparées), 26 rayons, 37 tokens inexistants, tous vérifiés absents de `@primer/primitives` installé (anciens noms `--color-*`). Deux classes de faux positifs de `no-unknown-token` corrigées avant publication : noms construits à l'exécution (`--fg-${tone}`) et variables définies dans des fichiers CSS du DS non déclarés comme tokens. Analyse : moins d'une seconde hors construction du contrat.

## Historique

- **1.0** (9 novembre 2026) : définition initiale.
- **1.1** (10 novembre 2026) : les classes Tailwind sont comptées (ADR 0018) ; `no-off-theme-utility` compte comme « maison ».
