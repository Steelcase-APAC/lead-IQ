#!/usr/bin/env python3
"""
Lead-IQ Version Cadence & Domain Push Engine
Automatically increments the version cadence (+0.01) and deploys to domain (GitHub Pages).

Usage:
  python3 push_domain.py                 # Cadence release: increments version (+0.01), rebuilds, commits & pushes to domain
  python3 push_domain.py --no-bump       # Rebuilds and pushes current version without incrementing
  python3 push_domain.py --step 0.01     # Set custom increment step
  python3 push_domain.py --set 2.21      # Set an explicit version
  python3 push_domain.py --dry-run       # Test build and version bump without git operations
  python3 push_domain.py -m "Your note"  # Custom commit message
"""

import os
import sys
import json
import re
import argparse
import subprocess
import datetime
from decimal import Decimal

VERSION_FILE = 'version.json'
INDEX_HTML = 'index.html'

def load_version_info():
    if not os.path.exists(VERSION_FILE):
        return {'version': '2.21', 'step': 0.01}
    try:
        with open(VERSION_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {'version': '2.21', 'step': 0.01}

def save_version_info(data):
    with open(VERSION_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
        f.write('\n')

def bump_version_string(current_ver_str, step=0.01):
    current = Decimal(str(current_ver_str))
    step_dec = Decimal(str(step))
    new_ver = current + step_dec
    step_str = str(step)
    precision = len(step_str.split('.')[1]) if '.' in step_str else 2
    return f"{new_ver:.{precision}f}"

def update_index_html_version(ver_str):
    if not os.path.exists(INDEX_HTML):
        return
    with open(INDEX_HTML, 'r', encoding='utf-8') as f:
        content = f.read()

    new_badge = f'<span class="brand-version-badge" id="appVersionBadge">v{ver_str}</span>'
    pattern = r'<span class="brand-version-badge"[^>]*>.*?</span>'

    if re.search(pattern, content):
        content = re.sub(pattern, new_badge, content)
    else:
        content = re.sub(
            r'(<h1 class="brand-title">Lease-IQ)(\s*</h1>)',
            rf'\1 {new_badge}\2',
            content
        )

    with open(INDEX_HTML, 'w', encoding='utf-8') as f:
        f.write(content)

def run_cmd(cmd, check=True):
    print(f"--> {cmd}")
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if res.stdout:
        print(res.stdout.strip())
    if res.stderr and res.returncode != 0:
        print(f"Error: {res.stderr.strip()}", file=sys.stderr)
    if check and res.returncode != 0:
        sys.exit(res.returncode)
    return res

def main():
    parser = argparse.ArgumentParser(description="Lead-IQ Version Cadence & Domain Push Engine")
    parser.add_argument('--no-bump', action='store_true', help="Do not bump version; deploy current version")
    parser.add_argument('--step', type=float, default=None, help="Cadence step increment (default 0.01)")
    parser.add_argument('--set', dest='set_version', type=str, default=None, help="Set explicit version")
    parser.add_argument('--message', '-m', type=str, default=None, help="Custom commit message")
    parser.add_argument('--dry-run', action='store_true', help="Simulate without git push")
    args = parser.parse_args()

    v_data = load_version_info()
    old_version = str(v_data.get('version', '2.21'))
    step = args.step if args.step is not None else float(v_data.get('step', 0.01))

    if args.set_version:
        new_version = args.set_version
    elif args.no_bump:
        new_version = old_version
    else:
        new_version = bump_version_string(old_version, step)

    print("=" * 60)
    print("      LEAD-IQ CADENCE RELEASE & DOMAIN PUSH ENGINE")
    print(f"      Previous Version : v{old_version}")
    print(f"      Target Version   : v{new_version} (+{step} cadence)")
    print("=" * 60)

    # 1. Update version.json
    v_data['version'] = new_version
    v_data['step'] = step
    v_data['lastPushedAt'] = datetime.datetime.now().isoformat()
    save_version_info(v_data)

    # 2. Update index.html badge
    update_index_html_version(new_version)

    # 3. Rebuild data.js and run full regression suite
    print("\n[1/4] Running build_data.py regression suite...")
    build_res = subprocess.run([sys.executable, 'build_data.py'], capture_output=True, text=True)
    if build_res.stdout:
        print(build_res.stdout.strip())
    if build_res.returncode != 0:
        if build_res.stderr:
            print(f"Build Error: {build_res.stderr.strip()}", file=sys.stderr)
        print("Build failed! Aborting release.", file=sys.stderr)
        sys.exit(build_res.returncode)

    if args.dry_run:
        print("\n[Dry run] Completed build and version bump without git operations.")
        return

    # 4. Check git status & commit
    print("\n[2/4] Staging and committing release artifacts...")
    current_branch_res = run_cmd("git rev-parse --abbrev-ref HEAD")
    current_branch = current_branch_res.stdout.strip()

    run_cmd("git add .")
    commit_msg = args.message or f"chore(release): bump version to v{new_version} and deploy to domain"

    status_res = subprocess.run("git status --porcelain", shell=True, capture_output=True, text=True)
    if status_res.stdout.strip():
        run_cmd(f'git commit -m "{commit_msg}"')
    else:
        print("Working tree clean, no new commit needed.")

    # 5. Fast-forward mirrored release branches
    print("\n[3/4] Fast-forwarding release branches (main, V2, v2.2)...")
    for br in ['main', 'V2', 'v2.2']:
        res = subprocess.run(f"git rev-parse --verify {br}", shell=True, capture_output=True, text=True)
        if res.returncode == 0 and br != current_branch:
            run_cmd(f"git checkout {br} && git merge {current_branch} --ff-only")
    run_cmd(f"git checkout {current_branch}")

    # 6. Push to remote origin
    print("\n[4/4] Pushing to remote domain (GitHub Pages)...")
    run_cmd(f"git push origin {current_branch}")
    for br in ['main', 'V2', 'v2.2']:
        res = subprocess.run(f"git rev-parse --verify {br}", shell=True, capture_output=True, text=True)
        if res.returncode == 0 and br != current_branch:
            run_cmd(f"git push origin {br}")

    print("\n" + "=" * 60)
    print(f"SUCCESS: Lead-IQ v{new_version} deployed to domain!")
    print(f"Live Deployment URL: https://steelcase-apac.github.io/lead-IQ/")
    print("=" * 60)

if __name__ == '__main__':
    main()
