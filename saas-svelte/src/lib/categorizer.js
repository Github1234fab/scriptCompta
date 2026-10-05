import { get } from 'svelte/store';
import { 
  rules, 
  planComptable, 
  members,
  activeEntityId,
  updateRules 
} from './store.js';

export const Categorizer = {
  /**
   * Nettoie et normalise une chaîne de texte
   */
  normaliserTexte(txt) {
    if (!txt) return '';
    return String(txt)
      .toUpperCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  /**
   * Récupère la carte des alias sauvegardés (Parent -> Élève / Motif -> Entité)
   */
  obtenirAliasMap() {
    const entityId = get(activeEntityId);
    const saved = localStorage.getItem(`saas_compta_aliases_${entityId}`);
    return saved ? JSON.parse(saved) : {};
  },

  /**
   * Sauvegarde un alias (ex: "DUPONT MARC" -> memberId 102)
   */
  sauvegarderAlias(rawPattern, memberId) {
    const cleanPattern = this.normaliserTexte(rawPattern);
    if (!cleanPattern) return;

    const entityId = get(activeEntityId);
    const currentMap = this.obtenirAliasMap();
    currentMap[cleanPattern] = memberId;
    localStorage.setItem(`saas_compta_aliases_${entityId}`, JSON.stringify(currentMap));
  },

  /**
   * Rapprochement d'entité : tente d'associer une écriture bancaire à un membre/élève
   */
  détecterEntité(tx, membersList = null) {
    if (!tx) return null;
    const currentMembers = membersList || get(members);
    if (!currentMembers || currentMembers.length === 0) return null;

    const textComplet = this.normaliserTexte(
      `${tx.libelle || ''} ${tx.rawLibelle || ''} ${tx.info || ''} ${tx.reference || ''}`
    );

    // 1. Vérifier si un alias explicite existe
    const aliasMap = this.obtenirAliasMap();
    for (const [pattern, memberId] of Object.entries(aliasMap)) {
      if (textComplet.includes(pattern)) {
        const found = currentMembers.find(m => m.id === memberId);
        if (found) {
          return {
            member: found,
            confidence: 100,
            reason: `Alias mémorisé : "${pattern}"`
          };
        }
      }
    }

    // 2. Recherche par nom d'élève dans le texte complet
    for (const m of currentMembers) {
      const nomNorm = this.normaliserTexte(m.nom);
      if (!nomNorm || nomNorm.length < 3) continue;

      // Match exact du nom dans le texte complet
      if (textComplet.includes(nomNorm)) {
        return {
          member: m,
          confidence: 100,
          reason: `Nom détecté : "${m.nom}"`
        };
      }

      // Match inversé (Prénom Nom au lieu de Nom Prénom)
      const parts = nomNorm.split(' ').filter(p => p.length >= 3);
      if (parts.length >= 2) {
        const nomInversé = `${parts[1]} ${parts[0]}`;
        if (textComplet.includes(nomInversé)) {
          return {
            member: m,
            confidence: 95,
            reason: `Nom détecté (inversé) : "${m.nom}"`
          };
        }

        // Match si TOUS les mots clés du nom sont présents séparément dans le texte
        const allPartsPresent = parts.every(part => textComplet.includes(part));
        if (allPartsPresent) {
          return {
            member: m,
            confidence: 90,
            reason: `Mots-clés détectés : "${m.nom}"`
          };
        }
      }
    }

    return null;
  },

  /**
   * Catégorise une liste d'écritures bancaires et effectue le rapprochement d'entités
   */
  categoriserTransactions(transactionsList) {
    if (!Array.isArray(transactionsList)) return [];

    const reglesActuelles = get(rules);
    const membersList = get(members);

    return transactionsList.map(tx => {
      // Conservation stricte de l'écriture d'origine si déjà attribuée manuellement
      if (tx.statut === 'attribue' && tx.compteAttribué && tx.compteAttribué !== '699') {
        return tx;
      }

      const textComplet = this.normaliserTexte(
        `${tx.libelle || ''} ${tx.rawLibelle || ''} ${tx.info || ''} ${tx.reference || ''}`
      );

      // 1. Rapprochement d'entité Élève / Membre
      const entiteDetectee = this.détecterEntité(tx, membersList);

      // 2. Recherche par règles métiers enregistrées
      let regleTrouvee = null;
      for (const regle of reglesActuelles) {
        const motCleClean = this.normaliserTexte(regle.motCle);
        if (motCleClean && textComplet.includes(motCleClean)) {
          if (tx.debit > 0 && regle.debit) {
            regleTrouvee = { compte: regle.debit, motCle: regle.motCle };
            break;
          }
          if (tx.credit > 0 && regle.credit) {
            regleTrouvee = { compte: regle.credit, motCle: regle.motCle };
            break;
          }
        }
      }

      if (regleTrouvee) {
        return {
          ...tx,
          compteAttribué: regleTrouvee.compte,
          regleAppliquee: `Règle : ${regleTrouvee.motCle}`,
          statut: 'suggere',
          autoRecognized: true,
          confidence: 100,
          matchedMemberId: entiteDetectee ? entiteDetectee.member.id : (tx.matchedMemberId || null),
          matchedMemberNom: entiteDetectee ? entiteDetectee.member.nom : (tx.matchedMemberNom || null)
        };
      }

      // 3. Si entité élève détectée en recette (+), affecter par défaut au compte 756 (Cotisation) ou 706
      if (entiteDetectee && tx.credit > 0) {
        return {
          ...tx,
          compteAttribué: tx.compteAttribué || '756',
          regleAppliquee: entiteDetectee.reason,
          statut: 'suggere',
          autoRecognized: true,
          confidence: entiteDetectee.confidence,
          matchedMemberId: entiteDetectee.member.id,
          matchedMemberNom: entiteDetectee.member.nom
        };
      }

      // 4. Dictionnaire d'heuristiques universelles
      const suggestionDic = this.obtenirSuggestionDictionnaire(tx);
      if (suggestionDic) {
        return {
          ...tx,
          compteAttribué: suggestionDic.compte,
          regleAppliquee: `Heuristique : ${suggestionDic.motCle}`,
          statut: 'suggere',
          autoRecognized: true,
          confidence: 85,
          matchedMemberId: entiteDetectee ? entiteDetectee.member.id : null,
          matchedMemberNom: entiteDetectee ? entiteDetectee.member.nom : null
        };
      }

      // 5. Opération non reconnue automatiquement
      return {
        ...tx,
        compteAttribué: tx.compteAttribué || '699',
        regleAppliquee: null,
        statut: 'non_attribue',
        autoRecognized: false,
        confidence: 0,
        matchedMemberId: entiteDetectee ? entiteDetectee.member.id : null,
        matchedMemberNom: entiteDetectee ? entiteDetectee.member.nom : null
      };
    });
  },

  /**
   * Moteur de suggestions de dictionnaire (cold start)
   */
  obtenirSuggestionDictionnaire(tx) {
    const textComplet = this.normaliserTexte(
      `${tx.libelle || ''} ${tx.rawLibelle || ''} ${tx.info || ''} ${tx.reference || ''}`
    );

    const suggestionsHeuristiques = [
      // Supermarchés & Alimentation (606)
      { mot: 'SUPER U', debit: '606', credit: '', note: 'Alimentation / Fournitures' },
      { mot: 'SUPERU', debit: '606', credit: '', note: 'Alimentation / Fournitures' },
      { mot: 'HYPER U', debit: '606', credit: '', note: 'Alimentation / Fournitures' },
      { mot: 'U EXPRESS', debit: '606', credit: '', note: 'Alimentation / Fournitures' },
      { mot: 'SYSTEME U', debit: '606', credit: '', note: 'Alimentation / Fournitures' },
      { mot: 'LIDL', debit: '606', credit: '', note: 'Alimentation / Fournitures' },
      { mot: 'CARREFOUR', debit: '606', credit: '', note: 'Alimentation / Fournitures' },
      { mot: 'LECLERC', debit: '606', credit: '', note: 'Alimentation / Fournitures' },
      { mot: 'E LECLERC', debit: '606', credit: '', note: 'Alimentation / Fournitures' },
      { mot: 'INTERMARCHE', debit: '606', credit: '', note: 'Alimentation / Fournitures' },
      { mot: 'AUCHAN', debit: '606', credit: '', note: 'Alimentation / Fournitures' },
      { mot: 'MONOPRIX', debit: '606', credit: '', note: 'Alimentation / Fournitures' },
      { mot: 'CASINO', debit: '606', credit: '', note: 'Alimentation / Fournitures' },
      { mot: 'ALDI', debit: '606', credit: '', note: 'Alimentation / Fournitures' },
      { mot: 'CORA', debit: '606', credit: '', note: 'Alimentation / Fournitures' },
      { mot: 'PICARD', debit: '606', credit: '', note: 'Alimentation / Fournitures' },
      
      // Achats & Matériel (606)
      { mot: 'THOMANN', debit: '606', credit: '', note: 'Achats & Équipements' },
      { mot: 'AMAZON', debit: '606', credit: '', note: 'Achats & Fournitures' },
      { mot: 'FNAC', debit: '606', credit: '', note: 'Achats & Fournitures' },
      { mot: 'DARTY', debit: '606', credit: '', note: 'Achats & Équipements' },
      { mot: 'BOULANGER', debit: '606', credit: '', note: 'Achats & Équipements' },
      { mot: 'LEROY MERLIN', debit: '606', credit: '', note: 'Bricolage & Matériel' },
      { mot: 'CASTORAMA', debit: '606', credit: '', note: 'Bricolage & Matériel' },
      { mot: 'DECATHLON', debit: '606', credit: '', note: 'Sports & Équipements' },
      { mot: 'BUREAU VALLEE', debit: '606', credit: '', note: 'Fournitures de bureau' },
      { mot: 'OFFICE DEPOT', debit: '606', credit: '', note: 'Fournitures de bureau' },
      { mot: 'PAYPAL', debit: '606', credit: '', note: 'Achat en ligne' },

      // Énergie & Abonnements Locaux (613)
      { mot: 'EDF', debit: '613', credit: '', note: 'Électricité / Énergie' },
      { mot: 'ENGIE', debit: '613', credit: '', note: 'Électricité / Énergie' },
      { mot: 'TOTALENERGIES', debit: '613', credit: '', note: 'Électricité / Énergie' },
      { mot: 'SUEZ', debit: '613', credit: '', note: 'Eau courante' },
      { mot: 'VEOLIA', debit: '613', credit: '', note: 'Eau courante' },

      // Logiciels & SaaS Web (6132)
      { mot: 'ADOBE', debit: '6132', credit: '', note: 'Abonnement Logiciel' },
      { mot: 'CANVA', debit: '6132', credit: '', note: 'Abonnement Design' },
      { mot: 'SLACK', debit: '6132', credit: '', note: 'Abonnement Communication' },
      { mot: 'ZOOM', debit: '6132', credit: '', note: 'Visioconférence' },
      { mot: 'NOTION', debit: '6132', credit: '', note: 'Abonnement Logiciel' },
      { mot: 'GITHUB', debit: '6132', credit: '', note: 'Hébergement Code & Web' },
      { mot: 'VERCEL', debit: '6132', credit: '', note: 'Hébergement Web' },
      { mot: 'MICROSOFT', debit: '6132', credit: '', note: 'Abonnement Office / Software' },
      { mot: 'APPLE', debit: '6132', credit: '', note: 'Services & Logiciels Apple' },
      { mot: 'GOOGLE', debit: '6132', credit: '', note: 'Google Workspace / Cloud' },
      { mot: 'OVH', debit: '6132', credit: '', note: 'Hébergement Web' },
      { mot: 'SCALEWAY', debit: '6132', credit: '', note: 'Hébergement Cloud' },

      // Frais bancaires & Commissions (627)
      { mot: 'FRAIS PLVT SEPA', debit: '627', credit: '', note: 'Frais bancaires' },
      { mot: 'FRAIS PLVT', debit: '627', credit: '', note: 'Frais bancaires' },
      { mot: 'FRAIS SEPA', debit: '627', credit: '', note: 'Frais bancaires' },
      { mot: 'FRAIS BANCAIRE', debit: '627', credit: '', note: 'Frais bancaires' },
      { mot: 'FRAIS BANCAIRES', debit: '627', credit: '', note: 'Frais bancaires' },
      { mot: 'FRAIS TENUE DE COMPTE', debit: '627', credit: '', note: 'Frais bancaires' },
      { mot: 'COTISATION BANQUE', debit: '627', credit: '', note: 'Frais bancaires' },
      { mot: 'COTISATION CARTE', debit: '627', credit: '', note: 'Frais bancaires' },
      { mot: 'FRAIS CB', debit: '627', credit: '', note: 'Frais bancaires' },
      { mot: 'MAGNETIQ', debit: '627', credit: '', note: 'Frais bancaires' },
      { mot: 'COMMISSION BANCAIRE', debit: '627', credit: '', note: 'Frais bancaires' },

      // Déplacements & Repas (625)
      { mot: 'TOTAL', debit: '625', credit: '', note: 'Carburant' },
      { mot: 'SHELL', debit: '625', credit: '', note: 'Carburant' },
      { mot: 'BP', debit: '625', credit: '', note: 'Carburant' },
      { mot: 'ESSO', debit: '625', credit: '', note: 'Carburant' },
      { mot: 'SNCF', debit: '625', credit: '', note: 'Billets de train' },
      { mot: 'UBER', debit: '625', credit: '', note: 'Frais VTC' },
      { mot: 'RATP', debit: '625', credit: '', note: 'Transports' },
      { mot: 'AIR FRANCE', debit: '625', credit: '', note: 'Billets d\'avion' },
      { mot: 'AUTOROUTE', debit: '625', credit: '', note: 'Péages' },
      { mot: 'VINCI', debit: '625', credit: '', note: 'Péages & Stationnement' },

      // Téléphonie & Telecom (626)
      { mot: 'ORANGE', debit: '626', credit: '', note: 'Téléphonie & Internet' },
      { mot: 'SFR', debit: '626', credit: '', note: 'Téléphonie & Internet' },
      { mot: 'BOUYGUES', debit: '626', credit: '', note: 'Téléphonie & Internet' },
      { mot: 'FREE MOBILE', debit: '626', credit: '', note: 'Téléphonie' },
      { mot: 'FREE TELECOM', debit: '626', credit: '', note: 'Téléphonie & Internet' },
      { mot: 'LAPOSTE', debit: '626', credit: '', note: 'Courrier & Timbres' },
      { mot: 'LA POSTE', debit: '626', credit: '', note: 'Courrier & Timbres' },

      // Recettes (706, 756, 758)
      { mot: 'COTIS', debit: '', credit: '756', note: 'Cotisation adhérent' },
      { mot: 'ADHESION', debit: '', credit: '756', note: 'Adhésion' },
      { mot: 'DONATION', debit: '', credit: '758', note: 'Don particulier' },
      { mot: 'MECENAT', debit: '', credit: '758', note: 'Mécénat d\'entreprise' },
      { mot: 'STRIPE', debit: '', credit: '706', note: 'Recettes Ventes / Services' },
      { mot: 'SUMUP', debit: '', credit: '706', note: 'Recettes Ventes / Services' }
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

    return null;
  },

  /**
   * Crée une règle de catégorisation définitive et l'enregistre dans le store rules
   */
  ajouterRegle(motCle, compteSelectionne, typeTransaction) {
    const cleanMotCle = this.normaliserTexte(motCle);
    if (!cleanMotCle) return false;

    const debit = typeTransaction === 'debit' ? compteSelectionne : '';
    const credit = typeTransaction === 'credit' ? compteSelectionne : '';

    const currentRules = [...get(rules)];
    const indexExistant = currentRules.findIndex(r => this.normaliserTexte(r.motCle) === cleanMotCle);
    
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
      currentRules.unshift(nouvelleRegle);
    }

    updateRules(currentRules);
    return true;
  },

    /**
   * Retourne le nom du compte au format : "Nom de la catégorie (Code)"
   */
  obtenirLibelleCompte(numCompte) {
    if (!numCompte || numCompte === '699') return '« Choisir une catégorie... »';
    const cpt = get(planComptable).find(p => p.compte === String(numCompte));
    if (!cpt) return `Compte (${numCompte})`;
    return cpt.libelle.replace(/\s*\(\d+\)\s*/g, '').trim();
  }
};