<script>
  import { activeView, activeEntityId, entities, showCreateEntityModal, MANAGEMENT_MODELS, showToast } from '../lib/store.js';
  import { currentUser, logoutUser } from '../lib/auth.js';

  /** @type {{ startTour: () => void }} */
  let { startTour } = $props();

  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0]);
  let accountingModel = $derived(activeEntity?.model || 'micro');
  let modelObj = $derived(MANAGEMENT_MODELS[accountingModel] || MANAGEMENT_MODELS.micro);

  let userInitials = $derived.by(() => {
    if ($currentUser?.displayName) {
      return $currentUser.displayName.slice(0, 2).toUpperCase();
    }
    if ($currentUser?.email) {
      return $currentUser.email.slice(0, 2).toUpperCase();
    }
    return 'SC';
  });

  let activityLabel = $derived(modelObj?.activityMenu?.label || 'Mon Activité');
  let activityIcon = $derived(modelObj?.activityMenu?.icon || 'fa-briefcase');
  let booksLabel = $derived(modelObj?.booksMenu?.label || 'Documents & Clôture');
  let booksIcon = $derived(modelObj?.booksMenu?.icon || 'fa-file-contract');

  async function handleLogout() {
    await logoutUser();
    showToast('À bientôt ! Déconnexion effectuée.');
  }
</script>

<header class="content-header" style="gap: 15px; flex-wrap: wrap; padding: 14px 24px; background: var(--bg-header); border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">
  <div>
    <h2 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
      {#if $activeView === 'dashboard'}
        <i class="fa-solid fa-chart-simple" style="color: var(--color-accent);"></i> {modelObj?.dashboardTitle || 'Tableau de bord'}
      {:else if $activeView === 'categorize' || $activeView === 'import' || $activeView === 'justificatifs' || $activeView === 'pieces'}
        <i class="fa-solid fa-wallet" style="color: var(--color-accent);"></i> Banque & Pièces
      {:else if $activeView === 'activity' || $activeView.startsWith('workspace_')}
        <i class="fa-solid {activityIcon}" style="color: var(--color-accent);"></i> {activityLabel}
      {:else if $activeView === 'books' || $activeView === 'recettes'}
        <i class="fa-solid {booksIcon}" style="color: var(--color-accent);"></i> {booksLabel}
      {:else}
        <i class="fa-solid fa-cube" style="color: var(--color-accent);"></i> scriptCompta
      {/if}
    </h2>
    <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
      <span>Structure : <strong style="color: #0f172a;">{activeEntity ? activeEntity.name : ''}</strong></span>
      <span style="background: {modelObj?.accentBg || '#f1f5f9'}; color: {modelObj?.accentColor || '#2563eb'}; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 4px;">
        {modelObj ? modelObj.title : 'Entité'}
      </span>
    </p>
  </div>

  <!-- Right Header Actions -->
  <div style="display: flex; align-items: center; gap: 10px;">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div 
      class="user-badge" 
      style="background: #ffffff; border: 1px solid var(--border-color); padding: 6px 14px; border-radius: 8px; display: flex; align-items: center; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);"
      title={$currentUser?.email || 'Compte connecté'}
    >
      <div class="user-avatar" style="background: #0f172a; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;">
        {userInitials}
      </div>
      <div style="display: flex; flex-direction: column; text-align: left;">
        <span style="font-size: 0.84rem; font-weight: 700; color: var(--text-main); line-height: 1.2;">
          {$currentUser?.displayName || activeEntity?.name || 'Mon Espace'}
        </span>
        <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 500; text-overflow: ellipsis; max-width: 130px; overflow: hidden; white-space: nowrap;">
          {$currentUser?.email || 'Connecté'}
        </span>
      </div>
    </div>

    <!-- Bouton Déconnexion -->
    <button 
      type="button" 
      onclick={handleLogout}
      class="btn-logout"
      style="background: #ffffff; border: 1px solid var(--border-color); color: #64748b; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 0.82rem; font-weight: 600; display: flex; align-items: center; gap: 6px; transition: all 0.2s;"
      title="Se déconnecter"
    >
      <i class="fa-solid fa-arrow-right-from-bracket"></i>
    </button>
  </div>
</header>
