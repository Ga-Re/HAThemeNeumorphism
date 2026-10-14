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
recorder:
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
    # Beim ersten Start lädt Home Assistant noch Pakete nach: warten, bis es ganz läuft
    start = time.time()
    while (config := request("/api/config", token=token)).get("state") != "RUNNING":
        if time.time() - start > 900:
            raise RuntimeError("Home Assistant läuft nicht vollständig an")
        time.sleep(5)
    print(f"Home Assistant {config.get('version')} läuft", flush=True)
    if config.get("recovery_mode"):
        raise RuntimeError("Home Assistant ist im Wiederherstellungsmodus (siehe Log), eigene Integrationen sind aus")
    flow = request("/api/config/config_entries/flow", {"handler": "neumorphism"}, token)
    result = request(f"/api/config/config_entries/flow/{flow['flow_id']}", {}, token)
    check("Integration eingerichtet", result.get("type") == "create_entry", result.get("type", ""))
    return token


# Lage aller absolut oder fest positionierten Bausteine (z. B. Reiterleiste unten am Handy), durch alle
# Shadow-DOMs hindurch. Das Theme darf Flächen formen, aber nichts an eine andere Stelle schieben.
LAYOUT_SIGNATURE = """() => {
  const out = {};
  for (const el of findAllDeep('*')) {
    const cs = getComputedStyle(el);
    if (!['absolute', 'fixed', 'sticky'].includes(cs.position) || el.closest('svg, ha-ripple')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 16 || r.bottom < 0 || r.top > innerHeight) continue;
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';
    const key = `${el.getRootNode().host?.localName || 'doc'}>${el.localName}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''}`;
    if (!out[key]) out[key] = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
  }
  return out;
}"""
# Nicht das Profil: dort schieben die Einstellungen des Themes den Inhalt darunter gewollt nach unten
LAYOUT_PAGES = ["/config/integrations/dashboard", "/config/automation/dashboard", "/config/dashboard", "/developer-tools/state", "/history"]


def browser_checks() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)
        page = browser.new_page(viewport={"width": 1280, "height": 900}, locale="de-DE")
        page.add_init_script(FIND)
        problems: list[str] = []
        page.on("pageerror", lambda err: problems.append(f"Seitenfehler: {err}"))
        page.on("console", lambda msg: problems.append(msg.text) if "Neumorphism:" in msg.text else None)
        # Was mit dem Skript passiert (für die Fehlersuche, falls es nicht lädt)
        started = time.monotonic()
        module_log: list[str] = []

        def note(text: str) -> None:
            module_log.append(f"{time.monotonic() - started:6.1f}s {text}")

        page.on("request", lambda r: note(f"Anfrage {r.url[-60:]}") if "neumorphism-colors" in r.url else None)
        page.on("requestfinished", lambda r: note(f"geladen {r.response().status if r.response() else '?'}") if "neumorphism-colors" in r.url else None)
        page.on("requestfailed", lambda r: note(f"fehlgeschlagen {r.failure}") if "neumorphism-colors" in r.url else None)
        page.on("console", lambda msg: note(f"Konsole: {msg.text[:200]}") if msg.type == "error" else None)
        page.on("framenavigated", lambda frame: note(f"Seite {frame.url[-60:]}") if frame == page.main_frame else None)

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

        try:
            page.wait_for_function("() => !!customElements.get('neumorphism-color-picker')", timeout=60000)
            check("Skript geladen", True)
        except Exception as err:  # noqa: BLE001
            check("Skript geladen", False, repr(err)[:200])
            listed = page.evaluate("() => [...document.scripts].some((s) => s.textContent.includes('neumorphism-colors'))")
            print(f"     Skript in der Startseite eingetragen: {listed}")
            state = page.evaluate("() => [!!customElements.get('neumorphism-color-picker'), document.visibilityState]")
            print(f"     Jetzt definiert, Sichtbarkeit: {state}")
            for line in module_log[-25:]:
                print(f"     {line}")
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
            check(
                f"Knöpfe der Titelleiste auf einer Kapsel ({mode})",
                page.evaluate("() => findAllDeep('.action-items').some((el) => getComputedStyle(el, '::before').boxShadow !== 'none')"),
            )
            page.screenshot(path=str(OUTPUT / f"dashboard-{mode}.png"))
            go("/profile")
            check(
                f"Einstellungen im Profil ({mode})",
                page.evaluate("() => { const p = findDeep('neumorphism-color-picker'); return !!p && p.shadowRoot.querySelectorAll('.setting').length > 10; }"),
            )
            page.screenshot(path=str(OUTPUT / f"profil-{mode}.png"), full_page=True)
            go("/config/integrations/dashboard")
            check(
                f"Reiter in einer Spur, der gewählte als Pille ({mode})",
                page.evaluate(
                    "() => { const pill = findDeep('.nm-tab-pill'); return !!findDeep('.nm-tab-track') && !!pill && pill.getBoundingClientRect().width > 40; }"
                ),
            )
            page.screenshot(path=str(OUTPUT / f"einstellungen-{mode}.png"))

        # Aufbau wie im Standard-Theme, am Handy und am großen Bildschirm
        for width, height, label in ((390, 844, "schmal"), (1280, 900, "breit")):
            page.set_viewport_size({"width": width, "height": height})
            def compare(path: str) -> dict[str, str]:
                found = {}
                for theme in ("default", "Neumorphism"):
                    page.evaluate(
                        "(theme) => document.querySelector('home-assistant').dispatchEvent(new CustomEvent('settheme', { detail: { theme, dark: false } }))",
                        theme,
                    )
                    page.wait_for_timeout(800)
                    go(path)
                    found[theme] = page.evaluate(LAYOUT_SIGNATURE)
                out = {}
                for key, a in found["default"].items():
                    b = found["Neumorphism"].get(key)
                    if b and any(abs(x - y) > 30 for x, y in zip(a, b)):
                        out[key] = f"{path} {key} {a} -> {b}"
                return out

            moved: list[str] = []
            for path in [dashboard, *LAYOUT_PAGES]:
                first = compare(path)
                # Nur, was sich beim zweiten Messen wiederholt (nicht z. B. ein Hinweis, der gerade erscheint)
                second = compare(path) if first else {}
                moved += [text for key, text in second.items() if key in first]
            check(f"Aufbau wie im Standard-Theme ({label})", not moved, "; ".join(moved[:4]))
            page.screenshot(path=str(OUTPUT / f"aufbau-{label}.png"))
        page.set_viewport_size({"width": 1280, "height": 900})

        # Eine Einstellung ändern und prüfen, dass sie wirkt
        page.evaluate("() => document.querySelector('home-assistant').dispatchEvent(new CustomEvent('settheme', { detail: { dark: false, neumorphismTint: 'mint', neumorphismStrength: -1 } }))")
        page.wait_for_timeout(2000)
        check("Einstellung wirkt (Hintergrund Mint)", page.evaluate("() => getComputedStyle(document.documentElement).getPropertyValue('--primary-background-color').trim()") != "#e4e8ef")
        check("Einstellung wirkt (Effektstärke)", page.evaluate("() => getComputedStyle(document.documentElement).getPropertyValue('--neumorphism-strength').trim()") == "-1")

        # Home Assistant tauscht beim Start die Registry der Bausteine aus. Lädt es langsamer als dieses
        # Skript, müssen dessen Bausteine trotzdem in der neuen Registry landen (sonst "Configuration error").
        app_js = re.compile(r"/frontend_latest/app\.[0-9a-f]+\.js")
        page.route(app_js, lambda route: (time.sleep(2.5), route.continue_()))
        page.reload()
        page.wait_for_timeout(8000)
        page.unroute(app_js)
        check(
            "Bausteine registriert, auch wenn Home Assistant später lädt",
            page.evaluate("() => !!customElements.get('neumorphism-color-card') && !!customElements.get('neumorphism-color-picker')"),
        )

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
            lines = log_path.read_text(errors="replace").splitlines()
            errors = [line for line in lines if "neumorphism" in line.lower() and ("ERROR" in line or "Traceback" in line)]
            check("Keine Fehler der Integration im Log", not errors, " | ".join(errors[:3]))
            if failures:
                # Zur Fehlersuche: Fehler und Warnungen aus dem Log von Home Assistant
                print("--- Log von Home Assistant (Fehler, Warnungen, Neumorphism) ---")
                for line in [l for l in lines if any(k in l for k in ("ERROR", "CRITICAL", "WARNING", "neumorphism", "recovery"))][:80]:
                    print(line[:300])
    print("Fehlgeschlagen: " + ", ".join(failures) if failures else "Alle Prüfungen bestanden")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
