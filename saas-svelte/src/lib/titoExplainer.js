/**
 * Moteur pédagogique Tito ("Tito explique tout")
 * Traduit chaque compte comptable, heuristique et statut juridique
 * en explications claires, questions 1-clic et références légales officielles.
 */

export const TITO_ACCOUNT_KNOWLEDGE = {
  '706': {
    shortTitle: 'Prestations & Honoraires',
    oneClickConfirm: '✓ Oui, recette pro',
    doubtPrompt: 'Encaissement client lié à votre activité professionnelle ?',
    byModel: {
      micro: {
        autoExplain: "Tito a reconnu ce règlement et l'a inscrit dans votre Livre des recettes officiel (compté dans votre plafond TVA).",
        whyLegal: "En micro-entreprise (Art. L123-28 du Code de commerce), chaque encaissement doit être figé chronologiquement à sa date de paiement bancaire.",
        impact: "Augmente votre chiffre d'affaires déclarable à l'URSSAF et consomme votre marge de franchise de TVA."
      },
      bnc: {
        autoExplain: "Tito a reconnu cet honoraire : inscrit au Livre-Journal BNC (ligne AA de votre déclaration 2035).",
        whyLegal: "En BNC (Art. 93 du CGI), seules les recettes effectivement encaissées sur l'année civile constituent votre base imposable.",
        impact: "Intégré aux recettes brutes de votre liasse fiscale Cerfa n° 2035."
      },
      sci: {
        autoExplain: "Tito a reconnu un loyer encaissé : affecté aux revenus fonciers de la SCI (déclaration 2072).",
        whyLegal: "En SCI à l'IR, les loyers hors charges encaissés sont déclarés sur le formulaire Cerfa n° 2072.",
        impact: "Augmente les revenus fonciers répartis entre les associés selon leurs parts."
      },
      copro: {
        autoExplain: "Tito a reconnu un règlement d'appel de fonds copropriétaire.",
        whyLegal: "En syndic bénévole (Loi ALUR), chaque provision versée par un copropriétaire est créditée sur son compte individuel de lot.",
        impact: "Met à jour le solde du copropriétaire avant la régularisation annuelle des charges."
      },
      asso: {
        autoExplain: "Tito a reconnu une recette d'activité : ajoutée au compte de résultat de l'Assemblée Générale.",
        whyLegal: "Les recettes de prestations associatives doivent être suivies pour vérifier la franchise des activités lucratives accessoires (78 596 €).",
        impact: "Augmente les produits d'exploitation du rapport financier annuel."
      },
      tpe: {
        autoExplain: "Tito a reconnu un encaissement client : inscrit au Grand-Livre et au Journal des recettes.",
        whyLegal: "Toute recette encaissée doit être rattachée à une pièce justificative (facture client) pour le fichier FEC.",
        impact: "Augmente votre chiffre d'affaires HT et calcule la TVA collectée correspondante."
      }
    }
  },
  '707': {
    shortTitle: 'Ventes de marchandises',
    oneClickConfirm: '✓ Oui, vente marchandise',
    doubtPrompt: 'Vente de produits, matériaux ou marchandises ?',
    byModel: {
      default: {
        autoExplain: "Tito a classé cet encaissement en vente de marchandises (taux BIC et abattement de 71 % en micro).",
        whyLegal: "Les ventes de biens physiques doivent être séparées des prestations de services car elles bénéficient d'un taux de charges réduit (12,3 % en micro-BIC) et d'un plafond TVA supérieur (85 000 €).",
        impact: "Évite de surpayer vos cotisations URSSAF en isolant la part marchandise."
      }
    }
  },
  '756': {
    shortTitle: 'Cotisations adhérents',
    oneClickConfirm: '✓ Oui, cotisation adhérent',
    doubtPrompt: "Règlement d'adhésion ou de cotisation d'un membre ?",
    byModel: {
      default: {
        autoExplain: "Tito a reconnu une cotisation statutaire et l'a rattachée au registre des adhérents (exonéré d'impôt).",
        whyLegal: "En association Loi 1901 (Art. 261-7-1° du CGI), les cotisations statutaires sont exonérées d'impôts commerciaux et de TVA.",
        impact: "Alimente la trésorerie associative et le bilan financier d'Assemblée Générale."
      }
    }
  },
  '758': {
    shortTitle: 'Dons & Mécénat',
    oneClickConfirm: '✓ Oui, don (Cerfa)',
    doubtPrompt: 'Don manuel ou mécénat ouvrant droit à reçu fiscal Cerfa ?',
    byModel: {
      default: {
        autoExplain: "Tito a classé ce versement en don/mécénat pour le suivi de vos reçus fiscaux Cerfa n° 11580.",
        whyLegal: "Les dons aux organismes d'intérêt général (Art. 200 et 238 bis du CGI) permettent d'éditer un reçu fiscal numéroté.",
        impact: "Exonéré d'impôt et tracé dans le registre des dons."
      }
    }
  },
  '625': {
    shortTitle: 'Déplacements, Carburant & Missions',
    oneClickConfirm: '✓ Oui, déplacement pro',
    doubtPrompt: 'Était-ce un déplacement professionnel (train, carburant, péage, repas) ?',
    byModel: {
      micro: {
        autoExplain: "Classé dans vos frais de déplacement professionnel pour connaître votre rentabilité réelle nette.",
        whyLegal: "En micro-entreprise, les frais de déplacement sont couverts par l'abattement forfaitaire (34 % ou 50 %), mais les suivre permet de vérifier si le régime réel (2035) devient plus avantageux.",
        impact: "Déduit de votre trésorerie nette réelle."
      },
      bnc: {
        autoExplain: "Classé automatiquement en Frais de déplacements & missions déductibles de votre liasse 2035.",
        whyLegal: "En déclaration contrôlée 2035 (Art. 93 du CGI), les déplacements nécessaires à l'exercice de la profession (train, péages, hôtel, repas hors domicile) réduisent directement votre bénéfice imposable.",
        impact: "Diminue votre impôt sur le revenu et vos cotisations URSSAF / caisse."
      },
      default: {
        autoExplain: "Classé dans vos frais de déplacement professionnel (compte 625) avec justificatif à conserver.",
        whyLegal: "Tout déplacement engagé dans l'intérêt direct de la structure est une charge d'exploitation déductible.",
        impact: "Réduit le résultat imposable de votre exercice."
      }
    }
  },
  '6132': {
    shortTitle: 'Logiciels, SaaS & Abonnements Web',
    oneClickConfirm: '✓ Oui, logiciel pro',
    doubtPrompt: 'Cet abonnement logiciel / cloud est-il utilisé pour votre activité ?',
    byModel: {
      default: {
        autoExplain: "Tito a reconnu un abonnement logiciel métier et l'a classé dans vos charges numériques récurrentes.",
        whyLegal: "Les licences logicielles, hébergements web et outils SaaS professionnels sont intégralement déductibles au réel (et inscrits au registre des achats).",
        impact: "Comptabilisé dans vos charges d'exploitation (compte 6132)."
      }
    }
  },
  '606': {
    shortTitle: 'Achats, Fournitures & Petit équipement',
    oneClickConfirm: '✓ Oui, achat pro',
    doubtPrompt: "S'agit-il d'un achat de fournitures ou de matériel professionnel ?",
    byModel: {
      default: {
        autoExplain: "Classé automatiquement dans vos achats de fournitures et matériel professionnel (compte 606).",
        whyLegal: "Tout achat de fournitures ou de petit matériel unitaire inférieur à 500 € HT passe directement en charge déductible sur l'exercice (au-delà de 500 € HT, il s'amortit).",
        impact: "Inscrit au Registre des achats et déduit du résultat d'exploitation."
      }
    }
  },
  '626': {
    shortTitle: 'Téléphonie, Internet & Affranchissement',
    oneClickConfirm: '✓ Oui, télécom pro',
    doubtPrompt: 'Forfait téléphone, fibre ou courrier à usage professionnel ?',
    byModel: {
      default: {
        autoExplain: "Classé automatiquement dans vos frais de télécommunications et d'envoi (compte 626).",
        whyLegal: "Les abonnements téléphoniques, internet et frais postaux professionnels sont déductibles (en totalité ou au prorata de l'usage pro).",
        impact: "Réduit votre bénéfice imposable et permet de récupérer la TVA (20 %) si vous êtes assujetti."
      }
    }
  },
  '627': {
    shortTitle: 'Frais & Commissions bancaires',
    oneClickConfirm: '✓ Oui, frais bancaires',
    doubtPrompt: 'Frais de tenue de compte ou commission bancaire professionnelle ?',
    byModel: {
      default: {
        autoExplain: "Tito a reconnu des frais bancaires et les a classés automatiquement (compte 627 — exonéré de TVA).",
        whyLegal: "Les frais de tenue de compte professionnel et commissions (Stripe, CB, SEPA) sont 100 % déductibles au réel sans TVA.",
        impact: "Affecté directement aux services bancaires de l'exercice."
      }
    }
  },
  '645': {
    shortTitle: 'Cotisations sociales (URSSAF / Caisses)',
    oneClickConfirm: '✓ Oui, charge sociale',
    doubtPrompt: 'Prélèvement de cotisations sociales obligatoires (URSSAF, CARPIMKO, CNBF...) ?',
    byModel: {
      default: {
        autoExplain: "Classé automatiquement dans vos charges sociales obligatoires de l'exercice.",
        whyLegal: "Les cotisations URSSAF et caisses de retraite obligatoires sont déductibles du résultat au régime réel et tracées pour votre bilan.",
        impact: "Met à jour le suivi de vos prélèvements sociaux obligatoires."
      }
    }
  },
  '635': {
    shortTitle: 'Impôts & Taxes (CFE, Taxe foncière)',
    oneClickConfirm: '✓ Oui, impôt / taxe',
    doubtPrompt: 'Prélèvement de CFE, taxe foncière ou taxe professionnelle ?',
    byModel: {
      default: {
        autoExplain: "Classé automatiquement en impôts et taxes déductibles (CFE / Taxe foncière).",
        whyLegal: "La Cotisation Foncière des Entreprises (CFE) et la taxe foncière (en SCI/local pro) sont des charges déductibles du revenu imposable.",
        impact: "Affecté au compte 635 (Impôts et taxes)."
      }
    }
  },
  '613': {
    shortTitle: 'Loyers, Charges locatives & Énergie',
    oneClickConfirm: '✓ Oui, loyer / local pro',
    doubtPrompt: 'Loyer, coworking, redevance de collaboration ou énergie de votre local ?',
    byModel: {
      default: {
        autoExplain: "Classé dans vos charges de locaux, loyers et énergie (compte 613).",
        whyLegal: "Les loyers professionnels, bureaux partagés, redevances de cabinet et factures d'énergie du local sont des charges fixes déductibles.",
        impact: "Intégré aux charges externes de structure."
      }
    }
  },
  '455': {
    shortTitle: "Compte courant d'associé (CCA)",
    oneClickConfirm: '✓ Oui, apport associé',
    doubtPrompt: "Apport ou remboursement de compte courant d'associé ?",
    byModel: {
      default: {
        autoExplain: "Tito a isolé ce flux en Compte Courant d'Associé (non imposable en chiffre d'affaires).",
        whyLegal: "Un apport de trésorerie par un associé (ou son remboursement) est un mouvement financier de bilan (compte 455), jamais une recette imposable.",
        impact: "Protège votre résultat fiscal en évitant d'imposer un apport personnel."
      }
    }
  }
};

/**
 * Retourne l'analyse pédagogique complète de Tito pour une ligne bancaire
 * @param {any} tx
 * @param {string} [entityModel] - 'micro' | 'bnc' | 'asso' | 'tpe' | 'sci' | 'copro'
 * @param {any} [suggestion]
 */
export function getTitoRowExplanation(tx, entityModel = 'micro', suggestion = null) {
  const model = entityModel || 'micro';
  const compte = String(suggestion?.compte || (tx?.compteAttribué !== '699' ? tx?.compteAttribué : '') || '');
  const baseKey = compte.slice(0, 4) in TITO_ACCOUNT_KNOWLEDGE ? compte.slice(0, 4) : compte.slice(0, 3);
  const entry = TITO_ACCOUNT_KNOWLEDGE[baseKey];

  const isCertain =
    tx?.statut === 'attribue' ||
    suggestion?.source === 'regle' ||
    suggestion?.source === 'membre';

  const isHeuristicDoubt = !isCertain && Boolean(suggestion);

  // Cas particulier : matériel > 500 € HT en dépense sur compte 606
  const amount = Number(tx?.debit || tx?.credit || 0);
  if (baseKey === '606' && tx?.debit >= 500) {
    return {
      isCertain,
      isHeuristicDoubt: !isCertain,
      badgeText: isCertain ? 'Attribution automatique' : null,
      oneClickLabel: '✓ Oui, équipement pro (> 500 €)',
      lineExplanation: isCertain
        ? "Équipement professionnel enregistré. Rappel Tito : au régime réel, tout bien > 500 € HT s'amortit sur plusieurs années."
        : "Tito a un doute : achat d'équipement > 500 € ? Cliquez pour le classer en matériel professionnel.",
      whyLegal: "Selon le Bulletin Officiel des Finances Publiques (BOI-BIC-CHG-20-30-10), les équipements unitaires de plus de 500 € HT constituent des immobilisations amortissables.",
      impact: "Déduit progressivement par amortissement (3 ans pour l'informatique, 5 ans pour le mobilier)."
    };
  }

  if (entry) {
    const modelData = entry.byModel[model] || entry.byModel.default || Object.values(entry.byModel)[0];
    const accountLabel = suggestion?.label || entry.shortTitle;
    const accountMention = compte ? `compte ${compte} (${accountLabel})` : accountLabel;

    let explanationText = isCertain ? modelData.autoExplain : `Tito a un doute : ${entry.doubtPrompt}`;
    // Si l'explication ne mentionne pas explicitement le numéro de compte, on l'injecte pédagogiquement
    if (compte && !explanationText.includes(compte)) {
      if (isCertain) {
        explanationText = `Tito a reconnu ce libellé et l'affecte au ${accountMention} : ${explanationText.replace(/^Tito a reconnu [^:]*:\s*/i, '').replace(/^Tito a reconnu [^.]*\.\s*/i, '').replace(/^Classé [^:]*:\s*/i, '')}`;
      } else {
        explanationText = `Tito a un doute : classer au ${accountMention} ?`;
      }
    }

    return {
      compte,
      accountLabel,
      isCertain,
      isHeuristicDoubt,
      badgeText: isCertain ? `Attribution automatique • Compte ${compte}` : null,
      oneClickLabel: entry.oneClickConfirm 
        ? `${entry.oneClickConfirm} (${compte})` 
        : `✓ Oui, ${accountLabel} (${compte})`,
      lineExplanation: explanationText,
      whyLegal: modelData.whyLegal,
      impact: modelData.impact
    };
  }

  // Fallback générique si compte personnalisé ou pas encore de suggestion
  if (suggestion) {
    const accountLabel = suggestion.label || 'Catégorie';
    const accountMention = compte ? `compte ${compte} (${accountLabel})` : accountLabel;
    return {
      compte,
      accountLabel,
      isCertain,
      isHeuristicDoubt,
      badgeText: isCertain ? `Attribution automatique • Compte ${compte}` : null,
      oneClickLabel: `✓ Oui, ${accountLabel} (${compte})`,
      lineExplanation: isCertain
        ? `Tito a reconnu ce libellé et l'affecte au ${accountMention}.`
        : `Tito a un doute : classer cette opération au ${accountMention} ?`,
      whyLegal: "Chaque ligne bancaire doit être rattachée à une catégorie comptable homogène avec pièce justificative conservée.",
      impact: tx?.debit > 0 ? "Comptabilisé dans les dépenses de votre structure." : "Comptabilisé dans les recettes de votre structure."
    };
  }

  return {
    isCertain: false,
    isHeuristicDoubt: false,
    badgeText: null,
    oneClickLabel: null,
    lineExplanation: "Libellé inédit : choisissez sa catégorie une seule fois, Tito la mémorisera pour toutes les prochaines fois.",
    whyLegal: "Tito apprend votre bibliothèque de libellés au fil de l'eau sans jamais inventer un classement incertain.",
    impact: "Une fois classée, cette opération mettra à jour vos registres et votre règle d'attribution."
  };
}

/**
 * Questions rapides contextuelles selon l'écran actif ($activeView) et le statut juridique
 * @param {string} view - 'dashboard' | 'categorize' | 'activity' | 'books' | 'glossary'
 * @param {string} model - 'micro' | 'bnc' | 'asso' | 'tpe' | 'sci' | 'copro'
 */
export function getTitoViewSuggestions(view = 'dashboard', model = 'micro') {
  if (view === 'dashboard') {
    return [
      { icon: 'fa-wallet', label: 'Que signifie ma trésorerie nette ?', question: 'Comment est calculée ma trésorerie nette disponible ?' },
      { icon: 'fa-chart-line', label: 'Mes seuils TVA', question: 'Quels sont mes seuils de TVA ?' },
      { icon: 'fa-receipt', label: 'Comment anticiper mes charges ?', question: 'Comment anticiper mes cotisations et charges à venir ?' }
    ];
  }
  if (view === 'books' || view === 'recettes') {
    return [
      { icon: 'fa-file-invoice', label: 'Quand et comment clôturer ?', question: 'Comment fonctionne la clôture de mon exercice et mon export FEC / Cerfa ?' },
      { icon: 'fa-box-archive', label: 'Quelles pièces conserver ?', question: 'Quels justificatifs dois-je obligatoirement conserver en cas de contrôle ?' },
      { icon: 'fa-scale-balanced', label: 'Mes obligations annuelles', question: 'Quelles sont mes obligations comptables et fiscales annuelles ?' }
    ];
  }
  if (view === 'activity' || view.startsWith('workspace_') || view === 'members' || view === 'sales' || view === 'donations') {
    if (model === 'asso') {
      return [
        { icon: 'fa-hand-holding-heart', label: 'Reçu fiscal Cerfa 11580', question: 'Quelles sont les règles pour émettre un reçu fiscal de don Cerfa 11580 ?' },
        { icon: 'fa-users', label: 'Cotisations adhérents', question: 'Les cotisations adhérents sont-elles exonérées d’impôt et de TVA ?' },
        { icon: 'fa-store', label: 'Seuil activités lucratives', question: 'Quel est le seuil de franchise des activités lucratives en association ?' }
      ];
    }
    return [
      { icon: 'fa-file-signature', label: 'Mentions obligatoires factures', question: 'Quelles mentions sont obligatoires sur mes factures ou quittances ?' },
      { icon: 'fa-chart-line', label: 'Mes seuils TVA', question: 'Quels sont mes seuils de TVA ?' },
      { icon: 'fa-route', label: 'Frais et indemnités km', question: 'Frais de déplacement et repas ?' }
    ];
  }
  // Par défaut ('categorize' et autres)
  return [
    { icon: 'fa-chart-line', label: 'Mes seuils TVA', question: 'Quels sont mes seuils de TVA ?' },
    { icon: 'fa-laptop', label: 'Matériel > 500 €', question: 'Règle des 500 € HT et amortissement ?' },
    { icon: 'fa-car-side', label: 'Déplacements pro', question: 'Frais de déplacement et repas ?' }
  ];
}

/**
 * Répond aux questions de l'utilisateur dans le Chat Tito (verrouillé strictement Comptabilité / Tito)
 * @param {string} userMessage
 * @param {{ model?: string, entityName?: string, focusedTx?: any, focusedExplanation?: any, activeView?: string }} context
 */
export function getLockedTitoChatReply(userMessage, context = {}) {
  const q = (userMessage || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const model = context.model || 'micro';
  const tx = context.focusedTx;

  // 1. GARDE-FOU STRICT : blocage immédiat des sujets hors comptabilité / gestion / Tito
  const offTopicKeywords = [
    'recette cuisine', 'oeuf', 'brouille', 'gateau', 'meteo demain', 'blague', 'poeme',
    'film', 'football', 'match', 'politique', 'horoscope', 'traduis', 'python', 'javascript'
  ];
  if (offTopicKeywords.some(kw => q.includes(kw))) {
    return {
      isBlockedOffTopic: true,
      reply: "Je suis exclusivement le copilote comptable de votre structure sur Tito. Je ne réponds qu'aux questions concernant vos écritures bancaires, vos obligations fiscales, vos charges, vos seuils ou vos clôtures."
    };
  }

  // 2. Si la question porte sur la ligne sélectionnée ("pourquoi", "cette ligne", "comment", "deductible")
  if (tx && (q.includes('ligne') || q.includes('pourquoi') || q.includes('dedu') || q.includes('class') || q.includes('quoi'))) {
    const exp = context.focusedExplanation || getTitoRowExplanation(tx, model);
    return {
      isBlockedOffTopic: false,
      reply: `**Pour l'opération « ${tx.libelle} » (${tx.debit > 0 ? '-' + tx.debit : '+' + tx.credit} €) :**\n\n• **Ce que fait Tito :** ${exp.lineExplanation.replace('Tito a un doute : ', '')}\n• **La règle officielle :** ${exp.whyLegal}\n• **Impact concret :** ${exp.impact}`
    };
  }

  // 2bis. Questions sur la trésorerie nette / anticipation des charges (Dashboard)
  if (q.includes('tresorerie') || q.includes('anticiper') || q.includes('cotisation') || q.includes('urssaf')) {
    if (model === 'micro') {
      return {
        isBlockedOffTopic: false,
        reply: "**Trésorerie nette & URSSAF (Micro-entreprise) :**\nSur chaque encaissement client, prévoyez environ **23,1 % à 24,6 %** en prestations de services / BNC (ou **12,3 %** en achat-revente) pour l'URSSAF. Tito distingue votre solde bancaire brut de ce qu'il vous reste réellement après charges."
      };
    }
    if (model === 'bnc') {
      return {
        isBlockedOffTopic: false,
        reply: "**Trésorerie & Charges sociales (Profession Libérale BNC) :**\nEn déclaration contrôlée 2035, vos cotisations (URSSAF, CARPIMKO, CIPAV, CNBF) sont calculées sur votre **bénéfice net** (Recettes − Dépenses déductibles). Conservez environ **30 % à 35 %** de votre excédent sur un sous-compte dédié aux régularisations."
      };
    }
    return {
      isBlockedOffTopic: false,
      reply: "**Lecture de votre Trésorerie sur Tito :**\nVotre tableau de bord affiche votre **solde bancaire réel** pointé avec vos écritures importées, ainsi que la répartition exacte entre vos encaissements validés et vos dépenses d'exploitation."
    };
  }

  // 2ter. Questions sur les factures, reçus fiscaux Cerfa 11580 ou justificatifs
  if (q.includes('cerfa 11580') || q.includes('recu fiscal') || q.includes('don')) {
    return {
      isBlockedOffTopic: false,
      reply: "**Reçu fiscal de don (Cerfa n° 11580*05) :**\nPour ouvrir droit à réduction d'impôt (66 % pour les particuliers, 60 % pour les entreprises — Art. 200 et 238 bis du CGI), le don doit être consenti à titre gratuit, **sans contrepartie directe ou indirecte** (contrairement à une cotisation donnant accès à un service)."
    };
  }

  if (q.includes('justificatif') || q.includes('conserver') || q.includes('controle') || q.includes('facture')) {
    return {
      isBlockedOffTopic: false,
      reply: "**Conservation des pièces justificatives (Art. L123-22 du Code de commerce & L102 B du LPF) :**\n• Toute dépense professionnelle doit être appuyée par une **facture nominative** (un simple ticket CB sans détail ni TVA ne suffit pas au-delà des tolérances).\n• Durée légale d'archivage : **10 ans** au plan comptable (6 ans minimum au plan fiscal)."
    };
  }

  // 3. Questions sur la TVA / Seuils
  if (q.includes('tva') || q.includes('seuil') || q.includes('plafond') || q.includes('lucrativ')) {
    if (model === 'asso') {
      return {
        isBlockedOffTopic: false,
        reply: "**Règle TVA Association Loi 1901 :** Vos cotisations, dons et subventions sont 100 % exonérés de TVA. Vos activités lucratives accessoires (buvette, sponsoring, entrées) sont exonérées jusqu'à **78 596 € / an** (Art. 261-7-1° du CGI)."
      };
    }
    if (model === 'sci') {
      return {
        isBlockedOffTopic: false,
        reply: "**Règle TVA SCI Familiale (IR) :** Les locations nues à usage d'habitation sont exonérées de TVA. Vos loyers encaissés et charges se déclarent chaque année sur le formulaire **Cerfa n° 2072**."
      };
    }
    return {
      isBlockedOffTopic: false,
      reply: "**Seuils de franchise de TVA (Art. 293 B du CGI) :**\n• **Prestations de services / BNC :** 37 500 € (seuil majoré à 41 250 €).\n• **Ventes / Marchandises :** 85 000 € (seuil majoré à 93 500 €).\nTant que vos encaissements restent sous le seuil, vous ne facturez pas la TVA (mention obligatoire : *« TVA non applicable, art. 293 B du CGI »*)."
    };
  }

  // 4. Questions sur les frais / déplacements / amortissement (> 500 €)
  if (q.includes('500') || q.includes('amorti') || q.includes('materiel') || q.includes('ordinateur')) {
    return {
      isBlockedOffTopic: false,
      reply: "**Règle des 500 € HT (BOFiP) :**\n• **Moins de 500 € HT l'unité :** passe immédiatement en charge déductible (compte 606) sur l'année.\n• **Plus de 500 € HT l'unité (ordinateur, boîtier, machine) :** doit être immobilisé et amorti sur sa durée d'usage (généralement 3 ans pour le matériel informatique)."
    };
  }

  if (q.includes('deplacement') || q.includes('kilometr') || q.includes('sncf') || q.includes('carburant') || q.includes('repas')) {
    return {
      isBlockedOffTopic: false,
      reply: "**Frais de déplacement & repas :**\n• En **BNC (2035) / Société**, les billets de train, péages et repas professionnels hors domicile sont déductibles sur justificatif. Pour la voiture, vous choisissez entre les frais réels ou le **barème kilométrique officiel de la DGFiP**.\n• En **Micro-entreprise**, ces frais sont déjà compris dans votre abattement forfaitaire (34 % ou 50 %)."
    };
  }

  // 5. Questions sur la clôture / Grand-Livre / FEC / Cerfa / Obligations
  if (q.includes('clotur') || q.includes('fec') || q.includes('grand livre') || q.includes('2035') || q.includes('2072') || q.includes('cerfa') || q.includes('obligation')) {
    return {
      isBlockedOffTopic: false,
      reply: "**Vos livrables & clôture dans Tito :**\nUne fois toutes vos lignes bancaires validées (onglet *Attribuer (0)*), rendez-vous dans **Obligation / Grand-Livre** pour exporter en 1 clic votre registre officiel, votre fichier FEC ou votre synthèse de déclaration (2035, 2072, Cerfa) et figer votre exercice."
    };
  }

  // 6. Réponse pédagogique par défaut centrée sur l'accompagnement Tito
  return {
    isBlockedOffTopic: false,
    reply: `Je suis Tito, votre copilote comptable (calibré sur votre structure **${model.toUpperCase()}**).\n\nPosez-moi une question précise sur :\n• **Une ligne bancaire** (cliquez sur *« Analyse Tito »* sur n'importe quelle ligne)\n• **Votre trésorerie nette & vos seuils de TVA**\n• **La déduction d'un frais** (déplacement, repas, matériel > 500 €)\n• **Vos livrables obligatoires** (Livre des recettes, 2035, 2072, Cerfa, FEC, Clôture).`
  };
}

