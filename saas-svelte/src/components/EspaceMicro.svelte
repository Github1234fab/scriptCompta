<script>
  import LivreRecettes from './LivreRecettes.svelte';
  import KpiCard from './KpiCard.svelte';
  import { transactions, activeEntityId, entities, showToast } from '../lib/store.js';

  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0] || { name: 'Ma Structure' });

  let activeTab = $state('ca'); // 'ca', 'recettes', or 'achats'

  // Régimes Urssaf et taux officiels en vigueur
  /** @type {Record<string, { label: string, rate: number, plafondCA: number, franchiseTVA: number, franchiseTVAMajoree: number }>} */
  const REGIMES_URSSAF = {
    services_bic: {
      label: 'Prestations de services commerciales ou artisanales (BIC)',
      rate: 0.212,
      plafondCA: 77700,
      franchiseTVA: 36800,
      franchiseTVAMajoree: 39100
    },
    services_bnc: {
      label: 'Professions libérales non réglementées (BNC)',
      rate: 0.258,
      plafondCA: 77700,
      franchiseTVA: 36800,
      franchiseTVAMajoree: 39100
    },
    vente_bic: {
      label: 'Achat / Revente de marchandises & hébergement (BIC)',
      rate: 0.123,
      plafondCA: 188700,
      franchiseTVA: 91900,
      franchiseTVAMajoree: 101000
    }
  };

  let selectedRegimeKey = $state('services_bic');
  let selectedRegime = $derived(REGIMES_URSSAF[selectedRegimeKey] || REGIMES_URSSAF.services_bic);

  // Recettes et achats réels filtrés strictement pour la structure active
  let structureTx = $derived($transactions.filter((/** @type {any} */ tx) => !tx.entityId || tx.entityId === $activeEntityId));

  let recettesList = $derived(
    structureTx
      .filter((/** @type {any} */ tx) => tx.credit > 0 && tx.statut === 'attribue')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  );
  let totalCA = $derived(recettesList.reduce((sum, r) => sum + r.credit, 0));

  let achatsList = $derived(
    structureTx
      .filter((/** @type {any} */ tx) => tx.debit > 0 && tx.statut === 'attribue')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  );
  let totalAchats = $derived(achatsList.reduce((sum, a) => sum + a.debit, 0));

  // Solde de trésorerie bancaire net (CA Encaissé - Achats réels)
  let soldeTresorerie = $derived(totalCA - totalAchats);

  // Estimations fiscales et sociales
  let urssafEstimee = $derived(totalCA * selectedRegime.rate);
  let resteNetReel = $derived(totalCA - urssafEstimee - totalAchats);
  let margeNettePct = $derived(totalCA > 0 ? Math.round((resteNetReel / totalCA) * 100) : 0);

  // Calculs franchise TVA et plafond micro
  let tvaProgressionPct = $derived(Math.min(100, Math.round((totalCA / selectedRegime.franchiseTVA) * 100)));
  let plafondProgressionPct = $derived(Math.min(100, Math.round((totalCA / selectedRegime.plafondCA) * 100)));

  // Découpage trimestriel du CA
  let caTrimestriel = $derived((() => {
    const quarters = {
      T1: { ca: 0, label: '1er Trimestre (Jan - Mar)' },
      T2: { ca: 0, label: '2ème Trimestre (Avr - Jun)' },
      T3: { ca: 0, label: '3ème Trimestre (Jul - Sep)' },
      T4: { ca: 0, label: '4ème Trimestre (Oct - Déc)' }
    };

    recettesList.forEach(r => {
      const month = new Date(r.date).getMonth() + 1;
      if (month <= 3) quarters.T1.ca += r.credit;
      else if (month <= 6) quarters.T2.ca += r.credit;
      else if (month <= 9) quarters.T3.ca += r.credit;
      else quarters.T4.ca += r.credit;
    });

    return quarters;
  })());

  function copierMontant(val) {
    navigator.clipboard.writeText(val.toFixed(2));
    showToast(`📋 Montant ${val.toFixed(2)} € copié pour votre déclaration Urssaf !`);
  }

  function exportRegistreAchatsCSV() {
    let csv = "N° Ordre;Date;Fournisseur / Libellé;Catégorie;Mode Règlement;Montant Décaissé (€)\n";
    achatsList.forEach((a, idx) => {
      csv += `${idx + 1};${new Date(a.date).toLocaleDateString('fr-FR')};"${a.libelle.replace(/"/g, '""')}";"${a.compteAttribué}";"${a.typeOperation || 'Carte / Virement'}";${a.debit.toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `REGISTRE_ACHATS_${activeEntity.name.replace(/\s+/g, '_')}_${new Date().getFullYear()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('🛒 Registre des Achats téléchargé avec succès !');
  }
</script>

<!-- Fine Discrete Contextual Tab Bar -->
<div style="display: flex; gap: 8px; border-bottom: 2px solid #e2e8f0; margin-bottom: 24px; padding-bottom: 2px;">
  <button 
    class="nav-tab-btn" 
    onclick={() => activeTab = 'ca'} 
    style="padding: 10px 18px; font-weight: 700; font-size: 0.9rem; background: transparent; border: none; border-bottom: 2.5px solid {activeTab === 'ca' ? '#0f172a' : 'transparent'}; color: {activeTab === 'ca' ? '#0f172a' : '#64748b'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; margin-bottom: -4px;"
  >
    <i class="fa-solid fa-chart-line" style="color: {activeTab === 'ca' ? '#0f172a' : '#64748b'};"></i> Suivi Chiffre d'Affaires & Urssaf
  </button>
  
  <button 
    class="nav-tab-btn" 
    onclick={() => activeTab = 'recettes'} 
    style="padding: 10px 18px; font-weight: 700; font-size: 0.9rem; background: transparent; border: none; border-bottom: 2.5px solid {activeTab === 'recettes' ? '#0f172a' : 'transparent'}; color: {activeTab === 'recettes' ? '#0f172a' : '#64748b'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; margin-bottom: -4px;"
  >
    <i class="fa-solid fa-book-journal-whills" style="color: {activeTab === 'recettes' ? '#0f172a' : '#64748b'};"></i> Livre des Recettes ({recettesList.length})
  </button>
  
  <button 
    class="nav-tab-btn" 
    onclick={() => activeTab = 'achats'} 
    style="padding: 10px 18px; font-weight: 700; font-size: 0.9rem; background: transparent; border: none; border-bottom: 2.5px solid {activeTab === 'achats' ? '#0f172a' : 'transparent'}; color: {activeTab === 'achats' ? '#0f172a' : '#64748b'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; margin-bottom: -4px;"
  >
    <i class="fa-solid fa-cart-shopping" style="color: {activeTab === 'achats' ? '#0f172a' : '#64748b'};"></i> Registre des Achats ({achatsList.length})
  </button>
</div>

<!-- ============================================== -->
<!-- 1. ONGLET SUIVI DU CA & DÉCLARATION URSSAF -->
<!-- ============================================== -->
{#if activeTab === 'ca'}
  <div style="display: flex; flex-direction: column; gap: 24px;">

    <!-- BANDEAU SÉLECTEUR DE RÉGIME ET TAUX URSSAF -->
    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 20px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
      <div>
        <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 800; color: #64748b; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">
          Activité micro-entrepreneur & Taux de cotisations
        </span>
        <div style="font-weight: 800; font-size: 1.05rem; color: #0f172a; font-family: var(--font-title);">
          Régime fiscal et social applicable à {activeEntity.name}
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 12px;">
        <label for="regime-select" style="font-size: 0.85rem; font-weight: 700; color: #334155;">Type d'activité :</label>
        <select 
          id="regime-select"
          bind:value={selectedRegimeKey}
          style="padding: 8px 14px; border-radius: 8px; border: 1.5px solid #cbd5e1; background: #f8fafc; font-weight: 700; font-size: 0.88rem; color: #0f172a; cursor: pointer;"
        >
          {#each Object.entries(REGIMES_URSSAF) as [key, r]}
            <option value={key}>{r.label} ({(r.rate * 100).toFixed(1)}%)</option>
          {/each}
        </select>
      </div>
    </div>

    <!-- 5 CARTES KPI SÉRÉNITÉ : DU BRUT AU NET EN POCHE -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px;">
      <KpiCard 
        label="CA Encaissé Net" 
        value={totalCA.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
        subtext="Facturé aux clients (ce que je vends)"
      />

      <KpiCard 
        label="Dépenses d'activité" 
        value={`-${totalAchats.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`} 
        subtext="Achats et frais pro décaissés"
      />

      <KpiCard 
        label="CA moins les dépenses" 
        value={soldeTresorerie.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
        subtext="Reste sur mes ventes avant Urssaf"
      />

      <KpiCard 
        label={`Charges Urssaf (${(selectedRegime.rate * 100).toFixed(1)}%)`} 
        value={`-${urssafEstimee.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`} 
        subtext="Cotisations sociales à régler"
      />

      <KpiCard 
        label="Reste Net Final" 
        value={resteNetReel.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} 
        subtext={`En poche après charges (${margeNettePct}% marge)`}
      />
    </div>

    <!-- BANDEAU FIL CONDUCTEUR : FORMULE DE TRÉSORERIE ÉTAPE PAR ÉTAPE -->
    <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; font-size: 0.88rem;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-calculator" style="color: #64748b;"></i>
        <span style="color: #475569; font-weight: 700;">Votre trésorerie étape par étape :</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; font-weight: 800; font-family: var(--font-title); flex-wrap: wrap;">
        <span style="color: #0f172a;" title="Facturé aux clients">{totalCA.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">(CA encaissé net)</span></span>
        <span style="color: #94a3b8;">−</span>
        <span style="color: #b91c1c;" title="Achats & frais d'activité">{totalAchats.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">(Dépenses)</span></span>
        <span style="color: #94a3b8;">=</span>
        <span style="color: #2563eb; background: #eff6ff; padding: 3px 8px; border-radius: 6px; border: 1px solid #bfdbfe;" title="Reste sur mes ventes avant Urssaf">{soldeTresorerie.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} <span style="font-size: 0.72rem; color: #1e40af; font-weight: 600;">(CA moins dépenses)</span></span>
        <span style="color: #94a3b8;">−</span>
        <span style="color: #ea580c;" title="Cotisations Urssaf à régler">{urssafEstimee.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">(Charges Urssaf)</span></span>
        <span style="color: #94a3b8;">=</span>
        <span style="color: #15803d; background: #f0fdf4; padding: 3px 8px; border-radius: 6px; border: 1px solid #bbf7d0;" title="Revenu net disponible en poche">{resteNetReel.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} <span style="font-size: 0.72rem; color: #166534; font-weight: 600;">(Reste net en poche)</span></span>
      </div>
    </div>

    <!-- DOUBLE JAUGES DE SURVEILLANCE : SEUIL TVA & PLAFOND MICRO -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px;">
      
      <!-- Jauge 1 : Franchise de TVA -->
      <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 22px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <h4 style="font-family: var(--font-title); font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">
              Franchise en base de TVA (art. 293 B)
            </h4>
            <p style="font-size: 0.8rem; color: #64748b; margin: 0;">
              Seuil limite : <strong>{selectedRegime.franchiseTVA.toLocaleString('fr-FR')} €</strong> / an
            </p>
          </div>
          <span style="background: {tvaProgressionPct < 85 ? '#f0fdf4' : '#fff7ed'}; color: {tvaProgressionPct < 85 ? '#15803d' : '#c2410c'}; font-size: 0.82rem; font-weight: 800; padding: 4px 10px; border-radius: 8px;">
            {tvaProgressionPct}%
          </span>
        </div>

        <div style="background: #f1f5f9; height: 10px; border-radius: 6px; overflow: hidden; margin-bottom: 12px;">
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

      <!-- Jauge 2 : Plafond du régime Micro -->
      <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 22px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <h4 style="font-family: var(--font-title); font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">
              Plafond statutaire Micro-entreprise
            </h4>
            <p style="font-size: 0.8rem; color: #64748b; margin: 0;">
              Plafond légal : <strong>{selectedRegime.plafondCA.toLocaleString('fr-FR')} €</strong> / an
            </p>
          </div>
          <span style="background: #f1f5f9; color: #334155; font-size: 0.82rem; font-weight: 800; padding: 4px 10px; border-radius: 8px;">
            {plafondProgressionPct}%
          </span>
        </div>

        <div style="background: #f1f5f9; height: 10px; border-radius: 6px; overflow: hidden; margin-bottom: 12px;">
          <div style="width: {plafondProgressionPct}%; height: 100%; background: #3b82f6; border-radius: 6px; transition: width 0.3s ease;"></div>
        </div>

        <p style="font-size: 0.82rem; color: #475569; margin: 0; line-height: 1.4;">
          <i class="fa-solid fa-shield-halved" style="color: #3b82f6;"></i> Il vous reste <strong>{Math.max(0, selectedRegime.plafondCA - totalCA).toLocaleString('fr-FR')} €</strong> de marge de chiffre d'affaires sous le régime micro.
        </p>
      </div>

    </div>

    <!-- TABLEAU RÉCAPITULATIF TRIMESTRIEL URSSAF -->
    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 12px;">
        <div>
          <h3 style="font-family: var(--font-title); font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">
            Déclarations Trimestrielles (Urssaf)
          </h3>
          <p style="font-size: 0.82rem; color: #64748b; margin: 0;">
            Montants précalculés prêts à être recopiés sur le portail autoentrepreneur.urssaf.fr.
          </p>
        </div>
      </div>

      <div class="table-container" style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
        <table class="custom-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 1.5px solid #e2e8f0;">
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
              <tr style="border-bottom: 1px solid #f1f5f9; background: #ffffff;">
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
                    style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #0f172a; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;"
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

<!-- ============================================== -->
<!-- 2. ONGLET LIVRE DES RECETTES -->
<!-- ============================================== -->
{:else if activeTab === 'recettes'}
  <LivreRecettes />

<!-- ============================================== -->
<!-- 3. ONGLET REGISTRE DES ACHATS -->
<!-- ============================================== -->
{:else if activeTab === 'achats'}
  <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 14px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="background: #0f172a; color: #ffffff; font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 6px;">
            Art. L123-28
          </span>
          <h3 style="font-family: var(--font-title); font-size: 1.15rem; color: #0f172a; margin: 0; font-weight: 800;">
            Registre Chronologique des Achats
          </h3>
        </div>
        <p style="font-size: 0.82rem; color: #64748b; margin: 0;">
          Obligatoire pour les activités d'achat/revente de marchandises et recommandé pour la traçabilité bancaire.
        </p>
      </div>

      <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; padding: 8px 16px; border-radius: 10px; text-align: right;">
          <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 800; color: #64748b; display: block;">Total Dépensé</span>
          <strong style="font-size: 1.25rem; color: #b91c1c; font-family: var(--font-title);">
            -{totalAchats.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </strong>
        </div>

        <button 
          class="btn btn-secondary" 
          onclick={exportRegistreAchatsCSV}
          style="background: #ffffff; border: 1.5px solid #cbd5e1; color: #0f172a; padding: 9px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;"
        >
          <i class="fa-solid fa-file-export"></i> Exporter CSV
        </button>
      </div>
    </div>

    <div class="table-container" style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
      <table class="custom-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f8fafc; border-bottom: 1.5px solid #e2e8f0;">
            <th style="padding: 12px 14px; text-align: left; font-size: 0.78rem; font-weight: 800; color: #475569; text-transform: uppercase;">N°</th>
            <th style="padding: 12px 14px; text-align: left; font-size: 0.78rem; font-weight: 800; color: #475569; text-transform: uppercase;">Date</th>
            <th style="padding: 12px 14px; text-align: left; font-size: 0.78rem; font-weight: 800; color: #475569; text-transform: uppercase;">Fournisseur / Tiers</th>
            <th style="padding: 12px 14px; text-align: left; font-size: 0.78rem; font-weight: 800; color: #475569; text-transform: uppercase;">Catégorie</th>
            <th style="padding: 12px 14px; text-align: left; font-size: 0.78rem; font-weight: 800; color: #475569; text-transform: uppercase;">Mode Règlement</th>
            <th style="padding: 12px 14px; text-align: right; font-size: 0.78rem; font-weight: 800; color: #475569; text-transform: uppercase;">Montant Dépensé</th>
          </tr>
        </thead>
        <tbody>
          {#if achatsList.length === 0}
            <tr>
              <td colspan="6" style="text-align: center; color: #64748b; padding: 36px;">
                Aucun achat enregistré. Attribuez vos dépenses dans le relevé bancaire pour remplir ce registre.
              </td>
            </tr>
          {:else}
            {#each achatsList as a, idx}
              <tr style="border-bottom: 1px solid #f1f5f9; background: #ffffff;">
                <td style="padding: 11px 14px; color: #64748b; font-size: 0.82rem; font-weight: 700;">#{idx + 1}</td>
                <td style="padding: 11px 14px; font-weight: 700; color: #0f172a; font-size: 0.88rem;">{new Date(a.date).toLocaleDateString('fr-FR')}</td>
                <td style="padding: 11px 14px; color: #0f172a; font-weight: 700; font-size: 0.88rem;">{a.libelle}</td>
                <td style="padding: 11px 14px;"><span class="badge badge-muted" style="background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">{a.compteAttribué}</span></td>
                <td style="padding: 11px 14px; font-size: 0.82rem; color: #64748b;">{a.typeOperation || 'Carte / Virement'}</td>
                <td style="padding: 11px 14px; text-align: right; color: #b91c1c; font-weight: 800; font-size: 0.95rem; font-family: var(--font-title);">
                  -{a.debit.toFixed(2)} €
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
{/if}
