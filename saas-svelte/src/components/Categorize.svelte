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
    showToast 
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

      // Assign IDs and defaults to parsed transactions
      const newTxList = parsed.map((t, idx) => ({
        id: `imported_${Date.now()}_${idx}`,
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

      // Categorize using rules & dictionary
      const recatted = Categorizer.categoriserTransactions([...newTxList, ...$transactions]);
      updateTransactions(recatted);
      showToast(`✅ ${newTxList.length} opération(s) importée(s) avec succès depuis "${file.name}" !`);
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

  onMount(() => {
    const hideModal = localStorage.getItem("hide_categorize_pedagogical_modal");
    if (!hideModal) {
      showPedagogicalModal = true;
    }
  });

  function closePedagogicalModal() {
    if (dontShowAgain) {
      localStorage.setItem("hide_categorize_pedagogical_modal", "true");
    }
    showPedagogicalModal = false;
  }

  /** @param {any} tx */
  function getSuggestionForTx(tx) {
    if (!tx) return null;
    const sug = Categorizer.obtenirSuggestionDictionnaire(tx);
    if (!sug) return null;
    return {
      compte: sug.compte,
      label: formatAccountLabel(sug.compte)
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
      showToast("↩️ Attribution annulée avec succès !");
    }
  }

  // Reactive transaction lists
  let nonTriees = $derived($transactions.filter((t) => t.compteAttribué === "699" || t.statut === "non_attribue" || t.statut === "suggere"));
  let triees = $derived($transactions.filter((t) => t.compteAttribué !== "699" && t.statut === "attribue"));
  let displayedTxList = $derived(activeTab === "pending" ? nonTriees : triees);

  // Auto-recognized transactions ready for 1-click batch validation
  let recognizedList = $derived(
    nonTriees.filter(t => t.statut === 'suggere' || t.autoRecognized)
  );

  let totalRecognizedAmount = $derived(
    recognizedList.reduce((sum, t) => sum + (t.credit > 0 ? t.credit : t.debit), 0)
  );

  // Formatted Label Helper: "Nom de la catégorie (Code)"
  /** @param {string|number} [numCompte] */
  function formatAccountLabel(numCompte) {
    if (!numCompte || String(numCompte) === '699') return '« Choisir une catégorie... »';
    const cpt = $planComptable.find(p => p.compte === String(numCompte));
    if (!cpt) return `Compte (${numCompte})`;
    return cpt.libelle.replace(/\s*\(\d+\)\s*/g, '').trim();
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
        const targetCategory = selectedCategoryMap[tx.id] || tx.compteAttribué || (tx.credit > 0 ? '756' : '606');

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
      showToast(`✅ Écriture attribuée au compte ${targetCategory} !`);
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
    showToast(`✅ ${idsToAssign.size} opérations attribuées au compte ${targetSimilarCategory} !`);
    
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
    <h1 class="page-title" style="margin: 0; font-size: 1.4rem; font-weight: 800; color: var(--text-main);">Espace d'attribution des libellés</h1>
    <p class="page-subtitle" style="margin: 4px 0 0 0; font-size: 0.86rem; color: var(--text-muted);">Associez chaque mouvement bancaire à son numéro de compte comptable. La machine apprend automatiquement de vos choix !</p>
  </div>

  <div style="display: flex; gap: 10px; align-items: center;">
    {#if lastStateTransactions}
      <button class="btn btn-secondary btn-sm" onclick={annulerDerniereAction} style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.25); display: flex; align-items: center; gap: 6px;">
        <i class="fa-solid fa-rotate-left"></i> Annuler le dernier tri
      </button>
    {/if}
  </div>
</div>

<!-- Zone d'Import CSV sous le titre -->
<div style="background: {dragover ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-card)'}; border: 2px dashed {dragover ? '#6366f1' : 'var(--border-color)'}; border-radius: var(--radius-md); padding: 16px 24px; margin-bottom: 20px; transition: all 0.2s; box-shadow: var(--shadow-sm);">
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div 
    class="dropzone {dragover ? 'dragover' : ''}" 
    onclick={() => fileInput && fileInput.click()}
    ondragenter={(e) => { e.preventDefault(); e.stopPropagation(); dragover = true; }}
    ondragover={(e) => { e.preventDefault(); e.stopPropagation(); dragover = true; }}
    ondragleave={(e) => { e.preventDefault(); e.stopPropagation(); dragover = false; }}
    ondrop={handleCSVDrop}
    style="cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 16px; padding: 6px 0;"
  >
    <div style="width: 44px; height: 44px; border-radius: 50%; background: rgba(99, 102, 241, 0.12); color: #6366f1; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; flex-shrink: 0; pointer-events: none;">
      <i class="fa-solid fa-cloud-arrow-up"></i>
    </div>
    <div style="text-align: left; pointer-events: none;">
      <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">
        Faites glisser votre fichier bancaire CSV ici <span style="font-weight: 400; color: var(--text-muted); font-size: 0.85rem;">ou cliquez pour parcourir vos fichiers</span>
      </div>
      <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
        Supporte les formats CSV bancaires standard (Crédit Agricole, BNP, BoursoBank, Qonto, Shine, Revolut, etc.)
      </div>
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

<div style="display: block; width: 100%; margin-top: 10px;">
  <div class="card" style="padding: 24px; width: 100%;">
    
    <!-- Filter Tabs + Compact Batch Validation Button & Help ? Button -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 15px; width: 100%;">
      <div style="display: flex; gap: 6px; background: #f1f5f9; padding: 4px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
        <button
          style="border: none; background: {activeTab === 'pending' ? '#0f172a' : 'transparent'}; color: {activeTab === 'pending' ? '#ffffff' : '#475569'}; font-size: 0.88rem; padding: 8px 20px; border-radius: var(--radius-sm); cursor: pointer; font-weight: 700; transition: all 0.2s;"
          onclick={() => (activeTab = "pending")}
        >
          À attribuer ({nonTriees.length})
        </button>
        <button
          style="border: none; background: {activeTab === 'categorized' ? '#0f172a' : 'transparent'}; color: {activeTab === 'categorized' ? '#ffffff' : '#475569'}; font-size: 0.88rem; padding: 8px 20px; border-radius: var(--radius-sm); cursor: pointer; font-weight: 700; transition: all 0.2s;"
          onclick={() => (activeTab = "categorized")}
        >
          Attribuées ({triees.length})
        </button>
      </div>

      <!-- Action par lot réduite & bouton d'aide ? -->
      <div style="display: flex; align-items: center; gap: 8px;">
        <button 
          class="btn btn-primary"
          onclick={validerToutEnUnClic}
          disabled={recognizedList.length === 0}
          style="padding: 9px 18px; font-size: 0.88rem; font-weight: 700; background: #16a34a; color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; display: flex; align-items: center; gap: 8px; opacity: {recognizedList.length === 0 ? 0.6 : 1}; box-shadow: 0 2px 4px rgba(22, 163, 74, 0.2);"
        >
          <i class="fa-solid fa-bolt"></i>
          Tout valider ({recognizedList.length} suggestions IA)
        </button>

        <button 
          type="button"
          class="btn btn-icon"
          onclick={() => (showPedagogicalModal = true)}
          title="Aide & explications"
          aria-label="Aide et explications"
          style="width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-main); font-weight: 800; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.08);"
        >
          ?
        </button>
      </div>
    </div>

    <!-- Batch Table -->
    <div class="table-container" style="width: 100%;">
      <table class="custom-table" style="width: 100%;">
        <thead>
          <tr>
            <th style="width: 10%;">Date</th>
            <th style="width: 30%;">Libellé</th>
            <th style="width: 14%; text-align: right;">Montant</th>
            <th style="width: 36%;">Catégorie / Attribution</th>
            <th style="width: 10%; text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          {#if displayedTxList.length === 0}
            <tr>
              <td colspan="5" style="text-align: center; color: var(--color-success); padding: 50px 10px;">
                <i class="fa-solid fa-circle-check" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.8; display: block;"></i>
                <strong>{activeTab === "pending" ? "Toutes les écritures sont attribuées !" : "Aucune écriture attribuée"}</strong>
              </td>
            </tr>
          {:else if activeTab === "pending"}
            {#each nonTriees as tx}
              {@const sug = getSuggestionForTx(tx)}
              {@const manualCat = selectedCategoryMap[tx.id]}
              {@const isStateA = Boolean(sug) && !manualCat}
              {@const isStateC = Boolean(manualCat)}
              {@const isStateB = !isStateA && !isStateC}

              <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08); transition: background 0.2s;">
                
                <!-- 1. Date (Format court DD/MM/YY) -->
                <td style="padding: 14px 12px; vertical-align: middle; font-weight: 600; font-size: 0.88rem; color: var(--text-muted); white-space: nowrap;">
                  {tx.date ? new Date(tx.date).toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''}
                </td>

                <!-- 2. Libellé épuré -->
                <td style="padding: 14px 12px; vertical-align: middle;" title="{tx.libelle} {tx.info ? `• ${tx.info}` : ''} {tx.reference ? `• Ref: ${tx.reference}` : ''}">
                  <div style="font-weight: 700; color: var(--text-main); font-size: 0.93rem;">
                    {cleanTransactionLibelle(tx.libelle)}
                  </div>
                  <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 1px;">
                    {tx.typeOperation || (tx.libelle.includes('PRLV') ? 'Prélèvement SEPA' : tx.libelle.includes('VIR') ? 'Virement' : 'Carte bancaire')}
                  </div>
                </td>

                <!-- 3. Montant (Directement après le Libellé) -->
                <td style="padding: 14px 12px; vertical-align: middle; text-align: right; font-size: 0.95rem; font-weight: 700; font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; color: {tx.debit > 0 ? '#b91c1c' : '#15803d'}; white-space: nowrap;">
                  {tx.debit > 0 ? "- " : "+ "}
                  {(Number(tx.debit || tx.credit || 0)).toFixed(2).replace('.', ',')} €
                </td>

                <!-- 4. Catégorie / Attribution -->
                <td style="padding: 14px 12px; vertical-align: middle;">
                  {#if isStateA && sug}
                    <!-- ÉTAT A : Suggestion IA (Label suggestion + Bouton Modifier) -->
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span style="font-weight: 700; font-size: 0.88rem; color: #166534; background: #f0fdf4; border: 1.5px solid #bbf7d0; padding: 6px 12px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-wand-magic-sparkles" style="color: #16a34a;"></i>
                        ✨ {sug.label} ({sug.compte})
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
                        ✔️ {formatAccountLabel(manualCat)} ({manualCat})
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
                      style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 8px; border: 1.5px solid #cbd5e1; background: #ffffff; color: #334155; font-weight: 700; font-size: 0.88rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.04);"
                    >
                      <i class="fa-solid fa-magnifying-glass" style="color: #6366f1;"></i>
                      Attribution manuelle
                    </button>
                  {/if}
                </td>

                <!-- 5. Action (Bouton "Valider" explicite avec texte si une suggestion/choix existe) -->
                <td style="padding: 14px 12px; vertical-align: middle; text-align: right;">
                  {#if (isStateA && sug) || isStateC}
                    <button 
                      type="button"
                      onclick={() => {
                        if (isStateA && sug) selectAccount(tx.id, sug.compte);
                        validerLigneSeule(tx);
                      }}
                      title="Valider l'attribution"
                      aria-label="Valider l'attribution"
                      style="padding: 7px 16px; font-weight: 700; font-size: 0.85rem; background: #16a34a; color: #ffffff; border: none; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(22, 163, 74, 0.25);"
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
                <td style="padding: 14px 12px; font-weight: 600; font-size: 0.88rem; color: var(--text-muted); white-space: nowrap;">
                  {tx.date ? new Date(tx.date).toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''}
                </td>
                <td style="padding: 14px 12px;">
                  <div style="font-weight: 700; color: #0f172a;">{cleanTransactionLibelle(tx.libelle)}</div>
                  <div style="font-size: 0.75rem; color: #64748b; margin-top: 1px;">
                    {tx.typeOperation || (tx.libelle.includes('PRLV') ? 'Prélèvement SEPA' : tx.libelle.includes('VIR') ? 'Virement' : 'Carte bancaire')}
                  </div>
                </td>
                <td style="padding: 14px 12px; text-align: right; font-weight: 700; font-size: 0.95rem; font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; color: {tx.debit > 0 ? '#b91c1c' : '#15803d'}; white-space: nowrap;">
                  {tx.debit > 0 ? "- " : "+ "}
                  {(Number(tx.debit || tx.credit || 0)).toFixed(2).replace('.', ',')} €
                </td>
                <td style="padding: 14px 12px; color: #3730a3; font-weight: 700;">
                  <span style="display: inline-flex; align-items: center; gap: 6px; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; padding: 6px 12px; border-radius: 8px; font-size: 0.88rem;">
                    <i class="fa-solid fa-circle-check" style="color: #16a34a;"></i>
                    {formatAccountLabel(tx.compteAttribué)} ({tx.compteAttribué})
                  </span>
                </td>
                <td style="padding: 14px 12px; text-align: right;">
                  <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; color: #15803d; background: #dcfce7; border: 1px solid #86efac; padding: 3px 8px; border-radius: 6px; font-weight: 700;">
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

<!-- Pedagogical Onboarding Modal -->
{#if showPedagogicalModal}
  <div class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;">
    <div class="glass-card" style="width: 100%; max-width: 520px; padding: 28px; border: 1.5px solid rgba(129, 140, 248, 0.4); box-shadow: 0 25px 50px rgba(0,0,0,0.6); background: #0f172a; border-radius: 18px; color: #ffffff;">
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 14px;">
        <h3 style="margin: 0; font-size: 1.25rem; font-family: var(--font-title); color: white; display: flex; align-items: center; gap: 10px; font-weight: 800;">
          🏷️ Comment trier vos opérations ?
        </h3>
        <button onclick={closePedagogicalModal} style="background: none; border: none; color: rgba(255, 255, 255, 0.5); font-size: 1.3rem; cursor: pointer;">✕</button>
      </div>

      <div style="color: rgba(255, 255, 255, 0.9); font-size: 0.95rem; line-height: 1.6; margin-bottom: 24px; display: flex; flex-direction: column; gap: 14px;">
        <p style="margin: 0; font-weight: 600; color: #cbd5e1;">
          Sélectionnez simplement ce que représente chaque ligne <span style="color: #818cf8;">(ex: Logiciel, Repas, Matériel, Cotisation...)</span>.
        </p>

        <div style="background: rgba(99, 102, 241, 0.12); border-left: 4px solid #6366f1; padding: 14px 16px; border-radius: 8px; display: flex; flex-direction: column; gap: 8px;">
          <div style="font-weight: 700; color: #a5b4fc; font-size: 0.88rem; text-transform: uppercase; letter-spacing: 0.04em;">
            ⚡ Le système fait le reste :
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
          showToast(`✅ Écriture seule attribuée au compte ${targetSimilarCategory} !`);
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
                      <span style="font-weight: 700; font-size: 0.95rem; color: #0f172a !important;">{c.libelle}</span>
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
