class Controls {
  constructor() {
    this.keys = new Set();
    this.touch = { up: false, down: false, left: false, right: false };
    this.interactQueued = false;

    const preventKeys = new Set([
      "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
      "KeyW", "KeyA", "KeyS", "KeyD", "KeyE"
    ]);

    window.addEventListener("keydown", (event) => {
      if (preventKeys.has(event.code)) event.preventDefault();

      if (event.code === "KeyE" && !event.repeat) {
        this.interactQueued = true;
      }

      this.keys.add(event.code);
    }, { passive: false });

    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
    });

    const interactBtn = document.getElementById("interactBtn");
    if (interactBtn) {
      interactBtn.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.interactQueued = true;
      }, { passive: false });
    }

    document.querySelectorAll(".dpad").forEach((button) => {
      const dir = button.dataset.dir;

      const on = (event) => {
        event.preventDefault();
        this.touch[dir] = true;
        button.classList.add("active");
        if (button.setPointerCapture && event.pointerId !== undefined) {
          try { button.setPointerCapture(event.pointerId); } catch (_) {}
        }
      };

      const off = (event) => {
        event.preventDefault();
        this.touch[dir] = false;
        button.classList.remove("active");
      };

      button.addEventListener("pointerdown", on, { passive: false });
      button.addEventListener("pointerup", off, { passive: false });
      button.addEventListener("pointercancel", off, { passive: false });
      button.addEventListener("pointerleave", (e) => {
        if (e.buttons === 0) off(e);
      }, { passive: false });
    });
  }

  get x() {
    const left = this.keys.has("ArrowLeft") || this.keys.has("KeyA") || this.touch.left;
    const right = this.keys.has("ArrowRight") || this.keys.has("KeyD") || this.touch.right;
    return (right ? 1 : 0) - (left ? 1 : 0);
  }

  get y() {
    const up = this.keys.has("ArrowUp") || this.keys.has("KeyW") || this.touch.up;
    const down = this.keys.has("ArrowDown") || this.keys.has("KeyS") || this.touch.down;
    return (down ? 1 : 0) - (up ? 1 : 0);
  }

  consumeInteract() {
    const value = this.interactQueued;
    this.interactQueued = false;
    return value;
  }

  resetTouch() {
    this.interactQueued = false;
    for (const k of Object.keys(this.touch)) this.touch[k] = false;
    document.querySelectorAll(".dpad.active").forEach(b => b.classList.remove("active"));
  }
}
