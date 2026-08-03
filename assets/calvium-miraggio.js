/*
 * Calvium Miraggio-inspired sections
 * All behaviours are namespaced under [data-cm-*] hooks
 */
(function () {
  const doc = document;

  // -----------------------------------------------------------
  // Sticky chip strip — dynamically match the real header height.
  // Works with the Calvium Miraggio header AND the Halo/Ella header,
  // announcement bars, and mobile toolbars — anything that is
  // position: sticky/fixed and pinned at the top.
  function findStickyHeaderHeight() {
    // Candidates: known Halo/Ella header selectors + our own header + generic sticky bars
    const selectors = [
      '[data-cm-header]',
      '.cm-header',
      '.header-group',        // Halo/Ella wrapper (if present)
      '#header-group',
      '.header--sticky',      // Halo/Ella sticky header class
      '.site-header--sticky',
      '.shopify-section--header',
      '[data-header]',
      'header'
    ];
    let total = 0;
    const seen = new WeakSet();
    for (const sel of selectors) {
      const nodes = doc.querySelectorAll(sel);
      nodes.forEach((el) => {
        if (seen.has(el)) return;
        const rect = el.getBoundingClientRect();
        // Only count if it's pinned at the top of the viewport.
        if (rect.top <= 1 && rect.bottom > 0 && rect.height < window.innerHeight) {
          // Skip if a parent we already counted contains this one.
          let parent = el.parentElement, isNested = false;
          while (parent) { if (seen.has(parent)) { isNested = true; break; } parent = parent.parentElement; }
          if (!isNested) {
            total = Math.max(total, rect.bottom);
            seen.add(el);
          }
        }
      });
    }
    return total;
  }

  function updateChipStickyOffset() {
    const chips = doc.querySelector('[data-cm-chips]');
    if (!chips) return;
    const h = findStickyHeaderHeight();
    doc.documentElement.style.setProperty('--cm-header-h', h + 'px');
    const rect = chips.getBoundingClientRect();
    chips.classList.toggle('is-pinned', Math.abs(rect.top - h) < 2);
  }

  if (doc.querySelector('[data-cm-chips]')) {
    updateChipStickyOffset();
    window.addEventListener('scroll', updateChipStickyOffset, { passive: true });
    window.addEventListener('resize', updateChipStickyOffset);
    // Re-measure after fonts / images load so header height is final.
    window.addEventListener('load', updateChipStickyOffset);
    setTimeout(updateChipStickyOffset, 500);
    setTimeout(updateChipStickyOffset, 1500);
  }

  // -----------------------------------------------------------
  // Reveal on scroll
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-inview");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08 }
  );
  doc.querySelectorAll("[data-cm-reveal]").forEach((el) => io.observe(el));

  // -----------------------------------------------------------
  // Sticky header hide-on-scroll-down
  doc.querySelectorAll("[data-cm-header]").forEach((header) => {
    let last = window.scrollY;
    let ticking = false;
    function onScroll() {
      const cur = window.scrollY;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (cur > 120 && cur > last) header.classList.add("is-hidden");
          else header.classList.remove("is-hidden");
          header.classList.toggle("is-scrolled", cur > 12);
          last = cur;
          ticking = false;
        });
        ticking = true;
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
  });

  // Mobile drawer
  doc.querySelectorAll("[data-cm-mobile-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const drawer = doc.querySelector("[data-cm-mobile-drawer]");
      drawer && drawer.classList.add("is-open");
    });
  });
  doc.querySelectorAll("[data-cm-mobile-close], [data-cm-mobile-drawer] .cm-cart__overlay").forEach((el) => {
    el.addEventListener("click", () => {
      const drawer = doc.querySelector("[data-cm-mobile-drawer]");
      drawer && drawer.classList.remove("is-open");
    });
  });

  // -----------------------------------------------------------
  // Announcement bar rotator
  doc.querySelectorAll("[data-cm-ann]").forEach((ann) => {
    const slides = ann.querySelectorAll(".cm-ann__slide");
    if (slides.length < 2) return;
    const interval = Number(ann.dataset.cmInterval || 4) * 1000;
    let idx = 0;
    let timer = setInterval(next, interval);
    function goto(i) {
      slides.forEach((s, si) => s.classList.toggle("is-active", si === i));
    }
    function next() { idx = (idx + 1) % slides.length; goto(idx); }
    function prev() { idx = (idx - 1 + slides.length) % slides.length; goto(idx); }
    ann.querySelector("[data-cm-ann-next]")?.addEventListener("click", () => { clearInterval(timer); next(); timer = setInterval(next, interval); });
    ann.querySelector("[data-cm-ann-prev]")?.addEventListener("click", () => { clearInterval(timer); prev(); timer = setInterval(next, interval); });
  });

  // -----------------------------------------------------------
  // Mega-menu preview image swap
  doc.querySelectorAll("[data-cm-mega]").forEach((group) => {
    const previewImg = group.querySelector("[data-cm-mega-img]");
    if (!previewImg) return;
    const initial = previewImg.getAttribute("src") || "";
    let currentSrc = initial;
    function setImage(src) {
      if (!src || src === currentSrc) return;
      currentSrc = src;
      previewImg.style.opacity = "0";
      const preloader = new Image();
      preloader.onload = () => {
        previewImg.setAttribute("src", src);
        requestAnimationFrame(() => (previewImg.style.opacity = "1"));
      };
      preloader.src = src;
    }
    group.querySelectorAll("[data-cm-mega-link]").forEach((a) => {
      a.addEventListener("mouseenter", () => setImage(a.dataset.hoverImage));
      a.addEventListener("focus", () => setImage(a.dataset.hoverImage));
    });
    group.querySelectorAll("[data-cm-mega-col]").forEach((col) => {
      col.addEventListener("mouseenter", () => setImage(col.dataset.colImage));
    });
    group.addEventListener("mouseleave", () => setImage(initial));
  });

  // -----------------------------------------------------------
  // Product card — swatch → second image swap
  doc.querySelectorAll("[data-cm-card]").forEach((card) => {
    const secondaryImg = card.querySelector('[data-cm-card-img="secondary"]');
    const primaryImg = card.querySelector('[data-cm-card-img="primary"]');
    const swatches = card.querySelectorAll("[data-cm-card-swatch]");
    if (!secondaryImg || swatches.length === 0) return;
    const initialSecondary = secondaryImg.getAttribute("src");
    const initialPrimary = primaryImg ? primaryImg.getAttribute("src") : null;
    swatches.forEach((sw) => {
      sw.addEventListener("mouseenter", () => applySwatch(sw));
      sw.addEventListener("focus", () => applySwatch(sw));
      sw.addEventListener("click", (e) => {
        // if it's a link we still allow default nav, but we highlight active immediately
        swatches.forEach((s) => s.classList.remove("is-active"));
        sw.classList.add("is-active");
      });
    });
    function applySwatch(sw) {
      const src = sw.dataset.variantImg;
      const primary = sw.dataset.primaryImg;
      if (src) secondaryImg.setAttribute("src", src);
      if (primary && primaryImg) primaryImg.setAttribute("src", primary);
    }
    card.addEventListener("mouseleave", () => {
      if (initialSecondary) secondaryImg.setAttribute("src", initialSecondary);
      if (initialPrimary && primaryImg) primaryImg.setAttribute("src", initialPrimary);
    });
  });

  // -----------------------------------------------------------
  // Cart drawer helpers
  const cartEl = doc.querySelector("[data-cm-cart]");
  function openCart() { cartEl && cartEl.classList.add("is-open"); }
  function closeCart() { cartEl && cartEl.classList.remove("is-open"); }
  doc.querySelectorAll("[data-cm-cart-open]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); openCart(); }));
  doc.querySelectorAll("[data-cm-cart-close], [data-cm-cart-overlay]").forEach((b) => b.addEventListener("click", closeCart));
  doc.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCart(); });

  // qty and remove buttons — AJAX to Shopify's cart API + Section
  // Rendering API refresh of the drawer + header cart bubble. No full
  // page reload. In-flight lock prevents double-click races.
  let cartActionInFlight = false;
  doc.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-cm-cart-qty], [data-cm-cart-remove], [data-cm-addon-add], [data-cm-rec-add]");
    if (!btn) return;
    e.preventDefault();
    if (cartActionInFlight || btn.hasAttribute("data-cm-busy")) return;
    cartActionInFlight = true;
    btn.setAttribute("data-cm-busy", "");

    try {
      if (btn.hasAttribute("data-cm-cart-qty")) {
        const line = btn.closest("[data-cm-line]");
        const key = line?.dataset.key;
        const input = line?.querySelector("input[type=number]");
        const dir = btn.dataset.dir === "-1" ? -1 : 1;
        const currentQty = Number(input?.value || 1);
        const nextQty = Math.max(0, currentQty + dir);
        if (!key) return;
        if (input) input.value = nextQty;
        const ok = await updateLine(key, nextQty);
        if (ok) await refreshCartUI();
      } else if (btn.hasAttribute("data-cm-cart-remove")) {
        const key = btn.dataset.key;
        if (!key) return;
        const ok = await updateLine(key, 0);
        if (ok) await refreshCartUI();
      } else if (btn.hasAttribute("data-cm-addon-add") || btn.hasAttribute("data-cm-rec-add")) {
        const variantId = btn.dataset.variantId;
        if (!variantId) return;
        try {
          const res = await fetch("/cart/add.js", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] })
          });
          if (res.ok) await refreshCartUI();
        } catch (err) {
          console.warn("[cm] add failed", err);
        }
      }
    } finally {
      cartActionInFlight = false;
      btn.removeAttribute("data-cm-busy");
    }
  });

  async function updateLine(key, qty) {
    try {
      const res = await fetch("/cart/change.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id: key, quantity: qty })
      });
      return res.ok;
    } catch (err) { console.warn("[cm] cart update failed", err); return false; }
  }

  // Refresh the cart drawer HTML in-place via Shopify's Section Rendering
  // API. Also update the header cart-count bubble. No page reload.
  // Exposed on window so PDP form handler (different IIFE) can call it.
  window.cmRefreshCart = refreshCartUI;
  async function refreshCartUI() {
    // Guard against browsers that throttle/pause fetches on hidden tabs —
    // if the tab isn't visible, defer the refresh until it comes back
    // instead of letting a stalled fetch leave the drawer in a loading
    // state forever.
    if (document.hidden) {
      const rerun = () => {
        if (!document.hidden) {
          document.removeEventListener("visibilitychange", rerun);
          refreshCartUI();
        }
      };
      document.addEventListener("visibilitychange", rerun);
      return;
    }
    // AbortSignal.timeout(): hard-cap each request so a network stall
    // can never hang the drawer indefinitely.
    const timeout = (AbortSignal && AbortSignal.timeout) ? AbortSignal.timeout(8000) : undefined;
    try {
      const [drawerHtml, cartJson] = await Promise.all([
        fetch(`/?sections=cm-cart-drawer&_=${Date.now()}`, { signal: timeout }).then(r => r.ok ? r.json() : null),
        fetch(`/cart.js`, { signal: timeout }).then(r => r.ok ? r.json() : null),
      ]);

      // Swap drawer content
      if (drawerHtml && drawerHtml["cm-cart-drawer"]) {
        const parser = new DOMParser();
        const wrapper = parser.parseFromString(drawerHtml["cm-cart-drawer"], "text/html");
        const nextDrawer = wrapper.querySelector("[data-cm-cart]");
        const currentDrawer = document.querySelector("[data-cm-cart]");
        if (nextDrawer && currentDrawer) {
          // Preserve open/closed state
          const wasOpen = currentDrawer.classList.contains("is-open");
          currentDrawer.replaceWith(nextDrawer);
          if (wasOpen) nextDrawer.classList.add("is-open");
        }
      }

      // Update header cart bubble
      if (cartJson) {
        const count = cartJson.item_count || 0;
        document.querySelectorAll("[data-cm-cart-count], .cm-icon-btn--cart .cm-cart-bubble, .cart-count-bubble").forEach((el) => {
          el.textContent = count;
          el.hidden = count === 0;
        });
        document.querySelectorAll("[data-cm-cart-open]").forEach((btn) => {
          btn.setAttribute("data-count", String(count));
        });
      }
    } catch (err) {
      console.warn("[cm] cart refresh failed", err);
      // Do NOT force a page reload — releasing stuck locks and letting
      // the user reload manually is less disruptive than yanking them
      // out of whatever they were doing. releaseStuckLocks() runs on
      // the next visibilitychange too, so this is belt + braces.
      releaseStuckLocks();
    }
  }

  // -----------------------------------------------------------
  // Self-healing watchdog: when the tab returns from hidden or a
  // back/forward-cache restore fires, verify that scroll locks and
  // drawer states aren't stuck. Async close animations, throttled
  // fetches, and bfcache restores can all leave <body> and <html>
  // scroll-locked with no drawer actually visible — which is what
  // makes the site feel frozen until the user reloads.
  function isAnyDrawerActuallyOpen() {
    // Custom cart drawer
    if (document.querySelector('[data-cm-cart].is-open')) return true;
    // Custom search overlay
    if (document.documentElement.classList.contains('cm-search-open')) return true;
    // Native <dialog> or <details> that carries scroll-lock
    if (document.querySelector('dialog[scroll-lock][open], details[scroll-lock][open]')) return true;
    // Halo/Ella side drawers using aria-hidden pattern
    if (document.querySelector('[data-drawer-open="true"], [aria-hidden="false"].drawer, .drawer.is-open')) return true;
    return false;
  }
  function releaseStuckLocks() {
    if (isAnyDrawerActuallyOpen()) return;
    const body = document.body;
    const html = document.documentElement;
    if (body.classList.contains('overflow-hidden')) body.classList.remove('overflow-hidden');
    if (html.hasAttribute('scroll-lock')) html.removeAttribute('scroll-lock');
    // Breakpoint-scoped variants (base.js side drawers add these too)
    ['overflow-hidden-mobile', 'overflow-hidden-tablet', 'overflow-hidden-desktop'].forEach(c => {
      if (body.classList.contains(c)) body.classList.remove(c);
    });
    // Belt + braces: any element with pointer-events:none inline from
    // an aborted animation that would block interaction.
    if (body.style.pointerEvents === 'none') body.style.pointerEvents = '';
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    // Let any deferred toggle events fire first, then heal.
    setTimeout(releaseStuckLocks, 60);
  });
  window.addEventListener('pageshow', (e) => {
    // e.persisted === true → bfcache restore. Either way, verify.
    releaseStuckLocks();
    // If the drawer was mid-refresh when the tab went to bfcache,
    // re-sync the cart count so the header bubble matches server state.
    if (e.persisted && !document.hidden) refreshCartUI();
  });

  // -----------------------------------------------------------
  // Shop-by-Style tab switcher
  doc.querySelectorAll("[data-cm-sbs]").forEach((root) => {
    const tabs = Array.from(root.querySelectorAll("[data-cm-sbs-tab]"));
    const panels = Array.from(root.querySelectorAll("[data-cm-sbs-panel]"));
    if (!tabs.length || !panels.length) return;

    const activate = (idx) => {
      tabs.forEach((t, i) => {
        const on = i === idx;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.setAttribute("tabindex", on ? "0" : "-1");
      });
      panels.forEach((p, i) => {
        const on = i === idx;
        p.classList.toggle("is-active", on);
        if (on) p.removeAttribute("hidden"); else p.setAttribute("hidden", "");
      });
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => activate(i));
      tab.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const next = (i + dir + tabs.length) % tabs.length;
        tabs[next].focus();
        activate(next);
      });
    });
  });

  // -----------------------------------------------------------
  // PDP luxury variant picker
  const moneyFmt = (cents) => {
    const rupees = (cents / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return "Rs. " + rupees;
  };
  doc.querySelectorAll("[data-cm-picker]").forEach((form) => {
    const variantsScript = form.querySelector("script[data-cm-variants]");
    let variants = [];
    try { if (variantsScript) variants = JSON.parse(variantsScript.textContent); } catch {}
    const hiddenId = form.querySelector("input[name='id'][data-variant-id]");
    const atc = form.querySelector("[data-cm-atc]");
    const priceEl = form.parentElement?.querySelector("[data-cm-price]") || document.querySelector("[data-cm-price]");
    const resolveVariant = () => {
      const selected = [];
      form.querySelectorAll("[data-cm-picker-group]").forEach((group) => {
        const active = group.querySelector(".cm-picker__thumb.is-active, .cm-picker__pill.is-active");
        if (active) selected.push(active.dataset.optionValue);
      });
      return variants.find((v) => v.options && v.options.length === selected.length && v.options.every((o, i) => o === selected[i]));
    };
    const updateForVariant = (variant) => {
      if (!variant) return;
      if (hiddenId) hiddenId.value = variant.id;
      if (priceEl && typeof variant.price === "number") priceEl.textContent = moneyFmt(variant.price);
      if (atc) {
        if (variant.available) {
          atc.removeAttribute("disabled");
          atc.textContent = "Add to cart";
        } else {
          atc.setAttribute("disabled", "");
          atc.textContent = "Sold out";
        }
      }
      if (variant.featured_image?.src) {
        const mainImg = document.querySelector(".cm-pdp-lux__main-img, .cm-pdp-ed__main-img, [data-cm-main-image]");
        if (mainImg) mainImg.src = variant.featured_image.src.replace(/(\.(jpg|jpeg|png|webp))/i, "_800x$1");
      }
    };
    form.querySelectorAll(".cm-picker__thumb, .cm-picker__pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        const picker = btn.closest("[data-cm-picker-group]");
        picker?.querySelectorAll(".cm-picker__thumb, .cm-picker__pill").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        const valueEl = picker?.querySelector("[data-cm-picker-value]");
        if (valueEl) valueEl.textContent = btn.dataset.optionValue;
        updateForVariant(resolveVariant());
      });
    });
    form.addEventListener("submit", async (e) => {
      const isBuyNow = e.submitter?.name === "checkout";
      e.preventDefault();
      const atc = form.querySelector("[data-cm-atc]");
      const label = atc?.textContent;
      if (atc) atc.textContent = "Adding…";
      try {
        const res = await fetch("/cart/add.js", { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error();
        if (isBuyNow) { window.location.href = "/checkout"; return; }
        if (atc) atc.textContent = "Added ✓";
        // Refresh drawer + cart bubble in place, then open the drawer.
        if (typeof window.cmRefreshCart === "function") await window.cmRefreshCart();
        openCart();
      } catch { if (atc) atc.textContent = "Try again"; }
      finally { setTimeout(() => { if (atc && label) atc.textContent = label; }, 1400); }
    });
  });
})();

// -----------------------------------------------------------
// <calvium-recently-viewed> — reorder the SSR-rendered cm-slider track so
// recently-viewed products appear first, then Fisher-Yates shuffle the rest.
// Reads _halo_recently_viewed (written by product-info.js:setRecentlyViewed).
// Guard against double-load: on some templates (e.g. /cart) this script
// is included by multiple sections; the top-level `class` declaration would
// throw SyntaxError on the second parse and halt every downstream feature.
if (!customElements.get("calvium-recently-viewed")) {
class CalviumRecentlyViewed extends HTMLElement {
  connectedCallback() {
    const track = this;

    const cards = Array.from(track.children).filter((el) => el.dataset && el.dataset.productId);
    if (cards.length === 0) return;

    let recentIds = [];
    try { recentIds = JSON.parse(localStorage.getItem("_halo_recently_viewed") || "[]"); } catch (e) {}
    const currentId = parseInt(this.dataset.currentProductId || "0", 10);
    if (currentId) recentIds = recentIds.filter((id) => id !== currentId);

    const byId = new Map();
    for (const card of cards) {
      byId.set(parseInt(card.dataset.productId, 10), card);
    }

    const recentMatches = [];
    const usedIds = new Set();
    for (const id of recentIds) {
      const card = byId.get(id);
      if (card && !usedIds.has(id)) {
        recentMatches.push(card);
        usedIds.add(id);
      }
    }

    const rest = cards.filter((c) => !usedIds.has(parseInt(c.dataset.productId, 10)));
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }

    const frag = document.createDocumentFragment();
    for (const el of recentMatches) frag.appendChild(el);
    for (const el of rest) frag.appendChild(el);
    track.appendChild(frag);
  }
}
customElements.define("calvium-recently-viewed", CalviumRecentlyViewed);
} // end guard for calvium-recently-viewed

// -----------------------------------------------------------
// <calvium-search> — search overlay with typeahead, recent searches, and
// keyboard navigation. Uses Shopify's predictive search JSON endpoint
// (/search/suggest.json). Opened by any [data-search-open] button,
// ⌘K / Ctrl+K, or focus events on other data-search-open triggers.
if (!customElements.get("calvium-search")) {
class CalviumSearch extends HTMLElement {
  constructor() {
    super();
    this.debounceTimer = null;
    this.currentQuery = "";
    this.isOpen = false;
    this.RECENT_KEY = "_calvium_recent_searches";
    this.RECENT_LIMIT = 25;
    this.RECENT_SHOW = 5;
  }

  connectedCallback() {
    this.input = this.querySelector("[data-cm-search-input]");
    this.form = this.querySelector(".cm-search__form");
    this.body = this.querySelector("[data-cm-search-body]");
    this.emptyEl = this.querySelector("[data-cm-search-empty]");
    this.resultsEl = this.querySelector("[data-cm-search-results]");
    this.noResultsEl = this.querySelector("[data-cm-search-no-results]");
    this.loadingEl = this.querySelector("[data-cm-search-loading]");
    this.clearBtn = this.querySelector("[data-cm-search-clear]");
    this.recentSection = this.querySelector("[data-cm-search-recent-section]");
    this.recentList = this.querySelector("[data-cm-search-recent-list]");
    this.queryDisplay = this.querySelector("[data-cm-search-query]");
    if (!this.input || !this.form) return;

    document.querySelectorAll("[data-search-open]").forEach((btn) => {
      btn.addEventListener("click", (e) => { e.preventDefault(); this.open(); });
    });

    this.querySelectorAll("[data-cm-search-close]").forEach((btn) => {
      btn.addEventListener("click", () => this.close());
    });

    this.input.addEventListener("input", () => {
      const q = this.input.value.trim();
      if (this.clearBtn) this.clearBtn.hidden = q.length === 0;
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.search(q), 250);
    });

    if (this.clearBtn) {
      this.clearBtn.addEventListener("click", () => {
        this.input.value = "";
        this.clearBtn.hidden = true;
        this.currentQuery = "";
        this.showEmpty();
        this.input.focus();
      });
    }

    const clearRecentBtn = this.querySelector("[data-cm-search-clear-recent]");
    if (clearRecentBtn) clearRecentBtn.addEventListener("click", () => this.clearRecent());

    this.form.addEventListener("submit", () => {
      const q = this.input.value.trim();
      if (q) this.saveRecent(q);
    });

    this.recentList.addEventListener("click", (e) => {
      const removeBtn = e.target.closest("[data-remove-recent]");
      if (removeBtn) {
        e.preventDefault();
        this.removeRecent(removeBtn.dataset.removeRecent);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) { this.close(); return; }
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        this.isOpen ? this.close() : this.open();
      }
    });

    this.resultsEl.addEventListener("keydown", (e) => this.handleResultsKeydown(e));
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        const first = this.resultsEl.querySelector("a[href], button");
        if (first) { e.preventDefault(); first.focus(); }
      }
    });
  }

  open() {
    this.hidden = false;
    void this.offsetWidth;
    this.classList.add("is-open");
    document.documentElement.classList.add("cm-search-open");
    setTimeout(() => this.input.focus(), 60);
    this.renderRecent();
    this.isOpen = true;
  }

  close() {
    this.classList.remove("is-open");
    document.documentElement.classList.remove("cm-search-open");
    this.isOpen = false;
    setTimeout(() => {
      this.hidden = true;
      this.input.value = "";
      this.clearBtn.hidden = true;
      this.currentQuery = "";
      this.showEmpty();
    }, 220);
  }

  showEmpty() {
    this.emptyEl.hidden = false;
    this.resultsEl.hidden = true;
    this.noResultsEl.hidden = true;
    this.loadingEl.hidden = true;
  }
  showLoading() { this.loadingEl.hidden = false; }
  showResults() {
    this.emptyEl.hidden = true;
    this.resultsEl.hidden = false;
    this.noResultsEl.hidden = true;
    this.loadingEl.hidden = true;
  }
  showNoResults(query) {
    this.emptyEl.hidden = true;
    this.resultsEl.hidden = true;
    this.noResultsEl.hidden = false;
    this.loadingEl.hidden = true;
    if (this.queryDisplay) this.queryDisplay.textContent = query;
  }

  async search(query) {
    if (!query || query.length < 2) { this.showEmpty(); return; }
    this.currentQuery = query;
    this.showLoading();

    const params = new URLSearchParams();
    params.set("q", query);
    params.set("resources[type]", "product,collection,query");
    params.set("resources[limit]", "6");
    params.set("resources[limit_scope]", "each");
    params.set("resources[options][unavailable_products]", "last");

    try {
      const res = await fetch(`/search/suggest.json?${params.toString()}`, {
        headers: { "Accept": "application/json" }
      });
      if (!res.ok) throw new Error(`Search ${res.status}`);
      const data = await res.json();

      if (query !== this.currentQuery) return;

      const results = (data && data.resources && data.resources.results) || {};
      const products = results.products || [];
      const collections = results.collections || [];
      const queries = results.queries || [];
      const total = products.length + collections.length + queries.length;

      if (total === 0) {
        this.showNoResults(query);
      } else {
        this.renderResults(products, collections, queries, query);
        this.showResults();
      }
    } catch (e) {
      console.warn("[cm-search] fetch failed", e);
      this.loadingEl.hidden = true;
    }
  }

  renderResults(products, collections, queries, query) {
    const parts = [];

    if (queries.length > 0) {
      parts.push(`<section class="cm-search__section">
        <h3 class="cm-search__section-title">Suggestions</h3>
        <div class="cm-search__pills">${
          queries.map((q) => {
            const text = q.text || q.styled_text || String(q);
            return `<a href="${this.escapeAttr("/search?q=" + encodeURIComponent(text) + "&type=product")}" class="cm-search__pill">${this.escapeHtml(text)}</a>`;
          }).join("")
        }</div>
      </section>`);
    }

    if (collections.length > 0) {
      parts.push(`<section class="cm-search__section">
        <h3 class="cm-search__section-title">Collections</h3>
        <ul class="cm-search__result-list" role="list">${
          collections.map((c) => `
            <li>
              <a class="cm-search__result-link" href="${this.escapeAttr(c.url)}">
                <span>${this.escapeHtml(c.title)}</span>
                <span class="cm-search__result-arrow" aria-hidden="true">→</span>
              </a>
            </li>
          `).join("")
        }</ul>
      </section>`);
    }

    if (products.length > 0) {
      parts.push(`<section class="cm-search__section">
        <div class="cm-search__section-head">
          <h3 class="cm-search__section-title">Products</h3>
          <a class="cm-search__view-all" href="${this.escapeAttr("/search?q=" + encodeURIComponent(query) + "&type=product")}">See all →</a>
        </div>
        <ul class="cm-search__product-list" role="list">${
          products.map((p) => {
            const img = p.featured_image && p.featured_image.url ? p.featured_image.url : "";
            const imgSrc = img ? (img.indexOf("?") >= 0 ? `${img}&width=200` : `${img}?width=200`) : "";
            return `<li>
              <a class="cm-search__product" href="${this.escapeAttr(p.url)}">
                <span class="cm-search__product-thumb">${
                  imgSrc ? `<img src="${this.escapeAttr(imgSrc)}" alt="" loading="lazy" width="80" height="106">` : ""
                }</span>
                <span class="cm-search__product-info">
                  ${p.vendor ? `<span class="cm-search__product-vendor">${this.escapeHtml(p.vendor)}</span>` : ""}
                  <span class="cm-search__product-title">${this.escapeHtml(p.title)}</span>
                  <span class="cm-search__product-price">${this.escapeHtml(p.price || "")}</span>
                </span>
              </a>
            </li>`;
          }).join("")
        }</ul>
      </section>`);
    }

    this.resultsEl.innerHTML = parts.join("");
  }

  handleResultsKeydown(e) {
    const focusables = Array.from(this.resultsEl.querySelectorAll("a[href], button"));
    if (focusables.length === 0) return;
    const currentIndex = focusables.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = currentIndex < focusables.length - 1 ? currentIndex + 1 : 0;
      focusables[next].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (currentIndex <= 0) { this.input.focus(); return; }
      focusables[currentIndex - 1].focus();
    }
  }

  saveRecent(query) {
    if (!query || query.length < 2) return;
    let recent = this.getRecent();
    recent = recent.filter((r) => r.toLowerCase() !== query.toLowerCase());
    recent.unshift(query);
    try { localStorage.setItem(this.RECENT_KEY, JSON.stringify(recent.slice(0, this.RECENT_LIMIT))); } catch (e) {}
  }

  getRecent() {
    try { return JSON.parse(localStorage.getItem(this.RECENT_KEY) || "[]"); } catch (e) { return []; }
  }

  renderRecent() {
    const recent = this.getRecent();
    if (recent.length === 0) { this.recentSection.hidden = true; return; }
    this.recentSection.hidden = false;
    this.recentList.innerHTML = recent.slice(0, this.RECENT_SHOW).map((q) => {
      const safe = this.escapeHtml(q);
      const safeAttr = this.escapeAttr(q);
      const url = "/search?q=" + encodeURIComponent(q) + "&type=product";
      return `<span class="cm-search__recent-pill">
        <a href="${this.escapeAttr(url)}" class="cm-search__pill">${safe}</a>
        <button type="button" class="cm-search__recent-remove" data-remove-recent="${safeAttr}" aria-label="Remove ${safe} from recent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </span>`;
    }).join("");
  }

  removeRecent(query) {
    const recent = this.getRecent().filter((r) => r !== query);
    try { localStorage.setItem(this.RECENT_KEY, JSON.stringify(recent)); } catch (e) {}
    this.renderRecent();
  }

  clearRecent() {
    try { localStorage.removeItem(this.RECENT_KEY); } catch (e) {}
    this.renderRecent();
  }

  escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]
    ));
  }
  escapeAttr(str) { return this.escapeHtml(str); }
}
customElements.define("calvium-search", CalviumSearch);
} // end guard for calvium-search

// Auto-submit sort dropdown on the search results page
document.addEventListener("change", (e) => {
  const sel = e.target.closest("[data-cm-search-sort]");
  if (sel) sel.form && sel.form.submit();
});
