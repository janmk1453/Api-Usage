import { Bt as isString, Ct as each, Ft as isFunction, Gt as map$1, Mt as isArray, Nt as isArrayLike, Rt as isNumber, Tt as extend, Ut as keys, _t as clone, bt as curry, gt as bind, tn as slice, xt as defaults, yt as createHashMap, zt as isObject$1 } from "./Image-B5UjBJH1.js";
import { $r as SINGLE_REFERRING, $t as CtorInt32Array$1, Gt as CoordinateSystemManager, Ht as enableDataStack, Jt as SeriesDataSchema, Qr as setCommonECData, Qt as shouldOmitUnusedDimensions, Xr as VISUAL_DIMENSIONS, Xt as ensureSourceDimNameMap, Yt as createDimNameMap, Zt as isSeriesDataSchema, an as createSourceFromSeriesDataOption, cn as guessOrdinal, en as DataStore, fi as isDataItemOption, fn as Model, ln as makeSeriesEncodeForAxisCoordSys, oi as getDataItemValue, on as isSourceInstance, qr as SOURCE_FORMAT_ORIGINAL, rn as DefaultDataProvider, sn as BE_ORDINAL, ti as convertOptionIdName, vi as normalizeToArray, wi as removeDuplicates } from "./dataSelectAction-DEGlLCfR.js";
//#region node_modules/echarts/lib/data/DataDiffer.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function dataIndexMapValueLength(valNumOrArrLengthMoreThan2) {
	return valNumOrArrLengthMoreThan2 == null ? 0 : valNumOrArrLengthMoreThan2.length || 1;
}
function defaultKeyGetter(item) {
	return item;
}
var DataDiffer = function() {
	/**
	* @param context Can be visited by this.context in callback.
	*/
	function DataDiffer(oldArr, newArr, oldKeyGetter, newKeyGetter, context, diffMode) {
		this._old = oldArr;
		this._new = newArr;
		this._oldKeyGetter = oldKeyGetter || defaultKeyGetter;
		this._newKeyGetter = newKeyGetter || defaultKeyGetter;
		this.context = context;
		this._diffModeMultiple = diffMode === "multiple";
	}
	/**
	* Callback function when add a data
	*/
	DataDiffer.prototype.add = function(func) {
		this._add = func;
		return this;
	};
	/**
	* Callback function when update a data
	*/
	DataDiffer.prototype.update = function(func) {
		this._update = func;
		return this;
	};
	/**
	* Callback function when update a data and only work in `cbMode: 'byKey'`.
	*/
	DataDiffer.prototype.updateManyToOne = function(func) {
		this._updateManyToOne = func;
		return this;
	};
	/**
	* Callback function when update a data and only work in `cbMode: 'byKey'`.
	*/
	DataDiffer.prototype.updateOneToMany = function(func) {
		this._updateOneToMany = func;
		return this;
	};
	/**
	* Callback function when update a data and only work in `cbMode: 'byKey'`.
	*/
	DataDiffer.prototype.updateManyToMany = function(func) {
		this._updateManyToMany = func;
		return this;
	};
	/**
	* Callback function when remove a data
	*/
	DataDiffer.prototype.remove = function(func) {
		this._remove = func;
		return this;
	};
	DataDiffer.prototype.execute = function() {
		this[this._diffModeMultiple ? "_executeMultiple" : "_executeOneToOne"]();
	};
	DataDiffer.prototype._executeOneToOne = function() {
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
				if (newIdxMapVal.length === 1) newDataIndexMap[oldKey] = newIdxMapVal[0];
				this._update && this._update(newIdx, i);
			} else if (newIdxMapValLen === 1) {
				newDataIndexMap[oldKey] = null;
				this._update && this._update(newIdxMapVal, i);
			} else this._remove && this._remove(i);
		}
		this._performRestAdd(newDataKeyArr, newDataIndexMap);
	};
	/**
	* For example, consider the case:
	* oldData: [o0, o1, o2, o3, o4, o5, o6, o7],
	* newData: [n0, n1, n2, n3, n4, n5, n6, n7, n8],
	* Where:
	*     o0, o1, n0 has key 'a' (many to one)
	*     o5, n4, n5, n6 has key 'b' (one to many)
	*     o2, n1 has key 'c' (one to one)
	*     n2, n3 has key 'd' (add)
	*     o3, o4 has key 'e' (remove)
	*     o6, o7, n7, n8 has key 'f' (many to many, treated as add and remove)
	* Then:
	*     (The order of the following directives are not ensured.)
	*     this._updateManyToOne(n0, [o0, o1]);
	*     this._updateOneToMany([n4, n5, n6], o5);
	*     this._update(n1, o2);
	*     this._remove(o3);
	*     this._remove(o4);
	*     this._remove(o6);
	*     this._remove(o7);
	*     this._add(n2);
	*     this._add(n3);
	*     this._add(n7);
	*     this._add(n8);
	*/
	DataDiffer.prototype._executeMultiple = function() {
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
			} else if (oldIdxMapValLen > 1) for (var i_1 = 0; i_1 < oldIdxMapValLen; i_1++) this._remove && this._remove(oldIdxMapVal[i_1]);
			else this._remove && this._remove(oldIdxMapVal);
		}
		this._performRestAdd(newDataKeyArr, newDataIndexMap);
	};
	DataDiffer.prototype._performRestAdd = function(newDataKeyArr, newDataIndexMap) {
		for (var i = 0; i < newDataKeyArr.length; i++) {
			var newKey = newDataKeyArr[i];
			var newIdxMapVal = newDataIndexMap[newKey];
			var idxMapValLen = dataIndexMapValueLength(newIdxMapVal);
			if (idxMapValLen > 1) for (var j = 0; j < idxMapValLen; j++) this._add && this._add(newIdxMapVal[j]);
			else if (idxMapValLen === 1) this._add && this._add(newIdxMapVal);
			newDataIndexMap[newKey] = null;
		}
	};
	DataDiffer.prototype._initIndexMap = function(arr, map, keyArr, keyGetterName) {
		var cbModeMultiple = this._diffModeMultiple;
		for (var i = 0; i < arr.length; i++) {
			var key = "_ec_" + this[keyGetterName](arr[i], i);
			if (!cbModeMultiple) keyArr[i] = key;
			if (!map) continue;
			var idxMapVal = map[key];
			var idxMapValLen = dataIndexMapValueLength(idxMapVal);
			if (idxMapValLen === 0) {
				map[key] = i;
				if (cbModeMultiple) keyArr.push(key);
			} else if (idxMapValLen === 1) map[key] = [idxMapVal, i];
			else idxMapVal.push(i);
		}
	};
	return DataDiffer;
}();
//#endregion
//#region node_modules/echarts/lib/data/helper/dimensionHelper.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var DimensionUserOuput = function() {
	function DimensionUserOuput(encode, dimRequest) {
		this._encode = encode;
		this._schema = dimRequest;
	}
	DimensionUserOuput.prototype.get = function() {
		return {
			fullDimensions: this._getFullDimensionNames(),
			encode: this._encode
		};
	};
	/**
	* Get all data store dimension names.
	* Theoretically a series data store is defined both by series and used dataset (if any).
	* If some dimensions are omitted for performance reason in `this.dimensions`,
	* the dimension name may not be auto-generated if user does not specify a dimension name.
	* In this case, the dimension name is `null`/`undefined`.
	*/
	DimensionUserOuput.prototype._getFullDimensionNames = function() {
		if (!this._cachedDimNames) this._cachedDimNames = this._schema ? this._schema.makeOutputDimensionNames() : [];
		return this._cachedDimNames;
	};
	return DimensionUserOuput;
}();
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
			var coordDimIndex = dimItem.coordDimIndex;
			getOrCreateEncodeArr(encode, coordDim)[coordDimIndex] = dimName;
			if (!dimItem.isExtraCoord) {
				notExtraCoordDimMap.set(coordDim, 1);
				if (mayLabelDimType(dimItem.type)) defaultedLabel[0] = dimName;
				getOrCreateEncodeArr(userOutputEncode, coordDim)[coordDimIndex] = data.getDimensionIndex(dimItem.name);
			}
			if (dimItem.defaultTooltip) defaultedTooltip.push(dimName);
		}
		VISUAL_DIMENSIONS.each(function(v, otherDim) {
			var encodeArr = getOrCreateEncodeArr(encode, otherDim);
			var dimIndex = dimItem.otherDims[otherDim];
			if (dimIndex != null && dimIndex !== false) encodeArr[dimIndex] = dimItem.name;
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
	if (encodeLabel && encodeLabel.length) defaultedLabel = encodeLabel.slice();
	var encodeTooltip = encode.tooltip;
	if (encodeTooltip && encodeTooltip.length) defaultedTooltip = encodeTooltip.slice();
	else if (!defaultedTooltip.length) defaultedTooltip = defaultedLabel.slice();
	encode.defaultedLabel = defaultedLabel;
	encode.defaultedTooltip = defaultedTooltip;
	summary.userOutput = new DimensionUserOuput(userOutputEncode, schema);
	return summary;
}
function getOrCreateEncodeArr(encode, dim) {
	if (!encode.hasOwnProperty(dim)) encode[dim] = [];
	return encode[dim];
}
function getDimensionTypeByAxis(axisType) {
	return axisType === "category" ? "ordinal" : axisType === "time" ? "time" : "float";
}
function mayLabelDimType(dimType) {
	return !(dimType === "ordinal" || dimType === "time");
}
//#endregion
//#region node_modules/echarts/lib/data/SeriesDimensionDefine.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var SeriesDimensionDefine = function() {
	/**
	* @param opt All of the fields will be shallow copied.
	*/
	function SeriesDimensionDefine(opt) {
		/**
		* The term "other" means "other than coord".
		* The format of `otherDims` is:
		* ```js
		* {
		*     tooltip?: number
		*     label?: number
		*     itemName?: number
		*     seriesName?: number
		* }
		* ```
		*
		* A `series.encode` can specified these fields:
		* ```js
		* encode: {
		*     // "3, 1, 5" is the index of data dimension.
		*     tooltip: [3, 1, 5],
		*     label: [0, 3],
		*     ...
		* }
		* ```
		* `otherDims` is the parse result of the `series.encode` above, like:
		* ```js
		* // Suppose the index of this data dimension is `3`.
		* this.otherDims = {
		*     // `3` is at the index `0` of the `encode.tooltip`
		*     tooltip: 0,
		*     // `3` is at the index `1` of the `encode.label`
		*     label: 1
		* };
		* ```
		*
		* This prop should never be `null`/`undefined` after initialized.
		*/
		this.otherDims = {};
		if (opt != null) extend(this, opt);
	}
	return SeriesDimensionDefine;
}();
//#endregion
//#region node_modules/echarts/lib/data/SeriesData.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var isObject = isObject$1;
var map = map$1;
var CtorInt32Array = typeof Int32Array === "undefined" ? Array : Int32Array;
var ID_PREFIX = "e\0\0";
var INDEX_NOT_FOUND = -1;
var TRANSFERABLE_PROPERTIES = [
	"hasItemOption",
	"_nameList",
	"_idList",
	"_invertedIndicesMap",
	"_dimSummary",
	"userOutput",
	"_rawData",
	"_dimValueGetter",
	"_nameDimIdx",
	"_idDimIdx",
	"_nameRepeatCount"
];
var CLONE_PROPERTIES = ["_approximateExtent"];
var prepareInvertedIndex;
var getId;
var getIdNameFromStore;
var normalizeDimensions;
var transferProperties;
var cloneListForMapAndSample;
var makeIdFromName;
var SeriesData = function() {
	/**
	* @param dimensionsInput.dimensions
	*        For example, ['someDimName', {name: 'someDimName', type: 'someDimType'}, ...].
	*        Dimensions should be concrete names like x, y, z, lng, lat, angle, radius
	*/
	function SeriesData(dimensionsInput, hostModel) {
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
		this.TRANSFERABLE_METHODS = [
			"cloneShallow",
			"downSample",
			"minmaxDownSample",
			"lttbDownSample",
			"map"
		];
		this.CHANGABLE_METHODS = ["filterSelf", "selectRange"];
		this.DOWNSAMPLE_METHODS = [
			"downSample",
			"minmaxDownSample",
			"lttbDownSample"
		];
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
			var dimensionInfo = isString(dimInfoInput) ? new SeriesDimensionDefine({ name: dimInfoInput }) : !(dimInfoInput instanceof SeriesDimensionDefine) ? new SeriesDimensionDefine(dimInfoInput) : dimInfoInput;
			var dimensionName = dimensionInfo.name;
			dimensionInfo.type = dimensionInfo.type || "float";
			if (!dimensionInfo.coordDim) {
				dimensionInfo.coordDim = dimensionName;
				dimensionInfo.coordDimIndex = 0;
			}
			var otherDims = dimensionInfo.otherDims = dimensionInfo.otherDims || {};
			dimensionNames.push(dimensionName);
			dimensionInfos[dimensionName] = dimensionInfo;
			if (emptyObj[dimensionName] != null) needsHasOwn = true;
			if (dimensionInfo.createInvertedIndices) invertedIndicesMap[dimensionName] = [];
			if (assignStoreDimIdx) dimensionInfo.storeDimIndex = i;
			if (otherDims.itemName === 0) this._nameDimIdx = dimensionInfo.storeDimIndex;
			if (otherDims.itemId === 0) this._idDimIdx = dimensionInfo.storeDimIndex;
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
	/**
	*
	* Get concrete dimension name by dimension name or dimension index.
	* If input a dimension name, do not validate whether the dimension name exits.
	*
	* @caution
	* @param dim Must make sure the dimension is `SeriesDimensionLoose`.
	* Because only those dimensions will have auto-generated dimension names if not
	* have a user-specified name, and other dimensions will get a return of null/undefined.
	*
	* @notice Because of this reason, should better use `getDimensionIndex` instead, for examples:
	* ```js
	* const val = data.getStore().get(data.getDimensionIndex(dim), dataIdx);
	* ```
	*
	* @return Concrete dim name.
	*/
	SeriesData.prototype.getDimension = function(dim) {
		var dimIdx = this._recognizeDimIndex(dim);
		if (dimIdx == null) return dim;
		dimIdx = dim;
		if (!this._dimOmitted) return this.dimensions[dimIdx];
		var dimName = this._dimIdxToName.get(dimIdx);
		if (dimName != null) return dimName;
		var sourceDimDef = this._schema.getSourceDimension(dimIdx);
		if (sourceDimDef) return sourceDimDef.name;
	};
	/**
	* Get dimension index in data store. Return -1 if not found.
	* Can be used to index value from getRawValue.
	*/
	SeriesData.prototype.getDimensionIndex = function(dim) {
		var dimIdx = this._recognizeDimIndex(dim);
		if (dimIdx != null) return dimIdx;
		if (dim == null) return -1;
		var dimInfo = this._getDimInfo(dim);
		return dimInfo ? dimInfo.storeDimIndex : this._dimOmitted ? this._schema.getSourceDimensionIndex(dim) : -1;
	};
	/**
	* The meanings of the input parameter `dim`:
	*
	* + If dim is a number (e.g., `1`), it means the index of the dimension.
	*   For example, `getDimension(0)` will return 'x' or 'lng' or 'radius'.
	* + If dim is a number-like string (e.g., `"1"`):
	*     + If there is the same concrete dim name defined in `series.dimensions` or `dataset.dimensions`,
	*        it means that concrete name.
	*     + If not, it will be converted to a number, which means the index of the dimension.
	*        (why? because of the backward compatibility. We have been tolerating number-like string in
	*        dimension setting, although now it seems that it is not a good idea.)
	*     For example, `visualMap[i].dimension: "1"` is the same meaning as `visualMap[i].dimension: 1`,
	*     if no dimension name is defined as `"1"`.
	* + If dim is a not-number-like string, it means the concrete dim name.
	*   For example, it can be be default name `"x"`, `"y"`, `"z"`, `"lng"`, `"lat"`, `"angle"`, `"radius"`,
	*   or customized in `dimensions` property of option like `"age"`.
	*
	* @return recognized `DimensionIndex`. Otherwise return null/undefined (means that dim is `DimensionName`).
	*/
	SeriesData.prototype._recognizeDimIndex = function(dim) {
		if (isNumber(dim) || dim != null && !isNaN(dim) && !this._getDimInfo(dim) && (!this._dimOmitted || this._schema.getSourceDimensionIndex(dim) < 0)) return +dim;
	};
	SeriesData.prototype._getStoreDimIndex = function(dim) {
		return this.getDimensionIndex(dim);
	};
	/**
	* Get type and calculation info of particular dimension
	* @param dim
	*        Dimension can be concrete names like x, y, z, lng, lat, angle, radius
	*        Or a ordinal number. For example getDimensionInfo(0) will return 'x' or 'lng' or 'radius'
	*/
	SeriesData.prototype.getDimensionInfo = function(dim) {
		return this._getDimInfo(this.getDimension(dim));
	};
	SeriesData.prototype._initGetDimensionInfo = function(needsHasOwn) {
		var dimensionInfos = this._dimInfos;
		this._getDimInfo = needsHasOwn ? function(dimName) {
			return dimensionInfos.hasOwnProperty(dimName) ? dimensionInfos[dimName] : void 0;
		} : function(dimName) {
			return dimensionInfos[dimName];
		};
	};
	/**
	* concrete dimension name list on coord.
	*/
	SeriesData.prototype.getDimensionsOnCoord = function() {
		return this._dimSummary.dataDimsOnCoord.slice();
	};
	SeriesData.prototype.mapDimension = function(coordDim, idx) {
		var dimensionsSummary = this._dimSummary;
		if (idx == null) return dimensionsSummary.encodeFirstDimNotExtra[coordDim];
		var dims = dimensionsSummary.encode[coordDim];
		return dims ? dims[idx] : null;
	};
	SeriesData.prototype.mapDimensionsAll = function(coordDim) {
		return (this._dimSummary.encode[coordDim] || []).slice();
	};
	SeriesData.prototype.getStore = function() {
		return this._store;
	};
	/**
	* Initialize from data
	* @param data source or data or data store.
	* @param nameList The name of a datum is used on data diff and
	*        default label/tooltip.
	*        A name can be specified in encode.itemName,
	*        or dataItem.name (only for series option data),
	*        or provided in nameList from outside.
	*/
	SeriesData.prototype.initData = function(data, nameList, dimValueGetter) {
		var _this = this;
		var store;
		if (data instanceof DataStore) store = data;
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
	/**
	* Caution: Can be only called on raw data (before `this._indices` created).
	*/
	SeriesData.prototype.appendData = function(data) {
		var range = this._store.appendData(data);
		this._doInit(range[0], range[1]);
	};
	/**
	* Caution: Can be only called on raw data (before `this._indices` created).
	* This method does not modify `rawData` (`dataProvider`), but only
	* add values to store.
	*
	* The final count will be increased by `Math.max(values.length, names.length)`.
	*
	* @param values That is the SourceType: 'arrayRows', like
	*        [
	*            [12, 33, 44],
	*            [NaN, 43, 1],
	*            ['-', 'asdf', 0]
	*        ]
	*        Each item is exactly corresponding to a dimension.
	*/
	SeriesData.prototype.appendValues = function(values, names) {
		var _a = this._store.appendValues(values, names && names.length), start = _a.start, end = _a.end;
		var shouldMakeIdFromName = this._shouldMakeIdFromName();
		this._updateOrdinalMeta();
		if (names) for (var idx = start; idx < end; idx++) {
			var sourceIdx = idx - start;
			this._nameList[idx] = names[sourceIdx];
			if (shouldMakeIdFromName) makeIdFromName(this, idx);
		}
	};
	SeriesData.prototype._updateOrdinalMeta = function() {
		var store = this._store;
		var dimensions = this.dimensions;
		for (var i = 0; i < dimensions.length; i++) {
			var dimInfo = this._dimInfos[dimensions[i]];
			if (dimInfo.ordinalMeta) store.collectOrdinalMeta(dimInfo.storeDimIndex, dimInfo.ordinalMeta);
		}
	};
	SeriesData.prototype._shouldMakeIdFromName = function() {
		var provider = this._store.getProvider();
		return this._idDimIdx == null && provider.getSource().sourceFormat !== "typedArray" && !provider.fillStorage;
	};
	SeriesData.prototype._doInit = function(start, end) {
		if (start >= end) return;
		var provider = this._store.getProvider();
		this._updateOrdinalMeta();
		var nameList = this._nameList;
		var idList = this._idList;
		if (provider.getSource().sourceFormat === "original" && !provider.pure) {
			var sharedDataItem = [];
			for (var idx = start; idx < end; idx++) {
				var dataItem = provider.getItem(idx, sharedDataItem);
				if (!this.hasItemOption && isDataItemOption(dataItem)) this.hasItemOption = true;
				if (dataItem) {
					var itemName = dataItem.name;
					if (nameList[idx] == null && itemName != null) nameList[idx] = convertOptionIdName(itemName, null);
					var itemId = dataItem.id;
					if (idList[idx] == null && itemId != null) idList[idx] = convertOptionIdName(itemId, null);
				}
			}
		}
		if (this._shouldMakeIdFromName()) for (var idx = start; idx < end; idx++) makeIdFromName(this, idx);
		prepareInvertedIndex(this);
	};
	/**
	* Optimize for the scenario that data is filtered by a given extent.
	* Consider that if data amount is more than hundreds of thousand,
	* extent calculation will cost more than 10ms and the cache will
	* be erased because of the filtering.
	*/
	SeriesData.prototype.getApproximateExtent = function(dim, filter) {
		return this._approximateExtent[dim] || this._store.getDataExtent(this._getStoreDimIndex(dim), filter);
	};
	/**
	* NOTICE: `_approximateExtent` does not support filter. Callers must ensure the input extent
	* to be handled by `scale.sanitizeExtent`.
	*
	* Calculate extent on a filtered data might be time consuming.
	* Approximate extent is only used for: calculate extent of filtered data outside.
	*/
	SeriesData.prototype.setApproximateExtent = function(extent, dim) {
		dim = this.getDimension(dim);
		this._approximateExtent[dim] = extent.slice();
	};
	SeriesData.prototype.getCalculationInfo = function(key) {
		return this._calculationInfo[key];
	};
	SeriesData.prototype.setCalculationInfo = function(key, value) {
		isObject(key) ? extend(this._calculationInfo, key) : this._calculationInfo[key] = value;
	};
	/**
	* @return Never be null/undefined. `number` will be converted to string. Because:
	* In most cases, name is used in display, where returning a string is more convenient.
	* In other cases, name is used in query (see `indexOfName`), where we can keep the
	* rule that name `2` equals to name `'2'`.
	*/
	SeriesData.prototype.getName = function(idx) {
		var rawIndex = this.getRawIndex(idx);
		var name = this._nameList[rawIndex];
		if (name == null && this._nameDimIdx != null) name = getIdNameFromStore(this, this._nameDimIdx, rawIndex);
		if (name == null) name = "";
		return name;
	};
	SeriesData.prototype._getCategory = function(dimIdx, idx) {
		var ordinal = this._store.get(dimIdx, idx);
		var ordinalMeta = this._store.getOrdinalMeta(dimIdx);
		if (ordinalMeta) return ordinalMeta.categories[ordinal];
		return ordinal;
	};
	/**
	* @return Never null/undefined. `number` will be converted to string. Because:
	* In all cases having encountered at present, id is used in making diff comparison, which
	* are usually based on hash map. We can keep the rule that the internal id are always string
	* (treat `2` is the same as `'2'`) to make the related logic simple.
	*/
	SeriesData.prototype.getId = function(idx) {
		return getId(this, this.getRawIndex(idx));
	};
	SeriesData.prototype.count = function() {
		return this._store.count();
	};
	/**
	* Get value. Return NaN if idx is out of range.
	*
	* @notice Should better to use `data.getStore().get(dimIndex, dataIdx)` instead.
	*/
	SeriesData.prototype.get = function(dim, idx) {
		var store = this._store;
		var dimInfo = this._dimInfos[dim];
		if (dimInfo) return store.get(dimInfo.storeDimIndex, idx);
	};
	/**
	* @notice Should better to use `data.getStore().getByRawIndex(dimIndex, dataIdx)` instead.
	*/
	SeriesData.prototype.getByRawIndex = function(dim, rawIdx) {
		var store = this._store;
		var dimInfo = this._dimInfos[dim];
		if (dimInfo) return store.getByRawIndex(dimInfo.storeDimIndex, rawIdx);
	};
	SeriesData.prototype.getIndices = function() {
		return this._store.getIndices();
	};
	SeriesData.prototype.getDataExtent = function(dim) {
		return this._store.getDataExtent(this._getStoreDimIndex(dim), null);
	};
	SeriesData.prototype.getSum = function(dim) {
		return this._store.getSum(this._getStoreDimIndex(dim));
	};
	SeriesData.prototype.getMedian = function(dim) {
		return this._store.getMedian(this._getStoreDimIndex(dim));
	};
	SeriesData.prototype.getValues = function(dimensions, idx) {
		var _this = this;
		var store = this._store;
		return isArray(dimensions) ? store.getValues(map(dimensions, function(dim) {
			return _this._getStoreDimIndex(dim);
		}), idx) : store.getValues(dimensions);
	};
	/**
	* If value is NaN. Including '-'
	* Only check the coord dimensions.
	*/
	SeriesData.prototype.hasValue = function(idx) {
		var dataDimIndicesOnCoord = this._dimSummary.dataDimIndicesOnCoord;
		for (var i = 0, len = dataDimIndicesOnCoord.length; i < len; i++) if (isNaN(this._store.get(dataDimIndicesOnCoord[i], idx))) return false;
		return true;
	};
	/**
	* Retrieve the index with given name
	*/
	SeriesData.prototype.indexOfName = function(name) {
		for (var i = 0, len = this._store.count(); i < len; i++) if (this.getName(i) === name) return i;
		return -1;
	};
	SeriesData.prototype.getRawIndex = function(idx) {
		return this._store.getRawIndex(idx);
	};
	SeriesData.prototype.indexOfRawIndex = function(rawIndex) {
		return this._store.indexOfRawIndex(rawIndex);
	};
	/**
	* Only support the dimension which inverted index created.
	* Do not support other cases until required.
	* @param dim concrete dim
	* @param value ordinal index
	* @return rawIndex
	*/
	SeriesData.prototype.rawIndexOf = function(dim, value) {
		var invertedIndices = dim && this._invertedIndicesMap[dim];
		var rawIndex = invertedIndices && invertedIndices[value];
		if (rawIndex == null || isNaN(rawIndex)) return INDEX_NOT_FOUND;
		return rawIndex;
	};
	SeriesData.prototype.each = function(dims, cb, ctx) {
		"use strict";
		if (isFunction(dims)) {
			ctx = cb;
			cb = dims;
			dims = [];
		}
		var fCtx = ctx || this;
		var dimIndices = map(normalizeDimensions(dims), this._getStoreDimIndex, this);
		this._store.each(dimIndices, fCtx ? bind(cb, fCtx) : cb);
	};
	SeriesData.prototype.filterSelf = function(dims, cb, ctx) {
		"use strict";
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
	/**
	* Select data in range. (For optimization of filter)
	* (Manually inline code, support 5 million data filtering in data zoom.)
	*/
	SeriesData.prototype.selectRange = function(range) {
		"use strict";
		var _this = this;
		var innerRange = {};
		var dims = keys(range);
		var dimIndices = [];
		each(dims, function(dim) {
			var dimIdx = _this._getStoreDimIndex(dim);
			innerRange[dimIdx] = range[dim];
			dimIndices.push(dimIdx);
		});
		this._store = this._store.selectRange(innerRange);
		return this;
	};
	SeriesData.prototype.mapArray = function(dims, cb, ctx) {
		"use strict";
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
	SeriesData.prototype.map = function(dims, cb, ctx, ctxCompat) {
		"use strict";
		var fCtx = ctx || ctxCompat || this;
		var dimIndices = map(normalizeDimensions(dims), this._getStoreDimIndex, this);
		var list = cloneListForMapAndSample(this);
		list._store = this._store.map(dimIndices, fCtx ? bind(cb, fCtx) : cb);
		return list;
	};
	SeriesData.prototype.modify = function(dims, cb, ctx, ctxCompat) {
		var fCtx = ctx || ctxCompat || this;
		var dimIndices = map(normalizeDimensions(dims), this._getStoreDimIndex, this);
		this._store.modify(dimIndices, fCtx ? bind(cb, fCtx) : cb);
	};
	/**
	* Large data down sampling on given dimension
	* @param sampleIndex Sample index for name and id
	*/
	SeriesData.prototype.downSample = function(dimension, rate, sampleValue, sampleIndex) {
		var list = cloneListForMapAndSample(this);
		list._store = this._store.downSample(this._getStoreDimIndex(dimension), rate, sampleValue, sampleIndex);
		return list;
	};
	/**
	* Large data down sampling using min-max
	* @param {string} valueDimension
	* @param {number} rate
	*/
	SeriesData.prototype.minmaxDownSample = function(valueDimension, rate) {
		var list = cloneListForMapAndSample(this);
		list._store = this._store.minmaxDownSample(this._getStoreDimIndex(valueDimension), rate);
		return list;
	};
	/**
	* Large data down sampling using largest-triangle-three-buckets
	* @param {string} valueDimension
	* @param {number} targetCount
	*/
	SeriesData.prototype.lttbDownSample = function(valueDimension, rate) {
		var list = cloneListForMapAndSample(this);
		list._store = this._store.lttbDownSample(this._getStoreDimIndex(valueDimension), rate);
		return list;
	};
	SeriesData.prototype.getRawDataItem = function(idx) {
		return this._store.getRawDataItem(idx);
	};
	/**
	* Get model of one data item.
	*/
	SeriesData.prototype.getItemModel = function(idx) {
		var hostModel = this.hostModel;
		var dataItem = this.getRawDataItem(idx);
		return new Model(dataItem, hostModel, hostModel && hostModel.ecModel);
	};
	/**
	* Create a data differ
	*/
	SeriesData.prototype.diff = function(otherList) {
		var thisList = this;
		return new DataDiffer(otherList ? otherList.getStore().getIndices() : [], this.getStore().getIndices(), function(idx) {
			return getId(otherList, idx);
		}, function(idx) {
			return getId(thisList, idx);
		});
	};
	/**
	* Get visual property.
	*/
	SeriesData.prototype.getVisual = function(key) {
		var visual = this._visual;
		return visual && visual[key];
	};
	SeriesData.prototype.setVisual = function(kvObj, val) {
		this._visual = this._visual || {};
		if (isObject(kvObj)) extend(this._visual, kvObj);
		else this._visual[kvObj] = val;
	};
	/**
	* Get visual property of single data item
	*/
	SeriesData.prototype.getItemVisual = function(idx, key) {
		var itemVisual = this._itemVisuals[idx];
		var val = itemVisual && itemVisual[key];
		if (val == null) return this.getVisual(key);
		return val;
	};
	/**
	* If exists visual property of single data item
	*/
	SeriesData.prototype.hasItemVisual = function() {
		return this._itemVisuals.length > 0;
	};
	/**
	* Make sure itemVisual property is unique
	*/
	SeriesData.prototype.ensureUniqueItemVisual = function(idx, key) {
		var itemVisuals = this._itemVisuals;
		var itemVisual = itemVisuals[idx];
		if (!itemVisual) itemVisual = itemVisuals[idx] = {};
		var val = itemVisual[key];
		if (val == null) {
			val = this.getVisual(key);
			if (isArray(val)) val = val.slice();
			else if (isObject(val)) val = extend({}, val);
			itemVisual[key] = val;
		}
		return val;
	};
	SeriesData.prototype.setItemVisual = function(idx, key, value) {
		var itemVisual = this._itemVisuals[idx] || {};
		this._itemVisuals[idx] = itemVisual;
		if (isObject(key)) extend(itemVisual, key);
		else itemVisual[key] = value;
	};
	/**
	* Clear itemVisuals and list visual.
	*/
	SeriesData.prototype.clearAllVisual = function() {
		this._visual = {};
		this._itemVisuals = [];
	};
	SeriesData.prototype.setLayout = function(key, val) {
		isObject(key) ? extend(this._layout, key) : this._layout[key] = val;
	};
	/**
	* Get layout property.
	*/
	SeriesData.prototype.getLayout = function(key) {
		return this._layout[key];
	};
	/**
	* Get layout of single data item
	*/
	SeriesData.prototype.getItemLayout = function(idx) {
		return this._itemLayouts[idx];
	};
	/**
	* Set layout of single data item
	*/
	SeriesData.prototype.setItemLayout = function(idx, layout, merge) {
		this._itemLayouts[idx] = merge ? extend(this._itemLayouts[idx] || {}, layout) : layout;
	};
	/**
	* Clear all layout of single data item
	*/
	SeriesData.prototype.clearItemLayouts = function() {
		this._itemLayouts.length = 0;
	};
	/**
	* Set graphic element relative to data. It can be set as null
	*/
	SeriesData.prototype.setItemGraphicEl = function(idx, el) {
		var seriesIndex = this.hostModel && this.hostModel.seriesIndex;
		setCommonECData(seriesIndex, this.dataType, idx, el);
		this._graphicEls[idx] = el;
	};
	SeriesData.prototype.getItemGraphicEl = function(idx) {
		return this._graphicEls[idx];
	};
	SeriesData.prototype.eachItemGraphicEl = function(cb, context) {
		each(this._graphicEls, function(el, idx) {
			if (el) cb && cb.call(context, el, idx);
		});
	};
	/**
	* Shallow clone a new list except visual and layout properties, and graph elements.
	* New list only change the indices.
	*/
	SeriesData.prototype.cloneShallow = function(list) {
		if (!list) list = new SeriesData(this._schema ? this._schema : map(this.dimensions, this._getDimInfo, this), this.hostModel);
		transferProperties(list, this);
		list._store = this._store;
		return list;
	};
	/**
	* Wrap some method to add more feature
	*/
	SeriesData.prototype.wrapMethod = function(methodName, injectFunction) {
		var originalMethod = this[methodName];
		if (!isFunction(originalMethod)) return;
		this.__wrappedMethods = this.__wrappedMethods || [];
		this.__wrappedMethods.push(methodName);
		this[methodName] = function() {
			var res = originalMethod.apply(this, arguments);
			return injectFunction.apply(this, [res].concat(slice(arguments)));
		};
	};
	SeriesData.internalField = function() {
		prepareInvertedIndex = function(data) {
			var invertedIndicesMap = data._invertedIndicesMap;
			each(invertedIndicesMap, function(invertedIndices, dim) {
				var dimInfo = data._dimInfos[dim];
				var ordinalMeta = dimInfo.ordinalMeta;
				var store = data._store;
				if (ordinalMeta) {
					invertedIndices = invertedIndicesMap[dim] = new CtorInt32Array(ordinalMeta.categories.length);
					for (var i = 0; i < invertedIndices.length; i++) invertedIndices[i] = INDEX_NOT_FOUND;
					for (var i = 0; i < store.count(); i++) invertedIndices[store.get(dimInfo.storeDimIndex, i)] = i;
				}
			});
		};
		getIdNameFromStore = function(data, dimIdx, idx) {
			return convertOptionIdName(data._getCategory(dimIdx, idx), null);
		};
		/**
		* @see the comment of `List['getId']`.
		*/
		getId = function(data, rawIndex) {
			var id = data._idList[rawIndex];
			if (id == null && data._idDimIdx != null) id = getIdNameFromStore(data, data._idDimIdx, rawIndex);
			if (id == null) id = ID_PREFIX + rawIndex;
			return id;
		};
		normalizeDimensions = function(dimensions) {
			if (!isArray(dimensions)) dimensions = dimensions != null ? [dimensions] : [];
			return dimensions;
		};
		/**
		* Data in excludeDimensions is copied, otherwise transferred.
		*/
		cloneListForMapAndSample = function(original) {
			var list = new SeriesData(original._schema ? original._schema : map(original.dimensions, original._getDimInfo, original), original.hostModel);
			transferProperties(list, original);
			return list;
		};
		transferProperties = function(target, source) {
			each(TRANSFERABLE_PROPERTIES.concat(source.__wrappedMethods || []), function(propName) {
				if (source.hasOwnProperty(propName)) target[propName] = source[propName];
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
			if (name == null && nameDimIdx != null) nameList[idx] = name = getIdNameFromStore(data, nameDimIdx, idx);
			if (id == null && idDimIdx != null) idList[idx] = id = getIdNameFromStore(data, idDimIdx, idx);
			if (id == null && name != null) {
				var nameRepeatCount = data._nameRepeatCount;
				var nmCnt = nameRepeatCount[name] = (nameRepeatCount[name] || 0) + 1;
				id = name;
				if (nmCnt > 1) id += "__ec__" + nmCnt;
				idList[idx] = id;
			}
		};
	}();
	return SeriesData;
}();
//#endregion
//#region node_modules/echarts/lib/data/helper/createDimensions.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* For outside usage compat (like echarts-gl are using it).
*/
function createDimensions(source, opt) {
	return prepareSeriesDataSchema(source, opt).dimensions;
}
/**
* This method builds the relationship between:
* + "what the coord sys or series requires (see `coordDimensions`)",
* + "what the user defines (in `encode` and `dimensions`, see `opt.dimensionsDefine` and `opt.encodeDefine`)"
* + "what the data source provids (see `source`)".
*
* Some guess strategy will be adapted if user does not define something.
* If no 'value' dimension specified, the first no-named dimension will be
* named as 'value'.
*
* @return The results are always sorted by `storeDimIndex` asc.
*/
function prepareSeriesDataSchema(source, opt) {
	if (!isSourceInstance(source)) source = createSourceFromSeriesDataOption(source);
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
	if (!encodeDef && opt.encodeDefaulter) encodeDef = opt.encodeDefaulter(source, dimCount);
	var encodeDefMap = createHashMap(encodeDef);
	var indicesMap = new CtorInt32Array$1(dimCount);
	for (var i = 0; i < indicesMap.length; i++) indicesMap[i] = -1;
	function getResultItem(dimIdx) {
		var idx = indicesMap[dimIdx];
		if (idx < 0) {
			var dimDefItemRaw = dimsDef[dimIdx];
			var dimDefItem = isObject$1(dimDefItemRaw) ? dimDefItemRaw : { name: dimDefItemRaw };
			var resultItem = new SeriesDimensionDefine();
			var userDimName = dimDefItem.name;
			if (userDimName != null && dataDimNameMap.get(userDimName) != null) resultItem.name = resultItem.displayName = userDimName;
			dimDefItem.type != null && (resultItem.type = dimDefItem.type);
			dimDefItem.displayName != null && (resultItem.displayName = dimDefItem.displayName);
			indicesMap[dimIdx] = resultList.length;
			resultItem.storeDimIndex = dimIdx;
			resultList.push(resultItem);
			return resultItem;
		}
		return resultList[idx];
	}
	if (!omitUnusedDimensions) for (var i = 0; i < dimCount; i++) getResultItem(i);
	encodeDefMap.each(function(dataDimsRaw, coordDim) {
		var dataDims = normalizeToArray(dataDimsRaw).slice();
		if (dataDims.length === 1 && !isString(dataDims[0]) && dataDims[0] < 0) {
			encodeDefMap.set(coordDim, false);
			return;
		}
		var validDataDims = encodeDefMap.set(coordDim, []);
		each(dataDims, function(resultDimIdxOrName, idx) {
			var resultDimIdx = isString(resultDimIdxOrName) ? dataDimNameMap.get(resultDimIdxOrName) : resultDimIdxOrName;
			if (resultDimIdx != null && resultDimIdx < dimCount) {
				validDataDims[idx] = resultDimIdx;
				applyDim(getResultItem(resultDimIdx), coordDim, idx);
			}
		});
	});
	var availDimIdx = 0;
	each(sysDims, function(sysDimItemRaw) {
		var coordDim;
		var sysDimItemDimsDef;
		var sysDimItemOtherDims;
		var sysDimItem;
		if (isString(sysDimItemRaw)) {
			coordDim = sysDimItemRaw;
			sysDimItem = {};
		} else {
			sysDimItem = sysDimItemRaw;
			coordDim = sysDimItem.name;
			var ordinalMeta = sysDimItem.ordinalMeta;
			sysDimItem.ordinalMeta = null;
			sysDimItem = extend({}, sysDimItem);
			sysDimItem.ordinalMeta = ordinalMeta;
			sysDimItemDimsDef = sysDimItem.dimsDef;
			sysDimItemOtherDims = sysDimItem.otherDims;
			sysDimItem.name = sysDimItem.coordDim = sysDimItem.coordDimIndex = sysDimItem.dimsDef = sysDimItem.otherDims = null;
		}
		var dataDims = encodeDefMap.get(coordDim);
		if (dataDims === false) return;
		dataDims = normalizeToArray(dataDims);
		if (!dataDims.length) for (var i = 0; i < (sysDimItemDimsDef && sysDimItemDimsDef.length || 1); i++) {
			while (availDimIdx < dimCount && getResultItem(availDimIdx).coordDim != null) availDimIdx++;
			availDimIdx < dimCount && dataDims.push(availDimIdx++);
		}
		each(dataDims, function(resultDimIdx, coordDimIndex) {
			var resultItem = getResultItem(resultDimIdx);
			if (isUsingSourceDimensionsDef && sysDimItem.type != null) resultItem.type = sysDimItem.type;
			applyDim(defaults(resultItem, sysDimItem), coordDim, coordDimIndex);
			if (resultItem.name == null && sysDimItemDimsDef) {
				var sysDimItemDimsDefItem = sysDimItemDimsDef[coordDimIndex];
				!isObject$1(sysDimItemDimsDefItem) && (sysDimItemDimsDefItem = { name: sysDimItemDimsDefItem });
				resultItem.name = resultItem.displayName = sysDimItemDimsDefItem.name;
				resultItem.defaultTooltip = sysDimItemDimsDefItem.defaultTooltip;
			}
			sysDimItemOtherDims && defaults(resultItem.otherDims, sysDimItemOtherDims);
		});
	});
	function applyDim(resultItem, coordDim, coordDimIndex) {
		if (VISUAL_DIMENSIONS.get(coordDim) != null) resultItem.otherDims[coordDim] = coordDimIndex;
		else {
			resultItem.coordDim = coordDim;
			resultItem.coordDimIndex = coordDimIndex;
			coordDimNameMap.set(coordDim, true);
		}
	}
	var generateCoord = opt.generateCoord;
	var generateCoordCount = opt.generateCoordCount;
	var fromZero = generateCoordCount != null;
	generateCoordCount = generateCoord ? generateCoordCount || 1 : 0;
	var extra = generateCoord || "value";
	function ifNoNameFillWithCoordName(resultItem) {
		if (resultItem.name == null) resultItem.name = resultItem.coordDim;
	}
	if (!omitUnusedDimensions) for (var resultDimIdx = 0; resultDimIdx < dimCount; resultDimIdx++) {
		var resultItem = getResultItem(resultDimIdx);
		if (resultItem.coordDim == null) {
			resultItem.coordDim = genCoordDimName(extra, coordDimNameMap, fromZero);
			resultItem.coordDimIndex = 0;
			if (!generateCoord || generateCoordCount <= 0) resultItem.isExtraCoord = true;
			generateCoordCount--;
		}
		ifNoNameFillWithCoordName(resultItem);
		if (resultItem.type == null && (guessOrdinal(source, resultDimIdx) === BE_ORDINAL.Must || resultItem.isExtraCoord && (resultItem.otherDims.itemName != null || resultItem.otherDims.seriesName != null))) resultItem.type = "ordinal";
	}
	else {
		each(resultList, function(resultItem) {
			ifNoNameFillWithCoordName(resultItem);
		});
		resultList.sort(function(item0, item1) {
			return item0.storeDimIndex - item1.storeDimIndex;
		});
	}
	removeDuplicates(resultList, function(item) {
		return item.name;
	}, function(item, existingCount) {
		if (existingCount > 0) item.name = item.name + (existingCount - 1);
	});
	return new SeriesDataSchema({
		source,
		dimensions: resultList,
		fullDimensionCount: dimCount,
		dimensionOmitted: omitUnusedDimensions
	});
}
function getDimCount(source, sysDims, dimsDef, optDimCount) {
	var dimCount = Math.max(source.dimensionsDetectedCount || 1, sysDims.length, dimsDef.length, optDimCount || 0);
	each(sysDims, function(sysDimItem) {
		var sysDimItemDimsDef;
		if (isObject$1(sysDimItem) && (sysDimItemDimsDef = sysDimItem.dimsDef)) dimCount = Math.max(dimCount, sysDimItemDimsDef.length);
	});
	return dimCount;
}
function genCoordDimName(name, map, fromZero) {
	if (fromZero || map.hasKey(name)) {
		var i = 0;
		while (map.hasKey(name + i)) i++;
		name += i;
	}
	map.set(name, true);
	return name;
}
//#endregion
//#region node_modules/echarts/lib/model/referHelper.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* Helper for model references.
* There are many manners to refer axis/coordSys.
*/
/**
* @class
* For example:
* {
*     coordSysName: 'cartesian2d',
*     coordSysDims: ['x', 'y', ...],
*     axisMap: HashMap({
*         x: xAxisModel,
*         y: yAxisModel
*     }),
*     categoryAxisMap: HashMap({
*         x: xAxisModel,
*         y: undefined
*     }),
*     // The index of the first category axis in `coordSysDims`.
*     // `null/undefined` means no category axis exists.
*     firstCategoryDimIndex: 1,
*     // To replace user specified encode.
* }
*/
var SeriesModelCoordSysInfo = function() {
	function SeriesModelCoordSysInfo(coordSysName) {
		this.coordSysDims = [];
		this.axisMap = createHashMap();
		this.categoryAxisMap = createHashMap();
		this.coordSysName = coordSysName;
	}
	return SeriesModelCoordSysInfo;
}();
function getCoordSysInfoBySeries(seriesModel) {
	var coordSysName = seriesModel.get("coordinateSystem");
	var result = new SeriesModelCoordSysInfo(coordSysName);
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
		result.coordSysDims = ["x", "y"];
		axisMap.set("x", xAxisModel);
		axisMap.set("y", yAxisModel);
		if (isCategory(xAxisModel)) {
			categoryAxisMap.set("x", xAxisModel);
			result.firstCategoryDimIndex = 0;
		}
		if (isCategory(yAxisModel)) {
			categoryAxisMap.set("y", yAxisModel);
			result.firstCategoryDimIndex ?? (result.firstCategoryDimIndex = 1);
		}
	},
	singleAxis: function(seriesModel, result, axisMap, categoryAxisMap) {
		var singleAxisModel = seriesModel.getReferringComponents("singleAxis", SINGLE_REFERRING).models[0];
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
		result.coordSysDims = ["radius", "angle"];
		axisMap.set("radius", radiusAxisModel);
		axisMap.set("angle", angleAxisModel);
		if (isCategory(radiusAxisModel)) {
			categoryAxisMap.set("radius", radiusAxisModel);
			result.firstCategoryDimIndex = 0;
		}
		if (isCategory(angleAxisModel)) {
			categoryAxisMap.set("angle", angleAxisModel);
			result.firstCategoryDimIndex ?? (result.firstCategoryDimIndex = 1);
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
				if (result.firstCategoryDimIndex == null) result.firstCategoryDimIndex = index;
			}
		});
	},
	matrix: function(seriesModel, result, axisMap, categoryAxisMap) {
		var matrixModel = seriesModel.getReferringComponents("matrix", SINGLE_REFERRING).models[0];
		result.coordSysDims = ["x", "y"];
		var xModel = matrixModel.getDimensionModel("x");
		var yModel = matrixModel.getDimensionModel("y");
		axisMap.set("x", xModel);
		axisMap.set("y", yModel);
		categoryAxisMap.set("x", xModel);
		categoryAxisMap.set("y", yModel);
	}
};
function isCategory(axisModel) {
	return axisModel.get("type") === "category";
}
//#endregion
//#region node_modules/echarts/lib/chart/helper/createSeriesData.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function getCoordSysDimDefs(seriesModel, coordSysInfo) {
	var coordSysName = seriesModel.get("coordinateSystem");
	var registeredCoordSys = CoordinateSystemManager.get(coordSysName);
	var coordSysDimDefs;
	if (coordSysInfo && coordSysInfo.coordSysDims) coordSysDimDefs = map$1(coordSysInfo.coordSysDims, function(dim) {
		var dimInfo = { name: dim };
		var axisModel = coordSysInfo.axisMap.get(dim);
		if (axisModel) dimInfo.type = getDimensionTypeByAxis(axisModel.get("type"));
		return dimInfo;
	});
	if (!coordSysDimDefs) coordSysDimDefs = registeredCoordSys && (registeredCoordSys.getDimensionsInfo ? registeredCoordSys.getDimensionsInfo() : registeredCoordSys.dimensions.slice()) || ["x", "y"];
	return coordSysDimDefs;
}
function injectOrdinalMeta(dimInfoList, createInvertedIndices, coordSysInfo) {
	var firstCategoryDimIndex;
	var hasNameEncode;
	coordSysInfo && each(dimInfoList, function(dimInfo, dimIndex) {
		var coordDim = dimInfo.coordDim;
		var categoryAxisModel = coordSysInfo.categoryAxisMap.get(coordDim);
		if (categoryAxisModel) {
			if (firstCategoryDimIndex == null) firstCategoryDimIndex = dimIndex;
			dimInfo.ordinalMeta = categoryAxisModel.getOrdinalMeta();
			if (createInvertedIndices) dimInfo.createInvertedIndices = true;
		}
		if (dimInfo.otherDims.itemName != null) hasNameEncode = true;
	});
	if (!hasNameEncode && firstCategoryDimIndex != null) dimInfoList[firstCategoryDimIndex].otherDims.itemName = 0;
	return firstCategoryDimIndex;
}
/**
* Caution: there are side effects to `sourceManager` in this method.
* Should better only be called in `Series['getInitialData']`.
*/
function createSeriesData(sourceRaw, seriesModel, opt) {
	opt = opt || {};
	var sourceManager = seriesModel.getSourceManager();
	var source;
	var isOriginalSource = false;
	if (sourceRaw) {
		isOriginalSource = true;
		source = createSourceFromSeriesDataOption(sourceRaw);
	} else {
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
	data.initData(isOriginalSource ? source : store, null, dimValueGetter);
	return data;
}
function isNeedCompleteOrdinalData(source) {
	if (source.sourceFormat === "original") {
		var sampleItem = firstDataNotNull(source.data || []);
		return !isArray(getDataItemValue(sampleItem));
	}
}
function firstDataNotNull(arr) {
	var i = 0;
	while (i < arr.length && arr[i] == null) i++;
	return arr[i];
}
//#endregion
export { SeriesData as i, createDimensions as n, prepareSeriesDataSchema as r, createSeriesData as t };
