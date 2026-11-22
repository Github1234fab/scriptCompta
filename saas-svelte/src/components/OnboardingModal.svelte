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
  <div class="modal-overlay active" onclick={handleClose} style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 99999; padding: 20px;">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div 
      class="modal-box" 
      onclick={(e) => e.stopPropagation()} 
      style="max-width: {step === 1 ? '980px' : '560px'}; width: 100%; background: #ffffff; border-radius: 18px; padding: 32px 34px; box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.35); max-height: 90vh; overflow-y: auto; transition: max-width 0.2s ease;"
    >
      
      {#if step === 1}
        <!-- ÉCRAN 1 : CHOIX DIRECT DU STATUT (AUCUN BOUTON EN BAS) -->
        <div style="margin-bottom: 24px; text-align: left; display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 800; color: #2563eb; letter-spacing: 0.05em;">
              SCRIPTCOMPTA • NOUVELLE STRUCTURE
            </span>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 4px 0 6px 0; letter-spacing: -0.02em;">
              Choisissez votre profil de gestion
            </h2>
            <p style="font-size: 0.88rem; color: #475569; margin: 0; line-height: 1.5;">
              Cliquez sur le statut de cette nouvelle structure pour créer un espace comptable entièrement isolé.
            </p>
          </div>

          <button class="modal-close-btn" onclick={handleClose} style="background: #f1f5f9; border: none; color: #64748b; font-size: 1.2rem; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer;">&times;</button>
        </div>

        <!-- GRILLE DES 6 METIERS (CLIC DIRECT) -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;">
          
          <!-- 1. Micro-entreprise -->
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div 
            class="model-card" 
            onclick={() => handleSelectStructure('micro')}
          >
            <div class="card-top">
              <span class="pill-badge pill-blue">Auto-entrepreneur</span>
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
              <span class="pill-badge pill-neutral">SASU, EURL, SARL, SAS</span>
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
              <span class="pill-badge pill-neutral">Club / Assos</span>
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
              <span class="pill-badge pill-neutral">Déclaration 2035 BNC</span>
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
              <span class="pill-badge pill-neutral">Impôt sur le Revenu (IR)</span>
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
              <span class="pill-badge pill-neutral">Syndic Coopératif</span>
              <i class="fa-solid fa-chevron-right card-arrow"></i>
            </div>
            <h3 class="card-title">Copropriété Bénévole</h3>
            <p class="card-desc">Lots & tantièmes, appels de fonds trimestriels, fonds travaux ALUR & régul annuelle.</p>
          </div>

        </div>

      {:else}
        <!-- ÉCRAN 2 : NOM DE LA STRUCTURE -->
        <div>
          <!-- EN-TÊTE NAVIGATION -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <button 
              type="button" 
              onclick={handleBack} 
              style="background: transparent; border: none; color: #64748b; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 0;"
            >
              <i class="fa-solid fa-arrow-left"></i> Changer de statut
            </button>
            <span class="pill-badge pill-blue">
              {selectedModelObj.title}
            </span>
          </div>

          <!-- INTITULÉ DU MÉTIER -->
          <div style="margin-bottom: 22px;">
            <h2 style="font-size: 1.35rem; font-weight: 800; color: #0f172a; margin: 0 0 6px 0; letter-spacing: -0.01em;">
              {selectedModelObj.onboardingTitle}
            </h2>
            <p style="font-size: 0.88rem; color: #64748b; margin: 0; line-height: 1.45;">
              {selectedModelObj.onboardingSubtitle}
            </p>
          </div>

          <!-- FORMULAIRE DE NOMMAGE & SIRET -->
          <form onsubmit={handleSubmit} style="display: flex; flex-direction: column; gap: 20px;">
            
            <!-- BLOC SIRET & CONTRÔLE OFFICIEL INSEE -->
            <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 16px 18px; display: flex; flex-direction: column; gap: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 6px;">
                <label for="modal-entity-siret" style="font-size: 0.88rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                  <span>{selectedModel === 'asso' ? 'Numéro SIRET (14 chiffres) ou RNA (W...)' : 'Numéro SIRET (14 chiffres)'}</span>
                  <span style="font-size: 0.68rem; font-weight: 700; color: #64748b;">(Optionnel)</span>
                  <span style="font-size: 0.68rem; font-weight: 800; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 1px 6px; border-radius: 4px;">Vérifié INSEE</span>
                </label>
                <span style="font-size: 0.74rem; color: #64748b;">Pré-remplissage automatique</span>
              </div>

              <div style="position: relative; display: flex; align-items: center;">
                <input 
                  type="text" 
                  id="modal-entity-siret"
                  value={siretInput}
                  oninput={handleSiretInput}
                  disabled={isPendingRegistration}
                  placeholder={selectedModel === 'asso' ? "ex: 880 993 874 00010 ou W691234567" : "ex: 880 993 874 00010 (ou SIREN 9 chiffres)"}
                  style="width: 100%; height: 46px; padding: 0 42px 0 14px; font-size: 0.95rem; font-weight: 700; color: #0f172a; background: {isPendingRegistration ? '#f1f5f9' : '#ffffff'}; border: 1.5px solid {siretBlockReason ? '#ef4444' : siretVerificationResult?.valid ? '#10b981' : '#cbd5e1'}; border-radius: 8px; box-sizing: border-box; outline: none; font-family: monospace;"
                />
                {#if isVerifyingSiret}
                  <i class="fa-solid fa-spinner fa-spin" style="position: absolute; right: 14px; color: #2563eb; font-size: 0.9rem;"></i>
                {:else if siretBlockReason}
                  <i class="fa-solid fa-circle-xmark" style="position: absolute; right: 14px; color: #ef4444; font-size: 0.95rem;"></i>
                {:else if siretVerificationResult?.valid}
                  <i class="fa-solid fa-circle-check" style="position: absolute; right: 14px; color: #10b981; font-size: 0.95rem;"></i>
                {/if}
              </div>

              <!-- Alerte blocage doublon anti-abus -->
              {#if siretBlockReason}
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 12px; font-size: 0.8rem; color: #991b1b; display: flex; align-items: flex-start; gap: 8px; line-height: 1.4;">
                  <i class="fa-solid fa-triangle-exclamation" style="margin-top: 2px; flex-shrink: 0;"></i>
                  <div style="flex: 1;">
                    <strong>Essai déjà utilisé :</strong> {siretBlockReason}
                  </div>
                </div>
              {/if}

              <!-- Résultat officiel validé avec l'API Open-Data de l'État -->
              {#if siretVerificationResult?.valid && siretVerificationResult.company}
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; color: #166534;">
                  <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                    <span style="font-weight: 800; display: flex; align-items: center; gap: 6px;">
                      <i class="fa-solid fa-circle-check" style="color: #10b981;"></i>
                      Structure identifiée à l'INSEE / RNE
                    </span>
                    {#if siretVerificationResult.company.nom_complet && nameInput !== siretVerificationResult.company.nom_complet}
                      <button 
                        type="button" 
                        onclick={applyOfficialName}
                        style="background: #ffffff; border: 1px solid #86efac; color: #15803d; padding: 3px 8px; border-radius: 5px; font-size: 0.72rem; font-weight: 700; cursor: pointer;"
                      >
                        Utiliser ce nom officiel
                      </button>
                    {/if}
                  </div>
                  {#if siretVerificationResult.company.nom_complet}
                    <div style="font-weight: 700; font-size: 0.88rem; color: #0f172a;">
                      {siretVerificationResult.company.nom_complet}
                    </div>
                  {/if}
                  {#if siretVerificationResult.company.adresse}
                    <div style="color: #4b5563; font-size: 0.76rem;">
                      <i class="fa-solid fa-location-dot" style="margin-right: 4px; opacity: 0.7;"></i>
                      {siretVerificationResult.company.adresse}
                    </div>
                  {/if}
                </div>
              {:else if siretVerificationResult && !siretVerificationResult.valid}
                <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 8px 12px; font-size: 0.78rem; color: #9a3412; display: flex; align-items: center; gap: 8px;">
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
                  style="width: 15px; height: 15px; accent-color: #2563eb; cursor: pointer;"
                />
                <span style="font-size: 0.78rem; color: #64748b; font-weight: 600;">
                  Structure en cours d'immatriculation (SIRET en attente d'attribution)
                </span>
              </label>
            </div>

            <!-- NOM DE L'ESPACE / RAISON SOCIALE -->
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <label for="modal-entity-name" style="font-size: 0.88rem; font-weight: 700; color: #0f172a;">
                {selectedModelObj.onboardingLabel}
              </label>
              <!-- svelte-ignore a11y_autofocus -->
              <input 
                type="text" 
                id="modal-entity-name"
                bind:value={nameInput} 
                required 
                placeholder={selectedModelObj.onboardingPlaceholder} 
                style="width: 100%; height: 48px; padding: 0 16px; font-size: 0.95rem; font-weight: 600; color: #0f172a; background: #ffffff; border: 2px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; outline: none; transition: all 0.2s;"
              />
              <span style="font-size: 0.78rem; color: #94a3b8;">
                Ce nom figurera sur vos en-têtes et vos exports comptables officiels.
              </span>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 10px; padding-top: 16px; border-top: 1px solid #f1f5f9;">
              <button 
                type="button" 
                onclick={handleBack} 
                style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; color: #475569; font-weight: 700; font-size: 0.9rem; padding: 10px 18px; cursor: pointer;"
              >
                Retour
              </button>
              <button 
                type="submit" 
                disabled={isVerifyingSiret || !!siretBlockReason}
                style="background: #0f172a; color: #ffffff; border: none; border-radius: 8px; font-weight: 700; font-size: 0.9rem; padding: 10px 22px; cursor: {isVerifyingSiret || !!siretBlockReason ? 'not-allowed' : 'pointer'}; opacity: {isVerifyingSiret || !!siretBlockReason ? 0.6 : 1}; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);"
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
  .model-card {
    background: #ffffff;
    border: 1.5px solid #e2e8f0;
    border-radius: 14px;
    padding: 20px 22px;
    cursor: pointer;
    transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    flex-direction: column;
    user-select: none;
  }

  .model-card:hover {
    border-color: #2563eb;
    background: #f8faff;
    transform: translateY(-2px);
    box-shadow: 0 8px 20px -6px rgba(37, 99, 235, 0.15);
  }

  .model-card:hover .card-arrow {
    color: #2563eb;
    transform: translateX(3px);
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .card-arrow {
    color: #94a3b8;
    font-size: 0.85rem;
    transition: all 0.18s ease;
  }

  .pill-badge {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 4px;
    display: inline-block;
  }

  .pill-blue {
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
  }

  .pill-neutral {
    background: #f1f5f9;
    color: #475569;
  }

  .card-title {
    font-size: 1.1rem;
    font-weight: 800;
    color: #0f172a;
    margin: 0 0 6px 0;
  }

  .card-desc {
    font-size: 0.82rem;
    color: #64748b;
    margin: 0;
    line-height: 1.45;
  }
</style>
