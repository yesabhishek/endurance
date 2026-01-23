"""
Kite MCP Client wrapper using LangChain MCP Adapter.

This module provides async functions to interact with the Kite MCP server
for fetching portfolio data like holdings, positions, margins, and profile.
"""

import asyncio
from typing import Any, Dict, Optional
from django.conf import settings

from langchain_mcp_adapters.client import MultiServerMCPClient


class KiteMCPClient:
    """
    Wrapper for Kite MCP Server using LangChain MCP Adapter.
    """
    
    def __init__(self):
        self.mcp_url = getattr(settings, 'KITE_MCP_URL', 'http://localhost:8080/mcp')
        print(self.mcp_url)
        self._client = None
        self._tools = None
    
    async def _get_client(self) -> MultiServerMCPClient:
        """Get or create MCP client."""
        if self._client is None:
            self._client = MultiServerMCPClient({
                "kite": {
                    "transport": "http",
                    "url": self.mcp_url,
                }
            })
        return self._client
    
    async def _call_tool(self, tool_name: str, args: Optional[Dict] = None) -> Any:
        """Call a specific MCP tool and return the result."""
        try:
            # Use direct instantiation pattern (as per langchain-mcp-adapters 0.1.0+)
            client = MultiServerMCPClient({
                "kite": {
                    "transport": "streamable_http",
                    "url": self.mcp_url,
                }
            })
            tools = await client.get_tools()
            
            # Find the specific tool
            tool = next((t for t in tools if t.name == tool_name), None)
            if tool is None:
                available = [t.name for t in tools]
                return {"error": f"Tool '{tool_name}' not found. Available tools: {available}"}
            
            # Invoke the tool
            result = await tool.ainvoke(args or {})
            return result
        except Exception as e:
            import traceback
            print(f"MCP Error calling {tool_name}: {e}")
            traceback.print_exc()
            return {"error": str(e)}
    
    async def get_holdings(self) -> Dict:
        """Fetch portfolio holdings."""
        return await self._call_tool("get_holdings")
    
    async def get_positions(self) -> Dict:
        """Fetch current positions."""
        return await self._call_tool("get_positions")
    
    async def get_margins(self) -> Dict:
        """Fetch account margins."""
        return await self._call_tool("get_margins")
    
    async def get_profile(self) -> Dict:
        """Fetch user profile."""
        return await self._call_tool("get_profile")
    
    async def login(self) -> Dict:
        """Initiate Kite login and get authentication URL."""
        return await self._call_tool("login")
    
    async def get_portfolio_data(self) -> Dict:
        """Fetch all portfolio data in parallel."""
        holdings, positions, margins, profile = await asyncio.gather(
            self.get_holdings(),
            self.get_positions(),
            self.get_margins(),
            self.get_profile(),
            return_exceptions=True
        )
        
        return {
            "holdings": holdings if not isinstance(holdings, Exception) else {"error": str(holdings)},
            "positions": positions if not isinstance(positions, Exception) else {"error": str(positions)},
            "margins": margins if not isinstance(margins, Exception) else {"error": str(margins)},
            "profile": profile if not isinstance(profile, Exception) else {"error": str(profile)},
        }


# Singleton instance
_kite_client: Optional[KiteMCPClient] = None


def get_kite_client() -> KiteMCPClient:
    """Get singleton Kite MCP client instance."""
    global _kite_client
    if _kite_client is None:
        _kite_client = KiteMCPClient()
    return _kite_client
