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

  let showModal = $state(false);
  let selectedTx = $state(null);
  let nomEleve = $state("");
  let montantVerse = $state(0);
  let montantTotalPercevoir = $state("");

  let newNom = $state("");
  let newEmail = $state("");
  let newForfait = $state("");

  const sampleAssoTx = [
    { id: "tx-asso-1", date: "2026-09-15", libelle: "VIR DUPONT JEAN COTISATION 2026", credit: 150, compteAttribué: "756", account: "756", memberAssociated: false, datePaiement: "15/09/2026" },
    { id: "tx-asso-2", date: "2026-09-14", libelle: "VIR MARTIN SOPHIE STAGE GUITARE", credit: 350, compteAttribué: "706", account: "706", memberAssociated: true, datePaiement: "14/09/2026", associatedMember: "Martin Sophie" },
    { id: "tx-asso-3", date: "2026-09-10", libelle: "VIREMENT LEMOINE PIERRE COURS", credit: 100, compteAttribué: "706", account: "706", memberAssociated: false, datePaiement: "10/09/2026" }
  ];

  let allAssoTransactions = $derived(() => {
    const fromStore = $transactions.filter(t => 
      (t.compteAttribué === "756" || t.compteAttribué === "706" || t.compteCredit === "756" || t.compteCredit === "706" || t.compte === "756" || t.compte === "706") && t.credit > 0
    );
    if (fromStore.length > 0) return fromStore;
    return sampleAssoTx;
  });

  let filteredOperations = $derived(
    allAssoTransactions().filter(t => activeTab === "a_attribuer" ? !t.memberAssociated : t.memberAssociated)
  );

  let report = $derived($members.map(m => {
    const resteAPayer = m.forfait - m.dejaPaye;
    let statut = "Payé";
    let badgeClass = "badge-success";

    if (resteAPayer > 0) {
      statut = m.dejaPaye > 0 ? "Partiel" : "Impayé";
      badgeClass = m.dejaPaye > 0 ? "badge-warning" : "badge-danger";
    } else if (resteAPayer < 0) {
      statut = "Trop perçu";
      badgeClass = "badge-muted";
    }

    return {
      ...m,
      resteAPayer,
      statut,
      badgeClass
    };
  }));

  function cleanNameFromLabel(label) {
    if (!label) return "";
    let cleaned = label
      .replace(/VIR(EMENT)?/gi, "")
      .replace(/COTISATION|COURS|STAGE|ADHERENT|2025|2026/gi, "")
      .trim();
    return cleaned || label;
  }

  function openAssociationModal(tx) {
    selectedTx = tx;
    nomEleve = cleanNameFromLabel(tx.libelle);
    montantVerse = tx.credit || 0;
    montantTotalPercevoir = tx.credit || 350;
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    selectedTx = null;
    nomEleve = "";
    montantVerse = 0;
    montantTotalPercevoir = "";
  }

  function validerAssociation(e) {
    e.preventDefault();
    if (!nomEleve || !montantTotalPercevoir) return;

    const totalExpected = parseFloat(montantTotalPercevoir) || 0;
    const paidAmount = parseFloat(montantVerse) || 0;

    const existingIndex = $members.findIndex(m => m.nom.toLowerCase() === nomEleve.trim().toLowerCase());
    
    if (existingIndex >= 0) {
      const updated = [...$members];
      updated[existingIndex] = {
        ...updated[existingIndex],
        dejaPaye: updated[existingIndex].dejaPaye + paidAmount,
        forfait: totalExpected || updated[existingIndex].forfait,
        payeLe: selectedTx?.date || selectedTx?.datePaiement || new Date().toLocaleDateString("fr-FR")
      };
      updateMembers(updated);
    } else {
      const newMember = {
        id: Date.now(),
        nom: nomEleve.trim(),
        forfait: totalExpected,
        dejaPaye: paidAmount,
        payeLe: selectedTx?.date || selectedTx?.datePaiement || new Date().toLocaleDateString("fr-FR"),
        email: nomEleve.trim().toLowerCase().replace(/\s+/g, ".") + "@email.com"
      };
      updateMembers([...$members, newMember]);
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
    let currentTxList = []; transactions.subscribe(v => currentTxList = v)();
    let updatedTx = [...currentTxList];
    let count = 0;

    toAssociate.forEach(tx => {
      const nom = cleanNameFromLabel(tx.libelle);
      const paidAmount = parseFloat(tx.credit) || 0;

      const existingIndex = updatedMembers.findIndex(m => m.nom.toLowerCase() === nom.trim().toLowerCase());
      if (existingIndex >= 0) {
        updatedMembers[existingIndex] = {
          ...updatedMembers[existingIndex],
          dejaPaye: updatedMembers[existingIndex].dejaPaye + paidAmount
        };
      } else {
        updatedMembers.push({
          id: Date.now() + Math.random(),
          nom: nom.trim(),
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

    updateMembers(updatedMembers);
    if (updatedTx.length > 0) updateTransactions(updatedTx);

    showToast("✅ Opérations associées avec succès !");
  }

  function handleCreateMember(e) {
    e.preventDefault();
    if (!newNom || !newEmail || !newForfait) return;

    const nouveau = {
      id: Date.now(),
      nom: newNom,
      email: newEmail,
      forfait: parseFloat(newForfait) || 0,
      dejaPaye: 0,
      payeLe: "-"
    };

    updateMembers([...$members, nouveau]);
    newNom = "";
    newEmail = "";
    newForfait = "";
    showToast("✅ Nouvel élève inscrit au registre !");
  }

  function relancerMembre(m) {
    alert("✉️ Un email de relance a été envoyé.");
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

  <div class="info-banner" style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); padding: 16px; border-radius: 12px; margin-bottom: 24px; display: flex; align-items: center; gap: 14px;">
    <span style="font-size: 1.5rem;">💡</span>
    <div style="font-size: 0.9rem; color: rgba(255, 255, 255, 0.85); line-height: 1.4;">
      <strong>Comment fonctionne la liaison bancaire ?</strong><br/>
      Lorsque vous classez une recette bancaire dans la catégorie des <strong>cotisations (compte 756 ou 706)</strong>, le SaaS cherche automatiquement si le nom d'un de vos élèves est mentionné dans le libellé du virement. Si c'est le cas, son solde est mis à jour instantanément sans saisie manuelle supplémentaire !
    </div>
  </div>

  <!-- Import Banner Full Width -->
  <div class="glass-card" style="margin-bottom: 24px;">
    <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap;">
      <div style="max-width: 600px;">
        <h3 style="font-family: var(--font-title); margin-bottom: 6px; display: flex; align-items: center; gap: 10px;">
          <i class="fa-solid fa-file-import" style="color: #818cf8;"></i> Importer la liste des adhérents & élèves
        </h3>
        <p style="font-size: 0.88rem; color: rgba(255, 255, 255, 0.7); margin: 0; line-height: 1.4;">
          Importez votre fichier CSV de registre d'élèves pour calculer automatiquement les statuts (cotisations dues, manquantes, etc.).
        </p>
      </div>

      <div style="display: flex; align-items: center; gap: 16px; flex-grow: 1; justify-content: flex-end;">
        <div class="file-upload-zone" style="border: 2px dashed rgba(99, 102, 241, 0.4); background: rgba(99, 102, 241, 0.05); padding: 12px 24px; border-radius: 10px; text-align: center; cursor: pointer;">
          <div style="font-weight: 600; font-size: 0.88rem; color: white; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-cloud-arrow-up" style="color: #818cf8;"></i> Glisser le fichier CSV ici
          </div>
        </div>

        <button type="button" class="btn btn-primary" style="padding: 12px 20px; display: flex; align-items: center; gap: 8px; font-weight: 600; white-space: nowrap;" onclick={() => showToast("ℹ️ Sélectionnez votre fichier CSV pour mettre à jour la liste des adhérents.")}>
          <i class="fa-solid fa-upload"></i> Importer & Mettre à jour la liste
        </button>
      </div>
    </div>
  </div>

  <!-- Full Width Student Register -->
  <div class="glass-card">
    <h3 style="font-family: var(--font-title); margin-bottom: 20px;">Registre des élèves</h3>
    
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
          {#if report.length === 0}
            <tr>
              <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 30px;">
                Aucun élève enregistré pour le moment.
              </td>
            </tr>
          {:else}
            {#each report as m}
              <tr>
                <td style="font-weight: 600; color: white;">{m.nom}</td>
                <td>{m.forfait} €</td>
                <td style="color: #34d399; font-weight: 600;">{m.dejaPaye} €</td>
                <td style="color: {m.resteAPayer > 0 ? '#f87171' : 'var(--text-secondary)'}; font-weight: 600;">
                  {m.resteAPayer.toFixed(2)} €
                </td>
                <td>
                  <span class="badge {m.badgeClass}">{m.statut}</span>
                </td>
                <td>
                  {#if m.resteAPayer > 0}
                    <button class="btn btn-secondary btn-sm" onclick={() => relancerMembre(m)}>
                      <i class="fa-solid fa-paper-plane"></i> Relancer
                    </button>
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

{#if showModal}
  <div class="modal-backdrop" onclick={closeModal} role="presentation">
    <div class="glass-card modal-content" onclick={(e) => e.stopPropagation()} role="dialog">
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
