<script>
  import { 
    products, 
    transactions, 
    updateProducts, 
    updateTransactions, 
    showToast 
  } from '../lib/store.js';
  import { Categorizer } from '../lib/categorizer.js';

  let nom = $state('');
  let prixAchat = $state('');
  let prixVente = $state('');
  let stockInitial = $state('');

  function vendreUn(p) {
    if (p.stock <= 0) return;

    // 1. Decrement stock
    const list = $products.map(item => {
      if (item.id === p.id) {
        return { ...item, stock: item.stock - 1 };
      }
      return item;
    });
    updateProducts(list);

    // 2. Create receipt transaction
    const nouvelleTx = {
      id: 'tx-boutique-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      libelle: `STRIPE PAIEMENT BOUTIQUE - Vente ${p.nom}`,
      info: 'Vente boutique automatique',
      debit: 0,
      credit: p.prixVente,
      compteAttribué: null,
      regleAppliquee: null,
      statut: 'non_attribue'
    };

    const merged = [nouvelleTx, ...$transactions];
    const categorized = Categorizer.categoriserTransactions(merged);
    updateTransactions(categorized);

    showToast(`🛒 Vente enregistrée ! ${p.nom} débité du stock.`);
  }

  function reapprovisionner(p) {
    // 1. Increment stock by 5
    const list = $products.map(item => {
      if (item.id === p.id) {
        return { ...item, stock: item.stock + 5 };
      }
      return item;
    });
    updateProducts(list);

    // 2. Create expense transaction
    const nouvelleTx = {
      id: 'tx-achat-stock-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      libelle: `ACHAT FOURNISSEUR STOCK - Réapprovisionnement 5x ${p.nom}`,
      info: 'Achat de marchandises',
      debit: p.prixAchat * 5,
      credit: 0,
      compteAttribué: null,
      regleAppliquee: null,
      statut: 'non_attribue'
    };

    const merged = [nouvelleTx, ...$transactions];
    const categorized = Categorizer.categoriserTransactions(merged);
    updateTransactions(categorized);

    showToast(`📦 Stock augmenté de 5 unités pour : ${p.nom}.`);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!nom || !prixAchat || !prixVente || !stockInitial) return;

    const nouveau = {
      id: 'prod-' + Date.now(),
      nom,
      prixAchat: parseFloat(prixAchat) || 0,
      prixVente: parseFloat(prixVente) || 0,
      stock: parseInt(stockInitial) || 0
    };

    updateProducts([...$products, nouveau]);
    nom = '';
    prixAchat = '';
    prixVente = '';
    stockInitial = '';
    showToast('✅ Produit ajouté au catalogue boutique !');
  }
</script>

<div style="margin-bottom: 20px;">
  <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: var(--text-main); font-family: var(--font-title, sans-serif);">
    Registre des Ventes, Billetterie & Boutique (Comptes 707 & 708)
  </h2>
  <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-muted);">
    Suivez vos ventes annexes, l'inventaire physique et vos marges commerciales.
  </p>
</div>

<div class="sales-grid">
  
  <!-- Products list / cards -->
  <div class="glass-card sales-card">
    <div class="sales-card-header">
      <h3 style="font-family: var(--font-title); margin: 0; font-size: 1.1rem; color: var(--text-main);">
        Inventaire & Stocks
      </h3>
      <span class="sales-count-badge">{$products.length} référence{$products.length > 1 ? 's' : ''}</span>
    </div>
    
    <!-- Desktop Table -->
    <div class="products-desktop-table table-container">
      <table class="custom-table" id="products-table">
        <thead>
          <tr>
            <th>Désignation Article</th>
            <th>Prix Achat</th>
            <th>Prix Vente</th>
            <th>Stock Actuel</th>
            <th>Marge Unitaire</th>
            <th>Actions de simulation</th>
          </tr>
        </thead>
        <tbody>
          {#if $products.length === 0}
            <tr>
              <td colspan="6" style="text-align: center; color: var(--text-secondary);">Aucun produit en stock.</td>
            </tr>
          {:else}
            {#each $products as p}
              <tr>
                <td style="color: var(--text-main); font-weight: 600;">{p.nom}</td>
                <td class="amount">{p.prixAchat.toFixed(2)} €</td>
                <td class="amount">{p.prixVente.toFixed(2)} €</td>
                <td style="font-weight: 700;">
                  {p.stock} unités
                  {#if p.stock < 5}
                    <span class="badge badge-danger" style="margin-left: 8px;">Critique</span>
                  {/if}
                </td>
                <td class="amount credit">{(p.prixVente - p.prixAchat).toFixed(2)} €</td>
                <td>
                  <button class="btn btn-cta-sales btn-sm" onclick={() => vendreUn(p)} disabled={p.stock <= 0}>Vendre 1</button>
                  <button class="btn btn-secondary btn-sm" onclick={() => reapprovisionner(p)} style="margin-left: 5px;">+5</button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Mobile Cards -->
    <div class="products-mobile-cards">
      {#if $products.length === 0}
        <div class="products-empty-card">
          <i class="fa-solid fa-box-open" style="font-size: 1.6rem; color: var(--text-muted); opacity: 0.6; margin-bottom: 8px;"></i>
          <p style="margin: 0; font-size: 0.86rem; color: var(--text-muted);">Aucun produit en stock.</p>
        </div>
      {:else}
        <div class="products-cards-list">
          {#each $products as p}
            <div class="product-card-item">
              <div class="product-card-top">
                <div class="product-title-row">
                  <span class="product-card-name">{p.nom}</span>
                  <div class="product-stock-pill {p.stock < 5 ? 'is-low' : ''}">
                    <i class="fa-solid fa-boxes-stacked" style="font-size: 0.72rem;"></i>
                    <span>{p.stock} en stock</span>
                    {#if p.stock < 5}
                      <span class="badge badge-danger" style="font-size: 0.65rem; padding: 1px 5px; margin-left: 2px;">Critique</span>
                    {/if}
                  </div>
                </div>
              </div>

              <!-- Price & Margin chips -->
              <div class="product-financials-row">
                <div class="financial-chip">
                  <span class="chip-label">Achat</span>
                  <span class="chip-value">{p.prixAchat.toFixed(2)} €</span>
                </div>
                <div class="financial-chip">
                  <span class="chip-label">Vente</span>
                  <span class="chip-value">{p.prixVente.toFixed(2)} €</span>
                </div>
                <div class="financial-chip is-margin">
                  <span class="chip-label">Marge</span>
                  <span class="chip-value credit">+{(p.prixVente - p.prixAchat).toFixed(2)} €</span>
                </div>
              </div>

              <!-- Action buttons -->
              <div class="product-card-actions">
                <button 
                  type="button"
                  class="btn btn-cta-sales btn-sm flex-1" 
                  onclick={() => vendreUn(p)} 
                  disabled={p.stock <= 0}
                >
                  <i class="fa-solid fa-cart-shopping"></i> Vendre 1
                </button>
                <button 
                  type="button"
                  class="btn btn-secondary btn-sm" 
                  onclick={() => reapprovisionner(p)}
                >
                  <i class="fa-solid fa-plus"></i> +5 stock
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Add Product Form -->
  <div class="glass-card sales-form-card">
    <h3 style="font-family: var(--font-title); margin: 0 0 16px 0; font-size: 1.1rem; color: var(--text-main);">
      Ajouter un produit
    </h3>
    <form onsubmit={handleSubmit} class="sales-form">
      <div class="form-group">
        <label for="product-name" class="form-label">Désignation de l'article</label>
        <input type="text" id="product-name" class="form-control" bind:value={nom} required placeholder="ex: Clavier d'apprentissage">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="product-buy-price" class="form-label">Prix Achat (€)</label>
          <input type="number" step="0.01" id="product-buy-price" class="form-control" bind:value={prixAchat} required placeholder="ex: 8.50">
        </div>
        <div class="form-group">
          <label for="product-sell-price" class="form-label">Prix Vente (€)</label>
          <input type="number" step="0.01" id="product-sell-price" class="form-control" bind:value={prixVente} required placeholder="ex: 20.00">
        </div>
      </div>
      <div class="form-group">
        <label for="product-stock" class="form-label">Stock Initial (Unités)</label>
        <input type="number" id="product-stock" class="form-control" bind:value={stockInitial} required placeholder="ex: 15">
      </div>
      <button type="submit" class="btn btn-cta-sales" style="width: 100%; justify-content: center; margin-top: 6px;">
        <i class="fa-solid fa-plus"></i> Ajouter à la boutique
      </button>
    </form>
  </div>

</div>

<style>
  .sales-grid {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 24px;
    align-items: start;
    width: 100%;
    box-sizing: border-box;
  }
  .sales-card,
  .sales-form-card {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
  }
  .sales-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 18px;
    gap: 10px;
  }
  .sales-count-badge {
    background: rgba(37, 99, 235, 0.12);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.25);
    font-size: 0.75rem;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
  }
  .products-desktop-table {
    display: block;
    width: 100%;
    overflow-x: auto;
  }
  .products-mobile-cards {
    display: none;
    width: 100%;
  }
  .sales-form .form-group {
    margin-bottom: 14px;
  }
  .sales-form .form-label {
    display: block;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }
  .sales-form .form-control {
    width: 100%;
    box-sizing: border-box;
  }
  .sales-form .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  @media (max-width: 900px) {
    .sales-grid {
      grid-template-columns: 1fr !important;
      gap: 18px !important;
    }
  }

  @media (max-width: 768px) {
    .sales-card,
    .sales-form-card {
      padding: 16px 14px !important;
      border-radius: 14px !important;
    }
    .products-desktop-table {
      display: none !important;
    }
    .products-mobile-cards {
      display: block !important;
    }
    .products-cards-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .product-card-item {
      background: var(--bg-card, #ffffff);
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 12px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }
    .product-title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
    }
    .product-card-name {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text-main);
      line-height: 1.3;
    }
    .product-stock-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 0.74rem;
      font-weight: 600;
      background: var(--bg-subtle, rgba(255, 255, 255, 0.06));
      color: var(--text-secondary);
      border: 1px solid var(--border-color);
      white-space: nowrap;
      flex-shrink: 0;
    }
    .product-stock-pill.is-low {
      border-color: rgba(239, 68, 68, 0.4);
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }
    .product-financials-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1.2fr;
      gap: 8px;
      background: var(--bg-subtle, rgba(0, 0, 0, 0.03));
      border: 1px solid var(--border-color, rgba(226, 232, 240, 0.5));
      border-radius: 8px;
      padding: 8px 10px;
    }
    .financial-chip {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .financial-chip .chip-label {
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      font-weight: 600;
    }
    .financial-chip .chip-value {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .financial-chip.is-margin .chip-value {
      color: #10b981;
    }
    .product-card-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .flex-1 {
      flex: 1;
    }
    .products-empty-card {
      text-align: center;
      padding: 24px 16px;
      background: var(--bg-card);
      border: 1px dashed var(--border-color);
      border-radius: 12px;
    }
  }

  @media (max-width: 480px) {
    .sales-form .form-row {
      grid-template-columns: 1fr !important;
      gap: 0 !important;
    }
  }
</style>
