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
    if (accountingModel === 'bnc') return 'Accueil · Profession Libérale (BNC)';
    if (accountingModel === 'sci') return 'Accueil · SCI Familiale';
    if (accountingModel === 'copro') return 'Accueil · Copropriété';
    return 'Accueil · Société & TPE';
  })());

  let dashboardSubtitle = $derived((() => {
    if (accountingModel === 'bnc') return 'Suivi des honoraires, frais professionnels déductibles et liasse 2035.';
    if (accountingModel === 'sci') return 'Suivi des loyers encaissés, charges d’immeuble et déclaration 2072.';
    return 'Trésorerie réelle, provision TVA et suivi comptable.';
  })());

  let buttonLabel = $derived((() => {
    return 'Consulter mes Obligations';
  })());

  let buttonIcon = $derived((() => {
    return 'fa-scale-balanced';
  })());

  let recentTransactionsTitle = $derived((() => {
    if (accountingModel === 'bnc') return 'Flux bancaires récents du cabinet';
    if (accountingModel === 'sci') return 'Flux bancaires récents de la SCI';
    return 'Flux bancaires récents de la société';
  })());

  let pendingTxCount = $derived(activeTx.filter(
    t => t.compteAttribué === '699' || t.statut === 'non_attribue' || t.statut === 'suggere' || t.statut === 'a_attribuer'
  ).length);

  let totalTasksCount = $derived(pendingTxCount);

  let structureSectionTitle = $derived((() => {
    if (accountingModel === 'bnc') return 'Votre cabinet';
    if (accountingModel === 'sci') return 'Votre SCI';
    if (accountingModel === 'copro') return 'Votre copropriété';
    return 'Votre entreprise';
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

  <!-- 1. VOS TÂCHES (Uniquement les actions opérationnelles à mener) -->
  <div style="margin-bottom: 30px;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
      <h2 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">
        Vos tâches
      </h2>
      <span style="background: {pendingTxCount > 0 ? '#ef4444' : '#10b981'}; color: #ffffff; font-size: 0.74rem; font-weight: 800; padding: 2px 8px; border-radius: 9999px;">
        {totalTasksCount}
      </span>
    </div>

    <!-- BLOC GÉNÉRAL QUI ACCUEILLE LES BLOCS DE TÂCHES -->
    <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 12px;">
      <!-- Tâche: Rapprochement / Attribution (fond blanc) -->
      <div style="padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid var(--border-container); border-radius: 12px; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.02); flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 42px; height: 42px; border-radius: 10px; background: var(--bg-container); border: 1px solid var(--border-container); color: {pendingTxCount > 0 ? '#d97706' : '#16a34a'}; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;">
            <i class="fa-solid {pendingTxCount > 0 ? 'fa-arrows-split-up-and-left' : 'fa-circle-check'}"></i>
          </div>
          <div>
            <div style="font-weight: 700; font-size: 0.92rem; color: #0f172a;">
              {pendingTxCount > 0 ? `Vous devez attribuer ${pendingTxCount} opération${pendingTxCount > 1 ? 's' : ''}` : "Vous n'avez aucune attribution en attente"}
            </div>
            <div style="font-size: 0.8rem; color: #64748b;">
              {pendingTxCount > 0 ? 'Imputez ces mouvements bancaires pour équilibrer vos comptes et préparer la clôture.' : 'Toutes vos opérations sont classées et votre comptabilité est à jour.'}
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
    </div>
  </div>

  <!-- 2. VOTRE ENTREPRISE / STRUCTURE (Indicateurs clés) -->
  <div style="margin-bottom: 30px;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
      <h2 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">
        {structureSectionTitle} <span style="color: #2563eb; background: rgba(37, 99, 235, 0.09); padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(37, 99, 235, 0.2); font-size: 0.95rem; margin-left: 6px;">{activeEntity.name}</span>
      </h2>
      <span style="font-size: 0.82rem; color: #64748b; font-weight: 600;">
        Pilotage financier et indicateurs
      </span>
    </div>

    <!-- TITRE DE SECTION KPI : INDICATEURS -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
      <h3 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-chart-line" style="color: #2563eb; font-size: 0.95rem;"></i> Indicateurs
      </h3>
      <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">
        Trésorerie et résultat en direct
      </span>
    </div>

    <!-- BLOC GÉNÉRAL REGROUPANT TOUTES LES CARTES KPI -->
    <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
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
            label="Frais Déductibles" 
            value={depenses.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
            subtext="Charges déductibles de l'exercice"
          />

          <KpiCard 
            label="Bénéfice BNC Estimé (2035)" 
            value={resultatNetEstime.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
            subtext="Recettes décaissées − Frais professionnels"
          />

          <KpiCard 
            label="Justificatifs" 
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
            label="Justificatifs" 
            value={`${piecesManquantesCount} pièce${piecesManquantesCount > 1 ? 's' : ''}`} 
            subtext={piecesManquantesCount > 0 ? "Pièces manquantes à joindre" : "100% des dépenses sécurisées"}
          />
        {/if}
      </div>
    </div>
  </div>

  <!-- 3. DERNIÈRES ÉCRITURES BANCAIRES TRAITÉES (EXPLICITE & SANS JARGON) -->
  <div>
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
      <h2 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-list-check" style="color: #2563eb; font-size: 1rem;"></i> Dernières écritures bancaires traitées
      </h2>
      <span style="font-size: 0.82rem; color: #64748b; font-weight: 600;">
        Mouvements bancaires rapprochés et intégrés à votre comptabilité
      </span>
    </div>

    <!-- BLOC GÉNÉRAL QUI ACCUEILLE LE TABLEAU -->
    <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); padding: 18px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
        <h3 style="margin: 0; font-size: 0.98rem; font-weight: 800; color: #0f172a; font-family: var(--font-title);">{recentTransactionsTitle}</h3>
        <button class="btn btn-sm" onclick={() => activeView.set('categorize')} style="background: #ffffff; border: 1px solid var(--border-subtle); color: #0f172a; border-radius: 6px; padding: 6px 12px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          Voir toutes les opérations <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>

      <div class="table-container" style="border: 1px solid var(--border-container); border-radius: 12px; overflow: hidden; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <table class="custom-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: var(--bg-container); border-bottom: 1.5px solid var(--border-container);">
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
                  Aucune opération bancaire enregistrée pour cette structure. Importez votre premier fichier CSV dans l'onglet Attribution.
                </td>
              </tr>
            {:else}
              {#each activeTx.slice(0, 8) as tx}
                <tr style="border-bottom: 1px solid var(--border-container); background: #ffffff;">
                  <td style="color: var(--text-muted); white-space: nowrap;">{tx.date}</td>
                  <td style="font-weight: 600; color: var(--text-main);">{tx.libelle}</td>
                  <td>
                    <span class="badge badge-muted" style="background: var(--bg-subtle); border: 1px solid var(--border-subtle);">
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
</div>
