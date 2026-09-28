<script>
  import { showCreateEntityModal, updateEntities, updateActiveEntityId, entities, showToast, MANAGEMENT_MODELS } from '../lib/store.js';

  let nameInput = $state('');
  let selectedModel = $state('micro'); // 'micro', 'tpe', 'asso', 'bnc', 'sci', 'copro'

  let isFirstLaunch = $derived($entities.length === 0);

  /** @param {any} e */
  function handleSubmit(e) {
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

    nameInput = '';
    selectedModel = 'micro';
    $showCreateEntityModal = false;

    const modelObj = MANAGEMENT_MODELS[newEntity.model] || MANAGEMENT_MODELS.micro;
    showToast(`🎉 Espace ${modelObj.title} "${newEntity.name}" configuré avec succès !`);
  }

  function handleClose() {
    if (!isFirstLaunch) {
      $showCreateEntityModal = false;
    }
  }
</script>

{#if $showCreateEntityModal}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="modal-overlay active" onclick={handleClose} style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 99999; padding: 20px;">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="modal-box" onclick={(e) => e.stopPropagation()} style="max-width: 820px; width: 100%; background: #ffffff; border: 1px solid var(--border-color); border-radius: 16px; padding: 32px; box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25); max-height: 90vh; overflow-y: auto;">
      
      <!-- Dynamic Header -->
      <div style="margin-bottom: 24px; text-align: left; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <span style="font-size: 0.76rem; text-transform: uppercase; font-weight: 800; color: #2563eb; letter-spacing: 0.06em;">
            {isFirstLaunch ? '👋 BIENVENUE SUR SCRIPTCOMPTA' : '➕ NOUVELLE GESTION'}
          </span>
          <h2 style="font-family: var(--font-title); font-size: 1.65rem; font-weight: 800; color: #0f172a; margin-top: 4px; margin-bottom: 6px;">
            {isFirstLaunch ? 'Bienvenue ! Choisissez votre profil de gestion' : 'Ajouter une nouvelle gestion'}
          </h2>
          <p style="font-size: 0.88rem; color: #64748b; margin: 0;">
            {isFirstLaunch ? 'Sélectionnez le système adapté à votre activité. Chaque profil personnalise les registres, les déclarations et les boutons d’export.' : 'Ajoutez une nouvelle structure (association, société, SCI, libéral, etc.) à votre compte.'}
          </p>
        </div>

        {#if !isFirstLaunch}
          <button class="modal-close-btn" onclick={handleClose} style="background: #f1f5f9; border: none; color: #64748b; font-size: 1.2rem; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer;">&times;</button>
        {/if}
      </div>

      <form onsubmit={handleSubmit}>
        <!-- Input Nom de la structure -->
        <div class="form-group" style="margin-bottom: 24px;">
          <label for="onboarding-name" class="form-label" style="font-size: 0.9rem; font-weight: 700; color: #0f172a; display: block; margin-bottom: 6px;">
            {MANAGEMENT_MODELS[selectedModel]?.onboardingLabel || "Nom de la structure / du dossier"}
          </label>
          <input 
            type="text" 
            id="onboarding-name" 
            class="form-control" 
            bind:value={nameInput} 
            required 
            placeholder={MANAGEMENT_MODELS[selectedModel]?.onboardingPlaceholder || "ex: Cabinet Médical, SCI Les Marronniers, EURL Horizon..."} 
            style="width: 100%; padding: 12px 16px; font-size: 0.95rem; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; color: #0f172a; font-weight: 600; outline: none; box-sizing: border-box;"
          />
        </div>

        <!-- Choix du modèle de gestion (6 cartes) -->
        <label for="onboarding-model-grid" class="form-label" style="font-size: 0.9rem; font-weight: 700; color: #0f172a; margin-bottom: 12px; display: block;">
          Sélectionner le système de gestion (6 métiers)
        </label>

        <div id="onboarding-model-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; margin-bottom: 32px;">
          
          {#each Object.values(MANAGEMENT_MODELS) as item}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div 
              onclick={() => selectedModel = item.id}
              style="padding: 22px; min-height: 150px; border-radius: 14px; border: {selectedModel === item.id ? `2.5px solid ${item.accentColor}` : `1.5px solid ${item.accentColor}35`}; background: {selectedModel === item.id ? `${item.accentBg}` : '#ffffff'}; box-shadow: {selectedModel === item.id ? `0 12px 28px -5px ${item.accentColor}30, 0 4px 6px -2px ${item.accentColor}15` : `0 2px 8px ${item.accentColor}10`}; cursor: pointer; transition: all 0.22s ease-in-out; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; transform: {selectedModel === item.id ? 'translateY(-2px)' : 'none'};"
            >
              <!-- Always-visible top accent strip -->
              <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: {item.accentColor};"></div>

              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; margin-top: 4px;">
                  <span style="font-size: 0.72rem; font-weight: 800; padding: 4px 10px; border-radius: 20px; background: {item.accentColor}18; color: {item.accentColor}; border: 1px solid {item.accentColor}40; letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80%;">
                    {item.badge}
                  </span>
                  <span style="width: 22px; height: 22px; border-radius: 50%; background: {selectedModel === item.id ? item.accentColor : '#e2e8f0'}; color: {selectedModel === item.id ? '#ffffff' : '#94a3b8'}; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; transition: all 0.2s; flex-shrink: 0;">
                    {selectedModel === item.id ? '✓' : ''}
                  </span>
                </div>
                <h4 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0 0 8px 0; font-family: var(--font-title);">{item.title}</h4>
                <p style="font-size: 0.82rem; color: #475569; line-height: 1.45; margin: 0; font-weight: 500;">
                  {item.desc}
                </p>
              </div>
            </div>
          {/each}

        </div>

        <div style="display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          {#if !isFirstLaunch}
            <button type="button" class="btn btn-secondary" onclick={handleClose} style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; font-weight: 700; padding: 10px 20px; border-radius: 8px; cursor: pointer;">Annuler</button>
          {/if}
          <button type="submit" class="btn btn-primary" style="padding: 10px 24px; font-weight: 700; font-size: 0.92rem; background: #0f172a; color: #ffffff; border: none; border-radius: 8px; cursor: pointer;">
            {isFirstLaunch ? 'Démarrer avec ce profil ➔' : 'Créer cette gestion ➔'}
          </button>
        </div>
      </form>

    </div>
  </div>
{/if}
