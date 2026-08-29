<script>
  import { 
    members, 
    updateMembers, 
    showToast 
  } from '../lib/store.js';

  let nom = $state('');
  let email = $state('');
  let forfait = $state('');

  // Svelte 5 reactive declarations to compute student financials
  let report = $derived($members.map(m => {
    const resteAPayer = m.forfait - m.dejaPaye;
    let statut = 'Payé';
    let badgeClass = 'badge-success';

    if (resteAPayer > 0) {
      statut = m.dejaPaye > 0 ? 'Partiel' : 'Impayé';
      badgeClass = m.dejaPaye > 0 ? 'badge-warning' : 'badge-danger';
    } else if (resteAPayer < 0) {
      statut = 'Trop perçu';
      badgeClass = 'badge-muted';
    }

    return {
      ...m,
      resteAPayer,
      statut,
      badgeClass
    };
  }));

  function handleSubmit(e) {
    e.preventDefault();
    if (!nom || !email || !forfait) return;

    const nouveau = {
      id: Date.now(),
      nom,
      forfait: parseFloat(forfait) || 0,
      dejaPaye: 0,
      email
    };

    updateMembers([...$members, nouveau]);
    nom = '';
    email = '';
    forfait = '';
    showToast('✅ Nouvel élève inscrit au registre !');
  }

  function relancerMembre(m) {
    console.log(`[Relance] Email envoyé à ${m.email} : "Bonjour ${m.nom}, il reste un solde de ${m.resteAPayer.toFixed(2)}€ sur votre adhésion..."`);
    alert(`✉️ Un email de relance pédagogique a été simulé et envoyé à ${m.email} (${m.resteAPayer.toFixed(2)} € dus).`);
  }
</script>

<div class="page-title-section">
  <h1 class="page-title">Gestion des Élèves et Adhérents</h1>
  <p class="page-subtitle">Suivez le statut de règlement des inscriptions et gérez les relances.</p>
</div>

<div class="pedago-banner">
  <div class="pedago-banner-icon">💡</div>
  <div class="pedago-banner-text">
    <h4>Comment fonctionne la liaison bancaire ?</h4>
    <p>Lorsque vous classez une recette bancaire dans la catégorie des <strong>cotisations (compte 756 ou 706)</strong>, le SaaS cherche automatiquement si le nom d'un de vos élèves est mentionné dans le libellé du virement. Si c'est le cas, son solde est mis à jour instantanément sans saisie manuelle supplémentaire !</p>
  </div>
</div>

<div style="display: grid; grid-template-columns: 2fr 1fr; gap: 30px;">
  
  <!-- Register list -->
  <div class="glass-card">
    <h3 style="font-family: var(--font-title); margin-bottom: 20px;">Registre des élèves</h3>
    
    <div class="table-container">
      <table class="custom-table" id="members-table">
        <thead>
          <tr>
            <th>Nom de l'adhérent</th>
            <th>Montant forfait</th>
            <th>Déjà versé</th>
            <th>Reste à régler</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#if report.length === 0}
            <tr>
              <td colspan="6" style="text-align: center; color: var(--text-secondary);">Aucun élève enregistré pour le moment.</td>
            </tr>
          {:else}
            {#each report as m}
              <tr>
                <td style="color: white; font-weight: 600;">{m.nom}</td>
                <td class="amount">{m.forfait.toFixed(2)} €</td>
                <td class="amount credit">{m.dejaPaye.toFixed(2)} €</td>
                <td class="amount {m.resteAPayer > 0 ? 'debit' : 'credit'}">{m.resteAPayer.toFixed(2)} €</td>
                <td><span class="badge {m.badgeClass}">{m.statut}</span></td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick={() => relancerMembre(m)} disabled={m.resteAPayer <= 0}>
                    <i class="fa-solid fa-paper-plane"></i> Relancer
                  </button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Add Member Form -->
  <div class="glass-card">
    <h3 style="font-family: var(--font-title); margin-bottom: 20px;">Ajouter un nouvel élève</h3>
    <form onsubmit={handleSubmit}>
      <div class="form-group">
        <label for="member-name" class="form-label">Nom Complet</label>
        <input type="text" id="member-name" class="form-control" bind:value={nom} required placeholder="ex: Dupont Jean">
      </div>
      <div class="form-group">
        <label for="member-email" class="form-label">Adresse Email</label>
        <input type="email" id="member-email" class="form-control" bind:value={email} required placeholder="ex: jean.dupont@email.com">
      </div>
      <div class="form-group">
        <label for="member-forfait" class="form-label">Montant du Forfait (€)</label>
        <input type="number" id="member-forfait" class="form-control" bind:value={forfait} required placeholder="ex: 350">
      </div>
      <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center;">
        <i class="fa-solid fa-user-plus"></i> Inscrire l'élève
      </button>
    </form>
  </div>

</div>
