#!/usr/bin/env python3
"""
Lease-IQ Google Sheet GID Sync Engine
Unconditionally downloads all live Google Sheet tabs by explicit numeric GID,
bypassing any gviz/tq caching to guarantee exact cell state.
"""

import urllib.request
import os
import sys

SHEET_ID = '1DojjV8QQH2Xbd6mpETIrqhmGSbRqlOxpKZbQsA5dQB0'

# Exact Tab Names and Numeric GIDs from live htmlview
TAB_GIDS = {
    'data/india.csv': '6578112',
    'data/sri_lanka.csv': '491101535',
    'data/malaysia.csv': '1410399683',
    'data/korea.csv': '107222265',
    'data/japan.csv': '192656001',
    'data/china.csv': '584186119',
    'data/sources.csv': '1944959203',
    'data/company_tracker.csv': '263587632',
    'data/snapshots.csv': '1620946556',
    'data/source_sweep.csv': '1878138180',
    'data/watchlist.csv': '1464911679',
}

def sync_all():
    print(f"--> Syncing {len(TAB_GIDS)} tabs directly from Google Sheet GIDs...")
    os.makedirs('data', exist_ok=True)
    success_count = 0
    for path, gid in TAB_GIDS.items():
        url = f'https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={gid}'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                content = resp.read().decode('utf-8')
                with open(path, 'w', encoding='utf-8') as fp:
                    fp.write(content)
                print(f"  ✓ Synced {path} ({len(content):,} bytes)")
                success_count += 1
        except Exception as e:
            print(f"  ✗ Failed to sync {path} (gid {gid}): {e}", file=sys.stderr)
            return False
    print(f"--> Successfully synchronized all {success_count}/{len(TAB_GIDS)} tabs.\n")
    return True

if __name__ == '__main__':
    ok = sync_all()
    sys.exit(0 if ok else 1)
