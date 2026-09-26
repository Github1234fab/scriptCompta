<script>
  /**
   * @type {{
   *   label: string,
   *   value: string | number,
   *   icon?: string,
   *   iconColor?: string,
   *   subtext?: string,
   *   subtextIcon?: string,
   *   subtextColor?: string
   * }}
   */
  let {
    label,
    value,
    icon = 'fa-chart-line',
    iconColor = 'var(--color-accent)',
    subtext = '',
    subtextIcon = 'fa-check-circle',
    subtextColor = 'var(--color-success)'
  } = $props();
</script>

<div class="kpi-card" style="background: var(--bg-kpi); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px; box-shadow: var(--shadow-card);">
  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
    <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">{label}</span>
    <i class="fa-solid {icon}" style="color: {iconColor}; font-size: 1.1rem;"></i>
  </div>
  <div style="font-size: 1.8rem; font-weight: 800; color: var(--text-main); font-variant-numeric: tabular-nums;">
    {value}
  </div>
  {#if subtext}
    <span style="font-size: 0.78rem; color: {subtextColor}; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; margin-top: 6px;">
      {#if subtextIcon}
        <i class="fa-solid {subtextIcon}"></i>
      {/if}
      {subtext}
    </span>
  {/if}
</div>
