#!/usr/bin/env python3
"""
CRE Lease-IQ - Local Server & Live Google Sheets Sync Engine
Future-proof engine that dynamically detects all tabs in the Google Sheet,
ingests new data sources (including China and any future markets),
and serves the web dashboard with real-time sync.
"""

import http.server
import socketserver
import urllib.request
import csv
import io
import json
import re
import datetime
import os
import sys

PORT = 8089
SHEET_ID = '1DojjV8QQH2Xbd6mpETIrqhmGSbRqlOxpKZbQsA5dQB0'

# Comprehensive Country & Market Metadata Registry
COUNTRY_METADATA_REGISTRY = {
    'China': {'code': 'CN', 'flag': '🇨🇳', 'currency': 'CNY', 'symbol': '¥', 'name': 'China'},
    'Malaysia': {'code': 'MY', 'flag': '🇲🇾', 'currency': 'MYR', 'symbol': 'RM', 'name': 'Malaysia'},
    'India': {'code': 'IN', 'flag': '🇮🇳', 'currency': 'INR', 'symbol': '₹', 'name': 'India'},
    'Korea': {'code': 'KR', 'flag': '🇰🇷', 'currency': 'KRW', 'symbol': '₩', 'name': 'South Korea'},
    'South Korea': {'code': 'KR', 'flag': '🇰🇷', 'currency': 'KRW', 'symbol': '₩', 'name': 'South Korea'},
    'Japan': {'code': 'JP', 'flag': '🇯🇵', 'currency': 'JPY', 'symbol': '¥', 'name': 'Japan'},
    'Sri Lanka': {'code': 'LK', 'flag': '🇱🇰', 'currency': 'LKR', 'symbol': 'SL Rs', 'name': 'Sri Lanka'},
    'Singapore': {'code': 'SG', 'flag': '🇸🇬', 'currency': 'SGD', 'symbol': 'S$', 'name': 'Singapore'},
    'Australia': {'code': 'AU', 'flag': '🇦🇺', 'currency': 'AUD', 'symbol': 'A$', 'name': 'Australia'},
    'Hong Kong': {'code': 'HK', 'flag': '🇭🇰', 'currency': 'HKD', 'symbol': 'HK$', 'name': 'Hong Kong'},
    'Taiwan': {'code': 'TW', 'flag': '🇹🇼', 'currency': 'TWD', 'symbol': 'NT$', 'name': 'Taiwan'},
    'Indonesia': {'code': 'ID', 'flag': '🇮🇩', 'currency': 'IDR', 'symbol': 'Rp', 'name': 'Indonesia'},
    'Thailand': {'code': 'TH', 'flag': '🇹🇭', 'currency': 'THB', 'symbol': '฿', 'name': 'Thailand'},
    'Philippines': {'code': 'PH', 'flag': '🇵🇭', 'currency': 'PHP', 'symbol': '₱', 'name': 'Philippines'},
    'Vietnam': {'code': 'VN', 'flag': '🇻🇳', 'currency': 'VND', 'symbol': '₫', 'name': 'Vietnam'},
    'New Zealand': {'code': 'NZ', 'flag': '🇳🇿', 'currency': 'NZD', 'symbol': 'NZ$', 'name': 'New Zealand'},
    'United Kingdom': {'code': 'GB', 'flag': '🇬🇧', 'currency': 'GBP', 'symbol': '£', 'name': 'United Kingdom'},
    'UK': {'code': 'GB', 'flag': '🇬🇧', 'currency': 'GBP', 'symbol': '£', 'name': 'United Kingdom'},
    'United States': {'code': 'US', 'flag': '🇺🇸', 'currency': 'USD', 'symbol': '$', 'name': 'United States'},
    'USA': {'code': 'US', 'flag': '🇺🇸', 'currency': 'USD', 'symbol': '$', 'name': 'United States'},
}

# Non-deal / reference system tabs to ignore from market leads
SYSTEM_TABS = {'snapshots', 'snapshot', 'sources', 'source', 'readme', 'metadata', 'config'}

def resolve_country_meta(tab_name):
    """Dynamically resolve country metadata with graceful fallback for unknown countries."""
    clean = tab_name.strip()
    if clean in COUNTRY_METADATA_REGISTRY:
        return COUNTRY_METADATA_REGISTRY[clean].copy()
    for k, v in COUNTRY_METADATA_REGISTRY.items():
        if k.lower() == clean.lower():
            return v.copy()
    code = ''.join([w[0] for w in clean.split()[:2]]).upper() if len(clean.split()) > 1 else clean[:2].upper()
    return {
        'code': code if code else 'GL',
        'flag': '🌐',
        'currency': 'USD',
        'symbol': '$',
        'name': clean
    }

def discover_google_sheet_tabs():
    """
    Dynamically discover all tabs in the Google Sheet by parsing its htmlview.
    Future-proof: automatically identifies any new tabs added by the user.
    """
    url = f'https://docs.google.com/spreadsheets/d/{SHEET_ID}/htmlview'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
    tabs = {}
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8')
            pattern = r'items\.push\(\{\s*name:\s*"([^"]+)",[^}]*gid:\s*"([0-9]+)"'
            for match in re.finditer(pattern, html):
                name, gid = match.group(1), match.group(2)
                tabs[name] = gid
        print(f'[DISCOVERY] Found {len(tabs)} tabs in Google Sheet: {list(tabs.keys())}')
    except Exception as e:
        print(f'[DISCOVERY ERROR] Failed to fetch htmlview: {e}')

    # Safe fallback if offline or request blocked
    if not tabs:
        print('[DISCOVERY] Using fallback tab definitions')
        tabs = {
            'India': '6578112',
            'Malaysia': '1410399683',
            'Korea': '107222265',
            'Japan': '192656001',
            'Sri Lanka': '491101535',
            'China': '584186119',
            'Company Tracker': '263587632'
        }
    return tabs

def extract_sqft(text):
    if not text: return 0
    m = re.search(r'([\d\.]+)\s*(?:L|lakh|Lakh)\s*sq\s*ft', text, re.I)
    if m: return int(float(m.group(1)) * 100000)
    m = re.search(r'([\d\.]+)\s*(?:M|mn|million)\s*sq\s*ft', text, re.I)
    if m:
        val = float(m.group(1))
        if val < 10.0: return int(val * 1000000)
    m = re.search(r'([\d,]+)\s*sq\s*ft', text, re.I)
    if m:
        try: return int(m.group(1).replace(',', ''))
        except: pass
    m = re.search(r'([\d,]+)\s*tsubo', text, re.I)
    if m:
        try: return int(int(m.group(1).replace(',', '')) * 35.58)
        except: pass
    m = re.search(r'([\d,]+)\s*pyeong', text, re.I)
    if m:
        try: return int(int(m.group(1).replace(',', '')) * 35.58)
        except: pass
    m = re.search(r'([\d,]+)\s*sqm', text, re.I)
    if m:
        try: return int(int(m.group(1).replace(',', '')) * 10.7639)
        except: pass
    return 0

def clean_urgency(text):
    if not text: return 'Active'
    t = text.lower()
    if any(k in t for k in ['now', 'immediate', 'underway', 'in progress', 'current', 'imminent', 'fit-out', 'relocation', 'fitting out']):
        return 'Immediate'
    if any(k in t for k in ['q4 2026', 'q1 2027', 'dec 2026', 'near-term', 'open', 'h2 2026', 'h1 2027']):
        return 'Near-Term'
    if any(k in t for k in ['2027', '2028', '2029', '2030', 'pipeline', 'pre-lease', 'pre-construction', 'completion']):
        return 'Pipeline'
    return 'Active'

def detect_sector(company, signal):
    text = (company + ' ' + signal).lower()
    if any(k in text for k in ['bank', 'financial', 'insurance', 'securities', 'asset management', 'jpmorgan', 'invesco', 'julius baer', 'bancorp', 'bfsi', 'maybank', 'cimb', 'ambank', 'hana', 'leadcorp', 'k-sure', 'combank', 'cbc', 'lolc', 'capital', 'fund management']):
        return 'BFSI (Banking & Finance)'
    if any(k in text for k in ['semiconductor', 'chip', 'nvidia', 'qualcomm', 'infineon', 'mediatek', 'hardware', 'intel', 'micro']):
        return 'Semiconductor & Hardware'
    if any(k in text for k in ['software', 'google', 'intuit', 'adobe', 'uber', 'ai lab', 'huawei', 'ant international', 'cloud', 'digital', 'tech', 'krafton', 'gmarket', 'terrasky', 'datachain', 'digirise', 'ibm', 'beichen', 'bytedance']):
        return 'Enterprise Software & Tech'
    if any(k in text for k in ['consulting', 'accenture', 'pwc', 'mckinsey', 'yamada', 'nihon m&a', 'deloitte', 'kpmg', 'ey', 'salescore', 'randstad', 'it services', 'tech mahindra', 'ltimindtree', 'genpact', 'concentrix', 'lalamove', 'pdd', 'pinduoduo']):
        return 'IT & Global Consulting'
    if any(k in text for k in ['retail', 'starbucks', 'nike', 'disney', 'casio', 'booking.com', 'airbnb', 'hotel', 'travel', 'jtb', 'jeju air', 't\'way', 'fila', 'dharma', 'consumer', 'beauty', 'rolex', 'sports', 'fashion', 'luxury', 'yy sports']):
        return 'Retail, Travel & Consumer'
    if any(k in text for k in ['health', 'medical', 'pharma', 'hospital', 'boston scientific', 'danaher', 'enbio', 'celestra', 'eppendorf', 'intuitive surgical', 'topsoe', 'eaton', 'welspun', 'hyundai motor', 'sumitomo densetsu', 'amgen', 'bristol myers', 'squibb', 'aladdin', 'xylem', 'environmental', 'bureau of shipping']):
        return 'Industrial & MedTech'
    if any(k in text for k in ['coworking', 'flex', 'smartworks', 'table space', 'executive centre', 'worq', 'servcorp', 'regus', 'wework']):
        return 'Flex & Coworking'
    if any(k in text for k in ['tender', 'government', 'narcotics', 'income tax', 'embassy', 'ministry', 'karnatakatenders', 'shipping corporation']):
        return 'Government & Public Tenders'
    return 'Corporate & Commercial'

def normalize_city(market_str, country):
    if not market_str: return country
    city = market_str.split('(')[0].split(',')[0].strip()
    cl = (market_str + ' ' + city).lower()

    if country == 'Malaysia':
        if 'nationwide' in cl and 'hq kl' not in cl:
            return 'Nationwide'
        if any(k in cl for k in ['kl', 'kuala lumpur', 'klang valley', 'trx', 'bangsar', 'subang', 'damansara', 'clanberry', 'merdeka 118', 'klcc', 'kl sentral', 'maxis tower']):
            return 'Kuala Lumpur'
        if any(k in cl for k in ['penang', 'bayan lepas', 'george town', 'georgetown', 'bandar cassia']):
            return 'Penang'
        if any(k in cl for k in ['johor', 'jb', 'iskandar', 'medini', 'silc']):
            return 'Johor Bahru'
        return 'Kuala Lumpur'

    if country == 'China':
        if 'beijing' in cl: return 'Beijing'
        if 'shanghai' in cl: return 'Shanghai'
        if 'shenzhen' in cl: return 'Shenzhen'
        if 'guangzhou' in cl: return 'Guangzhou'
        if 'chengdu' in cl: return 'Chengdu'
        if 'hangzhou' in cl: return 'Hangzhou'
        if 'wuhan' in cl: return 'Wuhan'
        if 'suzhou' in cl: return 'Suzhou'
        if 'hong kong' in cl or 'hk' in cl: return 'Hong Kong'
        if 'tianjin' in cl: return 'Tianjin'
        if 'nanjing' in cl: return 'Nanjing'
        if 'chongqing' in cl: return 'Chongqing'
        return city if city else 'China Regional'

    return city if city else country

def sync_from_google_sheets():
    print('[SYNC] Fetching live data and discovering tabs from Google Sheet:', SHEET_ID)
    os.makedirs('data', exist_ok=True)

    # 1. Dynamically discover tabs
    discovered_tabs = discover_google_sheet_tabs()
    print(f'[SYNC] Discovered {len(discovered_tabs)} tabs: {list(discovered_tabs.keys())}')

    # 2. Fetch and save tabs to data/
    for name, gid in discovered_tabs.items():
        name_clean = name.strip()
        slug = name_clean.lower().replace(' ', '_')
        url = f'https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={gid}'
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
            with urllib.request.urlopen(req, timeout=12) as resp:
                content = resp.read().decode('utf-8')
                out_path = os.path.join('data', f'{slug}.csv')
                with open(out_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f'[SYNC] Saved {slug}.csv ({len(content)} bytes)')
        except Exception as e:
            print(f'[SYNC WARNING] Could not download tab {name_clean}: {e}')

    # 3. Run the complete Lease-IQ Dual-Layer Parser and data builder
    import importlib
    import build_data
    importlib.reload(build_data)
    result = build_data.build_all()
    print(f"[SYNC OK] Successfully rebuilt Lease-IQ engine: {len(result['leads'])} deals across {len(result['markets'])} markets at {result['lastSynced']}")
    return result

class CustomHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_GET(self):
        if self.path in ('/favicon.ico', '/favicon.svg'):
            try:
                with open('favicon.svg', 'rb') as f:
                    icon_bytes = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'image/svg+xml')
                self.send_header('Content-Length', str(len(icon_bytes)))
                self.end_headers()
                self.wfile.write(icon_bytes)
                return
            except Exception:
                pass

        if self.path == '/api/sync':
            try:
                data = sync_from_google_sheets()
                response_bytes = json.dumps(data).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(response_bytes)))
                self.end_headers()
                self.wfile.write(response_bytes)
            except Exception as e:
                err = json.dumps({'error': str(e)}).encode('utf-8')
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(err)
            return

        super().do_GET()

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    print(f'Starting Lease-IQ server with dynamic Google Sheets sync on port {PORT}...')
    with socketserver.TCPServer(('', PORT), CustomHTTPHandler) as httpd:
        print(f'Server started on http://localhost:{PORT}')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nShutting down server...')
            httpd.shutdown()
