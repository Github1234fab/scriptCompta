<script>
  import { 
    members, 
    updateMembers, 
    transactions, 
    updateTransactions, 
    showToast, 
    formatDateFr,
    isPremium,
    requirePremium
  } from "../lib/store.js";
  import InfoTip from "./InfoTip.svelte";

  // Deux modes : 'releve' (Journal des recettes bancaires réelles) ou 'pointage' (Suivi individuel des impayés avec forfaits)
  let displayMode = $state("releve");

  // Filtres
  let txFilter = $state("tous"); // 'tous', '756', '706', '487'
  let memberFilter = $state("tous"); // 'tous', 'payes', 'impayes'
  let searchQuery = $state("");

  // Modales & Sections
  let showImportModal = $state(false);
  let showImportSection = $state(false);
  let showDrawerModal = $state(false);
  /** @type {any} */
  let selectedMemberForDrawer = $state(null);
  let isDropHover = $state(false);
  /** @type {HTMLInputElement | null} */
  let memberFileInput = $state(null);
  /** @type {HTMLInputElement | null} */
  let memberFileInputDirect = $state(null);
  /** @type {HTMLInputElement | null} */
  let memberFileInputModal = $state(null);

  // Pagination & Vue
  let currentPage = $state(1);
  let pageSize = $state(12);
  let viewMode = $state("pagination"); // 'pagination' (Feuillets) ou 'scroll' (Vue globale)

  // 1. EXTRACTION DE TOUTES LES RECETTES ASSOCIATIVES (756, 706, 487)
  let allAssoTransactions = $derived.by(() => {
    return $transactions
      .filter((/** @type {any} */ t) => {
        const cpt = String(t.compteAttribué || t.compteCredit || t.compte || t.account || "").trim();
        const isEligible = cpt === "756" || cpt === "706" || cpt.startsWith("706") || cpt === "487";
        return isEligible && Number(t.credit) > 0;
      })
      .slice()
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  });

  // Métriques financières réelles de la banque
  let totalRecettes756 = $derived(
    allAssoTransactions
      .filter(t => (t.compteAttribué || t.compteCredit || t.compte || t.account) === "756")
      .reduce((sum, t) => sum + (parseFloat(t.credit) || 0), 0)
  );

  let totalRecettes706 = $derived(
    allAssoTransactions
      .filter(t => {
        const c = String(t.compteAttribué || t.compteCredit || t.compte || t.account || "");
        return c === "706" || c.startsWith("706");
      })
      .reduce((sum, t) => sum + (parseFloat(t.credit) || 0), 0)
  );

  let totalRecettes487 = $derived(
    allAssoTransactions
      .filter(t => (t.compteAttribué || t.compteCredit || t.compte || t.account) === "487")
      .reduce((sum, t) => sum + (parseFloat(t.credit) || 0), 0)
  );

  let totalGlobalRecettes = $derived(totalRecettes756 + totalRecettes706);

  let countTx756 = $derived(
    allAssoTransactions.filter(t => (t.compteAttribué || t.compteCredit || t.compte || t.account) === "756").length
  );
  let countTx706 = $derived(
    allAssoTransactions.filter(t => {
      const c = String(t.compteAttribué || t.compteCredit || t.compte || t.account || "");
      return c === "706" || c.startsWith("706");
    }).length
  );
  let countTx487 = $derived(
    allAssoTransactions.filter(t => (t.compteAttribué || t.compteCredit || t.compte || t.account) === "487").length
  );

  // Filtrage du relevé bancaire
  let filteredTransactions = $derived.by(() => {
    return allAssoTransactions.filter(t => {
      const cpt = String(t.compteAttribué || t.compteCredit || t.compte || t.account || "");
      if (txFilter === "756" && cpt !== "756") return false;
      if (txFilter === "706" && !(cpt === "706" || cpt.startsWith("706"))) return false;
      if (txFilter === "487" && cpt !== "487") return false;

      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase().trim();
        const libelle = String(t.libelle || "").toLowerCase();
        const emetteur = String(t.associatedMember || "").toLowerCase();
        return libelle.includes(q) || emetteur.includes(q);
      }
      return true;
    });
  });

  // Pagination des transactions
  let totalTxPages = $derived(Math.ceil(filteredTransactions.length / pageSize) || 1);
  let paginatedTransactions = $derived(
    filteredTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  );
  let displayedTransactions = $derived(
    viewMode === "pagination" ? paginatedTransactions : filteredTransactions
  );

  // 2. NETTOYAGE DES NOMS ET LOGIQUE POINTAGE INDIVIDUEL (SI ACTIVÉ)
  const GENERIC_BANK_WORDS = new Set([
    "remise", "europrelevement", "virement", "vir", "inst", "prlvt", "cotisation", 
    "cours", "stage", "inscription", "adherent", "melle", "madame", "monsieur", 
    "mr", "mme", "mille", "paypal", "stripe", "cheque", "especes", "prelevement",
    "sepa", "ref", "num", "piano", "009gugn", "w5z3d2u", "bipt262470301597828"
  ]);

  /** @param {string} [rawName] */
  function cleanMemberName(rawName) {
    if (!rawName) return "Adhérent Inconnu";
    let text = rawName.trim();
    if (text.includes("|")) {
      const parts = text.split("|").map(p => p.trim());
      let namePart = parts.find(p => !/^[A-Z0-9]{4,25}$/.test(p) && !/REMISE|EUROPRELEVEMENT|INST\s+MELLE/i.test(p));
      if (!namePart) {
        namePart = parts.find(p => /^[a-zA-Z\s]+$/.test(p.replace(/INST|MELLE|VIR|COTISATION/gi, '').trim()));
      }
      if (!namePart) namePart = parts[parts.length - 1] || text;
      text = namePart;
    }

    // Isoler l'entité propre avant le tiret (ex: Rose Trujillo - Virement... -> Rose Trujillo)
    if (/[-–—]/.test(text)) {
      const p = text.split(/\s*[-–—]\s*/);
      if (p.length >= 2) {
        if (/^(?:vir|prlv|virement|prelevement|cotis|adh|paiement|cb|sepa|achat|don)\b/i.test(p[1]) || p[0].length >= 3) {
          text = p[0].trim();
        } else if (/^(?:vir|prlv|virement|prelevement)\b/i.test(p[0]) && p[1].length >= 3) {
          text = p[1].trim();
        }
      }
    }

    text = text
      .replace(/^INST\s+/i, "")
      .replace(/^VIR(EMENT)?\s+/gi, "")
      .replace(/REMISE\s+EUROPRELEVEMENT/gi, "")
      .replace(/COTISATION|COURS|STAGE|ADHERENT|2025|2026/gi, "")
      .replace(/C-Inscription.*$/i, "")
      .replace(/\b[A-Z0-9]{6,30}\b/g, "")
      .trim();

    text = text.replace(/([a-z])([A-Z])/g, "$1 $2");
    return text || rawName;
  }

  // KPIs et liste pour le mode Pointage adhérents
  let report = $derived.by(() => {
    return ($members || []).map((/** @type {any} */ m) => {
      const resteAPayer = Math.max(0, (m.forfait || 0) - (m.dejaPaye || 0));
      let statut = "PAYÉ";
      let badgeClass = "badge-success";

      if (resteAPayer > 0) {
        statut = m.dejaPaye > 0 ? "PARTIEL" : "IMPAYÉ";
        badgeClass = m.dejaPaye > 0 ? "badge-warning" : "badge-danger";
      } else if (m.dejaPaye > m.forfait && m.forfait > 0) {
        statut = "TROP PERÇU";
        badgeClass = "badge-muted";
      }

      return {
        ...m,
        cleanName: cleanMemberName(m.nom),
        resteAPayer,
        statut,
        badgeClass
      };
    });
  });

  let kpiTotalAttendu = $derived(report.reduce((sum, m) => sum + (m.forfait || 0), 0));
  let kpiTotalEncaissePointage = $derived(report.reduce((sum, m) => sum + (m.dejaPaye || 0), 0));
  let kpiRestant = $derived(report.reduce((sum, m) => sum + (m.resteAPayer || 0), 0));
  let kpiImpayesCount = $derived(report.filter(m => m.resteAPayer > 0).length);

  let filteredMembers = $derived(report.filter((/** @type {any} */ m) => {
    const matchesSearch = searchQuery.trim() === "" || 
      m.cleanName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      String(m.nom).toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (memberFilter === "payes") return m.resteAPayer === 0;
    if (memberFilter === "impayes") return m.resteAPayer > 0;
    return true;
  }));

  let totalMemberPages = $derived(Math.ceil(filteredMembers.length / pageSize) || 1);
  let paginatedMembers = $derived(
    filteredMembers.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  );
  let displayedMembers = $derived(
    viewMode === "pagination" ? paginatedMembers : filteredMembers
  );

  // Réinitialisation de la page lors du changement de filtre
  $effect(() => {
    searchQuery;
    txFilter;
    memberFilter;
    displayMode;
    currentPage = 1;
  });

  // 3. ACTIONS DE REPORT EN COMPTE 487 (PRODUITS CONSTATÉS D'AVANCE)
  /** @param {string} txId */
  function basculerVers487(txId) {
    const txList = [...$transactions];
    const idx = txList.findIndex(t => t.id === txId);
    if (idx >= 0) {
      const currentCpt = txList[idx].compteAttribué || txList[idx].compteCredit || txList[idx].compte || txList[idx].account || "706";
      txList[idx] = {
        ...txList[idx],
        originalCompteRecette: currentCpt,
        compteAttribué: "487",
        compteCredit: "487",
        compte: "487",
        account: "487"
      };
      updateTransactions(txList);
      showToast("Opération reportée sur l'exercice suivant (Compte 487) !");
    }
  }

  /** @param {string} txId */
  function retablirCompteRecette(txId) {
    const txList = [...$transactions];
    const idx = txList.findIndex(t => t.id === txId);
    if (idx >= 0) {
      const restored = txList[idx].originalCompteRecette || "706";
      txList[idx] = {
        ...txList[idx],
        compteAttribué: restored,
        compteCredit: restored,
        compte: restored,
        account: restored
      };
      delete txList[idx].originalCompteRecette;
      updateTransactions(txList);
      showToast(`Opération rétablie en compte ${restored} !`);
    }
  }

  // 4. EXPORT CSV DU RELEVÉ OU DU REGISTRE
  function exporterCSV() {
    if (!requirePremium("L'export CSV des règlements et adhérents")) return;
    let csvContent = "";
    let fileName = "";

    if (displayMode === "releve") {
      fileName = `releve_recettes_756_706_${new Date().toISOString().slice(0, 10)}.csv`;
      const header = ["Date", "Compte", "Libelle", "Emetteur_Detecte", "Montant_Credit_EUR", "Statut_Exercice"].join(";");
      const rows = filteredTransactions.map(t => {
        const cpt = t.compteAttribué || t.compteCredit || t.compte || t.account || "706";
        const statut = cpt === "487" ? "Reporté exercice suivant (487)" : "Recette exercice courant";
        const cleanName = cleanMemberName(t.libelle);
        return [
          t.date || "",
          cpt,
          `"${(t.libelle || "").replace(/"/g, '""')}"`,
          `"${cleanName.replace(/"/g, '""')}"`,
          Number(t.credit || 0).toFixed(2).replace(".", ","),
          statut
        ].join(";");
      });
      csvContent = "\uFEFF" + [header, ...rows].join("\r\n");
    } else {
      fileName = `suivi_adherents_${new Date().toISOString().slice(0, 10)}.csv`;
      const header = ["Nom_Adherent", "Forfait_Attendu_EUR", "Deja_Verse_EUR", "Reste_A_Payer_EUR", "Statut"].join(";");
      const rows = filteredMembers.map(m => {
        return [
          `"${m.cleanName.replace(/"/g, '""')}"`,
          Number(m.forfait || 0).toFixed(2).replace(".", ","),
          Number(m.dejaPaye || 0).toFixed(2).replace(".", ","),
          Number(m.resteAPayer || 0).toFixed(2).replace(".", ","),
          m.statut
        ].join(";");
      });
      csvContent = "\uFEFF" + [header, ...rows].join("\r\n");
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Export CSV téléchargé (${fileName}) !`);
  }

  // 5. IMPORT CSV POUR LE SUIVI DES TARIFS ANNUELS
  let importFileName = $state("");
  let rawPasteText = $state("");
  /** @type {Array<{nom: string, forfait: number}>} */
  let importedRows = $state([]);

  function telechargerModeleCSV() {
    const csvContent = "Nom de l'adherent ou eleve;Tarif annuel attendu\nDupont Marc;450.00\nMartin Sophie;600.00\nPetit Thomas;320.00\n";
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "modele_fichier_temoin_cotisations.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Modèle CSV témoin téléchargé !");
  }

  let isImporting = $state(false);

  /** @param {any} e */
  function handleFileSelect(e) {
    const file = e.target?.files?.[0] || e.dataTransfer?.files?.[0];
    if (!file) return;
    importFileName = file.name;
    isImporting = true;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setTimeout(() => {
        try {
          parseCSVMembers(/** @type {string} */ (evt.target?.result || ""));
        } finally {
          isImporting = false;
        }
      }, 150);
    };
    reader.onerror = () => {
      isImporting = false;
      showToast("Impossible de lire ce fichier.");
    };
    reader.readAsText(file, "UTF-8");
    if (e.target) e.target.value = "";
  }

  /** @param {any} e */
  function handleFileSelectDirect(e) {
    const file = e.target?.files?.[0] || e.dataTransfer?.files?.[0];
    if (!file) return;
    importFileName = file.name;
    isImporting = true;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setTimeout(() => {
        try {
          const text = /** @type {string} */ (evt.target?.result || "");
          parseCSVMembers(text);
          if (importedRows.length > 0) {
            validerImportTarifs();
          } else {
            showToast("Aucun adhérent ou montant valide détecté dans ce fichier.");
          }
        } catch (err) {
          console.error("Erreur lors de l'import CSV :", err);
          showToast("Erreur lors de la lecture du fichier témoin.");
        } finally {
          isImporting = false;
        }
      }, 200);
    };
    reader.onerror = () => {
      isImporting = false;
      showToast("Impossible de lire ce fichier.");
    };
    reader.readAsText(file, "UTF-8");
    if (e.target) e.target.value = "";
  }

  /** @param {string} csvText */
  function parseCSVMembers(csvText) {
    rawPasteText = csvText;
    if (!csvText) {
      importedRows = [];
      return;
    }
    const cleanText = csvText.replace(/^\uFEFF/, "");
    const lines = cleanText.split(/\r\n|\r|\n/);

    // 1. Détection dynamique du séparateur (; , \t)
    let semiCount = 0, commaCount = 0, tabCount = 0;
    for (const l of lines.slice(0, 30)) {
      semiCount += (l.match(/;/g) || []).length;
      commaCount += (l.match(/,/g) || []).length;
      tabCount += (l.match(/\t/g) || []).length;
    }
    const sep = semiCount >= commaCount && semiCount >= tabCount ? ";" : (tabCount >= commaCount ? "\t" : ",");

    // 2. Détection de la ligne d'en-tête et des colonnes (Nom et Montant/Tarif)
    let headerIdx = -1;
    let nameColIdx = -1;
    let amountColIdx = -1;

    const nameKeywords = ["nom", "eleve", "élève", "adherent", "adhérent", "membre", "personne", "etudiant", "étudiant", "participant"];
    const amountKeywords = ["montant", "total", "tarif", "forfait", "prix", "cotisation", "du", "dû", "attendu", "somme"];

    for (let i = 0; i < Math.min(lines.length, 25); i++) {
      const rawCells = lines[i].split(sep).map(c => c.trim().replace(/^["\x27]|["\x27]$/g, ""));
      let foundName = -1;
      let foundAmount = -1;
      rawCells.forEach((cell, idx) => {
        const lower = cell.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (foundName === -1 && nameKeywords.some(kw => lower.includes(kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) {
          foundName = idx;
        }
        if (foundAmount === -1 && amountKeywords.some(kw => lower.includes(kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) {
          foundAmount = idx;
        }
      });
      if (foundName !== -1) {
        headerIdx = i;
        nameColIdx = foundName;
        amountColIdx = foundAmount !== -1 ? foundAmount : (foundName === 0 ? 1 : foundName + 1);
        break;
      }
    }

    // 3. Heuristique si aucun mot-clé d'en-tête n'est trouvé
    if (nameColIdx === -1) {
      for (let i = 0; i < lines.length; i++) {
        const cells = lines[i].split(sep).map(c => c.trim().replace(/^["\x27]|["\x27]$/g, ""));
        const nonEmpty = cells.map((c, idx) => ({ c, idx })).filter(x => x.c.length > 0);
        if (nonEmpty.length >= 2) {
          const textCell = nonEmpty.find(x => /[a-zA-Z\u00C0-\u017F]/.test(x.c) && !/^[\d\s,.\u20AC]+$/.test(x.c));
          const numCell = nonEmpty.find(x => /^[\d\s,.\u20AC]+$/.test(x.c));
          if (textCell && numCell) {
            nameColIdx = textCell.idx;
            amountColIdx = numCell.idx;
            headerIdx = i - 1;
            break;
          }
        }
      }
    }

    if (nameColIdx === -1) nameColIdx = 0;
    if (amountColIdx === -1) amountColIdx = 1;

    // 4. Extraction des lignes de données
    const rows = [];
    const startLine = headerIdx >= 0 ? headerIdx + 1 : 0;
    let emptyRowCount = 0;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        emptyRowCount++;
        if (rows.length > 0 && emptyRowCount >= 5) break;
        continue;
      }
      const parts = lines[i].split(sep).map(c => c.trim().replace(/^["\x27]|["\x27]$/g, ""));
      const rawName = parts[nameColIdx] || "";
      const rawAmount = parts[amountColIdx] || "";

      // Si on rencontre la ligne de total de fin de tableau (nom vide mais montant présent, ou mot-clé total)
      if (!rawName && rawAmount && rows.length > 0) {
        break;
      }
      if (/^(total|sous-total|total g.n.ral|recapitulatif)$/i.test(rawName)) {
        break;
      }

      if (!rawName) {
        emptyRowCount++;
        if (rows.length > 0 && emptyRowCount >= 5) break;
        continue;
      }
      emptyRowCount = 0;

      if (/^\d+([,.]\d+)?$/.test(rawName)) continue;

      const cleanAmount = parseFloat(rawAmount.replace(/\s/g, "").replace(",", ".").replace(/[^0-9.-]/g, "")) || 0;
      rows.push({ nom: rawName, forfait: cleanAmount });
    }

    importedRows = rows;
  }

  function validerImportTarifs() {
    if (importedRows.length === 0) {
      showToast("Veuillez sélectionner ou coller une liste valide.");
      return;
    }

    // 1. Calculer la somme des règlements bancaires pour chaque nom unique présent dans le fichier
    const uniqueNames = Array.from(new Set(importedRows.map(r => r.nom.toLowerCase().trim())));
    /** @type {Record<string, number>} */
    const totalPaymentsByName = {};
    uniqueNames.forEach(uniqueName => {
      const matchingTx = allAssoTransactions.filter(t => {
        const cleanTx = cleanMemberName(t.libelle).toLowerCase();
        return cleanTx.includes(uniqueName) || uniqueName.includes(cleanTx);
      });
      totalPaymentsByName[uniqueName] = matchingTx.reduce((sum, t) => sum + (parseFloat(t.credit) || 0), 0);
    });

    // 2. Répartition progressive des règlements pour préserver l'ensemble des élèves sans double comptage
    const remainingPayments = { ...totalPaymentsByName };
    /** @type {Record<string, number>} */
    const nameCounts = {};
    importedRows.forEach(r => {
      const k = r.nom.toLowerCase().trim();
      nameCounts[k] = (nameCounts[k] || 0) + 1;
    });
    /** @type {Record<string, number>} */
    const nameSeen = {};

    const newMembers = importedRows.map((row, idx) => {
      const cleanNom = row.nom.trim();
      const key = cleanNom.toLowerCase();
      nameSeen[key] = (nameSeen[key] || 0) + 1;
      const isLastOfName = nameSeen[key] === nameCounts[key];

      const available = remainingPayments[key] || 0;
      let allocated = 0;
      if (isLastOfName) {
        // La dernière occurrence de ce nom reçoit le solde restant (y compris éventuel trop-perçu)
        allocated = available;
        remainingPayments[key] = 0;
      } else {
        allocated = Math.min(row.forfait, available);
        remainingPayments[key] = Math.max(0, available - allocated);
      }

      return {
        id: Date.now() + idx + Math.random(),
        nom: cleanNom,
        forfait: row.forfait,
        dejaPaye: allocated,
        email: cleanNom.toLowerCase().replace(/\s+/g, ".") + "@email.com"
      };
    });

    updateMembers(newMembers);
    showImportModal = false;
    showImportSection = false;
    displayMode = "pointage";
    showToast(`${newMembers.length} élèves importés avec succès ! Rapprochement activé.`);
  }

  function supprimerFichierAdherents() {
    const totalAdherents = $members.length;
    const msg = totalAdherents > 0
      ? `Voulez-vous vraiment supprimer les ${totalAdherents} adhérents du fichier témoin et réinitialiser le pointage ?`
      : "Voulez-vous réinitialiser le fichier témoin ?";
    if (confirm(msg)) {
      updateMembers([]);
      importedRows = [];
      importFileName = "";
      rawPasteText = "";
      showImportSection = false;
      displayMode = "releve";
      showToast("Fichier témoin supprimé avec succès.");
    }
  }
</script>

<style>
  .kpi-box {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    border-radius: 14px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 8px;
    min-height: 84px;
    box-sizing: border-box;
  }
  .kpi-box-title {
    font-size: 0.80rem;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: -0.01em;
    display: flex;
    align-items: center;
    justify-content: space-between;
    line-height: 1.25;
  }
  .kpi-box-value {
    font-size: 1.18rem;
    font-weight: 800;
    color: var(--text-main);
    font-family: var(--font-title, sans-serif);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.3px;
    line-height: 1.2;
    white-space: nowrap;
  }
  .kpi-box-sub {
    font-size: 0.74rem;
    color: var(--text-muted);
    margin-top: 2px;
    line-height: 1.3;
  }
  .table-row-hover:hover {
    background: var(--bg-card-hover) !important;
  }
  .members-kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 12px;
  }
  .members-mode-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
    gap: 14px;
    margin-bottom: 22px;
  }
  .members-witness-kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px dashed var(--border-color);
  }
  .members-content-card {
    background: var(--bg-card);
    border: 1.5px solid var(--border-color);
    border-radius: 16px;
    padding: 24px;
    box-shadow: var(--shadow-sm);
    box-sizing: border-box;
    width: 100%;
  }
  .witness-active-banner {
    background: var(--bg-card);
    border: 1.5px solid var(--border-color);
    border-radius: 12px;
    padding: 12px 20px;
    margin-bottom: 20px;
    box-shadow: var(--shadow-sm);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }
  .members-pagination-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 18px;
    font-size: 0.86rem;
    color: var(--text-muted);
    flex-wrap: wrap;
    gap: 12px;
    width: 100%;
    box-sizing: border-box;
  }
  .members-pagination-info {
    color: var(--text-muted);
    font-size: 0.84rem;
  }
  .members-pagination-info strong {
    color: var(--text-main);
  }
  .members-pagination-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pagination-nav-btn {
    padding: 5px 11px;
    font-size: 0.8rem;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--text-main);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .pagination-nav-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .pagination-pages-desktop {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pagination-page-btn {
    width: 30px;
    height: 30px;
    border-radius: 6px;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    border: 1px solid var(--border-color);
    background: var(--bg-card);
    color: var(--text-main);
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .pagination-page-btn.is-active {
    border-color: #3b82f6;
    background: #3b82f6;
    color: #ffffff;
  }
  .pagination-page-mobile-indicator {
    display: none;
  }
  .members-table-scroll-wrapper {
    border: 1px solid var(--border-color);
    border-radius: 10px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    background: var(--bg-card);
    width: 100%;
    display: block;
  }
  .members-table {
    min-width: 680px;
  }
  .desktop-tx-table {
    display: block;
  }
  .mobile-tx-cards {
    display: none;
  }
  @media (max-width: 900px) {
    .pagination-pages-desktop {
      display: none !important;
    }
    .pagination-page-mobile-indicator {
      display: inline-block !important;
      font-size: 0.82rem !important;
      font-weight: 600 !important;
      color: var(--text-muted) !important;
    }
  }
  @media (max-width: 768px) {
    .members-content-card {
      padding: 14px 12px !important;
      border-radius: 14px !important;
    }
    .witness-active-banner {
      padding: 12px 14px !important;
      margin-bottom: 14px !important;
      gap: 10px !important;
    }
    .members-kpi-container {
      background: transparent !important;
      border: none !important;
      padding: 0 !important;
      box-shadow: none !important;
      margin-bottom: 16px !important;
    }
    .members-kpi-header {
      display: none !important;
    }
    .members-kpi-grid {
      grid-template-columns: 1fr 1fr !important;
      gap: 10px !important;
    }
    .members-mode-cards-grid {
      grid-template-columns: 1fr !important;
      gap: 12px !important;
    }
    .members-witness-kpi-grid {
      grid-template-columns: 1fr 1fr !important;
      gap: 10px !important;
      margin-top: 10px !important;
      padding-top: 10px !important;
    }
    .members-witness-kpi-grid .kpi-box:first-child {
      grid-column: 1 / -1 !important;
    }
    .kpi-box {
      padding: 12px 14px !important;
      min-height: 72px !important;
      border-radius: 12px !important;
    }
    .kpi-box-title {
      font-size: 0.72rem !important;
    }
    .kpi-box-value {
      font-size: 1.05rem !important;
      letter-spacing: -0.2px !important;
    }
    .kpi-box-sub {
      font-size: 0.68rem !important;
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
    .mobile-tx-card {
      background: var(--bg-card, #ffffff);
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 10px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      transition: background 0.15s ease;
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
      font-weight: 600;
      font-size: 0.81rem;
      color: var(--text-main, #0f172a);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap !important;
      flex: 1;
      min-width: 0;
    }
    .mobile-tx-amount {
      font-weight: 700;
      font-size: 0.85rem;
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
      line-height: 1.3;
      flex-shrink: 0;
    }
    .mobile-tx-badge.attributed {
      background: rgba(37, 99, 235, 0.14);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.3);
    }
    .mobile-tx-badge.warning {
      background: rgba(245, 158, 11, 0.14);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.35);
    }
    .mobile-tx-badge.success {
      background: rgba(16, 185, 129, 0.14);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .mobile-tx-badge {
      font-size: 0.68rem !important;
      font-weight: 700;
      padding: 2px 5px !important;
      border-radius: 5px !important;
      white-space: nowrap;
      line-height: 1.3;
      flex-shrink: 0;
      letter-spacing: -0.2px;
    }
    .mobile-recette-action-btn {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      padding: 3px 7px !important;
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.70rem !important;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 3px !important;
      flex-shrink: 0;
      transition: all 0.15s ease;
    }
    .mobile-recette-action-btn:hover {
      background: var(--bg-card-hover);
      color: var(--text-main);
    }
    .members-pagination-container {
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      gap: 10px !important;
      margin-top: 14px !important;
      padding: 10px 0 4px 0 !important;
      width: 100% !important;
      overflow: hidden !important;
    }
    .members-pagination-info {
      font-size: 0.78rem !important;
      text-align: center !important;
      width: 100% !important;
    }
    .members-pagination-controls {
      width: 100% !important;
      justify-content: center !important;
      gap: 14px !important;
    }
    .pagination-pages-desktop {
      display: none !important;
    }
    .pagination-page-mobile-indicator {
      display: inline-block !important;
      font-size: 0.82rem !important;
      font-weight: 600 !important;
      color: var(--text-muted) !important;
    }
    .pagination-page-mobile-indicator strong {
      color: var(--text-main) !important;
      font-weight: 800 !important;
    }
    .pagination-nav-btn {
      padding: 6px 14px !important;
      font-size: 0.84rem !important;
      border-radius: 8px !important;
      min-height: 34px !important;
      min-width: 40px !important;
    }
  }
</style>

<!-- BLOC 1 : OUTILS DE RAPPROCHEMENTS -->
{#if $members.length > 0}
  <!-- ÉTAT COMPACT QUAND UN FICHIER TÉMOIN EST CHARGÉ (GAIN DE HAUTEUR) -->
  <div class="witness-active-banner">
    <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
      <span style="font-size: 0.78rem; font-weight: 700; color: #10b981; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 3px 10px; border-radius: 6px;">
        {$members.length} adhérents
      </span>
      <span style="font-weight: 800; font-size: 0.92rem; color: var(--text-main);">
        Fichier témoin actif
      </span>
      <span style="color: var(--text-muted); font-size: 0.82rem;">
        Attendu : <strong style="color: var(--text-main); font-variant-numeric: tabular-nums;">{kpiTotalAttendu.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong>
      </span>
      <span style="color: var(--text-muted); font-size: 0.82rem;">
        Reste : <strong style="color: {kpiRestant > 0 ? '#dc2626' : '#10b981'}; font-variant-numeric: tabular-nums;">{kpiRestant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong> ({report.filter(m => m.resteAPayer > 0).length} en retard)
      </span>
    </div>

    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
      <button 
        type="button"
        onclick={telechargerModeleCSV}
        style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--bg-subtle); border: 1px solid var(--border-color); color: var(--text-main); font-weight: 600; font-size: 0.78rem; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;"
        title="Télécharger le modèle CSV exemple (Nom ; Tarif annuel)"
      >
        <i class="fa-solid fa-download" style="color: #4f46e5;"></i>
        <span>Modèle CSV</span>
      </button>

      <button 
        type="button"
        onclick={() => !isImporting && memberFileInputDirect && memberFileInputDirect.click()}
        disabled={isImporting}
        style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; font-size: 0.78rem; font-weight: 700; color: #ffffff; background: #4f46e5; border: none; border-radius: 6px; cursor: {isImporting ? 'wait' : 'pointer'}; opacity: {isImporting ? 0.75 : 1}; transition: all 0.15s ease; box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25);"
        title="Sélectionner un nouveau fichier CSV pour remplacer le fichier témoin"
      >
        {#if isImporting}
          <i class="fa-solid fa-circle-notch fa-spin"></i>
          <span>Importation...</span>
        {:else}
          <i class="fa-solid fa-cloud-arrow-up"></i>
          <span>Remplacer</span>
        {/if}
      </button>

      <button 
        type="button"
        onclick={supprimerFichierAdherents}
        style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 0.78rem; font-weight: 600; color: #f87171; background: var(--bg-card); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 6px; cursor: pointer; transition: all 0.15s ease;"
        title="Supprimer le fichier témoin actuel de la mémoire"
      >
        <i class="fa-solid fa-trash-can"></i>
        <span>Supprimer</span>
      </button>
    </div>

    <input 
      type="file" 
      bind:this={memberFileInputDirect} 
      onchange={handleFileSelectDirect} 
      style="display: none;" 
      accept=".csv,text/csv"
    />
  </div>
{:else}
  <!-- ÉTAT D'IMPORT COMPACT QUAND AUCUN FICHIER N'EST ENCORE CHARGÉ -->
  <div style="background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 12px; padding: 16px 22px; margin-bottom: 20px; box-shadow: var(--shadow-sm); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
    <!-- À gauche : Texte explicatif didactique et concis -->
    <div style="max-width: 640px; display: flex; flex-direction: column; justify-content: center;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">
          Outils de rapprochement & Pointage des cotisations
        </span>
        <InfoTip text="Optionnel : importez votre liste d'élèves/adhérents avec leur tarif annuel attendu (CSV à 2 colonnes : Nom ; Tarif annuel). Tito compare automatiquement avec vos écritures bancaires pour détecter les impayés." width="300px" />
      </div>
      <p style="margin: 4px 0 0 0; font-size: 0.82rem; color: var(--text-muted); line-height: 1.45;">
        Optionnel : importez votre fichier témoin (CSV) pour confronter les montants facturés aux règlements bancaires réels et isoler les impayés.
      </p>
    </div>

    <!-- À droite : Modèle CSV + Dropzone centrée en hauteur -->
    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 0;">
      <button 
        type="button"
        onclick={telechargerModeleCSV}
        style="display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; background: var(--bg-subtle); border: 1.5px solid var(--border-color); color: var(--text-main); font-weight: 600; font-size: 0.8rem; border-radius: 8px; cursor: pointer; transition: all 0.15s ease; margin: 0;"
        title="Télécharger le modèle CSV standardisé à 2 colonnes (Nom ; Tarif annuel attendu)"
      >
        <i class="fa-solid fa-download" style="color: #4f46e5;"></i>
        <span>Modèle CSV</span>
      </button>

      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div 
        class="dropzone {isDropHover ? 'dragover' : ''}"
        onclick={() => !isImporting && memberFileInputDirect && memberFileInputDirect.click()}
        ondragenter={(e) => { e.preventDefault(); e.stopPropagation(); if (!isImporting) isDropHover = true; }}
        ondragover={(e) => { e.preventDefault(); e.stopPropagation(); if (!isImporting) isDropHover = true; }}
        ondragleave={(e) => { e.preventDefault(); e.stopPropagation(); isDropHover = false; }}
        ondrop={(e) => { 
          e.preventDefault(); 
          e.stopPropagation(); 
          isDropHover = false; 
          if (!isImporting) handleFileSelectDirect(e);
        }}
        style="border: 2px dashed {isDropHover ? '#4f46e5' : '#6366f1'}; border-radius: 10px; padding: 10px 18px; min-height: 56px; background: {isDropHover ? 'rgba(79, 70, 229, 0.12)' : (isImporting ? 'rgba(79, 70, 229, 0.04)' : 'rgba(79, 70, 229, 0.05)')}; cursor: {isImporting ? 'wait' : 'pointer'}; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 12px; margin: 0 !important;"
        title={isImporting ? "Importation en cours..." : "Glissez votre fichier CSV ici ou cliquez pour le parcourir"}
      >
        {#if isImporting}
          <div style="width: 34px; height: 34px; border-radius: 50%; background: var(--bg-card); border: 1px solid var(--border-color); color: #4f46e5; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">
            <i class="fa-solid fa-circle-notch fa-spin"></i>
          </div>
          <div style="text-align: left;">
            <div style="font-weight: 800; font-size: 0.84rem; color: #4f46e5;">
              Importation et analyse en cours...
            </div>
            <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 1px;">
              Détection des élèves et calcul du pointage
            </div>
          </div>
        {:else}
          <div style="width: 34px; height: 34px; border-radius: 50%; background: var(--bg-card); border: 1px solid var(--border-color); color: #4f46e5; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0; pointer-events: none; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
            <i class="fa-solid fa-cloud-arrow-up"></i>
          </div>
          <div style="text-align: left; pointer-events: none;">
            <div style="font-weight: 800; font-size: 0.84rem; color: #4f46e5;">
              Déposer ou importer un fichier témoin
            </div>
            <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 1px;">
              Glissez votre CSV ici ou cliquez pour parcourir
            </div>
          </div>
        {/if}
      </div>

      <input 
        type="file" 
        bind:this={memberFileInputDirect} 
        onchange={handleFileSelectDirect} 
        style="display: none;" 
        accept=".csv,text/csv"
      />
    </div>
  </div>
{/if}

<!-- BLOC 2 : KPIS (INDICATEURS CLÉS) -->
<div class="members-kpi-container" style="background: var(--bg-container, #f8fafc); border: 1.5px solid var(--border-container, #e2e8f0); border-radius: 16px; padding: 18px 22px; margin-bottom: 22px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
  <div class="members-kpi-header" style="margin-bottom: 12px;">
    <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--text-main); font-family: var(--font-title, sans-serif); letter-spacing: -0.2px;">
      Indicateurs clés
    </h3>
  </div>

  <!-- Rangée 1 : Encaissements bancaires réels (4 colonnes équilibrées) -->
  <div class="members-kpi-grid">
    <!-- KPI 1 : Total Encaissé en 756 & 706 -->
    <div class="kpi-box">
      <div class="kpi-box-title">Total encaissé (756 & 706)</div>
      <div>
        <div class="kpi-box-value">
          {totalGlobalRecettes.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
        </div>
        <div class="kpi-box-sub">{allAssoTransactions.length} règlements réels</div>
      </div>
    </div>

    <!-- KPI 2 : Cotisations 756 -->
    <div class="kpi-box">
      <div class="kpi-box-title">
        <span>Cotisations (756)</span>
        <InfoTip text="Cotisations pures et adhésions statutaires." width="220px" />
      </div>
      <div>
        <div class="kpi-box-value">
          {totalRecettes756.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
        </div>
        <div class="kpi-box-sub">{countTx756} règlements</div>
      </div>
    </div>

    <!-- KPI 3 : Cours & Forfaits 706 -->
    <div class="kpi-box">
      <div class="kpi-box-title">Cours & Forfaits (706)</div>
      <div>
        <div class="kpi-box-value">
          {totalRecettes706.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
        </div>
        <div class="kpi-box-sub">{countTx706} règlements</div>
      </div>
    </div>

    <!-- KPI 4 : Reports saison suivante 487 -->
    <div class="kpi-box">
      <div class="kpi-box-title">Reports saison (487)</div>
      <div>
        <div class="kpi-box-value" style={totalRecettes487 > 0 ? 'color: #f59e0b;' : ''}>
          {totalRecettes487.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
        </div>
        <div class="kpi-box-sub">
          {countTx487} règlement{countTx487 > 1 ? 's' : ''} neutralisé{countTx487 > 1 ? 's' : ''}
        </div>
      </div>
    </div>
  </div>

  {#if $members.length > 0}
    <!-- Rangée 2 : Suivi et rapprochement du fichier témoin (3 colonnes équilibrées à 100%) -->
    <div class="members-witness-kpi-grid">
      <!-- KPI 5 : Total Attendu Témoin -->
      <div class="kpi-box">
        <div class="kpi-box-title">Total attendu (témoin)</div>
        <div>
          <div class="kpi-box-value">
            {kpiTotalAttendu.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <div class="kpi-box-sub">{$members.length} inscrits au registre</div>
        </div>
      </div>

      <!-- KPI 6 : Reste à Recouvrer -->
      <div class="kpi-box">
        <div class="kpi-box-title">Reste à recouvrer</div>
        <div>
          <div class="kpi-box-value" style="color: {kpiRestant > 0 ? '#dc2626' : '#10b981'};">
            {kpiRestant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <div class="kpi-box-sub">{report.filter(m => m.resteAPayer > 0).length} adhérents concernés</div>
        </div>
      </div>

      <!-- KPI 7 : Adhérents en Retard -->
      <div class="kpi-box">
        <div class="kpi-box-title">Adhérents en retard</div>
        <div>
          <div class="kpi-box-value" style="color: {kpiImpayesCount > 0 ? '#dc2626' : 'var(--text-main)'};">
            {kpiImpayesCount} <span style="font-size: 0.82rem; color: var(--text-muted); font-weight: 500;">personne{kpiImpayesCount > 1 ? 's' : ''}</span>
          </div>
          <div class="kpi-box-sub">{report.filter(m => m.statut === 'IMPAYÉ').length} impayés complets</div>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- BLOC 3 : TABLEAU DE GESTION DES COMPTES 756 ET 706 -->
<div class="members-content-card">
  
  <!-- En-tête officiel du tableau de gestion -->
  <div style="margin-bottom: 20px;">
    <h3 style="margin: 0; font-size: 1.18rem; font-weight: 800; color: var(--text-main); font-family: var(--font-title, sans-serif); letter-spacing: -0.2px;">
      Registre des Cotisations & Cours
    </h3>
    <p style="margin: 4px 0 0 0; font-size: 0.84rem; color: var(--text-muted); line-height: 1.45;">
      Choisissez votre mode d'affichage pour contrôler vos recettes ou pointer les cotisations.
    </p>
  </div>

  <!-- NIVEAU 1 : GRANDES CARTES DE MODE (50% / 50%) -->
  <div class="members-mode-cards-grid">
    
    <!-- Carte Mode 1 : Journal des encaissements -->
    <div 
      role="button"
      tabindex="0"
      onclick={() => displayMode = 'releve'}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') displayMode = 'releve'; }}
      style="padding: 16px 20px; border-radius: 12px; cursor: pointer; transition: all 0.18s ease; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; {displayMode === 'releve' ? 'background: rgba(79, 70, 229, 0.08); border: 2px solid #4f46e5; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.18);' : 'background: var(--bg-card); border: 1.5px solid var(--border-color); box-shadow: var(--shadow-sm);'}"
      onmouseenter={(e) => { if (displayMode !== 'releve') e.currentTarget.style.borderColor = '#6366f1'; }}
      onmouseleave={(e) => { if (displayMode !== 'releve') e.currentTarget.style.borderColor = 'var(--border-color)'; }}
    >
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; {displayMode === 'releve' ? 'background: #4f46e5; color: #ffffff;' : 'background: var(--bg-subtle); color: var(--text-muted);'}">
            <i class="fa-solid fa-receipt"></i>
          </div>
          <span style="font-weight: 800; font-size: 0.98rem; color: var(--text-main); font-family: var(--font-title, sans-serif);">
            Journal des encaissements
          </span>
        </div>
        <span style="font-size: 0.74rem; font-weight: 800; padding: 2px 8px; border-radius: 8px; {displayMode === 'releve' ? 'background: #4f46e5; color: #ffffff;' : 'background: var(--bg-subtle); color: var(--text-muted); border: 1px solid var(--border-color);'}">
          {allAssoTransactions.length} règlements
        </span>
      </div>
      <p style="margin: 0; font-size: 0.81rem; color: var(--text-muted); line-height: 1.45; padding-left: 42px;">
        Voir tous les virements et prélèvements bancaires reçus et gérer les reports (487).
      </p>
    </div>

    <!-- Carte Mode 2 : Suivi individuel & Impayés -->
    <div 
      role="button"
      tabindex="0"
      onclick={() => displayMode = 'pointage'}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') displayMode = 'pointage'; }}
      style="padding: 16px 20px; border-radius: 12px; cursor: pointer; transition: all 0.18s ease; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; {displayMode === 'pointage' ? 'background: rgba(79, 70, 229, 0.08); border: 2px solid #4f46e5; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.18);' : 'background: var(--bg-card); border: 1.5px solid var(--border-color); box-shadow: var(--shadow-sm);'}"
      onmouseenter={(e) => { if (displayMode !== 'pointage') e.currentTarget.style.borderColor = '#6366f1'; }}
      onmouseleave={(e) => { if (displayMode !== 'pointage') e.currentTarget.style.borderColor = 'var(--border-color)'; }}
    >
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; {displayMode === 'pointage' ? 'background: #4f46e5; color: #ffffff;' : 'background: var(--bg-subtle); color: var(--text-muted);'}">
            <i class="fa-solid fa-users"></i>
          </div>
          <span style="font-weight: 800; font-size: 0.98rem; color: var(--text-main); font-family: var(--font-title, sans-serif);">
            Suivi individuel & Impayés
          </span>
        </div>
        <span style="font-size: 0.74rem; font-weight: 800; padding: 2px 8px; border-radius: 8px; {displayMode === 'pointage' ? 'background: #4f46e5; color: #ffffff;' : 'background: var(--bg-subtle); color: var(--text-muted); border: 1px solid var(--border-color);'}">
          {$members.length} adhérents
        </span>
      </div>
      <p style="margin: 0; font-size: 0.81rem; color: var(--text-muted); line-height: 1.45; padding-left: 42px;">
        Comparer le tarif annuel attendu avec les paiements reçus pour isoler les retards.
      </p>
    </div>

  </div>

  <!-- BARRE D'OUTILS CONTEXTUELLE : FILTRES SPÉCIFIQUES + RECHERCHE + EXPORT -->
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
    
    <!-- À GAUCHE : Pastilles de filtres contextuelles -->
    <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
      {#if displayMode === "releve"}
          <button 
            style="padding: 6px 12px; border-radius: 20px; font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: all 0.15s; {txFilter === 'tous' ? 'background: #4f46e5; color: #ffffff; border: 1px solid #4f46e5;' : 'background: var(--bg-subtle); color: var(--text-muted); border: 1px solid var(--border-color);'}"
            onclick={() => txFilter = 'tous'}
          >
            Tous ({allAssoTransactions.length})
          </button>
          <button 
            style="padding: 6px 12px; border-radius: 20px; font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: all 0.15s; {txFilter === '756' ? 'background: #4f46e5; color: #ffffff; border: 1px solid #4f46e5;' : 'background: var(--bg-subtle); color: var(--text-muted); border: 1px solid var(--border-color);'}"
            onclick={() => txFilter = '756'}
          >
            756 · Cotisations ({countTx756})
          </button>
          <button 
            style="padding: 6px 12px; border-radius: 20px; font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: all 0.15s; {txFilter === '706' ? 'background: #4f46e5; color: #ffffff; border: 1px solid #4f46e5;' : 'background: var(--bg-subtle); color: var(--text-muted); border: 1px solid var(--border-color);'}"
            onclick={() => txFilter = '706'}
          >
            706 · Cours ({countTx706})
          </button>
          <button 
            style="padding: 6px 12px; border-radius: 20px; font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: all 0.15s; {txFilter === '487' ? 'background: #d97706; color: #ffffff; border: 1px solid #d97706;' : 'background: var(--bg-subtle); color: var(--text-muted); border: 1px solid var(--border-color);'}"
            onclick={() => txFilter = '487'}
          >
            487 · Reports ({countTx487})
          </button>
        {:else}
          <button 
            style="padding: 6px 12px; border-radius: 20px; font-size: 0.82rem; font-weight: 700; cursor: pointer; {memberFilter === 'tous' ? 'background: #4f46e5; color: #ffffff; border: 1px solid #4f46e5;' : 'background: var(--bg-subtle); color: var(--text-muted); border: 1px solid var(--border-color);'}"
            onclick={() => memberFilter = 'tous'}
          >
            Tous ({report.length})
          </button>
          <button 
            style="padding: 6px 12px; border-radius: 20px; font-size: 0.82rem; font-weight: 700; cursor: pointer; {memberFilter === 'payes' ? 'background: #16a34a; color: #ffffff; border: 1px solid #16a34a;' : 'background: var(--bg-subtle); color: var(--text-muted); border: 1px solid var(--border-color);'}"
            onclick={() => memberFilter = 'payes'}
          >
            À jour ({report.filter(m => m.resteAPayer === 0).length})
          </button>
          <button 
            style="padding: 6px 12px; border-radius: 20px; font-size: 0.82rem; font-weight: 700; cursor: pointer; {memberFilter === 'impayes' ? 'background: #dc2626; color: #ffffff; border: 1px solid #dc2626;' : 'background: var(--bg-subtle); color: var(--text-muted); border: 1px solid var(--border-color);'}"
            onclick={() => memberFilter = 'impayes'}
          >
            Impayés ({kpiImpayesCount})
          </button>
        {/if}
      </div>

    <!-- À DROITE : Feuillets / Scroll + Recherche + Exporter CSV -->
    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
      <!-- Feuillets / Scroll -->
      <div style="display: flex; background: var(--bg-subtle); padding: 2px; border-radius: 18px; border: 1px solid var(--border-color);">
        <button 
          type="button"
          style="padding: 5px 11px; font-size: 0.78rem; font-weight: 600; border-radius: 14px; border: none; cursor: pointer; {viewMode === 'pagination' ? 'background: var(--bg-card); color: var(--text-main); box-shadow: 0 1px 3px rgba(0,0,0,0.1);' : 'background: transparent; color: var(--text-muted);'}"
          onclick={() => viewMode = 'pagination'}
        >
          <i class="fa-solid fa-file-lines"></i> Feuillets
        </button>
        <button 
          type="button"
          style="padding: 5px 11px; font-size: 0.78rem; font-weight: 600; border-radius: 14px; border: none; cursor: pointer; {viewMode === 'scroll' ? 'background: var(--bg-card); color: var(--text-main); box-shadow: 0 1px 3px rgba(0,0,0,0.1);' : 'background: transparent; color: var(--text-muted);'}"
          onclick={() => viewMode = 'scroll'}
        >
          <i class="fa-solid fa-scroll"></i> Scroll
        </button>
      </div>

      <!-- Recherche -->
      <div style="position: relative; display: flex; align-items: center;">
        <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; color: var(--text-muted); font-size: 0.82rem; pointer-events: none;"></i>
        <input 
          type="text" 
          placeholder="Rechercher par nom / libellé..." 
          bind:value={searchQuery}
          style="padding: 7px 12px 7px 34px; border-radius: 8px; background: var(--bg-card); border: 1.5px solid var(--border-color); color: var(--text-main); font-size: 0.84rem; width: 220px; outline: none;"
        />
      </div>

      <!-- Exporter CSV -->
      <button 
        type="button"
        onclick={exporterCSV}
        style="padding: 7px 14px; font-weight: 700; font-size: 0.84rem; background: var(--bg-card); border: 1.5px solid var(--border-color); color: var(--text-main); border-radius: 8px; display: flex; align-items: center; gap: 6px; cursor: pointer;"
        title={$isPremium ? "Exporter les données affichées en fichier CSV Excel" : "Export réservé à la formule Illimitée"}
      >
        {#if !$isPremium}
          <i class="fa-solid fa-lock" style="color: #f59e0b; font-size: 0.80rem;"></i>
        {:else}
          <i class="fa-solid fa-file-export" style="color: #2563eb;"></i>
        {/if}
        <span>Exporter CSV</span>
      </button>
    </div>

  </div>

  <!-- TABLEAU (MODE RELEVÉ BANCAIRE PAR DÉFAUT) -->
  {#if displayMode === "releve"}
    <div class="members-table-scroll-wrapper desktop-tx-table">
      <table class="members-table" style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
        <thead>
          <tr style="background: var(--bg-subtle); border-bottom: 1.5px solid var(--border-color); text-transform: uppercase; font-size: 0.76rem; letter-spacing: 0.6px; color: var(--text-muted);">
            <th style="padding: 12px 18px; text-align: left; width: 120px;">Date</th>
            <th style="padding: 12px 18px; text-align: left;">Émetteur / Libellé bancaire</th>
            <th style="padding: 12px 18px; text-align: center; width: 170px;">Compte Comptable</th>
            <th style="padding: 12px 18px; text-align: right; width: 150px;">Montant Encaissé</th>
            <th style="padding: 12px 18px; text-align: right; width: 230px;">
              <span>Action / Période</span>
              <InfoTip text="Isole les cotisations perçues d'avance pour la saison suivante, sans fausser le résultat de l'exercice en cours." width="250px" position="left" />
            </th>
          </tr>
        </thead>
        <tbody>
          {#if displayedTransactions.length === 0}
            <tr>
              <td colspan="5" style="text-align: center; color: #64748b; padding: 45px 10px;">
                Aucun encaissement ne correspond aux critères sélectionnés.
              </td>
            </tr>
          {:else}
            {#each displayedTransactions as t, index}
              {@const cpt = String(t.compteAttribué || t.compteCredit || t.compte || t.account || '706')}
              {@const is487 = cpt === '487'}
              {@const cleanName = cleanMemberName(t.libelle)}
              <tr 
                class="table-row-hover"
                style="border-bottom: 1px solid var(--border-color); background: var(--bg-card); transition: background 0.15s ease;"
              >
                <!-- Date -->
                <td style="padding: 13px 18px; text-align: left; color: var(--text-muted); font-weight: 600; font-size: 0.85rem; white-space: nowrap;">
                  {t.date ? formatDateFr(t.date) : (t.datePaiement || '—')}
                </td>

                <!-- Libellé & Émetteur -->
                <td style="padding: 10px 18px; text-align: left; max-width: 380px;">
                  <div style="font-weight: 600; color: var(--text-main); font-size: 0.83rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    {cleanName}
                  </div>
                  <div 
                    title={t.libelle || ''}
                    style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 370px;"
                  >
                    {t.libelle || ''}
                  </div>
                </td>

                <!-- Compte Comptable -->
                <td style="padding: 10px 18px; text-align: center; white-space: nowrap;">
                  {#if is487}
                    <span style="background: rgba(245, 158, 11, 0.14); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); font-size: 0.75rem; font-weight: 700; padding: 3px 9px; border-radius: 6px;">
                      487 · Reports
                    </span>
                  {:else if cpt === "756" || cpt.startsWith("756")}
                    <span style="background: rgba(37, 99, 235, 0.14); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 0.75rem; font-weight: 700; padding: 3px 9px; border-radius: 6px;">
                      756 · Cotisations
                    </span>
                  {:else if cpt.startsWith("754")}
                    <span style="background: rgba(16, 185, 129, 0.14); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 0.75rem; font-weight: 700; padding: 3px 9px; border-radius: 6px;">
                      754 · Dons
                    </span>
                  {:else}
                    <span style="background: rgba(37, 99, 235, 0.14); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 0.75rem; font-weight: 700; padding: 3px 9px; border-radius: 6px;">
                      706 · Cours
                    </span>
                  {/if}
                </td>

                <!-- Montant Encaissé -->
                <td style="padding: 10px 18px; text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-variant-numeric: tabular-nums; font-weight: 800; color: #15803d; font-size: 0.96rem; white-space: nowrap;">
                  +&nbsp;{Number(t.credit || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u202F/g, '\u00A0')}&nbsp;€
                </td>

                <!-- Action / Report saison suivante (Compte 487) -->
                <td style="padding: 13px 18px; text-align: right; white-space: nowrap;">
                  {#if is487}
                    <button 
                      type="button"
                      onclick={() => retablirCompteRecette(t.id)}
                      style="background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 5px 11px; border-radius: 6px; font-weight: 700; font-size: 0.78rem; cursor: pointer;"
                      title="Rétablir cette opération dans les recettes de l'exercice courant"
                    >
                      <i class="fa-solid fa-rotate-left"></i> Rétablir en recette
                    </button>
                  {:else}
                    <button 
                      type="button"
                      onclick={() => basculerVers487(t.id)}
                      style="background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-muted); padding: 5px 11px; border-radius: 6px; font-weight: 700; font-size: 0.78rem; cursor: pointer; transition: all 0.15s ease;"
                      title="Reporter ce paiement en compte 487 pour l'exercice / saison suivante"
                    >
                      <i class="fa-solid fa-clock-rotate-left" style="color: #f59e0b;"></i> Reporter en 487
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Vue Liste unifiée fintech (Mobile < 768px) -->
    <div class="mobile-tx-cards">
      {#if displayedTransactions.length === 0}
        <div style="text-align: center; padding: 28px 14px; color: var(--text-muted); font-size: 0.88rem; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color);">
          Aucun encaissement ne correspond aux critères sélectionnés.
        </div>
      {:else}
        <div class="mobile-tx-list">
          {#each displayedTransactions as t}
            {@const cpt = String(t.compteAttribué || t.compteCredit || t.compte || t.account || '706')}
            {@const is487 = cpt === '487'}
            {@const cleanName = cleanMemberName(t.libelle)}
            <div class="mobile-tx-item" title={t.libelle || ''}>
              <!-- Pastille circulaire directionnelle 32x32px fintech -->
              <div 
                class="mobile-tx-icon-pill" 
                style="background: rgba(16, 185, 129, 0.12); color: #10b981;"
                aria-hidden="true"
              >
                <!-- Entrée : Flèche diagonale bas-gauche -->
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="17" y1="7" x2="7" y2="17"></line>
                  <polyline points="17 17 7 17 7 7"></polyline>
                </svg>
              </div>

              <div class="mobile-tx-content">
                <!-- Ligne 1 : Nom nettoyé + Montant -->
                <div class="mobile-tx-row-top">
                  <span class="mobile-tx-name" title={t.libelle || ''}>
                    {cleanName}
                  </span>
                  <span class="mobile-tx-amount" style="color: var(--color-success, #34d399);">
                    +&nbsp;{Number(t.credit || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u202F/g, '\u00A0')}&nbsp;€
                  </span>
                </div>

                <!-- Ligne 2 : Date + Badge de compte + Bouton Action Report -->
                <div class="mobile-tx-row-bottom">
                  <div style="display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1;">
                    <span class="mobile-tx-date">
                      {t.date ? formatDateFr(t.date) : (t.datePaiement || '—')}
                    </span>
                    {#if is487}
                      <span class="mobile-tx-badge warning">
                        487 · Reports
                      </span>
                    {:else if cpt === "756" || cpt.startsWith("756")}
                      <span class="mobile-tx-badge attributed">
                        756 · Cotisations
                      </span>
                    {:else if cpt.startsWith("754")}
                      <span class="mobile-tx-badge success">
                        754 · Dons
                      </span>
                    {:else}
                      <span class="mobile-tx-badge attributed">
                        706 · Cours
                      </span>
                    {/if}
                  </div>

                  <button 
                    type="button"
                    class="mobile-recette-action-btn"
                    onclick={() => is487 ? retablirCompteRecette(t.id) : basculerVers487(t.id)}
                    title={is487 ? "Rétablir cette opération dans les recettes de l'exercice courant" : "Reporter ce paiement en 487 pour l'exercice suivant"}
                  >
                    {#if is487}
                      <i class="fa-solid fa-rotate-left"></i> Rétablir
                    {:else}
                      <i class="fa-solid fa-clock-rotate-left" style="color: #f59e0b;"></i> Reporter
                    {/if}
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Pagination du relevé -->
    {#if filteredTransactions.length > 0 && viewMode === 'pagination'}
      <div class="members-pagination-container">
        <div class="members-pagination-info">
          Affichage <strong>{Math.min((currentPage - 1) * pageSize + 1, filteredTransactions.length)}</strong> à <strong>{Math.min(currentPage * pageSize, filteredTransactions.length)}</strong> sur <strong>{filteredTransactions.length}</strong> règlements
        </div>
        {#if totalTxPages > 1}
          <div class="members-pagination-controls">
            <button 
              type="button"
              class="pagination-nav-btn"
              disabled={currentPage === 1}
              onclick={() => currentPage--}
              aria-label="Page précédente"
            >
              <i class="fa-solid fa-chevron-left"></i>
            </button>

            <!-- Mode Desktop : numéros de pages cliquables -->
            <div class="pagination-pages-desktop">
              {#each Array.from({ length: totalTxPages }) as _, i}
                {#if i < 7 || i === totalTxPages - 1}
                  <button 
                    type="button"
                    class="pagination-page-btn {currentPage === i + 1 ? 'is-active' : ''}"
                    onclick={() => currentPage = i + 1}
                  >
                    {i + 1}
                  </button>
                {/if}
              {/each}
            </div>

            <!-- Mode Mobile : indicateur compact sans débordement -->
            <span class="pagination-page-mobile-indicator">
              Page <strong>{currentPage}</strong> / {totalTxPages}
            </span>

            <button 
              type="button"
              class="pagination-nav-btn"
              disabled={currentPage === totalTxPages}
              onclick={() => currentPage++}
              aria-label="Page suivante"
            >
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        {/if}
      </div>
    {/if}

  {:else}
    <!-- TABLEAU (MODE POINTAGE INDIVIDUEL PAR ÉLÈVE) -->
    <div class="members-table-scroll-wrapper desktop-tx-table">
      <table class="members-table" style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
        <thead>
          <tr style="background: var(--bg-subtle); border-bottom: 1.5px solid var(--border-color); text-transform: uppercase; font-size: 0.76rem; letter-spacing: 0.6px; color: var(--text-muted);">
            <th style="padding: 12px 18px; text-align: left;">Nom de l'adhérent / élève</th>
            <th style="padding: 12px 18px; text-align: right; width: 170px;">Tarif annuel dû</th>
            <th style="padding: 12px 18px; text-align: right; width: 170px;">Déjà versé</th>
            <th style="padding: 12px 18px; text-align: right; width: 170px;">Reste à régler</th>
            <th style="padding: 12px 18px; text-align: center; width: 130px;">Statut</th>
            <th style="padding: 12px 18px; text-align: right; width: 110px;">Détails</th>
          </tr>
        </thead>
        <tbody>
          {#if $members.length === 0}
            <tr>
              <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 50px 20px;">
                <div style="max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 10px;">
                  <div style="font-size: 1.05rem; font-weight: 800; color: var(--text-main);">
                    Aucun fichier témoin chargé
                  </div>
                  <p style="margin: 0; font-size: 0.86rem; color: var(--text-muted); line-height: 1.5;">
                    Pour afficher le pointage individuel et détecter les écarts ou impayés, déposez votre fichier témoin (CSV) dans le bloc « Outils de rapprochements » ci-dessus.
                  </p>
                  <button 
                    type="button"
                    onclick={() => memberFileInputDirect && memberFileInputDirect.click()}
                    style="margin-top: 6px; padding: 8px 18px; border-radius: 8px; background: #4f46e5; color: #ffffff; font-weight: 700; font-size: 0.84rem; border: none; cursor: pointer;"
                  >
                    Importer le fichier témoin
                  </button>
                </div>
              </td>
            </tr>
          {:else if displayedMembers.length === 0}
            <tr>
              <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 45px 10px;">
                Aucun adhérent ne correspond aux critères.
              </td>
            </tr>
          {:else}
            {#each displayedMembers as m, index}
              <tr 
                class="table-row-hover"
                style="border-bottom: 1px solid var(--border-color); background: var(--bg-card); transition: background 0.15s ease;"
              >
                <td style="padding: 10px 18px; text-align: left; font-weight: 700; color: var(--text-main);">
                  {m.cleanName}
                </td>
                <td style="padding: 10px 18px; text-align: right; font-family: ui-monospace, monospace; font-variant-numeric: tabular-nums; font-weight: 700; color: var(--text-main);">
                  {Number(m.forfait || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </td>
                <td style="padding: 10px 18px; text-align: right; font-family: ui-monospace, monospace; font-variant-numeric: tabular-nums; font-weight: 700; color: {m.dejaPaye > 0 ? '#15803d' : 'var(--text-muted)'};">
                  {Number(m.dejaPaye || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </td>
                <td style="padding: 10px 18px; text-align: right; font-family: ui-monospace, monospace; font-variant-numeric: tabular-nums; font-weight: 700; color: {m.resteAPayer > 0 ? '#dc2626' : '#15803d'};">
                  {Number(m.resteAPayer || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </td>
                <td style="padding: 10px 18px; text-align: center;">
                  <span class="badge {m.badgeClass}" style="font-weight: 700; padding: 4px 10px; font-size: 0.76rem;">{m.statut}</span>
                </td>
                <td style="padding: 10px 18px; text-align: right;">
                  <button 
                    type="button"
                    class="btn btn-secondary btn-sm" 
                    onclick={() => { selectedMemberForDrawer = m; showDrawerModal = true; }}
                    title="Voir le détail de l'adhérent"
                    aria-label="Voir le détail de l'adhérent"
                    style="padding: 5px 11px; font-size: 0.78rem; background: var(--bg-card); border: 1.5px solid var(--border-color); color: var(--text-main);"
                  >
                    <i class="fa-solid fa-list-check"></i>
                  </button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Vue Cartes compacte à 2 lignes pour le pointage des adhérents (Mobile < 768px) -->
    <div class="mobile-tx-cards">
      {#if $members.length === 0}
        <div style="text-align: center; color: var(--text-muted); padding: 36px 14px; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color);">
          <div style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin-bottom: 6px;">
            Aucun fichier témoin chargé
          </div>
          <p style="margin: 0 0 12px 0; font-size: 0.8rem; color: var(--text-muted);">
            Importez votre fichier CSV pour afficher le pointage individuel des cotisations.
          </p>
          <button 
            type="button"
            onclick={() => memberFileInputDirect && memberFileInputDirect.click()}
            style="padding: 7px 16px; border-radius: 8px; background: #4f46e5; color: #ffffff; font-weight: 700; font-size: 0.82rem; border: none; cursor: pointer;"
          >
            Importer le fichier témoin
          </button>
        </div>
      {:else if displayedMembers.length === 0}
        <div style="text-align: center; padding: 28px 14px; color: var(--text-muted); font-size: 0.88rem; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color);">
          Aucun adhérent ne correspond aux critères.
        </div>
      {:else}
        <div class="mobile-tx-list">
          {#each displayedMembers as m}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div 
              class="mobile-tx-card"
              onclick={() => { selectedMemberForDrawer = m; showDrawerModal = true; }}
              style="cursor: pointer;"
            >
              <!-- Ligne 1 : Nom adhérent + Tarif dû -->
              <div class="mobile-tx-row-top">
                <span class="mobile-tx-name">
                  {m.cleanName}
                </span>
                <span class="mobile-tx-amount" style="color: var(--text-main);">
                  {Number(m.forfait || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </span>
              </div>

              <!-- Ligne 2 : Versé & Reste à payer + Badge Statut -->
              <div class="mobile-tx-row-bottom">
                <div style="font-size: 0.74rem; color: var(--text-muted);">
                  Payé : <strong style="color: {m.dejaPaye > 0 ? '#10b981' : 'var(--text-muted)'};">{Number(m.dejaPaye || 0).toFixed(0)} €</strong>
                  · Reste : <strong style="color: {m.resteAPayer > 0 ? '#ef4444' : '#10b981'};">{Number(m.resteAPayer || 0).toFixed(0)} €</strong>
                </div>

                <div style="display: flex; align-items: center; gap: 6px;">
                  <span class="badge {m.badgeClass}" style="font-weight: 700; padding: 2px 7px; font-size: 0.7rem;">
                    {m.statut}
                  </span>
                  <i class="fa-solid fa-chevron-right" style="font-size: 0.68rem; color: var(--text-muted);"></i>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Pagination du pointage -->
    {#if filteredMembers.length > 0 && viewMode === 'pagination'}
      <div class="members-pagination-container">
        <div class="members-pagination-info">
          Affichage <strong>{Math.min((currentPage - 1) * pageSize + 1, filteredMembers.length)}</strong> à <strong>{Math.min(currentPage * pageSize, filteredMembers.length)}</strong> sur <strong>{filteredMembers.length}</strong> inscrits
        </div>
        {#if totalMemberPages > 1}
          <div class="members-pagination-controls">
            <button 
              type="button"
              class="pagination-nav-btn"
              disabled={currentPage === 1}
              onclick={() => currentPage--}
              aria-label="Page précédente"
            >
              <i class="fa-solid fa-chevron-left"></i>
            </button>

            <!-- Mode Desktop : numéros de pages cliquables -->
            <div class="pagination-pages-desktop">
              {#each Array.from({ length: totalMemberPages }) as _, i}
                {#if i < 7 || i === totalMemberPages - 1}
                  <button 
                    type="button"
                    class="pagination-page-btn {currentPage === i + 1 ? 'is-active' : ''}"
                    onclick={() => currentPage = i + 1}
                  >
                    {i + 1}
                  </button>
                {/if}
              {/each}
            </div>

            <!-- Mode Mobile : indicateur compact sans débordement -->
            <span class="pagination-page-mobile-indicator">
              Page <strong>{currentPage}</strong> / {totalMemberPages}
            </span>

            <button 
              type="button"
              class="pagination-nav-btn"
              disabled={currentPage === totalMemberPages}
              onclick={() => currentPage++}
              aria-label="Page suivante"
            >
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        {/if}
      </div>
    {/if}
  {/if}

</div>

<!-- MODALE D'IMPORT CSV DES TARIFS ANNUELS CONTRACTUELS -->
{#if showImportModal}
  <div 
    class="modal-backdrop" 
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    onkeydown={(e) => { if (e.key === 'Escape') showImportModal = false; }}
    style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;"
  >
    <div style="background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 16px; width: 100%; max-width: 600px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); overflow: hidden; display: flex; flex-direction: column;">
      
      <!-- En-tête -->
      <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--bg-subtle);">
        <div>
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--text-main);">
            Importer la liste des adhérents & forfaits attendus
          </h3>
          <p style="margin: 4px 0 0 0; font-size: 0.84rem; color: var(--text-muted);">
            Compare les montants attendus avec les règlements reçus sur vos comptes 756 et 706.
          </p>
        </div>
        <button 
          onclick={() => showImportModal = false}
          style="background: none; border: none; font-size: 1.25rem; color: var(--text-muted); cursor: pointer; padding: 4px;"
          aria-label="Fermer"
        >
          &times;
        </button>
      </div>

      <!-- Corps -->
      <div style="padding: 24px; display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; font-size: 0.88rem; color: var(--text-main);">
            Fichier CSV (2 colonnes)
          </span>
          <button 
            type="button"
            onclick={telechargerModeleCSV}
            style="background: none; border: none; color: #38bdf8; font-weight: 600; font-size: 0.82rem; cursor: pointer; text-decoration: underline; display: flex; align-items: center; gap: 6px;"
          >
            <i class="fa-solid fa-download"></i> Télécharger le modèle CSV
          </button>
        </div>

        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div 
          class="dropzone {isDropHover ? 'dragover' : ''}"
          onclick={() => memberFileInputModal && memberFileInputModal.click()}
          ondragenter={(e) => { e.preventDefault(); e.stopPropagation(); isDropHover = true; }}
          ondragover={(e) => { e.preventDefault(); e.stopPropagation(); isDropHover = true; }}
          ondragleave={(e) => { e.preventDefault(); e.stopPropagation(); isDropHover = false; }}
          ondrop={(e) => { 
            e.preventDefault(); 
            e.stopPropagation(); 
            isDropHover = false; 
            handleFileSelect(e);
          }}
          style="border: 2px dashed {isDropHover ? '#4f46e5' : 'var(--border-color)'}; border-radius: 14px; padding: 32px 20px; background: {isDropHover ? 'rgba(79, 70, 229, 0.05)' : 'var(--bg-subtle)'}; text-align: center; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s ease;"
        >
          <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--bg-card); border: 1px solid var(--border-color); color: #4f46e5; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; margin-bottom: 2px; box-shadow: var(--shadow-sm); pointer-events: none;">
            <i class="fa-solid fa-cloud-arrow-up"></i>
          </div>
          <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-main); pointer-events: none;">
            {importFileName ? importFileName : "Glissez votre fichier ici ou parcourez"}
          </div>
          <span style="background: #4f46e5; color: #ffffff; padding: 6px 20px; border-radius: 20px; font-weight: 700; font-size: 0.78rem; box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25); pointer-events: none;">
            Parcourir
          </span>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; pointer-events: none;">
            Colonnes : Nom de l'adhérent / élève et Montant annuel attendu
          </div>
          <input 
            type="file" 
            bind:this={memberFileInputModal}
            accept=".csv,text/csv" 
            onchange={handleFileSelect} 
            style="display: none;" 
          />
        </div>

        {#if importedRows.length > 0}
          <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 12px 16px; font-size: 0.86rem; color: #10b981; font-weight: 600; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-check"></i> {importedRows.length} adhérents détectés avec leurs forfaits annuels.
          </div>
        {/if}
      </div>

      <!-- Pied de modale -->
      <div style="padding: 16px 24px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--bg-subtle); flex-wrap: wrap; gap: 10px;">
        <div>
          {#if $members.length > 0}
            <button 
              type="button" 
              onclick={() => { showImportModal = false; supprimerFichierAdherents(); }}
              style="padding: 8px 12px; border-radius: 8px; background: var(--bg-card); border: 1px solid rgba(239, 68, 68, 0.35); color: #f87171; font-weight: 600; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 6px;"
              title="Supprimer la liste actuelle sans toucher à votre relevé"
            >
              <i class="fa-solid fa-trash-can"></i> Supprimer la liste ({$members.length})
            </button>
          {/if}
        </div>

        <div style="display: flex; gap: 10px; align-items: center; margin-left: auto;">
          <button 
            type="button" 
            onclick={() => showImportModal = false}
            style="padding: 9px 16px; border-radius: 8px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); font-weight: 600; cursor: pointer;"
          >
            Annuler
          </button>
          <button 
            type="button" 
            onclick={validerImportTarifs}
            disabled={importedRows.length === 0}
            style="padding: 9px 18px; border-radius: 8px; background: #2563eb; color: #ffffff; border: none; font-weight: 700; cursor: pointer; opacity: {importedRows.length === 0 ? 0.5 : 1}; box-shadow: 0 2px 6px rgba(37,99,235,0.25);"
          >
            Valider et activer le pointage
          </button>
        </div>
      </div>

    </div>
  </div>
{/if}

<!-- MODALE DÉTAIL D'UN ADHÉRENT (DRAWER) -->
{#if showDrawerModal && selectedMemberForDrawer}
  <div 
    class="modal-backdrop" 
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    onkeydown={(e) => { if (e.key === 'Escape') showDrawerModal = false; }}
    style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;"
  >
    <div style="background: #ffffff; border-radius: 16px; width: 100%; max-width: 500px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden;">
      <div style="padding: 20px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
        <div>
          <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: #0f172a;">
            Fiche élève : {selectedMemberForDrawer.cleanName}
          </h3>
          <span style="font-size: 0.8rem; color: #64748b;">Statut : {selectedMemberForDrawer.statut}</span>
        </div>
        <button onclick={() => showDrawerModal = false} style="background: none; border: none; font-size: 1.25rem; color: #64748b; cursor: pointer;">&times;</button>
      </div>

      <div style="padding: 24px; display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
          <span style="color: #64748b;">Tarif annuel contractuel :</span>
          <strong style="color: #0f172a; font-family: monospace;">{Number(selectedMemberForDrawer.forfait || 0).toFixed(2)} €</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
          <span style="color: #64748b;">Total déjà réglé :</span>
          <strong style="color: #15803d; font-family: monospace;">{Number(selectedMemberForDrawer.dejaPaye || 0).toFixed(2)} €</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 10px 0;">
          <span style="color: #64748b;">Reste à recouvrer :</span>
          <strong style="color: {selectedMemberForDrawer.resteAPayer > 0 ? '#dc2626' : '#15803d'}; font-family: monospace;">
            {Number(selectedMemberForDrawer.resteAPayer || 0).toFixed(2)} €
          </strong>
        </div>
      </div>

      <div style="padding: 16px 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; background: #f8fafc;">
        <button 
          onclick={() => showDrawerModal = false}
          style="padding: 8px 16px; border-radius: 8px; background: #0f172a; color: #ffffff; border: none; font-weight: 700; cursor: pointer;"
        >
          Fermer
        </button>
      </div>
    </div>
  </div>
{/if}
