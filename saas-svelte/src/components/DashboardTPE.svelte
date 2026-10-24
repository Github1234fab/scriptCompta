<script>
  import { transactions, planComptable, activeEntityId, entities, activeView, showToast } from '../lib/store.js';
  import PageHeader from './PageHeader.svelte';
  import KpiCard from './KpiCard.svelte';

  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0] || { name: 'Ma Structure', model: 'tpe' });
  let accountingModel = $derived(activeEntity?.model || 'tpe');

  let activeTx = $derived($transactions.filter((/** @type {any} */ tx) => !tx.entityId || tx.entityId === $activeEntityId));

  let totalBanque = $derived(activeTx.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue' && tx.compteAttribué !== '530') {
      return sum + (tx.credit - tx.debit);
    }
    return sum;
  }, 0));

  let recettes = $derived(activeTx.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue') {
      const cpt = $planComptable.find((/** @type {any} */ p) => p.compte === tx.compteAttribué);
      if (cpt && cpt.type === 'Produit') return sum + tx.credit;
    }
    return sum;
  }, 0));

  let depenses = $derived(activeTx.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue') {
      const cpt = $planComptable.find((/** @type {any} */ p) => p.compte === tx.compteAttribué);
      if (cpt && cpt.type === 'Charge') return sum + tx.debit;
    }
    return sum;
  }, 0));

  let resultatNetEstime = $derived(recettes - depenses);

  // Cadran TVA (Collectée vs Déductible)
  let tvaCollectee = $derived(recettes * 0.20);
  let tvaDeductible = $derived(depenses * 0.20);
  let tvaNetteEstimee = $derived(Math.max(0, tvaCollectee - tvaDeductible));
  let vraiDisponible = $derived(totalBanque - tvaNetteEstimee);

  // Justificatifs & Pièces manquantes
  let debitsTotaux = $derived(activeTx.filter((/** @type {any} */ t) => t.debit > 0 && t.statut === 'attribue'));
  let piecesManquantesCount = $derived(debitsTotaux.filter((/** @type {any} */ t) => !t.factureUrl).length);

  let dashboardTitle = $derived((() => {
    if (accountingModel === 'bnc') return 'Tableau de bord · Profession Libérale (BNC)';
    if (accountingModel === 'sci') return 'Tableau de bord · SCI Familiale';
    return 'Tableau de bord · Société & TPE';
  })());

  let dashboardSubtitle = $derived((() => {
    if (accountingModel === 'bnc') return 'Suivi des honoraires, frais professionnels déductibles et liasse 2035.';
    if (accountingModel === 'sci') return 'Suivi des loyers encaissés, charges d’immeuble et déclaration 2072.';
    return 'Trésorerie réelle, provision TVA et suivi comptable.';
  })());

  let buttonLabel = $derived((() => {
    if (accountingModel === 'bnc') return 'Consulter la Déclaration 2035';
    if (accountingModel === 'sci') return 'Consulter le Registre SCI & 2072';
    return 'Consulter les Documents & FEC';
  })());

  let buttonIcon = $derived((() => {
    if (accountingModel === 'bnc') return 'fa-file-lines';
    if (accountingModel === 'sci') return 'fa-building';
    return 'fa-file-export';
  })());

  let recentTransactionsTitle = $derived((() => {
    if (accountingModel === 'bnc') return 'Flux bancaires récents du cabinet';
    if (accountingModel === 'sci') return 'Flux bancaires récents de la SCI';
    return 'Flux bancaires récents de la société';
  })());
</script>

<div style="padding: 24px;">
  <!-- PAGE HEADER -->
  <PageHeader 
    title={dashboardTitle} 
    subtitle={dashboardSubtitle} 
    buttonLabel={buttonLabel}
    buttonIcon={buttonIcon}
    onButtonClick={() => activeView.set('books')}
  />

  <!-- BANDEAU SÉRÉNITÉ : CARTES KPI ADAPTÉES AU MODÈLE -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px;">
    
    {#if accountingModel === 'bnc'}
      <KpiCard 
        label="Trésorerie Disponible" 
        value={totalBanque.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
        subtext="Solde bancaire disponible"
      />

      <KpiCard 
        label="Honoraires & Recettes BNC" 
        value={recettes.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
        subtext="Total des recettes professionnelles"
      />

      <KpiCard 
        label="Frais & Dépenses Déductibles" 
        value={depenses.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
        subtext="Charges déductibles de l'exercice"
      />

      <KpiCard 
        label="Bénéfice BNC Estimé (2035)" 
        value={resultatNetEstime.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
        subtext="Recettes décaissées − Frais professionnels"
      />

      <KpiCard 
        label="Justificatifs à Compléter" 
        value={`${piecesManquantesCount} pièce${piecesManquantesCount > 1 ? 's' : ''}`} 
        subtext={piecesManquantesCount > 0 ? "Justificatifs ou reçus à lier" : "100% des dépenses justifiées"}
      />
    {:else if accountingModel === 'sci'}
      <KpiCard 
        label="Trésorerie en Banque" 
        value={totalBanque.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
        subtext="Solde bancaire de la SCI"
      />

      <KpiCard 
        label="Loyers & Recettes Encaissés" 
        value={recettes.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
        subtext="Total des loyers perçus"
      />

      <KpiCard 
        label="Charges de Propriété" 
        value={depenses.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
        subtext="Entretien, assurances, taxe foncière"
      />

      <KpiCard 
        label="Résultat Net Foncier (2072)" 
        value={resultatNetEstime.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
        subtext="Revenu foncier net estimé"
      />

      <KpiCard 
        label="Justificatifs" 
        value={`${piecesManquantesCount} pièce${piecesManquantesCount > 1 ? 's' : ''}`} 
        subtext={piecesManquantesCount > 0 ? "Factures de charges à lier" : "Complet"}
      />
    {:else}
      <KpiCard 
        label="Trésorerie Réelle (Net TVA)" 
        value={vraiDisponible.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
        subtext="Après déduction de la provision TVA"
      />

      <KpiCard 
        label="Provision TVA Nette Due" 
        value={tvaNetteEstimee.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
        subtext="TVA collectée − TVA déductible"
      />

      <KpiCard 
        label="Chiffre d'Affaires HT" 
        value={recettes.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
        subtext="Produits d'exploitation facturés"
      />

      <KpiCard 
        label="Justificatifs à Compléter" 
        value={`${piecesManquantesCount} pièce${piecesManquantesCount > 1 ? 's' : ''}`} 
        subtext={piecesManquantesCount > 0 ? "Pièces manquantes à joindre" : "100% de vos dépenses sont sécurisées"}
      />
    {/if}

  </div>

  <!-- TABLEAU DÉLIMITÉ -->
  <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-card); padding: 20px;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
      <h3 style="margin: 0; font-size: 1rem; font-weight: 700; color: var(--text-main);">{recentTransactionsTitle}</h3>
      <button class="btn btn-sm" onclick={() => activeView.set('categorize')} style="background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-main); border-radius: var(--radius-sm); padding: 6px 12px; font-weight: 600; font-size: 0.82rem; cursor: pointer;">
        Accéder au rapprochement bancaire &rarr;
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
          {#if activeTx.length === 0}
            <tr>
              <td colspan="4" style="text-align: center; padding: 32px; color: var(--text-muted); font-size: 0.95rem;">
                Aucune opération bancaire enregistrée pour cette structure. Importez votre premier fichier CSV dans l'onglet Libellés & Attribution.
              </td>
            </tr>
          {:else}
            {#each activeTx.slice(0, 8) as tx}
              <tr>
                <td style="color: var(--text-muted); white-space: nowrap;">{tx.date}</td>
                <td style="font-weight: 600; color: var(--text-main);">{tx.libelle}</td>
                <td>
                  <span class="badge badge-muted">
                    {tx.compteNom || 'Attribution assistée'} ({tx.compteAttribué})
                  </span>
                </td>
                <td style="text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; color: {tx.credit > 0 ? 'var(--color-success)' : 'var(--text-main)'};">
                  {tx.credit > 0 ? '+' : ''}{(tx.credit || -tx.debit).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
