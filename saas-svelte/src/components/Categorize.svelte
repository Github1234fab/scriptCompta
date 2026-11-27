<script>
  import { Categorizer } from "../lib/categorizer.js";
  import { CSVParser } from "../lib/parser.js";
  import { getTitoRowExplanation } from "../lib/titoExplainer.js";
  import InfoTip from "./InfoTip.svelte";

  import { onMount } from "svelte";
  import { 
    transactions, 
    planComptable, 
    rules, 
    entities,
    activeEntityId,
    activeTxId, 
    updateTransactions, 
    updatePlanComptable,
    updateRules, 
    showToast,
    isPremium,
    showUpgradeModal,
    FREE_TIER_MAX_TRANSACTIONS,
    formatDateFr,
    openHelpGuide,
    openTitoChat,
    saveCsvMetadata
  } from "../lib/store.js";
  
  // Reactive transaction lists filtrées strictement par structure active
  let activeEntityModel = $derived($entities.find((e) => e.id === $activeEntityId)?.model || 'micro');
  let currentStructureTx = $derived($transactions.filter((t) => (!t.entityId || t.entityId === $activeEntityId)));

  // Active tab filter: 'pending' vs 'categorized' vs null
  /** @type {'pending' | 'categorized' | null} */
  let activeTab = $state('pending');

  // Similar transactions modal state
  let showSimilarTxModal = $state(false);
  let targetSimilarCategory = $state('');
  /** @type {any} */
  let pendingPrimaryTx = $state(null);
  /** @type {any[]} */
  let matchingSimilarTxList = $state([]);
  /** @type {Set<any>} */
  let selectedSimilarTxIds = $state(new Set());

  // Pedagogical onboarding modal state
  let showPedagogicalModal = $state(false);
  let dontShowAgain = $state(false);

  // Dictionnaire d'attribution & Sous-comptes avancés modal state
  let showDictionaryModal = $state(false);
  /** @type {'rules' | 'subaccounts'} */
  let dictModalTab = $state('rules');
  let newRuleKeyword = $state('');
  let newRuleType = $state('debit'); // 'debit' | 'credit'
  let newRuleAccount = $state('606');
  let dictionarySearch = $state('');

  // Création guidée d'un sous-compte personnalisé (mode avancé)
  let newSubParentCompte = $state('606');
  let newSubSuffix = $state('');
  let newSubLabel = $state('');
  let newSubDesc = $state('');

  let standardParentAccounts = $derived(
    $planComptable
      .filter(p => p.compte !== '699' && !p.isCustom)
      .slice()
      .sort((a, b) => a.compte.localeCompare(b.compte, undefined, { numeric: true }))
  );

  let customSubAccounts = $derived(
    $planComptable
      .filter(p => p.isCustom)
      .slice()
      .sort((a, b) => a.compte.localeCompare(b.compte, undefined, { numeric: true }))
  );

  let cleanedSubSuffix = $derived(newSubSuffix.replace(/[^0-9]/g, '').slice(0, 4));
  let computedSubCompte = $derived(cleanedSubSuffix ? `${newSubParentCompte}${cleanedSubSuffix}` : '');

  function handleAddCustomSubAccount() {
    const suffix = newSubSuffix.replace(/[^0-9]/g, '').slice(0, 4);
    const label = newSubLabel.trim();
    if (!newSubParentCompte) {
      showToast('Veuillez choisir un compte parent officiel.');
      return;
    }
    if (!suffix) {
      showToast('Saisissez 1 à 4 chiffres pour le suffixe du sous-compte (ex : 23).');
      return;
    }
    if (!label) {
      showToast('Veuillez donner un libellé clair à ce sous-compte.');
      return;
    }

    const fullCode = `${newSubParentCompte}${suffix}`;
    if ($planComptable.some(p => p.compte === fullCode)) {
      showToast(`Le compte ${fullCode} existe déjà dans votre plan comptable.`);
      return;
    }

    const parent = $planComptable.find(p => p.compte === newSubParentCompte);
    const newAccount = {
      compte: fullCode,
      libelle: label,
      type: parent?.type || (fullCode.startsWith('7') ? 'Produit' : fullCode.startsWith('6') || fullCode.startsWith('2') ? 'Charge' : 'Transfert'),
      group: parent?.group || (fullCode.startsWith('7') ? 'entrees' : 'depenses_courantes'),
      desc: newSubDesc.trim() || `Sous-compte personnalisé rattaché à ${newSubParentCompte} (${parent?.libelle || ''}).`,
      isCustom: true,
      parentCompte: newSubParentCompte
    };

    updatePlanComptable([...$planComptable, newAccount]);
    newSubSuffix = '';
    newSubLabel = '';
    newSubDesc = '';
    showToast(`Sous-compte ${fullCode} « ${label} » créé avec succès.`);
  }

  /** @param {string} compteCode */
  function handleDeleteCustomSubAccount(compteCode) {
    const usedCount = currentStructureTx.filter(t => String(t.compteAttribué) === String(compteCode)).length;
    if (usedCount > 0) {
      if (!confirm(`Le sous-compte ${compteCode} est déjà utilisé par ${usedCount} opération(s). Voulez-vous vraiment le retirer de la liste ? (Vos écritures déjà attribuées resteront intactes.)`)) {
        return;
      }
    }
    updatePlanComptable($planComptable.filter(p => p.compte !== compteCode));
    showToast(`Sous-compte ${compteCode} supprimé.`);
  }

  function openSubAccountsManager() {
    showCategorizeModal = false;
    dictModalTab = 'subaccounts';
    showDictionaryModal = true;
  }

  let filteredRules = $derived(
    $rules.filter(r => {
      if (!dictionarySearch.trim()) return true;
      const q = Categorizer.normaliserTexte(dictionarySearch);
      const kw = Categorizer.normaliserTexte(r.motCle);
      const note = Categorizer.normaliserTexte(r.note || '');
      return kw.includes(q) || note.includes(q) || (r.debit && r.debit.includes(q)) || (r.credit && r.credit.includes(q));
    })
  );

  // Synchroniser le compte par défaut lorsque le sens change (Recette -> 706, Dépense -> 606)
  $effect(() => {
    if (newRuleType === 'credit' && (newRuleAccount.startsWith('6') || !newRuleAccount)) {
      newRuleAccount = '706';
    } else if (newRuleType === 'debit' && (newRuleAccount.startsWith('7') || !newRuleAccount)) {
      newRuleAccount = '606';
    }
  });

  function handleAddDictionaryRule() {
    if (!newRuleKeyword.trim()) {
      showToast('Veuillez renseigner un mot-clé ou un nom.');
      return;
    }
    const clean = Categorizer.normaliserTexte(newRuleKeyword);
    const ok = Categorizer.ajouterRegle(clean, newRuleAccount, newRuleType);
    if (ok) {
      selectedCategoryMap = {};
      showToast(`"${clean}" ajouté au dictionnaire d'attribution.`);
      newRuleKeyword = '';
    }
  }

  /** @param {string} motCle */
  function handleDeleteDictionaryRule(motCle) {
    Categorizer.supprimerRegle(motCle);
    selectedCategoryMap = {};
    showToast(`Règle "${motCle}" retirée du dictionnaire.`);
  }

  // État et fonctions d'édition en ligne du dictionnaire d'attribution
  /** @type {string | null} */
  let editingRuleOriginalMotCle = $state(null);
  let editingKeyword = $state('');
  let editingType = $state('debit');
  let editingAccount = $state('606');

  /** @param {any} rule */
  function startEditRule(rule) {
    editingRuleOriginalMotCle = rule.motCle;
    editingKeyword = rule.motCle;
    editingType = rule.debit ? 'debit' : 'credit';
    editingAccount = rule.debit || rule.credit || '606';
  }

  function cancelEditRule() {
    editingRuleOriginalMotCle = null;
  }

  function saveEditRule() {
    if (!editingKeyword.trim()) {
      showToast('Le mot-clé ne peut pas être vide.');
      return;
    }
    const cleanNew = Categorizer.normaliserTexte(editingKeyword);
    const cleanOriginal = Categorizer.normaliserTexte(editingRuleOriginalMotCle || '');
    
    const currentPlan = $planComptable;
    const descriptionCompte = currentPlan.find(p => p.compte === editingAccount)?.libelle || 'Catégorie';

    const updatedRule = {
      motCle: cleanNew,
      debit: editingType === 'debit' ? editingAccount : '',
      credit: editingType === 'credit' ? editingAccount : '',
      note: descriptionCompte
    };

    const currentRules = [...$rules];
    const idx = currentRules.findIndex(r => Categorizer.normaliserTexte(r.motCle) === cleanOriginal);
    if (idx !== -1) {
      currentRules[idx] = updatedRule;
    } else {
      currentRules.unshift(updatedRule);
    }

    updateRules(currentRules);
    Categorizer.reappliquerReglesAuxTransactionsEnAttente();
    selectedCategoryMap = {};

    editingRuleOriginalMotCle = null;
    showToast(`Règle "${cleanNew}" mise à jour avec succès !`);
  }

  // CSV Dropzone state
  let dragover = $state(false);
  let isImporting = $state(false);
  /** @type {HTMLInputElement | null} */
  let fileInput = $state(null);

  /** @param {DragEvent} e */
  function handleCSVDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dragover = false;
    if (e.dataTransfer?.files?.length) {
      processCSVFile(e.dataTransfer.files[0]);
    }
  }

  /** @param {Event} e */
  function handleCSVFileSelect(e) {
    const target = /** @type {HTMLInputElement} */ (e.target);
    if (target.files?.length) {
      processCSVFile(target.files[0]);
      target.value = '';
    }
  }

  /** @param {File} file */
  function processCSVFile(file) {
    isImporting = true;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setTimeout(() => {
        try {
          const rawText = /** @type {string} */ (evt.target?.result || "");
          handleRawCsvUpload(rawText, file.name);

          const mappingConfig = selectedComplementColIdx !== -1 ? { indexInfo: selectedComplementColIdx } : null;
          const parsed = CSVParser.parse(rawText, mappingConfig);
          if (!parsed || parsed.length === 0) {
            showToast("Fichier CSV vide ou format non reconnu.");
            return;
          }

          const importId = 'import_' + Date.now();
          const currentEntId = $activeEntityId;

          // Préparation et assignation des métadonnées
          const rawTxList = parsed.map((t, idx) => ({
            id: `imported_${Date.now()}_${idx}`,
            entityId: currentEntId,
            importId,
            date: t.date || new Date().toISOString().split('T')[0],
            libelle: t.libelle || "Opération sans libellé",
            debit: t.debit || 0,
            credit: t.credit || 0,
            compteAttribué: "699",
            statut: "non_attribue",
            info: t.info || "",
            typeOperation: t.typeOperation || "",
            reference: t.reference || "",
            rawCells: t.rawCells || []
          }));

          // Déduplication intelligente basée sur date + libelle + montant
          const currentStructureTx = $transactions.filter(t => !t.entityId || t.entityId === currentEntId);
          const existingHashes = new Set(currentStructureTx.map(tx => {
            const amount = (tx.debit > 0 ? -tx.debit : tx.credit).toFixed(2);
            return `${tx.date}_${tx.libelle}_${amount}`;
          }));

          /** @type {any[]} */
          const newTxList = [];
          rawTxList.forEach(tx => {
            const amount = (tx.debit > 0 ? -tx.debit : tx.credit).toFixed(2);
            const hash = `${tx.date}_${tx.libelle}_${amount}`;
            if (!existingHashes.has(hash)) {
              newTxList.push(tx);
            }
          });

          if (newTxList.length === 0) {
            showToast("Toutes les écritures de ce fichier ont déjà été importées (doublons ignorés).");
            return;
          }

          // Contrôle Quota Freemium (Max 50 écritures en gratuit)
          const totalAfterImport = currentStructureTx.length + newTxList.length;
          let userIsPremium = false;
          isPremium.subscribe(v => userIsPremium = v)();

          if (!userIsPremium && totalAfterImport > FREE_TIER_MAX_TRANSACTIONS) {
            showUpgradeModal.set(true);
            showToast(`Limite gratuite atteinte (${totalAfterImport} / ${FREE_TIER_MAX_TRANSACTIONS} écritures). Passez en formule illimitée.`);
            return;
          }

          // Enregistrer dans l'historique d'import
          const history = getImportsHistory();
          history.unshift({
            id: importId,
            fileName: file.name,
            date: new Date().toISOString(),
            size: (file.size / 1024).toFixed(1) + ' KB',
            linesCount: newTxList.length,
            importedBy: 'Fabien Marceau'
          });
          saveImportsHistory(history);

          // Categorize using rules & dictionary
          const recatted = Categorizer.categoriserTransactions([...newTxList, ...currentStructureTx]);
          updateTransactions(recatted);
          activeTab = 'pending';
          showToast(`${newTxList.length} opération(s) importée(s) avec succès depuis "${file.name}".`);
        } catch (err) {
          console.error("Erreur lors de l'import CSV :", err);
          showToast("Erreur lors de la lecture du fichier bancaire.");
        } finally {
          isImporting = false;
        }
      }, 200);
    };
    reader.onerror = () => {
      isImporting = false;
      showToast("Impossible de lire ce fichier.");
    };
    reader.readAsText(file);
  }

  // Categorization modal state
  let showCategorizeModal = $state(false);
  /** @type {any} */
  let selectedTxForCategorization = $state(null);
  let modalSearchQuery = $state("");
  /** @type {'recettes' | 'depenses' | null} */
  let activeAccordionSection = $state(null);
  /** @type {string | null} */
  let activeSubMenuKey = $state(null);

  /** @param {any} tx */
  function openCategorizeModal(tx) {
    selectedTxForCategorization = tx;
    modalSearchQuery = "";
    activeAccordionSection = tx.debit > 0 ? 'depenses' : 'recettes';
    activeSubMenuKey = null;
    showCategorizeModal = true;
  }

  // Ventilation (Split) modal state
  let showSplitModal = $state(false);
  /** @type {any} */
  let splitTargetTx = $state(null);
  /** @type {Array<{ id: number, compte: string, amount: string, note: string }>} */
  let splitLines = $state([]);
  let splitLineCounter = 0;

  let splitOriginalAmount = $derived(
    splitTargetTx ? Math.round(Number(splitTargetTx.debit || splitTargetTx.credit || 0) * 100) / 100 : 0
  );

  /** @param {string} val */
  function parseSplitAmount(val) {
    if (val === '' || val === null || val === undefined) return 0;
    const n = parseFloat(String(val).replace(/\s/g, '').replace(',', '.'));
    return isNaN(n) || n < 0 ? 0 : Math.round(n * 100) / 100;
  }

  let splitAllocatedTotal = $derived(
    Math.round(splitLines.reduce((sum, l) => sum + parseSplitAmount(l.amount), 0) * 100) / 100
  );

  let splitRemaining = $derived(
    Math.round((splitOriginalAmount - splitAllocatedTotal) * 100) / 100
  );

  let isSplitBalanced = $derived(
    splitOriginalAmount > 0 && Math.abs(splitRemaining) < 0.005
  );

  let isSplitValid = $derived(
    isSplitBalanced &&
    splitLines.length >= 2 &&
    splitLines.every(l => Boolean(l.compte) && l.compte !== '699' && parseSplitAmount(l.amount) > 0)
  );

  /** @param {any} tx */
  function openSplitModal(tx) {
    splitTargetTx = tx;
    const isDebit = Number(tx.debit || 0) > 0;
    const sug = getSuggestionForTx(tx);
    const defaultFirst = (tx.compteAttribué && tx.compteAttribué !== '699')
      ? String(tx.compteAttribué)
      : (sug?.compte || (isDebit ? '606' : '706'));
    const defaultSecond = isDebit
      ? (defaultFirst === '164' ? '661' : defaultFirst === '606' ? '108' : '606')
      : (defaultFirst === '756' ? '706' : '756');

    splitLineCounter = 2;
    splitLines = [
      { id: 1, compte: defaultFirst, amount: '', note: '' },
      { id: 2, compte: defaultSecond, amount: '', note: '' }
    ];
    showSplitModal = true;
  }

  function addSplitLine() {
    if (!splitTargetTx) return;
    const isDebit = Number(splitTargetTx.debit || 0) > 0;
    splitLineCounter += 1;
    splitLines = [
      ...splitLines,
      { id: splitLineCounter, compte: isDebit ? '606' : '706', amount: '', note: '' }
    ];
  }

  /** @param {number} idx */
  function removeSplitLine(idx) {
    if (splitLines.length <= 2) return;
    splitLines = splitLines.filter((_, i) => i !== idx);
  }

  /** @param {number} idx */
  function fillSplitRemaining(idx) {
    const currentLineAmt = parseSplitAmount(splitLines[idx]?.amount || '');
    const targetAmt = Math.max(0, Math.round((splitRemaining + currentLineAmt) * 100) / 100);
    splitLines = splitLines.map((l, i) =>
      i === idx ? { ...l, amount: targetAmt > 0 ? targetAmt.toFixed(2).replace('.', ',') : '' } : l
    );
  }

  function validerVentilation() {
    if (!splitTargetTx || !isSplitValid) return;

    lastStateTransactions = JSON.parse(JSON.stringify($transactions));
    const isDebit = Number(splitTargetTx.debit || 0) > 0;
    const splitGroupId = `split_${Date.now()}`;
    const baseLibelle = splitTargetTx.rawLibelle || splitTargetTx.libelle.split('—')[0].trim();

    const newSplitTxs = splitLines.map((line, idx) => {
      const amt = parseSplitAmount(line.amount);
      const noteText = line.note.trim();
      const libelleFinal = noteText
        ? `${baseLibelle} — ${noteText}`
        : `${baseLibelle} (Ventilation ${idx + 1}/${splitLines.length})`;

      return {
        ...splitTargetTx,
        id: `${splitTargetTx.id}_split_${Date.now()}_${idx}`,
        rawLibelle: baseLibelle,
        libelle: libelleFinal,
        info: noteText || splitTargetTx.info || '',
        concatApplied: Boolean(noteText) || Boolean(splitTargetTx.concatApplied),
        debit: isDebit ? amt : 0,
        credit: isDebit ? 0 : amt,
        compteAttribué: line.compte,
        statut: 'attribue',
        regleAppliquee: `Ventilation (${idx + 1}/${splitLines.length})`,
        isSplit: true,
        splitGroupId,
        splitIndex: idx + 1,
        splitTotal: splitLines.length
      };
    });

    const updated = [];
    for (const t of $transactions) {
      if (t.id === splitTargetTx.id) {
        updated.push(...newSplitTxs);
      } else {
        updated.push(t);
      }
    }

    updateTransactions(updated);
    showSplitModal = false;
    splitTargetTx = null;
    splitLines = [];
    showToast(`Opération ventilée en ${newSplitTxs.length} écritures équilibrées !`);
  }

  /** @type {Record<string, string>} */
  let selectedCategoryMap = $state({});

  // Keep copy for undo
  /** @type {any[] | null} */
  let lastStateTransactions = $state(null);

  // import { activeEntityId } from "../lib/store.js";

  // États pour l'historique des imports
  let showHistoryDrawer = $state(false);
  /** @type {Array<any>} */
  let importsHistory = $state([]);

  function getImportsHistory() {
    const saved = localStorage.getItem(`saas_compta_imports_${$activeEntityId}`);
    return saved ? JSON.parse(saved) : [];
  }

  /** @param {any[]} history */
  function saveImportsHistory(history) {
    localStorage.setItem(`saas_compta_imports_${$activeEntityId}`, JSON.stringify(history));
    importsHistory = history;
  }

  // États pour la modal de concaténation assistée
  let showConcatModal = $state(false);
  let concatRawText = $state((() => {
    try {
      return localStorage.getItem(`saas_compta_last_csv_text_${$activeEntityId}`) || '';
    } catch {
      return '';
    }
  })());
  let concatFileName = $state((() => {
    try {
      return localStorage.getItem(`saas_compta_last_csv_name_${$activeEntityId}`) || '';
    } catch {
      return '';
    }
  })());
  /** @type {HTMLInputElement | null} */
  let concatFileInput = $state(null);
  
  /** @type {Array<string>} */
  let availableCsvHeaders = $state((() => {
    try {
      const saved = localStorage.getItem(`saas_compta_csv_headers_${$activeEntityId}`);
      if (saved) return JSON.parse(saved);
      const raw = localStorage.getItem(`saas_compta_last_csv_text_${$activeEntityId}`);
      if (raw) {
        const lines = raw.split(/\r\n|\r|\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length > 0) {
          const sep = lines[0].split(',').length > lines[0].split(';').length ? ',' : ';';
          return CSVParser.splitLineRespectingQuotes(lines[0], sep).map(h => h.trim().replace(/^"|"$/g, ''));
        }
      }
      return [];
    } catch {
      return [];
    }
  })());

  /** @type {number} */
  let selectedComplementColIdx = $state((() => {
    try {
      const saved = localStorage.getItem(`saas_compta_concat_col_idx_${$activeEntityId}`);
      return saved !== null ? Number(saved) : -1;
    } catch {
      return -1;
    }
  })());

  /** @type {Array<Array<string>>} */
  let concatSampleRows = $state((() => {
    try {
      const savedSamples = localStorage.getItem(`saas_compta_concat_sample_rows_${$activeEntityId}`);
      if (savedSamples) return JSON.parse(savedSamples);
      const raw = localStorage.getItem(`saas_compta_last_csv_text_${$activeEntityId}`);
      if (!raw) return [];
      const lines = raw.split(/\r\n|\r|\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return [];
      const sep = lines[0].split(',').length > lines[0].split(';').length ? ',' : ';';
      return lines.slice(1, 6).map(l => CSVParser.splitLineRespectingQuotes(l, sep));
    } catch {
      return [];
    }
  })());

  /** @param {string} rawText @param {string} [fileName] */
  function handleRawCsvUpload(rawText, fileName = '') {
    const lines = rawText.split(/\r\n|\r|\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return;
    const sep = lines[0].split(',').length > lines[0].split(';').length ? ',' : ';';
    const headers = CSVParser.splitLineRespectingQuotes(lines[0], sep).map(h => h.trim().replace(/^"|"$/g, ''));
    availableCsvHeaders = headers;
    concatRawText = rawText;
    const sampleRows = lines.slice(1, 6).map(l => CSVParser.splitLineRespectingQuotes(l, sep));
    concatSampleRows = sampleRows;

    localStorage.setItem(`saas_compta_csv_headers_${$activeEntityId}`, JSON.stringify(headers));
    localStorage.setItem(`saas_compta_last_csv_text_${$activeEntityId}`, rawText);
    localStorage.setItem(`saas_compta_concat_sample_rows_${$activeEntityId}`, JSON.stringify(sampleRows));
    if (fileName) {
      concatFileName = fileName;
      localStorage.setItem(`saas_compta_last_csv_name_${$activeEntityId}`, fileName);
    }
    saveCsvMetadata($activeEntityId, headers, fileName, rawText);

    // Enrichir immédiatement les transactions en mémoire avec leurs rawCells fraîches
    try {
      const parsed = CSVParser.parse(rawText);
      if (parsed && parsed.length > 0) {
        const currentTx = $transactions.filter(t => !t.entityId || t.entityId === $activeEntityId);
        const otherTx = $transactions.filter(t => t.entityId && t.entityId !== $activeEntityId);
        const remainingParsed = [...parsed];

        let enrichedCount = 0;
        const updatedList = currentTx.map((tx, idx) => {
          let match = null;
          if (currentTx.length === parsed.length) {
            match = parsed[idx];
          } else {
            const foundIdx = remainingParsed.findIndex(p => 
              p.date === tx.date && 
              Math.abs((p.debit || 0) - (tx.debit || 0)) < 0.01 && 
              Math.abs((p.credit || 0) - (tx.credit || 0)) < 0.01
            );
            if (foundIdx !== -1) {
              match = remainingParsed.splice(foundIdx, 1)[0];
            }
          }
          if (match && match.rawCells) {
            enrichedCount++;
            return {
              ...tx,
              rawCells: match.rawCells,
              info: tx.info || match.info || '',
              reference: tx.reference || match.reference || ''
            };
          }
          return tx;
        });

        if (enrichedCount > 0) {
          updateTransactions([...otherTx, ...updatedList]);
        }
      }
    } catch (e) {
      console.warn("Notice: enrichissement automatique des écritures lors du chargement CSV:", e);
    }

    if (selectedComplementColIdx === -1) {
      const idx = headers.findIndex(h => {
        const norm = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
        return !norm.includes('dat') && (norm.includes('inf') || norm.includes('complement') || norm.includes('detail') || norm.includes('motif'));
      });
      if (idx !== -1) selectedComplementColIdx = idx;
    }
  }

  /** @param {Event} e */
  function handleConcatFileChange(e) {
    const target = /** @type {HTMLInputElement} */ (e.target);
    if (target.files?.length) {
      const file = target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = /** @type {string} */ (evt.target?.result || "");
        handleRawCsvUpload(text, file.name);
      };
      reader.readAsText(file);
    }
  }

  function refreshConcatHeaders() {
    try {
      // 1. Tenter avec l'entité active
      let saved = localStorage.getItem(`saas_compta_csv_headers_${$activeEntityId}`);
      let parsed = saved ? JSON.parse(saved) : null;

      // 2. Si non trouvé avec l'entité active, chercher toute clé saas_compta_csv_headers_ dans localStorage
      if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('saas_compta_csv_headers_')) {
            const rawVal = localStorage.getItem(k);
            if (rawVal) {
              try {
                const arr = JSON.parse(rawVal);
                if (Array.isArray(arr) && arr.length > 0) {
                  parsed = arr;
                  break;
                }
              } catch (_) {}
            }
          }
        }
      }

      // 3. Si toujours non trouvé, chercher dans le texte CSV brut sauvegardé
      if (!parsed || parsed.length === 0) {
        let rawText = localStorage.getItem(`saas_compta_last_csv_text_${$activeEntityId}`);
        if (!rawText) {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('saas_compta_last_csv_text_')) {
              const val = localStorage.getItem(k);
              if (val) { rawText = val; break; }
            }
          }
        }
        if (rawText) {
          concatRawText = rawText;
          const lines = rawText.split(/\r\n|\r|\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length > 0) {
            const sep = lines[0].split(',').length > lines[0].split(';').length ? ',' : ';';
            parsed = CSVParser.splitLineRespectingQuotes(lines[0], sep).map(h => h.trim().replace(/^"|"$/g, ''));
            if (lines.length > 1 && concatSampleRows.length === 0) {
              concatSampleRows = lines.slice(1, 6).map(l => CSVParser.splitLineRespectingQuotes(l, sep));
            }
          }
        }
      }

      // 4. Si toujours rien mais qu'on a des écritures dans la structure courante :
      if ((!parsed || parsed.length === 0) && currentStructureTx.length > 0) {
        const txWithCells = currentStructureTx.find(t => t.rawCells && t.rawCells.length > 0);
        if (txWithCells && txWithCells.rawCells) {
          parsed = txWithCells.rawCells.map((/** @type {any} */ _, /** @type {number} */ idx) => {
            if (idx === 0) return 'Date';
            if (idx === 1) return 'Libellé';
            if (idx === 2) return 'Informations complémentaires';
            if (idx === 3) return 'Débit';
            if (idx === 4) return 'Crédit';
            return `Colonne ${idx + 1}`;
          });
          concatSampleRows = currentStructureTx.slice(0, 5).map(t => t.rawCells || []);
        } else {
          parsed = ['Date', 'Libellé', 'Informations complémentaires', 'Débit', 'Crédit'];
          concatSampleRows = currentStructureTx.slice(0, 5).map(t => [
            formatDateFr(t.date),
            t.libelle,
            t.info || t.typeOperation || 'Détail opération',
            String(t.debit || ''),
            String(t.credit || '')
          ]);
        }
      }

      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        availableCsvHeaders = parsed;
        localStorage.setItem(`saas_compta_csv_headers_${$activeEntityId}`, JSON.stringify(parsed));
      }

      // Recharger aussi les échantillons si vides
      if (concatSampleRows.length === 0) {
        const savedSamples = localStorage.getItem(`saas_compta_concat_sample_rows_${$activeEntityId}`);
        if (savedSamples) {
          try { concatSampleRows = JSON.parse(savedSamples); } catch (_) {}
        }
      }
      if (concatSampleRows.length === 0 && currentStructureTx.length > 0) {
        const txCells = currentStructureTx.filter(t => t.rawCells && t.rawCells.length > 0);
        if (txCells.length > 0) {
          concatSampleRows = txCells.slice(0, 5).map(t => t.rawCells);
        } else {
          concatSampleRows = currentStructureTx.slice(0, 5).map(t => [
            formatDateFr(t.date),
            t.rawLibelle || t.libelle.split('—')[0].trim(),
            t.info || t.typeOperation || '',
            String(t.debit || ''),
            String(t.credit || '')
          ]);
        }
      }

      // Pré-sélection intelligente de la colonne complémentaire
      if (selectedComplementColIdx === -1 && availableCsvHeaders.length > 0) {
        const idx = availableCsvHeaders.findIndex(h => {
          const norm = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
          return !norm.includes('dat') && (norm.includes('inf') || norm.includes('complement') || norm.includes('detail') || norm.includes('motif') || norm.includes('payeur') || norm.includes('tireur'));
        });
        if (idx !== -1) {
          selectedComplementColIdx = idx;
        } else if (availableCsvHeaders.length > 2) {
          selectedComplementColIdx = 2;
        }
      }
    } catch (err) {
      console.error("Erreur refreshConcatHeaders:", err);
    }
  }

  let effectiveSampleRows = $derived((() => {
    if (concatSampleRows.length > 0) return concatSampleRows;
    const txCells = currentStructureTx.filter(t => t.rawCells && t.rawCells.length > 0);
    if (txCells.length > 0) return txCells.slice(0, 5).map(t => t.rawCells);
    return currentStructureTx.slice(0, 5).map(t => [
      formatDateFr(t.date),
      t.rawLibelle || t.libelle.split('—')[0].trim(),
      t.info || t.typeOperation || '',
      String(t.debit || ''),
      String(t.credit || '')
    ]);
  })());

  function openConcatModal() {
    refreshConcatHeaders();
    showConcatModal = true;
  }

  function appliquerConcatenationAssistee() {
    if (selectedComplementColIdx === -1) {
      showToast("Veuillez sélectionner la colonne à associer.");
      return;
    }

    localStorage.setItem(`saas_compta_concat_col_idx_${$activeEntityId}`, String(selectedComplementColIdx));

    const rawTextToUse = concatRawText || localStorage.getItem(`saas_compta_last_csv_text_${$activeEntityId}`) || '';

    // Si on a le rawText, on met à jour toutes les transactions actuelles
    if (rawTextToUse) {
      const mappingConfig = {
        indexInfo: selectedComplementColIdx
      };
      const parsed = CSVParser.parse(rawTextToUse, mappingConfig);
      if (parsed && parsed.length > 0) {
        const currentTx = $transactions.filter(t => !t.entityId || t.entityId === $activeEntityId);
        const otherTx = $transactions.filter(t => t.entityId && t.entityId !== $activeEntityId);

        const isStrictSequenceMatch = currentTx.length === parsed.length && currentTx.every((tx, idx) => {
          const p = parsed[idx];
          return p && p.date === tx.date && Math.abs((p.debit || 0) - (tx.debit || 0)) < 0.01 && Math.abs((p.credit || 0) - (tx.credit || 0)) < 0.01;
        });

        const remainingParsed = [...parsed];
        const updatedTxList = currentTx.map((tx, i) => {
          let match = null;
          if (isStrictSequenceMatch) {
            match = parsed[i];
          } else {
            const foundIdx = remainingParsed.findIndex(p => 
              p.date === tx.date && 
              Math.abs((p.debit || 0) - (tx.debit || 0)) < 0.01 && 
              Math.abs((p.credit || 0) - (tx.credit || 0)) < 0.01
            );
            if (foundIdx !== -1) {
              match = remainingParsed.splice(foundIdx, 1)[0];
            }
          }

          const complement = String(
            (match?.rawCells && match.rawCells[selectedComplementColIdx] !== undefined ? match.rawCells[selectedComplementColIdx] : null) ??
            (tx.rawCells && tx.rawCells[selectedComplementColIdx] !== undefined ? tx.rawCells[selectedComplementColIdx] : null) ??
            match?.info ??
            ''
          ).trim();
          if (complement) {
            const baseLib = match?.rawLibelle || tx.rawLibelle || tx.libelle.split('—')[0].split('|')[0].trim();
            return {
              ...tx,
              info: complement,
              concatApplied: true,
              rawLibelle: baseLib,
              libelle: `${baseLib} — ${complement}`,
              rawCells: match?.rawCells || tx.rawCells
            };
          }
          return tx;
        });

        updateTransactions([...otherTx, ...updatedTxList]);
        Categorizer.reappliquerReglesAuxTransactionsEnAttente();
        showToast("Complément d'information associé avec succès à tout le relevé.");
        showConcatModal = false;
        return;
      }
    }

    // Sinon, si les transactions ont rawCells
    const currentTx = $transactions.filter(t => !t.entityId || t.entityId === $activeEntityId);
    const otherTx = $transactions.filter(t => t.entityId && t.entityId !== $activeEntityId);
    let updatedCount = 0;
    const updatedList = currentTx.map(tx => {
      if (tx.rawCells && tx.rawCells[selectedComplementColIdx] !== undefined) {
        const comp = String(tx.rawCells[selectedComplementColIdx]).trim();
        const baseLib = tx.rawLibelle || tx.libelle.split('—')[0].split('|')[0].trim();
        updatedCount++;
        return {
          ...tx,
          info: comp,
          concatApplied: Boolean(comp),
          rawLibelle: baseLib,
          libelle: comp ? `${baseLib} — ${comp}` : baseLib
        };
      }
      return tx;
    });

    if (updatedCount > 0) {
      updateTransactions([...otherTx, ...updatedList]);
      Categorizer.reappliquerReglesAuxTransactionsEnAttente();
      showToast(`Complément d'information appliqué à ${updatedCount} écritures.`);
      showConcatModal = false;
    } else {
      showToast("Veuillez charger votre fichier CSV pour ré-associer les colonnes.");
    }
  }

  function loadHistory() {
    importsHistory = getImportsHistory();
  }

  onMount(() => {
    // Laisser la modale fermée par défaut pour ne pas bloquer l'import ou la navigation
    showPedagogicalModal = false;
    loadHistory();
    Categorizer.reappliquerReglesAuxTransactionsEnAttente();
    refreshConcatHeaders();
  });

  // Recharger l'historique et réinitialiser les sélections en cours quand on change de structure
  $effect(() => {
    if ($activeEntityId) {
      loadHistory();
      selectedCategoryMap = {};
      lastStateTransactions = null;
      refreshConcatHeaders();
    }
  });

  /** 
   * Supprimer/Annuler un import et retirer ses écritures
   * @param {string} importId 
   * @param {string} fileName 
   * @param {number} linesCount 
   */
  function supprimerImport(importId, fileName, linesCount) {
    if (confirm(`Voulez-vous vraiment annuler l'import "${fileName}" ? Cela supprimera les ${linesCount} transactions associées.`)) {
      const filteredTx = $transactions.filter(t => t.importId !== importId && (!t.entityId || t.entityId === $activeEntityId));
      const history = getImportsHistory().filter((/** @type {any} */ h) => h.id !== importId);
      saveImportsHistory(history);

      const recatted = Categorizer.categoriserTransactions(filteredTx);
      updateTransactions(recatted);

      showToast(`Import "${fileName}" annulé avec succès.`);
    }
  }

  /**
   * Effacer toutes les opérations actuellement de cet espace
   */
  function effacerToutesOperations() {
    if (currentStructureTx.length === 0) return;
    if (confirm(`Voulez-vous effacer l'ensemble des ${currentStructureTx.length} écritures bancaires de cet espace ?\n\nToutes les opérations seront supprimées de votre espace et de la base de données. Vous pourrez réimporter un relevé bancaire propre immédiatement.`)) {
      updateTransactions([]);
      saveImportsHistory([]);
      localStorage.removeItem(`saas_compta_last_csv_text_${$activeEntityId}`);
      localStorage.removeItem(`saas_compta_csv_headers_${$activeEntityId}`);
      localStorage.removeItem(`saas_compta_concat_sample_rows_${$activeEntityId}`);
      localStorage.removeItem(`saas_compta_last_csv_name_${$activeEntityId}`);
      saveCsvMetadata($activeEntityId, [], '', '');
      concatRawText = '';
      availableCsvHeaders = [];
      concatSampleRows = [];
      showToast('Toutes les opérations de cet espace ont été effacées.');
    }
  }

  function closePedagogicalModal() {
    if (dontShowAgain) {
      localStorage.setItem("hide_categorize_pedagogical_modal", "true");
    }
    showPedagogicalModal = false;
  }

  /** @param {any} tx */
  function getSuggestionForTx(tx) {
    if (!tx) return null;
    const sug = Categorizer.obtenirMeilleureSuggestion(tx);
    if (!sug) return null;
    return {
      compte: sug.compte,
      label: sug.label || formatAccountLabel(sug.compte),
      source: sug.source,
      motCle: sug.motCle
    };
  }

  /** 
   * @param {string|number} txId 
   * @param {string} numCompte 
   */
  function selectAccount(txId, numCompte) {
    selectedCategoryMap[String(txId)] = numCompte;
  }

  function annulerDerniereAction() {
    if (lastStateTransactions) {
      updateTransactions(lastStateTransactions);
      lastStateTransactions = null;
      showToast("Attribution annulée.");
    }
  }

  /** @param {any} [tx] */
  function openTitoChatForTx(tx = null) {
    if (tx) {
      const sug = getSuggestionForTx(tx);
      const exp = getTitoRowExplanation(tx, activeEntityModel, sug);
      const customMsg = `**Explication pour « ${cleanTransactionLibelle(tx.libelle, tx)} » (${tx.debit > 0 ? '-' + tx.debit : '+' + tx.credit} €) :**\n\n• **Ce que fait Tito :** ${exp.lineExplanation.replace('Tito a un doute : ', '')}\n• **Pourquoi (Règle officielle) :** ${exp.whyLegal}\n• **Impact concret :** ${exp.impact}`;
      openTitoChat(tx, customMsg);
    } else {
      openTitoChat(null);
    }
  }
  let nonTriees = $derived(currentStructureTx.filter((t) => t.compteAttribué === "699" || t.statut === "non_attribue" || t.statut === "suggere"));
  let triees = $derived(currentStructureTx.filter((t) => t.compteAttribué !== "699" && t.statut === "attribue"));
  let totalOpsCount = $derived(nonTriees.length + triees.length);
  let progressPct = $derived(totalOpsCount > 0 ? Math.round((triees.length / totalOpsCount) * 100) : 0);
  let displayedTxList = $derived(activeTab === "pending" ? nonTriees : triees);

  // Auto-recognized transactions ready for 1-click batch validation
  let recognizedList = $derived(
    nonTriees.filter(t => t.statut === 'suggere' || t.autoRecognized || Boolean(getSuggestionForTx(t)))
  );

  let totalRecognizedAmount = $derived(
    recognizedList.reduce((sum, t) => sum + (t.credit > 0 ? t.credit : t.debit), 0)
  );

  // Filtrage, recherche et tri des opérations attribuées
  let categorizedFilterAccount = $state('all');
  let categorizedSortBy = $state('account'); // Par défaut 'account' pour regrouper tous les mêmes comptes ensemble !
  let categorizedSearch = $state('');

  let attributedAccountsList = $derived((() => {
    /** @type {Record<string, number>} */
    const counts = {};
    triees.forEach(t => {
      const cpt = String(t.compteAttribué || '699');
      counts[cpt] = (counts[cpt] || 0) + 1;
    });
    return Object.keys(counts).sort().map(cpt => ({
      compte: cpt,
      label: Categorizer.obtenirLibelleCompte(cpt),
      count: counts[cpt]
    }));
  })());

  let displayedCategorizedTxList = $derived((() => {
    let list = [...triees];
    if (categorizedFilterAccount !== 'all') {
      list = list.filter(t => String(t.compteAttribué) === String(categorizedFilterAccount));
    }
    if (categorizedSearch.trim()) {
      const q = categorizedSearch.toLowerCase().trim();
      list = list.filter(t => 
        (t.libelle || '').toLowerCase().includes(q) || 
        (t.info || '').toLowerCase().includes(q) ||
        String(t.compteAttribué || '').includes(q)
      );
    }
    if (categorizedSortBy === 'date_desc') {
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else if (categorizedSortBy === 'date_asc') {
      list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else if (categorizedSortBy === 'account') {
      list.sort((a, b) => 
        String(a.compteAttribué || '').localeCompare(String(b.compteAttribué || '')) || 
        (new Date(b.date).getTime() - new Date(a.date).getTime())
      );
    } else if (categorizedSortBy === 'amount_desc') {
      list.sort((a, b) => (Math.abs(b.debit || b.credit || 0)) - (Math.abs(a.debit || a.credit || 0)));
    }
    return list;
  })());

  // Formatted Label Helper: "Nom de la catégorie (Code)"
  /** @param {string|number} [numCompte] */
  function formatAccountLabel(numCompte) {
    if (!numCompte || String(numCompte) === '699') return '« Choisir une catégorie... »';
    return Categorizer.obtenirLibelleCompte(numCompte);
  }

  // Helper pour raccourcir les libellés de badges sur mobile avec le numéro de compte en premier
  /** @param {string|number|null|undefined} [compte] */
  function formatMobileAccountBadge(compte) {
    if (!compte || String(compte) === '699') return 'Non attribué';
    const cpt = String(compte).trim();

    /** @type {Record<string, string>} */
    const SHORT_LABELS = {
      '756': 'Cotisations',
      '706': 'Cours & Ateliers',
      '754': 'Dons',
      '707': 'Ventes',
      '708': 'Prestations',
      '740': 'Subventions',
      '606': 'Fournitures',
      '6061': 'Électricité & Eau',
      '6063': 'Petit matériel',
      '6064': 'Fournitures bureau',
      '6068': 'Fournitures diverses',
      '613': 'Locations',
      '615': 'Entretien',
      '616': 'Assurances',
      '618': 'Documentation',
      '622': 'Honoraires',
      '623': 'Publicité & Com',
      '625': 'Déplacements',
      '6251': 'Voyages & Dépl.',
      '6256': 'Repas & Missions',
      '6257': 'Réceptions',
      '626': 'Télécom & Poste',
      '627': 'Frais bancaires',
      '628': 'Divers',
      '641': 'Salaires',
      '645': 'Cotisations soc.',
      '6453': 'Mutuelle',
      '651': 'Logiciels & SaaS',
      '658': 'Charges diverses',
      '681': 'Amortissements',
      '487': 'Reports',
      '512': 'Banque',
      '530': 'Espèces'
    };

    if (SHORT_LABELS[cpt]) return `${cpt} · ${SHORT_LABELS[cpt]}`;

    for (const prefix of ['6453', '625', '606', '756', '706', '754', '627', '651']) {
      if (cpt.startsWith(prefix) && SHORT_LABELS[prefix]) {
        return `${cpt} · ${SHORT_LABELS[prefix]}`;
      }
    }

    const full = Categorizer.obtenirLibelleCompte(cpt) || '';
    const shortText = full.length > 15 ? full.slice(0, 14).trim() + '…' : full;
    return shortText ? `${cpt} · ${shortText}` : cpt;
  }

  // Helper to clean banking transaction labels & extract readable name
  /** @param {string} [libelle] @param {any} [tx] */
  function cleanTransactionLibelle(libelle, tx = null) {
    if (!libelle && (!tx || !tx.libelle)) return "Opération sans libellé";
    const fullLibelle = libelle || tx?.libelle || "";

    let s = fullLibelle.trim();
    if (s.includes('|')) {
      const parts = s.split('|').map((/** @type {string} */ p) => p.trim()).filter(Boolean);
      s = parts[0] || s;
    }

    // Détection ciblée des marchands et opérations courantes
    const upper = s.toUpperCase();
    if (upper.includes('AMZN') || upper.includes('AMAZON')) {
      return 'Amazon';
    }
    if (upper.includes('LEROY MERLIN')) {
      const matchLM = s.match(/leroy\s+merlin(?:\s+([a-zA-ZÀ-ÿ-]+))?/i);
      if (matchLM && matchLM[1] && !/^(cb|du|fr|paiement|vourles)/i.test(matchLM[1])) {
        return `Leroy Merlin ${matchLM[1].charAt(0).toUpperCase() + matchLM[1].slice(1).toLowerCase()}`;
      }
      if (/vourles/i.test(s)) return 'Leroy Merlin Vourles';
      return 'Leroy Merlin';
    }
    if (/frais\s+(?:de\s+)?pr[eé]l[eè]vement/i.test(s)) {
      return 'Frais prélèvement SEPA';
    }
    if (/frais\s+tenue\s+de\s+compte/i.test(s)) {
      return 'Frais tenue de compte';
    }
    if (/frais\s+bancaire/i.test(s)) {
      return 'Frais bancaires';
    }
    if (/cotisation\s+(?:carte|bancaire)/i.test(s)) {
      return 'Cotisation bancaire';
    }

    // Supprimer préfixes bancaires courants et civilités
    s = s.replace(/^(?:PRLV\s+SEPA|PRLV|PRELEVEMENT\s+SEPA|PRELEVEMENT\s+SDD|PRELEVEMENT|VIR\s+INST|VIR\s+SEPA|VIREMENT\s+SEPA|VIREMENT\s+INST|VIREMENT|PAIEMENT\s+PAR\s+CARTE\s+DU|PAIEMENT\s+PAR\s+CARTE|PAIEMENT\s+CB\s+DU|PAIEMENT\s+CB|ACHAT\s+CB|CB\s+DU|CB|CHEQUE\s+N°|CHEQUE|PRLV\s+HARMONIE|SA-)\s*[:-]?\s*/i, '');
    s = s.replace(/^(?:M(?:R|\.)?\s*(?:OU|ET|\/)\s*MME\.?|MME\.?|MLLE\.?|MR?\.?)\s+/i, '');

    // Règle tiret : isoler l'entité propre (ex: Rose Trujillo - Virement... -> Rose Trujillo)
    if (/[-–—]/.test(s)) {
      const parts = s.split(/\s*[-–—]\s*/);
      if (parts.length >= 2) {
        const p0 = parts[0].trim();
        const p1 = parts[1].trim();
        if (/^(?:vir|prlv|virement|prelevement|cotis|adh|loyer|fact|ref|paiement|cb|sepa|achat|don)\b/i.test(p1) || p0.length >= 3) {
          s = p0;
        } else if (/^(?:vir|prlv|virement|prelevement)\b/i.test(p0) && p1.length >= 3) {
          s = p1;
        }
      }
    }

    // Résidus techniques bancaires
    s = s.replace(/\s+(?:BILU|MKTP|PAYMENTS|EU|FR)\b.*$/i, '');
    s = s.replace(/\s+(?:VIR|VIREM|VIREMENT|PRLV|PRELEVEMENT)\b.*$/i, '');
    s = s.replace(/[-/]\s*\d{6,}[A-Z0-9_-]*/i, '');
    s = s.replace(/\s+\d+\s+EURO\s+[\d,.]+/i, '');
    s = s.replace(/\s+(TAUX|DEVISE|CHANGE).*$/i, '');
    s = s.replace(/\s+(REF|ID|EMETTEUR|MANDAT|ICS)\s*[:=]\s*[A-Z0-9]+/i, '');
    s = s.replace(/\s+\d{2}\/\d{2}(\/\d{2,4})?$/i, '');
    s = s.replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim();

    return s || fullLibelle;
  }

  // Helper for subtitle info (e.g. "07/09/2026 • Prélèvement SEPA")
  /** @param {any} tx */
  function getTransactionSubtitle(tx) {
    const parts = [];
    if (tx.date) parts.push(new Date(tx.date).toLocaleDateString("fr-FR"));
    
    const raw = (tx.libelle || "").toUpperCase();
    if (raw.includes("PRLV") || raw.includes("SEPA")) parts.push("Prélèvement SEPA");
    else if (raw.includes("VIR")) parts.push("Virement");
    else if (raw.includes("CB") || raw.includes("CARTES") || raw.includes("PAIEMENT")) parts.push("Carte bancaire");
    else if (raw.includes("CHEQUE")) parts.push("Chèque");
    else if (tx.typeOperation) parts.push(tx.typeOperation);
    else parts.push(tx.debit > 0 ? "Dépense" : "Recette");

    return parts.join(" • ");
  }

  // Groupement des catégories en sous-menus accordéon épurés
  let modalAccordionGroups = $derived((() => {
    const plan = $planComptable.filter(c => c.compte !== '699');

    /** @param {string[]} codes @param {boolean} [isExpenseContext] */
    const getAccounts = (codes, isExpenseContext = false) => codes.map(code => {
      const found = plan.find(c => c.compte === code);
      if (code === '411' && isExpenseContext) {
        return {
          compte: '411',
          libelle: 'Remboursement élève / adhérent',
          desc: 'Remboursement d’un trop-perçu, annulation de cours ou d’inscription.'
        };
      }
      return found ? {
        ...found,
        libelle: Categorizer.obtenirLibelleCompte(code) || found.libelle
      } : { compte: code, libelle: Categorizer.obtenirLibelleCompte(code), desc: '' };
    });

    /** @param {any} c */
    const isRecette = (c) => c.compte.startsWith('7') || c.group === 'entrees' || c.type === 'Produit';
    /** @param {any} c */
    const isDepense = (c) => c.compte.startsWith('6') || c.group === 'depenses_courantes' || c.group === 'equipe' || c.type === 'Charge';

    const recettesSubMenus = [
      {
        id: 'rec_prestations',
        label: 'Prestations de services et honoraires',
        icon: 'fa-briefcase',
        codes: ['706', '7061', '7062', '7063', '7064', '708']
      },
      {
        id: 'rec_ventes',
        label: 'Ventes de marchandises',
        icon: 'fa-box-open',
        codes: ['707']
      },
      {
        id: 'rec_cotisations',
        label: 'Cotisations, adhésions et mécénat',
        icon: 'fa-hand-holding-heart',
        codes: ['756', '758', '740']
      },
      {
        id: 'rec_indemnites',
        label: 'Indemnités, CPAM et remboursements perçus',
        icon: 'fa-shield-halved',
        codes: ['791']
      },
      {
        id: 'rec_virements',
        label: 'Virements reçus et apports',
        icon: 'fa-arrow-down-left',
        codes: ['455', '512', '530', '411', '467']
      }
    ];

    const depensesSubMenus = [
      {
        id: 'dep_achats',
        label: 'Achats, fournitures, énergie & documentation',
        icon: 'fa-cart-shopping',
        codes: ['606', '6061', '607', '618']
      },
      {
        id: 'dep_outils',
        label: 'Logiciels, télécom, publicité & frais bancaires',
        icon: 'fa-laptop',
        codes: ['6132', '626', '627', '623']
      },
      {
        id: 'dep_missions',
        label: 'Déplacements, parking, train & repas pro',
        icon: 'fa-car',
        codes: ['625']
      },
      {
        id: 'dep_locaux',
        label: 'Locaux, loyers, entretien & assurances',
        icon: 'fa-building',
        codes: ['613', '615', '616']
      },
      {
        id: 'dep_honoraires_taxes',
        label: 'Honoraires, impôts, cotisations pro & pénalités',
        icon: 'fa-scale-balanced',
        codes: ['622', '628', '635', '671']
      },
      {
        id: 'dep_social',
        label: 'Salaires, URSSAF, mutuelle & sous-traitance',
        icon: 'fa-building-columns',
        codes: ['645', '6453', '641', '611', '658']
      },
      {
        id: 'dep_invest_emprunt',
        label: 'Matériel (> 500 € HT), emprunts & TVA',
        icon: 'fa-landmark',
        codes: ['218', '164', '661', '445']
      },
      {
        id: 'dep_transferts',
        label: 'Prélèvements perso, remboursements & virements',
        icon: 'fa-arrow-up-right',
        codes: ['108', '455', '411', '401', '467', '512', '530']
      }
    ];

    /** @param {any[]} subMenus @param {(c: any) => boolean} fallbackFilter @param {boolean} [isExpenseContext] */
    const buildSection = (subMenus, fallbackFilter, isExpenseContext = false) => {
      const handledCodes = new Set();
      const list = subMenus.map(sub => {
        const baseAccs = getAccounts(sub.codes, isExpenseContext);
        /** @type {any[]} */
        const accsWithChildren = [];
        baseAccs.forEach(a => {
          accsWithChildren.push(a);
          handledCodes.add(a.compte);
          // Rattacher automatiquement les sous-comptes personnalisés juste sous leur parent
          const customChildren = plan.filter(
            c => c.isCustom && (c.parentCompte === a.compte || (!c.parentCompte && c.compte.startsWith(a.compte))) && !handledCodes.has(c.compte)
          );
          customChildren.forEach(child => {
            accsWithChildren.push(child);
            handledCodes.add(child.compte);
          });
        });
        return {
          ...sub,
          accounts: accsWithChildren
        };
      });

      const extras = plan.filter(c => fallbackFilter(c) && !handledCodes.has(c.compte));
      if (extras.length > 0) {
        list.push({
          id: 'extras_custom',
          label: 'Autres sous-comptes personnalisés',
          icon: 'fa-folder',
          accounts: extras
        });
      }

      return list;
    };

    return {
      recettes: buildSection(recettesSubMenus, isRecette, false),
      depenses: buildSection(depensesSubMenus, isDepense, true)
    };
  })());

  /** @param {string|number|null} numCompte @param {'recettes'|'depenses'|null} section */
  function findSubMenuForAccount(numCompte, section) {
    if (!numCompte || !section) return null;
    const subs = modalAccordionGroups[section] || [];
    for (const sub of subs) {
      if (sub.accounts.some((/** @type {any} */ a) => a.compte === String(numCompte))) {
        return sub.id;
      }
    }
    return null;
  }

  /**
   * @param {any} sub
   * @param {string|number|null|undefined} selectedCompte
   */
  function subHasSelectedAccount(sub, selectedCompte) {
    if (!sub || !sub.accounts || !selectedCompte) return false;
    return sub.accounts.some((/** @type {any} */ a) => a.compte === String(selectedCompte));
  }

  // Résultats de recherche directe quand du texte est saisi (insensible aux accents)
  let modalSearchResults = $derived((() => {
    const norm = (/** @type {string} */ s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const q = norm(modalSearchQuery.trim());
    if (!q) return [];
    return $planComptable.filter(c => c.compte !== '699' && (
      norm(c.compte).includes(q) ||
      norm(c.libelle).includes(q) ||
      norm(c.desc).includes(q)
    ));
  })());

  let listComptesTries = $derived(
    $planComptable
      .filter((c) => c.compte !== "699")
      .slice()
      .sort((a, b) => a.compte.localeCompare(b.compte, undefined, { numeric: true })),
  );

  // BATCH VALIDATION: Validate ALL recognized transactions in 1 Click!
  function validerToutEnUnClic() {
    if (recognizedList.length === 0) return;

    lastStateTransactions = JSON.parse(JSON.stringify($transactions));
    let count = 0;

    const updated = $transactions.map(tx => {
      const isRecognized = recognizedList.some(r => r.id === tx.id);
      if (!isRecognized && tx.statut === 'attribue') return tx;

      if (isRecognized || selectedCategoryMap[tx.id]) {
        count++;
        const targetCategory = selectedCategoryMap[tx.id] || (tx.compteAttribué && tx.compteAttribué !== '699' ? tx.compteAttribué : null) || getSuggestionForTx(tx)?.compte || (tx.credit > 0 ? '756' : '606');

        const kw = Categorizer.normaliserTexte(tx.libelle).split(' ').slice(0, 3).join(' ');
        if (kw) {
          Categorizer.ajouterRegle(kw, targetCategory, tx.debit > 0 ? 'debit' : 'credit');
        }

        return {
          ...tx,
          compteAttribué: targetCategory,
          statut: 'attribue',
          regleAppliquee: tx.regleAppliquee || `Auto (1-Clic)`
        };
      }

      return tx;
    });

    updateTransactions(updated);
    showToast(`Succès : ${count} écritures attribuées automatiquement en 1 clic !`);
  }

  // Helper to find similar pending transactions sharing vendor / label words
  /** @param {any} targetTx */
  function trouverOpérationsSimilaires(targetTx) {
    if (!targetTx || !targetTx.libelle) return [];
    const kw = Categorizer.normaliserTexte(targetTx.libelle).split(' ')[0];
    if (!kw || kw.length < 3 || ['VIR', 'PRLV', 'SEPA', 'CHEQUE', 'PAIEMENT', 'CARTES'].includes(kw)) {
      const words = Categorizer.normaliserTexte(targetTx.libelle).split(' ').filter(w => w.length >= 3 && !['VIR', 'PRLV', 'SEPA', 'CHEQUE', 'PAIEMENT', 'CARTES'].includes(w));
      if (words.length === 0) return [];
      const coreWord = words[0];
      return nonTriees.filter(t => t.id !== targetTx.id && Categorizer.normaliserTexte(t.libelle).includes(coreWord));
    }
    return nonTriees.filter(t => t.id !== targetTx.id && Categorizer.normaliserTexte(t.libelle).includes(kw));
  }

  // Validate single row with similar transactions detection modal
  /** @param {any} tx */
  function validerLigneSeule(tx) {
    lastStateTransactions = JSON.parse(JSON.stringify($transactions));

    const targetCategory = selectedCategoryMap[tx.id] || tx.compteAttribué || (tx.credit > 0 ? '756' : '606');
    const isDebit = tx.debit > 0;
    const type = isDebit ? 'debit' : 'credit';

    const kw = Categorizer.normaliserTexte(tx.libelle).split(' ').slice(0, 3).join(' ');
    if (kw) {
      Categorizer.ajouterRegle(kw, targetCategory, type);
    }

    const similarMatches = trouverOpérationsSimilaires(tx);

    if (similarMatches.length > 0) {
      pendingPrimaryTx = tx;
      targetSimilarCategory = targetCategory;
      matchingSimilarTxList = similarMatches;
      selectedSimilarTxIds = new Set(similarMatches.map(m => m.id));
      showSimilarTxModal = true;
    } else {
      const updated = $transactions.map(t => {
        if (t.id === tx.id) {
          return {
            ...t,
            compteAttribué: targetCategory,
            statut: 'attribue',
            regleAppliquee: kw || 'Manuelle'
          };
        }
        return t;
      });
      updateTransactions(updated);
      showToast(`Écriture attribuée au compte ${targetCategory} !`);
    }
  }

  function validerAttributionGroupéeSimilaire() {
    if (!pendingPrimaryTx) return;

    const idsToAssign = new Set([pendingPrimaryTx.id, ...Array.from(selectedSimilarTxIds)]);
    const kw = Categorizer.normaliserTexte(pendingPrimaryTx.libelle).split(' ').slice(0, 3).join(' ');

    const updated = $transactions.map(t => {
      if (idsToAssign.has(t.id)) {
        return {
          ...t,
          compteAttribué: targetSimilarCategory,
          statut: 'attribue',
          regleAppliquee: kw ? `Règle : ${kw}` : 'Attribution groupée'
        };
      }
      return t;
    });

    updateTransactions(updated);
    showToast(`${idsToAssign.size} opérations attribuées au compte ${targetSimilarCategory} !`);
    
    showSimilarTxModal = false;
    pendingPrimaryTx = null;
    matchingSimilarTxList = [];
    selectedSimilarTxIds = new Set();
  }

  /** @param {any} id */
  function toggleSimilarTxCheck(id) {
    const nextSet = new Set(selectedSimilarTxIds);
    if (nextSet.has(id)) {
      nextSet.delete(id);
    } else {
      nextSet.add(id);
    }
    selectedSimilarTxIds = nextSet;
  }
</script>

<div class="page-title-section" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 24px; flex-wrap: wrap;">
  <div>
    <h1 class="page-title" style="margin: 0; font-size: 1.4rem; font-weight: 800; color: var(--text-main);">Libellés & Attribution</h1>
    <p class="page-subtitle" style="margin: 4px 0 0 0; font-size: 0.86rem; color: var(--text-muted);">Importez vos opérations bancaires et attribuez-les facilement. Le dictionnaire d'attribution retient automatiquement vos choix.</p>
  </div>

  <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
    <!-- Bouton Aide & Guide d'attribution -->
    <button 
      type="button" 
      onclick={() => openHelpGuide('attribution')}
      title="Guide d'utilisation pour l'attribution"
      aria-label="Guide d'utilisation pour l'attribution"
      class="page-help-btn"
    >
      <i class="fa-solid fa-question"></i>
    </button>

    {#if lastStateTransactions}
      <button class="btn btn-secondary btn-sm" onclick={annulerDerniereAction} style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.25); display: flex; align-items: center; gap: 6px;">
        <i class="fa-solid fa-rotate-left"></i> Annuler le dernier tri
      </button>
    {/if}
  </div>
</div>

<!-- ========================================== -->
<!-- ======================================================= -->
<!-- ======================================================= -->
<!-- GRILLE DU HAUT (3 CARTES CÔTE À CÔTE DE MÊME HAUTEUR) -->
<div class="categorize-top-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 24px; align-items: stretch;">
  
  <!-- CARTE 1 : IMPORT DE RELEVÉ BANCAIRE (CSV) -->
  <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 18px 20px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between; gap: 14px; height: 100%; box-sizing: border-box;">
    <!-- En-tête du bloc -->
    <div class="categorize-card-header" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; min-height: 32px;">
      <h3 style="font-family: var(--font-title); font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 7px;">
        <span>Import de relevé bancaire</span>
        <InfoTip text="Glissez ici le relevé téléchargé depuis votre banque en ligne (Boursorama, BNP, Crédit Agricole, Qonto, etc.)." width="240px" />
      </h3>

      <!-- Action Vider le relevé : discrète et non anxiogène -->
      {#if currentStructureTx.length > 0}
        <button 
          type="button" 
          onclick={effacerToutesOperations}
          style="display: inline-flex; align-items: center; gap: 5px; font-weight: 600; font-size: 0.72rem; padding: 3px 8px; background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); border-radius: 6px; cursor: pointer; transition: all 0.15s ease; white-space: nowrap; flex-shrink: 0;"
          title="Vider le relevé actuel ({currentStructureTx.length} écritures) pour réimporter à neuf"
          onmouseenter={(e) => { 
            /** @type {HTMLElement} */ (e.currentTarget).style.color = '#ef4444';
            /** @type {HTMLElement} */ (e.currentTarget).style.borderColor = 'rgba(239, 68, 68, 0.35)';
            /** @type {HTMLElement} */ (e.currentTarget).style.background = 'rgba(239, 68, 68, 0.08)';
          }}
          onmouseleave={(e) => { 
            /** @type {HTMLElement} */ (e.currentTarget).style.color = 'var(--text-muted)';
            /** @type {HTMLElement} */ (e.currentTarget).style.borderColor = 'var(--border-color)';
            /** @type {HTMLElement} */ (e.currentTarget).style.background = 'transparent';
          }}
        >
          <i class="fa-solid fa-trash-can" style="font-size: 0.7rem;"></i>
          <span>Vider le relevé</span>
        </button>
      {/if}
    </div>

    <!-- Zone de drop ultra épurée selon la maquette -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div 
      class="dropzone {dragover ? 'dragover' : ''}" 
      onclick={() => !isImporting && fileInput && fileInput.click()}
      ondragenter={(e) => { e.preventDefault(); e.stopPropagation(); if (!isImporting) dragover = true; }}
      ondragover={(e) => { e.preventDefault(); e.stopPropagation(); if (!isImporting) dragover = true; }}
      ondragleave={(e) => { e.preventDefault(); e.stopPropagation(); dragover = false; }}
      ondrop={(e) => {
        if (!isImporting) handleCSVDrop(e);
      }}
      style="cursor: {isImporting ? 'wait' : 'pointer'}; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; padding: 20px 16px; background: {dragover ? 'rgba(79, 70, 229, 0.08)' : (isImporting ? 'rgba(79, 70, 229, 0.04)' : 'var(--bg-card)')}; border: 2px dashed {dragover ? '#4f46e5' : (isImporting ? '#6366f1' : 'var(--border-color)')}; border-radius: 14px; transition: all 0.2s ease; box-sizing: border-box; flex: 1; min-height: 145px;"
      onmouseenter={(e) => { if (!isImporting) e.currentTarget.style.borderColor = '#4f46e5'; }}
      onmouseleave={(e) => { if (!dragover && !isImporting) { e.currentTarget.style.borderColor = 'var(--border-color)'; } }}
    >
      {#if isImporting}
        <div style="width: 44px; height: 44px; border-radius: 50%; background: rgba(79, 70, 229, 0.12); color: #4f46e5; display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">
          <i class="fa-solid fa-circle-notch fa-spin"></i>
        </div>
        <div style="font-weight: 800; font-size: 0.92rem; color: #4f46e5;">
          Importation en cours...
        </div>
        <div style="font-size: 0.78rem; color: var(--text-muted);">
          Lecture et catégorisation des écritures bancaires
        </div>
      {:else}
        <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--bg-subtle); border: 1px solid var(--border-color); color: #4f46e5; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0; pointer-events: none; box-shadow: var(--shadow-sm);">
          <i class="fa-solid fa-cloud-arrow-up"></i>
        </div>
        
        <div style="pointer-events: none; font-weight: 800; font-size: 0.92rem; color: var(--text-main);">
          Glissez ou importez
        </div>
        
        <span style="background: #4f46e5; color: #ffffff; padding: 5px 18px; border-radius: 20px; font-weight: 700; font-size: 0.76rem; box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25); pointer-events: none;">
          Parcourir
        </span>
      {/if}

      <input 
        type="file" 
        bind:this={fileInput} 
        onchange={handleCSVFileSelect} 
        style="display: none;" 
        accept=".csv"
      />
    </div>
  </div>

  <!-- CARTE 2 : DICTIONNAIRE D'ATTRIBUTION / PARAMÉTRAGE -->
  <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 18px 20px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between; gap: 14px; height: 100%; box-sizing: border-box;">
    <!-- En-tête du bloc -->
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 32px;">
      <h3 style="font-family: var(--font-title); font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 7px; white-space: nowrap;">
        <span>Dictionnaire d'attribution</span>
        <InfoTip text="Vos règles apprises : chaque fois que vous attribuez un libellé, ScriptCompta le mémorise pour les prochains relevés." width="250px" />
      </h3>
    </div>

    <!-- Carte intérieure en colonne -->
    <div style="padding: 20px 16px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; flex: 1; min-height: 145px; box-sizing: border-box;">
      <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--bg-subtle); border: 1px solid var(--border-color); color: var(--text-muted); display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
        <i class="fa-solid fa-gear"></i>
      </div>

      <div>
        <div style="font-weight: 800; font-size: 0.92rem; color: var(--text-main); white-space: nowrap;">
          Paramétrage
        </div>
      </div>

      <button 
        type="button" 
        onclick={() => { dictModalTab = 'rules'; showDictionaryModal = true; }}
        style="background: #4f46e5; color: #ffffff; border: none; padding: 5px 18px; font-weight: 700; border-radius: 20px; cursor: pointer; font-size: 0.76rem; box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25); transition: opacity 0.15s ease;"
        onmouseenter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
        onmouseleave={(e) => { e.currentTarget.style.opacity = '1'; }}
      >
        Paramétrer
      </button>
    </div>
  </div>

  <!-- CARTE 3 : MINI TABLEAU DE BORD DE TRAITEMENT DES OPÉRATIONS -->
  <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 18px 20px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between; gap: 14px; height: 100%; box-sizing: border-box;">
    <!-- En-tête du bloc -->
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 32px;">
      <h3 style="font-family: var(--font-title); font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 7px; white-space: nowrap;">
        <span>Traitement des opérations</span>
        <InfoTip text="Cliquez sur l'un des deux compteurs pour afficher le tableau des opérations en attente ou celui des écritures déjà attribuées." width="250px" />
      </h3>
      {#if totalOpsCount > 0}
        <span style="font-size: 0.74rem; font-weight: 700; color: {progressPct === 100 ? '#34d399' : 'var(--text-muted)'}; white-space: nowrap;">
          {progressPct}% traité
        </span>
      {/if}
    </div>

    <!-- Mini tableau de bord cliquable (2 compteurs KPI + barre d'avancement) -->
    <div style="padding: 14px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between; gap: 12px; flex: 1; min-height: 145px; box-sizing: border-box;">
      <div class="attribution-tabs-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; flex: 1;">
        <!-- Compteur cliquable : À attribuer -->
        <button
          type="button"
          onclick={() => { activeTab = 'pending'; }}
          aria-pressed={activeTab === 'pending'}
          title="Afficher les opérations à attribuer"
          style="display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; gap: 6px; padding: 12px 14px; border-radius: 10px; cursor: pointer; text-align: left; transition: all 0.16s ease; {activeTab === 'pending' ? 'background: rgba(245, 158, 11, 0.1); border: 1.5px solid rgba(245, 158, 11, 0.55); box-shadow: 0 2px 10px rgba(245, 158, 11, 0.12);' : 'background: var(--bg-subtle); border: 1px solid var(--border-color);'}"
        >
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 6px;">
            <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: {activeTab === 'pending' ? 'var(--color-warning, #fbbf24)' : 'var(--text-muted)'};">
              À attribuer
            </span>
            <span style="width: 7px; height: 7px; border-radius: 50%; background: {nonTriees.length > 0 ? '#f59e0b' : 'var(--border-color)'}; opacity: {activeTab === 'pending' ? '1' : '0.5'};"></span>
          </div>
          <div style="font-family: var(--font-title); font-size: 1.6rem; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; color: {nonTriees.length > 0 ? 'var(--color-warning, #fbbf24)' : 'var(--text-main)'};">
            {nonTriees.length}
          </div>
        </button>

        <!-- Compteur cliquable : Attribuées -->
        <button
          type="button"
          onclick={() => { activeTab = 'categorized'; }}
          aria-pressed={activeTab === 'categorized'}
          title="Afficher les opérations déjà attribuées"
          style="display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; gap: 6px; padding: 12px 14px; border-radius: 10px; cursor: pointer; text-align: left; transition: all 0.16s ease; {activeTab === 'categorized' ? 'background: rgba(16, 185, 129, 0.1); border: 1.5px solid rgba(16, 185, 129, 0.55); box-shadow: 0 2px 10px rgba(16, 185, 129, 0.12);' : 'background: var(--bg-subtle); border: 1px solid var(--border-color);'}"
        >
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 6px;">
            <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: {activeTab === 'categorized' ? 'var(--color-success, #34d399)' : 'var(--text-muted)'};">
              Attribuées
            </span>
            <span style="width: 7px; height: 7px; border-radius: 50%; background: {triees.length > 0 ? '#10b981' : 'var(--border-color)'}; opacity: {activeTab === 'categorized' ? '1' : '0.5'};"></span>
          </div>
          <div style="font-family: var(--font-title); font-size: 1.6rem; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; color: {triees.length > 0 ? 'var(--color-success, #34d399)' : 'var(--text-main)'};">
            {triees.length}
          </div>
        </button>
      </div>

      <!-- Barre de progression discrète -->
      <div style="display: flex; flex-direction: column; gap: 5px;">
        <div style="width: 100%; height: 5px; border-radius: 999px; background: var(--bg-subtle); overflow: hidden;">
          <div style="width: {progressPct}%; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #10b981, #34d399); transition: width 0.3s ease;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">
          <span>{totalOpsCount === 0 ? 'Aucune opération importée' : `${triees.length} sur ${totalOpsCount} classée${triees.length > 1 ? 's' : ''}`}</span>
          <span style="color: var(--text-secondary);">Vue : {activeTab === 'pending' ? 'À attribuer' : 'Attribuées'}</span>
        </div>
      </div>
    </div>
  </div>

</div>

<!-- ======================================================= -->
<!-- CONTENEUR DU TABLEAU DE TRAITEMENT DES OPÉRATIONS       -->
<!-- ======================================================= -->
{#if activeTab === 'pending' || activeTab === 'categorized'}
  <div class="categorize-table-section">
    <div class="categorize-table-inner">
        
        {#if activeTab === 'pending'}
          {#if recognizedList.length > 0}
            <!-- Action Tout valider au-dessus du tableau avec libellé direct et court -->
            <div class="pending-bulk-actions">
              <button 
                type="button"
                onclick={validerToutEnUnClic}
                class="pending-validate-all-btn"
                title="Valider toutes les suggestions d'un clic"
              >
                <i class="fa-solid fa-check-double"></i>
                <span>Tout valider ({recognizedList.length})</span>
              </button>
            </div>
          {/if}
        {:else}
          <!-- Barre d'outils de tri et de filtrage pour les opérations attribuées -->
          <div class="categorized-toolbar">
            <!-- Sélecteur de compte -->
            <div class="categorized-filter-item">
              <span class="categorized-filter-label">Compte :</span>
              <select 
                bind:value={categorizedFilterAccount}
                class="categorized-select"
              >
                <option value="all">Tous les comptes ({triees.length})</option>
                {#each attributedAccountsList as acc}
                  <option value={acc.compte}>{acc.compte} — {acc.label} ({acc.count})</option>
                {/each}
              </select>
            </div>

            <!-- Sélecteur de tri -->
            <div class="categorized-filter-item">
              <span class="categorized-filter-label">Ordre :</span>
              <select 
                bind:value={categorizedSortBy}
                class="categorized-select"
              >
                <option value="account">Regrouper par compte comptable</option>
                <option value="date_desc">Date (du plus récent au plus ancien)</option>
                <option value="date_asc">Date (du plus ancien au plus récent)</option>
                <option value="amount_desc">Montant (décroissant)</option>
              </select>
            </div>

            <!-- Champ de recherche rapide -->
            <div class="categorized-search-box">
              <i class="fa-solid fa-magnifying-glass categorized-search-icon"></i>
              <input 
                type="text"
                placeholder="Rechercher..."
                bind:value={categorizedSearch}
                class="categorized-search-input"
              />
            </div>
          </div>
        {/if}

      {#if activeTab === 'pending'}
        {#if nonTriees.length > 0}
          <!-- Tableau épuré à 2 colonnes (Date + Carte d'opération & Contrôle Tito) -->
          <div class="table-container desktop-tx-table" style="width: 100%; overflow-x: auto; background: transparent !important; border: none !important; box-shadow: none !important;">
            <table class="custom-table" style="width: 100%; border-collapse: separate; border-spacing: 0 10px; background: transparent !important;">
              <thead>
                <tr>
                  <th style="width: 110px; padding: 10px 14px; font-weight: 800; font-size: 0.74rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: none; background: transparent !important;">Date</th>
                  <th style="padding: 10px 14px; font-weight: 800; font-size: 0.74rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: none; background: transparent !important;">Opération & Contrôle Tito</th>
                </tr>
              </thead>
              <tbody>
                {#each nonTriees as tx}
                  {@const sug = getSuggestionForTx(tx)}
                  {@const manualCat = selectedCategoryMap[tx.id]}
                  {@const isStateA = Boolean(sug) && !manualCat}
                  {@const isStateC = Boolean(manualCat)}
                  {@const isStateB = !isStateA && !isStateC}
                  {@const titoInfo = getTitoRowExplanation(tx, activeEntityModel, sug)}

                  <tr>
                    <!-- 1. Colonne Date -->
                    <td style="padding: 16px 14px; vertical-align: top; font-weight: 800; font-size: 0.88rem; color: var(--text-muted); white-space: nowrap; border: none;">
                      <div style="background: var(--table-date-bg); padding: 6px 10px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center; color: var(--table-date-text); font-weight: 800;">
                        {formatDateFr(tx.date)}
                      </div>
                    </td>

                    <!-- 2. Colonne Opération & Contrôle Tito (Carte Dashboard Hero) -->
                    <td style="padding: 0 10px; vertical-align: top; border: none;">
                      <div 
                        style="background: {titoInfo.isHeuristicDoubt ? 'var(--heuristic-doubt-bg)' : 'var(--table-card-bg)'}; border: 1.5px solid {titoInfo.isHeuristicDoubt ? '#38bdf8' : 'var(--table-card-border)'}; border-radius: 14px; padding: 16px 18px; box-shadow: {titoInfo.isHeuristicDoubt ? '0 0 24px rgba(56, 189, 248, 0.16)' : 'var(--shadow-sm)'}; display: flex; flex-direction: column; gap: 9px; transition: all 0.15s ease;"
                      >
                        <!-- Étage 1 : Libellé + détail associé + type à gauche, Montant à droite -->
                        <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
                          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="font-weight: 800; font-size: 0.98rem; color: var(--table-card-title); letter-spacing: 0.01em;">
                              {cleanTransactionLibelle(tx.rawLibelle || tx.libelle, tx)}
                            </span>
                            {#if tx.info && (tx.concatApplied || tx.libelle.includes(' — '))}
                              <span style="font-size: 0.74rem; font-weight: 700; color: var(--color-accent, #38bdf8); background: rgba(56, 189, 248, 0.12); padding: 2px 9px; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.35);">
                                {tx.info}
                              </span>
                            {/if}
                            <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); background: var(--bg-subtle); padding: 2px 8px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                              {tx.typeOperation || (tx.libelle.includes('PRLV') ? 'Prélèvement SEPA' : tx.libelle.includes('VIR') ? 'Virement' : 'Carte bancaire')}
                            </span>
                          </div>

                          <div style="font-size: 1.15rem; font-weight: 800; font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: {tx.debit > 0 ? '#f87171' : '#34d399'}; white-space: nowrap; margin-left: auto;">
                            {tx.debit > 0 ? "- " : "+ "}
                            {(Number(tx.debit || tx.credit || 0)).toFixed(2).replace('.', ',')} €
                          </div>
                        </div>

                        <!-- Étage 2 : Suggestion / Analyse Tito bien mise en valeur -->
                        {#if isStateA && sug}
                          <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
                            <span style="display: inline-flex; align-items: center; gap: 7px; padding: 6px 14px; border-radius: 9999px; font-size: 0.8rem; font-weight: 800; {titoInfo.isCertain ? 'background: rgba(16, 185, 129, 0.14); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);' : 'background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%); color: #ffffff; box-shadow: 0 3px 12px rgba(6, 182, 212, 0.28);'}">
                              <i class="fa-solid {titoInfo.isCertain ? 'fa-check-double' : 'fa-wand-magic-sparkles'}" style="font-size: 0.74rem;"></i>
                              <span>{titoInfo.isCertain ? 'Reconnu par Tito' : 'Suggestion Tito'} : {sug.compte} — {sug.label}</span>
                            </span>
                          </div>
                        {:else if isStateC}
                          <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
                            <span style="display: inline-flex; align-items: center; gap: 7px; padding: 6px 14px; border-radius: 9999px; font-size: 0.8rem; font-weight: 800; background: rgba(59, 130, 246, 0.15); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.4);">
                              <i class="fa-solid fa-check" style="font-size: 0.74rem;"></i>
                              <span>Sélectionné : {manualCat} — {formatAccountLabel(manualCat)}</span>
                            </span>
                          </div>
                        {:else}
                          <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
                            <span style="display: inline-flex; align-items: center; gap: 7px; padding: 6px 14px; border-radius: 9999px; font-size: 0.8rem; font-weight: 800; background: var(--color-warning-bg, rgba(245, 158, 11, 0.14)); color: var(--color-warning, #fbbf24); border: 1px solid rgba(245, 158, 11, 0.45);">
                              <i class="fa-solid fa-circle-question" style="font-size: 0.78rem;"></i>
                              <span>Libellé inédit : choisissez sa catégorie une seule fois (Tito la mémorisera)</span>
                            </span>
                          </div>
                        {/if}

                        <!-- Étage 3 : Panneau de commande uniforme (Attribuer | Modifier | Ventiler | + Informations) -->
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 2px; padding-top: 10px; border-top: 1px dashed var(--border-color);">
                          
                          <!-- 1. Bouton Attribuer (1-clic si suggestion Tito / sélection, sinon ouvre la modale) -->
                          <button
                            type="button"
                            onclick={() => {
                              if (isStateA && sug) {
                                selectAccount(tx.id, sug.compte);
                                validerLigneSeule(tx);
                              } else if (isStateC) {
                                validerLigneSeule(tx);
                              } else {
                                openCategorizeModal(tx);
                              }
                            }}
                            title={isStateA && sug ? `Attribuer en 1 clic au compte ${sug.compte} (${sug.label})` : isStateC ? `Attribuer au compte ${manualCat}` : 'Choisir un compte comptable'}
                            style="background: {(isStateA && sug) || isStateC ? '#16a34a' : '#4f46e5'}; color: #ffffff; border: none; font-size: 0.78rem; font-weight: 700; padding: 5px 14px; border-radius: 9999px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: {(isStateA && sug) || isStateC ? '0 2px 8px rgba(22, 163, 74, 0.35)' : '0 2px 8px rgba(79, 70, 229, 0.3)'};"
                          >
                            <i class="fa-solid {(isStateA && sug) || isStateC ? 'fa-check' : 'fa-tag'}" style="font-size: 0.7rem;"></i>
                            <span>Attribuer</span>
                          </button>

                          <!-- 2. Bouton Modifier (si suggestion ou sélection en cours) -->
                          {#if (isStateA && sug) || isStateC}
                            <button
                              type="button"
                              onclick={() => openCategorizeModal(tx)}
                              title="Choisir un autre compte comptable"
                              style="background: var(--bg-subtle); border: 1px solid var(--border-color); color: var(--text-secondary); padding: 5px 11px; border-radius: 9999px; cursor: pointer; font-size: 0.74rem; font-weight: 600;"
                            >
                              Modifier
                            </button>
                          {/if}

                          <!-- 3. Bouton Ventiler -->
                          <button
                            type="button"
                            onclick={() => openSplitModal(tx)}
                            style="background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.35); color: #c084fc; padding: 5px 11px; border-radius: 9999px; cursor: pointer; font-size: 0.74rem; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; transition: all 0.15s ease;"
                            title="Répartir cette opération sur plusieurs comptes comptables"
                          >
                            <i class="fa-solid fa-code-branch" style="font-size: 0.68rem;"></i>
                            <span>Ventiler</span>
                          </button>

                          <!-- 4. Bouton + Informations (actif) -->
                          <button
                            type="button"
                            onclick={openConcatModal}
                            style="background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); padding: 4px 11px; border-radius: 9999px; cursor: pointer; font-size: 0.72rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s ease;"
                            title="Associer une colonne d'informations de votre relevé CSV"
                            onmouseenter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                            onmouseleave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                          >
                            <span>+ Informations</span>
                          </button>

                        </div>

                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <!-- VUE LISTE MOBILE UNIFIÉE FINTECH (< 768px) POUR OPÉRATIONS EN ATTENTE -->
          <div class="mobile-tx-cards">
            <div class="mobile-tx-list">
              {#each nonTriees as tx}
                {@const sug = getSuggestionForTx(tx)}
                {@const manualCat = selectedCategoryMap[tx.id]}
                {@const isStateA = Boolean(sug) && !manualCat}
                {@const isStateC = Boolean(manualCat)}
                {@const isStateB = !isStateA && !isStateC}
                {@const titoInfo = getTitoRowExplanation(tx, activeEntityModel, sug)}
                {@const amtVal = Number(tx.debit || tx.credit || 0)}
                {@const isCredit = !(tx.debit > 0)}
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
                        {cleanTransactionLibelle(tx.libelle, tx)}
                      </span>
                      <span class="mobile-tx-amount" style="color: {tx.debit > 0 ? '#f87171' : '#34d399'};">
                        {tx.debit > 0 ? "- " : "+ "}{amtVal.toFixed(2).replace('.', ',')} €
                      </span>
                    </div>

                    <!-- Ligne 2 : Date + Attribution / Action 1-clic -->
                    <div class="mobile-tx-row-bottom">
                      <span class="mobile-tx-date">{formatDateFr(tx.date)}</span>

                      <div style="display: flex; align-items: center; gap: 6px; margin-left: auto;">
                        {#if isStateA && sug}
                          {#if titoInfo.isCertain}
                            <span class="mobile-tx-badge attributed" title={sug.label}>
                              {formatMobileAccountBadge(sug.compte)}
                            </span>
                            <button
                              type="button"
                              class="mobile-action-btn confirm-btn"
                              onclick={() => {
                                selectAccount(tx.id, sug.compte);
                                validerLigneSeule(tx);
                              }}
                              title="Confirmer cette attribution"
                            >
                              <i class="fa-solid fa-check"></i> Valider
                            </button>
                          {:else}
                            <button
                              type="button"
                              class="mobile-action-btn validate-btn"
                              onclick={() => {
                                selectAccount(tx.id, sug.compte);
                                validerLigneSeule(tx);
                              }}
                              title="Valider en 1 clic au compte {sug.compte}"
                            >
                              <i class="fa-solid fa-bolt"></i> {formatMobileAccountBadge(sug.compte)}
                            </button>
                          {/if}
                          <button
                            type="button"
                            class="mobile-action-btn"
                            onclick={() => openCategorizeModal(tx)}
                            title="Modifier la catégorie"
                          >
                            <i class="fa-solid fa-pen"></i>
                          </button>
                        {:else if isStateC}
                          <span class="mobile-tx-badge attributed" title={formatAccountLabel(manualCat)}>
                            {formatMobileAccountBadge(manualCat)}
                          </span>
                          <button
                            type="button"
                            class="mobile-action-btn confirm-btn"
                            onclick={() => validerLigneSeule(tx)}
                            title="Confirmer cette attribution"
                          >
                            <i class="fa-solid fa-check"></i> Valider
                          </button>
                          <button
                            type="button"
                            class="mobile-action-btn"
                            onclick={() => openCategorizeModal(tx)}
                            title="Modifier la catégorie"
                          >
                            <i class="fa-solid fa-pen"></i>
                          </button>
                        {:else}
                          <span class="mobile-tx-badge pending">À catégoriser</span>
                          <button
                            type="button"
                            class="mobile-action-btn validate-btn"
                            onclick={() => openCategorizeModal(tx)}
                          >
                            <i class="fa-solid fa-tag"></i> Attribuer
                          </button>
                        {/if}
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <div style="padding: 36px 20px; text-align: center; background: var(--bg-subtle); border: 1px dashed var(--border-color); border-radius: 14px; margin-top: 10px;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: rgba(34, 197, 94, 0.12); color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; margin: 0 auto 10px auto;">
              <i class="fa-solid fa-check"></i>
            </div>
            <strong style="font-size: 0.98rem; color: var(--text-main); display: block; margin-bottom: 4px;">Toutes les opérations sont attribuées !</strong>
            <span style="font-size: 0.82rem; color: var(--text-muted);">Aucune opération en attente. Retrouvez l'ensemble de vos écritures dans l'onglet « Attribué ».</span>
          </div>
        {/if}
      {:else}
        <!-- ÉTAT ATTRIBUÉES (2 Colonnes Hero également) -->
        {#if displayedCategorizedTxList.length === 0}
          <div style="padding: 36px 20px; text-align: center; background: var(--bg-subtle); border: 1px dashed var(--border-color); border-radius: 14px; margin-top: 10px;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--bg-card); color: var(--text-muted); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; margin: 0 auto 10px auto;">
              <i class="fa-regular fa-folder-open"></i>
            </div>
            <strong style="font-size: 0.98rem; color: var(--text-main); display: block; margin-bottom: 4px;">Aucune écriture attribuée</strong>
            <span style="font-size: 0.82rem; color: var(--text-muted);">Importez un relevé bancaire ou classez vos écritures pour les retrouver ici.</span>
          </div>
        {:else}
          <div class="table-container desktop-tx-table" style="width: 100%; overflow-x: auto; background: transparent !important; border: none !important; box-shadow: none !important;">
            <table class="custom-table" style="width: 100%; border-collapse: separate; border-spacing: 0 10px; background: transparent !important;">
              <thead>
                <tr>
                  <th style="width: 110px; padding: 10px 14px; font-weight: 800; font-size: 0.74rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: none; background: transparent !important;">Date</th>
                  <th style="padding: 10px 14px; font-weight: 800; font-size: 0.74rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: none; background: transparent !important;">Opération & Écriture validée</th>
                </tr>
              </thead>
              <tbody>
                {#each displayedCategorizedTxList as tx}
                  <tr>
                    <td style="padding: 16px 14px; vertical-align: top; font-weight: 800; font-size: 0.88rem; color: var(--text-muted); white-space: nowrap; border: none;">
                      <div style="background: var(--table-date-bg); padding: 6px 10px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center; color: var(--table-date-text); font-weight: 800;">
                        {formatDateFr(tx.date)}
                      </div>
                    </td>

                    <td style="padding: 0 10px; vertical-align: top; border: none;">
                      <div style="background: var(--table-card-bg); border: 1.5px solid var(--table-card-border); border-radius: 14px; padding: 16px 18px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 9px;">
                        
                        <!-- Ligne 1 : Libellé + détail associé + type à gauche, Montant à droite -->
                        <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
                          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="font-weight: 800; font-size: 0.98rem; color: var(--table-card-title); letter-spacing: 0.01em;">
                              {cleanTransactionLibelle(tx.rawLibelle || tx.libelle, tx)}
                            </span>
                            {#if tx.info && (tx.concatApplied || tx.libelle.includes(' — '))}
                              <span style="font-size: 0.74rem; font-weight: 700; color: var(--color-accent, #38bdf8); background: rgba(56, 189, 248, 0.12); padding: 2px 9px; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.35);">
                                {tx.info}
                              </span>
                            {/if}
                            <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); background: var(--bg-subtle); padding: 2px 8px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                              {tx.typeOperation || (tx.libelle.includes('PRLV') ? 'Prélèvement SEPA' : tx.libelle.includes('VIR') ? 'Virement' : 'Carte bancaire')}
                            </span>
                          </div>

                          <div style="font-size: 1.15rem; font-weight: 800; font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: {tx.debit > 0 ? '#f87171' : '#34d399'}; white-space: nowrap; margin-left: auto;">
                            {tx.debit > 0 ? "- " : "+ "}
                            {(Number(tx.debit || tx.credit || 0)).toFixed(2).replace('.', ',')} €
                          </div>
                        </div>

                        <!-- Ligne 2 : Mention de classement validé -->
                        <div style="font-size: 0.84rem; color: var(--table-card-desc); line-height: 1.45;">
                          Inscrit et validé dans vos écritures officielles au compte <strong style="color: var(--table-card-title);">{tx.compteAttribué} ({formatAccountLabel(tx.compteAttribué)})</strong>.
                        </div>

                        <!-- Ligne 3 : Barre de pilules actions -->
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 2px; padding-top: 10px; border-top: 1px dashed var(--border-color);">
                          <span style="display: inline-flex; align-items: center; gap: 6px; background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); padding: 5px 12px; border-radius: 9999px; font-size: 0.78rem; font-weight: 700;">
                            <i class="fa-solid fa-circle-check"></i>
                            <span>Validé • Compte {tx.compteAttribué} ({formatAccountLabel(tx.compteAttribué)})</span>
                          </span>

                          {#if tx.isSplit}
                            <span style="display: inline-flex; align-items: center; gap: 5px; background: rgba(168, 85, 247, 0.14); color: #d8b4fe; border: 1px solid rgba(168, 85, 247, 0.35); padding: 4px 10px; border-radius: 9999px; font-size: 0.72rem; font-weight: 700;">
                              <i class="fa-solid fa-code-branch" style="font-size: 0.66rem;"></i>
                              <span>Ventilé {tx.splitIndex}/{tx.splitTotal}</span>
                            </span>
                          {/if}

                          <button
                            type="button"
                            onclick={() => openCategorizeModal(tx)}
                            style="background: var(--bg-subtle); border: 1px solid var(--border-color); color: var(--text-secondary); padding: 5px 11px; border-radius: 9999px; cursor: pointer; font-size: 0.74rem; font-weight: 600;"
                          >
                            Modifier
                          </button>

                          <!-- Bouton Ventiler -->
                          <button
                            type="button"
                            onclick={() => openSplitModal(tx)}
                            style="background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.35); color: #c084fc; padding: 5px 11px; border-radius: 9999px; cursor: pointer; font-size: 0.74rem; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; transition: all 0.15s ease;"
                            title="Ventiler cette opération sur plusieurs comptes comptables"
                          >
                            <i class="fa-solid fa-code-branch" style="font-size: 0.68rem;"></i>
                            <span>Ventiler</span>
                          </button>

                          <!-- Bouton + Informations (actif) -->
                          <button
                            type="button"
                            onclick={openConcatModal}
                            style="background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); padding: 4px 11px; border-radius: 9999px; cursor: pointer; font-size: 0.72rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s ease;"
                            title="Associer une colonne d'informations de votre relevé CSV"
                            onmouseenter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                            onmouseleave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                          >
                            <span>+ Informations</span>
                          </button>
                        </div>

                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <!-- VUE LISTE MOBILE UNIFIÉE FINTECH (< 768px) POUR OPÉRATIONS ATTRIBUÉES -->
          <div class="mobile-tx-cards">
            <div class="mobile-tx-list">
              {#each displayedCategorizedTxList as tx}
                {@const amtVal = Number(tx.debit || tx.credit || 0)}
                {@const isCredit = !(tx.debit > 0)}
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
                        {cleanTransactionLibelle(tx.libelle, tx)}
                      </span>
                      <span class="mobile-tx-amount" style="color: {tx.debit > 0 ? '#f87171' : '#34d399'};">
                        {tx.debit > 0 ? "- " : "+ "}{amtVal.toFixed(2).replace('.', ',')} €
                      </span>
                    </div>

                    <!-- Ligne 2 : Date + Badge Compte court (code en premier) + Bouton Modifier -->
                    <div class="mobile-tx-row-bottom">
                      <span class="mobile-tx-date">{formatDateFr(tx.date)}</span>
                      <div class="mobile-tx-actions-group">
                        <span class="mobile-tx-badge attributed" title="{tx.compteAttribué} · {formatAccountLabel(tx.compteAttribué)}">
                          {formatMobileAccountBadge(tx.compteAttribué)}
                        </span>
                        <button
                          type="button"
                          class="mobile-action-btn"
                          onclick={() => openCategorizeModal(tx)}
                          title="Modifier l'attribution"
                          aria-label="Modifier l'attribution"
                        >
                          <i class="fa-solid fa-pen"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<!-- Pedagogical Onboarding Modal -->
{#if showPedagogicalModal}
  <div class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;">
    <div class="glass-card" style="width: 100%; max-width: 520px; padding: 28px; border: 1.5px solid rgba(129, 140, 248, 0.4); box-shadow: 0 25px 50px rgba(0,0,0,0.6); background: #0f172a; border-radius: 18px; color: #ffffff;">
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 14px;">
        <h3 style="margin: 0; font-size: 1.25rem; font-family: var(--font-title); color: white; display: flex; align-items: center; gap: 10px; font-weight: 800;">
          <i class="fa-solid fa-tags" style="color: #818cf8;"></i> Comment trier vos opérations ?
        </h3>
        <button onclick={closePedagogicalModal} style="background: none; border: none; color: rgba(255, 255, 255, 0.5); font-size: 1.3rem; cursor: pointer;">✕</button>
      </div>

      <div style="color: rgba(255, 255, 255, 0.9); font-size: 0.95rem; line-height: 1.6; margin-bottom: 24px; display: flex; flex-direction: column; gap: 14px;">
        <p style="margin: 0; font-weight: 600; color: #cbd5e1;">
          Sélectionnez simplement ce que représente chaque ligne <span style="color: #818cf8;">(ex: Logiciel, Repas, Matériel, Cotisation...)</span>.
        </p>

        <div style="background: rgba(99, 102, 241, 0.12); border-left: 4px solid #6366f1; padding: 14px 16px; border-radius: 8px; display: flex; flex-direction: column; gap: 8px;">
          <div style="font-weight: 700; color: #a5b4fc; font-size: 0.88rem; text-transform: uppercase; letter-spacing: 0.04em; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-bolt" style="color: #818cf8;"></i> Le système fait le reste :
          </div>
          <ul style="margin: 0; padding-left: 18px; font-size: 0.88rem; color: #e2e8f0; display: flex; flex-direction: column; gap: 6px;">
            <li>Attribution automatique des codes comptables officiels sans jargon.</li>
            <li>Apprentissage IA : mémorisation de vos choix pour vos prochains imports.</li>
          </ul>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 18px;">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: rgba(255, 255, 255, 0.7); font-size: 0.85rem;">
          <input type="checkbox" bind:checked={dontShowAgain} style="width: 16px; height: 16px; accent-color: #6366f1;" />
          Ne plus afficher
        </label>

        <button 
          class="btn btn-primary" 
          onclick={closePedagogicalModal}
          style="padding: 11px 24px; font-weight: 700; background: #3b82f6; color: white; border: none; border-radius: 10px; font-size: 0.92rem; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4); cursor: pointer;"
        >
          C'est parti !
        </button>
      </div>

    </div>
  </div>
{/if}

<!-- Similar Transactions Detection Modal -->
{#if showSimilarTxModal && pendingPrimaryTx}
  <div class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;">
    <div class="glass-card" style="width: 100%; max-width: 580px; padding: 26px; border: 1.5px solid rgba(99, 102, 241, 0.5); box-shadow: 0 25px 60px rgba(0,0,0,0.85); background: #11131e; border-radius: 16px;">
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 12px;">
        <h3 style="margin: 0; font-size: 1.2rem; font-family: var(--font-title); color: white; display: flex; align-items: center; gap: 10px;">
          <i class="fa-solid fa-layer-group" style="color: #818cf8;"></i>
          Opérations similaires détectées !
        </h3>
        <button onclick={() => showSimilarTxModal = false} style="background: none; border: none; color: white; font-size: 1.3rem; cursor: pointer;">✕</button>
      </div>

      <p style="font-size: 0.92rem; color: rgba(255, 255, 255, 0.9); line-height: 1.5; margin-bottom: 16px;">
       <strong>Tito a trouvé {matchingSimilarTxList.length} autre(s) opération(s) similaire(s)</strong> à <em><br/> "{pendingPrimaryTx ? pendingPrimaryTx.libelle : ''}"</em>.<br/>
        Souhaitez-vous les attribuer également au compte <strong>{formatAccountLabel(targetSimilarCategory)}</strong> ?
      </p>

      <!-- Checkboxes List -->
      <div style="max-height: 220px; overflow-y: auto; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 10px; margin-bottom: 20px;">
        {#each matchingSimilarTxList as item}
          <label style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: 6px; background: rgba(255,255,255,0.03); margin-bottom: 6px; cursor: pointer;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <input 
                type="checkbox" 
                checked={selectedSimilarTxIds.has(item.id)}
                onchange={() => toggleSimilarTxCheck(item.id)}
                style="width: 17px; height: 17px; accent-color: #6366f1;"
              />
              <div>
                <div style="font-weight: 600; color: white; font-size: 0.88rem;">{item.libelle}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">{new Date(item.date).toLocaleDateString("fr-FR")}</div>
              </div>
            </div>
            <div style="font-weight: 700; color: {item.debit > 0 ? '#f87171' : '#34d399'}; font-size: 0.9rem;">
              {item.debit > 0 ? "-" : "+"}{(item.debit > 0 ? item.debit : item.credit).toFixed(2)} €
            </div>
          </label>
        {/each}
      </div>

      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button class="btn btn-secondary" onclick={() => {
          if (!pendingPrimaryTx) return;
          const updated = $transactions.map(t => t.id === pendingPrimaryTx.id ? { ...t, compteAttribué: targetSimilarCategory, statut: 'attribue' } : t);
          updateTransactions(updated);
          showToast(`Écriture seule attribuée au compte ${targetSimilarCategory} !`);
          showSimilarTxModal = false;
        }} style="padding: 10px 16px;">
          Valider uniquement cette écriture
        </button>

        <button class="btn btn-primary" onclick={validerAttributionGroupéeSimilaire} style="padding: 10px 22px; background: #6366f1; border: none; font-weight: 600;">
          <i class="fa-solid fa-check-double"></i> Attribué aux {selectedSimilarTxIds.size + 1} opérations
        </button>
      </div>

    </div>
  </div>
{/if}

<!-- Modale Dédiée de Ventilation (Répartition sur plusieurs comptes) -->
{#if showSplitModal && splitTargetTx}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-backdrop" onclick={() => showSplitModal = false} role="presentation" style="position: fixed; inset: 0; background: rgba(5, 10, 20, 0.78); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 100000; padding: 20px;">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
    <div class="modal-content" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Ventiler l'opération" tabindex="-1" style="max-width: 680px; width: 100%; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; background: #0c1527 !important; border: 1.5px solid rgba(168, 85, 247, 0.35) !important; border-radius: 16px; padding: 22px 24px; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.75); color: #f8fafc !important;">

      <!-- Header -->
      <div style="flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 34px; height: 34px; border-radius: 9px; background: rgba(168, 85, 247, 0.16); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.35); display: flex; align-items: center; justify-content: center; font-size: 0.95rem;">
            <i class="fa-solid fa-code-branch"></i>
          </div>
          <div>
            <h3 style="margin: 0; font-family: var(--font-title); font-size: 1.12rem; color: #ffffff !important; font-weight: 800;">
              Ventiler l'opération sur plusieurs comptes
            </h3>
            <div style="font-size: 0.78rem; color: #94a3b8 !important; margin-top: 2px;">
              Répartissez le montant exact (ex. capital + intérêts d'emprunt, cotisation + cours, part pro / perso).
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label="Fermer"
          onclick={() => showSplitModal = false}
          style="background: none; border: none; color: #94a3b8; font-size: 1.25rem; cursor: pointer; padding: 4px;"
        >✕</button>
      </div>

      <!-- Résumé de l'opération d'origine -->
      <div style="flex-shrink: 0; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
        <div style="min-width: 0; flex: 1;">
          <div style="font-weight: 700; color: #ffffff; font-size: 0.94rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title={splitTargetTx.libelle}>
            {cleanTransactionLibelle(splitTargetTx.rawLibelle || splitTargetTx.libelle, splitTargetTx)}
          </div>
          <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 2px;">
            {formatDateFr(splitTargetTx.date)} &bull; {Number(splitTargetTx.debit || 0) > 0 ? 'Dépense' : 'Recette'}
          </div>
        </div>
        <div style="font-weight: 800; font-size: 1.15rem; font-variant-numeric: tabular-nums; font-family: var(--font-title); color: {Number(splitTargetTx.debit || 0) > 0 ? '#f87171' : '#34d399'}; white-space: nowrap;">
          {Number(splitTargetTx.debit || 0) > 0 ? '- ' : '+ '}{splitOriginalAmount.toFixed(2).replace('.', ',')} €
        </div>
      </div>

      <!-- Lignes de ventilation (scrollable) -->
      <div style="flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; display: flex; flex-direction: column; gap: 10px; padding-right: 4px; margin-bottom: 14px;">
        {#each splitLines as line, idx (line.id)}
          <div style="flex-shrink: 0; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 0.74rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #c084fc;">
                Part {idx + 1}
              </span>
              {#if splitLines.length > 2}
                <button
                  type="button"
                  onclick={() => removeSplitLine(idx)}
                  style="background: none; border: none; color: #f87171; font-size: 0.74rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                >
                  <i class="fa-solid fa-trash-can" style="font-size: 0.68rem;"></i> Retirer
                </button>
              {/if}
            </div>

            <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 10px; align-items: end;">
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <label for="split-acc-{line.id}" style="font-size: 0.72rem; font-weight: 700; color: #94a3b8;">Compte comptable</label>
                <select
                  id="split-acc-{line.id}"
                  bind:value={line.compte}
                  style="width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.14); background: #101c33; color: #ffffff; font-size: 0.82rem; font-weight: 600;"
                >
                  {#if Number(splitTargetTx.debit || 0) > 0}
                    <optgroup label="Dépenses & Charges">
                      {#each listComptesTries.filter(p => p.compte.startsWith('6') || p.compte.startsWith('2')) as p}
                        <option value={p.compte}>{p.compte} — {p.libelle}</option>
                      {/each}
                    </optgroup>
                    <optgroup label="Prélèvements, Emprunts, TVA & Transferts">
                      {#each listComptesTries.filter(p => !p.compte.startsWith('6') && !p.compte.startsWith('7') && !p.compte.startsWith('2')) as p}
                        <option value={p.compte}>{p.compte} — {p.libelle}</option>
                      {/each}
                    </optgroup>
                  {:else}
                    <optgroup label="Recettes & Produits">
                      {#each listComptesTries.filter(p => p.compte.startsWith('7')) as p}
                        <option value={p.compte}>{p.compte} — {p.libelle}</option>
                      {/each}
                    </optgroup>
                    <optgroup label="Transferts, Apports & Cautions">
                      {#each listComptesTries.filter(p => !p.compte.startsWith('6') && !p.compte.startsWith('7') && !p.compte.startsWith('2')) as p}
                        <option value={p.compte}>{p.compte} — {p.libelle}</option>
                      {/each}
                    </optgroup>
                  {/if}
                </select>
              </div>

              <div style="display: flex; flex-direction: column; gap: 4px;">
                <label for="split-amt-{line.id}" style="font-size: 0.72rem; font-weight: 700; color: #94a3b8;">Montant (€)</label>
                <div style="display: flex; gap: 6px;">
                  <input
                    id="split-amt-{line.id}"
                    type="text"
                    inputmode="decimal"
                    bind:value={line.amount}
                    placeholder="0,00"
                    style="flex: 1; min-width: 0; padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.14); background: #101c33; color: #ffffff; font-size: 0.86rem; font-weight: 700; font-variant-numeric: tabular-nums; text-align: right;"
                  />
                  <button
                    type="button"
                    onclick={() => fillSplitRemaining(idx)}
                    title="Affecter automatiquement le reste à cette ligne"
                    style="padding: 6px 9px; border-radius: 8px; border: 1px solid rgba(56, 189, 248, 0.35); background: rgba(56, 189, 248, 0.12); color: #38bdf8; font-size: 0.72rem; font-weight: 700; cursor: pointer; white-space: nowrap;"
                  >
                    Reste
                  </button>
                </div>
              </div>
            </div>

            <input
              type="text"
              bind:value={line.note}
              placeholder="Précision optionnelle (ex : Part capital, Intérêts, Cotisation annuelle, Part perso...)"
              style="width: 100%; box-sizing: border-box; padding: 7px 10px; border-radius: 7px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(0, 0, 0, 0.22); color: #e2e8f0; font-size: 0.78rem;"
            />
          </div>
        {/each}

        <button
          type="button"
          onclick={addSplitLine}
          style="flex-shrink: 0; align-self: flex-start; padding: 7px 13px; border-radius: 8px; border: 1px dashed rgba(168, 85, 247, 0.45); background: rgba(168, 85, 247, 0.08); color: #d8b4fe; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;"
        >
          <i class="fa-solid fa-plus"></i>
          <span>Ajouter une ligne</span>
        </button>
      </div>

      <!-- Bandeau d'équilibre temps réel + Rappel justificatif -->
      <div style="flex-shrink: 0; padding: 12px 14px; border-radius: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: {isSplitBalanced ? 'rgba(16, 185, 129, 0.12)' : splitRemaining < 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.1)'}; border: 1px solid {isSplitBalanced ? 'rgba(16, 185, 129, 0.4)' : splitRemaining < 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.35)'};">
        <div style="font-size: 0.82rem; font-weight: 700; color: #e2e8f0;">
          Total ventilé : <span style="font-variant-numeric: tabular-nums;">{splitAllocatedTotal.toFixed(2).replace('.', ',')} €</span> / {splitOriginalAmount.toFixed(2).replace('.', ',')} €
        </div>
        <div style="font-size: 0.82rem; font-weight: 800; color: {isSplitBalanced ? '#34d399' : splitRemaining < 0 ? '#f87171' : '#fbbf24'};">
          {#if isSplitBalanced}
            <i class="fa-solid fa-circle-check"></i> Équilibré au centime près
          {:else if splitRemaining < 0}
            Dépassement de {Math.abs(splitRemaining).toFixed(2).replace('.', ',')} €
          {:else}
            Reste à répartir : {splitRemaining.toFixed(2).replace('.', ',')} €
          {/if}
        </div>
      </div>

      <!-- Footer -->
      <div style="flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 14px;">
        <span style="font-size: 0.72rem; color: #94a3b8;">
          <i class="fa-solid fa-shield-halved" style="color: #38bdf8; margin-right: 4px;"></i>
          Conservez le justificatif détaillé (facture, tableau d'amortissement…).
        </span>
        <div style="display: flex; gap: 10px; margin-left: auto;">
          <button
            type="button"
            onclick={() => showSplitModal = false}
            style="padding: 8px 16px; border-radius: 7px; color: #cbd5e1; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.14); font-size: 0.84rem; font-weight: 600; cursor: pointer;"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!isSplitValid}
            onclick={validerVentilation}
            style="padding: 8px 18px; font-weight: 700; border: none; border-radius: 7px; font-size: 0.84rem; cursor: {isSplitValid ? 'pointer' : 'not-allowed'}; background: {isSplitValid ? '#7c3aed' : 'rgba(255, 255, 255, 0.08)'}; color: {isSplitValid ? '#ffffff' : '#64748b'}; box-shadow: {isSplitValid ? '0 4px 14px rgba(124, 58, 237, 0.35)' : 'none'};"
          >
            Valider la ventilation
          </button>
        </div>
      </div>

    </div>
  </div>
{/if}

<!-- Modale Dédiée d'Attribution de Compte (Accordéon épuré) -->
{#if showCategorizeModal && selectedTxForCategorization}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-backdrop" onclick={() => showCategorizeModal = false} role="presentation" style="position: fixed; inset: 0; background: rgba(5, 10, 20, 0.78); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 100000; padding: 20px;">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
    <div class="modal-content" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1" style="max-width: 580px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; background: #0c1527 !important; border: 1.5px solid rgba(56, 189, 248, 0.25) !important; border-radius: 16px; padding: 22px 24px; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.75); color: #f8fafc !important;">
      
      <!-- Modal Header -->
      <div style="flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 12px;">
        <div>
          <h3 style="margin: 0; font-family: var(--font-title); font-size: 1.15rem; color: #ffffff !important; font-weight: 800;">
            Attribuer un compte comptable
          </h3>
          <div style="font-size: 0.8rem; color: #94a3b8 !important; margin-top: 2px;">
            Sélectionnez la catégorie comptable à associer à cette opération
          </div>
        </div>
        <button 
          type="button" 
          aria-label="Fermer"
          title="Fermer"
          onclick={() => showCategorizeModal = false} 
          style="background: none; border: none; color: #94a3b8; font-size: 1.25rem; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; border-radius: 6px; transition: color 0.15s ease;"
          onmouseenter={(e) => { e.currentTarget.style.color = '#ffffff'; }}
          onmouseleave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
        >✕</button>
      </div>

      <!-- Transaction Card Summary -->
      <div style="flex-shrink: 0; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 12px 14px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
          <div style="min-width: 0; flex: 1;">
            <div style="font-weight: 700; color: #ffffff !important; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title={selectedTxForCategorization.libelle}>
              {cleanTransactionLibelle(selectedTxForCategorization.libelle, selectedTxForCategorization)}
            </div>
            <div style="font-size: 0.76rem; color: #94a3b8 !important; margin-top: 2px;">
              {selectedTxForCategorization.date ? new Date(selectedTxForCategorization.date).toLocaleDateString("fr-FR") : ''} &bull; {selectedTxForCategorization.debit > 0 ? "Dépense" : "Recette"}
              {selectedTxForCategorization.reference ? ` • Ref: ${selectedTxForCategorization.reference}` : ''}
            </div>
          </div>
          <div style="font-weight: 800; font-size: 1.1rem; color: {selectedTxForCategorization.debit > 0 ? '#f87171' : '#34d399'}; font-family: var(--font-title); white-space: nowrap;">
            {selectedTxForCategorization.debit > 0 ? "-" : "+"}
            {(Number(selectedTxForCategorization.debit || selectedTxForCategorization.credit || 0)).toFixed(2)} €
          </div>
        </div>

        <!-- Suggestion if available -->
        {#if getSuggestionForTx(selectedTxForCategorization)}
          {@const sug = getSuggestionForTx(selectedTxForCategorization)}
          {#if sug}
            <div style="margin-top: 10px; display: flex; align-items: center; justify-content: space-between; background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); padding: 7px 11px; border-radius: 8px;">
              <div style="font-size: 0.8rem;">
                <span style="color: #94a3b8; font-weight: 600;">Suggestion : </span>
                <strong style="color: #ffffff;">{sug?.label}</strong>
              </div>
              <button 
                type="button" 
                style="padding: 4px 10px; font-size: 0.75rem; background: #38bdf8; color: #080e1a; border: none; border-radius: 6px; font-weight: 800; cursor: pointer; transition: opacity 0.15s ease;"
                onclick={() => {
                  if (sug && selectedTxForCategorization) {
                    selectAccount(selectedTxForCategorization.id, sug.compte);
                    validerLigneSeule(selectedTxForCategorization);
                    showCategorizeModal = false;
                  }
                }}
              >
                Appliquer
              </button>
            </div>
          {/if}
        {/if}
      </div>

      <!-- Barre de recherche instantanée (numéro, libellé ou exemple : EDF, OpenAI, comptable, essence...) -->
      <div style="flex-shrink: 0; position: relative; margin-bottom: 12px;">
        <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748b; font-size: 0.82rem; pointer-events: none;"></i>
        <input
          type="text"
          bind:value={modalSearchQuery}
          placeholder="Rechercher un compte ou un exemple (ex : 627, essence, logiciel, comptable, URSSAF...)"
          style="width: 100%; box-sizing: border-box; padding: 9px 34px 9px 34px; border-radius: 9px; border: 1px solid rgba(255, 255, 255, 0.14); background: rgba(255, 255, 255, 0.05); color: #ffffff; font-size: 0.84rem; outline: none;"
        />
        {#if modalSearchQuery.trim()}
          <button
            type="button"
            onclick={() => modalSearchQuery = ''}
            aria-label="Effacer la recherche"
            style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 0.85rem; padding: 4px;"
          >✕</button>
        {/if}
      </div>

      <!-- Scrollable Body (Résultats de recherche OU Accordéon Recettes / Dépenses) -->
      <div style="flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; display: flex; flex-direction: column; gap: 10px; padding-right: 4px; margin-bottom: 14px;">

        {#if modalSearchQuery.trim()}
          {#if modalSearchResults.length === 0}
            <div style="flex-shrink: 0; text-align: center; padding: 24px 16px; color: #94a3b8; font-size: 0.84rem; background: rgba(255, 255, 255, 0.03); border: 1px dashed rgba(255, 255, 255, 0.12); border-radius: 10px;">
              Aucun compte ne correspond à « {modalSearchQuery} ». Essayez un mot plus simple (ex. <em>fournitures</em>, <em>loyer</em>, <em>repas</em>) ou parcourez les rubriques.
            </div>
          {:else}
            <div style="flex-shrink: 0; display: flex; flex-direction: column; gap: 6px;">
              {#each modalSearchResults as acc}
                {@const isSelected = (selectedCategoryMap[selectedTxForCategorization.id] || selectedTxForCategorization.compteAttribué) === acc.compte}
                <button
                  type="button"
                  onclick={() => {
                    selectedCategoryMap[selectedTxForCategorization.id] = acc.compte;
                  }}
                  style="text-align: left; padding: 9px 12px; border-radius: 8px; cursor: pointer; border: 1px solid {isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}; background: {isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)'}; color: #ffffff; display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%;"
                >
                  <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                      <span style="font-weight: 700; font-size: 0.84rem; color: #ffffff !important;">{acc.libelle || formatAccountLabel(acc.compte)}</span>
                      <span style="font-size: 0.7rem; font-weight: 700; padding: 1px 6px; border-radius: 4px; background: {isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}; color: {isSelected ? '#080e1a' : '#e2e8f0'};">
                        {acc.compte}
                      </span>
                      {#if acc.isCustom}
                        <span style="font-size: 0.65rem; font-weight: 700; padding: 1px 5px; border-radius: 4px; background: rgba(168, 85, 247, 0.2); color: #d8b4fe; border: 1px solid rgba(168, 85, 247, 0.35);">Perso</span>
                      {/if}
                    </div>
                    {#if acc.desc}
                      <div style="font-size: 0.74rem; color: #94a3b8; margin-top: 3px; line-height: 1.35;">
                        {acc.desc}
                      </div>
                    {/if}
                  </div>
                  {#if isSelected}
                    <span style="font-size: 0.7rem; font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.18); border: 1px solid rgba(56, 189, 248, 0.4); padding: 2px 7px; border-radius: 4px; flex-shrink: 0;">Sélectionné</span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        {:else}
        <!-- 1. ACCORDÉON RECETTES -->
        <div style="flex-shrink: 0; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; overflow: hidden; background: rgba(255, 255, 255, 0.02);">
          <button 
            type="button"
            onclick={() => {
              activeAccordionSection = activeAccordionSection === 'recettes' ? null : 'recettes';
              activeSubMenuKey = null;
            }}
            style="width: 100%; padding: 11px 14px; background: {activeAccordionSection === 'recettes' ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.03)'}; border: none; border-bottom: {activeAccordionSection === 'recettes' ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'}; cursor: pointer; display: flex; align-items: center; justify-content: space-between; text-align: left; transition: background 0.15s ease;"
          >
            <span style="font-weight: 800; font-size: 0.92rem; color: #ffffff !important;">Recettes</span>
            <span style="color: #94a3b8; font-size: 0.75rem; font-weight: 700;">{activeAccordionSection === 'recettes' ? '▲' : '▼'}</span>
          </button>

          {#if activeAccordionSection === 'recettes'}
            <div style="padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; background: rgba(0, 0, 0, 0.25);">
              {#each modalAccordionGroups.recettes as sub}
                {@const isSubOpen = activeSubMenuKey === sub.id}
                {@const hasSelectedInSub = subHasSelectedAccount(sub, selectedCategoryMap[selectedTxForCategorization.id] || selectedTxForCategorization.compteAttribué)}
                
                <div style="flex-shrink: 0; border: 1px solid {hasSelectedInSub ? 'rgba(56, 189, 248, 0.45)' : 'rgba(255, 255, 255, 0.08)'}; border-radius: 8px; overflow: hidden; background: rgba(255, 255, 255, 0.03);">
                  <button 
                    type="button"
                    onclick={() => activeSubMenuKey = isSubOpen ? null : sub.id}
                    style="width: 100%; padding: 9px 12px; background: {isSubOpen ? 'rgba(56, 189, 248, 0.12)' : 'transparent'}; border: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; text-align: left; gap: 8px;"
                  >
                    <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                      <span style="font-weight: 700; font-size: 0.84rem; color: #ffffff !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title={sub.label}>{sub.label}</span>
                      {#if hasSelectedInSub}
                        <span style="font-size: 0.68rem; font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.18); padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.35); flex-shrink: 0;">Sélectionné</span>
                      {/if}
                    </div>
                    <span style="color: #94a3b8; font-size: 0.7rem; font-weight: 700;">{isSubOpen ? '▾' : '▸'}</span>
                  </button>

                  {#if isSubOpen}
                    <div style="padding: 6px 8px; border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; flex-direction: column; gap: 4px; background: rgba(0, 0, 0, 0.2);">
                      {#each sub.accounts as acc}
                        {@const isSelected = (selectedCategoryMap[selectedTxForCategorization.id] || selectedTxForCategorization.compteAttribué) === acc.compte}
                        <button 
                          type="button"
                          onclick={() => {
                            selectedCategoryMap[selectedTxForCategorization.id] = acc.compte;
                          }}
                          style="text-align: left; padding: 8px 12px; border-radius: 6px; cursor: pointer; border: 1px solid {isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}; background: {isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.02)'}; color: #ffffff; display: flex; justify-content: space-between; align-items: center; gap: 8px; transition: all 0.1s ease; width: 100%;"
                        >
                          <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                              <span style="font-weight: 600; font-size: 0.83rem; color: #ffffff !important;">{acc.libelle || formatAccountLabel(acc.compte)}</span>
                              <span style="font-size: 0.7rem; font-weight: 700; padding: 1px 5px; border-radius: 4px; background: {isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}; color: {isSelected ? '#080e1a' : '#cbd5e1'}; border: 1px solid {isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.12)'};">
                                {acc.compte}
                              </span>
                            </div>
                            {#if acc.desc}
                              <div style="font-size: 0.74rem; color: #94a3b8; margin-top: 2px;">
                                {acc.desc}
                              </div>
                            {/if}
                          </div>
                          {#if isSelected}
                            <span style="font-size: 0.7rem; font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.18); border: 1px solid rgba(56, 189, 248, 0.4); padding: 2px 7px; border-radius: 4px; flex-shrink: 0;">Sélectionné</span>
                          {/if}
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- 2. ACCORDÉON DÉPENSES -->
        <div style="flex-shrink: 0; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; overflow: hidden; background: rgba(255, 255, 255, 0.02);">
          <button 
            type="button"
            onclick={() => {
              activeAccordionSection = activeAccordionSection === 'depenses' ? null : 'depenses';
              activeSubMenuKey = null;
            }}
            style="width: 100%; padding: 11px 14px; background: {activeAccordionSection === 'depenses' ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.03)'}; border: none; border-bottom: {activeAccordionSection === 'depenses' ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'}; cursor: pointer; display: flex; align-items: center; justify-content: space-between; text-align: left; transition: background 0.15s ease;"
          >
            <span style="font-weight: 800; font-size: 0.92rem; color: #ffffff !important;">Dépenses</span>
            <span style="color: #94a3b8; font-size: 0.75rem; font-weight: 700;">{activeAccordionSection === 'depenses' ? '▲' : '▼'}</span>
          </button>

          {#if activeAccordionSection === 'depenses'}
            <div style="padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; background: rgba(0, 0, 0, 0.25);">
              {#each modalAccordionGroups.depenses as sub}
                {@const isSubOpen = activeSubMenuKey === sub.id}
                {@const hasSelectedInSub = subHasSelectedAccount(sub, selectedCategoryMap[selectedTxForCategorization.id] || selectedTxForCategorization.compteAttribué)}
                
                <div style="flex-shrink: 0; border: 1px solid {hasSelectedInSub ? 'rgba(56, 189, 248, 0.45)' : 'rgba(255, 255, 255, 0.08)'}; border-radius: 8px; overflow: hidden; background: rgba(255, 255, 255, 0.03);">
                  <button 
                    type="button"
                    onclick={() => activeSubMenuKey = isSubOpen ? null : sub.id}
                    style="width: 100%; padding: 9px 12px; background: {isSubOpen ? 'rgba(56, 189, 248, 0.12)' : 'transparent'}; border: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; text-align: left; gap: 8px;"
                  >
                    <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                      <span style="font-weight: 700; font-size: 0.84rem; color: #ffffff !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title={sub.label}>{sub.label}</span>
                      {#if hasSelectedInSub}
                        <span style="font-size: 0.68rem; font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.18); padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.35); flex-shrink: 0;">Sélectionné</span>
                      {/if}
                    </div>
                    <span style="color: #94a3b8; font-size: 0.7rem; font-weight: 700;">{isSubOpen ? '▾' : '▸'}</span>
                  </button>

                  {#if isSubOpen}
                    <div style="padding: 6px 8px; border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; flex-direction: column; gap: 4px; background: rgba(0, 0, 0, 0.2);">
                      {#each sub.accounts as acc}
                        {@const isSelected = (selectedCategoryMap[selectedTxForCategorization.id] || selectedTxForCategorization.compteAttribué) === acc.compte}
                        <button 
                          type="button"
                          onclick={() => {
                            selectedCategoryMap[selectedTxForCategorization.id] = acc.compte;
                          }}
                          style="text-align: left; padding: 8px 12px; border-radius: 6px; cursor: pointer; border: 1px solid {isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}; background: {isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.02)'}; color: #ffffff; display: flex; justify-content: space-between; align-items: center; gap: 8px; transition: all 0.1s ease; width: 100%;"
                        >
                          <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                              <span style="font-weight: 600; font-size: 0.83rem; color: #ffffff !important;">{acc.libelle || formatAccountLabel(acc.compte)}</span>
                              <span style="font-size: 0.7rem; font-weight: 700; padding: 1px 5px; border-radius: 4px; background: {isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}; color: {isSelected ? '#080e1a' : '#cbd5e1'}; border: 1px solid {isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.12)'};">
                                {acc.compte}
                              </span>
                            </div>
                            {#if acc.desc}
                              <div style="font-size: 0.74rem; color: #94a3b8; margin-top: 2px;">
                                {acc.desc}
                              </div>
                            {/if}
                          </div>
                          {#if isSelected}
                            <span style="font-size: 0.7rem; font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.18); border: 1px solid rgba(56, 189, 248, 0.4); padding: 2px 7px; border-radius: 4px; flex-shrink: 0;">Sélectionné</span>
                          {/if}
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
        {/if}

      </div>

      <!-- Modal Footer Actions -->
      <div style="flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 14px;">
        <button
          type="button"
          onclick={openSubAccountsManager}
          style="background: none; border: none; padding: 0; color: #94a3b8; font-size: 0.76rem; font-weight: 600; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; transition: color 0.15s ease;"
          onmouseenter={(e) => { e.currentTarget.style.color = '#38bdf8'; }}
          onmouseleave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
        >
          Besoin d'un sous-compte spécifique (ex. 60623) ?
        </button>

        <div style="display: flex; gap: 10px; margin-left: auto;">
        <button 
          type="button" 
          onclick={() => showCategorizeModal = false} 
          style="padding: 8px 16px; border-radius: 7px; color: #cbd5e1 !important; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.14); font-size: 0.84rem; font-weight: 600; cursor: pointer; transition: all 0.15s ease;"
          onmouseenter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.color = '#ffffff'; }}
          onmouseleave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.color = '#cbd5e1'; }}
        >
          Annuler
        </button>
        <button 
          type="button" 
          onclick={() => {
            validerLigneSeule(selectedTxForCategorization);
            showCategorizeModal = false;
          }}
          style="padding: 8px 18px; font-weight: 700; background: #4f46e5; color: #ffffff; border: none; border-radius: 7px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.84rem; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35); transition: all 0.15s ease;"
          onmouseenter={(e) => { e.currentTarget.style.background = '#4338ca'; }}
          onmouseleave={(e) => { e.currentTarget.style.background = '#4f46e5'; }}
        >
          Valider l'attribution
        </button>
        </div>
      </div>

    </div>
  </div>
{/if}

<!-- MODALE DU DICTIONNAIRE D'ATTRIBUTION -->
{#if showDictionaryModal}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div 
    class="dict-modal-backdrop" 
    role="dialog" 
    aria-modal="true" 
    aria-label="Dictionnaire d'attribution"
    tabindex="-1"
    onclick={() => {
      showDictionaryModal = false;
      Categorizer.reappliquerReglesAuxTransactionsEnAttente();
      selectedCategoryMap = {};
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div 
      class="dict-modal-card" 
      onclick={(e) => e.stopPropagation()}
    >
      <!-- En-tête -->
      <div class="dict-modal-header">
        <div class="dict-header-title-group">
          <div class="dict-header-icon">
            <i class="fa-solid fa-book-bookmark"></i>
          </div>
          <div>
            <h2 class="dict-modal-title">Dictionnaire d'attribution</h2>
            <p class="dict-modal-subtitle">
              Vos mots-clés mémorisés pour reconnaître et classer automatiquement vos opérations lors des imports.
            </p>
          </div>
        </div>
        <button 
          type="button" 
          onclick={() => {
            showDictionaryModal = false;
            Categorizer.reappliquerReglesAuxTransactionsEnAttente();
            selectedCategoryMap = {};
          }}
          aria-label="Fermer"
          class="dict-modal-close-btn"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- Barre d'onglets : Dictionnaire / Sous-comptes avancés -->
      <div style="flex-shrink: 0; display: flex; gap: 8px; padding: 10px 24px; border-bottom: 1px solid var(--border-color, #e2e8f0); background: var(--bg-card, #ffffff);">
        <button
          type="button"
          onclick={() => dictModalTab = 'rules'}
          style="padding: 7px 14px; border-radius: 8px; font-size: 0.82rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: all 0.15s ease; {dictModalTab === 'rules' ? 'background: #4f46e5; color: #ffffff; border: 1px solid #4f46e5;' : 'background: var(--bg-subtle); color: var(--text-secondary); border: 1px solid var(--border-color);'}"
        >
          <i class="fa-solid fa-book-bookmark" style="font-size: 0.78rem;"></i>
          <span>Dictionnaire ({$rules.length})</span>
        </button>
        <button
          type="button"
          onclick={() => dictModalTab = 'subaccounts'}
          style="padding: 7px 14px; border-radius: 8px; font-size: 0.82rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: all 0.15s ease; {dictModalTab === 'subaccounts' ? 'background: #4f46e5; color: #ffffff; border: 1px solid #4f46e5;' : 'background: var(--bg-subtle); color: var(--text-secondary); border: 1px solid var(--border-color);'}"
        >
          <i class="fa-solid fa-sitemap" style="font-size: 0.78rem;"></i>
          <span>Sous-comptes avancés ({customSubAccounts.length})</span>
        </button>
      </div>

      <!-- Corps défilable -->
      <div class="dict-modal-body">
        {#if dictModalTab === 'rules'}
        
        <!-- Bloc formulaire : Ajouter un nouveau mot-clé -->
        <div class="dict-add-box">
          <div class="dict-add-box-title">
            <i class="fa-solid fa-circle-plus" style="color: #6366f1;"></i>
            <span>Ajouter un mot-clé au dictionnaire</span>
          </div>

          <div class="dict-add-grid">
            <div class="dict-field-group dict-field-keyword">
              <label for="dict-kw" class="dict-field-label">
                Quand le libellé contient :
              </label>
              <input 
                id="dict-kw"
                type="text" 
                bind:value={newRuleKeyword}
                placeholder="Ex : SPOTIFY, TOTAL, UBER..."
                class="dict-input"
              />
            </div>

            <div class="dict-field-group dict-field-type">
              <label for="dict-type" class="dict-field-label">
                Sens :
              </label>
              <select 
                id="dict-type"
                bind:value={newRuleType}
                class="dict-select"
              >
                <option value="debit">Dépense (-)</option>
                <option value="credit">Recette (+)</option>
              </select>
            </div>

            <div class="dict-field-group dict-field-account">
              <label for="dict-acc" class="dict-field-label">
                Attribuer à la catégorie :
              </label>
              <select 
                id="dict-acc"
                bind:value={newRuleAccount}
                class="dict-select"
              >
                {#if newRuleType === 'credit'}
                  <optgroup label="Entrées & Recettes">
                    {#each $planComptable.filter(p => p.compte !== '699' && (p.compte.startsWith('7') || p.type === 'Produit' || p.group === 'entrees')) as p}
                      <option value={p.compte}>{p.compte} - {formatAccountLabel(p.compte)}</option>
                    {/each}
                  </optgroup>
                  <optgroup label="Comptes & Transferts">
                    {#each $planComptable.filter(p => p.compte !== '699' && (p.compte.startsWith('4') || p.compte.startsWith('5'))) as p}
                      <option value={p.compte}>{p.compte} - {formatAccountLabel(p.compte)}</option>
                    {/each}
                  </optgroup>
                {:else}
                  <optgroup label="Dépenses & Frais professionnels">
                    {#each $planComptable.filter(p => p.compte !== '699' && p.compte.startsWith('6') && p.group !== 'equipe') as p}
                      <option value={p.compte}>{p.compte} - {formatAccountLabel(p.compte)}</option>
                    {/each}
                  </optgroup>
                  <optgroup label="Équipe, Salaires & Social">
                    {#each $planComptable.filter(p => p.compte !== '699' && (p.group === 'equipe' || ['611', '641', '645', '6453', '658'].includes(p.compte))) as p}
                      <option value={p.compte}>{p.compte} - {formatAccountLabel(p.compte)}</option>
                    {/each}
                  </optgroup>
                  <optgroup label="Comptes & Transferts">
                    {#each $planComptable.filter(p => p.compte !== '699' && (p.compte.startsWith('4') || p.compte.startsWith('5'))) as p}
                      <option value={p.compte}>{p.compte} - {formatAccountLabel(p.compte)}</option>
                    {/each}
                  </optgroup>
                {/if}
              </select>
            </div>

            <div class="dict-field-group dict-field-submit">
              <button 
                type="button" 
                onclick={handleAddDictionaryRule}
                class="dict-submit-btn"
              >
                <i class="fa-solid fa-plus"></i>
                <span>Ajouter</span>
              </button>
            </div>
          </div>
        </div>

        <!-- En-tête de liste & barre de recherche -->
        <div class="dict-list-section">
          <div class="dict-search-header">
            <div class="dict-count-title">
              Mots-clés enregistrés <span class="dict-count-badge">({filteredRules.length})</span>
            </div>

            <div class="dict-search-input-box">
              <i class="fa-solid fa-magnifying-glass dict-search-icon"></i>
              <input 
                type="text" 
                bind:value={dictionarySearch}
                placeholder="Rechercher un mot-clé ou catégorie..."
                class="dict-search-input"
              />
            </div>
          </div>

          <!-- Tableau ou Cartes des règles -->
          {#if filteredRules.length === 0}
            <div class="dict-empty-state">
              <i class="fa-solid fa-book-open dict-empty-icon"></i>
              <div class="dict-empty-title">
                {dictionarySearch ? 'Aucun mot-clé ne correspond à votre recherche.' : 'Aucun mot-clé enregistré pour cette structure.'}
              </div>
              <p class="dict-empty-desc">
                {dictionarySearch ? 'Essayez un autre terme de recherche.' : 'Ajoutez vos fournisseurs ou clients habituels ci-dessus, ou classez simplement vos écritures : elles s\'enregistrent automatiquement ici !'}
              </p>
            </div>
          {:else}
            <!-- Vue Tableau Desktop -->
            <div class="dict-desktop-table-container">
              <table class="dict-table">
                <thead>
                  <tr>
                    <th>Mot-clé détecté</th>
                    <th>Sens</th>
                    <th>Catégorie attribuée</th>
                    <th style="text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {#each filteredRules as r}
                    {@const accountNum = r.debit || r.credit}
                    {@const isDebit = Boolean(r.debit)}
                    {@const isEditing = editingRuleOriginalMotCle === r.motCle}
                    
                    {#if isEditing}
                      <!-- LIGNE EN COURS DE MODIFICATION -->
                      <tr class="dict-table-row is-editing">
                        <td>
                          <input 
                            type="text" 
                            bind:value={editingKeyword}
                            onkeydown={(e) => { if (e.key === 'Enter') saveEditRule(); if (e.key === 'Escape') cancelEditRule(); }}
                            placeholder="Mot-clé..."
                            class="dict-input dict-input-sm"
                            style="font-family: ui-monospace, SFMono-Regular, monospace; font-weight: 700;"
                          />
                        </td>
                        <td>
                          <select 
                            bind:value={editingType}
                            class="dict-select dict-select-sm"
                          >
                            <option value="debit">Dépense (-)</option>
                            <option value="credit">Recette (+)</option>
                          </select>
                        </td>
                        <td>
                          <select 
                            bind:value={editingAccount}
                            class="dict-select dict-select-sm"
                          >
                            {#if editingType === 'credit'}
                              <optgroup label="Entrées & Recettes">
                                {#each $planComptable.filter(p => p.compte !== '699' && (p.compte.startsWith('7') || p.type === 'Produit' || p.group === 'entrees')) as p}
                                  <option value={p.compte}>{p.compte} - {formatAccountLabel(p.compte)}</option>
                                {/each}
                              </optgroup>
                              <optgroup label="Comptes & Transferts">
                                {#each $planComptable.filter(p => p.compte !== '699' && (p.compte.startsWith('4') || p.compte.startsWith('5'))) as p}
                                  <option value={p.compte}>{p.compte} - {formatAccountLabel(p.compte)}</option>
                                {/each}
                              </optgroup>
                            {:else}
                              <optgroup label="Dépenses & Frais professionnels">
                                {#each $planComptable.filter(p => p.compte !== '699' && p.compte.startsWith('6') && p.group !== 'equipe') as p}
                                  <option value={p.compte}>{p.compte} - {formatAccountLabel(p.compte)}</option>
                                {/each}
                              </optgroup>
                              <optgroup label="Équipe, Salaires & Social">
                                {#each $planComptable.filter(p => p.compte !== '699' && (p.group === 'equipe' || ['611', '641', '645', '6453', '658'].includes(p.compte))) as p}
                                  <option value={p.compte}>{p.compte} - {formatAccountLabel(p.compte)}</option>
                                {/each}
                              </optgroup>
                              <optgroup label="Comptes & Transferts">
                                {#each $planComptable.filter(p => p.compte !== '699' && (p.compte.startsWith('4') || p.compte.startsWith('5'))) as p}
                                  <option value={p.compte}>{p.compte} - {formatAccountLabel(p.compte)}</option>
                                {/each}
                              </optgroup>
                            {/if}
                          </select>
                        </td>
                        <td style="text-align: right; white-space: nowrap;">
                          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                            <button 
                              type="button" 
                              onclick={saveEditRule}
                              title="Enregistrer les modifications"
                              class="dict-save-btn"
                            >
                              <i class="fa-solid fa-check"></i> Enregistrer
                            </button>
                            <button 
                              type="button" 
                              onclick={cancelEditRule}
                              title="Annuler"
                              aria-label="Annuler la modification"
                              class="dict-cancel-btn"
                            >
                              <i class="fa-solid fa-xmark"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    {:else}
                      <!-- LIGNE NORMALE -->
                      <tr class="dict-table-row">
                        <td>
                          <span class="dict-code-pill">
                            {r.motCle}
                          </span>
                        </td>
                        <td>
                          <span class="dict-sens-pill {isDebit ? 'debit' : 'credit'}">
                            {isDebit ? 'Dépense (-)' : 'Recette (+)'}
                          </span>
                        </td>
                        <td>
                          <span class="dict-acc-label">{formatAccountLabel(accountNum)}</span>
                          <span class="dict-acc-num">({accountNum})</span>
                        </td>
                        <td style="text-align: right; white-space: nowrap;">
                          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                            <button 
                              type="button" 
                              onclick={() => startEditRule(r)}
                              title="Corriger l'intitulé ou la catégorie"
                              class="dict-edit-btn"
                            >
                              <i class="fa-solid fa-pen" style="font-size: 0.72rem;"></i> Modifier
                            </button>
                            <button 
                              type="button" 
                              onclick={() => handleDeleteDictionaryRule(r.motCle)}
                              title="Supprimer ce mot-clé du dictionnaire"
                              aria-label="Supprimer ce mot-clé du dictionnaire"
                              class="dict-delete-btn"
                            >
                              <i class="fa-solid fa-trash-can"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    {/if}
                  {/each}
                </tbody>
              </table>
            </div>

            <!-- Vue Cartes Mobile -->
            <div class="dict-mobile-cards-list">
              {#each filteredRules as r}
                {@const accountNum = r.debit || r.credit}
                {@const isDebit = Boolean(r.debit)}
                {@const isEditing = editingRuleOriginalMotCle === r.motCle}

                <div class="dict-mobile-card {isEditing ? 'is-editing' : ''}">
                  {#if isEditing}
                    <!-- Formulaire d'édition dans la carte mobile -->
                    <div class="dict-mobile-edit-form">
                      <div class="dict-mobile-edit-field">
                        <label for="mob-edit-kw" class="dict-field-label">Mot-clé :</label>
                        <input 
                          id="mob-edit-kw"
                          type="text" 
                          bind:value={editingKeyword}
                          class="dict-input"
                          placeholder="Mot-clé..."
                          style="font-family: ui-monospace, SFMono-Regular, monospace; font-weight: 700;"
                        />
                      </div>

                      <div class="dict-mobile-edit-row">
                        <div class="dict-mobile-edit-field" style="flex: 1;">
                          <label for="mob-edit-type" class="dict-field-label">Sens :</label>
                          <select 
                            id="mob-edit-type"
                            bind:value={editingType}
                            class="dict-select"
                          >
                            <option value="debit">Dépense (-)</option>
                            <option value="credit">Recette (+)</option>
                          </select>
                        </div>
                      </div>

                      <div class="dict-mobile-edit-field">
                        <label for="mob-edit-acc" class="dict-field-label">Catégorie attribuée :</label>
                        <select 
                          id="mob-edit-acc"
                          bind:value={editingAccount}
                          class="dict-select"
                        >
                          {#if editingType === 'credit'}
                            <optgroup label="Entrées & Recettes">
                              {#each $planComptable.filter(p => p.compte !== '699' && (p.compte.startsWith('7') || p.type === 'Produit' || p.group === 'entrees')) as p}
                                <option value={p.compte}>{p.compte} - {formatAccountLabel(p.compte)}</option>
                              {/each}
                            </optgroup>
                            <optgroup label="Comptes & Transferts">
                              {#each $planComptable.filter(p => p.compte !== '699' && (p.compte.startsWith('4') || p.compte.startsWith('5'))) as p}
                                <option value={p.compte}>{p.compte} - {formatAccountLabel(p.compte)}</option>
                              {/each}
                            </optgroup>
                          {:else}
                            <optgroup label="Dépenses & Frais professionnels">
                              {#each $planComptable.filter(p => p.compte !== '699' && p.compte.startsWith('6') && p.group !== 'equipe') as p}
                                <option value={p.compte}>{p.compte} - {formatAccountLabel(p.compte)}</option>
                              {/each}
                            </optgroup>
                            <optgroup label="Équipe, Salaires & Social">
                              {#each $planComptable.filter(p => p.compte !== '699' && (p.group === 'equipe' || ['611', '641', '645', '6453', '658'].includes(p.compte))) as p}
                                <option value={p.compte}>{p.compte} - {formatAccountLabel(p.compte)}</option>
                              {/each}
                            </optgroup>
                            <optgroup label="Comptes & Transferts">
                              {#each $planComptable.filter(p => p.compte !== '699' && (p.compte.startsWith('4') || p.compte.startsWith('5'))) as p}
                                <option value={p.compte}>{p.compte} - {formatAccountLabel(p.compte)}</option>
                              {/each}
                            </optgroup>
                          {/if}
                        </select>
                      </div>

                      <div class="dict-mobile-edit-buttons">
                        <button 
                          type="button" 
                          onclick={saveEditRule}
                          class="dict-save-btn"
                          style="flex: 1; justify-content: center;"
                        >
                          <i class="fa-solid fa-check"></i> Enregistrer
                        </button>
                        <button 
                          type="button" 
                          onclick={cancelEditRule}
                          class="dict-cancel-btn"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  {:else}
                    <!-- Carte normale mobile -->
                    <div class="dict-mobile-card-top">
                      <span class="dict-code-pill">
                        {r.motCle}
                      </span>
                      <span class="dict-sens-pill {isDebit ? 'debit' : 'credit'}">
                        {isDebit ? 'Dépense (-)' : 'Recette (+)'}
                      </span>
                    </div>

                    <div class="dict-mobile-card-middle">
                      <div class="dict-card-category-info">
                        <i class="fa-solid fa-tag" style="color: var(--text-muted); font-size: 0.76rem; flex-shrink: 0;"></i>
                        <span class="dict-acc-label">{formatAccountLabel(accountNum)}</span>
                        <span class="dict-acc-num">({accountNum})</span>
                      </div>
                    </div>

                    <div class="dict-mobile-card-bottom">
                      <button 
                        type="button" 
                        onclick={() => startEditRule(r)}
                        class="dict-edit-btn"
                      >
                        <i class="fa-solid fa-pen" style="font-size: 0.72rem;"></i> Modifier
                      </button>
                      <button 
                        type="button" 
                        onclick={() => handleDeleteDictionaryRule(r.motCle)}
                        class="dict-delete-btn"
                        aria-label="Supprimer ce mot-clé"
                      >
                        <i class="fa-solid fa-trash-can"></i> Supprimer
                      </button>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
        {:else}
        <!-- ======================================================== -->
        <!-- ONGLET 2 : SOUS-COMPTES COMPTABLES AVANCÉS (OPTIONNEL)   -->
        <!-- ======================================================== -->

        <!-- Encadré pédagogique : Qu'est-ce qu'un sous-compte et à quoi sert-il ? -->
        <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.28); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px;">
          <div style="font-weight: 800; font-size: 0.88rem; color: var(--color-accent, #38bdf8); display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-circle-info"></i>
            <span>Qu'est-ce qu'un sous-compte et à quoi sert-il ?</span>
          </div>
          <p style="margin: 0; font-size: 0.81rem; color: var(--text-secondary); line-height: 1.5;">
            En comptabilité française, les comptes officiels ont <strong>3 chiffres</strong> (par exemple <code style="font-weight: 700;">606</code> pour les achats et fournitures). Un <strong>sous-compte</strong> (par exemple <code style="font-weight: 700;">60623</code>) permet simplement de <strong>subdiviser un compte existant</strong> pour suivre une catégorie précise à part (ex. séparer vos « Fournitures médicales » de la « Papeterie ») ou suivre le découpage de votre expert-comptable.
          </p>
          <p style="margin: 0; font-size: 0.78rem; color: var(--text-muted); line-height: 1.45;">
            <strong>Bon à savoir :</strong> si vous débutez, les comptes standards de Tito suffisent largement et sont déjà 100 % conformes (FEC / 2035 / Bilan). Vous n'avez pas besoin d'en créer !
          </p>
        </div>

        <!-- Formulaire guidé par compte parent (garde-fou PCG) -->
        <div class="dict-add-box">
          <div class="dict-add-box-title">
            <i class="fa-solid fa-circle-plus" style="color: #6366f1;"></i>
            <span>Créer un sous-compte personnalisé</span>
          </div>

          <div style="display: grid; grid-template-columns: 1.5fr 0.75fr; gap: 12px; margin-bottom: 12px;">
            <div class="dict-field-group">
              <label for="sub-parent" class="dict-field-label">1. Compte parent officiel :</label>
              <select id="sub-parent" bind:value={newSubParentCompte} class="dict-select">
                <optgroup label="Dépenses & Charges">
                  {#each standardParentAccounts.filter(p => p.compte.startsWith('6') || p.compte.startsWith('2')) as p}
                    <option value={p.compte}>{p.compte} — {p.libelle}</option>
                  {/each}
                </optgroup>
                <optgroup label="Recettes & Produits">
                  {#each standardParentAccounts.filter(p => p.compte.startsWith('7')) as p}
                    <option value={p.compte}>{p.compte} — {p.libelle}</option>
                  {/each}
                </optgroup>
                <optgroup label="Transferts, Banque & Exploitant">
                  {#each standardParentAccounts.filter(p => !p.compte.startsWith('6') && !p.compte.startsWith('7') && !p.compte.startsWith('2')) as p}
                    <option value={p.compte}>{p.compte} — {p.libelle}</option>
                  {/each}
                </optgroup>
              </select>
            </div>

            <div class="dict-field-group">
              <label for="sub-suffix" class="dict-field-label">2. Suffixe (1 à 4 chiffres) :</label>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="padding: 7px 9px; border-radius: 7px; background: var(--bg-card); border: 1px solid var(--border-color); font-weight: 800; font-size: 0.82rem; color: var(--text-muted); white-space: nowrap;">
                  {newSubParentCompte}
                </span>
                <input
                  id="sub-suffix"
                  type="text"
                  inputmode="numeric"
                  maxlength="4"
                  bind:value={newSubSuffix}
                  placeholder="Ex : 23"
                  class="dict-input"
                />
              </div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 12px; margin-bottom: 12px;">
            <div class="dict-field-group">
              <label for="sub-label" class="dict-field-label">3. Nom du sous-compte :</label>
              <input
                id="sub-label"
                type="text"
                bind:value={newSubLabel}
                placeholder="Ex : Fournitures médicales stériles"
                class="dict-input"
              />
            </div>

            <div class="dict-field-group">
              <label for="sub-desc" class="dict-field-label">Exemples d'opérations (optionnel) :</label>
              <input
                id="sub-desc"
                type="text"
                bind:value={newSubDesc}
                placeholder="Ex : Compresses, gants, seringues, désinfectant..."
                class="dict-input"
              />
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
            <div style="font-size: 0.78rem; color: var(--text-muted);">
              {#if computedSubCompte}
                Numéro généré : <strong style="color: var(--color-accent, #38bdf8); font-size: 0.86rem;">{computedSubCompte}</strong>
                {#if $planComptable.some(p => p.compte === computedSubCompte)}
                  <span style="color: #f87171; font-weight: 700; margin-left: 6px;">(déjà existant)</span>
                {/if}
              {:else}
                Le sous-compte héritera automatiquement du type (Recette / Dépense) et du classement de <strong>{newSubParentCompte}</strong>.
              {/if}
            </div>

            <button
              type="button"
              onclick={handleAddCustomSubAccount}
              style="padding: 8px 16px; border-radius: 8px; border: none; background: #4f46e5; color: #ffffff; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;"
            >
              <i class="fa-solid fa-plus"></i>
              <span>Créer le sous-compte</span>
            </button>
          </div>
        </div>

        <!-- Liste des sous-comptes personnalisés existants -->
        <div>
          <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main); margin-bottom: 10px;">
            Vos sous-comptes personnalisés ({customSubAccounts.length})
          </div>
          {#if customSubAccounts.length === 0}
            <div style="text-align: center; padding: 24px 16px; color: var(--text-muted); font-size: 0.84rem; background: var(--bg-subtle); border: 1px dashed var(--border-color); border-radius: 10px;">
              Aucun sous-compte personnalisé créé pour cette structure.
            </div>
          {:else}
            <div style="display: flex; flex-direction: column; gap: 8px;">
              {#each customSubAccounts as sc}
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px;">
                  <div style="min-width: 0; flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span style="font-weight: 800; font-size: 0.78rem; padding: 2px 7px; border-radius: 5px; background: rgba(56, 189, 248, 0.14); color: var(--color-accent, #38bdf8); border: 1px solid rgba(56, 189, 248, 0.35);">
                        {sc.compte}
                      </span>
                      <span style="font-weight: 700; font-size: 0.88rem; color: var(--text-main);">{sc.libelle}</span>
                      <span style="font-size: 0.72rem; color: var(--text-muted);">
                        (rattaché à {sc.parentCompte || sc.compte.slice(0, 3)})
                      </span>
                    </div>
                    {#if sc.desc}
                      <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 3px;">{sc.desc}</div>
                    {/if}
                  </div>
                  <button
                    type="button"
                    onclick={() => handleDeleteCustomSubAccount(sc.compte)}
                    class="dict-delete-btn"
                    title="Supprimer ce sous-compte"
                  >
                    <i class="fa-solid fa-trash-can"></i> Supprimer
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
        {/if}

      </div>

      <!-- Pied de page -->
      <div class="dict-modal-footer">
        <button 
          type="button" 
          onclick={() => {
            showDictionaryModal = false;
            Categorizer.reappliquerReglesAuxTransactionsEnAttente();
            selectedCategoryMap = {};
          }}
          class="dict-close-btn"
        >
          Fermer
        </button>
      </div>

    </div>
  </div>
{/if}

<!-- ========================================== -->
<!-- MODALE CONCATÉNATION ASSISTÉE DE COLONNE  -->
<!-- ========================================== -->
{#if showConcatModal}
  <div 
    class="modal-backdrop" 
    style="position: fixed; inset: 0; background: rgba(5, 10, 20, 0.78); backdrop-filter: blur(8px); z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 16px;"
    onclick={(e) => { if (e.target === e.currentTarget) showConcatModal = false; }}
    role="presentation"
  >
    <div 
      class="modal-card" 
      style="background: #0c1527 !important; border: 1.5px solid rgba(56, 189, 248, 0.25) !important; border-radius: 16px; width: 100%; max-width: 620px; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.75); display: flex; flex-direction: column; max-height: 90vh; overflow: hidden; color: #f8fafc !important;"
    >
      <!-- En-tête -->
      <div style="padding: 18px 22px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: space-between;">
        <div>
          <h3 style="margin: 0; font-family: var(--font-title); font-size: 1.15rem; color: #ffffff !important; font-weight: 800;">
            Associer un complément d'information
          </h3>
          <div style="font-size: 0.8rem; color: #94a3b8 !important; margin-top: 3px;">
            Mixez le libellé avec la colonne de votre choix (nom du payeur, motif, détail...)
          </div>
        </div>
        <button 
          type="button" 
          aria-label="Fermer" 
          onclick={() => showConcatModal = false}
          style="background: none; border: none; color: #94a3b8; font-size: 1.25rem; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; border-radius: 6px; transition: color 0.15s ease;"
          onmouseenter={(e) => { e.currentTarget.style.color = '#ffffff'; }}
          onmouseleave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
        >✕</button>
      </div>

      <!-- Corps défilable -->
      <div style="padding: 20px 22px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px;">
        
        {#if availableCsvHeaders.length === 0}
          <!-- Si pas de colonnes en mémoire, invitation à charger le fichier CSV -->
          <div style="text-align: center; padding: 28px 16px; background: rgba(255, 255, 255, 0.03); border: 1.5px dashed rgba(255, 255, 255, 0.15); border-radius: 12px;">
            <i class="fa-solid fa-file-csv" style="font-size: 2.2rem; color: #38bdf8; margin-bottom: 10px;"></i>
            <div style="font-weight: 800; font-size: 0.95rem; color: #ffffff; margin-bottom: 4px;">
              Chargez votre fichier CSV bancaire
            </div>
            <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 14px; max-width: 380px; margin-left: auto; margin-right: auto;">
              Sélectionnez votre relevé bancaire pour détecter automatiquement toutes ses colonnes et afficher le nom des payeurs.
            </div>
            <button 
              type="button"
              onclick={() => concatFileInput && concatFileInput.click()}
              style="padding: 8px 18px; background: #2563eb; color: #ffffff; border: none; border-radius: 8px; font-weight: 700; font-size: 0.84rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;"
            >
              <i class="fa-solid fa-upload"></i> Choisir le fichier CSV
            </button>
            <input 
              type="file" 
              accept=".csv" 
              bind:this={concatFileInput} 
              onchange={handleConcatFileChange} 
              style="display: none;" 
            />
          </div>
        {:else}
          <!-- Bloc de sélection des colonnes selon la charte graphique -->
          <div style="background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
              <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;">
                Sélectionnez la colonne à ajouter au libellé
              </div>
              <button 
                type="button"
                onclick={() => concatFileInput && concatFileInput.click()}
                style="background: none; border: none; color: #38bdf8; font-size: 0.74rem; font-weight: 700; cursor: pointer; text-decoration: underline;"
              >
                {concatFileName ? `Fichier : ${concatFileName} (Changer)` : 'Changer de fichier CSV'}
              </button>
              <input 
                type="file" 
                accept=".csv" 
                bind:this={concatFileInput} 
                onchange={handleConcatFileChange} 
                style="display: none;" 
              />
            </div>

            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              {#each availableCsvHeaders as header, idx}
                {@const isSelected = selectedComplementColIdx === idx}
                {@const isLibelleCol = header.toLowerCase().includes('libelle')}
                <button
                  type="button"
                  onclick={() => selectedComplementColIdx = idx}
                  style="padding: 7px 14px; border-radius: 9999px; font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: all 0.12s ease; border: 1px solid {isSelected ? '#38bdf8' : 'var(--border-color)'}; background: {isSelected ? 'rgba(56, 189, 248, 0.18)' : 'var(--bg-card)'}; color: {isSelected ? '#38bdf8' : 'var(--text-secondary)'}; display: inline-flex; align-items: center; gap: 6px; box-shadow: var(--shadow-sm);"
                >
                  <span>{header}</span>
                  {#if isLibelleCol}
                    <span style="font-size: 0.65rem; color: var(--text-muted); background: var(--bg-subtle); padding: 1px 5px; border-radius: 4px;">(base)</span>
                  {/if}
                </button>
              {/each}
            </div>
          </div>

          <!-- Live Preview Box -->
          {#if effectiveSampleRows.length > 0 && selectedComplementColIdx !== -1}
            {@const libColIdx = availableCsvHeaders.findIndex(h => h.toLowerCase().includes('libelle')) !== -1 ? availableCsvHeaders.findIndex(h => h.toLowerCase().includes('libelle')) : 1}
            <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 16px;">
              <div style="font-size: 0.75rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-eye" style="color: #38bdf8;"></i>
                Aperçu du libellé enrichi ({availableCsvHeaders[selectedComplementColIdx] || ''})
              </div>
              <div style="display: flex; flex-direction: column; gap: 10px;">
                {#each effectiveSampleRows.slice(0, 3) as row}
                  {@const lib = row[libColIdx] || row[1] || 'Libellé'}
                  {@const comp = row[selectedComplementColIdx] || ''}
                  <div style="background: rgba(255, 255, 255, 0.04); padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.08); display: flex; flex-direction: column; gap: 8px;">
                    <!-- Ligne 1 : Ce qui est concaténé -->
                    <div style="display: flex; align-items: center; font-size: 0.82rem; gap: 8px; flex-wrap: wrap;">
                      <span style="color: #cbd5e1; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 48%;" title="{lib}">{lib}</span>
                      <span style="color: #38bdf8; font-weight: 800; font-size: 0.95rem; flex-shrink: 0; line-height: 1;">+</span>
                      <span style="color: #38bdf8; font-weight: 700; background: rgba(56, 189, 248, 0.16); padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.35); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 48%;" title="{comp || '(vide)'}">
                        {comp || '(vide)'}
                      </span>
                    </div>
                    <!-- Ligne 2 : Visualisation du résultat final -->
                    <div style="display: flex; align-items: baseline; gap: 6px; font-size: 0.86rem; padding-top: 8px; border-top: 1px dashed rgba(255, 255, 255, 0.1);">
                      <span style="color: #94a3b8; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; flex-shrink: 0;">Affichage :</span>
                      <strong style="color: #ffffff; word-break: break-word;">
                        {comp ? `${lib} — ${comp}` : lib}
                      </strong>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {/if}

      </div>

      <!-- Pied de page -->
      <div style="padding: 12px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px; background: var(--bg-subtle);">
        <button 
          type="button" 
          onclick={() => showConcatModal = false}
          style="padding: 8px 16px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; font-weight: 700; font-size: 0.84rem; color: var(--text-main); cursor: pointer;"
        >
          Annuler
        </button>
        <button 
          type="button" 
          onclick={appliquerConcatenationAssistee}
          disabled={selectedComplementColIdx === -1}
          style="padding: 8px 20px; background: #2563eb; border: none; border-radius: 8px; font-weight: 700; font-size: 0.84rem; color: #ffffff; cursor: {selectedComplementColIdx === -1 ? 'not-allowed' : 'pointer'}; opacity: {selectedComplementColIdx === -1 ? 0.6 : 1};"
        >
          Appliquer à tout le relevé
        </button>
      </div>

    </div>
  </div>
{/if}

<style>
  .categorize-top-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
    align-items: stretch;
  }
  .desktop-tx-table {
    display: block;
  }
  .mobile-tx-cards {
    display: none;
  }

  /* Conteneur principal du tableau / liste d'attribution */
  .categorize-table-section {
    flex-shrink: 0;
    margin-bottom: 30px;
    background: var(--table-container-bg);
    border: 1.5px solid var(--border-container);
    border-radius: 20px;
    padding: 20px;
    box-shadow: var(--shadow-card);
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    overflow: visible;
  }
  .categorize-table-inner {
    padding: 6px;
    background: transparent;
    width: 100%;
    box-sizing: border-box;
  }

  /* Barre d'actions groupées en attente */
  .pending-bulk-actions {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 14px;
  }
  .pending-validate-all-btn {
    padding: 8px 18px;
    font-size: 0.84rem;
    font-weight: 700;
    background: #16a34a;
    color: #ffffff;
    border: none;
    border-radius: 9999px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 7px;
    box-shadow: 0 4px 14px rgba(22, 163, 74, 0.35);
    transition: all 0.15s ease;
  }
  .pending-validate-all-btn:hover {
    background: #15803d;
  }

  /* Barre d'outils de tri et de filtrage pour les opérations attribuées */
  .categorized-toolbar {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 10px;
    width: 100%;
    box-sizing: border-box;
  }
  .categorized-filter-item {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .categorized-filter-label {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .categorized-select {
    padding: 6px 10px;
    font-size: 0.82rem;
    font-weight: 600;
    background: var(--bg-card);
    border: 1.5px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-main);
    cursor: pointer;
    max-width: 240px;
    text-overflow: ellipsis;
  }
  .categorized-search-box {
    position: relative;
    display: flex;
    align-items: center;
  }
  .categorized-search-icon {
    position: absolute;
    left: 9px;
    color: var(--text-muted);
    font-size: 0.75rem;
    pointer-events: none;
  }
  .categorized-search-input {
    padding: 6px 10px 6px 26px;
    font-size: 0.82rem;
    border: 1.5px solid var(--border-color);
    border-radius: 8px;
    width: 140px;
    background: var(--bg-card);
    color: var(--text-main);
    box-sizing: border-box;
  }

  @media (max-width: 768px) {
    .page-title-section {
      display: none !important;
    }
    .categorize-top-grid {
      grid-template-columns: 1fr !important;
      gap: 12px !important;
      margin-bottom: 28px !important;
    }
    .attribution-tabs-row {
      flex-direction: column !important;
      padding: 14px 12px !important;
      gap: 10px !important;
      min-height: auto !important;
    }
    .attribution-tabs-row button {
      width: 100% !important;
      flex: none !important;
      padding: 12px 14px !important;
    }
    /* Section tableau sur mobile */
    .categorize-table-section {
      padding: 12px 10px !important;
      border-radius: 14px !important;
      margin-bottom: 20px !important;
    }
    .categorize-table-inner {
      padding: 0 !important;
    }
    /* Barre d'outils mobile 100% fluide sans débordement */
    .categorized-toolbar {
      display: flex !important;
      flex-direction: column !important;
      align-items: stretch !important;
      gap: 8px !important;
      width: 100% !important;
      margin-bottom: 12px !important;
    }
    .categorized-filter-item {
      display: flex !important;
      flex-direction: column !important;
      align-items: stretch !important;
      gap: 3px !important;
      width: 100% !important;
    }
    .categorized-filter-label {
      font-size: 0.72rem !important;
    }
    .categorized-select {
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      height: 38px !important;
      font-size: 0.82rem !important;
    }
    .categorized-search-box {
      width: 100% !important;
    }
    .categorized-search-input {
      width: 100% !important;
      box-sizing: border-box !important;
      height: 38px !important;
    }
    .pending-bulk-actions {
      justify-content: stretch !important;
      margin-bottom: 12px !important;
    }
    .pending-validate-all-btn {
      width: 100% !important;
      justify-content: center !important;
    }
    /* Bascule Tableau -> Liste Fintech unifiée sur mobile */
    .desktop-tx-table {
      display: none !important;
    }
    .mobile-tx-cards {
      display: block !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }
    .mobile-tx-list {
      display: flex;
      flex-direction: column;
      background: var(--bg-card, #ffffff);
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
      width: 100% !important;
      box-sizing: border-box !important;
    }
    .mobile-tx-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border-color, rgba(226, 232, 240, 0.6));
      background: transparent;
      transition: background 0.12s ease;
      -webkit-tap-highlight-color: transparent;
      width: 100% !important;
      box-sizing: border-box !important;
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
      gap: 8px;
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
      gap: 6px;
      min-width: 0;
    }
    .mobile-tx-actions-group {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: auto;
      min-width: 0;
      flex-shrink: 1;
    }
    .mobile-tx-date {
      font-size: 0.74rem;
      color: var(--text-muted, #64748b);
      font-weight: 500;
      flex-shrink: 0;
    }
    .mobile-tx-badge {
      font-size: 0.69rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 130px;
      line-height: 1.3;
      flex-shrink: 1;
      min-width: 0;
    }
    .mobile-tx-badge.attributed {
      background: rgba(37, 99, 235, 0.14);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.3);
    }
    .mobile-tx-badge.pending {
      background: rgba(245, 158, 11, 0.14);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.35);
    }
    .mobile-action-btn {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      font-size: 0.72rem;
      font-weight: 600;
      padding: 4px 7px;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      flex-shrink: 0;
    }
    .mobile-action-btn.validate-btn {
      background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%);
      color: #ffffff;
      border: none;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 9999px;
      box-shadow: 0 2px 8px rgba(6, 182, 212, 0.3);
    }
    .mobile-action-btn.confirm-btn {
      background: #16a34a;
      color: #ffffff;
      border: none;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 9999px;
    }
  }

  /* ======================================================== */
  /* MODALE DU DICTIONNAIRE D'ATTRIBUTION - STYLES & MOBILE   */
  /* ======================================================== */
  .dict-modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(5, 10, 20, 0.75);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
    box-sizing: border-box;
  }
  .dict-modal-card {
    background: var(--bg-card, #ffffff);
    color: var(--text-main, #0f172a);
    width: 100%;
    max-width: 860px;
    max-height: 88vh;
    border-radius: 16px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35);
    border: 1.5px solid var(--border-color, #e2e8f0);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: zoomIn 0.2s ease-out;
  }
  .dict-modal-header {
    padding: 18px 24px;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    background: var(--bg-subtle, #f8fafc);
    gap: 12px;
  }
  .dict-header-title-group {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    flex: 1;
  }
  .dict-header-icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: rgba(99, 102, 241, 0.16);
    color: #818cf8;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    flex-shrink: 0;
  }
  .dict-modal-title {
    margin: 0;
    font-size: 1.18rem;
    font-weight: 800;
    color: var(--text-main, #0f172a);
    font-family: var(--font-title);
  }
  .dict-modal-subtitle {
    margin: 2px 0 0 0;
    font-size: 0.82rem;
    color: var(--text-muted, #64748b);
    line-height: 1.35;
  }
  .dict-modal-close-btn {
    background: transparent;
    border: none;
    font-size: 1.25rem;
    color: var(--text-muted, #94a3b8);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: color 0.15s ease;
  }
  .dict-modal-close-btn:hover {
    color: var(--text-main);
  }
  .dict-modal-body {
    padding: 20px 24px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
    box-sizing: border-box;
  }
  .dict-modal-body > * {
    flex-shrink: 0;
  }
  .dict-add-box {
    background: var(--bg-subtle, #f8fafc);
    border: 1.5px solid var(--border-color, #e2e8f0);
    border-radius: 12px;
    padding: 16px 18px;
    box-sizing: border-box;
  }
  .dict-add-box-title {
    font-weight: 700;
    font-size: 0.92rem;
    color: var(--text-main, #0f172a);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dict-add-grid {
    display: grid;
    grid-template-columns: 2fr 1.1fr 2.5fr auto;
    gap: 12px;
    align-items: flex-end;
  }
  .dict-field-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }
  .dict-field-label {
    font-size: 0.76rem;
    font-weight: 700;
    color: var(--text-secondary, #475569);
  }
  .dict-input,
  .dict-select {
    width: 100%;
    padding: 9px 12px;
    border: 1.5px solid var(--border-color, #cbd5e1);
    border-radius: 8px;
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-main, #0f172a);
    background: var(--bg-card, #ffffff);
    box-sizing: border-box;
    transition: border-color 0.15s ease;
    height: 40px;
  }
  .dict-input:focus,
  .dict-select:focus {
    border-color: #6366f1;
    outline: none;
  }
  .dict-input-sm,
  .dict-select-sm {
    height: 34px;
    padding: 5px 8px;
    font-size: 0.82rem;
  }
  .dict-submit-btn {
    padding: 0 18px;
    background: #0f172a;
    color: #ffffff;
    border: none;
    border-radius: 8px;
    font-weight: 700;
    font-size: 0.86rem;
    cursor: pointer;
    white-space: nowrap;
    height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: background 0.15s ease;
  }
  :root[data-theme="dark"] .dict-submit-btn {
    background: #2563eb;
    color: #ffffff;
  }
  .dict-submit-btn:hover {
    opacity: 0.92;
  }
  .dict-list-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .dict-search-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .dict-count-title {
    font-weight: 800;
    font-size: 0.92rem;
    color: var(--text-main, #0f172a);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .dict-count-badge {
    color: var(--text-muted);
    font-weight: 600;
  }
  .dict-search-input-box {
    position: relative;
    width: 280px;
  }
  .dict-search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted, #94a3b8);
    font-size: 0.8rem;
    pointer-events: none;
  }
  .dict-search-input {
    width: 100%;
    padding: 7px 10px 7px 30px;
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 8px;
    font-size: 0.82rem;
    box-sizing: border-box;
    background: var(--bg-card);
    color: var(--text-main);
  }
  .dict-desktop-table-container {
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 10px;
    overflow-x: auto;
    background: var(--bg-card);
  }
  .dict-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }
  .dict-table thead tr {
    background: var(--bg-subtle, #f8fafc);
    border-bottom: 1px solid var(--border-color, #e2e8f0);
    text-align: left;
    color: var(--text-secondary, #475569);
    font-weight: 700;
    font-size: 0.78rem;
    text-transform: uppercase;
  }
  .dict-table th {
    padding: 10px 14px;
    white-space: nowrap;
  }
  .dict-table-row {
    border-bottom: 1px solid var(--border-color, #f1f5f9);
    background: var(--bg-card);
  }
  .dict-table-row.is-editing {
    border-bottom: 2px solid #6366f1;
    background: var(--bg-subtle);
  }
  .dict-table td {
    padding: 10px 14px;
  }
  .dict-code-pill {
    background: var(--bg-subtle, #f1f5f9);
    padding: 3px 8px;
    border-radius: 6px;
    border: 1px solid var(--border-color, #e2e8f0);
    display: inline-block;
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-weight: 800;
    font-size: 0.82rem;
    color: var(--text-main);
  }
  .dict-sens-pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 0.74rem;
    white-space: nowrap;
  }
  .dict-sens-pill.debit {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
  .dict-sens-pill.credit {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }
  .dict-acc-label {
    font-weight: 600;
    color: var(--text-main);
  }
  .dict-acc-num {
    color: var(--text-muted);
    font-size: 0.78rem;
    margin-left: 4px;
  }
  .dict-edit-btn {
    background: var(--bg-card);
    border: 1px solid var(--border-color, #cbd5e1);
    color: var(--text-secondary);
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 0.82rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 0.12s ease;
  }
  .dict-edit-btn:hover {
    background: var(--bg-subtle);
    color: var(--text-main);
  }
  .dict-delete-btn {
    background: transparent;
    border: 1px solid transparent;
    color: #ef4444;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 0.85rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;
  }
  .dict-delete-btn:hover {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.25);
  }
  .dict-save-btn {
    background: #16a34a;
    border: none;
    color: #ffffff;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.82rem;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    box-shadow: 0 1px 2px rgba(22, 163, 74, 0.25);
  }
  .dict-cancel-btn {
    background: var(--bg-card);
    border: 1px solid var(--border-color, #cbd5e1);
    color: var(--text-muted);
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 0.82rem;
    font-weight: 600;
  }
  .dict-empty-state {
    text-align: center;
    padding: 36px 20px;
    background: var(--bg-subtle);
    border: 1px dashed var(--border-color);
    border-radius: 12px;
    color: var(--text-muted);
  }
  .dict-empty-icon {
    font-size: 2rem;
    color: var(--text-muted);
    margin-bottom: 10px;
    display: block;
    opacity: 0.5;
  }
  .dict-empty-title {
    font-weight: 700;
    color: var(--text-main);
    font-size: 0.95rem;
  }
  .dict-empty-desc {
    font-size: 0.82rem;
    margin: 4px 0 0 0;
  }
  .dict-modal-footer {
    padding: 14px 24px;
    border-top: 1px solid var(--border-color, #e2e8f0);
    display: flex;
    justify-content: flex-end;
    background: var(--bg-subtle, #f8fafc);
  }
  .dict-close-btn {
    padding: 8px 20px;
    background: var(--bg-card);
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 8px;
    font-weight: 700;
    font-size: 0.86rem;
    color: var(--text-main);
    cursor: pointer;
    transition: background 0.12s ease;
  }
  .dict-close-btn:hover {
    background: var(--bg-subtle);
  }

  /* Vue cartes mobile */
  .dict-mobile-cards-list {
    display: none;
  }

  /* Media Queries Mobile */
  @media (max-width: 768px) {
    .dict-modal-backdrop {
      padding: 8px !important;
    }
    .dict-modal-card {
      max-height: 94vh !important;
      border-radius: 14px !important;
    }
    .dict-modal-header {
      padding: 14px 16px !important;
    }
    .dict-modal-title {
      font-size: 1.05rem !important;
    }
    .dict-modal-subtitle {
      font-size: 0.76rem !important;
    }
    .dict-modal-body {
      padding: 14px 12px !important;
      gap: 16px !important;
    }
    .dict-add-box {
      padding: 14px 12px !important;
    }
    .dict-add-grid {
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }
    .dict-submit-btn {
      width: 100% !important;
      margin-top: 4px !important;
    }
    .dict-search-header {
      flex-direction: column !important;
      align-items: stretch !important;
      gap: 10px !important;
    }
    .dict-search-input-box {
      width: 100% !important;
    }
    /* Masquer le tableau horizontal écrasé */
    .dict-desktop-table-container {
      display: none !important;
    }
    /* Afficher la liste de cartes mobiles */
    .dict-mobile-cards-list {
      display: flex !important;
      flex-direction: column !important;
      gap: 10px !important;
    }
    .dict-mobile-card {
      background: var(--bg-card, #ffffff);
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 12px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }
    .dict-mobile-card.is-editing {
      border: 1.5px solid #6366f1;
      background: var(--bg-subtle);
    }
    .dict-mobile-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .dict-mobile-card-middle {
      display: flex;
      align-items: center;
    }
    .dict-card-category-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.84rem;
      flex-wrap: wrap;
    }
    .dict-mobile-card-bottom {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--border-color, rgba(226, 232, 240, 0.5));
    }
    .dict-mobile-card-bottom .dict-edit-btn,
    .dict-mobile-card-bottom .dict-delete-btn {
      padding: 5px 10px;
      font-size: 0.78rem;
    }
    .dict-mobile-edit-form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .dict-mobile-edit-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .dict-mobile-edit-row {
      display: flex;
      gap: 8px;
    }
    .dict-mobile-edit-buttons {
      display: flex;
      gap: 8px;
      margin-top: 6px;
    }
    .dict-modal-footer {
      padding: 12px 16px !important;
    }
    .dict-close-btn {
      width: 100% !important;
      text-align: center !important;
    }
  }
</style>
