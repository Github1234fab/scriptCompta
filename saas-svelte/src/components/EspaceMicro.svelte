<script>
  import LivreRecettes from './LivreRecettes.svelte';
  import { transactions } from '../lib/store.js';

  let activeTab = $state('recettes'); // 'recettes' or 'achats'

  let achatsList = $derived(
    $transactions
      .filter((/** @type {any} */ tx) => tx.debit > 0 && tx.statut === 'attribue')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  );
  let totalAchats = $derived(achatsList.reduce((sum, a) => sum + a.debit, 0));
</script>

<div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.06), rgba(15, 23, 42, 0.95)); border: 1px solid rgba(52, 211, 153, 0.3); border-radius: var(--radius-lg); padding: 24px; margin-bottom: 25px;">
  <div class="page-title-section" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 15px; margin-bottom: 0;">
    <div>
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
        <span class="badge" style="font-size: 0.8rem; padding: 4px 12px; background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.4);">🚀 ESPACE SUR-MESURE MICRO-ENTREPRISE</span>
      </div>
      <h1 class="page-title" style="margin-bottom: 0; color: white;">Espace Micro-Entreprise & Freelance</h1>
      <p class="page-subtitle" style="color: rgba(255,255,255,0.7);">Gestion simplifiée de vos encaissements et registres d'exploitation.</p>
    </div>

    <div style="display: flex; gap: 10px;">
      <button class="btn {activeTab === 'recettes' ? 'btn-primary' : 'btn-secondary'}" onclick={() => activeTab = 'recettes'} style="border-color: #34d399;">
        <i class="fa-solid fa-book-journal-whills"></i> Livre des recettes (Légal)
      </button>
      <button class="btn {activeTab === 'achats' ? 'btn-primary' : 'btn-secondary'}" onclick={() => activeTab = 'achats'}>
        <i class="fa-solid fa-cart-shopping"></i> Registre des achats ({achatsList.length})
      </button>
    </div>
  </div>
</div>

{#if activeTab === 'recettes'}
  <LivreRecettes />
{:else}
  <div class="glass-card" style="border: 1px solid rgba(52, 211, 153, 0.3);">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <div>
        <h3 style="font-family: var(--font-title); font-size: 1.1rem; color: white;">Registre Chronologique des Achats</h3>
        <p style="font-size: 0.82rem; color: var(--text-secondary);">Obligation légale pour les activités d'achat/revente de marchandises.</p>
      </div>
      <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 8px 16px; border-radius: var(--radius-sm); text-align: right;">
        <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #f87171; display: block;">Total Achats d'Exploitation</span>
        <strong style="font-size: 1.3rem; color: #f87171; font-family: var(--font-title);">
          -{totalAchats.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </strong>
      </div>
    </div>

    <div class="table-container">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Fournisseur / Libellé</th>
            <th>Catégorie</th>
            <th>Mode Règlement</th>
            <th style="text-align: right;">Montant Dépensé</th>
          </tr>
        </thead>
        <tbody>
          {#if achatsList.length === 0}
            <tr>
              <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 30px;">
                Aucun achat enregistré. Attribuez vos dépenses dans le relevé bancaire.
              </td>
            </tr>
          {:else}
            {#each achatsList as a}
              <tr>
                <td style="font-weight: 600;">{new Date(a.date).toLocaleDateString('fr-FR')}</td>
                <td style="color: white; font-weight: 600;">{a.libelle}</td>
                <td><span class="badge badge-muted">{a.compteAttribué}</span></td>
                <td style="font-size: 0.85rem; color: var(--text-secondary);">{a.typeOperation || 'Carte / Virement'}</td>
                <td style="text-align: right; color: #f87171; font-weight: 700; font-family: var(--font-title);">
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
