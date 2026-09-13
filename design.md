# MEKSS Design System

Design tokens and public-surface patterns for **MEKSS** (مدیریت یکپارچه شهرک صنعتی), adapted from an extraction of [snapp.ir](https://snapp.ir/) on 2026-09-13.

Source files:

- `design-system/tokens.json`
- `design-system/tokens.css`
- `mekss-industrial-park/src/styles/tokens.css` (app import mirror)
- `.extract-design-system/raw.json` (full dembrandt dump)

---

## Principles

1. **RTL-first Persian UI** — body copy, nav, and CTAs read right-to-left.
2. **Super-app clarity** — one brand, many services, shown as a scannable icon grid.
3. **Brand green as action** — primary actions use brand green; ink stays near-black navy.
4. **Light surfaces** — white / soft lilac-white backgrounds, soft grey borders, low elevation shadows.
5. **Project content, borrowed rhythm** — keep Snapp’s spacing, radius, and service-grid rhythm; replace services and copy with MEKSS domains.

---

## Color

| Token | Value | Role |
|---|---|---|
| `brand` | `#21aa58` | Primary CTA, logo mark, active accents |
| `brand-hover` | `#248a4a` | Hover / pressed green |
| `brand-soft` | `#e9f6ee` | Soft chips, secondary fills |
| `brand-soft-fg` | `#248a4a` | Text on soft green |
| `ink` | `#252a3c` | Headings and primary body |
| `muted` | `#686c79` | Secondary text, captions |
| `surface` | `#ffffff` | Page / card background |
| `surface-soft` | `#f8f9ff` | Alternating sections |
| `border` | `#ebecf2` | Dividers, outlined controls |
| `on-brand` | `#ffffff` | Text on green buttons |

Dashboard and authenticated shells may keep the existing blue primary (`#0f4c81`) until a full theme migration. **Public marketing surfaces** (landing, directory shells when restyled) use this green system.

---

## Typography

| Role | Size | Weight | Line height |
|---|---|---|---|
| Display | 32px | 700 | 1.4 |
| Title | 20px | 700 | 1.5 |
| Body | 16px | 400 | 1.7 |
| Body strong | 16px | 500 | 1.5 |
| Button | 16px | 700 | 1 |
| Caption | 14px | 400–500 | ~1.7 |
| Label | 12px | 500 | 1.4 |

Snapp detected **IRANSansXFaNum**. MEKSS continues to ship **Vazirmatn** (`@fontsource/vazirmatn`) as the licensed equivalent. Do not hotlink Snapp font files.

---

## Spacing

8px base scale from extraction:

`4 · 8 · 10 · 12 · 16 · 24 · 32`

Prefer `16` / `24` / `32` for section padding; `8` / `12` for control guts.

---

## Radius

| Token | Value | Typical use |
|---|---|---|
| `sm` | 8px | Buttons, chips, inputs |
| `md` | 12px | Service tiles, media |
| `lg` | 16px | Large panels / images |
| `xl` | 32px | Soft pills / large CTAs |
| `pill` | 9999px | Carousel dots, tags |

---

## Shadows

- **card** — light multi-layer grey shadow for service tiles
- **elevated** — deeper variant for hovered / featured blocks

Avoid heavy glow or multi-layer brand-colored shadows.

---

## Components (public)

### Primary button

Green fill `#21aa58`, white text, 8px radius, ~48px height, bold 16px, horizontal padding 24px. Hover → `#248a4a`.

### Secondary button

Transparent fill, 1px solid brand green, brand green text, 8px radius, medium weight.

### Soft button

Fill `#e9f6ee`, text `#248a4a`, 8px radius.

### Service tile

Interactive link (not decorative card chrome): icon in a soft rounded square, short label under it, white/soft surface, optional `shadow-card` on hover. One job per tile — navigate to a MEKSS capability.

---

## Landing page composition

Mirror Snapp’s public homepage **structure**, not its product copy:

1. **Sticky header** — MEKSS mark + compact nav + primary CTA (ثبت‌نام / ورود)
2. **Hero (first viewport)** — brand name as hero signal, one headline, one supporting sentence, one CTA group, one full-bleed industrial image
3. **Services grid** — “یک سامانه برای تمام نیازهای شهرک” with MEKSS services
4. **Value section** — why factories / guards / managers use MEKSS
5. **Join CTA** — register / login strip
6. **Footer** — brand + short tagline + public links

### MEKSS service map (replaces Snapp’s taxi/food grid)

| Service | Route / intent |
|---|---|
| دایرکتوری واحدها | `/directory` |
| فروشگاه واحدها | `/shops` |
| مجوز عبور | `/login` → gate passes |
| قبض و پرداخت | `/login` → invoices |
| درخواست خدمات | `/sms-request` or `/login` |
| اطلاعیه‌ها | `/login` → announcements |
| آگهی‌ها | `/login` → advertisements |
| اضطراری | `/login` → emergency |
| ورود به سامانه | `/login` |
| ثبت‌نام | `/register` |

---

## Motion

Reuse existing utilities:

- `animate-fade-in` — hero media / page enter
- `animate-slide-up` — staggered section content (80–200ms delays)

Motion should clarify hierarchy (hero → services → CTA), not decorate every tile.

---

## Do / Don’t

**Do**

- Keep Persian copy short and operational
- Use brand green only for actions and brand marks
- Prefer white / soft surfaces for public pages
- Put real industrial imagery in the hero

**Don’t**

- Copy Snapp logos, illustrations, or marketing sentences
- Load IRANSans from Snapp CDNs
- Put stats, schedules, or promo stickers in the first viewport
- Turn the authenticated dashboard green without an explicit migration pass
