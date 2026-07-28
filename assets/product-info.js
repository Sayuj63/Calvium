if (!customElements.get('product-info')) {
  customElements.define(
    'product-info',
    class ProductInfo extends HTMLElement {
      quantityInput = undefined;
      quantityForm = undefined;
      stickyQuantityContainer = undefined;
      stickyQuantityInput = undefined;
      isSyncingQuantity = false;
      isSyncingVariant = false;
      onVariantChangeUnsubscriber = undefined;
      cartUpdateUnsubscriber = undefined;
      variantChangeUnsubscriber = undefined;
      abortController = undefined;
      pendingRequestUrl = null;
      preProcessHtmlCallbacks = [];
      postProcessHtmlCallbacks = [];

      constructor() {
        super();

        this.quantityInput = this.querySelector('.quantity__input');
        this.stickyQuantityContainer = document.querySelector('.sticky-cart__quantity');
        this.stickyQuantityInput = this.stickyQuantityContainer?.querySelector('.quantity__input') || undefined;
        this.setRecentlyViewed();
      }

      connectedCallback() {
        this.initializeProductSwapUtility();

        this.onVariantChangeUnsubscriber = subscribe(
          PUB_SUB_EVENTS.optionValueSelectionChange,
          this.handleOptionValueChange.bind(this)
        );

        this.initQuantityHandlers();
        this.initStickyQuantityHandlers();
        this.initVariantSyncHandlers();
        this.classList.add('initialized');
        this.dispatchEvent(new CustomEvent('product-info:loaded', { bubbles: true }));
      }

      addPreProcessCallback(callback) {
        this.preProcessHtmlCallbacks.push(callback);
      }

      initVariantSyncHandlers() {
        this.variantChangeUnsubscriber = subscribe(
          PUB_SUB_EVENTS.variantChange,
          this.handleVariantChangeForSticky.bind(this)
        );
      }

      handleVariantChangeForSticky({ data }) {
        if (data.sectionId !== this.sectionId) return;
        if (this.isSyncingVariant) return;
        
        this.isSyncingVariant = true;

        try {
          const stickyVariantSelects = document.querySelector('variant-selects[data-context^="sticky"]');
          if (!stickyVariantSelects) return;

          const mainVariantSelects = this.variantSelectors;
          if (!mainVariantSelects) return;

          const mainSelectedOptions = mainVariantSelects.querySelectorAll('select option[selected], fieldset input:checked');
          
          mainSelectedOptions.forEach((mainOption) => {
            const optionValueId = mainOption.dataset.optionValueId;
            if (!optionValueId) return;

            const stickyOption = stickyVariantSelects.querySelector(`[data-option-value-id="${optionValueId}"]`);
            if (!stickyOption) return;

            if (stickyOption.tagName === 'INPUT' && stickyOption.type === 'radio') {

              stickyVariantSelects.querySelectorAll('input[type="radio"]').forEach(input => input.classList.remove('checked'));
              stickyVariantSelects.querySelectorAll('label').forEach(label => label.classList.remove('checked'));
              if (mainOption) {
                mainVariantSelects.querySelectorAll('input[type="radio"]').forEach(input => input.classList.remove('checked'));
                mainVariantSelects.querySelectorAll('label').forEach(label => label.classList.remove('checked'));
              }

              if (!stickyOption.checked) {
                setTimeout(() => {
                  stickyOption.classList.add('checked');
                  stickyOption.nextElementSibling.classList.add('checked');
                  if (mainOption) {
                    mainOption.classList.add('checked');
                    mainOption.nextElementSibling.classList.add('checked');
                  }
                }, 10);
                const selectedValueSpan = stickyOption.closest('.product-form__input')?.querySelector('[data-selected-value]');
                if (selectedValueSpan) {
                  selectedValueSpan.innerHTML = stickyOption.value;
                }
              }
            } else if (stickyOption.tagName === 'OPTION') {
              const select = stickyOption.closest('select');
              if (select && select.value !== stickyOption.value) {
                Array.from(select.options).forEach(opt => opt.removeAttribute('selected'));
                stickyOption.setAttribute('selected', 'selected');
                select.value = stickyOption.value;
                
                const swatchValue = stickyOption.dataset.optionSwatchValue;
                const selectedDropdownSwatchValue = select.closest('.product-form__input')?.querySelector('[data-selected-value] > .swatch');
                if (selectedDropdownSwatchValue) {
                  if (swatchValue) {
                    selectedDropdownSwatchValue.style.setProperty('--swatch--background', swatchValue);
                    selectedDropdownSwatchValue.classList.remove('swatch--unavailable');
                  } else {
                    selectedDropdownSwatchValue.style.setProperty('--swatch--background', 'unset');
                    selectedDropdownSwatchValue.classList.add('swatch--unavailable');
                  }
                  selectedDropdownSwatchValue.style.setProperty(
                    '--swatch-focal-point',
                    stickyOption.dataset.optionSwatchFocalPoint || 'unset'
                  );
                }
                
                const selectedValueSpan = select.closest('.product-form__input')?.querySelector('[data-selected-value]');
                if (selectedValueSpan) {
                  const textNode = selectedValueSpan.childNodes[selectedValueSpan.childNodes.length - 1];
                  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                    textNode.textContent = stickyOption.value;
                  } else {
                    const swatchEl = selectedValueSpan.querySelector('.swatch');
                    selectedValueSpan.innerHTML = '';
                    if (swatchEl) selectedValueSpan.appendChild(swatchEl);
                    selectedValueSpan.appendChild(document.createTextNode(stickyOption.value));
                  }
                }
              }
            }
          });

          this.updateStickyButtonState(data.variant);
        } finally {
          setTimeout(() => {
            this.isSyncingVariant = false;
          }, 10);
        }
      }

      updateStickyButtonState(variant) {
        const stickyButton = document.querySelector('.sticky-cart__button [name="add"]');
        const stickyButtonText = stickyButton?.querySelector('.add-to-cart-text');
        const stickyQuantityForm = document.querySelector('#StickyCart-Quantity-Form-' + this.dataset.section);
        
        if (!stickyButton) return;

        if (variant && variant.available) {
          stickyButton.removeAttribute('disabled');
          stickyButton.classList.remove('sold-out--button');
          if (stickyQuantityForm) {
            stickyQuantityForm.classList.remove('disabled');
          }
          
          if (stickyButtonText) {
            const inventoryQty = variant.inventory_quantity || 0;
            const inventoryPolicy = variant.inventory_policy || 'deny';
            
            if (inventoryQty <= 0 && inventoryPolicy === 'continue') {
              stickyButtonText.innerHTML = window.variantStrings.preOrder;
            } else {
              stickyButtonText.innerHTML = window.variantStrings.addToCart;
            }
          }
        } else {
          stickyButton.setAttribute('disabled', 'disabled');
          stickyButton.classList.add('sold-out--button');
          if (stickyQuantityForm) {
            stickyQuantityForm.classList.add('disabled');
          }
          if (stickyButtonText) {
            stickyButtonText.innerHTML = window.variantStrings.soldOut;
          }
        }

        const stickyVariantInput = document.querySelector('#product-form-sticky-' + this.dataset.section + ' input[name="id"]');
        if (stickyVariantInput && variant) {
          stickyVariantInput.value = variant.id;
        }

        try {
          this.updateStickyThumbnail(variant);
        } catch (e) {
          // silent
        }
      }

      initQuantityHandlers() {
        if (!this.quantityInput) return;

        this.quantityForm = this.querySelector('.product-form__quantity');
        if (!this.quantityForm) return;

        this.setQuantityBoundries();
        if (!this.dataset.originalSection) {
          this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, this.fetchQuantityRules.bind(this));
        }
      }

      initStickyQuantityHandlers() {
        if (!this.stickyQuantityInput || !this.quantityInput) return;

        this.syncStickyFromMain();

        const onStickyChange = () => this.syncMainFromSticky();
        this.stickyQuantityInput.addEventListener('input', onStickyChange);
        this.stickyQuantityInput.addEventListener('change', onStickyChange);

        const onMainChange = () => this.syncStickyFromMain();
        this.quantityInput.addEventListener('input', onMainChange);
        this.quantityInput.addEventListener('change', onMainChange);

        this.syncStickyConstraintsFromMain();
      }

      syncMainFromSticky() {
        if (!this.stickyQuantityInput || !this.quantityInput) return;
        if (this.isSyncingQuantity) return;
        this.isSyncingQuantity = true;
        try {
          this.quantityInput.value = this.stickyQuantityInput.value;
          this.quantityInput.dispatchEvent(new Event('change', { bubbles: true }));
          publish?.(PUB_SUB_EVENTS.quantityUpdate, undefined);
        } finally {
          this.isSyncingQuantity = false;
        }
      }

      syncStickyFromMain() {
        if (!this.stickyQuantityInput || !this.quantityInput) return;
        if (this.isSyncingQuantity) return;
        this.isSyncingQuantity = true;
        try {
          this.stickyQuantityInput.value = this.quantityInput.value;
          this.syncStickyConstraintsFromMain();
        } finally {
          this.isSyncingQuantity = false;
        }
      }

      syncStickyConstraintsFromMain() {
        if (!this.stickyQuantityInput || !this.quantityInput) return;
        const attrs = ['data-cart-quantity', 'data-min', 'data-max', 'step', 'min', 'max'];
        attrs.forEach((attr) => {
          const val = this.quantityInput.getAttribute(attr);
          if (val !== null) {
            this.stickyQuantityInput.setAttribute(attr, val);
          } else {
            this.stickyQuantityInput.removeAttribute(attr);
          }
        });
      }

      disconnectedCallback() {
        this.onVariantChangeUnsubscriber();
        this.cartUpdateUnsubscriber?.();
        this.variantChangeUnsubscriber?.();
      }

      initializeProductSwapUtility() {
        this.preProcessHtmlCallbacks.push((html) =>
          html.querySelectorAll('.scroll-trigger').forEach((element) => element.classList.add('scroll-trigger--cancel'))
        );
        this.postProcessHtmlCallbacks.push((newNode) => {
          window?.Shopify?.PaymentButton?.init();
          window?.ProductModel?.loadShopifyXR();
        });
      }

      handleOptionValueChange({ data: { event, target, selectedOptionValues } }) {
        if (!this.contains(event.target)) return;

        this.resetProductFormState();

        const productUrl = target.dataset.productUrl || this.pendingRequestUrl || this.dataset.url;
        this.pendingRequestUrl = productUrl;
        const shouldSwapProduct = this.dataset.url !== productUrl;
        const shouldFetchFullPage = this.dataset.updateUrl === 'true' && shouldSwapProduct;
        const isStickyChanged = event.target.closest('variant-selects');
        this.renderProductInfo({
          requestUrl: this.buildRequestUrlWithParams(productUrl, selectedOptionValues, shouldFetchFullPage),
          targetId: target.id,
          callback: shouldSwapProduct
            ? this.handleSwapProduct(productUrl, shouldFetchFullPage)
            : this.handleUpdateProductInfo(productUrl, event.target),
          isStickyChanged,
        });
      }

      resetProductFormState() {
        const productForm = this.productForm;
        productForm?.toggleSubmitButton(true);
        productForm?.handleErrorMessage();
      }

      handleSwapProduct(productUrl, updateFullPage) {
        return (html) => {
          this.productModal?.remove();

          const selector = updateFullPage ? "product-info[id^='MainProduct']" : 'product-info';
          const variant = this.getSelectedVariant(html.querySelector(selector));
          

          this.updateURL(productUrl, variant?.id);

          if (updateFullPage) {
            document.querySelector('head title').innerHTML = html.querySelector('head title').innerHTML;

            HTMLUpdateUtility.viewTransition(
              document.querySelector('main'),
              html.querySelector('main'),
              this.preProcessHtmlCallbacks,
              this.postProcessHtmlCallbacks
            );
          } else {
            HTMLUpdateUtility.viewTransition(
              this,
              html.querySelector('product-info'),
              this.preProcessHtmlCallbacks,
              this.postProcessHtmlCallbacks
            );
          }
        };
      }

      renderProductInfo({ requestUrl, targetId, callback, isStickyChanged = false }) {
        this.abortController?.abort();
        this.abortController = new AbortController();

        fetch(requestUrl, { signal: this.abortController.signal })
          .then((response) => response.text())
          .then((responseText) => {
            this.pendingRequestUrl = null;
            const html = new DOMParser().parseFromString(responseText, 'text/html');
            callback(html);
          })
          .then(() => {
            if (!isStickyChanged) {
              document.querySelector(`#${targetId}`)?.focus();
            }
          })
          .catch((error) => {
            if (error.name === 'AbortError') {
              console.log('Fetch aborted by user');
            } else {
              console.error(error);
            }
          });
      }

      getSelectedVariant(productInfoNode) {
        const selectedVariant = productInfoNode.querySelector('variant-selects [data-selected-variant]')?.innerHTML;
        return !!selectedVariant ? JSON.parse(selectedVariant) : null;
      }

      buildRequestUrlWithParams(url, optionValues, shouldFetchFullPage = false) {
        const params = [];

        !shouldFetchFullPage && params.push(`section_id=${this.sectionId}`);

        if (optionValues.length) {
          params.push(`option_values=${optionValues.join(',')}`);
        }

        return `${url}?${params.join('&')}`;
      }

      updateOptionValues(html) {
        const variantSelects = html.querySelector('variant-selects');
        if (variantSelects) {
          HTMLUpdateUtility.viewTransition(this.variantSelectors, variantSelects, this.preProcessHtmlCallbacks);
        }
      }

      handleUpdateProductInfo(productUrl, target) {
        return (html) => {
          const variant = this.getSelectedVariant(html);

          this.pickupAvailability?.update(variant);

          try {
            const pid = String(this.dataset?.productId || '').trim();
            if (pid && variant?.id) {
              const policyKey = `product_inventory_policy_array_${pid}`;
              const qtyKey = `product_inventory_array_${pid}`;
              if (!window[policyKey]) window[policyKey] = {};
              if (!window[qtyKey]) window[qtyKey] = {};

              if (variant?.inventory_policy) {
                window[policyKey][variant.id] = variant.inventory_policy;
              } else {
                const quantityInputUpdated = html.querySelector(`#Quantity-Form-${this.sectionId} .quantity__input`)
                  || html.querySelector(`#product-form-${this.sectionId} .quantity__input`);
                const policyAttr = quantityInputUpdated?.getAttribute('data-inventory-policy');
                if (policyAttr) window[policyKey][variant.id] = policyAttr;
              }

              let qty = typeof variant?.inventory_quantity !== 'undefined' ? Number(variant.inventory_quantity) : NaN;
              if (Number.isNaN(qty)) {
                const quantityInputUpdated = html.querySelector(`#Quantity-Form-${this.sectionId} .quantity__input`)
                  || html.querySelector(`#product-form-${this.sectionId} .quantity__input`);
                const qtyAttr = quantityInputUpdated?.getAttribute('data-inventory-quantity');
                qty = typeof qtyAttr !== 'undefined' && qtyAttr !== null ? Number(qtyAttr) : NaN;
              }
              if (!Number.isNaN(qty)) {
                window[qtyKey][variant.id] = qty;
              }
            }
          } catch (e) {
            // silent
          }
          this.updateOptionValues(html);
          this.updateURL(productUrl, variant?.id);
          this.updateVariantInputs(variant?.id);

          if (!variant) {
            this.setUnavailable();
            return;
          }

          this.updateMedia(html, variant?.featured_media?.id);

          try {
            if (typeof MainEvents !== 'undefined' && MainEvents.variantUpdate) {
              const eventDetail = {
                resource: variant || null,
                sourceId: this.id || this.dataset.section,
                data: {
                  html,
                  productId: this.dataset?.productId || this.sectionId,
                  newProduct: undefined,
                },
              };
              document.dispatchEvent(new CustomEvent(MainEvents.variantUpdate, { bubbles: true, detail: eventDetail }));
            }
          } catch (e) {
            // silent
          }

          if (document.querySelector('.step-by-step-variant-picker')) {
            this.getVariantData();
            this.updateVariantStatuses(target);
          }

          const updateSourceFromDestination = (id, shouldHide = (source) => false) => {
            const source = html.getElementById(`${id}-${this.sectionId}`);
            const destination = this.querySelector(`#${id}-${this.dataset.section}`);
            if (source && destination) {
              destination.innerHTML = source.innerHTML;
              destination.classList.toggle('hidden', shouldHide(source));
            }
          };

          updateSourceFromDestination('price');
          updateSourceFromDestination('Sku', ({ classList }) => classList.contains('hidden'));
          updateSourceFromDestination('Inventory', ({ innerText }) => innerText === '');
          updateSourceFromDestination('Volume');
          updateSourceFromDestination('Price-Per-Item', ({ classList }) => classList.contains('hidden'));
          this.updateQuantityRules(this.sectionId, html);
          this.querySelector(`#Quantity-Rules-${this.dataset.section}`)?.classList.remove('hidden');
          this.querySelector(`#Volume-Note-${this.dataset.section}`)?.classList.remove('hidden');

          this.productForm?.toggleSubmitButton(
            html.getElementById(`ProductSubmitButton-${this.sectionId}`)?.hasAttribute('disabled') ?? true,
            window.variantStrings.soldOut
          );

          publish(PUB_SUB_EVENTS.variantChange, {
            data: {
              sectionId: this.sectionId,
              html,
              variant,
            },
          });

          this.handleHotStock(this);
          this.handleBackInStockAlert(this);
          this.updateAddButtonText(this);
        };
      }

      updateVariantStatuses(target) {
        if (!this.variantData) return;

        const selectedOptionOneVariants1 = this.variantData.filter(variant => this.querySelectorAll(':checked')[0]?.value === variant.option1);
        const selectedOptionOneVariants2 = this.variantData.filter(variant => this.querySelectorAll(':checked')[1]?.value === variant.option2);
        const selectedOptionOneVariants3 = this.variantData.filter(variant => this.querySelectorAll(':checked')[2]?.value === variant.option3);
        const variant_swatch = [...this.querySelectorAll('.product-form__input--swatch')];

        if (variant_swatch.length > 1 && target){
          if(target.closest('.product-form__input').dataset.optionIndex == 0) this.updateImageSwatch(selectedOptionOneVariants1, 0);
          if(target.closest('.product-form__input').dataset.optionIndex == 1) this.updateImageSwatch(selectedOptionOneVariants2, 1);
          if(target.closest('.product-form__input').dataset.optionIndex == 2) this.updateImageSwatch(selectedOptionOneVariants3, 2);
        }
      }

      updateImageSwatch(selectedOptionOneVariants,optionIndex) {
        const inputWrappers = this.querySelectorAll('.product-form__input');
        if(inputWrappers){
          inputWrappers.forEach((element, inputIndex) => {
            const imageSpan = element.querySelectorAll(".swatch");
            const inputList = element.querySelectorAll("input");

            inputList.forEach((item, index) => {
              if(inputIndex != optionIndex){
                const image = selectedOptionOneVariants.filter(tmp => {
                  if (inputIndex == 0) return tmp.option1 == item.value;
                  if (inputIndex == 1) return tmp.option2 == item.value;
                  if (inputIndex == 2) return tmp.option3 == item.value;
                });

                if(image.length > 0) {
                  var remainingOptionValue = inputWrappers[3 - inputIndex - optionIndex]?.querySelector(':checked').value;
                  let activeIndex = 0;
                      
                  for (let i = 0; i < image.length; i++) {
                    const imageItem = image[i];
                    const title = imageItem.title;

                    if (title.includes(remainingOptionValue)) {
                      activeIndex = i;
                    }
                  }
                  
                  if (imageSpan[index] != undefined && image[activeIndex].featured_image != null) imageSpan[index].style.backgroundImage = `url("${image[activeIndex].featured_image.src}")`;
                }
              }
            })
          });
        }
      }

      getVariantData() {
        const variantStepByStep = document.querySelector('.step-by-step-variant-picker [data-all-variants]');
        if (!variantStepByStep) return;
        
        this.variantData = this.variantData || JSON.parse(variantStepByStep.textContent);
        return this.variantData;
      }

      updateVariantInputs(variantId) {
        this.querySelectorAll(
          `#product-form-${this.dataset.section},
           #product-form-installment-${this.dataset.section},
           #product-form-sticky-${this.dataset.section},
           #product-form-edit-${this.dataset.section}`
        ).forEach((productForm) => {
          const input = productForm.querySelector('input[name="id"]');
          
          input.value = variantId ?? '';
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }

      updateURL(url, variantId) {
        this.querySelector('share-button')?.updateUrl(
          `${window.shopUrl}${url}${variantId ? `?variant=${variantId}` : ''}`
        );

        if (this.dataset.updateUrl === 'false') return;
        window.history.replaceState({}, '', `${url}${variantId ? `?variant=${variantId}` : ''}`);
      }

      setUnavailable() {
        this.productForm?.toggleSubmitButton(true, window.variantStrings.unavailable);

        const selectors = ['price', 'Inventory', 'Sku', 'Price-Per-Item', 'Volume-Note', 'Volume', 'Quantity-Rules']
          .map((id) => `#${id}-${this.dataset.section}`)
          .join(', ');
        document.querySelectorAll(selectors).forEach(({ classList }) => classList.add('hidden'));
      }

      updateMedia(html, variantFeaturedMediaId) {
        if (!variantFeaturedMediaId) return;

        this.querySelector(`media-gallery`)?.setActiveMedia?.(
          `${this.dataset.section}-${variantFeaturedMediaId}`,
          true
        );

        const mediaGallerySelector = `.media-gallery--hide-variants[data-section="${this.sectionId}"], .media-gallery--hide-variants[data-section-id="${this.sectionId}"]`;
        const currentMediaGallery = document.querySelector(mediaGallerySelector);
        const newMediaGallery = html.querySelector(mediaGallerySelector);
        const variantImageGrouped = html.querySelector('.has-variant-image-grouped');

        if (currentMediaGallery && newMediaGallery && !variantImageGrouped) {
          try {
            newMediaGallery.scrollIntoView({ behavior: 'smooth' });
          } catch (e) {
            // silent
          }

          currentMediaGallery.replaceWith(newMediaGallery);
        }
      }

      updateStickyThumbnail(variant) {
        if (!variant) return;
        const sectionId = this.sectionId;
        const stickyScope = document.querySelector(`sticky-atc[data-sticky-section-id="${sectionId}"]`)
          || document.querySelector('sticky-atc');
        if (!stickyScope) return;

        const img = stickyScope.querySelector('.sticky-atc__media img');
        if (!img) return;

        const srcCandidate = variant?.featured_media?.preview_image?.src || variant?.featured_media?.src;
        if (!srcCandidate) return;

        const url = srcCandidate.includes('?') ? `${srcCandidate}&width=64` : `${srcCandidate}?width=64`;
        img.src = url;
        if (img.hasAttribute('srcset')) img.removeAttribute('srcset');
        img.setAttribute('sizes', '64px');
        img.setAttribute('width', '64');
        img.setAttribute('height', '64');
        img.loading = 'lazy';
      }

      setQuantityBoundries() {
        const data = {
          cartQuantity: this.quantityInput.dataset.cartQuantity ? parseInt(this.quantityInput.dataset.cartQuantity) : 0,
          min: this.quantityInput.dataset.min ? parseInt(this.quantityInput.dataset.min) : 1,
          max: this.quantityInput.dataset.max ? parseInt(this.quantityInput.dataset.max) : null,
          step: this.quantityInput.step ? parseInt(this.quantityInput.step) : 1,
        };

        let min = data.min;
        const max = data.max === null ? data.max : data.max - data.cartQuantity;
        if (max !== null) min = Math.min(min, max);
        if (data.cartQuantity >= data.min) min = Math.min(min, data.step);

        this.quantityInput.min = min;

        if (max) {
          this.quantityInput.max = max;
        } else {
          this.quantityInput.removeAttribute('max');
        }
        this.quantityInput.value = min;

        publish(PUB_SUB_EVENTS.quantityUpdate, undefined);
      }

      fetchQuantityRules() {
        const currentVariantId = this.productForm?.variantIdInput?.value;
        if (!currentVariantId) return;

        this.querySelector('.quantity__rules-cart .loading__spinner').classList.remove('hidden');
        fetch(`${this.dataset.url}?variant=${currentVariantId}&section_id=${this.dataset.section}`)
          .then((response) => response.text())
          .then((responseText) => {
            const html = new DOMParser().parseFromString(responseText, 'text/html');
            this.updateQuantityRules(this.dataset.section, html);
          })
          .catch((e) => console.error(e))
          .finally(() => this.querySelector('.quantity__rules-cart .loading__spinner').classList.add('hidden'));
      }

      updateQuantityRules(sectionId, html) {
        if (!this.quantityInput) return;
        this.setQuantityBoundries();

        const quantityFormUpdated = html.getElementById(`Quantity-Form-${sectionId}`);
        if (!quantityFormUpdated) return;

        const selectors = ['.quantity__input', '.quantity__rules', '.quantity__label'];
        for (let selector of selectors) {
          const current = this.quantityForm.querySelector(selector);
          const updated = quantityFormUpdated.querySelector(selector);
          if (!current || !updated) continue;
          if (selector === '.quantity__input') {
            const attributes = ['data-cart-quantity', 'data-min', 'data-max', 'step'];
            for (let attribute of attributes) {
              const valueUpdated = updated.getAttribute(attribute);
              if (valueUpdated !== null) {
                current.setAttribute(attribute, valueUpdated);
              } else {
                current.removeAttribute(attribute);
              }
            }
            this.syncStickyConstraintsFromMain();
            this.syncStickyFromMain();
          } else {
            current.innerHTML = updated.innerHTML;
          }
        }
      }

      setRecentlyViewed() {
        const name = '_halo_recently_viewed';
        const productId = parseInt(this.dataset.productId);
        let listItems = JSON.parse(localStorage.getItem(name) || '[]');
        if (!productId) return;
        if (listItems.includes(productId)) listItems = listItems.filter(id => id !== productId);
        listItems.unshift(productId);
        localStorage.setItem(name, JSON.stringify(listItems.slice(0, 25)));
      }

      handleHotStock(data) {
        const variantId = data.productForm?.variantIdInput?.value;
        const productId = data.dataset.productId;

        const inventoryMapKey = `product_inventory_array_${productId}`;
        const inventoryMap = window[inventoryMapKey] || {};
        const inventoryQuantity = variantId ? Number(inventoryMap[variantId]) || 0 : 0;

        const hotStock = document.querySelector('.productView-hotStock');
        if (!hotStock) return;

        const maxStock = Number(hotStock.dataset.hotStock) || 0;
        const hotStockText = hotStock.querySelector('.hotStock-text');
        const progressBar = hotStock.querySelector('.hotStock-progress-item');

        if (maxStock > 0 && inventoryQuantity > 0 && inventoryQuantity <= maxStock) {
          if (hotStockText) {
            const textStock = String(window.inventory_text?.hotStock || '').replace('[inventory]', inventoryQuantity);
            hotStockText.innerHTML = textStock;
          }
          hotStock.classList.remove('hidden');
        } else {
          hotStock.classList.add('hidden');
        }

        if (progressBar && maxStock > 0) {
          const percent = Math.max(0, Math.min(100, (inventoryQuantity / maxStock) * 100));
          progressBar.style.width = `${percent}%`;
        }
      }

      handleBackInStockAlert(data) {
        const productForm = data?.productForm;
        if (!productForm) return;

        const backInStockAlert = document.querySelector('.back-in-stock-alert');
        const backInStockSelect = document.querySelector('.back-instock-select');
        const backInStockVariant = document.querySelector('[data-back-instock-variant]');

        const updateAlert = () => {
          if (!backInStockAlert) return;

          const quantityInput = productForm.querySelector('.quantity__input');
          if (!quantityInput) return;

          const qtyAttr = quantityInput.getAttribute('data-inventory-quantity');
          const policy = quantityInput.getAttribute('data-inventory-policy') || 'deny';
          const qty = qtyAttr !== null ? Number(qtyAttr) : null;

          if (policy === 'continue' || (qty !== null && qty > 0)) {
            backInStockAlert.classList.add('hidden');
          } else if (qty !== null) {
            backInStockAlert.classList.remove('hidden');
          }
        };

        updateAlert();
        setTimeout(updateAlert, 100);

        if (backInStockSelect) {
          const currentVariantId = productForm.querySelector('input[name="id"]')?.value;
          if (currentVariantId) {
            const options = backInStockSelect.querySelectorAll('option');
            options.forEach((option) => {
              const isSelected = option.value === currentVariantId;
              option.selected = isSelected;
              if (isSelected && backInStockVariant) {
                backInStockVariant.innerHTML = option.innerHTML;
              }
            });
          }
        }
      }

      updateAddButtonText(data) {
        const productForms = document.querySelectorAll(
          `#product-form-${this.dataset.section}`
        );

        const variantId = data.productForm?.variantIdInput?.value;
        const productId = data.dataset.productId;

        const inventoryMapKey = `product_inventory_array_${productId}`;
        const inventoryPolicyMapKey = `product_inventory_policy_array_${productId}`;
        const inventoryMap = window[inventoryMapKey] || {};
        const inventoryQuantity = variantId ? Number(inventoryMap[variantId]) || 0 : 0;
        const inventoryPolicy = variantId ? window[inventoryPolicyMapKey][variantId] : 'deny';

        productForms.forEach((productForm, index) => {
          if (!productForm) return;

          const quantityInput = productForm.querySelector('.quantity__input');
          if (!quantityInput) return;

          quantityInput.setAttribute('data-inventory-quantity', inventoryQuantity);
          quantityInput.setAttribute('data-inventory-policy', inventoryPolicy);

          if (this.stickyQuantityInput) {
            this.stickyQuantityInput.setAttribute('data-inventory-quantity', inventoryQuantity);
            this.stickyQuantityInput.setAttribute('data-inventory-policy', inventoryPolicy);
          }

          const addButton = productForm.querySelector('[name="add"]');
          const addButtonText = productForm.querySelector('[name="add"] > .add-to-cart-text');
          const maxInventory = parseInt(quantityInput.getAttribute('data-inventory-quantity'));

          if (!addButton || !addButtonText) return;

          if (addButton?.hasAttribute('disabled')) return;

          if (maxInventory <= 0 && inventoryPolicy === 'continue') {
            addButtonText.innerHTML = window.variantStrings.preOrder;
          } else {
            addButtonText.innerHTML = window.variantStrings.addToCart;
          }
        });
      }

      get productForm() {
        return this.querySelector(`product-form-component`);
      }

      get productModal() {
        return document.querySelector(`#ProductModal-${this.dataset.section}`);
      }

      get pickupAvailability() {
        return this.querySelector(`pickup-availability`);
      }

      get variantSelectors() {
        return this.querySelector('variant-selects[data-context^="main"]');
      }

      get relatedProducts() {
        const relatedProductsSectionId = SectionId.getIdForSection(
          SectionId.parseId(this.sectionId),
          'related-products'
        );
        return document.querySelector(`product-recommendations[data-section-id^="${relatedProductsSectionId}"]`);
      }

      get quickOrderList() {
        const quickOrderListSectionId = SectionId.getIdForSection(
          SectionId.parseId(this.sectionId),
          'quick_order_list'
        );
        return document.querySelector(`quick-order-list[data-id^="${quickOrderListSectionId}"]`);
      }

      get sectionId() {
        return this.dataset.originalSection || this.dataset.section;
      }
    }
  );
}

if (!customElements.get('product-info-list')) {
  class ProductInfoList extends HTMLElement {
    connectedCallback() {
      try {
        if (typeof MainEvents !== 'undefined' && MainEvents.variantUpdate) {
          document.addEventListener(MainEvents.variantUpdate, this.updateInfo);
        }
      } catch (e) {
        // silent
      }
    }

    disconnectedCallback() {
      try {
        if (typeof MainEvents !== 'undefined' && MainEvents.variantUpdate) {
          document.removeEventListener(MainEvents.variantUpdate, this.updateInfo);
        }
      } catch (e) {
        // silent
      }
    }

    updateInfo = (event) => {
      try {
        if (event?.detail?.data?.newProduct) {
          this.dataset.productId = event.detail.data.newProduct.id;
        } else if (event?.target instanceof HTMLElement && event.target.dataset.productId !== this.dataset.productId) {
          return;
        }

        const source = event?.detail?.data?.html;
        if (!source) return;

        // Try to find the new info list by block-id first, then by product-id
        let newInfoList = null;
        if (this.dataset.blockId) {
          newInfoList = source.querySelector(`product-info-list[data-block-id="${this.dataset.blockId}"]`);
        }
        if (!newInfoList && this.dataset.productId) {
          newInfoList = source.querySelector(`product-info-list[data-product-id="${this.dataset.productId}"]`);
        }
        if (!newInfoList) return;

        const currentInfoList = this.querySelector('.product-info-list');
        const newInfoListContent = newInfoList.querySelector('.product-info-list');
        
        if (!currentInfoList || !newInfoListContent) return;

        // Update SKU item
        const skuItem = currentInfoList.querySelector('[data-sku]');
        if (skuItem) {
          const newSkuItem = newInfoListContent.querySelector('[data-sku]');
          if (newSkuItem) {
            const currentValue = skuItem.querySelector('.product-info-value');
            const newValue = newSkuItem.querySelector('.product-info-value');
            if (currentValue && newValue) {
              currentValue.innerHTML = newValue.innerHTML;
            }
            
            // Update visibility based on whether the value exists
            const hasValue = newValue?.textContent?.trim() !== '';
            if (hasValue) {
              skuItem.style.display = '';
            } else {
              skuItem.style.display = 'none';
            }
          }
        }

        // Update barcode item
        const barcodeItem = currentInfoList.querySelector('[data-barcode]');
        if (barcodeItem) {
          const newBarcodeItem = newInfoListContent.querySelector('[data-barcode]');
          if (newBarcodeItem) {
            const currentValue = barcodeItem.querySelector('.product-info-value');
            const newValue = newBarcodeItem.querySelector('.product-info-value');
            if (currentValue && newValue) {
              currentValue.innerHTML = newValue.innerHTML;
            }
            
            // Update visibility based on whether the value exists
            const hasValue = newValue?.textContent?.trim() !== '';
            if (hasValue) {
              barcodeItem.style.display = '';
            } else {
              barcodeItem.style.display = 'none';
            }
          }
        }

        // Update inventory/availability item
        const inventoryItem = currentInfoList.querySelector('[data-inventory]');
        if (inventoryItem) {
          const newInventoryItem = newInfoListContent.querySelector('[data-inventory]');
          if (newInventoryItem) {
            const currentValue = inventoryItem.querySelector('.product-info-value');
            const newValue = newInventoryItem.querySelector('.product-info-value');
            if (currentValue && newValue) {
              currentValue.innerHTML = newValue.innerHTML;
            }
            
            // Update stock level display attribute if needed
            const stockLevel = newInventoryItem.dataset.stockLevel;
            if (stockLevel) {
              inventoryItem.dataset.stockLevel = stockLevel;
            }
          }
        }

        // Update all other items (vendor, product type) that don't have special data attributes
        const otherItems = currentInfoList.querySelectorAll('.product-info-item:not([data-sku]):not([data-barcode]):not([data-inventory])');
        otherItems.forEach((item) => {
          const infoName = item.querySelector('.product-info-name')?.textContent?.trim();
          if (!infoName) return;

          const newItem = Array.from(newInfoListContent.querySelectorAll('.product-info-item:not([data-sku]):not([data-barcode]):not([data-inventory])'))
            .find(newItem => newItem.querySelector('.product-info-name')?.textContent?.trim() === infoName);
          
          if (newItem) {
            const currentValue = item.querySelector('.product-info-value');
            const newValue = newItem.querySelector('.product-info-value');
            if (currentValue && newValue && currentValue.innerHTML !== newValue.innerHTML) {
              currentValue.innerHTML = newValue.innerHTML;
            }
          }
        });
      } catch (e) {
        // silent
      }
    };
  }

  customElements.define('product-info-list', ProductInfoList);
}

if (!customElements.get('product-price')) {
  class ProductPrice extends HTMLElement {
    connectedCallback() {
      try {
        if (typeof MainEvents !== 'undefined' && MainEvents.variantUpdate) {
          document.addEventListener(MainEvents.variantUpdate, this.updatePrice);
        }
      } catch (e) {
        // silent
      }
    }

    disconnectedCallback() {
      try {
        if (typeof MainEvents !== 'undefined' && MainEvents.variantUpdate) {
          document.removeEventListener(MainEvents.variantUpdate, this.updatePrice);
        }
      } catch (e) {
        // silent
      }
    }

    updatePrice = (event) => {
      try {
        if (event?.detail?.data?.newProduct) {
          this.dataset.productId = event.detail.data.newProduct.id;
        } else if (event?.target instanceof HTMLElement && event.target.dataset.productId !== this.dataset.productId) {
          return;
        }

        const source = event?.detail?.data?.html;
        if (!source) return;

        const newPrice = source.querySelector('.price-product-container');
        const currentPrice = this.querySelector('.price-product-container');

        if (!newPrice || !currentPrice) return;

        if (currentPrice.innerHTML !== newPrice.innerHTML) {
          currentPrice.replaceWith(newPrice);
        }
      } catch (e) {
        // silent
      }
    };
  }

  customElements.define('product-price', ProductPrice);
}

if (!customElements.get("variant-selects")){
  class VariantSelects extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      this.addEventListener("change", (event) => {
        const target = this.getInputForEventTarget(event.target);
        if (target.classList.contains('not-change')) return;
        this.updateSelectionMetadata(event);

        publish(PUB_SUB_EVENTS.optionValueSelectionChange, {
          data: {
            event,
            target,
            selectedOptionValues: this.selectedOptionValues,
          },
        });
      });
    }

    updateSelectionMetadata({ target }) {
      const { value, tagName } = target;

      if (tagName === "SELECT" && target.selectedOptions.length) {
        Array.from(target.options)
          .find((option) => option.getAttribute("selected"))
          .removeAttribute("selected");
        target.selectedOptions[0].setAttribute("selected", "selected");

        const swatchValue = target.selectedOptions[0].dataset.optionSwatchValue;
        const selectedDropdownSwatchValue = target
          .closest(".product-form__input")
          .querySelector("[data-selected-value] > .swatch");
        if (!selectedDropdownSwatchValue) return;
        if (swatchValue) {
          selectedDropdownSwatchValue.style.setProperty(
            "--swatch--background",
            swatchValue
          );
          selectedDropdownSwatchValue.classList.remove("swatch--unavailable");
        } else {
          selectedDropdownSwatchValue.style.setProperty(
            "--swatch--background",
            "unset"
          );
          selectedDropdownSwatchValue.classList.add("swatch--unavailable");
        }

        selectedDropdownSwatchValue.style.setProperty(
          "--swatch-focal-point",
          target.selectedOptions[0].dataset.optionSwatchFocalPoint || "unset"
        );
      } else if (tagName === "INPUT" && target.type === "radio") {
        const selectedSwatchValue = target
          .closest(`.product-form__input`)
          .querySelector("[data-selected-value]");
        if (selectedSwatchValue) selectedSwatchValue.innerHTML = value;
      }
    }

    getInputForEventTarget(target) {
      return target.tagName === "SELECT" ? target.selectedOptions[0] : target;
    }

    get selectedOptionValues() {
      return Array.from(
        this.querySelectorAll("select option[selected], fieldset input:checked")
      ).map(({ dataset }) => dataset.optionValueId);
    }
  }

  customElements.define("variant-selects", VariantSelects);
}

class VariantMediaGrouped extends HTMLDivElement {
  constructor() {
    super();
    this._onInputChange = this._onInputChange?.bind(this) || this._onInputChange.bind(this);
    this._onVariantChange = this._onVariantChange?.bind(this) || this._onVariantChange.bind(this);
    this._activeInput = null;
    this._variantChangeUnsubscriber = null;
  }

  get isMobileViewport() {
    try {
      return window.matchMedia('(max-width: 749px)').matches;
    } catch (e) {
      return window.innerWidth <= 749;
    }
  }

  connectedCallback() {
    this._input =
      this.querySelector('input[type="radio"]') ||
      this.querySelector('select') ||
      null;

    if (!this._input) return;

    this._input.addEventListener('change', this._onInputChange);

    if (typeof subscribe !== 'undefined' && typeof PUB_SUB_EVENTS !== 'undefined') {
      this._variantChangeUnsubscriber = subscribe(
        PUB_SUB_EVENTS.variantChange,
        this._onVariantChange
      );
    }

    if ((this._input.type === 'radio' && this._input.checked) || this._input.tagName === 'SELECT') {
      this._activeInput = this._input;
      try {
        if (!this.isMobileViewport && this._getGallery()?.querySelector('.media-gallery__grid')) {
          this._applyFilterFromInputGrid(this._input);
        } else {
          this._applyFilterFromInput(this._input);
        }
      } catch (e) {
        // silent
      }
    }
  }

  disconnectedCallback() {
    if (this._input) {
      this._input.removeEventListener('change', this._onInputChange);
    }
    if (this._variantChangeUnsubscriber) {
      this._variantChangeUnsubscriber();
    }
  }

  _onVariantChange() {
    if (!this._activeInput || this.isMobileViewport) return;
    
    const targetClasses = this._getTargetClassesFromInput(this._activeInput);
    if (!targetClasses.length) return;
    
    const gallery = this._getGallery();
    if (!this.isMobileViewport && gallery?.querySelector('.media-gallery__grid')) {
      this._applyFilterFromInputGrid(this._activeInput);
    }
  }

  _onInputChange(event) {
    const target = event.target;

    if (target.type === 'radio' && !target.checked) return;
    
    this._activeInput = target;
  }

  _getGallery() {
    const productInfo = this.closest('product-info');
    const sectionId = productInfo?.dataset.section;

    let gallery = null;
    if (sectionId) {
      gallery = document.querySelector(`media-gallery[data-section-id="${sectionId}"]`);
    }

    if (!gallery) {
      gallery = document.querySelector('media-gallery');
    }

    return gallery;
  }

  _getGalleryGrid() {
    const productInfo = this.closest('product-info');
    const sectionId = productInfo?.dataset.section;

    let gallery = null;
    if (sectionId) {
      gallery = document.querySelector(`media-gallery[data-section-id="${sectionId}"] .media-gallery__grid`);
    }

    if (!gallery) {
      gallery = document.querySelector('media-gallery .media-gallery__grid');
    }

    return gallery;
  }

  _getTargetClassesFromInput(inputEl) {
    const variantGroupMeta = inputEl.dataset.variantImageGrouped || '';
    const dataFilter = inputEl.dataset.filter || '';

    const targetClasses = [];

    const metaTrimmed = variantGroupMeta.trim();
    if (metaTrimmed) {
      const keys = metaTrimmed
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      keys.forEach((key) => {
        targetClasses.push(`filter-${key.toLowerCase().replace(/[^A-Z0-9]/gi, '-')}`);
      });
    } else {
      const dfTrimmed = dataFilter.trim();
      if (dfTrimmed) {
        const cls = dfTrimmed.replace(/^\./, '').trim();
        if (cls) targetClasses.push(cls);
      }
    }

    return targetClasses;
  }

  _getFilterNodes(gallery) {
    const selector =
      '.swiper-slide[class*="filter-"], .swiper-controls__thumbnail[class*="filter-"], .media-gallery__grid-item[class*="filter-"]';
    const nodes = Array.from(gallery.querySelectorAll(selector));
    return { selector, nodes };
  }

  _applyFilterFromInput(inputEl) {
    if (!inputEl) return;

    const gallery = this._getGallery();
    if (!gallery) return;
    const zoomDialog = this._getZoomDialog();
    const videoDialog = this._getVideoDialog();

    const targetClasses = this._getTargetClassesFromInput(inputEl);

    if (!targetClasses.length) {
      this._resetFilters();
      this._resetZoomDialogFilters(zoomDialog);
      this._resetVideoDialogFilters(videoDialog);
      return;
    }

    const rebuilt = this._rebuildGalleryWithFilters(gallery, targetClasses);
    if (rebuilt) {
      this._applyZoomDialogFilters(zoomDialog, targetClasses);
      this._applyVideoDialogFilters(videoDialog, targetClasses);
    }

    const { nodes } = this._getFilterNodes(gallery);
    if (!nodes.length) return;

    const hasAnyMatch = nodes.some((node) =>
      targetClasses.some((cls) => node.classList.contains(cls))
    );
    if (!hasAnyMatch) {
      this._resetFilters();
      this._resetZoomDialogFilters(zoomDialog);
      this._resetVideoDialogFilters(videoDialog);
      return;
    }
  }

  _applyFilterFromInputGrid(inputEl) {
    if (!inputEl) return;

    let firstVisibleMediaId = null;

    const galleryGrid = this._getGalleryGrid();
    if (!galleryGrid) return;
    const zoomDialog = this._getZoomDialog();
    const videoDialog = this._getVideoDialog();

    const targetClasses = this._getTargetClassesFromInput(inputEl);
    this._applyZoomDialogFilters(zoomDialog, targetClasses);
    this._applyVideoDialogFilters(videoDialog, targetClasses);

    if (!targetClasses.length) {
      this._resetFilters();
      this._resetZoomDialogFilters(zoomDialog);
      this._resetVideoDialogFilters(videoDialog);
      return;
    }

    const nodes = galleryGrid.querySelectorAll('.media-gallery__grid-item');
    if (!nodes.length) return;

    let hasVisibleNode = false;
    nodes.forEach((node) => {
      const shouldShow = targetClasses.some((cls) => node.classList.contains(cls));
      node.classList.toggle('hidden', !shouldShow);
      if (shouldShow) {
        hasVisibleNode = true;
        if (!firstVisibleMediaId) {
          firstVisibleMediaId = node.dataset.mediaId || null;
        }
      }
    });

    if (!hasVisibleNode) {
      nodes.forEach((node) => {
        node.classList.remove('hidden');
      });

      this._resetZoomDialogFilters(zoomDialog);
      this._resetVideoDialogFilters(videoDialog);
    }

    const gallery = this._getGallery();
    if (!gallery) return;

    if (firstVisibleMediaId && typeof gallery.setActiveMedia === 'function') {
      try {
        gallery.setActiveMedia(firstVisibleMediaId, true);
      } catch (e) {
        // silent
      }
    }
  }

  _resetFilters() {
    const gallery = this._getGallery();
    if (!gallery) return;
    const zoomDialog = this._getZoomDialog();
    const videoDialog = this._getVideoDialog();

    const restored = this._resetRebuiltGallery(gallery);
    if (restored) {
      this._resetZoomDialogFilters(zoomDialog);
      this._resetVideoDialogFilters(videoDialog);

      if (gallery.querySelector('.media-gallery__grid')) {
        const { nodes } = this._getFilterNodes(gallery);
        nodes.forEach((node) => node.classList.remove('hidden'));
      }
      return;
    }

    this._refreshSwipers(gallery);
    this._resetZoomDialogFilters(zoomDialog);
    this._resetVideoDialogFilters(videoDialog);
  }

  _getZoomDialog() {
    const productInfo = this.closest('product-info');
    if (!productInfo) return null;
    return productInfo.querySelector('zoom-dialog');
  }

  _getVideoDialogButton() {
    const productInfo = this.closest('product-info');
    if (!productInfo) return null;
    return document.querySelector('.video-dialog');
  }

  _getVideoDialog() {
    const productInfo = this.closest('product-info');
    if (!productInfo) return null;
    const sectionId = productInfo.dataset.section;
    if (!sectionId) return null;
    return document.querySelector(`#VideoModal-${sectionId}`);
  }

  _applyZoomDialogFilters(zoomDialog, targetClasses) {
    if (!zoomDialog) return;

    try {
      const mediaItems = Array.from(
        zoomDialog.querySelectorAll('.dialog-zoomed-gallery .product-media-container')
      );
      const thumbnailButtons = Array.from(
        zoomDialog.querySelectorAll('.dialog-thumbnails-list__thumbnail')
      );

      if (!mediaItems.length && !thumbnailButtons.length) return;

      let firstVisibleIndex = null;

      mediaItems.forEach((item, index) => {
        const shouldShow =
          !targetClasses.length ||
          targetClasses.some((cls) => item.classList.contains(cls));

        item.classList.toggle('hidden', !shouldShow);
        if (shouldShow && firstVisibleIndex === null) {
          firstVisibleIndex = index;
        }
      });

      thumbnailButtons.forEach((button) => {
        const shouldShow =
          !targetClasses.length ||
          targetClasses.some((cls) => button.classList.contains(cls));

        button.classList.toggle('hidden', !shouldShow);
        button.setAttribute('tabindex', shouldShow ? '0' : '-1');
      });

      if (
        firstVisibleIndex !== null &&
        typeof zoomDialog.selectThumbnail === 'function'
      ) {
        zoomDialog.selectThumbnail(firstVisibleIndex, { behavior: 'auto' });
      }
    } catch (e) {
      // silent 
    }
  }

  _resetZoomDialogFilters(zoomDialog) {
    if (!zoomDialog) return;

    try {
      const mediaItems = Array.from(
        zoomDialog.querySelectorAll('.dialog-zoomed-gallery .product-media-container')
      );
      const thumbnailButtons = Array.from(
        zoomDialog.querySelectorAll('.dialog-thumbnails-list__thumbnail')
      );

      mediaItems.forEach((item) => {
        item.classList.remove('hidden');
      });

      thumbnailButtons.forEach((button, index) => {
        button.classList.remove('hidden');
        button.setAttribute('tabindex', index === 0 ? '0' : '-1');
      });

      if (typeof zoomDialog.selectThumbnail === 'function') {
        zoomDialog.selectThumbnail(0, { behavior: 'auto' });
      }
    } catch (e) {
      // silent
    }
  }

  _applyVideoDialogFilters(videoDialog, targetClasses) {
    if (!videoDialog) return;

    try {
      const videoDialogButton = this._getVideoDialogButton();
      const videoGallery = videoDialog.querySelector('.video-modal__gallery');
      if (!videoGallery) return;

      const videoSlides = Array.from(
        videoGallery.querySelectorAll('.swiper-slide[class*="filter-"]')
      );

      if (!videoDialogButton && !videoSlides.length) return;

      if (!targetClasses.length) {
        // Reset to all slides if no filter
        this._resetRebuiltVideoDialog(videoDialog);
        if (videoDialogButton) {
          videoDialogButton.classList.remove('hidden');
        }
        return;
      }

      // Rebuild with filtered slides
      const rebuilt = this._rebuildVideoDialogWithFilters(videoDialog, targetClasses);
      if (!rebuilt) {
        // No matching slides, hide button
        if (videoDialogButton) {
          videoDialogButton.classList.add('hidden');
        }
      } else {
        // Show button if we have slides
        if (videoDialogButton) {
          videoDialogButton.classList.remove('hidden');
        }
      }
    } catch (e) {
      // silent
    }
  }

  _resetVideoDialogFilters(videoDialog) {
    if (!videoDialog) return;

    try {
      const videoDialogButton = this._getVideoDialogButton();
      const videoGallery = videoDialog.querySelector('.video-modal__gallery');
      if (!videoGallery) return;

      const videoSlides = Array.from(
        videoGallery.querySelectorAll('.swiper-slide[class*="filter-"]')
      );

      if (!videoDialogButton && !videoSlides.length) return;

      // Reset to all slides
      this._resetRebuiltVideoDialog(videoDialog);
      if (videoDialogButton) {
        videoDialogButton.classList.remove('hidden');
      }
    } catch (e) {
      // silent
    }
  }

  _ensureVideoDialogSnapshot(videoDialog) {
    if (videoDialog._variantImageGroupedSnapshot) return;

    const videoGallery = videoDialog.querySelector('.video-modal__gallery');
    if (!videoGallery) return;

    const swiperComponent = videoGallery.querySelector('swiper-component');
    const wrapper = swiperComponent?.querySelector('.swiper-wrapper');

    videoDialog._variantImageGroupedSnapshot = {
      slides: wrapper ? Array.from(wrapper.children).map((n) => n.cloneNode(true)) : [],
    };
  }

  _rebuildVideoDialogWithFilters(videoDialog, targetClasses) {
    try {
      this._ensureVideoDialogSnapshot(videoDialog);
      const snapshot = videoDialog._variantImageGroupedSnapshot;
      if (!snapshot) return false;

      const videoGallery = videoDialog.querySelector('.video-modal__gallery');
      if (!videoGallery) return false;

      const swiperComponent = videoGallery.querySelector('swiper-component');
      const wrapper = swiperComponent?.querySelector('.swiper-wrapper');
      if (!wrapper) return false;

      const filteredSlides = snapshot.slides.filter((node) =>
        targetClasses.some((cls) => node.classList.contains(cls))
      );

      if (!filteredSlides.length) return false;

      this._destroyVideoDialogSwipers(videoDialog);

      wrapper.innerHTML = '';
      filteredSlides.forEach((node) => wrapper.appendChild(node.cloneNode(true)));

      swiperComponent?.initializeSwiper?.();

      setTimeout(() => {
        if (swiperComponent?.initSwiper) {
          try {
            swiperComponent.initSwiper.slideTo(0, 0);
          } catch (e) {
            // silent
          }
        }
      }, 10);

      return true;
    } catch (e) {
      // silent fallback
      return false;
    }
  }

  _resetRebuiltVideoDialog(videoDialog) {
    try {
      const snapshot = videoDialog._variantImageGroupedSnapshot;
      if (!snapshot) return false;

      const videoGallery = videoDialog.querySelector('.video-modal__gallery');
      if (!videoGallery) return false;

      const swiperComponent = videoGallery.querySelector('swiper-component');
      const wrapper = swiperComponent?.querySelector('.swiper-wrapper');
      if (!wrapper) return false;

      this._destroyVideoDialogSwipers(videoDialog);

      wrapper.innerHTML = '';
      snapshot.slides.forEach((node) => wrapper.appendChild(node.cloneNode(true)));

      swiperComponent?.initializeSwiper?.();

      setTimeout(() => {
        if (swiperComponent?.initSwiper) {
          try {
            swiperComponent.initSwiper.slideTo(0, 0);
          } catch (e) {
            // silent
          }
        }
      }, 10);

      return true;
    } catch (e) {
      // silent
      return false;
    }
  }

  _destroyVideoDialogSwipers(videoDialog) {
    try {
      const videoGallery = videoDialog.querySelector('.video-modal__gallery');
      if (!videoGallery) return;

      const swiperComponent = videoGallery.querySelector('swiper-component');
      if (!swiperComponent) return;

      const mainSwiper = swiperComponent.initSwiper;
      if (mainSwiper && typeof mainSwiper.destroy === 'function') {
        mainSwiper.destroy(true, true);
        swiperComponent.initSwiper = null;
      }

      if (swiperComponent.swiperEl) {
        swiperComponent.swiperEl._swiperInitialized = false;
      }
    } catch (e) {
      // silent
    }
  }

  _refreshSwipers(gallery) {
    try {
      const swiperComponent = gallery.querySelector('swiper-component');
      const mainSwiper = swiperComponent?.initializeSwiper || gallery.querySelector('.swiper')?.swiper;

      if (mainSwiper && typeof mainSwiper.update === 'function') {
        mainSwiper.updateSlides?.();
        mainSwiper.update();
      }

      const thumbsContainer = gallery.querySelector('.swiper-controls__thumbnails-container .swiper');
      const thumbsSwiper = thumbsContainer?.swiper;
      if (thumbsSwiper && typeof thumbsSwiper.update === 'function') {
        thumbsSwiper.updateSlides?.();
        thumbsSwiper.update();
      }
    } catch (e) {
      // silent
    }
  }

  _ensureGallerySnapshot(gallery) {
    if (gallery._variantImageGroupedSnapshot) return;

    const swiperComponent = gallery.querySelector('swiper-component');
    const mainWrapper = swiperComponent?.querySelector('.swiper-wrapper');
    const thumbsWrapper = gallery.querySelector('.swiper-controls__thumbnails-container .swiper-wrapper');

    gallery._variantImageGroupedSnapshot = {
      slides: mainWrapper ? Array.from(mainWrapper.children).map((n) => n.cloneNode(true)) : [],
      thumbs: thumbsWrapper ? Array.from(thumbsWrapper.children).map((n) => n.cloneNode(true)) : [],
    };
  }

  _rebuildGalleryWithFilters(gallery, targetClasses) {
    try {
      this._ensureGallerySnapshot(gallery);
      const snapshot = gallery._variantImageGroupedSnapshot;
      const swiperComponent = gallery.querySelector('swiper-component');
      const mainWrapper = swiperComponent?.querySelector('.swiper-wrapper');
      const thumbsWrapper = gallery.querySelector('.swiper-controls__thumbnails-container .swiper-wrapper');

      if (!mainWrapper) return false;

      const filteredSlides = snapshot.slides.filter((node) =>
        targetClasses.some((cls) => node.classList.contains(cls))
      );
      const filteredThumbs = thumbsWrapper
        ? snapshot.thumbs.filter((node) => targetClasses.some((cls) => node.classList.contains(cls)))
        : [];

      if (!filteredSlides.length) return false;

      this._destroySwipers(gallery);

      mainWrapper.innerHTML = '';
      filteredSlides.forEach((node) => mainWrapper.appendChild(node.cloneNode(true)));

      if (thumbsWrapper) {
        thumbsWrapper.innerHTML = '';
        filteredThumbs.forEach((node) => thumbsWrapper.appendChild(node.cloneNode(true)));
      }

      swiperComponent?.initializeSwiper?.();

      const firstSlide = mainWrapper.querySelector('[data-media-id]');
      if (firstSlide && typeof gallery.setActiveMedia === 'function') {
        gallery.setActiveMedia(firstSlide.dataset.mediaId, true);
      }

      return true;
    } catch (e) {
      // silent fallback
      return false;
    }
  }

  _resetRebuiltGallery(gallery) {
    try {
      const snapshot = gallery._variantImageGroupedSnapshot;
      if (!snapshot) return false;

      const swiperComponent = gallery.querySelector('swiper-component');
      const mainWrapper = swiperComponent?.querySelector('.swiper-wrapper');
      const thumbsWrapper = gallery.querySelector('.swiper-controls__thumbnails-container .swiper-wrapper');
      if (!mainWrapper) return false;

      this._destroySwipers(gallery);

      mainWrapper.innerHTML = '';
      snapshot.slides.forEach((node) => mainWrapper.appendChild(node.cloneNode(true)));

      if (thumbsWrapper) {
        thumbsWrapper.innerHTML = '';
        snapshot.thumbs.forEach((node) => thumbsWrapper.appendChild(node.cloneNode(true)));
      }

      swiperComponent?.initializeSwiper?.();
      const firstSlide = mainWrapper.querySelector('[data-media-id]');
      if (firstSlide && typeof gallery.setActiveMedia === 'function') {
        gallery.setActiveMedia(firstSlide.dataset.mediaId, true);
      }

      return true;
    } catch (e) {
      // silent
      return false;
    }
  }

  _destroySwipers(gallery) {
    try {
      const swiperComponent = gallery.querySelector('swiper-component');
      if (!swiperComponent) return;

      const mainSwiper = swiperComponent.initSwiper || gallery.querySelector('.swiper')?.swiper;
      if (mainSwiper && typeof mainSwiper.destroy === 'function') {
        mainSwiper.destroy(true, true);
        swiperComponent.initSwiper = null;
      }

      const thumbsContainer = gallery.querySelector('.swiper-controls__thumbnails-container .swiper');
      const thumbsSwiper = thumbsContainer?.swiper || swiperComponent._thumbsSwiper;
      if (thumbsSwiper && typeof thumbsSwiper.destroy === 'function') {
        thumbsSwiper.destroy(true, true);
        swiperComponent._thumbsSwiper = null;
      }

      if (swiperComponent.swiperEl) {
        swiperComponent.swiperEl._swiperInitialized = false;
      }
      if (thumbsContainer) {
        thumbsContainer._swiperInitialized = false;
      }
    } catch (e) {
      // silent
    }
  }
}
customElements.define('variant-media-grouped', VariantMediaGrouped, { extends: 'div' });

if (!customElements.get('featured-product')){
  class FeaturedProduct extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      const productInfo = this.querySelector('product-info');
      if (productInfo) {
        productInfo.dataset.updateUrl = 'false';
      }

      const variantSelects = this.querySelector('variant-selects');
      if (variantSelects) {
        this.initializeVariantSwatches(variantSelects);
      }

      this.classList.add('initialized');
    }

    initializeVariantSwatches(variantSelects) {
      const selects = variantSelects.querySelectorAll('select, input[type="radio"]');

      selects.forEach((target) => {
        if (target.tagName === 'INPUT' && !target.checked) return;
        if (target.tagName === 'SELECT' && !target.selectedOptions.length) return;

        const optionEl =
          target.tagName === 'SELECT'
            ? target.selectedOptions[0]
            : target;

        if (optionEl?.dataset?.optionSwatchValue) {
          variantSelects.updateSelectionMetadata?.({ target });
        }
      });
    }
  }

  customElements.define('featured-product', FeaturedProduct);
}