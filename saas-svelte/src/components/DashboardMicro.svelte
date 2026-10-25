<script>
  import { 
    transactions, 
    planComptable, 
    activeEntityId, 
    entities, 
    updateEntities, 
    activeView, 
    showToast 
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
      franchiseTVA: 36800,
      franchiseTVAMajoree: 39100
    },
    services_bnc: {
      label: 'Professions libérales non réglementées (BNC)',
      shortLabel: 'Libéral BNC',
      rate: 0.258,
      plafondCA: 77700,
      franchiseTVA: 36800,
      franchiseTVAMajoree: 39100
    },
    vente_bic: {
      label: 'Achat / Revente de marchandises & hébergement (BIC)',
      shortLabel: 'Vente BIC',
      rate: 0.123,
      plafondCA: 188700,
      franchiseTVA: 91900,
      franchiseTVAMajoree: 101000
    }
  };

  let selectedRegimeKey = $derived(activeEntity?.microActivity || 'services_bic');
  let selectedRegime = $derived(REGIMES_URSSAF[selectedRegimeKey] || REGIMES_URSSAF.services_bic);
  let activeRate = $derived(selectedRegime.rate);

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

  // Jauges de surveillance
  let tvaProgressionPct = $derived(Math.min(100, Math.round((caEncaissé / selectedRegime.franchiseTVA) * 100)));
  let plafondProgressionPct = $derived(Math.min(100, Math.round((caEncaissé / selectedRegime.plafondCA) * 100)));

  // Découpage trimestriel du CA pour déclaration Urssaf
  let caTrimestriel = $derived((() => {
    const quarters = {
      T1: { ca: 0, label: '1er Trimestre (Jan - Mar)' },
      T2: { ca: 0, label: '2ème Trimestre (Avr - Jun)' },
      T3: { ca: 0, label: '3ème Trimestre (Jul - Sep)' },
      T4: { ca: 0, label: '4ème Trimestre (Oct - Déc)' }
    };

    activeTx.forEach(r => {
      if (r.credit > 0 && r.compteAttribué !== '699' && r.statut === 'attribue') {
        const month = new Date(r.date).getMonth() + 1;
        if (month <= 3) quarters.T1.ca += r.credit;
        else if (month <= 6) quarters.T2.ca += r.credit;
        else if (month <= 9) quarters.T3.ca += r.credit;
        else quarters.T4.ca += r.credit;
      }
    });

    return quarters;
  })());

  /** @param {number} val */
  function copierMontant(val) {
    navigator.clipboard.writeText(val.toFixed(2));
    showToast(`Montant ${val.toFixed(2)} € copié pour votre déclaration Urssaf !`);
  }
  // Calcul des tâches à faire : seules les vraies actions opérationnelles sont conservées
  let pendingTxCount = $derived(activeTx.filter(t => t.compteAttribué === '699' || t.statut === 'non_attribue' || t.statut === 'suggere' || t.statut === 'a_attribuer').length);
</script>

<div style="padding: 24px; display: flex; flex-direction: column; gap: 28px;">
  <!-- PAGE HEADER -->
  <PageHeader 
    title="Accueil · Micro-Entreprise" 
    subtitle="Suivi du CA encaissé, cotisations Urssaf et seuils légaux." 
    buttonLabel="Consulter mes Obligations"
    buttonIcon="fa-scale-balanced"
    onButtonClick={() => activeView.set('books')}
  />

  <!-- 1. VOS TÂCHES (Uniquement les actions opérationnelles à mener) -->
  <div>
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
      <h2 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">
        Vos tâches
      </h2>
      <span style="background: {pendingTxCount > 0 ? '#ef4444' : '#10b981'}; color: #ffffff; font-size: 0.74rem; font-weight: 800; padding: 2px 8px; border-radius: 9999px;">
        {pendingTxCount}
      </span>
    </div>

    <!-- BLOC GÉNÉRAL QUI ACCUEILLE LES BLOCS DE TÂCHES -->
    <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 12px;">
      <!-- Bloc tâche : blanc avec bordures grises chaudes -->
      <div style="padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid var(--border-container); border-radius: 12px; background: var(--bg-card, #ffffff); box-shadow: 0 1px 2px rgba(0,0,0,0.02); flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 42px; height: 42px; border-radius: 10px; background: var(--bg-container); border: 1px solid var(--border-container); color: {pendingTxCount > 0 ? '#d97706' : '#16a34a'}; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;">
            <i class="fa-solid {pendingTxCount > 0 ? 'fa-arrows-split-up-and-left' : 'fa-circle-check'}"></i>
          </div>
          <div>
            <div style="font-weight: 700; font-size: 0.92rem; color: #0f172a;">
              {pendingTxCount > 0 ? `Vous devez attribuer ${pendingTxCount} opération${pendingTxCount > 1 ? 's' : ''}` : "Vous n'avez aucune attribution en attente"}
            </div>
            <div style="font-size: 0.8rem; color: #64748b;">
              {pendingTxCount > 0 ? 'Classez ces mouvements bancaires pour actualiser vos indicateurs et vos registres légaux.' : 'Toutes vos opérations sont classées et votre comptabilité est à jour.'}
            </div>
          </div>
        </div>
        <button 
          type="button"
          class="btn btn-sm" 
          onclick={() => activeView.set('categorize')}
          style="background: #0f172a; color: #ffffff; border: none; padding: 7px 16px; border-radius: 6px; font-weight: 700; font-size: 0.82rem; cursor: pointer;"
        >
          {pendingTxCount > 0 ? 'Attribuer' : 'Consulter'}
        </button>
      </div>
    </div>
  </div>

  <!-- 2. VOTRE MICRO-ENTREPRISE -->
  <div style="display: flex; flex-direction: column; gap: 18px;">
    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
      <h2 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">
        Votre micro-entreprise
      </h2>
      <span style="font-size: 0.82rem; color: #64748b; font-weight: 600;">
        Cadre social, indicateurs et seuils de chiffre d'affaires
      </span>
    </div>

    <!-- BANDEAU SÉLECTEUR DE RÉGIME ET TAUX URSSAF -->
    <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 18px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
      <div>
        <span style="font-size: 0.74rem; text-transform: uppercase; font-weight: 800; color: #64748b; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">
          Activité micro-entrepreneur & Taux de cotisations
        </span>
        <div style="font-weight: 800; font-size: 1.05rem; color: #0f172a; font-family: var(--font-title);">
          Régime fiscal et social applicable à <span style="color: #2563eb; background: rgba(37, 99, 235, 0.09); padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(37, 99, 235, 0.2);">{activeEntity.name}</span>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 12px;">
        <label for="dashboard-regime-select" style="font-size: 0.85rem; font-weight: 700; color: #334155;">Type d'activité :</label>
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

    <!-- TITRE DE SECTION KPI : INDICATEURS -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px; margin-bottom: -6px;">
      <h3 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-chart-line" style="color: #2563eb; font-size: 0.95rem;"></i> Indicateurs
      </h3>
      <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">
        Chiffres clés et trésorerie en temps réel
      </span>
    </div>

    <!-- BLOC GÉNÉRAL REGROUPANT TOUTES LES CARTES KPI -->
    <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px;">
        <KpiCard 
          label="CA Encaissé Net" 
          value={caEncaissé.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
          subtext="Facturé aux clients (ce que je vends)"
        />

        <KpiCard 
          label="Dépenses d'activité" 
          value={`-${depensesReelles.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`} 
          subtext="Achats et frais pro décaissés"
        />

        <KpiCard 
          label="CA moins dépenses" 
          value={soldeTresorerie.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
          subtext="Reste sur mes ventes avant Urssaf"
        />

        <KpiCard 
          label={`Charges Urssaf (${selectedRegime.shortLabel})`} 
          value={`-${urssafEstimee.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`} 
          subtext={`Cotisations à régler (${(selectedRegime.rate * 100).toFixed(1)}%)`}
        />

        <KpiCard 
          label="Reste Net Final" 
          value={resteNetEnPoche.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
          subtext={`En poche après charges (${margePct}% marge)`}
        />
      </div>
    </div>

    <!-- TITRE DU BLOC TRÉSORERIE -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px; margin-bottom: -6px;">
      <h3 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-calculator" style="color: #2563eb; font-size: 0.95rem;"></i> Panorama de trésorerie en un clin d'œil
      </h3>
      <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">
        Décomposition pas à pas de vos ventes brutes jusqu'au net final en poche
      </span>
    </div>

    <!-- BLOC GÉNÉRAL : FORMULE DE TRÉSORERIE ÉTAPE PAR ÉTAPE -->
    <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
      <div style="background: var(--bg-card, #ffffff); border: 1px solid var(--border-container); border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; font-size: 0.88rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: #475569; font-weight: 700;">Calcul direct :</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; font-weight: 800; font-family: var(--font-title); flex-wrap: wrap;">
          <span style="color: #0f172a;" title="Ce que j'ai facturé et vendu">{caEncaissé.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">(CA encaissé)</span></span>
          <span style="color: #94a3b8;">−</span>
          <span style="color: #b91c1c;" title="Ce que j'ai dépensé pour mon activité">{depensesReelles.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">(Dépenses)</span></span>
          <span style="color: #94a3b8;">=</span>
          <span style="color: #2563eb; background: #eff6ff; padding: 3px 8px; border-radius: 6px; border: 1px solid #bfdbfe;" title="Combien il me reste sur mes ventes">{soldeTresorerie.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} <span style="font-size: 0.72rem; color: #1e40af; font-weight: 600;">(CA − Dépenses)</span></span>
          <span style="color: #94a3b8;">−</span>
          <span style="color: #ea580c;" title="Ce que je dois régler à l'Urssaf">{urssafEstimee.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">(Charges Urssaf)</span></span>
          <span style="color: #94a3b8;">=</span>
          <span style="color: #15803d; background: #f0fdf4; padding: 3px 8px; border-radius: 6px; border: 1px solid #bbf7d0;" title="Combien il me reste finalement en poche">{resteNetEnPoche.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} <span style="font-size: 0.72rem; color: #166534; font-weight: 600;">(Reste net en poche)</span></span>
        </div>
      </div>
    </div>

    <!-- TITRE DE SECTION JAUGES : SEUILS & LIMITES -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px; margin-bottom: -6px;">
      <h3 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-gauge-high" style="color: #2563eb; font-size: 0.95rem;"></i> Seuils & Limites de votre régime
      </h3>
      <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">
        Surveillance de la franchise de TVA et des plafonds autorisés
      </span>
    </div>

    <!-- BLOC GÉNÉRAL CONTENANT LES DEUX SEUILS -->
    <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
      
      <!-- Jauge 1 : Franchise de TVA (fond blanc) -->
      <div style="background: var(--bg-card, #ffffff); border: 1px solid var(--border-container); border-radius: 12px; padding: 18px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <h4 style="font-family: var(--font-title); font-size: 0.98rem; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">
              Seuil de franchise en base de TVA
            </h4>
            <p style="font-size: 0.8rem; color: #64748b; margin: 0;">
              Limite sans TVA : <strong>{selectedRegime.franchiseTVA.toLocaleString('fr-FR')} €</strong> / an
            </p>
          </div>
          <span style="background: var(--bg-subtle); border: 1px solid var(--border-subtle); color: {tvaProgressionPct < 85 ? '#15803d' : '#c2410c'}; font-size: 0.82rem; font-weight: 800; padding: 4px 10px; border-radius: 8px;">
            {tvaProgressionPct}%
          </span>
        </div>

        <div style="background: var(--bg-container); border: 1px solid var(--border-container); height: 10px; border-radius: 6px; overflow: hidden; margin-bottom: 12px;">
          <div style="width: {tvaProgressionPct}%; height: 100%; background: {tvaProgressionPct < 80 ? '#22c55e' : (tvaProgressionPct < 100 ? '#f59e0b' : '#ef4444')}; border-radius: 6px; transition: width 0.3s ease;"></div>
        </div>

        <p style="font-size: 0.82rem; color: #475569; margin: 0; line-height: 1.4;">
          {#if tvaProgressionPct < 80}
            <i class="fa-solid fa-circle-check" style="color: #22c55e;"></i> Vous bénéficiez de la franchise en base : pas de TVA à facturer ni à déclarer.
          {:else if tvaProgressionPct < 100}
            <i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b;"></i> Vigilance : vous approchez du seuil de franchise. Anticipez la facturation avec TVA.
          {:else}
            <i class="fa-solid fa-circle-exclamation" style="color: #ef4444;"></i> Seuil dépassé : vous devenez assujetti à la TVA dès le 1er jour du mois de dépassement.
          {/if}
        </p>
      </div>

      <!-- Jauge 2 : Plafond du régime Micro (fond blanc) -->
      <div style="background: var(--bg-card, #ffffff); border: 1px solid var(--border-container); border-radius: 12px; padding: 18px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <h4 style="font-family: var(--font-title); font-size: 0.98rem; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">
              Plafond annuel de chiffre d'affaires
            </h4>
            <p style="font-size: 0.8rem; color: #64748b; margin: 0;">
              Chiffre d'affaires max autorisé : <strong>{selectedRegime.plafondCA.toLocaleString('fr-FR')} €</strong> / an
            </p>
          </div>
          <span style="background: var(--bg-subtle); border: 1px solid var(--border-subtle); color: #334155; font-size: 0.82rem; font-weight: 800; padding: 4px 10px; border-radius: 8px;">
            {plafondProgressionPct}%
          </span>
        </div>

        <div style="background: var(--bg-container); border: 1px solid var(--border-container); height: 10px; border-radius: 6px; overflow: hidden; margin-bottom: 12px;">
          <div style="width: {plafondProgressionPct}%; height: 100%; background: #3b82f6; border-radius: 6px; transition: width 0.3s ease;"></div>
        </div>

        <p style="font-size: 0.82rem; color: #475569; margin: 0; line-height: 1.4;">
          <i class="fa-solid fa-shield-halved" style="color: #3b82f6;"></i> Il vous reste <strong>{Math.max(0, selectedRegime.plafondCA - caEncaissé).toLocaleString('fr-FR')} €</strong> de marge sous le statut micro.
        </p>
      </div>

    </div>
  </div>

  <!-- 3. PANORAMA DES DÉCLARATIONS URSSAF -->
  <div>
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: gap; gap: 10px;">
      <h2 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-file-invoice-dollar" style="color: #2563eb; font-size: 1rem;"></i> Panorama des déclarations Urssaf
      </h2>
      <span style="font-size: 0.82rem; color: #64748b; font-weight: 600;">
        Montants précalculés prêts à être recopiés sur le portail autoentrepreneur.urssaf.fr
      </span>
    </div>

    <div id="declaration-urssaf-section" style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
      <div class="table-container" style="border: 1px solid var(--border-container); border-radius: 12px; overflow: hidden; background: var(--bg-card, #ffffff); box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <table class="custom-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: var(--bg-container); border-bottom: 1.5px solid var(--border-container);">
              <th style="padding: 12px 14px; text-align: left; font-size: 0.78rem; font-weight: 800; color: #475569; text-transform: uppercase;">Trimestre</th>
              <th style="padding: 12px 14px; text-align: left; font-size: 0.78rem; font-weight: 800; color: #475569; text-transform: uppercase;">Période couverte</th>
              <th style="padding: 12px 14px; text-align: right; font-size: 0.78rem; font-weight: 800; color: #475569; text-transform: uppercase;">CA Encaissé</th>
              <th style="padding: 12px 14px; text-align: right; font-size: 0.78rem; font-weight: 800; color: #475569; text-transform: uppercase;">Cotisations ({(selectedRegime.rate * 100).toFixed(1)}%)</th>
              <th style="padding: 12px 14px; text-align: center; font-size: 0.78rem; font-weight: 800; color: #475569; text-transform: uppercase;">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each Object.entries(caTrimestriel) as [key, q]}
              {@const cotis = q.ca * selectedRegime.rate}
              <tr style="border-bottom: 1px solid var(--border-container); background: #ffffff;">
                <td style="padding: 12px 14px; font-weight: 800; color: #0f172a;">{key}</td>
                <td style="padding: 12px 14px; color: #475569; font-size: 0.85rem;">{q.label}</td>
                <td style="padding: 12px 14px; text-align: right; font-weight: 800; font-size: 0.95rem; color: #0f172a; font-family: var(--font-title);">
                  {q.ca.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </td>
                <td style="padding: 12px 14px; text-align: right; font-weight: 800; font-size: 0.95rem; color: #15803d; font-family: var(--font-title);">
                  {cotis.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </td>
                <td style="padding: 12px 14px; text-align: center;">
                  <button 
                    class="btn btn-sm"
                    onclick={() => copierMontant(q.ca)}
                    style="background: var(--bg-subtle); border: 1px solid var(--border-subtle); color: #0f172a; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;"
                    title="Copier le CA du trimestre pour urssaf.fr"
                  >
                    <i class="fa-regular fa-copy"></i> Copier CA
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- 4. DERNIÈRES RECETTES ENCAISSÉES -->
  <div>
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
      <h2 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-cash-register" style="color: #2563eb; font-size: 1rem;"></i> Dernières recettes encaissées
      </h2>
      <span style="font-size: 0.82rem; color: #64748b; font-weight: 600;">
        Flux de ventes clients enregistrés et synchronisés dans votre Livre des recettes
      </span>
    </div>

    <!-- BLOC GÉNÉRAL QUI ACCUEILLE LE TABLEAU -->
    <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); padding: 18px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
        <h3 style="margin: 0; font-size: 0.98rem; font-weight: 800; color: #0f172a; font-family: var(--font-title);">Recettes d'activité récentes</h3>
        <button class="btn btn-sm" onclick={() => activeView.set('books')} style="background: #ffffff; border: 1px solid var(--border-subtle); color: #0f172a; border-radius: 6px; padding: 6px 12px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          Consulter le Livre des Recettes complet <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>

      <div class="table-container" style="border: 1px solid var(--border-container); border-radius: 12px; overflow: hidden; background: var(--bg-card, #ffffff); box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <table class="custom-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: var(--bg-container); border-bottom: 1.5px solid var(--border-container);">
              <th>Date</th>
              <th>Client / Libellé</th>
              <th>Mode de règlement</th>
              <th style="text-align: right;">Montant Encaissé</th>
            </tr>
          </thead>
          <tbody>
            {#each activeTx.filter(t => t.credit > 0 && t.compteAttribué !== '699' && t.statut === 'attribue').slice(0, 6) as tx}
              <tr style="border-bottom: 1px solid var(--border-container); background: #ffffff;">
                <td style="color: var(--text-muted); white-space: nowrap;">{tx.date}</td>
                <td style="font-weight: 600; color: var(--text-main);">{tx.libelle}</td>
                <td>
                  <span class="badge badge-muted" style="background: var(--bg-subtle); border: 1px solid var(--border-subtle);">
                    Virement bancaire
                  </span>
                </td>
                <td style="text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--color-success);">
                  +{tx.credit.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
