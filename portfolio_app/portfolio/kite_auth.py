"""
Kite Connect authentication module.

Handles OAuth authentication with Zerodha Kite Connect API.
"""

from django.conf import settings
from kiteconnect import KiteConnect


def get_kite_client(access_token=None):
    """Get a KiteConnect client instance."""
    kite = KiteConnect(api_key=settings.KITE_API_KEY)
    if access_token:
        kite.set_access_token(access_token)
    return kite


def get_login_url():
    """Generate Kite Connect login URL."""
    kite = get_kite_client()
    return kite.login_url()


def generate_session(request_token):
    """
    Exchange request_token for access_token.
    
    Returns:
        dict with 'access_token', 'user_id', etc.
    """
    kite = get_kite_client()
    data = kite.generate_session(request_token, api_secret=settings.KITE_API_SECRET)
    return data


def get_authenticated_kite(request):
    """
    Get authenticated KiteConnect client from Django session.
    
    Returns:
        KiteConnect instance or None if not authenticated.
    """
    access_token = request.session.get('kite_access_token')
    if not access_token:
        return None
    return get_kite_client(access_token)
