<script>
  import { 
    members, 
    updateMembers, 
    transactions,
    updateTransactions,
    showToast 
  } from "../lib/store.js";

  let currentSubView = $state("operations");
  let activeTab = $state("a_attribuer");

  let memberFilter = $state("tous");
  let searchQuery = $state("");

  let showModal = $state(false);
  let showImportModal = $state(false);
  let showDrawerModal = $state(false);
  /** @type {any} */
  let selectedMemberForDrawer = $state(null);

  /** @type {any} */
  let selectedTx = $state(null);
  let nomEleve = $state("");
  let montantVerse = $state(0);
  /** @type {string | number} */
  let montantTotalPercevoir = $state("");

  /** @type {Array<any>} */
  const sampleAssoTx = [
    { id: "tx-asso-1", date: "2026-09-15", libelle: "REMISE EUROPRELEVEMENT | 009GUGN | AytasCilhanDeniz", credit: 305.3, compteAttribué: "756", account: "756", memberAssociated: false, datePaiement: "15/09/2026" },
    { id: "tx-asso-2", date: "2026-09-14", libelle: "REMISE EUROPRELEVEMENT | OG80UYZ | leger", credit: 269.33, compteAttribué: "756", account: "756", memberAssociated: false, datePaiement: "14/09/2026" },
    { id: "tx-asso-3", date: "2026-09-10", libelle: "REMISE EUROPRELEVEMENT | OGI1N24 | Hennequin", credit: 297, compteAttribué: "706", account: "706", memberAssociated: false, datePaiement: "10/09/2026" }
  ];

  let allAssoTransactions = $derived.by(() => {
    const fromStore = $transactions.filter((/** @type {any} */ t) => 
      (t.compteAttribué === "756" || t.compteAttribué === "706" || t.compteCredit === "756" || t.compteCredit === "706" || t.compte === "756" || t.compte === "706") && t.credit > 0
    );
    if (fromStore.length > 0) return fromStore;
    return sampleAssoTx;
  });

  let filteredOperations = $derived(
    allAssoTransactions.filter((/** @type {any} */ t) => activeTab === "a_attribuer" ? !t.memberAssociated : t.memberAssociated)
  );

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

  /**
   * @param {string} rawName
   * @returns {string[]}
   */
  function getSignificantNameTokens(rawName) {
    if (!rawName) return [];
    const cleaned = cleanMemberName(rawName);
    const normalized = cleaned.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return normalized
      .split(/[^a-z0-9]+/)
      .filter(w => w.length >= 3 && !GENERIC_BANK_WORDS.has(w) && !/^\d+$/.test(w));
  }

  /**
   * Fuzzy name matching helper for reconciling bank libellés and CSV names
   * @param {string} name1
   * @param {string} name2
   */
  function isFuzzyMatch(name1, name2) {
    if (!name1 || !name2) return false;

    const tokens1 = getSignificantNameTokens(name1);
    const tokens2 = getSignificantNameTokens(name2);

    if (tokens1.length === 0 || tokens2.length === 0) return false;

    const key1 = tokens1.join("");
    const key2 = tokens2.join("");

    if (key1 === key2) return true;

    const common = tokens1.filter(t => tokens2.includes(t));

    if (common.length >= 2) return true;

    if (common.length === 1) {
      const matchedToken = common[0];
      if (matchedToken.length >= 4 && tokens1.length <= 3 && tokens2.length <= 3) {
        return true;
      }
    }

    return false;
  }

  /**
   * Deduplicate and reconcile member list entries
   * @param {any[]} list
   * @returns {any[]}
   */
  function deduplicateMembersList(list) {
    if (!Array.isArray(list) || list.length === 0) return [];

    /** @type {any[]} */
    const merged = [];

    list.forEach(m => {
      const idx = merged.findIndex(existing => isFuzzyMatch(existing.nom, m.nom));
      if (idx >= 0) {
        const existing = merged[idx];
        const forfait = Math.max(existing.forfait || 0, m.forfait || 0);
        const dejaPaye = (existing.id === m.id) 
          ? existing.dejaPaye 
          : ((existing.dejaPaye || 0) + (m.dejaPaye || 0));

        const name1 = cleanMemberName(existing.nom);
        const name2 = cleanMemberName(m.nom);
        const cleanestNom = name2.length > name1.length ? name2 : name1;

        merged[idx] = {
          ...existing,
          ...m,
          id: existing.id || m.id,
          nom: cleanestNom,
          forfait,
          dejaPaye,
          payeLe: existing.payeLe || m.payeLe,
          email: existing.email || m.email,
          rawRef: existing.rawRef || m.rawRef
        };
      } else {
        merged.push({
          ...m,
          nom: cleanMemberName(m.nom)
        });
      }
    });

    return merged;
  }

  /** @param {string} [rawNameOrLabel] */
  function extractCleanMemberInfo(rawNameOrLabel) {
    if (!rawNameOrLabel) return { cleanName: "Adhérent Inconnu", rawRef: "" };
    const clean = cleanMemberName(rawNameOrLabel);
    let str = rawNameOrLabel.trim();
    let parts = str.split("|").map((/** @type {string} */ p) => p.trim());
    let rawRef = parts.length > 1 ? parts.slice(0, -1).join(" | ") : (str !== clean ? str : "");
    return { cleanName: clean, rawRef };
  }

  let report = $derived.by(() => {
    const cleanMembers = deduplicateMembersList($members);
    return cleanMembers.map((/** @type {any} */ m) => {
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

      const { cleanName, rawRef } = extractCleanMemberInfo(m.nom);

      return {
        ...m,
        cleanName: cleanName || m.nom,
        rawRef: rawRef || m.rawRef || m.nom,
        resteAPayer,
        statut,
        badgeClass
      };
    });
  });

  let kpiTotalAttendu = $derived(report.reduce((sum, m) => sum + (m.forfait || 0), 0));
  let kpiTotalEncaisse = $derived(report.reduce((sum, m) => sum + (m.dejaPaye || 0), 0));
  let kpiRestant = $derived(report.reduce((sum, m) => sum + (m.resteAPayer || 0), 0));
  let kpiImpayesCount = $derived(report.filter(m => m.resteAPayer > 0).length);
  let kpiPercentEncaisse = $derived(kpiTotalAttendu > 0 ? Math.round((kpiTotalEncaisse / kpiTotalAttendu) * 100) : 100);

  let filteredMembers = $derived(report.filter((/** @type {any} */ m) => {
    const matchesSearch = searchQuery.trim() === "" || 
      m.cleanName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      m.rawRef.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (memberFilter === "payes") return m.resteAPayer === 0;
    if (memberFilter === "impayes") return m.resteAPayer > 0;
    return true;
  }));

  let currentPage = $state(1);
  let pageSize = $state(12);
  let viewMode = $state("pagination"); // "pagination" (Feuillets) or "scroll" (Vue globale)

  $effect(() => {
    searchQuery;
    memberFilter;
    currentPage = 1;
  });

  let totalPages = $derived(Math.ceil(filteredMembers.length / pageSize) || 1);
  let paginatedMembers = $derived(
    filteredMembers.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  );

  let displayedMembers = $derived(
    viewMode === "pagination" ? paginatedMembers : filteredMembers
  );

  /** @param {any} tx */
  function openAssociationModal(tx) {
    selectedTx = tx;
    const info = extractCleanMemberInfo(tx.libelle);
    nomEleve = info.cleanName;
    montantVerse = tx.credit || 0;
    montantTotalPercevoir = String(tx.credit || 350);
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    selectedTx = null;
    nomEleve = "";
    montantVerse = 0;
    montantTotalPercevoir = "";
  }

  /** @param {any} m */
  function openDrawerModal(m) {
    selectedMemberForDrawer = m;
    showDrawerModal = true;
  }

  /** @param {any} e */
  function validerAssociation(e) {
    e.preventDefault();
    if (!nomEleve || !montantTotalPercevoir) return;

    const totalExpected = parseFloat(String(montantTotalPercevoir)) || 0;
    const paidAmount = parseFloat(String(montantVerse)) || 0;

    const existingIndex = $members.findIndex(m => isFuzzyMatch(m.nom, nomEleve.trim()));
    
    if (existingIndex >= 0) {
      const updated = [...$members];
      updated[existingIndex] = {
        ...updated[existingIndex],
        nom: nomEleve.trim().length > updated[existingIndex].nom.length ? nomEleve.trim() : updated[existingIndex].nom,
        dejaPaye: updated[existingIndex].dejaPaye + paidAmount,
        forfait: Math.max(totalExpected, updated[existingIndex].forfait || 0),
        payeLe: selectedTx?.date || selectedTx?.datePaiement || new Date().toLocaleDateString("fr-FR")
      };
      updateMembers(deduplicateMembersList(updated));
    } else {
      const newMember = {
        id: Date.now(),
        nom: nomEleve.trim(),
        forfait: totalExpected,
        dejaPaye: paidAmount,
        payeLe: selectedTx?.date || selectedTx?.datePaiement || new Date().toLocaleDateString("fr-FR"),
        email: nomEleve.trim().toLowerCase().replace(/\s+/g, ".") + "@email.com"
      };
      updateMembers(deduplicateMembersList([...$members, newMember]));
    }

    if (selectedTx) {
      selectedTx.memberAssociated = true;
      selectedTx.associatedMember = nomEleve.trim();

      const txIndex = $transactions.findIndex(t => t.id === selectedTx.id);
      if (txIndex >= 0) {
        const updatedTx = [...$transactions];
        updatedTx[txIndex] = { ...updatedTx[txIndex], memberAssociated: true, associatedMember: nomEleve.trim() };
        updateTransactions(updatedTx);
      }
    }

    showToast("✅ Association validée !");
    closeModal();
  }

  function toutAssocier() {
    const toAssociate = filteredOperations;
    if (toAssociate.length === 0) return;

    let updatedMembers = [...$members];
    /** @type {any[]} */
    let currentTxList = []; transactions.subscribe(v => currentTxList = v)();
    let updatedTx = [...currentTxList];
    let count = 0;

    toAssociate.forEach((/** @type {any} */ tx) => {
      const info = extractCleanMemberInfo(tx.libelle);
      const nom = info.cleanName;
      const paidAmount = parseFloat(tx.credit) || 0;

      const existingIndex = updatedMembers.findIndex(m => isFuzzyMatch(m.nom, nom.trim()));
      if (existingIndex >= 0) {
        updatedMembers[existingIndex] = {
          ...updatedMembers[existingIndex],
          dejaPaye: updatedMembers[existingIndex].dejaPaye + paidAmount
        };
      } else {
        updatedMembers.push({
          id: Date.now() + Math.random(),
          nom: nom.trim(),
          rawRef: tx.libelle,
          forfait: paidAmount,
          dejaPaye: paidAmount,
          payeLe: tx.date || tx.datePaiement || new Date().toLocaleDateString("fr-FR"),
          email: nom.trim().toLowerCase().replace(/\s+/g, ".") + "@email.com"
        });
      }

      tx.memberAssociated = true;
      tx.associatedMember = nom.trim();

      const txIndex = updatedTx.findIndex(t => t.id === tx.id);
      if (txIndex >= 0) {
        updatedTx[txIndex] = { ...updatedTx[txIndex], memberAssociated: true, associatedMember: nom.trim() };
      }
      count++;
    });

    updateMembers(deduplicateMembersList(updatedMembers));
    if (updatedTx.length > 0) updateTransactions(updatedTx);

    showToast(`✅ ${count} opérations associées avec succès !`);
  }

  // --- CSV IMPORT DE DONNÉES DE GESTION ---
  let importFileName = $state("");
  /** @type {any} */
  let fileInputEl = $state(null);
  let rawPasteText = $state("");
  let activeImportTab = $state("file"); // 'file' vs 'paste'
  /** @type {Array<{nom: string, forfait: number}>} */
  let importedRows = $state([]);

  function telechargerModeleCSV() {
    const csvContent = "Nom_Eleve_ou_Client;Montant_Total_Du\nDupont Marc;350.00\nMartin Sophie;420.00\nPetit Thomas;280.00\n";
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "modele_donnees_de_gestion.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("📥 Modèle de tableau exemple téléchargé !");
  }

  /** @param {any} e */
  function handleFileSelect(e) {
    const file = e.target?.files?.[0] || e.dataTransfer?.files?.[0];
    if (!file) return;
    importFileName = file.name;

    const reader = new FileReader();
    reader.onload = (evt) => {
      let text = /** @type {string} */ (evt.target?.result || "");
      if (text.includes("\uFFFD")) {
        // Encoding fallback for French ISO-8859-1 / Windows-1252
        const reader2 = new FileReader();
        reader2.onload = (evt2) => {
          parseCSVMembers(/** @type {string} */ (evt2.target?.result || ""));
        };
        reader2.readAsText(file, "ISO-8859-1");
      } else {
        parseCSVMembers(text);
      }
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

    // 0. Detect binary Excel files (.xlsx / .xls / ZIP)
    if (csvText.startsWith("PK\x03\x04") || csvText.includes("Content_Types].xml") || csvText.includes("[Content_Types]")) {
      showToast("⚠️ Fichier Excel binaire (.xlsx) détecté. Veuillez l'enregistrer au format CSV ou utiliser l'onglet Copier-Coller.");
      importedRows = [];
      return;
    }

    const cleanText = csvText.replace(/^\uFEFF/, "").trim();
    if (!cleanText) {
      importedRows = [];
      return;
    }

    const lines = cleanText.split(/\r\n|\r|\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      importedRows = [];
      return;
    }

    // Helper: Split a single line respecting quoted string tokens
    /**
     * @param {string} line
     * @param {string} sep
     */
    function splitLineSmart(line, sep) {
      /** @type {string[]} */
      const result = [];
      let current = "";
      let inQuotes = false;
      let quoteChar = "";

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if ((char === '"' || char === "'") && !inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar && inQuotes) {
          inQuotes = false;
          quoteChar = "";
        } else if (char === sep && !inQuotes) {
          result.push(current.trim().replace(/^["']|["']$/g, ''));
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      return result;
    }

    // Auto-detect delimiter
    const delimiters = [';', '\t', ',', '|'];
    let bestDelimiter = ';';
    let maxCount = -1;
    const sampleText = lines.slice(0, 5).join('\n');
    for (const d of delimiters) {
      const count = (sampleText.split(d).length - 1);
      if (count > maxCount) {
        maxCount = count;
        bestDelimiter = d;
      }
    }

    const allRows = lines.map(line => splitLineSmart(line, bestDelimiter));

    // Helper to extract numeric amount from string
    /** @param {any} str */
    function extractNumeric(str) {
      if (!str) return null;
      let s = String(str).trim();
      s = s.replace(/€|EUR|euros?/gi, '').trim();
      s = s.replace(/\s+/g, '');
      if (s.includes(',') && s.includes('.')) {
        if (s.indexOf('.') < s.indexOf(',')) {
          s = s.replace(/\./g, '').replace(',', '.');
        } else {
          s = s.replace(/,/g, '');
        }
      } else if (s.includes(',')) {
        s = s.replace(',', '.');
      }
      s = s.replace(/[^0-9.-]/g, '');
      if (!s || isNaN(parseFloat(s))) return null;
      return parseFloat(s);
    }

    // Helper to test if row 0 is header
    /** @param {string[]} rowCells */
    function isHeaderRow(rowCells) {
      const joined = rowCells.join(' ').toLowerCase();
      const hasNumber = rowCells.some(cell => extractNumeric(cell) !== null);
      if (hasNumber) return false;
      return /nom|client|eleve|élève|adhérent|adherent|prenom|prénom|personne|membre|forfait|montant|du|dû|total|prix|tarif|somme|cotisation|inscription|valeur|euro|€|solde/.test(joined);
    }

    const hasHeader = isHeaderRow(allRows[0]);
    const startIdx = hasHeader ? 1 : 0;
    
    /** @type {number[]} */
    let nameIndices = [];
    let amountIdx = -1;

    if (hasHeader) {
      const headers = allRows[0].map(h => h.toLowerCase());
      headers.forEach((h, idx) => {
        if (/nom|client|eleve|élève|adhérent|adherent|prenom|prénom|personne|membre|libelle|intitule/.test(h)) {
          nameIndices.push(idx);
        }
        if (amountIdx === -1 && /montant|forfait|du|dû|total|prix|tarif|somme|cotisation|inscription|valeur|euro|€|solde/.test(h)) {
          amountIdx = idx;
        }
      });
    }

    /** @type {Array<{nom: string, forfait: number}>} */
    const parsed = [];

    for (let i = startIdx; i < allRows.length; i++) {
      const row = allRows[i];
      if (!row || row.length === 0) continue;

      let extractedNom = "";
      /** @type {number | null} */
      let extractedAmount = null;

      // 1. Column mapping from header
      if (hasHeader && (nameIndices.length > 0 || amountIdx !== -1)) {
        if (nameIndices.length > 0) {
          extractedNom = nameIndices.map(idx => row[idx] || '').filter(Boolean).join(' ');
        }
        if (amountIdx !== -1 && row[amountIdx] !== undefined) {
          extractedAmount = extractNumeric(row[amountIdx]);
        }
      }

      // 2. Per-row heuristic search if mapping incomplete
      if (!extractedNom || extractedAmount === null) {
        let foundNumIdx = -1;
        /** @type {number | null} */
        let numVal = null;
        for (let c = 0; c < row.length; c++) {
          const num = extractNumeric(row[c]);
          if (num !== null) {
            foundNumIdx = c;
            numVal = num;
            break;
          }
        }

        if (foundNumIdx !== -1) {
          extractedAmount = numVal;
          if (!extractedNom) {
            extractedNom = row.filter((_, idx) => idx !== foundNumIdx).join(' ').trim();
          }
        }
      }

      // 3. Single-column Regex fallback (space separated or text paste)
      if ((!extractedNom || extractedAmount === null) && row.length === 1) {
        const lineText = row[0];
        const trailingMatch = lineText.match(/^(.*?)\s+([-+]?\d+(?:[\s,.]\d{3})*(?:[,.]\d{1,2})?)\s*(?:€|EUR|euros?)?$/i);
        if (trailingMatch) {
          extractedNom = trailingMatch[1].trim();
          extractedAmount = extractNumeric(trailingMatch[2]);
        } else {
          const leadingMatch = lineText.match(/^\s*(?:€|EUR)?\s*([-+]?\d+(?:[\s,.]\d{3})*(?:[,.]\d{1,2})?)\s*(?:€|EUR)?\s*[-:\s]?\s*(.*)$/i);
          if (leadingMatch) {
            extractedAmount = extractNumeric(leadingMatch[1]);
            extractedNom = leadingMatch[2].trim();
          }
        }
      }

      extractedNom = (extractedNom || "").trim().replace(/^[-:\s]+|[-:\s]+$/g, '').trim();

      if (extractedNom && extractedNom.toLowerCase() !== 'undefined' && extractedAmount !== null) {
        parsed.push({
          nom: extractedNom,
          forfait: Math.max(0, extractedAmount)
        });
      }
    }

    importedRows = parsed;
  }

  function validerImportCSV() {
    if (importedRows.length === 0) {
      showToast("⚠️ Aucun résultat valide trouvé dans le fichier.");
      return;
    }

    let updated = [...$members];
    let addedCount = 0;
    let updatedCount = 0;

    importedRows.forEach(row => {
      const idx = updated.findIndex(m => isFuzzyMatch(m.nom, row.nom));
      if (idx >= 0) {
        updated[idx] = {
          ...updated[idx],
          nom: row.nom.length > updated[idx].nom.length ? row.nom : updated[idx].nom,
          forfait: row.forfait
        };
        updatedCount++;
      } else {
        updated.push({
          id: Date.now() + Math.random(),
          nom: row.nom,
          forfait: row.forfait,
          dejaPaye: 0,
          payeLe: "",
          email: row.nom.toLowerCase().replace(/\s+/g, ".") + "@email.com"
        });
        addedCount++;
      }
    });

    updated = deduplicateMembersList(updated);
    updateMembers(updated);
    showToast(`🎉 Import réussi : ${addedCount} élève(s) créé(s), ${updatedCount} mis à jour.`);
    showImportModal = false;
    importedRows = [];
    importFileName = "";
    rawPasteText = "";
  }
</script>
{#if currentSubView === "operations"}
  <div style="display: flex; justify-content: flex-end; margin-bottom: 16px;">
    <button 
      class="btn btn-secondary" 
      onclick={() => currentSubView = "tableau_gestion"}
      style="padding: 9px 16px; font-weight: 600; font-size: 0.88rem; background: transparent; border: 1px solid rgba(255, 255, 255, 0.18); color: white; border-radius: 8px; display: flex; align-items: center; gap: 8px; cursor: pointer;"
    >
      <i class="fa-solid fa-arrow-left"></i> Accéder au registre des élèves
    </button>
  </div>

  <div class="glass-card" style="margin-top: 24px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h3 style="font-family: var(--font-title); margin: 0; font-size: 1.3rem; display: flex; align-items: center; gap: 10px;">
        <i class="fa-solid fa-university" style="color: #818cf8;"></i> Opérations bancaires (756 / 706)
      </h3>

      <div style="display: flex; align-items: center; gap: 12px;">
        {#if activeTab === "a_attribuer" && filteredOperations.length > 0}
          <button 
            class="btn btn-cta-magic"
            onclick={toutAssocier}
          >
            <i class="fa-solid fa-wand-magic-sparkles"></i> Tout associer ({filteredOperations.length})
          </button>
        {/if}
        <div style="display: flex; background: #e2e8f0; padding: 4px; border-radius: 8px;">
          <button 
            class="tab-btn"
            style="padding: 8px 18px; font-size: 0.9rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 700; transition: all 0.2s; {activeTab === 'a_attribuer' ? 'background: #0f172a; color: #ffffff;' : 'background: transparent; color: #475569;'}"
            onclick={() => activeTab = "a_attribuer"}
          >
            À attribuer
          </button>
          <button 
            class="tab-btn"
            style="padding: 8px 18px; font-size: 0.9rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 700; transition: all 0.2s; {activeTab === 'attribuees' ? 'background: #0f172a; color: #ffffff;' : 'background: transparent; color: #475569;'}"
            onclick={() => activeTab = "attribuees"}
          >
            Attribuées
          </button>
        </div>
      </div>
    </div>

    <div class="table-container">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Libellé bancaire</th>
            <th>Montant</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {#if filteredOperations.length === 0}
            <tr>
              <td colspan="4" style="text-align: center; color: #64748b; padding: 40px 10px;">
                {#if activeTab === "a_attribuer"}
                  🎉 Aucune opération bancaire en 756 / 706 en attente d'attribution.
                {:else}
                  Aucune opération déjà attribuée.
                {/if}
              </td>
            </tr>
          {:else}
            {#each filteredOperations as tx}
              <tr style="border-bottom: 1px solid #f1f5f9; background: #ffffff;">
                <td style="font-size: 0.9rem; color: #64748b; white-space: nowrap;">{tx.date || tx.datePaiement}</td>
                <td style="color: #0f172a; font-weight: 700; font-size: 0.95rem;">
                  {tx.libelle}
                  <div style="font-size: 0.78rem; color: #4338ca; font-weight: 600; margin-top: 3px;">Compte {tx.compteAttribué || tx.compteCredit || tx.account || "756/706"}</div>
                </td>
                <td class="amount credit" style="font-weight: 800; font-size: 1.05rem; color: #15803d;">+{tx.credit.toFixed(2)} €</td>
                <td>
                  {#if !tx.memberAssociated}
                    <button class="btn btn-cta-members btn-sm" onclick={() => openAssociationModal(tx)} style="white-space: nowrap; background: #0f172a; color: #ffffff; font-weight: 700; border-radius: 6px; padding: 6px 14px; border: none; cursor: pointer;">
                      <i class="fa-solid fa-link"></i> Associer à la gestion
                    </button>
                  {:else}
                    <span class="badge" style="background: #dcfce7; color: #15803d; border: 1px solid #86efac; font-size: 0.85rem; padding: 6px 12px; font-weight: 700;">
                      <i class="fa-solid fa-check"></i> Attribué ({tx.associatedMember || "Élève"})
                    </span>
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
{/if}

{#if currentSubView === "tableau_gestion"}
  <!-- BLOC B : MÉTÉO FINANCIÈRE / TABLEAU DE BORD INSTRUMENTÉ (Cockpit Style) -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
    
    <!-- Card 1: Total attendu -->
    <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 20px 22px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px; position: relative;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">TOTAL ATTENDU (FORFAITS)</span>
        <i class="fa-solid fa-calculator" style="color: #64748b; font-size: 0.85rem;"></i>
      </div>
      <div>
        <div style="font-size: 1.75rem; font-weight: 800; color: #f8fafc; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: -0.5px;">
          {kpiTotalAttendu.toFixed(2)} €
        </div>
      </div>
    </div>

    <!-- Card 2: Déjà encaissé -->
    <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 20px 22px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px; position: relative;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">DÉJÀ ENCAISSÉ</span>
        <span style="font-size: 0.78rem; font-weight: 700; color: #cbd5e1; background: #1e293b; padding: 2px 8px; border-radius: 12px; font-family: ui-monospace, monospace;">{kpiPercentEncaisse}%</span>
      </div>
      <div>
        <div style="font-size: 1.75rem; font-weight: 800; color: #f8fafc; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: -0.5px; margin-bottom: 8px;">
          {kpiTotalEncaisse.toFixed(2)} €
        </div>
        <!-- Mini dashboard progress gauge -->
        <div style="width: 100%; height: 4px; background: #1e293b; border-radius: 2px; overflow: hidden;">
          <div style="width: {kpiPercentEncaisse}%; height: 100%; background: #94a3b8; border-radius: 2px;"></div>
        </div>
      </div>
    </div>

    <!-- Card 3: Reste à recouvrer -->
    <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 20px 22px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px; position: relative;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">RESTE À RECOUVRER</span>
        <i class="fa-solid fa-clock-rotate-left" style="color: #64748b; font-size: 0.85rem;"></i>
      </div>
      <div>
        <div style="font-size: 1.75rem; font-weight: 800; color: #f8fafc; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: -0.5px;">
          {kpiRestant.toFixed(2)} €
        </div>
      </div>
    </div>

    <!-- Card 4: Élèves en retard / impayés -->
    <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 20px 22px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px; position: relative;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">ÉLÈVES EN RETARD / IMPAYÉS</span>
        <i class="fa-solid fa-user-clock" style="color: #64748b; font-size: 0.85rem;"></i>
      </div>
      <div>
        <div style="font-size: 1.75rem; font-weight: 800; color: #f8fafc; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: -0.5px;">
          {kpiImpayesCount} <span style="font-size: 1rem; font-weight: 600; color: #94a3b8;">élève{kpiImpayesCount > 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>

  </div>

  <!-- BLOC C : REGISTRE DE L'ESPACE DE TRAVAIL (Conteneur principal en boîte Slate-900) -->
  <div style="background: #0f172a; border: 1px solid rgba(51, 65, 85, 0.6); border-radius: 14px; padding: 24px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);">
    
    <!-- Barre d'outils supérieure avec respiration et alignement parfait -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; padding-bottom: 6px;">
      <!-- Côté Gauche (Filtrer & Trouver) : Filtres de statut -->
      <div style="display: flex; gap: 8px; align-items: center;">
        <button 
          class="chip-filter-btn"
          style="padding: 8px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; {memberFilter === 'tous' ? 'background: rgba(255, 255, 255, 0.12); color: white; border: 1px solid rgba(255, 255, 255, 0.3);' : 'background: rgba(0, 0, 0, 0.4); color: rgba(255, 255, 255, 0.6); border: 1px solid rgba(255, 255, 255, 0.08);'}"
          onclick={() => memberFilter = 'tous'}
        >
          Tous <span style="background: rgba(255,255,255,0.15); color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 700;">{report.length}</span>
        </button>

        <button 
          class="chip-filter-btn"
          style="padding: 8px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; {memberFilter === 'payes' ? 'background: rgba(255, 255, 255, 0.12); color: white; border: 1px solid rgba(255, 255, 255, 0.3);' : 'background: rgba(0, 0, 0, 0.4); color: rgba(255, 255, 255, 0.6); border: 1px solid rgba(255, 255, 255, 0.08);'}"
          onclick={() => memberFilter = 'payes'}
        >
          À jour <span style="background: rgba(255, 255, 255, 0.15); color: #e2e8f0; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 700;">{report.filter(m => m.resteAPayer === 0).length}</span>
        </button>

        <button 
          class="chip-filter-btn"
          style="padding: 8px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; {memberFilter === 'impayes' ? 'background: rgba(255, 255, 255, 0.12); color: white; border: 1px solid rgba(255, 255, 255, 0.3);' : 'background: rgba(0, 0, 0, 0.4); color: rgba(255, 255, 255, 0.6); border: 1px solid rgba(255, 255, 255, 0.08);'}"
          onclick={() => memberFilter = 'impayes'}
        >
          Impayés <span style="background: rgba(255, 255, 255, 0.15); color: #e2e8f0; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 700;">{kpiImpayesCount}</span>
        </button>

        <!-- Display Mode Switcher (Feuillets vs Scroll) -->
        <div style="display: flex; background: rgba(0, 0, 0, 0.4); padding: 3px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.1); margin-left: 8px;">
          <button 
            type="button"
            class="view-mode-btn"
            style="padding: 5px 12px; font-size: 0.8rem; font-weight: 600; border-radius: 16px; border: none; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; {viewMode === 'pagination' ? 'background: #334155; color: white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);' : 'background: transparent; color: rgba(255, 255, 255, 0.5);'}"
            onclick={() => viewMode = 'pagination'}
            title="Affichage page par page (Feuillets)"
          >
            <i class="fa-solid fa-file-lines"></i> Feuillets
          </button>

          <button 
            type="button"
            class="view-mode-btn"
            style="padding: 5px 12px; font-size: 0.8rem; font-weight: 600; border-radius: 16px; border: none; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; {viewMode === 'scroll' ? 'background: #334155; color: white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);' : 'background: transparent; color: rgba(255, 255, 255, 0.5);'}"
            onclick={() => viewMode = 'scroll'}
            title="Vue globale en défilement continu"
          >
            <i class="fa-solid fa-scroll"></i> Vue globale (Scroll)
          </button>
        </div>
      </div>

      <!-- Côté Droit : Search Input + Ghost Button + Primary CTA -->
      <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
        <!-- Search Input with Loupe Icon -->
        <div style="position: relative; display: flex; align-items: center;">
          <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 14px; color: rgba(255, 255, 255, 0.4); font-size: 0.85rem; pointer-events: none;"></i>
          <input 
            type="text" 
            placeholder="Rechercher par nom..." 
            bind:value={searchQuery}
            style="padding: 9px 14px 9px 38px; border-radius: 8px; background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.15); color: white; font-size: 0.88rem; width: 230px; outline: none; transition: border-color 0.2s;"
          />
        </div>

        <!-- Ghost Action button -->
        <button 
          class="btn btn-secondary" 
          onclick={() => currentSubView = "operations"}
          style="padding: 9px 16px; font-weight: 600; font-size: 0.88rem; background: transparent; border: 1px solid rgba(255, 255, 255, 0.18); color: white; border-radius: 8px; display: flex; align-items: center; gap: 8px; cursor: pointer;"
        >
          <i class="fa-solid fa-university" style="color: var(--text-secondary);"></i> Voir les opérations bancaires
        </button>

        <!-- Primary CTA Action button -->
        <button 
          class="btn btn-cta-import"
          onclick={() => showImportModal = true}
          style="padding: 9px 18px; font-weight: 700; font-size: 0.88rem; border-radius: 8px; display: flex; align-items: center; gap: 8px;"
        >
          <i class="fa-solid fa-file-import"></i> + Importer la liste des élèves
        </button>
      </div>
    </div>

    <!-- Table Container with Border and Alternating Rows -->
    <div style="border: 1px solid rgba(51, 65, 85, 0.6); border-radius: 10px; overflow: hidden; background: rgba(15, 23, 42, 0.6); {viewMode === 'scroll' ? 'max-height: 530px; overflow-y: auto;' : ''}">
      <table class="custom-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #1e293b; border-bottom: 2px solid #334155; {viewMode === 'scroll' ? 'position: sticky; top: 0; z-index: 10; box-shadow: 0 2px 8px rgba(0,0,0,0.3);' : ''}">
            <th style="padding: 14px 18px; text-align: left; font-size: 0.85rem; font-weight: 700; color: #f8fafc; text-transform: uppercase; letter-spacing: 0.5px;">Nom de l'adhérent</th>
            <th style="padding: 14px 18px; text-align: right; font-size: 0.85rem; font-weight: 700; color: #f8fafc; text-transform: uppercase; letter-spacing: 0.5px;">Montant forfait</th>
            <th style="padding: 14px 18px; text-align: right; font-size: 0.85rem; font-weight: 700; color: #f8fafc; text-transform: uppercase; letter-spacing: 0.5px;">Déjà versé</th>
            <th style="padding: 14px 18px; text-align: right; font-size: 0.85rem; font-weight: 700; color: #f8fafc; text-transform: uppercase; letter-spacing: 0.5px;">Reste à régler</th>
            <th style="padding: 14px 18px; text-align: center; font-size: 0.85rem; font-weight: 700; color: #f8fafc; text-transform: uppercase; letter-spacing: 0.5px;">Statut</th>
            <th style="padding: 14px 18px; text-align: right; font-size: 0.85rem; font-weight: 700; color: #f8fafc; text-transform: uppercase; letter-spacing: 0.5px;">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#if displayedMembers.length === 0}
            <tr>
              <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 45px 10px;">
                Aucun élève ne correspond aux critères de recherche.
              </td>
            </tr>
          {:else}
            {#each displayedMembers as m, index}
              <tr 
                class="student-row"
                style="border-bottom: 1px solid #334155; background: {index % 2 === 0 ? '#0f172a' : '#1e293b'}; transition: all 0.15s ease;"
              >
                <td style="padding: 14px 18px; text-align: left;">
                  <div style="font-weight: 700; color: white; font-size: 0.98rem;">{m.cleanName}</div>
                  {#if m.rawRef}
                    <div style="font-size: 0.76rem; color: rgba(255, 255, 255, 0.45); margin-top: 2px;">
                      └ {m.rawRef}
                    </div>
                  {/if}
                </td>
                
                <!-- Financial Columns Right Aligned with Monospace tabular-nums in crisp monochrome -->
                <td style="padding: 14px 18px; text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-variant-numeric: tabular-nums; font-weight: 600; color: #f8fafc; font-size: 0.95rem;">
                  {m.forfait.toFixed(2)} €
                </td>

                <td style="padding: 14px 18px; text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-variant-numeric: tabular-nums; font-weight: 600; color: {m.dejaPaye > 0 ? '#f8fafc' : '#64748b'}; font-size: 0.95rem;">
                  {m.dejaPaye > 0 ? `${m.dejaPaye.toFixed(2)} €` : '0,00 €'}
                </td>

                <td style="padding: 14px 18px; text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-variant-numeric: tabular-nums; font-weight: 600; color: {m.resteAPayer > 0 ? '#f8fafc' : '#64748b'}; font-size: 0.95rem;">
                  {m.resteAPayer > 0 ? `${m.resteAPayer.toFixed(2)} €` : '0,00 €'}
                </td>

                <td style="padding: 14px 18px; text-align: center;">
                  <span class="badge {m.badgeClass}" style="font-weight: 700; padding: 5px 12px; font-size: 0.78rem;">{m.statut}</span>
                </td>

                <td style="padding: 14px 18px; text-align: right; white-space: nowrap;">
                  <button class="btn btn-secondary btn-sm" onclick={() => openDrawerModal(m)} title="Voir le détail des règlements" style="padding: 5px 12px; font-size: 0.8rem; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);">
                    <i class="fa-solid fa-list-check"></i> Détails
                  </button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Footer Controls (Pagination when in 'pagination' mode, or Scroll info when in 'scroll' mode) -->
    {#if filteredMembers.length > 0}
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 18px; padding-top: 14px; border-top: 1px solid rgba(51, 65, 85, 0.5); font-size: 0.88rem; color: rgba(255, 255, 255, 0.6);">
        {#if viewMode === 'pagination'}
          <div>
            Affichage <strong>{Math.min((currentPage - 1) * pageSize + 1, filteredMembers.length)}</strong> à <strong>{Math.min(currentPage * pageSize, filteredMembers.length)}</strong> sur <strong>{filteredMembers.length}</strong> élèves
          </div>

          {#if totalPages > 1}
            <div style="display: flex; gap: 6px; align-items: center;">
              <button 
                class="btn btn-secondary btn-sm"
                disabled={currentPage === 1}
                onclick={() => currentPage--}
                style="padding: 5px 12px; font-size: 0.82rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: white;"
              >
                <i class="fa-solid fa-chevron-left"></i> Précédent
              </button>

              {#each Array.from({ length: totalPages }) as _, i}
                <button 
                  onclick={() => currentPage = i + 1}
                  style="width: 32px; height: 32px; border-radius: 6px; font-size: 0.85rem; font-weight: 700; cursor: pointer; border: 1px solid {currentPage === i + 1 ? '#6366f1' : 'rgba(255,255,255,0.12)'}; background: {currentPage === i + 1 ? '#6366f1' : 'rgba(255,255,255,0.05)'}; color: white; transition: all 0.2s;"
                >
                  {i + 1}
                </button>
              {/each}

              <button 
                class="btn btn-secondary btn-sm"
                disabled={currentPage === totalPages}
                onclick={() => currentPage++}
                style="padding: 5px 12px; font-size: 0.82rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: white;"
              >
                Suivant <i class="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          {/if}
        {:else}
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div>
              📜 <strong>{filteredMembers.length}</strong> élèves affichés en défilement continu
            </div>
            <button 
              class="btn btn-secondary btn-sm"
              onclick={() => viewMode = 'pagination'}
              style="padding: 5px 12px; font-size: 0.82rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: white;"
            >
              <i class="fa-solid fa-file-lines"></i> Passer en mode Feuillets
            </button>
          </div>
        {/if}
      </div>
    {/if}

  </div>
{/if}

<!-- Import Modal -->
{#if showImportModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-backdrop" onclick={() => showImportModal = false} role="presentation" style="position: fixed; inset: 0; background: rgba(5, 7, 15, 0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 100000; padding: 20px;">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
    <div class="glass-card modal-content" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1" style="max-width: 620px; padding: 28px; width: 100%; max-height: 90vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
        <h3 style="font-family: var(--font-title); margin: 0; font-size: 1.25rem; display: flex; align-items: center; gap: 10px; color: white;">
          <i class="fa-solid fa-file-import" style="color: #818cf8;"></i> Import des données de gestion
        </h3>
        <button type="button" onclick={() => showImportModal = false} style="background: none; border: none; color: rgba(255,255,255,0.6); font-size: 1.4rem; cursor: pointer;">✕</button>
      </div>

      <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; font-size: 0.9rem; color: rgba(255, 255, 255, 0.9); line-height: 1.5;">
        <p style="margin: 0 0 10px 0;">
          Déposez votre tableau (Excel ou CSV). Nous avons seulement besoin de deux informations : <strong>le nom de l'élève ou du client</strong> et <strong>le montant total de son inscription ou de son dû</strong> (forfait annuel, trimestriel, achat de produit...).
        </p>
        <button 
          type="button" 
          onclick={telechargerModeleCSV}
          style="background: transparent; border: 1px solid rgba(129, 140, 248, 0.5); color: #a5b4fc; padding: 6px 14px; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;"
        >
          <i class="fa-solid fa-download"></i> Télécharger un modèle exemple (CSV)
        </button>
      </div>

      <!-- Tabs : Fichier vs Copier-Coller -->
      <div style="display: flex; gap: 10px; margin-bottom: 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 10px;">
        <button 
          type="button"
          style="background: {activeImportTab === 'file' ? '#6366f1' : 'transparent'}; color: {activeImportTab === 'file' ? 'white' : 'rgba(255,255,255,0.6)'}; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 0.88rem; cursor: pointer;"
          onclick={() => activeImportTab = 'file'}
        >
          📁 Importer un fichier CSV/Excel
        </button>
        <button 
          type="button"
          style="background: {activeImportTab === 'paste' ? '#6366f1' : 'transparent'}; color: {activeImportTab === 'paste' ? 'white' : 'rgba(255,255,255,0.6)'}; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 0.88rem; cursor: pointer;"
          onclick={() => activeImportTab = 'paste'}
        >
          📋 Copier / Coller le texte directement
        </button>
      </div>

      {#if activeImportTab === 'file'}
        <!-- Zone de dépôt / sélection de fichier -->
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div 
          class="file-upload-zone" 
          onclick={() => fileInputEl && fileInputEl.click()}
          ondragover={(e) => e.preventDefault()}
          ondrop={(e) => { e.preventDefault(); handleFileSelect(e); }}
          style="border: 2px dashed rgba(99, 102, 241, 0.4); background: rgba(99, 102, 241, 0.05); padding: 24px 16px; border-radius: 12px; text-align: center; cursor: pointer; margin-bottom: 16px; transition: all 0.2s;"
        >
          <input 
            bind:this={fileInputEl}
            type="file" 
            accept=".csv, .txt, .tsv" 
            onchange={handleFileSelect} 
            style="display: none;" 
          />
          <i class="fa-solid fa-cloud-arrow-up" style="font-size: 2.2rem; color: #818cf8; margin-bottom: 10px;"></i>
          <div style="font-weight: 700; color: white; font-size: 1rem;">
            {importFileName ? `Fichier sélectionné : ${importFileName}` : "Déposez votre fichier CSV ou cliquez ici"}
          </div>
          <div style="font-size: 0.8rem; color: rgba(255, 255, 255, 0.5); margin-top: 4px;">
            Formats acceptés : CSV, TXT, TSV (séparateur point-virgule, virgule ou tabulation)
          </div>
        </div>
      {:else}
        <!-- Zone de Copier-Coller texte brute -->
        <div style="margin-bottom: 16px;">
          <textarea
            placeholder="Collez ici les lignes de votre tableau Excel ou CSV (ex: Dupont Marc;350.00)"
            rows="5"
            bind:value={rawPasteText}
            oninput={(e) => parseCSVMembers(/** @type {HTMLTextAreaElement} */ (e.target).value)}
            style="width: 100%; padding: 12px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white; font-family: monospace; font-size: 0.85rem;"
          ></textarea>
        </div>
      {/if}

      <!-- Aperçu en direct des lignes extraites -->
      {#if importedRows.length > 0}
        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
          <div style="font-weight: 700; color: #34d399; font-size: 0.9rem; margin-bottom: 8px;">
            ✅ {importedRows.length} élève(s) / client(s) identifié(s) prêt(s) à l'import :
          </div>
          <div style="max-height: 120px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
            {#each importedRows.slice(0, 5) as row}
              <div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: rgba(255,255,255,0.9); border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 2px;">
                <span>👤 {row.nom}</span>
                <span style="font-weight: 700; color: #a5b4fc;">{row.forfait.toFixed(2)} €</span>
              </div>
            {/each}
            {#if importedRows.length > 5}
              <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5); margin-top: 2px;">...et {importedRows.length - 5} autre(s) entrée(s)</div>
            {/if}
          </div>
        </div>
      {:else if importFileName || rawPasteText}
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; color: #f87171; font-size: 0.85rem;">
          ⚠️ Aucun nom et montant lisibles n'ont pu être extraits de ces données. Vérifiez que votre tableau contient au moins le nom et un montant numérique.
        </div>
      {/if}

      <div style="display: flex; justify-content: flex-end; gap: 12px;">
        <button type="button" class="btn btn-secondary" onclick={() => showImportModal = false}>Annuler</button>
        <button 
          type="button" 
          class="btn btn-cta-import" 
          onclick={validerImportCSV}
          disabled={importedRows.length === 0}
        >
          <i class="fa-solid fa-check"></i> Lancer l'import ({importedRows.length})
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Drawer Modal pour le détail des règlements -->
{#if showDrawerModal && selectedMemberForDrawer}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-backdrop" onclick={() => showDrawerModal = false} role="presentation" style="position: fixed; inset: 0; background: rgba(5, 7, 15, 0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 100000; padding: 20px;">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
    <div class="glass-card modal-content" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1" style="max-width: 540px; width: 100%; max-height: 90vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
        <div>
          <h3 style="font-family: var(--font-title); margin: 0;">{selectedMemberForDrawer.cleanName}</h3>
          <div style="font-size: 0.8rem; color: rgba(255, 255, 255, 0.5); margin-top: 2px;">Réf : {selectedMemberForDrawer.rawRef}</div>
        </div>
        <span class="badge {selectedMemberForDrawer.badgeClass}">{selectedMemberForDrawer.statut}</span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; background: rgba(0,0,0,0.25); padding: 14px; border-radius: 10px; margin-bottom: 20px;">
        <div>
          <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5);">Forfait total</div>
          <div style="font-weight: 700; font-size: 1.1rem; color: white;">{selectedMemberForDrawer.forfait.toFixed(2)} €</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5);">Déjà versé</div>
          <div style="font-weight: 700; font-size: 1.1rem; color: #34d399;">{selectedMemberForDrawer.dejaPaye.toFixed(2)} €</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5);">Reste dû</div>
          <div style="font-weight: 700; font-size: 1.1rem; color: {selectedMemberForDrawer.resteAPayer > 0 ? '#f87171' : 'white'};">{selectedMemberForDrawer.resteAPayer.toFixed(2)} €</div>
        </div>
      </div>

      <h4 style="font-size: 0.95rem; margin-bottom: 10px; color: rgba(255,255,255,0.9);">Historique des règlements & échéances</h4>
      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; padding: 10px 14px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px;">
          <div>
            <div style="font-weight: 600; font-size: 0.88rem; color: white;">Règlement virement bancaire</div>
            <div style="font-size: 0.78rem; color: rgba(255,255,255,0.5);">{selectedMemberForDrawer.payeLe || 'Reçu'}</div>
          </div>
          <div style="font-weight: 700; color: #34d399;">+{selectedMemberForDrawer.dejaPaye.toFixed(2)} €</div>
        </div>
        {#if selectedMemberForDrawer.resteAPayer > 0}
          <div style="display: flex; justify-content: space-between; padding: 10px 14px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px;">
            <div>
              <div style="font-weight: 600; font-size: 0.88rem; color: #f87171;">Échéance en attente</div>
              <div style="font-size: 0.78rem; color: rgba(255,255,255,0.5);">Solde à régler</div>
            </div>
            <div style="font-weight: 700; color: #f87171;">{selectedMemberForDrawer.resteAPayer.toFixed(2)} €</div>
          </div>
        {/if}
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 12px;">
        <button type="button" class="btn btn-secondary" onclick={() => showDrawerModal = false}>Fermer</button>
      </div>
    </div>
  </div>
{/if}

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-backdrop" onclick={closeModal} role="presentation" style="position: fixed; inset: 0; background: rgba(5, 7, 15, 0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 100000; padding: 20px;">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
    <div class="glass-card modal-content" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1" style="max-width: 540px; width: 100%; max-height: 90vh; overflow-y: auto;">
      <h3 style="font-family: var(--font-title); margin-bottom: 16px;">
        <i class="fa-solid fa-link" style="color: #818cf8;"></i> Associer à la gestion des élèves
      </h3>
      
      <p style="font-size: 0.9rem; color: rgba(255, 255, 255, 0.7); margin-bottom: 20px;">
        Opération : <strong style="color: white;">{selectedTx?.libelle}</strong>
      </p>

      <form onsubmit={validerAssociation}>
        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" for="modal-nom">Nom de l'élève ou de l'adhérent</label>
          <input id="modal-nom" type="text" class="input-field" bind:value={nomEleve} required />
        </div>

        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" for="modal-montant-verse">Montant versé (€)</label>
          <div id="modal-montant-verse" style="padding: 10px 14px; border-radius: 8px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; font-weight: 700; font-size: 1.1rem;">
            {montantVerse.toFixed(2)} € (Récupéré de la banque)
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 24px;">
          <label class="form-label" for="modal-montant-forfait">Montant Total du Forfait / Cotisation (€)</label>
          <input id="modal-montant-forfait" type="number" class="input-field" placeholder="ex: 350" bind:value={montantTotalPercevoir} required />
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 12px;">
          <button type="button" class="btn btn-secondary" onclick={closeModal}>Annuler</button>
          <button type="submit" class="btn btn-cta-members">Valider l'association</button>
        </div>
      </form>
    </div>
  </div>
{/if}
