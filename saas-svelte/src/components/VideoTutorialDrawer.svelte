<script>
  import {
    showVideoDrawer,
    activeVideoTutorialId,
    closeVideoDrawer,
    entities,
    activeEntityId
  } from '../lib/store.js';
  import { getTutorialsForModel, resolveVideoSource } from '../lib/videoTutorials.js';

  let activeEntity = $derived(
    $entities.find((/** @type {any} */ e) => e.id === $activeEntityId) ||
    $entities[0] ||
    { id: 'default', name: 'Ma Structure', model: 'micro' }
  );
  let accountingModel = $derived(activeEntity?.model || 'micro');

  let tutorials = $derived(getTutorialsForModel(accountingModel));
  let currentTutorial = $derived(
    tutorials.find((t) => t.id === $activeVideoTutorialId) || tutorials[0]
  );
  let player = $derived(resolveVideoSource(currentTutorial?.videoUrl || ''));

  /** @param {string} id */
  function selectTutorial(id) {
    activeVideoTutorialId.set(id);
  }

  /** @param {KeyboardEvent} e */
  function handleKeydown(e) {
    if (e.key === 'Escape' && $showVideoDrawer) {
      closeVideoDrawer();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if $showVideoDrawer && currentTutorial}
  <!-- Overlay semi-transparent -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="video-drawer-backdrop" onclick={closeVideoDrawer}></div>

  <!-- Tiroir latéral droit -->
  <aside class="video-drawer" role="dialog" aria-modal="true" aria-label="Tutoriels vidéo Tito">
    <!-- En-tête du tiroir -->
    <div class="video-drawer-header">
      <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
        <div class="video-drawer-icon">
          <i class="fa-solid fa-play"></i>
        </div>
        <div style="min-width: 0;">
          <h3 style="margin: 0; font-size: 1rem; font-weight: 800; color: #f8fafc; line-height: 1.2;">
            Tutoriels vidéo express
          </h3>
          <p style="margin: 2px 0 0 0; font-size: 0.76rem; color: #94a3b8;">
            Comprendre chaque écran en moins d'une minute
          </p>
        </div>
      </div>

      <button
        type="button"
        class="video-drawer-close"
        onclick={closeVideoDrawer}
        aria-label="Fermer les tutoriels vidéo"
        title="Fermer"
      >
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <!-- Corps scrollable -->
    <div class="video-drawer-body">
      <!-- Lecteur vidéo 16:9 -->
      <div class="video-player-stage">
        {#if player.type === 'iframe'}
          <iframe
            src={player.src}
            title={currentTutorial.title}
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            class="video-media"
          ></iframe>
        {:else if player.type === 'video'}
          {#key player.src}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video
              src={player.src}
              controls
              playsinline
              preload="metadata"
              class="video-media"
            ></video>
          {/key}
        {:else}
          <div class="video-placeholder">
            <div class="video-placeholder-play">
              <i class="fa-solid fa-clapperboard"></i>
            </div>
            <div class="video-placeholder-title">{currentTutorial.title}</div>
            <div class="video-placeholder-sub">
              Vidéo tutoriel ({currentTutorial.duration}) bientôt disponible
            </div>
          </div>
        {/if}
      </div>

      <!-- Infos & points clés de la vidéo sélectionnée -->
      <div class="video-info-card">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 6px;">
          <span class="video-active-title">{currentTutorial.title}</span>
          <span class="video-duration-pill">
            <i class="fa-regular fa-clock"></i> {currentTutorial.duration}
          </span>
        </div>
        <p class="video-summary">{currentTutorial.summary}</p>

        {#if currentTutorial.keyPoints?.length}
          <ul class="video-keypoints">
            {#each currentTutorial.keyPoints as pt}
              <li>
                <i class="fa-solid fa-check"></i>
                <span>{pt}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <!-- Playlist des autres écrans -->
      <div class="video-playlist-section">
        <div class="video-playlist-label">Tous les écrans de Tito</div>
        <div class="video-playlist">
          {#each tutorials as tuto, idx}
            {@const isSelected = tuto.id === currentTutorial.id}
            <button
              type="button"
              class="video-playlist-item {isSelected ? 'active' : ''}"
              onclick={() => selectTutorial(tuto.id)}
            >
              <div class="playlist-item-icon">
                <i class="fa-solid {isSelected ? 'fa-play' : tuto.icon}"></i>
              </div>
              <div class="playlist-item-text">
                <div class="playlist-item-title">{idx + 1}. {tuto.shortLabel}</div>
                <div class="playlist-item-sub">{tuto.title}</div>
              </div>
              <span class="playlist-item-duration">{tuto.duration}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>
  </aside>
{/if}

<style>
  .video-drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(2, 6, 23, 0.65);
    backdrop-filter: blur(3px);
    z-index: 99990;
    animation: videoFadeIn 0.18s ease-out;
  }

  .video-drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(500px, 94vw);
    background: #0f172a;
    border-left: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: -20px 0 50px rgba(0, 0, 0, 0.6);
    z-index: 99995;
    display: flex;
    flex-direction: column;
    animation: videoSlideIn 0.24s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .video-drawer-header {
    padding: 18px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: #111c32;
    flex-shrink: 0;
  }

  .video-drawer-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: linear-gradient(135deg, #2563eb 0%, #38bdf8 100%);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    flex-shrink: 0;
    box-shadow: 0 4px 14px rgba(56, 189, 248, 0.3);
  }

  .video-drawer-close {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.06);
    color: #cbd5e1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .video-drawer-close:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #ffffff;
  }

  .video-drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .video-player-stage {
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #020617;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
  }

  .video-media {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
    background: #020617;
  }

  .video-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 20px;
    text-align: center;
    background: radial-gradient(circle at center, rgba(37, 99, 235, 0.18) 0%, #020617 75%);
  }

  .video-placeholder-play {
    width: 54px;
    height: 54px;
    border-radius: 50%;
    background: rgba(56, 189, 248, 0.16);
    border: 1.5px solid rgba(56, 189, 248, 0.4);
    color: #38bdf8;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
  }

  .video-placeholder-title {
    font-size: 0.95rem;
    font-weight: 800;
    color: #f8fafc;
  }

  .video-placeholder-sub {
    font-size: 0.78rem;
    color: #94a3b8;
  }

  .video-info-card {
    background: #162032;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 16px;
  }

  .video-active-title {
    font-size: 0.95rem;
    font-weight: 800;
    color: #ffffff;
  }

  .video-duration-pill {
    font-size: 0.72rem;
    font-weight: 700;
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.25);
    padding: 2px 8px;
    border-radius: 9999px;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .video-summary {
    margin: 0 0 12px 0;
    font-size: 0.84rem;
    color: #cbd5e1;
    line-height: 1.5;
  }

  .video-keypoints {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .video-keypoints li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 0.8rem;
    color: #94a3b8;
    line-height: 1.4;
  }

  .video-keypoints li i {
    color: #34d399;
    margin-top: 3px;
    font-size: 0.72rem;
    flex-shrink: 0;
  }

  .video-playlist-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .video-playlist-label {
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
  }

  .video-playlist {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .video-playlist-item {
    width: 100%;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 10px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .video-playlist-item:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .video-playlist-item.active {
    background: rgba(37, 99, 235, 0.16);
    border-color: rgba(56, 189, 248, 0.45);
  }

  .playlist-item-icon {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.78rem;
    flex-shrink: 0;
  }

  .video-playlist-item.active .playlist-item-icon {
    background: #2563eb;
    color: #ffffff;
  }

  .playlist-item-text {
    flex: 1;
    min-width: 0;
  }

  .playlist-item-title {
    font-size: 0.83rem;
    font-weight: 700;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .playlist-item-sub {
    font-size: 0.72rem;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .playlist-item-duration {
    font-size: 0.72rem;
    font-weight: 700;
    color: #64748b;
    flex-shrink: 0;
  }

  .video-playlist-item.active .playlist-item-duration {
    color: #38bdf8;
  }

  @keyframes videoFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes videoSlideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
</style>

