<script>
  /**
   * @type {{
   *   label: string,
   *   value: string | number,
   *   subtext?: string,
   *   bgColor?: string,
   *   borderColor?: string,
   *   textColor?: string,
   *   subtextColor?: string,
   *   progressBarPct?: number | null
   * }}
   */
  let {
    label,
    value,
    subtext = '',
    bgColor = 'var(--bg-card, #ffffff)',
    borderColor = 'var(--border-container, #e2e8f0)',
    textColor = '#0f172a',
    subtextColor = '#64748b',
    progressBarPct = null
  } = $props();
</script>

<div 
  class="kpi-card" 
  style="background: {bgColor}; border: 1px solid {borderColor}; border-radius: 12px; padding: 18px 20px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); display: flex; flex-direction: column; justify-content: space-between; gap: 14px; min-height: 110px; transition: transform 0.2s, box-shadow 0.2s;"
>
  <div>
    <!-- TITRE PRINCIPAL -->
    <h3 style="margin: 0 0 6px 0; font-size: 1.15rem; font-weight: 800; color: {textColor}; font-family: var(--font-title); letter-spacing: -0.015em; line-height: 1.25;">
      {label}
    </h3>
    
    <!-- SOUS-TITRE / PRÉCISION MÉTIER EN SECOND -->
    {#if subtext}
      <span style="font-size: 0.78rem; font-weight: 500; color: {subtextColor}; display: inline-block; line-height: 1.4;">
        {subtext}
      </span>
    {/if}
  </div>

  {#if progressBarPct !== null && progressBarPct !== undefined}
    <div>
      <!-- VALEUR CHIFFRÉE DANS UNE PASTILLE DISCRÈTE -->
      <div style="margin-bottom: 8px;">
        <span style="display: inline-flex; align-items: center; background: var(--bg-subtle, #fbfaf8); border: 1px solid var(--border-subtle, #dedcd6); color: {textColor}; padding: 3px 10px; border-radius: 8px; font-size: 0.95rem; font-weight: 800; font-family: var(--font-title); font-variant-numeric: tabular-nums;">
          {value}
        </span>
      </div>
      <div style="width: 100%; height: 6px; background: var(--bg-container, #f9f8f6); border: 1px solid var(--border-container, #e8e6e1); border-radius: 999px; overflow: hidden;">
        <div style="width: {Math.min(100, Math.max(0, progressBarPct))}%; height: 100%; background: #0f172a; border-radius: 999px; transition: width 0.3s ease;"></div>
      </div>
    </div>
  {:else}
    <!-- VALEUR CHIFFRÉE DANS UNE PASTILLE DISCRÈTE -->
    <div>
      <span style="display: inline-flex; align-items: center; background: var(--bg-subtle, #fbfaf8); border: 1px solid var(--border-subtle, #dedcd6); color: {textColor}; padding: 3px 10px; border-radius: 8px; font-size: 0.95rem; font-weight: 800; font-family: var(--font-title); font-variant-numeric: tabular-nums;">
        {value}
      </span>
    </div>
  {/if}
</div>
