<script>
  import { transactions, activeEntityId, entities, showToast } from '../lib/store.js';

  let activeEntity = $derived($entities.find((/** @type {any} */ e) => e.id === $activeEntityId) || $entities[0] || { name: 'Ma Structure' });

  // Recettes d'encaissement pur (crédits attribués) filtrées pour l'entité active
  let recettesLégales = $derived(
    $transactions
      .filter(tx => (!tx.entityId || tx.entityId === $activeEntityId) && tx.credit > 0 && tx.statut === 'attribue')
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

<div class="page-title-section" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 15px; margin-bottom: 20px;">
  <div>
    <h2 style="font-family: var(--font-title); font-size: 1.35rem; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">Livre des Recettes (Obligation Légale)</h2>
    <p style="font-size: 0.85rem; color: #64748b; margin: 0;">Registre officiel chronologique et immuable de vos encaissements pour la déclaration Urssaf.</p>
  </div>
  <button class="btn btn-primary" onclick={exporterLivreRecettes} style="background: #0f172a; color: #ffffff; border: none; padding: 10px 18px; font-weight: 700; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
    <i class="fa-solid fa-file-export"></i> Exporter le Livre des Recettes (CSV Légal)
  </button>
</div>

<!-- BANDEAU PÉDAGOGIQUE LÉGAL -->
<div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px; display: flex; gap: 16px; align-items: flex-start;">
  <div style="font-size: 1.6rem; line-height: 1;">⚖️</div>
  <div style="flex: 1;">
    <h4 style="margin: 0 0 6px 0; font-size: 0.95rem; font-weight: 800; color: #1e3a8a;">Ce que dit la loi pour les micro-entreprises :</h4>
    <p style="margin: 0; font-size: 0.84rem; color: #1e40af; line-height: 1.5;">
      Le <strong>Livre des recettes</strong> est le registre obligatoire exigé par l'Urssaf et l'administration fiscale (art. L123-28 du Code de commerce). Il récapitule chronologiquement chaque encaissement réel avec son origine, son montant et le mode de règlement. Grâce à notre moteur de tri bancaire, ce registre est généré d'office et mis à jour en temps réel sans aucune double saisie !
    </p>
  </div>
</div>

<!-- CARTE DU LIVRE OFFICIEL -->
<div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 30px;">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 14px;">
    <div>
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
        <span style="background: #0f172a; color: #ffffff; font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px;">
          <i class="fa-solid fa-check" style="color: #38bdf8;"></i> Immuable
        </span>
        <h3 style="font-family: var(--font-title); font-size: 1.15rem; color: #0f172a; margin: 0; font-weight: 800;">Registre Chronologique des Encaissements</h3>
      </div>
      <p style="font-size: 0.82rem; color: #64748b; margin: 0;">Structure : <strong style="color: #0f172a;">{activeEntity.name}</strong></p>
    </div>
    
    <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; padding: 8px 18px; border-radius: 10px; text-align: right;">
      <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 800; color: #16a34a; display: block;">Chiffre d'Affaires Encaissé Total</span>
      <strong style="font-size: 1.35rem; color: #15803d; font-family: var(--font-title);">
        {totalCAEncaissé.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </strong>
    </div>
  </div>

  <div class="table-container" style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
    <table class="custom-table" style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #f8fafc; border-bottom: 1.5px solid #e2e8f0;">
          <th style="padding: 12px 14px; text-align: left; font-size: 0.78rem; font-weight: 800; color: #475569; text-transform: uppercase;">N° Ordre</th>
          <th style="padding: 12px 14px; text-align: left; font-size: 0.78rem; font-weight: 800; color: #475569; text-transform: uppercase;">Date Encaissement</th>
          <th style="padding: 12px 14px; text-align: left; font-size: 0.78rem; font-weight: 800; color: #475569; text-transform: uppercase;">Référence</th>
          <th style="padding: 12px 14px; text-align: left; font-size: 0.78rem; font-weight: 800; color: #475569; text-transform: uppercase;">Client / Origine</th>
          <th style="padding: 12px 14px; text-align: left; font-size: 0.78rem; font-weight: 800; color: #475569; text-transform: uppercase;">Nature</th>
          <th style="padding: 12px 14px; text-align: left; font-size: 0.78rem; font-weight: 800; color: #475569; text-transform: uppercase;">Mode Règlement</th>
          <th style="padding: 12px 14px; text-align: right; font-size: 0.78rem; font-weight: 800; color: #475569; text-transform: uppercase;">Montant Encaissé</th>
        </tr>
      </thead>
      <tbody>
        {#if recettesLégales.length === 0}
          <tr>
            <td colspan="7" style="text-align: center; color: #64748b; padding: 36px;">
              Aucun encaissement validé dans le registre. Importez votre relevé et attribuez des recettes pour alimenter ce livre automatiquement.
            </td>
          </tr>
        {:else}
          {#each recettesLégales as r}
            <tr style="border-bottom: 1px solid #f1f5f9; background: #ffffff;">
              <td style="padding: 11px 14px; color: #64748b; font-size: 0.82rem; font-weight: 700;">#{r.numeroOrdre.toString().padStart(3, '0')}</td>
              <td style="padding: 11px 14px; font-weight: 700; color: #0f172a; font-size: 0.88rem;">{new Date(r.date).toLocaleDateString('fr-FR')}</td>
              <td style="padding: 11px 14px; font-family: monospace; font-size: 0.8rem; color: #2563eb;">{r.reference}</td>
              <td style="padding: 11px 14px; color: #0f172a; font-weight: 700; font-size: 0.88rem;">{r.client}</td>
              <td style="padding: 11px 14px;"><span class="badge badge-muted" style="background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">{r.nature}</span></td>
              <td style="padding: 11px 14px; font-size: 0.82rem; color: #64748b;">{r.modePaiement}</td>
              <td style="padding: 11px 14px; text-align: right; color: #15803d; font-weight: 800; font-size: 0.95rem; font-family: var(--font-title);">
                +{r.montant.toFixed(2)} €
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
