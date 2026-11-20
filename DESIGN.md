---
name: TowerLab Precision Dark
colors:
  surface: '#131316'
  surface-dim: '#131316'
  surface-bright: '#39393c'
  surface-container-lowest: '#0e0e11'
  surface-container-low: '#1b1b1e'
  surface-container: '#1f1f22'
  surface-container-high: '#2a2a2d'
  surface-container-highest: '#353438'
  on-surface: '#e4e1e6'
  on-surface-variant: '#bacac5'
  inverse-surface: '#e4e1e6'
  inverse-on-surface: '#303033'
  outline: '#859490'
  outline-variant: '#3c4a46'
  surface-tint: '#3cddc7'
  primary: '#57f1db'
  on-primary: '#003731'
  primary-container: '#2dd4bf'
  on-primary-container: '#00574d'
  inverse-primary: '#006b5f'
  secondary: '#a8c8ff'
  on-secondary: '#003062'
  secondary-container: '#124988'
  on-secondary-container: '#8fbaff'
  tertiary: '#e8d1ff'
  on-tertiary: '#3f1e66'
  tertiary-container: '#d3aeff'
  on-tertiary-container: '#5d3d85'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#62fae3'
  primary-fixed-dim: '#3cddc7'
  on-primary-fixed: '#00201c'
  on-primary-fixed-variant: '#005047'
  secondary-fixed: '#d5e3ff'
  secondary-fixed-dim: '#a8c8ff'
  on-secondary-fixed: '#001b3c'
  on-secondary-fixed-variant: '#0e4685'
  tertiary-fixed: '#eedbff'
  tertiary-fixed-dim: '#d9b9ff'
  on-tertiary-fixed: '#290350'
  on-tertiary-fixed-variant: '#57377f'
  background: '#131316'
  on-background: '#e4e1e6'
  surface-variant: '#353438'
  surface-canvas: '#09090b'
  surface-subtle: '#121215'
  surface-raised: '#18181b'
  surface-overlay: '#222227'
  border-subtle: '#27272a'
  border-prominent: '#3f3f46'
  text-primary: '#f4f4f5'
  text-muted: '#a1a1aa'
  text-dim: '#71717a'
  tech-wasm: '#6366f1'
  tech-nuxt: '#00dc82'
  tech-rust: '#f97316'
typography:
  display:
    fontFamily: Geist
    fontSize: 3.5rem
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.03em
  display-mobile:
    fontFamily: Geist
    fontSize: 2.25rem
    fontWeight: '700'
    lineHeight: '1.15'
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Geist
    fontSize: 2rem
    fontWeight: '600'
    lineHeight: '1.25'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Geist
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  body-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: '1.45'
    letterSpacing: 0.01em
  code-lg:
    fontFamily: JetBrains Mono
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: '1.5'
    letterSpacing: -0.01em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: '0'
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 0.6875rem
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style
TowerLab embodies a sleek, developer-first aesthetic tailored for technical workflows, binary conversions, and game asset toolchains. The visual tone is precise, ultra-focused, and utilitarian yet refined.

The style combines **Dark Minimalism** with subtle **Glassmorphism** and technical accents. Dark zinc surfaces (`#09090B` through `#18181B`) establish an immersive terminal-like atmosphere, punctuated by vibrant teal/cyan (`#2DD4BF`) and soft technical pastels. Micro-interactions are snappy, feedback is quiet and ambient, and interfaces prioritize uncluttered command layouts with strict information hierarchy.

## Colors
The palette leverages a deep charcoal/zinc tonal foundation to ensure maximum contrast and reduced eye strain during extended development sessions.

- **Primary (`#2DD4BF`)**: High-visibility cyan/teal used exclusively for primary actions, active status cues, focused elements, and subtle luminescent glows.
- **Secondary (`#89B4FA`) & Tertiary (`#CBA6F7`)**: Technical soft blues and purples reserved for syntax tokens, specialized status chips, and metadata indicators.
- **Surface Hierarchy**:
  - `surface-canvas` (`#09090B`): Base viewport background.
  - `surface-subtle` (`#121215`): Inset containers, dropzones, and card backgrounds.
  - `surface-raised` (`#18181B`): Active pills, elevated cards, and toolbars.
  - `surface-overlay` (`#222227`): Dropdowns, modals, and floating flyouts.
- **Text & Borders**:
  - Crisp high-readability text with `text-primary` (`#F4F4F5`) down to `text-dim` (`#71717A`) for secondary metadata and privacy guarantees.
  - Borders rely on hairline borders (`#27272A`) shifting to `#3F3F46` upon hover.

## Typography
The system employs a deliberate tripartite typographic stack:

1. **Headlines (`Geist`)**: Tight, geometric, modern proportions engineered for developer tools. Headings utilize tight negative letter spacing (`-0.01em` to `-0.03em`) to deliver a modern software aesthetic.
2. **Body (`Inter`)**: Neutral, highly legible body copy calibrated for clean horizontal rhythm and accessible documentation.
3. **Monospace & Code (`JetBrains Mono`)**: Applied to file names, metrics, technical tags, file formats, and terminal notifications. Captions and recommendation tags use `label-mono` with wide tracking (`0.06em`) for distinct legibility at micro scales.

## Layout & Spacing
The layout follows a centered, tool-centric single-column fixed-grid containment model with a maximum width of `48rem` (`max-w-3xl`) for focused workflows, bounded inside standard fluid page shells (`max-w-7xl`).

- **Vertical Rhythm**: Section groupings space evenly using multiples of 4px/8px, prioritizing `space-md` (12px) for related form items, `space-xl` (32px) for card separation, and `4rem` (64px) for hero and dropzone bounds.
- **Responsive Adaptations**:
  - **Mobile (< 640px)**: Dropzones condense internal padding from `3.5rem` to `2.5rem`, navbar layout collapses secondary links, and full-width CTA actions remain reachable.
  - **Desktop (>= 1024px)**: Outer margins extend to `margin-desktop` (`2rem`) with centered tool panels.

## Elevation & Depth
Elevation is expressed through tonal layer separation and subtle luminescence rather than heavy drop shadows:

- **Tonal Layering**: Depth is achieved by placing cards (`surface-subtle`) against dark viewport canvases (`surface-canvas`), stepping up to `surface-raised` on active or hover states.
- **Glassmorphism**: Fixed headers utilize semi-transparent backdrops (`bg-surface-canvas/80`) paired with heavy `backdrop-blur-xl` to keep document scrolling seamless beneath navigation.
- **Ambient Glows & Halos**: Focal action points (such as dropzones and primary CTAs) feature faint radial colored glows (`bg-primary-container/5` with `blur-3xl` or `shadow-[0_0_20px_rgba(45,212,191,0.2)]`).
- **Low-Contrast Outlines**: Crisp 1px strokes using `#27272A` delimit interactive zones, with dashed SVG borders indicating drop surfaces.

## Shapes
Shapes maintain a controlled, compact industrial aesthetic:

- **Soft Form Base**: Standard elements (buttons, inputs, file summary rows, segmented controls) adopt `rounded-lg` (4px to 6px) and `rounded-xl` (8px).
- **Pills and Badges**: Secondary status badges and avatar glyphs use circular or tight pill containers.
- **Dashed Borders**: Bounded drop containers feature matched corner radii (`rx="8"`) on dashed stroke paths to maintain outline harmony.

## Components

### Buttons
- **Primary CTA**: Large full-width or substantial action buttons in `primary-container` (`#2DD4BF`) with dark text (`surface-canvas`). Employs a luminous ambient teal drop shadow (`shadow-[0_0_20px_rgba(45,212,191,0.2)]`) and subtle click compression (`active:scale-[0.99]`).
- **Secondary / Action Trigger**: Minimalist `surface-container` background with `text-primary`, elevating to `surface-container-high` on hover.

### File Dropzone
- Encased in `surface-subtle` with an absolute SVG dashed perimeter (`stroke="#27272A"`, `stroke-dasharray="6,6"`).
- Dynamic hover state transitions background to `surface-raised` and dashed border to `border-prominent`.
- Central icon housed inside an elevated square rounded box with icon color transitions.

### Segmented Format Selector (Pills)
- Segmented container styled with `surface-subtle` inset with 6px padding.
- Segment options fill equal flex fractions (`flex-1`) with monospace labels. Active pill receives `bg-surface-raised`, `text-primary`, and a subtle `shadow-sm`, with optional highlighted badges in `primary-container`.

### File Summary Row
- Horizontal summary item containing asset icon, truncate-protected monospace filename, file size, instance counts, and terminal icon action (`close`). Styled in `surface-subtle` with 16px internal padding.

### Privacy Banner & Footers
- Local-first trust indicators rendered in understated `text-dim` paired with 16px material utility icons (`lock`).