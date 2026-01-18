import React, { useRef, useEffect } from 'react';

interface TimelineChartProps {
  data: { time: number; value: number }[];
  label: string;
  color: string;
}

export function TimelineChart({ data, label, color }: TimelineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    if (data.length < 2) return;

    const maxValue = Math.max(...data.map(d => d.value), 100);
    const minValue = Math.min(...data.map(d => d.value), 0);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((point.value - minValue) / (maxValue - minValue)) * height;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  }, [data, color]);

  return (
    <div className="timeline-chart">
      <h4>{label}</h4>
      <canvas ref={canvasRef} width={300} height={100} />
    </div>
  );
}
