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
    bgColor = '#f8fafc',
    borderColor = '#e2e8f0',
    textColor = '#0f172a',
    subtextColor = '#475569',
    progressBarPct = null
  } = $props();
</script>

<div 
  class="kpi-card" 
  style="background: {bgColor}; border: 1.5px solid {borderColor}; border-radius: 16px; padding: 22px 24px; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04); display: flex; flex-direction: column; justify-content: space-between; gap: 14px; transition: transform 0.2s, box-shadow 0.2s;"
>
  <div>
    <!-- TITRE PRINCIPAL BIEN VISIBLE -->
    <h3 style="margin: 0 0 6px 0; font-size: 1.05rem; font-weight: 800; color: {textColor}; font-family: var(--font-title); letter-spacing: -0.01em;">
      {label}
    </h3>
    
    <!-- SOUS-TITRE / PRÉCISION MÉTIER EN SECOND -->
    {#if subtext}
      <span style="font-size: 0.82rem; font-weight: 600; color: {subtextColor}; display: inline-block;">
        {subtext}
      </span>
    {/if}
  </div>

  {#if progressBarPct !== null && progressBarPct !== undefined}
    <div>
      <div style="font-size: 1.7rem; font-weight: 800; color: {textColor}; font-variant-numeric: tabular-nums; font-family: var(--font-title); margin-bottom: 8px;">
        {value}
      </div>
      <div style="width: 100%; height: 8px; background: rgba(0,0,0,0.06); border-radius: 4px; overflow: hidden;">
        <div style="width: {progressBarPct}%; height: 100%; background: {progressBarPct > 80 ? '#f59e0b' : subtextColor}; transition: width 0.3s ease;"></div>
      </div>
    </div>
  {:else}
    <!-- VALEUR CHIFFRÉE EN GROS -->
    <div style="font-size: 1.9rem; font-weight: 800; color: {textColor}; font-variant-numeric: tabular-nums; font-family: var(--font-title); margin-top: 2px;">
      {value}
    </div>
  {/if}
</div>
