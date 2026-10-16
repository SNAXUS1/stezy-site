// The phone's own parts (reminders, haptics, the system bars, sharing, the back button), when Afterhours runs as the
// Android app. In a browser (the demo on stezy.lt) each falls back to something sensible or does nothing.

const C = window.Capacitor;
export const isNative = !!(C && C.isNativePlatform && C.isNativePlatform());
const P = name => (isNative && C.Plugins && C.Plugins[name]) || null;
const safe = async (f, fallback) => { try { return await f(); } catch (e) { console.warn(e); return fallback; } };

export const haptic = {
  tap() { const h = P('Haptics'); if (h) safe(() => h.impact({ style: 'LIGHT' })); },
  firm() { const h = P('Haptics'); if (h) safe(() => h.impact({ style: 'MEDIUM' })); },
  done() { const h = P('Haptics'); if (h) safe(() => h.notification({ type: 'SUCCESS' })); },
  tick() { const h = P('Haptics'); if (h) safe(() => h.selectionChanged()); },
  tickStart() { const h = P('Haptics'); if (h) safe(() => h.selectionStart()); },
  tickEnd() { const h = P('Haptics'); if (h) safe(() => h.selectionEnd()); },
};

/** Light icons on a dark page, dark icons on a light one. */
export function bars(dark) {
  const s = P('SystemBars');
  if (s) safe(() => s.setStyle({ style: dark ? 'DARK' : 'LIGHT' }));
}

// ---------------------------------------------------------------- reminders

const CHANNEL = 'reminders';
let channelMade = null;
export async function notifyState() {
  const n = P('LocalNotifications');
  if (!n) return 'none';
  const p = await safe(() => n.checkPermissions(), { display: 'denied' });
  return p.display; // granted | denied | prompt | prompt-with-rationale
}
export async function askNotify() {
  const n = P('LocalNotifications');
  if (!n) return 'none';
  const p = await safe(() => n.requestPermissions(), { display: 'denied' });
  return p.display;
}
/** Replaces every pending reminder with this list: { id, at (ms), title, body, act }. */
export async function setReminders(list, ch = { name: 'Reminders', description: 'Start, end and break reminders' }) {
  const n = P('LocalNotifications');
  if (!n) return;
  // made once, and again when the language changes (Android keeps the id and updates the name)
  if (channelMade !== ch.name) {
    channelMade = ch.name;
    await safe(() => n.createChannel({ id: CHANNEL, name: ch.name, description: ch.description, importance: 4, visibility: 1, vibration: true }));
  }
  const pending = await safe(() => n.getPending(), { notifications: [] });
  if (pending.notifications.length) await safe(() => n.cancel({ notifications: pending.notifications.map(x => ({ id: x.id })) }));
  const now = Date.now();
  const items = list.filter(r => r.at > now + 5000).map(r => ({
    id: r.id, title: r.title, body: r.body, channelId: CHANNEL, smallIcon: 'ic_stat_afterhours', iconColor: '#E4A866',
    schedule: { at: new Date(r.at), allowWhileIdle: true }, extra: { act: r.act },
  }));
  if (items.length) await safe(() => n.schedule({ notifications: items }));
}
export function onReminderTap(cb) {
  const n = P('LocalNotifications');
  if (n) n.addListener('localNotificationActionPerformed', e => cb((e.notification && e.notification.extra && e.notification.extra.act) || ''));
}

// ---------------------------------------------------------------- the app's life

export function onBack(cb) {
  const a = P('App');
  if (a) a.addListener('backButton', cb);
}
export function exitApp() { const a = P('App'); if (a) safe(() => a.minimizeApp ? a.minimizeApp() : a.exitApp()); }
export function onResume(cb) {
  const a = P('App');
  if (a) a.addListener('resume', cb);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) cb(); });
}
export function hideSplash() { const s = P('SplashScreen'); if (s) safe(() => s.hide({ fadeOutDuration: 200 })); }

// ---------------------------------------------------------------- a second copy of the hours
// Kept in the app's own files (they stay through updates), in case the WebView's storage ever comes back empty.
const MIRROR = 'afterhours-data.json';
let mirrorT = 0, mirrorText = null;
function mirrorFlush() {
  clearTimeout(mirrorT);
  const fs = P('Filesystem'), t = mirrorText;
  mirrorText = null;
  if (fs && t != null) safe(() => fs.writeFile({ path: MIRROR, data: t, directory: 'DATA', encoding: 'utf8' }));
}
export function mirrorSave(text) {
  if (!P('Filesystem')) return;
  mirrorText = text;
  clearTimeout(mirrorT);
  mirrorT = setTimeout(mirrorFlush, 700);
}
export async function mirrorLoad() {
  const fs = P('Filesystem');
  if (!fs) return null;
  const r = await safe(() => fs.readFile({ path: MIRROR, directory: 'DATA', encoding: 'utf8' }), null);
  return r && typeof r.data === 'string' ? r.data : null;
}
// write it straight away when the app goes into the background
document.addEventListener('visibilitychange', () => { if (document.hidden && mirrorText != null) mirrorFlush(); });

/** Opens a web address in the phone's browser (Capacitor hands links to other sites to the system). */
export function openUrl(url) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ---------------------------------------------------------------- sharing

/** Shares a file (a spreadsheet, a backup) through the phone's share sheet; in a browser it downloads. */
export async function shareFile(name, text, mime, title) {
  const fs = P('Filesystem'), sh = P('Share');
  if (fs && sh) {
    const w = await safe(() => fs.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' }), null);
    if (w && w.uri) { await safe(() => sh.share({ title, files: [w.uri], dialogTitle: title })); return true; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}
export async function shareText(text, title) {
  const sh = P('Share');
  if (sh) { await safe(() => sh.share({ title, text, dialogTitle: title })); return 'shared'; }
  if (navigator.share) { try { await navigator.share({ title, text }); return 'shared'; } catch { return 'cancel'; } }
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch { return 'fail'; }
}
/** Lets the person pick a backup file to read back in. */
export function pickFile(accept) {
  return new Promise(resolve => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept;
    i.onchange = () => { const f = i.files && i.files[0]; if (!f) return resolve(null); const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => resolve(null); r.readAsText(f); };
    i.click();
  });
}
