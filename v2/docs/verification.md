# Vérifier le rendu sans appareil

Le code de rendu (`src/render/draw.ts`, shader compris) est exécuté hors application, contre
CanvasKit — le Skia compilé en WebAssembly qui est déjà livré comme dépendance de
`@shopify/react-native-skia`. Rien n'est réimplémenté : les modules sont transpilés tels quels et
seul l'import `@shopify/react-native-skia` est remplacé par son implémentation web.

```sh
npm run verify    # contrôles sur les pixels
npm run samples   # écrit des PNG en résolution native dans .renders/
```

## Ce que `verify` contrôle

**1. Couverture de la découpe.** Pour les 3 familles × 2 géométries, tous les pixels de la boîte de
découpe doivent valoir exactement `0,0,0`. C'est la propriété dont dépend l'app entière : sur OLED,
seul le noir absolu se confond avec la dalle.

**2. Dithering du fondu.** Deux mesures, parce que la mesure évidente est trompeuse :

- *le bruit atteint la sortie* — part des paires de pixels horizontalement voisines qui diffèrent.
  Sans dithering elle serait nulle ; on attend plus de 15 %.
- *pas de marche dans la partie raide* — plus longue plage verticale à valeur constante sur les
  60 premiers pour cent du fondu.

Mesurer la plus longue plage plate sur **tout** le fondu ne dit rien : en fin de course la courbe
rejoint la source, sa pente tend vers zéro, et une plage plate y est normale — il n'y a aucune
marche à masquer. C'est ce faux positif qui a fait croire à un banding lors de la première passe.
