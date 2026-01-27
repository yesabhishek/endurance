"""
Portfolio views.

These views render the portfolio dashboard with data from Kite Connect API.
"""

import json
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from . import kite_auth
from . import ai_service
from .models import Watchlist, WatchlistItem


def _is_authenticated(request):
    """Check if user has valid Kite access token."""
    return 'kite_access_token' in request.session


def _get_holdings_with_metrics(kite):
    """Get holdings and calculate gainers/losers."""
    try:
        holdings = kite.holdings()
    except Exception:
        holdings = []
    
    # Add calculated fields
    for h in holdings:
        avg = h.get('average_price', 0)
        ltp = h.get('last_price', 0)
        qty = h.get('quantity', 0)
        
        # Calculate P&L if not present
        if not h.get('pnl'):
            h['pnl'] = (ltp - avg) * qty if avg > 0 else 0
        
        # Calculate P&L percentage
        h['pnl_pct'] = ((ltp - avg) / avg * 100) if avg > 0 else 0
        
        # Calculate current value
        h['current_value'] = ltp * qty
    
    return holdings


def dashboard(request):
    """Main portfolio dashboard view."""
    if not _is_authenticated(request):
        return redirect('portfolio:kite_login')
    
    try:
        kite = kite_auth.get_authenticated_kite(request)
        if not kite:
            return redirect('portfolio:kite_login')
        
        holdings = _get_holdings_with_metrics(kite)
        
        try:
            positions = kite.positions()
        except Exception:
            positions = {'net': [], 'day': []}
        
        try:
            margins = kite.margins()
        except Exception:
            margins = {}
        
        try:
            profile = kite.profile()
        except Exception:
            profile = {}
        
        context = {
            'holdings': holdings,
            'positions': positions,
            'margins': margins,
            'profile': profile,
            'error': None,
            'is_authenticated': True,
        }
    except Exception:
        request.session.flush()
        return redirect('portfolio:kite_login')
    
    return render(request, 'portfolio/dashboard.html', context)


def holdings(request):
    """Holdings detail view."""
    if not _is_authenticated(request):
        return redirect('portfolio:kite_login')
    
    try:
        kite = kite_auth.get_authenticated_kite(request)
        holdings_data = _get_holdings_with_metrics(kite) if kite else []
        context = {
            'holdings': holdings_data,
            'error': None,
        }
    except Exception as e:
        context = {
            'holdings': [],
            'error': str(e),
        }
    
    return render(request, 'portfolio/holdings.html', context)


def positions(request):
    """Positions detail view."""
    if not _is_authenticated(request):
        return redirect('portfolio:kite_login')
    
    try:
        kite = kite_auth.get_authenticated_kite(request)
        positions_data = kite.positions() if kite else {}
        context = {
            'positions': positions_data,
            'error': None,
        }
    except Exception as e:
        context = {
            'positions': {},
            'error': str(e),
        }
    
    return render(request, 'portfolio/positions.html', context)


def market_overview(request):
    """Market overview with NSE/BSE index data."""
    if not _is_authenticated(request):
        return redirect('portfolio:kite_login')
    
    try:
        kite = kite_auth.get_authenticated_kite(request)
        if not kite:
            return redirect('portfolio:kite_login')
        
        # Get portfolio holdings for summary
        holdings = _get_holdings_with_metrics(kite)
        
        # Calculate portfolio totals
        total_value = sum(h.get('current_value', 0) for h in holdings)
        total_pnl = sum(h.get('pnl', 0) for h in holdings)
        total_invested = sum(h.get('average_price', 0) * h.get('quantity', 0) for h in holdings)
        total_pnl_pct = ((total_value - total_invested) / total_invested * 100) if total_invested > 0 else 0
        
        # Fetch index data
        from .market_service import get_indices_from_kite, get_mock_indices
        indices = get_indices_from_kite(kite)
        if not indices:
            indices = get_mock_indices()
        
        context = {
            'indices': indices,
            'holdings': holdings,
            'total_value': total_value,
            'total_pnl': total_pnl,
            'total_pnl_pct': total_pnl_pct,
            'holdings_count': len(holdings),
            'error': None,
        }
    except Exception as e:
        from .market_service import get_mock_indices
        context = {
            'indices': get_mock_indices(),
            'holdings': [],
            'total_value': 0,
            'total_pnl': 0,
            'total_pnl_pct': 0,
            'holdings_count': 0,
            'error': str(e),
        }
    
    return render(request, 'portfolio/market.html', context)


def investment_detail(request, symbol):
    """Detailed view for a single investment."""
    if not _is_authenticated(request):
        return redirect('portfolio:kite_login')
    
    try:
        kite = kite_auth.get_authenticated_kite(request)
        if not kite:
            return redirect('portfolio:kite_login')
        
        holdings = _get_holdings_with_metrics(kite)
        
        # Find the specific holding
        holding = None
        for h in holdings:
            if h.get('tradingsymbol', '').upper() == symbol.upper():
                holding = h
                break
        
        if not holding:
            context = {
                'holding': None,
                'news': [],
                'error': f'Investment "{symbol}" not found in your portfolio.',
            }
        else:
            # Fetch news for this stock
            from .news_service import get_stock_news, get_company_name
            company_name = get_company_name(symbol)
            news = get_stock_news(symbol, company_name, limit=8)
            
            context = {
                'holding': holding,
                'news': news,
                'error': None,
            }
    except Exception as e:
        context = {
            'holding': None,
            'news': [],
            'error': str(e),
        }
    
    return render(request, 'portfolio/investment_detail.html', context)


def stock_detail(request, symbol):
    """View details for any stock (not just holdings)."""
    if not _is_authenticated(request):
        return redirect('portfolio:kite_login')
    
    symbol_upper = symbol.upper()
    
    # Initialize defaults
    stock_data = {
        'tradingsymbol': symbol_upper,
        'exchange': 'NSE',
    }
    in_portfolio = False
    quote_error = None
    
    try:
        kite = kite_auth.get_authenticated_kite(request)
        if kite:
            # Check if in portfolio first
            holdings = _get_holdings_with_metrics(kite)
            for h in holdings:
                if h.get('tradingsymbol', '').upper() == symbol_upper:
                    stock_data = h
                    in_portfolio = True
                    break
            
            # If not in portfolio, try to get quote
            if not in_portfolio:
                try:
                    instrument = f"NSE:{symbol_upper}"
                    quotes = kite.quote([instrument])
                    if instrument in quotes:
                        q = quotes[instrument]
                        stock_data.update({
                            'last_price': q.get('last_price', 0),
                            'day_change': q.get('change', 0),
                            'day_change_percentage': q.get('change', 0) / q.get('ohlc', {}).get('close', 1) * 100 if q.get('ohlc', {}).get('close') else 0,
                            'open': q.get('ohlc', {}).get('open', 0),
                            'high': q.get('ohlc', {}).get('high', 0),
                            'low': q.get('ohlc', {}).get('low', 0),
                            'close': q.get('ohlc', {}).get('close', 0),
                            'volume': q.get('volume', 0),
                        })
                except Exception as e:
                    quote_error = f"Live data unavailable: {e}"
                    print(f"Quote error for {symbol}: {e}")
    except Exception as e:
        quote_error = str(e)
        print(f"Kite error: {e}")
    
    # Always get company name and news (even if quote fails)
    from .news_service import get_stock_news, get_company_name
    company_name = get_company_name(symbol_upper)
    news = get_stock_news(symbol_upper, company_name, limit=6)
    
    context = {
        'symbol': symbol_upper,
        'company_name': company_name,
        'stock': stock_data,
        'in_portfolio': in_portfolio,
        'news': news,
        'quote_error': quote_error,  # Optional warning, not blocking error
        'error': None,  # Page always renders
    }
    
    return render(request, 'portfolio/stock_detail.html', context)


def watchlist_overview(request):
    """View all sector watchlists with curated stocks."""
    if not _is_authenticated(request):
        return redirect('portfolio:kite_login')
    
    from .curated_stocks import CURATED_STOCKS
    
    # Get or create default watchlists with curated stocks
    default_sectors = [
        ('healthcare', 'Healthcare', 'Pharma, hospitals, medical devices'),
        ('infra', 'Infrastructure', 'Construction, roads, ports, power'),
        ('automobile', 'Automobile', 'Cars, two-wheelers, auto parts'),
        ('it', 'Information Technology', 'Software, IT services, tech'),
        ('banking', 'Banking & Finance', 'Banks, NBFCs, insurance'),
        ('energy', 'Energy', 'Oil, gas, power generation'),
        ('fmcg', 'FMCG', 'Consumer goods, food & beverages'),
        ('metals', 'Metals & Mining', 'Steel, aluminium, mining'),
        ('realty', 'Real Estate', 'Builders, property developers'),
    ]
    
    for sector_key, name, desc in default_sectors:
        watchlist, created = Watchlist.objects.get_or_create(
            sector=sector_key,
            defaults={'name': name, 'description': desc}
        )
        
        # If watchlist is new or empty, populate with curated stocks
        if created or watchlist.items.count() == 0:
            curated = CURATED_STOCKS.get(sector_key, [])
            for stock in curated:
                WatchlistItem.objects.get_or_create(
                    watchlist=watchlist,
                    symbol=stock['symbol'],
                    defaults={'exchange': 'NSE', 'notes': stock.get('name', '')}
                )
    
    watchlists = Watchlist.objects.all().prefetch_related('items')
    
    context = {
        'watchlists': watchlists,
        'error': None,
    }
    
    return render(request, 'portfolio/watchlist.html', context)


def sector_watchlist(request, sector):
    """View stocks in a specific sector watchlist with real-time data."""
    if not _is_authenticated(request):
        return redirect('portfolio:kite_login')
    
    watchlist = get_object_or_404(Watchlist, sector=sector)
    items = watchlist.items.all()
    
    # Get holdings and try to fetch quotes for all watchlist items
    holdings_by_symbol = {}
    quotes_data = {}
    
    try:
        kite = kite_auth.get_authenticated_kite(request)
        if kite:
            # Get holdings
            holdings = _get_holdings_with_metrics(kite)
            holdings_by_symbol = {h['tradingsymbol']: h for h in holdings}
            
            # Build list of instruments to quote
            instruments = [f"NSE:{item.symbol}" for item in items]
            
            # Fetch quotes (LTP + OHLC) for all watchlist stocks
            if instruments:
                try:
                    quotes = kite.quote(instruments)
                    for instrument, data in quotes.items():
                        symbol = instrument.split(':')[1] if ':' in instrument else instrument
                        quotes_data[symbol] = {
                            'last_price': data.get('last_price', 0),
                            'change': data.get('change', 0),
                            'change_pct': round((data.get('change', 0) / data.get('ohlc', {}).get('close', 1)) * 100, 2) if data.get('ohlc', {}).get('close') else 0,
                            'open': data.get('ohlc', {}).get('open', 0),
                            'high': data.get('ohlc', {}).get('high', 0),
                            'low': data.get('ohlc', {}).get('low', 0),
                            'close': data.get('ohlc', {}).get('close', 0),
                            'volume': data.get('volume', 0),
                        }
                except Exception as e:
                    print(f"Quote error for {sector}: {e}")
    except Exception as e:
        print(f"Kite error: {e}")
    
    # Enrich items with price data
    enriched_items = []
    for item in items:
        symbol = item.symbol
        item_data = {
            'symbol': symbol,
            'exchange': item.exchange,
            'notes': item.notes,
            'added_at': item.added_at,
            'id': item.id,
            'in_portfolio': symbol in holdings_by_symbol,
        }
        
        # Add holdings data if in portfolio
        if symbol in holdings_by_symbol:
            h = holdings_by_symbol[symbol]
            item_data['last_price'] = h.get('last_price', 0)
            item_data['day_change'] = h.get('day_change_percentage', 0)
            item_data['quantity'] = h.get('quantity', 0)
            item_data['pnl'] = h.get('pnl', 0)
        # Otherwise use quote data
        elif symbol in quotes_data:
            q = quotes_data[symbol]
            item_data['last_price'] = q['last_price']
            item_data['day_change'] = q['change_pct']
            item_data['open'] = q['open']
            item_data['high'] = q['high']
            item_data['low'] = q['low']
            item_data['volume'] = q['volume']
        
        enriched_items.append(item_data)
    
    # Sort by last_price descending (largest market cap first)
    enriched_items.sort(key=lambda x: x.get('last_price', 0), reverse=True)
    
    context = {
        'watchlist': watchlist,
        'items': enriched_items,
        'total_stocks': len(enriched_items),
        'stocks_with_data': len([i for i in enriched_items if i.get('last_price')]),
        'error': None,
    }
    
    return render(request, 'portfolio/sector_watchlist.html', context)


def add_to_watchlist(request, sector):
    """Add a stock to a sector watchlist."""
    if request.method != 'POST':
        return redirect('portfolio:sector_watchlist', sector=sector)
    
    if not _is_authenticated(request):
        return JsonResponse({'success': False, 'error': 'Not authenticated'}, status=401)
    
    watchlist = get_object_or_404(Watchlist, sector=sector)
    symbol = request.POST.get('symbol', '').upper().strip()
    exchange = request.POST.get('exchange', 'NSE').upper()
    notes = request.POST.get('notes', '')
    
    if not symbol:
        return redirect('portfolio:sector_watchlist', sector=sector)
    
    WatchlistItem.objects.get_or_create(
        watchlist=watchlist,
        symbol=symbol,
        defaults={'exchange': exchange, 'notes': notes}
    )
    
    return redirect('portfolio:sector_watchlist', sector=sector)


def remove_from_watchlist(request, sector, item_id):
    """Remove a stock from a sector watchlist."""
    if not _is_authenticated(request):
        return redirect('portfolio:kite_login')
    
    WatchlistItem.objects.filter(id=item_id, watchlist__sector=sector).delete()
    return redirect('portfolio:sector_watchlist', sector=sector)


def api_portfolio(request):
    """API endpoint for portfolio data (JSON)."""
    if not _is_authenticated(request):
        return JsonResponse({'success': False, 'error': 'Not authenticated'}, status=401)
    
    try:
        kite = kite_auth.get_authenticated_kite(request)
        return JsonResponse({
            'success': True,
            'data': {
                'holdings': kite.holdings() if kite else [],
                'positions': kite.positions() if kite else {},
                'margins': kite.margins() if kite else {},
                'profile': kite.profile() if kite else {},
            }
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e),
        }, status=500)


def api_ai_suggestion(request, symbol):
    """API endpoint for AI investment suggestion."""
    if not _is_authenticated(request):
        return JsonResponse({'success': False, 'error': 'Not authenticated'}, status=401)
    
    try:
        kite = kite_auth.get_authenticated_kite(request)
        if not kite:
            return JsonResponse({'success': False, 'error': 'Not authenticated'}, status=401)
        
        holdings = _get_holdings_with_metrics(kite)
        
        # Find the specific holding
        holding = None
        for h in holdings:
            if h.get('tradingsymbol', '').upper() == symbol.upper():
                holding = h
                break
        
        if not holding:
            return JsonResponse({
                'success': False,
                'error': f'Investment "{symbol}" not found',
            }, status=404)
        
        # Get AI suggestion
        suggestion = ai_service.analyze_investment(holding)
        
        return JsonResponse({
            'success': not suggestion.get('error', False),
            'data': suggestion,
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e),
        }, status=500)


def kite_login(request):
    """Initiate Kite OAuth login."""
    if _is_authenticated(request):
        return redirect('portfolio:dashboard')
    
    try:
        login_url = kite_auth.get_login_url()
        context = {
            'login_url': login_url,
            'message': None,
            'already_logged_in': False,
        }
    except Exception as e:
        context = {
            'login_url': None,
            'message': str(e),
            'already_logged_in': False,
            'error': str(e),
        }
    
    return render(request, 'portfolio/login.html', context)


def kite_callback(request):
    """Handle Kite OAuth callback."""
    request_token = request.GET.get('request_token')
    status = request.GET.get('status')
    
    if status != 'success' or not request_token:
        return render(request, 'portfolio/login.html', {
            'login_url': None,
            'message': 'Login failed or was cancelled.',
            'error': 'Login failed',
        })
    
    try:
        session_data = kite_auth.generate_session(request_token)
        
        request.session['kite_access_token'] = session_data['access_token']
        request.session['kite_user_id'] = session_data.get('user_id', '')
        request.session['kite_user_name'] = session_data.get('user_name', '')
        
        return redirect('portfolio:dashboard')
    
    except Exception as e:
        return render(request, 'portfolio/login.html', {
            'login_url': None,
            'message': f'Failed to complete login: {str(e)}',
            'error': str(e),
        })


def kite_logout(request):
    """Logout and clear Kite session."""
    request.session.flush()
    return redirect('portfolio:kite_login')


def api_chart_data(request, symbol):
    """API endpoint for candlestick chart data."""
    if not _is_authenticated(request):
        return JsonResponse({'error': 'Not authenticated'}, status=401)
    
    symbol_upper = symbol.upper()
    days = int(request.GET.get('days', 30))
    
    try:
        kite = kite_auth.get_authenticated_kite(request)
        
        from .chart_service import get_historical_data, get_mock_chart_data
        
        # Try to get real data
        chart_data = None
        if kite:
            chart_data = get_historical_data(kite, symbol_upper, days=days)
        
        # Fallback to mock data
        if not chart_data:
            chart_data = get_mock_chart_data(symbol_upper, days=days)
        
        return JsonResponse({
            'symbol': symbol_upper,
            'data': chart_data,
            'is_mock': chart_data == get_mock_chart_data(symbol_upper, days=days),
        })
    except Exception as e:
        # Return mock data on any error
        from .chart_service import get_mock_chart_data
        return JsonResponse({
            'symbol': symbol_upper,
            'data': get_mock_chart_data(symbol_upper, days=days),
            'is_mock': True,
            'error': str(e),
        })

