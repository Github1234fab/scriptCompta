<script>
  import { onMount } from 'svelte';
  import { 
    transactions, 
    members, 
    products, 
    bills, 
    planComptable, 
    entities, 
    activeEntityId, 
    activeView,
    updateActiveEntityId, 
    updateTransactions,
    showToast,
    loadEntityData,
    showCreateEntityModal
  } from '../lib/store.js';
  import { CSVParser } from '../lib/parser.js';
  import { Categorizer } from '../lib/categorizer.js';
  import { DEMO_CSV_DATA } from '../lib/data-sample.js';

  // Local accounting model filter
  let accountingModel = $state('all');

  // Reactivity using Svelte 5 Runes ($derived)
  let totalBanque = $derived($transactions.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue' && tx.compteAttribué !== '530') {
      return sum + (tx.credit - tx.debit);
    }
    return sum;
  }, 0));

  let totalCaisse = $derived($transactions.reduce((sum, tx) => {
    if (tx.compteAttribué === '530' && tx.statut === 'attribue') {
      return sum + (tx.credit - tx.debit);
    }
    return sum;
  }, 0));

  let totalTrésorerie = $derived(totalBanque + totalCaisse);

  let pendingTxCount = $derived($transactions.filter(
    t => t.compteAttribué === '699' || t.statut === 'non_attribue' || t.statut === 'suggere'
  ).length);

  let resteAEncaisser = $derived($members.reduce((sum, m) => {
    const reste = m.forfait - m.dejaPaye;
    return sum + (reste > 0 ? reste : 0);
  }, 0));

  let dettesFournisseurs = $derived($bills.reduce((sum, b) => {
    return sum + (b.status === 'unpaid' ? b.amount : 0);
  }, 0));

  let recettes = $derived($transactions.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue') {
      const cpt = $planComptable.find(p => p.compte === tx.compteAttribué);
      if (cpt && cpt.type === 'Produit') return sum + tx.credit;
    }
    return sum;
  }, 0));

  let depenses = $derived($transactions.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue') {
      const cpt = $planComptable.find(p => p.compte === tx.compteAttribué);
      if (cpt && cpt.type === 'Charge') return sum + tx.debit;
    }
    return sum;
  }, 0));

  let resultatNet = $derived(recettes - depenses);
  let maxVal = $derived(Math.max(recettes, depenses, 1));
  let recettesHeight = $derived((recettes / maxVal) * 100);
  let depensesHeight = $derived((depenses / maxVal) * 100);

  // Alerts
  let retards = $derived($members.filter(m => (m.forfait - m.dejaPaye) > 0));
  let stocksFaibles = $derived($products.filter(p => p.stock < 5));

  function handleEntityChange(e) {
    const val = e.target.value;
    if (val === 'create_new') {
      showCreateEntityModal.set(true);
      e.target.value = $activeEntityId;
    } else {
      updateActiveEntityId(val);
      showToast(`Structure active : ${$entities.find(ent => ent.id === val).name}`);
    }
  }

  function handleModelChange(e) {
    const val = e.target.value;
    accountingModel = val;
    
    // Also update model in entity
    const currentEntity = $entities.find(ent => ent.id === $activeEntityId);
    if (currentEntity && currentEntity.model !== val) {
      currentEntity.model = val;
      entities.set([...$entities]); // trigger update
      localStorage.setItem('saas_compta_entities', JSON.stringify($entities));
    }
    showToast(`Modèle configuré : ${e.target.options[e.target.selectedIndex].text}`);
  }

  // Load demo CSV
  function chargerDemo() {
    const demoTx = CSVParser.parse(DEMO_CSV_DATA);
    const importId = 'import_demo';
    demoTx.forEach(tx => tx.importId = importId);
    
    const categorized = Categorizer.categoriserTransactions(demoTx);
    updateTransactions(categorized);
    
    // Save history
    const historyKey = `saas_compta_imports_${$activeEntityId}`;
    const savedHistory = localStorage.getItem(historyKey);
    const history = savedHistory ? JSON.parse(savedHistory) : [];
    if (!history.some(h => h.id === importId)) {
      history.unshift({
        id: importId,
        fileName: 'releve_demo_25_lignes.csv',
        date: new Date().toISOString(),
        size: '2.8 KB',
        linesCount: demoTx.length,
        importedBy: 'Assistant Démo'
      });
      localStorage.setItem(historyKey, JSON.stringify(history));
    }

    showToast('✅ Relevé bancaire de démonstration chargé !');
    activeView.set('categorize');
  }

  // Drag and drop CSV
  let dragover = $state(false);
  let fileInput;

  function handleDrop(e) {
    e.preventDefault();
    dragover = false;
    if (e.dataTransfer.files.length > 0) {
      traiterFichierCSV(e.dataTransfer.files[0]);
    }
  }

  function traiterFichierCSV(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawText = e.target.result;
      const transactionsImp = CSVParser.parse(rawText);

      if (transactionsImp.length === 0) {
        showToast("⚠️ Fichier CSV vide ou format non supporté.");
        return;
      }

      // De-duplicate
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
        showToast("⚠️ Toutes les transactions de ce fichier ont déjà été importées.");
        return;
      }

      const merged = newTransactions.concat($transactions);
      merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Categorize new list
      const categorized = Categorizer.categoriserTransactions(merged);
      updateTransactions(categorized);

      // Save import history
      const historyKey = `saas_compta_imports_${$activeEntityId}`;
      const savedHistory = localStorage.getItem(historyKey);
      const history = savedHistory ? JSON.parse(savedHistory) : [];
      history.unshift({
        id: importId,
        fileName: file.name,
        date: new Date().toISOString(),
        size: (file.size / 1024).toFixed(1) + ' KB',
        linesCount: newTransactions.length,
        importedBy: 'Fabien Marceau'
      });
      localStorage.setItem(historyKey, JSON.stringify(history));

      showToast(`✅ ${newTransactions.length} nouvelles écritures chargées avec succès !`);
      activeView.set('categorize');
    };
    reader.readAsText(file);
  }

  function handleFileChange(e) {
    if (e.target.files.length > 0) {
      traiterFichierCSV(e.target.files[0]);
    }
  }

  function navigateToBook(bookId) {
    activeView.set('books');
    setTimeout(() => {
      const btn = document.getElementById(`sub-btn-${bookId}`);
      if (btn) btn.click();
    }, 50);
  }

  onMount(() => {
    // Sync accounting model from store entity
    const currentEntity = $entities.find(ent => ent.id === $activeEntityId);
    if (currentEntity) {
      accountingModel = currentEntity.model || 'all';
    }
  });
</script>

<div class="page-title-section" style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 15px;">
  <div>
    <h1 class="page-title" style="margin-bottom: 0;">Tableau de Bord</h1>
  </div>
  
  <div style="display: flex; gap: 12px; background: var(--bg-card); padding: 8px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color); align-items: center; min-width: 480px;">
    <div style="flex: 1;">
      <label for="dash-entity-select" style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 2px;">Structure active</label>
      <select id="dash-entity-select" class="form-control" style="padding: 6px 10px; font-size: 0.8rem; background: rgba(0,0,0,0.4); border-color: rgba(255,255,255,0.05); height: auto; color: white;" onchange={handleEntityChange} value={$activeEntityId}>
        {#each $entities as entity}
          <option value={entity.id}>{entity.name}</option>
        {/each}
        <option value="create_new">➕ Créer une nouvelle structure...</option>
      </select>
    </div>
    <div style="flex: 1;">
      <label for="dash-model-select" style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 2px;">Modèle comptable</label>
      <select id="dash-model-select" class="form-control" style="padding: 6px 10px; font-size: 0.8rem; background: rgba(0,0,0,0.4); border-color: rgba(255,255,255,0.05); height: auto; color: white;" onchange={handleModelChange} value={accountingModel}>
        <option value="all">Modèle Complet (Hybride)</option>
        <option value="members">Inscriptions & Adhésions</option>
        <option value="sales">Ventes & Boutique</option>
        <option value="donations">Dons & Mécénat</option>
      </select>
    </div>
  </div>
</div>

<!-- Stats Grid -->
<div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-top: 25px;">
  <!-- KPI 1 : Solde Trésorerie -->
  <div class="glass-card highlight-primary" id="kpi-treasury">
    <div class="stat-icon primary"><i class="fa-solid fa-wallet"></i></div>
    <div class="stat-label" style="font-size: 1rem; font-weight: 600; color: white; margin-bottom: 8px;">
      Solde Trésorerie
      <div class="tooltip-container">
        <span class="pedago-help-btn">?</span>
        <span class="tooltip-text">
          <strong>Solde Trésorerie</strong>
          Il s'agit du solde total cumulé de votre compte en banque et de votre caisse en espèces. C'est l'argent disponible immédiatement.
        </span>
      </div>
    </div>
    <div class="stat-value" id="kpi-cash" style="font-size: 2rem; margin: 0;">
      {totalTrésorerie.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
    </div>
  </div>

  <!-- KPI 2 : Reste à encaisser -->
  <div class="glass-card highlight-success" id="kpi-receivables-card">
    <div class="stat-icon success"><i class="fa-solid fa-hand-holding-dollar"></i></div>
    <div class="stat-label" style="font-size: 1rem; font-weight: 600; color: white; margin-bottom: 8px;">
      Reste à encaisser
      <div class="tooltip-container">
        <span class="pedago-help-btn">?</span>
        <span class="tooltip-text">
          <strong>Reste à encaisser (Créances)</strong>
          Il s'agit du montant total des inscriptions d'élèves/adhérents enregistrées mais pas encore totalement payées à ce jour.
        </span>
      </div>
    </div>
    <div class="stat-value" id="kpi-receivables" style="font-size: 2rem; margin: 0;">
      {resteAEncaisser.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
    </div>
  </div>

  <!-- KPI 3 : Factures à payer -->
  <div class="glass-card highlight-warning" id="kpi-payables-card">
    <div class="stat-icon warning"><i class="fa-solid fa-file-invoice"></i></div>
    <div class="stat-label" style="font-size: 1rem; font-weight: 600; color: white; margin-bottom: 8px;">
      Factures à payer
      <div class="tooltip-container">
        <span class="pedago-help-btn">?</span>
        <span class="tooltip-text">
          <strong>Factures à payer (Dettes)</strong>
          Il s'agit des sommes dues à vos fournisseurs ou des charges diverses en attente de règlement bancaire.
        </span>
      </div>
    </div>
    <div class="stat-value" id="kpi-payables" style="font-size: 2rem; margin: 0;">
      {dettesFournisseurs.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
    </div>
  </div>

  <!-- KPI 4 : Opérations à trier -->
  <div class="glass-card highlight-danger" id="kpi-alerts">
    <div class="stat-icon danger" style="background-color: rgba(239, 68, 68, 0.15); color: #ef4444;"><i class="fa-solid fa-bell"></i></div>
    <div class="stat-label" style="font-size: 1rem; font-weight: 600; color: white; margin-bottom: 8px;">
      Opérations à classer
      <div class="tooltip-container">
        <span class="pedago-help-btn">?</span>
        <span class="tooltip-text">
          <strong>Mouvements en attente</strong>
          Le nombre de transactions bancaires importées qui n'ont pas encore été catégorisées. L'attribution se fait dans l'onglet "Attribution des libellés".
        </span>
      </div>
    </div>
    <div class="stat-value" id="kpi-pending-count" style="font-size: 2rem; margin: 0; color: #ef4444;">
      {pendingTxCount}
    </div>
  </div>
</div>

<!-- Dashboard Dual Column -->
<div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 30px; margin-bottom: 30px;">
  
  <div style="display: flex; flex-direction: column; gap: 30px;">
    <!-- Shortcuts -->
    <div class="glass-card">
      <h3 style="font-family: var(--font-title); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-book-open" style="color: var(--color-primary-light);"></i> Accéder à ma comptabilité
      </h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 20px;">
        Consultez instantanément vos registres réglementaires mis à jour en temps réel à chaque tri.
      </p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <button class="btn btn-secondary" onclick={() => navigateToBook('journal')} style="justify-content: flex-start; padding: 12px 16px;">
          <i class="fa-solid fa-book" style="color: #34a853; width: 18px;"></i> Livre-journal
        </button>
        <button class="btn btn-secondary" onclick={() => navigateToBook('grandlivre')} style="justify-content: flex-start; padding: 12px 16px;">
          <i class="fa-solid fa-list-ul" style="color: #fbbc04; width: 18px;"></i> Le Grand Livre
        </button>
        <button class="btn btn-secondary" onclick={() => navigateToBook('balance')} style="justify-content: flex-start; padding: 12px 16px;">
          <i class="fa-solid fa-scale-balanced" style="color: #ea4335; width: 18px;"></i> La Balance
        </button>
        <button class="btn btn-secondary" onclick={() => navigateToBook('bilan')} style="justify-content: flex-start; padding: 12px 16px;">
          <i class="fa-solid fa-file-invoice-dollar" style="color: var(--color-primary-light); width: 18px;"></i> Bilan Simplifié
        </button>
      </div>
    </div>

    <!-- Chart -->
    <div class="glass-card">
      <h3 style="font-family: var(--font-title); margin-bottom: 20px;">
        Entrées vs Sorties d'Argent (Recettes/Dépenses)
      </h3>
      <div style="display: flex; gap: 20px; align-items: flex-end; height: 180px; padding: 20px 0; border-bottom: 1px solid var(--border-color);">
        <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
          <div id="bar-recettes" style="background: linear-gradient(to top, #10b981, #34d399); width: 60px; height: {recettesHeight}%; border-radius: 6px 6px 0 0; transition: height 0.5s;"></div>
          <span style="font-size: 0.8rem; margin-top: 10px; font-weight: 600;">Recettes (Entrées)</span>
          <span id="bar-recettes-val" style="font-size: 0.85rem; color: var(--color-success); font-weight: 700;">
            {recettes.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </span>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
          <div id="bar-depenses" style="background: linear-gradient(to top, #ef4444, #f87171); width: 60px; height: {depensesHeight}%; border-radius: 6px 6px 0 0; transition: height 0.5s;"></div>
          <span style="font-size: 0.8rem; margin-top: 10px; font-weight: 600;">Dépenses (Sorties)</span>
          <span id="bar-depenses-val" style="font-size: 0.85rem; color: #ef4444; font-weight: 700;">
            {depenses.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </span>
        </div>
      </div>
      <div style="margin-top: 15px; text-align: center;">
        <span style="font-size: 0.9rem; color: var(--text-secondary);">Résultat de l'exercice :</span>
        <strong id="dashboard-result-net" style="font-family: var(--font-title); font-size: 1.1rem; margin-left: 5px; color: {resultatNet >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}">
          {resultatNet >= 0 ? '+' : ''} {resultatNet.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </strong>
      </div>
    </div>
  </div>

  <div style="display: flex; flex-direction: column; gap: 30px;">


    <!-- Espace Pédagogique -->
    <div class="glass-card" style="flex: 1;">
      <h3 style="font-family: var(--font-title); margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-graduation-cap" style="color: var(--color-primary-light);"></i> Espace Pédagogique
      </h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 15px;">
        Ici, pas de jargon. Nous traduisons la comptabilité dans la langue de tous les jours.
      </p>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <!-- svelte-ignore a11y_invalid_attribute -->
        <a href="#" onclick={(e) => { e.preventDefault(); activeView.set('glossary'); }} style="text-decoration: none; color: white; display: flex; gap: 12px; align-items: center; padding: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-sm); transition: var(--transition-fast);" class="pedago-resource-link">
          <div style="background: rgba(99, 102, 241, 0.1); color: var(--color-primary-light); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-book-bookmark"></i></div>
          <div>
            <h5 style="font-size: 0.85rem; font-weight: 600; margin-bottom: 2px;">Dictionnaire Déjargonisé</h5>
            <p style="font-size: 0.75rem; color: var(--text-secondary);">Traductions des mots complexes.</p>
          </div>
        </a>
        
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div style="display: flex; gap: 12px; align-items: center; padding: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-sm); cursor: pointer;" onclick={() => alert('🎥 Lancement de la vidéo : Les 5 étapes indispensables de la clôture comptable d\'association.')} class="pedago-resource-link">
          <div style="background: rgba(16, 185, 129, 0.1); color: var(--color-success); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-circle-play"></i></div>
          <div>
            <h5 style="font-size: 0.85rem; font-weight: 600; margin-bottom: 2px;">Tuto : Clôturer ma saison</h5>
            <p style="font-size: 0.75rem; color: var(--text-secondary);">Vidéo pas-à-pas de fin d'exercice.</p>
          </div>
        </div>

        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div style="display: flex; gap: 12px; align-items: center; padding: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-sm); cursor: pointer;" onclick={() => alert('📘 Téléchargement de la fiche pratique : Les subventions municipales et le dossier de demande Cerfa.')} class="pedago-resource-link">
          <div style="background: rgba(245, 158, 11, 0.1); color: var(--color-warning); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-file-pdf"></i></div>
          <div>
            <h5 style="font-size: 0.85rem; font-weight: 600; margin-bottom: 2px;">Fiche : Demander une subvention</h5>
            <p style="font-size: 0.75rem; color: var(--text-secondary);">Modèles et bonnes pratiques.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Actions List Card -->
<div class="glass-card" style="margin-bottom: 30px;" id="dashboard-actions-card">
  <h3 style="font-family: var(--font-title); margin-bottom: 15px;">Actions urgentes suggérées</h3>
  <div id="dashboard-actions-list" style="display: flex; flex-direction: column; gap: 12px;">
    
    <!-- Action A : Mouvements non classés -->
    {#if pendingTxCount > 0}
      <div class="dashboard-action-item">
        <i class="fa-solid fa-tags" style="font-size: 1.4rem; color: var(--color-warning); width: 25px;"></i>
        <div style="flex: 1; margin-left: 15px;">
          <h4 style="font-size: 0.95rem; font-weight: 600; color: white;">Il vous reste {pendingTxCount} opérations bancaires à catégoriser</h4>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">Ces écritures sont en attente d'attribution. Un relevé entièrement trié garantit une comptabilité valide.</p>
        </div>
        <button class="btn btn-secondary btn-sm" onclick={() => activeView.set('categorize')}>Trier le relevé</button>
      </div>
    {/if}

    <!-- Action B : Élèves en retard -->
    {#if retards.length > 0}
      <div class="dashboard-action-item">
        <i class="fa-solid fa-users-slash" style="font-size: 1.4rem; color: var(--color-danger); width: 25px;"></i>
        <div style="flex: 1; margin-left: 15px;">
          <h4 style="font-size: 0.95rem; font-weight: 600; color: white;">{retards.length} adhérents ont un solde débiteur (reste à payer)</h4>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">Leur forfait annuel n'a pas encore été entièrement réglé ou réconcilié.</p>
        </div>
        <button class="btn btn-secondary btn-sm" onclick={() => activeView.set('members')}>Voir les fiches</button>
      </div>
    {/if}

    <!-- Action C : Stocks faibles -->
    {#if stocksFaibles.length > 0}
      <div class="dashboard-action-item">
        <i class="fa-solid fa-box-open" style="font-size: 1.4rem; color: var(--color-warning); width: 25px;"></i>
        <div style="flex: 1; margin-left: 15px;">
          <h4 style="font-size: 0.95rem; font-weight: 600; color: white;">{stocksFaibles.length} articles de votre boutique sont en rupture ou stock critique</h4>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
            Produits concernés : {stocksFaibles.map(p => `${p.nom} (${p.stock} restant)`).join(', ')}.
          </p>
        </div>
        <button class="btn btn-secondary btn-sm" onclick={() => activeView.set('sales')}>Gérer le stock</button>
      </div>
    {/if}

    <!-- Fallback si tout est parfait -->
    {#if pendingTxCount === 0 && retards.length === 0 && stocksFaibles.length === 0}
      <div style="text-align: center; padding: 20px; color: var(--color-success); font-weight: 600;">
        <i class="fa-solid fa-circle-check" style="font-size: 1.5rem; margin-bottom: 5px;"></i><br>
        Félicitations, tout est parfaitement à jour ! Aucun problème détecté.
      </div>
    {/if}
  </div>
</div>

<style>
  .dashboard-action-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: rgba(255,255,255,0.02);
    border: 1px solid var(--border-color);
    padding: 15px 20px;
    border-radius: 8px;
    transition: var(--transition-fast);
  }
  .dashboard-action-item:hover {
    background-color: rgba(255,255,255,0.04);
    border-color: var(--border-hover);
  }
</style>
