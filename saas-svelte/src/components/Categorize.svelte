<script>
  import { Categorizer } from "../lib/categorizer.js";
  import { CSVParser } from "../lib/parser.js";

  import { onMount } from "svelte";
  import { 
    transactions, 
    planComptable, 
    rules, 
    activeTxId, 
    updateTransactions, 
    updateRules, 
    showToast,
    isPremium,
    showUpgradeModal,
    FREE_TIER_MAX_TRANSACTIONS
  } from "../lib/store.js";
  
  // Active tab filter: 'pending' vs 'categorized'
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
    showToast(`🗑️ Règle "${motCle}" retirée du dictionnaire.`);
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
      showToast('⚠️ Le mot-clé ne peut pas être vide.');
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
      const parsed = CSVParser.parse(rawText);
      if (!parsed || parsed.length === 0) {
        showToast("⚠️ Fichier CSV vide ou format non reconnu.");
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
        reference: t.reference || ""
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
      showToast(`${newTxList.length} opération(s) importée(s) avec succès depuis "${file.name}".`);
    };
    reader.readAsText(file);
  }

  // Categorization modal state
  let showCategorizeModal = $state(false);
  /** @type {any} */
  let selectedTxForCategorization = $state(null);
  let modalSearchQuery = $state("");

  /** @param {any} tx */
  function openCategorizeModal(tx) {
    selectedTxForCategorization = tx;
    modalSearchQuery = "";
    showCategorizeModal = true;
  }

  /** @type {Record<string, string>} */
  let selectedCategoryMap = $state({});

  // Keep copy for undo
  /** @type {any[] | null} */
  let lastStateTransactions = $state(null);

  import { activeEntityId } from "../lib/store.js";

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

  function loadHistory() {
    importsHistory = getImportsHistory();
  }

  onMount(() => {
    // Laisser la modale fermée par défaut pour ne pas bloquer l'import ou la navigation
    showPedagogicalModal = false;
    loadHistory();
    Categorizer.reappliquerReglesAuxTransactionsEnAttente();
  });

  // Recharger l'historique et réinitialiser les sélections en cours quand on change de structure
  $effect(() => {
    if ($activeEntityId) {
      loadHistory();
      selectedCategoryMap = {};
      lastStateTransactions = null;
    }
  });

  /** 
   * Supprimer/Annuler un import et retirer ses écritures
   * @param {string} importId 
   * @param {string} fileName 
   * @param {number} linesCount 
   */
  function supprimerImport(importId, fileName, linesCount) {
    if (confirm(`⚠️ Voulez-vous vraiment annuler l'import "${fileName}" ? Cela supprimera les ${linesCount} transactions associées.`)) {
      const filteredTx = $transactions.filter(t => t.importId !== importId && (!t.entityId || t.entityId === $activeEntityId));
      const history = getImportsHistory().filter((/** @type {any} */ h) => h.id !== importId);
      saveImportsHistory(history);

      const recatted = Categorizer.categoriserTransactions(filteredTx);
      updateTransactions(recatted);

      showToast(`🗑️ Import "${fileName}" annulé avec succès.`);
    }
  }

  /**
   * Effacer toutes les opérations actuellement de cet espace
   */
  function effacerToutesOperations() {
    if (currentStructureTx.length === 0) return;
    if (confirm(`⚠️ Voulez-vous effacer l'ensemble des ${currentStructureTx.length} écritures bancaires de cet espace ?`)) {
      updateTransactions([]);
      saveImportsHistory([]);
      showToast('🗑️ Toutes les opérations de cet espace ont été effacées.');
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

  // Reactive transaction lists filtrées strictement par structure
  let currentStructureTx = $derived($transactions.filter((t) => (!t.entityId || t.entityId === $activeEntityId)));
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

  // Formatted Label Helper: "Nom de la catégorie (Code)"
  /** @param {string|number} [numCompte] */
  function formatAccountLabel(numCompte) {
    if (!numCompte || String(numCompte) === '699') return '« Choisir une catégorie... »';
    return Categorizer.obtenirLibelleCompte(numCompte);
  }

  // Helper to clean banking transaction labels & extract readable name
  /** @param {string} [libelle] */
  function cleanTransactionLibelle(libelle) {
    if (!libelle) return "Opération sans libellé";
    let main = libelle.split('|')[0].trim();
    main = main.replace(/^(PRLV SEPA|PRLV|VIR SEPA|VIR|PAIEMENT CB|CB|CHEQUE|PRLV HARMONIE)\s+/i, '').trim();
    main = main.replace(/^SA-/, '').trim();
    return main || libelle;
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

  // 1. 🟢 ENTRÉES D'ARGENT
  let groupEntrees = $derived(
    $planComptable.filter(c => c.compte !== "699" && (c.group === 'entrees' || c.compte.startsWith("7") || c.type === "Produit"))
  );

  // 2. 🔴 DÉPENSES COURANTES
  let groupDepensesCourantes = $derived(
    $planComptable.filter(c => c.compte !== "699" && (c.group === 'depenses_courantes' || ['606', '613', '6132', '615', '616', '625', '626', '627'].includes(c.compte)))
  );

  // 3. 👥 ÉQUIPE & INTERVENANTS
  let groupEquipe = $derived(
    $planComptable.filter(c => c.compte !== "699" && (c.group === 'equipe' || ['611', '641', '645', '6453', '658'].includes(c.compte)))
  );

  // 4. 🔄 COMPTES & TRANSFERTS
  let groupTransferts = $derived(
    $planComptable.filter(c => c.compte !== "699" && (c.group === 'transferts' || c.compte.startsWith("4") || c.compte.startsWith("5")))
  );

  // Modal Category Filters
  let filteredEntreesModal = $derived(groupEntrees.filter(c => !modalSearchQuery || c.libelle.toLowerCase().includes(modalSearchQuery.toLowerCase()) || c.compte.includes(modalSearchQuery)));
  let filteredDepensesModal = $derived(groupDepensesCourantes.filter(c => !modalSearchQuery || c.libelle.toLowerCase().includes(modalSearchQuery.toLowerCase()) || c.compte.includes(modalSearchQuery)));
  let filteredEquipeModal = $derived(groupEquipe.filter(c => !modalSearchQuery || c.libelle.toLowerCase().includes(modalSearchQuery.toLowerCase()) || c.compte.includes(modalSearchQuery)));
  let filteredTransfertsModal = $derived(groupTransferts.filter(c => !modalSearchQuery || c.libelle.toLowerCase().includes(modalSearchQuery.toLowerCase()) || c.compte.includes(modalSearchQuery)));

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
    showToast(`🎉 Succès : ${count} écritures attribuées automatiquement en 1 clic !`);
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

<div class="page-title-section" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 20px;">
  <div>
    <h1 class="page-title" style="margin: 0; font-size: 1.4rem; font-weight: 800; color: var(--text-main);">Libellés & Attribution</h1>
    <p class="page-subtitle" style="margin: 4px 0 0 0; font-size: 0.86rem; color: var(--text-muted);">Importez vos opérations bancaires et attribuez-les facilement. Le dictionnaire d'attribution retient automatiquement vos choix.</p>
  </div>

  <div style="display: flex; gap: 10px; align-items: center;">
    {#if lastStateTransactions}
      <button class="btn btn-secondary btn-sm" onclick={annulerDerniereAction} style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.25); display: flex; align-items: center; gap: 6px;">
        <i class="fa-solid fa-rotate-left"></i> Annuler le dernier tri
      </button>
    {/if}
  </div>
</div>

<!-- ========================================== -->
<!-- 1. IMPORT DE RELEVÉ BANCAIRE (CSV) -->
<!-- ========================================== -->
<div style="margin-bottom: 30px;">
  <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
    <!-- En-tête du bloc -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 8px;">
      <div>
        <h3 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-cloud-arrow-up" style="color: #2563eb; font-size: 0.95rem;"></i> Import de relevé bancaire
        </h3>
        <span style="font-size: 0.8rem; color: #64748b; font-weight: 600; margin-top: 2px; display: block;">
          Glissez-déposez le fichier CSV fourni par votre banque pour synchroniser vos écritures
        </span>
      </div>

      {#if currentStructureTx.length > 0}
        <button 
          type="button" 
          onclick={effacerToutesOperations}
          style="display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 0.78rem; padding: 5px 12px; background: #ffffff; border: 1px solid #fecaca; color: #dc2626; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;"
          onmouseenter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
          onmouseleave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
          title="Effacer toutes les écritures de cette structure"
        >
          <i class="fa-solid fa-trash-can" style="font-size: 0.74rem;"></i>
          Effacer le relevé ({currentStructureTx.length})
        </button>
      {/if}
    </div>

    <!-- Zone de drop horizontale moderne pleine largeur -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div 
      class="dropzone {dragover ? 'dragover' : ''}" 
      onclick={() => fileInput && fileInput.click()}
      ondragenter={(e) => { e.preventDefault(); e.stopPropagation(); dragover = true; }}
      ondragover={(e) => { e.preventDefault(); e.stopPropagation(); dragover = true; }}
      ondragleave={(e) => { e.preventDefault(); e.stopPropagation(); dragover = false; }}
      ondrop={handleCSVDrop}
      style="cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px; padding: 20px 24px; background: {dragover ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-card, #ffffff)'}; border: 1.5px dashed {dragover ? '#2563eb' : '#cbd5e1'}; border-radius: 12px; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04); box-sizing: border-box;"
      onmouseenter={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.background = 'rgba(37, 99, 235, 0.02)'; }}
      onmouseleave={(e) => { if (!dragover) { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = 'var(--bg-card, #ffffff)'; } }}
    >
      <div style="display: flex; align-items: center; gap: 16px; pointer-events: none;">
        <div style="width: 46px; height: 46px; border-radius: 10px; background: #f1f5f9; border: 1px solid #e2e8f0; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; flex-shrink: 0;">
          <i class="fa-solid fa-cloud-arrow-up"></i>
        </div>
        <div>
          <div style="font-weight: 800; font-size: 0.98rem; color: #0f172a; margin-bottom: 3px;">
            Déposez votre fichier bancaire CSV ici
          </div>
          <div style="font-size: 0.8rem; color: #64748b; font-weight: 500;">
            Compatible avec toutes les banques (BoursoBank, BNP, Crédit Agricole, Qonto, Shine, etc.)
          </div>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 12px; pointer-events: none;">
        <span style="font-size: 0.82rem; color: #64748b; font-weight: 600;">
          ou
        </span>
        <span style="display: inline-flex; align-items: center; gap: 8px; background: #0f172a; color: #ffffff; padding: 9px 20px; border-radius: 8px; font-weight: 700; font-size: 0.86rem; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);">
          <i class="fa-solid fa-folder-open"></i> Parcourir vos fichiers
        </span>
      </div>

      <input 
        type="file" 
        bind:this={fileInput} 
        onchange={handleCSVFileSelect} 
        style="display: none;" 
        accept=".csv"
      />
    </div>
  </div>
</div>

<!-- ========================================== -->
<!-- 2. RÈGLES D'ATTRIBUTION & HISTORIQUE -->
<!-- ========================================== -->
<div style="margin-bottom: 30px;">
  <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
    <!-- En-tête du bloc -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 8px;">
      <div>
        <h3 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-book-bookmark" style="color: #2563eb; font-size: 0.95rem;"></i> Règles d'attribution & Historique
        </h3>
        <span style="font-size: 0.8rem; color: #64748b; font-weight: 600; margin-top: 2px; display: block;">
          Automatisez le classement grâce à votre dictionnaire de règles et suivez vos imports
        </span>
      </div>
    </div>

    <!-- Catalogue des 2 modules sous forme de cartes blanches épurées -->
    <div style="display: flex; flex-direction: column; gap: 12px;">
      
      <!-- 1. Dictionnaire d'attribution -->
      <div style="padding: 16px 20px; background: var(--bg-card, #ffffff); border-radius: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 42px; height: 42px; border-radius: 9px; background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
            <i class="fa-solid fa-book-bookmark"></i>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 800; font-size: 0.96rem; color: #0f172a;">Dictionnaire d'attribution automatique</span>
              <span style="font-size: 0.72rem; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 7px; border-radius: 4px; font-weight: 700; letter-spacing: 0.02em;">{$rules.length} RÈGLE{$rules.length > 1 ? 'S' : ''}</span>
            </div>
            <div style="font-size: 0.82rem; color: #64748b; margin-top: 3px;">
              Mémorise automatiquement les mots-clés et associe les libellés bancaires aux bons comptes officiels.
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button 
            type="button" 
            onclick={() => showDictionaryModal = true}
            style="background: #0f172a; color: #ffffff; border: none; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);"
          >
            Gérer les règles
          </button>
        </div>
      </div>

      <!-- 2. Historique des imports CSV -->
      <div style="padding: 16px 20px; background: var(--bg-card, #ffffff); border-radius: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 42px; height: 42px; border-radius: 9px; background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
            <i class="fa-solid fa-clock-rotate-left"></i>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 800; font-size: 0.96rem; color: #0f172a;">Historique des imports de relevés</span>
              <span style="font-size: 0.72rem; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 7px; border-radius: 4px; font-weight: 700; letter-spacing: 0.02em;">{importsHistory.length} FICHIER{importsHistory.length > 1 ? 'S' : ''}</span>
            </div>
            <div style="font-size: 0.82rem; color: #64748b; margin-top: 3px;">
              Consultez les fichiers CSV précédemment intégrés et annulez un import si nécessaire.
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button 
            type="button" 
            onclick={() => showHistoryDrawer = !showHistoryDrawer}
            style="background: {showHistoryDrawer ? '#0f172a' : '#ffffff'}; color: {showHistoryDrawer ? '#ffffff' : '#0f172a'}; border: 1.5px solid {showHistoryDrawer ? '#0f172a' : '#cbd5e1'}; padding: 8px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 0.86rem; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 6px;"
          >
            {showHistoryDrawer ? 'Masquer' : 'Consulter'}
            <i class="fa-solid {showHistoryDrawer ? 'fa-chevron-up' : 'fa-chevron-down'}" style="font-size: 0.72rem;"></i>
          </button>
        </div>
      </div>

    </div>

    <!-- Volet déroulant : Historique des fichiers importés -->
    {#if showHistoryDrawer}
      <div style="background: var(--bg-card, #ffffff); border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04); animation: fadeIn 0.2s ease-out; margin-top: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
          <span style="font-weight: 800; font-size: 0.88rem; color: #0f172a;">
            Fichiers CSV importés dans cet espace
          </span>
          <span style="font-size: 0.78rem; color: #64748b;">
            Vous pouvez annuler n'importe quel import pour retirer ses opérations
          </span>
        </div>

        {#if importsHistory.length === 0}
          <div style="text-align: center; padding: 14px; color: #64748b; font-size: 0.85rem;">
            Aucun fichier importé récemment enregistré dans l'historique.
          </div>
        {:else}
          <div style="display: flex; flex-direction: column; gap: 8px;">
            {#each importsHistory as item}
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 32px; height: 32px; border-radius: 6px; background: #f1f5f9; border: 1px solid #e2e8f0; color: #475569; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; flex-shrink: 0;">
                    <i class="fa-solid fa-file-csv"></i>
                  </div>
                  <div>
                    <div style="font-weight: 700; color: #0f172a; font-size: 0.88rem;">{item.fileName}</div>
                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 1px;">
                      {new Date(item.date).toLocaleString('fr-FR')} &bull; {item.size} &bull; <strong style="color: #0f172a;">{item.linesCount} écritures</strong>
                    </div>
                  </div>
                </div>

                <button 
                  type="button" 
                  class="btn btn-sm"
                  onclick={() => supprimerImport(item.id, item.fileName, item.linesCount)}
                  style="display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 0.78rem; padding: 6px 12px; background: #ffffff; border: 1px solid #fecaca; color: #dc2626; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;"
                  onmouseenter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                  onmouseleave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                >
                  <i class="fa-solid fa-trash-can" style="font-size: 0.74rem;"></i>
                  Annuler cet import
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<!-- ========================================== -->
<!-- 3. TRAITEMENT ET AFFECTATION DES OPÉRATIONS -->
<!-- ========================================== -->
<div style="margin-bottom: 30px;">
  <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
    <!-- En-tête du bloc -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 8px;">
      <div>
        <h3 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-arrows-split-up-and-left" style="color: #2563eb; font-size: 0.95rem;"></i> Traitement et affectation des opérations
        </h3>
        <span style="font-size: 0.8rem; color: #64748b; font-weight: 600; margin-top: 2px; display: block;">
          Affectez chaque dépense ou recette à son compte officiel
        </span>
      </div>

      <!-- Bouton d'aide et explications dans l'en-tête du bloc -->
      <button 
        type="button" 
        onclick={() => (showPedagogicalModal = true)}
        title="Consulter les explications et le guide d'attribution"
        style="display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 0.78rem; padding: 5px 12px; background: #ffffff; border: 1px solid #cbd5e1; color: #475569; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.02);"
        onmouseenter={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; }}
        onmouseleave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#475569'; }}
      >
        <i class="fa-regular fa-circle-question" style="color: #64748b; font-size: 0.85rem;"></i>
        Guide d'attribution
      </button>
    </div>

    <!-- Carte blanche intérieure avec onglets & tableau -->
    <div style="padding: 18px 20px; background: var(--bg-card, #ffffff); border-radius: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04); width: 100%; box-sizing: border-box;">
      
      <!-- Filter Tabs & Action par lot -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; width: 100%;">
        <div style="display: flex; gap: 6px; background: #f1f5f9; padding: 4px; border-radius: 10px; border: 1px solid #e2e8f0;">
          <button
            style="border: none; background: {activeTab === 'pending' ? '#0f172a' : 'transparent'}; color: {activeTab === 'pending' ? '#ffffff' : '#475569'}; font-size: 0.86rem; padding: 7px 18px; border-radius: 7px; cursor: pointer; font-weight: 700; transition: all 0.15s ease;"
            onclick={() => (activeTab = "pending")}
          >
            À attribuer ({nonTriees.length})
          </button>
          <button
            style="border: none; background: {activeTab === 'categorized' ? '#0f172a' : 'transparent'}; color: {activeTab === 'categorized' ? '#ffffff' : '#475569'}; font-size: 0.86rem; padding: 7px 18px; border-radius: 7px; cursor: pointer; font-weight: 700; transition: all 0.15s ease;"
            onclick={() => (activeTab = "categorized")}
          >
            Attribuées ({triees.length})
          </button>
        </div>

        <!-- Action Tout valider au-dessus du tableau avec libellé direct et court -->
        <button 
          type="button"
          onclick={validerToutEnUnClic}
          disabled={recognizedList.length === 0}
          style="padding: 7px 16px; font-size: 0.84rem; font-weight: 700; background: {recognizedList.length > 0 ? '#16a34a' : '#f1f5f9'}; color: {recognizedList.length > 0 ? '#ffffff' : '#94a3b8'}; border: 1px solid {recognizedList.length > 0 ? 'transparent' : '#e2e8f0'}; border-radius: 8px; cursor: {recognizedList.length === 0 ? 'not-allowed' : 'pointer'}; display: flex; align-items: center; gap: 7px; box-shadow: {recognizedList.length > 0 ? '0 1px 2px rgba(22, 163, 74, 0.2)' : 'none'}; transition: all 0.15s ease;"
          onmouseenter={(e) => { if (recognizedList.length > 0) e.currentTarget.style.background = '#15803d'; }}
          onmouseleave={(e) => { if (recognizedList.length > 0) e.currentTarget.style.background = '#16a34a'; }}
          title={recognizedList.length === 0 ? "Aucune suggestion automatique en attente" : "Valider toutes les suggestions d'un clic"}
        >
          <i class="fa-solid fa-check-double" style="color: {recognizedList.length > 0 ? '#ffffff' : '#94a3b8'};"></i>
          Tout valider ({recognizedList.length})
        </button>
      </div>

      <!-- Batch Table -->
      <div class="table-container" style="width: 100%; overflow-x: auto;">
        <table class="custom-table" style="width: 100%; border-collapse: separate; border-spacing: 0;">
          <thead>
            <tr>
              <th style="width: 12%; padding: 12px 14px; font-weight: 700; font-size: 0.8rem; color: #475569; text-transform: uppercase; letter-spacing: 0.04em;">Date</th>
              <th style="width: 32%; padding: 12px 14px; font-weight: 700; font-size: 0.8rem; color: #475569; text-transform: uppercase; letter-spacing: 0.04em;">Libellé</th>
              <th style="width: 14%; padding: 12px 14px; text-align: right; font-weight: 700; font-size: 0.8rem; color: #475569; text-transform: uppercase; letter-spacing: 0.04em;">Montant</th>
              <th style="width: 30%; padding: 12px 14px; font-weight: 700; font-size: 0.8rem; color: #475569; text-transform: uppercase; letter-spacing: 0.04em;">Catégorie / Attribution</th>
              <th style="width: 12%; padding: 12px 14px; text-align: right; font-weight: 700; font-size: 0.8rem; color: #475569; text-transform: uppercase; letter-spacing: 0.04em;">Action</th>
            </tr>
          </thead>
          <tbody>
            {#if displayedTxList.length === 0}
              <tr>
                <td colspan="5" style="text-align: center; padding: 48px 10px;">
                  <div style="width: 52px; height: 52px; border-radius: 50%; background: #f0fdf4; border: 1.5px solid #bbf7d0; color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin: 0 auto 12px auto;">
                    <i class="fa-solid fa-check"></i>
                  </div>
                  <strong style="font-size: 1rem; color: #0f172a; display: block; margin-bottom: 4px;">{activeTab === "pending" ? "Toutes les écritures sont attribuées !" : "Aucune écriture attribuée"}</strong>
                  <span style="font-size: 0.82rem; color: #64748b;">{activeTab === "pending" ? "Toutes vos opérations sont correctement rattachées aux comptes comptables." : "Importez un relevé bancaire ou classez vos écritures pour les retrouver ici."}</span>
                </td>
              </tr>
            {:else if activeTab === "pending"}
              {#each nonTriees as tx}
                {@const sug = getSuggestionForTx(tx)}
                {@const manualCat = selectedCategoryMap[tx.id]}
                {@const isStateA = Boolean(sug) && !manualCat}
                {@const isStateC = Boolean(manualCat)}
                {@const isStateB = !isStateA && !isStateC}

                <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s ease;">
                  
                  <!-- 1. Date (Format court DD/MM/YY) -->
                  <td style="padding: 14px 14px; vertical-align: middle; font-weight: 600; font-size: 0.88rem; color: #64748b; white-space: nowrap;">
                    {tx.date ? new Date(tx.date).toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''}
                  </td>

                  <!-- 2. Libellé épuré -->
                  <td style="padding: 14px 14px; vertical-align: middle;" title="{tx.libelle} {tx.info ? `• ${tx.info}` : ''} {tx.reference ? `• Ref: ${tx.reference}` : ''}">
                    <div style="font-weight: 700; color: #0f172a; font-size: 0.93rem;">
                      {cleanTransactionLibelle(tx.libelle)}
                    </div>
                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 1px;">
                      {tx.typeOperation || (tx.libelle.includes('PRLV') ? 'Prélèvement SEPA' : tx.libelle.includes('VIR') ? 'Virement' : 'Carte bancaire')}
                    </div>
                  </td>

                  <!-- 3. Montant (Directement après le Libellé) -->
                  <td style="padding: 14px 14px; vertical-align: middle; text-align: right; font-size: 0.95rem; font-weight: 700; font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; color: {tx.debit > 0 ? '#b91c1c' : '#15803d'}; white-space: nowrap;">
                    {tx.debit > 0 ? "- " : "+ "}
                    {(Number(tx.debit || tx.credit || 0)).toFixed(2).replace('.', ',')} €
                  </td>

                  <!-- 4. Catégorie / Attribution -->
                  <td style="padding: 14px 14px; vertical-align: middle;">
                    {#if isStateA && sug}
                      <!-- ÉTAT A : Suggestion IA (Label suggestion + Bouton Modifier) -->
                      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="font-weight: 700; font-size: 0.88rem; color: #166534; background: #f0fdf4; border: 1.5px solid #bbf7d0; padding: 6px 12px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px;">
                          <i class="fa-solid fa-wand-magic-sparkles" style="color: #16a34a;"></i>
                          {sug.label} ({sug.compte})
                        </span>
                        <button
                          type="button"
                          onclick={() => openCategorizeModal(tx)}
                          title="Modifier l'attribution"
                          style="background: #ffffff; border: 1px solid #cbd5e1; color: #475569; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 0.82rem; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);"
                        >
                          <i class="fa-solid fa-pen" style="font-size: 0.75rem;"></i> Modifier
                        </button>
                      </div>
                    {:else if isStateC}
                      <!-- ÉTAT C : Choix manuel en cours (Label + Bouton Modifier) -->
                      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="font-weight: 700; font-size: 0.88rem; color: #1e40af; background: #eff6ff; border: 1.5px solid #bfdbfe; padding: 6px 12px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px;">
                          <i class="fa-solid fa-check" style="color: #2563eb;"></i>
                          {formatAccountLabel(manualCat)} ({manualCat})
                        </span>
                        <button
                          type="button"
                          onclick={() => openCategorizeModal(tx)}
                          title="Modifier l'attribution"
                          style="background: #ffffff; border: 1px solid #cbd5e1; color: #475569; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 0.82rem; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);"
                        >
                          <i class="fa-solid fa-pen" style="font-size: 0.75rem;"></i> Modifier
                        </button>
                      </div>
                    {:else}
                      <!-- ÉTAT B : Pas de suggestion IA -> Bouton "Attribution manuelle" -->
                      <button
                        type="button"
                        onclick={() => openCategorizeModal(tx)}
                        title="Ouvrir le menu d'attribution manuelle"
                        style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 8px; border: 1.5px solid #cbd5e1; background: #ffffff; color: #334155; font-weight: 700; font-size: 0.88rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.04);"
                      >
                        <i class="fa-solid fa-magnifying-glass" style="color: #6366f1;"></i>
                        Attribution manuelle
                      </button>
                    {/if}
                  </td>

                  <!-- 5. Action (Bouton "Valider" explicite avec texte si une suggestion/choix existe) -->
                  <td style="padding: 14px 14px; vertical-align: middle; text-align: right;">
                    {#if (isStateA && sug) || isStateC}
                      <button 
                        type="button"
                        onclick={() => {
                          if (isStateA && sug) selectAccount(tx.id, sug.compte);
                          validerLigneSeule(tx);
                        }}
                        title="Valider l'attribution"
                        aria-label="Valider l'attribution"
                        style="padding: 7px 16px; font-weight: 700; font-size: 0.85rem; background: #16a34a; color: #ffffff; border: none; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 1px 2px rgba(22, 163, 74, 0.2);"
                      >
                        <i class="fa-solid fa-check"></i> Valider
                      </button>
                    {/if}
                  </td>

                </tr>
              {/each}
            {:else}
              <!-- Categorized List -->
              {#each triees as tx}
                <tr style="border-bottom: 1px solid #f1f5f9; background: #ffffff;">
                  <td style="padding: 14px 14px; font-weight: 600; font-size: 0.88rem; color: #64748b; white-space: nowrap;">
                    {tx.date ? new Date(tx.date).toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''}
                  </td>
                  <td style="padding: 14px 14px;">
                    <div style="font-weight: 700; color: #0f172a;">{cleanTransactionLibelle(tx.libelle)}</div>
                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 1px;">
                      {tx.typeOperation || (tx.libelle.includes('PRLV') ? 'Prélèvement SEPA' : tx.libelle.includes('VIR') ? 'Virement' : 'Carte bancaire')}
                    </div>
                  </td>
                  <td style="padding: 14px 14px; text-align: right; font-weight: 700; font-size: 0.95rem; font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; color: {tx.debit > 0 ? '#b91c1c' : '#15803d'}; white-space: nowrap;">
                    {tx.debit > 0 ? "- " : "+ "}
                    {(Number(tx.debit || tx.credit || 0)).toFixed(2).replace('.', ',')} €
                  </td>
                  <td style="padding: 14px 14px; color: #3730a3; font-weight: 700;">
                    <span style="display: inline-flex; align-items: center; gap: 6px; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; padding: 6px 12px; border-radius: 8px; font-size: 0.88rem;">
                      <i class="fa-solid fa-circle-check" style="color: #16a34a;"></i>
                      {formatAccountLabel(tx.compteAttribué)} ({tx.compteAttribué})
                    </span>
                  </td>
                  <td style="padding: 14px 14px; text-align: right;">
                    <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; color: #15803d; background: #dcfce7; border: 1px solid #86efac; padding: 4px 10px; border-radius: 6px; font-weight: 700;">
                      <i class="fa-solid fa-check"></i> Validé
                    </span>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

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
        Le système a identifié <strong>{matchingSimilarTxList.length} autre(s) opération(s) similaire(s)</strong> à <em>"{pendingPrimaryTx ? pendingPrimaryTx.libelle : ''}"</em>.<br/>
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

<!-- Modale Dédiée d'Attribution de Compte -->
{#if showCategorizeModal && selectedTxForCategorization}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-backdrop" onclick={() => showCategorizeModal = false} role="presentation" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 100000; padding: 20px;">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
    <div class="modal-content" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1" style="max-width: 740px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; background: #ffffff !important; border: 1.5px solid #cbd5e1 !important; border-radius: 16px; padding: 24px; box-shadow: 0 25px 60px rgba(0,0,0,0.25); color: #0f172a !important;">
      
      <!-- Modal Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 14px;">
        <div>
          <h3 style="margin: 0; font-family: var(--font-title); font-size: 1.25rem; color: #0f172a !important; display: flex; align-items: center; gap: 10px; font-weight: 800;">
            <i class="fa-solid fa-tags" style="color: #6366f1;"></i> Attribuer un compte comptable
          </h3>
          <div style="font-size: 0.82rem; color: #475569 !important; margin-top: 4px;">
            Sélectionnez la catégorie comptable exacte documentée ci-dessous
          </div>
        </div>
        <button type="button" onclick={() => showCategorizeModal = false} style="background: none; border: none; color: #64748b; font-size: 1.4rem; cursor: pointer;">✕</button>
      </div>

      <!-- Transaction Card Summary -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
          <div>
            <div style="font-weight: 700; color: #0f172a !important; font-size: 1.05rem;">{selectedTxForCategorization.libelle}</div>
            <div style="font-size: 0.78rem; color: #475569 !important; margin-top: 2px;">
              {selectedTxForCategorization.date ? new Date(selectedTxForCategorization.date).toLocaleDateString("fr-FR") : ''} &bull; {selectedTxForCategorization.debit > 0 ? "Dépense" : "Recette"}
              {selectedTxForCategorization.reference ? ` • Ref: ${selectedTxForCategorization.reference}` : ''}
            </div>
          </div>
          <div style="font-weight: 800; font-size: 1.2rem; color: {selectedTxForCategorization.debit > 0 ? '#dc2626' : '#16a34a'};">
            {selectedTxForCategorization.debit > 0 ? "-" : "+"}
            {(Number(selectedTxForCategorization.debit || selectedTxForCategorization.credit || 0)).toFixed(2)} €
          </div>
        </div>

        <!-- AI Suggestion if available -->
        {#if getSuggestionForTx(selectedTxForCategorization)}
          {@const sug = getSuggestionForTx(selectedTxForCategorization)}
          {#if sug}
            <div style="margin-top: 10px; display: flex; align-items: center; justify-content: space-between; background: #eeef4f3; border: 1px solid #c7d2fe; padding: 8px 12px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem;">
                <i class="fa-solid fa-brain" style="color: #4f46e5;"></i>
                <span style="color: #3730a3; font-weight: 700;">Suggestion IA :</span>
                <strong style="color: #0f172a;">{sug?.label}</strong>
              </div>
              <button 
                type="button" 
                class="btn" 
                style="padding: 4px 12px; font-size: 0.8rem; background: #4f46e5; color: white; border: none; border-radius: 6px; font-weight: 700; cursor: pointer;"
                onclick={() => {
                  if (sug && selectedTxForCategorization) {
                    selectAccount(selectedTxForCategorization.id, sug.compte);
                    validerLigneSeule(selectedTxForCategorization);
                    showCategorizeModal = false;
                  }
                }}
              >
                Appliquer la suggestion
              </button>
            </div>
          {/if}
        {/if}
      </div>

      <!-- Search input inside modal -->
      <div style="margin-bottom: 14px;">
        <input 
          type="text" 
          placeholder="🔍 Filtrer les catégories ou numéros (ex: 606, Cotisations, Logiciels, Repas...)" 
          bind:value={modalSearchQuery}
          style="width: 100%; padding: 10px 14px; background: #ffffff !important; border: 1.5px solid #cbd5e1 !important; border-radius: 8px; color: #0f172a !important; font-size: 0.9rem; box-sizing: border-box;"
        />
      </div>

      <!-- Category Groups List -->
      <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; padding-right: 4px; margin-bottom: 16px;">
        
        <!-- Group 1: ENTRÉES D'ARGENT -->
        {#if filteredEntreesModal.length > 0}
          <div>
            <div style="color: #065f46 !important; font-weight: 800; font-size: 0.85rem; text-transform: uppercase; padding: 6px 12px; background: #ecfdf5; border-left: 3px solid #10b981; border-radius: 4px; margin-bottom: 8px; letter-spacing: 0.03em;">
              🟢 ENTRÉES D'ARGENT (RECETTES)
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              {#each filteredEntreesModal as c}
                {@const isSelected = (selectedCategoryMap[selectedTxForCategorization.id] || selectedTxForCategorization.compteAttribué) === c.compte}
                <button 
                  type="button"
                  onclick={() => {
                    selectedCategoryMap[selectedTxForCategorization.id] = c.compte;
                  }}
                  style="text-align: left; padding: 12px 16px; border-radius: 10px; cursor: pointer; border: 1.5px solid {isSelected ? '#10b981' : '#e2e8f0'}; background: {isSelected ? '#ecfdf5' : '#ffffff'}; color: #0f172a !important; display: flex; justify-content: space-between; align-items: center; gap: 12px; transition: all 0.15s; width: 100%; box-shadow: 0 1px 2px rgba(0,0,0,0.03);"
                >
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span style="font-weight: 700; font-size: 0.95rem; color: #0f172a !important;">{formatAccountLabel(c.compte)}</span>
                      <span style="font-size: 0.78rem; font-weight: 800; padding: 2px 8px; border-radius: 6px; background: {isSelected ? '#10b981' : '#d1fae5'}; color: {isSelected ? '#ffffff' : '#065f46'}; border: 1px solid #a7f3d0;">
                        Compte {c.compte}
                      </span>
                    </div>
                    {#if c.desc}
                      <div style="font-size: 0.82rem; color: #475569 !important; margin-top: 4px; line-height: 1.4;">
                        {c.desc}
                      </div>
                    {/if}
                  </div>
                  {#if isSelected}
                    <i class="fa-solid fa-circle-check" style="color: #10b981; font-size: 1.25rem; flex-shrink: 0;"></i>
                  {:else}
                    <i class="fa-regular fa-circle" style="color: #cbd5e1; font-size: 1.15rem; flex-shrink: 0;"></i>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Group 2: DÉPENSES COURANTES -->
        {#if filteredDepensesModal.length > 0}
          <div>
            <div style="color: #991b1b !important; font-weight: 800; font-size: 0.85rem; text-transform: uppercase; padding: 6px 12px; background: #fef2f2; border-left: 3px solid #ef4444; border-radius: 4px; margin-bottom: 8px; letter-spacing: 0.03em;">
              🔴 DÉPENSES COURANTES & FRAIS
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              {#each filteredDepensesModal as c}
                {@const isSelected = (selectedCategoryMap[selectedTxForCategorization.id] || selectedTxForCategorization.compteAttribué) === c.compte}
                <button 
                  type="button"
                  onclick={() => {
                    selectedCategoryMap[selectedTxForCategorization.id] = c.compte;
                  }}
                  style="text-align: left; padding: 12px 16px; border-radius: 10px; cursor: pointer; border: 1.5px solid {isSelected ? '#ef4444' : '#e2e8f0'}; background: {isSelected ? '#fef2f2' : '#ffffff'}; color: #0f172a !important; display: flex; justify-content: space-between; align-items: center; gap: 12px; transition: all 0.15s; width: 100%; box-shadow: 0 1px 2px rgba(0,0,0,0.03);"
                >
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span style="font-weight: 700; font-size: 0.95rem; color: #0f172a !important;">{c.libelle}</span>
                      <span style="font-size: 0.78rem; font-weight: 800; padding: 2px 8px; border-radius: 6px; background: {isSelected ? '#ef4444' : '#fee2e2'}; color: {isSelected ? '#ffffff' : '#991b1b'}; border: 1px solid #fca5a5;">
                        Compte {c.compte}
                      </span>
                    </div>
                    {#if c.desc}
                      <div style="font-size: 0.82rem; color: #475569 !important; margin-top: 4px; line-height: 1.4;">
                        {c.desc}
                      </div>
                    {/if}
                  </div>
                  {#if isSelected}
                    <i class="fa-solid fa-circle-check" style="color: #ef4444; font-size: 1.25rem; flex-shrink: 0;"></i>
                  {:else}
                    <i class="fa-regular fa-circle" style="color: #cbd5e1; font-size: 1.15rem; flex-shrink: 0;"></i>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Group 3: ÉQUIPE & INTERVENANTS -->
        {#if filteredEquipeModal.length > 0}
          <div>
            <div style="color: #6b21a8 !important; font-weight: 800; font-size: 0.85rem; text-transform: uppercase; padding: 6px 12px; background: #f3e8ff; border-left: 3px solid #a855f7; border-radius: 4px; margin-bottom: 8px; letter-spacing: 0.03em;">
              👥 ÉQUIPE & INTERVENANTS
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              {#each filteredEquipeModal as c}
                {@const isSelected = (selectedCategoryMap[selectedTxForCategorization.id] || selectedTxForCategorization.compteAttribué) === c.compte}
                <button 
                  type="button"
                  onclick={() => {
                    selectedCategoryMap[selectedTxForCategorization.id] = c.compte;
                  }}
                  style="text-align: left; padding: 12px 16px; border-radius: 10px; cursor: pointer; border: 1.5px solid {isSelected ? '#a855f7' : '#e2e8f0'}; background: {isSelected ? '#f3e8ff' : '#ffffff'}; color: #0f172a !important; display: flex; justify-content: space-between; align-items: center; gap: 12px; transition: all 0.15s; width: 100%; box-shadow: 0 1px 2px rgba(0,0,0,0.03);"
                >
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span style="font-weight: 700; font-size: 0.95rem; color: #0f172a !important;">{c.libelle}</span>
                      <span style="font-size: 0.78rem; font-weight: 800; padding: 2px 8px; border-radius: 6px; background: {isSelected ? '#a855f7' : '#f3e8ff'}; color: {isSelected ? '#ffffff' : '#6b21a8'}; border: 1px solid #e9d5ff;">
                        Compte {c.compte}
                      </span>
                    </div>
                    {#if c.desc}
                      <div style="font-size: 0.82rem; color: #475569 !important; margin-top: 4px; line-height: 1.4;">
                        {c.desc}
                      </div>
                    {/if}
                  </div>
                  {#if isSelected}
                    <i class="fa-solid fa-circle-check" style="color: #a855f7; font-size: 1.25rem; flex-shrink: 0;"></i>
                  {:else}
                    <i class="fa-regular fa-circle" style="color: #cbd5e1; font-size: 1.15rem; flex-shrink: 0;"></i>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Group 4: COMPTES & TRANSFERTS -->
        {#if filteredTransfertsModal.length > 0}
          <div>
            <div style="color: #1e40af !important; font-weight: 800; font-size: 0.85rem; text-transform: uppercase; padding: 6px 12px; background: #eff6ff; border-left: 3px solid #3b82f6; border-radius: 4px; margin-bottom: 8px; letter-spacing: 0.03em;">
              🔄 COMPTES & TRANSFERTS
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              {#each filteredTransfertsModal as c}
                {@const isSelected = (selectedCategoryMap[selectedTxForCategorization.id] || selectedTxForCategorization.compteAttribué) === c.compte}
                <button 
                  type="button"
                  onclick={() => {
                    selectedCategoryMap[selectedTxForCategorization.id] = c.compte;
                  }}
                  style="text-align: left; padding: 12px 16px; border-radius: 10px; cursor: pointer; border: 1.5px solid {isSelected ? '#3b82f6' : '#e2e8f0'}; background: {isSelected ? '#eff6ff' : '#ffffff'}; color: #0f172a !important; display: flex; justify-content: space-between; align-items: center; gap: 12px; transition: all 0.15s; width: 100%; box-shadow: 0 1px 2px rgba(0,0,0,0.03);"
                >
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span style="font-weight: 700; font-size: 0.95rem; color: #0f172a !important;">{c.libelle}</span>
                      <span style="font-size: 0.78rem; font-weight: 800; padding: 2px 8px; border-radius: 6px; background: {isSelected ? '#3b82f6' : '#dbeafe'}; color: {isSelected ? '#ffffff' : '#1e40af'}; border: 1px solid #bfdbfe;">
                        Compte {c.compte}
                      </span>
                    </div>
                    {#if c.desc}
                      <div style="font-size: 0.82rem; color: #475569 !important; margin-top: 4px; line-height: 1.4;">
                        {c.desc}
                      </div>
                    {/if}
                  </div>
                  {#if isSelected}
                    <i class="fa-solid fa-circle-check" style="color: #3b82f6; font-size: 1.25rem; flex-shrink: 0;"></i>
                  {:else}
                    <i class="fa-regular fa-circle" style="color: #cbd5e1; font-size: 1.15rem; flex-shrink: 0;"></i>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}

      </div>

      <!-- Modal Footer Actions -->
      <div style="display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
        <button type="button" class="btn btn-secondary" onclick={() => showCategorizeModal = false} style="padding: 10px 18px; border-radius: 8px; color: #475569 !important; background: #f1f5f9; border: 1px solid #cbd5e1;">Annuler</button>
        <button 
          type="button" 
          class="btn btn-primary" 
          onclick={() => {
            validerLigneSeule(selectedTxForCategorization);
            showCategorizeModal = false;
          }}
          style="padding: 10px 22px; font-weight: 700; background: #0f172a; color: #ffffff; border: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px;"
        >
          <i class="fa-solid fa-check"></i> Valider l'attribution
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
