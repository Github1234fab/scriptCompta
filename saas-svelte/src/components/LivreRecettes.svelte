<script>
  import { transactions, activeEntityId, entities, showToast } from '../lib/store.js';

  let activeEntity = $derived($entities.find(e => e.id === $activeEntityId) || $entities[0]);

  // Recettes de encaissement pur (crédits attribués)
  let recettesLégales = $derived(
    $transactions
      .filter(tx => tx.credit > 0 && tx.statut === 'attribue')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) // Chronologique obligatoire
      .map((tx, index) => ({
        numeroOrdre: index + 1,
        date: tx.date,
        reference: tx.reference || `REC-${1000 + index}`,
        client: tx.libelle,
        nature: tx.compteAttribué === '756' ? 'Adhésion' : (tx.compteAttribué === '758' ? 'Don / Mécénat' : 'Vente / Prestation'),
        montant: tx.credit,
        modePaiement: tx.typeOperation || 'Virement bancaire'
      }))
  );

  let totalCAEncaissé = $derived(recettesLégales.reduce((sum, r) => sum + r.montant, 0));

  function exporterLivreRecettes() {
    let csvContent = "data:text/csv;charset=utf-8,N° Ordre;Date Encaissement;Référence;Client / Origine;Nature;Montant (€);Mode de Règlement\n";
    recettesLégales.forEach(r => {
      csvContent += `${r.numeroOrdre};${new Date(r.date).toLocaleDateString('fr-FR')};"${r.reference}";"${r.client.replace(/"/g, '""')}";"${r.nature}";${r.montant.toFixed(2)};"${r.modePaiement}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Livre_des_Recettes_${activeEntity.name.replace(/\s+/g, '_')}_${new Date().getFullYear()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('📜 Export du Livre des Recettes (horodaté) téléchargé !');
  }
</script>

<div class="page-title-section" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 15px;">
  <div>
    <h1 class="page-title">Livre des Recettes (Obligation Légale)</h1>
    <p class="page-subtitle">Registre officiel chronologique et immuable de vos encaissements pour la déclaration Urssaf.</p>
  </div>
  <button class="btn btn-primary" onclick={exporterLivreRecettes}>
    <i class="fa-solid fa-file-export"></i> Exporter le Livre des Recettes (CSV Légal)
  </button>
</div>

<div class="pedago-banner" style="margin-bottom: 25px;">
  <div class="pedago-banner-icon">⚖️</div>
  <div class="pedago-banner-text">
    <h4>Ce que dit la loi pour les micro-entreprises :</h4>
    <p>Le <strong>Livre des recettes</strong> est le registre obligatoire exigé par l'Urssaf et l'administration fiscale. Il doit récapituler chronologiquement chaque encaissement réel avec son origine, son montant et le mode de règlement. Grâce à notre moteur de tri bancaire, ce registre est généré d'office et mis à jour en temps réel sans aucune double saisie !</p>
  </div>
</div>

<div class="glass-card" style="margin-bottom: 30px;">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
    <div>
      <h3 style="font-family: var(--font-title); font-size: 1.1rem; color: white;">Registre Chronologique des Encaissements</h3>
      <p style="font-size: 0.82rem; color: var(--text-secondary);">Structure : <strong>{activeEntity.name}</strong></p>
    </div>
    <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 8px 16px; border-radius: var(--radius-sm); text-align: right;">
      <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #34d399; display: block;">Chiffre d'Affaires Encaissé Total</span>
      <strong style="font-size: 1.3rem; color: #34d399; font-family: var(--font-title);">
        {totalCAEncaissé.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </strong>
    </div>
  </div>

  <div class="table-container">
    <table class="custom-table">
      <thead>
        <tr>
          <th>N° Ordre</th>
          <th>Date Encaissement</th>
          <th>Référence</th>
          <th>Client / Origine</th>
          <th>Nature</th>
          <th>Mode Règlement</th>
          <th style="text-align: right;">Montant Encaissé</th>
        </tr>
      </thead>
      <tbody>
        {#if recettesLégales.length === 0}
          <tr>
            <td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 30px;">
              Aucun encaissement validé dans le registre. Importez votre relevé et attribuez des recettes pour alimenter ce livre automatiquement.
            </td>
          </tr>
        {:else}
          {#each recettesLégales as r}
            <tr>
              <td style="color: var(--text-muted); font-size: 0.8rem;">#{r.numeroOrdre.toString().padStart(3, '0')}</td>
              <td style="font-weight: 600;">{new Date(r.date).toLocaleDateString('fr-FR')}</td>
              <td style="font-family: monospace; font-size: 0.8rem; color: #a5b4fc;">{r.reference}</td>
              <td style="color: white; font-weight: 600;">{r.client}</td>
              <td><span class="badge badge-muted">{r.nature}</span></td>
              <td style="font-size: 0.85rem; color: var(--text-secondary);">{r.modePaiement}</td>
              <td style="text-align: right; color: #34d399; font-weight: 700; font-family: var(--font-title);">
                +{r.montant.toFixed(2)} €
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
