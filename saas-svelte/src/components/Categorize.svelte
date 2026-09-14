<script>
  import { onMount } from "svelte";
  import { transactions, planComptable, rules, activeTxId, members, updateTransactions, updateRules, updateMembers, showToast } from "../lib/store.js";
  import { Categorizer } from "../lib/categorizer.js";

  let selectedCompte = $state("");
  let dropdownOpen = $state(false);
  let checkLearnRule = $state(true);
  let inputKeyword = $state("");

  // Keep a copy of transactions for undo feature
  let lastStateTransactions = $state(null);

  function annulerDerniereAction() {
    if (lastStateTransactions) {
      updateTransactions(lastStateTransactions);
      lastStateTransactions = null;
      showToast("↩️ Attribution annulée avec succès !");
    }
  }

  // Computed states using Svelte 5 derived runes
  let nonTriees = $derived($transactions.filter((t) => t.compteAttribué === "699" || t.statut === "non_attribue" || t.statut === "suggere"));

  let totalTx = $derived($transactions.length);
  let trieesCount = $derived(totalTx - nonTriees.length);
  let progressPct = $derived(totalTx > 0 ? Math.round((trieesCount / totalTx) * 100) : 0);

  let suggestionsCount = $derived(nonTriees.filter((t) => t.statut === "suggere").length);

  // Active transaction state
  let activeTx = $derived($transactions.find((t) => t.id === $activeTxId));

  let activeTab = $state("pending"); // 'pending' ou 'categorized'
  let triees = $derived($transactions.filter((t) => t.compteAttribué !== "699" && t.statut === "attribue"));
  let displayedTxList = $derived(activeTab === "pending" ? nonTriees : triees);

  let listComptesTries = $derived(
    $planComptable
      .filter((c) => c.compte !== "699")
      .slice()
      .sort((a, b) => a.compte.localeCompare(b.compte, undefined, { numeric: true })),
  );

  // Regroupement des transactions attribuées par compte
  let groupedTriees = $derived(getGroupedTriees(triees));

  /** @param {any[]} txList */
  function getGroupedTriees(txList) {
    /** @type {Record<string, { compte: string, libelle: string, txs: any[] }>} */
    const groups = {};
    txList.forEach((tx) => {
      const cat = tx.compteAttribué || "699";
      if (!groups[cat]) {
        groups[cat] = {
          compte: cat,
          libelle: Categorizer.obtenirLibelleCompte(cat),
          txs: [],
        };
      }
      groups[cat].txs.push(tx);
    });
    return Object.values(groups).sort((a, b) => a.compte.localeCompare(b.compte));
  }

  // Automatically select first transaction of the active tab list if current is not in the list
  $effect(() => {
    if (displayedTxList.length > 0) {
      const isCurrentActiveValid = displayedTxList.some((t) => t.id === $activeTxId);
      if (!isCurrentActiveValid) {
        activeTxId.set(displayedTxList[0].id);
      }
    }
  });

  // Pre-select category and keyword based on active transaction
  $effect(() => {
    if (activeTx) {
      // Set default keyword suggestion
      const cleanWord = Categorizer.normaliserTexte(activeTx.libelle);
      const fragments = cleanWord.split(" ").slice(0, 3).join(" ");
      inputKeyword = activeTx.suggestionMotCle || fragments;

      // Utiliser le compte suggéré par l'IA s'il existe et est valide, sinon repli par défaut
      if (activeTx.compteAttribué && activeTx.compteAttribué !== "699") {
        selectedCompte = activeTx.compteAttribué;
      } else {
        const matchingCpts = $planComptable.filter((c) => c.compte !== "699");
        if (activeTx.debit > 0) {
          const chargeCpt = matchingCpts.find((c) => c.type === "Charge");
          selectedCompte = chargeCpt ? chargeCpt.compte : "";
        } else {
          const prodCpt = matchingCpts.find((c) => c.type === "Produit");
          selectedCompte = prodCpt ? prodCpt.compte : "";
        }
      }
    }
  });

  // Auto-class everything that has a suggestion
  function autoClasserTout() {
    lastStateTransactions = JSON.parse(JSON.stringify($transactions));
    let count = 0;
    $transactions.forEach((tx) => {
      if (tx.statut === "suggere") {
        const type = tx.debit > 0 ? "debit" : "credit";
        Categorizer.ajouterRegleEtRecat(tx.suggestionMotCle, tx.compteAttribué, type);
        count++;
      }
    });

    if (count > 0) {
      showToast(`🤖 Succès : ${count} règles d'attribution créées et appliquées automatiquement !`);
      recatTout();
    }
  }

  // Validate one-click suggestion
  function validerSuggestion() {
    if (activeTx && activeTx.suggestionMotCle) {
      lastStateTransactions = JSON.parse(JSON.stringify($transactions));
      const type = activeTx.debit > 0 ? "debit" : "credit";
      Categorizer.ajouterRegleEtRecat(activeTx.suggestionMotCle, activeTx.compteAttribué, type);
      recatTout();
      showToast(`Règle créée : "${activeTx.suggestionMotCle}" associée au compte ${activeTx.compteAttribué}`);
    }
  }

  // États pour les modales
  let showBulkModal = $state(false);
  let showNuanceModal = $state(false);
  let bulkCount = $state(0);
  let bulkKeyword = $state("");
  let bulkCompte = $state("");
  /** @type {any[]} */
  let tempPendingTxList = $state([]);
  let checkedCount = $derived(tempPendingTxList.filter((t) => t.selected).length);

  // Submit manual categorization
  function soumettreCategorisation() {
    if (!activeTx) return;

    // Si la règle risque d'être ambiguë/en conflit, ouvrir la modale bloquante pour trancher avant d'enregistrer
    if (checkLearnRule && Categorizer.detecterConflitMotCle(activeTx, $transactions)) {
      showNuanceModal = true;
      return;
    }

    lastStateTransactions = JSON.parse(JSON.stringify($transactions));

    const kw = inputKeyword.trim().toUpperCase();

    // Rechercher les transactions similaires non triées (ou triées différemment) dans la liste
    if (kw !== "") {
      tempPendingTxList = $transactions.filter((t) => t.id !== activeTx.id && (t.statut !== "attribue" || t.compteAttribué !== selectedCompte) && t.libelle.toUpperCase().includes(kw)).map((t) => ({ ...t, selected: true })); // Ajouter la sélection par défaut
    } else {
      tempPendingTxList = [];
    }

    if (tempPendingTxList.length > 0) {
      // Afficher la modale de validation groupée
      bulkCount = tempPendingTxList.length;
      bulkKeyword = inputKeyword.trim();
      bulkCompte = selectedCompte;
      showBulkModal = true;
    } else {
      // Exécuter l'attribution normalement (pas d'autres transactions similaires)
      executerAttributionUnique();
    }
  }

  function executerAttributionUnique() {
    if (checkLearnRule && inputKeyword.trim() !== "") {
      const type = activeTx.debit > 0 ? "debit" : "credit";
      Categorizer.ajouterRegleEtRecat(inputKeyword.trim(), selectedCompte, type);
      showToast(`Apprentissage réussi ! Règle "${inputKeyword.trim().toUpperCase()}" enregistrée.`);
    } else {
      // Attribution ponctuelle (Immuable)
      const updatedTx = $transactions.map((t) => {
        if (t.id === activeTx.id) {
          return {
            ...t,
            compteAttribué: selectedCompte,
            statut: "attribue",
            regleAppliquee: "Attribution ponctuelle",
          };
        }
        return t;
      });
      updateTransactions(updatedTx);
      showToast("Opération catégorisée avec succès !");
    }

    finaliserAttribution(activeTx, selectedCompte);
  }

  /**
   * @param {any} tx
   * @param {string} compte
   */
  function finaliserAttribution(tx, compte) {
    // Check for member registration link
    if (tx.credit > 0 && (compte === "756" || compte === "706")) {
      const reconciliation = reconcilierTransactionEleve(tx);
      if (reconciliation) {
        showToast(`💰 Liaison Adhérent : Inscription de ${reconciliation.membre} mise à jour (+${reconciliation.montant}€) !`);
      }
    }
    recatTout();
  }

  function validerAttributionGroupee() {
    const isDebit = activeTx.debit > 0;
    const type = isDebit ? "debit" : "credit";

    // 1. Ajouter la règle d'apprentissage si cochée
    if (checkLearnRule && bulkKeyword !== "") {
      Categorizer.ajouterRegleEtRecat(bulkKeyword, bulkCompte, type);
    }

    // 2. Mettre à jour la transaction active et TOUTES les transactions similaires COCHÉES dans le store (Immuable)
    const selectedIds = new Set(tempPendingTxList.filter((t) => t.selected).map((t) => t.id));

    const updatedTx = $transactions.map((t) => {
      const isTargetTx = t.id === activeTx.id || selectedIds.has(t.id);

      if (isTargetTx) {
        // Liaison adhérent pour chaque transaction créditée concernée
        if (t.credit > 0 && (bulkCompte === "756" || bulkCompte === "706")) {
          reconcilierTransactionEleve(t);
        }
        return {
          ...t,
          compteAttribué: bulkCompte,
          statut: "attribue",
          regleAppliquee: checkLearnRule ? bulkKeyword : "Attribution ponctuelle",
        };
      }
      return t;
    });

    updateTransactions(updatedTx);
    showToast(`✅ ${selectedIds.size + 1} opérations classées vers le compte ${bulkCompte} !`);

    // Fermer la modale et rafraîchir
    showBulkModal = false;
    recatTout();
  }

  function annulerAttributionGroupee() {
    // N'appliquer que sur la transaction active
    executerAttributionUnique();
    showBulkModal = false;
  }

  function fermerModal() {
    // Fermer sans rien faire
    showBulkModal = false;
  }

  // Re-run categorization on all transactions
  function recatTout() {
    const recatted = Categorizer.categoriserTransactions($transactions);
    updateTransactions(recatted);
  }

  /**
   * Member reconciliation logic
   * @param {any} tx
   * @returns {{ membre: string, montant: number, nouveauTotal: number } | null}
   */
  function reconcilierTransactionEleve(tx) {
    if (tx.credit <= 0) return null;
    const labelUpper = tx.libelle.toUpperCase();
    /** @type {{ membre: string, montant: number, nouveauTotal: number } | null} */
    let result = null;
    let updated = false;

    const list = $members.map((m) => {
      const nomFamille = m.nom.split(" ")[0].toUpperCase();
      if (labelUpper.includes(nomFamille)) {
        m.dejaPaye = (m.dejaPaye || 0) + tx.credit;
        updated = true;
        result = {
          membre: m.nom,
          montant: tx.credit,
          nouveauTotal: m.dejaPaye,
        };
      }
      return m;
    });

    if (updated) {
      updateMembers(list);
    }
    return result;
  }
</script>

<div class="page-title-section">
  <h1 class="page-title">Attribuer les numéros de compte aux libellés</h1>
  <p class="page-subtitle">Associez chaque mouvement bancaire à son compte comptable pour générer vos registres.</p>
</div>

<div class="progress-bar-container">
  <div class="progress-bar-fill" style="width: {progressPct}%;"></div>
</div>
<div style="font-size: 0.88rem; display: flex; justify-content: space-between; margin-bottom: 25px; font-weight: 600; align-items: center;">
  <span>{trieesCount} / {totalTx} transactions triées ({progressPct}%)</span>
  <div style="display: flex; gap: 10px; align-items: center;">
    {#if lastStateTransactions}
      <button class="btn btn-secondary btn-sm" onclick={annulerDerniereAction} style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.25); display: flex; align-items: center; gap: 6px;">
        <i class="fa-solid fa-rotate-left"></i> Annuler le dernier tri
      </button>
    {/if}
    {#if suggestionsCount > 0}
      <button class="btn btn-secondary btn-sm" onclick={autoClasserTout}>
        <i class="fa-solid fa-robot"></i> Classer automatiquement {suggestionsCount} écritures reconnues
      </button>
    {/if}
  </div>
</div>

<div class="tri-container">
  <!-- Left Side: List of pending transactions -->
  <div class="glass-card tri-list-card">
    <div style="background: rgba(99, 102, 241, 0.12); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid rgba(99, 102, 241, 0.25); margin-bottom: 15px;">
      <h3 style="font-family: var(--font-title); color: white; margin: 0; font-size: 1.1rem;">
        Opérations bancaires
      </h3>
    </div>
    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
      <button
        style="flex: 1; border: 1px solid {activeTab === 'pending' ? '#6366f1' : 'var(--border-color)'}; background: {activeTab === 'pending'
          ? 'rgba(99, 102, 241, 0.25)'
          : 'rgba(255, 255, 255, 0.04)'}; color: {activeTab === 'pending' ? '#a5b4fc' : 'var(--text-secondary)'}; font-family: var(--font-title); font-size: 0.9rem; padding: 8px 12px; border-radius: var(--radius-sm, 6px); cursor: pointer; font-weight: 600; transition: all 0.2s;"
        onclick={() => (activeTab = "pending")}
      >
        À attribuer ({nonTriees.length})
      </button>
      <button
        style="flex: 1; border: 1px solid {activeTab === 'categorized' ? '#10b981' : 'var(--border-color)'}; background: {activeTab === 'categorized'
          ? 'rgba(16, 185, 129, 0.25)'
          : 'rgba(255, 255, 255, 0.04)'}; color: {activeTab === 'categorized' ? '#6ee7b7' : 'var(--text-secondary)'}; font-family: var(--font-title); font-size: 0.9rem; padding: 8px 12px; border-radius: var(--radius-sm, 6px); cursor: pointer; font-weight: 600; transition: all 0.2s;"
        onclick={() => (activeTab = "categorized")}
      >
        Attribuées ({triees.length})
      </button>
    </div>

    <div id="tri-list-container">
      {#if displayedTxList.length === 0}
        <div style="text-align: center; padding: 40px 20px; color: var(--color-success);">
          <i class="fa-solid fa-circle-check" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.8;"></i>
          <h4 style="font-family: var(--font-title); font-size: 1.1em; color: white; margin-bottom: 5px;">
            {activeTab === "pending" ? "Toutes les écritures sont classées !" : "Aucune écriture classée"}
          </h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary);">
            {activeTab === "pending" ? "Votre comptabilité est parfaitement équilibrée." : "Les écritures que vous triez s'afficheront ici."}
          </p>
        </div>
      {:else if activeTab === "pending"}
        {#each nonTriees as tx}
          {@const hasConflict = Categorizer.detecterConflitMotCle(tx, $transactions)}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div 
            class="tx-tri-item {tx.id === $activeTxId ? 'active' : ''}" 
            onclick={() => {
              activeTxId.set(tx.id);
              if (hasConflict) {
                showNuanceModal = true;
              }
            }}
            style={hasConflict ? 'background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444;' : ''}
          >
            <div class="tx-tri-info">
              <div class="tx-tri-title">
                {tx.libelle}
                {#if hasConflict}
                  <span class="badge" style="background: #ef4444; color: white; font-size: 0.65rem; padding: 2px 6px; margin-left: 6px; font-weight: bold;">
                    ⚠️ Libellé similaire déjà attribué
                  </span>
                {:else if tx.statut === "suggere"}
                  <span class="badge badge-success" style="font-size: 0.6rem; padding: 2px 6px; margin-left: 5px;">
                    Suggestion &bull; <span style="color: #fef08a; font-weight: bold;">{tx.compteAttribué}</span>
                  </span>
                {/if}
              </div>
              <div class="tx-tri-meta">
                {new Date(tx.date).toLocaleDateString("fr-FR")} &bull; {tx.debit > 0 ? "Dépense" : "Recette"}
              </div>
            </div>
            <div class="tx-tri-amount" style="color: {tx.debit > 0 ? '#f87171' : '#34d399'};">
              {tx.debit > 0 ? "-" : "+"}
              {(tx.debit > 0 ? tx.debit : tx.credit).toFixed(2)} €
            </div>
          </div>
        {/each}
      {:else}
        {#each groupedTriees as group}
          <div class="compte-group" style="margin-bottom: 25px;">
            <div
              style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: #a5b4fc; margin-bottom: 12px; border-left: 3px solid #6366f1; padding-left: 8px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 5px;"
            >
              <span>{group.compte} - {group.libelle}</span>
              <span style="background: rgba(99, 102, 241, 0.15); padding: 2px 8px; border-radius: 10px; font-size: 0.75rem;">{group.txs.length}</span>
            </div>
            {#each group.txs as tx}
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <div class="tx-tri-item {tx.id === $activeTxId ? 'active' : ''}" onclick={() => activeTxId.set(tx.id)} style="margin-bottom: 8px;">
                <div class="tx-tri-info">
                  <div class="tx-tri-title">
                    {tx.libelle}
                  </div>
                  <div class="tx-tri-meta">
                    {new Date(tx.date).toLocaleDateString("fr-FR")} &bull; {tx.debit > 0 ? "Dépense" : "Recette"}
                  </div>
                </div>
                <div class="tx-tri-amount" style="color: {tx.debit > 0 ? '#f87171' : '#34d399'};">
                  {tx.debit > 0 ? "-" : "+"}
                  {(tx.debit > 0 ? tx.debit : tx.credit).toFixed(2)} €
                </div>
              </div>
            {/each}
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <!-- Right Side: Categorization actions -->
  <div class="glass-card" id="tri-action-panel" style="overflow: visible;">
    <div style="background: rgba(139, 92, 246, 0.12); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid rgba(139, 92, 246, 0.25); margin-bottom: 20px;">
      <h3 style="font-family: var(--font-title); color: white; margin: 0; font-size: 1.1rem;">
        Attribution des libellés bancaires
      </h3>
    </div>

    {#if !activeTx}
      <div id="no-tx-selected" style="text-align: center; padding: 40px 0; color: var(--text-secondary);">
        <i class="fa-solid fa-arrow-left" style="font-size: 2rem; margin-bottom: 15px; color: var(--text-muted);"></i>
        <p>Sélectionnez une opération dans la liste de gauche pour l'affecter à sa catégorie.</p>
      </div>
    {:else}
      <div id="tx-details-area">
        <!-- Suggestion box -->
        {#if activeTx.statut === "suggere"}
          <div class="suggestion-box" style="display: flex; margin-bottom: 25px;">
            <div class="suggestion-content">
              <span style="font-size: 0.95rem; font-weight: 700; text-transform: uppercase; color: var(--color-success);">💡 SUGGESTION :</span><br />
              <span style="font-size: 0.9rem;">Associer à : <strong>{activeTx.compteAttribué} ({Categorizer.obtenirLibelleCompte(activeTx.compteAttribué)})</strong> ?</span>
            </div>
            <button class="btn btn-success btn-sm" onclick={validerSuggestion}>
              <i class="fa-solid fa-check"></i> Valider
            </button>
          </div>
        {/if}

        <!-- Manual form -->
        <div style="margin-top: 15px;">
          <h4 style="font-family: var(--font-title); font-size: 0.95em; color: white; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.5px;">ATTRIBUER</h4>

          <div class="form-group" style="position: relative;">
            <label for="compte-select" class="form-label">Catégorie cible (Plan comptable)</label>

            <!-- Trigger Button -->
            <button
              id="compte-select"
              type="button"
              class="form-control"
              onclick={() => (dropdownOpen = !dropdownOpen)}
              style="display: flex; justify-content: space-between; align-items: center; width: 100%; text-align: left; background: rgba(0,0,0,0.4); color: white; border: 1px solid var(--border-color); padding: 10px 15px; border-radius: var(--radius-sm); cursor: pointer;"
            >
              <span>
                {selectedCompte ? `${selectedCompte} - ${Categorizer.obtenirLibelleCompte(selectedCompte)}` : "-- Sélectionnez un compte --"}
              </span>
              <i class="fa-solid fa-chevron-down" style="font-size: 0.8rem; opacity: 0.7;"></i>
            </button>

            <!-- Dropdown List Container -->
            {#if dropdownOpen}
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 998;" onclick={() => (dropdownOpen = false)}></div>

              <div class="glass-card" style="position: absolute; top: calc(100% + 5px); left: 0; right: 0; max-height: 480px; overflow-y: auto; z-index: 999; padding: 8px; border: 1px solid var(--color-primary-light, #818cf8); box-shadow: 0 10px 30px rgba(0,0,0,0.6); background: #11131e;">
                <!-- RECETTES -->
                <div style="font-weight: 700; color: #60a5fa; padding: 10px 12px; border-bottom: 1px solid rgba(96, 165, 250, 0.15); margin-top: 5px; margin-bottom: 5px; letter-spacing: 0.02em; background: rgba(96, 165, 250, 0.03); line-height: 1.4;">
                  <div style="text-transform: capitalize; font-size: 1.05rem;">recettes</div>
                  <div style="font-size: 0.76rem; font-weight: normal; opacity: 0.75; margin-top: 2px;">(dons, cotisations, ventes...)</div>
                </div>
                {#each listComptesTries.filter((c) => c.type === "Produit") as c}
                  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                  <div
                    class="dropdown-item-custom {selectedCompte === c.compte ? 'active' : ''}"
                    onclick={() => {
                      selectedCompte = c.compte;
                      dropdownOpen = false;
                    }}
                  >
                    <span>{c.compte} - {c.libelle}</span>
                    {#if selectedCompte === c.compte}
                      <i class="fa-solid fa-check" style="font-size: 0.8rem;"></i>
                    {/if}
                  </div>
                {/each}

                <!-- DÉPENSES : ACHATS & FRAIS COURANTS -->
                <div style="font-weight: 700; color: #38bdf8; padding: 10px 12px; border-bottom: 1px solid rgba(56, 189, 248, 0.15); margin-top: 15px; margin-bottom: 5px; letter-spacing: 0.02em; background: rgba(56, 189, 248, 0.03); line-height: 1.4;">
                  <div style="text-transform: capitalize; font-size: 1.05rem;">dépenses :</div>
                  <div style="font-weight: 600; font-size: 0.9rem;">achats & frais courants</div>
                  <div style="font-size: 0.76rem; font-weight: normal; opacity: 0.75; margin-top: 2px;">(fournitures, déplacements, télécoms...)</div>
                </div>
                {#each listComptesTries.filter((c) => c.type === "Charge" && (c.compte.startsWith("60") || c.compte.startsWith("62"))) as c}
                  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                  <div
                    class="dropdown-item-custom {selectedCompte === c.compte ? 'active' : ''}"
                    onclick={() => {
                      selectedCompte = c.compte;
                      dropdownOpen = false;
                    }}
                  >
                    <span>{c.compte} - {c.libelle}</span>
                    {#if selectedCompte === c.compte}
                      <i class="fa-solid fa-check" style="font-size: 0.8rem;"></i>
                    {/if}
                  </div>
                {/each}

                <!-- DÉPENSES : LOCAUX & ASSURANCES -->
                <div style="font-weight: 700; color: #f59e0b; padding: 10px 12px; border-bottom: 1px solid rgba(245, 158, 11, 0.15); margin-top: 15px; margin-bottom: 5px; letter-spacing: 0.02em; background: rgba(245, 158, 11, 0.03); line-height: 1.4;">
                  <div style="text-transform: capitalize; font-size: 1.05rem;">dépenses :</div>
                  <div style="font-weight: 600; font-size: 0.9rem;">locaux & assurances</div>
                  <div style="font-size: 0.76rem; font-weight: normal; opacity: 0.75; margin-top: 2px;">(loyer, entretien, assurances...)</div>
                </div>
                {#each listComptesTries.filter((c) => c.type === "Charge" && c.compte.startsWith("61") && c.compte !== "611") as c}
                  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                  <div
                    class="dropdown-item-custom {selectedCompte === c.compte ? 'active' : ''}"
                    onclick={() => {
                      selectedCompte = c.compte;
                      dropdownOpen = false;
                    }}
                  >
                    <span>{c.compte} - {c.libelle}</span>
                    {#if selectedCompte === c.compte}
                      <i class="fa-solid fa-check" style="font-size: 0.8rem;"></i>
                    {/if}
                  </div>
                {/each}

                <!-- DÉPENSES : PRESTATAIRES & COTISATIONS -->
                <div style="font-weight: 700; color: #facc15; padding: 10px 12px; border-bottom: 1px solid rgba(250, 204, 21, 0.15); margin-top: 15px; margin-bottom: 5px; letter-spacing: 0.02em; background: rgba(250, 204, 21, 0.03); line-height: 1.4;">
                  <div style="text-transform: capitalize; font-size: 1.05rem;">dépenses :</div>
                  <div style="font-weight: 600; font-size: 0.9rem;">prestataires & cotisations</div>
                  <div style="font-size: 0.76rem; font-weight: normal; opacity: 0.75; margin-top: 2px;">(intervenants, sous-traitance...)</div>
                </div>
                {#each listComptesTries.filter((c) => c.type === "Charge" && (c.compte === "611" || c.compte.startsWith("65"))) as c}
                  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                  <div
                    class="dropdown-item-custom {selectedCompte === c.compte ? 'active' : ''}"
                    onclick={() => {
                      selectedCompte = c.compte;
                      dropdownOpen = false;
                    }}
                  >
                    <span>{c.compte} - {c.libelle}</span>
                    {#if selectedCompte === c.compte}
                      <i class="fa-solid fa-check" style="font-size: 0.8rem;"></i>
                    {/if}
                  </div>
                {/each}

                <!-- DÉPENSES : PERSONNEL & SALAIRES -->
                <div style="font-weight: 700; color: #f43f5e; padding: 10px 12px; border-bottom: 1px solid rgba(244, 63, 94, 0.15); margin-top: 15px; margin-bottom: 5px; letter-spacing: 0.02em; background: rgba(244, 63, 94, 0.03); line-height: 1.4;">
                  <div style="text-transform: capitalize; font-size: 1.05rem;">dépenses :</div>
                  <div style="font-weight: 600; font-size: 0.9rem;">personnel & salaires</div>
                  <div style="font-size: 0.76rem; font-weight: normal; opacity: 0.75; margin-top: 2px;">(salaires, charges, mutuelle...)</div>
                </div>
                {#each listComptesTries.filter((c) => c.type === "Charge" && c.compte.startsWith("64")) as c}
                  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                  <div
                    class="dropdown-item-custom {selectedCompte === c.compte ? 'active' : ''}"
                    onclick={() => {
                      selectedCompte = c.compte;
                      dropdownOpen = false;
                    }}
                  >
                    <span>{c.compte} - {c.libelle}</span>
                    {#if selectedCompte === c.compte}
                      <i class="fa-solid fa-check" style="font-size: 0.8rem;"></i>
                    {/if}
                  </div>
                {/each}

                <!-- BANQUE & TIERS -->
                <div style="font-weight: 700; color: #60a5fa; padding: 10px 12px; border-bottom: 1px solid rgba(96, 165, 250, 0.15); margin-top: 15px; margin-bottom: 5px; letter-spacing: 0.02em; background: rgba(96, 165, 250, 0.03); line-height: 1.4;">
                  <div style="text-transform: capitalize; font-size: 1.05rem;">banque & tiers</div>
                  <div style="font-size: 0.76rem; font-weight: normal; opacity: 0.75; margin-top: 2px;">(banque, fournisseurs, clients...)</div>
                </div>
                {#each listComptesTries.filter((c) => c.type !== "Charge" && c.type !== "Produit") as c}
                  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                  <div
                    class="dropdown-item-custom {selectedCompte === c.compte ? 'active' : ''}"
                    onclick={() => {
                      selectedCompte = c.compte;
                      dropdownOpen = false;
                    }}
                  >
                    <span>{c.compte} - {c.libelle}</span>
                    {#if selectedCompte === c.compte}
                      <i class="fa-solid fa-check" style="font-size: 0.8rem;"></i>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <div class="form-group" style="background-color: rgba(255,255,255,0.02); padding: 15px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <label class="form-label" style="display: flex; align-items: center; justify-content: space-between;">
              <span>Apprentissage de la machine</span>
              <input type="checkbox" bind:checked={checkLearnRule} style="width: 16px; height: 16px; cursor: pointer;" />
            </label>
            <p style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 10px;">Enregistrer ce choix comme une règle. À l'avenir, toutes les opérations contenant ce mot-clé seront classées automatiquement !</p>
            
            <label for="keyword-input" class="form-label">Mot-clé déclencheur</label>
            <input type="text" id="keyword-input" class="form-control" bind:value={inputKeyword} placeholder="ex: AUCHAN" />
          </div>

          <button class="btn btn-primary" onclick={soumettreCategorisation} style="width: 100%; justify-content: center;">
            <i class="fa-solid fa-tags"></i> Enregistrer la catégorie
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

{#if showBulkModal}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.75); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px);" onclick={fermerModal}>
    <div class="glass-card" style="max-width: 480px; width: 90%; padding: 25px; border: 1px solid var(--border-color); box-shadow: 0 20px 40px rgba(0,0,0,0.5); background: #11131e; position: relative;" onclick={(e) => e.stopPropagation()}>
      <!-- Bouton de fermeture X -->
      <button class="modal-close-btn" onclick={fermerModal} aria-label="Fermer">
        <i class="fa-solid fa-xmark"></i>
      </button>

      <h3 style="font-family: var(--font-title); color: white; margin-bottom: 15px; display: flex; align-items: center; gap: 10px; font-size: 1.2rem; padding-right: 20px;">
        <i class="fa-solid fa-layer-group" style="color: #6366f1;"></i>
        Attribution groupée détectée
      </h3>
      <p style="font-size: 0.95rem; color: #d1d5db; line-height: 1.5; margin-bottom: 12px;">
        <strong>{bulkCount} autres opérations</strong> comportant le même libellé/mot-clé <strong>"{bulkKeyword}"</strong> viennent d'être détectées :
      </p>

      <!-- Liste scrollable des opérations similaires avec cases à cocher -->
      <div style="max-height: 150px; overflow-y: auto; background: rgba(0, 0, 0, 0.3); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 20px;">
        {#each tempPendingTxList as tx}
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; padding: 6px 0; border-bottom: 1px dashed rgba(255, 255, 255, 0.05); color: #d1d5db;">
            <label style="display: flex; align-items: center; gap: 8px; width: 75%; cursor: pointer; margin: 0; font-weight: normal; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <input type="checkbox" bind:checked={tx.selected} style="width: 14px; height: 14px; cursor: pointer; margin: 0;" />
              <span title={tx.libelle}>📅 {new Date(tx.date).toLocaleDateString("fr-FR")} &bull; {tx.libelle}</span>
            </label>
            <span style="font-weight: 600; color: {tx.debit > 0 ? '#f87171' : '#34d399'};">
              {tx.debit > 0 ? "-" : "+"}
              {(tx.debit > 0 ? tx.debit : tx.credit).toFixed(2)} €
            </span>
          </div>
        {/each}
      </div>

      <p style="font-size: 0.9rem; color: #9ca3af; line-height: 1.5; margin-bottom: 25px; background: rgba(255,255,255,0.03); padding: 12px; border-radius: var(--radius-sm); border-left: 3px solid #6366f1;">
        Souhaitez-vous attribuer automatiquement la catégorie <strong>{bulkCompte} ({Categorizer.obtenirLibelleCompte(bulkCompte)})</strong> à ces {checkedCount + 1} opérations sélectionnées ?
        <br /><br />
        <span style="font-size: 0.8rem; opacity: 0.8;">💡 Elles seront immédiatement rangées et modifiables à tout moment dans l'onglet <strong>"Classées"</strong>.</span>
      </p>
      <div style="display: flex; gap: 8px; justify-content: flex-end; width: 100%;">
        <button class="btn btn-secondary" onclick={fermerModal} style="background: none; border: 1px solid var(--border-color); color: var(--text-secondary);"> Annuler </button>
        <button class="btn btn-secondary" onclick={annulerAttributionGroupee} style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: white;"> Uniquement celle-ci </button>
        <button class="btn btn-primary" onclick={validerAttributionGroupee} disabled={checkedCount === 0 && checkLearnRule}>
          Appliquer aux {checkedCount + 1} lignes
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showNuanceModal && activeTx}
  {@const struct = Categorizer.obtenirNuancesStructurees(activeTx.libelle)}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.75); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px);" onclick={() => showNuanceModal = false}>
    <div class="glass-card" style="max-width: 560px; width: 90%; padding: 25px; border: 1px solid rgba(239, 68, 68, 0.4); box-shadow: 0 20px 40px rgba(0,0,0,0.6); background: #11131e; position: relative;" onclick={(e) => e.stopPropagation()}>
      <button class="modal-close-btn" onclick={() => showNuanceModal = false} aria-label="Fermer">
        <i class="fa-solid fa-xmark"></i>
      </button>

      <h3 style="font-family: var(--font-title); color: #fca5a5; margin-bottom: 12px; display: flex; align-items: center; gap: 10px; font-size: 1.2rem; padding-right: 20px;">
        <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444;"></i>
        Précision du mot-clé requise
      </h3>

      <p style="font-size: 0.88rem; color: #d1d5db; line-height: 1.5; margin-bottom: 20px; background: rgba(255,255,255,0.03); padding: 12px; border-radius: var(--radius-sm); border-left: 3px solid #ef4444;">
        Le système a détecté une similitude avec des opérations existantes. Choisissez le niveau de précision pour enseigner au système comment traiter ces écritures à l'avenir :
      </p>

      <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 25px;">
        {#if struct.tiers}
          <button
            type="button"
            onclick={() => {
              if (struct.tiers) inputKeyword = struct.tiers;
              showNuanceModal = false;
              soumettreCategorisation();
            }}
            style="display: flex; flex-direction: column; background: rgba(99, 102, 241, 0.15); border: 1px solid #6366f1; color: white; padding: 12px 16px; border-radius: var(--radius-sm); cursor: pointer; transition: all 0.2s; text-align: left;"
          >
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <span style="font-size: 0.95rem; font-weight: 700;">👤 Par le Nom du Tiers / Personne : <strong>"{struct.tiers}"</strong></span>
              <i class="fa-solid fa-arrow-right" style="color: #818cf8;"></i>
            </div>
            <span style="font-size: 0.78rem; color: #a5b4fc; margin-top: 4px;">
              Classera automatiquement toutes les futures opérations de cet émetteur/destinataire.
            </span>
          </button>
        {/if}

        {#if struct.combo}
          <button
            type="button"
            onclick={() => {
              if (struct.combo) inputKeyword = struct.combo;
              showNuanceModal = false;
              soumettreCategorisation();
            }}
            style="display: flex; flex-direction: column; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-color); color: white; padding: 12px 16px; border-radius: var(--radius-sm); cursor: pointer; transition: all 0.2s; text-align: left;"
          >
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <span style="font-size: 0.95rem; font-weight: 700;">🔒 Par l'Opération Exacte (Mode + Tiers) : <strong>"{struct.combo}"</strong></span>
              <i class="fa-solid fa-arrow-right" style="color: var(--text-secondary);"></i>
            </div>
            <span style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px;">
              S'appliquera uniquement aux paiements stricts portant ce libellé complet.
            </span>
          </button>
        {/if}

        {#if struct.mode}
          <button
            type="button"
            onclick={() => {
              if (struct.mode) inputKeyword = struct.mode;
              showNuanceModal = false;
              soumettreCategorisation();
            }}
            style="display: flex; flex-direction: column; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-color); color: white; padding: 12px 16px; border-radius: var(--radius-sm); cursor: pointer; transition: all 0.2s; text-align: left;"
          >
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <span style="font-size: 0.95rem; font-weight: 700;">💳 Par le Type de Paiement uniquement : <strong>"{struct.mode}"</strong></span>
              <i class="fa-solid fa-arrow-right" style="color: var(--text-secondary);"></i>
            </div>
            <span style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px;">
              Classera tous les futurs virements de ce type (quel que soit le destinataire) dans ce compte.
            </span>
          </button>
        {/if}
      </div>

      <div style="display: flex; gap: 10px; justify-content: flex-end; width: 100%;">
        <button class="btn btn-secondary" onclick={() => showNuanceModal = false} style="background: none; border: 1px solid var(--border-color); color: var(--text-secondary);">
          Annuler
        </button>
        <button
          class="btn btn-secondary"
          onclick={() => {
            showNuanceModal = false;
            // Forcer l'attribution sans re-déclencher la modale
            executerAttributionUnique();
          }}
          style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: white;"
        >
          Conserver le mot-clé générique ("{inputKeyword}")
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-close-btn {
    position: absolute;
    top: 15px;
    right: 15px;
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 1.2rem;
    cursor: pointer;
    padding: 5px;
    opacity: 0.8;
    transition: opacity 0.2s;
  }
  .modal-close-btn:hover {
    opacity: 1;
    color: white;
  }
</style>
