<script>
  import { onMount } from 'svelte';
  import { 
    activeView, 
    activeEntityId, 
    entities, 
    showCreateEntityModal, 
    MANAGEMENT_MODELS, 
    showToast,
    isPremium,
    isAdmin,
    showUpgradeModal,
    showCancelModal,
    openCguModal,
    appTheme,
    setAppTheme,
    toggleMobileSidebar
  } from '../lib/store.js';
  import { currentUser, logoutUser, sendResetPassword } from '../lib/auth.js';
  import { deferredInstallPrompt, isAppInstalled, isIosSafari } from '../lib/pwa.js';
  import InfoTip from './InfoTip.svelte';

  const stripePortalUrl = import.meta.env.VITE_STRIPE_PORTAL_LINK || 'https://billing.stripe.com/p/login/9B65kC2UzaUM8GR7CzfjG00';

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
  let booksLabel = $derived(modelObj?.booksMenu?.label || 'Documents, Déclarations & Pièces à fournir');
  let booksIcon = $derived(modelObj?.booksMenu?.icon || 'fa-file-invoice');

  let showLogoutModal = $state(false);
  let isLoggingOut = $state(false);
  let showUserDropdown = $state(false);

  onMount(() => {
    /** @param {any} e */
    function handleOutsideClick(e) {
      if (!e.target?.closest?.('#header-user-menu')) {
        showUserDropdown = false;
      }
    }
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  });

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

  async function handleResetPassword() {
    if (!$currentUser?.email) return;
    try {
      await sendResetPassword($currentUser.email);
      showToast(`E-mail de sécurité envoyé à ${$currentUser.email} pour réinitialiser votre mot de passe.`);
      showUserDropdown = false;
    } catch (err) {
      showToast("Impossible d'envoyer l'e-mail de réinitialisation.");
    }
  }

  function openInvoices() {
    showUserDropdown = false;
    if ($isPremium) {
      showToast("Redirection vers votre espace factures et reçus Stripe...");
      window.open(stripePortalUrl, '_blank', 'noopener,noreferrer');
    } else {
      showToast("Vous utilisez actuellement la formule gratuite : aucune facture émise.");
    }
  }

  async function handleInstallApp() {
    showUserDropdown = false;
    if ($deferredInstallPrompt) {
      $deferredInstallPrompt.prompt();
      const choice = await $deferredInstallPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        showToast('Tito est en cours d’installation sur votre appareil.');
      }
      deferredInstallPrompt.set(null);
    } else if (isIosSafari()) {
      showToast('Sur iPhone/iPad : touchez le bouton Partager puis « Sur l’écran d’accueil ».');
    } else {
      showToast('Ajoutez Tito en favori (Ctrl+D / ⌘+D) ou cliquez sur l’icône d’installation dans la barre d’adresse.');
    }
  }

  /** @param {KeyboardEvent} e */
  function handleKeydown(e) {
    if (e.key === 'Escape' && showLogoutModal) {
      showLogoutModal = false;
    }
    if (e.key === 'Escape' && showUserDropdown) {
      showUserDropdown = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<header class="content-header" style="background: var(--bg-header); border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
  <!-- Gauche : Hamburger (mobile) + Fil d'Ariane épuré -->
  <div class="header-left" style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; min-width: 0;">
    <button 
      type="button" 
      class="mobile-menu-toggle-btn"
      onclick={toggleMobileSidebar}
      aria-label="Ouvrir le menu de navigation"
      title="Ouvrir le menu"
    >
      <i class="fa-solid fa-bars"></i>
    </button>

    <div class="header-breadcrumb" style="display: flex; align-items: center; gap: 6px; font-size: 0.88rem; color: var(--text-muted); min-width: 0;">
      <!-- Logo Tito visible sur smartphone à côté du burger -->
      <span class="header-mobile-brand" style="display: none; font-size: 1.35rem; font-weight: 900; letter-spacing: -0.03em; color: var(--text-main); user-select: none;">
        Ti<span style="color: #38bdf8;">t</span>o
      </span>
      <span class="header-page-title" style="color: var(--text-main); font-weight: 700; white-space: nowrap;">
        {#if $activeView === 'dashboard'}
          Accueil
        {:else if $activeView === 'categorize' || $activeView === 'import' || $activeView === 'justificatifs' || $activeView === 'pieces'}
          Attribution
        {:else if $activeView === 'activity' || $activeView.startsWith('workspace_')}
          {activityLabel}
        {:else if $activeView === 'books' || $activeView === 'recettes'}
          Obligation
        {:else}
          Côme
        {/if}
      </span>
    </div>
  </div>

  <!-- Right Header Actions -->
  <div class="header-right-actions" style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">

    <!-- CTA Passer en illimité bien visible en haut si compte gratuit -->
    {#if !$isPremium && !$isAdmin}
      <button 
        type="button" 
        class="btn-upgrade-header"
        onclick={() => showUpgradeModal.set(true)}
        style="background: #2563eb; color: #ffffff; border: none; padding: 7px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 7px; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.28); transition: background 0.15s ease;"
        onmouseenter={(e) => /** @type {HTMLElement} */ (e.currentTarget).style.background = '#1d4ed8'}
        onmouseleave={(e) => /** @type {HTMLElement} */ (e.currentTarget).style.background = '#2563eb'}
        title="Passer en illimité (6,99 € / mois ou 69,90 € / an)"
      >
        <span>Passer en illimité</span>
        <i class="fa-solid fa-arrow-right" style="font-size: 0.72rem;"></i>
      </button>
    {/if}

    <!-- Sélecteur Thème Clair / Sombre direct en 1 clic (Icônes universelles) -->
    <div 
      class="theme-segmented-control"
      style="display: inline-flex; align-items: center; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 9999px; padding: 2px; gap: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);"
    >
      <button 
        type="button"
        onclick={() => setAppTheme('light')}
        class="theme-toggle-btn theme-btn-light {$appTheme === 'light' ? 'active' : ''}"
        aria-label="Activer le thème clair"
        title="Thème clair"
      >
        <i class="fa-solid fa-sun"></i>
      </button>
      <button 
        type="button"
        onclick={() => setAppTheme('dark')}
        class="theme-toggle-btn theme-btn-dark {$appTheme === 'dark' ? 'active' : ''}"
        aria-label="Activer le thème sombre"
        title="Thème sombre"
      >
        <i class="fa-solid fa-moon"></i>
      </button>
    </div>

    <!-- Pastille Utilisateur & Menu Gestion du Compte -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div id="header-user-menu" style="position: relative; display: flex; align-items: center;">
      <div 
        class="user-badge" 
        onclick={() => showUserDropdown = !showUserDropdown}
        style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 5px 12px; border-radius: 8px; display: flex; align-items: center; gap: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); cursor: pointer; user-select: none; transition: all 0.15s ease;"
        title="Gestion de mon compte et abonnement"
        onmouseenter={(e) => /** @type {HTMLElement} */ (e.currentTarget).style.borderColor = '#94a3b8'}
        onmouseleave={(e) => /** @type {HTMLElement} */ (e.currentTarget).style.borderColor = 'var(--border-color)'}
      >
        <div class="user-avatar" style="background: #4f46e5; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; flex-shrink: 0;">
          {userInitials}
        </div>
        <div class="user-badge-info" style="display: flex; flex-direction: column; text-align: left;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 0.84rem; font-weight: 700; color: var(--text-main); line-height: 1.2;">
              {$currentUser?.displayName || activeEntity?.name || 'Mon Espace'}
            </span>
            {#if $isAdmin}
              <span style="font-size: 0.65rem; font-weight: 800; background: rgba(37, 99, 235, 0.12); color: #2563eb; border: 1px solid rgba(37, 99, 235, 0.3); padding: 1px 5px; border-radius: 4px;">ADMIN</span>
            {:else if $isPremium}
              <span style="font-size: 0.65rem; font-weight: 800; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 1px 5px; border-radius: 4px;">PRO</span>
            {:else}
              <span style="font-size: 0.65rem; font-weight: 700; background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; padding: 1px 5px; border-radius: 4px;">Gratuit</span>
            {/if}
          </div>
          <span 
            title={$currentUser?.email || 'Connecté'}
            style="font-size: 0.7rem; color: var(--text-muted); font-weight: 500; text-overflow: ellipsis; max-width: 140px; overflow: hidden; white-space: nowrap;"
          >
            {$currentUser?.email || 'Connecté'}
          </span>
        </div>
        <i class="fa-solid fa-chevron-down user-badge-chevron" style="font-size: 0.7rem; color: #94a3b8; transition: transform 0.2s; transform: {showUserDropdown ? 'rotate(180deg)' : 'none'};"></i>
      </div>
      <div class="header-user-infotip">
        <InfoTip text="Accédez à vos factures, à la sécurité de votre compte et à la gestion de votre abonnement." position="bottom" width="220px" />
      </div>

      <!-- Menu déroulant Gestion de Compte & Abonnement -->
      {#if showUserDropdown}
        <div 
          style="position: absolute; top: calc(100% + 8px); right: 0; min-width: 270px; background: var(--bg-modal); border: 1px solid var(--border-color); border-radius: 12px; box-shadow: 0 15px 35px -5px rgba(15, 23, 42, 0.3); padding: 14px; z-index: 10000; animation: fadeIn 0.15s ease-out;"
        >
          <!-- Détails Utilisateur -->
          <div style="padding-bottom: 10px; border-bottom: 1px solid var(--border-color); margin-bottom: 10px;">
            <div style="font-size: 0.88rem; font-weight: 800; color: var(--text-main);">
              {$currentUser?.displayName || 'Utilisateur'}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
              {$currentUser?.email || ''}
            </div>
          </div>

          <!-- Option A : Choix du thème Clair / Sombre -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 12px;">
            <span style="font-size: 0.76rem; font-weight: 700; color: var(--text-main);">Thème</span>
            <div 
              class="theme-segmented-control"
              style="display: inline-flex; align-items: center; background: rgba(125, 125, 125, 0.15); border: 1px solid var(--border-color); border-radius: 9999px; padding: 2px; gap: 2px;"
            >
              <button 
                type="button"
                onclick={() => setAppTheme('light')}
                class="theme-toggle-btn theme-btn-light {$appTheme === 'light' ? 'active' : ''}"
                title="Thème clair"
                aria-label="Thème clair"
              >
                <i class="fa-solid fa-sun"></i>
              </button>
              <button 
                type="button"
                onclick={() => setAppTheme('dark')}
                class="theme-toggle-btn theme-btn-dark {$appTheme === 'dark' ? 'active' : ''}"
                title="Thème sombre"
                aria-label="Thème sombre"
              >
                <i class="fa-solid fa-moon"></i>
              </button>
            </div>
          </div>

          <!-- Section Abonnement / Formule -->
          <div style="background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 12px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Abonnement :</span>
              <span style="font-size: 0.75rem; font-weight: 800; color: {$isPremium || $isAdmin ? '#2563eb' : 'var(--text-main)'};">
                {$isAdmin ? 'Administrateur' : $isPremium ? 'Formule Illimitée' : 'Quota Gratuit'}
              </span>
            </div>

            {#if $isAdmin}
              <div style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 6px;">Accès total sans restriction.</div>
              <button 
                type="button"
                onclick={() => { showUserDropdown = false; showUpgradeModal.set(true); }}
                style="width: 100%; padding: 7px 10px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); font-size: 0.74rem; font-weight: 700; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background 0.15s ease;"
              >
                <i class="fa-solid fa-eye" style="font-size: 0.7rem; color: var(--text-muted);"></i>
                <span>Aperçu de l'offre</span>
              </button>
            {:else if $isPremium}
              <button 
                type="button"
                onclick={() => { showUserDropdown = false; showCancelModal.set(true); }}
                style="width: 100%; margin-top: 6px; padding: 7px 10px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); font-size: 0.78rem; font-weight: 700; border-radius: 6px; cursor: pointer;"
              >
                Gérer mon abonnement
              </button>
            {:else}
              <button 
                type="button"
                onclick={() => { showUserDropdown = false; showUpgradeModal.set(true); }}
                style="width: 100%; margin-top: 6px; padding: 8px 10px; background: #2563eb; border: none; color: #ffffff; font-size: 0.78rem; font-weight: 700; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;"
              >
                <span>Passer en illimité (6,99 €)</span>
                <i class="fa-solid fa-arrow-right" style="font-size: 0.72rem;"></i>
              </button>
            {/if}
          </div>

          <!-- Options du compte : Factures & Sécurité -->
          <div style="display: flex; flex-direction: column; gap: 1px; padding-bottom: 6px; margin-bottom: 6px; border-bottom: 1px solid var(--border-color);">
            <button 
              type="button"
              onclick={openInvoices}
              style="width: 100%; text-align: left; padding: 6px 8px; background: transparent; border: none; border-radius: 6px; color: var(--text-secondary); font-size: 0.75rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.15s ease;"
              onmouseenter={(e) => { /** @type {HTMLElement} */ (e.currentTarget).style.background = 'var(--bg-subtle)'; /** @type {HTMLElement} */ (e.currentTarget).style.color = 'var(--text-main)'; }}
              onmouseleave={(e) => { /** @type {HTMLElement} */ (e.currentTarget).style.background = 'transparent'; /** @type {HTMLElement} */ (e.currentTarget).style.color = 'var(--text-secondary)'; }}
            >
              <i class="fa-solid fa-file-invoice" style="color: #2563eb; font-size: 0.75rem; width: 14px;"></i>
              <span>Mes factures & reçus</span>
            </button>

            <button 
              type="button"
              onclick={handleResetPassword}
              style="width: 100%; text-align: left; padding: 6px 8px; background: transparent; border: none; border-radius: 6px; color: var(--text-secondary); font-size: 0.75rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.15s ease;"
              onmouseenter={(e) => { /** @type {HTMLElement} */ (e.currentTarget).style.background = 'var(--bg-subtle)'; /** @type {HTMLElement} */ (e.currentTarget).style.color = 'var(--text-main)'; }}
              onmouseleave={(e) => { /** @type {HTMLElement} */ (e.currentTarget).style.background = 'transparent'; /** @type {HTMLElement} */ (e.currentTarget).style.color = 'var(--text-secondary)'; }}
            >
              <i class="fa-solid fa-key" style="color: #2563eb; font-size: 0.75rem; width: 14px;"></i>
              <span>Modifier mon mot de passe</span>
            </button>

            {#if !$isAppInstalled}
              <button 
                type="button"
                onclick={handleInstallApp}
                style="width: 100%; text-align: left; padding: 6px 8px; background: transparent; border: none; border-radius: 6px; color: var(--text-secondary); font-size: 0.75rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.15s ease;"
                onmouseenter={(e) => { /** @type {HTMLElement} */ (e.currentTarget).style.background = 'var(--bg-subtle)'; /** @type {HTMLElement} */ (e.currentTarget).style.color = 'var(--text-main)'; }}
                onmouseleave={(e) => { /** @type {HTMLElement} */ (e.currentTarget).style.background = 'transparent'; /** @type {HTMLElement} */ (e.currentTarget).style.color = 'var(--text-secondary)'; }}
              >
                <i class="fa-solid fa-mobile-screen-button" style="color: #38bdf8; font-size: 0.75rem; width: 14px;"></i>
                <span>Installer Tito sur cet appareil</span>
              </button>
            {/if}

            <button 
              type="button"
              onclick={() => { showUserDropdown = false; openCguModal(); }}
              style="width: 100%; text-align: left; padding: 6px 8px; background: transparent; border: none; border-radius: 6px; color: var(--text-secondary); font-size: 0.75rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.15s ease;"
              onmouseenter={(e) => { /** @type {HTMLElement} */ (e.currentTarget).style.background = 'var(--bg-subtle)'; /** @type {HTMLElement} */ (e.currentTarget).style.color = 'var(--text-main)'; }}
              onmouseleave={(e) => { /** @type {HTMLElement} */ (e.currentTarget).style.background = 'transparent'; /** @type {HTMLElement} */ (e.currentTarget).style.color = 'var(--text-secondary)'; }}
            >
              <i class="fa-solid fa-scale-balanced" style="color: #2563eb; font-size: 0.75rem; width: 14px;"></i>
              <span>CGU & Cadre légal</span>
            </button>
          </div>

          <!-- Déconnexion -->
          <button 
            type="button"
            onclick={() => { showUserDropdown = false; showLogoutModal = true; }}
            style="width: 100%; text-align: left; padding: 6px 8px; background: transparent; border: none; border-radius: 6px; color: #dc2626; font-size: 0.75rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.15s ease;"
            onmouseenter={(e) => /** @type {HTMLElement} */ (e.currentTarget).style.background = 'rgba(220, 38, 38, 0.1)'}
            onmouseleave={(e) => /** @type {HTMLElement} */ (e.currentTarget).style.background = 'transparent'}
          >
            <i class="fa-solid fa-arrow-right-from-bracket" style="font-size: 0.75rem; width: 14px;"></i>
            <span>Se déconnecter</span>
          </button>
        </div>
      {/if}
    </div>

    <!-- Bouton Déconnexion rapide -->
    <button 
      type="button" 
      onclick={() => showLogoutModal = true}
      class="btn-logout"
      style="background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-muted); padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 0.82rem; font-weight: 600; display: flex; align-items: center; gap: 6px; transition: all 0.2s;"
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

<style>
  .content-header {
    padding: 10px 18px;
    gap: 12px;
  }

  .mobile-menu-toggle-btn {
    display: none;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--text-main);
    font-size: 1rem;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }
  .mobile-menu-toggle-btn:hover {
    background: var(--bg-subtle);
    border-color: var(--border-hover);
  }

  .theme-toggle-btn {
    border: 1px solid transparent;
    border-radius: 9999px;
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    cursor: pointer;
    background: transparent;
    color: var(--text-muted);
    transition: all 0.18s ease;
    box-sizing: border-box;
  }
  .theme-toggle-btn:hover {
    color: var(--text-main);
  }

  /* Thème Clair Actif : pastille blanche propre + soleil ambré / or chaleureux */
  .theme-toggle-btn.theme-btn-light.active {
    background: #ffffff !important;
    color: #f59e0b !important;
    border-color: rgba(245, 158, 11, 0.28) !important;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  }

  /* Thème Sombre Actif : nuance bleu nuit profond (#172554) + lune bleu ciel Tito (#38bdf8), distincte du bleu CTA */
  .theme-toggle-btn.theme-btn-dark.active {
    background: #172554 !important;
    color: #38bdf8 !important;
    border-color: rgba(56, 189, 248, 0.38) !important;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3), 0 0 8px rgba(56, 189, 248, 0.2);
  }

  /* Fallback générique si classe active seule */
  .theme-toggle-btn.active:not(.theme-btn-light):not(.theme-btn-dark) {
    background: #172554 !important;
    color: #38bdf8 !important;
    border-color: rgba(56, 189, 248, 0.38) !important;
  }

  @media (max-width: 1024px) {
    .mobile-menu-toggle-btn {
      display: inline-flex !important;
    }
    .content-header {
      padding: 8px 12px !important;
      margin-bottom: 16px !important;
    }
  }

  @media (max-width: 768px) {
    .header-mobile-brand {
      display: inline-flex !important;
      align-items: center;
      margin-left: 2px;
    }
    .header-page-title {
      display: none !important;
    }
    .btn-upgrade-header {
      display: none !important;
    }
    .btn-logout {
      display: none !important;
    }
    .header-user-infotip {
      display: none !important;
    }
  }

  @media (max-width: 640px) {
    .theme-segmented-control button {
      padding: 3px 7px !important;
      font-size: 0.68rem !important;
    }
    .user-badge {
      padding: 3px !important;
      gap: 0 !important;
      border-radius: 50% !important;
    }
    .user-badge-info,
    .user-badge-chevron {
      display: none !important;
    }
  }
</style>
