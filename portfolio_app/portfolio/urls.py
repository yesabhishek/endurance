"""
URL configuration for portfolio app.
"""

from django.urls import path
from . import views

app_name = 'portfolio'

urlpatterns = [
    path('', views.dashboard, name='dashboard'),
    path('holdings/', views.holdings, name='holdings'),
    path('positions/', views.positions, name='positions'),
    path('login/', views.kite_login, name='kite_login'),
    path('callback/', views.kite_callback, name='kite_callback'),
    path('logout/', views.kite_logout, name='kite_logout'),
    path('api/portfolio/', views.api_portfolio, name='api_portfolio'),
]
