"""
Solace Agent Mesh Component class for the FailsafeRest Gateway.
"""

import asyncio
import json
import logging
import os
import re
import threading
import uuid
from typing import Any, Dict, List, Optional, Tuple, Union

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from uvicorn import Config, Server

from solace_agent_mesh.gateway.base.component import BaseGatewayComponent
from a2a.types import (
    TextPart,
    DataPart,
    Task,
    TaskStatusUpdateEvent,
    TaskArtifactUpdateEvent,
    JSONRPCError,
)
from solace_agent_mesh.common import a2a
from solace_agent_mesh.common.a2a import ContentPart

log = logging.getLogger(__name__)

info = {
    "class_name": "FailsafeRestGatewayComponent",
    "description": (
        "Implements the A2A FailsafeRest Gateway with embedded HTTP server."
    ),
    "config_parameters": [],
    "input_schema": {},
    "output_schema": {},
}


def safe_status(x: Any) -> Optional[str]:
    """Safely extract status from str, dict, or object."""
    if x is None:
        return None
    if isinstance(x, str):
        return "ok"
    if isinstance(x, dict):
        return x.get("status") or ("ok" if x.get("ok") else "error")
    return getattr(x, "status", None) or "ok"


def safe_text(x: Any) -> str:
    """Safely extract text content from str, dict, or object."""
    if x is None:
        return ""
    if isinstance(x, str):
        return x
    if isinstance(x, dict):
        return (x.get("message") or x.get("text") or x.get("content") or str(x))
    return getattr(x, "text", None) or getattr(x, "message", None) or str(x)


def extract_json_from_text(text: str) -> Dict[str, Any]:
    """Extract JSON from plain text that may contain code blocks or raw JSON."""
    if not text:
        return {}
    
    # Try direct JSON parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    # Try to extract from ```json code blocks
    json_block_pattern = r'```json\s*([\s\S]*?)\s*```'
    matches = re.findall(json_block_pattern, text)
    for match in matches:
        try:
            return json.loads(match.strip())
        except json.JSONDecodeError:
            continue
    
    # Try to extract JSON from any {...} block
    brace_pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
    matches = re.findall(brace_pattern, text)
    for match in matches:
        try:
            result = json.loads(match)
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError:
            continue
    
    return {}


def ensure_jsonable(x: Any) -> Dict[str, Any]:
    """Ensure the output is always a JSON-serializable dict."""
    import json as json_module
    
    if x is None:
        return {"ok": False, "status": "error", "summary": "No response"}
    
    if isinstance(x, dict):
        try:
            json_module.dumps(x)
            return x
        except Exception:
            return {"ok": False, "status": "error", "summary": str(x)}
    
    if isinstance(x, str):
        extracted = extract_json_from_text(x)
        if extracted:
            return extracted
        return {"ok": True, "status": "ok", "summary": x.strip() if x.strip() else "Empty response"}
    
    try:
        json_module.dumps(x)
        return {"ok": True, "status": "ok", "data": x}
    except Exception:
        return {"ok": False, "status": "error", "summary": str(x)}


class MetricsInput(BaseModel):
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
    metrics: MetricsInput = Field(default_factory=MetricsInput)


class DecisionResponse(BaseModel):
    traceId: str
    riskScore: float
    riskFactors: List[str]
    mode: str
    reason: str
    guardrails: List[str]
    explanation: str
    nextActions: List[str]
    source: str


class FailsafeRestGatewayComponent(BaseGatewayComponent):
    """
    Solace Agent Mesh Component implementing the A2A FailsafeRest Gateway.
    """

    def __init__(self, **kwargs: Any):
        super().__init__(**kwargs)
        self.fastapi_app: Optional[FastAPI] = None
        self.uvicorn_server: Optional[Server] = None
        self._server_thread: Optional[threading.Thread] = None
        self._server_started = False
        
        log.info(
            "%s Initializing FailsafeRest Gateway Component...",
            self.log_identifier,
        )

        # Get port from config or default to 8002
        self.port = self.get_config("gateway_port", 8002)
        log.info("%s Gateway will listen on port %d", self.log_identifier, self.port)
        
        # Get fallback control setting - default True for backward compatibility
        self.allow_fallback = self.get_config("allow_fallback", True)
        log.info("%s Fallback allowed: %s", self.log_identifier, self.allow_fallback)

        log.info(
            "%s FailsafeRest Gateway Component initialization complete.",
            self.log_identifier,
        )

    def _create_fastapi_app(self) -> FastAPI:
        """Create and configure the FastAPI application."""
        app = FastAPI(
            title="FailsafeRest Gateway",
            description="Decision workflow gateway for failsafe AI system",
            version="1.0.0"
        )

        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        @app.get("/health")
        async def health():
            return {"ok": True}

        @app.post("/workflow/decision", response_model=DecisionResponse)
        async def decision(request: DecisionRequest):
            try:
                result = await self._orchestrate_decision(
                    board=request.board,
                    currentPiece=request.currentPiece,
                    x=request.x,
                    y=request.y,
                    rotation=request.rotation,
                    metrics=request.metrics.model_dump()
                )
                return result
            except Exception as e:
                log.exception("%s Decision endpoint error: %s", self.log_identifier, e)
                raise HTTPException(status_code=500, detail=str(e))

        return app

    def _run_server_sync(self):
        """Run uvicorn server synchronously in a thread."""
        try:
            log.info("%s Starting uvicorn server in thread on port %d...", self.log_identifier, self.port)
            self.uvicorn_server.run()
            log.info("%s Uvicorn server stopped", self.log_identifier)
        except Exception as e:
            log.exception("%s Server thread error: %s", self.log_identifier, e)

    def _start_listener(self) -> None:
        """Start the embedded FastAPI server."""
        log_id_prefix = f"{self.log_identifier}[StartListener]"
        log.info("%s Starting embedded FastAPI server on port %d...", self.log_identifier, self.port)

        self.fastapi_app = self._create_fastapi_app()
        
        config = Config(
            app=self.fastapi_app,
            host="0.0.0.0",
            port=self.port,
            log_level="warning"
        )
        self.uvicorn_server = Server(config=config)
        
        self._server_thread = threading.Thread(
            target=self._run_server_sync,
            daemon=True
        )
        self._server_thread.start()
        
        import time
        time.sleep(0.5)
        
        if self._server_thread.is_alive():
            log.info("%s FastAPI server thread started successfully", self.log_identifier)
            self._server_started = True
        else:
            log.error("%s FastAPI server thread failed to start", self.log_identifier)

    def _stop_listener(self) -> None:
        """Stop the embedded FastAPI server."""
        log_id_prefix = f"{self.log_identifier}[StopListener]"
        log.info("%s Stopping FastAPI server...", self.log_identifier)
        
        if self.uvicorn_server:
            self.uvicorn_server.should_exit = True
            
        log.info("%s FastAPI server shutdown initiated.", self.log_identifier)

    async def _orchestrate_decision(
        self,
        board: List[List[int]],
        currentPiece: str,
        x: int,
        y: int,
        rotation: int,
        metrics: Dict[str, Any]
    ) -> DecisionResponse:
        """
        Orchestrate the decision by calling OrchestratorAgent ONLY.
        The OrchestratorAgent handles all routing and agent coordination internally.
        """
        # Generate traceId for correlation
        trace_id = str(uuid.uuid4())
        
        # Prepare input for OrchestratorAgent
        agent_input = {
            "board": board,
            "currentPiece": currentPiece,
            "x": x,
            "y": y,
            "rotation": rotation,
            "metrics": metrics
        }
        input_text = json.dumps(agent_input)
        
        # Log A2A request
        log.info(
            "%s [TRACE:%s] Sending A2A request to OrchestratorAgent",
            self.log_identifier, trace_id
        )
        
        try:
            # Submit task to OrchestratorAgent ONLY
            parts = [a2a.create_text_part(text=input_text)]
            
            task_result = await self.submit_a2a_task(
                target_agent_name="OrchestratorAgent",
                a2a_parts=parts,
                external_request_context={"stage": "orchestrator", "traceId": trace_id},
                user_identity={"id": "gateway", "source": "internal"},
                is_streaming=False
            )
            
            # Log A2A response
            log.info(
                "%s [TRACE:%s] Received A2A response from OrchestratorAgent",
                self.log_identifier, trace_id
            )
            
            log.info("%s OrchestratorAgent result type: %s", self.log_identifier, type(task_result).__name__)
            
            # Safely extract response text
            response_text = safe_text(task_result)
            
            if isinstance(task_result, dict):
                status_obj = task_result.get("status")
                if status_obj and isinstance(status_obj, dict):
                    response_text = status_obj.get("message") or response_text
                if not response_text or response_text == str(task_result):
                    response_text = task_result.get("message") or task_result.get("text") or response_text
            
            if hasattr(task_result, "status") and task_result.status:
                status_obj = task_result.status
                if hasattr(status_obj, "message"):
                    response_text = a2a.get_text_from_message(status_obj.message) or response_text
            
            log.info("%s [TRACE:%s] OrchestratorAgent raw response: %s", self.log_identifier, trace_id, response_text[:500])
            
            # Parse JSON response
            agent_result = ensure_jsonable(response_text)
            
            # Validate required fields
            if "mode" not in agent_result:
                log.warning("%s [TRACE:%s] OrchestratorAgent missing mode", self.log_identifier, trace_id)
                agent_result = self._fallback_response(agent_input, trace_id)
            elif "riskScore" not in agent_result:
                log.warning("%s [TRACE:%s] OrchestratorAgent missing riskScore", self.log_identifier, trace_id)
                agent_result = {**agent_result, "riskScore": 0.5}
            
            log.info("%s [TRACE:%s] OrchestratorAgent parsed result: %s", self.log_identifier, trace_id, str(agent_result)[:200])
            
            return DecisionResponse(
                traceId=trace_id,
                riskScore=agent_result.get("riskScore", 0.5),
                riskFactors=agent_result.get("riskFactors", []),
                mode=agent_result.get("mode", "ASSIST"),
                reason=agent_result.get("reason", ""),
                guardrails=agent_result.get("guardrails", []),
                explanation=agent_result.get("explanation", ""),
                nextActions=agent_result.get("nextActions", []),
                source="sam"
            )
                
        except Exception as e:
            log.error("%s [TRACE:%s] OrchestratorAgent failed: %s", self.log_identifier, trace_id, e)
            
            # Check if fallback is allowed
            if not self.allow_fallback:
                log.error(
                    "%s [TRACE:%s] Fallback disabled, propagating error",
                    self.log_identifier, trace_id
                )
                raise
            
            # Fallback to local computation
            log.warning("%s [TRACE:%s] Using fallback response due to error", self.log_identifier, trace_id)
            fallback = self._fallback_response(agent_input, trace_id)
            return DecisionResponse(**fallback)
    
    def _fallback_response(self, agent_input: Dict, trace_id: str) -> Dict:
        """Local fallback when OrchestratorAgent fails."""
        board = agent_input.get("board", [])
        m = agent_input.get("metrics", {})
        
        # Compute board metrics
        holes = 0
        heights = []
        if board:
            rows = len(board)
            cols = len(board[0]) if rows else 0
            for c in range(cols):
                seen = False
                h = 0
                for r in range(rows):
                    if board[r][c] != 0:
                        seen = True
                        h = rows - r
                    elif seen and board[r][c] == 0:
                        holes += 1
                heights.append(h)
        
        maxHeight = max(heights) if heights else 0
        bumpiness = sum(abs(heights[i] - heights[i+1]) for i in range(len(heights)-1)) if len(heights) > 1 else 0
        
        # Compute reliance
        reliance = max(0, min(1, (1.0 - m.get("engagementScore", 0.7)) * 1.2 + 
                        min(1.0, m.get("blindAcceptStreak", 0) / 6) * 0.8 +
                        m.get("hesitationRate", 0) * 0.4))
        
        # Compute risk
        riskScore = min(1.0, holes * 0.05 + maxHeight * 0.02 + bumpiness * 0.01 + reliance * 0.4)
        
        # Determine risk factors
        riskFactors = []
        if holes > 5:
            riskFactors.append("High hole count")
        if maxHeight > 10:
            riskFactors.append("Tall stack")
        if reliance > 0.6:
            riskFactors.append("High reliance")
        if riskScore > 0.7:
            riskFactors.append("Critical risk level")
        
        # Determine mode
        if riskScore >= 0.75:
            mode = "MANUAL_CONFIRM"
            reason = "High risk: multiple hazard factors detected"
            guardrails = ["Slow down", "Verify placements", "Avoid risky moves"]
            explanation = "Manual mode: slow down and verify each placement carefully."
            nextActions = ["Take your time", "Double-check the board", "Consider alternatives"]
        elif riskScore >= 0.5:
            mode = "ASSIST"
            reason = "Moderate risk: assist mode enabled"
            guardrails = ["Focus on flattening", "Avoid creating holes"]
            explanation = "Assist mode: suggestions are enabled."
            nextActions = ["Look for ways to reduce height", "Avoid creating new holes"]
        else:
            mode = "ASSIST"
            reason = "Low risk: assistance allowed"
            guardrails = ["Stay accountable for decisions"]
            explanation = "Full assist mode: suggestions are enabled."
            nextActions = ["Review suggestions before accepting", "Stay engaged"]
        
        return {
            "traceId": trace_id,
            "riskScore": round(riskScore, 2),
            "riskFactors": riskFactors if riskFactors else ["Normal conditions"],
            "mode": mode,
            "reason": reason,
            "guardrails": guardrails,
            "explanation": explanation,
            "nextActions": nextActions,
            "source": "fallback"
        }

    async def _extract_initial_claims(
        self, external_event_data: Any
    ) -> Optional[Dict[str, Any]]:
        return {"id": "gateway", "source": "internal"}

    async def _translate_external_input(
        self, external_event_data: Any
    ) -> Tuple[str, List[ContentPart], Dict[str, Any]]:
        raise NotImplementedError("Not used - HTTP server handles requests directly")

    async def _send_final_response_to_external(
        self, external_request_context: Dict[str, Any], task_data: Task
    ) -> None:
        pass

    async def _send_error_to_external(
        self, external_request_context: Dict[str, Any], error_data: JSONRPCError
    ) -> None:
        pass

    async def _send_update_to_external(
        self,
        external_request_context: Dict[str, Any],
        event_data: Union[TaskStatusUpdateEvent, TaskArtifactUpdateEvent],
        is_final_chunk_of_update: bool,
    ) -> None:
        pass

    def generate_uuid(self) -> str:
        import uuid
        return str(uuid.uuid4())

    def cleanup(self):
        log.info("%s Cleaning up...", self.log_identifier)
        self._stop_listener()
        super().cleanup()
        log.info("%s Cleanup complete.", self.log_identifier)
