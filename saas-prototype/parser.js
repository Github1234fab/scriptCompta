/**
 * ═══════════════════════════════════════════════════════════════════
 * PARSER CSV - PROTOTYPE SAAS COMPTABILITÉ
 * ═══════════════════════════════════════════════════════════════════
 */

const CSVParser = {
  /**
   * Analyse une chaîne brute CSV et retourne un tableau d'objets transaction
   */
  parse(rawCsvText) {
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

    // Extraction des en-têtes
    const entetes = premiereLigne.split(separateur).map(h => h.trim().toLowerCase());
    
    // Détection des indices des colonnes importantes
    const indexDate = entetes.findIndex(h => h.includes('date'));
    const indexLibelle = entetes.findIndex(h => h.includes('libelle') || h.includes('libellé') || h.includes('texte') || h.includes('description'));
    const indexDebit = entetes.findIndex(h => h.includes('debit') || h.includes('débit') || h.includes('depense') || h.includes('dépense') || h.includes('sorti'));
    const indexCredit = entetes.findIndex(h => h.includes('credit') || h.includes('crédit') || h.includes('recette') || h.includes('entree') || h.includes('entrée'));
    const indexInfo = entetes.findIndex(h => h.includes('info') || h.includes('detail') || h.includes('détail') || h.includes('compl'));

    const transactions = [];

    for (let i = 1; i < lignes.length; i++) {
      const cellules = this.splitLineRespectingQuotes(lignes[i], separateur);
      if (cellules.length < 2) continue; // Ligne invalide

      const rawDate = cellules[indexDate] || '';
      const rawLibelle = cellules[indexLibelle] || 'Opération sans libellé';
      const rawDebit = cellules[indexDebit] || '';
      const rawCredit = cellules[indexCredit] || '';
      const rawInfo = indexInfo !== -1 ? cellules[indexInfo] || '' : '';

      const dateStr = this.normaliserDate(rawDate);
      const libelle = rawLibelle.trim();
      const info = rawInfo.trim();
      
      const debit = this.parseMontant(rawDebit);
      const credit = this.parseMontant(rawCredit);

      // Si c'est une ligne vide ou de totaux, on l'écarte
      if (!dateStr || (debit === 0 && credit === 0)) continue;

      transactions.push({
        id: 'tx-' + i + '-' + Date.now(),
        date: dateStr,
        libelle: libelle,
        info: info,
        debit: debit,
        credit: credit,
        compteAttribué: null, // Sera défini par le catégoriseur
        regleAppliquee: null,
        statut: 'non_attribue' // 'attribue', 'non_attribue', 'suggere'
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
