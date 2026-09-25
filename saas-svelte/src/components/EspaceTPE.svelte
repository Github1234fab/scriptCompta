<script>
  import PiecesManquantes from './PiecesManquantes.svelte';
  import Sales from './Sales.svelte';
  import MeteoTresorerie from './MeteoTresorerie.svelte';
  import RadarEcheances from './RadarEcheances.svelte';

  let activeTab = $state('tresorerie'); // 'tresorerie', 'echeances', or 'pieces'
</script>

<!-- Fine Discrete Contextual Tab Bar -->
<div style="display: flex; gap: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.12); margin-bottom: 20px; padding-bottom: 2px;">
  <button 
    class="nav-tab-btn" 
    onclick={() => activeTab = 'tresorerie'} 
    style="padding: 8px 16px; font-weight: 600; font-size: 0.9rem; background: transparent; border: none; border-bottom: 2px solid {activeTab === 'tresorerie' ? '#38bdf8' : 'transparent'}; color: {activeTab === 'tresorerie' ? '#ffffff' : 'rgba(255,255,255,0.6)'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; margin-bottom: -3px;"
  >
    <i class="fa-solid fa-chart-line" style="color: {activeTab === 'tresorerie' ? '#38bdf8' : 'inherit'};"></i> Trésorerie & Prévisionnel
  </button>
  
  <button 
    class="nav-tab-btn" 
    onclick={() => activeTab = 'echeances'} 
    style="padding: 8px 16px; font-weight: 600; font-size: 0.9rem; background: transparent; border: none; border-bottom: 2px solid {activeTab === 'echeances' ? '#38bdf8' : 'transparent'}; color: {activeTab === 'echeances' ? '#ffffff' : 'rgba(255,255,255,0.6)'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; margin-bottom: -3px;"
  >
    <i class="fa-solid fa-calendar-days" style="color: {activeTab === 'echeances' ? '#38bdf8' : 'inherit'};"></i> TVA & Échéances
  </button>
  
  <button 
    class="nav-tab-btn" 
    onclick={() => activeTab = 'pieces'} 
    style="padding: 8px 16px; font-weight: 600; font-size: 0.9rem; background: transparent; border: none; border-bottom: 2px solid {activeTab === 'pieces' ? '#38bdf8' : 'transparent'}; color: {activeTab === 'pieces' ? '#ffffff' : 'rgba(255,255,255,0.6)'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; margin-bottom: -3px;"
  >
    <i class="fa-solid fa-receipt" style="color: {activeTab === 'pieces' ? '#38bdf8' : 'inherit'};"></i> Pièces manquantes
  </button>
</div>

{#if activeTab === 'tresorerie'}
  <MeteoTresorerie />
{:else if activeTab === 'echeances'}
  <RadarEcheances />
{:else}
  <PiecesManquantes />
{/if}
