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
  <div class="page-title-section" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
    <div>
      <h1 class="page-title">Mon Espace Association</h1>
      <p class="page-subtitle">Gestion des cotisations et association des opérations bancaires aux élèves.</p>
    </div>

    <button 
      class="btn btn-primary" 
      onclick={() => currentSubView = "tableau_gestion"}
      style="padding: 12px 20px; font-weight: 600; font-size: 0.95rem; background: #6366f1; border: none; border-radius: 10px; display: flex; align-items: center; gap: 10px; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);"
    >
      <i class="fa-solid fa-table-list"></i> Accéder au tableau de gestion
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
            class="btn btn-primary"
            style="padding: 8px 16px; font-size: 0.88rem; border-radius: 8px; font-weight: 600; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); border: none; color: white; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 3px 10px rgba(99, 102, 241, 0.3);"
            onclick={toutAssocier}
          >
            <i class="fa-solid fa-wand-magic-sparkles"></i> Tout associer ({filteredOperations.length})
          </button>
        {/if}
        <div style="display: flex; background: rgba(0, 0, 0, 0.3); padding: 4px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08);">
          <button 
            class="tab-btn"
            style="padding: 8px 18px; font-size: 0.9rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; transition: all 0.2s; {activeTab === 'a_attribuer' ? 'background: #6366f1; color: white; box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);' : 'background: transparent; color: rgba(255, 255, 255, 0.6);'}"
            onclick={() => activeTab = "a_attribuer"}
          >
            À attribuer
          </button>
          <button 
            class="tab-btn"
            style="padding: 8px 18px; font-size: 0.9rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; transition: all 0.2s; {activeTab === 'attribuees' ? 'background: #10b981; color: white; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);' : 'background: transparent; color: rgba(255, 255, 255, 0.6);'}"
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
              <td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 40px 10px;">
                {#if activeTab === "a_attribuer"}
                  🎉 Aucune opération bancaire en 756 / 706 en attente d'attribution.
                {:else}
                  Aucune opération déjà attribuée.
                {/if}
              </td>
            </tr>
          {:else}
            {#each filteredOperations as tx}
              <tr>
                <td style="font-size: 0.9rem; opacity: 0.8; white-space: nowrap;">{tx.date || tx.datePaiement}</td>
                <td style="color: white; font-weight: 500; font-size: 0.95rem;">
                  {tx.libelle}
                  <div style="font-size: 0.78rem; color: #818cf8; margin-top: 3px;">Compte {tx.compteAttribué || tx.compteCredit || tx.account || "756/706"}</div>
                </td>
                <td class="amount credit" style="font-weight: 700; font-size: 1.05rem;">+{tx.credit.toFixed(2)} €</td>
                <td>
                  {#if !tx.memberAssociated}
                    <button class="btn btn-primary btn-sm" onclick={() => openAssociationModal(tx)} style="white-space: nowrap;">
                      <i class="fa-solid fa-link"></i> Associer à la gestion
                    </button>
                  {:else}
                    <span class="badge badge-success" style="font-size: 0.85rem; padding: 6px 12px;">
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
  <div class="page-title-section" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
    <div>
      <h1 class="page-title">Gestion des Élèves et Adhérents</h1>
      <p class="page-subtitle">Suivez le statut de règlement des inscriptions et gérez les relances.</p>
    </div>

    <button 
      class="btn" 
      onclick={() => currentSubView = "operations"}
      style="padding: 12px 20px; font-weight: 600; font-size: 0.95rem; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); color: white; border-radius: 10px; display: flex; align-items: center; gap: 10px;"
    >
      <i class="fa-solid fa-university"></i> Voir les opérations bancaires
    </button>
  </div>

  <!-- KPI Cards Header -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
    <div class="glass-card" style="padding: 18px; display: flex; flex-direction: column; gap: 6px; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2);">
      <div style="font-size: 0.78rem; color: rgba(255, 255, 255, 0.6); font-weight: 700; text-transform: uppercase;">Total attendu (Forfaits)</div>
      <div style="font-size: 1.6rem; font-weight: 800; color: white;">{kpiTotalAttendu.toFixed(2)} €</div>
    </div>

    <div class="glass-card" style="padding: 18px; display: flex; flex-direction: column; gap: 6px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2);">
      <div style="font-size: 0.78rem; color: rgba(255, 255, 255, 0.6); font-weight: 700; text-transform: uppercase; display: flex; justify-content: space-between;">
        <span>Déjà encaissé</span>
        <span style="color: #34d399;">({kpiPercentEncaisse}%)</span>
      </div>
      <div style="font-size: 1.6rem; font-weight: 800; color: #34d399;">{kpiTotalEncaisse.toFixed(2)} €</div>
    </div>

    <div class="glass-card" style="padding: 18px; display: flex; flex-direction: column; gap: 6px; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2);">
      <div style="font-size: 0.78rem; color: rgba(255, 255, 255, 0.6); font-weight: 700; text-transform: uppercase;">Reste à recouvrer</div>
      <div style="font-size: 1.6rem; font-weight: 800; color: {kpiRestant > 0 ? '#fbbf24' : 'white'};">{kpiRestant.toFixed(2)} €</div>
    </div>

    <div class="glass-card" style="padding: 18px; display: flex; flex-direction: column; gap: 6px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2);">
      <div style="font-size: 0.78rem; color: rgba(255, 255, 255, 0.6); font-weight: 700; text-transform: uppercase;">Élèves en retard / impayés</div>
      <div style="font-size: 1.6rem; font-weight: 800; color: {kpiImpayesCount > 0 ? '#f87171' : '#34d399'};">{kpiImpayesCount} élève{kpiImpayesCount > 1 ? 's' : ''}</div>
    </div>
  </div>

  <!-- Full Width Student Register with Top Filter Controls -->
  <div class="glass-card">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
      <!-- Filter Tabs -->
      <div style="display: flex; background: rgba(0, 0, 0, 0.3); padding: 4px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08);">
        <button 
          class="tab-btn"
          style="padding: 8px 16px; font-size: 0.88rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; transition: all 0.2s; {memberFilter === 'tous' ? 'background: #6366f1; color: white;' : 'background: transparent; color: rgba(255, 255, 255, 0.6);'}"
          onclick={() => memberFilter = 'tous'}
        >
          Tous ({report.length})
        </button>
        <button 
          class="tab-btn"
          style="padding: 8px 16px; font-size: 0.88rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; transition: all 0.2s; {memberFilter === 'payes' ? 'background: #10b981; color: white;' : 'background: transparent; color: rgba(255, 255, 255, 0.6);'}"
          onclick={() => memberFilter = 'payes'}
        >
          À jour ({report.filter(m => m.resteAPayer === 0).length})
        </button>
        <button 
          class="tab-btn"
          style="padding: 8px 16px; font-size: 0.88rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; transition: all 0.2s; {memberFilter === 'impayes' ? 'background: #ef4444; color: white;' : 'background: transparent; color: rgba(255, 255, 255, 0.6);'}"
          onclick={() => memberFilter = 'impayes'}
        >
          ⚠️ Impayés / Partiels ({kpiImpayesCount})
        </button>
      </div>

      <!-- Action buttons & Search input -->
      <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
        <div style="position: relative;">
          <input 
            type="text" 
            placeholder="🔍 Rechercher un élève..." 
            bind:value={searchQuery}
            style="padding: 8px 14px 8px 14px; border-radius: 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); color: white; font-size: 0.88rem; width: 220px;"
          />
        </div>

        <button 
          class="btn btn-primary"
          style="padding: 8px 16px; font-size: 0.88rem; border-radius: 8px; font-weight: 600; display: flex; align-items: center; gap: 8px;"
          onclick={() => showImportModal = true}
        >
          <i class="fa-solid fa-file-import"></i> + Import des données de gestion
        </button>
      </div>
    </div>

    <div class="table-container">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Nom de l'adhérent</th>
            <th>Montant forfait</th>
            <th>Déjà versé</th>
            <th>Reste à régler</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#if filteredMembers.length === 0}
            <tr>
              <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 40px 10px;">
                Aucun élève ne correspond aux critères de recherche.
              </td>
            </tr>
          {:else}
            {#each filteredMembers as m}
              <tr>
                <td style="padding: 12px 16px;">
                  <div style="font-weight: 700; color: white; font-size: 0.98rem;">{m.cleanName}</div>
                  {#if m.rawRef}
                    <div style="font-size: 0.76rem; color: rgba(255, 255, 255, 0.45); margin-top: 2px;">
                      └ {m.rawRef}
                    </div>
                  {/if}
                </td>
                <td style="font-weight: 600; color: white;">{m.forfait.toFixed(2)} €</td>
                <td style="color: #34d399; font-weight: 700;">{m.dejaPaye.toFixed(2)} €</td>
                <td style="color: {m.resteAPayer > 0 ? '#f87171' : 'var(--text-secondary)'}; font-weight: 700;">
                  {m.resteAPayer.toFixed(2)} €
                </td>
                <td>
                  <span class="badge {m.badgeClass}" style="font-weight: 700; padding: 5px 10px; font-size: 0.8rem;">{m.statut}</span>
                </td>
                <td style="white-space: nowrap;">
                  <div style="display: flex; gap: 8px;">
                    <button class="btn btn-secondary btn-sm" onclick={() => openDrawerModal(m)} title="Voir le détail des règlements">
                      <i class="fa-solid fa-list-check"></i> Détails
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
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
          class="btn btn-primary" 
          onclick={validerImportCSV}
          disabled={importedRows.length === 0}
          style="padding: 10px 22px; font-weight: 600; background: #6366f1; border: none; border-radius: 8px;"
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
          <button type="submit" class="btn btn-primary">Valider l'association</button>
        </div>
      </form>
    </div>
  </div>
{/if}
