<script>
  import { transactions, updateTransactions, showToast, activeEntityId, entities } from '../lib/store.js';

  let activeEntity = $derived($entities.find(e => e.id === $activeEntityId) || $entities[0]);

  let debits = $derived($transactions.filter(tx => tx.debit > 0 && tx.statut === 'attribue'));
  let totalDebitsCount = $derived(debits.length);

  let piecesManquantes = $derived(debits.filter(tx => !tx.factureUrl));
  let justificatifsPresentsCount = $derived(totalDebitsCount - piecesManquantes.length);
  let scoreConformite = $derived(totalDebitsCount > 0 ? Math.round((justificatifsPresentsCount / totalDebitsCount) * 100) : 100);

  function joindreFichier(txId, e) {
    const file = e.target.files[0];
    if (!file) return;

    const fakeUrl = URL.createObjectURL(file);
    const updated = $transactions.map(t => {
      if (t.id === txId) {
        return {
          ...t,
          factureUrl: fakeUrl,
          factureNom: file.name
        };
      }
      return t;
    });

    updateTransactions(updated);
    showToast(`📎 Justificatif "${file.name}" rattaché à l'opération !`);
  }

  function exporterArchiveComptable() {
    let csvContent = "data:text/csv;charset=utf-8,Date;Libellé;Montant (€);Compte Comptable;Justificatif Rattaché\n";
    debits.forEach(tx => {
      csvContent += `${new Date(tx.date).toLocaleDateString('fr-FR')};"${tx.libelle.replace(/"/g, '""')}";-${tx.debit.toFixed(2)};"${tx.compteAttribué}";"${tx.factureNom || 'NON'}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Export_Précomptable_${activeEntity.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('📂 Export des écritures pré-comptables téléchargé !');
  }
</script>

<div class="page-title-section" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 15px;">
  <div>
    <h1 class="page-title">Boîte à Justificatifs (Pièces Manquantes)</h1>
    <p class="page-subtitle">Rapprochez vos dépenses bancaires de leurs factures pour être 100% en règle en cas de contrôle.</p>
  </div>
  <button class="btn btn-primary" onclick={exporterArchiveComptable}>
    <i class="fa-solid fa-paper-plane"></i> Transmettre à mon comptable (Export FEC / CSV)
  </button>
</div>

<!-- Score de conformité -->
<div class="glass-card" style="margin-bottom: 25px; border-left: 4px solid {scoreConformite >= 90 ? '#10b981' : (scoreConformite >= 70 ? '#f59e0b' : '#ef4444')};">
  <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;">
    <div>
      <span style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted);">Score de conformité fiscale</span>
      <h2 style="font-family: var(--font-title); font-size: 1.8rem; color: white; margin-top: 4px;">
        {scoreConformite}% <span style="font-size: 1rem; font-weight: normal; color: var(--text-secondary);">de vos dépenses sont justifiées</span>
      </h2>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">
        {piecesManquantes.length === 0 ? '🎉 Bravo ! Toutes vos dépenses bancaires ont un justificatif rattaché.' : `⚠️ Il vous reste ${piecesManquantes.length} pièce(s) manquante(s) à glisser-déposer ci-dessous.`}
      </p>
    </div>
    
    <div style="min-width: 200px;">
      <div class="progress-bar-container" style="margin-bottom: 6px;">
        <div class="progress-bar-fill" style="width: {scoreConformite}%; background: {scoreConformite >= 90 ? '#10b981' : (scoreConformite >= 70 ? '#f59e0b' : '#ef4444')};"></div>
      </div>
      <span style="font-size: 0.75rem; color: var(--text-secondary); display: block; text-align: right;">{justificatifsPresentsCount} / {totalDebitsCount} factures jointes</span>
    </div>
  </div>
</div>

<!-- Liste des pièces manquantes -->
<div class="glass-card">
  <h3 style="font-family: var(--font-title); margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
    <i class="fa-solid fa-receipt" style="color: var(--color-warning);"></i> Débits bancaires en attente de reçu ({piecesManquantes.length})
  </h3>

  <div class="table-container">
    <table class="custom-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Libellé de la dépense</th>
          <th>Catégorie</th>
          <th>Montant</th>
          <th>Justificatif / Reçu</th>
        </tr>
      </thead>
      <tbody>
        {#if piecesManquantes.length === 0}
          <tr>
            <td colspan="5" style="text-align: center; color: var(--color-success); padding: 30px;">
              <i class="fa-solid fa-circle-check" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.8; display: block;"></i>
              Aucun justificatif manquant ! Votre boîte à reçus est parfaitement propre.
            </td>
          </tr>
        {:else}
          {#each piecesManquantes as tx}
            <tr>
              <td style="font-weight: 600;">{new Date(tx.date).toLocaleDateString('fr-FR')}</td>
              <td style="color: white; font-weight: 600;">{tx.libelle}</td>
              <td><span class="badge badge-muted">{tx.compteAttribué || '699'}</span></td>
              <td class="amount debit">-{tx.debit.toFixed(2)} €</td>
              <td>
                <label class="btn btn-secondary btn-sm" style="margin: 0; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;">
                  <i class="fa-solid fa-paperclip"></i> Joindre reçu (PDF/Image)
                  <input type="file" onchange={(e) => joindreFichier(tx.id, e)} accept=".pdf,.png,.jpg,.jpeg" style="display: none;">
                </label>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
