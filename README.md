# Endurance

Endurance is a comprehensive trading portfolio management system that combines the power of AI with robust portfolio tracking. It integrates a Model Context Protocol (MCP) server for direct market access via Zerodha's Kite Connect API and a Django-based web application for portfolio visualization and management.

## Project Structure

This repository contains two main components:

-   **`kite-mcp-server`**: A Go-based MCP server that exposes Kite Connect API functionality to AI agents. It allows AI assistants to retrieve market data, manage orders, and analyze portfolios.
-   **`portfolio_app`**: A Django web application designed for portfolio tracking, dashboarding, and user management.

## Prerequisites

Before getting started, ensure you have the following installed:

-   **Go**: Version 1.21 or later (for `kite-mcp-server`)
-   **Python**: Version 3.10 or later (for `portfolio_app`)
-   **Kite Connect API Credentials**: You need a valid API Key and API Secret from [Kite Connect](https://kite.trade/).

## Getting Started

### 1. Kite MCP Server

The MCP server enables AI interactions with your trading account.

**Installation & Run:**

```bash
cd kite-mcp-server
# Copy the example environment file
cp .env.example .env
# Edit .env and add your KITE_API_KEY and KITE_API_SECRET
nano .env 

# Run the server
go run main.go
```

For detailed documentation, including Docker usage and client integration (e.g., with Claude Desktop), please refer to keywords [kite-mcp-server/README.md](kite-mcp-server/README.md).

### 2. Portfolio App

The Portfolio App provides a web interface for your trading data.

**Setup & Run:**

```bash
cd portfolio_app
# Create a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# detailed setup usually involves database migrations
python manage.py migrate

# Run the development server
python manage.py runserver
```

Access the application at `http://127.0.0.1:8000/`.

