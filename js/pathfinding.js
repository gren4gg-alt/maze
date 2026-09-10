function findPath(maze, start, goal) {
  const key = (x, y) => `${x},${y}`;
  const queue = [start];
  const cameFrom = new Map();
  cameFrom.set(key(start.x, start.y), null);

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];

    if (current.x === goal.x && current.y === goal.y) break;

    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 }
    ];

    for (const next of neighbors) {
      const k = key(next.x, next.y);
      if (!maze.isWalkable(next.x, next.y) || cameFrom.has(k)) continue;
      cameFrom.set(k, current);
      queue.push(next);
    }
  }

  const goalKey = key(goal.x, goal.y);
  if (!cameFrom.has(goalKey)) return [];

  const path = [];
  let cur = goal;
  while (cur) {
    path.push(cur);
    cur = cameFrom.get(key(cur.x, cur.y));
  }

  path.reverse();
  return path;
}
