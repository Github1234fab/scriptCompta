<script>
  import PiecesManquantes from './PiecesManquantes.svelte';
  import Sales from './Sales.svelte';

  let activeTab = $state('pieces'); // 'pieces' or 'sales'
</script>

<div style="background: linear-gradient(135deg, rgba(56, 189, 248, 0.06), rgba(15, 23, 42, 0.95)); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: var(--radius-lg); padding: 24px; margin-bottom: 25px;">
  <div class="page-title-section" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 15px; margin-bottom: 0;">
    <div>
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
        <span class="badge" style="font-size: 0.8rem; padding: 4px 12px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4);">🏢 ESPACE SUR-MESURE SOCIÉTÉ & TPE</span>
      </div>
      <h1 class="page-title" style="margin-bottom: 0; color: white;">Espace Société & TPE (SASU, SARL, SAS)</h1>
      <p class="page-subtitle" style="color: rgba(255,255,255,0.7);">Gestion des pièces justificatives, suivi de la TVA et boutique d'exploitation.</p>
    </div>

    <div style="display: flex; gap: 10px;">
      <button class="btn {activeTab === 'pieces' ? 'btn-primary' : 'btn-secondary'}" onclick={() => activeTab = 'pieces'} style="border-color: #38bdf8;">
        <i class="fa-solid fa-receipt"></i> Boîte à Justificatifs
      </button>
      <button class="btn {activeTab === 'sales' ? 'btn-primary' : 'btn-secondary'}" onclick={() => activeTab = 'sales'}>
        <i class="fa-solid fa-basket-shopping"></i> Ventes & Stock Boutique
      </button>
    </div>
  </div>
</div>

{#if activeTab === 'pieces'}
  <PiecesManquantes />
{:else}
  <Sales />
{/if}
