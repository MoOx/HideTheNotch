# Hide The Notch v2

Réécriture Expo / Skia de l'app de 2017. Trois familles de masquage pour l'instant :
**bandeau plein**, **trame dégressive**, **fondu dithéré**.

Expo SDK 57 · React Native 0.86 · React 19.2 · `@shopify/react-native-skia` 2.6

---

## Ce qui change par rapport à la v1

La v1 photographiait l'arbre de vues React Native avec `react-native-view-shot` : la photo source
était réduite à la taille de l'écran **avant** d'être capturée, et l'export était donc plafonné à la
résolution de l'écran. Ici, une **recette** est décrite en JSON et rendue par une seule fonction,
toujours en points ; l'aperçu la joue à l'échelle 1, l'export applique `canvas.scale(densité)` avant
de l'appeler.

```
src/recipe/types.ts     la recette (source + masque), sérialisable
src/render/draw.ts      drawRecipe(canvas, ctx) — l'unique chemin de dessin
src/render/export.ts    surface hors écran en pixels natifs → PNG → pellicule
```

La parité aperçu / export est donc **structurelle** et non surveillée : il n'y a qu'un chemin.
Corollaire gratuit : rien n'oblige la cible à être le téléphone qu'on tient, d'où le sélecteur
d'appareil dans la feuille d'enregistrement.

## Les deux propriétés qui font tout tenir

1. **Le noir sous la découpe est absolu.** Sur OLED un pixel noir est éteint, donc optiquement
   identique à la dalle autour de la caméra. `#010101` se voit en pièce sombre. L'export est en PNG :
   le JPEG produit des artefacts de bloc à la frontière noir / image, ce qui fait réapparaître la
   découpe.

2. **Le fondu est dithéré, et au bon endroit.** Le shader ne pose pas du noir semi-transparent
   par-dessus la source : il **reçoit la source** en entrée (`uniform shader uSrc`) et calcule la
   couleur finale. Dithérer l'alpha ne dithère pas la sortie — le bruit y est atténué par la
   luminance de la source, d'autant plus qu'elle est sombre, et c'est exactement là que le banding se
   voit. Le bruit est donc appliqué sur la couleur finale, à ±1 LSB, en densité triangulaire, calculé
   en pixels de sortie. Le fondu lui-même est calculé en lumière linéaire.

Les deux sont vérifiées sur les pixels réels — voir plus bas.

## Géométrie

Tout ce qui est mesurable est mesuré (taille de fenêtre, densité, safe area). Seule la boîte de la
découpe est déduite, parce qu'iOS ne la publie pas :

| Inset haut | Découpe déduite | Fiabilité |
| ---------- | --------------- | --------- |
| ≥ 55 pt | Dynamic Island, 125 × 37,33 pt à 11 pt du bord | sûre — l'île a la même taille physique du 14 Pro au 17 Pro Max |
| 40–55 pt | Encoche, 209 × 30 pt collée au bord | approchée — l'encoche du 13/14 est plus étroite (161 pt) |
| < 40 pt | aucune | sûre |

**Sur Android, rien n'est déduit** : `insets.top` y est la hauteur de la barre d'état, qui n'a aucun
rapport avec la découpe. L'utilisateur choisit la cible à la main. Le correctif propre est un petit
module natif lisant `WindowInsets.getDisplayCutout().getBoundingRects()`, qui donne les rectangles
**exacts** — mieux que sur iOS, où il faut les inférer.

---

## Développement

```sh
npm install
npx expo start          # nécessite un development build, pas Expo Go (cf. plus bas)
npx tsc --noEmit        # typecheck
npx expo export --platform ios       # vérifie que le bundle se construit
```

### Vérification du rendu, sans appareil

Le code de rendu est exécuté hors application, contre CanvasKit (le Skia WASM livré avec
`react-native-skia`), ce qui produit de vrais PNG et permet de contrôler les pixels. Voir
`docs/verification.md` pour le harnais. Les deux contrôles :

- la découpe est couverte par du `0,0,0` exact, pour les 3 familles × 2 géométries ;
- le fondu est bien dithéré (part des paires de pixels voisins qui diffèrent) et sans plage plate
  dans sa partie raide.

---

## Tester l'app sans rien installer sur sa machine

### Android — gratuit et immédiat

```sh
npx eas login
npx eas init                              # crée le projet, écrit le projectId
npx eas build -p android --profile preview
```

EAS compile dans le cloud et renvoie une page d'installation avec QR code. Le profil `preview`
produit un **APK** en distribution interne : il s'installe directement, sans compte Google Play,
sans passer par le Store. C'est le chemin le plus court pour voir l'app tourner.

### iOS — il faut le programme développeur Apple (99 $/an)

Un build installable sur un iPhone — ad hoc *ou* TestFlight — exige un certificat de distribution et
un profil de provisionnement, que seul un compte payant peut émettre. Un identifiant Apple gratuit ne
donne qu'un certificat de développement personnel valable 7 jours, utilisable uniquement depuis Xcode
sur un appareil relié. **Il n'existe pas de chemin gratuit et sans Mac pour iOS.**

Avec le compte payant, deux options :

```sh
npx eas device:create                     # enregistre l'UDID de l'iPhone
npx eas build -p ios --profile preview    # ad hoc, installable par lien / QR code
```
Limite : 100 appareils par an et par type, chaque UDID à enregistrer à la main.

```sh
npx eas build -p ios --profile production
npx eas submit -p ios                     # → TestFlight
```
Pas d'UDID à gérer, mais chaque build passe la revue automatique d'Apple.

**Si vous avez un Mac**, il existe un raccourci sans aucun compte ni signature :

```sh
npx eas build -p ios --profile preview-sim
```
produit un build pour le simulateur iOS, à glisser-déposer dessus. Le simulateur reproduit la
géométrie réelle de la Dynamic Island, donc le test visuel est valable.

### Pourquoi pas Expo Go

Expo Go embarque un jeu fixe de modules natifs. `@shopify/react-native-skia`, `expo-glass-effect` et
`expo-media-library` n'en font pas partie — donc pas de QR code Expo Go pour cette app. Le
remplaçant est le *development build* : votre propre Expo Go, construit une fois par EAS, dans lequel
le JS se recharge ensuite normalement.

```sh
npx eas build -p android --profile development   # ou -p ios
npx expo start --dev-client
```

### Ensuite : essayer une branche sans reconstruire

Une fois **un** build installé, les changements purement JS se poussent en OTA :

```sh
npx eas update --branch ma-branche --message "essai du fondu"
```

`app.json` utilise `runtimeVersion: { policy: "fingerprint" }` : l'empreinte change dès qu'une
dépendance native bouge, et une mise à jour n'est alors plus délivrée aux builds incompatibles. Une
branche qui ajoute un module natif exige donc un nouveau build — mais le système ne livrera jamais
silencieusement un bundle qui planterait.

> `eas init` écrit `extra.eas.projectId` et `updates.url` dans `app.json`. Ces valeurs sont liées à
> votre compte et ne sont pas versionnées ici.

---

## Tester les différentes découpes

Deux choses distinctes, et une seule demande un émulateur.

**Juger le rendu** — le sélecteur de cible, dans la feuille d'enregistrement, force n'importe quelle
géométrie sur n'importe quel matériel : Dynamic Island en 393/402/430/440, encoche en 375/390/428,
poinçon Android centré ou décalé. Aucun émulateur nécessaire.

**Valider la détection** — là, l'émulateur Android sert vraiment. Sur API 28+ :

> Options pour les développeurs ▸ Dessin ▸ *Simuler un écran avec une découpe*
> → Par défaut · Angle · Double · Poinçon · Haute · Cascade

En ligne de commande, les mêmes variantes sont des overlays système :

```sh
adb shell cmd overlay list | grep cutout      # les noms exacts selon la version
adb shell cmd overlay enable com.android.internal.display.cutout.emulation.hole
```

C'est plus fiable que côté iOS, où le simulateur ne propose que les modèles existants. Et comme
Android expose les rectangles exacts de la découpe via `DisplayCutout`, la détection y sera à terme
plus juste que sur iPhone.

---

## Reste à faire

- Poser le fond d'écran en un geste : App Intent + raccourci sur iOS, `WallpaperManager.setBitmap()`
  sur Android. Les deux demandent du code natif.
- Module natif Android pour lire `DisplayCutout.getBoundingRects()`.
- Recadrage de la photo au pincement (le modèle le prévoit : `dx`, `dy`, `zoom`).
- Familles 12 (génératif), 08 (décor), 07 (objet), 09 (camouflage) — cf. `docs/2026-feasibility-and-ui.md`.
