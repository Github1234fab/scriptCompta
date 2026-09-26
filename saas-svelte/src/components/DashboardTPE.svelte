<script>
  import { transactions, planComptable, activeEntityId, entities, activeView, showToast } from '../lib/store.js';
  import PageHeader from './PageHeader.svelte';
  import KpiCard from './KpiCard.svelte';

  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0] || { name: 'Ma Structure', model: 'tpe' });

  let totalBanque = $derived($transactions.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue' && tx.compteAttribué !== '530') {
      return sum + (tx.credit - tx.debit);
    }
    return sum;
  }, 0));

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
  let vraiDisponible = $derived(totalBanque - tvaNetteEstimee);

  // Justificatifs & Pièces manquantes
  let debitsTotaux = $derived($transactions.filter((/** @type {any} */ t) => t.debit > 0 && t.statut === 'attribue'));
  let piecesManquantesCount = $derived(debitsTotaux.filter((/** @type {any} */ t) => !t.factureUrl).length);
</script>

<div style="padding: 24px;">
  <!-- PAGE HEADER -->
  <PageHeader 
    title="Tableau de bord · Société & TPE" 
    subtitle="Trésorerie réelle, provision TVA et suivi comptable." 
    buttonLabel="Exporter l'archive FEC"
    buttonIcon="fa-file-export"
    onButtonClick={() => activeView.set('books')}
  />

  <!-- BANDEAU SÉRÉNITÉ : 3 CARTES KPI -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-bottom: 24px;">
    
    <KpiCard 
      label="Trésorerie Réelle (Net TVA)" 
      value={vraiDisponible.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
      icon="fa-building-columns" 
      subtext="Après déduction de la TVA due" 
      subtextIcon="fa-check-circle"
    />

    <KpiCard 
      label="Provision TVA Nette Due" 
      value={tvaNetteEstimee.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
      icon="fa-receipt" 
      iconColor="var(--color-warning)"
      subtext="TVA collectée − TVA déductible" 
      subtextIcon="fa-calculator"
      subtextColor="var(--color-warning)"
    />

    <KpiCard 
      label="Justificatifs à Compléter" 
      value={`${piecesManquantesCount} pièces`} 
      icon="fa-box-archive" 
      iconColor={piecesManquantesCount > 0 ? "var(--color-warning)" : "var(--color-success)"}
      subtext={piecesManquantesCount > 0 ? "Exclusion automatique du bruit bancaire" : "100% de vos dépenses sont sécurisées"} 
      subtextIcon={piecesManquantesCount > 0 ? "fa-shield" : "fa-shield-halved"}
      subtextColor={piecesManquantesCount > 0 ? "var(--color-warning)" : "var(--color-success)"}
    />

  </div>

  <!-- TABLEAU DÉLIMITÉ -->
  <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-card); padding: 20px;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
      <h3 style="margin: 0; font-size: 1rem; font-weight: 700; color: var(--text-main);">Flux bancaires récents de la société</h3>
      <button class="btn btn-sm" onclick={() => activeView.set('categorize')} style="background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-main); border-radius: var(--radius-sm); padding: 6px 12px; font-weight: 600; font-size: 0.82rem; cursor: pointer;">
        Accéder au rapprochement bancaire ➔
      </button>
    </div>

    <div class="table-container">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Libellé Opération</th>
            <th>Nomenclature comptable</th>
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
                  {tx.compteNom || 'Attribution assistée IA'} ({tx.compteAttribué})
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
