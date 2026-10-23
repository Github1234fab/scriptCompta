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
    bgColor = '#ffffff',
    borderColor = '#e2e8f0',
    textColor = '#0f172a',
    subtextColor = '#64748b',
    progressBarPct = null
  } = $props();
</script>

<div 
  class="kpi-card" 
  style="background: {bgColor}; border: 1px solid {borderColor}; border-radius: 14px; padding: 20px 22px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04); display: flex; flex-direction: column; justify-content: space-between; gap: 14px; min-height: 120px; transition: transform 0.2s, box-shadow 0.2s;"
>
  <div>
    <!-- TITRE PRINCIPAL : PLUS GROS QUE LES CHIFFRES -->
    <h3 style="margin: 0 0 6px 0; font-size: 1.3rem; font-weight: 800; color: {textColor}; font-family: var(--font-title); letter-spacing: -0.015em; line-height: 1.25;">
      {label}
    </h3>
    
    <!-- SOUS-TITRE / PRÉCISION MÉTIER EN SECOND -->
    {#if subtext}
      <span style="font-size: 0.8rem; font-weight: 500; color: {subtextColor}; display: inline-block; line-height: 1.4;">
        {subtext}
      </span>
    {/if}
  </div>

  {#if progressBarPct !== null && progressBarPct !== undefined}
    <div>
      <!-- VALEUR CHIFFRÉE : PLUS PETITE QUE LE TITRE (1.05rem vs 1.3rem) -->
      <div style="font-size: 1.05rem; font-weight: 700; color: {textColor}; font-variant-numeric: tabular-nums; font-family: var(--font-title); margin-bottom: 8px;">
        {value}
      </div>
      <div style="width: 100%; height: 6px; background: #f1f5f9; border-radius: 999px; overflow: hidden;">
        <div style="width: {Math.min(100, Math.max(0, progressBarPct))}%; height: 100%; background: #0f172a; border-radius: 999px; transition: width 0.3s ease;"></div>
      </div>
    </div>
  {:else}
    <!-- VALEUR CHIFFRÉE : PLUS PETITE QUE LE TITRE (1.05rem vs 1.3rem) -->
    <div style="font-size: 1.05rem; font-weight: 700; color: {textColor}; font-variant-numeric: tabular-nums; font-family: var(--font-title); margin-top: 2px;">
      {value}
    </div>
  {/if}
</div>
