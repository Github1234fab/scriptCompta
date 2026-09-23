<script>
  import Members from './Members.svelte';
  import Donations from './Donations.svelte';
  import Sales from './Sales.svelte';

  let activeTab = $state('members'); // 'members', 'donations', or 'sales'
</script>

<div class="bloc-a-header" style="background: rgba(15, 20, 35, 0.75); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--radius-md); padding: 24px 28px; margin-bottom: 24px;">
  <div style="margin-bottom: 20px;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
      <span class="badge" style="font-size: 0.75rem; padding: 4px 10px; background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3);">🤝 ESPACE ASSOCIATION LOI 1901</span>
    </div>
    <h1 class="page-title" style="margin-bottom: 6px; color: white; font-size: 1.9rem;">Espace Association Loi 1901</h1>
    <p class="page-subtitle" style="color: rgba(255,255,255,0.65); font-size: 0.95rem;">Gestion des adhésions d'élèves, émission des reçus fiscaux Cerfa et ventes événementielles.</p>
  </div>

  <!-- Flat Navigation Tabs (Underline style) -->
  <div style="display: flex; gap: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 0;">
    <button 
      class="nav-tab-btn" 
      onclick={() => activeTab = 'members'} 
      style="padding: 12px 18px; font-weight: 600; font-size: 0.92rem; background: transparent; border: none; border-bottom: 2px solid {activeTab === 'members' ? '#818cf8' : 'transparent'}; color: {activeTab === 'members' ? '#ffffff' : 'rgba(255,255,255,0.6)'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; margin-bottom: -1px;"
    >
      <i class="fa-solid fa-users" style="color: {activeTab === 'members' ? '#818cf8' : 'inherit'};"></i> Adhérents & Élèves
    </button>
    
    <button 
      class="nav-tab-btn" 
      onclick={() => activeTab = 'donations'} 
      style="padding: 12px 18px; font-weight: 600; font-size: 0.92rem; background: transparent; border: none; border-bottom: 2px solid {activeTab === 'donations' ? '#34d399' : 'transparent'}; color: {activeTab === 'donations' ? '#ffffff' : 'rgba(255,255,255,0.6)'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; margin-bottom: -1px;"
    >
      <i class="fa-solid fa-hand-holding-heart" style="color: {activeTab === 'donations' ? '#34d399' : 'inherit'};"></i> Dons & Reçus (CERFA)
    </button>
    
    <button 
      class="nav-tab-btn" 
      onclick={() => activeTab = 'sales'} 
      style="padding: 12px 18px; font-weight: 600; font-size: 0.92rem; background: transparent; border: none; border-bottom: 2px solid {activeTab === 'sales' ? '#fbbf24' : 'transparent'}; color: {activeTab === 'sales' ? '#ffffff' : 'rgba(255,255,255,0.6)'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; margin-bottom: -1px;"
    >
      <i class="fa-solid fa-basket-shopping" style="color: {activeTab === 'sales' ? '#fbbf24' : 'inherit'};"></i> Ventes & Événements
    </button>
  </div>
</div>

{#if activeTab === 'members'}
  <Members />
{:else if activeTab === 'donations'}
  <Donations />
{:else}
  <Sales />
{/if}
