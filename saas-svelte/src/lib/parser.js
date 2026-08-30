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
    let lignes = rawCsvText.split(/\r?\n/);
    if (lignes.length === 0) return [];

    // On ignore les lignes vides
    lignes = lignes.filter(l => l.trim() !== '');

    const premiereLigne = lignes[0];
    let separateur = ';';
    if (premiereLigne.split(',').length > premiereLigne.split(';').length) {
      separateur = ',';
    }

    let indexDate, indexLibelle, indexDebit, indexCredit, indexMontant, indexInfo, indexTypeOp, indexReference;
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
      modeMontant = mappingConfig.modeMontant || 'double';
    } else {
      // Extraction et normalisation des en-têtes (sans accents, sans caractères spéciaux pour contrer les encodages brisés)
      const entetes = premiereLigne.split(separateur).map(h => {
        return h.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Enlève les accents
          .replace(/[^a-z0-9]/g, '') // Conserve uniquement l'alphanumérique (ex: dÃ©bit -> dbit)
          .trim();
      });
      
      // Détection des indices des colonnes par racines sémantiques ultra-résilientes
      indexDate = entetes.findIndex(h => h.includes('dat'));
      indexLibelle = entetes.findIndex(h => h.includes('lib') || h.includes('tex') || h.includes('des'));
      indexDebit = entetes.findIndex(h => h.includes('deb') || h.includes('dep') || h.includes('sor'));
      indexCredit = entetes.findIndex(h => h.includes('cre') || h.includes('rec') || h.includes('ent'));
      indexMontant = entetes.findIndex(h => h.includes('mon') || h.includes('val') || h.includes('som') || h.includes('amo'));
      indexInfo = entetes.findIndex(h => h.includes('inf') || h.includes('det') || h.includes('com'));
      indexTypeOp = entetes.findIndex(h => h.includes('typ') || h.includes('mod') || h.includes('pai'));
      indexReference = entetes.findIndex(h => h.includes('ref') || h.includes('num') || h.includes('ide'));

      modeMontant = (indexDebit !== -1 || indexCredit !== -1) ? 'double' : 'single';
    }

    const transactions = [];

    for (let i = 1; i < lignes.length; i++) {
      const cellules = this.splitLineRespectingQuotes(lignes[i], separateur);
      if (cellules.length < 2) continue; // Ligne invalide

      const rawDate = indexDate !== -1 ? cellules[indexDate] || '' : '';
      const rawLibelle = indexLibelle !== -1 ? cellules[indexLibelle] || 'Opération sans libellé' : 'Opération sans libellé';
      const rawInfo = indexInfo !== -1 ? cellules[indexInfo] || '' : '';
      const rawTypeOp = indexTypeOp !== -1 && indexTypeOp !== undefined ? cellules[indexTypeOp] || '' : '';
      const rawReference = indexReference !== -1 && indexReference !== undefined ? cellules[indexReference] || '' : '';

      const dateStr = this.normaliserDate(rawDate);
      const libelle = rawLibelle.trim();
      const info = rawInfo.trim();
      const typeOperation = rawTypeOp.trim();
      const reference = rawReference.trim();
      
      let debit = 0;
      let credit = 0;

      // Détection du mode de colonnes (Débit/Crédit séparés OU Colonne unique Montant +/-)
      if (modeMontant === 'double') {
        const rawDebit = indexDebit !== -1 ? cellules[indexDebit] || '' : '';
        const rawCredit = indexCredit !== -1 ? cellules[indexCredit] || '' : '';
        debit = Math.abs(this.parseMontant(rawDebit));
        credit = Math.abs(this.parseMontant(rawCredit));
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
        libelle: libelle,
        info: info,
        debit: debit,
        credit: credit,
        typeOperation: typeOperation,
        reference: reference,
        compteAttribué: null, // Sera défini par le catégoriseur
        regleAppliquee: null,
        statut: 'non_attribue', // 'attribue', 'non_attribue', 'suggere'
        importId: null
      });
    }

    return transactions;
  },

  /**
   * Sépare les cellules d'une ligne en respectant les guillemets (si champs textuels entourés de guillemets)
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
    
    // Nettoyage de la chaîne
    let str = String(val).trim()
      .replace('€', '')
      .replace(/\s/g, '') // Supprime les espaces (séparateurs de milliers)
      .replace(/\u00a0/g, ''); // Espace insécable
      
    if (str === '' || str === '-') return 0;
    
    // Si format français (ex: 1250,50) : on remplace la virgule par un point
    str = str.replace(',', '.');
    
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  },

  /**
   * Normalise les dates au format standard AAAA-MM-JJ pour manipulation facile
   */
  normaliserDate(val) {
    if (!val) return '';
    const str = String(val).trim();

    // Format DD/MM/YYYY
    const matchFR = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (matchFR) {
      const jour = matchFR[1].padStart(2, '0');
      const mois = matchFR[2].padStart(2, '0');
      const annee = matchFR[3];
      return `${annee}-${mois}-${jour}`;
    }

    // Format YYYY-MM-DD
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
