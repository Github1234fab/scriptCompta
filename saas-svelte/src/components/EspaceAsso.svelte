<script>
  import Members from './Members.svelte';
  import Donations from './Donations.svelte';
  import Sales from './Sales.svelte';

  let activeTab = $state('members'); // 'members', 'donations', or 'sales'
</script>

<!-- Fine Discrete Contextual Tab Bar -->
<div style="display: flex; gap: 8px; border-bottom: 2px solid #e2e8f0; margin-bottom: 20px; padding-bottom: 2px;">
  <button 
    class="nav-tab-btn" 
    onclick={() => activeTab = 'members'} 
    style="padding: 8px 16px; font-weight: 700; font-size: 0.9rem; background: transparent; border: none; border-bottom: 2.5px solid {activeTab === 'members' ? '#0f172a' : 'transparent'}; color: {activeTab === 'members' ? '#0f172a' : '#64748b'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; margin-bottom: -4px;"
  >
    <i class="fa-solid fa-users" style="color: {activeTab === 'members' ? '#0f172a' : '#64748b'};"></i> Inscriptions & Élèves
  </button>
  
  <button 
    class="nav-tab-btn" 
    onclick={() => activeTab = 'donations'} 
    style="padding: 8px 16px; font-weight: 700; font-size: 0.9rem; background: transparent; border: none; border-bottom: 2.5px solid {activeTab === 'donations' ? '#166534' : 'transparent'}; color: {activeTab === 'donations' ? '#166534' : '#64748b'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; margin-bottom: -4px;"
  >
    <i class="fa-solid fa-hand-holding-heart" style="color: {activeTab === 'donations' ? '#166534' : '#64748b'};"></i> Dons & Reçus (CERFA)
  </button>
  
  <button 
    class="nav-tab-btn" 
    onclick={() => activeTab = 'sales'} 
    style="padding: 8px 16px; font-weight: 700; font-size: 0.9rem; background: transparent; border: none; border-bottom: 2.5px solid {activeTab === 'sales' ? '#b45309' : 'transparent'}; color: {activeTab === 'sales' ? '#b45309' : '#64748b'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; margin-bottom: -4px;"
  >
    <i class="fa-solid fa-basket-shopping" style="color: {activeTab === 'sales' ? '#b45309' : '#64748b'};"></i> Ventes & Événements
  </button>
</div>

{#if activeTab === 'members'}
  <Members />
{:else if activeTab === 'donations'}
  <Donations />
{:else}
  <Sales />
{/if}
