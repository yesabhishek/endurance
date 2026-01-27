"""
URL configuration for portfolio app.
"""

from django.urls import path
from . import views

app_name = 'portfolio'

urlpatterns = [
    # Dashboard
    path('', views.dashboard, name='dashboard'),
    
    # Holdings & Positions
    path('holdings/', views.holdings, name='holdings'),
    path('holdings/<str:symbol>/', views.investment_detail, name='investment_detail'),
    path('positions/', views.positions, name='positions'),
    
    # Market Overview
    path('market/', views.market_overview, name='market'),
    
    # Stock Detail (for any stock)
    path('stock/<str:symbol>/', views.stock_detail, name='stock_detail'),
    
    # Watchlists
    path('watchlist/', views.watchlist_overview, name='watchlist'),
    path('watchlist/<str:sector>/', views.sector_watchlist, name='sector_watchlist'),
    path('watchlist/<str:sector>/add/', views.add_to_watchlist, name='add_to_watchlist'),
    path('watchlist/<str:sector>/remove/<int:item_id>/', views.remove_from_watchlist, name='remove_from_watchlist'),
    
    # Auth
    path('login/', views.kite_login, name='kite_login'),
    path('callback/', views.kite_callback, name='kite_callback'),
    path('logout/', views.kite_logout, name='kite_logout'),
    
    # API
    path('api/portfolio/', views.api_portfolio, name='api_portfolio'),
    path('api/ai-suggest/<str:symbol>/', views.api_ai_suggestion, name='api_ai_suggestion'),
    path('api/chart/<str:symbol>/', views.api_chart_data, name='api_chart_data'),
]
