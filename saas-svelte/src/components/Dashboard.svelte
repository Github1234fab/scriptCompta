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

  // Metrics Sérénité & Prévisions
  let urssafEstimee = $derived(recettes * 0.211); // Taux moyen de prestations micro
  let tvaCollectee = $derived(recettes * 0.20);
  let tvaDeductible = $derived(depenses * 0.20);
  let tvaNetteEstimee = $derived(Math.max(0, tvaCollectee - tvaDeductible));
  let provisionsTotales = $derived(urssafEstimee + (accountingModel === 'tpe' ? tvaNetteEstimee : 0));
  let vraiDisponible = $derived(totalTrésorerie - provisionsTotales);

  let moyDepensesMensuelles = $derived(depenses > 0 ? (depenses / 3) : 200);
  let runwayMois = $derived(moyDepensesMensuelles > 0 ? (vraiDisponible / moyDepensesMensuelles).toFixed(1) : '12+');

  // Justificatifs & Pièces manquantes
  let debitsTotaux = $derived($transactions.filter(t => t.debit > 0 && t.statut === 'attribue'));
  let piecesManquantesCount = $derived(debitsTotaux.filter(t => !t.factureUrl).length);
  let scoreConformite = $derived(debitsTotaux.length > 0 ? Math.round(((debitsTotaux.length - piecesManquantesCount) / debitsTotaux.length) * 100) : 100);

  // Seuils Micro-entreprise (TVA: 36 800 €, Plafond CA: 77 700 €)
  let pctSeuilTVA = $derived(Math.min(100, Math.round((recettes / 36800) * 100)));
  let pctSeuilCA = $derived(Math.min(100, Math.round((recettes / 77700) * 100)));

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

<div class="glass-card" style="margin-bottom: 25px; padding: 15px 20px; background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9)); border: 1px solid var(--border-color);">
  <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
    <div>
      <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--color-primary-light); letter-spacing: 0.05em;">Choix de la forme juridique & du profil</span>
      <h2 style="font-family: var(--font-title); font-size: 1.25rem; color: white; margin-top: 2px;">
        Pour quelle structure gérez-vous cette comptabilité ?
      </h2>
    </div>

    <!-- 3 Big Visual Profile Switch Buttons -->
    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
      <button 
        class="btn {accountingModel === 'micro' ? 'btn-primary' : 'btn-secondary'}" 
        onclick={() => handleModelChange({ target: { value: 'micro', options: [{ text: 'Micro-entreprise / Indépendant' }], selectedIndex: 0 } })}
        style="padding: 8px 14px; font-size: 0.85rem; font-weight: 600;"
      >
        🚀 Micro-entreprise / Indépendant
      </button>

      <button 
        class="btn {accountingModel === 'tpe' ? 'btn-primary' : 'btn-secondary'}" 
        onclick={() => handleModelChange({ target: { value: 'tpe', options: [{ text: 'Société / TPE (SASU, SARL...)' }], selectedIndex: 0 } })}
        style="padding: 8px 14px; font-size: 0.85rem; font-weight: 600;"
      >
        🏢 Société / TPE (SASU, SARL...)
      </button>

      <button 
        class="btn {accountingModel === 'asso' ? 'btn-primary' : 'btn-secondary'}" 
        onclick={() => handleModelChange({ target: { value: 'asso', options: [{ text: 'Association (Loi 1901)' }], selectedIndex: 0 } })}
        style="padding: 8px 14px; font-size: 0.85rem; font-weight: 600;"
      >
        🤝 Association (Loi 1901)
      </button>

      <button 
        class="btn {accountingModel === 'all' ? 'btn-primary' : 'btn-secondary'}" 
        onclick={() => handleModelChange({ target: { value: 'all', options: [{ text: 'Modèle Complet' }], selectedIndex: 0 } })}
        style="padding: 8px 12px; font-size: 0.85rem; opacity: 0.8;"
      >
        ⚙️ Tous les outils
      </button>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!-- BLOC 1 : OÙ J'EN SUIS ? (La Météo de Trésorerie) -->
<!-- ═══════════════════════════════════════════════════════════════════ -->
<div style="margin-top: 25px; margin-bottom: 30px;">
  <h3 style="font-family: var(--font-title); font-size: 1.15rem; color: white; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
    <span style="background: rgba(99, 102, 241, 0.15); color: #818cf8; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.85rem;">1</span>
    Où j'en suis ? (Météo de Trésorerie)
  </h3>

  <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
    <!-- Card 1.1 : Solde Bancaire Réel -->
    <div class="glass-card highlight-primary">
      <div class="stat-icon primary"><i class="fa-solid fa-wallet"></i></div>
      <div class="stat-label" style="font-size: 1.15rem; font-weight: 700; color: white; margin-bottom: 8px;">
        Solde Bancaire Brut
      </div>
      <div class="stat-value" style="font-size: 1.75rem; margin: 0;">
        {totalTrésorerie.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </div>
      <span style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-top: 6px;">Compte 512 + Caisse 530</span>
    </div>

    <!-- Card 1.2 : Le VRAI Disponible -->
    <div class="glass-card highlight-success" style="border: 1px solid rgba(52, 211, 153, 0.4);">
      <div class="stat-icon success"><i class="fa-solid fa-shield-halved"></i></div>
      <div class="stat-label" style="font-size: 1.15rem; font-weight: 700; color: #34d399; margin-bottom: 8px;">
        Le Vrai Disponible
        <div class="tooltip-container">
          <span class="pedago-help-btn">?</span>
          <span class="tooltip-text">
            <strong>Le Vrai Disponible</strong>
            Solde bancaire après déduction automatique des charges et taxes déjà accumulées (Urssaf/TVA estimées). C'est l'argent que vous pouvez utiliser sans risque !
          </span>
        </div>
      </div>
      <div class="stat-value" style="font-size: 1.75rem; margin: 0; color: #34d399;">
        {vraiDisponible.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </div>
      <span style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-top: 6px;">-{provisionsTotales.toFixed(0)}€ de provisionsUrssaf/TVA</span>
    </div>

    <!-- Card 1.3 : Runway / Autonomie -->
    <div class="glass-card highlight-warning">
      <div class="stat-icon warning"><i class="fa-solid fa-hourglass-half"></i></div>
      <div class="stat-label" style="font-size: 1.15rem; font-weight: 700; color: white; margin-bottom: 8px;">
        Autonomie (Runway)
      </div>
      <div class="stat-value" style="font-size: 1.75rem; margin: 0;">
        {runwayMois} <span style="font-size: 0.95rem; font-weight: normal; color: var(--text-secondary);">mois</span>
      </div>
      <span style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-top: 6px;">de réserve sans aucune rentrée</span>
    </div>

    <!-- Card 1.4 : Opérations à classer -->
    <div 
      class="glass-card highlight-danger" 
      role="button"
      tabindex="0"
      onclick={() => activeView.set('categorize')} 
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && activeView.set('categorize')}
      style="cursor: pointer;"
    >
      <div class="stat-icon danger" style="background-color: rgba(239, 68, 68, 0.15); color: #ef4444;"><i class="fa-solid fa-bell"></i></div>
      <div class="stat-label" style="font-size: 1.15rem; font-weight: 700; color: white; margin-bottom: 8px;">
        À Classer
      </div>
      <div class="stat-value" style="font-size: 1.75rem; margin: 0; color: #ef4444;">
        {pendingTxCount} <span style="font-size: 0.95rem; font-weight: normal; color: var(--text-secondary);">lignes</span>
      </div>
      <span style="font-size: 0.82rem; color: #ef4444; display: block; margin-top: 6px;">Cliquez pour attribuer en 1-clic ➔</span>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!-- BLOC 2 : À PAYER BIENTÔT ? (Le Radar des Échéances) -->
<!-- ═══════════════════════════════════════════════════════════════════ -->
<div style="margin-bottom: 30px;">
  <h3 style="font-family: var(--font-title); font-size: 1.15rem; color: white; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
    <span style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.85rem;">2</span>
    À payer bientôt ? (Radar des Échéances & Seuils)
  </h3>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
    
    {#if accountingModel === 'micro' || accountingModel === 'all'}
      <!-- Jauge Micro-entreprise : Urssaf & Seuils -->
      <div class="glass-card">
        <h4 style="font-family: var(--font-title); font-size: 0.95rem; color: white; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-calculator" style="color: #f59e0b;"></i> Cotisations Urssaf Estimées (Micro)
        </h4>
        <div style="font-size: 1.6rem; font-weight: 700; color: #f59e0b; font-family: var(--font-title); margin-bottom: 8px;">
          {urssafEstimee.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </div>
        <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 15px;">
          Basé sur un taux estimé de 21,1% sur les {recettes.toFixed(0)}€ de CA encaissé.
        </p>

        <!-- Jauge Seuil TVA -->
        <div style="margin-top: 15px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 600; margin-bottom: 4px;">
            <span>Seuil de Franchise TVA (36 800 €)</span>
            <span style="color: {pctSeuilTVA >= 80 ? '#f59e0b' : '#34d399'};">{pctSeuilTVA}%</span>
          </div>
          <div class="progress-bar-container" style="height: 6px;">
            <div class="progress-bar-fill" style="width: {pctSeuilTVA}%; background: {pctSeuilTVA >= 80 ? '#f59e0b' : '#34d399'};"></div>
          </div>
        </div>

        <!-- Jauge Plafond Micro -->
        <div style="margin-top: 12px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 600; margin-bottom: 4px;">
            <span>Plafond CA Micro (77 700 €)</span>
            <span style="color: {pctSeuilCA >= 80 ? '#ef4444' : '#38bdf8'};">{pctSeuilCA}%</span>
          </div>
          <div class="progress-bar-container" style="height: 6px;">
            <div class="progress-bar-fill" style="width: {pctSeuilCA}%; background: {pctSeuilCA >= 80 ? '#ef4444' : '#38bdf8'};"></div>
          </div>
        </div>
      </div>
    {/if}

    {#if accountingModel === 'tpe' || accountingModel === 'all'}
      <!-- Estimation TVA Nette (Société/TPE) -->
      <div class="glass-card">
        <h4 style="font-family: var(--font-title); font-size: 0.95rem; color: white; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-file-invoice-dollar" style="color: #38bdf8;"></i> Estimation TVA Nette à Décaisser (TPE)
        </h4>
        <div style="font-size: 1.6rem; font-weight: 700; color: #38bdf8; font-family: var(--font-title); margin-bottom: 8px;">
          {tvaNetteEstimee.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </div>
        <div style="font-size: 0.8rem; color: var(--text-secondary); display: flex; gap: 15px;">
          <span>TVA Collectée : <strong style="color: #34d399;">+{tvaCollectee.toFixed(0)}€</strong></span>
          <span>TVA Déductible : <strong style="color: #f87171;">-{tvaDeductible.toFixed(0)}€</strong></span>
        </div>
      </div>
    {/if}

    {#if accountingModel === 'asso'}
      <!-- Suivi Asso / Subventions -->
      <div class="glass-card">
        <h4 style="font-family: var(--font-title); font-size: 0.95rem; color: white; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-hand-holding-heart" style="color: #34d399;"></i> Reste à encaisser (Adhésions)
        </h4>
        <div style="font-size: 1.6rem; font-weight: 700; color: #34d399; font-family: var(--font-title); margin-bottom: 8px;">
          {resteAEncaisser.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </div>
        <p style="font-size: 0.8rem; color: var(--text-secondary);">
          Montant des cotisations d'élèves/adhérents enregistrées en attente de règlement bancaire.
        </p>
      </div>
    {/if}

    <!-- Graphique Synthétique Entrées vs Sorties -->
    <div class="glass-card">
      <h4 style="font-family: var(--font-title); font-size: 0.95rem; color: white; margin-bottom: 12px;">
        Résultat de l'exercice
      </h4>
      <div style="display: flex; gap: 15px; align-items: flex-end; height: 90px; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
        <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
          <div style="background: linear-gradient(to top, #10b981, #34d399); width: 40px; height: {recettesHeight}%; border-radius: 4px 4px 0 0;"></div>
          <span style="font-size: 0.72rem; margin-top: 6px; color: #34d399; font-weight: 700;">+{recettes.toFixed(0)}€</span>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
          <div style="background: linear-gradient(to top, #ef4444, #f87171); width: 40px; height: {depensesHeight}%; border-radius: 4px 4px 0 0;"></div>
          <span style="font-size: 0.72rem; margin-top: 6px; color: #f87171; font-weight: 700;">-{depenses.toFixed(0)}€</span>
        </div>
      </div>
      <div style="margin-top: 8px; text-align: center; font-size: 0.82rem;">
        <span>Résultat Net :</span>
        <strong style="font-size: 0.95rem; color: {resultatNet >= 0 ? '#34d399' : '#f87171'}">
          {resultatNet >= 0 ? '+' : ''} {resultatNet.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </strong>
      </div>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!-- BLOC 3 : CE QU'IL RESTE À FAIRE ? (La Boîte à Justificatifs Propre) -->
<!-- ═══════════════════════════════════════════════════════════════════ -->
<div>
  <h3 style="font-family: var(--font-title); font-size: 1.15rem; color: white; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
    <span style="background: rgba(16, 185, 129, 0.15); color: #34d399; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.85rem;">3</span>
    Ce qu'il reste à faire ? (La Boîte à Justificatifs Propre)
  </h3>

  <div class="glass-card" style="border: 1px solid rgba(16, 185, 129, 0.3);">
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;">
      <div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted);">Score de conformité justificatifs</span>
          <span class="badge {scoreConformite >= 90 ? 'badge-success' : 'badge-warning'}">{scoreConformite}% conforme</span>
        </div>
        <h4 style="font-family: var(--font-title); font-size: 1.2rem; color: white; margin-top: 6px;">
          {piecesManquantesCount === 0 ? '🎉 Aucune pièce justificative manquante ! Vous êtes à jour.' : `⚠️ Vous avez ${piecesManquantesCount} dépense(s) bancaire(s) sans reçu rattaché.`}
        </h4>
        <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;">
          Un dossier justificatif 100% propre garantit zéro redressement en cas de contrôle fiscal.
        </p>
      </div>

      <div style="display: flex; gap: 12px;">
        <button class="btn btn-secondary" onclick={() => activeView.set('pieces')}>
          <i class="fa-solid fa-receipt"></i> Voir les {piecesManquantesCount} pièces manquantes
        </button>
        {#if accountingModel === 'micro'}
          <button class="btn btn-primary" onclick={() => activeView.set('recettes')}>
            <i class="fa-solid fa-file-export"></i> Exporter le Livre des Recettes
          </button>
        {:else}
          <button class="btn btn-primary" onclick={() => activeView.set('books')}>
            <i class="fa-solid fa-paper-plane"></i> Transmettre (Export FEC / CSV)
          </button>
        {/if}
      </div>
    </div>
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
