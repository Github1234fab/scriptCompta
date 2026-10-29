<script>
  import { 
    members, 
    updateMembers, 
    transactions, 
    updateTransactions, 
    showToast, 
    formatDateFr 
  } from "../lib/store.js";
  import InfoTip from "./InfoTip.svelte";

  // Deux modes : 'releve' (Journal des recettes bancaires réelles) ou 'pointage' (Suivi individuel des impayés avec forfaits)
  let displayMode = $state("releve");

  // Filtres
  let txFilter = $state("tous"); // 'tous', '756', '706', '487'
  let memberFilter = $state("tous"); // 'tous', 'payes', 'impayes'
  let searchQuery = $state("");

  // Modales
  let showImportModal = $state(false);
  let showDrawerModal = $state(false);
  /** @type {any} */
  let selectedMemberForDrawer = $state(null);

  // Pagination & Vue
  let currentPage = $state(1);
  let pageSize = $state(12);
  let viewMode = $state("pagination"); // 'pagination' (Feuillets) ou 'scroll' (Vue globale)

  // 1. EXTRACTION DE TOUTES LES RECETTES ASSOCIATIVES (756, 706, 487)
  let allAssoTransactions = $derived.by(() => {
    return $transactions
      .filter((/** @type {any} */ t) => {
        const cpt = String(t.compteAttribué || t.compteCredit || t.compte || t.account || "").trim();
        const isEligible = cpt === "756" || cpt === "706" || cpt.startsWith("706") || cpt === "487";
        return isEligible && Number(t.credit) > 0;
      })
      .slice()
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  });

  // Métriques financières réelles de la banque
  let totalRecettes756 = $derived(
    allAssoTransactions
      .filter(t => (t.compteAttribué || t.compteCredit || t.compte || t.account) === "756")
      .reduce((sum, t) => sum + (parseFloat(t.credit) || 0), 0)
  );

  let totalRecettes706 = $derived(
    allAssoTransactions
      .filter(t => {
        const c = String(t.compteAttribué || t.compteCredit || t.compte || t.account || "");
        return c === "706" || c.startsWith("706");
      })
      .reduce((sum, t) => sum + (parseFloat(t.credit) || 0), 0)
  );

  let totalRecettes487 = $derived(
    allAssoTransactions
      .filter(t => (t.compteAttribué || t.compteCredit || t.compte || t.account) === "487")
      .reduce((sum, t) => sum + (parseFloat(t.credit) || 0), 0)
  );

  let totalGlobalRecettes = $derived(totalRecettes756 + totalRecettes706);

  let countTx756 = $derived(
    allAssoTransactions.filter(t => (t.compteAttribué || t.compteCredit || t.compte || t.account) === "756").length
  );
  let countTx706 = $derived(
    allAssoTransactions.filter(t => {
      const c = String(t.compteAttribué || t.compteCredit || t.compte || t.account || "");
      return c === "706" || c.startsWith("706");
    }).length
  );
  let countTx487 = $derived(
    allAssoTransactions.filter(t => (t.compteAttribué || t.compteCredit || t.compte || t.account) === "487").length
  );

  // Filtrage du relevé bancaire
  let filteredTransactions = $derived.by(() => {
    return allAssoTransactions.filter(t => {
      const cpt = String(t.compteAttribué || t.compteCredit || t.compte || t.account || "");
      if (txFilter === "756" && cpt !== "756") return false;
      if (txFilter === "706" && !(cpt === "706" || cpt.startsWith("706"))) return false;
      if (txFilter === "487" && cpt !== "487") return false;

      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase().trim();
        const libelle = String(t.libelle || "").toLowerCase();
        const emetteur = String(t.associatedMember || "").toLowerCase();
        return libelle.includes(q) || emetteur.includes(q);
      }
      return true;
    });
  });

  // Pagination des transactions
  let totalTxPages = $derived(Math.ceil(filteredTransactions.length / pageSize) || 1);
  let paginatedTransactions = $derived(
    filteredTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  );
  let displayedTransactions = $derived(
    viewMode === "pagination" ? paginatedTransactions : filteredTransactions
  );

  // 2. NETTOYAGE DES NOMS ET LOGIQUE POINTAGE INDIVIDUEL (SI ACTIVÉ)
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

  // KPIs et liste pour le mode Pointage adhérents
  let report = $derived.by(() => {
    return ($members || []).map((/** @type {any} */ m) => {
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

      return {
        ...m,
        cleanName: cleanMemberName(m.nom),
        resteAPayer,
        statut,
        badgeClass
      };
    });
  });

  let kpiTotalAttendu = $derived(report.reduce((sum, m) => sum + (m.forfait || 0), 0));
  let kpiTotalEncaissePointage = $derived(report.reduce((sum, m) => sum + (m.dejaPaye || 0), 0));
  let kpiRestant = $derived(report.reduce((sum, m) => sum + (m.resteAPayer || 0), 0));
  let kpiImpayesCount = $derived(report.filter(m => m.resteAPayer > 0).length);

  let filteredMembers = $derived(report.filter((/** @type {any} */ m) => {
    const matchesSearch = searchQuery.trim() === "" || 
      m.cleanName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      String(m.nom).toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (memberFilter === "payes") return m.resteAPayer === 0;
    if (memberFilter === "impayes") return m.resteAPayer > 0;
    return true;
  }));

  let totalMemberPages = $derived(Math.ceil(filteredMembers.length / pageSize) || 1);
  let paginatedMembers = $derived(
    filteredMembers.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  );
  let displayedMembers = $derived(
    viewMode === "pagination" ? paginatedMembers : filteredMembers
  );

  // Réinitialisation de la page lors du changement de filtre
  $effect(() => {
    searchQuery;
    txFilter;
    memberFilter;
    displayMode;
    currentPage = 1;
  });

  // 3. ACTIONS DE REPORT EN COMPTE 487 (PRODUITS CONSTATÉS D'AVANCE)
  /** @param {string} txId */
  function basculerVers487(txId) {
    const txList = [...$transactions];
    const idx = txList.findIndex(t => t.id === txId);
    if (idx >= 0) {
      const currentCpt = txList[idx].compteAttribué || txList[idx].compteCredit || txList[idx].compte || txList[idx].account || "706";
      txList[idx] = {
        ...txList[idx],
        originalCompteRecette: currentCpt,
        compteAttribué: "487",
        compteCredit: "487",
        compte: "487",
        account: "487"
      };
      updateTransactions(txList);
      showToast("Opération reportée sur l'exercice suivant (Compte 487) !");
    }
  }

  /** @param {string} txId */
  function retablirCompteRecette(txId) {
    const txList = [...$transactions];
    const idx = txList.findIndex(t => t.id === txId);
    if (idx >= 0) {
      const restored = txList[idx].originalCompteRecette || "706";
      txList[idx] = {
        ...txList[idx],
        compteAttribué: restored,
        compteCredit: restored,
        compte: restored,
        account: restored
      };
      delete txList[idx].originalCompteRecette;
      updateTransactions(txList);
      showToast(`Opération rétablie en compte ${restored} !`);
    }
  }

  // 4. EXPORT CSV DU RELEVÉ OU DU REGISTRE
  function exporterCSV() {
    let csvContent = "";
    let fileName = "";

    if (displayMode === "releve") {
      fileName = `releve_recettes_756_706_${new Date().toISOString().slice(0, 10)}.csv`;
      const header = ["Date", "Compte", "Libelle", "Emetteur_Detecte", "Montant_Credit_EUR", "Statut_Exercice"].join(";");
      const rows = filteredTransactions.map(t => {
        const cpt = t.compteAttribué || t.compteCredit || t.compte || t.account || "706";
        const statut = cpt === "487" ? "Reporté exercice suivant (487)" : "Recette exercice courant";
        const cleanName = cleanMemberName(t.libelle);
        return [
          t.date || "",
          cpt,
          `"${(t.libelle || "").replace(/"/g, '""')}"`,
          `"${cleanName.replace(/"/g, '""')}"`,
          Number(t.credit || 0).toFixed(2).replace(".", ","),
          statut
        ].join(";");
      });
      csvContent = "\uFEFF" + [header, ...rows].join("\r\n");
    } else {
      fileName = `suivi_adherents_${new Date().toISOString().slice(0, 10)}.csv`;
      const header = ["Nom_Adherent", "Forfait_Attendu_EUR", "Deja_Verse_EUR", "Reste_A_Payer_EUR", "Statut"].join(";");
      const rows = filteredMembers.map(m => {
        return [
          `"${m.cleanName.replace(/"/g, '""')}"`,
          Number(m.forfait || 0).toFixed(2).replace(".", ","),
          Number(m.dejaPaye || 0).toFixed(2).replace(".", ","),
          Number(m.resteAPayer || 0).toFixed(2).replace(".", ","),
          m.statut
        ].join(";");
      });
      csvContent = "\uFEFF" + [header, ...rows].join("\r\n");
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Export CSV téléchargé (${fileName}) !`);
  }

  // 5. IMPORT CSV POUR LE SUIVI DES TARIFS ANNUELS
  let importFileName = $state("");
  let rawPasteText = $state("");
  let activeImportTab = $state("file");
  /** @type {Array<{nom: string, forfait: number}>} */
  let importedRows = $state([]);

  function telechargerModeleCSV() {
    const csvContent = "Nom_Eleve_ou_Adherent;Tarif_Annuel_Contractuel\nDupont Marc;450.00\nMartin Sophie;600.00\nPetit Thomas;320.00\n";
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "modele_tarifs_inscrits.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Modèle CSV téléchargé !");
  }

  /** @param {any} e */
  function handleFileSelect(e) {
    const file = e.target?.files?.[0] || e.dataTransfer?.files?.[0];
    if (!file) return;
    importFileName = file.name;
    const reader = new FileReader();
    reader.onload = (evt) => {
      parseCSVMembers(/** @type {string} */ (evt.target?.result || ""));
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
    const cleanText = csvText.replace(/^\uFEFF/, "").trim();
    const lines = cleanText.split(/\r\n|\r|\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      importedRows = [];
      return;
    }

    const firstLine = lines[0];
    const sep = firstLine.includes(";") ? ";" : (firstLine.includes("\t") ? "\t" : ",");
    const startIndex = (firstLine.toLowerCase().includes("nom") || firstLine.toLowerCase().includes("adherent")) ? 1 : 0;

    const rows = [];
    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(sep).map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= 2) {
        const nom = parts[0];
        const forfaitRaw = parts[1].replace(/\s/g, '').replace(',', '.').replace('€', '');
        const forfait = parseFloat(forfaitRaw) || 0;
        if (nom) rows.push({ nom, forfait });
      }
    }
    importedRows = rows;
  }

  function validerImportTarifs() {
    if (importedRows.length === 0) {
      showToast("Veuillez sélectionner ou coller une liste valide.");
      return;
    }

    // Fusionner avec les règlements bancaires réels détectés
    const newMembers = importedRows.map(row => {
      // Trouver tous les règlements bancaires correspondants
      const matchingTx = allAssoTransactions.filter(t => {
        const cleanTx = cleanMemberName(t.libelle).toLowerCase();
        const cleanRow = row.nom.toLowerCase();
        return cleanTx.includes(cleanRow) || cleanRow.includes(cleanTx);
      });
      const dejaPaye = matchingTx.reduce((sum, t) => sum + (parseFloat(t.credit) || 0), 0);
      return {
        id: Date.now() + Math.random(),
        nom: row.nom,
        forfait: row.forfait,
        dejaPaye,
        email: row.nom.toLowerCase().replace(/\s+/g, ".") + "@email.com"
      };
    });

    updateMembers(newMembers);
    showImportModal = false;
    displayMode = "pointage";
    showToast(`${newMembers.length} adhérents importés avec succès ! Pointage activé.`);
  }
</script>

<style>
  .kpi-box {
    background: #ffffff;
    border: 1.5px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    border-radius: 12px;
    padding: 20px 22px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 12px;
  }
  .table-row-hover:hover {
    background: #f8fafc !important;
  }
</style>

<!-- KPI CARDS SUPÉRIEURES -->
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
  
  {#if displayMode === "releve"}
    <!-- KPI 1 : Total Encaissé en 756 & 706 -->
    <div class="kpi-box">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
        <span style="font-size: 0.74rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; white-space: nowrap;">TOTAL ENCAISSÉ (756 & 706)</span>
        <span style="font-size: 0.72rem; font-weight: 700; color: #166534; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 2px 7px; border-radius: 8px; white-space: nowrap; flex-shrink: 0;">
          En banque
        </span>
      </div>
      <div>
        <div style="font-size: 1.75rem; font-weight: 800; color: #0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: -0.5px;">
          {totalGlobalRecettes.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
        </div>
      </div>
    </div>

    <!-- KPI 2 : Cotisations 756 -->
    <div class="kpi-box">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 0.74rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;">COTISATIONS & ADHÉSIONS (756)</span>
        <InfoTip text="Ventilation automatique entre ce qui relève de l'adhésion pure (756) et des prestations/cours (706)." width="250px" />
      </div>
      <div>
        <div style="font-size: 1.75rem; font-weight: 800; color: #0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: -0.5px;">
          {totalRecettes756.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
        </div>
        <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">{countTx756} règlements</div>
      </div>
    </div>

    <!-- KPI 3 : Cours & Activités 706 -->
    <div class="kpi-box">
      <div>
        <span style="font-size: 0.74rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;">COURS & FORFAITS (706)</span>
      </div>
      <div>
        <div style="font-size: 1.75rem; font-weight: 800; color: #0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: -0.5px;">
          {totalRecettes706.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
        </div>
        <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">{countTx706} règlements</div>
      </div>
    </div>

    <!-- KPI 4 : Reports saison future 487 -->
    <div class="kpi-box">
      <div>
        <span style="font-size: 0.74rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;">REPORTS SAISON SUIVANTE (487)</span>
      </div>
      <div>
        <div style="font-size: 1.75rem; font-weight: 800; color: {totalRecettes487 > 0 ? '#b45309' : '#0f172a'}; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: -0.5px;">
          {totalRecettes487.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
        </div>
        <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">
          {countTx487} règlement{countTx487 > 1 ? 's' : ''} neutralisé{countTx487 > 1 ? 's' : ''}
        </div>
      </div>
    </div>

  {:else}
    <!-- KPIs DU MODE POINTAGE INDIVIDUEL (SANS ICÔNES) -->
    <div class="kpi-box">
      <span style="font-size: 0.74rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;">TOTAL ATTENDU FACTURÉ</span>
      <div style="font-size: 1.75rem; font-weight: 800; color: #0f172a; font-family: ui-monospace, monospace;">
        {kpiTotalAttendu.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
      </div>
    </div>

    <div class="kpi-box">
      <span style="font-size: 0.74rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;">DÉJÀ ENCAISSÉ</span>
      <div style="font-size: 1.75rem; font-weight: 800; color: #166534; font-family: ui-monospace, monospace;">
        {kpiTotalEncaissePointage.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
      </div>
    </div>

    <div class="kpi-box">
      <span style="font-size: 0.74rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;">RESTE À RECOUVRER</span>
      <div style="font-size: 1.75rem; font-weight: 800; color: {kpiRestant > 0 ? '#dc2626' : '#0f172a'}; font-family: ui-monospace, monospace;">
        {kpiRestant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
      </div>
    </div>

    <div class="kpi-box">
      <span style="font-size: 0.74rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;">PAYEURS EN RETARD</span>
      <div style="font-size: 1.75rem; font-weight: 800; color: #0f172a; font-family: ui-monospace, monospace;">
        {kpiImpayesCount} <span style="font-size: 1rem; color: #64748b;">personne{kpiImpayesCount > 1 ? 's' : ''}</span>
      </div>
    </div>
  {/if}

</div>

<!-- BANDEAU D'EXPLICATION & IMPORT -->
{#if displayMode === "releve"}
  <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 12px; padding: 14px 20px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
    <div style="flex: 1; min-width: 300px;">
      <p style="margin: 0; font-size: 0.86rem; color: #1e40af; line-height: 1.45; display: flex; align-items: flex-start; gap: 8px;">
        <span>Par défaut, ce tableau affiche tous vos encaissements bancaires réels. Vous pouvez également importer un fichier CSV simple comprenant deux colonnes (<strong>colonne A :</strong> nom des payeurs, <strong>colonne B :</strong> montant facturé). Notre système calculera alors automatiquement vos restes dus et indicateurs de suivi.</span>
        <InfoTip text="Importez votre liste nominative d'adhérents (Colonnes Nom / Montant) pour automatiser le rapprochement individuel." width="250px" />
      </p>
    </div>
    <div>
      <button 
        type="button" 
        onclick={() => showImportModal = true}
        style="background: #2563eb; color: #ffffff; border: none; padding: 9px 20px; border-radius: 8px; font-weight: 700; font-size: 0.88rem; cursor: pointer; box-shadow: 0 2px 6px rgba(37,99,235,0.25);"
      >
        Importer
      </button>
    </div>
  </div>
{:else}
  <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 12px 18px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
    <div style="font-size: 0.88rem; font-weight: 700; color: #0f172a;">
      Suivi individuel actif ({$members.length} payeurs importés)
    </div>
    <div style="display: flex; gap: 10px;">
      <button 
        type="button"
        onclick={() => showImportModal = true}
        style="background: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; padding: 6px 14px; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer;"
      >
        Mettre à jour le fichier
      </button>
      <button 
        type="button"
        onclick={() => displayMode = "releve"}
        style="background: #0f172a; color: #ffffff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 0.82rem; cursor: pointer;"
      >
        Revenir au relevé bancaire
      </button>
    </div>
  </div>
{/if}

<!-- CONTENEUR DU TABLEAU DE GESTION -->
<div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 24px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);">
  
  <!-- BARRE D'OUTILS -->
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
    
    <!-- Filtres par pastilles -->
    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
      {#if displayMode === "releve"}
        <button 
          style="padding: 7px 14px; border-radius: 20px; font-size: 0.84rem; font-weight: 600; cursor: pointer; transition: all 0.15s; {txFilter === 'tous' ? 'background: #0f172a; color: white; border: 1px solid #0f172a;' : 'background: #f8fafc; color: #475569; border: 1px solid #cbd5e1;'}"
          onclick={() => txFilter = 'tous'}
        >
          Tous <span style="font-weight: 700; font-size: 0.75rem; margin-left: 4px;">({allAssoTransactions.length})</span>
        </button>

        <button 
          style="padding: 7px 14px; border-radius: 20px; font-size: 0.84rem; font-weight: 600; cursor: pointer; transition: all 0.15s; {txFilter === '756' ? 'background: #0f172a; color: white; border: 1px solid #0f172a;' : 'background: #f8fafc; color: #475569; border: 1px solid #cbd5e1;'}"
          onclick={() => txFilter = '756'}
        >
          756 · Cotisations <span style="font-weight: 700; font-size: 0.75rem; margin-left: 4px;">({countTx756})</span>
        </button>

        <button 
          style="padding: 7px 14px; border-radius: 20px; font-size: 0.84rem; font-weight: 600; cursor: pointer; transition: all 0.15s; {txFilter === '706' ? 'background: #0f172a; color: white; border: 1px solid #0f172a;' : 'background: #f8fafc; color: #475569; border: 1px solid #cbd5e1;'}"
          onclick={() => txFilter = '706'}
        >
          706 · Cours <span style="font-weight: 700; font-size: 0.75rem; margin-left: 4px;">({countTx706})</span>
        </button>

        <button 
          style="padding: 7px 14px; border-radius: 20px; font-size: 0.84rem; font-weight: 600; cursor: pointer; transition: all 0.15s; {txFilter === '487' ? 'background: #b45309; color: white; border: 1px solid #b45309;' : 'background: #f8fafc; color: #475569; border: 1px solid #cbd5e1;'}"
          onclick={() => txFilter = '487'}
        >
          487 · Reports <span style="font-weight: 700; font-size: 0.75rem; margin-left: 4px;">({countTx487})</span>
        </button>
      {:else}
        <button 
          style="padding: 7px 14px; border-radius: 20px; font-size: 0.84rem; font-weight: 600; cursor: pointer; {memberFilter === 'tous' ? 'background: #0f172a; color: white; border: 1px solid #0f172a;' : 'background: #f8fafc; color: #475569; border: 1px solid #cbd5e1;'}"
          onclick={() => memberFilter = 'tous'}
        >
          Tous ({report.length})
        </button>
        <button 
          style="padding: 7px 14px; border-radius: 20px; font-size: 0.84rem; font-weight: 600; cursor: pointer; {memberFilter === 'payes' ? 'background: #0f172a; color: white; border: 1px solid #0f172a;' : 'background: #f8fafc; color: #475569; border: 1px solid #cbd5e1;'}"
          onclick={() => memberFilter = 'payes'}
        >
          À jour ({report.filter(m => m.resteAPayer === 0).length})
        </button>
        <button 
          style="padding: 7px 14px; border-radius: 20px; font-size: 0.84rem; font-weight: 600; cursor: pointer; {memberFilter === 'impayes' ? 'background: #0f172a; color: white; border: 1px solid #0f172a;' : 'background: #f8fafc; color: #475569; border: 1px solid #cbd5e1;'}"
          onclick={() => memberFilter = 'impayes'}
        >
          Impayés ({kpiImpayesCount})
        </button>
      {/if}

      <!-- Switcher Feuillets / Scroll -->
      <div style="display: flex; background: #f1f5f9; padding: 2px; border-radius: 18px; border: 1px solid #e2e8f0; margin-left: 8px;">
        <button 
          type="button"
          style="padding: 5px 11px; font-size: 0.78rem; font-weight: 600; border-radius: 14px; border: none; cursor: pointer; {viewMode === 'pagination' ? 'background: #ffffff; color: #0f172a; box-shadow: 0 1px 3px rgba(0,0,0,0.1);' : 'background: transparent; color: #64748b;'}"
          onclick={() => viewMode = 'pagination'}
        >
          <i class="fa-solid fa-file-lines"></i> Feuillets
        </button>
        <button 
          type="button"
          style="padding: 5px 11px; font-size: 0.78rem; font-weight: 600; border-radius: 14px; border: none; cursor: pointer; {viewMode === 'scroll' ? 'background: #ffffff; color: #0f172a; box-shadow: 0 1px 3px rgba(0,0,0,0.1);' : 'background: transparent; color: #64748b;'}"
          onclick={() => viewMode = 'scroll'}
        >
          <i class="fa-solid fa-scroll"></i> Scroll
        </button>
      </div>
    </div>

    <!-- Recherche & Export CSV -->
    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
      <div style="position: relative; display: flex; align-items: center;">
        <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 14px; color: #94a3b8; font-size: 0.85rem; pointer-events: none;"></i>
        <input 
          type="text" 
          placeholder="Rechercher par nom / libellé..." 
          bind:value={searchQuery}
          style="padding: 9px 14px 9px 38px; border-radius: 8px; background: #ffffff; border: 1.5px solid #cbd5e1; color: #0f172a; font-size: 0.88rem; width: 250px; outline: none;"
        />
      </div>

      <button 
        type="button"
        onclick={exporterCSV}
        style="padding: 9px 16px; font-weight: 700; font-size: 0.88rem; background: #ffffff; border: 1.5px solid #cbd5e1; color: #0f172a; border-radius: 8px; display: flex; align-items: center; gap: 8px; cursor: pointer;"
        title="Exporter en fichier CSV Excel"
      >
        <i class="fa-solid fa-file-export" style="color: #2563eb;"></i> Exporter CSV
      </button>
    </div>
  </div>

  <!-- TABLEAU (MODE RELEVÉ BANCAIRE PAR DÉFAUT) -->
  {#if displayMode === "releve"}
    <div style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
        <thead>
          <tr style="background: #f8fafc; border-bottom: 1.5px solid #e2e8f0; text-transform: uppercase; font-size: 0.76rem; letter-spacing: 0.6px; color: #475569;">
            <th style="padding: 12px 18px; text-align: left; width: 120px;">Date</th>
            <th style="padding: 12px 18px; text-align: left;">Émetteur / Libellé bancaire</th>
            <th style="padding: 12px 18px; text-align: center; width: 170px;">Compte Comptable</th>
            <th style="padding: 12px 18px; text-align: right; width: 150px;">Montant Encaissé</th>
            <th style="padding: 12px 18px; text-align: right; width: 230px;">
              <span>Action / Période</span>
              <InfoTip text="Isole les cotisations perçues d'avance pour la saison suivante, sans fausser le résultat de l'exercice en cours." width="250px" position="left" />
            </th>
          </tr>
        </thead>
        <tbody>
          {#if displayedTransactions.length === 0}
            <tr>
              <td colspan="5" style="text-align: center; color: #64748b; padding: 45px 10px;">
                Aucun encaissement ne correspond aux critères sélectionnés.
              </td>
            </tr>
          {:else}
            {#each displayedTransactions as t, index}
              {@const cpt = String(t.compteAttribué || t.compteCredit || t.compte || t.account || '706')}
              {@const is487 = cpt === '487'}
              {@const cleanName = cleanMemberName(t.libelle)}
              <tr 
                class="table-row-hover"
                style="border-bottom: 1px solid #f1f5f9; background: {index % 2 === 0 ? '#ffffff' : '#fcfdfe'}; transition: background 0.15s ease;"
              >
                <!-- Date -->
                <td style="padding: 13px 18px; text-align: left; color: #64748b; font-weight: 600; font-size: 0.85rem; white-space: nowrap;">
                  {t.date ? formatDateFr(t.date) : (t.datePaiement || '—')}
                </td>

                <!-- Libellé & Émetteur -->
                <td style="padding: 13px 18px; text-align: left;">
                  <div style="font-weight: 700; color: #0f172a; font-size: 0.95rem;">
                    {cleanName}
                  </div>
                  <div style="font-size: 0.76rem; color: #64748b; margin-top: 2px; word-break: break-all;">
                    {t.libelle || ''}
                  </div>
                </td>

                <!-- Compte Comptable -->
                <td style="padding: 13px 18px; text-align: center; white-space: nowrap;">
                  {#if is487}
                    <span style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-size: 0.75rem; font-weight: 700; padding: 3px 9px; border-radius: 6px;">
                      487 · Saison suivante
                    </span>
                  {:else if cpt === "756"}
                    <span style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 0.75rem; font-weight: 700; padding: 3px 9px; border-radius: 6px;">
                      756 · Cotisations
                    </span>
                  {:else}
                    <span style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 0.75rem; font-weight: 700; padding: 3px 9px; border-radius: 6px;">
                      706 · Cours & Forfaits
                    </span>
                  {/if}
                </td>

                <!-- Montant Encaissé -->
                <td style="padding: 13px 18px; text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-variant-numeric: tabular-nums; font-weight: 800; color: #15803d; font-size: 0.98rem; white-space: nowrap;">
                  + {Number(t.credit || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </td>

                <!-- Action / Report saison suivante (Compte 487) -->
                <td style="padding: 13px 18px; text-align: right; white-space: nowrap;">
                  {#if is487}
                    <button 
                      type="button"
                      onclick={() => retablirCompteRecette(t.id)}
                      style="background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; padding: 5px 11px; border-radius: 6px; font-weight: 600; font-size: 0.78rem; cursor: pointer;"
                      title="Rétablir cette opération dans les recettes de l'exercice courant"
                    >
                      <i class="fa-solid fa-rotate-left"></i> Rétablir en recette
                    </button>
                  {:else}
                    <button 
                      type="button"
                      onclick={() => basculerVers487(t.id)}
                      style="background: #ffffff; border: 1px solid #e2e8f0; color: #475569; padding: 5px 11px; border-radius: 6px; font-weight: 600; font-size: 0.78rem; cursor: pointer; transition: all 0.15s ease;"
                      title="Reporter ce paiement en compte 487 pour l'exercice / saison suivante"
                    >
                      <i class="fa-solid fa-clock-rotate-left" style="color: #f59e0b;"></i> Reporter en 487
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Pagination du relevé -->
    {#if filteredTransactions.length > 0 && viewMode === 'pagination'}
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 18px; font-size: 0.86rem; color: #64748b;">
        <div>
          Affichage <strong>{Math.min((currentPage - 1) * pageSize + 1, filteredTransactions.length)}</strong> à <strong>{Math.min(currentPage * pageSize, filteredTransactions.length)}</strong> sur <strong>{filteredTransactions.length}</strong> règlements
        </div>
        {#if totalTxPages > 1}
          <div style="display: flex; gap: 6px; align-items: center;">
            <button 
              class="btn btn-secondary btn-sm"
              disabled={currentPage === 1}
              onclick={() => currentPage--}
              style="padding: 5px 11px; font-size: 0.8rem; background: #ffffff; border: 1px solid #cbd5e1;"
            >
              <i class="fa-solid fa-chevron-left"></i>
            </button>
            {#each Array.from({ length: totalTxPages }) as _, i}
              {#if i < 7 || i === totalTxPages - 1}
                <button 
                  onclick={() => currentPage = i + 1}
                  style="width: 30px; height: 30px; border-radius: 6px; font-size: 0.82rem; font-weight: 700; cursor: pointer; border: 1px solid {currentPage === i + 1 ? '#0f172a' : '#cbd5e1'}; background: {currentPage === i + 1 ? '#0f172a' : '#ffffff'}; color: {currentPage === i + 1 ? '#ffffff' : '#0f172a'};"
                >
                  {i + 1}
                </button>
              {/if}
            {/each}
            <button 
              class="btn btn-secondary btn-sm"
              disabled={currentPage === totalTxPages}
              onclick={() => currentPage++}
              style="padding: 5px 11px; font-size: 0.8rem; background: #ffffff; border: 1px solid #cbd5e1;"
            >
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        {/if}
      </div>
    {/if}

  {:else}
    <!-- TABLEAU (MODE POINTAGE INDIVIDUEL PAR ÉLÈVE) -->
    <div style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
        <thead>
          <tr style="background: #f8fafc; border-bottom: 1.5px solid #e2e8f0; text-transform: uppercase; font-size: 0.76rem; letter-spacing: 0.6px; color: #475569;">
            <th style="padding: 12px 18px; text-align: left;">Nom de l'adhérent / élève</th>
            <th style="padding: 12px 18px; text-align: right; width: 170px;">Tarif annuel dû</th>
            <th style="padding: 12px 18px; text-align: right; width: 170px;">Déjà versé</th>
            <th style="padding: 12px 18px; text-align: right; width: 170px;">Reste à régler</th>
            <th style="padding: 12px 18px; text-align: center; width: 130px;">Statut</th>
            <th style="padding: 12px 18px; text-align: right; width: 110px;">Détails</th>
          </tr>
        </thead>
        <tbody>
          {#if displayedMembers.length === 0}
            <tr>
              <td colspan="6" style="text-align: center; color: #64748b; padding: 45px 10px;">
                Aucun adhérent ne correspond aux critères.
              </td>
            </tr>
          {:else}
            {#each displayedMembers as m, index}
              <tr 
                class="table-row-hover"
                style="border-bottom: 1px solid #f1f5f9; background: {index % 2 === 0 ? '#ffffff' : '#fcfdfe'}; transition: background 0.15s ease;"
              >
                <td style="padding: 13px 18px; text-align: left; font-weight: 700; color: #0f172a;">
                  {m.cleanName}
                </td>
                <td style="padding: 13px 18px; text-align: right; font-family: ui-monospace, monospace; font-weight: 700;">
                  {Number(m.forfait || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </td>
                <td style="padding: 13px 18px; text-align: right; font-family: ui-monospace, monospace; font-weight: 700; color: {m.dejaPaye > 0 ? '#15803d' : '#64748b'};">
                  {Number(m.dejaPaye || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </td>
                <td style="padding: 13px 18px; text-align: right; font-family: ui-monospace, monospace; font-weight: 700; color: {m.resteAPayer > 0 ? '#dc2626' : '#15803d'};">
                  {Number(m.resteAPayer || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </td>
                <td style="padding: 13px 18px; text-align: center;">
                  <span class="badge {m.badgeClass}" style="font-weight: 700; padding: 4px 10px; font-size: 0.76rem;">{m.statut}</span>
                </td>
                <td style="padding: 13px 18px; text-align: right;">
                  <button 
                    class="btn btn-secondary btn-sm" 
                    onclick={() => { selectedMemberForDrawer = m; showDrawerModal = true; }}
                    style="padding: 5px 11px; font-size: 0.78rem; background: #ffffff; border: 1.5px solid #cbd5e1;"
                  >
                    <i class="fa-solid fa-list-check"></i>
                  </button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Pagination du pointage -->
    {#if filteredMembers.length > 0 && viewMode === 'pagination'}
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 18px; font-size: 0.86rem; color: #64748b;">
        <div>
          Affichage <strong>{Math.min((currentPage - 1) * pageSize + 1, filteredMembers.length)}</strong> à <strong>{Math.min(currentPage * pageSize, filteredMembers.length)}</strong> sur <strong>{filteredMembers.length}</strong> inscrits
        </div>
        {#if totalMemberPages > 1}
          <div style="display: flex; gap: 6px; align-items: center;">
            <button 
              class="btn btn-secondary btn-sm"
              disabled={currentPage === 1}
              onclick={() => currentPage--}
              style="padding: 5px 11px; font-size: 0.8rem; background: #ffffff; border: 1px solid #cbd5e1;"
            >
              <i class="fa-solid fa-chevron-left"></i>
            </button>
            {#each Array.from({ length: totalMemberPages }) as _, i}
              {#if i < 7 || i === totalMemberPages - 1}
                <button 
                  onclick={() => currentPage = i + 1}
                  style="width: 30px; height: 30px; border-radius: 6px; font-size: 0.82rem; font-weight: 700; cursor: pointer; border: 1px solid {currentPage === i + 1 ? '#0f172a' : '#cbd5e1'}; background: {currentPage === i + 1 ? '#0f172a' : '#ffffff'}; color: {currentPage === i + 1 ? '#ffffff' : '#0f172a'};"
                >
                  {i + 1}
                </button>
              {/if}
            {/each}
            <button 
              class="btn btn-secondary btn-sm"
              disabled={currentPage === totalMemberPages}
              onclick={() => currentPage++}
              style="padding: 5px 11px; font-size: 0.8rem; background: #ffffff; border: 1px solid #cbd5e1;"
            >
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        {/if}
      </div>
    {/if}
  {/if}

</div>

<!-- MODALE D'IMPORT CSV DES TARIFS ANNUELS CONTRACTUELS -->
{#if showImportModal}
  <div 
    class="modal-backdrop" 
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    onkeydown={(e) => { if (e.key === 'Escape') showImportModal = false; }}
    style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;"
  >
    <div style="background: #ffffff; border-radius: 16px; width: 100%; max-width: 600px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden; display: flex; flex-direction: column;">
      
      <!-- En-tête -->
      <div style="padding: 20px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
        <div>
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #0f172a;">
            <i class="fa-solid fa-file-import" style="color: #2563eb; margin-right: 8px;"></i> Importer les tarifs annuels des inscrits
          </h3>
          <p style="margin: 4px 0 0 0; font-size: 0.84rem; color: #64748b;">
            Permet de calculer les restes à payer en comparant avec les virements reçus.
          </p>
        </div>
        <button 
          onclick={() => showImportModal = false}
          style="background: none; border: none; font-size: 1.25rem; color: #64748b; cursor: pointer; padding: 4px;"
        >
          &times;
        </button>
      </div>

      <!-- Corps -->
      <div style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
        <div style="display: flex; gap: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">
          <button 
            type="button"
            onclick={() => activeImportTab = 'file'}
            style="padding: 7px 14px; border-radius: 6px; font-weight: 700; font-size: 0.84rem; border: none; cursor: pointer; {activeImportTab === 'file' ? 'background: #0f172a; color: white;' : 'background: #f1f5f9; color: #475569;'}"
          >
            Fichier CSV / Excel
          </button>
          <button 
            type="button"
            onclick={() => activeImportTab = 'paste'}
            style="padding: 7px 14px; border-radius: 6px; font-weight: 700; font-size: 0.84rem; border: none; cursor: pointer; {activeImportTab === 'paste' ? 'background: #0f172a; color: white;' : 'background: #f1f5f9; color: #475569;'}"
          >
            Copier-Coller depuis Excel
          </button>
          <button 
            type="button"
            onclick={telechargerModeleCSV}
            style="margin-left: auto; background: none; border: none; color: #2563eb; font-weight: 700; font-size: 0.82rem; cursor: pointer; text-decoration: underline;"
          >
            Télécharger modèle exemple
          </button>
        </div>

        {#if activeImportTab === 'file'}
          <label style="border: 2px dashed #cbd5e1; border-radius: 12px; padding: 32px 20px; text-align: center; cursor: pointer; background: #f8fafc; display: block;">
            <i class="fa-solid fa-cloud-arrow-up" style="font-size: 2rem; color: #2563eb; margin-bottom: 10px;"></i>
            <div style="font-weight: 700; color: #0f172a; font-size: 0.95rem;">
              {importFileName ? `Fichier : ${importFileName}` : "Cliquez ou glissez-déposez votre fichier CSV"}
            </div>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">
              2 colonnes attendues : Nom de l'élève / adhérent et Tarif annuel
            </div>
            <input type="file" accept=".csv,text/csv" onchange={handleFileSelect} style="display: none;" />
          </label>
        {:else}
          <textarea 
            rows="6"
            placeholder="Collez ici vos deux colonnes depuis Excel (ex: Dupont Marc [Tabulation] 450.00)..."
            bind:value={rawPasteText}
            oninput={(e) => parseCSVMembers(/** @type {any} */ (e.target).value)}
            style="width: 100%; box-sizing: border-box; padding: 12px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-family: ui-monospace, monospace; font-size: 0.85rem; outline: none;"
          ></textarea>
        {/if}

        {#if importedRows.length > 0}
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; font-size: 0.86rem; color: #166534; font-weight: 600;">
            <i class="fa-solid fa-check"></i> {importedRows.length} adhérents détectés avec leurs forfaits annuels.
          </div>
        {/if}
      </div>

      <!-- Pied de modale -->
      <div style="padding: 16px 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px; background: #f8fafc;">
        <button 
          type="button" 
          onclick={() => showImportModal = false}
          style="padding: 9px 16px; border-radius: 8px; background: #ffffff; border: 1px solid #cbd5e1; color: #334155; font-weight: 600; cursor: pointer;"
        >
          Annuler
        </button>
        <button 
          type="button" 
          onclick={validerImportTarifs}
          disabled={importedRows.length === 0}
          style="padding: 9px 18px; border-radius: 8px; background: #2563eb; color: #ffffff; border: none; font-weight: 700; cursor: pointer; opacity: {importedRows.length === 0 ? 0.5 : 1};"
        >
          Valider et activer le pointage
        </button>
      </div>

    </div>
  </div>
{/if}

<!-- MODALE DÉTAIL D'UN ADHÉRENT (DRAWER) -->
{#if showDrawerModal && selectedMemberForDrawer}
  <div 
    class="modal-backdrop" 
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    onkeydown={(e) => { if (e.key === 'Escape') showDrawerModal = false; }}
    style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;"
  >
    <div style="background: #ffffff; border-radius: 16px; width: 100%; max-width: 500px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden;">
      <div style="padding: 20px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
        <div>
          <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: #0f172a;">
            Fiche élève : {selectedMemberForDrawer.cleanName}
          </h3>
          <span style="font-size: 0.8rem; color: #64748b;">Statut : {selectedMemberForDrawer.statut}</span>
        </div>
        <button onclick={() => showDrawerModal = false} style="background: none; border: none; font-size: 1.25rem; color: #64748b; cursor: pointer;">&times;</button>
      </div>

      <div style="padding: 24px; display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
          <span style="color: #64748b;">Tarif annuel contractuel :</span>
          <strong style="color: #0f172a; font-family: monospace;">{Number(selectedMemberForDrawer.forfait || 0).toFixed(2)} €</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
          <span style="color: #64748b;">Total déjà réglé :</span>
          <strong style="color: #15803d; font-family: monospace;">{Number(selectedMemberForDrawer.dejaPaye || 0).toFixed(2)} €</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 10px 0;">
          <span style="color: #64748b;">Reste à recouvrer :</span>
          <strong style="color: {selectedMemberForDrawer.resteAPayer > 0 ? '#dc2626' : '#15803d'}; font-family: monospace;">
            {Number(selectedMemberForDrawer.resteAPayer || 0).toFixed(2)} €
          </strong>
        </div>
      </div>

      <div style="padding: 16px 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; background: #f8fafc;">
        <button 
          onclick={() => showDrawerModal = false}
          style="padding: 8px 16px; border-radius: 8px; background: #0f172a; color: #ffffff; border: none; font-weight: 700; cursor: pointer;"
        >
          Fermer
        </button>
      </div>
    </div>
  </div>
{/if}
