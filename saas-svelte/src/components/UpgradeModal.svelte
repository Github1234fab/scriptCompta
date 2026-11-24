<script>
  import { showUpgradeModal, isAdmin, showToast } from '../lib/store.js';
  import { currentUser } from '../lib/auth.js';
  import { fade, scale } from 'svelte/transition';

  const stripeAnnualUrl = (import.meta.env.VITE_STRIPE_PAYMENT_LINK_ANNUAL && !import.meta.env.VITE_STRIPE_PAYMENT_LINK_ANNUAL.includes('test_'))
    ? import.meta.env.VITE_STRIPE_PAYMENT_LINK_ANNUAL
    : 'https://buy.stripe.com/9B65kC2UzaUM8GR7CzfjG00';

  function handleClose() {
    $showUpgradeModal = false;
  }

  function handleStartSubscription() {
    showToast('Redirection vers le paiement sécurisé Stripe...');
    
    try {
      const url = new URL(stripeAnnualUrl);

      if ($currentUser?.uid) {
        url.searchParams.set('client_reference_id', $currentUser.uid);
      }
      if ($currentUser?.email) {
        url.searchParams.set('prefilled_email', $currentUser.email);
      }

      setTimeout(() => {
        window.location.href = url.toString();
      }, 350);
    } catch {
      window.location.href = stripeAnnualUrl;
    }
  }
</script>

<style>
  .upgrade-modal-overlay {
    position: fixed !important;
    inset: 0 !important;
    background: rgba(7, 12, 24, 0.85) !important;
    backdrop-filter: blur(10px) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    z-index: 9999999 !important;
    padding: 20px !important;
    opacity: 1 !important;
    pointer-events: auto !important;
    box-sizing: border-box !important;
  }

  .upgrade-card {
    max-width: 520px;
    width: 100%;
    background: #0F1623 !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    border-radius: 20px;
    padding: 34px 28px;
    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.08) !important;
    text-align: center;
    position: relative;
    z-index: 10000000;
    box-sizing: border-box;
    color: #f8fafc !important;
  }

  .upgrade-close-btn {
    position: absolute;
    top: 18px;
    right: 20px;
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #64748b;
    cursor: pointer;
    padding: 4px;
    line-height: 1;
    border-radius: 6px;
    transition: color 0.15s ease;
  }

  .upgrade-close-btn:hover {
    color: #f8fafc;
  }

  .upgrade-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(56, 189, 248, 0.1) !important;
    color: #38bdf8 !important;
    border: 1px solid rgba(56, 189, 248, 0.25) !important;
    font-size: 0.74rem;
    font-weight: 800;
    padding: 5px 14px;
    border-radius: 9999px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 14px;
  }

  .upgrade-title {
    font-size: 1.55rem;
    font-weight: 800;
    color: #f8fafc !important;
    margin: 0 0 8px 0;
    line-height: 1.25;
    letter-spacing: -0.02em;
  }

  .upgrade-desc {
    font-size: 0.88rem;
    color: #94a3b8 !important;
    line-height: 1.5;
    margin: 0 0 18px 0;
  }

  .price-highlight-box {
    background: #161F30;
    border: 1.5px solid rgba(56, 189, 248, 0.35);
    border-radius: 14px;
    padding: 16px 18px;
    margin-bottom: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    position: relative;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  }

  .price-row {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 6px;
  }

  .price-main {
    font-size: 2.4rem;
    font-weight: 900;
    color: #f8fafc !important;
    letter-spacing: -0.03em;
  }

  .price-sub {
    font-size: 1rem;
    color: #38bdf8 !important;
    font-weight: 700;
  }

  .price-details {
    font-size: 0.82rem;
    color: #cbd5e1 !important;
    display: block;
    margin-top: 2px;
  }

  .split-payment-hint {
    font-size: 0.75rem;
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.25);
    padding: 3px 10px;
    border-radius: 9999px;
    margin-top: 6px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .perks-box {
    background: #161F30;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 16px 18px;
    text-align: left;
    margin-bottom: 22px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .perk-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.87rem;
    color: #f1f5f9 !important;
    font-weight: 600;
  }

  .perk-icon {
    color: #38bdf8 !important;
    font-size: 0.85rem;
    flex-shrink: 0;
  }

  .upgrade-cta-btn {
    width: 100%;
    padding: 14px 24px;
    background: #38bdf8;
    color: #070c18;
    font-size: 0.98rem;
    font-weight: 800;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(56, 189, 248, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: all 0.15s ease;
  }

  .upgrade-cta-btn:hover {
    background: #7dd3fc;
    box-shadow: 0 6px 20px rgba(56, 189, 248, 0.45);
    transform: translateY(-1px);
  }

  .upgrade-cta-btn:active {
    transform: translateY(0);
  }

  .skip-btn {
    margin-top: 14px;
    background: none;
    border: none;
    color: #64748b;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: color 0.15s;
  }

  .skip-btn:hover {
    color: #94a3b8;
  }

  @media (max-width: 580px) {
    .upgrade-modal-overlay {
      padding: 12px 8px !important;
    }
    .upgrade-card {
      padding: 24px 18px !important;
      border-radius: 16px !important;
    }
    .upgrade-title {
      font-size: 1.25rem !important;
    }
    .upgrade-desc {
      font-size: 0.82rem !important;
      margin-bottom: 14px !important;
    }
    .price-main {
      font-size: 2rem !important;
    }
    .perks-box {
      padding: 12px 14px !important;
      gap: 8px !important;
    }
    .perk-item {
      font-size: 0.82rem !important;
    }
    .upgrade-cta-btn {
      padding: 12px 18px !important;
      font-size: 0.92rem !important;
    }
  }
</style>

{#if $showUpgradeModal}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div 
    class="upgrade-modal-overlay" 
    transition:fade={{ duration: 180 }}
    onclick={handleClose}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div 
      class="upgrade-card" 
      transition:scale={{ duration: 220, start: 0.96 }}
      onclick={(e) => e.stopPropagation()}
    >
      <button 
        type="button"
        class="upgrade-close-btn"
        onclick={handleClose} 
        aria-label="Fermer"
      >
        &times;
      </button>

      {#if $isAdmin}
        <div style="margin-bottom: 14px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 8px; padding: 8px 12px; font-size: 0.75rem; color: #38bdf8; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <i class="fa-solid fa-shield-halved"></i>
          <span>Aperçu Administrateur (Votre compte bénéficie déjà de l'accès illimité)</span>
        </div>
      {/if}

      <!-- Badge Formule Pro bleu Tito -->
      <div class="upgrade-badge">
        TARIF UNIQUE • TOUTE L'ANNÉE ILLIMITÉE
      </div>

      <h2 class="upgrade-title">
        Débloquez la gestion illimitée
      </h2>

      <p class="upgrade-desc">
        Votre essai gratuit vous a permis de tester Tito sur vos premières écritures. Passez à la formule Illimitée pour importer l'intégralité de vos relevés et activer vos exports officiels.
      </p>

      <!-- Encadré Prix Unique avec fort ancrage mensuel -->
      <div class="price-highlight-box">
        <div class="price-row">
          <span class="price-main">5,82 €</span>
          <span class="price-sub">/ mois</span>
        </div>
        <span class="price-details">Facturé en une seule fois <strong>69,90 € / an TTC</strong> (2 mois offerts)</span>
        <div class="split-payment-hint">
          <i class="fa-solid fa-credit-card"></i>
          <span>Paiement en 3x ou 4x sans frais via Klarna (~23 € en 3x ou ~17,50 € en 4x)</span>
        </div>
      </div>

      <!-- Avantages listés avec icônes bleu Tito -->
      <div class="perks-box">
        <div class="perk-item">
          <i class="fa-solid fa-check perk-icon"></i> 
          <span>Écritures bancaires & imports CSV illimités</span>
        </div>
        <div class="perk-item">
          <i class="fa-solid fa-check perk-icon"></i> 
          <span>Dictionnaire d'attribution & catégorisation intelligente</span>
        </div>
        <div class="perk-item">
          <i class="fa-solid fa-check perk-icon"></i> 
          <span>Tous les registres officiels (FEC DGFiP, Grand-Livre, Bilan)</span>
        </div>
        <div class="perk-item">
          <i class="fa-solid fa-check perk-icon"></i> 
          <span>Multi-structures & archive ZIP remise à la résiliation</span>
        </div>
      </div>

      <button 
        type="button"
        class="upgrade-cta-btn"
        onclick={handleStartSubscription}
      >
        <span>Activer la formule Annuelle (69,90 € / an)</span>
        <i class="fa-solid fa-arrow-right" style="font-size: 0.85rem;"></i>
      </button>

      <button 
        type="button"
        class="skip-btn"
        onclick={handleClose} 
      >
        Continuer avec le quota gratuit
      </button>

    </div>
  </div>
{/if}
