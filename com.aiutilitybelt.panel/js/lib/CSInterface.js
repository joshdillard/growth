/*
 * Slim CSInterface — the subset of Adobe's CEP CSInterface library this panel
 * needs. It talks to the __adobe_cep__ bindings that Premiere injects into
 * every CEP panel. If you prefer, you can drop in Adobe's full CSInterface.js
 * (v9+) from https://github.com/Adobe-CEP/CEP-Resources — the API is
 * compatible.
 */
function CSInterface() {}

CSInterface.prototype.evalScript = function (script, callback) {
  callback = callback || function () {};
  if (!window.__adobe_cep__) {
    callback("EvalScript error: not running inside a CEP host.");
    return;
  }
  window.__adobe_cep__.evalScript(script, callback);
};

CSInterface.prototype.getHostEnvironment = function () {
  try {
    return JSON.parse(window.__adobe_cep__.getHostEnvironment());
  } catch (e) {
    return null;
  }
};

CSInterface.prototype.getSystemPath = function (pathType) {
  var path = decodeURI(window.__adobe_cep__.getSystemPath(pathType));
  return path.replace("file://" + (navigator.platform.indexOf("Win") > -1 ? "/" : ""), "");
};

CSInterface.prototype.openURLInDefaultBrowser = function (url) {
  if (window.cep && window.cep.util) return window.cep.util.openURLInDefaultBrowser(url);
  window.open(url);
};

CSInterface.EVAL_SCRIPT_ERROR = "EvalScript error.";
