# Masquer l'encoche, neuf ans après — note de recherche

_Août 2026. Étude préalable à une éventuelle refonte de HideTheNotch._

Version interactive (aperçus des 13 familles, commutables encoche / Dynamic Island / poinçon) :
[`2026-notch-masking-study.html`](./2026-notch-masking-study.html).

---

## 1. Ce que faisait la v1 (2017)

789 lignes. Un `ImageBackground` plein écran, des PNG posés en `position: absolute; top: 0`
par-dessus, puis `captureRef()` de _react-native-view-shot_ pour photographier la vue et la pousser
dans la pellicule. Quatre masques bitmap sans paramètres : `Rounded Notch`, `Rounded Slim Notch`,
`Hard Notch`, `Hard Slim Notch`.

C'était la bonne réponse à l'époque : un seul appareil au monde avait une encoche, et
`src/platform.js` le décrivait en huit lignes (`isIPhoneX = height === 812 && width === 375`).

**Ce qui a bien vieilli**

- L'intuition de base : sur OLED, du `#000000` posé à côté d'une découpe la fait disparaître.
- Le geste produit : on n'installe pas un thème, on **exporte une image** que l'utilisateur pose.
- Catalogue de fonds embarqués + import photo perso, avec crédit auteur affiché.

**Les cinq plafonds de verre**

1. **Un seul appareil connu** — chaque nouvel iPhone désalignait le masque.
2. **Masques bitmap** — ni hauteur, ni rayon, ni couleur paramétrables.
3. **Export = capture d'écran** — la photo source est réduite à la taille de l'écran _avant_ d'être
   capturée ; pas de recadrage ni de zoom (le `ScrollView` pinch est commenté dans `App.js`).
4. **Aucune Dynamic Island** — elle n'existait pas.
5. **Le dernier kilomètre non traité** — rien n'empêche iOS de re-zoomer le fond au moment de le
   poser, ce qui casse l'alignement au pixel.

---

## 2. Pourquoi l'astuce marche (et quand elle casse)

Tous les iPhone à découpe sont OLED : un pixel noir est un pixel _éteint_, optiquement identique à
la dalle autour de la caméra. Trois règles non négociables en découlent :

1. **Noir absolu, pas « presque noir »** — `#010101` se voit sur OLED en pièce sombre.
2. **PNG obligatoire** — le JPEG produit des artefacts de bloc à la frontière noir / image.
3. **Dégradés dithérés** — un fondu vers le noir en 8 bits fait du _banding_ franc ; il faut
   injecter un bruit de ±1 LSB.

### Géométrie des découpes

| Génération                        | Écran (pt)     | Découpe        | Position               | Safe area haute |
| --------------------------------- | -------------- | -------------- | ---------------------- | --------------- |
| Encoche — iPhone X → 11 Pro       | 375 × 812 @3x  | ≈ 209 × 30 pt  | collée au bord         | 44 pt           |
| Encoche — iPhone 12 → 14 Plus     | 390 × 844 @3x  | ≈ 209 × 32 pt  | collée au bord         | 47 pt           |
| Dynamic Island — 14 Pro → 17      | 393 × 852 @3x  | ≈ 125 × 37 pt  | flottante, ≈ 11 pt     | 59 pt           |
| Poinçon — iPhone 18 Pro (rumeur)  | —              | ≈ 13,5 mm      | décalé vers la gauche  | —               |

Apple ne publie pas la géométrie exacte des découpes : ces valeurs sont des ordres de grandeur. En
pratique l'app doit **mesurer** l'appareil courant (safe area + modèle) et garder une table de
secours pour générer un fond destiné à un _autre_ téléphone.

La différence structurante : l'encoche **touche le bord haut** (un simple bandeau la supprime), la
Dynamic Island **flotte** (elle ouvre des designs impossibles avant, mais un bandeau plein y gaspille
plus de surface).

---

## 3. Treize familles de masquage

Chaque famille est un **générateur** — une fonction qui prend la géométrie de la découpe et rend une
pile de calques — et non une image.

| #   | Famille                    | Principe                                                                                  | Portée          | Coût            |
| --- | -------------------------- | ----------------------------------------------------------------------------------------- | --------------- | --------------- |
| 01  | **Bandeau plein**          | Aplat noir jusque sous la découpe. Paramètres : hauteur, rayon des coins intérieurs.        | universel       | trivial         |
| 02  | **Faux cadre**             | Bandeau + bordure basse et latérale : l'écran devient une image encadrée.                   | universel       | trivial         |
| 03  | **Fondu dithéré**          | Aplat sur la découpe puis fondu vers la photo. Nécessite un bruit de ±1 niveau.             | universel       | moyen           |
| 04  | **Dôme**                   | Le bandeau se creuse en cloche là où se trouve la découpe : on ne perd que le nécessaire.   | universel       | faible          |
| 05  | **Pilule étendue**         | Une pilule noire plus large centrée sur la découpe : elle se lit comme un composant d'UI.   | île / poinçon   | faible          |
| 06  | **Écho symétrique**        | On duplique la découpe en bas de l'écran : deux marques identiques = composition voulue.    | universel       | faible          |
| 07  | **Objet suspendu**         | Périscope, abat-jour, nacelle : une tige part du bord, le corps noir enveloppe la découpe.  | île / poinçon   | dessin          |
| 08  | **Décor organique**        | Branche, feuillage, nuée d'oiseaux, coulure. Variations procédurales : chaque fond diffère. | universel       | dessin + génératif |
| 09  | **Camouflage par contenu** | Analyse de luminance, recadrage qui amène la zone sombre sous la découpe, assombrissement local du delta. | universel | traitement d'image |
| 10  | **Lentille Liquid Glass**  | On habille la découpe en composant iOS 26 : flou, réfraction, liseré spéculaire.            | île / poinçon   | shader          |
| 11  | **Trame dégressive**       | Bandes noires qui s'espacent en descendant ; la découpe devient une cellule du motif.       | universel       | génératif       |
| 12  | **Génératif pur**          | Dégradé maillé + bruit fractal + puits de noir. Zéro asset, zéro question de droits.        | universel       | génératif       |
| 13  | **Contour assumé**         | L'inverse : un liseré lumineux souligne la découpe. Double le catalogue gratuitement.       | universel       | trivial         |

Sept de ces treize familles sont **infaisables** avec l'architecture de 2017 : elles demandent des
dégradés dithérés, des modes de fusion, du bruit procédural, ou un export à une résolution
supérieure à celle de l'écran.

---

## 4. Le pipeline nécessaire

Le changement structurant tient en une phrase : **arrêter de photographier une vue React Native.**

| Étage       | Choix                                                                                                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Modèle**  | Une **recette JSON**, pas une image : source (photo / dégradé / procédural), transformation (recadrage, zoom, rotation), pile de masques paramétrés, géométrie de l'appareil cible. Sérialisable, donc partageable et re-générable pour un autre téléphone. |
| **Aperçu**  | `@shopify/react-native-skia` rend la recette à l'échelle écran, avec pincer-glisser via Reanimated 4 + Gesture Handler. Dégradés, bruit fractal et shaders personnalisés sont natifs.                                   |
| **Export**  | `Skia.Surface.MakeOffscreen(1290, 2796)` rejoue la **même** recette à la résolution réelle du device, puis `makeImageSnapshot()` → `encodeToBytes(PNG)` → `expo-media-library`. Qualité 1:1, indépendante de l'écran d'aperçu. |
| **Coque**   | Expo SDK 56 (RN 0.85, Hermes v1, nouvelle archi). `expo-glass-effect` pour la vraie barre d'outils Liquid Glass (UIVisualEffectView natif) sur iOS 26+, repli `expo-blur` en dessous. `@expo/ui` pour les feuilles SwiftUI, `expo-haptics` au calage. |
| **Android** | Même moteur Skia, mêmes recettes. Et `WallpaperManager.setBitmap()` pose le fond **directement**, sans galerie ni recadrage : l'obstacle principal d'iOS n'existe pas.                                                   |

---

## 5. Le vrai problème : poser le fond d'écran

Un masque au pixel près ne sert à rien si iOS le décale en le posant. C'est là que la v1 s'arrêtait
(« mets-le en _Still_ et aligne-le en bas ») et c'est là que se joue la différence entre un jouet et
un outil.

**Ce qui casse l'alignement**

- **Zoom de perspective** — iOS agrandit le fond d'environ 4 % pour la parallaxe au gyroscope.
- **Scènes spatiales (iOS 26)** — séparation sujet / fond par profondeur, puis parallaxe : désalignement garanti.
- **Effet de profondeur** sur l'écran verrouillé.
- **L'éditeur de recadrage** qui s'ouvre à chaque « Choisir une photo » et invite au pincement.

**Les parades**

1. **Exporter à la résolution native exacte** — iOS affiche alors l'image 1:1 par défaut.
2. **Une App Intent + un Raccourci fourni** : l'action _Définir le fond d'écran_ de Raccourcis pose
   l'image sans ouvrir l'éditeur. Un seul geste. **À valider en conditions réelles**, mais c'est le
   différenciateur le plus fort du projet.
3. **Une mire de calibration** : un fond de test qui laisse l'utilisateur mesurer et corriger un
   décalage résiduel, mémorisé ensuite pour tous ses exports.
4. **Des instructions ciblées par version d'iOS**, pas un texte générique.

---

## 6. Est-ce que ça vaut le coup ?

**Le calendrier joue pour nous.** L'iPhone 18 Pro est attendu en septembre 2026 avec une découpe
nettement réduite et, selon les fuites, _décalée vers la gauche_. Un bandeau noir centré devient
absurde sur une découpe asymétrique : toute la catégorie redevient un problème de design ouvert.

**La concurrence est faible mais installée.** Le App Store est plein de galeries de fonds pour
Dynamic Island — abonnement, pubs, 90 % du contenu payant, aucune notion de géométrie réelle. Aucune
ne propose un _générateur_ : recette paramétrée, export en résolution native, photo perso. C'est le
créneau, et il est cohérent avec ce que HideTheNotch était déjà en 2017.

**La question à trancher d'abord** n'est pas « quel framework » mais **combien de familles au
lancement**. Trois bien faites (bandeau paramétrique, fondu dithéré, génératif) valent mieux que
treize approximatives — et les familles 05 à 09, celles qui demandent du dessin, sont ce qui fera
parler de l'app.

---

## Sources

- [Expo — GlassEffect](https://docs.expo.dev/versions/latest/sdk/glass-effect/) ·
  [Expo SDK 55](https://expo.dev/changelog/sdk-55) · [Expo SDK 56](https://expo.dev/changelog/sdk-56)
- [React Native Skia — Offscreen Canvas](https://shopify.github.io/react-native-skia/docs/canvas/offscreen) ·
  [Shading Language](https://shopify.github.io/react-native-skia/docs/shaders/overview/)
- [iOS 26 Lock Screen — MacRumors](https://www.macrumors.com/guide/ios-26-lock-screen/)
- [iPhone 18 Pro : Dynamic Island réduite — AppleInsider](https://appleinsider.com/articles/26/02/24/iphone-18-pro-again-rumored-to-feature-a-smaller-redesigned-dynamic-island) ·
  [Cotes du poinçon — GSMArena](https://m.gsmarena.com/iphone_18_pro_series_dynamic_island_cutout_dimensions_leaked-news-71222.php)
- [Notch Remover (App Store)](https://apps.apple.com/us/app/notch-remover/id1277467873) ·
  [Notcho — The Next Web](https://thenextweb.com/news/this-wallpaper-app-makes-your-iphone-xs-notch-disappear)
- [Android WallpaperManager](https://developer.android.com/reference/android/app/WallpaperManager)
