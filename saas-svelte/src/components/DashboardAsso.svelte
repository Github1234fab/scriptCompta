<script>
  import { transactions, members, donors, planComptable, activeEntityId, entities, activeView, showToast } from '../lib/store.js';
  import PageHeader from './PageHeader.svelte';
  import KpiCard from './KpiCard.svelte';

  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0] || { name: 'Mon Association', model: 'asso' });

  let totalBanque = $derived($transactions.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue' && tx.compteAttribué !== '530') {
      return sum + (tx.credit - tx.debit);
    }
    return sum;
  }, 0));

  let cotisationsEncaissées = $derived($transactions.reduce((sum, tx) => {
    if (tx.compteAttribué === '756' && tx.statut === 'attribue') {
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

<div style="padding: 24px;">
  <!-- PAGE HEADER -->
  <PageHeader 
    title="Tableau de bord · Trésorerie Associative" 
    subtitle="Suivi des adhésions, cotisations et trésorerie disponible." 
    buttonLabel="Gérer les adhérents"
    buttonIcon="fa-plus"
    onButtonClick={() => activeView.set('activity')}
  />

  <!-- BANDEAU SÉRÉNITÉ : 3 CARTES KPI -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-bottom: 24px;">
    
    <KpiCard 
      label="Trésorerie Disponible" 
      value={totalBanque.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
      icon="fa-vault" 
      subtext="Solde bancaire sain" 
      subtextIcon="fa-check-circle"
    />

    <KpiCard 
      label="Cotisations Encaissées" 
      value={cotisationsEncaissées.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
      icon="fa-users" 
      subtext="Recettes adhésions" 
      subtextIcon="fa-receipt"
    />

    <KpiCard 
      label="Adhésions à recouvrer" 
      value={resteAEncaisser.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
      icon="fa-clock" 
      iconColor="var(--color-warning)"
      subtext={`${retardsCount} adhésions en retard`} 
      subtextIcon="fa-triangle-exclamation"
      subtextColor="var(--color-warning)"
    />
  </div>

  <!-- LE TABLEAU DÉLIMITÉ EN CONTENEUR FERMÉ -->
  <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-card); padding: 20px;">
    
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
      <h3 style="margin: 0; font-size: 1rem; font-weight: 700; color: var(--text-main);">Dernières transactions associatives</h3>
      <button class="btn btn-sm" onclick={() => activeView.set('categorize')} style="background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-main); border-radius: var(--radius-sm); padding: 6px 12px; font-weight: 600; font-size: 0.82rem; cursor: pointer;">
        Voir toutes les opérations ➔
      </button>
    </div>

    <!-- Table -->
    <div class="table-container">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Libellé Opération</th>
            <th>Attribution / Nature</th>
            <th style="text-align: right;">Montant</th>
          </tr>
        </thead>
        <tbody>
          {#each $transactions.slice(0, 8) as tx}
            <tr>
              <td style="color: var(--text-muted); white-space: nowrap;">{tx.date}</td>
              <td style="font-weight: 600; color: var(--text-main);">{tx.libelle}</td>
              <td>
                <span class="badge badge-muted">
                  {tx.compteNom || 'Non attribué'}
                </span>
              </td>
              <td style="text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; color: {tx.credit > 0 ? 'var(--color-success)' : 'var(--text-main)'};">
                {tx.credit > 0 ? '+' : ''}{(tx.credit || -tx.debit).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

  </div>
</div>


