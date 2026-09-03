<script>
  import { transactions, planComptable, activeEntityId, entities, updateEntities, activeView, showToast } from '../lib/store.js';

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

  /** @param {string} newActivity */
  function updateActivity(newActivity) {
    const updated = $entities.map((/** @type {any} */ e) => {
      if (e.id === (activeEntity ? activeEntity.id : $activeEntityId)) {
        return { ...e, microActivity: newActivity };
      }
      return e;
    });
    updateEntities(updated);
    const currentRate = URSSAF_RATES[newActivity] || URSSAF_RATES.services_bic;
    showToast(`✅ Taux Urssaf mis à jour : ${(currentRate.rate * 100).toFixed(1)}% (${currentRate.label})`);
  }

  // Recettes encaissées (comptabilité d'encaissement pure)
  let caEncaissé = $derived($transactions.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue') {
      const cpt = $planComptable.find((/** @type {any} */ p) => p.compte === tx.compteAttribué);
      if (cpt && cpt.type === 'Produit') return sum + tx.credit;
    }
    return sum;
  }, 0));

  // Charges réelles (pour calculer la rentabilité nette)
  let depensesReelles = $derived($transactions.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue') {
      const cpt = $planComptable.find((/** @type {any} */ p) => p.compte === tx.compteAttribué);
      if (cpt && cpt.type === 'Charge') return sum + tx.debit;
    }
    return sum;
  }, 0));

  // Estimation Cotisations Urssaf selon le taux légal choisi
  let urssafEstimee = $derived(caEncaissé * activeRate);
  let revenuNetEstime = $derived(caEncaissé - urssafEstimee - depensesReelles);

  /** 
   * Helper formatting numbers with French thousand spaces (ex: 83 600 €)
   * @param {number} num 
   */
  function formatEuros(num) {
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  // Seuils Micro-entreprise maj officiels
  // Prestations: Base 37 500 €, Tolérance 41 250 €, Plafond 83 600 €
  // Vente: Base 85 000 €, Tolérance 93 500 €, Plafond 203 100 €
  let seuilTVABase = $derived(currentMicroActivity === 'vente_bic' ? 85000 : 37500);
  let seuilTVAToleranced = $derived(currentMicroActivity === 'vente_bic' ? 93500 : 41250);
  let seuilPlafondMicro = $derived(currentMicroActivity === 'vente_bic' ? 203100 : 83600);

  let pctSeuilTVA = $derived(Math.min(100, Math.round((caEncaissé / seuilTVABase) * 100)));
  let pctSeuilCA = $derived(Math.min(100, Math.round((caEncaissé / seuilPlafondMicro) * 100)));

  let isInTvaToleranceZone = $derived(caEncaissé >= seuilTVABase && caEncaissé <= seuilTVAToleranced);
  let isTvaExceeded = $derived(caEncaissé > seuilTVAToleranced);

  let pendingTxCount = $derived($transactions.filter(
    t => t.compteAttribué === '699' || t.statut === 'non_attribue' || t.statut === 'suggere'
  ).length);

  let obligationText = $derived(
    currentMicroActivity === 'vente_bic'
      ? "En tant que commerçant (Vente de marchandises & hébergement), votre obligation comptable légale (art. 286 du CGI) consiste à tenir à jour un Livre des Recettes ainsi qu'un Registre des Achats. Votre registre d'encaissements est mis à jour automatiquement à chaque tri bancaire."
      : "En tant que prestataire de services ou professionnel libéral, votre obligation comptable légale (art. 286 du CGI) consiste à tenir un Livre des Recettes chronologique et non modifiable. Votre registre d'encaissements est mis à jour automatiquement à chaque tri bancaire."
  );
</script>

<div class="page-title-section" style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 15px;">
  <div>
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
      <span class="badge badge-success" style="font-size: 0.8rem; padding: 4px 10px;">🚀 Espace Micro-Entreprise & Freelance</span>
    </div>
    <h1 class="page-title" style="margin-bottom: 0;">Tableau de Bord Micro-Entrepreneur</h1>
  </div>
  
  <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 10px 18px; border-radius: var(--radius-md); text-align: right;">
    <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #34d399; display: block;">Structure active</span>
    <strong style="font-size: 1.1rem; color: white;">{activeEntity.name}</strong>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!-- 1. BLOC : PANORAMA FINANCIER (MÉTÉO CA, URSSAF & REVENU NET) -->
<!-- ═══════════════════════════════════════════════════════════════════ -->
<div class="dashboard-section-block" style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: var(--radius-lg); padding: 22px; margin-top: 25px; margin-bottom: 25px;">
  <h2 style="font-family: var(--font-title); font-size: 1.25rem; font-weight: 700; color: white; margin-bottom: 18px; display: flex; align-items: center; gap: 10px;">
    <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1rem;">📊</span>
    Panorama Financier
  </h2>

  <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
    
    <!-- CA Encaissé -->
    <div class="glass-card highlight-primary">
      <div class="stat-icon primary"><i class="fa-solid fa-sack-dollar"></i></div>
      <div class="stat-label" style="font-size: 1.15rem; font-weight: 700; color: white; margin-bottom: 8px;">
        Chiffre d'Affaires Encaissé
      </div>
      <div class="stat-value" style="font-size: 1.75rem; margin: 0; color: white;">
        {caEncaissé.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </div>
      <span style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-top: 6px;">Base pour la déclaration Urssaf</span>
    </div>

    <!-- Estimation Urssaf -->
    <div class="glass-card highlight-warning" style="display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <div class="stat-icon warning"><i class="fa-solid fa-calculator"></i></div>
        <div class="stat-label" style="font-size: 1.15rem; font-weight: 700; color: #f59e0b; margin-bottom: 8px;">
          Cotisations Urssaf à Prévoir
        </div>
        <div class="stat-value" style="font-size: 1.75rem; margin: 0; color: #f59e0b;">
          {urssafEstimee.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </div>
      </div>

      <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(245, 158, 11, 0.2);">
        <label for="micro-activity-select" style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 4px;">
          Taux selon votre activité :
        </label>
        <select 
          id="micro-activity-select"
          value={currentMicroActivity} 
          onchange={(e) => updateActivity(/** @type {HTMLSelectElement} */ (e.target).value)}
          style="width: 100%; background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24; font-size: 0.78rem; font-weight: 600; border-radius: 6px; padding: 5px 8px; outline: none; cursor: pointer;"
        >
          <option value="services_bic" style="background: #11131e; color: white;">🛠️ Prestations BIC (21,4 % — Plafond 83 600 €)</option>
          <option value="services_bnc" style="background: #11131e; color: white;">💻 Libéral BNC / Dev (25,8 % — Plafond 83 600 €)</option>
          <option value="cipav_bnc" style="background: #11131e; color: white;">⚖️ Libéral CIPAV (23,4 % — Plafond 83 600 €)</option>
          <option value="vente_bic" style="background: #11131e; color: white;">🛒 Vente Mdes / Hébergement (12,4 % — Plafond 203 100 €)</option>
        </select>
      </div>
    </div>

    <!-- Rémunération Nette Réelle -->
    <div class="glass-card highlight-success" style="border: 1px solid rgba(52, 211, 153, 0.4);">
      <div class="stat-icon success"><i class="fa-solid fa-piggy-bank"></i></div>
      <div class="stat-label" style="font-size: 1.15rem; font-weight: 700; color: #34d399; margin-bottom: 8px;">
        Rémunération Nette Réelle
        <div class="tooltip-container">
          <span class="pedago-help-btn">?</span>
          <span class="tooltip-text">
            <strong>Rémunération Nette Réelle</strong>
            CA encaissé − Urssaf estimée − Vos dépenses réelles d'exploitation. C'est le vrai montant utilisable pour vous rémunérer sans piocher dans la trésorerie de sécurité !
          </span>
        </div>
      </div>
      <div class="stat-value" style="font-size: 1.75rem; margin: 0; color: #34d399;">
        {revenuNetEstime.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </div>
      <span style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-top: 6px;">Après Urssaf et charges réelles</span>
    </div>

  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!-- 2. BLOC : TÂCHES & ACTIONS À RÉALISER -->
<!-- ═══════════════════════════════════════════════════════════════════ -->
<div class="dashboard-section-block" style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-lg); padding: 22px; margin-bottom: 25px;">
  <h2 style="font-family: var(--font-title); font-size: 1.25rem; font-weight: 700; color: white; margin-bottom: 18px; display: flex; align-items: center; gap: 10px;">
    <span style="background: rgba(239, 68, 68, 0.15); color: #ef4444; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1rem;">⚡</span>
    Tâches & Actions à Réaliser
  </h2>

  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
    <!-- Opérations à trier -->
    <div 
      class="glass-card highlight-danger" 
      role="button"
      tabindex="0"
      onclick={() => activeView.set('categorize')} 
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && activeView.set('categorize')}
      style="cursor: pointer;"
    >
      <div class="stat-icon danger" style="background-color: rgba(239, 68, 68, 0.15); color: #ef4444;"><i class="fa-solid fa-bell"></i></div>
      <div class="stat-label" style="font-size: 1.15rem; font-weight: 700; color: white; margin-bottom: 8px;">
        Opérations à Classer
      </div>
      <div class="stat-value" style="font-size: 1.75rem; margin: 0; color: #ef4444;">
        {pendingTxCount} <span style="font-size: 0.95rem; font-weight: normal; color: var(--text-secondary);">lignes</span>
      </div>
      <span style="font-size: 0.82rem; color: #ef4444; display: block; margin-top: 6px;">Attribuer mon relevé bancaire ➔</span>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!-- 3. BLOC : INDICATEURS & SEUILS LÉGAUX -->
<!-- ═══════════════════════════════════════════════════════════════════ -->
<div class="dashboard-section-block" style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: var(--radius-lg); padding: 22px; margin-bottom: 25px;">
  <h2 style="font-family: var(--font-title); font-size: 1.25rem; font-weight: 700; color: white; margin-bottom: 18px; display: flex; align-items: center; gap: 10px;">
    <span style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1rem;">🛡️</span>
    Indicateurs & Seuils Légaux
  </h2>

  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
    <!-- Jauge Franchise TVA -->
    <div class="glass-card">
      <h3 style="font-family: var(--font-title); font-size: 1.1rem; color: white; margin-bottom: 12px; display: flex; align-items: center; gap: 10px;">
        <i class="fa-solid fa-shield-halved" style="color: {isTvaExceeded ? '#ef4444' : isInTvaToleranceZone ? '#f59e0b' : '#34d399'};"></i>
        Franchise de TVA (Seuil : {formatEuros(seuilTVABase)} €)
      </h3>
      <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.4;">
        En dessous de {formatEuros(seuilTVABase)} €, vous ne facturez pas de TVA ("TVA non applicable, art. 293 B du CGI"). Seuil de tolérance jusqu'à {formatEuros(seuilTVAToleranced)} €.
      </p>

      <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px;">
        <span>CA Encaissé : {formatEuros(caEncaissé)} € / {formatEuros(seuilTVABase)} €</span>
        <span style="color: {isTvaExceeded ? '#ef4444' : isInTvaToleranceZone ? '#f59e0b' : '#34d399'}; font-weight: 700;">
          {isInTvaToleranceZone ? '⚠️ Zone de tolérance' : isTvaExceeded ? '🚨 TVA Applicable' : `${pctSeuilTVA}% du seuil`}
        </span>
      </div>
      <div class="progress-bar-container" style="height: 10px;">
        <div class="progress-bar-fill" style="width: {pctSeuilTVA}%; background: {isTvaExceeded ? '#ef4444' : isInTvaToleranceZone ? '#f59e0b' : '#34d399'};"></div>
      </div>
    </div>

    <!-- Jauge Plafond Micro -->
    <div class="glass-card">
      <h3 style="font-family: var(--font-title); font-size: 1.1rem; color: white; margin-bottom: 12px; display: flex; align-items: center; gap: 10px;">
        <i class="fa-solid fa-chart-line" style="color: #38bdf8;"></i> Plafond du Statut Micro (Seuil : {formatEuros(seuilPlafondMicro)} €)
      </h3>
      <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.4;">
        Plafond annuel de chiffre d'affaires. Si vous dépassez ce montant deux années consécutives, vous sortez du statut micro-entrepreneur.
      </p>

      <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px;">
        <span>CA Encaissé : {formatEuros(caEncaissé)} € / {formatEuros(seuilPlafondMicro)} €</span>
        <span style="color: {pctSeuilCA >= 80 ? '#ef4444' : '#38bdf8'}; font-weight: 700;">{pctSeuilCA}% du plafond</span>
      </div>
      <div class="progress-bar-container" style="height: 10px;">
        <div class="progress-bar-fill" style="width: {pctSeuilCA}%; background: {pctSeuilCA >= 80 ? '#ef4444' : '#38bdf8'};"></div>
      </div>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!-- 4. BLOC : OBLIGATIONS LÉGALES -->
<!-- ═══════════════════════════════════════════════════════════════════ -->
<div class="dashboard-section-block" style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-lg); padding: 22px; margin-bottom: 20px;">
  <h2 style="font-family: var(--font-title); font-size: 1.25rem; font-weight: 700; color: white; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
    <span style="background: rgba(16, 185, 129, 0.15); color: #34d399; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1rem;">📋</span>
    Obligations Légales
  </h2>

  <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;">
    <div style="max-width: 750px;">
      <h3 style="font-family: var(--font-title); font-size: 1.08rem; color: white; margin-bottom: 6px;">
        Tenue du Livre des Recettes
      </h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; margin: 0;">
        {obligationText}
      </p>
    </div>
    <button class="btn btn-primary" onclick={() => activeView.set('recettes')}>
      <i class="fa-solid fa-book-journal-whills"></i> Consulter & Exporter le Livre des Recettes
    </button>
  </div>
</div>
