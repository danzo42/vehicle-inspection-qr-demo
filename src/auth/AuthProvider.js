/* =============================================================================
 * AuthProvider.js  ―― 認証も差し替え可能にしておくための抽象
 * -----------------------------------------------------------------------------
 * 今回は入力側も認証なし（NoAuthProvider）ですが、将来
 * 「点検入力だけログイン必須にしたい」となったときに、
 * 画面側を書き換えずに切り替えられるようにしています。
 * ========================================================================== */

(function (global) {
  'use strict';

  class AuthProvider {
    get name() { return 'AuthProvider(未実装)'; }

    /** ログインが必要か */
    get required() { return false; }

    /** 現在の利用者。未ログインなら null */
    async currentUser() { return null; }

    /** 認証が必要な画面の入口で呼ぶ。認証不要なら何もしない。 */
    async requireSignIn() { return null; }

    async signOut() { /* 何もしない */ }
  }

  /** 認証なし版（現行） */
  class NoAuthProvider extends AuthProvider {
    get name() { return '認証なし'; }
    get required() { return false; }
    async currentUser() { return null; }
    async requireSignIn() { return null; }
  }

  global.VIS = global.VIS || {};
  global.VIS.AuthProvider   = AuthProvider;
  global.VIS.NoAuthProvider = NoAuthProvider;

  /** 設定に従って認証方式を作る（storageFactoryと同じ考え方） */
  global.VIS.createAuth = function createAuth() {
    switch (global.VIS.config.auth) {
      case 'none': return new NoAuthProvider();
      // 将来: case 'firebase': return new FirebaseAuthProvider();
      default:     return new NoAuthProvider();
    }
  };

})(window);
