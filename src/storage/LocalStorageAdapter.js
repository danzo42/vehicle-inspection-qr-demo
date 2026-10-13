/* =============================================================================
 * LocalStorageAdapter.js  ―― 検証用アダプタ（ブラウザ内のIndexedDBに保存）
 * -----------------------------------------------------------------------------
 * Firebaseの設定をしなくても、この端末だけで一通りの動作確認ができます。
 * 「QRを読む → 車両が引ける → 点検を入力する → PDFが出る → 閲覧できる」の
 * 流れを、ネット接続なしで試すためのものです。本番では使いません。
 *
 * 保存先は端末のブラウザ内なので、他の端末とはデータを共有しません。
 * ========================================================================== */

(function (global) {
  'use strict';

  const DB_NAME    = 'vis-local';
  const DB_VERSION = 1;

  class LocalStorageAdapter extends global.VIS.StorageAdapter {

    get name() { return this.label || 'ローカル検証用（IndexedDB）'; }

    async init() {
      this.db = await this._openDb();
      return this;
    }

    _openDb() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          // 車両マスタ：管理番号(vehicleId)をキーにする
          if (!db.objectStoreNames.contains('vehicles')) {
            db.createObjectStore('vehicles', { keyPath: 'vehicleId' });
          }
          // 点検記録：inspectionIdをキー、車両IDで検索できるようindexを張る
          if (!db.objectStoreNames.contains('inspections')) {
            const s = db.createObjectStore('inspections', { keyPath: 'inspectionId' });
            s.createIndex('byVehicle', 'vehicleId', { unique: false });
          }
          // 添付ファイル（点検記録PDF）
          if (!db.objectStoreNames.contains('files')) {
            db.createObjectStore('files', { keyPath: 'path' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
      });
    }

    _tx(store, mode) {
      return this.db.transaction(store, mode).objectStore(store);
    }

    _wrap(request) {
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror   = () => reject(request.error);
      });
    }

    // ---------------------------------------------------------------- 車両マスタ

    async getVehicle(vehicleId) {
      const v = await this._wrap(this._tx('vehicles', 'readonly').get(vehicleId));
      return v || null;
    }

    async searchVehicles(keyword, limit = 20) {
      const all = await this._wrap(this._tx('vehicles', 'readonly').getAll());
      const k = String(keyword || '').toUpperCase();
      return all.filter(v => v.vehicleId.includes(k)).slice(0, limit);
    }

    async importVehicles(vehicles, onProgress) {
      const CHUNK = 200;
      for (let i = 0; i < vehicles.length; i += CHUNK) {
        const slice = vehicles.slice(i, i + CHUNK);
        await new Promise((resolve, reject) => {
          const tx = this.db.transaction('vehicles', 'readwrite');
          const st = tx.objectStore('vehicles');
          slice.forEach(v => st.put(v));
          tx.oncomplete = resolve;
          tx.onerror    = () => reject(tx.error);
        });
        if (onProgress) onProgress(Math.min(i + CHUNK, vehicles.length), vehicles.length);
      }
      return vehicles.length;
    }

    async countVehicles() {
      return await this._wrap(this._tx('vehicles', 'readonly').count());
    }

    // ------------------------------------------------------------------ 点検記録

    async saveInspection(record, pdfBlob, onProgress) {
      const inspectionId = record.inspectionId;
      const basePath = `inspections/${record.vehicleId}/${inspectionId}`;

      // --- PDF ---
      let pdfUrl = '';
      if (pdfBlob) {
        if (onProgress) onProgress('PDFを保存中');
        const pdfPath = `${basePath}/record.pdf`;
        await this._wrap(this._tx('files', 'readwrite').put({ path: pdfPath, blob: pdfBlob }));
        pdfUrl = `local://${pdfPath}`;
        record.pdfPath = pdfPath;
      }

      record.pdfUrl = pdfUrl;
      record.storedBy = this.name;

      if (onProgress) onProgress('点検データを保存中');
      await this._wrap(this._tx('inspections', 'readwrite').put(record));

      return { inspectionId, pdfUrl };
    }

    async listInspections(vehicleId, limit = 20) {
      const idx = this._tx('inspections', 'readonly').index('byVehicle');
      const rows = await this._wrap(idx.getAll(IDBKeyRange.only(vehicleId)));
      rows.sort((a, b) => String(b.inspectedAt).localeCompare(String(a.inspectedAt)));
      return rows.slice(0, limit);
    }

    async getLatestInspection(vehicleId) {
      const rows = await this.listInspections(vehicleId, 1);
      return rows[0] || null;
    }

    async getInspection(vehicleId, inspectionId) {
      const r = await this._wrap(this._tx('inspections', 'readonly').get(inspectionId));
      return r || null;
    }

    /** ローカル保存したファイル(local://…)を画面で開けるURLに変換する */
    async resolveFileUrl(url) {
      if (!url || !url.startsWith('local://')) return url;
      const path = url.replace('local://', '');
      const rec = await this._wrap(this._tx('files', 'readonly').get(path));
      return rec ? URL.createObjectURL(rec.blob) : '';
    }
  }

  global.VIS.LocalStorageAdapter = LocalStorageAdapter;

})(window);
