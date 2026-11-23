<script>
  import { showCreateEntityModal, updateEntities, updateActiveEntityId, entities, showToast, MANAGEMENT_MODELS, activeView, isPremium, showUpgradeModal } from '../lib/store.js';
  import { currentUser } from '../lib/auth.js';
  import { saveEntityData } from '../lib/firestoreService.js';
  import { 
    formatSiretDisplay, 
    cleanSiret, 
    verifySiretApi, 
    checkSiretTrialAvailability, 
    registerSiretUsage 
  } from '../lib/siretService.js';

  let step = $state(1); // 1 = Choix du métier, 2 = Nom de la structure
  let nameInput = $state('');
  let siretInput = $state('');
  let isPendingRegistration = $state(false);
  let isVerifyingSiret = $state(false);
  let siretVerificationResult = $state(null);
  let siretBlockReason = $state('');
  let selectedModel = $state('micro');

  let selectedModelObj = $derived(MANAGEMENT_MODELS[selectedModel] || MANAGEMENT_MODELS.micro);

  /** @param {string} modelKey */
  function handleSelectStructure(modelKey) {
    selectedModel = modelKey;
    nameInput = '';
    siretInput = '';
    siretVerificationResult = null;
    siretBlockReason = '';
    isPendingRegistration = false;
    step = 2;
  }

  function handleBack() {
    step = 1;
  }

  function handleClose() {
    step = 1;
    nameInput = '';
    siretInput = '';
    siretVerificationResult = null;
    siretBlockReason = '';
    isPendingRegistration = false;
    $showCreateEntityModal = false;
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

    if (cleaned.length === 14 || (cleaned.length === 9 && !cleaned.startsWith('W')) || (cleaned.startsWith('W') && cleaned.length === 10)) {
      isVerifyingSiret = true;

      // 1. Contrôle anti-abus d'unicité Firestore
      const availability = await checkSiretTrialAvailability(cleaned, $currentUser?.uid, $isPremium);
      if (!availability.allowed) {
        isVerifyingSiret = false;
        siretBlockReason = availability.reason || "Ce numéro SIRET a déjà bénéficié d'un essai gratuit.";
        return;
      }

      // 2. Vérification auprès de l'API officielle
      const apiCheck = await verifySiretApi(cleaned);
      isVerifyingSiret = false;
      siretVerificationResult = apiCheck;

      if (apiCheck.valid && apiCheck.company?.nom_complet) {
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
  async function handleSubmit(e) {
    e.preventDefault();
    if (!nameInput.trim()) return;

    const cleanedSiret = cleanSiret(siretInput);

    // Validation du SIRET si l'utilisateur l'a renseigné
    if (cleanedSiret) {
      if (siretBlockReason) {
        showToast(siretBlockReason);
        showUpgradeModal.set(true);
        return;
      }

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
    $activeView = 'dashboard';

    if ($currentUser?.uid) {
      await saveEntityData($currentUser.uid, newId, newEntity);
      if (cleanedSiret) {
        await registerSiretUsage(cleanedSiret, $currentUser.uid, newEntity);
      }
    }

    handleClose();
    const modelObj = MANAGEMENT_MODELS[newEntity.model] || MANAGEMENT_MODELS.micro;
    showToast(`Espace ${modelObj.title} "${newEntity.name}" configuré avec succès !`);
  }
</script>

{#if $showCreateEntityModal}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="modal-overlay active" onclick={handleClose}>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div 
      class="modal-box" 
      onclick={(e) => e.stopPropagation()} 
      style="max-width: {step === 1 ? '980px' : '560px'};"
    >
      
      {#if step === 1}
        <!-- ÉCRAN 1 : CHOIX DIRECT DU STATUT (AUCUN BOUTON EN BAS) -->
        <div class="onboarding-header">
          <div>
            <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 800; color: #38bdf8; letter-spacing: 0.08em; display: inline-block; margin-bottom: 6px;">
              TITO • NOUVELLE STRUCTURE
            </span>
            <h2 class="onboarding-main-title">
              Choisissez votre profil de gestion
            </h2>
            <p class="onboarding-subtitle">
              Cliquez sur le statut de cette nouvelle structure pour créer un espace comptable entièrement isolé.
            </p>
          </div>

          <button class="modal-close-btn" onclick={handleClose} aria-label="Fermer" title="Fermer">&times;</button>
        </div>

        <!-- GRILLE DES 6 METIERS (CLIC DIRECT) -->
        <div class="models-grid">
          
          <!-- 1. Micro-entreprise -->
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div 
            class="model-card" 
            onclick={() => handleSelectStructure('micro')}
          >
            <div class="card-top">
              <span class="pill-badge">Auto-entrepreneur</span>
              <i class="fa-solid fa-chevron-right card-arrow"></i>
            </div>
            <h3 class="card-title">Micro-entreprise</h3>
            <p class="card-desc">Livre des recettes, registre des achats, jauge franchise TVA (293B) & Urssaf.</p>
          </div>

          <!-- 2. Société / TPE -->
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div 
            class="model-card" 
            onclick={() => handleSelectStructure('tpe')}
          >
            <div class="card-top">
              <span class="pill-badge">SASU, EURL, SARL, SAS</span>
              <i class="fa-solid fa-chevron-right card-arrow"></i>
            </div>
            <h3 class="card-title">Société / TPE</h3>
            <p class="card-desc">Comptabilité d'engagement, Livre-journal, Grand-livre, TVA CA3/CA12 & export FEC.</p>
          </div>

          <!-- 3. Association Loi 1901 -->
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div 
            class="model-card" 
            onclick={() => handleSelectStructure('asso')}
          >
            <div class="card-top">
              <span class="pill-badge">Club / Assos</span>
              <i class="fa-solid fa-chevron-right card-arrow"></i>
            </div>
            <h3 class="card-title">Association Loi 1901</h3>
            <p class="card-desc">Cotisations adhérents, subventions CERFA 15059, reçus fiscaux dons CERFA 11580.</p>
          </div>

          <!-- 4. Profession Libérale -->
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div 
            class="model-card" 
            onclick={() => handleSelectStructure('bnc')}
          >
            <div class="card-top">
              <span class="pill-badge">Déclaration 2035 BNC</span>
              <i class="fa-solid fa-chevron-right card-arrow"></i>
            </div>
            <h3 class="card-title">Profession Libérale</h3>
            <p class="card-desc">Livre-journal BNC, barème kilométrique, amortissements & préparation liasse 2035.</p>
          </div>

          <!-- 5. SCI Familiale -->
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div 
            class="model-card" 
            onclick={() => handleSelectStructure('sci')}
          >
            <div class="card-top">
              <span class="pill-badge">Impôt sur le Revenu (IR)</span>
              <i class="fa-solid fa-chevron-right card-arrow"></i>
            </div>
            <h3 class="card-title">SCI Familiale</h3>
            <p class="card-desc">Gestion des loyers, quittances 1-clic, apports CCA & préparation déclaration 2072.</p>
          </div>

          <!-- 6. Copropriété Bénévole -->
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div 
            class="model-card" 
            onclick={() => handleSelectStructure('copro')}
          >
            <div class="card-top">
              <span class="pill-badge">Syndic Coopératif</span>
              <i class="fa-solid fa-chevron-right card-arrow"></i>
            </div>
            <h3 class="card-title">Copropriété Bénévole</h3>
            <p class="card-desc">Lots & tantièmes, appels de fonds trimestriels, fonds travaux ALUR & régul annuelle.</p>
          </div>

        </div>

        <!-- NOTE DE CONFORMITÉ & RASSURANCE EN PIED DE MODALE -->
        <div class="compliance-note-box">
          <i class="fa-solid fa-shield-halved" style="color: #38bdf8; font-size: 1.05rem; flex-shrink: 0;"></i>
          <span><strong style="color: #f8fafc;">Pré-comptabilité & conformité :</strong> Chaque profil configure automatiquement votre plan comptable officiel, vos registres légaux et vos exports dédiés.</span>
        </div>

      {:else}
        <!-- ÉCRAN 2 : NOM DE LA STRUCTURE -->
        <div>
          <!-- EN-TÊTE NAVIGATION -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <button 
              type="button" 
              onclick={handleBack} 
              style="background: transparent; border: none; color: #94a3b8; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 0; transition: color 0.15s;"
            >
              <i class="fa-solid fa-arrow-left"></i> Changer de statut
            </button>
            <span class="pill-badge">
              {selectedModelObj.title}
            </span>
          </div>

          <!-- INTITULÉ DU MÉTIER -->
          <div style="margin-bottom: 22px;">
            <h2 style="font-size: 1.35rem; font-weight: 800; color: #f8fafc !important; margin: 0 0 6px 0; letter-spacing: -0.01em;">
              {selectedModelObj.onboardingTitle}
            </h2>
            <p style="font-size: 0.88rem; color: #94a3b8 !important; margin: 0; line-height: 1.45;">
              {selectedModelObj.onboardingSubtitle}
            </p>
          </div>

          <!-- FORMULAIRE DE NOMMAGE & SIRET -->
          <form onsubmit={handleSubmit} style="display: flex; flex-direction: column; gap: 20px;">
            
            <!-- BLOC SIRET & CONTRÔLE OFFICIEL INSEE -->
            <div style="background: #161F30; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px 18px; display: flex; flex-direction: column; gap: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 6px;">
                <label for="modal-entity-siret" style="font-size: 0.88rem; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
                  <span>{selectedModel === 'asso' ? 'Numéro SIRET (14 chiffres) ou RNA (W...)' : 'Numéro SIRET (14 chiffres)'}</span>
                  <span style="font-size: 0.68rem; font-weight: 700; color: #94a3b8;">(Optionnel)</span>
                  <span style="font-size: 0.68rem; font-weight: 800; background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25); padding: 1px 6px; border-radius: 4px;">Vérifié INSEE</span>
                </label>
                <span style="font-size: 0.74rem; color: #94a3b8;">Pré-remplissage automatique</span>
              </div>

              <div style="position: relative; display: flex; align-items: center;">
                <input 
                  type="text" 
                  id="modal-entity-siret"
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
              <label for="modal-entity-name" style="font-size: 0.88rem; font-weight: 700; color: #f8fafc;">
                {selectedModelObj.onboardingLabel}
              </label>
              <!-- svelte-ignore a11y_autofocus -->
              <input 
                type="text" 
                id="modal-entity-name"
                bind:value={nameInput} 
                required 
                placeholder={selectedModelObj.onboardingPlaceholder} 
                style="width: 100%; height: 48px; padding: 0 16px; font-size: 0.95rem; font-weight: 600; color: #f8fafc; background: #0B121E; border: 1.5px solid rgba(255, 255, 255, 0.15); border-radius: 8px; box-sizing: border-box; outline: none; transition: all 0.2s;"
              />
              <span style="font-size: 0.78rem; color: #64748b;">
                Ce nom figurera sur vos en-têtes et vos exports comptables officiels.
              </span>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 10px; padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
              <button 
                type="button" 
                onclick={handleBack} 
                style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; color: #cbd5e1; font-weight: 700; font-size: 0.9rem; padding: 10px 18px; cursor: pointer; transition: all 0.15s;"
              >
                Retour
              </button>
              <button 
                type="submit" 
                disabled={isVerifyingSiret || !!siretBlockReason}
                style="background: #38bdf8; color: #070c18; border: none; border-radius: 8px; font-weight: 800; font-size: 0.9rem; padding: 10px 22px; cursor: {isVerifyingSiret || !!siretBlockReason ? 'not-allowed' : 'pointer'}; opacity: {isVerifyingSiret || !!siretBlockReason ? 0.6 : 1}; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 14px rgba(56, 189, 248, 0.35);"
              >
                <span>Créer cette structure</span>
                <i class="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </form>
        </div>
      {/if}

    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(7, 12, 24, 0.85);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    padding: 20px;
    box-sizing: border-box;
  }

  .modal-box {
    width: 100%;
    background: #0F1623;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    padding: 32px 34px;
    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.08);
    max-height: 90vh;
    overflow-y: auto;
    transition: max-width 0.2s ease;
    box-sizing: border-box;
    color: #f8fafc !important;
  }

  .onboarding-header {
    margin-bottom: 24px;
    text-align: left;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .onboarding-main-title {
    font-size: 1.6rem;
    font-weight: 800;
    color: #f8fafc !important;
    margin: 4px 0 6px 0;
    letter-spacing: -0.02em;
    line-height: 1.25;
  }

  .onboarding-subtitle {
    font-size: 0.92rem;
    color: #94a3b8 !important;
    margin: 0;
    line-height: 1.45;
  }

  .modal-close-btn {
    background: none;
    border: none;
    font-size: 1.6rem;
    color: #64748b;
    cursor: pointer;
    line-height: 1;
    padding: 2px 6px;
    border-radius: 6px;
    transition: color 0.15s ease;
    flex-shrink: 0;
  }

  .modal-close-btn:hover {
    color: #f8fafc;
  }

  .models-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }

  .model-card {
    background: #161F30 !important;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 20px 22px;
    cursor: pointer;
    transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    flex-direction: column;
    user-select: none;
    box-sizing: border-box;
    text-align: left;
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

  /* Badge unifié monochrome / bleu Tito haute lisibilité */
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
    white-space: nowrap;
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

  /* Bandeau d'information bas fondu dans la modale */
  .compliance-note-box {
    margin-top: 20px;
    padding: 12px 16px;
    background: rgba(56, 189, 248, 0.06);
    border: 1px solid rgba(56, 189, 248, 0.15);
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 0.82rem;
    color: #cbd5e1 !important;
    line-height: 1.4;
  }

  /* ═══════════════════════════════════════════════════════════════════
     ADAPTATION RESPONSIVE MOBILE (SMARTPHONES & MOBILE S 320PX-380PX)
     ═══════════════════════════════════════════════════════════════════ */
  @media (max-width: 680px) {
    .modal-overlay {
      padding: 12px 8px;
    }

    .modal-box {
      padding: 20px 16px !important;
      border-radius: 16px !important;
      max-height: 94vh !important;
    }

    .onboarding-header {
      margin-bottom: 16px;
    }

    .onboarding-main-title {
      font-size: 1.25rem !important;
      margin: 2px 0 4px 0 !important;
    }

    .onboarding-subtitle {
      font-size: 0.82rem !important;
      line-height: 1.35 !important;
    }

    /* Grille en 1 seule colonne pleine largeur sur mobile */
    .models-grid {
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }

    .model-card {
      padding: 14px 16px !important;
      border-radius: 12px !important;
    }

    .card-top {
      margin-bottom: 8px !important;
    }

    .card-title {
      font-size: 1.05rem !important;
      margin-bottom: 4px !important;
    }

    .card-desc {
      font-size: 0.79rem !important;
      line-height: 1.35 !important;
    }

    .compliance-note-box {
      margin-top: 14px !important;
      padding: 10px 12px !important;
      font-size: 0.78rem !important;
      gap: 10px !important;
    }
  }

  /* Mobile S spécifique (écrans ultra étroits < 360px comme iPhone SE / Galaxy Fold) */
  @media (max-width: 360px) {
    .modal-overlay {
      padding: 8px 4px;
    }

    .modal-box {
      padding: 16px 12px !important;
    }

    .onboarding-main-title {
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

    .pill-badge {
      font-size: 0.68rem !important;
      padding: 2px 6px !important;
    }
  }
</style>
