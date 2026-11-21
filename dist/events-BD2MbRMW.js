//#region src/data/events.ts
var map = /* @__PURE__ */ new Map();
var DataEvents = {
	UPDATED: "data:updated",
	HISTORY_ADDED: "data:history:added",
	SETTINGS_CHANGED: "data:settings:changed",
	BALANCE_CHANGED: "data:balance:changed"
};
function on(event, fn) {
	if (!map.has(event)) map.set(event, /* @__PURE__ */ new Set());
	map.get(event).add(fn);
	return () => off(event, fn);
}
function off(event, fn) {
	map.get(event)?.delete(fn);
}
function emit(event, payload) {
	map.get(event)?.forEach((fn) => {
		try {
			fn(payload);
		} catch {}
	});
}
//#endregion
export { emit as n, on as r, DataEvents as t };
