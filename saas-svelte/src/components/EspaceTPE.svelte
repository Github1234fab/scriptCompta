<script>
  import PiecesManquantes from './PiecesManquantes.svelte';
  import Sales from './Sales.svelte';
  import MeteoTresorerie from './MeteoTresorerie.svelte';
  import RadarEcheances from './RadarEcheances.svelte';

  let activeTab = $state('tresorerie'); // 'tresorerie', 'echeances', or 'pieces'
</script>

<!-- Fine Discrete Contextual Tab Bar -->
<div style="display: flex; gap: 8px; border-bottom: 2px solid #e2e8f0; margin-bottom: 20px; padding-bottom: 2px;">
  <button 
    class="nav-tab-btn" 
    onclick={() => activeTab = 'tresorerie'} 
    style="padding: 8px 16px; font-weight: 700; font-size: 0.9rem; background: transparent; border: none; border-bottom: 2.5px solid {activeTab === 'tresorerie' ? '#0f172a' : 'transparent'}; color: {activeTab === 'tresorerie' ? '#0f172a' : '#64748b'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; margin-bottom: -4px;"
  >
    <i class="fa-solid fa-chart-line" style="color: {activeTab === 'tresorerie' ? '#0f172a' : '#64748b'};"></i> Trésorerie & Prévisionnel
  </button>
  
  <button 
    class="nav-tab-btn" 
    onclick={() => activeTab = 'echeances'} 
    style="padding: 8px 16px; font-weight: 700; font-size: 0.9rem; background: transparent; border: none; border-bottom: 2.5px solid {activeTab === 'echeances' ? '#0f172a' : 'transparent'}; color: {activeTab === 'echeances' ? '#0f172a' : '#64748b'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; margin-bottom: -4px;"
  >
    <i class="fa-solid fa-calendar-days" style="color: {activeTab === 'echeances' ? '#0f172a' : '#64748b'};"></i> TVA & Échéances
  </button>
  
  <button 
    class="nav-tab-btn" 
    onclick={() => activeTab = 'pieces'} 
    style="padding: 8px 16px; font-weight: 700; font-size: 0.9rem; background: transparent; border: none; border-bottom: 2.5px solid {activeTab === 'pieces' ? '#0f172a' : 'transparent'}; color: {activeTab === 'pieces' ? '#0f172a' : '#64748b'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; margin-bottom: -4px;"
  >
    <i class="fa-solid fa-receipt" style="color: {activeTab === 'pieces' ? '#0f172a' : '#64748b'};"></i> Pièces manquantes
  </button>
</div>

{#if activeTab === 'tresorerie'}
  <MeteoTresorerie />
{:else if activeTab === 'echeances'}
  <RadarEcheances />
{:else}
  <PiecesManquantes />
{/if}
