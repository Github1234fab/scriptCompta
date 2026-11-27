<script>
  /**
   * @type {{
   *   title: string,
   *   structureName?: string,
   *   mobileTitle?: string,
   *   subtitle?: string,
   *   buttonLabel?: string,
   *   buttonIcon?: string,
   *   onButtonClick?: () => void,
   *   children?: any
   * }}
   */
  let { title, structureName = '', mobileTitle = '', subtitle = '', buttonLabel = '', buttonIcon = '', onButtonClick = undefined, children = undefined } = $props();
</script>

<div class="page-title-section page-hero-card">
  <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px;">
    {#if structureName}
      <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
        <h1 class="page-title page-structure-name">
          {structureName}
        </h1>
        <span class="page-structure-type">
          {title}
        </span>
      </div>
    {:else}
      <h1 class="page-title" style="margin: 0; font-size: 1.45rem; font-weight: 800; color: var(--text-main) !important; -webkit-text-fill-color: var(--text-main) !important; background: none !important;">
        {#if mobileTitle}
          <span class="desktop-only-title">{title}</span>
          <span class="mobile-only-title">{mobileTitle}</span>
        {:else}
          {title}
        {/if}
      </h1>
    {/if}
    {#if subtitle}
      <p class="page-subtitle" style="margin: 0; font-size: 0.84rem; color: var(--text-muted) !important; line-height: 1.4;">{subtitle}</p>
    {/if}
  </div>

  <div class="page-hero-actions">
    {#if children}
      <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
        {@render children()}
      </div>
    {/if}

    {#if buttonLabel && onButtonClick}
      <button class="btn btn-primary" onclick={onButtonClick} style="background: var(--color-primary); color: var(--color-primary-text, #ffffff); border: none; border-radius: var(--radius-sm); padding: 9px 16px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0;">
        {#if buttonIcon}
          <i class="fa-solid {buttonIcon}"></i>
        {/if}
        {buttonLabel}
      </button>
    {/if}
  </div>
</div>

<style>
  .page-hero-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
    padding: 20px 24px;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(14, 165, 233, 0.03) 55%, var(--bg-container) 100%);
    border: 1.5px solid var(--border-container);
    box-shadow: var(--shadow-sm);
  }

  :global([data-theme="dark"]) .page-hero-card {
    background: linear-gradient(135deg, rgba(37, 99, 235, 0.16) 0%, rgba(14, 165, 233, 0.06) 50%, #101f3a 100%);
    border-color: rgba(56, 189, 248, 0.28);
  }

  .page-structure-name {
    margin: 0;
    font-family: var(--font-title);
    font-size: 1.7rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.15;
    color: var(--text-main) !important;
    -webkit-text-fill-color: var(--text-main) !important;
    background: none !important;
  }

  .page-structure-type {
    display: inline-flex;
    align-items: center;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 4px 11px;
    border-radius: 9999px;
    color: var(--color-accent, #2563eb);
    background: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.32);
    letter-spacing: 0.01em;
    white-space: nowrap;
  }

  .page-hero-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

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
