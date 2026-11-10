# Plan du dépôt de démo public

Statut : **construit en local, pas encore publié** (9 novembre 2026), dans un dépôt séparé `ds-guard-demo`. Nom retenu : **Orvella** (aucune entreprise ni scope npm de ce nom trouvé ; proche de « Orva », une application de suivi patient : vérification de marque à faire avant publication).

Écarts au plan : application à la racine du dépôt (pas de `apps/`), DS dans `design-system/` ; les deux versions du DS sont des archives versionnées dans `vendor/` au lieu de GitHub Packages, le lockfile change donc bien de version. Pas encore fait : publication, PR ouvertes, GitHub Pages, renommage de la fixture `@vitals`.

Constats sur le produit pendant la construction :
- La PR de mise à jour du DS ne change aucune ligne de code : le commentaire montre la conformité (70 %) mais aucun constat, et ne compare pas à la branche de base. À traiter : quand la version du DS change dans le lockfile, lister les nouveaux constats et l'écart de conformité.
- Un `<button>` qui contient un `<svg>` sans `<title>` n'est pas signalé par `a11y-accessible-name` (tout enfant élément compte comme un nom possible) : la démo utilise une icône en CSS.
- L'exception échue apparaît dans le commentaire de chaque PR, même sans lien avec la PR.

## But

Montrer en cinq minutes, sur de vraies PR commentées, les trois promesses du produit : le relecteur indépendant sur chaque PR (humaine ou générée par un agent), les exceptions intentionnelles, et le rapport d'une page pour la direction. Le dépôt sert aussi de test d'installation pour la porte de sortie de la phase 1.

## Contenu fictif, sans référence réelle

- Une application de santé fictive : portail patient (rendez-vous, ordonnances, messages, facturation). Aucune donnée réelle, aucun nom de praticien ou d'établissement réel, textes génériques.
- Un DS fictif avec ses tokens, dans le même dépôt.
- **Nom à valider avant publication** : vérifier marque, nom de domaine et scope npm libres. Le nom `vitals` utilisé par la fixture de test (`fixtures/vitals-app`) est trop proche de services existants : à remplacer dans la démo, et dans la fixture avant de rendre le dépôt public (phase 2).

## Structure

```
demo/
  packages/ui/          # DS fictif : ~15 composants React + TS, .d.ts publiés, @deprecated sur 3 API
  packages/tokens/      # tokens DTCG (couleur, espacement, rayon, typographie)
  apps/patient-portal/  # Vite + React + TS, consomme le DS en version épinglée
  ds-guard.config.json, ds-exceptions.yml, .github/workflows/ds-guard.yml
```

Le DS est publié sur GitHub Packages en deux versions (1.4 et 2.0, la 2.0 retire un token et un composant), pour montrer que le contrat suit la version du lockfile et non la dernière. Un DS lié en `workspace:` fonctionne aussi (la version installée fait foi), mais ne montre pas le décalage de versions.

## PR scénarisées (ouvertes, commentées, laissées visibles)

1. **Fonctionnalité générée par un agent** (« ajouter le rappel de rendez-vous ») : valeurs codées en dur, `<button>` natif, prop au mauvais format. Le commentaire propose les tokens.
2. **Exception assumée** : un bandeau hors échelle validé en revue design ; la PR ajoute l'entrée dans `ds-exceptions.yml` (responsable, échéance) et l'annotation. Le constat passe en « couvert ».
3. **Régression d'accessibilité** : image sans `alt`, bouton icône sans nom. Seul cas où la vérification échoue.
4. **Mise à jour du DS 1.4 → 2.0** : le lockfile change, les API dépréciées et le token retiré apparaissent ; la conformité baisse puis remonte dans la PR de correction.
5. **Nettoyage** : remplacement des valeurs codées en dur d'un module ; la couverture expliquée monte, visible dans la tendance.

Plus une exception **échue** laissée volontairement dans l'historique, pour montrer qu'elle cesse de couvrir.

## Rapport direction

Un workflow hebdomadaire sur `main` lance `ds-guard report --record`, commite `ds-guard-history.json` et publie `leadership.html` sur GitHub Pages : la page montre une tendance réelle sur plusieurs semaines.

## Étapes et charge estimée

| Étape | Charge |
| --- | --- |
| Nom, DS fictif (composants, tokens, 2 versions publiées) | 1,5 j |
| Portail patient (6 à 8 écrans, volontairement imparfait) | 1,5 j |
| Workflows, PR scénarisées, exception échue | 1 j |
| README de démo, captures, vidéo de 3 min (phase 2) | 0,5 j |

## Vérification

Une ou deux personnes extérieures suivent seules le README principal sur la démo, puis sur leur propre application, chronomètre en main : critère de la phase 1, moins de 15 minutes. Noter chaque blocage dans une issue.
