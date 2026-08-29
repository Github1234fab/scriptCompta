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

  // Process CSV file
  function traiterFichierCSV(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawText = e.target.result;
      const transactionsImp = CSVParser.parse(rawText);

      if (transactionsImp.length === 0) {
        showToast("⚠️ Fichier CSV vide ou format non supporté.");
        return;
      }

      // Deduplicate
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
        return;
      }

      const merged = newTransactions.concat($transactions);
      merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Categorize and save
      const categorized = Categorizer.categoriserTransactions(merged);
      updateTransactions(categorized);

      // Save to imports history
      const history = getImportsHistory();
      history.unshift({
        id: importId,
        fileName: file.name,
        date: new Date().toISOString(),
        size: (file.size / 1024).toFixed(1) + ' KB',
        linesCount: newTransactions.length,
        importedBy: 'Fabien Marceau'
      });
      saveImportsHistory(history);

      // Raw text preview
      rawPreview = rawText.slice(0, 1000) + '\n... [Tronqué pour l\'affichage]';
      importedPreviewList = newTransactions.slice(0, 8);
      showPreview = true;

      showToast(`✅ ${newTransactions.length} nouvelles écritures chargées avec succès !`);

      // Redirect to tri
      setTimeout(() => {
        activeView.set('categorize');
      }, 2000);
    };
    reader.readAsText(file);
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

  onMount(() => {
    loadHistory();
  });
</script>

<div class="page-title-section">
  <h1 class="page-title">Importer vos relevés bancaires</h1>
  <p class="page-subtitle">Chargez vos mouvements de compte pour les soumettre au moteur de tri.</p>
</div>

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

  <div style="text-align: center; background-color: rgba(255,255,255,0.02); padding: 15px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-top: 20px;">
    <p style="font-size: 0.9rem; margin-bottom: 10px; color: var(--text-secondary);">
      <strong>Vous n'avez pas de fichier CSV sous la main ?</strong>
    </p>
    <button class="btn btn-primary" onclick={chargerDemo}>
      <i class="fa-solid fa-wand-magic-sparkles"></i> Charger le relevé bancaire de démonstration (25 lignes)
    </button>
  </div>
</div>

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
