# Sept familles, une seule interface — faisabilité et UI

_Août 2026. Suite de [`2026-notch-masking-research.md`](./2026-notch-masking-research.md)._

Familles retenues : **01** bandeau plein, **03** fondu dithéré, **07** objet suspendu,
**08** décor organique, **09** camouflage par contenu, **11** trame dégressive, **12** génératif pur.

Version avec maquettes : [`2026-feasibility-and-ui.html`](./2026-feasibility-and-ui.html).

---

## 1. Le coût est dans le socle, pas dans les familles

Prises isolément, cinq des sept familles se codent en une à trois journées. Ce qui coûte cher, ce
sont **cinq briques partagées** à écrire une fois. Ensuite, ajouter une famille devient une soirée.

| Socle | Contenu | Requis par | Effort |
| ----- | ------- | ---------- | ------ |
| **A — Géométrie** | Table des appareils + mesure runtime de la safe area et du modèle. Expose une boîte `{x, y, w, h, forme}` en points et en pixels. | les 7 | ~3 j |
| **B — Recette & moteur** | Un JSON décrit le fond ; un même moteur le rend à l'écran _et_ hors écran en pixels natifs. La parité aperçu / export est non négociable. | les 7 | ~4 j |
| **C — Couche SkSL** | Trois shaders réutilisables : dithering ±1 LSB, bruit fractal (fbm), interpolation de dégradé en lumière linéaire. | 03, 08, 09, 12 | ~3 j |
| **D — Rig procédural** | PRNG à graine + _garantie de couverture_ : un socle noir dérivé de la découpe, posé sous le décor. | 07, 08, 11, 12 | ~2 j |
| **E — Analyse d'image** | Sous-échantillonnage 96×208, `readPixels()`, table de sommes cumulées, solveur de cadrage. | 09 seule | ~3 j |

**Le socle E est le seul à usage unique, et le plus risqué.** C'est l'argument le plus net pour
garder la famille 09 hors du premier jet.

---

## 2. Les sept familles, notées

Quatre axes sur 5 : **rendu** (difficulté de dessin), **paramétrage** (nombre et subtilité des
réglages), **contenu** (direction artistique en amont), **risque** (ce qui peut ne pas marcher).
Estimations hors socles A et B.

| #  | Famille | Rendu | Param. | Contenu | Risque | Verdict | Effort |
| -- | ------- | :---: | :----: | :-----: | :----: | ------- | ------ |
| 01 | Bandeau plein | 1 | 1 | 1 | 1 | **Trivial** | ≈ 0,5 j |
| 11 | Trame dégressive | 2 | 2 | 1 | 1 | **Faible** | ≈ 1 j |
| 03 | Fondu dithéré | 3 | 3 | 1 | 3 | **Moyen** | ≈ 2 j + socle C |
| 12 | Génératif pur | 4 | 2 | 3 | 1 | **Moyen** | ≈ 3 j + socle D |
| 08 | Décor organique | 3 | 3 | 3 | 1 | **Moyen** | ≈ 3 j |
| 07 | Objet suspendu | 3 | 2 | 5 | 2 | **Élevé — coût artistique** | ≈ 2 j + 0,5 j / objet |
| 09 | Camouflage par contenu | 4 | 3 | 2 | 5 | **Élevé — risque produit** | ≈ 5 j + socle E |

### 01 · Bandeau plein — trivial

Un `Path` Skia avec deux coins bas arrondis, rempli en `#000`. Le seul vrai piège est le **choix de
la hauteur par défaut** : sur encoche elle vaut la hauteur de la découpe, sur Dynamic Island il faut
descendre jusqu'à la safe area, sinon il reste 22 pt de photo coincés sous l'île. Rayon par défaut
aligné sur celui de l'île (≈ 18 pt) : le bandeau se lit alors comme une extension du matériel.

**Paramétrage** — pas de curseur pour la hauteur : on attrape le bord bas du bandeau et on le tire.
Trois points d'accroche magnétiques avec retour haptique (_ras de la découpe_, _bas de la safe
area_, _libre_). Un unique curseur pour le rayon.

### 03 · Fondu dithéré — moyen

Un shader SkSL d'une quinzaine de lignes : dégradé calculé analytiquement, **interpolé en lumière
linéaire** puis ré-encodé — un fondu vers le noir interpolé en sRGB plonge trop vite et se voit. Le
dithering s'ajoute avant la quantification 8 bits : bruit triangulaire d'amplitude 1/255 dérivé des
coordonnées du fragment ; alternative plus sûre, une tuile de bruit bleu 64×64 en additif.

**Risque réel** : la validation ne peut se faire qu'à l'œil, sur dalle OLED, à faible luminosité et
en pièce sombre. Un simulateur ne dira rien.

**Paramétrage** — deux poignées tirables sur le fond : fin du noir absolu, fin du fondu. La première
**bute** au bas de la découpe avec un cran haptique. Courbe en trois pastilles (_linéaire_,
_adouci_, _en S_) plutôt qu'un éditeur de bézier.

### 07 · Objet suspendu — élevé (coût artistique)

Chaque objet est un **gabarit paramétrique**, pas un dessin figé : une ancre partant du bord haut,
un corps qui s'étire pour contenir la boîte de découpe, des appendices décoratifs. Le même périscope
doit fonctionner sur une île de 125×37 et un poinçon de 26×26 — un SVG importé ne s'étire pas
correctement, il faut coder les tracés en fonction de la boîte.

**Le facteur limitant n'est pas technique, il est humain** : chaque objet demande une vraie idée.
Six bons objets valent mieux que vingt médiocres, et ils s'ajoutent après le lancement.

**Paramétrage** — galerie horizontale d'objets appliqués en direct ; un seul curseur (la taille,
c'est-à-dire la marge entre le corps et la découpe) ; une bascule miroir pour les découpes décalées.
Les parties décoratives se déplacent au doigt, la partie couvrante reste verrouillée.

### 08 · Décor organique — moyen

Un tracé porteur (branche, câble, guirlande) traversant l'écran, puis des éléments distribués le
long avec un générateur aléatoire **à graine** — même graine, même résultat, donc partageable.

**L'astuce qui supprime tout risque** : on pose d'abord un socle noir de la forme exacte de la
découpe, puis on éparpille le feuillage par-dessus. La couverture est garantie par construction ;
l'organique n'a plus qu'à faire joli.

**Paramétrage** — six motifs en pastilles (_branche, oiseaux, câble, coulure, guirlande, fumée_), un
curseur de densité, et **un bouton « mélanger »** : une seule commande donne une infinité de
résultats, l'utilisateur tape jusqu'à ce que ça lui plaise sans rien comprendre au système.

### 09 · Camouflage par contenu — élevé (risque produit)

- **Placement automatique** : on redessine la photo en 96×208, on lit les pixels, on construit une
  table de sommes cumulées, puis on teste quelques centaines de cadrages en notant la luminance
  moyenne _et_ l'écart-type sous la découpe. Quelques millisecondes.
- **Assombrissement local** : un simple fondu vers le noir laisse une tache floue. La bonne méthode
  remonte le point noir localement — une courbe, pas un calque — pour que la texture de la photo
  meure naturellement.
- **Affinage** : la distance de fondu se module par la luminance locale. Là où la photo est déjà
  sombre, la transition est courte et invisible ; là où elle est claire, elle s'allonge.
- **La vérité qui fait mal** : la zone sous la découpe doit finir en `#000000` exact. Aucune analyse
  ne change ça. Le solveur ne fait que rendre ce cœur noir _petit et entouré de presque-noir_.

**Paramétrage** — un bouton et un verdict honnête. « Caler automatiquement » lance le solveur et
annonce : _excellent_, _correct_, ou _cette photo ne s'y prête pas_. Sur un échec, l'app propose
elle-même la famille 03 en repli, sur le même cadrage.

### 11 · Trame dégressive — faible

Une boucle de rectangles pour les rayures ; un shader pour la variante en trame de points, où le
rayon décroît avec la distance. **La géométrie ne part pas du haut de l'écran, elle part de la
découpe** : la première bande est forcée à la contenir, tout le reste en dérive — ce qui ne laisse
que deux paramètres libres. Aucun réglage ne produit un résultat raté.

**Paramétrage** — trois types en pastilles (_rayures, grille, points_), deux curseurs (pas,
décroissance), six préréglages en accès direct.

### 12 · Génératif pur — moyen

Un shader SkSL de dégradé maillé : mélange bilinéaire de quatre à six couleurs, déformé par un bruit
fractal. **Préférable à des dégradés radiaux flous** — un flou à 1290×2796 coûte cher en mémoire, un
shader ne coûte rien. Le puits de noir est trivial ici : on contrôle le fond, donc aucun cas d'échec
possible. Le vrai travail est le choix des **palettes** : du goût, pas du code.

**Paramétrage** — c'est l'écran de premier lancement. L'app s'ouvre sur un fond déjà généré, déjà
valide : zéro écran vide, zéro permission demandée, enregistrable en deux touchers. Une rangée de
palettes, un bouton mélanger, un curseur de grain. Chaque résultat porte une graine et peut être
régénéré pour un autre appareil, plus tard, à n'importe quelle résolution.

---

## 3. Ordre de construction

Pas un classement par importance : une chaîne de dépendances. Chaque étape livre une brique dont la
suivante a besoin, et chaque étape produit une app qui marche.

1. **01 · Bandeau plein** — prouve les socles A et B de bout en bout, sur la famille où toute erreur
   d'alignement se voit immédiatement. `+0,5 j`
2. **11 · Trame dégressive** — quasi gratuite une fois 01 fait. `+1 j`
3. **03 · Fondu dithéré** — force à écrire le socle C. Le banding se règle ici, une fois pour
   toutes. `+2 j & socle C`
4. **12 · Génératif pur** — réutilise C, ajoute D. Livre le premier lancement sans photo ni
   permission. `+3 j & socle D`
5. **08 · Décor organique** — le rig existe déjà ; il ne reste que la direction artistique. `+3 j`
6. **07 · Objet suspendu** — même rig, contrainte de dessin en plus. Ajoutable objet par objet après
   le lancement. `+2 j puis 0,5 j / objet`
7. **09 · Camouflage par contenu** — socle E, à usage unique. À traiter comme un projet séparé.
   `+5 j & socle E`

**Coupe naturelle après l'étape 4** : socles A à D, quatre familles robustes, aucune dépendante d'un
travail graphique. C'est une app complète et honnête. Les étapes 5 à 7 sont ce qui la rend
remarquable — et peuvent arriver après.

---

## 4. L'interface : un écran, cinq gestes

L'app n'a qu'un seul objet — le fond d'écran en cours — et une seule sortie — une image. Toute
navigation ajoutée serait du décor. D'où : **pas d'onglets, pas de menu, pas de compte, un seul
écran.** Le fond occupe 100 % de la surface, les commandes flottent dessus en verre, et l'essentiel
du réglage se fait en touchant directement le fond.

Le point qui fait tout basculer : l'aperçu n'est pas une maquette de téléphone dans un téléphone.
C'est le fond, plein écran, **sous la vraie découpe de l'appareil**. On juge le résultat en le
regardant, pas en l'imaginant.

### Vocabulaire gestuel

| Geste | Effet |
| ----- | ----- |
| glisser ←→ | changer de famille d'effet, comme un filtre d'appareil photo |
| pincer | recadrer et repositionner la photo |
| tirer une poignée | régler l'effet directement sur le fond |
| appui long | masquer toute l'interface pour juger |
| secouer | nouvelle variation, sur les familles génératives |

### Anatomie de l'écran, de bas en haut

1. **Barre d'action** en verre — `Source` · nom de l'effet + points de position · `Enregistrer`.
2. **Bande de réglages** — les deux ou trois commandes de l'effet courant, toujours visibles.
3. **Le fond**, plein écran, avec les poignées de manipulation directe posées dessus.

### Feuille d'enregistrement

`Définir comme fond d'écran` (primaire, via App Intent / Raccourci — évite l'éditeur de recadrage
d'iOS) · `Enregistrer dans Photos` · `Partager` · et le **format**, seul endroit où la question
« pour quel téléphone ? » se pose, donc seul endroit où elle est posée.

---

## 5. Une règle : trois réglages maximum

Toutes en direct, toutes réversibles, sans jamais afficher de valeur numérique — sauf là où le
nombre veut dire quelque chose. Ce qui ne rentre pas dans trois commandes ne rentre pas dans l'app.

| Famille | Commande 1 | Commande 2 | Commande 3 | Contrainte dure |
| ------- | ---------- | ---------- | ---------- | --------------- |
| **01** Bandeau | bord tiré à la main | rayon | — | plancher sous la découpe |
| **03** Fondu | poignée « fin du noir » | poignée « fin du fondu » | courbe (3 choix) | poignée 1 ≥ bas de découpe |
| **07** Objet | galerie d'objets | taille | miroir | corps ⊇ découpe + marge |
| **08** Décor | motif (6 choix) | densité | mélanger | socle de couverture invisible |
| **09** Camouflage | caler automatiquement | étendue | douceur | cœur en noir absolu |
| **11** Trame | type (3 choix) | pas | décroissance | bande 1 ⊇ découpe |
| **12** Génératif | palette | mélanger | grain | — |

**Les contraintes dures ne sont jamais des messages d'erreur.** Une poignée qui atteint le bas de la
découpe ne se bloque pas en silence : elle bute, vibre légèrement, et affiche une ligne.
L'utilisateur apprend la règle physique en la touchant, sans qu'on la lui explique.

---

## 6. Ce que je couperais

- **La bibliothèque de fonds embarqués.** La v1 en avait une ; elle pèse lourd, se démode, et pose
  des questions de droits. La famille 12 la remplace par un générateur infini qui ne pèse rien.
- **Tout écran de réglages.** Le format d'export va dans la feuille d'enregistrement, la calibration
  se déclenche après le premier export, il ne reste rien à régler.
- **L'écran d'aide.** Remplacé par les butées haptiques et une seule phrase dans la feuille
  d'export, au moment où elle sert.
- **La famille 09 dans la v1.** C'est la plus belle promesse et la seule qui peut échouer sur la
  photo de l'utilisateur. Elle mérite d'arriver seule, quand elle sera vraiment bonne.
