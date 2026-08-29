/**
 * ═══════════════════════════════════════════════════════════════════
 * MODULES DE GESTION SPÉCIFIQUES - PROTOTYPE SAAS COMPTABILITÉ
 * ═══════════════════════════════════════════════════════════════════
 */

const SaaSModules = {
  members: [],
  products: [],
  donors: [],
  bills: [],
  activeEntityId: 'entity-lyon',

  init(entityId) {
    this.activeEntityId = entityId || 'entity-lyon';

    // 1. Initialisation Adhérents / Élèves
    const savedMembers = localStorage.getItem(`saas_compta_members_${this.activeEntityId}`);
    if (savedMembers) {
      this.members = JSON.parse(savedMembers);
    } else {
      if (this.activeEntityId === 'entity-lyon') {
        this.members = [
          { id: 1, nom: 'Dupont Jean', forfait: 350, dejaPaye: 150, email: 'jean.dupont@email.com' },
          { id: 2, nom: 'Martin Sophie', forfait: 350, dejaPaye: 350, email: 'sophie.martin@email.com' },
          { id: 3, nom: 'Lemoine Pierre', forfait: 200, dejaPaye: 0, email: 'pierre.lemoine@email.com' }
        ];
      } else {
        this.members = [...INITIAL_MEMBERS];
      }
      this.saveMembers();
    }

    // 2. Initialisation Ventes / Stocks
    const savedProducts = localStorage.getItem(`saas_compta_products_${this.activeEntityId}`);
    if (savedProducts) {
      this.products = JSON.parse(savedProducts);
    } else {
      if (this.activeEntityId === 'entity-lyon') {
        this.products = [
          { id: 'prod-1', nom: 'Guitare classique d\'étude', prixAchat: 60, prixVente: 120, stock: 4 },
          { id: 'prod-2', nom: 'Cahier de solfège débutant', prixAchat: 5, prixVente: 12, stock: 15 },
          { id: 'prod-3', nom: 'Jeu de cordes nylon', prixAchat: 4, prixVente: 8, stock: 2 }
        ];
      } else {
        this.products = [...INITIAL_PRODUCTS];
      }
      this.saveProducts();
    }

    // 3. Initialisation Donateurs / Dons
    const savedDonors = localStorage.getItem(`saas_compta_donors_${this.activeEntityId}`);
    if (savedDonors) {
      this.donors = JSON.parse(savedDonors);
    } else {
      if (this.activeEntityId === 'entity-lyon') {
        this.donors = [
          { id: 101, nom: 'Albert René', adresse: '45 Rue de la Soie, 69001 Lyon', montantTotal: 150, recuGenere: true },
          { id: 102, nom: 'Société Générale Lyon (Mécénat)', adresse: '2 Place des Terreaux, 69002 Lyon', montantTotal: 500, recuGenere: false }
        ];
      } else {
        this.donors = [...INITIAL_DONORS];
      }
      this.saveDonors();
    }

    // 4. Initialisation Factures Fournisseurs (Dettes)
    const savedBills = localStorage.getItem(`saas_compta_bills_${this.activeEntityId}`);
    if (savedBills) {
      this.bills = JSON.parse(savedBills);
    } else {
      if (this.activeEntityId === 'entity-lyon') {
        this.bills = [
          { id: 1, provider: 'Fournisseur Musique SAS', label: 'Achat de cordes et médiators', amount: 120.00, dueDate: '2026-06-15', status: 'unpaid' },
          { id: 2, provider: 'EDF Lyon', label: 'Électricité du local - Facture Mai', amount: 85.00, dueDate: '2026-06-10', status: 'unpaid' }
        ];
      } else {
        this.bills = [];
      }
      this.saveBills();
    }
  },

  saveMembers() {
    localStorage.setItem(`saas_compta_members_${this.activeEntityId}`, JSON.stringify(this.members));
  },

  saveProducts() {
    localStorage.setItem(`saas_compta_products_${this.activeEntityId}`, JSON.stringify(this.products));
  },

  saveDonors() {
    localStorage.setItem(`saas_compta_donors_${this.activeEntityId}`, JSON.stringify(this.donors));
  },

  saveBills() {
    localStorage.setItem(`saas_compta_bills_${this.activeEntityId}`, JSON.stringify(this.bills));
  },

  // ═══════════════════════════════════════════════════════════════════
  // MODULE 1 : ÉLÈVES & ADHÉRENTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Retourne la situation financière de tous les membres
   */
  getMembersReport() {
    return this.members.map(m => {
      const resteAPayer = m.forfait - m.dejaPaye;
      let statut = 'Payé';
      if (resteAPayer > 0) {
        statut = m.dejaPaye > 0 ? 'Partiel' : 'Impayé';
      } else if (resteAPayer < 0) {
        statut = 'Trop perçu';
      }
      return {
        ...m,
        resteAPayer,
        statut
      };
    });
  },

  /**
   * Tente de réconcilier une écriture bancaire avec un élève en cherchant son nom dans le libellé
   * Si trouvé, ajoute le montant crédité à son total payé.
   */
  reconcilierTransactionEleve(tx) {
    if (tx.credit <= 0) return null;

    const labelUpper = tx.libelle.toUpperCase();
    for (let member of this.members) {
      // Extrait le nom de famille (ex: "Dupont Jean" -> "DUPONT")
      const nomFamille = member.nom.split(' ')[0].toUpperCase();
      
      if (labelUpper.includes(nomFamille)) {
        member.dejaPaye += tx.credit;
        this.saveMembers();
        return {
          membre: member.nom,
          montant: tx.credit,
          nouveauTotal: member.dejaPaye
        };
      }
    }
    return null;
  },

  /**
   * Ajoute un nouvel adhérent
   */
  ajouterMembre(nom, forfait, email) {
    const nouveau = {
      id: Date.now(),
      nom,
      forfait: parseFloat(forfait) || 0,
      dejaPaye: 0,
      email
    };
    this.members.push(nouveau);
    this.saveMembers();
    return nouveau;
  },

  /**
   * Simule l'envoi d'un mail de relance
   */
  relancerMembre(memberId) {
    const member = this.members.find(m => m.id === memberId);
    if (!member) return false;
    
    const reste = member.forfait - member.dejaPaye;
    console.log(`[Relance] Email envoyé à ${member.email} : "Bonjour ${member.nom}, il reste un solde de ${reste.toFixed(2)}€ sur votre adhésion..."`);
    return true;
  },

  // ═══════════════════════════════════════════════════════════════════
  // MODULE 2 : VENTES & STOCKS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enregistre une vente (diminue le stock et retourne la marge)
   */
  enregistrerVente(productId, quantite) {
    const prod = this.products.find(p => p.id === productId);
    if (!prod || prod.stock < quantite) return null;

    prod.stock -= quantite;
    this.saveProducts();

    const chiffreAffaires = prod.prixVente * quantite;
    const coutAchat = prod.prixAchat * quantite;
    const marge = chiffreAffaires - coutAchat;

    return {
      chiffreAffaires,
      marge,
      nouveauStock: prod.stock
    };
  },

  /**
   * Réapprovisionne un produit
   */
  reapprovisionner(productId, quantite) {
    const prod = this.products.find(p => p.id === productId);
    if (!prod) return false;

    prod.stock += parseInt(quantite) || 0;
    this.saveProducts();
    return prod.stock;
  },

  /**
   * Ajoute un produit au catalogue
   */
  ajouterProduit(nom, prixAchat, prixVente, stockInitial) {
    const nouveau = {
      id: 'prod-' + Date.now(),
      nom,
      prixAchat: parseFloat(prixAchat) || 0,
      prixVente: parseFloat(prixVente) || 0,
      stock: parseInt(stockInitial) || 0
    };
    this.products.push(nouveau);
    this.saveProducts();
    return nouveau;
  },

  // ═══════════════════════════════════════════════════════════════════
  // MODULE 3 : DONS & REÇUS FISCAUX
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enregistre un don libre et l'associe à un donateur
   */
  enregistrerDon(nomDonateur, adresse, montant) {
    const cleanNom = nomDonateur.trim();
    let donateur = this.donors.find(d => d.nom.toLowerCase() === cleanNom.toLowerCase());

    if (donateur) {
      donateur.montantTotal += parseFloat(montant);
      if (adresse) donateur.adresse = adresse;
    } else {
      donateur = {
        id: Date.now(),
        nom: cleanNom,
        montantTotal: parseFloat(montant),
        adresse: adresse || 'Adresse non renseignée',
        recuGenere: false
      };
      this.donors.push(donateur);
    }
    this.saveDonors();
    return donateur;
  },

  /**
   * Simule la génération d'un reçu fiscal Cerfa 11580*05
   */
  genererRecuFiscalHTML(donorId) {
    const donateur = this.donors.find(d => d.id === donorId);
    if (!donateur) return null;

    donateur.recuGenere = true;
    this.saveDonors();

    const numeroRecu = `2025-RC-${String(donateur.id).slice(-4)}`;
    
    // Génération du contenu HTML de la simulation du reçu fiscal
    return `
      <div class="cerfa-box" style="font-family: Arial, sans-serif; padding: 25px; border: 2px solid #333; background: #fff; color: #111; max-width: 650px; margin: 0 auto; box-shadow: 0 4px 15px rgba(0,0,0,0.15); border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px;">
          <div>
            <strong style="font-size: 1.1em;">REÇU FISCAL N° ${numeroRecu}</strong><br>
            <span style="font-size: 0.8em; color: #555;">Dons aux œuvres (Art. 200 & 238 bis du CGI)</span>
          </div>
          <div style="text-align: right;">
            <strong style="background: #333; color: #fff; padding: 3px 8px; border-radius: 3px;">CERFA N° 11580*05</strong>
          </div>
        </div>

        <div style="margin-bottom: 15px;">
          <strong>1. Bénéficiaire du don (L'Organisme) :</strong><br>
          <span style="font-size: 0.95em;">
            <strong>Association Musicale & Culturelle Générique</strong><br>
            12 rue des Beaux-Arts, 69002 Lyon<br>
            Objet : Association d'enseignement musical reconnue d'intérêt général.
          </span>
        </div>

        <div style="margin-bottom: 15px;">
          <strong>2. Donateur (Vous) :</strong><br>
          <span style="font-size: 0.95em;">
            <strong>Nom :</strong> ${donateur.nom}<br>
            <strong>Adresse :</strong> ${donateur.adresse}
          </span>
        </div>

        <div style="margin-bottom: 20px; background: #f9f9f9; padding: 10px; border-left: 4px solid #34a853;">
          Le bénéficiaire certifie avoir reçu à titre de don manuel, le <strong>${new Date().toLocaleDateString('fr-FR')}</strong>, la somme de :
          <div style="font-size: 1.4em; font-weight: bold; text-align: center; margin: 10px 0; color: #1b5e20;">
            ${donateur.montantTotal.toFixed(2)} €
          </div>
          <div style="font-size: 0.85em; text-align: center; font-style: italic; color: #666;">
            (Somme versée par virement ou chèque)
          </div>
        </div>

        <div style="font-size: 0.8em; color: #444; line-height: 1.35; margin-bottom: 20px;">
          L'association certifie que le donateur bénéficie de la réduction d'impôt sur le revenu prévue à l'article 200 du CGI (66% du montant du don dans la limite de 20% du revenu imposable).
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #ccc; padding-top: 15px;">
          <div style="font-size: 0.85em;">
            Fait à Lyon, le ${new Date().toLocaleDateString('fr-FR')}<br>
            <strong>Le Trésorier de l'Association</strong>
          </div>
          <div>
            <div style="border: 1px dashed #777; width: 150px; height: 60px; display: flex; align-items: center; justify-content: center; font-style: italic; font-size: 0.8em; color: #777;">
              [ Signature & Tampon ]
            </div>
          </div>
        </div>
      </div>
    `;
  }
};
