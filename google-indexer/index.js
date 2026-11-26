import fs from 'fs';
import readline from 'readline';
import { google } from 'googleapis';

const KEY_FILE = './service_account.json';
const URLS_FILE = './urls.txt';

if (!fs.existsSync(KEY_FILE)) {
  console.error('\n❌ ERREUR : Fichier service_account.json introuvable !');
  console.error('👉 Veuillez télécharger votre clé JSON depuis Google Cloud Console et la placer sous le nom "service_account.json" dans ce dossier.\n');
  process.exit(1);
}

if (!fs.existsSync(URLS_FILE)) {
  console.error('\n❌ ERREUR : Fichier urls.txt introuvable !');
  console.error('👉 Veuillez créer un fichier "urls.txt" contenant une URL par ligne.\n');
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ['https://www.googleapis.com/auth/indexing'],
});

async function publishUrl(indexing, url) {
  try {
    const response = await indexing.urlNotifications.publish({
      requestBody: {
        url: url.trim(),
        type: 'URL_UPDATED',
      },
    });
    console.log(`✅ [OK ${response.status}] Soumis : ${url}`);
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.error(`❌ [ERREUR] ${url} : ${errorMsg}`);
    if (error.response?.status === 403) {
      console.error(`💡 Note 403 : Vérifiez que l'adresse e-mail du compte de service (dans service_account.json) a bien les droits "Propriétaire" dans Google Search Console pour la propriété de ce domaine.`);
    }
  }
}

async function run() {
  console.log('🚀 Démarrage de la soumission Google Indexing API...\n');
  
  const client = await auth.getClient();
  const indexing = google.indexing({ version: 'v3', auth: client });

  const fileStream = fs.createReadStream(URLS_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let count = 0;
  for await (const line of rl) {
    const url = line.trim();
    if (url && url.startsWith('http')) {
      count++;
      await publishUrl(indexing, url);
      // Temporisation de 300ms pour respecter la limite de fréquence (rate limit)
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  console.log(`\n🎉 Traitement terminé : ${count} URL(s) envoyée(s) à Googlebot.`);
}

run();
