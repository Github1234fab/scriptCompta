<script>
  import { 
    transactions, 
    planComptable, 
    activeEntityId, 
    entities, 
    updateEntities, 
    activeView, 
    showToast,
    formatDateFr,
    openHelpGuide
  } from '../lib/store.js';
  import { get } from 'svelte/store';
  import PageHeader from './PageHeader.svelte';
  import KpiCard from './KpiCard.svelte';

  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0] || { name: 'Ma Structure', model: 'micro' });

  /** @type {Record<string, { label: string, shortLabel: string, rate: number, plafondCA: number, franchiseTVA: number, franchiseTVAMajoree: number }>} */
  const REGIMES_URSSAF = {
    services_bic: {
      label: 'Prestations de services commerciales ou artisanales (BIC)',
      shortLabel: 'Prestations BIC',
      rate: 0.212,
      plafondCA: 77700,
      franchiseTVA: 37500,
      franchiseTVAMajoree: 41250
    },
    services_bnc: {
      label: 'Professions libérales non réglementées (BNC)',
      shortLabel: 'Libéral BNC',
      rate: 0.258,
      plafondCA: 77700,
      franchiseTVA: 37500,
      franchiseTVAMajoree: 41250
    },
    vente_bic: {
      label: 'Achat / Revente de marchandises & hébergement (BIC)',
      shortLabel: 'Vente BIC',
      rate: 0.123,
      plafondCA: 188700,
      franchiseTVA: 85000,
      franchiseTVAMajoree: 93500
    }
  };

  let selectedRegimeKey = $derived(activeEntity?.microActivity || 'services_bic');
  let selectedRegime = $derived(REGIMES_URSSAF[selectedRegimeKey] || REGIMES_URSSAF.services_bic);
  let activeRate = $derived(selectedRegime.rate);

  /** @param {string} newKey */
  function changeRegime(newKey) {
    const currentList = get(entities);
    const updated = currentList.map(e => e.id === activeEntity.id ? { ...e, microActivity: newKey } : e);
    updateEntities(updated);
    showToast(`Régime mis à jour : ${REGIMES_URSSAF[newKey]?.label}`);
  }

  let activeTx = $derived($transactions.filter((/** @type {any} */ tx) => !tx.entityId || tx.entityId === $activeEntityId));

  // Recettes encaissées (comptabilité d'encaissement pure)
  let caEncaissé = $derived(activeTx.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue') {
      const cpt = $planComptable.find((/** @type {any} */ p) => p.compte === tx.compteAttribué);
      if (cpt && cpt.type === 'Produit') return sum + tx.credit;
    }
    return sum;
  }, 0));

  // Charges réelles décaissées
  let depensesReelles = $derived(activeTx.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue') {
      const cpt = $planComptable.find((/** @type {any} */ p) => p.compte === tx.compteAttribué);
      if (cpt && cpt.type === 'Charge') return sum + tx.debit;
    }
    return sum;
  }, 0));

  // Trésorerie, Urssaf et Reste Net Final
  let soldeTresorerie = $derived(caEncaissé - depensesReelles);
  let urssafEstimee = $derived(caEncaissé * activeRate);
  let resteNetEnPoche = $derived(caEncaissé - urssafEstimee - depensesReelles);
  let margePct = $derived(caEncaissé > 0 ? Math.round((resteNetEnPoche / caEncaissé) * 100) : 0);


  // Seuils & Compteurs circulaires (Franchise TVA & Statut Micro)
  let tvaProgressionPct = $derived(Math.min(100, Math.round((caEncaissé / selectedRegime.franchiseTVA) * 100)));
  let plafondProgressionPct = $derived(Math.min(100, Math.round((caEncaissé / selectedRegime.plafondCA) * 100)));

  let tvaColor = $derived(
    tvaProgressionPct >= 100 ? '#ef4444' : (tvaProgressionPct >= 85 ? '#f59e0b' : '#10b981')
  );
  let plafondColor = $derived(
    plafondProgressionPct >= 100 ? '#ef4444' : (plafondProgressionPct >= 85 ? '#f59e0b' : '#2563eb')
  );

  // Calcul des tâches à faire : seules les vraies actions opérationnelles sont conservées
  let pendingTxCount = $derived(activeTx.filter(t => t.compteAttribué === '699' || t.statut === 'non_attribue' || t.statut === 'suggere' || t.statut === 'a_attribuer').length);

  // Helper pour nettoyer les libellés bancaires bruts façon app fintech
  /** @param {string} [raw] */
  function formatCleanLibelle(raw) {
    if (!raw) return 'Opération bancaire';
    let s = String(raw).trim();
    if (s.includes('|')) s = s.split('|')[0].trim();

    const upper = s.toUpperCase();
    if (upper.includes('AMZN') || upper.includes('AMAZON')) return 'Amazon';
    if (upper.includes('LEROY MERLIN')) {
      if (/vourles/i.test(s)) return 'Leroy Merlin Vourles';
      return 'Leroy Merlin';
    }
    if (/frais\s+(?:de\s+)?pr[eé]l[eè]vement/i.test(s)) return 'Frais prélèvement SEPA';
    if (/frais\s+tenue\s+de\s+compte/i.test(s)) return 'Frais tenue de compte';
    if (/frais\s+bancaire/i.test(s)) return 'Frais bancaires';
    if (/cotisation\s+(?:carte|bancaire)/i.test(s)) return 'Cotisation bancaire';

    s = s.replace(/^(?:PRLV\s+SEPA|PRLV|PRELEVEMENT\s+SEPA|PRELEVEMENT\s+SDD|PRELEVEMENT|VIR\s+INST|VIR\s+SEPA|VIREMENT\s+SEPA|VIREMENT\s+INST|VIREMENT|PAIEMENT\s+PAR\s+CARTE\s+DU|PAIEMENT\s+PAR\s+CARTE|PAIEMENT\s+CB\s+DU|PAIEMENT\s+CB|ACHAT\s+CB|CB\s+DU|CB|CHEQUE\s+N°|CHEQUE)\s*[:-]?\s*/i, '');
    s = s.replace(/^(?:M(?:R|\.)?\s*(?:OU|ET|\/)\s*MME\.?|MME\.?|MLLE\.?|MR?\.?)\s+/i, '');

    if (/[-–—]/.test(s)) {
      const parts = s.split(/\s*[-–—]\s*/);
      if (parts.length >= 2) {
        const p0 = parts[0].trim();
        const p1 = parts[1].trim();
        if (/^(?:vir|prlv|virement|prelevement|loyer|fact|ref|paiement|cb|sepa|achat|cotis)\b/i.test(p1) || p0.length >= 3) {
          s = p0;
        } else if (/^(?:vir|prlv|virement|prelevement)\b/i.test(p0) && p1.length >= 3) {
          s = p1;
        }
      }
    }

    s = s.replace(/\s+(?:BILU|MKTP|PAYMENTS|EU|FR)\b.*$/i, '');
    s = s.replace(/\s+(?:VIR|VIREM|VIREMENT|PRLV|PRELEVEMENT)\b.*$/i, '');
    s = s.replace(/[-/]\s*\d{6,}[A-Z0-9_-]*/i, '');
    s = s.replace(/\s+\d+\s+EURO\s+[\d,.]+/i, '');
    s = s.replace(/\s+(TAUX|DEVISE|CHANGE).*$/i, '');
    s = s.replace(/\s+(REF|ID|EMETTEUR|MANDAT|ICS)\s*[:=]\s*[A-Z0-9]+/i, '');
    s = s.replace(/\s+\d{2}\/\d{2}(\/\d{2,4})?$/i, '');
    s = s.replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim();

    return s || raw;
  }

  let sortedActiveTx = $derived(
    activeTx.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  );

  let showAllTransactions = $state(false);
  let txSearch = $state('');
  let currentPage = $state(1);
  const itemsPerPage = 50;

  /** @param {string} [compte] */
  function getAccountLabel(compte) {
    if (!compte || compte === '699') return 'Non attribué';
    const found = $planComptable.find((/** @type {any} */ p) => p.compte === String(compte));
    return found ? `${found.libelle} (${compte})` : `Compte (${compte})`;
  }

  let filteredTx = $derived((() => {
    if (!txSearch.trim()) return sortedActiveTx;
    const q = txSearch.toLowerCase().trim();
    return sortedActiveTx.filter((t) => {
      const lib = (t.libelle || '').toLowerCase();
      const cpt = String(t.compteAttribué || '');
      const nom = getAccountLabel(cpt).toLowerCase();
      const amt = String(t.credit > 0 ? t.credit : -t.debit);
      return lib.includes(q) || cpt.includes(q) || nom.includes(q) || amt.includes(q);
    });
  })());

  let totalPages = $derived(Math.max(1, Math.ceil(filteredTx.length / itemsPerPage)));

  let displayedTx = $derived(
    showAllTransactions
      ? filteredTx.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
      : sortedActiveTx.slice(0, 8)
  );

  function toggleShowAll() {
    showAllTransactions = !showAllTransactions;
    currentPage = 1;
    txSearch = '';
  }
</script>

<div class="dashboard-micro-page" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 24px;">
  <!-- PAGE HEADER AVEC COMPTEURS CIRCULAIRES INTÉGRÉS -->
  <PageHeader 
    structureName={activeEntity.name}
    title="Micro-Entreprise" 
    mobileTitle="Trésorerie"
    subtitle="Suivi du CA encaissé, cotisations Urssaf et seuils légaux." 
  >
    <!-- Double compteur type tableau de bord (Franchise TVA & Statut Micro) -->
    <div style="display: flex; align-items: center; gap: 14px; background: #ffffff; padding: 6px 14px; border-radius: 14px; border: 1.5px solid #e2e8f0; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);">
      
      <!-- Compteur 1 : Franchise de TVA -->
      <div 
        style="display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: default;" 
        title="Franchise en base de TVA : {caEncaissé.toLocaleString('fr-FR')} € / {selectedRegime.franchiseTVA.toLocaleString('fr-FR')} € ({tvaProgressionPct}%)"
      >
        <div style="position: relative; width: 62px; height: 62px;">
          <svg width="62" height="62" viewBox="0 0 62 62" style="display: block;">
            <circle cx="31" cy="31" r="25" fill="none" stroke="#f1f5f9" stroke-width="4" />
            <circle 
              cx="31" cy="31" r="25" 
              fill="none" 
              stroke={tvaColor} 
              stroke-width="4" 
              stroke-linecap="round"
              stroke-dasharray="157.08"
              stroke-dashoffset={157.08 - (157.08 * tvaProgressionPct) / 100}
              transform="rotate(-90 31 31)"
              style="transition: stroke-dashoffset 0.5s ease, stroke 0.3s ease;"
            />
          </svg>
          <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none;">
            <span style="font-size: 0.50rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.02em; line-height: 1;">TVA</span>
            <span style="font-size: 0.74rem; font-weight: 800; color: #0f172a; line-height: 1.1; margin-top: 2px;">{tvaProgressionPct}%</span>
          </div>
        </div>
        <span style="font-size: 0.65rem; color: #64748b; font-weight: 600; white-space: nowrap;">
          Max {(selectedRegime.franchiseTVA / 1000).toLocaleString('fr-FR')} k€
        </span>
      </div>

      <!-- Séparateur discret -->
      <div style="width: 1px; height: 42px; background: #e2e8f0;"></div>

      <!-- Compteur 2 : Plafond statut Micro -->
      <div 
        style="display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: default;" 
        title="Plafond du régime micro : {caEncaissé.toLocaleString('fr-FR')} € / {selectedRegime.plafondCA.toLocaleString('fr-FR')} € ({plafondProgressionPct}%) - Marge : {Math.max(0, selectedRegime.plafondCA - caEncaissé).toLocaleString('fr-FR')} €"
      >
        <div style="position: relative; width: 62px; height: 62px;">
          <svg width="62" height="62" viewBox="0 0 62 62" style="display: block;">
            <circle cx="31" cy="31" r="25" fill="none" stroke="#f1f5f9" stroke-width="4" />
            <circle 
              cx="31" cy="31" r="25" 
              fill="none" 
              stroke={plafondColor} 
              stroke-width="4" 
              stroke-linecap="round"
              stroke-dasharray="157.08"
              stroke-dashoffset={157.08 - (157.08 * plafondProgressionPct) / 100}
              transform="rotate(-90 31 31)"
              style="transition: stroke-dashoffset 0.5s ease, stroke 0.3s ease;"
            />
          </svg>
          <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none;">
            <span style="font-size: 0.48rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.02em; line-height: 1;">STATUT</span>
            <span style="font-size: 0.74rem; font-weight: 800; color: #0f172a; line-height: 1.1; margin-top: 2px;">{plafondProgressionPct}%</span>
          </div>
        </div>
        <span style="font-size: 0.65rem; color: #64748b; font-weight: 600; white-space: nowrap;">
          Max {(selectedRegime.plafondCA / 1000).toLocaleString('fr-FR')} k€
        </span>
      </div>

    </div>

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

  <!-- 1. CADRE SOCIAL & INDICATEURS -->
  <div style="display: flex; flex-direction: column; gap: 18px;">

    <!-- BANDEAU SÉLECTEUR DE RÉGIME ET TAUX URSSAF -->
    <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 18px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 30px;">
      <div>
        <span style="font-size: 0.74rem; text-transform: uppercase; font-weight: 800; color: #64748b; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">
          Cotisations sociales & seuils légaux
        </span>
        <div style="font-weight: 800; font-size: 1.02rem; color: #0f172a; font-family: var(--font-title);">
          Barème URSSAF et plafonds applicables
        </div>
        <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 3px;">
          Calibre automatiquement vos cotisations URSSAF, votre reste net et vos jauges TVA / statut.
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 10px;">
        <label for="dashboard-regime-select" style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted); white-space: nowrap;">Votre catégorie :</label>
        <select 
          id="dashboard-regime-select"
          value={selectedRegimeKey}
          onchange={(e) => changeRegime(/** @type {HTMLSelectElement} */ (e.target).value)}
          style="padding: 8px 14px; border-radius: 8px; border: 1.5px solid var(--border-subtle); background: #ffffff; font-weight: 700; font-size: 0.88rem; color: #0f172a; cursor: pointer;"
        >
          {#each Object.entries(REGIMES_URSSAF) as [key, r]}
            <option value={key}>{r.label} ({(r.rate * 100).toFixed(1)}%)</option>
          {/each}
        </select>
      </div>
    </div>

    <!-- 1. BLOC GÉNÉRAL INDICATEURS (ENGLOBANT LE TITRE) -->
    <div class="micro-section-box" style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); margin-bottom: 30px;">
      <div class="micro-kpi-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
        <h3 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-chart-line" style="color: #2563eb; font-size: 0.95rem;"></i> Indicateurs
        </h3>
        <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">
          Chiffres clés et trésorerie en temps réel
        </span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px;">
        <KpiCard 
          label="CA Encaissé" 
          value={caEncaissé.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
          subtext="Recettes clients encaissées"
        />

        <KpiCard 
          label="Frais professionnels" 
          value={`-${depensesReelles.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`} 
          subtext="Achats, logiciels et frais payés"
        />

        <KpiCard 
          label="Solde avant URSSAF" 
          value={soldeTresorerie.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
          subtext="CA encaissé − frais professionnels"
        />

        <KpiCard 
          label="Cotisations URSSAF" 
          value={`-${urssafEstimee.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`} 
          subtext={`À prévoir (${(selectedRegime.rate * 100).toFixed(1)}% · ${selectedRegime.shortLabel})`}
        />

        <KpiCard 
          label="Revenu net" 
          value={resteNetEnPoche.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
          subtext={`Après frais & URSSAF (${margePct}% de marge)`}
        />
      </div>
    </div>

    <!-- 2. BLOC GÉNÉRAL TÂCHES À EFFECTUER (ENGLOBANT LE TITRE) -->
    <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); margin-bottom: 30px; display: flex; flex-direction: column; gap: 12px; max-width: 580px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <h3 style="font-family: var(--font-title); font-size: 1.02rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-list-check" style="color: #2563eb; font-size: 0.92rem;"></i> Tâches à effectuer
        </h3>
        <span style="background: {pendingTxCount > 0 ? '#ef4444' : '#10b981'}; color: #ffffff; font-size: 0.74rem; font-weight: 800; padding: 2px 8px; border-radius: 9999px;">
          {pendingTxCount}
        </span>
      </div>

      <!-- Bloc tâche : blanc avec ombre douce et largeur maîtrisée -->
      <div style="padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border: 1px solid #e2e8f0; border-radius: 12px; background: var(--bg-card, #ffffff); box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05); max-width: 540px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 38px; height: 38px; border-radius: 10px; background: var(--bg-subtle, #f1f5f9); border: none; color: {pendingTxCount > 0 ? '#d97706' : '#16a34a'}; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">
            <i class="fa-solid {pendingTxCount > 0 ? 'fa-arrows-split-up-and-left' : 'fa-circle-check'}"></i>
          </div>
          <div>
            <div style="font-weight: 700; font-size: 0.88rem; color: #0f172a;">
              {pendingTxCount > 0 ? `Vous devez attribuer ${pendingTxCount} opération${pendingTxCount > 1 ? 's' : ''}` : "Vous n'avez aucune attribution en attente"}
            </div>
            <div style="font-size: 0.78rem; color: #64748b; line-height: 1.35;">
              {pendingTxCount > 0 ? 'Classez ces mouvements bancaires pour actualiser vos indicateurs et vos registres légaux.' : 'Toutes vos opérations sont classées et votre comptabilité est à jour.'}
            </div>
          </div>
        </div>
        <button 
          type="button" 
          class="btn btn-sm" 
          onclick={() => activeView.set('categorize')}
          style="background: #0f172a; color: #ffffff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer; flex-shrink: 0;"
        >
          {pendingTxCount > 0 ? 'Attribuer' : 'Consulter'}
        </button>
      </div>
    </div>

    <!-- 3. BLOC GÉNÉRAL PANORAMA DE TRÉSORERIE (ENGLOBANT LE TITRE) -->
    <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); margin-bottom: 30px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
        <h3 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-calculator" style="color: #2563eb; font-size: 0.95rem;"></i> Du CA au revenu net
        </h3>
        <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">
          Votre calcul en direct, sans jargon
        </span>
      </div>

      <div style="background: var(--bg-card, #ffffff); border: none; border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; font-size: 0.88rem; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.06); width: 100%; box-sizing: border-box;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: #475569; font-weight: 700;">Calcul direct :</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; font-weight: 800; font-family: var(--font-title); flex-wrap: wrap;">
          <span style="color: var(--text-main);" title="Recettes clients encaissées">{caEncaissé.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">(CA encaissé)</span></span>
          <span style="color: var(--text-muted);">−</span>
          <span style="color: var(--color-danger, #f87171);" title="Achats, logiciels et frais payés">{depensesReelles.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">(Frais pro)</span></span>
          <span style="color: var(--text-muted);">=</span>
          <span style="color: var(--color-accent, #38bdf8); background: rgba(56, 189, 248, 0.12); padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(56, 189, 248, 0.32);" title="Solde avant cotisations URSSAF">{soldeTresorerie.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} <span style="font-size: 0.72rem; opacity: 0.85; font-weight: 600;">(Solde avant URSSAF)</span></span>
          <span style="color: var(--text-muted);">−</span>
          <span style="color: var(--color-warning, #fbbf24);" title="Cotisations URSSAF à prévoir">{urssafEstimee.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">(URSSAF)</span></span>
          <span style="color: var(--text-muted);">=</span>
          <span style="color: var(--color-success, #34d399); background: var(--color-success-bg, rgba(16, 185, 129, 0.14)); padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.38);" title="Revenu net après frais et URSSAF">{resteNetEnPoche.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} <span style="font-size: 0.72rem; opacity: 0.85; font-weight: 600;">(Revenu net)</span></span>
        </div>
      </div>
    </div>

  </div>

  <!-- 5. DERNIÈRES OPÉRATIONS BANCAIRES (ALIGNÉ AVEC LES AUTRES STRUCTURES) -->
  <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); padding: 20px; margin-bottom: 30px;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
      <div>
        <h2 style="font-family: var(--font-title); font-size: 1.12rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-list-check" style="color: #2563eb; font-size: 0.95rem;"></i>
          {#if showAllTransactions}
            Écritures bancaires ({txSearch.trim() ? `${filteredTx.length} résultat${filteredTx.length > 1 ? 's' : ''}` : `${activeTx.length} opérations`})
          {:else}
            Dernières écritures bancaires traitées
          {/if}
        </h2>
        <span style="font-size: 0.8rem; color: #64748b; font-weight: 600; margin-top: 2px; display: block;">
          {#if showAllTransactions}
            {txSearch.trim() ? `Recherche parmi les ${activeTx.length} écritures de votre micro-entreprise` : 'Historique complet des mouvements bancaires (recettes et frais)'}
          {:else}
            Mouvements bancaires rapprochés et intégrés à votre comptabilité
          {/if}
        </span>
      </div>

      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
        {#if showAllTransactions}
          <div style="position: relative; display: flex; align-items: center;">
            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 10px; color: #94a3b8; font-size: 0.78rem; pointer-events: none;"></i>
            <input 
              type="text" 
              placeholder="Libellé, compte, montant..." 
              bind:value={txSearch} 
              oninput={() => currentPage = 1}
              style="padding: 6px 12px 6px 30px; font-size: 0.82rem; border: 1.5px solid var(--border-color); border-radius: 8px; width: 230px; background: var(--bg-card); color: var(--text-main);"
            />
          </div>
        {/if}

        <button 
          type="button"
          class="btn btn-sm" 
          onclick={toggleShowAll} 
          style="background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 6px; padding: 6px 14px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s ease;"
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

    <div class="table-container desktop-tx-table" style="border: 1px solid var(--border-color); border-radius: 12px; overflow-x: auto; -webkit-overflow-scrolling: touch; background: var(--bg-card); box-shadow: var(--shadow-sm);">
      <table class="custom-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: var(--bg-container); border-bottom: 1.5px solid var(--border-container);">
            <th style="padding: 12px 14px; font-weight: 700; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Date</th>
            <th style="padding: 12px 14px; font-weight: 700; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Libellé Opération</th>
            <th style="padding: 12px 14px; font-weight: 700; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Nomenclature comptable</th>
            <th style="text-align: right; padding: 12px 14px; font-weight: 700; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Montant</th>
          </tr>
        </thead>
        <tbody>
          {#if displayedTx.length === 0}
            <tr>
              <td colspan="4" style="text-align: center; padding: 32px; color: var(--text-muted); font-size: 0.92rem;">
                {activeTx.length === 0 ? "Aucune opération bancaire enregistrée pour cette structure." : "Aucune opération ne correspond à votre recherche."}
              </td>
            </tr>
          {:else}
            {#each displayedTx as tx}
              {@const isAttributed = tx.compteAttribué && tx.compteAttribué !== '699' && tx.statut === 'attribue'}
              {@const isUnassigned = !tx.compteAttribué || tx.compteAttribué === '699'}
              <tr style="border-bottom: 1px solid var(--border-container); background: transparent;">
                <td style="color: var(--text-muted); white-space: nowrap; padding: 12px 14px; font-weight: 600; font-size: 0.86rem;">{formatDateFr(tx.date)}</td>
                <td style="font-weight: 600; color: var(--text-main); padding: 12px 14px; font-size: 0.88rem;">{tx.libelle}</td>
                <td style="padding: 12px 14px;">
                  {#if isAttributed}
                    <span class="badge" style="background: rgba(56, 189, 248, 0.14); color: var(--color-accent); border: 1px solid rgba(56, 189, 248, 0.35); font-weight: 700; font-size: 0.74rem;">
                      {getAccountLabel(tx.compteAttribué)}
                    </span>
                  {:else if isUnassigned}
                    <span class="badge" style="background: var(--color-warning-bg); color: var(--color-warning); border: 1px solid rgba(245, 158, 11, 0.35); font-weight: 700; font-size: 0.74rem;">
                      À attribuer (699)
                    </span>
                  {:else}
                    <span class="badge badge-muted" style="font-weight: 700; font-size: 0.74rem;">
                      {getAccountLabel(tx.compteAttribué)}
                    </span>
                  {/if}
                </td>
                <td style="text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; padding: 12px 14px; font-size: 0.92rem; color: {tx.credit > 0 ? 'var(--color-success)' : 'var(--text-main)'};">
                  {tx.credit > 0 ? '+' : ''}{(tx.credit || -tx.debit).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
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
        <div style="text-align: center; padding: 24px 14px; color: var(--text-muted); font-size: 0.88rem; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color);">
          {activeTx.length === 0 ? "Aucune opération bancaire enregistrée pour cette structure." : "Aucune opération ne correspond à votre recherche."}
        </div>
      {:else}
        <div class="mobile-tx-list">
          {#each displayedTx as tx}
            {@const isCredit = tx.credit > 0}
            <div class="mobile-tx-item" title={tx.libelle}>
              <div 
                class="mobile-tx-icon-pill" 
                style="background: {isCredit ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.10)'}; color: {isCredit ? '#10b981' : '#ef4444'};"
                aria-hidden="true"
              >
                {#if isCredit}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="17" y1="7" x2="7" y2="17"></line>
                    <polyline points="17 17 7 17 7 7"></polyline>
                  </svg>
                {:else}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="7" y1="17" x2="17" y2="7"></line>
                    <polyline points="7 7 17 7 17 17"></polyline>
                  </svg>
                {/if}
              </div>

              <div class="mobile-tx-content">
                <div class="mobile-tx-row-top">
                  <span class="mobile-tx-name" title={tx.libelle}>
                    {formatCleanLibelle(tx.libelle)}
                  </span>
                  <span class="mobile-tx-amount" style="color: {isCredit ? 'var(--color-success, #34d399)' : 'var(--color-danger, #f87171)'};">
                    {isCredit ? '+ ' : '- '}{Math.abs(tx.credit || -tx.debit).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                  </span>
                </div>

                <div class="mobile-tx-row-bottom">
                  <span class="mobile-tx-date">
                    {formatDateFr(tx.date)}
                  </span>
                  <span class="mobile-tx-badge">
                    {tx.compteAttribué && tx.compteAttribué !== '699' ? `${tx.compteAttribué}` : 'À attribuer'}
                  </span>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    {#if showAllTransactions && totalPages > 1}
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border-color); flex-wrap: wrap; gap: 10px;">
        <span style="font-size: 0.82rem; color: var(--text-muted); font-weight: 600;">
          Page {currentPage} sur {totalPages} · {filteredTx.length} opération{filteredTx.length > 1 ? 's' : ''}
        </span>
        <div style="display: flex; gap: 8px;">
          <button 
            type="button" 
            onclick={() => currentPage = Math.max(1, currentPage - 1)} 
            disabled={currentPage === 1}
            style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-card); color: {currentPage === 1 ? 'var(--text-muted)' : 'var(--text-main)'}; cursor: {currentPage === 1 ? 'not-allowed' : 'pointer'};"
          >
            Précédent
          </button>
          <button 
            type="button" 
            onclick={() => currentPage = Math.min(totalPages, currentPage + 1)} 
            disabled={currentPage === totalPages}
            style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-card); color: {currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-main)'}; cursor: {currentPage === totalPages ? 'not-allowed' : 'pointer'};"
          >
            Suivant
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .desktop-tx-table {
    display: block;
  }

  .mobile-tx-cards {
    display: none;
  }

  @media (max-width: 768px) {
    .micro-kpi-header {
      display: none !important;
    }

    .micro-section-box {
      background: transparent !important;
      border: none !important;
      padding: 0 !important;
      box-shadow: none !important;
      margin-bottom: 20px !important;
    }

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
      background: rgba(56, 189, 248, 0.12);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.3);
    }
  }
</style>
