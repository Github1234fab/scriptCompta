<script>
  import { showCreateEntityModal, updateEntities, updateActiveEntityId, entities, showToast } from '../lib/store.js';

  let nameInput = $state('');
  let selectedModel = $state('micro'); // 'micro', 'tpe', 'asso'

  let isFirstLaunch = $derived($entities.length === 0);

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

    const labels = {
      micro: 'Micro-entreprise',
      tpe: 'Société / TPE',
      asso: 'Association Loi 1901'
    };
    showToast(`🎉 Espace ${labels[newEntity.model]} "${newEntity.name}" configuré avec succès.`);
  }

  function handleClose() {
    if (!isFirstLaunch) {
      $showCreateEntityModal = false;
    }
  }
</script>

{#if $showCreateEntityModal || isFirstLaunch}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="modal-overlay active" onclick={handleClose}>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="modal-box" onclick={(e) => e.stopPropagation()} style="max-width: 620px; background: #11131e; border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 32px; box-shadow: 0 25px 60px rgba(0,0,0,0.75);">
      
      <!-- Dynamic Header -->
      <div style="margin-bottom: 24px; text-align: left; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <span style="font-size: 0.78rem; text-transform: uppercase; font-weight: 700; color: var(--color-primary-light); letter-spacing: 0.06em;">
            {isFirstLaunch ? '👋 BIENVENUE SUR COMPTASIMPLES' : '➕ NOUVELLE GESTION'}
          </span>
          <h2 style="font-family: var(--font-title); font-size: 1.6rem; color: white; margin-top: 6px; margin-bottom: 6px;">
            {isFirstLaunch ? 'Bienvenue ! Configurons votre espace' : 'Ajouter une nouvelle gestion'}
          </h2>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">
            {isFirstLaunch ? 'Personnalisez votre interface de gestion sur-mesure en 2 étapes rapides.' : 'Ajoutez une seconde structure (micro, société ou association) à votre espace.'}
          </p>
        </div>

        {#if !isFirstLaunch}
          <button class="modal-close-btn" onclick={handleClose} style="background: transparent; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer;">&times;</button>
        {/if}
      </div>

      <form onsubmit={handleSubmit}>
        <!-- Input Nom de la structure -->
        <div class="form-group" style="margin-bottom: 24px;">
          <label for="onboarding-name" class="form-label" style="font-size: 0.92rem; font-weight: 600; color: white;">
            Nom de l'association / structure
          </label>
          <input 
            type="text" 
            id="onboarding-name" 
            class="form-control" 
            bind:value={nameInput} 
            required 
            placeholder="ex: Club d'Échecs de Paris, Studio Design, SARL Dupont..." 
            style="padding: 12px 16px; font-size: 0.98rem; background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.12);"
          />
          <p style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 8px; line-height: 1.4;">
            💡 Vous pouvez choisir le nom exact de votre structure ou le nom qui vous convient. Aucun impact juridique, c'est pour votre gestion personnelle.
          </p>
        </div>

        <!-- Choix du modèle de gestion -->
        <label for="onboarding-model-cards" class="form-label" style="font-size: 0.92rem; font-weight: 600; color: white; margin-bottom: 12px; display: block;">
          Choisir un modèle de gestion
        </label>

        <div id="onboarding-model-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(165px, 1fr)); gap: 14px; margin-bottom: 30px;">
          
          <!-- Option 1 : Micro -->
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div 
            onclick={() => selectedModel = 'micro'}
            style="padding: 16px; border-radius: var(--radius-md); border: 2px solid {selectedModel === 'micro' ? '#34d399' : 'rgba(255,255,255,0.08)'}; background: {selectedModel === 'micro' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.02)'}; cursor: pointer; transition: all 0.2s;"
          >
            <div style="font-size: 1.7rem; margin-bottom: 8px;">🚀</div>
            <h4 style="font-size: 0.95rem; font-weight: 700; color: white; margin-bottom: 4px;">Micro-entreprise</h4>
            <p style="font-size: 0.76rem; color: var(--text-secondary); line-height: 1.3;">
              Freelance, consultant, artisan. Encaissement CA & Livre des recettes.
            </p>
          </div>

          <!-- Option 2 : TPE -->
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div 
            onclick={() => selectedModel = 'tpe'}
            style="padding: 16px; border-radius: var(--radius-md); border: 2px solid {selectedModel === 'tpe' ? '#38bdf8' : 'rgba(255,255,255,0.08)'}; background: {selectedModel === 'tpe' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255,255,255,0.02)'}; cursor: pointer; transition: all 0.2s;"
          >
            <div style="font-size: 1.7rem; margin-bottom: 8px;">🏢</div>
            <h4 style="font-size: 0.95rem; font-weight: 700; color: white; margin-bottom: 4px;">Société / TPE</h4>
            <p style="font-size: 0.76rem; color: var(--text-secondary); line-height: 1.3;">
              SASU, SARL, EURL, SAS. Trésorerie, TVA & export pour l'expert.
            </p>
          </div>

          <!-- Option 3 : Asso -->
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div 
            onclick={() => selectedModel = 'asso'}
            style="padding: 16px; border-radius: var(--radius-md); border: 2px solid {selectedModel === 'asso' ? '#c084fc' : 'rgba(255,255,255,0.08)'}; background: {selectedModel === 'asso' ? 'rgba(168, 85, 247, 0.12)' : 'rgba(255,255,255,0.02)'}; cursor: pointer; transition: all 0.2s;"
          >
            <div style="font-size: 1.7rem; margin-bottom: 8px;">🤝</div>
            <h4 style="font-size: 0.95rem; font-weight: 700; color: white; margin-bottom: 4px;">Association</h4>
            <p style="font-size: 0.76rem; color: var(--text-secondary); line-height: 1.3;">
              Loi 1901. Adhésions d'élèves, subventions & reçus fiscaux CERFA.
            </p>
          </div>

        </div>

        <div style="display: flex; justify-content: flex-end; gap: 12px;">
          {#if !isFirstLaunch}
            <button type="button" class="btn btn-secondary" onclick={handleClose}>Annuler</button>
          {/if}
          <button type="submit" class="btn btn-primary" style="padding: 12px 28px; font-weight: 700; font-size: 0.98rem;">
            {isFirstLaunch ? 'Accéder à mon espace ➔' : 'Créer ma nouvelle gestion ➔'}
          </button>
        </div>
      </form>

    </div>
  </div>
{/if}
