<script>
  import { updateEntities, updateActiveEntityId, entities, showToast, MANAGEMENT_MODELS, isPremium, showUpgradeModal } from '../lib/store.js';
  import { currentUser } from '../lib/auth.js';
  import { saveEntityData } from '../lib/firestoreService.js';
  import { 
    formatSiretDisplay, 
    cleanSiret, 
    validateLuhnSiret, 
    verifySiretApi, 
    checkSiretTrialAvailability, 
    registerSiretUsage 
  } from '../lib/siretService.js';

  let currentScreen = $state('select'); // 'select' | 'name'
  let selectedModel = $state('micro');
  let nameInput = $state('');
  let siretInput = $state('');
  let isPendingRegistration = $state(false); // Option "En cours d'immatriculation"
  let isVerifyingSiret = $state(false);
  let siretVerificationResult = $state(null); // { valid: boolean, company?: any, error?: string }
  let siretBlockReason = $state('');

  let selectedModelObj = $derived(MANAGEMENT_MODELS[selectedModel] || MANAGEMENT_MODELS.micro);

  /** @param {string} modelKey */
  function handleSelectStructure(modelKey) {
    selectedModel = modelKey;
    nameInput = '';
    siretInput = '';
    siretVerificationResult = null;
    siretBlockReason = '';
    isPendingRegistration = false;
    currentScreen = 'name';
  }

  function handleBackToSelection() {
    currentScreen = 'select';
  }

  /**
   * Traitement en direct de la saisie du SIRET
   * @param {any} e
   */
  async function handleSiretInput(e) {
    const raw = e.target.value;
    siretInput = formatSiretDisplay(raw);
    siretBlockReason = '';
    siretVerificationResult = null;

    const cleaned = cleanSiret(raw);

    // Déclencher la vérification dès que 14 chiffres (SIRET), 9 chiffres (SIREN) ou format RNA (W...) sont atteints
    if (cleaned.length === 14 || (cleaned.length === 9 && !cleaned.startsWith('W')) || (cleaned.startsWith('W') && cleaned.length === 10)) {
      isVerifyingSiret = true;

      // 1. Contrôle anti-abus d'unicité Firestore
      const availability = await checkSiretTrialAvailability(cleaned, $currentUser?.uid, $isPremium);
      if (!availability.allowed) {
        isVerifyingSiret = false;
        siretBlockReason = availability.reason || "Ce numéro SIRET a déjà bénéficié d'un essai gratuit.";
        return;
      }

      // 2. Vérification auprès de l'API officielle Recherche d'entreprises (INSEE / RNE)
      const apiCheck = await verifySiretApi(cleaned);
      isVerifyingSiret = false;
      siretVerificationResult = apiCheck;

      if (apiCheck.valid && apiCheck.company?.nom_complet) {
        // Pré-remplir automatiquement le nom s'il n'a pas encore été saisi
        if (!nameInput.trim()) {
          nameInput = apiCheck.company.nom_complet;
        }
      }
    }
  }

  function applyOfficialName() {
    if (siretVerificationResult?.company?.nom_complet) {
      nameInput = siretVerificationResult.company.nom_complet;
    }
  }

  /** @param {any} e */
  async function handleCreateStructure(e) {
    e.preventDefault();
    if (!nameInput.trim() || !selectedModel) return;

    const cleanedSiret = cleanSiret(siretInput);

    // Validation du SIRET si l'utilisateur l'a renseigné
    if (cleanedSiret) {
      if (siretBlockReason) {
        showToast(siretBlockReason);
        showUpgradeModal.set(true);
        return;
      }

      // Re-vérification de sécurité si la vérification n'est pas encore passée
      if (!siretVerificationResult?.valid) {
        isVerifyingSiret = true;
        const apiCheck = await verifySiretApi(cleanedSiret);
        isVerifyingSiret = false;
        siretVerificationResult = apiCheck;
        if (!apiCheck.valid) {
          showToast(apiCheck.error || "Numéro SIRET introuvable à l'INSEE.");
          return;
        }
      }

      // Contrôle anti-abus final
      const availability = await checkSiretTrialAvailability(cleanedSiret, $currentUser?.uid, $isPremium);
      if (!availability.allowed) {
        siretBlockReason = availability.reason || "Ce SIRET a déjà bénéficié d'un essai gratuit.";
        showToast(siretBlockReason);
        showUpgradeModal.set(true);
        return;
      }
    }

    const newId = 'entity_' + Date.now();
    const newEntity = {
      id: newId,
      name: nameInput.trim(),
      model: selectedModel,
      siret: cleanedSiret || '',
      isPendingRegistration: !!isPendingRegistration,
      officialData: siretVerificationResult?.company || null
    };

    updateEntities([...$entities, newEntity]);
    updateActiveEntityId(newId);

    if ($currentUser?.uid) {
      await saveEntityData($currentUser.uid, newId, newEntity);
      if (cleanedSiret) {
        await registerSiretUsage(cleanedSiret, $currentUser.uid, newEntity);
      }
    }

    const modelObj = MANAGEMENT_MODELS[newEntity.model] || MANAGEMENT_MODELS.micro;
    showToast(`Bienvenue ! Votre espace ${modelObj.title} "${newEntity.name}" est configuré.`);
  }
</script>

<div class="welcome-page-wrapper">
  
  {#if currentScreen === 'select'}
    <!-- SCREEN 1 : SÉLECTION DU STATUT (AUCUN BOUTON EN BAS) -->
    <div class="welcome-card select-screen">
      
      <header class="welcome-header">
        <div class="welcome-badge">
          TITO • NOUVELLE STRUCTURE
        </div>
        <h1 class="welcome-title">
          Choisissez votre profil de gestion
        </h1>
        <p class="welcome-subtitle">
          Cliquez sur le statut correspondant à votre activité pour configurer vos registres et documents comptables.
        </p>
      </header>

      <!-- GRILLE DES 6 STRUCTURES (CLIC DIRECT EN TANT QUE BOUTONS NATIFS) -->
      <div class="models-grid">
        
        <!-- 1. Micro-entreprise -->
        <button 
          type="button" 
          class="model-card" 
          onclick={() => handleSelectStructure('micro')}
        >
          <div class="card-top">
            <span class="pill-badge">Auto-entrepreneur</span>
            <i class="fa-solid fa-chevron-right card-arrow"></i>
          </div>
          <h2 class="card-title">Micro-entreprise</h2>
          <p class="card-desc">Livre des recettes, registre des achats, seuils franchise TVA et Urssaf.</p>
        </button>

        <!-- 2. Société / TPE -->
        <button 
          type="button" 
          class="model-card" 
          onclick={() => handleSelectStructure('tpe')}
        >
          <div class="card-top">
            <span class="pill-badge">SASU, EURL, SARL, SAS</span>
            <i class="fa-solid fa-chevron-right card-arrow"></i>
          </div>
          <h2 class="card-title">Société / TPE</h2>
          <p class="card-desc">Comptabilité d'engagement, Livre-journal, Grand-livre, TVA et export FEC.</p>
        </button>

        <!-- 3. Association Loi 1901 -->
        <button 
          type="button" 
          class="model-card" 
          onclick={() => handleSelectStructure('asso')}
        >
          <div class="card-top">
            <span class="pill-badge">Club / Assos</span>
            <i class="fa-solid fa-chevron-right card-arrow"></i>
          </div>
          <h2 class="card-title">Association Loi 1901</h2>
          <p class="card-desc">Cotisations adhérents, subventions CERFA 15059 et reçus fiscaux de dons.</p>
        </button>

        <!-- 4. Profession Libérale -->
        <button 
          type="button" 
          class="model-card" 
          onclick={() => handleSelectStructure('bnc')}
        >
          <div class="card-top">
            <span class="pill-badge">Déclaration 2035 BNC</span>
            <i class="fa-solid fa-chevron-right card-arrow"></i>
          </div>
          <h2 class="card-title">Profession Libérale</h2>
          <p class="card-desc">Livre-journal BNC, barème kilométrique et préparation liasse 2035.</p>
        </button>

        <!-- 5. SCI Familiale -->
        <button 
          type="button" 
          class="model-card" 
          onclick={() => handleSelectStructure('sci')}
        >
          <div class="card-top">
            <span class="pill-badge">Impôt sur le Revenu (IR)</span>
            <i class="fa-solid fa-chevron-right card-arrow"></i>
          </div>
          <h2 class="card-title">SCI Familiale</h2>
          <p class="card-desc">Gestion des loyers, quittances 1-clic, apports CCA et déclaration 2072.</p>
        </button>

        <!-- 6. Copropriété Bénévole -->
        <button 
          type="button" 
          class="model-card" 
          onclick={() => handleSelectStructure('copro')}
        >
          <div class="card-top">
            <span class="pill-badge">Syndic Coopératif</span>
            <i class="fa-solid fa-chevron-right card-arrow"></i>
          </div>
          <h2 class="card-title">Copropriété Bénévole</h2>
          <p class="card-desc">Lots & tantièmes, appels de fonds, fonds travaux ALUR et régularisation.</p>
        </button>
      </div>

      <!-- NOTE DE CONFORMITÉ & RASSURANCE -->
      <div class="compliance-note-box">
        <i class="fa-solid fa-shield-halved" style="color: #38bdf8; font-size: 1.05rem; flex-shrink: 0;"></i>
        <span><strong style="color: #f8fafc;">Pré-comptabilité & conformité :</strong> Chaque espace configure automatiquement votre plan comptable et vos exports dédiés.</span>
      </div>

    </div>

  {:else}
    <!-- SCREEN 2 : NOMMER LA STRUCTURE (AFFICHAGE IMMÉDIAT ET NET) -->
    <div class="welcome-card name-screen">
      
      <!-- NAVIGATION DU HAUT -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px;">
        <button 
          type="button" 
          onclick={handleBackToSelection}
          class="back-btn"
        >
          <i class="fa-solid fa-arrow-left"></i> Retour au choix du statut
        </button>
        <span class="pill-badge">
          {selectedModelObj.title}
        </span>
      </div>

      <!-- TITRE DU FORMULAIRE SELON LE STATUT -->
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 1.45rem; font-weight: 800; color: #f8fafc; margin: 0 0 6px 0; letter-spacing: -0.01em;">
          {selectedModelObj.onboardingTitle}
        </h2>
        <p style="font-size: 0.9rem; color: #94a3b8; margin: 0; line-height: 1.45;">
          {selectedModelObj.onboardingSubtitle}
        </p>
      </div>

      <!-- FORMULAIRE DE NOMMAGE & SIRET -->
      <form onsubmit={handleCreateStructure} style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- BLOC SIRET & CONTRÔLE OFFICIEL INSEE -->
        <div style="background: #161F30; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px 18px; display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 6px;">
            <label for="entity-siret-input" style="font-size: 0.88rem; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
              <span>{selectedModel === 'asso' ? 'Numéro SIRET (14 chiffres) ou RNA (W...)' : 'Numéro SIRET (14 chiffres)'}</span>
              <span style="font-size: 0.68rem; font-weight: 700; color: #94a3b8;">(Optionnel)</span>
              <span style="font-size: 0.68rem; font-weight: 800; background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25); padding: 1px 6px; border-radius: 4px;">Vérifié INSEE</span>
            </label>
            <span style="font-size: 0.74rem; color: #94a3b8;">Pré-remplissage automatique</span>
          </div>

          <div style="position: relative; display: flex; align-items: center;">
            <input 
              type="text" 
              id="entity-siret-input"
              value={siretInput}
              oninput={handleSiretInput}
              disabled={isPendingRegistration}
              placeholder={selectedModel === 'asso' ? "ex: 880 993 874 00010 ou W691234567" : "ex: 880 993 874 00010 (ou SIREN 9 chiffres)"}
              style="width: 100%; height: 46px; padding: 0 42px 0 14px; font-size: 0.95rem; font-weight: 700; color: #f8fafc; background: {isPendingRegistration ? '#111827' : '#0B121E'}; border: 1.5px solid {siretBlockReason ? '#ef4444' : siretVerificationResult?.valid ? '#10b981' : 'rgba(255, 255, 255, 0.15)'}; border-radius: 8px; box-sizing: border-box; outline: none; font-family: monospace;"
            />
            {#if isVerifyingSiret}
              <i class="fa-solid fa-spinner fa-spin" style="position: absolute; right: 14px; color: #38bdf8; font-size: 0.9rem;"></i>
            {:else if siretBlockReason}
              <i class="fa-solid fa-circle-xmark" style="position: absolute; right: 14px; color: #ef4444; font-size: 0.95rem;"></i>
            {:else if siretVerificationResult?.valid}
              <i class="fa-solid fa-circle-check" style="position: absolute; right: 14px; color: #10b981; font-size: 0.95rem;"></i>
            {/if}
          </div>

          <!-- Alerte blocage doublon anti-abus -->
          {#if siretBlockReason}
            <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 10px 12px; font-size: 0.8rem; color: #fca5a5; display: flex; align-items: flex-start; gap: 8px; line-height: 1.4;">
              <i class="fa-solid fa-triangle-exclamation" style="margin-top: 2px; flex-shrink: 0; color: #ef4444;"></i>
              <div style="flex: 1;">
                <strong style="color: #f87171;">Essai déjà utilisé :</strong> {siretBlockReason}
              </div>
            </div>
          {/if}

          <!-- Résultat officiel validé avec l'API Open-Data de l'État -->
          {#if siretVerificationResult?.valid && siretVerificationResult.company}
            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; padding: 10px 14px; display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; color: #6ee7b7;">
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                <span style="font-weight: 800; display: flex; align-items: center; gap: 6px;">
                  <i class="fa-solid fa-circle-check" style="color: #10b981;"></i>
                  Structure identifiée à l'INSEE / RNE
                </span>
                {#if siretVerificationResult.company.nom_complet && nameInput !== siretVerificationResult.company.nom_complet}
                  <button 
                    type="button" 
                    onclick={applyOfficialName}
                    style="background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #a7f3d0; padding: 3px 8px; border-radius: 5px; font-size: 0.72rem; font-weight: 700; cursor: pointer;"
                  >
                    Utiliser ce nom officiel
                  </button>
                {/if}
              </div>
              {#if siretVerificationResult.company.nom_complet}
                <div style="font-weight: 700; font-size: 0.88rem; color: #f8fafc;">
                  {siretVerificationResult.company.nom_complet}
                </div>
              {/if}
              {#if siretVerificationResult.company.adresse}
                <div style="color: #94a3b8; font-size: 0.76rem;">
                  <i class="fa-solid fa-location-dot" style="margin-right: 4px; opacity: 0.7;"></i>
                  {siretVerificationResult.company.adresse}
                </div>
              {/if}
            </div>
          {:else if siretVerificationResult && !siretVerificationResult.valid}
            <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 8px 12px; font-size: 0.78rem; color: #fcd34d; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-circle-info"></i>
              <span>{siretVerificationResult.error}</span>
            </div>
          {/if}

          <!-- Option En cours d'immatriculation -->
          <label style="display: inline-flex; align-items: center; gap: 8px; margin-top: 2px; cursor: pointer; user-select: none;">
            <input 
              type="checkbox" 
              bind:checked={isPendingRegistration}
              onchange={() => {
                if (isPendingRegistration) {
                  siretBlockReason = '';
                }
              }}
              style="width: 15px; height: 15px; accent-color: #38bdf8; cursor: pointer;"
            />
            <span style="font-size: 0.78rem; color: #94a3b8; font-weight: 600;">
              Structure en cours d'immatriculation (SIRET en attente d'attribution)
            </span>
          </label>
        </div>

        <!-- NOM DE L'ESPACE / RAISON SOCIALE -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label for="entity-name-input" style="font-size: 0.9rem; font-weight: 700; color: #f8fafc;">
            {selectedModelObj.onboardingLabel}
          </label>
          <!-- svelte-ignore a11y_autofocus -->
          <input 
            type="text" 
            id="entity-name-input"
            bind:value={nameInput}
            required
            placeholder={selectedModelObj.onboardingPlaceholder}
            class="naming-input"
          />
          <span style="font-size: 0.8rem; color: #64748b;">
            Ce nom figurera sur vos en-têtes et vos exports comptables officiels.
          </span>
        </div>

        <!-- ACTIONS -->
        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; padding-top: 18px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
          <button 
            type="button" 
            onclick={handleBackToSelection}
            class="cancel-btn"
          >
            Annuler
          </button>
          <button 
            type="submit" 
            class="confirm-btn"
            disabled={isVerifyingSiret || !!siretBlockReason}
            style="opacity: {isVerifyingSiret || !!siretBlockReason ? 0.6 : 1}; cursor: {isVerifyingSiret || !!siretBlockReason ? 'not-allowed' : 'pointer'};"
          >
            <span>Créer mon espace</span>
            <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </form>

    </div>
  {/if}

</div>

<style>
  .welcome-page-wrapper {
    min-height: 100vh;
    width: 100%;
    background: #0A0F1C;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 36px 20px;
    box-sizing: border-box;
    font-family: inherit;
  }

  .welcome-card {
    width: 100%;
    background: #0F1623;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 38px 42px 36px 42px;
    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.08);
    box-sizing: border-box;
    animation: screenFadeIn 0.18s ease-out;
  }

  .welcome-card.select-screen {
    max-width: 1040px;
  }

  .welcome-card.name-screen {
    max-width: 580px;
  }

  @keyframes screenFadeIn {
    from {
      opacity: 0;
      transform: scale(0.98) translateY(6px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .welcome-header {
    margin-bottom: 26px;
    text-align: left;
  }

  .welcome-badge {
    display: inline-block;
    color: #38bdf8;
    font-weight: 800;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 10px;
  }

  .welcome-title {
    font-size: 1.65rem;
    font-weight: 800;
    color: #f8fafc !important;
    margin: 0 0 8px 0;
    letter-spacing: -0.02em;
    line-height: 1.25;
  }

  .welcome-subtitle {
    font-size: 0.92rem;
    color: #94a3b8 !important;
    line-height: 1.5;
    margin: 0;
  }

  .models-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  @media (max-width: 768px) {
    .models-grid {
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }
    .welcome-page-wrapper {
      padding: 16px 8px;
    }
    .welcome-card {
      padding: 24px 16px;
      border-radius: 16px;
    }
    .welcome-title {
      font-size: 1.3rem !important;
    }
    .welcome-subtitle {
      font-size: 0.85rem !important;
    }
    .model-card {
      padding: 14px 16px !important;
    }
  }

  @media (max-width: 360px) {
    .welcome-page-wrapper {
      padding: 8px 4px;
    }
    .welcome-card {
      padding: 18px 12px !important;
    }
    .welcome-title {
      font-size: 1.15rem !important;
    }
    .model-card {
      padding: 12px 14px !important;
    }
    .card-title {
      font-size: 0.98rem !important;
    }
    .card-desc {
      font-size: 0.75rem !important;
    }
  }

  /* CARTES EN TANT QUE BOUTONS NATIFS POUR CLIC PARFAIT */
  .model-card {
    text-align: left;
    font-family: inherit;
    background: #161F30 !important;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 20px 22px;
    cursor: pointer;
    transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    flex-direction: column;
    user-select: none;
    position: relative;
    width: 100%;
    box-sizing: border-box;
  }

  .model-card:hover {
    border-color: rgba(56, 189, 248, 0.5) !important;
    background: #1C273D !important;
    transform: translateY(-2px);
    box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.4), 0 0 16px rgba(56, 189, 248, 0.12);
  }

  .model-card:hover .card-arrow {
    color: #38bdf8 !important;
    transform: translateX(3px);
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .card-arrow {
    color: #64748b;
    font-size: 0.85rem;
    transition: all 0.18s ease;
  }

  .pill-badge {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 5px;
    display: inline-block;
    background: rgba(56, 189, 248, 0.1) !important;
    border: 1px solid rgba(56, 189, 248, 0.22) !important;
    color: #38bdf8 !important;
    letter-spacing: 0.01em;
  }

  .card-title {
    font-size: 1.15rem;
    font-weight: 800;
    color: #f1f5f9 !important;
    margin: 0 0 6px 0;
    letter-spacing: -0.01em;
  }

  .card-desc {
    font-size: 0.84rem;
    color: #94a3b8 !important;
    margin: 0;
    line-height: 1.45;
  }

  .compliance-note-box {
    margin-top: 24px;
    padding: 12px 16px;
    background: rgba(56, 189, 248, 0.06);
    border: 1px solid rgba(56, 189, 248, 0.15);
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 0.84rem;
    color: #cbd5e1 !important;
    line-height: 1.4;
  }

  .back-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-weight: 700;
    font-size: 0.88rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    transition: color 0.15s;
  }

  .back-btn:hover {
    color: #f8fafc;
  }

  .naming-input {
    width: 100%;
    height: 52px;
    padding: 0 16px;
    font-size: 1.05rem;
    font-weight: 600;
    color: #f8fafc;
    background: #0B121E;
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    box-sizing: border-box;
    outline: none;
    transition: all 0.2s;
  }

  .naming-input:focus {
    border-color: #38bdf8;
    box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.15);
  }

  .naming-input::placeholder {
    color: #64748b;
    font-weight: 400;
  }

  .cancel-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    color: #cbd5e1;
    font-weight: 700;
    font-size: 0.9rem;
    padding: 10px 18px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #f8fafc;
  }

  .confirm-btn {
    background: #38bdf8;
    color: #070c18;
    border: none;
    border-radius: 8px;
    font-weight: 800;
    font-size: 0.9rem;
    padding: 10px 22px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.18s, transform 0.1s;
    box-shadow: 0 4px 14px rgba(56, 189, 248, 0.35);
  }

  .confirm-btn:hover {
    background: #7dd3fc;
    box-shadow: 0 6px 18px rgba(56, 189, 248, 0.45);
  }

  .confirm-btn:active {
    transform: scale(0.99);
  }
</style>
