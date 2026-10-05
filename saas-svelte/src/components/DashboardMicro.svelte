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

  <!-- BANDEAU SÉRÉNITÉ : 4 CARTES KPI -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px;">
    
    <KpiCard 
      label="CA Encaissé Cumulé" 
      value={caEncaissé.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
      subtext="Base de déclaration Urssaf"
      bgColor="#eff6ff"
      borderColor="#bfdbfe"
      textColor="#1e3a8a"
      subtextColor="#2563eb"
    />

    <KpiCard 
      label={`Urssaf Estimée (${activeRateObj.label})`} 
      value={urssafEstimee.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
      subtext="Montant à provisionner"
      bgColor="#fffbeb"
      borderColor="#fde68a"
      textColor="#78350f"
      subtextColor="#d97706"
    />

    <KpiCard 
      label="Reste Net Réel" 
      value={resteNetEnPoche.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
      subtext="Après Urssaf & charges réelles"
      bgColor="#ecfdf5"
      borderColor="#a7f3d0"
      textColor="#065f46"
      subtextColor="#059669"
    />

    <KpiCard 
      label="Franchise en Base TVA" 
      value={`${tvaPct}% atteint`} 
      subtext={tvaPct < 80 ? "Sous le seuil (37 500 €)" : "⚠️ Proche du seuil de 37 500 €"}
      bgColor="#faf5ff"
      borderColor="#e9d5ff"
      textColor="#581c87"
      subtextColor="#9333ea"
      progressBarPct={tvaPct}
    />

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
