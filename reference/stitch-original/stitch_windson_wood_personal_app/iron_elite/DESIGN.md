---
name: Iron Elite
colors:
  surface: '#141312'
  surface-dim: '#141312'
  surface-bright: '#3a3937'
  surface-container-lowest: '#0e0e0d'
  surface-container-low: '#1c1b1a'
  surface-container: '#201f1e'
  surface-container-high: '#2b2a28'
  surface-container-highest: '#353533'
  on-surface: '#e5e2df'
  on-surface-variant: '#cbc6bc'
  inverse-surface: '#e5e2df'
  inverse-on-surface: '#31302f'
  outline: '#949087'
  outline-variant: '#49473f'
  surface-tint: '#cbc6b8'
  primary: '#cbc6b8'
  on-primary: '#323127'
  primary-container: '#666358'
  on-primary-container: '#e5e0d1'
  inverse-primary: '#615e53'
  secondary: '#c9c6bf'
  on-secondary: '#31302c'
  secondary-container: '#484741'
  on-secondary-container: '#b8b5ae'
  tertiary: '#cbc4cc'
  on-tertiary: '#332f35'
  tertiary-container: '#666168'
  on-tertiary-container: '#e5dde5'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e7e2d4'
  primary-fixed-dim: '#cbc6b8'
  on-primary-fixed: '#1d1c13'
  on-primary-fixed-variant: '#49473c'
  secondary-fixed: '#e6e2db'
  secondary-fixed-dim: '#c9c6bf'
  on-secondary-fixed: '#1c1c17'
  on-secondary-fixed-variant: '#484741'
  tertiary-fixed: '#e8e0e8'
  tertiary-fixed-dim: '#cbc4cc'
  on-tertiary-fixed: '#1e1a20'
  on-tertiary-fixed-variant: '#4a454c'
  background: '#141312'
  on-background: '#e5e2df'
  surface-variant: '#353533'
typography:
  headline-xl:
    fontFamily: Hanken Grotesk
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.1em
  stat-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 48px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max: 1200px
---

## Brand & Style

The design system is engineered for an elite, high-performance fitness environment. It targets a serious, results-driven demographic that values professional coaching and rigorous standards. 

The visual style is **Corporate Modern with Tactile Accents**, utilizing a sophisticated, warm-industrial dark aesthetic. It shifts from pure blacks to a palette of desaturated, earthy metallics and "weathered" gunmetal tones. This conveys a sense of seasoned strength and mechanical precision, evoking the feeling of a private, high-end training facility where equipment is well-maintained but heavily used. Imagery should be high-contrast, moody, and emphasize physical form and mechanical equipment.

## Colors

This design system uses a strict dark-mode-first palette based on muted, desaturated tones.

- **Primary (Weathered Steel):** A warm, desaturated olive-grey (#7A776B) used for structural elements and critical interactive states. 
- **Secondary (Oxidized Silver):** A neutral, cool-toned grey (#797771) used for iconography and supporting UI elements.
- **Tertiary (Basalt):** A deep, slightly purplish slate (#666168) for accentuating specific data points or alternative states.
- **Surface Tiers:**
    - **Base:** Deep, warm-toned charcoal (#151412) for high-contrast backgrounds.
    - **Elevated:** Mid-depth greys derived from the Neutral (#797775) seed for container surfaces.
- **Accent (Success/Action):** Off-white (#E6E2DE) for high-readability body text and headers to maintain a sharp appearance against the industrial backdrop.

## Typography

The typography strategy focuses on clarity and impact. **Hanken Grotesk** is used for headlines to provide a sharp, modern, and aggressive look suitable for a performance app. **Inter** handles body content to ensure maximum readability during intense workouts. **JetBrains Mono** is introduced for technical data, repetitions, and timestamps to emphasize the "data-driven" nature of the training.

All headlines should favor tight tracking (letter spacing) to appear more cohesive and powerful. Stats and numerical data should be oversized to serve as primary visual anchors on dashboard screens.

## Layout & Spacing

This design system employs a **Fluid Grid** model with a tight, disciplined 4px base unit. 

- **Mobile:** 4-column layout with 16px margins. Information density is high to allow trainers to see workout details at a glance without excessive scrolling.
- **Desktop/Tablet:** 12-column layout. Content is contained within a 1200px max-width to maintain focus. 
- **Rhythm:** Use "Tight" spacing (8px, 16px) for related items within a card and "Structural" spacing (24px, 32px) to separate distinct sections or workout blocks.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Low-Contrast Outlines**. 

Shadows are avoided to maintain a flat, industrial aesthetic. Instead, depth is achieved by stacking desaturated surface layers.
- **Level 0 (Base):** Deepest warm-grey background (#151412).
- **Level 1 (Cards):** Surface-container tones (#21201E) with a 1px solid border (#494740).
- **Level 2 (Modals/Popovers):** Higher-toned grey surfaces (#2C2A28) with a subtle inner glow (0.5px white stroke at 5% opacity).

Interactive elements like buttons use the Weathered Steel primary color to provide a weighted, professional presence without needing traditional drop shadows.

## Shapes

The shape language is **Soft (0.25rem)**, moving away from the playfulness of rounded "pill" designs to maintain a serious, professional tone. 

- **Primary Buttons/Inputs:** 4px (Soft) corner radius. This creates a sharp, precision-cut look.
- **Feature Cards:** 8px (Rounded-lg) corner radius for a slightly softer container feel.
- **Avatars:** Strictly circular to contrast against the otherwise rectangular, architectural layout.

## Components

- **Buttons:** Primary buttons are Solid Weathered Steel with high-contrast text. Secondary buttons are Ghost-style with an Oxidized Silver 1px border.
- **Input Fields:** Dark background (#1D1C1A) with a bottom-only border in Secondary Grey. Focused states transition the border to Weathered Steel.
- **Workout Cards:** Use a vertical layout. Title at the top-left in Hanken Grotesk, reps/sets in JetBrains Mono at the top-right. The background can feature a low-opacity image of the exercise.
- **Chips/Status:** Used for "Muscles Targeted" or "Difficulty." These should have a dark background and Secondary Grey text in `label-caps`.
- **Lists:** Clean, separated by 1px dividers in a muted outline-variant (#494740). Chevron icons should be used to indicate drill-down actions.
- **Progress Bars:** Thin, high-contrast bars. The track is a deep muted grey (#2C2A28) and the progress indicator is Weathered Steel (#7A776B).