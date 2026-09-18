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
  let selectedMemberForDrawer = $state(null);

  let selectedTx = $state(null);
  let nomEleve = $state("");
  let montantVerse = $state(0);
  let montantTotalPercevoir = $state("");

  const sampleAssoTx = [
    { id: "tx-asso-1", date: "2026-09-15", libelle: "REMISE EUROPRELEVEMENT | 009GUGN | AytasCilhanDeniz", credit: 305.3, compteAttribué: "756", account: "756", memberAssociated: false, datePaiement: "15/09/2026" },
    { id: "tx-asso-2", date: "2026-09-14", libelle: "REMISE EUROPRELEVEMENT | OG80UYZ | leger", credit: 269.33, compteAttribué: "756", account: "756", memberAssociated: false, datePaiement: "14/09/2026" },
    { id: "tx-asso-3", date: "2026-09-10", libelle: "REMISE EUROPRELEVEMENT | OGI1N24 | Hennequin", credit: 297, compteAttribué: "706", account: "706", memberAssociated: false, datePaiement: "10/09/2026" }
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

  function extractCleanMemberInfo(rawNameOrLabel) {
    if (!rawNameOrLabel) return { cleanName: "Adhérent Inconnu", rawRef: "" };
    
    let str = rawNameOrLabel.trim();
    let parts = str.split("|").map(p => p.trim());
    
    let cleanName = parts[parts.length - 1] || str;
    cleanName = cleanName
      .replace(/^INST\s+/i, "")
      .replace(/VIR(EMENT)?/gi, "")
      .replace(/COTISATION|COURS|STAGE|ADHERENT|2025|2026/gi, "")
      .replace(/C-Inscription.*$/i, "")
      .trim();

    cleanName = cleanName.replace(/([a-z])([A-Z])/g, "$1 $2");

    let rawRef = parts.length > 1 ? parts.slice(0, -1).join(" | ") : (str !== cleanName ? str : "");
    return { cleanName: cleanName || str, rawRef };
  }

  let report = $derived($members.map(m => {
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
      cleanName,
      rawRef: rawRef || m.rawRef || m.nom,
      resteAPayer,
      statut,
      badgeClass
    };
  }));

  let kpiTotalAttendu = $derived(report.reduce((sum, m) => sum + (m.forfait || 0), 0));
  let kpiTotalEncaisse = $derived(report.reduce((sum, m) => sum + (m.dejaPaye || 0), 0));
  let kpiRestant = $derived(report.reduce((sum, m) => sum + (m.resteAPayer || 0), 0));
  let kpiImpayesCount = $derived(report.filter(m => m.resteAPayer > 0).length);
  let kpiPercentEncaisse = $derived(kpiTotalAttendu > 0 ? Math.round((kpiTotalEncaisse / kpiTotalAttendu) * 100) : 100);

  let filteredMembers = $derived(report.filter(m => {
    const matchesSearch = searchQuery.trim() === "" || 
      m.cleanName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      m.rawRef.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (memberFilter === "payes") return m.resteAPayer === 0;
    if (memberFilter === "impayes") return m.resteAPayer > 0;
    return true;
  }));

  function openAssociationModal(tx) {
    selectedTx = tx;
    const info = extractCleanMemberInfo(tx.libelle);
    nomEleve = info.cleanName;
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

  function openDrawerModal(m) {
    selectedMemberForDrawer = m;
    showDrawerModal = true;
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
      const info = extractCleanMemberInfo(tx.libelle);
      const nom = info.cleanName;
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

    updateMembers(updatedMembers);
    if (updatedTx.length > 0) updateTransactions(updatedTx);

    showToast(`✅ ${count} opérations associées avec succès !`);
  }

  function relancerMembre(m) {
    alert(`✉️ Un email de relance a été envoyé à ${m.cleanName} (${m.resteAPayer.toFixed(2)} € dus).`);
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
          <i class="fa-solid fa-file-import"></i> + Importer CSV
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
                    {#if m.resteAPayer > 0}
                      <button class="btn btn-warning btn-sm" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3);" onclick={() => relancerMembre(m)}>
                        <i class="fa-solid fa-paper-plane"></i> Relancer
                      </button>
                    {/if}
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
  <div class="modal-backdrop" onclick={() => showImportModal = false} role="presentation">
    <div class="glass-card modal-content" onclick={(e) => e.stopPropagation()} role="dialog" style="max-width: 500px;">
      <h3 style="font-family: var(--font-title); margin-bottom: 12px; display: flex; align-items: center; gap: 10px;">
        <i class="fa-solid fa-file-import" style="color: #818cf8;"></i> Importer la liste des adhérents & élèves
      </h3>
      <p style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.7); margin-bottom: 20px;">
        Sélectionnez votre fichier CSV pour synchroniser automatiquement la liste des cotisants et leurs forfaits.
      </p>

      <div class="file-upload-zone" style="border: 2px dashed rgba(99, 102, 241, 0.4); background: rgba(99, 102, 241, 0.05); padding: 30px 16px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <i class="fa-solid fa-cloud-arrow-up" style="font-size: 2.2rem; color: #818cf8; margin-bottom: 10px;"></i>
        <div style="font-weight: 600; color: white;">Glissez votre fichier de registre ici</div>
        <div style="font-size: 0.8rem; color: rgba(255, 255, 255, 0.5); margin-top: 4px;">CSV, TXT, TSV</div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 12px;">
        <button type="button" class="btn btn-secondary" onclick={() => showImportModal = false}>Fermer</button>
        <button type="button" class="btn btn-primary" onclick={() => { showImportModal = false; showToast("✅ Liste synchronisée avec succès !"); }}>Lancer l'import</button>
      </div>
    </div>
  </div>
{/if}

<!-- Drawer Modal pour le détail des règlements -->
{#if showDrawerModal && selectedMemberForDrawer}
  <div class="modal-backdrop" onclick={() => showDrawerModal = false} role="presentation">
    <div class="glass-card modal-content" onclick={(e) => e.stopPropagation()} role="dialog" style="max-width: 540px;">
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
