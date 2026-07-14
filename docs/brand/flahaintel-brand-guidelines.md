# FlahaINTEL brand guidelines

## Identity

**Name:** FlahaINTEL
**Tagline:** INTELLIGENCE FOR A RESILIENT WORLD

The mark combines a globe, leaves, agricultural land, and digital pixels. Together they represent verified global context, agricultural resilience, and governed digital intelligence.

## Color palette

| Token | Hex | Primary use |
| --- | --- | --- |
| Deep Navy | `#0B1D2A` | Header, monochrome mark, primary text |
| Leaf Green | `#2E7D32` | Primary actions and brand accents |
| Fresh Green | `#7CB342` | Supporting accents |
| Light Green | `#CDE6C0` | Subtle supporting surfaces |
| Slate Gray | `#6B7280` | Secondary text |

White text on Deep Navy and Leaf Green meets WCAG AA contrast for normal text. Slate Gray is intended for secondary text on white; Light Green is not a text color on white.

## Typography

Poppins is the brand typography reference. The web application uses a system-safe stack beginning with Poppins and does not bundle font binaries or load a third-party font service. Environments without Poppins fall back to Inter, Segoe UI, Arial, and sans-serif.

## Asset inventory

All web assets live in `apps/web/public/brand/flahaintel/`.

| File | Dimensions | Intended use |
| --- | ---: | --- |
| `flahaintel-logo-horizontal.png` | 1200 × 292 | Full-color identity on light or transparent surfaces |
| `flahaintel-logo-mark.png` | 434 × 419 | Standalone mark and subtle state decoration |
| `flahaintel-logo-reverse.png` | 1200 × 295 | Identity on Deep Navy or other dark surfaces |
| `flahaintel-logo-monochrome.png` | 1200 × 292 | Single-color Deep Navy reproduction |
| `flahaintel-logo-green.png` | 1200 × 292 | Single-color Leaf Green reproduction |
| `flahaintel-brand-board.png` | 2172 × 724 | Light master reference |
| `flahaintel-banner.png` | 1800 × 600 | Dark presentation banner |
| `flahaintel-favicon.png` | 128 × 128 | Browser favicon |

The two supplied 2172 × 724 source images remain outside the repository and were not overwritten. The derived logo files preserve the approved raster geometry and aspect ratio. Transparent variants have an alpha channel and no rectangular white background.

## Usage rules

- Preserve each asset's aspect ratio; never stretch, skew, redraw, or rearrange the logo.
- Use the reverse logo on Deep Navy and the full-color horizontal logo on light backgrounds.
- Keep clear space around the identity at least equal to the height of the capital `I` in `INTEL`.
- Do not arbitrarily recolor the full-color logo. Use the supplied monochrome or green variant when a single-color treatment is required.
- Use the standalone mark sparingly. In the application it may appear at low opacity only in loading and empty states, never behind operational content.
- The favicon may be reduced by the browser, but should not be manually stretched or cropped.

## Application integration

The application theme is defined in `apps/web/src/theme.ts`. The compact header uses the reverse logo, while the approved introduction appears immediately above the unchanged six-workspace navigation. Brand integration must not reduce information density, obscure filters, or replace governed workflow labels with decorative content.
