<script>
  import { updateEntities, updateActiveEntityId, entities, showToast, MANAGEMENT_MODELS } from '../lib/store.js';
  import { currentUser } from '../lib/auth.js';
  import { saveEntityData } from '../lib/firestoreService.js';

  let currentScreen = $state('select'); // 'select' | 'name'
  let selectedModel = $state('micro');
  let nameInput = $state('');

  let selectedModelObj = $derived(MANAGEMENT_MODELS[selectedModel] || MANAGEMENT_MODELS.micro);

  /** @param {string} modelKey */
  function handleSelectStructure(modelKey) {
    selectedModel = modelKey;
    nameInput = '';
    currentScreen = 'name';
  }

  function handleBackToSelection() {
    currentScreen = 'select';
  }

  /** @param {any} e */
  async function handleCreateStructure(e) {
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

    if ($currentUser?.uid) {
      await saveEntityData($currentUser.uid, newId, newEntity);
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
          SCRIPTCOMPTA
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
            <span class="pill-badge pill-blue">Auto-entrepreneur</span>
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
            <span class="pill-badge pill-neutral">SASU, EURL, SARL, SAS</span>
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
            <span class="pill-badge pill-neutral">Club / Assos</span>
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
            <span class="pill-badge pill-neutral">Déclaration 2035 BNC</span>
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
            <span class="pill-badge pill-neutral">Impôt sur le Revenu (IR)</span>
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
            <span class="pill-badge pill-neutral">Syndic Coopératif</span>
            <i class="fa-solid fa-chevron-right card-arrow"></i>
          </div>
          <h2 class="card-title">Copropriété Bénévole</h2>
          <p class="card-desc">Lots & tantièmes, appels de fonds, fonds travaux ALUR et régularisation.</p>
        </button>

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
        <span class="pill-badge pill-blue">
          {selectedModelObj.title}
        </span>
      </div>

      <!-- TITRE DU FORMULAIRE SELON LE STATUT -->
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 1.45rem; font-weight: 800; color: #0f172a; margin: 0 0 6px 0; letter-spacing: -0.01em;">
          {selectedModelObj.onboardingTitle}
        </h2>
        <p style="font-size: 0.9rem; color: #64748b; margin: 0; line-height: 1.45;">
          {selectedModelObj.onboardingSubtitle}
        </p>
      </div>

      <!-- FORMULAIRE DE NOMMAGE -->
      <form onsubmit={handleCreateStructure} style="display: flex; flex-direction: column; gap: 22px;">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label for="entity-name-input" style="font-size: 0.9rem; font-weight: 700; color: #0f172a;">
            {selectedModelObj.onboardingLabel}
          </label>
          <!-- svelte-ignore a11y_autofocus -->
          <input 
            type="text" 
            id="entity-name-input"
            bind:value={nameInput}
            required
            autofocus
            placeholder={selectedModelObj.onboardingPlaceholder}
            class="naming-input"
          />
          <span style="font-size: 0.8rem; color: #94a3b8;">
            Ce nom figurera sur vos en-têtes et pourra être modifié ultérieurement.
          </span>
        </div>

        <!-- ACTIONS -->
        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; padding-top: 18px; border-top: 1px solid #f1f5f9;">
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
    background: #2b3240;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 36px 20px;
    box-sizing: border-box;
    font-family: inherit;
  }

  .welcome-card {
    width: 100%;
    background: #ffffff;
    border-radius: 20px;
    padding: 38px 42px 36px 42px;
    box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.35);
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
    color: #2563eb;
    font-weight: 800;
    font-size: 0.75rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-bottom: 10px;
  }

  .welcome-title {
    font-size: 1.65rem;
    font-weight: 800;
    color: #0f172a;
    margin: 0 0 8px 0;
    letter-spacing: -0.02em;
    line-height: 1.25;
  }

  .welcome-subtitle {
    font-size: 0.92rem;
    color: #475569;
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
      grid-template-columns: 1fr;
    }
    .welcome-card {
      padding: 24px 20px;
    }
  }

  /* CARTES EN TANT QUE BOUTONS NATIFS POUR CLIC PARFAIT */
  .model-card {
    text-align: left;
    font-family: inherit;
    background: #ffffff;
    border: 1.5px solid #e2e8f0;
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

  .back-btn {
    background: transparent;
    border: none;
    color: #64748b;
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
    color: #0f172a;
  }

  .naming-input {
    width: 100%;
    height: 52px;
    padding: 0 16px;
    font-size: 1.05rem;
    font-weight: 600;
    color: #0f172a;
    background: #ffffff;
    border: 2px solid #cbd5e1;
    border-radius: 10px;
    box-sizing: border-box;
    outline: none;
    transition: all 0.2s;
  }

  .naming-input:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
  }

  .naming-input::placeholder {
    color: #94a3b8;
    font-weight: 400;
  }

  .cancel-btn {
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    color: #475569;
    font-weight: 700;
    font-size: 0.9rem;
    padding: 10px 18px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .cancel-btn:hover {
    background: #e2e8f0;
    color: #0f172a;
  }

  .confirm-btn {
    background: #0f172a;
    color: #ffffff;
    border: none;
    border-radius: 8px;
    font-weight: 700;
    font-size: 0.9rem;
    padding: 10px 22px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background 0.18s, transform 0.1s;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);
  }

  .confirm-btn:hover {
    background: #1e293b;
  }

  .confirm-btn:active {
    transform: scale(0.99);
  }
</style>
