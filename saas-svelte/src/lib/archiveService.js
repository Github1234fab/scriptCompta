/**
 * Service de génération de l'Archive Légale Complète Tito (Format ZIP)
 * Permet la portabilité des données et le respect de l'obligation de conservation légale de 10 ans.
 * 100% exécuté côté navigateur (zéro dépendance externe).
 */
import { Categorizer } from './categorizer.js';

// Table CRC-32
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
})();

function crc32(bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

/**
 * Génère un Blob ZIP standard (PKZIP 2.0 uncompressed / stored)
 * Compatible avec tous les OS (macOS, Windows, Linux, iOS, Android)
 * @param {{ name: string, data: string | Uint8Array }[]} files
 * @returns {Blob}
 */
export function buildZipBlob(files) {
  const encoder = new TextEncoder();
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (Math.floor(now.getSeconds() / 2))) & 0xFFFF;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const fileBytes = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(fileBytes);
    const size = fileBytes.length;

    // --- LOCAL FILE HEADER (30 octets + nom) ---
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);  // Local file header signature
    lv.setUint16(4, 10, true);          // Version needed (1.0)
    lv.setUint16(6, 0x0800, true);      // General purpose bit flag (UTF-8)
    lv.setUint16(8, 0, true);           // Compression (0 = stored)
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);       // Compressed size
    lv.setUint32(22, size, true);       // Uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);          // Extra field length
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader);
    localParts.push(fileBytes);

    // --- CENTRAL DIRECTORY RECORD (46 octets + nom) ---
    const cdHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cdHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);  // Central dir signature
    cv.setUint16(4, 20, true);          // Version made by
    cv.setUint16(6, 10, true);          // Version needed
    cv.setUint16(8, 0x0800, true);      // UTF-8 flag
    cv.setUint16(10, 0, true);          // Compression 0
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);          // Extra field length
    cv.setUint16(32, 0, true);          // Comment length
    cv.setUint16(34, 0, true);          // Disk number start
    cv.setUint16(36, 0, true);          // Internal attributes
    cv.setUint32(38, 0, true);          // External attributes
    cv.setUint32(42, offset, true);     // Relative offset of local header
    cdHeader.set(nameBytes, 46);

    centralParts.push(cdHeader);
    offset += localHeader.length + fileBytes.length;
  }

  // --- END OF CENTRAL DIRECTORY (EOCD : 22 octets) ---
  const cdSize = centralParts.reduce((acc, p) => acc + p.length, 0);
  const cdOffset = offset;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);   // EOCD signature
  ev.setUint16(4, 0, true);            // Disk number
  ev.setUint16(6, 0, true);            // Disk with CD
  ev.setUint16(8, files.length, true); // Entries on this disk
  ev.setUint16(10, files.length, true);// Total entries
  ev.setUint32(12, cdSize, true);      // Size of central dir
  ev.setUint32(16, cdOffset, true);    // Offset of central dir
  ev.setUint16(20, 0, true);           // Comment length

  return new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' });
}

/**
 * Déclenche le téléchargement du Blob
 * @param {Blob} blob
 * @param {string} filename
 */
export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Construit l'archive complète pour une entité et sa liste d'écritures
 * @param {any} entity
 * @param {any[]} transactionsList
 * @returns {{ filename: string, count: number }}
 */
export function downloadCompleteArchive(entity, transactionsList = []) {
  const model = entity?.model || 'micro';
  const entityName = (entity?.name || 'Ma_Structure').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const now = new Date();
  const year = now.getFullYear();
  const dateSuffix = now.toISOString().slice(0, 10).replace(/-/g, '');
  const cleanSiren = entity?.siret ? String(entity.siret).replace(/\D/g, '').slice(0, 9) : '';

  const activeTxList = (transactionsList || [])
    .filter(t => (!t.entityId || t.entityId === entity.id) && t.compteAttribué !== '699' && t.statut === 'attribue')
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const files = [];

  // 1. LISEZ-MOI LÉGAL & PORTABILITÉ
  const readme = `============================================================
ARCHIVE LÉGALE TITO - PORTABILITÉ DES DONNÉES (ARTICLE 8 CGU)
============================================================
Structure : ${entity?.name || 'Sans nom'}
Modèle de gestion : ${model.toUpperCase()}
SIRET : ${entity?.siret || 'Non renseigné'}
Date de constitution de l'archive : ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR')}
Nombre d'écritures comptables archivées : ${activeTxList.length}

RAPPEL LÉGAL DE CONSERVATION :
Conformément à l'article L. 123-22 du Code de commerce et à l'article L. 102 B 
du Livre des procédures fiscales (LPF), vous devez obligatoirement conserver 
cette archive numérique sur votre ordinateur, disque externe ou serveur 
sécurisé pendant une durée minimale de DIX (10) ANS.

CONTENU DE L'ARCHIVE :
- Fichier des Écritures Comptables officiel (Norme DGFiP A.47 A-1)
- Registres légaux et documents comptables spécifiques à votre statut
- Historique intégral des écritures bancaires validées

Cette archive garantit la stricte portabilité de vos données financières
suite à la résiliation ou clôture de votre compte Tito.
============================================================
`;
  files.push({ name: 'LISEZ_MOI_ARCHIVE_LEGALE.txt', data: readme });

  // 2. FICHIER DES ÉCRITURES COMPTABLES (FEC DGFiP)
  let fec = 'JournalCode;JournalLib;EcritureNum;EcritureDate;CompteNum;CompteLib;PieceRef;PieceDate;EcritureLib;Debit;Credit\n';
  let idx = 1;
  activeTxList.forEach(tx => {
    const date = (tx.date || '').replace(/-/g, '');
    const piece = `PIECE-${idx}`;
    const compte = tx.compteAttribué || '471';
    const libCompte = Categorizer.obtenirLibelleCompte(compte) || 'Compte';
    const libelleClean = (tx.libelle || '').replace(/;/g, ' ');

    if (tx.debit > 0) {
      fec += `JNL;Journal General;${idx};${date};${compte};${libCompte};${piece};${date};${libelleClean};${Number(tx.debit).toFixed(2)};0.00\n`;
      fec += `JNL;Journal General;${idx};${date};512;Banque;${piece};${date};${libelleClean};0.00;${Number(tx.debit).toFixed(2)}\n`;
    } else if (tx.credit > 0) {
      fec += `JNL;Journal General;${idx};${date};512;Banque;${piece};${date};${libelleClean};${Number(tx.credit).toFixed(2)};0.00\n`;
      fec += `JNL;Journal General;${idx};${date};${compte};${libCompte};${piece};${date};${libelleClean};0.00;${Number(tx.credit).toFixed(2)}\n`;
    }
    idx++;
  });
  const fecName = cleanSiren ? `${cleanSiren}FEC${dateSuffix}.csv` : `FEC_${entityName}_${dateSuffix}.csv`;
  files.push({ name: fecName, data: fec });

  // 3. REGISTRES SPÉCIFIQUES SELON LE MODÈLE
  if (model === 'micro') {
    // Livre des Recettes
    let csvRecettes = "N° Ordre;Date;Référence;Client / Origine;Nature;Mode Règlement;Montant Encaissé (€)\n";
    let rIdx = 1;
    activeTxList.filter(t => t.credit > 0).forEach(r => {
      const dateStr = new Date(r.date).toLocaleDateString('fr-FR');
      const nature = Categorizer.obtenirLibelleCompte(r.compteAttribué) || 'Prestation / Vente';
      csvRecettes += `${rIdx};${dateStr};"${r.reference || `REC-${1000 + rIdx}`}";"${(r.libelle || '').replace(/"/g, '""')}";"${nature}";"${r.typeOperation || 'Virement'}";${Number(r.credit).toFixed(2)}\n`;
      rIdx++;
    });
    files.push({ name: `Livre_des_Recettes_${entityName}_${year}.csv`, data: csvRecettes });

    // Registre des Achats
    let csvAchats = "N° Ordre;Date;Fournisseur / Tiers;Nature Dépense;Mode Règlement;Montant Payé (€)\n";
    let aIdx = 1;
    activeTxList.filter(t => t.debit > 0).forEach(a => {
      const dateStr = new Date(a.date).toLocaleDateString('fr-FR');
      const nature = Categorizer.obtenirLibelleCompte(a.compteAttribué) || 'Achat professionnel';
      csvAchats += `${aIdx};${dateStr};"${(a.libelle || '').replace(/"/g, '""')}";"${nature}";"${a.typeOperation || 'Carte / Prélèvement'}";${Number(a.debit).toFixed(2)}\n`;
      aIdx++;
    });
    files.push({ name: `Registre_des_Achats_${entityName}_${year}.csv`, data: csvAchats });
  } else if (model === 'bnc' || model === 'sci') {
    // Livre-journal Recettes et Dépenses
    let csvRd = "Date;Opération;Numéro Compte;Catégorie;Sens;Recette (€);Dépense (€)\n";
    activeTxList.forEach(tx => {
      const dateStr = new Date(tx.date).toLocaleDateString('fr-FR');
      const cat = Categorizer.obtenirLibelleCompte(tx.compteAttribué) || 'Catégorie';
      const sens = tx.credit > 0 ? 'RECETTE' : 'DÉPENSE';
      const rec = tx.credit > 0 ? Number(tx.credit).toFixed(2) : '0.00';
      const dep = tx.debit > 0 ? Number(tx.debit).toFixed(2) : '0.00';
      csvRd += `${dateStr};"${(tx.libelle || '').replace(/"/g, '""')}";${tx.compteAttribué};"${cat}";${sens};${rec};${dep}\n`;
    });
    files.push({ name: `Livre_Recettes_Depenses_${entityName}_${year}.csv`, data: csvRd });
  } else {
    // TPE / Asso / Copro : Grand-Livre + Journal
    let csvJournal = "Date;N° Pièce;Compte;Libellé Compte;Description;Débit (€);Crédit (€)\n";
    let jIdx = 1;
    activeTxList.forEach(tx => {
      const dateStr = new Date(tx.date).toLocaleDateString('fr-FR');
      const libCompte = Categorizer.obtenirLibelleCompte(tx.compteAttribué) || 'Compte';
      const desc = `"${(tx.libelle || '').replace(/"/g, '""')}"`;
      if (tx.debit > 0) {
        csvJournal += `${dateStr};PIECE-${jIdx};${tx.compteAttribué};"${libCompte}";${desc};${Number(tx.debit).toFixed(2)};0.00\n`;
        csvJournal += `${dateStr};PIECE-${jIdx};512;"Banque";${desc};0.00;${Number(tx.debit).toFixed(2)}\n`;
      } else if (tx.credit > 0) {
        csvJournal += `${dateStr};PIECE-${jIdx};512;"Banque";${desc};${Number(tx.credit).toFixed(2)};0.00\n`;
        csvJournal += `${dateStr};PIECE-${jIdx};${tx.compteAttribué};"${libCompte}";${desc};0.00;${Number(tx.credit).toFixed(2)}\n`;
      }
      jIdx++;
    });
    files.push({ name: `Livre_Journal_${entityName}_${year}.csv`, data: csvJournal });
  }

  // 4. HISTORIQUE INTÉGRAL DE TOUTES LES LIGNES BANCAIRES
  let allCsv = "ID;Date;Libellé;Débit (€);Crédit (€);Compte Attribué;Catégorie;Statut;Type\n";
  (transactionsList || [])
    .filter(t => !t.entityId || t.entityId === entity.id)
    .forEach(t => {
      const cat = Categorizer.obtenirLibelleCompte(t.compteAttribué) || '';
      allCsv += `"${t.id || ''}";"${t.date || ''}";"${(t.libelle || '').replace(/"/g, '""')}";${Number(t.debit || 0).toFixed(2)};${Number(t.credit || 0).toFixed(2)};"${t.compteAttribué || ''}";"${cat}";"${t.statut || ''}";"${t.typeOperation || ''}"\n`;
    });
  files.push({ name: `Toutes_Ecritures_Bancaires_${entityName}.csv`, data: allCsv });

  // 5. CRÉATION DU BLOB ZIP ET TÉLÉCHARGEMENT
  const zipBlob = buildZipBlob(files);
  const zipFilename = `Archive_Legale_Tito_${entityName}_${dateSuffix}.zip`;
  triggerBlobDownload(zipBlob, zipFilename);

  return { filename: zipFilename, count: files.length };
}

