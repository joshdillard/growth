/*
 * bridge.js — promise wrapper around ExtendScript calls.
 * Every host function takes/returns JSON strings; host() parses the result
 * and rejects on {ok:false} or EvalScript errors.
 */
const AUB = window.AUB || (window.AUB = {});

AUB.cs = new CSInterface();

AUB.host = function (fnName, payload) {
  return new Promise((resolve, reject) => {
    const arg = payload !== undefined
      ? "'" + JSON.stringify(payload).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'"
      : "";
    AUB.cs.evalScript(fnName + "(" + arg + ")", (result) => {
      if (!result || result.indexOf("EvalScript error") === 0) {
        reject(new Error("Premiere scripting call failed (" + fnName + "). Is a project open?"));
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(result);
      } catch (e) {
        reject(new Error("Bad response from " + fnName + ": " + result));
        return;
      }
      if (parsed && parsed.ok === false) {
        reject(new Error(parsed.error || ("Unknown error in " + fnName)));
      } else {
        resolve(parsed);
      }
    });
  });
};

// Convenience wrappers
AUB.premiere = {
  ping: () => AUB.host("AUB_ping"),
  getSequenceInfo: () => AUB.host("AUB_getSequenceInfo"),
  getPrimaryMediaPath: () => AUB.host("AUB_getPrimaryMediaPath"),
  addMarkers: (markers) => AUB.host("AUB_addMarkers", { markers }),
  createShort: (start, end, name) => AUB.host("AUB_createShort", { start, end, name }),
  autoCut: (ranges) => AUB.host("AUB_autoCut", { ranges, duplicate: true }),
};
