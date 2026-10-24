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

  let showLogoutModal = $state(false);
  let isLoggingOut = $state(false);

  async function confirmLogout() {
    isLoggingOut = true;
    try {
      await logoutUser();
      showToast('À bientôt ! Déconnexion effectuée.');
    } catch (e) {
      showToast('Erreur lors de la déconnexion.');
    } finally {
      isLoggingOut = false;
      showLogoutModal = false;
    }
  }

  /** @param {KeyboardEvent} e */
  function handleKeydown(e) {
    if (e.key === 'Escape' && showLogoutModal) {
      showLogoutModal = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<header class="content-header" style="gap: 15px; flex-wrap: wrap; padding: 14px 24px; background: var(--bg-header); border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">
  <div>
    <h2 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
      {#if $activeView === 'dashboard'}
        <i class="fa-solid fa-chart-simple" style="color: var(--color-accent);"></i> {modelObj?.dashboardTitle || 'Tableau de bord'}
      {:else if $activeView === 'categorize' || $activeView === 'import' || $activeView === 'justificatifs' || $activeView === 'pieces'}
        <i class="fa-solid fa-list-check" style="color: var(--color-accent);"></i> Libellés & Attribution
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

    <!-- Bouton Déconnexion ouvrant la modale de confirmation -->
    <button 
      type="button" 
      onclick={() => showLogoutModal = true}
      class="btn-logout"
      style="background: #ffffff; border: 1px solid var(--border-color); color: #64748b; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 0.82rem; font-weight: 600; display: flex; align-items: center; gap: 6px; transition: all 0.2s;"
      title="Se déconnecter"
    >
      <i class="fa-solid fa-arrow-right-from-bracket"></i>
    </button>
  </div>
</header>

<!-- MODALE DE CONFIRMATION DE DÉCONNEXION -->
{#if showLogoutModal}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div 
    class="modal-backdrop" 
    role="dialog" 
    aria-modal="true" 
    aria-label="Confirmation de déconnexion"
    tabindex="-1"
    onclick={() => showLogoutModal = false}
    style="position: fixed; inset: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 999999; padding: 20px;"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div 
      class="modal-card" 
      onclick={(e) => e.stopPropagation()}
      style="background: #ffffff; width: 100%; max-width: 440px; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); border: 1.5px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; animation: zoomIn 0.2s ease-out;"
    >
      <div style="padding: 24px 24px 20px 24px;">
        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 16px;">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
            <i class="fa-solid fa-arrow-right-from-bracket"></i>
          </div>
          <div>
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #0f172a; font-family: var(--font-title);">
              Confirmation de déconnexion
            </h3>
            <p style="margin: 2px 0 0 0; font-size: 0.82rem; color: #64748b;">
              Souhaitez-vous fermer votre session de travail ?
            </p>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; margin-bottom: 18px;">
          <div style="font-size: 0.78rem; color: #64748b; margin-bottom: 4px;">Compte actuellement connecté :</div>
          <div style="font-size: 0.88rem; font-weight: 700; color: #0f172a;">{$currentUser?.email || 'Utilisateur'}</div>
          {#if activeEntity?.name}
            <div style="font-size: 0.76rem; color: #475569; margin-top: 2px;">
              Structure active : <strong>{activeEntity.name}</strong>
            </div>
          {/if}
        </div>

        <p style="margin: 0; font-size: 0.84rem; color: #475569; line-height: 1.5;">
          Vos données bancaires et écritures comptables restent enregistrées et sécurisées. Vous pourrez reprendre votre travail à tout moment.
        </p>
      </div>

      <div style="padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px;">
        <button 
          type="button" 
          onclick={() => showLogoutModal = false}
          disabled={isLoggingOut}
          style="padding: 9px 16px; border-radius: 8px; border: 1.5px solid #cbd5e1; background: #ffffff; color: #475569; font-weight: 700; font-size: 0.86rem; cursor: pointer; transition: all 0.15s;"
        >
          Annuler
        </button>

        <button 
          type="button" 
          onclick={confirmLogout}
          disabled={isLoggingOut}
          style="padding: 9px 20px; border-radius: 8px; border: none; background: #dc2626; color: #ffffff; font-weight: 700; font-size: 0.86rem; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 4px rgba(220, 38, 38, 0.25); transition: all 0.15s;"
        >
          {#if isLoggingOut}
            <i class="fa-solid fa-spinner fa-spin"></i> Déconnexion...
          {:else}
            <i class="fa-solid fa-arrow-right-from-bracket"></i> Confirmer la déconnexion
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
