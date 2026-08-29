/**
 * ═══════════════════════════════════════════════════════════════════
 * DONNÉES DE SIMULATION - PROTOTYPE SAAS COMPTABILITÉ
 * ═══════════════════════════════════════════════════════════════════
 */

export const INITIAL_PLAN_COMPTABLE = [
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

export const INITIAL_RULES_LYON = [
  { motCle: 'STRIPE', debit: '', credit: '706', note: 'Ventes de Services & Cours' },
  { motCle: 'COTIS', debit: '', credit: '756', note: 'Cotisations des Adhérents' },
  { motCle: 'DON', debit: '', credit: '758', note: 'Dons & Mécénat' },
  { motCle: 'EDF', debit: '613', credit: '', note: 'Loyer, Salles & Abonnements web' },
  { motCle: 'INTERNET', debit: '626', credit: '', note: 'Télécoms & Poste' }
];

export const INITIAL_MEMBERS_LYON = [
  { id: 1, nom: 'Dupont Jean', forfait: 350, dejaPaye: 150, email: 'jean.dupont@email.com' },
  { id: 2, nom: 'Martin Sophie', forfait: 350, dejaPaye: 350, email: 'sophie.martin@email.com' },
  { id: 3, nom: 'Lemoine Pierre', forfait: 200, dejaPaye: 0, email: 'pierre.lemoine@email.com' }
];

export const INITIAL_PRODUCTS_LYON = [
  { id: 'prod-1', nom: 'Guitare classique d\'étude', prixAchat: 60, prixVente: 120, stock: 4 },
  { id: 'prod-2', nom: 'Cahier de solfège débutant', prixAchat: 5, prixVente: 12, stock: 15 },
  { id: 'prod-3', nom: 'Jeu de cordes nylon', prixAchat: 4, prixVente: 8, stock: 2 }
];

export const INITIAL_DONORS_LYON = [
  { id: 101, nom: 'Albert René', adresse: '45 Rue de la Soie, 69001 Lyon', montantTotal: 150, recuGenere: true },
  { id: 102, nom: 'Société Générale Lyon (Mécénat)', adresse: '2 Place des Terreaux, 69002 Lyon', montantTotal: 500, recuGenere: false }
];

export const INITIAL_BILLS_LYON = [
  { id: 1, provider: 'Fournisseur Musique SAS', label: 'Achat de cordes et médiators', amount: 120.00, dueDate: '2026-06-15', status: 'unpaid' },
  { id: 2, provider: 'EDF Lyon', label: 'Électricité du local - Facture Mai', amount: 85.00, dueDate: '2026-06-10', status: 'unpaid' }
];

export const DEMO_CSV_DATA = `Date;Libelle;Debit;Credit;Info
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

export const GLOSSARY_DATA = [
  { terme: 'Le Livre-Journal', trad: 'Le Livre de Bord', def: 'Le journal de bord chronologique de votre argent. Chaque centime qui entre ou sort doit y figurer, écrit en double (provenance et destination).' },
  { terme: 'Le Grand Livre', trad: 'Le Tri par Catégories', def: 'Prend toutes les lignes du Journal et les trie dans des tiroirs séparés (Loyer, Timbres, Salaires). Indispensable pour voir combien vous dépensez par budget.' },
  { terme: 'La Balance', trad: 'Le Résumé de Contrôle', def: 'Un tableau récapitulatif qui montre le total des entrées et sorties pour chaque tiroir. C\'est ce qui prouve que vos comptes sont équilibrés.' },
  { terme: 'Le Bilan', trad: 'La Fiche d\'Identité Financière', def: 'Une image à un instant T qui liste ce que la structure possède (l\'actif : solde en banque, ordinateurs...) et ce qu\'elle doit (le passif : emprunts, cotisations reçues en avance).' },
  { terme: 'Le Compte de Résultat', trad: 'Gains vs Pertes', def: 'Un tableau qui calcule si vous avez gagné de l\'argent (Bénéfice/Excédent) ou perdu de l\'argent (Déficit) au cours de l\'année.' },
  { terme: 'Plan Comptable', trad: 'Le Catalogue de Rangement', def: 'La liste officielle des étiquettes (numérotées comme 606 pour les fournitures) autorisées pour classer vos factures.' },
  { terme: 'Exercice Comptable', trad: 'La Saison Financière', def: 'La période de 12 mois sur laquelle on calcule vos gains. Pour les assos, elle commence souvent le 1er septembre avec la rentrée scolaire.' },
  { terme: 'Débit', trad: 'Dépenses / Sorties d\'argent', def: 'Enregistrer une dépense ou l\'achat d\'un bien qui rentre dans votre patrimoine.' },
  { terme: 'Crédit', trad: 'Recettes / Entrées d\'argent', def: 'Enregistrer un gain, une subvention, ou l\'origine d\'un financement.' }
];
