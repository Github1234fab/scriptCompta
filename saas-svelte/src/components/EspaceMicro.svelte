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

<!-- Fine Discrete Contextual Tab Bar -->
<div style="display: flex; gap: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.12); margin-bottom: 20px; padding-bottom: 2px;">
  <button 
    class="nav-tab-btn" 
    onclick={() => activeTab = 'ca'} 
    style="padding: 8px 16px; font-weight: 600; font-size: 0.9rem; background: transparent; border: none; border-bottom: 2px solid {activeTab === 'ca' ? '#34d399' : 'transparent'}; color: {activeTab === 'ca' ? '#ffffff' : 'rgba(255,255,255,0.6)'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; margin-bottom: -3px;"
  >
    <i class="fa-solid fa-chart-line" style="color: {activeTab === 'ca' ? '#34d399' : 'inherit'};"></i> Suivi du Chiffre d'Affaires & Urssaf
  </button>
  
  <button 
    class="nav-tab-btn" 
    onclick={() => activeTab = 'recettes'} 
    style="padding: 8px 16px; font-weight: 600; font-size: 0.9rem; background: transparent; border: none; border-bottom: 2px solid {activeTab === 'recettes' ? '#34d399' : 'transparent'}; color: {activeTab === 'recettes' ? '#ffffff' : 'rgba(255,255,255,0.6)'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; margin-bottom: -3px;"
  >
    <i class="fa-solid fa-book-journal-whills" style="color: {activeTab === 'recettes' ? '#34d399' : 'inherit'};"></i> Livre des Recettes
  </button>
  
  <button 
    class="nav-tab-btn" 
    onclick={() => activeTab = 'achats'} 
    style="padding: 8px 16px; font-weight: 600; font-size: 0.9rem; background: transparent; border: none; border-bottom: 2px solid {activeTab === 'achats' ? '#34d399' : 'transparent'}; color: {activeTab === 'achats' ? '#ffffff' : 'rgba(255,255,255,0.6)'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; margin-bottom: -3px;"
  >
    <i class="fa-solid fa-cart-shopping" style="color: {activeTab === 'achats' ? '#34d399' : 'inherit'};"></i> Registre des Achats ({achatsList.length})
  </button>
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
