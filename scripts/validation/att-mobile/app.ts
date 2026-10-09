import { Application, Button, StackLayout, ScrollView, Label, File, knownFolders } from '@nativescript/core';
import { AdMobRewardGateway } from '@haiyue/native/rewards/admob';
const mode = String(NSProcessInfo.processInfo.environment.objectForKey('HY_ATT_MODE') ?? 'system');
const file = File.fromPath(knownFolders.documents().path + '/att-validation.jsonl');
let lines = '', status: Label;
function log(event: string, data: unknown = {}) {
  const row = {time: new Date().toISOString(), mode, event, data};
  lines += JSON.stringify(row) + '\n'; file.writeTextSync(lines);
  console.log('ATT_VALIDATION ' + JSON.stringify(row));
  if (status) status.text = event + '\n' + JSON.stringify(data);
}
const gateway = new AdMobRewardGateway({iosUnit: 'ca-app-pub-3940256099942544/1712485313', androidUnit: '',
  policy: {iosTrackingAuthorization: mode === 'legacy' ? 'none' : 'system',
    underAgeOfConsent: mode === 'underage', ageTreatment: mode === 'child' ? 'child' : 'unspecified'},
  onFailure: failure => log('failure', failure)});
const state = () => gateway.trackingAuthorizationStatus();
let busy = false;
async function run(action: 'startup' | 'paid' | 'show') {
  if (busy) return; busy = true; log('begin', {action, att: state()});
  try {
    if (action === 'show') await gateway.show(() => log('earned'), {
      prepare: async () => {log('presentation-ready', {att: state()}); return true;},
      closed: () => log('presentation-closed', {att: state()}),
    });
    else await gateway.initialize(action !== 'paid', async () => {log('presentation-ready', {att: state()}); return true;});
    log('completed', {action, att: state()});
  } catch (error) {log('operation-error', {action, att: state(), error: String(error)});}
  finally {busy = false;}
}
Application.run({create: () => {
  UIApplication.sharedApplication.idleTimerDisabled = true;
  setTimeout(tryAutoStart, 300);
  const root = new StackLayout(); root.padding = '60 16 20 16'; root.backgroundColor = '#edf5ff';
  const title = new Label(); title.text = 'ATT Validation · ' + mode; root.addChild(title);
  function add(text: string, callback: () => void) {const button = new Button();button.text = text;button.height = 52;button.on('tap', callback);root.addChild(button);}
  add('Read ATT status', () => log('status', {att: state()}));
  add('Unpaid startup', () => void run('startup'));
  add('Paid startup', () => void run('paid'));
  add('Show Google test ad', () => void run('show'));
  status = new Label();status.textWrap = true;root.addChild(status);
  log('ready', {att: state(), bundleId: NSBundle.mainBundle.bundleIdentifier,
    admobAppId: NSBundle.mainBundle.objectForInfoDictionaryKey('GADApplicationIdentifier'),
    delayMeasurement: NSBundle.mainBundle.objectForInfoDictionaryKey('GADDelayAppMeasurementInit')});
  const scroll = new ScrollView();scroll.content = root;return scroll;
}});
// Optional device API probe when XCTest cannot attach. Never fabricates consent.
// The default screen is interactive. Explicit probes may request the OS alert,
// but never answer it or change permission/consent stores.
let autoStarted = false, activeRetries = 0;
function tryAutoStart() {
  const action = String(NSProcessInfo.processInfo.environment.objectForKey('HY_ATT_AUTOSTART') ?? '');
  if (autoStarted || !(action === 'show' || action === 'paid' || (action === 'startup' && ['system', 'legacy', 'underage', 'child'].includes(mode)))) return;
  if (UIApplication.sharedApplication.applicationState !== UIApplicationState.Active) {
    if (++activeRetries <= 100) setTimeout(tryAutoStart, 100);
    else log('probe-inactive');
    return;
  }
  autoStarted = true;
  // Automated ad probes exercise only the already-denied path; never grant ATT.
  if (action === 'show' && state() !== 'denied') {log('probe-skipped', {action, att: state()}); return;}
  void run(action as 'paid' | 'startup' | 'show');
}
Application.on(Application.resumeEvent, () => {log('resumed', {att: state()}); tryAutoStart();});
Application.on(Application.exitEvent, () => {UIApplication.sharedApplication.idleTimerDisabled = false; gateway.dispose();});
