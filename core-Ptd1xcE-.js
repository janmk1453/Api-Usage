import { c as createScaleByModel, n as niceScaleExtent, A as AxisModelCommonMixin, C as ComponentView } from "./Axis-D1Ml6vLP.js";
import { a, P, b, d, e, f, g, h, i, j, k, l, m, r, o, p, q, s, t, u, v, w, x, y, z, B, D, E, F, G } from "./Axis-D1Ml6vLP.js";
import { Z as ZRText, g as getStackedDimension, e as enableDataStack, i as isDimensionStacked, c as createTextStyle$1, M as Model, a as createSymbol, b as enableHoverEmphasis, d as getECData, f as getLayoutRect, h as MAX_SAFE_INTEGER, j as asc, k as getPercentWithPrecision, l as getPixelPrecision, m as getPrecision, n as getPrecisionSafe, o as isNumeric, p as isRadianAroundZero, q as linearMap, r as nice, s as numericToNumber, t as parseDate, u as quantile, v as quantity, w as quantityExponent, x as reformIntervals, y as remRadian, z as round, A as format$1, B as Arc, C as BezierCurve, D as Circle, E as CompoundPath, F as Ellipse, G as Group, I as IncrementalDisplayable, L as Line, H as LinearGradient, P as Polygon, J as Polyline, R as RadialGradient, K as Rect, N as Ring, S as Sector, O as clipPointsByRect, Q as clipRectByRect, T as createIcon, U as extendPath, V as extendShape, W as getShapeClass, X as getTransform, Y as initProps, _ as makeImage, $ as makePath, a0 as mergePath, a1 as registerShape, a2 as resizePath, a3 as updateProps, a4 as addCommas, a5 as capitalFirst, a6 as encodeHTML, a7 as formatTime, a8 as formatTpl, a9 as getTooltipMarker, aa as normalizeCssArray, ab as toCamelCase, ac as truncateText, ad as ChartView, ae as ComponentModel, af as SeriesModel } from "./barGrid-B8918HIn.js";
import { ag, ah } from "./barGrid-B8918HIn.js";
import { c as createSeriesData, a as createDimensions } from "./createSeriesData-D4D0BTKA.js";
import { S } from "./createSeriesData-D4D0BTKA.js";
import { m as mixin, w as windingLine, _ as __extends, e as each, B as BoundingRect, a as min, b as max, c as applyTransform, i as identity, d as mul, f as invert, g as map, h as filter, Z as ZRImage, j as bind, k as clone, l as curry, n as defaults, o as extend, p as indexOf, q as inherits, r as isArray, s as isFunction, t as isObject, u as isString, v as merge, x as reduce } from "./Image-DY6RhQFr.js";
import { y as y2, z as z2, A, C, D as D2, E as E2 } from "./Image-DY6RhQFr.js";
import { b as b2 } from "./graphic-BcLauDrn.js";
function getTextRect(text, font, align, verticalAlign, padding, rich, truncate, lineHeight) {
  var textEl = new ZRText({
    style: {
      text,
      font,
      align,
      verticalAlign,
      padding,
      rich,
      overflow: truncate ? "truncate" : null,
      lineHeight
    }
  });
  return textEl.getBoundingRect();
}
function createList(seriesModel) {
  return createSeriesData(null, seriesModel);
}
var dataStack = {
  isDimensionStacked,
  enableDataStack,
  getStackedDimension
};
function createScale(dataExtent, option) {
  var axisModel = option;
  if (!(option instanceof Model)) {
    axisModel = new Model(option);
  }
  var scale = createScaleByModel(axisModel);
  scale.setExtent(dataExtent[0], dataExtent[1]);
  niceScaleExtent(scale, axisModel);
  return scale;
}
function mixinAxisModelCommonMethods(Model2) {
  mixin(Model2, AxisModelCommonMixin);
}
function createTextStyle(textStyleModel, opts) {
  opts = opts || {};
  return createTextStyle$1(textStyleModel, null, null, opts.state !== "normal");
}
const helper = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createDimensions,
  createList,
  createScale,
  createSymbol,
  createTextStyle,
  dataStack,
  enableHoverEmphasis,
  getECData,
  getLayoutRect,
  mixinAxisModelCommonMethods
}, Symbol.toStringTag, { value: "Module" }));
var EPSILON = 1e-8;
function isAroundEqual(a2, b3) {
  return Math.abs(a2 - b3) < EPSILON;
}
function contain(points, x2, y3) {
  var w2 = 0;
  var p2 = points[0];
  if (!p2) {
    return false;
  }
  for (var i2 = 1; i2 < points.length; i2++) {
    var p22 = points[i2];
    w2 += windingLine(p2[0], p2[1], p22[0], p22[1], x2, y3);
    p2 = p22;
  }
  var p0 = points[0];
  if (!isAroundEqual(p2[0], p0[0]) || !isAroundEqual(p2[1], p0[1])) {
    w2 += windingLine(p2[0], p2[1], p0[0], p0[1], x2, y3);
  }
  return w2 !== 0;
}
var TMP_TRANSFORM = [];
function transformPoints(points, transform) {
  for (var p2 = 0; p2 < points.length; p2++) {
    applyTransform(points[p2], points[p2], transform);
  }
}
function updateBBoxFromPoints(points, min$1, max$1, projection) {
  for (var i2 = 0; i2 < points.length; i2++) {
    var p2 = points[i2];
    if (projection) {
      p2 = projection.project(p2);
    }
    if (p2 && isFinite(p2[0]) && isFinite(p2[1])) {
      min(min$1, min$1, p2);
      max(max$1, max$1, p2);
    }
  }
}
function centroid(points) {
  var signedArea = 0;
  var cx = 0;
  var cy = 0;
  var len = points.length;
  var x0 = points[len - 1][0];
  var y0 = points[len - 1][1];
  for (var i2 = 0; i2 < len; i2++) {
    var x1 = points[i2][0];
    var y1 = points[i2][1];
    var a2 = x0 * y1 - x1 * y0;
    signedArea += a2;
    cx += (x0 + x1) * a2;
    cy += (y0 + y1) * a2;
    x0 = x1;
    y0 = y1;
  }
  return signedArea ? [cx / signedArea / 3, cy / signedArea / 3, signedArea] : [points[0][0] || 0, points[0][1] || 0];
}
var Region = (
  /** @class */
  function() {
    function Region2(name) {
      this.name = name;
    }
    Region2.prototype.setCenter = function(center) {
      this._center = center;
    };
    Region2.prototype.getCenter = function() {
      var center = this._center;
      if (!center) {
        center = this._center = this.calcCenter();
      }
      return center;
    };
    return Region2;
  }()
);
var GeoJSONPolygonGeometry = (
  /** @class */
  /* @__PURE__ */ function() {
    function GeoJSONPolygonGeometry2(exterior, interiors) {
      this.type = "polygon";
      this.exterior = exterior;
      this.interiors = interiors;
    }
    return GeoJSONPolygonGeometry2;
  }()
);
var GeoJSONLineStringGeometry = (
  /** @class */
  /* @__PURE__ */ function() {
    function GeoJSONLineStringGeometry2(points) {
      this.type = "linestring";
      this.points = points;
    }
    return GeoJSONLineStringGeometry2;
  }()
);
var GeoJSONRegion = (
  /** @class */
  function(_super) {
    __extends(GeoJSONRegion2, _super);
    function GeoJSONRegion2(name, geometries, cp) {
      var _this = _super.call(this, name) || this;
      _this.type = "geoJSON";
      _this.geometries = geometries;
      _this._center = cp && [cp[0], cp[1]];
      return _this;
    }
    GeoJSONRegion2.prototype.calcCenter = function() {
      var geometries = this.geometries;
      var largestGeo;
      var largestGeoSize = 0;
      for (var i2 = 0; i2 < geometries.length; i2++) {
        var geo = geometries[i2];
        var exterior = geo.exterior;
        var size = exterior && exterior.length;
        if (size > largestGeoSize) {
          largestGeo = geo;
          largestGeoSize = size;
        }
      }
      if (largestGeo) {
        return centroid(largestGeo.exterior);
      }
      var rect = this.getBoundingRect();
      return [rect.x + rect.width / 2, rect.y + rect.height / 2];
    };
    GeoJSONRegion2.prototype.getBoundingRect = function(projection) {
      var rect = this._rect;
      if (rect && !projection) {
        return rect;
      }
      var min2 = [Infinity, Infinity];
      var max2 = [-Infinity, -Infinity];
      var geometries = this.geometries;
      each(geometries, function(geo) {
        if (geo.type === "polygon") {
          updateBBoxFromPoints(geo.exterior, min2, max2, projection);
        } else {
          each(geo.points, function(points) {
            updateBBoxFromPoints(points, min2, max2, projection);
          });
        }
      });
      if (!(isFinite(min2[0]) && isFinite(min2[1]) && isFinite(max2[0]) && isFinite(max2[1]))) {
        min2[0] = min2[1] = max2[0] = max2[1] = 0;
      }
      rect = new BoundingRect(min2[0], min2[1], max2[0] - min2[0], max2[1] - min2[1]);
      if (!projection) {
        this._rect = rect;
      }
      return rect;
    };
    GeoJSONRegion2.prototype.contain = function(coord) {
      var rect = this.getBoundingRect();
      var geometries = this.geometries;
      if (!rect.contain(coord[0], coord[1])) {
        return false;
      }
      loopGeo: for (var i2 = 0, len = geometries.length; i2 < len; i2++) {
        var geo = geometries[i2];
        if (geo.type !== "polygon") {
          continue;
        }
        var exterior = geo.exterior;
        var interiors = geo.interiors;
        if (contain(exterior, coord[0], coord[1])) {
          for (var k2 = 0; k2 < (interiors ? interiors.length : 0); k2++) {
            if (contain(interiors[k2], coord[0], coord[1])) {
              continue loopGeo;
            }
          }
          return true;
        }
      }
      return false;
    };
    GeoJSONRegion2.prototype.transformTo = function(x2, y3, width, height) {
      var rect = this.getBoundingRect();
      var aspect = rect.width / rect.height;
      if (!width) {
        width = aspect * height;
      } else if (!height) {
        height = width / aspect;
      }
      var target = new BoundingRect(x2, y3, width, height);
      var transform = rect.calculateTransform(target);
      var geometries = this.geometries;
      for (var i2 = 0; i2 < geometries.length; i2++) {
        var geo = geometries[i2];
        if (geo.type === "polygon") {
          transformPoints(geo.exterior, transform);
          each(geo.interiors, function(interior) {
            transformPoints(interior, transform);
          });
        } else {
          each(geo.points, function(points) {
            transformPoints(points, transform);
          });
        }
      }
      rect = this._rect;
      rect.copy(target);
      this._center = [rect.x + rect.width / 2, rect.y + rect.height / 2];
    };
    GeoJSONRegion2.prototype.cloneShallow = function(name) {
      name == null && (name = this.name);
      var newRegion = new GeoJSONRegion2(name, this.geometries, this._center);
      newRegion._rect = this._rect;
      newRegion.transformTo = null;
      return newRegion;
    };
    return GeoJSONRegion2;
  }(Region)
);
(function(_super) {
  __extends(GeoSVGRegion, _super);
  function GeoSVGRegion(name, elOnlyForCalculate) {
    var _this = _super.call(this, name) || this;
    _this.type = "geoSVG";
    _this._elOnlyForCalculate = elOnlyForCalculate;
    return _this;
  }
  GeoSVGRegion.prototype.calcCenter = function() {
    var el = this._elOnlyForCalculate;
    var rect = el.getBoundingRect();
    var center = [rect.x + rect.width / 2, rect.y + rect.height / 2];
    var mat = identity(TMP_TRANSFORM);
    var target = el;
    while (target && !target.isGeoSVGGraphicRoot) {
      mul(mat, target.getLocalTransform(), mat);
      target = target.parent;
    }
    invert(mat, mat);
    applyTransform(center, center, mat);
    return center;
  };
  return GeoSVGRegion;
})(Region);
function decode(json) {
  if (!json.UTF8Encoding) {
    return json;
  }
  var jsonCompressed = json;
  var encodeScale = jsonCompressed.UTF8Scale;
  if (encodeScale == null) {
    encodeScale = 1024;
  }
  var features = jsonCompressed.features;
  each(features, function(feature) {
    var geometry = feature.geometry;
    var encodeOffsets = geometry.encodeOffsets;
    var coordinates = geometry.coordinates;
    if (!encodeOffsets) {
      return;
    }
    switch (geometry.type) {
      case "LineString":
        geometry.coordinates = decodeRing(coordinates, encodeOffsets, encodeScale);
        break;
      case "Polygon":
        decodeRings(coordinates, encodeOffsets, encodeScale);
        break;
      case "MultiLineString":
        decodeRings(coordinates, encodeOffsets, encodeScale);
        break;
      case "MultiPolygon":
        each(coordinates, function(rings, idx) {
          return decodeRings(rings, encodeOffsets[idx], encodeScale);
        });
    }
  });
  jsonCompressed.UTF8Encoding = false;
  return jsonCompressed;
}
function decodeRings(rings, encodeOffsets, encodeScale) {
  for (var c = 0; c < rings.length; c++) {
    rings[c] = decodeRing(rings[c], encodeOffsets[c], encodeScale);
  }
}
function decodeRing(coordinate, encodeOffsets, encodeScale) {
  var result = [];
  var prevX = encodeOffsets[0];
  var prevY = encodeOffsets[1];
  for (var i2 = 0; i2 < coordinate.length; i2 += 2) {
    var x2 = coordinate.charCodeAt(i2) - 64;
    var y3 = coordinate.charCodeAt(i2 + 1) - 64;
    x2 = x2 >> 1 ^ -(x2 & 1);
    y3 = y3 >> 1 ^ -(y3 & 1);
    x2 += prevX;
    y3 += prevY;
    prevX = x2;
    prevY = y3;
    result.push([x2 / encodeScale, y3 / encodeScale]);
  }
  return result;
}
function parseGeoJSON(geoJson, nameProperty) {
  geoJson = decode(geoJson);
  return map(filter(geoJson.features, function(featureObj) {
    return featureObj.geometry && featureObj.properties && featureObj.geometry.coordinates.length > 0;
  }), function(featureObj) {
    var properties = featureObj.properties;
    var geo = featureObj.geometry;
    var geometries = [];
    switch (geo.type) {
      case "Polygon":
        var coordinates = geo.coordinates;
        geometries.push(new GeoJSONPolygonGeometry(coordinates[0], coordinates.slice(1)));
        break;
      case "MultiPolygon":
        each(geo.coordinates, function(item) {
          if (item[0]) {
            geometries.push(new GeoJSONPolygonGeometry(item[0], item.slice(1)));
          }
        });
        break;
      case "LineString":
        geometries.push(new GeoJSONLineStringGeometry([geo.coordinates]));
        break;
      case "MultiLineString":
        geometries.push(new GeoJSONLineStringGeometry(geo.coordinates));
    }
    var region = new GeoJSONRegion(properties[nameProperty || "name"], geometries, properties.cp);
    region.properties = properties;
    return region;
  });
}
const number = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  MAX_SAFE_INTEGER,
  asc,
  getPercentWithPrecision,
  getPixelPrecision,
  getPrecision,
  getPrecisionSafe,
  isNumeric,
  isRadianAroundZero,
  linearMap,
  nice,
  numericToNumber,
  parseDate,
  quantile,
  quantity,
  quantityExponent,
  reformIntervals,
  remRadian,
  round
}, Symbol.toStringTag, { value: "Module" }));
const time = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  format: format$1,
  parse: parseDate
}, Symbol.toStringTag, { value: "Module" }));
const graphic = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Arc,
  BezierCurve,
  BoundingRect,
  Circle,
  CompoundPath,
  Ellipse,
  Group,
  Image: ZRImage,
  IncrementalDisplayable,
  Line,
  LinearGradient,
  Polygon,
  Polyline,
  RadialGradient,
  Rect,
  Ring,
  Sector,
  Text: ZRText,
  clipPointsByRect,
  clipRectByRect,
  createIcon,
  extendPath,
  extendShape,
  getShapeClass,
  getTransform,
  initProps,
  makeImage,
  makePath,
  mergePath,
  registerShape,
  resizePath,
  updateProps
}, Symbol.toStringTag, { value: "Module" }));
const format = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  addCommas,
  capitalFirst,
  encodeHTML,
  formatTime,
  formatTpl,
  getTextRect,
  getTooltipMarker,
  normalizeCssArray,
  toCamelCase,
  truncateText
}, Symbol.toStringTag, { value: "Module" }));
const util = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  bind,
  clone,
  curry,
  defaults,
  each,
  extend,
  filter,
  indexOf,
  inherits,
  isArray,
  isFunction,
  isObject,
  isString,
  map,
  merge,
  reduce
}, Symbol.toStringTag, { value: "Module" }));
function extendComponentModel(proto) {
  var Model2 = ComponentModel.extend(proto);
  ComponentModel.registerClass(Model2);
  return Model2;
}
function extendComponentView(proto) {
  var View = ComponentView.extend(proto);
  ComponentView.registerClass(View);
  return View;
}
function extendSeriesModel(proto) {
  var Model2 = SeriesModel.extend(proto);
  SeriesModel.registerClass(Model2);
  return Model2;
}
function extendChartView(proto) {
  var View = ChartView.extend(proto);
  ChartView.registerClass(View);
  return View;
}
export {
  a as Axis,
  ChartView,
  ComponentModel,
  ComponentView,
  S as List,
  Model,
  P as PRIORITY,
  SeriesModel,
  y2 as color,
  b as connect,
  d as dataTool,
  e as dependencies,
  f as disConnect,
  g as disconnect,
  h as dispose,
  z2 as env,
  extendChartView,
  extendComponentModel,
  extendComponentView,
  extendSeriesModel,
  format,
  i as getCoordinateSystemDimensions,
  j as getInstanceByDom,
  k as getInstanceById,
  l as getMap,
  graphic,
  helper,
  m as init,
  b2 as innerDrawElementOnCanvas,
  A as matrix,
  number,
  parseGeoJSON,
  parseGeoJSON as parseGeoJson,
  r as registerAction,
  o as registerCoordinateSystem,
  p as registerLayout,
  q as registerLoading,
  ag as registerLocale,
  s as registerMap,
  t as registerPostInit,
  u as registerPostUpdate,
  v as registerPreprocessor,
  w as registerProcessor,
  x as registerTheme,
  y as registerTransform,
  z as registerUpdateLifecycle,
  B as registerVisual,
  D as setCanvasCreator,
  C as setPlatformAPI,
  ah as throttle,
  time,
  E as use,
  util,
  D2 as vector,
  F as version,
  E2 as zrUtil,
  G as zrender
};
