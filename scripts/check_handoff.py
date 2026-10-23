#!/usr/bin/env python3
"""
Handoff Mailbox Checker & Appender
Monitors the Google Doc between Angie (Muse) and Antigravity.
"""

import sys
import json
import urllib.request
import re
import os
import hashlib
from datetime import datetime

def get_config():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    config = {
        "docId": "1oepGc6e3EtN8cTfAeKbbg9FuN16davN9X9hMtShIRiE",
        "docUrl": "https://docs.google.com/document/d/1oepGc6e3EtN8cTfAeKbbg9FuN16davN9X9hMtShIRiE/edit",
        "exportUrl": "https://docs.google.com/document/d/1oepGc6e3EtN8cTfAeKbbg9FuN16davN9X9hMtShIRiE/export?format=txt",
        "webhookUrl": ""
    }
    for filename in ["handoff_config.local.json", "handoff_config.example.json"]:
        p = os.path.join(base_dir, filename)
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    config.update(data)
                    if config.get("webhookUrl") and config["webhookUrl"] != "PASTE_APPS_SCRIPT_WEBHOOK_URL_HERE":
                        break
            except Exception:
                pass
    if os.environ.get("HANDOFF_WEBHOOK_URL"):
        config["webhookUrl"] = os.environ["HANDOFF_WEBHOOK_URL"]
    return config

CONFIG = get_config()
EXPORT_URL = CONFIG.get("exportUrl")
WEBHOOK_URL = CONFIG.get("webhookUrl")

def read_handoff_doc():
    try:
        req = urllib.request.Request(EXPORT_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp:
            return resp.read().decode("utf-8")
    except Exception as e:
        print(f"Error fetching doc: {e}", file=sys.stderr)
        return None

STATE_FILE = os.path.join(os.path.dirname(__file__), "..", "handoff_state.json")

def get_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_state(state):
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        print(f"Error saving state: {e}", file=sys.stderr)

def mark_processed(entry):
    state = get_state()
    content_hash = hashlib.sha256((entry["header"] + "\n" + entry["body"]).encode("utf-8")).hexdigest()
    state["last_processed_header"] = entry["header"]
    state["last_processed_hash"] = content_hash
    state["last_processed_at"] = datetime.now().isoformat()
    save_state(state)

def check_for_new_entry(doc_text):
    if not doc_text:
        return None, "FAILED_TO_FETCH"
    
    # Split by entry headers: e.g. "ENTRY — Angie", "ENTRY — Antigravity", or "**Angie ...**"
    entries = re.split(r'((?:ENTRY\s*—\s*[A-Za-z\-]+|\*{2}Angie[^\n]*|\*{2}Antigravity[^\n]*)[^\n]*)', doc_text)
    if len(entries) < 2:
        return None, "NO_ENTRIES_FOUND"
    
    # Reconstruct headers with their bodies
    structured = []
    for i in range(1, len(entries), 2):
        header = entries[i].strip()
        body = entries[i+1].strip() if i+1 < len(entries) else ""
        structured.append({"header": header, "body": body})
    
    last = structured[-1]
    header_lower = last["header"].lower()
    state = get_state()
    current_hash = hashlib.sha256((last["header"] + "\n" + last["body"]).encode("utf-8")).hexdigest()

    if "angie" in header_lower:
        if state.get("last_processed_hash") == current_hash:
            return last, "UP_TO_DATE"
        
        # Check for pause/start protocol signals (strict: header or first line of body)
        is_paused = state.get("is_paused", False)
        first_line = last["body"].strip().split("\n")[0].upper() if last["body"].strip() else ""
        header_upper = last["header"].upper()
        
        if "PAUSE" in header_upper or first_line.startswith("PAUSE"):
            state["is_paused"] = True
            save_state(state)
            return last, "PAUSE_SIGNAL_FROM_ANGIE"
        elif any(k in header_upper for k in ["START", "RESTART", "RESUME"]) or any(first_line.startswith(k) for k in ["START", "RESTART", "RESUME", "LOOP RESUMES"]):
            state["is_paused"] = False
            save_state(state)
            return last, "START_SIGNAL_FROM_ANGIE"
        elif is_paused:
            return last, "PAUSED_AWAITING_START"
            
        return last, "NEW_ENTRY_FROM_ANGIE"
    elif "antigravity" in header_lower:
        return last, "UP_TO_DATE"
    
    return last, "UNKNOWN_AUTHOR"

def append_entry(text):
    if not WEBHOOK_URL:
        return False, "No webhookUrl configured in handoff_config.local.json or environment"
    data = text.encode("utf-8")
    req = urllib.request.Request(WEBHOOK_URL, data=data, headers={"Content-Type": "text/plain"})
    try:
        with urllib.request.urlopen(req) as resp:
            res_body = resp.read().decode("utf-8")
            if resp.status == 200:
                # Also save state
                lines = [l for l in text.strip().split("\n") if l.strip()]
                header = lines[0] if lines else "ENTRY — Antigravity"
                body = "\n".join(lines[1:]) if len(lines) > 1 else ""
                mark_processed({"header": header, "body": body})
            return resp.status == 200, res_body
    except Exception as e:
        return False, str(e)

if __name__ == "__main__":
    doc = read_handoff_doc()
    last_entry, status = check_for_new_entry(doc)
    print(f"Status: {status}")
    if status in ("NEW_ENTRY_FROM_ANGIE", "START_SIGNAL_FROM_ANGIE", "PAUSE_SIGNAL_FROM_ANGIE"):
        print("--- NEW ENTRY FROM ANGIE ---")
        print(last_entry["header"])
        print(last_entry["body"])
    elif status == "UP_TO_DATE":
        print(f"Doc is up to date (last entry: {last_entry['header'] if last_entry else 'None'}).")
    else:
        print(f"Details: {last_entry}")
