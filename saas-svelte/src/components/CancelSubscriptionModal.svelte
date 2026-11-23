<script>
  import { showCancelModal, showToast } from '../lib/store.js';
  import { fade, scale } from 'svelte/transition';

  const stripePortalUrl = import.meta.env.VITE_STRIPE_PORTAL_LINK || 'https://billing.stripe.com/p/login/9B65kC2UzaUM8GR7CzfjG00';

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
    inset: 0;
    background: rgba(7, 12, 24, 0.85);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999999;
    padding: 20px;
    box-sizing: border-box;
  }

  .cancel-modal-card {
    max-width: 500px;
    width: 100%;
    background: #0F1623 !important;
    border-radius: 18px;
    padding: 32px 28px;
    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.08);
    text-align: left;
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-sizing: border-box;
    color: #f8fafc !important;
  }

  .close-btn {
    position: absolute;
    top: 18px;
    right: 20px;
    background: none;
    border: none;
    font-size: 1.4rem;
    color: #64748b;
    cursor: pointer;
    line-height: 1;
    padding: 4px;
    border-radius: 6px;
    transition: color 0.15s ease;
  }

  .close-btn:hover {
    color: #f8fafc;
  }

  .cancel-icon-wrap {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.25);
    color: #38bdf8;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.15rem;
    flex-shrink: 0;
  }

  .cancel-title {
    font-size: 1.35rem;
    font-weight: 800;
    color: #f8fafc !important;
    margin: 0;
    line-height: 1.3;
    letter-spacing: -0.01em;
  }

  .cancel-content {
    font-size: 0.92rem;
    color: #94a3b8 !important;
    line-height: 1.6;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .cancel-callout {
    margin: 0;
    background: #161F30;
    border-left: 3px solid #38bdf8;
    border-radius: 0 8px 8px 0;
    padding: 12px 14px;
    color: #cbd5e1 !important;
    font-size: 0.88rem;
    line-height: 1.5;
  }

  .btn-keep {
    width: 100%;
    padding: 14px 20px;
    background: #38bdf8;
    color: #070c18;
    font-size: 0.95rem;
    font-weight: 800;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(56, 189, 248, 0.35);
    transition: all 0.15s ease;
    text-align: center;
    margin-top: 24px;
  }

  .btn-keep:hover {
    background: #7dd3fc;
    box-shadow: 0 6px 20px rgba(56, 189, 248, 0.45);
    transform: translateY(-1px);
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
    color: #cbd5e1;
  }

  @media (max-width: 540px) {
    .cancel-modal-overlay {
      padding: 12px 8px;
    }
    .cancel-modal-card {
      padding: 24px 18px;
      border-radius: 16px;
    }
    .cancel-title {
      font-size: 1.2rem !important;
    }
    .cancel-content {
      font-size: 0.86rem !important;
      gap: 10px;
    }
    .btn-keep {
      padding: 12px 18px;
      font-size: 0.9rem;
    }
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

      <!-- En-tête sobre avec icône bleu Tito -->
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <div class="cancel-icon-wrap">
          <i class="fa-solid fa-leaf"></i>
        </div>
        <div>
          <h2 class="cancel-title">
            Gestion de votre abonnement
          </h2>
        </div>
      </div>

      <!-- Corps du texte avec lisibilité haute -->
      <div class="cancel-content">
        <p style="margin: 0;">
          Vous pouvez suspendre ou résilier votre abonnement à tout moment.
        </p>

        <p class="cancel-callout">
          Dans le cadre de notre démarche écologique et de sobriété numérique, nous limitons l'empreinte carbone de nos serveurs.
        </p>

        <p style="margin: 0;">
          Vos écritures et votre historique restent conservés pendant <strong style="color: #f8fafc;">4 mois</strong>. Au-delà de ce délai, vos données et votre dictionnaire d'attribution automatique ne seront plus conservés.
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
