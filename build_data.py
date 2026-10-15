#!/usr/bin/env python3
"""
Lease-IQ Data Builder & Intelligence Engine
Parses all 9 CSV files (6 market tabs, tracker, snapshots, sources)
Applies the Dual-Layer Parser, calculates Heat Scores, generates Opening Scripts,
computes building clusters, and outputs data.js and server sync payload.
"""

import csv
import json
import re
import datetime
import os
import glob

TODAY = datetime.date(2026, 10, 15)

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
}

KNOWN_SUBMARKETS = {
    'cbd', 'gbd', 'ybd', 'bbd', 'orr', 'bkc', 'whitefield', 'electronic city', 'bandra', 'powai',
    'nihonbashi', 'marunouchi', 'otemachi', 'shibuya', 'shinjuku', 'roppongi', 'toranomon', 'shinbashi',
    'shiodome', 'kyobashi', 'yaesu', 'akasaka', 'minato', 'chiyoda', 'chuo', 'gangnam', 'yeouido',
    'jongno', 'pangyo', 'magok', 'songpa', 'kl city', 'trx', 'klcc', 'kl sentral', 'bangsar south',
    'damansara', 'subang', 'penang', 'johor bahru', 'bayan lepas', 'george town', 'gurugram', 'noida',
    'bengaluru', 'mumbai', 'hyderabad', 'pune', 'chennai', 'kolkata', 'colombo', 'port city', 'beijing',
    'shanghai', 'shenzhen', 'guangzhou', 'tokyo', 'seoul', 'sris', 'non-sris', 'cbd fringe', 'greater kl'
}

BUILDING_INDICATORS = [
    'tower', 'center', 'centre', 'building', 'park', 'plaza', 'campus', 'square', 'atelier',
    '118', '106', 'heights', 'court', 'house', 'bridge', 'hub', 'm-square', 'mk-square', 'estate',
    'suites', 'complex', 'block', 'point', 'station'
]

def clean_company_name(comp):
    if not comp: return ''
    c = comp.strip()
    c = re.sub(r'\(TSE:\s*\d+\)', '', c, flags=re.I).strip()
    return c

def normalize_city(market_str, country):
    if not market_str: return country
    city = market_str.split('(')[0].split(',')[0].strip()
    cl = (market_str + ' ' + city).lower()

    if country == 'Malaysia':
        if 'nationwide' in cl and 'hq kl' not in cl: return 'Nationwide'
        if any(k in cl for k in ['kl', 'kuala lumpur', 'klang valley', 'trx', 'bangsar', 'subang', 'damansara', 'merdeka 118', 'klcc', 'kl sentral', 'maxis tower']):
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
        return city if city else 'China Regional'

    if country == 'India':
        if 'bengaluru' in cl or 'bangalore' in cl: return 'Bengaluru'
        if 'mumbai' in cl: return 'Mumbai'
        if 'gurugram' in cl or 'gurgaon' in cl: return 'Gurugram'
        if 'noida' in cl: return 'Noida'
        if 'hyderabad' in cl: return 'Hyderabad'
        if 'pune' in cl: return 'Pune'
        if 'chennai' in cl: return 'Chennai'
        if 'kolkata' in cl: return 'Kolkata'
        return city if city else 'India Metro'

    if country == 'Japan':
        if 'tokyo' in cl: return 'Tokyo'
        if 'osaka' in cl: return 'Osaka'
        if 'yokohama' in cl: return 'Yokohama'
        if 'nagoya' in cl: return 'Nagoya'
        return 'Tokyo'

    if country in ('Korea', 'South Korea'):
        if 'seoul' in cl or 'gbd' in cl or 'cbd' in cl or 'ybd' in cl or 'pangyo' in cl: return 'Seoul'
        if 'busan' in cl: return 'Busan'
        return 'Seoul'

    if country == 'Sri Lanka':
        if 'colombo' in cl: return 'Colombo'
        return 'Colombo'

    return city if city else country

def extract_building_and_submarket(market_str, signal_str, explicit_bldg=''):
    submarket = ''
    building = explicit_bldg.strip() if explicit_bldg else ''
    is_inferred = False

    # Extract submarket or building from market_str parenthesis
    m = re.search(r'\(([^)]+)\)', market_str)
    if m:
        parts = [p.strip() for p in m.group(1).split(',')]
        for p in parts:
            p_lower = p.lower()
            if any(ind in p_lower for ind in BUILDING_INDICATORS):
                if not building:
                    building = p
                    is_inferred = True
            elif p_lower in KNOWN_SUBMARKETS or not submarket:
                submarket = p

    # If no building found yet, try regex from signal
    if not building and signal_str:
        m_sig = re.search(r'(?:at|in|into|to|building[:\s])\s+([A-Z0-9][A-Za-z0-9\s\.\-&\'\(\)]+?(?:Tower|Center|Centre|Park|Plaza|Hub|Building|Campus|Square|Tech Park|Heights|Court|City Center|Atelier|Bridge|106|118|M-SQUARE|MK-SQUARE))', signal_str)
        if m_sig:
            candidate = m_sig.group(1).strip()
            if len(candidate) <= 50 and candidate.lower() not in KNOWN_SUBMARKETS:
                building = candidate
                is_inferred = True

    # Standardize notable buildings
    if building:
        b_clean = building.strip()
        if re.search(r'merdeka\s*118', b_clean, re.I):
            building = 'Merdeka 118'
        elif re.search(r'exchange\s*106', b_clean, re.I):
            building = 'Exchange 106'
        elif re.search(r'torch\s*tower', b_clean, re.I):
            building = 'Torch Tower'
        elif re.search(r'rmz\s*ecoworld', b_clean, re.I):
            building = 'RMZ Ecoworld Campus'
        elif re.search(r'dlf\s*cyber\s*city', b_clean, re.I):
            building = 'DLF Cyber City'
        elif re.search(r'crystal\s*bridge', b_clean, re.I):
            building = 'Crystal Bridge'
        elif re.search(r'k11\s*atelier', b_clean, re.I):
            building = 'K11 Atelier'

    return submarket, building, bool(building), is_inferred

def extract_size(explicit_size, signal_str, country):
    sqft = 0
    inferred = False
    disclosed = False
    raw_match = ''

    if explicit_size and explicit_size.strip():
        try:
            sqft = int(float(explicit_size.replace(',', '').replace(' ', '')))
            disclosed = True
        except:
            pass

    if not sqft and signal_str:
        # 1. Lakh sq ft (India)
        m = re.search(r'([\d\.]+)\s*(?:L|lakh|Lakh)\s*sq\s*ft', signal_str, re.I)
        if m:
            sqft = int(float(m.group(1)) * 100000)
            raw_match = f"{m.group(1)} Lakh sq ft"
            inferred = True
            disclosed = True

        # 2. Mn sq ft
        if not sqft:
            m = re.search(r'([\d\.]+)\s*(?:M|mn|million)\s*sq\s*ft', signal_str, re.I)
            if m and float(m.group(1)) < 15.0:
                sqft = int(float(m.group(1)) * 1000000)
                raw_match = f"{m.group(1)}M sq ft"
                inferred = True
                disclosed = True

        # 3. Direct sq ft
        if not sqft:
            m = re.search(r'([\d,]+)\s*sq\s*ft', signal_str, re.I)
            if m:
                try:
                    sqft = int(m.group(1).replace(',', ''))
                    raw_match = f"{m.group(1)} sq ft"
                    inferred = True
                    disclosed = True
                except:
                    pass

        # 4. Tsubo or Pyeong (Japan / Korea)
        if not sqft:
            m = re.search(r'([\d,]+)\s*(?:tsubo|pyeong)', signal_str, re.I)
            if m:
                try:
                    val = int(m.group(1).replace(',', ''))
                    sqft = int(val * 35.58)
                    raw_match = f"{val:,} tsubo/pyeong"
                    inferred = True
                    disclosed = True
                except:
                    pass

        # 5. Sqm (China / Korea / Global)
        if not sqft:
            m = re.search(r'([\d,]+)\s*sqm', signal_str, re.I)
            if m:
                try:
                    val = int(m.group(1).replace(',', ''))
                    sqft = int(val * 10.7639)
                    raw_match = f"{val:,} sqm"
                    inferred = True
                    disclosed = True
                except:
                    pass

    # Format
    if sqft > 0:
        if sqft >= 1000000:
            formatted = f"{sqft/1000000:.2f}M sq ft"
        elif sqft >= 100000 and country == 'India':
            formatted = f"{sqft/100000:.2f} Lakh sq ft"
        else:
            formatted = f"{sqft:,.0f} sq ft"
        if raw_match and ('sqm' in raw_match or 'tsubo' in raw_match):
            formatted += f" ({raw_match})"

        if sqft >= 100000: tier = "Mega (>100k)"
        elif sqft >= 50000: tier = "Large (50k-100k)"
        elif sqft >= 20000: tier = "Mid (20k-50k)"
        else: tier = "Boutique (<20k)"
    else:
        sqft = None
        formatted = "Not disclosed"
        tier = "Undisclosed"

    return sqft, formatted, tier, disclosed, inferred

def extract_deal_type(explicit_type, signal_str, timing_str):
    if explicit_type and explicit_type.strip():
        t = explicit_type.strip()
        return t, True, False

    text = (signal_str + ' ' + timing_str).lower()
    inferred_type = 'Unstated'

    if any(k in text for k in ['relocat', 'moved to', 'moved into', 'moves into', 'shifting', 'move completed', 'relocation']):
        inferred_type = 'Relocation'
    elif any(k in text for k in ['renew', 'extended lease', 'lease extension', 'renewal']):
        inferred_type = 'Renewal'
    elif any(k in text for k in ['pre-lease', 'pre-leased', 'pre-commit', 'pre-construction']):
        inferred_type = 'Pre-lease'
    elif any(k in text for k in ['bought', 'purchase', 'acquired', 'own-use', 'bought site']):
        inferred_type = 'Own-use Purchase'
    elif any(k in text for k in ['expand', 'expansion', 'additional space', 'added level', 'scaling', 'added footprint']):
        inferred_type = 'Expansion'
    elif any(k in text for k in ['new office', 'new set-up', 'inaugurated', 'launched', 'first permanent', 'opened new', 'new branch', 'new facility']):
        inferred_type = 'New Setup'
    elif any(k in text for k in ['consolidat']):
        inferred_type = 'Consolidation'
    elif any(k in text for k in ['tender', 'government']):
        inferred_type = 'Government Tender'

    return inferred_type, False, True

def extract_dates(explicit_date, date_found, signal_str, timing_str):
    deal_date = explicit_date.strip() if explicit_date else ''
    quarter = ''

    # Look for quarter notation like Q4 2025, 4Q2025, Q2 2026, Q3 2026, 2026-Q2
    combined = f"{deal_date} {timing_str} {signal_str} {date_found}"
    m_q = re.search(r'(?:Q([1-4])\s*(202[4-8])|(202[4-8])\s*Q([1-4])|([1-4])Q(202[4-8]))', combined, re.I)
    if m_q:
        q = m_q.group(1) or m_q.group(4) or m_q.group(5)
        yr = m_q.group(2) or m_q.group(3) or m_q.group(6)
        quarter = f"{yr}-Q{q}"

    # Extract clean deal date if not explicitly given
    if not deal_date:
        # Match YYYY-MM-DD
        m_d = re.search(r'(202[4-8]-[0-1][0-9]-[0-3][0-9])', combined)
        if m_d:
            deal_date = m_d.group(1)
        else:
            # Match "6 May 2026" or "30 Apr 2026"
            m_txt = re.search(r'(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+202[4-8])', combined, re.I)
            if m_txt:
                deal_date = m_txt.group(1)
            elif quarter:
                deal_date = quarter
            else:
                deal_date = date_found if date_found else '2026'

    if not quarter and date_found:
        try:
            dt = datetime.datetime.strptime(date_found, '%Y-%m-%d')
            q_num = (dt.month - 1) // 3 + 1
            quarter = f"{dt.year}-Q{q_num}"
        except:
            quarter = '2026-Q3'

    return deal_date, quarter

def detect_urgency(timing_str, signal_str, date_str):
    text = (timing_str + ' ' + signal_str).lower()
    if any(k in text for k in ['now', 'immediate', 'underway', 'in progress', 'current', 'imminent', 'fit-out', 'relocation', 'fitting out', 'yesterday', 'just moved']):
        return 'Immediate'
    if any(k in text for k in ['q4 2026', 'q1 2027', 'dec 2026', 'near-term', 'h2 2026', 'h1 2027']):
        return 'Near-Term'
    if any(k in text for k in ['2027', '2028', '2029', '2030', 'pipeline', 'pre-lease', 'pre-construction', 'completion']):
        return 'Pipeline'
    return 'Active'

def compute_heat_score(days_ago, sqft, deal_type, tracker_status):
    # 1. Recency Score (max 40)
    if days_ago <= 30:
        recency_pts = 40
        recency_reason = f"Fresh signal ({days_ago}d ago)"
    elif days_ago <= 60:
        recency_pts = 30
        recency_reason = f"Active window ({days_ago}d ago)"
    elif days_ago <= 90:
        recency_pts = 20
        recency_reason = f"Fit-out tail ({days_ago}d ago)"
    elif days_ago <= 180:
        recency_pts = 10
        recency_reason = f"Older deal ({days_ago}d ago)"
    else:
        recency_pts = 0
        recency_reason = "Historical benchmark (>180d)"

    # 2. Size Score (max 25)
    if sqft and sqft >= 100000:
        size_pts = 25
        size_reason = f"Mega campus ({sqft:,.0f} sq ft)"
    elif sqft and sqft >= 50000:
        size_pts = 20
        size_reason = f"Large footprint ({sqft:,.0f} sq ft)"
    elif sqft and sqft >= 20000:
        size_pts = 15
        size_reason = f"Mid-size fit-out ({sqft:,.0f} sq ft)"
    elif sqft and sqft >= 5000:
        size_pts = 10
        size_reason = f"Boutique office ({sqft:,.0f} sq ft)"
    else:
        size_pts = 5
        size_reason = "Undisclosed / Compact"

    # 3. Deal Type Score (max 20)
    if deal_type in ('Relocation', 'Pre-lease', 'New Setup', 'Expansion'):
        type_pts = 20
        type_reason = f"High fit-out demand ({deal_type})"
    elif deal_type in ('Consolidation', 'Campus'):
        type_pts = 18
        type_reason = f"Major workplace revamp ({deal_type})"
    elif deal_type == 'Own-use Purchase':
        type_pts = 15
        type_reason = "Owner fit-out spec (Purchase)"
    elif deal_type == 'Government Tender':
        type_pts = 10
        type_reason = "Public tender / RFP process"
    elif deal_type == 'Renewal':
        type_pts = 5
        type_reason = "Renewal refresh / monitor"
    else:
        type_pts = 5
        type_reason = "General commercial deal"

    # 4. Status Modifier (-20 to +15)
    if tracker_status == 'Active':
        status_pts = 15
        status_reason = "Active sales priority (+15)"
    elif tracker_status == 'Watch':
        status_pts = 5
        status_reason = "Monitored account (+5)"
    elif tracker_status == 'Engaged':
        status_pts = -20
        status_reason = "Already in active sales discussions (-20)"
    else:
        status_pts = 0
        status_reason = "Unassigned account"

    total = max(0, min(100, recency_pts + size_pts + type_pts + status_pts))
    return total, {
        'recencyPts': recency_pts,
        'recencyReason': recency_reason,
        'sizePts': size_pts,
        'sizeReason': size_reason,
        'typePts': type_pts,
        'typeReason': type_reason,
        'statusPts': status_pts,
        'statusReason': status_reason,
        'totalScore': total
    }

def generate_opening_script(comp, city, building, deal_type, sqft_formatted, signal, fitout_window=''):
    target_loc = building if building else city
    size_mention = f" for your {sqft_formatted} space" if sqft_formatted != 'Not disclosed' else ""

    if fitout_window in ('1 Year', '1-Year: Scoping & Probing'):
        return (f"Hi [Name], notice {comp}'s lease milestone at {target_loc} approaching within the next 12 months. "
                f"As your team begins scoping workspace requirements and designer briefs{size_mention}, Steelcase APAC "
                f"would love to share our latest research on agile, hybrid collaboration settings to help inform your planning.")

    if fitout_window in ('2 Years', '2-Year: Relationship Building'):
        return (f"Hi [Name], reaching out from Steelcase APAC. We track major corporate footprints across {city} "
                f"and see {comp}'s lease horizon at {target_loc} over the next 18–24 months. We'd love to connect early "
                f"to share regional workplace benchmarking and future-of-work research well ahead of your formal decision window.")

    if fitout_window in ('3 Years & Above', '3+ Years'):
        return (f"Hi [Name], reaching out from Steelcase APAC. We track long-range commercial developments across {city} "
                f"and see {comp}'s multi-year campus horizon at {target_loc} on the 3+ year roadmap. We'd love to connect early "
                f"to share master workplace planning frameworks and campus ergonomics as you shape your long-term workplace portfolio.")

    if deal_type == 'Relocation':
        return (f"Hi [Name], congratulations on {comp}'s upcoming move to {target_loc}! "
                f"As you plan the workplace design and fit-out layout{size_mention}, Steelcase APAC has supported "
                f"several recent flagship migrations across {city}. We'd love to share our latest research on agile, "
                f"high-collaboration workspaces to help maximize employee engagement from day one.")

    if deal_type == 'Expansion':
        return (f"Hi [Name], great to see {comp}'s strong growth and footprint expansion at {target_loc}! "
                f"When rapidly scaling teams, reconfiguring workstations and collaborative breakout areas is crucial. "
                f"Steelcase can share quick-deployment ergonomics and hybrid furniture benchmarks tailored to {city}'s leading firms.")

    if deal_type == 'New Setup':
        return (f"Hi [Name], welcome to {target_loc}! Congratulations on inaugurating {comp}'s new regional presence{size_mention}. "
                f"Setting up a new hub requires proven furniture performance and local warranty backing. Steelcase APAC "
                f"would love to share our local turnkey capabilities and recent tech/enterprise case studies in {city}.")

    if deal_type == 'Own-use Purchase':
        return (f"Hi [Name], congratulations to {comp} on acquiring your own building at {target_loc}! "
                f"Designing a permanent corporate campus offers an unmatched opportunity to define your brand identity and workplace sustainability. "
                f"Steelcase would welcome the chance to share architectural workplace strategies and LEED-certified furniture frameworks.")

    if deal_type == 'Renewal':
        return (f"Hi [Name], following {comp}'s recent lease renewal at {target_loc}, many forward-thinking occupiers are using this "
                f"milestone to refresh aging floorplates and introduce agile collaboration zones without relocating. "
                f"Steelcase can share cost-effective workplace retrofit benchmarks from across {city}.")

    if deal_type == 'Pre-lease':
        return (f"Hi [Name], congratulations on {comp}'s pre-lease commitment at {target_loc}! "
                f"Engaging early during the architectural phase gives your team maximum leverage on workplace layout, acoustic planning, and FF&E standards. "
                f"Steelcase APAC would be thrilled to bring our workplace consultants to brainstorm initial space concepts.")

    return (f"Hi [Name], I noticed {comp}'s recent commercial momentum at {target_loc}. "
            f"As your workplace strategy evolves in {city}, Steelcase APAC provides premium ergonomic furniture and workplace intelligence "
            f"to create high-performance office environments. Would you be open to a brief 10-minute introductory conversation?")

def detect_sector(company, signal):
    text = (company + ' ' + signal).lower()
    if any(k in text for k in ['bank', 'financial', 'insurance', 'securities', 'asset management', 'jpmorgan', 'invesco', 'julius baer', 'bancorp', 'bfsi', 'maybank', 'cimb', 'ambank', 'hana', 'leadcorp', 'k-sure', 'combank', 'cbc', 'lolc', 'capital', 'fund management', 'goldstate']):
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

def build_all():
    print("Building Lease-IQ database from /data/ CSVs...")

    # 1. Parse Company Tracker
    tracker_records = []
    tracker_by_company = {} # comp.lower() -> tracker record
    tracker_file = 'data/company_tracker.csv'
    if os.path.exists(tracker_file):
        with open(tracker_file, 'r', encoding='utf-8') as fp:
            rows = list(csv.reader(fp))
            for idx, r in enumerate(rows[1:]):
                if not r or not any(r) or not r[0].strip(): continue
                comp = clean_company_name(r[0])
                country = r[1].strip() if len(r)>1 else ''
                market = r[2].strip() if len(r)>2 else ''
                curr_snap = r[3].strip() if len(r)>3 else ''
                prev_snap = r[4].strip() if len(r)>4 else ''
                change = r[5].strip() if len(r)>5 else '— (baseline)'
                trend = r[6].strip() if len(r)>6 else '—'
                status = r[7].strip() if len(r)>7 and r[7].strip() in ('Active', 'Watch', 'Engaged') else 'Watch'
                last_checked = r[8].strip() if len(r)>8 else '2026-10-14'
                notes = r[9].strip() if len(r)>9 else ''

                rec = {
                    'id': idx + 1,
                    'company': comp,
                    'country': country,
                    'market': market,
                    'currentSnapshot': curr_snap,
                    'previousSnapshot': prev_snap,
                    'change': change,
                    'hasChange': change not in ('', '—', '— (baseline)'),
                    'trend': trend,
                    'status': status,
                    'lastChecked': last_checked,
                    'notes': notes
                }
                tracker_records.append(rec)
                tracker_by_company[comp.lower()] = rec
        print(f"Loaded {len(tracker_records)} accounts from company_tracker.csv")

    # 2. Parse Snapshots
    snapshots_records = []
    snapshots_by_company = {} # comp.lower() -> list of snapshots
    snapshots_file = 'data/snapshots.csv'
    if os.path.exists(snapshots_file):
        with open(snapshots_file, 'r', encoding='utf-8') as fp:
            rows = list(csv.reader(fp))
            for idx, r in enumerate(rows[1:]):
                if not r or not any(r): continue
                week = r[0].strip() if len(r)>0 else ''
                comp = clean_company_name(r[1]) if len(r)>1 else ''
                country = r[2].strip() if len(r)>2 else ''
                mkt = r[3].strip() if len(r)>3 else ''
                snap = r[4].strip() if len(r)>4 else ''
                src = r[5].strip() if len(r)>5 else ''
                if not comp: continue

                snap_item = {
                    'id': idx + 1,
                    'week': week,
                    'company': comp,
                    'country': country,
                    'market': mkt,
                    'snapshot': snap,
                    'source': src
                }
                snapshots_records.append(snap_item)
                snapshots_by_company.setdefault(comp.lower(), []).append(snap_item)
        print(f"Loaded {len(snapshots_records)} historical snapshots from snapshots.csv")

    # 3. Parse Sources
    sources_records = []
    sources_file = 'data/sources.csv'
    if os.path.exists(sources_file):
        with open(sources_file, 'r', encoding='utf-8') as fp:
            rows = list(csv.reader(fp))
            for idx, r in enumerate(rows[1:]):
                if not r or not any(r) or not r[2].strip(): continue
                country = r[0].strip() if len(r)>0 else ''
                tier = r[1].strip() if len(r)>1 else 'Free'
                name = r[2].strip() if len(r)>2 else ''
                covers = r[3].strip() if len(r)>3 else ''
                price = r[4].strip() if len(r)>4 else ''
                trust = r[5].strip() if len(r)>5 else 'Medium'
                dbsize = r[6].strip() if len(r)>6 else ''
                how_to_use = r[7].strip() if len(r)>7 else ''
                url = r[8].strip() if len(r)>8 else '#'

                sources_records.append({
                    'id': idx + 1,
                    'country': country,
                    'isPaid': tier.lower() == 'paid',
                    'tier': tier,
                    'source': name,
                    'whatItCovers': covers,
                    'normalPrice': price,
                    'trustLevel': trust,
                    'databaseSize': dbsize,
                    'howToUse': how_to_use,
                    'sourceUrl': url
                })
        print(f"Loaded {len(sources_records)} intelligence sources from sources.csv")

    # 4. Parse Market Tabs (Country Leads)
    all_leads = []
    lead_id = 1
    building_cluster_counts = {}

    market_files = sorted(glob.glob('data/*.csv'))
    for f in market_files:
        basename = os.path.basename(f)
        if basename in ('company_tracker.csv', 'snapshots.csv', 'sources.csv'):
            continue
        country_name = basename.replace('.csv', '').replace('_', ' ').title()
        if country_name == 'South Korea': country_name = 'Korea'
        meta = COUNTRY_METADATA_REGISTRY.get(country_name, {
            'code': country_name[:2].upper(),
            'flag': '🌐',
            'currency': 'USD',
            'symbol': '$',
            'name': country_name
        })

        with open(f, 'r', encoding='utf-8') as fp:
            rows = list(csv.reader(fp))
            print(f"Parsing market tab [{country_name}] ({len(rows)-1} rows)...")
            for r in rows[1:]:
                if not r or not any(r) or not r[0].strip(): continue
                comp = clean_company_name(r[0])
                mkt = r[1].strip() if len(r)>1 else ''
                explicit_bldg = r[2].strip() if len(r)>2 else ''
                explicit_size = r[3].strip() if len(r)>3 else ''
                explicit_type = r[4].strip() if len(r)>4 else ''
                explicit_date = r[5].strip() if len(r)>5 else ''
                sig = r[6].strip() if len(r)>6 else ''
                src = r[7].strip() if len(r)>7 else 'Verified Source'
                url_link = r[8].strip() if len(r)>8 else '#'
                timing = r[9].strip() if len(r)>9 else ''
                date_found = r[10].strip() if len(r)>10 else '2026-10-14'

                city = normalize_city(mkt, country_name)
                submarket, bldg, has_bldg, bldg_inferred = extract_building_and_submarket(mkt, sig, explicit_bldg)
                sqft, area_fmt, size_tier, has_size, size_inferred = extract_size(explicit_size, sig, country_name)
                deal_type, has_type, type_inferred = extract_deal_type(explicit_type, sig, timing)
                deal_date, deal_quarter = extract_dates(explicit_date, date_found, sig, timing)
                urgency = detect_urgency(timing, sig, date_found)
                sector = detect_sector(comp, sig)

                # Deal value currency extraction
                deal_val = 'Commercial Terms'
                val_m = re.search(r'((?:Rs|RM|₩|won|¥|yen|LKR|RMB|\$)\s*[\d\.,]+(?:\s*(?:trillion|billion|bn|million|m|cr|lakh|k))?(?:/[a-z]+)?)', sig, re.I)
                if val_m:
                    deal_val = val_m.group(1)
                elif 'cr' in sig.lower() and country_name == 'India':
                    c_m = re.search(r'([\d\.,]+\s*cr(?:/mo)?)', sig, re.I)
                    if c_m: deal_val = f'₹{c_m.group(1)}'

                # Cross-reference with tracker
                tracker_match = tracker_by_company.get(comp.lower())
                tracker_status = tracker_match['status'] if tracker_match else 'Watch'
                tracker_trend = tracker_match['trend'] if tracker_match else '—'
                tracker_notes = tracker_match['notes'] if tracker_match else ''

                # Days calculation for Recency
                days_ago = 30
                try:
                    df_dt = datetime.datetime.strptime(date_found, '%Y-%m-%d').date()
                    days_ago = max(0, (TODAY - df_dt).days)
                except:
                    pass

                # Fit-out Window / Lease Expiry Lifecycle Classification:
                # 1) 0–60 Days (Prime Fit-Out / Execution Window)
                # 2) 1 Year (Scoping & Probing)
                # 3) 2 Years (Relationship Building)
                # 4) 3 Years & Above (Strategic Long-Range Pipeline)
                combined_timing = (sig + ' ' + timing + ' ' + deal_type).lower()
                
                # Check for explicit Immediate Fit-out first
                if any(k in combined_timing for k in ['fit-out window now', 'now - immediate', 'fitting out now', 'immediate fit-out', 'furnishing window now', 'fit-out underway']):
                    fitout_window = '0–60 Days'
                # 4. 3 Years & Above: 2028+, 2029, 2030+, 3+ years, future campus, long-horizon, pre-commitments with distant delivery
                elif any(k in combined_timing for k in ['2029', '2030', '2031', '2032', '3+ year', '3 year', '3-year', '3 yr', '3yr', '3 years and above', '3 years & above', 'long-horizon', 'future campus', 'campus pipeline', 'long-range', '2028']) or ('pre-commit' in combined_timing and any(k in combined_timing for k in ['completion', 'future', 'under construction'])) or 'pre-lease' in deal_type.lower():
                    fitout_window = '3 Years & Above'
                # 2. 1 Year: 6-12 months out, 2027, scoping, probing, rfp
                elif any(k in combined_timing for k in ['1 year', '1-year', '1 yr', '12 month', 'scoping', 'probe', 'probing', 'q1 2027', 'q2 2027', 'q3 2027', 'q4 2027', 'mid-2027', 'early 2027', 'late 2027', '2027']):
                    fitout_window = '1 Year'
                # 3. 2 Years: 12-24 months out, 2027/2028 renewals to monitor next expiry, 2-year horizon
                elif any(k in combined_timing for k in ['2 year', '2-year', '2 yr', '24 month', 'relationship', 'monitor for next expiry', 'next expiry cycle', 'expiry-pattern', 'renewal signed', 'renewed', 'renewal']):
                    fitout_window = '2 Years'
                elif days_ago <= 60 or urgency == 'Immediate':
                    fitout_window = '0–60 Days'
                elif days_ago <= 120 or urgency == 'Near-Term' or 'q4 2026' in combined_timing:
                    fitout_window = '0–60 Days'
                elif 'pre-' in deal_type.lower():
                    fitout_window = '3 Years & Above'
                else:
                    fitout_window = '0–60 Days'

                # Heat Score
                heat_score, heat_breakdown = compute_heat_score(days_ago, sqft, deal_type, tracker_status)

                # Opening Sales Script (customized with fitout_window context)
                opening_script = generate_opening_script(comp, city, bldg, deal_type, area_fmt, sig, fitout_window)

                if bldg:
                    building_cluster_counts[bldg] = building_cluster_counts.get(bldg, 0) + 1

                lead_record = {
                    'id': lead_id,
                    'country': country_name,
                    'countryCode': meta['code'],
                    'flag': meta['flag'],
                    'currency': meta['currency'],
                    'currencySymbol': meta['symbol'],
                    'company': comp,
                    'market': mkt,
                    'city': city,
                    'submarket': submarket if submarket else city,
                    'building': bldg,
                    'isBuildingDisclosed': has_bldg,
                    'isBuildingInferred': bldg_inferred,
                    'areaSqFt': sqft,
                    'areaFormatted': area_fmt,
                    'sizeTier': size_tier,
                    'isSizeDisclosed': has_size,
                    'isSizeInferred': size_inferred,
                    'dealType': deal_type,
                    'isTypeDisclosed': has_type,
                    'isTypeInferred': type_inferred,
                    'dealDate': deal_date,
                    'dealQuarter': deal_quarter,
                    'dateFound': date_found,
                    'daysAgo': days_ago,
                    'signal': sig,
                    'timing': timing if timing else 'Active commercial opportunity',
                    'urgency': urgency,
                    'fitoutWindow': fitout_window,
                    'sector': sector,
                    'source': src,
                    'sourceUrl': url_link,
                    'dealValue': deal_val,
                    'trackerStatus': tracker_status,
                    'trackerTrend': tracker_trend,
                    'trackerNotes': tracker_notes,
                    'heatScore': heat_score,
                    'heatScoreBreakdown': heat_breakdown,
                    'suggestedOpeningLine': opening_script
                }
                all_leads.append(lead_record)
                lead_id += 1

    # Tag building clusters (buildings with 2+ tenants)
    cluster_buildings = {k for k, v in building_cluster_counts.items() if v >= 2}
    print(f"Identified {len(cluster_buildings)} multi-tenant building clusters with >=2 companies!")
    for lead in all_leads:
        lead['isMultiTenantHub'] = lead['building'] in cluster_buildings
        lead['buildingTenantCount'] = building_cluster_counts.get(lead['building'], 1) if lead['building'] else 0

    # Sort leads by default: Highest Heat Score first
    all_leads.sort(key=lambda x: -x['heatScore'])

    # Compute high-level database metrics & coverage rates
    total_leads = len(all_leads)
    unique_companies = len(set(f"{l['company']}___{l['country']}" for l in all_leads))
    disclosed_sizes = [l['areaSqFt'] for l in all_leads if l['areaSqFt'] is not None]
    total_disclosed_sqft = sum(disclosed_sizes)
    building_disclosure_rate = sum(1 for l in all_leads if l['isBuildingDisclosed']) / total_leads * 100
    size_disclosure_rate = len(disclosed_sizes) / total_leads * 100
    type_disclosure_rate = sum(1 for l in all_leads if l['dealType'] != 'Unstated') / total_leads * 100

    database_metrics = {
        'totalDeals': total_leads,
        'uniqueCompanies': unique_companies,
        'totalDisclosedSqFt': total_disclosed_sqft,
        'totalDisclosedSqFtFormatted': f"{total_disclosed_sqft / 1000000:.1f}M sq ft",
        'buildingDisclosureRate': round(building_disclosure_rate, 1),
        'sizeDisclosureRate': round(size_disclosure_rate, 1),
        'typeDisclosureRate': round(type_disclosure_rate, 1),
        'multiTenantHubsCount': len(cluster_buildings),
        'zeroToSixtyCount': sum(1 for l in all_leads if l['fitoutWindow'] == '0–60 Days'),
        'oneYearCount': sum(1 for l in all_leads if l['fitoutWindow'] == '1 Year'),
        'twoYearsCount': sum(1 for l in all_leads if l['fitoutWindow'] == '2 Years'),
        'threeYearsAboveCount': sum(1 for l in all_leads if l['fitoutWindow'] == '3 Years & Above'),
        'disclaimerNotice': 'Disclosed sizes only — partial total. Never implies unstated leases are zero.',
        'knownBoundaries': {
            'japanMalaysiaRenewals': '0 renewals recorded in Japan & Malaysia datasets (relocation focus).',
            'chinaRenewals': 'China renewals reflect historical Q3 2022 – Q4 2024 benchmarks; relocations reflect 2025–2026 deals.',
            'indiaLeases': 'India deals feature high transaction coverage via ANAROCK and corporate registrations.'
        }
    }

    print(f"Total deals compiled: {total_leads}")
    print(f"Unique tracked accounts: {unique_companies}")
    print(f"Disclosed footprint: {database_metrics['totalDisclosedSqFtFormatted']}")
    print(f"Building disclosure: {database_metrics['buildingDisclosureRate']}%")
    print(f"Size disclosure: {database_metrics['sizeDisclosureRate']}%")

    # Output to data.js
    timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    data_js_path = 'data.js'
    sheet_id = '1DojjV8QQH2Xbd6mpETIrqhmGSbRqlOxpKZbQsA5dQB0'
    markets = sorted(list(set(l['country'] for l in all_leads)))

    sheet_config = {
        'sheetId': sheet_id,
        'markets': markets,
        'lastBuilt': timestamp,
        'metrics': database_metrics
    }

    with open(data_js_path, 'w', encoding='utf-8') as f:
        f.write(f"// Lease-IQ Master Data Engine - Built {timestamp}\n")
        f.write(f"// Auto-compiled from 9 Google Sheet / CSV source feeds\n\n")
        f.write(f"var GOOGLE_SHEET_CONFIG = {json.dumps(sheet_config, indent=2)};\n")
        f.write(f"if (typeof window !== 'undefined') window.GOOGLE_SHEET_CONFIG = GOOGLE_SHEET_CONFIG;\n\n")
        f.write(f"var INITIAL_METRICS = {json.dumps(database_metrics, indent=2)};\n")
        f.write(f"if (typeof window !== 'undefined') window.INITIAL_METRICS = INITIAL_METRICS;\n\n")
        f.write(f"var INITIAL_LEADS_DATA = {json.dumps(all_leads, indent=2)};\n")
        f.write(f"if (typeof window !== 'undefined') window.INITIAL_LEADS_DATA = INITIAL_LEADS_DATA;\n\n")
        f.write(f"var INITIAL_TRACKER_DATA = {json.dumps(tracker_records, indent=2)};\n")
        f.write(f"if (typeof window !== 'undefined') window.INITIAL_TRACKER_DATA = INITIAL_TRACKER_DATA;\n\n")
        f.write(f"var INITIAL_SNAPSHOTS_DATA = {json.dumps(snapshots_records, indent=2)};\n")
        f.write(f"if (typeof window !== 'undefined') window.INITIAL_SNAPSHOTS_DATA = INITIAL_SNAPSHOTS_DATA;\n\n")
        f.write(f"var INITIAL_SOURCES_DATA = {json.dumps(sources_records, indent=2)};\n")
        f.write(f"if (typeof window !== 'undefined') window.INITIAL_SOURCES_DATA = INITIAL_SOURCES_DATA;\n")

    print(f"Successfully generated {data_js_path} ({os.path.getsize(data_js_path)} bytes)")

    return {
        'leads': all_leads,
        'tracker': tracker_records,
        'snapshots': snapshots_records,
        'sources': sources_records,
        'metrics': database_metrics,
        'markets': markets,
        'lastSynced': timestamp,
        'sheetId': sheet_id
    }

if __name__ == '__main__':
    build_all()
