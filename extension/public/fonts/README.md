# Bundled fonts

The extension never loads fonts from the network, so the two faces the
visual identity uses are shipped here and declared with `@font-face` in
`src/shared/theme.css`. Every font stack falls back to system fonts.

| Face          | Role    | Weights       | Source package (npm)          |
|---------------|---------|---------------|-------------------------------|
| Space Grotesk | display | 500, 700      | @fontsource/space-grotesk 5.3 |
| DM Sans       | text    | 400, 500, 700 | @fontsource/dm-sans 5.3       |

Latin subset only. Both are licensed under the SIL Open Font License
1.1; the license texts are alongside (`OFL-*.txt`).
