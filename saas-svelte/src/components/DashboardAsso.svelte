<script>
  import { transactions, members, donors, planComptable, activeEntityId, entities, activeView, showToast, formatDateFr, initialBankBalance, updateInitialBankBalance, openHelpGuide } from '../lib/store.js';
  import { Categorizer } from '../lib/categorizer.js';
  import PageHeader from './PageHeader.svelte';
  import KpiCard from './KpiCard.svelte';
  import InfoTip from './InfoTip.svelte';

  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0] || { name: 'Mon Association', model: 'asso' });

  let activeTx = $derived($transactions.filter((/** @type {any} */ tx) => !tx.entityId || tx.entityId === $activeEntityId));

  let totalBanque = $derived($initialBankBalance + activeTx.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue' && tx.compteAttribué !== '530') {
      return sum + (tx.credit - tx.debit);
    }
    return sum;
  }, 0));

  let cotisationsEncaissées = $derived(activeTx.reduce((sum, tx) => {
    const isCotisOuCours = tx.compteAttribué === '756' || tx.compteAttribué === '706' || (tx.compteAttribué && tx.compteAttribué.startsWith('706'));
    if (isCotisOuCours && tx.statut === 'attribue') {
      return sum + tx.credit;
    }
    return sum;
  }, 0));

  let totalRecettes = $derived(activeTx.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue') {
      const cpt = $planComptable.find((/** @type {any} */ p) => p.compte === tx.compteAttribué);
      const isProduit = (cpt && cpt.type === 'Produit') || (tx.compteAttribué && tx.compteAttribué.startsWith('7'));
      if (isProduit) return sum + ((tx.credit || 0) - (tx.debit || 0));
    }
    return sum;
  }, 0));

  let totalCharges = $derived(activeTx.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue') {
      const cpt = $planComptable.find((/** @type {any} */ p) => p.compte === tx.compteAttribué);
      const isCharge = (cpt && cpt.type === 'Charge') || (tx.compteAttribué && tx.compteAttribué.startsWith('6'));
      if (isCharge) return sum + ((tx.debit || 0) - (tx.credit || 0));
    }
    return sum;
  }, 0));

  let resultatNet = $derived(totalRecettes - totalCharges);

  let donsEncaissés = $derived(activeTx.reduce((sum, tx) => {
    const isDon = tx.compteAttribué === '754' || (tx.compteAttribué && tx.compteAttribué.startsWith('754'));
    if (isDon && tx.statut === 'attribue') {
      return sum + tx.credit;
    }
    return sum;
  }, 0));

  let resteAEncaisser = $derived($members.reduce((sum, m) => {
    const reste = m.forfait - m.dejaPaye;
    return sum + (reste > 0 ? reste : 0);
  }, 0));

  let retardsCount = $derived($members.filter(m => (m.forfait - m.dejaPaye) > 0).length);

  let pendingTxCount = $derived(activeTx.filter(
    t => t.compteAttribué === '699' || t.statut === 'non_attribue' || t.statut === 'suggere' || t.statut === 'a_attribuer'
  ).length);

  let totalTasksCount = $derived(pendingTxCount + (retardsCount > 0 ? 1 : 0));

  // Dictionnaire de préservation et correction des sigles, abréviations et particules bancaires
  const ACRONYMS_AND_WORDS = {
    'sepa': 'SEPA',
    'cb': 'CB',
    'sncf': 'SNCF',
    'edf': 'EDF',
    'gdf': 'GDF',
    'urssaf': 'URSSAF',
    'dgfip': 'DGFiP',
    'cpam': 'CPAM',
    'rib': 'RIB',
    'iban': 'IBAN',
    'bic': 'BIC',
    'sarl': 'SARL',
    'sas': 'SAS',
    'sci': 'SCI',
    'eurl': 'EURL',
    'sa': 'SA',
    'fr': 'FR',
    'plvt': 'Prélèvement',
    'prlvt': 'Prélèvement',
    'magnetiq': 'magnétique',
    'inst': 'instantané',
    'cotis': 'Cotisation',
    'adh': 'Adhésion',
    'm': 'M.',
    'mme': 'Mme',
    'mlle': 'Mlle',
    'mr': 'M.'
  };

  // Helper pour uniformiser l'espacement et la typographie des montants
  function formatCurrency(val, withSign = false) {
    const num = Number(val) || 0;
    const parts = Math.abs(num).toFixed(2).split('.');
    const intPartWithSpaces = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
    const formatted = `${intPartWithSpaces},${parts[1]}`;
    if (withSign) {
      const sign = num > 0 ? '+ ' : num < 0 ? '- ' : '';
      return `${sign}${formatted}\u00A0€`;
    }
    const sign = num < 0 ? '- ' : '';
    return `${sign}${formatted}\u00A0€`;
  }

  // Helper pour raccourcir les libellés de badges sur mobile avec le numéro de compte en premier
  /** @param {string|number|null|undefined} [compte] */
  function formatMobileAccountBadge(compte) {
    if (!compte || String(compte) === '699') return 'Non attribué';
    const cpt = String(compte).trim();

    /** @type {Record<string, string>} */
    const SHORT_LABELS = {
      '756': 'Cotisations',
      '706': 'Cours & Ateliers',
      '754': 'Dons',
      '707': 'Ventes',
      '708': 'Prestations',
      '740': 'Subventions',
      '606': 'Fournitures',
      '6061': 'Électricité & Eau',
      '6063': 'Petit matériel',
      '6064': 'Fournitures bureau',
      '6068': 'Fournitures diverses',
      '613': 'Locations',
      '615': 'Entretien',
      '616': 'Assurances',
      '618': 'Documentation',
      '622': 'Honoraires',
      '623': 'Publicité & Com',
      '625': 'Déplacements',
      '6251': 'Voyages & Dépl.',
      '6256': 'Repas & Missions',
      '6257': 'Réceptions',
      '626': 'Télécom & Poste',
      '627': 'Frais bancaires',
      '628': 'Divers',
      '641': 'Salaires',
      '645': 'Cotisations soc.',
      '6453': 'Mutuelle',
      '651': 'Logiciels & SaaS',
      '658': 'Charges diverses',
      '681': 'Amortissements',
      '487': 'Reports',
      '512': 'Banque',
      '530': 'Espèces'
    };

    if (SHORT_LABELS[cpt]) {
      return `${cpt} · ${SHORT_LABELS[cpt]}`;
    }

    for (const prefix of ['6453', '625', '606', '756', '706', '754', '627', '651']) {
      if (cpt.startsWith(prefix) && SHORT_LABELS[prefix]) {
        return `${cpt} · ${SHORT_LABELS[prefix]}`;
      }
    }

    const full = Categorizer.obtenirLibelleCompte(cpt) || '';
    const shortText = full.length > 15 ? full.slice(0, 14).trim() + '…' : full;
    return shortText ? `${cpt} · ${shortText}` : cpt;
  }

  // Helper pour nettoyer les libellés bancaires bruts (SEPA, CB, virements) façon app fintech
  function formatCleanLibelle(raw) {
    if (!raw) return 'Opération bancaire';
    let s = String(raw).trim();

    // 1. Découpage pipe si présent
    if (s.includes('|')) {
      const parts = s.split('|').map(p => p.trim()).filter(Boolean);
      s = parts[0] || s;
    }

    // 2. Détection ciblée des marchands ou types d'opérations usuels
    const upper = s.toUpperCase();
    if (upper.includes('AMZN') || upper.includes('AMAZON')) {
      return 'Amazon';
    }
    if (upper.includes('LEROY MERLIN')) {
      const matchLM = s.match(/leroy\s+merlin(?:\s+([a-zA-ZÀ-ÿ-]+))?/i);
      if (matchLM && matchLM[1] && !/^(cb|du|fr|paiement|vourles)/i.test(matchLM[1])) {
        return `Leroy Merlin ${matchLM[1].charAt(0).toUpperCase() + matchLM[1].slice(1).toLowerCase()}`;
      }
      if (/vourles/i.test(s)) return 'Leroy Merlin Vourles';
      return 'Leroy Merlin';
    }
    if (/frais\s+(?:de\s+)?pr[eé]l[eè]vement/i.test(s)) {
      return 'Frais prélèvement SEPA';
    }
    if (/frais\s+tenue\s+de\s+compte/i.test(s)) {
      return 'Frais tenue de compte';
    }
    if (/frais\s+bancaire/i.test(s)) {
      return 'Frais bancaires';
    }
    if (/cotisation\s+(?:carte|bancaire)/i.test(s)) {
      return 'Cotisation bancaire';
    }

    // 3. Supprimer préfixes bancaires courants
    s = s.replace(/^(?:PRLV\s+SEPA|PRLV|PRELEVEMENT\s+SEPA|PRELEVEMENT\s+SDD|PRELEVEMENT|VIR\s+INST|VIR\s+SEPA|VIREMENT\s+SEPA|VIREMENT\s+INST|VIREMENT|PAIEMENT\s+PAR\s+CARTE\s+DU|PAIEMENT\s+PAR\s+CARTE|PAIEMENT\s+CB\s+DU|PAIEMENT\s+CB|ACHAT\s+CB|CB\s+DU|CB|CHEQUE\s+N°|CHEQUE)\s*[:-]?\s*/i, '');

    // 4. Supprimer les préfixes de civilité complexes (ex: M OU MME, M/MME, M ET MME, MLLE, MME, M., MR)
    s = s.replace(/^(?:M(?:R|\.)?\s*(?:OU|ET|\/)\s*MME\.?|MME\.?|MLLE\.?|MR?\.?)\s+/i, '');

    // 5. Règle clé des tirets : isoler l'entité propre (ex: Rose Trujillo - Virement... -> Rose Trujillo)
    if (/[-–—]/.test(s)) {
      const parts = s.split(/\s*[-–—]\s*/);
      if (parts.length >= 2) {
        const p0 = parts[0].trim();
        const p1 = parts[1].trim();
        // Si p1 est une méthode ou détail (Virement..., Prélèvement..., Vir..., etc.)
        if (/^(?:vir|prlv|virement|prelevement|cotis|adh|loyer|fact|ref|paiement|cb|sepa|achat|don)\b/i.test(p1) || p0.length >= 3) {
          s = p0;
        } else if (/^(?:vir|prlv|virement|prelevement)\b/i.test(p0) && p1.length >= 3) {
          s = p1;
        }
      }
    }

    // 6. Supprimer les chaînes techniques SEPA et résidus bancaires
    s = s.replace(/\s+(?:BILU|MKTP|PAYMENTS|EU|FR)\b.*$/i, '');
    s = s.replace(/\s+(?:VIR|VIREM|VIREMENT|PRLV|PRELEVEMENT)\b.*$/i, '');
    s = s.replace(/[-/]\s*\d{6,}[A-Z0-9_-]*/i, '');
    s = s.replace(/\s+\d+\s+EURO\s+[\d,.]+/i, '');
    s = s.replace(/\s+(TAUX|DEVISE|CHANGE).*$/i, '');
    s = s.replace(/\s+(REF|ID|EMETTEUR|MANDAT|ICS)\s*[:=]\s*[A-Z0-9]+/i, '');
    s = s.replace(/\s+\d{2}\/\d{2}(\/\d{2,4})?$/i, '');

    // Nettoyer les tirets et espaces orphelins
    s = s.replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim();

    if (!s) return raw;

    // 7. Découpage en mots avec traitement Title Case et mapping d'exceptions
    const words = s.split(/\s+/);
    const cleanedWords = words.map((w, idx) => {
      const bare = w.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (ACRONYMS_AND_WORDS[bare]) {
        return ACRONYMS_AND_WORDS[bare];
      }
      if (idx > 0 && ['de', 'du', 'des', 'le', 'la', 'les', 'et', 'en', 'au', 'aux', 'pour', 'sur', 'par', 'ou'].includes(bare)) {
        return bare;
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    });

    return cleanedWords.join(' ');
  }

  let sortedActiveTx = $derived(
    activeTx.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  );

  let showAllTransactions = $state(false);
  let txSearch = $state('');
  let currentPage = $state(1);
  const itemsPerPage = 50;

  let filteredTx = $derived(
    (() => {
      if (!txSearch.trim()) return sortedActiveTx;
      const q = txSearch.toLowerCase().trim();
      const qClean = q.replace(/€|\s/g, '').replace(',', '.');
      const qNum = parseFloat(qClean);
      const isNumericQuery = !isNaN(qNum) && qClean !== '' && !isNaN(Number(qClean));

      const matched = sortedActiveTx.filter(t => {
        // 1. Libellé, compte, nature
        const lib = (t.libelle || '').toLowerCase();
        const cat = t.compteAttribué ? Categorizer.obtenirLibelleCompte(t.compteAttribué).toLowerCase() : '';
        const compte = String(t.compteAttribué || '');
        const nom = (t.compteNom || '').toLowerCase();
        const clean = formatCleanLibelle(t.libelle).toLowerCase();

        const textMatch = lib.includes(q) || cat.includes(q) || compte.includes(q) || nom.includes(q) || clean.includes(q);

        // 2. Montants
        const debit = Number(t.debit) || 0;
        const credit = Number(t.credit) || 0;
        const net = credit > 0 ? credit : -debit;
        const abs = Math.abs(net);

        const absFixed = abs.toFixed(2);
        const absComma = absFixed.replace('.', ',');
        const absInt = String(Math.floor(abs));
        const netFixed = net.toFixed(2);
        const netComma = netFixed.replace('.', ',');
        const netInt = String(Math.floor(net));
        const currencyFr = net.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }).toLowerCase();

        const amountMatch =
          absFixed.includes(q) ||
          absComma.includes(q) ||
          absInt.includes(q) ||
          netFixed.includes(q) ||
          netComma.includes(q) ||
          netInt.includes(q) ||
          currencyFr.includes(q) ||
          (isNumericQuery && (Math.abs(abs - Math.abs(qNum)) < 0.001 || Math.abs(net - qNum) < 0.001));

        return textMatch || amountMatch;
      });

      // Si recherche numérique (ex: "150"), prioriser les montants exacts en tête de liste
      if (isNumericQuery) {
        return matched.slice().sort((a, b) => {
          const aNet = (Number(a.credit) || 0) > 0 ? Number(a.credit) : -Number(a.debit);
          const bNet = (Number(b.credit) || 0) > 0 ? Number(b.credit) : -Number(b.debit);
          const aAbs = Math.abs(aNet);
          const bAbs = Math.abs(bNet);

          const aExact = Math.abs(aAbs - Math.abs(qNum)) < 0.001 || Math.abs(aNet - qNum) < 0.001;
          const bExact = Math.abs(bAbs - Math.abs(qNum)) < 0.001 || Math.abs(bNet - qNum) < 0.001;

          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
      }

      return matched;
    })()
  );

  let totalPages = $derived(Math.max(1, Math.ceil(filteredTx.length / itemsPerPage)));

  let displayedTx = $derived(
    showAllTransactions
      ? filteredTx.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
      : sortedActiveTx.slice(0, 8)
  );

  let showInitialBalanceModal = $state(false);
  let tempInitialBalance = $state('');

  function openInitialBalanceModal() {
    tempInitialBalance = $initialBankBalance ? String($initialBankBalance) : '';
    showInitialBalanceModal = true;
  }

  function saveInitialBalance() {
    const val = parseFloat(tempInitialBalance.replace(/\s/g, '').replace(',', '.')) || 0;
    updateInitialBankBalance(val);
    showInitialBalanceModal = false;
    showToast(`Solde initial de trésorerie défini à ${formatCurrency(val)}`);
  }

  function toggleShowAll() {
    showAllTransactions = !showAllTransactions;
    currentPage = 1;
    txSearch = '';
  }
</script>

<div class="dashboard-asso-page">
  <!-- PAGE HEADER -->
  <PageHeader 
    title="Trésorerie Associative" 
    mobileTitle="Trésorerie"
    subtitle="Suivi des adhésions, cotisations et trésorerie disponible." 
  >
    <button 
      type="button" 
      onclick={() => openHelpGuide('accueil')}
      title="Guide d'utilisation pour l'accueil"
      aria-label="Guide d'utilisation pour l'accueil"
      class="page-help-btn"
    >
      <i class="fa-solid fa-question"></i>
    </button>
  </PageHeader>

  <!-- 1. INDICATEURS CLÉS (SANS REDITE DU NOM DE STRUCTURE) -->
  <section class="dashboard-section section-kpis">
    <div class="asso-section-box kpis-box" style="background: var(--bg-container, #f8fafc); border: 1.5px solid var(--border-container, #e2e8f0); border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
      <div class="kpi-header-row" style="display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 6px 12px; margin-bottom: 14px;">
        <h3 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: var(--text-main, #0f172a); margin: 0;">
          Indicateurs
        </h3>
        <span class="kpi-header-subtitle" style="font-size: 0.8rem; color: #64748b; font-weight: 600;">
          Trésorerie et cotisations en direct
        </span>
      </div>

      <div class="kpi-grid">
        <!-- Chiffre Roi (Trésorerie Disponible) en pleine largeur -->
        <div class="kpi-item-roi">
          <KpiCard 
            label="Trésorerie Disponible" 
            mobileLabel="Trésorerie Disponible"
            value={formatCurrency(totalBanque)} 
            subtext={Number($initialBankBalance) > 0 ? `Solde réel (dont ${formatCurrency($initialBankBalance)} au départ)` : 'Solde de départ non configuré (0,00 €)'}
            actionLabel={$initialBankBalance !== 0 ? "Modifier départ" : "Définir solde initial"}
            onAction={openInitialBalanceModal}
          />
        </div>

        <!-- Grille 2x2 avec libellés courts -->
        <div class="kpi-item-cell">
          <KpiCard 
            label={resultatNet >= 0 ? "Excédent de l'exercice" : "Déficit de l'exercice"} 
            mobileLabel={resultatNet >= 0 ? "Excédent" : "Déficit"}
            value={formatCurrency(resultatNet, true)} 
            subtext="Recettes − Dépenses"
            textColor={resultatNet >= 0 ? '#16a34a' : '#dc2626'}
            infoTip="Différence exacte entre vos recettes réelles et vos dépenses de l'exercice."
          />
        </div>

        <div class="kpi-item-cell">
          <KpiCard 
            label="Dépenses & Charges" 
            mobileLabel="Dépenses"
            value={formatCurrency(totalCharges)} 
            subtext="Achats, frais, prestations"
            infoTip="Ensemble des charges et dépenses de fonctionnement décaissées sur l'exercice."
          />
        </div>

        <div class="kpi-item-cell">
          <KpiCard 
            label="Cotisations & Cours Encaissés" 
            mobileLabel="Cotisations"
            value={formatCurrency(cotisationsEncaissées)} 
            subtext="Recettes 756 & 706"
            infoTip="Total des adhésions, cotisations et règlements de cours perçus sur les comptes 756 et 706."
          />
        </div>

        <div class="kpi-item-cell">
          <KpiCard 
            label="Adhésions à recouvrer" 
            mobileLabel="À recouvrer"
            value={formatCurrency(resteAEncaisser)} 
            subtext={retardsCount > 0 ? `${retardsCount} en retard` : 'Aucune en attente'}
            infoTip="Montant total restant dû par les adhérents sur la saison en cours."
          />
        </div>

        <!-- 6. Dons & Mécénat (masqué si 0€ sur mobile, sinon pleine largeur en bas) -->
        <div class="kpi-item-dons {donsEncaissés === 0 ? 'hide-on-mobile-zero' : ''}">
          <KpiCard 
            label="Dons & Mécénat (754)" 
            mobileLabel="Dons & Mécénat"
            value={formatCurrency(donsEncaissés)} 
            subtext="Dons manuels et mécénat"
            infoTip="Recettes issues de la générosité du public, dons déductibles (CERFA) et mécénat associatif (compte 754)."
          />
        </div>
      </div>
    </div>
  </section>

  <!-- 2. BLOC GÉNÉRAL TÂCHES À EFFECTUER (SANS ICÔNES) -->
  <section class="dashboard-section section-tasks">
    <div class="asso-section-box asso-tasks-box" style="background: var(--bg-container, #f8fafc); border: 1.5px solid var(--border-container, #e2e8f0); border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <h3 style="font-family: var(--font-title); font-size: 1.02rem; font-weight: 800; color: var(--text-main, #0f172a); margin: 0; display: flex; align-items: center; gap: 8px;">
          <span>Tâches à effectuer</span>
          <InfoTip text="Indique le nombre d'opérations bancaires récemment importées qui attendent votre attribution." width="230px" />
        </h3>
        <span style="background: {pendingTxCount > 0 || retardsCount > 0 ? '#ef4444' : '#10b981'}; color: #ffffff; font-size: 0.74rem; font-weight: 800; padding: 2px 8px; border-radius: 9999px;">
          {totalTasksCount}
        </span>
      </div>

      <div class="asso-tasks-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 12px;">
        <!-- Tâche 1: Attribution -->
        <div class="task-card" style="padding: 16px 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px; background: var(--bg-card, #ffffff); box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);">
          <div>
            <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-main, #0f172a);">
              {pendingTxCount > 0 ? `Vous devez attribuer ${pendingTxCount} opération${pendingTxCount > 1 ? 's' : ''}` : "Vous n'avez aucune attribution en attente"}
            </div>
            <div style="font-size: 0.78rem; color: #64748b; line-height: 1.35; margin-top: 2px;">
              {pendingTxCount > 0 ? 'Affectez chaque mouvement au plan associatif pour actualiser la trésorerie et préparer les rapports.' : 'Toutes vos opérations sont classées et votre comptabilité est à jour.'}
            </div>
          </div>
          <button 
            type="button" 
            class="btn btn-sm" 
            onclick={() => activeView.set('categorize')}
            style="background: #0f172a; color: #ffffff; border: none; padding: 7px 16px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer; flex-shrink: 0;"
          >
            {pendingTxCount > 0 ? 'Attribuer' : 'Consulter'}
          </button>
        </div>

        <!-- Tâche 2: Cotisations / Adhésions en retard -->
        {#if retardsCount > 0}
          <div class="task-card" style="padding: 16px 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px; background: var(--bg-card, #ffffff); box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);">
            <div>
              <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-main, #0f172a);">
                Vous devez régulariser {retardsCount} adhésion{retardsCount > 1 ? 's' : ''} en attente
              </div>
              <div style="font-size: 0.78rem; color: #64748b; line-height: 1.35; margin-top: 2px;">
                Un solde de {formatCurrency(resteAEncaisser)} reste à recouvrer pour l'exercice.
              </div>
            </div>
            <button 
              type="button" 
              class="btn btn-sm" 
              onclick={() => activeView.set('activity')}
              style="background: #0f172a; color: #ffffff; border: none; padding: 7px 16px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer; flex-shrink: 0;"
            >
              Gérer les recettes
            </button>
          </div>
        {/if}
      </div>
    </div>
  </section>

  <!-- 3. DERNIERS MOUVEMENTS DE TRÉSORERIE (SANS ICÔNE DANS LE TITRE) -->
  <section class="dashboard-section section-tx">
    <div class="asso-section-box asso-tx-box" style="background: var(--bg-container, #f8fafc); border: 1.5px solid var(--border-container, #e2e8f0); border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); padding: 20px;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
      <div>
        <h2 style="font-family: var(--font-title); font-size: 1.12rem; font-weight: 800; color: var(--text-main, #0f172a); margin: 0;">
          {#if showAllTransactions}
            Mouvements de trésorerie ({txSearch.trim() ? `${filteredTx.length} résultat${filteredTx.length > 1 ? 's' : ''}` : `${activeTx.length} opérations`})
          {:else}
            Derniers mouvements de trésorerie
          {/if}
        </h2>
        <span class="tx-section-subtitle" style="font-size: 0.8rem; color: #64748b; font-weight: 600; margin-top: 2px; display: block;">
          {#if showAllTransactions}
            {txSearch.trim() ? `Recherche parmi les ${activeTx.length} opérations de l'association` : 'Historique complet des opérations bancaires et comptables'}
          {:else}
            Encaissements d'adhésions, dons et règlements de l'association
          {/if}
        </span>
      </div>

      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
        {#if showAllTransactions}
          <!-- Champ de recherche en direct -->
          <div style="position: relative; display: flex; align-items: center;">
            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 10px; color: #94a3b8; font-size: 0.78rem; pointer-events: none;"></i>
            <input 
              type="text" 
              placeholder="Libellé, compte, montant..." 
              bind:value={txSearch} 
              oninput={() => currentPage = 1}
              style="padding: 6px 12px 6px 30px; font-size: 0.82rem; border: 1.5px solid #cbd5e1; border-radius: 8px; width: 230px; background: #ffffff;"
            />
          </div>
        {/if}

        <button 
          type="button"
          class="btn btn-sm" 
          onclick={toggleShowAll} 
          style="background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; border-radius: 6px; padding: 6px 14px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s ease;"
          onmouseenter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
          onmouseleave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
        >
          {#if showAllTransactions}
            <i class="fa-solid fa-chevron-up"></i>
            Réduire l'affichage (8 dernières)
          {:else}
            Voir toutes les opérations ({activeTx.length})
            <i class="fa-solid fa-chevron-down"></i>
          {/if}
        </button>
      </div>
    </div>

    <!-- Table conteneur épuré adapté au thème sombre/clair (Desktop >= 768px) -->
    <div class="table-container desktop-tx-table" style="border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px; overflow-x: auto; -webkit-overflow-scrolling: touch; background: var(--bg-card, #ffffff); box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05));">
      <table class="custom-table" style="width: 100%; min-width: 580px; border-collapse: collapse;">
        <thead>
          <tr style="background: var(--bg-subtle, #f8fafc); border-bottom: 1.5px solid var(--border-color, #e2e8f0);">
            <th style="padding: 12px 14px; font-weight: 700; font-size: 0.78rem; color: var(--text-muted, #64748b); text-transform: uppercase;">Date</th>
            <th style="padding: 12px 14px; font-weight: 700; font-size: 0.78rem; color: var(--text-muted, #64748b); text-transform: uppercase;">Libellé Opération</th>
            <th style="padding: 12px 14px; font-weight: 700; font-size: 0.78rem; color: var(--text-muted, #64748b); text-transform: uppercase;">
              <span>Attribution / Nature</span>
              <InfoTip text="Compte officiel dans lequel chaque opération est classée pour vos registres légaux." width="230px" position="bottom" />
            </th>
            <th style="text-align: right; padding: 12px 14px; font-weight: 700; font-size: 0.78rem; color: var(--text-muted, #64748b); text-transform: uppercase;">Montant</th>
          </tr>
        </thead>
        <tbody>
          {#if displayedTx.length === 0}
            <tr>
              <td colspan="4" style="text-align: center; padding: 32px; color: var(--text-muted, #64748b); font-size: 0.88rem;">
                Aucune opération ne correspond à votre recherche.
              </td>
            </tr>
          {:else}
            {#each displayedTx as tx}
              {@const isAttributed = tx.compteAttribué && tx.compteAttribué !== '699'}
              <tr style="border-bottom: 1px solid var(--border-color, #e2e8f0); background: transparent;">
                <td style="color: var(--text-muted); white-space: nowrap; padding: 12px 14px; font-weight: 600; font-size: 0.86rem;">
                  {formatDateFr(tx.date)}
                </td>
                <td style="padding: 12px 14px; max-width: 440px;">
                  <div style="font-weight: 700; color: var(--text-main); font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title={tx.libelle}>
                    {formatCleanLibelle(tx.libelle)}
                  </div>
                  {#if tx.libelle && tx.libelle !== formatCleanLibelle(tx.libelle)}
                    <div style="font-size: 0.74rem; color: var(--text-muted, #64748b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;" title={tx.libelle}>
                      {tx.libelle}
                    </div>
                  {/if}
                </td>
                <td style="padding: 12px 14px;">
                  {#if isAttributed}
                    <span style="display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 9999px; font-size: 0.74rem; font-weight: 700; background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35);">
                      {Categorizer.obtenirLibelleCompte(tx.compteAttribué)} ({tx.compteAttribué})
                    </span>
                  {:else}
                    <span style="display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 9999px; font-size: 0.74rem; font-weight: 700; background: rgba(245, 158, 11, 0.12); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35);">
                      Non attribué
                    </span>
                  {/if}
                </td>
                <td style="text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; padding: 12px 14px; font-size: 0.92rem; color: {tx.credit > 0 ? '#34d399' : '#f87171'};">
                  {formatCurrency(tx.credit > 0 ? tx.credit : -tx.debit, true)}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Vue Liste unifiée fintech (Mobile < 768px) -->
    <div class="mobile-tx-cards">
      {#if displayedTx.length === 0}
        <div style="text-align: center; padding: 28px 14px; color: var(--text-muted); font-size: 0.88rem; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color);">
          Aucune opération ne correspond à votre recherche.
        </div>
      {:else}
        <div class="mobile-tx-list">
          {#each displayedTx as tx}
            {@const isAttributed = tx.compteAttribué && tx.compteAttribué !== '699'}
            {@const isCredit = tx.credit > 0}
            <div class="mobile-tx-item" title={tx.libelle}>
              <!-- Pastille circulaire directionnelle 32x32px fintech -->
              <div 
                class="mobile-tx-icon-pill" 
                style="background: {isCredit ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.10)'}; color: {isCredit ? '#10b981' : '#ef4444'};"
                aria-hidden="true"
              >
                {#if isCredit}
                  <!-- Entrée : Flèche diagonale bas-gauche -->
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="17" y1="7" x2="7" y2="17"></line>
                    <polyline points="17 17 7 17 7 7"></polyline>
                  </svg>
                {:else}
                  <!-- Sortie : Flèche diagonale haut-droite -->
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="7" y1="17" x2="17" y2="7"></line>
                    <polyline points="7 7 17 7 17 17"></polyline>
                  </svg>
                {/if}
              </div>

              <!-- Contenu textuel sur 2 lignes -->
              <div class="mobile-tx-content">
                <!-- Ligne 1 : Nom nettoyé + Montant -->
                <div class="mobile-tx-row-top">
                  <span class="mobile-tx-name" title={tx.libelle}>
                    {formatCleanLibelle(tx.libelle)}
                  </span>
                  <span 
                    class="mobile-tx-amount" 
                    style="color: {isCredit ? 'var(--color-success, #34d399)' : 'var(--color-danger, #f87171)'};"
                  >
                    {formatCurrency(isCredit ? tx.credit : -tx.debit, true)}
                  </span>
                </div>

                <!-- Ligne 2 : Date + Badge de compte court (code devant) -->
                <div class="mobile-tx-row-bottom">
                  <span class="mobile-tx-date">
                    {formatDateFr(tx.date)}
                  </span>
                  {#if isAttributed}
                    <span class="mobile-tx-badge attributed">
                      {formatMobileAccountBadge(tx.compteAttribué)}
                    </span>
                  {:else}
                    <span class="mobile-tx-badge unassigned">
                      Non attribué
                    </span>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    {#if showAllTransactions && totalPages > 1}
      <!-- Pagination sous le tableau -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0; flex-wrap: wrap; gap: 10px;">
        <span style="font-size: 0.82rem; color: #64748b; font-weight: 600;">
          Page {currentPage} sur {totalPages} · {filteredTx.length} opération{filteredTx.length > 1 ? 's' : ''}
        </span>
        <div style="display: flex; gap: 8px;">
          <button 
            type="button" 
            onclick={() => currentPage = Math.max(1, currentPage - 1)} 
            disabled={currentPage === 1}
            style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; color: {currentPage === 1 ? '#94a3b8' : '#0f172a'}; cursor: {currentPage === 1 ? 'not-allowed' : 'pointer'};"
          >
            Précédent
          </button>
          <button 
            type="button" 
            onclick={() => currentPage = Math.min(totalPages, currentPage + 1)} 
            disabled={currentPage === totalPages}
            style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; color: {currentPage === totalPages ? '#94a3b8' : '#0f172a'}; cursor: {currentPage === totalPages ? 'not-allowed' : 'pointer'};"
          >
            Suivant
          </button>
        </div>
      </div>
    {/if}
  </div>
</section>
</div>

{#if showInitialBalanceModal}
  <div 
    class="modal-backdrop" 
    onclick={() => showInitialBalanceModal = false} 
    role="presentation" 
    style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 100000; padding: 20px;"
  >
    <div 
      onclick={(e) => e.stopPropagation()} 
      onkeydown={(e) => { if (e.key === 'Escape') showInitialBalanceModal = false; }}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      style="background: #ffffff; border-radius: 16px; width: 100%; max-width: 480px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); border: 1px solid #cbd5e1; overflow: hidden; animation: popIn 0.2s ease-out;"
    >
      <div style="padding: 22px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-start; background: #f8fafc;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <i class="fa-solid fa-vault" style="color: #2563eb; font-size: 1.1rem;"></i>
            <h3 style="margin: 0; font-size: 1.12rem; font-weight: 800; color: #0f172a; font-family: var(--font-title);">
              Solde initial de trésorerie
            </h3>
          </div>
          <p style="margin: 0; font-size: 0.82rem; color: #64748b; line-height: 1.4;">
            Solde en compte bancaire au 1er jour de votre exercice comptable (à-nouveaux du compte 512).
          </p>
        </div>
        <button 
          type="button" 
          onclick={() => showInitialBalanceModal = false}
          style="background: transparent; border: none; font-size: 1.1rem; color: #94a3b8; cursor: pointer; padding: 4px 8px; border-radius: 6px; line-height: 1;"
          aria-label="Fermer"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div style="padding: 24px;">
        <label for="initial-balance-input" style="display: block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 8px;">
          Montant disponible au départ de l'exercice (€)
        </label>
        <div style="position: relative; margin-bottom: 14px;">
          <input 
            id="initial-balance-input"
            type="text" 
            bind:value={tempInitialBalance}
            onkeydown={(e) => { if (e.key === 'Enter') saveInitialBalance(); }}
            placeholder="Ex : 40000 ou 39775,50"
            style="width: 100%; padding: 12px 42px 12px 14px; font-size: 1.05rem; font-weight: 700; border: 1.5px solid #cbd5e1; border-radius: 10px; color: #0f172a; background: #ffffff; box-sizing: border-box;"
          />
          <span style="position: absolute; right: 14px; top: 50%; transform: translateY(-50%); font-weight: 800; color: #64748b; font-size: 1.05rem;">
            €
          </span>
        </div>

        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 12px 14px; font-size: 0.82rem; color: #0369a1; line-height: 1.45;">
          <div style="font-weight: 700; margin-bottom: 3px; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-circle-info"></i> Information comptable universelle
          </div>
          Les relevés bancaires importés (CSV) n'enregistrent que les flux de la période. Renseigner votre solde de départ permet au logiciel de calculer votre trésorerie réelle exacte à tout instant.
        </div>
      </div>

      <div style="padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px;">
        <button 
          type="button" 
          onclick={() => showInitialBalanceModal = false}
          style="padding: 9px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #ffffff; color: #475569; font-size: 0.85rem; font-weight: 700; cursor: pointer;"
        >
          Annuler
        </button>
        <button 
          type="button" 
          onclick={saveInitialBalance}
          style="padding: 9px 18px; border-radius: 8px; border: none; background: #2563eb; color: #ffffff; font-size: 0.85rem; font-weight: 700; cursor: pointer; box-shadow: 0 2px 4px rgba(37,99,235,0.25);"
        >
          Enregistrer le solde
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dashboard-asso-page {
    padding: 20px 24px;
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
  }

  .dashboard-section {
    margin-bottom: 28px;
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
    gap: 14px;
  }

  .desktop-tx-table {
    display: block;
  }

  .mobile-tx-cards {
    display: none;
  }

  @media (max-width: 768px) {
    .dashboard-asso-page {
      padding: 0 2px !important;
    }

    /* 1. Espacement généreux entre les 3 grandes sections : 34px de pause visuelle */
    .dashboard-section {
      margin-bottom: 34px !important;
    }

    /* 2. Suppression de la boîte englobante des indicateurs sur mobile */
    .asso-section-box.kpis-box {
      padding: 0 !important;
      border-radius: 0 !important;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      margin-bottom: 0 !important;
    }

    .asso-section-box.asso-tx-box {
      padding: 0 !important;
      border-radius: 0 !important;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      margin-bottom: 0 !important;
    }

    .asso-tasks-box {
      padding: 18px 20px !important;
      border-radius: 14px !important;
      border: 1px solid var(--border-color, #e2e8f0) !important;
      background: var(--bg-card, #ffffff) !important;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
    }

    /* Évite la surcharge des sous-titres sur mobile pour faire remonter les KPI */
    .kpi-header-row,
    .tx-section-subtitle {
      display: none !important;
    }

    /* 3. Grille KPIs 2x2 sur mobile avec Chiffre Roi en pleine largeur */
    .kpi-grid {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 12px !important;
    }

    .kpi-item-roi {
      grid-column: 1 / -1 !important;
    }

    .kpi-item-cell {
      min-width: 0 !important;
    }

    .kpi-item-dons.hide-on-mobile-zero {
      display: none !important;
    }

    .kpi-item-dons {
      grid-column: 1 / -1 !important;
    }

    .asso-tasks-grid {
      grid-template-columns: 1fr !important;
      gap: 12px !important;
    }

    .task-card {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 12px !important;
    }

    .task-card button {
      width: 100% !important;
      text-align: center !important;
      justify-content: center !important;
    }

    /* Bascule Tableau -> Liste Fintech unifiée sur mobile */
    .desktop-tx-table {
      display: none !important;
    }

    .mobile-tx-cards {
      display: block !important;
    }

    .mobile-tx-list {
      display: flex;
      flex-direction: column;
      background: var(--bg-card, #ffffff);
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
    }

    .mobile-tx-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--border-color, rgba(226, 232, 240, 0.6));
      background: transparent;
      transition: background 0.12s ease;
      -webkit-tap-highlight-color: transparent;
    }

    .mobile-tx-item:last-child {
      border-bottom: none;
    }

    .mobile-tx-item:active {
      background: var(--bg-subtle, rgba(0, 0, 0, 0.04));
    }

    .mobile-tx-icon-pill {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .mobile-tx-content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    /* 4. Alignement strict sans retour à la ligne du montant */
    .mobile-tx-row-top {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 10px;
      width: 100%;
      min-width: 0;
      flex-wrap: nowrap !important;
    }

    .mobile-tx-name {
      font-weight: 700;
      font-size: 0.88rem;
      color: var(--text-main, #0f172a);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap !important;
      flex: 1;
      min-width: 0;
    }

    .mobile-tx-amount {
      font-weight: 800;
      font-size: 0.92rem;
      white-space: nowrap !important;
      font-variant-numeric: tabular-nums;
      flex-shrink: 0 !important;
      font-family: var(--font-title, sans-serif);
      margin-left: auto;
      text-align: right;
    }

    .mobile-tx-row-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .mobile-tx-date {
      font-size: 0.74rem;
      color: var(--text-muted, #64748b);
      font-weight: 500;
      flex-shrink: 0;
    }

    .mobile-tx-badge {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.3;
      flex-shrink: 0;
    }

    .mobile-tx-badge.attributed {
      background: rgba(56, 189, 248, 0.12);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.3);
    }

    .mobile-tx-badge.unassigned {
      background: rgba(245, 158, 11, 0.12);
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
  }
</style>



