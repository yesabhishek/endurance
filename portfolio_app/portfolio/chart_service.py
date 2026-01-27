"""
Chart data service for candlestick charts.
Fetches historical OHLC data from Kite Connect API.
"""
from datetime import datetime, timedelta
import random


def get_historical_data(kite, symbol, exchange='NSE', days=30, interval='day'):
    """
    Fetch historical OHLC data from Kite.
    
    Args:
        kite: Authenticated Kite instance
        symbol: Trading symbol (e.g., 'RELIANCE')
        exchange: NSE or BSE
        days: Number of days of history
        interval: 'minute', '5minute', '15minute', 'day', 'week', 'month'
    
    Returns:
        List of OHLC dicts: [{time, open, high, low, close, volume}, ...]
    """
    try:
        # Get instrument token
        instrument = f"{exchange}:{symbol}"
        
        # Date range
        to_date = datetime.now()
        from_date = to_date - timedelta(days=days)
        
        # Fetch historical data
        data = kite.historical_data(
            instrument_token=kite.ltp([instrument])[instrument]['instrument_token'],
            from_date=from_date.strftime('%Y-%m-%d'),
            to_date=to_date.strftime('%Y-%m-%d'),
            interval=interval
        )
        
        # Convert to chart format
        chart_data = []
        for candle in data:
            chart_data.append({
                'time': candle['date'].strftime('%Y-%m-%d'),
                'open': float(candle['open']),
                'high': float(candle['high']),
                'low': float(candle['low']),
                'close': float(candle['close']),
                'volume': int(candle.get('volume', 0)),
            })
        
        return chart_data
    except Exception as e:
        print(f"Historical data error for {symbol}: {e}")
        return None


def get_mock_chart_data(symbol, days=30, base_price=None):
    """
    Generate mock candlestick data for demonstration.
    Used when Kite API is unavailable.
    """
    chart_data = []
    
    # Set base price based on symbol
    price_map = {
        'NIFTY 50': 22500,
        'SENSEX': 74000,
        'RELIANCE': 2800,
        'TCS': 4000,
        'INFY': 1800,
        'HDFCBANK': 1600,
        'ICICIBANK': 1100,
        'COALINDIA': 420,
        'MOTHERSON': 180,
        'MARUTI': 11500,
        'TATAMOTORS': 780,
    }
    
    price = base_price or price_map.get(symbol, 1000)
    today = datetime.now()
    
    for i in range(days, 0, -1):
        date = today - timedelta(days=i)
        
        # Skip weekends
        if date.weekday() >= 5:
            continue
        
        # Random price movement
        change = price * random.uniform(-0.02, 0.02)
        open_price = price
        close_price = price + change
        
        high = max(open_price, close_price) * random.uniform(1.0, 1.015)
        low = min(open_price, close_price) * random.uniform(0.985, 1.0)
        
        chart_data.append({
            'time': date.strftime('%Y-%m-%d'),
            'open': round(open_price, 2),
            'high': round(high, 2),
            'low': round(low, 2),
            'close': round(close_price, 2),
            'volume': random.randint(100000, 5000000),
        })
        
        price = close_price
    
    return chart_data


def get_index_chart_data(kite, index_name, days=30):
    """
    Fetch chart data for an index.
    Falls back to mock data if API unavailable.
    """
    # Map index names to symbols
    index_symbols = {
        'NIFTY 50': 'NSE:NIFTY 50',
        'SENSEX': 'BSE:SENSEX',
        'BANK NIFTY': 'NSE:NIFTY BANK',
        'NIFTY IT': 'NSE:NIFTY IT',
    }
    
    try:
        if kite:
            instrument = index_symbols.get(index_name)
            if instrument:
                # Try to get real data
                data = get_historical_data(kite, index_name, days=days)
                if data:
                    return data
    except Exception as e:
        print(f"Index chart error: {e}")
    
    # Fallback to mock data
    return get_mock_chart_data(index_name, days=days)
