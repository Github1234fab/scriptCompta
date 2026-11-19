<script>
  import InfoTip from './InfoTip.svelte';

  /**
   * @type {{
   *   label: string,
   *   value: string | number,
   *   subtext?: string,
   *   bgColor?: string,
   *   borderColor?: string,
   *   textColor?: string,
   *   subtextColor?: string,
   *   progressBarPct?: number | null,
   *   actionLabel?: string,
   *   onAction?: (() => void) | null,
   *   infoTip?: string,
   *   mobileLabel?: string
   * }}
   */
  let {
    label,
    value,
    subtext = '',
    bgColor = 'var(--bg-card, #ffffff)',
    borderColor = 'var(--border-color, #e2e8f0)',
    textColor = 'var(--text-main, #0f172a)',
    subtextColor = 'var(--text-muted, #64748b)',
    progressBarPct = null,
    actionLabel = '',
    onAction = null,
    infoTip = '',
    mobileLabel = ''
  } = $props();
</script>

<div 
  class="kpi-card" 
  style="background: {bgColor}; border: 1px solid {borderColor}; border-radius: 14px; padding: 18px 20px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between; gap: 10px; min-height: 96px; transition: transform 0.15s ease, box-shadow 0.15s ease;"
>
  <div>
    <!-- TITRE PRINCIPAL -->
    <h3 class="kpi-card-title" style="margin: 0 0 4px 0; font-size: 0.98rem; font-weight: 800; color: {textColor}; font-family: var(--font-title); letter-spacing: -0.015em; line-height: 1.25; display: flex; align-items: center;">
      {#if mobileLabel}
        <span class="label-desktop">{label}</span>
        <span class="label-mobile">{mobileLabel}</span>
      {:else}
        <span>{label}</span>
      {/if}
      {#if infoTip}
        <span class="infotip-desktop"><InfoTip text={infoTip} /></span>
      {/if}
    </h3>
    
    <!-- SOUS-TITRE / PRÉCISION MÉTIER EN SECOND -->
    {#if subtext}
      <span class="kpi-card-subtext" style="font-size: 0.76rem; font-weight: 500; color: {subtextColor}; display: inline-block; line-height: 1.35;">
        {subtext}
      </span>
    {/if}

    {#if actionLabel && onAction}
      <div style="margin-top: 4px;">
        <button 
          type="button" 
          onclick={onAction}
          class="kpi-card-action-btn"
          style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.70rem; font-weight: 700; color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 2px 7px; cursor: pointer; transition: all 0.15s ease;"
          onmouseenter={(e) => { e.currentTarget.style.background = '#dbeafe'; }}
          onmouseleave={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
        >
          {#if actionLabel.toLowerCase().includes('définir')}
            <i class="fa-solid fa-plus" style="font-size: 0.65rem;"></i>
          {:else}
            <i class="fa-solid fa-pen" style="font-size: 0.65rem;"></i>
          {/if}
          {actionLabel}
        </button>
      </div>
    {/if}
  </div>

  {#if progressBarPct !== null && progressBarPct !== undefined}
    <div>
      <div style="margin-bottom: 6px;">
        <span class="kpi-card-value" style="color: {textColor};">
          {value}
        </span>
      </div>
      <div style="width: 100%; height: 5px; background: var(--border-color, #e2e8f0); border-radius: 999px; overflow: hidden;">
        <div style="width: {Math.min(100, Math.max(0, progressBarPct))}%; height: 100%; background: var(--color-accent, #2563eb); border-radius: 999px; transition: width 0.3s ease;"></div>
      </div>
    </div>
  {:else}
    <div>
      <span class="kpi-card-value" style="color: {textColor};">
        {value}
      </span>
    </div>
  {/if}
</div>

<style>
  .label-mobile {
    display: none;
  }
  .label-desktop {
    display: inline;
  }
  .infotip-desktop {
    display: inline-flex;
  }

  .kpi-card-value {
    display: block;
    font-size: 1.18rem;
    font-weight: 700;
    font-family: var(--font-title, 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.3px;
    line-height: 1.2;
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    .label-mobile {
      display: inline !important;
    }
    .label-desktop {
      display: none !important;
    }
    .infotip-desktop {
      display: none !important;
    }
    .kpi-card {
      padding: 16px 18px !important;
      min-height: 84px !important;
      gap: 8px !important;
    }
    .kpi-card-title {
      font-size: 0.88rem !important;
      margin-bottom: 2px !important;
    }
    .kpi-card-subtext {
      font-size: 0.72rem !important;
      line-height: 1.3 !important;
    }
    .kpi-card-value {
      font-size: 1.05rem !important;
      font-weight: 800 !important;
    }
    .kpi-card-action-btn {
      font-size: 0.68rem !important;
      padding: 2px 7px !important;
      margin-top: 3px !important;
    }
  }

  @media (max-width: 480px) {
    .kpi-card {
      padding: 14px 14px !important;
    }
    .kpi-card-value {
      font-size: 0.98rem !important;
    }
  }
</style>
