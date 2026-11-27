/**
 * Mémo pédagogique complet des comptes comptables Tito.
 * Conçu pour guider l'utilisateur sans jargon et éviter les erreurs d'attribution.
 */

export const ACCOUNT_GUIDE_SECTIONS = [
  {
    id: 'recettes',
    label: 'Recettes (Entrées d’argent)',
    shortLabel: 'Recettes (+)',
    accent: '#34d399',
    bgTint: 'rgba(16, 185, 129, 0.1)',
    borderTint: 'rgba(16, 185, 129, 0.3)',
    icon: 'fa-arrow-trend-up',
    intro: 'Tout l’argent gagné grâce à votre activité (factures clients, honoraires, ventes, cotisations, subventions ou dons).',
    groups: [
      {
        title: 'Activité principale (Prestations & Honoraires)',
        accounts: [
          {
            compte: '706',
            title: 'Prestations de services & Honoraires (compte général)',
            whenToUse: 'C’est le compte « par défaut » le plus utilisé pour vos recettes d’activité si vous n’avez pas besoin de détailler par type de prestation.',
            examples: 'Facture client au forfait, honoraires mensuels, mission de conseil, loyer encaissé (en SCI), appel de fonds (en copro).',
            watchOut: 'Si vous vendez des produits physiques achetés pour être revendus, utilisez plutôt 707.'
          },
          {
            compte: '7061',
            title: 'Prestations en régie / au temps passé (TJM / taux horaire)',
            whenToUse: 'Sous-compte optionnel de 706 pour isoler les missions facturées à la journée (TJM) ou à l’heure.',
            examples: '5 jours de développement facturés à 500 €/jour, 3 heures d’accompagnement facturées à l’heure.',
            watchOut: 'Purement optionnel : vous pouvez tout laisser en 706 si vous ne suivez pas séparément régie et forfait.'
          },
          {
            compte: '7062',
            title: 'Commissions & Honoraires de résultat',
            whenToUse: 'Pour les rémunérations variables, apports d’affaires, rétrocessions ou primes liées à un résultat.',
            examples: 'Commission d’apporteur d’affaires, bonus de performance, rétrocession d’honoraires reçue.',
            watchOut: 'Pour une facture classique fixe, utilisez 706.'
          },
          {
            compte: '7063',
            title: 'Consultations, Actes & Soins',
            whenToUse: 'Idéal pour les professions libérales de santé ou de conseil qui facturent à l’acte ou à la séance.',
            examples: 'Lots de télétransmission CPAM (NOEMIE), tiers payant mutuelles (Almerys, Viamedis), consultations patients SumUp/CB.',
            watchOut: 'Ne pas confondre avec les indemnités d’arrêt maladie CPAM (IJSS), qui vont en 791.'
          },
          {
            compte: '7064',
            title: 'Formations, Ateliers & Stages animés',
            whenToUse: 'Pour séparer vos revenus de formation, d’enseignement ou d’ateliers collectifs de votre activité principale.',
            examples: 'Stage week-end, formation professionnelle facturée, conférence rémunérée, atelier pédagogique.',
            watchOut: 'Si c’est vous qui payez une formation pour vous former, c’est une dépense en 618.'
          },
          {
            compte: '708',
            title: 'Frais & Débours refacturés aux clients',
            whenToUse: 'Quand vous avancez des frais pour un client (billet de train, frais de greffe, matériel) et que vous les lui refacturez.',
            examples: 'Remboursement d’un déplacement facturé au client, frais d’huissier ou de dossier refacturés.',
            watchOut: 'Ne concerne pas les remboursements d’assurance ou CPAM (voir 791).'
          }
        ]
      },
      {
        title: 'Ventes physiques, Vie associative & Autres produits',
        accounts: [
          {
            compte: '707',
            title: 'Ventes de marchandises & Boutique',
            whenToUse: 'Pour toute vente de biens physiques achetés puis revendus en l’état (important en micro-entreprise car le taux URSSAF est plus bas : 12,3 %).',
            examples: 'Vente de t-shirts ou matériel en boutique, e-commerce de produits physiques, revente de fournitures.',
            watchOut: 'Les achats de ces marchandises à vos fournisseurs se classent en face dans le compte 607.'
          },
          {
            compte: '756',
            title: 'Cotisations & Adhésions (Association)',
            whenToUse: 'Uniquement pour les associations Loi 1901 : cotisations annuelles et licences payées par les membres.',
            examples: 'Adhésion annuelle au club, renouvellement de licence sportive ou culturelle.',
            watchOut: 'Si un adhérent paie déjà pour la saison prochaine, pensez au report en 487.'
          },
          {
            compte: '740',
            title: 'Subventions & Aides publiques reçues',
            whenToUse: 'Aides financières versées par un organisme public (mairie, département, région, État, France Travail…).',
            examples: 'Subvention municipale d’association, aide à l’embauche, subvention culturelle ou sportive.',
            watchOut: 'Un don d’une entreprise privée ou d’un particulier va en 758, pas en 740.'
          },
          {
            compte: '758',
            title: 'Dons, Mécénat & Autres produits',
            whenToUse: 'Dons manuels de particuliers, mécénat d’entreprises (pouvant ouvrir droit à reçu fiscal CERFA) ou recettes diverses.',
            examples: 'Don d’un particulier, sponsoring local, collecte HelloAsso de dons.',
            watchOut: 'Les cotisations avec contrepartie (accès aux cours) vont en 756 ou 706, pas en don.'
          },
          {
            compte: '791',
            title: 'Remboursements CPAM (IJSS) & Assurances',
            whenToUse: 'Indemnités perçues suite à un arrêt de travail (maladie, maternité) ou remboursement d’un sinistre par votre assurance.',
            examples: 'Virement CPAM IJSS arrêt maladie, indemnisation assurance suite à un dégât des eaux ou vol.',
            watchOut: 'Ne pas confondre avec les lots de télétransmission CPAM de soins (qui sont des honoraires en 7063).'
          }
        ]
      }
    ]
  },
  {
    id: 'depenses',
    label: 'Dépenses & Charges (Sorties d’argent)',
    shortLabel: 'Dépenses (-)',
    accent: '#f87171',
    bgTint: 'rgba(239, 68, 68, 0.1)',
    borderTint: 'rgba(239, 68, 68, 0.3)',
    icon: 'fa-arrow-trend-down',
    intro: 'Tous les frais engagés dans l’intérêt de votre activité professionnelle ou associative (avec justificatif à conserver).',
    groups: [
      {
        title: 'Achats courants, Énergie & Documentation',
        accounts: [
          {
            compte: '606',
            title: 'Achats & Fournitures (< 500 € HT)',
            whenToUse: 'Petits achats consommables ou petit équipement dont le prix unitaire est inférieur à 500 € HT.',
            examples: 'Papeterie, cartouches d’encre, compresses/gants, produits ménagers, petit écran < 500 € HT, Amazon fournitures.',
            watchOut: 'Si un matériel durable dépasse 500 € HT (ordinateur, mobilier, appareil médical), utilisez 218.'
          },
          {
            compte: '6061',
            title: 'Eau, Électricité, Gaz & Carburant',
            whenToUse: 'Toutes vos consommations d’énergie du local professionnel et le carburant de vos déplacements pro.',
            examples: 'Factures EDF, Engie, Veolia (eau), plein d’essence TotalEnergies, recharge électrique véhicule pro.',
            watchOut: 'Le loyer du local va en 613 ; les péages et parkings vont en 625.'
          },
          {
            compte: '607',
            title: 'Achats de marchandises (pour revente)',
            whenToUse: 'Uniquement les produits que vous achetez à un grossiste/fournisseur pour les revendre tels quels à vos clients.',
            examples: 'Stock de vêtements, livres ou accessoires achetés pour votre boutique.',
            watchOut: 'Pour les fournitures que vous consommez vous-même au bureau, utilisez 606.'
          },
          {
            compte: '618',
            title: 'Documentation, Livres & Formations',
            whenToUse: 'Tout ce qui sert à vous informer, vous documenter ou monter en compétences dans votre métier.',
            examples: 'Livres techniques, abonnement presse pro, formation continue, DPC santé, stage ou webinaire pro.',
            watchOut: 'Les abonnements logiciels/SaaS (Adobe, OpenAI) vont plutôt en 6132.'
          }
        ]
      },
      {
        title: 'Logiciels, Télécom, Pub & Banque',
        accounts: [
          {
            compte: '6132',
            title: 'Logiciels, Abonnements & Outils Web',
            whenToUse: 'Tous vos abonnements numériques, logiciels métiers, cloud et outils SaaS.',
            examples: 'Adobe, Figma, OpenAI/ChatGPT, Doctolib, Vega, Google Workspace, Microsoft 365, OVH, AWS, Canva, hébergement.',
            watchOut: 'La box internet et le forfait téléphone vont en 626.'
          },
          {
            compte: '626',
            title: 'Téléphonie, Internet & Frais postaux',
            whenToUse: 'Communications téléphoniques, accès internet et envois postaux.',
            examples: 'Orange Fibre, Free, SFR, Bouygues, forfait mobile pro, timbres La Poste, lettres recommandées LRAR, Colissimo.',
            watchOut: 'Si votre ligne sert aussi en perso, vous pouvez ventiler la part pro (626) et perso (108).'
          },
          {
            compte: '627',
            title: 'Frais bancaires & Commissions',
            whenToUse: 'Tous les frais prélevés par votre banque ou vos terminaux de paiement.',
            examples: 'Abonnement Qonto/Shine, frais de tenue de compte, cotisation carte bancaire, commissions Stripe/SumUp/TPE.',
            watchOut: 'Les intérêts d’un emprunt bancaire vont en 661, pas en 627.'
          },
          {
            compte: '623',
            title: 'Publicité, Marketing & Communication',
            whenToUse: 'Toutes les dépenses destinées à vous faire connaître et trouver des clients ou adhérents.',
            examples: 'Google Ads, Meta/LinkedIn Ads, impression de flyers, cartes de visite, goodies, création de site vitrine.',
            watchOut: 'Les prestations de conseil récurrentes (comptable, avocat) vont en 622.'
          }
        ]
      },
      {
        title: 'Locaux, Déplacements & Assurances',
        accounts: [
          {
            compte: '613',
            title: 'Loyers & Locations de locaux / salles',
            whenToUse: 'Loyer de votre bureau, cabinet, espace de coworking, salle de répétition ou location de matériel.',
            examples: 'Loyer mensuel du cabinet, coworking, location de salle municipale, leasing d’imprimante.',
            watchOut: 'L’électricité/eau du local vont en 6061 ; le dépôt de garantie (caution) va en 467.'
          },
          {
            compte: '615',
            title: 'Entretien, Réparations & Maintenance',
            whenToUse: 'Travaux courants pour maintenir votre local ou votre matériel en bon état (sans en augmenter la valeur).',
            examples: 'Ménage du bureau/copro, plombier, serrurier, entretien ascenseur Otis, révision voiture pro, peinture locative.',
            watchOut: 'Les gros travaux de transformation ou matériel neuf > 500 € HT vont en 218.'
          },
          {
            compte: '616',
            title: 'Assurances professionnelles',
            whenToUse: 'Toutes vos polices d’assurance liées à l’activité, au local ou aux biens de la structure.',
            examples: 'RC Pro (Hiscox, AXA, MACSF), assurance multirisque local/immeuble, assurance PNO (SCI), assurance associative MAIF.',
            watchOut: 'La mutuelle santé (salariés ou Madelin) va en 6453.'
          },
          {
            compte: '625',
            title: 'Déplacements, Parking, Train & Repas pro',
            whenToUse: 'Frais liés à vos déplacements professionnels et repas pris hors domicile dans le cadre d’une mission ou avec un client.',
            examples: 'Billets SNCF, avion, Uber/taxi, parking, péages, hôtel en déplacement, déjeuner avec un client.',
            watchOut: 'Le carburant à la station-service peut aller en 6061 (ou 625 si vous regroupez tous les déplacements).'
          }
        ]
      },
      {
        title: 'Honoraires, Impôts, Équipe & Investissements',
        accounts: [
          {
            compte: '622',
            title: 'Honoraires & Conseils externes',
            whenToUse: 'Professionnels réglementés ou conseillers qui vous accompagnent.',
            examples: 'Expert-comptable, avocat, notaire, diagnostic immobilier DPE, frais de greffe ou d’annonce légale.',
            watchOut: 'Un freelance qui réalise une prestation pour vos clients (dev, prof, remplaçant) va plutôt en 611.'
          },
          {
            compte: '628',
            title: 'Cotisations professionnelles & Ordres',
            whenToUse: 'Cotisations obligatoires ou volontaires à des organismes professionnels.',
            examples: 'Ordre national des infirmiers/médecins, URPS, AGA, syndicat professionnel, CCI.',
            watchOut: 'Pour les fédérations associatives/sportives, vous pouvez utiliser 658.'
          },
          {
            compte: '635',
            title: 'Impôts & Taxes professionnelles',
            whenToUse: 'Impôts locaux et taxes liés à votre structure (hors impôt sur le revenu personnel et hors TVA).',
            examples: 'CFE (Cotisation Foncière des Entreprises), taxe foncière d’un bien en SCI ou local pro.',
            watchOut: 'La TVA payée à la DGFiP va en 445, et les amendes/pénalités vont en 671.'
          },
          {
            compte: '611',
            title: 'Sous-traitance & Intervenants externes',
            whenToUse: 'Factures de prestataires indépendants qui interviennent directement dans votre activité.',
            examples: 'Développeur freelance, professeur intervenant en association, rétrocession à un infirmier remplaçant.',
            watchOut: 'Ne concerne pas vos salariés en contrat de travail (qui vont en 641).'
          },
          {
            compte: '641',
            title: 'Salaires nets versés',
            whenToUse: 'Uniquement les salaires nets payés sur fiche de paie à vos salariés ou dirigeants assimilés salariés (SASU/SAS).',
            examples: 'Virement mensuel du salaire net d’un collaborateur ou animateur.',
            watchOut: 'En micro-entreprise ou BNC/EI, vos virements vers votre compte perso ne sont PAS un salaire : utilisez 108.'
          },
          {
            compte: '645',
            title: 'Cotisations sociales (URSSAF, Retraite, CARPIMKO)',
            whenToUse: 'Charges sociales obligatoires de l’indépendant ou de l’employeur.',
            examples: 'URSSAF trimestrielle/mensuelle, CARPIMKO, CIPAV, caisse de retraite complémentaire Agirc-Arrco.',
            watchOut: 'La mutuelle santé (obligatoire salariés ou contrat Madelin) a son compte dédié : 6453.'
          },
          {
            compte: '6453',
            title: 'Mutuelle santé & Prévoyance Madelin',
            whenToUse: 'Cotisations de complémentaire santé pour vos salariés ou contrat Madelin déductible (TNS / BNC).',
            examples: 'Prélèvement Alan, Harmonie Mutuelle, contrat santé/prévoyance Madelin.',
            watchOut: 'Une mutuelle purement personnelle non Madelin ne se déduit pas (utiliser 108).'
          },
          {
            compte: '658',
            title: 'Affiliations, Fédérations & Charges diverses',
            whenToUse: 'Affiliations associatives ou petites charges courantes qui n’entrent dans aucune autre case.',
            examples: 'Affiliation à une fédération sportive/culturelle, cotisation d’union associative.',
            watchOut: 'À éviter comme « fourre-tout » si un compte plus précis existe.'
          },
          {
            compte: '661',
            title: 'Intérêts d’emprunt & Agios',
            whenToUse: 'Uniquement le coût financier de vos crédits (les intérêts et agios, jamais le remboursement du capital).',
            examples: 'Part intérêts d’une mensualité de prêt pro ou immobilier, agios de découvert.',
            watchOut: 'Si votre banque prélève capital + intérêts en une seule ligne, utilisez « Ventiler » : capital en 164, intérêts en 661.'
          },
          {
            compte: '671',
            title: 'Amendes, Pénalités & Charges exceptionnelles',
            whenToUse: 'Contraventions, majorations de retard fiscal ou URSSAF, pénalités diverses.',
            examples: 'Amende de stationnement, majoration de retard URSSAF/impôts.',
            watchOut: 'Important à isoler car les amendes ne sont généralement pas déductibles fiscalement.'
          },
          {
            compte: '218',
            title: 'Matériel & Immobilisations (> 500 € HT)',
            whenToUse: 'Tout équipement durable de valeur unitaire supérieure à 500 € HT destiné à servir plusieurs années.',
            examples: 'MacBook Pro, smartphone pro > 500 € HT, bureau/mobilier, appareil médical ou outillage lourd.',
            watchOut: 'Sous 500 € HT, passez directement l’achat en 606 (fournitures).'
          }
        ]
      }
    ]
  },
  {
    id: 'transferts',
    label: 'Banque, Exploitant, Emprunts & TVA (Hors résultat)',
    shortLabel: 'Transferts & Banque',
    accent: '#38bdf8',
    bgTint: 'rgba(56, 189, 248, 0.1)',
    borderTint: 'rgba(56, 189, 248, 0.3)',
    icon: 'fa-right-left',
    intro: 'Mouvements de trésorerie qui ne sont ni des recettes imposables ni des dépenses déductibles (ils n’altèrent pas votre bénéfice).',
    groups: [
      {
        title: 'Mouvements de trésorerie & Bilan',
        accounts: [
          {
            compte: '108',
            title: 'Prélèvement personnel / Compte de l’exploitant',
            whenToUse: 'En Micro-entreprise, EI ou Profession Libérale (BNC) : l’argent que vous vous virez pour vivre, ou une dépense perso passée par erreur sur la carte pro.',
            examples: 'Virement mensuel vers votre compte personnel, dépense privée à sortir des charges pro.',
            watchOut: 'En société (SASU/SARL), on n’utilise pas 108 mais 455 (compte courant d’associé) ou 641 (salaire).'
          },
          {
            compte: '455',
            title: 'Compte courant d’associé (Apport / Remboursement CCA)',
            whenToUse: 'En SASU, SARL ou SCI : argent personnel que vous prêtez à votre société/SCI, ou que la société vous rembourse.',
            examples: 'Apport de trésorerie au démarrage d’une SCI ou SASU, remboursement d’une avance faite par un associé.',
            watchOut: 'Ce n’est jamais du chiffre d’affaires : le classer en 455 évite de payer des impôts dessus !'
          },
          {
            compte: '164',
            title: 'Remboursement d’emprunt bancaire (Capital)',
            whenToUse: 'La part « capital » de vos mensualités de crédit pro ou immobilier (le remboursement de la somme empruntée).',
            examples: 'Capital remboursé chaque mois sur un prêt BPI ou un crédit immobilier de SCI.',
            watchOut: 'Seuls les intérêts (661) sont une charge déductible : utilisez « Ventiler » si la mensualité est groupée.'
          },
          {
            compte: '445',
            title: 'TVA (Paiement ou Remboursement DGFiP)',
            whenToUse: 'Prélèvement de la TVA que vous reversez aux impôts (CA3/CA12) ou virement reçu suite à un crédit de TVA.',
            examples: 'Prélèvement mensuel DGFiP TVA, remboursement de crédit de TVA.',
            watchOut: 'Ne pas classer en 635 (impôts & taxes) : la TVA reversée n’est pas une charge.'
          },
          {
            compte: '512',
            title: 'Virement interne / Compte bancaire',
            whenToUse: 'Transfert d’argent entre deux comptes qui appartiennent à la même structure (ex. compte courant ↔ compte épargne ou fonds travaux ALUR).',
            examples: 'Virement vers un livret d’entreprise, transfert vers le compte séparé fonds travaux ALUR en copropriété.',
            watchOut: 'Évite de compter deux fois la même somme en recette ou en dépense.'
          },
          {
            compte: '530',
            title: 'Dépôt ou retrait d’espèces (Caisse)',
            whenToUse: 'Retrait au distributeur pour alimenter la caisse (fond de caisse buvette) ou dépôt d’espèces en banque.',
            examples: 'Retrait 100 € fond de caisse événement, remise d’espèces au guichet.',
            watchOut: 'Uniquement le mouvement de cash entre votre caisse et votre banque.'
          },
          {
            compte: '411',
            title: 'Remboursement ou avance client / adhérent',
            whenToUse: 'Quand vous remboursez un client ou un adhérent suite à une annulation ou un trop-perçu.',
            examples: 'Remboursement d’un stage annulé, remboursement d’un double virement client.',
            watchOut: 'Permet de ne pas gonfler artificiellement vos dépenses.'
          },
          {
            compte: '401',
            title: 'Règlement ou avoir fournisseur',
            whenToUse: 'Avoir ou remboursement reçu d’un fournisseur suite à un retour produit ou erreur de facturation.',
            examples: 'Remboursement Amazon suite à un retour de fournitures.',
            watchOut: 'Pour un achat normal, utilisez directement le compte de charge (606, 6132…).'
          },
          {
            compte: '467',
            title: 'Caution, Dépôt de garantie ou Avance tiers',
            whenToUse: 'Argent versé ou encaissé temporairement qui devra être restitué plus tard.',
            examples: 'Dépôt de garantie versé par un nouveau locataire (SCI), caution versée pour un local.',
            watchOut: 'Une caution reçue d’un locataire n’est pas un loyer imposable (706), mais bien du 467 !'
          },
          {
            compte: '487',
            title: 'Produits constatés d’avance (Saison future / Reports)',
            whenToUse: 'Encaissements reçus cette année mais qui concernent l’exercice ou la saison suivante.',
            examples: 'Pré-inscription encaissée en juin pour la saison sportive qui démarre en septembre.',
            watchOut: 'Évite de gonfler artificiellement le résultat de l’année en cours.'
          }
        ]
      }
    ]
  }
];
