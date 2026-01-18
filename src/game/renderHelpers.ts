export function getCellColor(type: number): string {
  const colors: Record<number, string> = {
    0: '#1a1a2e',
    1: '#00d4ff', // I
    2: '#0055ff', // J
    3: '#ffaa00', // L
    4: '#ffdd00', // O
    5: '#00ff66', // S
    6: '#aa00ff', // T
    7: '#ff0055', // Z
  };
  return colors[type] || colors[0];
}

export function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x * size, y * size, size, size);
  ctx.strokeStyle = '#0f0f1a';
  ctx.lineWidth = 1;
  ctx.strokeRect(x * size, y * size, size, size);
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cellSize: number
): void {
  ctx.strokeStyle = '#2a2a3e';
  ctx.lineWidth = 0.5;
  
  for (let x = 0; x <= width; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cellSize, 0);
    ctx.lineTo(x * cellSize, height * cellSize);
    ctx.stroke();
  }
  
  for (let y = 0; y <= height; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cellSize);
    ctx.lineTo(width * cellSize, y * cellSize);
    ctx.stroke();
  }
}
