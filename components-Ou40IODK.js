import { B as BoundingRect, _ as __extends, m as mixin, n as defaults, v as merge, e as each$1, g as map, h as filter, f as invert, c as applyTransform, T as retrieve3, S as retrieve, t as isObject, p as indexOf, Q as keys, o as extend, u as isString, U as retrieve2, s as isFunction, i as identity, V as rotate, d as mul, F as isNumber, l as curry, k as clone$1, r as isArray, M as createHashMap, j as bind$1, W as translate, X as getBoundingRect, Y as create, z as env, $ as isDom, a0 as trim, a1 as noop } from "./Image-DY6RhQFr.js";
import { b3 as OrientedBoundingRect, ae as ComponentModel, a$ as SINGLE_REFERRING, b4 as fetchLayoutMode, b5 as getLayoutParams, b6 as mergeLayoutParam, z as round, n as getPrecisionSafe, aD as warn, f as getLayoutRect, G as Group, Z as ZRText, c as createTextStyle, b7 as setTooltipConfig, d as getECData, L as Line, b8 as subPixelOptimizeLine, an as normalizeSymbolOffset, a as createSymbol, y as remRadian, M as Model, p as isRadianAroundZero, K as Rect, b9 as makeInner, ba as groupTransition, bb as graphic, T as createIcon, bc as createOrUpdate, bd as clear, a3 as updateProps$1, be as applyTransform$1, aa as normalizeCssArray, aw as queryDataIndex, ab as toCamelCase, bf as transformLocalCoord, au as convertToColorString, bg as getPaddingFromTooltipModel, bh as throwError, bi as getTooltipRenderMode, bj as createTooltipMarkup, bk as TooltipMarkupStyleCreator, bl as normalizeTooltipFormatResult, bm as buildTooltipMarkup, a6 as encodeHTML, A as format, a8 as formatTpl, bn as parsePercent, bo as preParseFinder, bp as queryReferringComponents } from "./barGrid-B8918HIn.js";
import { A as AxisModelCommonMixin, O as OrdinalMeta, a as Axis, I as IntervalScale, H as getScaleExtent, J as increaseInterval, K as isValueNice, L as estimateLabelUnionRect, c as createScaleByModel, M as getDataDimensionsOnAxis, N as isIntervalOrLogScale, n as niceScaleExtent, Q as ifAxisCrossZero, R as shouldShowAllLabels, C as ComponentView, S as stop, T as getAxisRawValue, E as use, U as normalizeEvent, V as findEventDispatcher } from "./Axis-D1Ml6vLP.js";
function prepareLayoutList(input) {
  var list = [];
  for (var i = 0; i < input.length; i++) {
    var rawItem = input[i];
    if (rawItem.defaultAttr.ignore) {
      continue;
    }
    var label = rawItem.label;
    var transform = label.getComputedTransform();
    var localRect = label.getBoundingRect();
    var isAxisAligned = !transform || transform[1] < 1e-5 && transform[2] < 1e-5;
    var minMargin = label.style.margin || 0;
    var globalRect = localRect.clone();
    globalRect.applyTransform(transform);
    globalRect.x -= minMargin / 2;
    globalRect.y -= minMargin / 2;
    globalRect.width += minMargin;
    globalRect.height += minMargin;
    var obb = isAxisAligned ? new OrientedBoundingRect(localRect, transform) : null;
    list.push({
      label,
      labelLine: rawItem.labelLine,
      rect: globalRect,
      localRect,
      obb,
      priority: rawItem.priority,
      defaultAttr: rawItem.defaultAttr,
      layoutOption: rawItem.computedLayoutOption,
      axisAligned: isAxisAligned,
      transform
    });
  }
  return list;
}
function hideOverlap(labelList) {
  var displayedLabels = [];
  labelList.sort(function(a, b) {
    return b.priority - a.priority;
  });
  var globalRect = new BoundingRect(0, 0, 0, 0);
  function hideEl(el) {
    if (!el.ignore) {
      var emphasisState = el.ensureState("emphasis");
      if (emphasisState.ignore == null) {
        emphasisState.ignore = false;
      }
    }
    el.ignore = true;
  }
  for (var i = 0; i < labelList.length; i++) {
    var labelItem = labelList[i];
    var isAxisAligned = labelItem.axisAligned;
    var localRect = labelItem.localRect;
    var transform = labelItem.transform;
    var label = labelItem.label;
    var labelLine = labelItem.labelLine;
    globalRect.copy(labelItem.rect);
    globalRect.width -= 0.1;
    globalRect.height -= 0.1;
    globalRect.x += 0.05;
    globalRect.y += 0.05;
    var obb = labelItem.obb;
    var overlapped = false;
    for (var j = 0; j < displayedLabels.length; j++) {
      var existsTextCfg = displayedLabels[j];
      if (!globalRect.intersect(existsTextCfg.rect)) {
        continue;
      }
      if (isAxisAligned && existsTextCfg.axisAligned) {
        overlapped = true;
        break;
      }
      if (!existsTextCfg.obb) {
        existsTextCfg.obb = new OrientedBoundingRect(existsTextCfg.localRect, existsTextCfg.transform);
      }
      if (!obb) {
        obb = new OrientedBoundingRect(localRect, transform);
      }
      if (obb.intersect(existsTextCfg.obb)) {
        overlapped = true;
        break;
      }
    }
    if (overlapped) {
      hideEl(label);
      labelLine && hideEl(labelLine);
    } else {
      label.attr("ignore", labelItem.defaultAttr.ignore);
      labelLine && labelLine.attr("ignore", labelItem.defaultAttr.labelGuideIgnore);
      displayedLabels.push(labelItem);
    }
  }
}
var GridModel = (
  /** @class */
  function(_super) {
    __extends(GridModel2, _super);
    function GridModel2() {
      return _super !== null && _super.apply(this, arguments) || this;
    }
    GridModel2.type = "grid";
    GridModel2.dependencies = ["xAxis", "yAxis"];
    GridModel2.layoutMode = "box";
    GridModel2.defaultOption = {
      show: false,
      // zlevel: 0,
      z: 0,
      left: "10%",
      top: 60,
      right: "10%",
      bottom: 70,
      // If grid size contain label
      containLabel: false,
      // width: {totalWidth} - left - right,
      // height: {totalHeight} - top - bottom,
      backgroundColor: "rgba(0,0,0,0)",
      borderWidth: 1,
      borderColor: "#ccc"
    };
    return GridModel2;
  }(ComponentModel)
);
var CartesianAxisModel = (
  /** @class */
  function(_super) {
    __extends(CartesianAxisModel2, _super);
    function CartesianAxisModel2() {
      return _super !== null && _super.apply(this, arguments) || this;
    }
    CartesianAxisModel2.prototype.getCoordSysModel = function() {
      return this.getReferringComponents("grid", SINGLE_REFERRING).models[0];
    };
    CartesianAxisModel2.type = "cartesian2dAxis";
    return CartesianAxisModel2;
  }(ComponentModel)
);
mixin(CartesianAxisModel, AxisModelCommonMixin);
var defaultOption = {
  show: true,
  // zlevel: 0,
  z: 0,
  // Inverse the axis.
  inverse: false,
  // Axis name displayed.
  name: "",
  // 'start' | 'middle' | 'end'
  nameLocation: "end",
  // By degree. By default auto rotate by nameLocation.
  nameRotate: null,
  nameTruncate: {
    maxWidth: null,
    ellipsis: "...",
    placeholder: "."
  },
  // Use global text style by default.
  nameTextStyle: {},
  // The gap between axisName and axisLine.
  nameGap: 15,
  // Default `false` to support tooltip.
  silent: false,
  // Default `false` to avoid legacy user event listener fail.
  triggerEvent: false,
  tooltip: {
    show: false
  },
  axisPointer: {},
  axisLine: {
    show: true,
    onZero: true,
    onZeroAxisIndex: null,
    lineStyle: {
      color: "#6E7079",
      width: 1,
      type: "solid"
    },
    // The arrow at both ends the the axis.
    symbol: ["none", "none"],
    symbolSize: [10, 15]
  },
  axisTick: {
    show: true,
    // Whether axisTick is inside the grid or outside the grid.
    inside: false,
    // The length of axisTick.
    length: 5,
    lineStyle: {
      width: 1
    }
  },
  axisLabel: {
    show: true,
    // Whether axisLabel is inside the grid or outside the grid.
    inside: false,
    rotate: 0,
    // true | false | null/undefined (auto)
    showMinLabel: null,
    // true | false | null/undefined (auto)
    showMaxLabel: null,
    margin: 8,
    // formatter: null,
    fontSize: 12
  },
  splitLine: {
    show: true,
    showMinLine: true,
    showMaxLine: true,
    lineStyle: {
      color: ["#E0E6F1"],
      width: 1,
      type: "solid"
    }
  },
  splitArea: {
    show: false,
    areaStyle: {
      color: ["rgba(250,250,250,0.2)", "rgba(210,219,238,0.2)"]
    }
  }
};
var categoryAxis = merge({
  // The gap at both ends of the axis. For categoryAxis, boolean.
  boundaryGap: true,
  // Set false to faster category collection.
  deduplication: null,
  // splitArea: {
  // show: false
  // },
  splitLine: {
    show: false
  },
  axisTick: {
    // If tick is align with label when boundaryGap is true
    alignWithLabel: false,
    interval: "auto"
  },
  axisLabel: {
    interval: "auto"
  }
}, defaultOption);
var valueAxis = merge({
  boundaryGap: [0, 0],
  axisLine: {
    // Not shown when other axis is categoryAxis in cartesian
    show: "auto"
  },
  axisTick: {
    // Not shown when other axis is categoryAxis in cartesian
    show: "auto"
  },
  // TODO
  // min/max: [30, datamin, 60] or [20, datamin] or [datamin, 60]
  splitNumber: 5,
  minorTick: {
    // Minor tick, not available for cateogry axis.
    show: false,
    // Split number of minor ticks. The value should be in range of (0, 100)
    splitNumber: 5,
    // Length of minor tick
    length: 3,
    // Line style
    lineStyle: {
      // Default to be same with axisTick
    }
  },
  minorSplitLine: {
    show: false,
    lineStyle: {
      color: "#F4F7FD",
      width: 1
    }
  }
}, defaultOption);
var timeAxis = merge({
  splitNumber: 6,
  axisLabel: {
    // To eliminate labels that are not nice
    showMinLabel: false,
    showMaxLabel: false,
    rich: {
      primary: {
        fontWeight: "bold"
      }
    }
  },
  splitLine: {
    show: false
  }
}, valueAxis);
var logAxis = defaults({
  logBase: 10
}, valueAxis);
const axisDefault = {
  category: categoryAxis,
  value: valueAxis,
  time: timeAxis,
  log: logAxis
};
var AXIS_TYPES = {
  value: 1,
  category: 1,
  time: 1,
  log: 1
};
function axisModelCreator(registers, axisName, BaseAxisModelClass, extraDefaultOption) {
  each$1(AXIS_TYPES, function(v, axisType) {
    var defaultOption2 = merge(merge({}, axisDefault[axisType], true), extraDefaultOption, true);
    var AxisModel = (
      /** @class */
      function(_super) {
        __extends(AxisModel2, _super);
        function AxisModel2() {
          var _this = _super !== null && _super.apply(this, arguments) || this;
          _this.type = axisName + "Axis." + axisType;
          return _this;
        }
        AxisModel2.prototype.mergeDefaultAndTheme = function(option, ecModel) {
          var layoutMode = fetchLayoutMode(this);
          var inputPositionParams = layoutMode ? getLayoutParams(option) : {};
          var themeModel = ecModel.getTheme();
          merge(option, themeModel.get(axisType + "Axis"));
          merge(option, this.getDefaultOption());
          option.type = getAxisType(option);
          if (layoutMode) {
            mergeLayoutParam(option, inputPositionParams, layoutMode);
          }
        };
        AxisModel2.prototype.optionUpdated = function() {
          var thisOption = this.option;
          if (thisOption.type === "category") {
            this.__ordinalMeta = OrdinalMeta.createByAxisModel(this);
          }
        };
        AxisModel2.prototype.getCategories = function(rawData) {
          var option = this.option;
          if (option.type === "category") {
            if (rawData) {
              return option.data;
            }
            return this.__ordinalMeta.categories;
          }
        };
        AxisModel2.prototype.getOrdinalMeta = function() {
          return this.__ordinalMeta;
        };
        AxisModel2.type = axisName + "Axis." + axisType;
        AxisModel2.defaultOption = defaultOption2;
        return AxisModel2;
      }(BaseAxisModelClass)
    );
    registers.registerComponentModel(AxisModel);
  });
  registers.registerSubTypeDefaulter(axisName + "Axis", getAxisType);
}
function getAxisType(option) {
  return option.type || (option.data ? "category" : "value");
}
var Cartesian = (
  /** @class */
  function() {
    function Cartesian2(name) {
      this.type = "cartesian";
      this._dimList = [];
      this._axes = {};
      this.name = name || "";
    }
    Cartesian2.prototype.getAxis = function(dim) {
      return this._axes[dim];
    };
    Cartesian2.prototype.getAxes = function() {
      return map(this._dimList, function(dim) {
        return this._axes[dim];
      }, this);
    };
    Cartesian2.prototype.getAxesByScale = function(scaleType) {
      scaleType = scaleType.toLowerCase();
      return filter(this.getAxes(), function(axis) {
        return axis.scale.type === scaleType;
      });
    };
    Cartesian2.prototype.addAxis = function(axis) {
      var dim = axis.dim;
      this._axes[dim] = axis;
      this._dimList.push(dim);
    };
    return Cartesian2;
  }()
);
var cartesian2DDimensions = ["x", "y"];
function canCalculateAffineTransform(scale) {
  return scale.type === "interval" || scale.type === "time";
}
var Cartesian2D = (
  /** @class */
  function(_super) {
    __extends(Cartesian2D2, _super);
    function Cartesian2D2() {
      var _this = _super !== null && _super.apply(this, arguments) || this;
      _this.type = "cartesian2d";
      _this.dimensions = cartesian2DDimensions;
      return _this;
    }
    Cartesian2D2.prototype.calcAffineTransform = function() {
      this._transform = this._invTransform = null;
      var xAxisScale = this.getAxis("x").scale;
      var yAxisScale = this.getAxis("y").scale;
      if (!canCalculateAffineTransform(xAxisScale) || !canCalculateAffineTransform(yAxisScale)) {
        return;
      }
      var xScaleExtent = xAxisScale.getExtent();
      var yScaleExtent = yAxisScale.getExtent();
      var start = this.dataToPoint([xScaleExtent[0], yScaleExtent[0]]);
      var end = this.dataToPoint([xScaleExtent[1], yScaleExtent[1]]);
      var xScaleSpan = xScaleExtent[1] - xScaleExtent[0];
      var yScaleSpan = yScaleExtent[1] - yScaleExtent[0];
      if (!xScaleSpan || !yScaleSpan) {
        return;
      }
      var scaleX = (end[0] - start[0]) / xScaleSpan;
      var scaleY = (end[1] - start[1]) / yScaleSpan;
      var translateX = start[0] - xScaleExtent[0] * scaleX;
      var translateY = start[1] - yScaleExtent[0] * scaleY;
      var m = this._transform = [scaleX, 0, 0, scaleY, translateX, translateY];
      this._invTransform = invert([], m);
    };
    Cartesian2D2.prototype.getBaseAxis = function() {
      return this.getAxesByScale("ordinal")[0] || this.getAxesByScale("time")[0] || this.getAxis("x");
    };
    Cartesian2D2.prototype.containPoint = function(point) {
      var axisX = this.getAxis("x");
      var axisY = this.getAxis("y");
      return axisX.contain(axisX.toLocalCoord(point[0])) && axisY.contain(axisY.toLocalCoord(point[1]));
    };
    Cartesian2D2.prototype.containData = function(data) {
      return this.getAxis("x").containData(data[0]) && this.getAxis("y").containData(data[1]);
    };
    Cartesian2D2.prototype.containZone = function(data1, data2) {
      var zoneDiag1 = this.dataToPoint(data1);
      var zoneDiag2 = this.dataToPoint(data2);
      var area = this.getArea();
      var zone = new BoundingRect(zoneDiag1[0], zoneDiag1[1], zoneDiag2[0] - zoneDiag1[0], zoneDiag2[1] - zoneDiag1[1]);
      return area.intersect(zone);
    };
    Cartesian2D2.prototype.dataToPoint = function(data, clamp, out) {
      out = out || [];
      var xVal = data[0];
      var yVal = data[1];
      if (this._transform && xVal != null && isFinite(xVal) && yVal != null && isFinite(yVal)) {
        return applyTransform(out, data, this._transform);
      }
      var xAxis = this.getAxis("x");
      var yAxis = this.getAxis("y");
      out[0] = xAxis.toGlobalCoord(xAxis.dataToCoord(xVal, clamp));
      out[1] = yAxis.toGlobalCoord(yAxis.dataToCoord(yVal, clamp));
      return out;
    };
    Cartesian2D2.prototype.clampData = function(data, out) {
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
    Cartesian2D2.prototype.pointToData = function(point, clamp) {
      var out = [];
      if (this._invTransform) {
        return applyTransform(out, point, this._invTransform);
      }
      var xAxis = this.getAxis("x");
      var yAxis = this.getAxis("y");
      out[0] = xAxis.coordToData(xAxis.toLocalCoord(point[0]), clamp);
      out[1] = yAxis.coordToData(yAxis.toLocalCoord(point[1]), clamp);
      return out;
    };
    Cartesian2D2.prototype.getOtherAxis = function(axis) {
      return this.getAxis(axis.dim === "x" ? "y" : "x");
    };
    Cartesian2D2.prototype.getArea = function(tolerance) {
      tolerance = tolerance || 0;
      var xExtent = this.getAxis("x").getGlobalExtent();
      var yExtent = this.getAxis("y").getGlobalExtent();
      var x = Math.min(xExtent[0], xExtent[1]) - tolerance;
      var y = Math.min(yExtent[0], yExtent[1]) - tolerance;
      var width = Math.max(xExtent[0], xExtent[1]) - x + tolerance;
      var height = Math.max(yExtent[0], yExtent[1]) - y + tolerance;
      return new BoundingRect(x, y, width, height);
    };
    return Cartesian2D2;
  }(Cartesian)
);
var Axis2D = (
  /** @class */
  function(_super) {
    __extends(Axis2D2, _super);
    function Axis2D2(dim, scale, coordExtent, axisType, position) {
      var _this = _super.call(this, dim, scale, coordExtent) || this;
      _this.index = 0;
      _this.type = axisType || "value";
      _this.position = position || "bottom";
      return _this;
    }
    Axis2D2.prototype.isHorizontal = function() {
      var position = this.position;
      return position === "top" || position === "bottom";
    };
    Axis2D2.prototype.getGlobalExtent = function(asc) {
      var ret = this.getExtent();
      ret[0] = this.toGlobalCoord(ret[0]);
      ret[1] = this.toGlobalCoord(ret[1]);
      asc && ret[0] > ret[1] && ret.reverse();
      return ret;
    };
    Axis2D2.prototype.pointToData = function(point, clamp) {
      return this.coordToData(this.toLocalCoord(point[this.dim === "x" ? 0 : 1]), clamp);
    };
    Axis2D2.prototype.setCategorySortInfo = function(info) {
      if (this.type !== "category") {
        return false;
      }
      this.model.option.categorySortInfo = info;
      this.scale.setSortInfo(info);
    };
    return Axis2D2;
  }(Axis)
);
function layout(gridModel, axisModel, opt) {
  opt = opt || {};
  var grid = gridModel.coordinateSystem;
  var axis = axisModel.axis;
  var layout2 = {};
  var otherAxisOnZeroOf = axis.getAxesOnZeroOf()[0];
  var rawAxisPosition = axis.position;
  var axisPosition = otherAxisOnZeroOf ? "onZero" : rawAxisPosition;
  var axisDim = axis.dim;
  var rect = grid.getRect();
  var rectBound = [rect.x, rect.x + rect.width, rect.y, rect.y + rect.height];
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
  layout2.position = [axisDim === "y" ? posBound[idx[axisPosition]] : rectBound[0], axisDim === "x" ? posBound[idx[axisPosition]] : rectBound[3]];
  layout2.rotation = Math.PI / 2 * (axisDim === "x" ? 0 : 1);
  var dirMap = {
    top: -1,
    bottom: 1,
    left: -1,
    right: 1
  };
  layout2.labelDirection = layout2.tickDirection = layout2.nameDirection = dirMap[rawAxisPosition];
  layout2.labelOffset = otherAxisOnZeroOf ? posBound[idx[rawAxisPosition]] - posBound[idx.onZero] : 0;
  if (axisModel.get(["axisTick", "inside"])) {
    layout2.tickDirection = -layout2.tickDirection;
  }
  if (retrieve(opt.labelInside, axisModel.get(["axisLabel", "inside"]))) {
    layout2.labelDirection = -layout2.labelDirection;
  }
  var labelRotate = axisModel.get(["axisLabel", "rotate"]);
  layout2.labelRotate = axisPosition === "top" ? -labelRotate : labelRotate;
  layout2.z2 = 1;
  return layout2;
}
function isCartesian2DSeries(seriesModel) {
  return seriesModel.get("coordinateSystem") === "cartesian2d";
}
function findAxisModels(seriesModel) {
  var axisModelMap = {
    xAxisModel: null,
    yAxisModel: null
  };
  each$1(axisModelMap, function(v, key) {
    var axisType = key.replace(/Model$/, "");
    var axisModel = seriesModel.getReferringComponents(axisType, SINGLE_REFERRING).models[0];
    if (process.env.NODE_ENV !== "production") {
      if (!axisModel) {
        throw new Error(axisType + ' "' + retrieve3(seriesModel.get(axisType + "Index"), seriesModel.get(axisType + "Id"), 0) + '" not found');
      }
    }
    axisModelMap[key] = axisModel;
  });
  return axisModelMap;
}
var mathLog = Math.log;
function alignScaleTicks(scale, axisModel, alignToScale) {
  var intervalScaleProto = IntervalScale.prototype;
  var alignToTicks = intervalScaleProto.getTicks.call(alignToScale);
  var alignToNicedTicks = intervalScaleProto.getTicks.call(alignToScale, true);
  var alignToSplitNumber = alignToTicks.length - 1;
  var alignToInterval = intervalScaleProto.getInterval.call(alignToScale);
  var scaleExtent = getScaleExtent(scale, axisModel);
  var rawExtent = scaleExtent.extent;
  var isMinFixed = scaleExtent.fixMin;
  var isMaxFixed = scaleExtent.fixMax;
  if (scale.type === "log") {
    var logBase = mathLog(scale.base);
    rawExtent = [mathLog(rawExtent[0]) / logBase, mathLog(rawExtent[1]) / logBase];
  }
  scale.setExtent(rawExtent[0], rawExtent[1]);
  scale.calcNiceExtent({
    splitNumber: alignToSplitNumber,
    fixMin: isMinFixed,
    fixMax: isMaxFixed
  });
  var extent = intervalScaleProto.getExtent.call(scale);
  if (isMinFixed) {
    rawExtent[0] = extent[0];
  }
  if (isMaxFixed) {
    rawExtent[1] = extent[1];
  }
  var interval = intervalScaleProto.getInterval.call(scale);
  var min = rawExtent[0];
  var max = rawExtent[1];
  if (isMinFixed && isMaxFixed) {
    interval = (max - min) / alignToSplitNumber;
  } else if (isMinFixed) {
    max = rawExtent[0] + interval * alignToSplitNumber;
    while (max < rawExtent[1] && isFinite(max) && isFinite(rawExtent[1])) {
      interval = increaseInterval(interval);
      max = rawExtent[0] + interval * alignToSplitNumber;
    }
  } else if (isMaxFixed) {
    min = rawExtent[1] - interval * alignToSplitNumber;
    while (min > rawExtent[0] && isFinite(min) && isFinite(rawExtent[0])) {
      interval = increaseInterval(interval);
      min = rawExtent[1] - interval * alignToSplitNumber;
    }
  } else {
    var nicedSplitNumber = scale.getTicks().length - 1;
    if (nicedSplitNumber > alignToSplitNumber) {
      interval = increaseInterval(interval);
    }
    var range = interval * alignToSplitNumber;
    max = Math.ceil(rawExtent[1] / interval) * interval;
    min = round(max - range);
    if (min < 0 && rawExtent[0] >= 0) {
      min = 0;
      max = round(range);
    } else if (max > 0 && rawExtent[1] <= 0) {
      max = 0;
      min = -round(range);
    }
  }
  var t0 = (alignToTicks[0].value - alignToNicedTicks[0].value) / alignToInterval;
  var t1 = (alignToTicks[alignToSplitNumber].value - alignToNicedTicks[alignToSplitNumber].value) / alignToInterval;
  intervalScaleProto.setExtent.call(scale, min + interval * t0, max + interval * t1);
  intervalScaleProto.setInterval.call(scale, interval);
  if (t0 || t1) {
    intervalScaleProto.setNiceExtent.call(scale, min + interval, max - interval);
  }
  if (process.env.NODE_ENV !== "production") {
    var ticks = intervalScaleProto.getTicks.call(scale);
    if (ticks[1] && (!isValueNice(interval) || getPrecisionSafe(ticks[1].value) > getPrecisionSafe(interval))) {
      warn(
        // eslint-disable-next-line
        "The ticks may be not readable when set min: " + axisModel.get("min") + ", max: " + axisModel.get("max") + " and alignTicks: true"
      );
    }
  }
}
var Grid = (
  /** @class */
  function() {
    function Grid2(gridModel, ecModel, api) {
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
    Grid2.prototype.getRect = function() {
      return this._rect;
    };
    Grid2.prototype.update = function(ecModel, api) {
      var axesMap = this._axesMap;
      this._updateScale(ecModel, this.model);
      function updateAxisTicks(axes) {
        var alignTo;
        var axesIndices = keys(axes);
        var len = axesIndices.length;
        if (!len) {
          return;
        }
        var axisNeedsAlign = [];
        for (var i = len - 1; i >= 0; i--) {
          var idx = +axesIndices[i];
          var axis = axes[idx];
          var model = axis.model;
          var scale = axis.scale;
          if (
            // Only value and log axis without interval support alignTicks.
            isIntervalOrLogScale(scale) && model.get("alignTicks") && model.get("interval") == null
          ) {
            axisNeedsAlign.push(axis);
          } else {
            niceScaleExtent(scale, model);
            if (isIntervalOrLogScale(scale)) {
              alignTo = axis;
            }
          }
        }
        if (axisNeedsAlign.length) {
          if (!alignTo) {
            alignTo = axisNeedsAlign.pop();
            niceScaleExtent(alignTo.scale, alignTo.model);
          }
          each$1(axisNeedsAlign, function(axis2) {
            alignScaleTicks(axis2.scale, axis2.model, alignTo.scale);
          });
        }
      }
      updateAxisTicks(axesMap.x);
      updateAxisTicks(axesMap.y);
      var onZeroRecords = {};
      each$1(axesMap.x, function(xAxis) {
        fixAxisOnZero(axesMap, "y", xAxis, onZeroRecords);
      });
      each$1(axesMap.y, function(yAxis) {
        fixAxisOnZero(axesMap, "x", yAxis, onZeroRecords);
      });
      this.resize(this.model, api);
    };
    Grid2.prototype.resize = function(gridModel, api, ignoreContainLabel) {
      var boxLayoutParams = gridModel.getBoxLayoutParams();
      var isContainLabel = !ignoreContainLabel && gridModel.get("containLabel");
      var gridRect = getLayoutRect(boxLayoutParams, {
        width: api.getWidth(),
        height: api.getHeight()
      });
      this._rect = gridRect;
      var axesList = this._axesList;
      adjustAxes();
      if (isContainLabel) {
        each$1(axesList, function(axis) {
          if (!axis.model.get(["axisLabel", "inside"])) {
            var labelUnionRect = estimateLabelUnionRect(axis);
            if (labelUnionRect) {
              var dim = axis.isHorizontal() ? "height" : "width";
              var margin = axis.model.get(["axisLabel", "margin"]);
              gridRect[dim] -= labelUnionRect[dim] + margin;
              if (axis.position === "top") {
                gridRect.y += labelUnionRect.height + margin;
              } else if (axis.position === "left") {
                gridRect.x += labelUnionRect.width + margin;
              }
            }
          }
        });
        adjustAxes();
      }
      each$1(this._coordsList, function(coord) {
        coord.calcAffineTransform();
      });
      function adjustAxes() {
        each$1(axesList, function(axis) {
          var isHorizontal = axis.isHorizontal();
          var extent = isHorizontal ? [0, gridRect.width] : [0, gridRect.height];
          var idx = axis.inverse ? 1 : 0;
          axis.setExtent(extent[idx], extent[1 - idx]);
          updateAxisTransform(axis, isHorizontal ? gridRect.x : gridRect.y);
        });
      }
    };
    Grid2.prototype.getAxis = function(dim, axisIndex) {
      var axesMapOnDim = this._axesMap[dim];
      if (axesMapOnDim != null) {
        return axesMapOnDim[axisIndex || 0];
      }
    };
    Grid2.prototype.getAxes = function() {
      return this._axesList.slice();
    };
    Grid2.prototype.getCartesian = function(xAxisIndex, yAxisIndex) {
      if (xAxisIndex != null && yAxisIndex != null) {
        var key = "x" + xAxisIndex + "y" + yAxisIndex;
        return this._coordsMap[key];
      }
      if (isObject(xAxisIndex)) {
        yAxisIndex = xAxisIndex.yAxisIndex;
        xAxisIndex = xAxisIndex.xAxisIndex;
      }
      for (var i = 0, coordList = this._coordsList; i < coordList.length; i++) {
        if (coordList[i].getAxis("x").index === xAxisIndex || coordList[i].getAxis("y").index === yAxisIndex) {
          return coordList[i];
        }
      }
    };
    Grid2.prototype.getCartesians = function() {
      return this._coordsList.slice();
    };
    Grid2.prototype.convertToPixel = function(ecModel, finder, value) {
      var target = this._findConvertTarget(finder);
      return target.cartesian ? target.cartesian.dataToPoint(value) : target.axis ? target.axis.toGlobalCoord(target.axis.dataToCoord(value)) : null;
    };
    Grid2.prototype.convertFromPixel = function(ecModel, finder, value) {
      var target = this._findConvertTarget(finder);
      return target.cartesian ? target.cartesian.pointToData(value) : target.axis ? target.axis.coordToData(target.axis.toLocalCoord(value)) : null;
    };
    Grid2.prototype._findConvertTarget = function(finder) {
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
      } else if (xAxisModel && yAxisModel) {
        cartesian = this.getCartesian(xAxisModel.componentIndex, yAxisModel.componentIndex);
      } else if (xAxisModel) {
        axis = this.getAxis("x", xAxisModel.componentIndex);
      } else if (yAxisModel) {
        axis = this.getAxis("y", yAxisModel.componentIndex);
      } else if (gridModel) {
        var grid = gridModel.coordinateSystem;
        if (grid === this) {
          cartesian = this._coordsList[0];
        }
      }
      return {
        cartesian,
        axis
      };
    };
    Grid2.prototype.containPoint = function(point) {
      var coord = this._coordsList[0];
      if (coord) {
        return coord.containPoint(point);
      }
    };
    Grid2.prototype._initCartesian = function(gridModel, ecModel, api) {
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
      each$1(axesMap.x, function(xAxis, xAxisIndex) {
        each$1(axesMap.y, function(yAxis, yAxisIndex) {
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
      function createAxisCreator(dimName) {
        return function(axisModel, idx) {
          if (!isAxisUsedInTheGrid(axisModel, gridModel)) {
            return;
          }
          var axisPosition = axisModel.get("position");
          if (dimName === "x") {
            if (axisPosition !== "top" && axisPosition !== "bottom") {
              axisPosition = axisPositionUsed.bottom ? "top" : "bottom";
            }
          } else {
            if (axisPosition !== "left" && axisPosition !== "right") {
              axisPosition = axisPositionUsed.left ? "right" : "left";
            }
          }
          axisPositionUsed[axisPosition] = true;
          var axis = new Axis2D(dimName, createScaleByModel(axisModel), [0, 0], axisModel.get("type"), axisPosition);
          var isCategory = axis.type === "category";
          axis.onBand = isCategory && axisModel.get("boundaryGap");
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
    Grid2.prototype._updateScale = function(ecModel, gridModel) {
      each$1(this._axesList, function(axis) {
        axis.scale.setExtent(Infinity, -Infinity);
        if (axis.type === "category") {
          var categorySortInfo = axis.model.get("categorySortInfo");
          axis.scale.setSortInfo(categorySortInfo);
        }
      });
      ecModel.eachSeries(function(seriesModel) {
        if (isCartesian2DSeries(seriesModel)) {
          var axesModelMap = findAxisModels(seriesModel);
          var xAxisModel = axesModelMap.xAxisModel;
          var yAxisModel = axesModelMap.yAxisModel;
          if (!isAxisUsedInTheGrid(xAxisModel, gridModel) || !isAxisUsedInTheGrid(yAxisModel, gridModel)) {
            return;
          }
          var cartesian = this.getCartesian(xAxisModel.componentIndex, yAxisModel.componentIndex);
          var data = seriesModel.getData();
          var xAxis = cartesian.getAxis("x");
          var yAxis = cartesian.getAxis("y");
          unionExtent(data, xAxis);
          unionExtent(data, yAxis);
        }
      }, this);
      function unionExtent(data, axis) {
        each$1(getDataDimensionsOnAxis(data, axis.dim), function(dim) {
          axis.scale.unionExtentFromData(data, dim);
        });
      }
    };
    Grid2.prototype.getTooltipAxes = function(dim) {
      var baseAxes = [];
      var otherAxes = [];
      each$1(this.getCartesians(), function(cartesian) {
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
    Grid2.create = function(ecModel, api) {
      var grids = [];
      ecModel.eachComponent("grid", function(gridModel, idx) {
        var grid = new Grid2(gridModel, ecModel, api);
        grid.name = "grid_" + idx;
        grid.resize(gridModel, api, true);
        gridModel.coordinateSystem = grid;
        grids.push(grid);
      });
      ecModel.eachSeries(function(seriesModel) {
        if (!isCartesian2DSeries(seriesModel)) {
          return;
        }
        var axesModelMap = findAxisModels(seriesModel);
        var xAxisModel = axesModelMap.xAxisModel;
        var yAxisModel = axesModelMap.yAxisModel;
        var gridModel = xAxisModel.getCoordSysModel();
        if (process.env.NODE_ENV !== "production") {
          if (!gridModel) {
            throw new Error('Grid "' + retrieve3(xAxisModel.get("gridIndex"), xAxisModel.get("gridId"), 0) + '" not found');
          }
          if (xAxisModel.getCoordSysModel() !== yAxisModel.getCoordSysModel()) {
            throw new Error("xAxis and yAxis must use the same grid");
          }
        }
        var grid = gridModel.coordinateSystem;
        seriesModel.coordinateSystem = grid.getCartesian(xAxisModel.componentIndex, yAxisModel.componentIndex);
      });
      return grids;
    };
    Grid2.dimensions = cartesian2DDimensions;
    return Grid2;
  }()
);
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
  if (!onZero) {
    return;
  }
  if (onZeroAxisIndex != null) {
    if (canOnZeroToAxis(otherAxes[onZeroAxisIndex])) {
      otherAxisOnZeroOf = otherAxes[onZeroAxisIndex];
    }
  } else {
    for (var idx in otherAxes) {
      if (otherAxes.hasOwnProperty(idx) && canOnZeroToAxis(otherAxes[idx]) && !onZeroRecords[getOnZeroRecordKey(otherAxes[idx])]) {
        otherAxisOnZeroOf = otherAxes[idx];
        break;
      }
    }
  }
  if (otherAxisOnZeroOf) {
    onZeroRecords[getOnZeroRecordKey(otherAxisOnZeroOf)] = true;
  }
  function getOnZeroRecordKey(axis2) {
    return axis2.dim + "_" + axis2.index;
  }
}
function canOnZeroToAxis(axis) {
  return axis && axis.type !== "category" && axis.type !== "time" && ifAxisCrossZero(axis);
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
var PI = Math.PI;
var AxisBuilder = (
  /** @class */
  function() {
    function AxisBuilder2(axisModel, opt) {
      this.group = new Group();
      this.opt = opt;
      this.axisModel = axisModel;
      defaults(opt, {
        labelOffset: 0,
        nameDirection: 1,
        tickDirection: 1,
        labelDirection: 1,
        silent: true,
        handleAutoShown: function() {
          return true;
        }
      });
      var transformGroup = new Group({
        x: opt.position[0],
        y: opt.position[1],
        rotation: opt.rotation
      });
      transformGroup.updateTransform();
      this._transformGroup = transformGroup;
    }
    AxisBuilder2.prototype.hasBuilder = function(name) {
      return !!builders[name];
    };
    AxisBuilder2.prototype.add = function(name) {
      builders[name](this.opt, this.axisModel, this.group, this._transformGroup);
    };
    AxisBuilder2.prototype.getGroup = function() {
      return this.group;
    };
    AxisBuilder2.innerTextLayout = function(axisRotation, textRotation, direction) {
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
        if (rotationDiff > 0 && rotationDiff < PI) {
          textAlign = direction > 0 ? "right" : "left";
        } else {
          textAlign = direction > 0 ? "left" : "right";
        }
      }
      return {
        rotation: rotationDiff,
        textAlign,
        textVerticalAlign
      };
    };
    AxisBuilder2.makeAxisEventDataBase = function(axisModel) {
      var eventData = {
        componentType: axisModel.mainType,
        componentIndex: axisModel.componentIndex
      };
      eventData[axisModel.mainType + "Index"] = axisModel.componentIndex;
      return eventData;
    };
    AxisBuilder2.isLabelSilent = function(axisModel) {
      var tooltipOpt = axisModel.get("tooltip");
      return axisModel.get("silent") || !(axisModel.get("triggerEvent") || tooltipOpt && tooltipOpt.show);
    };
    return AxisBuilder2;
  }()
);
var builders = {
  axisLine: function(opt, axisModel, group, transformGroup) {
    var shown = axisModel.get(["axisLine", "show"]);
    if (shown === "auto" && opt.handleAutoShown) {
      shown = opt.handleAutoShown("axisLine");
    }
    if (!shown) {
      return;
    }
    var extent = axisModel.axis.getExtent();
    var matrix = transformGroup.transform;
    var pt1 = [extent[0], 0];
    var pt2 = [extent[1], 0];
    var inverse = pt1[0] > pt2[0];
    if (matrix) {
      applyTransform(pt1, pt1, matrix);
      applyTransform(pt2, pt2, matrix);
    }
    var lineStyle = extend({
      lineCap: "round"
    }, axisModel.getModel(["axisLine", "lineStyle"]).getLineStyle());
    var line = new Line({
      shape: {
        x1: pt1[0],
        y1: pt1[1],
        x2: pt2[0],
        y2: pt2[1]
      },
      style: lineStyle,
      strokeContainThreshold: opt.strokeContainThreshold || 5,
      silent: true,
      z2: 1
    });
    subPixelOptimizeLine(line.shape, line.style.lineWidth);
    line.anid = "line";
    group.add(line);
    var arrows = axisModel.get(["axisLine", "symbol"]);
    if (arrows != null) {
      var arrowSize = axisModel.get(["axisLine", "symbolSize"]);
      if (isString(arrows)) {
        arrows = [arrows, arrows];
      }
      if (isString(arrowSize) || isNumber(arrowSize)) {
        arrowSize = [arrowSize, arrowSize];
      }
      var arrowOffset = normalizeSymbolOffset(axisModel.get(["axisLine", "symbolOffset"]) || 0, arrowSize);
      var symbolWidth_1 = arrowSize[0];
      var symbolHeight_1 = arrowSize[1];
      each$1([{
        rotate: opt.rotation + Math.PI / 2,
        offset: arrowOffset[0],
        r: 0
      }, {
        rotate: opt.rotation - Math.PI / 2,
        offset: arrowOffset[1],
        r: Math.sqrt((pt1[0] - pt2[0]) * (pt1[0] - pt2[0]) + (pt1[1] - pt2[1]) * (pt1[1] - pt2[1]))
      }], function(point, index) {
        if (arrows[index] !== "none" && arrows[index] != null) {
          var symbol = createSymbol(arrows[index], -symbolWidth_1 / 2, -symbolHeight_1 / 2, symbolWidth_1, symbolHeight_1, lineStyle.stroke, true);
          var r = point.r + point.offset;
          var pt = inverse ? pt2 : pt1;
          symbol.attr({
            rotation: point.rotate,
            x: pt[0] + r * Math.cos(opt.rotation),
            y: pt[1] - r * Math.sin(opt.rotation),
            silent: true,
            z2: 11
          });
          group.add(symbol);
        }
      });
    }
  },
  axisTickLabel: function(opt, axisModel, group, transformGroup) {
    var ticksEls = buildAxisMajorTicks(group, transformGroup, axisModel, opt);
    var labelEls = buildAxisLabel(group, transformGroup, axisModel, opt);
    fixMinMaxLabelShow(axisModel, labelEls, ticksEls);
    buildAxisMinorTicks(group, transformGroup, axisModel, opt.tickDirection);
    if (axisModel.get(["axisLabel", "hideOverlap"])) {
      var labelList = prepareLayoutList(map(labelEls, function(label) {
        return {
          label,
          priority: label.z2,
          defaultAttr: {
            ignore: label.ignore
          }
        };
      }));
      hideOverlap(labelList);
    }
  },
  axisName: function(opt, axisModel, group, transformGroup) {
    var name = retrieve(opt.axisName, axisModel.get("name"));
    if (!name) {
      return;
    }
    var nameLocation = axisModel.get("nameLocation");
    var nameDirection = opt.nameDirection;
    var textStyleModel = axisModel.getModel("nameTextStyle");
    var gap = axisModel.get("nameGap") || 0;
    var extent = axisModel.axis.getExtent();
    var gapSignal = extent[0] > extent[1] ? -1 : 1;
    var pos = [
      nameLocation === "start" ? extent[0] - gapSignal * gap : nameLocation === "end" ? extent[1] + gapSignal * gap : (extent[0] + extent[1]) / 2,
      // Reuse labelOffset.
      isNameLocationCenter(nameLocation) ? opt.labelOffset + nameDirection * gap : 0
    ];
    var labelLayout;
    var nameRotation = axisModel.get("nameRotate");
    if (nameRotation != null) {
      nameRotation = nameRotation * PI / 180;
    }
    var axisNameAvailableWidth;
    if (isNameLocationCenter(nameLocation)) {
      labelLayout = AxisBuilder.innerTextLayout(
        opt.rotation,
        nameRotation != null ? nameRotation : opt.rotation,
        // Adapt to axis.
        nameDirection
      );
    } else {
      labelLayout = endTextLayout(opt.rotation, nameLocation, nameRotation || 0, extent);
      axisNameAvailableWidth = opt.axisNameAvailableWidth;
      if (axisNameAvailableWidth != null) {
        axisNameAvailableWidth = Math.abs(axisNameAvailableWidth / Math.sin(labelLayout.rotation));
        !isFinite(axisNameAvailableWidth) && (axisNameAvailableWidth = null);
      }
    }
    var textFont = textStyleModel.getFont();
    var truncateOpt = axisModel.get("nameTruncate", true) || {};
    var ellipsis = truncateOpt.ellipsis;
    var maxWidth = retrieve(opt.nameTruncateMaxWidth, truncateOpt.maxWidth, axisNameAvailableWidth);
    var textEl = new ZRText({
      x: pos[0],
      y: pos[1],
      rotation: labelLayout.rotation,
      silent: AxisBuilder.isLabelSilent(axisModel),
      style: createTextStyle(textStyleModel, {
        text: name,
        font: textFont,
        overflow: "truncate",
        width: maxWidth,
        ellipsis,
        fill: textStyleModel.getTextColor() || axisModel.get(["axisLine", "lineStyle", "color"]),
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
    group.add(textEl);
    textEl.decomposeTransform();
  }
};
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
    if (rotationDiff < PI * 1.5 && rotationDiff > PI / 2) {
      textAlign = onLeft ? "left" : "right";
    } else {
      textAlign = onLeft ? "right" : "left";
    }
  }
  return {
    rotation: rotationDiff,
    textAlign,
    textVerticalAlign
  };
}
function fixMinMaxLabelShow(axisModel, labelEls, tickEls) {
  if (shouldShowAllLabels(axisModel.axis)) {
    return;
  }
  var showMinLabel = axisModel.get(["axisLabel", "showMinLabel"]);
  var showMaxLabel = axisModel.get(["axisLabel", "showMaxLabel"]);
  labelEls = labelEls || [];
  tickEls = tickEls || [];
  var firstLabel = labelEls[0];
  var nextLabel = labelEls[1];
  var lastLabel = labelEls[labelEls.length - 1];
  var prevLabel = labelEls[labelEls.length - 2];
  var firstTick = tickEls[0];
  var nextTick = tickEls[1];
  var lastTick = tickEls[tickEls.length - 1];
  var prevTick = tickEls[tickEls.length - 2];
  if (showMinLabel === false) {
    ignoreEl(firstLabel);
    ignoreEl(firstTick);
  } else if (isTwoLabelOverlapped(firstLabel, nextLabel)) {
    if (showMinLabel) {
      ignoreEl(nextLabel);
      ignoreEl(nextTick);
    } else {
      ignoreEl(firstLabel);
      ignoreEl(firstTick);
    }
  }
  if (showMaxLabel === false) {
    ignoreEl(lastLabel);
    ignoreEl(lastTick);
  } else if (isTwoLabelOverlapped(prevLabel, lastLabel)) {
    if (showMaxLabel) {
      ignoreEl(prevLabel);
      ignoreEl(prevTick);
    } else {
      ignoreEl(lastLabel);
      ignoreEl(lastTick);
    }
  }
}
function ignoreEl(el) {
  el && (el.ignore = true);
}
function isTwoLabelOverlapped(current, next) {
  var firstRect = current && current.getBoundingRect().clone();
  var nextRect = next && next.getBoundingRect().clone();
  if (!firstRect || !nextRect) {
    return;
  }
  var mRotationBack = identity([]);
  rotate(mRotationBack, mRotationBack, -current.rotation);
  firstRect.applyTransform(mul([], mRotationBack, current.getLocalTransform()));
  nextRect.applyTransform(mul([], mRotationBack, next.getLocalTransform()));
  return firstRect.intersect(nextRect);
}
function isNameLocationCenter(nameLocation) {
  return nameLocation === "middle" || nameLocation === "center";
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
  }
  return tickEls;
}
function buildAxisMajorTicks(group, transformGroup, axisModel, opt) {
  var axis = axisModel.axis;
  var tickModel = axisModel.getModel("axisTick");
  var shown = tickModel.get("show");
  if (shown === "auto" && opt.handleAutoShown) {
    shown = opt.handleAutoShown("axisTick");
  }
  if (!shown || axis.scale.isBlank()) {
    return;
  }
  var lineStyleModel = tickModel.getModel("lineStyle");
  var tickEndCoord = opt.tickDirection * tickModel.get("length");
  var ticksCoords = axis.getTicksCoords();
  var ticksEls = createTicks(ticksCoords, transformGroup.transform, tickEndCoord, defaults(lineStyleModel.getLineStyle(), {
    stroke: axisModel.get(["axisLine", "lineStyle", "color"])
  }), "ticks");
  for (var i = 0; i < ticksEls.length; i++) {
    group.add(ticksEls[i]);
  }
  return ticksEls;
}
function buildAxisMinorTicks(group, transformGroup, axisModel, tickDirection) {
  var axis = axisModel.axis;
  var minorTickModel = axisModel.getModel("minorTick");
  if (!minorTickModel.get("show") || axis.scale.isBlank()) {
    return;
  }
  var minorTicksCoords = axis.getMinorTicksCoords();
  if (!minorTicksCoords.length) {
    return;
  }
  var lineStyleModel = minorTickModel.getModel("lineStyle");
  var tickEndCoord = tickDirection * minorTickModel.get("length");
  var minorTickLineStyle = defaults(lineStyleModel.getLineStyle(), defaults(axisModel.getModel("axisTick").getLineStyle(), {
    stroke: axisModel.get(["axisLine", "lineStyle", "color"])
  }));
  for (var i = 0; i < minorTicksCoords.length; i++) {
    var minorTicksEls = createTicks(minorTicksCoords[i], transformGroup.transform, tickEndCoord, minorTickLineStyle, "minorticks_" + i);
    for (var k = 0; k < minorTicksEls.length; k++) {
      group.add(minorTicksEls[k]);
    }
  }
}
function buildAxisLabel(group, transformGroup, axisModel, opt) {
  var axis = axisModel.axis;
  var show = retrieve(opt.axisLabelShow, axisModel.get(["axisLabel", "show"]));
  if (!show || axis.scale.isBlank()) {
    return;
  }
  var labelModel = axisModel.getModel("axisLabel");
  var labelMargin = labelModel.get("margin");
  var labels = axis.getViewLabels();
  var labelRotation = (retrieve(opt.labelRotate, labelModel.get("rotate")) || 0) * PI / 180;
  var labelLayout = AxisBuilder.innerTextLayout(opt.rotation, labelRotation, opt.labelDirection);
  var rawCategoryData = axisModel.getCategories && axisModel.getCategories(true);
  var labelEls = [];
  var silent = AxisBuilder.isLabelSilent(axisModel);
  var triggerEvent = axisModel.get("triggerEvent");
  each$1(labels, function(labelItem, index) {
    var tickValue = axis.scale.type === "ordinal" ? axis.scale.getRawOrdinalNumber(labelItem.tickValue) : labelItem.tickValue;
    var formattedLabel = labelItem.formattedLabel;
    var rawLabel = labelItem.rawLabel;
    var itemLabelModel = labelModel;
    if (rawCategoryData && rawCategoryData[tickValue]) {
      var rawCategoryItem = rawCategoryData[tickValue];
      if (isObject(rawCategoryItem) && rawCategoryItem.textStyle) {
        itemLabelModel = new Model(rawCategoryItem.textStyle, labelModel, axisModel.ecModel);
      }
    }
    var textColor = itemLabelModel.getTextColor() || axisModel.get(["axisLine", "lineStyle", "color"]);
    var tickCoord = axis.dataToCoord(tickValue);
    var align = itemLabelModel.getShallow("align", true) || labelLayout.textAlign;
    var alignMin = retrieve2(itemLabelModel.getShallow("alignMinLabel", true), align);
    var alignMax = retrieve2(itemLabelModel.getShallow("alignMaxLabel", true), align);
    var verticalAlign = itemLabelModel.getShallow("verticalAlign", true) || itemLabelModel.getShallow("baseline", true) || labelLayout.textVerticalAlign;
    var verticalAlignMin = retrieve2(itemLabelModel.getShallow("verticalAlignMinLabel", true), verticalAlign);
    var verticalAlignMax = retrieve2(itemLabelModel.getShallow("verticalAlignMaxLabel", true), verticalAlign);
    var textEl = new ZRText({
      x: tickCoord,
      y: opt.labelOffset + opt.labelDirection * labelMargin,
      rotation: labelLayout.rotation,
      silent,
      z2: 10 + (labelItem.level || 0),
      style: createTextStyle(itemLabelModel, {
        text: formattedLabel,
        align: index === 0 ? alignMin : index === labels.length - 1 ? alignMax : align,
        verticalAlign: index === 0 ? verticalAlignMin : index === labels.length - 1 ? verticalAlignMax : verticalAlign,
        fill: isFunction(textColor) ? textColor(
          // (1) In category axis with data zoom, tick is not the original
          // index of axis.data. So tick should not be exposed to user
          // in category axis.
          // (2) Compatible with previous version, which always use formatted label as
          // input. But in interval scale the formatted label is like '223,445', which
          // maked user replace ','. So we modify it to return original val but remain
          // it as 'string' to avoid error in replacing.
          axis.type === "category" ? rawLabel : axis.type === "value" ? tickValue + "" : tickValue,
          index
        ) : textColor
      })
    });
    textEl.anid = "label_" + tickValue;
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
      if (axis.type === "category") {
        eventData.dataIndex = tickValue;
      }
      getECData(textEl).eventData = eventData;
    }
    transformGroup.add(textEl);
    textEl.updateTransform();
    labelEls.push(textEl);
    group.add(textEl);
    textEl.decomposeTransform();
  });
  return labelEls;
}
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
  each$1(api.getCoordinateSystems(), function(coordSys) {
    if (!coordSys.axisPointerEnabled) {
      return;
    }
    var coordSysKey = makeKey(coordSys.model);
    var axesInfoInCoordSys = result.coordSysAxesInfo[coordSysKey] = {};
    result.coordSysMap[coordSysKey] = coordSys;
    var coordSysModel = coordSys.model;
    var baseTooltipModel = coordSysModel.getModel("tooltip", globalTooltipModel);
    each$1(coordSys.getAxes(), curry(saveTooltipAxisInfo, false, null));
    if (coordSys.getTooltipAxes && globalTooltipModel && baseTooltipModel.get("show")) {
      var triggerAxis = baseTooltipModel.get("trigger") === "axis";
      var cross = baseTooltipModel.get(["axisPointer", "type"]) === "cross";
      var tooltipAxes = coordSys.getTooltipAxes(baseTooltipModel.get(["axisPointer", "axis"]));
      if (triggerAxis || cross) {
        each$1(tooltipAxes.baseAxes, curry(saveTooltipAxisInfo, cross ? "cross" : true, triggerAxis));
      }
      if (cross) {
        each$1(tooltipAxes.otherAxes, curry(saveTooltipAxisInfo, "cross", false));
      }
    }
    function saveTooltipAxisInfo(fromTooltip, triggerTooltip, axis) {
      var axisPointerModel = axis.model.getModel("axisPointer", globalAxisPointerModel);
      var axisPointerShow = axisPointerModel.get("show");
      if (!axisPointerShow || axisPointerShow === "auto" && !fromTooltip && !isHandleTrigger(axisPointerModel)) {
        return;
      }
      if (triggerTooltip == null) {
        triggerTooltip = axisPointerModel.get("triggerTooltip");
      }
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
        var linkGroup = linkGroups[groupIndex] || (linkGroups[groupIndex] = {
          axesInfo: {}
        });
        linkGroup.axesInfo[axisKey] = axisInfo;
        linkGroup.mapper = linksOption[groupIndex].mapper;
        axisInfo.linkGroup = linkGroup;
      }
    }
  });
}
function makeAxisPointerModel(axis, baseTooltipModel, globalAxisPointerModel, ecModel, fromTooltip, triggerTooltip) {
  var tooltipAxisPointerModel = baseTooltipModel.getModel("axisPointer");
  var fields = ["type", "snap", "lineStyle", "shadowStyle", "label", "animation", "animationDurationUpdate", "animationEasingUpdate", "z"];
  var volatileOption = {};
  each$1(fields, function(field) {
    volatileOption[field] = clone$1(tooltipAxisPointerModel.get(field));
  });
  volatileOption.snap = axis.type !== "category" && !!triggerTooltip;
  if (tooltipAxisPointerModel.get("type") === "cross") {
    volatileOption.type = "line";
  }
  var labelOption = volatileOption.label || (volatileOption.label = {});
  labelOption.show == null && (labelOption.show = false);
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
    if (!coordSys || seriesTooltipTrigger === "none" || seriesTooltipTrigger === false || seriesTooltipTrigger === "item" || seriesTooltipShow === false || seriesModel.get(["axisPointer", "show"], true) === false) {
      return;
    }
    each$1(result.coordSysAxesInfo[makeKey(coordSys.model)], function(axisInfo) {
      var axis = axisInfo.axis;
      if (coordSys.getAxis(axis.dim) === axis) {
        axisInfo.seriesModels.push(seriesModel);
        axisInfo.seriesDataCount == null && (axisInfo.seriesDataCount = 0);
        axisInfo.seriesDataCount += seriesModel.getData().count();
      }
    });
  });
}
function getLinkGroupIndex(linksOption, axis) {
  var axisModel = axis.model;
  var dim = axis.dim;
  for (var i = 0; i < linksOption.length; i++) {
    var linkOption = linksOption[i] || {};
    if (checkPropInLink(linkOption[dim + "AxisId"], axisModel.id) || checkPropInLink(linkOption[dim + "AxisIndex"], axisModel.componentIndex) || checkPropInLink(linkOption[dim + "AxisName"], axisModel.name)) {
      return i;
    }
  }
}
function checkPropInLink(linkPropValue, axisPropValue) {
  return linkPropValue === "all" || isArray(linkPropValue) && indexOf(linkPropValue, axisPropValue) >= 0 || linkPropValue === axisPropValue;
}
function fixValue(axisModel) {
  var axisInfo = getAxisInfo(axisModel);
  if (!axisInfo) {
    return;
  }
  var axisPointerModel = axisInfo.axisPointerModel;
  var scale = axisInfo.axis.scale;
  var option = axisPointerModel.option;
  var status = axisPointerModel.get("status");
  var value = axisPointerModel.get("value");
  if (value != null) {
    value = scale.parse(value);
  }
  var useHandle = isHandleTrigger(axisPointerModel);
  if (status == null) {
    option.status = useHandle ? "show" : "hide";
  }
  var extent = scale.getExtent().slice();
  extent[0] > extent[1] && extent.reverse();
  if (
    // Pick a value on axis when initializing.
    value == null || value > extent[1]
  ) {
    value = extent[1];
  }
  if (value < extent[0]) {
    value = extent[0];
  }
  option.value = value;
  if (useHandle) {
    option.status = axisInfo.axis.scale.isBlank() ? "hide" : "show";
  }
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
function makeKey(model) {
  return model.type + "||" + model.id;
}
var axisPointerClazz = {};
var AxisView = (
  /** @class */
  function(_super) {
    __extends(AxisView2, _super);
    function AxisView2() {
      var _this = _super !== null && _super.apply(this, arguments) || this;
      _this.type = AxisView2.type;
      return _this;
    }
    AxisView2.prototype.render = function(axisModel, ecModel, api, payload) {
      this.axisPointerClass && fixValue(axisModel);
      _super.prototype.render.apply(this, arguments);
      this._doUpdateAxisPointerClass(axisModel, api, true);
    };
    AxisView2.prototype.updateAxisPointer = function(axisModel, ecModel, api, payload) {
      this._doUpdateAxisPointerClass(axisModel, api, false);
    };
    AxisView2.prototype.remove = function(ecModel, api) {
      var axisPointer = this._axisPointer;
      axisPointer && axisPointer.remove(api);
    };
    AxisView2.prototype.dispose = function(ecModel, api) {
      this._disposeAxisPointer(api);
      _super.prototype.dispose.apply(this, arguments);
    };
    AxisView2.prototype._doUpdateAxisPointerClass = function(axisModel, api, forceRender) {
      var Clazz = AxisView2.getAxisPointerClass(this.axisPointerClass);
      if (!Clazz) {
        return;
      }
      var axisPointerModel = getAxisPointerModel(axisModel);
      axisPointerModel ? (this._axisPointer || (this._axisPointer = new Clazz())).render(axisModel, axisPointerModel, api, forceRender) : this._disposeAxisPointer(api);
    };
    AxisView2.prototype._disposeAxisPointer = function(api) {
      this._axisPointer && this._axisPointer.dispose(api);
      this._axisPointer = null;
    };
    AxisView2.registerAxisPointerClass = function(type, clazz) {
      if (process.env.NODE_ENV !== "production") {
        if (axisPointerClazz[type]) {
          throw new Error("axisPointer " + type + " exists");
        }
      }
      axisPointerClazz[type] = clazz;
    };
    AxisView2.getAxisPointerClass = function(type) {
      return type && axisPointerClazz[type];
    };
    AxisView2.type = "axis";
    return AxisView2;
  }(ComponentView)
);
var inner$3 = makeInner();
function rectCoordAxisBuildSplitArea(axisView, axisGroup, axisModel, gridModel) {
  var axis = axisModel.axis;
  if (axis.scale.isBlank()) {
    return;
  }
  var splitAreaModel = axisModel.getModel("splitArea");
  var areaStyleModel = splitAreaModel.getModel("areaStyle");
  var areaColors = areaStyleModel.get("color");
  var gridRect = gridModel.coordinateSystem.getRect();
  var ticksCoords = axis.getTicksCoords({
    tickModel: splitAreaModel,
    clamp: true
  });
  if (!ticksCoords.length) {
    return;
  }
  var areaColorsLen = areaColors.length;
  var lastSplitAreaColors = inner$3(axisView).splitAreaColors;
  var newSplitAreaColors = createHashMap();
  var colorIndex = 0;
  if (lastSplitAreaColors) {
    for (var i = 0; i < ticksCoords.length; i++) {
      var cIndex = lastSplitAreaColors.get(ticksCoords[i].tickValue);
      if (cIndex != null) {
        colorIndex = (cIndex + (areaColorsLen - 1) * i) % areaColorsLen;
        break;
      }
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
      style: defaults({
        fill: areaColors[colorIndex]
      }, areaStyle),
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
var axisBuilderAttrs = ["axisLine", "axisTickLabel", "axisName"];
var selfBuilderAttrs = ["splitArea", "splitLine", "minorSplitLine"];
var CartesianAxisView = (
  /** @class */
  function(_super) {
    __extends(CartesianAxisView2, _super);
    function CartesianAxisView2() {
      var _this = _super !== null && _super.apply(this, arguments) || this;
      _this.type = CartesianAxisView2.type;
      _this.axisPointerClass = "CartesianAxisPointer";
      return _this;
    }
    CartesianAxisView2.prototype.render = function(axisModel, ecModel, api, payload) {
      this.group.removeAll();
      var oldAxisGroup = this._axisGroup;
      this._axisGroup = new Group();
      this.group.add(this._axisGroup);
      if (!axisModel.get("show")) {
        return;
      }
      var gridModel = axisModel.getCoordSysModel();
      var layout$1 = layout(gridModel, axisModel);
      var axisBuilder = new AxisBuilder(axisModel, extend({
        handleAutoShown: function(elementType) {
          var cartesians = gridModel.coordinateSystem.getCartesians();
          for (var i = 0; i < cartesians.length; i++) {
            if (isIntervalOrLogScale(cartesians[i].getOtherAxis(axisModel.axis).scale)) {
              return true;
            }
          }
          return false;
        }
      }, layout$1));
      each$1(axisBuilderAttrs, axisBuilder.add, axisBuilder);
      this._axisGroup.add(axisBuilder.getGroup());
      each$1(selfBuilderAttrs, function(name) {
        if (axisModel.get([name, "show"])) {
          axisElementBuilders[name](this, this._axisGroup, axisModel, gridModel);
        }
      }, this);
      var isInitialSortFromBarRacing = payload && payload.type === "changeAxisOrder" && payload.isInitSort;
      if (!isInitialSortFromBarRacing) {
        groupTransition(oldAxisGroup, this._axisGroup, axisModel);
      }
      _super.prototype.render.call(this, axisModel, ecModel, api, payload);
    };
    CartesianAxisView2.prototype.remove = function() {
      rectCoordAxisHandleRemove(this);
    };
    CartesianAxisView2.type = "cartesianAxis";
    return CartesianAxisView2;
  }(AxisView)
);
var axisElementBuilders = {
  splitLine: function(axisView, axisGroup, axisModel, gridModel) {
    var axis = axisModel.axis;
    if (axis.scale.isBlank()) {
      return;
    }
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
      tickModel: splitLineModel
    });
    var p1 = [];
    var p2 = [];
    var lineStyle = lineStyleModel.getLineStyle();
    for (var i = 0; i < ticksCoords.length; i++) {
      var tickCoord = axis.toGlobalCoord(ticksCoords[i].coord);
      if (i === 0 && !showMinLine || i === ticksCoords.length - 1 && !showMaxLine) {
        continue;
      }
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
        style: defaults({
          stroke: lineColors[colorIndex]
        }, lineStyle),
        silent: true
      });
      subPixelOptimizeLine(line.shape, lineStyle.lineWidth);
      axisGroup.add(line);
    }
  },
  minorSplitLine: function(axisView, axisGroup, axisModel, gridModel) {
    var axis = axisModel.axis;
    var minorSplitLineModel = axisModel.getModel("minorSplitLine");
    var lineStyleModel = minorSplitLineModel.getModel("lineStyle");
    var gridRect = gridModel.coordinateSystem.getRect();
    var isHorizontal = axis.isHorizontal();
    var minorTicksCoords = axis.getMinorTicksCoords();
    if (!minorTicksCoords.length) {
      return;
    }
    var p1 = [];
    var p2 = [];
    var lineStyle = lineStyleModel.getLineStyle();
    for (var i = 0; i < minorTicksCoords.length; i++) {
      for (var k = 0; k < minorTicksCoords[i].length; k++) {
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
    }
  },
  splitArea: function(axisView, axisGroup, axisModel, gridModel) {
    rectCoordAxisBuildSplitArea(axisView, axisGroup, axisModel, gridModel);
  }
};
var CartesianXAxisView = (
  /** @class */
  function(_super) {
    __extends(CartesianXAxisView2, _super);
    function CartesianXAxisView2() {
      var _this = _super !== null && _super.apply(this, arguments) || this;
      _this.type = CartesianXAxisView2.type;
      return _this;
    }
    CartesianXAxisView2.type = "xAxis";
    return CartesianXAxisView2;
  }(CartesianAxisView)
);
var CartesianYAxisView = (
  /** @class */
  function(_super) {
    __extends(CartesianYAxisView2, _super);
    function CartesianYAxisView2() {
      var _this = _super !== null && _super.apply(this, arguments) || this;
      _this.type = CartesianXAxisView.type;
      return _this;
    }
    CartesianYAxisView2.type = "yAxis";
    return CartesianYAxisView2;
  }(CartesianAxisView)
);
var GridView = (
  /** @class */
  function(_super) {
    __extends(GridView2, _super);
    function GridView2() {
      var _this = _super !== null && _super.apply(this, arguments) || this;
      _this.type = "grid";
      return _this;
    }
    GridView2.prototype.render = function(gridModel, ecModel) {
      this.group.removeAll();
      if (gridModel.get("show")) {
        this.group.add(new Rect({
          shape: gridModel.coordinateSystem.getRect(),
          style: defaults({
            fill: gridModel.get("backgroundColor")
          }, gridModel.getItemStyle()),
          silent: true,
          z2: -1
        }));
      }
    };
    GridView2.type = "grid";
    return GridView2;
  }(ComponentView)
);
var extraOption = {
  // gridIndex: 0,
  // gridId: '',
  offset: 0
};
function install$3(registers) {
  registers.registerComponentView(GridView);
  registers.registerComponentModel(GridModel);
  registers.registerCoordinateSystem("cartesian2d", Grid);
  axisModelCreator(registers, "x", CartesianAxisModel, extraOption);
  axisModelCreator(registers, "y", CartesianAxisModel, extraOption);
  registers.registerComponentView(CartesianXAxisView);
  registers.registerComponentView(CartesianYAxisView);
  registers.registerPreprocessor(function(option) {
    if (option.xAxis && option.yAxis && !option.grid) {
      option.grid = {};
    }
  });
}
var inner$2 = makeInner();
var clone = clone$1;
var bind = bind$1;
var BaseAxisPointer = (
  /** @class */
  function() {
    function BaseAxisPointer2() {
      this._dragging = false;
      this.animationThreshold = 15;
    }
    BaseAxisPointer2.prototype.render = function(axisModel, axisPointerModel, api, forceRender) {
      var value = axisPointerModel.get("value");
      var status = axisPointerModel.get("status");
      this._axisModel = axisModel;
      this._axisPointerModel = axisPointerModel;
      this._api = api;
      if (!forceRender && this._lastValue === value && this._lastStatus === status) {
        return;
      }
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
      if (graphicKey !== this._lastGraphicKey) {
        this.clear(api);
      }
      this._lastGraphicKey = graphicKey;
      var moveAnimation = this._moveAnimation = this.determineAnimation(axisModel, axisPointerModel);
      if (!group) {
        group = this._group = new Group();
        this.createPointerEl(group, elOption, axisModel, axisPointerModel);
        this.createLabelEl(group, elOption, axisModel, axisPointerModel);
        api.getZr().add(group);
      } else {
        var doUpdateProps = curry(updateProps, axisPointerModel, moveAnimation);
        this.updatePointerEl(group, elOption, doUpdateProps);
        this.updateLabelEl(group, elOption, doUpdateProps, axisPointerModel);
      }
      updateMandatoryProps(group, axisPointerModel, true);
      this._renderHandle(value);
    };
    BaseAxisPointer2.prototype.remove = function(api) {
      this.clear(api);
    };
    BaseAxisPointer2.prototype.dispose = function(api) {
      this.clear(api);
    };
    BaseAxisPointer2.prototype.determineAnimation = function(axisModel, axisPointerModel) {
      var animation = axisPointerModel.get("animation");
      var axis = axisModel.axis;
      var isCategoryAxis = axis.type === "category";
      var useSnap = axisPointerModel.get("snap");
      if (!useSnap && !isCategoryAxis) {
        return false;
      }
      if (animation === "auto" || animation == null) {
        var animationThreshold = this.animationThreshold;
        if (isCategoryAxis && axis.getBandWidth() > animationThreshold) {
          return true;
        }
        if (useSnap) {
          var seriesDataCount = getAxisInfo(axisModel).seriesDataCount;
          var axisExtent = axis.getExtent();
          return Math.abs(axisExtent[0] - axisExtent[1]) / seriesDataCount > animationThreshold;
        }
        return false;
      }
      return animation === true;
    };
    BaseAxisPointer2.prototype.makeElOption = function(elOption, value, axisModel, axisPointerModel, api) {
    };
    BaseAxisPointer2.prototype.createPointerEl = function(group, elOption, axisModel, axisPointerModel) {
      var pointerOption = elOption.pointer;
      if (pointerOption) {
        var pointerEl = inner$2(group).pointerEl = new graphic[pointerOption.type](clone(elOption.pointer));
        group.add(pointerEl);
      }
    };
    BaseAxisPointer2.prototype.createLabelEl = function(group, elOption, axisModel, axisPointerModel) {
      if (elOption.label) {
        var labelEl = inner$2(group).labelEl = new ZRText(clone(elOption.label));
        group.add(labelEl);
        updateLabelShowHide(labelEl, axisPointerModel);
      }
    };
    BaseAxisPointer2.prototype.updatePointerEl = function(group, elOption, updateProps2) {
      var pointerEl = inner$2(group).pointerEl;
      if (pointerEl && elOption.pointer) {
        pointerEl.setStyle(elOption.pointer.style);
        updateProps2(pointerEl, {
          shape: elOption.pointer.shape
        });
      }
    };
    BaseAxisPointer2.prototype.updateLabelEl = function(group, elOption, updateProps2, axisPointerModel) {
      var labelEl = inner$2(group).labelEl;
      if (labelEl) {
        labelEl.setStyle(elOption.label.style);
        updateProps2(labelEl, {
          // Consider text length change in vertical axis, animation should
          // be used on shape, otherwise the effect will be weird.
          // TODOTODO
          // shape: elOption.label.shape,
          x: elOption.label.x,
          y: elOption.label.y
        });
        updateLabelShowHide(labelEl, axisPointerModel);
      }
    };
    BaseAxisPointer2.prototype._renderHandle = function(value) {
      if (this._dragging || !this.updateHandleTransform) {
        return;
      }
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
      handle.setStyle(handleModel.getItemStyle(null, ["color", "borderColor", "borderWidth", "opacity", "shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY"]));
      var handleSize = handleModel.get("size");
      if (!isArray(handleSize)) {
        handleSize = [handleSize, handleSize];
      }
      handle.scaleX = handleSize[0] / 2;
      handle.scaleY = handleSize[1] / 2;
      createOrUpdate(this, "_doDispatchAxisPointer", handleModel.get("throttle") || 0, "fixRate");
      this._moveHandleToValue(value, isInit);
    };
    BaseAxisPointer2.prototype._moveHandleToValue = function(value, isInit) {
      updateProps(this._axisPointerModel, !isInit && this._moveAnimation, this._handle, getHandleTransProps(this.getHandleTransform(value, this._axisModel, this._axisPointerModel)));
    };
    BaseAxisPointer2.prototype._onHandleDragMove = function(dx, dy) {
      var handle = this._handle;
      if (!handle) {
        return;
      }
      this._dragging = true;
      var trans = this.updateHandleTransform(getHandleTransProps(handle), [dx, dy], this._axisModel, this._axisPointerModel);
      this._payloadInfo = trans;
      handle.stopAnimation();
      handle.attr(getHandleTransProps(trans));
      inner$2(handle).lastProp = null;
      this._doDispatchAxisPointer();
    };
    BaseAxisPointer2.prototype._doDispatchAxisPointer = function() {
      var handle = this._handle;
      if (!handle) {
        return;
      }
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
    BaseAxisPointer2.prototype._onHandleDragEnd = function() {
      this._dragging = false;
      var handle = this._handle;
      if (!handle) {
        return;
      }
      var value = this._axisPointerModel.get("value");
      this._moveHandleToValue(value);
      this._api.dispatchAction({
        type: "hideTip"
      });
    };
    BaseAxisPointer2.prototype.clear = function(api) {
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
    BaseAxisPointer2.prototype.doClear = function() {
    };
    BaseAxisPointer2.prototype.buildLabel = function(xy, wh, xDimIndex) {
      xDimIndex = xDimIndex || 0;
      return {
        x: xy[xDimIndex],
        y: xy[1 - xDimIndex],
        width: wh[xDimIndex],
        height: wh[1 - xDimIndex]
      };
    };
    return BaseAxisPointer2;
  }()
);
function updateProps(animationModel, moveAnimation, el, props) {
  if (!propsEqual(inner$2(el).lastProp, props)) {
    inner$2(el).lastProp = props;
    moveAnimation ? updateProps$1(el, props, animationModel) : (el.stopAnimation(), el.attr(props));
  }
}
function propsEqual(lastProps, newProps) {
  if (isObject(lastProps) && isObject(newProps)) {
    var equals_1 = true;
    each$1(newProps, function(item, key) {
      equals_1 = equals_1 && propsEqual(lastProps[key], item);
    });
    return !!equals_1;
  } else {
    return lastProps === newProps;
  }
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
function buildLabelElOption(elOption, axisModel, axisPointerModel, api, labelPos) {
  var value = axisPointerModel.get("value");
  var text = getValueLabel(value, axisModel.axis, axisModel.ecModel, axisPointerModel.get("seriesDataIndices"), {
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
  if (!bgColor || bgColor === "auto") {
    bgColor = axisModel.get(["axisLine", "lineStyle", "color"]);
  }
  elOption.label = {
    // shape: {x: 0, y: 0, width: width, height: height, r: labelModel.get('borderRadius')},
    x: position[0],
    y: position[1],
    style: createTextStyle(labelModel, {
      text,
      font,
      fill: labelModel.getTextColor(),
      padding: paddings,
      backgroundColor: bgColor
    }),
    // Label should be over axisPointer.
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
  var text = axis.scale.getLabel({
    value
  }, {
    // If `precision` is set, width can be fixed (like '12.00500'), which
    // helps to debounce when when moving label.
    precision: opt.precision
  });
  var formatter = opt.formatter;
  if (formatter) {
    var params_1 = {
      value: getAxisRawValue(axis, {
        value
      }),
      axisDimension: axis.dim,
      axisIndex: axis.index,
      seriesData: []
    };
    each$1(seriesDataIndices, function(idxItem) {
      var series = ecModel.getSeriesByIndex(idxItem.seriesIndex);
      var dataIndex = idxItem.dataIndexInside;
      var dataParams = series && series.getDataParams(dataIndex);
      dataParams && params_1.seriesData.push(dataParams);
    });
    if (isString(formatter)) {
      text = formatter.replace("{value}", text);
    } else if (isFunction(formatter)) {
      text = formatter(params_1);
    }
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
var CartesianAxisPointer = (
  /** @class */
  function(_super) {
    __extends(CartesianAxisPointer2, _super);
    function CartesianAxisPointer2() {
      return _super !== null && _super.apply(this, arguments) || this;
    }
    CartesianAxisPointer2.prototype.makeElOption = function(elOption, value, axisModel, axisPointerModel, api) {
      var axis = axisModel.axis;
      var grid = axis.grid;
      var axisPointerType = axisPointerModel.get("type");
      var otherExtent = getCartesian(grid, axis).getOtherAxis(axis).getGlobalExtent();
      var pixelValue = axis.toGlobalCoord(axis.dataToCoord(value, true));
      if (axisPointerType && axisPointerType !== "none") {
        var elStyle = buildElStyle(axisPointerModel);
        var pointerOption = pointerShapeBuilder[axisPointerType](axis, pixelValue, otherExtent);
        pointerOption.style = elStyle;
        elOption.graphicKey = pointerOption.type;
        elOption.pointer = pointerOption;
      }
      var layoutInfo = layout(grid.model, axisModel);
      buildCartesianSingleLabelElOption(
        // @ts-ignore
        value,
        elOption,
        layoutInfo,
        axisModel,
        axisPointerModel,
        api
      );
    };
    CartesianAxisPointer2.prototype.getHandleTransform = function(value, axisModel, axisPointerModel) {
      var layoutInfo = layout(axisModel.axis.grid.model, axisModel, {
        labelInside: false
      });
      layoutInfo.labelMargin = axisPointerModel.get(["handle", "margin"]);
      var pos = getTransformedPosition(axisModel.axis, value, layoutInfo);
      return {
        x: pos[0],
        y: pos[1],
        rotation: layoutInfo.rotation + (layoutInfo.labelDirection < 0 ? Math.PI : 0)
      };
    };
    CartesianAxisPointer2.prototype.updateHandleTransform = function(transform, delta, axisModel, axisPointerModel) {
      var axis = axisModel.axis;
      var grid = axis.grid;
      var axisExtent = axis.getGlobalExtent(true);
      var otherExtent = getCartesian(grid, axis).getOtherAxis(axis).getGlobalExtent();
      var dimIndex = axis.dim === "x" ? 0 : 1;
      var currPosition = [transform.x, transform.y];
      currPosition[dimIndex] += delta[dimIndex];
      currPosition[dimIndex] = Math.min(axisExtent[1], currPosition[dimIndex]);
      currPosition[dimIndex] = Math.max(axisExtent[0], currPosition[dimIndex]);
      var cursorOtherValue = (otherExtent[1] + otherExtent[0]) / 2;
      var cursorPoint = [cursorOtherValue, cursorOtherValue];
      cursorPoint[dimIndex] = currPosition[dimIndex];
      var tooltipOptions = [{
        verticalAlign: "middle"
      }, {
        align: "center"
      }];
      return {
        x: currPosition[0],
        y: currPosition[1],
        rotation: transform.rotation,
        cursorPoint,
        tooltipOption: tooltipOptions[dimIndex]
      };
    };
    return CartesianAxisPointer2;
  }(BaseAxisPointer)
);
function getCartesian(grid, axis) {
  var opt = {};
  opt[axis.dim + "AxisIndex"] = axis.index;
  return grid.getCartesian(opt);
}
var pointerShapeBuilder = {
  line: function(axis, pixelValue, otherExtent) {
    var targetShape = makeLineShape([pixelValue, otherExtent[0]], [pixelValue, otherExtent[1]], getAxisDimIndex(axis));
    return {
      type: "Line",
      subPixelOptimize: true,
      shape: targetShape
    };
  },
  shadow: function(axis, pixelValue, otherExtent) {
    var bandWidth = Math.max(1, axis.getBandWidth());
    var span = otherExtent[1] - otherExtent[0];
    return {
      type: "Rect",
      shape: makeRectShape([pixelValue - bandWidth / 2, otherExtent[0]], [bandWidth, span], getAxisDimIndex(axis))
    };
  }
};
function getAxisDimIndex(axis) {
  return axis.dim === "x" ? 0 : 1;
}
var AxisPointerModel = (
  /** @class */
  function(_super) {
    __extends(AxisPointerModel2, _super);
    function AxisPointerModel2() {
      var _this = _super !== null && _super.apply(this, arguments) || this;
      _this.type = AxisPointerModel2.type;
      return _this;
    }
    AxisPointerModel2.type = "axisPointer";
    AxisPointerModel2.defaultOption = {
      // 'auto' means that show when triggered by tooltip or handle.
      show: "auto",
      // zlevel: 0,
      z: 50,
      type: "line",
      // axispointer triggered by tootip determine snap automatically,
      // see `modelHelper`.
      snap: false,
      triggerTooltip: true,
      triggerEmphasis: true,
      value: null,
      status: null,
      link: [],
      // Do not set 'auto' here, otherwise global animation: false
      // will not effect at this axispointer.
      animation: null,
      animationDurationUpdate: 200,
      lineStyle: {
        color: "#B9BEC9",
        width: 1,
        type: "dashed"
      },
      shadowStyle: {
        color: "rgba(210,219,238,0.2)"
      },
      label: {
        show: true,
        formatter: null,
        precision: "auto",
        margin: 3,
        color: "#fff",
        padding: [5, 7, 5, 7],
        backgroundColor: "auto",
        borderColor: null,
        borderWidth: 0,
        borderRadius: 3
      },
      handle: {
        show: false,
        // eslint-disable-next-line
        icon: "M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4h1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7v-1.2h6.6z M13.3,22H6.7v-1.2h6.6z M13.3,19.6H6.7v-1.2h6.6z",
        size: 45,
        // handle margin is from symbol center to axis, which is stable when circular move.
        margin: 50,
        // color: '#1b8bbd'
        // color: '#2f4554'
        color: "#333",
        shadowBlur: 3,
        shadowColor: "#aaa",
        shadowOffsetX: 0,
        shadowOffsetY: 2,
        // For mobile performance
        throttle: 40
      }
    };
    return AxisPointerModel2;
  }(ComponentModel)
);
var inner$1 = makeInner();
var each = each$1;
function register(key, api, handler) {
  if (env.node) {
    return;
  }
  var zr = api.getZr();
  inner$1(zr).records || (inner$1(zr).records = {});
  initGlobalListeners(zr, api);
  var record = inner$1(zr).records[key] || (inner$1(zr).records[key] = {});
  record.handler = handler;
}
function initGlobalListeners(zr, api) {
  if (inner$1(zr).initialized) {
    return;
  }
  inner$1(zr).initialized = true;
  useHandler("click", curry(doEnter, "click"));
  useHandler("mousemove", curry(doEnter, "mousemove"));
  useHandler("globalout", onLeave);
  function useHandler(eventType, cb) {
    zr.on(eventType, function(e) {
      var dis = makeDispatchAction$1(api);
      each(inner$1(zr).records, function(record) {
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
  if (showLen) {
    actuallyPayload = pendings.showTip[showLen - 1];
  } else if (hideLen) {
    actuallyPayload = pendings.hideTip[hideLen - 1];
  }
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
    if (pendingList) {
      pendingList.push(payload);
    } else {
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
  if (env.node) {
    return;
  }
  var zr = api.getZr();
  var record = (inner$1(zr).records || {})[key];
  if (record) {
    inner$1(zr).records[key] = null;
  }
}
var AxisPointerView = (
  /** @class */
  function(_super) {
    __extends(AxisPointerView2, _super);
    function AxisPointerView2() {
      var _this = _super !== null && _super.apply(this, arguments) || this;
      _this.type = AxisPointerView2.type;
      return _this;
    }
    AxisPointerView2.prototype.render = function(globalAxisPointerModel, ecModel, api) {
      var globalTooltipModel = ecModel.getComponent("tooltip");
      var triggerOn = globalAxisPointerModel.get("triggerOn") || globalTooltipModel && globalTooltipModel.get("triggerOn") || "mousemove|click";
      register("axisPointer", api, function(currTrigger, e, dispatchAction) {
        if (triggerOn !== "none" && (currTrigger === "leave" || triggerOn.indexOf(currTrigger) >= 0)) {
          dispatchAction({
            type: "updateAxisPointer",
            currTrigger,
            x: e && e.offsetX,
            y: e && e.offsetY
          });
        }
      });
    };
    AxisPointerView2.prototype.remove = function(ecModel, api) {
      unregister("axisPointer", api);
    };
    AxisPointerView2.prototype.dispose = function(ecModel, api) {
      unregister("axisPointer", api);
    };
    AxisPointerView2.type = "axisPointer";
    return AxisPointerView2;
  }(ComponentView)
);
function findPointFromSeries(finder, ecModel) {
  var point = [];
  var seriesIndex = finder.seriesIndex;
  var seriesModel;
  if (seriesIndex == null || !(seriesModel = ecModel.getSeriesByIndex(seriesIndex))) {
    return {
      point: []
    };
  }
  var data = seriesModel.getData();
  var dataIndex = queryDataIndex(data, finder);
  if (dataIndex == null || dataIndex < 0 || isArray(dataIndex)) {
    return {
      point: []
    };
  }
  var el = data.getItemGraphicEl(dataIndex);
  var coordSys = seriesModel.coordinateSystem;
  if (seriesModel.getTooltipPosition) {
    point = seriesModel.getTooltipPosition(dataIndex) || [];
  } else if (coordSys && coordSys.dataToPoint) {
    if (finder.isStacked) {
      var baseAxis = coordSys.getBaseAxis();
      var valueAxis2 = coordSys.getOtherAxis(baseAxis);
      var valueAxisDim = valueAxis2.dim;
      var baseAxisDim = baseAxis.dim;
      var baseDataOffset = valueAxisDim === "x" || valueAxisDim === "radius" ? 1 : 0;
      var baseDim = data.mapDimension(baseAxisDim);
      var stackedData = [];
      stackedData[baseDataOffset] = data.get(baseDim, dataIndex);
      stackedData[1 - baseDataOffset] = data.get(data.getCalculationInfo("stackResultDimension"), dataIndex);
      point = coordSys.dataToPoint(stackedData) || [];
    } else {
      point = coordSys.dataToPoint(data.getValues(map(coordSys.dimensions, function(dim) {
        return data.mapDimension(dim);
      }), dataIndex)) || [];
    }
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
var inner = makeInner();
function axisTrigger(payload, ecModel, api) {
  var currTrigger = payload.currTrigger;
  var point = [payload.x, payload.y];
  var finder = payload;
  var dispatchAction = payload.dispatchAction || bind$1(api.dispatchAction, api);
  var coordSysAxesInfo = ecModel.getComponent("axisPointer").coordSysAxesInfo;
  if (!coordSysAxesInfo) {
    return;
  }
  if (illegalPoint(point)) {
    point = findPointFromSeries({
      seriesIndex: finder.seriesIndex,
      // Do not use dataIndexInside from other ec instance.
      // FIXME: auto detect it?
      dataIndex: finder.dataIndex
    }, ecModel).point;
  }
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
    showPointer: curry(showPointer, showValueMap),
    showTooltip: curry(showTooltip, dataByCoordSys)
  };
  each$1(coordSysAxesInfo.coordSysMap, function(coordSys, coordSysKey) {
    var coordSysContainsPoint = isIllegalPoint || coordSys.containPoint(point);
    each$1(coordSysAxesInfo.coordSysAxesInfo[coordSysKey], function(axisInfo, key) {
      var axis = axisInfo.axis;
      var inputAxisInfo = findInputAxisInfo(inputAxesInfo, axisInfo);
      if (!shouldHide && coordSysContainsPoint && (!inputAxesInfo || inputAxisInfo)) {
        var val = inputAxisInfo && inputAxisInfo.value;
        if (val == null && !isIllegalPoint) {
          val = axis.pointToData(point);
        }
        val != null && processOnAxis(axisInfo, val, updaters, false, outputPayload);
      }
    });
  });
  var linkTriggers = {};
  each$1(axesInfo, function(tarAxisInfo, tarKey) {
    var linkGroup = tarAxisInfo.linkGroup;
    if (linkGroup && !showValueMap[tarKey]) {
      each$1(linkGroup.axesInfo, function(srcAxisInfo, srcKey) {
        var srcValItem = showValueMap[srcKey];
        if (srcAxisInfo !== tarAxisInfo && srcValItem) {
          var val = srcValItem.value;
          linkGroup.mapper && (val = tarAxisInfo.axis.scale.parse(linkGroup.mapper(val, makeMapperParam(srcAxisInfo), makeMapperParam(tarAxisInfo))));
          linkTriggers[tarAxisInfo.key] = val;
        }
      });
    }
  });
  each$1(linkTriggers, function(val, tarKey) {
    processOnAxis(axesInfo[tarKey], val, updaters, true, outputPayload);
  });
  updateModelActually(showValueMap, axesInfo, outputPayload);
  dispatchTooltipActually(dataByCoordSys, point, payload, dispatchAction);
  dispatchHighDownActually(axesInfo, dispatchAction, api);
  return outputPayload;
}
function processOnAxis(axisInfo, newValue, updaters, noSnap, outputFinder) {
  var axis = axisInfo.axis;
  if (axis.scale.isBlank() || !axis.containData(newValue)) {
    return;
  }
  if (!axisInfo.involveSeries) {
    updaters.showPointer(axisInfo, newValue);
    return;
  }
  var payloadInfo = buildPayloadsBySeries(newValue, axisInfo);
  var payloadBatch = payloadInfo.payloadBatch;
  var snapToValue = payloadInfo.snapToValue;
  if (payloadBatch[0] && outputFinder.seriesIndex == null) {
    extend(outputFinder, payloadBatch[0]);
  }
  if (!noSnap && axisInfo.snap) {
    if (axis.containData(snapToValue) && snapToValue != null) {
      newValue = snapToValue;
    }
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
  each$1(axisInfo.seriesModels, function(series, idx) {
    var dataDim = series.getData().mapDimensionsAll(dim);
    var seriesNestestValue;
    var dataIndices;
    if (series.getAxisTooltipData) {
      var result = series.getAxisTooltipData(dataDim, value, axis);
      dataIndices = result.dataIndices;
      seriesNestestValue = result.nestestValue;
    } else {
      dataIndices = series.getData().indicesOfNearest(
        dataDim[0],
        value,
        // Add a threshold to avoid find the wrong dataIndex
        // when data length is not same.
        // false,
        axis.type === "category" ? 0.5 : null
      );
      if (!dataIndices.length) {
        return;
      }
      seriesNestestValue = series.getData().get(dataDim[0], dataIndices[0]);
    }
    if (seriesNestestValue == null || !isFinite(seriesNestestValue)) {
      return;
    }
    var diff = value - seriesNestestValue;
    var dist = Math.abs(diff);
    if (dist <= minDist) {
      if (dist < minDist || diff >= 0 && minDiff < 0) {
        minDist = dist;
        minDiff = diff;
        snapToValue = seriesNestestValue;
        payloadBatch.length = 0;
      }
      each$1(dataIndices, function(dataIndex) {
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
  if (!axisInfo.triggerTooltip || !payloadBatch.length) {
    return;
  }
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
    // Caustion: viewHelper.getValueLabel is actually on "view stage", which
    // depends that all models have been updated. So it should not be performed
    // here. Considering axisPointerModel used here is volatile, which is hard
    // to be retrieve in TooltipView, we prepare parameters here.
    valueLabelOpt: {
      precision: axisPointerModel.get(["label", "precision"]),
      formatter: axisPointerModel.get(["label", "formatter"])
    },
    seriesDataIndices: payloadBatch.slice()
  });
}
function updateModelActually(showValueMap, axesInfo, outputPayload) {
  var outputAxesInfo = outputPayload.axesInfo = [];
  each$1(axesInfo, function(axisInfo, key) {
    var option = axisInfo.axisPointerModel.option;
    var valItem = showValueMap[key];
    if (valItem) {
      !axisInfo.useHandle && (option.status = "show");
      option.value = valItem.value;
      option.seriesDataIndices = (valItem.payloadBatch || []).slice();
    } else {
      !axisInfo.useHandle && (option.status = "hide");
    }
    option.status === "show" && outputAxesInfo.push({
      axisDim: axisInfo.axis.dim,
      axisIndex: axisInfo.axis.model.componentIndex,
      value: option.value
    });
  });
}
function dispatchTooltipActually(dataByCoordSys, point, payload, dispatchAction) {
  if (illegalPoint(point) || !dataByCoordSys.list.length) {
    dispatchAction({
      type: "hideTip"
    });
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
  each$1(axesInfo, function(axisInfo, key) {
    var option = axisInfo.axisPointerModel.option;
    option.status === "show" && axisInfo.triggerEmphasis && each$1(option.seriesDataIndices, function(batchItem) {
      var key2 = batchItem.seriesIndex + " | " + batchItem.dataIndex;
      newHighlights[key2] = batchItem;
    });
  });
  var toHighlight = [];
  var toDownplay = [];
  each$1(lastHighlights, function(batchItem, key) {
    !newHighlights[key] && toDownplay.push(batchItem);
  });
  each$1(newHighlights, function(batchItem, key) {
    !lastHighlights[key] && toHighlight.push(batchItem);
  });
  toDownplay.length && api.dispatchAction({
    type: "downplay",
    escapeConnect: true,
    // Not blur others when highlight in axisPointer.
    notBlur: true,
    batch: toDownplay
  });
  toHighlight.length && api.dispatchAction({
    type: "highlight",
    escapeConnect: true,
    // Not blur others when highlight in axisPointer.
    notBlur: true,
    batch: toHighlight
  });
}
function findInputAxisInfo(inputAxesInfo, axisInfo) {
  for (var i = 0; i < (inputAxesInfo || []).length; i++) {
    var inputAxisInfo = inputAxesInfo[i];
    if (axisInfo.axis.dim === inputAxisInfo.axisDim && axisInfo.axis.model.componentIndex === inputAxisInfo.axisIndex) {
      return inputAxisInfo;
    }
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
function install$2(registers) {
  AxisView.registerAxisPointerClass("CartesianAxisPointer", CartesianAxisPointer);
  registers.registerComponentModel(AxisPointerModel);
  registers.registerComponentView(AxisPointerView);
  registers.registerPreprocessor(function(option) {
    if (option) {
      (!option.axisPointer || option.axisPointer.length === 0) && (option.axisPointer = {});
      var link = option.axisPointer.link;
      if (link && !isArray(link)) {
        option.axisPointer.link = [link];
      }
    }
  });
  registers.registerProcessor(registers.PRIORITY.PROCESSOR.STATISTIC, function(ecModel, api) {
    ecModel.getComponent("axisPointer").coordSysAxesInfo = collect(ecModel, api);
  });
  registers.registerAction({
    type: "updateAxisPointer",
    event: "updateAxisPointer",
    update: ":updateAxisPointer"
  }, axisTrigger);
}
function install$1(registers) {
  use(install$3);
  use(install$2);
}
var TooltipModel = (
  /** @class */
  function(_super) {
    __extends(TooltipModel2, _super);
    function TooltipModel2() {
      var _this = _super !== null && _super.apply(this, arguments) || this;
      _this.type = TooltipModel2.type;
      return _this;
    }
    TooltipModel2.type = "tooltip";
    TooltipModel2.dependencies = ["axisPointer"];
    TooltipModel2.defaultOption = {
      // zlevel: 0,
      z: 60,
      show: true,
      // tooltip main content
      showContent: true,
      // 'trigger' only works on coordinate system.
      // 'item' | 'axis' | 'none'
      trigger: "item",
      // 'click' | 'mousemove' | 'none'
      triggerOn: "mousemove|click",
      alwaysShowContent: false,
      displayMode: "single",
      renderMode: "auto",
      // whether restraint content inside viewRect.
      // If renderMode: 'richText', default true.
      // If renderMode: 'html', defaut false (for backward compat).
      confine: null,
      showDelay: 0,
      hideDelay: 100,
      // Animation transition time, unit is second
      transitionDuration: 0.4,
      enterable: false,
      backgroundColor: "#fff",
      // box shadow
      shadowBlur: 10,
      shadowColor: "rgba(0, 0, 0, .2)",
      shadowOffsetX: 1,
      shadowOffsetY: 2,
      // tooltip border radius, unit is px, default is 4
      borderRadius: 4,
      // tooltip border width, unit is px, default is 0 (no border)
      borderWidth: 1,
      // Tooltip inside padding, default is 5 for all direction
      // Array is allowed to set up, right, bottom, left, same with css
      // The default value: See `tooltip/tooltipMarkup.ts#getPaddingFromTooltipModel`.
      padding: null,
      // Extra css text
      extraCssText: "",
      // axis indicator, trigger by axis
      axisPointer: {
        // default is line
        // legal values: 'line' | 'shadow' | 'cross'
        type: "line",
        // Valid when type is line, appoint tooltip line locate on which line. Optional
        // legal values: 'x' | 'y' | 'angle' | 'radius' | 'auto'
        // default is 'auto', chose the axis which type is category.
        // for multiply y axis, cartesian coord chose x axis, polar chose angle axis
        axis: "auto",
        animation: "auto",
        animationDurationUpdate: 200,
        animationEasingUpdate: "exponentialOut",
        crossStyle: {
          color: "#999",
          width: 1,
          type: "dashed",
          // TODO formatter
          textStyle: {}
        }
        // lineStyle and shadowStyle should not be specified here,
        // otherwise it will always override those styles on option.axisPointer.
      },
      textStyle: {
        color: "#666",
        fontSize: 14
      }
    };
    return TooltipModel2;
  }(ComponentModel)
);
function shouldTooltipConfine(tooltipModel) {
  var confineOption = tooltipModel.get("confine");
  return confineOption != null ? !!confineOption : tooltipModel.get("renderMode") === "richText";
}
function testStyle(styleProps) {
  if (!env.domSupported) {
    return;
  }
  var style = document.documentElement.style;
  for (var i = 0, len = styleProps.length; i < len; i++) {
    if (styleProps[i] in style) {
      return styleProps[i];
    }
  }
}
var TRANSFORM_VENDOR = testStyle(["transform", "webkitTransform", "OTransform", "MozTransform", "msTransform"]);
var TRANSITION_VENDOR = testStyle(["webkitTransition", "transition", "OTransition", "MozTransition", "msTransition"]);
function toCSSVendorPrefix(styleVendor, styleProp) {
  if (!styleVendor) {
    return styleProp;
  }
  styleProp = toCamelCase(styleProp, true);
  var idx = styleVendor.indexOf(styleProp);
  styleVendor = idx === -1 ? styleProp : "-" + styleVendor.slice(0, idx) + "-" + styleProp;
  return styleVendor.toLowerCase();
}
function getComputedStyle(el, style) {
  var stl = el.currentStyle || document.defaultView && document.defaultView.getComputedStyle(el);
  return stl ? stl[style] : null;
}
var CSS_TRANSITION_VENDOR = toCSSVendorPrefix(TRANSITION_VENDOR, "transition");
var CSS_TRANSFORM_VENDOR = toCSSVendorPrefix(TRANSFORM_VENDOR, "transform");
var gCssText = "position:absolute;display:block;border-style:solid;white-space:nowrap;z-index:9999999;" + (env.transform3dSupported ? "will-change:transform;" : "");
function mirrorPos(pos) {
  pos = pos === "left" ? "right" : pos === "right" ? "left" : pos === "top" ? "bottom" : "top";
  return pos;
}
function assembleArrow(tooltipModel, borderColor, arrowPosition) {
  if (!isString(arrowPosition) || arrowPosition === "inside") {
    return "";
  }
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
  var styleCss = ["position:absolute;width:" + arrowSize + "px;height:" + arrowSize + "px;z-index:-1;", positionStyle + ";" + transformStyle + ";", "border-bottom:" + borderStyle, "border-right:" + borderStyle, "background-color:" + backgroundColor + ";"];
  return '<div style="' + styleCss.join("") + '"></div>';
}
function assembleTransition(duration, onlyFade) {
  var transitionCurve = "cubic-bezier(0.23,1,0.32,1)";
  var transitionOption = " " + duration / 2 + "s " + transitionCurve;
  var transitionText = "opacity" + transitionOption + ",visibility" + transitionOption;
  if (!onlyFade) {
    transitionOption = " " + duration + "s " + transitionCurve;
    transitionText += env.transformSupported ? "," + CSS_TRANSFORM_VENDOR + transitionOption : ",left" + transitionOption + ",top" + transitionOption;
  }
  return CSS_TRANSITION_VENDOR + ":" + transitionText;
}
function assembleTransform(x, y, toString) {
  var x0 = x.toFixed(0) + "px";
  var y0 = y.toFixed(0) + "px";
  if (!env.transformSupported) {
    return toString ? "top:" + y0 + ";left:" + x0 + ";" : [["top", y0], ["left", x0]];
  }
  var is3d = env.transform3dSupported;
  var translate2 = "translate" + (is3d ? "3d" : "") + "(" + x0 + "," + y0 + (is3d ? ",0" : "") + ")";
  return toString ? "top:0;left:0;" + CSS_TRANSFORM_VENDOR + ":" + translate2 + ";" : [["top", 0], ["left", 0], [TRANSFORM_VENDOR, translate2]];
}
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
  each$1(["decoration", "align"], function(name) {
    var val = textStyleModel.get(name);
    val && cssText.push("text-" + name + ":" + val);
  });
  return cssText.join(";");
}
function assembleCssText(tooltipModel, enableTransition, onlyFade) {
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
  enableTransition && transitionDuration && cssText.push(assembleTransition(transitionDuration, onlyFade));
  if (backgroundColor) {
    cssText.push("background-color:" + backgroundColor);
  }
  each$1(["width", "color", "radius"], function(name) {
    var borderName = "border-" + name;
    var camelCase = toCamelCase(borderName);
    var val = tooltipModel.get(camelCase);
    val != null && cssText.push(borderName + ":" + val + (name === "color" ? "" : "px"));
  });
  cssText.push(assembleFont(textStyleModel));
  if (padding != null) {
    cssText.push("padding:" + normalizeCssArray(padding).join("px ") + "px");
  }
  return cssText.join(";") + ";";
}
function makeStyleCoord$1(out, zr, container, zrX, zrY) {
  var zrPainter = zr && zr.painter;
  if (container) {
    var zrViewportRoot = zrPainter && zrPainter.getViewportRoot();
    if (zrViewportRoot) {
      transformLocalCoord(out, zrViewportRoot, container, zrX, zrY);
    }
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
var TooltipHTMLContent = (
  /** @class */
  function() {
    function TooltipHTMLContent2(api, opt) {
      this._show = false;
      this._styleCoord = [0, 0, 0, 0];
      this._enterable = true;
      this._alwaysShowContent = false;
      this._firstShow = true;
      this._longHide = true;
      if (env.wxa) {
        return null;
      }
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
          if (self._show) {
            self.hideLater(self._hideDelay);
          }
        }
      };
    }
    TooltipHTMLContent2.prototype.update = function(tooltipModel) {
      if (!this._container) {
        var container = this._api.getDom();
        var position = getComputedStyle(container, "position");
        var domStyle = container.style;
        if (domStyle.position !== "absolute" && position !== "absolute") {
          domStyle.position = "relative";
        }
      }
      var alwaysShowContent = tooltipModel.get("alwaysShowContent");
      alwaysShowContent && this._moveIfResized();
      this._alwaysShowContent = alwaysShowContent;
      this.el.className = tooltipModel.get("className") || "";
    };
    TooltipHTMLContent2.prototype.show = function(tooltipModel, nearPointColor) {
      clearTimeout(this._hideTimeout);
      clearTimeout(this._longHideTimeout);
      var el = this.el;
      var style = el.style;
      var styleCoord = this._styleCoord;
      if (!el.innerHTML) {
        style.display = "none";
      } else {
        style.cssText = gCssText + assembleCssText(tooltipModel, !this._firstShow, this._longHide) + assembleTransform(styleCoord[0], styleCoord[1], true) + ("border-color:" + convertToColorString(nearPointColor) + ";") + (tooltipModel.get("extraCssText") || "") + (";pointer-events:" + (this._enterable ? "auto" : "none"));
      }
      this._show = true;
      this._firstShow = false;
      this._longHide = false;
    };
    TooltipHTMLContent2.prototype.setContent = function(content, markers, tooltipModel, borderColor, arrowPosition) {
      var el = this.el;
      if (content == null) {
        el.innerHTML = "";
        return;
      }
      var arrow = "";
      if (isString(arrowPosition) && tooltipModel.get("trigger") === "item" && !shouldTooltipConfine(tooltipModel)) {
        arrow = assembleArrow(tooltipModel, borderColor, arrowPosition);
      }
      if (isString(content)) {
        el.innerHTML = content + arrow;
      } else if (content) {
        el.innerHTML = "";
        if (!isArray(content)) {
          content = [content];
        }
        for (var i = 0; i < content.length; i++) {
          if (isDom(content[i]) && content[i].parentNode !== el) {
            el.appendChild(content[i]);
          }
        }
        if (arrow && el.childNodes.length) {
          var arrowEl = document.createElement("div");
          arrowEl.innerHTML = arrow;
          el.appendChild(arrowEl);
        }
      }
    };
    TooltipHTMLContent2.prototype.setEnterable = function(enterable) {
      this._enterable = enterable;
    };
    TooltipHTMLContent2.prototype.getSize = function() {
      var el = this.el;
      return el ? [el.offsetWidth, el.offsetHeight] : [0, 0];
    };
    TooltipHTMLContent2.prototype.moveTo = function(zrX, zrY) {
      if (!this.el) {
        return;
      }
      var styleCoord = this._styleCoord;
      makeStyleCoord$1(styleCoord, this._zr, this._container, zrX, zrY);
      if (styleCoord[0] != null && styleCoord[1] != null) {
        var style_1 = this.el.style;
        var transforms = assembleTransform(styleCoord[0], styleCoord[1]);
        each$1(transforms, function(transform) {
          style_1[transform[0]] = transform[1];
        });
      }
    };
    TooltipHTMLContent2.prototype._moveIfResized = function() {
      var ratioX = this._styleCoord[2];
      var ratioY = this._styleCoord[3];
      this.moveTo(ratioX * this._zr.getWidth(), ratioY * this._zr.getHeight());
    };
    TooltipHTMLContent2.prototype.hide = function() {
      var _this = this;
      var style = this.el.style;
      style.visibility = "hidden";
      style.opacity = "0";
      env.transform3dSupported && (style.willChange = "");
      this._show = false;
      this._longHideTimeout = setTimeout(function() {
        return _this._longHide = true;
      }, 500);
    };
    TooltipHTMLContent2.prototype.hideLater = function(time) {
      if (this._show && !(this._inContent && this._enterable) && !this._alwaysShowContent) {
        if (time) {
          this._hideDelay = time;
          this._show = false;
          this._hideTimeout = setTimeout(bind$1(this.hide, this), time);
        } else {
          this.hide();
        }
      }
    };
    TooltipHTMLContent2.prototype.isShow = function() {
      return this._show;
    };
    TooltipHTMLContent2.prototype.dispose = function() {
      clearTimeout(this._hideTimeout);
      clearTimeout(this._longHideTimeout);
      var parentNode = this.el.parentNode;
      parentNode && parentNode.removeChild(this.el);
      this.el = this._container = null;
    };
    return TooltipHTMLContent2;
  }()
);
var TooltipRichContent = (
  /** @class */
  function() {
    function TooltipRichContent2(api) {
      this._show = false;
      this._styleCoord = [0, 0, 0, 0];
      this._alwaysShowContent = false;
      this._enterable = true;
      this._zr = api.getZr();
      makeStyleCoord(this._styleCoord, this._zr, api.getWidth() / 2, api.getHeight() / 2);
    }
    TooltipRichContent2.prototype.update = function(tooltipModel) {
      var alwaysShowContent = tooltipModel.get("alwaysShowContent");
      alwaysShowContent && this._moveIfResized();
      this._alwaysShowContent = alwaysShowContent;
    };
    TooltipRichContent2.prototype.show = function() {
      if (this._hideTimeout) {
        clearTimeout(this._hideTimeout);
      }
      this.el.show();
      this._show = true;
    };
    TooltipRichContent2.prototype.setContent = function(content, markupStyleCreator, tooltipModel, borderColor, arrowPosition) {
      var _this = this;
      if (isObject(content)) {
        throwError(process.env.NODE_ENV !== "production" ? "Passing DOM nodes as content is not supported in richText tooltip!" : "");
      }
      if (this.el) {
        this._zr.remove(this.el);
      }
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
      each$1(["backgroundColor", "borderRadius", "shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY"], function(propName) {
        _this.el.style[propName] = tooltipModel.get(propName);
      });
      each$1(["textShadowBlur", "textShadowOffsetX", "textShadowOffsetY"], function(propName) {
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
          if (self._show) {
            self.hideLater(self._hideDelay);
          }
        }
        self._inContent = false;
      });
    };
    TooltipRichContent2.prototype.setEnterable = function(enterable) {
      this._enterable = enterable;
    };
    TooltipRichContent2.prototype.getSize = function() {
      var el = this.el;
      var bounding = this.el.getBoundingRect();
      var shadowOuterSize = calcShadowOuterSize(el.style);
      return [bounding.width + shadowOuterSize.left + shadowOuterSize.right, bounding.height + shadowOuterSize.top + shadowOuterSize.bottom];
    };
    TooltipRichContent2.prototype.moveTo = function(x, y) {
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
    TooltipRichContent2.prototype._moveIfResized = function() {
      var ratioX = this._styleCoord[2];
      var ratioY = this._styleCoord[3];
      this.moveTo(ratioX * this._zr.getWidth(), ratioY * this._zr.getHeight());
    };
    TooltipRichContent2.prototype.hide = function() {
      if (this.el) {
        this.el.hide();
      }
      this._show = false;
    };
    TooltipRichContent2.prototype.hideLater = function(time) {
      if (this._show && !(this._inContent && this._enterable) && !this._alwaysShowContent) {
        if (time) {
          this._hideDelay = time;
          this._show = false;
          this._hideTimeout = setTimeout(bind$1(this.hide, this), time);
        } else {
          this.hide();
        }
      }
    };
    TooltipRichContent2.prototype.isShow = function() {
      return this._show;
    };
    TooltipRichContent2.prototype.dispose = function() {
      this._zr.remove(this.el);
    };
    return TooltipRichContent2;
  }()
);
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
var proxyRect = new Rect({
  shape: {
    x: -1,
    y: -1,
    width: 2,
    height: 2
  }
});
var TooltipView = (
  /** @class */
  function(_super) {
    __extends(TooltipView2, _super);
    function TooltipView2() {
      var _this = _super !== null && _super.apply(this, arguments) || this;
      _this.type = TooltipView2.type;
      return _this;
    }
    TooltipView2.prototype.init = function(ecModel, api) {
      if (env.node || !api.getDom()) {
        return;
      }
      var tooltipModel = ecModel.getComponent("tooltip");
      var renderMode = this._renderMode = getTooltipRenderMode(tooltipModel.get("renderMode"));
      this._tooltipContent = renderMode === "richText" ? new TooltipRichContent(api) : new TooltipHTMLContent(api, {
        appendTo: tooltipModel.get("appendToBody", true) ? "body" : tooltipModel.get("appendTo", true)
      });
    };
    TooltipView2.prototype.render = function(tooltipModel, ecModel, api) {
      if (env.node || !api.getDom()) {
        return;
      }
      this.group.removeAll();
      this._tooltipModel = tooltipModel;
      this._ecModel = ecModel;
      this._api = api;
      var tooltipContent = this._tooltipContent;
      tooltipContent.update(tooltipModel);
      tooltipContent.setEnterable(tooltipModel.get("enterable"));
      this._initGlobalListener();
      this._keepShow();
      if (this._renderMode !== "richText" && tooltipModel.get("transitionDuration")) {
        createOrUpdate(this, "_updatePosition", 50, "fixRate");
      } else {
        clear(this, "_updatePosition");
      }
    };
    TooltipView2.prototype._initGlobalListener = function() {
      var tooltipModel = this._tooltipModel;
      var triggerOn = tooltipModel.get("triggerOn");
      register("itemTooltip", this._api, bind$1(function(currTrigger, e, dispatchAction) {
        if (triggerOn !== "none") {
          if (triggerOn.indexOf(currTrigger) >= 0) {
            this._tryShow(e, dispatchAction);
          } else if (currTrigger === "leave") {
            this._hide(dispatchAction);
          }
        }
      }, this));
    };
    TooltipView2.prototype._keepShow = function() {
      var tooltipModel = this._tooltipModel;
      var ecModel = this._ecModel;
      var api = this._api;
      var triggerOn = tooltipModel.get("triggerOn");
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
    TooltipView2.prototype.manuallyShowTip = function(tooltipModel, ecModel, api, payload) {
      if (payload.from === this.uid || env.node || !api.getDom()) {
        return;
      }
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
          // When manully trigger, the mouse is not on the el, so we'd better to
          // position tooltip on the bottom of the el and display arrow is possible.
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
      } else if (dataByCoordSys) {
        this._tryShow({
          offsetX: payload.x,
          offsetY: payload.y,
          position: payload.position,
          dataByCoordSys,
          tooltipOption: payload.tooltipOption
        }, dispatchAction);
      } else if (payload.seriesIndex != null) {
        if (this._manuallyAxisShowTip(tooltipModel, ecModel, api, payload)) {
          return;
        }
        var pointInfo = findPointFromSeries(payload, ecModel);
        var cx = pointInfo.point[0];
        var cy = pointInfo.point[1];
        if (cx != null && cy != null) {
          this._tryShow({
            offsetX: cx,
            offsetY: cy,
            target: pointInfo.el,
            position: payload.position,
            // When manully trigger, the mouse is not on the el, so we'd better to
            // position tooltip on the bottom of the el and display arrow is possible.
            positionDefault: "bottom"
          }, dispatchAction);
        }
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
    TooltipView2.prototype.manuallyHideTip = function(tooltipModel, ecModel, api, payload) {
      var tooltipContent = this._tooltipContent;
      if (this._tooltipModel) {
        tooltipContent.hideLater(this._tooltipModel.get("hideDelay"));
      }
      this._lastX = this._lastY = this._lastDataByCoordSys = null;
      if (payload.from !== this.uid) {
        this._hide(makeDispatchAction(payload, api));
      }
    };
    TooltipView2.prototype._manuallyAxisShowTip = function(tooltipModel, ecModel, api, payload) {
      var seriesIndex = payload.seriesIndex;
      var dataIndex = payload.dataIndex;
      var coordSysAxesInfo = ecModel.getComponent("axisPointer").coordSysAxesInfo;
      if (seriesIndex == null || dataIndex == null || coordSysAxesInfo == null) {
        return;
      }
      var seriesModel = ecModel.getSeriesByIndex(seriesIndex);
      if (!seriesModel) {
        return;
      }
      var data = seriesModel.getData();
      var tooltipCascadedModel = buildTooltipModel([data.getItemModel(dataIndex), seriesModel, (seriesModel.coordinateSystem || {}).model], this._tooltipModel);
      if (tooltipCascadedModel.get("trigger") !== "axis") {
        return;
      }
      api.dispatchAction({
        type: "updateAxisPointer",
        seriesIndex,
        dataIndex,
        position: payload.position
      });
      return true;
    };
    TooltipView2.prototype._tryShow = function(e, dispatchAction) {
      var el = e.target;
      var tooltipModel = this._tooltipModel;
      if (!tooltipModel) {
        return;
      }
      this._lastX = e.offsetX;
      this._lastY = e.offsetY;
      var dataByCoordSys = e.dataByCoordSys;
      if (dataByCoordSys && dataByCoordSys.length) {
        this._showAxisTooltip(dataByCoordSys, e);
      } else if (el) {
        var ecData = getECData(el);
        if (ecData.ssrType === "legend") {
          return;
        }
        this._lastDataByCoordSys = null;
        var seriesDispatcher_1;
        var cmptDispatcher_1;
        findEventDispatcher(el, function(target) {
          if (getECData(target).dataIndex != null) {
            seriesDispatcher_1 = target;
            return true;
          }
          if (getECData(target).tooltipConfig != null) {
            cmptDispatcher_1 = target;
            return true;
          }
        }, true);
        if (seriesDispatcher_1) {
          this._showSeriesItemTooltip(e, seriesDispatcher_1, dispatchAction);
        } else if (cmptDispatcher_1) {
          this._showComponentItemTooltip(e, cmptDispatcher_1, dispatchAction);
        } else {
          this._hide(dispatchAction);
        }
      } else {
        this._lastDataByCoordSys = null;
        this._hide(dispatchAction);
      }
    };
    TooltipView2.prototype._showOrMove = function(tooltipModel, cb) {
      var delay = tooltipModel.get("showDelay");
      cb = bind$1(cb, this);
      clearTimeout(this._showTimout);
      delay > 0 ? this._showTimout = setTimeout(cb, delay) : cb();
    };
    TooltipView2.prototype._showAxisTooltip = function(dataByCoordSys, e) {
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
      each$1(dataByCoordSys, function(itemCoordSys) {
        each$1(itemCoordSys.dataByAxis, function(axisItem) {
          var axisModel = ecModel.getComponent(axisItem.axisDim + "Axis", axisItem.axisIndex);
          var axisValue = axisItem.value;
          if (!axisModel || axisValue == null) {
            return;
          }
          var axisValueLabel = getValueLabel(axisValue, axisModel.axis, ecModel, axisItem.seriesDataIndices, axisItem.valueLabelOpt);
          var axisSectionMarkup = createTooltipMarkup("section", {
            header: axisValueLabel,
            noHeader: !trim(axisValueLabel),
            sortBlocks: true,
            blocks: []
          });
          articleMarkup.blocks.push(axisSectionMarkup);
          each$1(axisItem.seriesDataIndices, function(idxItem) {
            var series = ecModel.getSeriesByIndex(idxItem.seriesIndex);
            var dataIndex = idxItem.dataIndexInside;
            var cbParams = series.getDataParams(dataIndex);
            if (cbParams.dataIndex < 0) {
              return;
            }
            cbParams.axisDim = axisItem.axisDim;
            cbParams.axisIndex = axisItem.axisIndex;
            cbParams.axisType = axisItem.axisType;
            cbParams.axisId = axisItem.axisId;
            cbParams.axisValue = getAxisRawValue(axisModel.axis, {
              value: axisValue
            });
            cbParams.axisValueLabel = axisValueLabel;
            cbParams.marker = markupStyleCreator.makeTooltipMarker("item", convertToColorString(cbParams.color), renderMode);
            var seriesTooltipResult = normalizeTooltipFormatResult(series.formatTooltip(dataIndex, true, null));
            var frag = seriesTooltipResult.frag;
            if (frag) {
              var valueFormatter = buildTooltipModel([series], globalTooltipModel).get("valueFormatter");
              axisSectionMarkup.blocks.push(valueFormatter ? extend({
                valueFormatter
              }, frag) : frag);
            }
            if (seriesTooltipResult.text) {
              markupTextArrLegacy.push(seriesTooltipResult.text);
            }
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
        if (this._updateContentNotChangedOnAxis(dataByCoordSys, cbParamsList)) {
          this._updatePosition(singleTooltipModel, positionExpr, point[0], point[1], this._tooltipContent, cbParamsList);
        } else {
          this._showTooltipContent(singleTooltipModel, allMarkupText, cbParamsList, Math.random() + "", point[0], point[1], positionExpr, null, markupStyleCreator);
        }
      });
    };
    TooltipView2.prototype._showSeriesItemTooltip = function(e, dispatcher, dispatchAction) {
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
      var tooltipModel = buildTooltipModel([data.getItemModel(dataIndex), dataModel, seriesModel && (seriesModel.coordinateSystem || {}).model], this._tooltipModel, positionDefault ? {
        position: positionDefault
      } : null);
      var tooltipTrigger = tooltipModel.get("trigger");
      if (tooltipTrigger != null && tooltipTrigger !== "item") {
        return;
      }
      var params = dataModel.getDataParams(dataIndex, dataType);
      var markupStyleCreator = new TooltipMarkupStyleCreator();
      params.marker = markupStyleCreator.makeTooltipMarker("item", convertToColorString(params.color), renderMode);
      var seriesTooltipResult = normalizeTooltipFormatResult(dataModel.formatTooltip(dataIndex, false, dataType));
      var orderMode = tooltipModel.get("order");
      var valueFormatter = tooltipModel.get("valueFormatter");
      var frag = seriesTooltipResult.frag;
      var markupText = frag ? buildTooltipMarkup(valueFormatter ? extend({
        valueFormatter
      }, frag) : frag, markupStyleCreator, renderMode, orderMode, ecModel.get("useUTC"), tooltipModel.get("textStyle")) : seriesTooltipResult.text;
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
    TooltipView2.prototype._showComponentItemTooltip = function(e, el, dispatchAction) {
      var isHTMLRenderMode = this._renderMode === "html";
      var ecData = getECData(el);
      var tooltipConfig = ecData.tooltipConfig;
      var tooltipOpt = tooltipConfig.option || {};
      var encodeHTMLContent = tooltipOpt.encodeHTMLContent;
      if (isString(tooltipOpt)) {
        var content = tooltipOpt;
        tooltipOpt = {
          content,
          // Fixed formatter
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
      if (cmpt) {
        tooltipModelCascade.push(cmpt);
      }
      tooltipModelCascade.push({
        formatter: tooltipOpt.content
      });
      var positionDefault = e.positionDefault;
      var subTooltipModel = buildTooltipModel(tooltipModelCascade, this._tooltipModel, positionDefault ? {
        position: positionDefault
      } : null);
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
    TooltipView2.prototype._showTooltipContent = function(tooltipModel, defaultHtml, params, asyncTicket, x, y, positionExpr, el, markupStyleCreator) {
      this._ticket = "";
      if (!tooltipModel.get("showContent") || !tooltipModel.get("show")) {
        return;
      }
      var tooltipContent = this._tooltipContent;
      tooltipContent.setEnterable(tooltipModel.get("enterable"));
      var formatter = tooltipModel.get("formatter");
      positionExpr = positionExpr || tooltipModel.get("position");
      var html = defaultHtml;
      var nearPoint = this._getNearestPoint([x, y], params, tooltipModel.get("trigger"), tooltipModel.get("borderColor"));
      var nearPointColor = nearPoint.color;
      if (formatter) {
        if (isString(formatter)) {
          var useUTC = tooltipModel.ecModel.get("useUTC");
          var params0 = isArray(params) ? params[0] : params;
          var isTimeAxis = params0 && params0.axisType && params0.axisType.indexOf("time") >= 0;
          html = formatter;
          if (isTimeAxis) {
            html = format(params0.axisValue, html, useUTC);
          }
          html = formatTpl(html, params, true);
        } else if (isFunction(formatter)) {
          var callback = bind$1(function(cbTicket, html2) {
            if (cbTicket === this._ticket) {
              tooltipContent.setContent(html2, markupStyleCreator, tooltipModel, nearPointColor, positionExpr);
              this._updatePosition(tooltipModel, positionExpr, x, y, tooltipContent, params, el);
            }
          }, this);
          this._ticket = asyncTicket;
          html = formatter(params, asyncTicket, callback);
        } else {
          html = formatter;
        }
      }
      tooltipContent.setContent(html, markupStyleCreator, tooltipModel, nearPointColor, positionExpr);
      tooltipContent.show(tooltipModel, nearPointColor);
      this._updatePosition(tooltipModel, positionExpr, x, y, tooltipContent, params, el);
    };
    TooltipView2.prototype._getNearestPoint = function(point, tooltipDataParams, trigger, borderColor) {
      if (trigger === "axis" || isArray(tooltipDataParams)) {
        return {
          color: borderColor || (this._renderMode === "html" ? "#fff" : "none")
        };
      }
      if (!isArray(tooltipDataParams)) {
        return {
          color: borderColor || tooltipDataParams.color || tooltipDataParams.borderColor
        };
      }
    };
    TooltipView2.prototype._updatePosition = function(tooltipModel, positionExpr, x, y, content, params, el) {
      var viewWidth = this._api.getWidth();
      var viewHeight = this._api.getHeight();
      positionExpr = positionExpr || tooltipModel.get("position");
      var contentSize = content.getSize();
      var align = tooltipModel.get("align");
      var vAlign = tooltipModel.get("verticalAlign");
      var rect = el && el.getBoundingRect().clone();
      el && rect.applyTransform(el.transform);
      if (isFunction(positionExpr)) {
        positionExpr = positionExpr([x, y], params, content.el, rect, {
          viewSize: [viewWidth, viewHeight],
          contentSize: contentSize.slice()
        });
      }
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
    TooltipView2.prototype._updateContentNotChangedOnAxis = function(dataByCoordSys, cbParamsList) {
      var lastCoordSys = this._lastDataByCoordSys;
      var lastCbParamsList = this._cbParamsList;
      var contentNotChanged = !!lastCoordSys && lastCoordSys.length === dataByCoordSys.length;
      contentNotChanged && each$1(lastCoordSys, function(lastItemCoordSys, indexCoordSys) {
        var lastDataByAxis = lastItemCoordSys.dataByAxis || [];
        var thisItemCoordSys = dataByCoordSys[indexCoordSys] || {};
        var thisDataByAxis = thisItemCoordSys.dataByAxis || [];
        contentNotChanged = contentNotChanged && lastDataByAxis.length === thisDataByAxis.length;
        contentNotChanged && each$1(lastDataByAxis, function(lastItem, indexAxis) {
          var thisItem = thisDataByAxis[indexAxis] || {};
          var lastIndices = lastItem.seriesDataIndices || [];
          var newIndices = thisItem.seriesDataIndices || [];
          contentNotChanged = contentNotChanged && lastItem.value === thisItem.value && lastItem.axisType === thisItem.axisType && lastItem.axisId === thisItem.axisId && lastIndices.length === newIndices.length;
          contentNotChanged && each$1(lastIndices, function(lastIdxItem, j) {
            var newIdxItem = newIndices[j];
            contentNotChanged = contentNotChanged && lastIdxItem.seriesIndex === newIdxItem.seriesIndex && lastIdxItem.dataIndex === newIdxItem.dataIndex;
          });
          lastCbParamsList && each$1(lastItem.seriesDataIndices, function(idxItem) {
            var seriesIdx = idxItem.seriesIndex;
            var cbParams = cbParamsList[seriesIdx];
            var lastCbParams = lastCbParamsList[seriesIdx];
            if (cbParams && lastCbParams && lastCbParams.data !== cbParams.data) {
              contentNotChanged = false;
            }
          });
        });
      });
      this._lastDataByCoordSys = dataByCoordSys;
      this._cbParamsList = cbParamsList;
      return !!contentNotChanged;
    };
    TooltipView2.prototype._hide = function(dispatchAction) {
      this._lastDataByCoordSys = null;
      dispatchAction({
        type: "hideTip",
        from: this.uid
      });
    };
    TooltipView2.prototype.dispose = function(ecModel, api) {
      if (env.node || !api.getDom()) {
        return;
      }
      clear(this, "_updatePosition");
      this._tooltipContent.dispose();
      unregister("itemTooltip", api);
    };
    TooltipView2.type = "tooltip";
    return TooltipView2;
  }(ComponentView)
);
function buildTooltipModel(modelCascade, globalTooltipModel, defaultTooltipOption) {
  var ecModel = globalTooltipModel.ecModel;
  var resultModel;
  if (defaultTooltipOption) {
    resultModel = new Model(defaultTooltipOption, ecModel, ecModel);
    resultModel = new Model(globalTooltipModel.option, resultModel, ecModel);
  } else {
    resultModel = globalTooltipModel;
  }
  for (var i = modelCascade.length - 1; i >= 0; i--) {
    var tooltipOpt = modelCascade[i];
    if (tooltipOpt) {
      if (tooltipOpt instanceof Model) {
        tooltipOpt = tooltipOpt.get("tooltip", true);
      }
      if (isString(tooltipOpt)) {
        tooltipOpt = {
          formatter: tooltipOpt
        };
      }
      if (tooltipOpt) {
        resultModel = new Model(tooltipOpt, resultModel, ecModel);
      }
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
    if (x + width + gapH + 2 > viewWidth) {
      x -= width + gapH;
    } else {
      x += gapH;
    }
  }
  if (gapV != null) {
    if (y + height + gapV > viewHeight) {
      y -= height + gapV;
    } else {
      y += gapV;
    }
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
function findComponentReference(payload, ecModel, api) {
  var queryOptionMap = preParseFinder(payload).queryOptionMap;
  var componentMainType = queryOptionMap.keys()[0];
  if (!componentMainType || componentMainType === "series") {
    return;
  }
  var queryResult = queryReferringComponents(ecModel, componentMainType, queryOptionMap.get(componentMainType), {
    useDefault: false,
    enableAll: false,
    enableNone: false
  });
  var model = queryResult.models[0];
  if (!model) {
    return;
  }
  var view = api.getViewOfComponentModel(model);
  var el;
  view.group.traverse(function(subEl) {
    var tooltipConfig = getECData(subEl).tooltipConfig;
    if (tooltipConfig && tooltipConfig.name === payload.name) {
      el = subEl;
      return true;
    }
  });
  if (el) {
    return {
      componentMainType,
      componentIndex: model.componentIndex,
      el
    };
  }
}
function install(registers) {
  use(install$2);
  registers.registerComponentModel(TooltipModel);
  registers.registerComponentView(TooltipView);
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
export {
  install$2 as AxisPointerComponent,
  install$1 as GridComponent,
  install$3 as GridSimpleComponent,
  install as TooltipComponent
};
