<script>
  import { 
    showDeleteStructureModal, 
    structureToDelete, 
    closeDeleteStructureModal, 
    deleteEntity, 
    entities,
    MANAGEMENT_MODELS 
  } from '../lib/store.js';

  let confirmInput = $state('');
  let isDeleting = $state(false);

  let target = $derived($structureToDelete);
  let modelObj = $derived(target ? (MANAGEMENT_MODELS[target.model] || MANAGEMENT_MODELS.micro) : null);
  let isConfirmValid = $derived(confirmInput.trim().toUpperCase() === 'SUPPRIMER');

  function handleClose() {
    if (isDeleting) return;
    confirmInput = '';
    closeDeleteStructureModal();
  }

  async function handleConfirmDelete() {
    if (!target || !isConfirmValid || isDeleting) return;
    isDeleting = true;
    try {
      await deleteEntity(target.id);
      confirmInput = '';
      closeDeleteStructureModal();
    } catch (err) {
      console.error("Erreur lors de la suppression:", err);
    } finally {
      isDeleting = false;
    }
  }

  /** @param {KeyboardEvent} e */
  function handleKeydown(e) {
    if (e.key === 'Escape' && $showDeleteStructureModal) {
      handleClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if $showDeleteStructureModal && target}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div 
    class="modal-backdrop" 
    role="dialog" 
    tabindex="-1"
    aria-modal="true" 
    aria-label="Supprimer la structure"
    onclick={handleClose}
  >
    <div 
      class="modal-card" 
      onclick={(e) => e.stopPropagation()}
    >
      <!-- HEADER -->
      <div class="modal-header">
        <div class="header-left">
          <div class="header-icon-danger">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div>
            <h3 class="modal-title">Supprimer la structure</h3>
            <p class="modal-subtitle">Cette action est définitive et irréversible</p>
          </div>
        </div>
        <button 
          type="button" 
          class="btn-close" 
          onclick={handleClose} 
          disabled={isDeleting}
          aria-label="Fermer"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- BODY -->
      <div class="modal-body">
        <!-- Target summary card -->
        <div class="target-card">
          <div class="target-badge">
            {modelObj?.title || target.model || 'Structure'}
          </div>
          <div class="target-name">
            {target.name}
          </div>
          <div class="target-id">
            Identifiant : {target.id}
          </div>
        </div>

        <div class="warning-box">
          <div class="warning-title">
            <i class="fa-solid fa-circle-exclamation"></i>
            <span>Données qui seront effacées :</span>
          </div>
          <ul class="warning-list">
            <li>Toutes les opérations bancaires et catégorisations de cette structure</li>
            <li>Le registre des adhérents, élèves ou clients associés</li>
            <li>Les règles d'imputation comptable apprises</li>
            <li>Le paramétrage du plan comptable et les écritures de clôture</li>
          </ul>
        </div>

        <div class="confirm-field">
          <label for="confirm-delete-input" class="confirm-label">
            Pour confirmer, veuillez saisir <strong>SUPPRIMER</strong> ci-dessous :
          </label>
          <input 
            id="confirm-delete-input"
            type="text" 
            bind:value={confirmInput}
            placeholder="SUPPRIMER" 
            class="confirm-input"
            autocomplete="off"
            spellcheck="false"
            disabled={isDeleting}
          />
        </div>
      </div>

      <!-- FOOTER -->
      <div class="modal-footer">
        <button 
          type="button" 
          class="btn-cancel" 
          onclick={handleClose}
          disabled={isDeleting}
        >
          Annuler
        </button>
        <button 
          type="button" 
          class="btn-danger-confirm" 
          onclick={handleConfirmDelete}
          disabled={!isConfirmValid || isDeleting}
        >
          {#if isDeleting}
            <i class="fa-solid fa-circle-notch fa-spin"></i>
            <span>Suppression en cours...</span>
          {:else}
            <i class="fa-solid fa-trash-can"></i>
            <span>Supprimer définitivement</span>
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(4, 9, 20, 0.82);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999999;
    padding: 16px;
  }

  .modal-card {
    background: #0c1527;
    border: 1px solid rgba(239, 68, 68, 0.35);
    border-radius: 16px;
    width: 100%;
    max-width: 520px;
    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 35px rgba(239, 68, 68, 0.12);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    color: #e2e8f0;
    animation: modalAppear 0.18s ease-out;
  }

  @keyframes modalAppear {
    from {
      opacity: 0;
      transform: scale(0.96) translateY(8px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .header-icon-danger {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #ef4444;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.15rem;
    flex-shrink: 0;
  }

  .modal-title {
    font-size: 1.1rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
    line-height: 1.25;
  }

  .modal-subtitle {
    font-size: 0.78rem;
    color: #ef4444;
    margin: 3px 0 0 0;
    font-weight: 600;
  }

  .btn-close {
    background: transparent;
    border: none;
    color: #94a3b8;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.95rem;
    transition: all 0.15s ease;
  }

  .btn-close:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .modal-body {
    padding: 22px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .target-card {
    background: #131e36;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 14px 16px;
  }

  .target-badge {
    display: inline-block;
    font-size: 0.68rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.25);
    padding: 2px 8px;
    border-radius: 4px;
    margin-bottom: 6px;
  }

  .target-name {
    font-size: 1.05rem;
    font-weight: 800;
    color: #ffffff;
  }

  .target-id {
    font-size: 0.72rem;
    color: #64748b;
    margin-top: 2px;
    font-family: monospace;
  }

  .warning-box {
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 10px;
    padding: 12px 16px;
  }

  .warning-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.82rem;
    font-weight: 700;
    color: #fca5a5;
    margin-bottom: 8px;
  }

  .warning-list {
    margin: 0;
    padding-left: 20px;
    font-size: 0.78rem;
    color: #cbd5e1;
    line-height: 1.5;
  }

  .warning-list li {
    margin-bottom: 4px;
  }

  .confirm-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .confirm-label {
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .confirm-label strong {
    color: #ef4444;
    letter-spacing: 0.05em;
  }

  .confirm-input {
    background: #070d18;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 8px;
    padding: 10px 14px;
    color: #ffffff;
    font-size: 0.92rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    outline: none;
    transition: all 0.15s ease;
  }

  .confirm-input:focus {
    border-color: #ef4444;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: #080f1e;
  }

  .btn-cancel {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #cbd5e1;
    padding: 9px 18px;
    border-radius: 8px;
    font-size: 0.84rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-cancel:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    color: #ffffff;
  }

  .btn-danger-confirm {
    background: #dc2626;
    border: none;
    color: #ffffff;
    padding: 9px 18px;
    border-radius: 8px;
    font-size: 0.84rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.15s ease;
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
  }

  .btn-danger-confirm:hover:not(:disabled) {
    background: #b91c1c;
  }

  .btn-danger-confirm:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    box-shadow: none;
  }
</style>
