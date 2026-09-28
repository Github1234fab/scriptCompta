<script>
  import { updateEntities, updateActiveEntityId, entities, showToast, MANAGEMENT_MODELS } from '../lib/store.js';

  let currentStep = $state(1); // 1 = Card Choice, 2 = Structure Info
  let nameInput = $state('');
  let selectedModel = $state(''); // 'micro', 'tpe', 'asso', 'bnc', 'sci', 'copro'

  /** @param {string} modelId */
  function handleSelectModelCard(modelId) {
    selectedModel = modelId;
    currentStep = 2; // Smoothly advance to step 2 after card choice
  }

  function handleBackToStep1() {
    currentStep = 1;
  }

  /** @param {any} e */
  function handleCreateFirstStructure(e) {
    e.preventDefault();
    if (!nameInput.trim() || !selectedModel) return;

    const newId = 'entity_' + Date.now();
    const newEntity = {
      id: newId,
      name: nameInput.trim(),
      model: selectedModel
    };

    updateEntities([...$entities, newEntity]);
    updateActiveEntityId(newId);

    const modelObj = MANAGEMENT_MODELS[newEntity.model] || MANAGEMENT_MODELS.micro;
    showToast(`🚀 Bienvenue ! Votre espace ${modelObj.title} "${newEntity.name}" est prêt.`);
  }
</script>

<div class="welcome-screen-container" style="min-height: 100vh; width: 100%; background: #f8fafc; display: flex; align-items: center; justify-content: center; padding: 40px 20px; box-sizing: border-box;">
  
  <div style="max-width: 1050px; width: 100%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 48px; box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.08);">
    
    <!-- BRANDING & INTRO -->
    <div style="text-align: center; max-width: 680px; margin: 0 auto 36px auto;">
      <div style="display: inline-flex; align-items: center; gap: 10px; background: #eff6ff; border: 1px solid #bfdbfe; color: #2563eb; font-weight: 800; font-size: 0.82rem; padding: 6px 16px; border-radius: 30px; margin-bottom: 16px; letter-spacing: 0.04em; text-transform: uppercase;">
        SCRIPTCOMPTA
      </div>
      
      {#if currentStep === 1}
        <h1 style="font-family: var(--font-title); font-size: 2.3rem; font-weight: 800; color: #0f172a; margin: 0 0 12px 0; letter-spacing: -0.02em;">
          Bienvenue
        </h1>
        <p style="font-size: 1.05rem; color: #64748b; line-height: 1.6; margin: 0; font-weight: 500;">
          Choisissez la nature de votre activité pour créer votre profil.
        </p>
      {:else}
        <h1 style="font-family: var(--font-title); font-size: 2.2rem; font-weight: 800; color: #0f172a; margin: 0 0 12px 0; letter-spacing: -0.02em;">
          {MANAGEMENT_MODELS[selectedModel]?.onboardingTitle || "Comment s'appelle votre structure ?"}
        </h1>
        <p style="font-size: 1.02rem; color: #64748b; line-height: 1.6; margin: 0;">
          {MANAGEMENT_MODELS[selectedModel]?.onboardingSubtitle || `Saisissez le nom de votre dossier ou entité (${MANAGEMENT_MODELS[selectedModel]?.title}) pour finaliser la création.`}
        </p>
      {/if}
    </div>

    <!-- ÉTAPE 1 : UNIQUEMENT LES 6 CARTES MÉTIER -->
    {#if currentStep === 1}
      <div id="welcome-model-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 24px;">
        {#each Object.values(MANAGEMENT_MODELS) as item}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div 
            onclick={() => handleSelectModelCard(item.id)}
            style="padding: 26px; min-height: 165px; border-radius: 16px; border: 1.5px solid {item.accentColor}40; background: #ffffff; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03); cursor: pointer; transition: all 0.22s ease-in-out; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden;"
            onmouseenter={(e) => {
              e.currentTarget.style.borderColor = item.accentColor;
              e.currentTarget.style.background = item.accentBg;
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = `0 16px 32px -5px ${item.accentColor}30, 0 4px 8px -2px ${item.accentColor}15`;
            }}
            onmouseleave={(e) => {
              e.currentTarget.style.borderColor = `${item.accentColor}40`;
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.03)';
            }}
          >
            <!-- Top accent strip -->
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 5px; background: {item.accentColor};"></div>

            <div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 14px; margin-top: 4px;">
                <span style="font-size: 0.74rem; font-weight: 800; padding: 4px 10px; border-radius: 20px; background: {item.accentColor}18; color: {item.accentColor}; border: 1px solid {item.accentColor}40; letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 65%;">
                  {item.badge}
                </span>
                <span style="font-size: 0.82rem; font-weight: 800; color: {item.accentColor}; display: flex; align-items: center; gap: 4px; white-space: nowrap; flex-shrink: 0;">
                  Sélectionner ➔
                </span>
              </div>
              <h4 style="font-size: 1.18rem; font-weight: 800; color: #0f172a; margin: 0 0 10px 0; font-family: var(--font-title);">{item.title}</h4>
              <p style="font-size: 0.86rem; color: #475569; line-height: 1.5; margin: 0; font-weight: 500;">
                {item.desc}
              </p>
            </div>
          </div>
        {/each}
      </div>

    <!-- ÉTAPE 2 : APPRÈS CLIC SUR CARTE, DEMANDE DU NOM -->
    {:else}
      <form onsubmit={handleCreateFirstStructure} style="max-width: 580px; margin: 0 auto;">
        
        <!-- CARTE RAPPEL DU CHOIX SÉLECTIONNÉ -->
        <div style="margin-bottom: 24px; padding: 16px 20px; border-radius: 12px; border: 2px solid {MANAGEMENT_MODELS[selectedModel]?.accentColor}; background: {MANAGEMENT_MODELS[selectedModel]?.accentBg}; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 0.76rem; font-weight: 800; padding: 4px 10px; border-radius: 20px; background: #ffffff; color: {MANAGEMENT_MODELS[selectedModel]?.accentColor}; border: 1px solid {MANAGEMENT_MODELS[selectedModel]?.accentColor}40;">
              {MANAGEMENT_MODELS[selectedModel]?.badge}
            </span>
            <span style="font-size: 1.05rem; font-weight: 800; color: #0f172a;">{MANAGEMENT_MODELS[selectedModel]?.title}</span>
          </div>
          
          <button type="button" onclick={handleBackToStep1} style="background: none; border: none; color: #2563eb; font-weight: 700; font-size: 0.84rem; cursor: pointer; display: flex; align-items: center; gap: 4px;">
            <i class="fa-solid fa-pen"></i> Modifier le profil
          </button>
        </div>

        <div style="margin-bottom: 32px;">
          <label for="welcome-structure-name" style="font-size: 0.98rem; font-weight: 800; color: #0f172a; display: block; margin-bottom: 8px;">
            {MANAGEMENT_MODELS[selectedModel]?.onboardingLabel || "Nom de votre structure ou dossier"}
          </label>
          <input 
            type="text" 
            id="welcome-structure-name"
            bind:value={nameInput} 
            required 
            placeholder={MANAGEMENT_MODELS[selectedModel]?.onboardingPlaceholder || "ex: Cabinet Paramédical Lyon, SCI Les Marronniers..."} 
            style="width: 100%; padding: 16px 20px; font-size: 1.05rem; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 12px; color: #0f172a; font-weight: 600; outline: none; box-sizing: border-box; transition: all 0.2s;"
          />
        </div>

        <div style="display: flex; gap: 14px; justify-content: center;">
          <button type="button" onclick={handleBackToStep1} style="padding: 14px 24px; font-weight: 700; font-size: 0.95rem; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 12px; cursor: pointer;">
            ← Retour
          </button>
          <button type="submit" style="padding: 14px 40px; font-weight: 800; font-size: 1.02rem; background: #0f172a; color: #ffffff; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.25); transition: all 0.2s;">
            Créer mon espace & Démarrer ➔
          </button>
        </div>

      </form>
    {/if}

  </div>
</div>
