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

  // Dictionnaire d'attribution modal state
  let showDictionaryModal = $state(false);
  let newRuleKeyword = $state('');
  let newRuleType = $state('debit'); // 'debit' | 'credit'
  let newRuleAccount = $state('606');
  let dictionarySearch = $state('');

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
    }
  }

  /** @param {File} file */
  function processCSVFile(file) {
    const reader = new FileReader();
    reader.onload = (evt) => {
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

          const complement = (match?.info || (match?.rawCells && match.rawCells[selectedComplementColIdx]) || (tx.rawCells && tx.rawCells[selectedComplementColIdx]) || '').trim();
          if (complement) {
            const baseLib = match?.rawLibelle || tx.rawLibelle || tx.libelle.split('—')[0].split('|')[0].trim();
            return {
              ...tx,
              info: complement,
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

  // Helper to clean banking transaction labels & extract readable name
  /** @param {string} [libelle] @param {any} [tx] */
  function cleanTransactionLibelle(libelle, tx = null) {
    if (!libelle && (!tx || !tx.libelle)) return "Opération sans libellé";
    const fullLibelle = libelle || tx?.libelle || "";
    const parts = fullLibelle.split('|').map((/** @type {string} */ s) => s.trim()).filter(Boolean);
    let main = parts[0] || fullLibelle;

    // Détection de complément d'information (payeur, motif, etc.)
    let complement = '';
    if (tx?.rawCells && selectedComplementColIdx !== -1 && tx.rawCells[selectedComplementColIdx]) {
      complement = String(tx.rawCells[selectedComplementColIdx]).trim();
    } else if (tx?.info && String(tx.info).trim()) {
      complement = String(tx.info).trim();
    } else if (parts.length > 2) {
      const p = parts[2].trim();
      if (!/^\d{2}[/\-.]\d{2}[/\-.]\d{2,4}$/.test(p)) complement = p;
    } else if (parts.length === 2 && !/^[A-Z0-9]{5,20}$/.test(parts[1])) {
      const p = parts[1].trim();
      if (!/^\d{2}[/\-.]\d{2}[/\-.]\d{2,4}$/.test(p)) complement = p;
    }

    // Vérifier si le libellé principal est un intitulé bancaire générique (Option 2 : REMISE EUROPRELEVEMENT — Nom)
    const isGeneric = /^(REMISE EUROPRELEVEMENT|REMISE SDD|PRLV SEPA|PRELEVEMENT SDD|VIREMENT SEPA|REMISE CHEQUE)$/i.test(main);
    if (isGeneric && complement) {
      return `${main} — ${complement}`;
    }

    // Nettoyage standard pour les opérations habituelles (retirer préfixes techniques)
    let cleaned = main.replace(/^(PRLV SEPA|PRLV|VIR SEPA|VIR|PAIEMENT CB|CB|CHEQUE|PRLV HARMONIE)\s+/i, '').trim();
    cleaned = cleaned.replace(/^SA-/, '').trim();
    if (!cleaned) cleaned = main;

    // Si on a un complément pertinent qui n'est pas déjà dans le libellé nettoyé
    if (complement && !cleaned.toLowerCase().includes(complement.toLowerCase())) {
      return `${cleaned} — ${complement}`;
    }

    return cleaned || main;
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
        label: 'Achats, fournitures et logiciels',
        icon: 'fa-cart-shopping',
        codes: ['606', '6132', '615', '616', '626', '627']
      },
      {
        id: 'dep_missions',
        label: 'Déplacements et repas',
        icon: 'fa-car',
        codes: ['625']
      },
      {
        id: 'dep_social',
        label: 'Salaires, cotisations & charges sociales ...',
        icon: 'fa-building-columns',
        codes: ['645', '635', '6453', '641', '611', '658']
      },
      {
        id: 'dep_locaux',
        label: 'Locaux et loyers',
        icon: 'fa-building',
        codes: ['613', '661']
      },
      {
        id: 'dep_transferts',
        label: 'Remboursements, virements & trésorerie',
        icon: 'fa-arrow-up-right',
        codes: ['411', '455', '512', '530', '401', '467']
      }
    ];

    /** @param {any[]} subMenus @param {(c: any) => boolean} fallbackFilter @param {boolean} [isExpenseContext] */
    const buildSection = (subMenus, fallbackFilter, isExpenseContext = false) => {
      const handledCodes = new Set();
      const list = subMenus.map(sub => {
        const accs = getAccounts(sub.codes, isExpenseContext);
        accs.forEach(a => handledCodes.add(a.compte));
        return {
          ...sub,
          accounts: accs
        };
      });

      const extras = plan.filter(c => fallbackFilter(c) && !handledCodes.has(c.compte));
      if (extras.length > 0) {
        list.push({
          id: 'extras_custom',
          label: 'Autres comptes personnalisés',
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

  // Résultats de recherche directe quand du texte est saisi
  let modalSearchResults = $derived((() => {
    const q = modalSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return $planComptable.filter(c => c.compte !== '699' && (
      c.compte.toLowerCase().includes(q) ||
      (c.libelle && c.libelle.toLowerCase().includes(q)) ||
      (c.desc && c.desc.toLowerCase().includes(q))
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
      style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: #ffffff; border: 1.5px solid #cbd5e1; color: #2563eb; font-size: 0.95rem; cursor: pointer; transition: all 0.15s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.04);"
      onmouseenter={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.background = '#eff6ff'; }}
      onmouseleave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#ffffff'; }}
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
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 24px; align-items: stretch;">
  
  <!-- CARTE 1 : IMPORT DE RELEVÉ BANCAIRE (CSV) -->
  <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 18px 20px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between; gap: 14px; height: 100%; box-sizing: border-box;">
    <!-- En-tête du bloc -->
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 32px;">
      <h3 style="font-family: var(--font-title); font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 7px; white-space: nowrap;">
        <span>Import de relevé bancaire</span>
        <InfoTip text="Glissez ici le relevé téléchargé depuis votre banque en ligne (Boursorama, BNP, Crédit Agricole, Qonto, etc.)." width="240px" />
      </h3>

      <!-- Action Vider le relevé -->
      {#if currentStructureTx.length > 0}
        <button 
          type="button" 
          onclick={effacerToutesOperations}
          style="display: flex; align-items: center; gap: 5px; font-weight: 700; font-size: 0.74rem; padding: 4px 10px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; white-space: nowrap; flex-shrink: 0;"
          title="Effacer l'ensemble des opérations bancaires de cet espace pour réimporter à neuf"
          onmouseenter={(e) => { /** @type {HTMLElement} */ (e.currentTarget).style.background = 'rgba(239, 68, 68, 0.2)'; }}
          onmouseleave={(e) => { /** @type {HTMLElement} */ (e.currentTarget).style.background = 'rgba(239, 68, 68, 0.1)'; }}
        >
          <i class="fa-solid fa-trash-can" style="font-size: 0.72rem;"></i>
          <span>Vider le relevé</span>
        </button>
      {/if}
    </div>

    <!-- Zone de drop ultra épurée selon la maquette -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div 
      class="dropzone {dragover ? 'dragover' : ''}" 
      onclick={() => fileInput && fileInput.click()}
      ondragenter={(e) => { e.preventDefault(); e.stopPropagation(); dragover = true; }}
      ondragover={(e) => { e.preventDefault(); e.stopPropagation(); dragover = true; }}
      ondragleave={(e) => { e.preventDefault(); e.stopPropagation(); dragover = false; }}
      ondrop={handleCSVDrop}
      style="cursor: pointer; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; padding: 20px 16px; background: {dragover ? 'rgba(79, 70, 229, 0.08)' : 'var(--bg-card)'}; border: 2px dashed {dragover ? '#4f46e5' : 'var(--border-color)'}; border-radius: 14px; transition: all 0.2s ease; box-sizing: border-box; flex: 1; min-height: 145px;"
      onmouseenter={(e) => { e.currentTarget.style.borderColor = '#4f46e5'; }}
      onmouseleave={(e) => { if (!dragover) { e.currentTarget.style.borderColor = 'var(--border-color)'; } }}
    >
      <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--bg-subtle); border: 1px solid var(--border-color); color: #4f46e5; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0; pointer-events: none; box-shadow: var(--shadow-sm);">
        <i class="fa-solid fa-cloud-arrow-up"></i>
      </div>
      
      <div style="pointer-events: none; font-weight: 800; font-size: 0.92rem; color: var(--text-main);">
        Glissez ou importez
      </div>
      
      <span style="background: #4f46e5; color: #ffffff; padding: 5px 18px; border-radius: 20px; font-weight: 700; font-size: 0.76rem; box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25); pointer-events: none;">
        Parcourir
      </span>

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
        onclick={() => showDictionaryModal = true}
        style="background: #4f46e5; color: #ffffff; border: none; padding: 5px 18px; font-weight: 700; border-radius: 20px; cursor: pointer; font-size: 0.76rem; box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25); transition: opacity 0.15s ease;"
        onmouseenter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
        onmouseleave={(e) => { e.currentTarget.style.opacity = '1'; }}
      >
        Paramétrer
      </button>
    </div>
  </div>

  <!-- CARTE 3 : TRAITEMENT ET AFFECTATION DES OPÉRATIONS -->
  <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 18px 20px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between; gap: 14px; height: 100%; box-sizing: border-box;">
    <!-- En-tête du bloc -->
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 32px;">
      <h3 style="font-family: var(--font-title); font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 7px; white-space: nowrap;">
        <span>Traitement des opérations</span>
        <InfoTip text="Vérifiez les opérations en attente ou visualisez l'ensemble de votre grand journal déjà classé." width="250px" />
      </h3>
    </div>

    <!-- Carte intérieure avec deux boutons bien distincts et alignés -->
    <div style="padding: 20px 16px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; box-shadow: var(--shadow-sm); display: flex; align-items: center; justify-content: center; gap: 12px; flex: 1; min-height: 145px; box-sizing: border-box;">
      <button
        type="button"
        style="flex: 1; padding: 12px 14px; border-radius: 10px; font-size: 0.86rem; font-weight: 700; cursor: pointer; transition: all 0.15s ease; text-align: center; white-space: nowrap; {activeTab === 'pending' ? 'background: #4f46e5; color: #ffffff; border: 1.5px solid #4f46e5; box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25);' : 'background: var(--bg-card); color: var(--text-main); border: 1.5px solid var(--border-color);'}"
        onclick={() => {
          activeTab = 'pending';
        }}
      >
        À attribuer ({nonTriees.length})
      </button>

      <button
        type="button"
        style="flex: 1; padding: 12px 14px; border-radius: 10px; font-size: 0.86rem; font-weight: 700; cursor: pointer; transition: all 0.15s ease; text-align: center; white-space: nowrap; {activeTab === 'categorized' ? 'background: #4f46e5; color: #ffffff; border: 1.5px solid #4f46e5; box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25);' : 'background: var(--bg-card); color: var(--text-main); border: 1.5px solid var(--border-color);'}"
        onclick={() => {
          activeTab = 'categorized';
        }}
      >
        Attribué ({triees.length})
      </button>
    </div>
  </div>

</div>

<!-- ======================================================= -->
<!-- CONTENEUR DU TABLEAU DE TRAITEMENT DES OPÉRATIONS       -->
<!-- ======================================================= -->
{#if activeTab === 'pending' || activeTab === 'categorized'}
  <div style="margin-bottom: 30px; background: var(--table-container-bg); border: 1.5px solid var(--border-container); border-radius: 20px; padding: 20px; box-shadow: var(--shadow-card);">
    <div style="padding: 6px; background: transparent; width: 100%; box-sizing: border-box;">
        
        {#if activeTab === 'pending'}
          {#if recognizedList.length > 0}
            <!-- Action Tout valider au-dessus du tableau avec libellé direct et court -->
            <div style="display: flex; justify-content: flex-end; margin-bottom: 14px;">
              <button 
                type="button"
                onclick={validerToutEnUnClic}
                style="padding: 8px 18px; font-size: 0.84rem; font-weight: 700; background: #16a34a; color: #ffffff; border: none; border-radius: 9999px; cursor: pointer; display: flex; align-items: center; gap: 7px; box-shadow: 0 4px 14px rgba(22, 163, 74, 0.35); transition: all 0.15s ease;"
                onmouseenter={(e) => { e.currentTarget.style.background = '#15803d'; }}
                onmouseleave={(e) => { e.currentTarget.style.background = '#16a34a'; }}
                title="Valider toutes les suggestions d'un clic"
              >
                <i class="fa-solid fa-check-double"></i>
                Tout valider ({recognizedList.length})
              </button>
            </div>
          {/if}
        {:else}
          <!-- Barre d'outils de tri et de filtrage pour les opérations attribuées -->
          <div style="display: flex; justify-content: flex-end; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
            <!-- Sélecteur de compte -->
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted);">Compte :</span>
              <select 
                bind:value={categorizedFilterAccount}
                style="padding: 6px 10px; font-size: 0.82rem; font-weight: 600; background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 8px; color: var(--text-main); cursor: pointer;"
              >
                <option value="all">Tous les comptes ({triees.length})</option>
                {#each attributedAccountsList as acc}
                  <option value={acc.compte}>{acc.compte} — {acc.label} ({acc.count})</option>
                {/each}
              </select>
            </div>

            <!-- Sélecteur de tri -->
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted);">Ordre :</span>
              <select 
                bind:value={categorizedSortBy}
                style="padding: 6px 10px; font-size: 0.82rem; font-weight: 600; background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 8px; color: var(--text-main); cursor: pointer;"
              >
                <option value="account">Regrouper par compte comptable</option>
                <option value="date_desc">Date (du plus récent au plus ancien)</option>
                <option value="date_asc">Date (du plus ancien au plus récent)</option>
                <option value="amount_desc">Montant (décroissant)</option>
              </select>
            </div>

            <!-- Champ de recherche rapide -->
            <div style="position: relative; display: flex; align-items: center;">
              <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 9px; color: var(--text-muted); font-size: 0.75rem; pointer-events: none;"></i>
              <input 
                type="text"
                placeholder="Rechercher..."
                bind:value={categorizedSearch}
                style="padding: 6px 10px 6px 26px; font-size: 0.82rem; border: 1.5px solid var(--border-color); border-radius: 8px; width: 140px; background: var(--bg-card); color: var(--text-main);"
              />
            </div>
          </div>
        {/if}

      {#if activeTab === 'pending'}
        {#if nonTriees.length > 0}
          <!-- Tableau épuré à 2 colonnes (Date + Carte d'opération & Contrôle Tito) -->
          <div class="table-container" style="width: 100%; overflow-x: auto; background: transparent !important; border: none !important; box-shadow: none !important;">
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
                        <!-- Étage 1 : Libellé + type à gauche, Montant à droite -->
                        <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
                          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <span style="font-weight: 800; font-size: 0.98rem; color: var(--table-card-title); letter-spacing: 0.01em;">
                              {cleanTransactionLibelle(tx.libelle, tx)}
                            </span>
                            <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); background: var(--bg-subtle); padding: 2px 8px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                              {tx.typeOperation || (tx.libelle.includes('PRLV') ? 'Prélèvement SEPA' : tx.libelle.includes('VIR') ? 'Virement' : 'Carte bancaire')}
                            </span>
                          </div>

                          <div style="font-size: 1.15rem; font-weight: 800; font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: {tx.debit > 0 ? '#f87171' : '#34d399'}; white-space: nowrap; margin-left: auto;">
                            {tx.debit > 0 ? "- " : "+ "}
                            {(Number(tx.debit || tx.credit || 0)).toFixed(2).replace('.', ',')} €
                          </div>
                        </div>

                        <!-- Étage 2 : Analyse pédagogique Tito (avec numéro de compte explicite pour apprendre) -->
                        <div style="font-size: 0.84rem; color: {titoInfo.isHeuristicDoubt ? 'var(--color-primary)' : 'var(--table-card-desc)'}; line-height: 1.45; font-weight: {titoInfo.isHeuristicDoubt ? '600' : '400'};">
                          {titoInfo.lineExplanation}
                        </div>

                        <!-- Étage 3 : Barre de pilules actions -->
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 2px; padding-top: 10px; border-top: 1px dashed var(--border-color);">
                          
                          <!-- Pilule principale Tito -->
                          {#if isStateA && sug}
                            {#if titoInfo.isCertain}
                              <span style="font-weight: 700; font-size: 0.78rem; color: #34d399; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); padding: 5px 12px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-check" style="font-size: 0.7rem;"></i>
                                <span>Attribution automatique • {sug.label} (compte {sug.compte})</span>
                              </span>
                            {:else}
                              <!-- Pilule bleue 1-clic Hero -->
                              <button
                                type="button"
                                onclick={() => {
                                  selectAccount(tx.id, sug.compte);
                                  validerLigneSeule(tx);
                                }}
                                title="Valider en 1 clic au compte {sug.compte}"
                                style="background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%); color: #ffffff; border: none; font-size: 0.8rem; font-weight: 800; padding: 6px 14px; border-radius: 9999px; cursor: pointer; box-shadow: 0 3px 12px rgba(6, 182, 212, 0.35); display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;"
                              >
                                <span>{titoInfo.oneClickLabel}</span>
                              </button>
                            {/if}
                          {:else if isStateC}
                            <span style="font-weight: 700; font-size: 0.78rem; color: #93c5fd; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.4); padding: 5px 12px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 6px;">
                              <i class="fa-solid fa-check" style="color: #60a5fa;"></i>
                              <span>Compte {manualCat} ({formatAccountLabel(manualCat)})</span>
                            </span>
                          {:else}
                            <button
                              type="button"
                              onclick={() => openCategorizeModal(tx)}
                              style="background: var(--bg-subtle); color: var(--text-main); border: 1px solid var(--border-color); font-size: 0.78rem; font-weight: 700; padding: 5px 12px; border-radius: 9999px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;"
                            >
                              <i class="fa-solid fa-magnifying-glass" style="color: var(--color-primary);"></i>
                              <span>Attribuer manuellement</span>
                            </button>
                          {/if}

                          <!-- Bouton Confirmer -->
                          {#if (isStateA && sug && titoInfo.isCertain) || isStateC}
                            <button
                              type="button"
                              onclick={() => {
                                if (isStateA && sug) selectAccount(tx.id, sug.compte);
                                validerLigneSeule(tx);
                              }}
                              style="padding: 5px 14px; font-weight: 800; font-size: 0.78rem; background: #16a34a; color: #ffffff; border: none; border-radius: 9999px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(22, 163, 74, 0.35);"
                              title="Confirmer cette attribution"
                            >
                              <i class="fa-solid fa-check"></i>
                              <span>Confirmer</span>
                            </button>
                          {/if}

                          <!-- Bouton Modifier -->
                          {#if isStateA || isStateC}
                            <button
                              type="button"
                              onclick={() => openCategorizeModal(tx)}
                              style="background: var(--bg-subtle); border: 1px solid var(--border-color); color: var(--text-secondary); padding: 5px 11px; border-radius: 9999px; cursor: pointer; font-size: 0.74rem; font-weight: 600;"
                            >
                              Modifier
                            </button>
                          {/if}

                          <!-- Bouton Analyse Tito -->
                          <button
                            type="button"
                            onclick={() => openTitoChatForTx(tx)}
                            style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); padding: 5px 11px; border-radius: 9999px; cursor: pointer; font-size: 0.74rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;"
                            title="Comprendre l'analyse de Tito et voir la règle officielle"
                          >
                            <span>Analyse Tito</span>
                          </button>

                          <!-- Bouton Ajouter détails (actif) -->
                          <button
                            type="button"
                            onclick={openConcatModal}
                            style="background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); padding: 4px 11px; border-radius: 9999px; cursor: pointer; font-size: 0.72rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s ease;"
                            title="Ajouter des détails / associer une colonne de votre relevé"
                            onmouseenter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                            onmouseleave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                          >
                            <span>+ Ajouter détails</span>
                          </button>

                        </div>

                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
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
          <div class="table-container" style="width: 100%; overflow-x: auto; background: transparent !important; border: none !important; box-shadow: none !important;">
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
                        
                        <!-- Ligne 1 : Libellé + type à gauche, Montant à droite -->
                        <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
                          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <span style="font-weight: 800; font-size: 0.98rem; color: var(--table-card-title); letter-spacing: 0.01em;">
                              {cleanTransactionLibelle(tx.libelle, tx)}
                            </span>
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

                          <button
                            type="button"
                            onclick={() => openCategorizeModal(tx)}
                            style="background: var(--bg-subtle); border: 1px solid var(--border-color); color: var(--text-secondary); padding: 5px 11px; border-radius: 9999px; cursor: pointer; font-size: 0.74rem; font-weight: 600;"
                          >
                            Modifier
                          </button>

                          <button
                            type="button"
                            onclick={() => openTitoChatForTx(tx)}
                            style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); padding: 5px 11px; border-radius: 9999px; cursor: pointer; font-size: 0.74rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;"
                            title="Consulter l'analyse officielle Tito"
                          >
                            <span>Analyse Tito</span>
                          </button>

                          <!-- Bouton Ajouter détails (actif) -->
                          <button
                            type="button"
                            onclick={openConcatModal}
                            style="background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); padding: 4px 11px; border-radius: 9999px; cursor: pointer; font-size: 0.72rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s ease;"
                            title="Ajouter des détails / associer une colonne de votre relevé"
                            onmouseenter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                            onmouseleave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                          >
                            <span>+ Ajouter détails</span>
                          </button>
                        </div>

                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
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

<!-- Modale Dédiée d'Attribution de Compte (Accordéon épuré) -->
{#if showCategorizeModal && selectedTxForCategorization}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-backdrop" onclick={() => showCategorizeModal = false} role="presentation" style="position: fixed; inset: 0; background: rgba(5, 10, 20, 0.78); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 100000; padding: 20px;">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
    <div class="modal-content" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1" style="max-width: 580px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; background: #0c1527 !important; border: 1.5px solid rgba(56, 189, 248, 0.25) !important; border-radius: 16px; padding: 22px 24px; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.75); color: #f8fafc !important;">
      
      <!-- Modal Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 12px;">
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
      <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 12px 14px; margin-bottom: 14px;">
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

      <!-- Scrollable Body (Accordéon direct Recettes / Dépenses épuré sans icônes) -->
      <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 2px; margin-bottom: 14px;">
        
        <!-- 1. ACCORDÉON RECETTES -->
        <div style="border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; overflow: hidden; background: rgba(255, 255, 255, 0.02);">
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
                
                <div style="border: 1px solid {hasSelectedInSub ? 'rgba(56, 189, 248, 0.45)' : 'rgba(255, 255, 255, 0.08)'}; border-radius: 8px; overflow: hidden; background: rgba(255, 255, 255, 0.03);">
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
        <div style="border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; overflow: hidden; background: rgba(255, 255, 255, 0.02);">
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
                
                <div style="border: 1px solid {hasSelectedInSub ? 'rgba(56, 189, 248, 0.45)' : 'rgba(255, 255, 255, 0.08)'}; border-radius: 8px; overflow: hidden; background: rgba(255, 255, 255, 0.03);">
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

      </div>

      <!-- Modal Footer Actions -->
      <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 14px;">
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
{/if}

<!-- MODALE DU DICTIONNAIRE D'ATTRIBUTION -->
{#if showDictionaryModal}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div 
    class="modal-backdrop" 
    role="dialog" 
    aria-modal="true" 
    aria-label="Dictionnaire d'attribution"
    tabindex="-1"
    onclick={() => {
      showDictionaryModal = false;
      Categorizer.reappliquerReglesAuxTransactionsEnAttente();
      selectedCategoryMap = {};
    }}
    style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div 
      class="modal-card" 
      onclick={(e) => e.stopPropagation()}
      style="background: #ffffff; width: 100%; max-width: 820px; max-height: 88vh; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); border: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; animation: zoomIn 0.2s ease-out;"
    >
      <!-- En-tête -->
      <div style="padding: 20px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-start; background: #f8fafc;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 38px; height: 38px; border-radius: 8px; background: #e0e7ff; color: #4f46e5; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;">
            <i class="fa-solid fa-book-bookmark"></i>
          </div>
          <div>
            <h2 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #0f172a; font-family: var(--font-title);">Dictionnaire d'attribution</h2>
            <p style="margin: 2px 0 0 0; font-size: 0.82rem; color: #64748b;">
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
          style="background: transparent; border: none; font-size: 1.2rem; color: #94a3b8; cursor: pointer; padding: 4px;"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- Corps défilable -->
      <div style="padding: 24px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Bloc formulaire : Ajouter un nouveau mot-clé -->
        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 18px;">
          <div style="font-weight: 700; font-size: 0.92rem; color: #0f172a; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-circle-plus" style="color: #6366f1;"></i>
            Ajouter un mot-clé au dictionnaire
          </div>

          <div style="display: grid; grid-template-columns: 2fr 1.1fr 2.5fr auto; gap: 10px; align-items: flex-end;">
            <div>
              <label for="dict-kw" style="display: block; font-size: 0.76rem; font-weight: 700; color: #475569; margin-bottom: 4px;">
                Quand le libellé contient :
              </label>
              <input 
                id="dict-kw"
                type="text" 
                bind:value={newRuleKeyword}
                placeholder="Ex : SPOTIFY, TOTAL, BOULANGERIE..."
                style="width: 100%; padding: 9px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; font-weight: 600; color: #0f172a; box-sizing: border-box;"
              />
            </div>

            <div>
              <label for="dict-type" style="display: block; font-size: 0.76rem; font-weight: 700; color: #475569; margin-bottom: 4px;">
                Sens :
              </label>
              <select 
                id="dict-type"
                bind:value={newRuleType}
                style="width: 100%; padding: 9px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; font-weight: 600; background: #ffffff; color: #0f172a; box-sizing: border-box;"
              >
                <option value="debit">Dépense (-)</option>
                <option value="credit">Recette (+)</option>
              </select>
            </div>

            <div>
              <label for="dict-acc" style="display: block; font-size: 0.76rem; font-weight: 700; color: #475569; margin-bottom: 4px;">
                Attribuer à la catégorie :
              </label>
              <select 
                id="dict-acc"
                bind:value={newRuleAccount}
                style="width: 100%; padding: 9px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; font-weight: 600; background: #ffffff; color: #0f172a; box-sizing: border-box;"
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

            <button 
              type="button" 
              onclick={handleAddDictionaryRule}
              style="padding: 10px 18px; background: #0f172a; color: #ffffff; border: none; border-radius: 8px; font-weight: 700; font-size: 0.86rem; cursor: pointer; white-space: nowrap; height: 40px; display: inline-flex; align-items: center; gap: 6px;"
            >
              <i class="fa-solid fa-plus"></i> Ajouter
            </button>
          </div>
        </div>

        <!-- En-tête de liste & barre de recherche -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 12px; flex-wrap: wrap;">
            <div style="font-weight: 800; font-size: 0.92rem; color: #0f172a;">
              Mots-clés enregistrés ({filteredRules.length})
            </div>

            <div style="position: relative; width: 260px;">
              <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 0.8rem;"></i>
              <input 
                type="text" 
                bind:value={dictionarySearch}
                placeholder="Rechercher un mot-clé..."
                style="width: 100%; padding: 7px 10px 7px 30px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.82rem; box-sizing: border-box;"
              />
            </div>
          </div>

          <!-- Tableau des règles -->
          {#if filteredRules.length === 0}
            <div style="text-align: center; padding: 36px 20px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; color: #64748b;">
              <i class="fa-solid fa-book-open" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 10px; display: block;"></i>
              <div style="font-weight: 700; color: #0f172a; font-size: 0.95rem;">
                {dictionarySearch ? 'Aucun mot-clé ne correspond à votre recherche.' : 'Aucun mot-clé enregistré pour cette structure.'}
              </div>
              <p style="font-size: 0.82rem; margin: 4px 0 0 0;">
                {dictionarySearch ? 'Essayez un autre terme de recherche.' : 'Ajoutez vos fournisseurs ou clients habituels ci-dessus, ou classez simplement vos écritures : elles s\'enregistrent automatiquement ici !'}
              </p>
            </div>
          {:else}
            <div style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                  <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; text-align: left; color: #475569; font-weight: 700; font-size: 0.78rem; text-transform: uppercase;">
                    <th style="padding: 10px 14px;">Mot-clé détecté</th>
                    <th style="padding: 10px 14px;">Sens</th>
                    <th style="padding: 10px 14px;">Catégorie attribuée</th>
                    <th style="padding: 10px 14px; text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {#each filteredRules as r}
                    {@const accountNum = r.debit || r.credit}
                    {@const isDebit = Boolean(r.debit)}
                    {@const isEditing = editingRuleOriginalMotCle === r.motCle}
                    
                    {#if isEditing}
                      <!-- LIGNE EN COURS DE MODIFICATION -->
                      <tr style="border-bottom: 2px solid #6366f1; background: #f8fafc;">
                        <td style="padding: 10px 14px;">
                          <input 
                            type="text" 
                            bind:value={editingKeyword}
                            onkeydown={(e) => { if (e.key === 'Enter') saveEditRule(); if (e.key === 'Escape') cancelEditRule(); }}
                            placeholder="Mot-clé..."
                            style="padding: 7px 10px; border: 1.5px solid #6366f1; border-radius: 6px; font-size: 0.85rem; font-weight: 700; width: 100%; box-sizing: border-box; font-family: ui-monospace, SFMono-Regular, monospace; color: #0f172a; background: #ffffff;"
                          />
                        </td>
                        <td style="padding: 10px 14px;">
                          <select 
                            bind:value={editingType}
                            style="padding: 7px 8px; border: 1.5px solid #cbd5e1; border-radius: 6px; font-size: 0.8rem; font-weight: 600; background: #ffffff; color: #0f172a; width: 100%; box-sizing: border-box;"
                          >
                            <option value="debit">Dépense (-)</option>
                            <option value="credit">Recette (+)</option>
                          </select>
                        </td>
                        <td style="padding: 10px 14px;">
                          <select 
                            bind:value={editingAccount}
                            style="padding: 7px 8px; border: 1.5px solid #6366f1; border-radius: 6px; font-size: 0.82rem; font-weight: 600; background: #ffffff; color: #0f172a; width: 100%; box-sizing: border-box;"
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
                        <td style="padding: 10px 14px; text-align: right; white-space: nowrap;">
                          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                            <button 
                              type="button" 
                              onclick={saveEditRule}
                              title="Enregistrer les modifications"
                              style="background: #16a34a; border: none; color: #ffffff; cursor: pointer; padding: 6px 12px; border-radius: 6px; font-size: 0.82rem; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 1px 2px rgba(22, 163, 74, 0.25);"
                            >
                              <i class="fa-solid fa-check"></i> Enregistrer
                            </button>
                            <button 
                              type="button" 
                              onclick={cancelEditRule}
                              title="Annuler"
                              aria-label="Annuler la modification"
                              style="background: #ffffff; border: 1px solid #cbd5e1; color: #64748b; cursor: pointer; padding: 6px 10px; border-radius: 6px; font-size: 0.82rem;"
                            >
                              <i class="fa-solid fa-xmark"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    {:else}
                      <!-- LIGNE NORMALE -->
                      <tr style="border-bottom: 1px solid #f1f5f9; background: #ffffff;">
                        <td style="padding: 10px 14px; font-weight: 800; color: #0f172a; font-family: ui-monospace, SFMono-Regular, monospace;">
                          <span style="background: #f1f5f9; padding: 3px 8px; border-radius: 6px; border: 1px solid #e2e8f0; display: inline-block;">
                            {r.motCle}
                          </span>
                        </td>
                        <td style="padding: 10px 14px;">
                          <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 0.74rem; background: {isDebit ? '#fee2e2' : '#dcfce7'}; color: {isDebit ? '#991b1b' : '#166534'};">
                            {isDebit ? 'Dépense (-)' : 'Recette (+)'}
                          </span>
                        </td>
                        <td style="padding: 10px 14px; color: #334155; font-weight: 600;">
                          {formatAccountLabel(accountNum)} <span style="color: #64748b; font-size: 0.78rem;">({accountNum})</span>
                        </td>
                        <td style="padding: 10px 14px; text-align: right; white-space: nowrap;">
                          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                            <button 
                              type="button" 
                              onclick={() => startEditRule(r)}
                              title="Corriger l'intitulé ou la catégorie"
                              style="background: #ffffff; border: 1px solid #cbd5e1; color: #475569; cursor: pointer; padding: 6px 10px; border-radius: 6px; font-size: 0.82rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);"
                              onmouseenter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                              onmouseleave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#475569'; }}
                            >
                              <i class="fa-solid fa-pen" style="font-size: 0.75rem;"></i> Modifier
                            </button>
                            <button 
                              type="button" 
                              onclick={() => handleDeleteDictionaryRule(r.motCle)}
                              title="Supprimer ce mot-clé du dictionnaire"
                              aria-label="Supprimer ce mot-clé du dictionnaire"
                              style="background: transparent; border: 1px solid transparent; color: #dc2626; cursor: pointer; padding: 6px 10px; border-radius: 6px; font-size: 0.85rem;"
                              onmouseenter={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                              onmouseleave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
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
          {/if}
        </div>

      </div>

      <!-- Pied de page -->
      <div style="padding: 14px 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; background: #f8fafc;">
        <button 
          type="button" 
          onclick={() => showDictionaryModal = false}
          style="padding: 8px 20px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; font-weight: 700; font-size: 0.86rem; color: #334155; cursor: pointer;"
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
