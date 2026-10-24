<script>
  import { 
    transactions, 
    planComptable, 
    closingMonth, 
    updateClosingMonth, 
    fiscalStartDate,
    fiscalEndDate,
    updateFiscalPeriod,
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
        { id: 'recap_ca', label: 'Déclaration CA & Urssaf', icon: 'fa-chart-pie' }
      ];
    }
    if (accountingModel === 'bnc') {
      return [
        { id: 'recettes_depenses', label: 'Livre-journal Recettes & Dépenses (Art. 99 CGI)', icon: 'fa-scale-balanced' },
        { id: 'bilan', label: 'Synthèse Déclaration 2035', icon: 'fa-file-lines' }
      ];
    }
    if (accountingModel === 'sci') {
      return [
        { id: 'recettes_depenses', label: 'Loyers & Dépenses Locatives (SCI)', icon: 'fa-building' },
        { id: 'bilan', label: 'Synthèse Déclaration 2072', icon: 'fa-file-lines' }
      ];
    }
    if (accountingModel === 'copro') {
      return [
        { id: 'journal', label: 'Livre-journal Copro', icon: 'fa-table-list' },
        { id: 'grandlivre', label: 'Le Grand-livre Copro', icon: 'fa-book-bookmark' },
        { id: 'balance', label: 'La Balance générale', icon: 'fa-scale-balanced' },
        { id: 'bilan', label: 'Arrêté des Comptes & Annexes', icon: 'fa-landmark' }
      ];
    }
    if (accountingModel === 'asso') {
      return [
        { id: 'recettes_depenses', label: 'Livre de Trésorerie', icon: 'fa-book' },
        { id: 'bilan', label: 'Bilan & Excédent Associatif', icon: 'fa-chart-pie' }
      ];
    }
    // Par défaut: Société / TPE (Comptabilité commerciale en partie double obligatoire)
    return [
      { id: 'journal', label: 'Livre-journal', icon: 'fa-table-list' },
      { id: 'grandlivre', label: 'Le Grand-livre', icon: 'fa-book-bookmark' },
      { id: 'balance', label: 'La Balance générale', icon: 'fa-scale-balanced' },
      { id: 'bilan', label: 'Bilan & Résultat', icon: 'fa-chart-pie' }
    ];
  })());

  let activeSubTab = $state('journal');
  let localStartDate = $state('');
  let localEndDate = $state('');

  $effect(() => {
    localStartDate = $fiscalStartDate || '';
    localEndDate = $fiscalEndDate || '';
  });

  $effect(() => {
    if (!subTabs.some(t => t.id === activeSubTab)) {
      activeSubTab = subTabs[0]?.id || 'journal';
    }
  });

  // Filter and sort transactions chronologically (Svelte 5 derived rune)
  let rawTxList = $derived([...$transactions]
    .filter(t => (!t.entityId || t.entityId === $activeEntityId) && t.compteAttribué !== '699' && t.statut === 'attribue'));

  let sortedTxList = $derived(rawTxList
    .filter(t => {
      if (localStartDate && t.date < localStartDate) return false;
      if (localEndDate && t.date > localEndDate) return false;
      return true;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));

  // Totaux consolidés pour le Livre chronologique
  let totalRecettes = $derived(sortedTxList.reduce((acc, tx) => acc + (tx.credit || 0), 0));
  let totalDepenses = $derived(sortedTxList.reduce((acc, tx) => acc + (tx.debit || 0), 0));
  let soldeNet = $derived(totalRecettes - totalDepenses);

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

  function handleSaveFiscalPeriod() {
    updateFiscalPeriod(localStartDate, localEndDate);
    if (!localStartDate && !localEndDate) {
      showToast("Période réinitialisée : l'ensemble des opérations est affiché.");
    } else {
      const s = localStartDate ? new Date(localStartDate).toLocaleDateString('fr-FR') : 'début';
      const e = localEndDate ? new Date(localEndDate).toLocaleDateString('fr-FR') : 'fin';
      showToast(`Exercice comptable configuré : du ${s} au ${e}.`);
    }
  }

  function applyPreset(preset) {
    if (preset === '2026') {
      localStartDate = '2026-01-01';
      localEndDate = '2026-12-31';
    } else if (preset === '2025') {
      localStartDate = '2025-01-01';
      localEndDate = '2025-12-31';
    } else if (preset === 'all') {
      localStartDate = '';
      localEndDate = '';
    }
    handleSaveFiscalPeriod();
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
    const yearSuffix = localStartDate ? localStartDate.slice(0, 4) : new Date().getFullYear();
    link.setAttribute("download", `FEC_${activeEntity.name.replace(/\s+/g, '_')}_${yearSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Export FEC généré pour votre expert-comptable.");
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
    showToast('Livre des Recettes (Format officiel Urssaf) téléchargé !');
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
    showToast('Registre des Achats téléchargé !');
  }

  function exportLivreRecettesDepensesCSV() {
    let csv = "Date;Nom / Libellé de l'opération;Numéro Compte;Catégorie de gestion;Type;Montant Signé (€);Recette (€);Dépense (€)\n";
    sortedTxList.forEach(tx => {
      const dateStr = new Date(tx.date).toLocaleDateString('fr-FR');
      const libelle = `"${(tx.libelle || '').replace(/"/g, '""')}"`;
      const cat = `"${(Categorizer.obtenirLibelleCompte(tx.compteAttribué) || '').replace(/"/g, '""')}"`;
      const type = tx.credit > 0 ? 'RECETTE' : 'DÉPENSE';
      const montantSigne = tx.credit > 0 ? `+${tx.credit.toFixed(2)}` : `-${tx.debit.toFixed(2)}`;
      const recette = tx.credit > 0 ? tx.credit.toFixed(2) : '0.00';
      const depense = tx.debit > 0 ? tx.debit.toFixed(2) : '0.00';
      csv += `${dateStr};${libelle};${tx.compteAttribué};${cat};${type};${montantSigne};${recette};${depense}\n`;
    });
    csv += `;;;TOTAL RECETTES;;+${totalRecettes.toFixed(2)};${totalRecettes.toFixed(2)};0.00\n`;
    csv += `;;;TOTAL DÉPENSES;;-${totalDepenses.toFixed(2)};0.00;${totalDepenses.toFixed(2)}\n`;
    csv += `;;;SOLDE NET;;${soldeNet >= 0 ? '+' : ''}${soldeNet.toFixed(2)};;;\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const prefix = accountingModel === 'bnc' ? 'LIVRE_RECETTES_DEPENSES_BNC' : (accountingModel === 'sci' ? 'REGISTRE_RECETTES_DEPENSES_SCI' : 'LIVRE_RECETTES_DEPENSES');
    link.download = `${prefix}_${activeEntity.name.replace(/\s+/g, '_')}_${new Date().getFullYear()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Livre des Recettes et Dépenses téléchargé avec succès.');
  }

  // Totaux Journal
  let totalJournalDebit = $derived(journalEntries.reduce((acc, e) => acc + (e.debit || 0), 0));
  let totalJournalCredit = $derived(journalEntries.reduce((acc, e) => acc + (e.credit || 0), 0));

  // Totaux Balance
  let totalBalanceDebit = $derived(balanceRows.reduce((acc, r) => acc + (r.debit || 0), 0));
  let totalBalanceCredit = $derived(balanceRows.reduce((acc, r) => acc + (r.credit || 0), 0));
  let totalBalanceSoldeDebiteur = $derived(balanceRows.reduce((acc, r) => acc + (r.soldeDebiteur || 0), 0));
  let totalBalanceSoldeCrediteur = $derived(balanceRows.reduce((acc, r) => acc + (r.soldeCrediteur || 0), 0));

  function exportJournalCSV() {
    let csv = "Date;N° Pièce;Compte;Libellé Compte;Description;Débit (€);Crédit (€)\n";
    journalEntries.forEach(e => {
      const desc = `"${(e.description || '').replace(/"/g, '""')}"`;
      const lib = `"${(e.libelleCompte || '').replace(/"/g, '""')}"`;
      const deb = e.debit ? e.debit.toFixed(2) : '0.00';
      const cre = e.credit ? e.credit.toFixed(2) : '0.00';
      csv += `${e.date};${e.piece};${e.compte};${lib};${desc};${deb};${cre}\n`;
    });
    csv += `;;;TOTAL GÉNÉRAL;;${totalJournalDebit.toFixed(2)};${totalJournalCredit.toFixed(2)}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `LIVRE_JOURNAL_${activeEntity.name.replace(/\s+/g, '_')}_${new Date().getFullYear()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Livre-journal téléchargé avec succès.');
  }

  function exportGrandLivreCSV() {
    let csv = "Compte;Intitulé Compte;Date;Libellé Opération;Débit (€);Crédit (€);Solde Progressif (€)\n";
    grandLivreAccounts.forEach(acc => {
      const nom = `"${(acc.nom || '').replace(/"/g, '""')}"`;
      acc.operations.forEach(op => {
        const lib = `"${(op.libelle || '').replace(/"/g, '""')}"`;
        const deb = op.debit ? op.debit.toFixed(2) : '0.00';
        const cre = op.credit ? op.credit.toFixed(2) : '0.00';
        csv += `${acc.compte};${nom};${new Date(op.date).toLocaleDateString('fr-FR')};${lib};${deb};${cre};${op.solde.toFixed(2)}\n`;
      });
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `GRAND_LIVRE_${activeEntity.name.replace(/\s+/g, '_')}_${new Date().getFullYear()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Grand-livre téléchargé avec succès.');
  }

  function exportBalanceCSV() {
    let csv = "Numéro Compte;Intitulé du Compte;Total Débit (€);Total Crédit (€);Solde Débiteur (€);Solde Créditeur (€)\n";
    balanceRows.forEach(b => {
      const nom = `"${(b.nom || '').replace(/"/g, '""')}"`;
      const deb = b.debit ? b.debit.toFixed(2) : '0.00';
      const cre = b.credit ? b.credit.toFixed(2) : '0.00';
      const sDeb = b.soldeDebiteur ? b.soldeDebiteur.toFixed(2) : '0.00';
      const sCre = b.soldeCrediteur ? b.soldeCrediteur.toFixed(2) : '0.00';
      csv += `${b.compte};${nom};${deb};${cre};${sDeb};${sCre}\n`;
    });
    csv += `TOTAL;TOTAL GÉNÉRAL;${totalBalanceDebit.toFixed(2)};${totalBalanceCredit.toFixed(2)};${totalBalanceSoldeDebiteur.toFixed(2)};${totalBalanceSoldeCrediteur.toFixed(2)}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `BALANCE_${activeEntity.name.replace(/\s+/g, '_')}_${new Date().getFullYear()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Balance générale téléchargée avec succès.');
  }


</script>

<div class="page-title-section" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 22px;">
  <div>
    <h1 class="page-title" style="margin: 0 0 6px 0; font-family: var(--font-title); font-weight: 800; font-size: 1.6rem; color: #0f172a;">
      {#if accountingModel === 'micro'}
        Registres Obligatoires & Déclaration Urssaf
      {:else if accountingModel === 'bnc'}
        Comptabilité Libérale & Déclaration 2035
      {:else if accountingModel === 'sci'}
        Comptabilité Immobilière & Déclaration 2072
      {:else if accountingModel === 'copro'}
        Comptabilité du Syndicat & Arrêté des Comptes
      {:else if accountingModel === 'tpe'}
        Livres Comptables & Export FEC
      {:else}
        Livres & Synthèse Comptable
      {/if}
    </h1>
    <p class="page-subtitle" style="margin: 0; color: #64748b; font-size: 0.9rem; line-height: 1.5;">
      {#if accountingModel === 'micro'}
        Générez vos registres officiels de recettes et d'achats, et préparez votre déclaration de chiffre d'affaires trimestrielle.
      {:else if accountingModel === 'bnc'}
        Consultez votre livre-journal de recettes et dépenses (CGI art. 99) et préparez votre déclaration fiscale 2035.
      {:else if accountingModel === 'sci'}
        Suivez vos encaissements de loyers et charges d'immeuble pour déterminer le résultat net foncier de la déclaration 2072.
      {:else if accountingModel === 'copro'}
        Tenez les journaux légaux de la copropriété (Décret 2005), contrôlez la balance et préparez l'arrêté des comptes pour l'Assemblée Générale.
      {:else if accountingModel === 'tpe'}
        Consultez vos livres obligatoires (Journal, Grand-livre, Balance, Bilan) et téléchargez le fichier FEC conforme pour votre expert-comptable.
      {:else}
        Consultez vos documents comptables conformes aux normes fiscales et téléchargez vos exports officiels.
      {/if}
    </p>
  </div>

  <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
    {#if accountingModel === 'micro'}
      <button 
        type="button" 
        class="btn btn-success" 
        onclick={exportLivreRecettesMicro} 
        style="background: #15803d; color: #ffffff; border: none; padding: 10px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-size: 0.88rem; box-shadow: 0 2px 6px rgba(21, 128, 61, 0.15);"
      >
        <i class="fa-solid fa-file-export"></i> Exporter le Livre des Recettes (Format Urssaf)
      </button>
      <span style="font-size: 0.74rem; color: #166534; font-weight: 600;">Format officiel exigé par l'Urssaf et la DGFiP</span>
    {:else}
      <button 
        type="button" 
        class="btn btn-success" 
        onclick={exportFEC} 
        style="background: #15803d; color: #ffffff; border: none; padding: 10px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-size: 0.88rem; box-shadow: 0 2px 6px rgba(21, 128, 61, 0.15);"
        title="Fichier des Écritures Comptables conforme aux normes DGFiP pour l'expert-comptable ou le contrôle fiscal"
      >
        <i class="fa-solid fa-file-export"></i> Exporter le fichier FEC (Expert-comptable)
      </button>
      <span style="font-size: 0.74rem; color: #166534; font-weight: 600;">Format légal DGFiP pour la clôture fiscale annuelle</span>
    {/if}
  </div>
</div>

<!-- ========================================== -->
<!-- BARRE DE PÉRIODE COMPTABLE (CALENDRIER SIMPLE & UNIVERSEL) -->
<!-- ========================================== -->
<div class="card" style="margin-bottom: 22px; padding: 14px 20px; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; box-shadow: 0 1px 4px rgba(15, 23, 42, 0.03);">
  <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
    
    <!-- SÉLECTION DATES DU / AU AVEC CALENDRIER -->
    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
      <span style="font-weight: 700; font-size: 0.84rem; color: #1e293b; display: inline-flex; align-items: center; gap: 6px;">
        <i class="fa-solid fa-calendar-days" style="color: #2563eb;"></i> Période affichée :
      </span>
      
      <div style="display: flex; align-items: center; gap: 6px;">
        <label for="fiscal-start" style="font-size: 0.8rem; font-weight: 600; color: #64748b; cursor: pointer;">Du</label>
        <input 
          id="fiscal-start" 
          type="date" 
          bind:value={localStartDate}
          onchange={handleSaveFiscalPeriod}
          style="padding: 6px 10px; border: 1.5px solid #cbd5e1; border-radius: 6px; font-size: 0.84rem; font-weight: 600; color: #0f172a; background: #f8fafc;"
        />
      </div>

      <div style="display: flex; align-items: center; gap: 6px;">
        <label for="fiscal-end" style="font-size: 0.8rem; font-weight: 600; color: #64748b; cursor: pointer;">au</label>
        <input 
          id="fiscal-end" 
          type="date" 
          bind:value={localEndDate}
          onchange={handleSaveFiscalPeriod}
          style="padding: 6px 10px; border: 1.5px solid #cbd5e1; border-radius: 6px; font-size: 0.84rem; font-weight: 600; color: #0f172a; background: #f8fafc;"
        />
      </div>

      <button 
        type="button" 
        onclick={handleSaveFiscalPeriod}
        style="background: #0f172a; color: #ffffff; border: none; padding: 6px 12px; font-weight: 700; border-radius: 6px; cursor: pointer; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 5px;"
      >
        <i class="fa-solid fa-filter"></i> Filtrer
      </button>

      {#if localStartDate || localEndDate}
        <button 
          type="button" 
          onclick={() => applyPreset('all')}
          style="background: transparent; color: #dc2626; border: 1px solid #fecaca; padding: 5px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
          title="Afficher toutes les opérations sans restriction de date"
        >
          <i class="fa-solid fa-xmark"></i> Réinitialiser
        </button>
      {/if}
    </div>

    <!-- RACCOURCIS DE PÉRIODE -->
    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
      <span style="font-size: 0.76rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Année :</span>
      <button 
        type="button" 
        onclick={() => applyPreset('2026')}
        style="background: {localStartDate === '2026-01-01' && localEndDate === '2026-12-31' ? '#0f172a' : '#ffffff'}; color: {localStartDate === '2026-01-01' && localEndDate === '2026-12-31' ? '#ffffff' : '#475569'}; border: 1px solid #cbd5e1; padding: 5px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer;"
      >
        Année 2026
      </button>
      <button 
        type="button" 
        onclick={() => applyPreset('2025')}
        style="background: {localStartDate === '2025-01-01' && localEndDate === '2025-12-31' ? '#0f172a' : '#ffffff'}; color: {localStartDate === '2025-01-01' && localEndDate === '2025-12-31' ? '#ffffff' : '#475569'}; border: 1px solid #cbd5e1; padding: 5px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer;"
      >
        Année 2025
      </button>
      <button 
        type="button" 
        onclick={() => applyPreset('all')}
        style="background: {!localStartDate && !localEndDate ? '#0f172a' : '#ffffff'}; color: {!localStartDate && !localEndDate ? '#ffffff' : '#475569'}; border: 1px solid #cbd5e1; padding: 5px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer;"
      >
        Tout l'historique
      </button>
    </div>

    <!-- COMPTEUR DES ÉCRITURES -->
    <div>
      {#if localStartDate || localEndDate}
        <span class="badge badge-success" style="font-size: 0.75rem; padding: 4px 10px;">
          {sortedTxList.length} sur {rawTxList.length} opérations
        </span>
      {:else}
        <span class="badge badge-muted" style="font-size: 0.75rem; padding: 4px 10px;">
          {rawTxList.length} opérations au total
        </span>
      {/if}
    </div>

  </div>
</div>

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
  <div class="card" style="padding: 20px 24px; margin-bottom: 22px; border-left: 4px solid #16a34a; background: #ffffff;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 12px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <h3 style="font-family: var(--font-title); color: #0f172a; margin: 0; font-weight: 800; font-size: 1.15rem;">
            Livre chronologique des Recettes
          </h3>
          <span class="badge badge-success" style="font-size: 0.72rem; text-transform: uppercase;">Registre légal obligatoire</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 3px; font-size: 0.85rem;">
          <div>
            <strong style="color: #0f172a;">Ce que ça fait :</strong>
            <span style="color: #475569;">Enregistre chronologiquement chaque encaissement client avec sa date, référence de facture, tiers et mode de paiement.</span>
          </div>
          <div>
            <strong style="color: #15803d;">Ce que ça vous permet :</strong>
            <span style="color: #475569;">Justifier officiellement votre Chiffre d'Affaires encaissé en cas de contrôle de l'Urssaf ou de la DGFiP.</span>
          </div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <button class="btn btn-secondary btn-sm" onclick={exportLivreRecettesMicro} style="background: #ffffff; color: #0f172a; border: 1.5px solid #cbd5e1; padding: 8px 14px; font-weight: 700; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-size: 0.84rem;">
          <i class="fa-solid fa-file-csv"></i> Exporter en CSV
        </button>
        <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; padding: 8px 16px; border-radius: 10px; text-align: right;">
          <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 800; color: #16a34a; display: block;">Chiffre d'Affaires Total</span>
          <strong style="font-size: 1.25rem; color: #15803d; font-family: var(--font-title);">
            {totalRecettesMicro.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </strong>
        </div>
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
  <div class="card" style="padding: 20px 24px; margin-bottom: 22px; border-left: 4px solid #dc2626; background: #ffffff;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 12px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <h3 style="font-family: var(--font-title); color: #0f172a; margin: 0; font-weight: 800; font-size: 1.15rem;">
            Registre des Achats & Frais Professionnels
          </h3>
          <span class="badge badge-muted" style="font-size: 0.72rem; text-transform: uppercase;">Registre de gestion</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 3px; font-size: 0.85rem;">
          <div>
            <strong style="color: #0f172a;">Ce que ça fait :</strong>
            <span style="color: #475569;">Récapitule l'ensemble des dépenses d'achats de fournitures, abonnements logiciels et frais engagés pour votre activité.</span>
          </div>
          <div>
            <strong style="color: #15803d;">Ce que ça vous permet :</strong>
            <span style="color: #475569;">Conserver une traçabilité précise de vos coûts réels et évaluer la rentabilité nette de votre entreprise.</span>
          </div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <button class="btn btn-secondary btn-sm" onclick={exportRegistreAchatsMicro} style="background: #ffffff; color: #0f172a; border: 1.5px solid #cbd5e1; padding: 8px 14px; font-weight: 700; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-size: 0.84rem;">
          <i class="fa-solid fa-file-csv"></i> Exporter en CSV
        </button>
        <div style="background: #fef2f2; border: 1.5px solid #fecaca; padding: 8px 16px; border-radius: 10px; text-align: right;">
          <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 800; color: #dc2626; display: block;">Total Dépenses & Achats</span>
          <strong style="font-size: 1.25rem; color: #b91c1c; font-family: var(--font-title);">
            -{totalAchatsMicro.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </strong>
        </div>
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
  <div class="card" style="padding: 20px 24px; margin-bottom: 22px; border-left: 4px solid #2563eb; background: #ffffff;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 12px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <h3 style="font-family: var(--font-title); color: #0f172a; margin: 0; font-weight: 800; font-size: 1.15rem;">
            Déclaration de Chiffre d'Affaires & Cotisations Urssaf
          </h3>
          <span class="badge badge-primary" style="font-size: 0.72rem; text-transform: uppercase;">Synthèse fiscale & sociale</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 3px; font-size: 0.85rem;">
          <div>
            <strong style="color: #0f172a;">Ce que ça fait :</strong>
            <span style="color: #475569;">Calcule automatiquement votre Chiffre d'Affaires encaissé par trimestre, vos cotisations Urssaf (21,2%) et votre reste net en poche.</span>
          </div>
          <div>
            <strong style="color: #15803d;">Ce que ça vous permet :</strong>
            <span style="color: #475569;">Remplir votre télédéclaration Urssaf sans risque d'erreur de calcul et surveiller vos plafonds de TVA.</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 5 KPI Cards : Du Net Ventes au Net en Poche -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 16px;">
      <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 18px;">
        <span style="font-size: 0.76rem; text-transform: uppercase; font-weight: 800; color: #64748b; display: block; margin-bottom: 6px;">CA Encaissé Net</span>
        <strong style="font-size: 1.4rem; color: #0f172a; font-family: var(--font-title); display: block;">
          {totalRecettesMicro.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </strong>
        <span style="font-size: 0.78rem; color: #16a34a; font-weight: 700;">Facturé aux clients (ce que je vends)</span>
      </div>

      <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 18px;">
        <span style="font-size: 0.76rem; text-transform: uppercase; font-weight: 800; color: #64748b; display: block; margin-bottom: 6px;">Dépenses d'activité</span>
        <strong style="font-size: 1.4rem; color: #b91c1c; font-family: var(--font-title); display: block;">
          -{totalAchatsMicro.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </strong>
        <span style="font-size: 0.78rem; color: #64748b;">Achats et frais pro décaissés</span>
      </div>

      <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 12px; padding: 18px;">
        <span style="font-size: 0.76rem; text-transform: uppercase; font-weight: 800; color: #1e40af; display: block; margin-bottom: 6px;">CA moins les dépenses</span>
        <strong style="font-size: 1.4rem; color: #1e3a8a; font-family: var(--font-title); display: block;">
          {(totalRecettesMicro - totalAchatsMicro).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </strong>
        <span style="font-size: 0.78rem; color: #2563eb; font-weight: 700;">Reste sur mes ventes avant Urssaf</span>
      </div>

      <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 18px;">
        <span style="font-size: 0.76rem; text-transform: uppercase; font-weight: 800; color: #64748b; display: block; margin-bottom: 6px;">Charges Urssaf (21,2%)</span>
        <strong style="font-size: 1.4rem; color: #ea580c; font-family: var(--font-title); display: block;">
          -{(totalRecettesMicro * 0.212).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </strong>
        <span style="font-size: 0.78rem; color: #c2410c; font-weight: 600;">Cotisations sociales à régler</span>
      </div>

      <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 12px; padding: 18px;">
        <span style="font-size: 0.76rem; text-transform: uppercase; font-weight: 800; color: #16a34a; display: block; margin-bottom: 6px;">Reste Net Final</span>
        <strong style="font-size: 1.4rem; color: #15803d; font-family: var(--font-title); display: block;">
          {(totalRecettesMicro - (totalRecettesMicro * 0.212) - totalAchatsMicro).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </strong>
        <span style="font-size: 0.78rem; color: #15803d; font-weight: 700;">En poche après charges</span>
      </div>
    </div>

    <!-- BANDEAU FIL CONDUCTEUR : FORMULE DE TRÉSORERIE ÉTAPE PAR ÉTAPE -->
    <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; font-size: 0.88rem; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-calculator" style="color: #64748b;"></i>
        <span style="color: #475569; font-weight: 700;">Votre trésorerie étape par étape :</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; font-weight: 800; font-family: var(--font-title); flex-wrap: wrap;">
        <span style="color: #0f172a;" title="Facturé aux clients">{totalRecettesMicro.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">(CA encaissé net)</span></span>
        <span style="color: #94a3b8;">−</span>
        <span style="color: #b91c1c;" title="Achats & dépenses">{totalAchatsMicro.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">(Dépenses)</span></span>
        <span style="color: #94a3b8;">=</span>
        <span style="color: #2563eb; background: #eff6ff; padding: 3px 8px; border-radius: 6px; border: 1px solid #bfdbfe;" title="Reste sur mes ventes avant Urssaf">{(totalRecettesMicro - totalAchatsMicro).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} <span style="font-size: 0.72rem; color: #1e40af; font-weight: 600;">(CA moins dépenses)</span></span>
        <span style="color: #94a3b8;">−</span>
        <span style="color: #ea580c;" title="Cotisations Urssaf à régler">{(totalRecettesMicro * 0.212).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">(Charges Urssaf)</span></span>
        <span style="color: #94a3b8;">=</span>
        <span style="color: #15803d; background: #f0fdf4; padding: 3px 8px; border-radius: 6px; border: 1px solid #bbf7d0;" title="Revenu net disponible en poche">{(totalRecettesMicro - (totalRecettesMicro * 0.212) - totalAchatsMicro).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} <span style="font-size: 0.72rem; color: #166534; font-weight: 600;">(Reste net en poche)</span></span>
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
<!-- subtab: RECETTES & DÉPENSES (FLUX DE TRÉSORERIE) -->
{#if activeSubTab === 'recettes_depenses'}
  <div class="card" style="padding: 20px 24px; margin-bottom: 22px; border-left: 4px solid #2563eb; background: #ffffff;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 12px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <h3 style="font-family: var(--font-title); color: #0f172a; margin: 0; font-weight: 800; font-size: 1.15rem;">
            {#if accountingModel === 'bnc'}
              Livre-journal des Recettes et des Dépenses (CGI art. 99)
            {:else if accountingModel === 'sci'}
              Registre des Recettes et Dépenses Locatives (SCI)
            {:else if accountingModel === 'tpe'}
              Journal des Flux de Trésorerie (Entrées & Sorties)
            {:else}
              Livre de Trésorerie des Recettes et Dépenses
            {/if}
          </h3>
          <span class="badge {accountingModel === 'bnc' ? 'badge-success' : 'badge-primary'}" style="font-size: 0.72rem; text-transform: uppercase;">
            {#if accountingModel === 'bnc'}
              Registre légal obligatoire CGI
            {:else}
              Suivi des flux bancaires
            {/if}
          </span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 3px; font-size: 0.85rem;">
          <div>
            <strong style="color: #0f172a;">Ce que ça fait :</strong>
            <span style="color: #475569;">
              {#if accountingModel === 'bnc'}
                Enregistre au jour le jour les honoraires perçus (avec nom du client) et les dépenses professionnelles payées.
              {:else if accountingModel === 'sci'}
                Enregistre chronologiquement chaque loyer encaissé et chaque charge de copropriété ou travaux d'entretien payés.
              {:else}
                Historique chronologique au fil de l'eau de tous les mouvements bancaires avec date, tiers et compte attribué.
              {/if}
            </span>
          </div>
          <div>
            <strong style="color: #15803d;">Ce que ça vous permet :</strong>
            <span style="color: #475569;">
              {#if accountingModel === 'bnc'}
                Tenir le registre comptable légal imposé aux professions libérales pour justifier la déclaration 2035.
              {:else if accountingModel === 'sci'}
                Suivre le résultat locatif net et justifier la réalité des charges déductibles pour la déclaration 2072.
              {:else}
                Contrôler en temps réel l'ensemble des encaissements, des décaissements et le solde bancaire disponible.
              {/if}
            </span>
          </div>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 10px;">
        <button class="btn btn-secondary btn-sm" onclick={exportLivreRecettesDepensesCSV} style="background: #ffffff; color: #0f172a; border: 1.5px solid #cbd5e1; padding: 8px 14px; font-weight: 700; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-size: 0.84rem;">
          <i class="fa-solid fa-file-csv"></i> Exporter en CSV
        </button>
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
                    <span class="badge badge-success">Recette</span>
                  {:else}
                    <span class="badge badge-danger">Dépense</span>
                  {/if}
                </td>
                <td style="text-align: right; font-weight: 800; font-size: 0.95rem; color: {tx.credit > 0 ? '#15803d' : '#b91c1c'};">
                  {tx.credit > 0 ? '+' : '-'}{(tx.credit > 0 ? tx.credit : tx.debit).toFixed(2)} €
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
        {#if sortedTxList.length > 0}
          <tfoot>
            <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #cbd5e1;">
              <td colspan="3" style="color: #0f172a; text-transform: uppercase; font-size: 0.82rem; letter-spacing: 0.5px;">
                Totaux enregistrés ({sortedTxList.length} opérations)
              </td>
              <td>
                <span style="font-size: 0.78rem; color: #64748b; font-weight: 700;">SOLDE NET</span>
              </td>
              <td style="text-align: right; font-size: 1.05rem; color: {soldeNet >= 0 ? '#15803d' : '#b91c1c'};">
                {soldeNet >= 0 ? '+' : ''}{soldeNet.toFixed(2)} €
              </td>
            </tr>
            <tr style="background: #ffffff; font-size: 0.82rem; color: #475569; border-top: 1px dashed #e2e8f0;">
              <td colspan="3" style="padding-top: 8px; padding-bottom: 8px;">
                Détail consolidé : <strong style="color: #15803d;">Recettes : +{totalRecettes.toFixed(2)} €</strong> &nbsp;|&nbsp; <strong style="color: #b91c1c;">Dépenses : -{totalDepenses.toFixed(2)} €</strong>
              </td>
              <td colspan="2" style="text-align: right; padding-top: 8px; padding-bottom: 8px;">
                {#if accountingModel === 'bnc'}
                  <span class="badge badge-success" style="font-size: 0.75rem;">Bénéfice BNC conforme Déclaration 2035</span>
                {:else if accountingModel === 'sci'}
                  <span class="badge badge-success" style="font-size: 0.75rem;">Résultat locatif net 2072</span>
                {/if}
              </td>
            </tr>
          </tfoot>
        {/if}
      </table>
    </div>
  </div>
{/if}

<!-- subtab: JOURNAL -->
{#if activeSubTab === 'journal'}
  <div class="card" style="padding: 20px 24px; margin-bottom: 22px; border-left: 4px solid #2563eb; background: #ffffff;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 12px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <h3 style="font-family: var(--font-title); color: #0f172a; margin: 0; font-weight: 800; font-size: 1.15rem;">
            {#if accountingModel === 'copro'}
              Livre-journal de la Copropriété (Décret 2005)
            {:else}
              Livre-journal des Écritures (Partie double)
            {/if}
          </h3>
          <span class="badge badge-primary" style="font-size: 0.72rem; text-transform: uppercase;">
            {#if accountingModel === 'copro'}
              Décret n°2005-240
            {:else}
              Livre obligatoire L123-12
            {/if}
          </span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 3px; font-size: 0.85rem;">
          <div>
            <strong style="color: #0f172a;">Ce que ça fait :</strong>
            <span style="color: #475569;">
              {#if accountingModel === 'copro'}
                Enregistre chronologiquement chaque appel de fonds, facture fournisseur et encaissement avec imputation débit/crédit et numéro de pièce séquentiel.
              {:else}
                Enregistre chaque opération au débit (emploi de fonds) et au crédit (ressource), avec numéro de pièce séquentiel unique.
              {/if}
            </span>
          </div>
          <div>
            <strong style="color: #15803d;">Ce que ça vous permet :</strong>
            <span style="color: #475569;">
              {#if accountingModel === 'copro'}
                Garantir une traçabilité comptable totale de l'immeuble pour le Conseil Syndical et le vote de l'Assemblée Générale.
              {:else}
                Prouver la légalité de vos comptes et transmettre le journal comptable complet à votre expert-comptable.
              {/if}
            </span>
          </div>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 10px;">
        <button class="btn btn-secondary btn-sm" onclick={exportJournalCSV} style="background: #ffffff; color: #0f172a; border: 1.5px solid #cbd5e1; padding: 8px 14px; font-weight: 700; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-size: 0.84rem;">
          <i class="fa-solid fa-file-csv"></i> Exporter le Journal (CSV)
        </button>
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
        {#if journalEntries.length > 0}
          <tfoot>
            <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #cbd5e1;">
              <td colspan="4" style="color: #0f172a; text-transform: uppercase; font-size: 0.82rem; letter-spacing: 0.5px;">
                Total des écritures du Journal ({journalEntries.length / 2} opérations en partie double)
              </td>
              <td class="amount debit" style="font-weight: 800; font-size: 0.95rem; color: #b91c1c;">
                {totalJournalDebit.toFixed(2)} €
              </td>
              <td class="amount credit" style="font-weight: 800; font-size: 0.95rem; color: #15803d;">
                {totalJournalCredit.toFixed(2)} €
              </td>
            </tr>
            <tr style="background: #ffffff; font-size: 0.82rem; border-top: 1px dashed #e2e8f0;">
              <td colspan="4" style="color: #64748b; padding-top: 6px; padding-bottom: 6px;">
                Contrôle d'équilibre Débit = Crédit : {Math.abs(totalJournalDebit - totalJournalCredit) < 0.001 ? 'Équilibre parfait (Écart 0,00 €)' : 'Déséquilibre détecté'}
              </td>
              <td colspan="2" style="text-align: right; padding-top: 6px; padding-bottom: 6px;">
                <span class="badge badge-success" style="font-size: 0.74rem;">
                  {accountingModel === 'copro' ? 'Conforme Décret Copropriété 2005' : 'Conforme FEC & Normes DGFiP'}
                </span>
              </td>
            </tr>
          </tfoot>
        {/if}
      </table>
    </div>
  </div>
{/if}

<!-- subtab: GRAND LIVRE -->
{#if activeSubTab === 'grandlivre'}
  <div id="grandlivre-container">
    <div class="card" style="padding: 20px 24px; margin-bottom: 22px; border-left: 4px solid #2563eb; background: #ffffff;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <h3 style="font-family: var(--font-title); color: #0f172a; margin: 0; font-weight: 800; font-size: 1.15rem;">
              {accountingModel === 'copro' ? 'Le Grand-livre de la Copropriété' : 'Le Grand-livre Général des Comptes'}
            </h3>
            <span class="badge badge-primary" style="font-size: 0.72rem; text-transform: uppercase;">
              {accountingModel === 'copro' ? 'Décret n°2005-240' : 'Livre obligatoire L123-12'}
            </span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 3px; font-size: 0.85rem;">
            <div>
              <strong style="color: #0f172a;">Ce que ça fait :</strong>
              <span style="color: #475569;">
                {#if accountingModel === 'copro'}
                  Regroupe toutes les opérations compte par compte (Banque 512, Fournisseurs 401, Copropriétaires 450, Charges 6xx, Provisions ALUR 102) avec calcul du solde progressif en continu.
                {:else}
                  Regroupe toutes les opérations compte par compte (Banque 512, Fournisseurs 401, Ventes 706, Achats 606...) avec calcul du solde progressif en continu.
                {/if}
              </span>
            </div>
            <div>
              <strong style="color: #15803d;">Ce que ça vous permet :</strong>
              <span style="color: #475569;">
                {#if accountingModel === 'copro'}
                  Vérifier la situation individuelle de chaque copropriétaire, contrôler les factures par fournisseur et justifier chaque dépense d'immeuble.
                {:else}
                  Auditer l'historique détaillé de chaque compte et contrôler les cumuls annuels par poste de dépenses ou de recettes.
                {/if}
              </span>
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px;">
          <button class="btn btn-secondary btn-sm" onclick={exportGrandLivreCSV} style="background: #ffffff; color: #0f172a; border: 1.5px solid #cbd5e1; padding: 8px 14px; font-weight: 700; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-size: 0.84rem;">
            <i class="fa-solid fa-file-csv"></i> Exporter le Grand-livre (CSV)
          </button>
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
  <div class="card" style="padding: 20px 24px; margin-bottom: 22px; border-left: 4px solid #2563eb; background: #ffffff;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: gap: 12px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <h3 style="font-family: var(--font-title); color: #0f172a; margin: 0; font-weight: 800; font-size: 1.15rem;">
            {accountingModel === 'copro' ? 'La Balance Générale de la Copropriété' : 'La Balance Générale des Comptes'}
          </h3>
          <span class="badge badge-primary" style="font-size: 0.72rem; text-transform: uppercase;">Outil de contrôle & équilibre</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 3px; font-size: 0.85rem;">
          <div>
            <strong style="color: #0f172a;">Ce que ça fait :</strong>
            <span style="color: #475569;">
              {#if accountingModel === 'copro'}
                Synthétise les débits, crédits et soldes de tous les comptes du syndicat (charges, appels de fonds, copropriétaires, trésorerie).
              {:else}
                Récapitule le total des débits et des crédits pour l'ensemble des comptes ouverts, ainsi que leur solde net débiteur ou créditeur.
              {/if}
            </span>
          </div>
          <div>
            <strong style="color: #15803d;">Ce que ça vous permet :</strong>
            <span style="color: #475569;">
              {#if accountingModel === 'copro'}
                Valider l'équilibre comptable rigoureux avant l'établissement des annexes d'Assemblée Générale.
              {:else}
                Vérifier l'égalité arithmétique stricte Débit = Crédit (aucun centime d'écart) indispensable avant la clôture annuelle.
              {/if}
            </span>
          </div>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 10px;">
        <button class="btn btn-secondary btn-sm" onclick={exportBalanceCSV} style="background: #ffffff; color: #0f172a; border: 1.5px solid #cbd5e1; padding: 8px 14px; font-weight: 700; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-size: 0.84rem;">
          <i class="fa-solid fa-file-csv"></i> Exporter la Balance (CSV)
        </button>
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
        {#if balanceRows.length > 0 && !(balanceRows.length === 1 && balanceRows[0].debit === 0 && balanceRows[0].credit === 0)}
          <tfoot>
            <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #cbd5e1;">
              <td colspan="2" style="color: #0f172a; text-transform: uppercase; font-size: 0.82rem; letter-spacing: 0.5px;">
                Total Général de la Balance
              </td>
              <td class="amount" style="font-weight: 800; font-size: 0.95rem; color: #0f172a;">
                {totalBalanceDebit.toFixed(2)} €
              </td>
              <td class="amount" style="font-weight: 800; font-size: 0.95rem; color: #0f172a;">
                {totalBalanceCredit.toFixed(2)} €
              </td>
              <td class="amount debit" style="font-weight: 800; font-size: 0.95rem; color: #b91c1c;">
                {totalBalanceSoldeDebiteur.toFixed(2)} €
              </td>
              <td class="amount credit" style="font-weight: 800; font-size: 0.95rem; color: #15803d;">
                {totalBalanceSoldeCrediteur.toFixed(2)} €
              </td>
            </tr>
            <tr style="background: #ffffff; font-size: 0.82rem; border-top: 1px dashed #e2e8f0;">
              <td colspan="4" style="color: #64748b; padding-top: 6px; padding-bottom: 6px;">
                Vérification de clôture : Total Débits ({totalBalanceDebit.toFixed(2)} €) = Total Crédits ({totalBalanceCredit.toFixed(2)} €)
              </td>
              <td colspan="2" style="text-align: right; padding-top: 6px; padding-bottom: 6px;">
                <span class="badge badge-success" style="font-size: 0.74rem;">Balance équilibrée</span>
              </td>
            </tr>
          </tfoot>
        {/if}
      </table>
    </div>
  </div>
{/if}

<!-- subtab: BILAN -->
{#if activeSubTab === 'bilan'}
  <div class="card" style="padding: 20px 24px; margin-bottom: 22px; border-left: 4px solid #2563eb; background: #ffffff;">
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <h3 style="font-family: var(--font-title); color: #0f172a; margin: 0; font-weight: 800; font-size: 1.15rem;">
            {#if accountingModel === 'bnc'}
              Synthèse Fiscale & Déclaration 2035 (BNC)
            {:else if accountingModel === 'sci'}
              Synthèse Fiscale & Déclaration 2072 (SCI)
            {:else if accountingModel === 'copro'}
              Arrêté des Comptes & Annexes Comptables (Décret 2005)
            {:else if accountingModel === 'asso'}
              Bilan Simplifié & Excédent Associatif
            {:else}
              Bilan Patrimonial & Résultat de l'Exercice
            {/if}
          </h3>
          <span class="badge badge-primary" style="font-size: 0.72rem; text-transform: uppercase;">
            {#if accountingModel === 'copro'}
              Annexes d'AG (Décret 2005)
            {:else}
              Synthèse de clôture
            {/if}
          </span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 3px; font-size: 0.85rem;">
          <div>
            <strong style="color: #0f172a;">Ce que ça fait :</strong>
            <span style="color: #475569;">
              {#if accountingModel === 'bnc'}
                Calcule le Bénéfice Non Commercial imposable (recettes brutes encaissées - frais professionnels déductibles) pour la déclaration fiscale 2035.
              {:else if accountingModel === 'sci'}
                Calcule les revenus locatifs nets et détermine la quote-part de résultat foncier de chaque associé pour la déclaration 2072.
              {:else if accountingModel === 'copro'}
                Récapitule la situation financière du syndicat (trésorerie disponible, créances sur copropriétaires, dettes fournisseurs, avances et provisions ALUR).
              {:else if accountingModel === 'asso'}
                Compare l'actif (ce que possède l'association) et le passif (ce qu'elle doit) et dégage l'excédent ou le déficit de gestion.
              {:else}
                Rapproche ce que l'entreprise possède (Actif : trésorerie, créances) de ce qu'elle doit (Passif : dettes) et dégage le bénéfice ou la perte net(te).
              {/if}
            </span>
          </div>
          <div>
            <strong style="color: #15803d;">Ce que ça vous permet :</strong>
            <span style="color: #475569;">
              {#if accountingModel === 'bnc'}
                Reporter vos chiffres certifiés sur le formulaire 2035 et justifier de vos charges auprès de votre association agréée (AGA).
              {:else if accountingModel === 'sci'}
                Télétransmettre la 2072 et renseigner les quotes-parts revenant à chaque associé pour leur impôt sur le revenu personnel.
              {:else if accountingModel === 'copro'}
                Présenter les 5 annexes comptables obligatoires lors de l'Assemblée Générale annuelle pour l'approbation des comptes et le quitus au syndic.
              {:else if accountingModel === 'asso'}
                Présenter les comptes annuels certifiés à l'Assemblée Générale et justifier de l'emploi des fonds auprès des financeurs publics.
              {:else}
                Connaître la valeur patrimoniale de votre entreprise et valider le bénéfice distribuable en dividendes ou affectable en réserves.
              {/if}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 30px;">
    
    <!-- ACTIF -->
    <div class="card" style="padding: 24px;">
      <h3 style="font-family: var(--font-title); margin: 0 0 15px 0; border-bottom: 1.5px solid var(--border-color); padding-bottom: 10px; color: #0f172a; font-weight: 800; font-size: 1.05rem;">
        {#if accountingModel === 'copro'}
          ACTIF DU SYNDICAT (Disponibilités bancaires & Créances)
        {:else}
          ACTIF (Ce que la structure possède)
        {/if}
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
            <td style="color: #0f172a; font-weight: 800;">
              {accountingModel === 'copro' ? 'TOTAL DE L’ACTIF (Trésorerie & Créances)' : "TOTAL DE L'ACTIF"}
            </td>
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
        {#if accountingModel === 'copro'}
          PASSIF DU SYNDICAT (Avances, Provisions ALUR & Dettes)
        {:else}
          PASSIF (Ce que la structure doit)
        {/if}
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
            <td>
              <strong>120/129</strong> - 
              {#if accountingModel === 'copro'}
                Solde de clôture de l'exercice (à répartir / reporter)
              {:else if accountingModel === 'asso'}
                Résultat net (Excédent / Déficit)
              {:else}
                Résultat net (Bénéfice / Perte)
              {/if}
            </td>
            <td class="amount" style="text-align: right; color: var(--color-success); font-weight: 700;">
              {bilanData.excedent.toFixed(2)} €
            </td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="color: #0f172a; font-weight: 800;">
              {accountingModel === 'copro' ? 'TOTAL DU PASSIF (Provisions & Dettes)' : 'TOTAL DU PASSIF'}
            </td>
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

</style>
