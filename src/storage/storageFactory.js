/* =============================================================================
 * storageFactory.js  ―― 「どのアダプタを使うか」を決める唯一の場所
 * -----------------------------------------------------------------------------
 * 保存先を切り替えたいときは config/app-config.js の storage を変えるだけです。
 * ここに新しい行を1つ足せば、AzureやSharePointにも対応できます。
 * ========================================================================== */

(function (global) {
  'use strict';

  const VIS = global.VIS;

  /**
   * 設定に従ってアダプタを1つ作り、初期化して返します。
   * アプリ全体で1インスタンスだけ使い回します（VIS.storage）。
   */
  async function createStorage() {
    const cfg  = VIS.config;
    const kind = cfg.storage;
    let adapter;

    switch (kind) {
      case 'firebase':
        adapter = new VIS.FirebaseStorageAdapter(global.FIREBASE_CONFIG);
        break;

      case 'local':
        adapter = new VIS.LocalStorageAdapter();
        break;

      // ★将来ここに追加するだけで移行できます
      // case 'azure':
      //   adapter = new VIS.AzureBlobStorageAdapter(global.AZURE_CONFIG); break;
      // case 'sharepoint':
      //   adapter = new VIS.SharePointAdapter(global.SHAREPOINT_CONFIG); break;

      default:
        throw new Error(`未知の保存先です: ${kind}（config/app-config.js を確認してください）`);
    }

    try {
      await adapter.init();
    } catch (e) {
      // Firebase未設定などで失敗したら、検証用のローカル保存に自動で切り替えます。
      if (cfg.fallbackToLocal && kind !== 'local') {
        console.warn('保存先の初期化に失敗したため、ローカル検証モードに切り替えます:', e.message);
        adapter = new VIS.LocalStorageAdapter();
        await adapter.init();
        adapter.fallbackReason = e.message;
      } else {
        throw e;
      }
    }

    VIS.storage = adapter;
    return adapter;
  }

  VIS.createStorage = createStorage;

  /** 各画面の先頭で呼ぶ共通の初期化 */
  VIS.ready = async function ready() {
    if (VIS._readyPromise) return VIS._readyPromise;
    VIS._readyPromise = (async () => {
      await createStorage();
      VIS.auth = VIS.createAuth();
      if (isDemo()) {
        VIS.storage.label = 'デモ版';
        showDemoBanner();
        await prepareDemoMaster();
      }
      return VIS;
    })();
    return VIS._readyPromise;
  };

  // ===========================================================================
  //  デモ版（上層部への説明用）
  //    点検記録は端末の中（IndexedDB）だけに保存し、外部には一切送らない。
  //    車両データはアプリに同梱した少数（架空の車両＋公開してよい実車）だけを使う。
  // ===========================================================================
  const DEMO_KEY = 'vis-demo-master-version';

  function isDemo() {
    return !!(VIS.config.demo && VIS.config.demo.enabled && VIS.config.storage === 'local');
  }
  VIS.isDemo = isDemo;

  /** 初回起動時（またはデモ用データの版が変わったとき）だけ、車両データを取り込む */
  async function prepareDemoMaster() {
    const demo = VIS.config.demo;
    let loadedVersion = null;
    try { loadedVersion = localStorage.getItem(DEMO_KEY); } catch (e) { /* 保存できない端末では毎回確認 */ }
    const count = await VIS.storage.countVehicles().catch(() => 0);
    if (loadedVersion === demo.version && count > 0) return;

    const res = await fetch(demo.masterUrl, { cache: 'no-cache' });
    if (!res.ok) throw new Error('デモ用の車両データを読み込めませんでした（初回はオンラインで開いてください）');
    await VIS.storage.importVehicles(await res.json());
    try { localStorage.setItem(DEMO_KEY, demo.version); } catch (e) { /* 次回また取り込むだけ */ }
  }

  /** 画面上部に「デモ版」の帯を出す */
  function showDemoBanner() {
    const put = () => {
      if (document.querySelector('.demo-banner')) return;
      const bar = document.createElement('div');
      bar.className = 'demo-banner';
      bar.textContent = 'デモ版：点検データはこの端末の中だけに保存されます（外部には送信しません）';
      const appbar = document.querySelector('.appbar');
      if (appbar) appbar.insertAdjacentElement('afterend', bar);
      else document.body.prepend(bar);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', put);
    else put();
  }

  /** デモを最初からやり直す（この端末の点検データと車両データを消して読み込み直す） */
  VIS.resetLocalData = async function resetLocalData() {
    await Promise.all(['vis-local', 'vis-queue'].map(n => new Promise(res => {
      const r = indexedDB.deleteDatabase(n);
      r.onsuccess = r.onerror = r.onblocked = () => res();
    })));
    try { localStorage.removeItem(DEMO_KEY); } catch (e) { /* ignore */ }
  };

})(window);
