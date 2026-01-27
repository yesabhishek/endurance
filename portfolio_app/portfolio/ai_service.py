"""
AI Service for Investment Suggestions.

Uses OpenAI to analyze holdings and provide hold/sell/sleep recommendations.
"""

import os
from typing import Dict, Optional
from django.conf import settings

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False


def get_openai_client() -> Optional['OpenAI']:
    """Get OpenAI client if API key is configured."""
    if not OPENAI_AVAILABLE:
        return None
    
    api_key = getattr(settings, 'OPENAI_API_KEY', None) or os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return None
    
    return OpenAI(api_key=api_key)


def analyze_investment(holding: Dict, market_context: Optional[Dict] = None) -> Dict:
    """
    Analyze a single investment and return AI suggestion.
    
    Args:
        holding: Dict with tradingsymbol, quantity, average_price, last_price, pnl, day_change_percentage
        market_context: Optional additional context (positions, margins, etc.)
    
    Returns:
        Dict with 'recommendation' (HOLD/SELL/SLEEP), 'reasoning', 'confidence'
    """
    client = get_openai_client()
    
    if not client:
        return {
            'recommendation': 'UNAVAILABLE',
            'reasoning': 'OpenAI API key not configured. Add OPENAI_API_KEY to your .env file.',
            'confidence': 0,
            'error': True
        }
    
    # Extract key metrics
    symbol = holding.get('tradingsymbol', 'Unknown')
    quantity = holding.get('quantity', 0)
    avg_price = holding.get('average_price', 0)
    last_price = holding.get('last_price', 0)
    pnl = holding.get('pnl', 0) or holding.get('profit', 0) or 0
    day_change = holding.get('day_change_percentage', 0) or holding.get('change', 0) or 0
    
    # Calculate P&L percentage
    pnl_pct = ((last_price - avg_price) / avg_price * 100) if avg_price > 0 else 0
    
    prompt = f"""You are a calm, rational investment advisor. Analyze this holding and give a clear recommendation.

Stock: {symbol}
Quantity: {quantity}
Average Buy Price: ₹{avg_price:.2f}
Current Price: ₹{last_price:.2f}
Unrealized P&L: ₹{pnl:.2f} ({pnl_pct:.1f}%)
Day Change: {day_change:.2f}%

Based on this data, provide ONE of these recommendations:
- HOLD: Keep the position, fundamentals look reasonable
- SELL: Consider exiting, either to book profits or cut losses  
- SLEEP: Long-term hold, don't check frequently, let it compound

Respond in this exact JSON format:
{{"recommendation": "HOLD|SELL|SLEEP", "reasoning": "Brief 1-2 sentence explanation", "confidence": 0-100}}

Be concise. Focus on the numbers, not speculation."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a minimalist investment advisor. Give brief, actionable advice."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=200,
            temperature=0.3
        )
        
        content = response.choices[0].message.content.strip()
        
        # Parse JSON response
        import json
        # Handle markdown code blocks if present
        if content.startswith('```'):
            content = content.split('```')[1]
            if content.startswith('json'):
                content = content[4:]
        
        result = json.loads(content)
        result['error'] = False
        return result
        
    except Exception as e:
        return {
            'recommendation': 'ERROR',
            'reasoning': f'Failed to get AI suggestion: {str(e)}',
            'confidence': 0,
            'error': True
        }


def get_portfolio_summary(holdings: list) -> Dict:
    """
    Get a high-level AI summary of the entire portfolio.
    
    Args:
        holdings: List of holding dicts
    
    Returns:
        Dict with 'summary', 'top_action', 'risk_level'
    """
    client = get_openai_client()
    
    if not client or not holdings:
        return {
            'summary': 'Unable to generate portfolio summary.',
            'top_action': None,
            'risk_level': 'Unknown'
        }
    
    # Build portfolio snapshot
    total_value = sum(h.get('last_price', 0) * h.get('quantity', 0) for h in holdings)
    total_pnl = sum(h.get('pnl', 0) or h.get('profit', 0) or 0 for h in holdings)
    
    holdings_summary = []
    for h in holdings[:10]:  # Limit to top 10
        symbol = h.get('tradingsymbol', '?')
        pnl = h.get('pnl', 0) or h.get('profit', 0) or 0
        holdings_summary.append(f"{symbol}: ₹{pnl:.0f}")
    
    prompt = f"""Portfolio Overview:
Total Value: ₹{total_value:.0f}
Total P&L: ₹{total_pnl:.0f}
Holdings: {', '.join(holdings_summary)}

Give a 2-sentence portfolio health summary and one top action to consider.
Respond as JSON: {{"summary": "...", "top_action": "...", "risk_level": "Low|Medium|High"}}"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
            temperature=0.3
        )
        
        content = response.choices[0].message.content.strip()
        if content.startswith('```'):
            content = content.split('```')[1]
            if content.startswith('json'):
                content = content[4:]
        
        import json
        return json.loads(content)
        
    except Exception:
        return {
            'summary': 'Unable to generate summary.',
            'top_action': None,
            'risk_level': 'Unknown'
        }
