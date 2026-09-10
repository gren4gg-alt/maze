class Maze {
  constructor(level) {
    this.rows = level.map.map(row => row.split(""));
    this.height = this.rows.length;
    this.width = this.rows[0].length;
    this.playerStart = null;
    this.enemyStarts = [];
    this.keyStarts = [];
    this.hideStarts = [];
    this.exit = null;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.rows[y][x];
        if (cell === "P") {
          this.playerStart = { x, y };
          this.rows[y][x] = ".";
        } else if (cell === "E") {
          this.enemyStarts.push({ x, y });
          this.rows[y][x] = ".";
        } else if (cell === "K") {
          this.keyStarts.push({ x, y });
          this.rows[y][x] = ".";
        } else if (cell === "H") {
          this.hideStarts.push({ x, y });
          this.rows[y][x] = ".";
        } else if (cell === "X") {
          this.exit = { x, y };
          this.rows[y][x] = ".";
        }
      }
    }

    if (this.enemyStarts.length === 0) {
      outer:
      for (let y = this.height - 2; y >= 1; y--) {
        for (let x = this.width - 2; x >= 1; x--) {
          if (this.isWalkable(x, y)) {
            this.enemyStarts.push({ x, y });
            break outer;
          }
        }
      }
    }
  }

  isWall(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return true;
    return this.rows[ty][tx] === "#";
  }

  isWalkable(tx, ty) {
    return !this.isWall(tx, ty);
  }

  getWallBounds(tx, ty) {
    // 5% inset from each wall edge that borders floor.
    // Two opposing walls therefore give roughly 10% more corridor width.
    const inset = 0.05;

    let left = tx;
    let right = tx + 1;
    let top = ty;
    let bottom = ty + 1;

    if (this.isWalkable(tx - 1, ty)) left += inset;
    if (this.isWalkable(tx + 1, ty)) right -= inset;
    if (this.isWalkable(tx, ty - 1)) top += inset;
    if (this.isWalkable(tx, ty + 1)) bottom -= inset;

    return { left, right, top, bottom };
  }

  circleHitsWall(x, y, radius) {
    const minX = Math.floor(x - radius);
    const maxX = Math.floor(x + radius);
    const minY = Math.floor(y - radius);
    const maxY = Math.floor(y + radius);

    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        if (!this.isWall(tx, ty)) continue;

        const bounds = this.getWallBounds(tx, ty);
        const nearestX = Math.max(bounds.left, Math.min(x, bounds.right));
        const nearestY = Math.max(bounds.top, Math.min(y, bounds.bottom));
        const dx = x - nearestX;
        const dy = y - nearestY;

        if (dx * dx + dy * dy < radius * radius) return true;
      }
    }
    return false;
  }

  tileCenter(tile) {
    return { x: tile.x + 0.5, y: tile.y + 0.5 };
  }

  worldToTile(x, y) {
    return { x: Math.floor(x), y: Math.floor(y) };
  }

  // True line-of-sight check between any two world-space points.
  // Sampling is deliberately fine enough that a wall tile cannot be skipped.
  hasClearLine(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.001) return true;

    const step = 0.08;
    const steps = Math.ceil(distance / step);

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = a.x + dx * t;
      const y = a.y + dy * t;
      if (this.isWall(Math.floor(x), Math.floor(y))) return false;
    }
    return true;
  }

  // Returns how far a vision ray can travel before striking a wall.
  // Used to draw a vision cone that visually stops at walls.
  raycastDistance(origin, angle, maxDistance) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const step = 0.07;

    for (let distance = step; distance <= maxDistance; distance += step) {
      const x = origin.x + dx * distance;
      const y = origin.y + dy * distance;

      if (this.isWall(Math.floor(x), Math.floor(y))) {
        return Math.max(0, distance - step * 0.55);
      }
    }

    return maxDistance;
  }
}
