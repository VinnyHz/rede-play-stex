(() => {
  const tokenKey = "rps_portal_session";

  window.RPS_SESSION = Object.freeze({
    getToken() {
      return localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
    },
    saveToken(token, remember = false) {
      const storage = remember === true ? localStorage : sessionStorage;
      const otherStorage = remember === true ? sessionStorage : localStorage;
      storage.setItem(tokenKey, token);
      otherStorage.removeItem(tokenKey);
    },
    clearToken() {
      localStorage.removeItem(tokenKey);
      sessionStorage.removeItem(tokenKey);
    },
  });
})();
