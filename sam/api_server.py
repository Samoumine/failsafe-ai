import sys
import json
import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Literal, Optional
from fastapi.middleware.cors import CORSMiddleware

print(f"API_SERVER_LOADED: {__file__}", flush=True)

Mode = Literal["ASSIST", "EXPLAIN_ONLY", "MANUAL_CONFIRM"]

class Metrics(BaseModel):
    engagementScore: float = 0.7
    blindAcceptStreak: int = 0
    overrideRate: float = 0.0
    hesitationRate: float = 0.0

class DecisionRequest(BaseModel):
    board: List[List[int]]
    currentPiece: str
    x: int
    y: int
    rotation: int
    metrics: Metrics = Field(default_factory=Metrics)

class DecisionResponse(BaseModel):
    riskScore: float
    mode: Mode
    reason: str
    explanation: str

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


def compute_holes(board: List[List[int]]) -> int:
    holes = 0
    rows = len(board)
    cols = len(board[0]) if rows else 0
    for c in range(cols):
        seen_block = False
        for r in range(rows):
            if board[r][c] != 0:
                seen_block = True
            elif seen_block and board[r][c] == 0:
                holes += 1
    return holes

def column_heights(board: List[List[int]]) -> List[int]:
    rows = len(board)
    cols = len(board[0]) if rows else 0
    heights = [0] * cols
    for c in range(cols):
        h = 0
        for r in range(rows):
            if board[r][c] != 0:
                h = rows - r
                break
        heights[c] = h
    return heights

def bumpiness(heights: List[int]) -> int:
    return sum(abs(heights[i] - heights[i+1]) for i in range(len(heights)-1))

def normalize(x: float, lo: float, hi: float) -> float:
    if hi - lo < 1e-9:
        return 0.0
    v = (x - lo) / (hi - lo)
    return max(0.0, min(1.0, v))

def compute_fallback_response(req: DecisionRequest) -> DecisionResponse:
    """Fallback heuristic when gateway is unavailable."""
    holes = compute_holes(req.board)
    heights = column_heights(req.board)
    max_h = max(heights) if heights else 0
    bump = bumpiness(heights)

    board_risk_raw = holes*3 + max_h*0.7 + bump*0.4
    board_risk = normalize(board_risk_raw, 0, 60)

    m = req.metrics
    reliance_raw = (1.0 - m.engagementScore) * 1.2 + min(1.0, m.blindAcceptStreak / 6) * 0.8
    reliance_raw += m.hesitationRate * 0.4
    reliance = max(0.0, min(1.0, reliance_raw))

    risk = max(0.0, min(1.0, 0.6*board_risk + 0.4*reliance))

    if risk >= 0.75:
        mode: Mode = "MANUAL_CONFIRM"
        reason = "High risk: over-reliance + unsafe board state"
        explanation = "Manual mode: slow down, verify placements, avoid creating holes and tall spikes."
    elif risk >= 0.5:
        mode = "EXPLAIN_ONLY"
        reason = "Moderate risk: reduce automation to keep awareness"
        explanation = "Explain-only: focus on flattening the surface; avoid moves that create holes."
    else:
        mode = "ASSIST"
        reason = "Low risk: assistance allowed"
        explanation = "Assist: suggestions are enabled, but stay accountable for decisions."

    return DecisionResponse(riskScore=risk, mode=mode, reason=reason, explanation=explanation)


@app.post("/api/decision", response_model=DecisionResponse)
async def decision(req: DecisionRequest):
    # Try to proxy to gateway on port 8002
    gateway_url = "http://localhost:8002/workflow/decision"
    
    try:
        async with httpx.AsyncClient(timeout=0.7) as client:
            response = await client.post(
                gateway_url,
                json={
                    "board": req.board,
                    "currentPiece": req.currentPiece,
                    "x": req.x,
                    "y": req.y,
                    "rotation": req.rotation,
                    "metrics": req.metrics.model_dump()
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return DecisionResponse(
                    riskScore=data.get("riskScore", 0.5),
                    mode=data.get("mode", "ASSIST"),
                    reason=data.get("reason", ""),
                    explanation=data.get("explanation", "")
                )
            else:
                print(f"Gateway returned {response.status_code}, using fallback", flush=True)
                
    except httpx.TimeoutException:
        print("Gateway timeout, using fallback", flush=True)
    except Exception as e:
        print(f"Gateway request failed: {e}, using fallback", flush=True)
    
    # Fallback to heuristic response
    return compute_fallback_response(req)
