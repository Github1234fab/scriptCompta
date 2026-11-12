<script>
  import { showCguModal, closeCguModal } from '../lib/store.js';
</script>

{#if $showCguModal}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div 
    class="modal-backdrop" 
    onclick={closeCguModal}
    style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); z-index: 999999; display: flex; align-items: center; justify-content: center; padding: 20px;"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div 
      class="modal-container" 
      onclick={(e) => e.stopPropagation()}
      style="background: #0f172a; color: #f8fafc; border: 1.5px solid rgba(255, 255, 255, 0.14); border-radius: 16px; width: 100%; max-width: 820px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);"
    >
      <!-- HEADER -->
      <div style="padding: 20px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: space-between; background: #080e1e; border-top-left-radius: 16px; border-top-right-radius: 16px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(37, 99, 235, 0.15); border: 1px solid rgba(37, 99, 235, 0.4); display: flex; align-items: center; justify-content: center; color: #38bdf8; font-size: 1.1rem;">
            <i class="fa-solid fa-scale-balanced"></i>
          </div>
          <div>
            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: #ffffff;">
              Conditions Générales d'Utilisation (CGU)
            </h3>
            <span style="font-size: 0.76rem; color: #94a3b8;">
              Cadre juridique, responsabilités & conformité • Version 1.2
            </span>
          </div>
        </div>

        <button 
          type="button" 
          onclick={closeCguModal}
          style="background: rgba(255, 255, 255, 0.08); border: none; color: #cbd5e1; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; font-size: 1.1rem; display: flex; align-items: center; justify-content: center;"
          title="Fermer"
        >
          &times;
        </button>
      </div>

      <!-- BODY SCROLLABLE -->
      <div style="padding: 24px; overflow-y: auto; line-height: 1.65; font-size: 0.88rem; color: #cbd5e1; display: flex; flex-direction: column; gap: 20px;">
        
        <!-- ENCADRÉ CADRE LÉGAL -->
        <div style="background: rgba(37, 99, 235, 0.1); border: 1.5px solid rgba(56, 189, 248, 0.35); border-radius: 12px; padding: 16px 18px;">
          <strong style="color: #38bdf8; font-size: 0.92rem; display: block; margin-bottom: 6px;">
            Positionnement légal & Non-substitution d'expertise comptable
          </strong>
          <p style="margin: 0; font-size: 0.84rem; color: #e2e8f0; line-height: 1.55;">
            Le logiciel est un outil informatique d'aide à la gestion, d'automatisation et de pré-comptabilité (Ordonnance n° 45-2138 du 19 septembre 1945). Le logiciel n'est pas un cabinet d'expertise comptable et ne réalise aucune prestation d'expertise comptable, d'attestation ou de certification de comptes. L'Utilisateur conserve l'entière et exclusive responsabilité de ses écritures et déclarations officielles.
          </p>
        </div>

        <div>
          <h4 style="color: #ffffff; font-size: 0.95rem; margin: 0 0 8px 0; font-weight: 800;">
            Article 1. Objet du Service
          </h4>
          <p style="margin: 0;">
            La plateforme met à disposition de l'Utilisateur des outils d'importation de relevés bancaires, de règles d'attribution automatisées, d'assistance pédagogique (« Analyse Tito »), de pointage de trésorerie et d'export de documents normés (Livre des recettes, Registre des achats, Grand-Livre, Balance, Fichier FEC).
          </p>
        </div>

        <div>
          <h4 style="color: #ffffff; font-size: 0.95rem; margin: 0 0 8px 0; font-weight: 800;">
            Article 2. Validation par l'Utilisateur
          </h4>
          <p style="margin: 0;">
            Les règles d'attribution et suggestions fournies par le système sont des aides à la décision. L'Utilisateur est seul responsable de vérifier et valider l'affectation finale de chaque opération à un compte comptable. Aucune écriture n'est définitivement actée sans la confirmation de l'Utilisateur.
          </p>
        </div>

        <div>
          <h4 style="color: #ffffff; font-size: 0.95rem; margin: 0 0 8px 0; font-weight: 800;">
            Article 3. Conformité des Exports Légaux
          </h4>
          <p style="margin: 0;">
            Les exports générés (FEC selon l'Art. L. 47 A-I du LPF, Livre des recettes micro-entreprise selon l'Art. L. 123-28 du Code de commerce, Reçus Cerfa 11580*05) sont conçus pour répondre aux spécifications techniques des administrations fiscales et des experts-comptables. Leur validité dépend de l'exhaustivité et de la conformité des données importées et validées par l'Utilisateur.
          </p>
        </div>

        <div>
          <h4 style="color: #ffffff; font-size: 0.95rem; margin: 0 0 8px 0; font-weight: 800;">
            Article 4. Conservation des Pièces Justificatives
          </h4>
          <p style="margin: 0;">
            Conformément aux articles L. 123-22 du Code de commerce et L. 102 B du Livre des procédures fiscales, l'Utilisateur doit conserver toutes ses pièces justificatives originales (factures d'achat, de vente, notes de frais) pendant une durée minimale de 10 ans.
          </p>
        </div>

        <div>
          <h4 style="color: #ffffff; font-size: 0.95rem; margin: 0 0 8px 0; font-weight: 800;">
            Article 5. Sécurité & Propriété des Données (RGPD)
          </h4>
          <p style="margin: 0;">
            L'Utilisateur demeure le seul et unique propriétaire de ses données financières. Les données sont chiffrées et hébergées au sein de serveurs sécurisés situés dans l'Union Européenne. Aucune donnée n'est cédée, commercialisée ou exploitée à des fins publicitaires.
          </p>
        </div>

      </div>

      <!-- FOOTER -->
      <div style="padding: 16px 24px; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: space-between; background: #080e1e; border-bottom-left-radius: 16px; border-bottom-right-radius: 16px;">
        <span style="font-size: 0.78rem; color: #64748b;">
          Droit applicable : Droit français
        </span>
        <button 
          type="button" 
          onclick={closeCguModal}
          style="padding: 8px 20px; background: #2563eb; color: #ffffff; border: none; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer;"
        >
          J'ai compris
        </button>
      </div>

    </div>
  </div>
{/if}

