<script>
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
  import { Categorizer } from "../lib/categorizer.js";

  // Active tab filter: 'pending' vs 'categorized'
  let activeTab = $state('pending');

  // Similar transactions modal state
  let showSimilarTxModal = $state(false);
  let targetSimilarCategory = $state('');
  let pendingPrimaryTx = $state(null);
  let matchingSimilarTxList = $state([]);
  let selectedSimilarTxIds = $state(new Set());


  // Pedagogical onboarding modal state
  let showPedagogicalModal = $state(false);
  let dontShowAgain = $state(false);

  // Selected state per transaction for manual overrides
    // Active custom dropdown row ID
  let activeDropdownTxId = $state(null);

  let selectedCategoryMap = $state({});

  // Keep copy for undo
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
  function formatAccountLabel(numCompte) {
    if (!numCompte || numCompte === '699') return '« Choisir une catégorie... »';
    const cpt = $planComptable.find(p => p.compte === String(numCompte));
    if (!cpt) return `Compte (${numCompte})`;
    const cleanName = cpt.libelle.replace(/\s*\(\d+\)\s*/g, '').trim();
    return `${cleanName} (${cpt.compte})`;
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

        // Create rule if transaction had keyword
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
  function trouverOpérationsSimilaires(targetTx) {
    if (!targetTx || !targetTx.libelle) return [];
    const kw = Categorizer.normaliserTexte(targetTx.libelle).split(' ')[0];
    if (!kw || kw.length < 3 || ['VIR', 'PRLV', 'SEPA', 'CHEQUE', 'PAIEMENT', 'CARTES'].includes(kw)) {
      // Use second word if first is generic bank prefix
      const words = Categorizer.normaliserTexte(targetTx.libelle).split(' ').filter(w => w.length >= 3 && !['VIR', 'PRLV', 'SEPA', 'CHEQUE', 'PAIEMENT', 'CARTES'].includes(w));
      if (words.length === 0) return [];
      const coreWord = words[0];
      return nonTriees.filter(t => t.id !== targetTx.id && Categorizer.normaliserTexte(t.libelle).includes(coreWord));
    }
    return nonTriees.filter(t => t.id !== targetTx.id && Categorizer.normaliserTexte(t.libelle).includes(kw));
  }

  // Validate single row with similar transactions detection modal
  function validerLigneSeule(tx) {
    lastStateTransactions = JSON.parse(JSON.stringify($transactions));

    const targetCategory = selectedCategoryMap[tx.id] || tx.compteAttribué || (tx.credit > 0 ? '756' : '606');
    const isDebit = tx.debit > 0;
    const type = isDebit ? 'debit' : 'credit';

    const kw = Categorizer.normaliserTexte(tx.libelle).split(' ').slice(0, 3).join(' ');
    if (kw) {
      Categorizer.ajouterRegle(kw, targetCategory, type);
    }

    // Find similar unassigned transactions
    const similarMatches = trouverOpérationsSimilaires(tx);

    if (similarMatches.length > 0) {
      pendingPrimaryTx = tx;
      targetSimilarCategory = targetCategory;
      matchingSimilarTxList = similarMatches;
      selectedSimilarTxIds = new Set(similarMatches.map(m => m.id));
      showSimilarTxModal = true;
    } else {
      // Update single transaction directly
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

<div class="page-title-section" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
  <div>
    <h1 class="page-title">Attribuer les numéros de compte aux libellés</h1>
    <p class="page-subtitle">Associez chaque mouvement bancaire à son numéro de compte comptable. La machine apprend automatiquement de vos choix !</p>
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
<div style="background: rgba(99, 102, 241, 0.12); border: 1.5px solid rgba(99, 102, 241, 0.4); border-radius: 16px; padding: 20px 24px; margin-top: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;">
  <div>
    <div style="font-size: 0.85rem; color: #a5b4fc; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
      🤖 Reconnaissance Intelligente des Écritures
    </div>
    <div style="font-size: 1.3rem; font-weight: 700; color: white; margin-top: 4px;">
      {recognizedList.length} sur {nonTriees.length} écritures identifiées avec certitude ({totalRecognizedAmount.toFixed(2)} €)
    </div>
  </div>

  <button 
    class="btn btn-primary"
    onclick={validerToutEnUnClic}
    disabled={recognizedList.length === 0}
    style="padding: 14px 28px; font-size: 1.05rem; font-weight: 700; background: linear-gradient(135deg, #10b981, #059669); border: none; border-radius: 12px; box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4); cursor: pointer; display: flex; align-items: center; gap: 10px; transition: all 0.2s;"
  >
    <i class="fa-solid fa-check-double" style="font-size: 1.2rem;"></i>
    Tout valider ({recognizedList.length} opérations reconnues)
  </button>
</div>

<div style="display: block; width: 100%; margin-top: 24px;">
  <div class="glass-card" style="padding: 24px; width: 100%;">
    
    <!-- Filter Tabs -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 15px;">
      <div style="display: flex; gap: 12px; background: rgba(0, 0, 0, 0.3); padding: 4px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08);">
        <button
          style="border: none; background: {activeTab === 'pending' ? '#6366f1' : 'transparent'}; color: {activeTab === 'pending' ? 'white' : 'var(--text-secondary)'}; font-family: var(--font-title); font-size: 0.9rem; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.2s;"
          onclick={() => (activeTab = "pending")}
        >
          À attribuer ({nonTriees.length})
        </button>
        <button
          style="border: none; background: {activeTab === 'categorized' ? '#10b981' : 'transparent'}; color: {activeTab === 'categorized' ? 'white' : 'var(--text-secondary)'}; font-family: var(--font-title); font-size: 0.9rem; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.2s;"
          onclick={() => (activeTab = "categorized")}
        >
          Attribuées ({triees.length})
        </button>
      </div>

      <div style="font-size: 0.85rem; color: #86efac; background: rgba(16, 185, 129, 0.1); padding: 6px 14px; border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.3);">
        🟢 <strong>Attribution par Lot</strong> : Sélectionnez le numéro de compte du plan comptable puis validez.
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
                      <div style="font-weight: 600; color: white; font-size: 0.95rem;">{tx.libelle}</div>
                      {#if tx.info || tx.reference}
                        <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 3px;">
                          {tx.info} {tx.reference ? `• Ref: ${tx.reference}` : ''}
                        </div>
                      {/if}
                      <div style="font-size: 0.75rem; color: #a5b4fc; margin-top: 4px;">
                        {new Date(tx.date).toLocaleDateString("fr-FR")} &bull; {tx.debit > 0 ? "Dépense" : "Recette"}
                      </div>
                    </div>
                    
                    <div style="font-size: 1.1rem; font-weight: 700; color: {tx.debit > 0 ? '#f87171' : '#34d399'}; white-space: nowrap;">
                      {tx.debit > 0 ? "-" : "+"}
                      {(tx.debit > 0 ? tx.debit : tx.credit).toFixed(2)} €
                    </div>
                  </div>
                </td>

                <!-- 2. Attribution proposée (Compte) -->
                <td style="padding: 16px 14px; vertical-align: middle;">
                  <div style="position: relative; width: 100%;">
                    <!-- Custom Trigger Button -->
                    <button
                      type="button"
                      onclick={() => activeDropdownTxId = (activeDropdownTxId === tx.id ? null : tx.id)}
                      style="display: flex; justify-content: space-between; align-items: center; width: 100%; text-align: left; background: #11131e; color: white; border: 1.5px solid rgba(129, 140, 248, 0.5); padding: 10px 14px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.92rem;"
                    >
                      <span>
                        {formatAccountLabel(currentCat)}
                      </span>
                      <i class="fa-solid fa-chevron-down" style="font-size: 0.8rem; color: #a5b4fc;"></i>
                    </button>

                    <!-- Custom Glassmorphic Popover Dropdown -->
                    {#if activeDropdownTxId === tx.id}
                      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                      <div style="position: fixed; inset: 0; z-index: 998;" onclick={() => activeDropdownTxId = null}></div>

                      <div style="position: absolute; top: calc(100% + 6px); left: 0; right: 0; max-height: 420px; overflow-y: auto; z-index: 999; padding: 10px; border: 1.5px solid #818cf8; border-radius: 10px; box-shadow: 0 15px 40px rgba(0,0,0,0.9); background: #0b0d17;">
                        
                        <!-- 1. 🟢 ENTRÉES D'ARGENT -->
                        <div style="color: #4ade80; font-weight: 800; font-size: 0.95rem; text-transform: uppercase; padding: 8px 12px; background: rgba(16, 185, 129, 0.15); border-left: 4px solid #10b981; border-radius: 4px; margin-bottom: 6px; margin-top: 2px; display: flex; align-items: center; gap: 8px;">
                          🟢 ENTRÉES D'ARGENT
                        </div>
                        {#each groupEntrees as c}
                          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                          <div 
                            onclick={() => { selectedCategoryMap[tx.id] = c.compte; activeDropdownTxId = null; }}
                            style="padding: 9px 14px; border-radius: 6px; cursor: pointer; color: {currentCat === c.compte ? '#34d399' : 'white'}; font-weight: {currentCat === c.compte ? '700' : '500'}; background: {currentCat === c.compte ? 'rgba(16, 185, 129, 0.2)' : 'transparent'}; margin-bottom: 2px; transition: background 0.15s;"
                          >
                            <strong>{c.libelle}</strong> <span style="color: #a5b4fc; font-size: 0.85rem; font-weight: 400;">({c.compte})</span>
                          </div>
                        {/each}

                        <!-- 2. 🔴 DÉPENSES COURANTES -->
                        <div style="color: #fca5a5; font-weight: 800; font-size: 0.95rem; text-transform: uppercase; padding: 8px 12px; background: rgba(239, 68, 68, 0.15); border-left: 4px solid #ef4444; border-radius: 4px; margin-bottom: 6px; margin-top: 14px; display: flex; align-items: center; gap: 8px;">
                          🔴 DÉPENSES COURANTES
                        </div>
                        {#each groupDepensesCourantes as c}
                          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                          <div 
                            onclick={() => { selectedCategoryMap[tx.id] = c.compte; activeDropdownTxId = null; }}
                            style="padding: 9px 14px; border-radius: 6px; cursor: pointer; color: {currentCat === c.compte ? '#f87171' : 'white'}; font-weight: {currentCat === c.compte ? '700' : '500'}; background: {currentCat === c.compte ? 'rgba(239, 68, 68, 0.2)' : 'transparent'}; margin-bottom: 2px; transition: background 0.15s;"
                          >
                            <strong>{c.libelle}</strong> <span style="color: #a5b4fc; font-size: 0.85rem; font-weight: 400;">({c.compte})</span>
                          </div>
                        {/each}

                        <!-- 3. 👥 ÉQUIPE & INTERVENANTS -->
                        <div style="color: #c084fc; font-weight: 800; font-size: 0.95rem; text-transform: uppercase; padding: 8px 12px; background: rgba(168, 85, 247, 0.15); border-left: 4px solid #a855f7; border-radius: 4px; margin-bottom: 6px; margin-top: 14px; display: flex; align-items: center; gap: 8px;">
                          👥 ÉQUIPE & INTERVENANTS
                        </div>
                        {#each groupEquipe as c}
                          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                          <div 
                            onclick={() => { selectedCategoryMap[tx.id] = c.compte; activeDropdownTxId = null; }}
                            style="padding: 9px 14px; border-radius: 6px; cursor: pointer; color: {currentCat === c.compte ? '#c084fc' : 'white'}; font-weight: {currentCat === c.compte ? '700' : '500'}; background: {currentCat === c.compte ? 'rgba(168, 85, 247, 0.2)' : 'transparent'}; margin-bottom: 2px; transition: background 0.15s;"
                          >
                            <strong>{c.libelle}</strong> <span style="color: #a5b4fc; font-size: 0.85rem; font-weight: 400;">({c.compte})</span>
                          </div>
                        {/each}

                        <!-- 4. 🔄 COMPTES & TRANSFERTS -->
                        <div style="color: #93c5fd; font-weight: 800; font-size: 0.95rem; text-transform: uppercase; padding: 8px 12px; background: rgba(59, 130, 246, 0.15); border-left: 4px solid #3b82f6; border-radius: 4px; margin-bottom: 6px; margin-top: 14px; display: flex; align-items: center; gap: 8px;">
                          🔄 COMPTES & TRANSFERTS
                        </div>
                        {#each groupTransferts as c}
                          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                          <div 
                            onclick={() => { selectedCategoryMap[tx.id] = c.compte; activeDropdownTxId = null; }}
                            style="padding: 9px 14px; border-radius: 6px; cursor: pointer; color: {currentCat === c.compte ? '#60a5fa' : 'white'}; font-weight: {currentCat === c.compte ? '700' : '500'}; background: {currentCat === c.compte ? 'rgba(59, 130, 246, 0.2)' : 'transparent'}; margin-bottom: 2px; transition: background 0.15s;"
                          >
                            <strong>{c.libelle}</strong> <span style="color: #a5b4fc; font-size: 0.85rem; font-weight: 400;">({c.compte})</span>
                          </div>
                        {/each}

                      </div>
                    {/if}
                  </div>
                </td>

                <!-- 3. Statut & Action -->
                <td style="padding: 16px 14px; vertical-align: middle; text-align: right;">
                  <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                    {#if isRecognized}
                      <span class="badge badge-success" style="font-size: 0.75rem; padding: 4px 10px;">
                        🟢 Reconnu automatiquement
                      </span>
                    {:else}
                      <span class="badge" style="background: rgba(234, 179, 8, 0.2); color: #fef08a; border: 1px solid rgba(234, 179, 8, 0.4); font-size: 0.75rem; padding: 4px 10px;">
                        🟡 À vérifier
                      </span>
                    {/if}

                    <button 
                      class="btn btn-primary btn-sm"
                      onclick={() => validerLigneSeule(tx)}
                      style="padding: 7px 16px; font-weight: 600; font-size: 0.88rem;"
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
              <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                <td style="padding: 14px 12px;">
                  <div style="font-weight: 600; color: white;">{tx.libelle}</div>
                  <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">
                    {new Date(tx.date).toLocaleDateString("fr-FR")} &bull; Règle : {tx.regleAppliquee || 'Manuelle'}
                  </div>
                </td>
                <td style="padding: 14px 12px; color: #a5b4fc; font-weight: 600;">
                  {tx.compteAttribué} - {Categorizer.obtenirLibelleCompte(tx.compteAttribué)}
                </td>
                <td style="padding: 14px 12px; text-align: right; font-weight: 700; color: {tx.debit > 0 ? '#f87171' : '#34d399'};">
                  {tx.debit > 0 ? "-" : "+"}
                  {(tx.debit > 0 ? tx.debit : tx.credit).toFixed(2)} €
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
          L'attribution est l'étape clef de votre gestion. Cette étape cruciale consiste à attribuer à chaque opération bancaire, un numéro de compte du plan comptable. Par exemple, un abonnement web correspondra au compte 613. Un restaurant au compte 625. De cette manière, le plan de compte peut s'organiser, chaque opération est reliée à un compte et votre gestion peut enfin débuter !
        </p>

        <p style="font-weight: 700; color: #a5b4fc; font-size: 1.05rem; margin-bottom: 10px;">
          À vous de jouer.
        </p>

        <p style="margin-bottom: 14px;">
          C'est simple, pour chaque opération, cliquez sur le menu déroulant et attribuez un compte puis validez.
        </p>

        <p style="margin-bottom: 0; background: rgba(99, 102, 241, 0.12); border-left: 4px solid #6366f1; padding: 12px 14px; border-radius: 6px; color: rgba(255, 255, 255, 0.85); font-size: 0.9rem;">
          💡 <strong>Rassurez-vous</strong> : le système apprendra au fur et à mesure de votre aventure sur <strong>ScriptCompta</strong> et vous n'aurez, au fur et à mesure de vos imports, de moins en moins d'attributions à effectuer.
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
        Le système a identifié <strong>{matchingSimilarTxList.length} autre(s) opération(s) similaire(s)</strong> à <em>"{pendingPrimaryTx.libelle}"</em>.<br/>
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
          // Validate only primary tx
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
