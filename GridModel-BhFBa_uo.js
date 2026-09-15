import { $t as retrieve3, A as copyTransform, Bt as isString, Ct as each, Et as filter, Ft as isFunction, G as applyTransform, Gt as map, Qt as retrieve2, Rt as isNumber, Tt as extend, U as Point, V as BoundingRect, Zt as retrieve, at as invert, ct as rotate, it as identity, rt as create, sn as __extends, st as mul, xt as defaults, zt as isObject } from "./Image-B5UjBJH1.js";
import { $ as createSymbol, $r as SINGLE_REFERRING, At as getScaleBreakHelper, C as createAxisLabelsComputingContext, Dn as ensureCopyRect, F as shouldShowAllLabels, Hi as isRadianAroundZero, In as isBoundingRectAxisAligned, K as isOrdinalScale, On as ensureCopyTransform, Sn as XY, U as isIntervalOrLogScale, Un as setTooltipConfig, Wn as subPixelOptimizeLine, Zr as getECData, _t as getLayoutParams, aa as remRadian, b as AxisTickLabelComputingKind, ca as ZRText, er as OrientedBoundingRect, et as normalizeSymbolOffset, fn as Model, ft as ComponentModel, gn as createTextStyle, hi as makeInner, hn as LabelMarginType, j as isNameLocationCenter, jt as hasBreaks, k as getTickValueOutermost, kn as expandOrShrinkRect, la as Rect, or as Line, pr as Group, q as isTimeScale, st as tokens, xn as WH, yt as mergeLayoutParam } from "./dataSelectAction-DEGlLCfR.js";
//#region node_modules/echarts/lib/label/labelLayoutHelper.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var LABEL_LAYOUT_BASE_PROPS = [
	"label",
	"labelLine",
	"layoutOption",
	"priority",
	"defaultAttr",
	"marginForce",
	"minMarginForce",
	"marginDefault",
	"suggestIgnore"
];
var LABEL_LAYOUT_DIRTY_BIT_OTHERS = 1;
var LABEL_LAYOUT_DIRTY_BIT_OBB = 2;
var LABEL_LAYOUT_DIRTY_ALL = LABEL_LAYOUT_DIRTY_BIT_OTHERS | LABEL_LAYOUT_DIRTY_BIT_OBB;
function setLabelLayoutDirty(labelGeometry, dirtyOrClear, dirtyBits) {
	dirtyBits = dirtyBits || LABEL_LAYOUT_DIRTY_ALL;
	dirtyOrClear ? labelGeometry.dirty |= dirtyBits : labelGeometry.dirty &= ~dirtyBits;
}
function isLabelLayoutDirty(labelGeometry, dirtyBits) {
	dirtyBits = dirtyBits || LABEL_LAYOUT_DIRTY_ALL;
	return labelGeometry.dirty == null || !!(labelGeometry.dirty & dirtyBits);
}
/**
* [CAUTION]
*  - No auto dirty propagation mechanism yet. If the transform of the raw label or any of its ancestors is
*    changed, must sync the changes to the props of `LabelGeometry` by:
*    either explicitly call:
*      `setLabelLayoutDirty(labelLayout, true); ensureLabelLayoutWithGeometry(labelLayout);`
*    or call (if only translation is performed):
*      `labelLayoutApplyTranslation(labelLayout);`
*  - `label.ignore` is not necessarily falsy, and not considered in computing `LabelGeometry`,
*    since it might be modified by some overlap resolving handling.
*  - To duplicate or make a variation:
*    use `newLabelLayoutWithGeometry`.
*
* The result can also be the input of this method.
* @return `NullUndefined` if and only if `labelLayout` is `NullUndefined`.
*/
function ensureLabelLayoutWithGeometry(labelLayout) {
	if (!labelLayout) return;
	if (isLabelLayoutDirty(labelLayout)) computeLabelGeometry(labelLayout, labelLayout.label, labelLayout);
	return labelLayout;
}
/**
* The props in `out` will be filled if existing, or created.
*/
function computeLabelGeometry(out, label, opt) {
	var rawTransform = label.getComputedTransform();
	out.transform = ensureCopyTransform(out.transform, rawTransform);
	var outLocalRect = out.localRect = ensureCopyRect(out.localRect, label.getBoundingRect());
	var labelStyleExt = label.style;
	var margin = labelStyleExt.margin;
	var marginForce = opt && opt.marginForce;
	var minMarginForce = opt && opt.minMarginForce;
	var marginDefault = opt && opt.marginDefault;
	var marginType = labelStyleExt.__marginType;
	if (marginType == null && marginDefault) {
		margin = marginDefault;
		marginType = LabelMarginType.textMargin;
	}
	for (var i = 0; i < 4; i++) _tmpLabelMargin[i] = marginType === LabelMarginType.minMargin && minMarginForce && minMarginForce[i] != null ? minMarginForce[i] : marginForce && marginForce[i] != null ? marginForce[i] : margin ? margin[i] : 0;
	if (marginType === LabelMarginType.textMargin) expandOrShrinkRect(outLocalRect, _tmpLabelMargin, false, false);
	var outGlobalRect = out.rect = ensureCopyRect(out.rect, outLocalRect);
	if (rawTransform) outGlobalRect.applyTransform(rawTransform);
	if (marginType === LabelMarginType.minMargin) expandOrShrinkRect(outGlobalRect, _tmpLabelMargin, false, false);
	out.axisAligned = isBoundingRectAxisAligned(rawTransform);
	(out.label = out.label || {}).ignore = label.ignore;
	setLabelLayoutDirty(out, false);
	setLabelLayoutDirty(out, true, LABEL_LAYOUT_DIRTY_BIT_OBB);
	return out;
}
var _tmpLabelMargin = [
	0,
	0,
	0,
	0
];
/**
* The props in `out` will be filled if existing, or created.
*/
function computeLabelGeometry2(out, rawLocalRect, rawTransform) {
	out.transform = ensureCopyTransform(out.transform, rawTransform);
	out.localRect = ensureCopyRect(out.localRect, rawLocalRect);
	out.rect = ensureCopyRect(out.rect, rawLocalRect);
	if (rawTransform) out.rect.applyTransform(rawTransform);
	out.axisAligned = isBoundingRectAxisAligned(rawTransform);
	out.obb = void 0;
	(out.label = out.label || {}).ignore = false;
	return out;
}
/**
* This is a shortcut of
*   ```js
*   labelLayout.label.x = newX;
*   labelLayout.label.y = newY;
*   setLabelLayoutDirty(labelLayout, true);
*   ensureLabelLayoutWithGeometry(labelLayout);
*   ```
* and provide better performance in this common case.
*/
function labelLayoutApplyTranslation(labelLayout, offset) {
	if (!labelLayout) return;
	labelLayout.label.x += offset.x;
	labelLayout.label.y += offset.y;
	labelLayout.label.markRedraw();
	var transform = labelLayout.transform;
	if (transform) {
		transform[4] += offset.x;
		transform[5] += offset.y;
	}
	var globalRect = labelLayout.rect;
	if (globalRect) {
		globalRect.x += offset.x;
		globalRect.y += offset.y;
	}
	var obb = labelLayout.obb;
	if (obb) obb.fromBoundingRect(labelLayout.localRect, transform);
}
/**
* To duplicate or make a variation of a label layout.
* Copy the only relevant properties to avoid the conflict or wrongly reuse of the props of `LabelLayoutWithGeometry`.
*/
function newLabelLayoutWithGeometry(newBaseWithDefaults, source) {
	for (var i = 0; i < LABEL_LAYOUT_BASE_PROPS.length; i++) {
		var prop = LABEL_LAYOUT_BASE_PROPS[i];
		if (newBaseWithDefaults[prop] == null) newBaseWithDefaults[prop] = source[prop];
	}
	return ensureLabelLayoutWithGeometry(newBaseWithDefaults);
}
/**
* Create obb if no one, can cache it.
*/
function ensureOBB(labelGeometry) {
	var obb = labelGeometry.obb;
	if (!obb || isLabelLayoutDirty(labelGeometry, LABEL_LAYOUT_DIRTY_BIT_OBB)) {
		labelGeometry.obb = obb = obb || new OrientedBoundingRect();
		obb.fromBoundingRect(labelGeometry.localRect, labelGeometry.transform);
		setLabelLayoutDirty(labelGeometry, false, LABEL_LAYOUT_DIRTY_BIT_OBB);
	}
	return obb;
}
/**
* Adjust labels on x/y direction to avoid overlap.
*
* PENDING: the current implementation is based on the global bounding rect rather than the local rect,
*  which may be not preferable in some edge cases when the label has rotation, but works for most cases,
*  since rotation is unnecessary when there is sufficient space, while squeezing is applied regardless
*  of overlapping when there is no enough space.
*
* NOTICE:
*  - The input `list` and its content will be modified (sort, label.x/y, rect).
*  - The caller should sync the modifications to the other parts by
*    `setLabelLayoutDirty` and `ensureLabelLayoutWithGeometry` if needed.
*
* @return adjusted
*/
function shiftLayoutOnXY(list, xyDimIdx, minBound, maxBound, balanceShift) {
	var len = list.length;
	var xyDim = XY[xyDimIdx];
	var sizeDim = WH[xyDimIdx];
	if (len < 2) return false;
	list.sort(function(a, b) {
		return a.rect[xyDim] - b.rect[xyDim];
	});
	var lastPos = 0;
	var delta;
	var adjusted = false;
	var totalShifts = 0;
	for (var i = 0; i < len; i++) {
		var item = list[i];
		var rect = item.rect;
		delta = rect[xyDim] - lastPos;
		if (delta < 0) {
			rect[xyDim] -= delta;
			item.label[xyDim] -= delta;
			adjusted = true;
		}
		var shift = Math.max(-delta, 0);
		totalShifts += shift;
		lastPos = rect[xyDim] + rect[sizeDim];
	}
	if (totalShifts > 0 && balanceShift) shiftList(-totalShifts / len, 0, len);
	var first = list[0];
	var last = list[len - 1];
	var minGap;
	var maxGap;
	updateMinMaxGap();
	minGap < 0 && squeezeGaps(-minGap, .8);
	maxGap < 0 && squeezeGaps(maxGap, .8);
	updateMinMaxGap();
	takeBoundsGap(minGap, maxGap, 1);
	takeBoundsGap(maxGap, minGap, -1);
	updateMinMaxGap();
	if (minGap < 0) squeezeWhenBailout(-minGap);
	if (maxGap < 0) squeezeWhenBailout(maxGap);
	function updateMinMaxGap() {
		minGap = first.rect[xyDim] - minBound;
		maxGap = maxBound - last.rect[xyDim] - last.rect[sizeDim];
	}
	function takeBoundsGap(gapThisBound, gapOtherBound, moveDir) {
		if (gapThisBound < 0) {
			var moveFromMaxGap = Math.min(gapOtherBound, -gapThisBound);
			if (moveFromMaxGap > 0) {
				shiftList(moveFromMaxGap * moveDir, 0, len);
				var remained = moveFromMaxGap + gapThisBound;
				if (remained < 0) squeezeGaps(-remained * moveDir, 1);
			} else squeezeGaps(-gapThisBound * moveDir, 1);
		}
	}
	function shiftList(delta, start, end) {
		if (delta !== 0) adjusted = true;
		for (var i = start; i < end; i++) {
			var item = list[i];
			var rect = item.rect;
			rect[xyDim] += delta;
			item.label[xyDim] += delta;
		}
	}
	function squeezeGaps(delta, maxSqeezePercent) {
		var gaps = [];
		var totalGaps = 0;
		for (var i = 1; i < len; i++) {
			var prevItemRect = list[i - 1].rect;
			var gap = Math.max(list[i].rect[xyDim] - prevItemRect[xyDim] - prevItemRect[sizeDim], 0);
			gaps.push(gap);
			totalGaps += gap;
		}
		if (!totalGaps) return;
		var squeezePercent = Math.min(Math.abs(delta) / totalGaps, maxSqeezePercent);
		if (delta > 0) for (var i = 0; i < len - 1; i++) {
			var movement = gaps[i] * squeezePercent;
			shiftList(movement, 0, i + 1);
		}
		else for (var i = len - 1; i > 0; i--) {
			var movement = gaps[i - 1] * squeezePercent;
			shiftList(-movement, i, len);
		}
	}
	/**
	* Squeeze to allow overlap if there is no more space available.
	* Let other overlapping strategy like hideOverlap do the job instead of keep exceeding the bounds.
	*/
	function squeezeWhenBailout(delta) {
		var dir = delta < 0 ? -1 : 1;
		delta = Math.abs(delta);
		var moveForEachLabel = Math.ceil(delta / (len - 1));
		for (var i = 0; i < len - 1; i++) {
			if (dir > 0) shiftList(moveForEachLabel, 0, i + 1);
			else shiftList(-moveForEachLabel, len - i - 1, len);
			delta -= moveForEachLabel;
			if (delta <= 0) return;
		}
	}
	return adjusted;
}
/**
* [NOTICE - restore]:
*  'series:layoutlabels' may be triggered during some EC_PARTIAL_UPDATE passes, such as zooming in series.graph/geo
*  (`updateLabelLayout`), where the modified `Element` props should be restorable from `defaultAttr`.
*  @see `SavedLabelAttr` in `LabelManager.ts`
*  `restoreIgnore` can be called to perform the restore, if needed.
*
* [NOTICE - state]:
*  Regarding Element's states, this method is only designed for the normal state.
*  PENDING: although currently this method is effectively called in other states in `updateLabelLayout` case,
*      the bad case is not noticeable in the zooming scenario.
*/
function hideOverlap(labelList) {
	var displayedLabels = [];
	labelList.sort(function(a, b) {
		return (b.suggestIgnore ? 1 : 0) - (a.suggestIgnore ? 1 : 0) || b.priority - a.priority;
	});
	function hideEl(el) {
		if (!el.ignore) {
			var emphasisState = el.ensureState("emphasis");
			if (emphasisState.ignore == null) emphasisState.ignore = false;
		}
		el.ignore = true;
	}
	for (var i = 0; i < labelList.length; i++) {
		var labelItem = ensureLabelLayoutWithGeometry(labelList[i]);
		if (labelItem.label.ignore) continue;
		var label = labelItem.label;
		var labelLine = labelItem.labelLine;
		var overlapped = false;
		for (var j = 0; j < displayedLabels.length; j++) if (labelIntersect(labelItem, displayedLabels[j], null, { touchThreshold: .05 })) {
			overlapped = true;
			break;
		}
		if (overlapped) {
			hideEl(label);
			labelLine && hideEl(labelLine);
		} else displayedLabels.push(labelItem);
	}
}
/**
* Enable fast check for performance; use obb if inevitable.
* If `mtv` is used, `targetLayoutInfo` can be moved based on the values filled into `mtv`.
*
* This method is based only on the current `Element` states (regardless of other states).
* Typically this method (and the entire layout process) is performed in normal state.
*/
function labelIntersect(baseLayoutInfo, targetLayoutInfo, mtv, intersectOpt) {
	if (!baseLayoutInfo || !targetLayoutInfo) return false;
	if (baseLayoutInfo.label && baseLayoutInfo.label.ignore || targetLayoutInfo.label && targetLayoutInfo.label.ignore) return false;
	if (!baseLayoutInfo.rect.intersect(targetLayoutInfo.rect, mtv, intersectOpt)) return false;
	if (baseLayoutInfo.axisAligned && targetLayoutInfo.axisAligned) return true;
	return ensureOBB(baseLayoutInfo).intersect(ensureOBB(targetLayoutInfo), mtv, intersectOpt);
}
//#endregion
//#region node_modules/echarts/lib/component/axis/axisBreakHelper.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var _impl = null;
function getAxisBreakHelper() {
	return _impl;
}
//#endregion
//#region node_modules/echarts/lib/component/axis/axisAction.js
var AXIS_BREAK_EXPAND_ACTION_TYPE = "expandAxisBreak";
//#endregion
//#region node_modules/echarts/lib/component/axis/AxisBuilder.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var PI = Math.PI;
var DEFAULT_CENTER_NAME_MARGIN_LEVELS = [
	[
		1,
		2,
		1,
		2
	],
	[
		5,
		3,
		5,
		3
	],
	[
		8,
		3,
		8,
		3
	]
];
var DEFAULT_ENDS_NAME_MARGIN_LEVELS = [
	[
		0,
		1,
		0,
		1
	],
	[
		0,
		3,
		0,
		3
	],
	[
		0,
		3,
		0,
		3
	]
];
var getLabelInner = makeInner();
var getTickInner = makeInner();
/**
* A context shared by difference axisBuilder instances.
* For cross-axes overlap resolving.
*
* Lifecycle constraint: should not over a pass of ec main process.
*  If model is changed, the context must be disposed.
*
* @see AxisBuilderLocalContext
*/
var AxisBuilderSharedContext = function() {
	function AxisBuilderSharedContext(resolveAxisNameOverlap) {
		/**
		* [CAUTION] Do not modify this data structure outside this class.
		*/
		this.recordMap = {};
		this.resolveAxisNameOverlap = resolveAxisNameOverlap;
	}
	AxisBuilderSharedContext.prototype.ensureRecord = function(axisModel) {
		var dim = axisModel.axis.dim;
		var idx = axisModel.componentIndex;
		var recordMap = this.recordMap;
		var records = recordMap[dim] || (recordMap[dim] = []);
		return records[idx] || (records[idx] = { ready: {} });
	};
	return AxisBuilderSharedContext;
}();
/**
* [CAUTION]
*  1. The call of this function must be after axisLabel overlap handlings
*     (such as `hideOverlap`, `fixMinMaxLabelShow`) and after transform calculating.
*  2. Can be called multiple times and should be idempotent.
*/
function resetOverlapRecordToShared(cfg, shared, axisModel, labelLayoutList) {
	var axis = axisModel.axis;
	var record = shared.ensureRecord(axisModel);
	var labelInfoList = [];
	var stOccupiedRect;
	var useStOccupiedRect = hasAxisName(cfg.axisName) && isNameLocationCenter(cfg.nameLocation);
	each(labelLayoutList, function(layout) {
		var layoutInfo = ensureLabelLayoutWithGeometry(layout);
		if (!layoutInfo || layoutInfo.label.ignore) return;
		labelInfoList.push(layoutInfo);
		var transGroup = record.transGroup;
		if (useStOccupiedRect) {
			transGroup.transform ? invert(_stTransTmp, transGroup.transform) : identity(_stTransTmp);
			if (layoutInfo.transform) mul(_stTransTmp, _stTransTmp, layoutInfo.transform);
			BoundingRect.copy(_stLabelRectTmp, layoutInfo.localRect);
			_stLabelRectTmp.applyTransform(_stTransTmp);
			stOccupiedRect ? stOccupiedRect.union(_stLabelRectTmp) : BoundingRect.copy(stOccupiedRect = new BoundingRect(0, 0, 0, 0), _stLabelRectTmp);
		}
	});
	var sortByDim = Math.abs(record.dirVec.x) > .1 ? "x" : "y";
	var sortByValue = record.transGroup[sortByDim];
	labelInfoList.sort(function(info1, info2) {
		return Math.abs(info1.label[sortByDim] - sortByValue) - Math.abs(info2.label[sortByDim] - sortByValue);
	});
	if (useStOccupiedRect && stOccupiedRect) {
		var extent = axis.getExtent();
		var axisLineX = Math.min(extent[0], extent[1]);
		var axisLineWidth = Math.max(extent[0], extent[1]) - axisLineX;
		stOccupiedRect.union(new BoundingRect(axisLineX, 0, axisLineWidth, 1));
	}
	record.stOccupiedRect = stOccupiedRect;
	record.labelInfoList = labelInfoList;
}
var _stTransTmp = create();
var _stLabelRectTmp = new BoundingRect(0, 0, 0, 0);
/**
* The default resolver does not involve other axes within the same coordinate system.
*/
var resolveAxisNameOverlapDefault = function(cfg, ctx, axisModel, nameLayoutInfo, nameMoveDirVec, thisRecord) {
	if (isNameLocationCenter(cfg.nameLocation)) {
		var stOccupiedRect = thisRecord.stOccupiedRect;
		if (stOccupiedRect) moveIfOverlap(computeLabelGeometry2({}, stOccupiedRect, thisRecord.transGroup.transform), nameLayoutInfo, nameMoveDirVec);
	} else moveIfOverlapByLinearLabels(thisRecord.labelInfoList, thisRecord.dirVec, nameLayoutInfo, nameMoveDirVec);
};
function moveIfOverlap(basedLayoutInfo, movableLayoutInfo, moveDirVec) {
	var mtv = new Point();
	if (labelIntersect(basedLayoutInfo, movableLayoutInfo, mtv, {
		direction: Math.atan2(moveDirVec.y, moveDirVec.x),
		bidirectional: false,
		touchThreshold: .05
	})) labelLayoutApplyTranslation(movableLayoutInfo, mtv);
}
function moveIfOverlapByLinearLabels(baseLayoutInfoList, baseDirVec, movableLayoutInfo, moveDirVec) {
	var sameDir = Point.dot(moveDirVec, baseDirVec) >= 0;
	for (var idx = 0, len = baseLayoutInfoList.length; idx < len; idx++) {
		var labelInfo = baseLayoutInfoList[sameDir ? idx : len - 1 - idx];
		if (!labelInfo.label.ignore) moveIfOverlap(labelInfo, movableLayoutInfo, moveDirVec);
	}
}
/**
* @caution
* - Ensure it is called after the data processing stage finished.
* - It might be called before `CahrtView#render`, sush as called at `CoordinateSystem#update`,
*  thus ensure the result the same whenever it is called.
*
* A builder for a straight-line axis.
*
* A final axis is translated and rotated from a "standard axis".
* So opt.position and opt.rotation is required.
*
* A "standard axis" is the axis [0,0]-->[abs(axisExtent[1]-axisExtent[0]),0]
* for example: [0,0]-->[50,0]
*/
var AxisBuilder = function() {
	/**
	* [CAUTION]: axisModel.axis.extent/scale must be ready to use.
	*/
	function AxisBuilder(axisModel, api, opt, shared) {
		this.group = new Group();
		this._axisModel = axisModel;
		this._api = api;
		this._local = {};
		this._shared = shared || new AxisBuilderSharedContext(resolveAxisNameOverlapDefault);
		this._resetCfgDetermined(opt);
	}
	/**
	* Regarding axis label related configurations, only the change of label.x/y is supported; other
	* changes are not necessary and not performant. To be specific, only `axis.position`
	* (and consequently `labelOffset`) and `axis.extent` can be changed, and assume everything in
	* `axisModel` are not changed.
	* Axis line related configurations can be changed since this method can only be called
	* before they are created.
	*/
	AxisBuilder.prototype.updateCfg = function(opt) {
		var raw = this._cfg.raw;
		raw.position = opt.position;
		raw.labelOffset = opt.labelOffset;
		this._resetCfgDetermined(raw);
	};
	/**
	* [CAUTION] For debug usage. Never change it outside!
	*/
	AxisBuilder.prototype.__getRawCfg = function() {
		return this._cfg.raw;
	};
	AxisBuilder.prototype._resetCfgDetermined = function(raw) {
		var axisModel = this._axisModel;
		var axisModelDefaultOption = axisModel.getDefaultOption ? axisModel.getDefaultOption() : {};
		var axisName = retrieve2(raw.axisName, axisModel.get("name"));
		var nameMoveOverlapOption = axisModel.get("nameMoveOverlap");
		if (nameMoveOverlapOption == null || nameMoveOverlapOption === "auto") nameMoveOverlapOption = retrieve2(raw.defaultNameMoveOverlap, true);
		var cfg = {
			raw,
			position: raw.position,
			rotation: raw.rotation,
			nameDirection: retrieve2(raw.nameDirection, 1),
			tickDirection: retrieve2(raw.tickDirection, 1),
			labelDirection: retrieve2(raw.labelDirection, 1),
			labelOffset: retrieve2(raw.labelOffset, 0),
			silent: retrieve2(raw.silent, true),
			axisName,
			nameLocation: retrieve3(axisModel.get("nameLocation"), axisModelDefaultOption.nameLocation, "end"),
			shouldNameMoveOverlap: hasAxisName(axisName) && nameMoveOverlapOption,
			optionHideOverlap: axisModel.get(["axisLabel", "hideOverlap"]),
			showMinorTicks: axisModel.get(["minorTick", "show"])
		};
		this._cfg = cfg;
		var transformGroup = new Group({
			x: cfg.position[0],
			y: cfg.position[1],
			rotation: cfg.rotation
		});
		transformGroup.updateTransform();
		this._transformGroup = transformGroup;
		var record = this._shared.ensureRecord(axisModel);
		record.transGroup = this._transformGroup;
		record.dirVec = new Point(Math.cos(-cfg.rotation), Math.sin(-cfg.rotation));
	};
	AxisBuilder.prototype.build = function(axisPartNameMap, extraParams) {
		var _this = this;
		if (!axisPartNameMap) axisPartNameMap = {
			axisLine: true,
			axisTickLabelEstimate: false,
			axisTickLabelDetermine: true,
			axisName: true
		};
		each(AXIS_BUILDER_AXIS_PART_NAMES, function(partName) {
			if (axisPartNameMap[partName]) builders[partName](_this._cfg, _this._local, _this._shared, _this._axisModel, _this.group, _this._transformGroup, _this._api, extraParams || {});
		});
		return this;
	};
	/**
	* Currently only get text align/verticalAlign by rotation.
	* NO `position` is involved, otherwise it have to be performed for each `updateAxisLabelChangableProps`.
	*/
	AxisBuilder.innerTextLayout = function(axisRotation, textRotation, direction) {
		var rotationDiff = remRadian(textRotation - axisRotation);
		var textAlign;
		var textVerticalAlign;
		if (isRadianAroundZero(rotationDiff)) {
			textVerticalAlign = direction > 0 ? "top" : "bottom";
			textAlign = "center";
		} else if (isRadianAroundZero(rotationDiff - PI)) {
			textVerticalAlign = direction > 0 ? "bottom" : "top";
			textAlign = "center";
		} else {
			textVerticalAlign = "middle";
			if (rotationDiff > 0 && rotationDiff < PI) textAlign = direction > 0 ? "right" : "left";
			else textAlign = direction > 0 ? "left" : "right";
		}
		return {
			rotation: rotationDiff,
			textAlign,
			textVerticalAlign
		};
	};
	AxisBuilder.makeAxisEventDataBase = function(axisModel) {
		var eventData = {
			componentType: axisModel.mainType,
			componentIndex: axisModel.componentIndex
		};
		eventData[axisModel.mainType + "Index"] = axisModel.componentIndex;
		return eventData;
	};
	AxisBuilder.isLabelSilent = function(axisModel) {
		var tooltipOpt = axisModel.get("tooltip");
		return axisModel.get("silent") || !(axisModel.get("triggerEvent") || tooltipOpt && tooltipOpt.show);
	};
	return AxisBuilder;
}();
var AXIS_BUILDER_AXIS_PART_NAMES = [
	"axisLine",
	"axisTickLabelEstimate",
	"axisTickLabelDetermine",
	"axisName"
];
var builders = {
	axisLine: function(cfg, local, shared, axisModel, group, transformGroup, api) {
		var shown = axisModel.get(["axisLine", "show"]);
		if (shown === "auto") {
			shown = true;
			if (cfg.raw.axisLineAutoShow != null) shown = !!cfg.raw.axisLineAutoShow;
		}
		if (!shown) return;
		var extent = axisModel.axis.getExtent();
		var matrix = transformGroup.transform;
		var pt1 = [extent[0], 0];
		var pt2 = [extent[1], 0];
		var inverse = pt1[0] > pt2[0];
		if (matrix) {
			applyTransform(pt1, pt1, matrix);
			applyTransform(pt2, pt2, matrix);
		}
		var lineStyle = extend({ lineCap: "round" }, axisModel.getModel(["axisLine", "lineStyle"]).getLineStyle());
		var pathBaseProp = {
			strokeContainThreshold: cfg.raw.strokeContainThreshold || 5,
			silent: true,
			z2: 1,
			style: lineStyle
		};
		if (axisModel.get(["axisLine", "breakLine"]) && hasBreaks(axisModel.axis.scale)) getAxisBreakHelper().buildAxisBreakLine(axisModel, group, transformGroup, pathBaseProp);
		else {
			var line = new Line(extend({ shape: {
				x1: pt1[0],
				y1: pt1[1],
				x2: pt2[0],
				y2: pt2[1]
			} }, pathBaseProp));
			subPixelOptimizeLine(line.shape, line.style.lineWidth);
			line.anid = "line";
			group.add(line);
		}
		var arrows = axisModel.get(["axisLine", "symbol"]);
		if (arrows != null) {
			var arrowSize = axisModel.get(["axisLine", "symbolSize"]);
			if (isString(arrows)) arrows = [arrows, arrows];
			if (isString(arrowSize) || isNumber(arrowSize)) arrowSize = [arrowSize, arrowSize];
			var arrowOffset = normalizeSymbolOffset(axisModel.get(["axisLine", "symbolOffset"]) || 0, arrowSize);
			var symbolWidth_1 = arrowSize[0];
			var symbolHeight_1 = arrowSize[1];
			each([{
				rotate: cfg.rotation + Math.PI / 2,
				offset: arrowOffset[0],
				r: 0
			}, {
				rotate: cfg.rotation - Math.PI / 2,
				offset: arrowOffset[1],
				r: Math.sqrt((pt1[0] - pt2[0]) * (pt1[0] - pt2[0]) + (pt1[1] - pt2[1]) * (pt1[1] - pt2[1]))
			}], function(point, index) {
				if (arrows[index] !== "none" && arrows[index] != null) {
					var symbol = createSymbol(arrows[index], -symbolWidth_1 / 2, -symbolHeight_1 / 2, symbolWidth_1, symbolHeight_1, lineStyle.stroke, true);
					var r = point.r + point.offset;
					var pt = inverse ? pt2 : pt1;
					symbol.attr({
						rotation: point.rotate,
						x: pt[0] + r * Math.cos(cfg.rotation),
						y: pt[1] - r * Math.sin(cfg.rotation),
						silent: true,
						z2: 11
					});
					group.add(symbol);
				}
			});
		}
	},
	/**
	* [CAUTION] This method can be called multiple times, following the change due to `resetCfg` called
	*  in size measurement. Thus this method should be idempotent, and should be performant.
	*/
	axisTickLabelEstimate: function(cfg, local, shared, axisModel, group, transformGroup, api, extraParams) {
		if (dealLastTickLabelResultReusable(local, group, extraParams)) layOutAxisTickLabel(cfg, local, shared, axisModel, group, transformGroup, api, AxisTickLabelComputingKind.estimate);
	},
	/**
	* Finish axis tick label build.
	* Can be only called once.
	*/
	axisTickLabelDetermine: function(cfg, local, shared, axisModel, group, transformGroup, api, extraParams) {
		if (dealLastTickLabelResultReusable(local, group, extraParams)) layOutAxisTickLabel(cfg, local, shared, axisModel, group, transformGroup, api, AxisTickLabelComputingKind.determine);
		var ticksEls = buildAxisMajorTicks(cfg, group, transformGroup, axisModel);
		syncLabelIgnoreToMajorTicks(cfg, local.labelLayoutList, ticksEls);
		buildAxisMinorTicks(cfg, group, transformGroup, axisModel, cfg.tickDirection);
	},
	/**
	* [CAUTION] This method can be called multiple times, following the change due to `resetCfg` called
	*  in size measurement. Thus this method should be idempotent, and should be performant.
	*/
	axisName: function(cfg, local, shared, axisModel, group, transformGroup, api, extraParams) {
		var sharedRecord = shared.ensureRecord(axisModel);
		if (local.nameEl) {
			group.remove(local.nameEl);
			local.nameEl = sharedRecord.nameLayout = sharedRecord.nameLocation = null;
		}
		var name = cfg.axisName;
		if (!hasAxisName(name)) return;
		var nameLocation = cfg.nameLocation;
		var nameDirection = cfg.nameDirection;
		var textStyleModel = axisModel.getModel("nameTextStyle");
		var gap = axisModel.get("nameGap") || 0;
		var extent = axisModel.axis.getExtent();
		var gapStartEndSignal = axisModel.axis.inverse ? -1 : 1;
		var pos = new Point(0, 0);
		var nameMoveDirVec = new Point(0, 0);
		if (nameLocation === "start") {
			pos.x = extent[0] - gapStartEndSignal * gap;
			nameMoveDirVec.x = -gapStartEndSignal;
		} else if (nameLocation === "end") {
			pos.x = extent[1] + gapStartEndSignal * gap;
			nameMoveDirVec.x = gapStartEndSignal;
		} else {
			pos.x = (extent[0] + extent[1]) / 2;
			pos.y = cfg.labelOffset + nameDirection * gap;
			nameMoveDirVec.y = nameDirection;
		}
		var mt = create();
		nameMoveDirVec.transform(rotate(mt, mt, cfg.rotation));
		var nameRotation = axisModel.get("nameRotate");
		if (nameRotation != null) nameRotation = nameRotation * PI / 180;
		var labelLayout;
		var axisNameAvailableWidth;
		if (isNameLocationCenter(nameLocation)) labelLayout = AxisBuilder.innerTextLayout(cfg.rotation, nameRotation != null ? nameRotation : cfg.rotation, nameDirection);
		else {
			labelLayout = endTextLayout(cfg.rotation, nameLocation, nameRotation || 0, extent);
			axisNameAvailableWidth = cfg.raw.axisNameAvailableWidth;
			if (axisNameAvailableWidth != null) {
				axisNameAvailableWidth = Math.abs(axisNameAvailableWidth / Math.sin(labelLayout.rotation));
				!isFinite(axisNameAvailableWidth) && (axisNameAvailableWidth = null);
			}
		}
		var textFont = textStyleModel.getFont();
		var truncateOpt = axisModel.get("nameTruncate", true) || {};
		var ellipsis = truncateOpt.ellipsis;
		var maxWidth = retrieve(cfg.raw.nameTruncateMaxWidth, truncateOpt.maxWidth, axisNameAvailableWidth);
		var nameMarginLevel = extraParams.nameMarginLevel || 0;
		var textEl = new ZRText({
			x: pos.x,
			y: pos.y,
			rotation: labelLayout.rotation,
			silent: AxisBuilder.isLabelSilent(axisModel),
			style: createTextStyle(textStyleModel, {
				text: name,
				font: textFont,
				overflow: "truncate",
				width: maxWidth,
				ellipsis,
				fill: textStyleModel.getTextColor() || axisModel.get([
					"axisLine",
					"lineStyle",
					"color"
				]),
				align: textStyleModel.get("align") || labelLayout.textAlign,
				verticalAlign: textStyleModel.get("verticalAlign") || labelLayout.textVerticalAlign
			}),
			z2: 1
		});
		setTooltipConfig({
			el: textEl,
			componentModel: axisModel,
			itemName: name
		});
		textEl.__fullText = name;
		textEl.anid = "name";
		if (axisModel.get("triggerEvent")) {
			var eventData = AxisBuilder.makeAxisEventDataBase(axisModel);
			eventData.targetType = "axisName";
			eventData.name = name;
			getECData(textEl).eventData = eventData;
		}
		transformGroup.add(textEl);
		textEl.updateTransform();
		local.nameEl = textEl;
		var nameLayout = sharedRecord.nameLayout = ensureLabelLayoutWithGeometry({
			label: textEl,
			priority: textEl.z2,
			defaultAttr: { ignore: textEl.ignore },
			marginDefault: isNameLocationCenter(nameLocation) ? DEFAULT_CENTER_NAME_MARGIN_LEVELS[nameMarginLevel] : DEFAULT_ENDS_NAME_MARGIN_LEVELS[nameMarginLevel]
		});
		sharedRecord.nameLocation = nameLocation;
		group.add(textEl);
		textEl.decomposeTransform();
		if (cfg.shouldNameMoveOverlap && nameLayout) {
			var record = shared.ensureRecord(axisModel);
			shared.resolveAxisNameOverlap(cfg, shared, axisModel, nameLayout, nameMoveDirVec, record);
		}
	}
};
function layOutAxisTickLabel(cfg, local, shared, axisModel, group, transformGroup, api, kind) {
	if (!axisLabelBuildResultExists(local)) buildAxisLabel(cfg, local, group, kind, axisModel, api);
	var labelLayoutList = local.labelLayoutList;
	updateAxisLabelChangableProps(cfg, axisModel, labelLayoutList, transformGroup);
	adjustBreakLabels(axisModel, cfg.rotation, labelLayoutList);
	var optionHideOverlap = cfg.optionHideOverlap;
	fixMinMaxLabelShow(axisModel, labelLayoutList, optionHideOverlap);
	if (optionHideOverlap) hideOverlap(filter(labelLayoutList, function(layout) {
		return layout && !layout.label.ignore;
	}));
	resetOverlapRecordToShared(cfg, shared, axisModel, labelLayoutList);
}
function endTextLayout(rotation, textPosition, textRotate, extent) {
	var rotationDiff = remRadian(textRotate - rotation);
	var textAlign;
	var textVerticalAlign;
	var inverse = extent[0] > extent[1];
	var onLeft = textPosition === "start" && !inverse || textPosition !== "start" && inverse;
	if (isRadianAroundZero(rotationDiff - PI / 2)) {
		textVerticalAlign = onLeft ? "bottom" : "top";
		textAlign = "center";
	} else if (isRadianAroundZero(rotationDiff - PI * 1.5)) {
		textVerticalAlign = onLeft ? "top" : "bottom";
		textAlign = "center";
	} else {
		textVerticalAlign = "middle";
		if (rotationDiff < PI * 1.5 && rotationDiff > PI / 2) textAlign = onLeft ? "left" : "right";
		else textAlign = onLeft ? "right" : "left";
	}
	return {
		rotation: rotationDiff,
		textAlign,
		textVerticalAlign
	};
}
/**
* Assume `labelLayoutList` has no `label.ignore: true`.
* Assume `labelLayoutList` have been sorted by value ascending order.
*/
function fixMinMaxLabelShow(axisModel, labelLayoutList, optionHideOverlap) {
	var axis = axisModel.axis;
	var customValuesOption = axisModel.get(["axisLabel", "customValues"]);
	if (shouldShowAllLabels(axis)) return;
	function deal(showMinMaxLabelOption, outmostLabelIdx, innerLabelIdx) {
		var outmostLabelLayout = ensureLabelLayoutWithGeometry(labelLayoutList[outmostLabelIdx]);
		var innerLabelLayout = ensureLabelLayoutWithGeometry(labelLayoutList[innerLabelIdx]);
		var scale = axis.scale;
		if (!outmostLabelLayout || !innerLabelLayout) return;
		if (showMinMaxLabelOption == null) {
			if (!optionHideOverlap && customValuesOption) return;
			var tick = getLabelInner(outmostLabelLayout.label).labelInfo.tick;
			if (isTimeScale(scale) && tick.notNice || isOrdinalScale(scale) && tick.offInterval) {
				ignoreEl(outmostLabelLayout.label);
				return;
			}
		}
		if (showMinMaxLabelOption === false || outmostLabelLayout.suggestIgnore) {
			ignoreEl(outmostLabelLayout.label);
			return;
		}
		if (innerLabelLayout.suggestIgnore) {
			ignoreEl(innerLabelLayout.label);
			return;
		}
		var touchThreshold = .1;
		if (!optionHideOverlap) {
			var marginForce = [
				0,
				0,
				0,
				0
			];
			outmostLabelLayout = newLabelLayoutWithGeometry({ marginForce }, outmostLabelLayout);
			innerLabelLayout = newLabelLayoutWithGeometry({ marginForce }, innerLabelLayout);
		}
		if (labelIntersect(outmostLabelLayout, innerLabelLayout, null, { touchThreshold })) {
			if (showMinMaxLabelOption) ignoreEl(innerLabelLayout.label);
			else ignoreEl(outmostLabelLayout.label);
		}
	}
	var showMinLabelOption = axisModel.get(["axisLabel", "showMinLabel"]);
	var showMaxLabelOption = axisModel.get(["axisLabel", "showMaxLabel"]);
	var labelsLen = labelLayoutList.length;
	deal(showMinLabelOption, 0, 1);
	deal(showMaxLabelOption, labelsLen - 1, labelsLen - 2);
}
function syncLabelIgnoreToMajorTicks(cfg, labelLayoutList, tickEls) {
	if (cfg.showMinorTicks) return;
	each(labelLayoutList, function(labelLayout) {
		if (labelLayout && labelLayout.label.ignore) for (var idx = 0; idx < tickEls.length; idx++) {
			var tickEl = tickEls[idx];
			var tickInner = getTickInner(tickEl);
			var labelInner = getLabelInner(labelLayout.label);
			if (tickInner.tickValue != null && !tickInner.onBand && tickInner.tickValue === labelInner.labelInfo.tick.value) {
				ignoreEl(tickEl);
				return;
			}
		}
	});
}
function ignoreEl(el) {
	el && (el.ignore = true);
}
function createTicks(ticksCoords, tickTransform, tickEndCoord, tickLineStyle, anidPrefix) {
	var tickEls = [];
	var pt1 = [];
	var pt2 = [];
	for (var i = 0; i < ticksCoords.length; i++) {
		var tickCoord = ticksCoords[i].coord;
		pt1[0] = tickCoord;
		pt1[1] = 0;
		pt2[0] = tickCoord;
		pt2[1] = tickEndCoord;
		if (tickTransform) {
			applyTransform(pt1, pt1, tickTransform);
			applyTransform(pt2, pt2, tickTransform);
		}
		var tickEl = new Line({
			shape: {
				x1: pt1[0],
				y1: pt1[1],
				x2: pt2[0],
				y2: pt2[1]
			},
			style: tickLineStyle,
			z2: 2,
			autoBatch: true,
			silent: true
		});
		subPixelOptimizeLine(tickEl.shape, tickEl.style.lineWidth);
		tickEl.anid = anidPrefix + "_" + ticksCoords[i].tickValue;
		tickEls.push(tickEl);
		var inner = getTickInner(tickEl);
		inner.onBand = !!ticksCoords[i].onBand;
		inner.tickValue = ticksCoords[i].tickValue;
	}
	return tickEls;
}
function buildAxisMajorTicks(cfg, group, transformGroup, axisModel) {
	var axis = axisModel.axis;
	var tickModel = axisModel.getModel("axisTick");
	var shown = tickModel.get("show");
	if (shown === "auto") {
		shown = true;
		if (cfg.raw.axisTickAutoShow != null) shown = !!cfg.raw.axisTickAutoShow;
	}
	if (!shown || axis.scale.isBlank()) return [];
	var lineStyleModel = tickModel.getModel("lineStyle");
	var tickEndCoord = cfg.tickDirection * tickModel.get("length");
	var ticksEls = createTicks(axis.getTicksCoords(), transformGroup.transform, tickEndCoord, defaults(lineStyleModel.getLineStyle(), { stroke: axisModel.get([
		"axisLine",
		"lineStyle",
		"color"
	]) }), "ticks");
	for (var i = 0; i < ticksEls.length; i++) group.add(ticksEls[i]);
	return ticksEls;
}
function buildAxisMinorTicks(cfg, group, transformGroup, axisModel, tickDirection) {
	var axis = axisModel.axis;
	var minorTickModel = axisModel.getModel("minorTick");
	if (!cfg.showMinorTicks || axis.scale.isBlank()) return;
	var minorTicksCoords = axis.getMinorTicksCoords();
	if (!minorTicksCoords.length) return;
	var lineStyleModel = minorTickModel.getModel("lineStyle");
	var tickEndCoord = tickDirection * minorTickModel.get("length");
	var minorTickLineStyle = defaults(lineStyleModel.getLineStyle(), defaults(axisModel.getModel("axisTick").getLineStyle(), { stroke: axisModel.get([
		"axisLine",
		"lineStyle",
		"color"
	]) }));
	for (var i = 0; i < minorTicksCoords.length; i++) {
		var minorTicksEls = createTicks(minorTicksCoords[i], transformGroup.transform, tickEndCoord, minorTickLineStyle, "minorticks_" + i);
		for (var k = 0; k < minorTicksEls.length; k++) group.add(minorTicksEls[k]);
	}
}
function dealLastTickLabelResultReusable(local, group, extraParams) {
	if (axisLabelBuildResultExists(local)) {
		var noPxChangeTryDetermine = local.axisLabelsCreationContext.out.noPxChangeTryDetermine;
		if (extraParams.noPxChange) {
			var canDetermine = true;
			for (var idx = 0; idx < noPxChangeTryDetermine.length; idx++) canDetermine = canDetermine && noPxChangeTryDetermine[idx]();
			if (canDetermine) return false;
		}
		if (noPxChangeTryDetermine.length) {
			group.remove(local.labelGroup);
			axisLabelBuildResultSet(local, null, null, null);
		}
	}
	return true;
}
function buildAxisLabel(cfg, local, group, kind, axisModel, api) {
	var axis = axisModel.axis;
	var show = retrieve(cfg.raw.axisLabelShow, axisModel.get(["axisLabel", "show"]));
	var labelGroup = new Group();
	group.add(labelGroup);
	var axisLabelCreationCtx = createAxisLabelsComputingContext(kind);
	if (!show || axis.scale.isBlank()) {
		axisLabelBuildResultSet(local, [], labelGroup, axisLabelCreationCtx);
		return;
	}
	var labelModel = axisModel.getModel("axisLabel");
	var labels = axis.getViewLabels(axisLabelCreationCtx);
	var labelRotation = (retrieve(cfg.raw.labelRotate, labelModel.get("rotate")) || 0) * PI / 180;
	var labelLayout = AxisBuilder.innerTextLayout(cfg.rotation, labelRotation, cfg.labelDirection);
	var rawCategoryData = axisModel.getCategories && axisModel.getCategories(true);
	var labelEls = [];
	var triggerEvent = axisModel.get("triggerEvent");
	var z2Min = Infinity;
	var z2Max = -Infinity;
	each(labels, function(labelItem, index) {
		var _a;
		var labelItemTick = labelItem.tick;
		var formattedLabel = labelItem.formattedLabel;
		var rawLabel = labelItem.rawLabel;
		var itemLabelModel = labelModel;
		var tickValue = getTickValueOutermost(axis.scale, labelItemTick);
		if (rawCategoryData && rawCategoryData[tickValue]) {
			var rawCategoryItem = rawCategoryData[tickValue];
			if (isObject(rawCategoryItem) && rawCategoryItem.textStyle) itemLabelModel = new Model(rawCategoryItem.textStyle, labelModel, axisModel.ecModel);
		}
		var textColor = itemLabelModel.getTextColor() || axisModel.get([
			"axisLine",
			"lineStyle",
			"color"
		]);
		var align = itemLabelModel.getShallow("align", true) || labelLayout.textAlign;
		var alignMin = retrieve2(itemLabelModel.getShallow("alignMinLabel", true), align);
		var alignMax = retrieve2(itemLabelModel.getShallow("alignMaxLabel", true), align);
		var verticalAlign = itemLabelModel.getShallow("verticalAlign", true) || itemLabelModel.getShallow("baseline", true) || labelLayout.textVerticalAlign;
		var verticalAlignMin = retrieve2(itemLabelModel.getShallow("verticalAlignMinLabel", true), verticalAlign);
		var verticalAlignMax = retrieve2(itemLabelModel.getShallow("verticalAlignMaxLabel", true), verticalAlign);
		var z2 = 10 + (((_a = labelItemTick.time) === null || _a === void 0 ? void 0 : _a.level) || 0);
		z2Min = Math.min(z2Min, z2);
		z2Max = Math.max(z2Max, z2);
		var textEl = new ZRText({
			x: 0,
			y: 0,
			rotation: 0,
			silent: AxisBuilder.isLabelSilent(axisModel),
			z2,
			style: createTextStyle(itemLabelModel, {
				text: formattedLabel,
				align: index === 0 ? alignMin : index === labels.length - 1 ? alignMax : align,
				verticalAlign: index === 0 ? verticalAlignMin : index === labels.length - 1 ? verticalAlignMax : verticalAlign,
				fill: isFunction(textColor) ? textColor(axis.type === "category" ? rawLabel : axis.type === "value" ? tickValue + "" : tickValue, index) : textColor
			})
		});
		textEl.anid = "label_" + tickValue;
		var inner = getLabelInner(textEl);
		inner.labelInfo = labelItem;
		inner.layoutRotation = labelLayout.rotation;
		setTooltipConfig({
			el: textEl,
			componentModel: axisModel,
			itemName: formattedLabel,
			formatterParamsExtra: {
				isTruncated: function() {
					return textEl.isTruncated;
				},
				value: rawLabel,
				tickIndex: index
			}
		});
		if (triggerEvent) {
			var eventData = AxisBuilder.makeAxisEventDataBase(axisModel);
			eventData.targetType = "axisLabel";
			eventData.value = rawLabel;
			eventData.tickIndex = index;
			var labelItemTickBreak = labelItem.tick["break"];
			if (labelItemTickBreak) {
				var labelItemTickBreakParsedBreak = labelItemTickBreak.parsedBreak;
				eventData["break"] = {
					start: labelItemTickBreakParsedBreak.vmin,
					end: labelItemTickBreakParsedBreak.vmax
				};
			}
			if (axis.type === "category") eventData.dataIndex = tickValue;
			getECData(textEl).eventData = eventData;
			if (labelItemTickBreak) addBreakEventHandler(axisModel, api, textEl, labelItemTickBreak);
		}
		labelEls.push(textEl);
		labelGroup.add(textEl);
	});
	axisLabelBuildResultSet(local, map(labelEls, function(label) {
		return {
			label,
			priority: getLabelInner(label).labelInfo.tick["break"] ? label.z2 + (z2Max - z2Min + 1) : label.z2,
			defaultAttr: { ignore: label.ignore }
		};
	}), labelGroup, axisLabelCreationCtx);
}
function axisLabelBuildResultExists(local) {
	return !!local.labelLayoutList;
}
function axisLabelBuildResultSet(local, labelLayoutList, labelGroup, axisLabelsCreationContext) {
	local.labelLayoutList = labelLayoutList;
	local.labelGroup = labelGroup;
	local.axisLabelsCreationContext = axisLabelsCreationContext;
}
function updateAxisLabelChangableProps(cfg, axisModel, labelLayoutList, transformGroup) {
	var labelMargin = axisModel.get(["axisLabel", "margin"]);
	each(labelLayoutList, function(layout, idx) {
		var geometry = ensureLabelLayoutWithGeometry(layout);
		if (!geometry) return;
		var labelEl = geometry.label;
		var inner = getLabelInner(labelEl);
		geometry.suggestIgnore = labelEl.ignore;
		labelEl.ignore = false;
		copyTransform(_tmpLayoutEl, _tmpLayoutElReset);
		var axis = axisModel.axis;
		_tmpLayoutEl.x = axis.dataToCoord(getTickValueOutermost(axis.scale, inner.labelInfo.tick));
		_tmpLayoutEl.y = cfg.labelOffset + cfg.labelDirection * labelMargin;
		_tmpLayoutEl.rotation = inner.layoutRotation;
		transformGroup.add(_tmpLayoutEl);
		_tmpLayoutEl.updateTransform();
		transformGroup.remove(_tmpLayoutEl);
		_tmpLayoutEl.decomposeTransform();
		copyTransform(labelEl, _tmpLayoutEl);
		labelEl.markRedraw();
		setLabelLayoutDirty(geometry, true);
		ensureLabelLayoutWithGeometry(geometry);
	});
}
var _tmpLayoutEl = new Rect();
var _tmpLayoutElReset = new Rect();
function hasAxisName(axisName) {
	return !!axisName;
}
function addBreakEventHandler(axisModel, api, textEl, visualBreak) {
	textEl.on("click", function(params) {
		var payload = {
			type: AXIS_BREAK_EXPAND_ACTION_TYPE,
			breaks: [{
				start: visualBreak.parsedBreak.breakOption.start,
				end: visualBreak.parsedBreak.breakOption.end
			}]
		};
		payload[axisModel.axis.dim + "AxisIndex"] = axisModel.componentIndex;
		api.dispatchAction(payload);
	});
}
function adjustBreakLabels(axisModel, axisRotation, labelLayoutList) {
	var scaleBreakHelper = getScaleBreakHelper();
	if (!scaleBreakHelper) return;
	var breakLabelIndexPairs = scaleBreakHelper.retrieveAxisBreakPairs(labelLayoutList, function(layoutInfo) {
		return layoutInfo && getLabelInner(layoutInfo.label).labelInfo.tick["break"];
	}, true);
	var moveOverlap = axisModel.get(["breakLabelLayout", "moveOverlap"], true);
	if (moveOverlap === true || moveOverlap === "auto") each(breakLabelIndexPairs, function(idxPair) {
		getAxisBreakHelper().adjustBreakLabelPair(axisModel.axis.inverse, axisRotation, [ensureLabelLayoutWithGeometry(labelLayoutList[idxPair[0]]), ensureLabelLayoutWithGeometry(labelLayoutList[idxPair[1]])]);
	});
}
//#endregion
//#region node_modules/echarts/lib/coord/cartesian/cartesianAxisHelper.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* [__CAUTION__]
*  MUST guarantee: if only the input `rect` and `axis.extent` changed,
*  only `layout.position` changes.
*  This character is replied on `grid.contain` calculation in `AxisBuilder`.
*  @see updateCartesianAxisViewCommonPartBuilder
*
* Can only be called after coordinate system creation stage.
* (Can be called before coordinate system update stage).
*/
function layout(rect, axisModel, opt) {
	opt = opt || {};
	var axis = axisModel.axis;
	var layout = {};
	var otherAxisOnZeroOf = axis.getAxesOnZeroOf()[0];
	var rawAxisPosition = axis.position;
	var axisPosition = otherAxisOnZeroOf ? "onZero" : rawAxisPosition;
	var axisDim = axis.dim;
	var rectBound = [
		rect.x,
		rect.x + rect.width,
		rect.y,
		rect.y + rect.height
	];
	var idx = {
		left: 0,
		right: 1,
		top: 0,
		bottom: 1,
		onZero: 2
	};
	var axisOffset = axisModel.get("offset") || 0;
	var posBound = axisDim === "x" ? [rectBound[2] - axisOffset, rectBound[3] + axisOffset] : [rectBound[0] - axisOffset, rectBound[1] + axisOffset];
	if (otherAxisOnZeroOf) {
		var onZeroCoord = otherAxisOnZeroOf.toGlobalCoord(otherAxisOnZeroOf.dataToCoord(0));
		posBound[idx.onZero] = Math.max(Math.min(onZeroCoord, posBound[1]), posBound[0]);
	}
	layout.position = [axisDim === "y" ? posBound[idx[axisPosition]] : rectBound[0], axisDim === "x" ? posBound[idx[axisPosition]] : rectBound[3]];
	layout.rotation = Math.PI / 2 * (axisDim === "x" ? 0 : 1);
	layout.labelDirection = layout.tickDirection = layout.nameDirection = {
		top: -1,
		bottom: 1,
		left: -1,
		right: 1
	}[rawAxisPosition];
	layout.labelOffset = otherAxisOnZeroOf ? posBound[idx[rawAxisPosition]] - posBound[idx.onZero] : 0;
	if (axisModel.get(["axisTick", "inside"])) layout.tickDirection = -layout.tickDirection;
	if (retrieve(opt.labelInside, axisModel.get(["axisLabel", "inside"]))) layout.labelDirection = -layout.labelDirection;
	var labelRotate = axisModel.get(["axisLabel", "rotate"]);
	layout.labelRotate = axisPosition === "top" ? -labelRotate : labelRotate;
	layout.z2 = 1;
	return layout;
}
/**
* Note: If pie (or other similar series) use cartesian2d, here
*  option `seriesModel.get('coordinateSystem') === 'cartesian2d'`
*  and `seriesModel.coordinateSystem !== cartesian2dCoordSysInstance`
*  and `seriesModel.boxCoordinateSystem === cartesian2dCoordSysInstance`,
*  the logic below is probably wrong, therefore skip it temporarily.
*/
function isCartesian2DInjectedAsDataCoordSys(seriesModel) {
	return seriesModel.coordinateSystem && seriesModel.coordinateSystem.type === "cartesian2d";
}
function findAxisModels(seriesModel) {
	var axisModelMap = {
		xAxisModel: null,
		yAxisModel: null
	};
	each(axisModelMap, function(v, key) {
		var axisType = key.replace(/Model$/, "");
		axisModelMap[key] = seriesModel.getReferringComponents(axisType, SINGLE_REFERRING).models[0];
	});
	return axisModelMap;
}
function createCartesianAxisViewCommonPartBuilder(gridRect, cartesians, axisModel, api, ctx, defaultNameMoveOverlap) {
	var layoutResult = layout(gridRect, axisModel);
	var axisLineAutoShow = false;
	var axisTickAutoShow = false;
	for (var i = 0; i < cartesians.length; i++) if (isIntervalOrLogScale(cartesians[i].getOtherAxis(axisModel.axis).scale)) {
		axisLineAutoShow = axisTickAutoShow = true;
		if (axisModel.axis.type === "category" && axisModel.axis.onBand) axisTickAutoShow = false;
	}
	layoutResult.axisLineAutoShow = axisLineAutoShow;
	layoutResult.axisTickAutoShow = axisTickAutoShow;
	layoutResult.defaultNameMoveOverlap = defaultNameMoveOverlap;
	return new AxisBuilder(axisModel, api, layoutResult, ctx);
}
function updateCartesianAxisViewCommonPartBuilder(axisBuilder, gridRect, axisModel) {
	var newRaw = layout(gridRect, axisModel);
	axisBuilder.updateCfg(newRaw);
}
//#endregion
//#region node_modules/echarts/lib/coord/cartesian/GridModel.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var OUTER_BOUNDS_DEFAULT = {
	left: 0,
	right: 0,
	top: 0,
	bottom: 0
};
var OUTER_BOUNDS_CLAMP_DEFAULT = ["25%", "25%"];
var COORD_SYS_TYPE_CARTESIAN_2D = "cartesian2d";
var GridModel = function(_super) {
	__extends(GridModel, _super);
	function GridModel() {
		return _super !== null && _super.apply(this, arguments) || this;
	}
	GridModel.prototype.mergeDefaultAndTheme = function(option, ecModel) {
		var outerBoundsCp = getLayoutParams(option.outerBounds);
		_super.prototype.mergeDefaultAndTheme.apply(this, arguments);
		if (outerBoundsCp && option.outerBounds) mergeLayoutParam(option.outerBounds, outerBoundsCp);
	};
	GridModel.prototype.mergeOption = function(newOption, ecModel) {
		_super.prototype.mergeOption.apply(this, arguments);
		if (this.option.outerBounds && newOption.outerBounds) mergeLayoutParam(this.option.outerBounds, newOption.outerBounds);
	};
	GridModel.type = "grid";
	GridModel.dependencies = ["xAxis", "yAxis"];
	GridModel.layoutMode = "box";
	GridModel.defaultOption = {
		show: false,
		z: 0,
		left: "15%",
		top: 65,
		right: "10%",
		bottom: 80,
		containLabel: false,
		outerBoundsMode: "auto",
		outerBounds: OUTER_BOUNDS_DEFAULT,
		outerBoundsContain: "all",
		outerBoundsClampWidth: OUTER_BOUNDS_CLAMP_DEFAULT[0],
		outerBoundsClampHeight: OUTER_BOUNDS_CLAMP_DEFAULT[1],
		backgroundColor: tokens.color.transparent,
		borderWidth: 1,
		borderColor: tokens.color.neutral30
	};
	return GridModel;
}(ComponentModel);
//#endregion
export { shiftLayoutOnXY as _, createCartesianAxisViewCommonPartBuilder as a, layout as c, AxisBuilderSharedContext as d, getLabelInner as f, computeLabelGeometry as g, getAxisBreakHelper as h, OUTER_BOUNDS_DEFAULT as i, updateCartesianAxisViewCommonPartBuilder as l, resolveAxisNameOverlapDefault as m, GridModel as n, findAxisModels as o, moveIfOverlapByLinearLabels as p, OUTER_BOUNDS_CLAMP_DEFAULT as r, isCartesian2DInjectedAsDataCoordSys as s, COORD_SYS_TYPE_CARTESIAN_2D as t, AxisBuilder as u };
