<script>
  /**
   * @type {{
   *   title: string,
   *   subtitle?: string,
   *   buttonLabel?: string,
   *   buttonIcon?: string,
   *   onButtonClick?: () => void,
   *   children?: any
   * }}
   */
  let { title, subtitle = '', buttonLabel = '', buttonIcon = '', onButtonClick = undefined, children = undefined } = $props();
</script>

<div class="page-title-section" style="display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 24px; flex-wrap: wrap;">
  <div style="flex: 1; min-width: 250px;">
    <h1 class="page-title" style="margin: 0; font-size: 1.4rem; font-weight: 800; color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; background: none !important;">{title}</h1>
    {#if subtitle}
      <p class="page-subtitle" style="margin: 4px 0 0 0; font-size: 0.86rem; color: #64748b !important;">{subtitle}</p>
    {/if}
  </div>

  {#if children}
    <div style="display: flex; align-items: center; justify-content: center;">
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
