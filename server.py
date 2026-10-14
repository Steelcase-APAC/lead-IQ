#!/usr/bin/env python3
"""
CRE Lease-IQ - Local Server & Live Google Sheets Sync Engine
Serves the web dashboard and provides live two-way sync with Google Sheets.
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

TABS = {
    'India': {'gid': '6578112', 'code': 'IN', 'flag': '🇮🇳', 'currency': 'INR', 'symbol': '₹', 'name': 'India'},
    'Malaysia': {'gid': '1410399683', 'code': 'MY', 'flag': '🇲🇾', 'currency': 'MYR', 'symbol': 'RM', 'name': 'Malaysia'},
    'Korea': {'gid': '107222265', 'code': 'KR', 'flag': '🇰🇷', 'currency': 'KRW', 'symbol': '₩', 'name': 'South Korea'},
    'Japan': {'gid': '192656001', 'code': 'JP', 'flag': '🇯🇵', 'currency': 'JPY', 'symbol': '¥', 'name': 'Japan'},
    'Sri Lanka': {'gid': '491101535', 'code': 'LK', 'flag': '🇱🇰', 'currency': 'LKR', 'symbol': 'SL Rs', 'name': 'Sri Lanka'},
    'CompanyTracker': {'gid': '263587632', 'name': 'Company Tracker'}
}

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
    if any(k in t for k in ['now', 'immediate', 'underway', 'in progress', 'current', 'imminent']):
        return 'Immediate'
    if any(k in t for k in ['q4 2026', 'q1 2027', 'dec 2026', 'near-term', 'open']):
        return 'Near-Term'
    if any(k in t for k in ['2027', 'pipeline', 'pre-lease', '2030', 'pre-construction']):
        return 'Pipeline'
    return 'Active'

def detect_sector(company, signal):
    text = (company + ' ' + signal).lower()
    if any(k in text for k in ['bank', 'financial', 'insurance', 'securities', 'asset management', 'jpmorgan', 'invesco', 'julius baer', 'bancorp', 'bfsi', 'maybank', 'cimb', 'ambank', 'hana', 'leadcorp', 'k-sure', 'combank', 'cbc', 'lolc']):
        return 'BFSI (Banking & Finance)'
    if any(k in text for k in ['semiconductor', 'chip', 'nvidia', 'qualcomm', 'infineon', 'mediatek', 'hardware', 'intel', 'micro']):
        return 'Semiconductor & Hardware'
    if any(k in text for k in ['software', 'google', 'intuit', 'adobe', 'uber', 'ai lab', 'huawei', 'ant international', 'cloud', 'digital', 'tech', 'krafton', 'gmarket', 'terrasky', 'datachain', 'digirise']):
        return 'Enterprise Software & Tech'
    if any(k in text for k in ['consulting', 'accenture', 'pwc', 'mckinsey', 'yamada', 'nihon m&a', 'deloitte', 'kpmg', 'ey', 'salescore', 'randstad', 'it services', 'tech mahindra', 'ltimindtree', 'genpact', 'concentrix']):
        return 'IT & Global Consulting'
    if any(k in text for k in ['retail', 'starbucks', 'nike', 'disney', 'casio', 'booking.com', 'airbnb', 'hotel', 'travel', 'jtb', 'jeju air', 't\'way', 'fila', 'dharma', 'consumer', 'beauty']):
        return 'Retail, Travel & Consumer'
    if any(k in text for k in ['health', 'medical', 'pharma', 'hospital', 'boston scientific', 'danaher', 'enbio', 'celestra', 'eppendorf', 'intuitive surgical', 'topsoe', 'eaton', 'welspun', 'hyundai motor', 'sumitomo densetsu']):
        return 'Industrial & MedTech'
    if any(k in text for k in ['coworking', 'flex', 'smartworks', 'table space', 'executive centre', 'worq', 'servcorp', 'regus', 'wework']):
        return 'Flex & Coworking'
    if any(k in text for k in ['tender', 'government', 'narcotics', 'income tax', 'embassy', 'ministry', 'karnatakatenders', 'shipping corporation']):
        return 'Government & Public Tenders'
    return 'Corporate & Commercial'

def normalize_city(market_str, country):
    if not market_str: return country
    city = market_str.split('(')[0].split(',')[0].strip()
    if country == 'Malaysia':
        cl = (market_str + ' ' + city).lower()
        if 'nationwide' in cl and 'hq kl' not in cl:
            return 'Nationwide'
        if any(k in cl for k in ['kl', 'kuala lumpur', 'klang valley', 'trx', 'bangsar', 'subang', 'damansara', 'clanberry', 'merdeka 118', 'klcc', 'kl sentral', 'maxis tower']):
            return 'Kuala Lumpur'
        if any(k in cl for k in ['penang', 'bayan lepas', 'george town', 'georgetown', 'bandar cassia']):
            return 'Penang'
        if any(k in cl for k in ['johor', 'jb', 'iskandar', 'medini', 'silc']):
            return 'Johor Bahru'
        return 'Kuala Lumpur'
    return city if city else country

def sync_from_google_sheets():
    print('[SYNC] Fetching live data from Google Sheet:', SHEET_ID)
    all_leads = []
    tracker_records = []
    lead_id = 1

    # 1. Fetch Country Tabs
    for country in ['India', 'Malaysia', 'Korea', 'Japan', 'Sri Lanka']:
        meta = TABS[country]
        url = f'https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={meta["gid"]}'
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=12) as resp:
                content = resp.read().decode('utf-8')
                rows = list(csv.reader(io.StringIO(content)))
                for r in rows[1:]:
                    if not r or not any(r): continue
                    comp = r[0].strip() if len(r)>0 else ''
                    if not comp: continue
                    mkt = r[1].strip() if len(r)>1 else ''
                    sig = r[2].strip() if len(r)>2 else ''
                    src = r[3].strip() if len(r)>3 else ''
                    url_link = r[4].strip() if len(r)>4 else ''
                    tim = r[5].strip() if len(r)>5 else ''
                    date = r[6].strip() if len(r)>6 else ''

                    sqft = extract_sqft(sig)
                    urgency = clean_urgency(tim)
                    sector = detect_sector(comp, sig)
                    city = normalize_city(mkt, country)

                    if sqft >= 1000000: area_fmt = f'{sqft/1000000:.2f}M sq ft'
                    elif sqft >= 100000 and country == 'India': area_fmt = f'{sqft/100000:.2f} Lakh sq ft'
                    elif sqft > 0: area_fmt = f'{sqft:,.0f} sq ft'
                    else: area_fmt = 'Undisclosed'

                    deal_val = 'Commercial Terms'
                    val_m = re.search(r'((?:Rs|RM|₩|won|¥|yen|LKR|\$)\s*[\d\.,]+(?:\s*(?:trillion|billion|bn|million|m|cr|lakh|k))?(?:/[a-z]+)?)', sig, re.I)
                    if val_m: deal_val = val_m.group(1)
                    elif 'cr' in sig.lower() and country == 'India':
                        c_m = re.search(r'([\d\.,]+\s*cr(?:/mo)?)', sig, re.I)
                        if c_m: deal_val = f'₹{c_m.group(1)}'

                    all_leads.append({
                        'id': lead_id,
                        'country': country,
                        'countryCode': meta['code'],
                        'flag': meta['flag'],
                        'currency': meta['currency'],
                        'currencySymbol': meta['symbol'],
                        'company': comp,
                        'market': mkt,
                        'city': city,
                        'areaSqFt': sqft,
                        'areaFormatted': area_fmt,
                        'dealValue': deal_val,
                        'signal': sig,
                        'timing': tim if tim else 'Active commercial opportunity',
                        'urgency': urgency,
                        'sector': sector,
                        'source': src if src else 'Verified Source',
                        'sourceUrl': url_link if url_link else '#',
                        'dateFound': date
                    })
                    lead_id += 1
        except Exception as e:
            print(f'[SYNC ERROR] Failed to fetch {country}: {e}')

    # 2. Fetch Company Tracker Tab
    tracker_url = f'https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={TABS["CompanyTracker"]["gid"]}'
    try:
        req = urllib.request.Request(tracker_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=12) as resp:
            content = resp.read().decode('utf-8')
            rows = list(csv.reader(io.StringIO(content)))
            for idx, r in enumerate(rows[1:]):
                if not r or not any(r): continue
                comp = r[0].strip() if len(r)>0 else ''
                country = r[1].strip() if len(r)>1 else ''
                market = r[2].strip() if len(r)>2 else ''
                current_snap = r[3].strip() if len(r)>3 else ''
                prev_snap = r[4].strip() if len(r)>4 else ''
                change = r[5].strip() if len(r)>5 else ''
                trend = r[6].strip() if len(r)>6 else ''
                status = r[7].strip() if len(r)>7 else 'Watch'
                last_checked = r[8].strip() if len(r)>8 else ''
                notes = r[9].strip() if len(r)>9 else ''

                country_clean = country
                if any(k in country for k in ['Bengaluru', 'Mumbai', 'Agartala', 'Palghar', 'Chennai']):
                    country_clean = 'India'
                elif any(k in country for k in ['Colombo', 'Port City', 'Kerawalapitiya']):
                    country_clean = 'Sri Lanka'

                tracker_records.append({
                    'id': idx + 1,
                    'company': comp,
                    'country': country_clean,
                    'market': market,
                    'currentSnapshot': current_snap,
                    'previousSnapshot': prev_snap,
                    'change': change if change else '— (baseline)',
                    'hasChange': change not in ['', '—', '— (baseline)'],
                    'trend': trend if trend else '—',
                    'status': status if status in ['Active', 'Watch'] else 'Watch',
                    'lastChecked': last_checked if last_checked else datetime.date.today().isoformat(),
                    'notes': notes
                })
    except Exception as e:
        print(f'[SYNC ERROR] Failed to fetch Company Tracker: {e}')

    timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    result = {
        'leads': all_leads,
        'tracker': tracker_records,
        'lastSynced': timestamp,
        'sheetId': SHEET_ID
    }

    # Persist locally
    try:
        with open('data.js', 'w') as f:
            f.write(f'// Auto-synced from Google Sheet {SHEET_ID} at {timestamp}\n')
            f.write(f'const GOOGLE_SHEET_CONFIG = {json.dumps({"sheetId": SHEET_ID, "tabs": TABS}, indent=2)};\n\n')
            f.write(f'const INITIAL_LEADS_DATA = {json.dumps(all_leads, indent=2)};\n\n')
            f.write(f'const INITIAL_TRACKER_DATA = {json.dumps(tracker_records, indent=2)};\n')
        print(f'[SYNC OK] Synced {len(all_leads)} leads and {len(tracker_records)} companies at {timestamp}')
    except Exception as e:
        print('[SYNC WRITE ERROR]', e)

    return result

class CustomHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_GET(self):
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
    with socketserver.TCPServer(('', PORT), CustomHTTPHandler) as httpd:
        print(f'Server started on http://localhost:{PORT}')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nShutting down server...')
            httpd.shutdown()
