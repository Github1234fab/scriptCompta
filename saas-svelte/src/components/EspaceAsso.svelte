<script>
  import Members from './Members.svelte';
  import Donations from './Donations.svelte';
  import Sales from './Sales.svelte';

  let activeTab = $state('members'); // 'members', 'donations', or 'sales'
</script>

<!-- Fine Discrete Contextual Tab Bar -->
<div style="display: flex; gap: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.12); margin-bottom: 20px; padding-bottom: 2px;">
  <button 
    class="nav-tab-btn" 
    onclick={() => activeTab = 'members'} 
    style="padding: 8px 16px; font-weight: 600; font-size: 0.9rem; background: transparent; border: none; border-bottom: 2px solid {activeTab === 'members' ? '#818cf8' : 'transparent'}; color: {activeTab === 'members' ? '#ffffff' : 'rgba(255,255,255,0.6)'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; margin-bottom: -3px;"
  >
    <i class="fa-solid fa-users" style="color: {activeTab === 'members' ? '#818cf8' : 'inherit'};"></i> Inscriptions & Élèves
  </button>
  
  <button 
    class="nav-tab-btn" 
    onclick={() => activeTab = 'donations'} 
    style="padding: 8px 16px; font-weight: 600; font-size: 0.9rem; background: transparent; border: none; border-bottom: 2px solid {activeTab === 'donations' ? '#34d399' : 'transparent'}; color: {activeTab === 'donations' ? '#ffffff' : 'rgba(255,255,255,0.6)'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; margin-bottom: -3px;"
  >
    <i class="fa-solid fa-hand-holding-heart" style="color: {activeTab === 'donations' ? '#34d399' : 'inherit'};"></i> Dons & Reçus (CERFA)
  </button>
  
  <button 
    class="nav-tab-btn" 
    onclick={() => activeTab = 'sales'} 
    style="padding: 8px 16px; font-weight: 600; font-size: 0.9rem; background: transparent; border: none; border-bottom: 2px solid {activeTab === 'sales' ? '#fbbf24' : 'transparent'}; color: {activeTab === 'sales' ? '#ffffff' : 'rgba(255,255,255,0.6)'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; margin-bottom: -3px;"
  >
    <i class="fa-solid fa-basket-shopping" style="color: {activeTab === 'sales' ? '#fbbf24' : 'inherit'};"></i> Ventes & Événements
  </button>
</div>

{#if activeTab === 'members'}
  <Members />
{:else if activeTab === 'donations'}
  <Donations />
{:else}
  <Sales />
{/if}
