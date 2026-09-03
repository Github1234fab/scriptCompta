<script>
  import { transactions, planComptable, members, activeEntityId, entities } from '../lib/store.js';

  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0]);

  /** @type {Record<string, { rate: number, label: string }>} */
  const URSSAF_RATES = {
    services_bic: { rate: 0.214, label: 'Prestations BIC (21,4% Total)' },
    services_bnc: { rate: 0.258, label: 'Professions Libérales BNC (25,8% Total)' },
    vente_bic: { rate: 0.124, label: 'Vente de marchandises BIC (12,4% Total)' },
    cipav_bnc: { rate: 0.234, label: 'Professions Libérales CIPAV (23,4% Total)' }
  };

  let currentMicroActivity = $derived(activeEntity?.microActivity || 'services_bic');
  let activeRateObj = $derived(URSSAF_RATES[currentMicroActivity] || URSSAF_RATES.services_bic);
  let activeRate = $derived(activeRateObj.rate);

  function formatEuros(num) {
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  let recettes = $derived($transactions.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue') {
      const cpt = $planComptable.find((/** @type {any} */ p) => p.compte === tx.compteAttribué);
      if (cpt && cpt.type === 'Produit') return sum + tx.credit;
    }
    return sum;
  }, 0));

  let depenses = $derived($transactions.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue') {
      const cpt = $planComptable.find((/** @type {any} */ p) => p.compte === tx.compteAttribué);
      if (cpt && cpt.type === 'Charge') return sum + tx.debit;
    }
    return sum;
  }, 0));

  // Micro metrics
  let urssafEstimee = $derived(recettes * activeRate);
  let seuilTVABase = $derived(currentMicroActivity === 'vente_bic' ? 85000 : 37500);
  let seuilTVAToleranced = $derived(currentMicroActivity === 'vente_bic' ? 93500 : 41250);
  let seuilPlafondMicro = $derived(currentMicroActivity === 'vente_bic' ? 203100 : 83600);

  let pctSeuilTVA = $derived(Math.min(100, Math.round((recettes / seuilTVABase) * 100)));
  let pctSeuilCA = $derived(Math.min(100, Math.round((recettes / seuilPlafondMicro) * 100)));
  let isInTvaToleranceZone = $derived(recettes >= seuilTVABase && recettes <= seuilTVAToleranced);
  let isTvaExceeded = $derived(recettes > seuilTVAToleranced);

  // TPE metrics
  let tvaCollectee = $derived(recettes * 0.20);
  let tvaDeductible = $derived(depenses * 0.20);
  let tvaNette = $derived(Math.max(0, tvaCollectee - tvaDeductible));
  let resultatEstime = $derived(recettes - depenses);

  // Asso metrics
  let resteAEncaisser = $derived($members.reduce((sum, m) => {
    const reste = m.forfait - m.dejaPaye;
    return sum + (reste > 0 ? reste : 0);
  }, 0));
  let nombreCotisantsRetard = $derived($members.filter(m => (m.forfait - m.dejaPaye) > 0).length);
</script>

<div class="page-title-section" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 15px;">
  <div>
    <h1 class="page-title">🎯 Radar des Échéances</h1>
    <p class="page-subtitle">Anticipez les échéances obligatoires propres à votre gestion ({activeEntity.name}) sans mauvaise surprise.</p>
  </div>
</div>

<div class="pedago-banner" style="margin-bottom: 25px;">
  <div class="pedago-banner-icon">🛡️</div>
  <div class="pedago-banner-text">
    <h4>Échéances de la structure active ({activeEntity.model === 'micro' ? 'Micro-Entreprise' : activeEntity.model === 'tpe' ? 'Société / TPE' : 'Association'}) :</h4>
    <p>Ce radar calcule automatiquement vos prochaines obligations légales, fiscales et sociales en fonction de votre modèle de gestion sélectionné.</p>
  </div>
</div>

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 25px; margin-bottom: 30px;">
  
  {#if activeEntity.model === 'micro'}
    <!-- 1. Échéance Urssaf -->
    <div class="glass-card highlight-warning">
      <h3 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 700; color: #f59e0b; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-calculator"></i> Cotisations Urssaf à Déclarer
      </h3>
      <div style="font-size: 1.75rem; font-weight: 700; color: #f59e0b; font-family: var(--font-title); margin-bottom: 8px;">
        {urssafEstimee.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </div>
      <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 12px;">Montant estimé au taux de {(activeRate * 100).toFixed(1)}% sur {recettes.toFixed(0)} € de CA.</p>
      <span class="badge badge-warning" style="font-size: 0.78rem;">Prochaine déclaration mensuelle / trimestrielle</span>
    </div>

    <!-- 2. Radar Franchise TVA -->
    <div class="glass-card">
      <h3 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 700; color: white; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-shield-halved" style="color: {isTvaExceeded ? '#ef4444' : isInTvaToleranceZone ? '#f59e0b' : '#34d399'};"></i> Franchise de TVA
      </h3>
      <div style="font-size: 1.5rem; font-weight: 700; color: white; font-family: var(--font-title); margin-bottom: 8px;">
        {formatEuros(recettes)} € / {formatEuros(seuilTVABase)} €
      </div>
      <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 12px;">Seuil de tolérance jusqu'à {formatEuros(seuilTVAToleranced)} €.</p>
      <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 600; margin-bottom: 4px;">
        <span>Niveau de franchise</span>
        <span style="color: {isTvaExceeded ? '#ef4444' : isInTvaToleranceZone ? '#f59e0b' : '#34d399'};">{pctSeuilTVA}%</span>
      </div>
      <div class="progress-bar-container" style="height: 8px;">
        <div class="progress-bar-fill" style="width: {pctSeuilTVA}%; background: {isTvaExceeded ? '#ef4444' : isInTvaToleranceZone ? '#f59e0b' : '#34d399'};"></div>
      </div>
    </div>

    <!-- 3. Plafond Micro -->
    <div class="glass-card">
      <h3 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 700; color: white; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-chart-line" style="color: #38bdf8;"></i> Plafond Statut Micro
      </h3>
      <div style="font-size: 1.5rem; font-weight: 700; color: #38bdf8; font-family: var(--font-title); margin-bottom: 8px;">
        {formatEuros(recettes)} € / {formatEuros(seuilPlafondMicro)} €
      </div>
      <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 12px;">Plafond annuel maximal du régime micro.</p>
      <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 600; margin-bottom: 4px;">
        <span>Consommation du plafond</span>
        <span style="color: {pctSeuilCA >= 80 ? '#ef4444' : '#38bdf8'};">{pctSeuilCA}%</span>
      </div>
      <div class="progress-bar-container" style="height: 8px;">
        <div class="progress-bar-fill" style="width: {pctSeuilCA}%; background: {pctSeuilCA >= 80 ? '#ef4444' : '#38bdf8'};"></div>
      </div>
    </div>

  {:else if activeEntity.model === 'tpe'}
    <!-- 1. TVA Nette TPE -->
    <div class="glass-card highlight-primary">
      <h3 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 700; color: #38bdf8; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-file-invoice-dollar"></i> Estimation TVA Nette à Décaisser
      </h3>
      <div style="font-size: 1.75rem; font-weight: 700; color: #38bdf8; font-family: var(--font-title); margin-bottom: 8px;">
        {tvaNette.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </div>
      <p style="font-size: 0.82rem; color: var(--text-secondary);">TVA collectée ({tvaCollectee.toFixed(0)}€) − TVA déductible ({tvaDeductible.toFixed(0)}€).</p>
      <span class="badge badge-info" style="font-size: 0.78rem; margin-top: 8px;">Déclaration mensuelle CA12 / CA3</span>
    </div>

    <!-- 2. Résultat imposable prévisionnel -->
    <div class="glass-card">
      <h3 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 700; color: white; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-scale-balanced" style="color: #34d399;"></i> Résultat Bruts Imposable (IS)
      </h3>
      <div style="font-size: 1.75rem; font-weight: 700; color: #34d399; font-family: var(--font-title); margin-bottom: 8px;">
        {resultatEstime.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </div>
      <p style="font-size: 0.82rem; color: var(--text-secondary);">Base d'imposition prévisionnelle pour le bilan et la liasse fiscale.</p>
    </div>

    <!-- 3. Échéance Liasse Fiscale -->
    <div class="glass-card">
      <h3 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 700; color: white; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-calendar-check" style="color: #f59e0b;"></i> Clôture & Liasse Fiscale
      </h3>
      <div style="font-size: 1.1rem; font-weight: 700; color: white; margin-bottom: 8px;">
        Clôture au 31 Décembre
      </div>
      <p style="font-size: 0.82rem; color: var(--text-secondary);">Transmission du bilan comptable et dépôt du résultat sous 4 mois.</p>
    </div>

  {:else}
    <!-- 1. Cotisations & Adhésions Asso -->
    <div class="glass-card highlight-success">
      <h3 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 700; color: #34d399; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-hand-holding-heart"></i> Adhésions & Cotisations à Recouvrer
      </h3>
      <div style="font-size: 1.75rem; font-weight: 700; color: #34d399; font-family: var(--font-title); margin-bottom: 8px;">
        {resteAEncaisser.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </div>
      <p style="font-size: 0.82rem; color: var(--text-secondary);">{nombreCotisantsRetard} membre(s) à relancer pour régulariser le paiement.</p>
    </div>

    <!-- 2. Reçus Fiscaux CERFA -->
    <div class="glass-card">
      <h3 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 700; color: white; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-receipt" style="color: #ec4899;"></i> Attestations & Reçus Fiscaux CERFA
      </h3>
      <div style="font-size: 1.1rem; font-weight: 700; color: white; margin-bottom: 8px;">
        Prêt pour émission
      </div>
      <p style="font-size: 0.82rem; color: var(--text-secondary);">Délivrance automatique des justificatifs de réduction d'impôt (66%).</p>
    </div>

    <!-- 3. Assemblée Générale -->
    <div class="glass-card">
      <h3 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 700; color: white; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-users-gear" style="color: #38bdf8;"></i> Assemblée Générale Annuelle
      </h3>
      <div style="font-size: 1.1rem; font-weight: 700; color: white; margin-bottom: 8px;">
        Rapport Moral & Financier
      </div>
      <p style="font-size: 0.82rem; color: var(--text-secondary);">Présentation des comptes de l'exercice et approbation par les adhérents.</p>
    </div>
  {/if}

</div>
