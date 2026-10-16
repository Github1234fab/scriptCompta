<script>
  import { showCreateEntityModal, updateEntities, updateActiveEntityId, entities, showToast, MANAGEMENT_MODELS, activeView } from '../lib/store.js';
  import { currentUser } from '../lib/auth.js';
  import { saveEntityData } from '../lib/firestoreService.js';

  let step = $state(1); // 1 = Choix du métier, 2 = Nom de la structure
  let nameInput = $state('');
  let selectedModel = $state('micro');

  let selectedModelObj = $derived(MANAGEMENT_MODELS[selectedModel] || MANAGEMENT_MODELS.micro);

  /** @param {string} modelKey */
  function handleSelectStructure(modelKey) {
    selectedModel = modelKey;
    nameInput = '';
    step = 2;
  }

  function handleBack() {
    step = 1;
  }

  function handleClose() {
    step = 1;
    nameInput = '';
    $showCreateEntityModal = false;
  }

  /** @param {any} e */
  async function handleSubmit(e) {
    e.preventDefault();
    if (!nameInput.trim()) return;

    const newId = 'entity_' + Date.now();
    const newEntity = {
      id: newId,
      name: nameInput.trim(),
      model: selectedModel
    };

    updateEntities([...$entities, newEntity]);
    updateActiveEntityId(newId);
    $activeView = 'dashboard';

    if ($currentUser?.uid) {
      await saveEntityData($currentUser.uid, newId, newEntity);
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

          <!-- FORMULAIRE DE NOMMAGE -->
          <form onsubmit={handleSubmit} style="display: flex; flex-direction: column; gap: 20px;">
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
                autofocus
                placeholder={selectedModelObj.onboardingPlaceholder} 
                style="width: 100%; height: 50px; padding: 0 16px; font-size: 1rem; font-weight: 600; color: #0f172a; background: #ffffff; border: 2px solid #cbd5e1; border-radius: 10px; box-sizing: border-box; outline: none; transition: all 0.2s;"
              />
              <span style="font-size: 0.78rem; color: #94a3b8;">
                Ce nom figurera sur vos en-têtes et pourra être modifié ultérieurement.
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
                style="background: #0f172a; color: #ffffff; border: none; border-radius: 8px; font-weight: 700; font-size: 0.9rem; padding: 10px 22px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);"
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
