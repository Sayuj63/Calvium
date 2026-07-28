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

  // qty and remove buttons — best-effort AJAX to Shopify's cart API
  doc.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-cm-cart-qty], [data-cm-cart-remove], [data-cm-addon-add], [data-cm-rec-add]");
    if (!btn) return;
    e.preventDefault();
    if (btn.hasAttribute("data-cm-cart-qty")) {
      const line = btn.closest("[data-cm-line]");
      const key = line?.dataset.key;
      const input = line?.querySelector("input[type=number]");
      const dir = btn.dataset.dir === "-1" ? -1 : 1;
      const nextQty = Math.max(0, Number(input?.value || 1) + dir);
      if (!key) return;
      await updateLine(key, nextQty);
      window.location.reload();
    } else if (btn.hasAttribute("data-cm-cart-remove")) {
      const key = btn.dataset.key;
      if (!key) return;
      await updateLine(key, 0);
      window.location.reload();
    } else if (btn.hasAttribute("data-cm-addon-add") || btn.hasAttribute("data-cm-rec-add")) {
      const variantId = btn.dataset.variantId;
      if (!variantId) return;
      try {
        await fetch("/cart/add.js", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] })
        });
        window.location.reload();
      } catch (err) {
        console.warn("[cm] add failed", err);
      }
    }
  });

  async function updateLine(key, qty) {
    try {
      await fetch("/cart/change.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id: key, quantity: qty })
      });
    } catch (err) { console.warn("[cm] cart update failed", err); }
  }

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
        openCart();
      } catch { if (atc) atc.textContent = "Try again"; }
      finally { setTimeout(() => { if (atc && label) atc.textContent = label; }, 1400); }
    });
  });
})();
