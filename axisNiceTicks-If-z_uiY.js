import { At as indexOf, Bt as isString, Ct as each$1, Et as filter, Ft as isFunction, Gt as map, Ht as isTypedArray, Jt as noop, Kt as merge, Mt as isArray, Ot as guid, Qt as retrieve2, Rt as isNumber, Tt as extend, Ut as keys, V as BoundingRect, _t as clone, an as platformApi, cn as __exportAll, d as DARK_MODE_THRESHOLD, en as setAsPrimitive, ft as LRU, gt as bind, ht as assert, m as Animator, on as setPlatformAPI, p as Eventful, pt as env, q as dist$1, qt as mixin, r as Path, sn as __extends, t as ZRImage, v as lum, xt as defaults, y as modifyHSL, yt as createHashMap, zt as isObject$1 } from "./Image-B5UjBJH1.js";
import { $ as createSymbol, Ar as getAllSelectedIndices, B as getIntervalPrecision, Bt as getUID, C as createAxisLabelsComputingContext, Cr as blurComponent, Dr as enterEmphasis, Ei as setComponentTypeToKeyInfo, Er as enterBlur, Fr as isSelectChangePayload, G as isLogScale, Gi as mathCeil, Gr as ExtensionAPI, Gt as CoordinateSystemManager, H as intervalScaleEnsureValidExtent, Hn as retrieveZInfo, I as updateIntervalOrLogScaleForNiceOrAligned, Ir as leaveBlur, It as isCanvasEl, Jn as isElementRemoved, K as isOrdinalScale, Ki as mathFloor, Kn as traverseUpdateZ, Lr as leaveEmphasis, Lt as transformCoordWithViewport, Mr as handleGlobalMouseOverForHighDown, Mt as SYSTEM_LANG, Nr as isHighDownDispatcher, Nt as createLocaleObject, Or as enterSelect, Pi as getLeastCommonMultiple, Pr as isHighDownPayload, R as calcNiceForTimeScale, Rr as leaveSelect, S as createAxisLabels, Sr as allLeaveBlur, Ti as setAttribute, Ui as linearMap, Ur as toggleSelectionFromPayload, W as isIntervalScale, Wr as updateSeriesElementSelection, Xi as nice, Y as getScaleLinearSpanEffective, Z as ChartView, Zr as getECData, _i as mappingToExists, _r as SELECT_ACTION_TYPE, a as throttle, ai as getAttribute, b as AxisTickLabelComputingKind, bi as preParseFinder, br as TOGGLE_SELECT_ACTION_TYPE, ca as ZRText, ct as registerExternalTransform, d as calcBandWidth, da as enableClassExtend, di as isComponentIdInternal, dn as resetSourceDefaulter, dt as PaletteMixin, ei as TEXT_STYLE_OPTIONS, fa as enableClassManagement, fn as Model, ft as ComponentModel, gi as makeQueryConditionKindA, gr as HIGHLIGHT_ACTION_TYPE, hi as makeInner, hr as DOWNPLAY_ACTION_TYPE, ir as Arc, ji as addSafe, jr as handleGlobalMouseOutForHighDown, k as getTickValueOutermost, kr as findComponentHighDownDispatchers, la as Rect, lt as createTask, mn as LINE_STYLE_KEY_MAP, n as handleLegacySelectEvents, na as quantity, nt as SeriesModel, o as adoptScaleExtentKindMapping, oa as round, pa as parseClassType, pn as ITEM_STYLE_KEY_MAP, pr as Group, q as isTimeScale, qi as mathMax, ri as createSimpleOverallStageHandler2, s as adoptScaleRawExtentInfoAndPrepare, st as tokens, ti as convertOptionIdName, ua as makeStyleMapper, v as resetCachePerECFullUpdate, vi as normalizeToArray, vr as SELECT_CHANGED_EVENT_TYPE, w as createAxisTicks, wr as blurSeriesFromHighlightPayload, x as calculateCategoryInterval, xi as preparePipelineContext, xr as UNSELECT_ACTION_TYPE, y as resetCachePerECPrepare, yi as parseFinder, z as ensureValidSplitNumber, zr as savePathStates } from "./dataSelectAction-DEGlLCfR.js";
import { r as brushSingle, s as requestAnimationFrame } from "./graphic-2nrt6OCp.js";
//#region node_modules/echarts/lib/coord/Axis.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var NORMALIZED_EXTENT = [0, 1];
/**
* Base class of Axis.
*
* Lifetime: recreate for each main process.
* [NOTICE]: Some caches is stored on the axis instance (e.g., `axisTickLabelBuilder.ts`, `scaleRawExtentInfo.ts`),
*  which is based on this lifetime.
*/
var Axis = function() {
	function Axis(dim, scale, extent) {
		this.onBand = false;
		this.inverse = false;
		this.dim = dim;
		this.scale = scale;
		this._extent = extent || [0, 0];
	}
	/**
	* If axis extent contain given coord
	*/
	Axis.prototype.contain = function(coord) {
		var extent = this._extent;
		var min = Math.min(extent[0], extent[1]);
		var max = Math.max(extent[0], extent[1]);
		return coord >= min && coord <= max;
	};
	/**
	* If axis extent contain given data
	*/
	Axis.prototype.containData = function(data) {
		return this.scale.contain(this.scale.parse(data));
	};
	/**
	* Get coord extent.
	*/
	Axis.prototype.getExtent = function() {
		return this._extent.slice();
	};
	/**
	* Set coord extent
	*/
	Axis.prototype.setExtent = function(start, end) {
		var extent = this._extent;
		extent[0] = start;
		extent[1] = end;
	};
	/**
	* Convert data to coord. Data is the rank if it has an ordinal scale
	*/
	Axis.prototype.dataToCoord = function(data, clamp) {
		var scale = this.scale;
		data = scale.normalize(scale.parse(data));
		return linearMap(data, NORMALIZED_EXTENT, makeExtentWithBands(this), clamp);
	};
	/**
	* Convert coord to data. Data is the rank if it has an ordinal scale
	*/
	Axis.prototype.coordToData = function(coord, clamp) {
		var t = linearMap(coord, makeExtentWithBands(this), NORMALIZED_EXTENT, clamp);
		return this.scale.scale(t);
	};
	/**
	* Convert pixel point to data in axis
	*/
	Axis.prototype.pointToData = function(point, clamp) {};
	/**
	* Different from `zrUtil.map(axis.getTicks(), axis.dataToCoord, axis)`,
	* `axis.getTicksCoords` considers `onBand`, which is used by
	* `boundaryGap:true` of category axis and splitLine and splitArea.
	* @param opt.tickModel default: axis.model.getModel('axisTick')
	*/
	Axis.prototype.getTicksCoords = function(opt) {
		opt = opt || {};
		var tickModel = opt.tickModel || this.getTickModel();
		var result = createAxisTicks(this, tickModel, {
			breakTicks: opt.breakTicks,
			pruneByBreak: opt.pruneByBreak
		});
		var preTicksCoords = map(result.ticks, function(tick) {
			return {
				coord: this.dataToCoord(getTickValueOutermost(this.scale, tick)),
				tick
			};
		}, this);
		var alignWithLabel = tickModel.get("alignWithLabel");
		var onBandModified = fixOnBandTicksCoords(this, preTicksCoords, alignWithLabel);
		return map(preTicksCoords, function(item) {
			return {
				coord: item.coord,
				tickValue: item.tick.value,
				onBand: onBandModified
			};
		});
	};
	Axis.prototype.getMinorTicksCoords = function() {
		if (isOrdinalScale(this.scale)) return [];
		var splitNumber = this.model.getModel("minorTick").get("splitNumber");
		if (!(splitNumber > 0 && splitNumber < 100)) splitNumber = 5;
		var minorTicks = this.scale.getMinorTicks(splitNumber);
		return map(minorTicks, function(minorTicksGroup) {
			return map(minorTicksGroup, function(minorTick) {
				return {
					coord: this.dataToCoord(minorTick),
					tickValue: minorTick
				};
			}, this);
		}, this);
	};
	Axis.prototype.getViewLabels = function(ctx) {
		ctx = ctx || createAxisLabelsComputingContext(AxisTickLabelComputingKind.determine);
		return createAxisLabels(this, ctx).labels;
	};
	Axis.prototype.getLabelModel = function() {
		return this.model.getModel("axisLabel");
	};
	/**
	* Notice here we only get the default tick model. For splitLine
	* or splitArea, we should pass the splitLineModel or splitAreaModel
	* manually when calling `getTicksCoords`.
	* In GL, this method may be overridden to:
	* `axisModel.getModel('axisTick', grid3DModel.getModel('axisTick'));`
	*/
	Axis.prototype.getTickModel = function() {
		return this.model.getModel("axisTick");
	};
	/**
	* @deprecated Use `calcBandWidth` instead.
	*/
	Axis.prototype.getBandWidth = function() {
		return calcBandWidth(this, { min: 1 }).w;
	};
	/**
	* Only be called in category axis.
	* Can be overridden, consider other axes like in 3D.
	* @return Auto interval for category axis tick and label
	*/
	Axis.prototype.calculateCategoryInterval = function(ctx) {
		ctx = ctx || createAxisLabelsComputingContext(AxisTickLabelComputingKind.determine);
		return calculateCategoryInterval(this, ctx);
	};
	return Axis;
}();
function makeExtentWithBands(axis) {
	var extent = axis.getExtent();
	if (axis.onBand) {
		var margin = (extent[1] - extent[0]) / axis.scale.count() / 2;
		extent[0] += margin;
		extent[1] -= margin;
	}
	return extent;
}
/**
* `axis.onBand: true` (i.e., `boundaryGap: true` in ec option) and `CategoryTickLabelSplitIntervalOption`
*  affects `axisTick`/`axisLabel`/`splitLine`/`splitArea`.
*
* Currently, the visual result is best only when `axisTick/splitLine/splitArea.interval === 0`.
* The typical case is:
*      |---|---|---|     <= This is the input `preTicksCoords`
*      0   1   2   3        (having been added half band width by `makeExtentWithBands`).
*    |---|---|---|---|  <= This is the result.
*      0   1   2   3
*
* When `interval > 0`, the visual result may be odd for `axisLabel` and `customValues`, but acceptable
* for `axisTick` `splitLine` and `splitArea`:
*      |---~---|---~---~---|---|    <= This is the input `preTicksCoords`; `interval: 2; min: 1; max: 7`.
*      ₁   ₂   3   ₄   ₅   6   ₇       Subscript numbers (`₀`, `₁`, `₃`) indicate axis labels are hidden
*                                      (by default settings) due to off-interval.
*                                      A tilde (`~`) indicates a tick ignored due to off-interval.
*    |---~---|---~---~---|---~---|  <= This is the result.
*      ₁   ₂   3   ₄   ₅   6   ₇
*
* NOTE:
*  - A inappropriate result may cause misleading (e.g., split 2 bars of a single data item when there
*    are two bar series).
*  - See also #11176 #11186 .
* PENDING:
*  - The show/hide of `axisLabel` may be optimized when `interval > 1 and be an even number`,
*    but that may introduce complex and still not perfect in odd number, and may not necessary if
*    `axisTick: {show: false}` and `axisLabel` can auto hidden when overlapping.
*/
function fixOnBandTicksCoords(axis, preTicksCoords, alignWithLabel) {
	var ticksLen = preTicksCoords.length;
	if (!axis.onBand || alignWithLabel || !ticksLen) return false;
	var bandWidth = calcBandWidth(axis).w;
	if (!bandWidth) return false;
	each$1(preTicksCoords, function(ticksItem) {
		ticksItem.coord -= bandWidth / 2;
	});
	var dataExtent = axis.scale.getExtent();
	var oldLast = preTicksCoords[ticksLen - 1];
	if (oldLast.tick.offInterval) preTicksCoords.pop();
	preTicksCoords.push({
		coord: oldLast.coord + bandWidth,
		tick: { value: dataExtent[1] + 1 }
	});
	return true;
}
//#endregion
//#region node_modules/zrender/lib/mixin/Draggable.js
var Param = function() {
	function Param(target, e) {
		this.target = target;
		this.topTarget = e && e.topTarget;
	}
	return Param;
}();
var Draggable = function() {
	function Draggable(handler) {
		this.handler = handler;
		handler.on("mousedown", this._dragStart, this);
		handler.on("mousemove", this._drag, this);
		handler.on("mouseup", this._dragEnd, this);
	}
	Draggable.prototype._dragStart = function(e) {
		var draggingTarget = e.target;
		while (draggingTarget && !draggingTarget.draggable) draggingTarget = draggingTarget.parent || draggingTarget.__hostTarget;
		if (draggingTarget) {
			this._draggingTarget = draggingTarget;
			draggingTarget.dragging = true;
			this._x = e.offsetX;
			this._y = e.offsetY;
			this.handler.dispatchToElement(new Param(draggingTarget, e), "dragstart", e.event);
		}
	};
	Draggable.prototype._drag = function(e) {
		var draggingTarget = this._draggingTarget;
		if (draggingTarget) {
			var x = e.offsetX;
			var y = e.offsetY;
			var dx = x - this._x;
			var dy = y - this._y;
			this._x = x;
			this._y = y;
			draggingTarget.drift(dx, dy, e);
			this.handler.dispatchToElement(new Param(draggingTarget, e), "drag", e.event);
			var dropTarget = this.handler.findHover(x, y, draggingTarget).target;
			var lastDropTarget = this._dropTarget;
			this._dropTarget = dropTarget;
			if (draggingTarget !== dropTarget) {
				if (lastDropTarget && dropTarget !== lastDropTarget) this.handler.dispatchToElement(new Param(lastDropTarget, e), "dragleave", e.event);
				if (dropTarget && dropTarget !== lastDropTarget) this.handler.dispatchToElement(new Param(dropTarget, e), "dragenter", e.event);
			}
		}
	};
	Draggable.prototype._dragEnd = function(e) {
		var draggingTarget = this._draggingTarget;
		if (draggingTarget) draggingTarget.dragging = false;
		this.handler.dispatchToElement(new Param(draggingTarget, e), "dragend", e.event);
		if (this._dropTarget) this.handler.dispatchToElement(new Param(this._dropTarget, e), "drop", e.event);
		this._draggingTarget = null;
		this._dropTarget = null;
	};
	return Draggable;
}();
//#endregion
//#region node_modules/zrender/lib/core/event.js
var MOUSE_EVENT_REG = /^(?:mouse|pointer|contextmenu|drag|drop)|click/;
var _calcOut = [];
var firefoxNotSupportOffsetXY = env.browser.firefox && +env.browser.version.split(".")[0] < 39;
function clientToLocal(el, e, out, calculate) {
	out = out || {};
	if (calculate) calculateZrXY(el, e, out);
	else if (firefoxNotSupportOffsetXY && e.layerX != null && e.layerX !== e.offsetX) {
		out.zrX = e.layerX;
		out.zrY = e.layerY;
	} else if (e.offsetX != null) {
		out.zrX = e.offsetX;
		out.zrY = e.offsetY;
	} else calculateZrXY(el, e, out);
	return out;
}
function calculateZrXY(el, e, out) {
	if (env.domSupported && el.getBoundingClientRect) {
		var ex = e.clientX;
		var ey = e.clientY;
		if (isCanvasEl(el)) {
			var box = el.getBoundingClientRect();
			out.zrX = ex - box.left;
			out.zrY = ey - box.top;
			return;
		} else if (transformCoordWithViewport(_calcOut, el, ex, ey)) {
			out.zrX = _calcOut[0];
			out.zrY = _calcOut[1];
			return;
		}
	}
	out.zrX = out.zrY = 0;
}
function getNativeEvent(e) {
	return e || window.event;
}
function normalizeEvent(el, e, calculate) {
	e = getNativeEvent(e);
	if (e.zrX != null) return e;
	var eventType = e.type;
	if (!(eventType && eventType.indexOf("touch") >= 0)) {
		clientToLocal(el, e, e, calculate);
		var wheelDelta = getWheelDeltaMayPolyfill(e);
		e.zrDelta = wheelDelta ? wheelDelta / 120 : -(e.detail || 0) / 3;
	} else {
		var touch = eventType !== "touchend" ? e.targetTouches[0] : e.changedTouches[0];
		touch && clientToLocal(el, touch, e, calculate);
	}
	var button = e.button;
	if (e.which == null && button !== void 0 && MOUSE_EVENT_REG.test(e.type)) e.which = button & 1 ? 1 : button & 2 ? 3 : button & 4 ? 2 : 0;
	return e;
}
function getWheelDeltaMayPolyfill(e) {
	var rawWheelDelta = e.wheelDelta;
	if (rawWheelDelta) return rawWheelDelta;
	var deltaX = e.deltaX;
	var deltaY = e.deltaY;
	if (deltaX == null || deltaY == null) return rawWheelDelta;
	var delta = deltaY !== 0 ? Math.abs(deltaY) : Math.abs(deltaX);
	var sign = deltaY > 0 ? -1 : deltaY < 0 ? 1 : deltaX > 0 ? -1 : 1;
	return 3 * delta * sign;
}
function addEventListener(el, name, handler, opt) {
	el.addEventListener(name, handler, opt);
}
function removeEventListener(el, name, handler, opt) {
	el.removeEventListener(name, handler, opt);
}
var stop = function(e) {
	e.preventDefault();
	e.stopPropagation();
	e.cancelBubble = true;
};
//#endregion
//#region node_modules/zrender/lib/core/GestureMgr.js
var GestureMgr = function() {
	function GestureMgr() {
		this._track = [];
	}
	GestureMgr.prototype.recognize = function(event, target, root) {
		this._doTrack(event, target, root);
		return this._recognize(event);
	};
	GestureMgr.prototype.clear = function() {
		this._track.length = 0;
		return this;
	};
	GestureMgr.prototype._doTrack = function(event, target, root) {
		var touches = event.touches;
		if (!touches) return;
		var trackItem = {
			points: [],
			touches: [],
			target,
			event
		};
		for (var i = 0, len = touches.length; i < len; i++) {
			var touch = touches[i];
			var pos = clientToLocal(root, touch, {});
			trackItem.points.push([pos.zrX, pos.zrY]);
			trackItem.touches.push(touch);
		}
		this._track.push(trackItem);
	};
	GestureMgr.prototype._recognize = function(event) {
		for (var eventName in recognizers) if (recognizers.hasOwnProperty(eventName)) {
			var gestureInfo = recognizers[eventName](this._track, event);
			if (gestureInfo) return gestureInfo;
		}
	};
	return GestureMgr;
}();
function dist(pointPair) {
	var dx = pointPair[1][0] - pointPair[0][0];
	var dy = pointPair[1][1] - pointPair[0][1];
	return Math.sqrt(dx * dx + dy * dy);
}
function center(pointPair) {
	return [(pointPair[0][0] + pointPair[1][0]) / 2, (pointPair[0][1] + pointPair[1][1]) / 2];
}
var recognizers = { pinch: function(tracks, event) {
	var trackLen = tracks.length;
	if (!trackLen) return;
	var pinchEnd = (tracks[trackLen - 1] || {}).points;
	var pinchPre = (tracks[trackLen - 2] || {}).points || pinchEnd;
	if (pinchPre && pinchPre.length > 1 && pinchEnd && pinchEnd.length > 1) {
		var pinchScale = dist(pinchEnd) / dist(pinchPre);
		!isFinite(pinchScale) && (pinchScale = 1);
		event.pinchScale = pinchScale;
		var pinchCenter = center(pinchEnd);
		event.pinchX = pinchCenter[0];
		event.pinchY = pinchCenter[1];
		return {
			type: "pinch",
			target: tracks[0].target,
			event
		};
	}
} };
//#endregion
//#region node_modules/zrender/lib/Handler.js
var SILENT = "silent";
function makeEventPacket(eveType, targetInfo, event) {
	return {
		type: eveType,
		event,
		target: targetInfo.target,
		topTarget: targetInfo.topTarget,
		cancelBubble: false,
		offsetX: event.zrX,
		offsetY: event.zrY,
		gestureEvent: event.gestureEvent,
		pinchX: event.pinchX,
		pinchY: event.pinchY,
		pinchScale: event.pinchScale,
		wheelDelta: event.zrDelta,
		zrByTouch: event.zrByTouch,
		which: event.which,
		stop: stopEvent
	};
}
function stopEvent() {
	stop(this.event);
}
var EmptyProxy = function(_super) {
	__extends(EmptyProxy, _super);
	function EmptyProxy() {
		var _this = _super !== null && _super.apply(this, arguments) || this;
		_this.handler = null;
		return _this;
	}
	EmptyProxy.prototype.dispose = function() {};
	EmptyProxy.prototype.setCursor = function() {};
	return EmptyProxy;
}(Eventful);
var HoveredResult = function() {
	function HoveredResult(x, y) {
		this.x = x;
		this.y = y;
	}
	return HoveredResult;
}();
var handlerNames = [
	"click",
	"dblclick",
	"mousewheel",
	"mouseout",
	"mouseup",
	"mousedown",
	"mousemove",
	"contextmenu"
];
var tmpRect = new BoundingRect(0, 0, 0, 0);
var Handler = function(_super) {
	__extends(Handler, _super);
	function Handler(storage, painter, proxy, painterRoot, pointerSize) {
		var _this = _super.call(this) || this;
		_this._hovered = new HoveredResult(0, 0);
		_this.storage = storage;
		_this.painter = painter;
		_this.painterRoot = painterRoot;
		_this._pointerSize = pointerSize;
		proxy = proxy || new EmptyProxy();
		_this.proxy = null;
		_this.setHandlerProxy(proxy);
		_this._draggingMgr = new Draggable(_this);
		return _this;
	}
	Handler.prototype.setHandlerProxy = function(proxy) {
		if (this.proxy) this.proxy.dispose();
		if (proxy) {
			each$1(handlerNames, function(name) {
				proxy.on && proxy.on(name, this[name], this);
			}, this);
			proxy.handler = this;
		}
		this.proxy = proxy;
	};
	Handler.prototype.mousemove = function(event) {
		var x = event.zrX;
		var y = event.zrY;
		var isOutside = isOutsideBoundary(this, x, y);
		var lastHovered = this._hovered;
		var lastHoveredTarget = lastHovered.target;
		if (lastHoveredTarget && !lastHoveredTarget.__zr) {
			lastHovered = this.findHover(lastHovered.x, lastHovered.y);
			lastHoveredTarget = lastHovered.target;
		}
		var hovered = this._hovered = isOutside ? new HoveredResult(x, y) : this.findHover(x, y);
		var hoveredTarget = hovered.target;
		var proxy = this.proxy;
		proxy.setCursor && proxy.setCursor(hoveredTarget ? hoveredTarget.cursor : "default");
		if (lastHoveredTarget && hoveredTarget !== lastHoveredTarget) this.dispatchToElement(lastHovered, "mouseout", event);
		this.dispatchToElement(hovered, "mousemove", event);
		if (hoveredTarget && hoveredTarget !== lastHoveredTarget) this.dispatchToElement(hovered, "mouseover", event);
	};
	Handler.prototype.mouseout = function(event) {
		var eventControl = event.zrEventControl;
		if (eventControl !== "only_globalout") this.dispatchToElement(this._hovered, "mouseout", event);
		if (eventControl !== "no_globalout") this.trigger("globalout", {
			type: "globalout",
			event
		});
	};
	Handler.prototype.resize = function() {
		this._hovered = new HoveredResult(0, 0);
	};
	Handler.prototype.dispatch = function(eventName, eventArgs) {
		var handler = this[eventName];
		handler && handler.call(this, eventArgs);
	};
	Handler.prototype.dispose = function() {
		this.proxy.dispose();
		this.storage = null;
		this.proxy = null;
		this.painter = null;
	};
	Handler.prototype.setCursorStyle = function(cursorStyle) {
		var proxy = this.proxy;
		proxy.setCursor && proxy.setCursor(cursorStyle);
	};
	Handler.prototype.dispatchToElement = function(targetInfo, eventName, event) {
		targetInfo = targetInfo || {};
		var el = targetInfo.target;
		if (el && el.silent) return;
		var eventKey = "on" + eventName;
		var eventPacket = makeEventPacket(eventName, targetInfo, event);
		while (el) {
			el[eventKey] && (eventPacket.cancelBubble = !!el[eventKey].call(el, eventPacket));
			el.trigger(eventName, eventPacket);
			el = el.__hostTarget ? el.__hostTarget : el.parent;
			if (eventPacket.cancelBubble) break;
		}
		if (!eventPacket.cancelBubble) {
			this.trigger(eventName, eventPacket);
			if (this.painter && this.painter.eachOtherLayer) this.painter.eachOtherLayer(function(layer) {
				if (typeof layer[eventKey] === "function") layer[eventKey].call(layer, eventPacket);
				if (layer.trigger) layer.trigger(eventName, eventPacket);
			});
		}
	};
	Handler.prototype.findHover = function(x, y, exclude) {
		var list = this.storage.getDisplayList();
		var out = new HoveredResult(x, y);
		setHoverTarget(list, out, x, y, exclude);
		if (this._pointerSize && !out.target) {
			var candidates = [];
			var pointerSize = this._pointerSize;
			var targetSizeHalf = pointerSize / 2;
			var pointerRect = new BoundingRect(x - targetSizeHalf, y - targetSizeHalf, pointerSize, pointerSize);
			for (var i = list.length - 1; i >= 0; i--) {
				var el = list[i];
				if (el !== exclude && !el.ignore && !el.ignoreCoarsePointer && (!el.parent || !el.parent.ignoreCoarsePointer)) {
					tmpRect.copy(el.getBoundingRect());
					if (el.transform) tmpRect.applyTransform(el.transform);
					if (tmpRect.intersect(pointerRect)) candidates.push(el);
				}
			}
			if (candidates.length) {
				var rStep = 4;
				var thetaStep = Math.PI / 12;
				var PI2 = Math.PI * 2;
				for (var r = 0; r < targetSizeHalf; r += rStep) for (var theta = 0; theta < PI2; theta += thetaStep) {
					setHoverTarget(candidates, out, x + r * Math.cos(theta), y + r * Math.sin(theta), exclude);
					if (out.target) return out;
				}
			}
		}
		return out;
	};
	Handler.prototype.processGesture = function(event, stage) {
		if (!this._gestureMgr) this._gestureMgr = new GestureMgr();
		var gestureMgr = this._gestureMgr;
		stage === "start" && gestureMgr.clear();
		var gestureInfo = gestureMgr.recognize(event, this.findHover(event.zrX, event.zrY, null).target, this.proxy.dom);
		stage === "end" && gestureMgr.clear();
		if (gestureInfo) {
			var type = gestureInfo.type;
			event.gestureEvent = type;
			var res = new HoveredResult();
			res.target = gestureInfo.target;
			this.dispatchToElement(res, type, gestureInfo.event);
		}
	};
	return Handler;
}(Eventful);
each$1([
	"click",
	"mousedown",
	"mouseup",
	"mousewheel",
	"dblclick",
	"contextmenu"
], function(name) {
	Handler.prototype[name] = function(event) {
		var x = event.zrX;
		var y = event.zrY;
		var isOutside = isOutsideBoundary(this, x, y);
		var hovered;
		var hoveredTarget;
		if (name !== "mouseup" || !isOutside) {
			hovered = this.findHover(x, y);
			hoveredTarget = hovered.target;
		}
		if (name === "mousedown") {
			this._downEl = hoveredTarget;
			this._downPoint = [event.zrX, event.zrY];
			this._upEl = hoveredTarget;
		} else if (name === "mouseup") this._upEl = hoveredTarget;
		else if (name === "click") {
			if (this._downEl !== this._upEl || !this._downPoint || dist$1(this._downPoint, [event.zrX, event.zrY]) > 4) return;
			this._downPoint = null;
		}
		this.dispatchToElement(hovered, name, event);
	};
});
function isHover(displayable, x, y) {
	if (displayable[displayable.rectHover ? "rectContain" : "contain"](x, y)) {
		var el = displayable;
		var isSilent = void 0;
		var ignoreClip = false;
		while (el) {
			if (el.ignoreClip) ignoreClip = true;
			if (!ignoreClip) {
				var clipPath = el.getClipPath();
				if (clipPath && !clipPath.contain(x, y)) return false;
			}
			if (el.silent) isSilent = true;
			var hostEl = el.__hostTarget;
			el = hostEl ? el.ignoreHostSilent ? null : hostEl : el.parent;
		}
		return isSilent ? SILENT : true;
	}
	return false;
}
function setHoverTarget(list, out, x, y, exclude) {
	for (var i = list.length - 1; i >= 0; i--) {
		var el = list[i];
		var hoverCheckResult = void 0;
		if (el !== exclude && !el.ignore && (hoverCheckResult = isHover(el, x, y))) {
			!out.topTarget && (out.topTarget = el);
			if (hoverCheckResult !== SILENT) {
				out.target = el;
				break;
			}
		}
	}
}
function isOutsideBoundary(handlerInstance, x, y) {
	var painter = handlerInstance.painter;
	return x < 0 || x > painter.getWidth() || y < 0 || y > painter.getHeight();
}
//#endregion
//#region node_modules/zrender/lib/core/timsort.js
var DEFAULT_MIN_MERGE = 32;
var DEFAULT_MIN_GALLOPING = 7;
function minRunLength(n) {
	var r = 0;
	while (n >= DEFAULT_MIN_MERGE) {
		r |= n & 1;
		n >>= 1;
	}
	return n + r;
}
function makeAscendingRun(array, lo, hi, compare) {
	var runHi = lo + 1;
	if (runHi === hi) return 1;
	if (compare(array[runHi++], array[lo]) < 0) {
		while (runHi < hi && compare(array[runHi], array[runHi - 1]) < 0) runHi++;
		reverseRun(array, lo, runHi);
	} else while (runHi < hi && compare(array[runHi], array[runHi - 1]) >= 0) runHi++;
	return runHi - lo;
}
function reverseRun(array, lo, hi) {
	hi--;
	while (lo < hi) {
		var t = array[lo];
		array[lo++] = array[hi];
		array[hi--] = t;
	}
}
function binaryInsertionSort(array, lo, hi, start, compare) {
	if (start === lo) start++;
	for (; start < hi; start++) {
		var pivot = array[start];
		var left = lo;
		var right = start;
		var mid;
		while (left < right) {
			mid = left + right >>> 1;
			if (compare(pivot, array[mid]) < 0) right = mid;
			else left = mid + 1;
		}
		var n = start - left;
		switch (n) {
			case 3: array[left + 3] = array[left + 2];
			case 2: array[left + 2] = array[left + 1];
			case 1:
				array[left + 1] = array[left];
				break;
			default: while (n > 0) {
				array[left + n] = array[left + n - 1];
				n--;
			}
		}
		array[left] = pivot;
	}
}
function gallopLeft(value, array, start, length, hint, compare) {
	var lastOffset = 0;
	var maxOffset = 0;
	var offset = 1;
	if (compare(value, array[start + hint]) > 0) {
		maxOffset = length - hint;
		while (offset < maxOffset && compare(value, array[start + hint + offset]) > 0) {
			lastOffset = offset;
			offset = (offset << 1) + 1;
			if (offset <= 0) offset = maxOffset;
		}
		if (offset > maxOffset) offset = maxOffset;
		lastOffset += hint;
		offset += hint;
	} else {
		maxOffset = hint + 1;
		while (offset < maxOffset && compare(value, array[start + hint - offset]) <= 0) {
			lastOffset = offset;
			offset = (offset << 1) + 1;
			if (offset <= 0) offset = maxOffset;
		}
		if (offset > maxOffset) offset = maxOffset;
		var tmp = lastOffset;
		lastOffset = hint - offset;
		offset = hint - tmp;
	}
	lastOffset++;
	while (lastOffset < offset) {
		var m = lastOffset + (offset - lastOffset >>> 1);
		if (compare(value, array[start + m]) > 0) lastOffset = m + 1;
		else offset = m;
	}
	return offset;
}
function gallopRight(value, array, start, length, hint, compare) {
	var lastOffset = 0;
	var maxOffset = 0;
	var offset = 1;
	if (compare(value, array[start + hint]) < 0) {
		maxOffset = hint + 1;
		while (offset < maxOffset && compare(value, array[start + hint - offset]) < 0) {
			lastOffset = offset;
			offset = (offset << 1) + 1;
			if (offset <= 0) offset = maxOffset;
		}
		if (offset > maxOffset) offset = maxOffset;
		var tmp = lastOffset;
		lastOffset = hint - offset;
		offset = hint - tmp;
	} else {
		maxOffset = length - hint;
		while (offset < maxOffset && compare(value, array[start + hint + offset]) >= 0) {
			lastOffset = offset;
			offset = (offset << 1) + 1;
			if (offset <= 0) offset = maxOffset;
		}
		if (offset > maxOffset) offset = maxOffset;
		lastOffset += hint;
		offset += hint;
	}
	lastOffset++;
	while (lastOffset < offset) {
		var m = lastOffset + (offset - lastOffset >>> 1);
		if (compare(value, array[start + m]) < 0) offset = m;
		else lastOffset = m + 1;
	}
	return offset;
}
function TimSort(array, compare) {
	var minGallop = DEFAULT_MIN_GALLOPING;
	var runStart;
	var runLength;
	var stackSize = 0;
	var tmp = [];
	runStart = [];
	runLength = [];
	function pushRun(_runStart, _runLength) {
		runStart[stackSize] = _runStart;
		runLength[stackSize] = _runLength;
		stackSize += 1;
	}
	function mergeRuns() {
		while (stackSize > 1) {
			var n = stackSize - 2;
			if (n >= 1 && runLength[n - 1] <= runLength[n] + runLength[n + 1] || n >= 2 && runLength[n - 2] <= runLength[n] + runLength[n - 1]) {
				if (runLength[n - 1] < runLength[n + 1]) n--;
			} else if (runLength[n] > runLength[n + 1]) break;
			mergeAt(n);
		}
	}
	function forceMergeRuns() {
		while (stackSize > 1) {
			var n = stackSize - 2;
			if (n > 0 && runLength[n - 1] < runLength[n + 1]) n--;
			mergeAt(n);
		}
	}
	function mergeAt(i) {
		var start1 = runStart[i];
		var length1 = runLength[i];
		var start2 = runStart[i + 1];
		var length2 = runLength[i + 1];
		runLength[i] = length1 + length2;
		if (i === stackSize - 3) {
			runStart[i + 1] = runStart[i + 2];
			runLength[i + 1] = runLength[i + 2];
		}
		stackSize--;
		var k = gallopRight(array[start2], array, start1, length1, 0, compare);
		start1 += k;
		length1 -= k;
		if (length1 === 0) return;
		length2 = gallopLeft(array[start1 + length1 - 1], array, start2, length2, length2 - 1, compare);
		if (length2 === 0) return;
		if (length1 <= length2) mergeLow(start1, length1, start2, length2);
		else mergeHigh(start1, length1, start2, length2);
	}
	function mergeLow(start1, length1, start2, length2) {
		var i = 0;
		for (i = 0; i < length1; i++) tmp[i] = array[start1 + i];
		var cursor1 = 0;
		var cursor2 = start2;
		var dest = start1;
		array[dest++] = array[cursor2++];
		if (--length2 === 0) {
			for (i = 0; i < length1; i++) array[dest + i] = tmp[cursor1 + i];
			return;
		}
		if (length1 === 1) {
			for (i = 0; i < length2; i++) array[dest + i] = array[cursor2 + i];
			array[dest + length2] = tmp[cursor1];
			return;
		}
		var _minGallop = minGallop;
		var count1;
		var count2;
		var exit;
		while (1) {
			count1 = 0;
			count2 = 0;
			exit = false;
			do
				if (compare(array[cursor2], tmp[cursor1]) < 0) {
					array[dest++] = array[cursor2++];
					count2++;
					count1 = 0;
					if (--length2 === 0) {
						exit = true;
						break;
					}
				} else {
					array[dest++] = tmp[cursor1++];
					count1++;
					count2 = 0;
					if (--length1 === 1) {
						exit = true;
						break;
					}
				}
			while ((count1 | count2) < _minGallop);
			if (exit) break;
			do {
				count1 = gallopRight(array[cursor2], tmp, cursor1, length1, 0, compare);
				if (count1 !== 0) {
					for (i = 0; i < count1; i++) array[dest + i] = tmp[cursor1 + i];
					dest += count1;
					cursor1 += count1;
					length1 -= count1;
					if (length1 <= 1) {
						exit = true;
						break;
					}
				}
				array[dest++] = array[cursor2++];
				if (--length2 === 0) {
					exit = true;
					break;
				}
				count2 = gallopLeft(tmp[cursor1], array, cursor2, length2, 0, compare);
				if (count2 !== 0) {
					for (i = 0; i < count2; i++) array[dest + i] = array[cursor2 + i];
					dest += count2;
					cursor2 += count2;
					length2 -= count2;
					if (length2 === 0) {
						exit = true;
						break;
					}
				}
				array[dest++] = tmp[cursor1++];
				if (--length1 === 1) {
					exit = true;
					break;
				}
				_minGallop--;
			} while (count1 >= DEFAULT_MIN_GALLOPING || count2 >= DEFAULT_MIN_GALLOPING);
			if (exit) break;
			if (_minGallop < 0) _minGallop = 0;
			_minGallop += 2;
		}
		minGallop = _minGallop;
		minGallop < 1 && (minGallop = 1);
		if (length1 === 1) {
			for (i = 0; i < length2; i++) array[dest + i] = array[cursor2 + i];
			array[dest + length2] = tmp[cursor1];
		} else if (length1 === 0) throw new Error();
		else for (i = 0; i < length1; i++) array[dest + i] = tmp[cursor1 + i];
	}
	function mergeHigh(start1, length1, start2, length2) {
		var i = 0;
		for (i = 0; i < length2; i++) tmp[i] = array[start2 + i];
		var cursor1 = start1 + length1 - 1;
		var cursor2 = length2 - 1;
		var dest = start2 + length2 - 1;
		var customCursor = 0;
		var customDest = 0;
		array[dest--] = array[cursor1--];
		if (--length1 === 0) {
			customCursor = dest - (length2 - 1);
			for (i = 0; i < length2; i++) array[customCursor + i] = tmp[i];
			return;
		}
		if (length2 === 1) {
			dest -= length1;
			cursor1 -= length1;
			customDest = dest + 1;
			customCursor = cursor1 + 1;
			for (i = length1 - 1; i >= 0; i--) array[customDest + i] = array[customCursor + i];
			array[dest] = tmp[cursor2];
			return;
		}
		var _minGallop = minGallop;
		while (true) {
			var count1 = 0;
			var count2 = 0;
			var exit = false;
			do
				if (compare(tmp[cursor2], array[cursor1]) < 0) {
					array[dest--] = array[cursor1--];
					count1++;
					count2 = 0;
					if (--length1 === 0) {
						exit = true;
						break;
					}
				} else {
					array[dest--] = tmp[cursor2--];
					count2++;
					count1 = 0;
					if (--length2 === 1) {
						exit = true;
						break;
					}
				}
			while ((count1 | count2) < _minGallop);
			if (exit) break;
			do {
				count1 = length1 - gallopRight(tmp[cursor2], array, start1, length1, length1 - 1, compare);
				if (count1 !== 0) {
					dest -= count1;
					cursor1 -= count1;
					length1 -= count1;
					customDest = dest + 1;
					customCursor = cursor1 + 1;
					for (i = count1 - 1; i >= 0; i--) array[customDest + i] = array[customCursor + i];
					if (length1 === 0) {
						exit = true;
						break;
					}
				}
				array[dest--] = tmp[cursor2--];
				if (--length2 === 1) {
					exit = true;
					break;
				}
				count2 = length2 - gallopLeft(array[cursor1], tmp, 0, length2, length2 - 1, compare);
				if (count2 !== 0) {
					dest -= count2;
					cursor2 -= count2;
					length2 -= count2;
					customDest = dest + 1;
					customCursor = cursor2 + 1;
					for (i = 0; i < count2; i++) array[customDest + i] = tmp[customCursor + i];
					if (length2 <= 1) {
						exit = true;
						break;
					}
				}
				array[dest--] = array[cursor1--];
				if (--length1 === 0) {
					exit = true;
					break;
				}
				_minGallop--;
			} while (count1 >= DEFAULT_MIN_GALLOPING || count2 >= DEFAULT_MIN_GALLOPING);
			if (exit) break;
			if (_minGallop < 0) _minGallop = 0;
			_minGallop += 2;
		}
		minGallop = _minGallop;
		if (minGallop < 1) minGallop = 1;
		if (length2 === 1) {
			dest -= length1;
			cursor1 -= length1;
			customDest = dest + 1;
			customCursor = cursor1 + 1;
			for (i = length1 - 1; i >= 0; i--) array[customDest + i] = array[customCursor + i];
			array[dest] = tmp[cursor2];
		} else if (length2 === 0) throw new Error();
		else {
			customCursor = dest - (length2 - 1);
			for (i = 0; i < length2; i++) array[customCursor + i] = tmp[i];
		}
	}
	return {
		mergeRuns,
		forceMergeRuns,
		pushRun
	};
}
function sort(array, compare, lo, hi) {
	if (!lo) lo = 0;
	if (!hi) hi = array.length;
	var remaining = hi - lo;
	if (remaining < 2) return;
	var runLength = 0;
	if (remaining < DEFAULT_MIN_MERGE) {
		runLength = makeAscendingRun(array, lo, hi, compare);
		binaryInsertionSort(array, lo, hi, lo + runLength, compare);
		return;
	}
	var ts = TimSort(array, compare);
	var minRun = minRunLength(remaining);
	do {
		runLength = makeAscendingRun(array, lo, hi, compare);
		if (runLength < minRun) {
			var force = remaining;
			if (force > minRun) force = minRun;
			binaryInsertionSort(array, lo, lo + force, lo + runLength, compare);
			runLength = force;
		}
		ts.pushRun(lo, runLength);
		ts.mergeRuns();
		remaining -= runLength;
		lo += runLength;
	} while (remaining !== 0);
	ts.forceMergeRuns();
}
//#endregion
//#region node_modules/zrender/lib/Storage.js
var invalidZErrorLogged = false;
function logInvalidZError() {
	if (invalidZErrorLogged) return;
	invalidZErrorLogged = true;
	console.warn("z / z2 / zlevel of displayable is invalid, which may cause unexpected errors");
}
function shapeCompareFunc(a, b) {
	if (a.zlevel === b.zlevel) {
		if (a.z === b.z) return a.z2 - b.z2;
		return a.z - b.z;
	}
	return a.zlevel - b.zlevel;
}
var Storage = function() {
	function Storage() {
		this._roots = [];
		this._displayList = [];
		this._displayListLen = 0;
		this.displayableSortFunc = shapeCompareFunc;
	}
	Storage.prototype.traverse = function(cb, context) {
		for (var i = 0; i < this._roots.length; i++) this._roots[i].traverse(cb, context);
	};
	Storage.prototype.getDisplayList = function(update, includeIgnore) {
		includeIgnore = includeIgnore || false;
		var displayList = this._displayList;
		if (update || !displayList.length) this.updateDisplayList(includeIgnore);
		return displayList;
	};
	Storage.prototype.updateDisplayList = function(includeIgnore) {
		this._displayListLen = 0;
		var roots = this._roots;
		var displayList = this._displayList;
		for (var i = 0, len = roots.length; i < len; i++) this._updateAndAddDisplayable(roots[i], null, includeIgnore);
		displayList.length = this._displayListLen;
		sort(displayList, shapeCompareFunc);
	};
	Storage.prototype._updateAndAddDisplayable = function(el, parentClipPaths, includeIgnore) {
		if (el.ignore && !includeIgnore) return;
		el.beforeUpdate();
		el.update();
		el.afterUpdate();
		var userSetClipPath = el.getClipPath();
		var parentHasClipPaths = parentClipPaths && parentClipPaths.length;
		var clipPathIdx = 0;
		var thisClipPaths = el.__clipPaths;
		if (!el.ignoreClip && (parentHasClipPaths || userSetClipPath)) {
			if (!thisClipPaths) thisClipPaths = el.__clipPaths = [];
			if (parentHasClipPaths) for (var idx = 0; idx < parentClipPaths.length; idx++) thisClipPaths[clipPathIdx++] = parentClipPaths[idx];
			var currentClipPath = userSetClipPath;
			var parentClipPath = el;
			while (currentClipPath) {
				currentClipPath.parent = parentClipPath;
				currentClipPath.updateTransform();
				thisClipPaths[clipPathIdx++] = currentClipPath;
				parentClipPath = currentClipPath;
				currentClipPath = currentClipPath.getClipPath();
			}
		}
		if (thisClipPaths) thisClipPaths.length = clipPathIdx;
		if (el.childrenRef) {
			var children = el.childrenRef();
			for (var i = 0; i < children.length; i++) {
				var child = children[i];
				if (el.__dirty) child.__dirty |= 1;
				this._updateAndAddDisplayable(child, thisClipPaths, includeIgnore);
			}
			el.__dirty = 0;
		} else {
			var disp = el;
			if (isNaN(disp.z)) {
				logInvalidZError();
				disp.z = 0;
			}
			if (isNaN(disp.z2)) {
				logInvalidZError();
				disp.z2 = 0;
			}
			if (isNaN(disp.zlevel)) {
				logInvalidZError();
				disp.zlevel = 0;
			}
			this._displayList[this._displayListLen++] = disp;
		}
		var decalEl = el.getDecalElement && el.getDecalElement();
		if (decalEl) this._updateAndAddDisplayable(decalEl, thisClipPaths, includeIgnore);
		var textGuide = el.getTextGuideLine();
		if (textGuide) this._updateAndAddDisplayable(textGuide, thisClipPaths, includeIgnore);
		var textEl = el.getTextContent();
		if (textEl) this._updateAndAddDisplayable(textEl, thisClipPaths, includeIgnore);
	};
	Storage.prototype.addRoot = function(el) {
		if (el.__zr && el.__zr.storage === this) return;
		this._roots.push(el);
	};
	Storage.prototype.delRoot = function(el) {
		if (el instanceof Array) {
			for (var i = 0, l = el.length; i < l; i++) this.delRoot(el[i]);
			return;
		}
		var idx = indexOf(this._roots, el);
		if (idx >= 0) this._roots.splice(idx, 1);
	};
	Storage.prototype.delAllRoots = function() {
		this._roots = [];
		this._displayList = [];
		this._displayListLen = 0;
	};
	Storage.prototype.getRoots = function() {
		return this._roots;
	};
	Storage.prototype.dispose = function() {
		this._displayList = null;
		this._roots = null;
	};
	return Storage;
}();
//#endregion
//#region node_modules/zrender/lib/animation/Animation.js
function getTime() {
	return (/* @__PURE__ */ new Date()).getTime();
}
var Animation = function(_super) {
	__extends(Animation, _super);
	function Animation(opts) {
		var _this = _super.call(this) || this;
		_this._running = false;
		_this._time = 0;
		_this._pausedTime = 0;
		_this._pauseStart = 0;
		_this._paused = false;
		opts = opts || {};
		_this.stage = opts.stage || {};
		return _this;
	}
	Animation.prototype.addClip = function(clip) {
		if (clip.animation) this.removeClip(clip);
		if (!this._head) this._head = this._tail = clip;
		else {
			this._tail.next = clip;
			clip.prev = this._tail;
			clip.next = null;
			this._tail = clip;
		}
		clip.animation = this;
	};
	Animation.prototype.addAnimator = function(animator) {
		animator.animation = this;
		var clip = animator.getClip();
		if (clip) this.addClip(clip);
	};
	Animation.prototype.removeClip = function(clip) {
		if (!clip.animation) return;
		var prev = clip.prev;
		var next = clip.next;
		if (prev) prev.next = next;
		else this._head = next;
		if (next) next.prev = prev;
		else this._tail = prev;
		clip.next = clip.prev = clip.animation = null;
	};
	Animation.prototype.removeAnimator = function(animator) {
		var clip = animator.getClip();
		if (clip) this.removeClip(clip);
		animator.animation = null;
	};
	Animation.prototype.update = function(notTriggerFrameAndStageUpdate) {
		var time = getTime() - this._pausedTime;
		var delta = time - this._time;
		var clip = this._head;
		while (clip) {
			var nextClip = clip.next;
			if (clip.step(time, delta)) {
				clip.ondestroy();
				this.removeClip(clip);
				clip = nextClip;
			} else clip = nextClip;
		}
		this._time = time;
		if (!notTriggerFrameAndStageUpdate) {
			this.trigger("frame", delta);
			this.stage.update && this.stage.update();
		}
	};
	Animation.prototype._startLoop = function() {
		var self = this;
		this._running = true;
		function step() {
			if (self._running) {
				requestAnimationFrame(step);
				!self._paused && self.update();
			}
		}
		requestAnimationFrame(step);
	};
	Animation.prototype.start = function() {
		if (this._running) return;
		this._time = getTime();
		this._pausedTime = 0;
		this._startLoop();
	};
	Animation.prototype.stop = function() {
		this._running = false;
	};
	Animation.prototype.pause = function() {
		if (!this._paused) {
			this._pauseStart = getTime();
			this._paused = true;
		}
	};
	Animation.prototype.resume = function() {
		if (this._paused) {
			this._pausedTime += getTime() - this._pauseStart;
			this._paused = false;
		}
	};
	Animation.prototype.clear = function() {
		var clip = this._head;
		while (clip) {
			var nextClip = clip.next;
			clip.prev = clip.next = clip.animation = null;
			clip = nextClip;
		}
		this._head = this._tail = null;
	};
	Animation.prototype.isFinished = function() {
		return this._head == null;
	};
	Animation.prototype.animate = function(target, options) {
		options = options || {};
		this.start();
		var animator = new Animator(target, options.loop);
		this.addAnimator(animator);
		return animator;
	};
	return Animation;
}(Eventful);
//#endregion
//#region node_modules/zrender/lib/dom/HandlerProxy.js
var TOUCH_CLICK_DELAY = 300;
var globalEventSupported = env.domSupported;
var localNativeListenerNames = (function() {
	var mouseHandlerNames = [
		"click",
		"dblclick",
		"mousewheel",
		"wheel",
		"mouseout",
		"mouseup",
		"mousedown",
		"mousemove",
		"contextmenu"
	];
	var touchHandlerNames = [
		"touchstart",
		"touchend",
		"touchmove"
	];
	var pointerEventNameMap = {
		pointerdown: 1,
		pointerup: 1,
		pointermove: 1,
		pointerout: 1
	};
	return {
		mouse: mouseHandlerNames,
		touch: touchHandlerNames,
		pointer: map(mouseHandlerNames, function(name) {
			var nm = name.replace("mouse", "pointer");
			return pointerEventNameMap.hasOwnProperty(nm) ? nm : name;
		})
	};
})();
var globalNativeListenerNames = {
	mouse: ["mousemove", "mouseup"],
	pointer: ["pointermove", "pointerup"]
};
var wheelEventSupported = false;
function isPointerFromTouch(event) {
	var pointerType = event.pointerType;
	return pointerType === "pen" || pointerType === "touch";
}
function setTouchTimer(scope) {
	scope.touching = true;
	if (scope.touchTimer != null) {
		clearTimeout(scope.touchTimer);
		scope.touchTimer = null;
	}
	scope.touchTimer = setTimeout(function() {
		scope.touching = false;
		scope.touchTimer = null;
	}, 700);
}
function markTouch(event) {
	event && (event.zrByTouch = true);
}
function normalizeGlobalEvent(instance, event) {
	return normalizeEvent(instance.dom, new FakeGlobalEvent(instance, event), true);
}
function isLocalEl(instance, el) {
	var elTmp = el;
	var isLocal = false;
	while (elTmp && elTmp.nodeType !== 9 && !(isLocal = elTmp.domBelongToZr || elTmp !== el && elTmp === instance.painterRoot)) elTmp = elTmp.parentNode;
	return isLocal;
}
var FakeGlobalEvent = function() {
	function FakeGlobalEvent(instance, event) {
		this.stopPropagation = noop;
		this.stopImmediatePropagation = noop;
		this.preventDefault = noop;
		this.type = event.type;
		this.target = this.currentTarget = instance.dom;
		this.pointerType = event.pointerType;
		this.clientX = event.clientX;
		this.clientY = event.clientY;
	}
	return FakeGlobalEvent;
}();
var localDOMHandlers = {
	mousedown: function(event) {
		event = normalizeEvent(this.dom, event);
		this.__mayPointerCapture = [event.zrX, event.zrY];
		this.trigger("mousedown", event);
	},
	mousemove: function(event) {
		event = normalizeEvent(this.dom, event);
		var downPoint = this.__mayPointerCapture;
		if (downPoint && (event.zrX !== downPoint[0] || event.zrY !== downPoint[1])) this.__togglePointerCapture(true);
		this.trigger("mousemove", event);
	},
	mouseup: function(event) {
		event = normalizeEvent(this.dom, event);
		this.__togglePointerCapture(false);
		this.trigger("mouseup", event);
	},
	mouseout: function(event) {
		event = normalizeEvent(this.dom, event);
		var element = event.toElement || event.relatedTarget;
		if (!isLocalEl(this, element)) {
			if (this.__pointerCapturing) event.zrEventControl = "no_globalout";
			this.trigger("mouseout", event);
		}
	},
	wheel: function(event) {
		wheelEventSupported = true;
		event = normalizeEvent(this.dom, event);
		this.trigger("mousewheel", event);
	},
	mousewheel: function(event) {
		if (wheelEventSupported) return;
		event = normalizeEvent(this.dom, event);
		this.trigger("mousewheel", event);
	},
	touchstart: function(event) {
		event = normalizeEvent(this.dom, event);
		markTouch(event);
		this.__lastTouchMoment = /* @__PURE__ */ new Date();
		this.handler.processGesture(event, "start");
		localDOMHandlers.mousemove.call(this, event);
		localDOMHandlers.mousedown.call(this, event);
	},
	touchmove: function(event) {
		event = normalizeEvent(this.dom, event);
		markTouch(event);
		this.handler.processGesture(event, "change");
		localDOMHandlers.mousemove.call(this, event);
	},
	touchend: function(event) {
		event = normalizeEvent(this.dom, event);
		markTouch(event);
		this.handler.processGesture(event, "end");
		localDOMHandlers.mouseup.call(this, event);
		if (+/* @__PURE__ */ new Date() - +this.__lastTouchMoment < TOUCH_CLICK_DELAY) localDOMHandlers.click.call(this, event);
	},
	pointerdown: function(event) {
		localDOMHandlers.mousedown.call(this, event);
	},
	pointermove: function(event) {
		if (!isPointerFromTouch(event)) localDOMHandlers.mousemove.call(this, event);
	},
	pointerup: function(event) {
		localDOMHandlers.mouseup.call(this, event);
	},
	pointerout: function(event) {
		if (!isPointerFromTouch(event)) localDOMHandlers.mouseout.call(this, event);
	}
};
each$1([
	"click",
	"dblclick",
	"contextmenu"
], function(name) {
	localDOMHandlers[name] = function(event) {
		event = normalizeEvent(this.dom, event);
		this.trigger(name, event);
	};
});
var globalDOMHandlers = {
	pointermove: function(event) {
		if (!isPointerFromTouch(event)) globalDOMHandlers.mousemove.call(this, event);
	},
	pointerup: function(event) {
		globalDOMHandlers.mouseup.call(this, event);
	},
	mousemove: function(event) {
		this.trigger("mousemove", event);
	},
	mouseup: function(event) {
		var pointerCaptureReleasing = this.__pointerCapturing;
		this.__togglePointerCapture(false);
		this.trigger("mouseup", event);
		if (pointerCaptureReleasing) {
			event.zrEventControl = "only_globalout";
			this.trigger("mouseout", event);
		}
	}
};
function mountLocalDOMEventListeners(instance, scope) {
	var domHandlers = scope.domHandlers;
	if (env.pointerEventsSupported) each$1(localNativeListenerNames.pointer, function(nativeEventName) {
		mountSingleDOMEventListener(scope, nativeEventName, function(event) {
			domHandlers[nativeEventName].call(instance, event);
		});
	});
	else {
		if (env.touchEventsSupported) each$1(localNativeListenerNames.touch, function(nativeEventName) {
			mountSingleDOMEventListener(scope, nativeEventName, function(event) {
				domHandlers[nativeEventName].call(instance, event);
				setTouchTimer(scope);
			});
		});
		each$1(localNativeListenerNames.mouse, function(nativeEventName) {
			mountSingleDOMEventListener(scope, nativeEventName, function(event) {
				event = getNativeEvent(event);
				if (!scope.touching) domHandlers[nativeEventName].call(instance, event);
			});
		});
	}
}
function mountGlobalDOMEventListeners(instance, scope) {
	if (env.pointerEventsSupported) each$1(globalNativeListenerNames.pointer, mount);
	else if (!env.touchEventsSupported) each$1(globalNativeListenerNames.mouse, mount);
	function mount(nativeEventName) {
		function nativeEventListener(event) {
			event = getNativeEvent(event);
			if (!isLocalEl(instance, event.target)) {
				event = normalizeGlobalEvent(instance, event);
				scope.domHandlers[nativeEventName].call(instance, event);
			}
		}
		mountSingleDOMEventListener(scope, nativeEventName, nativeEventListener, { capture: true });
	}
}
function mountSingleDOMEventListener(scope, nativeEventName, listener, opt) {
	scope.mounted[nativeEventName] = listener;
	scope.listenerOpts[nativeEventName] = opt;
	addEventListener(scope.domTarget, nativeEventName, listener, opt);
}
function unmountDOMEventListeners(scope) {
	var mounted = scope.mounted;
	for (var nativeEventName in mounted) if (mounted.hasOwnProperty(nativeEventName)) removeEventListener(scope.domTarget, nativeEventName, mounted[nativeEventName], scope.listenerOpts[nativeEventName]);
	scope.mounted = {};
}
var DOMHandlerScope = function() {
	function DOMHandlerScope(domTarget, domHandlers) {
		this.mounted = {};
		this.listenerOpts = {};
		this.touching = false;
		this.domTarget = domTarget;
		this.domHandlers = domHandlers;
	}
	return DOMHandlerScope;
}();
var HandlerDomProxy = function(_super) {
	__extends(HandlerDomProxy, _super);
	function HandlerDomProxy(dom, painterRoot) {
		var _this = _super.call(this) || this;
		_this.__pointerCapturing = false;
		_this.dom = dom;
		_this.painterRoot = painterRoot;
		_this._localHandlerScope = new DOMHandlerScope(dom, localDOMHandlers);
		if (globalEventSupported) _this._globalHandlerScope = new DOMHandlerScope(document, globalDOMHandlers);
		mountLocalDOMEventListeners(_this, _this._localHandlerScope);
		return _this;
	}
	HandlerDomProxy.prototype.dispose = function() {
		unmountDOMEventListeners(this._localHandlerScope);
		if (globalEventSupported) unmountDOMEventListeners(this._globalHandlerScope);
	};
	HandlerDomProxy.prototype.setCursor = function(cursorStyle) {
		this.dom.style && (this.dom.style.cursor = cursorStyle || "default");
	};
	HandlerDomProxy.prototype.__togglePointerCapture = function(isPointerCapturing) {
		this.__mayPointerCapture = null;
		if (globalEventSupported && +this.__pointerCapturing ^ +isPointerCapturing) {
			this.__pointerCapturing = isPointerCapturing;
			var globalHandlerScope = this._globalHandlerScope;
			isPointerCapturing ? mountGlobalDOMEventListeners(this, globalHandlerScope) : unmountDOMEventListeners(globalHandlerScope);
		}
	};
	return HandlerDomProxy;
}(Eventful);
//#endregion
//#region node_modules/zrender/lib/zrender.js
/*!
* ZRender, a high performance 2d drawing library.
*
* Copyright (c) 2013, Baidu Inc.
* All rights reserved.
*
* LICENSE
* https://github.com/ecomfe/zrender/blob/master/LICENSE
*/
var zrender_exports = /* @__PURE__ */ __exportAll({
	dispose: () => dispose$1,
	disposeAll: () => disposeAll,
	getElementSSRData: () => getElementSSRData,
	getInstance: () => getInstance,
	init: () => init$1,
	registerPainter: () => registerPainter,
	registerSSRDataGetter: () => registerSSRDataGetter,
	version: () => version$1
});
var painterCtors = {};
var instances$1 = {};
function delInstance(id) {
	delete instances$1[id];
}
function isDarkMode(backgroundColor) {
	if (!backgroundColor) return false;
	if (typeof backgroundColor === "string") return lum(backgroundColor, 1) < DARK_MODE_THRESHOLD;
	else if (backgroundColor.colorStops) {
		var colorStops = backgroundColor.colorStops;
		var totalLum = 0;
		var len = colorStops.length;
		for (var i = 0; i < len; i++) totalLum += lum(colorStops[i].color, 1);
		totalLum /= len;
		return totalLum < DARK_MODE_THRESHOLD;
	}
	return false;
}
var ZRender = function() {
	function ZRender(id, dom, opts) {
		var _this = this;
		this._sleepAfterStill = 10;
		this._stillFrameAccum = 0;
		this._needsRefresh = true;
		this._needsRefreshHover = false;
		this._darkMode = false;
		opts = opts || {};
		this.dom = dom;
		this.id = id;
		var storage = new Storage();
		var rendererType = opts.renderer || "canvas";
		if (!painterCtors[rendererType]) rendererType = keys(painterCtors)[0];
		opts.useDirtyRect = opts.useDirtyRect == null ? false : opts.useDirtyRect;
		var painter = new painterCtors[rendererType](dom, storage, opts, id);
		var ssrMode = opts.ssr || painter.ssrOnly;
		this.storage = storage;
		this.painter = painter;
		var handlerProxy = !env.node && !env.worker && !ssrMode ? new HandlerDomProxy(painter.getViewportRoot(), painter.root) : null;
		var useCoarsePointer = opts.useCoarsePointer;
		var usePointerSize = useCoarsePointer == null || useCoarsePointer === "auto" ? env.touchEventsSupported : !!useCoarsePointer;
		var defaultPointerSize = 44;
		var pointerSize;
		if (usePointerSize) pointerSize = retrieve2(opts.pointerSize, defaultPointerSize);
		this.handler = new Handler(storage, painter, handlerProxy, painter.root, pointerSize);
		this.animation = new Animation({ stage: { update: ssrMode ? null : function() {
			return _this._flush(false);
		} } });
		if (!ssrMode) this.animation.start();
	}
	ZRender.prototype.add = function(el) {
		if (this._disposed || !el) return;
		this.storage.addRoot(el);
		el.addSelfToZr(this);
		this.refresh();
	};
	ZRender.prototype.remove = function(el) {
		if (this._disposed || !el) return;
		this.storage.delRoot(el);
		el.removeSelfFromZr(this);
		this.refresh();
	};
	ZRender.prototype.configLayer = function(zLevel, config) {
		if (this._disposed) return;
		if (this.painter.configLayer) this.painter.configLayer(zLevel, config);
		this.refresh();
	};
	ZRender.prototype.setBackgroundColor = function(backgroundColor) {
		if (this._disposed) return;
		if (this.painter.setBackgroundColor) this.painter.setBackgroundColor(backgroundColor);
		this.refresh();
		this._backgroundColor = backgroundColor;
		this._darkMode = isDarkMode(backgroundColor);
	};
	ZRender.prototype.getBackgroundColor = function() {
		return this._backgroundColor;
	};
	ZRender.prototype.setDarkMode = function(darkMode) {
		this._darkMode = darkMode;
	};
	ZRender.prototype.isDarkMode = function() {
		return this._darkMode;
	};
	ZRender.prototype.refreshImmediately = function(noAnimationUpdate) {
		if (this._disposed) return;
		this._refresh({
			animUpdate: !noAnimationUpdate,
			refresh: true,
			refreshHover: false
		});
	};
	ZRender.prototype._refresh = function(opt) {
		if (opt.animUpdate) this.animation.update(true);
		this._needsRefresh = this._needsRefreshHover = false;
		this.painter.refresh({
			refresh: opt.refresh,
			refreshHover: opt.refreshHover
		});
		this._needsRefresh = this._needsRefreshHover = false;
	};
	ZRender.prototype.refresh = function() {
		if (this._disposed) return;
		this._needsRefresh = true;
		this.animation.start();
	};
	ZRender.prototype.flush = function() {
		if (this._disposed) return;
		this._flush(true);
	};
	ZRender.prototype._flush = function(animationUpdate) {
		var triggerRendered;
		var start = getTime();
		var needsRefresh = this._needsRefresh;
		var needsRefreshHover = this._needsRefreshHover;
		if (needsRefresh || needsRefreshHover) {
			triggerRendered = true;
			this._refresh({
				animUpdate: animationUpdate,
				refresh: needsRefresh,
				refreshHover: needsRefreshHover
			});
		}
		var end = getTime();
		if (triggerRendered) {
			this._stillFrameAccum = 0;
			this.trigger("rendered", { elapsedTime: end - start });
		} else if (this._sleepAfterStill > 0) {
			this._stillFrameAccum++;
			if (this._stillFrameAccum > this._sleepAfterStill) this.animation.stop();
		}
	};
	ZRender.prototype.setSleepAfterStill = function(stillFramesCount) {
		this._sleepAfterStill = stillFramesCount;
	};
	ZRender.prototype.wakeUp = function() {
		if (this._disposed) return;
		this.animation.start();
		this._stillFrameAccum = 0;
	};
	ZRender.prototype.refreshHover = function() {
		this._needsRefreshHover = true;
	};
	ZRender.prototype.refreshHoverImmediately = function() {
		if (this._disposed) return;
		this._refresh({
			animUpdate: false,
			refresh: false,
			refreshHover: true
		});
	};
	ZRender.prototype.resize = function(opts) {
		if (this._disposed) return;
		opts = opts || {};
		this.painter.resize(opts.width, opts.height);
		this.handler.resize();
	};
	ZRender.prototype.clearAnimation = function() {
		if (this._disposed) return;
		this.animation.clear();
	};
	ZRender.prototype.getWidth = function() {
		if (this._disposed) return;
		return this.painter.getWidth();
	};
	ZRender.prototype.getHeight = function() {
		if (this._disposed) return;
		return this.painter.getHeight();
	};
	ZRender.prototype.setCursorStyle = function(cursorStyle) {
		if (this._disposed) return;
		this.handler.setCursorStyle(cursorStyle);
	};
	ZRender.prototype.findHover = function(x, y) {
		if (this._disposed) return;
		return this.handler.findHover(x, y);
	};
	ZRender.prototype.on = function(eventName, eventHandler, context) {
		if (!this._disposed) this.handler.on(eventName, eventHandler, context);
		return this;
	};
	ZRender.prototype.off = function(eventName, eventHandler) {
		if (this._disposed) return;
		this.handler.off(eventName, eventHandler);
	};
	ZRender.prototype.trigger = function(eventName, event) {
		if (this._disposed) return;
		this.handler.trigger(eventName, event);
	};
	ZRender.prototype.clear = function() {
		if (this._disposed) return;
		var roots = this.storage.getRoots();
		for (var i = 0; i < roots.length; i++) if (roots[i] instanceof Group) roots[i].removeSelfFromZr(this);
		this.storage.delAllRoots();
		this.painter.clear();
	};
	ZRender.prototype.dispose = function() {
		if (this._disposed) return;
		this.animation.stop();
		this.clear();
		this.storage.dispose();
		this.painter.dispose();
		this.handler.dispose();
		this.animation = this.storage = this.painter = this.handler = null;
		this._disposed = true;
		delInstance(this.id);
	};
	return ZRender;
}();
function init$1(dom, opts) {
	var zr = new ZRender(guid(), dom, opts);
	instances$1[zr.id] = zr;
	return zr;
}
function dispose$1(zr) {
	zr.dispose();
}
function disposeAll() {
	for (var key in instances$1) if (instances$1.hasOwnProperty(key)) instances$1[key].dispose();
	instances$1 = {};
}
function getInstance(id) {
	return instances$1[id];
}
function registerPainter(name, Ctor) {
	painterCtors[name] = Ctor;
}
var ssrDataGetter;
function getElementSSRData(el) {
	if (typeof ssrDataGetter === "function") return ssrDataGetter(el);
}
function registerSSRDataGetter(getter) {
	ssrDataGetter = getter;
}
var version$1 = "6.1.0";
//#endregion
//#region node_modules/echarts/lib/model/globalDefault.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var platform = "";
if (typeof navigator !== "undefined") platform = navigator.platform || "";
var decalColor = "rgba(0, 0, 0, 0.2)";
var themeColor = tokens.color.theme[0];
var lightThemeColor = modifyHSL(themeColor, null, null, .9);
var globalDefault_default = {
	darkMode: "auto",
	colorBy: "series",
	color: tokens.color.theme,
	gradientColor: [lightThemeColor, themeColor],
	aria: { decal: { decals: [
		{
			color: decalColor,
			dashArrayX: [1, 0],
			dashArrayY: [2, 5],
			symbolSize: 1,
			rotation: Math.PI / 6
		},
		{
			color: decalColor,
			symbol: "circle",
			dashArrayX: [[8, 8], [
				0,
				8,
				8,
				0
			]],
			dashArrayY: [6, 0],
			symbolSize: .8
		},
		{
			color: decalColor,
			dashArrayX: [1, 0],
			dashArrayY: [4, 3],
			rotation: -Math.PI / 4
		},
		{
			color: decalColor,
			dashArrayX: [[6, 6], [
				0,
				6,
				6,
				0
			]],
			dashArrayY: [6, 0]
		},
		{
			color: decalColor,
			dashArrayX: [[1, 0], [1, 6]],
			dashArrayY: [
				1,
				0,
				6,
				0
			],
			rotation: Math.PI / 4
		},
		{
			color: decalColor,
			symbol: "triangle",
			dashArrayX: [[9, 9], [
				0,
				9,
				9,
				0
			]],
			dashArrayY: [7, 2],
			symbolSize: .75
		}
	] } },
	textStyle: {
		fontFamily: platform.match(/^Win/) ? "Microsoft YaHei" : "sans-serif",
		fontSize: 12,
		fontStyle: "normal",
		fontWeight: "normal"
	},
	blendMode: null,
	stateAnimation: {
		duration: 300,
		easing: "cubicOut"
	},
	animation: "auto",
	animationDuration: 1e3,
	animationDurationUpdate: 500,
	animationEasing: "cubicInOut",
	animationEasingUpdate: "cubicInOut",
	animationThreshold: 2e3,
	progressiveThreshold: 3e3,
	progressive: 400,
	hoverLayerThreshold: 3e3,
	useUTC: false
};
//#endregion
//#region node_modules/echarts/lib/model/internalComponentCreator.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var internalOptionCreatorMap = createHashMap();
function concatInternalOptions(ecModel, mainType, newCmptOptionList) {
	var internalOptionCreator = internalOptionCreatorMap.get(mainType);
	if (!internalOptionCreator) return newCmptOptionList;
	var internalOptions = internalOptionCreator(ecModel);
	if (!internalOptions) return newCmptOptionList;
	return newCmptOptionList.concat(internalOptions);
}
//#endregion
//#region node_modules/echarts/lib/model/Global.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* Caution: If the mechanism should be changed some day, these cases
* should be considered:
*
* (1) In `merge option` mode, if using the same option to call `setOption`
* many times, the result should be the same (try our best to ensure that).
* (2) In `merge option` mode, if a component has no id/name specified, it
* will be merged by index, and the result sequence of the components is
* consistent to the original sequence.
* (3) In `replaceMerge` mode, keep the result sequence of the components is
* consistent to the original sequence, even though there might result in "hole".
* (4) `reset` feature (in toolbox). Find detailed info in comments about
* `mergeOption` in module:echarts/model/OptionManager.
*/
var reCreateSeriesIndices;
var assertSeriesInitialized;
var initBase;
var OPTION_INNER_KEY = "\0_ec_inner";
var OPTION_INNER_VALUE = 1;
var GlobalModel = function(_super) {
	__extends(GlobalModel, _super);
	function GlobalModel() {
		return _super !== null && _super.apply(this, arguments) || this;
	}
	GlobalModel.prototype.init = function(option, parentModel, ecModel, theme, locale, optionManager) {
		theme = theme || {};
		this.option = null;
		this._theme = new Model(theme);
		this._locale = new Model(locale);
		this._optionManager = optionManager;
	};
	GlobalModel.prototype.setOption = function(option, opts, optionPreprocessorFuncs) {
		var innerOpt = normalizeSetOptionInput(opts);
		this._optionManager.setOption(option, optionPreprocessorFuncs, innerOpt);
		this._resetOption(null, innerOpt);
	};
	/**
	* @param type null/undefined: reset all.
	*        'recreate': force recreate all.
	*        'timeline': only reset timeline option
	*        'media': only reset media query option
	* @return Whether option changed.
	*/
	GlobalModel.prototype.resetOption = function(type, opt) {
		return this._resetOption(type, normalizeSetOptionInput(opt));
	};
	GlobalModel.prototype._resetOption = function(type, opt) {
		var optionChanged = false;
		var optionManager = this._optionManager;
		if (!type || type === "recreate") {
			var baseOption = optionManager.mountOption(type === "recreate");
			if (!this.option || type === "recreate") initBase(this, baseOption);
			else {
				this.restoreData();
				this._mergeOption(baseOption, opt);
			}
			optionChanged = true;
		}
		if (type === "timeline" || type === "media") this.restoreData();
		if (!type || type === "recreate" || type === "timeline") {
			var timelineOption = optionManager.getTimelineOption(this);
			if (timelineOption) {
				optionChanged = true;
				this._mergeOption(timelineOption, opt);
			}
		}
		if (!type || type === "recreate" || type === "media") {
			var mediaOptions = optionManager.getMediaOption(this);
			if (mediaOptions.length) each$1(mediaOptions, function(mediaOption) {
				optionChanged = true;
				this._mergeOption(mediaOption, opt);
			}, this);
		}
		return optionChanged;
	};
	GlobalModel.prototype.mergeOption = function(option) {
		this._mergeOption(option, null);
	};
	GlobalModel.prototype._mergeOption = function(newOption, opt) {
		var option = this.option;
		var componentsMap = this._componentsMap;
		var componentsCount = this._componentsCount;
		var newCmptTypes = [];
		var newCmptTypeMap = createHashMap();
		var replaceMergeMainTypeMap = opt && opt.replaceMergeMainTypeMap;
		resetSourceDefaulter(this);
		each$1(newOption, function(componentOption, mainType) {
			if (componentOption == null) return;
			if (!ComponentModel.hasClass(mainType)) option[mainType] = option[mainType] == null ? clone(componentOption) : merge(option[mainType], componentOption, true);
			else if (mainType) {
				newCmptTypes.push(mainType);
				newCmptTypeMap.set(mainType, true);
			}
		});
		if (replaceMergeMainTypeMap) replaceMergeMainTypeMap.each(function(val, mainTypeInReplaceMerge) {
			if (ComponentModel.hasClass(mainTypeInReplaceMerge) && !newCmptTypeMap.get(mainTypeInReplaceMerge)) {
				newCmptTypes.push(mainTypeInReplaceMerge);
				newCmptTypeMap.set(mainTypeInReplaceMerge, true);
			}
		});
		ComponentModel.topologicalTravel(newCmptTypes, ComponentModel.getAllClassMainTypes(), visitComponent, this);
		function visitComponent(mainType) {
			var newCmptOptionList = concatInternalOptions(this, mainType, normalizeToArray(newOption[mainType]));
			var oldCmptList = componentsMap.get(mainType);
			var mergeMode = !oldCmptList ? "replaceAll" : replaceMergeMainTypeMap && replaceMergeMainTypeMap.get(mainType) ? "replaceMerge" : "normalMerge";
			var mappingResult = mappingToExists(oldCmptList, newCmptOptionList, mergeMode);
			setComponentTypeToKeyInfo(mappingResult, mainType, ComponentModel);
			option[mainType] = null;
			componentsMap.set(mainType, null);
			componentsCount.set(mainType, 0);
			var optionsByMainType = [];
			var cmptsByMainType = [];
			var cmptsCountByMainType = 0;
			var tooltipExists;
			each$1(mappingResult, function(resultItem, index) {
				var componentModel = resultItem.existing;
				var newCmptOption = resultItem.newOption;
				if (!newCmptOption) {
					if (componentModel) {
						componentModel.mergeOption({}, this);
						componentModel.optionUpdated({}, false);
					}
				} else {
					var isSeriesType = mainType === "series";
					var ComponentModelClass = ComponentModel.getClass(mainType, resultItem.keyInfo.subType, !isSeriesType);
					if (!ComponentModelClass) return;
					if (mainType === "tooltip") {
						if (tooltipExists) return;
						tooltipExists = true;
					}
					if (componentModel && componentModel.constructor === ComponentModelClass) {
						componentModel.name = resultItem.keyInfo.name;
						componentModel.mergeOption(newCmptOption, this);
						componentModel.optionUpdated(newCmptOption, false);
					} else {
						var extraOpt = extend({ componentIndex: index }, resultItem.keyInfo);
						componentModel = new ComponentModelClass(newCmptOption, this, this, extraOpt);
						extend(componentModel, extraOpt);
						if (resultItem.brandNew) componentModel.__requireNewView = true;
						componentModel.init(newCmptOption, this, this);
						componentModel.optionUpdated(null, true);
					}
				}
				if (componentModel) {
					optionsByMainType.push(componentModel.option);
					cmptsByMainType.push(componentModel);
					cmptsCountByMainType++;
				} else {
					optionsByMainType.push(void 0);
					cmptsByMainType.push(void 0);
				}
			}, this);
			option[mainType] = optionsByMainType;
			componentsMap.set(mainType, cmptsByMainType);
			componentsCount.set(mainType, cmptsCountByMainType);
			if (mainType === "series") reCreateSeriesIndices(this);
		}
		if (!this._seriesIndices) reCreateSeriesIndices(this);
	};
	/**
	* Get option for output (cloned option and inner info removed)
	*/
	GlobalModel.prototype.getOption = function() {
		var option = clone(this.option);
		each$1(option, function(optInMainType, mainType) {
			if (ComponentModel.hasClass(mainType)) {
				var opts = normalizeToArray(optInMainType);
				var realLen = opts.length;
				var metNonInner = false;
				for (var i = realLen - 1; i >= 0; i--) if (opts[i] && !isComponentIdInternal(opts[i])) metNonInner = true;
				else {
					opts[i] = null;
					!metNonInner && realLen--;
				}
				opts.length = realLen;
				option[mainType] = opts;
			}
		});
		delete option[OPTION_INNER_KEY];
		return option;
	};
	GlobalModel.prototype.setTheme = function(theme) {
		this._theme = new Model(theme);
		this._resetOption("recreate", null);
	};
	GlobalModel.prototype.getTheme = function() {
		return this._theme;
	};
	GlobalModel.prototype.getLocaleModel = function() {
		return this._locale;
	};
	GlobalModel.prototype.setUpdatePayload = function(payload) {
		this._payload = payload;
	};
	GlobalModel.prototype.getUpdatePayload = function() {
		return this._payload;
	};
	/**
	* @param idx If not specified, return the first one.
	*/
	GlobalModel.prototype.getComponent = function(mainType, idx) {
		var list = this._componentsMap.get(mainType);
		if (list) {
			var cmpt = list[idx || 0];
			if (cmpt) return cmpt;
			else if (idx == null) {
				for (var i = 0; i < list.length; i++) if (list[i]) return list[i];
			}
		}
	};
	/**
	* @return Never be null/undefined.
	*/
	GlobalModel.prototype.queryComponents = function(condition) {
		var mainType = condition.mainType;
		if (!mainType) return [];
		var index = condition.index;
		var id = condition.id;
		var name = condition.name;
		var cmpts = this._componentsMap.get(mainType);
		if (!cmpts || !cmpts.length) return [];
		var result;
		if (index != null) {
			result = [];
			each$1(normalizeToArray(index), function(idx) {
				cmpts[idx] && result.push(cmpts[idx]);
			});
		} else if (id != null) result = queryByIdOrName("id", id, cmpts);
		else if (name != null) result = queryByIdOrName("name", name, cmpts);
		else result = filter(cmpts, function(cmpt) {
			return !!cmpt;
		});
		return filterBySubType(result, condition);
	};
	/**
	* The interface is different from queryComponents,
	* which is convenient for inner usage.
	*
	* @usage
	* let result = findComponents(
	*     {mainType: 'dataZoom', query: {dataZoomId: 'abc'}}
	* );
	* let result = findComponents(
	*     {mainType: 'series', subType: 'pie', query: {seriesName: 'uio'}}
	* );
	* let result = findComponents(
	*     {mainType: 'series',
	*     filter: function (model, index) {...}}
	* );
	* // result like [component0, component1, ...]
	*/
	GlobalModel.prototype.findComponents = function(condition) {
		var query = condition.query;
		var mainType = condition.mainType;
		var queryCond = getQueryCond(query);
		return doFilter(filterBySubType(queryCond ? this.queryComponents(queryCond) : filter(this._componentsMap.get(mainType), function(cmpt) {
			return !!cmpt;
		}), condition));
		function getQueryCond(q) {
			var indexAttr = mainType + "Index";
			var idAttr = mainType + "Id";
			var nameAttr = mainType + "Name";
			return q && (q[indexAttr] != null || q[idAttr] != null || q[nameAttr] != null) ? {
				mainType,
				index: q[indexAttr],
				id: q[idAttr],
				name: q[nameAttr]
			} : null;
		}
		function doFilter(res) {
			return condition.filter ? filter(res, condition.filter) : res;
		}
	};
	GlobalModel.prototype.eachComponent = function(mainType, cb, context) {
		var componentsMap = this._componentsMap;
		if (isFunction(mainType)) {
			var ctxForAll_1 = cb;
			var cbForAll_1 = mainType;
			componentsMap.each(function(cmpts, componentType) {
				for (var i = 0; cmpts && i < cmpts.length; i++) {
					var cmpt = cmpts[i];
					cmpt && cbForAll_1.call(ctxForAll_1, componentType, cmpt, cmpt.componentIndex);
				}
			});
		} else {
			var cmpts = isString(mainType) ? componentsMap.get(mainType) : isObject$1(mainType) ? this.findComponents(mainType) : null;
			for (var i = 0; cmpts && i < cmpts.length; i++) {
				var cmpt = cmpts[i];
				cmpt && cb.call(context, cmpt, cmpt.componentIndex);
			}
		}
	};
	/**
	* Get series list before filtered by name.
	*/
	GlobalModel.prototype.getSeriesByName = function(name) {
		var nameStr = convertOptionIdName(name, null);
		return filter(this._componentsMap.get("series"), function(oneSeries) {
			return !!oneSeries && nameStr != null && oneSeries.name === nameStr;
		});
	};
	/**
	* Get series list before filtered by index.
	*/
	GlobalModel.prototype.getSeriesByIndex = function(seriesIndex) {
		return this._componentsMap.get("series")[seriesIndex];
	};
	/**
	* Get series list before filtered by type.
	* FIXME: rename to getRawSeriesByType?
	*/
	GlobalModel.prototype.getSeriesByType = function(subType) {
		return filter(this._componentsMap.get("series"), function(oneSeries) {
			return !!oneSeries && oneSeries.subType === subType;
		});
	};
	/**
	* Get all series before filtered.
	*/
	GlobalModel.prototype.getSeries = function() {
		return filter(this._componentsMap.get("series"), function(oneSeries) {
			return !!oneSeries;
		});
	};
	/**
	* Count series before filtered.
	*/
	GlobalModel.prototype.getSeriesCount = function() {
		return this._componentsCount.get("series");
	};
	/**
	* After filtering, series may be different
	* from raw series.
	*/
	GlobalModel.prototype.eachSeries = function(cb, context) {
		assertSeriesInitialized(this);
		each$1(this._seriesIndices, function(rawSeriesIndex) {
			var series = this._componentsMap.get("series")[rawSeriesIndex];
			cb.call(context, series, rawSeriesIndex);
		}, this);
	};
	/**
	* Iterate raw series before filtered.
	*/
	GlobalModel.prototype.eachRawSeries = function(cb, context) {
		each$1(this._componentsMap.get("series"), function(series) {
			series && cb.call(context, series, series.componentIndex);
		});
	};
	/**
	* After filtering, series may be different.
	* from raw series.
	*/
	GlobalModel.prototype.eachSeriesByType = function(subType, cb, context) {
		assertSeriesInitialized(this);
		each$1(this._seriesIndices, function(rawSeriesIndex) {
			var series = this._componentsMap.get("series")[rawSeriesIndex];
			if (series.subType === subType) cb.call(context, series, rawSeriesIndex);
		}, this);
	};
	/**
	* Iterate raw series before filtered of given type.
	*/
	GlobalModel.prototype.eachRawSeriesByType = function(subType, cb, context) {
		return each$1(this.getSeriesByType(subType), cb, context);
	};
	/**
	* It means "filtered out".
	*/
	GlobalModel.prototype.isSeriesFiltered = function(seriesModel) {
		assertSeriesInitialized(this);
		return this._seriesIndicesMap.get(seriesModel.componentIndex) == null;
	};
	GlobalModel.prototype.getCurrentSeriesIndices = function() {
		return (this._seriesIndices || []).slice();
	};
	GlobalModel.prototype.filterSeries = function(cb, context) {
		assertSeriesInitialized(this);
		var newSeriesIndices = [];
		each$1(this._seriesIndices, function(seriesRawIdx) {
			var series = this._componentsMap.get("series")[seriesRawIdx];
			cb.call(context, series, seriesRawIdx) && newSeriesIndices.push(seriesRawIdx);
		}, this);
		this._seriesIndices = newSeriesIndices;
		this._seriesIndicesMap = createHashMap(newSeriesIndices);
	};
	GlobalModel.prototype.restoreData = function(payload) {
		reCreateSeriesIndices(this);
		var componentsMap = this._componentsMap;
		var componentTypes = [];
		componentsMap.each(function(components, componentType) {
			if (ComponentModel.hasClass(componentType)) componentTypes.push(componentType);
		});
		ComponentModel.topologicalTravel(componentTypes, ComponentModel.getAllClassMainTypes(), function(componentType) {
			each$1(componentsMap.get(componentType), function(component) {
				if (component && (componentType !== "series" || !isNotTargetSeries(component, payload))) component.restoreData();
			});
		});
	};
	GlobalModel.internalField = function() {
		reCreateSeriesIndices = function(ecModel) {
			var seriesIndices = ecModel._seriesIndices = [];
			each$1(ecModel._componentsMap.get("series"), function(series) {
				series && seriesIndices.push(series.componentIndex);
			});
			ecModel._seriesIndicesMap = createHashMap(seriesIndices);
		};
		assertSeriesInitialized = function(ecModel) {};
		initBase = function(ecModel, baseOption) {
			ecModel.option = {};
			ecModel.option[OPTION_INNER_KEY] = OPTION_INNER_VALUE;
			ecModel._componentsMap = createHashMap({ series: [] });
			ecModel._componentsCount = createHashMap();
			var airaOption = baseOption.aria;
			if (isObject$1(airaOption) && airaOption.enabled == null) airaOption.enabled = true;
			mergeTheme(baseOption, ecModel._theme.option);
			merge(baseOption, globalDefault_default, false);
			ecModel._mergeOption(baseOption, null);
		};
	}();
	return GlobalModel;
}(Model);
function isNotTargetSeries(seriesModel, payload) {
	if (payload) {
		var index = payload.seriesIndex;
		var id = payload.seriesId;
		var name_1 = payload.seriesName;
		return index != null && seriesModel.componentIndex !== index || id != null && seriesModel.id !== id || name_1 != null && seriesModel.name !== name_1;
	}
}
function mergeTheme(option, theme) {
	var notMergeColorLayer = option.color && !option.colorLayer;
	each$1(theme, function(themeItem, name) {
		if (name === "colorLayer" && notMergeColorLayer || name === "color" && option.color) return;
		if (!ComponentModel.hasClass(name)) {
			if (typeof themeItem === "object") option[name] = !option[name] ? clone(themeItem) : merge(option[name], themeItem, false);
			else if (option[name] == null) option[name] = themeItem;
		}
	});
}
function queryByIdOrName(attr, idOrName, cmpts) {
	if (isArray(idOrName)) {
		var keyMap_1 = createHashMap();
		each$1(idOrName, function(idOrNameItem) {
			if (idOrNameItem != null) convertOptionIdName(idOrNameItem, null) != null && keyMap_1.set(idOrNameItem, true);
		});
		return filter(cmpts, function(cmpt) {
			return cmpt && keyMap_1.get(cmpt[attr]);
		});
	} else {
		var idName_1 = convertOptionIdName(idOrName, null);
		return filter(cmpts, function(cmpt) {
			return cmpt && idName_1 != null && cmpt[attr] === idName_1;
		});
	}
}
function filterBySubType(components, condition) {
	return condition.hasOwnProperty("subType") ? filter(components, function(cmpt) {
		return cmpt && cmpt.subType === condition.subType;
	}) : components;
}
function normalizeSetOptionInput(opts) {
	var replaceMergeMainTypeMap = createHashMap();
	opts && each$1(normalizeToArray(opts.replaceMerge), function(mainType) {
		replaceMergeMainTypeMap.set(mainType, true);
	});
	return { replaceMergeMainTypeMap };
}
mixin(GlobalModel, PaletteMixin);
//#endregion
//#region node_modules/echarts/lib/model/OptionManager.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var QUERY_REG = /^(min|max)?(.+)$/;
/**
* TERM EXPLANATIONS:
* See `ECOption` and `ECUnitOption` in `src/util/types.ts`.
*/
var OptionManager = function() {
	function OptionManager(api) {
		this._timelineOptions = [];
		this._mediaList = [];
		/**
		* -1, means default.
		* empty means no media.
		*/
		this._currentMediaIndices = [];
		this._api = api;
	}
	OptionManager.prototype.setOption = function(rawOption, optionPreprocessorFuncs, opt) {
		if (rawOption) {
			each$1(normalizeToArray(rawOption.series), function(series) {
				series && series.data && isTypedArray(series.data) && setAsPrimitive(series.data);
			});
			each$1(normalizeToArray(rawOption.dataset), function(dataset) {
				dataset && dataset.source && isTypedArray(dataset.source) && setAsPrimitive(dataset.source);
			});
		}
		rawOption = clone(rawOption);
		var optionBackup = this._optionBackup;
		var newParsedOption = parseRawOption(rawOption, optionPreprocessorFuncs, !optionBackup);
		this._newBaseOption = newParsedOption.baseOption;
		if (optionBackup) {
			if (newParsedOption.timelineOptions.length) optionBackup.timelineOptions = newParsedOption.timelineOptions;
			if (newParsedOption.mediaList.length) optionBackup.mediaList = newParsedOption.mediaList;
			if (newParsedOption.mediaDefault) optionBackup.mediaDefault = newParsedOption.mediaDefault;
		} else this._optionBackup = newParsedOption;
	};
	OptionManager.prototype.mountOption = function(isRecreate) {
		var optionBackup = this._optionBackup;
		this._timelineOptions = optionBackup.timelineOptions;
		this._mediaList = optionBackup.mediaList;
		this._mediaDefault = optionBackup.mediaDefault;
		this._currentMediaIndices = [];
		return clone(isRecreate ? optionBackup.baseOption : this._newBaseOption);
	};
	OptionManager.prototype.getTimelineOption = function(ecModel) {
		var option;
		var timelineOptions = this._timelineOptions;
		if (timelineOptions.length) {
			var timelineModel = ecModel.getComponent("timeline");
			if (timelineModel) option = clone(timelineOptions[timelineModel.getCurrentIndex()]);
		}
		return option;
	};
	OptionManager.prototype.getMediaOption = function(ecModel) {
		var ecWidth = this._api.getWidth();
		var ecHeight = this._api.getHeight();
		var mediaList = this._mediaList;
		var mediaDefault = this._mediaDefault;
		var indices = [];
		var result = [];
		if (!mediaList.length && !mediaDefault) return result;
		for (var i = 0, len = mediaList.length; i < len; i++) if (applyMediaQuery(mediaList[i].query, ecWidth, ecHeight)) indices.push(i);
		if (!indices.length && mediaDefault) indices = [-1];
		if (indices.length && !indicesEquals(indices, this._currentMediaIndices)) result = map(indices, function(index) {
			return clone(index === -1 ? mediaDefault.option : mediaList[index].option);
		});
		this._currentMediaIndices = indices;
		return result;
	};
	return OptionManager;
}();
/**
* [RAW_OPTION_PATTERNS]
* (Note: "series: []" represents all other props in `ECUnitOption`)
*
* (1) No prop "baseOption" declared:
* Root option is used as "baseOption" (except prop "options" and "media").
* ```js
* option = {
*     series: [],
*     timeline: {},
*     options: [],
* };
* option = {
*     series: [],
*     media: {},
* };
* option = {
*     series: [],
*     timeline: {},
*     options: [],
*     media: {},
* }
* ```
*
* (2) Prop "baseOption" declared:
* If "baseOption" declared, `ECUnitOption` props can only be declared
* inside "baseOption" except prop "timeline" (compat ec2).
* ```js
* option = {
*     baseOption: {
*         timeline: {},
*         series: [],
*     },
*     options: []
* };
* option = {
*     baseOption: {
*         series: [],
*     },
*     media: []
* };
* option = {
*     baseOption: {
*         timeline: {},
*         series: [],
*     },
*     options: []
*     media: []
* };
* option = {
*     // ec3 compat ec2: allow (only) `timeline` declared
*     // outside baseOption. Keep this setting for compat.
*     timeline: {},
*     baseOption: {
*         series: [],
*     },
*     options: [],
*     media: []
* };
* ```
*/
function parseRawOption(rawOption, optionPreprocessorFuncs, isNew) {
	var mediaList = [];
	var mediaDefault;
	var baseOption;
	var declaredBaseOption = rawOption.baseOption;
	var timelineOnRoot = rawOption.timeline;
	var timelineOptionsOnRoot = rawOption.options;
	var mediaOnRoot = rawOption.media;
	var hasMedia = !!rawOption.media;
	var hasTimeline = !!(timelineOptionsOnRoot || timelineOnRoot || declaredBaseOption && declaredBaseOption.timeline);
	if (declaredBaseOption) {
		baseOption = declaredBaseOption;
		if (!baseOption.timeline) baseOption.timeline = timelineOnRoot;
	} else {
		if (hasTimeline || hasMedia) rawOption.options = rawOption.media = null;
		baseOption = rawOption;
	}
	if (hasMedia) {
		if (isArray(mediaOnRoot)) each$1(mediaOnRoot, function(singleMedia) {
			if (singleMedia && singleMedia.option) {
				if (singleMedia.query) mediaList.push(singleMedia);
				else if (!mediaDefault) mediaDefault = singleMedia;
			}
		});
	}
	doPreprocess(baseOption);
	each$1(timelineOptionsOnRoot, function(option) {
		return doPreprocess(option);
	});
	each$1(mediaList, function(media) {
		return doPreprocess(media.option);
	});
	function doPreprocess(option) {
		each$1(optionPreprocessorFuncs, function(preProcess) {
			preProcess(option, isNew);
		});
	}
	return {
		baseOption,
		timelineOptions: timelineOptionsOnRoot || [],
		mediaDefault,
		mediaList
	};
}
/**
* @see <http://www.w3.org/TR/css3-mediaqueries/#media1>
* Support: width, height, aspectRatio
* Can use max or min as prefix.
*/
function applyMediaQuery(query, ecWidth, ecHeight) {
	var realMap = {
		width: ecWidth,
		height: ecHeight,
		aspectratio: ecWidth / ecHeight
	};
	var applicable = true;
	each$1(query, function(value, attr) {
		var matched = attr.match(QUERY_REG);
		if (!matched || !matched[1] || !matched[2]) return;
		var operator = matched[1];
		if (!compare(realMap[matched[2].toLowerCase()], value, operator)) applicable = false;
	});
	return applicable;
}
function compare(real, expect, operator) {
	if (operator === "min") return real >= expect;
	else if (operator === "max") return real <= expect;
	else return real === expect;
}
function indicesEquals(indices1, indices2) {
	return indices1.join(",") === indices2.join(",");
}
//#endregion
//#region node_modules/echarts/lib/preprocessor/helper/compatStyle.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var each = each$1;
var isObject = isObject$1;
var POSSIBLE_STYLES = [
	"areaStyle",
	"lineStyle",
	"nodeStyle",
	"linkStyle",
	"chordStyle",
	"label",
	"labelLine"
];
function compatEC2ItemStyle(opt) {
	var itemStyleOpt = opt && opt.itemStyle;
	if (!itemStyleOpt) return;
	for (var i = 0, len = POSSIBLE_STYLES.length; i < len; i++) {
		var styleName = POSSIBLE_STYLES[i];
		var normalItemStyleOpt = itemStyleOpt.normal;
		var emphasisItemStyleOpt = itemStyleOpt.emphasis;
		if (normalItemStyleOpt && normalItemStyleOpt[styleName]) {
			opt[styleName] = opt[styleName] || {};
			if (!opt[styleName].normal) opt[styleName].normal = normalItemStyleOpt[styleName];
			else merge(opt[styleName].normal, normalItemStyleOpt[styleName]);
			normalItemStyleOpt[styleName] = null;
		}
		if (emphasisItemStyleOpt && emphasisItemStyleOpt[styleName]) {
			opt[styleName] = opt[styleName] || {};
			if (!opt[styleName].emphasis) opt[styleName].emphasis = emphasisItemStyleOpt[styleName];
			else merge(opt[styleName].emphasis, emphasisItemStyleOpt[styleName]);
			emphasisItemStyleOpt[styleName] = null;
		}
	}
}
function convertNormalEmphasis(opt, optType, useExtend) {
	if (opt && opt[optType] && (opt[optType].normal || opt[optType].emphasis)) {
		var normalOpt = opt[optType].normal;
		var emphasisOpt = opt[optType].emphasis;
		if (normalOpt) {
			if (useExtend) {
				opt[optType].normal = opt[optType].emphasis = null;
				defaults(opt[optType], normalOpt);
			} else opt[optType] = normalOpt;
		}
		if (emphasisOpt) {
			opt.emphasis = opt.emphasis || {};
			opt.emphasis[optType] = emphasisOpt;
			if (emphasisOpt.focus) opt.emphasis.focus = emphasisOpt.focus;
			if (emphasisOpt.blurScope) opt.emphasis.blurScope = emphasisOpt.blurScope;
		}
	}
}
function removeEC3NormalStatus(opt) {
	convertNormalEmphasis(opt, "itemStyle");
	convertNormalEmphasis(opt, "lineStyle");
	convertNormalEmphasis(opt, "areaStyle");
	convertNormalEmphasis(opt, "label");
	convertNormalEmphasis(opt, "labelLine");
	convertNormalEmphasis(opt, "upperLabel");
	convertNormalEmphasis(opt, "edgeLabel");
}
function compatTextStyle(opt, propName) {
	var labelOptSingle = isObject(opt) && opt[propName];
	var textStyle = isObject(labelOptSingle) && labelOptSingle.textStyle;
	if (textStyle) for (var i = 0, len = TEXT_STYLE_OPTIONS.length; i < len; i++) {
		var textPropName = TEXT_STYLE_OPTIONS[i];
		if (textStyle.hasOwnProperty(textPropName)) labelOptSingle[textPropName] = textStyle[textPropName];
	}
}
function compatEC3CommonStyles(opt) {
	if (opt) {
		removeEC3NormalStatus(opt);
		compatTextStyle(opt, "label");
		opt.emphasis && compatTextStyle(opt.emphasis, "label");
	}
}
function processSeries(seriesOpt) {
	if (!isObject(seriesOpt)) return;
	compatEC2ItemStyle(seriesOpt);
	removeEC3NormalStatus(seriesOpt);
	compatTextStyle(seriesOpt, "label");
	compatTextStyle(seriesOpt, "upperLabel");
	compatTextStyle(seriesOpt, "edgeLabel");
	if (seriesOpt.emphasis) {
		compatTextStyle(seriesOpt.emphasis, "label");
		compatTextStyle(seriesOpt.emphasis, "upperLabel");
		compatTextStyle(seriesOpt.emphasis, "edgeLabel");
	}
	var markPoint = seriesOpt.markPoint;
	if (markPoint) {
		compatEC2ItemStyle(markPoint);
		compatEC3CommonStyles(markPoint);
	}
	var markLine = seriesOpt.markLine;
	if (markLine) {
		compatEC2ItemStyle(markLine);
		compatEC3CommonStyles(markLine);
	}
	var markArea = seriesOpt.markArea;
	if (markArea) compatEC3CommonStyles(markArea);
	var data = seriesOpt.data;
	if (seriesOpt.type === "graph") {
		data = data || seriesOpt.nodes;
		var edgeData = seriesOpt.links || seriesOpt.edges;
		if (edgeData && !isTypedArray(edgeData)) for (var i = 0; i < edgeData.length; i++) compatEC3CommonStyles(edgeData[i]);
		each$1(seriesOpt.categories, function(opt) {
			removeEC3NormalStatus(opt);
		});
	}
	if (data && !isTypedArray(data)) for (var i = 0; i < data.length; i++) compatEC3CommonStyles(data[i]);
	markPoint = seriesOpt.markPoint;
	if (markPoint && markPoint.data) {
		var mpData = markPoint.data;
		for (var i = 0; i < mpData.length; i++) compatEC3CommonStyles(mpData[i]);
	}
	markLine = seriesOpt.markLine;
	if (markLine && markLine.data) {
		var mlData = markLine.data;
		for (var i = 0; i < mlData.length; i++) if (isArray(mlData[i])) {
			compatEC3CommonStyles(mlData[i][0]);
			compatEC3CommonStyles(mlData[i][1]);
		} else compatEC3CommonStyles(mlData[i]);
	}
	if (seriesOpt.type === "gauge") {
		compatTextStyle(seriesOpt, "axisLabel");
		compatTextStyle(seriesOpt, "title");
		compatTextStyle(seriesOpt, "detail");
	} else if (seriesOpt.type === "treemap") {
		convertNormalEmphasis(seriesOpt.breadcrumb, "itemStyle");
		each$1(seriesOpt.levels, function(opt) {
			removeEC3NormalStatus(opt);
		});
	} else if (seriesOpt.type === "tree") removeEC3NormalStatus(seriesOpt.leaves);
}
function toArr(o) {
	return isArray(o) ? o : o ? [o] : [];
}
function toObj(o) {
	return (isArray(o) ? o[0] : o) || {};
}
function globalCompatStyle(option, isTheme) {
	each(toArr(option.series), function(seriesOpt) {
		isObject(seriesOpt) && processSeries(seriesOpt);
	});
	var axes = [
		"xAxis",
		"yAxis",
		"radiusAxis",
		"angleAxis",
		"singleAxis",
		"parallelAxis",
		"radar"
	];
	isTheme && axes.push("valueAxis", "categoryAxis", "logAxis", "timeAxis");
	each(axes, function(axisName) {
		each(toArr(option[axisName]), function(axisOpt) {
			if (axisOpt) {
				compatTextStyle(axisOpt, "axisLabel");
				compatTextStyle(axisOpt.axisPointer, "label");
			}
		});
	});
	each(toArr(option.parallel), function(parallelOpt) {
		var parallelAxisDefault = parallelOpt && parallelOpt.parallelAxisDefault;
		compatTextStyle(parallelAxisDefault, "axisLabel");
		compatTextStyle(parallelAxisDefault && parallelAxisDefault.axisPointer, "label");
	});
	each(toArr(option.calendar), function(calendarOpt) {
		convertNormalEmphasis(calendarOpt, "itemStyle");
		compatTextStyle(calendarOpt, "dayLabel");
		compatTextStyle(calendarOpt, "monthLabel");
		compatTextStyle(calendarOpt, "yearLabel");
	});
	each(toArr(option.radar), function(radarOpt) {
		compatTextStyle(radarOpt, "name");
		if (radarOpt.name && radarOpt.axisName == null) {
			radarOpt.axisName = radarOpt.name;
			delete radarOpt.name;
		}
		if (radarOpt.nameGap != null && radarOpt.axisNameGap == null) {
			radarOpt.axisNameGap = radarOpt.nameGap;
			delete radarOpt.nameGap;
		}
	});
	each(toArr(option.geo), function(geoOpt) {
		if (isObject(geoOpt)) {
			compatEC3CommonStyles(geoOpt);
			each(toArr(geoOpt.regions), function(regionObj) {
				compatEC3CommonStyles(regionObj);
			});
		}
	});
	each(toArr(option.timeline), function(timelineOpt) {
		compatEC3CommonStyles(timelineOpt);
		convertNormalEmphasis(timelineOpt, "label");
		convertNormalEmphasis(timelineOpt, "itemStyle");
		convertNormalEmphasis(timelineOpt, "controlStyle", true);
		var data = timelineOpt.data;
		isArray(data) && each$1(data, function(item) {
			if (isObject$1(item)) {
				convertNormalEmphasis(item, "label");
				convertNormalEmphasis(item, "itemStyle");
			}
		});
	});
	each(toArr(option.toolbox), function(toolboxOpt) {
		convertNormalEmphasis(toolboxOpt, "iconStyle");
		each(toolboxOpt.feature, function(featureOpt) {
			convertNormalEmphasis(featureOpt, "iconStyle");
		});
	});
	compatTextStyle(toObj(option.axisPointer), "label");
	compatTextStyle(toObj(option.tooltip).axisPointer, "label");
}
//#endregion
//#region node_modules/echarts/lib/preprocessor/backwardCompat.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function get(opt, path) {
	var pathArr = path.split(",");
	var obj = opt;
	for (var i = 0; i < pathArr.length; i++) {
		obj = obj && obj[pathArr[i]];
		if (obj == null) break;
	}
	return obj;
}
function set(opt, path, val, overwrite) {
	var pathArr = path.split(",");
	var obj = opt;
	var key;
	var i = 0;
	for (; i < pathArr.length - 1; i++) {
		key = pathArr[i];
		if (obj[key] == null) obj[key] = {};
		obj = obj[key];
	}
	if (overwrite || obj[pathArr[i]] == null) obj[pathArr[i]] = val;
}
function compatLayoutProperties(option) {
	option && each$1(LAYOUT_PROPERTIES, function(prop) {
		if (prop[0] in option && !(prop[1] in option)) option[prop[1]] = option[prop[0]];
	});
}
var LAYOUT_PROPERTIES = [
	["x", "left"],
	["y", "top"],
	["x2", "right"],
	["y2", "bottom"]
];
var COMPATITABLE_COMPONENTS = [
	"grid",
	"geo",
	"parallel",
	"legend",
	"toolbox",
	"title",
	"visualMap",
	"dataZoom",
	"timeline"
];
var BAR_ITEM_STYLE_MAP = [
	["borderRadius", "barBorderRadius"],
	["borderColor", "barBorderColor"],
	["borderWidth", "barBorderWidth"]
];
function compatBarItemStyle(option) {
	var itemStyle = option && option.itemStyle;
	if (itemStyle) for (var i = 0; i < BAR_ITEM_STYLE_MAP.length; i++) {
		var oldName = BAR_ITEM_STYLE_MAP[i][1];
		var newName = BAR_ITEM_STYLE_MAP[i][0];
		if (itemStyle[oldName] != null) itemStyle[newName] = itemStyle[oldName];
	}
}
function compatPieLabel(option) {
	if (!option) return;
	if (option.alignTo === "edge" && option.margin != null && option.edgeDistance == null) option.edgeDistance = option.margin;
}
function compatSunburstState(option) {
	if (!option) return;
	if (option.downplay && !option.blur) option.blur = option.downplay;
}
function compatGraphFocus(option) {
	if (!option) return;
	if (option.focusNodeAdjacency != null) {
		option.emphasis = option.emphasis || {};
		if (option.emphasis.focus == null) option.emphasis.focus = "adjacency";
	}
}
function traverseTree(data, cb) {
	if (data) for (var i = 0; i < data.length; i++) {
		cb(data[i]);
		data[i] && traverseTree(data[i].children, cb);
	}
}
function globalBackwardCompat(option, isTheme) {
	globalCompatStyle(option, isTheme);
	option.series = normalizeToArray(option.series);
	each$1(option.series, function(seriesOpt) {
		if (!isObject$1(seriesOpt)) return;
		var seriesType = seriesOpt.type;
		if (seriesType === "line") {
			if (seriesOpt.clipOverflow != null) seriesOpt.clip = seriesOpt.clipOverflow;
		} else if (seriesType === "pie" || seriesType === "gauge") {
			if (seriesOpt.clockWise != null) seriesOpt.clockwise = seriesOpt.clockWise;
			compatPieLabel(seriesOpt.label);
			var data = seriesOpt.data;
			if (data && !isTypedArray(data)) for (var i = 0; i < data.length; i++) compatPieLabel(data[i]);
			if (seriesOpt.hoverOffset != null) {
				seriesOpt.emphasis = seriesOpt.emphasis || {};
				if (seriesOpt.emphasis.scaleSize = null) seriesOpt.emphasis.scaleSize = seriesOpt.hoverOffset;
			}
		} else if (seriesType === "gauge") {
			var pointerColor = get(seriesOpt, "pointer.color");
			pointerColor != null && set(seriesOpt, "itemStyle.color", pointerColor);
		} else if (seriesType === "bar") {
			compatBarItemStyle(seriesOpt);
			compatBarItemStyle(seriesOpt.backgroundStyle);
			compatBarItemStyle(seriesOpt.emphasis);
			var data = seriesOpt.data;
			if (data && !isTypedArray(data)) {
				for (var i = 0; i < data.length; i++) if (typeof data[i] === "object") {
					compatBarItemStyle(data[i]);
					compatBarItemStyle(data[i] && data[i].emphasis);
				}
			}
		} else if (seriesType === "sunburst") {
			var highlightPolicy = seriesOpt.highlightPolicy;
			if (highlightPolicy) {
				seriesOpt.emphasis = seriesOpt.emphasis || {};
				if (!seriesOpt.emphasis.focus) seriesOpt.emphasis.focus = highlightPolicy;
			}
			compatSunburstState(seriesOpt);
			traverseTree(seriesOpt.data, compatSunburstState);
		} else if (seriesType === "graph" || seriesType === "sankey") compatGraphFocus(seriesOpt);
		else if (seriesType === "map") {
			if (seriesOpt.mapType && !seriesOpt.map) seriesOpt.map = seriesOpt.mapType;
			if (seriesOpt.mapLocation) defaults(seriesOpt, seriesOpt.mapLocation);
		}
		if (seriesOpt.hoverAnimation != null) {
			seriesOpt.emphasis = seriesOpt.emphasis || {};
			if (seriesOpt.emphasis && seriesOpt.emphasis.scale == null) seriesOpt.emphasis.scale = seriesOpt.hoverAnimation;
		}
		compatLayoutProperties(seriesOpt);
	});
	if (option.dataRange) option.visualMap = option.dataRange;
	each$1(COMPATITABLE_COMPONENTS, function(componentName) {
		var options = option[componentName];
		if (options) {
			if (!isArray(options)) options = [options];
			each$1(options, function(option) {
				compatLayoutProperties(option);
			});
		}
	});
}
//#endregion
//#region node_modules/echarts/lib/processor/dataStack.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var dataStackStageHandler = createSimpleOverallStageHandler2(dataStack);
function dataStack(ecModel) {
	var stackInfoMap = createHashMap();
	ecModel.eachSeries(function(seriesModel) {
		var stack = seriesModel.get("stack");
		if (stack) {
			var stackInfoList = stackInfoMap.get(stack) || stackInfoMap.set(stack, []);
			var data = seriesModel.getData();
			var stackInfo = {
				stackResultDimension: data.getCalculationInfo("stackResultDimension"),
				stackedOverDimension: data.getCalculationInfo("stackedOverDimension"),
				stackedDimension: data.getCalculationInfo("stackedDimension"),
				stackedByDimension: data.getCalculationInfo("stackedByDimension"),
				isStackedByIndex: data.getCalculationInfo("isStackedByIndex"),
				data,
				seriesModel
			};
			if (!stackInfo.stackedDimension || !(stackInfo.isStackedByIndex || stackInfo.stackedByDimension)) return;
			stackInfoList.push(stackInfo);
		}
	});
	stackInfoMap.each(function(stackInfoList) {
		if (stackInfoList.length === 0) return;
		if ((stackInfoList[0].seriesModel.get("stackOrder") || "seriesAsc") === "seriesDesc") stackInfoList.reverse();
		each$1(stackInfoList, function(stackInfo, index) {
			stackInfo.data.setCalculationInfo("stackedOnSeries", index > 0 ? stackInfoList[index - 1].seriesModel : null);
		});
		calculateStack(stackInfoList);
	});
}
function calculateStack(stackInfoList) {
	each$1(stackInfoList, function(targetStackInfo, idxInStack) {
		var resultVal = [];
		var resultNaN = [NaN, NaN];
		var dims = [targetStackInfo.stackResultDimension, targetStackInfo.stackedOverDimension];
		var targetData = targetStackInfo.data;
		var isStackedByIndex = targetStackInfo.isStackedByIndex;
		var stackStrategy = targetStackInfo.seriesModel.get("stackStrategy") || "samesign";
		targetData.modify(dims, function(v0, v1, dataIndex) {
			var sum = targetData.get(targetStackInfo.stackedDimension, dataIndex);
			if (isNaN(sum)) return resultNaN;
			var byValue;
			var stackedDataRawIndex;
			if (isStackedByIndex) stackedDataRawIndex = targetData.getRawIndex(dataIndex);
			else byValue = targetData.get(targetStackInfo.stackedByDimension, dataIndex);
			var stackedOver = NaN;
			for (var j = idxInStack - 1; j >= 0; j--) {
				var stackInfo = stackInfoList[j];
				if (!isStackedByIndex) stackedDataRawIndex = stackInfo.data.rawIndexOf(stackInfo.stackedByDimension, byValue);
				if (stackedDataRawIndex >= 0) {
					var val = stackInfo.data.getByRawIndex(stackInfo.stackResultDimension, stackedDataRawIndex);
					if (stackStrategy === "all" || stackStrategy === "positive" && val > 0 || stackStrategy === "negative" && val < 0 || stackStrategy === "samesign" && sum >= 0 && val > 0 || stackStrategy === "samesign" && sum <= 0 && val < 0) {
						sum = addSafe(sum, val);
						stackedOver = val;
						break;
					}
				}
			}
			resultVal[0] = sum;
			resultVal[1] = stackedOver;
			return resultVal;
		});
	});
}
//#endregion
//#region node_modules/echarts/lib/view/Component.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var ComponentView = function() {
	function ComponentView() {
		this.group = new Group();
		this.uid = getUID("viewComponent");
	}
	ComponentView.prototype.init = function(ecModel, api) {};
	ComponentView.prototype.render = function(model, ecModel, api, payload) {};
	ComponentView.prototype.dispose = function(ecModel, api) {};
	ComponentView.prototype.updateView = function(model, ecModel, api, payload) {};
	ComponentView.prototype.updateLayout = function(model, ecModel, api, payload) {};
	ComponentView.prototype.updateVisual = function(model, ecModel, api, payload) {};
	/**
	* Hook for toggle blur target series.
	* Can be used in marker for blur or leave blur the markers
	*/
	ComponentView.prototype.toggleBlurSeries = function(seriesModels, isBlur, ecModel) {};
	/**
	* Traverse the new rendered elements.
	*
	* It will traverse the new added element in progressive rendering.
	* And traverse all in normal rendering.
	*/
	ComponentView.prototype.eachRendered = function(cb) {
		var group = this.group;
		if (group) group.traverse(cb);
	};
	return ComponentView;
}();
enableClassExtend(ComponentView);
enableClassManagement(ComponentView);
//#endregion
//#region node_modules/echarts/lib/visual/style.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var inner = makeInner();
var defaultStyleMappers = {
	itemStyle: makeStyleMapper(ITEM_STYLE_KEY_MAP, true),
	lineStyle: makeStyleMapper(LINE_STYLE_KEY_MAP, true)
};
var defaultColorKey = {
	lineStyle: "stroke",
	itemStyle: "fill"
};
function getStyleMapper(seriesModel, stylePath) {
	var styleMapper = seriesModel.visualStyleMapper || defaultStyleMappers[stylePath];
	if (!styleMapper) {
		console.warn("Unknown style type '" + stylePath + "'.");
		return defaultStyleMappers.itemStyle;
	}
	return styleMapper;
}
function getDefaultColorKey(seriesModel, stylePath) {
	var colorKey = seriesModel.visualDrawType || defaultColorKey[stylePath];
	if (!colorKey) {
		console.warn("Unknown style type '" + stylePath + "'.");
		return "fill";
	}
	return colorKey;
}
var seriesStyleTask = {
	createOnAllSeries: true,
	performRawSeries: true,
	reset: function(seriesModel, ecModel) {
		var data = seriesModel.getData();
		var stylePath = seriesModel.visualStyleAccessPath || "itemStyle";
		var styleModel = seriesModel.getModel(stylePath);
		var globalStyle = getStyleMapper(seriesModel, stylePath)(styleModel);
		var decalOption = styleModel.getShallow("decal");
		if (decalOption) {
			data.setVisual("decal", decalOption);
			decalOption.dirty = true;
		}
		var colorKey = getDefaultColorKey(seriesModel, stylePath);
		var color = globalStyle[colorKey];
		var colorCallback = isFunction(color) ? color : null;
		var hasAutoColor = globalStyle.fill === "auto" || globalStyle.stroke === "auto";
		if (!globalStyle[colorKey] || colorCallback || hasAutoColor) {
			var colorPalette = seriesModel.getColorFromPalette(seriesModel.name, null, ecModel.getSeriesCount());
			if (!globalStyle[colorKey]) {
				globalStyle[colorKey] = colorPalette;
				data.setVisual("colorFromPalette", true);
			}
			globalStyle.fill = globalStyle.fill === "auto" || isFunction(globalStyle.fill) ? colorPalette : globalStyle.fill;
			globalStyle.stroke = globalStyle.stroke === "auto" || isFunction(globalStyle.stroke) ? colorPalette : globalStyle.stroke;
		}
		data.setVisual("style", globalStyle);
		data.setVisual("drawType", colorKey);
		if (!ecModel.isSeriesFiltered(seriesModel) && colorCallback) {
			data.setVisual("colorFromPalette", false);
			return { dataEach: function(data, idx) {
				var dataParams = seriesModel.getDataParams(idx);
				var itemStyle = extend({}, globalStyle);
				itemStyle[colorKey] = colorCallback(dataParams);
				data.setItemVisual(idx, "style", itemStyle);
			} };
		}
	}
};
var sharedModel = new Model();
var dataStyleTask = {
	createOnAllSeries: true,
	reset: function(seriesModel, ecModel) {
		if (seriesModel.ignoreStyleOnData) return;
		var data = seriesModel.getData();
		var stylePath = seriesModel.visualStyleAccessPath || "itemStyle";
		var getStyle = getStyleMapper(seriesModel, stylePath);
		var colorKey = data.getVisual("drawType");
		return { dataEach: data.hasItemOption ? function(data, idx) {
			var rawItem = data.getRawDataItem(idx);
			if (rawItem && rawItem[stylePath]) {
				sharedModel.option = rawItem[stylePath];
				var style = getStyle(sharedModel);
				var existsStyle = data.ensureUniqueItemVisual(idx, "style");
				extend(existsStyle, style);
				if (sharedModel.option.decal) {
					data.setItemVisual(idx, "decal", sharedModel.option.decal);
					sharedModel.option.decal.dirty = true;
				}
				if (colorKey in style) data.setItemVisual(idx, "colorFromPalette", false);
			}
		} : null };
	}
};
var dataColorPaletteTask = {
	performRawSeries: true,
	overallReset: function(ecModel) {
		var paletteScopeGroupByType = createHashMap();
		ecModel.eachSeries(function(seriesModel) {
			if (!seriesModel.isColorBySeries()) {
				var key = seriesModel.type + "-" + seriesModel.getColorBy();
				inner(seriesModel).scope = paletteScopeGroupByType.get(key) || paletteScopeGroupByType.set(key, {});
			}
		});
		ecModel.eachSeries(function(seriesModel) {
			if (seriesModel.isColorBySeries()) return;
			var dataAll = seriesModel.getRawData();
			var idxMap = {};
			var data = seriesModel.getData();
			var colorScope = inner(seriesModel).scope;
			var colorKey = getDefaultColorKey(seriesModel, seriesModel.visualStyleAccessPath || "itemStyle");
			data.each(function(idx) {
				var rawIdx = data.getRawIndex(idx);
				idxMap[rawIdx] = idx;
			});
			dataAll.each(function(rawIdx) {
				var idx = idxMap[rawIdx];
				if (data.getItemVisual(idx, "colorFromPalette")) {
					var itemStyle = data.ensureUniqueItemVisual(idx, "style");
					var name_1 = dataAll.getName(rawIdx) || rawIdx + "";
					var dataCount = dataAll.count();
					itemStyle[colorKey] = seriesModel.getColorFromPalette(name_1, colorScope, dataCount);
				}
			});
		});
	}
};
//#endregion
//#region node_modules/echarts/lib/loading/default.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var PI = Math.PI;
/**
* @param {module:echarts/ExtensionAPI} api
* @param {Object} [opts]
* @param {string} [opts.text]
* @param {string} [opts.color]
* @param {string} [opts.textColor]
* @return {module:zrender/Element}
*/
function defaultLoading(api, opts) {
	opts = opts || {};
	defaults(opts, {
		text: "loading",
		textColor: tokens.color.primary,
		fontSize: 12,
		fontWeight: "normal",
		fontStyle: "normal",
		fontFamily: "sans-serif",
		maskColor: "rgba(255,255,255,0.8)",
		showSpinner: true,
		color: tokens.color.theme[0],
		spinnerRadius: 10,
		lineWidth: 5,
		zlevel: 0
	});
	var group = new Group();
	var mask = new Rect({
		style: { fill: opts.maskColor },
		zlevel: opts.zlevel,
		z: 1e4
	});
	group.add(mask);
	var textContent = new ZRText({
		style: {
			text: opts.text,
			fill: opts.textColor,
			fontSize: opts.fontSize,
			fontWeight: opts.fontWeight,
			fontStyle: opts.fontStyle,
			fontFamily: opts.fontFamily
		},
		zlevel: opts.zlevel,
		z: 10001
	});
	var labelRect = new Rect({
		style: { fill: "none" },
		textContent,
		textConfig: {
			position: "right",
			distance: 10
		},
		zlevel: opts.zlevel,
		z: 10001
	});
	group.add(labelRect);
	var arc;
	if (opts.showSpinner) {
		arc = new Arc({
			shape: {
				startAngle: -PI / 2,
				endAngle: -PI / 2 + .1,
				r: opts.spinnerRadius
			},
			style: {
				stroke: opts.color,
				lineCap: "round",
				lineWidth: opts.lineWidth
			},
			zlevel: opts.zlevel,
			z: 10001
		});
		arc.animateShape(true).when(1e3, { endAngle: PI * 3 / 2 }).start("circularInOut");
		arc.animateShape(true).when(1e3, { startAngle: PI * 3 / 2 }).delay(300).start("circularInOut");
		group.add(arc);
	}
	group.resize = function() {
		var textWidth = textContent.getBoundingRect().width;
		var r = opts.showSpinner ? opts.spinnerRadius : 0;
		var cx = (api.getWidth() - r * 2 - (opts.showSpinner && textWidth ? 10 : 0) - textWidth) / 2 - (opts.showSpinner && textWidth ? 0 : 5 + textWidth / 2) + (opts.showSpinner ? 0 : textWidth / 2) + (textWidth ? 0 : r);
		var cy = api.getHeight() / 2;
		opts.showSpinner && arc.setShape({
			cx,
			cy
		});
		labelRect.setShape({
			x: cx - r,
			y: cy - r,
			width: r * 2,
			height: r * 2
		});
		mask.setShape({
			x: 0,
			y: 0,
			width: api.getWidth(),
			height: api.getHeight()
		});
	};
	group.resize();
	return group;
}
//#endregion
//#region node_modules/echarts/lib/core/Scheduler.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var Scheduler = function() {
	function Scheduler(ecInstance, api, dataProcessorHandlers, visualHandlers) {
		this._stageTaskMap = createHashMap();
		this.ecInstance = ecInstance;
		this.api = api;
		dataProcessorHandlers = this._dataProcessorHandlers = dataProcessorHandlers.slice();
		visualHandlers = this._visualHandlers = visualHandlers.slice();
		this._allHandlers = dataProcessorHandlers.concat(visualHandlers);
	}
	Scheduler.prototype.restoreData = function(ecModel, payload) {
		ecModel.restoreData(payload);
		this._stageTaskMap.each(function(taskRecord) {
			var overallTask = taskRecord.overallTask;
			overallTask && overallTask.dirty();
		});
	};
	Scheduler.prototype.getPerformArgs = function(task, isBlock) {
		if (!task.__pipeline) return;
		var pipeline = this._pipelineMap.get(task.__pipeline.id);
		var pCtx = pipeline.context;
		var step = !isBlock && pipeline.progressiveEnabled && (!pCtx || pCtx.progressiveRender) && task.__idxInPipeline > pipeline.blockIndex ? pipeline.step : null;
		var modDataCount = pCtx && pCtx.modDataCount;
		return {
			step,
			modBy: modDataCount != null ? Math.ceil(modDataCount / step) : null,
			modDataCount
		};
	};
	Scheduler.prototype.getPipeline = function(pipelineId) {
		return this._pipelineMap.get(pipelineId);
	};
	/**
	* Current, progressive rendering starts from visual and layout.
	* Always detect render mode in the same stage, avoiding that incorrect
	* detection caused by data filtering.
	* Caution:
	* `updateStreamModes` use `seriesModel.getData()`.
	*/
	Scheduler.prototype.updateStreamModes = function(seriesModel, view) {
		var pipeline = this._pipelineMap.get(seriesModel.uid);
		seriesModel.pipelineContext = pipeline.context = seriesModel.__preparePipelineContext ? seriesModel.__preparePipelineContext(view, pipeline) : preparePipelineContext(seriesModel, view, pipeline);
	};
	Scheduler.prototype.restorePipelines = function(zr, ecModel) {
		var scheduler = this;
		var pipelineMap = scheduler._pipelineMap = createHashMap();
		ecModel.eachSeries(function(seriesModel) {
			var progressive = zr.painter.type === "canvas" && seriesModel.getProgressive();
			var pipelineId = seriesModel.uid;
			pipelineMap.set(pipelineId, {
				id: pipelineId,
				head: null,
				tail: null,
				threshold: seriesModel.getProgressiveThreshold(),
				progressiveEnabled: progressive && !(seriesModel.preventIncremental && seriesModel.preventIncremental()),
				blockIndex: -1,
				step: Math.round(progressive || 700),
				count: 0
			});
			scheduler._pipe(seriesModel, seriesModel.dataTask);
		});
	};
	Scheduler.prototype.prepareStageTasks = function() {
		var stageTaskMap = this._stageTaskMap;
		var ecModel = this.api.getModel();
		var api = this.api;
		each$1(this._allHandlers, function(handler) {
			var record = stageTaskMap.get(handler.uid) || stageTaskMap.set(handler.uid, {});
			assert(!(handler.reset && handler.overallReset), "");
			handler.reset && this._createSeriesStageTask(handler, record, ecModel, api);
			handler.overallReset && this._createOverallStageTask(handler, record, ecModel, api);
		}, this);
	};
	Scheduler.prototype.prepareView = function(view, model, ecModel, api) {
		var renderTask = view.renderTask;
		var context = renderTask.context;
		context.model = model;
		context.ecModel = ecModel;
		context.api = api;
		renderTask.__block = !view.incrementalPrepareRender;
		this._pipe(model, renderTask);
	};
	Scheduler.prototype.performDataProcessorTasks = function(ecModel, payload) {
		this._performStageTasks(this._dataProcessorHandlers, ecModel, payload, { block: true });
	};
	Scheduler.prototype.performVisualTasks = function(ecModel, payload, opt) {
		this._performStageTasks(this._visualHandlers, ecModel, payload, opt);
	};
	Scheduler.prototype._performStageTasks = function(stageHandlers, ecModel, payload, opt) {
		opt = opt || {};
		var unfinished = false;
		var scheduler = this;
		each$1(stageHandlers, function(stageHandler, idx) {
			if (opt.visualType && opt.visualType !== stageHandler.visualType) return;
			var stageHandlerRecord = scheduler._stageTaskMap.get(stageHandler.uid);
			var seriesTaskMap = stageHandlerRecord.seriesTaskMap;
			var overallTask = stageHandlerRecord.overallTask;
			if (overallTask) {
				var overallNeedDirty_1;
				var agentStubMap = overallTask.agentStubMap;
				agentStubMap.each(function(stub) {
					if (needSetDirty(opt, stub)) {
						stub.dirty();
						overallNeedDirty_1 = true;
					}
				});
				overallNeedDirty_1 && overallTask.dirty();
				scheduler.updatePayload(overallTask, payload);
				var performArgs_1 = scheduler.getPerformArgs(overallTask, opt.block);
				agentStubMap.each(function(stub) {
					stub.perform(performArgs_1);
				});
				if (overallTask.perform(performArgs_1)) unfinished = true;
			} else if (seriesTaskMap) seriesTaskMap.each(function(task, pipelineId) {
				if (needSetDirty(opt, task)) task.dirty();
				var performArgs = scheduler.getPerformArgs(task, opt.block);
				performArgs.skip = !stageHandler.performRawSeries && ecModel.isSeriesFiltered(task.context.model);
				scheduler.updatePayload(task, payload);
				if (task.perform(performArgs)) unfinished = true;
			});
		});
		function needSetDirty(opt, task) {
			return opt.setDirty && (!opt.dirtyMap || opt.dirtyMap.get(task.__pipeline.id));
		}
		this.unfinished = unfinished || this.unfinished;
	};
	Scheduler.prototype.performSeriesTasks = function(ecModel) {
		var unfinished;
		ecModel.eachSeries(function(seriesModel) {
			unfinished = seriesModel.dataTask.perform() || unfinished;
		});
		this.unfinished = unfinished || this.unfinished;
	};
	Scheduler.prototype.plan = function() {
		this._pipelineMap.each(function(pipeline) {
			var task = pipeline.tail;
			do {
				if (task.__block) {
					pipeline.blockIndex = task.__idxInPipeline;
					break;
				}
				task = task.getUpstream();
			} while (task);
		});
	};
	Scheduler.prototype.updatePayload = function(task, payload) {
		payload !== "remain" && (task.context.payload = payload);
	};
	Scheduler.prototype._createSeriesStageTask = function(stageHandler, stageHandlerRecord, ecModel, api) {
		var scheduler = this;
		var oldSeriesTaskMap = stageHandlerRecord.seriesTaskMap;
		var newSeriesTaskMap = stageHandlerRecord.seriesTaskMap = createHashMap();
		var seriesType = stageHandler.seriesType;
		var getTargetSeries = stageHandler.getTargetSeries;
		if (stageHandler.createOnAllSeries) ecModel.eachRawSeries(create);
		else if (seriesType) ecModel.eachRawSeriesByType(seriesType, create);
		else if (getTargetSeries) getTargetSeries(ecModel, api).each(create);
		function create(seriesModel) {
			var pipelineId = seriesModel.uid;
			var task = newSeriesTaskMap.set(pipelineId, oldSeriesTaskMap && oldSeriesTaskMap.get(pipelineId) || createTask({
				plan: seriesTaskPlan,
				reset: seriesTaskReset,
				count: seriesTaskCount
			}));
			task.context = {
				model: seriesModel,
				ecModel,
				api,
				useClearVisual: stageHandler.isVisual && !stageHandler.isLayout,
				plan: stageHandler.plan,
				reset: stageHandler.reset,
				scheduler
			};
			scheduler._pipe(seriesModel, task);
		}
	};
	Scheduler.prototype._createOverallStageTask = function(stageHandler, stageHandlerRecord, ecModel, api) {
		var scheduler = this;
		var overallTask = stageHandlerRecord.overallTask = stageHandlerRecord.overallTask || createTask({ reset: overallTaskReset });
		overallTask.context = {
			ecModel,
			api,
			overallReset: stageHandler.overallReset,
			scheduler
		};
		var oldAgentStubMap = overallTask.agentStubMap;
		var newAgentStubMap = overallTask.agentStubMap = createHashMap();
		var seriesType = stageHandler.seriesType;
		var getTargetSeries = stageHandler.getTargetSeries;
		var dirtyOnOverallProgress = stageHandler.dirtyOnOverallProgress;
		var shouldOverallTaskDirty = false;
		assert(!stageHandler.createOnAllSeries, "");
		if (seriesType) ecModel.eachRawSeriesByType(seriesType, createStub);
		else if (getTargetSeries) getTargetSeries(ecModel, api).each(createStub);
		else each$1(ecModel.getSeries(), createStub);
		function createStub(seriesModel) {
			var pipelineId = seriesModel.uid;
			var stub = newAgentStubMap.set(pipelineId, oldAgentStubMap && oldAgentStubMap.get(pipelineId) || (shouldOverallTaskDirty = true, createTask({
				reset: stubReset,
				onDirty: stubOnDirty
			})));
			stub.context = {
				model: seriesModel,
				dirtyOnOverallProgress
			};
			stub.agent = overallTask;
			stub.__block = dirtyOnOverallProgress;
			scheduler._pipe(seriesModel, stub);
		}
		if (shouldOverallTaskDirty) overallTask.dirty();
	};
	Scheduler.prototype._pipe = function(seriesModel, task) {
		var pipelineId = seriesModel.uid;
		var pipeline = this._pipelineMap.get(pipelineId);
		!pipeline.head && (pipeline.head = task);
		pipeline.tail && pipeline.tail.pipe(task);
		pipeline.tail = task;
		task.__idxInPipeline = pipeline.count++;
		task.__pipeline = pipeline;
	};
	Scheduler.wrapStageHandler = function(stageHandler, visualType) {
		if (isFunction(stageHandler)) stageHandler = {
			overallReset: stageHandler,
			seriesType: detectSeriseType(stageHandler)
		};
		stageHandler.uid = getUID("stageHandler");
		visualType && (stageHandler.visualType = visualType);
		return stageHandler;
	};
	return Scheduler;
}();
function overallTaskReset(context) {
	context.overallReset(context.ecModel, context.api, context.payload);
}
function stubReset(context) {
	return context.dirtyOnOverallProgress && stubProgress;
}
function stubProgress() {
	this.agent.dirty();
	this.getDownstream().dirty();
}
function stubOnDirty() {
	this.agent && this.agent.dirty();
}
function seriesTaskPlan(context) {
	return context.plan ? context.plan(context.model, context.ecModel, context.api, context.payload) : null;
}
function seriesTaskReset(context) {
	if (context.useClearVisual) context.data.clearAllVisual();
	var resetDefines = context.resetDefines = normalizeToArray(context.reset(context.model, context.ecModel, context.api, context.payload));
	return resetDefines.length > 1 ? map(resetDefines, function(v, idx) {
		return makeSeriesTaskProgress(idx);
	}) : singleSeriesTaskProgress;
}
var singleSeriesTaskProgress = makeSeriesTaskProgress(0);
function makeSeriesTaskProgress(resetDefineIdx) {
	return function(params, context) {
		var data = context.data;
		var resetDefine = context.resetDefines[resetDefineIdx];
		if (resetDefine && resetDefine.dataEach) for (var i = params.start; i < params.end; i++) resetDefine.dataEach(data, i);
		else if (resetDefine && resetDefine.progress) resetDefine.progress(params, data);
	};
}
function seriesTaskCount(context) {
	return context.data.count();
}
/**
* Only some legacy stage handlers (usually in echarts extensions) are pure function.
* To ensure that they can work normally, they should work in block mode, that is,
* they should not be started util the previous tasks finished. So they cause the
* progressive rendering disabled. We try to detect the series type, to narrow down
* the block range to only the series type they concern, but not all series.
*/
function detectSeriseType(legacyFunc) {
	seriesType = null;
	try {
		legacyFunc(ecModelMock, apiMock);
	} catch (e) {}
	return seriesType;
}
var ecModelMock = {};
var apiMock = {};
var seriesType;
mockMethods(ecModelMock, GlobalModel);
mockMethods(apiMock, ExtensionAPI);
ecModelMock.eachSeriesByType = ecModelMock.eachRawSeriesByType = function(type) {
	seriesType = type;
};
ecModelMock.eachComponent = function(cond) {
	if (cond.mainType === "series" && cond.subType) seriesType = cond.subType;
};
function mockMethods(target, Clz) {
	for (var name_1 in Clz.prototype) target[name_1] = noop;
}
//#endregion
//#region node_modules/echarts/lib/theme/dark.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var color = tokens.darkColor;
var backgroundColor = color.background;
var axisCommon = function() {
	return {
		axisLine: { lineStyle: { color: color.axisLine } },
		splitLine: { lineStyle: { color: color.axisSplitLine } },
		splitArea: { areaStyle: { color: [color.backgroundTint, color.backgroundTransparent] } },
		minorSplitLine: { lineStyle: { color: color.axisMinorSplitLine } },
		axisLabel: { color: color.axisLabel },
		axisName: {}
	};
};
var matrixAxis = {
	label: { color: color.secondary },
	itemStyle: { borderColor: color.borderTint },
	dividerLineStyle: { color: color.border }
};
var theme = {
	darkMode: true,
	color: color.theme,
	backgroundColor,
	axisPointer: {
		lineStyle: { color: color.border },
		crossStyle: { color: color.borderShade },
		label: { color: color.tertiary }
	},
	legend: {
		textStyle: { color: color.secondary },
		pageTextStyle: { color: color.tertiary }
	},
	textStyle: { color: color.secondary },
	title: {
		textStyle: { color: color.primary },
		subtextStyle: { color: color.quaternary }
	},
	toolbox: {
		iconStyle: { borderColor: color.accent50 },
		feature: { dataView: {
			backgroundColor,
			textColor: color.primary,
			textareaColor: color.background,
			textareaBorderColor: color.border,
			buttonColor: color.accent50,
			buttonTextColor: color.neutral00
		} }
	},
	tooltip: {
		backgroundColor: color.neutral20,
		defaultBorderColor: color.border,
		textStyle: { color: color.tertiary }
	},
	dataZoom: {
		borderColor: color.accent10,
		textStyle: { color: color.tertiary },
		brushStyle: { color: color.backgroundTint },
		handleStyle: {
			color: color.neutral00,
			borderColor: color.accent20
		},
		moveHandleStyle: { color: color.accent40 },
		emphasis: { handleStyle: { borderColor: color.accent50 } },
		dataBackground: {
			lineStyle: { color: color.accent30 },
			areaStyle: { color: color.accent20 }
		},
		selectedDataBackground: {
			lineStyle: { color: color.accent50 },
			areaStyle: { color: color.accent30 }
		}
	},
	visualMap: {
		textStyle: { color: color.secondary },
		handleStyle: { borderColor: color.neutral30 }
	},
	timeline: {
		lineStyle: { color: color.accent10 },
		label: { color: color.tertiary },
		controlStyle: {
			color: color.accent30,
			borderColor: color.accent30
		}
	},
	calendar: {
		itemStyle: {
			color: color.neutral00,
			borderColor: color.neutral20
		},
		dayLabel: { color: color.tertiary },
		monthLabel: { color: color.secondary },
		yearLabel: { color: color.secondary }
	},
	matrix: {
		x: matrixAxis,
		y: matrixAxis,
		backgroundColor: { borderColor: color.axisLine },
		body: { itemStyle: { borderColor: color.borderTint } }
	},
	timeAxis: axisCommon(),
	logAxis: axisCommon(),
	valueAxis: axisCommon(),
	categoryAxis: axisCommon(),
	line: { symbol: "circle" },
	graph: { color: color.theme },
	gauge: {
		title: { color: color.secondary },
		axisLine: { lineStyle: { color: [[1, color.neutral05]] } },
		axisLabel: { color: color.axisLabel },
		detail: { color: color.primary }
	},
	candlestick: { itemStyle: {
		color: "#f64e56",
		color0: "#54ea92",
		borderColor: "#f64e56",
		borderColor0: "#54ea92"
	} },
	funnel: { itemStyle: { borderColor: color.background } },
	radar: function() {
		var radar = axisCommon();
		radar.axisName = { color: color.axisLabel };
		radar.axisLine.lineStyle.color = color.neutral20;
		return radar;
	}(),
	treemap: { breadcrumb: {
		itemStyle: {
			color: color.neutral20,
			textStyle: { color: color.secondary }
		},
		emphasis: { itemStyle: { color: color.neutral30 } }
	} },
	sunburst: { itemStyle: { borderColor: color.background } },
	map: {
		itemStyle: {
			borderColor: color.border,
			areaColor: color.neutral10
		},
		label: { color: color.tertiary },
		emphasis: {
			label: { color: color.primary },
			itemStyle: { areaColor: color.highlight }
		},
		select: {
			label: { color: color.primary },
			itemStyle: { areaColor: color.highlight }
		}
	},
	geo: {
		itemStyle: {
			borderColor: color.border,
			areaColor: color.neutral10
		},
		emphasis: {
			label: { color: color.primary },
			itemStyle: { areaColor: color.highlight }
		},
		select: {
			label: { color: color.primary },
			itemStyle: { color: color.highlight }
		}
	}
};
theme.categoryAxis.splitLine.show = false;
//#endregion
//#region node_modules/echarts/lib/util/ECEventProcessor.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* Usage of query:
* `chart.on('click', query, handler);`
* The `query` can be:
* + The component type query string, only `mainType` or `mainType.subType`,
*   like: 'xAxis', 'series', 'xAxis.category' or 'series.line'.
* + The component query object, like:
*   `{seriesIndex: 2}`, `{seriesName: 'xx'}`, `{seriesId: 'some'}`,
*   `{xAxisIndex: 2}`, `{xAxisName: 'xx'}`, `{xAxisId: 'some'}`.
* + The data query object, like:
*   `{dataIndex: 123}`, `{dataType: 'link'}`, `{name: 'some'}`.
* + The other query object (cmponent customized query), like:
*   `{element: 'some'}` (only available in custom series).
*
* Caveat: If a prop in the `query` object is `null/undefined`, it is the
* same as there is no such prop in the `query` object.
*/
var ECEventProcessor = function() {
	function ECEventProcessor() {}
	ECEventProcessor.prototype.normalizeQuery = function(query) {
		var cptQuery = {};
		var dataQuery = {};
		var otherQuery = {};
		if (isString(query)) {
			var condCptType = parseClassType(query);
			cptQuery.mainType = condCptType.main || null;
			cptQuery.subType = condCptType.sub || null;
		} else {
			var suffixes_1 = [
				"Index",
				"Name",
				"Id"
			];
			var dataKeys_1 = {
				name: 1,
				dataIndex: 1,
				dataType: 1
			};
			each$1(query, function(val, key) {
				var reserved = false;
				for (var i = 0; i < suffixes_1.length; i++) {
					var propSuffix = suffixes_1[i];
					var suffixPos = key.lastIndexOf(propSuffix);
					if (suffixPos > 0 && suffixPos === key.length - propSuffix.length) {
						var mainType = key.slice(0, suffixPos);
						if (mainType !== "data") {
							cptQuery.mainType = mainType;
							cptQuery[propSuffix.toLowerCase()] = val;
							reserved = true;
						}
					}
				}
				if (dataKeys_1.hasOwnProperty(key)) {
					dataQuery[key] = val;
					reserved = true;
				}
				if (!reserved) otherQuery[key] = val;
			});
		}
		return {
			cptQuery,
			dataQuery,
			otherQuery
		};
	};
	ECEventProcessor.prototype.filter = function(eventType, query) {
		var eventInfo = this.eventInfo;
		if (!eventInfo) return true;
		var targetEl = eventInfo.targetEl;
		var packedEvent = eventInfo.packedEvent;
		var model = eventInfo.model;
		var view = eventInfo.view;
		if (!model || !view) return true;
		var cptQuery = query.cptQuery;
		var dataQuery = query.dataQuery;
		return check(cptQuery, model, "mainType") && check(cptQuery, model, "subType") && check(cptQuery, model, "index", "componentIndex") && check(cptQuery, model, "name") && check(cptQuery, model, "id") && check(dataQuery, packedEvent, "name") && check(dataQuery, packedEvent, "dataIndex") && check(dataQuery, packedEvent, "dataType") && (!view.filterForExposedEvent || view.filterForExposedEvent(eventType, query.otherQuery, targetEl, packedEvent));
		function check(query, host, prop, propOnHost) {
			return query[prop] == null || host[propOnHost || prop] === query[prop];
		}
	};
	ECEventProcessor.prototype.afterTrigger = function() {
		this.eventInfo = null;
	};
	return ECEventProcessor;
}();
//#endregion
//#region node_modules/echarts/lib/visual/symbol.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var SYMBOL_PROPS_WITH_CB = [
	"symbol",
	"symbolSize",
	"symbolRotate",
	"symbolOffset"
];
var SYMBOL_PROPS = SYMBOL_PROPS_WITH_CB.concat(["symbolKeepAspect"]);
var seriesSymbolTask = {
	createOnAllSeries: true,
	performRawSeries: true,
	reset: function(seriesModel, ecModel) {
		var data = seriesModel.getData();
		if (seriesModel.legendIcon) data.setVisual("legendIcon", seriesModel.legendIcon);
		if (!seriesModel.hasSymbolVisual) return;
		var symbolOptions = {};
		var symbolOptionsCb = {};
		var hasCallback = false;
		for (var i = 0; i < SYMBOL_PROPS_WITH_CB.length; i++) {
			var symbolPropName = SYMBOL_PROPS_WITH_CB[i];
			var val = seriesModel.get(symbolPropName);
			if (isFunction(val)) {
				hasCallback = true;
				symbolOptionsCb[symbolPropName] = val;
			} else symbolOptions[symbolPropName] = val;
		}
		symbolOptions.symbol = symbolOptions.symbol || seriesModel.defaultSymbol;
		data.setVisual(extend({
			legendIcon: seriesModel.legendIcon || symbolOptions.symbol,
			symbolKeepAspect: seriesModel.get("symbolKeepAspect")
		}, symbolOptions));
		if (ecModel.isSeriesFiltered(seriesModel)) return;
		var symbolPropsCb = keys(symbolOptionsCb);
		function dataEach(data, idx) {
			var rawValue = seriesModel.getRawValue(idx);
			var params = seriesModel.getDataParams(idx);
			for (var i = 0; i < symbolPropsCb.length; i++) {
				var symbolPropName = symbolPropsCb[i];
				data.setItemVisual(idx, symbolPropName, symbolOptionsCb[symbolPropName](rawValue, params));
			}
		}
		return { dataEach: hasCallback ? dataEach : null };
	}
};
var dataSymbolTask = {
	createOnAllSeries: true,
	performRawSeries: true,
	reset: function(seriesModel, ecModel) {
		if (!seriesModel.hasSymbolVisual) return;
		if (ecModel.isSeriesFiltered(seriesModel)) return;
		var data = seriesModel.getData();
		function dataEach(data, idx) {
			var itemModel = data.getItemModel(idx);
			for (var i = 0; i < SYMBOL_PROPS.length; i++) {
				var symbolPropName = SYMBOL_PROPS[i];
				var val = itemModel.getShallow(symbolPropName, true);
				if (val != null) data.setItemVisual(idx, symbolPropName, val);
			}
		}
		return { dataEach: data.hasItemOption ? dataEach : null };
	}
};
//#endregion
//#region node_modules/echarts/lib/visual/helper.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function getItemVisualFromData(data, dataIndex, key) {
	switch (key) {
		case "color": return data.getItemVisual(dataIndex, "style")[data.getVisual("drawType")];
		case "opacity": return data.getItemVisual(dataIndex, "style").opacity;
		case "symbol":
		case "symbolSize":
		case "liftZ": return data.getItemVisual(dataIndex, key);
	}
}
function getVisualFromData(data, key) {
	switch (key) {
		case "color": return data.getVisual("style")[data.getVisual("drawType")];
		case "opacity": return data.getVisual("style").opacity;
		case "symbol":
		case "symbolSize":
		case "liftZ": return data.getVisual(key);
	}
}
//#endregion
//#region node_modules/echarts/lib/util/event.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function findEventDispatcher(target, det, returnFirstMatch) {
	var found;
	while (target) {
		if (det(target)) {
			found = target;
			if (returnFirstMatch) break;
		}
		target = target.__hostTarget || target.parent;
	}
	return found;
}
//#endregion
//#region node_modules/echarts/lib/core/lifecycle.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var lifecycle = new Eventful();
//#endregion
//#region node_modules/echarts/lib/core/impl.js
var implsStore = {};
function registerImpl(name, impl) {
	implsStore[name] = impl;
}
function getImpl(name) {
	return implsStore[name];
}
//#endregion
//#region node_modules/echarts/lib/chart/custom/customSeriesRegister.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var customRenderers = {};
function registerCustomSeries$1(type, renderItem) {
	customRenderers[type] = renderItem;
}
//#endregion
//#region node_modules/zrender/lib/core/WeakMap.js
var wmUniqueIndex = Math.round(Math.random() * 9);
var supportDefineProperty = typeof Object.defineProperty === "function";
//#endregion
//#region node_modules/echarts/lib/util/decal.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var decalMap = new (function() {
	function WeakMap() {
		this._id = "__ec_inner_" + wmUniqueIndex++;
	}
	WeakMap.prototype.get = function(key) {
		return this._guard(key)[this._id];
	};
	WeakMap.prototype.set = function(key, value) {
		var target = this._guard(key);
		if (supportDefineProperty) Object.defineProperty(target, this._id, {
			value,
			enumerable: false,
			configurable: true
		});
		else target[this._id] = value;
		return this;
	};
	WeakMap.prototype["delete"] = function(key) {
		if (this.has(key)) {
			delete this._guard(key)[this._id];
			return true;
		}
		return false;
	};
	WeakMap.prototype.has = function(key) {
		return !!this._guard(key)[this._id];
	};
	WeakMap.prototype._guard = function(key) {
		if (key !== Object(key)) throw TypeError("Value of WeakMap is not a non-null object.");
		return key;
	};
	return WeakMap;
}())();
var decalCache = new LRU(100);
var decalKeys = [
	"symbol",
	"symbolSize",
	"symbolKeepAspect",
	"color",
	"backgroundColor",
	"dashArrayX",
	"dashArrayY",
	"maxTileWidth",
	"maxTileHeight"
];
/**
* Create or update pattern image from decal options
*
* @param {InnerDecalObject | 'none'} decalObject decal options, 'none' if no decal
* @return {Pattern} pattern with generated image, null if no decal
*/
function createOrUpdatePatternFromDecal(decalObject, api) {
	if (decalObject === "none") return null;
	var dpr = api.getDevicePixelRatio();
	var zr = api.getZr();
	var isSVG = zr.painter.type === "svg";
	if (decalObject.dirty) decalMap["delete"](decalObject);
	var oldPattern = decalMap.get(decalObject);
	if (oldPattern) return oldPattern;
	var decalOpt = defaults(decalObject, {
		symbol: "rect",
		symbolSize: 1,
		symbolKeepAspect: true,
		color: "rgba(0, 0, 0, 0.2)",
		backgroundColor: null,
		dashArrayX: 5,
		dashArrayY: 5,
		rotation: 0,
		maxTileWidth: 512,
		maxTileHeight: 512
	});
	if (decalOpt.backgroundColor === "none") decalOpt.backgroundColor = null;
	var pattern = { repeat: "repeat" };
	setPatternnSource(pattern);
	pattern.rotation = decalOpt.rotation;
	pattern.scaleX = pattern.scaleY = isSVG ? 1 : 1 / dpr;
	decalMap.set(decalObject, pattern);
	decalObject.dirty = false;
	return pattern;
	function setPatternnSource(pattern) {
		var keys = [dpr];
		var isValidKey = true;
		for (var i = 0; i < decalKeys.length; ++i) {
			var value = decalOpt[decalKeys[i]];
			if (value != null && !isArray(value) && !isString(value) && !isNumber(value) && typeof value !== "boolean") {
				isValidKey = false;
				break;
			}
			keys.push(value);
		}
		var cacheKey;
		if (isValidKey) {
			cacheKey = keys.join(",") + (isSVG ? "-svg" : "");
			var cache = decalCache.get(cacheKey);
			if (cache) isSVG ? pattern.svgElement = cache : pattern.image = cache;
		}
		var dashArrayX = normalizeDashArrayX(decalOpt.dashArrayX);
		var dashArrayY = normalizeDashArrayY(decalOpt.dashArrayY);
		var symbolArray = normalizeSymbolArray(decalOpt.symbol);
		var lineBlockLengthsX = getLineBlockLengthX(dashArrayX);
		var lineBlockLengthY = getLineBlockLengthY(dashArrayY);
		var canvas = !isSVG && platformApi.createCanvas();
		var svgRoot = isSVG && {
			tag: "g",
			attrs: {},
			key: "dcl",
			children: []
		};
		var pSize = getPatternSize();
		var ctx;
		if (canvas) {
			canvas.width = pSize.width * dpr;
			canvas.height = pSize.height * dpr;
			ctx = canvas.getContext("2d");
		}
		brushDecal();
		if (isValidKey) decalCache.put(cacheKey, canvas || svgRoot);
		pattern.image = canvas;
		pattern.svgElement = svgRoot;
		pattern.svgWidth = pSize.width;
		pattern.svgHeight = pSize.height;
		/**
		* Get minimum length that can make a repeatable pattern.
		*
		* @return {Object} pattern width and height
		*/
		function getPatternSize() {
			/**
			* For example, if dash is [[3, 2], [2, 1]] for X, it looks like
			* |---  ---  ---  ---  --- ...
			* |-- -- -- -- -- -- -- -- ...
			* |---  ---  ---  ---  --- ...
			* |-- -- -- -- -- -- -- -- ...
			* So the minimum length of X is 15,
			* which is the least common multiple of `3 + 2` and `2 + 1`
			* |---  ---  ---  |---  --- ...
			* |-- -- -- -- -- |-- -- -- ...
			*/
			var width = 1;
			for (var i = 0, xlen = lineBlockLengthsX.length; i < xlen; ++i) width = getLeastCommonMultiple(width, lineBlockLengthsX[i]);
			var symbolRepeats = 1;
			for (var i = 0, xlen = symbolArray.length; i < xlen; ++i) symbolRepeats = getLeastCommonMultiple(symbolRepeats, symbolArray[i].length);
			width *= symbolRepeats;
			var height = lineBlockLengthY * lineBlockLengthsX.length * symbolArray.length;
			return {
				width: Math.max(1, Math.min(width, decalOpt.maxTileWidth)),
				height: Math.max(1, Math.min(height, decalOpt.maxTileHeight))
			};
		}
		function brushDecal() {
			if (ctx) {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				if (decalOpt.backgroundColor) {
					ctx.fillStyle = decalOpt.backgroundColor;
					ctx.fillRect(0, 0, canvas.width, canvas.height);
				}
			}
			var ySum = 0;
			for (var i = 0; i < dashArrayY.length; ++i) ySum += dashArrayY[i];
			if (ySum <= 0) return;
			var y = -lineBlockLengthY;
			var yId = 0;
			var yIdTotal = 0;
			var xId0 = 0;
			while (y < pSize.height) {
				if (yId % 2 === 0) {
					var symbolYId = yIdTotal / 2 % symbolArray.length;
					var x = 0;
					var xId1 = 0;
					var xId1Total = 0;
					while (x < pSize.width * 2) {
						var xSum = 0;
						for (var i = 0; i < dashArrayX[xId0].length; ++i) xSum += dashArrayX[xId0][i];
						if (xSum <= 0) break;
						if (xId1 % 2 === 0) {
							var size = (1 - decalOpt.symbolSize) * .5;
							var left = x + dashArrayX[xId0][xId1] * size;
							var top_1 = y + dashArrayY[yId] * size;
							var width = dashArrayX[xId0][xId1] * decalOpt.symbolSize;
							var height = dashArrayY[yId] * decalOpt.symbolSize;
							var symbolXId = xId1Total / 2 % symbolArray[symbolYId].length;
							brushSymbol(left, top_1, width, height, symbolArray[symbolYId][symbolXId]);
						}
						x += dashArrayX[xId0][xId1];
						++xId1Total;
						++xId1;
						if (xId1 === dashArrayX[xId0].length) xId1 = 0;
					}
					++xId0;
					if (xId0 === dashArrayX.length) xId0 = 0;
				}
				y += dashArrayY[yId];
				++yIdTotal;
				++yId;
				if (yId === dashArrayY.length) yId = 0;
			}
			function brushSymbol(x, y, width, height, symbolType) {
				var scale = isSVG ? 1 : dpr;
				var symbol = createSymbol(symbolType, x * scale, y * scale, width * scale, height * scale, decalOpt.color, decalOpt.symbolKeepAspect);
				if (isSVG) {
					var symbolVNode = zr.painter.renderOneToVNode(symbol);
					if (symbolVNode) svgRoot.children.push(symbolVNode);
				} else brushSingle(ctx, symbol);
			}
		}
	}
}
/**
* Convert symbol array into normalized array
*
* @param {string | (string | string[])[]} symbol symbol input
* @return {string[][]} normolized symbol array
*/
function normalizeSymbolArray(symbol) {
	if (!symbol || symbol.length === 0) return [["rect"]];
	if (isString(symbol)) return [[symbol]];
	var isAllString = true;
	for (var i = 0; i < symbol.length; ++i) if (!isString(symbol[i])) {
		isAllString = false;
		break;
	}
	if (isAllString) return normalizeSymbolArray([symbol]);
	var result = [];
	for (var i = 0; i < symbol.length; ++i) if (isString(symbol[i])) result.push([symbol[i]]);
	else result.push(symbol[i]);
	return result;
}
/**
* Convert dash input into dashArray
*
* @param {DecalDashArrayX} dash dash input
* @return {number[][]} normolized dash array
*/
function normalizeDashArrayX(dash) {
	if (!dash || dash.length === 0) return [[0, 0]];
	if (isNumber(dash)) {
		var dashValue = Math.ceil(dash);
		return [[dashValue, dashValue]];
	}
	/**
	* [20, 5] should be normalized into [[20, 5]],
	* while [20, [5, 10]] should be normalized into [[20, 20], [5, 10]]
	*/
	var isAllNumber = true;
	for (var i = 0; i < dash.length; ++i) if (!isNumber(dash[i])) {
		isAllNumber = false;
		break;
	}
	if (isAllNumber) return normalizeDashArrayX([dash]);
	var result = [];
	for (var i = 0; i < dash.length; ++i) if (isNumber(dash[i])) {
		var dashValue = Math.ceil(dash[i]);
		result.push([dashValue, dashValue]);
	} else {
		var dashValue = map(dash[i], function(n) {
			return Math.ceil(n);
		});
		if (dashValue.length % 2 === 1) result.push(dashValue.concat(dashValue));
		else result.push(dashValue);
	}
	return result;
}
/**
* Convert dash input into dashArray
*
* @param {DecalDashArrayY} dash dash input
* @return {number[]} normolized dash array
*/
function normalizeDashArrayY(dash) {
	if (!dash || typeof dash === "object" && dash.length === 0) return [0, 0];
	if (isNumber(dash)) {
		var dashValue_1 = Math.ceil(dash);
		return [dashValue_1, dashValue_1];
	}
	var dashValue = map(dash, function(n) {
		return Math.ceil(n);
	});
	return dash.length % 2 ? dashValue.concat(dashValue) : dashValue;
}
/**
* Get block length of each line. A block is the length of dash line and space.
* For example, a line with [4, 1] has a dash line of 4 and a space of 1 after
* that, so the block length of this line is 5.
*
* @param {number[][]} dash dash array of X or Y
* @return {number[]} block length of each line
*/
function getLineBlockLengthX(dash) {
	return map(dash, function(line) {
		return getLineBlockLengthY(line);
	});
}
function getLineBlockLengthY(dash) {
	var blockLength = 0;
	for (var i = 0; i < dash.length; ++i) blockLength += dash[i];
	if (dash.length % 2 === 1) return blockLength * 2;
	return blockLength;
}
//#endregion
//#region node_modules/echarts/lib/visual/decal.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var decalVisualStageHandler = createSimpleOverallStageHandler2(decalVisual);
function decalVisual(ecModel, api) {
	ecModel.eachRawSeries(function(seriesModel) {
		if (ecModel.isSeriesFiltered(seriesModel)) return;
		var data = seriesModel.getData();
		if (data.hasItemVisual()) data.each(function(idx) {
			var decal = data.getItemVisual(idx, "decal");
			if (decal) {
				var itemStyle = data.ensureUniqueItemVisual(idx, "style");
				itemStyle.decal = createOrUpdatePatternFromDecal(decal, api);
			}
		});
		var decal = data.getVisual("decal");
		if (decal) {
			var style = data.getVisual("style");
			style.decal = createOrUpdatePatternFromDecal(decal, api);
		}
	});
}
//#endregion
//#region node_modules/echarts/lib/core/echarts.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var version = "6.1.0";
var dependencies = { zrender: "6.1.0" };
var TEST_FRAME_REMAIN_TIME = 1;
var PRIORITY_PROCESSOR_SERIES_FILTER = 800;
var PRIORITY_PROCESSOR_DATASTACK = 900;
var PRIORITY_PROCESSOR_AXIS_STATISTICS = 920;
var PRIORITY_PROCESSOR_FILTER = 1e3;
var PRIORITY_PROCESSOR_DEFAULT = 2e3;
var PRIORITY_PROCESSOR_STATISTICS = 5e3;
var PRIORITY_VISUAL_LAYOUT = 1e3;
var PRIORITY_VISUAL_PROGRESSIVE_LAYOUT = 1100;
var PRIORITY_VISUAL_GLOBAL = 2e3;
var PRIORITY_VISUAL_CHART = 3e3;
var PRIORITY_VISUAL_COMPONENT = 4e3;
var PRIORITY_VISUAL_CHART_DATA_CUSTOM = 4500;
var PRIORITY_VISUAL_POST_CHART_LAYOUT = 4600;
var PRIORITY_VISUAL_BRUSH = 5e3;
var PRIORITY_VISUAL_ARIA = 6e3;
var PRIORITY_VISUAL_DECAL = 7e3;
var PRIORITY = {
	PROCESSOR: {
		SERIES_FILTER: PRIORITY_PROCESSOR_SERIES_FILTER,
		AXIS_STATISTICS: PRIORITY_PROCESSOR_AXIS_STATISTICS,
		FILTER: PRIORITY_PROCESSOR_FILTER,
		STATISTIC: PRIORITY_PROCESSOR_STATISTICS,
		STATISTICS: PRIORITY_PROCESSOR_STATISTICS
	},
	VISUAL: {
		LAYOUT: PRIORITY_VISUAL_LAYOUT,
		PROGRESSIVE_LAYOUT: PRIORITY_VISUAL_PROGRESSIVE_LAYOUT,
		GLOBAL: PRIORITY_VISUAL_GLOBAL,
		CHART: PRIORITY_VISUAL_CHART,
		POST_CHART_LAYOUT: PRIORITY_VISUAL_POST_CHART_LAYOUT,
		COMPONENT: PRIORITY_VISUAL_COMPONENT,
		BRUSH: PRIORITY_VISUAL_BRUSH,
		CHART_ITEM: PRIORITY_VISUAL_CHART_DATA_CUSTOM,
		ARIA: PRIORITY_VISUAL_ARIA,
		DECAL: PRIORITY_VISUAL_DECAL
	}
};
/**
* @tutorial [EC_CYCLE] (ec updating/rendering cycles):
*
*  - Common Rules:
*    - Nested entry is not allowed. If triggering a new run of EC_CYCLE during a
*      unfinished run, the new run will be delayed until the current run finishes
*      (if triggered by `dispatchAction`), or throw error (if triggered by other API calls).
*    - All user-visible ec events are triggered outside EC_CYCLE.
*      (i.e. be triggered after `this[IN_EC_CYCLE_KEY]` becoming `false`).
*
*  - [EC_FULL_UPDATE_CYCLE]:
*    - It designates a run of a series of processing/updating/rendering.
*    - It is triggered by:
*      - `setOption`
*      - `dispatchAction`
*        (It is typically internally triggered by user inputs; but can also an explicit API call.)
*      - `resize`
*      - The next "animation frame" if in `lazyMode: true`.
*    - A run of EC_FULL_UPDATE_CYCLE comprises:
*      - EC_PREPARE (may be absent)
*      - EC_FULL_UPDATE:
*        - CoordinateSystem['create']
*        - Data processing (may be absent) (see `registerProcessor`)
*        - CoordinateSystem['update'] (may be absent)
*        - Visual encoding (may be absent) (see `registerVisual`)
*        - Layout (may be absent) (see `registerLayout`)
*        - Rendering (`ComponentView` or `SeriesView`)
*
*  - [EC_PARTIAL_UPDATE_CYCLE]s:
*      - They are shortcuts for performance.
*      - They are triggered by:
*        - `dispatchAction`
*      - These steps are typically omitted:
*        - No EC_PREPARE
*        - No CoordinateSystem['create'] and CoordinateSystem['update']
*      - They require careful implementation, otherwise inconsistency may be introduced.
*
*  - [EC_PROGRESSIVE_CYCLE]:
*    - It also carries out a series of processing/updating/rendering.
*    - It is performed in each subsequent "animation frame" until finished.
*    - It can be triggered by EC_FULL_UPDATE_CYCLE, EC_PARTIAL_UPDATE_CYCLE or EC_APPEND_DATA_CYCLE.
*    - A run of EC_PROGRESSIVE_CYCLE comprises:
*      - Data processing (may be absent) (see `registerProcessor`)
*      - Visual encoding (may be absent) (see `registerVisual`)
*      - Layout (may be absent) (see `registerLayout`)
*      - Rendering (`ComponentView` or `SeriesView`)
*    - PENDING: currently all data processing tasks (via `registerProcessor`) run in "block" mode.
*      (see `performDataProcessorTasks`).
*
*  - [EC_APPEND_DATA_CYCLE]:
*    - See `appendData`. It is only supported for some special cases.
*
*  - [SERIES_SPECIFIC_CYCLE]s:
*    - Series may have specific update/render cycles. For example, graph force layout performs
*      layout and rendering in each "animation frame".
*
*  - Model updating:
*    - Model can only be modified at the beginning of ec cycles, including only:
*      - EC_PREPARE (see method `prepare()`) in `setOption` call.
*      - EC action handlers in `dispatchAction` call.
*      - `appendData` (a special case, where only data can be modified).
*
*  - The lifetime of CoordinateSystem/Axis/Scale instances:
*    - They are only re-created per run of EC_FULL_UPDATE_CYCLE.
*
*  - Global caches: see `cycleCache.ts`
*/
var IN_EC_CYCLE_KEY = "__flagInMainProcess";
var EC_UPDATE_CYCLE_VERSION_KEY = "__mainProcessVersion";
var PENDING_UPDATE = "__pendingUpdate";
var STATUS_NEEDS_UPDATE_KEY = "__needsUpdateStatus";
var ACTION_REG = /^[a-zA-Z0-9_]+$/;
var CONNECT_STATUS_KEY = "__connectUpdateStatus";
var CONNECT_STATUS_PENDING = 0;
var CONNECT_STATUS_UPDATING = 1;
var CONNECT_STATUS_UPDATED = 2;
function createRegisterEventWithLowercaseECharts(method) {
	return function() {
		var args = [];
		for (var _i = 0; _i < arguments.length; _i++) args[_i] = arguments[_i];
		if (this.isDisposed()) {
			this.id;
			return;
		}
		return toLowercaseNameAndCallEventful(this, method, args);
	};
}
function createRegisterEventWithLowercaseMessageCenter(method) {
	return function() {
		var args = [];
		for (var _i = 0; _i < arguments.length; _i++) args[_i] = arguments[_i];
		return toLowercaseNameAndCallEventful(this, method, args);
	};
}
function toLowercaseNameAndCallEventful(host, method, args) {
	args[0] = args[0] && args[0].toLowerCase();
	return Eventful.prototype[method].apply(host, args);
}
var MessageCenter = function(_super) {
	__extends(MessageCenter, _super);
	function MessageCenter() {
		return _super !== null && _super.apply(this, arguments) || this;
	}
	return MessageCenter;
}(Eventful);
var messageCenterProto = MessageCenter.prototype;
messageCenterProto.on = createRegisterEventWithLowercaseMessageCenter("on");
messageCenterProto.off = createRegisterEventWithLowercaseMessageCenter("off");
var prepare;
var prepareView;
var updateDirectly;
var updateMethods;
var doConvertPixel;
var updateStreamModes;
var doDispatchAction;
var flushPendingActions;
var triggerUpdatedEvent;
var bindRenderedEvent;
var bindMouseEvent;
var render;
var renderComponents;
var renderSeries;
var createExtensionAPI;
var enableConnect;
var markStatusToUpdate;
var applyChangedStates;
var updateECUpdateCycleVersion;
var ECharts = function(_super) {
	__extends(ECharts, _super);
	function ECharts(dom, theme, opts) {
		var _this = _super.call(this, new ECEventProcessor()) || this;
		_this._chartsViews = [];
		_this._chartsMap = {};
		_this._componentsViews = [];
		_this._componentsMap = {};
		_this._pendingActions = [];
		opts = opts || {};
		_this.__v_skip = true;
		_this._dom = dom;
		var defaultRenderer = "canvas";
		var defaultCoarsePointer = "auto";
		var defaultUseDirtyRect = false;
		_this[EC_UPDATE_CYCLE_VERSION_KEY] = 1;
		if (opts.ssr) registerSSRDataGetter(function(el) {
			var ecData = getECData(el);
			var dataIndex = ecData.dataIndex;
			if (dataIndex == null) return;
			var hashMap = createHashMap();
			hashMap.set("series_index", ecData.seriesIndex);
			hashMap.set("data_index", dataIndex);
			ecData.ssrType && hashMap.set("ssr_type", ecData.ssrType);
			return hashMap;
		});
		var zr = _this._zr = init$1(dom, {
			renderer: opts.renderer || defaultRenderer,
			devicePixelRatio: opts.devicePixelRatio,
			width: opts.width,
			height: opts.height,
			ssr: opts.ssr,
			useDirtyRect: retrieve2(opts.useDirtyRect, defaultUseDirtyRect),
			useCoarsePointer: retrieve2(opts.useCoarsePointer, defaultCoarsePointer),
			pointerSize: opts.pointerSize
		});
		_this._ssr = opts.ssr;
		_this._throttledZrFlush = throttle(bind(zr.flush, zr), 17);
		_this._updateTheme(theme);
		_this._locale = createLocaleObject(opts.locale || SYSTEM_LANG);
		_this._coordSysMgr = new CoordinateSystemManager();
		var api = _this._api = createExtensionAPI(_this);
		function prioritySortFunc(a, b) {
			return a.__prio - b.__prio;
		}
		sort(visualFuncs, prioritySortFunc);
		sort(dataProcessorFuncs, prioritySortFunc);
		_this._scheduler = new Scheduler(_this, api, dataProcessorFuncs, visualFuncs);
		_this._messageCenter = new MessageCenter();
		_this._initEvents();
		_this.resize = bind(_this.resize, _this);
		zr.animation.on("frame", _this._onframe, _this);
		bindRenderedEvent(zr, _this);
		bindMouseEvent(zr, _this);
		setAsPrimitive(_this);
		return _this;
	}
	ECharts.prototype._onframe = function() {
		if (this._disposed) return;
		var scheduler = this._scheduler;
		var ecModel = this._model;
		var api = this._api;
		applyChangedStates(this);
		if (this[PENDING_UPDATE]) {
			var silent = this[PENDING_UPDATE].silent;
			this[IN_EC_CYCLE_KEY] = true;
			updateECUpdateCycleVersion(this);
			try {
				prepare(this);
				updateMethods.update.call(this, null, this[PENDING_UPDATE].updateParams);
			} catch (e) {
				this[IN_EC_CYCLE_KEY] = false;
				this[PENDING_UPDATE] = null;
				throw e;
			}
			this._zr.flush();
			this[IN_EC_CYCLE_KEY] = false;
			this[PENDING_UPDATE] = null;
			flushPendingActions.call(this, silent);
			triggerUpdatedEvent.call(this, silent);
		} else if (scheduler.unfinished) {
			var remainTime = TEST_FRAME_REMAIN_TIME;
			do {
				scheduler.unfinished = false;
				var startTime = platformApi.getTime();
				scheduler.performSeriesTasks(ecModel);
				scheduler.performDataProcessorTasks(ecModel);
				updateStreamModes(this, ecModel);
				scheduler.performVisualTasks(ecModel);
				renderSeries(this, this._model, api, "remain", {});
				remainTime -= platformApi.getTime() - startTime;
			} while (remainTime > 0 && scheduler.unfinished);
			if (!scheduler.unfinished) this._zr.flush();
		}
	};
	ECharts.prototype.getDom = function() {
		return this._dom;
	};
	ECharts.prototype.getId = function() {
		return this.id;
	};
	ECharts.prototype.getZr = function() {
		return this._zr;
	};
	ECharts.prototype.isSSR = function() {
		return this._ssr;
	};
	ECharts.prototype.setOption = function(option, notMerge, lazyUpdate) {
		if (this[IN_EC_CYCLE_KEY]) return;
		if (this._disposed) {
			this.id;
			return;
		}
		var silent;
		var replaceMerge;
		var transitionOpt;
		if (isObject$1(notMerge)) {
			lazyUpdate = notMerge.lazyUpdate;
			silent = notMerge.silent;
			replaceMerge = notMerge.replaceMerge;
			transitionOpt = notMerge.transition;
			notMerge = notMerge.notMerge;
		}
		this[IN_EC_CYCLE_KEY] = true;
		updateECUpdateCycleVersion(this);
		if (!this._model || notMerge) {
			var optionManager = new OptionManager(this._api);
			var theme = this._theme;
			var ecModel = this._model = new GlobalModel();
			ecModel.scheduler = this._scheduler;
			ecModel.ssr = this._ssr;
			ecModel.init(null, null, null, theme, this._locale, optionManager);
		}
		this._model.setOption(option, { replaceMerge }, optionPreprocessorFuncs);
		var updateParams = {
			seriesTransition: transitionOpt,
			optionChanged: true
		};
		if (lazyUpdate) {
			this[PENDING_UPDATE] = {
				silent,
				updateParams
			};
			this[IN_EC_CYCLE_KEY] = false;
			this.getZr().wakeUp();
		} else {
			try {
				prepare(this);
				updateMethods.update.call(this, null, updateParams);
			} catch (e) {
				this[PENDING_UPDATE] = null;
				this[IN_EC_CYCLE_KEY] = false;
				throw e;
			}
			if (!this._ssr) this._zr.flush();
			this[PENDING_UPDATE] = null;
			this[IN_EC_CYCLE_KEY] = false;
			flushPendingActions.call(this, silent);
			triggerUpdatedEvent.call(this, silent);
		}
	};
	/**
	* Update theme with name or theme option and repaint the chart.
	* @param theme Theme name or theme option.
	* @param opts Optional settings
	*/
	ECharts.prototype.setTheme = function(theme, opts) {
		if (this[IN_EC_CYCLE_KEY]) return;
		if (this._disposed) {
			this.id;
			return;
		}
		var ecModel = this._model;
		if (!ecModel) return;
		var silent = opts && opts.silent;
		var updateParams = null;
		if (this[PENDING_UPDATE]) {
			if (silent == null) silent = this[PENDING_UPDATE].silent;
			updateParams = this[PENDING_UPDATE].updateParams;
			this[PENDING_UPDATE] = null;
		}
		this[IN_EC_CYCLE_KEY] = true;
		updateECUpdateCycleVersion(this);
		try {
			this._updateTheme(theme);
			ecModel.setTheme(this._theme);
			prepare(this);
			updateMethods.update.call(this, { type: "setTheme" }, updateParams);
		} catch (e) {
			this[IN_EC_CYCLE_KEY] = false;
			throw e;
		}
		this[IN_EC_CYCLE_KEY] = false;
		flushPendingActions.call(this, silent);
		triggerUpdatedEvent.call(this, silent);
	};
	ECharts.prototype._updateTheme = function(theme) {
		if (isString(theme)) theme = themeStorage[theme];
		if (theme) {
			theme = clone(theme);
			theme && globalBackwardCompat(theme, true);
			this._theme = theme;
		}
	};
	ECharts.prototype.getModel = function() {
		return this._model;
	};
	ECharts.prototype.getOption = function() {
		return this._model && this._model.getOption();
	};
	ECharts.prototype.getWidth = function() {
		return this._zr.getWidth();
	};
	ECharts.prototype.getHeight = function() {
		return this._zr.getHeight();
	};
	ECharts.prototype.getDevicePixelRatio = function() {
		return this._zr.painter.dpr || env.hasGlobalWindow && window.devicePixelRatio || 1;
	};
	/**
	* Get canvas which has all thing rendered
	* @deprecated Use renderToCanvas instead.
	*/
	ECharts.prototype.getRenderedCanvas = function(opts) {
		return this.renderToCanvas(opts);
	};
	ECharts.prototype.renderToCanvas = function(opts) {
		opts = opts || {};
		return this._zr.painter.getRenderedCanvas({
			backgroundColor: opts.backgroundColor || this._model.get("backgroundColor"),
			pixelRatio: opts.pixelRatio || this.getDevicePixelRatio()
		});
	};
	ECharts.prototype.renderToSVGString = function(opts) {
		opts = opts || {};
		return this._zr.painter.renderToString({ useViewBox: opts.useViewBox });
	};
	/**
	* Get svg data url
	*/
	ECharts.prototype.getSvgDataURL = function() {
		var zr = this._zr;
		var list = zr.storage.getDisplayList();
		each$1(list, function(el) {
			el.stopAnimation(null, true);
		});
		return zr.painter.toDataURL();
	};
	ECharts.prototype.getDataURL = function(opts) {
		if (this._disposed) {
			this.id;
			return;
		}
		opts = opts || {};
		var excludeComponents = opts.excludeComponents;
		var ecModel = this._model;
		var excludesComponentViews = [];
		var self = this;
		each$1(excludeComponents, function(componentType) {
			ecModel.eachComponent({ mainType: componentType }, function(component) {
				var view = self._componentsMap[component.__viewId];
				if (!view.group.ignore) {
					excludesComponentViews.push(view);
					view.group.ignore = true;
				}
			});
		});
		var url = this._zr.painter.getType() === "svg" ? this.getSvgDataURL() : this.renderToCanvas(opts).toDataURL("image/" + (opts && opts.type || "png"));
		each$1(excludesComponentViews, function(view) {
			view.group.ignore = false;
		});
		return url;
	};
	ECharts.prototype.getConnectedDataURL = function(opts) {
		if (this._disposed) {
			this.id;
			return;
		}
		var isSvg = opts.type === "svg";
		var groupId = this.group;
		var mathMin = Math.min;
		var mathMax = Math.max;
		var MAX_NUMBER = Infinity;
		if (connectedGroups[groupId]) {
			var left_1 = MAX_NUMBER;
			var top_1 = MAX_NUMBER;
			var right_1 = -MAX_NUMBER;
			var bottom_1 = -MAX_NUMBER;
			var canvasList_1 = [];
			var dpr_1 = opts && opts.pixelRatio || this.getDevicePixelRatio();
			each$1(instances, function(chart, id) {
				if (chart.group === groupId) {
					var canvas = isSvg ? chart.getZr().painter.getSvgDom().innerHTML : chart.renderToCanvas(clone(opts));
					var boundingRect = chart.getDom().getBoundingClientRect();
					left_1 = mathMin(boundingRect.left, left_1);
					top_1 = mathMin(boundingRect.top, top_1);
					right_1 = mathMax(boundingRect.right, right_1);
					bottom_1 = mathMax(boundingRect.bottom, bottom_1);
					canvasList_1.push({
						dom: canvas,
						left: boundingRect.left,
						top: boundingRect.top
					});
				}
			});
			left_1 *= dpr_1;
			top_1 *= dpr_1;
			right_1 *= dpr_1;
			bottom_1 *= dpr_1;
			var width = right_1 - left_1;
			var height = bottom_1 - top_1;
			var targetCanvas = platformApi.createCanvas();
			var zr_1 = init$1(targetCanvas, { renderer: isSvg ? "svg" : "canvas" });
			zr_1.resize({
				width,
				height
			});
			if (isSvg) {
				var content_1 = "";
				each$1(canvasList_1, function(item) {
					var x = item.left - left_1;
					var y = item.top - top_1;
					content_1 += "<g transform=\"translate(" + x + "," + y + ")\">" + item.dom + "</g>";
				});
				zr_1.painter.getSvgRoot().innerHTML = content_1;
				if (opts.connectedBackgroundColor) zr_1.painter.setBackgroundColor(opts.connectedBackgroundColor);
				zr_1.refreshImmediately();
				return zr_1.painter.toDataURL();
			} else {
				if (opts.connectedBackgroundColor) zr_1.add(new Rect({
					shape: {
						x: 0,
						y: 0,
						width,
						height
					},
					style: { fill: opts.connectedBackgroundColor }
				}));
				each$1(canvasList_1, function(item) {
					var img = new ZRImage({ style: {
						x: item.left * dpr_1 - left_1,
						y: item.top * dpr_1 - top_1,
						image: item.dom
					} });
					zr_1.add(img);
				});
				zr_1.refreshImmediately();
				return targetCanvas.toDataURL("image/" + (opts && opts.type || "png"));
			}
		} else return this.getDataURL(opts);
	};
	ECharts.prototype.convertToPixel = function(finder, value, opt) {
		return doConvertPixel(this, "convertToPixel", finder, value, opt);
	};
	/**
	* Convert from logical coordinate system to pixel coordinate system.
	* See CoordinateSystem#convertToPixel.
	*
	* @see CoordinateSystem['dataToLayout'] for parameters and return.
	* @see CoordinateSystemDataCoord
	*/
	ECharts.prototype.convertToLayout = function(finder, value, opt) {
		return doConvertPixel(this, "convertToLayout", finder, value, opt);
	};
	ECharts.prototype.convertFromPixel = function(finder, value, opt) {
		return doConvertPixel(this, "convertFromPixel", finder, value, opt);
	};
	/**
	* Is the specified coordinate systems or components contain the given pixel point.
	* @param {Array|number} value
	* @return {boolean} result
	*/
	ECharts.prototype.containPixel = function(finder, value) {
		if (this._disposed) {
			this.id;
			return;
		}
		var ecModel = this._model;
		var result;
		var findResult = parseFinder(ecModel, finder);
		each$1(findResult, function(models, key) {
			key.indexOf("Models") >= 0 && each$1(models, function(model) {
				var coordSys = model.coordinateSystem;
				if (coordSys && coordSys.containPoint) result = result || !!coordSys.containPoint(value);
				else if (key === "seriesModels") {
					var view = this._chartsMap[model.__viewId];
					if (view && view.containPoint) result = result || view.containPoint(value, model);
				}
			}, this);
		}, this);
		return !!result;
	};
	/**
	* Get visual from series or data.
	* @param finder
	*        If string, e.g., 'series', means {seriesIndex: 0}.
	*        If Object, could contain some of these properties below:
	*        {
	*            seriesIndex / seriesId / seriesName,
	*            dataIndex / dataIndexInside
	*        }
	*        If dataIndex is not specified, series visual will be fetched,
	*        but not data item visual.
	*        If all of seriesIndex, seriesId, seriesName are not specified,
	*        visual will be fetched from first series.
	* @param visualType 'color', 'symbol', 'symbolSize'
	*/
	ECharts.prototype.getVisual = function(finder, visualType) {
		var ecModel = this._model;
		var parsedFinder = parseFinder(ecModel, finder, { defaultMainType: "series" });
		var data = parsedFinder.seriesModel.getData();
		var dataIndexInside = parsedFinder.hasOwnProperty("dataIndexInside") ? parsedFinder.dataIndexInside : parsedFinder.hasOwnProperty("dataIndex") ? data.indexOfRawIndex(parsedFinder.dataIndex) : null;
		return dataIndexInside != null ? getItemVisualFromData(data, dataIndexInside, visualType) : getVisualFromData(data, visualType);
	};
	/**
	* Get view of corresponding component model
	*/
	ECharts.prototype.getViewOfComponentModel = function(componentModel) {
		return this._componentsMap[componentModel.__viewId];
	};
	/**
	* Get view of corresponding series model
	*/
	ECharts.prototype.getViewOfSeriesModel = function(seriesModel) {
		return this._chartsMap[seriesModel.__viewId];
	};
	ECharts.prototype._initEvents = function() {
		var _this = this;
		each$1(MOUSE_EVENT_NAMES, function(eveName) {
			var handler = function(e) {
				var ecModel = _this.getModel();
				var el = e.target;
				var params;
				if (eveName === "globalout") params = {};
				else el && findEventDispatcher(el, function(parent) {
					var ecData = getECData(parent);
					if (ecData && ecData.dataIndex != null) {
						var dataModel = ecData.dataModel || ecModel.getSeriesByIndex(ecData.seriesIndex);
						params = dataModel && dataModel.getDataParams(ecData.dataIndex, ecData.dataType, el) || {};
						return true;
					} else if (ecData.eventData) {
						params = extend({}, ecData.eventData);
						return true;
					}
				}, true);
				if (params) {
					var componentType = params.componentType;
					var componentIndex = params.componentIndex;
					if (componentType === "markLine" || componentType === "markPoint" || componentType === "markArea") {
						componentType = "series";
						componentIndex = params.seriesIndex;
					}
					var model = componentType && componentIndex != null && ecModel.getComponent(componentType, componentIndex);
					var view = model && _this[model.mainType === "series" ? "_chartsMap" : "_componentsMap"][model.__viewId];
					params.event = e;
					params.type = eveName;
					_this._$eventProcessor.eventInfo = {
						targetEl: el,
						packedEvent: params,
						model,
						view
					};
					_this.trigger(eveName, params);
				}
			};
			handler.zrEventfulCallAtLast = true;
			_this._zr.on(eveName, handler, _this);
		});
		var messageCenter = this._messageCenter;
		each$1(publicEventTypeMap, function(_, eventType) {
			messageCenter.on(eventType, function(event) {
				_this.trigger(eventType, event);
			});
		});
		handleLegacySelectEvents(messageCenter, this, this._api);
	};
	ECharts.prototype.isDisposed = function() {
		return this._disposed;
	};
	ECharts.prototype.clear = function() {
		if (this._disposed) {
			this.id;
			return;
		}
		this.setOption({ series: [] }, true);
	};
	ECharts.prototype.dispose = function() {
		if (this._disposed) {
			this.id;
			return;
		}
		this._disposed = true;
		if (this.getDom()) setAttribute(this.getDom(), DOM_ATTRIBUTE_KEY, "");
		var chart = this;
		var api = chart._api;
		var ecModel = chart._model;
		each$1(chart._componentsViews, function(component) {
			component.dispose(ecModel, api);
		});
		each$1(chart._chartsViews, function(chart) {
			chart.dispose(ecModel, api);
		});
		chart._zr.dispose();
		chart._dom = chart._model = chart._chartsMap = chart._componentsMap = chart._chartsViews = chart._componentsViews = chart._scheduler = chart._api = chart._zr = chart._throttledZrFlush = chart._theme = chart._coordSysMgr = chart._messageCenter = null;
		delete instances[chart.id];
	};
	/**
	* Resize the chart
	*/
	ECharts.prototype.resize = function(opts) {
		if (this[IN_EC_CYCLE_KEY]) return;
		if (this._disposed) {
			this.id;
			return;
		}
		this._zr.resize(opts);
		var ecModel = this._model;
		this._loadingFX && this._loadingFX.resize();
		if (!ecModel) return;
		var needPrepare = ecModel.resetOption("media");
		var silent = opts && opts.silent;
		if (this[PENDING_UPDATE]) {
			if (silent == null) silent = this[PENDING_UPDATE].silent;
			needPrepare = true;
			this[PENDING_UPDATE] = null;
		}
		this[IN_EC_CYCLE_KEY] = true;
		updateECUpdateCycleVersion(this);
		try {
			needPrepare && prepare(this);
			updateMethods.update.call(this, {
				type: "resize",
				animation: extend({ duration: 0 }, opts && opts.animation)
			});
		} catch (e) {
			this[IN_EC_CYCLE_KEY] = false;
			throw e;
		}
		this[IN_EC_CYCLE_KEY] = false;
		flushPendingActions.call(this, silent);
		triggerUpdatedEvent.call(this, silent);
	};
	ECharts.prototype.showLoading = function(name, cfg) {
		if (this._disposed) {
			this.id;
			return;
		}
		if (isObject$1(name)) {
			cfg = name;
			name = "";
		}
		name = name || "default";
		this.hideLoading();
		if (!loadingEffects[name]) return;
		var el = loadingEffects[name](this._api, cfg);
		var zr = this._zr;
		this._loadingFX = el;
		zr.add(el);
	};
	/**
	* Hide loading effect
	*/
	ECharts.prototype.hideLoading = function() {
		if (this._disposed) {
			this.id;
			return;
		}
		this._loadingFX && this._zr.remove(this._loadingFX);
		this._loadingFX = null;
	};
	ECharts.prototype.makeActionFromEvent = function(eventObj) {
		var payload = extend({}, eventObj);
		payload.type = connectionEventRevertMap[eventObj.type];
		return payload;
	};
	/**
	* @param opt If pass boolean, means opt.silent
	* @param opt.silent Default `false`. Whether trigger events.
	* @param opt.flush Default `undefined`.
	*        true: Flush immediately, and then pixel in canvas can be fetched
	*            immediately. Caution: it might affect performance.
	*        false: Not flush.
	*        undefined: Auto decide whether perform flush.
	*/
	ECharts.prototype.dispatchAction = function(payload, opt) {
		if (this._disposed) {
			this.id;
			return;
		}
		if (!isObject$1(opt)) opt = { silent: !!opt };
		if (!actions[payload.type]) return;
		if (!this._model) return;
		if (this[IN_EC_CYCLE_KEY]) {
			this._pendingActions.push(payload);
			return;
		}
		var silent = opt.silent;
		doDispatchAction.call(this, payload, silent);
		var flush = opt.flush;
		if (flush) this._zr.flush();
		else if (flush !== false && env.browser.weChat) this._throttledZrFlush();
		flushPendingActions.call(this, silent);
		triggerUpdatedEvent.call(this, silent);
	};
	ECharts.prototype.updateLabelLayout = function() {
		lifecycle.trigger("series:layoutlabels", this._model, this._api, { updatedSeries: [] });
	};
	ECharts.prototype.appendData = function(params) {
		if (this._disposed) {
			this.id;
			return;
		}
		var seriesIndex = params.seriesIndex;
		this.getModel().getSeriesByIndex(seriesIndex).appendData(params);
		this._scheduler.unfinished = true;
		this.getZr().wakeUp();
	};
	ECharts.internalField = function() {
		prepare = function(ecIns) {
			resetCachePerECPrepare(ecIns._model);
			var scheduler = ecIns._scheduler;
			scheduler.restorePipelines(ecIns._zr, ecIns._model);
			scheduler.prepareStageTasks();
			prepareView(ecIns, true);
			prepareView(ecIns, false);
			scheduler.plan();
		};
		/**
		* Prepare view instances of charts and components
		*/
		prepareView = function(ecIns, isComponent) {
			var ecModel = ecIns._model;
			var scheduler = ecIns._scheduler;
			var viewList = isComponent ? ecIns._componentsViews : ecIns._chartsViews;
			var viewMap = isComponent ? ecIns._componentsMap : ecIns._chartsMap;
			var zr = ecIns._zr;
			var api = ecIns._api;
			for (var i = 0; i < viewList.length; i++) viewList[i].__alive = false;
			isComponent ? ecModel.eachComponent(function(componentType, model) {
				componentType !== "series" && doPrepare(model);
			}) : ecModel.eachSeries(doPrepare);
			function doPrepare(model) {
				var requireNewView = model.__requireNewView;
				model.__requireNewView = false;
				var viewId = "_ec_" + model.id + "_" + model.type;
				var view = !requireNewView && viewMap[viewId];
				if (!view) {
					var classType = parseClassType(model.type);
					view = new (isComponent ? ComponentView.getClass(classType.main, classType.sub) : ChartView.getClass(classType.sub))();
					view.init(ecModel, api);
					viewMap[viewId] = view;
					viewList.push(view);
					zr.add(view.group);
				}
				model.__viewId = view.__id = viewId;
				view.__alive = true;
				view.__model = model;
				view.group.__ecComponentInfo = {
					mainType: model.mainType,
					index: model.componentIndex
				};
				!isComponent && scheduler.prepareView(view, model, ecModel, api);
			}
			for (var i = 0; i < viewList.length;) {
				var view = viewList[i];
				if (!view.__alive) {
					!isComponent && view.renderTask.dispose();
					zr.remove(view.group);
					view.dispose(ecModel, api);
					viewList.splice(i, 1);
					if (viewMap[view.__id] === view) delete viewMap[view.__id];
					view.__id = view.group.__ecComponentInfo = null;
				} else i++;
			}
		};
		updateDirectly = function(ecIns, method, payload, mainType, subType) {
			var ecModel = ecIns._model;
			ecModel.setUpdatePayload(payload);
			if (!mainType) {
				each$1([].concat(ecIns._componentsViews).concat(ecIns._chartsViews), callView);
				return;
			}
			var condition = makeQueryConditionKindA(payload, mainType, subType);
			var excludeSeriesId = payload.excludeSeriesId;
			var excludeSeriesIdMap;
			if (excludeSeriesId != null) {
				excludeSeriesIdMap = createHashMap();
				each$1(normalizeToArray(excludeSeriesId), function(id) {
					var modelId = convertOptionIdName(id, null);
					if (modelId != null) excludeSeriesIdMap.set(modelId, true);
				});
			}
			ecModel && ecModel.eachComponent(condition, function(model) {
				if (excludeSeriesIdMap && excludeSeriesIdMap.get(model.id) != null) return;
				if (isHighDownPayload(payload)) {
					if (model instanceof SeriesModel) {
						if (payload.type === "highlight" && !payload.notBlur && !model.get(["emphasis", "disabled"])) blurSeriesFromHighlightPayload(model, payload, ecIns._api);
					} else {
						var _a = findComponentHighDownDispatchers(model.mainType, model.componentIndex, payload.name, ecIns._api), focusSelf = _a.focusSelf, dispatchers = _a.dispatchers;
						if (payload.type === "highlight" && focusSelf && !payload.notBlur) blurComponent(model.mainType, model.componentIndex, ecIns._api);
						if (dispatchers) each$1(dispatchers, function(dispatcher) {
							payload.type === "highlight" ? enterEmphasis(dispatcher) : leaveEmphasis(dispatcher);
						});
					}
				} else if (isSelectChangePayload(payload)) {
					if (model instanceof SeriesModel) {
						toggleSelectionFromPayload(model, payload, ecIns._api);
						updateSeriesElementSelection(model);
						markStatusToUpdate(ecIns);
					}
				}
			}, ecIns);
			ecModel && ecModel.eachComponent(condition, function(model) {
				if (excludeSeriesIdMap && excludeSeriesIdMap.get(model.id) != null) return;
				callView(ecIns[mainType === "series" ? "_chartsMap" : "_componentsMap"][model.__viewId]);
			}, ecIns);
			function callView(view) {
				view && view.__alive && view[method] && view[method](view.__model, ecModel, ecIns._api, payload);
			}
		};
		updateMethods = {
			prepareAndUpdate: function(payload) {
				prepare(this);
				updateMethods.update.call(this, payload, payload && { optionChanged: payload.newOption != null });
			},
			update: function(payload, updateParams) {
				var ecModel = this._model;
				var api = this._api;
				var zr = this._zr;
				var coordSysMgr = this._coordSysMgr;
				var scheduler = this._scheduler;
				if (!ecModel) return;
				resetCachePerECFullUpdate(ecModel);
				ecModel.setUpdatePayload(payload);
				scheduler.restoreData(ecModel, payload);
				scheduler.performSeriesTasks(ecModel);
				coordSysMgr.create(ecModel, api);
				lifecycle.trigger("coordsys:aftercreate", ecModel, api);
				scheduler.performDataProcessorTasks(ecModel, payload);
				updateStreamModes(this, ecModel);
				coordSysMgr.update(ecModel, api);
				clearColorPalette(ecModel);
				scheduler.performVisualTasks(ecModel, payload);
				var backgroundColor = ecModel.get("backgroundColor") || "transparent";
				zr.setBackgroundColor(backgroundColor);
				var darkMode = ecModel.get("darkMode");
				if (darkMode != null && darkMode !== "auto") zr.setDarkMode(darkMode);
				render(this, ecModel, api, payload, updateParams);
				lifecycle.trigger("afterupdate", ecModel, api);
			},
			/**
			* PENDING: See INCONSISTENCY_OF_BRUSH_SELECTED_EVENT_IN_UPDATE_TRANSFORM
			*/
			updateTransform: function(payload) {
				var ecIns = this;
				var ecModel = ecIns._model;
				var api = ecIns._api;
				if (!ecModel) return;
				ecModel.setUpdatePayload(payload);
				var componentDirtyList = [];
				ecModel.eachComponent(function(mainType, componentModel) {
					if (mainType === "series") return;
					var componentView = ecIns.getViewOfComponentModel(componentModel);
					if (componentView && componentView.__alive) {
						if (componentView.updateTransform) {
							var result = componentView.updateTransform(componentModel, ecModel, api, payload);
							result && result.update && componentDirtyList.push(componentView);
						} else componentDirtyList.push(componentView);
					}
				});
				var seriesDirtyMap = createHashMap();
				ecModel.eachSeries(function(seriesModel) {
					var chartView = ecIns._chartsMap[seriesModel.__viewId];
					var pipelineContext = seriesModel.pipelineContext;
					if (chartView.updateTransform && !pipelineContext.progressiveRender) {
						var result = chartView.updateTransform(seriesModel, ecModel, api, payload);
						result && result.update && seriesDirtyMap.set(seriesModel.uid, 1);
					} else seriesDirtyMap.set(seriesModel.uid, 1);
				});
				ecIns._scheduler.performVisualTasks(ecModel, payload, {
					setDirty: true,
					dirtyMap: seriesDirtyMap
				});
				renderSeries(ecIns, ecModel, api, payload, {}, seriesDirtyMap);
				lifecycle.trigger("afterupdate", ecModel, api);
			},
			updateView: function(payload) {
				var ecModel = this._model;
				if (!ecModel) return;
				ecModel.setUpdatePayload(payload);
				ChartView.markUpdateMethod(payload, "updateView");
				clearColorPalette(ecModel);
				this._scheduler.performVisualTasks(ecModel, payload, { setDirty: true });
				render(this, ecModel, this._api, payload, {});
				lifecycle.trigger("afterupdate", ecModel, this._api);
			},
			updateVisual: function(payload) {
				var _this = this;
				var ecModel = this._model;
				if (!ecModel) return;
				ecModel.setUpdatePayload(payload);
				ecModel.eachSeries(function(seriesModel) {
					seriesModel.getData().clearAllVisual();
				});
				ChartView.markUpdateMethod(payload, "updateVisual");
				clearColorPalette(ecModel);
				this._scheduler.performVisualTasks(ecModel, payload, {
					visualType: "visual",
					setDirty: true
				});
				ecModel.eachComponent(function(componentType, componentModel) {
					if (componentType !== "series") {
						var componentView = _this.getViewOfComponentModel(componentModel);
						componentView && componentView.__alive && componentView.updateVisual(componentModel, ecModel, _this._api, payload);
					}
				});
				ecModel.eachSeries(function(seriesModel) {
					_this._chartsMap[seriesModel.__viewId].updateVisual(seriesModel, ecModel, _this._api, payload);
				});
				lifecycle.trigger("afterupdate", ecModel, this._api);
			},
			/**
			* @deprecated
			*/
			updateLayout: function(payload) {
				updateMethods.update.call(this, payload);
			}
		};
		function doConvertPixelImpl(ecIns, methodName, finder, value, opt) {
			if (ecIns._disposed) {
				ecIns.id;
				return;
			}
			var ecModel = ecIns._model;
			var coordSysList = ecIns._coordSysMgr.getCoordinateSystems();
			var result;
			var parsedFinder = parseFinder(ecModel, finder);
			for (var i = 0; i < coordSysList.length; i++) {
				var coordSys = coordSysList[i];
				if (coordSys[methodName] && (result = coordSys[methodName](ecModel, parsedFinder, value, opt)) != null) return result;
			}
		}
		doConvertPixel = doConvertPixelImpl;
		updateStreamModes = function(ecIns, ecModel) {
			var chartsMap = ecIns._chartsMap;
			var scheduler = ecIns._scheduler;
			ecModel.eachSeries(function(seriesModel) {
				scheduler.updateStreamModes(seriesModel, chartsMap[seriesModel.__viewId]);
			});
		};
		doDispatchAction = function(payload, silent) {
			var _this = this;
			var ecModel = this.getModel();
			var payloadType = payload.type;
			var escapeConnect = payload.escapeConnect;
			var actionInfo = actions[payloadType];
			var cptTypeTmp = (actionInfo.update || "update").split(":");
			var updateMethod = cptTypeTmp.pop();
			var cptType = cptTypeTmp[0] != null && parseClassType(cptTypeTmp[0]);
			this[IN_EC_CYCLE_KEY] = true;
			updateECUpdateCycleVersion(this);
			var payloads = [payload];
			var batched = false;
			if (payload.batch) {
				batched = true;
				payloads = map(payload.batch, function(item) {
					item = defaults(extend({}, item), payload);
					item.batch = null;
					return item;
				});
			}
			var eventObjBatch = [];
			var eventObj;
			var actionResultBatch = [];
			var nonRefinedEventType = actionInfo.nonRefinedEventType;
			var isSelectChange = isSelectChangePayload(payload);
			var isHighDown = isHighDownPayload(payload);
			if (isHighDown) allLeaveBlur(this._api);
			each$1(payloads, function(batchItem) {
				var actionResult = actionInfo.action(batchItem, ecModel, _this._api);
				if (actionInfo.refineEvent) actionResultBatch.push(actionResult);
				else eventObj = actionResult;
				eventObj = eventObj || extend({}, batchItem);
				eventObj.type = nonRefinedEventType;
				eventObjBatch.push(eventObj);
				if (isHighDown) {
					var _a = preParseFinder(payload), queryOptionMap = _a.queryOptionMap;
					var componentMainType = _a.mainTypeSpecified ? queryOptionMap.keys()[0] : "series";
					updateDirectly(_this, updateMethod, batchItem, componentMainType);
					markStatusToUpdate(_this);
				} else if (isSelectChange) {
					updateDirectly(_this, updateMethod, batchItem, "series");
					markStatusToUpdate(_this);
				} else if (cptType) updateDirectly(_this, updateMethod, batchItem, cptType.main, cptType.sub);
			});
			if (updateMethod !== "none" && !isHighDown && !isSelectChange && !cptType) try {
				if (this[PENDING_UPDATE]) {
					prepare(this);
					updateMethods.update.call(this, payload);
					this[PENDING_UPDATE] = null;
				} else updateMethods[updateMethod].call(this, payload);
			} catch (e) {
				this[IN_EC_CYCLE_KEY] = false;
				throw e;
			}
			if (batched) eventObj = {
				type: nonRefinedEventType,
				escapeConnect,
				batch: eventObjBatch
			};
			else eventObj = eventObjBatch[0];
			this[IN_EC_CYCLE_KEY] = false;
			if (!silent) {
				var refinedEvent = void 0;
				if (actionInfo.refineEvent) {
					var eventContent = actionInfo.refineEvent(actionResultBatch, payload, ecModel, this._api).eventContent;
					assert(isObject$1(eventContent));
					refinedEvent = defaults({ type: actionInfo.refinedEventType }, eventContent);
					refinedEvent.fromAction = payload.type;
					refinedEvent.fromActionPayload = payload;
					refinedEvent.escapeConnect = true;
				}
				var messageCenter = this._messageCenter;
				messageCenter.trigger(eventObj.type, eventObj);
				if (refinedEvent) messageCenter.trigger(refinedEvent.type, refinedEvent);
			}
		};
		flushPendingActions = function(silent) {
			var pendingActions = this._pendingActions;
			while (pendingActions.length) {
				var payload = pendingActions.shift();
				doDispatchAction.call(this, payload, silent);
			}
		};
		triggerUpdatedEvent = function(silent) {
			!silent && this.trigger("updated");
		};
		/**
		* Event `rendered` is triggered when zr
		* rendered. It is useful for realtime
		* snapshot (reflect animation).
		*
		* Event `finished` is triggered when:
		* (1) zrender rendering finished.
		* (2) initial animation finished.
		* (3) progressive rendering finished.
		* (4) no pending action.
		* (5) no delayed setOption needs to be processed.
		*/
		bindRenderedEvent = function(zr, ecIns) {
			zr.on("rendered", function(params) {
				ecIns.trigger("rendered", params);
				if (zr.animation.isFinished() && !ecIns[PENDING_UPDATE] && !ecIns._scheduler.unfinished && !ecIns._pendingActions.length) ecIns.trigger("finished");
				else zr.refresh();
			});
		};
		bindMouseEvent = function(zr, ecIns) {
			zr.on("mouseover", function(e) {
				var el = e.target;
				var dispatcher = findEventDispatcher(el, isHighDownDispatcher);
				if (dispatcher) {
					handleGlobalMouseOverForHighDown(dispatcher, e, ecIns._api);
					markStatusToUpdate(ecIns);
				}
			}).on("mouseout", function(e) {
				var el = e.target;
				var dispatcher = findEventDispatcher(el, isHighDownDispatcher);
				if (dispatcher) {
					handleGlobalMouseOutForHighDown(dispatcher, e, ecIns._api);
					markStatusToUpdate(ecIns);
				}
			}).on("click", function(e) {
				var el = e.target;
				var dispatcher = findEventDispatcher(el, function(target) {
					return getECData(target).dataIndex != null;
				}, true);
				if (dispatcher) {
					var actionType = dispatcher.selected ? "unselect" : "select";
					var ecData = getECData(dispatcher);
					ecIns._api.dispatchAction({
						type: actionType,
						dataType: ecData.dataType,
						dataIndexInside: ecData.dataIndex,
						seriesIndex: ecData.seriesIndex,
						isFromClick: true
					});
				}
			});
		};
		function clearColorPalette(ecModel) {
			ecModel.clearColorPalette();
			ecModel.eachSeries(function(seriesModel) {
				seriesModel.clearColorPalette();
			});
		}
		function allocateZlevels(ecModel) {
			var componentZLevels = [];
			var seriesZLevels = [];
			var hasSeparateZLevel = false;
			ecModel.eachComponent(function(componentType, componentModel) {
				var zlevel = componentModel.get("zlevel") || 0;
				var z = componentModel.get("z") || 0;
				var zlevelKey = componentModel.getZLevelKey();
				hasSeparateZLevel = hasSeparateZLevel || !!zlevelKey;
				(componentType === "series" ? seriesZLevels : componentZLevels).push({
					zlevel,
					z,
					idx: componentModel.componentIndex,
					type: componentType,
					key: zlevelKey
				});
			});
			if (hasSeparateZLevel) {
				var zLevels = componentZLevels.concat(seriesZLevels);
				var lastSeriesZLevel_1;
				var lastSeriesKey_1;
				sort(zLevels, function(a, b) {
					if (a.zlevel === b.zlevel) return a.z - b.z;
					return a.zlevel - b.zlevel;
				});
				each$1(zLevels, function(item) {
					var componentModel = ecModel.getComponent(item.type, item.idx);
					var zlevel = item.zlevel;
					var key = item.key;
					if (lastSeriesZLevel_1 != null) zlevel = Math.max(lastSeriesZLevel_1, zlevel);
					if (key) {
						if (zlevel === lastSeriesZLevel_1 && key !== lastSeriesKey_1) zlevel++;
						lastSeriesKey_1 = key;
					} else if (lastSeriesKey_1) {
						if (zlevel === lastSeriesZLevel_1) zlevel++;
						lastSeriesKey_1 = "";
					}
					lastSeriesZLevel_1 = zlevel;
					componentModel.setZLevel(zlevel);
				});
			}
		}
		render = function(ecIns, ecModel, api, payload, updateParams) {
			allocateZlevels(ecModel);
			renderComponents(ecIns, ecModel, api, payload, updateParams);
			each$1(ecIns._chartsViews, function(chart) {
				chart.__alive = false;
			});
			renderSeries(ecIns, ecModel, api, payload, updateParams);
			each$1(ecIns._chartsViews, function(chart) {
				if (!chart.__alive) chart.remove(ecModel, api);
			});
		};
		renderComponents = function(ecIns, ecModel, api, payload, updateParams, dirtyList) {
			each$1(dirtyList || ecIns._componentsViews, function(componentView) {
				var componentModel = componentView.__model;
				clearStates(componentModel, componentView);
				componentView.render(componentModel, ecModel, api, payload);
				updateZ(componentModel, componentView);
				updateStates(componentModel, componentView);
			});
		};
		/**
		* Render each chart and component
		*/
		renderSeries = function(ecIns, ecModel, api, payload, updateParams, dirtyMap) {
			var scheduler = ecIns._scheduler;
			updateParams = extend(updateParams || {}, { updatedSeries: ecModel.getSeries() });
			lifecycle.trigger("series:beforeupdate", ecModel, api, updateParams);
			var unfinished = false;
			ecModel.eachSeries(function(seriesModel) {
				var chartView = ecIns._chartsMap[seriesModel.__viewId];
				chartView.__alive = true;
				var renderTask = chartView.renderTask;
				scheduler.updatePayload(renderTask, payload);
				clearStates(seriesModel, chartView);
				if (dirtyMap && dirtyMap.get(seriesModel.uid)) renderTask.dirty();
				if (renderTask.perform(scheduler.getPerformArgs(renderTask))) unfinished = true;
				chartView.group.silent = !!seriesModel.get("silent");
				updateBlend(seriesModel, chartView);
				updateSeriesElementSelection(seriesModel);
			});
			scheduler.unfinished = unfinished || scheduler.unfinished;
			lifecycle.trigger("series:layoutlabels", ecModel, api, updateParams);
			lifecycle.trigger("series:transition", ecModel, api, updateParams);
			ecModel.eachSeries(function(seriesModel) {
				var chartView = ecIns._chartsMap[seriesModel.__viewId];
				updateZ(seriesModel, chartView);
				updateStates(seriesModel, chartView);
			});
			updateHoverLayerStatus(ecIns, ecModel);
			lifecycle.trigger("series:afterupdate", ecModel, api, updateParams);
		};
		markStatusToUpdate = function(ecIns) {
			ecIns[STATUS_NEEDS_UPDATE_KEY] = true;
			ecIns.getZr().wakeUp();
		};
		updateECUpdateCycleVersion = function(ecIns) {
			ecIns[EC_UPDATE_CYCLE_VERSION_KEY] = (ecIns[EC_UPDATE_CYCLE_VERSION_KEY] + 1) % 1e6;
		};
		applyChangedStates = function(ecIns) {
			if (!ecIns[STATUS_NEEDS_UPDATE_KEY]) return;
			ecIns.getZr().storage.traverse(function(el) {
				if (isElementRemoved(el)) return;
				applyElementStates(el);
			});
			ecIns[STATUS_NEEDS_UPDATE_KEY] = false;
		};
		function applyElementStates(el) {
			var newStates = [];
			var oldStates = el.currentStates;
			for (var i = 0; i < oldStates.length; i++) {
				var stateName = oldStates[i];
				if (!(stateName === "emphasis" || stateName === "blur" || stateName === "select")) newStates.push(stateName);
			}
			if (el.selected && el.states.select) newStates.push("select");
			if (el.hoverState === 2 && el.states.emphasis) newStates.push("emphasis");
			else if (el.hoverState === 1 && el.states.blur) newStates.push("blur");
			el.useStates(newStates);
		}
		function updateHoverLayerStatus(ecIns, ecModel) {
			var zr = ecIns._zr;
			if (zr.painter.type !== "canvas") return;
			var storage = zr.storage;
			var elCount = 0;
			storage.traverse(function(el) {
				if (!el.isGroup) elCount++;
			});
			var shouldUseHoverLayer = elCount > retrieve2(ecModel.get("hoverLayerThreshold"), globalDefault_default.hoverLayerThreshold) && !env.node && !env.worker;
			if (ecIns._usingTHL || shouldUseHoverLayer) {
				ecModel.eachSeries(function(seriesModel) {
					if (seriesModel.preventUsingHoverLayer) return;
					var chartView = ecIns._chartsMap[seriesModel.__viewId];
					if (chartView.__alive) chartView.eachRendered(function(el) {
						var emphasis = el.states.emphasis;
						if (emphasis && emphasis.hoverLayer !== 2) emphasis.hoverLayer = shouldUseHoverLayer ? 1 : 0;
					});
				});
				ecIns._usingTHL = shouldUseHoverLayer;
			}
		}
		/**
		* Update chart and blend.
		*/
		function updateBlend(seriesModel, chartView) {
			var blendMode = seriesModel.get("blendMode") || null;
			chartView.eachRendered(function(el) {
				if (!el.isGroup) el.style.blend = blendMode;
			});
		}
		function updateZ(model, view) {
			if (model.preventAutoZ) return;
			var zInfo = retrieveZInfo(model);
			view.eachRendered(function(el) {
				traverseUpdateZ(el, zInfo.z, zInfo.zlevel);
				return true;
			});
		}
		function clearStates(model, view) {
			view.eachRendered(function(el) {
				if (isElementRemoved(el)) return;
				var textContent = el.getTextContent();
				var textGuide = el.getTextGuideLine();
				if (el.stateTransition) el.stateTransition = null;
				if (textContent && textContent.stateTransition) textContent.stateTransition = null;
				if (textGuide && textGuide.stateTransition) textGuide.stateTransition = null;
				if (el.hasState()) {
					el.prevStates = el.currentStates;
					el.clearStates();
				} else if (el.prevStates) el.prevStates = null;
			});
		}
		function updateStates(model, view) {
			var stateAnimationModel = model.getModel("stateAnimation");
			var enableAnimation = model.isAnimationEnabled();
			var duration = stateAnimationModel.get("duration");
			var stateTransition = duration > 0 ? {
				duration,
				delay: stateAnimationModel.get("delay"),
				easing: stateAnimationModel.get("easing")
			} : null;
			view.eachRendered(function(el) {
				if (el.states && el.states.emphasis) {
					if (isElementRemoved(el)) return;
					if (el instanceof Path) savePathStates(el);
					if (el.__dirty) {
						var prevStates = el.prevStates;
						if (prevStates) el.useStates(prevStates);
					}
					if (enableAnimation) {
						el.stateTransition = stateTransition;
						var textContent = el.getTextContent();
						var textGuide = el.getTextGuideLine();
						if (textContent) textContent.stateTransition = stateTransition;
						if (textGuide) textGuide.stateTransition = stateTransition;
					}
					if (el.__dirty) applyElementStates(el);
				}
			});
		}
		createExtensionAPI = function(ecIns) {
			return new (function(_super) {
				__extends(class_1, _super);
				function class_1() {
					return _super !== null && _super.apply(this, arguments) || this;
				}
				class_1.prototype.getCoordinateSystems = function() {
					return ecIns._coordSysMgr.getCoordinateSystems();
				};
				class_1.prototype.getComponentByElement = function(el) {
					while (el) {
						var modelInfo = el.__ecComponentInfo;
						if (modelInfo != null) return ecIns._model.getComponent(modelInfo.mainType, modelInfo.index);
						el = el.parent;
					}
				};
				class_1.prototype.enterEmphasis = function(el, highlightDigit) {
					enterEmphasis(el, highlightDigit);
					markStatusToUpdate(ecIns);
				};
				class_1.prototype.leaveEmphasis = function(el, highlightDigit) {
					leaveEmphasis(el, highlightDigit);
					markStatusToUpdate(ecIns);
				};
				class_1.prototype.enterBlur = function(el) {
					enterBlur(el);
					markStatusToUpdate(ecIns);
				};
				class_1.prototype.leaveBlur = function(el) {
					leaveBlur(el);
					markStatusToUpdate(ecIns);
				};
				class_1.prototype.enterSelect = function(el) {
					enterSelect(el);
					markStatusToUpdate(ecIns);
				};
				class_1.prototype.leaveSelect = function(el) {
					leaveSelect(el);
					markStatusToUpdate(ecIns);
				};
				class_1.prototype.getModel = function() {
					return ecIns.getModel();
				};
				class_1.prototype.getViewOfComponentModel = function(componentModel) {
					return ecIns.getViewOfComponentModel(componentModel);
				};
				class_1.prototype.getViewOfSeriesModel = function(seriesModel) {
					return ecIns.getViewOfSeriesModel(seriesModel);
				};
				class_1.prototype.getECUpdateCycleVersion = function() {
					return ecIns[EC_UPDATE_CYCLE_VERSION_KEY];
				};
				class_1.prototype.usingTHL = function() {
					return ecIns._usingTHL;
				};
				return class_1;
			}(ExtensionAPI))(ecIns);
		};
		enableConnect = function(chart) {
			function updateConnectedChartsStatus(charts, status) {
				for (var i = 0; i < charts.length; i++) {
					var otherChart = charts[i];
					otherChart[CONNECT_STATUS_KEY] = status;
				}
			}
			each$1(connectionEventRevertMap, function(_, eventType) {
				chart._messageCenter.on(eventType, function(event) {
					if (connectedGroups[chart.group] && chart[CONNECT_STATUS_KEY] !== CONNECT_STATUS_PENDING) {
						if (event && event.escapeConnect) return;
						var action_1 = chart.makeActionFromEvent(event);
						var otherCharts_1 = [];
						each$1(instances, function(otherChart) {
							if (otherChart !== chart && otherChart.group === chart.group) otherCharts_1.push(otherChart);
						});
						updateConnectedChartsStatus(otherCharts_1, CONNECT_STATUS_PENDING);
						each$1(otherCharts_1, function(otherChart) {
							if (otherChart[CONNECT_STATUS_KEY] !== CONNECT_STATUS_UPDATING) otherChart.dispatchAction(action_1);
						});
						updateConnectedChartsStatus(otherCharts_1, CONNECT_STATUS_UPDATED);
					}
				});
			});
		};
	}();
	return ECharts;
}(Eventful);
var echartsProto = ECharts.prototype;
echartsProto.on = createRegisterEventWithLowercaseECharts("on");
echartsProto.off = createRegisterEventWithLowercaseECharts("off");
/**
* @deprecated
*/
echartsProto.one = function(eventName, cb, ctx) {
	var self = this;
	function wrapped() {
		var args2 = [];
		for (var _i = 0; _i < arguments.length; _i++) args2[_i] = arguments[_i];
		cb && cb.apply && cb.apply(this, args2);
		self.off(eventName, wrapped);
	}
	this.on.call(this, eventName, wrapped, ctx);
};
var MOUSE_EVENT_NAMES = [
	"click",
	"dblclick",
	"mouseover",
	"mouseout",
	"mousemove",
	"mousedown",
	"mouseup",
	"globalout",
	"contextmenu"
];
var actions = {};
/**
* Map event type to action type for reproducing action from event for `connect`.
*/
var connectionEventRevertMap = {};
/**
* To remove duplication.
*/
var publicEventTypeMap = {};
var dataProcessorFuncs = [];
var optionPreprocessorFuncs = [];
var visualFuncs = [];
var themeStorage = {};
var loadingEffects = {};
var instances = {};
var connectedGroups = {};
var idBase = +/* @__PURE__ */ new Date() - 0;
var groupIdBase = +/* @__PURE__ */ new Date() - 0;
var DOM_ATTRIBUTE_KEY = "_echarts_instance_";
/**
* @param opts.devicePixelRatio Use window.devicePixelRatio by default
* @param opts.renderer Can choose 'canvas' or 'svg' to render the chart.
* @param opts.width Use clientWidth of the input `dom` by default.
*        Can be 'auto' (the same as null/undefined)
* @param opts.height Use clientHeight of the input `dom` by default.
*        Can be 'auto' (the same as null/undefined)
* @param opts.locale Specify the locale.
* @param opts.useDirtyRect Enable dirty rectangle rendering or not.
*/
function init(dom, theme, opts) {
	var isClient = !(opts && opts.ssr);
	if (isClient) {
		var existInstance = getInstanceByDom(dom);
		if (existInstance) return existInstance;
	}
	var chart = new ECharts(dom, theme, opts);
	chart.id = "ec_" + idBase++;
	instances[chart.id] = chart;
	isClient && setAttribute(dom, DOM_ATTRIBUTE_KEY, chart.id);
	enableConnect(chart);
	lifecycle.trigger("afterinit", chart);
	return chart;
}
/**
* @usage
* (A)
* ```js
* let chart1 = echarts.init(dom1);
* let chart2 = echarts.init(dom2);
* chart1.group = 'xxx';
* chart2.group = 'xxx';
* echarts.connect('xxx');
* ```
* (B)
* ```js
* let chart1 = echarts.init(dom1);
* let chart2 = echarts.init(dom2);
* echarts.connect('xxx', [chart1, chart2]);
* ```
*/
function connect(groupId) {
	if (isArray(groupId)) {
		var charts = groupId;
		groupId = null;
		each$1(charts, function(chart) {
			if (chart.group != null) groupId = chart.group;
		});
		groupId = groupId || "g_" + groupIdBase++;
		each$1(charts, function(chart) {
			chart.group = groupId;
		});
	}
	connectedGroups[groupId] = true;
	return groupId;
}
function disconnect(groupId) {
	connectedGroups[groupId] = false;
}
/**
* Alias and backward compatibility
* @deprecated
*/
var disConnect = disconnect;
/**
* Dispose a chart instance
*/
function dispose(chart) {
	if (isString(chart)) chart = instances[chart];
	else if (!(chart instanceof ECharts)) chart = getInstanceByDom(chart);
	if (chart instanceof ECharts && !chart.isDisposed()) chart.dispose();
}
function getInstanceByDom(dom) {
	return instances[getAttribute(dom, DOM_ATTRIBUTE_KEY)];
}
function getInstanceById(key) {
	return instances[key];
}
/**
* Register theme
*/
function registerTheme(name, theme) {
	themeStorage[name] = theme;
}
/**
* Register option preprocessor
*/
function registerPreprocessor(preprocessorFunc) {
	if (indexOf(optionPreprocessorFuncs, preprocessorFunc) < 0) optionPreprocessorFuncs.push(preprocessorFunc);
}
/**
* NOTICE: Alway run in block way (no progessive is allowed).
*/
function registerProcessor(priority, processor) {
	normalizeRegister(dataProcessorFuncs, priority, processor, PRIORITY_PROCESSOR_DEFAULT);
}
/**
* Register postIniter
* @param {Function} postInitFunc
*/
function registerPostInit(postInitFunc) {
	registerUpdateLifecycle("afterinit", postInitFunc);
}
/**
* Register postUpdater
* @param {Function} postUpdateFunc
*/
function registerPostUpdate(postUpdateFunc) {
	registerUpdateLifecycle("afterupdate", postUpdateFunc);
}
function registerUpdateLifecycle(name, cb) {
	lifecycle.on(name, cb);
}
function registerAction(arg0, arg1, action) {
	var actionType;
	var publicEventType;
	var refineEvent;
	var update;
	var publishNonRefinedEvent;
	if (isFunction(arg1)) {
		action = arg1;
		arg1 = "";
	}
	if (isObject$1(arg0)) {
		actionType = arg0.type;
		publicEventType = arg0.event;
		update = arg0.update;
		publishNonRefinedEvent = arg0.publishNonRefinedEvent;
		if (!action) action = arg0.action;
		refineEvent = arg0.refineEvent;
	} else {
		actionType = arg0;
		publicEventType = arg1;
	}
	function createEventType(actionOrEventType) {
		return actionOrEventType.toLowerCase();
	}
	publicEventType = createEventType(publicEventType || actionType);
	var nonRefinedEventType = refineEvent ? createEventType(actionType) : publicEventType;
	if (actions[actionType]) return;
	assert(ACTION_REG.test(actionType) && ACTION_REG.test(publicEventType));
	if (refineEvent) assert(publicEventType !== actionType);
	actions[actionType] = {
		actionType,
		refinedEventType: publicEventType,
		nonRefinedEventType,
		update,
		action,
		refineEvent
	};
	publicEventTypeMap[publicEventType] = 1;
	if (refineEvent && publishNonRefinedEvent) publicEventTypeMap[nonRefinedEventType] = 1;
	connectionEventRevertMap[nonRefinedEventType] = actionType;
}
function registerCoordinateSystem(type, coordSysCreator) {
	CoordinateSystemManager.register(type, coordSysCreator);
}
/**
* Get dimensions of specified coordinate system.
* @param {string} type
* @return {Array.<string|Object>}
*/
function getCoordinateSystemDimensions(type) {
	var coordSysCreator = CoordinateSystemManager.get(type);
	if (coordSysCreator) return coordSysCreator.getDimensionsInfo ? coordSysCreator.getDimensionsInfo() : coordSysCreator.dimensions.slice();
}
function registerCustomSeries(seriesType, renderItem) {
	registerCustomSeries$1(seriesType, renderItem);
}
function registerLayout(priority, layoutTask) {
	normalizeRegister(visualFuncs, priority, layoutTask, PRIORITY_VISUAL_LAYOUT, "layout", true);
}
function registerVisual(priority, visualTask) {
	normalizeRegister(visualFuncs, priority, visualTask, PRIORITY_VISUAL_CHART, "visual", true);
}
var registeredTasks = [];
function normalizeRegister(targetList, priority, fn, defaultPriority, visualType, checkBlock) {
	if (isFunction(priority) || isObject$1(priority)) {
		fn = priority;
		priority = defaultPriority;
	}
	if (indexOf(registeredTasks, fn) >= 0) return;
	registeredTasks.push(fn);
	var stageHandler = Scheduler.wrapStageHandler(fn, visualType);
	stageHandler.__prio = priority;
	stageHandler.__raw = fn;
	targetList.push(stageHandler);
}
function registerLoading(name, loadingFx) {
	loadingEffects[name] = loadingFx;
}
/**
* ZRender need a canvas context to do measureText.
* But in node environment canvas may be created by node-canvas.
* So we need to specify how to create a canvas instead of using document.createElement('canvas')
*
*
* @deprecated use setPlatformAPI({ createCanvas }) instead.
*
* @example
*     let Canvas = require('canvas');
*     let echarts = require('echarts');
*     echarts.setCanvasCreator(function () {
*         // Small size is enough.
*         return new Canvas(32, 32);
*     });
*/
function setCanvasCreator(creator) {
	setPlatformAPI({ createCanvas: creator });
}
/**
* The parameters and usage: see `geoSourceManager.registerMap`.
* Compatible with previous `echarts.registerMap`.
*/
function registerMap(mapName, geoJson, specialAreas) {
	var registerMap = getImpl("registerMap");
	registerMap && registerMap(mapName, geoJson, specialAreas);
}
function getMap(mapName) {
	var getMap = getImpl("getMap");
	return getMap && getMap(mapName);
}
var registerTransform = registerExternalTransform;
/**
* Global dispatchAction to a specified chart instance.
*/
registerVisual(PRIORITY_VISUAL_GLOBAL, seriesStyleTask);
registerVisual(PRIORITY_VISUAL_CHART_DATA_CUSTOM, dataStyleTask);
registerVisual(PRIORITY_VISUAL_CHART_DATA_CUSTOM, dataColorPaletteTask);
registerVisual(PRIORITY_VISUAL_GLOBAL, seriesSymbolTask);
registerVisual(PRIORITY_VISUAL_CHART_DATA_CUSTOM, dataSymbolTask);
registerVisual(PRIORITY_VISUAL_DECAL, decalVisualStageHandler);
registerPreprocessor(globalBackwardCompat);
registerProcessor(PRIORITY_PROCESSOR_DATASTACK, dataStackStageHandler);
registerLoading("default", defaultLoading);
registerAction({
	type: HIGHLIGHT_ACTION_TYPE,
	event: HIGHLIGHT_ACTION_TYPE,
	update: HIGHLIGHT_ACTION_TYPE
}, noop);
registerAction({
	type: DOWNPLAY_ACTION_TYPE,
	event: DOWNPLAY_ACTION_TYPE,
	update: DOWNPLAY_ACTION_TYPE
}, noop);
registerAction({
	type: SELECT_ACTION_TYPE,
	event: SELECT_CHANGED_EVENT_TYPE,
	update: SELECT_ACTION_TYPE,
	action: noop,
	refineEvent: makeSelectChangedEvent,
	publishNonRefinedEvent: true
});
registerAction({
	type: UNSELECT_ACTION_TYPE,
	event: SELECT_CHANGED_EVENT_TYPE,
	update: UNSELECT_ACTION_TYPE,
	action: noop,
	refineEvent: makeSelectChangedEvent,
	publishNonRefinedEvent: true
});
registerAction({
	type: TOGGLE_SELECT_ACTION_TYPE,
	event: SELECT_CHANGED_EVENT_TYPE,
	update: TOGGLE_SELECT_ACTION_TYPE,
	action: noop,
	refineEvent: makeSelectChangedEvent,
	publishNonRefinedEvent: true
});
function makeSelectChangedEvent(actionResultBatch, payload, ecModel, api) {
	return { eventContent: {
		selected: getAllSelectedIndices(ecModel),
		isFromClick: payload.isFromClick || false
	} };
}
registerTheme("default", {});
registerTheme("dark", theme);
var dataTool = {};
//#endregion
//#region node_modules/echarts/lib/extension.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var extensions = [];
var extensionRegisters = {
	registerPreprocessor,
	registerProcessor,
	registerPostInit,
	registerPostUpdate,
	registerUpdateLifecycle,
	registerAction,
	registerCoordinateSystem,
	registerLayout,
	registerVisual,
	registerTransform,
	registerLoading,
	registerMap,
	registerImpl,
	PRIORITY,
	ComponentModel,
	ComponentView,
	SeriesModel,
	ChartView,
	registerComponentModel: function(ComponentModelClass) {
		ComponentModel.registerClass(ComponentModelClass);
	},
	registerComponentView: function(ComponentViewClass) {
		ComponentView.registerClass(ComponentViewClass);
	},
	registerSeriesModel: function(SeriesModelClass) {
		SeriesModel.registerClass(SeriesModelClass);
	},
	registerChartView: function(ChartViewClass) {
		ChartView.registerClass(ChartViewClass);
	},
	registerCustomSeries: function(seriesType, renderItem) {
		registerCustomSeries$1(seriesType, renderItem);
	},
	registerSubTypeDefaulter: function(componentType, defaulter) {
		ComponentModel.registerSubTypeDefaulter(componentType, defaulter);
	},
	registerPainter: function(painterType, PainterCtor) {
		registerPainter(painterType, PainterCtor);
	}
};
function use(ext) {
	if (isArray(ext)) {
		each$1(ext, function(singleExt) {
			use(singleExt);
		});
		return;
	}
	if (indexOf(extensions, ext) >= 0) return;
	extensions.push(ext);
	if (isFunction(ext)) ext = { install: ext };
	ext.install(extensionRegisters);
}
//#endregion
//#region node_modules/echarts/lib/coord/axisModelCommonMixin.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var AxisModelCommonMixin = function() {
	function AxisModelCommonMixin() {}
	AxisModelCommonMixin.prototype.needIncludeZero = function() {
		return !this.option.scale;
	};
	/**
	* Should be implemented by each axis model if necessary.
	* @return coordinate system model
	*/
	AxisModelCommonMixin.prototype.getCoordSysModel = function() {};
	return AxisModelCommonMixin;
}();
//#endregion
//#region node_modules/echarts/lib/coord/axisNiceTicks.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function calcNiceForIntervalOrLogScale(scale, opt) {
	var isTargetLogScale = isLogScale(scale);
	var intervalStub = isTargetLogScale ? scale.intervalStub : scale;
	var fixMinMax = opt.fixMinMax || [];
	var oldOutermostExtent = isTargetLogScale ? scale.getExtent() : null;
	var oldIntervalExtent = intervalStub.getExtent();
	var newIntervalExtent = intervalScaleEnsureValidExtent(oldIntervalExtent, fixMinMax, opt.rawExtentResult);
	intervalStub.setExtent(newIntervalExtent[0], newIntervalExtent[1]);
	newIntervalExtent = intervalStub.getExtent();
	var config = isTargetLogScale ? logScaleCalcNiceTicks(intervalStub, opt) : intervalScaleCalcNiceTicks(intervalStub, opt);
	var autoIntervalPrecision = config.intervalPrecision;
	var autoInterval = config.interval;
	var userInterval = opt.userInterval;
	if (userInterval != null) {
		config.interval = userInterval;
		config.intervalPrecision = getIntervalPrecision(userInterval);
	}
	if (!fixMinMax[0]) newIntervalExtent[0] = round(mathFloor(newIntervalExtent[0] / autoInterval) * autoInterval, autoIntervalPrecision);
	if (!fixMinMax[1]) newIntervalExtent[1] = round(mathCeil(newIntervalExtent[1] / autoInterval) * autoInterval, autoIntervalPrecision);
	if (userInterval != null) config.niceExtent = newIntervalExtent.slice();
	updateIntervalOrLogScaleForNiceOrAligned(scale, fixMinMax, oldIntervalExtent, newIntervalExtent, oldOutermostExtent, config);
}
function intervalScaleCalcNiceTicks(scale, opt) {
	var splitNumber = ensureValidSplitNumber(opt.splitNumber, 5);
	var span = getScaleLinearSpanEffective(scale);
	var minInterval = opt.minInterval;
	var maxInterval = opt.maxInterval;
	var interval = nice(span / splitNumber, true);
	if (minInterval != null && interval < minInterval) interval = minInterval;
	if (maxInterval != null && interval > maxInterval) interval = maxInterval;
	var intervalPrecision = getIntervalPrecision(interval);
	var extent = scale.getExtent();
	var niceExtent = [round(mathCeil(extent[0] / interval) * interval, intervalPrecision), round(mathFloor(extent[1] / interval) * interval, intervalPrecision)];
	return {
		interval,
		intervalPrecision,
		niceExtent
	};
}
function logScaleCalcNiceTicks(intervalStub, opt) {
	var splitNumber = ensureValidSplitNumber(opt.splitNumber, 10);
	var intervalExtent = intervalStub.getExtent();
	var span = getScaleLinearSpanEffective(intervalStub);
	var interval = mathMax(quantity(span), 1);
	if (splitNumber / span * interval <= .5) interval *= 10;
	var intervalPrecision = getIntervalPrecision(interval);
	var niceExtent = [round(mathCeil(intervalExtent[0] / interval) * interval, intervalPrecision), round(mathFloor(intervalExtent[1] / interval) * interval, intervalPrecision)];
	return {
		intervalPrecision,
		interval,
		niceExtent
	};
}
/**
* NOTE: See the summary of the process of extent determination in the comment of `scaleMapper.setExtent`.
*
* Calculate a "nice" extent and "nice" ticks configs based on the current scale extent and ec options.
* scale extent will be modified, and config may be set to the scale.
*
* @see SCALE_EXTENT_CONSTRUCTION for the full processing flow.
*/
function scaleCalcNice(axisLike) {
	var scale = axisLike.scale;
	var model = axisLike.model;
	var axis = model.axis;
	var ecModel = model.ecModel;
	scaleCalcNice2(scale, model, axis, ecModel, null);
}
/**
* @see SCALE_EXTENT_CONSTRUCTION for the full processing flow.
*/
function scaleCalcNice2(scale, model, axis, ecModel, externalDataExtent) {
	var rawExtentResult = adoptScaleRawExtentInfoAndPrepare(scale, model, ecModel, axis, externalDataExtent);
	var isIntervalOrTime = isIntervalScale(scale) || isTimeScale(scale);
	scaleCalcNiceDirectly(scale, {
		splitNumber: model.get("splitNumber"),
		fixMinMax: rawExtentResult.fixMM,
		userInterval: model.get("interval"),
		minInterval: isIntervalOrTime ? model.get("minInterval") : null,
		maxInterval: isIntervalOrTime ? model.get("maxInterval") : null,
		rawExtentResult
	});
	if (axis && ecModel) adoptScaleExtentKindMapping(axis, scale, rawExtentResult, ecModel);
}
function scaleCalcNiceDirectly(scale, opt) {
	scaleCalcNiceMethods[scale.type](scale, opt);
}
var scaleCalcNiceMethods = {
	interval: calcNiceForIntervalOrLogScale,
	log: calcNiceForIntervalOrLogScale,
	time: calcNiceForTimeScale,
	ordinal: noop
};
//#endregion
export { registerVisual as A, registerPostInit as C, registerTheme as D, registerProcessor as E, ComponentView as F, zrender_exports as I, normalizeEvent as L, version as M, createOrUpdatePatternFromDecal as N, registerTransform as O, findEventDispatcher as P, stop as R, registerMap as S, registerPreprocessor as T, registerAction as _, PRIORITY as a, registerLayout as b, dependencies as c, dispose as d, getCoordinateSystemDimensions as f, init as g, getMap as h, use as i, setCanvasCreator as j, registerUpdateLifecycle as k, disConnect as l, getInstanceById as m, scaleCalcNice2 as n, connect as o, getInstanceByDom as p, AxisModelCommonMixin as r, dataTool as s, scaleCalcNice as t, disconnect as u, registerCoordinateSystem as v, registerPostUpdate as w, registerLoading as x, registerCustomSeries as y, Axis as z };
