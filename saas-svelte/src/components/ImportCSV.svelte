<script>
  import { onMount } from 'svelte';
  import { 
    transactions, 
    activeEntityId, 
    activeView,
    updateTransactions,
    showToast
  } from '../lib/store.js';
  import { CSVParser } from '../lib/parser.js';
  import { Categorizer } from '../lib/categorizer.js';
  import { DEMO_CSV_DATA } from '../lib/data-sample.js';

  let dragover = $state(false);
  let fileInput;
  let rawPreview = $state('');
  let importedPreviewList = $state([]);
  let showPreview = $state(false);
  let importsHistory = $state([]);
  let isRecalculating = $state(false);

  // États pour l'assistant de mappage de colonnes CSV
  let showMappingStep = $state(false);
  let showAdvancedSelectors = $state(false);
  let showPedagogicalModal = $state(false);
  let uploadedRawText = $state('');
  let uploadedFileName = $state('');
  let uploadedFileSize = $state(0);
  let csvHeaders = $state([]);
  let csvPreviewLines = $state([]);
  let separateur = $state(';');
  let mappingConfig = $state({
    indexDate: 0,
    indexLibelle: 1,
    modeMontant: 'double',
    indexDebit: 2,
    indexCredit: 3,
    indexMontant: 2,
    indexInfo: -1,
    indexTypeOp: -1,
    indexReference: -1
  });

  // Load imports history from LocalStorage
  function getImportsHistory() {
    const saved = localStorage.getItem(`saas_compta_imports_${$activeEntityId}`);
    return saved ? JSON.parse(saved) : [];
  }

  function saveImportsHistory(history) {
    localStorage.setItem(`saas_compta_imports_${$activeEntityId}`, JSON.stringify(history));
    importsHistory = history;
  }

  function loadHistory() {
    importsHistory = getImportsHistory();
  }

  // Handle drop CSV
  function handleDrop(e) {
    e.preventDefault();
    dragover = false;
    if (e.dataTransfer.files.length > 0) {
      traiterFichierCSV(e.dataTransfer.files[0]);
    }
  }

  // Process CSV file and open Column Mapping assistant
  function traiterFichierCSV(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawText = e.target.result;
      const lignes = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      
      if (lignes.length < 2) {
        showToast("⚠️ Fichier CSV vide ou format non supporté.");
        return;
      }

      // Détection du séparateur
      const premiereLigne = lignes[0];
      let sep = ';';
      if (premiereLigne.split(',').length > premiereLigne.split(';').length) {
        sep = ',';
      }
      separateur = sep;

      // Extraction des en-têtes
      const headers = premiereLigne.split(sep).map(h => h.trim());
      csvHeaders = headers;

      // Extraction des lignes de prévisualisation (max 4 lignes)
      csvPreviewLines = lignes.slice(1, 5).map(line => CSVParser.splitLineRespectingQuotes(line, sep));

      // Essayer d'appliquer une configuration de mappage précédemment sauvegardée pour cette entité
      const savedConfigRaw = localStorage.getItem(`saas_compta_csv_mapping_${$activeEntityId}`);
      let configAppliquee = null;

      if (savedConfigRaw) {
        try {
          const saved = JSON.parse(savedConfigRaw);
          // Si les colonnes Date et Libellé existent dans le fichier actuel, on réapplique le profil
          const hasDate = headers.includes(saved.colDate);
          const hasLibelle = headers.includes(saved.colLibelle);
          
          if (hasDate && hasLibelle) {
            configAppliquee = {
              separateur: saved.separateur || sep,
              modeMontant: saved.modeMontant || 'double',
              indexDate: headers.indexOf(saved.colDate),
              indexLibelle: headers.indexOf(saved.colLibelle),
              indexDebit: saved.colDebit ? headers.indexOf(saved.colDebit) : -1,
              indexCredit: saved.colCredit ? headers.indexOf(saved.colCredit) : -1,
              indexMontant: saved.colMontant ? headers.indexOf(saved.colMontant) : -1,
              indexInfo: saved.colInfo ? headers.indexOf(saved.colInfo) : -1,
              indexTypeOp: saved.colTypeOp ? headers.indexOf(saved.colTypeOp) : -1,
              indexReference: saved.colReference ? headers.indexOf(saved.colReference) : -1
            };
          }
        } catch (err) {
          console.error("Erreur lecture configuration mappage", err);
        }
      }

      if (configAppliquee) {
        mappingConfig = configAppliquee;
      } else {
        // Auto-détection intelligente des colonnes pour prérégler l'assistant
        const entetesNorm = headers.map(h => {
          return h.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, '')
            .trim();
        });

        // Fonction d'aide pour trouver la meilleure colonne en évitant les collisions
        const findBestColumn = (specificKeys, generalRoots) => {
          // 1. Match exact
          let idx = entetesNorm.findIndex(h => specificKeys.some(k => h === k));
          if (idx !== -1) return idx;

          // 2. Commencer par ou se terminer par (plus spécifique)
          idx = entetesNorm.findIndex(h => generalRoots.some(r => h.startsWith(r) || h.endsWith(r)));
          if (idx !== -1) return idx;

          // 3. Inclusions partielles (dernier recours)
          return entetesNorm.findIndex(h => generalRoots.some(r => h.includes(r)));
        };
        
        const d = findBestColumn(['date', 'datecomptable', 'dateoperation', 'datedevaleur'], ['dat']);
        const l = findBestColumn(['libelle', 'libellesimplifie', 'description', 'texte'], ['lib', 'tex', 'des']);
        const deb = findBestColumn(['debit', 'depense', 'sortie'], ['deb', 'dep', 'sor']);
        const cre = findBestColumn(['credit', 'recette', 'entree'], ['cre', 'rec', 'ent']);
        const mon = findBestColumn(['montant', 'valeur', 'somme', 'amount'], ['mon', 'val', 'som', 'amo']);
        const inf = findBestColumn(['informationscomplementaires', 'details', 'notes', 'commentaires'], ['inf', 'det', 'com']);
        const typ = findBestColumn(['typeoperation', 'type', 'mode', 'paiement'], ['typ', 'mod', 'pai']);
        const ref = findBestColumn(['reference', 'ref', 'numero', 'id', 'transactionid'], ['ref', 'num', 'ide']);

        mappingConfig = {
          separateur: sep,
          indexDate: d !== -1 ? d : 0,
          indexLibelle: l !== -1 ? l : 1,
          modeMontant: (deb !== -1 && cre !== -1) ? 'double' : 'single',
          indexDebit: deb !== -1 ? deb : 0,
          indexCredit: cre !== -1 ? cre : 0,
          indexMontant: mon !== -1 ? mon : 0,
          indexInfo: inf !== -1 && inf !== d && inf !== l ? inf : -1,
          indexTypeOp: typ !== -1 ? typ : -1,
          indexReference: ref !== -1 ? ref : -1
        };
      }

      // Sauvegarde des données du fichier
      uploadedRawText = rawText;
      uploadedFileName = file.name;
      uploadedFileSize = file.size;

      // Afficher l'assistant de mappage
      showMappingStep = true;
    };
    reader.readAsText(file);
  }

  // Prévisualisation réactive en direct des écritures selon le mappage actuel du user
  let previewTransactions = $derived(
    csvPreviewLines.map((cellules) => {
      const rawDate = mappingConfig.indexDate !== -1 ? cellules[mappingConfig.indexDate] || '' : '';
      const rawLibelle = mappingConfig.indexLibelle !== -1 ? cellules[mappingConfig.indexLibelle] || 'Opération sans libellé' : 'Opération sans libellé';
      const rawInfo = mappingConfig.indexInfo !== -1 ? cellules[mappingConfig.indexInfo] || '' : '';
      const rawTypeOp = mappingConfig.indexTypeOp !== -1 && mappingConfig.indexTypeOp !== undefined ? cellules[mappingConfig.indexTypeOp] || '' : '';
      const rawReference = mappingConfig.indexReference !== -1 && mappingConfig.indexReference !== undefined ? cellules[mappingConfig.indexReference] || '' : '';

      const dateStr = CSVParser.normaliserDate(rawDate);
      const libelle = rawLibelle.trim();
      const info = rawInfo.trim();
      const typeOperation = rawTypeOp.trim();
      const reference = rawReference.trim();
      
      let debit = 0;
      let credit = 0;

      if (mappingConfig.modeMontant === 'double') {
        const rawDebit = mappingConfig.indexDebit !== -1 ? cellules[mappingConfig.indexDebit] || '' : '';
        const rawCredit = mappingConfig.indexCredit !== -1 ? cellules[mappingConfig.indexCredit] || '' : '';
        debit = Math.abs(CSVParser.parseMontant(rawDebit));
        credit = Math.abs(CSVParser.parseMontant(rawCredit));
      } else if (mappingConfig.modeMontant === 'single' && mappingConfig.indexMontant !== -1) {
        const rawMontant = cellules[mappingConfig.indexMontant] || '';
        const montant = CSVParser.parseMontant(rawMontant);
        if (montant < 0) {
          debit = Math.abs(montant);
          credit = 0;
        } else {
          debit = 0;
          credit = montant;
        }
      }

      return {
        date: dateStr || new Date().toISOString().split('T')[0],
        libelle,
        debit,
        credit,
        info,
        typeOperation,
        reference
      };
    })
  );

  // Confirmer l'importation finale avec le mappage validé
  function confirmerImportation() {
    const transactionsImp = CSVParser.parse(uploadedRawText, mappingConfig);

    if (transactionsImp.length === 0) {
      showToast("⚠️ Aucune transaction n'a pu être extraite avec ce mappage.");
      return;
    }

    // Sauvegarder la configuration de mappage des colonnes (noms) pour les prochains imports de cette entité
    const savedConfig = {
      separateur: mappingConfig.separateur,
      modeMontant: mappingConfig.modeMontant,
      colDate: csvHeaders[mappingConfig.indexDate] || '',
      colLibelle: csvHeaders[mappingConfig.indexLibelle] || '',
      colDebit: mappingConfig.indexDebit !== -1 ? csvHeaders[mappingConfig.indexDebit] || '' : '',
      colCredit: mappingConfig.indexCredit !== -1 ? csvHeaders[mappingConfig.indexCredit] || '' : '',
      colMontant: mappingConfig.indexMontant !== -1 ? csvHeaders[mappingConfig.indexMontant] || '' : '',
      colInfo: mappingConfig.indexInfo !== -1 ? csvHeaders[mappingConfig.indexInfo] || '' : '',
      colTypeOp: mappingConfig.indexTypeOp !== -1 ? csvHeaders[mappingConfig.indexTypeOp] || '' : '',
      colReference: mappingConfig.indexReference !== -1 ? csvHeaders[mappingConfig.indexReference] || '' : ''
    };
    localStorage.setItem(`saas_compta_csv_mapping_${$activeEntityId}`, JSON.stringify(savedConfig));

    // Déduplication
    const existingHashes = new Set($transactions.map(tx => {
      const amount = (tx.debit > 0 ? -tx.debit : tx.credit).toFixed(2);
      return `${tx.date}_${tx.libelle}_${amount}`;
    }));

    const newTransactions = [];
    const importId = 'import_' + Date.now();

    transactionsImp.forEach(tx => {
      const amount = (tx.debit > 0 ? -tx.debit : tx.credit).toFixed(2);
      const hash = `${tx.date}_${tx.libelle}_${amount}`;
      if (!existingHashes.has(hash)) {
        tx.importId = importId;
        newTransactions.push(tx);
      }
    });

    if (newTransactions.length === 0) {
      showToast("⚠️ Toutes les transactions de ce fichier ont déjà été importées (doublons détectés).");
      showMappingStep = false;
      return;
    }

    const merged = newTransactions.concat($transactions);
    merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Catégoriser et sauvegarder
    const categorized = Categorizer.categoriserTransactions(merged);
    updateTransactions(categorized);

    // Enregistrer dans l'historique
    const history = getImportsHistory();
    history.unshift({
      id: importId,
      fileName: uploadedFileName,
      date: new Date().toISOString(),
      size: (uploadedFileSize / 1024).toFixed(1) + ' KB',
      linesCount: newTransactions.length,
      importedBy: 'Fabien Marceau'
    });
    saveImportsHistory(history);

    rawPreview = uploadedRawText.slice(0, 1000) + '\n... [Tronqué]';
    importedPreviewList = newTransactions.slice(0, 8);
    showPreview = true;
    showMappingStep = false;

    showToast(`✅ ${newTransactions.length} nouvelles écritures importées avec succès !`);

    setTimeout(() => {
      activeView.set('categorize');
    }, 2000);
  }

  function handleFileChange(e) {
    if (e.target.files.length > 0) {
      traiterFichierCSV(e.target.files[0]);
    }
  }

  // Load demo CSV
  function chargerDemo() {
    const demoTx = CSVParser.parse(DEMO_CSV_DATA);
    const importId = 'import_demo';
    demoTx.forEach(tx => tx.importId = importId);

    const categorized = Categorizer.categoriserTransactions(demoTx);
    updateTransactions(categorized);

    const history = getImportsHistory();
    if (!history.some(h => h.id === importId)) {
      history.unshift({
        id: importId,
        fileName: 'releve_demo_25_lignes.csv',
        date: new Date().toISOString(),
        size: '2.8 KB',
        linesCount: demoTx.length,
        importedBy: 'Assistant Démo'
      });
      saveImportsHistory(history);
    }

    showToast('✅ Relevé bancaire de démonstration chargé !');
    activeView.set('categorize');
  }

  // Delete import (rollback transactions)
  function supprimerImport(importId, fileName, linesCount) {
    if (confirm(`⚠️ Voulez-vous vraiment annuler l'import "${fileName}" ? Cela supprimera définitivement les ${linesCount} transactions associées.`)) {
      const filteredTx = $transactions.filter(t => t.importId !== importId);
      updateTransactions(filteredTx);

      const history = getImportsHistory().filter(h => h.id !== importId);
      saveImportsHistory(history);

      // Re-trigger categorization to clean up references if needed
      const recatted = Categorizer.categoriserTransactions(filteredTx);
      updateTransactions(recatted);

      showToast(`🗑️ Import "${fileName}" annulé avec succès.`);
    }
  }

  // Manual recalculation of accounting books
  function recalculerComptabilite() {
    isRecalculating = true;
    setTimeout(() => {
      const recatted = Categorizer.categoriserTransactions($transactions);
      updateTransactions(recatted);
      isRecalculating = false;
      showToast('🤖 Comptabilité entièrement recalculée et registres à jour !');
    }, 500);
  }

  // Sync history when activeEntityId changes
  $effect(() => {
    if ($activeEntityId) {
      loadHistory();
      showPreview = false;
    }
  });

  // Déterminer le rôle d'une colonne sous forme de texte pour l'affichage explicite dans l'en-tête
  function getColumnRoleName(colIdx) {
    if (colIdx === mappingConfig.indexDate) return 'Date';
    if (colIdx === mappingConfig.indexLibelle) return 'Libellé';
    if (mappingConfig.modeMontant === 'double') {
      if (colIdx === mappingConfig.indexDebit) return 'Débit (Dépense)';
      if (colIdx === mappingConfig.indexCredit) return 'Crédit (Recette)';
    } else {
      if (colIdx === mappingConfig.indexMontant) return 'Montant (+/-)';
    }
    if (colIdx === mappingConfig.indexTypeOp) return 'Type d\'opération';
    if (colIdx === mappingConfig.indexReference) return 'Référence';
    if (colIdx === mappingConfig.indexInfo) return 'Note';
    return '';
  }

  // Vérifier si une colonne est activement extraite
  function isColumnExtracted(colIdx) {
    return colIdx === mappingConfig.indexDate ||
           colIdx === mappingConfig.indexLibelle ||
           (mappingConfig.modeMontant === 'double' && (colIdx === mappingConfig.indexDebit || colIdx === mappingConfig.indexCredit)) ||
           (mappingConfig.modeMontant === 'single' && colIdx === mappingConfig.indexMontant) ||
           (colIdx === mappingConfig.indexTypeOp && colIdx !== -1) ||
           (colIdx === mappingConfig.indexReference && colIdx !== -1) ||
           (colIdx === mappingConfig.indexInfo && colIdx !== -1);
  }

  // Style de surbrillance unique et accessible pour toutes les colonnes importées
  function getHeaderStyle(colIdx) {
    if (isColumnExtracted(colIdx)) {
      return 'background-color: rgba(99, 102, 241, 0.15); color: white; border-bottom: 2.5px solid #6366f1; text-align: left; padding: 12px;';
    }
    return 'background-color: rgba(255, 255, 255, 0.01); color: var(--text-muted); opacity: 0.4; text-align: left; padding: 12px; font-weight: normal;';
  }

  onMount(() => {
    loadHistory();
  });
</script>

<div class="page-title-section">
  <h1 class="page-title">Import relevé d'opérations bancaire</h1>
  <p class="page-subtitle">Chargez vos mouvements de compte pour les soumettre au moteur de tri.</p>
</div>

{#if !showMappingStep}
  <div class="glass-card" style="margin-bottom: 35px;">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="dropzone {dragover ? 'dragover' : ''}" 
         onclick={() => fileInput.click()}
         ondragover={(e) => { e.preventDefault(); dragover = true; }}
         ondragleave={() => dragover = false}
         ondrop={handleDrop}>
      <div class="dropzone-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>
      <div class="dropzone-text">Faites glisser votre fichier bancaire CSV ici</div>
      <div class="dropzone-subtext">ou cliquez pour parcourir vos fichiers locaux</div>
      <input type="file" bind:this={fileInput} onchange={handleFileChange} style="display: none;" accept=".csv">
    </div>
  </div>
{:else}
  <!-- Assistant de Mappage de colonnes -->
  <div class="glass-card" style="margin-bottom: 35px; border: 1px solid var(--color-primary, #6366f1);">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 15px; margin-bottom: 10px;">
      <div>
        <h2 style="font-family: var(--font-title); color: white; margin-bottom: 5px; font-size: 1.3rem; display: flex; align-items: center; gap: 10px;">
          <i class="fa-solid fa-circle-info" style="color: #6366f1;"></i>
          Vérification des colonnes du relevé
        </h2>
        <p style="font-size: 0.85rem; color: var(--text-secondary);">
          Fichier : <strong>{uploadedFileName}</strong> ({(uploadedFileSize / 1024).toFixed(1)} KB).
        </p>
      </div>

      <button 
        class="btn btn-secondary btn-sm" 
        onmouseover={() => showPedagogicalModal = true}
        onfocus={() => showPedagogicalModal = true}
        onmouseleave={() => showPedagogicalModal = false}
        onblur={() => showPedagogicalModal = false}
        style="display: flex; align-items: center; gap: 8px; border: 1px solid #6366f1; color: #a5b4fc;"
      >
        <i class="fa-solid fa-graduation-cap"></i> Pourquoi ces colonnes ?
      </button>
    </div>

    <!-- Modale pédagogique -->
    {#if showPedagogicalModal}
      <div style="position: absolute; right: 20px; top: 70px; background: #11131e; border: 1px solid #6366f1; border-radius: var(--radius-sm); padding: 20px; max-width: 420px; z-index: 100; box-shadow: 0 10px 25px rgba(0,0,0,0.5); pointer-events: none;">
        <h4 style="font-family: var(--font-title); color: white; margin-bottom: 10px; font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-graduation-cap" style="color: #6366f1;"></i>
          Que faisons-nous de ces colonnes ?
        </h4>
        <ul style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5; padding-left: 15px; display: grid; gap: 8px; margin: 0;">
          <li><strong>Date</strong> : Positionne l'écriture dans l'exercice comptable pour les calculs de taxes et bilans.</li>
          <li><strong>Libellé</strong> : Identifie le motif ou le tiers, essentiel pour que l'IA catégorise automatiquement.</li>
          <li><strong>Débit & Crédit</strong> : Indiquent les flux financiers (dépenses et recettes).</li>
          <li><strong>Type d'opération</strong> : Le mode (Virement, Chèque, CB) pour le suivi des moyens de paiement.</li>
          <li><strong>Référence</strong> : Numéro de transaction ou de chèque pour vos pièces justificatives.</li>
        </ul>
      </div>
    {/if}

    <p style="font-size: 0.9rem; color: white; font-weight: 500; margin-bottom: 20px; background: rgba(99, 102, 241, 0.05); padding: 12px; border-radius: 6px; border-left: 3px solid #6366f1;">
      👉 <strong>Est-ce que les colonnes détectées (en surbrillance) correspondent bien aux données de votre relevé ?</strong>
    </p>

    <!-- Advanced Selectors Panel (Toggled on Demand) -->
    {#if showAdvancedSelectors}
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px; background: rgba(0,0,0,0.3); padding: 20px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); animation: fadeIn 0.2s ease-out;">
        <!-- Colonne Date -->
        <div class="form-group" style="margin: 0;">
          <label for="map-date" class="form-label" style="color: #c084fc;">Colonne Date</label>
          <select id="map-date" class="form-control" bind:value={mappingConfig.indexDate}>
            {#each csvHeaders as header, i}
              <option value={i}>{header}</option>
            {/each}
          </select>
        </div>

        <!-- Colonne Libellé -->
        <div class="form-group" style="margin: 0;">
          <label for="map-libelle" class="form-label" style="color: #60a5fa;">Libellé / Description</label>
          <select id="map-libelle" class="form-control" bind:value={mappingConfig.indexLibelle}>
            {#each csvHeaders as header, i}
              <option value={i}>{header}</option>
            {/each}
          </select>
        </div>

        <!-- Type de montant -->
        <div class="form-group" style="margin: 0;">
          <label for="map-mode" class="form-label">Format de montants</label>
          <select id="map-mode" class="form-control" bind:value={mappingConfig.modeMontant}>
            <option value="double">Débit & Crédit séparés (2 col)</option>
            <option value="single">Montant unique +/- (1 col)</option>
          </select>
        </div>

        {#if mappingConfig.modeMontant === 'double'}
          <!-- Colonne Débit -->
          <div class="form-group" style="margin: 0;">
            <label for="map-debit" class="form-label" style="color: #f43f5e;">Colonne Débit</label>
            <select id="map-debit" class="form-control" bind:value={mappingConfig.indexDebit}>
              {#each csvHeaders as header, i}
                <option value={i}>{header}</option>
              {/each}
            </select>
          </div>

          <!-- Colonne Crédit -->
          <div class="form-group" style="margin: 0;">
            <label for="map-credit" class="form-label" style="color: #34d399;">Colonne Crédit</label>
            <select id="map-credit" class="form-control" bind:value={mappingConfig.indexCredit}>
              {#each csvHeaders as header, i}
                <option value={i}>{header}</option>
              {/each}
            </select>
          </div>
        {:else}
          <!-- Colonne Montant Unique -->
          <div class="form-group" style="margin: 0;">
            <label for="map-montant" class="form-label" style="color: #fbbf24;">Colonne Montant</label>
            <select id="map-montant" class="form-control" bind:value={mappingConfig.indexMontant}>
              {#each csvHeaders as header, i}
                <option value={i}>{header}</option>
              {/each}
            </select>
          </div>
        {/if}

        <!-- Type d'opération -->
        <div class="form-group" style="margin: 0;">
          <label for="map-typeop" class="form-label" style="color: #22d3ee;">Type d'opération</label>
          <select id="map-typeop" class="form-control" bind:value={mappingConfig.indexTypeOp}>
            <option value={-1}>[Ignorer / Non présent]</option>
            {#each csvHeaders as header, i}
              <option value={i}>{header}</option>
            {/each}
          </select>
        </div>

        <!-- Référence -->
        <div class="form-group" style="margin: 0;">
          <label for="map-ref" class="form-label" style="color: #fb923c;">Référence unique</label>
          <select id="map-ref" class="form-control" bind:value={mappingConfig.indexReference}>
            <option value={-1}>[Ignorer / Non présent]</option>
            {#each csvHeaders as header, i}
              <option value={i}>{header}</option>
            {/each}
          </select>
        </div>

        <!-- Note / Info -->
        <div class="form-group" style="margin: 0;">
          <label for="map-info" class="form-label" style="color: #9ca3af;">Note / Info complémentaire</label>
          <select id="map-info" class="form-control" bind:value={mappingConfig.indexInfo}>
            <option value={-1}>[Ignorer]</option>
            {#each csvHeaders as header, i}
              <option value={i}>{header}</option>
            {/each}
          </select>
        </div>
      </div>
    {/if}

    <!-- Live Preview Table (displays actual columns) -->
    <div style="margin-bottom: 25px;">
      <h4 style="font-family: var(--font-title); color: white; font-size: 1rem; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-table" style="color: #6366f1;"></i>
        Aperçu complet du fichier ({csvPreviewLines.length} premières lignes)
      </h4>
      <div class="table-container" style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow-x: auto;">
        <table class="custom-table" style="margin: 0; min-width: 800px;">
          <thead>
            <tr>
              {#each csvHeaders as header, i}
                <th style={getHeaderStyle(i)}>
                  <div style="display: flex; flex-direction: column; gap: 6px;">
                    <span style="font-weight: 600; white-space: nowrap;">{header}</span>
                    {#if isColumnExtracted(i)}
                      <span style="font-size: 0.65rem; color: #a5b4fc; background: rgba(99, 102, 241, 0.25); padding: 2px 6px; border-radius: 4px; width: fit-content; border: 1px solid rgba(99, 102, 241, 0.4); font-weight: 600; letter-spacing: 0.02em;">
                        {getColumnRoleName(i)}
                      </span>
                    {:else}
                      <span style="font-size: 0.65rem; color: var(--text-muted); background: rgba(255, 255, 255, 0.02); padding: 2px 6px; border-radius: 4px; width: fit-content; border: 1px dashed var(--border-color); font-weight: normal;">
                        [Ignoré]
                      </span>
                    {/if}
                  </div>
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each csvPreviewLines as row}
              <tr>
                {#each row as cell, j}
                  <td style={getHeaderStyle(j) ? 'font-weight: 600; color: white;' : 'color: var(--text-muted); opacity: 0.6;'}>
                    {cell || '-'}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Actions -->
    <div style="display: flex; gap: 12px; justify-content: flex-end; align-items: center; flex-wrap: wrap;">
      <button class="btn btn-secondary" onclick={() => showMappingStep = false} style="min-width: 100px;">
        Annuler
      </button>

      <button class="btn btn-secondary" onclick={() => showAdvancedSelectors = !showAdvancedSelectors} style="display: flex; align-items: center; gap: 8px; border: 1px solid var(--border-color);">
        <i class="fa-solid fa-sliders"></i>
        {showAdvancedSelectors ? "Masquer les réglages" : "Non, ajuster les intitulés"}
      </button>

      <button class="btn btn-primary" onclick={confirmerImportation} style="display: flex; align-items: center; gap: 8px; font-weight: 600; padding: 10px 20px;">
        <i class="fa-solid fa-circle-check"></i>
        Oui, c'est correct !
      </button>
    </div>
  </div>
{/if}

<!-- Preview card after file upload -->
{#if showPreview}
  <div class="glass-card" id="csv-preview-card" style="margin-bottom: 30px;">
    <h3 style="font-family: var(--font-title); margin-bottom: 15px;">Fichier importé avec succès</h3>
    <div style="margin-bottom: 15px;">
      <span style="font-size: 0.85rem; color: var(--text-secondary);">Aperçu brut du fichier :</span>
      <div class="csv-preview-area" id="csv-raw-preview" style="white-space: pre-wrap; font-family: monospace; font-size: 0.8rem; background: rgba(0,0,0,0.3); padding: 12px; border-radius: 4px; border: 1px solid var(--border-color); max-height: 150px; overflow-y: auto;">
        {rawPreview}
      </div>
    </div>
    <div class="table-container">
      <table class="custom-table" id="imported-tx-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description de l'opération</th>
            <th>Dépenses (Sorties)</th>
            <th>Recettes (Entrées)</th>
            <th>Note administrative</th>
          </tr>
        </thead>
        <tbody>
          {#each importedPreviewList as tx}
            <tr>
              <td>{new Date(tx.date).toLocaleDateString('fr-FR')}</td>
              <td style="color: white; font-weight: 600;">{tx.libelle}</td>
              <td class="amount debit">{tx.debit > 0 ? tx.debit.toFixed(2) + ' €' : '-'}</td>
              <td class="amount credit">{tx.credit > 0 ? tx.credit.toFixed(2) + ' €' : '-'}</td>
              <td>{tx.info || '-'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}

<!-- Recalculate accounting -->
<div class="glass-card" style="margin-top: 30px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid var(--color-primary-light);">
  <div>
    <h3 style="font-family: var(--font-title); margin-bottom: 4px;">Recalculer les livres comptables</h3>
    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0;">Mettez à jour le Journal, le Grand Livre et la Balance après vos imports ou vos tris.</p>
  </div>
  <button class="btn btn-primary" onclick={recalculerComptabilite} disabled={isRecalculating} style="gap: 8px;">
    {#if isRecalculating}
      <i class="fa-solid fa-circle-notch fa-spin"></i> Recalcul en cours...
    {:else}
      <i class="fa-solid fa-arrows-rotate"></i> Générer la comptabilité
    {/if}
  </button>
</div>

<!-- History -->
<div class="glass-card" style="margin-bottom: 30px;">
  <h3 style="font-family: var(--font-title); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
    <i class="fa-solid fa-clock-rotate-left" style="color: var(--color-primary-light);"></i> Historique des Imports CSV
  </h3>
  <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 20px;">
    Retrouvez tous les fichiers importés et supprimez-les en cascade si nécessaire.
  </p>
  <div class="table-container">
    <table class="custom-table" id="imports-history-table">
      <thead>
        <tr>
          <th>Nom du fichier</th>
          <th>Date d'import</th>
          <th>Taille</th>
          <th>Lignes</th>
          <th>Importé par</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#if importsHistory.length === 0}
          <tr>
            <td colspan="6" style="text-align: center; color: var(--text-secondary);">Aucun historique d'import.</td>
          </tr>
        {:else}
          {#each importsHistory as h}
            <tr>
              <td style="color: white; font-weight: 600;">{h.fileName}</td>
              <td>{new Date(h.date).toLocaleString('fr-FR')}</td>
              <td>{h.size}</td>
              <td><strong>{h.linesCount}</strong></td>
              <td>{h.importedBy}</td>
              <td>
                <button class="btn btn-secondary btn-sm" onclick={() => supprimerImport(h.id, h.fileName, h.linesCount)} style="color: #ef4444; background: rgba(239, 68, 68, 0.05); border-color: rgba(239, 68, 68, 0.15);">
                  <i class="fa-solid fa-trash-can"></i> Annuler
                </button>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
