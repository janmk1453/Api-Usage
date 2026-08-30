import { M as createHashMap, e as each, N as assert, g as map$1, o as extend, F as isNumber, O as isArrayLike, r as isArray, j as bind, Q as keys, s as isFunction, R as slice, u as isString, t as isObject$1, k as clone, n as defaults, S as retrieve, l as curry } from "./Image-DY6RhQFr.js";
import { aI as VISUAL_DIMENSIONS, aJ as isSourceInstance, aK as DefaultDataProvider, aL as DataStore, aM as SOURCE_FORMAT_TYPED_ARRAY, aN as isDataItemOption, aO as convertOptionIdName, M as Model, aP as setCommonECData, aQ as isSeriesDataSchema, aR as SOURCE_FORMAT_ORIGINAL, aS as createSourceFromSeriesDataOption, aT as shouldOmitUnusedDimensions, aU as ensureSourceDimNameMap, aV as createDimNameMap, aW as CtorInt32Array$1, aX as normalizeToArray, aY as guessOrdinal, aZ as BE_ORDINAL, a_ as SeriesDataSchema, a$ as SINGLE_REFERRING, b0 as makeSeriesEncodeForAxisCoordSys, e as enableDataStack, b1 as CoordinateSystemManager, b2 as getDataItemValue } from "./barGrid-B8918HIn.js";
function dataIndexMapValueLength(valNumOrArrLengthMoreThan2) {
  return valNumOrArrLengthMoreThan2 == null ? 0 : valNumOrArrLengthMoreThan2.length || 1;
}
function defaultKeyGetter(item) {
  return item;
}
var DataDiffer = (
  /** @class */
  function() {
    function DataDiffer2(oldArr, newArr, oldKeyGetter, newKeyGetter, context, diffMode) {
      this._old = oldArr;
      this._new = newArr;
      this._oldKeyGetter = oldKeyGetter || defaultKeyGetter;
      this._newKeyGetter = newKeyGetter || defaultKeyGetter;
      this.context = context;
      this._diffModeMultiple = diffMode === "multiple";
    }
    DataDiffer2.prototype.add = function(func) {
      this._add = func;
      return this;
    };
    DataDiffer2.prototype.update = function(func) {
      this._update = func;
      return this;
    };
    DataDiffer2.prototype.updateManyToOne = function(func) {
      this._updateManyToOne = func;
      return this;
    };
    DataDiffer2.prototype.updateOneToMany = function(func) {
      this._updateOneToMany = func;
      return this;
    };
    DataDiffer2.prototype.updateManyToMany = function(func) {
      this._updateManyToMany = func;
      return this;
    };
    DataDiffer2.prototype.remove = function(func) {
      this._remove = func;
      return this;
    };
    DataDiffer2.prototype.execute = function() {
      this[this._diffModeMultiple ? "_executeMultiple" : "_executeOneToOne"]();
    };
    DataDiffer2.prototype._executeOneToOne = function() {
      var oldArr = this._old;
      var newArr = this._new;
      var newDataIndexMap = {};
      var oldDataKeyArr = new Array(oldArr.length);
      var newDataKeyArr = new Array(newArr.length);
      this._initIndexMap(oldArr, null, oldDataKeyArr, "_oldKeyGetter");
      this._initIndexMap(newArr, newDataIndexMap, newDataKeyArr, "_newKeyGetter");
      for (var i = 0; i < oldArr.length; i++) {
        var oldKey = oldDataKeyArr[i];
        var newIdxMapVal = newDataIndexMap[oldKey];
        var newIdxMapValLen = dataIndexMapValueLength(newIdxMapVal);
        if (newIdxMapValLen > 1) {
          var newIdx = newIdxMapVal.shift();
          if (newIdxMapVal.length === 1) {
            newDataIndexMap[oldKey] = newIdxMapVal[0];
          }
          this._update && this._update(newIdx, i);
        } else if (newIdxMapValLen === 1) {
          newDataIndexMap[oldKey] = null;
          this._update && this._update(newIdxMapVal, i);
        } else {
          this._remove && this._remove(i);
        }
      }
      this._performRestAdd(newDataKeyArr, newDataIndexMap);
    };
    DataDiffer2.prototype._executeMultiple = function() {
      var oldArr = this._old;
      var newArr = this._new;
      var oldDataIndexMap = {};
      var newDataIndexMap = {};
      var oldDataKeyArr = [];
      var newDataKeyArr = [];
      this._initIndexMap(oldArr, oldDataIndexMap, oldDataKeyArr, "_oldKeyGetter");
      this._initIndexMap(newArr, newDataIndexMap, newDataKeyArr, "_newKeyGetter");
      for (var i = 0; i < oldDataKeyArr.length; i++) {
        var oldKey = oldDataKeyArr[i];
        var oldIdxMapVal = oldDataIndexMap[oldKey];
        var newIdxMapVal = newDataIndexMap[oldKey];
        var oldIdxMapValLen = dataIndexMapValueLength(oldIdxMapVal);
        var newIdxMapValLen = dataIndexMapValueLength(newIdxMapVal);
        if (oldIdxMapValLen > 1 && newIdxMapValLen === 1) {
          this._updateManyToOne && this._updateManyToOne(newIdxMapVal, oldIdxMapVal);
          newDataIndexMap[oldKey] = null;
        } else if (oldIdxMapValLen === 1 && newIdxMapValLen > 1) {
          this._updateOneToMany && this._updateOneToMany(newIdxMapVal, oldIdxMapVal);
          newDataIndexMap[oldKey] = null;
        } else if (oldIdxMapValLen === 1 && newIdxMapValLen === 1) {
          this._update && this._update(newIdxMapVal, oldIdxMapVal);
          newDataIndexMap[oldKey] = null;
        } else if (oldIdxMapValLen > 1 && newIdxMapValLen > 1) {
          this._updateManyToMany && this._updateManyToMany(newIdxMapVal, oldIdxMapVal);
          newDataIndexMap[oldKey] = null;
        } else if (oldIdxMapValLen > 1) {
          for (var i_1 = 0; i_1 < oldIdxMapValLen; i_1++) {
            this._remove && this._remove(oldIdxMapVal[i_1]);
          }
        } else {
          this._remove && this._remove(oldIdxMapVal);
        }
      }
      this._performRestAdd(newDataKeyArr, newDataIndexMap);
    };
    DataDiffer2.prototype._performRestAdd = function(newDataKeyArr, newDataIndexMap) {
      for (var i = 0; i < newDataKeyArr.length; i++) {
        var newKey = newDataKeyArr[i];
        var newIdxMapVal = newDataIndexMap[newKey];
        var idxMapValLen = dataIndexMapValueLength(newIdxMapVal);
        if (idxMapValLen > 1) {
          for (var j = 0; j < idxMapValLen; j++) {
            this._add && this._add(newIdxMapVal[j]);
          }
        } else if (idxMapValLen === 1) {
          this._add && this._add(newIdxMapVal);
        }
        newDataIndexMap[newKey] = null;
      }
    };
    DataDiffer2.prototype._initIndexMap = function(arr, map2, keyArr, keyGetterName) {
      var cbModeMultiple = this._diffModeMultiple;
      for (var i = 0; i < arr.length; i++) {
        var key = "_ec_" + this[keyGetterName](arr[i], i);
        if (!cbModeMultiple) {
          keyArr[i] = key;
        }
        if (!map2) {
          continue;
        }
        var idxMapVal = map2[key];
        var idxMapValLen = dataIndexMapValueLength(idxMapVal);
        if (idxMapValLen === 0) {
          map2[key] = i;
          if (cbModeMultiple) {
            keyArr.push(key);
          }
        } else if (idxMapValLen === 1) {
          map2[key] = [idxMapVal, i];
        } else {
          idxMapVal.push(i);
        }
      }
    };
    return DataDiffer2;
  }()
);
var DimensionUserOuput = (
  /** @class */
  function() {
    function DimensionUserOuput2(encode, dimRequest) {
      this._encode = encode;
      this._schema = dimRequest;
    }
    DimensionUserOuput2.prototype.get = function() {
      return {
        // Do not generate full dimension name until fist used.
        fullDimensions: this._getFullDimensionNames(),
        encode: this._encode
      };
    };
    DimensionUserOuput2.prototype._getFullDimensionNames = function() {
      if (!this._cachedDimNames) {
        this._cachedDimNames = this._schema ? this._schema.makeOutputDimensionNames() : [];
      }
      return this._cachedDimNames;
    };
    return DimensionUserOuput2;
  }()
);
function summarizeDimensions(data, schema) {
  var summary = {};
  var encode = summary.encode = {};
  var notExtraCoordDimMap = createHashMap();
  var defaultedLabel = [];
  var defaultedTooltip = [];
  var userOutputEncode = {};
  each(data.dimensions, function(dimName) {
    var dimItem = data.getDimensionInfo(dimName);
    var coordDim = dimItem.coordDim;
    if (coordDim) {
      if (process.env.NODE_ENV !== "production") {
        assert(VISUAL_DIMENSIONS.get(coordDim) == null);
      }
      var coordDimIndex = dimItem.coordDimIndex;
      getOrCreateEncodeArr(encode, coordDim)[coordDimIndex] = dimName;
      if (!dimItem.isExtraCoord) {
        notExtraCoordDimMap.set(coordDim, 1);
        if (mayLabelDimType(dimItem.type)) {
          defaultedLabel[0] = dimName;
        }
        getOrCreateEncodeArr(userOutputEncode, coordDim)[coordDimIndex] = data.getDimensionIndex(dimItem.name);
      }
      if (dimItem.defaultTooltip) {
        defaultedTooltip.push(dimName);
      }
    }
    VISUAL_DIMENSIONS.each(function(v, otherDim) {
      var encodeArr = getOrCreateEncodeArr(encode, otherDim);
      var dimIndex = dimItem.otherDims[otherDim];
      if (dimIndex != null && dimIndex !== false) {
        encodeArr[dimIndex] = dimItem.name;
      }
    });
  });
  var dataDimsOnCoord = [];
  var encodeFirstDimNotExtra = {};
  notExtraCoordDimMap.each(function(v, coordDim) {
    var dimArr = encode[coordDim];
    encodeFirstDimNotExtra[coordDim] = dimArr[0];
    dataDimsOnCoord = dataDimsOnCoord.concat(dimArr);
  });
  summary.dataDimsOnCoord = dataDimsOnCoord;
  summary.dataDimIndicesOnCoord = map$1(dataDimsOnCoord, function(dimName) {
    return data.getDimensionInfo(dimName).storeDimIndex;
  });
  summary.encodeFirstDimNotExtra = encodeFirstDimNotExtra;
  var encodeLabel = encode.label;
  if (encodeLabel && encodeLabel.length) {
    defaultedLabel = encodeLabel.slice();
  }
  var encodeTooltip = encode.tooltip;
  if (encodeTooltip && encodeTooltip.length) {
    defaultedTooltip = encodeTooltip.slice();
  } else if (!defaultedTooltip.length) {
    defaultedTooltip = defaultedLabel.slice();
  }
  encode.defaultedLabel = defaultedLabel;
  encode.defaultedTooltip = defaultedTooltip;
  summary.userOutput = new DimensionUserOuput(userOutputEncode, schema);
  return summary;
}
function getOrCreateEncodeArr(encode, dim) {
  if (!encode.hasOwnProperty(dim)) {
    encode[dim] = [];
  }
  return encode[dim];
}
function getDimensionTypeByAxis(axisType) {
  return axisType === "category" ? "ordinal" : axisType === "time" ? "time" : "float";
}
function mayLabelDimType(dimType) {
  return !(dimType === "ordinal" || dimType === "time");
}
var SeriesDimensionDefine = (
  /** @class */
  /* @__PURE__ */ function() {
    function SeriesDimensionDefine2(opt) {
      this.otherDims = {};
      if (opt != null) {
        extend(this, opt);
      }
    }
    return SeriesDimensionDefine2;
  }()
);
var isObject = isObject$1;
var map = map$1;
var CtorInt32Array = typeof Int32Array === "undefined" ? Array : Int32Array;
var ID_PREFIX = "e\0\0";
var INDEX_NOT_FOUND = -1;
var TRANSFERABLE_PROPERTIES = ["hasItemOption", "_nameList", "_idList", "_invertedIndicesMap", "_dimSummary", "userOutput", "_rawData", "_dimValueGetter", "_nameDimIdx", "_idDimIdx", "_nameRepeatCount"];
var CLONE_PROPERTIES = ["_approximateExtent"];
var prepareInvertedIndex;
var getId;
var getIdNameFromStore;
var normalizeDimensions;
var transferProperties;
var cloneListForMapAndSample;
var makeIdFromName;
var SeriesData = (
  /** @class */
  function() {
    function SeriesData2(dimensionsInput, hostModel) {
      this.type = "list";
      this._dimOmitted = false;
      this._nameList = [];
      this._idList = [];
      this._visual = {};
      this._layout = {};
      this._itemVisuals = [];
      this._itemLayouts = [];
      this._graphicEls = [];
      this._approximateExtent = {};
      this._calculationInfo = {};
      this.hasItemOption = false;
      this.TRANSFERABLE_METHODS = ["cloneShallow", "downSample", "minmaxDownSample", "lttbDownSample", "map"];
      this.CHANGABLE_METHODS = ["filterSelf", "selectRange"];
      this.DOWNSAMPLE_METHODS = ["downSample", "minmaxDownSample", "lttbDownSample"];
      var dimensions;
      var assignStoreDimIdx = false;
      if (isSeriesDataSchema(dimensionsInput)) {
        dimensions = dimensionsInput.dimensions;
        this._dimOmitted = dimensionsInput.isDimensionOmitted();
        this._schema = dimensionsInput;
      } else {
        assignStoreDimIdx = true;
        dimensions = dimensionsInput;
      }
      dimensions = dimensions || ["x", "y"];
      var dimensionInfos = {};
      var dimensionNames = [];
      var invertedIndicesMap = {};
      var needsHasOwn = false;
      var emptyObj = {};
      for (var i = 0; i < dimensions.length; i++) {
        var dimInfoInput = dimensions[i];
        var dimensionInfo = isString(dimInfoInput) ? new SeriesDimensionDefine({
          name: dimInfoInput
        }) : !(dimInfoInput instanceof SeriesDimensionDefine) ? new SeriesDimensionDefine(dimInfoInput) : dimInfoInput;
        var dimensionName = dimensionInfo.name;
        dimensionInfo.type = dimensionInfo.type || "float";
        if (!dimensionInfo.coordDim) {
          dimensionInfo.coordDim = dimensionName;
          dimensionInfo.coordDimIndex = 0;
        }
        var otherDims = dimensionInfo.otherDims = dimensionInfo.otherDims || {};
        dimensionNames.push(dimensionName);
        dimensionInfos[dimensionName] = dimensionInfo;
        if (emptyObj[dimensionName] != null) {
          needsHasOwn = true;
        }
        if (dimensionInfo.createInvertedIndices) {
          invertedIndicesMap[dimensionName] = [];
        }
        if (otherDims.itemName === 0) {
          this._nameDimIdx = i;
        }
        if (otherDims.itemId === 0) {
          this._idDimIdx = i;
        }
        if (process.env.NODE_ENV !== "production") {
          assert(assignStoreDimIdx || dimensionInfo.storeDimIndex >= 0);
        }
        if (assignStoreDimIdx) {
          dimensionInfo.storeDimIndex = i;
        }
      }
      this.dimensions = dimensionNames;
      this._dimInfos = dimensionInfos;
      this._initGetDimensionInfo(needsHasOwn);
      this.hostModel = hostModel;
      this._invertedIndicesMap = invertedIndicesMap;
      if (this._dimOmitted) {
        var dimIdxToName_1 = this._dimIdxToName = createHashMap();
        each(dimensionNames, function(dimName) {
          dimIdxToName_1.set(dimensionInfos[dimName].storeDimIndex, dimName);
        });
      }
    }
    SeriesData2.prototype.getDimension = function(dim) {
      var dimIdx = this._recognizeDimIndex(dim);
      if (dimIdx == null) {
        return dim;
      }
      dimIdx = dim;
      if (!this._dimOmitted) {
        return this.dimensions[dimIdx];
      }
      var dimName = this._dimIdxToName.get(dimIdx);
      if (dimName != null) {
        return dimName;
      }
      var sourceDimDef = this._schema.getSourceDimension(dimIdx);
      if (sourceDimDef) {
        return sourceDimDef.name;
      }
    };
    SeriesData2.prototype.getDimensionIndex = function(dim) {
      var dimIdx = this._recognizeDimIndex(dim);
      if (dimIdx != null) {
        return dimIdx;
      }
      if (dim == null) {
        return -1;
      }
      var dimInfo = this._getDimInfo(dim);
      return dimInfo ? dimInfo.storeDimIndex : this._dimOmitted ? this._schema.getSourceDimensionIndex(dim) : -1;
    };
    SeriesData2.prototype._recognizeDimIndex = function(dim) {
      if (isNumber(dim) || dim != null && !isNaN(dim) && !this._getDimInfo(dim) && (!this._dimOmitted || this._schema.getSourceDimensionIndex(dim) < 0)) {
        return +dim;
      }
    };
    SeriesData2.prototype._getStoreDimIndex = function(dim) {
      var dimIdx = this.getDimensionIndex(dim);
      if (process.env.NODE_ENV !== "production") {
        if (dimIdx == null) {
          throw new Error("Unknown dimension " + dim);
        }
      }
      return dimIdx;
    };
    SeriesData2.prototype.getDimensionInfo = function(dim) {
      return this._getDimInfo(this.getDimension(dim));
    };
    SeriesData2.prototype._initGetDimensionInfo = function(needsHasOwn) {
      var dimensionInfos = this._dimInfos;
      this._getDimInfo = needsHasOwn ? function(dimName) {
        return dimensionInfos.hasOwnProperty(dimName) ? dimensionInfos[dimName] : void 0;
      } : function(dimName) {
        return dimensionInfos[dimName];
      };
    };
    SeriesData2.prototype.getDimensionsOnCoord = function() {
      return this._dimSummary.dataDimsOnCoord.slice();
    };
    SeriesData2.prototype.mapDimension = function(coordDim, idx) {
      var dimensionsSummary = this._dimSummary;
      if (idx == null) {
        return dimensionsSummary.encodeFirstDimNotExtra[coordDim];
      }
      var dims = dimensionsSummary.encode[coordDim];
      return dims ? dims[idx] : null;
    };
    SeriesData2.prototype.mapDimensionsAll = function(coordDim) {
      var dimensionsSummary = this._dimSummary;
      var dims = dimensionsSummary.encode[coordDim];
      return (dims || []).slice();
    };
    SeriesData2.prototype.getStore = function() {
      return this._store;
    };
    SeriesData2.prototype.initData = function(data, nameList, dimValueGetter) {
      var _this = this;
      var store;
      if (data instanceof DataStore) {
        store = data;
      }
      if (!store) {
        var dimensions = this.dimensions;
        var provider = isSourceInstance(data) || isArrayLike(data) ? new DefaultDataProvider(data, dimensions.length) : data;
        store = new DataStore();
        var dimensionInfos = map(dimensions, function(dimName) {
          return {
            type: _this._dimInfos[dimName].type,
            property: dimName
          };
        });
        store.initData(provider, dimensionInfos, dimValueGetter);
      }
      this._store = store;
      this._nameList = (nameList || []).slice();
      this._idList = [];
      this._nameRepeatCount = {};
      this._doInit(0, store.count());
      this._dimSummary = summarizeDimensions(this, this._schema);
      this.userOutput = this._dimSummary.userOutput;
    };
    SeriesData2.prototype.appendData = function(data) {
      var range = this._store.appendData(data);
      this._doInit(range[0], range[1]);
    };
    SeriesData2.prototype.appendValues = function(values, names) {
      var _a = this._store.appendValues(values, names && names.length), start = _a.start, end = _a.end;
      var shouldMakeIdFromName = this._shouldMakeIdFromName();
      this._updateOrdinalMeta();
      if (names) {
        for (var idx = start; idx < end; idx++) {
          var sourceIdx = idx - start;
          this._nameList[idx] = names[sourceIdx];
          if (shouldMakeIdFromName) {
            makeIdFromName(this, idx);
          }
        }
      }
    };
    SeriesData2.prototype._updateOrdinalMeta = function() {
      var store = this._store;
      var dimensions = this.dimensions;
      for (var i = 0; i < dimensions.length; i++) {
        var dimInfo = this._dimInfos[dimensions[i]];
        if (dimInfo.ordinalMeta) {
          store.collectOrdinalMeta(dimInfo.storeDimIndex, dimInfo.ordinalMeta);
        }
      }
    };
    SeriesData2.prototype._shouldMakeIdFromName = function() {
      var provider = this._store.getProvider();
      return this._idDimIdx == null && provider.getSource().sourceFormat !== SOURCE_FORMAT_TYPED_ARRAY && !provider.fillStorage;
    };
    SeriesData2.prototype._doInit = function(start, end) {
      if (start >= end) {
        return;
      }
      var store = this._store;
      var provider = store.getProvider();
      this._updateOrdinalMeta();
      var nameList = this._nameList;
      var idList = this._idList;
      var sourceFormat = provider.getSource().sourceFormat;
      var isFormatOriginal = sourceFormat === SOURCE_FORMAT_ORIGINAL;
      if (isFormatOriginal && !provider.pure) {
        var sharedDataItem = [];
        for (var idx = start; idx < end; idx++) {
          var dataItem = provider.getItem(idx, sharedDataItem);
          if (!this.hasItemOption && isDataItemOption(dataItem)) {
            this.hasItemOption = true;
          }
          if (dataItem) {
            var itemName = dataItem.name;
            if (nameList[idx] == null && itemName != null) {
              nameList[idx] = convertOptionIdName(itemName, null);
            }
            var itemId = dataItem.id;
            if (idList[idx] == null && itemId != null) {
              idList[idx] = convertOptionIdName(itemId, null);
            }
          }
        }
      }
      if (this._shouldMakeIdFromName()) {
        for (var idx = start; idx < end; idx++) {
          makeIdFromName(this, idx);
        }
      }
      prepareInvertedIndex(this);
    };
    SeriesData2.prototype.getApproximateExtent = function(dim) {
      return this._approximateExtent[dim] || this._store.getDataExtent(this._getStoreDimIndex(dim));
    };
    SeriesData2.prototype.setApproximateExtent = function(extent, dim) {
      dim = this.getDimension(dim);
      this._approximateExtent[dim] = extent.slice();
    };
    SeriesData2.prototype.getCalculationInfo = function(key) {
      return this._calculationInfo[key];
    };
    SeriesData2.prototype.setCalculationInfo = function(key, value) {
      isObject(key) ? extend(this._calculationInfo, key) : this._calculationInfo[key] = value;
    };
    SeriesData2.prototype.getName = function(idx) {
      var rawIndex = this.getRawIndex(idx);
      var name = this._nameList[rawIndex];
      if (name == null && this._nameDimIdx != null) {
        name = getIdNameFromStore(this, this._nameDimIdx, rawIndex);
      }
      if (name == null) {
        name = "";
      }
      return name;
    };
    SeriesData2.prototype._getCategory = function(dimIdx, idx) {
      var ordinal = this._store.get(dimIdx, idx);
      var ordinalMeta = this._store.getOrdinalMeta(dimIdx);
      if (ordinalMeta) {
        return ordinalMeta.categories[ordinal];
      }
      return ordinal;
    };
    SeriesData2.prototype.getId = function(idx) {
      return getId(this, this.getRawIndex(idx));
    };
    SeriesData2.prototype.count = function() {
      return this._store.count();
    };
    SeriesData2.prototype.get = function(dim, idx) {
      var store = this._store;
      var dimInfo = this._dimInfos[dim];
      if (dimInfo) {
        return store.get(dimInfo.storeDimIndex, idx);
      }
    };
    SeriesData2.prototype.getByRawIndex = function(dim, rawIdx) {
      var store = this._store;
      var dimInfo = this._dimInfos[dim];
      if (dimInfo) {
        return store.getByRawIndex(dimInfo.storeDimIndex, rawIdx);
      }
    };
    SeriesData2.prototype.getIndices = function() {
      return this._store.getIndices();
    };
    SeriesData2.prototype.getDataExtent = function(dim) {
      return this._store.getDataExtent(this._getStoreDimIndex(dim));
    };
    SeriesData2.prototype.getSum = function(dim) {
      return this._store.getSum(this._getStoreDimIndex(dim));
    };
    SeriesData2.prototype.getMedian = function(dim) {
      return this._store.getMedian(this._getStoreDimIndex(dim));
    };
    SeriesData2.prototype.getValues = function(dimensions, idx) {
      var _this = this;
      var store = this._store;
      return isArray(dimensions) ? store.getValues(map(dimensions, function(dim) {
        return _this._getStoreDimIndex(dim);
      }), idx) : store.getValues(dimensions);
    };
    SeriesData2.prototype.hasValue = function(idx) {
      var dataDimIndicesOnCoord = this._dimSummary.dataDimIndicesOnCoord;
      for (var i = 0, len = dataDimIndicesOnCoord.length; i < len; i++) {
        if (isNaN(this._store.get(dataDimIndicesOnCoord[i], idx))) {
          return false;
        }
      }
      return true;
    };
    SeriesData2.prototype.indexOfName = function(name) {
      for (var i = 0, len = this._store.count(); i < len; i++) {
        if (this.getName(i) === name) {
          return i;
        }
      }
      return -1;
    };
    SeriesData2.prototype.getRawIndex = function(idx) {
      return this._store.getRawIndex(idx);
    };
    SeriesData2.prototype.indexOfRawIndex = function(rawIndex) {
      return this._store.indexOfRawIndex(rawIndex);
    };
    SeriesData2.prototype.rawIndexOf = function(dim, value) {
      var invertedIndices = dim && this._invertedIndicesMap[dim];
      if (process.env.NODE_ENV !== "production") {
        if (!invertedIndices) {
          throw new Error("Do not supported yet");
        }
      }
      var rawIndex = invertedIndices && invertedIndices[value];
      if (rawIndex == null || isNaN(rawIndex)) {
        return INDEX_NOT_FOUND;
      }
      return rawIndex;
    };
    SeriesData2.prototype.indicesOfNearest = function(dim, value, maxDistance) {
      return this._store.indicesOfNearest(this._getStoreDimIndex(dim), value, maxDistance);
    };
    SeriesData2.prototype.each = function(dims, cb, ctx) {
      if (isFunction(dims)) {
        ctx = cb;
        cb = dims;
        dims = [];
      }
      var fCtx = ctx || this;
      var dimIndices = map(normalizeDimensions(dims), this._getStoreDimIndex, this);
      this._store.each(dimIndices, fCtx ? bind(cb, fCtx) : cb);
    };
    SeriesData2.prototype.filterSelf = function(dims, cb, ctx) {
      if (isFunction(dims)) {
        ctx = cb;
        cb = dims;
        dims = [];
      }
      var fCtx = ctx || this;
      var dimIndices = map(normalizeDimensions(dims), this._getStoreDimIndex, this);
      this._store = this._store.filter(dimIndices, fCtx ? bind(cb, fCtx) : cb);
      return this;
    };
    SeriesData2.prototype.selectRange = function(range) {
      var _this = this;
      var innerRange = {};
      var dims = keys(range);
      each(dims, function(dim) {
        var dimIdx = _this._getStoreDimIndex(dim);
        innerRange[dimIdx] = range[dim];
      });
      this._store = this._store.selectRange(innerRange);
      return this;
    };
    SeriesData2.prototype.mapArray = function(dims, cb, ctx) {
      if (isFunction(dims)) {
        ctx = cb;
        cb = dims;
        dims = [];
      }
      ctx = ctx || this;
      var result = [];
      this.each(dims, function() {
        result.push(cb && cb.apply(this, arguments));
      }, ctx);
      return result;
    };
    SeriesData2.prototype.map = function(dims, cb, ctx, ctxCompat) {
      var fCtx = ctx || ctxCompat || this;
      var dimIndices = map(normalizeDimensions(dims), this._getStoreDimIndex, this);
      var list = cloneListForMapAndSample(this);
      list._store = this._store.map(dimIndices, fCtx ? bind(cb, fCtx) : cb);
      return list;
    };
    SeriesData2.prototype.modify = function(dims, cb, ctx, ctxCompat) {
      var _this = this;
      var fCtx = ctx || ctxCompat || this;
      if (process.env.NODE_ENV !== "production") {
        each(normalizeDimensions(dims), function(dim) {
          var dimInfo = _this.getDimensionInfo(dim);
          if (!dimInfo.isCalculationCoord) {
            console.error("Danger: only stack dimension can be modified");
          }
        });
      }
      var dimIndices = map(normalizeDimensions(dims), this._getStoreDimIndex, this);
      this._store.modify(dimIndices, fCtx ? bind(cb, fCtx) : cb);
    };
    SeriesData2.prototype.downSample = function(dimension, rate, sampleValue, sampleIndex) {
      var list = cloneListForMapAndSample(this);
      list._store = this._store.downSample(this._getStoreDimIndex(dimension), rate, sampleValue, sampleIndex);
      return list;
    };
    SeriesData2.prototype.minmaxDownSample = function(valueDimension, rate) {
      var list = cloneListForMapAndSample(this);
      list._store = this._store.minmaxDownSample(this._getStoreDimIndex(valueDimension), rate);
      return list;
    };
    SeriesData2.prototype.lttbDownSample = function(valueDimension, rate) {
      var list = cloneListForMapAndSample(this);
      list._store = this._store.lttbDownSample(this._getStoreDimIndex(valueDimension), rate);
      return list;
    };
    SeriesData2.prototype.getRawDataItem = function(idx) {
      return this._store.getRawDataItem(idx);
    };
    SeriesData2.prototype.getItemModel = function(idx) {
      var hostModel = this.hostModel;
      var dataItem = this.getRawDataItem(idx);
      return new Model(dataItem, hostModel, hostModel && hostModel.ecModel);
    };
    SeriesData2.prototype.diff = function(otherList) {
      var thisList = this;
      return new DataDiffer(otherList ? otherList.getStore().getIndices() : [], this.getStore().getIndices(), function(idx) {
        return getId(otherList, idx);
      }, function(idx) {
        return getId(thisList, idx);
      });
    };
    SeriesData2.prototype.getVisual = function(key) {
      var visual = this._visual;
      return visual && visual[key];
    };
    SeriesData2.prototype.setVisual = function(kvObj, val) {
      this._visual = this._visual || {};
      if (isObject(kvObj)) {
        extend(this._visual, kvObj);
      } else {
        this._visual[kvObj] = val;
      }
    };
    SeriesData2.prototype.getItemVisual = function(idx, key) {
      var itemVisual = this._itemVisuals[idx];
      var val = itemVisual && itemVisual[key];
      if (val == null) {
        return this.getVisual(key);
      }
      return val;
    };
    SeriesData2.prototype.hasItemVisual = function() {
      return this._itemVisuals.length > 0;
    };
    SeriesData2.prototype.ensureUniqueItemVisual = function(idx, key) {
      var itemVisuals = this._itemVisuals;
      var itemVisual = itemVisuals[idx];
      if (!itemVisual) {
        itemVisual = itemVisuals[idx] = {};
      }
      var val = itemVisual[key];
      if (val == null) {
        val = this.getVisual(key);
        if (isArray(val)) {
          val = val.slice();
        } else if (isObject(val)) {
          val = extend({}, val);
        }
        itemVisual[key] = val;
      }
      return val;
    };
    SeriesData2.prototype.setItemVisual = function(idx, key, value) {
      var itemVisual = this._itemVisuals[idx] || {};
      this._itemVisuals[idx] = itemVisual;
      if (isObject(key)) {
        extend(itemVisual, key);
      } else {
        itemVisual[key] = value;
      }
    };
    SeriesData2.prototype.clearAllVisual = function() {
      this._visual = {};
      this._itemVisuals = [];
    };
    SeriesData2.prototype.setLayout = function(key, val) {
      isObject(key) ? extend(this._layout, key) : this._layout[key] = val;
    };
    SeriesData2.prototype.getLayout = function(key) {
      return this._layout[key];
    };
    SeriesData2.prototype.getItemLayout = function(idx) {
      return this._itemLayouts[idx];
    };
    SeriesData2.prototype.setItemLayout = function(idx, layout, merge) {
      this._itemLayouts[idx] = merge ? extend(this._itemLayouts[idx] || {}, layout) : layout;
    };
    SeriesData2.prototype.clearItemLayouts = function() {
      this._itemLayouts.length = 0;
    };
    SeriesData2.prototype.setItemGraphicEl = function(idx, el) {
      var seriesIndex = this.hostModel && this.hostModel.seriesIndex;
      setCommonECData(seriesIndex, this.dataType, idx, el);
      this._graphicEls[idx] = el;
    };
    SeriesData2.prototype.getItemGraphicEl = function(idx) {
      return this._graphicEls[idx];
    };
    SeriesData2.prototype.eachItemGraphicEl = function(cb, context) {
      each(this._graphicEls, function(el, idx) {
        if (el) {
          cb && cb.call(context, el, idx);
        }
      });
    };
    SeriesData2.prototype.cloneShallow = function(list) {
      if (!list) {
        list = new SeriesData2(this._schema ? this._schema : map(this.dimensions, this._getDimInfo, this), this.hostModel);
      }
      transferProperties(list, this);
      list._store = this._store;
      return list;
    };
    SeriesData2.prototype.wrapMethod = function(methodName, injectFunction) {
      var originalMethod = this[methodName];
      if (!isFunction(originalMethod)) {
        return;
      }
      this.__wrappedMethods = this.__wrappedMethods || [];
      this.__wrappedMethods.push(methodName);
      this[methodName] = function() {
        var res = originalMethod.apply(this, arguments);
        return injectFunction.apply(this, [res].concat(slice(arguments)));
      };
    };
    SeriesData2.internalField = function() {
      prepareInvertedIndex = function(data) {
        var invertedIndicesMap = data._invertedIndicesMap;
        each(invertedIndicesMap, function(invertedIndices, dim) {
          var dimInfo = data._dimInfos[dim];
          var ordinalMeta = dimInfo.ordinalMeta;
          var store = data._store;
          if (ordinalMeta) {
            invertedIndices = invertedIndicesMap[dim] = new CtorInt32Array(ordinalMeta.categories.length);
            for (var i = 0; i < invertedIndices.length; i++) {
              invertedIndices[i] = INDEX_NOT_FOUND;
            }
            for (var i = 0; i < store.count(); i++) {
              invertedIndices[store.get(dimInfo.storeDimIndex, i)] = i;
            }
          }
        });
      };
      getIdNameFromStore = function(data, dimIdx, idx) {
        return convertOptionIdName(data._getCategory(dimIdx, idx), null);
      };
      getId = function(data, rawIndex) {
        var id = data._idList[rawIndex];
        if (id == null && data._idDimIdx != null) {
          id = getIdNameFromStore(data, data._idDimIdx, rawIndex);
        }
        if (id == null) {
          id = ID_PREFIX + rawIndex;
        }
        return id;
      };
      normalizeDimensions = function(dimensions) {
        if (!isArray(dimensions)) {
          dimensions = dimensions != null ? [dimensions] : [];
        }
        return dimensions;
      };
      cloneListForMapAndSample = function(original) {
        var list = new SeriesData2(original._schema ? original._schema : map(original.dimensions, original._getDimInfo, original), original.hostModel);
        transferProperties(list, original);
        return list;
      };
      transferProperties = function(target, source) {
        each(TRANSFERABLE_PROPERTIES.concat(source.__wrappedMethods || []), function(propName) {
          if (source.hasOwnProperty(propName)) {
            target[propName] = source[propName];
          }
        });
        target.__wrappedMethods = source.__wrappedMethods;
        each(CLONE_PROPERTIES, function(propName) {
          target[propName] = clone(source[propName]);
        });
        target._calculationInfo = extend({}, source._calculationInfo);
      };
      makeIdFromName = function(data, idx) {
        var nameList = data._nameList;
        var idList = data._idList;
        var nameDimIdx = data._nameDimIdx;
        var idDimIdx = data._idDimIdx;
        var name = nameList[idx];
        var id = idList[idx];
        if (name == null && nameDimIdx != null) {
          nameList[idx] = name = getIdNameFromStore(data, nameDimIdx, idx);
        }
        if (id == null && idDimIdx != null) {
          idList[idx] = id = getIdNameFromStore(data, idDimIdx, idx);
        }
        if (id == null && name != null) {
          var nameRepeatCount = data._nameRepeatCount;
          var nmCnt = nameRepeatCount[name] = (nameRepeatCount[name] || 0) + 1;
          id = name;
          if (nmCnt > 1) {
            id += "__ec__" + nmCnt;
          }
          idList[idx] = id;
        }
      };
    }();
    return SeriesData2;
  }()
);
function createDimensions(source, opt) {
  return prepareSeriesDataSchema(source, opt).dimensions;
}
function prepareSeriesDataSchema(source, opt) {
  if (!isSourceInstance(source)) {
    source = createSourceFromSeriesDataOption(source);
  }
  opt = opt || {};
  var sysDims = opt.coordDimensions || [];
  var dimsDef = opt.dimensionsDefine || source.dimensionsDefine || [];
  var coordDimNameMap = createHashMap();
  var resultList = [];
  var dimCount = getDimCount(source, sysDims, dimsDef, opt.dimensionsCount);
  var omitUnusedDimensions = opt.canOmitUnusedDimensions && shouldOmitUnusedDimensions(dimCount);
  var isUsingSourceDimensionsDef = dimsDef === source.dimensionsDefine;
  var dataDimNameMap = isUsingSourceDimensionsDef ? ensureSourceDimNameMap(source) : createDimNameMap(dimsDef);
  var encodeDef = opt.encodeDefine;
  if (!encodeDef && opt.encodeDefaulter) {
    encodeDef = opt.encodeDefaulter(source, dimCount);
  }
  var encodeDefMap = createHashMap(encodeDef);
  var indicesMap = new CtorInt32Array$1(dimCount);
  for (var i = 0; i < indicesMap.length; i++) {
    indicesMap[i] = -1;
  }
  function getResultItem(dimIdx) {
    var idx = indicesMap[dimIdx];
    if (idx < 0) {
      var dimDefItemRaw = dimsDef[dimIdx];
      var dimDefItem = isObject$1(dimDefItemRaw) ? dimDefItemRaw : {
        name: dimDefItemRaw
      };
      var resultItem2 = new SeriesDimensionDefine();
      var userDimName = dimDefItem.name;
      if (userDimName != null && dataDimNameMap.get(userDimName) != null) {
        resultItem2.name = resultItem2.displayName = userDimName;
      }
      dimDefItem.type != null && (resultItem2.type = dimDefItem.type);
      dimDefItem.displayName != null && (resultItem2.displayName = dimDefItem.displayName);
      var newIdx = resultList.length;
      indicesMap[dimIdx] = newIdx;
      resultItem2.storeDimIndex = dimIdx;
      resultList.push(resultItem2);
      return resultItem2;
    }
    return resultList[idx];
  }
  if (!omitUnusedDimensions) {
    for (var i = 0; i < dimCount; i++) {
      getResultItem(i);
    }
  }
  encodeDefMap.each(function(dataDimsRaw, coordDim2) {
    var dataDims = normalizeToArray(dataDimsRaw).slice();
    if (dataDims.length === 1 && !isString(dataDims[0]) && dataDims[0] < 0) {
      encodeDefMap.set(coordDim2, false);
      return;
    }
    var validDataDims = encodeDefMap.set(coordDim2, []);
    each(dataDims, function(resultDimIdxOrName, idx) {
      var resultDimIdx2 = isString(resultDimIdxOrName) ? dataDimNameMap.get(resultDimIdxOrName) : resultDimIdxOrName;
      if (resultDimIdx2 != null && resultDimIdx2 < dimCount) {
        validDataDims[idx] = resultDimIdx2;
        applyDim(getResultItem(resultDimIdx2), coordDim2, idx);
      }
    });
  });
  var availDimIdx = 0;
  each(sysDims, function(sysDimItemRaw) {
    var coordDim2;
    var sysDimItemDimsDef;
    var sysDimItemOtherDims;
    var sysDimItem;
    if (isString(sysDimItemRaw)) {
      coordDim2 = sysDimItemRaw;
      sysDimItem = {};
    } else {
      sysDimItem = sysDimItemRaw;
      coordDim2 = sysDimItem.name;
      var ordinalMeta = sysDimItem.ordinalMeta;
      sysDimItem.ordinalMeta = null;
      sysDimItem = extend({}, sysDimItem);
      sysDimItem.ordinalMeta = ordinalMeta;
      sysDimItemDimsDef = sysDimItem.dimsDef;
      sysDimItemOtherDims = sysDimItem.otherDims;
      sysDimItem.name = sysDimItem.coordDim = sysDimItem.coordDimIndex = sysDimItem.dimsDef = sysDimItem.otherDims = null;
    }
    var dataDims = encodeDefMap.get(coordDim2);
    if (dataDims === false) {
      return;
    }
    dataDims = normalizeToArray(dataDims);
    if (!dataDims.length) {
      for (var i2 = 0; i2 < (sysDimItemDimsDef && sysDimItemDimsDef.length || 1); i2++) {
        while (availDimIdx < dimCount && getResultItem(availDimIdx).coordDim != null) {
          availDimIdx++;
        }
        availDimIdx < dimCount && dataDims.push(availDimIdx++);
      }
    }
    each(dataDims, function(resultDimIdx2, coordDimIndex) {
      var resultItem2 = getResultItem(resultDimIdx2);
      if (isUsingSourceDimensionsDef && sysDimItem.type != null) {
        resultItem2.type = sysDimItem.type;
      }
      applyDim(defaults(resultItem2, sysDimItem), coordDim2, coordDimIndex);
      if (resultItem2.name == null && sysDimItemDimsDef) {
        var sysDimItemDimsDefItem = sysDimItemDimsDef[coordDimIndex];
        !isObject$1(sysDimItemDimsDefItem) && (sysDimItemDimsDefItem = {
          name: sysDimItemDimsDefItem
        });
        resultItem2.name = resultItem2.displayName = sysDimItemDimsDefItem.name;
        resultItem2.defaultTooltip = sysDimItemDimsDefItem.defaultTooltip;
      }
      sysDimItemOtherDims && defaults(resultItem2.otherDims, sysDimItemOtherDims);
    });
  });
  function applyDim(resultItem2, coordDim2, coordDimIndex) {
    if (VISUAL_DIMENSIONS.get(coordDim2) != null) {
      resultItem2.otherDims[coordDim2] = coordDimIndex;
    } else {
      resultItem2.coordDim = coordDim2;
      resultItem2.coordDimIndex = coordDimIndex;
      coordDimNameMap.set(coordDim2, true);
    }
  }
  var generateCoord = opt.generateCoord;
  var generateCoordCount = opt.generateCoordCount;
  var fromZero = generateCoordCount != null;
  generateCoordCount = generateCoord ? generateCoordCount || 1 : 0;
  var extra = generateCoord || "value";
  function ifNoNameFillWithCoordName(resultItem2) {
    if (resultItem2.name == null) {
      resultItem2.name = resultItem2.coordDim;
    }
  }
  if (!omitUnusedDimensions) {
    for (var resultDimIdx = 0; resultDimIdx < dimCount; resultDimIdx++) {
      var resultItem = getResultItem(resultDimIdx);
      var coordDim = resultItem.coordDim;
      if (coordDim == null) {
        resultItem.coordDim = genCoordDimName(extra, coordDimNameMap, fromZero);
        resultItem.coordDimIndex = 0;
        if (!generateCoord || generateCoordCount <= 0) {
          resultItem.isExtraCoord = true;
        }
        generateCoordCount--;
      }
      ifNoNameFillWithCoordName(resultItem);
      if (resultItem.type == null && (guessOrdinal(source, resultDimIdx) === BE_ORDINAL.Must || resultItem.isExtraCoord && (resultItem.otherDims.itemName != null || resultItem.otherDims.seriesName != null))) {
        resultItem.type = "ordinal";
      }
    }
  } else {
    each(resultList, function(resultItem2) {
      ifNoNameFillWithCoordName(resultItem2);
    });
    resultList.sort(function(item0, item1) {
      return item0.storeDimIndex - item1.storeDimIndex;
    });
  }
  removeDuplication(resultList);
  return new SeriesDataSchema({
    source,
    dimensions: resultList,
    fullDimensionCount: dimCount,
    dimensionOmitted: omitUnusedDimensions
  });
}
function removeDuplication(result) {
  var duplicationMap = createHashMap();
  for (var i = 0; i < result.length; i++) {
    var dim = result[i];
    var dimOriginalName = dim.name;
    var count = duplicationMap.get(dimOriginalName) || 0;
    if (count > 0) {
      dim.name = dimOriginalName + (count - 1);
    }
    count++;
    duplicationMap.set(dimOriginalName, count);
  }
}
function getDimCount(source, sysDims, dimsDef, optDimCount) {
  var dimCount = Math.max(source.dimensionsDetectedCount || 1, sysDims.length, dimsDef.length, optDimCount || 0);
  each(sysDims, function(sysDimItem) {
    var sysDimItemDimsDef;
    if (isObject$1(sysDimItem) && (sysDimItemDimsDef = sysDimItem.dimsDef)) {
      dimCount = Math.max(dimCount, sysDimItemDimsDef.length);
    }
  });
  return dimCount;
}
function genCoordDimName(name, map2, fromZero) {
  if (fromZero || map2.hasKey(name)) {
    var i = 0;
    while (map2.hasKey(name + i)) {
      i++;
    }
    name += i;
  }
  map2.set(name, true);
  return name;
}
var CoordSysInfo = (
  /** @class */
  /* @__PURE__ */ function() {
    function CoordSysInfo2(coordSysName) {
      this.coordSysDims = [];
      this.axisMap = createHashMap();
      this.categoryAxisMap = createHashMap();
      this.coordSysName = coordSysName;
    }
    return CoordSysInfo2;
  }()
);
function getCoordSysInfoBySeries(seriesModel) {
  var coordSysName = seriesModel.get("coordinateSystem");
  var result = new CoordSysInfo(coordSysName);
  var fetch = fetchers[coordSysName];
  if (fetch) {
    fetch(seriesModel, result, result.axisMap, result.categoryAxisMap);
    return result;
  }
}
var fetchers = {
  cartesian2d: function(seriesModel, result, axisMap, categoryAxisMap) {
    var xAxisModel = seriesModel.getReferringComponents("xAxis", SINGLE_REFERRING).models[0];
    var yAxisModel = seriesModel.getReferringComponents("yAxis", SINGLE_REFERRING).models[0];
    if (process.env.NODE_ENV !== "production") {
      if (!xAxisModel) {
        throw new Error('xAxis "' + retrieve(seriesModel.get("xAxisIndex"), seriesModel.get("xAxisId"), 0) + '" not found');
      }
      if (!yAxisModel) {
        throw new Error('yAxis "' + retrieve(seriesModel.get("xAxisIndex"), seriesModel.get("yAxisId"), 0) + '" not found');
      }
    }
    result.coordSysDims = ["x", "y"];
    axisMap.set("x", xAxisModel);
    axisMap.set("y", yAxisModel);
    if (isCategory(xAxisModel)) {
      categoryAxisMap.set("x", xAxisModel);
      result.firstCategoryDimIndex = 0;
    }
    if (isCategory(yAxisModel)) {
      categoryAxisMap.set("y", yAxisModel);
      result.firstCategoryDimIndex == null && (result.firstCategoryDimIndex = 1);
    }
  },
  singleAxis: function(seriesModel, result, axisMap, categoryAxisMap) {
    var singleAxisModel = seriesModel.getReferringComponents("singleAxis", SINGLE_REFERRING).models[0];
    if (process.env.NODE_ENV !== "production") {
      if (!singleAxisModel) {
        throw new Error("singleAxis should be specified.");
      }
    }
    result.coordSysDims = ["single"];
    axisMap.set("single", singleAxisModel);
    if (isCategory(singleAxisModel)) {
      categoryAxisMap.set("single", singleAxisModel);
      result.firstCategoryDimIndex = 0;
    }
  },
  polar: function(seriesModel, result, axisMap, categoryAxisMap) {
    var polarModel = seriesModel.getReferringComponents("polar", SINGLE_REFERRING).models[0];
    var radiusAxisModel = polarModel.findAxisModel("radiusAxis");
    var angleAxisModel = polarModel.findAxisModel("angleAxis");
    if (process.env.NODE_ENV !== "production") {
      if (!angleAxisModel) {
        throw new Error("angleAxis option not found");
      }
      if (!radiusAxisModel) {
        throw new Error("radiusAxis option not found");
      }
    }
    result.coordSysDims = ["radius", "angle"];
    axisMap.set("radius", radiusAxisModel);
    axisMap.set("angle", angleAxisModel);
    if (isCategory(radiusAxisModel)) {
      categoryAxisMap.set("radius", radiusAxisModel);
      result.firstCategoryDimIndex = 0;
    }
    if (isCategory(angleAxisModel)) {
      categoryAxisMap.set("angle", angleAxisModel);
      result.firstCategoryDimIndex == null && (result.firstCategoryDimIndex = 1);
    }
  },
  geo: function(seriesModel, result, axisMap, categoryAxisMap) {
    result.coordSysDims = ["lng", "lat"];
  },
  parallel: function(seriesModel, result, axisMap, categoryAxisMap) {
    var ecModel = seriesModel.ecModel;
    var parallelModel = ecModel.getComponent("parallel", seriesModel.get("parallelIndex"));
    var coordSysDims = result.coordSysDims = parallelModel.dimensions.slice();
    each(parallelModel.parallelAxisIndex, function(axisIndex, index) {
      var axisModel = ecModel.getComponent("parallelAxis", axisIndex);
      var axisDim = coordSysDims[index];
      axisMap.set(axisDim, axisModel);
      if (isCategory(axisModel)) {
        categoryAxisMap.set(axisDim, axisModel);
        if (result.firstCategoryDimIndex == null) {
          result.firstCategoryDimIndex = index;
        }
      }
    });
  }
};
function isCategory(axisModel) {
  return axisModel.get("type") === "category";
}
function getCoordSysDimDefs(seriesModel, coordSysInfo) {
  var coordSysName = seriesModel.get("coordinateSystem");
  var registeredCoordSys = CoordinateSystemManager.get(coordSysName);
  var coordSysDimDefs;
  if (coordSysInfo && coordSysInfo.coordSysDims) {
    coordSysDimDefs = map$1(coordSysInfo.coordSysDims, function(dim) {
      var dimInfo = {
        name: dim
      };
      var axisModel = coordSysInfo.axisMap.get(dim);
      if (axisModel) {
        var axisType = axisModel.get("type");
        dimInfo.type = getDimensionTypeByAxis(axisType);
      }
      return dimInfo;
    });
  }
  if (!coordSysDimDefs) {
    coordSysDimDefs = registeredCoordSys && (registeredCoordSys.getDimensionsInfo ? registeredCoordSys.getDimensionsInfo() : registeredCoordSys.dimensions.slice()) || ["x", "y"];
  }
  return coordSysDimDefs;
}
function injectOrdinalMeta(dimInfoList, createInvertedIndices, coordSysInfo) {
  var firstCategoryDimIndex;
  var hasNameEncode;
  coordSysInfo && each(dimInfoList, function(dimInfo, dimIndex) {
    var coordDim = dimInfo.coordDim;
    var categoryAxisModel = coordSysInfo.categoryAxisMap.get(coordDim);
    if (categoryAxisModel) {
      if (firstCategoryDimIndex == null) {
        firstCategoryDimIndex = dimIndex;
      }
      dimInfo.ordinalMeta = categoryAxisModel.getOrdinalMeta();
      if (createInvertedIndices) {
        dimInfo.createInvertedIndices = true;
      }
    }
    if (dimInfo.otherDims.itemName != null) {
      hasNameEncode = true;
    }
  });
  if (!hasNameEncode && firstCategoryDimIndex != null) {
    dimInfoList[firstCategoryDimIndex].otherDims.itemName = 0;
  }
  return firstCategoryDimIndex;
}
function createSeriesData(sourceRaw, seriesModel, opt) {
  opt = opt || {};
  var sourceManager = seriesModel.getSourceManager();
  var source;
  var isOriginalSource = false;
  {
    source = sourceManager.getSource();
    isOriginalSource = source.sourceFormat === SOURCE_FORMAT_ORIGINAL;
  }
  var coordSysInfo = getCoordSysInfoBySeries(seriesModel);
  var coordSysDimDefs = getCoordSysDimDefs(seriesModel, coordSysInfo);
  var useEncodeDefaulter = opt.useEncodeDefaulter;
  var encodeDefaulter = isFunction(useEncodeDefaulter) ? useEncodeDefaulter : useEncodeDefaulter ? curry(makeSeriesEncodeForAxisCoordSys, coordSysDimDefs, seriesModel) : null;
  var createDimensionOptions = {
    coordDimensions: coordSysDimDefs,
    generateCoord: opt.generateCoord,
    encodeDefine: seriesModel.getEncode(),
    encodeDefaulter,
    canOmitUnusedDimensions: !isOriginalSource
  };
  var schema = prepareSeriesDataSchema(source, createDimensionOptions);
  var firstCategoryDimIndex = injectOrdinalMeta(schema.dimensions, opt.createInvertedIndices, coordSysInfo);
  var store = !isOriginalSource ? sourceManager.getSharedDataStore(schema) : null;
  var stackCalculationInfo = enableDataStack(seriesModel, {
    schema,
    store
  });
  var data = new SeriesData(schema, seriesModel);
  data.setCalculationInfo(stackCalculationInfo);
  var dimValueGetter = firstCategoryDimIndex != null && isNeedCompleteOrdinalData(source) ? function(itemOpt, dimName, dataIndex, dimIndex) {
    return dimIndex === firstCategoryDimIndex ? dataIndex : this.defaultDimValueGetter(itemOpt, dimName, dataIndex, dimIndex);
  } : null;
  data.hasItemOption = false;
  data.initData(
    // Try to reuse the data store in sourceManager if using dataset.
    isOriginalSource ? source : store,
    null,
    dimValueGetter
  );
  return data;
}
function isNeedCompleteOrdinalData(source) {
  if (source.sourceFormat === SOURCE_FORMAT_ORIGINAL) {
    var sampleItem = firstDataNotNull(source.data || []);
    return !isArray(getDataItemValue(sampleItem));
  }
}
function firstDataNotNull(arr) {
  var i = 0;
  while (i < arr.length && arr[i] == null) {
    i++;
  }
  return arr[i];
}
export {
  SeriesData as S,
  createDimensions as a,
  createSeriesData as c
};
