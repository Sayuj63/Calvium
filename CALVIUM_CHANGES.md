# Calvium Store — Change Log & Resume Context

> **Purpose**: complete record of every change shipped to the live Calvium Shopify theme so future sessions can pick up with zero re-investigation.

---

## 0. Store / theme / environment

| Item | Value |
|---|---|
| **Store** | `calvium-2.myshopify.com` |
| **Custom domain** | `calvium.in` |
| **Admin** | https://admin.shopify.com/store/calvium-2 |
| **Live theme** | `Calvium/main` — id **`191621005684`** (GitHub-connected) |
| **Live theme editor** | https://admin.shopify.com/store/calvium-2/themes/191621005684/editor |
| **GitHub repo** | https://github.com/Sayuj63/Calvium.git (branch: `main`) |
| **Deploy flow** | `git commit` → `git push origin main` — Shopify GitHub sync updates the live theme automatically (no `shopify theme push` needed) |
| **Theme family** | Swytch (block-heavy, group-nested) — 75 sections, 231 block types, ~250 assets |
| **Working dir** | `~/Desktop/Desktop - Sayuj's MacBook Air/calvium` |
| **Locale** | India only — `calvium.in` serves IN traffic |
| **Customer accounts** | Enabled — `/account` returns 302 (login redirect) |

### Previous live theme (now unpublished)
`Swytch Default Day1` (#184946491764) was the live theme through session 20. It's now unpublished but still receives Shopify CLI pushes if you forget to switch — **always deploy via git to `Calvium/main` (#191621005684) instead**.

### Backup theme
`Calvium fixes 2026-06-01` (#189635920244) is unpublished but kept as a rollback copy of an intermediate state. Safe to delete with `shopify theme delete 189635920244` if no longer needed.

---

## 1. Critical conventions & gotchas

### 1.1 Shopify CDN HTML cache (CRITICAL — read first)
Shopify aggressively caches rendered HTML at the CDN edge. After **every push**, `calvium.in` may serve stale HTML for **30–60 minutes**. To verify a change is live, **always append `?_fd=0` to the URL** — that's Shopify's official cache-bypass query parameter. Without it, you'll see stale content and assume your fix didn't land.

```bash
# Always verify pushes with this pattern:
curl -s "https://calvium.in/some-path?_fd=0" > /tmp/check.html
```

### 1.2 Push command (live theme — preferred)
```bash
shopify theme push --store calvium-2.myshopify.com --theme 184946491764 \
  --nodelete --allow-live \
  --only "path/to/file1" --only "path/to/file2"
```

**Always use `--only` flags** for targeted pushes — never push the whole tree. Bulk pushes risk overwriting admin-editor changes the merchant may have made between sessions.

### 1.3 CLI auth
The CLI may need re-authentication. If push errors with "don't have access to this dev store", run:
```bash
shopify theme list --store calvium-2.myshopify.com
```
which triggers the device-code OAuth flow. Don't run `shopify auth logout` mid-session — the device code expires in ~60s and re-authing is painful.

### 1.4 Verifying after push
Standard verification pattern:
```bash
sleep 5
curl -s "https://calvium.in/PATH?_fd=0" 2>/dev/null > /tmp/check.html
# then grep/inspect specific selectors / data attributes
```

### 1.5 `templates/index.json` is huge (~330 KB)
Read it via Python with comment stripping:
```python
import json, re
raw = open('templates/index.json').read()
clean = re.sub(r'^\s*/\*.*?\*/\s*', '', raw, count=1, flags=re.DOTALL)
data = json.loads(clean)
```

The leading `/* ... */` comment must be stripped before JSON parsing.

### 1.6 Brand decisions locked in
- **Primary button color**: black `#000` bg, white text, `#1f1f1f` hover (NOT brand-blue `#000f9f` — that variable exists but isn't used on CTAs)
- **Shipping calculator**: India only, hardcoded 36 states + UT dropdown, 6-digit numeric PIN
- **Login SSO** (Google/Apple): SKIPPED — needs Shopify admin → Customer accounts → Authentication setup before UI buttons make sense
- **Wishlist heart link**: defaults to `/account` until a `wishlist` page is created in admin

---

## 2. Custom override file — `assets/calvium-overrides.css`

Loaded LAST in `snippets/global-css.liquid`. Contains only **verified-working selectors** and CSS-variable cascade overrides that can't reasonably live in source files.

**Audit done** — every selector checked against `curl ... ?_fd=0` and confirmed present in live HTML.

**Loaded via**: `snippets/global-css.liquid` (added after `animation.css` so it wins specificity).

### What's in it (and why each must be CSS)
| Rule | Why it can't be moved to source |
|---|---|
| Wishlist + share button white icons next to ADD TO CART | SVG `currentColor` inheritance requires CSS cascade |
| Defensive solid-color swatches | Insurance vs. browser-cached HTML with stale variant_image URLs |
| Shop By Style tab states (idle/hover/active) | `base.css` line 22468 + 2693 use `--button-*` CSS variables from color schemes — only var override breaks the cascade |
| Header heart icon stroke matching | SVG inline asset — CSS is the only way without editing every SVG file |
| `.facet-per-page` hide | Filter element rendered inside shared Shopify snippet across multiple sections |
| `.multi-t__button` recolor | Same FAB element reused by multiple block types |
| Lookbook hover-image swap | Hover state — CSS-only |
| Best-seller card-information spacing | Cross-cutting tweak |
| Breadcrumb gap | Applies on every page |
| `.product-grid` margin tighten | Cross-cutting collection-page tweak |
| `.page-title` styling | Paired with inline style emitted by `sections/main-page.liquid` |
| Third-party (Judge.me etc.) button colors | Third-party HTML — CSS-only |

### Removed (selectors that didn't exist)
`.recently-viewed-products-popup__opener`, `.recently-viewed-products-floating`, `.share-button-floating`, `.header__icons` (plural — actual is `.header__icon` singular), `.facets-toolbar`, `.items-per-page`, `.facets__items-per-page`, `.collection-sort__dropdown`, `.collection__title`, `.main-collection-product-grid__title`, `.collection__products`, `.collection-list__item .button` absolute positioning (was breaking layout), various `.media--portrait` / `.featured-collection__item` / `.lookbook__item` variants — none existed in live HTML.

---

## 3. Source-level fixes (preferred — most fixes live here)

### 3.1 `config/settings_data.json`
| Change | Why |
|---|---|
| Color schemes 6, 7, 8: `primary_button: "#000000"`, `primary_button_text: "#ffffff"` (was `"#ff0000"` red) | Product page (uses scheme-6) was rendering ADD TO CART text in pure red. Root cause was scheme data, not button CSS. |
| 7 instances of `swatch_type: "variant_image"` → `"color"` | Variant picker showed model-photo thumbnails instead of solid color swatches. Theme schema default was `"color"` but data overrode it everywhere. |
| Added top-level `link_wishlist: "/account"` | Header heart icon was rendered as `<a aria-disabled="true">`. Now points to /account (always works, redirects to login if guest). |

### 3.2 `sections/main-page.liquid`
- Reordered: blocks render BEFORE `{{ page.content }}` (was reversed — caused Privacy Policy heading to drop to the bottom of content).
- Added **policy-handle whitelist auto-h1**: pages with handle `privacy-policy / return-policy / shipping-policy / refund-policy / terms-of-service / terms-and-conditions / terms-conditions / cookie-policy` always render `<h1 class="page-title">{{ page.title }}</h1>` at the top — fixes "no heading" issue without affecting Contact/About/FAQ (which have their own heading blocks).

### 3.3 `sections/popup-group.json`
- `multitasking_bar_AY9KgF.settings.secondary_background`: `#1199bb` → `#000000` — recolors the floating FAB widget (recently-viewed / share / back-to-top) to brand black instead of teal.

### 3.4 `sections/featured-collection-list.liquid`
- Added `autoplay` (checkbox) and `autoplay_speed` (range, 1000–9000ms) settings to the schema — were missing despite the swiper-data snippet expecting them.

### 3.5 `sections/main-login.liquid`
- "Forgot your password?" email field: added `required` + `oninvalid="this.setCustomValidity('Please enter your email first')"` + `oninput="this.setCustomValidity('')"` — shows browser-native validation message instead of silently navigating away.

### 3.6 `snippets/header-functions.liquid`
- **Heart icon replaced** with inline SVG matching `icon-search.svg` style: `viewBox="0 0 18 19"`, `<svg fill="none">`, `<path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd">`. Previous heart used viewBox 20×20 (smaller relative shape) + lacked `fill="none"` on svg.
- **Disabled fallback removed**. New href resolution chain: `settings.link_wishlist` → `pages['wish-list']` → `pages['wishlist']` → `/account`. `wishlist_disabled` always = false, so the `<a>` always renders with `href`, no `aria-disabled`, no `tabindex="-1"`.

### 3.7 `snippets/cart-shipping-calculator.liquid`
- Country `<select>` replaced with hidden `<input value="India">`. The `country-province-component` web component (assets/cart.js:884) was kept out of the wrapping element because it expects `.options` on a `<select>`, not an `<input>` — would crash on init.
- State `<select>` hardcoded with 28 Indian states + 8 UTs (sorted: states first, UTs after).
- PIN code `<input>`: `inputmode="numeric"`, `pattern="[1-9][0-9]{5}"`, `maxlength="6"`, `minlength="6"`, `oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,6)"`, `required`.

### 3.8 `blocks/_lookbook-item-all.liquid`
- Rewrote the slide loop to render each product **inline** (anchor → image + title + price) instead of using `content_for 'block' id: 'product-slide-item'`. Static blocks in Shopify can't be instantiated multiple times — using the same `id` in a loop made all 7 slides render the FIRST product only. The "swiping shows same product" bug was a Shopify limitation, not a data issue.
- Added `<img class="lookbook-hover-image">` for the second product image with CSS-driven hover swap.

### 3.9 `blocks/testimonial.liquid`
- Added `autoplay` (checkbox) + `autoplay_speed` (range 1000–9000ms) to schema. The swiper-data snippet was reading these settings but the schema didn't expose them.
- Note: `autoplay_speed.max` is 9000 (not 10000) — Shopify schema validator rejects `max == 10000` for range type.

### 3.10 `assets/base.css`
| Line | Change | Why |
|---|---|---|
| ~4881 | Added nested rule inside `.swiper { }` block: `.type-style--tabs-carousel &:not(.product-slider) { --swiper-navigation-top-offset: calc(50% - 5rem); }` | Default `--swiper-navigation-top-offset: 50%` positioned tabs-carousel arrows in the middle of (image + info), landing in lower-image area. Subtracting 5rem (~half info-area height) shifts them up to the image's vertical center. |

### 3.11 `assets/component-card.css`
| Line | Change | Why |
|---|---|---|
| 191 | `object-position: var(--image-focal-point, center center)` → `var(--image-focal-point, center 18%)` | Global head-cut fix. Default focal point shifted 18% from top so portrait model shots don't crop heads. Per-image `--image-focal-point` overrides still work. |

### 3.12 `assets/section-main-product.css`
| Class | Change |
|---|---|
| `.thumbnail img` | Added `object-position: center 15%` — PDP gallery thumbnails don't crop heads. |

### 3.13 `templates/index.json` — homepage data fixes

| Change | Why |
|---|---|
| Collection-list tile 3 + 4 `group-basic.padding-block-end: 32 → 10` (normalized to match tiles 1, 2) | Buttons (EVERYDAY / WORK ESSENTIAL / AFTER HOURS / NEW COLLECTION) were at different vertical positions because tiles 3, 4 had 22px more bottom padding — purely a data inconsistency. |
| Testimonial section (`testimonial_ndDeXn`): `autoplay: true`, `autoplay_speed: 2000` | Auto-rotate testimonials every 2s per client doc. |
| Replaced 3 placeholder Victoria Jenny testimonials with: Aanya Mehta (Mumbai), Rohan Iyer (Bengaluru), Priya Sharma (New Delhi) — each with unique professional review copy | Original copy was repeated 3× verbatim. |
| Both featured-collection-list sections: `autoplay: true`, `autoplay_speed: 4000` | Best Seller carousels auto-rotate. |
| Product card spacing tightened in both `featured_collection_list_Hpc6Lq` + `featured_collection_list_taYCCp` (18 data values total): | Card content (name, price, swatches) had huge gaps. |
| – `card-product-flex.padding-block-start/end: 36 → 12` | |
| – `card-product-flex.gap: 12 → 4` | |
| – `_card-product-information.gap_y/gap_x: 10 → 4` | |
| – 4× inline `spacer.spacer_height: 2 → 0` and `6 → 0` | |
| – 2× bottom `spacer.spacer_height: 16 → 6` | |

### 3.14 `templates/page.json` (default page template)
- Removed dummy text block (`"_removed_text_4Jqeij"`) containing "Below FAQ are some common concerns…" placeholder copy.
- Heading text block (`text_q48tHr`) bumped to: `type_preset: "h1"`, `font_size: "3.6rem"`, `font: var(--font-heading--family)`.
- Section padding: `padding-block-start: 40`, `padding-block-end: 40` (was 0/0 — content was slammed against header).

### 3.15 `templates/page.faqs.json`
- `group_6C8rTF.settings.link`: `""` → `"mailto:info.calvium@gmail.com"` (Message Us button)
- `group_pgePLm.settings.link`: `""` → `"/pages/contact"` (Contact Us button)

### 3.16 `templates/page.contact.json`
- Deleted `section_ApznVq` from `order` AND from `sections` block — was rendering a duplicate "main-menu" nav strip below the CONTACT US hero.
- `button_rHRrd6.settings.link`: `""` → `"/pages/store-locator"` (FIND A STORE button)

### 3.17 Product templates (9 files)
**All `agree_condition: true` → `false`** in:
- `templates/product.json`
- `templates/product.product-grid.json`
- `templates/product.product-full-width.json`
- `templates/product.product-image-gallery.json`
- `templates/product.product-slider.json`
- `templates/product.product-left-thumbnails.json`
- `templates/product.product-right-thumbnails.json`
- `templates/product.quick_add.json`
- `templates/product.template-step-by-step.json`

Removes the "I agree with Terms & Conditions" checkbox above BUY IT NOW on every product template.

### 3.18 `snippets/global-css.liquid`
- Added `<link rel="stylesheet" href="{{ 'calvium-overrides.css' | asset_url }}">` at the end so it loads LAST (highest CSS specificity).
- Also added to the `<noscript>` fallback block.

---

## 4. Mapping of original client doc → fixes

| Doc # | Issue | Where it was fixed |
|---|---|---|
| 1 | FAQ Message Us / Contact Us buttons | `templates/page.faqs.json` |
| 2 | Privacy Policy heading at bottom | `sections/main-page.liquid` |
| 3 | Return Policy no heading | Same |
| 4 | Shipping Policy no heading | Same |
| 5 | Add-to-cart red buttons | `config/settings_data.json` color schemes 6/7/8 |
| 6 | T&C checkbox | 9 product templates |
| 7 | Head-cut global | `component-card.css` + `section-main-product.css` |
| 8 | Contact duplicate nav | `templates/page.contact.json` |
| 9 | Breadcrumb→title gap | `calvium-overrides.css` |
| 10 | FIND A STORE button | `templates/page.contact.json` |
| 11 | Items-per-page filter | `calvium-overrides.css` (`.facet-per-page`) |
| 12 | FAB widget teal | `sections/popup-group.json` |
| 13 | Header heart pale | `calvium-overrides.css` + `snippets/header-functions.liquid` |
| 14 | Collection-list buttons not aligned | `templates/index.json` (padding normalized) |
| 15 | Shop By Style tab states | `calvium-overrides.css` |
| 16 | Best-seller autoplay | `sections/featured-collection-list.liquid` schema + `index.json` |
| 17 | Lookbook hover swap + 7 distinct products | `blocks/_lookbook-item-all.liquid` |
| 18 | Testimonials replaced + autoplay 2s | `index.json` + `blocks/testimonial.liquid` schema |
| 19 | Repeating product images on collections | **User said leave it** |
| 20 | Collection title→grid gap | `calvium-overrides.css` |
| 21 | Login modal (placeholder + hover + forgot-pw) | `sections/main-login.liquid` + CSS. **SSO skipped** |
| 22 | Search page polish | `calvium-overrides.css` |
| 23 | Shipping calculator India + states + ZIP | `snippets/cart-shipping-calculator.liquid` |
| 24 | Cart drawer totals spacing | `calvium-overrides.css` |
| 25 | Cart × cross alignment | `calvium-overrides.css` |
| 26 | Recently viewed CHOOSE OPTIONS | `calvium-overrides.css` |
| 27 | Write a Review button | `calvium-overrides.css` |
| 28 | Variant picker colors not photos | `config/settings_data.json` (7 swatch_type entries) |
| 29 | Share icon not white | `calvium-overrides.css` (fill: currentColor, NOT fill: none) |
| 30 | Lookbook same-product repeating | `blocks/_lookbook-item-all.liquid` |
| 31 | Wishlist heart icon clickable + visual match | `snippets/header-functions.liquid` + `config/settings_data.json` |
| 32 | Tabs-carousel arrows vertically centered on image | `assets/base.css` (`--swiper-navigation-top-offset: calc(50% - 5rem)`) |
| 33 | Product card spacing tightened | `templates/index.json` (18 data values) |

---

## 5. Known limitations / open items

### Things the merchant needs to do in admin (out of CLI reach)
1. **Create a Page with handle `wishlist`** and assign template `page.template-wishlist` to it. Once done, change `settings.link_wishlist` in admin → Theme Settings → Wishlist link to `/pages/wishlist`. Until then, heart routes to `/account`.
2. **Enable Google/Apple OAuth** in admin → Settings → Customer accounts → Authentication if you want SSO buttons on the login modal.
3. **Verify Return Policy and Shipping Policy pages** use a template. The auto-h1 fallback in `main-page.liquid` works regardless, but admins should pick "Default page" template for cleanest behavior.
4. **Repeating product images on Collections page** is a data/content issue (uploading distinct featured images per product) — explicitly left alone per merchant request.

### Lookbook section
- **Dots precisely over products** requires per-image x/y coordinate tagging from admin — content work, not theme code. Currently only the hover-image swap + VIEW MORE centering were fixed.

### Product card spacing
- The tightening so far covers only the **homepage Best Seller tabs-carousels**. If the merchant wants the same tighter rhythm on Collection pages / Recently-viewed / other surfaces, target those template JSONs the same way (don't shotgun a CSS `!important` rule globally — it's harder to undo per surface).

### Carousel arrow position (`calc(50% - 5rem)`)
- Tuned for current info-area height after the spacing tightening. If product info area gets bigger again (e.g., quantity badges added), bump the offset to `calc(50% - 6rem)` or similar.

---

## 6. Verification commands cheat sheet

```bash
# Always cache-bust on calvium.in:
curl -s "https://calvium.in/PATH?_fd=0" 2>/dev/null > /tmp/x.html

# Verify a specific element exists / has expected attribute:
grep -oE '<a[^>]*header-wishlist[^>]*>' /tmp/x.html
grep -oE '<h1[^>]*class="page-title"[^>]*>[^<]+</h1>' /tmp/x.html
grep -oE 'spacerHeight:\s*\d+px' /tmp/x.html

# Pull a file from the remote theme to verify push synced:
mkdir -p /tmp/remote && cd /tmp/remote
shopify theme pull --store calvium-2.myshopify.com --theme 184946491764 \
  --only "path/to/file" --nodelete

# Check current published theme:
shopify theme list --store calvium-2.myshopify.com

# Re-publish the previous Swytch theme if anything blows up:
shopify theme publish --store calvium-2.myshopify.com --theme 184946491764
```

---

## 7. Files modified (complete list)

```
assets/calvium-overrides.css           [NEW] custom override file (loaded last)
assets/base.css                        — tabs-carousel arrow position rule (1 nested CSS block)
assets/component-card.css              — head-cut focal-point default (1 line)
assets/section-main-product.css        — thumbnail object-position (1 line)

config/settings_data.json              — color schemes 6/7/8 button colors, swatch_type (7x), link_wishlist
sections/main-page.liquid              — block ordering + policy-handle auto-h1
sections/popup-group.json              — multitasking-bar secondary_background
sections/featured-collection-list.liquid — autoplay schema
sections/main-login.liquid             — forgot-password email required + custom validity

snippets/global-css.liquid             — load calvium-overrides.css last
snippets/header-functions.liquid       — inline heart SVG + wishlist link resolution
snippets/cart-shipping-calculator.liquid — India only + state dropdown + PIN regex

blocks/_lookbook-item-all.liquid       — rewrote slide loop to render products inline
blocks/testimonial.liquid              — autoplay schema

templates/index.json                   — homepage data: collection-list padding, testimonial copy + autoplay,
                                         featured-collection-list autoplay + product card spacing
templates/page.json                    — removed dummy block, h1 styling, padding
templates/page.faqs.json               — wired Message Us + Contact Us buttons
templates/page.contact.json            — removed dup nav section, wired FIND A STORE
templates/product.json                 — agree_condition false
templates/product.product-grid.json    — same
templates/product.product-full-width.json — same
templates/product.product-image-gallery.json — same
templates/product.product-slider.json  — same
templates/product.product-left-thumbnails.json — same
templates/product.product-right-thumbnails.json — same
templates/product.quick_add.json       — same
templates/product.template-step-by-step.json — same
```

---

## 8. Important debugging principles (learned the hard way)

1. **NEVER trust CSS selector names from memory** — always `curl ?_fd=0` and grep the live HTML to find the ACTUAL class names being rendered. Many "guessed" selectors (e.g., `.facets-toolbar`, `.header__icons` plural, `.recently-viewed-products-popup__opener`) didn't exist in this theme's output.
2. **Fix at the lowest layer that solves the problem** — data > schema > Liquid > original CSS > override CSS, in that order. Use the override file ONLY when CSS-variable cascades or third-party HTML make source edits impractical.
3. **Shopify schema range setting `max` must be strictly `< 10000`** — `max: 10000` fails validation.
4. **Liquid `visible_if` doesn't accept `(A or B) and C`** — only flat comparisons. Simplify to `{{ a.something == 'x' }}`.
5. **`content_for 'block', id: '...'` inside a `{% for %}` loop renders the SAME static block N times** — it's a singleton. Don't use it for collections; render inline instead.
6. **Shopify Page presets that reference block types not in the section's allowed-blocks array fail validation and cascade-break every template that uses the section** — verify presets when adding `@theme` to a section's blocks array.
7. **`fill="none"` on an SVG path destroys icons that use `fill="currentColor"` on the path** (e.g., `icon-share-social.svg`). Set `color` on parent and let SVG inherit via currentColor — don't blanket-set fill: none.
8. **Shopify CDN HTML cache** — see §1.1. This bit me multiple times before I learned to always use `?_fd=0`.

---

_Last updated: 2026-07-14 — Homepage fully migrated to CALVIUM- sections (11 of 12); wishlist header + cart bubble fixed._

---

## 9. Session 2026-06-02 — Lookbook redesign (issue 34)

### Problem (from user screenshot)
1. Right side image (the lookbook-item-all product carousel) looked much smaller than the left banner image.
2. VIEW MORE button had ~150–180 px of empty space above it.
3. Carousel arrows below the right product card were invisible on mobile.

### Root cause
Section `lookbook_q8nVmX` → block `static-lookbook` (`_lookbook`) → child `lookbook_row_6n8gfq` (`_lookbook-row`) → child `lookbook_item_all_MeQyYq` (`_lookbook-item-all`).

| Issue | Why |
|---|---|
| Right image small | `lookbook_item_all_MeQyYq.width = "custom"`, `custom_width = 50` → only 50 % of its column = 25 % of section width. Row container also had `padding-inline-start/end: 15` and `padding-block-start: 32`. |
| VIEW MORE huge gap | `spacer_L7cdrJ.spacer_height = 100`, plus `lookbook_item_all_MeQyYq.navigation_margin_top = 32` and `navigation_margin_bottom = 48` stacked to ~180 px between carousel and button. |
| Mobile arrows hidden | `blocks/_lookbook-item-all.liquid` wraps the swiper button bar in `.small-hide` (defined in `assets/base.css` line 455 as `display: none !important` below 750 px). |

### Fixes shipped

**`templates/index.json` → `sections.lookbook_q8nVmX.blocks.static-lookbook.blocks.lookbook_row_6n8gfq`:**
| Path | Before | After |
|---|---|---|
| `.settings.padding-block-start` | 32 | 0 |
| `.settings.padding-block-end` | 15 | 0 |
| `.settings.padding-inline-start` | 15 | 0 |
| `.settings.padding-inline-end` | 15 | 0 |
| `.blocks.lookbook_item_all_MeQyYq.settings.width` | "custom" | "fill" |
| `.blocks.lookbook_item_all_MeQyYq.settings.navigation_margin_top` | 32 | 12 |
| `.blocks.lookbook_item_all_MeQyYq.settings.navigation_margin_bottom` | 48 | 12 |
| `.blocks.lookbook_item_all_MeQyYq.settings.always_show_swiper_button` | false | true |
| `.blocks.spacer_L7cdrJ.settings.spacer_height` | 100 | 16 |

`always_show_swiper_button: true` makes the swiper button wrapper carry the class `always_show_swiper_button` (see `blocks/_lookbook-item-all.liquid` line 117). The CSS rule below uses that class to override `.small-hide` only inside `.lookbook-item-all`.

**`assets/calvium-overrides.css` — section 13 appended:**
```css
@media screen and (max-width: 749px) {
  .lookbook-item-all .swiper-btns-wrap.small-hide.always_show_swiper_button {
    display: flex !important;
  }
}
.lookbook-item-all .swiper-btns-wrap--bottom {
  margin-top: var(--mt, 12px);
  margin-bottom: var(--mb, 12px);
}
```

Scoped to `.lookbook-item-all` so other `.small-hide` swiper bars in unrelated sections (e.g. testimonials, best-sellers) still hide on mobile as designed.

### Files modified
```
templates/index.json                 — 9 data values inside lookbook_q8nVmX
assets/calvium-overrides.css         — added section 13 (lookbook arrows on mobile + bottom margin defaults)
```

### Push command used
```
shopify theme push --store calvium-2.myshopify.com --theme 184946491764 \
  --nodelete --allow-live \
  --only "templates/index.json" \
  --only "assets/calvium-overrides.css"
```

### Verification
- `shopify theme pull --only` of both files into `/tmp/remote-check` confirms all 9 data values + new CSS rule are on the live theme.
- Live HTML at `calvium.in/?_fd=0` was still cached at verification time (§1.1 — Shopify CDN HTML cache 30–60 min). Admin theme editor bypasses the cache and shows updates immediately.

### Known limitations / follow-ups
- Dot positions on the left banner were untouched — still per `lookbook_item_cUNxE6` admin coordinates.
- If the right product card image now overshoots the left banner height (3/4 aspect at full column width), revisit `.lookbook-item-all .card__media { aspect-ratio: 3/4 }` in `calvium-overrides.css` and consider tightening to `4/5` or adding a `max-height`.

---

## 10. Session 2026-06-02 part 2 — Header heart icon + collection/search card unification

### 10.1 Header heart icon — visual match with other icons (issue 35)

**Problem:** Heart icon in the header looked like a thin outline ring while `icon-account`, `icon-search`, `icon-cart` are solid filled silhouettes — visual mismatch in the icon row.

**Root cause:** The inline heart SVG in `snippets/header-functions.liquid` used a single `<path d="…">` with **two subpaths** (`M9 15.5…Z M9 13.5…Z`) plus `fill-rule="evenodd"`. evenodd subtracts the inner subpath from the outer one → renders as a hollow ring. The other three icons each use a single closed subpath.

**Fix:**
- `snippets/header-functions.liquid` — dropped the inner `M9 13.5…Z` subpath. Heart is now a single closed solid subpath at viewBox `0 0 18 19`, `fill="currentColor"` on the path — same recipe as `icon-account.svg` and `icon-search.svg`.
- `assets/calvium-overrides.css` rule 5 — removed `stroke-width: 1.5 !important` and `stroke: currentColor !important` (they were workarounds for the old outline heart and would draw a stroke on top of the new solid fill). Replaced with explicit `fill: currentColor !important; stroke: none !important`.

**Note:** `stroke-width: 1.5` is still present at `calvium-overrides.css:70` but on a **different rule** — `.product-form .wishlist-button svg path[fill="none"]` which targets the PDP wishlist/share buttons next to ADD TO CART (different surface, deliberately outlined). Header heart is fully decoupled.

### 10.2 Heart click → `/account` — confirmed correct (by design)

Resolution order in `snippets/header-functions.liquid:52–60`:
1. `settings.link_wishlist` (admin theme settings)
2. Page with handle `wish-list`
3. Page with handle `wishlist`
4. `/account` fallback

`settings.link_wishlist` is currently `/account` (set in `config/settings_data.json` last session) and no `wishlist` page exists in admin yet, so the heart routes to `/account` → 302 redirects to login. User confirmed this is the desired behaviour until a wishlist page or app is wired up.

### 10.3 Product card unification — Option A applied to collection + search

**User request:** copy the tabs-carousel (Best Seller) card style across the store.

**Diff between the two card systems:**
| Setting | Tabs-carousel (`card-product-flex`) | Collection grid (`_product-card`) |
|---|---|---|
| Outer `gap` | 4 | 10 |
| Outer block type | `card-product-flex` | `_product-card` |
| Media block type | `_card-product-media-flex` | `_card-product-media` |
| `image_ratio` | `adapt` | `square` on `collection.json` only; `adapt`/`portrait` elsewhere |
| `enable_quick_add` | n/a | `true` (keeps the "Choose options" hover) |
| Info `gap_y` / `gap_x` | 4 / 4 | 10 / 10 (some 6 / 10) |
| Font sizes on vendor/title/price | 1.6rem each | 1.6rem each ✅ same |

**Decision: Option A — settings-only, do not swap block types.** Block-type swap (`_product-card` → `card-product-flex`) would require editing `sections/main-collection-product-grid.liquid:97` and rebuilding the JSON wiring on every collection variant — high regression risk on the highest-traffic surface. Settings-only gets ~85 % visual match with zero liquid edits.

**Per-template changes (6 files):**
| Template | Changes |
|---|---|
| `templates/collection.json` | `_product-card.gap` 10→4; `_card-product-media.image_ratio` square→adapt; 3× `_card-product-information.gap_y/gap_x` 10→4 |
| `templates/collection.collection-banner-adv.json` | `_product-card.gap` 10→4; 2× `_card-product-information.gap_y/gap_x` 10/6→4 |
| `templates/collection.collection-full-width.json` | same pattern |
| `templates/collection.collection-full-width-2.json` | same pattern |
| `templates/collection.collection-right-sidebar.json` | same pattern |
| `templates/search.json` | `_product-card.gap` 10→4; `_card-product-information.gap_y/gap_x` 10→4. `image_ratio` left at `portrait` (deliberate — search results stay taller). |

**Preserved everywhere:**
- `enable_quick_add: true` on `_card-product-media` (keeps "Choose options" hover overlay — removing would hurt conversion).
- `show_secondary_image: false` (no surprise image swap on hover).
- All vendor/title/price typography (already matched at `1.6rem`).
- Color schemes, padding, alignment.

**Deliberately NOT touched** (already use `card-product-flex` natively or are sufficiently different surfaces that 4-px gaps would feel cramped):
- Product page recommendation cards (`templates/product*.json`)
- Cart popular products (`templates/cart.json`)
- Blog / article product sidebars
- Page lookbook / sub-collection / landing templates

If we later want those tightened too, repeat the same script with their paths.

### Files modified (this session)
```
snippets/header-functions.liquid                            — single-subpath solid heart SVG
assets/calvium-overrides.css                                — rule 5 (.icon-heart) rewritten to fill, no stroke

templates/collection.json                                   — square→adapt + 4-px gaps
templates/collection.collection-banner-adv.json             — 4-px gaps
templates/collection.collection-full-width.json             — 4-px gaps
templates/collection.collection-full-width-2.json           — 4-px gaps
templates/collection.collection-right-sidebar.json          — 4-px gaps
templates/search.json                                       — 4-px gaps (image_ratio kept portrait)
```

### Push commands used
```
shopify theme push --store calvium-2.myshopify.com --theme 184946491764 \
  --nodelete --allow-live \
  --only "snippets/header-functions.liquid" --only "assets/calvium-overrides.css"

shopify theme push --store calvium-2.myshopify.com --theme 184946491764 \
  --nodelete --allow-live \
  --only "templates/collection.json" \
  --only "templates/collection.collection-banner-adv.json" \
  --only "templates/collection.collection-full-width.json" \
  --only "templates/collection.collection-full-width-2.json" \
  --only "templates/collection.collection-right-sidebar.json" \
  --only "templates/search.json"
```

### Verification
`shopify theme pull --only` of `templates/collection.json`, `templates/search.json`, `snippets/header-functions.liquid`, `assets/calvium-overrides.css` confirmed:
- collection.json: `_product-card.gap=4`, `card-product-media.image_ratio=adapt`, `card-product-information.gap_y/gap_x=4/4`
- search.json: `_product-card.gap=4`, `image_ratio=portrait` (preserved), `gap_y/gap_x=4/4`
- header-functions: no `M9 13.5` substring (old ring path gone), `d` attribute has a single `Z` (single closed subpath)
- calvium-overrides.css: contains `fill: currentColor !important` on `.icon-heart path`

Live HTML cache 30–60 min per §1.1; admin theme editor reflects immediately.

### Notes for the next session
- If the tighter 4-px gaps feel too cramped on the collection grid in real use, raise to 6 (sits between the original 10 and the tabs-carousel's 4). Single global edit per template.
- If the user wants the full `card-product-flex` block swap later, the work order is: edit `sections/main-collection-product-grid.liquid` to use `type: "card-product-flex"` in the `content_for` call, then rewrite each `templates/collection*.json` `product-card` block to the flex shape (sample structure already lives in `templates/index.json` under `featured_collection_list_Hpc6Lq.blocks.product-slide-item`). High risk — test every collection page after.

---

## 11. Session 2026-06-02 part 3 — PDP background + buy it now + wishlist feature

### 11.1 PDP background white + BUY IT NOW black (issue 36)

**Problem:**
- PDP rendered on a light blue/grey background (`#ecf5f5`).
- BUY IT NOW button drew with brand blue (`#000f9f`) border and text — visually off-brand vs. the rest of the store's black/white CTAs.

**Root cause:** `templates/product.json` `main-product` section is wired to **scheme-6**, and `scheme-6` in `config/settings_data.json` had:
- `background: "#ecf5f5"` → page bg
- `primary: "#000f9f"` → drove the BUY IT NOW border/text via `--color-primary`
- `primary_button: "#000000"` was already correct (ADD TO CART has been black since session 1)

Grep confirmed **scheme-6 is used only by `templates/product.json`** — safe to edit globally without affecting other pages.

**Fix:** `config/settings_data.json` → `current.color_schemes.scheme-6.settings`:
| Key | Before | After |
|---|---|---|
| `background` | `#ecf5f5` | `#ffffff` |
| `primary` | `#000f9f` | `#000000` |

ADD TO CART, wishlist heart, share, header — all already black/white, no change needed.

### 11.2 Quantity selector contrast on white background

**Problem:** With PDP bg now white, the quantity `<quantity-input>` (which has `input_background: #ffffff` in the scheme) blended into the page.

**Fix:** Added `calvium-overrides.css` rule 14 — `.product-form .quantity` and `quantity-input.quantity` get a `1px solid #000` border so the +/− pill stays visible. `.quantity__button:hover` gets `#f5f5f5` for affordance.

### 11.3 Wishlist feature — wired end-to-end

**What was already built into the theme (verified, not added by us):**
- `sections/main-wishlist-page.liquid` — full wishlist page section
- `templates/page.template-wishlist.json` — custom page template using the above
- `snippets/product-wishlist-button.liquid` — heart button markup
- `assets/global.js` — `Wishlist` custom element, localStorage (`wishlistItem` key), `setProductForWishlistGlobal`, `checkWishlistCountGlobal`, `initWishlistFromLocalStorage` — full add/remove/count logic
- Header markup already includes `<div class="wishlist-count-bubble"><span data-wishlist-count>0</span></div>`

**What was missing / wrong:**
1. PDP heart did not show a red signal when added — `base.css:22492` styled the BUTTON background using scheme hover colors only (black-on-black = no visible heart change).
2. Header count badge had no styling for color/position (would have rendered as a tiny invisible dot).
3. `settings.link_wishlist = "/account"` overrode the fallback chain in `snippets/header-functions.liquid:52` → the heart routed to `/account` even after a wishlist page exists.
4. No actual **Page** entry exists in admin with handle `wishlist`. The template file exists but Shopify Pages are content created in admin, not files.

**Fixes shipped:**

| File | Change | Why |
|---|---|---|
| `config/settings_data.json` | `current.link_wishlist`: `"/account"` → `""` | Unblock the auto-fallback chain so it can detect `pages['wishlist']` once it's created. |
| `assets/calvium-overrides.css` (rule 15) | `.wishlist-button.wishlist-added` — keep button black, fill the SVG heart with `#e63946` (Calvium red) | Visible "added" state on PDP that survives the existing base.css rule. |
| `assets/calvium-overrides.css` (rule 16) | `.header__icon--wishlist .wishlist-count-bubble` — compact red `#e63946` badge, white text, positioned top-right of the heart | Style the count badge that `global.js` already updates. |

### 11.4 One admin action required from merchant

The wishlist page must be created in admin (Shopify doesn't let theme code create Page content). Steps:

1. Admin → **Online Store → Pages → Add page**
2. Title: `Wishlist` (handle auto-fills to `wishlist`)
3. Template: select **`page.template-wishlist`** in the right sidebar
4. Save

The fallback chain in `snippets/header-functions.liquid:55–60` already checks `pages['wishlist'].url` and will route the header heart there automatically — no code change needed after the page is created. Until the page is created the heart will still route to `/account` (the final fallback) — same as before, no regression.

### Files modified (this session)
```
config/settings_data.json                    — scheme-6.background + scheme-6.primary + link_wishlist
assets/calvium-overrides.css                 — rules 14, 15, 16 appended
```

### Push command used
```
shopify theme push --store calvium-2.myshopify.com --theme 184946491764 \
  --nodelete --allow-live \
  --only "config/settings_data.json" \
  --only "assets/calvium-overrides.css"
```

### Verification
`shopify theme pull --only` of both files confirms on the live theme:
- `scheme-6.background = '#ffffff'`
- `scheme-6.primary = '#000000'`
- `link_wishlist = ''`
- `calvium-overrides.css` has rule 14 (PDP quantity selector), rule 15 (PDP wishlist heart), rule 16 (header heart count badge)

CDN HTML cache per §1.1 — admin theme editor reflects immediately.

### Notes for the next session
- If the badge feels too small, bump rule 16 sizes (`min-width`, `height`, `font-size`).
- If the user wants a wishlist DRAWER instead of a page (Shein-style), that's a JS lift — wire `<a class="header-wishlist">` to open a drawer overlay populated from `localStorage.wishlistItem`, suppress the href, and reuse `sections/main-wishlist-page.liquid`'s rendering snippet inside the drawer.
- The PDP wishlist uses the `closest.product.handle`, which is the master product, not the selected variant. If the user wants per-variant wishlist (e.g. only the Green variant of Calvium Transitus), the wishlist key in localStorage needs to include `?variant=…` — bigger change in `global.js`.


## 12. Session 2026-06-13 — Contact page spacing fixes

### Problems (from user screenshots)
1. Hero banner too short — `section_height_custom: 20` = only 20svh, content cramped with subtitle flush against the bottom edge.
2. Excessive white gap between hero and "GET IN TOUCH" heading (~60px felt too large relative to the short hero).
3. Excessive white gap between "GET IN TOUCH" heading and the form/info columns below (~45px).

### Root cause
All in `templates/page.contact.json`:
- `main.settings.section_height_custom: 20` → only 20svh min-height on the hero
- `main.blocks.text_REW8Uw.settings["padding-block-end"]: 0` → subtitle had zero bottom padding inside the banner
- `section_8XtMhn.blocks.group_gjEPmE.settings["padding-block-start"]: 60` → 60px before GET IN TOUCH
- `section_8XtMhn.blocks.group_gjEPmE.settings["padding-block-end"]: 45` → 45px after GET IN TOUCH

### Fixes shipped
| Path in `templates/page.contact.json` | Before | After |
|---|---|---|
| `main.settings.section_height_custom` | 20 | 40 |
| `main.blocks.text_REW8Uw.settings["padding-block-end"]` | 0 | 30 |
| `section_8XtMhn.blocks.group_gjEPmE.settings["padding-block-start"]` | 60 | 30 |
| `section_8XtMhn.blocks.group_gjEPmE.settings["padding-block-end"]` | 45 | 20 |

### Files modified
```
templates/page.contact.json
```

### Push command
```
shopify theme push --store calvium-2.myshopify.com --theme 184946491764 \
  --nodelete --allow-live --only "templates/page.contact.json"
```

### Verification
`shopify theme pull --only templates/page.contact.json` confirmed all four values on live theme.
CDN HTML cache: use `calvium.in/pages/contact?_fd=0` to bypass.

---

## 13. Session 2026-06-13 — Multi-fix batch (Images 3–9)

### Issues addressed

| # | Screenshot | Fix |
|---|---|---|
| 34b | Lookbook alignment | Right carousel top-aligned with left banner |
| 35b | Login modal | Email placeholder grey, LOGIN hover→white, Google/Apple UI, forgot-password pre-fill JS |
| 36b | Cart drawer | Multi-t tab row styled (44px boxes, active state), ZIP static label |
| 37 | Recently viewed blank | object-position center 18% overridden to center center for recently-viewed section |
| 38 | Contact form placeholders | Name→"JOHN DOE", Phone→"9876543210", Comment→"Tell us how we can help..." |
| 39 | Phone field | `_input.liquid` auto-adds inputmode=numeric + oninput strip when label_name=="phone" |
| 40 | FAQ CONTACT SUPPORT | `button_TAM7rF.settings.link` wired to `/pages/contact` |

### Root causes

- **Lookbook right align**: `group-block-content` had `--vertical-alignment:center` → both columns centered, VIEW MORE floated mid-page. CSS override `.section-lookbook .lookbook-row .group-block-content { align-items:flex-start !important }` aligns to top.
- **Login placeholder/hover**: No prior CSS rule. Added `.section.login input::placeholder { color:#aaa }` and `.button--login:hover { bg:#fff, color:#000 }`.
- **Login Google/Apple**: Added inline SVG buttons + `calviumSocialNotice()` JS. Requires admin → Settings → Customer accounts → Authentication to activate real OAuth. UI shows until then.
- **Forgot password pre-fill**: `.calvium-forgot-link` click intercept: validates `#CustomerEmail` not empty before navigating; pre-fills `#RecoverEmail` with login email.
- **Cart ZIP floating label**: `customer.css` floating-label CSS not loaded in cart drawer → both label + value visible. Fixed by switching to static `<label>` above input + `placeholder="e.g. 400068"` in `snippets/cart-shipping-calculator.liquid`.
- **Cart multi-t tab**: Added 44×44 button boxes, `border-top`, active black state in CSS.
- **Recently-viewed blank**: `component-card.css` global `object-position: center 18%` pushed portrait shots above square-crop visible area. CSS rule 21 resets to `center center` only for `.recently-viewed-products`.
- **Contact placeholders**: Edited `templates/page.contact.json` input blocks directly.
- **Phone numeric**: `blocks/_input.liquid` conditionally adds `inputmode="numeric" pattern oninput` when `label_name == 'phone'`.
- **FAQ CONTACT SUPPORT**: Was `link: ""` → now `link: "/pages/contact"`.

### Files modified
```
assets/calvium-overrides.css              — rules 17–22 appended
sections/main-login.liquid                — Google/Apple buttons + forgot-password JS
blocks/_input.liquid                      — phone-field numeric enforcement
snippets/cart-shipping-calculator.liquid  — static label + placeholder="e.g. 400068"
templates/page.contact.json              — placeholder text (Name/Phone/Comment)
templates/page.faqs.json                 — CONTACT SUPPORT link
```

### Push
```bash
shopify theme push --store calvium-2.myshopify.com --theme 184946491764 \
  --nodelete --allow-live \
  --only "assets/calvium-overrides.css" \
  --only "sections/main-login.liquid" \
  --only "blocks/_input.liquid" \
  --only "snippets/cart-shipping-calculator.liquid" \
  --only "templates/page.contact.json" \
  --only "templates/page.faqs.json"
```

### Known limitations / one admin action needed
- **Lookbook dots x/y coordinates**: Cannot be set from theme code. Merchant must open admin → Online Store → Customize → Lookbook section → each `_lookbook-item` block → set X/Y coordinates and link to product URL. This is content tagging work.
- **Google/Apple login**: Requires Shopify admin → Settings → Customer accounts → Enable social login providers. Once enabled, the buttons become functional. Until then they show a tooltip.
- **Search autocomplete**: Predictive search already built into the theme and fires on every keystroke. If the pre-search state (before typing) needs "Trending Products", that requires adding a section block with featured collection — admin content work.

---

## 14. Session 2026-07-14 — CALVIUM- sections audit + Most-Loved wishlist wiring + cart drawer alignment

### 14.1 Store analysis via multi-agent audit
Ran three parallel Explore agents to audit the 10 custom `sections/calvium-*.liquid` sections, the wishlist end-to-end flow, and the cart drawer button alignment issue.

**Top structural issues surfaced (not yet fixed, tracked as follow-ups):**
1. `sections/calvium-miraggio-header.liquid:116` — blank alt text on mega-menu fallback image.
2. `sections/calvium-collection-category.liquid:31,36–58` — 7 inline styles + hardcoded `padding-block 32/60` + brittle `request.path` chip-active comparison.
3. `sections/calvium-product-editorial.liquid:32,37` — mobile carousel uses `88vw` (12% overflow); brittle `900px` breakpoint vs. theme's 750/1024.
4. `sections/calvium-spotlight.liquid:10` — hardcoded `padding-block: 0` ignores theme spacing tokens.
5. `sections/calvium-miraggio.css:111,124` — announcement `padding-inline: 48px` overflows on <480px screens.
6. All 10 sections use their own `--cm-container` container width variable instead of theme's `--page-width` → merchant width changes won't cascade.

### 14.2 Wishlist — CALVIUM Most-Loved card now functional (issue 41)

**Root cause:** `snippets/cm-product-card.liquid:89` rendered a decorative heart with `class="cm-card__wishlist"` and no data attributes / no `<wish-list>` wrapper. `assets/global.js:2637–2787` (the `<wish-list>` custom element) attaches its click handler only to `[data-wishlist]` buttons inside `<wish-list>`. So clicking the Most-Loved heart did nothing — no localStorage write, no badge update, no red state.

The theme's own `snippets/product-wishlist-button.liquid` and `snippets/card-product.liquid:130-141` already wire this correctly. Fix was to mirror the same pattern in `cm-product-card`.

**Fix shipped:**
- `snippets/cm-product-card.liquid` — wrapped heart button in `<wish-list class="cm-card__wishlist-wrap">`; added `data-wishlist`, `data-wishlist-handle="{{ product.handle }}"`, `data-product-id="{{ product.id }}"`, plus class `wishlist-button` so global.js hooks it.
- `assets/calvium-overrides.css` (rule 58 appended) — CALVIUM card heart resting/hover/added states. Uses `.wishlist-added` class (toggled by global.js `onWishlistButtonClick`) to flip color + border to `#e63946` red, matching the PDP wishlist heart red already in rule 15.
- `.cm-card__wishlist-wrap { display: contents; }` — the `<wish-list>` wrapper doesn't disturb the card grid layout.

**Verification:** live HTML at `calvium.in/?_fd=0` now contains `<wish-list class="cm-card__wishlist-wrap">` around every Most-Loved product card, with `data-wishlist-handle="calvium-cubus"` etc. Click → localStorage write → count badge update all flow through existing global.js code without additional JS.

### 14.3 Cart drawer button alignment (issue 42)

**Root cause:**
- `assets/component-cart.css:142` sets `.cart__checkout-button { max-width: 36rem; margin-bottom: 1rem; }` — capped at 360px, ignores parent width.
- `assets/component-cart-drawer.css:133–135` overrides ONLY the checkout button's `max-width: 100%` inside `.cart-drawer` — but there's no matching rule for `.cart__viewcart-button` (VIEW CART link) → different widths.
- `assets/component-cart.css:147` — `.cart__ctas { text-align: center; }` centers content inside CTAs container, but `.cart-drawer__footer` (SUBTOTAL row) doesn't have the same rule → visual inset mismatch.
- `assets/component-cart.css:137–140` — `.tax-note { margin: 2.2rem 0 0 auto; }` pushes to the right; a user-visible centered tax-note requires an override.

The visible symptom: SUBTOTAL row, tax note, and CTA button sit at slightly different horizontal insets in the drawer.

**Fix shipped:** `assets/calvium-overrides.css` rule 59 appended — strict alignment rules:
- `.cart-drawer .cart-drawer__footer`, `.cart-drawer .cart__ctas.cart__ctas-drawer`, `.cart-drawer .totals` all forced to `padding-inline: 0` / `margin-inline: 0` / `width: 100%` / `box-sizing: border-box` so they share identical horizontal position (inherited from `.drawer__inner`'s `padding-inline: var(--padding-md)`).
- `.cart-drawer .tax-note` centered with `text-align: center` and `margin: 8px 0 14px`.
- `.cart-drawer .cart__ctas.cart__ctas-drawer` explicitly `flex-direction: column`, `align-items: stretch`, `gap: 10px`.
- Both `.cart__checkout-button` and `.cart__viewcart-button` forced to `width: 100%; max-width: 100%; margin: 0` — the missing companion to the theme's checkout-button-only unlock.

### Files modified (this session)
```
snippets/cm-product-card.liquid            — Most-Loved heart now data-wishlist wired + <wish-list> wrapper
assets/calvium-overrides.css               — rule 58 (CALVIUM card wishlist states) + rule 59 (cart drawer alignment) appended
```

### Push
```bash
shopify theme push --store calvium-2.myshopify.com --theme 184946491764 \
  --nodelete --allow-live \
  --only "snippets/cm-product-card.liquid" \
  --only "assets/calvium-overrides.css"
```

### Follow-up punch list (deferred, tracked for next sessions)

**Wishlist:**
- Merchant admin: create page with handle `wishlist` and template `page.template-wishlist` (blocks the header heart from resolving to `/account`).
- Add wishlist heart to Quick-View modal (`snippets/quick-view.liquid`).
- Add wishlist heart to cart drawer line items.

**CALVIUM- sections structural cleanup (P2):**
- calvium-collection-category: move 7 inline styles to `calvium-miraggio.css`, expose padding as schema settings.
- calvium-product-editorial + calvium-product-luxury: align `900px` breakpoint with theme (750/1024).
- calvium-miraggio.css announcement: mobile-safe `padding-inline`.
- Consider unifying `--cm-container` with theme `--page-width`.

**Cart drawer polish (P3):**
- If the merchant wants VIEW CART styled as an intentional secondary button instead of full-width, tighten the button hierarchy differently.
- Cart line-item +/- quantity buttons still cramped on mobile (calvium-miraggio.css 1226–1241 issue flagged in audit).

---

## 15. Session 2026-07-14 part 2 — Sales-focused homepage revamp + header polish

### 15.1 Discovery: live desktop header is `sections/calvium-miraggio-header.liquid`, not the standard theme header
- `sections/header-group.json` on the LIVE theme has 5 sections (announcement-bar, header, header_mobile, **calvium-miraggio-announcement**, **calvium-miraggio-header**). Local copy was stale (only 3). Merchant added the last two via admin editor.
- The desktop wishlist heart is `sections/calvium-miraggio-header.liquid:175`. It used `href="{{ section.settings.wishlist_url | default: routes.search_url }}"` — with the section setting empty, it fell back to `/search`, ignoring the wishlist page.
- Fix: replaced the inline default with the same fallback chain the standard header uses — `section.settings.wishlist_url → pages['wishlist'] → pages['wish-list'] → /account`.
- Wishlist page (handle `wishlist`, template `page.template-wishlist`) already exists in admin (verified HTTP 200 at `/pages/wishlist`).

### 15.2 Cart counter (`.cm-cart-bubble`) was overlapping the cart icon
- Was: `top: 6px; right: 6px; min-width: 17px; height: 17px; box-sizing: content-box;` — bubble box (6-23,6-23) intersected the SVG icon (which sits centered at 10-30 inside the 40×40 button).
- Fix: `top: -2px; right: -2px; transform: translate(35%, -35%); min-width: 18px; height: 18px; box-sizing: border-box; z-index: 2;` — bubble now floats at the top-right corner of the button, clear of the icon. Bumped size 17→18 for legibility.

### 15.3 Three new CALVIUM- sections built (sales-oriented replacements)

**`sections/calvium-hero.liquid`** — Editorial full-bleed hero.
- Desktop + mobile image slots (portrait mobile), height slider (svh), overlay opacity, chip / eyebrow / heading / subheading / microcopy content fields.
- Dual CTAs (primary + optional secondary) — both styled as pill buttons that invert on hover.
- Text position (L/C/R) + alignment + tone (light-text vs dark-text) all configurable.
- Fetchpriority=high, loading=eager, srcset from 900w to 2400w.
- Sensible default copy: "Timeless style, made for modern lives." + "Shop the Edit" CTA + microcopy "Free shipping on orders above ₹999 · 7-day easy returns".

**`sections/calvium-usp-strip.liquid`** — Trust bar.
- 4–6 block row of icon+title+subtitle USPs (Shipping / Returns / COD / Secure / Authentic / 24×7 support / Handcrafted).
- Inline SVG icons keyed by `icon` block setting — no external icon dependency.
- Backgrounds: light, cream (default), ink, dark. Optional hairline top/bottom borders.
- Preset ships with 4 USPs already populated so it renders instantly with no admin editing.

**`sections/calvium-shop-by-style.liquid`** — Tab carousel for style/collection browsing.
- Renders `cm-product-card` (which is wired to the wishlist as of §14.2) inside a 4-up desktop / 2-up mobile grid.
- Pill tabs with keyboard-nav (Arrow Left/Right cycle, tabindex switching, aria-selected).
- Per-tab "Shop all X" CTA button.
- Preset ships 4 empty tab blocks — merchant assigns a collection each in the theme editor.

### 15.4 CSS + JS additions to `assets/calvium-miraggio.css` + `.js`
- CSS: full styling for `.cm-hero*`, `.cm-usp*`, `.cm-sbs*` families following the existing `cm-` design tokens (Montserrat, radius-lg 2px, black/cream palette, cubic-bezier ease-out timing).
- JS: `[data-cm-sbs]` tab switcher with keyboard nav — appended just before the PDP variant-picker handler in `calvium-miraggio.js`.
- Also updated `.cm-cart-bubble` positioning (see 15.2).

### 15.5 Homepage rewired for sales conversion (`templates/index.json`)

**New order (sales funnel: attention → trust → discovery → shop → story → social proof → utility):**
| # | Section id | Type | Purpose |
|---|---|---|---|
| 1 | `calvium_hero` | calvium-hero | Attention, primary CTA above the fold |
| 2 | `calvium_usp` | calvium-usp-strip | Immediate trust signals (shipping/returns/COD/secure) |
| 3 | `calvium_shop_by_style` | calvium-shop-by-style | Product discovery — tabbed style browser |
| 4 | `calvium_most_loved_main` | calvium-most-loved | Best-sellers carousel (wishlist wired) |
| 5 | `calvium_new_in_tiles_hp` | calvium-new-in-tiles | 4-up "New In" category tiles |
| 6 | `calvium_spotlight_hp` | calvium-spotlight | Editorial 50/50 brand story |
| 7 | `calvium_trending_hp` | calvium-trending-now | 4-up trending image grid |
| 8 | `section_XMawhC` | section | Testimonials (kept for merchant data) |
| 9 | `lookbook_q8nVmX` | lookbook | Editorial lookbook (kept for merchant data + dot markers) |
| 10 | `marquee_cbrgCX` | marquee | "NEW ARRIVALS" text scroller |
| 11 | `media_gallery_d6yh4R` | media-gallery | Instagram-style tiles |
| 12 | `17714969651fbe9c80` | apps | Whatmore Shoppable Videos |

**Removed from `sections` dict (were in the JSON but not in the new `order`, and Shopify enforces order-in-sections parity):**
- `slideshow_tyrRgz` (OLD slideshow — replaced by `calvium_hero`)
- `collection_list_NRwJx3`, `collection_list_jUH9xq` (OLD collection-list tiles — replaced by `calvium_new_in_tiles_hp`)
- `featured_collection_list_Hpc6Lq` (OLD Shop-By-Style tabs — replaced by `calvium_shop_by_style`)
- `featured_collection_list_taYCCp` (OLD second Best Seller carousel — replaced by `calvium_most_loved_main`)
- `section_WzKJeK` (OLD "Art of Everyday Elegance" — replaced by `calvium_spotlight_hp`)
- `media_gallery_YeHV4j`, `marquee_FQpNFr` (OLD duplicates)

### 15.6 Cart page rewired (`templates/cart.json`)
- Removed `featured_collection_ATEDND` (OLD "Top Handle Bags" carousel) from both `sections` dict and `order`.
- Replaced with `calvium_most_loved_cart` (`calvium-most-loved` type, heading "YOU MIGHT ALSO LOVE", collection `/collections/best-sellers`, wishlist wired via cm-product-card).

### 15.7 Schema validation gotchas hit + resolved
- `range` `default` MUST equal `min + N*step`. Shopify rejects otherwise.
- Push rejected 3 files: `overlay_opacity` (0..80 step 5 default 22 → fix 25), `padding_top/padding_bottom` (8..80 step 4 default 18 → fix 20), and `padding_top` for cart Most-Loved (0..120 step 4 default 50 → fix 48).
- Fixed in both liquid schemas AND the JSON template values.
- Shopify also enforces that every key in `sections` be present in `order`. Cleaning up the orphaned OLD sections was required before push succeeded.

### 15.8 Files modified
```
sections/calvium-hero.liquid              [NEW]
sections/calvium-usp-strip.liquid         [NEW]
sections/calvium-shop-by-style.liquid     [NEW]
sections/calvium-miraggio-header.liquid   — wishlist heart fallback chain (§15.1)
assets/calvium-miraggio.css               — .cm-cart-bubble reposition + full hero/usp/sbs styles
assets/calvium-miraggio.js                — [data-cm-sbs] tab switcher
templates/index.json                      — sales-optimized order + 6 orphan OLD sections cleaned
templates/cart.json                       — swapped featured_collection_ATEDND → calvium_most_loved_cart
```

### 15.9 Push command
```bash
shopify theme push --store calvium-2.myshopify.com --theme 184946491764 \
  --nodelete --allow-live \
  --only "sections/calvium-hero.liquid" \
  --only "sections/calvium-usp-strip.liquid" \
  --only "sections/calvium-shop-by-style.liquid" \
  --only "sections/calvium-miraggio-header.liquid" \
  --only "assets/calvium-miraggio.css" \
  --only "assets/calvium-miraggio.js" \
  --only "templates/index.json" \
  --only "templates/cart.json"
```

### 15.10 Merchant admin follow-ups needed
1. **Upload hero image** — admin → Customize → Homepage → Calvium — Hero → pick desktop image (2400×1200) + optional mobile portrait (1200×1500).
2. **Assign collections to Shop-by-Style tabs** — admin → Customize → Homepage → Calvium — Shop by Style → each tab block → pick a collection.
3. **Configure Most-Loved collection** on both homepage + cart — admin → Customize → each `calvium-most-loved` section → pick "Best Sellers" (or another collection).
4. **Assign images + links to New-In tiles + Trending Now tiles** — admin → each tile block → image + link.
5. **Configure Spotlight** — admin → Calvium — Spotlight → editorial image + heading + body + CTA.

### 15.11 Verification (CDN cache)
- All 8 files verified live via `shopify theme pull --only ...`.
- Storefront `calvium.in` may serve stale HTML for 30–60 min per §1.1 — the wishlist link + new hero/USP/SBS will appear once cache clears. Admin theme editor preview reflects changes immediately.

### 15.12 Lookbook replacement — `sections/calvium-lookbook.liquid`

**Why replaced:** Merchant explicitly disliked the OLD Swytch `sections/lookbook.liquid` (+ `blocks/_lookbook.liquid`). It's a nested block-heavy generic layout with columns/carousel modes — cluttered, un-shoppable, doesn't match the Calvium aesthetic.

**New design — shoppable editorial split:**
- Desktop: 60/40 (or 70/30 "wide" preset) grid — big editorial image on one side, stacked shoppable product cards on the other.
- Mobile: image stacks on top, 2-up product grid below.
- Editorial panel: floating badge (top-left) + gradient overlay at bottom containing eyebrow, heading, body, pill CTA with arrow.
- Shop panel: title + count row + 2-up cm-product-card grid (wishlist wired) + "Shop the full edit" text link underneath.
- Image position (L/R), tone (white / cream / dark), max products (2–8) all admin-configurable.

**Wired into homepage order** — `templates/index.json` now uses `calvium_lookbook_hp` (calvium-lookbook) at position 9, replacing OLD `lookbook_q8nVmX`.

**Final homepage order (12 sections):**
1. calvium_hero
2. calvium_usp
3. calvium_shop_by_style
4. calvium_most_loved_main
5. calvium_new_in_tiles_hp
6. calvium_spotlight_hp
7. calvium_trending_hp
8. section_XMawhC (testimonials — still Swytch, next revamp candidate)
9. calvium_lookbook_hp
10. marquee_cbrgCX (still Swytch)
11. media_gallery_d6yh4R (still Swytch)
12. 17714969651fbe9c80 (Whatmore Shoppable Videos app)

**Files touched this iteration:**
```
sections/calvium-lookbook.liquid          [NEW]
assets/calvium-miraggio.css               — appended full .cm-lookbook* rules
templates/index.json                      — added calvium_lookbook_hp, removed lookbook_q8nVmX
```

**Push:**
```bash
shopify theme push --store calvium-2.myshopify.com --theme 184946491764 \
  --nodelete --allow-live \
  --only "sections/calvium-lookbook.liquid" \
  --only "assets/calvium-miraggio.css" \
  --only "templates/index.json"
```

### 15.13 Final sweep — testimonials + marquee + instagram grid

Three more OLD homepage sections replaced in a single push. Homepage now has zero OLD Swytch sections (except the third-party Whatmore Shoppable Videos app block, which stays as-is).

**`sections/calvium-testimonials.liquid`** — Review cards grid.
- 3-up desktop, 2-up tablet, snap-scroll carousel on mobile (<620px).
- Per-review: star rating (1–5), headline, quote, avatar (or initials fallback), name, location, verified-buyer badge, optional product tag chip.
- Bordered card with hover lift + shadow.
- Preset ships with 3 realistic Indian buyer reviews (Aanya Mehta / Rohan Iyer / Priya Sharma) — same names used in the earlier OLD testimonials revamp, so merchant continuity is preserved.

**`sections/calvium-marquee.liquid`** — CSS-only continuous marquee.
- Pipe-separated `phrases` textarea → each phrase becomes an item.
- Configurable separator: bullet / star / dot / diamond / slash / arrow.
- CSS `translateX(-50%)` keyframe with duplicated group for seamless loop.
- Pause on hover; `prefers-reduced-motion` disables the animation.
- Default phrases target Indian shoppers: "NEW ARRIVALS | FREE SHIPPING ABOVE ₹999 | EASY 7-DAY RETURNS | CASH ON DELIVERY AVAILABLE | HANDCRAFTED IN INDIA".
- Dark tone default for high contrast strip.

**`sections/calvium-instagram-grid.liquid`** — Shoppable social feed.
- 3/4/5/6-column desktop selector. Falls back to 3-up @900px and 2-up @520px.
- Per-tile: image (1:1), optional link (product or IG post), alt text, caption, open-in-new-tab.
- Hover: image zooms 1.06×, dark overlay fades in with heart icon, caption slides up.
- Section head shows brand handle + IG-icon pill "Follow" CTA linking to Instagram.
- 8 empty tile blocks in the preset — merchant fills with actual UGC/Instagram screengrabs.

### 15.14 Final homepage order (100% CALVIUM- native, except one app block)

| # | Section id | Section type |
|---|---|---|
| 1 | calvium_hero | calvium-hero |
| 2 | calvium_usp | calvium-usp-strip |
| 3 | calvium_shop_by_style | calvium-shop-by-style |
| 4 | calvium_most_loved_main | calvium-most-loved |
| 5 | calvium_new_in_tiles_hp | calvium-new-in-tiles |
| 6 | calvium_spotlight_hp | calvium-spotlight |
| 7 | calvium_trending_hp | calvium-trending-now |
| 8 | calvium_testimonials_hp | calvium-testimonials |
| 9 | calvium_lookbook_hp | calvium-lookbook |
| 10 | calvium_marquee_hp | calvium-marquee |
| 11 | calvium_ig_hp | calvium-instagram-grid |
| 12 | 17714969651fbe9c80 | apps (Whatmore Shoppable Videos — kept) |

### 15.15 Cumulative file list — sections built this arc

```
sections/calvium-hero.liquid                [NEW §15.3]
sections/calvium-usp-strip.liquid           [NEW §15.3]
sections/calvium-shop-by-style.liquid       [NEW §15.3]
sections/calvium-lookbook.liquid            [NEW §15.12]
sections/calvium-testimonials.liquid        [NEW §15.13]
sections/calvium-marquee.liquid             [NEW §15.13]
sections/calvium-instagram-grid.liquid      [NEW §15.13]
sections/calvium-miraggio-header.liquid     — wishlist heart fallback chain (§15.1)
assets/calvium-miraggio.css                 — cart bubble reposition + 7 new section CSS families
assets/calvium-miraggio.js                  — [data-cm-sbs] tab switcher
templates/index.json                        — 12-section sales-optimized order
templates/cart.json                         — featured_collection_ATEDND → calvium_most_loved_cart
```

### 15.16 Final push
```bash
shopify theme push --store calvium-2.myshopify.com --theme 184946491764 \
  --nodelete --allow-live \
  --only "sections/calvium-testimonials.liquid" \
  --only "sections/calvium-marquee.liquid" \
  --only "sections/calvium-instagram-grid.liquid" \
  --only "assets/calvium-miraggio.css" \
  --only "templates/index.json"
```

Verified via `shopify theme pull --only templates/index.json` — every section in `order` matches a CALVIUM- type (except the Whatmore app).

### 15.17 Still to tackle (deferred — outside this arc)

- **PDP default template**: `templates/product.json` still uses OLD `main-product` + `product-recommendations` + `recently-viewed-products`. The `product.luxury.json` and `product.editorial.json` templates already use CALVIUM- alternates; switching the default template to `product.luxury` in Shopify admin covers most of this without new code.
- **Collection page**: `templates/collection.json` + variants use `main-collection-banner` + `main-collection-product-grid`. Would need a `calvium-collection-grid` build using `cm-product-card` for filter/toolbar parity.
- **Search / Blog / Article / default page**: all still OLD `main-search` / `main-blog` / `main-article` / `main-page`. Lower traffic surfaces, low priority.
- **Footer**: OLD `footer` + `footer-bottom`. Low visual weight; can stay.
- **Header duplicates**: `sections/header-group.json` on live has 5 sections including OLD `header` + OLD `header_mobile` + NEW `calvium-miraggio-header` + NEW `calvium-miraggio-announcement`. Confirm via admin theme editor which are actually visible; disable the OLD ones if they overlap.

---

## 16. Session 2026-07-14 part 3 — Post-launch polish: filters, cart CTAs, lookbook, discount bar

Pulled the latest theme first to preserve merchant admin edits (hero image, tab collections, lookbook image + collection selection). Then addressed four user-flagged issues.

### 16.1 Lookbook double-CTA (user hated 2 buttons doing the same thing)
- **File**: `sections/calvium-lookbook.liquid`
- Removed the secondary `.cm-lookbook__viewall` underline text link at the bottom of the products panel. It duplicated the intent of the main black "Explore the story" pill button on the editorial image.
- Schema fields (`viewall_label`, `viewall_url`) left in place for backwards compatibility with any merchant instance that already set them — they just no longer render.
- Single primary CTA now — cleaner hierarchy, less decision paralysis.

### 16.2 Collection page filters + toolbar redesign
- **File**: `sections/calvium-collection-category.liquid` — full rewrite of the head + toolbar + facet system.
- **New facet filter panel**: horizontal row of `<details>` pill dropdowns, one per Shopify filter (`collection.filters`). Each opens a popover with:
  - Checkbox list filters: opts with counts, disabled state for zero-count non-active, `accent-color: black` on the checkbox, hover row background.
  - Price range: min + max number inputs + Apply button.
- **Auto-submit** on any checkbox change (JS `change` listener submits the form). Price range requires explicit Apply (prevents laggy submits on typing).
- **Head**: breadcrumb (Home / Collection) → h1 title → optional description → count. Toolbar (right): "Filter" pill button with active-count badge + custom sort dropdown with caret icon.
- **Mobile drawer**: <749px, the filter panel becomes a right-side slide-in drawer (transform + backdrop). Filter pill button toggles `.is-open`. Body scroll locked via `html.cm-facets-open`.
- **Empty state**: proper "No products match" copy + Reset link.
- **Sort dropdown**: preserves other query params via URL manipulation before reload.

### 16.3 Cart CTAs — full width on drawer AND full cart page
- **File**: `assets/calvium-miraggio.css` — appended new "CART FIXES" block that:
  - Forces `.cart__checkout-button` + `.cart__viewcart-button` to `width: 100%; max-width: 100%; margin: 0` in ALL cart contexts (drawer + `.section--main-cart`).
  - Nukes the theme's global `.cart__checkout-button { max-width: 36rem }` cap.
  - Sets `.cart__ctas` and `.cart__ctas-drawer` to `flex-direction: column; gap: 10px; padding-inline: 0` so both children stretch edge-to-edge inside the drawer's `--padding-md` inset.
- The previous fix only targeted `.cart-drawer` scope; this covers the full cart page too.

### 16.4 Green bar under product name in cart (empty `.discounts` container)
- **Root cause**: `snippets/cart-products.liquid` renders `<ul class="discounts list-unstyled">` around per-line-item discount `<li>`s. When a line has no discounts, the `<ul>` is present but empty. Combined with our `calvium-overrides.css` rule that gave `.discounts` a green background + border, it appeared as a stray green bar between the variant name and the price.
- **Fix**:
  - `assets/calvium-overrides.css` — changed the `.discounts` background/border rule to target `:not(:empty):has(*)` only (skips empty).
  - Added an explicit `.discounts:empty` / `.discounts:not(:has(*))` display-none override.
  - Also added in `calvium-miraggio.css` for defence-in-depth.

### 16.5 Files touched
```
sections/calvium-lookbook.liquid              — removed viewall link render
sections/calvium-collection-category.liquid   — full rewrite w/ facet panel + drawer
assets/calvium-miraggio.css                   — cm-collcat + cm-facets styles, cart-CTA full-width, .discounts:empty hide
assets/calvium-overrides.css                  — .discounts styled only when non-empty
```

### 16.6 Push
```bash
shopify theme push --store calvium-2.myshopify.com --theme 184946491764 \
  --nodelete --allow-live \
  --only "sections/calvium-lookbook.liquid" \
  --only "sections/calvium-collection-category.liquid" \
  --only "assets/calvium-miraggio.css" \
  --only "assets/calvium-overrides.css"
```

### 16.7 Verified
- `shopify theme pull --only sections/calvium-collection-category.liquid` — grep shows 23 cm-facet* references (filter markup present).
- `shopify theme pull --only sections/calvium-lookbook.liquid` — grep shows 0 `cm-lookbook__viewall` refs (link removed).
- CDN cache 30–60 min for the storefront; admin theme editor preview shows changes immediately.

### 16.8 Merchant admin follow-up needed for filters
- **Enable filters in the collection**: Shopify Admin → Online Store → Navigation → Search & discovery app OR direct admin → Products → Collections → click the collection → scroll to "Filters" section → enable/configure. Without merchant configuring which product properties become filters (color, size, price, etc.), the panel will simply have no facets to show.

---

## 17. Session 2026-07-14 part 4 — Wishlist page redesign + announcement re-enable

### 17.1 Wishlist page — new CALVIUM- version

**Why replaced**: `sections/main-wishlist-page.liquid` uses the OLD Swytch `<wishlist-view>` custom element + `switcher-grid` snippet — but the `<wishlist-view>` class isn't defined anywhere in `assets/global.js`. The page had cluttered "VIEW AS" grid-density toggles and OLD-style product cards.

**Built**: `sections/calvium-wishlist-page.liquid` — clean, self-contained JS-driven page:
- Centered head (eyebrow + title + count line "N pieces saved").
- Toolbar: **Share wishlist** mailto link with body pointing at the wishlist URL, and **Clear all** destructive button (red on hover).
- Grid: 4-up desktop / 3-up @1100px / 2-up mobile.
- **Empty state**: heart illustration + "Your wishlist is empty" + explanatory copy + "Continue Shopping" CTA. Auto-hidden when items exist.
- **Loading state**: spinner + label while product fetches complete.
- **Missing-product placeholder**: if a handle in localStorage no longer resolves (product removed), renders a placeholder card with a Remove button.

**JS logic (inline in the section, self-contained)**:
1. Reads `localStorage.wishlistItem` (JSON array of handles).
2. For each handle, `fetch('/products/{handle}?view=calvium_wishlist_card')` in parallel with a fallback to the legacy `?view=block_wishlist_card`.
3. Parses the returned HTML, extracts `[data-cm-wishlist-card]` (our wrapper) or falls back to `.cm-card` / `.card-product`.
4. Marks each card's `.wishlist-button` as `.wishlist-added` (red heart state).
5. Listens for `add:wishlist-item` / `remove:wishlist-item` events (dispatched by `global.js` Wishlist element on other pages) + `storage` event (cross-tab) — re-renders on any change.
6. **Clear all**: confirm() prompt → nuke localStorage → dispatch event → header count updates.

### 17.2 Wishlist card view — new render endpoint

**`sections/calvium-wishlist-card.liquid`** — thin section that renders `cm-product-card` inside a `[data-cm-wishlist-card]` wrapper (`display: contents` so it doesn't disturb grid layout).

**`templates/product.calvium_wishlist_card.json`** — new template mapping that section to the URL `/products/{handle}?view=calvium_wishlist_card`. Shopify's built-in `?view=` mechanism handles the routing.

The legacy `templates/product.block_wishlist_card.json` is left in place as a safety fallback (the JS tries the new view first, then falls back).

### 17.3 Wishlist template rewire

**`templates/page.template-wishlist.json`** — single section now: `calvium-wishlist-page` (was OLD `main-wishlist-page`).

Wishlist page url `/pages/wishlist` (already created in Shopify admin by merchant, HTTP 200 confirmed) now renders the new page automatically.

### 17.4 Announcement bar re-enabled

**File**: `sections/header-group.json`.
Merchant had disabled `calvium_miraggio_announcement_rPUiNq` at some point (`disabled: true`). Verified via CLI pull → removed the `disabled` flag → announcement bar renders again above the header.

### 17.5 Files touched
```
sections/calvium-wishlist-page.liquid           [NEW]
sections/calvium-wishlist-card.liquid           [NEW]
templates/product.calvium_wishlist_card.json    [NEW]
templates/page.template-wishlist.json           — swapped main-wishlist-page → calvium-wishlist-page
sections/header-group.json                      — removed disabled: true on calvium-miraggio-announcement
assets/calvium-miraggio.css                     — appended cm-wishpage + cm-wishlist-card-wrap styles
```

### 17.6 Push
```bash
shopify theme push --store calvium-2.myshopify.com --theme 184946491764 \
  --nodelete --allow-live \
  --only "sections/calvium-wishlist-page.liquid" \
  --only "sections/calvium-wishlist-card.liquid" \
  --only "templates/product.calvium_wishlist_card.json" \
  --only "templates/page.template-wishlist.json" \
  --only "sections/header-group.json" \
  --only "assets/calvium-miraggio.css"
```

### 17.7 Verification (via `shopify theme pull`)
- `templates/page.template-wishlist.json` order: `[main :: calvium-wishlist-page]` ✓
- `sections/header-group.json` — announcement `disabled=None` (i.e. enabled) ✓

### 17.8 Still-OLD pages / follow-ups (deferred, not blocking launch)
- **Search page** (`templates/search.json` → `main-search`) — OLD. Would need a `calvium-search-page` build with cm-product-card results grid.
- **Blog + Article** (`templates/blog.json` → `main-blog`, `templates/article.json` → `main-article`) — OLD. Lower traffic, defer.
- **Default page** (`templates/page.json`) — OLD `main-page`. Fine for content pages.
- **404** — Shopify default.
- **Customer account templates** (`login`, `register`, `addresses`, `order-lookup`) — Shopify built-in; theme's already customised in prior sessions.

---

## 18. Session 2026-07-14 part 5 — Announcement + header polish

Pulled latest state first (only `templates/index.json` had merchant admin edits; synced local). All four issues fixed in one push.

### 18.1 Announcement bar — three lines stacking as a block
- **Root cause**: `sections/calvium-miraggio-announcement.liquid` used `.cm-ann--static` class when `auto_rotate = false`. The old static CSS set `.cm-ann__slide { position: relative; opacity: 1 }` — meaning every block rendered stacked vertically. If a merchant added 3 messages without turning on auto-rotate, all 3 showed as separate lines.
- **Fixes**:
  - `assets/calvium-miraggio.css` — rewrote the `.cm-ann--static` block so `.cm-ann__slide { position: absolute; opacity: 0 }` and `.cm-ann__slide:not(:first-child) { display: none }`. Only the first message renders in static mode.
  - `sections/calvium-miraggio-announcement.liquid` — added auto-enable rotation when `block_count > 1 and auto_rotate == nil` (defensive; catches merchants who add multiple messages without touching the toggle).

### 18.2 Header dropdown caret larger than text
- **Root cause**: `sections/calvium-miraggio-header.liquid` rendered the dropdown caret SVG *without* `width`/`height` HTML attributes; only `viewBox="0 0 10 6"`. Browsers default to intrinsic SVG size (300×150) when neither attributes nor cascading CSS width applies. My existing `.cm-nav__trigger svg { width: 10px; height: 10px }` was being overridden by some higher-specificity rule (couldn't find it, but the render proved it).
- **Fixes**:
  - Added `width="10" height="6"` HTML attributes + `class="cm-nav__caret"` to the caret SVG.
  - CSS: `.cm-nav__trigger svg, .cm-nav__caret { width: 10px !important; height: 6px !important; flex-shrink: 0; display: inline-block; vertical-align: middle; }` — belt-and-braces sizing plus class hook.

### 18.3 Cart counter drifted far from icon
- **Root cause**: `.cm-cart-bubble` used `top: -2px; right: -2px; transform: translate(35%, -35%)` — the translate pushed the bubble ~35% of its own width outside the button. With `.cm-icon-btn { overflow: visible }`, the bubble floated ~10px above and to the right of the button.
- **Fix**: Repositioned `.cm-cart-bubble` (and new `.cm-wish-bubble`) to `top: 4px; right: 4px` with `transform: none`. Bubble now overlaps the icon's top-right corner (standard "notification badge" placement).
- Also tightened bubble size: 16×16 min-width (down from 18), 4px inline padding, border 1.5px, `line-height: 1`.

### 18.4 Wishlist heart missing count badge
- **Root cause**: Heart in `calvium-miraggio-header.liquid` was a bare `<a>` with an SVG — no counter, no `[data-wishlist-count]` hook. So `checkWishlistCountGlobal()` in `assets/global.js` (which iterates `.wishlist-count-bubble [data-wishlist-count]`) had nothing to update on desktop.
- **Fix**:
  - `sections/calvium-miraggio-header.liquid` — added `<span class="cm-wish-bubble wishlist-count-bubble" style="display: none;"><span data-wishlist-count>0</span></span>` inside the heart anchor. Added class `cm-icon-btn--wishlist` for CSS scoping.
  - `assets/calvium-miraggio.css` — `.cm-wish-bubble` styled identically to cart bubble but with `background: #e63946` (Calvium red) to visually distinguish it from the cart's black. `.cm-icon-btn--wishlist { overflow: visible }` so the bubble isn't clipped.
  - `global.js` already toggles `display: none` off the `.wishlist-count-bubble` when count > 0 and updates `[data-wishlist-count]` text — so this "just works" as items are added/removed anywhere on the site.

### 18.5 Files touched
```
sections/calvium-miraggio-header.liquid       — caret width/height attrs, wishlist bubble markup
sections/calvium-miraggio-announcement.liquid — auto-enable rotation when multiple blocks
assets/calvium-miraggio.css                   — cart+wish bubble reposition, static ann slides hidden, caret !important sizing
templates/index.json                          — synced live (no code change; preserved merchant edits)
```

### 18.6 Push
```bash
shopify theme push --store calvium-2.myshopify.com --theme 184946491764 \
  --nodelete --allow-live \
  --only "sections/calvium-miraggio-header.liquid" \
  --only "sections/calvium-miraggio-announcement.liquid" \
  --only "assets/calvium-miraggio.css"
```

### 18.7 Verified (via `shopify theme pull`)
- Header caret has `width="10" height="6"` attributes ✓
- Header wishlist heart has `cm-wish-bubble` + `data-wishlist-count` ✓
- Announcement liquid has the multi-block auto-rotate guard ✓

---

## 19. Session 2026-07-14 part 6 — Collection sidebar filters + sticky chip fix + cart CTA debug

Two parallel research agents spawned: one to extract the miraggio-clone filter design, one to identify the sticky chip strip + cart button width root causes.

### 19.1 Collection page filter — sidebar layout (ported from miraggio-clone)

**User wanted** the reference design from `~/Desktop/calvium/miraggio-clone/`: left sidebar with "Filters" heading, "Clear all" link, per-filter `<details>` accordion with chevron `::after`, checkbox rows with `(count)` in parentheses.

**Extracted from reference** (`sections/main-collection.liquid`, `base.css:915–1244`):
- Grid layout: `grid-template-columns: 260px 1fr; gap: 40px` on desktop, single column on mobile
- Facet group: `border-bottom` separator, 16px vertical padding, `<summary>` with rotate-45° corner-bracket chevron via `::after`
- Checkbox: `accent-color: #000`, 16×16, `.facet-count` in grey `(N)` format
- Mobile: slide-in drawer from right, fixed backdrop, close button + Escape key

**Fully rewrote `sections/calvium-collection-category.liquid`** to match:
- `<aside class="cm-facetsbar">` sidebar with `<div class="cm-facetsbar__head">` (title + Clear all link + close button)
- `<form data-cm-facet-form>` wrapping each facet as `<details class="cm-facetgroup">` with `<summary>` (label + optional count badge + chevron `::after`)
- `<label class="cm-facetopt">` for each option: checkbox + label span + `(count)` span
- Auto-submit form on any checkbox change via `form.requestSubmit()`
- Price range: min/max inputs + explicit Apply (avoids submitting mid-typing)
- Main column has sortbar (mobile Filter pill + count + sort dropdown) + product grid

**Fully rewrote CSS** in `assets/calvium-miraggio.css` (replaced the 362-line previous pill-popover block):
- 260px sidebar / 1fr main column on desktop (1024+), single column mobile
- Facet group with `border-bottom` separator, chevron rotates -135° when open
- Custom sort select with SVG chevron background image (matches miraggio-clone)
- Mobile: sidebar becomes a slide-in right drawer with backdrop, body scroll locked via `html.cm-facetsbar-open { overflow: hidden }`

### 19.2 Chip strip sticky → static

**Root cause identified by agent**:
- `assets/calvium-miraggio.css:833` — `.cm-chips { position: sticky; top: var(--cm-header-h, 0px); }`
- `assets/calvium-miraggio.js:48–54` — `updateChipStickyOffset()` dynamically writes `--cm-header-h` to keep the chip strip pinned below the header.

**Fix**: `assets/calvium-miraggio.css` — changed `.cm-chips { position: sticky; top: ... }` to `.cm-chips { position: static; z-index: 1; }`. Removed the `top` + `transition` declarations. Chip strip now sits inline in the normal flow, no scroll pinning.

### 19.3 Cart drawer SECURE CHECKOUT button still not full-width — debug + aggressive fix

**Investigation** (agent report):
- `snippets/cart-drawer.liquid` structure: `.drawer__inner` → `.cart-drawer__footer` (SUBTOTAL row) + `.cart__ctas.cart__ctas-drawer` (buttons). Both are siblings inside `.drawer__inner` which has `padding-inline: var(--padding-md)` (`component-cart-drawer.css:2`).
- Both children *should* have the same available width. But the CHECKOUT button visibly rendered narrower.
- Suspected cause: `.cart__ctas { text-align: center }` (from `component-cart.css:147`) combined with `.cart__checkout-button { display: inline-flex }` was causing the button to be treated as an inline element, letting `text-align: center` shrink-fit and center it inside the parent — width: 100% wasn't being respected because inline-flex + text-align: center = shrink-to-fit unless explicitly widened.

**Fix — aggressive full-width block layout**:
- Replaced the previous "cart-drawer scoped" CSS block with a broader rule targeting `.cart__ctas` in ALL contexts (drawer + full cart page).
- `.cart__ctas` and all variants: `display: block !important` (was flex, now block).
- Every direct child: `display: block !important; width/min-width/max-width: 100% !important; margin-inline: 0 !important`.
- Button/link: `padding-inline: 20px !important` (internal button padding, doesn't cap outer width).
- Inner `.button-overflow` span: `width: 100% !important; display: inline-flex; justify-content: center` so the label stays centered within the full-width button.

The `!important` sledgehammer is deliberate — the theme's `component-cart.css` uses specific selectors that beat any non-important attempt.

### 19.4 Files touched
```
sections/calvium-collection-category.liquid   — full rewrite: sidebar layout, cm-facetsbar + cm-facetgroup + cm-facetopt classes
assets/calvium-miraggio.css                   — replaced 362 lines of pill-popover filter CSS with sidebar CSS
                                              — changed .cm-chips: sticky → static
                                              — rewrote CART FIXES block with block-layout aggressive full-width rules
```

### 19.5 Push
```bash
shopify theme push --store calvium-2.myshopify.com --theme 184946491764 \
  --nodelete --allow-live \
  --only "sections/calvium-collection-category.liquid" \
  --only "assets/calvium-miraggio.css"
```

### 19.6 Merchant admin follow-up
- Enable filters for each collection in Shopify Admin → Search & discovery (or Admin → Products → Collections → each collection → Filters section). Without merchant configuring which product properties (color, size, price) become filters, the sidebar renders the "No filters configured for this collection" fallback message.

---

## 20. Session 2026-07-14 part 7 — Cart CTA proper root-cause fix + mobile header

### 20.1 Cart button width — proper root-cause fix (no more `!important`)

**True root cause (traced through the cascade)**:
1. `assets/base.css:2621` — `.button, .button-secondary { width: fit-content }` — shrink-fits every button to its label.
2. `assets/component-cart.css:107` — `.cart__ctas button { width: 100% }` — theme's intended override.
3. `assets/component-cart.css:147` — `.cart__ctas { text-align: center }` — centers inline content.
4. `.button` uses `display: inline-grid` (base.css:2600).

Combination: `text-align: center` on the flex-like parent + `display: inline-grid` on the button + previous overrides going stale on some layout paths, meant the button visually shrink-fit whenever the width: 100% wasn't computed properly.

**The clean fix — flex `align-items: stretch`**:
- Flex-column children stretch on the cross-axis automatically, ignoring their own `width` declaration.
- Removed the wall of `!important` overrides added in earlier sessions.
- Kept a plain-specificity rule to nuke `.cart__checkout-button`'s 36rem `max-width` cap:

```css
.cart__ctas.cart__ctas-drawer,
.cart-drawer .cart__ctas.cart__ctas-drawer,
.section--main-cart .cart__ctas {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  padding-inline: 0;
  margin-inline: 0;
  width: 100%;
  box-sizing: border-box;
}
.cart-drawer .cart__checkout-button,
.section--main-cart .cart__checkout-button,
.cart-drawer .cart__viewcart-button,
.section--main-cart .cart__viewcart-button {
  max-width: none;
  margin-bottom: 0;
}
.cart__ctas .button-overflow {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

No `!important`. Higher-specificity selectors do the work.

Cleaned up the redundant session-15 cart CSS block in `assets/calvium-overrides.css` — deleted 40+ lines of `!important` rules that are now handled by the clean flex rule.

### 20.2 Mobile header — logo + search icon overlap

**Root cause**: `.cm-header__row` used `grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr)` with 4 icons on the right (search + account + wishlist + cart) at 40px each. On a 375px viewport: 40 (menu) + 20 (gap) + 4×40 + 3×4 (icons + gaps) + 20 (gap) + logo width = 320+ px. Logo center column got squeezed and visually overlapped the search icon.

**Fix (in `assets/calvium-miraggio.css`, appended after `.cm-mobile-toggle`)**:
- Hide Account icon on mobile only (`.cm-header__right a.cm-icon-btn[aria-label="Account"] { display: none }`). Users still reach the account page via the menu drawer's built-in links. Keeps search, wishlist, cart.
- Shrink icon buttons 40×40 → 36×36, icon SVGs 20→18, on `<749px`.
- Tighten header row: `gap: 8px` (was 20), `padding-block: 8px` (was 10), `min-height: 60px` (was 74).
- `grid-template-columns` changed from `1fr auto 1fr` to `auto 1fr auto` so the logo center column takes remaining space naturally.
- Shrink logo `max-height` 48 → 34 and `brandtext` font-size 22 → 13.
- Shrink cart/wishlist bubbles proportionally: 16 → 14, top/right 4 → 2, font 10 → 9, border 1.5 → 1.

### 20.3 Files touched
```
assets/calvium-miraggio.css     — root-cause cart flex fix (no !important) + mobile @media 749px block
assets/calvium-overrides.css    — pruned redundant session-15 cart !important rules
```

### 20.4 Push
```bash
shopify theme push --store calvium-2.myshopify.com --theme 184946491764 \
  --nodelete --allow-live \
  --only "assets/calvium-miraggio.css" \
  --only "assets/calvium-overrides.css"
```

### 20.5 Notes
- Storefront `calvium.in` caches HTML for 30–60 min; the versioned CSS URL embedded in the cached HTML pins the browser to an older CSS build until the HTML cache refreshes. If a merchant's browser is loading an old `?v=` hash of `calvium-miraggio.css`, the CSS changes won't be visible until the HTML cache refreshes. Admin theme editor bypasses this.
- Multiple past sessions used `!important` on cart rules to force-fix layout; the root-cause pass consolidates all of them into 3 clean rules relying on flex `align-items: stretch`.

---

## 21. Session 2026-07-31 — PDP swatch alignment + mega-menu hover gap

### 21.1 PDP cross-product colour swatches — right-drifted, out of alignment with the ATC button

**Symptom**: on `/products/solis-black` (and every PDP that renders the cross-product colour swatches), the `COLOR: <name>` label sat visually centred, and the row of colour thumbnails (BeigeOffWhite / Black / BlackGreen / Khaki / Red / Tan / Yellow) started well to the right of the price line and the ADD TO CART button. Everything else in the info column (title, rating, price, MRP line, ATC) started at the same left edge — only the swatch block was off.

**Root cause — two culprits stacked**:
1. `snippets/cm-cross-product-swatches.liquid` had inline `style="text-align:center;"` on both `.cm-picker__label` `<p>` tags (both the `siblings_csv` branch and the `collections.all` fallback branch) → the "COLOR: BLACK" label rendered centred.
2. `assets/calvium-overrides.css:1637` — `.cm-cross-swatches` was declared `margin: 0 auto 20px; max-width: 520px;` → the whole swatch block was constrained to 520 px and horizontally auto-centred inside the info column. Info column on desktop is wider than 520 px, so the block visually drifted right of the ATC button's left edge.

**Fix**:
- Removed the two inline `style="text-align:center;"` attributes from the label `<p>` tags in the snippet — label now defaults to left-aligned (inherits from the info column).
- Changed the CSS block to full-width, left-aligned:
  ```css
  .cm-cross-swatches {
    margin: 0 0 20px;
    max-width: none;
    width: 100%;
  }
  .cm-cross-swatches__row {
    display: flex;
    flex-wrap: wrap;
    gap: 14px 12px;
    align-items: flex-start;
    justify-content: flex-start;
  }
  ```
- `.cm-cross-swatch__name` still has `text-align: center` (centres the colour name UNDER each thumbnail) — that's intentional and left alone.

### 21.2 Mega-menu dropdown closes when cursor crosses the trigger→panel gap

**Symptom**: hovering "Shop By Category" opened the mega-menu, but moving the cursor down towards the dropdown items (BY STYLE / BY SILHOUETTE / SPECIALTY / SHOP ALL) closed the panel before reaching them.

**Root cause**: `.cm-mega` in `assets/calvium-miraggio.css:289` is `position: fixed; top: calc(var(--cm-header-offset, 122px) + 6px)`. That 6 px vertical dead-zone between the trigger row and the mega panel is covered by neither `.cm-nav__item` nor `.cm-mega`. Cursor crossing it evaluates `.cm-nav__item:hover` as false for a frame, and the panel hides.

**Fix — invisible hover bridge**: added a 24 px transparent `::before` pseudo-element on `.cm-mega` positioned at `top: -24px` that extends the panel's hit area upward across the gap. Guarded with `pointer-events: none` by default so it doesn't spuriously open dropdowns when the cursor is just below the header; only becomes `pointer-events: auto` while `.cm-nav__item:hover` / `:focus-within` is already active, keeping the panel latched once the trigger is engaged.

```css
.cm-mega::before {
  content: "";
  position: absolute;
  top: -24px;
  left: 0;
  right: 0;
  height: 24px;
  background: transparent;
  pointer-events: none;
}
.cm-nav__item:hover .cm-mega::before,
.cm-nav__item:focus-within .cm-mega::before {
  pointer-events: auto;
}
```

Because the bridge is a descendant of `.cm-mega`, which is a descendant of `.cm-nav__item`, hovering it counts as hovering the trigger — CSS `:hover` state stays live through the gap.

### 21.3 Files touched
```
snippets/cm-cross-product-swatches.liquid  — removed inline text-align:center on both .cm-picker__label
assets/calvium-overrides.css               — .cm-cross-swatches now full-width, left-aligned; explicit justify-content: flex-start on the row
assets/calvium-miraggio.css                — added .cm-mega::before hover bridge (guarded pointer-events)
```

### 21.4 Push (via git — live theme is GitHub-connected)
Live theme changed from `Swytch Default Day1` (#184946491764) → `Calvium/main` (#191621005684) between sessions 20 and 21. `Calvium/main` is wired to https://github.com/Sayuj63/Calvium.git (branch `main`) via Shopify's GitHub integration, so the correct deploy is a git push, not a `shopify theme push`:
```bash
git add snippets/cm-cross-product-swatches.liquid \
        assets/calvium-overrides.css \
        assets/calvium-miraggio.css \
        CALVIUM_CHANGES.md
git commit -m "PDP: fix swatch alignment; Header: bridge mega-menu hover gap"
git push origin main
```
Shopify's GitHub sync polls the repo and updates the live theme within seconds. Verify in the theme editor at [admin.shopify.com/store/calvium-2/themes/191621005684/editor](https://admin.shopify.com/store/calvium-2/themes/191621005684/editor).

An earlier `shopify theme push` in this session accidentally landed on the previous (now-unpublished) `Swytch Default Day1` theme — inert but stale. Ignore.

### 21.5 Verification
```bash
curl -s "https://calvium.in/products/solis-black?_fd=0" | grep -A1 'cm-picker__label' | head -20
# expect: no style="text-align:center" inline attribute on the label
# expect: .cm-cross-swatches with new margin/width rules loaded from calvium-overrides.css?v=<new-hash>
```
Then in-browser: hover "Shop By Category" and drag the cursor slowly down towards the panel — the dropdown must stay open the entire trip. Try each mega parent to be sure.

### 21.6 Deferred (next in queue)
- "Recently Viewed" section below the PDP — SSR from a fallback collection (best-sellers → new-arrivals → all cascade, same as `calvium-most-loved.liquid`) rendering N products via `cm-product-card` for visual parity with "YOU MAY ALSO LIKE"; client-side JS reorders so recently viewed sit at the front (from `localStorage._halo_recently_viewed`, current product filtered out), remaining slots randomised via Fisher–Yates. Guarantees constant N. Not yet implemented — waiting on placement decision (bottom of PDP after `pdp_testimonials`, vs. between recommendations and testimonials).

---

## 22. Session 2026-07-31 part 2 — "Recommended for you" carousel below "You may also like"

### 22.1 The ask
Add a second carousel on the PDP, directly under "YOU MAY ALSO LIKE", visually identical to it (same `cm-slider` / `cm-product-card` styling), driven by this algorithm:
- Constant product count N (default 8)
- Recently-viewed products come first, in most-recent-first order
- Remaining slots filled with random products so visitors with no history still see a full carousel
- Current PDP product filtered out

### 22.2 Implementation — three files, one new section

**New: `sections/calvium-recently-viewed.liquid`** — near-clone of `calvium-most-loved.liquid`:
- Same fallback collection cascade (chosen setting → `best-sellers` → `new-arrivals` → `all`) so the pool is guaranteed non-empty even before a merchant configures it.
- Same DOM: `.cm-section` → `.cm-container/.cm-section__head` → `.cm-slider` → `.cm-slider__viewport` → `.cm-slider__track` (grid-auto-flow: column, scroll-snap-type: x mandatory).
- Difference: the `.cm-slider__track` element is a `<calvium-recently-viewed>` custom element instead of a plain `<div>`. Class `cm-slider__track` still applies, so the existing CSS (`display: grid`) overrides the custom-element default `display: inline`.
- SSR filters the current product server-side: `{%- if product and p.id == product.id -%}{%- continue -%}{%- endif -%}`.
- Cards rendered via the existing `cm-product-card` snippet — same swatch/hover/atc treatment as `calvium-most-loved`. Each card carries `data-product-id` (already emitted by `cm-product-card.liquid:46`), which is what the reorder logic keys on.

**New JS: `CalviumRecentlyViewed` custom element in `assets/calvium-miraggio.js`** (appended at end of file, outside the existing IIFE so it can register once on script load):
1. `connectedCallback()` treats `this` as the track (already `display: grid`).
2. Collects direct children with a `data-product-id` attribute.
3. Reads `_halo_recently_viewed` from localStorage (the same key `product-info.js:setRecentlyViewed` writes to when a PDP loads; entries are numeric product IDs, most recent first, capped at 25).
4. Filters out the current product ID (from `data-current-product-id` attribute the section sets from `{{ product.id }}`).
5. Two-pass reorder:
   - For each recently-viewed ID (in localStorage order), if there's a matching card in the track, pull it into a `recentMatches` array.
   - Everything else goes into `rest` and gets Fisher–Yates shuffled in-place.
6. Rebuild the track by appending `recentMatches` then `rest` into a `DocumentFragment` and appending back to the track — single DOM write, no flicker.

No AJAX fallback for products missing from the SSR pool. Coverage is expected to be high (fallback `all` iterates the first 50 products by Liquid's default), and adding a fetch pass would double the request count without materially changing behaviour for stores under ~50 SKUs.

**Template registration: `templates/product.json`** — added a `recently_viewed` section between `recommendations` and `pdp_testimonials`, and inserted `"recently_viewed"` into the `order` array in the same position. Settings mirror the "YOU MAY ALSO LIKE" section (best-sellers fallback, 8 products, swatches + %-off + ATC hover on) with heading `RECOMMENDED FOR YOU` so the two carousels don't share a title.

### 22.3 Why not extend the existing `sections/recently-viewed-products.liquid`
That section fetches recently-viewed cards via `/search?section_id=…&q=id:X OR id:Y` and renders them with the block-based `card-product-flex` layout — completely different card style from `cm-product-card` used above by "YOU MAY ALSO LIKE". Reusing it would either force a visual break between the two carousels or require rewriting the section to swap card renderers based on context. Cleaner to fork a Calvium-styled version.

### 22.4 Files touched
```
sections/calvium-recently-viewed.liquid  — new section, cm-slider-styled, wraps <calvium-recently-viewed> on the track
assets/calvium-miraggio.js               — appended CalviumRecentlyViewed custom element at EOF
templates/product.json                   — new "recently_viewed" section entry + inserted into order between recommendations and pdp_testimonials
```

### 22.5 Push (git → live theme)
```bash
git add sections/calvium-recently-viewed.liquid \
        assets/calvium-miraggio.js \
        templates/product.json \
        CALVIUM_CHANGES.md
git commit -m "PDP: add RECOMMENDED FOR YOU carousel with recently-viewed reorder"
git push origin main
```

### 22.6 Verification
1. Open a PDP in the theme editor: [admin.shopify.com/store/calvium-2/themes/191621005684/editor](https://admin.shopify.com/store/calvium-2/themes/191621005684/editor) → Products → any product.
2. Expect two carousels: "YOU MAY ALSO LIKE" (calvium-most-loved) followed by "RECOMMENDED FOR YOU" (calvium-recently-viewed), same visual style, same card sizes.
3. In DevTools console: `localStorage.getItem('_halo_recently_viewed')` — should be a JSON array populated with every PDP visited this session.
4. Visit product A → visit product B → on product B's PDP, product A should be the first card in "RECOMMENDED FOR YOU".
5. Hard-refresh with cleared localStorage → carousel should still show N products (shuffled fallback), no empty state.

### 22.7 Tunables (merchant editor)
- Heading text (default: `RECOMMENDED FOR YOU`)
- Fallback collection (default: `best-sellers`; leave blank to fall through the cascade)
- Products shown (constant N — default 8, min 4, max 20)
- Card options: % OFF badge, swatches, max swatches, hover ATC
- Padding top/bottom

---

## 23. Session 2026-07-31 part 3 — Collection page filters back to sticky horizontal pill bar (CSS cascade fix)

### 23.1 Symptom
On `/collections/all` (and every collection page) at desktop widths, the filter area rendered as a full-width block instead of the intended compact sticky horizontal pill bar:
- Big "FILTERS" heading (20 px, bold)
- Each filter (`Availability`, `Price`) stacked vertically on its own row with a full-width `border-bottom`
- Product grid pushed way down before it even appeared

Commit `0396877` (Session 21 timeframe) had already added the horizontal-bar CSS block, but it wasn't actually taking effect on the live site.

### 23.2 Root cause — CSS cascade order

`assets/calvium-miraggio.css` had **two competing style blocks** for the same selectors:

1. The horizontal-bar block starting at line 2481 (`@media (min-width: 1024px)`): sticky pills, compact heading, flex row, absolute-positioned dropdowns.
2. The base sidebar/drawer block starting at line 2568 (unscoped, applies at all widths): big heading, `display: block` form, bordered facet groups — needed for the mobile filter drawer.

Cascade rule: when two rules have equal specificity, the one declared LATER in the stylesheet wins. Because the sidebar block sat AFTER the horizontal block, its base-level rules like `.cm-facetsbar__form { display: block }` (line 2609) and `.cm-facetsbar__title { font-size: 20px; font-weight: 700 }` (line 2587) beat the horizontal-bar rules at desktop too, even though the horizontal rules were inside a `min-width: 1024px` media query.

Some rules survived (the pill styling itself, from `.cm-facetsbar__form > .cm-facetgroup > summary` — that compound selector has higher specificity, so it won regardless of order). That's why the individual pill buttons still looked pill-shaped, but the layout around them stayed in sidebar mode.

### 23.3 Fix
Moved the entire "Horizontal filter bar (desktop)" `@media` block from line 2481 to **after** the sidebar/drawer block (now sits just before the `-- Main column: sort bar + grid --` comment). Now cascade order at ≥ 1024 px puts the horizontal rules last, so they win against the base sidebar rules at equal specificity.

Also tightened the horizontal-bar rules while I was there:
- `.cm-facetsbar__form > .cm-facetgroup { padding: 0; border: 0; }` — nukes the `border-bottom: 1px solid` and `padding-block: 16px` the base sidebar rules add, which is what was making each pill look like its own row with a horizontal divider.
- `.cm-facetsbar__title { font-weight: 500 }` — the base rule was `font-weight: 700`; the horizontal version is now the intended lighter weight consistent with other section headings on the page.
- `.cm-facetsbar__form > .cm-facetgroup > summary { font-family: var(--cm-font-body) }` — overrides the base `.cm-facetgroup summary { font-family: var(--cm-font-heading) }` which was applying a serif to the pill button labels.
- `.cm-facetsbar__form > .cm-facetgroup > summary::after { margin-left: 2px; margin-right: 0; flex-shrink: 0 }` — the base caret rule has `margin-left: auto` (which pushed the caret to the far right of a full-width sidebar summary) and that was leaking into pill mode; explicit override keeps the caret snug next to the label.

Mobile is untouched — the sidebar/drawer block remains unscoped and applies at < 1024 px as before.

### 23.4 Files touched
```
assets/calvium-miraggio.css  — moved the horizontal-filter-bar @media block from before the sidebar block to after it; added padding/border overrides + font-family + caret margin overrides
```

### 23.5 Push
```bash
git add assets/calvium-miraggio.css CALVIUM_CHANGES.md
git commit -m "Collection: fix filter cascade — horizontal pill bar now wins over sidebar CSS at desktop"
git push origin main
```

### 23.6 Verification
1. Theme editor preview at [admin.shopify.com/store/calvium-2/themes/191621005684/editor](https://admin.shopify.com/store/calvium-2/themes/191621005684/editor) → open `/collections/all` or any collection with configured filters.
2. Expect a single sticky horizontal row: small `FILTERS` label + `Availability` and `Price` pills next to it, all inline. Clicking a pill should reveal an absolute-positioned dropdown panel below it with checkboxes / price inputs.
3. Scrolling should keep the pill row sticky at `top: 72px`.
4. On mobile (< 1024 px width), the horizontal bar is hidden; the `Filter` button in the sortbar still opens the slide-in drawer as before.
5. Verify the `RECOMMENDED FOR YOU` carousel from Section 22 is showing below `YOU MAY ALSO LIKE` on any PDP — merchant does NOT need to add it manually, `templates/product.json` already registers it in `order` between `recommendations` and `pdp_testimonials`.

---

## 24. Session 2026-07-31 part 4 — Sticky filter off, Recently-viewed rescue push, Shopify schema constraints learned

### 24.1 What went wrong
Merchant checked the live theme editor (191621005684) and reported: (a) the collection filter row was still sticky and they wanted it non-sticky, (b) the `RECOMMENDED FOR YOU` carousel was NOT visible on any PDP, and (c) the "Recommended (recently viewed)" section didn't show up as an option in the theme-editor section picker.

`git ls-remote origin main` confirmed commits `a0d8359` (add carousel) and `c3ba8d4` (filter cascade) were on GitHub. But `shopify theme pull --only templates/product.json` from the live theme returned the pre-carousel version. So the **Shopify → GitHub sync had NOT propagated my commits from git → live theme**. Section file `sections/calvium-recently-viewed.liquid` didn't even exist on the live theme.

### 24.2 Root cause of the sync miss — Shopify schema validation
Direct CLI push (`shopify theme push --theme 191621005684 --only sections/calvium-recently-viewed.liquid`) surfaced the actual error hidden behind the silent GitHub-sync failure:

```
Invalid schema: name is too long (max 25 characters)
```

The section schema had `"name": "Calvium — Recommended (recently viewed)"` (~40 chars). Shopify rejects section files whose schema violates constraints; the GitHub sync doesn't surface this error in a visible place, so the sync silently drops the file — and any template that references it also fails to push, cascading the outage.

A second retry surfaced another constraint:

```
Invalid schema: setting with id="collection" label is too long (max 70 characters)
```

The `fallback_collection` setting had a verbose label explaining what it did (~170 chars). Same class of failure.

**Shopify section schema constraints (relevant to this repo)**:
- `schema.name` — max **25 characters**
- Setting `label` — max **70 characters**
- (Merchant-visible strings: err short. Move long explanations into a `paragraph`-type setting inline in the schema.)

### 24.3 Fixes applied
1. **`sections/calvium-recently-viewed.liquid` schema**:
   - `name` → `"Calvium — Recommended"` (21 chars)
   - Preset `name` → same
   - `collection` setting `label` → `"Fallback collection"` (19 chars); the long explanation moved to a new `{"type": "paragraph", "content": "Used to fill slots when the visitor has fewer recently-viewed products than the count below."}` block right after the collection picker, which is under 70 chars and Shopify accepts it as merchant-visible help text.

2. **`assets/calvium-miraggio.css` — remove sticky on the filter row** (per merchant request):
   - `.cm-facetsbar` (inside the desktop horizontal-bar `@media` block, moved to after the sidebar block in Section 23) — swapped `position: sticky; top: 72px; z-index: 20;` for `position: static;`. Filter row now scrolls with the page.

3. **Force-push everything to live theme via CLI** to bypass whatever was breaking the GitHub sync. Order matters — section file first, then the JSON template that references it:
```bash
shopify theme push --store calvium-2.myshopify.com --theme 191621005684 --nodelete --allow-live \
  --only "sections/calvium-recently-viewed.liquid"
shopify theme push --store calvium-2.myshopify.com --theme 191621005684 --nodelete --allow-live \
  --only "templates/product.json" \
  --only "assets/calvium-miraggio.js" \
  --only "assets/calvium-miraggio.css" \
  --only "assets/calvium-overrides.css" \
  --only "snippets/cm-cross-product-swatches.liquid"
```

Pushing template + section together in one call fails with `Section type 'calvium-recently-viewed' does not refer to an existing section file` because Shopify validates the template BEFORE the section file has been committed to the theme's asset store. Always push new sections first, then push templates that reference them.

### 24.4 Verification (after the CLI push)
`shopify theme pull --only templates/product.json --only sections/calvium-recently-viewed.liquid` confirmed both files are now on theme `191621005684`, and `templates/product.json` has `recently_viewed` in both `sections` and the `order` array.

### 24.5 Deploy convention going forward (updated)
Because the Shopify GitHub sync silently drops files that fail schema validation:
1. **Always run `shopify theme push --dry-run` first** (or just push directly with `--allow-live`) — the CLI surfaces schema errors that the GitHub sync hides.
2. If schema validation fails, fix the schema, then push again.
3. Only rely on `git push origin main` alone once the CLI push has confirmed the schema is valid. In practice: CLI-push for the first commit that introduces a new section, then rely on GitHub sync for follow-up edits to that section.

### 24.6 Files touched
```
sections/calvium-recently-viewed.liquid  — schema.name and label shortened, added paragraph help text
assets/calvium-miraggio.css              — .cm-facetsbar position: sticky → static (in desktop @media block)
```

### 24.7 Push (this commit)
```bash
git add sections/calvium-recently-viewed.liquid \
        assets/calvium-miraggio.css \
        CALVIUM_CHANGES.md
git commit -m "Section: shorten schema strings to Shopify's 25/70 char limits; Collection: remove sticky filter"
git push origin main
```

Direct-to-theme push already done via CLI. Git commit is for record-keeping so the GitHub state matches what's on the live theme.
