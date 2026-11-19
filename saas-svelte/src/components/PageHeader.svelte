<script>
  /**
   * @type {{
   *   title: string,
   *   mobileTitle?: string,
   *   subtitle?: string,
   *   buttonLabel?: string,
   *   buttonIcon?: string,
   *   onButtonClick?: () => void,
   *   children?: any
   * }}
   */
  let { title, mobileTitle = '', subtitle = '', buttonLabel = '', buttonIcon = '', onButtonClick = undefined, children = undefined } = $props();
</script>

<div class="page-title-section" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-bottom: 20px; flex-wrap: wrap;">
  <div style="flex: 1; min-width: 0;">
    <h1 class="page-title" style="margin: 0; font-size: 1.4rem; font-weight: 800; color: var(--text-main) !important; -webkit-text-fill-color: var(--text-main) !important; background: none !important;">
      {#if mobileTitle}
        <span class="desktop-only-title">{title}</span>
        <span class="mobile-only-title">{mobileTitle}</span>
      {:else}
        {title}
      {/if}
    </h1>
    {#if subtitle}
      <p class="page-subtitle" style="margin: 4px 0 0 0; font-size: 0.86rem; color: var(--text-muted) !important;">{subtitle}</p>
    {/if}
  </div>

  {#if children}
    <div style="display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
      {@render children()}
    </div>
  {/if}

  {#if buttonLabel && onButtonClick}
    <button class="btn btn-primary" onclick={onButtonClick} style="background: var(--color-primary); color: white; border: none; border-radius: var(--radius-sm); padding: 8px 16px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0;">
      {#if buttonIcon}
        <i class="fa-solid {buttonIcon}"></i>
      {/if}
      {buttonLabel}
    </button>
  {/if}
</div>

<style>
  .mobile-only-title {
    display: none;
  }
  .desktop-only-title {
    display: inline;
  }
  @media (max-width: 768px) {
    /* Suppression du grand titre de screen sur mobile : Tito est affiché dans la topbar */
    .page-title-section {
      display: none !important;
    }
  }
</style>
