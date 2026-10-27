/**
 * ═══════════════════════════════════════════════════════════════════
 * PARSER CSV - PROTOTYPE SAAS COMPTABILITÉ
 * ═══════════════════════════════════════════════════════════════════
 */

export const CSVParser = {
  /**
   * Analyse une chaîne brute CSV et retourne un tableau d'objets transaction
   */
  parse(rawCsvText, mappingConfig = null) {
    if (!rawCsvText || rawCsvText.trim() === '') return [];

    // Détection du séparateur (point-virgule ou virgule)
    let lignes = rawCsvText.split(/\r\n|\r|\n/);
    if (lignes.length === 0) return [];

    // On ignore les lignes vides
    lignes = lignes.filter(l => l.trim() !== '');

    const premiereLigne = lignes[0];
    let separateur = ';';
    if (premiereLigne.split(',').length > premiereLigne.split(';').length) {
      separateur = ',';
    }

    let indexDate, indexLibelle, indexDebit, indexCredit, indexMontant, indexInfo, indexTypeOp, indexReference;
    let selectedConcatBlocks = null;
    let modeMontant = 'double';

    if (mappingConfig) {
      separateur = mappingConfig.separateur || separateur;
      indexDate = mappingConfig.indexDate;
      indexLibelle = mappingConfig.indexLibelle;
      indexDebit = mappingConfig.indexDebit;
      indexCredit = mappingConfig.indexCredit;
      indexMontant = mappingConfig.indexMontant;
      indexInfo = mappingConfig.indexInfo;
      indexTypeOp = mappingConfig.indexTypeOp;
      indexReference = mappingConfig.indexReference;
      selectedConcatBlocks = mappingConfig.selectedConcatBlocks || null;
      modeMontant = mappingConfig.modeMontant || 'double';
    } else {
      // Extraction et normalisation des en-têtes
      const entetes = premiereLigne.split(separateur).map(h => {
        return h.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Enlève les accents
          .replace(/[^a-z0-9]/g, '') // Conserve uniquement l'alphanumérique
          .trim();
      });
      
      // Colonnes d'informations textuelles ou de métadonnées qui ne doivent JAMAIS être considérées comme Débit, Crédit ou Montant
      const isTextOrMetaHeader = (h) => (
        h.includes('inf') || h.includes('det') || h.includes('com') || 
        h.includes('lib') || h.includes('ref') || h.includes('typ') || 
        h.includes('mod') || h.includes('poi') || h.includes('cat') ||
        h.includes('tex') || h.includes('des') || h.includes('num') ||
        h.includes('rem') || h.includes('obs') || h.includes('noti')
      );

      // Détection des en-têtes avec priorité stricte pour éviter les collisions (ex: "date de valeur" ne doit JAMAIS matcher le montant)
      indexDate = entetes.findIndex(h => h.includes('dat') && !h.includes('val'));
      if (indexDate === -1) indexDate = entetes.findIndex(h => h.includes('dat'));

      indexLibelle = entetes.findIndex(h => !h.includes('dat') && (h.includes('lib') || h.includes('tex') || h.includes('des') || h.includes('mot') || h.includes('nom')));
      
      // Débit et Crédit : Détection stricte, ne doivent JAMAIS matcher une colonne informative (comme 'informationscomplementaires')
      indexDebit = entetes.findIndex(h => !h.includes('dat') && !isTextOrMetaHeader(h) && (
        h === 'debit' || h === 'debits' || h === 'depense' || h === 'depenses' || h === 'sortie' || h === 'sorties' ||
        h.startsWith('deb') || h.startsWith('dep') || h.startsWith('sort')
      ));

      indexCredit = entetes.findIndex(h => !h.includes('dat') && !isTextOrMetaHeader(h) && (
        h === 'credit' || h === 'credits' || h === 'recette' || h === 'recettes' || h === 'entree' || h === 'entrees' ||
        h.startsWith('cred') || h.startsWith('recett') || h.startsWith('entr')
      ));
      
      // Montant : priorité absolue à "montant", "amount", "somme". Exclure formellement toute colonne contenant "dat" (comme "date valeur")
      indexMontant = entetes.findIndex(h => !h.includes('dat') && !isTextOrMetaHeader(h) && (
        h === 'montant' || h === 'amount' || h === 'somme' || h.startsWith('mont') || h.startsWith('amoun') || h.startsWith('somm')
      ));
      if (indexMontant === -1) {
        indexMontant = entetes.findIndex(h => !h.includes('dat') && !isTextOrMetaHeader(h) && (
          h === 'valeur' || h === 'total' || h === 'solde'
        ));
      }

      indexInfo = entetes.findIndex(h => !h.includes('dat') && (h.includes('inf') || h.includes('detail') || h.includes('complement') || h.includes('motif') || (h.includes('com') && !h.includes('compt'))));
      indexTypeOp = entetes.findIndex(h => h.includes('typ') || h.includes('mod') || h.includes('pai'));
      indexReference = entetes.findIndex(h => h.includes('ref') || h.includes('num') || h.includes('ide'));

      modeMontant = (indexDebit !== -1 || indexCredit !== -1) ? 'double' : 'single';
    }

    const transactions = [];

    for (let i = 1; i < lignes.length; i++) {
      const cellules = this.splitLineRespectingQuotes(lignes[i], separateur);
      if (cellules.length < 2) continue; // Ligne invalide

      const rawDate = indexDate !== -1 ? cellules[indexDate] || '' : '';
      const rawLibelle = indexLibelle !== -1 ? cellules[indexLibelle] || '' : '';
      const rawInfo = indexInfo !== -1 ? cellules[indexInfo] || '' : '';
      const rawTypeOp = indexTypeOp !== -1 && indexTypeOp !== undefined ? cellules[indexTypeOp] || '' : '';
      const rawReference = indexReference !== -1 && indexReference !== undefined ? cellules[indexReference] || '' : '';

      const dateStr = this.normaliserDate(rawDate);
      const info = rawInfo.trim();
      const typeOperation = rawTypeOp.trim();
      const reference = rawReference.trim();
      
      // Assemblage dynamique des blocs sélectionnés par l'utilisateur
      let compositeBlocks = [];
      if (selectedConcatBlocks && Array.isArray(selectedConcatBlocks) && selectedConcatBlocks.length > 0) {
        compositeBlocks = selectedConcatBlocks
          .map(idx => cellules[idx] ? cellules[idx].trim() : '')
          .filter(b => b.length > 0);
      } else {
        if (rawLibelle) compositeBlocks.push(rawLibelle.trim());
        if (reference) compositeBlocks.push(reference);
        if (info) compositeBlocks.push(info);
      }

      const finalLibelle = compositeBlocks.length > 0 ? compositeBlocks.join(' | ') : (rawLibelle || 'Opération sans libellé');
      
      let debit = 0;
      let credit = 0;

      // Détection du mode de colonnes (Débit/Crédit séparés OU Colonne unique Montant +/-)
      if (modeMontant === 'double') {
        const rawDebit = indexDebit !== -1 ? cellules[indexDebit] || '' : '';
        const rawCredit = indexCredit !== -1 ? cellules[indexCredit] || '' : '';
        debit = Math.abs(this.parseMontant(rawDebit));
        credit = Math.abs(this.parseMontant(rawCredit));

        // Règle comptable bancaire : une opération est soit un débit, soit un crédit, JAMAIS les deux
        if (debit > 0 && credit > 0) {
          if (this.parseMontant(rawDebit) > 0 && this.parseMontant(rawCredit) === 0) {
            credit = 0;
          } else if (this.parseMontant(rawCredit) > 0 && this.parseMontant(rawDebit) === 0) {
            debit = 0;
          } else {
            // Priorité au débit si une anomalie subsiste
            credit = 0;
          }
        }
      } else if (modeMontant === 'single' && indexMontant !== -1) {
        const rawMontant = cellules[indexMontant] || '';
        const montant = this.parseMontant(rawMontant);
        if (montant < 0) {
          debit = Math.abs(montant);
          credit = 0;
        } else {
          debit = 0;
          credit = montant;
        }
      }

      // Si c'est une ligne vide ou de totaux, on l'écarte
      if (!dateStr || (debit === 0 && credit === 0)) continue;

      transactions.push({
        id: 'tx-' + i + '-' + Date.now(),
        date: dateStr,
        libelle: finalLibelle,
        rawLibelle: rawLibelle.trim(),
        info: info,
        debit: debit,
        credit: credit,
        typeOperation: typeOperation,
        reference: reference,
        blocks: compositeBlocks,
        rawCells: cellules,
        compteAttribué: null, // Sera défini par le catégoriseur
        regleAppliquee: null,
        statut: 'non_attribue', // 'attribue', 'non_attribue', 'suggere'
        importId: null
      });
    }

    return transactions;
  },

  /**
   * Extrait les en-têtes d'un fichier CSV
   * @param {string} rawCsvText
   * @returns {string[]}
   */
  extractHeaders(rawCsvText) {
    if (!rawCsvText) return [];
    const firstLine = rawCsvText.split(/\r\n|\r|\n/)[0];
    if (!firstLine) return [];
    const sep = firstLine.split(',').length > firstLine.split(';').length ? ',' : ';';
    return this.splitLineRespectingQuotes(firstLine, sep).map(h => h.trim().replace(/^"|"$/g, ''));
  },

  /**
   * Sépare les cellules d'une ligne en respectant les guillemets
   */
  splitLineRespectingQuotes(line, separator) {
    const result = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === separator && !insideQuotes) {
        result.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    result.push(currentCell.trim());
    return result;
  },

  /**
   * Analyse un montant au format français et retourne un nombre flottant propre
   */
  parseMontant(val) {
    if (val === undefined || val === null) return 0;
    
    let str = String(val).trim()
      .replace('€', '')
      .replace(/\s/g, '')
      .replace(/\u00a0/g, '');
      
    if (str === '' || str === '-') return 0;
    
    // Si la chaîne a la structure d'une date (ex: 10/09/2026 ou 10-09-26), ce n'est pas un montant
    if (/^\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}$/.test(str)) return 0;

    // Si la chaîne contient des lettres (ex: texte descriptif "110926 CB 9049-98,00EUR"), ce n'est PAS un montant
    if (/[a-zA-Z]/.test(str)) return 0;

    // Gestion propre des séparateurs de milliers et décimaux
    if (str.includes(',') && str.includes('.')) {
      if (str.indexOf('.') < str.indexOf(',')) {
        str = str.replace(/\./g, '').replace(',', '.');
      } else {
        str = str.replace(/,/g, '');
      }
    } else {
      str = str.replace(',', '.');
    }

    // Validation stricte : uniquement signe optionnel, chiffres, et décimales optionnelles
    if (!/^[+-]?\d+(\.\d+)?$/.test(str)) return 0;

    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  },

  /**
   * Normalise les dates au format standard AAAA-MM-JJ
   */
  normaliserDate(val) {
    if (!val) return '';
    const str = String(val).trim();

    const matchFR = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (matchFR) {
      const jour = matchFR[1].padStart(2, '0');
      const mois = matchFR[2].padStart(2, '0');
      const annee = matchFR[3];
      return `${annee}-${mois}-${jour}`;
    }

    const matchISO = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (matchISO) {
      const annee = matchISO[1];
      const mois = matchISO[2].padStart(2, '0');
      const jour = matchISO[3].padStart(2, '0');
      return `${annee}-${mois}-${jour}`;
    }

    return '';
  }
};
