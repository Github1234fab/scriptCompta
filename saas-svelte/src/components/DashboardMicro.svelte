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
</script>

<div style="padding: 24px; display: flex; flex-direction: column; gap: 28px;">
  <!-- PAGE HEADER AVEC COMPTEURS CIRCULAIRES INTÉGRÉS -->
  <PageHeader 
    title="Accueil · Micro-Entreprise" 
    subtitle="Suivi du CA encaissé, cotisations Urssaf et seuils légaux." 
    buttonLabel="Consulter mes Obligations"
    buttonIcon="fa-scale-balanced"
    onButtonClick={() => activeView.set('books')}
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
  </PageHeader>

  <!-- 1. VOTRE MICRO-ENTREPRISE -->
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
    <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 18px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 30px;">
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

    <!-- 1. BLOC GÉNÉRAL INDICATEURS (ENGLOBANT LE TITRE) -->
    <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); margin-bottom: 30px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
        <h3 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-chart-line" style="color: #2563eb; font-size: 0.95rem;"></i> Indicateurs
        </h3>
        <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">
          Chiffres clés et trésorerie en temps réel
        </span>
      </div>

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

    <!-- 2. BLOC GÉNÉRAL TÂCHES À EFFECTUER (ENGLOBANT LE TITRE) -->
    <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); margin-bottom: 30px; display: flex; flex-direction: column; gap: 14px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <h3 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-list-check" style="color: #2563eb; font-size: 0.95rem;"></i> Tâches à effectuer
        </h3>
        <span style="background: {pendingTxCount > 0 ? '#ef4444' : '#10b981'}; color: #ffffff; font-size: 0.74rem; font-weight: 800; padding: 2px 8px; border-radius: 9999px;">
          {pendingTxCount}
        </span>
      </div>

      <!-- Bloc tâche : blanc avec ombre douce sans bordure -->
      <div style="padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border: none; border-radius: 12px; background: var(--bg-card, #ffffff); box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.06); flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 42px; height: 42px; border-radius: 10px; background: var(--bg-subtle, #f1f5f9); border: none; color: {pendingTxCount > 0 ? '#d97706' : '#16a34a'}; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;">
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

    <!-- 3. BLOC GÉNÉRAL PANORAMA DE TRÉSORERIE (ENGLOBANT LE TITRE) -->
    <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); margin-bottom: 30px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
        <h3 style="font-family: var(--font-title); font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-calculator" style="color: #2563eb; font-size: 0.95rem;"></i> Panorama de trésorerie en un clin d'œil
        </h3>
        <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">
          Décomposition pas à pas de vos ventes brutes jusqu'au net final en poche
        </span>
      </div>

      <div style="background: var(--bg-card, #ffffff); border: none; border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; font-size: 0.88rem; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.06); width: 100%; box-sizing: border-box;">
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

  </div>

  <!-- 5. DERNIÈRES RECETTES ENCAISSÉES (ENGLOBANT LE TITRE) -->
  <div style="background: var(--bg-container); border: 1.5px solid var(--border-container); border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); padding: 20px; margin-bottom: 30px;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
      <div>
        <h2 style="font-family: var(--font-title); font-size: 1.12rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-cash-register" style="color: #2563eb; font-size: 0.95rem;"></i> Dernières recettes encaissées
        </h2>
        <span style="font-size: 0.8rem; color: #64748b; font-weight: 600; margin-top: 2px; display: block;">
          Flux de ventes clients enregistrés et synchronisés dans votre Livre des recettes
        </span>
      </div>
      <button class="btn btn-sm" onclick={() => activeView.set('books')} style="background: #ffffff; border: 1px solid var(--border-subtle); color: #0f172a; border-radius: 6px; padding: 6px 12px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
        Consulter le Livre des Recettes complet <i class="fa-solid fa-arrow-right"></i>
      </button>
    </div>

    <div class="table-container" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);">
      <table class="custom-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #ffffff; border-bottom: 1.5px solid #e2e8f0;">
            <th>Date</th>
            <th>Client / Libellé</th>
            <th>Mode de règlement</th>
            <th style="text-align: right;">Montant Encaissé</th>
          </tr>
        </thead>
        <tbody>
          {#each activeTx.filter(t => t.credit > 0 && t.compteAttribué !== '699' && t.statut === 'attribue').slice(0, 6) as tx}
            <tr style="border-bottom: 1px solid var(--border-subtle, #e2e8f0); background: #ffffff;">
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
