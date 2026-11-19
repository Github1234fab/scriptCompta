<script>
  import Members from './Members.svelte';
  import Donations from './Donations.svelte';
  import Sales from './Sales.svelte';
  import InfoTip from './InfoTip.svelte';
  import { openHelpGuide } from '../lib/store.js';

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
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        const el = document.getElementById('registre-content-area');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 60);
    }
  }
</script>

<style>
  .recette-card {
    background: var(--bg-card);
    border: 1.5px solid var(--border-color);
    border-radius: 14px;
    padding: 20px 22px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 16px;
    cursor: pointer;
    box-shadow: var(--shadow-sm);
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  }
  .recette-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
  .recette-card.is-selected {
    border: 2px solid #3b82f6 !important;
    box-shadow: 0 0 0 1px #3b82f6, 0 10px 25px -4px rgba(37, 99, 235, 0.25);
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
    background: var(--bg-subtle);
    color: var(--text-secondary);
    border: 1px solid var(--border-color) !important;
  }
  .recette-btn.inactive:hover {
    background: var(--bg-card-hover);
    color: var(--text-main);
  }
  .recette-btn.active {
    background: #4f46e5;
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(79, 70, 229, 0.35);
  }
  .recette-btn.active:hover {
    background: #4338ca;
  }
  .recettes-accounts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
    gap: 16px;
  }
  @media (max-width: 768px) {
    .page-title-section {
      display: none !important;
    }
    .recettes-section-container {
      background: transparent !important;
      border: none !important;
      padding: 0 !important;
      box-shadow: none !important;
      margin-bottom: 28px !important;
    }
    .recettes-accounts-grid {
      grid-template-columns: 1fr !important;
      gap: 12px !important;
    }
  }
</style>

<div class="page-title-section" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-bottom: 20px; flex-wrap: wrap;">
  <div style="flex: 1; min-width: 0;">
    <h1 class="page-title" style="margin: 0; font-size: 1.4rem; font-weight: 800; color: var(--text-main, #0f172a); font-family: var(--font-title, sans-serif);">
      Gestion des Recettes
    </h1>
    <p class="page-subtitle" style="margin: 4px 0 0 0; font-size: 0.86rem; color: var(--text-muted, #64748b);">
      Suivez vos encaissements par type d'activité : cotisations, cours, forfaits, dons et ventes.
    </p>
  </div>

  <button 
    type="button" 
    onclick={() => openHelpGuide('recettes')}
    title="Guide d'utilisation pour la gestion des recettes"
    aria-label="Guide d'utilisation pour la gestion des recettes"
    class="page-help-btn"
  >
    <i class="fa-solid fa-question"></i>
  </button>
</div>

<!-- BLOCS DE GESTION DES RECETTES PAR COMPTE COMPTABLE -->
<div class="recettes-section-container" style="background: var(--bg-container, #f8fafc); border: 1.5px solid var(--border-container, #e2e8f0); border-radius: 16px; padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
  <div class="recettes-accounts-grid">
  
  <!-- Bloc 1: Recettes en 756 et 706 -->
  <div 
    class="recette-card {activeTab === 'members' ? 'is-selected' : ''}" 
    onclick={() => handleActivateTab('members')}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleActivateTab('members'); }}
    role="button"
    tabindex="0"
  >
    <div>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
        <h3 style="margin: 0; font-size: 1.02rem; font-weight: 800; color: var(--text-main); font-family: var(--font-title); display: flex; align-items: center;">
          <span>Cotisations & Cours</span>
          <InfoTip text="Isole et pilote vos cotisations, adhésions et forfaits encaissés sur votre compte bancaire. Permet de pointer et gérer tous vos mouvements 756 et 706." width="280px" />
        </h3>
        <span style="background: rgba(37, 99, 235, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 0.72rem; font-weight: 700; padding: 2px 7px; border-radius: 6px; white-space: nowrap;">
          756 · 706
        </span>
      </div>
      <div style="font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); line-height: 1.35;">
        Cotisations, cours, forfaits annuels, stages, élèves et adhérents.
      </div>
    </div>

    <!-- CTA : État clair et homogène -->
    <button 
      type="button" 
      class="recette-btn {activeTab === 'members' ? 'active' : 'inactive'}"
      onclick={(e) => { e.stopPropagation(); handleActivateTab('members'); }} 
    >
      {#if activeTab === 'members'}
        <span style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
          <i class="fa-solid fa-check" style="font-size: 0.82rem;"></i>
          <span>Registre affiché</span>
        </span>
      {:else}
        <span>Consulter ce registre</span>
      {/if}
    </button>
  </div>

  <!-- Bloc 2: Recettes en 754 -->
  <div 
    class="recette-card {activeTab === 'donations' ? 'is-selected' : ''}" 
    onclick={() => handleActivateTab('donations')}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleActivateTab('donations'); }}
    role="button"
    tabindex="0"
  >
    <div>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
        <h3 style="margin: 0; font-size: 1.02rem; font-weight: 800; color: var(--text-main); font-family: var(--font-title); display: flex; align-items: center;">
          <span>Dons & Mécénat</span>
          <InfoTip text="Registre officiel des donateurs, mécénats et édition automatique des reçus fiscaux officiels (CERFA)." width="280px" />
        </h3>
        <span style="background: rgba(37, 99, 235, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 0.72rem; font-weight: 700; padding: 2px 7px; border-radius: 6px; white-space: nowrap;">
          754
        </span>
      </div>
      <div style="font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); line-height: 1.35;">
        Dons manuels, mécénat et soutiens financiers (reçus fiscaux CERFA).
      </div>
    </div>

    <!-- CTA : État clair et homogène -->
    <button 
      type="button" 
      class="recette-btn {activeTab === 'donations' ? 'active' : 'inactive'}"
      onclick={(e) => { e.stopPropagation(); handleActivateTab('donations'); }} 
    >
      {#if activeTab === 'donations'}
        <span style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
          <i class="fa-solid fa-check" style="font-size: 0.82rem;"></i>
          <span>Registre affiché</span>
        </span>
      {:else}
        <span>Consulter ce registre</span>
      {/if}
    </button>
  </div>

  <!-- Bloc 3: Recettes en 707 et 708 -->
  <div 
    class="recette-card {activeTab === 'sales' ? 'is-selected' : ''}" 
    onclick={() => handleActivateTab('sales')}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleActivateTab('sales'); }}
    role="button"
    tabindex="0"
  >
    <div>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
        <h3 style="margin: 0; font-size: 1.02rem; font-weight: 800; color: var(--text-main); font-family: var(--font-title); display: flex; align-items: center;">
          <span>Ventes & Manifestations</span>
          <InfoTip text="Suivi des encaissements liés aux ventes directes, buvettes, billetterie et manifestations." width="280px" />
        </h3>
        <span style="background: rgba(37, 99, 235, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 0.72rem; font-weight: 700; padding: 2px 7px; border-radius: 6px; white-space: nowrap;">
          707 · 708
        </span>
      </div>
      <div style="font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); line-height: 1.35;">
        Ventes directes, billetterie, buvette, événements et marchandises.
      </div>
    </div>

    <!-- CTA : État clair et homogène -->
    <button 
      type="button" 
      class="recette-btn {activeTab === 'sales' ? 'active' : 'inactive'}"
      onclick={(e) => { e.stopPropagation(); handleActivateTab('sales'); }} 
    >
      {#if activeTab === 'sales'}
        <span style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
          <i class="fa-solid fa-check" style="font-size: 0.82rem;"></i>
          <span>Registre affiché</span>
        </span>
      {:else}
        <span>Consulter ce registre</span>
      {/if}
    </button>
  </div>
  </div>
</div>

<!-- TABLEAU DE GESTION SÉLECTIONNÉ -->
<div id="registre-content-area">
  {#if activeTab === 'members'}
    <Members />
  {:else if activeTab === 'donations'}
    <Donations />
  {:else if activeTab === 'sales'}
    <Sales />
  {/if}
</div>
