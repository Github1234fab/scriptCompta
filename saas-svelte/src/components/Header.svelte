<script>
  import { activeView, activeEntityId, entities, showCreateEntityModal, MANAGEMENT_MODELS } from '../lib/store.js';

  /** @type {{ startTour: () => void }} */
  let { startTour } = $props();

  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0]);
  let accountingModel = $derived(activeEntity?.model || 'micro');
  let modelObj = $derived(MANAGEMENT_MODELS[accountingModel] || MANAGEMENT_MODELS.micro);

  let activityLabel = $derived(
    accountingModel === 'asso' ? 'Adhérents & Dons' :
    accountingModel === 'micro' ? 'Recettes Micro' :
    accountingModel === 'bnc' ? 'Registre & Frais BNC' :
    accountingModel === 'sci' ? 'Loyers & Associés' :
    accountingModel === 'copro' ? 'Lots & Tantièmes' : 'Factures & Ventes'
  );

  let activityIcon = $derived(
    accountingModel === 'asso' ? 'fa-users-heart' :
    accountingModel === 'micro' ? 'fa-file-invoice-dollar' :
    accountingModel === 'bnc' ? 'fa-scale-balanced' :
    accountingModel === 'sci' ? 'fa-house' :
    accountingModel === 'copro' ? 'fa-building-user' : 'fa-briefcase'
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
      Structure : <strong>{activeEntity ? activeEntity.name : ''}</strong> ({modelObj ? modelObj.title : 'Entité'})
    </p>
  </div>

  <!-- Right Header Actions -->
  <div style="display: flex; align-items: center; gap: 10px;">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div 
      class="user-badge" 
      onclick={() => showToast(`👤 Compte utilisateur : ${activeEntity ? activeEntity.name : 'Mon Compte'}`)}
      style="background: #ffffff; border: 1px solid var(--border-color); padding: 6px 14px; border-radius: 8px; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.05);"
      title="Mon profil & compte utilisateur"
    >
      <div class="user-avatar" style="background: #0f172a; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;">FM</div>
      <div style="display: flex; flex-direction: column; text-align: left;">
        <span style="font-size: 0.84rem; font-weight: 700; color: var(--text-main); line-height: 1.2;">{activeEntity ? activeEntity.name : 'Mon Compte'}</span>
        <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 500;">Mon Profil ➔</span>
      </div>
    </div>
  </div>
</header>
