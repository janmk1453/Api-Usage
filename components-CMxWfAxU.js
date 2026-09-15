import { At as indexOf, Bt as isString, Ct as each$2, Dt as find, Et as filter, Ft as isFunction, G as applyTransform, Gt as map, Jt as noop, Kt as merge, Mt as isArray, Pt as isDom, Qt as retrieve2, Rt as isNumber, Tt as extend, Ut as keys, V as BoundingRect, _t as clone$1, at as invert, b as parse, bt as curry$1, ct as rotate, gt as bind$1, kt as hasOwn, lt as translate, nn as trim, pt as env, qt as mixin, rt as create, sn as __extends, wt as eqNaN, x as stringify, xt as defaults, yt as createHashMap, z as getBoundingRect, zt as isObject } from "./Image-B5UjBJH1.js";
import { $ as createSymbol, $i as parsePercent, $r as SINGLE_REFERRING, A as isAxisOnBand, B as getIntervalPrecision, Bi as isNullableNumberFinite, Ci as queryReferringComponents, Cn as applyTransform$1, D as getAxisRawValue, Dt as toCamelCase, E as determineAxisType, En as createIcon, Et as normalizeCssArray, Fn as groupTransition, Ft as encodeHTML, G as isLogScale, Gi as mathCeil, H as intervalScaleEnsureValidExtent, I as updateIntervalOrLogScaleForNiceOrAligned, J as getScaleExtentForMappingUnsafe, Ji as mathMin, K as isOrdinalScale, Ki as mathFloor, Kt as injectCoordSysByOption, L as AXIS_TYPES, M as isOnAxisZeroDiscouraged, N as retrieveAxisBreaksOption, Ni as getAcceptableTickPrecision, O as getScaleValuePositionKind, Ot as format, P as shouldAxisShow, Pn as graphic_exports, Qn as updateProps$1, Rt as transformLocalCoord, Si as queryDataIndex, Sn as XY$1, St as convertToColorString, T as createScaleByModel, Tr as enableHoverEmphasis, U as isIntervalOrLogScale, Un as setTooltipConfig, V as increaseInterval, Vt as inheritDefaultOption, Wi as mathAbs, Wn as subPixelOptimizeLine, X as OrdinalMeta, Xi as nice, Yi as mathRound, Yt as createDimNameMap, Zr as getECData, _t as getLayoutParams, at as createTooltipMarkup, b as AxisTickLabelComputingKind, bi as preParseFinder, ca as ZRText, ci as getTooltipRenderMode, d as calcBandWidth, ea as parsePositionSizeOption, f as associateSeriesWithAxis, fn as Model, ft as ComponentModel, gn as createTextStyle, hi as makeInner, ht as fetchLayoutMode, i as createOrUpdate, it as buildTooltipMarkup, j as isNameLocationCenter, jt as hasBreaks, k as getTickValueOutermost, ki as throwError, kn as expandOrShrinkRect, l as scaleRawExtentInfoCreate, la as Rect, mt as createBoxLayoutReference, na as quantity, oa as round, or as Line, ot as getPaddingFromTooltipModel, pi as isNameSpecified, pr as Group$2, pt as box, qi as mathMax, r as clear, ri as createSimpleOverallStageHandler2, rt as TooltipMarkupStyleCreator, s as adoptScaleRawExtentInfoAndPrepare, st as tokens, u as scaleRawExtentInfoEnableBoxCoordSysUsage, ut as normalizeTooltipFormatResult, vt as getLayoutRect, wt as formatTpl, xn as WH$1, yn as setLabelStyle, yt as mergeLayoutParam, zt as transformLocalCoordClear } from "./dataSelectAction-DEGlLCfR.js";
import { F as ComponentView, L as normalizeEvent, N as createOrUpdatePatternFromDecal, P as findEventDispatcher, R as stop, i as use, r as AxisModelCommonMixin, t as scaleCalcNice, z as Axis } from "./axisNiceTicks-If-z_uiY.js";
import { a as createCartesianAxisViewCommonPartBuilder, c as layout, d as AxisBuilderSharedContext, f as getLabelInner, h as getAxisBreakHelper, i as OUTER_BOUNDS_DEFAULT, l as updateCartesianAxisViewCommonPartBuilder, m as resolveAxisNameOverlapDefault, n as GridModel, o as findAxisModels, p as moveIfOverlapByLinearLabels, r as OUTER_BOUNDS_CLAMP_DEFAULT, t as COORD_SYS_TYPE_CARTESIAN_2D, u as AxisBuilder } from "./GridModel-BhFBa_uo.js";
//#region node_modules/echarts/lib/coord/cartesian/Axis2D.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var Axis2D = function(_super) {
	__extends(Axis2D, _super);
	function Axis2D(dim, scale, coordExtent, axisType, position) {
		var _this = _super.call(this, dim, scale, coordExtent) || this;
		/**
		* Index of axis, can be used as key
		* Injected outside.
		*/
		_this.index = 0;
		_this.type = axisType || "value";
		_this.position = position || "bottom";
		return _this;
	}
	Axis2D.prototype.isHorizontal = function() {
		var position = this.position;
		return position === "top" || position === "bottom";
	};
	/**
	* Each item cooresponds to this.getExtent(), which
	* means globalExtent[0] may greater than globalExtent[1],
	* unless `asc` is input.
	*
	* @param {boolean} [asc]
	* @return {Array.<number>}
	*/
	Axis2D.prototype.getGlobalExtent = function(asc) {
		var ret = this.getExtent();
		ret[0] = this.toGlobalCoord(ret[0]);
		ret[1] = this.toGlobalCoord(ret[1]);
		asc && ret[0] > ret[1] && ret.reverse();
		return ret;
	};
	Axis2D.prototype.pointToData = function(point, clamp) {
		return this.coordToData(this.toLocalCoord(point[this.dim === "x" ? 0 : 1]), clamp);
	};
	/**
	* Set ordinalSortInfo
	* @param info new OrdinalSortInfo
	*/
	Axis2D.prototype.setCategorySortInfo = function(info) {
		if (this.type !== "category") return false;
		this.model.option.categorySortInfo = info;
		this.scale.setSortInfo(info);
	};
	return Axis2D;
}(Axis);
//#endregion
//#region node_modules/echarts/lib/coord/cartesian/AxisModel.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var CartesianAxisModel = function(_super) {
	__extends(CartesianAxisModel, _super);
	function CartesianAxisModel() {
		return _super !== null && _super.apply(this, arguments) || this;
	}
	CartesianAxisModel.prototype.getCoordSysModel = function() {
		return this.getReferringComponents("grid", SINGLE_REFERRING).models[0];
	};
	CartesianAxisModel.type = "cartesian2dAxis";
	return CartesianAxisModel;
}(ComponentModel);
mixin(CartesianAxisModel, AxisModelCommonMixin);
//#endregion
//#region node_modules/echarts/lib/coord/axisDefault.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var defaultOption = {
	show: true,
	z: 0,
	inverse: false,
	name: "",
	nameLocation: "end",
	nameRotate: null,
	nameTruncate: {
		maxWidth: null,
		ellipsis: "...",
		placeholder: "."
	},
	nameTextStyle: {},
	nameGap: 15,
	silent: false,
	triggerEvent: false,
	tooltip: { show: false },
	axisPointer: {},
	axisLine: {
		show: true,
		onZero: "auto",
		onZeroAxisIndex: null,
		lineStyle: {
			color: tokens.color.axisLine,
			width: 1,
			type: "solid"
		},
		symbol: ["none", "none"],
		symbolSize: [10, 15],
		breakLine: true
	},
	axisTick: {
		show: true,
		inside: false,
		length: 5,
		lineStyle: { width: 1 }
	},
	axisLabel: {
		show: true,
		inside: false,
		rotate: 0,
		showMinLabel: null,
		showMaxLabel: null,
		margin: 8,
		fontSize: 12,
		color: tokens.color.axisLabel,
		textMargin: [0, 3]
	},
	splitLine: {
		show: true,
		showMinLine: true,
		showMaxLine: true,
		lineStyle: {
			color: tokens.color.axisSplitLine,
			width: 1,
			type: "solid"
		}
	},
	splitArea: {
		show: false,
		areaStyle: { color: [tokens.color.backgroundTint, tokens.color.backgroundTransparent] }
	},
	breakArea: {
		show: true,
		itemStyle: {
			color: tokens.color.neutral00,
			borderColor: tokens.color.border,
			borderWidth: 1,
			borderType: [3, 3],
			opacity: .6
		},
		zigzagAmplitude: 4,
		zigzagMinSpan: 4,
		zigzagMaxSpan: 20,
		zigzagZ: 100,
		expandOnClick: true
	},
	breakLabelLayout: { moveOverlap: "auto" }
};
var categoryAxis = merge({
	boundaryGap: true,
	deduplication: null,
	jitter: 0,
	jitterOverlap: true,
	jitterMargin: 2,
	splitLine: { show: false },
	axisTick: {
		alignWithLabel: false,
		interval: "auto",
		show: "auto"
	},
	axisLabel: { interval: "auto" }
}, defaultOption);
var valueAxis = merge({
	boundaryGap: [0, 0],
	axisLine: { show: "auto" },
	axisTick: { show: "auto" },
	splitNumber: 5,
	minorTick: {
		show: false,
		splitNumber: 5,
		length: 3,
		lineStyle: {}
	},
	minorSplitLine: {
		show: false,
		lineStyle: {
			color: tokens.color.axisMinorSplitLine,
			width: 1
		}
	}
}, defaultOption);
var axisDefault_default = {
	category: categoryAxis,
	value: valueAxis,
	time: merge({
		splitNumber: 6,
		axisLabel: { rich: { primary: { fontWeight: "bold" } } },
		splitLine: { show: false }
	}, valueAxis),
	log: defaults({ logBase: 10 }, valueAxis)
};
//#endregion
//#region node_modules/echarts/lib/coord/axisModelCreator.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* Generate sub axis model class
* @param axisName 'x' 'y' 'radius' 'angle' 'parallel' ...
*/
function axisModelCreator(registers, axisName, BaseAxisModelClass, extraDefaultOption) {
	each$2(AXIS_TYPES, function(v, axisType) {
		var defaultOption = merge(merge({}, axisDefault_default[axisType], true), extraDefaultOption, true);
		var AxisModel = function(_super) {
			__extends(AxisModel, _super);
			function AxisModel() {
				var _this = _super !== null && _super.apply(this, arguments) || this;
				_this.type = axisName + "Axis." + axisType;
				return _this;
			}
			AxisModel.prototype.mergeDefaultAndTheme = function(option, ecModel) {
				var layoutMode = fetchLayoutMode(this);
				var inputPositionParams = layoutMode ? getLayoutParams(option) : {};
				var themeModel = ecModel.getTheme();
				merge(option, themeModel.get(axisType + "Axis"));
				merge(option, this.getDefaultOption());
				option.type = getAxisType(option);
				if (layoutMode) mergeLayoutParam(option, inputPositionParams, layoutMode);
			};
			AxisModel.prototype.optionUpdated = function() {
				if (this.option.type === "category") this.__ordinalMeta = OrdinalMeta.createByAxisModel(this);
			};
			/**
			* Should not be called before all of 'getInitailData' finished.
			* Because categories are collected during initializing data.
			*/
			AxisModel.prototype.getCategories = function(rawData) {
				var option = this.option;
				if (option.type === "category") {
					if (rawData) return option.data;
					return this.__ordinalMeta.categories;
				}
			};
			AxisModel.prototype.getOrdinalMeta = function() {
				return this.__ordinalMeta;
			};
			AxisModel.prototype.updateAxisBreaks = function(payload) {
				var axisBreakHelper = getAxisBreakHelper();
				return axisBreakHelper ? axisBreakHelper.updateModelAxisBreak(this, payload) : { breaks: [] };
			};
			AxisModel.type = axisName + "Axis." + axisType;
			AxisModel.defaultOption = defaultOption;
			return AxisModel;
		}(BaseAxisModelClass);
		registers.registerComponentModel(AxisModel);
	});
	registers.registerSubTypeDefaulter(axisName + "Axis", getAxisType);
}
function getAxisType(option) {
	return option.type || (option.data ? "category" : "value");
}
//#endregion
//#region node_modules/echarts/lib/coord/cartesian/Cartesian.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var Cartesian = function() {
	function Cartesian(name) {
		this.type = "cartesian";
		this._dimList = [];
		this._axes = {};
		this.name = name || "";
	}
	Cartesian.prototype.getAxis = function(dim) {
		return this._axes[dim];
	};
	Cartesian.prototype.getAxes = function() {
		return map(this._dimList, function(dim) {
			return this._axes[dim];
		}, this);
	};
	Cartesian.prototype.getAxesByScale = function(scaleType) {
		scaleType = scaleType.toLowerCase();
		return filter(this.getAxes(), function(axis) {
			return axis.scale.type === scaleType;
		});
	};
	Cartesian.prototype.addAxis = function(axis) {
		var dim = axis.dim;
		this._axes[dim] = axis;
		this._dimList.push(dim);
	};
	return Cartesian;
}();
//#endregion
//#region node_modules/echarts/lib/coord/cartesian/Cartesian2D.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var cartesian2DDimensions = ["x", "y"];
function canCalculateAffineTransform(scale) {
	return (scale.type === "interval" || scale.type === "time") && !hasBreaks(scale);
}
var Cartesian2D = function(_super) {
	__extends(Cartesian2D, _super);
	function Cartesian2D() {
		var _this = _super !== null && _super.apply(this, arguments) || this;
		_this.type = COORD_SYS_TYPE_CARTESIAN_2D;
		_this.dimensions = cartesian2DDimensions;
		return _this;
	}
	/**
	* Calculate an affine transform matrix if two axes are time or value.
	* It's mainly for accelartion on the large time series data.
	*/
	Cartesian2D.prototype.calcAffineTransform = function() {
		this._transform = this._invTransform = null;
		var xAxisScale = this.getAxis("x").scale;
		var yAxisScale = this.getAxis("y").scale;
		if (!canCalculateAffineTransform(xAxisScale) || !canCalculateAffineTransform(yAxisScale)) return;
		var xScaleExtent = getScaleExtentForMappingUnsafe(xAxisScale, null);
		var yScaleExtent = getScaleExtentForMappingUnsafe(yAxisScale, null);
		var start = this.dataToPoint([xScaleExtent[0], yScaleExtent[0]]);
		var end = this.dataToPoint([xScaleExtent[1], yScaleExtent[1]]);
		var xScaleSpan = xScaleExtent[1] - xScaleExtent[0];
		var yScaleSpan = yScaleExtent[1] - yScaleExtent[0];
		if (!xScaleSpan || !yScaleSpan) return;
		var scaleX = (end[0] - start[0]) / xScaleSpan;
		var scaleY = (end[1] - start[1]) / yScaleSpan;
		var translateX = start[0] - xScaleExtent[0] * scaleX;
		var translateY = start[1] - yScaleExtent[0] * scaleY;
		var m = this._transform = [
			scaleX,
			0,
			0,
			scaleY,
			translateX,
			translateY
		];
		this._invTransform = invert([], m);
	};
	/**
	* Base axis will be used on stacking and series such as 'bar', 'pictorialBar', etc.
	*/
	Cartesian2D.prototype.getBaseAxis = function() {
		return this.getAxesByScale("ordinal")[0] || this.getAxesByScale("time")[0] || this.getAxis("x");
	};
	Cartesian2D.prototype.containPoint = function(point) {
		var axisX = this.getAxis("x");
		var axisY = this.getAxis("y");
		return axisX.contain(axisX.toLocalCoord(point[0])) && axisY.contain(axisY.toLocalCoord(point[1]));
	};
	Cartesian2D.prototype.containData = function(data) {
		return this.getAxis("x").containData(data[0]) && this.getAxis("y").containData(data[1]);
	};
	Cartesian2D.prototype.containZone = function(data1, data2) {
		var zoneDiag1 = this.dataToPoint(data1);
		var zoneDiag2 = this.dataToPoint(data2);
		var area = this.getArea();
		var zone = new BoundingRect(zoneDiag1[0], zoneDiag1[1], zoneDiag2[0] - zoneDiag1[0], zoneDiag2[1] - zoneDiag1[1]);
		return area.intersect(zone);
	};
	Cartesian2D.prototype.dataToPoint = function(data, clamp, out) {
		out = out || [];
		var xVal = data[0];
		var yVal = data[1];
		if (this._transform && xVal != null && isFinite(xVal) && yVal != null && isFinite(yVal)) return applyTransform(out, data, this._transform);
		var xAxis = this.getAxis("x");
		var yAxis = this.getAxis("y");
		out[0] = xAxis.toGlobalCoord(xAxis.dataToCoord(xVal, clamp));
		out[1] = yAxis.toGlobalCoord(yAxis.dataToCoord(yVal, clamp));
		return out;
	};
	Cartesian2D.prototype.clampData = function(data, out) {
		var xScale = this.getAxis("x").scale;
		var yScale = this.getAxis("y").scale;
		var xAxisExtent = xScale.getExtent();
		var yAxisExtent = yScale.getExtent();
		var x = xScale.parse(data[0]);
		var y = yScale.parse(data[1]);
		out = out || [];
		out[0] = Math.min(Math.max(Math.min(xAxisExtent[0], xAxisExtent[1]), x), Math.max(xAxisExtent[0], xAxisExtent[1]));
		out[1] = Math.min(Math.max(Math.min(yAxisExtent[0], yAxisExtent[1]), y), Math.max(yAxisExtent[0], yAxisExtent[1]));
		return out;
	};
	Cartesian2D.prototype.pointToData = function(point, clamp, out) {
		out = out || [];
		if (this._invTransform) return applyTransform(out, point, this._invTransform);
		var xAxis = this.getAxis("x");
		var yAxis = this.getAxis("y");
		out[0] = xAxis.coordToData(xAxis.toLocalCoord(point[0]), clamp);
		out[1] = yAxis.coordToData(yAxis.toLocalCoord(point[1]), clamp);
		return out;
	};
	Cartesian2D.prototype.getOtherAxis = function(axis) {
		return this.getAxis(axis.dim === "x" ? "y" : "x");
	};
	/**
	* Get rect area of cartesian.
	* Area will have a contain function to determine if a point is in the coordinate system.
	*/
	Cartesian2D.prototype.getArea = function(tolerance) {
		tolerance = tolerance || 0;
		var xExtent = this.getAxis("x").getGlobalExtent();
		var yExtent = this.getAxis("y").getGlobalExtent();
		var x = Math.min(xExtent[0], xExtent[1]) - tolerance;
		var y = Math.min(yExtent[0], yExtent[1]) - tolerance;
		var width = Math.max(xExtent[0], xExtent[1]) - x + tolerance;
		var height = Math.max(yExtent[0], yExtent[1]) - y + tolerance;
		return new BoundingRect(x, y, width, height);
	};
	return Cartesian2D;
}(Cartesian);
//#endregion
//#region node_modules/echarts/lib/coord/axisAlignTicks.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* NOTE: See the summary of the process of extent determination in the comment of `scaleMapper.setExtent`.
*
* @see SCALE_EXTENT_CONSTRUCTION for the full processing flow.
*/
function scaleCalcAlign(targetAxis, alignToScale) {
	var targetScale = targetAxis.scale;
	var targetAxisModel = targetAxis.model;
	var targetExtentInfo = adoptScaleRawExtentInfoAndPrepare(targetScale, targetAxisModel, targetAxisModel.ecModel, targetAxis, null);
	var isTargetLogScale = isLogScale(targetScale);
	var alignToScaleLinear = isLogScale(alignToScale) ? alignToScale.intervalStub : alignToScale;
	var targetIntervalStub = isTargetLogScale ? targetScale.intervalStub : targetScale;
	var targetLogScaleBase = targetScale.base;
	var alignToTicks = alignToScaleLinear.getTicks();
	var alignToExpNiceTicks = alignToScaleLinear.getTicks({ expandToNicedExtent: true });
	var alignToSegCount = alignToTicks.length - 1;
	var t0;
	var t1;
	var alignToNiceSegCount;
	if (alignToSegCount === 1) {
		t0 = t1 = 0;
		alignToNiceSegCount = 1;
	} else if (alignToSegCount === 2) {
		var interval0 = mathAbs(alignToTicks[0].value - alignToTicks[1].value);
		var interval1 = mathAbs(alignToTicks[1].value - alignToTicks[2].value);
		t0 = t1 = 0;
		if (interval0 === interval1) alignToNiceSegCount = 2;
		else {
			alignToNiceSegCount = 1;
			if (interval0 < interval1) t0 = interval0 / interval1;
			else t1 = interval1 / interval0;
		}
	} else {
		var alignToInterval = alignToScaleLinear.getConfig().interval;
		t0 = (1 - (alignToTicks[0].value - alignToExpNiceTicks[0].value) / alignToInterval) % 1;
		t1 = (1 - (alignToExpNiceTicks[alignToSegCount].value - alignToTicks[alignToSegCount].value) / alignToInterval) % 1;
		alignToNiceSegCount = alignToSegCount - (t0 ? 1 : 0) - (t1 ? 1 : 0);
	}
	var dataZoomFixMinMax = targetExtentInfo.zoomFixMM;
	var hasDataZoomFixMinMax = dataZoomFixMinMax[0] || dataZoomFixMinMax[1];
	var targetMinMaxFixed = [targetExtentInfo.fixMM[0] || hasDataZoomFixMinMax, targetExtentInfo.fixMM[1] || hasDataZoomFixMinMax];
	var targetOldOutermostExtent = targetScale.getExtent();
	var targetOldIntervalExtent = targetIntervalStub.getExtent();
	var targetExtent = intervalScaleEnsureValidExtent(targetOldIntervalExtent, targetMinMaxFixed);
	var min;
	var max;
	var interval;
	var intervalPrecision;
	var maxNice;
	var minNice;
	function loopIncreaseInterval(cb) {
		var LOOP_MAX = 50;
		var loopGuard = 0;
		for (; loopGuard < LOOP_MAX; loopGuard++) {
			if (cb()) break;
			interval = isTargetLogScale ? interval * mathMax(targetLogScaleBase, 2) : increaseInterval(interval);
			intervalPrecision = getIntervalPrecision(interval);
		}
	}
	function updateMinFromMinNice() {
		min = round(minNice - interval * t0, intervalPrecision);
	}
	function updateMaxFromMaxNice() {
		max = round(maxNice + interval * t1, intervalPrecision);
	}
	function updateMinNiceFromMinT0Interval() {
		minNice = t0 ? round(min + interval * t0, intervalPrecision) : min;
	}
	function updateMaxNiceFromMaxT1Interval() {
		maxNice = t1 ? round(max - interval * t1, intervalPrecision) : max;
	}
	if (targetMinMaxFixed[0] && targetMinMaxFixed[1]) {
		min = targetExtent[0];
		max = targetExtent[1];
		interval = (max - min) / (alignToNiceSegCount + t0 + t1);
		var axisPxExtent = targetAxis.getExtent();
		var pxSpan = mathAbs(axisPxExtent[1] - axisPxExtent[0]);
		intervalPrecision = getAcceptableTickPrecision([max, min], pxSpan, .5 / alignToNiceSegCount);
		updateMinNiceFromMinT0Interval();
		updateMaxNiceFromMaxT1Interval();
		if (isNullableNumberFinite(intervalPrecision)) interval = round(interval, intervalPrecision);
	} else {
		var targetSpan = targetExtent[1] - targetExtent[0];
		interval = isTargetLogScale ? mathMax(quantity(targetSpan), 1) : nice(targetSpan / alignToNiceSegCount, 2);
		intervalPrecision = getIntervalPrecision(interval);
		if (targetMinMaxFixed[0]) {
			min = targetExtent[0];
			loopIncreaseInterval(function() {
				updateMinNiceFromMinT0Interval();
				maxNice = round(minNice + interval * alignToNiceSegCount, intervalPrecision);
				updateMaxFromMaxNice();
				if (max >= targetExtent[1]) return true;
			});
		} else if (targetMinMaxFixed[1]) {
			max = targetExtent[1];
			loopIncreaseInterval(function() {
				updateMaxNiceFromMaxT1Interval();
				minNice = round(maxNice - interval * alignToNiceSegCount, intervalPrecision);
				updateMinFromMinNice();
				if (min <= targetExtent[0]) return true;
			});
		} else loopIncreaseInterval(function() {
			minNice = round(mathCeil(targetExtent[0] / interval) * interval, intervalPrecision);
			maxNice = round(mathFloor(targetExtent[1] / interval) * interval, intervalPrecision);
			var currIntervalCount = mathRound((maxNice - minNice) / interval);
			if (currIntervalCount <= alignToNiceSegCount) {
				var moreCount = alignToNiceSegCount - currIntervalCount;
				var moreCountPair = void 0;
				var mayEnhanceZero = targetExtentInfo.incl0 || isTargetLogScale;
				if (mayEnhanceZero && targetExtent[0] === 0) moreCountPair = [0, moreCount];
				else if (mayEnhanceZero && targetExtent[1] === 0) moreCountPair = [moreCount, 0];
				else {
					var lessHalfCount = mathFloor(moreCount / 2);
					moreCountPair = moreCount % 2 === 0 ? [lessHalfCount, lessHalfCount] : min + max < targetExtent[0] + targetExtent[1] ? [lessHalfCount, lessHalfCount + 1] : [lessHalfCount + 1, lessHalfCount];
				}
				minNice = round(minNice - interval * moreCountPair[0], intervalPrecision);
				maxNice = round(maxNice + interval * moreCountPair[1], intervalPrecision);
				updateMinFromMinNice();
				updateMaxFromMaxNice();
				if (min <= targetExtent[0] && max >= targetExtent[1]) return true;
			}
		});
	}
	updateIntervalOrLogScaleForNiceOrAligned(targetScale, targetMinMaxFixed, targetOldIntervalExtent, [min, max], targetOldOutermostExtent, {
		interval,
		intervalCount: alignToNiceSegCount,
		intervalPrecision,
		niceExtent: [minNice, maxNice]
	});
}
//#endregion
//#region node_modules/echarts/lib/coord/cartesian/Grid.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* Grid is a region which contains at most 4 cartesian systems
*
* TODO Default cartesian
*/
var XY_TO_MARGIN_IDX = [[3, 1], [0, 2]];
var Grid = function() {
	function Grid(gridModel, ecModel, api) {
		this.type = "grid";
		this._coordsMap = {};
		this._coordsList = [];
		this._axesMap = {};
		this._axesList = [];
		this.axisPointerEnabled = true;
		this.dimensions = cartesian2DDimensions;
		this._initCartesian(gridModel, ecModel, api);
		this.model = gridModel;
	}
	Grid.prototype.getRect = function() {
		return this._rect;
	};
	Grid.prototype.update = function(ecModel, api) {
		var axesMap = this._axesMap;
		each$2(this._axesList, function(axis) {
			scaleRawExtentInfoCreate(axis, 1);
			var scale = axis.scale;
			if (isOrdinalScale(scale)) scale.setSortInfo(axis.model.get("categorySortInfo"));
		});
		function updateAxisTicks(axes) {
			var axesIndices = keys(axes);
			var axisNeedsAlign = [];
			for (var i = axesIndices.length - 1; i >= 0; i--) {
				var axis = axes[+axesIndices[i]];
				if (axis.__alignTo) axisNeedsAlign.push(axis);
				else scaleCalcNice(axis);
			}
			each$2(axisNeedsAlign, function(axis) {
				if (incapableOfAlignNeedFallback(axis, axis.__alignTo)) scaleCalcNice(axis);
				else scaleCalcAlign(axis, axis.__alignTo.scale);
			});
		}
		updateAxisTicks(axesMap.x);
		updateAxisTicks(axesMap.y);
		var onZeroRecords = {};
		each$2(axesMap.x, function(xAxis) {
			fixAxisOnZero(axesMap, "y", xAxis, onZeroRecords);
		});
		each$2(axesMap.y, function(yAxis) {
			fixAxisOnZero(axesMap, "x", yAxis, onZeroRecords);
		});
		this.resize(this.model, api);
	};
	/**
	* Resize the grid.
	*
	* [NOTE]
	* If both "grid.containLabel/grid.contain" and pixel-required-data-processing (such as, "dataSampling")
	* exist, circular dependency occurs in logic.
	* The final compromised sequence is:
	*  1. Calculate "axis.extent" (pixel extent) and AffineTransform based on only "grid layout options".
	*      Not accurate if "grid.containLabel/grid.contain" is required, but it is a compromise to avoid
	*      circular dependency.
	*  2. Perform "series data processing" (where "dataSampling" requires "axis.extent").
	*  3. Calculate "scale.extent" (data extent) based on "processed series data".
	*  4. Modify "axis.extent" for "grid.containLabel/grid.contain":
	*      4.1. Calculate "axis labels" based on "scale.extent".
	*      4.2. Modify "axis.extent" by the bounding rects of "axis labels and names".
	*/
	Grid.prototype.resize = function(gridModel, api, beforeDataProcessing) {
		var layoutRef = createBoxLayoutReference(gridModel, api);
		var gridRect = this._rect = getLayoutRect(gridModel.getBoxLayoutParams(), layoutRef.refContainer);
		var axesMap = this._axesMap;
		var coordsList = this._coordsList;
		var optionContainLabel = gridModel.get("containLabel");
		updateAllAxisExtentTransByGridRect(axesMap, gridRect);
		if (!beforeDataProcessing) {
			var axisBuilderSharedCtx = createAxisBiulders(gridRect, coordsList, axesMap, optionContainLabel, api);
			var noPxChange = void 0;
			if (optionContainLabel) {
				if (legacyLayOutGridByContainLabel) {
					legacyLayOutGridByContainLabel(this._axesList, gridRect);
					updateAllAxisExtentTransByGridRect(axesMap, gridRect);
				} else noPxChange = layOutGridByOuterBounds(gridRect.clone(), "axisLabel", null, gridRect, axesMap, axisBuilderSharedCtx, layoutRef);
			} else {
				var _a = prepareOuterBounds(gridModel, gridRect, layoutRef), outerBoundsRect = _a.outerBoundsRect, parsedOuterBoundsContain = _a.parsedOuterBoundsContain, outerBoundsClamp = _a.outerBoundsClamp;
				if (outerBoundsRect) noPxChange = layOutGridByOuterBounds(outerBoundsRect, parsedOuterBoundsContain, outerBoundsClamp, gridRect, axesMap, axisBuilderSharedCtx, layoutRef);
			}
			createOrUpdateAxesView(gridRect, axesMap, AxisTickLabelComputingKind.determine, null, noPxChange, layoutRef);
			each$2(this._coordsList, function(coord) {
				coord.calcAffineTransform();
			});
		}
	};
	Grid.prototype.getAxis = function(dim, axisIndex) {
		var axesMapOnDim = this._axesMap[dim];
		if (axesMapOnDim != null) return axesMapOnDim[axisIndex || 0];
	};
	Grid.prototype.getAxes = function() {
		return this._axesList.slice();
	};
	Grid.prototype.getCartesian = function(xAxisIndex, yAxisIndex) {
		if (xAxisIndex != null && yAxisIndex != null) {
			var key = "x" + xAxisIndex + "y" + yAxisIndex;
			return this._coordsMap[key];
		}
		if (isObject(xAxisIndex)) {
			yAxisIndex = xAxisIndex.yAxisIndex;
			xAxisIndex = xAxisIndex.xAxisIndex;
		}
		for (var i = 0, coordList = this._coordsList; i < coordList.length; i++) if (coordList[i].getAxis("x").index === xAxisIndex || coordList[i].getAxis("y").index === yAxisIndex) return coordList[i];
	};
	Grid.prototype.getCartesians = function() {
		return this._coordsList.slice();
	};
	/**
	* @implements
	*/
	Grid.prototype.convertToPixel = function(ecModel, finder, value) {
		var target = this._findConvertTarget(finder);
		return target.cartesian ? target.cartesian.dataToPoint(value) : target.axis ? target.axis.toGlobalCoord(target.axis.dataToCoord(value)) : null;
	};
	/**
	* @implements
	*/
	Grid.prototype.convertFromPixel = function(ecModel, finder, value) {
		var target = this._findConvertTarget(finder);
		return target.cartesian ? target.cartesian.pointToData(value) : target.axis ? target.axis.coordToData(target.axis.toLocalCoord(value)) : null;
	};
	Grid.prototype._findConvertTarget = function(finder) {
		var seriesModel = finder.seriesModel;
		var xAxisModel = finder.xAxisModel || seriesModel && seriesModel.getReferringComponents("xAxis", SINGLE_REFERRING).models[0];
		var yAxisModel = finder.yAxisModel || seriesModel && seriesModel.getReferringComponents("yAxis", SINGLE_REFERRING).models[0];
		var gridModel = finder.gridModel;
		var coordsList = this._coordsList;
		var cartesian;
		var axis;
		if (seriesModel) {
			cartesian = seriesModel.coordinateSystem;
			indexOf(coordsList, cartesian) < 0 && (cartesian = null);
		} else if (xAxisModel && yAxisModel) cartesian = this.getCartesian(xAxisModel.componentIndex, yAxisModel.componentIndex);
		else if (xAxisModel) axis = this.getAxis("x", xAxisModel.componentIndex);
		else if (yAxisModel) axis = this.getAxis("y", yAxisModel.componentIndex);
		else if (gridModel) {
			if (gridModel.coordinateSystem === this) cartesian = this._coordsList[0];
		}
		return {
			cartesian,
			axis
		};
	};
	/**
	* @implements
	*/
	Grid.prototype.containPoint = function(point) {
		var coord = this._coordsList[0];
		if (coord) return coord.containPoint(point);
	};
	/**
	* Initialize cartesian coordinate systems
	*/
	Grid.prototype._initCartesian = function(gridModel, ecModel, api) {
		var _this = this;
		var grid = this;
		var axisPositionUsed = {
			left: false,
			right: false,
			top: false,
			bottom: false
		};
		var axesMap = {
			x: {},
			y: {}
		};
		var axesCount = {
			x: 0,
			y: 0
		};
		ecModel.eachComponent("xAxis", createAxisCreator("x"), this);
		ecModel.eachComponent("yAxis", createAxisCreator("y"), this);
		if (!axesCount.x || !axesCount.y) {
			this._axesMap = {};
			this._axesList = [];
			return;
		}
		this._axesMap = axesMap;
		each$2(axesMap.x, function(xAxis, xAxisIndex) {
			each$2(axesMap.y, function(yAxis, yAxisIndex) {
				var key = "x" + xAxisIndex + "y" + yAxisIndex;
				var cartesian = new Cartesian2D(key);
				cartesian.master = _this;
				cartesian.model = gridModel;
				_this._coordsMap[key] = cartesian;
				_this._coordsList.push(cartesian);
				cartesian.addAxis(xAxis);
				cartesian.addAxis(yAxis);
			});
		});
		prepareAlignToInCoordSysCreate(axesMap.x);
		prepareAlignToInCoordSysCreate(axesMap.y);
		function createAxisCreator(dimName) {
			return function(axisModel, idx) {
				if (!isAxisUsedInTheGrid(axisModel, gridModel)) return;
				var axisPosition = axisModel.get("position");
				if (dimName === "x") {
					if (axisPosition !== "top" && axisPosition !== "bottom") axisPosition = axisPositionUsed.bottom ? "top" : "bottom";
				} else if (axisPosition !== "left" && axisPosition !== "right") axisPosition = axisPositionUsed.left ? "right" : "left";
				axisPositionUsed[axisPosition] = true;
				var axisType = determineAxisType(axisModel);
				var axis = new Axis2D(dimName, createScaleByModel(axisModel, axisType, true), [0, 0], axisType, axisPosition);
				axis.onBand = isAxisOnBand(axis.scale, axisModel);
				axis.inverse = axisModel.get("inverse");
				axisModel.axis = axis;
				axis.model = axisModel;
				axis.grid = grid;
				axis.index = idx;
				grid._axesList.push(axis);
				axesMap[dimName][idx] = axis;
				axesCount[dimName]++;
			};
		}
	};
	/**
	* @param dim 'x' or 'y' or 'auto' or null/undefined
	*/
	Grid.prototype.getTooltipAxes = function(dim) {
		var baseAxes = [];
		var otherAxes = [];
		each$2(this.getCartesians(), function(cartesian) {
			var baseAxis = dim != null && dim !== "auto" ? cartesian.getAxis(dim) : cartesian.getBaseAxis();
			var otherAxis = cartesian.getOtherAxis(baseAxis);
			indexOf(baseAxes, baseAxis) < 0 && baseAxes.push(baseAxis);
			indexOf(otherAxes, otherAxis) < 0 && otherAxes.push(otherAxis);
		});
		return {
			baseAxes,
			otherAxes
		};
	};
	Grid.create = function(ecModel, api) {
		var grids = [];
		ecModel.eachComponent("grid", function(gridModel, idx) {
			var grid = new Grid(gridModel, ecModel, api);
			grid.name = "grid_" + idx;
			grid.resize(gridModel, api, true);
			gridModel.coordinateSystem = grid;
			grids.push(grid);
			each$2(grid._axesList, function(axis) {
				scaleRawExtentInfoEnableBoxCoordSysUsage(axis, Grid.dimIdxMap);
			});
		});
		ecModel.eachSeries(function(seriesModel) {
			var xAxis;
			var yAxis;
			injectCoordSysByOption({
				targetModel: seriesModel,
				coordSysType: COORD_SYS_TYPE_CARTESIAN_2D,
				coordSysProvider
			});
			function coordSysProvider() {
				var axesModelMap = findAxisModels(seriesModel);
				var xAxisModel = axesModelMap.xAxisModel;
				var yAxisModel = axesModelMap.yAxisModel;
				xAxis = xAxisModel.axis;
				yAxis = yAxisModel.axis;
				return xAxisModel.getCoordSysModel().coordinateSystem.getCartesian(xAxisModel.componentIndex, yAxisModel.componentIndex);
			}
			if (xAxis && yAxis) {
				associateSeriesWithAxis(xAxis, seriesModel, COORD_SYS_TYPE_CARTESIAN_2D);
				associateSeriesWithAxis(yAxis, seriesModel, COORD_SYS_TYPE_CARTESIAN_2D);
			}
		}, this);
		return grids;
	};
	Grid.dimensions = cartesian2DDimensions;
	Grid.dimIdxMap = createDimNameMap(cartesian2DDimensions);
	return Grid;
}();
/**
* Check if the axis is used in the specified grid.
*/
function isAxisUsedInTheGrid(axisModel, gridModel) {
	return axisModel.getCoordSysModel() === gridModel;
}
function fixAxisOnZero(axesMap, otherAxisDim, axis, onZeroRecords) {
	axis.getAxesOnZeroOf = function() {
		return otherAxisOnZeroOf ? [otherAxisOnZeroOf] : [];
	};
	var otherAxes = axesMap[otherAxisDim];
	var otherAxisOnZeroOf;
	var axisModel = axis.model;
	var onZero = axisModel.get(["axisLine", "onZero"]);
	var onZeroAxisIndex = axisModel.get(["axisLine", "onZeroAxisIndex"]);
	if (!onZero) return;
	if (onZeroAxisIndex != null) {
		if (canOnZeroToAxis(onZero, otherAxes[onZeroAxisIndex])) otherAxisOnZeroOf = otherAxes[onZeroAxisIndex];
	} else for (var idx in otherAxes) if (hasOwn(otherAxes, idx) && canOnZeroToAxis(onZero, otherAxes[idx]) && !onZeroRecords[getOnZeroRecordKey(otherAxes[idx])]) {
		otherAxisOnZeroOf = otherAxes[idx];
		break;
	}
	if (otherAxisOnZeroOf) onZeroRecords[getOnZeroRecordKey(otherAxisOnZeroOf)] = true;
	function getOnZeroRecordKey(axis) {
		return axis.dim + "_" + axis.index;
	}
}
/**
* CAVEAT: Must not be called before `CoordinateSystem#update` due to `__dontOnMyZero`.
*/
function canOnZeroToAxis(onZeroOption, axis) {
	if (!axis) return false;
	var scale = axis.scale;
	var kindEffective = getScaleValuePositionKind(scale, 0, false);
	var can = axis && axis.type !== "category" && axis.type !== "time" && kindEffective !== 3;
	if (can && onZeroOption === "auto" && isOnAxisZeroDiscouraged(axis)) can = false;
	return can;
}
/**
* [CAVEAT] This method is called before data processing stage.
*  Do not rely on any info that is determined afterward.
*/
function prepareAlignToInCoordSysCreate(axes) {
	var axesIndices = keys(axes);
	var alignTo;
	var axisNeedsAlign = [];
	for (var i = axesIndices.length - 1; i >= 0; i--) {
		var axis = axes[+axesIndices[i]];
		if (isIntervalOrLogScale(axis.scale) && retrieveAxisBreaksOption(axis.model, axis.type, true) == null) {
			if (axis.model.get("alignTicks") && axis.model.get("interval") == null) axisNeedsAlign.push(axis);
			else alignTo = axis;
		}
	}
	if (!alignTo) alignTo = axisNeedsAlign.pop();
	if (alignTo) each$2(axisNeedsAlign, function(axis) {
		axis.__alignTo = alignTo;
	});
}
/**
* This is just a defence code. They are unlikely to be actually `true`,
* since these cases have been addressed in `prepareAlignToInCoordSysCreate`.
*
* Can not be called BEFORE "nice" performed.
*/
function incapableOfAlignNeedFallback(targetAxis, alignTo) {
	return hasBreaks(targetAxis.scale) || hasBreaks(alignTo.scale) || alignTo.scale.getTicks().length < 2;
}
function updateAxisTransform(axis, coordBase) {
	var axisExtent = axis.getExtent();
	var axisExtentSum = axisExtent[0] + axisExtent[1];
	axis.toGlobalCoord = axis.dim === "x" ? function(coord) {
		return coord + coordBase;
	} : function(coord) {
		return axisExtentSum - coord + coordBase;
	};
	axis.toLocalCoord = axis.dim === "x" ? function(coord) {
		return coord - coordBase;
	} : function(coord) {
		return axisExtentSum - coord + coordBase;
	};
}
function updateAllAxisExtentTransByGridRect(axesMap, gridRect) {
	each$2(axesMap.x, function(axis) {
		return updateAxisExtentTransByGridRect(axis, gridRect.x, gridRect.width);
	});
	each$2(axesMap.y, function(axis) {
		return updateAxisExtentTransByGridRect(axis, gridRect.y, gridRect.height);
	});
}
function updateAxisExtentTransByGridRect(axis, gridXY, gridWH) {
	var extent = [0, gridWH];
	var idx = axis.inverse ? 1 : 0;
	axis.setExtent(extent[idx], extent[1 - idx]);
	updateAxisTransform(axis, gridXY);
}
var legacyLayOutGridByContainLabel;
function layOutGridByOuterBounds(outerBoundsRect, outerBoundsContain, outerBoundsClamp, gridRect, axesMap, axisBuilderSharedCtx, layoutRef) {
	createOrUpdateAxesView(gridRect, axesMap, AxisTickLabelComputingKind.estimate, outerBoundsContain, false, layoutRef);
	var margin = [
		0,
		0,
		0,
		0
	];
	fillLabelNameOverflowOnOneDimension(0);
	fillLabelNameOverflowOnOneDimension(1);
	fillMarginOnOneDimension(gridRect, 0, NaN);
	fillMarginOnOneDimension(gridRect, 1, NaN);
	var noPxChange = find(margin, function(item) {
		return item > 0;
	}) == null;
	expandOrShrinkRect(gridRect, margin, true, true, outerBoundsClamp);
	updateAllAxisExtentTransByGridRect(axesMap, gridRect);
	return noPxChange;
	function fillLabelNameOverflowOnOneDimension(xyIdx) {
		each$2(axesMap[XY$1[xyIdx]], function(axis) {
			if (!shouldAxisShow(axis.model)) return;
			var sharedRecord = axisBuilderSharedCtx.ensureRecord(axis.model);
			var labelInfoList = sharedRecord.labelInfoList;
			if (labelInfoList) for (var idx = 0; idx < labelInfoList.length; idx++) {
				var labelInfo = labelInfoList[idx];
				var proportion = axis.scale.normalize(getTickValueOutermost(axis.scale, getLabelInner(labelInfo.label).labelInfo.tick));
				proportion = xyIdx === 1 ? 1 - proportion : proportion;
				fillMarginOnOneDimension(labelInfo.rect, xyIdx, proportion);
				fillMarginOnOneDimension(labelInfo.rect, 1 - xyIdx, NaN);
			}
			var nameLayout = sharedRecord.nameLayout;
			if (nameLayout) {
				var proportion = isNameLocationCenter(sharedRecord.nameLocation) ? .5 : NaN;
				fillMarginOnOneDimension(nameLayout.rect, xyIdx, proportion);
				fillMarginOnOneDimension(nameLayout.rect, 1 - xyIdx, NaN);
			}
		});
	}
	function fillMarginOnOneDimension(itemRect, xyIdx, proportion) {
		var overflow1 = outerBoundsRect[XY$1[xyIdx]] - itemRect[XY$1[xyIdx]];
		var overflow2 = itemRect[WH$1[xyIdx]] + itemRect[XY$1[xyIdx]] - (outerBoundsRect[WH$1[xyIdx]] + outerBoundsRect[XY$1[xyIdx]]);
		overflow1 = applyProportion(overflow1, 1 - proportion);
		overflow2 = applyProportion(overflow2, proportion);
		var minIdx = XY_TO_MARGIN_IDX[xyIdx][0];
		var maxIdx = XY_TO_MARGIN_IDX[xyIdx][1];
		margin[minIdx] = mathMax(margin[minIdx], overflow1);
		margin[maxIdx] = mathMax(margin[maxIdx], overflow2);
	}
	function applyProportion(overflow, proportion) {
		if (overflow > 0 && !eqNaN(proportion) && proportion > 1e-4) overflow /= proportion;
		return overflow;
	}
}
function createAxisBiulders(gridRect, cartesians, axesMap, optionContainLabel, api) {
	var axisBuilderSharedCtx = new AxisBuilderSharedContext(resolveAxisNameOverlapForGrid);
	each$2(axesMap, function(axisList) {
		return each$2(axisList, function(axis) {
			if (shouldAxisShow(axis.model)) {
				var defaultNameMoveOverlap = !optionContainLabel;
				axis.axisBuilder = createCartesianAxisViewCommonPartBuilder(gridRect, cartesians, axis.model, api, axisBuilderSharedCtx, defaultNameMoveOverlap);
			}
		});
	});
	return axisBuilderSharedCtx;
}
/**
* Promote the axis-elements-building from "view render" stage to "coordinate system resize" stage.
* This is aimed to resovle overlap across multiple axes, since currently it's hard to reconcile
* multiple axes in "view render" stage.
*
* [CAUTION] But this promotion assumes that the subsequent "visual mapping" stage does not affect
* this axis-elements-building; otherwise we have to refactor it again.
*/
function createOrUpdateAxesView(gridRect, axesMap, kind, outerBoundsContain, noPxChange, layoutRef) {
	var isDetermine = kind === AxisTickLabelComputingKind.determine;
	each$2(axesMap, function(axisList) {
		return each$2(axisList, function(axis) {
			if (shouldAxisShow(axis.model)) {
				updateCartesianAxisViewCommonPartBuilder(axis.axisBuilder, gridRect, axis.model);
				axis.axisBuilder.build(isDetermine ? { axisTickLabelDetermine: true } : { axisTickLabelEstimate: true }, { noPxChange });
			}
		});
	});
	var nameMarginLevelMap = {
		x: 0,
		y: 0
	};
	calcNameMarginLevel(0);
	calcNameMarginLevel(1);
	function calcNameMarginLevel(xyIdx) {
		nameMarginLevelMap[XY$1[1 - xyIdx]] = gridRect[WH$1[xyIdx]] <= layoutRef.refContainer[WH$1[xyIdx]] * .5 ? 0 : 1 - xyIdx === 1 ? 2 : 1;
	}
	each$2(axesMap, function(axisList, xy) {
		return each$2(axisList, function(axis) {
			if (shouldAxisShow(axis.model)) {
				if (outerBoundsContain === "all" || isDetermine) axis.axisBuilder.build({ axisName: true }, { nameMarginLevel: nameMarginLevelMap[xy] });
				if (isDetermine) axis.axisBuilder.build({ axisLine: true });
			}
		});
	});
}
function prepareOuterBounds(gridModel, rawGridRect, layoutRef) {
	var outerBoundsRect;
	var optionOuterBoundsMode = gridModel.get("outerBoundsMode", true);
	if (optionOuterBoundsMode === "same") outerBoundsRect = rawGridRect.clone();
	else if (optionOuterBoundsMode == null || optionOuterBoundsMode === "auto") outerBoundsRect = getLayoutRect(gridModel.get("outerBounds", true) || OUTER_BOUNDS_DEFAULT, layoutRef.refContainer);
	else if (optionOuterBoundsMode !== "none") {}
	var optionOuterBoundsContain = gridModel.get("outerBoundsContain", true);
	var parsedOuterBoundsContain;
	if (optionOuterBoundsContain == null || optionOuterBoundsContain === "auto") parsedOuterBoundsContain = "all";
	else if (indexOf(["all", "axisLabel"], optionOuterBoundsContain) < 0) parsedOuterBoundsContain = "all";
	else parsedOuterBoundsContain = optionOuterBoundsContain;
	var outerBoundsClamp = [parsePositionSizeOption(retrieve2(gridModel.get("outerBoundsClampWidth", true), OUTER_BOUNDS_CLAMP_DEFAULT[0]), rawGridRect.width), parsePositionSizeOption(retrieve2(gridModel.get("outerBoundsClampHeight", true), OUTER_BOUNDS_CLAMP_DEFAULT[1]), rawGridRect.height)];
	return {
		outerBoundsRect,
		parsedOuterBoundsContain,
		outerBoundsClamp
	};
}
var resolveAxisNameOverlapForGrid = function(cfg, ctx, axisModel, nameLayoutInfo, nameMoveDirVec, thisRecord) {
	var perpendicularDim = axisModel.axis.dim === "x" ? "y" : "x";
	resolveAxisNameOverlapDefault(cfg, ctx, axisModel, nameLayoutInfo, nameMoveDirVec, thisRecord);
	if (!isNameLocationCenter(cfg.nameLocation)) each$2(ctx.recordMap[perpendicularDim], function(perpenRecord) {
		if (perpenRecord && perpenRecord.labelInfoList && perpenRecord.dirVec) moveIfOverlapByLinearLabels(perpenRecord.labelInfoList, perpenRecord.dirVec, nameLayoutInfo, nameMoveDirVec);
	});
};
//#endregion
//#region node_modules/echarts/lib/component/axisPointer/modelHelper.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function collect(ecModel, api) {
	var result = {
		/**
		* key: makeKey(axis.model)
		* value: {
		*      axis,
		*      coordSys,
		*      axisPointerModel,
		*      triggerTooltip,
		*      triggerEmphasis,
		*      involveSeries,
		*      snap,
		*      seriesModels,
		*      seriesDataCount
		* }
		*/
		axesInfo: {},
		seriesInvolved: false,
		/**
		* key: makeKey(coordSys.model)
		* value: Object: key makeKey(axis.model), value: axisInfo
		*/
		coordSysAxesInfo: {},
		coordSysMap: {}
	};
	collectAxesInfo(result, ecModel, api);
	result.seriesInvolved && collectSeriesInfo(result, ecModel);
	return result;
}
function collectAxesInfo(result, ecModel, api) {
	var globalTooltipModel = ecModel.getComponent("tooltip");
	var globalAxisPointerModel = ecModel.getComponent("axisPointer");
	var linksOption = globalAxisPointerModel.get("link", true) || [];
	var linkGroups = [];
	each$2(api.getCoordinateSystems(), function(coordSys) {
		if (!coordSys.axisPointerEnabled) return;
		var coordSysKey = makeKey(coordSys.model);
		var axesInfoInCoordSys = result.coordSysAxesInfo[coordSysKey] = {};
		result.coordSysMap[coordSysKey] = coordSys;
		var baseTooltipModel = coordSys.model.getModel("tooltip", globalTooltipModel);
		each$2(coordSys.getAxes(), curry$1(saveTooltipAxisInfo, false, null));
		if (coordSys.getTooltipAxes && globalTooltipModel && baseTooltipModel.get("show")) {
			var triggerAxis = baseTooltipModel.get("trigger") === "axis";
			var cross = baseTooltipModel.get(["axisPointer", "type"]) === "cross";
			var tooltipAxes = coordSys.getTooltipAxes(baseTooltipModel.get(["axisPointer", "axis"]));
			if (triggerAxis || cross) each$2(tooltipAxes.baseAxes, curry$1(saveTooltipAxisInfo, cross ? "cross" : true, triggerAxis));
			if (cross) each$2(tooltipAxes.otherAxes, curry$1(saveTooltipAxisInfo, "cross", false));
		}
		function saveTooltipAxisInfo(fromTooltip, triggerTooltip, axis) {
			var axisPointerModel = axis.model.getModel("axisPointer", globalAxisPointerModel);
			var axisPointerShow = axisPointerModel.get("show");
			if (!axisPointerShow || axisPointerShow === "auto" && !fromTooltip && !isHandleTrigger(axisPointerModel)) return;
			if (triggerTooltip == null) triggerTooltip = axisPointerModel.get("triggerTooltip");
			axisPointerModel = fromTooltip ? makeAxisPointerModel(axis, baseTooltipModel, globalAxisPointerModel, ecModel, fromTooltip, triggerTooltip) : axisPointerModel;
			var snap = axisPointerModel.get("snap");
			var triggerEmphasis = axisPointerModel.get("triggerEmphasis");
			var axisKey = makeKey(axis.model);
			var involveSeries = triggerTooltip || snap || axis.type === "category";
			var axisInfo = result.axesInfo[axisKey] = {
				key: axisKey,
				axis,
				coordSys,
				axisPointerModel,
				triggerTooltip,
				triggerEmphasis,
				involveSeries,
				snap,
				useHandle: isHandleTrigger(axisPointerModel),
				seriesModels: [],
				linkGroup: null
			};
			axesInfoInCoordSys[axisKey] = axisInfo;
			result.seriesInvolved = result.seriesInvolved || involveSeries;
			var groupIndex = getLinkGroupIndex(linksOption, axis);
			if (groupIndex != null) {
				var linkGroup = linkGroups[groupIndex] || (linkGroups[groupIndex] = { axesInfo: {} });
				linkGroup.axesInfo[axisKey] = axisInfo;
				linkGroup.mapper = linksOption[groupIndex].mapper;
				axisInfo.linkGroup = linkGroup;
			}
		}
	});
}
function makeAxisPointerModel(axis, baseTooltipModel, globalAxisPointerModel, ecModel, fromTooltip, triggerTooltip) {
	var tooltipAxisPointerModel = baseTooltipModel.getModel("axisPointer");
	var fields = [
		"type",
		"snap",
		"lineStyle",
		"shadowStyle",
		"label",
		"animation",
		"animationDurationUpdate",
		"animationEasingUpdate",
		"z"
	];
	var volatileOption = {};
	each$2(fields, function(field) {
		volatileOption[field] = clone$1(tooltipAxisPointerModel.get(field));
	});
	volatileOption.snap = axis.type !== "category" && !!triggerTooltip;
	if (tooltipAxisPointerModel.get("type") === "cross") volatileOption.type = "line";
	var labelOption = volatileOption.label || (volatileOption.label = {});
	labelOption.show ?? (labelOption.show = false);
	if (fromTooltip === "cross") {
		var tooltipAxisPointerLabelShow = tooltipAxisPointerModel.get(["label", "show"]);
		labelOption.show = tooltipAxisPointerLabelShow != null ? tooltipAxisPointerLabelShow : true;
		if (!triggerTooltip) {
			var crossStyle = volatileOption.lineStyle = tooltipAxisPointerModel.get("crossStyle");
			crossStyle && defaults(labelOption, crossStyle.textStyle);
		}
	}
	return axis.model.getModel("axisPointer", new Model(volatileOption, globalAxisPointerModel, ecModel));
}
function collectSeriesInfo(result, ecModel) {
	ecModel.eachSeries(function(seriesModel) {
		var coordSys = seriesModel.coordinateSystem;
		var seriesTooltipTrigger = seriesModel.get(["tooltip", "trigger"], true);
		var seriesTooltipShow = seriesModel.get(["tooltip", "show"], true);
		if (!coordSys || !coordSys.model || seriesTooltipTrigger === "none" || seriesTooltipTrigger === false || seriesTooltipTrigger === "item" || seriesTooltipShow === false || seriesModel.get(["axisPointer", "show"], true) === false) return;
		each$2(result.coordSysAxesInfo[makeKey(coordSys.model)], function(axisInfo) {
			var axis = axisInfo.axis;
			if (coordSys.getAxis(axis.dim) === axis) {
				axisInfo.seriesModels.push(seriesModel);
				axisInfo.seriesDataCount ?? (axisInfo.seriesDataCount = 0);
				axisInfo.seriesDataCount += seriesModel.getData().count();
			}
		});
	});
}
/**
* For example:
* {
*     axisPointer: {
*         links: [{
*             xAxisIndex: [2, 4],
*             yAxisIndex: 'all'
*         }, {
*             xAxisId: ['a5', 'a7'],
*             xAxisName: 'xxx'
*         }]
*     }
* }
*/
function getLinkGroupIndex(linksOption, axis) {
	var axisModel = axis.model;
	var dim = axis.dim;
	for (var i = 0; i < linksOption.length; i++) {
		var linkOption = linksOption[i] || {};
		if (checkPropInLink(linkOption[dim + "AxisId"], axisModel.id) || checkPropInLink(linkOption[dim + "AxisIndex"], axisModel.componentIndex) || checkPropInLink(linkOption[dim + "AxisName"], axisModel.name)) return i;
	}
}
function checkPropInLink(linkPropValue, axisPropValue) {
	return linkPropValue === "all" || isArray(linkPropValue) && indexOf(linkPropValue, axisPropValue) >= 0 || linkPropValue === axisPropValue;
}
function fixValue(axisModel) {
	var axisInfo = getAxisInfo(axisModel);
	if (!axisInfo) return;
	var axisPointerModel = axisInfo.axisPointerModel;
	var scale = axisInfo.axis.scale;
	var option = axisPointerModel.option;
	var status = axisPointerModel.get("status");
	var value = axisPointerModel.get("value");
	if (value != null) value = scale.parse(value);
	var useHandle = isHandleTrigger(axisPointerModel);
	if (status == null) option.status = useHandle ? "show" : "hide";
	var extent = scale.getExtent();
	if (value == null || value > extent[1]) value = extent[1];
	if (value < extent[0]) value = extent[0];
	option.value = value;
	if (useHandle) option.status = axisInfo.axis.scale.isBlank() ? "hide" : "show";
}
function getAxisInfo(axisModel) {
	var coordSysAxesInfo = (axisModel.ecModel.getComponent("axisPointer") || {}).coordSysAxesInfo;
	return coordSysAxesInfo && coordSysAxesInfo.axesInfo[makeKey(axisModel)];
}
function getAxisPointerModel(axisModel) {
	var axisInfo = getAxisInfo(axisModel);
	return axisInfo && axisInfo.axisPointerModel;
}
function isHandleTrigger(axisPointerModel) {
	return !!axisPointerModel.get(["handle", "show"]);
}
/**
* @param {module:echarts/model/Model} model
* @return {string} unique key
*/
function makeKey(model) {
	return model.type + "||" + model.id;
}
//#endregion
//#region node_modules/echarts/lib/component/axis/AxisView.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var axisPointerClazz = {};
/**
* Base class of AxisView.
*/
var AxisView = function(_super) {
	__extends(AxisView, _super);
	function AxisView() {
		var _this = _super !== null && _super.apply(this, arguments) || this;
		_this.type = AxisView.type;
		return _this;
	}
	/**
	* @override
	*/
	AxisView.prototype.render = function(axisModel, ecModel, api, payload) {
		this.axisPointerClass && fixValue(axisModel);
		_super.prototype.render.apply(this, arguments);
		this._doUpdateAxisPointerClass(axisModel, api, true);
	};
	/**
	* Action handler.
	*/
	AxisView.prototype.updateAxisPointer = function(axisModel, ecModel, api, payload) {
		this._doUpdateAxisPointerClass(axisModel, api, false);
	};
	/**
	* @override
	*/
	AxisView.prototype.remove = function(ecModel, api) {
		var axisPointer = this._axisPointer;
		axisPointer && axisPointer.remove(api);
	};
	/**
	* @override
	*/
	AxisView.prototype.dispose = function(ecModel, api) {
		this._disposeAxisPointer(api);
		_super.prototype.dispose.apply(this, arguments);
	};
	AxisView.prototype._doUpdateAxisPointerClass = function(axisModel, api, forceRender) {
		var Clazz = AxisView.getAxisPointerClass(this.axisPointerClass);
		if (!Clazz) return;
		var axisPointerModel = getAxisPointerModel(axisModel);
		axisPointerModel ? (this._axisPointer || (this._axisPointer = new Clazz())).render(axisModel, axisPointerModel, api, forceRender) : this._disposeAxisPointer(api);
	};
	AxisView.prototype._disposeAxisPointer = function(api) {
		this._axisPointer && this._axisPointer.dispose(api);
		this._axisPointer = null;
	};
	AxisView.registerAxisPointerClass = function(type, clazz) {
		axisPointerClazz[type] = clazz;
	};
	AxisView.getAxisPointerClass = function(type) {
		return type && axisPointerClazz[type];
	};
	AxisView.type = "axis";
	return AxisView;
}(ComponentView);
//#endregion
//#region node_modules/echarts/lib/component/axis/axisSplitHelper.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var inner$3 = makeInner();
function rectCoordAxisBuildSplitArea(axisView, axisGroup, axisModel, gridModel) {
	var axis = axisModel.axis;
	if (axis.scale.isBlank()) return;
	var splitAreaModel = axisModel.getModel("splitArea");
	var areaStyleModel = splitAreaModel.getModel("areaStyle");
	var areaColors = areaStyleModel.get("color");
	var gridRect = gridModel.coordinateSystem.getRect();
	var ticksCoords = axis.getTicksCoords({
		tickModel: splitAreaModel,
		breakTicks: "none",
		pruneByBreak: "preserve_extent_bound"
	});
	if (!ticksCoords.length) return;
	var areaColorsLen = areaColors.length;
	var lastSplitAreaColors = inner$3(axisView).splitAreaColors;
	var newSplitAreaColors = createHashMap();
	var colorIndex = 0;
	if (lastSplitAreaColors) for (var i = 0; i < ticksCoords.length; i++) {
		var cIndex = lastSplitAreaColors.get(ticksCoords[i].tickValue);
		if (cIndex != null) {
			colorIndex = (cIndex + (areaColorsLen - 1) * i) % areaColorsLen;
			break;
		}
	}
	var prev = axis.toGlobalCoord(ticksCoords[0].coord);
	var areaStyle = areaStyleModel.getAreaStyle();
	areaColors = isArray(areaColors) ? areaColors : [areaColors];
	for (var i = 1; i < ticksCoords.length; i++) {
		var tickCoord = axis.toGlobalCoord(ticksCoords[i].coord);
		var x = void 0;
		var y = void 0;
		var width = void 0;
		var height = void 0;
		if (axis.isHorizontal()) {
			x = prev;
			y = gridRect.y;
			width = tickCoord - x;
			height = gridRect.height;
			prev = x + width;
		} else {
			x = gridRect.x;
			y = prev;
			width = gridRect.width;
			height = tickCoord - y;
			prev = y + height;
		}
		var tickValue = ticksCoords[i - 1].tickValue;
		tickValue != null && newSplitAreaColors.set(tickValue, colorIndex);
		axisGroup.add(new Rect({
			anid: tickValue != null ? "area_" + tickValue : null,
			shape: {
				x,
				y,
				width,
				height
			},
			style: defaults({ fill: areaColors[colorIndex] }, areaStyle),
			autoBatch: true,
			silent: true
		}));
		colorIndex = (colorIndex + 1) % areaColorsLen;
	}
	inner$3(axisView).splitAreaColors = newSplitAreaColors;
}
function rectCoordAxisHandleRemove(axisView) {
	inner$3(axisView).splitAreaColors = null;
}
//#endregion
//#region node_modules/echarts/lib/component/axis/CartesianAxisView.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var selfBuilderAttrs = [
	"splitArea",
	"splitLine",
	"minorSplitLine",
	"breakArea"
];
var CartesianAxisView = function(_super) {
	__extends(CartesianAxisView, _super);
	function CartesianAxisView() {
		var _this = _super !== null && _super.apply(this, arguments) || this;
		_this.type = CartesianAxisView.type;
		_this.axisPointerClass = "CartesianAxisPointer";
		return _this;
	}
	/**
	* @override
	*/
	CartesianAxisView.prototype.render = function(axisModel, ecModel, api, payload) {
		this.group.removeAll();
		var oldAxisGroup = this._axisGroup;
		this._axisGroup = new Group$2();
		this.group.add(this._axisGroup);
		if (!shouldAxisShow(axisModel)) return;
		this._axisGroup.add(axisModel.axis.axisBuilder.group);
		each$2(selfBuilderAttrs, function(name) {
			if (axisModel.get([name, "show"])) axisElementBuilders[name](this, this._axisGroup, axisModel, axisModel.getCoordSysModel(), api);
		}, this);
		if (!(payload && payload.type === "changeAxisOrder" && payload.isInitSort)) groupTransition(oldAxisGroup, this._axisGroup, axisModel);
		_super.prototype.render.call(this, axisModel, ecModel, api, payload);
	};
	CartesianAxisView.prototype.remove = function() {
		rectCoordAxisHandleRemove(this);
	};
	CartesianAxisView.type = "cartesianAxis";
	return CartesianAxisView;
}(AxisView);
var axisElementBuilders = {
	splitLine: function(axisView, axisGroup, axisModel, gridModel, api) {
		var axis = axisModel.axis;
		if (axis.scale.isBlank()) return;
		var splitLineModel = axisModel.getModel("splitLine");
		var lineStyleModel = splitLineModel.getModel("lineStyle");
		var lineColors = lineStyleModel.get("color");
		var showMinLine = splitLineModel.get("showMinLine") !== false;
		var showMaxLine = splitLineModel.get("showMaxLine") !== false;
		lineColors = isArray(lineColors) ? lineColors : [lineColors];
		var gridRect = gridModel.coordinateSystem.getRect();
		var isHorizontal = axis.isHorizontal();
		var lineCount = 0;
		var ticksCoords = axis.getTicksCoords({
			tickModel: splitLineModel,
			breakTicks: "none",
			pruneByBreak: "preserve_extent_bound"
		});
		var p1 = [];
		var p2 = [];
		var lineStyle = lineStyleModel.getLineStyle();
		for (var i = 0; i < ticksCoords.length; i++) {
			var tickCoord = axis.toGlobalCoord(ticksCoords[i].coord);
			if (i === 0 && !showMinLine || i === ticksCoords.length - 1 && !showMaxLine) continue;
			var tickValue = ticksCoords[i].tickValue;
			if (isHorizontal) {
				p1[0] = tickCoord;
				p1[1] = gridRect.y;
				p2[0] = tickCoord;
				p2[1] = gridRect.y + gridRect.height;
			} else {
				p1[0] = gridRect.x;
				p1[1] = tickCoord;
				p2[0] = gridRect.x + gridRect.width;
				p2[1] = tickCoord;
			}
			var colorIndex = lineCount++ % lineColors.length;
			var line = new Line({
				anid: tickValue != null ? "line_" + tickValue : null,
				autoBatch: true,
				shape: {
					x1: p1[0],
					y1: p1[1],
					x2: p2[0],
					y2: p2[1]
				},
				style: defaults({ stroke: lineColors[colorIndex] }, lineStyle),
				silent: true
			});
			subPixelOptimizeLine(line.shape, lineStyle.lineWidth);
			axisGroup.add(line);
		}
	},
	minorSplitLine: function(axisView, axisGroup, axisModel, gridModel, api) {
		var axis = axisModel.axis;
		var lineStyleModel = axisModel.getModel("minorSplitLine").getModel("lineStyle");
		var gridRect = gridModel.coordinateSystem.getRect();
		var isHorizontal = axis.isHorizontal();
		var minorTicksCoords = axis.getMinorTicksCoords();
		if (!minorTicksCoords.length) return;
		var p1 = [];
		var p2 = [];
		var lineStyle = lineStyleModel.getLineStyle();
		for (var i = 0; i < minorTicksCoords.length; i++) for (var k = 0; k < minorTicksCoords[i].length; k++) {
			var tickCoord = axis.toGlobalCoord(minorTicksCoords[i][k].coord);
			if (isHorizontal) {
				p1[0] = tickCoord;
				p1[1] = gridRect.y;
				p2[0] = tickCoord;
				p2[1] = gridRect.y + gridRect.height;
			} else {
				p1[0] = gridRect.x;
				p1[1] = tickCoord;
				p2[0] = gridRect.x + gridRect.width;
				p2[1] = tickCoord;
			}
			var line = new Line({
				anid: "minor_line_" + minorTicksCoords[i][k].tickValue,
				autoBatch: true,
				shape: {
					x1: p1[0],
					y1: p1[1],
					x2: p2[0],
					y2: p2[1]
				},
				style: lineStyle,
				silent: true
			});
			subPixelOptimizeLine(line.shape, lineStyle.lineWidth);
			axisGroup.add(line);
		}
	},
	splitArea: function(axisView, axisGroup, axisModel, gridModel, api) {
		rectCoordAxisBuildSplitArea(axisView, axisGroup, axisModel, gridModel);
	},
	breakArea: function(axisView, axisGroup, axisModel, gridModel, api) {
		var axisBreakHelper = getAxisBreakHelper();
		var scale = axisModel.axis.scale;
		if (axisBreakHelper && scale.type !== "ordinal") axisBreakHelper.rectCoordBuildBreakAxis(axisGroup, axisView, axisModel, gridModel.coordinateSystem.getRect(), api);
	}
};
var CartesianXAxisView = function(_super) {
	__extends(CartesianXAxisView, _super);
	function CartesianXAxisView() {
		var _this = _super !== null && _super.apply(this, arguments) || this;
		_this.type = CartesianXAxisView.type;
		return _this;
	}
	CartesianXAxisView.type = "xAxis";
	return CartesianXAxisView;
}(CartesianAxisView);
var CartesianYAxisView = function(_super) {
	__extends(CartesianYAxisView, _super);
	function CartesianYAxisView() {
		var _this = _super !== null && _super.apply(this, arguments) || this;
		_this.type = CartesianXAxisView.type;
		return _this;
	}
	CartesianYAxisView.type = "yAxis";
	return CartesianYAxisView;
}(CartesianAxisView);
//#endregion
//#region node_modules/echarts/lib/component/grid/installSimple.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var GridView = function(_super) {
	__extends(GridView, _super);
	function GridView() {
		var _this = _super !== null && _super.apply(this, arguments) || this;
		_this.type = "grid";
		return _this;
	}
	GridView.prototype.render = function(gridModel, ecModel) {
		this.group.removeAll();
		if (gridModel.get("show")) this.group.add(new Rect({
			shape: gridModel.coordinateSystem.getRect(),
			style: defaults({ fill: gridModel.get("backgroundColor") }, gridModel.getItemStyle()),
			silent: true,
			z2: -1
		}));
	};
	GridView.type = "grid";
	return GridView;
}(ComponentView);
var extraOption = { offset: 0 };
function install$6(registers) {
	registers.registerComponentView(GridView);
	registers.registerComponentModel(GridModel);
	registers.registerCoordinateSystem("cartesian2d", Grid);
	axisModelCreator(registers, "x", CartesianAxisModel, extraOption);
	axisModelCreator(registers, "y", CartesianAxisModel, extraOption);
	registers.registerComponentView(CartesianXAxisView);
	registers.registerComponentView(CartesianYAxisView);
	registers.registerPreprocessor(function(option) {
		if (option.xAxis && option.yAxis && !option.grid) option.grid = {};
	});
}
//#endregion
//#region node_modules/echarts/lib/component/axisPointer/BaseAxisPointer.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var inner$2 = makeInner();
var clone = clone$1;
var bind = bind$1;
/**
* Base axis pointer class in 2D.
*/
var BaseAxisPointer = function() {
	function BaseAxisPointer() {
		this._dragging = false;
		/**
		* In px, arbitrary value. Do not set too small,
		* no animation is ok for most cases.
		*/
		this.animationThreshold = 15;
	}
	/**
	* @implement
	*/
	BaseAxisPointer.prototype.render = function(axisModel, axisPointerModel, api, forceRender) {
		var value = axisPointerModel.get("value");
		var status = axisPointerModel.get("status");
		this._axisModel = axisModel;
		this._axisPointerModel = axisPointerModel;
		this._api = api;
		if (!forceRender && this._lastValue === value && this._lastStatus === status) return;
		this._lastValue = value;
		this._lastStatus = status;
		var group = this._group;
		var handle = this._handle;
		if (!status || status === "hide") {
			group && group.hide();
			handle && handle.hide();
			return;
		}
		group && group.show();
		handle && handle.show();
		var elOption = {};
		this.makeElOption(elOption, value, axisModel, axisPointerModel, api);
		var graphicKey = elOption.graphicKey;
		if (graphicKey !== this._lastGraphicKey) this.clear(api);
		this._lastGraphicKey = graphicKey;
		var moveAnimation = this._moveAnimation = this.determineAnimation(axisModel, axisPointerModel);
		if (!group) {
			group = this._group = new Group$2();
			this.createPointerEl(group, elOption, axisModel, axisPointerModel);
			this.createLabelEl(group, elOption, axisModel, axisPointerModel);
			api.getZr().add(group);
		} else {
			var doUpdateProps = curry$1(updateProps, axisPointerModel, moveAnimation);
			this.updatePointerEl(group, elOption, doUpdateProps);
			this.updateLabelEl(group, elOption, doUpdateProps, axisPointerModel);
		}
		updateMandatoryProps(group, axisPointerModel, true);
		this._renderHandle(value);
	};
	/**
	* @implement
	*/
	BaseAxisPointer.prototype.remove = function(api) {
		this.clear(api);
	};
	/**
	* @implement
	*/
	BaseAxisPointer.prototype.dispose = function(api) {
		this.clear(api);
	};
	/**
	* @protected
	*/
	BaseAxisPointer.prototype.determineAnimation = function(axisModel, axisPointerModel) {
		var animation = axisPointerModel.get("animation");
		var axis = axisModel.axis;
		var isCategoryAxis = axis.type === "category";
		var useSnap = axisPointerModel.get("snap");
		if (!useSnap && !isCategoryAxis) return false;
		if (animation === "auto" || animation == null) {
			var animationThreshold = this.animationThreshold;
			if (isCategoryAxis && calcBandWidth(axis).w > animationThreshold) return true;
			if (useSnap) {
				var seriesDataCount = getAxisInfo(axisModel).seriesDataCount;
				var axisExtent = axis.getExtent();
				return Math.abs(axisExtent[0] - axisExtent[1]) / seriesDataCount > animationThreshold;
			}
			return false;
		}
		return animation === true;
	};
	/**
	* add {pointer, label, graphicKey} to elOption
	* @protected
	*/
	BaseAxisPointer.prototype.makeElOption = function(elOption, value, axisModel, axisPointerModel, api) {};
	/**
	* @protected
	*/
	BaseAxisPointer.prototype.createPointerEl = function(group, elOption, axisModel, axisPointerModel) {
		var pointerOption = elOption.pointer;
		if (pointerOption) {
			var pointerEl = inner$2(group).pointerEl = new graphic_exports[pointerOption.type](clone(elOption.pointer));
			group.add(pointerEl);
		}
	};
	/**
	* @protected
	*/
	BaseAxisPointer.prototype.createLabelEl = function(group, elOption, axisModel, axisPointerModel) {
		if (elOption.label) {
			var labelEl = inner$2(group).labelEl = new ZRText(clone(elOption.label));
			group.add(labelEl);
			updateLabelShowHide(labelEl, axisPointerModel);
		}
	};
	/**
	* @protected
	*/
	BaseAxisPointer.prototype.updatePointerEl = function(group, elOption, updateProps) {
		var pointerEl = inner$2(group).pointerEl;
		if (pointerEl && elOption.pointer) {
			pointerEl.setStyle(elOption.pointer.style);
			updateProps(pointerEl, { shape: elOption.pointer.shape });
		}
	};
	/**
	* @protected
	*/
	BaseAxisPointer.prototype.updateLabelEl = function(group, elOption, updateProps, axisPointerModel) {
		var labelEl = inner$2(group).labelEl;
		if (labelEl) {
			labelEl.setStyle(elOption.label.style);
			updateProps(labelEl, {
				x: elOption.label.x,
				y: elOption.label.y
			});
			updateLabelShowHide(labelEl, axisPointerModel);
		}
	};
	/**
	* @private
	*/
	BaseAxisPointer.prototype._renderHandle = function(value) {
		if (this._dragging || !this.updateHandleTransform) return;
		var axisPointerModel = this._axisPointerModel;
		var zr = this._api.getZr();
		var handle = this._handle;
		var handleModel = axisPointerModel.getModel("handle");
		var status = axisPointerModel.get("status");
		if (!handleModel.get("show") || !status || status === "hide") {
			handle && zr.remove(handle);
			this._handle = null;
			return;
		}
		var isInit;
		if (!this._handle) {
			isInit = true;
			handle = this._handle = createIcon(handleModel.get("icon"), {
				cursor: "move",
				draggable: true,
				onmousemove: function(e) {
					stop(e.event);
				},
				onmousedown: bind(this._onHandleDragMove, this, 0, 0),
				drift: bind(this._onHandleDragMove, this),
				ondragend: bind(this._onHandleDragEnd, this)
			});
			zr.add(handle);
		}
		updateMandatoryProps(handle, axisPointerModel, false);
		handle.setStyle(handleModel.getItemStyle(null, [
			"color",
			"borderColor",
			"borderWidth",
			"opacity",
			"shadowColor",
			"shadowBlur",
			"shadowOffsetX",
			"shadowOffsetY"
		]));
		var handleSize = handleModel.get("size");
		if (!isArray(handleSize)) handleSize = [handleSize, handleSize];
		handle.scaleX = handleSize[0] / 2;
		handle.scaleY = handleSize[1] / 2;
		createOrUpdate(this, "_doDispatchAxisPointer", handleModel.get("throttle") || 0, "fixRate");
		this._moveHandleToValue(value, isInit);
	};
	BaseAxisPointer.prototype._moveHandleToValue = function(value, isInit) {
		updateProps(this._axisPointerModel, !isInit && this._moveAnimation, this._handle, getHandleTransProps(this.getHandleTransform(value, this._axisModel, this._axisPointerModel)));
	};
	BaseAxisPointer.prototype._onHandleDragMove = function(dx, dy) {
		var handle = this._handle;
		if (!handle) return;
		this._dragging = true;
		var trans = this.updateHandleTransform(getHandleTransProps(handle), [dx, dy], this._axisModel, this._axisPointerModel);
		this._payloadInfo = trans;
		handle.stopAnimation();
		handle.attr(getHandleTransProps(trans));
		inner$2(handle).lastProp = null;
		this._doDispatchAxisPointer();
	};
	/**
	* Throttled method.
	*/
	BaseAxisPointer.prototype._doDispatchAxisPointer = function() {
		if (!this._handle) return;
		var payloadInfo = this._payloadInfo;
		var axisModel = this._axisModel;
		this._api.dispatchAction({
			type: "updateAxisPointer",
			x: payloadInfo.cursorPoint[0],
			y: payloadInfo.cursorPoint[1],
			tooltipOption: payloadInfo.tooltipOption,
			axesInfo: [{
				axisDim: axisModel.axis.dim,
				axisIndex: axisModel.componentIndex
			}]
		});
	};
	BaseAxisPointer.prototype._onHandleDragEnd = function() {
		this._dragging = false;
		if (!this._handle) return;
		var value = this._axisPointerModel.get("value");
		this._moveHandleToValue(value);
		this._api.dispatchAction({ type: "hideTip" });
	};
	/**
	* @private
	*/
	BaseAxisPointer.prototype.clear = function(api) {
		this._lastValue = null;
		this._lastStatus = null;
		var zr = api.getZr();
		var group = this._group;
		var handle = this._handle;
		if (zr && group) {
			this._lastGraphicKey = null;
			group && zr.remove(group);
			handle && zr.remove(handle);
			this._group = null;
			this._handle = null;
			this._payloadInfo = null;
		}
		clear(this, "_doDispatchAxisPointer");
	};
	/**
	* @protected
	*/
	BaseAxisPointer.prototype.doClear = function() {};
	BaseAxisPointer.prototype.buildLabel = function(xy, wh, xDimIndex) {
		xDimIndex = xDimIndex || 0;
		return {
			x: xy[xDimIndex],
			y: xy[1 - xDimIndex],
			width: wh[xDimIndex],
			height: wh[1 - xDimIndex]
		};
	};
	return BaseAxisPointer;
}();
function updateProps(animationModel, moveAnimation, el, props) {
	if (!propsEqual(inner$2(el).lastProp, props)) {
		inner$2(el).lastProp = props;
		moveAnimation ? updateProps$1(el, props, animationModel) : (el.stopAnimation(), el.attr(props));
	}
}
function propsEqual(lastProps, newProps) {
	if (isObject(lastProps) && isObject(newProps)) {
		var equals_1 = true;
		each$2(newProps, function(item, key) {
			equals_1 = equals_1 && propsEqual(lastProps[key], item);
		});
		return !!equals_1;
	} else return lastProps === newProps;
}
function updateLabelShowHide(labelEl, axisPointerModel) {
	labelEl[axisPointerModel.get(["label", "show"]) ? "show" : "hide"]();
}
function getHandleTransProps(trans) {
	return {
		x: trans.x || 0,
		y: trans.y || 0,
		rotation: trans.rotation || 0
	};
}
function updateMandatoryProps(group, axisPointerModel, silent) {
	var z = axisPointerModel.get("z");
	var zlevel = axisPointerModel.get("zlevel");
	group && group.traverse(function(el) {
		if (el.type !== "group") {
			z != null && (el.z = z);
			zlevel != null && (el.zlevel = zlevel);
			el.silent = silent;
		}
	});
}
//#endregion
//#region node_modules/echarts/lib/component/axisPointer/viewHelper.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function buildElStyle(axisPointerModel) {
	var axisPointerType = axisPointerModel.get("type");
	var styleModel = axisPointerModel.getModel(axisPointerType + "Style");
	var style;
	if (axisPointerType === "line") {
		style = styleModel.getLineStyle();
		style.fill = null;
	} else if (axisPointerType === "shadow") {
		style = styleModel.getAreaStyle();
		style.stroke = null;
	}
	return style;
}
/**
* @param {Function} labelPos {align, verticalAlign, position}
*/
function buildLabelElOption(elOption, axisModel, axisPointerModel, api, labelPos) {
	var text = getValueLabel(axisPointerModel.get("value"), axisModel.axis, axisModel.ecModel, axisPointerModel.get("seriesDataIndices"), {
		precision: axisPointerModel.get(["label", "precision"]),
		formatter: axisPointerModel.get(["label", "formatter"])
	});
	var labelModel = axisPointerModel.getModel("label");
	var paddings = normalizeCssArray(labelModel.get("padding") || 0);
	var font = labelModel.getFont();
	var textRect = getBoundingRect(text, font);
	var position = labelPos.position;
	var width = textRect.width + paddings[1] + paddings[3];
	var height = textRect.height + paddings[0] + paddings[2];
	var align = labelPos.align;
	align === "right" && (position[0] -= width);
	align === "center" && (position[0] -= width / 2);
	var verticalAlign = labelPos.verticalAlign;
	verticalAlign === "bottom" && (position[1] -= height);
	verticalAlign === "middle" && (position[1] -= height / 2);
	confineInContainer(position, width, height, api);
	var bgColor = labelModel.get("backgroundColor");
	if (!bgColor || bgColor === "auto") bgColor = axisModel.get([
		"axisLine",
		"lineStyle",
		"color"
	]);
	elOption.label = {
		x: position[0],
		y: position[1],
		style: createTextStyle(labelModel, {
			text,
			font,
			fill: labelModel.getTextColor(),
			padding: paddings,
			backgroundColor: bgColor
		}),
		z2: 10
	};
}
function confineInContainer(position, width, height, api) {
	var viewWidth = api.getWidth();
	var viewHeight = api.getHeight();
	position[0] = Math.min(position[0] + width, viewWidth) - width;
	position[1] = Math.min(position[1] + height, viewHeight) - height;
	position[0] = Math.max(position[0], 0);
	position[1] = Math.max(position[1], 0);
}
function getValueLabel(value, axis, ecModel, seriesDataIndices, opt) {
	value = axis.scale.parse(value);
	var text = axis.scale.getLabel({ value }, { precision: opt.precision });
	var formatter = opt.formatter;
	if (formatter) {
		var params_1 = {
			value: getAxisRawValue(axis, { value }),
			axisDimension: axis.dim,
			axisIndex: axis.index,
			seriesData: []
		};
		each$2(seriesDataIndices, function(idxItem) {
			var series = ecModel.getSeriesByIndex(idxItem.seriesIndex);
			var dataIndex = idxItem.dataIndexInside;
			var dataParams = series && series.getDataParams(dataIndex);
			dataParams && params_1.seriesData.push(dataParams);
		});
		if (isString(formatter)) text = formatter.replace("{value}", text);
		else if (isFunction(formatter)) text = formatter(params_1);
	}
	return text;
}
function getTransformedPosition(axis, value, layoutInfo) {
	var transform = create();
	rotate(transform, transform, layoutInfo.rotation);
	translate(transform, transform, layoutInfo.position);
	return applyTransform$1([axis.dataToCoord(value), (layoutInfo.labelOffset || 0) + (layoutInfo.labelDirection || 1) * (layoutInfo.labelMargin || 0)], transform);
}
function buildCartesianSingleLabelElOption(value, elOption, layoutInfo, axisModel, axisPointerModel, api) {
	var textLayout = AxisBuilder.innerTextLayout(layoutInfo.rotation, 0, layoutInfo.labelDirection);
	layoutInfo.labelMargin = axisPointerModel.get(["label", "margin"]);
	buildLabelElOption(elOption, axisModel, axisPointerModel, api, {
		position: getTransformedPosition(axisModel.axis, value, layoutInfo),
		align: textLayout.textAlign,
		verticalAlign: textLayout.textVerticalAlign
	});
}
function makeLineShape(p1, p2, xDimIndex) {
	xDimIndex = xDimIndex || 0;
	return {
		x1: p1[xDimIndex],
		y1: p1[1 - xDimIndex],
		x2: p2[xDimIndex],
		y2: p2[1 - xDimIndex]
	};
}
function makeRectShape(xy, wh, xDimIndex) {
	xDimIndex = xDimIndex || 0;
	return {
		x: xy[xDimIndex],
		y: xy[1 - xDimIndex],
		width: wh[xDimIndex],
		height: wh[1 - xDimIndex]
	};
}
function calcAxisPointerShadowBandWidth(axis, seriesDataIndices, ecModel) {
	return calcBandWidth(axis, {
		fromStat: { sers: map(seriesDataIndices, function(item) {
			return ecModel.getSeriesByIndex(item.seriesIndex);
		}) },
		min: 1
	}).w;
}
/**
* Return a [min, max] in pixel clampped by `axisExtent`.
*/
function calcAxisPointerShadowEnds(val, axisExtent, bandWidth) {
	return [mathMax(mathMin(axisExtent[0], axisExtent[1]), val - bandWidth / 2), mathMin(val + bandWidth / 2, mathMax(axisExtent[0], axisExtent[1]))];
}
//#endregion
//#region node_modules/echarts/lib/component/axisPointer/CartesianAxisPointer.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var CartesianAxisPointer = function(_super) {
	__extends(CartesianAxisPointer, _super);
	function CartesianAxisPointer() {
		return _super !== null && _super.apply(this, arguments) || this;
	}
	/**
	* @override
	*/
	CartesianAxisPointer.prototype.makeElOption = function(elOption, value, axisModel, axisPointerModel, api) {
		var axis = axisModel.axis;
		var grid = axis.grid;
		var axisPointerType = axisPointerModel.get("type");
		var thisExtent = axis.getGlobalExtent();
		var otherExtent = getCartesian(grid, axis).getOtherAxis(axis).getGlobalExtent();
		var pixelValue = axis.toGlobalCoord(axis.dataToCoord(value, true));
		if (axisPointerType && axisPointerType !== "none") {
			var elStyle = buildElStyle(axisPointerModel);
			var pointerOption = pointerShapeBuilder[axisPointerType](axis, pixelValue, thisExtent, otherExtent, axisPointerModel.get("seriesDataIndices"), axisPointerModel.ecModel);
			pointerOption.style = elStyle;
			elOption.graphicKey = pointerOption.type;
			elOption.pointer = pointerOption;
		}
		buildCartesianSingleLabelElOption(value, elOption, layout(grid.getRect(), axisModel), axisModel, axisPointerModel, api);
	};
	/**
	* @override
	*/
	CartesianAxisPointer.prototype.getHandleTransform = function(value, axisModel, axisPointerModel) {
		var layoutInfo = layout(axisModel.axis.grid.getRect(), axisModel, { labelInside: false });
		layoutInfo.labelMargin = axisPointerModel.get(["handle", "margin"]);
		var pos = getTransformedPosition(axisModel.axis, value, layoutInfo);
		return {
			x: pos[0],
			y: pos[1],
			rotation: layoutInfo.rotation + (layoutInfo.labelDirection < 0 ? Math.PI : 0)
		};
	};
	/**
	* @override
	*/
	CartesianAxisPointer.prototype.updateHandleTransform = function(transform, delta, axisModel, axisPointerModel) {
		var axis = axisModel.axis;
		var grid = axis.grid;
		var axisExtent = axis.getGlobalExtent(true);
		var otherExtent = getCartesian(grid, axis).getOtherAxis(axis).getGlobalExtent();
		var dimIndex = axis.dim === "x" ? 0 : 1;
		var currPosition = [transform.x, transform.y];
		currPosition[dimIndex] += delta[dimIndex];
		currPosition[dimIndex] = mathMin(axisExtent[1], currPosition[dimIndex]);
		currPosition[dimIndex] = mathMax(axisExtent[0], currPosition[dimIndex]);
		var cursorOtherValue = (otherExtent[1] + otherExtent[0]) / 2;
		var cursorPoint = [cursorOtherValue, cursorOtherValue];
		cursorPoint[dimIndex] = currPosition[dimIndex];
		return {
			x: currPosition[0],
			y: currPosition[1],
			rotation: transform.rotation,
			cursorPoint,
			tooltipOption: [{ verticalAlign: "middle" }, { align: "center" }][dimIndex]
		};
	};
	return CartesianAxisPointer;
}(BaseAxisPointer);
function getCartesian(grid, axis) {
	var opt = {};
	opt[axis.dim + "AxisIndex"] = axis.index;
	return grid.getCartesian(opt);
}
var pointerShapeBuilder = {
	line: function(axis, pixelValue, thisExtent, otherExtent) {
		return {
			type: "Line",
			subPixelOptimize: true,
			shape: makeLineShape([pixelValue, otherExtent[0]], [pixelValue, otherExtent[1]], getAxisDimIndex(axis))
		};
	},
	shadow: function(axis, pixelValue, thisExtent, otherExtent, seriesDataIndices, ecModel) {
		var bandWidth = calcAxisPointerShadowBandWidth(axis, seriesDataIndices, ecModel);
		var otherSpan = otherExtent[1] - otherExtent[0];
		var _a = calcAxisPointerShadowEnds(pixelValue, thisExtent, bandWidth), min = _a[0], max = _a[1];
		return {
			type: "Rect",
			shape: makeRectShape([min, otherExtent[0]], [max - min, otherSpan], getAxisDimIndex(axis))
		};
	}
};
function getAxisDimIndex(axis) {
	return axis.dim === "x" ? 0 : 1;
}
//#endregion
//#region node_modules/echarts/lib/component/axisPointer/AxisPointerModel.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var AxisPointerModel = function(_super) {
	__extends(AxisPointerModel, _super);
	function AxisPointerModel() {
		var _this = _super !== null && _super.apply(this, arguments) || this;
		_this.type = AxisPointerModel.type;
		return _this;
	}
	AxisPointerModel.type = "axisPointer";
	AxisPointerModel.defaultOption = {
		show: "auto",
		z: 50,
		type: "line",
		snap: false,
		triggerTooltip: true,
		triggerEmphasis: true,
		value: null,
		status: null,
		link: [],
		animation: null,
		animationDurationUpdate: 200,
		lineStyle: {
			color: tokens.color.border,
			width: 1,
			type: "dashed"
		},
		shadowStyle: { color: tokens.color.shadowTint },
		label: {
			show: true,
			formatter: null,
			precision: "auto",
			margin: 3,
			color: tokens.color.neutral00,
			padding: [
				5,
				7,
				5,
				7
			],
			backgroundColor: tokens.color.accent60,
			borderColor: null,
			borderWidth: 0,
			borderRadius: 3
		},
		handle: {
			show: false,
			icon: "M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4h1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7v-1.2h6.6z M13.3,22H6.7v-1.2h6.6z M13.3,19.6H6.7v-1.2h6.6z",
			size: 45,
			margin: 50,
			color: tokens.color.accent40,
			throttle: 40
		}
	};
	return AxisPointerModel;
}(ComponentModel);
//#endregion
//#region node_modules/echarts/lib/component/axisPointer/globalListener.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var inner$1 = makeInner();
var each$1 = each$2;
function register(key, api, handler) {
	if (env.node) return;
	var zr = api.getZr();
	inner$1(zr).records || (inner$1(zr).records = {});
	initGlobalListeners(zr, api);
	var record = inner$1(zr).records[key] || (inner$1(zr).records[key] = {});
	record.handler = handler;
}
function initGlobalListeners(zr, api) {
	if (inner$1(zr).initialized) return;
	inner$1(zr).initialized = true;
	useHandler("click", curry$1(doEnter, "click"));
	useHandler("mousemove", curry$1(doEnter, "mousemove"));
	useHandler("mousewheel", curry$1(doEnter, "mousewheel"));
	useHandler("globalout", onLeave);
	function useHandler(eventType, cb) {
		zr.on(eventType, function(e) {
			var dis = makeDispatchAction$1(api);
			each$1(inner$1(zr).records, function(record) {
				record && cb(record, e, dis.dispatchAction);
			});
			dispatchTooltipFinally(dis.pendings, api);
		});
	}
}
function dispatchTooltipFinally(pendings, api) {
	var showLen = pendings.showTip.length;
	var hideLen = pendings.hideTip.length;
	var actuallyPayload;
	if (showLen) actuallyPayload = pendings.showTip[showLen - 1];
	else if (hideLen) actuallyPayload = pendings.hideTip[hideLen - 1];
	if (actuallyPayload) {
		actuallyPayload.dispatchAction = null;
		api.dispatchAction(actuallyPayload);
	}
}
function onLeave(record, e, dispatchAction) {
	record.handler("leave", null, dispatchAction);
}
function doEnter(currTrigger, record, e, dispatchAction) {
	record.handler(currTrigger, e, dispatchAction);
}
function makeDispatchAction$1(api) {
	var pendings = {
		showTip: [],
		hideTip: []
	};
	var dispatchAction = function(payload) {
		var pendingList = pendings[payload.type];
		if (pendingList) pendingList.push(payload);
		else {
			payload.dispatchAction = dispatchAction;
			api.dispatchAction(payload);
		}
	};
	return {
		dispatchAction,
		pendings
	};
}
function unregister(key, api) {
	if (env.node) return;
	var zr = api.getZr();
	if ((inner$1(zr).records || {})[key]) inner$1(zr).records[key] = null;
}
//#endregion
//#region node_modules/echarts/lib/component/axisPointer/AxisPointerView.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var AxisPointerView = function(_super) {
	__extends(AxisPointerView, _super);
	function AxisPointerView() {
		var _this = _super !== null && _super.apply(this, arguments) || this;
		_this.type = AxisPointerView.type;
		return _this;
	}
	AxisPointerView.prototype.render = function(globalAxisPointerModel, ecModel, api) {
		var globalTooltipModel = ecModel.getComponent("tooltip");
		var triggerOn = globalAxisPointerModel.get("triggerOn") || globalTooltipModel && globalTooltipModel.get("triggerOn") || "mousemove|click|mousewheel";
		register("axisPointer", api, function(currTrigger, e, dispatchAction) {
			if (triggerOn !== "none" && (currTrigger === "leave" || triggerOn.indexOf(currTrigger) >= 0)) dispatchAction({
				type: "updateAxisPointer",
				currTrigger,
				x: e && e.offsetX,
				y: e && e.offsetY
			});
		});
	};
	AxisPointerView.prototype.remove = function(ecModel, api) {
		unregister("axisPointer", api);
	};
	AxisPointerView.prototype.dispose = function(ecModel, api) {
		unregister("axisPointer", api);
	};
	AxisPointerView.type = "axisPointer";
	return AxisPointerView;
}(ComponentView);
//#endregion
//#region node_modules/echarts/lib/component/axisPointer/findPointFromSeries.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* @param finder contains {seriesIndex, dataIndex, dataIndexInside}
* @param ecModel
* @return  {point: [x, y], el: ...} point Will not be null.
*/
function findPointFromSeries(finder, ecModel) {
	var point = [];
	var seriesIndex = finder.seriesIndex;
	var seriesModel;
	if (seriesIndex == null || !(seriesModel = ecModel.getSeriesByIndex(seriesIndex))) return { point: [] };
	var data = seriesModel.getData();
	var dataIndex = queryDataIndex(data, finder);
	if (dataIndex == null || dataIndex < 0 || isArray(dataIndex)) return { point: [] };
	var el = data.getItemGraphicEl(dataIndex);
	var coordSys = seriesModel.coordinateSystem;
	if (seriesModel.getTooltipPosition) point = seriesModel.getTooltipPosition(dataIndex) || [];
	else if (coordSys && coordSys.dataToPoint) {
		if (finder.isStacked) {
			var baseAxis = coordSys.getBaseAxis();
			var valueAxisDim = coordSys.getOtherAxis(baseAxis).dim;
			var baseAxisDim = baseAxis.dim;
			var baseDataOffset = valueAxisDim === "x" || valueAxisDim === "radius" ? 1 : 0;
			var baseDim = data.mapDimension(baseAxisDim);
			var stackedData = [];
			stackedData[baseDataOffset] = data.get(baseDim, dataIndex);
			stackedData[1 - baseDataOffset] = data.get(data.getCalculationInfo("stackResultDimension"), dataIndex);
			point = coordSys.dataToPoint(stackedData) || [];
		} else point = coordSys.dataToPoint(data.getValues(map(coordSys.dimensions, function(dim) {
			return data.mapDimension(dim);
		}), dataIndex)) || [];
	} else if (el) {
		var rect = el.getBoundingRect().clone();
		rect.applyTransform(el.transform);
		point = [rect.x + rect.width / 2, rect.y + rect.height / 2];
	}
	return {
		point,
		el
	};
}
//#endregion
//#region node_modules/echarts/lib/component/axisPointer/axisTrigger.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var inner = makeInner();
/**
* Basic logic: check all axis, if they do not demand show/highlight,
* then hide/downplay them.
*
* @return content of event obj for echarts.connect.
*/
function axisTrigger(payload, ecModel, api) {
	var currTrigger = payload.currTrigger;
	var point = [payload.x, payload.y];
	var finder = payload;
	var dispatchAction = payload.dispatchAction || bind$1(api.dispatchAction, api);
	var coordSysAxesInfo = ecModel.getComponent("axisPointer").coordSysAxesInfo;
	if (!coordSysAxesInfo) return;
	if (illegalPoint(point)) point = findPointFromSeries({
		seriesIndex: finder.seriesIndex,
		dataIndex: finder.dataIndex
	}, ecModel).point;
	var isIllegalPoint = illegalPoint(point);
	var inputAxesInfo = finder.axesInfo;
	var axesInfo = coordSysAxesInfo.axesInfo;
	var shouldHide = currTrigger === "leave" || illegalPoint(point);
	var outputPayload = {};
	var showValueMap = {};
	var dataByCoordSys = {
		list: [],
		map: {}
	};
	var updaters = {
		showPointer: curry$1(showPointer, showValueMap),
		showTooltip: curry$1(showTooltip, dataByCoordSys)
	};
	each$2(coordSysAxesInfo.coordSysMap, function(coordSys, coordSysKey) {
		var coordSysContainsPoint = isIllegalPoint || coordSys.containPoint(point);
		each$2(coordSysAxesInfo.coordSysAxesInfo[coordSysKey], function(axisInfo, key) {
			var axis = axisInfo.axis;
			var inputAxisInfo = findInputAxisInfo(inputAxesInfo, axisInfo);
			if (!shouldHide && coordSysContainsPoint && (!inputAxesInfo || inputAxisInfo)) {
				var val = inputAxisInfo && inputAxisInfo.value;
				if (val == null && !isIllegalPoint) val = axis.pointToData(point);
				val != null && processOnAxis(axisInfo, val, updaters, false, outputPayload);
			}
		});
	});
	var linkTriggers = {};
	each$2(axesInfo, function(tarAxisInfo, tarKey) {
		var linkGroup = tarAxisInfo.linkGroup;
		if (linkGroup && !showValueMap[tarKey]) each$2(linkGroup.axesInfo, function(srcAxisInfo, srcKey) {
			var srcValItem = showValueMap[srcKey];
			if (srcAxisInfo !== tarAxisInfo && srcValItem) {
				var val = srcValItem.value;
				linkGroup.mapper && (val = tarAxisInfo.axis.scale.parse(linkGroup.mapper(val, makeMapperParam(srcAxisInfo), makeMapperParam(tarAxisInfo))));
				linkTriggers[tarAxisInfo.key] = val;
			}
		});
	});
	each$2(linkTriggers, function(val, tarKey) {
		processOnAxis(axesInfo[tarKey], val, updaters, true, outputPayload);
	});
	updateModelActually(showValueMap, axesInfo, outputPayload);
	dispatchTooltipActually(dataByCoordSys, point, payload, dispatchAction);
	dispatchHighDownActually(axesInfo, dispatchAction, api);
	return outputPayload;
}
function processOnAxis(axisInfo, newValue, updaters, noSnap, outputFinder) {
	var axis = axisInfo.axis;
	if (axis.scale.isBlank() || !axis.containData(newValue)) return;
	if (!axisInfo.involveSeries) {
		updaters.showPointer(axisInfo, newValue);
		return;
	}
	var payloadInfo = buildPayloadsBySeries(newValue, axisInfo);
	var payloadBatch = payloadInfo.payloadBatch;
	var snapToValue = payloadInfo.snapToValue;
	if (payloadBatch[0] && outputFinder.seriesIndex == null) extend(outputFinder, payloadBatch[0]);
	if (!noSnap && axisInfo.snap) {
		if (axis.containData(snapToValue) && snapToValue != null) newValue = snapToValue;
	}
	updaters.showPointer(axisInfo, newValue, payloadBatch);
	updaters.showTooltip(axisInfo, payloadInfo, snapToValue);
}
function buildPayloadsBySeries(value, axisInfo) {
	var axis = axisInfo.axis;
	var dim = axis.dim;
	var snapToValue = value;
	var payloadBatch = [];
	var minDist = Number.MAX_VALUE;
	var minDiff = -1;
	each$2(axisInfo.seriesModels, function(series, idx) {
		var dataDim = series.getData().mapDimensionsAll(dim);
		var seriesNestestValue;
		var dataIndices;
		if (series.getAxisTooltipData) {
			var result = series.getAxisTooltipData(dataDim, value, axis);
			dataIndices = result.dataIndices;
			seriesNestestValue = result.nestestValue;
		} else {
			dataIndices = series.indicesOfNearest(dim, dataDim[0], value, axis.type === "category" ? .5 : null);
			if (!dataIndices.length) return;
			seriesNestestValue = series.getData().get(dataDim[0], dataIndices[0]);
		}
		if (!isNullableNumberFinite(seriesNestestValue)) return;
		var diff = value - seriesNestestValue;
		var dist = Math.abs(diff);
		if (dist <= minDist) {
			if (dist < minDist || diff >= 0 && minDiff < 0) {
				minDist = dist;
				minDiff = diff;
				snapToValue = seriesNestestValue;
				payloadBatch.length = 0;
			}
			each$2(dataIndices, function(dataIndex) {
				payloadBatch.push({
					seriesIndex: series.seriesIndex,
					dataIndexInside: dataIndex,
					dataIndex: series.getData().getRawIndex(dataIndex)
				});
			});
		}
	});
	return {
		payloadBatch,
		snapToValue
	};
}
function showPointer(showValueMap, axisInfo, value, payloadBatch) {
	showValueMap[axisInfo.key] = {
		value,
		payloadBatch
	};
}
function showTooltip(dataByCoordSys, axisInfo, payloadInfo, value) {
	var payloadBatch = payloadInfo.payloadBatch;
	var axis = axisInfo.axis;
	var axisModel = axis.model;
	var axisPointerModel = axisInfo.axisPointerModel;
	if (!axisInfo.triggerTooltip || !payloadBatch.length) return;
	var coordSysModel = axisInfo.coordSys.model;
	var coordSysKey = makeKey(coordSysModel);
	var coordSysItem = dataByCoordSys.map[coordSysKey];
	if (!coordSysItem) {
		coordSysItem = dataByCoordSys.map[coordSysKey] = {
			coordSysId: coordSysModel.id,
			coordSysIndex: coordSysModel.componentIndex,
			coordSysType: coordSysModel.type,
			coordSysMainType: coordSysModel.mainType,
			dataByAxis: []
		};
		dataByCoordSys.list.push(coordSysItem);
	}
	coordSysItem.dataByAxis.push({
		axisDim: axis.dim,
		axisIndex: axisModel.componentIndex,
		axisType: axisModel.type,
		axisId: axisModel.id,
		value,
		valueLabelOpt: {
			precision: axisPointerModel.get(["label", "precision"]),
			formatter: axisPointerModel.get(["label", "formatter"])
		},
		seriesDataIndices: payloadBatch.slice()
	});
}
function updateModelActually(showValueMap, axesInfo, outputPayload) {
	var outputAxesInfo = outputPayload.axesInfo = [];
	each$2(axesInfo, function(axisInfo, key) {
		var option = axisInfo.axisPointerModel.option;
		var valItem = showValueMap[key];
		if (valItem) {
			!axisInfo.useHandle && (option.status = "show");
			option.value = valItem.value;
			option.seriesDataIndices = (valItem.payloadBatch || []).slice();
		} else !axisInfo.useHandle && (option.status = "hide");
		option.status === "show" && outputAxesInfo.push({
			axisDim: axisInfo.axis.dim,
			axisIndex: axisInfo.axis.model.componentIndex,
			value: option.value
		});
	});
}
function dispatchTooltipActually(dataByCoordSys, point, payload, dispatchAction) {
	if (illegalPoint(point) || !dataByCoordSys.list.length) {
		dispatchAction({ type: "hideTip" });
		return;
	}
	var sampleItem = ((dataByCoordSys.list[0].dataByAxis[0] || {}).seriesDataIndices || [])[0] || {};
	dispatchAction({
		type: "showTip",
		escapeConnect: true,
		x: point[0],
		y: point[1],
		tooltipOption: payload.tooltipOption,
		position: payload.position,
		dataIndexInside: sampleItem.dataIndexInside,
		dataIndex: sampleItem.dataIndex,
		seriesIndex: sampleItem.seriesIndex,
		dataByCoordSys: dataByCoordSys.list
	});
}
function dispatchHighDownActually(axesInfo, dispatchAction, api) {
	var zr = api.getZr();
	var highDownKey = "axisPointerLastHighlights";
	var lastHighlights = inner(zr)[highDownKey] || {};
	var newHighlights = inner(zr)[highDownKey] = {};
	each$2(axesInfo, function(axisInfo, key) {
		var option = axisInfo.axisPointerModel.option;
		option.status === "show" && axisInfo.triggerEmphasis && each$2(option.seriesDataIndices, function(batchItem) {
			newHighlights[batchItem.seriesIndex + "|" + batchItem.dataIndex] = batchItem;
		});
	});
	var toHighlight = [];
	var toDownplay = [];
	function makeHighDownItem(batchItem) {
		return {
			seriesIndex: batchItem.seriesIndex,
			dataIndex: batchItem.dataIndex
		};
	}
	each$2(lastHighlights, function(batchItem, key) {
		!newHighlights[key] && toDownplay.push(makeHighDownItem(batchItem));
	});
	each$2(newHighlights, function(batchItem, key) {
		!lastHighlights[key] && toHighlight.push(makeHighDownItem(batchItem));
	});
	toDownplay.length && api.dispatchAction({
		type: "downplay",
		escapeConnect: true,
		notBlur: true,
		batch: toDownplay
	});
	toHighlight.length && api.dispatchAction({
		type: "highlight",
		escapeConnect: true,
		notBlur: true,
		batch: toHighlight
	});
}
function findInputAxisInfo(inputAxesInfo, axisInfo) {
	for (var i = 0; i < (inputAxesInfo || []).length; i++) {
		var inputAxisInfo = inputAxesInfo[i];
		if (axisInfo.axis.dim === inputAxisInfo.axisDim && axisInfo.axis.model.componentIndex === inputAxisInfo.axisIndex) return inputAxisInfo;
	}
}
function makeMapperParam(axisInfo) {
	var axisModel = axisInfo.axis.model;
	var item = {};
	var dim = item.axisDim = axisInfo.axis.dim;
	item.axisIndex = item[dim + "AxisIndex"] = axisModel.componentIndex;
	item.axisName = item[dim + "AxisName"] = axisModel.name;
	item.axisId = item[dim + "AxisId"] = axisModel.id;
	return item;
}
function illegalPoint(point) {
	return !point || point[0] == null || isNaN(point[0]) || point[1] == null || isNaN(point[1]);
}
//#endregion
//#region node_modules/echarts/lib/component/axisPointer/install.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function install$5(registers) {
	AxisView.registerAxisPointerClass("CartesianAxisPointer", CartesianAxisPointer);
	registers.registerComponentModel(AxisPointerModel);
	registers.registerComponentView(AxisPointerView);
	registers.registerPreprocessor(function(option) {
		if (option) {
			(!option.axisPointer || option.axisPointer.length === 0) && (option.axisPointer = {});
			var link = option.axisPointer.link;
			if (link && !isArray(link)) option.axisPointer.link = [link];
		}
	});
	registers.registerProcessor(registers.PRIORITY.PROCESSOR.STATISTIC, { overallReset: function(ecModel, api) {
		ecModel.getComponent("axisPointer").coordSysAxesInfo = collect(ecModel, api);
	} });
	registers.registerAction({
		type: "updateAxisPointer",
		event: "updateAxisPointer",
		update: ":updateAxisPointer"
	}, axisTrigger);
}
//#endregion
//#region node_modules/echarts/lib/component/grid/install.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function install(registers) {
	use(install$6);
	use(install$5);
}
//#endregion
//#region node_modules/echarts/lib/component/helper/listComponent.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function makeBackground(rect, componentModel) {
	var padding = normalizeCssArray(componentModel.get("padding"));
	var style = componentModel.getItemStyle(["color", "opacity"]);
	style.fill = componentModel.get("backgroundColor");
	return new Rect({
		shape: {
			x: rect.x - padding[3],
			y: rect.y - padding[0],
			width: rect.width + padding[1] + padding[3],
			height: rect.height + padding[0] + padding[2],
			r: componentModel.get("borderRadius")
		},
		style,
		silent: true,
		z2: -1
	});
}
//#endregion
//#region node_modules/echarts/lib/component/tooltip/TooltipModel.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var TooltipModel = function(_super) {
	__extends(TooltipModel, _super);
	function TooltipModel() {
		var _this = _super !== null && _super.apply(this, arguments) || this;
		_this.type = TooltipModel.type;
		return _this;
	}
	TooltipModel.type = "tooltip";
	TooltipModel.dependencies = ["axisPointer"];
	TooltipModel.defaultOption = {
		z: 60,
		show: true,
		showContent: true,
		trigger: "item",
		triggerOn: "mousemove|click|mousewheel",
		alwaysShowContent: false,
		renderMode: "auto",
		confine: null,
		showDelay: 0,
		hideDelay: 100,
		transitionDuration: .4,
		displayTransition: true,
		enterable: false,
		backgroundColor: tokens.color.neutral00,
		shadowBlur: 10,
		shadowColor: "rgba(0, 0, 0, .2)",
		shadowOffsetX: 1,
		shadowOffsetY: 2,
		borderRadius: 4,
		borderWidth: 1,
		defaultBorderColor: tokens.color.border,
		padding: null,
		extraCssText: "",
		axisPointer: {
			type: "line",
			axis: "auto",
			animation: "auto",
			animationDurationUpdate: 200,
			animationEasingUpdate: "exponentialOut",
			crossStyle: {
				color: tokens.color.borderShade,
				width: 1,
				type: "dashed",
				textStyle: {}
			}
		},
		textStyle: {
			color: tokens.color.tertiary,
			fontSize: 14
		}
	};
	return TooltipModel;
}(ComponentModel);
//#endregion
//#region node_modules/echarts/lib/component/tooltip/helper.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function shouldTooltipConfine(tooltipModel) {
	var confineOption = tooltipModel.get("confine");
	return confineOption != null ? !!confineOption : tooltipModel.get("renderMode") === "richText";
}
function testStyle(styleProps) {
	if (!env.domSupported) return;
	var style = document.documentElement.style;
	for (var i = 0, len = styleProps.length; i < len; i++) if (styleProps[i] in style) return styleProps[i];
}
var TRANSFORM_VENDOR = testStyle([
	"transform",
	"webkitTransform",
	"OTransform",
	"MozTransform",
	"msTransform"
]);
var TRANSITION_VENDOR = testStyle([
	"webkitTransition",
	"transition",
	"OTransition",
	"MozTransition",
	"msTransition"
]);
function toCSSVendorPrefix(styleVendor, styleProp) {
	if (!styleVendor) return styleProp;
	styleProp = toCamelCase(styleProp, true);
	var idx = styleVendor.indexOf(styleProp);
	styleVendor = idx === -1 ? styleProp : "-" + styleVendor.slice(0, idx) + "-" + styleProp;
	return styleVendor.toLowerCase();
}
function getComputedStyle(el, style) {
	var stl = el.currentStyle || document.defaultView && document.defaultView.getComputedStyle(el);
	return stl ? style ? stl[style] : stl : null;
}
//#endregion
//#region node_modules/echarts/lib/component/tooltip/TooltipHTMLContent.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var CSS_TRANSITION_VENDOR = toCSSVendorPrefix(TRANSITION_VENDOR, "transition");
var CSS_TRANSFORM_VENDOR = toCSSVendorPrefix(TRANSFORM_VENDOR, "transform");
var gCssText = "position:absolute;display:block;border-style:solid;white-space:nowrap;z-index:9999999;" + (env.transform3dSupported ? "will-change:transform;" : "");
function mirrorPos(pos) {
	pos = pos === "left" ? "right" : pos === "right" ? "left" : pos === "top" ? "bottom" : "top";
	return pos;
}
function assembleArrow(tooltipModel, borderColor, arrowPosition) {
	if (!isString(arrowPosition) || arrowPosition === "inside") return "";
	var backgroundColor = tooltipModel.get("backgroundColor");
	var borderWidth = tooltipModel.get("borderWidth");
	borderColor = convertToColorString(borderColor);
	var arrowPos = mirrorPos(arrowPosition);
	var arrowSize = Math.max(Math.round(borderWidth) * 1.5, 6);
	var positionStyle = "";
	var transformStyle = CSS_TRANSFORM_VENDOR + ":";
	var rotateDeg;
	if (indexOf(["left", "right"], arrowPos) > -1) {
		positionStyle += "top:50%";
		transformStyle += "translateY(-50%) rotate(" + (rotateDeg = arrowPos === "left" ? -225 : -45) + "deg)";
	} else {
		positionStyle += "left:50%";
		transformStyle += "translateX(-50%) rotate(" + (rotateDeg = arrowPos === "top" ? 225 : 45) + "deg)";
	}
	var rotateRadian = rotateDeg * Math.PI / 180;
	var arrowWH = arrowSize + borderWidth;
	var rotatedWH = arrowWH * Math.abs(Math.cos(rotateRadian)) + arrowWH * Math.abs(Math.sin(rotateRadian));
	var arrowOffset = Math.round(((rotatedWH - Math.SQRT2 * borderWidth) / 2 + Math.SQRT2 * borderWidth - (rotatedWH - arrowWH) / 2) * 100) / 100;
	positionStyle += ";" + arrowPos + ":-" + arrowOffset + "px";
	var borderStyle = borderColor + " solid " + borderWidth + "px;";
	return "<div style=\"" + [
		"position:absolute;width:" + arrowSize + "px;height:" + arrowSize + "px;z-index:-1;",
		positionStyle + ";" + transformStyle + ";",
		"border-bottom:" + borderStyle,
		"border-right:" + borderStyle,
		"background-color:" + backgroundColor + ";"
	].join("") + "\"></div>";
}
function assembleTransition(duration, onlyFadeTransition, enableDisplayTransition) {
	var transitionCurve = "cubic-bezier(0.23,1,0.32,1)";
	var transitionOption = "";
	var transitionText = "";
	if (enableDisplayTransition) {
		transitionOption = " " + duration / 2 + "s " + transitionCurve;
		transitionText = "opacity" + transitionOption + ",visibility" + transitionOption;
	}
	if (!onlyFadeTransition) {
		transitionOption = " " + duration + "s " + transitionCurve;
		transitionText += (transitionText.length ? "," : "") + (env.transformSupported ? "" + CSS_TRANSFORM_VENDOR + transitionOption : ",left" + transitionOption + ",top" + transitionOption);
	}
	return CSS_TRANSITION_VENDOR + ":" + transitionText;
}
function assembleTransform(x, y, toString) {
	var x0 = x.toFixed(0) + "px";
	var y0 = y.toFixed(0) + "px";
	if (!env.transformSupported) return toString ? "top:" + y0 + ";left:" + x0 + ";" : [["top", y0], ["left", x0]];
	var is3d = env.transform3dSupported;
	var translate = "translate" + (is3d ? "3d" : "") + "(" + x0 + "," + y0 + (is3d ? ",0" : "") + ")";
	return toString ? "top:0;left:0;" + CSS_TRANSFORM_VENDOR + ":" + translate + ";" : [
		["top", 0],
		["left", 0],
		[TRANSFORM_VENDOR, translate]
	];
}
/**
* @param {Object} textStyle
* @return {string}
* @inner
*/
function assembleFont(textStyleModel) {
	var cssText = [];
	var fontSize = textStyleModel.get("fontSize");
	var color = textStyleModel.getTextColor();
	color && cssText.push("color:" + color);
	cssText.push("font:" + textStyleModel.getFont());
	var lineHeight = retrieve2(textStyleModel.get("lineHeight"), Math.round(fontSize * 3 / 2));
	fontSize && cssText.push("line-height:" + lineHeight + "px");
	var shadowColor = textStyleModel.get("textShadowColor");
	var shadowBlur = textStyleModel.get("textShadowBlur") || 0;
	var shadowOffsetX = textStyleModel.get("textShadowOffsetX") || 0;
	var shadowOffsetY = textStyleModel.get("textShadowOffsetY") || 0;
	shadowColor && shadowBlur && cssText.push("text-shadow:" + shadowOffsetX + "px " + shadowOffsetY + "px " + shadowBlur + "px " + shadowColor);
	each$2(["decoration", "align"], function(name) {
		var val = textStyleModel.get(name);
		val && cssText.push("text-" + name + ":" + val);
	});
	return cssText.join(";");
}
function assembleCssText(tooltipModel, enableTransition, onlyFadeTransition, enableDisplayTransition) {
	var cssText = [];
	var transitionDuration = tooltipModel.get("transitionDuration");
	var backgroundColor = tooltipModel.get("backgroundColor");
	var shadowBlur = tooltipModel.get("shadowBlur");
	var shadowColor = tooltipModel.get("shadowColor");
	var shadowOffsetX = tooltipModel.get("shadowOffsetX");
	var shadowOffsetY = tooltipModel.get("shadowOffsetY");
	var textStyleModel = tooltipModel.getModel("textStyle");
	var padding = getPaddingFromTooltipModel(tooltipModel, "html");
	var boxShadow = shadowOffsetX + "px " + shadowOffsetY + "px " + shadowBlur + "px " + shadowColor;
	cssText.push("box-shadow:" + boxShadow);
	enableTransition && transitionDuration > 0 && cssText.push(assembleTransition(transitionDuration, onlyFadeTransition, enableDisplayTransition));
	if (backgroundColor) cssText.push("background-color:" + backgroundColor);
	each$2([
		"width",
		"color",
		"radius"
	], function(name) {
		var borderName = "border-" + name;
		var camelCase = toCamelCase(borderName);
		var val = tooltipModel.get(camelCase);
		val != null && cssText.push(borderName + ":" + val + (name === "color" ? "" : "px"));
	});
	cssText.push(assembleFont(textStyleModel));
	if (padding != null) cssText.push("padding:" + normalizeCssArray(padding).join("px ") + "px");
	return cssText.join(";") + ";";
}
function makeStyleCoord$1(out, zr, container, zrX, zrY) {
	var zrPainter = zr && zr.painter;
	if (container) {
		var zrViewportRoot = zrPainter && zrPainter.getViewportRoot();
		if (zrViewportRoot) transformLocalCoord(out, zrViewportRoot, container, zrX, zrY);
	} else {
		out[0] = zrX;
		out[1] = zrY;
		var viewportRootOffset = zrPainter && zrPainter.getViewportRootOffset();
		if (viewportRootOffset) {
			out[0] += viewportRootOffset.offsetLeft;
			out[1] += viewportRootOffset.offsetTop;
		}
	}
	out[2] = out[0] / zr.getWidth();
	out[3] = out[1] / zr.getHeight();
}
var TooltipHTMLContent = function() {
	function TooltipHTMLContent(api, opt) {
		this._show = false;
		this._styleCoord = [
			0,
			0,
			0,
			0
		];
		this._enterable = true;
		this._alwaysShowContent = false;
		this._firstShow = true;
		this._longHide = true;
		if (env.wxa) return null;
		var el = document.createElement("div");
		el.domBelongToZr = true;
		this.el = el;
		var zr = this._zr = api.getZr();
		var appendTo = opt.appendTo;
		var container = appendTo && (isString(appendTo) ? document.querySelector(appendTo) : isDom(appendTo) ? appendTo : isFunction(appendTo) && appendTo(api.getDom()));
		makeStyleCoord$1(this._styleCoord, zr, container, api.getWidth() / 2, api.getHeight() / 2);
		(container || api.getDom()).appendChild(el);
		this._api = api;
		this._container = container;
		var self = this;
		el.onmouseenter = function() {
			if (self._enterable) {
				clearTimeout(self._hideTimeout);
				self._show = true;
			}
			self._inContent = true;
		};
		el.onmousemove = function(e) {
			e = e || window.event;
			if (!self._enterable) {
				var handler = zr.handler;
				var zrViewportRoot = zr.painter.getViewportRoot();
				normalizeEvent(zrViewportRoot, e, true);
				handler.dispatch("mousemove", e);
			}
		};
		el.onmouseleave = function() {
			self._inContent = false;
			if (self._enterable) {
				if (self._show) self.hideLater(self._hideDelay);
			}
		};
	}
	/**
	* Update when tooltip is rendered
	*/
	TooltipHTMLContent.prototype.update = function(tooltipModel) {
		if (!this._container) {
			var container = this._api.getDom();
			var position = getComputedStyle(container, "position");
			var domStyle = container.style;
			if (domStyle.position !== "absolute" && position !== "absolute") domStyle.position = "relative";
		}
		var alwaysShowContent = tooltipModel.get("alwaysShowContent");
		alwaysShowContent && this._moveIfResized();
		this._alwaysShowContent = alwaysShowContent;
		this._enableDisplayTransition = tooltipModel.get("displayTransition") && tooltipModel.get("transitionDuration") > 0;
		this.el.className = tooltipModel.get("className") || "";
	};
	TooltipHTMLContent.prototype.show = function(tooltipModel, nearPointColor) {
		clearTimeout(this._hideTimeout);
		clearTimeout(this._longHideTimeout);
		var el = this.el;
		var style = el.style;
		var styleCoord = this._styleCoord;
		if (!el.innerHTML) style.display = "none";
		else style.cssText = gCssText + assembleCssText(tooltipModel, !this._firstShow, this._longHide, this._enableDisplayTransition) + assembleTransform(styleCoord[0], styleCoord[1], true) + ("border-color:" + convertToColorString(nearPointColor) + ";") + (tooltipModel.get("extraCssText") || "") + (";pointer-events:" + (this._enterable ? "auto" : "none"));
		this._show = true;
		this._firstShow = false;
		this._longHide = false;
	};
	TooltipHTMLContent.prototype.setContent = function(content, markers, tooltipModel, borderColor, arrowPosition) {
		var el = this.el;
		if (content == null) {
			el.innerHTML = "";
			return;
		}
		var arrow = "";
		if (isString(arrowPosition) && tooltipModel.get("trigger") === "item" && !shouldTooltipConfine(tooltipModel)) arrow = assembleArrow(tooltipModel, borderColor, arrowPosition);
		if (isString(content)) el.innerHTML = content + arrow;
		else if (content) {
			el.innerHTML = "";
			if (!isArray(content)) content = [content];
			for (var i = 0; i < content.length; i++) if (isDom(content[i]) && content[i].parentNode !== el) el.appendChild(content[i]);
			if (arrow && el.childNodes.length) {
				var arrowEl = document.createElement("div");
				arrowEl.innerHTML = arrow;
				el.appendChild(arrowEl);
			}
		}
	};
	TooltipHTMLContent.prototype.setEnterable = function(enterable) {
		this._enterable = enterable;
	};
	TooltipHTMLContent.prototype.getSize = function() {
		var el = this.el;
		return el ? [el.offsetWidth, el.offsetHeight] : [0, 0];
	};
	TooltipHTMLContent.prototype.moveTo = function(zrX, zrY) {
		if (!this.el) return;
		var styleCoord = this._styleCoord;
		makeStyleCoord$1(styleCoord, this._zr, this._container, zrX, zrY);
		if (styleCoord[0] != null && styleCoord[1] != null) {
			var style_1 = this.el.style;
			var transforms = assembleTransform(styleCoord[0], styleCoord[1]);
			each$2(transforms, function(transform) {
				style_1[transform[0]] = transform[1];
			});
		}
	};
	/**
	* when `alwaysShowContent` is true,
	* move the tooltip after chart resized
	*/
	TooltipHTMLContent.prototype._moveIfResized = function() {
		var ratioX = this._styleCoord[2];
		var ratioY = this._styleCoord[3];
		this.moveTo(ratioX * this._zr.getWidth(), ratioY * this._zr.getHeight());
	};
	TooltipHTMLContent.prototype.hide = function() {
		var _this = this;
		var style = this.el.style;
		if (this._enableDisplayTransition) {
			style.visibility = "hidden";
			style.opacity = "0";
		} else style.display = "none";
		env.transform3dSupported && (style.willChange = "");
		this._show = false;
		this._longHideTimeout = setTimeout(function() {
			return _this._longHide = true;
		}, 500);
	};
	TooltipHTMLContent.prototype.hideLater = function(time) {
		if (this._show && !(this._inContent && this._enterable) && !this._alwaysShowContent) {
			if (time) {
				this._hideDelay = time;
				this._show = false;
				this._hideTimeout = setTimeout(bind$1(this.hide, this), time);
			} else this.hide();
		}
	};
	TooltipHTMLContent.prototype.isShow = function() {
		return this._show;
	};
	TooltipHTMLContent.prototype.dispose = function() {
		clearTimeout(this._hideTimeout);
		clearTimeout(this._longHideTimeout);
		var zr = this._zr;
		transformLocalCoordClear(zr && zr.painter && zr.painter.getViewportRoot(), this._container);
		var el = this.el;
		if (el) {
			el.onmouseenter = el.onmousemove = el.onmouseleave = null;
			var parentNode = el.parentNode;
			parentNode && parentNode.removeChild(el);
		}
		this.el = this._container = null;
	};
	return TooltipHTMLContent;
}();
//#endregion
//#region node_modules/echarts/lib/component/tooltip/TooltipRichContent.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var TooltipRichContent = function() {
	function TooltipRichContent(api) {
		this._show = false;
		this._styleCoord = [
			0,
			0,
			0,
			0
		];
		this._alwaysShowContent = false;
		this._enterable = true;
		this._zr = api.getZr();
		makeStyleCoord(this._styleCoord, this._zr, api.getWidth() / 2, api.getHeight() / 2);
	}
	/**
	* Update when tooltip is rendered
	*/
	TooltipRichContent.prototype.update = function(tooltipModel) {
		var alwaysShowContent = tooltipModel.get("alwaysShowContent");
		alwaysShowContent && this._moveIfResized();
		this._alwaysShowContent = alwaysShowContent;
	};
	TooltipRichContent.prototype.show = function() {
		if (this._hideTimeout) clearTimeout(this._hideTimeout);
		this.el.show();
		this._show = true;
	};
	/**
	* Set tooltip content
	*/
	TooltipRichContent.prototype.setContent = function(content, markupStyleCreator, tooltipModel, borderColor, arrowPosition) {
		var _this = this;
		if (isObject(content)) throwError("");
		if (this.el) this._zr.remove(this.el);
		var textStyleModel = tooltipModel.getModel("textStyle");
		this.el = new ZRText({
			style: {
				rich: markupStyleCreator.richTextStyles,
				text: content,
				lineHeight: 22,
				borderWidth: 1,
				borderColor,
				textShadowColor: textStyleModel.get("textShadowColor"),
				fill: tooltipModel.get(["textStyle", "color"]),
				padding: getPaddingFromTooltipModel(tooltipModel, "richText"),
				verticalAlign: "top",
				align: "left"
			},
			z: tooltipModel.get("z")
		});
		each$2([
			"backgroundColor",
			"borderRadius",
			"shadowColor",
			"shadowBlur",
			"shadowOffsetX",
			"shadowOffsetY"
		], function(propName) {
			_this.el.style[propName] = tooltipModel.get(propName);
		});
		each$2([
			"textShadowBlur",
			"textShadowOffsetX",
			"textShadowOffsetY"
		], function(propName) {
			_this.el.style[propName] = textStyleModel.get(propName) || 0;
		});
		this._zr.add(this.el);
		var self = this;
		this.el.on("mouseover", function() {
			if (self._enterable) {
				clearTimeout(self._hideTimeout);
				self._show = true;
			}
			self._inContent = true;
		});
		this.el.on("mouseout", function() {
			if (self._enterable) {
				if (self._show) self.hideLater(self._hideDelay);
			}
			self._inContent = false;
		});
	};
	TooltipRichContent.prototype.setEnterable = function(enterable) {
		this._enterable = enterable;
	};
	TooltipRichContent.prototype.getSize = function() {
		var el = this.el;
		var bounding = this.el.getBoundingRect();
		var shadowOuterSize = calcShadowOuterSize(el.style);
		return [bounding.width + shadowOuterSize.left + shadowOuterSize.right, bounding.height + shadowOuterSize.top + shadowOuterSize.bottom];
	};
	TooltipRichContent.prototype.moveTo = function(x, y) {
		var el = this.el;
		if (el) {
			var styleCoord = this._styleCoord;
			makeStyleCoord(styleCoord, this._zr, x, y);
			x = styleCoord[0];
			y = styleCoord[1];
			var style = el.style;
			var borderWidth = mathMaxWith0(style.borderWidth || 0);
			var shadowOuterSize = calcShadowOuterSize(style);
			el.x = x + borderWidth + shadowOuterSize.left;
			el.y = y + borderWidth + shadowOuterSize.top;
			el.markRedraw();
		}
	};
	/**
	* when `alwaysShowContent` is true,
	* move the tooltip after chart resized
	*/
	TooltipRichContent.prototype._moveIfResized = function() {
		var ratioX = this._styleCoord[2];
		var ratioY = this._styleCoord[3];
		this.moveTo(ratioX * this._zr.getWidth(), ratioY * this._zr.getHeight());
	};
	TooltipRichContent.prototype.hide = function() {
		if (this.el) this.el.hide();
		this._show = false;
	};
	TooltipRichContent.prototype.hideLater = function(time) {
		if (this._show && !(this._inContent && this._enterable) && !this._alwaysShowContent) {
			if (time) {
				this._hideDelay = time;
				this._show = false;
				this._hideTimeout = setTimeout(bind$1(this.hide, this), time);
			} else this.hide();
		}
	};
	TooltipRichContent.prototype.isShow = function() {
		return this._show;
	};
	TooltipRichContent.prototype.dispose = function() {
		this._zr.remove(this.el);
	};
	return TooltipRichContent;
}();
function mathMaxWith0(val) {
	return Math.max(0, val);
}
function calcShadowOuterSize(style) {
	var shadowBlur = mathMaxWith0(style.shadowBlur || 0);
	var shadowOffsetX = mathMaxWith0(style.shadowOffsetX || 0);
	var shadowOffsetY = mathMaxWith0(style.shadowOffsetY || 0);
	return {
		left: mathMaxWith0(shadowBlur - shadowOffsetX),
		right: mathMaxWith0(shadowBlur + shadowOffsetX),
		top: mathMaxWith0(shadowBlur - shadowOffsetY),
		bottom: mathMaxWith0(shadowBlur + shadowOffsetY)
	};
}
function makeStyleCoord(out, zr, zrX, zrY) {
	out[0] = zrX;
	out[1] = zrY;
	out[2] = out[0] / zr.getWidth();
	out[3] = out[1] / zr.getHeight();
}
//#endregion
//#region node_modules/echarts/lib/component/tooltip/TooltipView.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var proxyRect = new Rect({ shape: {
	x: -1,
	y: -1,
	width: 2,
	height: 2
} });
var TooltipView = function(_super) {
	__extends(TooltipView, _super);
	function TooltipView() {
		var _this = _super !== null && _super.apply(this, arguments) || this;
		_this.type = TooltipView.type;
		return _this;
	}
	TooltipView.prototype.init = function(ecModel, api) {
		if (env.node || !api.getDom()) return;
		var tooltipModel = ecModel.getComponent("tooltip");
		var renderMode = this._renderMode = getTooltipRenderMode(tooltipModel.get("renderMode"));
		this._tooltipContent = renderMode === "richText" ? new TooltipRichContent(api) : new TooltipHTMLContent(api, { appendTo: tooltipModel.get("appendToBody", true) ? "body" : tooltipModel.get("appendTo", true) });
	};
	TooltipView.prototype.render = function(tooltipModel, ecModel, api) {
		if (env.node || !api.getDom()) return;
		this.group.removeAll();
		this._tooltipModel = tooltipModel;
		this._ecModel = ecModel;
		this._api = api;
		var tooltipContent = this._tooltipContent;
		tooltipContent.update(tooltipModel);
		tooltipContent.setEnterable(tooltipModel.get("enterable"));
		this._initGlobalListener();
		this._keepShow();
		if (this._renderMode !== "richText" && tooltipModel.get("transitionDuration")) createOrUpdate(this, "_updatePosition", 50, "fixRate");
		else clear(this, "_updatePosition");
	};
	TooltipView.prototype._initGlobalListener = function() {
		var triggerOn = this._tooltipModel.get("triggerOn");
		register("itemTooltip", this._api, bind$1(function(currTrigger, e, dispatchAction) {
			if (triggerOn !== "none") {
				if (triggerOn.indexOf(currTrigger) >= 0) this._tryShow(e, dispatchAction);
				else if (currTrigger === "leave") this._hide(dispatchAction);
			}
		}, this));
	};
	TooltipView.prototype._keepShow = function() {
		var tooltipModel = this._tooltipModel;
		var ecModel = this._ecModel;
		var api = this._api;
		var triggerOn = tooltipModel.get("triggerOn");
		if (tooltipModel.get("trigger") !== "axis") {
			this._lastDataByCoordSys = null;
			this._cbParamsList = null;
		}
		if (this._lastX != null && this._lastY != null && triggerOn !== "none" && triggerOn !== "click") {
			var self_1 = this;
			clearTimeout(this._refreshUpdateTimeout);
			this._refreshUpdateTimeout = setTimeout(function() {
				!api.isDisposed() && self_1.manuallyShowTip(tooltipModel, ecModel, api, {
					x: self_1._lastX,
					y: self_1._lastY,
					dataByCoordSys: self_1._lastDataByCoordSys
				});
			});
		}
	};
	/**
	* Show tip manually by
	* dispatchAction({
	*     type: 'showTip',
	*     x: 10,
	*     y: 10
	* });
	* Or
	* dispatchAction({
	*      type: 'showTip',
	*      seriesIndex: 0,
	*      dataIndex or dataIndexInside or name
	* });
	*
	*  TODO Batch
	*/
	TooltipView.prototype.manuallyShowTip = function(tooltipModel, ecModel, api, payload) {
		if (payload.from === this.uid || env.node || !api.getDom()) return;
		var dispatchAction = makeDispatchAction(payload, api);
		this._ticket = "";
		var dataByCoordSys = payload.dataByCoordSys;
		var cmptRef = findComponentReference(payload, ecModel, api);
		if (cmptRef) {
			var rect = cmptRef.el.getBoundingRect().clone();
			rect.applyTransform(cmptRef.el.transform);
			this._tryShow({
				offsetX: rect.x + rect.width / 2,
				offsetY: rect.y + rect.height / 2,
				target: cmptRef.el,
				position: payload.position,
				positionDefault: "bottom"
			}, dispatchAction);
		} else if (payload.tooltip && payload.x != null && payload.y != null) {
			var el = proxyRect;
			el.x = payload.x;
			el.y = payload.y;
			el.update();
			getECData(el).tooltipConfig = {
				name: null,
				option: payload.tooltip
			};
			this._tryShow({
				offsetX: payload.x,
				offsetY: payload.y,
				target: el
			}, dispatchAction);
		} else if (dataByCoordSys) this._tryShow({
			offsetX: payload.x,
			offsetY: payload.y,
			position: payload.position,
			dataByCoordSys,
			tooltipOption: payload.tooltipOption
		}, dispatchAction);
		else if (payload.seriesIndex != null) {
			if (this._manuallyAxisShowTip(tooltipModel, ecModel, api, payload)) return;
			var pointInfo = findPointFromSeries(payload, ecModel);
			var cx = pointInfo.point[0];
			var cy = pointInfo.point[1];
			if (cx != null && cy != null) this._tryShow({
				offsetX: cx,
				offsetY: cy,
				target: pointInfo.el,
				position: payload.position,
				positionDefault: "bottom"
			}, dispatchAction);
		} else if (payload.x != null && payload.y != null) {
			api.dispatchAction({
				type: "updateAxisPointer",
				x: payload.x,
				y: payload.y
			});
			this._tryShow({
				offsetX: payload.x,
				offsetY: payload.y,
				position: payload.position,
				target: api.getZr().findHover(payload.x, payload.y).target
			}, dispatchAction);
		}
	};
	TooltipView.prototype.manuallyHideTip = function(tooltipModel, ecModel, api, payload) {
		var tooltipContent = this._tooltipContent;
		if (this._tooltipModel) tooltipContent.hideLater(this._tooltipModel.get("hideDelay"));
		this._lastX = this._lastY = this._lastDataByCoordSys = null;
		this._cbParamsList = null;
		if (payload.from !== this.uid) this._hide(makeDispatchAction(payload, api));
	};
	TooltipView.prototype._manuallyAxisShowTip = function(tooltipModel, ecModel, api, payload) {
		var seriesIndex = payload.seriesIndex;
		var dataIndex = payload.dataIndex;
		var coordSysAxesInfo = ecModel.getComponent("axisPointer").coordSysAxesInfo;
		if (seriesIndex == null || dataIndex == null || coordSysAxesInfo == null) return;
		var seriesModel = ecModel.getSeriesByIndex(seriesIndex);
		if (!seriesModel) return;
		if (buildTooltipModel([
			seriesModel.getData().getItemModel(dataIndex),
			seriesModel,
			(seriesModel.coordinateSystem || {}).model
		], this._tooltipModel).get("trigger") !== "axis") return;
		api.dispatchAction({
			type: "updateAxisPointer",
			seriesIndex,
			dataIndex,
			position: payload.position
		});
		return true;
	};
	TooltipView.prototype._tryShow = function(e, dispatchAction) {
		var el = e.target;
		if (!this._tooltipModel) return;
		this._lastX = e.offsetX;
		this._lastY = e.offsetY;
		var dataByCoordSys = e.dataByCoordSys;
		if (dataByCoordSys && dataByCoordSys.length) this._showAxisTooltip(dataByCoordSys, e);
		else if (el) {
			if (getECData(el).ssrType === "legend") return;
			this._lastDataByCoordSys = null;
			this._cbParamsList = null;
			var seriesDispatcher_1;
			var cmptDispatcher_1;
			findEventDispatcher(el, function(target) {
				if (target.tooltipDisabled) {
					seriesDispatcher_1 = cmptDispatcher_1 = null;
					return true;
				}
				if (seriesDispatcher_1 || cmptDispatcher_1) return;
				if (getECData(target).dataIndex != null) seriesDispatcher_1 = target;
				else if (getECData(target).tooltipConfig != null) cmptDispatcher_1 = target;
			}, true);
			if (seriesDispatcher_1) this._showSeriesItemTooltip(e, seriesDispatcher_1, dispatchAction);
			else if (cmptDispatcher_1) this._showComponentItemTooltip(e, cmptDispatcher_1, dispatchAction);
			else this._hide(dispatchAction);
		} else {
			this._lastDataByCoordSys = null;
			this._cbParamsList = null;
			this._hide(dispatchAction);
		}
	};
	TooltipView.prototype._showOrMove = function(tooltipModel, cb) {
		var delay = tooltipModel.get("showDelay");
		cb = bind$1(cb, this);
		clearTimeout(this._showTimout);
		delay > 0 ? this._showTimout = setTimeout(cb, delay) : cb();
	};
	TooltipView.prototype._showAxisTooltip = function(dataByCoordSys, e) {
		var ecModel = this._ecModel;
		var globalTooltipModel = this._tooltipModel;
		var point = [e.offsetX, e.offsetY];
		var singleTooltipModel = buildTooltipModel([e.tooltipOption], globalTooltipModel);
		var renderMode = this._renderMode;
		var cbParamsList = [];
		var articleMarkup = createTooltipMarkup("section", {
			blocks: [],
			noHeader: true
		});
		var markupTextArrLegacy = [];
		var markupStyleCreator = new TooltipMarkupStyleCreator();
		each$2(dataByCoordSys, function(itemCoordSys) {
			each$2(itemCoordSys.dataByAxis, function(axisItem) {
				var axisModel = ecModel.getComponent(axisItem.axisDim + "Axis", axisItem.axisIndex);
				var axisValue = axisItem.value;
				var axis = axisModel.axis;
				var axisValueParsed = axis.scale.parse(axisValue);
				if (!axisModel || axisValue == null) return;
				var axisValueLabel = getValueLabel(axisValue, axis, ecModel, axisItem.seriesDataIndices, axisItem.valueLabelOpt);
				var axisSectionMarkup = createTooltipMarkup("section", {
					header: axisValueLabel,
					noHeader: !trim(axisValueLabel),
					sortBlocks: true,
					blocks: []
				});
				articleMarkup.blocks.push(axisSectionMarkup);
				each$2(axisItem.seriesDataIndices, function(idxItem) {
					var series = ecModel.getSeriesByIndex(idxItem.seriesIndex);
					var dataIndex = idxItem.dataIndexInside;
					var cbParams = series.getDataParams(dataIndex);
					if (cbParams.dataIndex < 0) return;
					cbParams.axisDim = axisItem.axisDim;
					cbParams.axisIndex = axisItem.axisIndex;
					cbParams.axisType = axisItem.axisType;
					cbParams.axisId = axisItem.axisId;
					cbParams.axisValue = getAxisRawValue(axisModel.axis, { value: axisValueParsed });
					cbParams.axisValueLabel = axisValueLabel;
					cbParams.marker = markupStyleCreator.makeTooltipMarker("item", convertToColorString(cbParams.color), renderMode);
					var seriesTooltipResult = normalizeTooltipFormatResult(series.formatTooltip(dataIndex, true, null));
					var frag = seriesTooltipResult.frag;
					if (frag) {
						var valueFormatter = buildTooltipModel([series], globalTooltipModel).get("valueFormatter");
						axisSectionMarkup.blocks.push(valueFormatter ? extend({ valueFormatter }, frag) : frag);
					}
					if (seriesTooltipResult.text) markupTextArrLegacy.push(seriesTooltipResult.text);
					cbParamsList.push(cbParams);
				});
			});
		});
		articleMarkup.blocks.reverse();
		markupTextArrLegacy.reverse();
		var positionExpr = e.position;
		var orderMode = singleTooltipModel.get("order");
		var builtMarkupText = buildTooltipMarkup(articleMarkup, markupStyleCreator, renderMode, orderMode, ecModel.get("useUTC"), singleTooltipModel.get("textStyle"));
		builtMarkupText && markupTextArrLegacy.unshift(builtMarkupText);
		var blockBreak = renderMode === "richText" ? "\n\n" : "<br/>";
		var allMarkupText = markupTextArrLegacy.join(blockBreak);
		this._showOrMove(singleTooltipModel, function() {
			if (this._updateContentNotChangedOnAxis(dataByCoordSys, cbParamsList)) this._updatePosition(singleTooltipModel, positionExpr, point[0], point[1], this._tooltipContent, cbParamsList);
			else this._showTooltipContent(singleTooltipModel, allMarkupText, cbParamsList, Math.random() + "", point[0], point[1], positionExpr, null, markupStyleCreator);
		});
	};
	TooltipView.prototype._showSeriesItemTooltip = function(e, dispatcher, dispatchAction) {
		var ecModel = this._ecModel;
		var ecData = getECData(dispatcher);
		var seriesIndex = ecData.seriesIndex;
		var seriesModel = ecModel.getSeriesByIndex(seriesIndex);
		var dataModel = ecData.dataModel || seriesModel;
		var dataIndex = ecData.dataIndex;
		var dataType = ecData.dataType;
		var data = dataModel.getData(dataType);
		var renderMode = this._renderMode;
		var positionDefault = e.positionDefault;
		var tooltipModel = buildTooltipModel([
			data.getItemModel(dataIndex),
			dataModel,
			seriesModel && (seriesModel.coordinateSystem || {}).model
		], this._tooltipModel, positionDefault ? { position: positionDefault } : null);
		var tooltipTrigger = tooltipModel.get("trigger");
		if (tooltipTrigger != null && tooltipTrigger !== "item") return;
		var params = dataModel.getDataParams(dataIndex, dataType);
		var markupStyleCreator = new TooltipMarkupStyleCreator();
		params.marker = markupStyleCreator.makeTooltipMarker("item", convertToColorString(params.color), renderMode);
		var seriesTooltipResult = normalizeTooltipFormatResult(dataModel.formatTooltip(dataIndex, false, dataType));
		var orderMode = tooltipModel.get("order");
		var valueFormatter = tooltipModel.get("valueFormatter");
		var frag = seriesTooltipResult.frag;
		var markupText = frag ? buildTooltipMarkup(valueFormatter ? extend({ valueFormatter }, frag) : frag, markupStyleCreator, renderMode, orderMode, ecModel.get("useUTC"), tooltipModel.get("textStyle")) : seriesTooltipResult.text;
		var asyncTicket = "item_" + dataModel.name + "_" + dataIndex;
		this._showOrMove(tooltipModel, function() {
			this._showTooltipContent(tooltipModel, markupText, params, asyncTicket, e.offsetX, e.offsetY, e.position, e.target, markupStyleCreator);
		});
		dispatchAction({
			type: "showTip",
			dataIndexInside: dataIndex,
			dataIndex: data.getRawIndex(dataIndex),
			seriesIndex,
			from: this.uid
		});
	};
	TooltipView.prototype._showComponentItemTooltip = function(e, el, dispatchAction) {
		var isHTMLRenderMode = this._renderMode === "html";
		var ecData = getECData(el);
		var tooltipOpt = ecData.tooltipConfig.option || {};
		var encodeHTMLContent = tooltipOpt.encodeHTMLContent;
		if (isString(tooltipOpt)) {
			var content = tooltipOpt;
			tooltipOpt = {
				content,
				formatter: content
			};
			encodeHTMLContent = true;
		}
		if (encodeHTMLContent && isHTMLRenderMode && tooltipOpt.content) {
			tooltipOpt = clone$1(tooltipOpt);
			tooltipOpt.content = encodeHTML(tooltipOpt.content);
		}
		var tooltipModelCascade = [tooltipOpt];
		var cmpt = this._ecModel.getComponent(ecData.componentMainType, ecData.componentIndex);
		if (cmpt) tooltipModelCascade.push(cmpt);
		tooltipModelCascade.push({ formatter: tooltipOpt.content });
		var positionDefault = e.positionDefault;
		var subTooltipModel = buildTooltipModel(tooltipModelCascade, this._tooltipModel, positionDefault ? { position: positionDefault } : null);
		var defaultHtml = subTooltipModel.get("content");
		var asyncTicket = Math.random() + "";
		var markupStyleCreator = new TooltipMarkupStyleCreator();
		this._showOrMove(subTooltipModel, function() {
			var formatterParams = clone$1(subTooltipModel.get("formatterParams") || {});
			this._showTooltipContent(subTooltipModel, defaultHtml, formatterParams, asyncTicket, e.offsetX, e.offsetY, e.position, el, markupStyleCreator);
		});
		dispatchAction({
			type: "showTip",
			from: this.uid
		});
	};
	TooltipView.prototype._showTooltipContent = function(tooltipModel, defaultHtml, params, asyncTicket, x, y, positionExpr, el, markupStyleCreator) {
		this._ticket = "";
		if (!tooltipModel.get("showContent") || !tooltipModel.get("show")) return;
		var tooltipContent = this._tooltipContent;
		tooltipContent.setEnterable(tooltipModel.get("enterable"));
		var formatter = tooltipModel.get("formatter");
		positionExpr = positionExpr || tooltipModel.get("position");
		var html = defaultHtml;
		var nearPointColor = this._getNearestPoint([x, y], params, tooltipModel.get("trigger"), tooltipModel.get("borderColor"), tooltipModel.get("defaultBorderColor", true)).color;
		if (formatter) {
			if (isString(formatter)) {
				var useUTC = tooltipModel.ecModel.get("useUTC");
				var params0 = isArray(params) ? params[0] : params;
				var isTimeAxis = params0 && params0.axisType && params0.axisType.indexOf("time") >= 0;
				html = formatter;
				if (isTimeAxis) html = format(params0.axisValue, html, useUTC);
				html = formatTpl(html, params, true);
			} else if (isFunction(formatter)) {
				var callback = bind$1(function(cbTicket, html) {
					if (cbTicket === this._ticket) {
						tooltipContent.setContent(html, markupStyleCreator, tooltipModel, nearPointColor, positionExpr);
						this._updatePosition(tooltipModel, positionExpr, x, y, tooltipContent, params, el);
					}
				}, this);
				this._ticket = asyncTicket;
				html = formatter(params, asyncTicket, callback);
			} else html = formatter;
		}
		tooltipContent.setContent(html, markupStyleCreator, tooltipModel, nearPointColor, positionExpr);
		tooltipContent.show(tooltipModel, nearPointColor);
		this._updatePosition(tooltipModel, positionExpr, x, y, tooltipContent, params, el);
	};
	TooltipView.prototype._getNearestPoint = function(point, tooltipDataParams, trigger, borderColor, defaultBorderColor) {
		if (trigger === "axis" || isArray(tooltipDataParams)) return { color: borderColor || defaultBorderColor };
		if (!isArray(tooltipDataParams)) return { color: borderColor || tooltipDataParams.color || tooltipDataParams.borderColor };
	};
	TooltipView.prototype._updatePosition = function(tooltipModel, positionExpr, x, y, content, params, el) {
		var viewWidth = this._api.getWidth();
		var viewHeight = this._api.getHeight();
		positionExpr = positionExpr || tooltipModel.get("position");
		var contentSize = content.getSize();
		var align = tooltipModel.get("align");
		var vAlign = tooltipModel.get("verticalAlign");
		var rect = el && el.getBoundingRect().clone();
		el && rect.applyTransform(el.transform);
		if (isFunction(positionExpr)) positionExpr = positionExpr([x, y], params, content.el, rect, {
			viewSize: [viewWidth, viewHeight],
			contentSize: contentSize.slice()
		});
		if (isArray(positionExpr)) {
			x = parsePercent(positionExpr[0], viewWidth);
			y = parsePercent(positionExpr[1], viewHeight);
		} else if (isObject(positionExpr)) {
			var boxLayoutPosition = positionExpr;
			boxLayoutPosition.width = contentSize[0];
			boxLayoutPosition.height = contentSize[1];
			var layoutRect = getLayoutRect(boxLayoutPosition, {
				width: viewWidth,
				height: viewHeight
			});
			x = layoutRect.x;
			y = layoutRect.y;
			align = null;
			vAlign = null;
		} else if (isString(positionExpr) && el) {
			var pos = calcTooltipPosition(positionExpr, rect, contentSize, tooltipModel.get("borderWidth"));
			x = pos[0];
			y = pos[1];
		} else {
			var pos = refixTooltipPosition(x, y, content, viewWidth, viewHeight, align ? null : 20, vAlign ? null : 20);
			x = pos[0];
			y = pos[1];
		}
		align && (x -= isCenterAlign(align) ? contentSize[0] / 2 : align === "right" ? contentSize[0] : 0);
		vAlign && (y -= isCenterAlign(vAlign) ? contentSize[1] / 2 : vAlign === "bottom" ? contentSize[1] : 0);
		if (shouldTooltipConfine(tooltipModel)) {
			var pos = confineTooltipPosition(x, y, content, viewWidth, viewHeight);
			x = pos[0];
			y = pos[1];
		}
		content.moveTo(x, y);
	};
	TooltipView.prototype._updateContentNotChangedOnAxis = function(dataByCoordSys, cbParamsList) {
		var lastCoordSys = this._lastDataByCoordSys;
		var lastCbParamsList = this._cbParamsList;
		var contentNotChanged = !!lastCoordSys && lastCoordSys.length === dataByCoordSys.length;
		contentNotChanged && each$2(lastCoordSys, function(lastItemCoordSys, indexCoordSys) {
			var lastDataByAxis = lastItemCoordSys.dataByAxis || [];
			var thisDataByAxis = (dataByCoordSys[indexCoordSys] || {}).dataByAxis || [];
			contentNotChanged = contentNotChanged && lastDataByAxis.length === thisDataByAxis.length;
			contentNotChanged && each$2(lastDataByAxis, function(lastItem, indexAxis) {
				var thisItem = thisDataByAxis[indexAxis] || {};
				var lastIndices = lastItem.seriesDataIndices || [];
				var newIndices = thisItem.seriesDataIndices || [];
				contentNotChanged = contentNotChanged && lastItem.value === thisItem.value && lastItem.axisType === thisItem.axisType && lastItem.axisId === thisItem.axisId && lastIndices.length === newIndices.length;
				contentNotChanged && each$2(lastIndices, function(lastIdxItem, j) {
					var newIdxItem = newIndices[j];
					contentNotChanged = contentNotChanged && lastIdxItem.seriesIndex === newIdxItem.seriesIndex && lastIdxItem.dataIndex === newIdxItem.dataIndex;
				});
				lastCbParamsList && each$2(lastItem.seriesDataIndices, function(idxItem) {
					var seriesIdx = idxItem.seriesIndex;
					var cbParams = cbParamsList[seriesIdx];
					var lastCbParams = lastCbParamsList[seriesIdx];
					if (cbParams && lastCbParams && lastCbParams.data !== cbParams.data) contentNotChanged = false;
				});
			});
		});
		this._lastDataByCoordSys = dataByCoordSys;
		this._cbParamsList = cbParamsList;
		return !!contentNotChanged;
	};
	TooltipView.prototype._hide = function(dispatchAction) {
		this._lastDataByCoordSys = null;
		this._cbParamsList = null;
		dispatchAction({
			type: "hideTip",
			from: this.uid
		});
	};
	TooltipView.prototype.dispose = function(ecModel, api) {
		if (env.node || !api.getDom()) return;
		clear(this, "_updatePosition");
		this._tooltipContent.dispose();
		unregister("itemTooltip", api);
		this._tooltipContent = null;
		this._tooltipModel = null;
		this._lastDataByCoordSys = null;
		this._cbParamsList = null;
	};
	TooltipView.type = "tooltip";
	return TooltipView;
}(ComponentView);
/**
* From top to bottom. (the last one should be globalTooltipModel);
*/
function buildTooltipModel(modelCascade, globalTooltipModel, defaultTooltipOption) {
	var ecModel = globalTooltipModel.ecModel;
	var resultModel;
	if (defaultTooltipOption) {
		resultModel = new Model(defaultTooltipOption, ecModel, ecModel);
		resultModel = new Model(globalTooltipModel.option, resultModel, ecModel);
	} else resultModel = globalTooltipModel;
	for (var i = modelCascade.length - 1; i >= 0; i--) {
		var tooltipOpt = modelCascade[i];
		if (tooltipOpt) {
			if (tooltipOpt instanceof Model) tooltipOpt = tooltipOpt.get("tooltip", true);
			if (isString(tooltipOpt)) tooltipOpt = { formatter: tooltipOpt };
			if (tooltipOpt) resultModel = new Model(tooltipOpt, resultModel, ecModel);
		}
	}
	return resultModel;
}
function makeDispatchAction(payload, api) {
	return payload.dispatchAction || bind$1(api.dispatchAction, api);
}
function refixTooltipPosition(x, y, content, viewWidth, viewHeight, gapH, gapV) {
	var size = content.getSize();
	var width = size[0];
	var height = size[1];
	if (gapH != null) {
		if (x + width + gapH + 2 > viewWidth) x -= width + gapH;
		else x += gapH;
	}
	if (gapV != null) {
		if (y + height + gapV > viewHeight) y -= height + gapV;
		else y += gapV;
	}
	return [x, y];
}
function confineTooltipPosition(x, y, content, viewWidth, viewHeight) {
	var size = content.getSize();
	var width = size[0];
	var height = size[1];
	x = Math.min(x + width, viewWidth) - width;
	y = Math.min(y + height, viewHeight) - height;
	x = Math.max(x, 0);
	y = Math.max(y, 0);
	return [x, y];
}
function calcTooltipPosition(position, rect, contentSize, borderWidth) {
	var domWidth = contentSize[0];
	var domHeight = contentSize[1];
	var offset = Math.ceil(Math.SQRT2 * borderWidth) + 8;
	var x = 0;
	var y = 0;
	var rectWidth = rect.width;
	var rectHeight = rect.height;
	switch (position) {
		case "inside":
			x = rect.x + rectWidth / 2 - domWidth / 2;
			y = rect.y + rectHeight / 2 - domHeight / 2;
			break;
		case "top":
			x = rect.x + rectWidth / 2 - domWidth / 2;
			y = rect.y - domHeight - offset;
			break;
		case "bottom":
			x = rect.x + rectWidth / 2 - domWidth / 2;
			y = rect.y + rectHeight + offset;
			break;
		case "left":
			x = rect.x - domWidth - offset;
			y = rect.y + rectHeight / 2 - domHeight / 2;
			break;
		case "right":
			x = rect.x + rectWidth + offset;
			y = rect.y + rectHeight / 2 - domHeight / 2;
	}
	return [x, y];
}
function isCenterAlign(align) {
	return align === "center" || align === "middle";
}
/**
* Find target component by payload like:
* ```js
* { legendId: 'some_id', name: 'xxx' }
* { toolboxIndex: 1, name: 'xxx' }
* { geoName: 'some_name', name: 'xxx' }
* ```
* PENDING: at present only
*
* If not found, return null/undefined.
*/
function findComponentReference(payload, ecModel, api) {
	var queryOptionMap = preParseFinder(payload).queryOptionMap;
	var componentMainType = queryOptionMap.keys()[0];
	if (!componentMainType || componentMainType === "series") return;
	var model = queryReferringComponents(ecModel, componentMainType, queryOptionMap.get(componentMainType), {
		useDefault: false,
		enableAll: false,
		enableNone: false
	}).models[0];
	if (!model) return;
	var view = api.getViewOfComponentModel(model);
	var el;
	view.group.traverse(function(subEl) {
		var tooltipConfig = getECData(subEl).tooltipConfig;
		if (tooltipConfig && tooltipConfig.name === payload.name) {
			el = subEl;
			return true;
		}
	});
	if (el) return {
		componentMainType,
		componentIndex: model.componentIndex,
		el
	};
}
//#endregion
//#region node_modules/echarts/lib/component/tooltip/install.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function install$2(registers) {
	use(install$5);
	registers.registerComponentModel(TooltipModel);
	registers.registerComponentView(TooltipView);
	/**
	* @action
	* @property {string} type
	* @property {number} seriesIndex
	* @property {number} dataIndex
	* @property {number} [x]
	* @property {number} [y]
	*/
	registers.registerAction({
		type: "showTip",
		event: "showTip",
		update: "tooltip:manuallyShowTip"
	}, noop);
	registers.registerAction({
		type: "hideTip",
		event: "hideTip",
		update: "tooltip:manuallyHideTip"
	}, noop);
}
//#endregion
//#region node_modules/echarts/lib/component/legend/LegendModel.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var getDefaultSelectorOptions = function(ecModel, type) {
	if (type === "all") return {
		type: "all",
		title: ecModel.getLocaleModel().get([
			"legend",
			"selector",
			"all"
		])
	};
	else if (type === "inverse") return {
		type: "inverse",
		title: ecModel.getLocaleModel().get([
			"legend",
			"selector",
			"inverse"
		])
	};
};
var LegendModel = function(_super) {
	__extends(LegendModel, _super);
	function LegendModel() {
		var _this = _super !== null && _super.apply(this, arguments) || this;
		_this.type = LegendModel.type;
		_this.layoutMode = {
			type: "box",
			ignoreSize: true
		};
		return _this;
	}
	LegendModel.prototype.init = function(option, parentModel, ecModel) {
		this.mergeDefaultAndTheme(option, ecModel);
		option.selected = option.selected || {};
		this._updateSelector(option);
	};
	LegendModel.prototype.mergeOption = function(option, ecModel) {
		_super.prototype.mergeOption.call(this, option, ecModel);
		this._updateSelector(option);
	};
	LegendModel.prototype._updateSelector = function(option) {
		var selector = option.selector;
		var ecModel = this.ecModel;
		if (selector === true) selector = option.selector = ["all", "inverse"];
		if (isArray(selector)) each$2(selector, function(item, index) {
			isString(item) && (item = { type: item });
			selector[index] = merge(item, getDefaultSelectorOptions(ecModel, item.type));
		});
	};
	LegendModel.prototype.optionUpdated = function() {
		this._updateData(this.ecModel);
		var legendData = this._data;
		if (legendData[0] && this.get("selectedMode") === "single") {
			var hasSelected = false;
			for (var i = 0; i < legendData.length; i++) {
				var name_1 = legendData[i].get("name");
				if (this.isSelected(name_1)) {
					this.select(name_1);
					hasSelected = true;
					break;
				}
			}
			!hasSelected && this.select(legendData[0].get("name"));
		}
	};
	LegendModel.prototype._updateData = function(ecModel) {
		var potentialData = [];
		var availableNames = [];
		ecModel.eachRawSeries(function(seriesModel) {
			var seriesName = seriesModel.name;
			availableNames.push(seriesName);
			var isPotential;
			if (seriesModel.legendVisualProvider) {
				var names = seriesModel.legendVisualProvider.getAllNames();
				if (!ecModel.isSeriesFiltered(seriesModel)) availableNames = availableNames.concat(names);
				if (names.length) potentialData = potentialData.concat(names);
				else isPotential = true;
			} else isPotential = true;
			if (isPotential && isNameSpecified(seriesModel)) potentialData.push(seriesModel.name);
		});
		/**
		* @type {Array.<string>}
		* @private
		*/
		this._availableNames = availableNames;
		var rawData = this.get("data") || potentialData;
		var legendNameMap = createHashMap();
		var legendData = map(rawData, function(dataItem) {
			if (isString(dataItem) || isNumber(dataItem)) dataItem = { name: dataItem };
			if (legendNameMap.get(dataItem.name)) return null;
			legendNameMap.set(dataItem.name, true);
			return new Model(dataItem, this, this.ecModel);
		}, this);
		/**
		* @type {Array.<module:echarts/model/Model>}
		* @private
		*/
		this._data = filter(legendData, function(item) {
			return !!item;
		});
	};
	LegendModel.prototype.getData = function() {
		return this._data;
	};
	LegendModel.prototype.select = function(name) {
		var selected = this.option.selected;
		if (this.get("selectedMode") === "single") {
			var data = this._data;
			each$2(data, function(dataItem) {
				selected[dataItem.get("name")] = false;
			});
		}
		selected[name] = true;
	};
	LegendModel.prototype.unSelect = function(name) {
		if (this.get("selectedMode") !== "single") this.option.selected[name] = false;
	};
	LegendModel.prototype.toggleSelected = function(name) {
		var selected = this.option.selected;
		if (!selected.hasOwnProperty(name)) selected[name] = true;
		this[selected[name] ? "unSelect" : "select"](name);
	};
	LegendModel.prototype.allSelect = function() {
		var data = this._data;
		var selected = this.option.selected;
		each$2(data, function(dataItem) {
			selected[dataItem.get("name", true)] = true;
		});
	};
	LegendModel.prototype.inverseSelect = function() {
		var data = this._data;
		var selected = this.option.selected;
		each$2(data, function(dataItem) {
			var name = dataItem.get("name", true);
			if (!selected.hasOwnProperty(name)) selected[name] = true;
			selected[name] = !selected[name];
		});
	};
	LegendModel.prototype.isSelected = function(name) {
		var selected = this.option.selected;
		return !(selected.hasOwnProperty(name) && !selected[name]) && indexOf(this._availableNames, name) >= 0;
	};
	LegendModel.prototype.getOrient = function() {
		return this.get("orient") === "vertical" ? {
			index: 1,
			name: "vertical"
		} : {
			index: 0,
			name: "horizontal"
		};
	};
	LegendModel.type = "legend.plain";
	LegendModel.dependencies = ["series"];
	LegendModel.defaultOption = {
		z: 4,
		show: true,
		orient: "horizontal",
		left: "center",
		bottom: tokens.size.m,
		align: "auto",
		backgroundColor: tokens.color.transparent,
		borderColor: tokens.color.border,
		borderRadius: 0,
		borderWidth: 0,
		padding: 5,
		itemGap: 8,
		itemWidth: 25,
		itemHeight: 14,
		symbolRotate: "inherit",
		symbolKeepAspect: true,
		inactiveColor: tokens.color.disabled,
		inactiveBorderColor: tokens.color.disabled,
		inactiveBorderWidth: "auto",
		itemStyle: {
			color: "inherit",
			opacity: "inherit",
			borderColor: "inherit",
			borderWidth: "auto",
			borderCap: "inherit",
			borderJoin: "inherit",
			borderDashOffset: "inherit",
			borderMiterLimit: "inherit"
		},
		lineStyle: {
			width: "auto",
			color: "inherit",
			inactiveColor: tokens.color.disabled,
			inactiveWidth: 2,
			opacity: "inherit",
			type: "inherit",
			cap: "inherit",
			join: "inherit",
			dashOffset: "inherit",
			miterLimit: "inherit"
		},
		textStyle: { color: tokens.color.secondary },
		selectedMode: true,
		selector: false,
		selectorLabel: {
			show: true,
			borderRadius: 10,
			padding: [
				3,
				5,
				3,
				5
			],
			fontSize: 12,
			fontFamily: "sans-serif",
			color: tokens.color.tertiary,
			borderWidth: 1,
			borderColor: tokens.color.border
		},
		emphasis: { selectorLabel: {
			show: true,
			color: tokens.color.quaternary
		} },
		selectorPosition: "auto",
		selectorItemGap: 7,
		selectorButtonGap: 10,
		tooltip: { show: false },
		triggerEvent: false
	};
	return LegendModel;
}(ComponentModel);
//#endregion
//#region node_modules/echarts/lib/component/legend/LegendView.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var curry = curry$1;
var each = each$2;
var Group$1 = Group$2;
var LegendView = function(_super) {
	__extends(LegendView, _super);
	function LegendView() {
		var _this = _super !== null && _super.apply(this, arguments) || this;
		_this.type = LegendView.type;
		_this.newlineDisabled = false;
		return _this;
	}
	LegendView.prototype.init = function() {
		this.group.add(this._contentGroup = new Group$1());
		this.group.add(this._selectorGroup = new Group$1());
		this._isFirstRender = true;
	};
	/**
	* @protected
	*/
	LegendView.prototype.getContentGroup = function() {
		return this._contentGroup;
	};
	/**
	* @protected
	*/
	LegendView.prototype.getSelectorGroup = function() {
		return this._selectorGroup;
	};
	/**
	* @override
	*/
	LegendView.prototype.render = function(legendModel, ecModel, api) {
		var isFirstRender = this._isFirstRender;
		this._isFirstRender = false;
		this.resetInner();
		if (!legendModel.get("show", true)) return;
		var itemAlign = legendModel.get("align");
		var orient = legendModel.get("orient");
		if (!itemAlign || itemAlign === "auto") itemAlign = legendModel.get("left") === "right" && orient === "vertical" ? "right" : "left";
		var selector = legendModel.get("selector", true);
		var selectorPosition = legendModel.get("selectorPosition", true);
		if (selector && (!selectorPosition || selectorPosition === "auto")) selectorPosition = orient === "horizontal" ? "end" : "start";
		this.renderInner(itemAlign, legendModel, ecModel, api, selector, orient, selectorPosition);
		var refContainer = createBoxLayoutReference(legendModel, api).refContainer;
		var positionInfo = legendModel.getBoxLayoutParams();
		var padding = legendModel.get("padding");
		var maxSize = getLayoutRect(positionInfo, refContainer, padding);
		var mainRect = this.layoutInner(legendModel, itemAlign, maxSize, isFirstRender, selector, selectorPosition);
		var layoutRect = getLayoutRect(defaults({
			width: mainRect.width,
			height: mainRect.height
		}, positionInfo), refContainer, padding);
		this.group.x = layoutRect.x - mainRect.x;
		this.group.y = layoutRect.y - mainRect.y;
		this.group.markRedraw();
		this.group.add(this._backgroundEl = makeBackground(mainRect, legendModel));
	};
	LegendView.prototype.resetInner = function() {
		this.getContentGroup().removeAll();
		this._backgroundEl && this.group.remove(this._backgroundEl);
		this.getSelectorGroup().removeAll();
	};
	LegendView.prototype.renderInner = function(itemAlign, legendModel, ecModel, api, selector, orient, selectorPosition) {
		var contentGroup = this.getContentGroup();
		var legendDrawnMap = createHashMap();
		var selectMode = legendModel.get("selectedMode");
		var triggerEvent = legendModel.get("triggerEvent");
		var excludeSeriesId = [];
		ecModel.eachRawSeries(function(seriesModel) {
			!seriesModel.get("legendHoverLink") && excludeSeriesId.push(seriesModel.id);
		});
		each(legendModel.getData(), function(legendItemModel, dataIndex) {
			var _this = this;
			var name = legendItemModel.get("name");
			if (!this.newlineDisabled && (name === "" || name === "\n")) {
				var g = new Group$1();
				g.newline = true;
				contentGroup.add(g);
				return;
			}
			var seriesModel = ecModel.getSeriesByName(name)[0];
			if (legendDrawnMap.get(name)) return;
			if (seriesModel) {
				var data = seriesModel.getData();
				var lineVisualStyle = data.getVisual("legendLineStyle") || {};
				var legendIcon = data.getVisual("legendIcon");
				/**
				* `data.getVisual('style')` may be the color from the register
				* in series. For example, for line series,
				*/
				var style = data.getVisual("style");
				var itemGroup = this._createItem(seriesModel, name, dataIndex, legendItemModel, legendModel, itemAlign, lineVisualStyle, style, legendIcon, selectMode, api);
				itemGroup.on("click", curry(dispatchSelectAction, name, null, api, excludeSeriesId)).on("mouseover", curry(dispatchHighlightAction, seriesModel.name, null, api, excludeSeriesId)).on("mouseout", curry(dispatchDownplayAction, seriesModel.name, null, api, excludeSeriesId));
				if (ecModel.ssr) itemGroup.eachChild(function(child) {
					var ecData = getECData(child);
					ecData.seriesIndex = seriesModel.seriesIndex;
					ecData.dataIndex = dataIndex;
					ecData.ssrType = "legend";
				});
				if (triggerEvent) itemGroup.eachChild(function(child) {
					_this.packEventData(child, legendModel, seriesModel, dataIndex, name);
				});
				legendDrawnMap.set(name, true);
			} else ecModel.eachRawSeries(function(seriesModel) {
				var _this = this;
				if (legendDrawnMap.get(name)) return;
				if (seriesModel.legendVisualProvider) {
					var provider = seriesModel.legendVisualProvider;
					if (!provider.containName(name)) return;
					var idx = provider.indexOfName(name);
					var style = provider.getItemVisual(idx, "style");
					var legendIcon = provider.getItemVisual(idx, "legendIcon");
					var colorArr = parse(style.fill);
					if (colorArr && colorArr[3] === 0) {
						colorArr[3] = .2;
						style = extend(extend({}, style), { fill: stringify(colorArr, "rgba") });
					}
					var itemGroup = this._createItem(seriesModel, name, dataIndex, legendItemModel, legendModel, itemAlign, {}, style, legendIcon, selectMode, api);
					itemGroup.on("click", curry(dispatchSelectAction, null, name, api, excludeSeriesId)).on("mouseover", curry(dispatchHighlightAction, null, name, api, excludeSeriesId)).on("mouseout", curry(dispatchDownplayAction, null, name, api, excludeSeriesId));
					if (ecModel.ssr) itemGroup.eachChild(function(child) {
						var ecData = getECData(child);
						ecData.seriesIndex = seriesModel.seriesIndex;
						ecData.dataIndex = dataIndex;
						ecData.ssrType = "legend";
					});
					if (triggerEvent) itemGroup.eachChild(function(child) {
						_this.packEventData(child, legendModel, seriesModel, dataIndex, name);
					});
					legendDrawnMap.set(name, true);
				}
			}, this);
		}, this);
		if (selector) this._createSelector(selector, legendModel, api, orient, selectorPosition);
	};
	LegendView.prototype.packEventData = function(el, legendModel, seriesModel, dataIndex, name) {
		var eventData = {
			componentType: "legend",
			componentIndex: legendModel.componentIndex,
			dataIndex,
			value: name,
			seriesIndex: seriesModel.seriesIndex
		};
		getECData(el).eventData = eventData;
	};
	LegendView.prototype._createSelector = function(selector, legendModel, api, orient, selectorPosition) {
		var selectorGroup = this.getSelectorGroup();
		each(selector, function createSelectorButton(selectorItem) {
			var type = selectorItem.type;
			var labelText = new ZRText({
				style: {
					x: 0,
					y: 0,
					align: "center",
					verticalAlign: "middle"
				},
				onclick: function() {
					api.dispatchAction({
						type: type === "all" ? "legendAllSelect" : "legendInverseSelect",
						legendId: legendModel.id
					});
				}
			});
			selectorGroup.add(labelText);
			var labelModel = legendModel.getModel("selectorLabel");
			var emphasisLabelModel = legendModel.getModel(["emphasis", "selectorLabel"]);
			setLabelStyle(labelText, {
				normal: labelModel,
				emphasis: emphasisLabelModel
			}, { defaultText: selectorItem.title });
			enableHoverEmphasis(labelText);
		});
	};
	LegendView.prototype._createItem = function(seriesModel, name, dataIndex, legendItemModel, legendModel, itemAlign, lineVisualStyle, itemVisualStyle, legendIcon, selectMode, api) {
		var drawType = seriesModel.visualDrawType;
		var itemWidth = legendModel.get("itemWidth");
		var itemHeight = legendModel.get("itemHeight");
		var isSelected = legendModel.isSelected(name);
		var iconRotate = legendItemModel.get("symbolRotate");
		var symbolKeepAspect = legendItemModel.get("symbolKeepAspect");
		var legendIconType = legendItemModel.get("icon");
		legendIcon = legendIconType || legendIcon || "roundRect";
		var style = getLegendStyle(legendIcon, legendItemModel, lineVisualStyle, itemVisualStyle, drawType, isSelected, api);
		var itemGroup = new Group$1();
		var textStyleModel = legendItemModel.getModel("textStyle");
		if (isFunction(seriesModel.getLegendIcon) && (!legendIconType || legendIconType === "inherit")) itemGroup.add(seriesModel.getLegendIcon({
			itemWidth,
			itemHeight,
			icon: legendIcon,
			iconRotate,
			itemStyle: style.itemStyle,
			lineStyle: style.lineStyle,
			symbolKeepAspect
		}));
		else {
			var rotate = legendIconType === "inherit" && seriesModel.getData().getVisual("symbol") ? iconRotate === "inherit" ? seriesModel.getData().getVisual("symbolRotate") : iconRotate : 0;
			itemGroup.add(getDefaultLegendIcon({
				itemWidth,
				itemHeight,
				icon: legendIcon,
				iconRotate: rotate,
				itemStyle: style.itemStyle,
				lineStyle: style.lineStyle,
				symbolKeepAspect
			}));
		}
		var textX = itemAlign === "left" ? itemWidth + 5 : -5;
		var textAlign = itemAlign;
		var formatter = legendModel.get("formatter");
		var content = name;
		if (isString(formatter) && formatter) content = formatter.replace("{name}", name != null ? name : "");
		else if (isFunction(formatter)) content = formatter(name);
		var textColor = isSelected ? textStyleModel.getTextColor() : legendItemModel.get("inactiveColor");
		itemGroup.add(new ZRText({ style: createTextStyle(textStyleModel, {
			text: content,
			x: textX,
			y: itemHeight / 2,
			fill: textColor,
			align: textAlign,
			verticalAlign: "middle"
		}, { inheritColor: textColor }) }));
		var hitRect = new Rect({
			shape: itemGroup.getBoundingRect(),
			style: { fill: "transparent" }
		});
		var tooltipModel = legendItemModel.getModel("tooltip");
		if (tooltipModel.get("show")) setTooltipConfig({
			el: hitRect,
			componentModel: legendModel,
			itemName: name,
			itemTooltipOption: tooltipModel.option
		});
		itemGroup.add(hitRect);
		itemGroup.eachChild(function(child) {
			child.silent = true;
		});
		hitRect.silent = !selectMode;
		this.getContentGroup().add(itemGroup);
		enableHoverEmphasis(itemGroup);
		itemGroup.__legendDataIndex = dataIndex;
		return itemGroup;
	};
	LegendView.prototype.layoutInner = function(legendModel, itemAlign, maxSize, isFirstRender, selector, selectorPosition) {
		var contentGroup = this.getContentGroup();
		var selectorGroup = this.getSelectorGroup();
		box(legendModel.get("orient"), contentGroup, legendModel.get("itemGap"), maxSize.width, maxSize.height);
		var contentRect = contentGroup.getBoundingRect();
		var contentPos = [-contentRect.x, -contentRect.y];
		selectorGroup.markRedraw();
		contentGroup.markRedraw();
		if (selector) {
			box("horizontal", selectorGroup, legendModel.get("selectorItemGap", true));
			var selectorRect = selectorGroup.getBoundingRect();
			var selectorPos = [-selectorRect.x, -selectorRect.y];
			var selectorButtonGap = legendModel.get("selectorButtonGap", true);
			var orientIdx = legendModel.getOrient().index;
			var wh = orientIdx === 0 ? "width" : "height";
			var hw = orientIdx === 0 ? "height" : "width";
			var yx = orientIdx === 0 ? "y" : "x";
			if (selectorPosition === "end") selectorPos[orientIdx] += contentRect[wh] + selectorButtonGap;
			else contentPos[orientIdx] += selectorRect[wh] + selectorButtonGap;
			selectorPos[1 - orientIdx] += contentRect[hw] / 2 - selectorRect[hw] / 2;
			selectorGroup.x = selectorPos[0];
			selectorGroup.y = selectorPos[1];
			contentGroup.x = contentPos[0];
			contentGroup.y = contentPos[1];
			var mainRect = {
				x: 0,
				y: 0
			};
			mainRect[wh] = contentRect[wh] + selectorButtonGap + selectorRect[wh];
			mainRect[hw] = Math.max(contentRect[hw], selectorRect[hw]);
			mainRect[yx] = Math.min(0, selectorRect[yx] + selectorPos[1 - orientIdx]);
			return mainRect;
		} else {
			contentGroup.x = contentPos[0];
			contentGroup.y = contentPos[1];
			return this.group.getBoundingRect();
		}
	};
	/**
	* @protected
	*/
	LegendView.prototype.remove = function() {
		this.getContentGroup().removeAll();
		this._isFirstRender = true;
	};
	LegendView.type = "legend.plain";
	return LegendView;
}(ComponentView);
function getLegendStyle(iconType, legendItemModel, lineVisualStyle, itemVisualStyle, drawType, isSelected, api) {
	/**
	* Use series style if is inherit;
	* elsewise, use legend style
	*/
	function handleCommonProps(style, visualStyle) {
		if (style.lineWidth === "auto") style.lineWidth = visualStyle.lineWidth > 0 ? 2 : 0;
		each(style, function(propVal, propName) {
			style[propName] === "inherit" && (style[propName] = visualStyle[propName]);
		});
	}
	var itemStyleModel = legendItemModel.getModel("itemStyle");
	var itemStyle = itemStyleModel.getItemStyle();
	var iconBrushType = iconType.lastIndexOf("empty", 0) === 0 ? "fill" : "stroke";
	var decalStyle = itemStyleModel.getShallow("decal");
	itemStyle.decal = !decalStyle || decalStyle === "inherit" ? itemVisualStyle.decal : createOrUpdatePatternFromDecal(decalStyle, api);
	if (itemStyle.fill === "inherit")
 /**
	* Series with visualDrawType as 'stroke' should have
	* series stroke as legend fill
	*/
	itemStyle.fill = itemVisualStyle[drawType];
	if (itemStyle.stroke === "inherit")
 /**
	* icon type with "emptyXXX" should use fill color
	* in visual style
	*/
	itemStyle.stroke = itemVisualStyle[iconBrushType];
	if (itemStyle.opacity === "inherit")
 /**
	* Use lineStyle.opacity if drawType is stroke
	*/
	itemStyle.opacity = (drawType === "fill" ? itemVisualStyle : lineVisualStyle).opacity;
	handleCommonProps(itemStyle, itemVisualStyle);
	var legendLineModel = legendItemModel.getModel("lineStyle");
	var lineStyle = legendLineModel.getLineStyle();
	handleCommonProps(lineStyle, lineVisualStyle);
	itemStyle.fill === "auto" && (itemStyle.fill = itemVisualStyle.fill);
	itemStyle.stroke === "auto" && (itemStyle.stroke = itemVisualStyle.fill);
	lineStyle.stroke === "auto" && (lineStyle.stroke = itemVisualStyle.fill);
	if (!isSelected) {
		var borderWidth = legendItemModel.get("inactiveBorderWidth");
		/**
		* Since stroke is set to be inactiveBorderColor, it may occur that
		* there is no border in series but border in legend, so we need to
		* use border only when series has border if is set to be auto
		*/
		var visualHasBorder = itemStyle[iconBrushType];
		itemStyle.lineWidth = borderWidth === "auto" ? itemVisualStyle.lineWidth > 0 && visualHasBorder ? 2 : 0 : itemStyle.lineWidth;
		itemStyle.fill = legendItemModel.get("inactiveColor");
		itemStyle.stroke = legendItemModel.get("inactiveBorderColor");
		lineStyle.stroke = legendLineModel.get("inactiveColor");
		lineStyle.lineWidth = legendLineModel.get("inactiveWidth");
	}
	return {
		itemStyle,
		lineStyle
	};
}
function getDefaultLegendIcon(opt) {
	var symboType = opt.icon || "roundRect";
	var icon = createSymbol(symboType, 0, 0, opt.itemWidth, opt.itemHeight, opt.itemStyle.fill, opt.symbolKeepAspect);
	icon.setStyle(opt.itemStyle);
	icon.rotation = (opt.iconRotate || 0) * Math.PI / 180;
	icon.setOrigin([opt.itemWidth / 2, opt.itemHeight / 2]);
	if (symboType.indexOf("empty") > -1) {
		icon.style.stroke = icon.style.fill;
		icon.style.fill = tokens.color.neutral00;
		icon.style.lineWidth = 2;
	}
	return icon;
}
function dispatchSelectAction(seriesName, dataName, api, excludeSeriesId) {
	dispatchDownplayAction(seriesName, dataName, api, excludeSeriesId);
	api.dispatchAction({
		type: "legendToggleSelect",
		name: seriesName != null ? seriesName : dataName
	});
	dispatchHighlightAction(seriesName, dataName, api, excludeSeriesId);
}
function dispatchHighlightAction(seriesName, dataName, api, excludeSeriesId) {
	if (!api.usingTHL()) api.dispatchAction({
		type: "highlight",
		seriesName,
		name: dataName,
		excludeSeriesId
	});
}
function dispatchDownplayAction(seriesName, dataName, api, excludeSeriesId) {
	if (!api.usingTHL()) api.dispatchAction({
		type: "downplay",
		seriesName,
		name: dataName,
		excludeSeriesId
	});
}
//#endregion
//#region node_modules/echarts/lib/component/legend/legendAction.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function legendSelectActionHandler(methodName, payload, ecModel) {
	var isAllSelect = methodName === "allSelect" || methodName === "inverseSelect";
	var selectedMap = {};
	var actionLegendIndices = [];
	ecModel.eachComponent({
		mainType: "legend",
		query: payload
	}, function(legendModel) {
		if (isAllSelect) legendModel[methodName]();
		else legendModel[methodName](payload.name);
		makeSelectedMap(legendModel, selectedMap);
		actionLegendIndices.push(legendModel.componentIndex);
	});
	var allSelectedMap = {};
	ecModel.eachComponent("legend", function(legendModel) {
		each$2(selectedMap, function(isSelected, name) {
			legendModel[isSelected ? "select" : "unSelect"](name);
		});
		makeSelectedMap(legendModel, allSelectedMap);
	});
	return isAllSelect ? {
		selected: allSelectedMap,
		legendIndex: actionLegendIndices
	} : {
		name: payload.name,
		selected: allSelectedMap
	};
}
function makeSelectedMap(legendModel, out) {
	var selectedMap = out || {};
	each$2(legendModel.getData(), function(model) {
		var name = model.get("name");
		if (name === "\n" || name === "") return;
		var isItemSelected = legendModel.isSelected(name);
		if (hasOwn(selectedMap, name)) selectedMap[name] = selectedMap[name] && isItemSelected;
		else selectedMap[name] = isItemSelected;
	});
	return selectedMap;
}
function installLegendAction(registers) {
	/**
	* @event legendToggleSelect
	* @type {Object}
	* @property {string} type 'legendToggleSelect'
	* @property {string} [from]
	* @property {string} name Series name or data item name
	*/
	registers.registerAction("legendToggleSelect", "legendselectchanged", curry$1(legendSelectActionHandler, "toggleSelected"));
	registers.registerAction("legendAllSelect", "legendselectall", curry$1(legendSelectActionHandler, "allSelect"));
	registers.registerAction("legendInverseSelect", "legendinverseselect", curry$1(legendSelectActionHandler, "inverseSelect"));
	/**
	* @event legendSelect
	* @type {Object}
	* @property {string} type 'legendSelect'
	* @property {string} name Series name or data item name
	*/
	registers.registerAction("legendSelect", "legendselected", curry$1(legendSelectActionHandler, "select"));
	/**
	* @event legendUnSelect
	* @type {Object}
	* @property {string} type 'legendUnSelect'
	* @property {string} name Series name or data item name
	*/
	registers.registerAction("legendUnSelect", "legendunselected", curry$1(legendSelectActionHandler, "unSelect"));
}
//#endregion
//#region node_modules/echarts/lib/component/legend/legendFilter.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var legendFilterStageHandler = createSimpleOverallStageHandler2(legendFilter);
function legendFilter(ecModel) {
	var legendModels = ecModel.findComponents({ mainType: "legend" });
	if (legendModels && legendModels.length) ecModel.filterSeries(function(series) {
		for (var i = 0; i < legendModels.length; i++) if (!legendModels[i].isSelected(series.name)) return false;
		return true;
	});
}
//#endregion
//#region node_modules/echarts/lib/component/legend/installLegendPlain.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function install$4(registers) {
	registers.registerComponentModel(LegendModel);
	registers.registerComponentView(LegendView);
	registers.registerProcessor(registers.PRIORITY.PROCESSOR.SERIES_FILTER, legendFilterStageHandler);
	registers.registerSubTypeDefaulter("legend", function() {
		return "plain";
	});
	installLegendAction(registers);
}
//#endregion
//#region node_modules/echarts/lib/component/legend/ScrollableLegendModel.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var ScrollableLegendModel = function(_super) {
	__extends(ScrollableLegendModel, _super);
	function ScrollableLegendModel() {
		var _this = _super !== null && _super.apply(this, arguments) || this;
		_this.type = ScrollableLegendModel.type;
		return _this;
	}
	/**
	* @param {number} scrollDataIndex
	*/
	ScrollableLegendModel.prototype.setScrollDataIndex = function(scrollDataIndex) {
		this.option.scrollDataIndex = scrollDataIndex;
	};
	ScrollableLegendModel.prototype.init = function(option, parentModel, ecModel) {
		var inputPositionParams = getLayoutParams(option);
		_super.prototype.init.call(this, option, parentModel, ecModel);
		mergeAndNormalizeLayoutParams(this, option, inputPositionParams);
	};
	/**
	* @override
	*/
	ScrollableLegendModel.prototype.mergeOption = function(option, ecModel) {
		_super.prototype.mergeOption.call(this, option, ecModel);
		mergeAndNormalizeLayoutParams(this, this.option, option);
	};
	ScrollableLegendModel.type = "legend.scroll";
	ScrollableLegendModel.defaultOption = inheritDefaultOption(LegendModel.defaultOption, {
		scrollDataIndex: 0,
		pageButtonItemGap: 5,
		pageButtonGap: null,
		pageButtonPosition: "end",
		pageFormatter: "{current}/{total}",
		pageIcons: {
			horizontal: ["M0,0L12,-10L12,10z", "M0,0L-12,-10L-12,10z"],
			vertical: ["M0,0L20,0L10,-20z", "M0,0L20,0L10,20z"]
		},
		pageIconColor: tokens.color.accent50,
		pageIconInactiveColor: tokens.color.accent10,
		pageIconSize: 15,
		pageTextStyle: { color: tokens.color.tertiary },
		animationDurationUpdate: 800
	});
	return ScrollableLegendModel;
}(LegendModel);
function mergeAndNormalizeLayoutParams(legendModel, target, raw) {
	var orient = legendModel.getOrient();
	var ignoreSize = [1, 1];
	ignoreSize[orient.index] = 0;
	mergeLayoutParam(target, raw, {
		type: "box",
		ignoreSize: !!ignoreSize
	});
}
//#endregion
//#region node_modules/echarts/lib/component/legend/ScrollableLegendView.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* Separate legend and scrollable legend to reduce package size.
*/
var Group = Group$2;
var WH = ["width", "height"];
var XY = ["x", "y"];
var ScrollableLegendView = function(_super) {
	__extends(ScrollableLegendView, _super);
	function ScrollableLegendView() {
		var _this = _super !== null && _super.apply(this, arguments) || this;
		_this.type = ScrollableLegendView.type;
		_this.newlineDisabled = true;
		_this._currentIndex = 0;
		return _this;
	}
	ScrollableLegendView.prototype.init = function() {
		_super.prototype.init.call(this);
		this.group.add(this._containerGroup = new Group());
		this._containerGroup.add(this.getContentGroup());
		this.group.add(this._controllerGroup = new Group());
	};
	/**
	* @override
	*/
	ScrollableLegendView.prototype.resetInner = function() {
		_super.prototype.resetInner.call(this);
		this._controllerGroup.removeAll();
		this._containerGroup.removeClipPath();
		this._containerGroup.__rectSize = null;
	};
	/**
	* @override
	*/
	ScrollableLegendView.prototype.renderInner = function(itemAlign, legendModel, ecModel, api, selector, orient, selectorPosition) {
		var self = this;
		_super.prototype.renderInner.call(this, itemAlign, legendModel, ecModel, api, selector, orient, selectorPosition);
		var controllerGroup = this._controllerGroup;
		var pageIconSize = legendModel.get("pageIconSize", true);
		var pageIconSizeArr = isArray(pageIconSize) ? pageIconSize : [pageIconSize, pageIconSize];
		createPageButton("pagePrev", 0);
		var pageTextStyleModel = legendModel.getModel("pageTextStyle");
		controllerGroup.add(new ZRText({
			name: "pageText",
			style: {
				text: "xx/xx",
				fill: pageTextStyleModel.getTextColor(),
				font: pageTextStyleModel.getFont(),
				verticalAlign: "middle",
				align: "center"
			},
			silent: true
		}));
		createPageButton("pageNext", 1);
		function createPageButton(name, iconIdx) {
			var pageDataIndexName = name + "DataIndex";
			var icon = createIcon(legendModel.get("pageIcons", true)[legendModel.getOrient().name][iconIdx], { onclick: bind$1(self._pageGo, self, pageDataIndexName, legendModel, api) }, {
				x: -pageIconSizeArr[0] / 2,
				y: -pageIconSizeArr[1] / 2,
				width: pageIconSizeArr[0],
				height: pageIconSizeArr[1]
			});
			icon.name = name;
			controllerGroup.add(icon);
		}
	};
	/**
	* @override
	*/
	ScrollableLegendView.prototype.layoutInner = function(legendModel, itemAlign, maxSize, isFirstRender, selector, selectorPosition) {
		var selectorGroup = this.getSelectorGroup();
		var orientIdx = legendModel.getOrient().index;
		var wh = WH[orientIdx];
		var xy = XY[orientIdx];
		var hw = WH[1 - orientIdx];
		var yx = XY[1 - orientIdx];
		selector && box("horizontal", selectorGroup, legendModel.get("selectorItemGap", true));
		var selectorButtonGap = legendModel.get("selectorButtonGap", true);
		var selectorRect = selectorGroup.getBoundingRect();
		var selectorPos = [-selectorRect.x, -selectorRect.y];
		var processMaxSize = clone$1(maxSize);
		selector && (processMaxSize[wh] = maxSize[wh] - selectorRect[wh] - selectorButtonGap);
		var mainRect = this._layoutContentAndController(legendModel, isFirstRender, processMaxSize, orientIdx, wh, hw, yx, xy);
		if (selector) {
			if (selectorPosition === "end") selectorPos[orientIdx] += mainRect[wh] + selectorButtonGap;
			else {
				var offset = selectorRect[wh] + selectorButtonGap;
				selectorPos[orientIdx] -= offset;
				mainRect[xy] -= offset;
			}
			mainRect[wh] += selectorRect[wh] + selectorButtonGap;
			selectorPos[1 - orientIdx] += mainRect[yx] + mainRect[hw] / 2 - selectorRect[hw] / 2;
			mainRect[hw] = Math.max(mainRect[hw], selectorRect[hw]);
			mainRect[yx] = Math.min(mainRect[yx], selectorRect[yx] + selectorPos[1 - orientIdx]);
			selectorGroup.x = selectorPos[0];
			selectorGroup.y = selectorPos[1];
			selectorGroup.markRedraw();
		}
		return mainRect;
	};
	ScrollableLegendView.prototype._layoutContentAndController = function(legendModel, isFirstRender, maxSize, orientIdx, wh, hw, yx, xy) {
		var contentGroup = this.getContentGroup();
		var containerGroup = this._containerGroup;
		var controllerGroup = this._controllerGroup;
		box(legendModel.get("orient"), contentGroup, legendModel.get("itemGap"), !orientIdx ? null : maxSize.width, orientIdx ? null : maxSize.height);
		box("horizontal", controllerGroup, legendModel.get("pageButtonItemGap", true));
		var contentRect = contentGroup.getBoundingRect();
		var controllerRect = controllerGroup.getBoundingRect();
		var showController = this._showController = contentRect[wh] > maxSize[wh];
		var contentPos = [-contentRect.x, -contentRect.y];
		if (!isFirstRender) contentPos[orientIdx] = contentGroup[xy];
		var containerPos = [0, 0];
		var controllerPos = [-controllerRect.x, -controllerRect.y];
		var pageButtonGap = retrieve2(legendModel.get("pageButtonGap", true), legendModel.get("itemGap", true));
		if (showController) {
			if (legendModel.get("pageButtonPosition", true) === "end") controllerPos[orientIdx] += maxSize[wh] - controllerRect[wh];
			else containerPos[orientIdx] += controllerRect[wh] + pageButtonGap;
		}
		controllerPos[1 - orientIdx] += contentRect[hw] / 2 - controllerRect[hw] / 2;
		contentGroup.setPosition(contentPos);
		containerGroup.setPosition(containerPos);
		controllerGroup.setPosition(controllerPos);
		var mainRect = {
			x: 0,
			y: 0
		};
		mainRect[wh] = showController ? maxSize[wh] : contentRect[wh];
		mainRect[hw] = Math.max(contentRect[hw], controllerRect[hw]);
		mainRect[yx] = Math.min(0, controllerRect[yx] + controllerPos[1 - orientIdx]);
		containerGroup.__rectSize = maxSize[wh];
		if (showController) {
			var clipShape = {
				x: 0,
				y: 0
			};
			clipShape[wh] = Math.max(maxSize[wh] - controllerRect[wh] - pageButtonGap, 0);
			clipShape[hw] = mainRect[hw];
			containerGroup.setClipPath(new Rect({ shape: clipShape }));
			containerGroup.__rectSize = clipShape[wh];
		} else controllerGroup.eachChild(function(child) {
			child.attr({
				invisible: true,
				silent: true
			});
		});
		var pageInfo = this._getPageInfo(legendModel);
		pageInfo.pageIndex != null && updateProps$1(contentGroup, {
			x: pageInfo.contentPosition[0],
			y: pageInfo.contentPosition[1]
		}, showController ? legendModel : null);
		this._updatePageInfoView(legendModel, pageInfo);
		return mainRect;
	};
	ScrollableLegendView.prototype._pageGo = function(to, legendModel, api) {
		var scrollDataIndex = this._getPageInfo(legendModel)[to];
		scrollDataIndex != null && api.dispatchAction({
			type: "legendScroll",
			scrollDataIndex,
			legendId: legendModel.id
		});
	};
	ScrollableLegendView.prototype._updatePageInfoView = function(legendModel, pageInfo) {
		var controllerGroup = this._controllerGroup;
		each$2(["pagePrev", "pageNext"], function(name) {
			var canJump = pageInfo[name + "DataIndex"] != null;
			var icon = controllerGroup.childOfName(name);
			if (icon) {
				icon.setStyle("fill", canJump ? legendModel.get("pageIconColor", true) : legendModel.get("pageIconInactiveColor", true));
				icon.cursor = canJump ? "pointer" : "default";
			}
		});
		var pageText = controllerGroup.childOfName("pageText");
		var pageFormatter = legendModel.get("pageFormatter");
		var pageIndex = pageInfo.pageIndex;
		var current = pageIndex != null ? pageIndex + 1 : 0;
		var total = pageInfo.pageCount;
		pageText && pageFormatter && pageText.setStyle("text", isString(pageFormatter) ? pageFormatter.replace("{current}", current == null ? "" : current + "").replace("{total}", total == null ? "" : total + "") : pageFormatter({
			current,
			total
		}));
	};
	/**
	*  contentPosition: Array.<number>, null when data item not found.
	*  pageIndex: number, null when data item not found.
	*  pageCount: number, always be a number, can be 0.
	*  pagePrevDataIndex: number, null when no previous page.
	*  pageNextDataIndex: number, null when no next page.
	* }
	*/
	ScrollableLegendView.prototype._getPageInfo = function(legendModel) {
		var scrollDataIndex = legendModel.get("scrollDataIndex", true);
		var contentGroup = this.getContentGroup();
		var containerRectSize = this._containerGroup.__rectSize;
		var orientIdx = legendModel.getOrient().index;
		var wh = WH[orientIdx];
		var xy = XY[orientIdx];
		var targetItemIndex = this._findTargetItemIndex(scrollDataIndex);
		var children = contentGroup.children();
		var targetItem = children[targetItemIndex];
		var itemCount = children.length;
		var pCount = !itemCount ? 0 : 1;
		var result = {
			contentPosition: [contentGroup.x, contentGroup.y],
			pageCount: pCount,
			pageIndex: pCount - 1,
			pagePrevDataIndex: null,
			pageNextDataIndex: null
		};
		if (!targetItem) return result;
		var targetItemInfo = getItemInfo(targetItem);
		result.contentPosition[orientIdx] = -targetItemInfo.s;
		for (var i = targetItemIndex + 1, winStartItemInfo = targetItemInfo, winEndItemInfo = targetItemInfo, currItemInfo = null; i <= itemCount; ++i) {
			currItemInfo = getItemInfo(children[i]);
			if (!currItemInfo && winEndItemInfo.e > winStartItemInfo.s + containerRectSize || currItemInfo && !intersect(currItemInfo, winStartItemInfo.s)) {
				if (winEndItemInfo.i > winStartItemInfo.i) winStartItemInfo = winEndItemInfo;
				else winStartItemInfo = currItemInfo;
				if (winStartItemInfo) {
					if (result.pageNextDataIndex == null) result.pageNextDataIndex = winStartItemInfo.i;
					++result.pageCount;
				}
			}
			winEndItemInfo = currItemInfo;
		}
		for (var i = targetItemIndex - 1, winStartItemInfo = targetItemInfo, winEndItemInfo = targetItemInfo, currItemInfo = null; i >= -1; --i) {
			currItemInfo = getItemInfo(children[i]);
			if ((!currItemInfo || !intersect(winEndItemInfo, currItemInfo.s)) && winStartItemInfo.i < winEndItemInfo.i) {
				winEndItemInfo = winStartItemInfo;
				if (result.pagePrevDataIndex == null) result.pagePrevDataIndex = winStartItemInfo.i;
				++result.pageCount;
				++result.pageIndex;
			}
			winStartItemInfo = currItemInfo;
		}
		return result;
		function getItemInfo(el) {
			if (el) {
				var itemRect = el.getBoundingRect();
				var start = itemRect[xy] + el[xy];
				return {
					s: start,
					e: start + itemRect[wh],
					i: el.__legendDataIndex
				};
			}
		}
		function intersect(itemInfo, winStart) {
			return itemInfo.e >= winStart && itemInfo.s <= winStart + containerRectSize;
		}
	};
	ScrollableLegendView.prototype._findTargetItemIndex = function(targetDataIndex) {
		if (!this._showController) return 0;
		var index;
		var contentGroup = this.getContentGroup();
		var defaultIndex;
		contentGroup.eachChild(function(child, idx) {
			var legendDataIdx = child.__legendDataIndex;
			if (defaultIndex == null && legendDataIdx != null) defaultIndex = idx;
			if (legendDataIdx === targetDataIndex) index = idx;
		});
		return index != null ? index : defaultIndex;
	};
	ScrollableLegendView.type = "legend.scroll";
	return ScrollableLegendView;
}(LegendView);
//#endregion
//#region node_modules/echarts/lib/component/legend/scrollableLegendAction.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function installScrollableLegendAction(registers) {
	/**
	* @event legendScroll
	* @type {Object}
	* @property {string} type 'legendScroll'
	* @property {string} scrollDataIndex
	*/
	registers.registerAction("legendScroll", "legendscroll", function(payload, ecModel) {
		var scrollDataIndex = payload.scrollDataIndex;
		scrollDataIndex != null && ecModel.eachComponent({
			mainType: "legend",
			subType: "scroll",
			query: payload
		}, function(legendModel) {
			legendModel.setScrollDataIndex(scrollDataIndex);
		});
	});
}
//#endregion
//#region node_modules/echarts/lib/component/legend/installLegendScroll.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function install$3(registers) {
	use(install$4);
	registers.registerComponentModel(ScrollableLegendModel);
	registers.registerComponentView(ScrollableLegendView);
	installScrollableLegendAction(registers);
}
//#endregion
//#region node_modules/echarts/lib/component/legend/install.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function install$1(registers) {
	use(install$4);
	use(install$3);
}
//#endregion
export { install as GridComponent, install$1 as LegendComponent, install$2 as TooltipComponent };
