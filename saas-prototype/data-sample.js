/**
 * ═══════════════════════════════════════════════════════════════════
 * DONNÉES DE SIMULATION - PROTOTYPE SAAS COMPTABILITÉ
 * ═══════════════════════════════════════════════════════════════════
 */

const SAMPLE_CSV = `Date;Libelle;Debit;Credit;Info
`;

const INITIAL_PLAN_COMPTABLE = [
  { compte: '512', libelle: 'Compte Bancaire (Banque)', type: 'Actif', desc: 'Le compte courant de votre structure.' },
  { compte: '530', libelle: 'Caisse (Espèces)', type: 'Actif', desc: 'Argent liquide détenu dans votre boîte.' },
  { compte: '411', libelle: 'Membres & Élèves (Adhérents)', type: 'Actif', desc: 'Sommes dues par vos membres ou à rembourser.' },
  { compte: '467', libelle: 'Autres débiteurs / Tiers', type: 'Actif', desc: 'Personnes ou structures tierces en compte.' },
  { compte: '401', libelle: 'Fournisseurs', type: 'Passif', desc: 'Dettes envers vos fournisseurs réguliers.' },
  { compte: '606', libelle: 'Achats & Fournitures', type: 'Charge', desc: 'Matériel, papeterie, petits équipements, alimentation.' },
  { compte: '611', libelle: 'Sous-traitance & Intervenants', type: 'Charge', desc: 'Services facturés par des auto-entrepreneurs ou externes.' },
  { compte: '613', libelle: 'Loyer, Salles & Abonnements web', type: 'Charge', desc: 'Locations de salles, abonnements logiciels, site web.' },
  { compte: '615', libelle: 'Entretien & Réparations', type: 'Charge', desc: 'Travaux sur locaux ou maintenance de matériel.' },
  { compte: '616', libelle: 'Assurances', type: 'Charge', desc: 'Assurance multirisques locale ou responsabilité civile.' },
  { compte: '625', libelle: 'Déplacements & Repas', type: 'Charge', desc: 'Péages, carburant, billets de train, repas de mission.' },
  { compte: '626', libelle: 'Télécoms & Poste', type: 'Charge', desc: 'Abonnement internet, téléphone, timbres.' },
  { compte: '627', libelle: 'Frais Bancaires', type: 'Charge', desc: 'Commissions de cartes, tenue de compte, rejets.' },
  { compte: '641', libelle: 'Rémunérations & Salaires', type: 'Charge', desc: 'Salaires nets versés à vos enseignants ou employés.' },
  { compte: '645', libelle: 'Charges Sociales', type: 'Charge', desc: 'Paiements URSSAF, retraite, prévoyance.' },
  { compte: '6453', libelle: 'Mutuelle Santé', type: 'Charge', desc: 'Part patronale de la mutuelle santé obligatoire.' },
  { compte: '658', libelle: 'Cotisations Syndicales/Fédérales', type: 'Charge', desc: 'Adhésion à des unions, fédérations ou syndicats.' },
  { compte: '699', libelle: 'Transactions Non Classées', type: 'Charge', desc: 'Compte temporaire pour ranger ce que vous devez trier.' },
  { compte: '706', libelle: 'Ventes de Services & Cours', type: 'Produit', desc: 'Inscriptions aux cours, stages, prestations de service.' },
  { compte: '740', libelle: 'Subventions Publiques', type: 'Produit', desc: 'Subventions de la mairie, du département, de la région.' },
  { compte: '756', libelle: 'Cotisations des Adhérents', type: 'Produit', desc: 'Adhésion annuelle simple versée par les membres.' },
  { compte: '758', libelle: 'Dons & Mécénat', type: 'Produit', desc: 'Dons de particuliers ou d\'entreprises (avec ou sans reçu).' }
];

const INITIAL_RULES = [];

const INITIAL_MEMBERS = [];

const INITIAL_PRODUCTS = [];

const INITIAL_DONORS = [];
