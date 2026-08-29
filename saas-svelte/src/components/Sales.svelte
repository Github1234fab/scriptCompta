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

<div class="page-title-section">
  <h1 class="page-title">Gestion de la Boutique & Stocks</h1>
  <p class="page-subtitle">Suivez vos ventes annexes, l'inventaire physique et vos marges commerciales.</p>
</div>

<div style="display: grid; grid-template-columns: 2fr 1fr; gap: 30px;">
  
  <!-- Products list -->
  <div class="glass-card">
    <h3 style="font-family: var(--font-title); margin-bottom: 20px;">Inventaire & Stocks</h3>
    
    <div class="table-container">
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
                <td style="color: white; font-weight: 600;">{p.nom}</td>
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
                  <button class="btn btn-success btn-sm" onclick={() => vendreUn(p)} disabled={p.stock <= 0}>Vendre 1</button>
                  <button class="btn btn-secondary btn-sm" onclick={() => reapprovisionner(p)} style="margin-left: 5px;">+5</button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Add Product Form -->
  <div class="glass-card">
    <h3 style="font-family: var(--font-title); margin-bottom: 20px;">Ajouter un produit</h3>
    <form onsubmit={handleSubmit}>
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
      <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center;">
        <i class="fa-solid fa-plus"></i> Ajouter à la boutique
      </button>
    </form>
  </div>

</div>
