"""
News Service for fetching stock-related news.

Uses Finnhub API for stock-specific news with fallback to 
Google News RSS scraping when API key not available.
"""

import os
import re
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from urllib.parse import quote
import requests
from django.conf import settings


def get_finnhub_api_key() -> Optional[str]:
    """Get Finnhub API key from settings or environment."""
    return getattr(settings, 'FINNHUB_API_KEY', None) or os.environ.get('FINNHUB_API_KEY')


def fetch_news_finnhub(symbol: str, limit: int = 10) -> List[Dict]:
    """
    Fetch news for a stock using Finnhub API.
    
    Args:
        symbol: Stock symbol (e.g., 'RELIANCE', 'TCS')
        limit: Max number of articles to return
    
    Returns:
        List of news articles with title, summary, source, datetime, url
    """
    api_key = get_finnhub_api_key()
    if not api_key:
        return []
    
    # Finnhub uses international symbols, try with .NS suffix for NSE
    search_symbol = f"{symbol}.NS"
    
    # Get news from last 7 days
    today = datetime.now()
    from_date = (today - timedelta(days=7)).strftime('%Y-%m-%d')
    to_date = today.strftime('%Y-%m-%d')
    
    try:
        url = f"https://finnhub.io/api/v1/company-news"
        params = {
            'symbol': search_symbol,
            'from': from_date,
            'to': to_date,
            'token': api_key
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        articles = response.json()
        
        # Format articles
        news_list = []
        for article in articles[:limit]:
            news_list.append({
                'title': article.get('headline', ''),
                'summary': article.get('summary', '')[:200] + '...' if len(article.get('summary', '')) > 200 else article.get('summary', ''),
                'source': article.get('source', 'Unknown'),
                'datetime': datetime.fromtimestamp(article.get('datetime', 0)).strftime('%d %b %Y, %H:%M'),
                'url': article.get('url', '#'),
                'image': article.get('image', ''),
            })
        
        return news_list
        
    except Exception as e:
        print(f"Finnhub API error: {e}")
        return []


def fetch_news_google(symbol: str, company_name: str = None, limit: int = 10) -> List[Dict]:
    """
    Fetch news using Google News RSS feed.
    
    Args:
        symbol: Stock symbol
        company_name: Optional company name for better search
        limit: Max number of articles
    
    Returns:
        List of news articles
    """
    try:
        # Build search query
        query = company_name if company_name else symbol
        query = f"{query} stock NSE"
        encoded_query = quote(query)
        
        # Google News RSS feed
        url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-IN&gl=IN&ceid=IN:en"
        
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        # Parse RSS (simple regex for demo - in production use feedparser)
        content = response.text
        
        # Extract items
        items = re.findall(r'<item>(.*?)</item>', content, re.DOTALL)
        
        news_list = []
        for item in items[:limit]:
            title_match = re.search(r'<title>(.*?)</title>', item)
            link_match = re.search(r'<link>(.*?)</link>', item)
            pubdate_match = re.search(r'<pubDate>(.*?)</pubDate>', item)
            source_match = re.search(r'<source.*?>(.*?)</source>', item)
            
            if title_match:
                # Clean up CDATA
                title = title_match.group(1).replace('<![CDATA[', '').replace(']]>', '').strip()
                
                news_list.append({
                    'title': title,
                    'summary': '',
                    'source': source_match.group(1) if source_match else 'Google News',
                    'datetime': pubdate_match.group(1)[:16] if pubdate_match else '',
                    'url': link_match.group(1) if link_match else '#',
                    'image': '',
                })
        
        return news_list
        
    except Exception as e:
        print(f"Google News error: {e}")
        return []


def get_stock_news(symbol: str, company_name: str = None, limit: int = 10) -> List[Dict]:
    """
    Get news for a stock, trying Finnhub first, then Google News.
    
    Args:
        symbol: Stock symbol (e.g., 'RELIANCE')
        company_name: Optional company name
        limit: Max articles to return
    
    Returns:
        List of news articles
    """
    # Try Finnhub first
    news = fetch_news_finnhub(symbol, limit)
    
    if not news:
        # Fallback to Google News
        news = fetch_news_google(symbol, company_name, limit)
    
    return news


# Mapping of common stock symbols to company names for better news search
SYMBOL_TO_COMPANY = {
    'RELIANCE': 'Reliance Industries',
    'TCS': 'Tata Consultancy Services',
    'INFY': 'Infosys',
    'HDFCBANK': 'HDFC Bank',
    'ICICIBANK': 'ICICI Bank',
    'BHARTIARTL': 'Bharti Airtel',
    'ITC': 'ITC Limited',
    'KOTAKBANK': 'Kotak Mahindra Bank',
    'SBIN': 'State Bank of India',
    'LT': 'Larsen and Toubro',
    'WIPRO': 'Wipro',
    'HCLTECH': 'HCL Technologies',
    'SUNPHARMA': 'Sun Pharmaceutical',
    'MARUTI': 'Maruti Suzuki',
    'TATAMOTORS': 'Tata Motors',
    'AXISBANK': 'Axis Bank',
    'BAJFINANCE': 'Bajaj Finance',
    'ADANIENT': 'Adani Enterprises',
    'POWERGRID': 'Power Grid Corporation',
    'NTPC': 'NTPC Limited',
    'ONGC': 'Oil and Natural Gas Corporation',
    'ULTRACEMCO': 'UltraTech Cement',
    'TATASTEEL': 'Tata Steel',
    'TECHM': 'Tech Mahindra',
    'DRREDDY': 'Dr Reddys Laboratories',
    'CIPLA': 'Cipla',
    'M&M': 'Mahindra and Mahindra',
    'APOLLOHOSP': 'Apollo Hospitals',
    'DIVISLAB': 'Divi\'s Laboratories',
}


def get_company_name(symbol: str) -> str:
    """Get company name from symbol for better search."""
    return SYMBOL_TO_COMPANY.get(symbol.upper(), symbol)
