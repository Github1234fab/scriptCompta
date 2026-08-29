/**
 * ═══════════════════════════════════════════════════════════════════
 * ORCHESTRATION ET CONTROLLER GENERAL - PROTOTYPE SAAS COMPTABILITÉ
 * ═══════════════════════════════════════════════════════════════════
 */

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

const App = {
  transactions: [],
  closingMonth: 9, // Septembre par défaut
  activeTxId: null, // Transaction en cours de tri manuel
  entities: [],
  activeEntityId: 'entity-lyon',
  eventsBound: false,

  // Glossaire pédagogique déjargonisé
  glossary: [
    { terme: 'Le Livre-Journal', trad: 'Le Livre de Bord', def: 'Le journal de bord chronologique de votre argent. Chaque centime qui entre ou sort doit y figurer, écrit en double (provenance et destination).' },
    { terme: 'Le Grand Livre', trad: 'Le Tri par Catégories', def: 'Prend toutes les lignes du Journal et les trie dans des tiroirs séparés (Loyer, Timbres, Salaires). Indispensable pour voir combien vous dépensez par budget.' },
    { terme: 'La Balance', trad: 'Le Résumé de Contrôle', def: 'Un tableau récapitulatif qui montre le total des entrées et sorties pour chaque tiroir. C\'est ce qui prouve que vos comptes sont équilibrés.' },
    { terme: 'Le Bilan', trad: 'La Fiche d\'Identité Financière', def: 'Une image à un instant T qui liste ce que la structure possède (l\'actif : solde en banque, ordinateurs...) et ce qu\'elle doit (le passif : emprunts, cotisations reçues en avance).' },
    { terme: 'Le Compte de Résultat', trad: 'Gains vs Pertes', def: 'Un tableau qui calcule si vous avez gagné de l\'argent (Bénéfice/Excédent) ou perdu de l\'argent (Déficit) au cours de l\'année.' },
    { terme: 'Plan Comptable', trad: 'Le Catalogue de Rangement', def: 'La liste officielle des étiquettes (numérotées comme 606 pour les fournitures) autorisées pour classer vos factures.' },
    { terme: 'Exercice Comptable', trad: 'La Saison Financière', def: 'La période de 12 mois sur laquelle on calcule vos gains. Pour les assos, elle commence souvent le 1er septembre avec la rentrée scolaire.' },
    { terme: 'Débit', trad: 'Dépenses / Sorties d\'argent', def: 'Enregistrer une dépense ou l\'achat d\'un bien qui rentre dans votre patrimoine.' },
    { terme: 'Crédit', trad: 'Recettes / Entrées d\'argent', def: 'Enregistrer un gain, une subvention, ou l\'origine d\'un financement.' }
  ],

  init() {
    // Initialisation des entités
    this.initEntities();
    const entityId = this.activeEntityId;

    // Initialisation des modules métier et du moteur de tri
    Categorizer.init(entityId);
    SaaSModules.init(entityId);

    // Chargement de l'exercice
    this.closingMonth = parseInt(localStorage.getItem(`saas_compta_closing_month_${entityId}`)) || 9;
    document.getElementById('closing-month-select').value = this.closingMonth;

    // Chargement des transactions
    const savedTx = localStorage.getItem(`saas_compta_transactions_${entityId}`);
    if (savedTx) {
      this.transactions = JSON.parse(savedTx);
    } else {
      this.chargerTransactionsDemo(false);
    }

    // Appliquer le modèle comptable de la structure active
    const activeEntity = this.entities.find(e => e.id === entityId);
    if (activeEntity) {
      this.applyAccountingModel(activeEntity.model || 'all');
    }

    // Enregistrement des événements d'interface
    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }
    
    // Rendu initial de l'onglet actif (Dashboard)
    this.renderActiveView();
    this.updateBadges();
    this.updateHeaderEntity();
  },

  initEntities() {
    const savedEntities = localStorage.getItem('saas_compta_entities');
    if (savedEntities) {
      this.entities = JSON.parse(savedEntities);
    } else {
      this.entities = [
        { id: 'entity-lyon', name: 'Club de Musique de Lyon', model: 'all' }
      ];
      this.saveEntities();
    }

    this.activeEntityId = localStorage.getItem('saas_compta_active_entity_id');
    if (!this.activeEntityId || !this.entities.some(e => e.id === this.activeEntityId)) {
      this.activeEntityId = this.entities[0].id;
      localStorage.setItem('saas_compta_active_entity_id', this.activeEntityId);
    }

    this.renderEntitiesDropdown();
  },

  saveEntities() {
    localStorage.setItem('saas_compta_entities', JSON.stringify(this.entities));
  },

  renderEntitiesDropdown() {
    const select = document.getElementById('select-active-entity');
    if (!select) return;

    select.innerHTML = '';
    this.entities.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = e.name;
      if (e.id === this.activeEntityId) opt.selected = true;
      select.appendChild(opt);
    });

    const optNew = document.createElement('option');
    optNew.value = 'create_new';
    optNew.textContent = '➕ Créer une nouvelle structure...';
    select.appendChild(optNew);
  },

  updateHeaderEntity() {
    const entity = this.entities.find(e => e.id === this.activeEntityId);
    if (entity) {
      const span = document.querySelector('.user-badge span');
      if (span) span.textContent = entity.name;
    }
  },

  applyAccountingModel(model) {
    const membersMenu = document.getElementById('menu-members')?.parentElement;
    const salesMenu = document.getElementById('menu-sales')?.parentElement;
    const donationsMenu = document.getElementById('menu-donations')?.parentElement;

    if (membersMenu) membersMenu.style.display = (model === 'all' || model === 'members') ? 'block' : 'none';
    if (salesMenu) salesMenu.style.display = (model === 'all' || model === 'sales') ? 'block' : 'none';
    if (donationsMenu) donationsMenu.style.display = (model === 'all' || model === 'donations') ? 'block' : 'none';

    const modelSelect = document.getElementById('select-accounting-model');
    if (modelSelect) modelSelect.value = model;

    const entity = this.entities.find(e => e.id === this.activeEntityId);
    if (entity && entity.model !== model) {
      entity.model = model;
      this.saveEntities();
    }
  },

  navigateToBook(bookId) {
    document.querySelectorAll('.menu-item').forEach(mi => mi.classList.remove('active'));
    document.getElementById('menu-books').classList.add('active');
    this.renderActiveView();
    document.getElementById(`sub-btn-${bookId}`).click();
  },

  bindEvents() {
    // Menu Sidebar (Virtual Router)
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.menu-item').forEach(mi => mi.classList.remove('active'));
        item.classList.add('active');
        this.renderActiveView();
      });
    });

    // Sous-navigation Registres Comptables
    document.querySelectorAll('[data-sub]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-sub]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const subViewId = btn.getAttribute('data-sub');
        document.querySelectorAll('.compta-sub-view').forEach(view => view.style.display = 'none');
        document.getElementById(`sub-view-${subViewId}`).style.display = 'block';
        this.renderSubViewCompta(subViewId);
      });
    });

    // Changement de structure/entité
    const selectEntity = document.getElementById('select-active-entity');
    if (selectEntity) {
      selectEntity.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'create_new') {
          document.getElementById('modal-create-entity').classList.add('active');
          selectEntity.value = this.activeEntityId;
        } else {
          this.activeEntityId = val;
          localStorage.setItem('saas_compta_active_entity_id', val);
          this.init();
          this.showToast(`Structure active : ${this.entities.find(ent => ent.id === val).name}`);
        }
      });
    }

    // Modale création d'entité : fermer / annuler
    const closeEntityBtn = document.getElementById('close-entity-btn');
    const cancelEntityBtn = document.getElementById('btn-cancel-entity');
    const modalCreateEntity = document.getElementById('modal-create-entity');

    const fermerModalEntity = () => {
      if (modalCreateEntity) modalCreateEntity.classList.remove('active');
      const form = document.getElementById('create-entity-form');
      if (form) form.reset();
    };

    if (closeEntityBtn) closeEntityBtn.addEventListener('click', fermerModalEntity);
    if (cancelEntityBtn) cancelEntityBtn.addEventListener('click', fermerModalEntity);

    // Formulaire de création d'entité
    const createEntityForm = document.getElementById('create-entity-form');
    if (createEntityForm) {
      createEntityForm.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const name = document.getElementById('entity-name-input').value.trim();
        const model = document.getElementById('entity-model-input').value;

        if (!name) return;

        const newId = 'entity_' + Date.now();
        const newEntity = { id: newId, name, model };

        this.entities.push(newEntity);
        this.saveEntities();

        this.activeEntityId = newId;
        localStorage.setItem('saas_compta_active_entity_id', newId);

        fermerModalEntity();
        this.init();
        this.showToast(`Structure "${name}" créée avec succès !`);
      });
    }

    // Sélecteur de modèle comptable
    const selectModel = document.getElementById('select-accounting-model');
    if (selectModel) {
      selectModel.addEventListener('change', (e) => {
        const model = e.target.value;
        this.applyAccountingModel(model);
        this.showToast(`Modèle configuré : ${e.target.options[e.target.selectedIndex].text}`);
        this.renderActiveView();
      });
    }

    // Raccourcis livres comptables depuis le Dashboard
    document.getElementById('dash-btn-journal').addEventListener('click', () => this.navigateToBook('journal'));
    document.getElementById('dash-btn-grandlivre').addEventListener('click', () => this.navigateToBook('grandlivre'));
    document.getElementById('dash-btn-balance').addEventListener('click', () => this.navigateToBook('balance'));
    document.getElementById('dash-btn-bilan').addEventListener('click', () => this.navigateToBook('bilan'));

    // Lien vers le glossaire depuis le Dashboard
    document.getElementById('pedago-btn-glossary').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('menu-glossary').click();
    });

    // Importation de fichier CSV (Vue Import)
    const dropzone = document.getElementById('csv-dropzone');
    const fileInput = document.getElementById('csv-file-input');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          this.traiterFichierCSV(files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.traiterFichierCSV(e.target.files[0]);
        }
      });
    }

    // Importation de fichier CSV (Dashboard)
    const dashDropzone = document.getElementById('dashboard-csv-dropzone');
    const dashFileInput = document.getElementById('dashboard-csv-file-input');

    if (dashDropzone && dashFileInput) {
      dashDropzone.addEventListener('click', () => dashFileInput.click());
      dashDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dashDropzone.classList.add('dragover');
      });
      dashDropzone.addEventListener('dragleave', () => dashDropzone.classList.remove('dragover'));
      dashDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dashDropzone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          this.traiterFichierCSV(files[0]);
        }
      });

      dashFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.traiterFichierCSV(e.target.files[0]);
        }
      });
    }

    // Bouton de démo du Dashboard
    document.getElementById('dashboard-load-demo-btn').addEventListener('click', () => {
      document.getElementById('load-demo-btn').click();
    });

    // Chargement démo
    document.getElementById('load-demo-btn').addEventListener('click', () => {
      this.chargerTransactionsDemo(true);
      this.showToast('✅ Relevé bancaire de démonstration chargé !');
      document.querySelector('[data-view="categorize"]').click();
    });

    // Recalculer la comptabilité "Générer la compta"
    const recalculateBtn = document.getElementById('btn-recalculate-compta');
    if (recalculateBtn) {
      recalculateBtn.addEventListener('click', () => {
        const originalHtml = recalculateBtn.innerHTML;
        recalculateBtn.disabled = true;
        recalculateBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Recalcul en cours...';

        setTimeout(() => {
          this.recatTout();
          recalculateBtn.disabled = false;
          recalculateBtn.innerHTML = originalHtml;
          this.showToast('🤖 Comptabilité entièrement recalculée et registres à jour !');
        }, 500);
      });
    }

    // Validation 1-Clic suggestion
    document.getElementById('btn-validate-suggestion').addEventListener('click', () => {
      const activeTx = this.transactions.find(t => t.id === this.activeTxId);
      if (activeTx && activeTx.suggestionMotCle) {
        const type = activeTx.debit > 0 ? 'debit' : 'credit';
        Categorizer.ajouterRegleEtRecat(activeTx.suggestionMotCle, activeTx.compteAttribué, type);
        this.recatTout();
        this.showToast(`Règle créée : "${activeTx.suggestionMotCle}" associée au compte ${activeTx.compteAttribué}`);
      }
    });

    // Validation Tri Manuel
    document.getElementById('btn-submit-categorize').addEventListener('click', () => {
      const activeTx = this.transactions.find(t => t.id === this.activeTxId);
      const selectCompte = document.getElementById('select-manual-compte');
      const checkLearn = document.getElementById('check-learn-rule');
      const inputKeyword = document.getElementById('input-learn-keyword');

      if (!activeTx) return;

      const compte = selectCompte.value;
      const cleanKeyword = inputKeyword.value.trim().toUpperCase();

      if (checkLearn.checked && cleanKeyword !== '') {
        const type = activeTx.debit > 0 ? 'debit' : 'credit';
        Categorizer.ajouterRegleEtRecat(cleanKeyword, compte, type);
        this.showToast(`Apprentissage réussi ! Règle "${cleanKeyword}" enregistrée.`);
      } else {
        activeTx.compteAttribué = compte;
        activeTx.statut = 'attribue';
        activeTx.regleAppliquee = 'Attribution ponctuelle';
        this.saveTransactions();
      }

      if (activeTx.credit > 0 && (compte === '756' || compte === '706')) {
        const reconciliation = SaaSModules.reconcilierTransactionEleve(activeTx);
        if (reconciliation) {
          this.showToast(`💰 Liaison Adhérent : Inscription de ${reconciliation.membre} mise à jour (+${reconciliation.montant}€) !`);
        }
      }

      this.recatTout();
    });

    // Auto-classer en masse
    document.getElementById('btn-autoclass-all').addEventListener('click', () => {
      let count = 0;
      this.transactions.forEach(tx => {
        if (tx.statut === 'suggere') {
          const type = tx.debit > 0 ? 'debit' : 'credit';
          Categorizer.ajouterRegleEtRecat(tx.suggestionMotCle, tx.compteAttribué, type);
          count++;
        }
      });
      if (count > 0) {
        this.showToast(`🤖 Succès : ${count} règles d'attribution créées et appliquées automatiquement !`);
        this.recatTout();
      }
    });

    // Enregistrement d'un nouvel élève
    document.getElementById('add-member-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const nom = document.getElementById('member-name').value;
      const email = document.getElementById('member-email').value;
      const forfait = document.getElementById('member-forfait').value;

      SaaSModules.ajouterMembre(nom, forfait, email);
      document.getElementById('add-member-form').reset();
      this.renderViewMembers();
      this.showToast('✅ Nouvel élève inscrit au registre !');
    });

    // Enregistrement d'un nouveau produit
    document.getElementById('add-product-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const nom = document.getElementById('product-name').value;
      const buyPrice = document.getElementById('product-buy-price').value;
      const sellPrice = document.getElementById('product-sell-price').value;
      const stock = document.getElementById('product-stock').value;

      SaaSModules.ajouterProduit(nom, buyPrice, sellPrice, stock);
      document.getElementById('add-product-form').reset();
      this.renderViewSales();
      this.showToast('✅ Produit ajouté au catalogue boutique !');
    });

    // Enregistrement d'un don
    document.getElementById('add-donation-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const nom = document.getElementById('donor-name').value;
      const adresse = document.getElementById('donor-address').value;
      const montant = parseFloat(document.getElementById('donor-amount').value);

      SaaSModules.enregistrerDon(nom, adresse, montant);

      const nouvelleTx = {
        id: 'tx-don-' + Date.now(),
        date: new Date().toISOString().split('T')[0],
        libelle: `DON DE ${nom.toUpperCase()}`,
        info: 'Don manuel enregistré',
        debit: 0,
        credit: montant,
        compteAttribué: null,
        regleAppliquee: null,
        statut: 'non_attribue'
      };
      this.transactions.unshift(nouvelleTx);
      this.saveTransactions();

      this.recatTout();

      document.getElementById('add-donation-form').reset();
      this.renderViewDonations();
      this.showToast('❤️ Don enregistré ! Reçu fiscal prêt dans le tableau.');
    });

    // Fermeture de la modale Reçu fiscal
    document.getElementById('close-recu-btn').addEventListener('click', () => {
      document.getElementById('modal-recu-fiscal').classList.remove('active');
    });

    document.getElementById('btn-download-recu-ok').addEventListener('click', () => {
      document.getElementById('modal-recu-fiscal').classList.remove('active');
      this.showToast('💾 Reçu fiscal enregistré et archivé !');
      this.renderViewDonations();
    });

    document.getElementById('btn-print-recu').addEventListener('click', () => {
      alert("🖨️ Envoi du document vers votre imprimante...");
    });

    // Clôture Exercice
    document.getElementById('btn-save-closing-month').addEventListener('click', () => {
      const select = document.getElementById('closing-month-select');
      this.closingMonth = parseInt(select.value);
      localStorage.setItem(`saas_compta_closing_month_${this.activeEntityId}`, this.closingMonth);
      this.showToast(`📅 Rentrée de l'exercice configurée en ${select.options[select.selectedIndex].text}.`);
      this.renderSubViewCompta('journal');
    });

    // Exporter FEC
    document.getElementById('btn-export-fec').addEventListener('click', () => {
      const csvContent = this.genererFECString();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `FEC_EXERCICE_COMPTABLE_${new Date().getFullYear()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.showToast('💾 Export FEC généré pour votre expert-comptable !');
    });

    // Onboarding Tour
    document.getElementById('start-tour-btn').addEventListener('click', () => {
      TourGuide.start();
    });

    // Réinitialiser la base de données
    document.getElementById('btn-reset-db').addEventListener('click', () => {
      if (confirm('⚠️ Voulez-vous vraiment réinitialiser toutes les données de l\'application ? Cela effacera tout votre historique de tri, vos élèves, vos boutique et vos dons.')) {
        localStorage.clear();
        window.location.reload();
      }
    });
  },

  /**
   * Recharge la catégorisation sur tout le relevé
   */
  recatTout() {
    this.transactions = Categorizer.categoriserTransactions(this.transactions);
    this.saveTransactions();
    this.renderActiveView();
    this.updateBadges();
  },

  saveTransactions() {
    localStorage.setItem(`saas_compta_transactions_${this.activeEntityId}`, JSON.stringify(this.transactions));
  },

  /**
   * Charge le CSV de démo
   */
  chargerTransactionsDemo(overwrite = false) {
    if (!overwrite && localStorage.getItem(`saas_compta_transactions_${this.activeEntityId}`)) return;
    
    const DEMO_CSV_DATA = `Date;Libelle;Debit;Credit;Info
01/09/2025;COTIS DUPONT JEAN;;150.00;Cotisation annuelle guitare
02/09/2025;STRIPE PAIEMENT EN LIGNE - Cours SOPHIE;;350.00;Cours de musique
03/09/2025;EDF PROVENCE LUBERON;85.00;;Electricite local
04/09/2025;DON DE ALBERT RENE;;150.00;Don annuel particulier
05/09/2025;INTERNET ORANGE SERVICES;29.90;;Abonnement box
10/09/2025;UPMC INTERVENANT EXTERNE;120.00;;Cours de piano prof
12/09/2025;ACHAT SUPERU COLLATIONS;45.20;;Boissons assemblee generale
15/09/2025;COTIS LEMOINE PIERRE;;200.00;Cotisation
18/09/2025;STRIPE PAIEMENT - Boutique Livre;12.00;;
20/09/2025;DON MECENAT SOCIETE GENERALE;;500.00;Sponsor culturel
22/09/2025;URSSAF COTISATIONS SOCIALES;180.00;;Charges sociales
25/09/2025;REAPPRO GUITARE ACOUSTIQUE;240.00;;Achat stock guitares
28/09/2025;MUTUELLE SANTE APICIL;45.00;;Part patronale
30/09/2025;FRAIS BANQUE TENUE COMPTE;7.50;;Frais mensuels
02/10/2025;EDF PROVENCE LUBERON;85.00;;Electricite local
20/10/2025;REMUNERATION PROF GUITARE;650.00;;Salaire prof
22/10/2025;URSSAF COTISATIONS SOCIALES;180.00;;Charges sociales
26/10/2025;RESTAURANT LE MIDI DELEGUES;68.40;;Repas mission
31/10/2025;FRAIS BANQUE TENUE COMPTE;7.50;;Frais mensuels`;

    const csvContent = (SAMPLE_CSV && SAMPLE_CSV.trim().split('\n').length > 1) ? SAMPLE_CSV : DEMO_CSV_DATA;
    const demoTx = CSVParser.parse(csvContent);
    const importId = 'import_demo';
    demoTx.forEach(tx => tx.importId = importId);
    this.transactions = Categorizer.categoriserTransactions(demoTx);
    this.saveTransactions();

    // Enregistrement de l'historique d'import pour la démo
    const history = this.getImportsHistory();
    if (!history.some(h => h.id === importId)) {
      history.unshift({
        id: importId,
        fileName: 'releve_demo_25_lignes.csv',
        date: new Date().toISOString(),
        size: '2.8 KB',
        linesCount: demoTx.length,
        importedBy: 'Assistant Démo'
      });
      this.saveImportsHistory(history);
    }
  },

  /**
   * Traite le CSV, dédoublonne et enregistre l'import
   */
  traiterFichierCSV(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawText = e.target.result;
      const transactionsImp = CSVParser.parse(rawText);

      if (transactionsImp.length === 0) {
        this.showToast("⚠️ Fichier CSV vide ou format non supporté.");
        return;
      }

      // Dédoublonnage
      const existingHashes = new Set(this.transactions.map(tx => this.getTransactionHash(tx)));
      const newTransactions = [];
      const importId = 'import_' + Date.now();

      transactionsImp.forEach(tx => {
        const hash = this.getTransactionHash(tx);
        if (!existingHashes.has(hash)) {
          tx.importId = importId;
          newTransactions.push(tx);
        }
      });

      if (newTransactions.length === 0) {
        this.showToast("⚠️ Toutes les transactions de ce fichier ont déjà été importées (doublons détectés).");
        return;
      }

      // Indexation chronologique
      this.transactions = newTransactions.concat(this.transactions);
      this.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
      this.saveTransactions();

      // Enregistrement de l'historique d'import
      const importsHistory = this.getImportsHistory();
      importsHistory.unshift({
        id: importId,
        fileName: file.name,
        date: new Date().toISOString(),
        size: (file.size / 1024).toFixed(1) + ' KB',
        linesCount: newTransactions.length,
        importedBy: 'Fabien Marceau'
      });
      this.saveImportsHistory(importsHistory);

      // Affiche l'aperçu du fichier importé
      document.getElementById('csv-raw-preview').textContent = rawText.slice(0, 1000) + '\n... [Tronqué pour l\'affichage]';
      document.getElementById('csv-preview-card').style.display = 'block';

      // Remplit le tableau d'aperçu
      const tbody = document.querySelector('#imported-tx-table tbody');
      tbody.innerHTML = '';
      newTransactions.slice(0, 8).forEach(tx => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${new Date(tx.date).toLocaleDateString('fr-FR')}</td>
          <td>${tx.libelle}</td>
          <td class="amount debit">${tx.debit > 0 ? tx.debit.toFixed(2) + ' €' : '-'}</td>
          <td class="amount credit">${tx.credit > 0 ? tx.credit.toFixed(2) + ' €' : '-'}</td>
          <td>${tx.info || '-'}</td>
        `;
        tbody.appendChild(row);
      });

      // Recalcule tout
      this.recatTout();
      this.showToast(`✅ ${newTransactions.length} nouvelles écritures chargées avec succès !`);

      // Redirection automatique vers "Trier les lignes"
      setTimeout(() => {
        document.querySelector('[data-view="categorize"]').click();
      }, 1500);
    };
    reader.readAsText(file);
  },

  getTransactionHash(tx) {
    const date = tx.date || '';
    const libelle = tx.libelle || '';
    const amount = (tx.debit > 0 ? -tx.debit : tx.credit).toFixed(2);
    return `${date}_${libelle}_${amount}`;
  },

  getImportsHistory() {
    const saved = localStorage.getItem(`saas_compta_imports_${this.activeEntityId}`);
    return saved ? JSON.parse(saved) : [];
  },

  saveImportsHistory(history) {
    localStorage.setItem(`saas_compta_imports_${this.activeEntityId}`, JSON.stringify(history));
  },

  supprimerImport(importId) {
    const history = this.getImportsHistory();
    const importItem = history.find(h => h.id === importId);
    if (!importItem) return;

    if (confirm(`⚠️ Voulez-vous vraiment annuler l'import "${importItem.fileName}" ? Cela supprimera définitivement les ${importItem.linesCount} transactions associées.`)) {
      this.transactions = this.transactions.filter(t => t.importId !== importId);
      this.saveTransactions();

      const newHistory = history.filter(h => h.id !== importId);
      this.saveImportsHistory(newHistory);

      this.recatTout();
      this.renderImportsHistoryTable();
      this.showToast(`🗑️ Import "${importItem.fileName}" annulé avec succès.`);
    }
  },

  renderImportsHistoryTable() {
    const tbody = document.querySelector('#imports-history-table tbody');
    if (!tbody) return;

    const history = this.getImportsHistory();
    tbody.innerHTML = '';

    if (history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">Aucun historique d\'import.</td></tr>';
      return;
    }

    history.forEach(h => {
      const row = document.createElement('tr');
      const importDate = new Date(h.date).toLocaleString('fr-FR');
      row.innerHTML = `
        <td style="color: white; font-weight: 600;">${h.fileName}</td>
        <td>${importDate}</td>
        <td>${h.size}</td>
        <td><strong>${h.linesCount}</strong></td>
        <td>${h.importedBy}</td>
        <td>
          <button class="btn btn-secondary btn-sm delete-import-btn" data-id="${h.id}" style="color: #ef4444; background: rgba(239, 68, 68, 0.05); border-color: rgba(239, 68, 68, 0.15);">
            <i class="fa-solid fa-trash-can"></i> Annuler
          </button>
        </td>
      `;
      row.querySelector('.delete-import-btn').addEventListener('click', () => {
        this.supprimerImport(h.id);
      });
      tbody.appendChild(row);
    });
  },

  /**
   * Affiche un toast de notification temporaire
   */
  showToast(message) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.backgroundColor = 'rgba(26, 34, 63, 0.95)';
    toast.style.border = '1px solid var(--color-primary-light)';
    toast.style.color = '#fff';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = 'var(--shadow-md)';
    toast.style.zIndex = '10000';
    toast.style.fontSize = '0.9rem';
    toast.style.fontFamily = 'var(--font-body)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '8px';
    toast.innerHTML = `<i class="fa-solid fa-circle-info" style="color: var(--color-primary-light)"></i> ${message}`;
    
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s';
      setTimeout(() => toast.remove(), 500);
    }, 4000);
  },

  // â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�
  // SYSTEME DE ROUTAGE ET RENDU
  // â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�

  /**
   * Met à jour les pastilles et compteurs de l'application
   */
  updateBadges() {
    const nonAttribues = this.transactions.filter(t => t.compteAttribué === '699' || t.statut === 'non_attribue' || t.statut === 'suggere').length;
    const badge = document.getElementById('pending-tx-badge');
    
    if (nonAttribues > 0) {
      badge.textContent = nonAttribues;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  },

  /**
   * Affiche la vue active correspondante au lien sélectionné
   */
  renderActiveView() {
    const activeItem = document.querySelector('.sidebar-menu .menu-item.active');
    if (!activeItem) return;

    const viewId = activeItem.getAttribute('data-view');
    
    // Masque toutes les vues
    document.querySelectorAll('.app-view').forEach(view => view.classList.remove('active'));
    
    // Affiche la vue active
    const activeView = document.getElementById(`view-${viewId}`);
    if (activeView) activeView.classList.add('active');

    // Rendu spécifique à la vue
    switch (viewId) {
      case 'dashboard':
        this.renderViewDashboard();
        break;
      case 'import':
        this.renderImportsHistoryTable();
        document.getElementById('csv-preview-card').style.display = 'none';
        break;
      case 'categorize':
        this.renderViewCategorize();
        break;
      case 'members':
        this.renderViewMembers();
        break;
      case 'sales':
        this.renderViewSales();
        break;
      case 'donations':
        this.renderViewDonations();
        break;
      case 'books':
        // Clic auto sur le premier sous-onglet compta
        document.getElementById('sub-btn-journal').click();
        break;
      case 'glossary':
        this.renderViewGlossary();
        break;
    }
  },

  // â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�
  // RENDU VUE PAR VUE
  // â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�

  /**
   * Rendu de la vue TABLEAU DE BORD (DASHBOARD)
   */
  renderViewDashboard() {
    // 1. Calcul de la trésorerie disponible
    // Cumul des entrées - sorties
    let totalBanque = 0;
    let totalCaisse = 0;
    
    this.transactions.forEach(tx => {
      if (tx.compteAttribué !== '699' && tx.statut === 'attribue') {
        if (tx.compteAttribué === '530') {
          // Espèces
          totalCaisse += tx.credit - tx.debit;
        } else {
          // Banque
          totalBanque += tx.credit - tx.debit;
        }
      }
    });

    const totalTrésorerie = totalBanque + totalCaisse;
    document.getElementById('kpi-cash').textContent = totalTrésorerie.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

    // 2. Calcul des KPI stats
    const totalTx = this.transactions.length;
    const triees = this.transactions.filter(t => t.compteAttribué !== '699' && t.statut === 'attribue').length;
    
    document.getElementById('kpi-pending-count').textContent = totalTx - triees;

    // Reste à encaisser (from member invoices)
    const report = SaaSModules.getMembersReport();
    const resteAEncaisser = report.reduce((sum, m) => sum + Math.max(0, m.resteAPayer), 0);
    document.getElementById('kpi-receivables').textContent = resteAEncaisser.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

    // Factures à payer (from simulated bills)
    const dettesFournisseurs = SaaSModules.getUnpaidBillsTotal();
    document.getElementById('kpi-payables').textContent = dettesFournisseurs.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

    // 3. Calcul recettes vs dépenses (Comptabilité de résultat)
    let recettes = 0;
    let depenses = 0;

    this.transactions.forEach(tx => {
      if (tx.compteAttribué !== '699' && tx.statut === 'attribue') {
        const cpt = Categorizer.planComptable.find(p => p.compte === tx.compteAttribué);
        if (cpt) {
          if (cpt.type === 'Produit') recettes += tx.credit;
          if (cpt.type === 'Charge') depenses += tx.debit;
        }
      }
    });

    const resultatNet = recettes - depenses;

    // Remplissage des graphiques
    document.getElementById('bar-recettes-val').textContent = recettes.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
    document.getElementById('bar-depenses-val').textContent = depenses.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
    
    const maxVal = Math.max(recettes, depenses, 1);
    document.getElementById('bar-recettes').style.height = `${(recettes / maxVal) * 100}%`;
    document.getElementById('bar-depenses').style.height = `${(depenses / maxVal) * 100}%`;

    const resNetEl = document.getElementById('dashboard-result-net');
    resNetEl.textContent = `${resultatNet >= 0 ? '+' : ''} ${resultatNet.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`;
    resNetEl.style.color = resultatNet >= 0 ? 'var(--color-success)' : 'var(--color-danger)';

    // 4. Liste des actions urgentes suggérées
    const actionList = document.getElementById('dashboard-actions-list');
    actionList.innerHTML = '';

    // Action A : Mouvements non classés
    const nonClassées = totalTx - triees;
    if (nonClassées > 0) {
      actionList.appendChild(this.creerComposantAction(
        'fa-tags',
        'var(--color-warning)',
        `Il vous reste ${nonClassées} opérations bancaires à catégoriser`,
        'Ces écritures sont en attente d\'attribution. Un relevé entièrement trié garantit une comptabilité valide.',
        'Trier le relevé',
        () => document.getElementById('menu-categorize').click()
      ));
    }

    // Action B : Élèves en retard
    const elevesReport = SaaSModules.getMembersReport();
    const retards = elevesReport.filter(m => m.resteAPayer > 0);
    if (retards.length > 0) {
      actionList.appendChild(this.creerComposantAction(
        'fa-users-slash',
        'var(--color-danger)',
        `${retards.length} adhérents ont un solde débiteur (reste à payer)`,
        'Leur forfait annuel n\'a pas encore été entièrement réglé ou réconcilié.',
        'Voir les fiches',
        () => document.getElementById('menu-members').click()
      ));
    }

    // Action C : Stocks faibles
    const stocksFaibles = SaaSModules.products.filter(p => p.stock < 5);
    if (stocksFaibles.length > 0) {
      actionList.appendChild(this.creerComposantAction(
        'fa-box-open',
        'var(--color-warning)',
        `${stocksFaibles.length} articles de votre boutique sont en rupture ou stock critique`,
        `Produits concernés : ${stocksFaibles.map(p => `${p.nom} (${p.stock} restant)`).join(', ')}.`,
        'Gérer le stock',
        () => document.getElementById('menu-sales').click()
      ));
    }

    // Fallback si tout est parfait
    if (actionList.children.length === 0) {
      actionList.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--color-success); font-weight: 600;">
          <i class="fa-solid fa-circle-check" style="font-size: 1.5rem; margin-bottom: 5px;"></i><br>
          Félicitations, tout est parfaitement à jour ! Aucun problème détecté.
        </div>
      `;
    }
  },

  creerComposantAction(icon, color, title, desc, btnText, btnCallback) {
    const el = document.createElement('div');
    el.style.display = 'flex';
    el.style.justifyContent = 'space-between';
    el.style.alignItems = 'center';
    el.style.backgroundColor = 'rgba(255,255,255,0.02)';
    el.style.border = '1px solid var(--border-color)';
    el.style.padding = '15px 20px';
    el.style.borderRadius = '8px';
    
    el.innerHTML = `
      <div style="display: flex; gap: 15px; align-items: center;">
        <i class="fa-solid ${icon}" style="font-size: 1.4rem; color: ${color}; width: 25px;"></i>
        <div>
          <h4 style="font-size: 0.95rem; font-weight: 600; color: white;">${title}</h4>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">${desc}</p>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" style="flex-shrink: 0;">${btnText}</button>
    `;
    
    el.querySelector('button').addEventListener('click', btnCallback);
    return el;
  },

  /**
   * Rendu de la vue CENTRE DE TRI (CATEGORIZE)
   */
  renderViewCategorize() {
    const listContainer = document.getElementById('tri-list-container');
    listContainer.innerHTML = '';

    const nonTriees = this.transactions.filter(t => t.compteAttribué === '699' || t.statut === 'non_attribue' || t.statut === 'suggere');
    
    // Calcul taux de progression
    const totalTx = this.transactions.length;
    const triees = totalTx - nonTriees.length;
    const progressPct = totalTx > 0 ? Math.round((triees / totalTx) * 100) : 0;
    
    document.getElementById('tri-progress-bar').style.width = `${progressPct}%`;
    document.getElementById('tri-progress-text').textContent = `${triees} / ${totalTx} transactions triées (${progressPct}%)`;

    // Si suggestions en attente, afficher le bouton d'auto-classification globale
    const suggestionsCount = nonTriees.filter(t => t.statut === 'suggere').length;
    const btnAutoclass = document.getElementById('btn-autoclass-all');
    if (suggestionsCount > 0) {
      btnAutoclass.textContent = `ðŸ¤– Classer automatiquement ${suggestionsCount} écritures reconnues`;
      btnAutoclass.style.display = 'block';
    } else {
      btnAutoclass.style.display = 'none';
    }

    if (nonTriees.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--color-success);">
          <i class="fa-solid fa-circle-check" style="font-size: 3rem; margin-bottom: 15px;"></i>
          <h4 style="font-family: var(--font-title); font-size: 1.1em; color: white; margin-bottom: 5px;">Toutes les écritures sont classées !</h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary);">Votre comptabilité est parfaitement équilibrée.</p>
        </div>
      `;
      document.getElementById('tx-details-area').style.display = 'none';
      document.getElementById('no-tx-selected').style.display = 'block';
      return;
    }

    nonTriees.forEach(tx => {
      const item = document.createElement('div');
      item.className = `tx-tri-item ${this.activeTxId === tx.id ? 'active' : ''}`;
      
      const typeText = tx.debit > 0 ? 'Dépense' : 'Recette';
      const montant = tx.debit > 0 ? tx.debit : tx.credit;
      const amountColor = tx.debit > 0 ? '#f87171' : '#34d399';
      const indicator = tx.statut === 'suggere' ? `<span class="badge badge-success" style="font-size: 0.6rem; padding: 2px 6px;">Suggestion</span>` : '';

      item.innerHTML = `
        <div class="tx-tri-info">
          <div class="tx-tri-title">${tx.libelle} ${indicator}</div>
          <div class="tx-tri-meta">${new Date(tx.date).toLocaleDateString('fr-FR')} &bull; ${typeText}</div>
        </div>
        <div class="tx-tri-amount" style="color: ${amountColor};">${tx.debit > 0 ? '-' : '+'} ${montant.toFixed(2)} â‚¬</div>
      `;

      item.addEventListener('click', () => {
        this.activeTxId = tx.id;
        this.renderActiveTxDetails(tx);
        // Met en surbrillance l'élément actif
        document.querySelectorAll('.tx-tri-item').forEach(e => e.classList.remove('active'));
        item.classList.add('active');
      });

      listContainer.appendChild(item);
    });

    // Sélectionne par défaut la première écriture si aucune n'est active ou si l'active a été triée
    if (nonTriees.length > 0) {
      const toujoursActive = nonTriees.find(t => t.id === this.activeTxId);
      if (!toujoursActive) {
        this.activeTxId = nonTriees[0].id;
      }
      const activeTx = this.transactions.find(t => t.id === this.activeTxId);
      this.renderActiveTxDetails(activeTx);
    }
  },

  /**
   * Rendu des détails de l'écriture bancaire active à trier
   */
  renderActiveTxDetails(tx) {
    if (!tx) return;

    document.getElementById('no-tx-selected').style.display = 'none';
    document.getElementById('tx-details-area').style.display = 'block';

    const montant = tx.debit > 0 ? tx.debit : tx.credit;
    const amountColor = tx.debit > 0 ? '#f87171' : '#34d399';

    document.getElementById('active-tx-date').textContent = new Date(tx.date).toLocaleDateString('fr-FR');
    document.getElementById('active-tx-libelle').textContent = tx.libelle;
    document.getElementById('active-tx-info').textContent = tx.info || 'Aucune information additionnelle disponible.';
    
    const amtEl = document.getElementById('active-tx-amount');
    amtEl.textContent = `${tx.debit > 0 ? '-' : '+'} ${montant.toFixed(2)} â‚¬`;
    amtEl.style.color = amountColor;

    // Remplissage du menu déroulant manuel des catégories
    const select = document.getElementById('select-manual-compte');
    select.innerHTML = '';
    
    // On trie le plan comptable pour proposer les comptes pertinents en premier
    const categoriesTriees = [...Categorizer.planComptable].filter(c => c.compte !== '699');
    
    categoriesTriees.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.compte;
      // Traduction pédagogique
      const nature = c.type === 'Charge' ? '(Dépense)' : (c.type === 'Produit' ? '(Recette)' : '(Banque/Tiers)');
      opt.textContent = `${c.compte} - ${c.libelle} ${nature}`;
      
      // Pré-sélection logique : Dépense -> charges en premier, Recette -> produits en premier
      if (tx.debit > 0 && c.type === 'Charge' && !select.value) opt.selected = true;
      if (tx.credit > 0 && c.type === 'Produit' && !select.value) opt.selected = true;

      select.appendChild(opt);
    });

    // Traitement de la suggestion automatique
    const suggestionBox = document.getElementById('active-tx-suggestion');
    if (tx.statut === 'suggere') {
      suggestionBox.style.display = 'flex';
      const nomCompte = Categorizer.obtenirLibelleCompte(tx.compteAttribué);
      document.getElementById('active-tx-suggest-label').textContent = `${tx.compteAttribué} (${nomCompte})`;
    } else {
      suggestionBox.style.display = 'none';
    }

    // Remplissage du mot-clé par défaut pour l'apprentissage
    const cleanWord = Categorizer.normaliserTexte(tx.libelle);
    // Extrait les 3 premiers mots pour faire un mot-clé propre
    const fragments = cleanWord.split(' ').slice(0, 3).join(' ');
    document.getElementById('input-learn-keyword').value = tx.suggestionMotCle || fragments;
  },

  // â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�
  // MODULES DE GESTION RENDUS
  // â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�

  /**
   * Rendu du registre ADHÃ‰RENTS / Ã‰LÃˆVES
   */
  renderViewMembers() {
    const report = SaaSModules.getMembersReport();
    const tbody = document.querySelector('#members-table tbody');
    tbody.innerHTML = '';

    if (report.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Aucun élève enregistré pour le moment.</td></tr>';
      return;
    }

    report.forEach(m => {
      let badgeClass = 'badge-muted';
      if (m.statut === 'Payé') badgeClass = 'badge-success';
      if (m.statut === 'Partiel') badgeClass = 'badge-warning';
      if (m.statut === 'Impayé') badgeClass = 'badge-danger';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="color: white; font-weight: 600;">${m.nom}</td>
        <td class="amount">${m.forfait.toFixed(2)} â‚¬</td>
        <td class="amount credit">${m.dejaPaye.toFixed(2)} â‚¬</td>
        <td class="amount ${m.resteAPayer > 0 ? 'debit' : 'credit'}">${m.resteAPayer.toFixed(2)} â‚¬</td>
        <td><span class="badge ${badgeClass}">${m.statut}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm relancer-btn" data-id="${m.id}" ${m.resteAPayer <= 0 ? 'disabled' : ''}>
            <i class="fa-solid fa-paper-plane"></i> Relancer
          </button>
        </td>
      `;

      row.querySelector('.relancer-btn').addEventListener('click', () => {
        SaaSModules.relancerMembre(m.id);
        alert(`âœ‰ï¸� Un email de relance pédagogique a été simulé et envoyé à ${m.email} (${m.resteAPayer} â‚¬ dÃ»s).`);
      });

      tbody.appendChild(row);
    });
  },

  /**
   * Rendu de la vue BOUTIQUE / STOCKS
   */
  renderViewSales() {
    const tbody = document.querySelector('#products-table tbody');
    tbody.innerHTML = '';

    SaaSModules.products.forEach(p => {
      const marge = p.prixVente - p.prixAchat;
      const stockBadge = p.stock < 5 ? `<span class="badge badge-danger" style="margin-left: 8px;">Critique</span>` : '';
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="color: white; font-weight: 600;">${p.nom}</td>
        <td class="amount">${p.prixAchat.toFixed(2)} â‚¬</td>
        <td class="amount">${p.prixVente.toFixed(2)} â‚¬</td>
        <td style="font-weight: 700;">${p.stock} unités ${stockBadge}</td>
        <td class="amount credit">${marge.toFixed(2)} â‚¬</td>
        <td>
          <button class="btn btn-success btn-sm sell-btn" data-id="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>Vendre 1</button>
          <button class="btn btn-secondary btn-sm restock-btn" data-id="${p.id}" style="margin-left: 5px;">+5</button>
        </td>
      `;

      // Simuler une vente
      row.querySelector('.sell-btn').addEventListener('click', () => {
        const res = SaaSModules.enregistrerVente(p.id, 1);
        if (res) {
          // Log la transaction bancaire de recette correspondante
          const nouvelleTx = {
            id: 'tx-boutique-' + Date.now(),
            date: new Date().toISOString().split('T')[0],
            libelle: `STRIPE PAIEMENT BOUTIQUE - Vente ${p.nom}`,
            info: 'Vente boutique automatique',
            debit: 0,
            credit: p.prixVente,
            compteAttribué: null,
            regleAppliquee: null,
            statut: 'non_attribue'
          };
          this.transactions.unshift(nouvelleTx);
          this.saveTransactions();
          this.recatTout();
          
          this.showToast(`ðŸ›�ï¸� Vente enregistrée ! ${p.nom} débité du stock.`);
          this.renderViewSales();
        }
      });

      // Simuler un réapprovisionnement
      row.querySelector('.restock-btn').addEventListener('click', () => {
        SaaSModules.reapprovisionner(p.id, 5);
        
        // Log la dépense bancaire associée à l'achat du stock
        const nouvelleTx = {
          id: 'tx-achat-stock-' + Date.now(),
          date: new Date().toISOString().split('T')[0],
          libelle: `ACHAT FOURNISSEUR STOCK - Réapprovisionnement 5x ${p.nom}`,
          info: 'Achat de marchandises',
          debit: p.prixAchat * 5,
          credit: 0,
          compteAttribué: null,
          regleAppliquee: null,
          statut: 'non_attribue'
        };
        this.transactions.unshift(nouvelleTx);
        this.saveTransactions();
        this.recatTout();

        this.showToast(`ðŸ“¦ Stock augmenté de 5 unités pour : ${p.nom}.`);
        this.renderViewSales();
      });

      tbody.appendChild(row);
    });
  },

  /**
   * Rendu de la vue DONS / MECENAT
   */
  renderViewDonations() {
    const tbody = document.querySelector('#donors-table tbody');
    tbody.innerHTML = '';

    if (SaaSModules.donors.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Aucun don enregistré pour l\'instant.</td></tr>';
      return;
    }

    SaaSModules.donors.forEach(d => {
      const recuBadge = d.recuGenere ? '<span class="badge badge-success">Généré</span>' : '<span class="badge badge-muted">Non généré</span>';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="color: white; font-weight: 600;">${d.nom}</td>
        <td style="font-size: 0.85rem;">${d.adresse}</td>
        <td class="amount credit">${d.montantTotal.toFixed(2)} â‚¬</td>
        <td>${recuBadge}</td>
        <td>
          <button class="btn btn-primary btn-sm view-recu-btn" data-id="${d.id}">
            <i class="fa-solid fa-receipt"></i> Générer reçu Cerfa
          </button>
        </td>
      `;

      row.querySelector('.view-recu-btn').addEventListener('click', () => {
        const cerfaHTML = SaaSModules.genererRecuFiscalHTML(d.id);
        document.getElementById('recu-fiscal-body').innerHTML = cerfaHTML;
        document.getElementById('modal-recu-fiscal').classList.add('active');
      });

      tbody.appendChild(row);
    });
  },

  // â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�
  // REGISTRES ET COMPTABILITE TECHNIQUE
  // â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�

  /**
   * Rendu de la sous-vue comptable active
   */
  renderSubViewCompta(subId) {
    // 1. Filtrer les écritures par rapport à la saison (début de l'exercice)
    const transactionsFiltrees = this.filtrerTransactionsParExercice();

    switch (subId) {
      case 'journal':
        this.renderJournal(transactionsFiltrees);
        break;
      case 'grandlivre':
        this.renderGrandLivre(transactionsFiltrees);
        break;
      case 'balance':
        this.renderBalance(transactionsFiltrees);
        break;
      case 'bilan':
        this.renderBilan(transactionsFiltrees);
        break;
    }
  },

  /**
   * Filtre les transactions pour l'exercice actif (12 mois glissants à partir du mois de rentrée)
   */
  filtrerTransactionsParExercice() {
    // Pour simplifier dans la démo, on retourne toutes les transactions
    // mais on les ordonne chronologiquement.
    return [...this.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  },

  /**
   * Construit le Livre-Journal
   */
  renderJournal(txList) {
    const tbody = document.querySelector('#journal-table tbody');
    tbody.innerHTML = '';

    let pieceNum = 1;
    txList.forEach(tx => {
      if (tx.compteAttribué === '699') return; // On ignore les écritures non triées dans les documents légaux

      const dateStr = new Date(tx.date).toLocaleDateString('fr-FR');
      const piece = `PIECE-${String(pieceNum++).padStart(3, '0')}`;

      if (tx.debit > 0) {
        // Ligne 1 : Débit du compte de charges
        const row1 = document.createElement('tr');
        row1.innerHTML = `
          <td>${dateStr}</td>
          <td>${piece}</td>
          <td><strong>${tx.compteAttribué}</strong> - ${Categorizer.obtenirLibelleCompte(tx.compteAttribué)}</td>
          <td>${tx.libelle}</td>
          <td class="amount debit">${tx.debit.toFixed(2)} â‚¬</td>
          <td class="amount">-</td>
        `;
        tbody.appendChild(row1);

        // Ligne 2 : Crédit du compte banque 512
        const row2 = document.createElement('tr');
        row2.innerHTML = `
          <td style="color: var(--text-muted);">${dateStr}</td>
          <td style="color: var(--text-muted);">${piece}</td>
          <td style="padding-left: 40px;"><strong>512</strong> - Banque</td>
          <td style="color: var(--text-muted);">${tx.libelle}</td>
          <td class="amount">-</td>
          <td class="amount credit">${tx.debit.toFixed(2)} â‚¬</td>
        `;
        tbody.appendChild(row2);
      }

      if (tx.credit > 0) {
        // Ligne 1 : Débit du compte banque 512
        const row1 = document.createElement('tr');
        row1.innerHTML = `
          <td>${dateStr}</td>
          <td>${piece}</td>
          <td><strong>512</strong> - Banque</td>
          <td>${tx.libelle}</td>
          <td class="amount debit">${tx.credit.toFixed(2)} â‚¬</td>
          <td class="amount">-</td>
        `;
        tbody.appendChild(row1);

        // Ligne 2 : Crédit du compte de produits
        const row2 = document.createElement('tr');
        row2.innerHTML = `
          <td style="color: var(--text-muted);">${dateStr}</td>
          <td style="color: var(--text-muted);">${piece}</td>
          <td style="padding-left: 40px;"><strong>${tx.compteAttribué}</strong> - ${Categorizer.obtenirLibelleCompte(tx.compteAttribué)}</td>
          <td style="color: var(--text-muted);">${tx.libelle}</td>
          <td class="amount">-</td>
          <td class="amount credit">${tx.credit.toFixed(2)} â‚¬</td>
        `;
        tbody.appendChild(row2);
      }
    });

    if (tbody.children.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Aucune écriture classée disponible dans le Journal.</td></tr>';
    }
  },

  /**
   * Construit le Grand Livre
   */
  renderGrandLivre(txList) {
    const container = document.getElementById('grandlivre-container');
    container.innerHTML = '';

    // Regroupement par compte
    const comptesGroupes = {};
    
    // Initialise avec 512 banque
    comptesGroupes['512'] = [];

    txList.forEach(tx => {
      if (tx.compteAttribué === '699') return;
      
      const cpt = tx.compteAttribué;
      if (!comptesGroupes[cpt]) comptesGroupes[cpt] = [];

      if (tx.debit > 0) {
        comptesGroupes[cpt].push({ date: tx.date, libelle: tx.libelle, debit: tx.debit, credit: 0 });
        comptesGroupes['512'].push({ date: tx.date, libelle: tx.libelle, debit: 0, credit: tx.debit });
      }
      if (tx.credit > 0) {
        comptesGroupes['512'].push({ date: tx.date, libelle: tx.libelle, debit: tx.credit, credit: 0 });
        comptesGroupes[cpt].push({ date: tx.date, libelle: tx.libelle, debit: 0, credit: tx.credit });
      }
    });

    Object.keys(comptesGroupes).sort().forEach(cptNum => {
      const operations = comptesGroupes[cptNum];
      if (operations.length === 0) return;

      const card = document.createElement('div');
      card.className = 'glass-card';
      card.style.marginBottom = '25px';
      
      const nomCompte = cptNum === '512' ? 'Compte Bancaire (Banque)' : Categorizer.obtenirLibelleCompte(cptNum);

      card.innerHTML = `
        <h4 style="font-family: var(--font-title); color: white; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
          Compte ${cptNum} â€” ${nomCompte}
        </h4>
        <table class="custom-table" style="font-size: 0.85rem;">
          <thead>
            <tr>
              <th>Date</th>
              <th>Détail Opération</th>
              <th>Débit (Dépenses)</th>
              <th>Crédit (Recettes)</th>
              <th>Solde progressif</th>
            </tr>
          </thead>
          <tbody>
            <!-- Rempli juste après -->
          </tbody>
        </table>
      `;

      const tbody = card.querySelector('tbody');
      let solde = 0;

      operations.forEach(op => {
        // Pour les comptes d'actif (512) : débit augmente le solde, crédit le diminue.
        // Pour les comptes de charges (6xx) : débit augmente, crédit diminue.
        // Pour les comptes de produits (7xx) / passifs : crédit augmente, débit diminue.
        const estActifOuCharge = cptNum.startsWith('5') || cptNum.startsWith('6') || cptNum.startsWith('411') || cptNum.startsWith('467');
        if (estActifOuCharge) {
          solde += op.debit - op.credit;
        } else {
          solde += op.credit - op.debit;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${new Date(op.date).toLocaleDateString('fr-FR')}</td>
          <td>${op.libelle}</td>
          <td class="amount debit">${op.debit > 0 ? op.debit.toFixed(2) + ' â‚¬' : '-'}</td>
          <td class="amount credit">${op.credit > 0 ? op.credit.toFixed(2) + ' â‚¬' : '-'}</td>
          <td style="font-weight: 700; color: white;">${solde.toFixed(2)} â‚¬</td>
        `;
        tbody.appendChild(tr);
      });

      container.appendChild(card);
    });
  },

  /**
   * Construit la Balance Générale
   */
  renderBalance(txList) {
    const tbody = document.querySelector('#balance-table tbody');
    tbody.innerHTML = '';

    const balanceData = {};

    // Initialise 512
    balanceData['512'] = { debit: 0, credit: 0 };

    txList.forEach(tx => {
      if (tx.compteAttribué === '699') return;
      
      const cpt = tx.compteAttribué;
      if (!balanceData[cpt]) balanceData[cpt] = { debit: 0, credit: 0 };

      if (tx.debit > 0) {
        balanceData[cpt].debit += tx.debit;
        balanceData['512'].credit += tx.debit;
      }
      if (tx.credit > 0) {
        balanceData['512'].debit += tx.credit;
        balanceData[cpt].credit += tx.credit;
      }
    });

    Object.keys(balanceData).sort().forEach(cptNum => {
      const data = balanceData[cptNum];
      const nom = cptNum === '512' ? 'Compte courant Banque' : Categorizer.obtenirLibelleCompte(cptNum);
      
      let soldeDebiteur = 0;
      let soldeCrediteur = 0;

      const estActifOuCharge = cptNum.startsWith('5') || cptNum.startsWith('6') || cptNum.startsWith('411') || cptNum.startsWith('467');
      if (estActifOuCharge) {
        const diff = data.debit - data.credit;
        if (diff >= 0) soldeDebiteur = diff;
        else soldeCrediteur = Math.abs(diff);
      } else {
        const diff = data.credit - data.debit;
        if (diff >= 0) soldeCrediteur = diff;
        else soldeDebiteur = Math.abs(diff);
      }

      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${cptNum}</strong></td>
        <td style="color: white;">${nom}</td>
        <td class="amount">${data.debit.toFixed(2)} â‚¬</td>
        <td class="amount">${data.credit.toFixed(2)} â‚¬</td>
        <td class="amount debit">${soldeDebiteur > 0 ? soldeDebiteur.toFixed(2) + ' â‚¬' : '-'}</td>
        <td class="amount credit">${soldeCrediteur > 0 ? soldeCrediteur.toFixed(2) + ' â‚¬' : '-'}</td>
      `;
      tbody.appendChild(row);
    });
  },

  /**
   * Construit le Bilan Simplifié
   */
  renderBilan(txList) {
    const actifTbody = document.querySelector('#bilan-actif-table tbody');
    const passifTbody = document.querySelector('#bilan-passif-table tbody');

    actifTbody.innerHTML = '';
    passifTbody.innerHTML = '';

    // Calcul des soldes
    const balanceData = {};
    balanceData['512'] = { debit: 0, credit: 0 };

    txList.forEach(tx => {
      if (tx.compteAttribué === '699') return;
      const cpt = tx.compteAttribué;
      if (!balanceData[cpt]) balanceData[cpt] = { debit: 0, credit: 0 };

      if (tx.debit > 0) {
        balanceData[cpt].debit += tx.debit;
        balanceData['512'].credit += tx.debit;
      }
      if (tx.credit > 0) {
        balanceData['512'].debit += tx.credit;
        balanceData[cpt].credit += tx.credit;
      }
    });

    let totalActif = 0;
    let totalPassif = 0;

    // Rendu des Actifs (Comptes commenÃ§ant par 5 ou 411, 467)
    Object.keys(balanceData).forEach(cpt => {
      if (cpt.startsWith('5') || cpt === '411' || cpt === '467') {
        const val = balanceData[cpt].debit - balanceData[cpt].credit;
        if (val === 0) return;

        totalActif += val;
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${cpt}</strong> - ${cpt === '512' ? 'Compte en Banque' : Categorizer.obtenirLibelleCompte(cpt)}</td>
          <td class="amount" style="text-align: right; color: white;">${val.toFixed(2)} â‚¬</td>
        `;
        actifTbody.appendChild(row);
      }
    });

    // Rendu des Passifs (Comptes 102 fonds propres, 401 fournisseurs...)
    Object.keys(balanceData).forEach(cpt => {
      if (cpt === '102' || cpt === '401' || cpt === '421' || cpt === '437' || cpt === '445') {
        const val = balanceData[cpt].credit - balanceData[cpt].debit;
        if (val === 0) return;

        totalPassif += val;
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${cpt}</strong> - ${Categorizer.obtenirLibelleCompte(cpt)}</td>
          <td class="amount" style="text-align: right; color: white;">${val.toFixed(2)} â‚¬</td>
        `;
        passifTbody.appendChild(row);
      }
    });

    // Calcul du Résultat de l'exercice (Recettes - Dépenses) pour l'intégrer au Passif (Fonds propres)
    let recettes = 0;
    let depenses = 0;
    Object.keys(balanceData).forEach(cpt => {
      const p = Categorizer.planComptable.find(pc => pc.compte === cpt);
      if (p) {
        if (p.type === 'Produit') recettes += balanceData[cpt].credit;
        if (p.type === 'Charge') depenses += balanceData[cpt].debit;
      }
    });
    const excédent = recettes - depenses;
    totalPassif += excédent;

    const rowRes = document.createElement('tr');
    rowRes.innerHTML = `
      <td><strong>120/129</strong> - Résultat net (Bénéfice/Excédent)</td>
      <td class="amount" style="text-align: right; color: var(--color-success); font-weight: 700;">${excédent.toFixed(2)} â‚¬</td>
    `;
    passifTbody.appendChild(rowRes);

    // Lignes de totaux
    const rowActifTotal = document.createElement('tr');
    rowActifTotal.style.backgroundColor = 'rgba(255,255,255,0.05)';
    rowActifTotal.innerHTML = `
      <td style="color: white; font-weight: 800;">TOTAL DE L'ACTIF (Ce que vous possédez)</td>
      <td class="amount" style="text-align: right; color: var(--color-primary-light); font-weight: 800; font-size: 1.1rem;">${totalActif.toFixed(2)} â‚¬</td>
    `;
    actifTbody.appendChild(rowActifTotal);

    const rowPassifTotal = document.createElement('tr');
    rowPassifTotal.style.backgroundColor = 'rgba(255,255,255,0.05)';
    rowPassifTotal.innerHTML = `
      <td style="color: white; font-weight: 800;">TOTAL DU PASSIF (Fonds propres & dettes)</td>
      <td class="amount" style="text-align: right; color: var(--color-success); font-weight: 800; font-size: 1.1rem;">${totalPassif.toFixed(2)} â‚¬</td>
    `;
    passifTbody.appendChild(rowPassifTotal);
  },

  /**
   * Génère le fichier comptable FEC
   */
  genererFECString() {
    let fec = 'JournalCode;JournalLib;EcritureNum;EcritureDate;CompteNum;CompteLib;PieceRef;PieceDate;EcritureLib;Debit;Credit\n';
    let idx = 1;
    this.transactions.forEach(tx => {
      if (tx.compteAttribué === '699') return;
      const date = tx.date.replace(/-/g, '');
      const piece = `PIECE-${idx}`;
      
      if (tx.debit > 0) {
        fec += `JNL;Journal General;${idx};${date};${tx.compteAttribué};${Categorizer.obtenirLibelleCompte(tx.compteAttribué)};${piece};${date};${tx.libelle};${tx.debit.toFixed(2)};0.00\n`;
        fec += `JNL;Journal General;${idx};${date};512;Banque;${piece};${date};${tx.libelle};0.00;${tx.debit.toFixed(2)}\n`;
      }
      if (tx.credit > 0) {
        fec += `JNL;Journal General;${idx};${date};512;Banque;${piece};${date};${tx.libelle};${tx.credit.toFixed(2)};0.00\n`;
        fec += `JNL;Journal General;${idx};${date};${tx.compteAttribué};${Categorizer.obtenirLibelleCompte(tx.compteAttribué)};${piece};${date};${tx.libelle};0.00;${tx.credit.toFixed(2)}\n`;
      }
      idx++;
    });
    return fec;
  },

  /**
   * Rendu du GLOSSAIRE
   */
  renderViewGlossary() {
    const container = document.getElementById('glossary-container');
    container.innerHTML = '';

    this.glossary.forEach(g => {
      const item = document.createElement('div');
      item.className = 'glossary-item';
      item.innerHTML = `
        <div class="glossary-term">${g.terme}</div>
        <div class="glossary-translation"><i class="fa-solid fa-arrow-right-arrow-left"></i> Traduction : ${g.trad}</div>
        <div class="glossary-definition">${g.def}</div>
      `;
      container.appendChild(item);
    });
  }
};

// â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�
// CODE DU TUTORIEL D'ONBOARDING INTERACTIF
// â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�

const TourGuide = {
  currentStep: 0,
  steps: [
    {
      targetId: 'start-tour-btn',
      title: 'Bienvenue sur ComptaSimples !',
      text: 'Nous allons vous faire dÃ©couvrir l\'application en 5 Ã©tapes rapides. Ici, pas de jargon comptable incomprÃ©hensible, tout est fait pour vous faire gagner du temps !'
    },
    {
      targetId: 'menu-import',
      title: 'Ã‰tape 1 : Importer vos relevÃ©s',
      text: 'C\'est par ici que tout commence. TÃ©lÃ©chargez votre relevÃ© bancaire au format CSV depuis votre compte bancaire et importez-le en 2 secondes par simple glisser-dÃ©poser.'
    },
    {
      targetId: 'menu-categorize',
      title: 'Ã‰tape 2 : Trier et CatÃ©goriser',
      text: 'Une fois importÃ©es, le systÃ¨me classe automatiquement la majoritÃ© des opÃ©rations. S\'il reste des transactions inconnues, vous les rangez manuellement ici. En 20 minutes maximum, votre machine a tout appris !'
    },
    {
      targetId: 'menu-members',
      title: 'Ã‰tape 3 : Vos modules de gestion',
      text: 'Ces onglets s\'adaptent Ã  votre activitÃ©. Suivez par exemple qui sont vos Ã©lÃ¨ves, combien ils vous doivent pour l\'annÃ©e, et relancez les retards de paiements en 1 clic.'
    },
    {
      targetId: 'menu-books',
      title: 'Ã‰tape 4 : Registres & ClÃ´ture',
      text: 'Le travail est terminÃ© ! Tous vos documents de synthÃ¨se (Bilan, Grand Livre, Journal) se gÃ©nÃ¨rent d\'eux-mÃªmes, prÃªts Ã  Ãªtre exportÃ©s en format officiel (FEC) pour votre expert-comptable.'
    }
  ],

  start() {
    this.currentStep = 0;
    document.getElementById('tour-overlay').classList.add('active');
    this.showStep();
  },

  showStep() {
    const step = this.steps[this.currentStep];
    const target = document.getElementById(step.targetId);
    
    if (!target) return;

    // Met en valeur l'Ã©lÃ©ment cible
    document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
    target.classList.add('tour-highlight');
    
    // Positionne le Popover par rapport Ã  la cible
    const popover = document.getElementById('tour-popover');
    popover.style.display = 'block';

    const rect = target.getBoundingClientRect();
    
    // Positionnement intelligent en dessous ou Ã  cÃ´tÃ© de l'Ã©lÃ©ment cible
    if (rect.bottom + 200 < window.innerHeight) {
      popover.style.top = `${rect.bottom + window.scrollY + 10}px`;
      popover.style.left = `${rect.left + window.scrollX}px`;
    } else {
      popover.style.top = `${rect.top + window.scrollY - 180}px`;
      popover.style.left = `${rect.left + window.scrollX}px`;
    }

    // Contenu
    document.getElementById('tour-title').textContent = step.title;
    document.getElementById('tour-text').textContent = step.text;
    document.getElementById('tour-steps').textContent = `Ã‰tape ${this.currentStep + 1} / ${this.steps.length}`;

    // Gestion boutons
    const prevBtn = document.getElementById('tour-prev-btn');
    const nextBtn = document.getElementById('tour-next-btn');

    prevBtn.disabled = this.currentStep === 0;
    nextBtn.textContent = this.currentStep === this.steps.length - 1 ? 'Terminer' : 'Suivant';

    // Actions bouton
    prevBtn.onclick = () => {
      if (this.currentStep > 0) {
        this.currentStep--;
        this.showStep();
      }
    };

    nextBtn.onclick = () => {
      if (this.currentStep < this.steps.length - 1) {
        this.currentStep++;
        this.showStep();
      } else {
        this.stop();
      }
    };
  },

  stop() {
    document.getElementById('tour-overlay').classList.remove('active');
    document.getElementById('tour-popover').style.display = 'none';
    document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
  }
};
