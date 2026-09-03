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
  import LivreRecettes from './components/LivreRecettes.svelte';
  import PiecesManquantes from './components/PiecesManquantes.svelte';
  import MeteoTresorerie from './components/MeteoTresorerie.svelte';
  import RadarEcheances from './components/RadarEcheances.svelte';
  import EspaceMicro from './components/EspaceMicro.svelte';
  import EspaceTPE from './components/EspaceTPE.svelte';
  import EspaceAsso from './components/EspaceAsso.svelte';
  import DashboardMicro from './components/DashboardMicro.svelte';
  import DashboardTPE from './components/DashboardTPE.svelte';
  import DashboardAsso from './components/DashboardAsso.svelte';
  import OnboardingModal from './components/OnboardingModal.svelte';

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
  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0]);
  let accountingModel = $derived(activeEntity ? (activeEntity.model || 'all') : 'all');

  // Count pending transactions
  let pendingTxBadgeCount = $derived($transactions.filter(
    t => t.compteAttribué === '699' || t.statut === 'non_attribue' || t.statut === 'suggere'
  ).length);

  /** @param {string} view */
  function switchView(view) {
    activeView.set(view);
  }

  function handleResetDb() {
    if (confirm("⚠️ Voulez-vous vraiment réinitialiser toutes les données de l'application ? Cela effacera tout votre historique de tri, vos élèves, vos boutique et vos dons.")) {
      localStorage.clear();
      updateEntities([]);
      $showCreateEntityModal = true;
      showToast("✨ Application réinitialisée ! Veuillez configurer votre premier espace.");
    }
  }

  /** @param {string} modelKey */
  function setEntityModel(modelKey) {
    if (!activeEntity) return;
    activeEntity.model = modelKey;
    entities.set([...$entities]);
    localStorage.setItem('saas_compta_entities', JSON.stringify($entities));
    /** @type {Record<string, string>} */
    const labels = {
      micro: '🚀 Micro-entreprise / Indépendant',
      tpe: '🏢 Société / TPE (SASU, SARL...)',
      asso: '🤝 Association (Loi 1901)',
      all: '⚙️ Modèle Complet (Hybride)'
    };
    showToast(`✅ Profil configuré : ${labels[modelKey] || modelKey}`);
  }

  /** @param {any} e */
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
        <div class="menu-section-title">Classement Bancaire</div>
        <li>
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <span 
             id="menu-import" 
             class="menu-item {$activeView === 'import' ? 'active' : ''}" 
             onclick={() => switchView('import')}>
            <i class="fa-solid fa-file-import"></i> 1. Importer
          </span>
        </li>
        <li>
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <span 
             id="menu-categorize" 
             class="menu-item {$activeView === 'categorize' ? 'active' : ''}" 
             onclick={() => switchView('categorize')}>
            <i class="fa-solid fa-tags"></i> 2. Attribuer
            {#if pendingTxBadgeCount > 0}
              <span class="badge badge-warning" id="pending-tx-badge" style="margin-left: auto;">{pendingTxBadgeCount}</span>
            {/if}
          </span>
        </li>
        
        <div class="menu-section-title">Outils de Gestion</div>
        
        <li>
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <span 
             id="menu-meteo" 
             class="menu-item {$activeView === 'meteo' ? 'active' : ''}" 
             onclick={() => switchView('meteo')}>
            <i class="fa-solid fa-cloud-sun"></i> 1. Météo de trésorerie
          </span>
        </li>
        <li>
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <span 
             id="menu-radar" 
             class="menu-item {$activeView === 'radar' ? 'active' : ''}" 
             onclick={() => switchView('radar')}>
            <i class="fa-solid fa-bullseye"></i> 2. Radar des échéances
          </span>
        </li>
        <li>
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <span 
             id="menu-justificatifs" 
             class="menu-item {$activeView === 'justificatifs' ? 'active' : ''}" 
             onclick={() => switchView('justificatifs')}>
            <i class="fa-solid fa-box-archive"></i> 3. Boîte à justificatifs
          </span>
        </li>

        <div class="menu-section-title">Modèle de gestion</div>
        
        {#if accountingModel === 'micro' || accountingModel === 'all'}
          <li>
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <span 
               id="menu-ws-micro" 
               class="menu-item {$activeView === 'workspace_micro' ? 'active' : ''}" 
               onclick={() => switchView('workspace_micro')}>
              <i class="fa-solid fa-rocket" style="color: #34d399;"></i> Mon Espace Micro-Entreprise
            </span>
          </li>
        {/if}

        {#if accountingModel === 'tpe' || accountingModel === 'all'}
          <li>
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <span 
               id="menu-ws-tpe" 
               class="menu-item {$activeView === 'workspace_tpe' ? 'active' : ''}" 
               onclick={() => switchView('workspace_tpe')}>
              <i class="fa-solid fa-building" style="color: #38bdf8;"></i> Mon Espace Société / TPE
            </span>
          </li>
        {/if}

        {#if accountingModel === 'asso' || accountingModel === 'all'}
          <li>
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <span 
               id="menu-ws-asso" 
               class="menu-item {$activeView === 'workspace_asso' ? 'active' : ''}" 
               onclick={() => switchView('workspace_asso')}>
              <i class="fa-solid fa-handshake-angle" style="color: #c084fc;"></i> Mon Espace Association
            </span>
          </li>
        {/if}

        <li>
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <span 
             class="menu-item" 
             style="color: var(--color-primary-light); font-size: 0.82rem; margin-top: 4px;"
             onclick={() => $showCreateEntityModal = true}>
            <i class="fa-solid fa-plus-circle"></i> ➕ Ajouter une gestion...
          </span>
        </li>
        
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
    
    <!-- Top Header Bar with Profile Switcher -->
    <header class="content-header" style="gap: 15px; flex-wrap: wrap; padding: 12px 24px;">
      <!-- Structure & Profile Picker -->
      <div style="display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); padding: 6px 14px; border-radius: var(--radius-md);">
        <i class="fa-solid fa-building-user" style="color: var(--color-primary-light); font-size: 1.1rem;"></i>
        
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 0.68rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); letter-spacing: 0.05em;">Structure active & Profil</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <!-- Select Structure -->
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
              style="background: transparent; border: none; color: white; font-weight: 700; font-size: 0.92rem; cursor: pointer; padding: 0; outline: none;"
            >
              {#each $entities as entity}
                <option value={entity.id} style="background: #11131e; color: white;">{entity.name}</option>
              {/each}
              <option value="create_new" style="background: #11131e; color: #a5b4fc;">➕ Créer une structure...</option>
            </select>

            <span style="color: var(--text-muted); opacity: 0.5;">|</span>

            <!-- Static Profile Model Badge (Locked by Onboarding) -->
            {#if accountingModel === 'micro'}
              <span style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(52, 211, 153, 0.4); color: #34d399; font-weight: 600; font-size: 0.78rem; border-radius: 4px; padding: 3px 10px; display: inline-flex; align-items: center; gap: 6px;">
                🚀 Micro-entreprise / Indépendant
              </span>
            {:else if accountingModel === 'tpe'}
              <span style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; font-weight: 600; font-size: 0.78rem; border-radius: 4px; padding: 3px 10px; display: inline-flex; align-items: center; gap: 6px;">
                🏢 Société / TPE (SASU, SARL...)
              </span>
            {:else if accountingModel === 'asso'}
              <span style="background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(192, 132, 252, 0.4); color: #c084fc; font-weight: 600; font-size: 0.78rem; border-radius: 4px; padding: 3px 10px; display: inline-flex; align-items: center; gap: 6px;">
                🤝 Association (Loi 1901)
              </span>
            {:else}
              <span style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(129, 140, 248, 0.4); color: #a5b4fc; font-weight: 600; font-size: 0.78rem; border-radius: 4px; padding: 3px 10px; display: inline-flex; align-items: center; gap: 6px;">
                ⚙️ Modèle Hybride
              </span>
            {/if}
          </div>
        </div>
      </div>

      <!-- Right Header Actions -->
      <div style="margin-left: auto; display: flex; align-items: center; gap: 12px;">
        <button class="btn btn-secondary btn-sm" onclick={startTour} id="start-tour-btn">
          <i class="fa-solid fa-circle-play" style="color: var(--color-primary-light);"></i> Guide d'onboarding
        </button>
        <div class="user-badge">
          <div class="user-avatar">FM</div>
          <span style="font-size: 0.88rem; font-weight: 600;">{activeEntity ? activeEntity.name : ''}</span>
        </div>
      </div>
    </header>

    <!-- Content render area based on activeView -->
    {#if $activeView === 'dashboard'}
      {#if accountingModel === 'micro'}
        <DashboardMicro />
      {:else if accountingModel === 'tpe'}
        <DashboardTPE />
      {:else if accountingModel === 'asso'}
        <DashboardAsso />
      {:else}
        <DashboardTPE />
      {/if}
    {:else if $activeView === 'import'}
      <ImportCSV />
    {:else if $activeView === 'categorize'}
      <Categorize />
    {:else if $activeView === 'meteo'}
      <MeteoTresorerie />
    {:else if $activeView === 'radar'}
      <RadarEcheances />
    {:else if $activeView === 'justificatifs' || $activeView === 'pieces'}
      <PiecesManquantes />
    {:else if $activeView === 'workspace_micro'}
      <EspaceMicro />
    {:else if $activeView === 'workspace_tpe'}
      <EspaceTPE />
    {:else if $activeView === 'workspace_asso'}
      <EspaceAsso />
    {:else if $activeView === 'recettes'}
      <LivreRecettes />
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

<!-- MODAL : ONBOARDING "QUE GÉREZ-VOUS ?" -->
<OnboardingModal />



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
