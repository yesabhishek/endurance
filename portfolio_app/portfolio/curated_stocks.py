"""
Curated stock lists for sector watchlists.

Contains top 10 stocks for each sector category:
Healthcare, IT, Infrastructure, Automobile, Banking
"""

# Top 10 stocks per sector on NSE
CURATED_STOCKS = {
    'healthcare': [
        {'symbol': 'SUNPHARMA', 'name': 'Sun Pharmaceutical Industries'},
        {'symbol': 'DRREDDY', 'name': 'Dr. Reddy\'s Laboratories'},
        {'symbol': 'CIPLA', 'name': 'Cipla'},
        {'symbol': 'DIVISLAB', 'name': 'Divi\'s Laboratories'},
        {'symbol': 'APOLLOHOSP', 'name': 'Apollo Hospitals Enterprise'},
        {'symbol': 'FORTIS', 'name': 'Fortis Healthcare'},
        {'symbol': 'MAXHEALTH', 'name': 'Max Healthcare Institute'},
        {'symbol': 'BIOCON', 'name': 'Biocon'},
        {'symbol': 'LUPIN', 'name': 'Lupin'},
        {'symbol': 'TORNTPHARM', 'name': 'Torrent Pharmaceuticals'},
    ],
    'it': [
        {'symbol': 'TCS', 'name': 'Tata Consultancy Services'},
        {'symbol': 'INFY', 'name': 'Infosys'},
        {'symbol': 'WIPRO', 'name': 'Wipro'},
        {'symbol': 'HCLTECH', 'name': 'HCL Technologies'},
        {'symbol': 'TECHM', 'name': 'Tech Mahindra'},
        {'symbol': 'LTIM', 'name': 'LTIMindtree'},
        {'symbol': 'MPHASIS', 'name': 'Mphasis'},
        {'symbol': 'COFORGE', 'name': 'Coforge'},
        {'symbol': 'PERSISTENT', 'name': 'Persistent Systems'},
        {'symbol': 'LTTS', 'name': 'L&T Technology Services'},
    ],
    'infra': [
        {'symbol': 'LT', 'name': 'Larsen & Toubro'},
        {'symbol': 'ADANIENT', 'name': 'Adani Enterprises'},
        {'symbol': 'ADANIPORTS', 'name': 'Adani Ports and SEZ'},
        {'symbol': 'POWERGRID', 'name': 'Power Grid Corporation'},
        {'symbol': 'NTPC', 'name': 'NTPC'},
        {'symbol': 'COALINDIA', 'name': 'Coal India'},
        {'symbol': 'GAIL', 'name': 'GAIL (India)'},
        {'symbol': 'ADANIGREEN', 'name': 'Adani Green Energy'},
        {'symbol': 'IRFC', 'name': 'Indian Railway Finance Corporation'},
        {'symbol': 'NHPC', 'name': 'NHPC'},
    ],
    'automobile': [
        {'symbol': 'TATAMOTORS', 'name': 'Tata Motors'},
        {'symbol': 'MARUTI', 'name': 'Maruti Suzuki India'},
        {'symbol': 'M&M', 'name': 'Mahindra & Mahindra'},
        {'symbol': 'BAJAJ-AUTO', 'name': 'Bajaj Auto'},
        {'symbol': 'HEROMOTOCO', 'name': 'Hero MotoCorp'},
        {'symbol': 'EICHERMOT', 'name': 'Eicher Motors'},
        {'symbol': 'ASHOKLEY', 'name': 'Ashok Leyland'},
        {'symbol': 'TVSMOTOR', 'name': 'TVS Motor Company'},
        {'symbol': 'BHARATFORG', 'name': 'Bharat Forge'},
        {'symbol': 'MOTHERSON', 'name': 'Motherson Sumi Wiring India'},
    ],
    'banking': [
        {'symbol': 'HDFCBANK', 'name': 'HDFC Bank'},
        {'symbol': 'ICICIBANK', 'name': 'ICICI Bank'},
        {'symbol': 'KOTAKBANK', 'name': 'Kotak Mahindra Bank'},
        {'symbol': 'SBIN', 'name': 'State Bank of India'},
        {'symbol': 'AXISBANK', 'name': 'Axis Bank'},
        {'symbol': 'INDUSINDBK', 'name': 'IndusInd Bank'},
        {'symbol': 'BANKBARODA', 'name': 'Bank of Baroda'},
        {'symbol': 'PNB', 'name': 'Punjab National Bank'},
        {'symbol': 'IDFCFIRSTB', 'name': 'IDFC First Bank'},
        {'symbol': 'FEDERALBNK', 'name': 'Federal Bank'},
    ],
    'energy': [
        {'symbol': 'RELIANCE', 'name': 'Reliance Industries'},
        {'symbol': 'ONGC', 'name': 'Oil and Natural Gas Corporation'},
        {'symbol': 'BPCL', 'name': 'Bharat Petroleum Corporation'},
        {'symbol': 'IOC', 'name': 'Indian Oil Corporation'},
        {'symbol': 'HINDPETRO', 'name': 'Hindustan Petroleum Corporation'},
        {'symbol': 'PETRONET', 'name': 'Petronet LNG'},
        {'symbol': 'GUJGASLTD', 'name': 'Gujarat Gas'},
        {'symbol': 'IGL', 'name': 'Indraprastha Gas'},
        {'symbol': 'MGL', 'name': 'Mahanagar Gas'},
        {'symbol': 'GSPL', 'name': 'Gujarat State Petronet'},
    ],
    'fmcg': [
        {'symbol': 'ITC', 'name': 'ITC'},
        {'symbol': 'HINDUNILVR', 'name': 'Hindustan Unilever'},
        {'symbol': 'NESTLEIND', 'name': 'Nestlé India'},
        {'symbol': 'BRITANNIA', 'name': 'Britannia Industries'},
        {'symbol': 'DABUR', 'name': 'Dabur India'},
        {'symbol': 'MARICO', 'name': 'Marico'},
        {'symbol': 'COLPAL', 'name': 'Colgate-Palmolive India'},
        {'symbol': 'GODREJCP', 'name': 'Godrej Consumer Products'},
        {'symbol': 'TATACONSUM', 'name': 'Tata Consumer Products'},
        {'symbol': 'PGHH', 'name': 'Procter & Gamble Hygiene'},
    ],
    'pharma': [
        {'symbol': 'SUNPHARMA', 'name': 'Sun Pharmaceutical Industries'},
        {'symbol': 'DRREDDY', 'name': 'Dr. Reddy\'s Laboratories'},
        {'symbol': 'CIPLA', 'name': 'Cipla'},
        {'symbol': 'DIVISLAB', 'name': 'Divi\'s Laboratories'},
        {'symbol': 'BIOCON', 'name': 'Biocon'},
        {'symbol': 'LUPIN', 'name': 'Lupin'},
        {'symbol': 'TORNTPHARM', 'name': 'Torrent Pharmaceuticals'},
        {'symbol': 'AUROPHARMA', 'name': 'Aurobindo Pharma'},
        {'symbol': 'GLENMARK', 'name': 'Glenmark Pharmaceuticals'},
        {'symbol': 'ALKEM', 'name': 'Alkem Laboratories'},
    ],
    'metals': [
        {'symbol': 'TATASTEEL', 'name': 'Tata Steel'},
        {'symbol': 'JSWSTEEL', 'name': 'JSW Steel'},
        {'symbol': 'HINDALCO', 'name': 'Hindalco Industries'},
        {'symbol': 'VEDL', 'name': 'Vedanta'},
        {'symbol': 'COALINDIA', 'name': 'Coal India'},
        {'symbol': 'NMDC', 'name': 'NMDC'},
        {'symbol': 'SAIL', 'name': 'Steel Authority of India'},
        {'symbol': 'JINDALSTEL', 'name': 'Jindal Steel & Power'},
        {'symbol': 'NATIONALUM', 'name': 'National Aluminium Company'},
        {'symbol': 'APLAPOLLO', 'name': 'APL Apollo Tubes'},
    ],
    'realty': [
        {'symbol': 'DLF', 'name': 'DLF'},
        {'symbol': 'GODREJPROP', 'name': 'Godrej Properties'},
        {'symbol': 'OBEROIRLTY', 'name': 'Oberoi Realty'},
        {'symbol': 'PHOENIXLTD', 'name': 'The Phoenix Mills'},
        {'symbol': 'PRESTIGE', 'name': 'Prestige Estates Projects'},
        {'symbol': 'LODHA', 'name': 'Macrotech Developers'},
        {'symbol': 'BRIGADE', 'name': 'Brigade Enterprises'},
        {'symbol': 'SOBHA', 'name': 'Sobha'},
        {'symbol': 'SUNTECK', 'name': 'Sunteck Realty'},
        {'symbol': 'MAHLIFE', 'name': 'Mahindra Lifespace Developers'},
    ],
}


def get_curated_stocks(sector_key: str) -> list:
    """Get curated stocks for a sector."""
    return CURATED_STOCKS.get(sector_key, [])


def get_all_sectors() -> list:
    """Get list of all sector keys."""
    return list(CURATED_STOCKS.keys())
