/**
 * ═══════════════════════════════════════════════════════════════════
 * DONNÉES DE SIMULATION - PROTOTYPE SAAS COMPTABILITÉ
 * ═══════════════════════════════════════════════════════════════════
 */

export const INITIAL_PLAN_COMPTABLE = [
  { compte: "512", libelle: "Virement interne / Compte bancaire", type: "Transfert", group: "transferts", desc: "Le compte courant de votre structure." },
  { compte: "530", libelle: "Dépôt ou retrait d'espèces (Caisse)", type: "Transfert", group: "transferts", desc: "Argent liquide détenu dans votre boîte." },
  { compte: "411", libelle: "Règlement membre / élève", type: "Transfert", group: "transferts", desc: "Sommes dues par vos membres ou à rembourser." },
  { compte: "401", libelle: "Paiement fournisseur en attente", type: "Transfert", group: "transferts", desc: "Dettes envers vos fournisseurs réguliers." },
  { compte: "467", libelle: "Autre transfert ou avance", type: "Transfert", group: "transferts", desc: "Personnes ou structures tierces en compte." },
  
  { compte: "606", libelle: "Achats & Fournitures", type: "Charge", group: "depenses_courantes", desc: "Matériel, papeterie, petits équipements, alimentation." },
  { compte: "613", libelle: "Loyers & Locations de salles", type: "Charge", group: "depenses_courantes", desc: "Locations de salles et locaux." },
  { compte: "6132", libelle: "Logiciels, Abonnements & Web", type: "Charge", group: "depenses_courantes", desc: "Abonnements logiciels, outils SaaS, hébergement web." },
  { compte: "615", libelle: "Entretien & Réparations", type: "Charge", group: "depenses_courantes", desc: "Travaux sur locaux ou maintenance de matériel." },
  { compte: "616", libelle: "Assurances", type: "Charge", group: "depenses_courantes", desc: "Assurance multirisques locale ou responsabilité civile." },
  { compte: "625", libelle: "Déplacements & Repas", type: "Charge", group: "depenses_courantes", desc: "Péages, carburant, billets de train, repas de mission." },
  { compte: "626", libelle: "Téléphonie & Courrier", type: "Charge", group: "depenses_courantes", desc: "Abonnement internet, téléphone, timbres." },
  { compte: "627", libelle: "Frais bancaires", type: "Charge", group: "depenses_courantes", desc: "Commissions de cartes, tenue de compte, rejets." },

  { compte: "611", libelle: "Intervenants extérieurs & Sous-traitance", type: "Charge", group: "equipe", desc: "Services facturés par des auto-entrepreneurs ou externes." },
  { compte: "641", libelle: "Salaires nets", type: "Charge", group: "equipe", desc: "Salaires nets versés à vos enseignants ou employés." },
  { compte: "645", libelle: "Cotisations sociales (Urssaf, retraites)", type: "Charge", group: "equipe", desc: "Paiements URSSAF, retraite, prévoyance." },
  { compte: "6453", libelle: "Mutuelle santé", type: "Charge", group: "equipe", desc: "Part patronale de la mutuelle santé obligatoire." },
  { compte: "658", libelle: "Affiliations & Fédérations", type: "Charge", group: "equipe", desc: "Adhésion à des unions, fédérations ou syndicats." },

  { compte: "699", libelle: "Non catégorisé", type: "Charge", group: "depenses_courantes", desc: "Compte temporaire pour ranger ce que vous devez trier." },
  
  { compte: "756", libelle: "Cotisations & Adhésions", type: "Produit", group: "entrees", desc: "Adhésion annuelle simple versée par les membres." },
  { compte: "706", libelle: "Ventes, Cours & Services", type: "Produit", group: "entrees", desc: "Inscriptions aux cours, stages, prestations de service." },
  { compte: "740", libelle: "Subventions reçues", type: "Produit", group: "entrees", desc: "Subventions de la mairie, du département, de la région." },
  { compte: "758", libelle: "Dons & Mécénat", type: "Produit", group: "entrees", desc: "Dons de particuliers ou d'entreprises." }
];

export const INITIAL_RULES_LYON = [
  { motCle: "STRIPE", debit: "", credit: "706", note: "Ventes, Cours & Services" },
  { motCle: "COTIS", debit: "", credit: "756", note: "Cotisations & Adhésions" },
  { motCle: "DON", debit: "", credit: "758", note: "Dons & Mécénat" },
  { motCle: "EDF", debit: "613", credit: "", note: "Loyers & Locations de salles" },
  { motCle: "INTERNET", debit: "626", credit: "", note: "Téléphonie & Courrier" }
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
  { term: 'Compte 756', def: 'Cotisations des adhérents' },
  { term: 'Compte 706', def: 'Ventes de services et cours' },
  { term: 'Compte 606', def: 'Achats de fournitures et petits équipements' },
  { term: 'Compte 613', def: 'Loyers et locations de salles' }
];
