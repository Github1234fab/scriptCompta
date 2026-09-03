<script>
  import { transactions, planComptable, activeEntityId, entities, activeView, showToast } from '../lib/store.js';

  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0]);

  let totalBanque = $derived($transactions.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue' && tx.compteAttribué !== '530') {
      return sum + (tx.credit - tx.debit);
    }
    return sum;
  }, 0));

  let totalCaisse = $derived($transactions.reduce((sum, tx) => {
    if (tx.compteAttribué === '530' && tx.statut === 'attribue') {
      return sum + (tx.credit - tx.debit);
    }
    return sum;
  }, 0));

  let totalTrésorerie = $derived(totalBanque + totalCaisse);

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

  // Cadran TVA (Collectée vs Déductible)
  let tvaCollectee = $derived(recettes * 0.20);
  let tvaDeductible = $derived(depenses * 0.20);
  let tvaNetteEstimee = $derived(Math.max(0, tvaCollectee - tvaDeductible));

  let vraiDisponible = $derived(totalTrésorerie - tvaNetteEstimee);
  let moyDepensesMensuelles = $derived(depenses > 0 ? (depenses / 3) : 300);
  let runwayMois = $derived(moyDepensesMensuelles > 0 ? (vraiDisponible / moyDepensesMensuelles).toFixed(1) : '12+');

  // Justificatifs & Pièces manquantes
  let debitsTotaux = $derived($transactions.filter((/** @type {any} */ t) => t.debit > 0 && t.statut === 'attribue'));
  let piecesManquantesCount = $derived(debitsTotaux.filter((/** @type {any} */ t) => !t.factureUrl).length);
  let scoreConformite = $derived(debitsTotaux.length > 0 ? Math.round(((debitsTotaux.length - piecesManquantesCount) / debitsTotaux.length) * 100) : 100);

  let pendingTxCount = $derived($transactions.filter(
    t => t.compteAttribué === '699' || t.statut === 'non_attribue' || t.statut === 'suggere'
  ).length);
</script>

<div class="page-title-section" style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 15px;">
  <div>
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
      <span class="badge badge-warning" style="font-size: 0.8rem; padding: 4px 10px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);">🏢 Espace Société & TPE (SASU, SARL, SAS)</span>
    </div>
    <h1 class="page-title" style="margin-bottom: 0;">Tableau de Bord Dirigeant TPE</h1>
  </div>
  
  <div style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); padding: 10px 18px; border-radius: var(--radius-md); text-align: right;">
    <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #38bdf8; display: block;">Structure active</span>
    <strong style="font-size: 1.1rem; color: white;">{activeEntity.name}</strong>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!-- 1. BLOC : PANORAMA FINANCIER (TRÉSORERIE & RUNWAY) -->
<!-- ═══════════════════════════════════════════════════════════════════ -->
<div class="dashboard-section-block" style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: var(--radius-lg); padding: 22px; margin-top: 25px; margin-bottom: 25px;">
  <h2 style="font-family: var(--font-title); font-size: 1.25rem; font-weight: 700; color: white; margin-bottom: 18px; display: flex; align-items: center; gap: 10px;">
    <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1rem;">📊</span>
    Panorama Financier
  </h2>

  <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
    
    <!-- Solde Bancaire Brut -->
    <div class="glass-card highlight-primary">
      <div class="stat-icon primary"><i class="fa-solid fa-wallet"></i></div>
      <div class="stat-label" style="font-size: 1.15rem; font-weight: 700; color: white; margin-bottom: 8px;">
        Solde Bancaire Brut
      </div>
      <div class="stat-value" style="font-size: 1.75rem; margin: 0; color: white;">
        {totalTrésorerie.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </div>
      <span style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-top: 6px;">Disponibilités réelles 512 + 530</span>
    </div>

    <!-- Vrai Disponible après TVA -->
    <div class="glass-card highlight-success" style="border: 1px solid rgba(52, 211, 153, 0.4);">
      <div class="stat-icon success"><i class="fa-solid fa-shield-halved"></i></div>
      <div class="stat-label" style="font-size: 1.15rem; font-weight: 700; color: #34d399; margin-bottom: 8px;">
        Le Vrai Disponible (Après TVA)
        <div class="tooltip-container">
          <span class="pedago-help-btn">?</span>
          <span class="tooltip-text">
            <strong>Vrai Disponible TPE</strong>
            Trésorerie nette après déduction de la TVA estimée due à l'État à la fin de la période.
          </span>
        </div>
      </div>
      <div class="stat-value" style="font-size: 1.75rem; margin: 0; color: #34d399;">
        {vraiDisponible.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </div>
      <span style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-top: 6px;">-{tvaNetteEstimee.toFixed(0)}€ de TVA estimée à reverser</span>
    </div>

    <!-- Runway / Autonomie -->
    <div class="glass-card highlight-warning">
      <div class="stat-icon warning"><i class="fa-solid fa-hourglass-half"></i></div>
      <div class="stat-label" style="font-size: 1.15rem; font-weight: 700; color: white; margin-bottom: 8px;">
        Autonomie (Runway)
      </div>
      <div class="stat-value" style="font-size: 1.75rem; margin: 0;">
        {runwayMois} <span style="font-size: 0.95rem; font-weight: normal; color: var(--text-secondary);">mois</span>
      </div>
      <span style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-top: 6px;">de réserve de fonctionnement</span>
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
  
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; text-align: center;">
    <div style="background: rgba(16, 185, 129, 0.05); padding: 15px; border-radius: var(--radius-sm); border: 1px solid rgba(16, 185, 129, 0.2);">
      <span style="font-size: 0.78rem; text-transform: uppercase; font-weight: 700; color: #34d399; display: block; margin-bottom: 4px;">TVA Collectée (Sur Ventes)</span>
      <strong style="font-size: 1.5rem; color: #34d399; font-family: var(--font-title);">+{tvaCollectee.toFixed(2)} €</strong>
    </div>

    <div style="background: rgba(239, 68, 68, 0.05); padding: 15px; border-radius: var(--radius-sm); border: 1px solid rgba(239, 68, 68, 0.2);">
      <span style="font-size: 0.78rem; text-transform: uppercase; font-weight: 700; color: #f87171; display: block; margin-bottom: 4px;">TVA Déductible (Sur Achats)</span>
      <strong style="font-size: 1.5rem; color: #f87171; font-family: var(--font-title);">-{tvaDeductible.toFixed(2)} €</strong>
    </div>

    <div style="background: rgba(56, 189, 248, 0.08); padding: 15px; border-radius: var(--radius-sm); border: 1px solid rgba(56, 189, 248, 0.3);">
      <span style="font-size: 0.78rem; text-transform: uppercase; font-weight: 700; color: #38bdf8; display: block; margin-bottom: 4px;">Solde Net TVA à Décaisser</span>
      <strong style="font-size: 1.5rem; color: #38bdf8; font-family: var(--font-title);">{tvaNetteEstimee.toFixed(2)} €</strong>
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
    <div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted);">Score de conformité pièces</span>
        <span class="badge {scoreConformite >= 90 ? 'badge-success' : 'badge-warning'}">{scoreConformite}% conforme</span>
      </div>
      <h3 style="font-family: var(--font-title); font-size: 1.1rem; color: white; margin-top: 6px;">
        {piecesManquantesCount === 0 ? '🎉 Dossier pré-comptable 100% propre ! Toutes les factures sont jointes.' : `⚠️ Il vous reste ${piecesManquantesCount} dépense(s) sans facture attachée.`}
      </h3>
    </div>
    
    <div style="display: flex; gap: 12px;">
      <button class="btn btn-secondary" onclick={() => activeView.set('pieces')}>
        <i class="fa-solid fa-receipt"></i> Gérer les pièces manquantes
      </button>
      <button class="btn btn-primary" onclick={() => activeView.set('books')}>
        <i class="fa-solid fa-paper-plane"></i> Transmettre à l'Expert (Export FEC)
      </button>
    </div>
  </div>
</div>
