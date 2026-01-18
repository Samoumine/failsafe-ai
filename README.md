# Failsafe AI - Risk-Aware Tetris

A risk-aware Tetris game with AI-assisted decision making and agent comparison features.

## Features

- **Risk Heatmap**: Visual overlay showing best (green) and worst (red) placement options
- **SAM Integration**: Connects to Solace Agent Mesh for advanced risk assessment
- **Engagement Metrics**: Tracks player behavior and risk patterns
- **Compare Mode**: Compare different agent policies and strategies

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Controls

| Key | Action |
|-----|--------|
| ← / A | Move Left |
| → / D | Move Right |
| ↓ / S | Soft Drop |
| ↑ / W / Space | Rotate |
| Enter | Hard Drop |
| P / Esc | Pause |

## SAM Sidecar Integration

The game can connect to a SAM (Solace Agent Mesh) sidecar for advanced risk assessment.

### Starting SAM

```bash
cd sam
./run_api.sh
```

This starts the SAM Decision API on http://localhost:8001.

### Using SAM in the UI

1. Start the SAM API server (above)
2. In the game UI, toggle "Use SAM Sidecar" in the right panel
3. The SAM Decision panel will show:
   - **Mode**: ASSIST, EXPLAIN_ONLY, or MANUAL_CONFIRM
   - **Risk Score**: 0-1 risk assessment
   - **Reason**: Why this risk level
   - **Explanation**: Detailed reasoning

### API Endpoint

**POST** `http://localhost:8001/api/decision`

Request:
```json
{
  "board": [[0,0,0,...], ...],
  "currentPiece": "T",
  "x": 5,
  "y": 0,
  "rotation": 0,
  "metrics": {
    "engagementScore": 0.5,
    "blindAcceptStreak": 0,
    "overrideRate": 0,
    "hesitationRate": 0
  }
}
```

Response:
```json
{
  "riskScore": 0.3,
  "mode": "ASSIST",
  "reason": "Low risk position",
  "explanation": "This placement creates minimal holes..."
}
```

## Project Structure

```
src/
├── agents/           # AI agent implementations
├── compare/          # Comparison mode components
├── components/       # React components
├── core/             # Core utilities
│   ├── eventBus.ts   # Event publishing
│   ├── samClient.ts  # SAM API client
│   ├── topics.ts     # Event topics
│   └── types.ts      # TypeScript types
├── game/             # Game engine
│   ├── engine.ts     # Core game logic
│   ├── heatmap.ts    # Placement scoring
│   ├── reachability.ts # BFS reachability
│   └── reducer.ts    # Game state reducer
└── routes/           # Page routes
    ├── PlayPage.tsx  # Main game page
    └── ComparePage.tsx # Comparison page
```

## Development

```bash
npm run dev    # Start dev server
npm run build  # Build for production
npm run lint   # Run ESLint
```
