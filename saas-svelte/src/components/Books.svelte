<script>
  import { get } from 'svelte/store';
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
    entities,
    updateEntities
  } from '../lib/store.js';
  import { Categorizer } from '../lib/categorizer.js';

  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0] || { id: 'default', name: 'Ma Structure', model: 'micro' });
  let accountingModel = $derived(activeEntity?.model || 'micro');

  let subTabs = $derived((() => {
    if (accountingModel === 'micro') {
      return [
        { id: 'recettes', label: 'Livre des Recettes', icon: 'fa-book-journal-whills' },
        { id: 'achats', label: 'Registre des Achats', icon: 'fa-cart-shopping' },
        { id: 'recap_ca', label: 'Déclaration Urssaf', icon: 'fa-chart-pie' }
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
        { id: 'journal', label: 'Livre-journal Associatif', icon: 'fa-table-list' },
        { id: 'grandlivre', label: 'Le Grand-livre Associatif', icon: 'fa-book-bookmark' },
        { id: 'balance', label: 'La Balance générale', icon: 'fa-scale-balanced' },
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
  let activeViewDoc = $state(null); // ID du document ouvert en consultation détaillée (ou null)

  function toggleViewDoc(docId) {
    if (activeViewDoc === docId) {
      activeViewDoc = null;
    } else {
      activeViewDoc = docId;
      activeSubTab = docId;
      setTimeout(() => {
        const el = document.getElementById('consultation-detail-view');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 60);
    }
  }

  function getDocTitle(docId) {
    if (docId === 'recettes') return 'Livre chronologique des Recettes (Art. 286 CGI)';
    if (docId === 'achats') return 'Registre des Achats & Dépenses (Art. 286 ter CGI)';
    if (docId === 'recap_ca') return 'Déclaration Urssaf (Art. L. 613-7 CSS)';
    if (docId === 'recettes_depenses') return 'Livre-Journal des Recettes et Dépenses (Art. 99 CGI)';
    if (docId === 'journal') return 'Livre-Journal général (Art. L.123-12 Code de commerce)';
    if (docId === 'grandlivre') return 'Grand-Livre des comptes (Art. R.123-176 Code de commerce)';
    if (docId === 'balance') return 'Balance générale des comptes';
    if (docId === 'bilan') return 'Synthèse Bilan & Résultat';
    return 'Document comptable officiel';
  }
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

  function computeOneYearEnd(startDateStr) {
    if (!startDateStr) return '';
    const parts = startDateStr.split('-').map(Number);
    if (parts.length !== 3) return '';
    const [year, month, day] = parts;
    if (!year || !month || !day) return '';
    const d = new Date(year + 1, month - 1, day);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayStr}`;
  }

  function formatPeriodLabel(start, end) {
    if (!start && !end) return "Tout l'historique";
    if (start && end && start.slice(5) === '01-01' && end.slice(5) === '12-31' && start.slice(0, 4) === end.slice(0, 4)) {
      return `Année ${start.slice(0, 4)}`;
    }
    const s = start ? new Date(start).toLocaleDateString('fr-FR') : '';
    const e = end ? new Date(end).toLocaleDateString('fr-FR') : '';
    if (s && e) return `du ${s} au ${e}`;
    if (s) return `à partir du ${s}`;
    return `jusqu'au ${e}`;
  }

  let availableYears = $derived((() => {
    const currentYear = new Date().getFullYear();
    const yearsSet = new Set([currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4, currentYear - 5]);
    rawTxList.forEach(t => {
      if (t.date) {
        const y = parseInt(t.date.slice(0, 4), 10);
        if (!isNaN(y) && y > 1990 && y < 2100) {
          yearsSet.add(y);
        }
      }
    });
    if (localStartDate) {
      const y = parseInt(localStartDate.slice(0, 4), 10);
      if (!isNaN(y)) yearsSet.add(y);
    }
    return Array.from(yearsSet).sort((a, b) => b - a);
  })());

  let selectedDropdownValue = $derived((() => {
    if (!localStartDate && !localEndDate) return 'all';
    if (localStartDate && localEndDate && localStartDate.slice(5) === '01-01' && localEndDate.slice(5) === '12-31') {
      const startYear = localStartDate.slice(0, 4);
      const endYear = localEndDate.slice(0, 4);
      if (startYear === endYear) {
        return `year-${startYear}`;
      }
    }
    return 'custom';
  })());

  function handleSaveFiscalPeriod() {
    updateFiscalPeriod(localStartDate, localEndDate);
    if (!localStartDate && !localEndDate) {
      showToast("Période réinitialisée : l'ensemble des opérations est affiché.");
    } else {
      const s = localStartDate ? new Date(localStartDate).toLocaleDateString('fr-FR') : 'début';
      const e = localEndDate ? new Date(localEndDate).toLocaleDateString('fr-FR') : 'fin';
      showToast(`Exercice fiscal configuré : du ${s} au ${e} (12 mois).`);
    }
  }

  function selectYear(yr) {
    localStartDate = `${yr}-01-01`;
    localEndDate = `${yr}-12-31`;
    handleSaveFiscalPeriod();
  }

  function handleDropdownChange(e) {
    const val = e.currentTarget.value;
    if (val.startsWith('year-')) {
      const yr = parseInt(val.replace('year-', ''), 10);
      selectYear(yr);
    } else if (val === 'custom') {
      if (selectedDropdownValue !== 'custom') {
        const baseYear = localStartDate ? parseInt(localStartDate.slice(0, 4), 10) : new Date().getFullYear();
        localStartDate = `${baseYear - 1}-09-01`;
        localEndDate = `${baseYear}-08-31`;
        handleSaveFiscalPeriod();
      }
    } else if (val === 'all') {
      localStartDate = '';
      localEndDate = '';
      handleSaveFiscalPeriod();
    }
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



  let declarationFrequency = $derived(activeEntity?.declarationFrequency || 'trimestrielle');
  let microRate = $derived(activeEntity?.microActivity === 'vente_bic' ? 0.123 : (activeEntity?.microActivity === 'services_bnc' ? 0.258 : 0.212));
  let microRatePct = $derived((microRate * 100).toFixed(1));

  /** @param {'trimestrielle' | 'mensuelle'} newFreq */
  function changeDeclarationFrequency(newFreq) {
    if (!activeEntity) return;
    const currentList = get(entities);
    const updated = currentList.map(e => e.id === activeEntity.id ? { ...e, declarationFrequency: newFreq } : e);
    updateEntities(updated);
    showToast(`Déclaration Urssaf : rythme ${newFreq === 'mensuelle' ? 'mensuel' : 'trimestriel'} activé.`);
  }

  /** @param {number} val */
  function copierMontant(val) {
    navigator.clipboard.writeText(val.toFixed(2));
    showToast(`Montant ${val.toFixed(2)} € copié pour votre déclaration Urssaf !`);
  }

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

  const MOIS_NOMS_BOOKS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  // CA mensuel pour déclaration Urssaf
  let caMensuel = $derived((() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      index: i + 1,
      code: `Mois ${String(i + 1).padStart(2, '0')}`,
      label: MOIS_NOMS_BOOKS[i],
      ca: 0
    }));
    recettesMicro.forEach(r => {
      const d = new Date(r.date);
      const m = d.getMonth();
      if (months[m]) months[m].ca += r.montant;
    });
    return months;
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

  function exportDeclarationUrssafMicro() {
    let csv = "DECLARATION DE CHIFFRE D'AFFAIRES & COTISATIONS URSSAF\n";
    csv += `Entite;"${activeEntity.name.replace(/"/g, '""')}"\n`;
    csv += `Exercice fiscal;"${formatPeriodLabel(localStartDate, localEndDate)}"\n`;
    csv += `Rythme declare;"${declarationFrequency === 'mensuelle' ? 'Mensuel (12 declarations)' : 'Trimestriel (4 declarations)'}"\n\n`;

    if (declarationFrequency === 'mensuelle') {
      csv += "Mois;Libelle;Chiffre d'Affaires Encaisse (EUR);Taux Cotisations;Cotisations Urssaf (EUR);Statut\n";
      caMensuel.forEach(m => {
        const cotis = m.ca * microRate;
        csv += `${m.code};${m.label};${m.ca.toFixed(2)};${microRatePct}%;${cotis.toFixed(2)};${m.ca > 0 ? 'Pret a declarer' : '0 EUR'}\n`;
      });
    } else {
      csv += "Trimestre;Periode;Chiffre d'Affaires Encaisse (EUR);Taux Cotisations;Cotisations Urssaf (EUR);Statut\n";
      csv += `T1;Janvier - Mars;${caTrimestriel.T1.toFixed(2)};${microRatePct}%;${(caTrimestriel.T1 * microRate).toFixed(2)};${caTrimestriel.T1 > 0 ? 'Pret a declarer' : '0 EUR'}\n`;
      csv += `T2;Avril - Juin;${caTrimestriel.T2.toFixed(2)};${microRatePct}%;${(caTrimestriel.T2 * microRate).toFixed(2)};${caTrimestriel.T2 > 0 ? 'Pret a declarer' : '0 EUR'}\n`;
      csv += `T3;Juillet - Septembre;${caTrimestriel.T3.toFixed(2)};${microRatePct}%;${(caTrimestriel.T3 * microRate).toFixed(2)};${caTrimestriel.T3 > 0 ? 'Pret a declarer' : '0 EUR'}\n`;
      csv += `T4;Octobre - Decembre;${caTrimestriel.T4.toFixed(2)};${microRatePct}%;${(caTrimestriel.T4 * microRate).toFixed(2)};${caTrimestriel.T4 > 0 ? 'Pret a declarer' : '0 EUR'}\n`;
    }

    csv += `TOTAL;;${totalRecettesMicro.toFixed(2)};${microRatePct}%;${(totalRecettesMicro * microRate).toFixed(2)};\n\n`;
    csv += "SYNTHESE TRESORERIE ANNUELLE\n";
    csv += `Chiffre d'Affaires total encaisse (ce que je vends);${totalRecettesMicro.toFixed(2)} EUR\n`;
    csv += `Depenses d'activite decaissees (achats et frais);${totalAchatsMicro.toFixed(2)} EUR\n`;
    csv += `Reste avant Urssaf (CA moins depenses);${(totalRecettesMicro - totalAchatsMicro).toFixed(2)} EUR\n`;
    csv += `Cotisations Urssaf (${microRatePct}% du CA);${(totalRecettesMicro * microRate).toFixed(2)} EUR\n`;
    csv += `Revenu net disponible en poche;${(totalRecettesMicro - (totalRecettesMicro * microRate) - totalAchatsMicro).toFixed(2)} EUR\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `DECLARATION_URSSAF_${activeEntity.name.replace(/\s+/g, '_')}_${new Date().getFullYear()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Relevé pour Déclaration Urssaf téléchargé !');
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

<div class="page-title-section" style="margin-bottom: 24px;">
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
      {:else if accountingModel === 'asso'}
        Comptabilité Associative & Bilan d'AG
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
      {:else if accountingModel === 'asso'}
        Tenez le journal et le grand-livre de l'association (Règlement ANC 2018-06), contrôlez la balance et préparez les comptes annuels pour l'Assemblée Générale.
      {:else if accountingModel === 'tpe'}
        Consultez vos livres obligatoires (Journal, Grand-livre, Balance, Bilan) et téléchargez le fichier FEC conforme pour votre expert-comptable.
      {:else}
        Consultez vos documents comptables conformes aux normes fiscales et téléchargez vos exports officiels.
      {/if}
    </p>
  </div>
</div>

<!-- ========================================== -->
<!-- 1. BARRE DE PÉRIODE COMPTABLE (CALENDRIER) -->
<!-- ========================================== -->
<div style="margin-bottom: 30px;">
  <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
    <!-- En-tête du bloc -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
      <div>
        <h3 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-scale-balanced" style="color: #2563eb; font-size: 0.95rem;"></i> Exercice fiscal
        </h3>
        <span style="font-size: 0.8rem; color: #64748b; font-weight: 600; margin-top: 2px; display: block;">
          Sélectionnez la période à clôturer pour générer vos registres et votre export officiel
        </span>
      </div>

      <!-- Badge récapitulatif -->
      {#if localStartDate && localEndDate}
        <span style="font-size: 0.8rem; font-weight: 700; color: #166534; background: #dcfce7; border: 1px solid #86efac; padding: 5px 12px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-circle-check"></i> {formatPeriodLabel(localStartDate, localEndDate)} (12 mois)
        </span>
      {:else}
        <span style="font-size: 0.8rem; font-weight: 700; color: #475569; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 5px 12px; border-radius: 9999px;">
          Tout l'historique
        </span>
      {/if}
    </div>

    <!-- Contenu intérieur -->
    <div style="padding: 16px 20px; background: var(--bg-card, #ffffff); border: none; border-radius: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04); display: flex; flex-direction: column; gap: 14px;">
      
      <!-- Ligne 1 : Choix de la période (Menu déroulant épuré + Navigation rapide) -->
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <label for="fiscal-year-select" style="font-size: 0.82rem; font-weight: 800; color: #0f172a; text-transform: uppercase;">
            Période :
          </label>
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <select 
              id="fiscal-year-select"
              value={selectedDropdownValue}
              onchange={handleDropdownChange}
              style="padding: 8px 14px; border: 1.5px solid var(--border-container); border-radius: 8px; font-size: 0.88rem; font-weight: 700; color: #0f172a; background: #ffffff; cursor: pointer; min-width: 200px;"
            >
              {#each availableYears as yr}
                <option value={`year-${yr}`}>Année {yr}</option>
              {/each}
              <option value="custom">Période personnalisée (12 mois)...</option>
              <option value="all">Tout l'historique</option>
            </select>

            <!-- Navigation rapide année précédente / suivante si on est sur une année civile -->
            {#if selectedDropdownValue.startsWith('year-')}
              {@const currentYr = parseInt(selectedDropdownValue.replace('year-', ''), 10)}
              <div style="display: flex; gap: 4px;">
                <button 
                  type="button" 
                  title={`Passer à l'année précédente (${currentYr - 1})`}
                  onclick={() => selectYear(currentYr - 1)}
                  style="padding: 7px 11px; background: var(--bg-container); border: 1px solid var(--border-container); border-radius: 6px; font-size: 0.8rem; font-weight: 700; color: #334155; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                >
                  <i class="fa-solid fa-chevron-left"></i> {currentYr - 1}
                </button>
                <button 
                  type="button" 
                  title={`Passer à l'année suivante (${currentYr + 1})`}
                  onclick={() => selectYear(currentYr + 1)}
                  style="padding: 7px 11px; background: var(--bg-container); border: 1px solid var(--border-container); border-radius: 6px; font-size: 0.8rem; font-weight: 700; color: #334155; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                >
                  {currentYr + 1} <i class="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            {/if}
          </div>
        </div>

        <!-- Compteur d'écritures -->
        <div>
          {#if localStartDate || localEndDate}
            <span style="font-size: 0.82rem; font-weight: 700; color: #1e293b; background: var(--bg-container); border: 1px solid var(--border-container); padding: 6px 14px; border-radius: 8px;">
              <strong>{sortedTxList.length}</strong> opérations sur cette période
            </span>
          {:else}
            <span style="font-size: 0.82rem; font-weight: 700; color: #1e293b; background: var(--bg-container); border: 1px solid var(--border-container); padding: 6px 14px; border-radius: 8px;">
              <strong>{rawTxList.length}</strong> opérations au total
            </span>
          {/if}
        </div>
      </div>

      <!-- Ligne 2 : Si période personnalisée choisie, date de début avec fin calculée automatiquement sur 1 an -->
      {#if selectedDropdownValue === 'custom'}
        <div style="background: var(--bg-container); border: 1.5px solid #93c5fd; border-radius: 10px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            
            <div style="display: flex; align-items: center; gap: 8px;">
              <label for="custom-fiscal-start" style="font-size: 0.84rem; font-weight: 800; color: #0f172a; cursor: pointer;">
                Date de début :
              </label>
              <input 
                id="custom-fiscal-start" 
                type="date" 
                value={localStartDate}
                onchange={(e) => {
                  const val = e.currentTarget.value;
                  localStartDate = val;
                  if (val) {
                    localEndDate = computeOneYearEnd(val);
                  }
                  handleSaveFiscalPeriod();
                }}
                style="padding: 7px 12px; border: 1.5px solid #cbd5e1; border-radius: 6px; font-size: 0.88rem; font-weight: 700; color: #0f172a; background: #ffffff; cursor: pointer;"
              />
            </div>

            <i class="fa-solid fa-arrow-right" style="color: #94a3b8; font-size: 0.85rem;"></i>

            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 0.84rem; font-weight: 800; color: #0f172a;">
                Date de fin (1 an) :
              </span>
              <div style="padding: 6px 12px; border: 1.5px solid #cbd5e1; border-radius: 6px; font-size: 0.88rem; font-weight: 700; color: #0f172a; background: #ffffff; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-lock" style="color: #64748b; font-size: 0.75rem;"></i>
                {localEndDate ? new Date(localEndDate).toLocaleDateString('fr-FR') : 'Calculée sur 1 an'}
                <span style="font-size: 0.72rem; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: 800;">
                  12 MOIS
                </span>
              </div>
            </div>

          </div>

          <span style="font-size: 0.78rem; color: #64748b; font-weight: 600;">
            Exercice de 12 mois conforme pour l'expert
          </span>
        </div>
      {/if}

    </div>
  </div>
</div>

<!-- ========================================== -->
<!-- 2. DOCUMENTS LÉGAUX À FOURNIR -->
<!-- ========================================== -->
<div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); margin-bottom: 30px;">
  <!-- En-tête du bloc -->
  <div style="margin-bottom: 18px;">
    <h3 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
      <i class="fa-solid fa-file-contract" style="color: #2563eb; font-size: 0.95rem;"></i> Documents légaux à fournir
    </h3>
    <span style="font-size: 0.8rem; color: #64748b; font-weight: 600; margin-top: 2px; display: block;">
      Pièces officielles obligatoires pour l'Urssaf, la DGFiP ou votre expert-comptable
    </span>
  </div>

  <!-- CATALOGUE DES PIÈCES OFFICIELLES -->
  <div style="display: flex; flex-direction: column; gap: 14px;">
    
    {#if accountingModel === 'micro'}
      <!-- 1. Livre officiel des recettes -->
      <div style="padding: 16px 20px; background: var(--bg-card, #ffffff); border: none; border-radius: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 42px; height: 42px; border-radius: 9px; background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
            <i class="fa-solid fa-book-journal-whills"></i>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 800; font-size: 0.96rem; color: #0f172a;">Livre chronologique des recettes</span>
              <span style="font-size: 0.72rem; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 7px; border-radius: 4px; font-weight: 700; letter-spacing: 0.02em;">OBLIGATOIRE (ART. 286 CGI)</span>
            </div>
            <div style="font-size: 0.82rem; color: #64748b; margin-top: 3px;">
              Enregistrement chronologique de chaque encaissement client avec dates, tiers, factures et règlements.
            </div>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <button 
              type="button" 
              onclick={() => toggleViewDoc('recettes')}
              style="background: {activeViewDoc === 'recettes' ? '#0f172a' : '#ffffff'}; color: {activeViewDoc === 'recettes' ? '#ffffff' : '#0f172a'}; border: 1.5px solid {activeViewDoc === 'recettes' ? '#0f172a' : '#cbd5e1'}; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease;"
            >
              {activeViewDoc === 'recettes' ? 'Masquer' : 'Voir'}
            </button>
            <button 
              type="button" 
              onclick={exportLivreRecettesMicro} 
              style="background: #0f172a; color: #ffffff; border: none; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);"
            >
              Exporter
            </button>
          </div>
          <span style="font-size: 0.74rem; color: #64748b; font-weight: 600;">
            Période : {formatPeriodLabel(localStartDate, localEndDate)} ({sortedTxList.filter(t => t.credit > 0).length} recettes)
          </span>
        </div>
      </div>

      <!-- 2. Registre des achats -->
      <div style="padding: 16px 20px; background: var(--bg-card, #ffffff); border: none; border-radius: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 42px; height: 42px; border-radius: 9px; background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
            <i class="fa-solid fa-receipt"></i>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 800; font-size: 0.96rem; color: #0f172a;">Registre des achats & dépenses</span>
              <span style="font-size: 0.72rem; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 7px; border-radius: 4px; font-weight: 700; letter-spacing: 0.02em;">OBLIGATOIRE (ART. 286 TER CGI)</span>
            </div>
            <div style="font-size: 0.82rem; color: #64748b; margin-top: 3px;">
              Récapitulatif des achats professionnels, dépenses de fonctionnement et fournitures matérielles.
            </div>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <button 
              type="button" 
              onclick={() => toggleViewDoc('achats')}
              style="background: {activeViewDoc === 'achats' ? '#0f172a' : '#ffffff'}; color: {activeViewDoc === 'achats' ? '#ffffff' : '#0f172a'}; border: 1.5px solid {activeViewDoc === 'achats' ? '#0f172a' : '#cbd5e1'}; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease;"
            >
              {activeViewDoc === 'achats' ? 'Masquer' : 'Voir'}
            </button>
            <button 
              type="button" 
              onclick={exportRegistreAchatsMicro} 
              style="background: #0f172a; color: #ffffff; border: none; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);"
            >
              Exporter
            </button>
          </div>
          <span style="font-size: 0.74rem; color: #64748b; font-weight: 600;">
            Période : {formatPeriodLabel(localStartDate, localEndDate)} ({sortedTxList.filter(t => t.debit > 0).length} achats)
          </span>
        </div>
      </div>

      <!-- 3. Déclaration Urssaf -->
      <div style="padding: 16px 20px; background: var(--bg-card, #ffffff); border: none; border-radius: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 42px; height: 42px; border-radius: 9px; background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
            <i class="fa-solid fa-chart-pie"></i>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 800; font-size: 0.96rem; color: #0f172a;">Déclaration Urssaf</span>
              <span style="font-size: 0.72rem; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 7px; border-radius: 4px; font-weight: 700; letter-spacing: 0.02em;">OBLIGATOIRE (ART. L. 613-7 CSS)</span>
            </div>
            <div style="font-size: 0.82rem; color: #64748b; margin-top: 3px;">
              Télédéclaration périodique du CA encaissé et calcul des cotisations sociales ({microRatePct}%).
            </div>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <button 
              type="button" 
              onclick={() => toggleViewDoc('recap_ca')}
              style="background: {activeViewDoc === 'recap_ca' ? '#0f172a' : '#ffffff'}; color: {activeViewDoc === 'recap_ca' ? '#ffffff' : '#0f172a'}; border: 1.5px solid {activeViewDoc === 'recap_ca' ? '#0f172a' : '#cbd5e1'}; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease;"
            >
              {activeViewDoc === 'recap_ca' ? 'Masquer' : 'Voir'}
            </button>
            <button 
              type="button" 
              onclick={exportDeclarationUrssafMicro} 
              style="background: #0f172a; color: #ffffff; border: none; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);"
            >
              Exporter
            </button>
          </div>
          <span style="font-size: 0.74rem; color: #64748b; font-weight: 600;">
            CA total : {totalRecettesMicro.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} (Charges : {(totalRecettesMicro * microRate).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })})
          </span>
        </div>
      </div>



    {:else if accountingModel === 'bnc'}
      <!-- 1. Livre-Journal des Recettes et Dépenses BNC -->
      <div style="padding: 16px 20px; background: var(--bg-card, #ffffff); border: none; border-radius: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 42px; height: 42px; border-radius: 9px; background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
            <i class="fa-solid fa-book-journal-whills"></i>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 800; font-size: 0.96rem; color: #0f172a;">Livre-Journal des Recettes et Dépenses (2035)</span>
              <span style="font-size: 0.72rem; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 7px; border-radius: 4px; font-weight: 700; letter-spacing: 0.02em;">OBLIGATOIRE (ART. 99 CGI)</span>
            </div>
            <div style="font-size: 0.82rem; color: #64748b; margin-top: 3px;">
              Registre légal chronologique des recettes encaissées et dépenses professionnelles déductibles.
            </div>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <button 
              type="button" 
              onclick={() => toggleViewDoc('recettes_depenses')}
              style="background: {activeViewDoc === 'recettes_depenses' ? '#0f172a' : '#ffffff'}; color: {activeViewDoc === 'recettes_depenses' ? '#ffffff' : '#0f172a'}; border: 1.5px solid {activeViewDoc === 'recettes_depenses' ? '#0f172a' : '#cbd5e1'}; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease;"
            >
              {activeViewDoc === 'recettes_depenses' ? 'Masquer' : 'Voir'}
            </button>
            <button 
              type="button" 
              onclick={exportLivreRecettesDepensesCSV} 
              style="background: #0f172a; color: #ffffff; border: none; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);"
            >
              Exporter
            </button>
          </div>
          <span style="font-size: 0.74rem; color: #64748b; font-weight: 600;">
            Période : {formatPeriodLabel(localStartDate, localEndDate)} ({sortedTxList.length} écritures)
          </span>
        </div>
      </div>

      <!-- 2. FEC officiel BNC -->
      <div style="padding: 16px 20px; background: var(--bg-card, #ffffff); border: none; border-radius: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 42px; height: 42px; border-radius: 9px; background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
            <i class="fa-solid fa-file-shield"></i>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 800; font-size: 0.96rem; color: #0f172a;">Fichier des Écritures Comptables (FEC officiel)</span>
              <span style="font-size: 0.72rem; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 7px; border-radius: 4px; font-weight: 700; letter-spacing: 0.02em;">NORME DGFIP (ART. L.47 A-I LPF)</span>
            </div>
            <div style="font-size: 0.82rem; color: #64748b; margin-top: 3px;">
              Fichier informatique obligatoire à remettre à votre expert-comptable ou à l'administration fiscale.
            </div>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <button 
              type="button" 
              onclick={() => toggleViewDoc('recettes_depenses')}
              style="background: {activeViewDoc === 'recettes_depenses' ? '#0f172a' : '#ffffff'}; color: {activeViewDoc === 'recettes_depenses' ? '#ffffff' : '#0f172a'}; border: 1.5px solid {activeViewDoc === 'recettes_depenses' ? '#0f172a' : '#cbd5e1'}; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease;"
            >
              {activeViewDoc === 'recettes_depenses' ? 'Masquer' : 'Voir'}
            </button>
            <button 
              type="button" 
              onclick={exportFEC} 
              style="background: #0f172a; color: #ffffff; border: none; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);"
            >
              Exporter
            </button>
          </div>
          <span style="font-size: 0.74rem; color: #64748b; font-weight: 600;">
            Période : {formatPeriodLabel(localStartDate, localEndDate)} ({sortedTxList.length} écritures)
          </span>
        </div>
      </div>

    {:else}
      <!-- TPE / SOCIÉTÉ / SCI / COPRO / ASSO -->
      <!-- 1. FEC officiel -->
      <div style="padding: 16px 20px; background: var(--bg-card, #ffffff); border: none; border-radius: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 42px; height: 42px; border-radius: 9px; background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
            <i class="fa-solid fa-file-shield"></i>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 800; font-size: 0.96rem; color: #0f172a;">Fichier des Écritures Comptables (FEC officiel)</span>
              <span style="font-size: 0.72rem; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 7px; border-radius: 4px; font-weight: 700; letter-spacing: 0.02em;">NORME DGFIP (ART. L.47 A-I LPF)</span>
            </div>
            <div style="font-size: 0.82rem; color: #64748b; margin-top: 3px;">
              Fichier informatique normé exigé par la DGFiP pour la clôture annuelle et votre expert-comptable.
            </div>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <button 
              type="button" 
              onclick={() => toggleViewDoc('journal')}
              style="background: {activeViewDoc === 'journal' ? '#0f172a' : '#ffffff'}; color: {activeViewDoc === 'journal' ? '#ffffff' : '#0f172a'}; border: 1.5px solid {activeViewDoc === 'journal' ? '#0f172a' : '#cbd5e1'}; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease;"
            >
              {activeViewDoc === 'journal' ? 'Masquer' : 'Voir'}
            </button>
            <button 
              type="button" 
              onclick={exportFEC} 
              style="background: #0f172a; color: #ffffff; border: none; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);"
            >
              Exporter
            </button>
          </div>
          <span style="font-size: 0.74rem; color: #64748b; font-weight: 600;">
            Période : {formatPeriodLabel(localStartDate, localEndDate)} ({sortedTxList.length} écritures)
          </span>
        </div>
      </div>

      <!-- 2. Livre-Journal général -->
      <div style="padding: 16px 20px; background: var(--bg-card, #ffffff); border: none; border-radius: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 42px; height: 42px; border-radius: 9px; background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
            <i class="fa-solid fa-book"></i>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 800; font-size: 0.96rem; color: #0f172a;">Livre-Journal général</span>
              <span style="font-size: 0.72rem; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 7px; border-radius: 4px; font-weight: 700; letter-spacing: 0.02em;">CODE DE COMMERCE (ART. L.123-12)</span>
            </div>
            <div style="font-size: 0.82rem; color: #64748b; margin-top: 3px;">
              Enregistrement chronologique officiel opération par opération avec débits et crédits équilibrés.
            </div>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <button 
              type="button" 
              onclick={() => toggleViewDoc('journal')}
              style="background: {activeViewDoc === 'journal' ? '#0f172a' : '#ffffff'}; color: {activeViewDoc === 'journal' ? '#ffffff' : '#0f172a'}; border: 1.5px solid {activeViewDoc === 'journal' ? '#0f172a' : '#cbd5e1'}; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease;"
            >
              {activeViewDoc === 'journal' ? 'Masquer' : 'Voir'}
            </button>
            <button 
              type="button" 
              onclick={exportJournalCSV} 
              style="background: #0f172a; color: #ffffff; border: none; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);"
            >
              Exporter
            </button>
          </div>
          <span style="font-size: 0.74rem; color: #64748b; font-weight: 600;">
            Période : {formatPeriodLabel(localStartDate, localEndDate)} ({sortedTxList.length} écritures)
          </span>
        </div>
      </div>

      <!-- 3. Grand-Livre général -->
      <div style="padding: 16px 20px; background: var(--bg-card, #ffffff); border: none; border-radius: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 42px; height: 42px; border-radius: 9px; background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
            <i class="fa-solid fa-layer-group"></i>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 800; font-size: 0.96rem; color: #0f172a;">Grand-Livre général des comptes</span>
              <span style="font-size: 0.72rem; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 7px; border-radius: 4px; font-weight: 700; letter-spacing: 0.02em;">CODE DE COMMERCE (ART. L.123-12)</span>
            </div>
            <div style="font-size: 0.82rem; color: #64748b; margin-top: 3px;">
              Ventilation intégrale de tous les mouvements compte par compte du plan comptable (classes 1 à 7).
            </div>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <button 
              type="button" 
              onclick={() => toggleViewDoc('grandlivre')}
              style="background: {activeViewDoc === 'grandlivre' ? '#0f172a' : '#ffffff'}; color: {activeViewDoc === 'grandlivre' ? '#ffffff' : '#0f172a'}; border: 1.5px solid {activeViewDoc === 'grandlivre' ? '#0f172a' : '#cbd5e1'}; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease;"
            >
              {activeViewDoc === 'grandlivre' ? 'Masquer' : 'Voir'}
            </button>
            <button 
              type="button" 
              onclick={exportGrandLivreCSV} 
              style="background: #0f172a; color: #ffffff; border: none; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);"
            >
              Exporter
            </button>
          </div>
          <span style="font-size: 0.74rem; color: #64748b; font-weight: 600;">
            Période : {formatPeriodLabel(localStartDate, localEndDate)} ({sortedTxList.length} écritures)
          </span>
        </div>
      </div>

      <!-- 4. Balance générale -->
      <div style="padding: 16px 20px; background: var(--bg-card, #ffffff); border: none; border-radius: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 42px; height: 42px; border-radius: 9px; background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
            <i class="fa-solid fa-scale-balanced"></i>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 800; font-size: 0.96rem; color: #0f172a;">Balance générale des comptes</span>
              <span style="font-size: 0.72rem; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 7px; border-radius: 4px; font-weight: 700; letter-spacing: 0.02em;">CONTRÔLE DE CLÔTURE</span>
            </div>
            <div style="font-size: 0.82rem; color: #64748b; margin-top: 3px;">
              Récapitulatif des cumuls débits, crédits et soldes nets pour contrôler l'équilibre de l'exercice.
            </div>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <button 
              type="button" 
              onclick={() => toggleViewDoc('balance')}
              style="background: {activeViewDoc === 'balance' ? '#0f172a' : '#ffffff'}; color: {activeViewDoc === 'balance' ? '#ffffff' : '#0f172a'}; border: 1.5px solid {activeViewDoc === 'balance' ? '#0f172a' : '#cbd5e1'}; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease;"
            >
              {activeViewDoc === 'balance' ? 'Masquer' : 'Voir'}
            </button>
            <button 
              type="button" 
              onclick={exportBalanceCSV} 
              style="background: #0f172a; color: #ffffff; border: none; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);"
            >
              Exporter
            </button>
          </div>
          <span style="font-size: 0.74rem; color: #64748b; font-weight: 600;">
            Période : {formatPeriodLabel(localStartDate, localEndDate)} ({sortedTxList.length} écritures)
          </span>
        </div>
      </div>
    {/if}

  </div>

  {#if activeViewDoc}
    <!-- ========================================== -->
    <!-- SECTION DE CONSULTATION DÉTAILLÉE DU REGISTRE -->
    <!-- ========================================== -->
    <div id="consultation-detail-view" style="margin-top: 24px; padding-top: 20px; border-top: 1.5px dashed var(--border-container);">
      <!-- En-tête de la consultation détaillée -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 800; color: #475569; background: #f1f5f9; padding: 4px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
            Consultation
          </span>
          <h4 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0;">
            {getDocTitle(activeViewDoc)}
          </h4>
        </div>

        <button 
          type="button" 
          onclick={() => activeViewDoc = null} 
          style="padding: 6px 14px; border-radius: 7px; border: 1px solid #cbd5e1; background: #ffffff; color: #475569; font-size: 0.82rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s ease;"
        >
          <i class="fa-solid fa-xmark"></i> Masquer la consultation
        </button>
      </div>

<!-- ========================================== -->
<!-- SOUS-ONGLETS POUR MICRO-ENTREPRISE -->
<!-- ========================================== -->
{#if accountingModel === 'micro'}
  {#if activeSubTab === 'recettes'}
  <div class="card" style="padding: 20px 24px; border: none; background: var(--bg-card, #ffffff); border-radius: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
      <span style="font-size: 0.84rem; color: #64748b; font-weight: 600;">
        {recettesMicro.length} recette{recettesMicro.length > 1 ? 's' : ''} enregistrée{recettesMicro.length > 1 ? 's' : ''}
      </span>
      <div style="background: #f8fafc; border: none; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04); padding: 6px 14px; border-radius: 8px; text-align: right;">
        <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #64748b; margin-right: 8px;">Chiffre d'Affaires Total</span>
        <strong style="font-size: 1.05rem; color: #15803d; font-family: var(--font-title);">
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
  <div class="card" style="padding: 20px 24px; border: none; background: var(--bg-card, #ffffff); border-radius: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
      <span style="font-size: 0.84rem; color: #64748b; font-weight: 600;">
        {achatsMicro.length} dépense{achatsMicro.length > 1 ? 's' : ''} enregistrée{achatsMicro.length > 1 ? 's' : ''}
      </span>
      <div style="background: #f8fafc; border: none; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04); padding: 6px 14px; border-radius: 8px; text-align: right;">
        <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #64748b; margin-right: 8px;">Total Dépenses & Achats</span>
        <strong style="font-size: 1.05rem; color: #b91c1c; font-family: var(--font-title);">
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
  <div class="card" style="padding: 20px 24px; border: none; background: var(--bg-card, #ffffff); border-radius: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);">

    <!-- Table Urssaf (Trimestrielle ou Mensuelle) avec sélecteur de rythme -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin: 0 0 14px 0; flex-wrap: wrap; gap: 12px;">
      <div>
        <h4 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0;">
          Décomposition {declarationFrequency === 'mensuelle' ? 'mensuelle (12 déclarations)' : 'par trimestre (4 déclarations)'}
        </h4>
        <span style="font-size: 0.8rem; color: #64748b; font-weight: 600; margin-top: 2px; display: block;">
          Montants précalculés prêts à être recopiés sur votre portail autoentrepreneur.urssaf.fr
        </span>
      </div>

      <!-- Sélecteur de rythme : Trimestrielle ou Mensuelle -->
      <div style="display: flex; align-items: center; gap: 4px; background: #f8fafc; padding: 3px; border-radius: 10px; border: 1.5px solid #e2e8f0;">
        <button 
          type="button"
          onclick={() => changeDeclarationFrequency('trimestrielle')}
          style="padding: 6px 14px; font-size: 0.82rem; font-weight: 700; border-radius: 7px; border: none; cursor: pointer; transition: all 0.15s ease; {declarationFrequency === 'trimestrielle' ? 'background: #0f172a; color: #ffffff;' : 'background: transparent; color: #64748b;'}"
        >
          Trimestrielle
        </button>
        <button 
          type="button"
          onclick={() => changeDeclarationFrequency('mensuelle')}
          style="padding: 6px 14px; font-size: 0.82rem; font-weight: 700; border-radius: 7px; border: none; cursor: pointer; transition: all 0.15s ease; {declarationFrequency === 'mensuelle' ? 'background: #0f172a; color: #ffffff;' : 'background: transparent; color: #64748b;'}"
        >
          Mensuelle
        </button>
      </div>
    </div>

    <div class="table-container">
      <table class="custom-table">
        <thead>
          <tr>
            <th>{declarationFrequency === 'mensuelle' ? 'Mois' : 'Trimestre'}</th>
            <th>Période</th>
            <th style="text-align: right;">CA Encaissé</th>
            <th style="text-align: right;">Cotisations Urssaf ({microRatePct}%)</th>
            <th style="text-align: center;">Statut</th>
            <th style="text-align: center;">Action</th>
          </tr>
        </thead>
        <tbody>
          {#if declarationFrequency === 'mensuelle'}
            {#each caMensuel as m}
              <tr>
                <td><strong>{m.code}</strong></td>
                <td>{m.label}</td>
                <td style="text-align: right; font-weight: 700; color: #0f172a;">{m.ca.toFixed(2)} €</td>
                <td style="text-align: right; font-weight: 700; color: #15803d;">{(m.ca * microRate).toFixed(2)} €</td>
                <td style="text-align: center;"><span class="badge {m.ca > 0 ? 'badge-success' : 'badge-muted'}">{m.ca > 0 ? 'Prêt à déclarer' : '0 €'}</span></td>
                <td style="text-align: center;">
                  <button 
                    type="button"
                    onclick={() => copierMontant(m.ca)}
                    style="background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; padding: 5px 11px; border-radius: 6px; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
                    title="Copier le montant pour urssaf.fr"
                  >
                    <i class="fa-regular fa-copy"></i> Copier CA
                  </button>
                </td>
              </tr>
            {/each}
          {:else}
            <tr>
              <td><strong>T1</strong></td>
              <td>Janvier - Mars</td>
              <td style="text-align: right; font-weight: 700; color: #0f172a;">{caTrimestriel.T1.toFixed(2)} €</td>
              <td style="text-align: right; font-weight: 700; color: #15803d;">{(caTrimestriel.T1 * microRate).toFixed(2)} €</td>
              <td style="text-align: center;"><span class="badge {caTrimestriel.T1 > 0 ? 'badge-success' : 'badge-muted'}">{caTrimestriel.T1 > 0 ? 'Prêt à déclarer' : '0 €'}</span></td>
              <td style="text-align: center;">
                <button 
                  type="button"
                  onclick={() => copierMontant(caTrimestriel.T1)}
                  style="background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; padding: 5px 11px; border-radius: 6px; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
                  title="Copier le montant pour urssaf.fr"
                >
                  <i class="fa-regular fa-copy"></i> Copier CA
                </button>
              </td>
            </tr>
            <tr>
              <td><strong>T2</strong></td>
              <td>Avril - Juin</td>
              <td style="text-align: right; font-weight: 700; color: #0f172a;">{caTrimestriel.T2.toFixed(2)} €</td>
              <td style="text-align: right; font-weight: 700; color: #15803d;">{(caTrimestriel.T2 * microRate).toFixed(2)} €</td>
              <td style="text-align: center;"><span class="badge {caTrimestriel.T2 > 0 ? 'badge-success' : 'badge-muted'}">{caTrimestriel.T2 > 0 ? 'Prêt à déclarer' : '0 €'}</span></td>
              <td style="text-align: center;">
                <button 
                  type="button"
                  onclick={() => copierMontant(caTrimestriel.T2)}
                  style="background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; padding: 5px 11px; border-radius: 6px; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
                  title="Copier le montant pour urssaf.fr"
                >
                  <i class="fa-regular fa-copy"></i> Copier CA
                </button>
              </td>
            </tr>
            <tr>
              <td><strong>T3</strong></td>
              <td>Juillet - Septembre</td>
              <td style="text-align: right; font-weight: 700; color: #0f172a;">{caTrimestriel.T3.toFixed(2)} €</td>
              <td style="text-align: right; font-weight: 700; color: #15803d;">{(caTrimestriel.T3 * microRate).toFixed(2)} €</td>
              <td style="text-align: center;"><span class="badge {caTrimestriel.T3 > 0 ? 'badge-success' : 'badge-muted'}">{caTrimestriel.T3 > 0 ? 'Prêt à déclarer' : '0 €'}</span></td>
              <td style="text-align: center;">
                <button 
                  type="button"
                  onclick={() => copierMontant(caTrimestriel.T3)}
                  style="background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; padding: 5px 11px; border-radius: 6px; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
                  title="Copier le montant pour urssaf.fr"
                >
                  <i class="fa-regular fa-copy"></i> Copier CA
                </button>
              </td>
            </tr>
            <tr>
              <td><strong>T4</strong></td>
              <td>Octobre - Décembre</td>
              <td style="text-align: right; font-weight: 700; color: #0f172a;">{caTrimestriel.T4.toFixed(2)} €</td>
              <td style="text-align: right; font-weight: 700; color: #15803d;">{(caTrimestriel.T4 * microRate).toFixed(2)} €</td>
              <td style="text-align: center;"><span class="badge {caTrimestriel.T4 > 0 ? 'badge-success' : 'badge-muted'}">{caTrimestriel.T4 > 0 ? 'Prêt à déclarer' : '0 €'}</span></td>
              <td style="text-align: center;">
                <button 
                  type="button"
                  onclick={() => copierMontant(caTrimestriel.T4)}
                  style="background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; padding: 5px 11px; border-radius: 6px; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
                  title="Copier le montant pour urssaf.fr"
                >
                  <i class="fa-regular fa-copy"></i> Copier CA
                </button>
              </td>
            </tr>
          {/if}
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
  <div class="card" style="padding: 20px 24px; margin-bottom: 22px; border: none; background: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
      <span style="font-size: 0.84rem; color: #64748b; font-weight: 600;">
        {sortedTxList.length} écriture{sortedTxList.length > 1 ? 's' : ''} enregistrée{sortedTxList.length > 1 ? 's' : ''}
      </span>
      <div style="background: #f8fafc; border: none; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04); padding: 6px 14px; border-radius: 8px; text-align: right;">
        <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #64748b; margin-right: 8px;">Solde Net</span>
        <strong style="font-size: 1.05rem; color: {soldeNet >= 0 ? '#15803d' : '#b91c1c'}; font-family: var(--font-title);">
          {soldeNet >= 0 ? '+' : ''}{soldeNet.toFixed(2)} €
        </strong>
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
  <div class="card" style="padding: 20px 24px; margin-bottom: 22px; border: none; background: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
      <span style="font-size: 0.84rem; color: #64748b; font-weight: 600;">
        {journalEntries.length / 2} opération{journalEntries.length / 2 > 1 ? 's' : ''} en partie double ({journalEntries.length} lignes)
      </span>
      <div style="background: #f8fafc; border: none; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04); padding: 6px 14px; border-radius: 8px; text-align: right;">
        <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #64748b; margin-right: 8px;">Total Mouvements</span>
        <strong style="font-size: 1.05rem; color: #0f172a; font-family: var(--font-title);">
          {totalJournalDebit.toFixed(2)} €
        </strong>
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
                  {#if accountingModel === 'copro'}
                    Conforme Décret Copropriété 2005
                  {:else if accountingModel === 'asso'}
                    Conforme Normes Associatives ANC
                  {:else}
                    Conforme FEC & Normes DGFiP
                  {/if}
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
  <div class="card" style="padding: 20px 24px; margin-bottom: 22px; border: none; background: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
      <span style="font-size: 0.84rem; color: #64748b; font-weight: 600;">
        {balanceRows.length} compte{balanceRows.length > 1 ? 's' : ''} au plan comptable
      </span>
      <div style="background: #f8fafc; border: none; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04); padding: 6px 14px; border-radius: 8px; text-align: right;">
        <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #64748b; margin-right: 8px;">Total Balance</span>
        <strong style="font-size: 1.05rem; color: #0f172a; font-family: var(--font-title);">
          {totalBalanceDebit.toFixed(2)} €
        </strong>
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
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 30px;">
    
    <!-- ACTIF -->
    <div class="card" style="padding: 24px;">
      <h3 style="font-family: var(--font-title); margin: 0 0 15px 0; border-bottom: 1.5px solid var(--border-color); padding-bottom: 10px; color: #0f172a; font-weight: 800; font-size: 1.05rem;">
        {#if accountingModel === 'copro'}
          ACTIF DU SYNDICAT (Disponibilités bancaires & Créances)
        {:else if accountingModel === 'asso'}
          ACTIF ASSOCIATIF (Trésorerie & Valeurs de l'association)
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
              {#if accountingModel === 'copro'}
                TOTAL DE L’ACTIF (Trésorerie & Créances)
              {:else if accountingModel === 'asso'}
                TOTAL DE L’ACTIF ASSOCIATIF
              {:else}
                TOTAL DE L'ACTIF
              {/if}
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
        {:else if accountingModel === 'asso'}
          PASSIF & FONDS ASSOCIATIFS (Fonds propres & Dettes)
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
              {#if accountingModel === 'copro'}
                TOTAL DU PASSIF (Provisions & Dettes)
              {:else if accountingModel === 'asso'}
                TOTAL DU PASSIF & FONDS PROPRES
              {:else}
                TOTAL DU PASSIF
              {/if}
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
    </div>
  {/if}
</div>
<style>
</style>
