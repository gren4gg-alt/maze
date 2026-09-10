const ENEMY_TYPES = {
  hunter: {
    name: "Hunter",
    speed: 1.00,
    patrolSpeed: 0.62,
    chaseSpeed: 1.12,
    vision: 1.00,
    visionAngleBonus: 0,
    hearing: 1.00,
    search: 1.00,
    chaseMemory: 1.00
  },

  scout: {
    name: "Scout",
    speed: 1.20,
    patrolSpeed: 0.72,
    chaseSpeed: 1.18,
    vision: 1.22,
    visionAngleBonus: 10,
    hearing: 0.82,
    search: 0.84,
    chaseMemory: 0.90
  },

  brute: {
    name: "Brute",
    speed: 0.86,
    patrolSpeed: 0.54,
    chaseSpeed: 1.03,
    vision: 0.82,
    visionAngleBonus: -8,
    hearing: 1.52,
    search: 1.16,
    chaseMemory: 1.10
  },

  stalker: {
    name: "Stalker",
    speed: 0.94,
    patrolSpeed: 0.48,
    chaseSpeed: 1.34,
    vision: 1.05,
    visionAngleBonus: -12,
    hearing: 1.00,
    search: 1.48,
    chaseMemory: 1.30
  }
};

class Enemy {
  constructor(tile, level, type = "hunter") {
    this.type = ENEMY_TYPES[type] ? type : "hunter";
    this.profile = ENEMY_TYPES[this.type];

    this.x = tile.x + 0.5;
    this.y = tile.y + 0.5;
    this.radius = this.type === "brute" ? 0.33 : 0.29;

    this.baseSpeed = level.enemySpeed * this.profile.speed;
    this.visionTiles = level.visionTiles * this.profile.vision;
    this.visionAngle = (level.visionAngle ?? 86) + this.profile.visionAngleBonus;
    this.hearingTiles = (level.hearingTiles ?? 1.7) * this.profile.hearing;
    this.searchSeconds = level.searchSeconds * this.profile.search;

    this.state = "PATROL";
    this.path = [];
    this.pathIndex = 0;
    this.pathCooldown = 0;
    this.searchTimer = 0;
    this.lastSeenTile = null;
    this.patrolTarget = null;

    this.direction = "down";
    this.moving = false;
    this.frame = 0;
    this.animTime = 0;

    this.seesPlayer = false;
    this.hearsPlayer = false;
  }

  get displayName() {
    return this.profile.name;
  }

  getFacingVector() {
    switch (this.direction) {
      case "up": return { x: 0, y: -1 };
      case "left": return { x: -1, y: 0 };
      case "right": return { x: 1, y: 0 };
      default: return { x: 0, y: 1 };
    }
  }

  getFacingAngle() {
    switch (this.direction) {
      case "up": return -Math.PI / 2;
      case "left": return Math.PI;
      case "right": return 0;
      default: return Math.PI / 2;
    }
  }

  isPlayerInsideVisionCone(maze, player) {
    if (player.hidden) return false;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance > this.visionTiles || distance < 0.001) return false;

    const facing = this.getFacingVector();
    const nx = dx / distance;
    const ny = dy / distance;
    const dot = Math.max(-1, Math.min(1, facing.x * nx + facing.y * ny));
    const angleToPlayer = Math.acos(dot);

    const chaseBonus = this.state === "CHASE" ? 14 : 0;
    const halfAngle = ((this.visionAngle + chaseBonus) * Math.PI / 180) / 2;

    if (angleToPlayer > halfAngle) return false;
    return maze.hasClearLine(this, player);
  }

  update(dt, maze, player) {
    const oldX = this.x;
    const oldY = this.y;

    this.faceNextPathNode();
    this.seesPlayer = this.isPlayerInsideVisionCone(maze, player);

    const playerTile = maze.worldToTile(player.x, player.y);
    const enemyTile = maze.worldToTile(this.x, this.y);

    const dx = this.x - player.x;
    const dy = this.y - player.y;
    const distanceSq = dx * dx + dy * dy;

    const hearing = player.hidden ? 0 : (player.moving ? this.hearingTiles : 0.72);
    this.hearsPlayer = !player.hidden && distanceSq < hearing * hearing;

    if (this.seesPlayer || this.hearsPlayer) {
      this.state = "CHASE";
      this.lastSeenTile = { ...playerTile };
      this.searchTimer = this.searchSeconds;
    } else if (this.state === "CHASE") {
      this.state = "SEARCH";
    }

    if (this.state === "SEARCH") {
      this.searchTimer -= dt;
      if (this.searchTimer <= 0) {
        this.state = "PATROL";
        this.lastSeenTile = null;
        this.path = [];
        this.patrolTarget = null;
      }
    }

    this.pathCooldown -= dt;

    if (this.state === "CHASE") {
      if (this.pathCooldown <= 0) {
        const target = (this.seesPlayer || this.hearsPlayer)
          ? playerTile
          : (this.lastSeenTile || playerTile);

        this.path = findPath(maze, enemyTile, target);
        this.pathIndex = Math.min(1, this.path.length - 1);

        // Scouts recalculate fastest. Brutes are slower to react.
        if (this.type === "scout") this.pathCooldown = 0.11;
        else if (this.type === "brute") this.pathCooldown = 0.22;
        else if (this.type === "stalker") this.pathCooldown = 0.14;
        else this.pathCooldown = 0.16;
      }

      this.followPath(
        dt,
        maze,
        this.baseSpeed * this.profile.chaseSpeed
      );
    } else if (this.state === "SEARCH") {
      if (this.lastSeenTile && (this.pathCooldown <= 0 || this.path.length === 0)) {
        this.path = findPath(maze, enemyTile, this.lastSeenTile);
        this.pathIndex = Math.min(1, this.path.length - 1);
        this.pathCooldown = 0.50 / this.profile.chaseMemory;
      }

      if (this.path.length <= 1 || this.pathIndex >= this.path.length) {
        this.pickNearbySearchTarget(maze);
      }

      this.followPath(dt, maze, this.baseSpeed);
    } else {
      if (!this.patrolTarget || this.path.length <= 1 || this.pathIndex >= this.path.length) {
        this.pickPatrolTarget(maze);
      }

      this.followPath(
        dt,
        maze,
        this.baseSpeed * this.profile.patrolSpeed
      );
    }

    this.updateAnimation(dt, oldX, oldY);
  }

  faceNextPathNode() {
    if (!this.path.length || this.pathIndex >= this.path.length) return;

    const target = this.path[this.pathIndex];
    const tx = target.x + 0.5;
    const ty = target.y + 0.5;
    const dx = tx - this.x;
    const dy = ty - this.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > 0.03) this.direction = dx < 0 ? "left" : "right";
    } else {
      if (Math.abs(dy) > 0.03) this.direction = dy < 0 ? "up" : "down";
    }
  }

  updateAnimation(dt, oldX, oldY) {
    const dx = this.x - oldX;
    const dy = this.y - oldY;
    this.moving = Math.hypot(dx, dy) > 0.0001;

    if (this.moving) {
      if (Math.abs(dx) > Math.abs(dy)) {
        this.direction = dx < 0 ? "left" : "right";
      } else {
        this.direction = dy < 0 ? "up" : "down";
      }

      let frameDuration = 0.145;

      if (this.state === "CHASE") {
        frameDuration =
          this.type === "scout" ? 0.075 :
          this.type === "stalker" ? 0.085 :
          this.type === "brute" ? 0.12 :
          0.095;
      }

      this.animTime += dt;

      while (this.animTime >= frameDuration) {
        this.animTime -= frameDuration;
        this.frame = (this.frame + 1) % 4;
      }
    } else {
      this.animTime = 0;
      this.frame = 0;
    }
  }

  followPath(dt, maze, speed) {
    if (!this.path.length || this.pathIndex >= this.path.length) return;

    const targetTile = this.path[this.pathIndex];
    const target = maze.tileCenter(targetTile);
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance < 0.04) {
      this.x = target.x;
      this.y = target.y;
      this.pathIndex++;
      return;
    }

    const amount = Math.min(distance, speed * dt);
    this.x += (dx / distance) * amount;
    this.y += (dy / distance) * amount;
  }

  pickPatrolTarget(maze) {
    const start = maze.worldToTile(this.x, this.y);

    for (let tries = 0; tries < 50; tries++) {
      const tx = 1 + Math.floor(Math.random() * (maze.width - 2));
      const ty = 1 + Math.floor(Math.random() * (maze.height - 2));

      if (!maze.isWalkable(tx, ty)) continue;

      const distance = Math.abs(tx - start.x) + Math.abs(ty - start.y);

      const minimum =
        this.type === "stalker" ? 4 :
        this.type === "scout" ? 8 :
        7;

      if (distance < minimum) continue;

      const path = findPath(maze, start, { x: tx, y: ty });

      if (path.length > minimum - 1) {
        this.patrolTarget = { x: tx, y: ty };
        this.path = path;
        this.pathIndex = 1;
        return;
      }
    }
  }

  pickNearbySearchTarget(maze) {
    const start = maze.worldToTile(this.x, this.y);
    const options = [];

    const radius =
      this.type === "stalker" ? 7 :
      this.type === "brute" ? 4 :
      5;

    for (
      let y = Math.max(1, start.y - radius);
      y <= Math.min(maze.height - 2, start.y + radius);
      y++
    ) {
      for (
        let x = Math.max(1, start.x - radius);
        x <= Math.min(maze.width - 2, start.x + radius);
        x++
      ) {
        if (maze.isWalkable(x, y)) options.push({ x, y });
      }
    }

    if (!options.length) return;

    const target = options[Math.floor(Math.random() * options.length)];
    this.path = findPath(maze, start, target);
    this.pathIndex = Math.min(1, this.path.length - 1);
  }
}
