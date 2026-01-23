"""
Portfolio views.

These views render the portfolio dashboard with data from Kite Connect API.
"""

import json
from django.shortcuts import render, redirect
from django.http import JsonResponse
from . import kite_auth


def _is_authenticated(request):
    """Check if user has valid Kite access token."""
    return 'kite_access_token' in request.session


def dashboard(request):
    """Main portfolio dashboard view."""
    if not _is_authenticated(request):
        return redirect('portfolio:kite_login')
    
    try:
        kite = kite_auth.get_authenticated_kite(request)
        if not kite:
            return redirect('portfolio:kite_login')
        
        # Fetch data using pykiteconnect
        try:
            holdings = kite.holdings()
        except Exception as e:
            holdings = []
        
        try:
            positions = kite.positions()
        except Exception as e:
            positions = {'net': [], 'day': []}
        
        try:
            margins = kite.margins()
        except Exception as e:
            margins = {}
        
        try:
            profile = kite.profile()
        except Exception as e:
            profile = {}
        
        context = {
            'holdings': holdings,
            'positions': positions,
            'margins': margins,
            'profile': profile,
            'error': None,
            'is_authenticated': True,
        }
    except Exception as e:
        # Session might be expired
        request.session.flush()
        return redirect('portfolio:kite_login')
    
    return render(request, 'portfolio/dashboard.html', context)


def holdings(request):
    """Holdings detail view."""
    if not _is_authenticated(request):
        return redirect('portfolio:kite_login')
    
    try:
        kite = kite_auth.get_authenticated_kite(request)
        holdings_data = kite.holdings() if kite else []
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


def kite_login(request):
    """Initiate Kite OAuth login."""
    # If already authenticated, redirect to dashboard
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
    # Get parameters from callback
    request_token = request.GET.get('request_token')
    status = request.GET.get('status')
    
    if status != 'success' or not request_token:
        return render(request, 'portfolio/login.html', {
            'login_url': None,
            'message': 'Login failed or was cancelled.',
            'error': 'Login failed',
        })
    
    try:
        # Exchange request_token for access_token
        session_data = kite_auth.generate_session(request_token)
        
        # Store in Django session
        request.session['kite_access_token'] = session_data['access_token']
        request.session['kite_user_id'] = session_data.get('user_id', '')
        request.session['kite_user_name'] = session_data.get('user_name', '')
        
        # Redirect to dashboard
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
