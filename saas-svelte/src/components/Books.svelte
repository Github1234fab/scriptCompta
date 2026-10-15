<script>
  import { 
    transactions, 
    planComptable, 
    closingMonth, 
    updateClosingMonth, 
    showToast,
    activeEntityId,
    entities
  } from '../lib/store.js';
  import { Categorizer } from '../lib/categorizer.js';

  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0] || { id: 'default', name: 'Ma Structure', model: 'micro' });
  let accountingModel = $derived(activeEntity?.model || 'micro');

  let subTabs = $derived((() => {
    if (accountingModel === 'micro') {
      return [
        { id: 'recettes', label: 'Livre des Recettes', icon: 'fa-book-journal-whills' },
        { id: 'achats', label: 'Registre des Achats', icon: 'fa-cart-shopping' },
        { id: 'recap_ca', label: 'Récapitulatif Fiscal & Urssaf', icon: 'fa-chart-pie' }
      ];
    }
    if (accountingModel === 'asso') {
      return [
        { id: 'recettes_depenses', label: 'Livre des Recettes & Dépenses', icon: 'fa-book' },
        { id: 'bilan', label: 'Bilan Simplifié & Excédent', icon: 'fa-chart-pie' },
        { id: 'journal', label: 'Livre-journal', icon: 'fa-table-list' },
        { id: 'grandlivre', label: 'Le Grand-livre', icon: 'fa-book-bookmark' },
        { id: 'balance', label: 'La Balance', icon: 'fa-scale-balanced' }
      ];
    }
    return [
      { id: 'recettes_depenses', label: 'Livre chronologique', icon: 'fa-book' },
      { id: 'journal', label: 'Livre-journal (Double entrée)', icon: 'fa-table-list' },
      { id: 'grandlivre', label: 'Le Grand-livre', icon: 'fa-book-bookmark' },
      { id: 'balance', label: 'La Balance', icon: 'fa-scale-balanced' },
      { id: 'bilan', label: 'Le Bilan', icon: 'fa-chart-pie' }
    ];
  })());

  let activeSubTab = $state('recettes');
  let localClosingMonth = $state(9);

  $effect(() => {
    if (!subTabs.some(t => t.id === activeSubTab)) {
      activeSubTab = subTabs[0]?.id || 'recettes';
    }
  });

  // Filter and sort transactions chronologically (Svelte 5 derived rune)
  let sortedTxList = $derived([...$transactions]
    .filter(t => t.compteAttribué !== '699' && t.statut === 'attribue')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));

  // 1. LIVRE-JOURNAL CALCULATION
  let journalEntries = $derived((() => {
    let pieceNum = 1;
    /** @type {any[]} */
    const entries = [];
    sortedTxList.forEach(tx => {
      const dateStr = new Date(tx.date).toLocaleDateString('fr-FR');
      const piece = `PIECE-${String(pieceNum++).padStart(3, '0')}`;

      if (tx.debit > 0) {
        // Ligne 1 : Débit du compte de charges
        entries.push({
          date: dateStr,
          piece,
          compte: tx.compteAttribué,
          libelleCompte: Categorizer.obtenirLibelleCompte(tx.compteAttribué),
          description: tx.libelle,
          debit: tx.debit,
          credit: null,
          offset: false
        });
        // Ligne 2 : Crédit du compte banque 512
        entries.push({
          date: dateStr,
          piece,
          compte: '512',
          libelleCompte: 'Banque',
          description: tx.libelle,
          debit: null,
          credit: tx.debit,
          offset: true
        });
      } else if (tx.credit > 0) {
        // Ligne 1 : Débit du compte banque 512
        entries.push({
          date: dateStr,
          piece,
          compte: '512',
          libelleCompte: 'Banque',
          description: tx.libelle,
          debit: tx.credit,
          credit: null,
          offset: false
        });
        // Ligne 2 : Crédit du compte de produits
        entries.push({
          date: dateStr,
          piece,
          compte: tx.compteAttribué,
          libelleCompte: Categorizer.obtenirLibelleCompte(tx.compteAttribué),
          description: tx.libelle,
          debit: null,
          credit: tx.credit,
          offset: true
        });
      }
    });
    return entries;
  })());

  // 2. GRAND LIVRE CALCULATION
  let grandLivreAccounts = $derived((() => {
    /** @type {Record<string, any[]>} */
    const comptesGroupes = { '512': [] };

    sortedTxList.forEach(tx => {
      const cpt = tx.compteAttribué;
      if (!comptesGroupes[cpt]) comptesGroupes[cpt] = [];

      if (tx.debit > 0) {
        comptesGroupes[cpt].push({ date: tx.date, libelle: tx.libelle, debit: tx.debit, credit: 0 });
        comptesGroupes['512'].push({ date: tx.date, libelle: tx.libelle, debit: 0, credit: tx.debit });
      } else if (tx.credit > 0) {
        comptesGroupes['512'].push({ date: tx.date, libelle: tx.libelle, debit: tx.credit, credit: 0 });
        comptesGroupes[cpt].push({ date: tx.date, libelle: tx.libelle, debit: 0, credit: tx.credit });
      }
    });

    /** @type {any[]} */
    const accounts = [];
    Object.keys(comptesGroupes).sort().forEach(cptNum => {
      const operations = comptesGroupes[cptNum];
      if (operations.length === 0) return;

      const nomCompte = cptNum === '512' ? 'Compte Bancaire (Banque)' : Categorizer.obtenirLibelleCompte(cptNum);
      let runningSolde = 0;

      const mappedOps = operations.map((/** @type {any} */ op) => {
        const estActifOuCharge = cptNum.startsWith('5') || cptNum.startsWith('6') || cptNum.startsWith('411') || cptNum.startsWith('467');
        if (estActifOuCharge) {
          runningSolde += op.debit - op.credit;
        } else {
          runningSolde += op.credit - op.debit;
        }
        return {
          ...op,
          solde: runningSolde
        };
      });

      accounts.push({
        compte: cptNum,
        nom: nomCompte,
        operations: mappedOps
      });
    });

    return accounts;
  })());

  // 3. BALANCE CALCULATION
  let balanceRows = $derived((() => {
    /** @type {Record<string, { debit: number, credit: number }>} */
    const balanceData = { '512': { debit: 0, credit: 0 } };

    sortedTxList.forEach(tx => {
      const cpt = tx.compteAttribué;
      if (!balanceData[cpt]) balanceData[cpt] = { debit: 0, credit: 0 };

      if (tx.debit > 0) {
        balanceData[cpt].debit += tx.debit;
        balanceData['512'].credit += tx.debit;
      } else if (tx.credit > 0) {
        balanceData['512'].debit += tx.credit;
        balanceData[cpt].credit += tx.credit;
      }
    });

    return Object.keys(balanceData).sort().map(cptNum => {
      const data = balanceData[cptNum];
      const nom = cptNum === '512' ? 'Compte courant Banque' : Categorizer.obtenirLibelleCompte(cptNum);
      
      let soldeDebiteur = 0;
      let soldeCrediteur = 0;

      const estActifOuCharge = cptNum.startsWith('5') || cptNum.startsWith('6') || cptNum.startsWith('411') || cptNum.startsWith('467');
      if (estActifOuCharge) {
        const diff = data.debit - data.credit;
        if (diff >= 0) soldeDebiteur = diff;
        else soldeCrediteur = Math.abs(diff);
      } else {
        const diff = data.credit - data.debit;
        if (diff >= 0) soldeCrediteur = diff;
        else soldeDebiteur = Math.abs(diff);
      }

      return {
        compte: cptNum,
        nom,
        debit: data.debit,
        credit: data.credit,
        soldeDebiteur,
        soldeCrediteur
      };
    });
  })());

  // 4. BILAN CALCULATION
  let bilanData = $derived((() => {
    /** @type {Record<string, { debit: number, credit: number }>} */
    const balanceData = { '512': { debit: 0, credit: 0 } };

    sortedTxList.forEach(tx => {
      const cpt = tx.compteAttribué;
      if (!balanceData[cpt]) balanceData[cpt] = { debit: 0, credit: 0 };

      if (tx.debit > 0) {
        balanceData[cpt].debit += tx.debit;
        balanceData['512'].credit += tx.debit;
      } else if (tx.credit > 0) {
        balanceData['512'].debit += tx.credit;
        balanceData[cpt].credit += tx.credit;
      }
    });

    let totalActif = 0;
    let totalPassif = 0;

    /** @type {any[]} */
    const actifs = [];
    /** @type {any[]} */
    const passifs = [];

    // Actifs (5xxx, 411, 467)
    Object.keys(balanceData).forEach(cpt => {
      if (cpt.startsWith('5') || cpt === '411' || cpt === '467') {
        const val = balanceData[cpt].debit - balanceData[cpt].credit;
        if (val === 0) return;

        totalActif += val;
        actifs.push({
          compte: cpt,
          nom: cpt === '512' ? 'Compte en Banque' : Categorizer.obtenirLibelleCompte(cpt),
          valeur: val
        });
      }
    });

    // Passifs (102, 401, 421, etc.)
    Object.keys(balanceData).forEach(cpt => {
      if (cpt === '102' || cpt === '401' || cpt === '421' || cpt === '437' || cpt === '445') {
        const val = balanceData[cpt].credit - balanceData[cpt].debit;
        if (val === 0) return;

        totalPassif += val;
        passifs.push({
          compte: cpt,
          nom: Categorizer.obtenirLibelleCompte(cpt),
          valeur: val
        });
      }
    });

    // Net Result excédent
    let recettes = 0;
    let depenses = 0;
    Object.keys(balanceData).forEach(cpt => {
      const p = $planComptable.find((/** @type {any} */ pc) => pc.compte === cpt);
      if (p) {
        if (p.type === 'Produit') recettes += balanceData[cpt].credit;
        if (p.type === 'Charge') depenses += balanceData[cpt].debit;
      }
    });
    const excedent = recettes - depenses;
    totalPassif += excedent;

    return {
      actifs,
      passifs,
      excedent,
      totalActif,
      totalPassif
    };
  })());

  function handleSaveClosingMonth() {
    updateClosingMonth(localClosingMonth);
    showToast(`📅 Rentrée de l'exercice configurée en ${getMonthName(localClosingMonth)}.`);
  }

  /** @param {any} m */
  function getMonthName(m) {
    const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    return months[m - 1];
  }

  function exportFEC() {
    let fec = 'JournalCode;JournalLib;EcritureNum;EcritureDate;CompteNum;CompteLib;PieceRef;PieceDate;EcritureLib;Debit;Credit\n';
    let idx = 1;
    sortedTxList.forEach(tx => {
      const date = tx.date.replace(/-/g, '');
      const piece = `PIECE-${idx}`;
      
      if (tx.debit > 0) {
        fec += `JNL;Journal General;${idx};${date};${tx.compteAttribué};${Categorizer.obtenirLibelleCompte(tx.compteAttribué)};${piece};${date};${tx.libelle};${tx.debit.toFixed(2)};0.00\n`;
        fec += `JNL;Journal General;${idx};${date};512;Banque;${piece};${date};${tx.libelle};0.00;${tx.debit.toFixed(2)}\n`;
      } else if (tx.credit > 0) {
        fec += `JNL;Journal General;${idx};${date};512;Banque;${piece};${date};${tx.libelle};${tx.credit.toFixed(2)};0.00\n`;
        fec += `JNL;Journal General;${idx};${date};${tx.compteAttribué};${Categorizer.obtenirLibelleCompte(tx.compteAttribué)};${piece};${date};${tx.libelle};0.00;${tx.credit.toFixed(2)}\n`;
      }
      idx++;
    });

    const blob = new Blob([fec], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `FEC_EXERCICE_COMPTABLE_${new Date().getFullYear()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('💾 Export FEC généré pour votre expert-comptable !');
  }

  // Micro-entreprise specific calculations
  let recettesMicro = $derived(
    sortedTxList
      .filter(tx => tx.credit > 0)
      .map((tx, index) => ({
        numeroOrdre: index + 1,
        date: tx.date,
        reference: tx.reference || `REC-${String(1001 + index)}`,
        client: tx.libelle,
        nature: Categorizer.obtenirLibelleCompte(tx.compteAttribué) || 'Vente / Prestation',
        montant: tx.credit,
        modePaiement: tx.typeOperation || 'Virement bancaire'
      }))
  );
  let totalRecettesMicro = $derived(recettesMicro.reduce((acc, r) => acc + r.montant, 0));

  let achatsMicro = $derived(
    sortedTxList
      .filter(tx => tx.debit > 0)
      .map((tx, index) => ({
        numeroOrdre: index + 1,
        date: tx.date,
        fournisseur: tx.libelle,
        nature: Categorizer.obtenirLibelleCompte(tx.compteAttribué) || 'Achat professionnel',
        montant: tx.debit,
        modePaiement: tx.typeOperation || 'Carte / Prélèvement'
      }))
  );
  let totalAchatsMicro = $derived(achatsMicro.reduce((acc, a) => acc + a.montant, 0));

  // CA trimestriel pour déclaration Urssaf
  let caTrimestriel = $derived((() => {
    const quarters = { T1: 0, T2: 0, T3: 0, T4: 0 };
    recettesMicro.forEach(r => {
      const d = new Date(r.date);
      const m = d.getMonth() + 1;
      if (m <= 3) quarters.T1 += r.montant;
      else if (m <= 6) quarters.T2 += r.montant;
      else if (m <= 9) quarters.T3 += r.montant;
      else quarters.T4 += r.montant;
    });
    return quarters;
  })());

  function exportLivreRecettesMicro() {
    let csv = "N° Ordre;Date;Référence;Client / Origine;Nature;Mode Règlement;Montant Encaissé (€)\n";
    recettesMicro.forEach(r => {
      csv += `${r.numeroOrdre};${new Date(r.date).toLocaleDateString('fr-FR')};"${r.reference}";"${r.client.replace(/"/g, '""')}";"${r.nature}";"${r.modePaiement}";${r.montant.toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `LIVRE_RECETTES_${activeEntity.name.replace(/\s+/g, '_')}_${new Date().getFullYear()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📜 Livre des Recettes (Format officiel Urssaf) téléchargé !');
  }

  function exportRegistreAchatsMicro() {
    let csv = "N° Ordre;Date;Fournisseur / Tiers;Nature Dépense;Mode Règlement;Montant Payé (€)\n";
    achatsMicro.forEach(a => {
      csv += `${a.numeroOrdre};${new Date(a.date).toLocaleDateString('fr-FR')};"${a.fournisseur.replace(/"/g, '""')}";"${a.nature}";"${a.modePaiement}";${a.montant.toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `REGISTRE_ACHATS_${activeEntity.name.replace(/\s+/g, '_')}_${new Date().getFullYear()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('🛒 Registre des Achats téléchargé !');
  }

  $effect(() => {
    if ($closingMonth) {
      localClosingMonth = $closingMonth;
    }
  });
</script>

<div class="page-title-section">
  <h1 class="page-title">{accountingModel === 'micro' ? 'Registres Légaux de la Micro-entreprise' : 'Registres & Clôture de l\'exercice'}</h1>
  <p class="page-subtitle">{accountingModel === 'micro' ? 'Tenue obligatoire du Livre des Recettes et du Registre des Achats (dispense de bilan et grand-livre).' : 'Consultez vos documents légaux mis à jour en temps réel.'}</p>
</div>

{#if accountingModel === 'micro'}
  <!-- BANDEAU MICRO-ENTREPRISE : DISPENSE LÉGALE & ACCÈS EXPORT DIRECT -->
  <div class="card" style="margin-bottom: 24px; padding: 22px 26px; background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 16px;">
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
      <div style="max-width: 720px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span style="background: #2563eb; color: #ffffff; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">Régime Micro-Fiscal</span>
          <h3 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 800; color: #1e3a8a; margin: 0;">
            Comptabilité allégée de trésorerie (Dispense légale de bilan)
          </h3>
        </div>
        <p style="font-size: 0.86rem; color: #1e40af; line-height: 1.5; margin: 0;">
          En micro-entreprise (auto-entrepreneur), <strong>vous n'avez ni bilan, ni grand-livre, ni compte de résultat</strong> (art. L123-28 du Code de commerce). Vos deux seuls documents obligatoires sont le <strong>Livre des Recettes</strong> et le <strong>Registre des Achats</strong>.
        </p>
      </div>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="btn btn-primary" onclick={exportLivreRecettesMicro} style="background: #0f172a; color: #ffffff; border: none; padding: 9px 18px; font-weight: 700; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-file-export"></i> Exporter Livre des Recettes (CSV)
        </button>
        <button class="btn btn-secondary" onclick={exportRegistreAchatsMicro} style="background: #ffffff; color: #0f172a; border: 1.5px solid #cbd5e1; padding: 9px 18px; font-weight: 700; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-cart-shopping"></i> Exporter Registre des Achats (CSV)
        </button>
      </div>
    </div>
  </div>
{:else}
  <!-- Config Season -->
  <div class="card" style="margin-bottom: 24px; padding: 24px;">
    <h3 style="font-family: var(--font-title); margin-bottom: 8px; color: #0f172a; font-weight: 800;">Configuration de l'exercice</h3>
    <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 16px;">
      Choisissez le mois de début de vos comptes (ex: Septembre pour une saison d'association scolaire, Janvier pour année civile).
    </p>
    <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
      <select id="closing-month-select" class="form-control" style="max-width: 240px; background: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; font-weight: 600;" bind:value={localClosingMonth}>
        <option value={1}>Janvier</option>
        <option value={9}>Septembre (Saison scolaire)</option>
        <option value={12}>Décembre</option>
      </select>
      <button class="btn btn-primary btn-sm" onclick={handleSaveClosingMonth} style="background: #0f172a; color: #ffffff; border: none; padding: 9px 18px; font-weight: 700; border-radius: 6px; cursor: pointer;">
        Valider le mois de rentrée
      </button>
      
      <button class="btn btn-success btn-sm" onclick={exportFEC} style="margin-left: auto; background: #15803d; color: #ffffff; border: none; padding: 9px 18px; font-weight: 700; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-file-export"></i> Exporter pour l'Expert-comptable (Format FEC)
      </button>
    </div>
  </div>

  <!-- BLOC : OBLIGATIONS LÉGALES -->
  <div class="card" style="margin-bottom: 24px; padding: 22px 26px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 16px; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);">
    <h3 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0 0 10px 0; display: flex; align-items: center; gap: 10px;">
      <span style="background: #eff6ff; color: #2563eb; width: 34px; height: 34px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 1.05rem;">📋</span>
      Obligations Légales & Conservation des Registres
    </h3>

    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;">
      <div style="max-width: 750px;">
        <h4 style="font-family: var(--font-title); font-size: 1rem; font-weight: 700; color: #1e293b; margin: 0 0 4px 0;">
          Tenue du Livre des Recettes & Registres Comptables
        </h4>
        <p style="font-size: 0.85rem; color: #475569; line-height: 1.5; margin: 0;">
          En tant que structure (société ou association), vous avez l'obligation légale de tenir un journal chronologique retraçant l'ensemble de vos opérations. Vos pièces justificatives et registres comptables doivent être conservés pendant 10 ans.
        </p>
      </div>
      <button class="btn btn-primary" onclick={() => activeSubTab = 'recettes_depenses'} style="background: #0f172a; color: #ffffff; border: none; padding: 10px 20px; font-weight: 700; font-size: 0.88rem; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-book-journal-whills"></i> Consulter le Registre Légal
      </button>
    </div>
  </div>
{/if}

<!-- Sub Tabs Bar (Segmented Control Haute Visibilité) -->
<div style="display: flex; justify-content: center; margin-bottom: 24px; width: 100%;">
  <div class="tabs-segmented-container">
    {#each subTabs as tab}
      <button 
        type="button" 
        id="sub-btn-{tab.id}"
        class="tab-segmented-btn"
        class:active={activeSubTab === tab.id}
        onclick={() => activeSubTab = tab.id}
      >
        <i class="fa-solid {tab.icon}"></i>
        <span>{tab.label}</span>
        {#if activeSubTab === tab.id}
          <span class="active-dot" title="Rubrique active"></span>
        {/if}
      </button>
    {/each}
  </div>
</div>

<!-- ========================================== -->
<!-- SOUS-ONGLETS POUR MICRO-ENTREPRISE -->
<!-- ========================================== -->
{#if accountingModel === 'micro'}
  {#if activeSubTab === 'recettes'}
  <div class="card" style="padding: 24px; margin-bottom: 24px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 12px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span class="active-doc-badge"><i class="fa-solid fa-check"></i> Registre légal obligatoire</span>
          <h3 style="font-family: var(--font-title); color: #0f172a; margin: 0; font-weight: 800; font-size: 1.15rem;">Livre chronologique des Recettes</h3>
        </div>
        <p style="font-size: 0.82rem; color: #64748b; margin: 0;">Registre immuable de vos encaissements professionnels, exigé par l'Urssaf et la DGFiP.</p>
      </div>
      <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; padding: 8px 16px; border-radius: 10px; text-align: right;">
        <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 800; color: #16a34a; display: block;">Chiffre d'Affaires Total</span>
        <strong style="font-size: 1.25rem; color: #15803d; font-family: var(--font-title);">
          {totalRecettesMicro.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </strong>
      </div>
    </div>

    <div class="table-container">
      <table class="custom-table" id="recettes-micro-table">
        <thead>
          <tr>
            <th>N° Ordre</th>
            <th>Date</th>
            <th>Référence</th>
            <th>Client / Origine</th>
            <th>Nature de la prestation / vente</th>
            <th>Règlement</th>
            <th style="text-align: right;">Montant (€)</th>
          </tr>
        </thead>
        <tbody>
          {#if recettesMicro.length === 0}
            <tr>
              <td colspan="7" style="text-align: center; color: #64748b; padding: 36px;">
                Aucune recette encaissée pour le moment. Importez vos relevés bancaires pour remplir automatiquement ce livre.
              </td>
            </tr>
          {:else}
            {#each recettesMicro as r}
              <tr style="border-bottom: 1px solid #f1f5f9; background: #ffffff;">
                <td style="color: #64748b; font-weight: 700; font-size: 0.82rem;">#{String(r.numeroOrdre).padStart(3, '0')}</td>
                <td style="font-weight: 700; color: #0f172a;">{new Date(r.date).toLocaleDateString('fr-FR')}</td>
                <td style="font-family: monospace; font-size: 0.8rem; color: #2563eb;">{r.reference}</td>
                <td style="color: #0f172a; font-weight: 700;">{r.client}</td>
                <td><span class="badge badge-muted">{r.nature}</span></td>
                <td style="font-size: 0.82rem; color: #64748b;">{r.modePaiement}</td>
                <td style="text-align: right; font-weight: 800; font-size: 0.95rem; color: #15803d;">
                  +{r.montant.toFixed(2)} €
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
{/if}

{#if activeSubTab === 'achats'}
  <div class="card" style="padding: 24px; margin-bottom: 24px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 12px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span class="active-doc-badge"><i class="fa-solid fa-check"></i> Registre légal</span>
          <h3 style="font-family: var(--font-title); color: #0f172a; margin: 0; font-weight: 800; font-size: 1.15rem;">Registre des Achats</h3>
        </div>
        <p style="font-size: 0.82rem; color: #64748b; margin: 0;">Détail chronologique des achats de fournitures et dépenses professionnelles.</p>
      </div>
      <div style="background: #fef2f2; border: 1.5px solid #fecaca; padding: 8px 16px; border-radius: 10px; text-align: right;">
        <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 800; color: #dc2626; display: block;">Total Dépenses & Achats</span>
        <strong style="font-size: 1.25rem; color: #b91c1c; font-family: var(--font-title);">
          -{totalAchatsMicro.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </strong>
      </div>
    </div>

    <div class="table-container">
      <table class="custom-table" id="achats-micro-table">
        <thead>
          <tr>
            <th>N° Ordre</th>
            <th>Date</th>
            <th>Fournisseur / Tiers</th>
            <th>Nature Dépense</th>
            <th>Règlement</th>
            <th style="text-align: right;">Montant Payé (€)</th>
          </tr>
        </thead>
        <tbody>
          {#if achatsMicro.length === 0}
            <tr>
              <td colspan="6" style="text-align: center; color: #64748b; padding: 36px;">
                Aucun achat enregistré. Attribuez vos dépenses dans le relevé bancaire pour alimenter ce registre.
              </td>
            </tr>
          {:else}
            {#each achatsMicro as a}
              <tr style="border-bottom: 1px solid #f1f5f9; background: #ffffff;">
                <td style="color: #64748b; font-weight: 700; font-size: 0.82rem;">#{String(a.numeroOrdre).padStart(3, '0')}</td>
                <td style="font-weight: 700; color: #0f172a;">{new Date(a.date).toLocaleDateString('fr-FR')}</td>
                <td style="color: #0f172a; font-weight: 700;">{a.fournisseur}</td>
                <td><span class="badge badge-muted">{a.nature}</span></td>
                <td style="font-size: 0.82rem; color: #64748b;">{a.modePaiement}</td>
                <td style="text-align: right; font-weight: 800; font-size: 0.95rem; color: #b91c1c;">
                  -{a.montant.toFixed(2)} €
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
{/if}

{#if activeSubTab === 'recap_ca'}
  <div class="card" style="padding: 24px; margin-bottom: 24px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span class="active-doc-badge"><i class="fa-solid fa-check"></i> Synthèse fiscale</span>
          <h3 style="font-family: var(--font-title); color: #0f172a; margin: 0; font-weight: 800; font-size: 1.15rem;">Récapitulatif Fiscal & Urssaf</h3>
        </div>
        <p style="font-size: 0.82rem; color: #64748b; margin: 0;">Suivi annuel de votre Chiffre d'Affaires, des seuils de franchise de TVA et des cotisations sociales.</p>
      </div>
    </div>

    <!-- 3 KPI Cards -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
      <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 18px;">
        <span style="font-size: 0.76rem; text-transform: uppercase; font-weight: 800; color: #64748b; display: block; margin-bottom: 6px;">Chiffre d'Affaires Encaissé</span>
        <strong style="font-size: 1.45rem; color: #0f172a; font-family: var(--font-title); display: block;">
          {totalRecettesMicro.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </strong>
        <span style="font-size: 0.78rem; color: #16a34a; font-weight: 700;">Base de calcul Urssaf</span>
      </div>

      <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 18px;">
        <span style="font-size: 0.76rem; text-transform: uppercase; font-weight: 800; color: #64748b; display: block; margin-bottom: 6px;">Achats & Dépenses Métier</span>
        <strong style="font-size: 1.45rem; color: #0f172a; font-family: var(--font-title); display: block;">
          {totalAchatsMicro.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </strong>
        <span style="font-size: 0.78rem; color: #64748b;">Non déductibles en micro</span>
      </div>

      <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 12px; padding: 18px;">
        <span style="font-size: 0.76rem; text-transform: uppercase; font-weight: 800; color: #16a34a; display: block; margin-bottom: 6px;">Cotisations Urssaf Estimées (~21,2%)</span>
        <strong style="font-size: 1.45rem; color: #15803d; font-family: var(--font-title); display: block;">
          {(totalRecettesMicro * 0.212).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </strong>
        <span style="font-size: 0.78rem; color: #15803d; font-weight: 600;">Taux BNC / Prestations</span>
      </div>
    </div>

    <!-- Table Trimestrielle Urssaf -->
    <h4 style="font-family: var(--font-title); font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0 0 12px 0;">
      Décomposition par trimestre (pour déclaration Urssaf trimestrielle)
    </h4>
    <div class="table-container">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Trimestre</th>
            <th>Période</th>
            <th style="text-align: right;">CA Encaissé</th>
            <th style="text-align: right;">Cotisations Urssaf (21,2%)</th>
            <th style="text-align: center;">Statut</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>T1</strong></td>
            <td>Janvier - Mars</td>
            <td style="text-align: right; font-weight: 700; color: #0f172a;">{caTrimestriel.T1.toFixed(2)} €</td>
            <td style="text-align: right; font-weight: 700; color: #15803d;">{(caTrimestriel.T1 * 0.212).toFixed(2)} €</td>
            <td style="text-align: center;"><span class="badge {caTrimestriel.T1 > 0 ? 'badge-success' : 'badge-muted'}">{caTrimestriel.T1 > 0 ? 'Prêt à déclarer' : '0 €'}</span></td>
          </tr>
          <tr>
            <td><strong>T2</strong></td>
            <td>Avril - Juin</td>
            <td style="text-align: right; font-weight: 700; color: #0f172a;">{caTrimestriel.T2.toFixed(2)} €</td>
            <td style="text-align: right; font-weight: 700; color: #15803d;">{(caTrimestriel.T2 * 0.212).toFixed(2)} €</td>
            <td style="text-align: center;"><span class="badge {caTrimestriel.T2 > 0 ? 'badge-success' : 'badge-muted'}">{caTrimestriel.T2 > 0 ? 'Prêt à déclarer' : '0 €'}</span></td>
          </tr>
          <tr>
            <td><strong>T3</strong></td>
            <td>Juillet - Septembre</td>
            <td style="text-align: right; font-weight: 700; color: #0f172a;">{caTrimestriel.T3.toFixed(2)} €</td>
            <td style="text-align: right; font-weight: 700; color: #15803d;">{(caTrimestriel.T3 * 0.212).toFixed(2)} €</td>
            <td style="text-align: center;"><span class="badge {caTrimestriel.T3 > 0 ? 'badge-success' : 'badge-muted'}">{caTrimestriel.T3 > 0 ? 'Prêt à déclarer' : '0 €'}</span></td>
          </tr>
          <tr>
            <td><strong>T4</strong></td>
            <td>Octobre - Décembre</td>
            <td style="text-align: right; font-weight: 700; color: #0f172a;">{caTrimestriel.T4.toFixed(2)} €</td>
            <td style="text-align: right; font-weight: 700; color: #15803d;">{(caTrimestriel.T4 * 0.212).toFixed(2)} €</td>
            <td style="text-align: center;"><span class="badge {caTrimestriel.T4 > 0 ? 'badge-success' : 'badge-muted'}">{caTrimestriel.T4 > 0 ? 'Prêt à déclarer' : '0 €'}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
{/if}

{:else}
<!-- ========================================== -->
<!-- SOUS-ONGLETS POUR ASSOCIATIONS & SOCIÉTÉS -->
<!-- ========================================== -->
<!-- subtab: RECETTES & DÉPENSES (DEFAULT NOVICE VIEW) -->
{#if activeSubTab === 'recettes_depenses'}
  <div class="card" style="padding: 24px; margin-bottom: 24px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span class="active-doc-badge"><i class="fa-solid fa-check"></i> Rubrique active</span>
          <h3 style="font-family: var(--font-title); color: #0f172a; margin: 0; font-weight: 800; font-size: 1.15rem;">Livre chronologique des Recettes et Dépenses</h3>
        </div>
        <p style="font-size: 0.82rem; color: #64748b; margin: 0;">Document légal officiel exigé pour les associations, micro-entreprises et TPE.</p>
      </div>
      <div class="tooltip-container">
        <span class="pedago-help-btn">?</span>
        <span class="tooltip-text">
          <strong>Livre des Recettes & Dépenses</strong>
          Ce registre recense chaque encaissement et chaque décaissement dans l'ordre chronologique avec la date, le tiers et la catégorie.
        </span>
      </div>
    </div>
    
    <div class="table-container">
      <table class="custom-table" id="recettes-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Nom / Libellé de l'opération</th>
            <th>Catégorie de gestion</th>
            <th>Type</th>
            <th style="text-align: right;">Montant (€)</th>
          </tr>
        </thead>
        <tbody>
          {#if sortedTxList.length === 0}
            <tr>
              <td colspan="5" style="text-align: center; color: #64748b; padding: 30px;">Aucune opération enregistrée dans le registre chronologique.</td>
            </tr>
          {:else}
            {#each sortedTxList as tx}
              <tr style="border-bottom: 1px solid #f1f5f9; background: #ffffff;">
                <td style="font-weight: 700; color: #0f172a;">{new Date(tx.date).toLocaleDateString('fr-FR')}</td>
                <td style="color: #0f172a; font-weight: 700;">{tx.libelle}</td>
                <td>
                  <span class="badge badge-muted">
                    {tx.compteAttribué} − {Categorizer.obtenirLibelleCompte(tx.compteAttribué)}
                  </span>
                </td>
                <td>
                  {#if tx.credit > 0}
                    <span class="badge badge-success">🟢 Recette</span>
                  {:else}
                    <span class="badge badge-danger">🔴 Dépense</span>
                  {/if}
                </td>
                <td style="text-align: right; font-weight: 800; font-size: 0.95rem; color: {tx.credit > 0 ? '#15803d' : '#b91c1c'};">
                  {tx.credit > 0 ? '+' : '-'}{(tx.credit > 0 ? tx.credit : tx.debit).toFixed(2)} €
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
{/if}

<!-- subtab: JOURNAL -->
{#if activeSubTab === 'journal'}
  <div class="card" style="padding: 24px; margin-bottom: 24px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span class="active-doc-badge"><i class="fa-solid fa-check"></i> Rubrique active</span>
          <h3 style="font-family: var(--font-title); color: #0f172a; margin: 0; font-weight: 800; font-size: 1.15rem;">Livre-journal des écritures (Double entrée)</h3>
        </div>
        <p style="font-size: 0.82rem; color: #64748b; margin: 0;">Enregistrement chronologique officiel de toutes les opérations selon la méthode de la comptabilité en partie double.</p>
      </div>
      <div class="tooltip-container">
        <span class="pedago-help-btn">?</span>
        <span class="tooltip-text">
          <strong>Le Livre-journal</strong>
          C'est le registre obligatoire dans lequel toutes les opérations de la structure sont écrites au jour le jour. Chaque opération possède au moins deux lignes (débit pour l'utilisation, crédit pour l'origine de l'argent).
        </span>
      </div>
    </div>
    
    <div class="table-container">
      <table class="custom-table" id="journal-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>N° Pièce</th>
            <th>Compte Catégorie</th>
            <th>Libellé / Note</th>
            <th>Dépenses (Débit)</th>
            <th>Recettes (Crédit)</th>
          </tr>
        </thead>
        <tbody>
          {#if journalEntries.length === 0}
            <tr>
              <td colspan="6" style="text-align: center; color: var(--text-secondary);">Aucune écriture classée disponible dans le Journal.</td>
            </tr>
          {:else}
            {#each journalEntries as entry}
              <tr>
                <td style={entry.offset ? 'color: var(--text-muted);' : ''}>{entry.date}</td>
                <td style={entry.offset ? 'color: var(--text-muted);' : ''}>{entry.piece}</td>
                <td style={entry.offset ? 'padding-left: 40px;' : ''}><strong>{entry.compte}</strong> - {entry.libelleCompte}</td>
                <td style={entry.offset ? 'color: var(--text-muted);' : ''}>{entry.description}</td>
                <td class="amount debit">{entry.debit ? entry.debit.toFixed(2) + ' €' : '-'}</td>
                <td class="amount credit">{entry.credit ? entry.credit.toFixed(2) + ' €' : '-'}</td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
{/if}

<!-- subtab: GRAND LIVRE -->
{#if activeSubTab === 'grandlivre'}
  <div id="grandlivre-container">
    <div class="card" style="padding: 24px; margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span class="active-doc-badge"><i class="fa-solid fa-check"></i> Rubrique active</span>
            <h3 style="font-family: var(--font-title); color: #0f172a; margin: 0; font-weight: 800; font-size: 1.15rem;">
              Le Grand-livre des comptes
            </h3>
          </div>
          <p style="font-size: 0.82rem; color: #64748b; margin: 0;">
            Détail chronologique des mouvements et solde progressif compte par compte.
          </p>
        </div>
        <div class="tooltip-container">
          <span class="pedago-help-btn">?</span>
          <span class="tooltip-text">
            <strong>Le Grand-livre</strong>
            Ce registre regroupe toutes les écritures du journal réparties dans chacun des comptes du plan comptable (Banque 512, Achats 606, etc.).
          </span>
        </div>
      </div>
    </div>

    {#if grandLivreAccounts.length === 0}
      <div class="card" style="text-align: center; color: var(--text-secondary); padding: 40px;">
        Aucune écriture triée pour remplir le Grand Livre.
      </div>
    {:else}
      {#each grandLivreAccounts as acc}
        <div class="card" style="padding: 24px; margin-bottom: 24px;">
          <h4 style="font-family: var(--font-title); color: #0f172a; font-weight: 800; font-size: 1.05rem; margin: 0 0 14px 0; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; display: flex; align-items: center; gap: 8px;">
            <span style="background: #e0e7ff; color: #4338ca; padding: 2px 8px; border-radius: 6px; font-size: 0.85rem; font-weight: 800;">Compte {acc.compte}</span>
            <span>{acc.nom}</span>
          </h4>
          <div class="table-container">
            <table class="custom-table" style="font-size: 0.88rem;">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Détail Opération</th>
                  <th>Débit (Dépenses)</th>
                  <th>Crédit (Recettes)</th>
                  <th>Solde progressif</th>
                </tr>
              </thead>
              <tbody>
                {#each acc.operations as op}
                  <tr>
                    <td>{new Date(op.date).toLocaleDateString('fr-FR')}</td>
                    <td style="color: #0f172a; font-weight: 600;">{op.libelle}</td>
                    <td class="amount debit">{op.debit > 0 ? op.debit.toFixed(2) + ' €' : '-'}</td>
                    <td class="amount credit">{op.credit > 0 ? op.credit.toFixed(2) + ' €' : '-'}</td>
                    <td style="font-weight: 700; color: #0f172a;">{op.solde.toFixed(2)} €</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/each}
    {/if}
  </div>
{/if}

<!-- subtab: BALANCE -->
{#if activeSubTab === 'balance'}
  <div class="card" style="padding: 24px; margin-bottom: 24px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span class="active-doc-badge"><i class="fa-solid fa-check"></i> Rubrique active</span>
          <h3 style="font-family: var(--font-title); color: #0f172a; margin: 0; font-weight: 800; font-size: 1.15rem;">La Balance Générale des comptes</h3>
        </div>
        <p style="font-size: 0.82rem; color: #64748b; margin: 0;">Récapitulatif des débits, crédits et soldes nets pour tous les comptes du plan comptable.</p>
      </div>
      <div class="tooltip-container">
        <span class="pedago-help-btn">?</span>
        <span class="tooltip-text">
          <strong>La Balance comptable</strong>
          C'est un récapitulatif de tous les comptes ouverts dans le Grand Livre. Elle affiche la somme des débits et des crédits pour chaque compte, et le solde net qui en découle. C'est l'outil de vérification par excellence.
        </span>
      </div>
    </div>
    
    <div class="table-container">
      <table class="custom-table" id="balance-table">
        <thead>
          <tr>
            <th>N° Compte</th>
            <th>Intitulé du compte</th>
            <th>Total Débits</th>
            <th>Total Crédits</th>
            <th>Solde Débiteur</th>
            <th>Solde Créditeur</th>
          </tr>
        </thead>
        <tbody>
          {#if balanceRows.length === 0 || (balanceRows.length === 1 && balanceRows[0].debit === 0 && balanceRows[0].credit === 0)}
            <tr>
              <td colspan="6" style="text-align: center; color: var(--text-secondary);">Aucune écriture triée disponible pour la balance.</td>
            </tr>
          {:else}
            {#each balanceRows as row}
              <tr>
                <td><strong>{row.compte}</strong></td>
                <td style="color: #0f172a; font-weight: 600;">{row.nom}</td>
                <td class="amount">{row.debit.toFixed(2)} €</td>
                <td class="amount">{row.credit.toFixed(2)} €</td>
                <td class="amount debit">{row.soldeDebiteur > 0 ? row.soldeDebiteur.toFixed(2) + ' €' : '-'}</td>
                <td class="amount credit">{row.soldeCrediteur > 0 ? row.soldeCrediteur.toFixed(2) + ' €' : '-'}</td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
{/if}

<!-- subtab: BILAN -->
{#if activeSubTab === 'bilan'}
  <div class="card" style="padding: 24px; margin-bottom: 24px;">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span class="active-doc-badge"><i class="fa-solid fa-check"></i> Rubrique active</span>
          <h3 style="font-family: var(--font-title); color: #0f172a; margin: 0; font-weight: 800; font-size: 1.15rem;">Le Bilan Simplifié</h3>
        </div>
        <p style="font-size: 0.82rem; color: #64748b; margin: 0;">
          Photographie du patrimoine : Actif (ce que vous possédez) vs Passif (ce que vous devez).
        </p>
      </div>
      <div class="tooltip-container">
        <span class="pedago-help-btn">?</span>
        <span class="tooltip-text">
          <strong>Le Bilan Simplifié</strong>
          Le Bilan récapitule la situation financière globale en comparant l'Actif (trésorerie, créances) et le Passif (capitaux, dettes, résultat de l'exercice).
        </span>
      </div>
    </div>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 30px;">
    
    <!-- ACTIF -->
    <div class="card" style="padding: 24px;">
      <h3 style="font-family: var(--font-title); margin: 0 0 15px 0; border-bottom: 1.5px solid var(--border-color); padding-bottom: 10px; color: #0f172a; font-weight: 800; font-size: 1.05rem;">
        ACTIF (Ce que la structure possède)
      </h3>
      <table class="custom-table" id="bilan-actif-table">
        <thead>
          <tr>
            <th>Rubrique / Compte</th>
            <th style="text-align: right;">Valeur nette</th>
          </tr>
        </thead>
        <tbody>
          {#each bilanData.actifs as act}
            <tr>
              <td><strong>{act.compte}</strong> - {act.nom}</td>
              <td class="amount" style="text-align: right; color: #0f172a; font-weight: 600;">{act.valeur.toFixed(2)} €</td>
            </tr>
          {/each}
          <tr style="background-color: #f8fafc;">
            <td style="color: #0f172a; font-weight: 800;">TOTAL DE L'ACTIF</td>
            <td class="amount" style="text-align: right; color: #2563eb; font-weight: 800; font-size: 1.1rem;">
              {bilanData.totalActif.toFixed(2)} €
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- PASSIF -->
    <div class="card" style="padding: 24px;">
      <h3 style="font-family: var(--font-title); margin: 0 0 15px 0; border-bottom: 1.5px solid var(--border-color); padding-bottom: 10px; color: #0f172a; font-weight: 800; font-size: 1.05rem;">
        PASSIF (Ce que la structure doit)
      </h3>
      <table class="custom-table" id="bilan-passif-table">
        <thead>
          <tr>
            <th>Rubrique / Compte</th>
            <th style="text-align: right;">Valeur nette</th>
          </tr>
        </thead>
        <tbody>
          {#each bilanData.passifs as pas}
            <tr>
              <td><strong>{pas.compte}</strong> - {pas.nom}</td>
              <td class="amount" style="text-align: right; color: #0f172a; font-weight: 600;">{pas.valeur.toFixed(2)} €</td>
            </tr>
          {/each}
          <tr>
            <td><strong>120/129</strong> - Résultat net (Bénéfice/Excédent)</td>
            <td class="amount" style="text-align: right; color: var(--color-success); font-weight: 700;">
              {bilanData.excedent.toFixed(2)} €
            </td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="color: #0f172a; font-weight: 800;">TOTAL DU PASSIF</td>
            <td class="amount" style="text-align: right; color: var(--color-success); font-weight: 800; font-size: 1.1rem;">
              {bilanData.totalPassif.toFixed(2)} €
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
{/if}
{/if}

<style>
  .tabs-segmented-container {
    display: inline-flex;
    gap: 6px;
    background: #e2e8f0;
    padding: 6px;
    border-radius: 14px;
    border: 1.5px solid #cbd5e1;
    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
    flex-wrap: wrap;
    justify-content: center;
  }

  .tab-segmented-btn {
    border: none;
    background: transparent;
    color: #475569;
    font-size: 0.88rem;
    padding: 9px 18px;
    border-radius: 9px;
    cursor: pointer;
    font-weight: 700;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    position: relative;
    user-select: none;
  }

  .tab-segmented-btn:hover:not(.active) {
    background: #ffffff;
    color: #0f172a;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .tab-segmented-btn.active {
    background: #0f172a !important;
    color: #ffffff !important;
    box-shadow: 0 3px 10px rgba(15, 23, 42, 0.28) !important;
  }

  .tab-segmented-btn.active i {
    color: #38bdf8 !important;
  }

  .tab-segmented-btn:not(.active) i {
    color: #64748b;
  }

  .active-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #38bdf8;
    box-shadow: 0 0 6px #38bdf8;
    display: inline-block;
    margin-left: 2px;
  }

  .active-doc-badge {
    background: #0f172a;
    color: #ffffff;
    font-size: 0.72rem;
    font-weight: 800;
    padding: 3px 9px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    letter-spacing: 0.3px;
  }

  .active-doc-badge i {
    color: #38bdf8;
    font-size: 0.7rem;
  }
</style>
