import { Gt as map, Mt as isArray, Rt as isNumber, a as PathProxy, c as DEFAULT_COMMON_STYLE, dt as isImageReady, mt as RADIAN_TO_DEGREE, n as TSpan, pt as env, r as Path, t as ZRImage, ut as createOrUpdateImage } from "./Image-B5UjBJH1.js";
//#region node_modules/zrender/lib/animation/requestAnimationFrame.js
var requestAnimationFrame = env.hasGlobalWindow && (window.requestAnimationFrame && window.requestAnimationFrame.bind(window) || window.msRequestAnimationFrame && window.msRequestAnimationFrame.bind(window) || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame) || function(func) {
	return setTimeout(func, 16);
};
//#endregion
//#region node_modules/zrender/lib/canvas/helper.js
function isSafeNum(num) {
	return isFinite(num);
}
function createLinearGradient(ctx, obj, rect) {
	var x = obj.x == null ? 0 : obj.x;
	var x2 = obj.x2 == null ? 1 : obj.x2;
	var y = obj.y == null ? 0 : obj.y;
	var y2 = obj.y2 == null ? 0 : obj.y2;
	if (!obj.global) {
		x = x * rect.width + rect.x;
		x2 = x2 * rect.width + rect.x;
		y = y * rect.height + rect.y;
		y2 = y2 * rect.height + rect.y;
	}
	x = isSafeNum(x) ? x : 0;
	x2 = isSafeNum(x2) ? x2 : 1;
	y = isSafeNum(y) ? y : 0;
	y2 = isSafeNum(y2) ? y2 : 0;
	return ctx.createLinearGradient(x, y, x2, y2);
}
function createRadialGradient(ctx, obj, rect) {
	var width = rect.width;
	var height = rect.height;
	var min = Math.min(width, height);
	var x = obj.x == null ? .5 : obj.x;
	var y = obj.y == null ? .5 : obj.y;
	var r = obj.r == null ? .5 : obj.r;
	if (!obj.global) {
		x = x * width + rect.x;
		y = y * height + rect.y;
		r = r * min;
	}
	x = isSafeNum(x) ? x : .5;
	y = isSafeNum(y) ? y : .5;
	r = r >= 0 && isSafeNum(r) ? r : .5;
	return ctx.createRadialGradient(x, y, 0, x, y, r);
}
function getCanvasGradient(ctx, obj, rect) {
	var canvasGradient = obj.type === "radial" ? createRadialGradient(ctx, obj, rect) : createLinearGradient(ctx, obj, rect);
	var colorStops = obj.colorStops;
	for (var i = 0; i < colorStops.length; i++) canvasGradient.addColorStop(colorStops[i].offset, colorStops[i].color);
	return canvasGradient;
}
function isClipPathChanged(clipPaths, prevClipPaths) {
	if (clipPaths === prevClipPaths || !clipPaths && !prevClipPaths) return false;
	if (!clipPaths || !prevClipPaths || clipPaths.length !== prevClipPaths.length) return true;
	for (var i = 0; i < clipPaths.length; i++) if (clipPaths[i] !== prevClipPaths[i]) return true;
	return false;
}
function parseInt10(val) {
	return parseInt(val, 10);
}
function getSize(root, whIdx, opts) {
	var wh = ["width", "height"][whIdx];
	var cwh = ["clientWidth", "clientHeight"][whIdx];
	var plt = ["paddingLeft", "paddingTop"][whIdx];
	var prb = ["paddingRight", "paddingBottom"][whIdx];
	if (opts[wh] != null && opts[wh] !== "auto") return parseFloat(opts[wh]);
	var stl = document.defaultView.getComputedStyle(root);
	return (root[cwh] || parseInt10(stl[wh]) || parseInt10(root.style[wh])) - (parseInt10(stl[plt]) || 0) - (parseInt10(stl[prb]) || 0) || 0;
}
//#endregion
//#region node_modules/zrender/lib/canvas/dashStyle.js
function normalizeLineDash(lineType, lineWidth) {
	if (!lineType || lineType === "solid" || !(lineWidth > 0)) return null;
	return lineType === "dashed" ? [4 * lineWidth, 2 * lineWidth] : lineType === "dotted" ? [lineWidth] : isNumber(lineType) ? [lineType] : isArray(lineType) ? lineType : null;
}
function getLineDash(el) {
	var style = el.style;
	var lineDash = style.lineDash && style.lineWidth > 0 && normalizeLineDash(style.lineDash, style.lineWidth);
	var lineDashOffset = style.lineDashOffset;
	if (lineDash) {
		var lineScale_1 = style.strokeNoScale && el.getLineScale ? el.getLineScale() : 1;
		if (lineScale_1 && lineScale_1 !== 1) {
			lineDash = map(lineDash, function(rawVal) {
				return rawVal / lineScale_1;
			});
			lineDashOffset /= lineScale_1;
		}
	}
	return [lineDash, lineDashOffset];
}
//#endregion
//#region node_modules/zrender/lib/canvas/graphic.js
var pathProxyForDraw = new PathProxy(true);
function styleHasStroke(style) {
	var stroke = style.stroke;
	return !(stroke == null || stroke === "none" || !(style.lineWidth > 0));
}
function isValidStrokeFillStyle(strokeOrFill) {
	return typeof strokeOrFill === "string" && strokeOrFill !== "none";
}
function styleHasFill(style) {
	var fill = style.fill;
	return fill != null && fill !== "none";
}
function doFillPath(ctx, style) {
	if (style.fillOpacity != null && style.fillOpacity !== 1) {
		var originalGlobalAlpha = ctx.globalAlpha;
		ctx.globalAlpha = style.fillOpacity * style.opacity;
		ctx.fill();
		ctx.globalAlpha = originalGlobalAlpha;
	} else ctx.fill();
}
function doStrokePath(ctx, style) {
	if (style.strokeOpacity != null && style.strokeOpacity !== 1) {
		var originalGlobalAlpha = ctx.globalAlpha;
		ctx.globalAlpha = style.strokeOpacity * style.opacity;
		ctx.stroke();
		ctx.globalAlpha = originalGlobalAlpha;
	} else ctx.stroke();
}
function createCanvasPattern(ctx, pattern, el) {
	var image = createOrUpdateImage(pattern.image, pattern.__image, el);
	if (isImageReady(image)) {
		var canvasPattern = ctx.createPattern(image, pattern.repeat || "repeat");
		if (typeof DOMMatrix === "function" && canvasPattern && canvasPattern.setTransform) {
			var matrix = new DOMMatrix();
			matrix.translateSelf(pattern.x || 0, pattern.y || 0);
			matrix.rotateSelf(0, 0, (pattern.rotation || 0) * RADIAN_TO_DEGREE);
			matrix.scaleSelf(pattern.scaleX || 1, pattern.scaleY || 1);
			canvasPattern.setTransform(matrix);
		}
		return canvasPattern;
	}
}
function brushPath(ctx, el, style, canBatch, scope) {
	var _a;
	var hasStroke = styleHasStroke(style);
	var hasFill = styleHasFill(style);
	var strokePercent = style.strokePercent;
	var strokePart = strokePercent < 1;
	var firstDraw = !el.path;
	if ((!el.silent || strokePart) && firstDraw) el.createPathProxy();
	var path = el.path || pathProxyForDraw;
	var dirtyFlag = el.__dirty;
	if (!canBatch) {
		var fill = style.fill;
		var stroke = style.stroke;
		var hasFillGradient = hasFill && !!fill.colorStops;
		var hasStrokeGradient = hasStroke && !!stroke.colorStops;
		var hasFillPattern = hasFill && !!fill.image;
		var hasStrokePattern = hasStroke && !!stroke.image;
		var fillGradient = void 0;
		var strokeGradient = void 0;
		var fillPattern = void 0;
		var strokePattern = void 0;
		var rect = void 0;
		if (hasFillGradient || hasStrokeGradient) rect = el.getBoundingRect();
		if (hasFillGradient) {
			fillGradient = dirtyFlag ? getCanvasGradient(ctx, fill, rect) : el.__canvasFillGradient;
			el.__canvasFillGradient = fillGradient;
		}
		if (hasStrokeGradient) {
			strokeGradient = dirtyFlag ? getCanvasGradient(ctx, stroke, rect) : el.__canvasStrokeGradient;
			el.__canvasStrokeGradient = strokeGradient;
		}
		if (hasFillPattern) {
			fillPattern = dirtyFlag || !el.__canvasFillPattern ? createCanvasPattern(ctx, fill, el) : el.__canvasFillPattern;
			el.__canvasFillPattern = fillPattern;
		}
		if (hasStrokePattern) {
			strokePattern = dirtyFlag || !el.__canvasStrokePattern ? createCanvasPattern(ctx, stroke, el) : el.__canvasStrokePattern;
			el.__canvasStrokePattern = strokePattern;
		}
		if (hasFillGradient) ctx.fillStyle = fillGradient;
		else if (hasFillPattern) {
			if (fillPattern) ctx.fillStyle = fillPattern;
			else hasFill = false;
		}
		if (hasStrokeGradient) ctx.strokeStyle = strokeGradient;
		else if (hasStrokePattern) {
			if (strokePattern) ctx.strokeStyle = strokePattern;
			else hasStroke = false;
		}
	}
	var scale = el.getGlobalScale();
	path.setScale(scale[0], scale[1], el.segmentIgnoreThreshold);
	var lineDash;
	var lineDashOffset;
	if (ctx.setLineDash && style.lineDash) _a = getLineDash(el), lineDash = _a[0], lineDashOffset = _a[1];
	var needsRebuild = true;
	if (firstDraw || dirtyFlag & 4) {
		path.setDPR(ctx.dpr);
		if (strokePart) path.setContext(null);
		else {
			path.setContext(ctx);
			needsRebuild = false;
		}
		path.reset();
		el.buildPath(path, el.shape, canBatch);
		path.toStatic();
		el.pathUpdated();
	}
	if (needsRebuild) path.rebuildPath(ctx, strokePart ? strokePercent : 1);
	if (lineDash) {
		ctx.setLineDash(lineDash);
		ctx.lineDashOffset = lineDashOffset;
	}
	if (!canBatch) {
		if (style.strokeFirst) {
			if (hasStroke) doStrokePath(ctx, style);
			if (hasFill) doFillPath(ctx, style);
		} else {
			if (hasFill) doFillPath(ctx, style);
			if (hasStroke) doStrokePath(ctx, style);
		}
	} else {
		scope.batchFill = hasFill;
		scope.batchStroke = hasStroke;
	}
	if (lineDash) ctx.setLineDash([]);
}
function brushImage(ctx, el, style) {
	var image = el.__image = createOrUpdateImage(style.image, el.__image, el, el.onload);
	if (!image || !isImageReady(image)) return;
	var x = style.x || 0;
	var y = style.y || 0;
	var width = el.getWidth();
	var height = el.getHeight();
	var aspect = image.width / image.height;
	if (width == null && height != null) width = height * aspect;
	else if (height == null && width != null) height = width / aspect;
	else if (width == null && height == null) {
		width = image.width;
		height = image.height;
	}
	if (style.sWidth && style.sHeight) {
		var sx = style.sx || 0;
		var sy = style.sy || 0;
		ctx.drawImage(image, sx, sy, style.sWidth, style.sHeight, x, y, width, height);
	} else if (style.sx && style.sy) {
		var sx = style.sx;
		var sy = style.sy;
		var sWidth = width - sx;
		var sHeight = height - sy;
		ctx.drawImage(image, sx, sy, sWidth, sHeight, x, y, width, height);
	} else ctx.drawImage(image, x, y, width, height);
}
function brushText(ctx, el, style) {
	var _a;
	var text = style.text;
	text != null && (text += "");
	if (text) {
		ctx.font = style.font || "12px sans-serif";
		ctx.textAlign = style.textAlign;
		ctx.textBaseline = style.textBaseline;
		var lineDash = void 0;
		var lineDashOffset = void 0;
		if (ctx.setLineDash && style.lineDash) _a = getLineDash(el), lineDash = _a[0], lineDashOffset = _a[1];
		if (lineDash) {
			ctx.setLineDash(lineDash);
			ctx.lineDashOffset = lineDashOffset;
		}
		if (style.strokeFirst) {
			if (styleHasStroke(style)) ctx.strokeText(text, style.x, style.y);
			if (styleHasFill(style)) ctx.fillText(text, style.x, style.y);
		} else {
			if (styleHasFill(style)) ctx.fillText(text, style.x, style.y);
			if (styleHasStroke(style)) ctx.strokeText(text, style.x, style.y);
		}
		if (lineDash) ctx.setLineDash([]);
	}
}
var SHADOW_NUMBER_PROPS = [
	"shadowBlur",
	"shadowOffsetX",
	"shadowOffsetY"
];
var STROKE_PROPS = [
	["lineCap", "butt"],
	["lineJoin", "miter"],
	["miterLimit", 10]
];
function bindCommonProps(ctx, style, prevStyle, forceSetAll, scope) {
	var styleChanged = false;
	if (!forceSetAll) {
		prevStyle = prevStyle || {};
		if (style === prevStyle) return false;
	}
	if (forceSetAll || style.opacity !== prevStyle.opacity) {
		flushPathDrawn(ctx, scope);
		styleChanged = true;
		var opacity = Math.max(Math.min(style.opacity, 1), 0);
		ctx.globalAlpha = isNaN(opacity) ? DEFAULT_COMMON_STYLE.opacity : opacity;
	}
	if (forceSetAll || style.blend !== prevStyle.blend) {
		if (!styleChanged) {
			flushPathDrawn(ctx, scope);
			styleChanged = true;
		}
		ctx.globalCompositeOperation = style.blend || DEFAULT_COMMON_STYLE.blend;
	}
	for (var i = 0; i < SHADOW_NUMBER_PROPS.length; i++) {
		var propName = SHADOW_NUMBER_PROPS[i];
		if (forceSetAll || style[propName] !== prevStyle[propName]) {
			if (!styleChanged) {
				flushPathDrawn(ctx, scope);
				styleChanged = true;
			}
			ctx[propName] = ctx.dpr * (style[propName] || 0);
		}
	}
	if (forceSetAll || style.shadowColor !== prevStyle.shadowColor) {
		if (!styleChanged) {
			flushPathDrawn(ctx, scope);
			styleChanged = true;
		}
		ctx.shadowColor = style.shadowColor || DEFAULT_COMMON_STYLE.shadowColor;
	}
	return styleChanged;
}
function bindPathAndTextCommonStyle(ctx, el, prevEl, forceSetAll, scope) {
	var style = el.style;
	var prevStyle = forceSetAll ? null : prevEl && prevEl.style || {};
	if (style === prevStyle) return false;
	var styleChanged = bindCommonProps(ctx, style, prevStyle, forceSetAll, scope);
	if (forceSetAll || style.fill !== prevStyle.fill) {
		if (!styleChanged) {
			flushPathDrawn(ctx, scope);
			styleChanged = true;
		}
		isValidStrokeFillStyle(style.fill) && (ctx.fillStyle = style.fill);
	}
	if (forceSetAll || style.stroke !== prevStyle.stroke) {
		if (!styleChanged) {
			flushPathDrawn(ctx, scope);
			styleChanged = true;
		}
		isValidStrokeFillStyle(style.stroke) && (ctx.strokeStyle = style.stroke);
	}
	if (forceSetAll || style.opacity !== prevStyle.opacity) {
		if (!styleChanged) {
			flushPathDrawn(ctx, scope);
			styleChanged = true;
		}
		ctx.globalAlpha = style.opacity == null ? 1 : style.opacity;
	}
	if (el.hasStroke()) {
		var newLineWidth = style.lineWidth / (style.strokeNoScale && el.getLineScale ? el.getLineScale() : 1);
		if (ctx.lineWidth !== newLineWidth) {
			if (!styleChanged) {
				flushPathDrawn(ctx, scope);
				styleChanged = true;
			}
			ctx.lineWidth = newLineWidth;
		}
	}
	for (var i = 0; i < STROKE_PROPS.length; i++) {
		var prop = STROKE_PROPS[i];
		var propName = prop[0];
		if (forceSetAll || style[propName] !== prevStyle[propName]) {
			if (!styleChanged) {
				flushPathDrawn(ctx, scope);
				styleChanged = true;
			}
			ctx[propName] = style[propName] || prop[1];
		}
	}
	return styleChanged;
}
function bindImageStyle(ctx, el, prevEl, forceSetAll, scope) {
	return bindCommonProps(ctx, el.style, prevEl && prevEl.style, forceSetAll, scope);
}
function setContextTransform(ctx, el) {
	var m = el.transform;
	var dpr = ctx.dpr || 1;
	if (m) ctx.setTransform(dpr * m[0], dpr * m[1], dpr * m[2], dpr * m[3], dpr * m[4], dpr * m[5]);
	else ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function updateClipStatus(clipPaths, ctx, scope) {
	var allClipped = false;
	for (var i = 0; i < clipPaths.length; i++) {
		var clipPath = clipPaths[i];
		allClipped = allClipped || clipPath.isZeroArea();
		setContextTransform(ctx, clipPath);
		ctx.beginPath();
		clipPath.buildPath(ctx, clipPath.shape);
		ctx.clip();
	}
	scope.allClipped = allClipped;
}
function isTransformChanged(m0, m1) {
	if (m0 && m1) return m0[0] !== m1[0] || m0[1] !== m1[1] || m0[2] !== m1[2] || m0[3] !== m1[3] || m0[4] !== m1[4] || m0[5] !== m1[5];
	else if (!m0 && !m1) return false;
	return true;
}
var DRAW_TYPE_PATH = 1;
var DRAW_TYPE_IMAGE = 2;
var DRAW_TYPE_TEXT = 3;
var DRAW_TYPE_INCREMENTAL = 4;
function canPathBatch(style) {
	var hasFill = styleHasFill(style);
	var hasStroke = styleHasStroke(style);
	return !(style.lineDash || !(+hasFill ^ +hasStroke) || hasFill && typeof style.fill !== "string" || hasStroke && typeof style.stroke !== "string" || style.strokePercent < 1 || style.strokeOpacity < 1 || style.fillOpacity < 1);
}
function flushPathDrawn(ctx, scope) {
	if (scope.batchFill) {
		scope.batchFill = false;
		ctx.fill();
	}
	if (scope.batchStroke) {
		scope.batchStroke = false;
		ctx.stroke();
	}
}
function brushSingle(ctx, el) {
	var scope = {
		inHover: false,
		viewWidth: 0,
		viewHeight: 0,
		beforeBrushParam: {}
	};
	brush(ctx, el, scope);
	brushLoopFinalize(ctx, scope);
}
function brush(ctx, el, scope) {
	var m = el.transform;
	if (!el.shouldBePainted(scope.viewWidth, scope.viewHeight, false, false)) {
		el.__dirty &= -2;
		el.__isRendered = false;
		return;
	}
	var clipPaths = el.__clipPaths;
	var prevElClipPaths = scope.prevElClipPaths;
	var style = el.style;
	var forceSetTransform = false;
	var forceSetStyle = false;
	if (!prevElClipPaths || isClipPathChanged(clipPaths, prevElClipPaths)) {
		if (prevElClipPaths) {
			flushPathDrawn(ctx, scope);
			ctx.restore();
			forceSetStyle = forceSetTransform = true;
			scope.prevElClipPaths = null;
			scope.allClipped = false;
			scope.prevEl = null;
		}
		if (clipPaths && clipPaths.length) {
			flushPathDrawn(ctx, scope);
			ctx.save();
			updateClipStatus(clipPaths, ctx, scope);
			forceSetTransform = true;
			scope.prevElClipPaths = clipPaths;
		}
	}
	if (scope.allClipped) {
		el.__dirty &= -2;
		el.__isRendered = false;
		return;
	}
	el.beforeBrush && el.beforeBrush(scope.beforeBrushParam);
	el.innerBeforeBrush();
	var prevEl = scope.prevEl;
	if (!prevEl) forceSetStyle = forceSetTransform = true;
	var canBatchPath = el instanceof Path && el.autoBatch && canPathBatch(style);
	if (forceSetTransform || isTransformChanged(m, prevEl.transform)) {
		flushPathDrawn(ctx, scope);
		setContextTransform(ctx, el);
	} else if (!canBatchPath) flushPathDrawn(ctx, scope);
	if (el instanceof Path) {
		if (scope.lastDrawType !== DRAW_TYPE_PATH) {
			forceSetStyle = true;
			scope.lastDrawType = DRAW_TYPE_PATH;
		}
		bindPathAndTextCommonStyle(ctx, el, prevEl, forceSetStyle, scope);
		if (!canBatchPath || !scope.batchFill && !scope.batchStroke) ctx.beginPath();
		brushPath(ctx, el, style, canBatchPath, scope);
	} else if (el instanceof TSpan) {
		if (scope.lastDrawType !== DRAW_TYPE_TEXT) {
			forceSetStyle = true;
			scope.lastDrawType = DRAW_TYPE_TEXT;
		}
		bindPathAndTextCommonStyle(ctx, el, prevEl, forceSetStyle, scope);
		brushText(ctx, el, style);
	} else if (el instanceof ZRImage) {
		if (scope.lastDrawType !== DRAW_TYPE_IMAGE) {
			forceSetStyle = true;
			scope.lastDrawType = DRAW_TYPE_IMAGE;
		}
		bindImageStyle(ctx, el, prevEl, forceSetStyle, scope);
		brushImage(ctx, el, style);
	} else if (el.getTemporalDisplayables) {
		if (scope.lastDrawType !== DRAW_TYPE_INCREMENTAL) {
			forceSetStyle = true;
			scope.lastDrawType = DRAW_TYPE_INCREMENTAL;
		}
		brushIncremental(ctx, el, scope);
	}
	el.innerAfterBrush();
	if (el.afterBrush) {
		if (canBatchPath) flushPathDrawn(ctx, scope);
		el.afterBrush();
	}
	scope.prevEl = el;
	el.__dirty = 0;
	el.__isRendered = true;
}
function brushLoopFinalize(ctx, scope) {
	flushPathDrawn(ctx, scope);
	if (scope.prevElClipPaths) ctx.restore();
}
function brushIncremental(ctx, el, scope) {
	var displayables = el.getDisplayables();
	var temporalDisplayables = el.getTemporalDisplayables();
	ctx.save();
	var innerScope = {
		prevElClipPaths: null,
		prevEl: null,
		allClipped: false,
		viewWidth: scope.viewWidth,
		viewHeight: scope.viewHeight,
		inHover: scope.inHover,
		beforeBrushParam: {}
	};
	var i;
	var len;
	for (i = el.getCursor(), len = displayables.length; i < len; i++) {
		var displayable = displayables[i];
		displayable.beforeBrush && displayable.beforeBrush(scope.beforeBrushParam);
		displayable.innerBeforeBrush();
		brush(ctx, displayable, innerScope);
		displayable.innerAfterBrush();
		displayable.afterBrush && displayable.afterBrush();
		innerScope.prevEl = displayable;
	}
	brushLoopFinalize(ctx, innerScope);
	for (var i_1 = 0, len_1 = temporalDisplayables.length; i_1 < len_1; i_1++) {
		var displayable = temporalDisplayables[i_1];
		displayable.beforeBrush && displayable.beforeBrush(scope.beforeBrushParam);
		displayable.innerBeforeBrush();
		brush(ctx, displayable, innerScope);
		displayable.innerAfterBrush();
		displayable.afterBrush && displayable.afterBrush();
		innerScope.prevEl = displayable;
	}
	brushLoopFinalize(ctx, innerScope);
	el.clearTemporalDisplayables();
	el.notClear = true;
	ctx.restore();
}
//#endregion
export { getCanvasGradient as a, createCanvasPattern as i, brushLoopFinalize as n, getSize as o, brushSingle as r, requestAnimationFrame as s, brush as t };
