import { g as getStackedDimension, e as enableDataStack, i as isDimensionStacked, c as createScaleByModel, n as niceScaleExtent, a as createTextStyle$1, M as Model, A as AxisModelCommonMixin, b as createSymbol, d as enableHoverEmphasis, f as getECData, h as getLayoutRect, j as MAX_SAFE_INTEGER, k as asc, l as getPercentWithPrecision, m as getPixelPrecision, o as getPrecision, p as getPrecisionSafe, q as isNumeric, r as isRadianAroundZero, s as linearMap, t as nice, u as numericToNumber, v as parseDate, w as quantile, x as quantity, y as quantityExponent, z as reformIntervals, B as remRadian, C as round, D as format$1, E as Arc, F as BezierCurve, G as Circle, H as Ellipse, I as IncrementalDisplayable, L as Line, J as LinearGradient, P as Polygon, K as Polyline, R as RadialGradient, N as Ring, S as Sector, O as clipPointsByRect, Q as clipRectByRect, T as createIcon, U as extendPath, V as extendShape, W as getShapeClass, X as getTransform, Y as initProps, Z as makeImage, _ as makePath, $ as mergePath, a0 as registerShape, a1 as resizePath, a2 as updateProps, a3 as addCommas, a4 as capitalFirst, a5 as formatTime, a6 as formatTpl, a7 as getTooltipMarker, a8 as normalizeCssArray, a9 as toCamelCase, aa as ChartView, ab as ComponentModel, ac as ComponentView, ad as SeriesModel } from "./Axis-DJa7LvDr.js";
import { ae, af, ag, ah, ai, aj, ak, al, am, an, ao, ap, aq, ar, as, as as as2, at, au, av, aw, ax, ay, az, aA, aB, aC, aD, aE, aF, aG, aH, aI, aJ, aK } from "./Axis-DJa7LvDr.js";
import { Z as ZRText, m as mixin, B as BoundingRect, C as CompoundPath, G as Group, a as ZRImage, R as Rect, e as encodeHTML, t as truncateText, b as bind, c as clone, d as curry, f as defaults, g as each, h as extend, i as filter, j as indexOf, k as inherits, l as isArray, n as isFunction, o as isObject, p as isString, q as map, r as merge, s as reduce } from "./graphic-ClH5Uwd8.js";
import { u, v, w, x, y, z, A, D } from "./graphic-ClH5Uwd8.js";
import { c as createSeriesData, a as createDimensions } from "./createSeriesData-Du5qr83X.js";
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
  ae as Axis,
  ChartView,
  ComponentModel,
  ComponentView,
  af as List,
  Model,
  ag as PRIORITY,
  SeriesModel,
  u as color,
  ah as connect,
  ai as dataTool,
  aj as dependencies,
  ak as disConnect,
  al as disconnect,
  am as dispose,
  v as env,
  extendChartView,
  extendComponentModel,
  extendComponentView,
  extendSeriesModel,
  format,
  an as getCoordinateSystemDimensions,
  ao as getInstanceByDom,
  ap as getInstanceById,
  aq as getMap,
  graphic,
  helper,
  ar as init,
  w as innerDrawElementOnCanvas,
  x as matrix,
  number,
  as as parseGeoJSON,
  as2 as parseGeoJson,
  at as registerAction,
  au as registerCoordinateSystem,
  av as registerLayout,
  aw as registerLoading,
  ax as registerLocale,
  ay as registerMap,
  az as registerPostInit,
  aA as registerPostUpdate,
  aB as registerPreprocessor,
  aC as registerProcessor,
  aD as registerTheme,
  aE as registerTransform,
  aF as registerUpdateLifecycle,
  aG as registerVisual,
  aH as setCanvasCreator,
  y as setPlatformAPI,
  aI as throttle,
  time,
  aJ as use,
  util,
  z as vector,
  aK as version,
  A as zrUtil,
  D as zrender
};
