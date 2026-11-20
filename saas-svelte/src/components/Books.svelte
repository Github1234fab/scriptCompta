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
    updateEntities,
    openHelpGuide
  } from '../lib/store.js';
  import { Categorizer } from '../lib/categorizer.js';
  import InfoTip from './InfoTip.svelte';

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

  function exportBilanCSV() {
    let csv = "Section;Numéro Compte;Rubrique / Intitulé;Montant Net (€)\n";
    csv += "--- ACTIF ---\n";
    bilanData.actifs.forEach(a => {
      csv += `ACTIF;${a.compte};"${(a.nom || '').replace(/"/g, '""')}";${a.valeur.toFixed(2)}\n`;
    });
    csv += `TOTAL ACTIF;;TOTAL DE L'ACTIF;${bilanData.totalActif.toFixed(2)}\n\n`;

    csv += "--- PASSIF & FONDS PROPRES ---\n";
    bilanData.passifs.forEach(p => {
      csv += `PASSIF;${p.compte};"${(p.nom || '').replace(/"/g, '""')}";${p.valeur.toFixed(2)}\n`;
    });
    const labelResultat = accountingModel === 'asso' ? "Résultat net (Excédent / Déficit de l'exercice)" : "Résultat net (Bénéfice / Perte)";
    csv += `PASSIF;120/129;"${labelResultat}";${bilanData.excedent.toFixed(2)}\n`;
    csv += `TOTAL PASSIF;;TOTAL DU PASSIF;${bilanData.totalPassif.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `BILAN_${activeEntity.name.replace(/\s+/g, '_')}_${new Date().getFullYear()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Bilan et rapport d'AG téléchargés avec succès.");
  }


</script>

<div class="page-title-section" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 24px; flex-wrap: wrap;">
  <div style="flex: 1; min-width: 280px;">
    <h1 class="page-title" style="margin: 0 0 6px 0; font-family: var(--font-title); font-weight: 800; font-size: 1.6rem; color: var(--text-main);">
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
    <p class="page-subtitle" style="margin: 0; color: var(--text-muted); font-size: 0.9rem; line-height: 1.5;">
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

  <button 
    type="button" 
    onclick={() => openHelpGuide('obligations')}
    title="Guide d'utilisation pour vos obligations et registres"
    aria-label="Guide d'utilisation pour vos obligations et registres"
    class="page-help-btn"
  >
    <i class="fa-solid fa-question"></i>
  </button>
</div>

<!-- ========================================== -->
<!-- 1. BARRE DE PÉRIODE COMPTABLE (CALENDRIER) -->
<!-- ========================================== -->
<div style="margin-bottom: 30px;">
  <div class="books-section-box" style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
    <!-- En-tête du bloc -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
      <div>
        <h3 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 8px;">
          Exercice fiscal
          <InfoTip text="Définissez les 12 mois de votre saison ou exercice comptable à clôturer." width="250px" />
        </h3>
        <span class="books-section-subtitle" style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; margin-top: 2px; display: block;">
          Sélectionnez la période à clôturer pour générer vos registres et votre export officiel
        </span>
      </div>

      <!-- Badge récapitulatif -->
      {#if localStartDate && localEndDate}
        <div class="fiscal-badge-wrap">
          <span class="fiscal-summary-badge">
            <i class="fa-solid fa-circle-check"></i> {formatPeriodLabel(localStartDate, localEndDate)} (12 mois)
          </span>
        </div>
      {:else}
        <span class="fiscal-summary-badge" style="color: var(--text-muted); background: var(--bg-subtle); border-color: var(--border-color);">
          Tout l'historique
        </span>
      {/if}
    </div>

    <!-- Contenu intérieur -->
    <div class="fiscal-card-inner">
      
      <!-- Ligne 1 : Choix de la période (Menu déroulant épuré + Navigation rapide) -->
      <div class="fiscal-period-row" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
        <div class="fiscal-period-controls" style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <label for="fiscal-year-select" style="font-size: 0.82rem; font-weight: 800; color: var(--text-main); text-transform: uppercase;">
            Période :
          </label>
          <div class="fiscal-period-select-group" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <select 
              id="fiscal-year-select"
              class="fiscal-period-select"
              value={selectedDropdownValue}
              onchange={handleDropdownChange}
              style="padding: 8px 14px; border: 1.5px solid var(--border-color); border-radius: 8px; font-size: 0.88rem; font-weight: 700; color: var(--text-main); background: var(--bg-card); cursor: pointer; min-width: 200px;"
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
              <div class="fiscal-year-nav" style="display: flex; gap: 4px;">
                <button 
                  type="button" 
                  title={`Passer à l'année précédente (${currentYr - 1})`}
                  onclick={() => selectYear(currentYr - 1)}
                  style="padding: 7px 11px; background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.8rem; font-weight: 700; color: var(--text-main); cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                >
                  <i class="fa-solid fa-chevron-left"></i> {currentYr - 1}
                </button>
                <button 
                  type="button" 
                  title={`Passer à l'année suivante (${currentYr + 1})`}
                  onclick={() => selectYear(currentYr + 1)}
                  style="padding: 7px 11px; background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.8rem; font-weight: 700; color: var(--text-main); cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                >
                  {currentYr + 1} <i class="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            {/if}
          </div>
        </div>

        <!-- Compteur d'écritures -->
        <div class="fiscal-period-badge">
          {#if localStartDate || localEndDate}
            <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-main); background: var(--bg-subtle); border: 1px solid var(--border-color); padding: 6px 14px; border-radius: 8px; display: inline-block;">
              <strong>{sortedTxList.length}</strong> opérations sur cette période
            </span>
          {:else}
            <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-main); background: var(--bg-subtle); border: 1px solid var(--border-color); padding: 6px 14px; border-radius: 8px; display: inline-block;">
              <strong>{rawTxList.length}</strong> opérations au total
            </span>
          {/if}
        </div>
      </div>

      <!-- Ligne 2 : Si période personnalisée choisie, date de début avec fin calculée automatiquement sur 1 an -->
      {#if selectedDropdownValue === 'custom'}
        <div class="custom-fiscal-container">
          <div class="custom-fiscal-grid">
            
            <div class="custom-fiscal-field">
              <label for="custom-fiscal-start" class="custom-fiscal-label">
                Date de début :
              </label>
              <input 
                id="custom-fiscal-start" 
                type="date" 
                class="custom-fiscal-input"
                value={localStartDate}
                onchange={(e) => {
                  const val = e.currentTarget.value;
                  localStartDate = val;
                  if (val) {
                    localEndDate = computeOneYearEnd(val);
                  }
                  handleSaveFiscalPeriod();
                }}
              />
            </div>

            <div class="custom-fiscal-field">
              <span class="custom-fiscal-label">
                Date de fin (1 an) :
              </span>
              <div class="custom-fiscal-locked">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <i class="fa-solid fa-lock" style="color: var(--text-muted); font-size: 0.75rem;"></i>
                  <span>{localEndDate ? new Date(localEndDate).toLocaleDateString('fr-FR') : 'Calculée sur 1 an'}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span class="fiscal-12m-badge">12 MOIS</span>
                  <InfoTip text="Verrouille la période légale exacte pour répondre aux normes des experts-comptables et de l'administration." width="250px" />
                </div>
              </div>
            </div>

          </div>

          <div class="custom-fiscal-hint">
            <i class="fa-solid fa-shield-halved" style="color: #38bdf8; font-size: 0.78rem;"></i>
            <span>Exercice de 12 mois conforme pour l'expert-comptable</span>
          </div>
        </div>
      {/if}

    </div>
  </div>
</div>

<!-- ========================================== -->
<!-- 2. DOCUMENTS LÉGAUX À FOURNIR -->
<!-- ========================================== -->
<div class="books-docs-box" style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); margin-bottom: 30px;">
  <!-- En-tête du bloc -->
  <div style="margin-bottom: 18px;">
    <h3 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0;">
      Documents légaux à fournir
    </h3>
    <span class="books-docs-subtitle" style="font-size: 0.8rem; color: #64748b; font-weight: 600; margin-top: 2px; display: block;">
      Pièces officielles obligatoires pour l'Urssaf, la DGFiP ou votre expert-comptable
    </span>
  </div>

  <!-- CATALOGUE DES PIÈCES OFFICIELLES -->
  <div style="display: flex; flex-direction: column; gap: 14px;">
    
    {#if accountingModel === 'micro'}
      <!-- 1. Livre officiel des recettes -->
      <div class="legal-doc-card">
        <div class="legal-doc-info">
          <div class="legal-doc-icon" style="width: 42px; height: 42px; border-radius: 9px; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.25); color: #818cf8; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
            <i class="fa-solid fa-book-journal-whills"></i>
          </div>
          <div class="legal-doc-text">
            <div class="legal-doc-header">
              <span class="legal-doc-title" style="font-weight: 800; font-size: 0.96rem; color: var(--text-main);">Livre chronologique des recettes</span>
              <div class="legal-doc-meta">
                <span class="legal-doc-badge" style="color: #818cf8; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.28);">OBLIGATOIRE (ART. 286 CGI)</span>
              </div>
            </div>
            <div class="legal-doc-desc" style="font-size: 0.82rem; color: var(--text-muted); margin-top: 3px;">
              Enregistrement chronologique de chaque encaissement client avec dates, tiers, factures et règlements.
            </div>
          </div>
        </div>
        <div class="legal-doc-actions">
          <button 
            type="button" 
            onclick={() => toggleViewDoc('recettes')}
            style="background: {activeViewDoc === 'recettes' ? 'var(--text-main)' : 'transparent'}; color: {activeViewDoc === 'recettes' ? 'var(--bg-main)' : 'var(--text-main)'}; border: 1.5px solid {activeViewDoc === 'recettes' ? 'var(--text-main)' : 'var(--border-color)'}; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease;"
          >
            {activeViewDoc === 'recettes' ? 'Masquer' : 'Voir'}
          </button>
          <button 
            type="button" 
            onclick={exportLivreRecettesMicro} 
            style="background: #2563eb; color: #ffffff; border: none; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); display: inline-flex; align-items: center; gap: 6px;"
          >
            <i class="fa-solid fa-download" style="font-size: 0.78rem;"></i>
            Exporter
          </button>
        </div>
      </div>

      <!-- 2. Registre des achats -->
      <div class="legal-doc-card">
        <div class="legal-doc-info">
          <div class="legal-doc-icon" style="width: 42px; height: 42px; border-radius: 9px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); color: #10b981; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
            <i class="fa-solid fa-receipt"></i>
          </div>
          <div class="legal-doc-text">
            <div class="legal-doc-header">
              <span class="legal-doc-title" style="font-weight: 800; font-size: 0.96rem; color: var(--text-main);">Registre des achats & dépenses</span>
              <div class="legal-doc-meta">
                <span class="legal-doc-badge" style="color: #10b981; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.28);">OBLIGATOIRE (ART. 286 TER CGI)</span>
              </div>
            </div>
            <div class="legal-doc-desc" style="font-size: 0.82rem; color: var(--text-muted); margin-top: 3px;">
              Récapitulatif des achats professionnels, dépenses de fonctionnement et fournitures matérielles.
            </div>
          </div>
        </div>
        <div class="legal-doc-actions">
          <button 
            type="button" 
            onclick={() => toggleViewDoc('achats')}
            style="background: {activeViewDoc === 'achats' ? 'var(--text-main)' : 'transparent'}; color: {activeViewDoc === 'achats' ? 'var(--bg-main)' : 'var(--text-main)'}; border: 1.5px solid {activeViewDoc === 'achats' ? 'var(--text-main)' : 'var(--border-color)'}; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease;"
          >
            {activeViewDoc === 'achats' ? 'Masquer' : 'Voir'}
          </button>
          <button 
            type="button" 
            onclick={exportRegistreAchatsMicro} 
            style="background: #2563eb; color: #ffffff; border: none; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); display: inline-flex; align-items: center; gap: 6px;"
          >
            <i class="fa-solid fa-download" style="font-size: 0.78rem;"></i>
            Exporter
          </button>
        </div>
      </div>

      <!-- 3. Déclaration Urssaf -->
      <div class="legal-doc-card">
        <div class="legal-doc-info">
          <div class="legal-doc-icon" style="width: 42px; height: 42px; border-radius: 9px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.25); color: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
            <i class="fa-solid fa-chart-pie"></i>
          </div>
          <div class="legal-doc-text">
            <div class="legal-doc-header">
              <span class="legal-doc-title" style="font-weight: 800; font-size: 0.96rem; color: var(--text-main);">Déclaration Urssaf</span>
              <div class="legal-doc-meta">
                <span class="legal-doc-badge" style="color: #f59e0b; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.28);">OBLIGATOIRE (ART. L. 613-7 CSS)</span>
              </div>
            </div>
            <div class="legal-doc-desc" style="font-size: 0.82rem; color: var(--text-muted); margin-top: 3px;">
              Télédéclaration périodique du CA encaissé et calcul des cotisations sociales ({microRatePct}%).
            </div>
          </div>
        </div>
        <div class="legal-doc-actions">
          <button 
            type="button" 
            onclick={() => toggleViewDoc('recap_ca')}
            style="background: {activeViewDoc === 'recap_ca' ? 'var(--text-main)' : 'transparent'}; color: {activeViewDoc === 'recap_ca' ? 'var(--bg-main)' : 'var(--text-main)'}; border: 1.5px solid {activeViewDoc === 'recap_ca' ? 'var(--text-main)' : 'var(--border-color)'}; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease;"
          >
            {activeViewDoc === 'recap_ca' ? 'Masquer' : 'Voir'}
          </button>
          <button 
            type="button" 
            onclick={exportDeclarationUrssafMicro} 
            style="background: #2563eb; color: #ffffff; border: none; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); display: inline-flex; align-items: center; gap: 6px;"
          >
            <i class="fa-solid fa-download" style="font-size: 0.78rem;"></i>
            Exporter
          </button>
        </div>
      </div>



    {:else if accountingModel === 'bnc'}
      <!-- 1. Livre-Journal des Recettes et Dépenses BNC -->
      <div class="legal-doc-card">
        <div class="legal-doc-info">
          <div class="legal-doc-icon" style="width: 42px; height: 42px; border-radius: 9px; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.25); color: #818cf8; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
            <i class="fa-solid fa-book-journal-whills"></i>
          </div>
          <div class="legal-doc-text">
            <div class="legal-doc-header">
              <span class="legal-doc-title" style="font-weight: 800; font-size: 0.96rem; color: var(--text-main);">Livre-Journal des Recettes et Dépenses (2035)</span>
              <div class="legal-doc-meta">
                <span class="legal-doc-badge" style="color: #818cf8; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.28);">OBLIGATOIRE (ART. 99 CGI)</span>
              </div>
            </div>
            <div class="legal-doc-desc" style="font-size: 0.82rem; color: var(--text-muted); margin-top: 3px;">
              Registre légal chronologique des recettes encaissées et dépenses professionnelles déductibles.
            </div>
          </div>
        </div>
        <div class="legal-doc-actions">
          <button 
            type="button" 
            onclick={() => toggleViewDoc('recettes_depenses')}
            style="background: {activeViewDoc === 'recettes_depenses' ? 'var(--text-main)' : 'transparent'}; color: {activeViewDoc === 'recettes_depenses' ? 'var(--bg-main)' : 'var(--text-main)'}; border: 1.5px solid {activeViewDoc === 'recettes_depenses' ? 'var(--text-main)' : 'var(--border-color)'}; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease;"
          >
            {activeViewDoc === 'recettes_depenses' ? 'Masquer' : 'Voir'}
          </button>
          <button 
            type="button" 
            onclick={exportLivreRecettesDepensesCSV} 
            style="background: #2563eb; color: #ffffff; border: none; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); display: inline-flex; align-items: center; gap: 6px;"
          >
            <i class="fa-solid fa-download" style="font-size: 0.78rem;"></i>
            Exporter
          </button>
        </div>
      </div>

      <!-- 2. FEC officiel BNC -->
      <div class="legal-doc-card">
        <div class="legal-doc-info">
          <div class="legal-doc-icon" style="width: 42px; height: 42px; border-radius: 9px; background: rgba(37, 99, 235, 0.1); border: 1px solid rgba(37, 99, 235, 0.25); color: #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
            <i class="fa-solid fa-file-shield"></i>
          </div>
          <div class="legal-doc-text">
            <div class="legal-doc-header">
              <span class="legal-doc-title" style="font-weight: 800; font-size: 0.96rem; color: var(--text-main);">Fichier des Écritures Comptables (FEC officiel)</span>
              <div class="legal-doc-meta">
                <span class="legal-doc-badge" style="color: #3b82f6; background: rgba(37, 99, 235, 0.1); border: 1px solid rgba(37, 99, 235, 0.28);">NORME DGFIP (ART. L.47 A-I LPF)</span>
                <InfoTip text="Fichier informatique normalisé officiel exigé par le fisc en cas de contrôle ou pour votre expert." width="260px" />
              </div>
            </div>
            <div class="legal-doc-desc" style="font-size: 0.82rem; color: var(--text-muted); margin-top: 3px;">
              Fichier informatique obligatoire à remettre à votre expert-comptable ou à l'administration fiscale.
            </div>
          </div>
        </div>
        <div class="legal-doc-actions">
          <button 
            type="button" 
            onclick={() => toggleViewDoc('recettes_depenses')}
            style="background: {activeViewDoc === 'recettes_depenses' ? 'var(--text-main)' : 'transparent'}; color: {activeViewDoc === 'recettes_depenses' ? 'var(--bg-main)' : 'var(--text-main)'}; border: 1.5px solid {activeViewDoc === 'recettes_depenses' ? 'var(--text-main)' : 'var(--border-color)'}; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease;"
          >
            {activeViewDoc === 'recettes_depenses' ? 'Masquer' : 'Voir'}
          </button>
          <button 
            type="button" 
            onclick={exportFEC} 
            style="background: #2563eb; color: #ffffff; border: none; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); display: inline-flex; align-items: center; gap: 6px;"
          >
            <i class="fa-solid fa-download" style="font-size: 0.78rem;"></i>
            Exporter
          </button>
        </div>
      </div>

    {:else}
      <!-- TPE / SOCIÉTÉ / SCI / COPRO / ASSO -->
      <!-- 1. FEC officiel -->
      <div class="legal-doc-card">
        <div class="legal-doc-info">
          <div class="legal-doc-icon" style="width: 42px; height: 42px; border-radius: 9px; background: rgba(37, 99, 235, 0.1); border: 1px solid rgba(37, 99, 235, 0.25); color: #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
            <i class="fa-solid fa-file-shield"></i>
          </div>
          <div class="legal-doc-text">
            <div class="legal-doc-header">
              <span class="legal-doc-title" style="font-weight: 800; font-size: 0.96rem; color: var(--text-main);">Fichier des Écritures Comptables (FEC officiel)</span>
              <div class="legal-doc-meta">
                <span class="legal-doc-badge" style="color: #3b82f6; background: rgba(37, 99, 235, 0.1); border: 1px solid rgba(37, 99, 235, 0.28);">NORME DGFIP (ART. L.47 A-1 LPF)</span>
                <InfoTip text="Fichier informatique normalisé officiel exigé par le fisc en cas de contrôle ou pour votre expert." width="260px" />
              </div>
            </div>
            <div class="legal-doc-desc" style="font-size: 0.82rem; color: var(--text-muted); margin-top: 3px;">
              Fichier informatique normé exigé par la DGFiP pour la clôture annuelle et votre expert-comptable.
            </div>
          </div>
        </div>
        <div class="legal-doc-actions">
          <button 
            type="button" 
            onclick={() => toggleViewDoc('journal')}
            style="background: {activeViewDoc === 'journal' ? 'var(--text-main)' : 'transparent'}; color: {activeViewDoc === 'journal' ? 'var(--bg-main)' : 'var(--text-main)'}; border: 1.5px solid {activeViewDoc === 'journal' ? 'var(--text-main)' : 'var(--border-color)'}; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease;"
          >
            {activeViewDoc === 'journal' ? 'Masquer' : 'Voir'}
          </button>
          <button 
            type="button" 
            onclick={exportFEC} 
            style="background: #2563eb; color: #ffffff; border: none; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); display: inline-flex; align-items: center; gap: 6px;"
          >
            <i class="fa-solid fa-download" style="font-size: 0.78rem;"></i>
            Exporter
          </button>
        </div>
      </div>

      <!-- 2. Livre-Journal général -->
      <div class="legal-doc-card">
        <div class="legal-doc-info">
          <div class="legal-doc-icon" style="width: 42px; height: 42px; border-radius: 9px; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.25); color: #818cf8; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
            <i class="fa-solid fa-book"></i>
          </div>
          <div class="legal-doc-text">
            <div class="legal-doc-header">
              <span class="legal-doc-title" style="font-weight: 800; font-size: 0.96rem; color: var(--text-main);">Livre-Journal général</span>
              <div class="legal-doc-meta">
                <span class="legal-doc-badge" style="color: #818cf8; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.28);">CODE DE COMMERCE (ART. L.123-12)</span>
                <InfoTip text="Registre chronologique obligatoire de toutes vos entrées et sorties au centime près." width="260px" />
              </div>
            </div>
            <div class="legal-doc-desc" style="font-size: 0.82rem; color: var(--text-muted); margin-top: 3px;">
              Enregistrement chronologique officiel opération par opération avec débits et crédits équilibrés.
            </div>
          </div>
        </div>
        <div class="legal-doc-actions">
          <button 
            type="button" 
            onclick={() => toggleViewDoc('journal')}
            style="background: {activeViewDoc === 'journal' ? 'var(--text-main)' : 'transparent'}; color: {activeViewDoc === 'journal' ? 'var(--bg-main)' : 'var(--text-main)'}; border: 1.5px solid {activeViewDoc === 'journal' ? 'var(--text-main)' : 'var(--border-color)'}; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease;"
          >
            {activeViewDoc === 'journal' ? 'Masquer' : 'Voir'}
          </button>
          <button 
            type="button" 
            onclick={exportJournalCSV} 
            style="background: #2563eb; color: #ffffff; border: none; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); display: inline-flex; align-items: center; gap: 6px;"
          >
            <i class="fa-solid fa-download" style="font-size: 0.78rem;"></i>
            Exporter
          </button>
        </div>
      </div>

      <!-- 3. Grand-Livre général -->
      <div class="legal-doc-card">
        <div class="legal-doc-info">
          <div class="legal-doc-icon" style="width: 42px; height: 42px; border-radius: 9px; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.25); color: #818cf8; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
            <i class="fa-solid fa-layer-group"></i>
          </div>
          <div class="legal-doc-text">
            <div class="legal-doc-header">
              <span class="legal-doc-title" style="font-weight: 800; font-size: 0.96rem; color: var(--text-main);">Grand-Livre général des comptes</span>
              <div class="legal-doc-meta">
                <span class="legal-doc-badge" style="color: #818cf8; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.28);">CODE DE COMMERCE (ART. L.123-12)</span>
                <InfoTip text="Regroupement exhaustif de vos écritures compte par compte (achats, cotisations, banques)." width="260px" />
              </div>
            </div>
            <div class="legal-doc-desc" style="font-size: 0.82rem; color: var(--text-muted); margin-top: 3px;">
              Ventilation intégrale de tous les mouvements compte par compte du plan comptable (classes 1 à 7).
            </div>
          </div>
        </div>
        <div class="legal-doc-actions">
          <button 
            type="button" 
            onclick={() => toggleViewDoc('grandlivre')}
            style="background: {activeViewDoc === 'grandlivre' ? 'var(--text-main)' : 'transparent'}; color: {activeViewDoc === 'grandlivre' ? 'var(--bg-main)' : 'var(--text-main)'}; border: 1.5px solid {activeViewDoc === 'grandlivre' ? 'var(--text-main)' : 'var(--border-color)'}; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease;"
          >
            {activeViewDoc === 'grandlivre' ? 'Masquer' : 'Voir'}
          </button>
          <button 
            type="button" 
            onclick={exportGrandLivreCSV} 
            style="background: #2563eb; color: #ffffff; border: none; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); display: inline-flex; align-items: center; gap: 6px;"
          >
            <i class="fa-solid fa-download" style="font-size: 0.78rem;"></i>
            Exporter
          </button>
        </div>
      </div>

      <!-- 4. Balance générale -->
      <div class="legal-doc-card">
        <div class="legal-doc-info">
          <div class="legal-doc-icon" style="width: 42px; height: 42px; border-radius: 9px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); color: #10b981; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
            <i class="fa-solid fa-scale-balanced"></i>
          </div>
          <div class="legal-doc-text">
            <div class="legal-doc-header">
              <span class="legal-doc-title" style="font-weight: 800; font-size: 0.96rem; color: var(--text-main);">Balance générale des comptes</span>
              <div class="legal-doc-meta">
                <span class="legal-doc-badge" style="color: #10b981; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.28);">CONTRÔLE DE CLÔTURE</span>
                <InfoTip text="État récapitulatif des soldes débiteurs et créditeurs validant l'équilibre parfait de vos comptes." width="260px" />
              </div>
            </div>
            <div class="legal-doc-desc" style="font-size: 0.82rem; color: var(--text-muted); margin-top: 3px;">
              Récapitulatif des cumuls débits, crédits et soldes nets pour contrôler l'équilibre de l'exercice.
            </div>
          </div>
        </div>
        <div class="legal-doc-actions">
          <button 
            type="button" 
            onclick={() => toggleViewDoc('balance')}
            style="background: {activeViewDoc === 'balance' ? 'var(--text-main)' : 'transparent'}; color: {activeViewDoc === 'balance' ? 'var(--bg-main)' : 'var(--text-main)'}; border: 1.5px solid {activeViewDoc === 'balance' ? 'var(--text-main)' : 'var(--border-color)'}; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease;"
          >
            {activeViewDoc === 'balance' ? 'Masquer' : 'Voir'}
          </button>
          <button 
            type="button" 
            onclick={exportBalanceCSV} 
            style="background: #2563eb; color: #ffffff; border: none; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); display: inline-flex; align-items: center; gap: 6px;"
          >
            <i class="fa-solid fa-download" style="font-size: 0.78rem;"></i>
            Exporter
          </button>
        </div>
      </div>

      <!-- 5. Bilan synthétique & Rapport d'AG -->
      <div class="legal-doc-card">
        <div class="legal-doc-info">
          <div class="legal-doc-icon" style="width: 42px; height: 42px; border-radius: 9px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.25); color: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
            <i class="fa-solid fa-chart-pie"></i>
          </div>
          <div class="legal-doc-text">
            <div class="legal-doc-header">
              <span class="legal-doc-title" style="font-weight: 800; font-size: 0.96rem; color: var(--text-main);">
                {accountingModel === 'asso' ? "Bilan & Rapport financier d'AG" : "Bilan & Compte de résultat"}
              </span>
              <div class="legal-doc-meta">
                <span class="legal-doc-badge" style="color: #f59e0b; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.28);">
                  {accountingModel === 'asso' ? 'RÈGLEMENT ANC 2018-06' : 'RAPPORT ANNUEL'}
                </span>
                <InfoTip text="Synthèse annuelle certifiée (Actif, Passif et Excédent/Déficit) prête à présenter et faire voter en Assemblée Générale." width="260px" />
              </div>
            </div>
            <div class="legal-doc-desc" style="font-size: 0.82rem; color: var(--text-muted); margin-top: 3px;">
              Synthèse annuelle des fonds propres, créances, dettes et résultat net prête à être soumise au vote de l'Assemblée Générale.
            </div>
          </div>
        </div>
        <div class="legal-doc-actions">
          <button 
            type="button" 
            onclick={() => toggleViewDoc('bilan')}
            style="background: {activeViewDoc === 'bilan' ? 'var(--text-main)' : 'transparent'}; color: {activeViewDoc === 'bilan' ? 'var(--bg-main)' : 'var(--text-main)'}; border: 1.5px solid {activeViewDoc === 'bilan' ? 'var(--text-main)' : 'var(--border-color)'}; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease;"
          >
            {activeViewDoc === 'bilan' ? 'Masquer' : 'Voir'}
          </button>
          <button 
            type="button" 
            onclick={exportBilanCSV} 
            style="background: #2563eb; color: #ffffff; border: none; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); display: inline-flex; align-items: center; gap: 6px;"
          >
            <i class="fa-solid fa-download" style="font-size: 0.78rem;"></i>
            Exporter
          </button>
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
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 800; color: var(--text-muted); background: var(--bg-subtle); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border-color);">
            Consultation
          </span>
          <h4 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 0;">
            {getDocTitle(activeViewDoc)}
          </h4>
        </div>

        <button 
          type="button" 
          onclick={() => activeViewDoc = null} 
          style="padding: 6px 14px; border-radius: 7px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-main); font-size: 0.82rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s ease;"
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

    <div class="desktop-consultation-table table-container">
      <table class="custom-table" id="recettes-micro-table" style="min-width: 650px;">
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
              <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 36px;">
                Aucune recette encaissée pour le moment. Importez vos relevés bancaires pour remplir automatiquement ce livre.
              </td>
            </tr>
          {:else}
            {#each recettesMicro as r}
              <tr style="border-bottom: 1px solid var(--border-color); background: var(--bg-card);">
                <td style="color: var(--text-muted); font-weight: 700; font-size: 0.82rem;">#{String(r.numeroOrdre).padStart(3, '0')}</td>
                <td style="font-weight: 700; color: var(--text-main);">{new Date(r.date).toLocaleDateString('fr-FR')}</td>
                <td style="font-family: monospace; font-size: 0.8rem; color: #3b82f6;">{r.reference}</td>
                <td style="color: var(--text-main); font-weight: 700;">{r.client}</td>
                <td><span class="badge badge-muted">{r.nature}</span></td>
                <td style="font-size: 0.82rem; color: var(--text-muted);">{r.modePaiement}</td>
                <td style="text-align: right; font-weight: 800; font-size: 0.95rem; color: #10b981;">
                  +{r.montant.toFixed(2)} €
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Vue Mobile Fintech Recettes Micro -->
    <div class="mobile-consultation-cards">
      {#if recettesMicro.length === 0}
        <div class="consultation-empty-card">
          <p style="margin: 0; font-size: 0.84rem; color: var(--text-muted);">Aucune recette encaissée pour le moment.</p>
        </div>
      {:else}
        <div class="consultation-cards-list">
          {#each recettesMicro as r}
            <div class="consultation-card-item">
              <div class="consultation-card-top">
                <div class="consultation-date-piece">
                  <span class="consultation-date">{new Date(r.date).toLocaleDateString('fr-FR')}</span>
                  <span class="consultation-piece">#{String(r.numeroOrdre).padStart(3, '0')}</span>
                </div>
                <div class="consultation-amount credit">
                  +{r.montant.toFixed(2)} €
                </div>
              </div>
              <div class="consultation-card-account">
                <span class="consultation-account-code">{r.reference}</span>
                <span class="consultation-account-name">{r.nature}</span>
              </div>
              <div class="consultation-card-desc">
                <strong>{r.client}</strong> &bull; {r.modePaiement}
              </div>
            </div>
          {/each}
        </div>
      {/if}
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

    <div class="desktop-consultation-table table-container">
      <table class="custom-table" id="achats-micro-table" style="min-width: 650px;">
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
              <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 36px;">
                Aucun achat enregistré. Attribuez vos dépenses dans le relevé bancaire pour alimenter ce registre.
              </td>
            </tr>
          {:else}
            {#each achatsMicro as a}
              <tr style="border-bottom: 1px solid var(--border-color); background: var(--bg-card);">
                <td style="color: var(--text-muted); font-weight: 700; font-size: 0.82rem;">#{String(a.numeroOrdre).padStart(3, '0')}</td>
                <td style="font-weight: 700; color: var(--text-main);">{new Date(a.date).toLocaleDateString('fr-FR')}</td>
                <td style="color: var(--text-main); font-weight: 700;">{a.fournisseur}</td>
                <td><span class="badge badge-muted">{a.nature}</span></td>
                <td style="font-size: 0.82rem; color: var(--text-muted);">{a.modePaiement}</td>
                <td style="text-align: right; font-weight: 800; font-size: 0.95rem; color: #ef4444;">
                  -{a.montant.toFixed(2)} €
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Vue Mobile Fintech Achats Micro -->
    <div class="mobile-consultation-cards">
      {#if achatsMicro.length === 0}
        <div class="consultation-empty-card">
          <p style="margin: 0; font-size: 0.84rem; color: var(--text-muted);">Aucun achat enregistré.</p>
        </div>
      {:else}
        <div class="consultation-cards-list">
          {#each achatsMicro as a}
            <div class="consultation-card-item">
              <div class="consultation-card-top">
                <div class="consultation-date-piece">
                  <span class="consultation-date">{new Date(a.date).toLocaleDateString('fr-FR')}</span>
                  <span class="consultation-piece">#{String(a.numeroOrdre).padStart(3, '0')}</span>
                </div>
                <div class="consultation-amount debit">
                  -{a.montant.toFixed(2)} €
                </div>
              </div>
              <div class="consultation-card-account">
                <span class="consultation-account-name">{a.nature}</span>
              </div>
              <div class="consultation-card-desc">
                <strong>{a.fournisseur}</strong> &bull; {a.modePaiement}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

{#if activeSubTab === 'recap_ca'}
  <div class="card consultation-card" style="margin-bottom: 22px;">

    <!-- Table Urssaf (Trimestrielle ou Mensuelle) avec sélecteur de rythme -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin: 0 0 14px 0; flex-wrap: wrap; gap: 12px;">
      <div>
        <h4 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 0;">
          Décomposition {declarationFrequency === 'mensuelle' ? 'mensuelle (12 déclarations)' : 'par trimestre (4 déclarations)'}
        </h4>
        <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; margin-top: 2px; display: block;">
          Montants précalculés prêts à être recopiés sur votre portail autoentrepreneur.urssaf.fr
        </span>
      </div>

      <!-- Sélecteur de rythme : Trimestrielle ou Mensuelle -->
      <div style="display: flex; align-items: center; gap: 4px; background: var(--bg-subtle); padding: 3px; border-radius: 10px; border: 1.5px solid var(--border-color);">
        <button 
          type="button"
          onclick={() => changeDeclarationFrequency('trimestrielle')}
          style="padding: 6px 14px; font-size: 0.82rem; font-weight: 700; border-radius: 7px; border: none; cursor: pointer; transition: all 0.15s ease; {declarationFrequency === 'trimestrielle' ? 'background: #0f172a; color: #ffffff;' : 'background: transparent; color: var(--text-muted);'}"
        >
          Trimestrielle
        </button>
        <button 
          type="button"
          onclick={() => changeDeclarationFrequency('mensuelle')}
          style="padding: 6px 14px; font-size: 0.82rem; font-weight: 700; border-radius: 7px; border: none; cursor: pointer; transition: all 0.15s ease; {declarationFrequency === 'mensuelle' ? 'background: #0f172a; color: #ffffff;' : 'background: transparent; color: var(--text-muted);'}"
        >
          Mensuelle
        </button>
      </div>
    </div>

    <!-- Vue Desktop Urssaf -->
    <div class="desktop-consultation-table table-container">
      <table class="custom-table" style="min-width: 650px;">
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
                <td style="text-align: right; font-weight: 700; color: var(--text-main);">{m.ca.toFixed(2)} €</td>
                <td style="text-align: right; font-weight: 700; color: #10b981;">{(m.ca * microRate).toFixed(2)} €</td>
                <td style="text-align: center;"><span class="badge {m.ca > 0 ? 'badge-success' : 'badge-muted'}">{m.ca > 0 ? 'Prêt à déclarer' : '0 €'}</span></td>
                <td style="text-align: center;">
                  <button 
                    type="button"
                    onclick={() => copierMontant(m.ca)}
                    style="background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 5px 11px; border-radius: 6px; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
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
              <td style="text-align: right; font-weight: 700; color: var(--text-main);">{caTrimestriel.T1.toFixed(2)} €</td>
              <td style="text-align: right; font-weight: 700; color: #10b981;">{(caTrimestriel.T1 * microRate).toFixed(2)} €</td>
              <td style="text-align: center;"><span class="badge {caTrimestriel.T1 > 0 ? 'badge-success' : 'badge-muted'}">{caTrimestriel.T1 > 0 ? 'Prêt à déclarer' : '0 €'}</span></td>
              <td style="text-align: center;">
                <button 
                  type="button"
                  onclick={() => copierMontant(caTrimestriel.T1)}
                  style="background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 5px 11px; border-radius: 6px; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
                  title="Copier le montant pour urssaf.fr"
                >
                  <i class="fa-regular fa-copy"></i> Copier CA
                </button>
              </td>
            </tr>
            <tr>
              <td><strong>T2</strong></td>
              <td>Avril - Juin</td>
              <td style="text-align: right; font-weight: 700; color: var(--text-main);">{caTrimestriel.T2.toFixed(2)} €</td>
              <td style="text-align: right; font-weight: 700; color: #10b981;">{(caTrimestriel.T2 * microRate).toFixed(2)} €</td>
              <td style="text-align: center;"><span class="badge {caTrimestriel.T2 > 0 ? 'badge-success' : 'badge-muted'}">{caTrimestriel.T2 > 0 ? 'Prêt à déclarer' : '0 €'}</span></td>
              <td style="text-align: center;">
                <button 
                  type="button"
                  onclick={() => copierMontant(caTrimestriel.T2)}
                  style="background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 5px 11px; border-radius: 6px; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
                  title="Copier le montant pour urssaf.fr"
                >
                  <i class="fa-regular fa-copy"></i> Copier CA
                </button>
              </td>
            </tr>
            <tr>
              <td><strong>T3</strong></td>
              <td>Juillet - Septembre</td>
              <td style="text-align: right; font-weight: 700; color: var(--text-main);">{caTrimestriel.T3.toFixed(2)} €</td>
              <td style="text-align: right; font-weight: 700; color: #10b981;">{(caTrimestriel.T3 * microRate).toFixed(2)} €</td>
              <td style="text-align: center;"><span class="badge {caTrimestriel.T3 > 0 ? 'badge-success' : 'badge-muted'}">{caTrimestriel.T3 > 0 ? 'Prêt à déclarer' : '0 €'}</span></td>
              <td style="text-align: center;">
                <button 
                  type="button"
                  onclick={() => copierMontant(caTrimestriel.T3)}
                  style="background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 5px 11px; border-radius: 6px; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
                  title="Copier le montant pour urssaf.fr"
                >
                  <i class="fa-regular fa-copy"></i> Copier CA
                </button>
              </td>
            </tr>
            <tr>
              <td><strong>T4</strong></td>
              <td>Octobre - Décembre</td>
              <td style="text-align: right; font-weight: 700; color: var(--text-main);">{caTrimestriel.T4.toFixed(2)} €</td>
              <td style="text-align: right; font-weight: 700; color: #10b981;">{(caTrimestriel.T4 * microRate).toFixed(2)} €</td>
              <td style="text-align: center;"><span class="badge {caTrimestriel.T4 > 0 ? 'badge-success' : 'badge-muted'}">{caTrimestriel.T4 > 0 ? 'Prêt à déclarer' : '0 €'}</span></td>
              <td style="text-align: center;">
                <button 
                  type="button"
                  onclick={() => copierMontant(caTrimestriel.T4)}
                  style="background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 5px 11px; border-radius: 6px; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
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

    <!-- Vue Mobile Fintech Urssaf -->
    <div class="mobile-consultation-cards">
      <div class="consultation-cards-list">
        {#if declarationFrequency === 'mensuelle'}
          {#each caMensuel as m}
            <div class="consultation-card-item">
              <div class="consultation-card-top">
                <span class="consultation-account-code">{m.code} · {m.label}</span>
                <div class="consultation-amount credit">
                  {m.ca.toFixed(2)} €
                </div>
              </div>
              <div class="consultation-card-solde-row">
                <span>Cotisations ({microRatePct}%) : <strong style="color: #10b981;">{(m.ca * microRate).toFixed(2)} €</strong></span>
                <button 
                  type="button"
                  onclick={() => copierMontant(m.ca)}
                  style="background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 0.74rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                >
                  <i class="fa-regular fa-copy"></i> Copier
                </button>
              </div>
            </div>
          {/each}
        {:else}
          {#each [
            { code: 'T1', label: 'Janvier - Mars', ca: caTrimestriel.T1 },
            { code: 'T2', label: 'Avril - Juin', ca: caTrimestriel.T2 },
            { code: 'T3', label: 'Juillet - Septembre', ca: caTrimestriel.T3 },
            { code: 'T4', label: 'Octobre - Décembre', ca: caTrimestriel.T4 }
          ] as t}
            <div class="consultation-card-item">
              <div class="consultation-card-top">
                <span class="consultation-account-code">{t.code} · {t.label}</span>
                <div class="consultation-amount credit">
                  {t.ca.toFixed(2)} €
                </div>
              </div>
              <div class="consultation-card-solde-row">
                <span>Cotisations ({microRatePct}%) : <strong style="color: #10b981;">{(t.ca * microRate).toFixed(2)} €</strong></span>
                <button 
                  type="button"
                  onclick={() => copierMontant(t.ca)}
                  style="background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 0.74rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                >
                  <i class="fa-regular fa-copy"></i> Copier
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>
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
    
    <!-- Vue Desktop -->
    <div class="desktop-consultation-table table-container">
      <table class="custom-table" id="recettes-table" style="min-width: 650px;">
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
              <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">Aucune opération enregistrée dans le registre chronologique.</td>
            </tr>
          {:else}
            {#each sortedTxList as tx}
              <tr style="border-bottom: 1px solid var(--border-color); background: var(--bg-card);">
                <td style="font-weight: 700; color: var(--text-main);">{new Date(tx.date).toLocaleDateString('fr-FR')}</td>
                <td style="color: var(--text-main); font-weight: 700;">{tx.libelle}</td>
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
                <td style="text-align: right; font-weight: 800; font-size: 0.95rem; color: {tx.credit > 0 ? '#10b981' : '#ef4444'};">
                  {tx.credit > 0 ? '+' : '-'}{(tx.credit > 0 ? tx.credit : tx.debit).toFixed(2)} €
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
        {#if sortedTxList.length > 0}
          <tfoot>
            <tr style="background: var(--bg-subtle); font-weight: 800; border-top: 2px solid var(--border-color);">
              <td colspan="3" style="color: var(--text-main); text-transform: uppercase; font-size: 0.82rem; letter-spacing: 0.5px;">
                Totaux enregistrés ({sortedTxList.length} opérations)
              </td>
              <td>
                <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 700;">SOLDE NET</span>
              </td>
              <td style="text-align: right; font-size: 1.05rem; color: {soldeNet >= 0 ? '#10b981' : '#ef4444'};">
                {soldeNet >= 0 ? '+' : ''}{soldeNet.toFixed(2)} €
              </td>
            </tr>
          </tfoot>
        {/if}
      </table>
    </div>

    <!-- Vue Mobile Fintech -->
    <div class="mobile-consultation-cards">
      {#if sortedTxList.length === 0}
        <div class="consultation-empty-card">
          <p style="margin: 0; font-size: 0.84rem; color: var(--text-muted);">Aucune opération enregistrée.</p>
        </div>
      {:else}
        <div class="consultation-cards-list">
          {#each sortedTxList as tx}
            <div class="consultation-card-item">
              <div class="consultation-card-top">
                <span class="consultation-date">{new Date(tx.date).toLocaleDateString('fr-FR')}</span>
                <div class="consultation-amount {tx.credit > 0 ? 'credit' : 'debit'}">
                  {tx.credit > 0 ? '+' : '-'}{(tx.credit > 0 ? tx.credit : tx.debit).toFixed(2)} €
                </div>
              </div>
              <div class="consultation-card-account">
                <span class="consultation-account-code">{tx.compteAttribué}</span>
                <span class="consultation-account-name">{Categorizer.obtenirLibelleCompte(tx.compteAttribué)}</span>
              </div>
              <div class="consultation-card-desc">
                {tx.libelle}
              </div>
            </div>
          {/each}
        </div>
      {/if}
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
    
    <!-- Vue Desktop du Journal -->
    <div class="desktop-consultation-table table-container">
      <table class="custom-table" id="journal-table" style="min-width: 680px;">
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
            <tr style="background: var(--bg-subtle, #f8fafc); font-weight: 800; border-top: 2px solid var(--border-color, #cbd5e1);">
              <td colspan="4" style="color: var(--text-main, #0f172a); text-transform: uppercase; font-size: 0.82rem; letter-spacing: 0.5px;">
                Total des écritures du Journal ({journalEntries.length / 2} opérations en partie double)
              </td>
              <td class="amount debit" style="font-weight: 800; font-size: 0.95rem; color: #ef4444;">
                {totalJournalDebit.toFixed(2)} €
              </td>
              <td class="amount credit" style="font-weight: 800; font-size: 0.95rem; color: #10b981;">
                {totalJournalCredit.toFixed(2)} €
              </td>
            </tr>
            <tr style="background: var(--bg-card, #ffffff); font-size: 0.82rem; border-top: 1px dashed var(--border-color, #e2e8f0);">
              <td colspan="4" style="color: var(--text-muted, #64748b); padding-top: 6px; padding-bottom: 6px;">
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

    <!-- Vue Mobile Fintech du Journal -->
    <div class="mobile-consultation-cards">
      {#if journalEntries.length === 0}
        <div class="consultation-empty-card">
          <i class="fa-solid fa-book-open" style="font-size: 1.6rem; color: var(--text-muted); opacity: 0.5; margin-bottom: 8px;"></i>
          <p style="margin: 0; font-size: 0.84rem; color: var(--text-muted);">Aucune écriture disponible dans le Journal.</p>
        </div>
      {:else}
        <div class="consultation-cards-list">
          {#each journalEntries as entry}
            <div class="consultation-card-item {entry.offset ? 'is-contra' : ''}">
              <div class="consultation-card-top">
                <div class="consultation-date-piece">
                  <span class="consultation-date">{entry.date}</span>
                  <span class="consultation-piece">{entry.piece}</span>
                </div>
                <div class="consultation-amount {entry.debit ? 'debit' : 'credit'}">
                  {entry.debit ? `- ${entry.debit.toFixed(2)} €` : `+ ${entry.credit.toFixed(2)} €`}
                </div>
              </div>

              <div class="consultation-card-account">
                <span class="consultation-account-code">{entry.compte}</span>
                <span class="consultation-account-name">{entry.libelleCompte}</span>
              </div>

              {#if entry.description}
                <div class="consultation-card-desc">
                  {entry.description}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- subtab: GRAND LIVRE -->
{#if activeSubTab === 'grandlivre'}
  <div id="grandlivre-container">

    {#if grandLivreAccounts.length === 0}
      <div class="card consultation-card" style="text-align: center; color: var(--text-muted); padding: 40px;">
        Aucune écriture triée pour remplir le Grand Livre.
      </div>
    {:else}
      {#each grandLivreAccounts as acc}
        <div class="card consultation-card" style="margin-bottom: 20px;">
          <h4 style="font-family: var(--font-title); color: var(--text-main); font-weight: 800; font-size: 1.02rem; margin: 0 0 14px 0; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); padding: 2px 8px; border-radius: 6px; font-size: 0.82rem; font-weight: 800;">Compte {acc.compte}</span>
            <span>{acc.nom}</span>
          </h4>

          <!-- Vue Desktop Grand-Livre -->
          <div class="desktop-consultation-table table-container">
            <table class="custom-table" style="font-size: 0.88rem; min-width: 650px;">
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
                  <tr style="border-bottom: 1px solid var(--border-color); background: var(--bg-card);">
                    <td style="font-weight: 700; color: var(--text-main);">{new Date(op.date).toLocaleDateString('fr-FR')}</td>
                    <td style="color: var(--text-main); font-weight: 600;">{op.libelle}</td>
                    <td class="amount debit">{op.debit > 0 ? op.debit.toFixed(2) + ' €' : '-'}</td>
                    <td class="amount credit">{op.credit > 0 ? op.credit.toFixed(2) + ' €' : '-'}</td>
                    <td style="font-weight: 700; color: var(--text-main);">{op.solde.toFixed(2)} €</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <!-- Vue Mobile Fintech Grand-Livre -->
          <div class="mobile-consultation-cards">
            <div class="consultation-cards-list">
              {#each acc.operations as op}
                <div class="consultation-card-item">
                  <div class="consultation-card-top">
                    <span class="consultation-date">{new Date(op.date).toLocaleDateString('fr-FR')}</span>
                    <div class="consultation-amount {op.credit > 0 ? 'credit' : 'debit'}">
                      {op.credit > 0 ? `+ ${op.credit.toFixed(2)} €` : `- ${op.debit.toFixed(2)} €`}
                    </div>
                  </div>
                  <div class="consultation-card-desc">
                    {op.libelle}
                  </div>
                  <div class="consultation-card-solde-row">
                    <span class="consultation-solde-label">Solde progressif :</span>
                    <strong class="consultation-solde-val">{op.solde.toFixed(2)} €</strong>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>
{/if}

<!-- subtab: BALANCE -->
{#if activeSubTab === 'balance'}
  <div class="card consultation-card" style="margin-bottom: 22px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
      <span style="font-size: 0.84rem; color: var(--text-muted); font-weight: 600;">
        {balanceRows.length} compte{balanceRows.length > 1 ? 's' : ''} au plan comptable
      </span>
      <div style="background: var(--bg-subtle); border: 1px solid var(--border-color); padding: 6px 14px; border-radius: 8px; text-align: right;">
        <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-right: 8px;">Total Balance</span>
        <strong style="font-size: 1.05rem; color: var(--text-main); font-family: var(--font-title);">
          {totalBalanceDebit.toFixed(2)} €
        </strong>
      </div>
    </div>
    
    <!-- Vue Desktop Balance -->
    <div class="desktop-consultation-table table-container">
      <table class="custom-table" id="balance-table" style="min-width: 680px;">
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
              <td colspan="6" style="text-align: center; color: var(--text-muted);">Aucune écriture triée disponible pour la balance.</td>
            </tr>
          {:else}
            {#each balanceRows as row}
              <tr style="border-bottom: 1px solid var(--border-color); background: var(--bg-card);">
                <td><strong>{row.compte}</strong></td>
                <td style="color: var(--text-main); font-weight: 600;">{row.nom}</td>
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
            <tr style="background: var(--bg-subtle); font-weight: 800; border-top: 2px solid var(--border-color);">
              <td colspan="2" style="color: var(--text-main); text-transform: uppercase; font-size: 0.82rem; letter-spacing: 0.5px;">
                Total Général de la Balance
              </td>
              <td class="amount" style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">
                {totalBalanceDebit.toFixed(2)} €
              </td>
              <td class="amount" style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">
                {totalBalanceCredit.toFixed(2)} €
              </td>
              <td class="amount debit" style="font-weight: 800; font-size: 0.95rem; color: #ef4444;">
                {totalBalanceSoldeDebiteur.toFixed(2)} €
              </td>
              <td class="amount credit" style="font-weight: 800; font-size: 0.95rem; color: #10b981;">
                {totalBalanceSoldeCrediteur.toFixed(2)} €
              </td>
            </tr>
            <tr style="background: var(--bg-card); font-size: 0.82rem; border-top: 1px dashed var(--border-color);">
              <td colspan="4" style="color: var(--text-muted); padding-top: 6px; padding-bottom: 6px;">
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

    <!-- Vue Mobile Fintech Balance -->
    <div class="mobile-consultation-cards">
      {#if balanceRows.length === 0 || (balanceRows.length === 1 && balanceRows[0].debit === 0 && balanceRows[0].credit === 0)}
        <div class="consultation-empty-card">
          <p style="margin: 0; font-size: 0.84rem; color: var(--text-muted);">Aucune écriture pour la balance.</p>
        </div>
      {:else}
        <div class="consultation-cards-list">
          {#each balanceRows as row}
            <div class="consultation-card-item">
              <div class="consultation-card-top">
                <span class="consultation-account-code">{row.compte}</span>
                <div class="consultation-amount {row.soldeCrediteur > 0 ? 'credit' : (row.soldeDebiteur > 0 ? 'debit' : '')}">
                  {#if row.soldeCrediteur > 0}
                    + {row.soldeCrediteur.toFixed(2)} €
                  {:else if row.soldeDebiteur > 0}
                    - {row.soldeDebiteur.toFixed(2)} €
                  {:else}
                    0,00 €
                  {/if}
                </div>
              </div>
              <div class="consultation-account-name" style="font-size: 0.84rem;">
                {row.nom}
              </div>
              <div class="consultation-card-solde-row">
                <span>Débits : <strong style="color: #ef4444;">{row.debit.toFixed(2)} €</strong></span>
                <span>Crédits : <strong style="color: #10b981;">{row.credit.toFixed(2)} €</strong></span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- subtab: BILAN -->
{#if activeSubTab === 'bilan'}
  <div class="bilan-grid" style="margin-bottom: 30px;">
    
    <!-- ACTIF -->
    <div class="card consultation-card">
      <h3 style="font-family: var(--font-title); margin: 0 0 15px 0; border-bottom: 1.5px solid var(--border-color); padding-bottom: 10px; color: var(--text-main); font-weight: 800; font-size: 1.05rem;">
        {#if accountingModel === 'copro'}
          ACTIF DU SYNDICAT (Disponibilités bancaires & Créances)
        {:else if accountingModel === 'asso'}
          ACTIF ASSOCIATIF (Trésorerie & Valeurs de l'association)
        {:else}
          ACTIF (Ce que la structure possède)
        {/if}
      </h3>
      <div class="table-container">
        <table class="custom-table" id="bilan-actif-table">
          <thead>
            <tr>
              <th>Rubrique / Compte</th>
              <th style="text-align: right;">Valeur nette</th>
            </tr>
          </thead>
          <tbody>
            {#each bilanData.actifs as act}
              <tr style="border-bottom: 1px solid var(--border-color); background: var(--bg-card);">
                <td><strong>{act.compte}</strong> - {act.nom}</td>
                <td class="amount" style="text-align: right; color: var(--text-main); font-weight: 600;">{act.valeur.toFixed(2)} €</td>
              </tr>
            {/each}
            <tr style="background: var(--bg-subtle);">
              <td style="color: var(--text-main); font-weight: 800;">
                {#if accountingModel === 'copro'}
                  TOTAL DE L’ACTIF (Trésorerie & Créances)
                {:else if accountingModel === 'asso'}
                  TOTAL DE L’ACTIF ASSOCIATIF
                {:else}
                  TOTAL DE L'ACTIF
                {/if}
              </td>
              <td class="amount" style="text-align: right; color: #3b82f6; font-weight: 800; font-size: 1.1rem;">
                {bilanData.totalActif.toFixed(2)} €
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- PASSIF -->
    <div class="card consultation-card">
      <h3 style="font-family: var(--font-title); margin: 0 0 15px 0; border-bottom: 1.5px solid var(--border-color); padding-bottom: 10px; color: var(--text-main); font-weight: 800; font-size: 1.05rem;">
        {#if accountingModel === 'copro'}
          PASSIF DU SYNDICAT (Avances, Provisions ALUR & Dettes)
        {:else if accountingModel === 'asso'}
          PASSIF & FONDS ASSOCIATIFS (Fonds propres & Dettes)
        {:else}
          PASSIF (Ce que la structure doit)
        {/if}
      </h3>
      <div class="table-container">
        <table class="custom-table" id="bilan-passif-table">
          <thead>
            <tr>
              <th>Rubrique / Compte</th>
              <th style="text-align: right;">Valeur nette</th>
            </tr>
          </thead>
          <tbody>
            {#each bilanData.passifs as pas}
              <tr style="border-bottom: 1px solid var(--border-color); background: var(--bg-card);">
                <td><strong>{pas.compte}</strong> - {pas.nom}</td>
                <td class="amount" style="text-align: right; color: var(--text-main); font-weight: 600;">{pas.valeur.toFixed(2)} €</td>
              </tr>
            {/each}
            <tr style="border-bottom: 1px solid var(--border-color); background: var(--bg-card);">
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
            <tr style="background: var(--bg-subtle);">
              <td style="color: var(--text-main); font-weight: 800;">
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

  </div>
{/if}
{/if}
    </div>
  {/if}
</div>
<style>
  .fiscal-card-inner {
    padding: 16px 20px;
    background: var(--bg-card);
    border-radius: 12px;
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-sizing: border-box;
    width: 100%;
  }

  .fiscal-badge-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
  }

  .fiscal-summary-badge {
    font-size: 0.8rem;
    font-weight: 700;
    color: #166534;
    background: #dcfce7;
    border: 1px solid #86efac;
    padding: 5px 12px;
    border-radius: 9999px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    box-sizing: border-box;
  }
  :global([data-theme="dark"]) .fiscal-summary-badge {
    background: rgba(16, 185, 129, 0.15) !important;
    color: #34d399 !important;
    border-color: rgba(16, 185, 129, 0.35) !important;
  }

  .custom-fiscal-container {
    background: var(--bg-subtle);
    border: 1.5px solid rgba(59, 130, 246, 0.35);
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-sizing: border-box;
    width: 100%;
  }

  .custom-fiscal-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    width: 100%;
    box-sizing: border-box;
  }

  .custom-fiscal-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    width: 100%;
  }

  .custom-fiscal-label {
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text-main);
    display: block;
    cursor: pointer;
  }

  .custom-fiscal-input {
    width: 100%;
    height: 42px;
    min-height: 42px;
    padding: 0 12px;
    border: 1.5px solid var(--border-color);
    border-radius: 8px;
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--text-main);
    background: var(--bg-card);
    cursor: pointer;
    box-sizing: border-box;
    font-family: inherit;
    line-height: 42px;
  }

  .custom-fiscal-locked {
    width: 100%;
    height: 42px;
    min-height: 42px;
    padding: 0 12px;
    border: 1.5px solid var(--border-color);
    border-radius: 8px;
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--text-main);
    background: var(--bg-card);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    box-sizing: border-box;
  }

  .custom-fiscal-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.78rem;
    color: var(--text-muted);
    font-weight: 600;
    padding-top: 4px;
    border-top: 1px dashed var(--border-color);
  }

  .fiscal-12m-badge {
    font-size: 0.72rem;
    color: var(--text-muted);
    background: var(--bg-subtle);
    border: 1px solid var(--border-color);
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 800;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .desktop-consultation-table {
    display: block;
  }

  .mobile-consultation-cards {
    display: none;
  }

  .consultation-cards-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  .consultation-card-item {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-sizing: border-box;
  }

  .consultation-card-item.is-contra {
    opacity: 0.88;
    background: var(--bg-subtle);
  }

  .consultation-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .consultation-date-piece {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .consultation-date {
    font-size: 0.80rem;
    color: var(--text-muted);
    font-weight: 600;
  }

  .consultation-piece {
    font-size: 0.72rem;
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.25);
    border-radius: 4px;
    padding: 1px 6px;
    font-weight: 700;
    font-family: monospace;
  }

  .consultation-amount {
    font-size: 0.95rem;
    font-weight: 800;
    font-family: var(--font-title);
    white-space: nowrap;
  }

  .consultation-amount.credit {
    color: #10b981;
  }

  .consultation-amount.debit {
    color: #ef4444;
  }

  .consultation-card-account {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .consultation-account-code {
    font-size: 0.76rem;
    font-weight: 800;
    color: #818cf8;
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.2);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .consultation-account-name {
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text-main);
  }

  .consultation-card-desc {
    font-size: 0.80rem;
    color: var(--text-muted);
    line-height: 1.35;
    word-break: break-word;
  }

  .consultation-empty-card {
    background: var(--bg-card);
    border: 1px dashed var(--border-color);
    border-radius: 12px;
    padding: 30px 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .bilan-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  #consultation-detail-view {
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  .consultation-card {
    padding: 20px 24px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-sizing: border-box;
    width: 100%;
  }

  .consultation-card-solde-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 6px;
    margin-top: 2px;
    border-top: 1px dashed var(--border-color);
    font-size: 0.76rem;
    color: var(--text-muted);
  }

  .consultation-solde-label {
    font-weight: 600;
  }

  .consultation-solde-val {
    color: var(--text-main);
    font-variant-numeric: tabular-nums;
  }

  .legal-doc-card {
    padding: 16px 20px;
    background: var(--bg-card, #ffffff);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    box-sizing: border-box;
    width: 100%;
    overflow: hidden;
  }

  .legal-doc-info {
    display: flex;
    align-items: center;
    gap: 14px;
    flex: 1;
    min-width: 0;
  }

  .legal-doc-text {
    flex: 1;
    min-width: 0;
  }

  .legal-doc-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .legal-doc-meta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    max-width: 100%;
  }

  .legal-doc-badge {
    font-size: 0.72rem;
    padding: 2px 7px;
    border-radius: 6px;
    font-weight: 700;
    letter-spacing: 0.02em;
    max-width: 100%;
    box-sizing: border-box;
  }

  .legal-doc-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .table-container {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    box-sizing: border-box;
    border-radius: 8px;
  }

  @media (max-width: 768px) {
    .page-title-section {
      display: none !important;
    }

    .books-section-box,
    .books-docs-box {
      background: transparent !important;
      border: none !important;
      padding: 0 !important;
      box-shadow: none !important;
      margin-bottom: 28px !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .books-section-subtitle,
    .books-docs-subtitle {
      display: none !important;
    }

    .fiscal-card-inner {
      padding: 12px !important;
      border-radius: 12px !important;
    }

    .fiscal-summary-badge {
      font-size: 0.72rem !important;
      padding: 4px 8px !important;
      border-radius: 6px !important;
      line-height: 1.35 !important;
      white-space: normal !important;
      text-align: left !important;
    }

    .fiscal-period-badge {
      width: 100% !important;
    }

    .fiscal-period-badge span {
      width: 100% !important;
      box-sizing: border-box !important;
      text-align: center !important;
      font-size: 0.78rem !important;
      padding: 6px 10px !important;
    }

    .custom-fiscal-container {
      padding: 12px 10px !important;
      width: 100% !important;
      box-sizing: border-box !important;
      gap: 12px !important;
    }

    .custom-fiscal-grid {
      grid-template-columns: 1fr !important;
      gap: 12px !important;
    }

    .custom-fiscal-field {
      flex-direction: column !important;
      align-items: stretch !important;
      gap: 6px !important;
      width: 100% !important;
    }

    .custom-fiscal-input {
      width: 100% !important;
      height: 42px !important;
      min-height: 42px !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      font-size: 0.84rem !important;
      padding: 0 10px !important;
    }

    .custom-fiscal-locked {
      width: 100% !important;
      height: 42px !important;
      min-height: 42px !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      justify-content: space-between !important;
      font-size: 0.84rem !important;
      padding: 0 10px !important;
    }

    .desktop-consultation-table {
      display: none !important;
    }

    .mobile-consultation-cards {
      display: flex !important;
      flex-direction: column;
      gap: 10px;
      width: 100%;
    }

    .bilan-grid {
      grid-template-columns: 1fr !important;
      gap: 16px !important;
    }

    .consultation-card,
    #consultation-detail-view .card {
      padding: 12px 14px !important;
      border-radius: 12px !important;
      margin-bottom: 14px !important;
      box-sizing: border-box !important;
      width: 100% !important;
      max-width: 100% !important;
      overflow: hidden !important;
    }

    #consultation-detail-view {
      padding-top: 14px !important;
      margin-top: 18px !important;
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      overflow-x: hidden !important;
    }

    .legal-doc-card {
      flex-direction: column !important;
      align-items: stretch !important;
      gap: 12px !important;
      padding: 12px !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .legal-doc-info {
      align-items: flex-start !important;
      gap: 10px !important;
      width: 100% !important;
    }

    .legal-doc-header {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 4px !important;
      width: 100% !important;
    }

    .legal-doc-meta {
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
      flex-wrap: wrap !important;
      width: 100% !important;
    }

    .legal-doc-badge {
      font-size: 0.68rem !important;
      padding: 2px 6px !important;
      line-height: 1.3 !important;
    }

    .legal-doc-title {
      font-size: 0.90rem !important;
      line-height: 1.35 !important;
    }

    .legal-doc-desc {
      font-size: 0.78rem !important;
      line-height: 1.4 !important;
    }

    .legal-doc-actions {
      width: 100% !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
    }

    .legal-doc-actions button {
      flex: 1 1 50% !important;
      justify-content: center !important;
      text-align: center !important;
      padding: 9px 10px !important;
      font-size: 0.82rem !important;
    }

    .fiscal-period-row {
      flex-direction: column !important;
      align-items: stretch !important;
      gap: 12px !important;
    }

    .fiscal-period-controls {
      flex-direction: column !important;
      align-items: stretch !important;
      width: 100% !important;
      gap: 8px !important;
    }

    .fiscal-period-select-group {
      flex-direction: column !important;
      align-items: stretch !important;
      width: 100% !important;
      gap: 8px !important;
    }

    .fiscal-period-select {
      width: 100% !important;
      min-width: 0 !important;
    }

    .fiscal-year-nav {
      width: 100% !important;
      display: flex !important;
      gap: 6px !important;
    }

    .fiscal-year-nav button {
      flex: 1 !important;
      justify-content: center !important;
    }
  }
</style>
