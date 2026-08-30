<script>
  import { onMount, tick } from 'svelte';
  import { 
    activeView, 
    activeEntityId, 
    entities, 
    transactions, 
    toastMessage, 
    showToast,
    updateActiveEntityId,
    updateEntities,
    showCreateEntityModal
  } from './lib/store.js';

  // Import components
  import Dashboard from './components/Dashboard.svelte';
  import ImportCSV from './components/ImportCSV.svelte';
  import Categorize from './components/Categorize.svelte';
  import Members from './components/Members.svelte';
  import Sales from './components/Sales.svelte';
  import Donations from './components/Donations.svelte';
  import Books from './components/Books.svelte';
  import Glossary from './components/Glossary.svelte';

  // State for creating a new entity
  let entityNameInput = $state('');
  let entityModelInput = $state('all');

  // Tour Guide states
  let tourActive = $state(false);
  let tourStep = $state(0);
  let popoverTop = $state(0);
  let popoverLeft = $state(0);
  let popoverAbove = $state(false);

  const tourSteps = [
    {
      targetId: 'start-tour-btn',
      title: 'Bienvenue sur ComptaSimples !',
      text: "Nous allons vous faire découvrir l'application en 5 étapes rapides. Ici, pas de jargon comptable incompréhensible, tout est fait pour vous faire gagner du temps !"
    },
    {
      targetId: 'menu-import',
      title: 'Étape 1 : Importer vos relevés',
      text: "C'est par ici que tout commence. Téléchargez votre relevé bancaire au format CSV depuis votre compte bancaire et importez-le en 2 secondes par simple glisser-déposer."
    },
    {
      targetId: 'menu-categorize',
      title: 'Étape 2 : Trier et Catégoriser',
      text: "Une fois importées, le système classe automatiquement la majorité des opérations. S'il reste des transactions inconnues, vous les rangez manuellement ici. En 20 minutes maximum, votre machine a tout appris !"
    },
    {
      targetId: 'menu-members',
      title: 'Étape 3 : Vos modules de gestion',
      text: "Ces onglets s'adaptent à votre activité. Suivez par exemple qui sont vos élèves, combien ils vous doivent pour l'année, et relancez les retards de paiements en 1 clic."
    },
    {
      targetId: 'menu-books',
      title: 'Étape 4 : Registres & Clôture',
      text: "Le travail est terminé ! Tous vos documents de synthèse (Bilan, Grand Livre, Journal) se génèrent d'eux-mêmes, prêts à être exportés en format officiel (FEC) pour votre expert-comptable."
    }
  ];

  // Active entity details
  let activeEntity = $derived($entities.find(e => e.id === $activeEntityId) || $entities[0]);
  let accountingModel = $derived(activeEntity ? (activeEntity.model || 'all') : 'all');

  // Count pending transactions
  let pendingTxBadgeCount = $derived($transactions.filter(
    t => t.compteAttribué === '699' || t.statut === 'non_attribue' || t.statut === 'suggere'
  ).length);

  function switchView(view) {
    activeView.set(view);
  }

  function handleResetDb() {
    if (confirm("⚠️ Voulez-vous vraiment réinitialiser toutes les données de l'application ? Cela effacera tout votre historique de tri, vos élèves, vos boutique et vos dons.")) {
      localStorage.clear();
      window.location.reload();
    }
  }

  function handleCreateEntity(e) {
    e.preventDefault();
    if (!entityNameInput.trim()) return;

    const newId = 'entity_' + Date.now();
    const newEntity = {
      id: newId,
      name: entityNameInput.trim(),
      model: entityModelInput
    };

    updateEntities([...$entities, newEntity]);
    updateActiveEntityId(newId);

    // Reset and close
    entityNameInput = '';
    entityModelInput = 'all';
    $showCreateEntityModal = false;

    showToast(`Structure "${newEntity.name}" créée avec succès !`);
  }

  function handleCancelEntity() {
    entityNameInput = '';
    entityModelInput = 'all';
    $showCreateEntityModal = false;
  }

  // Tour methods
  async function startTour() {
    tourStep = 0;
    tourActive = true;
    await tick();
    positionTourPopover();
  }

  function stopTour() {
    tourActive = false;
    document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
  }

  async function nextTourStep() {
    if (tourStep < tourSteps.length - 1) {
      // If we go to step 2/3/4, make sure to show correct views or highlights
      tourStep++;
      await tick();
      positionTourPopover();
    } else {
      stopTour();
    }
  }

  async function prevTourStep() {
    if (tourStep > 0) {
      tourStep--;
      await tick();
      positionTourPopover();
    }
  }

  function positionTourPopover() {
    const step = tourSteps[tourStep];
    const target = document.getElementById(step.targetId);

    // Remove old highlights
    document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));

    if (!target) {
      // If target menu item is hidden due to current accountingModel, skip positioning
      return;
    }

    target.classList.add('tour-highlight');
    const rect = target.getBoundingClientRect();

    if (rect.bottom + 200 < window.innerHeight) {
      popoverTop = rect.bottom + window.scrollY + 10;
      popoverLeft = rect.left + window.scrollX;
      popoverAbove = false;
    } else {
      popoverTop = rect.top + window.scrollY - 180;
      popoverLeft = rect.left + window.scrollX;
      popoverAbove = true;
    }
  }

  // Monitor resize for tour popover
  function handleResize() {
    if (tourActive) {
      positionTourPopover();
    }
  }

  onMount(() => {
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });
</script>

<div class="app-container">
  
  <!-- SIDEBAR NAVIGATION -->
  <aside class="app-sidebar">
    <div class="brand-logo">
      <div class="logo-icon"><i class="fa-solid fa-chart-line"></i></div>
      <div class="brand-name">ComptaSimples</div>
    </div>
    
    <nav>
      <ul class="sidebar-menu">
        <li>
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <span 
             id="menu-dashboard" 
             class="menu-item {$activeView === 'dashboard' ? 'active' : ''}" 
             onclick={() => switchView('dashboard')}>
            <i class="fa-solid fa-house"></i> Tableau de bord
          </span>
        </li>
        <li>
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <span 
             id="menu-import" 
             class="menu-item {$activeView === 'import' ? 'active' : ''}" 
             onclick={() => switchView('import')}>
            <i class="fa-solid fa-file-import"></i> 1. Importer relevé
          </span>
        </li>
        <li>
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <span 
             id="menu-categorize" 
             class="menu-item {$activeView === 'categorize' ? 'active' : ''}" 
             onclick={() => switchView('categorize')}>
            <i class="fa-solid fa-tags"></i> 2. Attribution des libellés
            {#if pendingTxBadgeCount > 0}
              <span class="badge badge-warning" id="pending-tx-badge" style="margin-left: auto;">{pendingTxBadgeCount}</span>
            {/if}
          </span>
        </li>
        
        <div class="menu-section-title">Outils de Gestion</div>
        
        {#if accountingModel === 'all' || accountingModel === 'members'}
          <li>
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <span 
               id="menu-members" 
               class="menu-item {$activeView === 'members' ? 'active' : ''}" 
               onclick={() => switchView('members')}>
              <i class="fa-solid fa-users"></i> Adhérents & Élèves
            </span>
          </li>
        {/if}

        {#if accountingModel === 'all' || accountingModel === 'sales'}
          <li>
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <span 
               id="menu-sales" 
               class="menu-item {$activeView === 'sales' ? 'active' : ''}" 
               onclick={() => switchView('sales')}>
              <i class="fa-solid fa-basket-shopping"></i> Ventes & Stocks
            </span>
          </li>
        {/if}

        {#if accountingModel === 'all' || accountingModel === 'donations'}
          <li>
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <span 
               id="menu-donations" 
               class="menu-item {$activeView === 'donations' ? 'active' : ''}" 
               onclick={() => switchView('donations')}>
              <i class="fa-solid fa-hand-holding-heart"></i> Dons & Reçus Fiscaux
            </span>
          </li>
        {/if}
        
        <div class="menu-section-title">Comptabilité Pure</div>
        <li>
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <span 
             id="menu-books" 
             class="menu-item {$activeView === 'books' ? 'active' : ''}" 
             onclick={() => switchView('books')}>
            <i class="fa-solid fa-book-open"></i> Registres comptables
          </span>
        </li>
        <li>
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <span 
             id="menu-glossary" 
             class="menu-item {$activeView === 'glossary' ? 'active' : ''}" 
             onclick={() => switchView('glossary')}>
            <i class="fa-solid fa-graduation-cap"></i> Glossaire (Zéro Jargon)
          </span>
        </li>
      </ul>
    </nav>
    
    <div class="sidebar-footer">
      <div class="pricing-tag">Formule Premium</div>
      <div style="font-weight: 600; margin-bottom: 2px;">19,90 € / mois</div>
      <div style="font-size: 0.75rem; color: var(--text-secondary);">Sans engagement, résiliable en 1 clic.</div>
      <button class="btn btn-secondary btn-sm" onclick={handleResetDb} style="width: 100%; margin-top: 15px; justify-content: center; background-color: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.2); color: #ef4444;">
        <i class="fa-solid fa-trash-can"></i> Réinitialiser l'application
      </button>
    </div>
  </aside>

  <!-- MAIN CONTENT CONTAINER -->
  <main class="app-content">
    
    <!-- Top Header -->
    <header class="content-header">
      <div style="margin-right: auto; display: flex; align-items: center; gap: 10px;">
        <button class="btn btn-secondary btn-sm" onclick={startTour} id="start-tour-btn">
          <i class="fa-solid fa-circle-play" style="color: var(--color-primary-light);"></i> Lancer le guide d'onboarding
        </button>
      </div>
      <div class="user-badge">
        <div class="user-avatar">FM</div>
        <span style="font-size: 0.9rem; font-weight: 600;">{activeEntity ? activeEntity.name : ''}</span>
      </div>
    </header>

    <!-- Content render area based on activeView -->
    {#if $activeView === 'dashboard'}
      <Dashboard />
    {:else if $activeView === 'import'}
      <ImportCSV />
    {:else if $activeView === 'categorize'}
      <Categorize />
    {:else if $activeView === 'members'}
      <Members />
    {:else if $activeView === 'sales'}
      <Sales />
    {:else if $activeView === 'donations'}
      <Donations />
    {:else if $activeView === 'books'}
      <Books />
    {:else if $activeView === 'glossary'}
      <Glossary />
    {/if}

  </main>
</div>

<!-- TOAST NOTIFICATION -->
{#if $toastMessage}
  <div style="position: fixed; bottom: 20px; right: 20px; backgroundColor: rgba(26, 34, 63, 0.95); border: 1px solid var(--color-primary-light); color: #fff; padding: 12px 24px; borderRadius: 8px; boxShadow: var(--shadow-md); zIndex: 10000; fontSize: 0.9rem; fontFamily: var(--font-body); display: flex; alignItems: center; gap: 8px;">
    <i class="fa-solid fa-circle-info" style="color: var(--color-primary-light)"></i>
    {$toastMessage}
  </div>
{/if}

<!-- MODAL : CREATE ENTITY -->
{#if $showCreateEntityModal}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="modal-overlay active" onclick={handleCancelEntity}>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="modal-box" onclick={(e) => e.stopPropagation()} style="max-width: 500px;">
      <div class="modal-header">
        <h3 class="modal-title">Créer une nouvelle structure</h3>
        <button class="modal-close-btn" onclick={handleCancelEntity}>&times;</button>
      </div>
      <form onsubmit={handleCreateEntity}>
        <div style="padding: 10px 0;">
          <div class="form-group">
            <label for="entity-name-input" class="form-label">Nom de l'association / structure</label>
            <input type="text" id="entity-name-input" class="form-control" bind:value={entityNameInput} required placeholder="ex: Club d'Échecs de Paris">
          </div>
          <div class="form-group">
            <label for="entity-model-input" class="form-label">Modèle comptable par défaut</label>
            <select id="entity-model-input" class="form-control" bind:value={entityModelInput}>
              <option value="all">Modèle Complet (Hybride)</option>
              <option value="members">Inscriptions & Adhésions</option>
              <option value="sales">Ventes & Boutique</option>
              <option value="donations">Dons & Mécénat</option>
            </select>
          </div>
        </div>
        <div style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 12px;">
          <button type="button" class="btn btn-secondary" onclick={handleCancelEntity}>Annuler</button>
          <button type="submit" class="btn btn-primary">Créer la structure</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ONBOARDING TOUR OVERLAY AND POPOVER -->
{#if tourActive}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="tour-overlay active" id="tour-overlay" onclick={stopTour}></div>
  
  <div class="tour-popover" id="tour-popover" style="display: block; top: {popoverTop}px; left: {popoverLeft}px; z-index: 10001; position: absolute;">
    <h4 class="tour-popover-title">{tourSteps[tourStep].title}</h4>
    <p class="tour-popover-text">{tourSteps[tourStep].text}</p>
    <div class="tour-popover-actions">
      <span class="tour-popover-steps">Étape {tourStep + 1} / {tourSteps.length}</span>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-secondary btn-sm" onclick={prevTourStep} disabled={tourStep === 0}>Précédent</button>
        <button class="btn btn-primary btn-sm" onclick={nextTourStep}>
          {tourStep === tourSteps.length - 1 ? 'Terminer' : 'Suivant'}
        </button>
      </div>
    </div>
  </div>
{/if}
