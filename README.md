# Endurance

> A minimalist personal investment portfolio tracker powered by Kite Connect

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-green.svg)
![Django](https://img.shields.io/badge/django-6.0-green.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)

Endurance is a clean, Notion-inspired portfolio dashboard that connects to your Zerodha Kite account to display real-time holdings, positions, and market data. Built with Django and styled with a minimalist black & white aesthetic.

## Features

- **Portfolio Dashboard** — View all your holdings and positions at a glance
- **Candlestick Charts** — NIFTY 50 and SENSEX charts with Lightweight Charts
- **Stock Details** — Detailed view for any stock with OHLC data and news
- **Stock News** — Latest news for your holdings via Finnhub API
- **AI Suggestions** — Investment insights powered by OpenAI (optional)
- **Sector Watchlists** — Curated stock lists for Healthcare, IT, Banking, and more
- **Minimalist UI** — Clean, Notion-inspired black & white design

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Zerodha Kite Connect API credentials ([Register here](https://developers.kite.trade/signup))

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yesabhishek/endurance.git
   cd endurance
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your credentials:
   ```env
   KITE_API_KEY=your_kite_api_key
   KITE_API_SECRET=your_kite_api_secret
   ```

3. **Start the application**
   ```bash
   cd portfolio_app
   docker compose up --build
   ```

4. **Open in browser**
   
   Visit [http://localhost:8000](http://localhost:8000) and login with your Kite account.

## Project Structure

```
endurance/
├── portfolio_app/          # Django application
│   ├── portfolio/          # Main Django app
│   │   ├── templates/      # HTML templates
│   │   ├── static/         # CSS and JS
│   │   ├── views.py        # View controllers
│   │   ├── kite_auth.py    # Kite OAuth handling
│   │   ├── news_service.py # Stock news fetching
│   │   ├── chart_service.py # Chart data service
│   │   └── curated_stocks.py # Sector stock lists
│   ├── docker-compose.yml  # Docker configuration
│   └── Dockerfile          # Container build
├── kite-mcp/               # Kite MCP Server (Go)
├── .env.example            # Environment template
└── README.md
```

## Configuration

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `KITE_API_KEY` | Your Kite Connect API key |
| `KITE_API_SECRET` | Your Kite Connect API secret |

### Optional Environment Variables

| Variable | Description |
|----------|-------------|
| `DJANGO_SECRET_KEY` | Django secret key (auto-generated if not set) |
| `OPENAI_API_KEY` | OpenAI API key for AI suggestions |
| `FINNHUB_API_KEY` | Finnhub API key for stock news |

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard with portfolio overview and charts |
| `/holdings/` | List of all holdings |
| `/holdings/<symbol>/` | Detailed view of a holding |
| `/positions/` | Open positions |
| `/market/` | Market overview with index data |
| `/watchlist/` | Sector-based watchlists |
| `/stock/<symbol>/` | Stock details (any stock) |

## Security

This project takes security seriously:

- **No hardcoded credentials** — All secrets are loaded from environment variables
- **`.env` is gitignored** — Your credentials are never committed
- **OAuth flow** — Secure Kite authentication with token management
- **Session-based auth** — Access tokens stored securely in Django sessions

### Important Security Notes

1. **Never commit `.env`** — The `.gitignore` file excludes it
2. **Rotate your API keys** if you accidentally expose them
3. **Use strong `DJANGO_SECRET_KEY`** in production

## Development

### Running locally without Docker

```bash
cd portfolio_app
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Running tests

```bash
python manage.py test
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/portfolio/` | GET | Portfolio summary JSON |
| `/api/chart/<symbol>/` | GET | OHLC chart data |
| `/api/ai-suggest/<symbol>/` | GET | AI investment suggestion |

## Customization

### Changing the theme

Edit `portfolio/static/portfolio/css/style.css`. The design uses CSS variables:

```css
:root {
    --text-primary: #1a1a1a;
    --bg-primary: #ffffff;
    --border-light: #e5e5e5;
}
```

### Adding new sectors

Edit `portfolio/curated_stocks.py` to add new sector watchlists.

## License

MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Zerodha Kite Connect](https://kite.trade/) — Trading API
- [Lightweight Charts](https://www.tradingview.com/lightweight-charts/) — Candlestick charts by TradingView
- [Finnhub](https://finnhub.io/) — Stock news API
- [OpenAI](https://openai.com/) — AI suggestions

---

**Disclaimer**: This is a personal portfolio tracker for informational purposes only. It does not provide investment advice. Always do your own research before making investment decisions.
