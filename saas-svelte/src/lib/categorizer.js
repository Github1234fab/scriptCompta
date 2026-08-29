import { get } from 'svelte/store';
import { rules, planComptable, updateRules } from './store.js';

export const Categorizer = {
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
   * Découpe le texte en mots significatifs (tokens)
   */
  tokenize(text) {
    return this.normaliserTexte(text)
      .split(/\s+/)
      .filter(w => w.length > 2); // Ignore les mots très courts de moins de 3 lettres
  },

  /**
   * Tente de catégoriser une liste de transactions en fonction des règles et de l'IA locale
   */
  categoriserTransactions(transactionsList) {
    const currentRules = get(rules);
    
    // --- ENTRAÎNEMENT DE L'IA LOCALE (NAIVE BAYES) ---
    const model = {
      docCount: 0,
      vocab: new Set(),
      classes: {} // compte -> { docCount, wordCounts: {}, totalWords: 0 }
    };

    transactionsList.forEach(tx => {
      // On entraîne l'IA sur toutes les transactions déjà triées et valides (hors compte temporaire 699)
      if (tx.statut === 'attribue' && tx.compteAttribué && tx.compteAttribué !== '699') {
        const tokens = this.tokenize(tx.libelle + ' ' + (tx.info || ''));
        if (tokens.length === 0) return;

        const cat = tx.compteAttribué;
        if (!model.classes[cat]) {
          model.classes[cat] = { docCount: 0, wordCounts: {}, totalWords: 0 };
        }

        model.docCount++;
        model.classes[cat].docCount++;

        tokens.forEach(tok => {
          model.vocab.add(tok);
          model.classes[cat].wordCounts[tok] = (model.classes[cat].wordCounts[tok] || 0) + 1;
          model.classes[cat].totalWords++;
        });
      }
    });

    // --- PRÉDICTION ET MATCHING DES TRANSACTIONS ---
    return transactionsList.map(tx => {
      // Si la transaction est déjà triée manuellement (attribuée ponctuellement),
      // on ne l'écrase pas avec les règles automatiques
      if (tx.statut === 'attribue' && tx.regleAppliquee === 'Attribution ponctuelle') {
        return tx;
      }

      const textComplet = this.normaliserTexte(tx.libelle + ' ' + (tx.info || ''));
      let regleTrouvee = null;

      // 1. Recherche d'une règle exacte dans le store (triée par longueur de mot-clé décroissante pour privilégier les règles plus spécifiques)
      const sortedRules = [...currentRules].sort((a, b) => b.motCle.length - a.motCle.length);
      const isDebit = tx.debit > 0;
      for (const rule of sortedRules) {
        const motCleNormalise = this.normaliserTexte(rule.motCle);
        if (textComplet.includes(motCleNormalise)) {
          if (isDebit && rule.debit) {
            regleTrouvee = { compte: rule.debit, regle: rule };
            break;
          }
          if (!isDebit && rule.credit) {
            regleTrouvee = { compte: rule.credit, regle: rule };
            break;
          }
        }
      }

      if (regleTrouvee) {
        return {
          ...tx,
          compteAttribué: regleTrouvee.compte,
          regleAppliquee: regleTrouvee.regle.motCle,
          statut: 'attribue'
        };
      } else {
        // 2. Pas de règle exacte. On tente une suggestion intelligente via notre IA locale (si elle est entraînée)
        let suggestionIA = null;
        if (model.docCount > 0) {
          const tokens = this.tokenize(tx.libelle + ' ' + (tx.info || ''));
          if (tokens.length > 0) {
            let bestCat = null;
            let maxScore = -Infinity;
            const vocabSize = model.vocab.size;

            for (const cat of Object.keys(model.classes)) {
              const cls = model.classes[cat];
              // Prior log prob
              let score = Math.log(cls.docCount / model.docCount);
              
              // Likelihood log prob (Laplace smoothing)
              tokens.forEach(tok => {
                const count = cls.wordCounts[tok] || 0;
                const prob = (count + 1) / (cls.totalWords + vocabSize + 1);
                score += Math.log(prob);
              });

              if (score > maxScore) {
                maxScore = score;
                bestCat = cat;
              }
            }
            if (bestCat) {
              suggestionIA = bestCat;
            }
          }
        }

        if (suggestionIA) {
          return {
            ...tx,
            compteAttribué: suggestionIA,
            regleAppliquee: `Apprentissage IA`,
            statut: 'suggere',
            suggestionMotCle: this.tokenize(tx.libelle)[0] || tx.libelle
          };
        } else {
          // 3. Fallback sur le dictionnaire d'heuristiques universelles si l'IA n'a pas encore de données
          const suggestionDic = this.obtenirSuggestionDictionnaire(tx);
          if (suggestionDic) {
            return {
              ...tx,
              compteAttribué: suggestionDic.compte,
              regleAppliquee: `Heuristique: ${suggestionDic.motCle}`,
              statut: 'suggere',
              suggestionMotCle: suggestionDic.motCle
            };
          } else {
            // Si déjà attribuée avant mais pas par règle, on garde, sinon compte 699 non classé
            if (tx.compteAttribué && tx.compteAttribué !== '699') {
              return {
                ...tx,
                statut: 'attribue'
              };
            } else {
              return {
                ...tx,
                compteAttribué: '699', // Compte temporaire "Non Classé"
                regleAppliquee: null,
                statut: 'non_attribue'
              };
            }
          }
        }
      }
    });
  },

  /**
   * Moteur de suggestions de dictionnaire (cold start)
   */
  obtenirSuggestionDictionnaire(tx) {
    const textComplet = this.normaliserTexte(tx.libelle + ' ' + (tx.info || ''));

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

    if (tx.debit > 0 && (textComplet.includes('SALAIRE') || textComplet.includes('PROF'))) {
      return { compte: '641', motCle: 'SALAIRE', note: 'Rémunérations' };
    }

    return null;
  },

  /**
   * Crée une règle de catégorisation définitive et l'enregistre dans le store rules
   */
  ajouterRegleEtRecat(motCle, compteSelectionne, typeTransaction) {
    const cleanMotCle = motCle.trim().toUpperCase();
    if (!cleanMotCle) return false;

    // Détermine si c'est pour un Débit (Dépense) ou Crédit (Recette)
    const debit = typeTransaction === 'debit' ? compteSelectionne : '';
    const credit = typeTransaction === 'credit' ? compteSelectionne : '';

    const currentRules = [...get(rules)];
    const indexExistant = currentRules.findIndex(r => r.motCle.toUpperCase() === cleanMotCle);
    
    const currentPlan = get(planComptable);
    const descriptionCompte = currentPlan.find(p => p.compte === compteSelectionne)?.libelle || 'Catégorie personnalisée';

    const nouvelleRegle = {
      motCle: cleanMotCle,
      debit: debit,
      credit: credit,
      note: descriptionCompte
    };

    if (indexExistant !== -1) {
      currentRules[indexExistant] = nouvelleRegle;
    } else {
      currentRules.unshift(nouvelleRegle); // Ajoute en premier pour lui donner la priorité
    }

    updateRules(currentRules);
    return true;
  },

  /**
   * Retourne le nom du compte à partir de son numéro
   */
  obtenirLibelleCompte(numCompte) {
    const cpt = get(planComptable).find(p => p.compte === numCompte);
    return cpt ? cpt.libelle : `Compte ${numCompte}`;
  }
};
