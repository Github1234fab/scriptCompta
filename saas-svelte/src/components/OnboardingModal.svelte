<script>
  import { showCreateEntityModal, updateEntities, updateActiveEntityId, entities, showToast, MANAGEMENT_MODELS, activeView } from '../lib/store.js';
  import { currentUser } from '../lib/auth.js';
  import { saveEntityData } from '../lib/firestoreService.js';

  let nameInput = $state('');
  let selectedModel = $state('micro'); // 'micro', 'tpe', 'asso', 'bnc', 'sci', 'copro'

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

    nameInput = '';
    selectedModel = 'micro';
    $showCreateEntityModal = false;

    const modelObj = MANAGEMENT_MODELS[newEntity.model] || MANAGEMENT_MODELS.micro;
    showToast(`🎉 Espace ${modelObj.title} "${newEntity.name}" configuré avec succès !`);
  }

  function handleClose() {
    $showCreateEntityModal = false;
  }
</script>

{#if $showCreateEntityModal}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="modal-overlay active" onclick={handleClose} style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 99999; padding: 20px;">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="modal-box" onclick={(e) => e.stopPropagation()} style="max-width: 980px; width: 100%; background: #ffffff; border-radius: 20px; padding: 36px 40px; box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25); max-height: 90vh; overflow-y: auto;">
      
      <!-- HEADER -->
      <div style="margin-bottom: 24px; text-align: left; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 800; color: #2563eb; letter-spacing: 0.05em;">
            SCRIPTCOMPTA
          </span>
          <h2 style="font-size: 1.62rem; font-weight: 800; color: #0f172a; margin: 4px 0 6px 0; letter-spacing: -0.02em;">
            Choisissez votre profil de gestion
          </h2>
          <p style="font-size: 0.9rem; color: #475569; margin: 0; line-height: 1.5;">
            Sélectionnez le système adapté à votre activité. Chaque profil personnalise les registres, les déclarations et les boutons d'export.
          </p>
        </div>

        <button class="modal-close-btn" onclick={handleClose} style="background: #f1f5f9; border: none; color: #64748b; font-size: 1.2rem; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer;">&times;</button>
      </div>

      <form onsubmit={handleSubmit} style="display: flex; flex-direction: column; gap: 22px;">
        <!-- INPUT NOM PRENOM -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label for="onboarding-entity-name" style="font-size: 0.88rem; font-weight: 700; color: #0f172a;">
            Nom et prénom (nom commercial optionnel)
          </label>
          <input 
            type="text" 
            id="onboarding-entity-name"
            bind:value={nameInput} 
            required 
            placeholder="ex: Thomas Martin (TM Digital Services)" 
            style="width: 100%; padding: 11px 16px; font-size: 0.92rem; color: #0f172a; background: #ffffff; border: 1px solid #d1d5db; border-radius: 8px; box-sizing: border-box; outline: none;"
          />
        </div>

        <!-- CHOIX DU SYSTEME DE GESTION (6 METIERS) -->
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="font-size: 0.88rem; font-weight: 700; color: #0f172a;">
            Sélectionner le système de gestion (6 métiers)
          </div>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;">
            
            <!-- 1. Micro-entreprise -->
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div 
              class="model-card" 
              class:selected={selectedModel === 'micro'}
              onclick={() => selectedModel = 'micro'}
            >
              <div class="card-top">
                <span class="pill-badge pill-micro">Auto-entrepreneur</span>
                <div class="radio-indicator" class:checked={selectedModel === 'micro'}>
                  {#if selectedModel === 'micro'}
                    <svg viewBox="0 0 16 16" fill="currentColor" style="width: 12px; height: 12px;"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" /></svg>
                  {/if}
                </div>
              </div>
              <h3 class="card-title">Micro-entreprise</h3>
              <p class="card-desc">Livre des recettes, registre des achats, jauge franchise TVA (293B) & Urssaf.</p>
            </div>

            <!-- 2. Société / TPE -->
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div 
              class="model-card" 
              class:selected={selectedModel === 'tpe'}
              onclick={() => selectedModel = 'tpe'}
            >
              <div class="card-top">
                <span class="pill-badge pill-neutral">SASU, EURL, SARL, SAS</span>
                <div class="radio-indicator" class:checked={selectedModel === 'tpe'}>
                  {#if selectedModel === 'tpe'}
                    <svg viewBox="0 0 16 16" fill="currentColor" style="width: 12px; height: 12px;"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" /></svg>
                  {/if}
                </div>
              </div>
              <h3 class="card-title">Société / TPE</h3>
              <p class="card-desc">Comptabilité d'engagement, Livre-journal, Grand-livre, TVA CA3/CA12 & export FEC.</p>
            </div>

            <!-- 3. Association Loi 1901 -->
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div 
              class="model-card" 
              class:selected={selectedModel === 'asso'}
              onclick={() => selectedModel = 'asso'}
            >
              <div class="card-top">
                <span class="pill-badge pill-neutral">Club / Assos</span>
                <div class="radio-indicator" class:checked={selectedModel === 'asso'}>
                  {#if selectedModel === 'asso'}
                    <svg viewBox="0 0 16 16" fill="currentColor" style="width: 12px; height: 12px;"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" /></svg>
                  {/if}
                </div>
              </div>
              <h3 class="card-title">Association Loi 1901</h3>
              <p class="card-desc">Cotisations adhérents, subventions CERFA 15059, reçus fiscaux dons CERFA 11580.</p>
            </div>

            <!-- 4. Profession Libérale -->
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div 
              class="model-card" 
              class:selected={selectedModel === 'bnc'}
              onclick={() => selectedModel = 'bnc'}
            >
              <div class="card-top">
                <span class="pill-badge pill-neutral">Déclaration 2035 BNC</span>
                <div class="radio-indicator" class:checked={selectedModel === 'bnc'}>
                  {#if selectedModel === 'bnc'}
                    <svg viewBox="0 0 16 16" fill="currentColor" style="width: 12px; height: 12px;"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" /></svg>
                  {/if}
                </div>
              </div>
              <h3 class="card-title">Profession Libérale</h3>
              <p class="card-desc">Livre-journal BNC, barème kilométrique, amortissements & préparation liasse 2035.</p>
            </div>

            <!-- 5. SCI Familiale -->
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div 
              class="model-card" 
              class:selected={selectedModel === 'sci'}
              onclick={() => selectedModel = 'sci'}
            >
              <div class="card-top">
                <span class="pill-badge pill-neutral">Impôt sur le Revenu (IR)</span>
                <div class="radio-indicator" class:checked={selectedModel === 'sci'}>
                  {#if selectedModel === 'sci'}
                    <svg viewBox="0 0 16 16" fill="currentColor" style="width: 12px; height: 12px;"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" /></svg>
                  {/if}
                </div>
              </div>
              <h3 class="card-title">SCI Familiale</h3>
              <p class="card-desc">Gestion des loyers, quittances 1-clic, apports CCA & préparation déclaration 2072.</p>
            </div>

            <!-- 6. Copropriété Bénévole -->
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div 
              class="model-card" 
              class:selected={selectedModel === 'copro'}
              onclick={() => selectedModel = 'copro'}
            >
              <div class="card-top">
                <span class="pill-badge pill-neutral">Syndic Coopératif</span>
                <div class="radio-indicator" class:checked={selectedModel === 'copro'}>
                  {#if selectedModel === 'copro'}
                    <svg viewBox="0 0 16 16" fill="currentColor" style="width: 12px; height: 12px;"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" /></svg>
                  {/if}
                </div>
              </div>
              <h3 class="card-title">Copropriété Bénévole</h3>
              <p class="card-desc">Lots & tantièmes, appels de fonds trimestriels, fonds travaux ALUR & régul annuelle.</p>
            </div>

          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 10px;">
          <button type="button" onclick={handleClose} style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; font-weight: 700; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
            Annuler
          </button>
          <button type="submit" style="display: inline-flex; align-items: center; gap: 8px; background: #090d16; color: #ffffff; font-size: 0.88rem; font-weight: 700; padding: 10px 22px; border-radius: 8px; border: none; cursor: pointer;">
            Démarrer avec ce profil ➔
          </button>
        </div>
      </form>

    </div>
  </div>
{/if}

<style>
  .model-card {
    background: #ffffff;
    border: 1.5px solid #e2e8f0;
    border-radius: 12px;
    padding: 16px 20px 18px 20px;
    cursor: pointer;
    transition: all 0.18s ease;
    display: flex;
    flex-direction: column;
    user-select: none;
  }

  .model-card:hover {
    border-color: #cbd5e1;
    background: #fafafa;
  }

  .model-card.selected {
    border-color: #2563eb;
    background: #f8faff;
    box-shadow: 0 0 0 1px #2563eb, 0 4px 12px rgba(37, 99, 235, 0.08);
  }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .pill-badge {
    display: inline-block;
    padding: 4px 12px;
    font-size: 0.74rem;
    font-weight: 600;
    border-radius: 9999px;
    line-height: 1.2;
  }

  .pill-neutral {
    background: #e9ecef;
    color: #1e293b;
  }

  .pill-micro {
    background: #e0edff;
    color: #1d4ed8;
  }

  .radio-indicator {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.2s ease;
  }

  .radio-indicator.checked {
    background: #2563eb;
    color: #ffffff;
  }

  .card-title {
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 1.12rem;
    font-weight: 800;
    color: #0f172a;
    margin: 0 0 6px 0;
    line-height: 1.25;
    letter-spacing: -0.015em;
  }

  .card-desc {
    font-size: 0.82rem;
    color: #334155;
    line-height: 1.45;
    margin: 0;
  }
</style>
