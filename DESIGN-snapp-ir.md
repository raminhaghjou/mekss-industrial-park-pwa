---
name: Snapp
url: https://snapp.ir/
colors:
  primary: '#21aa58'
  primary-dark: '#029054'
  primary-text-green: '#22a958'
  primary-text-green-dark: '#248a4a'
  accent-blue: '#575eff'
  background: '#ffffff'
  surface-light: '#f8f9ff'
  surface-light-blue: '#eeefff'
  surface-light-green: '#e9f6ee'
  text-black: '#000000'
  text-primary: '#252a3c'
  text-secondary: '#686c79'
  text-inverse: '#ffffff'
typography:
  display:
    family: 'IRANSansXFaNum'
    size: 33px
    weight: 700
    line-height: 1.2
  heading-1:
    family: 'IRANSansXFaNum'
    size: 32px
    weight: 700
    line-height: 1.2
  heading-2:
    family: 'IRANSansXFaNum'
    size: 24px
    weight: 700
    line-height: 1.2
  heading-3:
    family: 'IRANSansXFaNum'
    size: 20px
    weight: 400
    line-height: 1.5
  body-large:
    family: 'IRANSansXFaNum'
    size: 19px
    weight: 400
    line-height: 1.5
  body:
    family: 'IRANSansXFaNum'
    size: 16px
    weight: 400
    line-height: 1.5
  body-small:
    family: 'IRANSansXFaNum'
    size: 14px
    weight: 400
    line-height: 1.5
  button:
    family: 'IRANSansXFaNum'
    size: 16px
    weight: 500
    line-height: 1.5
spacing:
  base: 4px
  scale: [0, 4, 8, 12, 16, 24, 32, 64, 128]
radius:
  sm: 8px
  md: 12px
  lg: 16px
  pill: 32px
  full: 9999px
elevation:
  card: 'rgba(97, 100, 117, 0.06) 0px 3px 4px 0px, rgba(97, 100, 117, 0.04) 0px 3px 3px 0px, rgba(97, 100, 117, 0.12) 0px 1px 8px 0px'
  hover: 'rgba(97, 100, 117, 0.06) 0px 8px 10px 0px, rgba(97, 100, 117, 0.04) 0px 3px 14px 0px, rgba(97, 100, 117, 0.12) 0px 5px 5px 0px'
motion:
  duration-base: '0.3s'
  easing-standard: 'ease-out' # inferred from common practice
layout:
  max-width: 1376px
components:
  button-primary:
    bg: '{colors.primary}'
    text: '{colors.text-inverse}'
    radius: '{radius.sm}'
    padding: '0px 24px'
  button-secondary:
    bg: 'transparent'
    text: '{colors.primary}'
    border: '1px solid {colors.primary}'
    radius: '{radius.sm}'
    padding: '0px 12px'
  button-ghost:
    bg: 'transparent'
    text: '{colors.text-primary}'
    border: '1px solid {colors.text-primary}'
    radius: '{radius.pill}'
    padding: '0px 0px'
  card:
    bg: '{colors.background}'
    radius: '{radius.sm}'
    shadow: '{elevation.card}'
---

# Design System Inspired by Snapp

## 1. Visual Theme & Atmosphere
Snapp's design system evokes a vibrant and approachable atmosphere, primarily driven by a lively green palette, specifically `{colors.primary}` (`#21aa58`), paired with a clean white background (`{colors.background}` (`#ffffff`)) and subtle light blue-grey surfaces (`{colors.surface-light}` (`#f8f9ff`)). The brand prominently features custom 3D isometric illustrations depicting various services like ride-hailing, food delivery, and travel, adding a playful yet sophisticated visual identity. Typography, set in `IRANSansXFaNum`, utilizes strong, bold headings (`700` weight) for impact and clear, readable body text.

The overall aesthetic is functional and engaging, emphasizing ease of use and a comprehensive suite of services through a well-organized layout. Interactive elements, such as buttons and links, are clearly defined with the brand's primary green and subtle hover effects, ensuring a responsive user experience. While no complex CSS animations or Framer Motion are detected, the site does incorporate embedded video content, demonstrating a dynamic approach to showcasing its services.

Key Characteristics:
- Primary brand green (`#21aa58`) for CTAs and branding.
- Extensive use of custom 3D isometric illustrations.
- Clean hierarchy with `IRANSansXFaNum` font family.
- Subtle shadows (`{elevation.card}`) for depth on cards.
- Ample whitespace with light blue-grey (`#f8f9ff`) sections.
- Rounded corners (`{radius.sm}` `8px`) on interactive elements.
- Embedded video content to explain services.

## 2. Color Palette & Roles
Snapp's color palette is built around a strong primary green, complemented by a range of neutral greys and subtle accent hues to define hierarchy and interaction.

-   **Primary**
    -   `primary` (`#21aa58`) — The core brand green, used for primary call-to-action buttons, key interactive elements, and brand accents.
    -   `primary-dark` (`#029054`) — A darker shade of the primary green, used for hover and active states of primary interactive elements.
    -   `primary-text-green` (`#22a958`) — A slightly different shade of green, used for text links and headings that require a brand accent.
    -   `primary-text-green-dark` (`#248a4a`) — A darker version of the text accent green, for hover states or stronger emphasis.
-   **Accent Colors**
    -   `accent-blue` (`#575eff`) — A vibrant blue used for secondary accent text and specific interactive elements, providing visual contrast.
-   **Neutral Scale**
    -   `text-black` (`#000000`) — Pure black, used for high-contrast headings and critical information.
    -   `text-primary` (`#252a3c`) — The main dark grey for body text, ensuring high readability on light backgrounds.
    -   `text-secondary` (`#686c79`) — A medium grey for secondary text, captions, and less emphasized content.
    -   `text-inverse` (`#ffffff`) — White text, exclusively used on dark backgrounds like the primary green buttons.
-   **Surface & Borders**
    -   `background` (`#ffffff`) — The predominant background color for the entire website, providing a clean canvas.
    -   `surface-light` (`#f8f9ff`) — A very light blue-grey, used for subtle section backgrounds and card containers to create visual separation.
    -   `surface-light-blue` (`#eeefff`) — A slightly more saturated light blue surface, used for specific highlight sections.
    -   `surface-light-green` (`#e9f6ee`) — A very light green tint, used for subtle background highlights.

## 3. Typography Rules
-   **Font Family**: `IRANSansXFaNum`, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Helvetica Neue", sans-serif. Monospace fallback for code: `SFMono-Regular`, `Menlo`, `Consolas`, `Liberation Mono`, `monospace`.
-   **Hierarchy**:
    -   **Display**: `IRANSansXFaNum` `33px` `700` · line-height `1.2` · tracking `none` · Used for the main hero headline.
    -   **H1**: `IRANSansXFaNum` `32px` `700` · line-height `1.2` · tracking `none` · Used for prominent section titles.
    -   **H2**: `IRANSansXFaNum` `24px` `700` · line-height `1.2` · tracking `none` · Used for major sub-section headings.
    -   **H3**: `IRANSansXFaNum` `20px` `400` · line-height `1.5` · tracking `none` · Used for minor headings and emphasized content.
    -   **Body Large**: `IRANSansXFaNum` `19px` `400` · line-height `1.5` · tracking `none` · Used for slightly larger body text or introductory paragraphs.
    -   **Body**: `IRANSansXFaNum` `16px` `400` · line-height `1.5` · tracking `none` · Standard text for paragraphs and descriptive content.
    -   **Body Small**: `IRANSansXFaNum` `14px` `400` · line-height `1.5` · tracking `none` · Used for captions, metadata, and less prominent text.
    -   **Button**: `IRANSansXFaNum` `16px` `500` · line-height `1.5` · tracking `none` · Text style for interactive buttons.
-   **Principles**:
    -   Headings (`H1`, `H2`) leverage the `700` (Bold) weight of `IRANSansXFaNum` to establish a clear visual hierarchy and strong brand presence.
    -   Body text and `H3` headings maintain readability with `400` (Regular) weight and a generous line-height of `1.5`, promoting comfortable reading.
    -   The `16px` (`{typography.body.size}`) base font size ensures accessibility and legibility for primary content.
    -   The `IRANSansXFaNum` font is consistently applied across all text elements to maintain a unified brand voice.
    -   Specific font sizes like `14px` (`{typography.body-small.size}`) are reserved for secondary information, preventing visual clutter.

## 4. Component Stylings

### Buttons
Snapp's buttons are designed for clarity and impact, using the brand's primary green for key actions and outlined styles for secondary options. All buttons feature a subtle `0.3s` ease-out transition for smooth feedback.

#### Primary Button
A solid green button for primary calls to action, featuring white text and rounded corners.
```css
.button-primary {
  background-color: var(--color-primary, #21aa58);
  color: var(--color-text-inverse, #ffffff);
  font-family: var(--typography-button-family, 'IRANSansXFaNum');
  font-size: var(--typography-button-size, 16px);
  font-weight: var(--typography-button-weight, 500);
  padding: 0px 24px;
  height: 48px; /* inferred from screenshot */
  border: none;
  border-radius: var(--radius-sm, 8px);
  cursor: pointer;
  transition: background-color var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out),
              box-shadow var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out);
}

.button-primary:hover {
  background-color: var(--color-primary-dark, #029054);
  box-shadow: 0 4px 8px rgba(33, 170, 88, 0.2); /* inferred from screenshot */
}

.button-primary:active {
  background-color: var(--color-primary-dark, #029054);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2); /* inferred from screenshot */
}

.button-primary:disabled {
  background-color: var(--color-primary, #21aa58); /* inferred from screenshot */
  opacity: 0.6; /* inferred from screenshot */
  cursor: not-allowed;
}
```

#### Secondary Button
An outlined button with green text and border, used for less prominent actions or alternatives.
```css
.button-secondary {
  background-color: transparent;
  color: var(--color-primary, #21aa58);
  font-family: var(--typography-button-family, 'IRANSansXFaNum');
  font-size: var(--typography-button-size, 16px);
  font-weight: var(--typography-button-weight, 500);
  padding: 0px 12px;
  height: 48px; /* inferred from screenshot */
  border: 1px solid var(--color-primary, #21aa58);
  border-radius: var(--radius-sm, 8px);
  cursor: pointer;
  transition: background-color var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out),
              color var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out),
              border-color var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out);
}

.button-secondary:hover {
  background-color: var(--color-primary, #21aa58); /* inferred from screenshot */
  color: var(--color-text-inverse, #ffffff);
  border-color: var(--color-primary, #21aa58);
}

.button-secondary:active {
  background-color: var(--color-primary-dark, #029054); /* inferred from screenshot */
  color: var(--color-text-inverse, #ffffff);
  border-color: var(--color-primary-dark, #029054);
}

.button-secondary:disabled {
  color: var(--color-primary, #21aa58); /* inferred from screenshot */
  border-color: var(--color-primary, #21aa58); /* inferred from screenshot */
  opacity: 0.6; /* inferred from screenshot */
  cursor: not-allowed;
}
```

#### Ghost Button
A text-only button with a subtle border, often used for navigation or less emphasized actions. This variant uses a larger border-radius (`{radius.pill}`) for a distinct shape.
```css
.button-ghost {
  background-color: transparent;
  color: var(--color-text-primary, #252a3c);
  font-family: var(--typography-body-small-family, 'IRANSansXFaNum');
  font-size: var(--typography-body-small-size, 14px);
  font-weight: var(--typography-body-small-weight, 500); /* inferred from screenshot */
  padding: 0px 16px; /* inferred from screenshot */
  height: 32px; /* inferred from screenshot */
  border: 1px solid var(--color-text-primary, #252a3c);
  border-radius: var(--radius-pill, 32px);
  cursor: pointer;
  transition: background-color var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out),
              color var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out),
              border-color var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out);
}

.button-ghost:hover {
  background-color: var(--color-text-primary, #252a3c); /* inferred from screenshot */
  color: var(--color-text-inverse, #ffffff);
  border-color: var(--color-text-primary, #252a3c);
}

.button-ghost:active {
  background-color: var(--color-text-black, #000000); /* inferred from screenshot */
  color: var(--color-text-inverse, #ffffff);
  border-color: var(--color-text-black, #000000);
}

.button-ghost:disabled {
  color: var(--color-text-secondary, #686c79); /* inferred from screenshot */
  border-color: var(--color-text-secondary, #686c79); /* inferred from screenshot */
  opacity: 0.6; /* inferred from screenshot */
  cursor: not-allowed;
}
```

### Cards & Containers
Cards are used to display service categories and blog posts, featuring a clean background, subtle shadow, and rounded corners. On hover, the shadow subtly expands to indicate interactivity.

#### Standard Card
A white container with rounded corners and a soft shadow, used for displaying content blocks.
```css
.card {
  background-color: var(--color-background, #ffffff);
  border-radius: var(--radius-sm, 8px);
  box-shadow: var(--elevation-card, rgba(97, 100, 117, 0.06) 0px 3px 4px 0px, rgba(97, 100, 117, 0.04) 0px 3px 3px 0px, rgba(97, 100, 117, 0.12) 0px 1px 8px 0px);
  padding: var(--spacing-xl, 24px); /* inferred from screenshot */
  transition: box-shadow var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out),
              transform var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out);
}

.card:hover {
  box-shadow: var(--elevation-hover, rgba(97, 100, 117, 0.06) 0px 8px 10px 0px, rgba(97, 100, 117, 0.04) 0px 3px 14px 0px, rgba(97, 100, 117, 0.12) 0px 5px 5px 0px);
  transform: translateY(-2px); /* inferred from screenshot */
}
```

### Inputs & Forms
Form elements are clean and functional, with clear focus states and disabled styling.

#### Text Input
A standard text input field with a light border, `text-primary` text, and a distinct focus ring.
```css
.input-text {
  background-color: var(--color-background, #ffffff);
  color: var(--color-text-primary, #252a3c);
  font-family: var(--typography-body-family, 'IRANSansXFaNum');
  font-size: var(--typography-body-size, 16px);
  font-weight: var(--typography-body-weight, 400);
  padding: var(--spacing-sm, 8px) var(--spacing-md, 12px); /* inferred from screenshot */
  border: 1px solid var(--color-text-secondary, #686c79); /* inferred from screenshot */
  border-radius: var(--radius-sm, 8px);
  width: 100%;
  transition: border-color var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out),
              box-shadow var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out);
}

.input-text:focus {
  border-color: var(--color-primary, #21aa58);
  outline: none;
  box-shadow: 0 0 0 3px rgba(33, 170, 88, 0.2); /* inferred from screenshot */
}

.input-text:disabled {
  background-color: var(--color-surface-light, #f8f9ff); /* inferred from screenshot */
  color: var(--color-text-secondary, #686c79);
  border-color: var(--color-text-secondary, #686c79);
  cursor: not-allowed;
}
```

#### Form Label
Labels for form fields, using the primary text color.
```css
.form-label {
  color: var(--color-text-primary, #252a3c);
  font-family: var(--typography-body-family, 'IRANSansXFaNum');
  font-size: var(--typography-body-size, 16px);
  font-weight: var(--typography-body-weight, 400);
  margin-bottom: var(--spacing-xs, 4px); /* inferred from screenshot */
  display: block;
}
```

#### Checkbox/Radio
Custom styled checkboxes and radio buttons (inferred from common design patterns, not explicitly visible).
```css
.checkbox-radio {
  appearance: none;
  width: 20px; /* inferred from screenshot */
  height: 20px; /* inferred from screenshot */
  border: 1px solid var(--color-text-secondary, #686c79);
  border-radius: var(--radius-xs, 4px); /* inferred from screenshot */
  display: inline-block;
  vertical-align: middle;
  cursor: pointer;
  position: relative;
  transition: background-color var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out),
              border-color var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out);
}

.checkbox-radio:checked {
  background-color: var(--color-primary, #21aa58);
  border-color: var(--color-primary, #21aa58);
}

.checkbox-radio:checked::after {
  content: '';
  display: block;
  width: 10px; /* inferred from screenshot */
  height: 10px; /* inferred from screenshot */
  background-color: var(--color-text-inverse, #ffffff);
  border-radius: 50%; /* for radio, square for checkbox */
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.checkbox-radio[type="radio"] {
  border-radius: var(--radius-full, 9999px);
}

.checkbox-radio:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(33, 170, 88, 0.2); /* inferred from screenshot */
}

.checkbox-radio:disabled {
  background-color: var(--color-surface-light, #f8f9ff);
  border-color: var(--color-text-secondary, #686c79);
  opacity: 0.6;
  cursor: not-allowed;
}
```

### Navigation

#### Top Navigation Bar
A clean, white navigation bar with `text-primary` links, positioned at the top of the page with a subtle shadow.
```css
.navbar {
  background-color: var(--color-background, #ffffff);
  box-shadow: 0 1px 4px rgba(0,0,0,0.08); /* inferred from screenshot */
  padding: var(--spacing-md, 12px) var(--spacing-3xl, 64px); /* inferred from screenshot */
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 99;
}
```

#### Navigation Link
Standard text links within the navigation, using `text-primary` color and a subtle hover effect.
```css
.nav-link {
  color: var(--color-text-primary, #252a3c);
  font-family: var(--typography-body-family, 'IRANSansXFaNum');
  font-size: var(--typography-body-size, 16px);
  font-weight: var(--typography-body-weight, 400);
  text-decoration: none;
  padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px); /* inferred from screenshot */
  transition: color var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out);
}

.nav-link:hover {
  color: var(--color-primary, #21aa58);
}

.nav-link.active,
.nav-link[aria-current="page"] {
  color: var(--color-primary, #21aa58);
  font-weight: var(--typography-body-weight, 500); /* inferred from screenshot */
}
```

#### Dropdown Menu
(None observed in source; inferred from common patterns)
```css
.dropdown-menu {
  background-color: var(--color-background, #ffffff);
  border: 1px solid var(--color-surface-light, #f8f9ff); /* inferred from screenshot */
  box-shadow: var(--elevation-card, rgba(97, 100, 117, 0.06) 0px 3px 4px 0px, rgba(97, 100, 117, 0.04) 0px 3px 3px 0px, rgba(97, 100, 117, 0.12) 0px 1px 8px 0px);
  border-radius: var(--radius-sm, 8px);
  padding: var(--spacing-sm, 8px) 0;
  position: absolute;
  min-width: 160px; /* inferred from screenshot */
  z-index: 100; /* inferred from screenshot */
  opacity: 0;
  visibility: hidden;
  transform: translateY(10px);
  transition: opacity var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out),
              transform var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out);
}

.dropdown-menu.open {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.dropdown-menu-item {
  color: var(--color-text-primary, #252a3c);
  font-family: var(--typography-body-family, 'IRANSansXFaNum');
  font-size: var(--typography-body-size, 16px);
  font-weight: var(--typography-body-weight, 400);
  padding: var(--spacing-xs, 4px) var(--spacing-md, 12px);
  text-decoration: none;
  display: block;
  white-space: nowrap;
  transition: background-color var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out),
              color var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out);
}

.dropdown-menu-item:hover {
  background-color: var(--color-surface-light, #f8f9ff);
  color: var(--color-primary, #21aa58);
}
```

### Links

#### Standard Link
Inline text links, typically using `primary-text-green` and an underline on hover.
```css
.link-standard {
  color: var(--color-primary-text-green, #22a958);
  font-family: var(--typography-body-family, 'IRANSansXFaNum');
  font-size: var(--typography-body-size, 16px);
  font-weight: var(--typography-body-weight, 400);
  text-decoration: none;
  transition: color var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out),
              text-decoration var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out);
}

.link-standard:hover {
  color: var(--color-primary-dark, #029054); /* inferred from screenshot */
  text-decoration: underline;
}

.link-standard:visited {
  color: var(--color-primary-text-green, #22a958); /* inferred from screenshot (no explicit visited style) */
}
```

#### Secondary Link
A secondary link style, often used for less emphasized actions or supplementary information, using `text-secondary` color.
```css
.link-secondary {
  color: var(--color-text-secondary, #686c79);
  font-family: var(--typography-body-small-family, 'IRANSansXFaNum');
  font-size: var(--typography-body-small-size, 14px);
  font-weight: var(--typography-body-small-weight, 400);
  text-decoration: none;
  transition: color var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out),
              text-decoration var(--motion-duration-base, 0.3s) var(--motion-easing-standard, ease-out);
}

.link-secondary:hover {
  color: var(--color-text-primary, #252a3c); /* inferred from screenshot */
  text-decoration: underline;
}

.link-secondary:visited {
  color: var(--color-text-secondary, #686c79); /* inferred from screenshot (no explicit visited style) */
}
```

### Badges
(None observed in source)

## 5. Layout Principles
-   **Spacing System**: Snapp employs a `4px` base unit for its spacing system, creating a consistent rhythm across the interface.
    -   Base `4px` → `0, 4, 8, 12, 16, 24, 32, 64, 128`
    -   `0px`: Used for resetting margins/paddings.
    -   `4px` (`var(--spacing-xs)`): Smallest separation, e.g., between icons and text.
    -   `8px` (`var(--spacing-sm)`): Standard small spacing, e.g., internal padding in small components, list item spacing.
    -   `12px` (`var(--spacing-md)`): Medium spacing, e.g., padding for input fields, spacing between minor elements.
    -   `16px` (`var(--spacing-lg)`): Larger internal padding, e.g., padding within cards, spacing between form elements.
    -   `24px` (`var(--spacing-xl)`): Sectional padding, e.g., vertical spacing between content blocks, padding around card groups.
    -   `32px` (`var(--spacing-2xl)`): Significant vertical spacing between major sections, component groups.
    -   `64px` (`var(--spacing-3xl)`): Large vertical and horizontal section padding, hero section spacing.
    -   `128px` (`var(--spacing-4xl)`): Extra-large spacing for hero sections or significant content breaks.
-   **Grid & Container** _Note: container widths and column counts are not extracted from the source. The values below are reasonable defaults inferred from the visible layout density._
    -   Max width: `1376px` (`var(--layout-max-width)`) — Content is centered within this maximum width.
    -   Columns: 12-column grid (inferred from common practice).
    -   Gutter: `24px` (`var(--spacing-xl)`) between grid columns (inferred).
    -   Section Padding: `64px` (`var(--spacing-3xl)`) vertical padding, `64px` (`var(--spacing-3xl)`) horizontal padding at desktop viewport edges.
-   **Whitespace Philosophy**: Snapp utilizes generous whitespace, particularly vertical spacing, to create a clean, uncluttered, and breathable layout. This approach enhances readability and helps segment distinct content blocks, guiding the user's eye through the page. The light `surface-light` (`#f8f9ff`) background for sections further emphasizes this open feel.
-   **Border Radius Scale**:
    -   `sm` (`8px`): Standard for buttons, cards, and input fields.
    -   `md` (`12px`): Used for slightly more rounded elements or larger containers.
    -   `lg` (`16px`): Applied to larger containers or feature blocks for a softer appearance.
    -   `pill` (`32px`): Used for specific button styles to create a pill-like shape.
    -   `full` (`9999px`): For perfectly circular elements like avatars or small badges.

## 6. Depth & Elevation
Snapp uses subtle shadows to create a sense of depth and hierarchy, primarily for interactive elements and content cards. The z-index values are clearly defined for stacking contexts.

-   **Flat (z-0)**: `none` — Default state for background elements and non-interactive content.
-   **Card (z-1)**: `rgba(97, 100, 117, 0.06) 0px 3px 4px 0px, rgba(97, 100, 117, 0.04) 0px 3px 3px 0px, rgba(97, 100, 117, 0.12) 0px 1px 8px 0px` — Used for standard content cards and tooltips.
-   **Header (z-99)**: `0 1px 4px rgba(0,0,0,0.08)` (inferred from screenshot) — Applied to the sticky top navigation bar to ensure it floats above content.
-   **Modal/Overlay (z-110)**: `rgba(97, 100, 117, 0.06) 0px 8px 10px 0px, rgba(97, 100, 117, 0.04) 0px 3px 14px 0px, rgba(97, 100, 117, 0.12) 0px 5px 5px 0px` (using hover shadow as a proxy for modal shadow, inferred) — Reserved for modals, dropdowns, and other elements that require highest visibility.

**Shadow Philosophy**: Snapp's shadow philosophy favors soft, diffuse shadows over sharp, deep ones. This approach contributes to the clean and modern aesthetic, providing just enough visual separation and elevation for interactive components like cards and buttons without making them feel heavy. The `elevation.hover` shadow provides a subtle lift effect, enhancing interactivity.

## 7. Do's and Don'ts

### Do's
-   **Do** use `{colors.primary}` (`#21aa58`) for all primary call-to-action buttons to maintain brand consistency.
-   **Do** ensure body text uses `{colors.text-primary}` (`#252a3c`) on `{colors.background}` (`#ffffff`) for a contrast ratio of 14.24, passing AAA.
-   **Do** apply `IRANSansXFaNum` `700` weight for all `H1` and `H2` headings to establish clear hierarchy.
-   **Do** utilize `{spacing.3xl}` (`64px`) for generous vertical section padding to create visual breathing room.
-   **Do** apply `{radius.sm}` (`8px`) to all `Standard Card` and `Primary Button` components for a consistent rounded aesthetic.
-   **Do** use `{colors.primary-text-green}` (`#22a958`) for `Standard Link` components on `{colors.background}` (`#ffffff`).
-   **Do** ensure `Text Input` fields display a `3px` `rgba(33, 170, 88, 0.2)` shadow on `:focus` for clear interaction feedback.
-   **Do** maintain a minimum `48px` height for `Primary Button` and `Secondary Button` components for touch target accessibility.
-   **Do** use `{elevation.card}` for `Standard Card` components in their default state.

### Don'ts
-   **Don't** use `{colors.primary-text-green}` (`#22a958`) on `{colors.background}` (`#ffffff`) for small text; its ratio of 3.05 only passes AA-large.
-   **Don't** introduce custom spacing values; adhere strictly to the `0, 4, 8, 12, 16, 24, 32, 64, 128px` spacing scale.
-   **Don't** use `text-secondary` (`#686c79`) on `surface-light` (`#f8f9ff`); its ratio of 4.98 barely passes AA, consider `text-primary`.
-   **Don't** apply sharp or deep shadows; stick to the soft `elevation.card` and `elevation.hover` definitions.
-   **Don't** use `IRANSansXFaNum` `400` weight for `H1` or `H2` headings; reserve `700` weight for these roles.
-   **Don't** use `text-inverse` (`#ffffff`) on `{colors.primary}` (`#21aa58`) for small text; its ratio of 3.02 only passes AA-large, ensure large text or different color.
-   **Don't** deviate from `{radius.sm}` (`8px`) for `Text Input` fields to maintain visual consistency.
-   **Don't** use `text-black` (`#000000`) for secondary or muted content; reserve `{colors.text-secondary}` (`#686c79`) for this purpose.

## 8. Responsive Behavior *(Suggested — not measured)*
_Note: breakpoints below are industry-standard recommendations, not measurements from the source. Adjust to the brand's actual media queries when implementing._

-   **Suggested Breakpoints**:
    -   **Mobile Small** (~320px): Stacks all content vertically.
    -   **Mobile Large** (~480px): Adjusts padding and font sizes slightly.
    -   **Tablet** (~768px): Introduces multi-column layouts; navigation collapses to a hamburger menu.
    -   **Desktop** (~1024px): Full desktop layout with expanded navigation.
    -   **Desktop Large** (~1440px): Maximizes content width up to `1376px`.
-   **Touch Targets**:
    -   Minimum touch target size for interactive elements like buttons should be `48px` by `48px`.
    -   Maintain at least `8px` (`var(--spacing-sm)`) of clear space between adjacent touch targets.
-   **Collapsing Strategy**:
    -   **Navigation**: Top navigation bar collapses into a hamburger menu icon on tablet and mobile.
    -   **Cards**: Multi-column card grids transition to single-column stacking on smaller viewports.
    -   **Typography**: Display and Heading sizes scale down appropriately for mobile legibility, e.g., `Display 33px` becomes `24px` on mobile.
    -   **Padding**: Horizontal section padding reduces from `64px` (`var(--spacing-3xl)`) to `24px` (`var(--spacing-xl)`) on mobile.
    -   **Forms**: Input fields maintain full width but may reduce vertical padding on mobile to save space.
    -   **Spacing**: Vertical spacing between major sections may be slightly reduced on mobile to optimize screen real estate.

## 9. Agent Prompt Guide
-   **Quick Color Reference**:
    -   `primary`: `#21aa58`
    -   `primary-dark`: `#029054`
    -   `primary-text-green`: `#22a958`
    -   `primary-text-green-dark`: `#248a4a`
    -   `accent-blue`: `#575eff`
    -   `background`: `#ffffff`
    -   `surface-light`: `#f8f9ff`
    -   `surface-light-blue`: `#eeefff`
    -   `surface-light-green`: `#e9f6ee`
    -   `text-black`: `#000000`
    -   `text-primary`: `#252a3c`
    -   `text-secondary`: `#686c79`
    -   `text-inverse`: `#ffffff`
-   **Iteration Guide**:
    1.  Always use `{colors.primary}` (`#21aa58`) for main call-to-action backgrounds.
    2.  Ensure `Primary Button` text is `{colors.text-inverse}` (`#ffffff`) and `font-weight: 500`.
    3.  Set all `H1` and `H2` headings to `font-weight: 700` using `IRANSansXFaNum`.
    4.  Apply `{spacing.xl}` (`24px`) as standard vertical padding between major content blocks.
    5.  Use `{radius.sm}` (`8px`) for `Standard Card` and `Primary Button` border-radius.
    6.  Ensure `Text Input` fields have a `3px` `rgba(33, 170, 88, 0.2)` focus ring.
    7.  Maintain `48px` minimum height for all interactive buttons.
    8.  Use `{elevation.card}` for default card shadows and `{elevation.hover}` for hover states.
    9.  Implement a `0.3s ease-out` transition for all interactive element state changes.
    10. Ensure `text-primary` (`#252a3c`) on `background` (`#ffffff`) is the default body text color pair.
    11. Collapse the main navigation into a hamburger menu on viewports below `768px`.
    12. Adhere to a `1376px` maximum content width for desktop layouts.