/* =============================================================================
 * firebase-config.js  ―― Firebaseプロジェクトの接続情報
 * -----------------------------------------------------------------------------
 * Firebaseコンソール → プロジェクトの設定 → マイアプリ（ウェブアプリ）で
 * 表示される firebaseConfig の中身を、そのまま下に貼り付けてください。
 * 貼り付けたら config/app-config.js の storage を 'firebase' に変更します。
 *
 * ※ここに書く値は公開されても問題ない情報です（アクセス制御は
 *   Firestore/Storageのセキュリティルールで行います。firestore.rules を参照）。
 * ========================================================================== */

window.FIREBASE_CONFIG = {
  apiKey:            '',
  authDomain:        '',
  projectId:         '',   // ← ここが空のうちは 'local'（検証モード）で動きます
  storageBucket:     '',
  messagingSenderId: '',
  appId:             ''
};
