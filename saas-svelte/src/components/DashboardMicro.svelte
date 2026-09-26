<script>
  import { transactions, planComptable, activeEntityId, entities, updateEntities, activeView, showToast } from '../lib/store.js';
  import PageHeader from './PageHeader.svelte';
  import KpiCard from './KpiCard.svelte';

  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0] || { name: 'Ma Structure', model: 'micro' });

  /** @type {Record<string, { rate: number, label: string }>} */
  const URSSAF_RATES = {
    services_bic: { rate: 0.214, label: 'Prestations BIC (21,4%)' },
    services_bnc: { rate: 0.258, label: 'Libéral BNC (25,8%)' },
    vente_bic: { rate: 0.124, label: 'Vente BIC (12,4%)' }
  };

  let currentMicroActivity = $derived(activeEntity?.microActivity || 'services_bic');
  let activeRateObj = $derived(URSSAF_RATES[currentMicroActivity] || URSSAF_RATES.services_bic);
  let activeRate = $derived(activeRateObj.rate);

  // Recettes encaissées (comptabilité d'encaissement pure)
  let caEncaissé = $derived($transactions.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue') {
      const cpt = $planComptable.find((/** @type {any} */ p) => p.compte === tx.compteAttribué);
      if (cpt && cpt.type === 'Produit') return sum + tx.credit;
    }
    return sum;
  }, 0));

  // Charges réelles
  let depensesReelles = $derived($transactions.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue') {
      const cpt = $planComptable.find((/** @type {any} */ p) => p.compte === tx.compteAttribué);
      if (cpt && cpt.type === 'Charge') return sum + tx.debit;
    }
    return sum;
  }, 0));

  // Urssaf estimée & Reste net
  let urssafEstimee = $derived(caEncaissé * activeRate);
  let resteNetEnPoche = $derived(caEncaissé - urssafEstimee - depensesReelles);

  // Franchise TVA : Seuil 37 500€
  let tvaPct = $derived(Math.min(100, Math.round((caEncaissé / 37500) * 100)));
</script>

<div style="padding: 24px;">
  <!-- PAGE HEADER -->
  <PageHeader 
    title="Tableau de bord · Micro-Entreprise" 
    subtitle="Suivi du CA encaissé, cotisations Urssaf et franchise de TVA." 
    buttonLabel="Imprimer mon Livre des Recettes"
    buttonIcon="fa-file-pdf"
    onButtonClick={() => activeView.set('books')}
  />

  <!-- BANDEAU SÉRÉNITÉ : 3 CARTES KPI -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-bottom: 24px;">
    
    <KpiCard 
      label="CA Encaissé Cumulé" 
      value={caEncaissé.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
      icon="fa-rocket" 
      subtext="Base de déclaration Urssaf" 
      subtextIcon="fa-receipt"
    />

    <KpiCard 
      label={`Urssaf Estimée (${activeRateObj.label})`} 
      value={urssafEstimee.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
      icon="fa-calculator" 
      iconColor="var(--color-warning)"
      subtext="Montant à provisionner" 
      subtextIcon="fa-clock"
      subtextColor="var(--color-warning)"
    />

    <KpiCard 
      label="Reste Net Réel" 
      value={resteNetEnPoche.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
      icon="fa-piggy-bank" 
      iconColor="var(--color-success)"
      subtext="Après Urssaf & charges réelles" 
      subtextIcon="fa-check-circle"
      subtextColor="var(--color-success)"
    />

  </div>

  <!-- JAUGE DE SÉRÉNITÉ FRANCHISE TVA -->
  <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px; box-shadow: var(--shadow-card); margin-bottom: 24px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <span style="font-size: 0.88rem; font-weight: 700; color: var(--text-main);">Suivi de la Franchise en Base de TVA (Seuil 37 500 €)</span>
      <span style="font-size: 0.84rem; font-weight: 700; color: var(--text-muted);">{tvaPct}% atteint</span>
    </div>
    <div style="width: 100%; height: 10px; background: var(--bg-primary); border-radius: 5px; overflow: hidden; border: 1px solid var(--border-color);">
      <div style="width: {tvaPct}%; height: 100%; background: {tvaPct > 80 ? 'var(--color-warning)' : 'var(--color-accent)'}; transition: width 0.3s ease;"></div>
    </div>
    <p style="margin: 8px 0 0 0; font-size: 0.78rem; color: var(--text-muted);">
      {#if tvaPct < 80}
        ✅ Vous êtes sereinement sous le seuil de bascule TVA.
      {:else}
        ⚠️ Vigilance : Vous approchez du seuil de franchise de TVA (37 500 €).
      {/if}
    </p>
  </div>

  <!-- TABLEAU DÉLIMITÉ -->
  <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-card); padding: 20px;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
      <h3 style="margin: 0; font-size: 1rem; font-weight: 700; color: var(--text-main);">Dernières Recettes d'activité</h3>
      <button class="btn btn-sm" onclick={() => activeView.set('categorize')} style="background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-main); border-radius: var(--radius-sm); padding: 6px 12px; font-weight: 600; font-size: 0.82rem; cursor: pointer;">
        Voir toutes les recettes ➔
      </button>
    </div>

    <div class="table-container">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Client / Libellé</th>
            <th>Mode de règlement</th>
            <th style="text-align: right;">Montant Encaissé</th>
          </tr>
        </thead>
        <tbody>
          {#each $transactions.filter(t => t.credit > 0).slice(0, 6) as tx}
            <tr>
              <td style="color: var(--text-muted); white-space: nowrap;">{tx.date}</td>
              <td style="font-weight: 600; color: var(--text-main);">{tx.libelle}</td>
              <td>
                <span class="badge badge-muted">
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
<!-- 4. BLOC : OBLIGATIONS LÉGALES -->
<!-- ═══════════════════════════════════════════════════════════════════ -->
<div class="dashboard-section-block" style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-lg); padding: 22px; margin-bottom: 20px;">
  <h2 style="font-family: var(--font-title); font-size: 1.25rem; font-weight: 700; color: white; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
    <span style="background: rgba(16, 185, 129, 0.15); color: #34d399; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1rem;">📋</span>
    Obligations Légales
  </h2>

  <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;">
    <div style="max-width: 750px;">
      <h3 style="font-family: var(--font-title); font-size: 1.08rem; color: white; margin-bottom: 6px;">
        Tenue du Livre des Recettes
      </h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; margin: 0;">
        En tant que micro-entrepreneur, vous avez l'obligation légale de tenir un Livre des Recettes chronologique retraçant l'ensemble de vos encaissements. Ce registre doit être conservé pendant 10 ans.
      </p>
    </div>
    <button class="btn btn-primary" onclick={() => activeView.set('recettes')}>
      <i class="fa-solid fa-book-journal-whills"></i> Consulter & Exporter le Livre des Recettes
    </button>
  </div>
</div>
