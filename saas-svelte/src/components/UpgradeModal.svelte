<script>
  import { showUpgradeModal, isAdmin, showToast } from '../lib/store.js';
  import { currentUser } from '../lib/auth.js';
  import { fade, scale } from 'svelte/transition';

  const stripeAnnualUrl = import.meta.env.VITE_STRIPE_PAYMENT_LINK_ANNUAL || 'https://buy.stripe.com/9B65kC2UzaUM8GR7CzfjG00';
  const stripeMonthlyUrl = import.meta.env.VITE_STRIPE_PAYMENT_LINK_MONTHLY || 'https://buy.stripe.com/8x2eVcbr5fb27CNaOLfjG01';

  /** @type {'annual' | 'monthly'} */
  let selectedPlan = $state('annual');

  function handleClose() {
    $showUpgradeModal = false;
  }

  function handleStartSubscription() {
    showToast('Redirection vers le paiement sécurisé Stripe...');
    
    const targetUrl = selectedPlan === 'annual' ? stripeAnnualUrl : stripeMonthlyUrl;
    const url = new URL(targetUrl);

    if ($currentUser?.uid) {
      url.searchParams.set('client_reference_id', $currentUser.uid);
    }
    if ($currentUser?.email) {
      url.searchParams.set('prefilled_email', $currentUser.email);
    }

    setTimeout(() => {
      window.location.href = url.toString();
    }, 400);
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
    padding: 36px 32px;
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
    font-size: 0.75rem;
    font-weight: 800;
    padding: 5px 14px;
    border-radius: 9999px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 16px;
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
    font-size: 0.9rem;
    color: #94a3b8 !important;
    line-height: 1.5;
    margin: 0 0 20px 0;
  }

  .plan-toggle-container {
    display: flex;
    background: #161F30;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 4px;
    margin-bottom: 22px;
    gap: 4px;
  }

  .plan-toggle-btn {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid transparent;
    border-radius: 9px;
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    background: transparent;
    color: #94a3b8;
    transition: all 0.15s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    line-height: 1.2;
  }

  .plan-toggle-btn:hover {
    color: #f8fafc;
  }

  .plan-toggle-btn.active {
    background: #1C273D;
    color: #f8fafc;
    border-color: rgba(56, 189, 248, 0.3);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  }

  .plan-badge-saving {
    font-size: 0.68rem;
    font-weight: 800;
    background: rgba(56, 189, 248, 0.15);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.3);
    padding: 2px 7px;
    border-radius: 9999px;
    letter-spacing: 0.02em;
  }

  .perks-box {
    background: #161F30;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 18px 20px;
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
    font-size: 0.88rem;
    color: #f1f5f9 !important;
    font-weight: 600;
  }

  .perk-icon {
    color: #38bdf8 !important;
    font-size: 0.85rem;
    flex-shrink: 0;
  }

  .price-main {
    font-size: 2.3rem;
    font-weight: 800;
    color: #f8fafc !important;
    letter-spacing: -0.02em;
  }

  .price-sub {
    font-size: 0.95rem;
    color: #94a3b8 !important;
    font-weight: 600;
  }

  .price-details {
    font-size: 0.78rem;
    color: #94a3b8 !important;
    display: block;
    margin-top: 2px;
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
      padding: 26px 18px !important;
      border-radius: 16px !important;
    }
    .upgrade-title {
      font-size: 1.3rem !important;
    }
    .upgrade-desc {
      font-size: 0.84rem !important;
      margin-bottom: 16px !important;
    }
    .perks-box {
      padding: 14px 14px !important;
      gap: 8px !important;
    }
    .perk-item {
      font-size: 0.82rem !important;
    }
    .price-main {
      font-size: 1.9rem !important;
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
        FORMULE ILLIMITÉE
      </div>

      <h2 class="upgrade-title">
        Débloquez la gestion illimitée
      </h2>

      <p class="upgrade-desc">
        L'essai gratuit vous permet de tester Tito sur 1 relevé bancaire (jusqu'à 60 écritures). Débloquez la formule Illimitée pour importer tous vos relevés et activer les exports officiels.
      </p>

      <!-- Sélecteur Annuel / Mensuel (Engagement 12 mois) -->
      <div class="plan-toggle-container">
        <button 
          type="button"
          class="plan-toggle-btn {selectedPlan === 'annual' ? 'active' : ''}" 
          onclick={() => selectedPlan = 'annual'}
        >
          <span>Annuel (69,90 € / an)</span>
          <span class="plan-badge-saving">2 mois offerts</span>
        </button>
        
        <button 
          type="button"
          class="plan-toggle-btn {selectedPlan === 'monthly' ? 'active' : ''}" 
          onclick={() => selectedPlan = 'monthly'}
        >
          <span>Mensuel (6,99 € / mois)</span>
          <span style="font-size: 0.7rem; color: #38bdf8; font-weight: 600;">Sans engagement</span>
        </button>
      </div>

      <!-- Avantages listés avec icônes bleu Tito -->
      <div class="perks-box">
        <div class="perk-item">
          <i class="fa-solid fa-check perk-icon"></i> 
          <span>Écritures bancaires & imports CSV illimités</span>
        </div>
        <div class="perk-item">
          <i class="fa-solid fa-check perk-icon"></i> 
          <span>Dictionnaire d'attribution automatisé</span>
        </div>
        <div class="perk-item">
          <i class="fa-solid fa-check perk-icon"></i> 
          <span>Tous les registres officiels (FEC DGFiP, Grand-Livre, Bilan)</span>
        </div>
        <div class="perk-item">
          <i class="fa-solid fa-check perk-icon"></i> 
          <span>Multi-structures & dossiers illimités</span>
        </div>
      </div>

      <!-- Prix dynamique & mentions claires -->
      <div style="margin-bottom: 20px;">
        {#if selectedPlan === 'annual'}
          <div style="display: flex; align-items: baseline; justify-content: center; gap: 6px;">
            <span class="price-main">69,90 €</span>
            <span class="price-sub">/ an TTC</span>
          </div>
          <span class="price-details">Équivalent à 5,82 € / mois • Facturé en une fois</span>
        {:else}
          <div style="display: flex; align-items: baseline; justify-content: center; gap: 6px;">
            <span class="price-main">6,99 €</span>
            <span class="price-sub">/ mois TTC</span>
          </div>
          <span class="price-details">Prélèvement mensuel • Sans engagement (résiliable à tout moment)</span>
        {/if}
      </div>

      <button 
        type="button"
        class="upgrade-cta-btn"
        onclick={handleStartSubscription}
      >
        <span>
          {selectedPlan === 'annual' ? 'Activer la formule Annuelle (69,90 € / an)' : 'Activer la formule Mensuelle (6,99 € / mois)'}
        </span>
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
