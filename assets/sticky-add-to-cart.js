if (!customElements.get('sticky-atc')) {
  class StickyATC extends HTMLElement {
    constructor() {
      super();

      this.form = null;
      this.mainProductInfo = null;
      this.mainVariantSelects = null;
      this.stickyVariantSelects = null;
      this.isSyncing = false;
      this.cartErrorUnsubscriber = null;
      this._handleWindowScroll = this.handleWindowScroll.bind(this);
      
      this.init();
    }

    init() {
      this.findMainForm();
      
      if (this.form) {
        const observer = new IntersectionObserver(this.onScroll.bind(this));
        observer.observe(this.form);
        window.addEventListener('scroll', this._handleWindowScroll, { passive: true });
      } else {
        console.warn('Sticky ATC: Could not find product form');
      }
      
      setTimeout(() => {
        this.initializeVariantSync();
      }, 100);
    }

    disconnectedCallback() {
      if (this.cartErrorUnsubscriber) {
        this.cartErrorUnsubscriber();
      }
      if (this._handleWindowScroll) {
        window.removeEventListener('scroll', this._handleWindowScroll);
      }
    }

    findMainForm() {
        const productInfo = document.querySelector('product-info');
        if (productInfo) {
          this.form = productInfo.querySelector('product-form-component form[data-type="add-to-cart-form"]');
        }
        
      if (!this.form && this.getAttribute('form')) {
        this.form = document.getElementById(this.getAttribute('form'));
        }

        if (!this.form) {
          this.form = document.querySelector('form[data-type="add-to-cart-form"]');
      }
    }

    initializeVariantSync() {
      const sectionId = this.getAttribute('data-sticky-section-id');
      this.mainProductInfo = document.querySelector(
        sectionId
          ? `product-info[data-section="${sectionId}"], product-info[data-original-section="${sectionId}"]`
          : 'product-info'
      ) || document.querySelector('product-info');

      this.stickyVariantSelects = this.querySelector('variant-selects');
      
      if (this.mainProductInfo) {
        this.mainVariantSelects = this.mainProductInfo.querySelector('variant-selects');
      }
      
      if (this.stickyVariantSelects && this.mainVariantSelects) {
        this.setupVariantSync();
        this.setupToggleButton();
        this.syncInitialState();
        this.updateStickyAvailabilityFromMain();
        this.observeMainAvailabilityChanges();
      }
    }

    setupVariantSync() {
      this.mainVariantSelects.addEventListener('change', (event) => {
        if (this.isSyncing) return;
        this.syncMainToSticky(event);
        this.updateStickyAvailabilityFromMain();
      });
      
      this.stickyVariantSelects.addEventListener('change', (event) => {
        if (this.isSyncing) return;

        const t = this.getInputFromEventTarget(event.target);
        if (t && t.type === 'radio') {
          const wrapper = t.closest('.product-form__input') || this.stickyVariantSelects;
          wrapper
            .querySelectorAll('input[type="radio"]')
            .forEach((el) => {
              el.classList.remove('checked');
              if (el.nextElementSibling && el.nextElementSibling.tagName === 'LABEL') {
                el.nextElementSibling.classList.remove('checked');
              }
            });
          t.classList.add('checked');
          if (t.nextElementSibling && t.nextElementSibling.tagName === 'LABEL') {
            t.nextElementSibling.classList.add('checked');
          }
        }

        this.syncStickyToMain(event);
      });

      this.stickyVariantSelects.addEventListener('click', (event) => {
        if (this.isSyncing) return;
        const input = this.getInputFromEventTarget(event.target);
        if (!input) return;

        if (input.type === 'radio') {
          const wrapper = input.closest('.product-form__input') || this.stickyVariantSelects;
          wrapper
            .querySelectorAll('input[type="radio"]')
            .forEach((el) => {
              el.classList.remove('checked');
              if (el.nextElementSibling && el.nextElementSibling.tagName === 'LABEL') {
                el.nextElementSibling.classList.remove('checked');
              }
            });
          input.classList.add('checked');
          if (input.nextElementSibling && input.nextElementSibling.tagName === 'LABEL') {
            input.nextElementSibling.classList.add('checked');
          }
        }

        requestAnimationFrame(() => {
          this.syncStickyToMain({ target: input });
        });
      });
    }

    setupToggleButton() {
      const buttonToggleVariants = this.querySelector('.button-toggle-variants');
      const overlay = this.querySelector('overlay-component');
      if (!buttonToggleVariants) return;

      const closePanel = () => {
        this.classList.remove('is-active');
        document.removeEventListener('click', handleClickOutside, true);
        if (overlay) overlay.removeEventListener('click', closePanel);
      };

      const handleClickOutside = (evt) => {
        if (!this.contains(evt.target) && evt.target !== overlay) {
          closePanel();
        }
      };

      buttonToggleVariants.addEventListener('click', (event) => {
        event.preventDefault();

        const isOpen = this.classList.contains('is-active');

        if (isOpen) {
          closePanel();
        } else {
          this.classList.add('is-active');
          document.addEventListener('click', handleClickOutside, true);
          if (overlay) overlay.addEventListener('click', closePanel);
        }
      });
    }

    syncInitialState() {
      this.ensureMainVariantInitialization();
      
      const mainSelectedOptions = this.mainVariantSelects.querySelectorAll('select option[selected], fieldset input:checked');
      
      mainSelectedOptions.forEach((mainOption) => {
        const optionValueId = mainOption.dataset.optionValueId;
        if (!optionValueId) return;
        
        const stickyOption = this.stickyVariantSelects.querySelector(`[data-option-value-id="${optionValueId}"]`);
        if (!stickyOption) return;
        
        if (stickyOption.tagName === 'INPUT' && stickyOption.type === 'radio') {
          if (!stickyOption.checked) {
            stickyOption.checked = true;
            stickyOption.classList.add('checked');
          }
        } else if (stickyOption.tagName === 'OPTION') {
          const select = stickyOption.closest('select');
          if (select && select.value !== stickyOption.value) {
            Array.from(select.options).forEach(opt => opt.removeAttribute('selected'));
            stickyOption.setAttribute('selected', 'selected');
            select.value = stickyOption.value;
          }
        }
      });
    }

    ensureMainVariantInitialization() {
      const mainSelectedOptions = this.mainVariantSelects.querySelectorAll('select option[selected], fieldset input:checked');
      
      if (mainSelectedOptions.length === 0) {
        const variantGroups = this.mainVariantSelects.querySelectorAll('fieldset, .product-form__input');
        
        variantGroups.forEach(group => {
          const firstAvailableInput = group.querySelector('input[type="radio"]:not(.disabled)');
          const firstAvailableOption = group.querySelector('option:not([disabled])');
          
          if (firstAvailableInput && !firstAvailableInput.checked) {
            firstAvailableInput.checked = true;
            firstAvailableInput.classList.add('checked');
            
            const selectedValueSpan = group.querySelector('[data-selected-value]');
            if (selectedValueSpan) {
              selectedValueSpan.innerHTML = firstAvailableInput.value;
            }
            
            firstAvailableInput.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (firstAvailableOption && !firstAvailableOption.selected) {
            const select = firstAvailableOption.closest('select');
            if (select) {
              Array.from(select.options).forEach(opt => opt.removeAttribute('selected'));
              firstAvailableOption.setAttribute('selected', 'selected');
              select.value = firstAvailableOption.value;
              
              const selectedValueSpan = group.querySelector('[data-selected-value]');
              if (selectedValueSpan) {
                selectedValueSpan.innerHTML = firstAvailableOption.value;
              }
              
              select.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        });
      } else {
        console.log('Main variant selects already have selected options:', mainSelectedOptions.length);
      }
    }

    syncMainToSticky(event) {
      this.isSyncing = true;
      
      try {
        this.stickyVariantSelects = this.querySelector('variant-selects') || this.stickyVariantSelects;

        const target = event.target;
        const optionValueId = this.getOptionValueId(target);
        if (!optionValueId || !this.stickyVariantSelects) return;
        
        const stickyOption = this.stickyVariantSelects.querySelector(`[data-option-value-id="${optionValueId}"]`);
        if (!stickyOption) return;
        
        if (stickyOption.tagName === 'INPUT' && stickyOption.type === 'radio') {
          if (!stickyOption.checked) {
            const wrapper = stickyOption.closest('.product-form__input') || this.stickyVariantSelects;
            wrapper
              .querySelectorAll('input[type="radio"]')
              .forEach((el) => {
                el.checked = false;
                if (el.nextElementSibling && el.nextElementSibling.tagName === 'LABEL') {
                  el.nextElementSibling.classList.remove('checked');
                }
              });
            stickyOption.checked = true;
            if (stickyOption.nextElementSibling && stickyOption.nextElementSibling.tagName === 'LABEL') {
              stickyOption.nextElementSibling.classList.add('checked');
            }
          }
        } else if (stickyOption.tagName === 'OPTION') {
          const select = stickyOption.closest('select');
          if (select && select.value !== stickyOption.value) {
            Array.from(select.options).forEach(opt => opt.removeAttribute('selected'));
            stickyOption.setAttribute('selected', 'selected');
            select.value = stickyOption.value;
          }
        }

        requestAnimationFrame(() => this.updateStickyAvailabilityFromMain());
      } finally {
        this.isSyncing = false;
      }
    }

    syncStickyToMain(event) {
      this.isSyncing = true;
      
      try {
        if (this.mainProductInfo) {
          this.mainVariantSelects = this.mainProductInfo.querySelector('variant-selects');
        }

        const target = this.getInputFromEventTarget(event.target) || event.target;
        const optionValueId = this.getOptionValueId(target);
        
        if (!this.mainVariantSelects) return;
        
        const mainOption = this.findMainOptionForStickyTarget(optionValueId, target);
        if (!mainOption) {
          console.warn('Sticky->Main: No main option found for', optionValueId, target?.name, target?.value);
          return;
        }
        
        if (mainOption.tagName === 'INPUT' && mainOption.type === 'radio') {
          const group = mainOption.name;
          Array.from(document.getElementsByName(group)).forEach((el) => {
            if (el instanceof HTMLInputElement && el.type === 'radio') {
              el.checked = false;
            }
          });
          mainOption.checked = true;
          requestAnimationFrame(() => {
            mainOption.dispatchEvent(new Event('input', { bubbles: true }));
            mainOption.dispatchEvent(new Event('change', { bubbles: true }));
            requestAnimationFrame(() => this.updateStickyAvailabilityFromMain());
          });
        } else if (mainOption.tagName === 'OPTION') {
          const select = mainOption.closest('select');
          if (select) {
            Array.from(select.options).forEach(opt => opt.removeAttribute('selected'));
            mainOption.setAttribute('selected', 'selected');
            select.value = mainOption.value;
            requestAnimationFrame(() => {
              select.dispatchEvent(new Event('input', { bubbles: true }));
              select.dispatchEvent(new Event('change', { bubbles: true }));
              requestAnimationFrame(() => this.updateStickyAvailabilityFromMain());
            });
          }
        }
      } finally {
        this.isSyncing = false;
      }
    }

    getOptionValueId(element) {
      const el = this.getInputFromEventTarget(element) || element;
      if (el && el.tagName === 'SELECT') {
        return el.selectedOptions[0]?.dataset.optionValueId;
      } else if (el && el.type === 'radio' && el.checked) {
        return el.dataset.optionValueId;
      }
      return null;
    }

    findMainOptionForStickyTarget(optionValueId, stickyInput) {
      if (optionValueId) {
        const byId = this.mainVariantSelects.querySelector(`[data-option-value-id="${optionValueId}"]`);
        if (byId) return byId;
      }

      if (stickyInput && stickyInput.name && stickyInput.value) {
        let candidates = Array.from(document.getElementsByName(stickyInput.name));
        if (!candidates.length) candidates = Array.from(document.getElementsByName(stickyInput.name.trim()));

        const radioMatch = candidates.find(
          (el) => el instanceof HTMLInputElement && el.type === 'radio' && el.value === stickyInput.value
        );
        if (radioMatch) return radioMatch;

        if (stickyInput.tagName === 'OPTION') {
          const selectName = stickyInput.closest('select')?.name;
          if (selectName) {
            let mainSelects = Array.from(document.getElementsByName(selectName));
            if (!mainSelects.length) mainSelects = Array.from(document.getElementsByName(selectName.trim()));
            const mainSelect = mainSelects.find((el) => el instanceof HTMLSelectElement);
            if (mainSelect) {
              const option = Array.from(mainSelect.options).find((opt) => opt.value === stickyInput.value);
              if (option) return option;
            }
          }
        }
      }

      return null;
    }

    getInputFromEventTarget(target) {
      if (target && target.tagName === 'LABEL') {
        const forId = target.getAttribute('for');
        if (forId) return document.getElementById(forId);
        if (target.previousElementSibling && target.previousElementSibling.tagName === 'INPUT') {
          return target.previousElementSibling;
        }
      }
      
      const wrapper = target.closest && target.closest('.product-form__input');
      if (wrapper) {
        const checkedRadio = wrapper.querySelector('input[type="radio"]:checked');
        if (checkedRadio) return checkedRadio;
        const selectEl = wrapper.querySelector('select');
        if (selectEl) return selectEl;
      }
      
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'OPTION')) return target;
      return null;
    }

    updateStickyAvailabilityFromMain() {
      if (!this.mainVariantSelects || !this.stickyVariantSelects) return;

      const mainOptions = this.mainVariantSelects.querySelectorAll(
        'input[type="radio"][data-option-value-id], select option[data-option-value-id]'
      );

      mainOptions.forEach((mainEl) => {
        const id = mainEl.dataset.optionValueId;
        if (!id) return;
        const stickyEl = this.stickyVariantSelects.querySelector(`[data-option-value-id="${id}"]`);
        if (!stickyEl) return;

        let mainUnavailable = false;
        if (mainEl.tagName === 'INPUT') {
          const input = mainEl;
          const label = input.nextElementSibling && input.nextElementSibling.tagName === 'LABEL' ? input.nextElementSibling : null;
          mainUnavailable = !!(
            input.disabled ||
            input.getAttribute('aria-disabled') === 'true' ||
            input.classList.contains('disabled') ||
            input.classList.contains('visually-disabled') ||
            (label && (label.classList.contains('disabled') || label.classList.contains('visually-disabled') || label.classList.contains('unavailable') || label.classList.contains('sold-out')))
          );
        } else {
          mainUnavailable = mainEl.disabled || mainEl.getAttribute('aria-disabled') === 'true';
        }

        if (stickyEl.tagName === 'INPUT') {
          stickyEl.disabled = mainUnavailable;
          if (mainUnavailable) {
            stickyEl.setAttribute('aria-disabled', 'true');
            stickyEl.classList.add('disabled', 'visually-disabled');
            const label = stickyEl.nextElementSibling;
            if (label && label.tagName === 'LABEL') {
              label.classList.add('disabled', 'visually-disabled');
            }
          } else {
            stickyEl.removeAttribute('aria-disabled');
            stickyEl.classList.remove('disabled', 'visually-disabled');
            const label = stickyEl.nextElementSibling;
            if (label && label.tagName === 'LABEL') {
              label.classList.remove('disabled', 'visually-disabled');
            }
          }
        } else if (stickyEl.tagName === 'OPTION') {
          if (mainUnavailable) {
            stickyEl.setAttribute('disabled', '');
            stickyEl.setAttribute('aria-disabled', 'true');
          } else {
            stickyEl.removeAttribute('disabled');
            stickyEl.removeAttribute('aria-disabled');
          }
        }
      });
    }

    observeMainAvailabilityChanges() {
      if (!this.mainVariantSelects) return;
      const debouncedUpdate = (() => {
        let rafId = null;
        return () => {
          if (rafId) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => this.updateStickyAvailabilityFromMain());
        };
      })();

      const observer = new MutationObserver(debouncedUpdate);
      observer.observe(this.mainVariantSelects, {
        attributes: true,
        attributeFilter: ['disabled', 'class', 'aria-disabled'],
        subtree: true,
        childList: true
      });
      this._availabilityObserver = observer;
    }

    onScroll(entries) {
      entries.forEach((entry) => {
        if (entry.target === this.form) this.passedForm = entry.boundingClientRect.bottom < 0;
      });

      this.updateStickyVisibility();
    }

    handleWindowScroll() {
      this.updateStickyVisibility();
    }

    updateStickyVisibility() {
      const scrollPosition = window.innerHeight + window.scrollY;
      const documentHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
      const bottomThreshold = 50;
      this.reachedFooter = scrollPosition >= documentHeight - bottomThreshold;

      const shouldShow = this.passedForm && !this.reachedFooter;
      document.body.classList.toggle('sticky-cart-visible', shouldShow);
      this.classList.toggle('is-visible', shouldShow);
    
      if (shouldShow) {
        document.body.style.setProperty('--sticky-atc-height', `${this.offsetHeight}px`);
      } else {
        document.body.style.setProperty('--sticky-atc-height', `0px`);
      }

      if (!shouldShow) this.classList.remove('sticky-open');
    }
  }

  customElements.define('sticky-atc', StickyATC);
}