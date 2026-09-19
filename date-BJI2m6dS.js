//#region src/constants/holidays.ts
var OFF_DAYS_BY_YEAR = {
	2024: [
		"2024-01-01",
		"2024-02-10",
		"2024-02-11",
		"2024-02-12",
		"2024-02-13",
		"2024-02-14",
		"2024-02-15",
		"2024-02-16",
		"2024-02-17",
		"2024-04-04",
		"2024-04-05",
		"2024-04-06",
		"2024-05-01",
		"2024-05-02",
		"2024-05-03",
		"2024-05-04",
		"2024-05-05",
		"2024-06-10",
		"2024-09-15",
		"2024-09-16",
		"2024-09-17",
		"2024-10-01",
		"2024-10-02",
		"2024-10-03",
		"2024-10-04",
		"2024-10-05",
		"2024-10-06",
		"2024-10-07"
	],
	2025: [
		"2025-01-01",
		"2025-01-28",
		"2025-01-29",
		"2025-01-30",
		"2025-01-31",
		"2025-02-01",
		"2025-02-02",
		"2025-02-03",
		"2025-02-04",
		"2025-04-04",
		"2025-04-05",
		"2025-04-06",
		"2025-05-01",
		"2025-05-02",
		"2025-05-03",
		"2025-05-04",
		"2025-05-05",
		"2025-05-31",
		"2025-06-01",
		"2025-06-02",
		"2025-10-01",
		"2025-10-02",
		"2025-10-03",
		"2025-10-04",
		"2025-10-05",
		"2025-10-06",
		"2025-10-07",
		"2025-10-08"
	],
	2026: [
		"2026-01-01",
		"2026-01-02",
		"2026-01-03",
		"2026-02-15",
		"2026-02-16",
		"2026-02-17",
		"2026-02-18",
		"2026-02-19",
		"2026-02-20",
		"2026-02-21",
		"2026-02-22",
		"2026-02-23",
		"2026-04-04",
		"2026-04-05",
		"2026-04-06",
		"2026-05-01",
		"2026-05-02",
		"2026-05-03",
		"2026-05-04",
		"2026-05-05",
		"2026-06-19",
		"2026-06-20",
		"2026-06-21",
		"2026-09-25",
		"2026-09-26",
		"2026-09-27",
		"2026-10-01",
		"2026-10-02",
		"2026-10-03",
		"2026-10-04",
		"2026-10-05",
		"2026-10-06",
		"2026-10-07"
	]
};
var CN_HOLIDAY_DATA_YEARS = Object.keys(OFF_DAYS_BY_YEAR).map((year) => parseInt(year, 10)).sort((a, b) => a - b);
var CN_HOLIDAY_COVERAGE_LABEL = CN_HOLIDAY_DATA_YEARS.length ? `${CN_HOLIDAY_DATA_YEARS[0]}-${CN_HOLIDAY_DATA_YEARS[CN_HOLIDAY_DATA_YEARS.length - 1]}` : "无";
var OFF_DAY_SET = /* @__PURE__ */ new Set();
for (const days of Object.values(OFF_DAYS_BY_YEAR)) for (const day of days) OFF_DAY_SET.add(day);
function isChinaHolidayDate(dayKey) {
	return OFF_DAY_SET.has(dayKey);
}
//#endregion
//#region src/utils/date.ts
function toTimestamp(timestamp) {
	if (typeof timestamp === "number") return Number.isFinite(timestamp) ? timestamp : null;
	if (timestamp && timestamp.getTime) return timestamp.getTime();
	return null;
}
function isWeekendDay(timestamp) {
	const t = toTimestamp(timestamp);
	if (t === null) return false;
	const day = new Date(t).getDay();
	return day === 6 || day === 0;
}
function isChinaHoliday(timestamp) {
	const t = toTimestamp(timestamp);
	if (t === null) return false;
	return isChinaHolidayDate(localDay(t));
}
function isExtraOffDay(timestamp, extraOffDays) {
	if (!extraOffDays || !extraOffDays.length) return false;
	const t = toTimestamp(timestamp);
	if (t === null) return false;
	const day = localDay(t);
	return extraOffDays.indexOf(day) !== -1;
}
function isOffpeakDay(timestamp, extraOffDays) {
	return isWeekendDay(timestamp) || isChinaHoliday(timestamp) || isExtraOffDay(timestamp, extraOffDays);
}
function isPeakHour(timestamp, peakHours, extraOffDays) {
	if (isOffpeakDay(timestamp, extraOffDays)) return false;
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
function isValidDayKey(key) {
	if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
	const [year, month, day] = key.split("-").map((item) => parseInt(item, 10));
	if (month < 1 || month > 12 || day < 1 || day > 31) return false;
	const d = new Date(year, month - 1, day);
	return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
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
export { isUnsafeKey as a, localDay as c, isPeakHour as i, localTimeHM as l, isChinaHoliday as n, isValidDayKey as o, isExtraOffDay as r, isWeekendDay as s, esc as t, CN_HOLIDAY_COVERAGE_LABEL as u };
