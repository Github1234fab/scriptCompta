<script>
  import { transactions, planComptable, activeEntityId, entities, activeView, showToast } from '../lib/store.js';

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
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
    <div>
      <h1 style="margin: 0; font-size: 1.4rem; font-weight: 800; color: var(--text-main);">Tableau de bord · Société & TPE</h1>
      <p style="margin: 4px 0 0 0; font-size: 0.86rem; color: var(--text-muted);">Trésorerie réelle, provision TVA et suivi comptable.</p>
    </div>
    <button class="btn btn-primary" onclick={() => activeView.set('books')} style="background: var(--color-primary); color: white; border: none; border-radius: var(--radius-sm); padding: 8px 16px; font-weight: 600; cursor: pointer;">
      <i class="fa-solid fa-file-export"></i> Exporter l'archive FEC pour l'expert
    </button>
  </div>

  <!-- BANDEAU SÉRÉNITÉ : 3 CARTES KPI -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-bottom: 24px;">
    
    <!-- CARTE 1 : Trésorerie Réelle (Net TVA) -->
    <div class="kpi-card" style="background: var(--bg-kpi); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px; box-shadow: var(--shadow-card);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Trésorerie Réelle (Net TVA)</span>
        <i class="fa-solid fa-building-columns" style="color: var(--color-accent); font-size: 1.1rem;"></i>
      </div>
      <div style="font-size: 1.8rem; font-weight: 800; color: var(--text-main); font-variant-numeric: tabular-nums;">
        {vraiDisponible.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </div>
      <span style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-top: 6px;">Après déduction de la TVA due</span>
    </div>

    <!-- CARTE 2 : TVA Nette à Décaisser -->
    <div class="kpi-card" style="background: var(--bg-kpi); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px; box-shadow: var(--shadow-card);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Provision TVA Nette Due</span>
        <i class="fa-solid fa-receipt" style="color: var(--color-warning); font-size: 1.1rem;"></i>
      </div>
      <div style="font-size: 1.8rem; font-weight: 800; color: var(--color-warning); font-variant-numeric: tabular-nums;">
        {tvaNetteEstimee.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </div>
      <span style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-top: 6px;">TVA collectée − TVA déductible</span>
    </div>

    <!-- CARTE 3 : Pièces Manquantes -->
    <div class="kpi-card" style="background: var(--bg-kpi); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px; box-shadow: var(--shadow-card);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Justificatifs à Compléter</span>
        <i class="fa-solid fa-box-archive" style="color: {piecesManquantesCount > 0 ? 'var(--color-warning)' : 'var(--color-success)'}; font-size: 1.1rem;"></i>
      </div>
      <div style="font-size: 1.8rem; font-weight: 800; color: var(--text-main); font-variant-numeric: tabular-nums;">
        {piecesManquantesCount} <span style="font-size: 0.9rem; font-weight: 500; color: var(--text-muted);">pièces</span>
      </div>
      <span style="font-size: 0.78rem; color: {piecesManquantesCount > 0 ? 'var(--color-warning)' : 'var(--color-success)'}; font-weight: 600; display: block; margin-top: 6px;">
        {piecesManquantesCount > 0 ? 'Exclusion automatique du bruit bancaire' : '100% de vos dépenses sont sécurisées'}
      </span>
    </div>

  </div>

  <!-- TABLEAU DÉLIMITÉ -->
  <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-card); padding: 20px;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
      <h3 style="margin: 0; font-size: 1rem; font-weight: 700; color: var(--text-main);">Flux bancaires récents de la société</h3>
      <button class="btn btn-sm" onclick={() => activeView.set('categorize')} style="background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-main); border-radius: var(--radius-sm); padding: 6px 12px; font-weight: 600; font-size: 0.82rem; cursor: pointer;">
        Accéder au rapprochement bancaire ➔
      </button>
    </div>

    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.88rem;">
        <thead>
          <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted); font-size: 0.78rem; text-transform: uppercase;">
            <th style="padding: 10px 12px;">Date</th>
            <th style="padding: 10px 12px;">Libellé Opération</th>
            <th style="padding: 10px 12px;">Nomenclature comptable</th>
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
                  {tx.compteNom || 'Attribution assistée IA'}
                </span>
                <span style="font-size: 0.72rem; color: var(--text-light); margin-left: 6px;">({tx.compteAttribué})</span>
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
