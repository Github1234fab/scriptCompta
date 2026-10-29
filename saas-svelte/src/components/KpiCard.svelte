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
   *   infoTip?: string
   * }}
   */
  let {
    label,
    value,
    subtext = '',
    bgColor = 'var(--bg-card, #ffffff)',
    borderColor = 'var(--border-subtle, #e2e8f0)',
    textColor = '#0f172a',
    subtextColor = '#64748b',
    progressBarPct = null,
    actionLabel = '',
    onAction = null,
    infoTip = ''
  } = $props();
</script>

<div 
  class="kpi-card" 
  style="background: {bgColor}; border: none; border-radius: 12px; padding: 18px 20px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.06); display: flex; flex-direction: column; justify-content: space-between; gap: 14px; min-height: 110px; transition: transform 0.15s ease, box-shadow 0.15s ease;"
>
  <div>
    <!-- TITRE PRINCIPAL -->
    <h3 style="margin: 0 0 6px 0; font-size: 1.05rem; font-weight: 800; color: {textColor}; font-family: var(--font-title); letter-spacing: -0.015em; line-height: 1.25; display: flex; align-items: center;">
      <span>{label}</span>
      {#if infoTip}
        <InfoTip text={infoTip} />
      {/if}
    </h3>
    
    <!-- SOUS-TITRE / PRÉCISION MÉTIER EN SECOND -->
    {#if subtext}
      <span style="font-size: 0.78rem; font-weight: 500; color: {subtextColor}; display: inline-block; line-height: 1.4;">
        {subtext}
      </span>
    {/if}

    {#if actionLabel && onAction}
      <div style="margin-top: 6px;">
        <button 
          type="button" 
          onclick={onAction}
          style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.72rem; font-weight: 700; color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 2px 8px; cursor: pointer; transition: all 0.15s ease;"
          onmouseenter={(e) => { e.currentTarget.style.background = '#dbeafe'; }}
          onmouseleave={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
        >
          <i class="fa-solid fa-pen-to-square" style="font-size: 0.68rem;"></i>
          {actionLabel}
        </button>
      </div>
    {/if}
  </div>

  {#if progressBarPct !== null && progressBarPct !== undefined}
    <div>
      <div style="margin-bottom: 8px;">
        <span style="display: block; font-size: 1.25rem; font-weight: 800; color: {textColor}; font-family: var(--font-title); font-variant-numeric: tabular-nums; letter-spacing: -0.02em;">
          {value}
        </span>
      </div>
      <div style="width: 100%; height: 5px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
        <div style="width: {Math.min(100, Math.max(0, progressBarPct))}%; height: 100%; background: #0f172a; border-radius: 999px; transition: width 0.3s ease;"></div>
      </div>
    </div>
  {:else}
    <div>
      <span style="display: block; font-size: 1.25rem; font-weight: 800; color: {textColor}; font-family: var(--font-title); font-variant-numeric: tabular-nums; letter-spacing: -0.02em;">
        {value}
      </span>
    </div>
  {/if}
</div>
