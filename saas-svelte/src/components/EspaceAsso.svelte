<script>
  import Members from './Members.svelte';
  import Donations from './Donations.svelte';
  import Sales from './Sales.svelte';

  let activeTab = $state('members'); // 'members', 'donations', or 'sales'
</script>

<div style="background: linear-gradient(135deg, rgba(168, 85, 247, 0.06), rgba(15, 23, 42, 0.95)); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: var(--radius-lg); padding: 24px; margin-bottom: 25px;">
  <div class="page-title-section" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 15px; margin-bottom: 0;">
    <div>
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
        <span class="badge" style="font-size: 0.8rem; padding: 4px 12px; background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4);">🤝 ESPACE SUR-MESURE ASSOCIATION</span>
      </div>
      <h1 class="page-title" style="margin-bottom: 0; color: white;">Espace Association Loi 1901</h1>
      <p class="page-subtitle" style="color: rgba(255,255,255,0.7);">Gestion des adhésions d'élèves, émission des reçus fiscaux Cerfa et ventes événementielles.</p>
    </div>

    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
      <button class="btn {activeTab === 'members' ? 'btn-primary' : 'btn-secondary'}" onclick={() => activeTab = 'members'} style="border-color: #c084fc;">
        <i class="fa-solid fa-users"></i> Adhérents & Élèves
      </button>
      <button class="btn {activeTab === 'donations' ? 'btn-primary' : 'btn-secondary'}" onclick={() => activeTab = 'donations'}>
        <i class="fa-solid fa-hand-holding-heart"></i> Dons & Reçus Fiscaux (CERFA)
      </button>
      <button class="btn {activeTab === 'sales' ? 'btn-primary' : 'btn-secondary'}" onclick={() => activeTab = 'sales'}>
        <i class="fa-solid fa-basket-shopping"></i> Ventes & Stand Événement
      </button>
    </div>
  </div>
</div>

{#if activeTab === 'members'}
  <Members />
{:else if activeTab === 'donations'}
  <Donations />
{:else}
  <Sales />
{/if}
