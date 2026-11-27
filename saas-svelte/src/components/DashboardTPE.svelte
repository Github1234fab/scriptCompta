<script>
  import { transactions, planComptable, activeEntityId, entities, activeView, showToast, formatDateFr, initialBankBalance, updateInitialBankBalance, openHelpGuide } from '../lib/store.js';
  import PageHeader from './PageHeader.svelte';
  import KpiCard from './KpiCard.svelte';

  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0] || { name: 'Ma Structure', model: 'tpe' });
  let accountingModel = $derived(activeEntity?.model || 'tpe');

  let activeTx = $derived($transactions.filter((/** @type {any} */ tx) => !tx.entityId || tx.entityId === $activeEntityId));

  let totalBanque = $derived($initialBankBalance + activeTx.reduce((sum, tx) => {
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
    if (accountingModel === 'bnc') return 'Profession Libérale (BNC)';
    if (accountingModel === 'sci') return 'SCI Familiale';
    if (accountingModel === 'copro') return 'Copropriété';
    return 'Société & TPE';
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
        const nom = (t.compteNom || '').toLowerCase();
        const compte = String(t.compteAttribué || '');

        const textMatch = lib.includes(q) || nom.includes(q) || compte.includes(q);

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

  // Helper pour raccourcir les libellés de badges sur mobile avec le numéro de compte en premier
  function formatMobileAccountBadge(compte, defaultNom = '') {
    if (!compte || String(compte) === '699') return defaultNom || 'Non attribué';
    const cpt = String(compte).trim();

    const SHORT_LABELS = {
      '706': 'Prestations',
      '707': 'Ventes',
      '708': 'Produits annexes',
      '606': 'Fournitures',
      '6061': 'Électricité & Eau',
      '6063': 'Petit matériel',
      '6064': 'Fournitures bureau',
      '613': 'Locations',
      '615': 'Entretien',
      '616': 'Assurances',
      '622': 'Honoraires',
      '623': 'Publicité & Com',
      '625': 'Déplacements',
      '626': 'Télécom & Poste',
      '627': 'Frais bancaires',
      '641': 'Rémunérations',
      '645': 'Cotisations soc.',
      '651': 'Logiciels & SaaS',
      '512': 'Banque'
    };

    if (SHORT_LABELS[cpt]) return `${cpt} · ${SHORT_LABELS[cpt]}`;
    const nom = defaultNom ? defaultNom.slice(0, 14) : cpt;
    return `${cpt} · ${nom}`;
  }

  // Helper pour nettoyer les libellés bancaires bruts façon app fintech
  function formatCleanLibelle(raw) {
    if (!raw) return 'Opération bancaire';
    let s = String(raw).trim();
    if (s.includes('|')) s = s.split('|')[0].trim();

    const upper = s.toUpperCase();
    if (upper.includes('AMZN') || upper.includes('AMAZON')) return 'Amazon';
    if (upper.includes('LEROY MERLIN')) {
      if (/vourles/i.test(s)) return 'Leroy Merlin Vourles';
      return 'Leroy Merlin';
    }
    if (/frais\s+(?:de\s+)?pr[eé]l[eè]vement/i.test(s)) return 'Frais prélèvement SEPA';
    if (/frais\s+tenue\s+de\s+compte/i.test(s)) return 'Frais tenue de compte';
    if (/frais\s+bancaire/i.test(s)) return 'Frais bancaires';
    if (/cotisation\s+(?:carte|bancaire)/i.test(s)) return 'Cotisation bancaire';

    s = s.replace(/^(?:PRLV\s+SEPA|PRLV|PRELEVEMENT\s+SEPA|PRELEVEMENT\s+SDD|PRELEVEMENT|VIR\s+INST|VIR\s+SEPA|VIREMENT\s+SEPA|VIREMENT\s+INST|VIREMENT|PAIEMENT\s+PAR\s+CARTE\s+DU|PAIEMENT\s+PAR\s+CARTE|PAIEMENT\s+CB\s+DU|PAIEMENT\s+CB|ACHAT\s+CB|CB\s+DU|CB|CHEQUE\s+N°|CHEQUE)\s*[:-]?\s*/i, '');
    s = s.replace(/^(?:M(?:R|\.)?\s*(?:OU|ET|\/)\s*MME\.?|MME\.?|MLLE\.?|MR?\.?)\s+/i, '');

    if (/[-–—]/.test(s)) {
      const parts = s.split(/\s*[-–—]\s*/);
      if (parts.length >= 2) {
        const p0 = parts[0].trim();
        const p1 = parts[1].trim();
        if (/^(?:vir|prlv|virement|prelevement|loyer|fact|ref|paiement|cb|sepa|achat)\b/i.test(p1) || p0.length >= 3) {
          s = p0;
        } else if (/^(?:vir|prlv|virement|prelevement)\b/i.test(p0) && p1.length >= 3) {
          s = p1;
        }
      }
    }

    s = s.replace(/\s+(?:BILU|MKTP|PAYMENTS|EU|FR)\b.*$/i, '');
    s = s.replace(/\s+(?:VIR|VIREM|VIREMENT|PRLV|PRELEVEMENT)\b.*$/i, '');
    s = s.replace(/[-/]\s*\d{6,}[A-Z0-9_-]*/i, '');
    s = s.replace(/\s+\d+\s+EURO\s+[\d,.]+/i, '');
    s = s.replace(/\s+(REF|ID|EMETTEUR|MANDAT|ICS)\s*[:=]\s*[A-Z0-9]+/i, '');
    s = s.replace(/\s+\d{2}\/\d{2}(\/\d{2,4})?$/i, '');
    s = s.replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim();

    return s || raw;
  }

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
    structureName={activeEntity.name}
    title={dashboardTitle} 
    mobileTitle="Trésorerie"
    subtitle={dashboardSubtitle} 
  >
    <button 
      type="button" 
      onclick={() => openHelpGuide('accueil')}
      title="Guide d'utilisation pour l'accueil"
      aria-label="Guide d'utilisation pour l'accueil"
      class="page-help-btn"
    >
      <i class="fa-solid fa-question"></i>
    </button>
  </PageHeader>

  <!-- 1. INDICATEURS CLÉS -->
  <div style="margin-bottom: 30px;">

    <!-- 1. BLOC GÉNÉRAL INDICATEURS (ENGLOBANT LE TITRE) -->
    <div class="tpe-section-box" style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); margin-bottom: 30px;">
      <div class="tpe-kpi-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
        <h3 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-chart-line" style="color: #2563eb; font-size: 0.95rem;"></i> Indicateurs
        </h3>
        <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">
          Trésorerie et résultat en direct
        </span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
        {#if accountingModel === 'bnc'}
          <KpiCard 
            label="Trésorerie Disponible" 
            value={totalBanque.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
            subtext={$initialBankBalance !== 0 ? `Solde réel (dont ${$initialBankBalance.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} au départ)` : 'Solde de départ non configuré (0,00 €)'}
            actionLabel={$initialBankBalance !== 0 ? "Modifier départ" : "Définir solde initial"}
            onAction={openInitialBalanceModal}
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
            subtext={$initialBankBalance !== 0 ? `Solde réel (dont ${$initialBankBalance.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} au départ)` : 'Solde bancaire de la SCI'}
            actionLabel={$initialBankBalance !== 0 ? "Modifier départ" : "Définir solde initial"}
            onAction={openInitialBalanceModal}
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
            subtext={$initialBankBalance !== 0 ? `Total banque : ${totalBanque.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}` : "Après déduction de la provision TVA"}
            actionLabel={$initialBankBalance !== 0 ? "Modifier départ" : "Définir solde initial"}
            onAction={openInitialBalanceModal}
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

    <!-- 2. BLOC GÉNÉRAL TÂCHES À EFFECTUER (ENGLOBANT LE TITRE) -->
    <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); margin-bottom: 30px; display: flex; flex-direction: column; gap: 12px; max-width: 580px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <h3 style="font-family: var(--font-title); font-size: 1.02rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-list-check" style="color: #2563eb; font-size: 0.92rem;"></i> Tâches à effectuer
        </h3>
        <span style="background: {pendingTxCount > 0 ? '#ef4444' : '#10b981'}; color: #ffffff; font-size: 0.74rem; font-weight: 800; padding: 2px 8px; border-radius: 9999px;">
          {totalTasksCount}
        </span>
      </div>

      <!-- Tâche: Rapprochement / Attribution (fond blanc et largeur maîtrisée) -->
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
              {pendingTxCount > 0 ? 'Imputez ces mouvements bancaires pour équilibrer vos comptes et préparer la clôture.' : 'Toutes vos opérations sont classées et votre comptabilité est à jour.'}
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
    </div>
  </div>

  <!-- 3. DERNIÈRES ÉCRITURES BANCAIRES TRAITÉES (ENGLOBANT LE TITRE) -->
  <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); padding: 20px; margin-bottom: 30px;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
      <div>
        <h2 style="font-family: var(--font-title); font-size: 1.12rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-list-check" style="color: #2563eb; font-size: 0.95rem;"></i>
          {#if showAllTransactions}
            Écritures bancaires ({txSearch.trim() ? `${filteredTx.length} résultat${filteredTx.length > 1 ? 's' : ''}` : `${activeTx.length} opérations`})
          {:else}
            Dernières écritures bancaires traitées
          {/if}
        </h2>
        <span style="font-size: 0.8rem; color: #64748b; font-weight: 600; margin-top: 2px; display: block;">
          {#if showAllTransactions}
            {txSearch.trim() ? `Recherche parmi les ${activeTx.length} écritures de la structure` : 'Historique complet des mouvements bancaires rapprochés'}
          {:else}
            Mouvements bancaires rapprochés et intégrés à votre comptabilité
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
          style="background: #ffffff; border: 1px solid var(--border-subtle); color: #0f172a; border-radius: 6px; padding: 6px 14px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s ease;"
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

    <div class="table-container desktop-tx-table" style="border: none; border-radius: 12px; overflow-x: auto; -webkit-overflow-scrolling: touch; background: #ffffff; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.06);">
      <table class="custom-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: var(--bg-container); border-bottom: 1.5px solid var(--border-container);">
            <th style="padding: 12px 14px; font-weight: 700; font-size: 0.8rem; color: #475569; text-transform: uppercase;">Date</th>
            <th style="padding: 12px 14px; font-weight: 700; font-size: 0.8rem; color: #475569; text-transform: uppercase;">Libellé Opération</th>
            <th style="padding: 12px 14px; font-weight: 700; font-size: 0.8rem; color: #475569; text-transform: uppercase;">Nomenclature comptable</th>
            <th style="text-align: right; padding: 12px 14px; font-weight: 700; font-size: 0.8rem; color: #475569; text-transform: uppercase;">Montant</th>
          </tr>
        </thead>
        <tbody>
          {#if displayedTx.length === 0}
            <tr>
              <td colspan="4" style="text-align: center; padding: 32px; color: var(--text-muted); font-size: 0.95rem;">
                {activeTx.length === 0 ? "Aucune opération bancaire enregistrée pour cette structure." : "Aucune opération ne correspond à votre recherche."}
              </td>
            </tr>
          {:else}
            {#each displayedTx as tx}
              {@const isAttributed = tx.compteAttribué && tx.compteAttribué !== '699' && tx.statut === 'attribue'}
              {@const isUnassigned = !tx.compteAttribué || tx.compteAttribué === '699'}
              <tr style="border-bottom: 1px solid var(--border-container); background: #ffffff;">
                <td style="color: var(--text-muted); white-space: nowrap; padding: 12px 14px; font-weight: 600; font-size: 0.86rem;">{formatDateFr(tx.date)}</td>
                <td style="font-weight: 600; color: var(--text-main); padding: 12px 14px; font-size: 0.88rem;">{tx.libelle}</td>
                <td style="padding: 12px 14px;">
                  {#if isAttributed}
                    <span class="badge" style="background: rgba(56, 189, 248, 0.14); color: var(--color-accent); border: 1px solid rgba(56, 189, 248, 0.35); font-weight: 700; font-size: 0.74rem;">
                      {tx.compteNom || 'Attribution assistée'} ({tx.compteAttribué})
                    </span>
                  {:else if isUnassigned}
                    <span class="badge" style="background: var(--color-warning-bg); color: var(--color-warning); border: 1px solid rgba(245, 158, 11, 0.35); font-weight: 700; font-size: 0.74rem;">
                      {tx.compteNom || 'Attribution assistée'} ({tx.compteAttribué || '699'})
                    </span>
                  {:else}
                    <span class="badge badge-muted" style="font-weight: 700; font-size: 0.74rem;">
                      {tx.compteNom || 'Attribution assistée'} ({tx.compteAttribué})
                    </span>
                  {/if}
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

    <!-- Vue Liste unifiée fintech (Mobile < 768px) -->
    <div class="mobile-tx-cards">
      {#if displayedTx.length === 0}
        <div style="text-align: center; padding: 24px 14px; color: var(--text-muted); font-size: 0.88rem; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color);">
          {activeTx.length === 0 ? "Aucune opération bancaire enregistrée pour cette structure." : "Aucune opération ne correspond à votre recherche."}
        </div>
      {:else}
        <div class="mobile-tx-list">
          {#each displayedTx as tx}
            {@const isCredit = tx.credit > 0}
            <div class="mobile-tx-item" title={tx.libelle}>
              <!-- Pastille circulaire directionnelle 32x32px fintech -->
              <div 
                class="mobile-tx-icon-pill" 
                style="background: {isCredit ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.10)'}; color: {isCredit ? '#10b981' : '#ef4444'};"
                aria-hidden="true"
              >
                {#if isCredit}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="17" y1="7" x2="7" y2="17"></line>
                    <polyline points="17 17 7 17 7 7"></polyline>
                  </svg>
                {:else}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="7" y1="17" x2="17" y2="7"></line>
                    <polyline points="7 7 17 7 17 17"></polyline>
                  </svg>
                {/if}
              </div>

              <div class="mobile-tx-content">
                <!-- Ligne 1 : Nom nettoyé + Montant -->
                <div class="mobile-tx-row-top">
                  <span class="mobile-tx-name" title={tx.libelle}>
                    {formatCleanLibelle(tx.libelle)}
                  </span>
                  <span 
                    class="mobile-tx-amount" 
                    style="color: {isCredit ? 'var(--color-success, #34d399)' : 'var(--color-danger, #f87171)'};"
                  >
                    {isCredit ? '+ ' : '- '}{Math.abs(tx.credit || -tx.debit).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                  </span>
                </div>

                <!-- Ligne 2 : Date + Badge de compte court (code devant) -->
                <div class="mobile-tx-row-bottom">
                  <span class="mobile-tx-date">
                    {formatDateFr(tx.date)}
                  </span>
                  <span class="mobile-tx-badge attributed">
                    {formatMobileAccountBadge(tx.compteAttribué, tx.compteNom)}
                  </span>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
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
            Solde en compte bancaire au 1er jour de votre exercice comptable (compte 512).
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
        <label for="initial-balance-input-tpe" style="display: block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 8px;">
          Montant disponible au départ de l'exercice (€)
        </label>
        <div style="position: relative; margin-bottom: 14px;">
          <input 
            id="initial-balance-input-tpe"
            type="text" 
            bind:value={tempInitialBalance}
            onkeydown={(e) => { if (e.key === 'Enter') saveInitialBalance(); }}
            placeholder="Ex : 15000 ou 40000"
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
          Les fichiers de relevés bancaires importés n'enregistrent que les mouvements de la période. Renseigner votre solde d'ouverture permet d'obtenir une trésorerie en direct 100% fidèle à votre compte bancaire.
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

<style>
  .desktop-tx-table {
    display: block;
  }

  .mobile-tx-cards {
    display: none;
  }

  @media (max-width: 768px) {
    .tpe-kpi-header {
      display: none !important;
    }

    .tpe-section-box {
      background: transparent !important;
      border: none !important;
      padding: 0 !important;
      box-shadow: none !important;
      margin-bottom: 20px !important;
    }

    /* Bascule Tableau -> Liste Fintech unifiée sur mobile */
    .desktop-tx-table {
      display: none !important;
    }

    .mobile-tx-cards {
      display: block !important;
    }

    .mobile-tx-list {
      display: flex;
      flex-direction: column;
      background: var(--bg-card, #ffffff);
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
    }

    .mobile-tx-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--border-color, rgba(226, 232, 240, 0.6));
      background: transparent;
      transition: background 0.12s ease;
      -webkit-tap-highlight-color: transparent;
    }

    .mobile-tx-item:last-child {
      border-bottom: none;
    }

    .mobile-tx-item:active {
      background: var(--bg-subtle, rgba(0, 0, 0, 0.04));
    }

    .mobile-tx-icon-pill {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .mobile-tx-content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .mobile-tx-row-top {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 10px;
      width: 100%;
      min-width: 0;
      flex-wrap: nowrap !important;
    }

    .mobile-tx-name {
      font-weight: 700;
      font-size: 0.88rem;
      color: var(--text-main, #0f172a);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap !important;
      flex: 1;
      min-width: 0;
    }

    .mobile-tx-amount {
      font-weight: 800;
      font-size: 0.92rem;
      white-space: nowrap !important;
      font-variant-numeric: tabular-nums;
      flex-shrink: 0 !important;
      font-family: var(--font-title, sans-serif);
      margin-left: auto;
      text-align: right;
    }

    .mobile-tx-row-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .mobile-tx-date {
      font-size: 0.74rem;
      color: var(--text-muted, #64748b);
      font-weight: 500;
      flex-shrink: 0;
    }

    .mobile-tx-badge {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.3;
      flex-shrink: 0;
      background: rgba(56, 189, 248, 0.12);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.3);
    }
  }
</style>

