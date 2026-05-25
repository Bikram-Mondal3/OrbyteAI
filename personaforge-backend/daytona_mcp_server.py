import asyncio
import os
from typing import Any
from mcp.server.fastmcp import FastMCP
from daytona_adk import DaytonaPlugin

# Setup FastMCP Server
mcp = FastMCP("DaytonaSandbox")

# Initialize Daytona Plugin (ensure DAYTONA_API_KEY is in environment)
plugin = DaytonaPlugin()
daytona_tools = plugin.get_tools()

# Because typical ADK plugin tools return functions, we register them with FastMCP directly
for tool in daytona_tools:
    # mcp.tool registers the callable
    mcp.add_tool(tool)

if __name__ == "__main__":
    mcp.run()
