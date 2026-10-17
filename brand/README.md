# Print Octos — brand files

Seven white dots and one gold on a ring, a white ring at the centre.
Red #E31E24, gold #F5A623. The gold dot sits top left on the ring.

| File | For |
|---|---|
| `icon.svg`, `icon-only.png` (1024) | The app icon, full bleed; both stores round the corners themselves. Source for every icon size. |
| `icon-foreground.png`, `icon-background.png` (1024) | Android's adaptive icon, the mark kept inside the safe zone. |
| `splash.png`, `splash-dark.png` (2732) | The still launch image: the animation's first frame. |
| `play-store-icon-512.png` | Play Store listing icon. |
| `feature-graphic.png` (1024 × 500) | Play Store feature graphic. |
| `wordmark-on-red.svg`, `wordmark-on-white.svg` | The name with the mark, for the storefront header and documents. |
| `LaunchSplash.jsx` | The opening animation, for the app (inert on the website). |

In the app project these go in `assets/` (`icon-only.png`, `icon-foreground.png`,
`icon-background.png`, `splash.png`, `splash-dark.png`), and
`npx @capacitor/assets generate` makes every size each phone needs.

The wordmark is set in a stand-in italic. When a typeface is chosen, the
SVGs' text should be turned to outlines so it renders the same everywhere.
