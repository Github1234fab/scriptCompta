<script>
  import Members from './Members.svelte';
  import Donations from './Donations.svelte';
  import Sales from './Sales.svelte';

  // Carte actuellement survolée / sélectionnée
  let selectedCard = $state('members'); // 'members', 'donations', or 'sales'

  // Tableau actuellement généré et affiché en dessous
  let activeTab = $state('members'); // 'members', 'donations', or 'sales'

  /** @param {'members' | 'donations' | 'sales'} tab */
  function handleSelectCard(tab) {
    selectedCard = tab;
  }

  /** @param {'members' | 'donations' | 'sales'} tab */
  function handleActivateTab(tab) {
    activeTab = tab;
    selectedCard = tab;
  }
</script>

<style>
  .recette-card {
    background: #ffffff;
    border: 1.5px solid transparent;
    border-radius: 14px;
    padding: 20px 22px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 16px;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04);
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  }
  .recette-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 25px -4px rgba(15, 23, 42, 0.10), 0 4px 10px -2px rgba(15, 23, 42, 0.05);
  }
  .recette-card.is-selected {
    border-color: #cbd5e1;
    box-shadow: 0 10px 25px -4px rgba(15, 23, 42, 0.09), 0 4px 10px -2px rgba(15, 23, 42, 0.05);
  }
  .recette-btn {
    width: 100%;
    padding: 10px 14px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 0.88rem;
    border: none !important;
    outline: none !important;
    cursor: pointer;
    transition: background 0.15s ease, box-shadow 0.15s ease, color 0.15s ease;
  }
  .recette-btn.inactive {
    background: #f1f5f9;
    color: #334155;
  }
  .recette-btn.inactive:hover {
    background: #e2e8f0;
    color: #0f172a;
  }
  .recette-btn.active {
    background: #2563eb;
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
  }
  .recette-btn.active:hover {
    background: #1d4ed8;
  }
</style>

<!-- BLOCS DE GESTION DES RECETTES PAR COMPTE COMPTABLE -->
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px;">
  
  <!-- Bloc 1: Recettes en 756 et 706 -->
  <div 
    class="recette-card {selectedCard === 'members' || activeTab === 'members' ? 'is-selected' : ''}" 
    onclick={() => handleSelectCard('members')}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectCard('members'); }}
    role="button"
    tabindex="0"
  >
    <div>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
        <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a; font-family: var(--font-title);">
          Recette en 756 et 706
        </h3>
        <span style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 0.72rem; font-weight: 700; padding: 2px 7px; border-radius: 6px; white-space: nowrap;">
          756 · 706
        </span>
      </div>
      <div style="font-size: 0.8rem; font-weight: 600; color: #475569; line-height: 1.4; margin-bottom: 10px;">
        (Cotisations, cours, forfaits annuels, licences sportives, stages, élèves et adhérents.)
      </div>
      <p style="margin: 0; font-size: 0.78rem; color: #64748b; line-height: 1.45;">
        En cliquant sur « Créer », vous affichez un tableau de gestion qui vous permet de gérer et pointer tous vos mouvements des comptes 756 et 706.
      </p>
    </div>

    <!-- CTA : complètement neutre au survol de la carte, activable uniquement au clic -->
    <button 
      type="button" 
      class="recette-btn {activeTab === 'members' ? 'active' : 'inactive'}"
      onclick={(e) => { e.stopPropagation(); handleActivateTab('members'); }} 
    >
      {#if activeTab === 'members'}
        Tableau actif
      {:else}
        Créer
      {/if}
    </button>
  </div>

  <!-- Bloc 2: Recettes en 754 -->
  <div 
    class="recette-card {selectedCard === 'donations' || activeTab === 'donations' ? 'is-selected' : ''}" 
    onclick={() => handleSelectCard('donations')}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectCard('donations'); }}
    role="button"
    tabindex="0"
  >
    <div>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
        <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a; font-family: var(--font-title);">
          Recette en 754
        </h3>
        <span style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 0.72rem; font-weight: 700; padding: 2px 7px; border-radius: 6px; white-space: nowrap;">
          754
        </span>
      </div>
      <div style="font-size: 0.8rem; font-weight: 600; color: #475569; line-height: 1.4; margin-bottom: 10px;">
        (Dons manuels, mécénat et soutiens financiers.)
      </div>
      <p style="margin: 0; font-size: 0.78rem; color: #64748b; line-height: 1.45;">
        En cliquant sur « Créer », vous affichez le registre des donateurs et la génération automatique des reçus fiscaux officiels (CERFA).
      </p>
    </div>

    <!-- CTA : complètement neutre au survol de la carte, activable uniquement au clic -->
    <button 
      type="button" 
      class="recette-btn {activeTab === 'donations' ? 'active' : 'inactive'}"
      onclick={(e) => { e.stopPropagation(); handleActivateTab('donations'); }} 
    >
      {#if activeTab === 'donations'}
        Tableau actif
      {:else}
        Créer
      {/if}
    </button>
  </div>

  <!-- Bloc 3: Recettes en 707 et 708 -->
  <div 
    class="recette-card {selectedCard === 'sales' || activeTab === 'sales' ? 'is-selected' : ''}" 
    onclick={() => handleSelectCard('sales')}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectCard('sales'); }}
    role="button"
    tabindex="0"
  >
    <div>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
        <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a; font-family: var(--font-title);">
          Recette en 707 et 708
        </h3>
        <span style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 0.72rem; font-weight: 700; padding: 2px 7px; border-radius: 6px; white-space: nowrap;">
          707 · 708
        </span>
      </div>
      <div style="font-size: 0.8rem; font-weight: 600; color: #475569; line-height: 1.4; margin-bottom: 10px;">
        (Ventes, billetterie, buvette, événements et marchandises.)
      </div>
      <p style="margin: 0; font-size: 0.78rem; color: #64748b; line-height: 1.45;">
        En cliquant sur « Créer », vous affichez le suivi des encaissements liés aux ventes directes, buvettes et manifestations.
      </p>
    </div>

    <!-- CTA : complètement neutre au survol de la carte, activable uniquement au clic -->
    <button 
      type="button" 
      class="recette-btn {activeTab === 'sales' ? 'active' : 'inactive'}"
      onclick={(e) => { e.stopPropagation(); handleActivateTab('sales'); }} 
    >
      {#if activeTab === 'sales'}
        Tableau actif
      {:else}
        Créer
      {/if}
    </button>
  </div>

</div>

<!-- TABLEAU DE GESTION SÉLECTIONNÉ -->
{#if activeTab === 'members'}
  <Members />
{:else if activeTab === 'donations'}
  <Donations />
{:else if activeTab === 'sales'}
  <Sales />
{/if}
