<script>
  import { activeView, activeEntityId, entities, showCreateEntityModal, transactions } from '../lib/store.js';

  /** @type {{ startTour: () => void }} */
  let { startTour } = $props();

  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0]);
  let accountingModel = $derived(activeEntity?.model || 'micro');

  let activityLabel = $derived(
    accountingModel === 'asso' ? 'Adhérents & Dons' :
    accountingModel === 'micro' ? 'Recettes Micro' : 'Factures & Ventes'
  );

  let activityIcon = $derived(
    accountingModel === 'asso' ? 'fa-users-heart' :
    accountingModel === 'micro' ? 'fa-file-invoice-dollar' : 'fa-briefcase'
  );
</script>

<header class="content-header" style="gap: 15px; flex-wrap: wrap; padding: 14px 24px; background: var(--bg-header); border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">
  <div>
    <h2 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
      {#if $activeView === 'dashboard'}
        <i class="fa-solid fa-chart-simple" style="color: var(--color-accent);"></i> Tableau de bord
      {:else if $activeView === 'categorize' || $activeView === 'import' || $activeView === 'justificatifs' || $activeView === 'pieces'}
        <i class="fa-solid fa-wallet" style="color: var(--color-accent);"></i> Banque & Pièces
      {:else if $activeView === 'activity' || $activeView.startsWith('workspace_')}
        <i class="fa-solid {activityIcon}" style="color: var(--color-accent);"></i> {activityLabel}
      {:else if $activeView === 'books'}
        <i class="fa-solid fa-file-contract" style="color: var(--color-accent);"></i> Documents & Clôture
      {:else}
        <i class="fa-solid fa-cube" style="color: var(--color-accent);"></i> scriptCompta
      {/if}
    </h2>
    <p style="margin: 2px 0 0 0; font-size: 0.8rem; color: var(--text-muted);">
      Structure : <strong>{activeEntity ? activeEntity.name : ''}</strong> ({accountingModel === 'micro' ? 'Micro-entreprise' : accountingModel === 'tpe' ? 'Société / TPE' : accountingModel === 'asso' ? 'Association' : 'Entité'})
    </p>
  </div>

  <!-- Right Header Actions -->
  <div style="display: flex; align-items: center; gap: 10px;">
    <button 
      onclick={() => $showCreateEntityModal = true}
      style="background: #0f172a; color: white; border: none; border-radius: 8px; padding: 7px 14px; font-weight: 700; font-size: 0.84rem; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;"
      title="Ajouter une nouvelle gestion / structure"
    >
      <i class="fa-solid fa-circle-plus"></i> Nouvelle structure
    </button>

    <button class="btn btn-secondary btn-sm" onclick={startTour} id="start-tour-btn" style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2); color: #2563eb; font-weight: 600; border-radius: 8px; padding: 7px 14px;">
      <i class="fa-solid fa-circle-play" style="color: #2563eb;"></i> Guide d'utilisation
    </button>

    <div class="user-badge" style="background: #ffffff; border: 1px solid var(--border-color); padding: 5px 12px; border-radius: 8px; display: flex; align-items: center; gap: 8px;">
      <div class="user-avatar" style="background: #0f172a; color: white; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;">FM</div>
      <span style="font-size: 0.84rem; font-weight: 700; color: var(--text-main);">{activeEntity ? activeEntity.name : ''}</span>
    </div>
  </div>
</header>
