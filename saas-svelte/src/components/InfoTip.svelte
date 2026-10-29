<script>
  import { scale } from 'svelte/transition';

  /** 
   * @type {{
   *   text: string,
   *   position?: 'top' | 'bottom' | 'left' | 'right',
   *   width?: string,
   *   style?: string
   * }} 
   */
  let { text, position = 'top', width = '240px', style = '' } = $props();

  let isVisible = $state(false);
  let triggerEl = $state(/** @type {HTMLElement | null} */ (null));
  let coords = $state({
    top: 0,
    left: 0,
    actualPlacement: 'top',
    arrowOffset: 50
  });

  function calculatePosition() {
    if (!triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const w = parseInt(width, 10) || 240;

    let actualPlacement = position;
    let top = 0;
    let left = 0;
    let arrowOffset = 50;

    if (position === 'left') {
      left = rect.left - w - 8;
      top = rect.top + rect.height / 2;
      if (left < 10) {
        actualPlacement = rect.top < 85 ? 'bottom' : 'top';
      }
    } else if (position === 'right') {
      left = rect.right + 8;
      top = rect.top + rect.height / 2;
      if (left + w > window.innerWidth - 10) {
        actualPlacement = rect.top < 85 ? 'bottom' : 'top';
      }
    }

    if (actualPlacement === 'top' || actualPlacement === 'bottom') {
      left = rect.left + rect.width / 2 - w / 2;
      const padding = 12;
      if (left < padding) left = padding;
      if (left + w > window.innerWidth - padding) left = window.innerWidth - padding - w;

      const arrowX = rect.left + rect.width / 2 - left;
      arrowOffset = Math.max(12, Math.min(w - 12, arrowX));

      let isBottom = actualPlacement === 'bottom';
      if (actualPlacement === 'top' && rect.top < 85) {
        isBottom = true;
      } else if (actualPlacement === 'bottom' && rect.bottom + 100 > window.innerHeight) {
        isBottom = false;
      }
      actualPlacement = isBottom ? 'bottom' : 'top';

      if (isBottom) {
        top = rect.bottom + 8;
      } else {
        top = rect.top - 8;
      }
    }

    coords = {
      top,
      left,
      actualPlacement,
      arrowOffset
    };
  }

  function show() {
    calculatePosition();
    isVisible = true;
  }

  function hide() {
    isVisible = false;
  }

  /** @param {MouseEvent} e */
  function toggle(e) {
    e.stopPropagation();
    if (!isVisible) {
      calculatePosition();
      isVisible = true;
    } else {
      isVisible = false;
    }
  }

  $effect(() => {
    if (!isVisible) return;

    const handleScrollOrResize = () => {
      calculatePosition();
    };

    const handleClickOutside = (/** @type {MouseEvent} */ e) => {
      if (triggerEl && !triggerEl.contains(/** @type {Node} */ (e.target))) {
        isVisible = false;
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('click', handleClickOutside);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<style>
  .infotip-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
    margin-left: 6px;
    z-index: 50;
  }

  .infotip-trigger {
    width: 17px;
    height: 17px;
    min-width: 17px;
    border-radius: 50%;
    background: rgba(148, 163, 184, 0.16);
    border: 1px solid rgba(148, 163, 184, 0.4);
    color: #64748b;
    font-size: 0.65rem;
    font-weight: 800;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    line-height: 1;
    padding: 0;
    transition: all 0.15s ease;
  }

  .infotip-trigger:hover,
  .infotip-trigger:focus-visible,
  .infotip-trigger.active {
    background: #2563eb;
    border-color: #2563eb;
    color: #ffffff;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
    transform: scale(1.06);
  }

  .infotip-popover {
    position: fixed;
    background: #0f172a;
    color: #f8fafc;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 0.76rem;
    font-weight: 500;
    line-height: 1.45;
    box-shadow: 0 10px 25px -4px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.25);
    z-index: 999999;
    text-align: left;
    white-space: normal;
    pointer-events: none;
    box-sizing: border-box;
  }

  .pos-top {
    transform: translateY(-100%);
  }

  .pos-bottom {
    transform: none;
  }

  .pos-left {
    transform: translateY(-50%);
  }

  .pos-right {
    transform: translateY(-50%);
  }

  /* Flèche discrète */
  .infotip-popover::after {
    content: '';
    position: absolute;
    border: 5px solid transparent;
  }

  .pos-top::after {
    top: 100%;
    left: var(--arrow-offset, 50%);
    transform: translateX(-50%);
    border-top-color: #0f172a;
  }

  .pos-bottom::after {
    bottom: 100%;
    left: var(--arrow-offset, 50%);
    transform: translateX(-50%);
    border-bottom-color: #0f172a;
  }

  .pos-left::after {
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    border-left-color: #0f172a;
  }

  .pos-right::after {
    right: 100%;
    top: 50%;
    transform: translateY(-50%);
    border-right-color: #0f172a;
  }
</style>

<span 
  class="infotip-wrapper" 
  {style}
  onmouseenter={show}
  onmouseleave={hide}
  role="tooltip"
>
  <button
    type="button"
    bind:this={triggerEl}
    class="infotip-trigger {isVisible ? 'active' : ''}"
    onclick={toggle}
    aria-label="Aide contextuelle"
  >
    ?
  </button>

  {#if isVisible}
    <div 
      class="infotip-popover pos-{coords.actualPlacement}"
      style="top: {coords.top}px; left: {coords.left}px; width: {width}; --arrow-offset: {coords.arrowOffset}px;"
      transition:scale={{ duration: 150, start: 0.95 }}
    >
      {text}
    </div>
  {/if}
</span>
