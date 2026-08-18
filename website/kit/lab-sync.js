/* Cross-device sync for the lab — Sean's verdicts follow him between phone and laptop.
 *
 * SELF-CONTAINED ON PURPOSE. lab.html is generated from Expo's template and overwritten
 * wholesale on every promotion, so anything this needs from that page would be destroyed
 * on the next build — that is how the Full page button, Adjust and Copy all were each
 * lost once already. So this file adds its own UI, reads and writes only localStorage's
 * 'brg-lab' key, and requires exactly one line in the template: a script tag, loaded
 * BEFORE the page's own script.
 *
 * Why a reload rather than live injection: the page reads localStorage once at parse time
 * and paints each card's verdict class as it builds the card. Writing state in mid-flight
 * would update the summary and leave every card showing no verdict — worse than a flash,
 * because it looks like the sync lost the data. Fetch, write, reload once, guarded.
 */
(function () {
  var LS = 'brg-lab', KEYLS = 'brg-lab-synckey', FLAG = 'brg-lab-synced', EP = '/api/lab-state';
  var key = localStorage.getItem(KEYLS) || '';

  function api(method, body) {
    return fetch(EP, {
      method: method,
      headers: { 'content-type': 'application/json', 'x-lab-key': key },
      body: body
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); });
  }

  /* Save is debounced and last-write-wins. Two devices editing the same second would
     have one overwrite the other — acceptable for one person moving between devices,
     and NOT acceptable if this is ever opened to a second reviewer. Say so out loud
     rather than discovering it as lost notes. */
  var timer = null, pending = false;
  function save() {
    if (!key) return;
    clearTimeout(timer);
    timer = setTimeout(function () {
      pending = true; status('saving…');
      api('PUT', localStorage.getItem(LS) || '{}').then(function (r) {
        pending = false;
        status(r.ok ? 'saved ' + when(r.j.savedAt) : 'save failed — ' + (r.j.error || 'try again'));
      }).catch(function () { pending = false; status('offline — kept on this device'); });
    }, 900);
  }

  function when(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  /* Any write to the lab's state triggers a save. Patching setItem rather than listening
     for events, because 'storage' fires in OTHER tabs, never the one that wrote. */
  var raw = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (k, v) { raw(k, v); if (k === LS) save(); };

  var bar, txt;
  function status(s) { if (txt) txt.textContent = s; }

  function ui() {
    bar = document.createElement('div');
    bar.id = 'labsync';
    bar.innerHTML =
      '<span class="ls-t"></span>' +
      '<button class="ls-b">' + (key ? 'Sync key' : 'Sync across devices') + '</button>';
    document.body.appendChild(bar);
    txt = bar.querySelector('.ls-t');
    bar.querySelector('.ls-b').onclick = setKey;
    var s = document.createElement('style');
    s.textContent = '#labsync{position:fixed;right:14px;bottom:14px;z-index:9999;display:flex;gap:9px;' +
      'align-items:center;background:rgba(16,15,13,.94);border:1px solid rgba(255,255,255,.14);' +
      'border-radius:999px;padding:7px 9px 7px 14px;backdrop-filter:blur(8px);' +
      "font:400 .72rem/1 'Helvetica Neue',Helvetica,Arial,sans-serif;color:rgba(244,241,234,.62)}" +
      '#labsync .ls-b{font:600 .66rem/1 inherit;letter-spacing:.05em;text-transform:uppercase;' +
      'background:transparent;color:#f4f1ea;border:1px solid rgba(255,255,255,.22);border-radius:999px;' +
      'padding:6px 11px;cursor:pointer}#labsync .ls-b:hover{border-color:#f4f1ea}';
    document.head.appendChild(s);
  }

  function setKey() {
    var v = prompt(
      'Sync key — type the SAME phrase on every device you review from.\n\n' +
      'This is not a password and there is no account: anyone who knows both this key and ' +
      'the lab URL can read and change your notes. Fine for design feedback, so pick ' +
      'something memorable rather than something secret. At least 8 characters.',
      key || ''
    );
    if (v === null) return;
    v = v.trim();
    if (v && v.length < 8) { alert('At least 8 characters, so it cannot be guessed by accident.'); return; }
    key = v;
    if (!key) {
      localStorage.removeItem(KEYLS); sessionStorage.removeItem(FLAG);
      status('sync off — this device only'); bar.querySelector('.ls-b').textContent = 'Sync across devices';
      return;
    }
    localStorage.setItem(KEYLS, key);
    sessionStorage.removeItem(FLAG);
    pull(true);
  }

  /* first: true = the user just set the key, so remote wins and we reload into it.
     On a normal page load, remote also wins — this device may be days behind — but only
     when the remote state is actually DIFFERENT, or every open would reload. */
  function pull(first) {
    if (!key) return;
    status('checking…');
    api('GET').then(function (r) {
      if (!r.ok) { status('sync error — ' + (r.j.error || 'check the key')); return; }
      var remote = r.j.state ? JSON.stringify(r.j.state) : null;
      var local = localStorage.getItem(LS);

      if (!remote) {                       // first device to use this key: seed it
        status('synced — this device is the first');
        if (local) save();
        return;
      }
      if (remote === local) { status('up to date · ' + when(r.j.savedAt)); return; }

      if (sessionStorage.getItem(FLAG) && !first) {
        // Already reloaded once this session and it still differs — do not loop.
        status('conflict — local kept, press Sync key to re-pull');
        return;
      }
      sessionStorage.setItem(FLAG, '1');
      raw(LS, remote);
      location.reload();
    }).catch(function () { status('offline — this device only'); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  function start() { ui(); if (key) pull(false); else status('this device only'); }
})();
