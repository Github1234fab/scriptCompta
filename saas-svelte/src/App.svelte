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
    showCreateEntityModal,
    resetAllStores
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
  import WelcomeScreen from './components/WelcomeScreen.svelte';
  import AuthScreen from './components/AuthScreen.svelte';
  import UpgradeModal from './components/UpgradeModal.svelte';
  import Header from './components/Header.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import { currentUser, authInitialized } from './lib/auth.js';
  import { ensureUserProfile, listenUserStructures, listenUserProfile } from './lib/firestoreService.js';
  import { userProfile } from './lib/store.js';

  // State for creating a new entity
  let entityNameInput = $state('');
  let entityModelInput = $state('all');

  let isFirstLaunch = $derived($entities.length === 0);

  // Synchronisation utilisateur Firestore
  $effect(() => {
    /** @type {any} */
    const user = $currentUser;
    if (user?.uid) {
      ensureUserProfile(user.uid, user.email || '', user.displayName || '');
      
      // Écoute du profil / plan d'abonnement
      const unsubProfile = listenUserProfile(user.uid, (data) => {
        if (data) userProfile.set(data);
      });

      // Écoute des structures
      const unsubStructures = listenUserStructures(user.uid, (remoteStructures) => {
        if (remoteStructures && remoteStructures.length > 0) {
          // Extraire uniquement les métadonnées de structure pour éviter de polluer le store des structures
          const sanitized = remoteStructures.map(s => ({
            id: s.id,
            name: s.name,
            model: s.model,
            microActivity: s.microActivity
          }));
          updateEntities(sanitized);
          if (!$activeEntityId || !remoteStructures.some(s => s.id === $activeEntityId)) {
            updateActiveEntityId(remoteStructures[0].id);
          }
        } else {
          // L'utilisateur n'a aucune structure dans Firestore (nouveau compte ou compte réinitialisé)
          updateEntities([]);
          updateActiveEntityId('');
        }
      });

      return () => {
        unsubProfile();
        unsubStructures();
      };
    }
  });

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
      title: 'Étape 2 : Attribution',
      text: "Une fois importées, le système classe automatiquement la majorité des opérations. S'il reste des transactions inconnues, vous les attribuez manuellement ici. En quelques clics, tout est en ordre !"
    },
    {
      targetId: 'menu-members',
      title: 'Étape 3 : Vos modules de gestion',
      text: "Ces onglets s'adaptent à votre activité. Suivez par exemple qui sont vos élèves ou adhérents, combien ils vous doivent pour l'année, et relancez les retards de paiements en 1 clic."
    },
    {
      targetId: 'menu-books',
      title: 'Étape 4 : Vos Obligations',
      text: "Tous vos registres légaux, livres obligatoires et déclarations se génèrent d'eux-mêmes, prêts pour l'administration fiscale ou votre expert-comptable."
    }
  ];

  // Active entity details
  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0] || { id: 'default', name: 'Ma Structure', model: 'all' });
  let accountingModel = $derived(activeEntity ? (activeEntity.model || 'all') : 'all');

  // Count pending transactions
  let pendingTxBadgeCount = $derived($transactions.filter(
    t => t.compteAttribué === '699' || t.statut === 'non_attribue' || t.statut === 'suggere'
  ).length);

  // Redirect to dashboard if trying to access activity view on a structure without separate members module
  $effect(() => {
    if ($activeView === 'activity' && accountingModel !== 'asso') {
      $activeView = 'dashboard';
    }
  });

  /** @param {string} view */
  function switchView(view) {
    $activeView = view;
  }

  function handleResetDb() {
    if (confirm("Voulez-vous vraiment réinitialiser toutes les données de l'application ? Cela effacera tout votre historique de tri, vos élèves, vos boutique et vos dons.")) {
      resetAllStores();
      showToast("Application réinitialisée. Veuillez configurer votre premier espace.");
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
      micro: 'Micro-entreprise / Indépendant',
      tpe: 'Société / TPE (SASU, SARL...)',
      asso: 'Association (Loi 1901)',
      all: 'Modèle Complet (Hybride)'
    };
    showToast(`Profil configuré : ${labels[modelKey] || modelKey}`);
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
  // Label dynamique de l'onglet Mon Activité selon le profil
  let activityLabel = $derived(
    accountingModel === 'asso' ? 'Adhérents & Cotisations' :
    accountingModel === 'micro' ? 'Suivi CA & Urssaf' :
    accountingModel === 'tpe' ? 'Pilotage Trésorerie & TVA' :
    accountingModel === 'sci' ? 'Gestion Locative & Associés' :
    accountingModel === 'copro' ? 'Copropriétaires & Charges' :
    accountingModel === 'bnc' ? 'Registre & Frais pro' : 'Mon Activité'
  );

  let activityIcon = $derived(
    accountingModel === 'asso' ? 'fa-users' :
    accountingModel === 'micro' ? 'fa-rocket' :
    accountingModel === 'tpe' ? 'fa-building' :
    accountingModel === 'sci' ? 'fa-house-user' :
    accountingModel === 'copro' ? 'fa-building-circle-check' :
    accountingModel === 'bnc' ? 'fa-briefcase' : 'fa-list-check'
  );
</script>

{#if !$authInitialized}
  <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #ffffff; font-family: inherit;">
    <div style="display: flex; flex-direction: column; align-items: center; gap: 14px;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: #3b82f6;"></i>
      <span style="font-size: 0.95rem; font-weight: 600; letter-spacing: 0.02em;">Chargement de votre session...</span>
    </div>
  </div>
{:else if !$currentUser}
  <AuthScreen />
{:else if isFirstLaunch}
  <WelcomeScreen />
{:else}
  <div class="app-container">
    <!-- SIDEBAR NAVIGATION -->
    <Sidebar {switchView} {handleResetDb} {startTour} />

    <!-- MAIN CONTENT CONTAINER -->
    <main class="app-content">
      
      <!-- TOP HEADER BAR -->
      <Header {startTour} />

      <!-- CONTENT RENDER AREA -->
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
      {:else if $activeView === 'categorize' || $activeView === 'import' || $activeView === 'justificatifs' || $activeView === 'pieces'}
        <Categorize />
      {:else if $activeView === 'activity' || $activeView === 'workspace_asso' || $activeView === 'workspace_micro' || $activeView === 'workspace_tpe' || $activeView === 'members' || $activeView === 'sales' || $activeView === 'donations'}
        {#if accountingModel === 'asso'}
          <EspaceAsso />
        {:else if accountingModel === 'micro'}
          <DashboardMicro />
        {:else}
          <DashboardTPE />
        {/if}
      {:else if $activeView === 'books' || $activeView === 'recettes'}
        <Books />
      {:else if $activeView === 'glossary'}
        <Glossary />
      {/if}

    </main>
  </div>
{/if}

<!-- TOAST NOTIFICATION FLOTTANTE (Non intrusive) -->
{#if $toastMessage}
  <div 
    class="toast-floating-container" 
    style="position: fixed; bottom: 28px; right: 28px; z-index: 9999999; animation: slideUpToast 0.25s cubic-bezier(0.16, 1, 0.3, 1);"
  >
    <div 
      style="background: #0f172a; color: #ffffff; padding: 14px 20px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; gap: 14px; font-weight: 600; font-size: 0.92rem; max-width: 480px;"
    >
      <div style="flex: 1; line-height: 1.4;">{$toastMessage}</div>
      <button 
        type="button" 
        onclick={() => $toastMessage = ''}
        style="background: transparent; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer; padding: 0 4px; display: flex; align-items: center;"
        title="Fermer"
      >
        &times;
      </button>
    </div>
  </div>
{/if}

<!-- MODAL : ONBOARDING "QUE GÉREZ-VOUS ?" (Création ou ajout de structure) -->
{#if $currentUser && !isFirstLaunch}
  <OnboardingModal />
{/if}

<!-- MODAL : SURCLASSEMENT VERS FORMULE ILLIMITÉE -->
<UpgradeModal />



<!-- ONBOARDING TOUR OVERLAY AND POPOVER -->
{#if tourActive}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="tour-overlay active" id="tour-overlay" onclick={stopTour}></div>
  
  <div class="tour-popover" id="tour-popover" style="display: block; top: {popoverTop}px; left: {popoverLeft}px; z-index: 10001; position: absolute;">
    <!-- Bouton de fermeture à tout moment -->
    <button 
      type="button" 
      onclick={stopTour} 
      aria-label="Fermer le guide"
      title="Fermer le guide"
      style="position: absolute; top: 14px; right: 14px; background: transparent; border: none; color: #94a3b8; font-size: 1rem; cursor: pointer; padding: 4px 6px; line-height: 1; border-radius: 6px; transition: all 0.15s ease;"
      onmouseenter={(e) => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
      onmouseleave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
    >
      <i class="fa-solid fa-xmark"></i>
    </button>

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
