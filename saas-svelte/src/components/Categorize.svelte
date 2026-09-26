<script>
  import { Categorizer } from "../lib/categorizer.js";

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
    <h1 class="page-title" style="margin: 0; font-size: 1.4rem; font-weight: 800; color: var(--text-main);">Attribuer les numéros de compte aux libellés</h1>
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

<!-- Master Batch Header Metrics & Action Button -->
<div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px 24px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; box-shadow: var(--shadow-card);">
  <div>
    <div style="font-size: 0.85rem; color: #4338ca; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
      🤖 Reconnaissance Intelligente des Écritures
    </div>
    <div style="font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin-top: 4px;">
      {#if recognizedList.length > 0}
        {recognizedList.length} écriture(s) identifiée(s) avec certitude ({totalRecognizedAmount.toFixed(2)} €)
      {:else}
        {nonTriees.length} opération(s) prêtes à être catégorisées en 1 clic
      {/if}
    </div>
  </div>

  <button 
    class="btn btn-primary"
    onclick={validerToutEnUnClic}
    disabled={recognizedList.length === 0}
    style="padding: 12px 24px; font-size: 0.95rem; font-weight: 700; background: var(--color-primary); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; display: flex; align-items: center; gap: 10px; transition: all 0.2s;"
  >
    <i class="fa-solid fa-check-double"></i>
    Tout valider par lot ({recognizedList.length} identifiées)
  </button>
</div>

<div style="display: block; width: 100%; margin-top: 24px;">
  <div class="card" style="padding: 24px; width: 100%;">
    
    <!-- Filter Tabs -->
    <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 15px; width: 100%;">
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
    </div>

    <!-- Batch Table -->
    <div class="table-container" style="width: 100%;">
      <table class="custom-table" style="width: 100%;">
        <thead>
          <tr>
            <th style="width: 45%;">Opération brute (CSV)</th>
            <th style="width: 38%;">Attribution proposée (Compte)</th>
            <th style="width: 17%; text-align: right;">Statut & Action</th>
          </tr>
        </thead>
        <tbody>
          {#if displayedTxList.length === 0}
            <tr>
              <td colspan="3" style="text-align: center; color: var(--color-success); padding: 50px 10px;">
                <i class="fa-solid fa-circle-check" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.8; display: block;"></i>
                <strong>{activeTab === "pending" ? "Toutes les écritures sont attribuées !" : "Aucune écriture attribuée"}</strong>
              </td>
            </tr>
          {:else if activeTab === "pending"}
            {#each nonTriees as tx}
              {@const isRecognized = tx.statut === 'suggere' || tx.autoRecognized}
              {@const currentCat = selectedCategoryMap[tx.id] || tx.compteAttribué || (tx.credit > 0 ? '756' : '606')}

              <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: {isRecognized ? 'rgba(16, 185, 129, 0.03)' : 'transparent'}; transition: background 0.2s;">
                
                <!-- 1. Opération brute CSV -->
                <td style="padding: 16px 14px; vertical-align: middle;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
                    <div>
                      <div style="font-weight: 600; color: var(--text-main); font-size: 0.95rem;">{tx.libelle}</div>
                      {#if tx.info || tx.reference}
                                          <!-- Suggestion IA intelligente -->
                  {#if getSuggestionForTx(tx)}
                    {@const sug = getSuggestionForTx(tx)}
                    {#if sug}
                      <div style="margin-top: 6px; display: inline-flex; align-items: center; gap: 6px; background: var(--color-accent-light); border: 1px solid var(--border-color); padding: 4px 10px; border-radius: 6px; font-size: 0.78rem;">
                        <span style="color: var(--color-accent); font-weight: 700; display: flex; align-items: center; gap: 4px;">
                          <i class="fa-solid fa-brain" style="color: var(--color-accent);"></i> Suggestion IA :
                        </span>
                        <span style="color: var(--text-main); font-weight: 600;">{sug?.label}</span>
                        <button 
                          type="button" 
                          class="btn" 
                          style="padding: 2px 8px; font-size: 0.72rem; background: var(--color-primary); color: white; border: none; border-radius: 4px; font-weight: 700; cursor: pointer;"
                          onclick={(e) => { e.stopPropagation(); if (sug?.compte) selectAccount(tx.id, sug.compte); }}
                        >
                          Valider
                        </button>
                      </div>
                    {/if}
                  {/if}
                  <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 3px;">
                          {tx.info} {tx.reference ? `• Ref: ${tx.reference}` : ''}
                        </div>
                      {/if}
                      <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                        {tx.date ? new Date(tx.date).toLocaleDateString("fr-FR") : ''} &bull; {tx.debit > 0 ? "Dépense" : "Recette"}
                      </div>
                    </div>
                    
                    <div style="font-size: 1.1rem; font-weight: 700; color: {tx.debit > 0 ? 'var(--color-danger)' : 'var(--color-success)'}; white-space: nowrap;">
                      {tx.debit > 0 ? "-" : "+"}
                      {(Number(tx.debit || tx.credit || 0)).toFixed(2)} €
                    </div>
                  </div>
                </td>

                <!-- 2. Attribution proposée (Compte) -->
                <td style="padding: 16px 14px; vertical-align: middle;">
                  <button
                    type="button"
                    onclick={() => openCategorizeModal(tx)}
                    style="display: flex; justify-content: space-between; align-items: center; width: 100%; text-align: left; background: var(--bg-screen); color: var(--text-main); border: 1px solid var(--border-color); padding: 9px 14px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.9rem; transition: all 0.2s;"
                  >
                    <span>
                      <i class="fa-solid fa-tag" style="color: var(--color-accent); margin-right: 6px;"></i>
                      {formatAccountLabel(currentCat)}
                    </span>
                    <i class="fa-solid fa-pen-to-square" style="font-size: 0.85rem; color: #a5b4fc;"></i>
                  </button>
                </td>

                <!-- 3. Statut & Action -->
                <td style="padding: 16px 14px; vertical-align: middle; text-align: right;">
                  <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                    {#if isRecognized}
                      <span class="badge" style="background: #dcfce7; color: #15803d; border: 1px solid #86efac; font-size: 0.75rem; padding: 4px 10px; font-weight: 700;">
                        🟢 Reconnu automatiquement
                      </span>
                    {:else}
                      <span class="badge" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-size: 0.75rem; padding: 4px 10px; font-weight: 700;">
                        🟡 À vérifier
                      </span>
                    {/if}

                    <button 
                      class="btn btn-primary btn-sm"
                      onclick={() => validerLigneSeule(tx)}
                      style="padding: 7px 16px; font-weight: 700; font-size: 0.88rem; background: #0f172a; color: #ffffff;"
                    >
                      <i class="fa-solid fa-check"></i> Valider
                    </button>
                  </div>
                </td>

              </tr>
            {/each}
          {:else}
            <!-- Categorized List -->
            {#each triees as tx}
              <tr style="border-bottom: 1px solid #f1f5f9; background: #ffffff;">
                <td style="padding: 14px 12px;">
                  <div style="font-weight: 700; color: #0f172a;">{tx.libelle}</div>
                  <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">
                    {tx.date ? new Date(tx.date).toLocaleDateString("fr-FR") : ''} &bull; Règle : {tx.regleAppliquee || 'Manuelle'}
                  </div>
                </td>
                <td style="padding: 14px 12px; color: #3730a3; font-weight: 700;">
                  {tx.compteAttribué} - {Categorizer.obtenirLibelleCompte(tx.compteAttribué)}
                </td>
                <td style="padding: 14px 12px; text-align: right; font-weight: 800; color: {tx.debit > 0 ? '#b91c1c' : '#15803d'};">
                  {tx.debit > 0 ? "-" : "+"}
                  {(Number(tx.debit || tx.credit || 0)).toFixed(2)} €
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
  <div class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;">
    <div class="glass-card" style="width: 100%; max-width: 580px; padding: 30px; border: 1.5px solid rgba(129, 140, 248, 0.5); box-shadow: 0 25px 60px rgba(0,0,0,0.8); background: #11131e; border-radius: 16px;">
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 15px;">
        <h3 style="margin: 0; font-size: 1.3rem; font-family: var(--font-title); color: white; display: flex; align-items: center; gap: 10px;">
          <i class="fa-solid fa-graduation-cap" style="color: #818cf8; font-size: 1.4rem;"></i>
          Attribution de libellé
        </h3>
        <button onclick={closePedagogicalModal} style="background: none; border: none; color: rgba(255, 255, 255, 0.6); font-size: 1.4rem; cursor: pointer;">✕</button>
      </div>

      <div style="color: rgba(255, 255, 255, 0.9); font-size: 0.95rem; line-height: 1.6; margin-bottom: 25px;">
        <p style="margin-top: 0; margin-bottom: 14px;">
          Dites-nous simplement s'il s'agit d'un abonnement logiciel, d'un repas, d'un achat de matériel ou d'une cotisation. Le système se charge d'attribuer les codes comptables officiels pour vous sans aucun jargon.
        </p>

        <p style="font-weight: 700; color: #a5b4fc; font-size: 1.05rem; margin-bottom: 10px;">
          À vous de jouer.
        </p>

        <p style="margin-bottom: 14px;">
          C'est simple, pour chaque opération, confirmez la suggestion affichée ou choisissez la catégorie correspondante.
        </p>

        <p style="margin-bottom: 0; background: rgba(99, 102, 241, 0.12); border-left: 4px solid #6366f1; padding: 12px 14px; border-radius: 6px; color: rgba(255, 255, 255, 0.85); font-size: 0.9rem;">
          💡 <strong>Rassurez-vous</strong> : le système apprend au fur et à mesure de vos choix et enregistre vos habitudes. Vous n'aurez presque plus rien à trier lors de vos prochains imports.
        </p>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 18px;">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: rgba(255, 255, 255, 0.7); font-size: 0.85rem;">
          <input type="checkbox" bind:checked={dontShowAgain} style="width: 16px; height: 16px; accent-color: #6366f1;" />
          Ne plus afficher, j'ai compris !
        </label>

        <button 
          class="btn btn-primary" 
          onclick={closePedagogicalModal}
          style="padding: 10px 24px; font-weight: 600; background: #6366f1; border: none; border-radius: 8px; font-size: 0.95rem; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);"
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
  <div class="modal-backdrop" onclick={() => showCategorizeModal = false} role="presentation" style="position: fixed; inset: 0; background: rgba(5, 7, 15, 0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 100000; padding: 20px;">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
    <div class="glass-card modal-content" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1" style="max-width: 680px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; background: #11131e; border: 1.5px solid rgba(129, 140, 248, 0.4); border-radius: 16px; padding: 24px; box-shadow: 0 25px 60px rgba(0,0,0,0.9);">
      
      <!-- Modal Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 14px;">
        <div>
          <h3 style="margin: 0; font-family: var(--font-title); font-size: 1.25rem; color: white; display: flex; align-items: center; gap: 10px;">
            <i class="fa-solid fa-tags" style="color: #818cf8;"></i> Attribuer un compte comptable
          </h3>
          <div style="font-size: 0.8rem; color: rgba(255, 255, 255, 0.5); margin-top: 2px;">
            Sélectionnez la catégorie comptable exacte pour ce mouvement bancaire
          </div>
        </div>
        <button type="button" onclick={() => showCategorizeModal = false} style="background: none; border: none; color: rgba(255,255,255,0.6); font-size: 1.4rem; cursor: pointer;">✕</button>
      </div>

      <!-- Transaction Card Summary -->
      <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 14px 18px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
          <div>
            <div style="font-weight: 700; color: white; font-size: 1.05rem;">{selectedTxForCategorization.libelle}</div>
            <div style="font-size: 0.78rem; color: rgba(255,255,255,0.5); margin-top: 2px;">
              {selectedTxForCategorization.date ? new Date(selectedTxForCategorization.date).toLocaleDateString("fr-FR") : ''} &bull; {selectedTxForCategorization.debit > 0 ? "Dépense" : "Recette"}
              {selectedTxForCategorization.reference ? ` • Ref: ${selectedTxForCategorization.reference}` : ''}
            </div>
          </div>
          <div style="font-weight: 800; font-size: 1.2rem; color: {selectedTxForCategorization.debit > 0 ? '#f87171' : '#34d399'};">
            {selectedTxForCategorization.debit > 0 ? "-" : "+"}
            {(Number(selectedTxForCategorization.debit || selectedTxForCategorization.credit || 0)).toFixed(2)} €
          </div>
        </div>

        <!-- AI Suggestion if available -->
        {#if getSuggestionForTx(selectedTxForCategorization)}
          {@const sug = getSuggestionForTx(selectedTxForCategorization)}
          {#if sug}
            <div style="margin-top: 10px; display: flex; align-items: center; justify-content: space-between; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.35); padding: 8px 12px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem;">
                <i class="fa-solid fa-brain" style="color: #818cf8;"></i>
                <span style="color: #a5b4fc; font-weight: 700;">Suggestion IA :</span>
                <strong style="color: white;">{sug?.label}</strong>
              </div>
              <button 
                type="button" 
                class="btn" 
                style="padding: 4px 12px; font-size: 0.8rem; background: #6366f1; color: white; border: none; border-radius: 6px; font-weight: 700; cursor: pointer;"
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
      <div style="margin-bottom: 12px;">
        <input 
          type="text" 
          placeholder="🔍 Filtrer les catégories (ex: Cotisations, Logiciels, Loyers, Matériel...)" 
          bind:value={modalSearchQuery}
          style="width: 100%; padding: 10px 14px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; color: white; font-size: 0.88rem;"
        />
      </div>

      <!-- Category Groups List -->
      <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding-right: 4px; margin-bottom: 16px;">
        
        <!-- Group 1: ENTRÉES D'ARGENT -->
        {#if filteredEntreesModal.length > 0}
          <div>
            <div style="color: #4ade80; font-weight: 800; font-size: 0.85rem; text-transform: uppercase; padding: 6px 10px; background: rgba(16, 185, 129, 0.12); border-left: 3px solid #10b981; border-radius: 4px; margin-bottom: 6px;">
              🟢 ENTRÉES D'ARGENT
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px;">
              {#each filteredEntreesModal as c}
                {@const isSelected = (selectedCategoryMap[selectedTxForCategorization.id] || selectedTxForCategorization.compteAttribué) === c.compte}
                <button 
                  type="button"
                  onclick={() => {
                    selectedCategoryMap[selectedTxForCategorization.id] = c.compte;
                  }}
                  style="text-align: left; padding: 10px 14px; border-radius: 8px; cursor: pointer; border: 1px solid {isSelected ? '#10b981' : 'rgba(255,255,255,0.08)'}; background: {isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.03)'}; color: white; display: flex; justify-content: space-between; align-items: center; transition: all 0.15s;"
                >
                  <div>
                    <div style="font-weight: 600; font-size: 0.88rem;">{c.libelle}</div>
                    <div style="font-size: 0.75rem; color: #a5b4fc;">Compte {c.compte}</div>
                  </div>
                  {#if isSelected}
                    <i class="fa-solid fa-circle-check" style="color: #34d399; font-size: 1.1rem;"></i>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Group 2: DÉPENSES COURANTES -->
        {#if filteredDepensesModal.length > 0}
          <div>
            <div style="color: #fca5a5; font-weight: 800; font-size: 0.85rem; text-transform: uppercase; padding: 6px 10px; background: rgba(239, 68, 68, 0.12); border-left: 3px solid #ef4444; border-radius: 4px; margin-bottom: 6px;">
              🔴 DÉPENSES COURANTES
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px;">
              {#each filteredDepensesModal as c}
                {@const isSelected = (selectedCategoryMap[selectedTxForCategorization.id] || selectedTxForCategorization.compteAttribué) === c.compte}
                <button 
                  type="button"
                  onclick={() => {
                    selectedCategoryMap[selectedTxForCategorization.id] = c.compte;
                  }}
                  style="text-align: left; padding: 10px 14px; border-radius: 8px; cursor: pointer; border: 1px solid {isSelected ? '#ef4444' : 'rgba(255,255,255,0.08)'}; background: {isSelected ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.03)'}; color: white; display: flex; justify-content: space-between; align-items: center; transition: all 0.15s;"
                >
                  <div>
                    <div style="font-weight: 600; font-size: 0.88rem;">{c.libelle}</div>
                    <div style="font-size: 0.75rem; color: #a5b4fc;">Compte {c.compte}</div>
                  </div>
                  {#if isSelected}
                    <i class="fa-solid fa-circle-check" style="color: #f87171; font-size: 1.1rem;"></i>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Group 3: ÉQUIPE & INTERVENANTS -->
        {#if filteredEquipeModal.length > 0}
          <div>
            <div style="color: #c084fc; font-weight: 800; font-size: 0.85rem; text-transform: uppercase; padding: 6px 10px; background: rgba(168, 85, 247, 0.12); border-left: 3px solid #a855f7; border-radius: 4px; margin-bottom: 6px;">
              👥 ÉQUIPE & INTERVENANTS
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px;">
              {#each filteredEquipeModal as c}
                {@const isSelected = (selectedCategoryMap[selectedTxForCategorization.id] || selectedTxForCategorization.compteAttribué) === c.compte}
                <button 
                  type="button"
                  onclick={() => {
                    selectedCategoryMap[selectedTxForCategorization.id] = c.compte;
                  }}
                  style="text-align: left; padding: 10px 14px; border-radius: 8px; cursor: pointer; border: 1px solid {isSelected ? '#a855f7' : 'rgba(255,255,255,0.08)'}; background: {isSelected ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.03)'}; color: white; display: flex; justify-content: space-between; align-items: center; transition: all 0.15s;"
                >
                  <div>
                    <div style="font-weight: 600; font-size: 0.88rem;">{c.libelle}</div>
                    <div style="font-size: 0.75rem; color: #a5b4fc;">Compte {c.compte}</div>
                  </div>
                  {#if isSelected}
                    <i class="fa-solid fa-circle-check" style="color: #c084fc; font-size: 1.1rem;"></i>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Group 4: COMPTES & TRANSFERTS -->
        {#if filteredTransfertsModal.length > 0}
          <div>
            <div style="color: #93c5fd; font-weight: 800; font-size: 0.85rem; text-transform: uppercase; padding: 6px 10px; background: rgba(59, 130, 246, 0.12); border-left: 3px solid #3b82f6; border-radius: 4px; margin-bottom: 6px;">
              🔄 COMPTES & TRANSFERTS
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px;">
              {#each filteredTransfertsModal as c}
                {@const isSelected = (selectedCategoryMap[selectedTxForCategorization.id] || selectedTxForCategorization.compteAttribué) === c.compte}
                <button 
                  type="button"
                  onclick={() => {
                    selectedCategoryMap[selectedTxForCategorization.id] = c.compte;
                  }}
                  style="text-align: left; padding: 10px 14px; border-radius: 8px; cursor: pointer; border: 1px solid {isSelected ? '#3b82f6' : 'rgba(255,255,255,0.08)'}; background: {isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)'}; color: white; display: flex; justify-content: space-between; align-items: center; transition: all 0.15s;"
                >
                  <div>
                    <div style="font-weight: 600; font-size: 0.88rem;">{c.libelle}</div>
                    <div style="font-size: 0.75rem; color: #a5b4fc;">Compte {c.compte}</div>
                  </div>
                  {#if isSelected}
                    <i class="fa-solid fa-circle-check" style="color: #60a5fa; font-size: 1.1rem;"></i>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}

      </div>

      <!-- Modal Footer Actions -->
      <div style="display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 16px;">
        <button type="button" class="btn btn-secondary" onclick={() => showCategorizeModal = false}>Annuler</button>
        <button 
          type="button" 
          class="btn btn-primary" 
          onclick={() => {
            validerLigneSeule(selectedTxForCategorization);
            showCategorizeModal = false;
          }}
          style="padding: 10px 22px; font-weight: 600; background: #6366f1; border: none; border-radius: 8px;"
        >
          <i class="fa-solid fa-check"></i> Valider l'attribution
        </button>
      </div>

    </div>
  </div>
{/if}
