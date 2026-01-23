"""
URL configuration for portfolio_project project.
"""

from django.urls import path, include

urlpatterns = [
    path('', include('portfolio.urls')),
]
