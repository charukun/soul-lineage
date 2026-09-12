"""Serve the real build and verify boot, save recovery and WebGL failure UI."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
import json, os

ROOT = Path(__file__).resolve().parents[3]
DIST = ROOT / 'dist/village'
REPORTS = ROOT / 'test-results/village'
assert (DIST / 'version.json').is_file(), 'Run npm run build:village first'
REPORTS.mkdir(parents=True, exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def log_message(self, *args): pass
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(DIST)))
Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/'
checks = []
def check(name, condition):
 assert condition, name
 checks.append(name)
 print('PASS', name, flush=True)
try:
 with sync_playwright() as pw:
  browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or None,
   args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
  context = browser.new_context(viewport={'width':412, 'height':915})
  p = context.new_page()
  p.set_default_timeout(60000)
  p.goto(url)
  p.wait_for_function('window.village && document.querySelector("#loading").hidden')
  check('built engine renders using pinned Three.js', p.locator('#game').get_attribute('data-engine') == 'three.js r186')
  check('build commit matches version.json', p.locator('#game').get_attribute('data-commit') == json.loads((DIST/'version.json').read_text())['commit'])
  p.evaluate('village.world.state.settings.speed=0; village.world.state.tutorial.dismissed=true; village.save()')
  p.reload()
  p.wait_for_function('window.village && document.querySelector("#loading").hidden')
  check('built localStorage survives reload', p.evaluate('village.world.state.tutorial.dismissed'))
  p.screenshot(path=str(REPORTS/'built-portrait.png'))
  if p.locator('#muraEnterVillage').is_visible(): p.locator('#muraEnterVillage').click()
  p.locator('#muraSettingsButton').click()
  p.locator('#onlineOpen').click()
  p.locator('#make-offer').wait_for()
  check('latest develop online host remains reachable', p.locator('#onlineDialog').is_visible() and p.locator('#answer').is_visible())
  p.wait_for_function('document.querySelector("#world-state").textContent.includes("village.foundation.v1")')
  check('online host clock runs inside the village menu', '参加 0人' in p.locator('#world-state').inner_text())
  p.locator('#onlineDialog form button').click()
  if p.locator('#muraEnterVillage').is_visible(): p.locator('#muraEnterVillage').click()
  p.locator('#muraSettingsButton').click()
  p.locator('#onlineOpen').click()
  check('reopening preserves one online host', p.locator('#online-panel').count() == 1)
  p.locator('#onlineDialog form button').click()
  key = p.evaluate('Object.keys(localStorage).find(k=>k.endsWith("living-v5"))')
  check('save is scoped to village', bool(key) and 'village' in key)
  # Leave the game first so its legitimate beforeunload save cannot overwrite
  # the corrupt fixture. The JSON page has the same storage origin, no game.
  p.goto(url + 'version.json')
  p.evaluate('(key)=>localStorage.setItem(key,"broken-save")', key)
  p.goto(url)
  p.wait_for_function('document.querySelector("#game").dataset.renderer === "error"')
  check('corrupt save stays intact and exposes recovery', p.evaluate('(key)=>localStorage.getItem(key)==="broken-save"',key) and p.locator('#recover').is_visible())
  p.on('dialog', lambda d: d.accept())
  p.locator('#recover').click()
  p.wait_for_function('window.village && document.querySelector("#loading").hidden')
  check('recovery backs up the original before a fresh village', p.evaluate('Object.keys(localStorage).some(k=>k.includes(".recovery.")&&localStorage.getItem(k)==="broken-save")') and p.evaluate('!village.world.state.tutorial.dismissed'))
  p.evaluate('village.view.renderer.getContext().getExtension("WEBGL_lose_context").loseContext()')
  p.wait_for_function('document.querySelector("#game").dataset.renderer === "error"')
  check('real context loss shows retry', p.locator('#retry').is_visible() and not p.locator('#loading').is_hidden())
  browser.close()
finally:
 server.shutdown()
 (REPORTS/'built-browser-results.json').write_text(json.dumps({'url':url,'passed':checks},ensure_ascii=False,indent=2))
