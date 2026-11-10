# DS Guard — Étude de marché documentaire

Nov 6, 2026 · @Arnaud

## Synthèse

Le problème est réel et durable, mais il est d'abord organisationnel : un outil peut rendre l'adoption visible et faire respecter le contrat du DS, il ne crée pas le mandat qui manque à la plupart des équipes DS.

1. **L'adoption est le problème n° 1 depuis 2018 et elle ne progresse pas.** Selon le rapport zeroheight 2026 (147 répondants, chiffres lus via une source secondaire), 91 % des équipes ont confiance dans leur DS, mais seulement 38 % le disent largement ou totalement adopté.
2. **La cause citée est le mandat, pas l'outillage.** Parmi les équipes en panne, 73 % citent l'absence de mandat de l'entreprise et 55 % une gouvernance faible. Un outil qui ne s'adresse qu'aux devs passera à côté de cette cause.
3. **La mesure reste rare et le budget se tend.** En 2022, seules 16 % des équipes DS suivaient des métriques (Sparkbox) ; en 2026, environ 61 % se disent en sous-effectif. Prouver la valeur devient vital, et peu d'équipes ont le temps d'outiller cette preuve.
4. **Les agents ont fait converger le marché vers « l'application par le code ».** Builder.io et Honeycomb arrivent à la même conclusion : les règles en prose ne tiennent pas, seuls les linters, les types et les vérifications en boucle guident un agent.
5. **Honeycomb a construit en interne le concept de DS Guard** (revue de PR non bloquante + télémétrie des violations + rituel hebdomadaire). C'est une validation forte du besoin, et la preuve que les équipes outillées le construisent elles-mêmes.
6. **Figma est entré sur le terrain** avec *Check designs* (juin 2026). Première critique publique : l'outil signale les exceptions intentionnelles sans moyen de les marquer comme telles. C'est exactement le trou que vise le modèle d'exceptions.
7. **L'argent va aux outils de design « agentiques », pas à la gouvernance** (Paper 34 M USD, Noon 44 M USD en 2026). L'espace est libre, mais peu visible pour les investisseurs.

**Verdict** : opportunité réelle mais étroite. Elle tient si le produit cible l'équipe DS (preuve de valeur, gouvernance) plutôt que le dev seul, et s'il apporte ce que les outils maison et Figma n'ont pas : les exceptions, la transversalité code + maquette, et une mesure fiable.

## Méthode et limites

Cette étude repose sur une quarantaine de pages publiques (rapports, articles, documentation, retours d'expérience) lues entre le 3 et le 6 novembre 2026 ; elle ne remplace pas des entretiens.

**Sources consultées** : enquêtes sectorielles (Sparkbox, zeroheight), retours d'expérience d'équipes DS (Mews, REI, Honeycomb, Pinterest), documentation d'outils (Figma, Storybook, Atlassian, Primer, Omlet, Radius Tracker), articles d'éditeurs (Builder.io, Supernova, OverlayQA, Knapsack), presse sur les levées de fonds, articles sur l'European Accessibility Act.

**Biais à garder en tête** :

- **Les éditeurs dominent.** La majorité des contenus viennent d'entreprises qui vendent la solution au problème qu'elles décrivent.
- **Les réussites sont surreprésentées.** Les équipes DS publient ce qui marche, rarement ce qui a échoué.
- **Les chiffres circulent de seconde main.** Ceux du rapport zeroheight 2026 ont été lus via des articles qui le citent, pas dans le rapport lui-même ; la taille d'échantillon varie selon la source (147 ou environ 300). Le chiffre souvent répété « 80 % des DS abandonnés en deux ans » n'a aucune source vérifiable.
- **Les praticiens anonymes sont peu accessibles.** Les fils Reddit et plusieurs articles Medium ont refusé la lecture automatisée ; leur contenu n'est connu que par des extraits de recherche, signalés comme tels.

**Ce que cette étude ne dit pas** : si des équipes paieraient, combien, et qui signerait. Seules des conversations réelles répondent à ça. Quelques échanges — même hors du cercle des gros DS — valideront ou invalideront ces hypothèses mieux que dix articles.

## Signaux forts

Sept tendances confirmées par plusieurs sources indépendantes ; ce sont les fondations sur lesquelles le produit peut s'appuyer.

| Signal | Preuves | Fiabilité | Ce que ça implique |
| --- | --- | --- | --- |
| L'adoption est le problème n° 1, depuis des années | Sparkbox : adoption en tête des difficultés depuis 2018 ; zeroheight 2026 : 38 % de DS largement adoptés, l'adoption qualifiée de « défi existentiel » | Forte (deux enquêtes, plusieurs années) | Douleur durable, pas une mode |
| Le manque de mandat bloque plus que la qualité du DS | zeroheight 2026 via DesignRush : 73 % des équipes en panne citent l'absence de mandat ; articles sur la « police du DS » (lollypop, Gravitee) | Moyenne (chiffres de seconde main, convergence qualitative forte) | Le produit doit outiller le mandat (preuve, décision, exceptions), pas seulement le contrôle |
| Les équipes DS doivent prouver leur valeur en argent | Articles sur le ROI (Supernova, Figr, Knapsack) ; baisse de la satisfaction sur le soutien de la direction (42 % → 32 %, seconde main) ; 61 % en sous-effectif | Moyenne | La mesure est un argument d'achat, à condition d'être crédible |
| Les règles en prose ne suffisent pas aux agents ; seul le code les guide | [Builder.io](https://www.builder.io/blog/how-to-make-ai-agents-follow-your-design-system) (lint, types, boucle de vérification) ; [Honeycomb](https://www.honeycomb.io/blog/lattice-watch-smarter-guardrails-design-system-observability) ; témoignages de hex codés en dur par les agents | Forte (convergence d'acteurs différents) | Le moteur de règles et l'outil `validate` sont au bon endroit |
| Les gros DS ont déjà leurs linters maison | Atlassian (`eslint-plugin-design-system`, `ensure-design-token-usage`), Primer (`eslint-plugin-primer-react`, expérimental) | Forte (documentation publique) | Les très gros comptes sont partiellement équipés ; les DS de taille moyenne ne le sont pas |
| Les tokens existent mais sont peu utilisés | [OverlayQA](https://overlayqa.com/blog/design-token-drift-study/) : 93 % des sites ont des tokens, couverture moyenne 40,4 %, 47 valeurs codées en dur par site ; zeroheight : tokens adoptés par 84 % des équipes | Moyenne (échantillon d'éditeur, sélection non décrite) | La dérive des tokens est massive et facile à montrer |
| La mesure de l'adoption se banalise | Outils open source (Radius Tracker, Omlet CLI) ; outils maison construits avec un LLM (REI) ; Figma *Check designs* | Forte | Le chiffre seul ne se vend pas ; sa fiabilité et ce qu'on en fait, oui |

## Signaux faibles

Indices isolés ou émergents : aucun ne suffit seul, mais plusieurs vont dans le sens du produit et deux le mettent en danger.

**Favorables**

- **La revue de DS par IA devient un rituel d'équipe.** Honeycomb a confié « Lattice Watch » à un rôle tournant hebdomadaire. La télémétrie des violations a révélé un linter réglé en avertissement au lieu d'erreur, et des composants flex faits main, corrigés en orientant vers le composant du DS. C'est le cycle mesure → décision → correction que DS Guard veut industrialiser.
- **Les exceptions intentionnelles sont un point de friction public.** Dès le lancement de *Check designs*, des designers ont signalé sur le forum Figma qu'un état désactivé ou une annotation était marqué en erreur, sans moyen propre de l'indiquer comme volontaire ([ZURB Radar](https://radar.zurb.com/article/config-2026-put-a-number-on-your-design-system-debt-it-didnt-hand-you-the-budget)).
- **Les agents contournent les garde-fous.** Builder.io rapporte des agents qui ajoutent des `eslint-disable`, des `as any`, ou suppriment un test qui échoue. Un relecteur indépendant de l'agent prend de la valeur.
- **« Visibility is not authority ».** L'idée que mesurer ne suffit pas sans pouvoir de décision apparaît chez ZURB comme chez DesignRush ; elle justifie que le produit porte aussi la décision (exceptions, propriétaires).
- **L'accessibilité commence à être contrôlée.** L'EAA s'applique depuis juin 2025 ; en 2026, les contrôles restent surtout administratifs, avec des premiers programmes en Suède et aux Pays-Bas et une première décision de justice signalée à Lille (non confirmée par une seconde source).

**Défavorables**

- **Figma centralise le DS.** À la Config 2026, Figma a annoncé (en préversion, selon un compte rendu) un espace qui réunit bibliothèques de design, bibliothèques de code et règles d'usage, avec une carte des dépendances, et des « sources de code » branchées sur un dépôt GitHub. Si Figma relie aussi la vérification au code, le cœur transversal du produit est menacé.
- **Un LLM rend le « fait maison » très bon marché.** Une PM de REI et l'équipe Honeycomb ont construit leur outil sans produit tiers. Plus les agents progressent, plus ce réflexe se généralise.

## Analyse des besoins

Le besoin le plus aigu et le moins servi est celui de l'équipe DS face à sa direction : prouver la valeur et obtenir le mandat. Les besoins des devs et des designers sont mieux couverts, mais par des outils dispersés.

| Rôle | Besoin exprimé dans les sources | Aujourd'hui servi par | Ce qui manque |
| --- | --- | --- | --- |
| Équipe DS | Savoir qui utilise quoi, pourquoi les autres n'adoptent pas, prouver le ROI, garder la confiance | Omlet, Radius Tracker, analytics Figma, scripts maison | Le « pourquoi » derrière les chiffres ; une mesure crédible dans le temps ; un moyen de trancher sans jouer la police |
| Direction (design, produit, engineering) | Des indicateurs qui parlent argent : délai de livraison, travail en double, risque | Calculs de ROI théoriques (modèles Smashing, Knapsack) | Des données réelles, propres à l'entreprise, reliées aux résultats |
| Designers produit | Savoir tôt si une maquette pose problème ; pouvoir s'écarter sans conflit ; contribuer sans attendre des semaines | Figma *Check designs*, plugins de lint Figma | Un statut d'exception reconnu ; une réponse claire sur le devenir d'une contribution |
| Devs front | Un retour immédiat, dans l'IDE ou la PR, avec le correctif ; ne pas être l'arbitre | ESLint et Stylelint (Atlassian, Primer, maison), Omlet pour VS Code | Des règles générées depuis le DS sans les écrire à la main ; des décisions tranchées en amont |
| Agents de code | Un contexte lisible par machine et un signal d'erreur dans la boucle | Storybook MCP, Figma MCP, fichiers AGENTS.md, linters | Une vérification indépendante de l'agent, qu'il ne peut pas désactiver |
| Conformité / accessibilité | Démontrer la conformité EAA / RGAA | Audits Stark, axe, prestataires | Le lien entre les composants accessibles du DS et l'accessibilité des écrans composés |

**Lecture transversale** : chaque rôle a des outils, mais aucun ne relie les rôles entre eux. Le designer ne voit pas ce que le dev voit, l'équipe DS ne voit pas les deux en même temps, et la direction ne voit rien. C'est là qu'un produit transversal a une raison d'être.

## Ce que disent les praticiens

Cinq thèmes reviennent dans les forums, articles de praticiens et retours d'expérience ; les fils Reddit n'ont pu être lus que par extraits de recherche, ce qui affaiblit cette section.

**1. « On est devenus la police du DS. »** Une équipe raconte être devenue la « police des tokens » en rejetant des composants pour des détails de nommage ; les designers ont cessé de demander leur avis et ont livré en douce. D'autres sources décrivent des équipes produit qui construisent leurs propres composants plutôt que d'attendre des semaines une validation.

**2. « Le chiffre d'adoption ne dit pas pourquoi. »** Un praticien note qu'un taux de 80 % ne dit ni quelles équipes utilisent le DS, ni pourquoi les autres non. Onfido propose de compter les produits qui utilisent un composant au moins une fois plutôt que le nombre d'occurrences. Un article oppose un tableau de bord d'adoption élevée à des devs frustrés : on mesurait la conformité, pas la valeur.

**3. « Les devs codent en dur malgré des tokens bien faits. »** Plusieurs témoignages, humains comme agents : une couleur hexadécimale collée dans une feuille de style malgré des tokens Figma soignés, une PR d'agent qui casse le mode sombre avec un rouge codé en dur. La réponse qui revient : linter l'usage des tokens plutôt que compter sur la discipline.

**4. « Si utiliser le DS est plus dur que de s'en passer, on a perdu. »** Les articles d'adoption convergent : réduire la friction, mettre le DS dans les outils du dev. Une étude de cas rapporte une adoption côté dev de 40 % avant l'intégration du DS dans VS Code et Storybook.

**5. « Les exceptions volontaires sont traitées comme des erreurs. »** Critique immédiate de *Check designs* sur le forum Figma : états désactivés, annotations et notes pour les devs remontés en violation, sans moyen de les marquer comme intentionnels.

> « Your codebase is your prompt. » — Alice Moore, [Builder.io](https://www.builder.io/blog/how-to-make-ai-agents-follow-your-design-system)

**Ce qui manque dans ces témoignages** : presque personne ne parle de payer un outil pour ça. Les solutions citées sont des règles ESLint, des scripts, des rituels d'équipe. C'est un signal à prendre au sérieux sur la volonté de payer.

## Concurrence

Aucun acteur ne relie aujourd'hui maquette, code et agents avec un modèle d'exceptions ; Figma est le seul capable de le faire à moyen terme, et les outils maison sont le concurrent du quotidien.

> Schéma « carte du marché · 3 surfaces × 3 moments » : non reproduit dans le dépôt.

Le contexte en amont est encombré ; la vérification et la mesure côté agents sont vides, et aucun acteur ne couvre une rangée entière.

| Acteur | Ce qu'il fait | Modèle | Force | Faiblesse face à DS Guard | Menace |
| --- | --- | --- | --- | --- | --- |
| Figma (*Check designs*, MCP, Code Connect, sources de code) | Signale valeurs codées en dur, contraste, composants détachés dans les maquettes ; relie de plus en plus le code | Inclus dans les offres payantes | Présent chez tous les designers | Pas d'exceptions intentionnelles ; ne voit pas les PR | **Forte** |
| Outils maison (scripts, extensions, revues IA) | Mesure ou revue sur mesure (REI, Mews, Honeycomb) | Temps interne | Adaptés au contexte, gratuits en apparence | Fragiles, définitions mouvantes, pas maintenus | **Forte** |
| Linters de DS (Atlassian, Primer, Buoy, ESLint maison) | Bloquent les valeurs codées en dur et les imports interdits | Open source | Dans l'IDE et la CI, gratuits | Une surface, pas de mesure, pas de gouvernance | Moyenne |
| Storybook MCP / Chromatic | Contexte DS pour les agents, tests de composants et d'accessibilité | Open source + SaaS | Standard de fait des DS React | Composants isolés, pas leur usage | Moyenne |
| Omlet | Analytics d'usage des composants React, versions héritées, VS Code | SaaS (essai 30 jours), CLI publique | Produit mûr, clients connus (Instacart, Optimizely) | Ne corrige rien ; pas de Figma ni d'exceptions | Moyenne |
| Radius Tracker (Rangle) | Rapport d'adoption DS vs composants maison | Open source (MIT) | Gratuit, adossé à une agence | Outil d'audit plus que produit | Faible |
| zeroheight, Supernova, Knapsack | Documentation, tokens, contexte pour agents, premières mesures | SaaS | Installés chez les équipes DS | Vérifient peu en aval | Moyenne |
| OverlayQA | Audit des pages en ligne : couverture des tokens, dérive | Extension Chrome | Rapide, accessible aux non-devs | Après la mise en ligne ; méthode peu documentée | Faible |
| Paper, Noon, Dessn (levées 2026) | Outils de design pour l'ère des agents | SaaS financés | Moyens importants | Produisent de l'interface, ne la gouvernent pas | Indirecte |

## Contraintes

Les contraintes les plus dures ne sont pas techniques : ce sont l'accès au code, les plans Figma et la petite taille du marché.

| Type | Contrainte | Source ou indice | Conséquence pour le produit |
| --- | --- | --- | --- |
| Technique | La diversité des façons de styler : variables CSS, Tailwind (v4 très différente des versions précédentes), CSS-in-JS | OverlayQA : 55 % de couverture avec Tailwind v4 contre 8,4 % avant | Des adaptateurs par méthode, testés sur du vrai code |
| Technique | Les réexports et wrappers faussent le comptage par imports | Retour d'expérience Mews | Résolution des wrappers dès le MVP |
| Technique | L'analyse statique ne voit pas les états dynamiques | Honeycomb et Mews mesurent au rendu pour cette raison | Accepter cette limite et la documenter |
| Technique | Les agents contournent les garde-fous (`eslint-disable`, suppression de tests) | Builder.io | La vérification doit tourner hors de l'agent (CI) |
| Accès | Les analytics de bibliothèque Figma et leur API sont réservés aux offres Organization et Enterprise | zeroheight | Le plugin doit analyser le fichier lui-même |
| Accès | Le code des secteurs régulés ne sort pas de l'entreprise | Contexte santé et finance | Exécution locale ou en CI, métriques agrégées seulement |
| Organisation | Sans mandat, aucun outil ne fait adopter un DS | zeroheight 2026 : 73 % des équipes en panne citent l'absence de mandat | Vendre aussi à la direction, pas seulement à l'équipe DS |
| Organisation | Les équipes DS sont en sous-effectif (environ 61 %) | zeroheight 2026, seconde main | L'outil doit faire gagner du temps dès la première semaine, pas en demander |
| Commercial | Le nombre d'entreprises avec une équipe DS dédiée et un DS React est limité | Ordre de grandeur, non chiffré | Prix élevé par compte, peu de clients |
| Commercial | Les praticiens règlent le problème avec des outils gratuits | Forums, linters open source | La valeur payante doit être ailleurs que dans le lint |
| Réglementaire | L'EAA est en vigueur mais les sanctions restent rares en 2026 | Articles de suivi de l'application | L'accessibilité est un argument, pas encore une urgence d'achat |

## Pièges

Huit façons d'échouer, tirées des sources ; la plupart viennent d'un produit techniquement juste mais mal placé dans l'organisation.

1. **Devenir la police automatisée.** Un bot qui bloque et sermonne reproduit le réflexe décrit par les équipes DS : les gens contournent en silence. Honeycomb a délibérément rendu sa revue IA non bloquante.
2. **Mesurer la conformité en croyant mesurer la valeur.** Un taux d'adoption élevé peut cohabiter avec des devs frustrés. Sans lien avec des résultats (délai, bugs, accessibilité), le chiffre ne convainc pas une direction.
3. **Traiter l'intentionnel comme une erreur.** C'est la première critique adressée à *Check designs*. Chaque faux positif apprend à ignorer l'outil.
4. **Faire appliquer des règles avant que le DS soit complet.** Builder.io a vu des agents inventer des tokens d'espacement inexistants parce que la règle exigeait des tokens qui n'existaient pas encore.
5. **Vendre un outil à qui il manque un mandat.** L'équipe DS achète, mais sans soutien de la direction, l'outil produit des rapports que personne n'applique.
6. **Courir après une cible arbitraire.** Les seuils publiés (80 %, 90 %) ne reposent sur rien ; 100 % n'est pas souhaitable quand des interfaces sur mesure sont légitimes.
7. **Se battre contre la plateforme.** Concurrencer Figma sur la maquette ou Storybook sur le contexte des agents est perdu d'avance. La place est entre eux, pas à leur place.
8. **Construire ce qu'un LLM reproduit en un week-end.** Un tableau de couverture seul est déjà copiable. La valeur doit être dans ce qui est long à rendre fiable : historique comparable, exceptions, contrat par version, transversalité.

## Opportunités

Les trois opportunités à saisir en premier sont les exceptions intentionnelles, le relecteur indépendant des agents et les règles générées depuis le DS : forte valeur, difficulté maîtrisable, et aucun acteur ne les couvre bien.

1. **Exceptions intentionnelles** : marquer un écart comme volontaire, en code et dans Figma, avec responsable et expiration. Douleur publique dès le lancement de *Check designs*.
2. **Relecteur indépendant des agents** : une vérification en CI que l'agent ne peut pas désactiver, plus un outil `validate` pour corriger avant la PR.
3. **Règles générées depuis le DS** : produire automatiquement l'équivalent du plugin ESLint d'Atlassian pour un DS qui n'a pas d'équipe pour l'écrire.
4. **Contrat par version** : évaluer chaque produit face à sa version, mesurer le retard et les correctifs manquants.
5. **Accessibilité de composition** : l'argument monte avec l'EAA, mais les règles fiables sont plus difficiles à écrire.
6. **Preuve de valeur pour la direction** : relier la couverture à des résultats (délai, bugs, accessibilité). Personne ne l'a fait ; très forte valeur, mais il faut des données clients.
7. **Pont Figma ↔ code** : forte valeur, mais difficile et directement sur le chemin de Figma.
8. **Tableau de couverture seul** : facile, mais banalisé et peu différenciant.

Le schéma ci-dessous place ces huit pistes selon leur valeur pour l'acheteur et leur difficulté de réalisation ; les positions sont des estimations, pas des mesures.

> Schéma « opportunités · valeur × difficulté, positions estimées » : non reproduit dans le dépôt.

Les trois pistes en couleur forment le cœur d'un premier produit ; la preuve de valeur pour la direction est le pari qui le rendrait indispensable.

## Implications pour DS Guard

L'étude confirme le cœur de la vision (exceptions, transversalité, relecture indépendante des agents) et oblige à revoir trois points : la cible d'achat, le rôle de la mesure, et la réponse aux outils maison.

| Point de la vision produit | Verdict | Ajustement proposé |
| --- | --- | --- |
| Exceptions comme objet central | **Confirmé**, et renforcé par la critique de *Check designs* | En faire le premier argument du produit, devant le lint |
| Relecture de PR non bloquante par défaut | **Confirmé** par Honeycomb | Garder ; ajouter un rituel suggéré (revue hebdomadaire des tendances) |
| Règles déduites du package DS | **Confirmé** : les gros DS écrivent leurs règles à la main, les moyens n'en ont pas les moyens | Exporter aussi ces règles en plugin ESLint, pour être dans l'IDE gratuitement |
| Acheteur = lead DS | **À revoir** : le blocage principal est le mandat, qui se décide plus haut | Prévoir un rapport destiné à la direction dès le MVP, sur une page |
| La mesure comme argument d'achat | **À nuancer** : la mesure seule est banalisée | Vendre la boucle mesure → décision → correction, pas le chiffre |
| Cible : scale-ups React | **Plausible** mais marché étroit et volonté de payer non démontrée | Commencer en open source ; ne créer l'offre payante qu'après des usages réels |
| Plugin Figma en v2 | **À surveiller** : Figma avance vite sur le même terrain | Le limiter aux exceptions et au lien avec le code, là où Figma ne va pas |
| Accessibilité de composition | **Argument secondaire** en 2026 | La garder dans les règles, ne pas en faire l'argument principal tant que les sanctions EAA restent rares |


## Sources

Pages lues en entier, puis pages connues seulement par extraits de recherche (à vérifier avant de citer un chiffre).

**Lues en entier**

- [Honeycomb — Lattice Watch](https://www.honeycomb.io/blog/lattice-watch-smarter-guardrails-design-system-observability) (juillet 2026, éditeur)
- [Builder.io — How to Make AI Agents Follow Your Design System](https://www.builder.io/blog/how-to-make-ai-agents-follow-your-design-system) (juin 2026, éditeur)
- [ZURB Radar — Config 2026 put a number on your design system debt](https://radar.zurb.com/article/config-2026-put-a-number-on-your-design-system-debt-it-didnt-hand-you-the-budget) (juin 2026)
- [OverlayQA — Design Token Drift study](https://overlayqa.com/blog/design-token-drift-study/) (mai 2026, éditeur)
- [DesignRush — The Hidden Reason Design Systems Fail to Gain Adoption](https://news.designrush.com/design-system-adoption-sequencing) (juillet 2026, chiffres du rapport zeroheight 2026)
- [Forum Figma — Everything announced at Config 2026](https://forum.figma.com/product-updates-3/everything-announced-at-config-2026-55221)
- [Mews — Design system adoption metric](https://developers.mews.com/design-system-adoption-metric-building/) · [REI, Maya Hampton — Visual coverage analyzer](https://www.designsystemscollective.com/measuring-design-system-adoption-building-a-visual-coverage-analyzer-b5d9ae410d42) (texte fourni) · [zeroheight — How to track adoption](https://zeroheight.com/blog/how-to-track-adoption-in-your-design-system/) (texte fourni) · [Omlet — How leaders measure adoption](https://omlet.dev/blog/how-leaders-measure-design-system-adoption/) · [Supernova — 9 metrics](https://www.supernova.io/blog/9-design-system-metrics-that-matter)

**Connues par extraits de recherche**

- Enquêtes : [Sparkbox Design Systems Survey](https://designsystemssurvey.seesparkbox.com) · [zeroheight Design Systems Report 2026](https://report.zeroheight.com)
- Outils : [Atlassian eslint-plugin-design-system](https://atlassian.design/components/eslint-plugin-design-system/ensure-design-token-usage) · [Radius Tracker (Rangle)](https://rangle.io/radius-tracker) · [Omlet 1.0](https://blog.zeplin.io/meet-omlet-component-analytics-for-developers) · [Storybook MCP](https://storybook.js.org/docs/ai/mcp/overview)
- Gouvernance : [lollypop — Design system governance](https://lollypop.design/blog/2025/december/design-system-governance-enterprise-ux/) · [Gravitee — Governance and contribution model](https://gravitee.io/corpus/gen-1683/design-system/governance-and-contribution-model-for-scaling-a-design-system-across-product-teams.html) · [Magic Patterns — Scaling design systems](https://www.magicpatterns.com/blog/scaling-design-system)
- Figma Config 2026 : [Design Systems Collective — DS-focused round-up](https://www.designsystemscollective.com/context-context-everywhere-a-ds-focused-round-up-of-figmas-config-announcements-6c3fbf630ac4)
- Levées de fonds : [Paper — Series A](https://paper.design/blog/series-a)
- Accessibilité : [Level Access — EAA compliance in 2026](https://www.levelaccess.com/blog/eaa-compliance-in-2026-how-enforcement-has-evolved-and-what-to-expect-next/) · [AllAccessible — EAA one year on](https://allaccessible.org/blog/european-accessibility-act-one-year-on-2026-enforcement-update)

**Pages inaccessibles** : fils Reddit r/DesignSystems, Mantlr (payant), plusieurs articles Design Systems Collective sur Medium.
