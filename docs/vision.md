# DS Guard — Vision produit

Nov 3, 2026 · @Arnaud

## Résumé

**DS Guard** (nom de travail) est la couche de conformité du design system : elle vérifie chaque maquette, chaque génération d'agent et chaque PR face au contrat du DS et à l'accessibilité, distingue une dérive accidentelle d'une décision assumée, et mesure l'adoption dans le temps.

**Positionnement en une phrase** : ce que SonarQube est à la qualité du code, appliqué au design system — neutre vis-à-vis des outils (Figma, GitHub, n'importe quel agent).

**Premier argument** : les exceptions intentionnelles. Marquer un écart comme volontaire, en code et dans Figma, est la douleur la plus visible du marché — c'est la première critique publique de *Check designs*, l'outil de Figma — et aucun acteur n'y répond. Le lint vient ensuite.

**La thèse** : les agents vont multiplier la production d'interface. Le DS cesse d'être une bibliothèque qu'on consulte pour devenir une politique qu'on applique. Tout le marché outille le contexte en entrée (« voici mon DS, agent ») ; personne ne possède la vérification en sortie, sur toutes les surfaces, ni la gouvernance des écarts.

**Pourquoi maintenant** :

- les agents de code sont devenus des producteurs d'interface à part entière, sans relecteur dédié ;
- les serveurs MCP (Figma, Storybook, Supernova) standardisent l'accès au DS, ce qui rend un contrat lisible par machine enfin réaliste ;
- l'European Accessibility Act s'applique depuis juin 2025 ; les contrôles restent surtout administratifs en 2026, l'accessibilité est donc un argument d'appui plutôt qu'une urgence d'achat ;
- les équipes DS doivent justifier leur budget, et n'ont pas d'indicateur fiable pour le faire.

Ce document intègre les conclusions de l'[étude de marché documentaire](etude-marche.md) de novembre 2026.

## Problème

Le respect du DS repose aujourd'hui sur la discipline individuelle et la relecture humaine ; ce modèle ne tient pas quand une partie de l'interface est produite par des agents.

**Constats récurrents** (retours d'expérience publics d'équipes DS, voir l'[étude de marché](etude-marche.md)) :

- le suivi de l'adoption du DS est balbutiant : on ne sait pas qui utilise quoi, ni à quel point ;
- les composants sont pensés accessibles, mais l'accessibilité des écrans composés n'est pas vérifiée ;
- les designers s'écartent du DS sans que l'écart soit visible avant le code ;
- les designers veulent faire évoluer le DS selon leurs besoins, sans preuve d'usage ni test utilisateur ;
- le dev front se retrouve arbitre malgré lui : il intègre une maquette validée qui contredit le DS.

**Causes profondes** :

1. **Les écarts sont implicites.** Un écart volontaire et une erreur se ressemblent ; aucun outil ne fait la différence.
2. **La vérification arrive trop tard.** Découvrir un écart en PR coûte une boucle design → validation → code complète.
3. **Chaque outil ne voit qu'une surface.** Figma ne voit pas le code, Storybook ne voit pas les maquettes, les linters ne voient ni les décisions ni l'historique.
4. **Le contrat du DS n'est pas formalisé.** Les règles d'usage vivent dans une documentation lue par des humains, rarement dans un format exécutable.

**Ce que les agents changent** : la dérive était lente et humaine, elle devient rapide et massive. Un agent bien nourri produit du code plausible et conforme en apparence ; sans boucle de contrôle, il reproduit aussi les mauvais exemples qu'il trouve dans le code existant.

## Utilisateurs

L'acheteur n'est pas l'utilisateur quotidien : le produit doit prouver sa valeur à l'équipe DS tout en restant invisible, voire utile, pour les designers et les devs.

| Rôle | Qui | Douleur | Ce que DS Guard lui apporte | Surface |
| --- | --- | --- | --- | --- |
| Acheteur | Lead DS, Head of Design / DesignOps, VP Engineering | Impossible de prouver le retour sur investissement du DS | La couverture expliquée et la conformité par équipe, dans le temps ; la dette d'accessibilité et le retard de version chiffrés | Tableau de bord |
| Équipe DS | Designers et devs du DS | Jouée en « police » ; changements cassants à l'aveugle ; demandes d'évolution sans preuve | Des propositions documentées, l'analyse d'impact d'un changement, les exceptions agrégées comme signal de feuille de route | Tableau de bord, PR du DS |
| Designer produit | Designers des équipes produit | Découvre trop tard que sa maquette pose problème ; perçoit le DS comme une contrainte | Un retour immédiat au passage en livraison, un chemin légitime pour s'écarter (l'exception) | Plugin Figma |
| Dev front | Développeurs des équipes produit | Coincé entre maquette validée et règles du DS ; relit des pixels | Des écarts tranchés en amont, des commentaires de PR actionnables avec le correctif suggéré | PR, IDE |
| Agent | Claude Code, Cursor, Copilot, Figma Make… | Produit vite sans savoir si c'est conforme | Un outil `validate` qui lui dit quoi corriger avant d'ouvrir la PR | Serveur MCP |
| Responsable conformité | Juridique, accessibilité, qualité | Doit démontrer la conformité EAA / RGAA | Un historique et des rapports exportables | Export, tableau de bord |

## Cas d'usage

Neuf cas d'usage, classés par priorité ; les quatre premiers forment le MVP.

| # | Cas d'usage | Déclencheur | Résultat attendu | Priorité |
| --- | --- | --- | --- | --- |
| 1 | **Relire une PR face au DS** | Ouverture ou mise à jour d'une PR | Commentaires sur les valeurs codées en dur (avec le token suggéré), les composants réimplémentés localement, les props dépréciées, les erreurs d'accessibilité de composition — évalués face à la version du DS réellement utilisée | MVP |
| 2 | **Déclarer une exception** | Un écart volontaire validé en revue de design | L'écart est tracé (justification, responsable, expiration) ; le bot le reconnaît et ne bloque pas | MVP |
| 3 | **Mesurer la couverture expliquée** | Analyse planifiée de la branche principale | Couverture expliquée et conformité par dépôt et par équipe, tendance, dette d'accessibilité | MVP |
| 4 | **Suivre les versions du DS** | Analyse planifiée, ou nouvelle version du DS publiée | Version utilisée par chaque produit (lockfile), retard, correctifs d'accessibilité manquants, produits hors politique de support | MVP (rapport simple) |
| 5 | **Vérifier une maquette au passage en livraison** | Le designer marque un écran « prêt pour le dev » | Rapport de conformité joint au ticket ; dérives corrigées, écarts transformés en exceptions | v2 |
| 6 | **Auto-vérification d'un agent** | L'agent termine une génération | L'agent appelle `validate`, corrige, puis ouvre une PR déjà conforme | v3 |
| 7 | **Prévisualiser une mise à jour du DS** | Une PR Renovate ou Dependabot monte la version du DS | Le code évalué face au contrat de la nouvelle version : usages qui cassent, codemods disponibles, estimation du coût, publiés en commentaire de la PR de montée de version | v4 |
| 8 | **Analyser l'impact d'un changement cassant** | L'équipe DS prépare une version majeure | Liste des usages touchés par équipe, codemod proposé | v4 |
| 9 | **Proposer une évolution du DS** | Plusieurs exceptions similaires, ou demande d'un designer | Une proposition argumentée : nombre de contournements existants, parcours concernés, prototype testé | v4 |

**Scénario de référence** — un écart vu de bout en bout :

1. Une designer a besoin d'un sélecteur de créneau que le DS n'a pas.
2. Au passage en livraison, le plugin signale le composant non issu du DS ; elle déclare l'exception EXC-12 (« sélecteur de créneau, parcours prise de RDV », expiration dans 90 jours).
3. Le dev, ou son agent, implémente ; le bot de PR reconnaît EXC-12 et signale sans bloquer.
4. Deux autres équipes déclarent une exception similaire ; le tableau de bord la fait remonter à l'équipe DS.
5. L'équipe DS intègre le composant ; l'outil propose la migration des trois usages et ferme les exceptions.

## Positionnement et concurrence

DS Guard se place en aval de tous les outils existants : il ne fournit pas le DS aux agents, il vérifie ce qui en sort, quel que soit l'outil qui l'a produit.

| Famille | Acteurs | Ce qu'ils couvrent | Ce qu'ils ne couvrent pas | Relation |
| --- | --- | --- | --- | --- |
| Outils maison | Extensions et scripts construits en interne, de plus en plus avec un LLM ([exemple de REI](https://www.designsystemscollective.com/measuring-design-system-adoption-building-a-visual-coverage-analyzer-b5d9ae410d42), [Mews](https://developers.mews.com/design-system-adoption-metric-building/)) | Un chiffre de couverture rapide, adapté au contexte | Fiabilité dans le temps : définitions mouvantes, échantillons choisis, pas d'historique comparable | **Le vrai concurrent** sur la mesure |
| Outil de design | [Figma](https://developers.figma.com/docs/figma-mcp-server/) (MCP, Code Connect, Make, analytics de bibliothèque, Check Designs) | Contexte DS pour les agents, conformité et détachements dans Figma | Le code, les dérives introduites après la maquette ; analytics réservés aux offres Organization et Enterprise | Intégration (plugin, API) |
| Atelier de composants | [Storybook MCP](https://storybook.js.org/docs/ai/mcp/overview), Chromatic | Manifeste de composants, tests de composants isolés | L'usage dans les produits, Figma | Source du contrat (manifeste) |
| Plateformes DS | [Supernova](https://www.supernova.io/for-ai), [Knapsack](https://techcrunch.com/2025/10/09/knapsack-picks-up-10m-to-help-bridge-the-gap-between-design-and-engineering-teams), [zeroheight](https://zeroheight.com/blog/how-to-track-adoption-in-your-design-system/) (dont une CLI d'adoption React), Frontify | Documentation, tokens, contexte pour agents, premiers comptages d'usage | La vérification en aval, la gouvernance des écarts | Concurrents indirects, partenaires possibles |
| Analytics d'adoption | [Omlet](https://omlet.dev/blog/how-leaders-measure-design-system-adoption/), react-scanner | Mesure rétrospective des usages et des versions héritées, analyse de dépendances | Correction, accessibilité, agents, exceptions | Concurrent direct sur la mesure |
| Audit de pages en ligne | [OverlayQA](https://overlayqa.com/blog/audit-design-system-adoption/) (extension Chrome) | Couverture des tokens et valeurs codées en dur sur les pages publiées, export vers Jira ou Linear | Constate après la mise en ligne ; méthode de mesure non publiée | Concurrent sur l'audit ponctuel |
| Linters de dérive | [FigmaLint](https://github.com/southleft/figmalint/wiki), [Buoy](https://cdn.jsdelivr.net/gh/buoy-design/buoy@main/README.md), règles ESLint maison | Détection de valeurs codées en dur | Une seule surface, pas de produit ni d'historique | Concurrents fragmentés |
| Gestion des dépendances | Renovate, Dependabot | Montée de version automatique du package DS | Ce que la montée de version casse face au contrat du DS | Intégration (commentaire sur leurs PR) |
| Accessibilité | Stark, Deque axe | Audits génériques | Le contrat propre à chaque DS | Complémentaires (axe en moteur) |
| Générateurs | v0, Lovable, Figma Make, Builder.io | Production d'interface | Le contrôle de ce qu'ils produisent | Producteurs du problème, partenaires |

**Notre place** : la seule couche qui relie les trois surfaces (maquette, agent, PR) avec un même moteur de règles, et qui traite l'exception comme un objet de premier ordre.

**Lecture critique du marché** : la mesure brute de couverture devient banale — une PM de REI a construit la sienne avec un LLM, sans équipe d'ingénierie. Les articles du secteur viennent presque tous d'éditeurs ou d'équipes DS qui présentent leur réussite, avec des définitions floues et des chiffres invérifiables. Aucun ne démontre qu'une couverture plus élevée produit de meilleurs résultats. La valeur n'est donc pas dans le chiffre, mais dans une mesure fiable, auditable et reliée à des décisions.

**Apports de l'étude de marché** :

- **Honeycomb a construit en interne une version de DS Guard** : revue de PR par IA non bloquante, télémétrie des violations, rituel hebdomadaire. Le besoin est validé ; les équipes outillées le construisent elles-mêmes.
- **Figma *Check designs* (juin 2026)** vérifie les maquettes mais signale les exceptions volontaires comme des erreurs, sans moyen de les marquer. Figma annonce aussi des « sources de code » branchées sur GitHub : c'est le concurrent à surveiller en priorité.
- **Les gros DS ont leurs linters** (Atlassian, Primer) ; les DS de taille moyenne n'ont pas d'équipe pour les écrire.
- **Radius Tracker (Rangle, open source)** et Omlet couvrent déjà la mesure d'adoption côté code.
- **Aucun praticien n'évoque de payer** pour ce problème : les solutions citées sont gratuites ou maison.

**Pourquoi la neutralité est défendable** : Figma ne commentera pas vos PR en profondeur, Storybook ne regardera pas vos maquettes, une plateforme de documentation ne tournera pas dans votre CI. Aucun acteur de plateforme ne peut être neutre sans contredire sa stratégie.

**Ce que nous ne sommes pas** : un générateur d'écrans, un outil de documentation du DS, un outil de design.

## Principes produit et intuitions

Huit principes guident chaque arbitrage ; quand une fonctionnalité en contredit un, elle attend.

1. **Une couche, pas une destination.** On s'insère là où chacun travaille déjà : Figma, l'IDE ou l'agent, la PR. Seule l'équipe DS a un écran à elle.
2. **Un moteur, trois surfaces.** Les mêmes règles s'appliquent à la maquette, à l'agent et à la PR. Une règle qui n'existe que sur une surface crée de la confusion.
3. **On ne surveille pas l'exploration.** Le designer reste libre de sortir du DS pour chercher. La conformité ne se vérifie qu'au passage en livraison.
4. **Un écart n'est pas une faute.** On distingue la dérive accidentelle (on corrige), l'écart volontaire (on déclare) et la non-conformité d'accessibilité (on bloque).
5. **Arbitrer au moment le moins cher.** Une décision de design se tranche en revue de design, pas en PR. La PR est un filet de sécurité, pas un tribunal. Le bot ne bloque pas par défaut, et ses constats nourrissent une revue hebdomadaire des tendances par l'équipe DS, comme le fait Honeycomb.
6. **Peu de règles, à forte confiance.** Un faux positif coûte plus cher qu'un vrai positif raté : il apprend aux gens à ignorer l'outil.
7. **Toujours suggérer le correctif.** Un commentaire sans correctif est une plainte ; avec un correctif, c'est une aide.
8. **Local d'abord.** Le code du client ne sort jamais de chez lui ; seules des métriques agrégées remontent, et seulement si le client le choisit.

**Intuitions à valider** :

- Le contrat du DS peut être déduit à 80 % du package lui-même (types TypeScript, tokens, manifeste Storybook) ; les 20 % restants (règles d'usage) sont écrits par l'équipe DS.
- Rendre l'exception légitime réduit les écarts cachés plus efficacement que l'interdiction.
- Les exceptions agrégées sont le meilleur signal de feuille de route d'un DS.
- L'argument d'achat décisif sera une mesure fiable et auditable (couverture expliquée, dette d'accessibilité, correctifs manquants), pas le lint ni la mesure brute, qui devient banale.
- Un agent qui s'auto-vérifie corrige mieux et plus vite qu'un humain qui relit ses commentaires de PR.

## Concepts clés

Le produit repose sur quatre objets : le contrat, la règle, le constat et l'exception.

**Le contrat du DS** — la description exécutable de ce que le DS promet et exige. Il est généré automatiquement depuis le package, puis enrichi par l'équipe DS.

- *Inventaire* : composants, props et leurs types, variantes, éléments dépréciés.
- *Tokens* : couleurs, espacements, typographie, rayons, avec leurs valeurs brutes (pour suggérer le token à partir d'une valeur codée en dur).
- *Exigences d'usage* : « `IconButton` exige `aria-label` », « une `Modal` a un titre référencé », « un seul `Button` primaire par zone ».
- *Contexte produit* (v2+) : parcours et personas auxquels un composant est destiné ; utile aux agents et aux propositions d'évolution.

**La règle** — une vérification unitaire, avec un identifiant stable, une sévérité et, autant que possible, un correctif automatique. Une règle s'applique à une représentation commune (voir Architecture), donc à toutes les surfaces.

| Type d'écart | Exemple | Sévérité par défaut | Traitement |
| --- | --- | --- | --- |
| Dérive accidentelle | Couleur codée en dur, instance détachée, prop dépréciée | Avertissement | Correctif suggéré, sans débat |
| Écart volontaire | Composant absent du DS, variante non prévue | Bloquant sauf exception | Déclaration d'une exception |
| Accessibilité | Bouton icône sans libellé, hiérarchie de titres cassée | Bloquant | Aucune exception sans validation de l'équipe DS |

**Le constat** (*finding*) — une règle violée à un endroit précis (fichier et ligne, ou nœud Figma), avec le correctif proposé. Les constats sont datés et historisés : c'est la matière première de la mesure.

**L'exception** — un écart déclaré et assumé. Elle porte un identifiant, une justification, un responsable, une portée (fichiers, composants, écran Figma), une date d'expiration et, optionnellement, un lien vers le ticket. Exemple de déclaration dans le dépôt :

```yaml
# ds-exceptions.yml
- id: EXC-12
  rule: no-foreign-component
  scope: apps/booking/src/SlotPicker/**
  reason: "Sélecteur de créneau absent du DS, parcours prise de RDV"
  owner: "@equipe-booking"
  expires: 2027-02-01
  ticket: BOOK-431
```

Ou, au plus près du code : `// ds-exception: EXC-12`. À expiration, l'exception redevient un constat bloquant : la dette consciente ne devient jamais une dette oubliée.

**Les mesures** — deux pourcentages lisibles plutôt qu'un score composite, car 100 % de DS n'est pas un objectif : certaines interfaces sur mesure sont légitimes.

- *Couverture expliquée* : part de l'interface issue du DS **ou** couverte par une exception déclarée. Le reste, l'écart non expliqué, est la vraie dette ; il n'y a plus besoin d'une cible arbitraire comme « 80 % ».
- *Conformité* : part de cet usage qui respecte le contrat (bonnes props, tokens, accessibilité de composition).
- *Définition versionnée* : la méthode de calcul est publiée, les dénominateurs sont explicites, et chaque point de la courbe porte la version de la définition. Un changement de règle ne doit jamais passer pour une progression.
- *Ce qui compte comme DS* : défini à l'installation (package du DS, dossiers de composants internes), et les wrappers maison sont suivis jusqu'au composant du DS qu'ils enveloppent.

**Le contrat versionné** — le DS évolue en continu et les produits n'en utilisent pas tous la même version. Un contrat est donc extrait pour chaque version publiée, et chaque produit est évalué face à la version résolue dans son lockfile, pas face à la dernière. Sinon, une prop valide en v4 mais dépréciée en v5 devient un faux positif.

**Le retard de version** — ce qui compte n'est pas le numéro de version, mais ce que le retard coûte :

- *écart* : versions majeures de retard et temps écoulé depuis que la version utilisée a été remplacée ;
- *correctifs manquants* : correctifs d'accessibilité et de bugs publiés depuis, lus dans le changelog étiqueté du DS (« ce produit n'a pas reçu 3 correctifs d'accessibilité ») ;
- *coût de migration* : nombre d'usages qui casseraient face au contrat de la version suivante ;
- *politique de support* : une fenêtre définie par l'équipe DS (par exemple N-1 en majeure) ; rester en dehors est une exception comme une autre, avec justification et expiration.

## Scope

Le MVP est un bot de PR et une CLI pour React + TypeScript, avec un registre d'exceptions dès le départ ; il doit être utile en moins de 15 minutes sans configuration.

> Schéma « feuille de route · 4 versions, 3 portes » : non reproduit dans le dépôt.

Le plugin Figma passe avant le serveur MCP : c'est lui qui porte la gouvernance des décisions de design, là où l'écart coûte le moins cher. Il se limite aux exceptions et au lien avec le code : Figma couvre déjà la vérification des maquettes avec Check designs.

**Dans le MVP (v1)** :

- CLI `ds-guard scan` locale, hors ligne, en lecture seule, avec rapport HTML ;
- GitHub Action qui commente les PR, non bloquante par défaut (pas d'application hébergée au départ) ;
- contrat déduit automatiquement du package DS (types, tokens CSS/JSON, manifeste Storybook s'il existe), **pour chaque version publiée** ;
- règles générées depuis ce contrat et exportées aussi en plugin ESLint, pour un retour dans l'IDE sans les écrire à la main ;
- version du DS lue dans le lockfile de chaque produit ; règles évaluées face à cette version ;
- définition de ce qui compte comme DS (package, dossiers internes) et suivi des wrappers maison ;
- 10 à 15 règles : valeurs codées en dur → token, composants réimplémentés, props dépréciées, 5 à 8 règles d'accessibilité de composition ;
- registre d'exceptions (`ds-exceptions.yml` et annotations dans le code), premier argument du produit ;
- couverture expliquée et conformité par dépôt, avec la méthode publiée et la définition versionnée ;
- rapport de versions simple : version utilisée, retard, produits hors politique de support ;
- rapport d'une page destiné à la direction : couverture expliquée, tendance, exceptions actives, décisions attendues.

**Hors MVP, assumé** :

- Vue, Angular, Svelte, mobile natif ;
- GitLab, Bitbucket (l'Action GitHub couvre la majorité des cibles) ;
- tableau de bord SaaS multi-dépôts (le rapport local suffit pour valider la valeur) ;
- plugin Figma ;
- serveur MCP ;
- règles écrites par le client via une interface (fichier de configuration uniquement) ;
- toute règle nécessitant un rendu dans un navigateur, y compris une « couverture rendue » mesurée dans le DOM (option tardive : facile à construire, donc peu différenciante, et biaisée par la taille du DOM et le trafic) ;
- correctifs manquants et aperçu de mise à jour (ils nécessitent un changelog étiqueté et des contrats comparés : v4).

**Critères de sortie du MVP** :

- [ ] Fonctionne sur 3 DS open source avec une vraie application qui les utilise
- [ ] Moins de 10 % de faux positifs constatés sur ces trois cas
- [ ] Une personne extérieure l'installe seule en moins de 15 minutes
- [ ] Au moins 5 règles d'accessibilité de composition fiables
- [ ] Un dépôt de démo public avec des PR commentées

## Architecture et stack technique

Le cœur du système est une représentation intermédiaire commune (un arbre d'interface normalisé) : chaque surface est traduite vers cet arbre, et un seul moteur de règles l'analyse.

```
              ┌──────────── Contrat du DS ────────────┐
              │ types · tokens · manifeste · règles   │
              └───────────────────┬───────────────────┘
Maquette Figma ─┐                 ▼                  ┌─ Commentaire de PR
Sortie d'agent ─┼─▶ Arbre d'interface ─▶ Moteur de ──┼─ Réponse MCP
Pull request ───┘    normalisé           règles      ├─ Annotation Figma
                                           ▲         └─ Métriques agrégées
              ┌────────────────────────────┴──────────┐
              │ Registre d'exceptions                 │
              └───────────────────────────────────────┘
```

Ajouter une surface revient à écrire un adaptateur : le contrat, les règles, les exceptions et les rapporteurs ne changent pas.

**Le flux** :

1. **Extraction du contrat** depuis le package DS : types des props, tokens, manifeste Storybook, règles d'usage écrites par l'équipe DS. Un contrat par version publiée, mis en cache ; la version utilisée par un produit est lue dans son lockfile, et les wrappers maison sont suivis jusqu'au composant du DS.
2. **Adaptateurs de surface** : le JSX/TSX et le CSS d'une PR, l'arbre de nœuds d'une maquette Figma, la sortie d'un agent (qui est du code, donc le même adaptateur que la PR).
3. **Arbre d'interface normalisé** : nœuds `{composant, props, styles résolus, emplacement source}`, indépendants de la surface.
4. **Moteur de règles** : fonctions pures sur l'arbre et le contrat, filtrées par le registre d'exceptions.
5. **Rapporteurs** : commentaire de PR, rapport HTML, réponse MCP, annotation Figma, métriques agrégées.

| Brique | Choix | Raison |
| --- | --- | --- |
| Langage | TypeScript, Node 22 | L'écosystème cible (React, Figma, MCP) est en TS ; un seul langage pour toutes les surfaces |
| Parsing du code | TypeScript compiler API (`ts.createSourceFile`) — remplace oxc-parser, voir ADR 0016 | Même AST que l'extraction du contrat, validé par le spike ; isomorphe |
| Extraction des types du DS | TypeScript compiler API, react-docgen-typescript | Seul moyen fiable d'obtenir les props ; exécuté une fois par version du DS, pas à chaque scan |
| Styles | PostCSS (CSS, SCSS), analyse des templates CSS-in-JS, valeurs arbitraires Tailwind | Couvre les trois façons courantes de coder en dur une valeur |
| Format des tokens | Format DTCG (W3C Design Tokens Community Group) en interne ; adaptateurs Style Dictionary, Tokens Studio, variables CSS | Un format pivot standard plutôt qu'un format maison |
| Accessibilité | Règles statiques sur l'arbre (MVP) ; axe-core sur les stories rendues via Playwright (v3+) | Le statique couvre la composition sans navigateur ; le rendu vient plus tard |
| Détection de composants réimplémentés | Signature structurelle (balises, styles, props) comparée aux composants du DS | Heuristique explicable avant tout recours aux embeddings |
| Distribution | CLI npm, GitHub Action, plugin ESLint (retour dans l'IDE gratuit), serveur MCP (SDK TypeScript officiel), plugin Figma | Chaque surface réutilise le même paquet `core` |
| Monorepo | pnpm + Turborepo ; paquets `core`, `contract`, `rules`, `adapter-react`, `adapter-figma`, `cli`, `action`, `eslint-plugin`, `mcp`, `figma-plugin`, `dashboard` | Le moteur reste isomorphe : aucune dépendance Node dans `core` |
| Tableau de bord (v4) | Next.js, Postgres, authentification GitHub puis SSO, hébergement dans l'UE | Ne reçoit que des métriques agrégées ; l'hébergement UE compte pour les clients santé et finance |
| Corpus de test | DS open source : Primer (GitHub), Carbon (IBM), Polaris (Shopify), React Spectrum (Adobe), avec des applications qui les utilisent | Mesurer les faux positifs sur du vrai code avant tout client |

**Contrainte structurante** : `core` ne doit dépendre ni du système de fichiers ni du réseau, pour tourner à l'identique dans la CLI, dans la CI, dans un serveur MCP et dans le bac à sable d'un plugin Figma.

## Décisions et trade-offs

Quinze décisions structurantes, chacune avec ce qu'elle coûte ; elles sont révisables si les premiers partenaires les contredisent.

| # | Décision | Alternative écartée | Pourquoi | Ce qu'on accepte de perdre |
| --- | --- | --- | --- | --- |
| D1 | Se positionner sur la vérification en aval | Fournir le contexte DS aux agents | Figma, Storybook, Supernova et Knapsack occupent déjà l'amont | La visibilité d'un produit « IA » tendance |
| D2 | Point d'entrée : la PR | Le plugin Figma | Toute production, humaine ou agent, passe par une PR ; c'est mesurable dès le premier jour | La gouvernance des décisions de design arrive en v2 seulement |
| D3 | Exceptions dès le MVP | Un lint pur, plus simple | Sans exception, le bot met le dev en porte-à-faux et finit désactivé | Un peu de complexité et de concepts à expliquer dès le départ |
| D4 | Local d'abord, open source | SaaS hébergé qui lit le code | Le code des clients (santé, finance) ne peut pas sortir ; l'open source rend le test possible sans achat | Revenus plus tardifs ; il faut un vrai différenciateur payant |
| D5 | Un moteur isomorphe, un arbre commun | Un outil par surface | Les mêmes règles partout, sans dérive entre surfaces | Plus de travail d'abstraction au début ; l'arbre ne couvrira pas toutes les finesses de chaque surface |
| D6 | React + TypeScript uniquement | Multi-framework | C'est là que sont la plupart des DS outillés et des agents | Les clients Vue et Angular, pour l'instant |
| D7 | Analyse statique d'abord | Rendu dans un navigateur | Rapide, sans infrastructure, utilisable dans une PR en quelques secondes | Les règles qui dépendent du rendu (contraste réel, focus) |
| D8 | Peu de règles, à forte confiance | Couverture maximale | Un faux positif détruit la confiance plus vite qu'un oubli | Des écarts réels non détectés au début |
| D9 | Contrat déduit du package, enrichi à la main | Contrat entièrement écrit par l'équipe DS | Zéro configuration pour la première valeur | Les règles d'usage fines demandent quand même un effort de l'équipe DS |
| D10 | Commenter sans bloquer par défaut, sauf accessibilité | Tout bloquer | L'adoption passe par la confiance ; le blocage se décide par équipe | Un début plus lent sur la réduction effective des écarts |

**Ajoutées après la revue des retours d'expérience publiés (Mews, REI, OverlayQA, zeroheight)** :

| # | Décision | Alternative écartée | Pourquoi | Ce qu'on accepte de perdre |
| --- | --- | --- | --- | --- |
| D11 | Couverture expliquée + conformité, deux pourcentages | Un score de santé composite | Un pourcentage se comprend sans explication ; 100 % n'étant pas l'objectif, seul l'écart non expliqué est une dette | La possibilité de tout résumer en un seul chiffre |
| D12 | Contrat versionné, évalué face à la version du lockfile | Évaluer tous les produits face à la dernière version | Sinon, chaque produit en retard est noyé sous les faux positifs | Le coût d'extraire et de stocker un contrat par version |
| D13 | Analyse statique pour la couverture ; mesure au rendu reportée | Marquer le DOM au build et compter au rendu, comme Mews | Le rendu est facile à imiter, dépend de la taille du DOM et du trafic, et demande d'instrumenter la production | Les états dynamiques (modales, menus) moins bien vus |
| D14 | Un rapport pour la direction dès le MVP | Un tableau de bord réservé à l'équipe DS | Le principal frein à l'adoption est le manque de mandat, qui se décide au-dessus de l'équipe DS | Du temps de développement pris sur les règles |
| D15 | Plugin Figma limité aux exceptions et au lien avec le code | Une vérification complète des maquettes | Figma *Check designs* le fait déjà ; se battre sur ce terrain est perdu d'avance | La promesse d'un outil de design complet |

**Questions de design encore ouvertes** :

- Où vit le registre d'exceptions quand il concerne une maquette ET du code : dans le dépôt, dans Figma, ou dans un service ?
- Faut-il une notion de « budget d'exceptions » par équipe dès la v2, ou laisser chaque organisation le gérer ?
- Comment relier un écran Figma à son code de manière fiable : Code Connect, identifiant dans le ticket, convention de nommage ?

## Modèle économique et mise sur le marché

Open core : le moteur, la CLI et l'Action sont gratuits et open source ; on paie pour l'historique, la vue d'organisation, les surfaces avancées et la conformité.

| Offre | Contenu | Pour qui | Prix indicatif |
| --- | --- | --- | --- |
| Open source | Moteur, CLI, GitHub Action, plugin ESLint, règles de base, exceptions dans le dépôt | Devs, petites équipes, évaluation | Gratuit |
| Team | Tableau de bord multi-dépôts, historique, plugin Figma, serveur MCP hébergé, règles personnalisées | Équipes DS de scale-ups | À valider, par dépôt ou par contributeur actif |
| Enterprise | SSO, hébergement UE ou sur site, rapports de conformité accessibilité (EAA, RGAA), budgets d'exceptions, support | Grands comptes, secteurs régulés | Sur devis |

**Cible initiale** : scale-ups de 50 à 500 devs avec une équipe DS dédiée, en React. Marché de niche (quelques milliers d'entreprises dans le monde), mais des clients avec un vrai budget et une douleur avérée.

**Échelle de confiance pour entrer chez un client** :

1. Démo publique : vidéo et dépôt de démo, sans rien installer.
2. CLI en local sur le poste d'un membre de l'équipe DS, hors ligne.
3. GitHub Action dans leur CI, sur un dépôt bac à sable puis une vraie application.
4. Offre payante, avec revue de sécurité et accord de traitement des données.

**Canaux** : partenaires de conception (3 à 5 entreprises, gratuit contre retours), contenus techniques (articles, conférences DS), communauté open source, réseau DS francophone. L'argument d'achat porte sur la boucle mesure → décision → correction et sur la preuve de valeur pour la direction, pas sur le lint ni sur un chiffre de couverture, désormais banalisé. L'offre payante ne sera créée qu'après des usages réels de la version open source : aucune source publique ne montre encore de volonté de payer.

## Métriques de succès

La métrique nord est le taux de constats corrigés ou couverts par une exception : elle dit à la fois si l'outil est écouté et si le DS progresse.

| Niveau | Métrique | Cible indicative | Ce qu'elle révèle |
| --- | --- | --- | --- |
| Produit (nord) | Part des constats corrigés ou couverts par une exception | > 70 % | Les gens agissent sur ce que l'outil dit |
| Confiance | Taux de constats rejetés comme faux positifs | < 10 % | La fiabilité des règles |
| Activation | Temps entre installation et premier rapport utile | < 15 min | La promesse zéro configuration |
| Rétention | Dépôts où l'Action est encore active après 60 jours | > 60 % | L'outil n'a pas été désactivé par agacement |
| Valeur client | Écart non expliqué (100 % − couverture expliquée) | En baisse chez chaque partenaire sur un trimestre | La dette réelle se résorbe, sans cible arbitraire |
| Valeur client | Dette d'accessibilité de composition | En baisse | L'argument de conformité tient |
| Valeur client | Produits dans la politique de support des versions ; correctifs d'accessibilité manquants | En hausse ; en baisse | Le retard de version est piloté, pas subi |
| Gouvernance | Exceptions expirées non traitées | Proche de 0 | La dette consciente ne devient pas oubliée |
| Business | Partenaires de conception actifs | 3 à 5 au mois 6 | Le problème est assez douloureux pour qu'on y consacre du temps |

Les cibles sont des hypothèses de départ, à recalibrer avec les premiers partenaires. Aucune n'est un objectif de couverture absolu : les retours publiés (80 % chez OverlayQA, 60 % jugé « correct » chez Mews) montrent que ces seuils sont arbitraires.

## Risques et questions ouvertes

Le risque principal est l'absorption par une plateforme ; la parade est de rester transversal et de vendre la mesure plutôt que le lint.

| Risque | Probabilité | Impact | Parade |
| --- | --- | --- | --- |
| Figma relie la vérification au code (*Check designs*, sources de code GitHub) | Forte | Fort | Rester sur ce que Figma ne fait pas : exceptions, PR, agents, versions ; capitaliser sur l'historique |
| Volonté de payer non démontrée : les praticiens s'en sortent avec des outils gratuits | Forte | Fort | Open source d'abord ; ne créer l'offre payante qu'après des usages réels ; vendre la preuve de valeur, pas le lint |
| Les équipes construisent leur propre outil avec un LLM (Honeycomb, REI) | Forte | Moyen | Vendre la fiabilité (méthode publiée, définition versionnée), la gouvernance et les versions, pas le chiffre |
| Sans mandat, l'outil produit des rapports que personne n'applique | Moyenne | Fort | Rapport pour la direction dès le MVP ; exceptions avec propriétaire et expiration |
| Faux positifs qui agacent les devs | Forte au début | Fort | Peu de règles, corpus de test réel, contrat par version, non bloquant par défaut, signalement d'un faux positif en un clic |
| Aucun lien démontré entre couverture et résultats | Moyenne | Fort | Le mesurer avec les premiers utilisateurs (bugs d'interface, accessibilité, délai de livraison) ; en faire l'argument commercial |
| Marché trop étroit pour un SaaS | Moyenne | Moyen | Prix élevé par compte ; élargir ensuite aux agences et aux éditeurs de DS |
| Refus d'accès au code | Forte en secteur régulé | Fort | Local d'abord, open source, métriques agrégées uniquement |
| Diversité des DS (CSS-in-JS, Tailwind, tokens maison) | Forte | Moyen | Adaptateurs et format pivot DTCG ; refuser poliment ce qui sort du périmètre |
| Analytics Figma réservés aux offres Organization et Enterprise | Certaine | Moyen | Le plugin analyse le fichier ouvert lui-même, sans dépendre des analytics de bibliothèque |
| Changelog du DS non étiqueté | Forte | Moyen | Convention légère proposée (a11y, fix, breaking) ; sans elle, le retard reste mesuré en versions et en temps |
| Porteur seul | Certaine | Moyen | Scope minimal, open source pour les contributions, premiers utilisateurs comme partenaires |

**Questions ouvertes à trancher avec les premiers partenaires** :

- [ ] Qui achète réellement : le lead DS, la direction design, ou l'engineering ?
- [ ] La couverture expliquée est-elle un indicateur que la direction suivrait, ou un chiffre de plus ?
- [ ] Les équipes acceptent-elles de déclarer des exceptions, ou le vivent-elles comme de la bureaucratie ?
- [ ] Le plugin Figma doit-il venir avant le serveur MCP ?
- [ ] Quelle part des écarts réels vient des agents aujourd'hui, et dans 12 mois ?
- [ ] Une couverture plus élevée améliore-t-elle réellement les résultats (bugs, accessibilité, délai de livraison) ? Personne ne l'a démontré.
- [ ] Quelle politique de support des versions les équipes DS appliquent-elles réellement, et qui la fait respecter ?
- [ ] Comment détecter qu'un fichier Figma utilise une version ancienne de la bibliothèque, avec les API disponibles ?
- [ ] Quel nom définitif pour le produit ?

**Sources**

- [Storybook MCP — documentation](https://storybook.js.org/docs/ai/mcp/overview) · [Storybook 10.3](https://storybook.js.org/blog/storybook-10-3/)
- [Figma MCP server](https://developers.figma.com/docs/figma-mcp-server/) · [Analytics du DS dans Figma](https://www.figma.com/best-practices/make-the-most-of-design-system-analytics/)
- [Supernova pour les agents](https://www.supernova.io/for-ai) · [Knapsack lève 10 M$ (TechCrunch)](https://techcrunch.com/2025/10/09/knapsack-picks-up-10m-to-help-bridge-the-gap-between-design-and-engineering-teams)
- [Omlet 1.0](https://blog.zeplin.io/meet-omlet-component-analytics-for-developers) · [FigmaLint](https://github.com/southleft/figmalint/wiki) · [Buoy](https://cdn.jsdelivr.net/gh/buoy-design/buoy@main/README.md)
- Mesure de l'adoption : [Mews](https://developers.mews.com/design-system-adoption-metric-building/) · [REI, Maya Hampton](https://www.designsystemscollective.com/measuring-design-system-adoption-building-a-visual-coverage-analyzer-b5d9ae410d42) · [zeroheight](https://zeroheight.com/blog/how-to-track-adoption-in-your-design-system/) · [Omlet](https://omlet.dev/blog/how-leaders-measure-design-system-adoption/) · [Supernova, 9 métriques](https://www.supernova.io/blog/9-design-system-metrics-that-matter) · [OverlayQA](https://overlayqa.com/blog/audit-design-system-adoption/) — contenus d'éditeurs ou retours d'équipes sur leur propre DS, à lire avec recul
