#!/usr/bin/env python3
"""
Assist Script: Propose Confidence Tiers for Angie's Editorial Review
Generates a reference CSV for the 564 commercial deal rows in Google Sheet.
Angie holds sole Sheet write authority; this output is reference only.

Tiers:
- Verified CRE Intel: named deal evidenced by CRE broker report / regulatory filing / lease deed.
- High-Intent Signal: strong intent evidence (pre-commitment, tender, HQ announcement) without executed deed.
- Early Discovery: thin / early / unverified (single PR post, hiring signal, commentary).
"""

import csv
import glob
import os
import re

CRE_BROKERS = [
    'cbre', 'jll', 'savills', 'colliers', 'knight frank', 'cushman', 
    'cushman & wakefield', 'cushman and wakefield', 'propshare', 'square yards',
    'propstack', 'rera', 'registration deed', 'sub-registrar', 'regulatory filing',
    'lease deed', 'official cre'
]

HIGH_INTENT_SOURCES = [
    'mint', 'livemint', 'the edge', 'the edge malaysia', 'economic times',
    'business standard', 'financial express', 'nikkei', 'dealstreetasia',
    'hindu businessline', 'reuters', 'bloomberg', 'tech in asia', 'e27'
]

def classify_deal(row_id, comp, country, market, building, size, deal_type, fitout_window, signal, source, timing):
    sig_lower = signal.lower()
    src_lower = source.lower()
    timing_lower = timing.lower()
    type_lower = deal_type.lower()
    
    # 1. Check for Verified CRE Intel
    is_cre_source = any(b in src_lower for b in CRE_BROKERS)
    is_cre_signal = any(b in sig_lower for b in CRE_BROKERS) or 'registered lease' in sig_lower or 'lease deed' in sig_lower or 'sub-registrar' in sig_lower
    
    if is_cre_source or is_cre_signal:
        rationale = f"Evidenced by CRE advisory / official disclosure ({source})"
        return 'Verified CRE Intel', rationale
    
    # 2. Check for High-Intent Signal
    # Strong intent keywords: pre-commitment, tender, RFP, expanding HQ, acquiring campus, lease signed reported by major financial press
    is_high_intent_type = type_lower in ['pre-commitment', 'expansion', 'relocation', 'new lease']
    is_financial_press = any(p in src_lower for p in HIGH_INTENT_SOURCES)
    has_strong_keywords = any(k in sig_lower or k in timing_lower for k in [
        'pre-commit', 'pre commit', 'tender', 'rfp', 'consolidat', 'leases', 'leased', 'signed lease', 'taking up', 'secures', 'secured', 'anchor tenant'
    ])
    
    if (is_financial_press and has_strong_keywords) or type_lower == 'pre-commitment' or ('pre-commitment' in sig_lower):
        rationale = f"Strong transaction / expansion intent reported via financial press ({source})"
        return 'High-Intent Signal', rationale
    
    if is_financial_press:
        rationale = f"Corporate expansion / office footprint reporting via financial press ({source})"
        return 'High-Intent Signal', rationale
        
    # 3. Early Discovery
    # Thin / early / unverified signals (PR wire, hiring announcements, general commentary)
    rationale = f"Early signal / commentary ({source})"
    return 'Early Discovery', rationale

def generate_proposals():
    print("Generating proposed confidence tier classifications for 564 commercial deal rows...")
    out_file = 'data/proposed_confidence_backfill.csv'
    
    deal_rows = []
    
    country_files = [
        ('China', 'data/china.csv'),
        ('India', 'data/india.csv'),
        ('Japan', 'data/japan.csv'),
        ('Korea', 'data/korea.csv'),
        ('Malaysia', 'data/malaysia.csv'),
        ('Sri Lanka', 'data/sri_lanka.csv'),
    ]
    
    for country_name, file_path in country_files:
        if not os.path.exists(file_path):
            continue
        with open(file_path, 'r', encoding='utf-8') as f:
            rows = list(csv.reader(f))
            if not rows: continue
            header = [h.strip().lower() for h in rows[0]]
            
            for r in rows[1:]:
                if not r or not any(r) or not r[0].strip(): continue
                row_id = r[0].strip()
                comp = r[1].strip() if len(r)>1 else ''
                country = r[2].strip() if len(r)>2 and r[2].strip() else country_name
                mkt = r[3].strip() if len(r)>3 else ''
                bldg = r[4].strip() if len(r)>4 else ''
                size = r[5].strip() if len(r)>5 else ''
                deal_type = r[6].strip() if len(r)>6 else ''
                row_kind = r[8].strip() if len(r)>8 and r[8].strip() else 'Deal'
                fitout = r[9].strip() if len(r)>9 else ''
                signal = r[10].strip() if len(r)>10 else ''
                source = r[11].strip() if len(r)>11 else ''
                timing = r[13].strip() if len(r)>13 else ''
                
                # Exclude 8 non-deal rows
                if row_kind != 'Deal':
                    continue
                
                tier, rationale = classify_deal(row_id, comp, country, mkt, bldg, size, deal_type, fitout, signal, source, timing)
                
                deal_rows.append({
                    'row_id': row_id,
                    'company': comp,
                    'country': country,
                    'market': mkt,
                    'building': bldg,
                    'size': size,
                    'deal_type': deal_type,
                    'source': source,
                    'signal': signal,
                    'proposed_confidence': tier,
                    'rationale': rationale
                })
                
    assert len(deal_rows) == 564, f"Expected 564 commercial deal rows, got {len(deal_rows)}"
    
    # Save CSV
    with open(out_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['Row ID', 'Company', 'Country', 'Market', 'Building', 'Size', 'Deal Type', 'Source', 'Proposed Confidence', 'Rationale'])
        for d in deal_rows:
            writer.writerow([
                d['row_id'], d['company'], d['country'], d['market'], d['building'],
                d['size'], d['deal_type'], d['source'], d['proposed_confidence'], d['rationale']
            ])
            
    # Breakdown stats
    tier_counts = {}
    for d in deal_rows:
        t = d['proposed_confidence']
        tier_counts[t] = tier_counts.get(t, 0) + 1
        
    print(f"✓ Successfully generated {out_file} with {len(deal_rows)} rows:")
    for t, c in sorted(tier_counts.items(), key=lambda x: -x[1]):
        pct = (c / len(deal_rows)) * 100
        print(f"  - {t}: {c} deals ({pct:.1f}%)")
        
    return deal_rows

if __name__ == '__main__':
    generate_proposals()
