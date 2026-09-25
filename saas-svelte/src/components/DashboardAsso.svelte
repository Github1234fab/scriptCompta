<script>
  import { transactions, members, donors, planComptable, activeEntityId, entities, activeView, showToast } from '../lib/store.js';

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
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
    <div>
      <h1 style="margin: 0; font-size: 1.4rem; font-weight: 800; color: var(--text-main);">Tableau de bord · Trésorerie Associative</h1>
      <p style="margin: 4px 0 0 0; font-size: 0.86rem; color: var(--text-muted);">Suivi des adhésions, cotisations et trésorerie disponible.</p>
    </div>
    <button class="btn btn-primary" onclick={() => activeView.set('activity')} style="background: var(--color-primary); color: white; border: none; border-radius: var(--radius-sm); padding: 8px 16px; font-weight: 600; cursor: pointer;">
      <i class="fa-solid fa-plus"></i> Gérer les adhérents
    </button>
  </div>

  <!-- BANDEAU SÉRÉNITÉ : 3 CARTES KPI -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-bottom: 24px;">
    
    <!-- CARTE 1 : Trésorerie Globale -->
    <div class="kpi-card" style="background: var(--bg-kpi); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px; box-shadow: var(--shadow-card);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Trésorerie Disponible</span>
        <i class="fa-solid fa-vault" style="color: var(--color-accent); font-size: 1.1rem;"></i>
      </div>
      <div style="font-size: 1.8rem; font-weight: 800; color: var(--text-main); font-variant-numeric: tabular-nums;">
        {totalBanque.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </div>
      <span style="font-size: 0.78rem; color: var(--color-success); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; margin-top: 6px;">
        <i class="fa-solid fa-check-circle"></i> Solde bancaire sain
      </span>
    </div>

    <!-- CARTE 2 : Cotisations Encaissées -->
    <div class="kpi-card" style="background: var(--bg-kpi); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px; box-shadow: var(--shadow-card);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Cotisations Encaissées</span>
        <i class="fa-solid fa-users" style="color: var(--color-accent); font-size: 1.1rem;"></i>
      </div>
      <div style="font-size: 1.8rem; font-weight: 800; color: var(--text-main); font-variant-numeric: tabular-nums;">
        {cotisationsEncaissées.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </div>
      <span style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-top: 6px;">Recettes adhésions</span>
    </div>

    <!-- CARTE 3 : Retards & A Recouvrer -->
    <div class="kpi-card" style="background: var(--bg-kpi); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px; box-shadow: var(--shadow-card);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Reste à Recouvrer</span>
        <i class="fa-solid fa-clock-rotate-left" style="color: var(--color-warning); font-size: 1.1rem;"></i>
      </div>
      <div style="font-size: 1.8rem; font-weight: 800; color: var(--text-main); font-variant-numeric: tabular-nums;">
        {resteAEncaisser.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </div>
      <span style="font-size: 0.78rem; color: var(--color-warning); font-weight: 600; display: block; margin-top: 6px;">{retardsCount} adhésions en retard</span>
    </div>

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
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.88rem;">
        <thead>
          <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted); font-size: 0.78rem; text-transform: uppercase;">
            <th style="padding: 10px 12px;">Date</th>
            <th style="padding: 10px 12px;">Libellé Opération</th>
            <th style="padding: 10px 12px;">Attribution / Nature</th>
            <th style="padding: 10px 12px; text-align: right;">Montant</th>
          </tr>
        </thead>
        <tbody>
          {#each $transactions.slice(0, 8) as tx}
            <tr style="border-bottom: 1px solid var(--border-color);">
              <td style="padding: 12px; color: var(--text-muted); white-space: nowrap;">{tx.date}</td>
              <td style="padding: 12px; font-weight: 600; color: var(--text-main);">{tx.libelle}</td>
              <td style="padding: 12px;">
                <span style="background: var(--bg-primary); border: 1px solid var(--border-color); padding: 3px 8px; border-radius: 4px; font-size: 0.78rem; font-weight: 600; color: var(--text-muted);">
                  {tx.compteNom || 'Non attribué'}
                </span>
              </td>
              <td style="padding: 12px; text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; color: {tx.credit > 0 ? 'var(--color-success)' : 'var(--text-main)'};">
                {tx.credit > 0 ? '+' : ''}{(tx.credit || -tx.debit).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

  </div>
</div>


