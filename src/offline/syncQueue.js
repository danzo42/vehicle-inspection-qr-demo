/* =============================================================================
 * syncQueue.js  ―― オフライン入力の保留と自動同期
 * -----------------------------------------------------------------------------
 * 電波が届かない現場でも点検入力ができるように、送信できなかったデータを
 * 端末内（IndexedDB）に貯めておき、オンラインに戻ったら自動で送ります。
 *
 * 貯めるのは「点検記録・PDF」の一式です。保存先アダプタが何であっても
 * 使えるよう、送信は VIS.storage.saveInspection() を呼ぶだけにしています。
 * ========================================================================== */

(function (global) {
  'use strict';

  const VIS = global.VIS;
  const DB_NAME = 'vis-queue';
  const STORE   = 'pending';

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'inspectionId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  function op(mode, fn) {
    return openDb().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const st = tx.objectStore(STORE);
      const r  = fn(st);
      tx.oncomplete = () => resolve(r && r.result !== undefined ? r.result : r);
      tx.onerror    = () => reject(tx.error);
    }));
  }

  /** 保留に追加する */
  async function enqueue(record, pdfBlob) {
    await op('readwrite', st => st.put({
      inspectionId: record.inspectionId,
      queuedAt: VIS.util.nowIso(),
      record, pdfBlob
    }));
  }

  /** 保留件数 */
  async function count() {
    return await op('readonly', st => st.count());
  }

  /** 保留の一覧 */
  async function list() {
    return await op('readonly', st => st.getAll());
  }

  async function remove(inspectionId) {
    await op('readwrite', st => st.delete(inspectionId));
  }

  /**
   * 保留分をまとめて送信する。
   * @returns {Promise<{sent:number, failed:number}>}
   */
  async function flush(onProgress) {
    if (!VIS.util.isOnline()) return { sent: 0, failed: 0 };
    const items = await list();
    let sent = 0, failed = 0;

    for (const it of items) {
      try {
        if (onProgress) onProgress(`保留データを送信中: ${it.record.vehicleId}`);
        await VIS.storage.saveInspection(it.record, it.pdfBlob);
        await remove(it.inspectionId);
        sent++;
      } catch (e) {
        console.warn('保留データの送信に失敗:', it.inspectionId, e);
        failed++;
      }
    }
    return { sent, failed };
  }

  /** オンラインに戻ったら自動で送る */
  function autoFlush() {
    global.addEventListener('online', async () => {
      const n = await count();
      if (n > 0) {
        VIS.util.toast(`オンラインに復帰しました。保留 ${n} 件を送信します`, 'info');
        const r = await flush();
        if (r.sent)   VIS.util.toast(`保留 ${r.sent} 件を送信しました`, 'ok');
        if (r.failed) VIS.util.toast(`${r.failed} 件は送信できませんでした`, 'warn');
      }
    });
  }

  VIS.queue = { enqueue, count, list, remove, flush, autoFlush };

})(window);
