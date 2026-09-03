<script>
  import { transactions, members, donors, planComptable, activeEntityId, entities, activeView, showToast } from '../lib/store.js';

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

  let cotisationsEncaissées = $derived($transactions.reduce((sum, tx) => {
    if (tx.compteAttribué === '756' && tx.statut === 'attribue') {
      return sum + tx.credit;
    }
    return sum;
  }, 0));

  let donsEncaissés = $derived($transactions.reduce((sum, tx) => {
    if (tx.compteAttribué === '758' && tx.statut === 'attribue') {
      return sum + tx.credit;
    }
    return sum;
  }, 0));

  let resteAEncaisser = $derived($members.reduce((sum, m) => {
    const reste = m.forfait - m.dejaPaye;
    return sum + (reste > 0 ? reste : 0);
  }, 0));

  let retardsCount = $derived($members.filter(m => (m.forfait - m.dejaPaye) > 0).length);

  let pendingTxCount = $derived($transactions.filter(
    t => t.compteAttribué === '699' || t.statut === 'non_attribue' || t.statut === 'suggere'
  ).length);
</script>

<div class="page-title-section" style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 15px;">
  <div>
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
      <span class="badge badge-primary" style="font-size: 0.8rem; padding: 4px 10px; background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3);">🤝 Espace Association Loi 1901</span>
    </div>
    <h1 class="page-title" style="margin-bottom: 0;">Tableau de Bord Trésorier Associatif</h1>
  </div>
  
  <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); padding: 10px 18px; border-radius: var(--radius-md); text-align: right;">
    <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #818cf8; display: block;">Association active</span>
    <strong style="font-size: 1.1rem; color: white;">{activeEntity.name}</strong>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!-- 1. BLOC : PANORAMA FINANCIER (TRÉSORERIE & RECETTES ASSO) -->
<!-- ═══════════════════════════════════════════════════════════════════ -->
<div class="dashboard-section-block" style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: var(--radius-lg); padding: 22px; margin-top: 25px; margin-bottom: 25px;">
  <h2 style="font-family: var(--font-title); font-size: 1.25rem; font-weight: 700; color: white; margin-bottom: 18px; display: flex; align-items: center; gap: 10px;">
    <span style="background: rgba(99, 102, 241, 0.15); color: #818cf8; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1rem;">📊</span>
    Panorama Financier
  </h2>

  <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
    
    <!-- Trésorerie Globale -->
    <div class="glass-card highlight-primary">
      <div class="stat-icon primary"><i class="fa-solid fa-vault"></i></div>
      <div class="stat-label" style="font-size: 1.15rem; font-weight: 700; color: white; margin-bottom: 8px;">
        Solde Banque & Caisse
      </div>
      <div class="stat-value" style="font-size: 1.75rem; margin: 0; color: white;">
        {totalTrésorerie.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </div>
      <span style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-top: 6px;">Fonds associatifs disponibles</span>
    </div>

    <!-- Cotisations Encaissées -->
    <div class="glass-card highlight-success">
      <div class="stat-icon success"><i class="fa-solid fa-users"></i></div>
      <div class="stat-label" style="font-size: 1.15rem; font-weight: 700; color: #34d399; margin-bottom: 8px;">
        Cotisations Encaissées
      </div>
      <div class="stat-value" style="font-size: 1.75rem; margin: 0; color: #34d399;">
        {cotisationsEncaissées.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </div>
      <span style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-top: 6px;">Recettes adhésions (Compte 756)</span>
    </div>

    <!-- Dons & Mécénat -->
    <div 
      class="glass-card highlight-primary" 
      role="button"
      tabindex="0"
      onclick={() => activeView.set('donations')} 
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && activeView.set('donations')}
      style="cursor: pointer;"
    >
      <div class="stat-icon primary" style="background-color: rgba(236, 72, 153, 0.15); color: #ec4899;"><i class="fa-solid fa-hand-holding-heart"></i></div>
      <div class="stat-label" style="font-size: 1.15rem; font-weight: 700; color: white; margin-bottom: 8px;">
        Dons & Mécénat
      </div>
      <div class="stat-value" style="font-size: 1.75rem; margin: 0; color: #ec4899;">
        {donsEncaissés.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </div>
      <span style="font-size: 0.82rem; color: #ec4899; display: block; margin-top: 6px;">Générer des reçus fiscaux Cerfa ➔</span>
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

    <!-- Adhésions en Attente -->
    <div 
      class="glass-card highlight-warning" 
      role="button"
      tabindex="0"
      onclick={() => activeView.set('members')} 
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && activeView.set('members')}
      style="cursor: pointer;"
    >
      <div class="stat-icon warning"><i class="fa-solid fa-hand-holding-dollar"></i></div>
      <div class="stat-label" style="font-size: 1.15rem; font-weight: 700; color: white; margin-bottom: 8px;">
        Adhésions en Attente
      </div>
      <div class="stat-value" style="font-size: 1.75rem; margin: 0; color: #f59e0b;">
        {resteAEncaisser.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </div>
      <span style="font-size: 0.82rem; color: #f59e0b; display: block; margin-top: 6px;">{retardsCount} élève(s) à relancer ➔</span>
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
  
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
    <div class="glass-card">
      <h3 style="font-family: var(--font-title); font-size: 1.1rem; color: white; margin-bottom: 8px;">
        📜 Reçus Fiscaux (Dons / Mécénat)
      </h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.4;">
        Attestations Cerfa 11580*04 prêtes pour la réduction d'impôt de 66% au bénéfice de vos donateurs.
      </p>
      <button class="btn btn-secondary" onclick={() => activeView.set('donations')}>
        <i class="fa-solid fa-receipt"></i> Gérer les Reçus Fiscaux Cerfa
      </button>
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
    <div style="max-width: 650px;">
      <h3 style="font-family: var(--font-title); font-size: 1.08rem; color: white; margin-bottom: 6px;">
        Préparer le Rapport Financier d'AG
      </h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; margin: 0;">
        Votre obligation légale associative consiste à présenter un compte de résultat et un bilan d'exercice approuvés en AG. Générez la synthèse d'exercice en 1-clic.
      </p>
    </div>
    
    <div style="display: flex; gap: 12px;">
      <button class="btn btn-secondary" onclick={() => activeView.set('members')}>
        <i class="fa-solid fa-users"></i> Registre des Adhérents
      </button>
      <button class="btn btn-primary" onclick={() => activeView.set('books')}>
        <i class="fa-solid fa-file-invoice"></i> Rapport Financier AG
      </button>
    </div>
  </div>
</div>
