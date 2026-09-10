class Player {
  constructor(tile, speed) {
    this.x = tile.x + 0.5;
    this.y = tile.y + 0.5;
    this.radius = 0.28;
    this.speed = speed;

    // Animation state
    this.direction = "down";
    this.moving = false;
    this.frame = 0;
    this.animTime = 0;
    this.frameDuration = 0.115; // seconds per walk frame

    this.hidden = false;
    this.hideSpotId = null;
  }

  update(dt, controls, maze) {
    if (this.hidden) {
      this.moving = false;
      this.animTime = 0;
      this.frame = 0;
      return;
    }

    let dx = controls.x;
    let dy = controls.y;

    this.moving = dx !== 0 || dy !== 0;

    // Remember the direction the player is facing.
    // If moving diagonally, use the stronger/latest-looking axis.
    if (this.moving) {
      if (Math.abs(dx) > Math.abs(dy)) {
        this.direction = dx < 0 ? "left" : "right";
      } else if (dy !== 0) {
        this.direction = dy < 0 ? "up" : "down";
      } else if (dx !== 0) {
        this.direction = dx < 0 ? "left" : "right";
      }
    }

    if (dx !== 0 && dy !== 0) {
      const inv = 1 / Math.sqrt(2);
      dx *= inv;
      dy *= inv;
    }

    const step = this.speed * dt;
    let actuallyMoved = false;

    if (dx !== 0) {
      const nextX = this.x + dx * step;
      if (!maze.circleHitsWall(nextX, this.y, this.radius)) {
        this.x = nextX;
        actuallyMoved = true;
      }
    }

    if (dy !== 0) {
      const nextY = this.y + dy * step;
      if (!maze.circleHitsWall(this.x, nextY, this.radius)) {
        this.y = nextY;
        actuallyMoved = true;
      }
    }

    // Animate only when the character really moved.
    this.moving = actuallyMoved;
    if (this.moving) {
      this.animTime += dt;
      while (this.animTime >= this.frameDuration) {
        this.animTime -= this.frameDuration;
        this.frame = (this.frame + 1) % 4;
      }
    } else {
      this.animTime = 0;
      this.frame = 0;
    }
  }
}
