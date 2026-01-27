"""
Market Index Service for fetching NSE/BSE index data.

Provides data for NIFTY 50, SENSEX, Bank NIFTY, and other indices.
"""

import os
import requests
from datetime import datetime
from typing import Dict, List, Optional
from django.conf import settings


# Predefined index data with static info (updated values will be fetched live)
INDICES = {
    'NIFTY 50': {
        'symbol': 'NIFTY 50',
        'name': 'NIFTY 50',
        'exchange': 'NSE',
        'description': '50 large cap stocks',
    },
    'SENSEX': {
        'symbol': 'SENSEX',
        'name': 'S&P BSE SENSEX',
        'exchange': 'BSE',
        'description': '30 large cap stocks',
    },
    'NIFTY BANK': {
        'symbol': 'NIFTY BANK',
        'name': 'Bank NIFTY',
        'exchange': 'NSE',
        'description': 'Banking sector index',
    },
    'NIFTY IT': {
        'symbol': 'NIFTY IT',
        'name': 'NIFTY IT',
        'exchange': 'NSE',
        'description': 'IT sector index',
    },
    'NIFTY MIDCAP 100': {
        'symbol': 'NIFTY MIDCAP 100',
        'name': 'NIFTY Midcap 100',
        'exchange': 'NSE',
        'description': '100 midcap stocks',
    },
}


def get_indices_from_kite(kite) -> List[Dict]:
    """
    Fetch index data using Kite Connect API.
    
    Args:
        kite: Authenticated KiteConnect instance
    
    Returns:
        List of index data dictionaries
    """
    indices_data = []
    
    try:
        # Kite Connect instrument tokens for indices
        # These are approximate - actual tokens may vary
        index_instruments = [
            'NSE:NIFTY 50',
            'BSE:SENSEX',
            'NSE:NIFTY BANK',
            'NSE:NIFTY IT',
        ]
        
        # Try to get quotes for these indices
        try:
            quotes = kite.quote(index_instruments)
            
            for instrument, data in quotes.items():
                index_key = instrument.split(':')[1] if ':' in instrument else instrument
                base_info = INDICES.get(index_key, {})
                
                indices_data.append({
                    'symbol': index_key,
                    'name': base_info.get('name', index_key),
                    'exchange': base_info.get('exchange', 'NSE'),
                    'description': base_info.get('description', ''),
                    'last_price': data.get('last_price', 0),
                    'change': data.get('change', 0),
                    'change_pct': data.get('change_pct', 0) if data.get('change_pct') else 
                                  (data.get('change', 0) / data.get('ohlc', {}).get('close', 1) * 100 
                                   if data.get('ohlc', {}).get('close') else 0),
                    'open': data.get('ohlc', {}).get('open', 0),
                    'high': data.get('ohlc', {}).get('high', 0),
                    'low': data.get('ohlc', {}).get('low', 0),
                    'close': data.get('ohlc', {}).get('close', 0),
                    'volume': data.get('volume', 0),
                })
        except Exception as e:
            print(f"Error fetching quotes: {e}")
            
    except Exception as e:
        print(f"Error in get_indices_from_kite: {e}")
    
    return indices_data


def get_mock_indices() -> List[Dict]:
    """
    Return mock index data for display when Kite is unavailable.
    Shows static placeholder data.
    """
    return [
        {
            'symbol': 'NIFTY 50',
            'name': 'NIFTY 50',
            'exchange': 'NSE',
            'description': '50 large cap stocks',
            'last_price': None,
            'change': None,
            'change_pct': None,
            'is_placeholder': True,
        },
        {
            'symbol': 'SENSEX',
            'name': 'S&P BSE SENSEX',
            'exchange': 'BSE',
            'description': '30 large cap stocks',
            'last_price': None,
            'change': None,
            'change_pct': None,
            'is_placeholder': True,
        },
        {
            'symbol': 'NIFTY BANK',
            'name': 'Bank NIFTY',
            'exchange': 'NSE',
            'description': 'Banking sector index',
            'last_price': None,
            'change': None,
            'change_pct': None,
            'is_placeholder': True,
        },
        {
            'symbol': 'NIFTY IT',
            'name': 'NIFTY IT',
            'exchange': 'NSE',
            'description': 'IT sector index',
            'last_price': None,
            'change': None,
            'change_pct': None,
            'is_placeholder': True,
        },
    ]
