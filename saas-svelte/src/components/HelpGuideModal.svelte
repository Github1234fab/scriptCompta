<script>
  import { fade, scale } from 'svelte/transition';
  import { showHelpGuideModal, helpGuideSection, closeHelpGuide } from "../lib/store.js";

  /** @type {{ startTour?: () => void }} */
  let { startTour } = $props();

  function handleStartTour() {
    closeHelpGuide();
    if (startTour) {
      setTimeout(() => startTour(), 200);
    }
  }

  function switchToIntro() {
    $helpGuideSection = 'intro';
  }

  function switchToSection(secId) {
    $helpGuideSection = secId;
  }
</script>

{#if $showHelpGuideModal}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div 
    class="modal-backdrop" 
    onclick={closeHelpGuide}
    transition:fade={{ duration: 180 }}
    style="position: fixed; inset: 0; background: rgba(2, 6, 23, 0.78); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;"
  >
    <!-- MODALE SPÉCIFIQUE : ACCUEIL -->
    {#if $helpGuideSection === 'accueil'}
      <div 
        class="help-modal-card" 
        onclick={(e) => e.stopPropagation()}
        transition:scale={{ duration: 200, start: 0.96 }}
        style="width: 100%; max-width: 860px; max-height: 90vh; background: #0f172a; border-radius: 18px; box-shadow: 0 25px 60px rgba(0,0,0,0.55); display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.12);"
      >
        <!-- En-tête épuré sans texte superflu -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 22px 28px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: #0f172a;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0; border: 1px solid rgba(59, 130, 246, 0.3);">
              <i class="fa-solid fa-house"></i>
            </div>
            <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #ffffff; font-family: var(--font-title, sans-serif); letter-spacing: -0.01em;">
              Le panorama de votre structure
            </h2>
          </div>
          <button 
            type="button" 
            onclick={closeHelpGuide}
            aria-label="Fermer"
            style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); width: 34px; height: 34px; border-radius: 8px; font-size: 0.95rem; color: #cbd5e1; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;"
            onmouseenter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; e.currentTarget.style.color = '#ffffff'; }}
            onmouseleave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.color = '#cbd5e1'; }}
          >
            ✕
          </button>
        </div>

        <!-- Corps avec texte soigné et 3 cartes disposées en ROW -->
        <div style="padding: 26px 28px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px;">
          <p style="margin: 0; font-size: 0.95rem; color: #cbd5e1; line-height: 1.6;">
            Dans cet onglet, vous disposez d'un panorama complet de votre structure : votre trésorerie en temps réel et l'accès direct à toutes vos opérations.
          </p>

          <!-- 3 Cartes disposées en ROW (grille de 3 colonnes) -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;">
            <!-- Carte 1 : Trésorerie -->
            <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; display: flex; align-items: center; justify-content: center; font-size: 1rem; border: 1px solid rgba(59, 130, 246, 0.25);">
                <i class="fa-solid fa-wallet"></i>
              </div>
              <div>
                <strong style="font-size: 0.92rem; color: #ffffff; display: block; margin-bottom: 6px; font-weight: 700;">
                  Trésorerie en temps réel
                </strong>
                <span style="font-size: 0.83rem; color: #94a3b8; line-height: 1.5; display: block;">
                  Suivez votre solde bancaire exact au centime près, calculé à partir de vos relevés importés.
                </span>
              </div>
            </div>

            <!-- Carte 2 : Résultat -->
            <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(16, 185, 129, 0.15); color: #34d399; display: flex; align-items: center; justify-content: center; font-size: 1rem; border: 1px solid rgba(16, 185, 129, 0.25);">
                <i class="fa-solid fa-chart-line"></i>
              </div>
              <div>
                <strong style="font-size: 0.92rem; color: #ffffff; display: block; margin-bottom: 6px; font-weight: 700;">
                  Le résultat d'exercice
                </strong>
                <span style="font-size: 0.83rem; color: #94a3b8; line-height: 1.5; display: block;">
                  Visualisez la balance entre vos recettes et vos dépenses pour savoir immédiatement si vous êtes en excédent ou en déficit.
                </span>
              </div>
            </div>

            <!-- Carte 3 : Opérations -->
            <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(168, 85, 247, 0.15); color: #c084fc; display: flex; align-items: center; justify-content: center; font-size: 1rem; border: 1px solid rgba(168, 85, 247, 0.25);">
                <i class="fa-solid fa-list-check"></i>
              </div>
              <div>
                <strong style="font-size: 0.92rem; color: #ffffff; display: block; margin-bottom: 6px; font-weight: 700;">
                  Accès aux opérations
                </strong>
                <span style="font-size: 0.83rem; color: #94a3b8; line-height: 1.5; display: block;">
                  Consultez, filtrez et cherchez facilement parmi l'ensemble des mouvements enregistrés sur la saison.
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Pied -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 18px 28px; border-top: 1px solid rgba(255, 255, 255, 0.08); background: #0b1329;">
          <button 
            type="button" 
            onclick={switchToIntro}
            style="background: transparent; border: none; color: #60a5fa; font-weight: 700; font-size: 0.84rem; cursor: pointer; padding: 6px 4px; display: flex; align-items: center; gap: 7px; transition: color 0.15s ease;"
            onmouseenter={(e) => { e.currentTarget.style.color = '#93c5fd'; }}
            onmouseleave={(e) => { e.currentTarget.style.color = '#60a5fa'; }}
          >
            <i class="fa-regular fa-circle-question"></i> Guide complet
          </button>

          <button 
            type="button" 
            onclick={closeHelpGuide}
            style="background: #2563eb; color: #ffffff; border: none; padding: 10px 24px; font-weight: 700; font-size: 0.88rem; border-radius: 8px; cursor: pointer; transition: all 0.15s ease; box-shadow: 0 2px 8px rgba(37,99,235,0.35);"
            onmouseenter={(e) => { e.currentTarget.style.background = '#1d4ed8'; }}
            onmouseleave={(e) => { e.currentTarget.style.background = '#2563eb'; }}
          >
            J'ai compris
          </button>
        </div>
      </div>

    <!-- MODALE SPÉCIFIQUE : ATTRIBUTION -->
    {:else if $helpGuideSection === 'attribution'}
      <div 
        class="help-modal-card" 
        onclick={(e) => e.stopPropagation()}
        transition:scale={{ duration: 200, start: 0.96 }}
        style="width: 100%; max-width: 860px; max-height: 90vh; background: #0f172a; border-radius: 18px; box-shadow: 0 25px 60px rgba(0,0,0,0.55); display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.12);"
      >
        <!-- En-tête épuré -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 22px 28px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: #0f172a;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(99, 102, 241, 0.15); color: #818cf8; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0; border: 1px solid rgba(99, 102, 241, 0.3);">
              <i class="fa-solid fa-arrows-split-up-and-left"></i>
            </div>
            <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #ffffff; font-family: var(--font-title, sans-serif); letter-spacing: -0.01em;">
              L'attribution
            </h2>
          </div>
          <button 
            type="button" 
            onclick={closeHelpGuide}
            aria-label="Fermer"
            style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); width: 34px; height: 34px; border-radius: 8px; font-size: 0.95rem; color: #cbd5e1; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;"
            onmouseenter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; e.currentTarget.style.color = '#ffffff'; }}
            onmouseleave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.color = '#cbd5e1'; }}
          >
            ✕
          </button>
        </div>

        <!-- Corps -->
        <div style="padding: 26px 28px; overflow-y: auto; display: flex; flex-direction: column; gap: 18px;">
          <div>
            <h3 style="margin: 0 0 6px 0; font-size: 0.96rem; font-weight: 800; color: #ffffff;">Les boîtes</h3>
            <p style="margin: 0; font-size: 0.94rem; color: #cbd5e1; line-height: 1.65;">
              En comptabilité, on range les opérations bancaires dans des boîtes. Ces boîtes possèdent toutes un numéro et une description. Par exemple, un achat se rangera dans la boîte <strong>606</strong> dont la description est <em>(achats et fournitures)</em>. Un restaurant se rangera dans la boîte <strong>625</strong> <em>(restauration et déplacements)</em>.
            </p>
          </div>

          <div>
            <h3 style="margin: 0 0 6px 0; font-size: 0.96rem; font-weight: 800; color: #ffffff;">Les comptes</h3>
            <p style="margin: 0; font-size: 0.94rem; color: #cbd5e1; line-height: 1.65;">
              Les opérations bancaires ont des libellés, par exemple « Restaurant Le Sushi Impérial ». C'est ce libellé qui est attribué aux boîtes. Ces boîtes, en comptabilité, s'appellent des <strong>comptes</strong>.
            </p>
          </div>

          <div>
            <h3 style="margin: 0 0 6px 0; font-size: 0.96rem; font-weight: 800; color: #ffffff;">Documents</h3>
            <p style="margin: 0 0 8px 0; font-size: 0.94rem; color: #cbd5e1; line-height: 1.65;">
              Une fois chaque libellé attribué à son compte, ScriptCompta trie et ventile vos totaux. Il génère automatiquement les registres officiels (Livre-journal, Grand-livre, Bilan), mais aussi des tableaux de gestion.
            </p>
            <p style="margin: 0; font-size: 0.94rem; color: #cbd5e1; line-height: 1.65;">
              Ces documents sont directement exploitables par votre expert-comptable, votre trésorier ou l'administration fiscale.
            </p>
          </div>

          <div>
            <h3 style="margin: 0 0 6px 0; font-size: 0.96rem; font-weight: 800; color: #ffffff;">Import des opérations bancaires</h3>
            <p style="margin: 0 0 8px 0; font-size: 0.94rem; color: #cbd5e1; line-height: 1.65;">
              Vous n'avez pas besoin d'apprendre le plan comptable par cœur, car ScriptCompta analyse vos libellés, vous suggère le compte correspondant (numéro + intitulé clair) et mémorise vos choix pour automatiser les imports suivants.
            </p>
            <p style="margin: 0; font-size: 0.94rem; color: #cbd5e1; line-height: 1.65;">
              Pour procéder à l'attribution, vous avez seulement besoin d'importer vos opérations bancaires au format CSV et ScriptCompta fera le reste.
            </p>
          </div>

          <div>
            <h3 style="margin: 0 0 6px 0; font-size: 0.96rem; font-weight: 800; color: #ffffff;">Création du dictionnaire d'attribution</h3>
            <p style="margin: 0; font-size: 0.94rem; color: #cbd5e1; line-height: 1.65;">
              ScriptCompta possède un dictionnaire de libellés associés au bon compte. Mais dans certains cas, ScriptCompta aura besoin de votre contribution pour attribuer manuellement le libellé au bon numéro de compte et ainsi enrichir le dictionnaire.
            </p>
          </div>
        </div>

        <!-- Pied -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 18px 28px; border-top: 1px solid rgba(255, 255, 255, 0.08); background: #0b1329;">
          <button 
            type="button" 
            onclick={switchToIntro}
            style="background: transparent; border: none; color: #818cf8; font-weight: 700; font-size: 0.84rem; cursor: pointer; padding: 6px 4px; display: flex; align-items: center; gap: 7px;"
          >
            <i class="fa-regular fa-circle-question"></i> Guide complet
          </button>

          <button 
            type="button" 
            onclick={closeHelpGuide}
            style="background: #2563eb; color: #ffffff; border: none; padding: 10px 24px; font-weight: 700; font-size: 0.88rem; border-radius: 8px; cursor: pointer; transition: all 0.15s ease; box-shadow: 0 2px 8px rgba(37,99,235,0.35);"
            onmouseenter={(e) => { e.currentTarget.style.background = '#1d4ed8'; }}
            onmouseleave={(e) => { e.currentTarget.style.background = '#2563eb'; }}
          >
            J'ai compris
          </button>
        </div>
      </div>

    <!-- MODALE SPÉCIFIQUE : RECETTES -->
    {:else if $helpGuideSection === 'recettes'}
      <div 
        class="help-modal-card" 
        onclick={(e) => e.stopPropagation()}
        transition:scale={{ duration: 200, start: 0.96 }}
        style="width: 100%; max-width: 860px; max-height: 90vh; background: #0f172a; border-radius: 18px; box-shadow: 0 25px 60px rgba(0,0,0,0.55); display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.12);"
      >
        <!-- En-tête épuré -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 22px 28px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: #0f172a;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(16, 185, 129, 0.15); color: #34d399; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0; border: 1px solid rgba(16, 185, 129, 0.3);">
              <i class="fa-solid fa-piggy-bank"></i>
            </div>
            <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #ffffff; font-family: var(--font-title, sans-serif); letter-spacing: -0.01em;">
              Gestion des recettes
            </h2>
          </div>
          <button 
            type="button" 
            onclick={closeHelpGuide}
            aria-label="Fermer"
            style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); width: 34px; height: 34px; border-radius: 8px; font-size: 0.95rem; color: #cbd5e1; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;"
            onmouseenter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; e.currentTarget.style.color = '#ffffff'; }}
            onmouseleave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.color = '#cbd5e1'; }}
          >
            ✕
          </button>
        </div>

        <!-- Corps -->
        <div style="padding: 26px 28px; overflow-y: auto; display: flex; flex-direction: column; gap: 18px;">
          <p style="margin: 0; font-size: 0.95rem; color: #cbd5e1; line-height: 1.65;">
            Ici, vous pouvez gérer vos ventes, vos dons et vos adhésions (licenciés, contributeurs, etc.).
          </p>

          <div>
            <h3 style="margin: 0 0 6px 0; font-size: 0.96rem; font-weight: 800; color: #ffffff;">Tableau de gestion</h3>
            <p style="margin: 0; font-size: 0.94rem; color: #cbd5e1; line-height: 1.65;">
              Le tableau accessible depuis l'onglet (Recette en 756 et 706) isole les comptes 706 et 756, c'est-à-dire les comptes dans lesquels sont regroupées toutes les opérations d'adhésion, de cotisation, de licences, etc. Vous pouvez filtrer ce tableau pour le consulter.
            </p>
          </div>

          <div>
            <h3 style="margin: 0 0 6px 0; font-size: 0.96rem; font-weight: 800; color: #ffffff;">Option avancée</h3>
            <p style="margin: 0 0 8px 0; font-size: 0.94rem; color: #cbd5e1; line-height: 1.65;">
              Vous pouvez utiliser également l'option avancée. Il vous suffit d'importer un tableau CSV que vous aurez conçu par vos soins ou dont vous pouvez télécharger le modèle directement depuis l'onglet « Modèle ».
            </p>
            <p style="margin: 0; font-size: 0.94rem; color: #cbd5e1; line-height: 1.65;">
              Ce tableau comporte deux colonnes : A, les noms et B, le montant. Une fois ce tableau importé, votre gestion sera entièrement automatisée. Vous pourrez ainsi consulter toute votre gestion, en un clic.
            </p>
          </div>
        </div>

        <!-- Pied -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 18px 28px; border-top: 1px solid rgba(255, 255, 255, 0.08); background: #0b1329;">
          <button 
            type="button" 
            onclick={switchToIntro}
            style="background: transparent; border: none; color: #34d399; font-weight: 700; font-size: 0.84rem; cursor: pointer; padding: 6px 4px; display: flex; align-items: center; gap: 7px;"
          >
            <i class="fa-regular fa-circle-question"></i> Guide complet
          </button>

          <button 
            type="button" 
            onclick={closeHelpGuide}
            style="background: #2563eb; color: #ffffff; border: none; padding: 10px 24px; font-weight: 700; font-size: 0.88rem; border-radius: 8px; cursor: pointer; transition: all 0.15s ease; box-shadow: 0 2px 8px rgba(37,99,235,0.35);"
            onmouseenter={(e) => { e.currentTarget.style.background = '#1d4ed8'; }}
            onmouseleave={(e) => { e.currentTarget.style.background = '#2563eb'; }}
          >
            J'ai compris
          </button>
        </div>
      </div>

    <!-- MODALE SPÉCIFIQUE : OBLIGATIONS -->
    {:else if $helpGuideSection === 'obligations'}
      <div 
        class="help-modal-card" 
        onclick={(e) => e.stopPropagation()}
        transition:scale={{ duration: 200, start: 0.96 }}
        style="width: 100%; max-width: 860px; max-height: 90vh; background: #0f172a; border-radius: 18px; box-shadow: 0 25px 60px rgba(0,0,0,0.55); display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.12);"
      >
        <!-- En-tête épuré -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 22px 28px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: #0f172a;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(245, 158, 11, 0.15); color: #fbbf24; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0; border: 1px solid rgba(245, 158, 11, 0.3);">
              <i class="fa-solid fa-scale-balanced"></i>
            </div>
            <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #ffffff; font-family: var(--font-title, sans-serif); letter-spacing: -0.01em;">
              Obligations comptables
            </h2>
          </div>
          <button 
            type="button" 
            onclick={closeHelpGuide}
            aria-label="Fermer"
            style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); width: 34px; height: 34px; border-radius: 8px; font-size: 0.95rem; color: #cbd5e1; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;"
            onmouseenter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; e.currentTarget.style.color = '#ffffff'; }}
            onmouseleave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.color = '#cbd5e1'; }}
          >
            ✕
          </button>
        </div>

        <!-- Corps avec les 4 registres en ROW -->
        <div style="padding: 26px 28px; overflow-y: auto; display: flex; flex-direction: column; gap: 18px;">
          <p style="margin: 0; font-size: 0.95rem; color: #cbd5e1; line-height: 1.6;">
            Dans cet onglet sont regroupés tous les fichiers et registres réglementaires indispensables à votre clôture annuelle.
          </p>

          <!-- 4 Registres en ROW (grille 4 colonnes) -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
            <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 14px 12px;">
              <strong style="font-size: 0.86rem; color: #ffffff; display: block; margin-bottom: 4px; font-weight: 700;">Le Grand Livre</strong>
              <span style="font-size: 0.78rem; color: #94a3b8; line-height: 1.45; display: block;">Mouvements détaillés compte par compte.</span>
            </div>
            <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 14px 12px;">
              <strong style="font-size: 0.86rem; color: #ffffff; display: block; margin-bottom: 4px; font-weight: 700;">Le Livre-Journal</strong>
              <span style="font-size: 0.78rem; color: #94a3b8; line-height: 1.45; display: block;">Chronologie exacte de toutes vos écritures.</span>
            </div>
            <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 14px 12px;">
              <strong style="font-size: 0.86rem; color: #ffffff; display: block; margin-bottom: 4px; font-weight: 700;">La Balance</strong>
              <span style="font-size: 0.78rem; color: #94a3b8; line-height: 1.45; display: block;">Synthèse des débits, crédits et soldes nets.</span>
            </div>
            <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 14px 12px;">
              <strong style="font-size: 0.86rem; color: #ffffff; display: block; margin-bottom: 4px; font-weight: 700;">Fichier FEC</strong>
              <span style="font-size: 0.78rem; color: #94a3b8; line-height: 1.45; display: block;">Format informatique normé DGFiP.</span>
            </div>
          </div>

          <p style="margin: 0; font-size: 0.9rem; color: #cbd5e1; line-height: 1.55;">
            Vous pouvez consulter chaque fichier directement à l'écran ou l'exporter en 1 clic pour le remettre à votre expert-comptable ou à votre Assemblée Générale.
          </p>
        </div>

        <!-- Pied -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 18px 28px; border-top: 1px solid rgba(255, 255, 255, 0.08); background: #0b1329;">
          <button 
            type="button" 
            onclick={switchToIntro}
            style="background: transparent; border: none; color: #fbbf24; font-weight: 700; font-size: 0.84rem; cursor: pointer; padding: 6px 4px; display: flex; align-items: center; gap: 7px;"
          >
            <i class="fa-regular fa-circle-question"></i> Guide complet
          </button>

          <button 
            type="button" 
            onclick={closeHelpGuide}
            style="background: #2563eb; color: #ffffff; border: none; padding: 10px 24px; font-weight: 700; font-size: 0.88rem; border-radius: 8px; cursor: pointer; transition: all 0.15s ease; box-shadow: 0 2px 8px rgba(37,99,235,0.35);"
            onmouseenter={(e) => { e.currentTarget.style.background = '#1d4ed8'; }}
            onmouseleave={(e) => { e.currentTarget.style.background = '#2563eb'; }}
          >
            J'ai compris
          </button>
        </div>
      </div>

    <!-- MODALE GLOBALE : GUIDE D'UTILISATION GÉNÉRAL (OUVERT DEPUIS LA SIDEBAR) -->
    {:else}
      <div 
        class="help-modal-card" 
        onclick={(e) => e.stopPropagation()}
        transition:scale={{ duration: 200, start: 0.96 }}
        style="width: 100%; max-width: 860px; max-height: 90vh; background: #0f172a; border-radius: 18px; box-shadow: 0 25px 60px rgba(0,0,0,0.55); display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.12);"
      >
        <!-- En-tête -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 22px 28px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: #0f172a;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0; border: 1px solid rgba(59, 130, 246, 0.3);">
              <i class="fa-solid fa-compass"></i>
            </div>
            <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #ffffff; font-family: var(--font-title, sans-serif); letter-spacing: -0.01em;">
              Bienvenue sur ScriptCompta
            </h2>
          </div>
          <button 
            type="button" 
            onclick={closeHelpGuide}
            aria-label="Fermer"
            style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); width: 34px; height: 34px; border-radius: 8px; font-size: 0.95rem; color: #cbd5e1; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;"
            onmouseenter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; e.currentTarget.style.color = '#ffffff'; }}
            onmouseleave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.color = '#cbd5e1'; }}
          >
            ✕
          </button>
        </div>

        <!-- Corps -->
        <div style="padding: 26px 28px; overflow-y: auto; display: flex; flex-direction: column; gap: 18px;">
          <p style="margin: 0; font-size: 0.95rem; color: #cbd5e1; line-height: 1.6;">
            <strong>ScriptCompta ne se substitue pas à votre expert-comptable</strong>, mais vous permet de préparer toutes vos étapes en toute sérénité. En un clic, vous exportez des documents prêts et conformes pour votre expert ou votre assemblée générale.
          </p>

          <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 16px 18px;">
            <div style="font-weight: 800; font-size: 0.9rem; color: #ffffff; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-wand-magic-sparkles" style="color: #60a5fa;"></i>
              Aucune connaissance comptable requise
            </div>
            <div style="font-size: 0.84rem; color: #94a3b8; line-height: 1.5;">
              L'outil est ultra simple d'utilisation et assisté par un dictionnaire d'attribution qui retient vos choix. Vous classez vos opérations en langage clair, sans jargon technique.
            </div>
          </div>

          <!-- Raccourcis en ROW vers les 4 fiches d'aide -->
          <div>
            <div style="font-size: 0.78rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px;">
              Explorer les fonctionnalités :
            </div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
              <button
                type="button"
                onclick={() => switchToSection('accueil')}
                style="display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; text-align: left; cursor: pointer; transition: all 0.15s ease;"
                onmouseenter={(e) => { e.currentTarget.style.borderColor = '#60a5fa'; e.currentTarget.style.background = 'rgba(59, 130, 246, 0.12)'; }}
                onmouseleave={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'; }}
              >
                <i class="fa-solid fa-house" style="color: #60a5fa; font-size: 1rem;"></i>
                <div style="font-size: 0.84rem; font-weight: 700; color: #ffffff;">1. Accueil</div>
                <div style="font-size: 0.72rem; color: #94a3b8;">Panorama & trésorerie</div>
              </button>

              <button
                type="button"
                onclick={() => switchToSection('attribution')}
                style="display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; text-align: left; cursor: pointer; transition: all 0.15s ease;"
                onmouseenter={(e) => { e.currentTarget.style.borderColor = '#818cf8'; e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)'; }}
                onmouseleave={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'; }}
              >
                <i class="fa-solid fa-arrows-split-up-and-left" style="color: #818cf8; font-size: 1rem;"></i>
                <div style="font-size: 0.84rem; font-weight: 700; color: #ffffff;">2. Attribution</div>
                <div style="font-size: 0.72rem; color: #94a3b8;">Comptes & astuce 487</div>
              </button>

              <button
                type="button"
                onclick={() => switchToSection('recettes')}
                style="display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; text-align: left; cursor: pointer; transition: all 0.15s ease;"
                onmouseenter={(e) => { e.currentTarget.style.borderColor = '#34d399'; e.currentTarget.style.background = 'rgba(16, 185, 129, 0.12)'; }}
                onmouseleave={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'; }}
              >
                <i class="fa-solid fa-piggy-bank" style="color: #34d399; font-size: 1rem;"></i>
                <div style="font-size: 0.84rem; font-weight: 700; color: #ffffff;">3. Recettes</div>
                <div style="font-size: 0.72rem; color: #94a3b8;">Suivi & import CSV</div>
              </button>

              <button
                type="button"
                onclick={() => switchToSection('obligations')}
                style="display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; text-align: left; cursor: pointer; transition: all 0.15s ease;"
                onmouseenter={(e) => { e.currentTarget.style.borderColor = '#fbbf24'; e.currentTarget.style.background = 'rgba(245, 158, 11, 0.12)'; }}
                onmouseleave={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'; }}
              >
                <i class="fa-solid fa-scale-balanced" style="color: #fbbf24; font-size: 1rem;"></i>
                <div style="font-size: 0.84rem; font-weight: 700; color: #ffffff;">4. Obligations</div>
                <div style="font-size: 0.72rem; color: #94a3b8;">Grand Livre, FEC</div>
              </button>
            </div>
          </div>
        </div>

        <!-- Pied -->
        <div style="display: flex; justify-content: flex-end; align-items: center; padding: 18px 28px; border-top: 1px solid rgba(255, 255, 255, 0.08); background: #0b1329;">
          <button
            type="button"
            onclick={closeHelpGuide}
            style="background: #2563eb; color: #ffffff; border: none; padding: 10px 24px; font-weight: 700; font-size: 0.88rem; border-radius: 8px; cursor: pointer; transition: background 0.15s ease;"
            onmouseenter={(e) => { e.currentTarget.style.background = '#1d4ed8'; }}
            onmouseleave={(e) => { e.currentTarget.style.background = '#2563eb'; }}
          >
            Fermer le guide
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}
