//#region src/utils/date.ts
function isWeekendDay(timestamp) {
	const t = typeof timestamp === "number" ? timestamp : timestamp && timestamp.getTime ? timestamp.getTime() : 0;
	const day = new Date(t).getDay();
	return day === 6 || day === 0;
}
function isPeakHour(timestamp, peakHours) {
	if (isWeekendDay(timestamp)) return false;
	const d = new Date(timestamp);
	const totalMinutes = d.getHours() * 60 + d.getMinutes();
	for (const h of peakHours) {
		if (!h || !h.start || !h.end) continue;
		const p = h.start.split(":");
		const q = h.end.split(":");
		const sp = parseInt(p[0]) * 60 + parseInt(p[1] || "0");
		const ep = parseInt(q[0]) * 60 + parseInt(q[1] || "0");
		if (sp < ep) {
			if (totalMinutes >= sp && totalMinutes < ep) return true;
		} else if (totalMinutes >= sp || totalMinutes < ep) return true;
	}
	return false;
}
function localDay(ts) {
	const t = typeof ts === "number" ? ts : ts.getTime();
	const d = new Date(t);
	const pad = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function localTimeHM(ts) {
	const t = typeof ts === "number" ? ts : ts.getTime();
	const d = new Date(t);
	const pad = (n) => String(n).padStart(2, "0");
	return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function esc(s) {
	return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function isUnsafeKey(k) {
	return k === "__proto__" || k === "constructor" || k === "prototype";
}
//#endregion
export { localDay as a, isWeekendDay as i, isPeakHour as n, localTimeHM as o, isUnsafeKey as r, esc as t };
