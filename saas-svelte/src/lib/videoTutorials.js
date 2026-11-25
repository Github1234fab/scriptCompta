/**
 * Catalogue des tutoriels vidéo courts de Tito.
 *
 * Comment ajouter une vidéo une fois tournée :
 * - Option A (MP4 local) : placez le fichier dans `saas-svelte/public/videos/tuto-accueil.mp4`
 *   et renseignez `videoUrl: '/videos/tuto-accueil.mp4'`
 * - Option B (YouTube / Vimeo / Loom) : collez directement l'URL de partage
 *   (ex. 'https://youtu.be/xxxxx' ou 'https://www.loom.com/share/xxxxx'),
 *   le lecteur la convertira automatiquement en iframe intégrée.
 */
export const VIDEO_TUTORIALS = [
  {
    id: 'structures',
    view: 'dashboard',
    title: 'Gérer & créer vos structures',
    shortLabel: 'Mes structures',
    duration: '0:30',
    icon: 'fa-layer-group',
    summary: 'Basculer entre plusieurs activités (Micro, Asso, TPE, SCI) ou créer un nouvel espace en 1 clic.',
    videoUrl: '', // ex: '/videos/01-structures.mp4'
    keyPoints: [
      'Ouvrir le sélecteur en haut de la barre latérale',
      'Passer d\'une structure à l\'autre sans mélanger les comptes',
      'Créer une nouvelle structure adaptée à votre statut'
    ]
  },
  {
    id: 'dashboard',
    view: 'dashboard',
    title: 'Accueil : votre tableau de bord',
    shortLabel: 'Accueil',
    duration: '0:45',
    icon: 'fa-house',
    summary: 'Lire votre vrai disponible, vos charges estimées et vos jauges de seuils sans jargon.',
    videoUrl: '', // ex: '/videos/02-accueil.mp4'
    keyPoints: [
      'Consulter vos recettes, dépenses et votre vrai net disponible',
      'Surveiller vos plafonds de CA et de franchise TVA en direct',
      'Repérer les opérations bancaires en attente de tri'
    ]
  },
  {
    id: 'categorize',
    view: 'categorize',
    title: 'Attribution : import CSV & tri rapide',
    shortLabel: 'Attribution',
    duration: '0:55',
    icon: 'fa-arrows-split-up-and-left',
    summary: 'Glisser votre relevé bancaire CSV et laisser le dictionnaire intelligent classer vos opérations.',
    videoUrl: '', // ex: '/videos/03-attribution.mp4'
    keyPoints: [
      'Glisser-déposer le relevé CSV de votre banque (zéro mot de passe)',
      'Attribuer chaque ligne en français clair en 1 clic',
      'Mémorisation automatique pour les mois suivants'
    ]
  },
  {
    id: 'activity',
    view: 'activity',
    title: 'Adhérents, Cotisations & Reçus CERFA',
    shortLabel: 'Adhérents & Dons',
    duration: '0:45',
    icon: 'fa-users',
    onlyForModels: ['asso'],
    summary: 'Suivre vos membres, vos ventes et éditer vos reçus fiscaux de dons CERFA 11580*05.',
    videoUrl: '', // ex: '/videos/04-association.mp4'
    keyPoints: [
      'Suivre les adhésions et cotisations à jour',
      'Générer un reçu fiscal CERFA numéroté en 1 clic',
      'Ventiler les ventes, buvettes et événements'
    ]
  },
  {
    id: 'books',
    view: 'books',
    title: 'Obligations : registres & exports officiels',
    shortLabel: 'Obligations',
    duration: '0:50',
    icon: 'fa-scale-balanced',
    summary: 'Consulter et exporter vos registres légaux (Livre des recettes, Grand-Livre, FEC, Bilan).',
    videoUrl: '', // ex: '/videos/05-obligations.mp4'
    keyPoints: [
      'Vérifier vos dates d\'exercice fiscal en haut de l\'écran',
      'Consulter vos registres générés automatiquement',
      'Exporter en 1 clic pour l\'URSSAF, l\'AG ou l\'expert-comptable'
    ]
  },
  {
    id: 'chat',
    view: 'dashboard',
    title: 'Posez vos questions à Tito',
    shortLabel: 'Copilote Tito',
    duration: '0:25',
    icon: 'fa-comment-dots',
    summary: 'Obtenir une réponse claire et sans jargon en quelques secondes dès que vous avez un doute.',
    videoUrl: '', // ex: '/videos/06-questions.mp4'
    keyPoints: [
      'Ouvrir le tiroir « Posez vos questions » depuis le menu',
      'Consulter les réponses instantanées adaptées à votre écran',
      'Contacter directement l\'équipe Tito si besoin'
    ]
  }
];

/**
 * Retourne la liste des tutoriels pertinents pour le modèle comptable actif.
 * @param {string} accountingModel
 */
export function getTutorialsForModel(accountingModel) {
  return VIDEO_TUTORIALS.filter((t) => !t.onlyForModels || t.onlyForModels.includes(accountingModel));
}

/**
 * Convertit une URL vidéo (YouTube, Vimeo, Loom ou MP4) en configuration de lecteur.
 * @param {string} url
 * @returns {{ type: 'empty' | 'iframe' | 'video', src: string }}
 */
export function resolveVideoSource(url) {
  const clean = (url || '').trim();
  if (!clean) return { type: 'empty', src: '' };

  // YouTube (watch?v=... ou youtu.be/...)
  const ytMatch = clean.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return { type: 'iframe', src: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0&modestbranding=1` };
  }

  // Vimeo
  const vimeoMatch = clean.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    return { type: 'iframe', src: `https://player.vimeo.com/video/${vimeoMatch[1]}?dnt=1` };
  }

  // Loom
  const loomMatch = clean.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
  if (loomMatch) {
    return { type: 'iframe', src: `https://www.loom.com/embed/${loomMatch[1]}` };
  }

  // Fichier vidéo direct (.mp4, .webm, .mov, etc.)
  return { type: 'video', src: clean };
}

