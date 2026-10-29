<script>
  import { showCancelModal, showToast } from '../lib/store.js';
  import { fade, scale } from 'svelte/transition';

  const stripePortalUrl = import.meta.env.VITE_STRIPE_PORTAL_LINK || 'https://billing.stripe.com/p/login/test_8x24gy0MPgJi8wg3TP6c000';

  function handleClose() {
    $showCancelModal = false;
  }

  function handleGoToStripe() {
    $showCancelModal = false;
    showToast('Redirection vers votre portail de facturation sécurisé...');
    window.open(stripePortalUrl, '_blank', 'noopener,noreferrer');
  }
</script>

<style>
  .cancel-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999999;
    padding: 20px;
  }

  .cancel-modal-card {
    max-width: 500px;
    width: 100%;
    background: #ffffff;
    border-radius: 18px;
    padding: 32px 28px;
    box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.35);
    text-align: left;
    position: relative;
    border: 1px solid rgba(226, 232, 240, 0.8);
    box-sizing: border-box;
  }

  .close-btn {
    position: absolute;
    top: 18px;
    right: 20px;
    background: none;
    border: none;
    font-size: 1.3rem;
    color: #94a3b8;
    cursor: pointer;
    line-height: 1;
    padding: 4px;
    border-radius: 6px;
    transition: color 0.15s ease;
  }

  .close-btn:hover {
    color: #0f172a;
  }

  .btn-keep {
    width: 100%;
    padding: 13px 20px;
    background: #0f172a;
    color: #ffffff;
    font-size: 0.95rem;
    font-weight: 700;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    transition: background 0.15s ease;
    text-align: center;
    margin-top: 24px;
  }

  .btn-keep:hover {
    background: #1e293b;
  }

  .link-stripe {
    display: block;
    text-align: center;
    margin-top: 14px;
    background: none;
    border: none;
    color: #64748b;
    font-size: 0.84rem;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
    transition: color 0.15s ease;
    padding: 6px;
    width: 100%;
  }

  .link-stripe:hover {
    color: #2563eb;
  }
</style>

{#if $showCancelModal}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div 
    class="cancel-modal-overlay" 
    transition:fade={{ duration: 180 }}
    onclick={handleClose}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div 
      class="cancel-modal-card" 
      transition:scale={{ duration: 220, start: 0.96 }}
      onclick={(e) => e.stopPropagation()}
    >
      <button 
        type="button"
        class="close-btn" 
        onclick={handleClose} 
        aria-label="Fermer"
      >
        &times;
      </button>

      <!-- En-tête sobre avec icône bleue unie conforme à la charte -->
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <div style="width: 40px; height: 40px; border-radius: 10px; background: #eff6ff; border: 1px solid #bfdbfe; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;">
          <i class="fa-solid fa-leaf"></i>
        </div>
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.3;">
            Gestion de votre abonnement
          </h2>
        </div>
      </div>

      <!-- Corps du texte avec formulation exacte -->
      <div style="font-size: 0.92rem; color: #334155; line-height: 1.6; display: flex; flex-direction: column; gap: 14px;">
        <p style="margin: 0;">
          Vous pouvez suspendre ou résilier votre abonnement à tout moment.
        </p>

        <p style="margin: 0; background: #f8fafc; border-left: 3px solid #2563eb; padding: 12px 14px; border-radius: 0 8px 8px 0; color: #475569; font-size: 0.88rem;">
          Dans le cadre de notre démarche écologique et de sobriété numérique, nous limitons l'empreinte carbone de nos serveurs.
        </p>

        <p style="margin: 0;">
          Vos écritures et votre historique restent conservés pendant <strong>4 mois</strong>. Au-delà de ce délai, vos données et votre dictionnaire d'attribution automatique ne seront plus conservés.
        </p>
      </div>

      <!-- Actions -->
      <button 
        type="button"
        class="btn-keep" 
        onclick={handleClose}
      >
        Garder mon compte actif
      </button>

      <button 
        type="button"
        class="link-stripe" 
        onclick={handleGoToStripe}
      >
        Accéder au portail de résiliation Stripe
      </button>

    </div>
  </div>
{/if}
