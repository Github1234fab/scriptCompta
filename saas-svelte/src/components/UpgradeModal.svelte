<script>
  import { showUpgradeModal, isPremium, isAdmin, userProfile, showToast } from '../lib/store.js';
  import { currentUser } from '../lib/auth.js';

  const stripeBaseUrl = import.meta.env.VITE_STRIPE_PAYMENT_LINK || 'https://buy.stripe.com/test_8x24gy0MPgJi8wg3TP6c000';

  function handleClose() {
    $showUpgradeModal = false;
  }

  function handleStartSubscription() {
    showToast('Redirection vers le paiement sécurisé Stripe...');
    
    // Construction de l'URL avec les paramètres Stripe pour associer le paiement au compte Firebase
    const url = new URL(stripeBaseUrl);
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
</style>

{#if $showUpgradeModal}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div 
    class="upgrade-modal-overlay" 
    onclick={handleClose}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div 
      class="modal-card" 
      onclick={(e) => e.stopPropagation()}
      style="max-width: 520px; width: 100%; background: #ffffff !important; border-radius: 20px; padding: 36px 32px; box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.35); text-align: center; position: relative; z-index: 10000000;"
    >
      <button 
        onclick={handleClose} 
        style="position: absolute; top: 18px; right: 20px; background: none; border: none; font-size: 1.4rem; color: #94a3b8; cursor: pointer;"
      >
        &times;
      </button>

      {#if $isAdmin}
        <div style="padding: 10px 0;">
          <div style="width: 54px; height: 54px; border-radius: 50%; background: #eff6ff; border: 1.5px solid #bfdbfe; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; margin: 0 auto 16px auto;">
            <i class="fa-solid fa-shield-halved"></i>
          </div>
          <h2 style="font-size: 1.4rem; font-weight: 800; color: #0f172a; margin: 0 0 10px 0;">
            Compte Administrateur Actif
          </h2>
          <p style="font-size: 0.9rem; color: #475569; line-height: 1.5; margin: 0 0 24px 0;">
            Vous êtes connecté en tant qu'administrateur. Votre compte bénéficie d'un accès illimité à l'ensemble des fonctionnalités et des imports, sans aucun quota.
          </p>
          <button 
            type="button"
            onclick={handleClose}
            style="padding: 12px 28px; font-weight: 700; background: #0f172a; color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 0.92rem;"
          >
            Fermer
          </button>
        </div>
      {:else}
        <!-- Badge Premium -->
        <div style="display: inline-flex; align-items: center; gap: 8px; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 0.78rem; font-weight: 800; padding: 5px 14px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">
          <i class="fa-solid fa-crown" style="font-size: 0.8rem;"></i> FORMULE ILLIMITÉE
        </div>

        <h2 style="font-size: 1.55rem; font-weight: 800; color: #0f172a; margin: 0 0 10px 0; line-height: 1.25;">
          Débloquez la gestion illimitée
        </h2>

        <p style="font-size: 0.9rem; color: #475569; line-height: 1.5; margin: 0 0 24px 0;">
          Vous avez atteint la limite de <strong>60 écritures gratuites</strong>. Passez au forfait mensuel sans engagement pour gérer l'ensemble de votre comptabilité sans contrainte.
        </p>

        <!-- Avantages listés -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; text-align: left; margin-bottom: 24px; display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px; font-size: 0.88rem; color: #1e293b; font-weight: 600;">
            <i class="fa-solid fa-circle-check" style="color: #10b981;"></i> Écritures bancaires & imports CSV illimités
          </div>
          <div style="display: flex; align-items: center; gap: 10px; font-size: 0.88rem; color: #1e293b; font-weight: 600;">
            <i class="fa-solid fa-circle-check" style="color: #10b981;"></i> Multi-structures & dossiers illimités
          </div>
          <div style="display: flex; align-items: center; gap: 10px; font-size: 0.88rem; color: #1e293b; font-weight: 600;">
            <i class="fa-solid fa-circle-check" style="color: #10b981;"></i> Tous les exports officiels (FEC, CERFA, bilans)
          </div>
          <div style="display: flex; align-items: center; gap: 10px; font-size: 0.88rem; color: #1e293b; font-weight: 600;">
            <i class="fa-solid fa-circle-check" style="color: #10b981;"></i> Résiliable en 1 clic à tout moment sans motif
          </div>
        </div>

        <!-- Prix & CTA -->
        <div style="margin-bottom: 20px;">
          <div style="display: flex; align-items: baseline; justify-content: center; gap: 6px;">
            <span style="font-size: 2.3rem; font-weight: 800; color: #0f172a;">6,99 €</span>
            <span style="font-size: 0.95rem; color: #64748b; font-weight: 600;">/ mois TTC</span>
          </div>
          <span style="font-size: 0.78rem; color: #94a3b8;">Sans engagement • Facturation mensuelle • Annulation libre</span>
        </div>

        <button 
          onclick={handleStartSubscription}
          style="width: 100%; padding: 14px 24px; background: #090d16; color: #ffffff; font-size: 1rem; font-weight: 800; border-radius: 10px; border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25); display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.2s;"
        >
          <span>Activer mon abonnement sans engagement</span> ➔
        </button>

        <button 
          onclick={handleClose} 
          style="margin-top: 14px; background: none; border: none; color: #64748b; font-size: 0.82rem; font-weight: 600; cursor: pointer;"
        >
          Continuer avec le quota gratuit
        </button>
      {/if}

    </div>
  </div>
{/if}
