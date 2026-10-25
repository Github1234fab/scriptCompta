<script>
  import { transactions, members, donors, planComptable, activeEntityId, entities, activeView, showToast } from '../lib/store.js';
  import PageHeader from './PageHeader.svelte';
  import KpiCard from './KpiCard.svelte';

  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0] || { name: 'Mon Association', model: 'asso' });

  let activeTx = $derived($transactions.filter((/** @type {any} */ tx) => !tx.entityId || tx.entityId === $activeEntityId));

  let totalBanque = $derived(activeTx.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue' && tx.compteAttribué !== '530') {
      return sum + (tx.credit - tx.debit);
    }
    return sum;
  }, 0));

  let cotisationsEncaissées = $derived(activeTx.reduce((sum, tx) => {
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

  let pendingTxCount = $derived(activeTx.filter(
    t => t.compteAttribué === '699' || t.statut === 'non_attribue' || t.statut === 'suggere' || t.statut === 'a_attribuer'
  ).length);

  let totalTasksCount = $derived(pendingTxCount + (retardsCount > 0 ? 1 : 0));
</script>

<div style="padding: 24px;">
  <!-- PAGE HEADER -->
  <PageHeader 
    title="Accueil · Trésorerie Associative" 
    subtitle="Suivi des adhésions, cotisations et trésorerie disponible." 
    buttonLabel="Gérer les adhérents"
    buttonIcon="fa-user-group"
    onButtonClick={() => activeView.set('activity')}
  />

  <!-- 1. VOS TÂCHES (Uniquement les actions opérationnelles à mener) -->
  <div style="margin-bottom: 30px;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
      <h2 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">
        Vos tâches
      </h2>
      <span style="background: {pendingTxCount > 0 || retardsCount > 0 ? '#ef4444' : '#10b981'}; color: #ffffff; font-size: 0.74rem; font-weight: 800; padding: 2px 8px; border-radius: 9999px;">
        {totalTasksCount}
      </span>
    </div>

    <!-- BLOC GÉNÉRAL QUI ACCUEILLE LES BLOCS DE TÂCHES -->
    <div style="background: var(--bg-container, #f8fafc); border: 1.5px solid var(--border-container, #e2e8f0); border-radius: 16px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 12px;">
      <!-- Tâche 1: Attribution (fond blanc) -->
      <div style="padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid var(--border-container, #e2e8f0); border-radius: 12px; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.02); flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 42px; height: 42px; border-radius: 10px; background: var(--bg-subtle, #f1f5f9); border: 1px solid var(--border-subtle, #e2e8f0); color: {pendingTxCount > 0 ? '#d97706' : '#16a34a'}; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;">
            <i class="fa-solid {pendingTxCount > 0 ? 'fa-arrows-split-up-and-left' : 'fa-circle-check'}"></i>
          </div>
          <div>
            <div style="font-weight: 700; font-size: 0.92rem; color: #0f172a;">
              {pendingTxCount > 0 ? `Vous devez attribuer ${pendingTxCount} opération${pendingTxCount > 1 ? 's' : ''}` : "Vous n'avez aucune attribution en attente"}
            </div>
            <div style="font-size: 0.8rem; color: #64748b;">
              {pendingTxCount > 0 ? 'Affectez chaque mouvement au plan associatif pour actualiser la trésorerie et préparer les rapports.' : 'Toutes vos opérations sont classées et votre comptabilité est à jour.'}
            </div>
          </div>
        </div>
        <button 
          type="button"
          class="btn btn-sm" 
          onclick={() => activeView.set('categorize')}
          style="background: #0f172a; color: #ffffff; border: none; padding: 7px 16px; border-radius: 6px; font-weight: 700; font-size: 0.82rem; cursor: pointer;"
        >
          {pendingTxCount > 0 ? 'Attribuer' : 'Consulter'}
        </button>
      </div>

      <!-- Tâche 2: Cotisations / Adhésions en retard (fond blanc) -->
      {#if retardsCount > 0}
        <div style="padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid var(--border-container, #e2e8f0); border-radius: 12px; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.02); flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 42px; height: 42px; border-radius: 10px; background: var(--bg-subtle, #f1f5f9); border: 1px solid var(--border-subtle, #e2e8f0); color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;">
              <i class="fa-solid fa-clock-rotate-left"></i>
            </div>
            <div>
              <div style="font-weight: 700; font-size: 0.92rem; color: #0f172a;">
                Vous devez régulariser {retardsCount} adhésion{retardsCount > 1 ? 's' : ''} en attente
              </div>
              <div style="font-size: 0.8rem; color: #64748b;">
                Un solde de {resteAEncaisser.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} reste à recouvrer pour l'exercice.
              </div>
            </div>
          </div>
          <button 
            type="button"
            class="btn btn-sm" 
            onclick={() => activeView.set('activity')}
            style="background: #0f172a; color: #ffffff; border: none; padding: 7px 16px; border-radius: 6px; font-weight: 700; font-size: 0.82rem; cursor: pointer;"
          >
            Gérer les adhérents
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- 2. VOTRE ASSOCIATION (Indicateurs clés) -->
  <div style="margin-bottom: 30px;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
      <h2 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">
        Votre association <span style="color: #2563eb; background: rgba(37, 99, 235, 0.09); padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(37, 99, 235, 0.2); font-size: 0.95rem; margin-left: 6px;">{activeEntity.name}</span>
      </h2>
      <span style="font-size: 0.82rem; color: #64748b; font-weight: 600;">
        Synthèse financière en temps réel
      </span>
    </div>

    <!-- TITRE DE SECTION KPI : INDICATEURS -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
      <h3 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-chart-line" style="color: #2563eb; font-size: 0.95rem;"></i> Indicateurs
      </h3>
      <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">
        Trésorerie et cotisations en direct
      </span>
    </div>

    <!-- BLOC GÉNÉRAL REGROUPANT LES CARTES KPI -->
    <div style="background: var(--bg-container, #f8fafc); border: 1.5px solid var(--border-container, #e2e8f0); border-radius: 16px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px;">
        <KpiCard 
          label="Trésorerie Disponible" 
          value={totalBanque.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
          subtext="Solde bancaire disponible"
        />

        <KpiCard 
          label="Cotisations Encaissées" 
          value={cotisationsEncaissées.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
          subtext="Recettes adhésions cumulées"
        />

        <KpiCard 
          label="Adhésions à recouvrer" 
          value={resteAEncaisser.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
          subtext={`${retardsCount} adhésion${retardsCount > 1 ? 's' : ''} en attente`}
        />
      </div>
    </div>
  </div>

  <!-- 3. DERNIERS MOUVEMENTS DE TRÉSORERIE (EXPLICITE & SANS JARGON) -->
  <div>
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
      <h2 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-money-bill-transfer" style="color: #2563eb; font-size: 1rem;"></i> Derniers mouvements de trésorerie
      </h2>
      <span style="font-size: 0.82rem; color: #64748b; font-weight: 600;">
        Encaissements d'adhésions, dons et règlements de l'association
      </span>
    </div>

    <!-- LE BLOC GÉNÉRAL QUI ACCUEILLE LE TABLEAU -->
    <div style="background: var(--bg-container, #f8fafc); border: 1.5px solid var(--border-container, #e2e8f0); border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); padding: 18px;">
      
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
        <h3 style="margin: 0; font-size: 0.98rem; font-weight: 800; color: #0f172a; font-family: var(--font-title);">Dernières transactions associatives</h3>
        <button class="btn btn-sm" onclick={() => activeView.set('categorize')} style="background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; border-radius: 6px; padding: 6px 12px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          Voir toutes les opérations <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>

      <!-- Table conteneur blanc avec bordures grises -->
      <div class="table-container" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <table class="custom-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 1.5px solid #e2e8f0;">
              <th>Date</th>
              <th>Libellé Opération</th>
              <th>Attribution / Nature</th>
              <th style="text-align: right;">Montant</th>
            </tr>
          </thead>
          <tbody>
            {#each activeTx.slice(0, 8) as tx}
              <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
                <td style="color: var(--text-muted); white-space: nowrap;">{tx.date}</td>
                <td style="font-weight: 600; color: var(--text-main);">{tx.libelle}</td>
                <td>
                  <span class="badge badge-muted" style="background: #f8fafc; border: 1px solid #cbd5e1;">
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
</div>


