"""
Django models for Portfolio app.
"""

from django.db import models


class Watchlist(models.Model):
    """Sector-based watchlist."""
    
    SECTOR_CHOICES = [
        ('healthcare', 'Healthcare'),
        ('infra', 'Infrastructure'),
        ('automobile', 'Automobile'),
        ('it', 'Information Technology'),
        ('banking', 'Banking & Finance'),
        ('energy', 'Energy'),
        ('fmcg', 'FMCG'),
        ('pharma', 'Pharma'),
        ('metals', 'Metals & Mining'),
        ('realty', 'Real Estate'),
    ]
    
    name = models.CharField(max_length=100)
    sector = models.CharField(max_length=50, choices=SECTOR_CHOICES, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} ({self.sector})"


class WatchlistItem(models.Model):
    """Individual stock in a watchlist."""
    
    watchlist = models.ForeignKey(
        Watchlist, 
        on_delete=models.CASCADE, 
        related_name='items'
    )
    symbol = models.CharField(max_length=50)
    exchange = models.CharField(max_length=10, default='NSE')
    notes = models.TextField(blank=True)
    added_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-added_at']
        unique_together = ['watchlist', 'symbol']
    
    def __str__(self):
        return f"{self.symbol} in {self.watchlist.name}"
