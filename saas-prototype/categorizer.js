/**
 * ═══════════════════════════════════════════════════════════════════
 * MOTEUR DE CATÉGORISATION & RÈGLES - PROTOTYPE SAAS COMPTABILITÉ
 * ═══════════════════════════════════════════════════════════════════
 */

const Categorizer = {
  rules: [],
  planComptable: [],
  activeEntityId: 'entity-lyon',

  /**
   * Initialise les règles et le plan comptable depuis le LocalStorage ou les données par défaut
   */
  init(entityId, customRules = null, customPlan = null) {
    this.activeEntityId = entityId || 'entity-lyon';
    const savedRules = localStorage.getItem(`saas_compta_rules_${this.activeEntityId}`);
    if (savedRules) {
      this.rules = JSON.parse(savedRules);
    } else {
      // Règles par défaut pour l'entité de Lyon
      if (this.activeEntityId === 'entity-lyon') {
        this.rules = [
          { motCle: 'STRIPE', debit: '', credit: '706', note: 'Ventes de Services & Cours' },
          { motCle: 'COTIS', debit: '', credit: '756', note: 'Cotisations des Adhérents' },
          { motCle: 'DON', debit: '', credit: '758', note: 'Dons & Mécénat' },
          { motCle: 'EDF', debit: '613', credit: '', note: 'Loyer, Salles & Abonnements web' },
          { motCle: 'INTERNET', debit: '626', credit: '', note: 'Télécoms & Poste' }
        ];
      } else {
        this.rules = customRules || [...INITIAL_RULES];
      }
      this.saveRules();
    }

    const savedPlan = localStorage.getItem(`saas_compta_plan_${this.activeEntityId}`);
    if (savedPlan) {
      this.planComptable = JSON.parse(savedPlan);
    } else {
      this.planComptable = customPlan || [...INITIAL_PLAN_COMPTABLE];
      this.savePlan();
    }
  },

  saveRules() {
    localStorage.setItem(`saas_compta_rules_${this.activeEntityId}`, JSON.stringify(this.rules));
  },

  savePlan() {
    localStorage.setItem(`saas_compta_plan_${this.activeEntityId}`, JSON.stringify(this.planComptable));
  },

  /**
   * Réinitialise les règles par défaut
   */
  resetToDefault() {
    if (this.activeEntityId === 'entity-lyon') {
      this.rules = [
        { motCle: 'STRIPE', debit: '', credit: '706', note: 'Ventes de Services & Cours' },
        { motCle: 'COTIS', debit: '', credit: '756', note: 'Cotisations des Adhérents' },
        { motCle: 'DON', debit: '', credit: '758', note: 'Dons & Mécénat' },
        { motCle: 'EDF', debit: '613', credit: '', note: 'Loyer, Salles & Abonnements web' },
        { motCle: 'INTERNET', debit: '626', credit: '', note: 'Télécoms & Poste' }
      ];
    } else {
      this.rules = [];
    }
    this.saveRules();
  },

  /**
   * Normalise le texte pour faciliter le matching (sans accents, en majuscules)
   */
  normaliserTexte(text) {
    if (!text) return '';
    return String(text)
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
      .replace(/[^A-Z0-9\s]/g, ' ') // Remplace les caractères spéciaux par des espaces
      .replace(/\s+/g, ' ') // Supprime les espaces multiples
      .trim();
  },

  /**
   * Tente de catégoriser une liste de transactions
   */
  categoriserTransactions(transactions) {
    return transactions.map(tx => {
      const textComplet = this.normaliserTexte(tx.libelle + ' ' + tx.info);
      let regleTrouvee = null;

      // Recherche d'une règle exacte
      for (const rule of this.rules) {
        const motCleNormalise = this.normaliserTexte(rule.motCle);
        if (textComplet.includes(motCleNormalise)) {
          // On vérifie que la règle correspond au type de transaction (Débit/Dépense ou Crédit/Recette)
          if (tx.debit > 0 && rule.debit) {
            regleTrouvee = { compte: rule.debit, regle: rule, type: 'exact' };
            break;
          }
          if (tx.credit > 0 && rule.credit) {
            regleTrouvee = { compte: rule.credit, regle: rule, type: 'exact' };
            break;
          }
        }
      }

      if (regleTrouvee) {
        tx.compteAttribué = regleTrouvee.compte;
        tx.regleAppliquee = regleTrouvee.regle.motCle;
        tx.statut = 'attribue';
      } else {
        // Pas de règle exacte. On tente de faire une suggestion intelligente (suggestion automatique)
        const suggestion = this.obtenirSuggestionAuto(tx);
        if (suggestion) {
          tx.compteAttribué = suggestion.compte;
          tx.regleAppliquee = `Suggestion: ${suggestion.motCle}`;
          tx.statut = 'suggere';
          tx.suggestionMotCle = suggestion.motCle;
        } else {
          tx.compteAttribué = '699'; // Compte temporaire "Non Classé"
          tx.regleAppliquee = null;
          tx.statut = 'non_attribue';
        }
      }

      return tx;
    });
  },

  /**
   * Moteur de suggestions heuristiques pour les écritures non classées
   */
  obtenirSuggestionAuto(tx) {
    const textComplet = this.normaliserTexte(tx.libelle + ' ' + tx.info);

    // Dictionnaire de secours contenant des suggestions heuristiques universelles
    const suggestionsHeuristiques = [
      { mot: 'SUPERU', debit: '606', credit: '', note: 'Alimentation / Fournitures' },
      { mot: 'LIDL', debit: '606', credit: '', note: 'Alimentation / Fournitures' },
      { mot: 'CARREFOUR', debit: '606', credit: '', note: 'Alimentation / Fournitures' },
      { mot: 'LECLERC', debit: '606', credit: '', note: 'Alimentation / Fournitures' },
      { mot: 'INTERMARCHE', debit: '606', credit: '', note: 'Alimentation / Fournitures' },
      { mot: 'EDF', debit: '613', credit: '', note: 'Électricité / Énergie' },
      { mot: 'ENGIE', debit: '613', credit: '', note: 'Électricité / Énergie' },
      { mot: 'SUEZ', debit: '613', credit: '', note: 'Eau courante' },
      { mot: 'VEOLIA', debit: '613', credit: '', note: 'Eau courante' },
      { mot: 'PAYPAL', debit: '606', credit: '', note: 'Achat en ligne (Vérifiez le reçu)' },
      { mot: 'ADOBE', debit: '613', credit: '', note: 'Abonnement Logiciel Créatif' },
      { mot: 'CANVA', debit: '613', credit: '', note: 'Abonnement Design Canva' },
      { mot: 'TOTAL', debit: '625', credit: '', note: 'Carburant déplacement' },
      { mot: 'SHELL', debit: '625', credit: '', note: 'Carburant déplacement' },
      { mot: 'SNCF', debit: '625', credit: '', note: 'Billets de train' },
      { mot: 'UBER', debit: '625', credit: '', note: 'Frais de transport VTC' },
      { mot: 'COTIS', debit: '', credit: '756', note: 'Cotisation adhérent' },
      { mot: 'DONATION', debit: '', credit: '758', note: 'Don d\'un particulier' },
      { mot: 'CADEAU', debit: '606', credit: '', note: 'Cadeaux / Récompenses' }
    ];

    for (const sug of suggestionsHeuristiques) {
      if (textComplet.includes(sug.mot)) {
        if (tx.debit > 0 && sug.debit) {
          return { compte: sug.debit, motCle: sug.mot, note: sug.note };
        }
        if (tx.credit > 0 && sug.credit) {
          return { compte: sug.credit, motCle: sug.mot, note: sug.note };
        }
      }
    }

    // Extraction dynamique de mots-clés d'enseignants (pour la démo)
    if (tx.debit > 0 && textComplet.includes('SALAIRE') || textComplet.includes('PROF')) {
      return { compte: '641', motCle: 'SALAIRE', note: 'Rémunérations' };
    }

    return null;
  },

  /**
   * Crée une règle de catégorisation définitive et l'enregistre
   */
  ajouterRegleEtRecat(motCle, compteSelectionne, typeTransaction) {
    const cleanMotCle = motCle.trim().toUpperCase();
    if (!cleanMotCle) return false;

    // Détermine si c'est pour un Débit (Dépense) ou Crédit (Recette)
    const debit = typeTransaction === 'debit' ? compteSelectionne : '';
    const credit = typeTransaction === 'credit' ? compteSelectionne : '';

    // Vérifie si la règle existe déjà pour l'écraser
    const indexExistant = this.rules.findIndex(r => r.motCle.toUpperCase() === cleanMotCle);
    
    const descriptionCompte = this.planComptable.find(p => p.compte === compteSelectionne)?.libelle || 'Catégorie personnalisée';

    const nouvelleRegle = {
      motCle: cleanMotCle,
      debit: debit,
      credit: credit,
      note: descriptionCompte
    };

    if (indexExistant !== -1) {
      this.rules[indexExistant] = nouvelleRegle;
    } else {
      this.rules.unshift(nouvelleRegle); // Ajoute en premier pour lui donner la priorité
    }

    this.saveRules();
    return true;
  },

  /**
   * Retourne le nom du compte à partir de son numéro
   */
  obtenirLibelleCompte(numCompte) {
    const cpt = this.planComptable.find(p => p.compte === numCompte);
    return cpt ? cpt.libelle : `Compte ${numCompte}`;
  }
};
