"""
Solace Agent Mesh App class for the FailsafeRest Gateway.
"""

import logging
from typing import Any, Dict, List, Type

from solace_agent_mesh.gateway.base.app import BaseGatewayApp
from solace_agent_mesh.gateway.base.component import BaseGatewayComponent

from .component import FailsafeRestGatewayComponent

log = logging.getLogger(__name__)

info = {
    "class_name": "FailsafeRestGatewayApp",
    "description": "Custom App class for the A2A FailsafeRest Gateway.",
}

class FailsafeRestGatewayApp(BaseGatewayApp):
    """
    App class for the A2A FailsafeRest Gateway.
    - Extends BaseGatewayApp for common gateway functionalities.
    - Defines FailsafeRest-specific configuration parameters below.
    """

    # Define FailsafeRest-specific parameters
    # This list will be automatically merged with BaseGatewayApp's schema.
    # These parameters will be configurable in the yaml config file
    # under the 'app_config' section.
    SPECIFIC_APP_SCHEMA_PARAMS: List[Dict[str, Any]] = [
        # --- Example Required Parameter ---
        # {
        #     "name": "api_endpoint_url",
        #     "required": True,
        #     "type": "string",
        #     "description": "The API endpoint URL for the failsafe_rest service.",
        # },
        # --- Example Optional Parameter with Default ---
        # {
        #     "name": "connection_timeout_seconds",
        #     "required": False,
        #     "type": "integer",
        #     "default": 30,
        #     "description": "Timeout in seconds for connecting to the failsafe_rest service.",
        # },
        # --- Example List Parameter ---
        # {
        #     "name": "processing_rules",
        #     "required": False,
        #     "type": "list",
        #     "default": [],
        #     "description": "List of processing rules for the gateway.",
        #     "items": { # Schema for each item in the list
        #         "type": "object",
        #         "properties": {
        #             "rule_name": {"type": "string", "required": True},
        #             "action_type": {"type": "string", "enum": ["process", "ignore"]},
        #             # ... other rule-specific schema fields
        #         }
        #     }
        # }
    ]

    def __init__(self, app_info: Dict[str, Any], **kwargs):
        log_prefix = app_info.get("name", "FailsafeRestGatewayApp")
        log.debug("[%s] Initializing FailsafeRestGatewayApp...", log_prefix)
        super().__init__(app_info=app_info, **kwargs)
        log.debug("[%s] FailsafeRestGatewayApp initialization complete.", self.name)

    def _get_gateway_component_class(self) -> Type[BaseGatewayComponent]:
        """
        Returns the specific gateway component class for this app.
        """
        return FailsafeRestGatewayComponent
