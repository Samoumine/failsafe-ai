# Failsafe AI - Risk-Aware Tetris

A risk-aware Tetris game with AI-assisted decision making and agent comparison features.

## Live Demo

**Frontend:** https://failsafe-ai.vercel.app/play

1. Start the SAM API server (above)
2. In the game UI, toggle "Enable SAM" in the right panel
3. The SAM Decision panel will show:
   - **Mode**: EXPLAIN_ONLY, ASSIST, or MANUAL_CONFIRM
   - **Risk Score**: 0-1 risk assessment
   - **Risk Factors**: Specific reasons for the score
   - **Guardrails**: Actionable warnings



## Design Iterations

The project evolved through three iterations to find the optimal approach for AI-assisted gameplay:

### Iteration 1: Best/Worst Move Suggestions

Shows both the best and worst possible moves to help players learn.

- **What it shows:** Highlights optimal placement (green) and dangerous placements (red)
- **Pros:** Clear guidance on what to do AND what NOT to do
- **Cons:** Players naturally focus only on positive suggestions, ignoring warnings about bad moves

### Iteration 2: Bad Move Detection Only

Only highlights dangerous or problematic moves.

- **What it shows:** Red overlay on placements that would create holes or stack too high
- **Pros:** Less visual clutter, focuses on prevention rather than optimization
- **Cons:** Some board states have many bad moves, leading to visual overload and decision paralysis

### Iteration 3: Risk Metrics (Final Solution)

Real-time quantified risk scoring with actionable guardrails.

- **What it shows:**
  - Risk score (0.0 - 1.0) with visual progress bar
  - Risk factors (e.g., "creates 3 holes", "blocks future pieces")
  - Guardrails with specific warnings
  - SAM modes: EXPLAIN_ONLY, ASSIST, MANUAL_CONFIRM

- **Pros:**
  - Combines benefits of both previous approaches
  - Quantifies risk for informed decision-making
  - Provides specific, actionable explanations
  - Scales gracefully across all board states
  - Empowers human judgment with data-driven insights

### Why Iteration 3 Wins

The risk metrics approach eliminates the key flaws of earlier iterations:

| Problem | Iteration 1 | Iteration 2 | Iteration 3 |
|---------|-------------|-------------|-------------|
| Ignoring warnings | ✅ Still happens | N/A | ✅ Risk score demands attention |
| Visual overload | ✅ Too many highlights | ❌ Too many red areas | ✅ Single score, one bar |
| Actionable insights | ⚠️ Generic suggestions | ⚠️ Only shows "bad" | ✅ Specific risk factors |
| Human-AI collaboration | ❌ AI decides | ⚠️ AI restricts | ✅ Human decides with data |

---

## Features

- **Risk Heatmap**: Visual overlay showing placement scoring
- **SAM Integration**: Connects to Solace Agent Mesh for advanced risk assessment
- **Engagement Metrics**: Tracks player behavior and risk patterns
- **Compare Mode**: Compare different agent policies and strategies

## Controls

| Key | Action |
|-----|--------|
| ← / A | Move Left |
| → / D | Move Right |
| ↓ / S | Soft Drop |
| ↑ / W / Space | Rotate |
| P / Esc | Pause |
