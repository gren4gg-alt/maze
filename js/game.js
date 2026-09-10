(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const canvasWrap = document.getElementById("canvasWrap");
  const mainMenu = document.getElementById("mainMenu");
  const levelSelectScreen = document.getElementById("levelSelectScreen");
  const playBtn = document.getElementById("playBtn");
  const levelSelectBtn = document.getElementById("levelSelectBtn");
  const menuSoundBtn = document.getElementById("menuSoundBtn");
  const levelBackBtn = document.getElementById("levelBackBtn");
  const levelGrid = document.getElementById("levelGrid");
  const messagePanel = document.getElementById("messagePanel");
  const messageTitle = document.getElementById("messageTitle");
  const messageText = document.getElementById("messageText");
  const mainActionBtn = document.getElementById("mainActionBtn");
  const rewardReviveBtn = document.getElementById("rewardReviveBtn");
  const restartBtn = document.getElementById("restartBtn");
  const soundBtn = document.getElementById("soundBtn");
  const levelLabel = document.getElementById("levelLabel");
  const enemyStateLabel = document.getElementById("enemyState");
  const statusDot = document.getElementById("statusDot");
  const keyStatus = document.getElementById("keyStatus");
  const keyText = document.getElementById("keyText");
  const interactBtn = document.getElementById("interactBtn");

  const controls = new Controls();
  const audio = new GameAudio();
  const ads = new AdManager();

  const playerSprite = new Image();
  playerSprite.src = "assets/player/player_sprites.png";

  const enemySprite = new Image();
  enemySprite.src = "assets/enemy/enemy_sprites.png";

  let levelIndex = 0;
  let level = null;
  let maze = null;
  let player = null;
  let enemies = [];
  let keys = [];
  let hideSpots = [];
  let collectedKeys = 0;
  let exitUnlocked = false;
  let nearbyHideSpot = null;
  let mode = "menu"; // menu | levelselect | playing | gameover | complete | finished
  let lastTime = performance.now();

  const SAVE_KEY = "mazeHuntProgressV1";
  let unlockedLevel = 0;
  let completedLevels = new Set();

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
      unlockedLevel = Math.max(0, Math.min(LEVELS.length - 1, saved.unlockedLevel || 0));
      completedLevels = new Set(
        Array.isArray(saved.completedLevels)
          ? saved.completedLevels.filter(i => Number.isInteger(i) && i >= 0 && i < LEVELS.length)
          : []
      );
    } catch (_) {
      unlockedLevel = 0;
      completedLevels = new Set();
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        unlockedLevel,
        completedLevels: [...completedLevels]
      }));
    } catch (_) {}
  }

  const view = {
    cssW: 0,
    cssH: 0,
    dpr: 1,
    tilePx: 36,
    cameraX: 0,
    cameraY: 0
  };

  function updateSoundLabels() {
    const text = audio.muted ? "SOUND: OFF" : "SOUND: ON";
    if (menuSoundBtn) menuSoundBtn.textContent = text;
    if (soundBtn) {
      soundBtn.textContent = audio.muted ? "🔇" : "🔊";
      soundBtn.setAttribute("aria-label", audio.muted ? "Unmute sound" : "Mute sound");
      soundBtn.title = audio.muted ? "Unmute sound" : "Mute sound";
    }
  }

  function showMainMenu() {
    mode = "menu";
    audio.setGameplayActive(false);
    ads.showMenuBanner();
    messagePanel.classList.add("hidden");
    levelSelectScreen.classList.add("hidden");
    mainMenu.classList.remove("hidden");
    updateSoundLabels();
  }

  function buildLevelGrid() {
    levelGrid.innerHTML = "";

    LEVELS.forEach((item, index) => {
      const unlocked = index <= unlockedLevel;
      const complete = completedLevels.has(index);

      const button = document.createElement("button");
      button.className = "level-option";
      button.type = "button";
      button.disabled = !unlocked;

      const count = item.enemyCount ||
        item.map.reduce((sum, row) => sum + [...row].filter(c => c === "E").length, 0);

      const typeNames = (item.enemyTypes || ["hunter"])
        .map(type => ENEMY_TYPES[type]?.name || "Hunter");

      const uniqueTypes = [...new Set(typeNames)];

      button.innerHTML = `
        <span class="level-number">LEVEL ${index + 1}</span>
        <span class="level-name">${item.name.replace(/^Level \d+\s*·?\s*/, "")}</span>
        <span class="level-enemies">${count} enemies · ${uniqueTypes.join(" / ")}</span>
        ${unlocked ? "" : '<span class="level-lock">🔒</span>'}
        ${complete ? '<span class="level-complete">CLEARED ✓</span>' : ""}
      `;

      if (unlocked) {
        button.addEventListener("click", async () => {
          await audio.unlock();
          levelIndex = index;
          startCurrentLevel();
        });
      }

      levelGrid.appendChild(button);
    });
  }

  function showLevelSelect() {
    mode = "levelselect";
    audio.setGameplayActive(false);
    ads.showMenuBanner();
    mainMenu.classList.add("hidden");
    messagePanel.classList.add("hidden");
    buildLevelGrid();
    levelSelectScreen.classList.remove("hidden");
  }

  function findNearbyHideSpot() {
    let nearest = null;
    let best = 0.80;

    for (const spot of hideSpots) {
      const dx = spot.x - player.x;
      const dy = spot.y - player.y;
      const distance = Math.hypot(dx, dy);

      if (distance < best) {
        nearest = spot;
        best = distance;
      }
    }

    return nearest;
  }

  function updateInteractUi() {
    if (!interactBtn || !player) return;

    if (player.hidden) {
      interactBtn.classList.remove("hidden");
      interactBtn.classList.add("leave");
      interactBtn.textContent = "LEAVE";
      interactBtn.setAttribute("aria-label", "Leave hiding spot");
      return;
    }

    if (nearbyHideSpot) {
      interactBtn.classList.remove("hidden", "leave");
      interactBtn.textContent = "HIDE";
      interactBtn.setAttribute("aria-label", "Hide");
    } else {
      interactBtn.classList.add("hidden");
      interactBtn.classList.remove("leave");
    }
  }

  function toggleHiding() {
    if (player.hidden) {
      player.hidden = false;
      player.hideSpotId = null;
      audio.hideOut();

      // Nudge the player slightly away from the exact locker center.
      const amount = 0.23;
      if (player.direction === "up") player.y += amount;
      else if (player.direction === "down") player.y -= amount;
      else if (player.direction === "left") player.x += amount;
      else player.x -= amount;

      nearbyHideSpot = findNearbyHideSpot();
      updateInteractUi();
      return;
    }

    const spot = findNearbyHideSpot();
    if (!spot) return;

    player.hidden = true;
    player.hideSpotId = spot.id;
    player.x = spot.x;
    player.y = spot.y;
    player.moving = false;
    player.frame = 0;
    audio.hideIn();

    nearbyHideSpot = spot;
    updateInteractUi();
  }

  function updateKeyHud() {
    if (!keyText || !keyStatus) return;

    const total = keys.length;
    keyText.textContent = `${collectedKeys} / ${total} ${total === 1 ? "KEY" : "KEYS"}`;

    if (exitUnlocked) {
      keyStatus.classList.add("complete");
    } else {
      keyStatus.classList.remove("complete");
    }
  }

  function loadLevel(index) {
    levelIndex = index;
    level = LEVELS[levelIndex];
    maze = new Maze(level);
    player = new Player(maze.playerStart, level.playerSpeed);
    enemies = maze.enemyStarts.map((spawn, index) => {
      const type = (level.enemyTypes && level.enemyTypes[index]) || "hunter";
      return new Enemy(spawn, level, type);
    });
    keys = maze.keyStarts.map((spawn, index) => ({
      id: index,
      x: spawn.x + 0.5,
      y: spawn.y + 0.5,
      collected: false
    }));
    hideSpots = maze.hideStarts.map((spawn, index) => ({
      id: index,
      x: spawn.x + 0.5,
      y: spawn.y + 0.5
    }));
    nearbyHideSpot = null;
    collectedKeys = 0;
    reviveUsedThisRun = false;
    exitUnlocked = keys.length === 0;

    levelLabel.textContent = level.name;
    enemyStateLabel.textContent = "PATROL";
    statusDot.className = "status-dot";
    updateKeyHud();
    updateInteractUi();
    controls.resetTouch();

    const p = maze.tileCenter(maze.playerStart);
    view.cameraX = p.x;
    view.cameraY = p.y;
  }

  function showPanel(title, text, buttonText, panelMode) {
    mode = panelMode;
    audio.setGameplayActive(false);

    if (
      panelMode === "gameover" &&
      !reviveUsedThisRun &&
      AD_CONFIG.rules.rewardedReviveEnabled
    ) {
      rewardReviveBtn.classList.remove("hidden");
    } else {
      rewardReviveBtn.classList.add("hidden");
    }
    messageTitle.textContent = title;
    messageText.textContent = text;
    mainActionBtn.textContent = buttonText;
    messagePanel.classList.remove("hidden");
  }

  function hidePanel() {
    messagePanel.classList.add("hidden");
  }

  async function startCurrentLevel() {
    await audio.unlock();
    loadLevel(levelIndex);
    mode = "playing";
    audio.setGameplayActive(true);
    ads.hideBanner();
    rewardReviveBtn.classList.add("hidden");
    mainMenu.classList.add("hidden");
    levelSelectScreen.classList.add("hidden");
    hidePanel();
  }

  mainActionBtn.addEventListener("click", async () => {
    await audio.unlock();

    if (mode === "gameover") {
      startCurrentLevel();
    } else if (mode === "complete") {
      await ads.maybeShowLevelInterstitial();

      if (levelIndex + 1 < LEVELS.length) {
        levelIndex++;
        startCurrentLevel();
      } else {
        showPanel(
          "You escaped",
          "You cleared every included demo level.",
          "Back to menu",
          "finished"
        );
      }
    } else if (mode === "finished") {
      showMainMenu();
    }
  });

  playBtn.addEventListener("click", async () => {
    await audio.unlock();

    // Continue from the highest unlocked level that is not yet cleared.
    let target = 0;
    for (let i = 0; i <= unlockedLevel; i++) {
      if (!completedLevels.has(i)) {
        target = i;
        break;
      }
      target = Math.min(unlockedLevel, i + 1);
    }

    levelIndex = target;
    startCurrentLevel();
  });

  levelSelectBtn.addEventListener("click", async () => {
    await audio.unlock();
    showLevelSelect();
  });

  levelBackBtn.addEventListener("click", () => {
    showMainMenu();
  });

  restartBtn.addEventListener("click", async () => {
    await audio.unlock();
    startCurrentLevel();
  });

  soundBtn.addEventListener("click", async () => {
    await audio.unlock();
    audio.toggleMute();
    updateSoundLabels();
  });

  menuSoundBtn.addEventListener("click", async () => {
    await audio.unlock();
    audio.toggleMute();
    updateSoundLabels();
  });


  rewardReviveBtn.addEventListener("click", async () => {
    await audio.unlock();

    if (reviveUsedThisRun || mode !== "gameover") return;

    const rewarded = await ads.showRewardedRevive();
    if (!rewarded) return;

    reviveUsedThisRun = true;
    rewardReviveBtn.classList.add("hidden");

    // Keep collected keys, but move the player to a safe known location.
    player.hidden = false;
    player.hideSpotId = null;
    player.x = maze.playerStart.x + 0.5;
    player.y = maze.playerStart.y + 0.5;
    player.moving = false;

    // Reset enemies back to patrol and clear knowledge of the player.
    for (const enemy of enemies) {
      enemy.state = "PATROL";
      enemy.path = [];
      enemy.pathIndex = 0;
      enemy.pathCooldown = 0;
      enemy.searchTimer = 0;
      enemy.lastSeenTile = null;
      enemy.patrolTarget = null;
    }

    mode = "playing";
    hidePanel();
    audio.setGameplayActive(true);
    ads.hideBanner();
  });


  function resize() {
    const rect = canvasWrap.getBoundingClientRect();
    view.cssW = Math.max(1, rect.width);
    view.cssH = Math.max(1, rect.height);
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(view.cssW * view.dpr);
    canvas.height = Math.floor(view.cssH * view.dpr);

    const mobile = matchMedia("(pointer: coarse)").matches || view.cssW < 720;
    // Mobile: fewer visible tiles; desktop: larger visible area.
    const targetTilesAcross = mobile ? 15.5 : 25;
    const targetTilesTall = mobile ? 22 : 17;

    view.tilePx = Math.max(
      22,
      Math.min(view.cssW / targetTilesAcross, view.cssH / targetTilesTall)
    );
  }

  window.addEventListener("resize", resize);
  resize();

  function update(dt) {
    if (mode !== "playing") return;

    nearbyHideSpot = player.hidden ? hideSpots[player.hideSpotId] : findNearbyHideSpot();

    if (controls.consumeInteract()) {
      toggleHiding();
    }

    player.update(dt, controls, maze);

    if (!player.hidden) {
      nearbyHideSpot = findNearbyHideSpot();
    }
    updateInteractUi();

    for (const enemy of enemies) {
      enemy.update(dt, maze, player);
    }

    // Collect keys by walking over them.
    for (const key of keys) {
      if (player.hidden) break;
      if (key.collected) continue;

      const dx = key.x - player.x;
      const dy = key.y - player.y;

      if (dx * dx + dy * dy < 0.42 * 0.42) {
        key.collected = true;
        collectedKeys++;
        audio.keyPickup();

        if (collectedKeys >= keys.length) {
          exitUnlocked = true;
          audio.exitUnlocked();
        }

        updateKeyHud();
      }
    }

    const chasing = enemies.filter(e => e.state === "CHASE").length;
    const searching = enemies.filter(e => e.state === "SEARCH").length;

    if (chasing > 0) {
      enemyStateLabel.textContent = chasing === 1 ? "1 CHASING" : `${chasing} CHASING`;
      statusDot.className = "status-dot chase";
    } else if (searching > 0) {
      enemyStateLabel.textContent = searching === 1 ? "1 SEARCHING" : `${searching} SEARCHING`;
      statusDot.className = "status-dot search";
    } else {
      enemyStateLabel.textContent =
        enemies.length === 1 ? "1 PATROLLING" : `${enemies.length} PATROLLING`;
      statusDot.className = "status-dot";
    }

    audio.update(dt, player, enemies);

    // Any hunter touching the player ends the run.
    for (const enemy of enemies) {
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const combinedRadius = enemy.radius + player.radius;

      if (dx * dx + dy * dy <= combinedRadius * combinedRadius) {
        let caught = true;

        if (player.hidden) {
          const hiddenTile = maze.worldToTile(player.x, player.y);
          const knowsThisSpot =
            enemy.state !== "PATROL" &&
            enemy.lastSeenTile &&
            enemy.lastSeenTile.x === hiddenTile.x &&
            enemy.lastSeenTile.y === hiddenTile.y;

          caught = Boolean(knowsThisSpot);
        }

        if (caught) {
          audio.caught();
          showPanel(
            "Caught",
            player.hidden
              ? "The hunter saw where you disappeared and checked the hiding spot."
              : `One of the ${enemies.length} hunters reached you. Use loops, darkness and hiding spots to survive.`,
            "Try again",
            "gameover"
          );
          return;
        }
      }
    }

    const exitCenter = maze.tileCenter(maze.exit);
    const ex = exitCenter.x - player.x;
    const ey = exitCenter.y - player.y;

    if (ex * ex + ey * ey < 0.34 * 0.34 && exitUnlocked) {
      audio.escaped();

      completedLevels.add(levelIndex);
      if (levelIndex + 1 < LEVELS.length) {
        unlockedLevel = Math.max(unlockedLevel, levelIndex + 1);
      }
      saveProgress();

      if (levelIndex + 1 < LEVELS.length) {
        const nextCount = LEVELS[levelIndex + 1].enemyCount || 1;
        showPanel(
          "Escaped",
          `Level ${levelIndex + 1} complete. Next level has ${nextCount} hunters.`,
          "Next level",
          "complete"
        );
      } else {
        showPanel(
          "Final exit reached",
          "You escaped every hunter through all demo levels.",
          "Back to menu",
          "finished"
        );
      }
      return;
    }

    // Smooth camera follow.
    const follow = 1 - Math.pow(0.0007, dt);
    view.cameraX += (player.x - view.cameraX) * follow;
    view.cameraY += (player.y - view.cameraY) * follow;
  }

  function worldToScreen(x, y) {
    return {
      x: view.cssW / 2 + (x - view.cameraX) * view.tilePx,
      y: view.cssH / 2 + (y - view.cameraY) * view.tilePx
    };
  }


  function tileHash(x, y, seed = 0) {
    let n = ((x * 374761393) ^ (y * 668265263) ^ (seed * 1442695041)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  function drawFloorTile(tx, ty, p, s) {
    const variation = tileHash(tx, ty, 1);

    ctx.fillStyle = variation > 0.62 ? "#0d1218" : "#0a0f14";
    ctx.fillRect(p.x, p.y, s, s);

    // Extremely subtle floor slab edges.
    ctx.strokeStyle = "rgba(185, 202, 218, 0.025)";
    ctx.lineWidth = Math.max(0.5, s * 0.018);
    ctx.strokeRect(p.x + 0.5, p.y + 0.5, s - 1, s - 1);

    // Dirt stain.
    if (tileHash(tx, ty, 4) > 0.72) {
      ctx.save();
      ctx.globalAlpha = 0.055;
      ctx.fillStyle = "#6c5745";
      ctx.beginPath();
      ctx.ellipse(
        p.x + s * (0.28 + tileHash(tx, ty, 6) * 0.45),
        p.y + s * (0.30 + tileHash(tx, ty, 7) * 0.40),
        s * 0.18,
        s * 0.09,
        tileHash(tx, ty, 8) * Math.PI,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }

    // Occasional little crack.
    if (tileHash(tx, ty, 10) > 0.84) {
      const x1 = p.x + s * (0.22 + tileHash(tx, ty, 11) * 0.2);
      const y1 = p.y + s * (0.25 + tileHash(tx, ty, 12) * 0.35);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + s * 0.17, y1 + s * 0.08);
      ctx.lineTo(x1 + s * 0.25, y1 + s * 0.02);
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.lineWidth = Math.max(1, s * 0.026);
      ctx.stroke();
    }
  }

  function drawWallTile(tx, ty, p, s) {
    const variation = tileHash(tx, ty, 20);

    // Match the collision geometry: wall faces pull back 5% from
    // each edge that borders walkable floor. This gives corridors
    // about 10% more usable width without opening seams inside solid walls.
    const edgeInset = s * 0.05;

    const insetLeft = maze.isWalkable(tx - 1, ty) ? edgeInset : 0;
    const insetRight = maze.isWalkable(tx + 1, ty) ? edgeInset : 0;
    const insetTop = maze.isWalkable(tx, ty - 1) ? edgeInset : 0;
    const insetBottom = maze.isWalkable(tx, ty + 1) ? edgeInset : 0;

    const x = p.x + insetLeft;
    const y = p.y + insetTop;
    const w = s - insetLeft - insetRight;
    const h = s - insetTop - insetBottom;

    ctx.fillStyle = variation > 0.58 ? "#353b42" : "#30363d";
    ctx.fillRect(x, y, w, h);

    // Recessed stone face.
    const faceInset = Math.min(w, h) * 0.085;
    ctx.fillStyle = variation > 0.58 ? "#272d33" : "#242a30";
    ctx.fillRect(
      x + faceInset,
      y + faceInset,
      Math.max(0, w - faceInset * 2),
      Math.max(0, h - faceInset * 2)
    );

    // Bevel.
    ctx.fillStyle = "rgba(178, 190, 201, 0.11)";
    ctx.fillRect(x, y, w, Math.max(1.2, h * 0.065));
    ctx.fillRect(x, y, Math.max(1.2, w * 0.055), h);

    // Deep edge shadow.
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.fillRect(x, y + h * 0.89, w, h * 0.11);
    ctx.fillRect(x + w * 0.90, y, w * 0.10, h);

    // Mortar / outer edge.
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));

    // Deterministic cracks.
    if (tileHash(tx, ty, 24) > 0.69) {
      const cx = x + w * (0.26 + tileHash(tx, ty, 25) * 0.42);
      const cy = y + h * (0.28 + tileHash(tx, ty, 26) * 0.38);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + w * 0.14, cy + h * 0.08);
      ctx.lineTo(cx + w * 0.06, cy + h * 0.19);
      ctx.lineTo(cx + w * 0.18, cy + h * 0.25);
      ctx.strokeStyle = "rgba(5,7,9,0.58)";
      ctx.lineWidth = Math.max(1, s * 0.032);
      ctx.stroke();
    }

    if (tileHash(tx, ty, 29) > 0.82) {
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = "#6f624e";
      ctx.beginPath();
      ctx.arc(
        x + w * (0.25 + tileHash(tx, ty, 30) * 0.5),
        y + h * (0.25 + tileHash(tx, ty, 31) * 0.5),
        s * 0.08,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }
  }

  function isSpecialTile(tx, ty) {
    const p = maze.playerStart;
    const x = maze.exit;
    if (p && p.x === tx && p.y === ty) return true;
    if (x && x.x === tx && x.y === ty) return true;

    for (const e of maze.enemyStarts) {
      if (e.x === tx && e.y === ty) return true;
    }
    return false;
  }

  function drawFloorDecoration(tx, ty, p, s) {
    if (maze.isWall(tx, ty) || isSpecialTile(tx, ty)) return;

    const h1 = tileHash(tx, ty, 100);
    const h2 = tileHash(tx, ty, 101);

    // Blood stains / smears.
    if (h1 > 0.935) {
      ctx.save();
      ctx.globalAlpha = 0.43;
      ctx.fillStyle = "#67131a";

      ctx.beginPath();
      ctx.ellipse(
        p.x + s * (0.25 + h2 * 0.45),
        p.y + s * (0.30 + tileHash(tx, ty, 102) * 0.42),
        s * (0.14 + tileHash(tx, ty, 103) * 0.08),
        s * (0.05 + tileHash(tx, ty, 104) * 0.05),
        tileHash(tx, ty, 105) * Math.PI,
        0, Math.PI * 2
      );
      ctx.fill();

      // Smaller drops nearby.
      for (let i = 0; i < 3; i++) {
        const rx = tileHash(tx, ty, 110 + i * 2);
        const ry = tileHash(tx, ty, 111 + i * 2);
        ctx.beginPath();
        ctx.arc(
          p.x + s * (0.18 + rx * 0.64),
          p.y + s * (0.18 + ry * 0.64),
          s * (0.018 + tileHash(tx, ty, 120 + i) * 0.025),
          0, Math.PI * 2
        );
        ctx.fill();
      }

      ctx.restore();
    }

    // Torn paper / notes.
    if (h1 > 0.84 && h1 < 0.885) {
      ctx.save();
      ctx.translate(
        p.x + s * (0.35 + tileHash(tx, ty, 131) * 0.28),
        p.y + s * (0.32 + tileHash(tx, ty, 132) * 0.30)
      );
      ctx.rotate((tileHash(tx, ty, 133) - 0.5) * 1.2);

      ctx.fillStyle = "rgba(183, 171, 145, .33)";
      ctx.fillRect(-s * 0.09, -s * 0.065, s * 0.18, s * 0.13);

      ctx.strokeStyle = "rgba(67, 57, 48, .35)";
      ctx.lineWidth = Math.max(0.5, s * 0.012);
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.06, i * s * 0.025);
        ctx.lineTo(s * 0.055, i * s * 0.025);
        ctx.stroke();
      }

      ctx.restore();
    }

    // Small chunks of rubble.
    if (h1 > 0.75 && h1 < 0.80) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "#3e444a";

      for (let i = 0; i < 3; i++) {
        const rx = tileHash(tx, ty, 140 + i * 3);
        const ry = tileHash(tx, ty, 141 + i * 3);
        const rr = tileHash(tx, ty, 142 + i * 3);
        const cx = p.x + s * (0.22 + rx * 0.56);
        const cy = p.y + s * (0.25 + ry * 0.50);
        const r = s * (0.025 + rr * 0.035);

        ctx.beginPath();
        ctx.moveTo(cx - r, cy + r * 0.5);
        ctx.lineTo(cx - r * 0.3, cy - r);
        ctx.lineTo(cx + r, cy - r * 0.2);
        ctx.lineTo(cx + r * 0.5, cy + r);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    // Occasional footprint pair.
    if (h1 > 0.895 && h1 < 0.915) {
      const angle = tileHash(tx, ty, 151) * Math.PI * 2;
      const dx = Math.cos(angle) * s * 0.09;
      const dy = Math.sin(angle) * s * 0.09;

      ctx.save();
      ctx.translate(p.x + s * 0.5, p.y + s * 0.5);
      ctx.rotate(angle);
      ctx.fillStyle = "rgba(24, 20, 18, .48)";

      ctx.beginPath();
      ctx.ellipse(-dx, -dy, s * 0.035, s * 0.075, 0.12, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(dx, dy, s * 0.035, s * 0.075, -0.12, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  function getLampInfo(tx, ty) {
    if (!maze.isWall(tx, ty)) return null;
    if (tileHash(tx, ty, 200) < 0.94) return null;

    const neighbors = [
      { dx: 0, dy: 1, side: "bottom" },
      { dx: 0, dy: -1, side: "top" },
      { dx: 1, dy: 0, side: "right" },
      { dx: -1, dy: 0, side: "left" }
    ];

    for (const n of neighbors) {
      if (maze.isWalkable(tx + n.dx, ty + n.dy)) {
        return n.side;
      }
    }

    return null;
  }

  function drawWallDecoration(tx, ty, p, s, timeSeconds) {
    if (!maze.isWall(tx, ty)) return;

    // Dark damp stain.
    const damp = tileHash(tx, ty, 210);
    if (damp > 0.79 && damp < 0.90) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "#13181a";
      ctx.beginPath();
      ctx.ellipse(
        p.x + s * (0.25 + tileHash(tx, ty, 211) * 0.5),
        p.y + s * (0.28 + tileHash(tx, ty, 212) * 0.46),
        s * 0.17,
        s * 0.11,
        tileHash(tx, ty, 213) * Math.PI,
        0, Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }

    // Scratch marks.
    if (damp > 0.91 && damp < 0.935) {
      ctx.save();
      ctx.strokeStyle = "rgba(13, 15, 16, .65)";
      ctx.lineWidth = Math.max(1, s * 0.025);

      const sx = p.x + s * 0.35;
      const sy = p.y + s * 0.24;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(sx + i * s * 0.07, sy);
        ctx.lineTo(sx + i * s * 0.05, sy + s * 0.44);
        ctx.stroke();
      }
      ctx.restore();
    }

    const lampSide = getLampInfo(tx, ty);
    if (!lampSide) return;

    const phase = tileHash(tx, ty, 220) * Math.PI * 2;
    const flicker =
      0.78 +
      Math.sin(timeSeconds * 7.4 + phase) * 0.08 +
      Math.sin(timeSeconds * 17.7 + phase * 1.7) * 0.045;

    let lx = p.x + s * 0.5;
    let ly = p.y + s * 0.5;

    if (lampSide === "bottom") ly = p.y + s * 0.82;
    if (lampSide === "top") ly = p.y + s * 0.18;
    if (lampSide === "right") lx = p.x + s * 0.82;
    if (lampSide === "left") lx = p.x + s * 0.18;

    // Fixture.
    ctx.save();
    ctx.fillStyle = "#171515";
    ctx.beginPath();
    ctx.arc(lx, ly, s * 0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(238, 176, 82, ${0.68 * flicker})`;
    ctx.beginPath();
    ctx.arc(lx, ly, s * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawLampGlow(tx, ty, p, s, timeSeconds) {
    const side = getLampInfo(tx, ty);
    if (!side) return;

    const phase = tileHash(tx, ty, 220) * Math.PI * 2;
    const flicker =
      0.82 +
      Math.sin(timeSeconds * 7.4 + phase) * 0.08 +
      Math.sin(timeSeconds * 17.7 + phase * 1.7) * 0.045;

    let lx = p.x + s * 0.5;
    let ly = p.y + s * 0.5;

    if (side === "bottom") ly = p.y + s * 0.90;
    if (side === "top") ly = p.y + s * 0.10;
    if (side === "right") lx = p.x + s * 0.90;
    if (side === "left") lx = p.x + s * 0.10;

    const radius = s * 2.6;
    const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, radius);
    glow.addColorStop(0, `rgba(255, 188, 90, ${0.13 * flicker})`);
    glow.addColorStop(0.35, `rgba(218, 128, 46, ${0.055 * flicker})`);
    glow.addColorStop(1, "rgba(160, 70, 20, 0)");

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = glow;
    ctx.fillRect(lx - radius, ly - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  function draw() {
    const timeSeconds = performance.now() / 1000;

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, view.cssW, view.cssH);

    ctx.fillStyle = "#07090c";
    ctx.fillRect(0, 0, view.cssW, view.cssH);

    const halfCols = view.cssW / view.tilePx / 2 + 2;
    const halfRows = view.cssH / view.tilePx / 2 + 2;
    const minX = Math.max(0, Math.floor(view.cameraX - halfCols));
    const maxX = Math.min(maze.width - 1, Math.ceil(view.cameraX + halfCols));
    const minY = Math.max(0, Math.floor(view.cameraY - halfRows));
    const maxY = Math.min(maze.height - 1, Math.ceil(view.cameraY + halfRows));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const p = worldToScreen(x, y);
        const s = view.tilePx + 0.5;

        if (maze.isWall(x, y)) {
          drawWallTile(x, y, p, s);
          drawWallDecoration(x, y, p, s, timeSeconds);
        } else {
          drawFloorTile(x, y, p, s);
          drawFloorDecoration(x, y, p, s);
        }
      }
    }

    drawExit();
    for (const spot of hideSpots) drawHideSpot(spot, timeSeconds);
    for (const key of keys) drawKey(key, timeSeconds);
    for (const enemy of enemies) drawVisionCone(enemy);
    for (const enemy of enemies) drawEnemy(enemy);
    // Draw environmental lamp glows BEFORE the darkness mask.
    // This means lamps can brighten nearby visible tiles, but cannot reveal
    // walls or props outside the player's visibility circle.
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!maze.isWall(x, y)) continue;
        const p = worldToScreen(x, y);
        drawLampGlow(x, y, p, view.tilePx + 0.5, timeSeconds);
      }
    }

    drawPlayer();
    drawLighting();
    drawThreatVignette();
  }

  function drawExit() {
    const c = maze.tileCenter(maze.exit);
    const p = worldToScreen(c.x, c.y);
    const r = view.tilePx * 0.30;

    ctx.save();

    if (exitUnlocked) {
      ctx.shadowBlur = view.tilePx * 0.9;
      ctx.shadowColor = "#62f0aa";
      ctx.fillStyle = "#62f0aa";
    } else {
      ctx.shadowBlur = view.tilePx * 0.45;
      ctx.shadowColor = "#ff9f43";
      ctx.fillStyle = "#b86a2c";
    }

    ctx.beginPath();
    ctx.roundRect(p.x - r, p.y - r, r * 2, r * 2, r * 0.28);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = exitUnlocked ? "#0b3724" : "#2b1608";
    ctx.font = `900 ${Math.max(9, view.tilePx * 0.24)}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(exitUnlocked ? "EXIT" : "LOCK", p.x, p.y + view.tilePx * 0.02);

    // Simple lock shackle when locked.
    if (!exitUnlocked) {
      ctx.strokeStyle = "#2b1608";
      ctx.lineWidth = Math.max(2, view.tilePx * 0.06);
      ctx.beginPath();
      ctx.arc(
        p.x,
        p.y - view.tilePx * 0.09,
        view.tilePx * 0.105,
        Math.PI,
        0
      );
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawHideSpot(spot, timeSeconds) {
    const p = worldToScreen(spot.x, spot.y);
    const occupied = player.hidden && player.hideSpotId === spot.id;
    const near = !player.hidden && nearbyHideSpot && nearbyHideSpot.id === spot.id;

    const w = view.tilePx * 0.58;
    const h = view.tilePx * 0.84;

    ctx.save();

    // Shadow.
    ctx.fillStyle = "rgba(0,0,0,.42)";
    ctx.beginPath();
    ctx.ellipse(
      p.x,
      p.y + view.tilePx * 0.25,
      view.tilePx * 0.33,
      view.tilePx * 0.12,
      0, 0, Math.PI * 2
    );
    ctx.fill();

    // Old metal locker / cabinet.
    ctx.fillStyle = occupied ? "#182b25" : "#252d32";
    ctx.strokeStyle = occupied
      ? "rgba(130,242,187,.48)"
      : near
        ? "rgba(255,214,119,.52)"
        : "rgba(135,149,160,.32)";
    ctx.lineWidth = Math.max(1, view.tilePx * 0.035);
    ctx.beginPath();
    ctx.roundRect(
      p.x - w / 2,
      p.y - h * 0.70,
      w,
      h,
      view.tilePx * 0.07
    );
    ctx.fill();
    ctx.stroke();

    // Door seam.
    ctx.strokeStyle = "rgba(0,0,0,.48)";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - h * 0.65);
    ctx.lineTo(p.x, p.y + h * 0.04);
    ctx.stroke();

    // Vent slits.
    ctx.strokeStyle = "rgba(155,166,173,.28)";
    ctx.lineWidth = Math.max(1, view.tilePx * 0.018);
    for (let i = -1; i <= 1; i++) {
      const y = p.y - h * 0.47 + i * view.tilePx * 0.055;
      ctx.beginPath();
      ctx.moveTo(p.x - w * 0.30, y);
      ctx.lineTo(p.x - w * 0.06, y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(p.x + w * 0.06, y);
      ctx.lineTo(p.x + w * 0.30, y);
      ctx.stroke();
    }

    // Handles.
    ctx.fillStyle = "#111619";
    ctx.fillRect(
      p.x - view.tilePx * 0.055,
      p.y - h * 0.12,
      view.tilePx * 0.035,
      view.tilePx * 0.11
    );
    ctx.fillRect(
      p.x + view.tilePx * 0.02,
      p.y - h * 0.12,
      view.tilePx * 0.035,
      view.tilePx * 0.11
    );

    if (near || occupied) {
      const pulse = 0.72 + Math.sin(timeSeconds * 4.2) * 0.13;
      ctx.font = `900 ${Math.max(9, view.tilePx * 0.20)}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = occupied
        ? `rgba(130,242,187,${pulse})`
        : `rgba(255,214,119,${pulse})`;
      ctx.fillText(
        occupied ? "E · LEAVE" : "E · HIDE",
        p.x,
        p.y - h * 0.90
      );
    }

    ctx.restore();
  }

  function drawKey(key, timeSeconds) {
    if (key.collected) return;

    const p = worldToScreen(key.x, key.y);
    const pulse = 0.90 + Math.sin(timeSeconds * 4.2 + key.id) * 0.08;
    const size = view.tilePx * 0.23 * pulse;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.PI / 4 + timeSeconds * 0.35);

    ctx.shadowBlur = view.tilePx * 0.55;
    ctx.shadowColor = "#ffc857";
    ctx.fillStyle = "#ffc857";
    ctx.fillRect(-size, -size, size * 2, size * 2);

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#5d3c0b";
    ctx.fillRect(-size * 0.24, -size * 0.24, size * 0.48, size * 0.48);

    ctx.restore();
  }

  function drawPlayer() {
    const p = worldToScreen(player.x, player.y);

    if (player.hidden) {
      // The player is inside the hiding spot. Only show a subtle status marker.
      ctx.save();
      ctx.font = `900 ${Math.max(10, view.tilePx * 0.23)}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(158, 247, 201, .82)";
      ctx.shadowBlur = view.tilePx * 0.3;
      ctx.shadowColor = "rgba(80, 220, 155, .6)";
      ctx.fillText("HIDDEN", p.x, p.y - view.tilePx * 0.62);
      ctx.restore();
      return;
    }

    // Soft ground shadow keeps the sprite readable against the maze floor.
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.36)";
    ctx.beginPath();
    ctx.ellipse(
      p.x,
      p.y + view.tilePx * 0.22,
      view.tilePx * 0.34,
      view.tilePx * 0.15,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    if (playerSprite.complete && playerSprite.naturalWidth > 0) {
      // The sprite sheet is 4 columns x 4 rows.
      // Rows: down, up, left, right. Columns: animation frames 0..3.
      const frameW = playerSprite.naturalWidth / 4;
      const frameH = playerSprite.naturalHeight / 4;
      const rowByDirection = { down: 0, up: 1, left: 2, right: 3 };
      const row = rowByDirection[player.direction] ?? 0;
      const frame = player.moving ? player.frame : 0;

      const sx = frame * frameW;
      const sy = row * frameH;

      // Render larger than the collision circle, anchored around the feet.
      const drawW = view.tilePx * 0.98;
      const drawH = drawW * (frameH / frameW);
      const drawX = p.x - drawW / 2;
      const drawY = p.y - drawH * 0.72;

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(
        playerSprite,
        sx, sy, frameW, frameH,
        drawX, drawY, drawW, drawH
      );
      ctx.restore();
      return;
    }

    // Fallback while the sprite image loads.
    const r = view.tilePx * player.radius;
    ctx.save();
    ctx.shadowBlur = view.tilePx * 0.5;
    ctx.shadowColor = "#83d9ff";
    ctx.fillStyle = "#dff5ff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawVisionCone(enemy) {
    const origin = worldToScreen(enemy.x, enemy.y);
    const centerAngle = enemy.getFacingAngle();
    const bonus = enemy.state === "CHASE" ? 14 : 0;
    const halfAngle = ((enemy.visionAngle + bonus) * Math.PI / 180) / 2;
    const rayCount = 22;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);

    for (let i = 0; i <= rayCount; i++) {
      const t = i / rayCount;
      const angle = centerAngle - halfAngle + t * halfAngle * 2;
      const distance = maze.raycastDistance(enemy, angle, enemy.visionTiles);

      const wx = enemy.x + Math.cos(angle) * distance;
      const wy = enemy.y + Math.sin(angle) * distance;
      const p = worldToScreen(wx, wy);
      ctx.lineTo(p.x, p.y);
    }

    ctx.closePath();

    const typeAlpha =
      enemy.type === "scout" ? 1.20 :
      enemy.type === "brute" ? 0.78 :
      enemy.type === "stalker" ? 0.92 :
      1.00;

    if (enemy.state === "CHASE") {
      ctx.fillStyle = `rgba(255, 42, 62, ${0.20 * typeAlpha})`;
      ctx.strokeStyle = `rgba(255, 72, 88, ${0.30 * typeAlpha})`;
    } else if (enemy.state === "SEARCH") {
      ctx.fillStyle = `rgba(255, 185, 70, ${0.10 * typeAlpha})`;
      ctx.strokeStyle = `rgba(255, 204, 100, ${0.20 * typeAlpha})`;
    } else {
      ctx.fillStyle = `rgba(255, 64, 78, ${0.095 * typeAlpha})`;
      ctx.strokeStyle = `rgba(255, 90, 100, ${0.15 * typeAlpha})`;
    }

    ctx.fill();
    ctx.lineWidth = Math.max(1, view.tilePx * 0.025);
    ctx.stroke();
    ctx.restore();
  }

  function getEnemyTypeVisual(enemy) {
    switch (enemy.type) {
      case "scout":
        return {
          ring: "rgba(255, 213, 84, .70)",
          shadow: "rgba(255, 203, 70, .70)",
          label: "SCOUT"
        };

      case "brute":
        return {
          ring: "rgba(201, 105, 255, .68)",
          shadow: "rgba(177, 72, 255, .66)",
          label: "BRUTE"
        };

      case "stalker":
        return {
          ring: "rgba(106, 220, 255, .66)",
          shadow: "rgba(71, 184, 230, .68)",
          label: "STALKER"
        };

      default:
        return {
          ring: "rgba(255, 82, 98, .60)",
          shadow: "rgba(255,55,75,.82)",
          label: "HUNTER"
        };
    }
  }

  function drawEnemy(enemy) {
    const p = worldToScreen(enemy.x, enemy.y);
    const typeVisual = getEnemyTypeVisual(enemy);

    // Small identification ring below the enemy.
    ctx.save();
    ctx.strokeStyle = typeVisual.ring;
    ctx.lineWidth = Math.max(1, view.tilePx * 0.035);
    ctx.beginPath();
    ctx.ellipse(
      p.x,
      p.y + view.tilePx * 0.22,
      view.tilePx * (enemy.type === "brute" ? 0.40 : 0.34),
      view.tilePx * 0.16,
      0,
      0,
      Math.PI * 2
    );
    ctx.stroke();
    ctx.restore();

    // Ground shadow.
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.46)";
    ctx.beginPath();
    ctx.ellipse(
      p.x,
      p.y + view.tilePx * 0.23,
      view.tilePx * 0.38,
      view.tilePx * 0.17,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    if (enemySprite.complete && enemySprite.naturalWidth > 0) {
      const frameW = enemySprite.naturalWidth / 4;
      const frameH = enemySprite.naturalHeight / 4;
      const rowByDirection = { down: 0, up: 1, left: 2, right: 3 };
      const row = rowByDirection[enemy.direction] ?? 0;
      const frame = enemy.moving ? enemy.frame : 0;

      const sx = frame * frameW;
      const sy = row * frameH;

      // Different enemy types have slightly different silhouettes/sizes.
      const drawScale =
        enemy.type === "brute" ? 1.29 :
        enemy.type === "scout" ? 1.04 :
        enemy.type === "stalker" ? 1.10 :
        1.13;

      const drawW = view.tilePx * drawScale;
      const drawH = drawW * (frameH / frameW);
      const drawX = p.x - drawW / 2;
      const drawY = p.y - drawH * 0.76;

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.shadowBlur =
        enemy.state === "CHASE" ? view.tilePx * 0.7 :
        enemy.state === "SEARCH" ? view.tilePx * 0.35 :
        view.tilePx * 0.18;
      ctx.shadowColor =
        enemy.state === "SEARCH"
          ? "rgba(255,209,102,.8)"
          : typeVisual.shadow;

      ctx.drawImage(
        enemySprite,
        sx, sy, frameW, frameH,
        drawX, drawY, drawW, drawH
      );
      ctx.restore();

      // Alert indicator helps the player immediately understand enemy state.
      if (enemies.length > 1) {
        const enemyNumber = enemies.indexOf(enemy) + 1;
        ctx.save();
        ctx.font = `800 ${Math.max(7, view.tilePx * 0.17)}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255,255,255,.66)";
        ctx.fillText(
          `#${enemyNumber} ${typeVisual.label}`,
          p.x,
          drawY + view.tilePx * 0.05
        );
        ctx.restore();
      }

      if (enemy.state === "CHASE" || enemy.state === "SEARCH") {
        ctx.save();
        ctx.font = `900 ${Math.max(15, view.tilePx * 0.56)}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = enemy.state === "CHASE" ? "#ff4054" : "#ffd166";
        ctx.shadowBlur = view.tilePx * 0.25;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fillText(enemy.state === "CHASE" ? "!" : "?", p.x, drawY - view.tilePx * 0.08);
        ctx.restore();
      }
      return;
    }

    // Fallback while the sprite loads.
    const r = view.tilePx * enemy.radius;
    ctx.save();
    ctx.fillStyle = "#ff4054";
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawLighting() {
    const p = worldToScreen(player.x, player.y);
    const mobile = matchMedia("(pointer: coarse)").matches || view.cssW < 720;
    const lightRadius = view.tilePx * (
      player.hidden
        ? (mobile ? 3.8 : 4.5)
        : (mobile ? 6.0 : 7.3)
    );

    // Warm center glow from the player's light.
    const warm = ctx.createRadialGradient(
      p.x, p.y, 0,
      p.x, p.y, view.tilePx * 3.4
    );
    warm.addColorStop(0, "rgba(236, 205, 155, 0.095)");
    warm.addColorStop(1, "rgba(236, 205, 155, 0)");
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, view.cssW, view.cssH);

    const gradient = ctx.createRadialGradient(
      p.x, p.y, view.tilePx * 1.15,
      p.x, p.y, lightRadius
    );
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.52, "rgba(0,0,0,0.10)");
    gradient.addColorStop(0.78, "rgba(0,0,0,0.72)");
    gradient.addColorStop(0.94, "rgba(0,0,0,0.97)");
    gradient.addColorStop(1, "rgba(0,0,0,1)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, view.cssW, view.cssH);

    if (player.hidden) {
      ctx.fillStyle = "rgba(0, 12, 10, .16)";
      ctx.fillRect(0, 0, view.cssW, view.cssH);
    }
  }

  function drawThreatVignette() {
    if (!enemies.length) return;

    let nearest = Infinity;
    let anyChasing = false;

    for (const enemy of enemies) {
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      nearest = Math.min(nearest, Math.hypot(dx, dy));
      if (enemy.state === "CHASE") anyChasing = true;
    }

    let alpha = 0;
    if (anyChasing) alpha = Math.max(0.10, 0.38 - nearest * 0.026);
    else if (nearest < 5) alpha = (5 - nearest) * 0.02;

    if (alpha <= 0) return;

    const g = ctx.createRadialGradient(
      view.cssW / 2, view.cssH / 2, Math.min(view.cssW, view.cssH) * 0.2,
      view.cssW / 2, view.cssH / 2, Math.max(view.cssW, view.cssH) * 0.7
    );
    g.addColorStop(0, "rgba(100,0,0,0)");
    g.addColorStop(1, `rgba(180,0,18,${Math.min(0.32, alpha)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.cssW, view.cssH);
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  loadProgress();
  loadLevel(0);
  updateSoundLabels();
  showMainMenu();
  requestAnimationFrame(loop);
})();
