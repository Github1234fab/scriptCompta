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
          Création de votre espace {MANAGEMENT_MODELS[selectedModel]?.title || ''}
        </h1>
        <p style="font-size: 1.02rem; color: #64748b; line-height: 1.6; margin: 0;">
          {MANAGEMENT_MODELS[selectedModel]?.onboardingSubtitle || "Saisissez le nom de votre dossier ou entité pour finaliser la création."}
        </p>
      {/if}
    </div>

    <!-- ÉTAPE 1 : UNIQUEMENT LES 6 CARTES MÉTIER -->
    {#if currentStep === 1}
      <div id="welcome-model-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap:14px;">
        {#each Object.values(MANAGEMENT_MODELS) as item}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div 
            onclick={() => handleSelectModelCard(item.id)}
            style="padding: 40px 30px; min-height: 165px; border-radius: 16px; border: 1.5px solid {item.accentColor}40; background: #ffffff; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03); cursor: pointer; transition: all 0.22s ease-in-out; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden;"
            onmouseenter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(15, 23, 42, 0.08)';
              const btn = e.currentTarget.querySelector('.btn-select');
              if (btn instanceof HTMLElement) btn.style.transform = 'scale(1.08)';
            }}
            onmouseleave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.03)';
              const btn = e.currentTarget.querySelector('.btn-select');
              if (btn instanceof HTMLElement) btn.style.transform = 'scale(1)';
            }}
          >
            <!-- Top accent strip -->
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 0px; background: {item.accentColor};"></div>

         
<div style="display: flex; flex-direction: column; gap: 16px; flex: 1; justify-content: space-between;">
              <div style="display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 4px; margin-top: 0px;">
                  <!-- <span style="font-size: 0.74rem; font-weight: 800; padding: 10px 10px; border-radius: 20px; background: {item.accentColor}18; color: {item.accentColor}; border: 1px solid {item.accentColor}40; letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 65%;">
                    {item.badge}
                  </span> -->
                </div>
                <h4 style="font-size: 1.18rem; font-weight: 800; color: #0f172a; margin: 0; font-family: var(--font-title); background-color: #e0e7ff; border: 1px solid #bae6fd; padding: 10px 14px; border-radius: 10px;">{item.title}</h4>
                <ul style="margin: 0; padding-left: 18px; font-size: 0.86rem; color: #475569; line-height: 1.6; display: flex; flex-direction: column; gap: 4px; font-weight: 500;">
                  {#each item.desc.split(',') as feature}
                    <li>{feature.trim()}</li>
                  {/each}
                </ul>
              </div>
              <span class="btn-select" style="font-size: 0.82rem; font-weight: 800; color: grey; display: inline-flex; align-items: center; gap: 10px; white-space: nowrap; flex-shrink: 0; border: 1px solid grey; padding: 5px 14px; border-radius: 20px; align-self: flex-start; margin-top: auto; transition: transform 0.22s ease-in-out;">
                Sélectionner ➔
              </span>
            </div>
          </div>
        {/each}
      </div>

    <!-- ÉTAPE 2 : APPRÈS CLIC SUR CARTE, DEMANDE DU NOM -->
    {:else}
      <form onsubmit={handleCreateFirstStructure} style="max-width: 620px; margin: 0 auto; display: flex; flex-direction: column; gap: 32px;">
        
        <!-- PILULE RAPPEL DU PROFIL -->
        <div style="display: flex; justify-content: center;">
          <div style="display: inline-flex; align-items: center; gap: 10px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 16px; border-radius: 30px;">
            <span style="font-size: 0.78rem; font-weight: 800; padding: 3px 10px; border-radius: 20px; background: #e2e8f0; color: #334155;">
              {MANAGEMENT_MODELS[selectedModel]?.badge || 'Profil'}
            </span>
            <span style="font-size: 0.92rem; font-weight: 800; color: #0f172a;">
              {MANAGEMENT_MODELS[selectedModel]?.title}
            </span>
          </div>
        </div>

        <!-- BLOC DE SAISIE PRINCIPAL (TEXTE DE SAISIE DYNAMIQUE SELON PROFIL) -->
        <div style="background: #e0f2fe; border-radius: 16px; padding: 28px; display: flex; flex-direction: column; gap: 12px;">
          <label for="welcome-structure-name" style="font-size: 1.08rem; font-weight: 800; color: #0f172a; display: block;">
            {
              selectedModel === 'micro' ? 'Saisissez votre Nom, Prénom ou nom commercial :' :
              selectedModel === 'tpe' ? 'Saisissez la raison sociale officielle de la société :' :
              selectedModel === 'asso' ? "Saisissez le nom officiel de l'association :" :
              selectedModel === 'bnc' ? 'Saisissez le nom du cabinet ou du praticien :' :
              selectedModel === 'sci' ? 'Saisissez le nom de la SCI :' :
              selectedModel === 'copro' ? 'Saisissez la désignation de la résidence / copropriété :' :
              'Saisissez le nom officiel de votre structure :'
            }
          </label>
          <!-- svelte-ignore a11y_autofocus -->
          <input 
            type="text" 
            id="welcome-structure-name"
            bind:value={nameInput} 
            autofocus
            required 
            placeholder={MANAGEMENT_MODELS[selectedModel]?.onboardingPlaceholder || "ex: Horizon Conseil SASU..."} 
            style="width: 100%; padding: 14px 18px; font-size: 0.98rem; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; color: #0f172a; font-weight: 500; outline: none; box-sizing: border-box; transition: all 0.2s;"
          />
          <p style="font-size: 0.86rem; color: #0369a1; margin: 0; font-weight: 600;">
            Ce nom apparaîtra sur vos bilans et vos documents d'export.
          </p>
        </div>

        <!-- BOUTONS D'ACTION AVEC ESPACE SUFFISANT -->
        <div style="display: flex; gap: 16px; justify-content: center; padding-top: 8px;">
          <button type="button" onclick={handleBackToStep1} style="padding: 14px 28px; font-weight: 700; font-size: 0.95rem; background: #ffffff; color: #475569; border: 1.5px solid #cbd5e1; border-radius: 12px; cursor: pointer; transition: all 0.2s;">
            ← Changer de profil
          </button>
          <button type="submit" style="padding: 16px 48px; font-weight: 800; font-size: 1.05rem; background: #0f172a; color: #ffffff; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.25); transition: all 0.2s;">
            Valider & Démarrer ➔
          </button>
        </div>

      </form>
    {/if}

  </div>
</div>
