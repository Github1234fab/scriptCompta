/**
 * ═══════════════════════════════════════════════════════════════════
 * DONNÉES DE SIMULATION - PROTOTYPE SAAS COMPTABILITÉ
 * ═══════════════════════════════════════════════════════════════════
 */

export const INITIAL_PLAN_COMPTABLE = [
  // ── TRANSFERTS, BANQUE, EXPLOITANT & TVA ──
  { compte: "512", libelle: "Virement interne / Compte bancaire", type: "Transfert", group: "transferts", desc: "Virement entre deux comptes bancaires de votre structure (ne compte ni en recette ni en dépense)." },
  { compte: "530", libelle: "Dépôt ou retrait d'espèces (Caisse)", type: "Transfert", group: "transferts", desc: "Retrait au distributeur ou remise d'espèces en banque." },
  { compte: "108", libelle: "Prélèvement personnel / Compte de l'exploitant", type: "Transfert", group: "transferts", desc: "Virement vers votre compte bancaire personnel ou rémunération d'entrepreneur individuel / BNC (non déductible)." },
  { compte: "455", libelle: "Compte courant d'associé (Apport / Remboursement CCA)", type: "Transfert", group: "transferts", desc: "Apport de trésorerie ou remboursement d'avance d'un associé (SASU, SARL, SCI)." },
  { compte: "164", libelle: "Remboursement d'emprunt bancaire (Capital)", type: "Transfert", group: "transferts", desc: "Part capital des mensualités de prêt professionnel ou immobilier (les intérêts vont en 661)." },
  { compte: "445", libelle: "TVA (Paiement ou Remboursement DGFiP)", type: "Transfert", group: "transferts", desc: "Prélèvement mensuel/trimestriel de TVA par les impôts ou remboursement d'un crédit de TVA." },
  { compte: "411", libelle: "Remboursement ou avance client / adhérent", type: "Transfert", group: "transferts", desc: "Remboursement d'un trop-perçu, annulation de facture ou règlement d'un membre." },
  { compte: "401", libelle: "Règlement ou avoir fournisseur", type: "Transfert", group: "transferts", desc: "Règlement d'une dette fournisseur déjà enregistrée ou remboursement fournisseur." },
  { compte: "467", libelle: "Autre transfert, caution ou avance tiers", type: "Transfert", group: "transferts", desc: "Dépôt de garantie, caution de local, ou somme encaissée/avancée pour le compte d'un tiers." },
  { compte: "487", libelle: "Produits constatés d'avance (Saison future / Reports)", type: "Transfert", group: "transferts", desc: "Inscriptions, abonnements ou cotisations encaissés par avance pour l'exercice suivant." },

  // ── INVESTISSEMENTS / IMMOBILISATIONS ──
  { compte: "218", libelle: "Matériel & Immobilisations (> 500 € HT)", type: "Charge", group: "immobilisations", desc: "Achat durable supérieur à 500 € HT : ordinateur, smartphone, mobilier, matériel médical ou pro (à amortir)." },

  // ── DÉPENSES COURANTES & FONCTIONNEMENT ──
  { compte: "606", libelle: "Achats & Fournitures (< 500 € HT)", type: "Charge", group: "depenses_courantes", desc: "Papeterie, cartouches, consommables, petit matériel (< 500 € HT), produits d'entretien, Amazon fournitures." },
  { compte: "6061", libelle: "Eau, Électricité, Gaz & Carburant", type: "Charge", group: "depenses_courantes", desc: "Factures EDF, Engie, eau du local, chauffage, plein d'essence ou recharge électrique véhicule pro." },
  { compte: "607", libelle: "Achats de marchandises (pour revente)", type: "Charge", group: "depenses_courantes", desc: "Produits finis achetés à des fournisseurs pour être revendus en l'état à vos clients." },
  { compte: "613", libelle: "Loyers & Locations de locaux / salles", type: "Charge", group: "depenses_courantes", desc: "Loyer du bureau/cabinet, coworking, location de salle ou de matériel professionnel." },
  { compte: "6132", libelle: "Logiciels, Abonnements & Outils Web", type: "Charge", group: "depenses_courantes", desc: "SaaS et outils en ligne : OpenAI/ChatGPT, Adobe, Google Workspace, Microsoft 365, Canva, hébergement, domaine." },
  { compte: "615", libelle: "Entretien, Réparations & Maintenance", type: "Charge", group: "depenses_courantes", desc: "Ménage du local, réparation d'équipement, révision véhicule pro, travaux d'entretien courant." },
  { compte: "616", libelle: "Assurances professionnelles", type: "Charge", group: "depenses_courantes", desc: "Responsabilité civile pro (RC Pro), assurance multirisque local, assurance véhicule pro ou prévoyance." },
  { compte: "618", libelle: "Documentation, Livres & Formations", type: "Charge", group: "depenses_courantes", desc: "Livres techniques/pro, abonnements presse spécialisée, stages, webinaires et formations continues." },
  { compte: "622", libelle: "Honoraires & Conseils externes", type: "Charge", group: "depenses_courantes", desc: "Expert-comptable, avocat, notaire, commissaire aux comptes, frais d'actes ou de greffe." },
  { compte: "623", libelle: "Publicité, Marketing & Communication", type: "Charge", group: "depenses_courantes", desc: "Google Ads, Meta/LinkedIn Ads, flyers, cartes de visite, création de site web, cadeaux clients." },
  { compte: "625", libelle: "Déplacements, Parking, Train & Repas pro", type: "Charge", group: "depenses_courantes", desc: "Parking, péages, SNCF, avion, taxi/Uber, hôtel, repas d'affaires ou repas de mission hors domicile." },
  { compte: "626", libelle: "Téléphonie, Internet & Frais postaux", type: "Charge", group: "depenses_courantes", desc: "Forfait mobile pro, fibre/box internet (Orange, Free, SFR, Bouygues), timbres, recommandés, Colissimo." },
  { compte: "627", libelle: "Frais bancaires & Commissions", type: "Charge", group: "depenses_courantes", desc: "Tenue de compte (Qonto, Shine, BNP...), cotisation carte bancaire, commissions Stripe/SumUp/TPE." },
  { compte: "628", libelle: "Cotisations professionnelles & Ordres", type: "Charge", group: "depenses_courantes", desc: "Cotisation Ordre professionnel (infirmier, médecin, barreau...), URPS, syndicat pro, CCI, AGA." },
  { compte: "635", libelle: "Impôts & Taxes professionnelles", type: "Charge", group: "depenses_courantes", desc: "CFE (Cotisation Foncière des Entreprises), taxe foncière du local pro, taxe d'apprentissage." },
  { compte: "661", libelle: "Intérêts d'emprunt & Agios", type: "Charge", group: "depenses_courantes", desc: "Intérêts des prêts bancaires/immobiliers, agios de découvert et frais financiers." },
  { compte: "671", libelle: "Amendes, Pénalités & Charges exceptionnelles", type: "Charge", group: "depenses_courantes", desc: "Contraventions, majorations de retard fiscal/URSSAF, pénalités contractuelles (souvent non déductibles)." },

  // ── ÉQUIPE, SOUS-TRAITANCE & SOCIAL ──
  { compte: "611", libelle: "Sous-traitance & Intervenants externes", type: "Charge", group: "equipe", desc: "Prestations facturées par des freelances, remplaçants, auto-entrepreneurs ou partenaires externes." },
  { compte: "641", libelle: "Salaires nets versés", type: "Charge", group: "equipe", desc: "Salaires nets virés aux salariés, enseignants ou collaborateurs (hors rémunération de l'exploitant)." },
  { compte: "645", libelle: "Cotisations sociales (URSSAF, Retraite, CARPIMKO)", type: "Charge", group: "equipe", desc: "Prélèvements URSSAF, caisses de retraite (CIPAV, CARPIMKO, Agirc-Arrco), prévoyance obligatoire." },
  { compte: "6453", libelle: "Mutuelle santé & Prévoyance Madelin", type: "Charge", group: "equipe", desc: "Cotisations mutuelle santé (part patronale salariés ou contrat Madelin déductible pour indépendant)." },
  { compte: "658", libelle: "Affiliations, Fédérations & Charges diverses", type: "Charge", group: "equipe", desc: "Adhésion à une fédération sportive/culturelle, union associative ou autres charges de gestion." },

  { compte: "699", libelle: "Non catégorisé", type: "Charge", group: "depenses_courantes", desc: "Compte temporaire d'attente pour les opérations qui n'ont pas encore été attribuées." },

  // ── RECETTES & PRODUITS ──
  { compte: "706", libelle: "Prestations de services & Honoraires", type: "Produit", group: "entrees", desc: "Activité principale : factures clients, honoraires, consultations, séances, cours ou forfaits." },
  { compte: "7061", libelle: "Prestations facturées à l'heure / au temps passé", type: "Produit", group: "entrees", desc: "Missions, accompagnements ou interventions facturés au taux horaire ou journalier (TJM)." },
  { compte: "7062", libelle: "Commissions & Honoraires de résultat", type: "Produit", group: "entrees", desc: "Commissions d'apporteur d'affaires, rétrocessions ou primes de résultat." },
  { compte: "7063", libelle: "Consultations, Actes & Rendez-vous", type: "Produit", group: "entrees", desc: "Actes médicaux/paramédicaux, téléconsultations, rendez-vous conseils ou séances individuelles." },
  { compte: "7064", libelle: "Formations, Ateliers & Stages animés", type: "Produit", group: "entrees", desc: "Recettes issues de formations, conférences, stages collectifs ou ateliers pédagogiques." },
  { compte: "708", libelle: "Frais & Débours refacturés aux clients", type: "Produit", group: "entrees", desc: "Frais avancés pour un client (déplacements, fournitures, frais administratifs) et refacturés." },
  { compte: "707", libelle: "Ventes de marchandises & Boutique", type: "Produit", group: "entrees", desc: "Ventes de produits physiques, boutique en ligne, merchandising ou matériel revendu." },
  { compte: "756", libelle: "Cotisations & Adhésions (Association)", type: "Produit", group: "entrees", desc: "Cotisations annuelles, licences et adhésions versées par les membres de l'association." },
  { compte: "740", libelle: "Subventions & Aides publiques reçues", type: "Produit", group: "entrees", desc: "Subventions de mairie, département, région, État ou aides à l'embauche/activité." },
  { compte: "758", libelle: "Dons, Mécénat & Autres produits", type: "Produit", group: "entrees", desc: "Dons de particuliers ou d'entreprises, sponsoring, mécénat ou produits divers." },
  { compte: "791", libelle: "Remboursements CPAM (IJSS) & Assurances", type: "Produit", group: "entrees", desc: "Indemnités journalières Sécurité Sociale/CPAM, remboursements de sinistre ou prévoyance." }
];

export const INITIAL_RULES_LYON = [
  { motCle: "STRIPE", debit: "", credit: "706", note: "Prestations de services & Honoraires" },
  { motCle: "COTIS", debit: "", credit: "756", note: "Cotisations & Adhésions (Association)" },
  { motCle: "DON", debit: "", credit: "758", note: "Dons, Mécénat & Autres produits" },
  { motCle: "EDF", debit: "6061", credit: "", note: "Eau, Électricité, Gaz & Carburant" },
  { motCle: "INTERNET", debit: "626", credit: "", note: "Téléphonie, Internet & Frais postaux" }
];

export const INITIAL_MEMBERS_LYON = [
  { id: 1, nom: "Dupont Jean", forfait: 350, dejaPaye: 150, email: "jean.dupont@email.com" },
  { id: 2, nom: "Martin Sophie", forfait: 350, dejaPaye: 350, email: "sophie.martin@email.com" },
  { id: 3, nom: "Lemoine Pierre", forfait: 200, dejaPaye: 0, email: "pierre.lemoine@email.com" }
];

export const INITIAL_PRODUCTS_LYON = [
  { id: "prod-1", nom: "Guitare classique d'étude", prixAchat: 60, prixVente: 120, stock: 4 },
  { id: "prod-2", nom: "Cahier de solfège débutant", prixAchat: 5, prixVente: 12, stock: 15 },
  { id: "prod-3", nom: "Jeu de cordes nylon", prixAchat: 4, prixVente: 8, stock: 2 }
];

export const INITIAL_DONORS_LYON = [
  { id: 101, nom: "Albert René", adresse: "45 Rue de la Soie, 69001 Lyon", montantTotal: 150, recuGenere: true },
  { id: 102, nom: "Société Générale Lyon (Mécénat)", adresse: "2 Place des Terreaux, 69002 Lyon", montantTotal: 500, recuGenere: false }
];

export const INITIAL_BILLS_LYON = [
  { id: 1, provider: "Fournisseur Musique SAS", label: "Achat de cordes et médiators", amount: 120.00, dueDate: "2026-06-15", status: "unpaid" },
  { id: 2, provider: "EDF Lyon", label: "Électricité du local - Facture Mai", amount: 85.00, dueDate: "2026-06-10", status: "unpaid" }
];

export const DEMO_CSV_DATA = `Date;Libelle;Montant
15/09/2026;VIR DUPONT JEAN COTISATION 2026;150,00
14/09/2026;VIR MARTIN SOPHIE STAGE GUITARE;350,00
10/09/2026;VIREMENT LEMOINE PIERRE COURS;100,00
05/09/2026;ACHAT SUPER U FOURNITURES;-45,80
02/09/2026;ABONNEMENT INTERNET ORANGE;-34,99`;

export const GLOSSARY_DATA = [
  { term: 'Compte 706', def: 'Honoraires et prestations de services' },
  { term: 'Compte 707', def: 'Ventes de marchandises physiques' },
  { term: 'Compte 756', def: 'Cotisations des adhérents' },
  { term: 'Compte 606', def: 'Achats de fournitures et petits équipements' },
  { term: 'Compte 613', def: 'Loyers et locations de salles' }
];
