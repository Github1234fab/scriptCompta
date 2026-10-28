<script>
  import { transactions, members, donors, planComptable, activeEntityId, entities, activeView, showToast, formatDateFr, initialBankBalance, updateInitialBankBalance } from '../lib/store.js';
  import { Categorizer } from '../lib/categorizer.js';
  import PageHeader from './PageHeader.svelte';
  import KpiCard from './KpiCard.svelte';

  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0] || { name: 'Mon Association', model: 'asso' });

  let activeTx = $derived($transactions.filter((/** @type {any} */ tx) => !tx.entityId || tx.entityId === $activeEntityId));

  let totalBanque = $derived($initialBankBalance + activeTx.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue' && tx.compteAttribué !== '530') {
      return sum + (tx.credit - tx.debit);
    }
    return sum;
  }, 0));

  let cotisationsEncaissées = $derived(activeTx.reduce((sum, tx) => {
    const isCotisOuCours = tx.compteAttribué === '756' || tx.compteAttribué === '706' || (tx.compteAttribué && tx.compteAttribué.startsWith('706'));
    if (isCotisOuCours && tx.statut === 'attribue') {
      return sum + tx.credit;
    }
    return sum;
  }, 0));

  let totalRecettes = $derived(activeTx.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue') {
      const cpt = $planComptable.find((/** @type {any} */ p) => p.compte === tx.compteAttribué);
      const isProduit = (cpt && cpt.type === 'Produit') || (tx.compteAttribué && tx.compteAttribué.startsWith('7'));
      if (isProduit) return sum + ((tx.credit || 0) - (tx.debit || 0));
    }
    return sum;
  }, 0));

  let totalCharges = $derived(activeTx.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue') {
      const cpt = $planComptable.find((/** @type {any} */ p) => p.compte === tx.compteAttribué);
      const isCharge = (cpt && cpt.type === 'Charge') || (tx.compteAttribué && tx.compteAttribué.startsWith('6'));
      if (isCharge) return sum + ((tx.debit || 0) - (tx.credit || 0));
    }
    return sum;
  }, 0));

  let resultatNet = $derived(totalRecettes - totalCharges);

  let resteAEncaisser = $derived($members.reduce((sum, m) => {
    const reste = m.forfait - m.dejaPaye;
    return sum + (reste > 0 ? reste : 0);
  }, 0));

  let retardsCount = $derived($members.filter(m => (m.forfait - m.dejaPaye) > 0).length);

  let pendingTxCount = $derived(activeTx.filter(
    t => t.compteAttribué === '699' || t.statut === 'non_attribue' || t.statut === 'suggere' || t.statut === 'a_attribuer'
  ).length);

  let totalTasksCount = $derived(pendingTxCount + (retardsCount > 0 ? 1 : 0));

  let sortedActiveTx = $derived(
    activeTx.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  );

  let showAllTransactions = $state(false);
  let txSearch = $state('');
  let currentPage = $state(1);
  const itemsPerPage = 50;

  let filteredTx = $derived(
    (() => {
      if (!txSearch.trim()) return sortedActiveTx;
      const q = txSearch.toLowerCase().trim();
      const qClean = q.replace(/€|\s/g, '').replace(',', '.');
      const qNum = parseFloat(qClean);
      const isNumericQuery = !isNaN(qNum) && qClean !== '' && !isNaN(Number(qClean));

      const matched = sortedActiveTx.filter(t => {
        // 1. Libellé, compte, nature
        const lib = (t.libelle || '').toLowerCase();
        const cat = t.compteAttribué ? Categorizer.obtenirLibelleCompte(t.compteAttribué).toLowerCase() : '';
        const compte = String(t.compteAttribué || '');
        const nom = (t.compteNom || '').toLowerCase();

        const textMatch = lib.includes(q) || cat.includes(q) || compte.includes(q) || nom.includes(q);

        // 2. Montants
        const debit = Number(t.debit) || 0;
        const credit = Number(t.credit) || 0;
        const net = credit > 0 ? credit : -debit;
        const abs = Math.abs(net);

        const absFixed = abs.toFixed(2);
        const absComma = absFixed.replace('.', ',');
        const absInt = String(Math.floor(abs));
        const netFixed = net.toFixed(2);
        const netComma = netFixed.replace('.', ',');
        const netInt = String(Math.floor(net));
        const currencyFr = net.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }).toLowerCase();

        const amountMatch =
          absFixed.includes(q) ||
          absComma.includes(q) ||
          absInt.includes(q) ||
          netFixed.includes(q) ||
          netComma.includes(q) ||
          netInt.includes(q) ||
          currencyFr.includes(q) ||
          (isNumericQuery && (Math.abs(abs - Math.abs(qNum)) < 0.001 || Math.abs(net - qNum) < 0.001));

        return textMatch || amountMatch;
      });

      // Si recherche numérique (ex: "150"), prioriser les montants exacts en tête de liste
      if (isNumericQuery) {
        return matched.slice().sort((a, b) => {
          const aNet = (Number(a.credit) || 0) > 0 ? Number(a.credit) : -Number(a.debit);
          const bNet = (Number(b.credit) || 0) > 0 ? Number(b.credit) : -Number(b.debit);
          const aAbs = Math.abs(aNet);
          const bAbs = Math.abs(bNet);

          const aExact = Math.abs(aAbs - Math.abs(qNum)) < 0.001 || Math.abs(aNet - qNum) < 0.001;
          const bExact = Math.abs(bAbs - Math.abs(qNum)) < 0.001 || Math.abs(bNet - qNum) < 0.001;

          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
      }

      return matched;
    })()
  );

  let totalPages = $derived(Math.max(1, Math.ceil(filteredTx.length / itemsPerPage)));

  let displayedTx = $derived(
    showAllTransactions
      ? filteredTx.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
      : sortedActiveTx.slice(0, 8)
  );

  let showInitialBalanceModal = $state(false);
  let tempInitialBalance = $state('');

  function openInitialBalanceModal() {
    tempInitialBalance = $initialBankBalance ? String($initialBankBalance) : '';
    showInitialBalanceModal = true;
  }

  function saveInitialBalance() {
    const val = parseFloat(tempInitialBalance.replace(/\s/g, '').replace(',', '.')) || 0;
    updateInitialBankBalance(val);
    showInitialBalanceModal = false;
    showToast(`Solde initial de trésorerie défini à ${val.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`);
  }

  function toggleShowAll() {
    showAllTransactions = !showAllTransactions;
    currentPage = 1;
    txSearch = '';
  }
</script>

<div style="padding: 24px;">
  <!-- PAGE HEADER -->
  <PageHeader 
    title="Accueil · Trésorerie Associative" 
    subtitle="Suivi des adhésions, cotisations et trésorerie disponible." 
  />

  <!-- 1. VOTRE ASSOCIATION (Indicateurs clés) -->
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
    <!-- 1. BLOC GÉNÉRAL INDICATEURS (ENGLOBANT LE TITRE) -->
    <div style="background: var(--bg-container, #f8fafc); border: 1.5px solid var(--border-container, #e2e8f0); border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); margin-bottom: 30px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
        <h3 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-chart-line" style="color: #2563eb; font-size: 0.95rem;"></i> Indicateurs
        </h3>
        <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">
          Trésorerie et cotisations en direct
        </span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
        <KpiCard 
          label="Trésorerie Disponible" 
          value={totalBanque.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
          subtext={$initialBankBalance !== 0 ? `Solde réel (dont ${$initialBankBalance.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} au départ)` : 'Solde de départ non configuré (0,00 €)'}
          actionLabel={$initialBankBalance !== 0 ? "Modifier départ" : "Définir solde initial"}
          onAction={openInitialBalanceModal}
        />

        <KpiCard 
          label="Dépenses & Charges" 
          value={totalCharges.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
          subtext="Achats, frais, prestations payées"
        />

        <KpiCard 
          label={resultatNet >= 0 ? "Excédent de l'exercice" : "Déficit de l'exercice"} 
          value={(resultatNet >= 0 ? '+' : '') + resultatNet.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
          subtext="Recettes encaissées − Dépenses payées"
          textColor={resultatNet >= 0 ? '#16a34a' : '#dc2626'}
        />

        <KpiCard 
          label="Cotisations & Cours Encaissés" 
          value={cotisationsEncaissées.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
          subtext="Recettes adhérents & élèves (756, 706)"
        />

        <KpiCard 
          label="Adhésions à recouvrer" 
          value={resteAEncaisser.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
          subtext={`${retardsCount} adhésion${retardsCount > 1 ? 's' : ''} en attente`}
        />
      </div>
    </div>

    <!-- 2. BLOC GÉNÉRAL TÂCHES À EFFECTUER (ENGLOBANT LE TITRE) -->
    <div style="background: var(--bg-container, #f8fafc); border: 1.5px solid var(--border-container, #e2e8f0); border-radius: 16px; padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); margin-bottom: 30px; display: flex; flex-direction: column; gap: 12px; max-width: 580px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <h3 style="font-family: var(--font-title); font-size: 1.02rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-list-check" style="color: #2563eb; font-size: 0.92rem;"></i> Tâches à effectuer
        </h3>
        <span style="background: {pendingTxCount > 0 || retardsCount > 0 ? '#ef4444' : '#10b981'}; color: #ffffff; font-size: 0.74rem; font-weight: 800; padding: 2px 8px; border-radius: 9999px;">
          {totalTasksCount}
        </span>
      </div>

      <!-- Tâche 1: Attribution (fond blanc sans bordure) -->
      <div style="padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border: 1px solid #e2e8f0; border-radius: 12px; background: var(--bg-card, #ffffff); box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05); max-width: 540px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 38px; height: 38px; border-radius: 10px; background: var(--bg-subtle, #f1f5f9); border: none; color: {pendingTxCount > 0 ? '#d97706' : '#16a34a'}; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">
            <i class="fa-solid {pendingTxCount > 0 ? 'fa-arrows-split-up-and-left' : 'fa-circle-check'}"></i>
          </div>
          <div>
            <div style="font-weight: 700; font-size: 0.88rem; color: #0f172a;">
              {pendingTxCount > 0 ? `Vous devez attribuer ${pendingTxCount} opération${pendingTxCount > 1 ? 's' : ''}` : "Vous n'avez aucune attribution en attente"}
            </div>
            <div style="font-size: 0.78rem; color: #64748b; line-height: 1.35;">
              {pendingTxCount > 0 ? 'Affectez chaque mouvement au plan associatif pour actualiser la trésorerie et préparer les rapports.' : 'Toutes vos opérations sont classées et votre comptabilité est à jour.'}
            </div>
          </div>
        </div>
        <button 
          type="button" 
          class="btn btn-sm" 
          onclick={() => activeView.set('categorize')}
          style="background: #0f172a; color: #ffffff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer; flex-shrink: 0;"
        >
          {pendingTxCount > 0 ? 'Attribuer' : 'Consulter'}
        </button>
      </div>

      <!-- Tâche 2: Cotisations / Adhésions en retard (fond blanc sans bordure) -->
      {#if retardsCount > 0}
        <div style="padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border: 1px solid #e2e8f0; border-radius: 12px; background: var(--bg-card, #ffffff); box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05); max-width: 540px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 38px; height: 38px; border-radius: 10px; background: var(--bg-subtle, #f1f5f9); border: none; color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">
              <i class="fa-solid fa-clock-rotate-left"></i>
            </div>
            <div>
              <div style="font-weight: 700; font-size: 0.88rem; color: #0f172a;">
                Vous devez régulariser {retardsCount} adhésion{retardsCount > 1 ? 's' : ''} en attente
              </div>
              <div style="font-size: 0.78rem; color: #64748b; line-height: 1.35;">
                Un solde de {resteAEncaisser.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} reste à recouvrer pour l'exercice.
              </div>
            </div>
          </div>
          <button 
            type="button" 
            class="btn btn-sm" 
            onclick={() => activeView.set('activity')}
            style="background: #0f172a; color: #ffffff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer; flex-shrink: 0;"
          >
            Gérer les recettes
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- 3. DERNIERS MOUVEMENTS DE TRÉSORERIE (ENGLOBANT LE TITRE) -->
  <div style="background: var(--bg-container, #f8fafc); border: 1.5px solid var(--border-container, #e2e8f0); border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); padding: 20px; margin-bottom: 30px;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
      <div>
        <h2 style="font-family: var(--font-title); font-size: 1.12rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-money-bill-transfer" style="color: #2563eb; font-size: 0.95rem;"></i>
          {#if showAllTransactions}
            Mouvements de trésorerie ({txSearch.trim() ? `${filteredTx.length} résultat${filteredTx.length > 1 ? 's' : ''}` : `${activeTx.length} opérations`})
          {:else}
            Derniers mouvements de trésorerie
          {/if}
        </h2>
        <span style="font-size: 0.8rem; color: #64748b; font-weight: 600; margin-top: 2px; display: block;">
          {#if showAllTransactions}
            {txSearch.trim() ? `Recherche parmi les ${activeTx.length} opérations de l'association` : 'Historique complet des opérations bancaires et comptables'}
          {:else}
            Encaissements d'adhésions, dons et règlements de l'association
          {/if}
        </span>
      </div>

      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
        {#if showAllTransactions}
          <!-- Champ de recherche en direct -->
          <div style="position: relative; display: flex; align-items: center;">
            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 10px; color: #94a3b8; font-size: 0.78rem; pointer-events: none;"></i>
            <input 
              type="text" 
              placeholder="Libellé, compte, montant..." 
              bind:value={txSearch} 
              oninput={() => currentPage = 1}
              style="padding: 6px 12px 6px 30px; font-size: 0.82rem; border: 1.5px solid #cbd5e1; border-radius: 8px; width: 230px; background: #ffffff;"
            />
          </div>
        {/if}

        <button 
          type="button"
          class="btn btn-sm" 
          onclick={toggleShowAll} 
          style="background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; border-radius: 6px; padding: 6px 14px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s ease;"
          onmouseenter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
          onmouseleave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
        >
          {#if showAllTransactions}
            <i class="fa-solid fa-chevron-up"></i>
            Réduire l'affichage (8 dernières)
          {:else}
            Voir toutes les opérations ({activeTx.length})
            <i class="fa-solid fa-chevron-down"></i>
          {/if}
        </button>
      </div>
    </div>

    <!-- Table conteneur blanc sans bordure avec ombre douce -->
    <div class="table-container" style="border: none; border-radius: 12px; overflow: hidden; background: #ffffff; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.06);">
      <table class="custom-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f8fafc; border-bottom: 1.5px solid #e2e8f0;">
            <th style="padding: 12px 14px; font-weight: 700; font-size: 0.8rem; color: #475569; text-transform: uppercase;">Date</th>
            <th style="padding: 12px 14px; font-weight: 700; font-size: 0.8rem; color: #475569; text-transform: uppercase;">Libellé Opération</th>
            <th style="padding: 12px 14px; font-weight: 700; font-size: 0.8rem; color: #475569; text-transform: uppercase;">Attribution / Nature</th>
            <th style="text-align: right; padding: 12px 14px; font-weight: 700; font-size: 0.8rem; color: #475569; text-transform: uppercase;">Montant</th>
          </tr>
        </thead>
        <tbody>
          {#if displayedTx.length === 0}
            <tr>
              <td colspan="4" style="text-align: center; padding: 32px; color: #64748b; font-size: 0.88rem;">
                Aucune opération ne correspond à votre recherche.
              </td>
            </tr>
          {:else}
            {#each displayedTx as tx}
              <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
                <td style="color: var(--text-muted); white-space: nowrap; padding: 12px 14px; font-weight: 600; font-size: 0.86rem;">
                  {formatDateFr(tx.date)}
                </td>
                <td style="font-weight: 600; color: var(--text-main); padding: 12px 14px; font-size: 0.88rem;">
                  {tx.libelle}
                </td>
                <td style="padding: 12px 14px;">
                  <span class="badge" style="background: {tx.compteAttribué && tx.compteAttribué !== '699' ? '#f0fdf4' : '#f8fafc'}; color: {tx.compteAttribué && tx.compteAttribué !== '699' ? '#166534' : '#64748b'}; border: 1px solid {tx.compteAttribué && tx.compteAttribué !== '699' ? '#bbf7d0' : '#cbd5e1'}; font-weight: 700; font-size: 0.78rem;">
                    {tx.compteAttribué && tx.compteAttribué !== '699' ? `${Categorizer.obtenirLibelleCompte(tx.compteAttribué)} (${tx.compteAttribué})` : 'Non attribué'}
                  </span>
                </td>
                <td style="text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; padding: 12px 14px; font-size: 0.92rem; color: {tx.credit > 0 ? 'var(--color-success)' : 'var(--text-main)'};">
                  {tx.credit > 0 ? '+' : ''}{(tx.credit || -tx.debit).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    {#if showAllTransactions && totalPages > 1}
      <!-- Pagination sous le tableau -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0; flex-wrap: wrap; gap: 10px;">
        <span style="font-size: 0.82rem; color: #64748b; font-weight: 600;">
          Page {currentPage} sur {totalPages} · {filteredTx.length} opération{filteredTx.length > 1 ? 's' : ''}
        </span>
        <div style="display: flex; gap: 8px;">
          <button 
            type="button" 
            onclick={() => currentPage = Math.max(1, currentPage - 1)} 
            disabled={currentPage === 1}
            style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; color: {currentPage === 1 ? '#94a3b8' : '#0f172a'}; cursor: {currentPage === 1 ? 'not-allowed' : 'pointer'};"
          >
            Précédent
          </button>
          <button 
            type="button" 
            onclick={() => currentPage = Math.min(totalPages, currentPage + 1)} 
            disabled={currentPage === totalPages}
            style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; color: {currentPage === totalPages ? '#94a3b8' : '#0f172a'}; cursor: {currentPage === totalPages ? 'not-allowed' : 'pointer'};"
          >
            Suivant
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

{#if showInitialBalanceModal}
  <div 
    class="modal-backdrop" 
    onclick={() => showInitialBalanceModal = false} 
    role="presentation" 
    style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 100000; padding: 20px;"
  >
    <div 
      onclick={(e) => e.stopPropagation()} 
      onkeydown={(e) => { if (e.key === 'Escape') showInitialBalanceModal = false; }}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      style="background: #ffffff; border-radius: 16px; width: 100%; max-width: 480px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); border: 1px solid #cbd5e1; overflow: hidden; animation: popIn 0.2s ease-out;"
    >
      <div style="padding: 22px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-start; background: #f8fafc;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <i class="fa-solid fa-vault" style="color: #2563eb; font-size: 1.1rem;"></i>
            <h3 style="margin: 0; font-size: 1.12rem; font-weight: 800; color: #0f172a; font-family: var(--font-title);">
              Solde initial de trésorerie
            </h3>
          </div>
          <p style="margin: 0; font-size: 0.82rem; color: #64748b; line-height: 1.4;">
            Solde en compte bancaire au 1er jour de votre exercice comptable (à-nouveaux du compte 512).
          </p>
        </div>
        <button 
          type="button" 
          onclick={() => showInitialBalanceModal = false}
          style="background: transparent; border: none; font-size: 1.1rem; color: #94a3b8; cursor: pointer; padding: 4px 8px; border-radius: 6px; line-height: 1;"
          aria-label="Fermer"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div style="padding: 24px;">
        <label for="initial-balance-input" style="display: block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 8px;">
          Montant disponible au départ de l'exercice (€)
        </label>
        <div style="position: relative; margin-bottom: 14px;">
          <input 
            id="initial-balance-input"
            type="text" 
            bind:value={tempInitialBalance}
            onkeydown={(e) => { if (e.key === 'Enter') saveInitialBalance(); }}
            placeholder="Ex : 40000 ou 39775,50"
            style="width: 100%; padding: 12px 42px 12px 14px; font-size: 1.05rem; font-weight: 700; border: 1.5px solid #cbd5e1; border-radius: 10px; color: #0f172a; background: #ffffff; box-sizing: border-box;"
          />
          <span style="position: absolute; right: 14px; top: 50%; transform: translateY(-50%); font-weight: 800; color: #64748b; font-size: 1.05rem;">
            €
          </span>
        </div>

        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 12px 14px; font-size: 0.82rem; color: #0369a1; line-height: 1.45;">
          <div style="font-weight: 700; margin-bottom: 3px; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-circle-info"></i> Information comptable universelle
          </div>
          Les relevés bancaires importés (CSV) n'enregistrent que les flux de la période. Renseigner votre solde de départ permet au logiciel de calculer votre trésorerie réelle exacte à tout instant.
        </div>
      </div>

      <div style="padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px;">
        <button 
          type="button" 
          onclick={() => showInitialBalanceModal = false}
          style="padding: 9px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #ffffff; color: #475569; font-size: 0.85rem; font-weight: 700; cursor: pointer;"
        >
          Annuler
        </button>
        <button 
          type="button" 
          onclick={saveInitialBalance}
          style="padding: 9px 18px; border-radius: 8px; border: none; background: #2563eb; color: #ffffff; font-size: 0.85rem; font-weight: 700; cursor: pointer; box-shadow: 0 2px 4px rgba(37,99,235,0.25);"
        >
          Enregistrer le solde
        </button>
      </div>
    </div>
  </div>
{/if}



