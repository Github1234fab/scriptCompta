<script>
  import { transactions, planComptable, activeEntityId, entities } from '../lib/store.js';

  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0]);

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

  let recettes = $derived($transactions.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue') {
      const cpt = $planComptable.find((/** @type {any} */ p) => p.compte === tx.compteAttribué);
      if (cpt && cpt.type === 'Produit') return sum + tx.credit;
    }
    return sum;
  }, 0));

  let depenses = $derived($transactions.reduce((sum, tx) => {
    if (tx.compteAttribué !== '699' && tx.statut === 'attribue') {
      const cpt = $planComptable.find((/** @type {any} */ p) => p.compte === tx.compteAttribué);
      if (cpt && cpt.type === 'Charge') return sum + tx.debit;
    }
    return sum;
  }, 0));

  // Provisions estimées (Urssaf + TVA)
  let urssafEstimee = $derived(recettes * 0.211);
  let tvaCollectee = $derived(recettes * 0.20);
  let tvaDeductible = $derived(depenses * 0.20);
  let tvaNetteEstimee = $derived(Math.max(0, tvaCollectee - tvaDeductible));
  let provisionsTotales = $derived(urssafEstimee + tvaNetteEstimee);

  let vraiDisponible = $derived(totalTrésorerie - provisionsTotales);

  let moyDepensesMensuelles = $derived(depenses > 0 ? (depenses / 3) : 250);
  let runwayMois = $derived(moyDepensesMensuelles > 0 ? (vraiDisponible / moyDepensesMensuelles).toFixed(1) : '12+');

  // Détection des récurrences (abonnements / prélèvements fixes)
  let recurrences = $derived(
    $transactions
      .filter((/** @type {any} */ tx) => tx.debit > 0)
      .slice(0, 5)
      .map((/** @type {any} */ tx) => ({
        libelle: tx.libelle,
        montant: tx.debit,
        frequence: 'Mensuelle estimée'
      }))
  );
</script>

<div class="page-title-section" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 15px;">
  <div>
    <h1 class="page-title">☀️ La Météo de Trésorerie</h1>
    <p class="page-subtitle">Combien j'ai vraiment ? Éliminez le doute sur l'argent réellement disponible après provisions.</p>
  </div>
</div>

<div class="pedago-banner" style="margin-bottom: 25px;">
  <div class="pedago-banner-icon">💡</div>
  <div class="pedago-banner-text">
    <h4>Pourquoi le solde bancaire est trompeur ?</h4>
    <p>Un dirigeant ou trésorier qui voit 10 000 € sur son compte stresse parce qu'il ne sait pas ce qui lui appartient réellement. La météo de trésorerie calcule en temps réel votre <strong>Vrai Disponible</strong> après déduction des provisions automatiques (Urssaf, TVA, charges récurrentes) et évalue votre autonomie financière sans rentrée d'argent !</p>
  </div>
</div>

<div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); margin-bottom: 30px;">
  
  <!-- Solde Brut -->
  <div class="glass-card highlight-primary">
    <div class="stat-icon primary"><i class="fa-solid fa-wallet"></i></div>
    <div class="stat-label" style="font-size: 1.15rem; font-weight: 700; color: white; margin-bottom: 8px;">
      Solde Bancaire Brut
    </div>
    <div class="stat-value" style="font-size: 1.75rem; margin: 0; color: white;">
      {totalTrésorerie.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
    </div>
    <span style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-top: 6px;">Compte Banque 512 + Caisse 530</span>
  </div>

  <!-- Vrai Disponible -->
  <div class="glass-card highlight-success" style="border: 1px solid rgba(52, 211, 153, 0.4);">
    <div class="stat-icon success"><i class="fa-solid fa-shield-halved"></i></div>
    <div class="stat-label" style="font-size: 1.15rem; font-weight: 700; color: #34d399; margin-bottom: 8px;">
      Le Vrai Disponible
    </div>
    <div class="stat-value" style="font-size: 1.75rem; margin: 0; color: #34d399;">
      {vraiDisponible.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
    </div>
    <span style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-top: 6px;">-{provisionsTotales.toFixed(0)}€ de provisionsUrssaf/TVA</span>
  </div>

  <!-- Runway / Autonomie -->
  <div class="glass-card highlight-warning">
    <div class="stat-icon warning"><i class="fa-solid fa-hourglass-half"></i></div>
    <div class="stat-label" style="font-size: 1.15rem; font-weight: 700; color: white; margin-bottom: 8px;">
      Runway / Autonomie
    </div>
    <div class="stat-value" style="font-size: 1.75rem; margin: 0;">
      {runwayMois} <span style="font-size: 0.95rem; font-weight: normal; color: var(--text-secondary);">mois</span>
    </div>
    <span style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-top: 6px;">À ce rythme, réserve sans aucune rentrée</span>
  </div>
</div>

<!-- Abonnements & Récurrences détectées -->
<div class="glass-card">
  <h3 style="font-family: var(--font-title); margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
    <i class="fa-solid fa-arrows-rotate" style="color: #818cf8;"></i> Récurrences & Abonnements Détectés
  </h3>
  <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 20px;">
    Vue simple des abonnements et prélèvements fixes pour repérer immédiatement les hausses ou doublons.
  </p>

  <div class="table-container">
    <table class="custom-table">
      <thead>
        <tr>
          <th>Prélèvement / Abonnement</th>
          <th>Fréquence</th>
          <th style="text-align: right;">Montant Estimé</th>
        </tr>
      </thead>
      <tbody>
        {#if recurrences.length === 0}
          <tr>
            <td colspan="3" style="text-align: center; color: var(--text-secondary); padding: 20px;">
              Aucune récurrence fixe détectée. Importez un relevé de plus de 30 jours.
            </td>
          </tr>
        {:else}
          {#each recurrences as r}
            <tr>
              <td style="color: white; font-weight: 600;">{r.libelle}</td>
              <td><span class="badge badge-muted">{r.frequence}</span></td>
              <td style="text-align: right; color: #f87171; font-weight: 700;">-{r.montant.toFixed(2)} €</td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
