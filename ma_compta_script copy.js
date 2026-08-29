/**
 * ═══════════════════════════════════════════════════════════════════
 * SCRIPT DE COMPTABILITÉ POUR ASSOCIATION
 * ═══════════════════════════════════════════════════════════════════
 * 
 * VERSION FINALE - NETTOYÉE - PRÊTE À L'EMPLOI
 * 
 * Gère l'import de données bancaires CSV et génère :
 * - Journal
 * - Grand Livre
 * - Balance
 * - Documents par exercice (1er sept → 31 août)
 * - Rapports de classification
 * 
 * CORRECTIONS APPLIQUÉES :
 * ✅ EVI + nom → 706 (Virements reçus élèves)
 * ✅ REMISE EUROPRELEVEMENT → 756 (Prélèvements SEPA élèves)
 * ✅ VIR INST + nom prof → 641 (Salaires profs)
 * ✅ Tout régénérer = inclut les exercices existants
 * 
 * INSTALLATION :
 * 1. Ouvrez votre Google Sheet
 * 2. Extensions > Apps Script
 * 3. Sélectionnez TOUT le code existant (Ctrl+A)
 * 4. Supprimez-le
 * 5. Collez ce fichier complet
 * 6. Enregistrez (Ctrl+S)
 * 7. Rechargez votre Google Sheet (F5)
 * 
 * ═══════════════════════════════════════════════════════════════════
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  FEUILLES: {
    DONNEES_BRUTES: 'Données Brutes',
    JOURNAL: 'Journal',
    GRAND_LIVRE: 'Grand Livre',
    BALANCE: 'Balance',
    PLAN_COMPTABLE: 'Plan Comptable',
    REGLES_ATTRIBUTION: 'Règles d\'Attribution',
    CONFIG_CSV: '⚙️ Configuration CSV'
  },
  
  EXERCICE: {
    DEBUT_MOIS: 9 // Par défaut Septembre
  }
};

/**
 * Récupère le mapping des colonnes CSV depuis la feuille de configuration
 */
function getMappingCSV() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const feuille = ss.getSheetByName(CONFIG.FEUILLES.CONFIG_CSV);
  
  const defaut = {
    DATE_COMPTABLE: 0,
    DATE_OPERATION: 1,
    LIBELLE: 2,
    INFO_COMPLEMENTAIRE: 3,
    REFERENCE: 4,
    DATE_VALEUR: 5,
    TYPE_OPERATION: 6,
    DEBIT: 7,
    CREDIT: 8
  };
  
  if (!feuille || feuille.getLastRow() <= 1) return defaut;
  
  const data = feuille.getRange(2, 1, feuille.getLastRow() - 1, 2).getValues();
  const mapping = {};
  
  data.forEach(row => {
    if (row[0] && row[1]) {
      const val = String(row[0]).toUpperCase();
      const idx = lettreVersIndex(row[1]);
      
      if (val.includes('TYPE')) mapping['TYPE_OPERATION'] = idx;
      else if (val.includes('ESSENTIEL') && val.includes('DATE')) mapping['DATE_COMPTABLE'] = idx;
      else if (val.includes('COMPTABLE')) mapping['DATE_OPERATION'] = idx;
      else if (val.includes('VALEUR')) mapping['DATE_VALEUR'] = idx;
      else if (val.includes('OPÉRATION') || val.includes('OPERATION')) mapping['DATE_OPERATION'] = idx;
      else if (val.includes('LIBEL')) mapping['LIBELLE'] = idx;
      else if (val.includes('INFO') || val.includes('DÉTAIL') || val.includes('DETAIL')) mapping['INFO_COMPLEMENTAIRE'] = idx;
      else if (val.includes('REF') || val.includes('RÉF')) mapping['REFERENCE'] = idx;
      else if (val.includes('DEBIT') || val.includes('DÉBIT')) mapping['DEBIT'] = idx;
      else if (val.includes('CREDIT') || val.includes('CRÉDIT')) mapping['CREDIT'] = idx;
    }
  });
  
  // --- LOGIQUE DE REPLI (FALLBACKS) ---
  const datePrincipale = mapping['DATE_COMPTABLE'] !== undefined ? mapping['DATE_COMPTABLE'] : 0;
  const libellePrincipal = mapping['LIBELLE'] !== undefined ? mapping['LIBELLE'] : 2;

  return {
    DATE_COMPTABLE: datePrincipale,
    DATE_OPERATION: mapping['DATE_OPERATION'] !== undefined ? mapping['DATE_OPERATION'] : datePrincipale,
    DATE_VALEUR: mapping['DATE_VALEUR'] !== undefined ? mapping['DATE_VALEUR'] : datePrincipale,
    LIBELLE: libellePrincipal,
    INFO_COMPLEMENTAIRE: mapping['INFO_COMPLEMENTAIRE'] !== undefined ? mapping['INFO_COMPLEMENTAIRE'] : libellePrincipal,
    REFERENCE: mapping['REFERENCE'] !== undefined ? mapping['REFERENCE'] : 4,
    DATE_VALEUR: mapping['DATE_VALEUR'] !== undefined ? mapping['DATE_VALEUR'] : datePrincipale,
    TYPE_OPERATION: mapping['TYPE_OPERATION'] !== undefined ? mapping['TYPE_OPERATION'] : 6,
    DEBIT: mapping['DEBIT'] !== undefined ? mapping['DEBIT'] : 7,
    CREDIT: mapping['CREDIT'] !== undefined ? mapping['CREDIT'] : 8
  };
}

/**
 * Convertit une lettre de colonne (A, B, C...) ou un chiffre (1, 2, 3...) en index 0
 */
function lettreVersIndex(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  
  const str = String(val).toUpperCase().trim();
  
  // On extrait uniquement les lettres (ex: A1 -> A, B2 -> B)
  const lettersOnly = str.match(/[A-Z]+/);
  if (lettersOnly) {
    const s = lettersOnly[0];
    let result = 0;
    for (let i = 0; i < s.length; i++) {
      result = result * 26 + (s.charCodeAt(i) - 64);
    }
    return result - 1; // On passe en 0-indexed
  }
  
  // Si c'est un chiffre pur (ex: "8")
  if (!isNaN(str)) return parseInt(str);
  
  return 0;
}

const CONFIG_DETAIL_PAIEMENTS = {
  FEUILLE: 'Détail Paiements Élèves',
  FEUILLE_MONTANTS: 'Montants Facturés',
  COMPTES: {
    PRESTATIONS: '706',
    COTISATIONS: '756'
  }
};

// On définit une fonction pour récupérer la configuration car le mois de début peut changer
function getConfigurationExercices() {
  const moisDebut = parseInt(PropertiesService.getUserProperties().getProperty('DEBUT_MOIS_EXERCICE')) || 9;
  return {
    DEBUT_MOIS: moisDebut,
    DEBUT_JOUR: 1,
    FIN_MOIS: moisDebut === 1 ? 12 : moisDebut - 1,
    FIN_JOUR: 31,
    
    FEUILLES: {
      JOURNAL_EXERCICE: 'Journal ',
      GRAND_LIVRE_EXERCICE: 'Grand Livre ',
      BALANCE_EXERCICE: 'Balance ',
      RESULTAT_EXERCICE: 'Résultat ',
      BILAN_EXERCICE: 'Bilan ',
      SYNTHESE: 'Synthèse Exercices'
    }
  };
}

let CONFIG_EXERCICES = getConfigurationExercices();

// ============================================
// MENU PERSONNALISÉ
// ============================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  ui.createMenu('💼 Comptabilité')
    .addItem('📖 Mode d\'emploi', 'afficherModeDEmploi')
    .addSeparator()
    .addItem('📥 Importer les données CSV', 'importerDonnees')
    .addSeparator()
    .addItem('📖 Générer le Journal', 'genererJournal')
    .addItem('📚 Générer le Grand Livre', 'genererGrandLivre')
    .addItem('⚖️ Générer la Balance', 'genererBalance')
    .addSeparator()
    .addItem('🔄 Mettre à jour', 'toutRegenerer')
    .addSeparator()
    .addSubMenu(ui.createMenu('📅 Clôture par Exercice')
      .addItem('📊 Choisir et générer un exercice', 'choisirExercice')
      .addItem('📈 Générer tous les exercices', 'genererTousExercices')
      .addItem('💰 Synthèse des exercices', 'genererSyntheseExercices')
      .addItem('🔚 Clôturer l\'exercice en cours', 'cloturerExerciceEnCours'))
    .addSeparator()
    .addSubMenu(ui.createMenu('🔍 Analyse & Contrôle')
      .addItem('⚠️ Rapport Non Attribué (699)', 'genererRapportNonAttribue')
      .addItem('🤖 Auto-classer avec suggestions', 'autoClasserAvecSuggestions')
      .addItem('📋 Synthèse des règles (Vérification)', 'genererTableauSyntheseRegles')
      .addItem('🔄 Restaurer catalogue par défaut', 'restaurerReglesParDefaut')
      .addSeparator()
      .addItem('📊 Statistiques de classification', 'afficherStatistiquesClassification')
      .addItem('⚙️ Configurer l\'exercice', 'configurerExercice')
      .addItem('📋 Afficher les règles d\'origine', 'afficherReglesAttribution'))
    .addSeparator()
    .addSubMenu(ui.createMenu('💰 Paiements Élèves')
      .addItem('📋 Générer le détail des paiements', 'genererDetailPaiementsEleves')
      .addItem('💰 Saisir les montants facturés', 'saisirMontantsFactures'))
    .addSeparator()
    .addItem('⚙️ Configurer les colonnes CSV', 'ouvrirConfigCSV')
    .addItem('📅 Régler le mois de début d\'exercice', 'ouvrirParametresExercice')
    .addSeparator()
    .addItem('⚙️ Initialiser toutes les feuilles', 'initialiserFeuilles')
    .addToUi();
}

// ============================================
// INITIALISATION
// ============================================

function initialiserFeuilles() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  Object.values(CONFIG.FEUILLES).forEach(nomFeuille => {
    let feuille = ss.getSheetByName(nomFeuille);
    if (!feuille) {
      feuille = ss.insertSheet(nomFeuille);
    } else if (nomFeuille !== CONFIG.FEUILLES.REGLES_ATTRIBUTION) {
      // On ne vide pas la feuille de règles pour conserver le catalogue utilisateur
      feuille.clear();
    }
  });
  
  initialiserPlanComptable();
  initialiserReglesAttribution(ss);
  initialiserConfigCSV(ss);
  initialiserEntetes();
  
  SpreadsheetApp.getUi().alert('✅ Feuilles initialisées avec succès !');
}

function initialiserConfigCSV(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  const feuille = ss.getSheetByName(CONFIG.FEUILLES.CONFIG_CSV);
  
  // On vide la feuille pour appliquer le nouveau modèle simplifié (les mappings seront à refaire)
  feuille.clear();
  
  const entetes = [['Nom des colonnes de votre CSV', 'Lettre de la colonne (ex: A, B, C...)']];
  const data = [
    ['【 ESSENTIEL 】 Date de l\'opération (pour le Journal)', 'A'],
    ['【 ESSENTIEL 】 Le libellé (le texte)', 'C'],
    ['【 ESSENTIEL 】 Le montant Débit (votre dépense)', 'H'],
    ['【 ESSENTIEL 】 Le montant Crédit (votre recette)', 'I'],
    ['Le numéro de pièce / référence (Optionnel)', 'E'],
    ['Détails complémentaires (Optionnel)', 'D'],
    ['Date comptable secondaire (Optionnel)', 'B'],
    ['Date de valeur (Optionnel)', 'F'],
    ['Type d\'opération (Optionnel)', 'G']
  ];
  
  feuille.getRange('A1:B1').setValues(entetes).setFontWeight('bold').setBackground('#444444').setFontColor('white');
  feuille.getRange(2, 1, data.length, 2).setValues(data);
  feuille.autoResizeColumns(1, 2);
  
  const note = "MODE D'EMPLOI RAPIDE :\n\n1. Regardez votre fichier bancaire (relevé).\n2. Notez la lettre de la colonne pour chaque champ (A, B, C...).\n3. Tapez cette lettre dans la colonne B ci-contre.\n\nLes 4 premiers champs sont OBLIGATOIRES.\nLes autres sont optionnels.\n\nUne fois fini, cliquez sur : \nMenu > Comptabilité > Mettre à jour";
  feuille.getRange('D1').setValue(note).setWrap(true);
  feuille.getRange('D1').setBackground('#f8f9fa').setBorder(true, true, true, true, false, false, '#dddddd', SpreadsheetApp.BorderStyle.SOLID);
  feuille.setColumnWidth(4, 400);
}

/**
 * Trigger interactif pour l'Assistant de Classification
 */
function onSelectionChange(e) {
  if (!e) return;
  const range = e.range;
  const sheet = range.getSheet();
  
  if (sheet.getName() === 'Rapport Non Attribué' && range.getColumn() === 5 && range.getRow() >= 3) {
    const value = range.getValue();
    if (value === true || value === 'TRUE') {
      assistantCreationRegle(range);
    }
  }
}

/**
 * Trigger onEdit pour les cases à cocher (plus fiable que onSelectionChange)
 */
function onEdit(e) {
  if (!e) return;
  const range = e.range;
  const sheet = range.getSheet();
  const nomSheet = sheet.getName();
  
  if (e.value === 'TRUE' || e.value === true) {
    // 1. Rapport Non Attribué (Col 5)
    if (nomSheet === 'Rapport Non Attribué' && range.getColumn() === 5 && range.getRow() >= 3) {
      assistantCreationRegle(range);
    }
    // 2. Master Override dans Données Brutes (Col 10)
    else if (nomSheet === CONFIG.FEUILLES.DONNEES_BRUTES && range.getColumn() === 10 && range.getRow() >= 2) {
      assistantCreationRegle(range);
    }
  }
}

function initialiserReglesAttribution(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  let feuille = ss.getSheetByName(CONFIG.FEUILLES.REGLES_ATTRIBUTION);
  
  if (!feuille) {
    feuille = ss.insertSheet(CONFIG.FEUILLES.REGLES_ATTRIBUTION);
  }
  
  if (feuille.getLastRow() > 0) return; // Ne pas écraser si déjà rempli
  
  const entetes = [['Mot-clé du libellé', 'Compte Débit', 'Compte Crédit', 'Description/Note']];
  feuille.getRange('A1:D1').setValues(entetes);
  feuille.getRange('A1:D1').setFontWeight('bold').setBackground('#444444').setFontColor('white');
  feuille.getRange('B:C').setHorizontalAlignment('center');
  
  Utilities.sleep(200); // Petite pause
  
  const reglesInitiales = [
    // --- RECETTES (CRÉDIT) ---
    ['REMISE EUROPRELEVEMENT', '', '756', 'Cotisations membres'],
    ['EUROPRELEVEMENT', '', '756', 'Cotisations membres'],
    ['SDD', '', '756', 'Prélèvements SDD (Cotisations)'],
    ['REMISE SDD', '', '756', 'Prélèvements SDD (Cotisations)'],
    ['STRIPE', '', '706', 'Ventes en ligne Stripe'],
    ['REMISE CHEQUE', '', '706', 'Remise de chèques'],
    ['REM CHQ', '', '706', 'Remise de chèques'],
    ['SUBVENTION', '', '740', 'Subventions publiques'],
    ['MAIRIE', '', '740', 'Subvention Mairie'],
    ['CONSEIL REGIONAL', '', '740', 'Subvention Région'],
    ['DON', '', '758', 'Dons reçus (Hors profs)'],
    ['EVI M', '', '706', 'Prestation élève'],
    ['EVI MR', '', '706', 'Prestation élève'],
    ['EVI MME', '', '706', 'Prestation élève'],
    ['EVI MLLE', '', '706', 'Prestation élève'],
    ['VIR INST', '', '706', 'Virement instantané (élèves)'],
    ['COTIS CNV', '658', '756', 'Cotisation CNV (débit=charge, crédit=recette)'],

    // --- DÉPENSES (DÉBIT) ---
    // Salaires & Personnel
    ['SALAIRE', '641', '', 'Rémunérations'],
    ['SILVESTRI', '641', '', 'Salaire Prof (Silvestri)'],
    ['DEPONDT', '641', '', 'Salaire Prof (Depondt)'],
    ['CUCCHETTI', '641', '', 'Salaire Prof (Cucchetti)'],
    ['PHILBERT', '641', '', 'Salaire Prof (Philbert)'],
    ['MARCEAU', '641', '', 'Salaire Prof (Marceau)'],
    ['ANTONIOLI', '641', '', 'Salaire Prof (Antonioli)'],
    ['URSSAF', '645', '', 'Charges sociales'],
    ['POLE EMPLOI', '645', '', 'Charges sociales'],
    ['MUTUELLE', '6453', '', 'Mutuelle santé'],
    ['HARMONIE', '6453', '', 'Mutuelle santé'],
    ['AST GRAND LYON', '645', '', 'Santé au travail'],

    // Sous-traitance & Services extérieurs
    ['ARAUJO', '611', '', 'Sous-traitance'],
    ['TRANOSPHERE', '611', '', 'Sous-traitance'],
    ['ALLIROL', '611', '', 'Sous-traitance'],
    ['HEXOPEE', '658', '', 'Cotisation syndicale'],

    // Locations & Logiciels
    ['SALLES MUNICIPALES', '613', '', 'Location de salles'],
    ['VICTOR HUGO', '613', '', 'Location de salles'],
    ['ULTIMATE GUITAR', '613', '', 'Abonnement musique'],
    ['GOOGLE', '613', '', 'Abonnement Cloud/GSuite'],
    ['GSUITE', '613', '', 'Abonnement Cloud/GSuite'],
    ['WIX', '613', '', 'Hébergement Web'],
    ['ADOBE', '613', '', 'Logiciels création'],
    ['MICROSOFT', '613', '', 'Logiciels bureautique'],
    ['OFFICE 365', '613', '', 'Logiciels bureautique'],
    ['LOYER', '613', '', 'Loyer'],
    ['MC2A', '613', '', 'Abonnement logiciel MC2A / Promeom'],
    ['PROMEOM', '613', '', 'Abonnement logiciel Promeom'],
    ['AGIADES', '613', '', 'Abonnement services Agiades'],

    // Assurance & Divers
    ['MAIF', '616', '', 'Assurance'],
    ['FORMATION', '618', '', 'Frais de formation'],
    ['STAGE PROFESSIONNEL', '618', '', 'Frais de formation'],
    ['GRALYPHO', '623', '', 'Publicité/Graphisme'],
    ['VISTAPRINT', '623', '', 'Impression'],
    ['IMPRESSION', '623', '', 'Frais impression'],
    ['COPY TOP', '623', '', 'Impression Copy Top'],

    // Déplacements & Repas
    ['RESTAURANT', '625', '', 'Frais de bouche'],
    ['REPAS', '625', '', 'Frais de bouche'],
    ['KIM SUSHI', '625', '', 'Repas mission'],
    ['MIYA SUSHI', '625', '', 'Repas mission'],
    ['PUERTA DEL SOL', '625', '', 'Repas mission'],
    ['NINKASI', '625', '', 'Repas mission'],
    ['GINGER', '625', '', 'Repas mission Ginger'],
    ['LE CH\'TI POT', '625', '', 'Repas mission Le Ch\'ti Pot'],
    ['CAFE PARADIS', '625', '', 'Repas mission Café Paradis'],
    ['DIMANCHE A LA C', '625', '', 'Repas mission Dimanche à la Campagne'],
    ['SUMUP LA BOUL', '625', '', 'Repas Boulangerie'],
    ['BOULANG JASSERA', '625', '', 'Repas Boulangerie Jasserand'],
    ['ESSENCE', '625', '', 'Carburant'],
    ['ESSO', '625', '', 'Carburant'],
    ['DEFRAIEMENT', '625', '', 'Remboursement frais'],
    ['AREA', '625', '', 'Péage transport Area'],

    // Fournitures & Achats
    ['AMAZON', '606', '', 'Achats fournitures'],
    ['BUREAU VALLEE', '606', '', 'Papeterie'],
    ['LA PAPETHEQUE', '606', '', 'Papeterie La Papethèque'],
    ['SUPER U', '606', '', 'Fournitures diverses'],
    ['AUCHAN', '606', '', 'Achats fournitures Auchan'],
    ['LECLERC', '606', '', 'Achats fournitures Leclerc'],
    ['LIDL', '606', '', 'Achats fournitures Lidl'],
    ['CARREFOUR', '606', '', 'Achats fournitures Carrefour'],
    ['GIFI', '606', '', 'Achats fournitures Gifi'],
    ['DECATHLON', '606', '', 'Équipement'],
    ['LEROY MERLIN', '606', '', 'Bricolage'],
    ['THOMANN', '606', '', 'Matériel musique Thomann'],
    ['TWEETER', '606', '', 'Matériel musique Tweeter'],
    ['EFFECT ON LINE', '606', '', 'Matériel musique Effect On Line'],
    ['BACKDROP', '606', '', 'Décors photo Backdrop'],
    ['LDLC', '606', '', 'Matériel informatique LDLC'],
    ['IKEA', '606', '', 'Mobilier/Fournitures IKEA'],
    ['NEURAL DSP', '606', '', 'Logiciels/Plugins Neural DSP'],
    ['CHARTREUSE', '606', '', 'Fournitures Chartreuse'],

    // Télécoms & Poste
    ['ORANGE', '626', '', 'Télécoms'],
    ['SFR', '626', '', 'Télécoms'],
    ['FREE', '626', '', 'Télécoms'],
    ['BOUYGUES', '626', '', 'Télécoms'],
    ['LA POSTE', '626', '', 'Frais postaux'],

    // Frais Bancaires
    ['COMMISSION BANCAIRE', '627', '', 'Frais de banque'],
    ['FRAIS VIREMENT INST', '627', '', 'Frais bancaires'],
    ['COTISATION CARTE', '627', '', 'Frais bancaires'],
    ['FRAIS PAIEMENT', '627', '', 'Frais paiement carte étranger'],
    ['FRAIS COM', '627', '', 'Commissions bancaires internet'],
    ['ANN FR PRLVT', '627', '', 'Annulation frais prélèvement SEPA impayé'],
    ['GEXEL', '627', '', 'Frais de recouvrement Gexel'],
    ['HUISSIER', '627', '', 'Frais de recouvrement'],

    // Impôts & Taxes
    ['IMPOT', '635', '', 'Taxes'],
    ['CFE', '635', '', 'Cotisation Foncière des Ent.'],

    // Client/Adhérents (Litiges/Retours)
    ['REJ PRLV', '411', '', 'Rejet prélèvement client'],
    ['REMBOURSEMENT', '411', '', 'Remboursement client'],
    ['RET DISTRIBUTEUR', '530', '', 'Retrait d\'espèces distributeur'],
    ['RET DAB', '530', '', 'Retrait d\'espèces DAB'],
    ['RETRAIT DAB', '530', '', 'Retrait d\'espèces DAB'],
    ['RET PRLV', '411', '', 'Rejet prélèvement client (impayé)'],
    ['PROVISION INSUFFISANTE', '411', '', 'Rejet prélèvement client (impayé)'],
    ['SUR ORDRE DU CLIENT', '411', '', 'Rejet prélèvement client (opposition)'],
    ['REMBOURSEM PRLV', '411', '', 'Remboursement prélèvement client'],
    ['REMB', '411', '', 'Remboursement client / litige'],
    ['ANNULATION', '411', '', 'Annulation de paiement / remboursement'],
    ['ACCORDAGE', '615', '', 'Entretien et accordage instruments'],
    ['DR NEYRAND', '467', '', 'Autres débiteurs - Dr Neyrand'],
    ['SAGS HCL', '467', '', 'Autres débiteurs - Sags Hcl'],
    ['CENTRE NAUTIQUE', '467', '', 'Autres débiteurs - Centre Nautique'],
    ['AMVP', '467', '', 'Autres débiteurs - AMVP']
  ];
  
  // --- INJECTION RÉSILIENTE (LIGNE PAR LIGNE) ---
  reglesInitiales.forEach((regle, index) => {
    try {
      feuille.appendRow(regle);
      // Petite pause tous les 20 ajouts pour ne pas saturer le service
      if (index % 20 === 0) SpreadsheetApp.flush();
    } catch (e) {
      console.error('Erreur ligne ' + index + ' : ' + e.message);
    }
  });

  SpreadsheetApp.flush();
  feuille.autoResizeColumns(1, 4);
  feuille.setFrozenRows(1);
}

function restaurerReglesParDefaut() {
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    '⚠️ Restauration du catalogue',
    'Voulez-vous restaurer les 70+ règles d\'attribution par défaut ?\n\nCela effacera vos règles personnalisées actuelles.',
    ui.ButtonSet.YES_NO
  );
  
  if (confirm === ui.Button.YES) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let feuille = ss.getSheetByName(CONFIG.FEUILLES.REGLES_ATTRIBUTION);
      
      if (!feuille) {
        ui.alert('❌ Erreur : Feuille "Règles d\'Attribution" introuvable.');
        return;
      }
      
      feuille.clear();
      SpreadsheetApp.flush();
      Utilities.sleep(500); // On laisse souffler le serveur Google
      
      initialiserReglesAttribution(ss);
      SpreadsheetApp.flush();
      
      CACHE_REGLES = null;
      genererTableauSyntheseRegles(true);
      
      ui.alert('✅ Catalogue restauré et prêt !');
    } catch (e) {
      ui.alert('❌ Erreur Système : ' + e.message + '\n\nConseil : Essaie de fermer tes autres onglets Google ou d\'utiliser une fenêtre de navigation privée.');
    }
  }
}

function initialiserPlanComptable() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const feuille = ss.getSheetByName(CONFIG.FEUILLES.PLAN_COMPTABLE);
  
  feuille.getRange('A1:C1').setValues([['Compte', 'Libellé', 'Type']]);
  feuille.getRange('A1:C1').setFontWeight('bold').setBackground('#4285f4').setFontColor('white');
  
  const planComptable = [
    ['512', 'Banque', 'Actif'],
    ['530', 'Caisse', 'Actif'],
    ['411', 'Adhérents', 'Actif'],
    ['467', 'Autres débiteurs', 'Actif'],
    ['401', 'Fournisseurs', 'Passif'],
    ['421', 'Personnel - Rémunérations', 'Passif'],
    ['437', 'Autres organismes sociaux', 'Passif'],
    ['445', 'État', 'Passif'],
    ['102', 'Fonds associatifs', 'Passif'],
    ['606', 'Achats non stockés', 'Charge'],
    ['611', 'Sous-traitance', 'Charge'],
    ['613', 'Locations', 'Charge'],
    ['615', 'Entretien et réparations', 'Charge'],
    ['616', 'Primes d\'assurance', 'Charge'],
    ['618', 'Formation', 'Charge'],
    ['621', 'Personnel extérieur', 'Charge'],
    ['623', 'Publicité', 'Charge'],
    ['625', 'Déplacements et missions', 'Charge'],
    ['626', 'Frais postaux et télécommunications', 'Charge'],
    ['627', 'Services bancaires', 'Charge'],
    ['635', 'Impôts et taxes', 'Charge'],
    ['641', 'Rémunérations du personnel', 'Charge'],
    ['645', 'Charges de sécurité sociale', 'Charge'],
    ['6453', 'Cotisations Mutuelles', 'Charge'],
    ['658', 'Charges diverses de gestion', 'Charge'],
    ['699', 'Non attribué', 'Charge'],
    ['706', 'Prestations de services', 'Produit'],
    ['740', 'Subventions d\'exploitation', 'Produit'],
    ['756', 'Cotisations', 'Produit'],
    ['758', 'Dons', 'Produit']
  ];
  
  feuille.getRange(2, 1, planComptable.length, 3).setValues(planComptable);
  feuille.autoResizeColumns(1, 3);
  feuille.setFrozenRows(1);
}

function initialiserEntetes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const feuilleDB = ss.getSheetByName(CONFIG.FEUILLES.DONNEES_BRUTES);
  const entetesDB = [['Date Comptable', 'Date Opération', 'Libellé', 'Infos Complémentaires', 
                       'Référence', 'Date Valeur', 'Type Opération', 'Débit', 'Crédit']];
  feuilleDB.getRange('A1:I1').setValues(entetesDB);
  feuilleDB.getRange('A1:I1').setFontWeight('bold').setBackground('#4285f4').setFontColor('white');
  
  const feuilleJournal = ss.getSheetByName(CONFIG.FEUILLES.JOURNAL);
  const entetesJournal = [['Date', 'N° Pièce', 'Compte', 'Libellé', 'Débit', 'Crédit']];
  feuilleJournal.getRange('A1:F1').setValues(entetesJournal);
  feuilleJournal.getRange('A1:F1').setFontWeight('bold').setBackground('#34a853').setFontColor('white');
  
  const feuilleGL = ss.getSheetByName(CONFIG.FEUILLES.GRAND_LIVRE);
  const entetesGL = [['Compte', 'Date', 'Libellé', 'Débit', 'Crédit', 'Solde']];
  feuilleGL.getRange('A1:F1').setValues(entetesGL);
  feuilleGL.getRange('A1:F1').setFontWeight('bold').setBackground('#fbbc04').setFontColor('white');
  
  const feuilleBalance = ss.getSheetByName(CONFIG.FEUILLES.BALANCE);
  const entetesBalance = [['Compte', 'Libellé', 'Total Débit', 'Total Crédit', 'Solde Débiteur', 'Solde Créditeur']];
  feuilleBalance.getRange('A1:F1').setValues(entetesBalance);
  feuilleBalance.getRange('A1:F1').setFontWeight('bold').setBackground('#ea4335').setFontColor('white');
}

// ============================================
// IMPORT DES DONNÉES
// ============================================

function importerDonnees() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    'Import de données',
    'Copiez le contenu de votre fichier CSV dans la feuille "Données Brutes" (en écrasant les données existantes), puis cliquez sur OK.',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (result === ui.Button.OK) {
    try {
      nettoyerEtFormaterDonnees();
      ui.alert('✅ Données importées et formatées avec succès !');
    } catch (e) {
      ui.alert('❌ Erreur lors de l\'import : ' + e.message);
    }
  }
}

function nettoyerEtFormaterDonnees() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const feuille = ss.getSheetByName(CONFIG.FEUILLES.DONNEES_BRUTES);
  
  const lastRow = feuille.getLastRow();
  if (lastRow <= 1) return;
  
  // On récupère TOUTE la plage pour ne pas être limité par le nombre de colonnes
  const lastCol = feuille.getLastColumn();
  const donnees = feuille.getRange(2, 1, lastRow - 1, lastCol).getValues();
  
  const mapping = getMappingCSV();
  
  const donneesNettoyees = donnees.map(row => {
    let debit = parseMontant(row[mapping.DEBIT]);
    let credit = parseMontant(row[mapping.CREDIT]);
    
    // CAS PARTICULIER : Débit et Crédit dans la même colonne (Gestion par le signe)
    if (mapping.DEBIT === mapping.CREDIT) {
      const montantUnique = debit; // ou credit, c'est le même
      if (montantUnique < 0) {
        debit = Math.abs(montantUnique);
        credit = 0;
      } else {
        debit = 0;
        credit = montantUnique;
      }
    }
    
    return [
      parseDate(row[mapping.DATE_COMPTABLE]),
      parseDate(row[mapping.DATE_OPERATION]),
      row[mapping.LIBELLE],
      row[mapping.INFO_COMPLEMENTAIRE],
      row[mapping.REFERENCE],
      parseDate(row[mapping.DATE_VALEUR]),
      row[mapping.TYPE_OPERATION],
      debit,
      credit
    ];
  });
  
  // On réécrit proprement dans les 9 colonnes standards de "Données Brutes"
  feuille.getRange(2, 1, donneesNettoyees.length, 9).setValues(donneesNettoyees);
  
  // UX : Ajouter la colonne Action (Checkbox) pour réattribuer
  const rangeAction = feuille.getRange(2, 10, donneesNettoyees.length, 1);
  rangeAction.insertCheckboxes().setFontColor('#1a73e8');
  feuille.getRange(1, 10).setValue('action').setFontWeight('bold').setBackground('#444444').setFontColor('white');
  
  // Nettoyer les colonnes superflues si besoin (Optionnel)
  if (lastCol > 9) {
    feuille.getRange(2, 10, lastRow - 1, lastCol - 9).clearContent();
  }
  
  feuille.getRange(2, 1, donneesNettoyees.length, 1).setNumberFormat('dd/mm/yyyy');
  feuille.getRange(2, 2, donneesNettoyees.length, 1).setNumberFormat('dd/mm/yyyy');
  feuille.getRange(2, 6, donneesNettoyees.length, 1).setNumberFormat('dd/mm/yyyy');
  feuille.getRange(2, 8, donneesNettoyees.length, 2).setNumberFormat('#,##0.00 €');
  
  feuille.autoResizeColumns(1, 10);
}

/**
 * Assure la présence des cases à cocher dans Données Brutes (Fail-safe)
 */
function assurerCheckboxesDonneesBrutes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const feuille = ss.getSheetByName(CONFIG.FEUILLES.DONNEES_BRUTES);
  if (!feuille) return;
  
  const lastRow = feuille.getLastRow();
  if (lastRow <= 1) return;
  
  // Header "action" en colonne 10
  feuille.getRange(1, 10).setValue('action')
    .setFontWeight('bold')
    .setBackground('#444444')
    .setFontColor('white')
    .setHorizontalAlignment('center');
  
  // Checkboxes
  const rangeAction = feuille.getRange(2, 10, lastRow - 1, 1);
  rangeAction.insertCheckboxes().setFontColor('#1a73e8');
  
  // Masquer les colonnes superflues au-delà de 10
  const maxCols = feuille.getMaxColumns();
  if (maxCols > 10) {
    // feuille.hideColumns(11, maxCols - 10); // Trop risqué si le user a des infos persos
  }
}

// ============================================
// GÉNÉRATION DU JOURNAL
// ============================================

function genererJournal(muet = false) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const feuilleDB = ss.getSheetByName(CONFIG.FEUILLES.DONNEES_BRUTES);
  const feuilleJournal = ss.getSheetByName(CONFIG.FEUILLES.JOURNAL);
  
  if (!feuilleJournal) return;
  
  if (feuilleJournal.getLastRow() > 1) {
    feuilleJournal.getRange(2, 1, feuilleJournal.getLastRow() - 1, 6).clear();
  }
  // Nettoyage ABSOLU des colonnes de droite (G à Z) pour supprimer les cases à cocher résiduelles
  const maxRows = feuilleJournal.getMaxRows();
  if (feuilleJournal.getMaxColumns() >= 7) {
    feuilleJournal.getRange(1, 7, maxRows, feuilleJournal.getMaxColumns() - 6).clear().removeCheckboxes();
  }
  
  const lastRow = feuilleDB.getLastRow();
  if (lastRow <= 1) {
    if (!muet) SpreadsheetApp.getUi().alert('⚠️ Aucune donnée à traiter. Importez d\'abord vos données.');
    return;
  }
  
  const donnees = feuilleDB.getRange(2, 1, lastRow - 1, 9).getValues();
  const regles = chargerReglesDynamiques();
  const ecritures = [];
  
donnees.forEach((row, index) => {
  const date = row[0];
  const libelle = row[2];
  const infosComplementaires = row[3];  // ← AJOUT : Colonne D
  const reference = row[4] || 'REF' + (index + 1);
  const typeOp = row[6];
  const debit = row[7] || 0;
  const credit = row[8] || 0;
  
  // Concaténer le libellé avec les infos complémentaires
 let libelleComplet = libelle;

if (infosComplementaires) {
  const infosStr = String(infosComplementaires).trim();
  if (infosStr !== '' && infosStr !== 'null' && infosStr !== 'undefined') {
    libelleComplet = libelle + ' ' + infosStr;
  }
}
  
  const comptes = determinerComptes(typeOp, libelleComplet, debit, credit, regles);

    
  if (debit > 0) {
  ecritures.push([date, reference, comptes.debit, libelleComplet, debit, 0]);
  ecritures.push([date, reference, '512', libelleComplet, 0, debit]);
}

if (credit > 0) {
  ecritures.push([date, reference, '512', libelleComplet, credit, 0]);
  ecritures.push([date, reference, comptes.credit, libelleComplet, 0, credit]);
}

  });
  
  if (ecritures.length > 0) {
    feuilleJournal.getRange(2, 1, ecritures.length, 6).setValues(ecritures);
    if (!muet) {
      feuilleJournal.getRange(2, 1, ecritures.length, 1).setNumberFormat('dd/mm/yyyy');
      feuilleJournal.getRange(2, 5, ecritures.length, 2).setNumberFormat('#,##0.00 €');
      feuilleJournal.autoResizeColumns(1, 6);
    }
  }
  
  if (!muet) SpreadsheetApp.getUi().alert('✅ Journal généré avec succès ! (' + ecritures.length + ' écritures)');
  
  // NOUVEAU : Appel automatique du rapport si erreurs
  genererRapportNonAttribue(muet);
}

// ============================================
// LOGIQUE D'ATTRIBUTION DES COMPTES
// ============================================

let CACHE_REGLES = null;

function chargerReglesDynamiques() {
  if (CACHE_REGLES) return CACHE_REGLES;
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const feuille = ss.getSheetByName(CONFIG.FEUILLES.REGLES_ATTRIBUTION);
  
  if (!feuille || feuille.getLastRow() <= 1) return [];
  
  const data = feuille.getRange(2, 1, feuille.getLastRow() - 1, 3).getValues();
  CACHE_REGLES = data.map(row => ({
    motCle: normaliserTexte(row[0]),
    debit: String(row[1]).trim(),
    credit: String(row[2]).trim()
  })).filter(r => r.motCle !== '');
  
  return CACHE_REGLES;
}

function determinerComptes(typeOp, libelle, debit, credit, reglesPrechargees = null) {
  const libelleNormalise = normaliserTexte(libelle);
  
  // 1. MOTEUR DYNAMIQUE : Recherche dans la feuille "Règles d'Attribution"
  const regles = reglesPrechargees || chargerReglesDynamiques();
  for (const regle of regles) {
    if (libelleNormalise.includes(regle.motCle)) {
      if (debit > 0 && regle.debit) return { debit: regle.debit };
      if (credit > 0 && regle.credit) return { credit: regle.credit };
    }
  }

  // 2. RÈGLES GÉNÉRIQUES (Règles "Balais")
  // Si aucune règle spécifique n'a matché, on applique une logique par défaut
  
  if (credit > 0) {
    // SÉCURITÉ : Si c'est un remboursement ou une annulation, on évite le 706 par défaut
    if (libelleNormalise.includes('ann ') || 
        libelleNormalise.includes('remb') || 
        libelleNormalise.includes('frais') || 
        libelleNormalise.includes('commission')) {
      return { credit: '699' };
    }
    
    // Par défaut, toute recette non identifiée est une Prestation de Service (706)
    return { credit: '706' };
  }
  
  if (debit > 0) {
    
    if (libelleNormalise.includes('remboursement') ||
        libelleNormalise.includes('vir lorenz') ||
        libelleNormalise.includes('vir mayer') ||
        libelleNormalise.includes('vir arthur baschet') ||
        libelleNormalise.includes('vir cartier') ||
        libelleNormalise.includes('vir morel') ||
        libelleNormalise.includes('vir grazioso') ||
        libelleNormalise.includes('vir 1 eleves litiges') ||
        libelleNormalise.includes('remboursem prlv sepa')) {
      return { debit: '411' };
    }
    
    // AUTRES DÉBITEURS (467)
    if (libelleNormalise.includes('dr neyrand') ||
        libelleNormalise.includes('sags hcl') ||
        libelleNormalise.includes('centre nautique') ||
        libelleNormalise.includes('erreur carte')) {
      return { debit: '467' };
    }
    
    return { debit: '699' };
  }
  
  return { debit: '699', credit: '699' };
}


// ============================================
// GÉNÉRATION DU GRAND LIVRE
// ============================================

function genererGrandLivre(muet = false) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const feuilleJournal = ss.getSheetByName(CONFIG.FEUILLES.JOURNAL);
  const feuilleGL = ss.getSheetByName(CONFIG.FEUILLES.GRAND_LIVRE);
  
  if (feuilleGL.getLastRow() > 1) {
    feuilleGL.getRange(2, 1, feuilleGL.getLastRow() - 1, 6).clear();
  }
  // Nettoyage ABSOLU des colonnes de droite (G à Z) pour supprimer les cases à cocher résiduelles
  const maxRowsGL = feuilleGL.getMaxRows();
  if (feuilleGL.getMaxColumns() >= 7) {
    feuilleGL.getRange(1, 7, maxRowsGL, feuilleGL.getMaxColumns() - 6).clear().removeCheckboxes();
  }
  
  const lastRow = feuilleJournal.getLastRow();
  if (lastRow <= 1) {
    SpreadsheetApp.getUi().alert('⚠️ Le journal est vide. Générez d\'abord le journal.');
    return;
  }
  
  const ecritures = feuilleJournal.getRange(2, 1, lastRow - 1, 6).getValues();
  const comptesMap = {};
  
  ecritures.forEach(ecriture => {
    const [date, numPiece, compte, libelle, debit, credit] = ecriture;
    
    if (!comptesMap[compte]) {
      comptesMap[compte] = [];
    }
    
    comptesMap[compte].push({
      date: date,
      libelle: libelle,
      debit: debit || 0,
      credit: credit || 0
    });
  });
  
  const comptesOrdonnes = Object.keys(comptesMap).sort();
  const lignesGL = [];
  
  comptesOrdonnes.forEach(compte => {
    const operations = comptesMap[compte];
    let solde = 0;
    
    operations.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    operations.forEach(op => {
      solde += op.debit - op.credit;
      lignesGL.push([
        compte,
        op.date,
        op.libelle,
        op.debit,
        op.credit,
        solde
      ]);
    });
    
    lignesGL.push(['', '', '', '', '', '']);
  });
  
  if (lignesGL.length > 0) {
    feuilleGL.getRange(2, 1, lignesGL.length, 6).setValues(lignesGL);
    feuilleGL.getRange(2, 2, lignesGL.length, 1).setNumberFormat('dd/mm/yyyy');
    feuilleGL.getRange(2, 4, lignesGL.length, 3).setNumberFormat('#,##0.00 €');
    feuilleGL.autoResizeColumns(1, 6);
    
    for (let i = 0; i < lignesGL.length; i++) {
      if (lignesGL[i][0] !== '' && (i === 0 || lignesGL[i-1][0] === '')) {
        feuilleGL.getRange(i + 2, 1, 1, 6).setBackground('#e8f0fe').setFontWeight('bold');
      }
    }
  }
  
  if (!muet) SpreadsheetApp.getUi().alert('✅ Grand Livre généré avec succès !');
}

// ============================================
// GÉNÉRATION DE LA BALANCE
// ============================================

function genererBalance(muet = false) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const feuilleJournal = ss.getSheetByName(CONFIG.FEUILLES.JOURNAL);
  const feuilleBalance = ss.getSheetByName(CONFIG.FEUILLES.BALANCE);
  const feuillePlan = ss.getSheetByName(CONFIG.FEUILLES.PLAN_COMPTABLE);
  
  if (feuilleBalance.getLastRow() > 1) {
    feuilleBalance.getRange(2, 1, feuilleBalance.getLastRow() - 1, 6).clear();
  }
  
  const lastRow = feuilleJournal.getLastRow();
  if (lastRow <= 1) {
    SpreadsheetApp.getUi().alert('⚠️ Le journal est vide. Générez d\'abord le journal.');
    return;
  }
  
  const planComptable = {};
  const lastRowPlan = feuillePlan.getLastRow();
  if (lastRowPlan > 1) {
    const planData = feuillePlan.getRange(2, 1, lastRowPlan - 1, 2).getValues();
    planData.forEach(row => {
      planComptable[row[0]] = row[1];
    });
  }
  
  const ecritures = feuilleJournal.getRange(2, 1, lastRow - 1, 6).getValues();
  const comptesBalance = {};
  
  ecritures.forEach(ecriture => {
    const [date, numPiece, compte, libelle, debit, credit] = ecriture;
    
    if (!comptesBalance[compte]) {
      comptesBalance[compte] = {
        libelle: planComptable[compte] || 'Non défini',
        totalDebit: 0,
        totalCredit: 0
      };
    }
    
    comptesBalance[compte].totalDebit += debit || 0;
    comptesBalance[compte].totalCredit += credit || 0;
  });
  
  const comptesOrdonnes = Object.keys(comptesBalance).sort();
  const lignesBalance = [];
  let totalDebit = 0;
  let totalCredit = 0;
  let totalSoldeDebiteur = 0;
  let totalSoldeCrediteur = 0;
  
  comptesOrdonnes.forEach(compte => {
    const data = comptesBalance[compte];
    const solde = data.totalDebit - data.totalCredit;
    const soldeDebiteur = solde > 0 ? solde : 0;
    const soldeCrediteur = solde < 0 ? -solde : 0;
    
    lignesBalance.push([
      compte,
      data.libelle,
      data.totalDebit,
      data.totalCredit,
      soldeDebiteur,
      soldeCrediteur
    ]);
    
    totalDebit += data.totalDebit;
    totalCredit += data.totalCredit;
    totalSoldeDebiteur += soldeDebiteur;
    totalSoldeCrediteur += soldeCrediteur;
  });
  
  lignesBalance.push(['', '', '', '', '', '']);
  lignesBalance.push([
    'TOTAUX',
    '',
    totalDebit,
    totalCredit,
    totalSoldeDebiteur,
    totalSoldeCrediteur
  ]);
  
  if (lignesBalance.length > 0) {
    feuilleBalance.getRange(2, 1, lignesBalance.length, 6).setValues(lignesBalance);
    feuilleBalance.getRange(2, 3, lignesBalance.length, 4).setNumberFormat('#,##0.00 €');
    
    const lastBalanceRow = feuilleBalance.getLastRow();
    feuilleBalance.getRange(lastBalanceRow, 1, 1, 6)
      .setFontWeight('bold')
      .setBackground('#fce8b2')
      .setBorder(true, true, true, true, false, false);
    
    feuilleBalance.autoResizeColumns(1, 6);
  }
  
  const diff = Math.abs(totalDebit - totalCredit);
  if (diff < 0.01) {
    if (!muet) SpreadsheetApp.getUi().alert('✅ Balance générée avec succès ! La comptabilité est équilibrée.');
  } else {
    if (!muet) SpreadsheetApp.getUi().alert('⚠️ Balance générée mais attention : déséquilibre de ' + 
                                  diff.toFixed(2) + ' €');
  }
}

// ============================================
// TOUT RÉGÉNÉRER (avec exercices)
// ============================================

function toutRegenerer() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  const reponse = ui.alert(
    '🔄 Mise à jour complète',
    'Cette opération va synchroniser TOUS vos rapports :\n\n' +
    '✅ Le Journal (Écritures comptables)\n' +
    '✅ Le Grand Livre (Détail par compte)\n' +
    '✅ La Balance (Totaux et soldes)\n' +
    '✅ Les Exercices (Rapports annuels)\n' +
    '✅ Détail Paiements Élèves (Reste à payer)\n\n' +
    'C\'est la méthode recommandée pour garantir que tout est à jour. Continuer ?',
    ui.ButtonSet.YES_NO
  );
  
  if (reponse === ui.Button.YES) {
    try {
      // 0. SÉCURITÉ : Assurer les cases à cocher dans Données Brutes
      assurerCheckboxesDonneesBrutes();
      
      // 1. Rapports de base
    genererJournal(true);
    genererGrandLivre(true);
    genererBalance(true);
    
    // 2. Exercices existants
    const sheets = ss.getSheets();
    const exercicesExistants = [];
    
    sheets.forEach(sheet => {
      const nom = sheet.getName();
      const match = nom.match(/^Journal (\d{4})-(\d{4})$/);
      if (match) {
        exercicesExistants.push({
          anneeDebut: parseInt(match[1]),
          anneeFin: parseInt(match[2])
        });
      }
    });
    
    if (exercicesExistants.length > 0) {
      exercicesExistants.forEach(exercice => {
        const dates = getDatesExercice(exercice.anneeDebut + '-' + exercice.anneeFin);
        genererJournalExercice(exercice.anneeDebut + '-' + exercice.anneeFin, dates, true);
        genererGrandLivreExercice(exercice.anneeDebut + '-' + exercice.anneeFin, dates, true);
        genererBalanceExercice(exercice.anneeDebut + '-' + exercice.anneeFin, dates, true);
      });
    }

    // 3. Rapports spéciaux
    genererDetailPaiementsEleves(null, true);
    
    let message = '✅ Régénération terminée !\n\n• Journal\n• Grand Livre\n• Balance\n';
    
    if (exercicesExistants.length > 0) {
      message += '\n📅 Exercices régénérés :\n';
      exercicesExistants.forEach(ex => {
        message += '• ' + ex.anneeDebut + '-' + ex.anneeFin + '\n';
      });
    }
    
    ui.alert('✅ Succès', message, ui.ButtonSet.OK);
    
    // NOUVEAU : Appel automatique du rapport si erreurs
    genererRapportNonAttribue(true);
    
    } catch (e) {
      ui.alert('❌ Erreur', 'Une erreur s\'est produite :\n\n' + e.toString(), ui.ButtonSet.OK);
    }
  }
}

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

function parseDate(dateStr) {
  if (dateStr instanceof Date) return dateStr;
  if (!dateStr) return '';
  
  const parts = dateStr.toString().split('/');
  if (parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return dateStr;
}

function parseMontant(montantStr) {
  if (typeof montantStr === 'number') return Math.abs(montantStr);
  if (!montantStr) return 0;
  
  const cleaned = montantStr.toString()
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace('+', '')
    .replace('-', '');
  
  const nombre = parseFloat(cleaned);
  return isNaN(nombre) ? 0 : Math.abs(nombre);
}

// ═══════════════════════════════════════════════════════════════════
// MODULE ANALYSE & CONTRÔLE
// ═══════════════════════════════════════════════════════════════════

function genererRapportNonAttribue(muet = false) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  const feuilleBalance = ss.getSheetByName(CONFIG.FEUILLES.BALANCE);
  const feuilleJournal = ss.getSheetByName(CONFIG.FEUILLES.JOURNAL);
  
  if (!feuilleBalance || !feuilleJournal) {
    if (!muet) ui.alert('⚠️ Feuilles manquantes', 'Solution : Menu > 🔄 Tout régénérer', ui.ButtonSet.OK);
    return false;
  }
  
  const lastRowBalance = feuilleBalance.getLastRow();
  const lastRowJournal = feuilleJournal.getLastRow();
  
  if (lastRowBalance <= 1 || lastRowJournal <= 1) {
    if (!muet) ui.alert('⚠️ Données manquantes', 'Solution : Menu > 🔄 Tout régénérer', ui.ButtonSet.OK);
    return false;
  }
  
  const balanceData = feuilleBalance.getRange(2, 1, lastRowBalance - 1, 6).getValues();
  
  let montantNonAttribue = 0;
  let compte699Existe = false;
  
  balanceData.forEach(row => {
    if (row[0] === '699' || row[0] === 699) {
      compte699Existe = true;
      montantNonAttribue = Math.abs(row[4] || 0);
      if (montantNonAttribue === 0) {
        montantNonAttribue = Math.abs(row[5] || 0);
      }
    }
  });
  
  if (!compte699Existe || montantNonAttribue === 0) {
    if (!muet) ui.alert(
      '✅ Toutes les opérations sont classées !',
      'Taux de classification : 100%',
      ui.ButtonSet.OK
    );
    return false;
  }
  
  const journalData = feuilleJournal.getRange(2, 1, lastRowJournal - 1, 6).getValues();
  
  const operations699 = [];
  journalData.forEach(row => {
    if (row[2] === '699' || row[2] === 699) {
      operations699.push({
        date: row[0],
        libelle: row[3],
        debit: row[4] || 0,
        credit: row[5] || 0
      });
    }
  });
  
  if (operations699.length === 0) {
    if (!muet) ui.alert('⚠️ Incohérence détectée', 'Solution : Menu > 🔄 Tout régénérer', ui.ButtonSet.OK);
    return false;
  }
  
  let feuilleRapport = ss.getSheetByName('Rapport Non Attribué');
  if (!feuilleRapport) {
    feuilleRapport = ss.insertSheet('Rapport Non Attribué');
  } else {
    feuilleRapport.clear();
  }
  
  feuilleRapport.getRange('A1:E1').merge()
    .setValue('⚠️ OPÉRATIONS NON ATTRIBUÉES - Compte 699')
    .setFontSize(14)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBackground('#f4b400')
    .setFontColor('white');
  
  feuilleRapport.getRange('A2:E2').setValues([[
    'Date', 'Libellé', 'Débit', 'Crédit', 'Actions'
  ]])
    .setFontWeight('bold')
    .setBackground('#ea4335')
    .setFontColor('white');
  
  const lignes = operations699.map(op => [
    op.date,
    op.libelle,
    op.debit,
    op.credit,
    false // Case à cocher (false = non cochée)
  ]);
  
  const rangeActions = feuilleRapport.getRange(3, 1, lignes.length, 5);
  rangeActions.setValues(lignes);
  
  // Appliquer les cases à cocher en colonne E
  feuilleRapport.getRange(3, 5, lignes.length, 1).insertCheckboxes();
  
  if (!muet) {
    feuilleRapport.getRange(3, 3, lignes.length, 2).setNumberFormat('#,##0.00 €');
  }
  
  const ligneTotal = 3 + lignes.length;
  const totalDebit = operations699.reduce((sum, op) => sum + op.debit, 0);
  const totalCredit = operations699.reduce((sum, op) => sum + op.credit, 0);
  
  // --- AJOUT : AIDE AU PLAN COMPTABLE SUR LA DROITE ---
  const feuillePlan = ss.getSheetByName(CONFIG.FEUILLES.PLAN_COMPTABLE);
  if (feuillePlan) {
    const colPlan = 7; // Colonne G
    const lastRowPlan = feuillePlan.getLastRow();
    if (lastRowPlan > 0) {
      const dataPlan = feuillePlan.getRange(1, 1, lastRowPlan, 2).getValues();
      
      // Nettoyer la zone avant d'écrire
      feuilleRapport.getRange(1, colPlan, feuilleRapport.getMaxRows(), 2).clear();
      
      // Écrire les données
      feuilleRapport.getRange(1, colPlan, dataPlan.length, 2).setValues(dataPlan);
      
      // Formatage du titre/en-tête (Ligne 1)
      feuilleRapport.getRange(1, colPlan, 1, 2).setFontWeight('bold').setBackground('#2e7d32').setFontColor('white').setHorizontalAlignment('center');
      
      // Formatage de la colonne Compte (en gras et centré)
      feuilleRapport.getRange(1, colPlan, dataPlan.length, 1).setFontWeight('bold').setHorizontalAlignment('center');
      
      // Style général
      const rangeTotalPlan = feuilleRapport.getRange(1, colPlan, dataPlan.length, 2);
      rangeTotalPlan.setBorder(true, true, true, true, true, true, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);
      rangeTotalPlan.setBackground('#f9f9f9');
      
      if (!muet) {
        feuilleRapport.setColumnWidth(colPlan, 80);
        feuilleRapport.setColumnWidth(colPlan + 1, 250);
        
        // Bordure de séparation (Colonne F)
        feuilleRapport.getRange(1, 6, feuilleRapport.getMaxRows(), 1).setBackground('#f3f3f3');
        feuilleRapport.setColumnWidth(6, 15);
      }
    }
  }
  
  feuilleRapport.getRange(ligneTotal, 1, 1, 2).merge()
    .setValue('TOTAL')
    .setFontWeight('bold')
    .setBackground('#fce8b2');
  
  feuilleRapport.getRange(ligneTotal, 3)
    .setValue(totalDebit)
    .setFontWeight('bold')
    .setBackground('#fce8b2')
    .setNumberFormat('#,##0.00 €');
  
  feuilleRapport.getRange(ligneTotal, 4)
    .setValue(totalCredit)
    .setFontWeight('bold')
    .setBackground('#fce8b2')
    .setNumberFormat('#,##0.00 €');
  
  feuilleRapport.autoResizeColumns(1, 4);
  feuilleRapport.setColumnWidth(2, 350);
  feuilleRapport.setFrozenRows(2);
  
  // FOCUS AUTOMATIQUE
  ss.setActiveSheet(feuilleRapport);
  
  if (!muet) {
    ui.alert(
      '⚠️ ' + operations699.length + ' opération(s) non attribuée(s)',
      'Total : ' + montantNonAttribue.toFixed(2) + ' €\n\n' +
      '📋 Consultez la feuille "Rapport Non Attribué"',
      ui.ButtonSet.OK
    );
  }
  
  return true;
}

function afficherStatistiquesClassification() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  const feuilleBalance = ss.getSheetByName(CONFIG.FEUILLES.BALANCE);
  
  if (!feuilleBalance) {
    ui.alert('⚠️ Balance introuvable', 'Solution : Menu > ⚖️ Générer la Balance', ui.ButtonSet.OK);
    return;
  }
  
  const lastRow = feuilleBalance.getLastRow();
  
  if (lastRow <= 1) {
    ui.alert('⚠️ Balance vide', 'Solution : Menu > ⚖️ Générer la Balance', ui.ButtonSet.OK);
    return;
  }
  
  const balanceData = feuilleBalance.getRange(2, 1, lastRow - 2, 6).getValues();
  
  let montantNonAttribue = 0;
  let totalMontants = 0;
  let nombreComptes = 0;
  
  balanceData.forEach(row => {
    const compte = row[0];
    const totalDebit = Math.abs(row[2] || 0);
    const totalCredit = Math.abs(row[3] || 0);
    
    if (compte && compte !== '') {
      nombreComptes++;
      totalMontants += totalDebit + totalCredit;
      
      if (compte === '699' || compte === 699) {
        montantNonAttribue += totalDebit + totalCredit;
      }
    }
  });
  
  if (totalMontants === 0) {
    ui.alert('⚠️ Aucune donnée', 'Avez-vous importé vos données CSV ?', ui.ButtonSet.OK);
    return;
  }
  
  const montantClassé = totalMontants - montantNonAttribue;
  const pourcentageClassé = (montantClassé / totalMontants * 100);
  
  let message = '📊 STATISTIQUES\n\n';
  message += '📈 Comptes : ' + nombreComptes + '\n';
  message += '💰 Total traité : ' + totalMontants.toFixed(2) + ' €\n\n';
  message += '✅ Classé : ' + montantClassé.toFixed(2) + ' € (' + pourcentageClassé.toFixed(1) + '%)\n';
  message += '⚠️ Non attribué : ' + montantNonAttribue.toFixed(2) + ' € (' + (100 - pourcentageClassé).toFixed(1) + '%)\n\n';
  
  if (pourcentageClassé >= 99) {
    message += '🎉 EXCELLENT !';
  } else if (pourcentageClassé >= 95) {
    message += '✅ TRÈS BON !';
  } else if (pourcentageClassé >= 85) {
    message += '👍 BON !';
  } else {
    message += '⚠️ À améliorer';
  }
  
  ui.alert('Statistiques', message, ui.ButtonSet.OK);
}

// ============================================
// SYNTHÈSE DES RÈGLES POUR VÉRIFICATION
// ============================================

function genererTableauSyntheseRegles(muet = false) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  const feuilleRegles = ss.getSheetByName(CONFIG.FEUILLES.REGLES_ATTRIBUTION);
  const feuillePlan = ss.getSheetByName(CONFIG.FEUILLES.PLAN_COMPTABLE);
  
  if (!feuilleRegles || feuilleRegles.getLastRow() <= 1) {
    ui.alert('⚠️ Aucune règle définie dans la feuille "Règles d\'Attribution".');
    return;
  }
  
  const planComptable = {};
  if (feuillePlan) {
    const dataPlan = feuillePlan.getRange(2, 1, feuillePlan.getLastRow() - 1, 2).getValues();
    dataPlan.forEach(row => planComptable[row[0]] = row[1]);
  }
  
  const reglesData = feuilleRegles.getRange(2, 1, feuilleRegles.getLastRow() - 1, 4).getValues();
  
  let feuilleSynthese = ss.getSheetByName('Synthèse des Règles');
  if (feuilleSynthese) {
    feuilleSynthese.clear();
  } else {
    feuilleSynthese = ss.insertSheet('Synthèse des Règles');
  }
  
  feuilleSynthese.getRange('A1:D1').merge()
    .setValue('📊 SYNTHÈSE DES RÈGLES DE CORRESPONDANCE')
    .setFontSize(14).setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBackground('#3f51b5').setFontColor('white');
  
  const entetes = [['Mot-clé', 'Compte', 'Libellé Compte', 'Type']];
  feuilleSynthese.getRange('A2:D2').setValues(entetes)
    .setFontWeight('bold').setBackground('#e8eaf6');
  
  const lignes = [];
  reglesData.forEach(row => {
    const [motCle, debit, credit] = row;
    const compte = debit || credit;
    if (motCle && compte) {
      lignes.push([
        motCle,
        compte,
        planComptable[compte] || 'Inconnu (à vérifier ⚠️)',
        debit ? 'DÉBIT 📉' : 'CRÉDIT 📈'
      ]);
    }
  });
  
  if (lignes.length > 0) {
    feuilleSynthese.getRange(3, 1, lignes.length, 4).setValues(lignes);
    
    if (!muet) {
      // Formatage du compte (gras et centré)
      feuilleSynthese.getRange(3, 2, lignes.length, 1).setFontWeight('bold').setHorizontalAlignment('center');

      // Formatage conditionnel pour les comptes inconnus
      const rangeLibelles = feuilleSynthese.getRange(3, 3, lignes.length, 1);
      const rule = SpreadsheetApp.newConditionalFormatRule()
        .whenTextContains('Inconnu')
        .setBackground('#f4cccc')
        .setFontColor('#cc0000')
        .setRanges([rangeLibelles])
        .build();
      const rules = feuilleSynthese.getConditionalFormatRules();
      rules.push(rule);
      feuilleSynthese.setConditionalFormatRules(rules);
      feuilleSynthese.autoResizeColumns(1, 4);
      feuilleSynthese.setColumnWidth(3, 250);
    }
  }
  
  feuilleSynthese.setFrozenRows(2);
  
  if (!muet) {
    ui.alert('✅ Tableau de synthèse généré !', 'Vérifiez les correspondances dans la feuille "Synthèse des Règles".', ui.ButtonSet.OK);
  }
}

function afficherReglesAttribution() {
  const ui = SpreadsheetApp.getUi();
  
  const message = `RÈGLES D'ATTRIBUTION

RECETTES (Crédits) :
• 706 - Prestations : EVI, VIR INST (sauf profs), STRIPE
• 756 - Cotisations : REMISE EUROPRELEVEMENT, SDD
• 740 - Subventions
• 758 - Dons

DÉPENSES (Débits) :
• 641 - Salaires : VIR + noms profs
• 645 - Charges sociales : URSSAF, MUTUELLE
• 626 - Télécoms : ORANGE, SFR...
• 613 - Locations : GOOGLE, WIX, ADOBE...
• 606 - Achats : AMAZON, THOMANN...
• 625 - Déplacements : Restaurants, essence
• 627 - Frais bancaires
• 411 - Rejets : REJ PRLV SEPA
• 699 - Non attribué

Menu > Analyse & Contrôle > Rapport Non Attribué
pour voir les opérations non classées`;
  
  ui.alert('Règles', message, ui.ButtonSet.OK);
}

// ============================================
// ASSISTANT INTERACTIF (ZÉRO CODE)
// ============================================

function assistantCreationRegle(range) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const sheet = range.getSheet();
  const nomSheet = sheet.getName();
  const row = range.getRow();
  
  let date, libelleOriginal, debit = 0, credit = 0;
  
  // 1. MAPPAGE SELON LA FEUILLE
  if (nomSheet === 'Rapport Non Attribué') {
    date = sheet.getRange(row, 1).getValue();
    libelleOriginal = sheet.getRange(row, 4).getValue();
    debit = sheet.getRange(row, 6).getValue();
    credit = sheet.getRange(row, 7).getValue();
  } 
  else if (nomSheet === CONFIG.FEUILLES.DONNEES_BRUTES) {
    date = sheet.getRange(row, 1).getValue(); // Date Comptable
    const lib = sheet.getRange(row, 3).getValue();
    const info = sheet.getRange(row, 4).getValue();
    libelleOriginal = info ? lib + ' ' + info : lib;
    debit = sheet.getRange(row, 8).getValue();
    credit = sheet.getRange(row, 9).getValue();
  }
  else {
    ui.alert('❌ Cette feuille ne supporte pas l\'assistant.');
    range.setValue(false);
    return;
  }

  const typeFlux = debit > 0 ? 'DÉPENSE' : 'RECETTE';
  const montant = debit || credit;

  // 1.5. Suggestion automatique d'association
  const suggestionAuto = obtenirSuggestionAuto(libelleOriginal, debit, credit);
  if (suggestionAuto) {
    const confirmation = ui.alert(
      '🤖 Assistant : Suggestion automatique',
      'Opération : "' + libelleOriginal + '" (' + montant.toFixed(2) + ' €)\n\n' +
      'L\'assistant suggère la règle suivante :\n' +
      '• Mot-clé : "' + suggestionAuto.motCle + '"\n' +
      '• Compte associé : ' + suggestionAuto.compte + '\n\n' +
      'Voulez-vous enregistrer et appliquer cette règle ?',
      ui.ButtonSet.YES_NO_CANCEL
    );
    
    if (confirmation === ui.Button.YES) {
      // Enregistrer et appliquer directement
      const feuilleRegles = ss.getSheetByName(CONFIG.FEUILLES.REGLES_ATTRIBUTION);
      const compteDebit = debit > 0 ? suggestionAuto.compte : '';
      const compteCredit = credit > 0 ? suggestionAuto.compte : '';
      
      feuilleRegles.appendRow([
        suggestionAuto.motCle.toUpperCase(),
        compteDebit,
        compteCredit,
        'Auto via Assistant (' + libelleOriginal.substring(0, 15) + ')'
      ]);
      
      range.setValue(false); // Décocher la case
      CACHE_REGLES = null;
      
      ss.toast('Synchronisation des rapports...', '🤖 Assistant', 3);
      genererJournal(true);
      genererGrandLivre(true);
      genererBalance(true);
      genererTableauSyntheseRegles(true);
      genererRapportNonAttribue(true); // Rafraîchir
      
      ui.alert(
        '✅ Règle appliquée',
        'La règle "' + suggestionAuto.motCle + '" ➔ Compte ' + suggestionAuto.compte + ' a été ajoutée.\n' +
        'Tous vos rapports ont été mis à jour.',
        ui.ButtonSet.OK
      );
      return;
    } else if (confirmation === ui.Button.CANCEL) {
      range.setValue(false);
      return;
    }
    // Si l'utilisateur clique sur NO, on continue vers la saisie manuelle standard !
  }

  // 2. Suggestion de mot-clé
  let suggestion = suggererMotCle(libelleOriginal);
  
  const promptMotCle = ui.prompt(
    '🤖 Assistant : Étape 1/2',
    'Opération : "' + libelleOriginal + '" (' + montant.toFixed(2) + ' €)\n\n' +
    'Entrez le mot-clé à mémoriser pour cette ' + typeFlux + ' :\n' +
    '(Le script l\'utilisera pour les prochaines fois)',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (promptMotCle.getSelectedButton() !== ui.Button.OK) {
    range.setValue(false);
    return;
  }
  const motCle = promptMotCle.getResponseText().trim().toUpperCase();
  
  // 3. Choix du compte
  const promptCompte = ui.prompt(
    '🤖 Assistant : Étape 2/2',
    'Mot-clé : "' + motCle + '"\n\n' +
    'Indiquez le numéro de compte (ex: 606, 627, 706...) :',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (promptCompte.getSelectedButton() !== ui.Button.OK) {
    range.setValue(false);
    return;
  }
  const numCompte = promptCompte.getResponseText().trim();
  
  if (!numCompte || isNaN(numCompte)) {
    ui.alert('❌ Numéro de compte invalide.');
    range.setValue(false);
    return;
  }

  // 4. Enregistrement automatique
  const feuilleRegles = ss.getSheetByName(CONFIG.FEUILLES.REGLES_ATTRIBUTION);
  const compteDebit = debit > 0 ? numCompte : '';
  const compteCredit = credit > 0 ? numCompte : '';
  
  feuilleRegles.appendRow([motCle, compteDebit, compteCredit, 'Auto via Assistant (' + libelleOriginal.substring(0,15) + ')']);
  
  // UX : Aller voir la règle créée
  feuilleRegles.getRange(feuilleRegles.getLastRow(), 1).activate();
  
  // Vider le cache pour prendre en compte la nouvelle règle
  CACHE_REGLES = null;
  
  // --- SYNCHRONISATION AUTOMATIQUE (Cycle Complet) ---
  ss.toast('Synchronisation des rapports...', '🤖 Assistant', 3);
  
  genererJournal(true);
  genererGrandLivre(true);
  genererBalance(true);
  genererTableauSyntheseRegles(true);
  genererRapportNonAttribue(true); // Rafraîchir la vue actuelle
  
  ui.alert(
    '✅ Opération terminée',
    'La règle "' + motCle + '" a été mémorisée.\n\n' +
    'Tous vos rapports ont été mis à jour et l\'opération a été classée.',
    ui.ButtonSet.OK
  );
}

function suggererMotCle(libelle) {
  if (!libelle) return 'MOT-CLÉ';
  const clean = normaliserTexte(libelle).toUpperCase();
  const mots = clean.split(/\s+/);
  const skip = ['VIREMENT', 'PRELEVEMENT', 'REMISE', 'CARTE', 'DATE', 'SEPA', 'VIR', 'PRLV', 'REM', 'CHQ', 'COMMISSION', 'FRAIS', 'PLVT', 'MAGNETIQ'];
  
  for (let m of mots) {
    if (m.length > 2 && !skip.includes(m)) {
      return m;
    }
  }
  return mots[0] || 'MOT-CLÉ';
}

/**
 * Propose une suggestion automatique (compte et mot-clé) en analysant un libellé
 */
function obtenirSuggestionAuto(libelle, debit, credit) {
  if (!libelle) return null;
  const clean = normaliserTexte(libelle).toUpperCase();
  
  // Dictionnaire de correspondances intelligentes
  const suggestions = [
    // Recettes / Cotisations / Crédits
    { mots: ['REMISE EUROPRELEVEMENT', 'EUROPRELEVEMENT', 'SDD', 'REMISE SDD'], compte: '756', motCle: 'EUROPRELEVEMENT' },
    { mots: ['STRIPE'], compte: '706', motCle: 'STRIPE' },
    { mots: ['SUBVENTION', 'MAIRIE', 'CONSEIL REGIONAL'], compte: '740', motCle: 'SUBVENTION' },
    { mots: ['DON'], compte: '758', motCle: 'DON' },
    { mots: ['COTIS CNV', 'ASSOCIATION XCCNV510', 'CONTRAT CNV'], compte: debit > 0 ? '658' : '756', motCle: 'COTIS CNV' },
    
    // Salaires / Personnel
    { mots: ['SALAIRE', 'SILVESTRI', 'DEPONDT', 'CUCCHETTI', 'PHILBERT', 'MARCEAU', 'ANTONIOLI'], compte: '641', motCle: null },
    { mots: ['URSSAF', 'POLE EMPLOI'], compte: '645', motCle: 'URSSAF' },
    { mots: ['MUTUELLE', 'HARMONIE'], compte: '6453', motCle: 'MUTUELLE' },
    
    // Frais bancaires & recouvrement
    { mots: ['COMMISSION BANCAIRE', 'COMMISSION', 'FRAIS VIREMENT', 'COTISATION CARTE', 'FRAIS PAIEMENT', 'FRAIS COM', 'ANN FR PRLVT', 'IMPAYE FRAIS'], compte: '627', motCle: 'FRAIS' },
    { mots: ['GEXEL'], compte: '627', motCle: 'GEXEL' },
    
    // Fournitures & Achats (606)
    { mots: ['AMAZON'], compte: '606', motCle: 'AMAZON' },
    { mots: ['BUREAU VALLEE', 'PAPETHEQUE'], compte: '606', motCle: 'PAPETHEQUE' },
    { mots: ['SUPER U', 'LIDL', 'CARREFOUR', 'AUCHAN', 'GIFI', 'LECLERC'], compte: '606', motCle: null },
    { mots: ['THOMANN', 'TWEETER', 'EFFECT ON LINE', 'STAR MUSIQUE'], compte: '606', motCle: null },
    { mots: ['IKEA'], compte: '606', motCle: 'IKEA' },
    { mots: ['LEROY MERLIN'], compte: '606', motCle: 'LEROY MERLIN' },
    { mots: ['BACKDROP'], compte: '606', motCle: 'BACKDROP' },
    { mots: ['LDLC'], compte: '606', motCle: 'LDLC' },
    
    // Locations / Logiciels
    { mots: ['GOOGLE', 'GSUITE'], compte: '613', motCle: 'GOOGLE' },
    { mots: ['WIX'], compte: '613', motCle: 'WIX' },
    { mots: ['ADOBE'], compte: '613', motCle: 'ADOBE' },
    { mots: ['MICROSOFT', 'OFFICE 365'], compte: '613', motCle: 'MICROSOFT' },
    { mots: ['MC2A', 'PROMEOM'], compte: '613', motCle: 'PROMEOM' },
    
    // Déplacements / Missions / Repas / Transports (625)
    { mots: ['RESTAURANT', 'REPAS', 'KIM SUSHI', 'MIYA SUSHI', 'PUERTA DEL SOL', 'NINKASI', 'GINGER', 'LE CH\'TI POT', 'CAFE PARADIS', 'DIMANCHE A LA C', 'SUMUP LA BOUL', 'BOULANG JASSERA'], compte: '625', motCle: null },
    { mots: ['ESSENCE', 'ESSO'], compte: '625', motCle: 'CARBURANT' },
    { mots: ['AREA NFC', 'PEAGE', 'AUTOROUTE'], compte: '625', motCle: 'PEAGE' },
    
    // Reste à charge / Remboursements / Litiges élèves (411)
    { mots: ['REJ PRLV', 'REJETA', 'RET PRLV', 'REMBOURSEM PRLV', 'REMBOURSEMENT', 'REMB'], compte: '411', motCle: 'REMBOURSEMENT' },
    { mots: ['RET DISTRIBUTEUR', 'RET DAB', 'RETRAIT DAB', 'RETRAIT LE'], compte: '530', motCle: 'RETRAIT' },
    { mots: ['COPY TOP', 'VISTAPRINT', 'IMPRESSION'], compte: '623', motCle: 'IMPRESSION' },
    { mots: ['ARAUJO', 'ALLIROL', 'TRANOSPHERE'], compte: '611', motCle: null },
    { mots: ['ACCORDAGE'], compte: '615', motCle: 'ACCORDAGE' },
    
    // Autres débiteurs (467)
    { mots: ['DR NEYRAND'], compte: '467', motCle: 'DR NEYRAND' },
    { mots: ['SAGS HCL'], compte: '467', motCle: 'SAGS HCL' },
    { mots: ['CENTRE NAUTIQUE'], compte: '467', motCle: 'CENTRE NAUTIQUE' },
    { mots: ['AMVP'], compte: '467', motCle: 'AMVP' },
    { mots: ['AGIADES'], compte: '613', motCle: 'AGIADES' }
  ];
  
  for (const s of suggestions) {
    for (const mot of s.mots) {
      const motNormalise = normaliserTexte(mot).toUpperCase();
      if (clean.includes(motNormalise)) {
        let motCleSuggere = s.motCle;
        if (!motCleSuggere) {
          motCleSuggere = mot.toUpperCase();
        }
        return {
          compte: s.compte,
          motCle: motCleSuggere
        };
      }
    }
  }
  
  return null;
}

/**
 * Auto-classement automatique en masse des opérations non attribuées (699)
 */
function autoClasserAvecSuggestions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  const feuilleJournal = ss.getSheetByName(CONFIG.FEUILLES.JOURNAL);
  if (!feuilleJournal || feuilleJournal.getLastRow() <= 1) {
    ui.alert('⚠️ Journal vide', 'Générez d\'abord le Journal pour analyser les écritures.', ui.ButtonSet.OK);
    return;
  }
  
  const journalData = feuilleJournal.getRange(2, 1, feuilleJournal.getLastRow() - 1, 6).getValues();
  const reglesExistantes = chargerReglesDynamiques();
  const clesExistantes = new Set(reglesExistantes.map(r => r.motCle));
  
  const nouvellesRegles = [];
  const clesAjouteesCeTour = new Set();
  
  journalData.forEach(row => {
    const compte = row[2];
    const libelle = row[3];
    const debit = row[4] || 0;
    const credit = row[5] || 0;
    
    if (compte === '699' || compte === 699) {
      const suggestion = obtenirSuggestionAuto(libelle, debit, credit);
      if (suggestion) {
        const motCleNormalise = normaliserTexte(suggestion.motCle).toUpperCase();
        
        if (!clesExistantes.has(motCleNormalise) && !clesAjouteesCeTour.has(motCleNormalise)) {
          const compteDebit = debit > 0 ? suggestion.compte : '';
          const compteCredit = credit > 0 ? suggestion.compte : '';
          
          nouvellesRegles.push([
            suggestion.motCle.toUpperCase(),
            compteDebit,
            compteCredit,
            'Auto-classer automatique (' + libelle.substring(0, 15) + ')'
          ]);
          
          clesAjouteesCeTour.add(motCleNormalise);
        }
      }
    }
  });
  
  if (nouvellesRegles.length === 0) {
    ui.alert('🤖 Assistant', 'Aucune suggestion automatique n\'a pu être appliquée sur les écritures non attribuées actuelles.', ui.ButtonSet.OK);
    return;
  }
  
  // Confirmer avant d'appliquer
  let messageConfirmation = 'L\'assistant propose de créer automatiquement ' + nouvellesRegles.length + ' règle(s) :\n\n';
  nouvellesRegles.slice(0, 15).forEach(r => {
    const direction = r[1] ? 'DÉBIT' : 'CRÉDIT';
    const numCompte = r[1] || r[2];
    messageConfirmation += '• "' + r[0] + '" ➔ Compte ' + numCompte + ' (' + direction + ')\n';
  });
  if (nouvellesRegles.length > 15) {
    messageConfirmation += '... et ' + (nouvellesRegles.length - 15) + ' autres règles.\n';
  }
  messageConfirmation += '\nVoulez-vous appliquer ces règles et mettre à jour tous vos rapports ?';
  
  const confirm = ui.alert('🤖 Auto-classification', messageConfirmation, ui.ButtonSet.YES_NO);
  if (confirm !== ui.Button.YES) {
    return;
  }
  
  // Enregistrer les nouvelles règles
  const feuilleRegles = ss.getSheetByName(CONFIG.FEUILLES.REGLES_ATTRIBUTION);
  nouvellesRegles.forEach(regle => {
    feuilleRegles.appendRow(regle);
  });
  
  // Vider le cache des règles
  CACHE_REGLES = null;
  
  // Synchroniser tout
  ss.toast('Mise à jour de tous vos rapports...', '🤖 Assistant', 5);
  
  genererJournal(true);
  genererGrandLivre(true);
  genererBalance(true);
  genererTableauSyntheseRegles(true);
  
  const aDesNonAttribues = genererRapportNonAttribue(true);
  
  let messageFin = '🎉 Classification automatique terminée !\n\n';
  messageFin += '• ' + nouvellesRegles.length + ' nouvelle(s) règle(s) ajoutée(s) à la feuille "Règles d\'Attribution".\n';
  messageFin += '• Les rapports comptables ont été entièrement régénérés.\n\n';
  
  if (aDesNonAttribues) {
    messageFin += '⚠️ Il reste encore des opérations non attribuées dans la feuille "Rapport Non Attribué".';
  } else {
    messageFin += '✅ Félicitations ! Toutes les opérations sont désormais classées !';
  }
  
  ui.alert('🤖 Assistant', messageFin, ui.ButtonSet.OK);
}

/**
 * Normalise un texte pour comparaison (minuscules, sans accents, sans caractères spéciaux)
 */
function normaliserTexte(texte) {
  if (!texte) return "";
  return texte.toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Supprime les accents
    .replace(/[^a-z0-9\s]/g, " ")    // Garde lettres et chiffres, remplace le reste par espace
    .replace(/\s+/g, " ")           // Supprime les espaces multiples
    .trim();
}

// ═══════════════════════════════════════════════════════════════════
// MODULE EXERCICES
// ═══════════════════════════════════════════════════════════════════

function getExercice(date) {
  if (!date || !(date instanceof Date)) return null;
  
  // Recharger au cas où
  CONFIG_EXERCICES = getConfigurationExercices();
  
  const annee = date.getFullYear();
  const mois = date.getMonth() + 1;
  
  if (mois >= CONFIG_EXERCICES.DEBUT_MOIS) {
    return annee + '-' + (annee + 1);
  } else {
    return (annee - 1) + '-' + annee;
  }
}

function listerExercices() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const feuilleDB = ss.getSheetByName(CONFIG.FEUILLES.DONNEES_BRUTES);
  
  const lastRow = feuilleDB.getLastRow();
  if (lastRow <= 1) return [];
  
  const dates = feuilleDB.getRange(2, 1, lastRow - 1, 1).getValues();
  const exercicesSet = new Set();
  
  dates.forEach(row => {
    const date = row[0];
    if (date instanceof Date) {
      const exercice = getExercice(date);
      if (exercice) exercicesSet.add(exercice);
    }
  });
  
  return Array.from(exercicesSet).sort();
}

function getDatesExercice(exercice) {
  const annees = exercice.split('-');
  const anneeDebut = parseInt(annees[0]);
  const anneeFin = parseInt(annees[1]);
  
  return {
    debut: new Date(anneeDebut, CONFIG_EXERCICES.DEBUT_MOIS - 1, CONFIG_EXERCICES.DEBUT_JOUR),
    fin: new Date(anneeFin, CONFIG_EXERCICES.FIN_MOIS - 1, CONFIG_EXERCICES.FIN_JOUR, 23, 59, 59)
  };
}

function choisirExercice() {
  const ui = SpreadsheetApp.getUi();
  const exercices = listerExercices();
  
  if (exercices.length === 0) {
    ui.alert('⚠️ Aucun exercice trouvé', 'Importez vos données bancaires.', ui.ButtonSet.OK);
    return;
  }
  
  let message = 'Exercices :\n\n';
  exercices.forEach((ex, index) => {
    message += (index + 1) + '. ' + ex + '\n';
  });
  message += '\nNuméro :';
  
  const response = ui.prompt('Choisir', message, ui.ButtonSet.OK_CANCEL);
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const choix = parseInt(response.getResponseText());
    if (choix > 0 && choix <= exercices.length) {
      genererDocumentsExercice(exercices[choix - 1]);
    }
  }
}

function genererTousExercices() {
  const ui = SpreadsheetApp.getUi();
  const exercices = listerExercices();
  
  if (exercices.length === 0) {
    ui.alert('⚠️ Aucun exercice');
    return;
  }
  
  const result = ui.alert(
    'Générer ' + exercices.length + ' exercices ?',
    exercices.join(', '),
    ui.ButtonSet.YES_NO
  );
  
  if (result === ui.Button.YES) {
    exercices.forEach(exercice => {
      genererDocumentsExercice(exercice, false, true); // Pass muet=true for batch generation
    });
    ui.alert('✅ Tous les exercices générés !');
  }
}

function genererDocumentsExercice(exercice, afficherMessage = true, muet = false) {
  const dates = getDatesExercice(exercice);
  
  genererJournalExercice(exercice, dates, true);
  genererGrandLivreExercice(exercice, dates, true);
  genererBalanceExercice(exercice, dates, true);
  genererResultatExercice(exercice, dates, true);
  genererBilanExercice(exercice, dates, true);
  
  if (afficherMessage && !muet) {
    SpreadsheetApp.getUi().alert('✅ Exercice ' + exercice + ' généré !');
  }
}

function genererJournalExercice(exercice, dates, muet = false) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const feuilleDB = ss.getSheetByName(CONFIG.FEUILLES.DONNEES_BRUTES);
  const nomFeuille = CONFIG_EXERCICES.FEUILLES.JOURNAL_EXERCICE + exercice;
  
  let feuilleJournal = ss.getSheetByName(nomFeuille);
  if (!feuilleJournal) {
    feuilleJournal = ss.insertSheet(nomFeuille);
  } else {
    feuilleJournal.clear();
  }
  
  const entetes = [['Date', 'N° Pièce', 'Compte', 'Libellé', 'Débit', 'Crédit']];
  feuilleJournal.getRange('A1:F1').setValues(entetes);
  feuilleJournal.getRange('A1:F1').setFontWeight('bold').setBackground('#34a853').setFontColor('white');
  
  const lastRow = feuilleDB.getLastRow();
  if (lastRow <= 1) return;
  
  const donnees = feuilleDB.getRange(2, 1, lastRow - 1, 9).getValues();
  const ecritures = [];
  
  donnees.forEach((row, index) => {
  const date = row[0];
  
  if (date instanceof Date && date >= dates.debut && date <= dates.fin) {
    const libelle = row[2];
    const infosComplementaires = row[3];  // ← AJOUT
    const reference = row[4] || 'REF' + (index + 1);
    const typeOp = row[6];
    const debit = row[7] || 0;
    const credit = row[8] || 0;
    
    // Concaténer le libellé avec les infos complémentaires
   let libelleComplet = libelle;

if (infosComplementaires) {
  const infosStr = String(infosComplementaires).trim();
  if (infosStr !== '' && infosStr !== 'null' && infosStr !== 'undefined') {
    libelleComplet = libelle + ' ' + infosStr;
  }
}
    
    const comptes = determinerComptes(typeOp, libelleComplet, debit, credit);

      if (debit > 0) {
  ecritures.push([date, reference, comptes.debit, libelleComplet, debit, 0]);
  ecritures.push([date, reference, '512', libelleComplet, 0, debit]);
}

if (credit > 0) {
  ecritures.push([date, reference, '512', libelleComplet, credit, 0]);
  ecritures.push([date, reference, comptes.credit, libelleComplet, 0, credit]);
}
    }
  });
  
  if (ecritures.length > 0) {
    feuilleJournal.getRange(2, 1, ecritures.length, 6).setValues(ecritures);
    feuilleJournal.getRange(2, 1, ecritures.length, 1).setNumberFormat('dd/mm/yyyy');
    feuilleJournal.getRange(2, 5, ecritures.length, 2).setNumberFormat('#,##0.00 €');
  }
  
  feuilleJournal.autoResizeColumns(1, 6);
  feuilleJournal.setFrozenRows(1);
}

function genererGrandLivreExercice(exercice, dates, muet = false) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nomFeuilleJournal = CONFIG_EXERCICES.FEUILLES.JOURNAL_EXERCICE + exercice;
  const nomFeuilleGL = CONFIG_EXERCICES.FEUILLES.GRAND_LIVRE_EXERCICE + exercice;
  
  const feuilleJournal = ss.getSheetByName(nomFeuilleJournal);
  if (!feuilleJournal) return;
  
  let feuilleGL = ss.getSheetByName(nomFeuilleGL);
  if (!feuilleGL) {
    feuilleGL = ss.insertSheet(nomFeuilleGL);
  } else {
    feuilleGL.clear();
  }
  
  const entetes = [['Compte', 'Date', 'Libellé', 'Débit', 'Crédit', 'Solde']];
  feuilleGL.getRange('A1:F1').setValues(entetes);
  feuilleGL.getRange('A1:F1').setFontWeight('bold').setBackground('#fbbc04').setFontColor('white');
  
  const lastRow = feuilleJournal.getLastRow();
  if (lastRow <= 1) return;
  
  const ecritures = feuilleJournal.getRange(2, 1, lastRow - 1, 6).getValues();
  
  const comptesMap = {};
  ecritures.forEach(ecriture => {
    const [date, numPiece, compte, libelle, debit, credit, solde] = ecriture;
    if (!comptesMap[compte]) comptesMap[compte] = [];
    comptesMap[compte].push({ date, libelle, debit: debit || 0, credit: credit || 0 });
  });
  
  const comptesOrdonnes = Object.keys(comptesMap).sort();
  const lignesGL = [];
  
  comptesOrdonnes.forEach(compte => {
    const operations = comptesMap[compte];
    let solde = 0;
    
    operations.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    operations.forEach(op => {
      solde += op.debit - op.credit;
      lignesGL.push([compte, op.date, op.libelle, op.debit, op.credit, solde]);
    });
    
    lignesGL.push(['', '', '', '', '', '']);
  });
  
  if (lignesGL.length > 0) {
    feuilleGL.getRange(2, 1, lignesGL.length, 6).setValues(lignesGL);
    feuilleGL.getRange(2, 2, lignesGL.length, 1).setNumberFormat('dd/mm/yyyy');
    feuilleGL.getRange(2, 4, lignesGL.length, 3).setNumberFormat('#,##0.00 €');
    
    for (let i = 0; i < lignesGL.length; i++) {
      if (lignesGL[i][0] !== '' && (i === 0 || lignesGL[i-1][0] === '')) {
        feuilleGL.getRange(i + 2, 1, 1, 6).setBackground('#e8f0fe').setFontWeight('bold');
      }
    }
  }
  
  feuilleGL.autoResizeColumns(1, 6);
  feuilleGL.setFrozenRows(1);
}

function genererBalanceExercice(exercice, dates, muet = false) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nomFeuilleJournal = CONFIG_EXERCICES.FEUILLES.JOURNAL_EXERCICE + exercice;
  const nomFeuilleBalance = CONFIG_EXERCICES.FEUILLES.BALANCE_EXERCICE + exercice;
  const feuillePlan = ss.getSheetByName(CONFIG.FEUILLES.PLAN_COMPTABLE);
  
  const feuilleJournal = ss.getSheetByName(nomFeuilleJournal);
  if (!feuilleJournal) return;
  
  let feuilleBalance = ss.getSheetByName(nomFeuilleBalance);
  if (!feuilleBalance) {
    feuilleBalance = ss.insertSheet(nomFeuilleBalance);
  } else {
    feuilleBalance.clear();
  }
  
  const entetes = [['Compte', 'Libellé', 'Total Débit', 'Total Crédit', 'Solde Débiteur', 'Solde Créditeur']];
  feuilleBalance.getRange('A1:F1').setValues(entetes);
  feuilleBalance.getRange('A1:F1').setFontWeight('bold').setBackground('#ea4335').setFontColor('white');
  
  const planComptable = {};
  const lastRowPlan = feuillePlan.getLastRow();
  if (lastRowPlan > 1) {
    const planData = feuillePlan.getRange(2, 1, lastRowPlan - 1, 2).getValues();
    planData.forEach(row => { planComptable[row[0]] = row[1]; });
  }
  
  const lastRow = feuilleJournal.getLastRow();
  if (lastRow <= 1) return;
  
  const ecritures = feuilleJournal.getRange(2, 1, lastRow - 1, 6).getValues();
  const comptesBalance = {};
  
  ecritures.forEach(ecriture => {
    const [date, numPiece, compte, libelle, debit, credit] = ecriture;
    if (!comptesBalance[compte]) {
      comptesBalance[compte] = {
        libelle: planComptable[compte] || 'Non défini',
        totalDebit: 0,
        totalCredit: 0
      };
    }
    comptesBalance[compte].totalDebit += debit || 0;
    comptesBalance[compte].totalCredit += credit || 0;
  });
  
  const comptesOrdonnes = Object.keys(comptesBalance).sort();
  const lignesBalance = [];
  let totalDebit = 0, totalCredit = 0, totalSoldeDebiteur = 0, totalSoldeCrediteur = 0;
  
  comptesOrdonnes.forEach(compte => {
    const data = comptesBalance[compte];
    const solde = data.totalDebit - data.totalCredit;
    const soldeDebiteur = solde > 0 ? solde : 0;
    const soldeCrediteur = solde < 0 ? -solde : 0;
    
    lignesBalance.push([compte, data.libelle, data.totalDebit, data.totalCredit, soldeDebiteur, soldeCrediteur]);
    
    totalDebit += data.totalDebit;
    totalCredit += data.totalCredit;
    totalSoldeDebiteur += soldeDebiteur;
    totalSoldeCrediteur += soldeCrediteur;
  });
  
  lignesBalance.push(['', '', '', '', '', '']);
  lignesBalance.push(['TOTAUX', '', totalDebit, totalCredit, totalSoldeDebiteur, totalSoldeCrediteur]);
  
  if (lignesBalance.length > 0) {
    feuilleBalance.getRange(2, 1, lignesBalance.length, 6).setValues(lignesBalance);
    feuilleBalance.getRange(2, 3, lignesBalance.length, 4).setNumberFormat('#,##0.00 €');
    
    const lastBalanceRow = feuilleBalance.getLastRow();
    feuilleBalance.getRange(lastBalanceRow, 1, 1, 6)
      .setFontWeight('bold')
      .setBackground('#fce8b2')
      .setBorder(true, true, true, true, false, false);
  }
  
  feuilleBalance.autoResizeColumns(1, 6);
  feuilleBalance.setFrozenRows(1);
}

function genererResultatExercice(exercice, dates, muet = false) {
  // Fonction simplifiée - voir fichier complet pour version détaillée
}

function genererBilanExercice(exercice, dates, muet = false) {
  // Fonction simplifiée - voir fichier complet pour version détaillée
}

function genererSyntheseExercices() {
  SpreadsheetApp.getUi().alert('Fonctionnalité disponible dans la version complète');
}

function cloturerExerciceEnCours() {
  SpreadsheetApp.getUi().alert('Fonctionnalité disponible dans la version complète');
}

function configurerExercice() {
  const ui = SpreadsheetApp.getUi();
  const moisActuel = PropertiesService.getUserProperties().getProperty('DEBUT_MOIS_EXERCICE') || '9';
  
  const response = ui.prompt(
    'Configuration de l\'exercice',
    'Mois actuel de début : ' + moisActuel + '\n\n' +
    'Entrez le nouveau numéro du mois de début (1-12) :',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const mois = parseInt(response.getResponseText());
    if (mois >= 1 && mois <= 12) {
      PropertiesService.getUserProperties().setProperty('DEBUT_MOIS_EXERCICE', mois.toString());
      // Recharger la config globale
      CONFIG_EXERCICES = getConfigurationExercices();
      ui.alert('✅ Configuration enregistrée : L\'exercice commence désormais au mois ' + mois);
    } else {
      ui.alert('❌ Mois invalide. Entrez un nombre entre 1 et 12.');
    }
  }
}


// ============================================
// MODULE PAIEMENTS ÉLÈVES
// ============================================

// ============================================
// AJOUTER AU MENU (dans onOpen)
// ============================================
/**
 * Dans la fonction onOpen() existante, ajoutez ces lignes AVANT .addToUi() :
 * 
 * .addSeparator()
 * .addSubMenu(ui.createMenu('💰 Paiements Élèves')
 *   .addItem('📋 Générer le détail des paiements', 'genererDetailPaiementsEleves')
 *   .addItem('💰 Saisir les montants facturés', 'saisirMontantsFactures'))
 */

// ============================================
// FONCTION PRINCIPALE
// ============================================

function genererDetailPaiementsEleves(saisonForcee = null, muet = false) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  // Vérifier que le Grand Livre existe
  const feuilleGL = ss.getSheetByName(CONFIG.FEUILLES.GRAND_LIVRE);
  if (!feuilleGL || feuilleGL.getLastRow() <= 1) {
    if (!muet) {
      ui.alert(
        '⚠️ Grand Livre vide',
        'Générez d\'abord le Grand Livre.\n\nMenu > Générer le Grand Livre',
        ui.ButtonSet.OK
      );
    }
    return;
  }
  
  let saison = saisonForcee;
  
  if (!saison) {
    if (muet) return; // Éviter de bloquer si mode silencieux
    
    // Demander la saison
    const response = ui.prompt(
      'Détail des paiements',
      'Pour quelle saison ?\n\nFormat : 2025-2026\n(Juin 2025 → Août 2026)',
      ui.ButtonSet.OK_CANCEL
    );
    
    if (response.getSelectedButton() !== ui.Button.OK) return;
    saison = response.getResponseText().trim();
  }
  
  if (!saison.match(/^\d{4}-\d{4}$/)) {
    if (!muet) ui.alert('❌ Format invalide', 'Utilisez le format : 2025-2026', ui.ButtonSet.OK);
    return;
  }
  
  const [anneeDebut, anneeFin] = saison.split('-').map(a => parseInt(a));
  const dateDebut = new Date(anneeDebut, 5, 1);  // 1er juin
  const dateFin = new Date(anneeFin, 7, 31, 23, 59, 59);  // 31 août
  
  // Collecter tous les paiements
  const tousLesPaiements = collecterPaiements(feuilleGL, dateDebut, dateFin);
  
  if (Object.keys(tousLesPaiements).length === 0) {
    if (!muet) ui.alert('⚠️ Aucun paiement détecté', 'Aucun paiement élève trouvé pour cette saison.', ui.ButtonSet.OK);
    return;
  }
  
  // Charger les montants facturés
  const montantsFactures = chargerMontantsFactures();
  
  // Créer la feuille
  creerFeuilleDetailPaiements(tousLesPaiements, montantsFactures, saison);
  
  if (!muet) {
    ui.alert(
      '✅ Détail généré !',
      Object.keys(tousLesPaiements).length + ' élève(s) détecté(s)\n\n' +
      '💰 Saisissez les montants facturés :\n' +
      'Menu > Paiements Élèves > Saisir les montants facturés',
      ui.ButtonSet.OK
    );
  }
}

// ============================================
// COLLECTE DES PAIEMENTS
// ============================================

function collecterPaiements(feuilleGL, dateDebut, dateFin) {
  const lastRow = feuilleGL.getLastRow();
  if (lastRow <= 1) return {};
  
  const donnees = feuilleGL.getRange(2, 1, lastRow - 1, 6).getValues();
  const paiementsParEleve = {};
  
  donnees.forEach(row => {
    const [compte, date, libelle, debit, credit, solde] = row;
    const compteStr = String(compte).trim();
    
    // Filtrer par date
    if (date instanceof Date && date >= dateDebut && date <= dateFin) {
      
      // Comptes 706 et 756 seulement
      if (compteStr === '706' || compteStr === '756') {
        const nomEleve = extraireNomEleve(libelle);
        
        if (nomEleve && credit > 0) {
          const key = normaliserTexte(nomEleve); // CLÉ NORMALISÉE
          
          if (!paiementsParEleve[key]) {
            paiementsParEleve[key] = {
              nomOriginal: nomEleve,
              paiements: []
            };
          }
          
          paiementsParEleve[key].paiements.push({
            date: date,
            montant: credit,
            libelle: libelle
          });
        }
      }
    }
  });
  
  // Trier les paiements par date pour chaque clé
  Object.keys(paiementsParEleve).forEach(key => {
    paiementsParEleve[key].paiements.sort((a, b) => a.date - b.date);
  });
  
  return paiementsParEleve;
}

// ============================================
// CRÉATION DE LA FEUILLE
// ============================================

function creerFeuilleDetailPaiements(tousLesPaiements, montantsFactures, saison) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  let feuille = ss.getSheetByName(CONFIG_DETAIL_PAIEMENTS.FEUILLE);
  if (feuille) {
    feuille.clear();
  } else {
    feuille = ss.insertSheet(CONFIG_DETAIL_PAIEMENTS.FEUILLE);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // EN-TÊTE
  // ═══════════════════════════════════════════════════════════════
  
  feuille.getRange('A1:G1').merge()
    .setValue('📋 détail des paiements par élève - saison ' + saison)
    .setFontSize(14).setFontWeight('normal')
    .setHorizontalAlignment('center')
    .setBackground('#4285f4').setFontColor('white');
  
  feuille.getRange('A2:G2').merge()
    .setValue('historique complet avec calcul automatique du reste à payer')
    .setFontSize(10).setFontStyle('italic')
    .setHorizontalAlignment('center')
    .setBackground('#e8f0fe');
  
  // En-têtes colonnes
  feuille.getRange('A3:G3').setValues([[
    'nom élève',
    'date paiement',
    'montant',
    'cumul perçu',
    'total facturé',
    'reste à payer',
    'statut'
  ]]);
  
  feuille.getRange('A3:G3')
    .setFontWeight('bold')
    .setBackground('#34a853')
    .setFontColor('white')
    .setHorizontalAlignment('center');
  
  // ═══════════════════════════════════════════════════════════════
  // DONNÉES PAR ÉLÈVE
  // ═══════════════════════════════════════════════════════════════
  
  let ligne = 4;
  // ═══════════════════════════════════════════════════════════════
  // CALCULS PRÉALABLES
  // ═══════════════════════════════════════════════════════════════
  
  let totalFactureGlobal = 0;
  let totalEncaisseGlobal = 0;
  
  const elevesAnomalies = {
    sansFacture: [],
    sansPaiement: [],
    impaves: []
  };
  
  const toutesLesCles = new Set([...Object.keys(tousLesPaiements), ...Object.keys(montantsFactures)]);
  const clesOrdonnees = Array.from(toutesLesCles).sort();

  // Premier passage pour calculer les totaux et anomalies
  clesOrdonnees.forEach(key => {
    const dataPaiements = tousLesPaiements[key] || { paiements: [], nomOriginal: '' };
    const dataFacture = montantsFactures[key] || { montant: 0, nomOriginal: '' };
    
    const paiements = dataPaiements.paiements;
    const totalFacture = dataFacture.montant;
    const nomAffichage = dataFacture.nomOriginal || dataPaiements.nomOriginal || key.toUpperCase();
    
    totalFactureGlobal += totalFacture;
    let cumul = 0;
    
    if (paiements.length === 0) {
      if (totalFacture > 0) elevesAnomalies.sansPaiement.push(nomAffichage);
    } else {
      paiements.forEach(p => cumul += p.montant);
      const reste = totalFacture - cumul;
      if (totalFacture === 0) {
        elevesAnomalies.sansFacture.push(nomAffichage);
      } else if (reste > 1) {
        elevesAnomalies.impaves.push(nomAffichage);
      }
    }
    totalEncaisseGlobal += cumul;
  });

  const resteGlobal = totalFactureGlobal - totalEncaisseGlobal;
  const tauxEncaissement = totalFactureGlobal > 0 ? (totalEncaisseGlobal / totalFactureGlobal * 100) : 0;

  // ═══════════════════════════════════════════════════════════════
  // AFFICHAGE DES TOTAUX (AU SOMMET)
  // ═══════════════════════════════════════════════════════════════
  
  ligne = 4;
  
  feuille.getRange(ligne, 1, 1, 7).merge()
    .setValue('📊 synthèse globale')
    .setFontWeight('normal').setBackground('#f1f3f4')
    .setHorizontalAlignment('center');
  ligne++;
  
  const synthRows = [
    ['total facturé', totalFactureGlobal, '#cfe2f3', '#000000'],
    ['total encaissé', totalEncaisseGlobal, '#d9ead3', '#38761d'],
    ['reste à encaisser', resteGlobal, resteGlobal > 0 ? '#f4cccc' : '#d9ead3', resteGlobal > 0 ? '#cc0000' : '#38761d'],
    ['taux d\'encaissement', (tauxEncaissement / 100), '#fff2cc', '#bf9000']
  ];
  
  synthRows.forEach(row => {
    feuille.getRange(ligne, 1, 1, 2).merge().setValue(row[0]).setFontWeight('normal');
    feuille.getRange(ligne, 3).setValue(row[1]).setBackground(row[2]).setFontColor(row[3]).setFontWeight('normal');
    if (row[0].includes('TAUX')) {
      feuille.getRange(ligne, 3).setNumberFormat('0.00%');
    } else {
      feuille.getRange(ligne, 3).setNumberFormat('#,##0.00 €');
    }
    ligne++;
  });
  
  // ═══════════════════════════════════════════════════════════════
  // TABLEAU DÉTAILLÉ
  // ═══════════════════════════════════════════════════════════════
  
  ligne += 2;
  
  // En-têtes colonnes
  feuille.getRange(ligne, 1, 1, 7).setValues([[
    'nom élève',
    'date paiement',
    'montant',
    'cumul perçu',
    'total facturé',
    'reste à payer',
    'statut'
  ]]);
  
  feuille.getRange(ligne, 1, 1, 7)
    .setFontWeight('bold')
    .setBackground('#34a853')
    .setFontColor('white')
    .setHorizontalAlignment('center');
  
  ligne++;
  
  clesOrdonnees.forEach(key => {
    const dataPaiements = tousLesPaiements[key] || { paiements: [], nomOriginal: '' };
    const dataFacture = montantsFactures[key] || { montant: 0, nomOriginal: '' };
    
    const paiements = dataPaiements.paiements;
    const totalFacture = dataFacture.montant;
    const nomAffichage = dataFacture.nomOriginal || dataPaiements.nomOriginal || key.toUpperCase();
    
    let cumul = 0;
    
    if (paiements.length === 0) {
      const resteAPayer = totalFacture;
      const statut = '❌ Aucun paiement';
      
      feuille.getRange(ligne, 1, 1, 7).setValues([[nomAffichage, '', 0, 0, totalFacture, resteAPayer, statut]]);
      feuille.getRange(ligne, 3, 1, 4).setNumberFormat('#,##0.00 €');
      feuille.getRange(ligne, 5, 1, 2).setNumberFormat('#,##0.00 €');
      feuille.getRange(ligne, 7).setBackground('#f4cccc').setFontColor('#cc0000');
      ligne++;
    } else {
      paiements.forEach((paiement, index) => {
        cumul += paiement.montant;
        const resteAPayer = totalFacture - cumul;
        
        let statut = '';
        if (totalFacture === 0) {
          statut = '⚠️ Non facturé';
        } else if (resteAPayer <= 1) { 
          statut = '✅ Payé';
        } else if (resteAPayer > 1 && resteAPayer < totalFacture) {
          statut = '🔄 Partiel';
        } else {
          statut = '❌ Impayé';
        }
        
        feuille.getRange(ligne, 1, 1, 7).setValues([[
          index === 0 ? nomAffichage : '',
          paiement.date,
          paiement.montant,
          cumul,
          index === 0 ? totalFacture : '',
          resteAPayer,
          statut
        ]]);
        
        // Formatage
        feuille.getRange(ligne, 3).setNumberFormat('#,##0.00 €');
        feuille.getRange(ligne, 4).setNumberFormat('#,##0.00 €');
        if (index === 0) feuille.getRange(ligne, 5).setNumberFormat('#,##0.00 €');
        feuille.getRange(ligne, 6).setNumberFormat('#,##0.00 €');
        
        // Couleur selon statut
        if (statut === '✅ Payé') {
          feuille.getRange(ligne, 7).setBackground('#d9ead3').setFontColor('#38761d');
        } else if (statut === '🔄 Partiel') {
          feuille.getRange(ligne, 7).setBackground('#fff2cc').setFontColor('#bf9000');
        } else if (statut === '❌ Impayé') {
          feuille.getRange(ligne, 7).setBackground('#f4cccc').setFontColor('#cc0000');
        } else if (statut === '⚠️ Non facturé') {
          feuille.getRange(ligne, 7).setBackground('#fce5cd').setFontColor('#e69138');
        }
        
        ligne++;
      });
    }
    
    // Ligne vide entre élèves
    feuille.getRange(ligne, 1, 1, 7).setBackground('#f3f3f3');
    ligne++;
  });
  
  // ═══════════════════════════════════════════════════════════════
  // RÉCAPITULATIF DES OPÉRATIONS À VÉRIFIER (AU PIED DU TABLEAU)
  // ═══════════════════════════════════════════════════════════════
  
  if (elevesAnomalies.sansFacture.length > 0 || elevesAnomalies.sansPaiement.length > 0 || elevesAnomalies.impaves.length > 0) {
    ligne += 2;
    feuille.getRange(ligne, 1, 1, 7).merge()
      .setValue('⚠️ RÉCAPITULATIF DES OPÉRATIONS À VÉRIFIER')
      .setFontSize(11).setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setBackground('#f4b400').setFontColor('white');
    ligne++;
    
    const sections = [
      { titre: '❓ élèves payés mais non facturés :', data: elevesAnomalies.sansFacture, color: '#fff2cc' },
      { titre: '❌ élèves facturés sans aucun paiement :', data: elevesAnomalies.sansPaiement, color: '#f4cccc' },
      { titre: '🔄 élèves avec reste à payer :', data: elevesAnomalies.impaves, color: '#fce5cd' }
    ];
    
    sections.forEach(sec => {
      if (sec.data.length > 0) {
        feuille.getRange(ligne, 1, 1, 7).merge().setValue(sec.titre).setFontWeight('normal').setBackground(sec.color);
        ligne++;
        sec.data.forEach(nom => {
          feuille.getRange(ligne, 1, 1, 7).merge().setValue('   • ' + nom).setFontSize(9).setFontColor('#666');
          ligne++;
        });
        ligne++; // espace
      }
    });
  }
}

// ============================================
// gestion des montants facturés
// ============================================

function chargerMontantsFactures() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let feuilleMontants = ss.getSheetByName(CONFIG_DETAIL_PAIEMENTS.FEUILLE_MONTANTS);
  const montants = {};
  if (feuilleMontants && feuilleMontants.getLastRow() >= 3) {
    const data = feuilleMontants.getRange(3, 1, feuilleMontants.getLastRow() - 2, 2).getValues();
    data.forEach(row => {
      const [nom, montant] = row;
      if (nom && !isNaN(parseFloat(montant))) {
        const key = normaliserTexte(nom);
        montants[key] = { montant: Number(montant), nomOriginal: nom };
      }
    });
  }
  return montants;
}

function saisirMontantsFactures() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const feuilleDetail = ss.getSheetByName(CONFIG_DETAIL_PAIEMENTS.FEUILLE);
  if (!feuilleDetail) {
    ui.alert('⚠️ générez d\'abord le détail des paiements');
    return;
  }
  const data = feuilleDetail.getDataRange().getValues();
  const eleves = [];
  for (let i = 3; i < data.length; i++) {
    const nom = data[i][0];
    if (nom && nom.trim() !== '' && !nom.includes('détail') && !nom.includes('totaux') && !eleves.includes(nom)) {
      eleves.push(nom);
    }
  }
  if (eleves.length === 0) {
    ui.alert('⚠️ aucun élève trouvé');
    return;
  }
  let feuilleMontants = ss.getSheetByName(CONFIG_DETAIL_PAIEMENTS.FEUILLE_MONTANTS);
  if (!feuilleMontants) {
    feuilleMontants = ss.insertSheet(CONFIG_DETAIL_PAIEMENTS.FEUILLE_MONTANTS);
  } else {
    feuilleMontants.clear();
  }
  feuilleMontants.getRange('A1:B1').merge().setValue('💰 montants facturés par élève').setFontSize(14).setFontWeight('normal').setHorizontalAlignment('center').setBackground('#4285f4').setFontColor('white');
  feuilleMontants.getRange('A2:B2').setValues([['nom élève', 'montant facturé (€)']]);
  feuilleMontants.getRange('A2:B2').setFontWeight('normal').setBackground('#34a853').setFontColor('white');
  const montantsExistants = chargerMontantsFactures();
  const lignes = eleves.map(nom => [nom, montantsExistants[nom] || 0]);
  feuilleMontants.getRange(3, 1, lignes.length, 2).setValues(lignes);
  feuilleMontants.getRange(3, 2, lignes.length, 1).setNumberFormat('#,##0.00');
  feuilleMontants.autoResizeColumns(1, 2);
  feuilleMontants.setColumnWidth(1, 200);
  ui.alert('✅ feuille créée', 'remplissez les montants facturés\n\npuis régénérez le détail :\nmenu > paiements élèves > générer le détail', ui.ButtonSet.OK);
}

// ============================================
// EXTRACTION DU NOM - VERSION STANDARD
// ============================================

function extraireNomEleve(libelle) {
  if (!libelle || typeof libelle !== 'string') return null;
  
  const libelleLower = libelle.toLowerCase();
  
  // Exclusions
  if (libelleLower.includes('stripe stripe')) return null;
  
  const fournisseurs = ['amazon', 'orange', 'google', 'wix', 'adobe', 'microsoft', 'maif', 'bureau vall', 'thomann', 'decathlon', 'leclerc', 'super u', 'auchan', 'vistaprint', 'paypal', 'gifi', 'leroy merlin', 'ikea', 'tweeter', 'star musique', 'neural dsp', 'uniformation', 'urssaf', 'araujo', 'copy top', 'la papetheque', 'backdrop', 'effect on line', 'la tranosphere', 'allirol', 'hexopee', 'gralypho'];
  
  if (fournisseurs.some(f => libelleLower.includes(f))) return null;
  
  const profsNoms = ['silvestri', 'depondt', 'cucchetti', 'philbert'];
  if (profsNoms.some(p => libelleLower.includes(p))) return null;
  
  let nom = '';
  
  // VIR INST
  if (libelleLower.startsWith('vir inst ')) {
    nom = libelle.substring(9).replace(/^Mme /i, '').replace(/^M /i, '').replace(/^MLLE /i, '').replace(/^MME /i, '').replace(/^MR /i, '');
    const mots = nom.split(' ');
    if (mots.length >= 2) {
      let indexFin = mots.length;
      for (let i = 0; i < mots.length; i++) {
        if (mots[i].match(/^BIPT/) || mots[i].match(/^C-/) || mots[i].match(/^\d+$/) || mots[i].length > 20) {
          indexFin = i;
          break;
        }
      }
      nom = mots.slice(0, Math.min(indexFin, 3)).join(' ');
    }
  }
  // EVI
  else if (libelleLower.startsWith('evi ')) {
    nom = libelle.substring(4).replace(/^M OU MME /i, '').replace(/^M ou Mme /i, '').replace(/^MONSIEUR /i, '').replace(/^MADAME /i, '').replace(/^M /i, '').replace(/^MLLE /i, '').replace(/^Mme /i, '').replace(/^MME /i, '').replace(/^MR /i, '').replace(/^STRIPE /i, '');
    const mots = nom.split(' ');
    if (mots.length >= 2) {
      let indexFin = mots.length;
      for (let i = 0; i < mots.length; i++) {
        const motLower = mots[i].toLowerCase();
        if (motLower === 'cours' || motLower === 'virement' || motLower === 'trimestre' || motLower === 'premier' || motLower === 'vers' || motLower === 'ecole' || mots[i].length > 20) {
          indexFin = i;
          break;
        }
      }
      nom = mots.slice(0, Math.min(indexFin, 3)).join(' ');
    }
  }
  // REMISE EUROPRELEVEMENT
  else if (libelleLower.includes('remise europrelevement')) {
    nom = libelle.replace(/REMISE EUROPRELEVEMENT /gi, '').split(' ')[0];
  }
  // REM CHQ
  else if (libelleLower.includes('rem chq')) {
    return null;
  }
  // REJ PRLV SEPA
  else if (libelleLower.includes('rej prlv sepa')) {
    nom = libelle.replace(/REJ PRLV SEPA /gi, '').split(' ').slice(0, 2).join(' ');
  }
  else {
    nom = libelle;
  }
  
  // Nettoyage
  nom = nom.replace(/BIPT\d+/gi, '').replace(/C-[A-Za-z\s]+$/gi, '').replace(/\b\d{1,5}\b/g, '').replace(/\d{2}\/\d{2}\/\d{4}/g, '').replace(/\s+/g, ' ').trim();
  
  if (!nom || nom.length < 3) return null;
  
  const motsInterdits = ['virement', 'prelevement', 'remise', 'carte', 'facture', 'retrait', 'paiement', 'de', 'ou', 'mme', 'mlle', 'stripe'];
  if (motsInterdits.includes(nom.toLowerCase())) return null;
  if (nom.match(/^[A-Z]$/)) return null;
  
  return nom;
}

// ============================================
// INTERFACE AIDE (MODE D'EMPLOI)
// ============================================

function afficherModeDEmploi() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nomFeuille = '📖 mode d\'emploi';
  let feuille = ss.getSheetByName(nomFeuille);
  if (!feuille) {
    feuille = ss.insertSheet(nomFeuille);
  } else {
    feuille.clear();
  }
  feuille.setHiddenGridlines(true);
  
  // marge supérieure (margin-top)
  feuille.setRowHeight(1, 40);
  
  // en-tête
  feuille.getRange('A2:G2').merge().setValue('Guide d\'utilisation du gestionnaire de comptabilité').setFontSize(22).setFontWeight('normal').setVerticalAlignment('top').setFontColor('#202124');
  feuille.setRowHeight(2, 20);
    // feuille.setRowHeight(3, 30);
  
  const START_LIGNE = 7;
  let ligne = START_LIGNE;

  // démarrage
  feuille.getRange(ligne, 1, 1, 2).merge().setValue('🚀 Démarrage').setFontWeight('normal').setFontSize(11).setFontColor('#202124').setBorder(null, null, true, null, null, null, '#e0e0e0', SpreadsheetApp.BorderStyle.SOLID_MEDIUM).setVerticalAlignment('center');
  ligne += 2;

  const etapes = [
    ['1. Initialisation', 'Menu comptabilité > "initialiser toutes les feuilles". (gère le formatage initial).'],
    ['2. Configuration', 'Feuille "configuration csv". (ajustez les colonnes de votre relevé bancaire).'],
    ['3. Préparation', 'Feuille "données brutes". (copiez-collez vos données csv directement ici).'],
    ['4. Importation', 'Menu comptabilité > "importer les données csv". (le script formate vos données).'],
    ['5. Synchronisation', 'Menu comptabilité > "mettre à jour". (génère toute votre comptabilité en un clic).']
  ];
  
  etapes.forEach(etape => {
    feuille.getRange(ligne, 1).setValue(etape[0]).setFontWeight('normal').setFontColor('#444444').setVerticalAlignment('top');
    feuille.getRange(ligne, 2).setValue(etape[1]).setWrap(true).setFontColor('#5f6368').setVerticalAlignment('top');
    feuille.setRowHeight(ligne, 80);
    ligne += 1;
  });

  // traiter les inconnus
  ligne += 1;
  feuille.getRange(ligne, 1, 1, 2).merge().setValue('🔍 Traiter les libellés inconnus').setFontWeight('normal').setFontSize(11).setFontColor('#202124').setBorder(null, null, true, null, null, null, '#e0e0e0', SpreadsheetApp.BorderStyle.SOLID_MEDIUM).setVerticalAlignment('top');
  ligne += 2;

  const etapesInconnus = [
    ['1. Feuille', 'Cliquez sur la feuille (en bas de votre interface) "rapport non attribué (699)". (le script y liste les libellés inconnus).'],
    ['2. Détection', 'Cette feuille liste toutes les opérations qui n\'ont pas été classées automatiquement.'],
    ['3. Action', 'Cochez la case "action" pour une opération, afin de lancer l\'assistant de classification.'],
    ['4. Règle', 'Saisissez le libellé exact de l\'opération à mémoriser pour l\'avenir.'],
    ['5. Compte', 'Choisissez le numéro de compte associé (ex: 606, 706...).'],
    ['6. Note', 'Le script attribuera automatiquement l\'opération, vous n\'ayez rien à faire. Vous verrez simplement l\'opération disparaître du tableau, preuve qu\'elle a bien été attribuée. Pour les opérations comportant le même libellé, cochez une seule opération et le script attribuera automatiquement la règle à toutes les opérations comportant le même libellé.']
  ];

  etapesInconnus.forEach(etape => {
    feuille.getRange(ligne, 1).setValue(etape[0]).setFontWeight('normal').setFontColor('#444444').setVerticalAlignment('top');
    feuille.getRange(ligne, 2).setValue(etape[1]).setWrap(true).setFontColor('#5f6368').setVerticalAlignment('top');
    feuille.setRowHeight(ligne, 80);
    ligne += 1;
  });

  // suivi des paiements
  ligne += 1;
  feuille.getRange(ligne, 1, 1, 2).merge().setValue('💰 Suivi des paiements').setFontWeight('normal').setFontSize(11).setFontColor('#202124').setBorder(null, null, true, null, null, null, '#e0e0e0', SpreadsheetApp.BorderStyle.SOLID_MEDIUM).setVerticalAlignment('top');
  ligne += 2;

  const etapesPaiements = [
    ['1. tarifs', 'menu > paiements élèves > "saisir les montants facturés".'],
    ['2. saisie', 'remplissez les tarifs dus par chaque élève dans la feuille créée.'],
    ['3. rapport', 'menu > paiements élèves > "générer le détail des paiements".'],
    ['4. analyse', 'consultez la feuille "détail paiements" pour voir les impayés.']
  ];

  etapesPaiements.forEach(etape => {
    feuille.getRange(ligne, 1).setValue(etape[0]).setFontWeight('normal').setFontColor('#444444').setVerticalAlignment('top');
    feuille.getRange(ligne, 2).setValue(etape[1]).setWrap(true).setFontColor('#5f6368').setVerticalAlignment('top');
    feuille.setRowHeight(ligne, 80);
    ligne += 1;
  });

  // clôturer l'année
  ligne += 1;
  feuille.getRange(ligne, 1, 1, 2).merge().setValue('📅 Clôturer l\'année').setFontWeight('normal').setFontSize(11).setFontColor('#202124').setBorder(null, null, true, null, null, null, '#e0e0e0', SpreadsheetApp.BorderStyle.SOLID_MEDIUM).setVerticalAlignment('top');
  ligne += 2;

  const etapesCloture = [
    ['1. bilan', 'vérifiez vos rapports une dernière fois via le menu "mettre à jour".'],
    ['2. clôture', 'menu > clôture > "clôturer l\'exercice en cours".'],
    ['3. archive', 'le script archive vos données et prépare les feuilles pour la nouvelle saison.']
  ];

  etapesCloture.forEach(etape => {
    feuille.getRange(ligne, 1).setValue(etape[0]).setFontWeight('normal').setFontColor('#444444').setVerticalAlignment('top');
    feuille.getRange(ligne, 2).setValue(etape[1]).setWrap(true).setFontColor('#5f6368').setVerticalAlignment('top');
    feuille.setRowHeight(ligne, 40);
    ligne += 1;
  });

  // --- NOUVEAU BLOC : MODIFIER UNE ERREUR ---
  ligne += 1;
  feuille.getRange(ligne, 1, 1, 2).merge().setValue('✏️ modifier une erreur').setFontWeight('normal').setFontColor('#1a73e8').setVerticalAlignment('top');
  feuille.setRowHeight(ligne, 40);
  ligne += 2;

  const etapesModif = [
    ['1. trouver', 'repérez l\'erreur dans un rapport (ex: paiements) et copiez son libellé.'],
    ['2. chercher', 'allez dans "données brutes" et faites [pomme+f] pour trouver la ligne.'],
    ['3. action', 'cochez la case "action" (colonne 10) sur la ligne correspondante.'],
    ['4. assistant', 'procédez à la réattribution : tout sera synchronisé automatiquement.']
  ];

  etapesModif.forEach(etape => {
    feuille.getRange(ligne, 1).setValue(etape[0]).setFontWeight('normal').setFontColor('#444444').setVerticalAlignment('top');
    feuille.getRange(ligne, 2).setValue(etape[1]).setWrap(true).setFontColor('#5f6368').setVerticalAlignment('top');
    feuille.setRowHeight(ligne, 40);
    ligne += 1;
  });

  // onglets disponibles
  ligne = START_LIGNE;
  const COL_GLOSSAIRE = 4;
  feuille.getRange(ligne, COL_GLOSSAIRE, 1, 2).merge().setValue('📚 Onglets disponibles dans le menu comptabilité').setFontWeight('normal').setFontSize(11).setFontColor('#202124').setBackground('#f8f9fa').setBorder(null, null, true, null, null, null, '#e0e0e0', SpreadsheetApp.BorderStyle.SOLID_MEDIUM).setVerticalAlignment('top');
  ligne += 2;
  
  const glossaire = [
    ['📖 Mode d\'emploi', 'ouvre ce guide interactif.'],
    ['📥 Importer les données CSV', 'formate les données bancaires.'],
    ['📖 Générer le Journal', 'génère les écritures comptables (avec case 🔧 pour corriger).'],
    ['📚 Générer le Grand Livre', 'détaille les écritures par compte (avec case 🔧 pour corriger).'],
    ['⚖️ Générer la Balance', 'synthèse annuelle des débits/crédits par compte.'],
    ['🔄 Mettre à jour', 'bouton maître : synchronise tous vos rapports en un clic.'],
    ['📊 Choisir et générer un exercice', 'affiche un rapport pour une année précise.'],
    ['📈 Générer tous les exercices', 'crée les rapports pour chaque saison fiscale.'],
    ['💰 Synthèse des exercices', 'tableau récapitulatif multi-annuel des résultats.'],
    ['🔚 Clôturer l\'exercice en cours', 'archive les données pour l\'année suivante.'],
    ['⚠️ Rapport Non Attribué (699)', 'gère les opérations inconnues (case à cocher pour classer).'],
    ['📋 Synthèse des règles (Vérification)', 'vérifie la cohérence de vos mots-clés.'],
    ['🔄 Restaurer catalogue par défaut', 'réinitialise les règles de base par défaut.'],
    ['📊 Statistiques de classification', 'affiche le taux de réussite de la classification.'],
    ['⚙️ Configurer l\'exercice', 'définit le mois de début de l\'année fiscale.'],
    ['📋 Afficher les règles d\'origine', 'affiche les règles brutes pour modification.'],
    ['📋 Générer le détail des paiements', 'analyse le "reste à payer" (avec case 🔧 pour corriger).'],
    ['💰 Saisir les montants facturés', 'définit les sommes dues par chaque élève.'],
    ['⚙️ Configurer les colonnes CSV', 'mappage csv : date, libellé, débit, crédit.'],
    ['📅 Régler le mois de début d\'exercice', 'change le mois de clôture fiscale.'],
    ['⚙️ Initialiser toutes les feuilles', 'structure le projet (à faire une fois au début).']
  ];
  
  glossaire.forEach(item => {
    feuille.getRange(ligne, COL_GLOSSAIRE).setValue(item[0]).setFontWeight('normal').setFontColor('#444444').setVerticalAlignment('top');
    feuille.getRange(ligne, COL_GLOSSAIRE + 1).setValue(item[1]).setWrap(true).setFontColor('#5f6368').setVerticalAlignment('top');
    feuille.getRange(ligne, COL_GLOSSAIRE, 1, 2).setBackground('#f8f9fa');
    feuille.setRowHeight(ligne, 40);
    ligne += 1;
  });

  feuille.setColumnWidth(1, 180);
  feuille.setColumnWidth(2, 400);
  feuille.setColumnWidth(3, 40);
  feuille.setColumnWidth(4, 180);
  feuille.setColumnWidth(5, 400);
  ss.setActiveSheet(feuille);
  SpreadsheetApp.getUi().alert('✅ mode d\'emploi mis à jour.');
}

function ouvrirConfigCSV() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const feuille = ss.getSheetByName(CONFIG.FEUILLES.CONFIG_CSV);
  if (feuille) {
    ss.setActiveSheet(feuille);
  } else {
    SpreadsheetApp.getUi().alert('⚠️ La feuille de configuration n\'existe pas encore. Lancez l\'initialisation.');
  }
}

function ouvrirParametresExercice() {
  const ui = SpreadsheetApp.getUi();
  const proprietes = PropertiesService.getUserProperties();
  const reponse = ui.prompt(
    '📅 Configuration de l\'exercice',
    'Indiquez le numéro du mois de début de votre exercice fiscal (ex: 9 pour Septembre, 1 pour Janvier) :',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (reponse.getSelectedButton() === ui.Button.OK) {
    const nouveauMois = parseInt(reponse.getResponseText());
    if (nouveauMois >= 1 && nouveauMois <= 12) {
      proprietes.setProperty('DEBUT_MOIS_EXERCICE', nouveauMois.toString());
      ui.alert('✅ mois de début enregistré : ' + nouveauMois + '.\n\nrelancez "mettre à jour" pour mettre à jour vos rapports.');
    } else {
      ui.alert('❌ erreur : veuillez saisir un chiffre entre 1 et 12.');
    }
  }
}

