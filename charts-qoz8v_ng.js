import { _ as __extends, r as isArray, Z as ZRImage, o as extend, t as isObject, g as map, F as isNumber, P as PathProxy, G as cubicRootAt, H as Path, I as cubicAt, s as isFunction, j as bind, n as defaults, e as each, J as lerp, u as isString, K as calculateTextPosition, L as parsePercent, l as curry } from "./Image-DY6RhQFr.js";
import { c as createSeriesData } from "./createSeriesData-D4D0BTKA.js";
import { G as Group, a as createSymbol, af as SeriesModel, ai as retrieveRawValue, aj as enterEmphasis, ak as leaveEmphasis, a3 as updateProps, al as saveOldStyle, Y as initProps, am as getLabelStatesModels, an as normalizeSymbolOffset, ao as setLabelStyle, ap as toggleHoverEmphasis, d as getECData, aq as removeElement, ar as normalizeSymbolSize, as as traverseElements, i as isDimensionStacked, at as createFloat32Array, K as Rect, z as round, S as Sector, au as convertToColorString, av as setStatesStylesFromModel, aw as queryDataIndex, ad as ChartView, ax as setStatesFlag, Z as ZRText, ay as interpolateRawValues, az as labelInner, H as LinearGradient, aA as SPECIAL_STATES, aB as createRenderPlanner, aC as inheritDefaultOption, aD as warn, aE as removeElementWithFadeOut, aF as setLabelValueAnimation, ah as throttle, aG as createProgressiveLayout, aH as layout } from "./barGrid-B8918HIn.js";
var LineSeriesModel = (
  /** @class */
  function(_super) {
    __extends(LineSeriesModel2, _super);
    function LineSeriesModel2() {
      var _this = _super !== null && _super.apply(this, arguments) || this;
      _this.type = LineSeriesModel2.type;
      _this.hasSymbolVisual = true;
      return _this;
    }
    LineSeriesModel2.prototype.getInitialData = function(option) {
      if (process.env.NODE_ENV !== "production") {
        var coordSys = option.coordinateSystem;
        if (coordSys !== "polar" && coordSys !== "cartesian2d") {
          throw new Error("Line not support coordinateSystem besides cartesian and polar");
        }
      }
      return createSeriesData(null, this, {
        useEncodeDefaulter: true
      });
    };
    LineSeriesModel2.prototype.getLegendIcon = function(opt) {
      var group = new Group();
      var line = createSymbol("line", 0, opt.itemHeight / 2, opt.itemWidth, 0, opt.lineStyle.stroke, false);
      group.add(line);
      line.setStyle(opt.lineStyle);
      var visualType = this.getData().getVisual("symbol");
      var visualRotate = this.getData().getVisual("symbolRotate");
      var symbolType = visualType === "none" ? "circle" : visualType;
      var size = opt.itemHeight * 0.8;
      var symbol = createSymbol(symbolType, (opt.itemWidth - size) / 2, (opt.itemHeight - size) / 2, size, size, opt.itemStyle.fill);
      group.add(symbol);
      symbol.setStyle(opt.itemStyle);
      var symbolRotate = opt.iconRotate === "inherit" ? visualRotate : opt.iconRotate || 0;
      symbol.rotation = symbolRotate * Math.PI / 180;
      symbol.setOrigin([opt.itemWidth / 2, opt.itemHeight / 2]);
      if (symbolType.indexOf("empty") > -1) {
        symbol.style.stroke = symbol.style.fill;
        symbol.style.fill = "#fff";
        symbol.style.lineWidth = 2;
      }
      return group;
    };
    LineSeriesModel2.type = "series.line";
    LineSeriesModel2.dependencies = ["grid", "polar"];
    LineSeriesModel2.defaultOption = {
      // zlevel: 0,
      z: 3,
      coordinateSystem: "cartesian2d",
      legendHoverLink: true,
      clip: true,
      label: {
        position: "top"
      },
      // itemStyle: {
      // },
      endLabel: {
        show: false,
        valueAnimation: true,
        distance: 8
      },
      lineStyle: {
        width: 2,
        type: "solid"
      },
      emphasis: {
        scale: true
      },
      // areaStyle: {
      // origin of areaStyle. Valid values:
      // `'auto'/null/undefined`: from axisLine to data
      // `'start'`: from min to data
      // `'end'`: from data to max
      // origin: 'auto'
      // },
      // false, 'start', 'end', 'middle'
      step: false,
      // Disabled if step is true
      smooth: false,
      smoothMonotone: null,
      symbol: "emptyCircle",
      symbolSize: 4,
      symbolRotate: null,
      showSymbol: true,
      // `false`: follow the label interval strategy.
      // `true`: show all symbols.
      // `'auto'`: If possible, show all symbols, otherwise
      //           follow the label interval strategy.
      showAllSymbol: "auto",
      // Whether to connect break point.
      connectNulls: false,
      // Sampling for large data. Can be: 'average', 'max', 'min', 'sum', 'lttb'.
      sampling: "none",
      animationEasing: "linear",
      // Disable progressive
      progressive: 0,
      hoverLayerThreshold: Infinity,
      universalTransition: {
        divideShape: "clone"
      },
      triggerLineEvent: false
    };
    return LineSeriesModel2;
  }(SeriesModel)
);
function getDefaultLabel(data, dataIndex) {
  var labelDims = data.mapDimensionsAll("defaultedLabel");
  var len = labelDims.length;
  if (len === 1) {
    var rawVal = retrieveRawValue(data, dataIndex, labelDims[0]);
    return rawVal != null ? rawVal + "" : null;
  } else if (len) {
    var vals = [];
    for (var i = 0; i < labelDims.length; i++) {
      vals.push(retrieveRawValue(data, dataIndex, labelDims[i]));
    }
    return vals.join(" ");
  }
}
function getDefaultInterpolatedLabel(data, interpolatedValue) {
  var labelDims = data.mapDimensionsAll("defaultedLabel");
  if (!isArray(interpolatedValue)) {
    return interpolatedValue + "";
  }
  var vals = [];
  for (var i = 0; i < labelDims.length; i++) {
    var dimIndex = data.getDimensionIndex(labelDims[i]);
    if (dimIndex >= 0) {
      vals.push(interpolatedValue[dimIndex]);
    }
  }
  return vals.join(" ");
}
var Symbol$1 = (
  /** @class */
  function(_super) {
    __extends(Symbol, _super);
    function Symbol(data, idx, seriesScope, opts) {
      var _this = _super.call(this) || this;
      _this.updateData(data, idx, seriesScope, opts);
      return _this;
    }
    Symbol.prototype._createSymbol = function(symbolType, data, idx, symbolSize, keepAspect) {
      this.removeAll();
      var symbolPath = createSymbol(symbolType, -1, -1, 2, 2, null, keepAspect);
      symbolPath.attr({
        z2: 100,
        culling: true,
        scaleX: symbolSize[0] / 2,
        scaleY: symbolSize[1] / 2
      });
      symbolPath.drift = driftSymbol;
      this._symbolType = symbolType;
      this.add(symbolPath);
    };
    Symbol.prototype.stopSymbolAnimation = function(toLastFrame) {
      this.childAt(0).stopAnimation(null, toLastFrame);
    };
    Symbol.prototype.getSymbolType = function() {
      return this._symbolType;
    };
    Symbol.prototype.getSymbolPath = function() {
      return this.childAt(0);
    };
    Symbol.prototype.highlight = function() {
      enterEmphasis(this.childAt(0));
    };
    Symbol.prototype.downplay = function() {
      leaveEmphasis(this.childAt(0));
    };
    Symbol.prototype.setZ = function(zlevel, z) {
      var symbolPath = this.childAt(0);
      symbolPath.zlevel = zlevel;
      symbolPath.z = z;
    };
    Symbol.prototype.setDraggable = function(draggable, hasCursorOption) {
      var symbolPath = this.childAt(0);
      symbolPath.draggable = draggable;
      symbolPath.cursor = !hasCursorOption && draggable ? "move" : symbolPath.cursor;
    };
    Symbol.prototype.updateData = function(data, idx, seriesScope, opts) {
      this.silent = false;
      var symbolType = data.getItemVisual(idx, "symbol") || "circle";
      var seriesModel = data.hostModel;
      var symbolSize = Symbol.getSymbolSize(data, idx);
      var isInit = symbolType !== this._symbolType;
      var disableAnimation = opts && opts.disableAnimation;
      if (isInit) {
        var keepAspect = data.getItemVisual(idx, "symbolKeepAspect");
        this._createSymbol(symbolType, data, idx, symbolSize, keepAspect);
      } else {
        var symbolPath = this.childAt(0);
        symbolPath.silent = false;
        var target = {
          scaleX: symbolSize[0] / 2,
          scaleY: symbolSize[1] / 2
        };
        disableAnimation ? symbolPath.attr(target) : updateProps(symbolPath, target, seriesModel, idx);
        saveOldStyle(symbolPath);
      }
      this._updateCommon(data, idx, symbolSize, seriesScope, opts);
      if (isInit) {
        var symbolPath = this.childAt(0);
        if (!disableAnimation) {
          var target = {
            scaleX: this._sizeX,
            scaleY: this._sizeY,
            style: {
              // Always fadeIn. Because it has fadeOut animation when symbol is removed..
              opacity: symbolPath.style.opacity
            }
          };
          symbolPath.scaleX = symbolPath.scaleY = 0;
          symbolPath.style.opacity = 0;
          initProps(symbolPath, target, seriesModel, idx);
        }
      }
      if (disableAnimation) {
        this.childAt(0).stopAnimation("leave");
      }
    };
    Symbol.prototype._updateCommon = function(data, idx, symbolSize, seriesScope, opts) {
      var symbolPath = this.childAt(0);
      var seriesModel = data.hostModel;
      var emphasisItemStyle;
      var blurItemStyle;
      var selectItemStyle;
      var focus;
      var blurScope;
      var emphasisDisabled;
      var labelStatesModels;
      var hoverScale;
      var cursorStyle;
      if (seriesScope) {
        emphasisItemStyle = seriesScope.emphasisItemStyle;
        blurItemStyle = seriesScope.blurItemStyle;
        selectItemStyle = seriesScope.selectItemStyle;
        focus = seriesScope.focus;
        blurScope = seriesScope.blurScope;
        labelStatesModels = seriesScope.labelStatesModels;
        hoverScale = seriesScope.hoverScale;
        cursorStyle = seriesScope.cursorStyle;
        emphasisDisabled = seriesScope.emphasisDisabled;
      }
      if (!seriesScope || data.hasItemOption) {
        var itemModel = seriesScope && seriesScope.itemModel ? seriesScope.itemModel : data.getItemModel(idx);
        var emphasisModel = itemModel.getModel("emphasis");
        emphasisItemStyle = emphasisModel.getModel("itemStyle").getItemStyle();
        selectItemStyle = itemModel.getModel(["select", "itemStyle"]).getItemStyle();
        blurItemStyle = itemModel.getModel(["blur", "itemStyle"]).getItemStyle();
        focus = emphasisModel.get("focus");
        blurScope = emphasisModel.get("blurScope");
        emphasisDisabled = emphasisModel.get("disabled");
        labelStatesModels = getLabelStatesModels(itemModel);
        hoverScale = emphasisModel.getShallow("scale");
        cursorStyle = itemModel.getShallow("cursor");
      }
      var symbolRotate = data.getItemVisual(idx, "symbolRotate");
      symbolPath.attr("rotation", (symbolRotate || 0) * Math.PI / 180 || 0);
      var symbolOffset = normalizeSymbolOffset(data.getItemVisual(idx, "symbolOffset"), symbolSize);
      if (symbolOffset) {
        symbolPath.x = symbolOffset[0];
        symbolPath.y = symbolOffset[1];
      }
      cursorStyle && symbolPath.attr("cursor", cursorStyle);
      var symbolStyle = data.getItemVisual(idx, "style");
      var visualColor = symbolStyle.fill;
      if (symbolPath instanceof ZRImage) {
        var pathStyle = symbolPath.style;
        symbolPath.useStyle(extend({
          // TODO other properties like x, y ?
          image: pathStyle.image,
          x: pathStyle.x,
          y: pathStyle.y,
          width: pathStyle.width,
          height: pathStyle.height
        }, symbolStyle));
      } else {
        if (symbolPath.__isEmptyBrush) {
          symbolPath.useStyle(extend({}, symbolStyle));
        } else {
          symbolPath.useStyle(symbolStyle);
        }
        symbolPath.style.decal = null;
        symbolPath.setColor(visualColor, opts && opts.symbolInnerColor);
        symbolPath.style.strokeNoScale = true;
      }
      var liftZ = data.getItemVisual(idx, "liftZ");
      var z2Origin = this._z2;
      if (liftZ != null) {
        if (z2Origin == null) {
          this._z2 = symbolPath.z2;
          symbolPath.z2 += liftZ;
        }
      } else if (z2Origin != null) {
        symbolPath.z2 = z2Origin;
        this._z2 = null;
      }
      var useNameLabel = opts && opts.useNameLabel;
      setLabelStyle(symbolPath, labelStatesModels, {
        labelFetcher: seriesModel,
        labelDataIndex: idx,
        defaultText: getLabelDefaultText,
        inheritColor: visualColor,
        defaultOpacity: symbolStyle.opacity
      });
      function getLabelDefaultText(idx2) {
        return useNameLabel ? data.getName(idx2) : getDefaultLabel(data, idx2);
      }
      this._sizeX = symbolSize[0] / 2;
      this._sizeY = symbolSize[1] / 2;
      var emphasisState = symbolPath.ensureState("emphasis");
      emphasisState.style = emphasisItemStyle;
      symbolPath.ensureState("select").style = selectItemStyle;
      symbolPath.ensureState("blur").style = blurItemStyle;
      var scaleRatio = hoverScale == null || hoverScale === true ? Math.max(1.1, 3 / this._sizeY) : isFinite(hoverScale) && hoverScale > 0 ? +hoverScale : 1;
      emphasisState.scaleX = this._sizeX * scaleRatio;
      emphasisState.scaleY = this._sizeY * scaleRatio;
      this.setSymbolScale(1);
      toggleHoverEmphasis(this, focus, blurScope, emphasisDisabled);
    };
    Symbol.prototype.setSymbolScale = function(scale) {
      this.scaleX = this.scaleY = scale;
    };
    Symbol.prototype.fadeOut = function(cb, seriesModel, opt) {
      var symbolPath = this.childAt(0);
      var dataIndex = getECData(this).dataIndex;
      var animationOpt = opt && opt.animation;
      this.silent = symbolPath.silent = true;
      if (opt && opt.fadeLabel) {
        var textContent = symbolPath.getTextContent();
        if (textContent) {
          removeElement(textContent, {
            style: {
              opacity: 0
            }
          }, seriesModel, {
            dataIndex,
            removeOpt: animationOpt,
            cb: function() {
              symbolPath.removeTextContent();
            }
          });
        }
      } else {
        symbolPath.removeTextContent();
      }
      removeElement(symbolPath, {
        style: {
          opacity: 0
        },
        scaleX: 0,
        scaleY: 0
      }, seriesModel, {
        dataIndex,
        cb,
        removeOpt: animationOpt
      });
    };
    Symbol.getSymbolSize = function(data, idx) {
      return normalizeSymbolSize(data.getItemVisual(idx, "symbolSize"));
    };
    return Symbol;
  }(Group)
);
function driftSymbol(dx, dy) {
  this.parent.drift(dx, dy);
}
function symbolNeedsDraw(data, point, idx, opt) {
  return point && !isNaN(point[0]) && !isNaN(point[1]) && !(opt.isIgnore && opt.isIgnore(idx)) && !(opt.clipShape && !opt.clipShape.contain(point[0], point[1])) && data.getItemVisual(idx, "symbol") !== "none";
}
function normalizeUpdateOpt(opt) {
  if (opt != null && !isObject(opt)) {
    opt = {
      isIgnore: opt
    };
  }
  return opt || {};
}
function makeSeriesScope(data) {
  var seriesModel = data.hostModel;
  var emphasisModel = seriesModel.getModel("emphasis");
  return {
    emphasisItemStyle: emphasisModel.getModel("itemStyle").getItemStyle(),
    blurItemStyle: seriesModel.getModel(["blur", "itemStyle"]).getItemStyle(),
    selectItemStyle: seriesModel.getModel(["select", "itemStyle"]).getItemStyle(),
    focus: emphasisModel.get("focus"),
    blurScope: emphasisModel.get("blurScope"),
    emphasisDisabled: emphasisModel.get("disabled"),
    hoverScale: emphasisModel.get("scale"),
    labelStatesModels: getLabelStatesModels(seriesModel),
    cursorStyle: seriesModel.get("cursor")
  };
}
var SymbolDraw = (
  /** @class */
  function() {
    function SymbolDraw2(SymbolCtor) {
      this.group = new Group();
      this._SymbolCtor = SymbolCtor || Symbol$1;
    }
    SymbolDraw2.prototype.updateData = function(data, opt) {
      this._progressiveEls = null;
      opt = normalizeUpdateOpt(opt);
      var group = this.group;
      var seriesModel = data.hostModel;
      var oldData = this._data;
      var SymbolCtor = this._SymbolCtor;
      var disableAnimation = opt.disableAnimation;
      var seriesScope = makeSeriesScope(data);
      var symbolUpdateOpt = {
        disableAnimation
      };
      var getSymbolPoint = opt.getSymbolPoint || function(idx) {
        return data.getItemLayout(idx);
      };
      if (!oldData) {
        group.removeAll();
      }
      data.diff(oldData).add(function(newIdx) {
        var point = getSymbolPoint(newIdx);
        if (symbolNeedsDraw(data, point, newIdx, opt)) {
          var symbolEl = new SymbolCtor(data, newIdx, seriesScope, symbolUpdateOpt);
          symbolEl.setPosition(point);
          data.setItemGraphicEl(newIdx, symbolEl);
          group.add(symbolEl);
        }
      }).update(function(newIdx, oldIdx) {
        var symbolEl = oldData.getItemGraphicEl(oldIdx);
        var point = getSymbolPoint(newIdx);
        if (!symbolNeedsDraw(data, point, newIdx, opt)) {
          group.remove(symbolEl);
          return;
        }
        var newSymbolType = data.getItemVisual(newIdx, "symbol") || "circle";
        var oldSymbolType = symbolEl && symbolEl.getSymbolType && symbolEl.getSymbolType();
        if (!symbolEl || oldSymbolType && oldSymbolType !== newSymbolType) {
          group.remove(symbolEl);
          symbolEl = new SymbolCtor(data, newIdx, seriesScope, symbolUpdateOpt);
          symbolEl.setPosition(point);
        } else {
          symbolEl.updateData(data, newIdx, seriesScope, symbolUpdateOpt);
          var target = {
            x: point[0],
            y: point[1]
          };
          disableAnimation ? symbolEl.attr(target) : updateProps(symbolEl, target, seriesModel);
        }
        group.add(symbolEl);
        data.setItemGraphicEl(newIdx, symbolEl);
      }).remove(function(oldIdx) {
        var el = oldData.getItemGraphicEl(oldIdx);
        el && el.fadeOut(function() {
          group.remove(el);
        }, seriesModel);
      }).execute();
      this._getSymbolPoint = getSymbolPoint;
      this._data = data;
    };
    SymbolDraw2.prototype.updateLayout = function() {
      var _this = this;
      var data = this._data;
      if (data) {
        data.eachItemGraphicEl(function(el, idx) {
          var point = _this._getSymbolPoint(idx);
          el.setPosition(point);
          el.markRedraw();
        });
      }
    };
    SymbolDraw2.prototype.incrementalPrepareUpdate = function(data) {
      this._seriesScope = makeSeriesScope(data);
      this._data = null;
      this.group.removeAll();
    };
    SymbolDraw2.prototype.incrementalUpdate = function(taskParams, data, opt) {
      this._progressiveEls = [];
      opt = normalizeUpdateOpt(opt);
      function updateIncrementalAndHover(el2) {
        if (!el2.isGroup) {
          el2.incremental = true;
          el2.ensureState("emphasis").hoverLayer = true;
        }
      }
      for (var idx = taskParams.start; idx < taskParams.end; idx++) {
        var point = data.getItemLayout(idx);
        if (symbolNeedsDraw(data, point, idx, opt)) {
          var el = new this._SymbolCtor(data, idx, this._seriesScope);
          el.traverse(updateIncrementalAndHover);
          el.setPosition(point);
          this.group.add(el);
          data.setItemGraphicEl(idx, el);
          this._progressiveEls.push(el);
        }
      }
    };
    SymbolDraw2.prototype.eachRendered = function(cb) {
      traverseElements(this._progressiveEls || this.group, cb);
    };
    SymbolDraw2.prototype.remove = function(enableAnimation) {
      var group = this.group;
      var data = this._data;
      if (data && enableAnimation) {
        data.eachItemGraphicEl(function(el) {
          el.fadeOut(function() {
            group.remove(el);
          }, data.hostModel);
        });
      } else {
        group.removeAll();
      }
    };
    return SymbolDraw2;
  }()
);
function prepareDataCoordInfo(coordSys, data, valueOrigin) {
  var baseAxis = coordSys.getBaseAxis();
  var valueAxis = coordSys.getOtherAxis(baseAxis);
  var valueStart = getValueStart(valueAxis, valueOrigin);
  var baseAxisDim = baseAxis.dim;
  var valueAxisDim = valueAxis.dim;
  var valueDim = data.mapDimension(valueAxisDim);
  var baseDim = data.mapDimension(baseAxisDim);
  var baseDataOffset = valueAxisDim === "x" || valueAxisDim === "radius" ? 1 : 0;
  var dims = map(coordSys.dimensions, function(coordDim) {
    return data.mapDimension(coordDim);
  });
  var stacked = false;
  var stackResultDim = data.getCalculationInfo("stackResultDimension");
  if (isDimensionStacked(
    data,
    dims[0]
    /* , dims[1] */
  )) {
    stacked = true;
    dims[0] = stackResultDim;
  }
  if (isDimensionStacked(
    data,
    dims[1]
    /* , dims[0] */
  )) {
    stacked = true;
    dims[1] = stackResultDim;
  }
  return {
    dataDimsForPoint: dims,
    valueStart,
    valueAxisDim,
    baseAxisDim,
    stacked: !!stacked,
    valueDim,
    baseDim,
    baseDataOffset,
    stackedOverDimension: data.getCalculationInfo("stackedOverDimension")
  };
}
function getValueStart(valueAxis, valueOrigin) {
  var valueStart = 0;
  var extent = valueAxis.scale.getExtent();
  if (valueOrigin === "start") {
    valueStart = extent[0];
  } else if (valueOrigin === "end") {
    valueStart = extent[1];
  } else if (isNumber(valueOrigin) && !isNaN(valueOrigin)) {
    valueStart = valueOrigin;
  } else {
    if (extent[0] > 0) {
      valueStart = extent[0];
    } else if (extent[1] < 0) {
      valueStart = extent[1];
    }
  }
  return valueStart;
}
function getStackedOnPoint(dataCoordInfo, coordSys, data, idx) {
  var value = NaN;
  if (dataCoordInfo.stacked) {
    value = data.get(data.getCalculationInfo("stackedOverDimension"), idx);
  }
  if (isNaN(value)) {
    value = dataCoordInfo.valueStart;
  }
  var baseDataOffset = dataCoordInfo.baseDataOffset;
  var stackedData = [];
  stackedData[baseDataOffset] = data.get(dataCoordInfo.baseDim, idx);
  stackedData[1 - baseDataOffset] = value;
  return coordSys.dataToPoint(stackedData);
}
function diffData(oldData, newData) {
  var diffResult = [];
  newData.diff(oldData).add(function(idx) {
    diffResult.push({
      cmd: "+",
      idx
    });
  }).update(function(newIdx, oldIdx) {
    diffResult.push({
      cmd: "=",
      idx: oldIdx,
      idx1: newIdx
    });
  }).remove(function(idx) {
    diffResult.push({
      cmd: "-",
      idx
    });
  }).execute();
  return diffResult;
}
function lineAnimationDiff(oldData, newData, oldStackedOnPoints, newStackedOnPoints, oldCoordSys, newCoordSys, oldValueOrigin, newValueOrigin) {
  var diff = diffData(oldData, newData);
  var currPoints = [];
  var nextPoints = [];
  var currStackedPoints = [];
  var nextStackedPoints = [];
  var status = [];
  var sortedIndices = [];
  var rawIndices = [];
  var newDataOldCoordInfo = prepareDataCoordInfo(oldCoordSys, newData, oldValueOrigin);
  var oldPoints = oldData.getLayout("points") || [];
  var newPoints = newData.getLayout("points") || [];
  for (var i = 0; i < diff.length; i++) {
    var diffItem = diff[i];
    var pointAdded = true;
    var oldIdx2 = void 0;
    var newIdx2 = void 0;
    switch (diffItem.cmd) {
      case "=":
        oldIdx2 = diffItem.idx * 2;
        newIdx2 = diffItem.idx1 * 2;
        var currentX = oldPoints[oldIdx2];
        var currentY = oldPoints[oldIdx2 + 1];
        var nextX = newPoints[newIdx2];
        var nextY = newPoints[newIdx2 + 1];
        if (isNaN(currentX) || isNaN(currentY)) {
          currentX = nextX;
          currentY = nextY;
        }
        currPoints.push(currentX, currentY);
        nextPoints.push(nextX, nextY);
        currStackedPoints.push(oldStackedOnPoints[oldIdx2], oldStackedOnPoints[oldIdx2 + 1]);
        nextStackedPoints.push(newStackedOnPoints[newIdx2], newStackedOnPoints[newIdx2 + 1]);
        rawIndices.push(newData.getRawIndex(diffItem.idx1));
        break;
      case "+":
        var newIdx = diffItem.idx;
        var newDataDimsForPoint = newDataOldCoordInfo.dataDimsForPoint;
        var oldPt = oldCoordSys.dataToPoint([newData.get(newDataDimsForPoint[0], newIdx), newData.get(newDataDimsForPoint[1], newIdx)]);
        newIdx2 = newIdx * 2;
        currPoints.push(oldPt[0], oldPt[1]);
        nextPoints.push(newPoints[newIdx2], newPoints[newIdx2 + 1]);
        var stackedOnPoint = getStackedOnPoint(newDataOldCoordInfo, oldCoordSys, newData, newIdx);
        currStackedPoints.push(stackedOnPoint[0], stackedOnPoint[1]);
        nextStackedPoints.push(newStackedOnPoints[newIdx2], newStackedOnPoints[newIdx2 + 1]);
        rawIndices.push(newData.getRawIndex(newIdx));
        break;
      case "-":
        pointAdded = false;
    }
    if (pointAdded) {
      status.push(diffItem);
      sortedIndices.push(sortedIndices.length);
    }
  }
  sortedIndices.sort(function(a, b) {
    return rawIndices[a] - rawIndices[b];
  });
  var len = currPoints.length;
  var sortedCurrPoints = createFloat32Array(len);
  var sortedNextPoints = createFloat32Array(len);
  var sortedCurrStackedPoints = createFloat32Array(len);
  var sortedNextStackedPoints = createFloat32Array(len);
  var sortedStatus = [];
  for (var i = 0; i < sortedIndices.length; i++) {
    var idx = sortedIndices[i];
    var i2 = i * 2;
    var idx2 = idx * 2;
    sortedCurrPoints[i2] = currPoints[idx2];
    sortedCurrPoints[i2 + 1] = currPoints[idx2 + 1];
    sortedNextPoints[i2] = nextPoints[idx2];
    sortedNextPoints[i2 + 1] = nextPoints[idx2 + 1];
    sortedCurrStackedPoints[i2] = currStackedPoints[idx2];
    sortedCurrStackedPoints[i2 + 1] = currStackedPoints[idx2 + 1];
    sortedNextStackedPoints[i2] = nextStackedPoints[idx2];
    sortedNextStackedPoints[i2 + 1] = nextStackedPoints[idx2 + 1];
    sortedStatus[i] = status[idx];
  }
  return {
    current: sortedCurrPoints,
    next: sortedNextPoints,
    stackedOnCurrent: sortedCurrStackedPoints,
    stackedOnNext: sortedNextStackedPoints,
    status: sortedStatus
  };
}
var mathMin$1 = Math.min;
var mathMax$1 = Math.max;
function isPointNull$1(x, y) {
  return isNaN(x) || isNaN(y);
}
function drawSegment(ctx, points, start, segLen, allLen, dir, smooth, smoothMonotone, connectNulls) {
  var prevX;
  var prevY;
  var cpx0;
  var cpy0;
  var cpx1;
  var cpy1;
  var idx = start;
  var k = 0;
  for (; k < segLen; k++) {
    var x = points[idx * 2];
    var y = points[idx * 2 + 1];
    if (idx >= allLen || idx < 0) {
      break;
    }
    if (isPointNull$1(x, y)) {
      if (connectNulls) {
        idx += dir;
        continue;
      }
      break;
    }
    if (idx === start) {
      ctx[dir > 0 ? "moveTo" : "lineTo"](x, y);
      cpx0 = x;
      cpy0 = y;
    } else {
      var dx = x - prevX;
      var dy = y - prevY;
      if (dx * dx + dy * dy < 0.5) {
        idx += dir;
        continue;
      }
      if (smooth > 0) {
        var nextIdx = idx + dir;
        var nextX = points[nextIdx * 2];
        var nextY = points[nextIdx * 2 + 1];
        while (nextX === x && nextY === y && k < segLen) {
          k++;
          nextIdx += dir;
          idx += dir;
          nextX = points[nextIdx * 2];
          nextY = points[nextIdx * 2 + 1];
          x = points[idx * 2];
          y = points[idx * 2 + 1];
          dx = x - prevX;
          dy = y - prevY;
        }
        var tmpK = k + 1;
        if (connectNulls) {
          while (isPointNull$1(nextX, nextY) && tmpK < segLen) {
            tmpK++;
            nextIdx += dir;
            nextX = points[nextIdx * 2];
            nextY = points[nextIdx * 2 + 1];
          }
        }
        var ratioNextSeg = 0.5;
        var vx = 0;
        var vy = 0;
        var nextCpx0 = void 0;
        var nextCpy0 = void 0;
        if (tmpK >= segLen || isPointNull$1(nextX, nextY)) {
          cpx1 = x;
          cpy1 = y;
        } else {
          vx = nextX - prevX;
          vy = nextY - prevY;
          var dx0 = x - prevX;
          var dx1 = nextX - x;
          var dy0 = y - prevY;
          var dy1 = nextY - y;
          var lenPrevSeg = void 0;
          var lenNextSeg = void 0;
          if (smoothMonotone === "x") {
            lenPrevSeg = Math.abs(dx0);
            lenNextSeg = Math.abs(dx1);
            var dir_1 = vx > 0 ? 1 : -1;
            cpx1 = x - dir_1 * lenPrevSeg * smooth;
            cpy1 = y;
            nextCpx0 = x + dir_1 * lenNextSeg * smooth;
            nextCpy0 = y;
          } else if (smoothMonotone === "y") {
            lenPrevSeg = Math.abs(dy0);
            lenNextSeg = Math.abs(dy1);
            var dir_2 = vy > 0 ? 1 : -1;
            cpx1 = x;
            cpy1 = y - dir_2 * lenPrevSeg * smooth;
            nextCpx0 = x;
            nextCpy0 = y + dir_2 * lenNextSeg * smooth;
          } else {
            lenPrevSeg = Math.sqrt(dx0 * dx0 + dy0 * dy0);
            lenNextSeg = Math.sqrt(dx1 * dx1 + dy1 * dy1);
            ratioNextSeg = lenNextSeg / (lenNextSeg + lenPrevSeg);
            cpx1 = x - vx * smooth * (1 - ratioNextSeg);
            cpy1 = y - vy * smooth * (1 - ratioNextSeg);
            nextCpx0 = x + vx * smooth * ratioNextSeg;
            nextCpy0 = y + vy * smooth * ratioNextSeg;
            nextCpx0 = mathMin$1(nextCpx0, mathMax$1(nextX, x));
            nextCpy0 = mathMin$1(nextCpy0, mathMax$1(nextY, y));
            nextCpx0 = mathMax$1(nextCpx0, mathMin$1(nextX, x));
            nextCpy0 = mathMax$1(nextCpy0, mathMin$1(nextY, y));
            vx = nextCpx0 - x;
            vy = nextCpy0 - y;
            cpx1 = x - vx * lenPrevSeg / lenNextSeg;
            cpy1 = y - vy * lenPrevSeg / lenNextSeg;
            cpx1 = mathMin$1(cpx1, mathMax$1(prevX, x));
            cpy1 = mathMin$1(cpy1, mathMax$1(prevY, y));
            cpx1 = mathMax$1(cpx1, mathMin$1(prevX, x));
            cpy1 = mathMax$1(cpy1, mathMin$1(prevY, y));
            vx = x - cpx1;
            vy = y - cpy1;
            nextCpx0 = x + vx * lenNextSeg / lenPrevSeg;
            nextCpy0 = y + vy * lenNextSeg / lenPrevSeg;
          }
        }
        ctx.bezierCurveTo(cpx0, cpy0, cpx1, cpy1, x, y);
        cpx0 = nextCpx0;
        cpy0 = nextCpy0;
      } else {
        ctx.lineTo(x, y);
      }
    }
    prevX = x;
    prevY = y;
    idx += dir;
  }
  return k;
}
var ECPolylineShape = (
  /** @class */
  /* @__PURE__ */ function() {
    function ECPolylineShape2() {
      this.smooth = 0;
      this.smoothConstraint = true;
    }
    return ECPolylineShape2;
  }()
);
var ECPolyline = (
  /** @class */
  function(_super) {
    __extends(ECPolyline2, _super);
    function ECPolyline2(opts) {
      var _this = _super.call(this, opts) || this;
      _this.type = "ec-polyline";
      return _this;
    }
    ECPolyline2.prototype.getDefaultStyle = function() {
      return {
        stroke: "#000",
        fill: null
      };
    };
    ECPolyline2.prototype.getDefaultShape = function() {
      return new ECPolylineShape();
    };
    ECPolyline2.prototype.buildPath = function(ctx, shape) {
      var points = shape.points;
      var i = 0;
      var len = points.length / 2;
      if (shape.connectNulls) {
        for (; len > 0; len--) {
          if (!isPointNull$1(points[len * 2 - 2], points[len * 2 - 1])) {
            break;
          }
        }
        for (; i < len; i++) {
          if (!isPointNull$1(points[i * 2], points[i * 2 + 1])) {
            break;
          }
        }
      }
      while (i < len) {
        i += drawSegment(ctx, points, i, len, len, 1, shape.smooth, shape.smoothMonotone, shape.connectNulls) + 1;
      }
    };
    ECPolyline2.prototype.getPointOn = function(xOrY, dim) {
      if (!this.path) {
        this.createPathProxy();
        this.buildPath(this.path, this.shape);
      }
      var path = this.path;
      var data = path.data;
      var CMD = PathProxy.CMD;
      var x0;
      var y0;
      var isDimX = dim === "x";
      var roots = [];
      for (var i = 0; i < data.length; ) {
        var cmd = data[i++];
        var x = void 0;
        var y = void 0;
        var x2 = void 0;
        var y2 = void 0;
        var x3 = void 0;
        var y3 = void 0;
        var t = void 0;
        switch (cmd) {
          case CMD.M:
            x0 = data[i++];
            y0 = data[i++];
            break;
          case CMD.L:
            x = data[i++];
            y = data[i++];
            t = isDimX ? (xOrY - x0) / (x - x0) : (xOrY - y0) / (y - y0);
            if (t <= 1 && t >= 0) {
              var val = isDimX ? (y - y0) * t + y0 : (x - x0) * t + x0;
              return isDimX ? [xOrY, val] : [val, xOrY];
            }
            x0 = x;
            y0 = y;
            break;
          case CMD.C:
            x = data[i++];
            y = data[i++];
            x2 = data[i++];
            y2 = data[i++];
            x3 = data[i++];
            y3 = data[i++];
            var nRoot = isDimX ? cubicRootAt(x0, x, x2, x3, xOrY, roots) : cubicRootAt(y0, y, y2, y3, xOrY, roots);
            if (nRoot > 0) {
              for (var i_1 = 0; i_1 < nRoot; i_1++) {
                var t_1 = roots[i_1];
                if (t_1 <= 1 && t_1 >= 0) {
                  var val = isDimX ? cubicAt(y0, y, y2, y3, t_1) : cubicAt(x0, x, x2, x3, t_1);
                  return isDimX ? [xOrY, val] : [val, xOrY];
                }
              }
            }
            x0 = x3;
            y0 = y3;
            break;
        }
      }
    };
    return ECPolyline2;
  }(Path)
);
var ECPolygonShape = (
  /** @class */
  function(_super) {
    __extends(ECPolygonShape2, _super);
    function ECPolygonShape2() {
      return _super !== null && _super.apply(this, arguments) || this;
    }
    return ECPolygonShape2;
  }(ECPolylineShape)
);
var ECPolygon = (
  /** @class */
  function(_super) {
    __extends(ECPolygon2, _super);
    function ECPolygon2(opts) {
      var _this = _super.call(this, opts) || this;
      _this.type = "ec-polygon";
      return _this;
    }
    ECPolygon2.prototype.getDefaultShape = function() {
      return new ECPolygonShape();
    };
    ECPolygon2.prototype.buildPath = function(ctx, shape) {
      var points = shape.points;
      var stackedOnPoints = shape.stackedOnPoints;
      var i = 0;
      var len = points.length / 2;
      var smoothMonotone = shape.smoothMonotone;
      if (shape.connectNulls) {
        for (; len > 0; len--) {
          if (!isPointNull$1(points[len * 2 - 2], points[len * 2 - 1])) {
            break;
          }
        }
        for (; i < len; i++) {
          if (!isPointNull$1(points[i * 2], points[i * 2 + 1])) {
            break;
          }
        }
      }
      while (i < len) {
        var k = drawSegment(ctx, points, i, len, len, 1, shape.smooth, smoothMonotone, shape.connectNulls);
        drawSegment(ctx, stackedOnPoints, i + k - 1, k, len, -1, shape.stackedOnSmooth, smoothMonotone, shape.connectNulls);
        i += k + 1;
        ctx.closePath();
      }
    };
    return ECPolygon2;
  }(Path)
);
function createGridClipPath(cartesian, hasAnimation, seriesModel, done, during) {
  var rect = cartesian.getArea();
  var x = rect.x;
  var y = rect.y;
  var width = rect.width;
  var height = rect.height;
  var lineWidth = seriesModel.get(["lineStyle", "width"]) || 0;
  x -= lineWidth / 2;
  y -= lineWidth / 2;
  width += lineWidth;
  height += lineWidth;
  width = Math.ceil(width);
  if (x !== Math.floor(x)) {
    x = Math.floor(x);
    width++;
  }
  var clipPath = new Rect({
    shape: {
      x,
      y,
      width,
      height
    }
  });
  if (hasAnimation) {
    var baseAxis = cartesian.getBaseAxis();
    var isHorizontal = baseAxis.isHorizontal();
    var isAxisInversed = baseAxis.inverse;
    if (isHorizontal) {
      if (isAxisInversed) {
        clipPath.shape.x += width;
      }
      clipPath.shape.width = 0;
    } else {
      if (!isAxisInversed) {
        clipPath.shape.y += height;
      }
      clipPath.shape.height = 0;
    }
    var duringCb = isFunction(during) ? function(percent) {
      during(percent, clipPath);
    } : null;
    initProps(clipPath, {
      shape: {
        width,
        height,
        x,
        y
      }
    }, seriesModel, null, done, duringCb);
  }
  return clipPath;
}
function createPolarClipPath(polar, hasAnimation, seriesModel) {
  var sectorArea = polar.getArea();
  var r0 = round(sectorArea.r0, 1);
  var r = round(sectorArea.r, 1);
  var clipPath = new Sector({
    shape: {
      cx: round(polar.cx, 1),
      cy: round(polar.cy, 1),
      r0,
      r,
      startAngle: sectorArea.startAngle,
      endAngle: sectorArea.endAngle,
      clockwise: sectorArea.clockwise
    }
  });
  if (hasAnimation) {
    var isRadial = polar.getBaseAxis().dim === "angle";
    if (isRadial) {
      clipPath.shape.endAngle = sectorArea.startAngle;
    } else {
      clipPath.shape.r = r0;
    }
    initProps(clipPath, {
      shape: {
        endAngle: sectorArea.endAngle,
        r
      }
    }, seriesModel);
  }
  return clipPath;
}
function createClipPath(coordSys, hasAnimation, seriesModel, done, during) {
  if (!coordSys) {
    return null;
  } else if (coordSys.type === "polar") {
    return createPolarClipPath(coordSys, hasAnimation, seriesModel);
  } else if (coordSys.type === "cartesian2d") {
    return createGridClipPath(coordSys, hasAnimation, seriesModel, done, during);
  }
  return null;
}
function isCoordinateSystemType(coordSys, type) {
  return coordSys.type === type;
}
function isPointsSame(points1, points2) {
  if (points1.length !== points2.length) {
    return;
  }
  for (var i = 0; i < points1.length; i++) {
    if (points1[i] !== points2[i]) {
      return;
    }
  }
  return true;
}
function bboxFromPoints(points) {
  var minX = Infinity;
  var minY = Infinity;
  var maxX = -Infinity;
  var maxY = -Infinity;
  for (var i = 0; i < points.length; ) {
    var x = points[i++];
    var y = points[i++];
    if (!isNaN(x)) {
      minX = Math.min(x, minX);
      maxX = Math.max(x, maxX);
    }
    if (!isNaN(y)) {
      minY = Math.min(y, minY);
      maxY = Math.max(y, maxY);
    }
  }
  return [[minX, minY], [maxX, maxY]];
}
function getBoundingDiff(points1, points2) {
  var _a = bboxFromPoints(points1), min1 = _a[0], max1 = _a[1];
  var _b = bboxFromPoints(points2), min2 = _b[0], max2 = _b[1];
  return Math.max(Math.abs(min1[0] - min2[0]), Math.abs(min1[1] - min2[1]), Math.abs(max1[0] - max2[0]), Math.abs(max1[1] - max2[1]));
}
function getSmooth(smooth) {
  return isNumber(smooth) ? smooth : smooth ? 0.5 : 0;
}
function getStackedOnPoints(coordSys, data, dataCoordInfo) {
  if (!dataCoordInfo.valueDim) {
    return [];
  }
  var len = data.count();
  var points = createFloat32Array(len * 2);
  for (var idx = 0; idx < len; idx++) {
    var pt = getStackedOnPoint(dataCoordInfo, coordSys, data, idx);
    points[idx * 2] = pt[0];
    points[idx * 2 + 1] = pt[1];
  }
  return points;
}
function turnPointsIntoStep(points, basePoints, coordSys, stepTurnAt, connectNulls) {
  var baseAxis = coordSys.getBaseAxis();
  var baseIndex = baseAxis.dim === "x" || baseAxis.dim === "radius" ? 0 : 1;
  var stepPoints = [];
  var i = 0;
  var stepPt = [];
  var pt = [];
  var nextPt = [];
  var filteredPoints = [];
  if (connectNulls) {
    for (i = 0; i < points.length; i += 2) {
      var reference = basePoints || points;
      if (!isNaN(reference[i]) && !isNaN(reference[i + 1])) {
        filteredPoints.push(points[i], points[i + 1]);
      }
    }
    points = filteredPoints;
  }
  for (i = 0; i < points.length - 2; i += 2) {
    nextPt[0] = points[i + 2];
    nextPt[1] = points[i + 3];
    pt[0] = points[i];
    pt[1] = points[i + 1];
    stepPoints.push(pt[0], pt[1]);
    switch (stepTurnAt) {
      case "end":
        stepPt[baseIndex] = nextPt[baseIndex];
        stepPt[1 - baseIndex] = pt[1 - baseIndex];
        stepPoints.push(stepPt[0], stepPt[1]);
        break;
      case "middle":
        var middle = (pt[baseIndex] + nextPt[baseIndex]) / 2;
        var stepPt2 = [];
        stepPt[baseIndex] = stepPt2[baseIndex] = middle;
        stepPt[1 - baseIndex] = pt[1 - baseIndex];
        stepPt2[1 - baseIndex] = nextPt[1 - baseIndex];
        stepPoints.push(stepPt[0], stepPt[1]);
        stepPoints.push(stepPt2[0], stepPt2[1]);
        break;
      default:
        stepPt[baseIndex] = pt[baseIndex];
        stepPt[1 - baseIndex] = nextPt[1 - baseIndex];
        stepPoints.push(stepPt[0], stepPt[1]);
    }
  }
  stepPoints.push(points[i++], points[i++]);
  return stepPoints;
}
function clipColorStops(colorStops, maxSize) {
  var newColorStops = [];
  var len = colorStops.length;
  var prevOutOfRangeColorStop;
  var prevInRangeColorStop;
  function lerpStop(stop0, stop1, clippedCoord) {
    var coord0 = stop0.coord;
    var p = (clippedCoord - coord0) / (stop1.coord - coord0);
    var color = lerp(p, [stop0.color, stop1.color]);
    return {
      coord: clippedCoord,
      color
    };
  }
  for (var i = 0; i < len; i++) {
    var stop_1 = colorStops[i];
    var coord = stop_1.coord;
    if (coord < 0) {
      prevOutOfRangeColorStop = stop_1;
    } else if (coord > maxSize) {
      if (prevInRangeColorStop) {
        newColorStops.push(lerpStop(prevInRangeColorStop, stop_1, maxSize));
      } else if (prevOutOfRangeColorStop) {
        newColorStops.push(lerpStop(prevOutOfRangeColorStop, stop_1, 0), lerpStop(prevOutOfRangeColorStop, stop_1, maxSize));
      }
      break;
    } else {
      if (prevOutOfRangeColorStop) {
        newColorStops.push(lerpStop(prevOutOfRangeColorStop, stop_1, 0));
        prevOutOfRangeColorStop = null;
      }
      newColorStops.push(stop_1);
      prevInRangeColorStop = stop_1;
    }
  }
  return newColorStops;
}
function getVisualGradient(data, coordSys, api) {
  var visualMetaList = data.getVisual("visualMeta");
  if (!visualMetaList || !visualMetaList.length || !data.count()) {
    return;
  }
  if (coordSys.type !== "cartesian2d") {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Visual map on line style is only supported on cartesian2d.");
    }
    return;
  }
  var coordDim;
  var visualMeta;
  for (var i = visualMetaList.length - 1; i >= 0; i--) {
    var dimInfo = data.getDimensionInfo(visualMetaList[i].dimension);
    coordDim = dimInfo && dimInfo.coordDim;
    if (coordDim === "x" || coordDim === "y") {
      visualMeta = visualMetaList[i];
      break;
    }
  }
  if (!visualMeta) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Visual map on line style only support x or y dimension.");
    }
    return;
  }
  var axis = coordSys.getAxis(coordDim);
  var colorStops = map(visualMeta.stops, function(stop) {
    return {
      coord: axis.toGlobalCoord(axis.dataToCoord(stop.value)),
      color: stop.color
    };
  });
  var stopLen = colorStops.length;
  var outerColors = visualMeta.outerColors.slice();
  if (stopLen && colorStops[0].coord > colorStops[stopLen - 1].coord) {
    colorStops.reverse();
    outerColors.reverse();
  }
  var colorStopsInRange = clipColorStops(colorStops, coordDim === "x" ? api.getWidth() : api.getHeight());
  var inRangeStopLen = colorStopsInRange.length;
  if (!inRangeStopLen && stopLen) {
    return colorStops[0].coord < 0 ? outerColors[1] ? outerColors[1] : colorStops[stopLen - 1].color : outerColors[0] ? outerColors[0] : colorStops[0].color;
  }
  var tinyExtent = 10;
  var minCoord = colorStopsInRange[0].coord - tinyExtent;
  var maxCoord = colorStopsInRange[inRangeStopLen - 1].coord + tinyExtent;
  var coordSpan = maxCoord - minCoord;
  if (coordSpan < 1e-3) {
    return "transparent";
  }
  each(colorStopsInRange, function(stop) {
    stop.offset = (stop.coord - minCoord) / coordSpan;
  });
  colorStopsInRange.push({
    // NOTE: inRangeStopLen may still be 0 if stoplen is zero.
    offset: inRangeStopLen ? colorStopsInRange[inRangeStopLen - 1].offset : 0.5,
    color: outerColors[1] || "transparent"
  });
  colorStopsInRange.unshift({
    offset: inRangeStopLen ? colorStopsInRange[0].offset : 0.5,
    color: outerColors[0] || "transparent"
  });
  var gradient = new LinearGradient(0, 0, 0, 0, colorStopsInRange, true);
  gradient[coordDim] = minCoord;
  gradient[coordDim + "2"] = maxCoord;
  return gradient;
}
function getIsIgnoreFunc(seriesModel, data, coordSys) {
  var showAllSymbol = seriesModel.get("showAllSymbol");
  var isAuto = showAllSymbol === "auto";
  if (showAllSymbol && !isAuto) {
    return;
  }
  var categoryAxis = coordSys.getAxesByScale("ordinal")[0];
  if (!categoryAxis) {
    return;
  }
  if (isAuto && canShowAllSymbolForCategory(categoryAxis, data)) {
    return;
  }
  var categoryDataDim = data.mapDimension(categoryAxis.dim);
  var labelMap = {};
  each(categoryAxis.getViewLabels(), function(labelItem) {
    var ordinalNumber = categoryAxis.scale.getRawOrdinalNumber(labelItem.tickValue);
    labelMap[ordinalNumber] = 1;
  });
  return function(dataIndex) {
    return !labelMap.hasOwnProperty(data.get(categoryDataDim, dataIndex));
  };
}
function canShowAllSymbolForCategory(categoryAxis, data) {
  var axisExtent = categoryAxis.getExtent();
  var availSize = Math.abs(axisExtent[1] - axisExtent[0]) / categoryAxis.scale.count();
  isNaN(availSize) && (availSize = 0);
  var dataLen = data.count();
  var step = Math.max(1, Math.round(dataLen / 5));
  for (var dataIndex = 0; dataIndex < dataLen; dataIndex += step) {
    if (Symbol$1.getSymbolSize(
      data,
      dataIndex
      // Only for cartesian, where `isHorizontal` exists.
    )[categoryAxis.isHorizontal() ? 1 : 0] * 1.5 > availSize) {
      return false;
    }
  }
  return true;
}
function isPointNull(x, y) {
  return isNaN(x) || isNaN(y);
}
function getLastIndexNotNull(points) {
  var len = points.length / 2;
  for (; len > 0; len--) {
    if (!isPointNull(points[len * 2 - 2], points[len * 2 - 1])) {
      break;
    }
  }
  return len - 1;
}
function getPointAtIndex(points, idx) {
  return [points[idx * 2], points[idx * 2 + 1]];
}
function getIndexRange(points, xOrY, dim) {
  var len = points.length / 2;
  var dimIdx = dim === "x" ? 0 : 1;
  var a;
  var b;
  var prevIndex = 0;
  var nextIndex = -1;
  for (var i = 0; i < len; i++) {
    b = points[i * 2 + dimIdx];
    if (isNaN(b) || isNaN(points[i * 2 + 1 - dimIdx])) {
      continue;
    }
    if (i === 0) {
      a = b;
      continue;
    }
    if (a <= xOrY && b >= xOrY || a >= xOrY && b <= xOrY) {
      nextIndex = i;
      break;
    }
    prevIndex = i;
    a = b;
  }
  return {
    range: [prevIndex, nextIndex],
    t: (xOrY - a) / (b - a)
  };
}
function anyStateShowEndLabel(seriesModel) {
  if (seriesModel.get(["endLabel", "show"])) {
    return true;
  }
  for (var i = 0; i < SPECIAL_STATES.length; i++) {
    if (seriesModel.get([SPECIAL_STATES[i], "endLabel", "show"])) {
      return true;
    }
  }
  return false;
}
function createLineClipPath(lineView, coordSys, hasAnimation, seriesModel) {
  if (isCoordinateSystemType(coordSys, "cartesian2d")) {
    var endLabelModel_1 = seriesModel.getModel("endLabel");
    var valueAnimation_1 = endLabelModel_1.get("valueAnimation");
    var data_1 = seriesModel.getData();
    var labelAnimationRecord_1 = {
      lastFrameIndex: 0
    };
    var during = anyStateShowEndLabel(seriesModel) ? function(percent, clipRect) {
      lineView._endLabelOnDuring(percent, clipRect, data_1, labelAnimationRecord_1, valueAnimation_1, endLabelModel_1, coordSys);
    } : null;
    var isHorizontal = coordSys.getBaseAxis().isHorizontal();
    var clipPath = createGridClipPath(coordSys, hasAnimation, seriesModel, function() {
      var endLabel = lineView._endLabel;
      if (endLabel && hasAnimation) {
        if (labelAnimationRecord_1.originalX != null) {
          endLabel.attr({
            x: labelAnimationRecord_1.originalX,
            y: labelAnimationRecord_1.originalY
          });
        }
      }
    }, during);
    if (!seriesModel.get("clip", true)) {
      var rectShape = clipPath.shape;
      var expandSize = Math.max(rectShape.width, rectShape.height);
      if (isHorizontal) {
        rectShape.y -= expandSize;
        rectShape.height += expandSize * 2;
      } else {
        rectShape.x -= expandSize;
        rectShape.width += expandSize * 2;
      }
    }
    if (during) {
      during(1, clipPath);
    }
    return clipPath;
  } else {
    if (process.env.NODE_ENV !== "production") {
      if (seriesModel.get(["endLabel", "show"])) {
        console.warn("endLabel is not supported for lines in polar systems.");
      }
    }
    return createPolarClipPath(coordSys, hasAnimation, seriesModel);
  }
}
function getEndLabelStateSpecified(endLabelModel, coordSys) {
  var baseAxis = coordSys.getBaseAxis();
  var isHorizontal = baseAxis.isHorizontal();
  var isBaseInversed = baseAxis.inverse;
  var align = isHorizontal ? isBaseInversed ? "right" : "left" : "center";
  var verticalAlign = isHorizontal ? "middle" : isBaseInversed ? "top" : "bottom";
  return {
    normal: {
      align: endLabelModel.get("align") || align,
      verticalAlign: endLabelModel.get("verticalAlign") || verticalAlign
    }
  };
}
var LineView = (
  /** @class */
  function(_super) {
    __extends(LineView2, _super);
    function LineView2() {
      return _super !== null && _super.apply(this, arguments) || this;
    }
    LineView2.prototype.init = function() {
      var lineGroup = new Group();
      var symbolDraw = new SymbolDraw();
      this.group.add(symbolDraw.group);
      this._symbolDraw = symbolDraw;
      this._lineGroup = lineGroup;
      this._changePolyState = bind(this._changePolyState, this);
    };
    LineView2.prototype.render = function(seriesModel, ecModel, api) {
      var coordSys = seriesModel.coordinateSystem;
      var group = this.group;
      var data = seriesModel.getData();
      var lineStyleModel = seriesModel.getModel("lineStyle");
      var areaStyleModel = seriesModel.getModel("areaStyle");
      var points = data.getLayout("points") || [];
      var isCoordSysPolar = coordSys.type === "polar";
      var prevCoordSys = this._coordSys;
      var symbolDraw = this._symbolDraw;
      var polyline = this._polyline;
      var polygon = this._polygon;
      var lineGroup = this._lineGroup;
      var hasAnimation = !ecModel.ssr && seriesModel.get("animation");
      var isAreaChart = !areaStyleModel.isEmpty();
      var valueOrigin = areaStyleModel.get("origin");
      var dataCoordInfo = prepareDataCoordInfo(coordSys, data, valueOrigin);
      var stackedOnPoints = isAreaChart && getStackedOnPoints(coordSys, data, dataCoordInfo);
      var showSymbol = seriesModel.get("showSymbol");
      var connectNulls = seriesModel.get("connectNulls");
      var isIgnoreFunc = showSymbol && !isCoordSysPolar && getIsIgnoreFunc(seriesModel, data, coordSys);
      var oldData = this._data;
      oldData && oldData.eachItemGraphicEl(function(el, idx) {
        if (el.__temp) {
          group.remove(el);
          oldData.setItemGraphicEl(idx, null);
        }
      });
      if (!showSymbol) {
        symbolDraw.remove();
      }
      group.add(lineGroup);
      var step = !isCoordSysPolar ? seriesModel.get("step") : false;
      var clipShapeForSymbol;
      if (coordSys && coordSys.getArea && seriesModel.get("clip", true)) {
        clipShapeForSymbol = coordSys.getArea();
        if (clipShapeForSymbol.width != null) {
          clipShapeForSymbol.x -= 0.1;
          clipShapeForSymbol.y -= 0.1;
          clipShapeForSymbol.width += 0.2;
          clipShapeForSymbol.height += 0.2;
        } else if (clipShapeForSymbol.r0) {
          clipShapeForSymbol.r0 -= 0.5;
          clipShapeForSymbol.r += 0.5;
        }
      }
      this._clipShapeForSymbol = clipShapeForSymbol;
      var visualColor = getVisualGradient(data, coordSys, api) || data.getVisual("style")[data.getVisual("drawType")];
      if (!(polyline && prevCoordSys.type === coordSys.type && step === this._step)) {
        showSymbol && symbolDraw.updateData(data, {
          isIgnore: isIgnoreFunc,
          clipShape: clipShapeForSymbol,
          disableAnimation: true,
          getSymbolPoint: function(idx) {
            return [points[idx * 2], points[idx * 2 + 1]];
          }
        });
        hasAnimation && this._initSymbolLabelAnimation(data, coordSys, clipShapeForSymbol);
        if (step) {
          if (stackedOnPoints) {
            stackedOnPoints = turnPointsIntoStep(stackedOnPoints, points, coordSys, step, connectNulls);
          }
          points = turnPointsIntoStep(points, null, coordSys, step, connectNulls);
        }
        polyline = this._newPolyline(points);
        if (isAreaChart) {
          polygon = this._newPolygon(points, stackedOnPoints);
        } else if (polygon) {
          lineGroup.remove(polygon);
          polygon = this._polygon = null;
        }
        if (!isCoordSysPolar) {
          this._initOrUpdateEndLabel(seriesModel, coordSys, convertToColorString(visualColor));
        }
        lineGroup.setClipPath(createLineClipPath(this, coordSys, true, seriesModel));
      } else {
        if (isAreaChart && !polygon) {
          polygon = this._newPolygon(points, stackedOnPoints);
        } else if (polygon && !isAreaChart) {
          lineGroup.remove(polygon);
          polygon = this._polygon = null;
        }
        if (!isCoordSysPolar) {
          this._initOrUpdateEndLabel(seriesModel, coordSys, convertToColorString(visualColor));
        }
        var oldClipPath = lineGroup.getClipPath();
        if (oldClipPath) {
          var newClipPath = createLineClipPath(this, coordSys, false, seriesModel);
          initProps(oldClipPath, {
            shape: newClipPath.shape
          }, seriesModel);
        } else {
          lineGroup.setClipPath(createLineClipPath(this, coordSys, true, seriesModel));
        }
        showSymbol && symbolDraw.updateData(data, {
          isIgnore: isIgnoreFunc,
          clipShape: clipShapeForSymbol,
          disableAnimation: true,
          getSymbolPoint: function(idx) {
            return [points[idx * 2], points[idx * 2 + 1]];
          }
        });
        if (!isPointsSame(this._stackedOnPoints, stackedOnPoints) || !isPointsSame(this._points, points)) {
          if (hasAnimation) {
            this._doUpdateAnimation(data, stackedOnPoints, coordSys, api, step, valueOrigin, connectNulls);
          } else {
            if (step) {
              if (stackedOnPoints) {
                stackedOnPoints = turnPointsIntoStep(stackedOnPoints, points, coordSys, step, connectNulls);
              }
              points = turnPointsIntoStep(points, null, coordSys, step, connectNulls);
            }
            polyline.setShape({
              points
            });
            polygon && polygon.setShape({
              points,
              stackedOnPoints
            });
          }
        }
      }
      var emphasisModel = seriesModel.getModel("emphasis");
      var focus = emphasisModel.get("focus");
      var blurScope = emphasisModel.get("blurScope");
      var emphasisDisabled = emphasisModel.get("disabled");
      polyline.useStyle(defaults(
        // Use color in lineStyle first
        lineStyleModel.getLineStyle(),
        {
          fill: "none",
          stroke: visualColor,
          lineJoin: "bevel"
        }
      ));
      setStatesStylesFromModel(polyline, seriesModel, "lineStyle");
      if (polyline.style.lineWidth > 0 && seriesModel.get(["emphasis", "lineStyle", "width"]) === "bolder") {
        var emphasisLineStyle = polyline.getState("emphasis").style;
        emphasisLineStyle.lineWidth = +polyline.style.lineWidth + 1;
      }
      getECData(polyline).seriesIndex = seriesModel.seriesIndex;
      toggleHoverEmphasis(polyline, focus, blurScope, emphasisDisabled);
      var smooth = getSmooth(seriesModel.get("smooth"));
      var smoothMonotone = seriesModel.get("smoothMonotone");
      polyline.setShape({
        smooth,
        smoothMonotone,
        connectNulls
      });
      if (polygon) {
        var stackedOnSeries = data.getCalculationInfo("stackedOnSeries");
        var stackedOnSmooth = 0;
        polygon.useStyle(defaults(areaStyleModel.getAreaStyle(), {
          fill: visualColor,
          opacity: 0.7,
          lineJoin: "bevel",
          decal: data.getVisual("style").decal
        }));
        if (stackedOnSeries) {
          stackedOnSmooth = getSmooth(stackedOnSeries.get("smooth"));
        }
        polygon.setShape({
          smooth,
          stackedOnSmooth,
          smoothMonotone,
          connectNulls
        });
        setStatesStylesFromModel(polygon, seriesModel, "areaStyle");
        getECData(polygon).seriesIndex = seriesModel.seriesIndex;
        toggleHoverEmphasis(polygon, focus, blurScope, emphasisDisabled);
      }
      var changePolyState = this._changePolyState;
      data.eachItemGraphicEl(function(el) {
        el && (el.onHoverStateChange = changePolyState);
      });
      this._polyline.onHoverStateChange = changePolyState;
      this._data = data;
      this._coordSys = coordSys;
      this._stackedOnPoints = stackedOnPoints;
      this._points = points;
      this._step = step;
      this._valueOrigin = valueOrigin;
      if (seriesModel.get("triggerLineEvent")) {
        this.packEventData(seriesModel, polyline);
        polygon && this.packEventData(seriesModel, polygon);
      }
    };
    LineView2.prototype.packEventData = function(seriesModel, el) {
      getECData(el).eventData = {
        componentType: "series",
        componentSubType: "line",
        componentIndex: seriesModel.componentIndex,
        seriesIndex: seriesModel.seriesIndex,
        seriesName: seriesModel.name,
        seriesType: "line"
      };
    };
    LineView2.prototype.highlight = function(seriesModel, ecModel, api, payload) {
      var data = seriesModel.getData();
      var dataIndex = queryDataIndex(data, payload);
      this._changePolyState("emphasis");
      if (!(dataIndex instanceof Array) && dataIndex != null && dataIndex >= 0) {
        var points = data.getLayout("points");
        var symbol = data.getItemGraphicEl(dataIndex);
        if (!symbol) {
          var x = points[dataIndex * 2];
          var y = points[dataIndex * 2 + 1];
          if (isNaN(x) || isNaN(y)) {
            return;
          }
          if (this._clipShapeForSymbol && !this._clipShapeForSymbol.contain(x, y)) {
            return;
          }
          var zlevel = seriesModel.get("zlevel") || 0;
          var z = seriesModel.get("z") || 0;
          symbol = new Symbol$1(data, dataIndex);
          symbol.x = x;
          symbol.y = y;
          symbol.setZ(zlevel, z);
          var symbolLabel = symbol.getSymbolPath().getTextContent();
          if (symbolLabel) {
            symbolLabel.zlevel = zlevel;
            symbolLabel.z = z;
            symbolLabel.z2 = this._polyline.z2 + 1;
          }
          symbol.__temp = true;
          data.setItemGraphicEl(dataIndex, symbol);
          symbol.stopSymbolAnimation(true);
          this.group.add(symbol);
        }
        symbol.highlight();
      } else {
        ChartView.prototype.highlight.call(this, seriesModel, ecModel, api, payload);
      }
    };
    LineView2.prototype.downplay = function(seriesModel, ecModel, api, payload) {
      var data = seriesModel.getData();
      var dataIndex = queryDataIndex(data, payload);
      this._changePolyState("normal");
      if (dataIndex != null && dataIndex >= 0) {
        var symbol = data.getItemGraphicEl(dataIndex);
        if (symbol) {
          if (symbol.__temp) {
            data.setItemGraphicEl(dataIndex, null);
            this.group.remove(symbol);
          } else {
            symbol.downplay();
          }
        }
      } else {
        ChartView.prototype.downplay.call(this, seriesModel, ecModel, api, payload);
      }
    };
    LineView2.prototype._changePolyState = function(toState) {
      var polygon = this._polygon;
      setStatesFlag(this._polyline, toState);
      polygon && setStatesFlag(polygon, toState);
    };
    LineView2.prototype._newPolyline = function(points) {
      var polyline = this._polyline;
      if (polyline) {
        this._lineGroup.remove(polyline);
      }
      polyline = new ECPolyline({
        shape: {
          points
        },
        segmentIgnoreThreshold: 2,
        z2: 10
      });
      this._lineGroup.add(polyline);
      this._polyline = polyline;
      return polyline;
    };
    LineView2.prototype._newPolygon = function(points, stackedOnPoints) {
      var polygon = this._polygon;
      if (polygon) {
        this._lineGroup.remove(polygon);
      }
      polygon = new ECPolygon({
        shape: {
          points,
          stackedOnPoints
        },
        segmentIgnoreThreshold: 2
      });
      this._lineGroup.add(polygon);
      this._polygon = polygon;
      return polygon;
    };
    LineView2.prototype._initSymbolLabelAnimation = function(data, coordSys, clipShape) {
      var isHorizontalOrRadial;
      var isCoordSysPolar;
      var baseAxis = coordSys.getBaseAxis();
      var isAxisInverse = baseAxis.inverse;
      if (coordSys.type === "cartesian2d") {
        isHorizontalOrRadial = baseAxis.isHorizontal();
        isCoordSysPolar = false;
      } else if (coordSys.type === "polar") {
        isHorizontalOrRadial = baseAxis.dim === "angle";
        isCoordSysPolar = true;
      }
      var seriesModel = data.hostModel;
      var seriesDuration = seriesModel.get("animationDuration");
      if (isFunction(seriesDuration)) {
        seriesDuration = seriesDuration(null);
      }
      var seriesDelay = seriesModel.get("animationDelay") || 0;
      var seriesDelayValue = isFunction(seriesDelay) ? seriesDelay(null) : seriesDelay;
      data.eachItemGraphicEl(function(symbol, idx) {
        var el = symbol;
        if (el) {
          var point = [symbol.x, symbol.y];
          var start = void 0;
          var end = void 0;
          var current = void 0;
          if (clipShape) {
            if (isCoordSysPolar) {
              var polarClip = clipShape;
              var coord = coordSys.pointToCoord(point);
              if (isHorizontalOrRadial) {
                start = polarClip.startAngle;
                end = polarClip.endAngle;
                current = -coord[1] / 180 * Math.PI;
              } else {
                start = polarClip.r0;
                end = polarClip.r;
                current = coord[0];
              }
            } else {
              var gridClip = clipShape;
              if (isHorizontalOrRadial) {
                start = gridClip.x;
                end = gridClip.x + gridClip.width;
                current = symbol.x;
              } else {
                start = gridClip.y + gridClip.height;
                end = gridClip.y;
                current = symbol.y;
              }
            }
          }
          var ratio = end === start ? 0 : (current - start) / (end - start);
          if (isAxisInverse) {
            ratio = 1 - ratio;
          }
          var delay = isFunction(seriesDelay) ? seriesDelay(idx) : seriesDuration * ratio + seriesDelayValue;
          var symbolPath = el.getSymbolPath();
          var text = symbolPath.getTextContent();
          el.attr({
            scaleX: 0,
            scaleY: 0
          });
          el.animateTo({
            scaleX: 1,
            scaleY: 1
          }, {
            duration: 200,
            setToFinal: true,
            delay
          });
          if (text) {
            text.animateFrom({
              style: {
                opacity: 0
              }
            }, {
              duration: 300,
              delay
            });
          }
          symbolPath.disableLabelAnimation = true;
        }
      });
    };
    LineView2.prototype._initOrUpdateEndLabel = function(seriesModel, coordSys, inheritColor) {
      var endLabelModel = seriesModel.getModel("endLabel");
      if (anyStateShowEndLabel(seriesModel)) {
        var data_2 = seriesModel.getData();
        var polyline = this._polyline;
        var points = data_2.getLayout("points");
        if (!points) {
          polyline.removeTextContent();
          this._endLabel = null;
          return;
        }
        var endLabel = this._endLabel;
        if (!endLabel) {
          endLabel = this._endLabel = new ZRText({
            z2: 200
            // should be higher than item symbol
          });
          endLabel.ignoreClip = true;
          polyline.setTextContent(this._endLabel);
          polyline.disableLabelAnimation = true;
        }
        var dataIndex = getLastIndexNotNull(points);
        if (dataIndex >= 0) {
          setLabelStyle(polyline, getLabelStatesModels(seriesModel, "endLabel"), {
            inheritColor,
            labelFetcher: seriesModel,
            labelDataIndex: dataIndex,
            defaultText: function(dataIndex2, opt, interpolatedValue) {
              return interpolatedValue != null ? getDefaultInterpolatedLabel(data_2, interpolatedValue) : getDefaultLabel(data_2, dataIndex2);
            },
            enableTextSetter: true
          }, getEndLabelStateSpecified(endLabelModel, coordSys));
          polyline.textConfig.position = null;
        }
      } else if (this._endLabel) {
        this._polyline.removeTextContent();
        this._endLabel = null;
      }
    };
    LineView2.prototype._endLabelOnDuring = function(percent, clipRect, data, animationRecord, valueAnimation, endLabelModel, coordSys) {
      var endLabel = this._endLabel;
      var polyline = this._polyline;
      if (endLabel) {
        if (percent < 1 && animationRecord.originalX == null) {
          animationRecord.originalX = endLabel.x;
          animationRecord.originalY = endLabel.y;
        }
        var points = data.getLayout("points");
        var seriesModel = data.hostModel;
        var connectNulls = seriesModel.get("connectNulls");
        var precision = endLabelModel.get("precision");
        var distance = endLabelModel.get("distance") || 0;
        var baseAxis = coordSys.getBaseAxis();
        var isHorizontal = baseAxis.isHorizontal();
        var isBaseInversed = baseAxis.inverse;
        var clipShape = clipRect.shape;
        var xOrY = isBaseInversed ? isHorizontal ? clipShape.x : clipShape.y + clipShape.height : isHorizontal ? clipShape.x + clipShape.width : clipShape.y;
        var distanceX = (isHorizontal ? distance : 0) * (isBaseInversed ? -1 : 1);
        var distanceY = (isHorizontal ? 0 : -distance) * (isBaseInversed ? -1 : 1);
        var dim = isHorizontal ? "x" : "y";
        var dataIndexRange = getIndexRange(points, xOrY, dim);
        var indices = dataIndexRange.range;
        var diff = indices[1] - indices[0];
        var value = void 0;
        if (diff >= 1) {
          if (diff > 1 && !connectNulls) {
            var pt = getPointAtIndex(points, indices[0]);
            endLabel.attr({
              x: pt[0] + distanceX,
              y: pt[1] + distanceY
            });
            valueAnimation && (value = seriesModel.getRawValue(indices[0]));
          } else {
            var pt = polyline.getPointOn(xOrY, dim);
            pt && endLabel.attr({
              x: pt[0] + distanceX,
              y: pt[1] + distanceY
            });
            var startValue = seriesModel.getRawValue(indices[0]);
            var endValue = seriesModel.getRawValue(indices[1]);
            valueAnimation && (value = interpolateRawValues(data, precision, startValue, endValue, dataIndexRange.t));
          }
          animationRecord.lastFrameIndex = indices[0];
        } else {
          var idx = percent === 1 || animationRecord.lastFrameIndex > 0 ? indices[0] : 0;
          var pt = getPointAtIndex(points, idx);
          valueAnimation && (value = seriesModel.getRawValue(idx));
          endLabel.attr({
            x: pt[0] + distanceX,
            y: pt[1] + distanceY
          });
        }
        if (valueAnimation) {
          var inner = labelInner(endLabel);
          if (typeof inner.setLabelText === "function") {
            inner.setLabelText(value);
          }
        }
      }
    };
    LineView2.prototype._doUpdateAnimation = function(data, stackedOnPoints, coordSys, api, step, valueOrigin, connectNulls) {
      var polyline = this._polyline;
      var polygon = this._polygon;
      var seriesModel = data.hostModel;
      var diff = lineAnimationDiff(this._data, data, this._stackedOnPoints, stackedOnPoints, this._coordSys, coordSys, this._valueOrigin);
      var current = diff.current;
      var stackedOnCurrent = diff.stackedOnCurrent;
      var next = diff.next;
      var stackedOnNext = diff.stackedOnNext;
      if (step) {
        stackedOnCurrent = turnPointsIntoStep(diff.stackedOnCurrent, diff.current, coordSys, step, connectNulls);
        current = turnPointsIntoStep(diff.current, null, coordSys, step, connectNulls);
        stackedOnNext = turnPointsIntoStep(diff.stackedOnNext, diff.next, coordSys, step, connectNulls);
        next = turnPointsIntoStep(diff.next, null, coordSys, step, connectNulls);
      }
      if (getBoundingDiff(current, next) > 3e3 || polygon && getBoundingDiff(stackedOnCurrent, stackedOnNext) > 3e3) {
        polyline.stopAnimation();
        polyline.setShape({
          points: next
        });
        if (polygon) {
          polygon.stopAnimation();
          polygon.setShape({
            points: next,
            stackedOnPoints: stackedOnNext
          });
        }
        return;
      }
      polyline.shape.__points = diff.current;
      polyline.shape.points = current;
      var target = {
        shape: {
          points: next
        }
      };
      if (diff.current !== current) {
        target.shape.__points = diff.next;
      }
      polyline.stopAnimation();
      updateProps(polyline, target, seriesModel);
      if (polygon) {
        polygon.setShape({
          // Reuse the points with polyline.
          points: current,
          stackedOnPoints: stackedOnCurrent
        });
        polygon.stopAnimation();
        updateProps(polygon, {
          shape: {
            stackedOnPoints: stackedOnNext
          }
        }, seriesModel);
        if (polyline.shape.points !== polygon.shape.points) {
          polygon.shape.points = polyline.shape.points;
        }
      }
      var updatedDataInfo = [];
      var diffStatus = diff.status;
      for (var i = 0; i < diffStatus.length; i++) {
        var cmd = diffStatus[i].cmd;
        if (cmd === "=") {
          var el = data.getItemGraphicEl(diffStatus[i].idx1);
          if (el) {
            updatedDataInfo.push({
              el,
              ptIdx: i
              // Index of points
            });
          }
        }
      }
      if (polyline.animators && polyline.animators.length) {
        polyline.animators[0].during(function() {
          polygon && polygon.dirtyShape();
          var points = polyline.shape.__points;
          for (var i2 = 0; i2 < updatedDataInfo.length; i2++) {
            var el2 = updatedDataInfo[i2].el;
            var offset = updatedDataInfo[i2].ptIdx * 2;
            el2.x = points[offset];
            el2.y = points[offset + 1];
            el2.markRedraw();
          }
        });
      }
    };
    LineView2.prototype.remove = function(ecModel) {
      var group = this.group;
      var oldData = this._data;
      this._lineGroup.removeAll();
      this._symbolDraw.remove(true);
      oldData && oldData.eachItemGraphicEl(function(el, idx) {
        if (el.__temp) {
          group.remove(el);
          oldData.setItemGraphicEl(idx, null);
        }
      });
      this._polyline = this._polygon = this._coordSys = this._points = this._stackedOnPoints = this._endLabel = this._data = null;
    };
    LineView2.type = "line";
    return LineView2;
  }(ChartView)
);
function pointsLayout(seriesType, forceStoreInTypedArray) {
  return {
    seriesType,
    plan: createRenderPlanner(),
    reset: function(seriesModel) {
      var data = seriesModel.getData();
      var coordSys = seriesModel.coordinateSystem;
      seriesModel.pipelineContext;
      if (!coordSys) {
        return;
      }
      var dims = map(coordSys.dimensions, function(dim) {
        return data.mapDimension(dim);
      }).slice(0, 2);
      var dimLen = dims.length;
      var stackResultDim = data.getCalculationInfo("stackResultDimension");
      if (isDimensionStacked(data, dims[0])) {
        dims[0] = stackResultDim;
      }
      if (isDimensionStacked(data, dims[1])) {
        dims[1] = stackResultDim;
      }
      var store = data.getStore();
      var dimIdx0 = data.getDimensionIndex(dims[0]);
      var dimIdx1 = data.getDimensionIndex(dims[1]);
      return dimLen && {
        progress: function(params, data2) {
          var segCount = params.end - params.start;
          var points = createFloat32Array(segCount * dimLen);
          var tmpIn = [];
          var tmpOut = [];
          for (var i = params.start, offset = 0; i < params.end; i++) {
            var point = void 0;
            if (dimLen === 1) {
              var x = store.get(dimIdx0, i);
              point = coordSys.dataToPoint(x, null, tmpOut);
            } else {
              tmpIn[0] = store.get(dimIdx0, i);
              tmpIn[1] = store.get(dimIdx1, i);
              point = coordSys.dataToPoint(tmpIn, null, tmpOut);
            }
            {
              points[offset++] = point[0];
              points[offset++] = point[1];
            }
          }
          data2.setLayout("points", points);
        }
      };
    }
  };
}
var samplers = {
  average: function(frame) {
    var sum = 0;
    var count = 0;
    for (var i = 0; i < frame.length; i++) {
      if (!isNaN(frame[i])) {
        sum += frame[i];
        count++;
      }
    }
    return count === 0 ? NaN : sum / count;
  },
  sum: function(frame) {
    var sum = 0;
    for (var i = 0; i < frame.length; i++) {
      sum += frame[i] || 0;
    }
    return sum;
  },
  max: function(frame) {
    var max = -Infinity;
    for (var i = 0; i < frame.length; i++) {
      frame[i] > max && (max = frame[i]);
    }
    return isFinite(max) ? max : NaN;
  },
  min: function(frame) {
    var min = Infinity;
    for (var i = 0; i < frame.length; i++) {
      frame[i] < min && (min = frame[i]);
    }
    return isFinite(min) ? min : NaN;
  },
  // TODO
  // Median
  nearest: function(frame) {
    return frame[0];
  }
};
var indexSampler = function(frame) {
  return Math.round(frame.length / 2);
};
function dataSample(seriesType) {
  return {
    seriesType,
    // FIXME:TS never used, so comment it
    // modifyOutputEnd: true,
    reset: function(seriesModel, ecModel, api) {
      var data = seriesModel.getData();
      var sampling = seriesModel.get("sampling");
      var coordSys = seriesModel.coordinateSystem;
      var count = data.count();
      if (count > 10 && coordSys.type === "cartesian2d" && sampling) {
        var baseAxis = coordSys.getBaseAxis();
        var valueAxis = coordSys.getOtherAxis(baseAxis);
        var extent = baseAxis.getExtent();
        var dpr = api.getDevicePixelRatio();
        var size = Math.abs(extent[1] - extent[0]) * (dpr || 1);
        var rate = Math.round(count / size);
        if (isFinite(rate) && rate > 1) {
          if (sampling === "lttb") {
            seriesModel.setData(data.lttbDownSample(data.mapDimension(valueAxis.dim), 1 / rate));
          } else if (sampling === "minmax") {
            seriesModel.setData(data.minmaxDownSample(data.mapDimension(valueAxis.dim), 1 / rate));
          }
          var sampler = void 0;
          if (isString(sampling)) {
            sampler = samplers[sampling];
          } else if (isFunction(sampling)) {
            sampler = sampling;
          }
          if (sampler) {
            seriesModel.setData(data.downSample(data.mapDimension(valueAxis.dim), 1 / rate, sampler, indexSampler));
          }
        }
      }
    }
  };
}
function install$1(registers) {
  registers.registerChartView(LineView);
  registers.registerSeriesModel(LineSeriesModel);
  registers.registerLayout(pointsLayout("line"));
  registers.registerVisual({
    seriesType: "line",
    reset: function(seriesModel) {
      var data = seriesModel.getData();
      var lineStyle = seriesModel.getModel("lineStyle").getLineStyle();
      if (lineStyle && !lineStyle.stroke) {
        lineStyle.stroke = data.getVisual("style").fill;
      }
      data.setVisual("legendLineStyle", lineStyle);
    }
  });
  registers.registerProcessor(registers.PRIORITY.PROCESSOR.STATISTIC, dataSample("line"));
}
var BaseBarSeriesModel = (
  /** @class */
  function(_super) {
    __extends(BaseBarSeriesModel2, _super);
    function BaseBarSeriesModel2() {
      var _this = _super !== null && _super.apply(this, arguments) || this;
      _this.type = BaseBarSeriesModel2.type;
      return _this;
    }
    BaseBarSeriesModel2.prototype.getInitialData = function(option, ecModel) {
      return createSeriesData(null, this, {
        useEncodeDefaulter: true
      });
    };
    BaseBarSeriesModel2.prototype.getMarkerPosition = function(value, dims, startingAtTick) {
      var coordSys = this.coordinateSystem;
      if (coordSys && coordSys.clampData) {
        var clampData_1 = coordSys.clampData(value);
        var pt_1 = coordSys.dataToPoint(clampData_1);
        if (startingAtTick) {
          each(coordSys.getAxes(), function(axis, idx) {
            if (axis.type === "category" && dims != null) {
              var tickCoords = axis.getTicksCoords();
              var alignTicksWithLabel = axis.getTickModel().get("alignWithLabel");
              var targetTickId = clampData_1[idx];
              var isEnd = dims[idx] === "x1" || dims[idx] === "y1";
              if (isEnd && !alignTicksWithLabel) {
                targetTickId += 1;
              }
              if (tickCoords.length < 2) {
                return;
              } else if (tickCoords.length === 2) {
                pt_1[idx] = axis.toGlobalCoord(axis.getExtent()[isEnd ? 1 : 0]);
                return;
              }
              var leftCoord = void 0;
              var coord = void 0;
              var stepTickValue = 1;
              for (var i = 0; i < tickCoords.length; i++) {
                var tickCoord = tickCoords[i].coord;
                var tickValue = i === tickCoords.length - 1 ? tickCoords[i - 1].tickValue + stepTickValue : tickCoords[i].tickValue;
                if (tickValue === targetTickId) {
                  coord = tickCoord;
                  break;
                } else if (tickValue < targetTickId) {
                  leftCoord = tickCoord;
                } else if (leftCoord != null && tickValue > targetTickId) {
                  coord = (tickCoord + leftCoord) / 2;
                  break;
                }
                if (i === 1) {
                  stepTickValue = tickValue - tickCoords[0].tickValue;
                }
              }
              if (coord == null) {
                if (!leftCoord) {
                  coord = tickCoords[0].coord;
                } else if (leftCoord) {
                  coord = tickCoords[tickCoords.length - 1].coord;
                }
              }
              pt_1[idx] = axis.toGlobalCoord(coord);
            }
          });
        } else {
          var data = this.getData();
          var offset = data.getLayout("offset");
          var size = data.getLayout("size");
          var offsetIndex = coordSys.getBaseAxis().isHorizontal() ? 0 : 1;
          pt_1[offsetIndex] += offset + size / 2;
        }
        return pt_1;
      }
      return [NaN, NaN];
    };
    BaseBarSeriesModel2.type = "series.__base_bar__";
    BaseBarSeriesModel2.defaultOption = {
      // zlevel: 0,
      z: 2,
      coordinateSystem: "cartesian2d",
      legendHoverLink: true,
      // stack: null
      // Cartesian coordinate system
      // xAxisIndex: 0,
      // yAxisIndex: 0,
      barMinHeight: 0,
      barMinAngle: 0,
      // cursor: null,
      large: false,
      largeThreshold: 400,
      progressive: 3e3,
      progressiveChunkMode: "mod"
    };
    return BaseBarSeriesModel2;
  }(SeriesModel)
);
SeriesModel.registerClass(BaseBarSeriesModel);
var BarSeriesModel = (
  /** @class */
  function(_super) {
    __extends(BarSeriesModel2, _super);
    function BarSeriesModel2() {
      var _this = _super !== null && _super.apply(this, arguments) || this;
      _this.type = BarSeriesModel2.type;
      return _this;
    }
    BarSeriesModel2.prototype.getInitialData = function() {
      return createSeriesData(null, this, {
        useEncodeDefaulter: true,
        createInvertedIndices: !!this.get("realtimeSort", true) || null
      });
    };
    BarSeriesModel2.prototype.getProgressive = function() {
      return this.get("large") ? this.get("progressive") : false;
    };
    BarSeriesModel2.prototype.getProgressiveThreshold = function() {
      var progressiveThreshold = this.get("progressiveThreshold");
      var largeThreshold = this.get("largeThreshold");
      if (largeThreshold > progressiveThreshold) {
        progressiveThreshold = largeThreshold;
      }
      return progressiveThreshold;
    };
    BarSeriesModel2.prototype.brushSelector = function(dataIndex, data, selectors) {
      return selectors.rect(data.getItemLayout(dataIndex));
    };
    BarSeriesModel2.type = "series.bar";
    BarSeriesModel2.dependencies = ["grid", "polar"];
    BarSeriesModel2.defaultOption = inheritDefaultOption(BaseBarSeriesModel.defaultOption, {
      // If clipped
      // Only available on cartesian2d
      clip: true,
      roundCap: false,
      showBackground: false,
      backgroundStyle: {
        color: "rgba(180, 180, 180, 0.2)",
        borderColor: null,
        borderWidth: 0,
        borderType: "solid",
        borderRadius: 0,
        shadowBlur: 0,
        shadowColor: null,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        opacity: 1
      },
      select: {
        itemStyle: {
          borderColor: "#212121"
        }
      },
      realtimeSort: false
    });
    return BarSeriesModel2;
  }(BaseBarSeriesModel)
);
var SausageShape = (
  /** @class */
  /* @__PURE__ */ function() {
    function SausageShape2() {
      this.cx = 0;
      this.cy = 0;
      this.r0 = 0;
      this.r = 0;
      this.startAngle = 0;
      this.endAngle = Math.PI * 2;
      this.clockwise = true;
    }
    return SausageShape2;
  }()
);
var SausagePath = (
  /** @class */
  function(_super) {
    __extends(SausagePath2, _super);
    function SausagePath2(opts) {
      var _this = _super.call(this, opts) || this;
      _this.type = "sausage";
      return _this;
    }
    SausagePath2.prototype.getDefaultShape = function() {
      return new SausageShape();
    };
    SausagePath2.prototype.buildPath = function(ctx, shape) {
      var cx = shape.cx;
      var cy = shape.cy;
      var r0 = Math.max(shape.r0 || 0, 0);
      var r = Math.max(shape.r, 0);
      var dr = (r - r0) * 0.5;
      var rCenter = r0 + dr;
      var startAngle = shape.startAngle;
      var endAngle = shape.endAngle;
      var clockwise = shape.clockwise;
      var PI2 = Math.PI * 2;
      var lessThanCircle = clockwise ? endAngle - startAngle < PI2 : startAngle - endAngle < PI2;
      if (!lessThanCircle) {
        startAngle = endAngle - (clockwise ? PI2 : -PI2);
      }
      var unitStartX = Math.cos(startAngle);
      var unitStartY = Math.sin(startAngle);
      var unitEndX = Math.cos(endAngle);
      var unitEndY = Math.sin(endAngle);
      if (lessThanCircle) {
        ctx.moveTo(unitStartX * r0 + cx, unitStartY * r0 + cy);
        ctx.arc(unitStartX * rCenter + cx, unitStartY * rCenter + cy, dr, -Math.PI + startAngle, startAngle, !clockwise);
      } else {
        ctx.moveTo(unitStartX * r + cx, unitStartY * r + cy);
      }
      ctx.arc(cx, cy, r, startAngle, endAngle, !clockwise);
      ctx.arc(unitEndX * rCenter + cx, unitEndY * rCenter + cy, dr, endAngle - Math.PI * 2, endAngle - Math.PI, !clockwise);
      if (r0 !== 0) {
        ctx.arc(cx, cy, r0, endAngle, startAngle, clockwise);
      }
    };
    return SausagePath2;
  }(Path)
);
function createSectorCalculateTextPosition(positionMapping, opts) {
  opts = opts || {};
  var isRoundCap = opts.isRoundCap;
  return function(out, opts2, boundingRect) {
    var textPosition = opts2.position;
    if (!textPosition || textPosition instanceof Array) {
      return calculateTextPosition(out, opts2, boundingRect);
    }
    var mappedSectorPosition = positionMapping(textPosition);
    var distance = opts2.distance != null ? opts2.distance : 5;
    var sector = this.shape;
    var cx = sector.cx;
    var cy = sector.cy;
    var r = sector.r;
    var r0 = sector.r0;
    var middleR = (r + r0) / 2;
    var startAngle = sector.startAngle;
    var endAngle = sector.endAngle;
    var middleAngle = (startAngle + endAngle) / 2;
    var extraDist = isRoundCap ? Math.abs(r - r0) / 2 : 0;
    var mathCos = Math.cos;
    var mathSin = Math.sin;
    var x = cx + r * mathCos(startAngle);
    var y = cy + r * mathSin(startAngle);
    var textAlign = "left";
    var textVerticalAlign = "top";
    switch (mappedSectorPosition) {
      case "startArc":
        x = cx + (r0 - distance) * mathCos(middleAngle);
        y = cy + (r0 - distance) * mathSin(middleAngle);
        textAlign = "center";
        textVerticalAlign = "top";
        break;
      case "insideStartArc":
        x = cx + (r0 + distance) * mathCos(middleAngle);
        y = cy + (r0 + distance) * mathSin(middleAngle);
        textAlign = "center";
        textVerticalAlign = "bottom";
        break;
      case "startAngle":
        x = cx + middleR * mathCos(startAngle) + adjustAngleDistanceX(startAngle, distance + extraDist, false);
        y = cy + middleR * mathSin(startAngle) + adjustAngleDistanceY(startAngle, distance + extraDist, false);
        textAlign = "right";
        textVerticalAlign = "middle";
        break;
      case "insideStartAngle":
        x = cx + middleR * mathCos(startAngle) + adjustAngleDistanceX(startAngle, -distance + extraDist, false);
        y = cy + middleR * mathSin(startAngle) + adjustAngleDistanceY(startAngle, -distance + extraDist, false);
        textAlign = "left";
        textVerticalAlign = "middle";
        break;
      case "middle":
        x = cx + middleR * mathCos(middleAngle);
        y = cy + middleR * mathSin(middleAngle);
        textAlign = "center";
        textVerticalAlign = "middle";
        break;
      case "endArc":
        x = cx + (r + distance) * mathCos(middleAngle);
        y = cy + (r + distance) * mathSin(middleAngle);
        textAlign = "center";
        textVerticalAlign = "bottom";
        break;
      case "insideEndArc":
        x = cx + (r - distance) * mathCos(middleAngle);
        y = cy + (r - distance) * mathSin(middleAngle);
        textAlign = "center";
        textVerticalAlign = "top";
        break;
      case "endAngle":
        x = cx + middleR * mathCos(endAngle) + adjustAngleDistanceX(endAngle, distance + extraDist, true);
        y = cy + middleR * mathSin(endAngle) + adjustAngleDistanceY(endAngle, distance + extraDist, true);
        textAlign = "left";
        textVerticalAlign = "middle";
        break;
      case "insideEndAngle":
        x = cx + middleR * mathCos(endAngle) + adjustAngleDistanceX(endAngle, -distance + extraDist, true);
        y = cy + middleR * mathSin(endAngle) + adjustAngleDistanceY(endAngle, -distance + extraDist, true);
        textAlign = "right";
        textVerticalAlign = "middle";
        break;
      default:
        return calculateTextPosition(out, opts2, boundingRect);
    }
    out = out || {};
    out.x = x;
    out.y = y;
    out.align = textAlign;
    out.verticalAlign = textVerticalAlign;
    return out;
  };
}
function setSectorTextRotation(sector, textPosition, positionMapping, rotateType) {
  if (isNumber(rotateType)) {
    sector.setTextConfig({
      rotation: rotateType
    });
    return;
  } else if (isArray(textPosition)) {
    sector.setTextConfig({
      rotation: 0
    });
    return;
  }
  var shape = sector.shape;
  var startAngle = shape.clockwise ? shape.startAngle : shape.endAngle;
  var endAngle = shape.clockwise ? shape.endAngle : shape.startAngle;
  var middleAngle = (startAngle + endAngle) / 2;
  var anchorAngle;
  var mappedSectorPosition = positionMapping(textPosition);
  switch (mappedSectorPosition) {
    case "startArc":
    case "insideStartArc":
    case "middle":
    case "insideEndArc":
    case "endArc":
      anchorAngle = middleAngle;
      break;
    case "startAngle":
    case "insideStartAngle":
      anchorAngle = startAngle;
      break;
    case "endAngle":
    case "insideEndAngle":
      anchorAngle = endAngle;
      break;
    default:
      sector.setTextConfig({
        rotation: 0
      });
      return;
  }
  var rotate = Math.PI * 1.5 - anchorAngle;
  if (mappedSectorPosition === "middle" && rotate > Math.PI / 2 && rotate < Math.PI * 1.5) {
    rotate -= Math.PI;
  }
  sector.setTextConfig({
    rotation: rotate
  });
}
function adjustAngleDistanceX(angle, distance, isEnd) {
  return distance * Math.sin(angle) * (isEnd ? -1 : 1);
}
function adjustAngleDistanceY(angle, distance, isEnd) {
  return distance * Math.cos(angle) * (isEnd ? 1 : -1);
}
function getSectorCornerRadius(model, shape, zeroIfNull) {
  var cornerRadius = model.get("borderRadius");
  if (cornerRadius == null) {
    return {
      cornerRadius: 0
    };
  }
  if (!isArray(cornerRadius)) {
    cornerRadius = [cornerRadius, cornerRadius, cornerRadius, cornerRadius];
  }
  var dr = Math.abs(shape.r || 0 - shape.r0 || 0);
  return {
    cornerRadius: map(cornerRadius, function(cr) {
      return parsePercent(cr, dr);
    })
  };
}
var mathMax = Math.max;
var mathMin = Math.min;
function getClipArea(coord, data) {
  var coordSysClipArea = coord.getArea && coord.getArea();
  if (isCoordinateSystemType(coord, "cartesian2d")) {
    var baseAxis = coord.getBaseAxis();
    if (baseAxis.type !== "category" || !baseAxis.onBand) {
      var expandWidth = data.getLayout("bandWidth");
      if (baseAxis.isHorizontal()) {
        coordSysClipArea.x -= expandWidth;
        coordSysClipArea.width += expandWidth * 2;
      } else {
        coordSysClipArea.y -= expandWidth;
        coordSysClipArea.height += expandWidth * 2;
      }
    }
  }
  return coordSysClipArea;
}
var BarView = (
  /** @class */
  function(_super) {
    __extends(BarView2, _super);
    function BarView2() {
      var _this = _super.call(this) || this;
      _this.type = BarView2.type;
      _this._isFirstFrame = true;
      return _this;
    }
    BarView2.prototype.render = function(seriesModel, ecModel, api, payload) {
      this._model = seriesModel;
      this._removeOnRenderedListener(api);
      this._updateDrawMode(seriesModel);
      var coordinateSystemType = seriesModel.get("coordinateSystem");
      if (coordinateSystemType === "cartesian2d" || coordinateSystemType === "polar") {
        this._progressiveEls = null;
        this._isLargeDraw ? this._renderLarge(seriesModel, ecModel, api) : this._renderNormal(seriesModel, ecModel, api, payload);
      } else if (process.env.NODE_ENV !== "production") {
        warn("Only cartesian2d and polar supported for bar.");
      }
    };
    BarView2.prototype.incrementalPrepareRender = function(seriesModel) {
      this._clear();
      this._updateDrawMode(seriesModel);
      this._updateLargeClip(seriesModel);
    };
    BarView2.prototype.incrementalRender = function(params, seriesModel) {
      this._progressiveEls = [];
      this._incrementalRenderLarge(params, seriesModel);
    };
    BarView2.prototype.eachRendered = function(cb) {
      traverseElements(this._progressiveEls || this.group, cb);
    };
    BarView2.prototype._updateDrawMode = function(seriesModel) {
      var isLargeDraw = seriesModel.pipelineContext.large;
      if (this._isLargeDraw == null || isLargeDraw !== this._isLargeDraw) {
        this._isLargeDraw = isLargeDraw;
        this._clear();
      }
    };
    BarView2.prototype._renderNormal = function(seriesModel, ecModel, api, payload) {
      var group = this.group;
      var data = seriesModel.getData();
      var oldData = this._data;
      var coord = seriesModel.coordinateSystem;
      var baseAxis = coord.getBaseAxis();
      var isHorizontalOrRadial;
      if (coord.type === "cartesian2d") {
        isHorizontalOrRadial = baseAxis.isHorizontal();
      } else if (coord.type === "polar") {
        isHorizontalOrRadial = baseAxis.dim === "angle";
      }
      var animationModel = seriesModel.isAnimationEnabled() ? seriesModel : null;
      var realtimeSortCfg = shouldRealtimeSort(seriesModel, coord);
      if (realtimeSortCfg) {
        this._enableRealtimeSort(realtimeSortCfg, data, api);
      }
      var needsClip = seriesModel.get("clip", true) || realtimeSortCfg;
      var coordSysClipArea = getClipArea(coord, data);
      group.removeClipPath();
      var roundCap = seriesModel.get("roundCap", true);
      var drawBackground = seriesModel.get("showBackground", true);
      var backgroundModel = seriesModel.getModel("backgroundStyle");
      var barBorderRadius = backgroundModel.get("borderRadius") || 0;
      var bgEls = [];
      var oldBgEls = this._backgroundEls;
      var isInitSort = payload && payload.isInitSort;
      var isChangeOrder = payload && payload.type === "changeAxisOrder";
      function createBackground(dataIndex) {
        var bgLayout = getLayout[coord.type](data, dataIndex);
        var bgEl = createBackgroundEl(coord, isHorizontalOrRadial, bgLayout);
        bgEl.useStyle(backgroundModel.getItemStyle());
        if (coord.type === "cartesian2d") {
          bgEl.setShape("r", barBorderRadius);
        } else {
          bgEl.setShape("cornerRadius", barBorderRadius);
        }
        bgEls[dataIndex] = bgEl;
        return bgEl;
      }
      data.diff(oldData).add(function(dataIndex) {
        var itemModel = data.getItemModel(dataIndex);
        var layout2 = getLayout[coord.type](data, dataIndex, itemModel);
        if (drawBackground) {
          createBackground(dataIndex);
        }
        if (!data.hasValue(dataIndex) || !isValidLayout[coord.type](layout2)) {
          return;
        }
        var isClipped = false;
        if (needsClip) {
          isClipped = clip[coord.type](coordSysClipArea, layout2);
        }
        var el = elementCreator[coord.type](seriesModel, data, dataIndex, layout2, isHorizontalOrRadial, animationModel, baseAxis.model, false, roundCap);
        if (realtimeSortCfg) {
          el.forceLabelAnimation = true;
        }
        updateStyle(el, data, dataIndex, itemModel, layout2, seriesModel, isHorizontalOrRadial, coord.type === "polar");
        if (isInitSort) {
          el.attr({
            shape: layout2
          });
        } else if (realtimeSortCfg) {
          updateRealtimeAnimation(realtimeSortCfg, animationModel, el, layout2, dataIndex, isHorizontalOrRadial, false, false);
        } else {
          initProps(el, {
            shape: layout2
          }, seriesModel, dataIndex);
        }
        data.setItemGraphicEl(dataIndex, el);
        group.add(el);
        el.ignore = isClipped;
      }).update(function(newIndex, oldIndex) {
        var itemModel = data.getItemModel(newIndex);
        var layout2 = getLayout[coord.type](data, newIndex, itemModel);
        if (drawBackground) {
          var bgEl = void 0;
          if (oldBgEls.length === 0) {
            bgEl = createBackground(oldIndex);
          } else {
            bgEl = oldBgEls[oldIndex];
            bgEl.useStyle(backgroundModel.getItemStyle());
            if (coord.type === "cartesian2d") {
              bgEl.setShape("r", barBorderRadius);
            } else {
              bgEl.setShape("cornerRadius", barBorderRadius);
            }
            bgEls[newIndex] = bgEl;
          }
          var bgLayout = getLayout[coord.type](data, newIndex);
          var shape = createBackgroundShape(isHorizontalOrRadial, bgLayout, coord);
          updateProps(bgEl, {
            shape
          }, animationModel, newIndex);
        }
        var el = oldData.getItemGraphicEl(oldIndex);
        if (!data.hasValue(newIndex) || !isValidLayout[coord.type](layout2)) {
          group.remove(el);
          return;
        }
        var isClipped = false;
        if (needsClip) {
          isClipped = clip[coord.type](coordSysClipArea, layout2);
          if (isClipped) {
            group.remove(el);
          }
        }
        if (!el) {
          el = elementCreator[coord.type](seriesModel, data, newIndex, layout2, isHorizontalOrRadial, animationModel, baseAxis.model, !!el, roundCap);
        } else {
          saveOldStyle(el);
        }
        if (realtimeSortCfg) {
          el.forceLabelAnimation = true;
        }
        if (isChangeOrder) {
          var textEl = el.getTextContent();
          if (textEl) {
            var labelInnerStore = labelInner(textEl);
            if (labelInnerStore.prevValue != null) {
              labelInnerStore.prevValue = labelInnerStore.value;
            }
          }
        } else {
          updateStyle(el, data, newIndex, itemModel, layout2, seriesModel, isHorizontalOrRadial, coord.type === "polar");
        }
        if (isInitSort) {
          el.attr({
            shape: layout2
          });
        } else if (realtimeSortCfg) {
          updateRealtimeAnimation(realtimeSortCfg, animationModel, el, layout2, newIndex, isHorizontalOrRadial, true, isChangeOrder);
        } else {
          updateProps(el, {
            shape: layout2
          }, seriesModel, newIndex, null);
        }
        data.setItemGraphicEl(newIndex, el);
        el.ignore = isClipped;
        group.add(el);
      }).remove(function(dataIndex) {
        var el = oldData.getItemGraphicEl(dataIndex);
        el && removeElementWithFadeOut(el, seriesModel, dataIndex);
      }).execute();
      var bgGroup = this._backgroundGroup || (this._backgroundGroup = new Group());
      bgGroup.removeAll();
      for (var i = 0; i < bgEls.length; ++i) {
        bgGroup.add(bgEls[i]);
      }
      group.add(bgGroup);
      this._backgroundEls = bgEls;
      this._data = data;
    };
    BarView2.prototype._renderLarge = function(seriesModel, ecModel, api) {
      this._clear();
      createLarge(seriesModel, this.group);
      this._updateLargeClip(seriesModel);
    };
    BarView2.prototype._incrementalRenderLarge = function(params, seriesModel) {
      this._removeBackground();
      createLarge(seriesModel, this.group, this._progressiveEls, true);
    };
    BarView2.prototype._updateLargeClip = function(seriesModel) {
      var clipPath = seriesModel.get("clip", true) && createClipPath(seriesModel.coordinateSystem, false, seriesModel);
      var group = this.group;
      if (clipPath) {
        group.setClipPath(clipPath);
      } else {
        group.removeClipPath();
      }
    };
    BarView2.prototype._enableRealtimeSort = function(realtimeSortCfg, data, api) {
      var _this = this;
      if (!data.count()) {
        return;
      }
      var baseAxis = realtimeSortCfg.baseAxis;
      if (this._isFirstFrame) {
        this._dispatchInitSort(data, realtimeSortCfg, api);
        this._isFirstFrame = false;
      } else {
        var orderMapping_1 = function(idx) {
          var el = data.getItemGraphicEl(idx);
          var shape = el && el.shape;
          return shape && // The result should be consistent with the initial sort by data value.
          // Do not support the case that both positive and negative exist.
          Math.abs(baseAxis.isHorizontal() ? shape.height : shape.width) || 0;
        };
        this._onRendered = function() {
          _this._updateSortWithinSameData(data, orderMapping_1, baseAxis, api);
        };
        api.getZr().on("rendered", this._onRendered);
      }
    };
    BarView2.prototype._dataSort = function(data, baseAxis, orderMapping) {
      var info = [];
      data.each(data.mapDimension(baseAxis.dim), function(ordinalNumber, dataIdx) {
        var mappedValue = orderMapping(dataIdx);
        mappedValue = mappedValue == null ? NaN : mappedValue;
        info.push({
          dataIndex: dataIdx,
          mappedValue,
          ordinalNumber
        });
      });
      info.sort(function(a, b) {
        return b.mappedValue - a.mappedValue;
      });
      return {
        ordinalNumbers: map(info, function(item) {
          return item.ordinalNumber;
        })
      };
    };
    BarView2.prototype._isOrderChangedWithinSameData = function(data, orderMapping, baseAxis) {
      var scale = baseAxis.scale;
      var ordinalDataDim = data.mapDimension(baseAxis.dim);
      var lastValue = Number.MAX_VALUE;
      for (var tickNum = 0, len = scale.getOrdinalMeta().categories.length; tickNum < len; ++tickNum) {
        var rawIdx = data.rawIndexOf(ordinalDataDim, scale.getRawOrdinalNumber(tickNum));
        var value = rawIdx < 0 ? Number.MIN_VALUE : orderMapping(data.indexOfRawIndex(rawIdx));
        if (value > lastValue) {
          return true;
        }
        lastValue = value;
      }
      return false;
    };
    BarView2.prototype._isOrderDifferentInView = function(orderInfo, baseAxis) {
      var scale = baseAxis.scale;
      var extent = scale.getExtent();
      var tickNum = Math.max(0, extent[0]);
      var tickMax = Math.min(extent[1], scale.getOrdinalMeta().categories.length - 1);
      for (; tickNum <= tickMax; ++tickNum) {
        if (orderInfo.ordinalNumbers[tickNum] !== scale.getRawOrdinalNumber(tickNum)) {
          return true;
        }
      }
    };
    BarView2.prototype._updateSortWithinSameData = function(data, orderMapping, baseAxis, api) {
      if (!this._isOrderChangedWithinSameData(data, orderMapping, baseAxis)) {
        return;
      }
      var sortInfo = this._dataSort(data, baseAxis, orderMapping);
      if (this._isOrderDifferentInView(sortInfo, baseAxis)) {
        this._removeOnRenderedListener(api);
        api.dispatchAction({
          type: "changeAxisOrder",
          componentType: baseAxis.dim + "Axis",
          axisId: baseAxis.index,
          sortInfo
        });
      }
    };
    BarView2.prototype._dispatchInitSort = function(data, realtimeSortCfg, api) {
      var baseAxis = realtimeSortCfg.baseAxis;
      var sortResult = this._dataSort(data, baseAxis, function(dataIdx) {
        return data.get(data.mapDimension(realtimeSortCfg.otherAxis.dim), dataIdx);
      });
      api.dispatchAction({
        type: "changeAxisOrder",
        componentType: baseAxis.dim + "Axis",
        isInitSort: true,
        axisId: baseAxis.index,
        sortInfo: sortResult
      });
    };
    BarView2.prototype.remove = function(ecModel, api) {
      this._clear(this._model);
      this._removeOnRenderedListener(api);
    };
    BarView2.prototype.dispose = function(ecModel, api) {
      this._removeOnRenderedListener(api);
    };
    BarView2.prototype._removeOnRenderedListener = function(api) {
      if (this._onRendered) {
        api.getZr().off("rendered", this._onRendered);
        this._onRendered = null;
      }
    };
    BarView2.prototype._clear = function(model) {
      var group = this.group;
      var data = this._data;
      if (model && model.isAnimationEnabled() && data && !this._isLargeDraw) {
        this._removeBackground();
        this._backgroundEls = [];
        data.eachItemGraphicEl(function(el) {
          removeElementWithFadeOut(el, model, getECData(el).dataIndex);
        });
      } else {
        group.removeAll();
      }
      this._data = null;
      this._isFirstFrame = true;
    };
    BarView2.prototype._removeBackground = function() {
      this.group.remove(this._backgroundGroup);
      this._backgroundGroup = null;
    };
    BarView2.type = "bar";
    return BarView2;
  }(ChartView)
);
var clip = {
  cartesian2d: function(coordSysBoundingRect, layout2) {
    var signWidth = layout2.width < 0 ? -1 : 1;
    var signHeight = layout2.height < 0 ? -1 : 1;
    if (signWidth < 0) {
      layout2.x += layout2.width;
      layout2.width = -layout2.width;
    }
    if (signHeight < 0) {
      layout2.y += layout2.height;
      layout2.height = -layout2.height;
    }
    var coordSysX2 = coordSysBoundingRect.x + coordSysBoundingRect.width;
    var coordSysY2 = coordSysBoundingRect.y + coordSysBoundingRect.height;
    var x = mathMax(layout2.x, coordSysBoundingRect.x);
    var x2 = mathMin(layout2.x + layout2.width, coordSysX2);
    var y = mathMax(layout2.y, coordSysBoundingRect.y);
    var y2 = mathMin(layout2.y + layout2.height, coordSysY2);
    var xClipped = x2 < x;
    var yClipped = y2 < y;
    layout2.x = xClipped && x > coordSysX2 ? x2 : x;
    layout2.y = yClipped && y > coordSysY2 ? y2 : y;
    layout2.width = xClipped ? 0 : x2 - x;
    layout2.height = yClipped ? 0 : y2 - y;
    if (signWidth < 0) {
      layout2.x += layout2.width;
      layout2.width = -layout2.width;
    }
    if (signHeight < 0) {
      layout2.y += layout2.height;
      layout2.height = -layout2.height;
    }
    return xClipped || yClipped;
  },
  polar: function(coordSysClipArea, layout2) {
    var signR = layout2.r0 <= layout2.r ? 1 : -1;
    if (signR < 0) {
      var tmp = layout2.r;
      layout2.r = layout2.r0;
      layout2.r0 = tmp;
    }
    var r = mathMin(layout2.r, coordSysClipArea.r);
    var r0 = mathMax(layout2.r0, coordSysClipArea.r0);
    layout2.r = r;
    layout2.r0 = r0;
    var clipped = r - r0 < 0;
    if (signR < 0) {
      var tmp = layout2.r;
      layout2.r = layout2.r0;
      layout2.r0 = tmp;
    }
    return clipped;
  }
};
var elementCreator = {
  cartesian2d: function(seriesModel, data, newIndex, layout2, isHorizontal, animationModel, axisModel, isUpdate, roundCap) {
    var rect = new Rect({
      shape: extend({}, layout2),
      z2: 1
    });
    rect.__dataIndex = newIndex;
    rect.name = "item";
    if (animationModel) {
      var rectShape = rect.shape;
      var animateProperty = isHorizontal ? "height" : "width";
      rectShape[animateProperty] = 0;
    }
    return rect;
  },
  polar: function(seriesModel, data, newIndex, layout2, isRadial, animationModel, axisModel, isUpdate, roundCap) {
    var ShapeClass = !isRadial && roundCap ? SausagePath : Sector;
    var sector = new ShapeClass({
      shape: layout2,
      z2: 1
    });
    sector.name = "item";
    var positionMap = createPolarPositionMapping(isRadial);
    sector.calculateTextPosition = createSectorCalculateTextPosition(positionMap, {
      isRoundCap: ShapeClass === SausagePath
    });
    if (animationModel) {
      var sectorShape = sector.shape;
      var animateProperty = isRadial ? "r" : "endAngle";
      var animateTarget = {};
      sectorShape[animateProperty] = isRadial ? layout2.r0 : layout2.startAngle;
      animateTarget[animateProperty] = layout2[animateProperty];
      (isUpdate ? updateProps : initProps)(sector, {
        shape: animateTarget
        // __value: typeof dataValue === 'string' ? parseInt(dataValue, 10) : dataValue
      }, animationModel);
    }
    return sector;
  }
};
function shouldRealtimeSort(seriesModel, coordSys) {
  var realtimeSortOption = seriesModel.get("realtimeSort", true);
  var baseAxis = coordSys.getBaseAxis();
  if (process.env.NODE_ENV !== "production") {
    if (realtimeSortOption) {
      if (baseAxis.type !== "category") {
        warn("`realtimeSort` will not work because this bar series is not based on a category axis.");
      }
      if (coordSys.type !== "cartesian2d") {
        warn("`realtimeSort` will not work because this bar series is not on cartesian2d.");
      }
    }
  }
  if (realtimeSortOption && baseAxis.type === "category" && coordSys.type === "cartesian2d") {
    return {
      baseAxis,
      otherAxis: coordSys.getOtherAxis(baseAxis)
    };
  }
}
function updateRealtimeAnimation(realtimeSortCfg, seriesAnimationModel, el, layout2, newIndex, isHorizontal, isUpdate, isChangeOrder) {
  var seriesTarget;
  var axisTarget;
  if (isHorizontal) {
    axisTarget = {
      x: layout2.x,
      width: layout2.width
    };
    seriesTarget = {
      y: layout2.y,
      height: layout2.height
    };
  } else {
    axisTarget = {
      y: layout2.y,
      height: layout2.height
    };
    seriesTarget = {
      x: layout2.x,
      width: layout2.width
    };
  }
  if (!isChangeOrder) {
    (isUpdate ? updateProps : initProps)(el, {
      shape: seriesTarget
    }, seriesAnimationModel, newIndex, null);
  }
  var axisAnimationModel = seriesAnimationModel ? realtimeSortCfg.baseAxis.model : null;
  (isUpdate ? updateProps : initProps)(el, {
    shape: axisTarget
  }, axisAnimationModel, newIndex);
}
function checkPropertiesNotValid(obj, props) {
  for (var i = 0; i < props.length; i++) {
    if (!isFinite(obj[props[i]])) {
      return true;
    }
  }
  return false;
}
var rectPropties = ["x", "y", "width", "height"];
var polarPropties = ["cx", "cy", "r", "startAngle", "endAngle"];
var isValidLayout = {
  cartesian2d: function(layout2) {
    return !checkPropertiesNotValid(layout2, rectPropties);
  },
  polar: function(layout2) {
    return !checkPropertiesNotValid(layout2, polarPropties);
  }
};
var getLayout = {
  // itemModel is only used to get borderWidth, which is not needed
  // when calculating bar background layout.
  cartesian2d: function(data, dataIndex, itemModel) {
    var layout2 = data.getItemLayout(dataIndex);
    var fixedLineWidth = itemModel ? getLineWidth(itemModel, layout2) : 0;
    var signX = layout2.width > 0 ? 1 : -1;
    var signY = layout2.height > 0 ? 1 : -1;
    return {
      x: layout2.x + signX * fixedLineWidth / 2,
      y: layout2.y + signY * fixedLineWidth / 2,
      width: layout2.width - signX * fixedLineWidth,
      height: layout2.height - signY * fixedLineWidth
    };
  },
  polar: function(data, dataIndex, itemModel) {
    var layout2 = data.getItemLayout(dataIndex);
    return {
      cx: layout2.cx,
      cy: layout2.cy,
      r0: layout2.r0,
      r: layout2.r,
      startAngle: layout2.startAngle,
      endAngle: layout2.endAngle,
      clockwise: layout2.clockwise
    };
  }
};
function isZeroOnPolar(layout2) {
  return layout2.startAngle != null && layout2.endAngle != null && layout2.startAngle === layout2.endAngle;
}
function createPolarPositionMapping(isRadial) {
  return /* @__PURE__ */ function(isRadial2) {
    var arcOrAngle = isRadial2 ? "Arc" : "Angle";
    return function(position) {
      switch (position) {
        case "start":
        case "insideStart":
        case "end":
        case "insideEnd":
          return position + arcOrAngle;
        default:
          return position;
      }
    };
  }(isRadial);
}
function updateStyle(el, data, dataIndex, itemModel, layout2, seriesModel, isHorizontalOrRadial, isPolar) {
  var style = data.getItemVisual(dataIndex, "style");
  if (!isPolar) {
    var borderRadius = itemModel.get(["itemStyle", "borderRadius"]) || 0;
    el.setShape("r", borderRadius);
  } else if (!seriesModel.get("roundCap")) {
    var sectorShape = el.shape;
    var cornerRadius = getSectorCornerRadius(itemModel.getModel("itemStyle"), sectorShape);
    extend(sectorShape, cornerRadius);
    el.setShape(sectorShape);
  }
  el.useStyle(style);
  var cursorStyle = itemModel.getShallow("cursor");
  cursorStyle && el.attr("cursor", cursorStyle);
  var labelPositionOutside = isPolar ? isHorizontalOrRadial ? layout2.r >= layout2.r0 ? "endArc" : "startArc" : layout2.endAngle >= layout2.startAngle ? "endAngle" : "startAngle" : isHorizontalOrRadial ? layout2.height >= 0 ? "bottom" : "top" : layout2.width >= 0 ? "right" : "left";
  var labelStatesModels = getLabelStatesModels(itemModel);
  setLabelStyle(el, labelStatesModels, {
    labelFetcher: seriesModel,
    labelDataIndex: dataIndex,
    defaultText: getDefaultLabel(seriesModel.getData(), dataIndex),
    inheritColor: style.fill,
    defaultOpacity: style.opacity,
    defaultOutsidePosition: labelPositionOutside
  });
  var label = el.getTextContent();
  if (isPolar && label) {
    var position = itemModel.get(["label", "position"]);
    el.textConfig.inside = position === "middle" ? true : null;
    setSectorTextRotation(el, position === "outside" ? labelPositionOutside : position, createPolarPositionMapping(isHorizontalOrRadial), itemModel.get(["label", "rotate"]));
  }
  setLabelValueAnimation(label, labelStatesModels, seriesModel.getRawValue(dataIndex), function(value) {
    return getDefaultInterpolatedLabel(data, value);
  });
  var emphasisModel = itemModel.getModel(["emphasis"]);
  toggleHoverEmphasis(el, emphasisModel.get("focus"), emphasisModel.get("blurScope"), emphasisModel.get("disabled"));
  setStatesStylesFromModel(el, itemModel);
  if (isZeroOnPolar(layout2)) {
    el.style.fill = "none";
    el.style.stroke = "none";
    each(el.states, function(state) {
      if (state.style) {
        state.style.fill = state.style.stroke = "none";
      }
    });
  }
}
function getLineWidth(itemModel, rawLayout) {
  var borderColor = itemModel.get(["itemStyle", "borderColor"]);
  if (!borderColor || borderColor === "none") {
    return 0;
  }
  var lineWidth = itemModel.get(["itemStyle", "borderWidth"]) || 0;
  var width = isNaN(rawLayout.width) ? Number.MAX_VALUE : Math.abs(rawLayout.width);
  var height = isNaN(rawLayout.height) ? Number.MAX_VALUE : Math.abs(rawLayout.height);
  return Math.min(lineWidth, width, height);
}
var LagePathShape = (
  /** @class */
  /* @__PURE__ */ function() {
    function LagePathShape2() {
    }
    return LagePathShape2;
  }()
);
var LargePath = (
  /** @class */
  function(_super) {
    __extends(LargePath2, _super);
    function LargePath2(opts) {
      var _this = _super.call(this, opts) || this;
      _this.type = "largeBar";
      return _this;
    }
    LargePath2.prototype.getDefaultShape = function() {
      return new LagePathShape();
    };
    LargePath2.prototype.buildPath = function(ctx, shape) {
      var points = shape.points;
      var baseDimIdx = this.baseDimIdx;
      var valueDimIdx = 1 - this.baseDimIdx;
      var startPoint = [];
      var size = [];
      var barWidth = this.barWidth;
      for (var i = 0; i < points.length; i += 3) {
        size[baseDimIdx] = barWidth;
        size[valueDimIdx] = points[i + 2];
        startPoint[baseDimIdx] = points[i + baseDimIdx];
        startPoint[valueDimIdx] = points[i + valueDimIdx];
        ctx.rect(startPoint[0], startPoint[1], size[0], size[1]);
      }
    };
    return LargePath2;
  }(Path)
);
function createLarge(seriesModel, group, progressiveEls, incremental) {
  var data = seriesModel.getData();
  var baseDimIdx = data.getLayout("valueAxisHorizontal") ? 1 : 0;
  var largeDataIndices = data.getLayout("largeDataIndices");
  var barWidth = data.getLayout("size");
  var backgroundModel = seriesModel.getModel("backgroundStyle");
  var bgPoints = data.getLayout("largeBackgroundPoints");
  if (bgPoints) {
    var bgEl = new LargePath({
      shape: {
        points: bgPoints
      },
      incremental: !!incremental,
      silent: true,
      z2: 0
    });
    bgEl.baseDimIdx = baseDimIdx;
    bgEl.largeDataIndices = largeDataIndices;
    bgEl.barWidth = barWidth;
    bgEl.useStyle(backgroundModel.getItemStyle());
    group.add(bgEl);
    progressiveEls && progressiveEls.push(bgEl);
  }
  var el = new LargePath({
    shape: {
      points: data.getLayout("largePoints")
    },
    incremental: !!incremental,
    ignoreCoarsePointer: true,
    z2: 1
  });
  el.baseDimIdx = baseDimIdx;
  el.largeDataIndices = largeDataIndices;
  el.barWidth = barWidth;
  group.add(el);
  el.useStyle(data.getVisual("style"));
  el.style.stroke = null;
  getECData(el).seriesIndex = seriesModel.seriesIndex;
  if (!seriesModel.get("silent")) {
    el.on("mousedown", largePathUpdateDataIndex);
    el.on("mousemove", largePathUpdateDataIndex);
  }
  progressiveEls && progressiveEls.push(el);
}
var largePathUpdateDataIndex = throttle(function(event) {
  var largePath = this;
  var dataIndex = largePathFindDataIndex(largePath, event.offsetX, event.offsetY);
  getECData(largePath).dataIndex = dataIndex >= 0 ? dataIndex : null;
}, 30, false);
function largePathFindDataIndex(largePath, x, y) {
  var baseDimIdx = largePath.baseDimIdx;
  var valueDimIdx = 1 - baseDimIdx;
  var points = largePath.shape.points;
  var largeDataIndices = largePath.largeDataIndices;
  var startPoint = [];
  var size = [];
  var barWidth = largePath.barWidth;
  for (var i = 0, len = points.length / 3; i < len; i++) {
    var ii = i * 3;
    size[baseDimIdx] = barWidth;
    size[valueDimIdx] = points[ii + 2];
    startPoint[baseDimIdx] = points[ii + baseDimIdx];
    startPoint[valueDimIdx] = points[ii + valueDimIdx];
    if (size[valueDimIdx] < 0) {
      startPoint[valueDimIdx] += size[valueDimIdx];
      size[valueDimIdx] = -size[valueDimIdx];
    }
    if (x >= startPoint[0] && x <= startPoint[0] + size[0] && y >= startPoint[1] && y <= startPoint[1] + size[1]) {
      return largeDataIndices[i];
    }
  }
  return -1;
}
function createBackgroundShape(isHorizontalOrRadial, layout2, coord) {
  if (isCoordinateSystemType(coord, "cartesian2d")) {
    var rectShape = layout2;
    var coordLayout = coord.getArea();
    return {
      x: isHorizontalOrRadial ? rectShape.x : coordLayout.x,
      y: isHorizontalOrRadial ? coordLayout.y : rectShape.y,
      width: isHorizontalOrRadial ? rectShape.width : coordLayout.width,
      height: isHorizontalOrRadial ? coordLayout.height : rectShape.height
    };
  } else {
    var coordLayout = coord.getArea();
    var sectorShape = layout2;
    return {
      cx: coordLayout.cx,
      cy: coordLayout.cy,
      r0: isHorizontalOrRadial ? coordLayout.r0 : sectorShape.r0,
      r: isHorizontalOrRadial ? coordLayout.r : sectorShape.r,
      startAngle: isHorizontalOrRadial ? sectorShape.startAngle : 0,
      endAngle: isHorizontalOrRadial ? sectorShape.endAngle : Math.PI * 2
    };
  }
}
function createBackgroundEl(coord, isHorizontalOrRadial, layout2) {
  var ElementClz = coord.type === "polar" ? Sector : Rect;
  return new ElementClz({
    shape: createBackgroundShape(isHorizontalOrRadial, layout2, coord),
    silent: true,
    z2: 0
  });
}
function install(registers) {
  registers.registerChartView(BarView);
  registers.registerSeriesModel(BarSeriesModel);
  registers.registerLayout(registers.PRIORITY.VISUAL.LAYOUT, curry(layout, "bar"));
  registers.registerLayout(registers.PRIORITY.VISUAL.PROGRESSIVE_LAYOUT, createProgressiveLayout("bar"));
  registers.registerProcessor(registers.PRIORITY.PROCESSOR.STATISTIC, dataSample("bar"));
  registers.registerAction({
    type: "changeAxisOrder",
    event: "changeAxisOrder",
    update: "update"
  }, function(payload, ecModel) {
    var componentType = payload.componentType || "series";
    ecModel.eachComponent({
      mainType: componentType,
      query: payload
    }, function(componentModel) {
      if (payload.sortInfo) {
        componentModel.axis.setCategorySortInfo(payload.sortInfo);
      }
    });
  });
}
export {
  install as BarChart,
  install$1 as LineChart
};
