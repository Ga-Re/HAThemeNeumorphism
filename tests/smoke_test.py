#!/usr/bin/env python3
"""Rauchtest: startet Home Assistant mit der Integration und prüft das Theme im Browser.

Läuft auf GitHub bei jeder Änderung und jede Woche mit der neuesten Version von Home
Assistant, damit auffällt, wenn ein Update etwas kaputt macht. Lokal:

  pip install homeassistant playwright && playwright install chromium
  python tests/smoke_test.py          # Port 8123, sonst SMOKE_PORT=8125 setzen

Bilder landen in tests/output/. Rückgabewert 1, wenn eine Prüfung fehlschlägt.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "tests" / "output"
PORT = int(os.environ.get("SMOKE_PORT", "8123"))
BASE = f"http://127.0.0.1:{PORT}"
CLIENT_ID = f"{BASE}/"
USER, PASSWORD = "smoke", "smoke-test-1234"

CONFIG = f"""
homeassistant:
  name: Smoke
  time_zone: Europe/Berlin
  country: DE
  language: de
  unit_system: metric
  latitude: 52.5
  longitude: 13.4
  elevation: 0
{f"http:{chr(10)}  server_port: {PORT}" if PORT != 8123 else ""}
frontend:
config:
onboarding:
auth:
person:
sun:
demo:
logger:
  default: warning
"""

# Hilfsfunktionen im Browser: Elemente auch in Shadow DOMs finden
FIND = """
window.findDeep = (sel) => { const st = [document]; while (st.length) { const n = st.pop(); const f = n.querySelector(sel);
  if (f) return f; for (const e of n.querySelectorAll('*')) if (e.shadowRoot) st.push(e.shadowRoot); } return null; };
window.findAllDeep = (sel) => { const out = []; const st = [document]; while (st.length) { const n = st.pop();
  out.push(...n.querySelectorAll(sel)); for (const e of n.querySelectorAll('*')) if (e.shadowRoot) st.push(e.shadowRoot); } return out; };
"""

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"{'OK  ' if ok else 'FAIL'} {name}{f' ({detail})' if detail else ''}", flush=True)
    if not ok:
        failures.append(name)


def request(path: str, data: dict | None = None, token: str | None = None, form: bool = False) -> dict:
    body = None
    headers = {}
    if data is not None:
        if form:
            body = urllib.parse.urlencode(data).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            body = json.dumps(data).encode()
            headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(BASE + path, data=body, headers=headers, method="POST" if data is not None else "GET")
    with urllib.request.urlopen(req, timeout=60) as resp:
        text = resp.read().decode()
    return json.loads(text) if text else {}


def wait_for_server(proc: subprocess.Popen, timeout: float = 600) -> None:
    start = time.time()
    while time.time() - start < timeout:
        if proc.poll() is not None:
            raise RuntimeError("Home Assistant wurde beendet")
        try:
            urllib.request.urlopen(f"{BASE}/manifest.json", timeout=5)
            return
        except (urllib.error.URLError, ConnectionError, TimeoutError):
            time.sleep(3)
    raise RuntimeError("Home Assistant startet nicht")


def onboard() -> str:
    """Benutzer anlegen, Einrichtung abschließen, Integration hinzufügen. Gibt einen Zugriffsschlüssel zurück."""
    code = request("/api/onboarding/users", {"client_id": CLIENT_ID, "name": "Smoke", "username": USER, "password": PASSWORD, "language": "de"})["auth_code"]
    token = request("/auth/token", {"grant_type": "authorization_code", "code": code, "client_id": CLIENT_ID}, form=True)["access_token"]
    for step, data in (("core_config", {}), ("analytics", {}), ("integration", {"client_id": CLIENT_ID, "redirect_uri": f"{BASE}/?auth_callback=1"})):
        try:
            request(f"/api/onboarding/{step}", data, token)
        except urllib.error.HTTPError as err:
            print(f"Hinweis: Einrichtungsschritt {step}: {err.code}")
    flow = request("/api/config/config_entries/flow", {"handler": "neumorphism"}, token)
    result = request(f"/api/config/config_entries/flow/{flow['flow_id']}", {}, token)
    check("Integration eingerichtet", result.get("type") == "create_entry", result.get("type", ""))
    return token


def browser_checks() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)
        page = browser.new_page(viewport={"width": 1280, "height": 900}, locale="de-DE")
        page.add_init_script(FIND)
        problems: list[str] = []
        page.on("pageerror", lambda err: problems.append(f"Seitenfehler: {err}"))
        page.on("console", lambda msg: problems.append(msg.text) if "Neumorphism:" in msg.text else None)

        page.goto(BASE + "/")
        page.wait_for_selector("input[name=username]", timeout=60000)
        page.fill("input[name=username]", USER)
        page.fill("input[name=password]", PASSWORD)
        page.keyboard.press("Enter")
        page.wait_for_url(re.compile(r"/(home|lovelace)"), timeout=60000)
        page.wait_for_timeout(3000)
        dashboard = urllib.parse.urlparse(page.url).path  # Start-Dashboard (je nach Version /home oder /lovelace)

        def go(path: str, wait: int = 3500) -> None:
            page.evaluate("(p) => { history.pushState(null, '', p); window.dispatchEvent(new CustomEvent('location-changed')); }", path)
            page.wait_for_timeout(wait)

        check("Skript geladen", page.evaluate("() => !!customElements.get('neumorphism-color-picker')"))
        for dark in (False, True):
            mode = "dunkel" if dark else "hell"
            page.evaluate(
                "(dark) => document.querySelector('home-assistant').dispatchEvent(new CustomEvent('settheme', { detail: { theme: 'Neumorphism', dark } }))",
                dark,
            )
            page.wait_for_timeout(2000)
            go(dashboard)
            check(f"Theme aktiv ({mode})", page.evaluate("() => getComputedStyle(document.documentElement).getPropertyValue('--neumorphism-inset-shadow').trim() !== ''"))
            check(f"Dunkelmodus folgt ({mode})", page.evaluate("() => document.querySelector('home-assistant').hass.themes.darkMode") == dark)
            check(
                f"Bausteine geformt ({mode})",
                page.evaluate(
                    "() => findAllDeep('ha-card').some((c) => c.shadowRoot && [...c.shadowRoot.adoptedStyleSheets].some((s) => [...s.cssRules].some((r) => r.cssText.includes('neumorphism'))))"
                ),
            )
            check(f"Tropfenformen in der Titelleiste ({mode})", page.evaluate("() => findAllDeep('.neumorphism-droplet').length") > 0)
            page.screenshot(path=str(OUTPUT / f"dashboard-{mode}.png"))
            go("/profile")
            check(
                f"Einstellungen im Profil ({mode})",
                page.evaluate("() => { const p = findDeep('neumorphism-color-picker'); return !!p && p.shadowRoot.querySelectorAll('.setting').length > 10; }"),
            )
            page.screenshot(path=str(OUTPUT / f"profil-{mode}.png"), full_page=True)
            go("/config/integrations/dashboard")
            page.screenshot(path=str(OUTPUT / f"einstellungen-{mode}.png"))

        # Eine Einstellung ändern und prüfen, dass sie wirkt
        page.evaluate("() => document.querySelector('home-assistant').dispatchEvent(new CustomEvent('settheme', { detail: { dark: false, neumorphismTint: 'mint', neumorphismStrength: -1 } }))")
        page.wait_for_timeout(2000)
        check("Einstellung wirkt (Hintergrund Mint)", page.evaluate("() => getComputedStyle(document.documentElement).getPropertyValue('--primary-background-color').trim()") != "#e4e8ef")
        check("Einstellung wirkt (Effektstärke)", page.evaluate("() => getComputedStyle(document.documentElement).getPropertyValue('--neumorphism-strength').trim()") == "-1")

        check("Keine Fehler im Browser", not problems, "; ".join(problems[:5]))
        browser.close()


def main() -> int:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    config = Path(tempfile.mkdtemp(prefix="neumorphism-smoke-"))
    (config / "configuration.yaml").write_text(CONFIG, encoding="utf-8")
    shutil.copytree(ROOT / "custom_components" / "neumorphism", config / "custom_components" / "neumorphism")
    log = open(OUTPUT / "konsole.log", "w")
    hass = os.environ.get("HASS_BIN", "hass")
    proc = subprocess.Popen([hass, "-c", str(config)], stdout=log, stderr=subprocess.STDOUT)
    try:
        wait_for_server(proc)
        onboard()
        browser_checks()
    except Exception as err:  # noqa: BLE001 - jeder Fehler ist ein fehlgeschlagener Test
        check("Ablauf", False, repr(err))
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=60)
        except subprocess.TimeoutExpired:
            proc.kill()
        log.close()
        log_path = config / "home-assistant.log"
        if log_path.exists():
            shutil.copy(log_path, OUTPUT / "home-assistant.log")
            errors = [line for line in log_path.read_text(errors="replace").splitlines() if "neumorphism" in line.lower() and ("ERROR" in line or "Traceback" in line)]
            check("Keine Fehler der Integration im Log", not errors, " | ".join(errors[:3]))
    print("Fehlgeschlagen: " + ", ".join(failures) if failures else "Alle Prüfungen bestanden")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
