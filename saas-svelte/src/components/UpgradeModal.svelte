<script>
  import { showUpgradeModal, isAdmin, showToast } from '../lib/store.js';
  import { currentUser } from '../lib/auth.js';
  import { fade, scale } from 'svelte/transition';

  const stripeAnnualUrl = import.meta.env.VITE_STRIPE_PAYMENT_LINK_ANNUAL || 'https://buy.stripe.com/test_aFadR8anp1Oo27S3TP6c001';
  const stripeMonthlyUrl = import.meta.env.VITE_STRIPE_PAYMENT_LINK_MONTHLY || 'https://buy.stripe.com/test_28E28qeDFakUaEo7616c002';

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
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    background: rgba(15, 23, 42, 0.75) !important;
    backdrop-filter: blur(8px) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    z-index: 9999999 !important;
    padding: 20px !important;
    opacity: 1 !important;
    pointer-events: auto !important;
  }

  .plan-toggle-container {
    display: flex;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 4px;
    margin-bottom: 22px;
    gap: 4px;
  }

  .plan-toggle-btn {
    flex: 1;
    padding: 10px 14px;
    border: none;
    border-radius: 9px;
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    background: transparent;
    color: #64748b;
    transition: all 0.15s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    line-height: 1.2;
  }

  .plan-toggle-btn.active {
    background: #ffffff;
    color: #0f172a;
    box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
  }

  .plan-badge-saving {
    font-size: 0.68rem;
    font-weight: 800;
    background: #eff6ff;
    color: #2563eb;
    border: 1px solid #bfdbfe;
    padding: 2px 7px;
    border-radius: 9999px;
    letter-spacing: 0.02em;
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
      class="modal-card" 
      transition:scale={{ duration: 220, start: 0.96 }}
      onclick={(e) => e.stopPropagation()}
      style="max-width: 520px; width: 100%; background: #ffffff !important; border-radius: 20px; padding: 36px 32px; box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.35); text-align: center; position: relative; z-index: 10000000; box-sizing: border-box;"
    >
      <button 
        type="button"
        onclick={handleClose} 
        style="position: absolute; top: 18px; right: 20px; background: none; border: none; font-size: 1.4rem; color: #94a3b8; cursor: pointer; padding: 4px;"
        aria-label="Fermer"
      >
        &times;
      </button>

      {#if $isAdmin}
        <div style="margin-bottom: 14px; background: rgba(37, 99, 235, 0.08); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; padding: 8px 12px; font-size: 0.75rem; color: #2563eb; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <i class="fa-solid fa-shield-halved"></i>
          <span>Aperçu Administrateur (Votre compte bénéficie déjà de l'accès illimité)</span>
        </div>
      {/if}

      <!-- Badge Formule Pro monochrome bleu conforme à la charte -->
      <div style="display: inline-flex; align-items: center; gap: 8px; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 0.78rem; font-weight: 800; padding: 5px 14px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">
        FORMULE ILLIMITÉE
      </div>

        <h2 style="font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0 0 8px 0; line-height: 1.25;">
          Débloquez la gestion illimitée
        </h2>

        <p style="font-size: 0.9rem; color: #475569; line-height: 1.5; margin: 0 0 20px 0;">
          Gérez l'ensemble de votre comptabilité sans contrainte.
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
            <span style="font-size: 0.7rem; color: #64748b; font-weight: 500;">Engagement 12 mois</span>
          </button>
        </div>

        <!-- Avantages listés - Uniquement icône bleue unie conforme à la charte -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; text-align: left; margin-bottom: 22px; display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px; font-size: 0.88rem; color: #1e293b; font-weight: 600;">
            <i class="fa-solid fa-check" style="color: #2563eb; font-size: 0.85rem;"></i> Écritures bancaires & imports CSV illimités
          </div>
          <div style="display: flex; align-items: center; gap: 10px; font-size: 0.88rem; color: #1e293b; font-weight: 600;">
            <i class="fa-solid fa-check" style="color: #2563eb; font-size: 0.85rem;"></i> Dictionnaire d'attribution automatisé
          </div>
          <div style="display: flex; align-items: center; gap: 10px; font-size: 0.88rem; color: #1e293b; font-weight: 600;">
            <i class="fa-solid fa-check" style="color: #2563eb; font-size: 0.85rem;"></i> Tous les registres officiels (FEC DGFiP, Grand-Livre, Bilan)
          </div>
          <div style="display: flex; align-items: center; gap: 10px; font-size: 0.88rem; color: #1e293b; font-weight: 600;">
            <i class="fa-solid fa-check" style="color: #2563eb; font-size: 0.85rem;"></i> Multi-structures & dossiers illimités
          </div>
        </div>

        <!-- Prix dynamique & mentions claires -->
        <div style="margin-bottom: 20px;">
          {#if selectedPlan === 'annual'}
            <div style="display: flex; align-items: baseline; justify-content: center; gap: 6px;">
              <span style="font-size: 2.2rem; font-weight: 800; color: #0f172a;">69,90 €</span>
              <span style="font-size: 0.95rem; color: #64748b; font-weight: 600;">/ an TTC</span>
            </div>
            <span style="font-size: 0.78rem; color: #64748b;">Équivalent à 5,82 € / mois • Facturé en une fois</span>
          {:else}
            <div style="display: flex; align-items: baseline; justify-content: center; gap: 6px;">
              <span style="font-size: 2.2rem; font-weight: 800; color: #0f172a;">6,99 €</span>
              <span style="font-size: 0.95rem; color: #64748b; font-weight: 600;">/ mois TTC</span>
            </div>
            <span style="font-size: 0.78rem; color: #64748b;">Prélèvement mensuel • Engagement 12 mois</span>
          {/if}
        </div>

        <button 
          type="button"
          onclick={handleStartSubscription}
          style="width: 100%; padding: 14px 24px; background: #0f172a; color: #ffffff; font-size: 0.98rem; font-weight: 700; border-radius: 10px; border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.2); display: flex; align-items: center; justify-content: center; gap: 10px; transition: background 0.15s ease;"
        >
          <span>
            {selectedPlan === 'annual' ? 'Activer la formule Annuelle (69,90 € / an)' : 'Activer la formule Mensuelle (6,99 € / mois)'}
          </span>
          <i class="fa-solid fa-arrow-right" style="font-size: 0.85rem;"></i>
        </button>

        <button 
          type="button"
          onclick={handleClose} 
          style="margin-top: 14px; background: none; border: none; color: #64748b; font-size: 0.82rem; font-weight: 600; cursor: pointer;"
        >
          Continuer avec le quota gratuit
        </button>

    </div>
  </div>
{/if}
