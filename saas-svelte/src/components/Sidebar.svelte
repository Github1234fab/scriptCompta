<script>
  import { onMount } from 'svelte';
  import { 
    activeView, 
    activeEntityId, 
    entities, 
    showCreateEntityModal, 
    updateActiveEntityId, 
    transactions, 
    isPremium, 
    isAdmin,
    showUpgradeModal, 
    showCancelModal,
    FREE_TIER_MAX_TRANSACTIONS,
    MANAGEMENT_MODELS,
    showToast,
    openHelpGuide,
    openTitoChat,
    openDeleteStructureModal,
    isMobileSidebarOpen,
    closeMobileSidebar
  } from '../lib/store.js';
  import { currentUser } from '../lib/auth.js';
  import { updateUserPlan } from '../lib/firestoreService.js';
  import logoComeTr from '../assets/Mateo_logo.png';

  /** @type {{ switchView: (view: string) => void, handleResetDb: () => void, startTour?: () => void }} */
  let { switchView, handleResetDb, startTour } = $props();

  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0]);
  let accountingModel = $derived(activeEntity?.model || 'micro');
  let currentModelConfig = $derived(MANAGEMENT_MODELS[accountingModel] || MANAGEMENT_MODELS.micro);

  // Popover switcher d'organisation en haut
  let showOrgDropdown = $state(false);

  let activityLabel = $derived(currentModelConfig?.activityMenu?.label || 'Mon Activité');
  let activityIcon = $derived(currentModelConfig?.activityMenu?.icon || 'fa-briefcase');
  let booksLabel = $derived(currentModelConfig?.booksMenu?.label || 'Documents, Déclarations & Pièces à fournir');
  let booksIcon = $derived(currentModelConfig?.booksMenu?.icon || 'fa-file-invoice');

  let pendingTxBadgeCount = $derived($transactions.filter(
    (/** @type {any} */ t) => (!t.entityId || t.entityId === $activeEntityId) && (t.compteAttribué === '699' || t.statut === 'non_attribue' || t.statut === 'suggere')
  ).length);

  // Resizable Sidebar width state (320px de base pour afficher confortablement les libellés sans coupure)
  let sidebarWidth = $state(320);
  let isResizing = $state(false);

  onMount(() => {
    const savedWidth = localStorage.getItem('sidebar_width');
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (parsed >= 260 && parsed <= 500) {
        sidebarWidth = Math.max(parsed, 320);
      }
    }

    /** @param {any} e */
    function handleDocClick(e) {
      if (!e.target?.closest?.('#org-switcher-container')) {
        showOrgDropdown = false;
      }
    }
    window.addEventListener('click', handleDocClick);
    return () => window.removeEventListener('click', handleDocClick);
  });

  /** @param {MouseEvent} e */
  function startResizing(e) {
    e.preventDefault();
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    /** @param {MouseEvent} moveEvent */
    function onMouseMove(moveEvent) {
      const newWidth = Math.min(Math.max(moveEvent.clientX, 260), 480);
      sidebarWidth = newWidth;
    }

    function onMouseUp() {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('sidebar_width', String(sidebarWidth));
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  /** @param {string} view */
  function handleNav(view) {
    switchView(view);
    closeMobileSidebar();
  }
</script>

<aside 
  class="app-sidebar {$isMobileSidebarOpen ? 'mobile-open' : ''}" 
  style="background: #0f172a; border-right: 1px solid rgba(255, 255, 255, 0.1); display: flex; flex-direction: column; width: {sidebarWidth}px; min-width: {sidebarWidth}px; max-width: {sidebarWidth}px; height: 100vh; position: relative; box-sizing: border-box; overflow-x: hidden; flex-shrink: 0; user-select: {isResizing ? 'none' : 'auto'}; transition: {isResizing ? 'none' : 'width 0.1s ease'};"
>
  <!-- SIDEBAR HEADER : LOGO & SWITCHER D'ORGANISATION (HAUT DE SIDEBAR) -->
  <div style="padding: 16px 14px 14px 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); display: flex; flex-direction: column; gap: 12px; position: relative; flex-shrink: 0;" id="org-switcher-container">
    
    <!-- Bouton de fermeture mobile discret flottant en haut à droite -->
    <button 
      type="button" 
      class="mobile-sidebar-close-btn"
      onclick={closeMobileSidebar}
      aria-label="Fermer le menu de navigation"
      title="Fermer le menu"
    >
      <i class="fa-solid fa-xmark"></i>
    </button>

    <!-- Logo brand Tito -->
    <div style="display: flex; align-items: center; justify-content: center; padding: 4px 0;">
      <span style="font-family: inherit; font-size: 1.85rem; font-weight: 900; letter-spacing: -0.03em; color: #ffffff; user-select: none;">
        Ti<span style="color: #38bdf8;">t</span>o
      </span>
    </div>

    <!-- SWITCHER D'ORGANISATION FLUIDE & DISCRET -->
    <button 
      type="button"
      onclick={(e) => {
        e.stopPropagation();
        showOrgDropdown = !showOrgDropdown;
      }}
      style="width: 100%; background: #162032; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 7px 10px; display: flex; align-items: center; gap: 9px; cursor: pointer; text-align: left; transition: all 0.15s; outline: none;"
      onmouseenter={(e) => /** @type {HTMLElement} */ (e.currentTarget).style.borderColor = 'rgba(255, 255, 255, 0.2)'}
      onmouseleave={(e) => /** @type {HTMLElement} */ (e.currentTarget).style.borderColor = 'rgba(255, 255, 255, 0.08)'}
      title="Changer d'organisation ou en créer une"
    >
      <!-- Avatar de la structure -->
      <div style="width: 26px; height: 26px; border-radius: 6px; background: rgba(59, 130, 246, 0.2); color: #60a5fa; font-weight: 800; font-size: 0.75rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        {activeEntity ? activeEntity.name.charAt(0).toUpperCase() : 'M'}
      </div>

      <!-- Nom & Badge -->
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 700; font-size: 0.82rem; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;">
          {activeEntity ? activeEntity.name : 'Ma structure'}
        </div>
        <div style="font-size: 0.65rem; color: #94a3b8; line-height: 1.2;">
          {currentModelConfig ? currentModelConfig.title : 'Gestion'}
        </div>
      </div>

      <!-- Chevron -->
      <i class="fa-solid fa-chevron-down" style="font-size: 0.65rem; color: #94a3b8; transition: transform 0.2s; transform: {showOrgDropdown ? 'rotate(180deg)' : 'rotate(0)'};"></i>
    </button>

    <!-- POPOVER DU SWITCHER DE STRUCTURES -->
    {#if showOrgDropdown}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div 
        onclick={(e) => e.stopPropagation()}
        style="position: absolute; top: calc(100% + 4px); left: 14px; right: 14px; background: #111827; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 10px; box-shadow: 0 16px 36px rgba(0, 0, 0, 0.55); z-index: 1000; overflow: hidden; animation: fadeIn 0.15s ease-out;"
      >
        <div style="padding: 8px 10px 4px 10px; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">
          Mes structures
        </div>

        <div style="max-height: 200px; overflow-y: auto; padding: 4px; display: flex; flex-direction: column; gap: 2px;">
          {#each $entities as entity}
            {@const isSelected = entity.id === $activeEntityId}
            <div 
              style="width: 100%; border-radius: 6px; background: {isSelected ? '#1e293b' : 'transparent'}; display: flex; align-items: center; justify-content: space-between; gap: 4px; padding: 2px 4px; transition: background 0.12s;"
              onmouseenter={(e) => { if (!isSelected) /** @type {HTMLElement} */ (e.currentTarget).style.background = '#1a2333'; }}
              onmouseleave={(e) => { if (!isSelected) /** @type {HTMLElement} */ (e.currentTarget).style.background = 'transparent'; }}
            >
              <button 
                type="button"
                onclick={() => {
                  updateActiveEntityId(entity.id);
                  showOrgDropdown = false;
                  closeMobileSidebar();
                  const m = MANAGEMENT_MODELS[entity.model] || MANAGEMENT_MODELS.micro;
                  showToast(`Structure active : ${entity.name} (${m.title})`);
                }}
                style="flex: 1; min-width: 0; padding: 6px 4px; border: none; background: transparent; display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer; text-align: left;"
              >
                <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                  <div style="width: 22px; height: 22px; border-radius: 4px; background: {isSelected ? '#2563eb' : 'rgba(255, 255, 255, 0.08)'}; color: #ffffff; font-size: 0.7rem; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    {entity.name.charAt(0).toUpperCase()}
                  </div>
                  <div style="min-width: 0;">
                    <div style="font-weight: 700; font-size: 0.78rem; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      {entity.name}
                    </div>
                    <div style="font-size: 0.65rem; color: #94a3b8; line-height: 1.1;">
                      {MANAGEMENT_MODELS[entity.model]?.badge || entity.model}
                    </div>
                  </div>
                </div>
                {#if isSelected}
                  <i class="fa-solid fa-check" style="font-size: 0.72rem; color: #38bdf8;"></i>
                {/if}
              </button>

              <button
                type="button"
                title="Supprimer la structure {entity.name}"
                onclick={(e) => {
                  e.stopPropagation();
                  showOrgDropdown = false;
                  closeMobileSidebar();
                  openDeleteStructureModal(entity);
                }}
                style="background: transparent; border: none; color: #64748b; padding: 6px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s ease;"
                onmouseenter={(e) => { /** @type {HTMLElement} */ (e.currentTarget).style.color = '#ef4444'; /** @type {HTMLElement} */ (e.currentTarget).style.background = 'rgba(239, 68, 68, 0.15)'; }}
                onmouseleave={(e) => { /** @type {HTMLElement} */ (e.currentTarget).style.color = '#64748b'; /** @type {HTMLElement} */ (e.currentTarget).style.background = 'transparent'; }}
              >
                <i class="fa-regular fa-trash-can" style="font-size: 0.72rem;"></i>
              </button>
            </div>
          {/each}
        </div>

        <!-- Action Créer une nouvelle structure -->
        <div style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding: 6px;">
          <button 
            type="button"
            onclick={() => {
              showOrgDropdown = false;
              $showCreateEntityModal = true;
            }}
            style="width: 100%; padding: 8px 10px; border-radius: 6px; border: none; background: transparent; color: #60a5fa; font-weight: 700; font-size: 0.76rem; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: background 0.12s;"
            onmouseenter={(e) => /** @type {HTMLElement} */ (e.currentTarget).style.background = 'rgba(59, 130, 246, 0.12)'}
            onmouseleave={(e) => /** @type {HTMLElement} */ (e.currentTarget).style.background = 'transparent'}
          >
            <i class="fa-solid fa-plus" style="font-size: 0.72rem;"></i>
            <span>Créer une nouvelle structure</span>
          </button>
        </div>
      </div>
    {/if}

  </div>
  
  <!-- MENU PRINCIPAL -->
  <nav class="sidebar-nav-container" style="flex: 1 1 0%; min-height: 0; padding: 14px 12px; overflow-y: auto; -webkit-overflow-scrolling: touch;">
    <ul class="sidebar-menu" style="list-style: none; padding: 0; margin: 0;">
      
      <!-- 1. ACCUEIL -->
      <li>
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <span 
           id="menu-dashboard" 
           class="menu-item {$activeView === 'dashboard' ? 'active' : ''}" 
           data-tooltip="Accueil"
           title="Accueil"
           onclick={() => handleNav('dashboard')}>
          <i class="fa-solid fa-house"></i>
          <span class="menu-label-text">Accueil</span>
        </span>
      </li>

      <!-- 2. ATTRIBUTION -->
      <li>
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <span 
           id="menu-categorize" 
           class="menu-item {$activeView === 'categorize' || $activeView === 'import' || $activeView === 'justificatifs' || $activeView === 'pieces' ? 'active' : ''}" 
           data-tooltip="Attribution"
           title="Attribution"
           onclick={() => handleNav('categorize')}>
          <i class="fa-solid fa-arrows-split-up-and-left"></i>
          <span class="menu-label-text">Attribution</span>
          {#if pendingTxBadgeCount > 0}
            <span class="badge" id="pending-tx-badge" style="margin-left: auto; background: #f59e0b; color: #ffffff; font-size: 0.62rem; padding: 2px 7px; border-radius: 10px; font-weight: 800; min-width: 18px; text-align: center; flex-shrink: 0;">{pendingTxBadgeCount}</span>
          {/if}
        </span>
      </li>

      <!-- 3. GESTION DES ADHÉRENTS & DONS (Modèle Association) -->
      {#if accountingModel === 'asso'}
        <li>
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <span 
             id="menu-activity" 
             class="menu-item {$activeView === 'activity' || $activeView === 'workspace_asso' || $activeView === 'members' || $activeView === 'sales' || $activeView === 'donations' ? 'active' : ''}" 
             data-tooltip={activityLabel}
             title={activityLabel}
             onclick={() => handleNav('activity')}>
            <i class="fa-solid {activityIcon}"></i>
            <span class="menu-label-text">{activityLabel}</span>
          </span>
        </li>
      {/if}

      <!-- 4. OBLIGATION (REGISTRES, DÉCLARATIONS & JUSTIFICATIFS) -->
      <li>
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <span 
           id="menu-books" 
           class="menu-item {$activeView === 'books' || $activeView === 'livre_recettes' ? 'active' : ''}" 
           data-tooltip={booksLabel || 'Obligation'}
           title={booksLabel || 'Obligation'}
           onclick={() => handleNav('books')}>
          <i class="fa-solid fa-scale-balanced"></i>
          <span class="menu-label-text">{booksLabel || 'Obligation'}</span>
        </span>
      </li>

      <!-- SÉPARATEUR & LIEN DIRECT POSER VOS QUESTIONS -->
      <li style="margin-top: 14px; padding-top: 10px; border-top: 1px dashed rgba(255, 255, 255, 0.08);">
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <span 
           class="menu-item" 
           style="color: #38bdf8; background: rgba(56, 189, 248, 0.06); border: 1px solid rgba(56, 189, 248, 0.16);"
           data-tooltip="Posez vos questions"
           title="Posez vos questions à l'équipe Tito"
           onclick={() => {
             closeMobileSidebar();
             openTitoChat(null);
           }}>
          <i class="fa-regular fa-comment-dots" style="color: #38bdf8;"></i>
          <span class="menu-label-text" style="font-weight: 700;">Posez vos questions</span>
        </span>
      </li>

    </ul>
  </nav>
  
  <!-- PIED DE BARRE LATÉRALE ÉPURÉ : UNIQUE CARTE QUOTA / UPGRADE -->
  <div class="sidebar-bottom-panel" style="padding: 14px; border-top: 1px solid rgba(255, 255, 255, 0.08); background: #0c1220; box-sizing: border-box;">
    
    {#if $isAdmin}
      <div style="background: rgba(37, 99, 235, 0.08); border: 1px solid rgba(59, 130, 246, 0.28); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 6px;">
        <div style="font-size: 0.8rem; font-weight: 800; color: #60a5fa; display: flex; align-items: center; gap: 7px;">
          <i class="fa-solid fa-shield-halved" style="font-size: 0.78rem;"></i>
          Compte Administrateur
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <span style="font-size: 0.64rem; font-weight: 800; background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.35); padding: 2px 7px; border-radius: 4px; letter-spacing: 0.04em;">
            ADMIN
          </span>
          <span style="font-size: 0.68rem; color: #94a3b8;">Accès illimité sans quota</span>
        </div>
      </div>
    {:else if $isPremium}
      <div style="background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.22); border-radius: 10px; padding: 12px; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div 
            role="button"
            tabindex="0"
            ondblclick={async () => {
              if ($currentUser?.uid) {
                await updateUserPlan($currentUser.uid, 'free', 'inactive');
              }
            }}
            style="font-size: 0.78rem; font-weight: 800; color: #34d399; cursor: pointer; user-select: none;"
            title="Double-cliquez pour repasser en mode gratuit"
          >
            Formule Illimitée
          </div>
          <div style="font-size: 0.68rem; color: #94a3b8;">Accès complet actif</div>
        </div>
        <button 
          type="button"
          onclick={() => showCancelModal.set(true)}
          style="background: rgba(255, 255, 255, 0.08); color: #ffffff; padding: 5px 10px; border: none; border-radius: 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center;"
          title="Gérer ou résilier mon abonnement"
        >
          Gérer
        </button>
      </div>
    {:else}
      {@const usedCount = $transactions.length}
      {@const pct = Math.min(100, Math.round((usedCount / FREE_TIER_MAX_TRANSACTIONS) * 100))}
      
      <!-- Petite carte compacte & soignée -->
      <div style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
        
        <!-- En-tête Quota (Double-clic sur 'Quota gratuit' bascule le plan en illimité pour tester) -->
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span 
            role="button"
            tabindex="0"
            ondblclick={async () => {
              if ($currentUser?.uid) {
                await updateUserPlan($currentUser.uid, 'premium', 'active');
                showToast('Félicitations ! Votre compte est désormais en Formule Illimitée.');
              }
            }}
            style="font-size: 0.75rem; font-weight: 700; color: #94a3b8; cursor: pointer; user-select: none;"
            title="Double-cliquez pour simuler le passage en illimité"
          >
            Quota gratuit
          </span>
          <span style="font-size: 0.75rem; font-weight: 800; color: {pct >= 90 ? '#f87171' : pct >= 70 ? '#fbbf24' : '#60a5fa'};">
            {usedCount} / {FREE_TIER_MAX_TRANSACTIONS}
          </span>
        </div>

        <!-- Fine barre de progression (3.5px) -->
        <div style="width: 100%; height: 3.5px; background: rgba(255, 255, 255, 0.08); border-radius: 9999px; overflow: hidden;">
          <div style="width: {pct}%; height: 100%; background: {pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#3b82f6'}; border-radius: 9999px; transition: width 0.3s ease;"></div>
        </div>

        <!-- Call-to-action unique et élégant -->
        <button 
          type="button"
          onclick={() => showUpgradeModal.set(true)}
          style="margin-top: 4px; width: 100%; height: 36px; background: #2563eb; color: #ffffff; border: none; border-radius: 6px; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background 0.15s; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);"
          onmouseenter={(e) => /** @type {HTMLElement} */ (e.currentTarget).style.background = '#1d4ed8'}
          onmouseleave={(e) => /** @type {HTMLElement} */ (e.currentTarget).style.background = '#2563eb'}
          title="Passer en illimité à 6,99€/mois"
        >
          <span>Passer en illimité (6,99 €)</span> <i class="fa-solid fa-arrow-right" style="font-size: 0.78rem;"></i>
        </button>
      </div>
    {/if}

  </div>

  <!-- DRAG HANDLE POUR REDIMENSIONNER À LA SOURIS -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="sidebar-resizer" 
    onmousedown={startResizing} 
    style="position: absolute; top: 0; right: -4px; width: 8px; height: 100%; cursor: col-resize; z-index: 100; transition: background 0.2s;"
    title="Glisser pour redimensionner la barre latérale"
  ></div>
</aside>

<style>
  .sidebar-resizer:hover, .sidebar-resizer:active {
    background: rgba(59, 130, 246, 0.4);
  }

  .mobile-sidebar-close-btn {
    display: none;
    position: absolute;
    top: 14px;
    right: 14px;
    z-index: 100;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #ffffff;
    font-size: 0.95rem;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .mobile-sidebar-close-btn:hover {
    background: rgba(255, 255, 255, 0.16);
  }

  .mobile-sidebar-spacer {
    display: none;
  }

  @media (max-width: 1024px) {
    .app-sidebar {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      bottom: 0 !important;
      height: 100vh !important;
      height: 100dvh !important;
      max-height: 100dvh !important;
      width: min(300px, 85vw) !important;
      min-width: 0 !important;
      max-width: 320px !important;
      z-index: 99999 !important;
      transform: translateX(-100%) !important;
      transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1) !important;
      box-shadow: none !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
    }

    .app-sidebar.mobile-open {
      transform: translateX(0) !important;
      box-shadow: 0 0 50px rgba(0, 0, 0, 0.8) !important;
    }

    .sidebar-resizer {
      display: none !important;
    }

    .mobile-sidebar-close-btn {
      display: flex !important;
    }

    .sidebar-bottom-panel {
      flex-shrink: 0 !important;
      margin-top: auto !important;
    }
  }
</style>
