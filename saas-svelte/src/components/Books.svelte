<script>
  import { 
    transactions, 
    planComptable, 
    closingMonth, 
    updateClosingMonth, 
    showToast 
  } from '../lib/store.js';
  import { Categorizer } from '../lib/categorizer.js';

  let activeSubTab = $state('journal'); // 'journal', 'grandlivre', 'balance', 'bilan'
  let localClosingMonth = $state(9);

  // Filter and sort transactions chronologically (Svelte 5 derived rune)
  let sortedTxList = $derived([...$transactions]
    .filter(t => t.compteAttribué !== '699' && t.statut === 'attribue')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));

  // 1. LIVRE-JOURNAL CALCULATION
  let journalEntries = $derived((() => {
    let pieceNum = 1;
    const entries = [];
    sortedTxList.forEach(tx => {
      const dateStr = new Date(tx.date).toLocaleDateString('fr-FR');
      const piece = `PIECE-${String(pieceNum++).padStart(3, '0')}`;

      if (tx.debit > 0) {
        // Ligne 1 : Débit du compte de charges
        entries.push({
          date: dateStr,
          piece,
          compte: tx.compteAttribué,
          libelleCompte: Categorizer.obtenirLibelleCompte(tx.compteAttribué),
          description: tx.libelle,
          debit: tx.debit,
          credit: null,
          offset: false
        });
        // Ligne 2 : Crédit du compte banque 512
        entries.push({
          date: dateStr,
          piece,
          compte: '512',
          libelleCompte: 'Banque',
          description: tx.libelle,
          debit: null,
          credit: tx.debit,
          offset: true
        });
      } else if (tx.credit > 0) {
        // Ligne 1 : Débit du compte banque 512
        entries.push({
          date: dateStr,
          piece,
          compte: '512',
          libelleCompte: 'Banque',
          description: tx.libelle,
          debit: tx.credit,
          credit: null,
          offset: false
        });
        // Ligne 2 : Crédit du compte de produits
        entries.push({
          date: dateStr,
          piece,
          compte: tx.compteAttribué,
          libelleCompte: Categorizer.obtenirLibelleCompte(tx.compteAttribué),
          description: tx.libelle,
          debit: null,
          credit: tx.credit,
          offset: true
        });
      }
    });
    return entries;
  })());

  // 2. GRAND LIVRE CALCULATION
  let grandLivreAccounts = $derived((() => {
    const comptesGroupes = { '512': [] };

    sortedTxList.forEach(tx => {
      const cpt = tx.compteAttribué;
      if (!comptesGroupes[cpt]) comptesGroupes[cpt] = [];

      if (tx.debit > 0) {
        comptesGroupes[cpt].push({ date: tx.date, libelle: tx.libelle, debit: tx.debit, credit: 0 });
        comptesGroupes['512'].push({ date: tx.date, libelle: tx.libelle, debit: 0, credit: tx.debit });
      } else if (tx.credit > 0) {
        comptesGroupes['512'].push({ date: tx.date, libelle: tx.libelle, debit: tx.credit, credit: 0 });
        comptesGroupes[cpt].push({ date: tx.date, libelle: tx.libelle, debit: 0, credit: tx.credit });
      }
    });

    const accounts = [];
    Object.keys(comptesGroupes).sort().forEach(cptNum => {
      const operations = comptesGroupes[cptNum];
      if (operations.length === 0) return;

      const nomCompte = cptNum === '512' ? 'Compte Bancaire (Banque)' : Categorizer.obtenirLibelleCompte(cptNum);
      let runningSolde = 0;

      const mappedOps = operations.map(op => {
        const estActifOuCharge = cptNum.startsWith('5') || cptNum.startsWith('6') || cptNum.startsWith('411') || cptNum.startsWith('467');
        if (estActifOuCharge) {
          runningSolde += op.debit - op.credit;
        } else {
          runningSolde += op.credit - op.debit;
        }
        return {
          ...op,
          solde: runningSolde
        };
      });

      accounts.push({
        compte: cptNum,
        nom: nomCompte,
        operations: mappedOps
      });
    });

    return accounts;
  })());

  // 3. BALANCE CALCULATION
  let balanceRows = $derived((() => {
    const balanceData = { '512': { debit: 0, credit: 0 } };

    sortedTxList.forEach(tx => {
      const cpt = tx.compteAttribué;
      if (!balanceData[cpt]) balanceData[cpt] = { debit: 0, credit: 0 };

      if (tx.debit > 0) {
        balanceData[cpt].debit += tx.debit;
        balanceData['512'].credit += tx.debit;
      } else if (tx.credit > 0) {
        balanceData['512'].debit += tx.credit;
        balanceData[cpt].credit += tx.credit;
      }
    });

    return Object.keys(balanceData).sort().map(cptNum => {
      const data = balanceData[cptNum];
      const nom = cptNum === '512' ? 'Compte courant Banque' : Categorizer.obtenirLibelleCompte(cptNum);
      
      let soldeDebiteur = 0;
      let soldeCrediteur = 0;

      const estActifOuCharge = cptNum.startsWith('5') || cptNum.startsWith('6') || cptNum.startsWith('411') || cptNum.startsWith('467');
      if (estActifOuCharge) {
        const diff = data.debit - data.credit;
        if (diff >= 0) soldeDebiteur = diff;
        else soldeCrediteur = Math.abs(diff);
      } else {
        const diff = data.credit - data.debit;
        if (diff >= 0) soldeCrediteur = diff;
        else soldeDebiteur = Math.abs(diff);
      }

      return {
        compte: cptNum,
        nom,
        debit: data.debit,
        credit: data.credit,
        soldeDebiteur,
        soldeCrediteur
      };
    });
  })());

  // 4. BILAN CALCULATION
  let bilanData = $derived((() => {
    const balanceData = { '512': { debit: 0, credit: 0 } };

    sortedTxList.forEach(tx => {
      const cpt = tx.compteAttribué;
      if (!balanceData[cpt]) balanceData[cpt] = { debit: 0, credit: 0 };

      if (tx.debit > 0) {
        balanceData[cpt].debit += tx.debit;
        balanceData['512'].credit += tx.debit;
      } else if (tx.credit > 0) {
        balanceData['512'].debit += tx.credit;
        balanceData[cpt].credit += tx.credit;
      }
    });

    let totalActif = 0;
    let totalPassif = 0;

    const actifs = [];
    const passifs = [];

    // Actifs (5xxx, 411, 467)
    Object.keys(balanceData).forEach(cpt => {
      if (cpt.startsWith('5') || cpt === '411' || cpt === '467') {
        const val = balanceData[cpt].debit - balanceData[cpt].credit;
        if (val === 0) return;

        totalActif += val;
        actifs.push({
          compte: cpt,
          nom: cpt === '512' ? 'Compte en Banque' : Categorizer.obtenirLibelleCompte(cpt),
          valeur: val
        });
      }
    });

    // Passifs (102, 401, 421, etc.)
    Object.keys(balanceData).forEach(cpt => {
      if (cpt === '102' || cpt === '401' || cpt === '421' || cpt === '437' || cpt === '445') {
        const val = balanceData[cpt].credit - balanceData[cpt].debit;
        if (val === 0) return;

        totalPassif += val;
        passifs.push({
          compte: cpt,
          nom: Categorizer.obtenirLibelleCompte(cpt),
          valeur: val
        });
      }
    });

    // Net Result excédent
    let recettes = 0;
    let depenses = 0;
    Object.keys(balanceData).forEach(cpt => {
      const p = $planComptable.find(pc => pc.compte === cpt);
      if (p) {
        if (p.type === 'Produit') recettes += balanceData[cpt].credit;
        if (p.type === 'Charge') depenses += balanceData[cpt].debit;
      }
    });
    const excedent = recettes - depenses;
    totalPassif += excedent;

    return {
      actifs,
      passifs,
      excedent,
      totalActif,
      totalPassif
    };
  })());

  function handleSaveClosingMonth() {
    updateClosingMonth(localClosingMonth);
    showToast(`📅 Rentrée de l'exercice configurée en ${getMonthName(localClosingMonth)}.`);
  }

  function getMonthName(m) {
    const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    return months[m - 1];
  }

  function exportFEC() {
    let fec = 'JournalCode;JournalLib;EcritureNum;EcritureDate;CompteNum;CompteLib;PieceRef;PieceDate;EcritureLib;Debit;Credit\n';
    let idx = 1;
    sortedTxList.forEach(tx => {
      const date = tx.date.replace(/-/g, '');
      const piece = `PIECE-${idx}`;
      
      if (tx.debit > 0) {
        fec += `JNL;Journal General;${idx};${date};${tx.compteAttribué};${Categorizer.obtenirLibelleCompte(tx.compteAttribué)};${piece};${date};${tx.libelle};${tx.debit.toFixed(2)};0.00\n`;
        fec += `JNL;Journal General;${idx};${date};512;Banque;${piece};${date};${tx.libelle};0.00;${tx.debit.toFixed(2)}\n`;
      } else if (tx.credit > 0) {
        fec += `JNL;Journal General;${idx};${date};512;Banque;${piece};${date};${tx.libelle};${tx.credit.toFixed(2)};0.00\n`;
        fec += `JNL;Journal General;${idx};${date};${tx.compteAttribué};${Categorizer.obtenirLibelleCompte(tx.compteAttribué)};${piece};${date};${tx.libelle};0.00;${tx.credit.toFixed(2)}\n`;
      }
      idx++;
    });

    const blob = new Blob([fec], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `FEC_EXERCICE_COMPTABLE_${new Date().getFullYear()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('💾 Export FEC généré pour votre expert-comptable !');
  }

  $effect(() => {
    if ($closingMonth) {
      localClosingMonth = $closingMonth;
    }
  });
</script>

<div class="page-title-section">
  <h1 class="page-title">Registres & Clôture de l'exercice</h1>
  <p class="page-subtitle">Consultez vos documents légaux mis à jour en temps réel.</p>
</div>

<!-- Config Season -->
<div class="glass-card" style="margin-bottom: 30px;">
  <h3 style="font-family: var(--font-title); margin-bottom: 10px;">Configuration de l'exercice</h3>
  <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 15px;">
    Choisissez le mois de début de vos comptes (ex: Septembre pour une saison d'association scolaire, Janvier pour année civile).
  </p>
  <div style="display: flex; gap: 15px; align-items: center;">
    <select id="closing-month-select" class="form-control" style="max-width: 200px;" bind:value={localClosingMonth}>
      <option value={1}>Janvier</option>
      <option value={9}>Septembre (Saison scolaire)</option>
      <option value={12}>Décembre</option>
    </select>
    <button class="btn btn-primary btn-sm" onclick={handleSaveClosingMonth}>Valider le mois de rentrée</button>
    
    <button class="btn btn-success btn-sm" onclick={exportFEC} style="margin-left: auto;">
      <i class="fa-solid fa-file-export"></i> Exporter pour l'Expert-comptable (Format FEC)
    </button>
  </div>
</div>

<!-- Sub Tabs -->
<div style="display: flex; gap: 10px; margin-bottom: 20px;">
  <button class="btn btn-secondary btn-sm {activeSubTab === 'journal' ? 'active' : ''}" id="sub-btn-journal" onclick={() => activeSubTab = 'journal'}>Livre-journal</button>
  <button class="btn btn-secondary btn-sm {activeSubTab === 'grandlivre' ? 'active' : ''}" id="sub-btn-grandlivre" onclick={() => activeSubTab = 'grandlivre'}>Le Grand-livre</button>
  <button class="btn btn-secondary btn-sm {activeSubTab === 'balance' ? 'active' : ''}" id="sub-btn-balance" onclick={() => activeSubTab = 'balance'}>La Balance</button>
  <button class="btn btn-secondary btn-sm {activeSubTab === 'bilan' ? 'active' : ''}" id="sub-btn-bilan" onclick={() => activeSubTab = 'bilan'}>Le Bilan Simplifié</button>
</div>

<!-- subtab: JOURNAL -->
{#if activeSubTab === 'journal'}
  <div class="glass-card">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <h3 style="font-family: var(--font-title);">Livre-journal des écritures (Double entrée)</h3>
      <div class="tooltip-container">
        <span class="pedago-help-btn">?</span>
        <span class="tooltip-text">
          <strong>Le Livre-journal</strong>
          C'est le registre obligatoire dans lequel toutes les opérations de la structure sont écrites au jour le jour. Chaque opération possède au moins deux lignes (débit pour l'utilisation, crédit pour l'origine de l'argent).
        </span>
      </div>
    </div>
    
    <div class="table-container">
      <table class="custom-table" id="journal-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>N° Pièce</th>
            <th>Compte Catégorie</th>
            <th>Libellé / Note</th>
            <th>Dépenses (Débit)</th>
            <th>Recettes (Crédit)</th>
          </tr>
        </thead>
        <tbody>
          {#if journalEntries.length === 0}
            <tr>
              <td colspan="6" style="text-align: center; color: var(--text-secondary);">Aucune écriture classée disponible dans le Journal.</td>
            </tr>
          {:else}
            {#each journalEntries as entry}
              <tr>
                <td style={entry.offset ? 'color: var(--text-muted);' : ''}>{entry.date}</td>
                <td style={entry.offset ? 'color: var(--text-muted);' : ''}>{entry.piece}</td>
                <td style={entry.offset ? 'padding-left: 40px;' : ''}><strong>{entry.compte}</strong> - {entry.libelleCompte}</td>
                <td style={entry.offset ? 'color: var(--text-muted);' : ''}>{entry.description}</td>
                <td class="amount debit">{entry.debit ? entry.debit.toFixed(2) + ' €' : '-'}</td>
                <td class="amount credit">{entry.credit ? entry.credit.toFixed(2) + ' €' : '-'}</td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
{/if}

<!-- subtab: GRAND LIVRE -->
{#if activeSubTab === 'grandlivre'}
  <div id="grandlivre-container">
    {#if grandLivreAccounts.length === 0}
      <div class="glass-card" style="text-align: center; color: var(--text-secondary); padding: 40px;">
        Aucune écriture triée pour remplir le Grand Livre.
      </div>
    {:else}
      {#each grandLivreAccounts as acc}
        <div class="glass-card" style="margin-bottom: 25px;">
          <h4 style="font-family: var(--font-title); color: white; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
            Compte {acc.compte} — {acc.nom}
          </h4>
          <div class="table-container">
            <table class="custom-table" style="font-size: 0.85rem;">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Détail Opération</th>
                  <th>Débit (Dépenses)</th>
                  <th>Crédit (Recettes)</th>
                  <th>Solde progressif</th>
                </tr>
              </thead>
              <tbody>
                {#each acc.operations as op}
                  <tr>
                    <td>{new Date(op.date).toLocaleDateString('fr-FR')}</td>
                    <td>{op.libelle}</td>
                    <td class="amount debit">{op.debit > 0 ? op.debit.toFixed(2) + ' €' : '-'}</td>
                    <td class="amount credit">{op.credit > 0 ? op.credit.toFixed(2) + ' €' : '-'}</td>
                    <td style="font-weight: 700; color: white;">{op.solde.toFixed(2)} €</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/each}
    {/if}
  </div>
{/if}

<!-- subtab: BALANCE -->
{#if activeSubTab === 'balance'}
  <div class="glass-card">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <h3 style="font-family: var(--font-title);">La Balance Générale des comptes</h3>
      <div class="tooltip-container">
        <span class="pedago-help-btn">?</span>
        <span class="tooltip-text">
          <strong>La Balance comptable</strong>
          C'est un récapitulatif de tous les comptes ouverts dans le Grand Livre. Elle affiche la somme des débits et des crédits pour chaque compte, et le solde net qui en découle. C'est l'outil de vérification par excellence.
        </span>
      </div>
    </div>
    
    <div class="table-container">
      <table class="custom-table" id="balance-table">
        <thead>
          <tr>
            <th>N° Compte</th>
            <th>Intitulé du compte</th>
            <th>Total Débits</th>
            <th>Total Crédits</th>
            <th>Solde Débiteur</th>
            <th>Solde Créditeur</th>
          </tr>
        </thead>
        <tbody>
          {#if balanceRows.length === 0 || (balanceRows.length === 1 && balanceRows[0].debit === 0 && balanceRows[0].credit === 0)}
            <tr>
              <td colspan="6" style="text-align: center; color: var(--text-secondary);">Aucune écriture triée disponible pour la balance.</td>
            </tr>
          {:else}
            {#each balanceRows as row}
              <tr>
                <td><strong>{row.compte}</strong></td>
                <td style="color: white;">{row.nom}</td>
                <td class="amount">{row.debit.toFixed(2)} €</td>
                <td class="amount">{row.credit.toFixed(2)} €</td>
                <td class="amount debit">{row.soldeDebiteur > 0 ? row.soldeDebiteur.toFixed(2) + ' €' : '-'}</td>
                <td class="amount credit">{row.soldeCrediteur > 0 ? row.soldeCrediteur.toFixed(2) + ' €' : '-'}</td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
{/if}

<!-- subtab: BILAN -->
{#if activeSubTab === 'bilan'}
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
    
    <!-- ACTIF -->
    <div class="glass-card">
      <h3 style="font-family: var(--font-title); margin-bottom: 15px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; color: white;">
        ACTIF (Ce que la structure possède)
      </h3>
      <table class="custom-table" id="bilan-actif-table">
        <thead>
          <tr>
            <th>Rubrique / Compte</th>
            <th style="text-align: right;">Valeur nette</th>
          </tr>
        </thead>
        <tbody>
          {#each bilanData.actifs as act}
            <tr>
              <td><strong>{act.compte}</strong> - {act.nom}</td>
              <td class="amount" style="text-align: right; color: white;">{act.valeur.toFixed(2)} €</td>
            </tr>
          {/each}
          <tr style="background-color: rgba(255,255,255,0.05);">
            <td style="color: white; font-weight: 800;">TOTAL DE L'ACTIF</td>
            <td class="amount" style="text-align: right; color: var(--color-primary-light); font-weight: 800; font-size: 1.1rem;">
              {bilanData.totalActif.toFixed(2)} €
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- PASSIF -->
    <div class="glass-card">
      <h3 style="font-family: var(--font-title); margin-bottom: 15px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; color: white;">
        PASSIF (Ce que la structure doit)
      </h3>
      <table class="custom-table" id="bilan-passif-table">
        <thead>
          <tr>
            <th>Rubrique / Compte</th>
            <th style="text-align: right;">Valeur nette</th>
          </tr>
        </thead>
        <tbody>
          {#each bilanData.passifs as pas}
            <tr>
              <td><strong>{pas.compte}</strong> - {pas.nom}</td>
              <td class="amount" style="text-align: right; color: white;">{pas.valeur.toFixed(2)} €</td>
            </tr>
          {/each}
          <tr>
            <td><strong>120/129</strong> - Résultat net (Bénéfice/Excédent)</td>
            <td class="amount" style="text-align: right; color: var(--color-success); font-weight: 700;">
              {bilanData.excedent.toFixed(2)} €
            </td>
          </tr>
          <tr style="background-color: rgba(255,255,255,0.05);">
            <td style="color: white; font-weight: 800;">TOTAL DU PASSIF</td>
            <td class="amount" style="text-align: right; color: var(--color-success); font-weight: 800; font-size: 1.1rem;">
              {bilanData.totalPassif.toFixed(2)} €
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
{/if}
