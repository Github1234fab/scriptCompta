<script>
  import { 
    donors, 
    transactions, 
    updateDonors, 
    updateTransactions, 
    showToast 
  } from '../lib/store.js';
  import { Categorizer } from '../lib/categorizer.js';

  let nom = $state('');
  let adresse = $state('');
  let montant = $state('');

  let showCerfaModal = $state(false);
  let activeDonor = $state(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (!nom || !montant) return;

    const parsedMontant = parseFloat(montant) || 0;
    const cleanNom = nom.trim();

    // 1. Update donors store
    let updatedDonors = [...$donors];
    let donateur = updatedDonors.find(d => d.nom.toLowerCase() === cleanNom.toLowerCase());

    if (donateur) {
      donateur.montantTotal += parsedMontant;
      if (adresse) donateur.adresse = adresse;
    } else {
      donateur = {
        id: Date.now(),
        nom: cleanNom,
        montantTotal: parsedMontant,
        adresse: adresse || 'Adresse non renseignée',
        recuGenere: false
      };
      updatedDonors.push(donateur);
    }
    updateDonors(updatedDonors);

    // 2. Add receipt transaction
    const nouvelleTx = {
      id: 'tx-don-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      libelle: `DON DE ${cleanNom.toUpperCase()}`,
      info: 'Don manuel enregistré',
      debit: 0,
      credit: parsedMontant,
      compteAttribué: null,
      regleAppliquee: null,
      statut: 'non_attribue'
    };

    const merged = [nouvelleTx, ...$transactions];
    const categorized = Categorizer.categoriserTransactions(merged);
    updateTransactions(categorized);

    // Reset form
    nom = '';
    adresse = '';
    montant = '';

    showToast('Don enregistré ! Reçu fiscal prêt dans le tableau.');
  }

  function openCerfaModal(d) {
    activeDonor = d;
    showCerfaModal = true;
  }

  function fermerModal() {
    showCerfaModal = false;
    activeDonor = null;
  }

  function confirmerEnregistrementRecu() {
    if (activeDonor) {
      const list = $donors.map(d => {
        if (d.id === activeDonor.id) {
          return { ...d, recuGenere: true };
        }
        return d;
      });
      updateDonors(list);
      showToast('Reçu fiscal enregistré et archivé !');
    }
    fermerModal();
  }

  function imprimerRecu() {
    alert("Envoi du document vers votre imprimante...");
  }
</script>

<div style="margin-bottom: 20px;">
  <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: var(--text-main); font-family: var(--font-title, sans-serif);">
    Registre des Dons & Reçus Fiscaux (Compte 754)
  </h2>
  <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-muted);">
    Suivez vos mécènes et éditez en 1 clic les reçus fiscaux Cerfa officiels.
  </p>
</div>

<div class="pedago-banner" style="border: none; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);">
  <div class="pedago-banner-icon"><i class="fa-solid fa-lightbulb" style="color: #6366f1;"></i></div>
  <div class="pedago-banner-text">
    <h4>Qu'est-ce qu'un reçu fiscal Cerfa ?</h4>
    <p>Si votre association est déclarée d'intérêt général, vous pouvez délivrer aux donateurs un reçu officiel (Cerfa 11580) qui leur permet de déduire 66% de leur don de leurs impôts sur le revenu. Notre outil gère le registre des mécènes et pré-remplit le Cerfa de façon automatisée.</p>
  </div>
</div>

<div class="donations-grid">
  
  <!-- Donors table / cards -->
  <div class="glass-card donations-card">
    <div class="donations-card-header">
      <h3 style="font-family: var(--font-title); margin: 0; font-size: 1.1rem; color: var(--text-main);">
        Registre des Donateurs
      </h3>
      <span class="donations-count-badge">{$donors.length} donateur{$donors.length > 1 ? 's' : ''}</span>
    </div>
    
    <!-- Table Desktop -->
    <div class="donors-desktop-table table-container">
      <table class="custom-table" id="donors-table">
        <thead>
          <tr>
            <th>Nom du Donateur / Mécène</th>
            <th>Adresse</th>
            <th>Montant Total Dons</th>
            <th>Reçu Édité ?</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#if $donors.length === 0}
            <tr>
              <td colspan="5" style="text-align: center; color: var(--text-secondary);">Aucun don enregistré pour l'instant.</td>
            </tr>
          {:else}
            {#each $donors as d}
              <tr>
                <td style="color: var(--text-main); font-weight: 600;">{d.nom}</td>
                <td style="font-size: 0.85rem; color: var(--text-muted);">{d.adresse}</td>
                <td class="amount credit">{d.montantTotal.toFixed(2)} €</td>
                <td>
                  {#if d.recuGenere}
                    <span class="badge badge-success">Généré</span>
                  {:else}
                    <span class="badge badge-muted">Non généré</span>
                  {/if}
                </td>
                <td>
                  <button class="btn btn-cta-donations btn-sm" onclick={() => openCerfaModal(d)}>
                    <i class="fa-solid fa-receipt"></i> Générer reçu Cerfa
                  </button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Cards Mobile -->
    <div class="donors-mobile-cards">
      {#if $donors.length === 0}
        <div class="donors-empty-card">
          <i class="fa-solid fa-hand-holding-heart" style="font-size: 1.6rem; color: var(--text-muted); opacity: 0.6; margin-bottom: 8px;"></i>
          <p style="margin: 0; font-size: 0.86rem; color: var(--text-muted);">Aucun don enregistré pour l'instant.</p>
        </div>
      {:else}
        <div class="donors-cards-list">
          {#each $donors as d}
            <div class="donor-card-item">
              <div class="donor-card-header-row">
                <div class="donor-card-name-group">
                  <span class="donor-avatar-icon"><i class="fa-solid fa-user"></i></span>
                  <div class="donor-card-identity">
                    <span class="donor-card-name">{d.nom}</span>
                    <span class="donor-card-address">
                      <i class="fa-solid fa-location-dot"></i> {d.adresse || 'Adresse non renseignée'}
                    </span>
                  </div>
                </div>
                <div class="donor-card-amount">
                  +{d.montantTotal.toFixed(2)} €
                </div>
              </div>

              <div class="donor-card-actions-row">
                {#if d.recuGenere}
                  <span class="badge badge-success" style="font-size: 0.72rem; padding: 3px 8px;">
                    <i class="fa-solid fa-check"></i> Reçu généré
                  </span>
                {:else}
                  <span class="badge badge-muted" style="font-size: 0.72rem; padding: 3px 8px;">
                    Non généré
                  </span>
                {/if}

                <button class="btn btn-cta-donations btn-sm" onclick={() => openCerfaModal(d)} style="margin-left: auto;">
                  <i class="fa-solid fa-receipt"></i> Reçu Cerfa
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Record manual donation -->
  <div class="glass-card donations-form-card">
    <h3 style="font-family: var(--font-title); margin: 0 0 16px 0; font-size: 1.1rem; color: var(--text-main);">
      Enregistrer un don manuel
    </h3>
    <form onsubmit={handleSubmit} class="donations-form">
      <div class="form-group">
        <label for="donor-name" class="form-label">Nom du Donateur</label>
        <input type="text" id="donor-name" class="form-control" bind:value={nom} required placeholder="ex: Martin Robert">
      </div>
      <div class="form-group">
        <label for="donor-address" class="form-label">Adresse Postale (Requise pour le Cerfa)</label>
        <input type="text" id="donor-address" class="form-control" bind:value={adresse} placeholder="ex: 12 Rue de la République, 69002 Lyon">
      </div>
      <div class="form-group">
        <label for="donor-amount" class="form-label">Montant du Don (€)</label>
        <input type="number" id="donor-amount" class="form-control" bind:value={montant} required placeholder="ex: 250">
      </div>
      <button type="submit" class="btn btn-cta-donations" style="width: 100%; justify-content: center; margin-top: 6px;">
        <i class="fa-solid fa-heart"></i> Enregistrer le don
      </button>
    </form>
  </div>

</div>

<!-- MODAL : REÇU FISCAL CERFA -->
{#if showCerfaModal && activeDonor}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="modal-overlay active" onclick={fermerModal}>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="modal-box cerfa-modal-responsive" onclick={(e) => e.stopPropagation()} style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
      <div class="modal-header">
        <h3 class="modal-title">Aperçu du Reçu Fiscal Officiel</h3>
        <button class="modal-close-btn" onclick={fermerModal}>&times;</button>
      </div>
      
      <div id="recu-fiscal-body" style="padding: 15px 0;">
        <div class="cerfa-box" style="font-family: Arial, sans-serif; padding: 25px; border: 2px solid #333; background: #fff; color: #111; max-width: 650px; margin: 0 auto; box-shadow: 0 4px 15px rgba(0,0,0,0.15); border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px;">
            <div>
              <strong style="font-size: 1.1em;">REÇU FISCAL N° 2025-RC-{String(activeDonor.id).slice(-4)}</strong><br>
              <span style="font-size: 0.8em; color: #555;">Dons aux œuvres (Art. 200 & 238 bis du CGI)</span>
            </div>
            <div style="text-align: right;">
              <strong style="background: #333; color: #fff; padding: 3px 8px; border-radius: 3px; font-size: 0.75rem;">CERFA N° 11580*05</strong>
            </div>
          </div>

          <div style="margin-bottom: 15px;">
            <strong style="font-size: 0.85rem; color: #333;">1. Bénéficiaire du don (L'Organisme) :</strong><br>
            <span style="font-size: 0.9em; line-height: 1.3;">
              <strong>Association Musicale & Culturelle Générique</strong><br>
              12 rue des Beaux-Arts, 69002 Lyon<br>
              Objet : Association d'enseignement musical reconnue d'intérêt général.
            </span>
          </div>

          <div style="margin-bottom: 15px;">
            <strong style="font-size: 0.85rem; color: #333;">2. Donateur (Vous) :</strong><br>
            <span style="font-size: 0.9em; line-height: 1.3;">
              <strong>Nom :</strong> {activeDonor.nom}<br>
              <strong>Adresse :</strong> {activeDonor.adresse}
            </span>
          </div>

          <div style="margin-bottom: 20px; background: #f9f9f9; padding: 15px; border-left: 4px solid #34a853; border-radius: 4px;">
            Le bénéficiaire certifie avoir reçu à titre de don manuel, le <strong>{new Date().toLocaleDateString('fr-FR')}</strong>, la somme de :
            <div style="font-size: 1.4em; font-weight: bold; text-align: center; margin: 10px 0; color: #1b5e20;">
              {activeDonor.montantTotal.toFixed(2)} €
            </div>
            <div style="font-size: 0.85em; text-align: center; font-style: italic; color: #666;">
              (Somme versée par virement ou chèque)
            </div>
          </div>

          <div style="font-size: 0.75rem; color: #444; line-height: 1.35; margin-bottom: 20px;">
            L'association certifie que le donateur bénéficie de la réduction d'impôt sur le revenu prévue à l'article 200 du CGI (66% du montant du don dans la limite de 20% du revenu imposable).
          </div>

          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #ccc; padding-top: 15px;">
            <div style="font-size: 0.8em; color: #555;">
              Fait à Lyon, le {new Date().toLocaleDateString('fr-FR')}<br>
              <strong>Le Trésorier de l'Association</strong>
            </div>
            <div>
              <div style="border: 1px dashed #777; width: 140px; height: 50px; display: flex; align-items: center; justify-content: center; font-style: italic; font-size: 0.75rem; color: #777; border-radius: 4px;">
                [ Signature & Tampon ]
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style="margin-top: 25px; display: flex; justify-content: flex-end; gap: 12px; flex-wrap: wrap;">
        <button class="btn btn-secondary" onclick={imprimerRecu}>
          <i class="fa-solid fa-print"></i> Imprimer le document
        </button>
        <button class="btn btn-success" onclick={confirmerEnregistrementRecu}>
          <i class="fa-solid fa-file-pdf"></i> Confirmer l'enregistrement
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  :global(.pedago-banner) {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    overflow-wrap: break-word;
    word-break: break-word;
  }
  .donations-grid {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 24px;
    align-items: start;
    width: 100%;
    box-sizing: border-box;
  }
  .donations-card,
  .donations-form-card {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
  }
  .donations-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 18px;
    gap: 10px;
  }
  .donations-count-badge {
    background: rgba(99, 102, 241, 0.12);
    color: #818cf8;
    border: 1px solid rgba(129, 140, 248, 0.25);
    font-size: 0.75rem;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
  }
  .donors-desktop-table {
    display: block;
    width: 100%;
    overflow-x: auto;
  }
  .donors-mobile-cards {
    display: none;
    width: 100%;
  }
  .donations-form .form-group {
    margin-bottom: 14px;
  }
  .donations-form .form-label {
    display: block;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }
  .donations-form .form-control {
    width: 100%;
    box-sizing: border-box;
  }

  @media (max-width: 900px) {
    .donations-grid {
      grid-template-columns: 1fr !important;
      gap: 18px !important;
    }
  }

  @media (max-width: 768px) {
    .donations-card,
    .donations-form-card {
      padding: 16px 14px !important;
      border-radius: 14px !important;
    }
    .donors-desktop-table {
      display: none !important;
    }
    .donors-mobile-cards {
      display: block !important;
    }
    .donors-cards-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .donor-card-item {
      background: var(--bg-card, #ffffff);
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 12px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      transition: background 0.15s ease;
    }
    .donor-card-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
    }
    .donor-card-name-group {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex: 1;
    }
    .donor-avatar-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(99, 102, 241, 0.12);
      color: #818cf8;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      flex-shrink: 0;
    }
    .donor-card-identity {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .donor-card-name {
      font-weight: 700;
      font-size: 0.9rem;
      color: var(--text-main);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .donor-card-address {
      font-size: 0.74rem;
      color: var(--text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .donor-card-amount {
      font-size: 0.95rem;
      font-weight: 800;
      color: #10b981;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .donor-card-actions-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding-top: 8px;
      border-top: 1px solid var(--border-color, rgba(226, 232, 240, 0.4));
    }
    .donors-empty-card {
      text-align: center;
      padding: 24px 16px;
      background: var(--bg-card);
      border: 1px dashed var(--border-color);
      border-radius: 12px;
    }
    .cerfa-modal-responsive {
      padding: 16px 12px !important;
      margin: 10px !important;
      width: calc(100% - 20px) !important;
    }
    .cerfa-box {
      padding: 14px !important;
      font-size: 0.8rem !important;
    }
  }
</style>
