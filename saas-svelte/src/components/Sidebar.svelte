<script>
  import { onMount } from 'svelte';
  import { activeView, activeEntityId, entities, showCreateEntityModal, updateActiveEntityId, transactions } from '../lib/store.js';

  /** @type {{ switchView: (view: string) => void, handleResetDb: () => void }} */
  let { switchView, handleResetDb } = $props();

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

  let pendingTxBadgeCount = $derived($transactions.filter(
    (/** @type {any} */ t) => t.compteAttribué === '699' || t.statut === 'non_attribue' || t.statut === 'suggere'
  ).length);

  // Resizable Sidebar width state
  let sidebarWidth = $state(280);
  let isResizing = $state(false);

  onMount(() => {
    const savedWidth = localStorage.getItem('sidebar_width');
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (parsed >= 200 && parsed <= 500) {
        sidebarWidth = parsed;
      }
    }
  });

  function startResizing(e) {
    e.preventDefault();
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMouseMove(moveEvent) {
      const newWidth = Math.min(Math.max(moveEvent.clientX, 220), 480);
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
</script>

<aside 
  class="app-sidebar" 
  style="background: #0f172a; border-right: 1px solid rgba(255, 255, 255, 0.1); display: flex; flex-direction: column; width: {sidebarWidth}px; min-width: {sidebarWidth}px; max-width: {sidebarWidth}px; height: 100vh; position: relative; user-select: {isResizing ? 'none' : 'auto'}; transition: {isResizing ? 'none' : 'width 0.1s ease'};"
>
  <!-- SIDEBAR HEADER LOGO -->
  <div style="padding: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; gap: 12px; width: 100%; box-sizing: border-box;">
    <div class="logo-icon" style="width: 36px; height: 36px; background: #3b82f6; color: #ffffff; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-family: var(--font-title); font-size: 1.15rem; flex-shrink: 0; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);">
      S
    </div>
    <div class="brand-name" style="font-weight: 800; font-size: 1.25rem; color: #ffffff !important; opacity: 1 !important; visibility: visible !important; letter-spacing: -0.02em; font-family: var(--font-title); white-space: nowrap; overflow: visible;">scriptCompta</div>
  </div>
  
  <nav style="flex: 1; padding: 16px 12px; overflow-y: auto;">
    <ul class="sidebar-menu" style="list-style: none; padding: 0; margin: 0;">
      
      <!-- 1. TABLEAU DE BORD -->
      <li style="margin-bottom: 6px;">
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <span 
           id="menu-dashboard" 
           class="menu-item {$activeView === 'dashboard' ? 'active' : ''}" 
           onclick={() => switchView('dashboard')}>
          <i class="fa-solid fa-chart-simple"></i> Tableau de bord
        </span>
      </li>

      <!-- 2. BANQUE & PIÈCES -->
      <li style="margin-bottom: 6px;">
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <span 
           id="menu-categorize" 
           class="menu-item {$activeView === 'categorize' || $activeView === 'import' || $activeView === 'justificatifs' || $activeView === 'pieces' ? 'active' : ''}" 
           onclick={() => switchView('categorize')}>
          <i class="fa-solid fa-wallet"></i> Banque & Pièces
          {#if pendingTxBadgeCount > 0}
            <span class="badge" id="pending-tx-badge" style="margin-left: auto; background: #f59e0b; color: #ffffff; font-size: 0.72rem; padding: 2px 7px; border-radius: 10px; font-weight: 800; min-width: 18px; text-align: center;">{pendingTxBadgeCount}</span>
          {/if}
        </span>
      </li>

      <!-- 3. MON ACTIVITÉ (Intitulé dynamique) -->
      <li style="margin-bottom: 6px;">
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <span 
           id="menu-activity" 
           class="menu-item {$activeView === 'activity' || $activeView === 'workspace_asso' || $activeView === 'workspace_micro' || $activeView === 'workspace_tpe' || $activeView === 'members' || $activeView === 'sales' || $activeView === 'donations' ? 'active' : ''}" 
           onclick={() => switchView('activity')}>
          <i class="fa-solid {activityIcon}"></i> {activityLabel}
        </span>
      </li>

      <!-- 4. DOCUMENTS & CLÔTURE -->
      <li style="margin-bottom: 6px;">
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <span 
           id="menu-books" 
           class="menu-item {$activeView === 'books' || $activeView === 'livre_recettes' ? 'active' : ''}" 
           onclick={() => switchView('books')}>
          <i class="fa-solid fa-file-contract"></i> Documents & Clôture
        </span>
      </li>

    </ul>
  </nav>
  
  <!-- SÉLECTEUR DE DOSSIER DISCRET EN BAS DE SIDEBAR -->
  <div class="sidebar-footer-card" style="margin: 10px 12px; padding: 10px 14px; border-top: 1px solid rgba(0, 0, 0, 0.6); border-bottom: 1px solid rgba(255, 255, 255, 0.08); border-left: 1px solid rgba(0, 0, 0, 0.4); border-right: 1px solid rgba(0, 0, 0, 0.4); background: #0c1322; border-radius: 8px; box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.75); box-sizing: border-box;">
    <div style="font-size: 0.68rem; text-transform: uppercase; font-weight: 700; color: #94a3b8; margin-bottom: 6px; letter-spacing: 0.05em;">Structure / Dossier</div>
    <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
      <i class="fa-solid fa-building-columns" style="color: #60a5fa; font-size: 0.85rem; flex-shrink: 0;"></i>
      <select 
        value={$activeEntityId} 
        onchange={(e) => {
          const target = /** @type {HTMLSelectElement} */ (e.target);
          if (target && target.value === 'create_new') {
            $showCreateEntityModal = true;
            target.value = $activeEntityId;
          } else if (target) {
            updateActiveEntityId(target.value);
          }
        }} 
        style="flex: 1; min-width: 0; background: #060b14; border-top: 1px solid rgba(0, 0, 0, 0.7); border-bottom: 1px solid rgba(255, 255, 255, 0.08); border-left: 1px solid rgba(0, 0, 0, 0.4); border-right: 1px solid rgba(0, 0, 0, 0.4); border-radius: 6px; color: #ffffff; font-weight: 600; font-size: 0.82rem; padding: 8px 10px; outline: none; cursor: pointer; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8);"
      >
        {#each $entities as entity}
          <option value={entity.id}>{entity.name}</option>
        {/each}
        <option value="create_new">➕ Créer une structure...</option>
      </select>
    </div>

    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px; font-size: 0.72rem; color: #94a3b8;">
      <span>Formule Premium</span>
      <button 
        onclick={handleResetDb} 
        style="background: none; border: none; color: #f87171; cursor: pointer; font-size: 0.72rem; padding: 0; font-weight: 600; transition: color 0.2s;"
        title="Réinitialiser les données"
      >
        <i class="fa-solid fa-rotate-right"></i> Reset
      </button>
    </div>
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
</style>
