/* =============================================================================
 * StorageAdapter.js  ―― 保存先を切り替えるための「インターフェース（約束事）」
 * -----------------------------------------------------------------------------
 * ★このシステムで一番大事なファイルです。
 *
 * アプリ本体（画面のプログラム）は、Firebase の関数を直接呼びません。
 * かならずこの StorageAdapter で決めたメソッドだけを呼びます。
 *
 *      画面(inspect.html など)
 *            ↓  ここで定義したメソッドしか呼ばない
 *      StorageAdapter（この抽象クラス）
 *            ↓  実際の処理は下のどれかが担当
 *      ├─ FirebaseStorageAdapter （今回使うもの：Firestore + Cloud Storage）
 *      ├─ LocalStorageAdapter    （検証用：ブラウザ内のIndexedDBに保存）
 *      └─ ★将来  AzureBlobStorageAdapter / SharePointAdapter を足すだけで移行完了
 *
 * 将来Azure/SharePointへ移行するときにやることは、
 *   1) 同じメソッドを持つ新しいアダプタを1本書く
 *   2) config/app-config.js の storage を書き換える
 * この2つだけです。画面側のコードは一切変更しません。
 * ========================================================================== */

(function (global) {
  'use strict';

  /**
   * 保存先アダプタの基底クラス。
   * 継承した側で全メソッドを実装してください（未実装なら例外を投げます）。
   */
  class StorageAdapter {

    /** アダプタ名（画面に表示して、今どこに繋がっているか分かるようにする） */
    get name() { return 'StorageAdapter(未実装)'; }

    /** 接続の初期化。アプリ起動時に1回だけ呼ばれます。 */
    async init() { this._notImplemented('init'); }

    // ---------------------------------------------------------------- 車両マスタ

    /**
     * 車両1台を取得する。QRコードで読んだ文字列をそのまま渡します。
     * @param {string} vehicleId 例: "DC4-0737"
     * @returns {Promise<Object|null>} 見つからなければ null
     */
    async getVehicle(vehicleId) { this._notImplemented('getVehicle'); }

    /**
     * 管理番号の部分一致で車両を探す（QRが読めないときの手入力検索用）。
     * @param {string} keyword
     * @param {number} limit
     * @returns {Promise<Object[]>}
     */
    async searchVehicles(keyword, limit) { this._notImplemented('searchVehicles'); }

    /**
     * 車両マスタを一括登録・更新する（約3,000台）。
     * @param {Object[]} vehicles
     * @param {(done:number,total:number)=>void} [onProgress] 進捗コールバック
     */
    async importVehicles(vehicles, onProgress) { this._notImplemented('importVehicles'); }

    /** 登録済み車両の件数（動作確認用） */
    async countVehicles() { this._notImplemented('countVehicles'); }

    // ------------------------------------------------------------------ 点検記録

    /**
     * 点検記録を1件保存する。点検記録PDFもここで一緒に預けます。
     * 保存場所の考え方は「車両ID ／ 点検日時」で整理すること（実装側の責任）。
     *
     * @param {Object}   record            点検結果本体（JSON）
     * @param {Blob}     pdfBlob           生成済みの点検記録PDF
     * @param {(msg:string)=>void} [onProgress]
     * @returns {Promise<{inspectionId:string, pdfUrl:string}>}
     */
    async saveInspection(record, pdfBlob, onProgress) { this._notImplemented('saveInspection'); }

    /**
     * 指定車両の「直近の点検記録」を1件返す（第三者閲覧ページで使用）。
     * @param {string} vehicleId
     * @returns {Promise<Object|null>}
     */
    async getLatestInspection(vehicleId) { this._notImplemented('getLatestInspection'); }

    /**
     * 指定車両の点検履歴を新しい順に返す。
     * @param {string} vehicleId
     * @param {number} limit
     * @returns {Promise<Object[]>}
     */
    async listInspections(vehicleId, limit) { this._notImplemented('listInspections'); }

    /**
     * 点検記録を1件取得する。
     * @param {string} vehicleId
     * @param {string} inspectionId
     */
    async getInspection(vehicleId, inspectionId) { this._notImplemented('getInspection'); }

    /**
     * 保存した点検記録PDFを画面で開けるURLに変換する。
     * Firebaseならすでに公開URLなのでそのまま返し、
     * ローカル検証モードならBlobのURLを作って返します。
     * @param {string} url
     * @returns {Promise<string>}
     */
    async resolveFileUrl(url) { this._notImplemented('resolveFileUrl'); }

    // -------------------------------------------------------------------- 内部

    _notImplemented(method) {
      throw new Error(`${this.constructor.name}.${method}() が実装されていません`);
    }
  }

  global.VIS = global.VIS || {};
  global.VIS.StorageAdapter = StorageAdapter;

})(window);
