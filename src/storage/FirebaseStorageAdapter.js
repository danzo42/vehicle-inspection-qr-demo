/* =============================================================================
 * FirebaseStorageAdapter.js  ―― 本番（検証段階）用アダプタ
 * -----------------------------------------------------------------------------
 * Firestore（データ）と Cloud Storage（点検記録PDF）に保存します。
 *
 * ★Firebase固有のコードは、このファイルの中だけに閉じ込めています。
 *   画面側のプログラムには firebase という単語は一度も出てきません。
 *   だからAzure/SharePointへ移行するときは、このファイルと同じ形の
 *   アダプタを1本書くだけで済みます。
 *
 * ■ Firestore のコレクション設計（約3,000台を想定）
 *     vehicles/{vehicleId}                     … 車両マスタ（id = "DC4-0737"）
 *     vehicles/{vehicleId}/inspections/{id}    … その車両の点検記録（サブコレクション）
 *   車両ごとにサブコレクションを分けることで、1台あたりの読み取りが軽くなり、
 *   台数が増えても性能が落ちません。
 *
 * ■ Cloud Storage のパス設計
 *     inspections/{vehicleId}/{inspectionId}/record.pdf
 *   「車両ID ／ 点検日時」で辿れる形にしています。
 * ========================================================================== */

(function (global) {
  'use strict';

  class FirebaseStorageAdapter extends global.VIS.StorageAdapter {

    constructor(config) {
      super();
      this.config = config;
    }

    get name() { return 'Firebase（Firestore + Cloud Storage）'; }

    async init() {
      if (!global.firebase) {
        throw new Error('Firebase SDK が読み込まれていません（vendor/firebase-*.js を確認してください）');
      }
      if (!this.config || !this.config.projectId) {
        throw new Error('Firebaseの設定が未入力です。config/firebase-config.js を編集してください。');
      }
      if (!global.firebase.apps.length) {
        global.firebase.initializeApp(this.config);
      }
      this.fs      = global.firebase.firestore();
      this.storage = global.firebase.storage();

      // オフライン時もキャッシュから読めるようにする（PWAのオフライン対応）
      try {
        await this.fs.enablePersistence({ synchronizeTabs: true });
      } catch (e) {
        console.warn('Firestoreのオフライン永続化は有効にできませんでした:', e.code);
      }
      return this;
    }

    // ---------------------------------------------------------------- 車両マスタ

    async getVehicle(vehicleId) {
      const doc = await this.fs.collection('vehicles').doc(vehicleId).get();
      return doc.exists ? doc.data() : null;
    }

    async searchVehicles(keyword, limit = 20) {
      // Firestoreは部分一致検索ができないため、前方一致（範囲検索）で代用します。
      const k = String(keyword || '').toUpperCase();
      const snap = await this.fs.collection('vehicles')
        .orderBy('vehicleId')
        .startAt(k)
        .endAt(k + '')
        .limit(limit)
        .get();
      return snap.docs.map(d => d.data());
    }

    async importVehicles(vehicles, onProgress) {
      // FirestoreのバッチAPIは1回500件までなので、分割して書き込みます。
      const CHUNK = 400;
      for (let i = 0; i < vehicles.length; i += CHUNK) {
        const batch = this.fs.batch();
        vehicles.slice(i, i + CHUNK).forEach(v => {
          batch.set(this.fs.collection('vehicles').doc(v.vehicleId), v, { merge: true });
        });
        await batch.commit();
        if (onProgress) onProgress(Math.min(i + CHUNK, vehicles.length), vehicles.length);
      }
      return vehicles.length;
    }

    async countVehicles() {
      const snap = await this.fs.collection('vehicles').count().get();
      return snap.data().count;
    }

    // ------------------------------------------------------------------ 点検記録

    async saveInspection(record, pdfBlob, onProgress) {
      const inspectionId = record.inspectionId;
      const basePath = `inspections/${record.vehicleId}/${inspectionId}`;

      // --- PDFをCloud Storageへ ---
      let pdfUrl = '';
      if (pdfBlob) {
        if (onProgress) onProgress('PDFをアップロード中');
        const ref = this.storage.ref(`${basePath}/record.pdf`);
        await ref.put(pdfBlob, { contentType: 'application/pdf' });
        pdfUrl = await ref.getDownloadURL();
        record.pdfPath = ref.fullPath;
      }

      record.pdfUrl   = pdfUrl;
      record.storedBy = this.name;

      // --- 点検データ本体をFirestoreへ ---
      if (onProgress) onProgress('点検データを保存中');
      await this.fs.collection('vehicles').doc(record.vehicleId)
        .collection('inspections').doc(inspectionId)
        .set(record);

      // 車両側にも「直近点検」を写しておく（閲覧ページが1回の読み取りで済むように）
      await this.fs.collection('vehicles').doc(record.vehicleId).set({
        lastInspectionId:   inspectionId,
        lastInspectedAt:    record.inspectedAt,
        lastInspectionPdf:  pdfUrl,
        lastInspectorName:  record.inspectorName,
        lastInspectionResult: record.summary ? record.summary.overall : ''
      }, { merge: true });

      return { inspectionId, pdfUrl };
    }

    async listInspections(vehicleId, limit = 20) {
      const snap = await this.fs.collection('vehicles').doc(vehicleId)
        .collection('inspections')
        .orderBy('inspectedAt', 'desc')
        .limit(limit)
        .get();
      return snap.docs.map(d => d.data());
    }

    async getLatestInspection(vehicleId) {
      const rows = await this.listInspections(vehicleId, 1);
      return rows[0] || null;
    }

    async getInspection(vehicleId, inspectionId) {
      const doc = await this.fs.collection('vehicles').doc(vehicleId)
        .collection('inspections').doc(inspectionId).get();
      return doc.exists ? doc.data() : null;
    }

    /** Firebaseの場合はすでに閲覧可能なURLなのでそのまま返す */
    async resolveFileUrl(url) { return url; }
  }

  global.VIS.FirebaseStorageAdapter = FirebaseStorageAdapter;

})(window);
