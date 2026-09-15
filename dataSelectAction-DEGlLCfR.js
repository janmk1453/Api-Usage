import { $ as scale, $t as retrieve3, A as copyTransform, At as indexOf, B as parsePercent$1, Bt as isString, C as cubicDerivativeAt, Ct as each$1, D as quadraticDerivativeAt, E as quadraticAt, Et as filter, Ft as isFunction, G as applyTransform$1, Gt as map, H as createIntersectContext, Ht as isTypedArray, I as adjustTextX, J as distance, Jt as noop, K as clone, Kt as merge, L as adjustTextY, M as parsePlainText, Mt as isArray, N as parseRichText, Nt as isArrayLike, O as quadraticSubdivide, P as tSpanCreateBoundingRect2, Q as normalize, Qt as retrieve2, R as calculateTextPosition, Rt as isNumber, S as cubicAt, T as cubicSubdivide, Tt as extend, U as Point, Ut as keys, V as BoundingRect, Vt as isStringSafe, W as add, X as max, Xt as reduce, Yt as normalizeCssArray$1, Z as min, _ as liftColor, _t as clone$1, a as PathProxy, at as invert, bt as curry, cn as __exportAll, et as sub, gt as bind, ht as assert, it as identity, j as calcInnerTextOverflowArea, jt as inherits, k as Transformable, kt as hasOwn, l as Displayable, n as TSpan, nn as trim, nt as copy, pt as env, qt as mixin, r as Path, rt as create, s as DEFAULT_COMMON_ANIMATION_PROPS, sn as __extends, st as mul, t as ZRImage, u as Element, vt as concatArray, wt as eqNaN, xt as defaults, y as modifyHSL, yt as createHashMap, z as getBoundingRect, zt as isObject } from "./Image-B5UjBJH1.js";
//#region node_modules/echarts/lib/util/clazz.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var TYPE_DELIMITER = ".";
var IS_CONTAINER = "___EC__COMPONENT__CONTAINER___";
var IS_EXTENDED_CLASS = "___EC__EXTENDED_CLASS___";
/**
* Notice, parseClassType('') should returns {main: '', sub: ''}
* @public
*/
function parseClassType(componentType) {
	var ret = {
		main: "",
		sub: ""
	};
	if (componentType) {
		var typeArr = componentType.split(TYPE_DELIMITER);
		ret.main = typeArr[0] || "";
		ret.sub = typeArr[1] || "";
	}
	return ret;
}
/**
* @public
*/
function checkClassType(componentType) {
	assert(/^[a-zA-Z0-9_]+([.][a-zA-Z0-9_]+)?$/.test(componentType), "componentType \"" + componentType + "\" illegal");
}
function isExtendedClass(clz) {
	return !!(clz && clz[IS_EXTENDED_CLASS]);
}
/**
* Implements `ExtendableConstructor` for `rootClz`.
*
* @usage
* ```ts
* class Xxx {}
* type XxxConstructor = typeof Xxx & ExtendableConstructor
* enableClassExtend(Xxx as XxxConstructor);
* ```
*/
function enableClassExtend(rootClz, mandatoryMethods) {
	rootClz.$constructor = rootClz;
	rootClz.extend = function(proto) {
		var superClass = this;
		var ExtendedClass;
		if (isESClass(superClass)) ExtendedClass = function(_super) {
			__extends(class_1, _super);
			function class_1() {
				return _super.apply(this, arguments) || this;
			}
			return class_1;
		}(superClass);
		else {
			ExtendedClass = function() {
				(proto.$constructor || superClass).apply(this, arguments);
			};
			inherits(ExtendedClass, this);
		}
		extend(ExtendedClass.prototype, proto);
		ExtendedClass[IS_EXTENDED_CLASS] = true;
		ExtendedClass.extend = this.extend;
		ExtendedClass.superCall = superCall;
		ExtendedClass.superApply = superApply;
		ExtendedClass.superClass = superClass;
		return ExtendedClass;
	};
}
function isESClass(fn) {
	return isFunction(fn) && /^class\s/.test(Function.prototype.toString.call(fn));
}
/**
* A work around to both support ts extend and this extend mechanism.
* on sub-class.
* @usage
* ```ts
* class Component { ... }
* classUtil.enableClassExtend(Component);
* classUtil.enableClassManagement(Component, {registerWhenExtend: true});
*
* class Series extends Component { ... }
* // Without calling `markExtend`, `registerWhenExtend` will not work.
* Component.markExtend(Series);
* ```
*/
function mountExtend(SubClz, SupperClz) {
	SubClz.extend = SupperClz.extend;
}
var classBase = Math.round(Math.random() * 10);
/**
* Implements `CheckableConstructor` for `target`.
* Can not use instanceof, consider different scope by
* cross domain or es module import in ec extensions.
* Mount a method "isInstance()" to Clz.
*
* @usage
* ```ts
* class Xxx {}
* type XxxConstructor = typeof Xxx & CheckableConstructor;
* enableClassCheck(Xxx as XxxConstructor)
* ```
*/
function enableClassCheck(target) {
	var classAttr = ["__\0is_clz", classBase++].join("_");
	target.prototype[classAttr] = true;
	target.isInstance = function(obj) {
		return !!(obj && obj[classAttr]);
	};
}
function superCall(context, methodName) {
	var args = [];
	for (var _i = 2; _i < arguments.length; _i++) args[_i - 2] = arguments[_i];
	return this.superClass.prototype[methodName].apply(context, args);
}
function superApply(context, methodName, args) {
	return this.superClass.prototype[methodName].apply(context, args);
}
/**
* Implements `ClassManager` for `target`
*
* @usage
* ```ts
* class Xxx {}
* type XxxConstructor = typeof Xxx & ClassManager
* enableClassManagement(Xxx as XxxConstructor);
* ```
*/
function enableClassManagement(target) {
	/**
	* Component model classes
	* key: componentType,
	* value:
	*     componentClass, when componentType is 'a'
	*     or Object.<subKey, componentClass>, when componentType is 'a.b'
	*/
	var storage = {};
	target.registerClass = function(clz) {
		var componentFullType = clz.type || clz.prototype.type;
		if (componentFullType) {
			checkClassType(componentFullType);
			clz.prototype.type = componentFullType;
			var componentTypeInfo = parseClassType(componentFullType);
			if (!componentTypeInfo.sub) storage[componentTypeInfo.main] = clz;
			else if (componentTypeInfo.sub !== IS_CONTAINER) {
				var container = makeContainer(componentTypeInfo);
				container[componentTypeInfo.sub] = clz;
			}
		}
		return clz;
	};
	target.getClass = function(mainType, subType, throwWhenNotFound) {
		var clz = storage[mainType];
		if (clz && clz[IS_CONTAINER]) clz = subType ? clz[subType] : null;
		if (throwWhenNotFound && !clz) throw new Error(!subType ? mainType + ".type should be specified." : "Component " + mainType + "." + (subType || "") + " is used but not imported.");
		return clz;
	};
	target.getClassesByMainType = function(componentType) {
		var componentTypeInfo = parseClassType(componentType);
		var result = [];
		var obj = storage[componentTypeInfo.main];
		if (obj && obj[IS_CONTAINER]) each$1(obj, function(o, type) {
			type !== IS_CONTAINER && result.push(o);
		});
		else result.push(obj);
		return result;
	};
	target.hasClass = function(componentType) {
		return !!storage[parseClassType(componentType).main];
	};
	/**
	* @return Like ['aa', 'bb'], but can not be ['aa.xx']
	*/
	target.getAllClassMainTypes = function() {
		var types = [];
		each$1(storage, function(obj, type) {
			types.push(type);
		});
		return types;
	};
	/**
	* If a main type is container and has sub types
	*/
	target.hasSubTypes = function(componentType) {
		var obj = storage[parseClassType(componentType).main];
		return obj && obj[IS_CONTAINER];
	};
	function makeContainer(componentTypeInfo) {
		var container = storage[componentTypeInfo.main];
		if (!container || !container[IS_CONTAINER]) {
			container = storage[componentTypeInfo.main] = {};
			container[IS_CONTAINER] = true;
		}
		return container;
	}
}
//#endregion
//#region node_modules/echarts/lib/model/mixin/makeStyleMapper.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function makeStyleMapper(properties, ignoreParent) {
	for (var i = 0; i < properties.length; i++) if (!properties[i][1]) properties[i][1] = properties[i][0];
	ignoreParent = ignoreParent || false;
	return function(model, excludes, includes) {
		var style = {};
		for (var i = 0; i < properties.length; i++) {
			var propName = properties[i][1];
			if (excludes && indexOf(excludes, propName) >= 0 || includes && indexOf(includes, propName) < 0) continue;
			var val = model.getShallow(propName, ignoreParent);
			if (val != null) style[properties[i][0]] = val;
		}
		return style;
	};
}
var getAreaStyle = makeStyleMapper([
	["fill", "color"],
	["shadowBlur"],
	["shadowOffsetX"],
	["shadowOffsetY"],
	["opacity"],
	["shadowColor"]
]);
var AreaStyleMixin = function() {
	function AreaStyleMixin() {}
	AreaStyleMixin.prototype.getAreaStyle = function(excludes, includes) {
		return getAreaStyle(this, excludes, includes);
	};
	return AreaStyleMixin;
}();
//#endregion
//#region node_modules/zrender/lib/graphic/helper/roundRect.js
function buildPath$2(ctx, shape) {
	var x = shape.x;
	var y = shape.y;
	var width = shape.width;
	var height = shape.height;
	var r = shape.r;
	var r1;
	var r2;
	var r3;
	var r4;
	if (width < 0) {
		x = x + width;
		width = -width;
	}
	if (height < 0) {
		y = y + height;
		height = -height;
	}
	if (typeof r === "number") r1 = r2 = r3 = r4 = r;
	else if (r instanceof Array) {
		if (r.length === 1) r1 = r2 = r3 = r4 = r[0];
		else if (r.length === 2) {
			r1 = r3 = r[0];
			r2 = r4 = r[1];
		} else if (r.length === 3) {
			r1 = r[0];
			r2 = r4 = r[1];
			r3 = r[2];
		} else {
			r1 = r[0];
			r2 = r[1];
			r3 = r[2];
			r4 = r[3];
		}
	} else r1 = r2 = r3 = r4 = 0;
	var total;
	if (r1 + r2 > width) {
		total = r1 + r2;
		r1 *= width / total;
		r2 *= width / total;
	}
	if (r3 + r4 > width) {
		total = r3 + r4;
		r3 *= width / total;
		r4 *= width / total;
	}
	if (r2 + r3 > height) {
		total = r2 + r3;
		r2 *= height / total;
		r3 *= height / total;
	}
	if (r1 + r4 > height) {
		total = r1 + r4;
		r1 *= height / total;
		r4 *= height / total;
	}
	ctx.moveTo(x + r1, y);
	ctx.lineTo(x + width - r2, y);
	r2 !== 0 && ctx.arc(x + width - r2, y + r2, r2, -Math.PI / 2, 0);
	ctx.lineTo(x + width, y + height - r3);
	r3 !== 0 && ctx.arc(x + width - r3, y + height - r3, r3, 0, Math.PI / 2);
	ctx.lineTo(x + r4, y + height);
	r4 !== 0 && ctx.arc(x + r4, y + height - r4, r4, Math.PI / 2, Math.PI);
	ctx.lineTo(x, y + r1);
	r1 !== 0 && ctx.arc(x + r1, y + r1, r1, Math.PI, Math.PI * 1.5);
	ctx.closePath();
}
//#endregion
//#region node_modules/zrender/lib/graphic/helper/subPixelOptimize.js
var round$1 = Math.round;
function subPixelOptimizeLine$1(outputShape, inputShape, style) {
	if (!inputShape) return;
	var x1 = inputShape.x1;
	var x2 = inputShape.x2;
	var y1 = inputShape.y1;
	var y2 = inputShape.y2;
	outputShape.x1 = x1;
	outputShape.x2 = x2;
	outputShape.y1 = y1;
	outputShape.y2 = y2;
	var lineWidth = style && style.lineWidth;
	if (!lineWidth) return outputShape;
	if (round$1(x1 * 2) === round$1(x2 * 2)) outputShape.x1 = outputShape.x2 = subPixelOptimize$1(x1, lineWidth, true);
	if (round$1(y1 * 2) === round$1(y2 * 2)) outputShape.y1 = outputShape.y2 = subPixelOptimize$1(y1, lineWidth, true);
	return outputShape;
}
function subPixelOptimizeRect$1(outputShape, inputShape, style) {
	if (!inputShape) return;
	var originX = inputShape.x;
	var originY = inputShape.y;
	var originWidth = inputShape.width;
	var originHeight = inputShape.height;
	outputShape.x = originX;
	outputShape.y = originY;
	outputShape.width = originWidth;
	outputShape.height = originHeight;
	var lineWidth = style && style.lineWidth;
	if (!lineWidth) return outputShape;
	outputShape.x = subPixelOptimize$1(originX, lineWidth, true);
	outputShape.y = subPixelOptimize$1(originY, lineWidth, true);
	outputShape.width = Math.max(subPixelOptimize$1(originX + originWidth, lineWidth, false) - outputShape.x, originWidth === 0 ? 0 : 1);
	outputShape.height = Math.max(subPixelOptimize$1(originY + originHeight, lineWidth, false) - outputShape.y, originHeight === 0 ? 0 : 1);
	return outputShape;
}
function subPixelOptimize$1(position, lineWidth, positiveOrNegative) {
	if (!lineWidth) return position;
	var doubledPosition = round$1(position * 2);
	return (doubledPosition + round$1(lineWidth)) % 2 === 0 ? doubledPosition / 2 : (doubledPosition + (positiveOrNegative ? 1 : -1)) / 2;
}
//#endregion
//#region node_modules/zrender/lib/graphic/shape/Rect.js
var RectShape = function() {
	function RectShape() {
		this.x = 0;
		this.y = 0;
		this.width = 0;
		this.height = 0;
	}
	return RectShape;
}();
var subPixelOptimizeOutputShape$1 = {};
var Rect = function(_super) {
	__extends(Rect, _super);
	function Rect(opts) {
		return _super.call(this, opts) || this;
	}
	Rect.prototype.getDefaultShape = function() {
		return new RectShape();
	};
	Rect.prototype.buildPath = function(ctx, shape) {
		var x;
		var y;
		var width;
		var height;
		if (this.subPixelOptimize) {
			var optimizedShape = subPixelOptimizeRect$1(subPixelOptimizeOutputShape$1, shape, this.style);
			x = optimizedShape.x;
			y = optimizedShape.y;
			width = optimizedShape.width;
			height = optimizedShape.height;
			optimizedShape.r = shape.r;
			shape = optimizedShape;
		} else {
			x = shape.x;
			y = shape.y;
			width = shape.width;
			height = shape.height;
		}
		if (!shape.r) ctx.rect(x, y, width, height);
		else buildPath$2(ctx, shape);
	};
	Rect.prototype.isZeroArea = function() {
		return !this.shape.width || !this.shape.height;
	};
	return Rect;
}(Path);
Rect.prototype.type = "rect";
//#endregion
//#region node_modules/zrender/lib/graphic/Text.js
var DEFAULT_RICH_TEXT_COLOR = { fill: "#000" };
var DEFAULT_STROKE_LINE_WIDTH = 2;
var tmpCITOverflowAreaOut = {};
var DEFAULT_TEXT_ANIMATION_PROPS = { style: defaults({
	fill: true,
	stroke: true,
	fillOpacity: true,
	strokeOpacity: true,
	lineWidth: true,
	fontSize: true,
	lineHeight: true,
	width: true,
	height: true,
	textShadowColor: true,
	textShadowBlur: true,
	textShadowOffsetX: true,
	textShadowOffsetY: true,
	backgroundColor: true,
	padding: true,
	borderColor: true,
	borderWidth: true,
	borderRadius: true
}, DEFAULT_COMMON_ANIMATION_PROPS.style) };
var ZRText = function(_super) {
	__extends(ZRText, _super);
	function ZRText(opts) {
		var _this = _super.call(this) || this;
		_this.type = "text";
		_this._children = [];
		_this._defaultStyle = DEFAULT_RICH_TEXT_COLOR;
		_this.attr(opts);
		return _this;
	}
	ZRText.prototype.childrenRef = function() {
		return this._children;
	};
	ZRText.prototype.update = function() {
		_super.prototype.update.call(this);
		if (this.styleChanged()) this._updateSubTexts();
		for (var i = 0; i < this._children.length; i++) {
			var child = this._children[i];
			child.zlevel = this.zlevel;
			child.z = this.z;
			child.z2 = this.z2;
			child.culling = this.culling;
			child.cursor = this.cursor;
			child.invisible = this.invisible;
		}
	};
	ZRText.prototype.updateTransform = function() {
		var innerTransformable = this.innerTransformable;
		if (innerTransformable) {
			innerTransformable.updateTransform();
			if (innerTransformable.transform) this.transform = innerTransformable.transform;
		} else _super.prototype.updateTransform.call(this);
	};
	ZRText.prototype.getLocalTransform = function(m) {
		var innerTransformable = this.innerTransformable;
		return innerTransformable ? innerTransformable.getLocalTransform(m) : _super.prototype.getLocalTransform.call(this, m);
	};
	ZRText.prototype.getComputedTransform = function() {
		if (this.__hostTarget) {
			this.__hostTarget.getComputedTransform();
			this.__hostTarget.updateInnerText(true);
		}
		return _super.prototype.getComputedTransform.call(this);
	};
	ZRText.prototype._updateSubTexts = function() {
		this._childCursor = 0;
		normalizeTextStyle(this.style);
		this.style.rich ? this._updateRichTexts() : this._updatePlainTexts();
		this._children.length = this._childCursor;
		this.styleUpdated();
	};
	ZRText.prototype.addSelfToZr = function(zr) {
		_super.prototype.addSelfToZr.call(this, zr);
		for (var i = 0; i < this._children.length; i++) this._children[i].__zr = zr;
	};
	ZRText.prototype.removeSelfFromZr = function(zr) {
		_super.prototype.removeSelfFromZr.call(this, zr);
		for (var i = 0; i < this._children.length; i++) this._children[i].__zr = null;
	};
	ZRText.prototype.getBoundingRect = function() {
		if (this.styleChanged()) this._updateSubTexts();
		if (!this._rect) {
			var tmpRect = new BoundingRect(0, 0, 0, 0);
			var children = this._children;
			var tmpMat = [];
			var rect = null;
			for (var i = 0; i < children.length; i++) {
				var child = children[i];
				var childRect = child.getBoundingRect();
				var transform = child.getLocalTransform(tmpMat);
				if (transform) {
					tmpRect.copy(childRect);
					tmpRect.applyTransform(transform);
					rect = rect || tmpRect.clone();
					rect.union(tmpRect);
				} else {
					rect = rect || childRect.clone();
					rect.union(childRect);
				}
			}
			this._rect = rect || tmpRect;
		}
		return this._rect;
	};
	ZRText.prototype.setDefaultTextStyle = function(defaultTextStyle) {
		this._defaultStyle = defaultTextStyle || DEFAULT_RICH_TEXT_COLOR;
	};
	ZRText.prototype.setTextContent = function(textContent) {};
	ZRText.prototype._mergeStyle = function(targetStyle, sourceStyle) {
		if (!sourceStyle) return targetStyle;
		var sourceRich = sourceStyle.rich;
		var targetRich = targetStyle.rich || sourceRich && {};
		extend(targetStyle, sourceStyle);
		if (sourceRich && targetRich) {
			this._mergeRich(targetRich, sourceRich);
			targetStyle.rich = targetRich;
		} else if (targetRich) targetStyle.rich = targetRich;
		return targetStyle;
	};
	ZRText.prototype._mergeRich = function(targetRich, sourceRich) {
		var richNames = keys(sourceRich);
		for (var i = 0; i < richNames.length; i++) {
			var richName = richNames[i];
			targetRich[richName] = targetRich[richName] || {};
			extend(targetRich[richName], sourceRich[richName]);
		}
	};
	ZRText.prototype.getAnimationStyleProps = function() {
		return DEFAULT_TEXT_ANIMATION_PROPS;
	};
	ZRText.prototype._getOrCreateChild = function(Ctor) {
		var child = this._children[this._childCursor];
		if (!child || !(child instanceof Ctor)) child = new Ctor();
		this._children[this._childCursor++] = child;
		child.__zr = this.__zr;
		child.parent = this;
		return child;
	};
	ZRText.prototype._updatePlainTexts = function() {
		var style = this.style;
		var textFont = style.font || "12px sans-serif";
		var textPadding = style.padding;
		var defaultStyle = this._defaultStyle;
		var baseX = style.x || 0;
		var baseY = style.y || 0;
		var textAlign = style.align || defaultStyle.align || "left";
		var verticalAlign = style.verticalAlign || defaultStyle.verticalAlign || "top";
		calcInnerTextOverflowArea(tmpCITOverflowAreaOut, defaultStyle.overflowRect, baseX, baseY, textAlign, verticalAlign);
		baseX = tmpCITOverflowAreaOut.baseX;
		baseY = tmpCITOverflowAreaOut.baseY;
		var text = getStyleText(style);
		var contentBlock = parsePlainText(text, style, tmpCITOverflowAreaOut.outerWidth, tmpCITOverflowAreaOut.outerHeight);
		var needDrawBg = needDrawBackground(style);
		var bgColorDrawn = !!style.backgroundColor;
		var outerHeight = contentBlock.outerHeight;
		var outerWidth = contentBlock.outerWidth;
		var textLines = contentBlock.lines;
		var lineHeight = contentBlock.lineHeight;
		this.isTruncated = !!contentBlock.isTruncated;
		var textX = baseX;
		var textY = adjustTextY(baseY, contentBlock.contentHeight, verticalAlign);
		if (needDrawBg || textPadding) {
			var boxX = adjustTextX(baseX, outerWidth, textAlign);
			var boxY = adjustTextY(baseY, outerHeight, verticalAlign);
			needDrawBg && this._renderBackground(style, style, boxX, boxY, outerWidth, outerHeight);
		}
		textY += lineHeight / 2;
		if (textPadding) {
			textX = getTextXForPadding(baseX, textAlign, textPadding);
			if (verticalAlign === "top") textY += textPadding[0];
			else if (verticalAlign === "bottom") textY -= textPadding[2];
		}
		var defaultLineWidth = 0;
		var usingDefaultStroke = false;
		var useDefaultFill = false;
		var textFill = getFill("fill" in style ? style.fill : (useDefaultFill = true, defaultStyle.fill));
		var textStroke = getStroke("stroke" in style ? style.stroke : !bgColorDrawn && (!defaultStyle.autoStroke || useDefaultFill) ? (defaultLineWidth = DEFAULT_STROKE_LINE_WIDTH, usingDefaultStroke = true, defaultStyle.stroke) : null);
		var hasShadow = style.textShadowBlur > 0;
		for (var i = 0; i < textLines.length; i++) {
			var el = this._getOrCreateChild(TSpan);
			var subElStyle = el.createStyle();
			el.useStyle(subElStyle);
			subElStyle.text = textLines[i];
			subElStyle.x = textX;
			subElStyle.y = textY;
			if (textAlign) subElStyle.textAlign = textAlign;
			subElStyle.textBaseline = "middle";
			subElStyle.opacity = style.opacity;
			subElStyle.strokeFirst = true;
			if (hasShadow) {
				subElStyle.shadowBlur = style.textShadowBlur || 0;
				subElStyle.shadowColor = style.textShadowColor || "transparent";
				subElStyle.shadowOffsetX = style.textShadowOffsetX || 0;
				subElStyle.shadowOffsetY = style.textShadowOffsetY || 0;
			}
			subElStyle.stroke = textStroke;
			subElStyle.fill = textFill;
			if (textStroke) {
				subElStyle.lineWidth = style.lineWidth || defaultLineWidth;
				subElStyle.lineDash = style.lineDash;
				subElStyle.lineDashOffset = style.lineDashOffset || 0;
			}
			subElStyle.font = textFont;
			setSeparateFont(subElStyle, style);
			textY += lineHeight;
			el.setBoundingRect(tSpanCreateBoundingRect2(subElStyle, contentBlock.contentWidth, contentBlock.calculatedLineHeight, usingDefaultStroke ? 0 : null));
		}
	};
	ZRText.prototype._updateRichTexts = function() {
		var style = this.style;
		var defaultStyle = this._defaultStyle;
		var textAlign = style.align || defaultStyle.align;
		var verticalAlign = style.verticalAlign || defaultStyle.verticalAlign;
		var baseX = style.x || 0;
		var baseY = style.y || 0;
		calcInnerTextOverflowArea(tmpCITOverflowAreaOut, defaultStyle.overflowRect, baseX, baseY, textAlign, verticalAlign);
		baseX = tmpCITOverflowAreaOut.baseX;
		baseY = tmpCITOverflowAreaOut.baseY;
		var text = getStyleText(style);
		var contentBlock = parseRichText(text, style, tmpCITOverflowAreaOut.outerWidth, tmpCITOverflowAreaOut.outerHeight, textAlign);
		var contentWidth = contentBlock.width;
		var outerWidth = contentBlock.outerWidth;
		var outerHeight = contentBlock.outerHeight;
		var textPadding = style.padding;
		this.isTruncated = !!contentBlock.isTruncated;
		var boxX = adjustTextX(baseX, outerWidth, textAlign);
		var boxY = adjustTextY(baseY, outerHeight, verticalAlign);
		var xLeft = boxX;
		var lineTop = boxY;
		if (textPadding) {
			xLeft += textPadding[3];
			lineTop += textPadding[0];
		}
		var xRight = xLeft + contentWidth;
		if (needDrawBackground(style)) this._renderBackground(style, style, boxX, boxY, outerWidth, outerHeight);
		var bgColorDrawn = !!style.backgroundColor;
		for (var i = 0; i < contentBlock.lines.length; i++) {
			var line = contentBlock.lines[i];
			var tokens = line.tokens;
			var tokenCount = tokens.length;
			var lineHeight = line.lineHeight;
			var remainedWidth = line.width;
			var leftIndex = 0;
			var lineXLeft = xLeft;
			var lineXRight = xRight;
			var rightIndex = tokenCount - 1;
			var token = void 0;
			while (leftIndex < tokenCount && (token = tokens[leftIndex], !token.align || token.align === "left")) {
				this._placeToken(token, style, lineHeight, lineTop, lineXLeft, "left", bgColorDrawn);
				remainedWidth -= token.width;
				lineXLeft += token.width;
				leftIndex++;
			}
			while (rightIndex >= 0 && (token = tokens[rightIndex], token.align === "right")) {
				this._placeToken(token, style, lineHeight, lineTop, lineXRight, "right", bgColorDrawn);
				remainedWidth -= token.width;
				lineXRight -= token.width;
				rightIndex--;
			}
			lineXLeft += (contentWidth - (lineXLeft - xLeft) - (xRight - lineXRight) - remainedWidth) / 2;
			while (leftIndex <= rightIndex) {
				token = tokens[leftIndex];
				this._placeToken(token, style, lineHeight, lineTop, lineXLeft + token.width / 2, "center", bgColorDrawn);
				lineXLeft += token.width;
				leftIndex++;
			}
			lineTop += lineHeight;
		}
	};
	ZRText.prototype._placeToken = function(token, style, lineHeight, lineTop, x, textAlign, parentBgColorDrawn) {
		var tokenStyle = style.rich[token.styleName] || {};
		tokenStyle.text = token.text;
		var verticalAlign = token.verticalAlign;
		var y = lineTop + lineHeight / 2;
		if (verticalAlign === "top") y = lineTop + token.height / 2;
		else if (verticalAlign === "bottom") y = lineTop + lineHeight - token.height / 2;
		!token.isLineHolder && needDrawBackground(tokenStyle) && this._renderBackground(tokenStyle, style, textAlign === "right" ? x - token.width : textAlign === "center" ? x - token.width / 2 : x, y - token.height / 2, token.width, token.height);
		var bgColorDrawn = !!tokenStyle.backgroundColor;
		var textPadding = token.textPadding;
		if (textPadding) {
			x = getTextXForPadding(x, textAlign, textPadding);
			y -= token.height / 2 - textPadding[0] - token.innerHeight / 2;
		}
		var el = this._getOrCreateChild(TSpan);
		var subElStyle = el.createStyle();
		el.useStyle(subElStyle);
		var defaultStyle = this._defaultStyle;
		var useDefaultFill = false;
		var defaultLineWidth = 0;
		var usingDefaultStroke = false;
		var textFill = getFill("fill" in tokenStyle ? tokenStyle.fill : "fill" in style ? style.fill : (useDefaultFill = true, defaultStyle.fill));
		var textStroke = getStroke("stroke" in tokenStyle ? tokenStyle.stroke : "stroke" in style ? style.stroke : !bgColorDrawn && !parentBgColorDrawn && (!defaultStyle.autoStroke || useDefaultFill) ? (defaultLineWidth = DEFAULT_STROKE_LINE_WIDTH, usingDefaultStroke = true, defaultStyle.stroke) : null);
		var hasShadow = tokenStyle.textShadowBlur > 0 || style.textShadowBlur > 0;
		subElStyle.text = token.text;
		subElStyle.x = x;
		subElStyle.y = y;
		if (hasShadow) {
			subElStyle.shadowBlur = tokenStyle.textShadowBlur || style.textShadowBlur || 0;
			subElStyle.shadowColor = tokenStyle.textShadowColor || style.textShadowColor || "transparent";
			subElStyle.shadowOffsetX = tokenStyle.textShadowOffsetX || style.textShadowOffsetX || 0;
			subElStyle.shadowOffsetY = tokenStyle.textShadowOffsetY || style.textShadowOffsetY || 0;
		}
		subElStyle.textAlign = textAlign;
		subElStyle.textBaseline = "middle";
		subElStyle.font = token.font || "12px sans-serif";
		subElStyle.opacity = retrieve3(tokenStyle.opacity, style.opacity, 1);
		setSeparateFont(subElStyle, tokenStyle);
		if (textStroke) {
			subElStyle.lineWidth = retrieve3(tokenStyle.lineWidth, style.lineWidth, defaultLineWidth);
			subElStyle.lineDash = retrieve2(tokenStyle.lineDash, style.lineDash);
			subElStyle.lineDashOffset = style.lineDashOffset || 0;
			subElStyle.stroke = textStroke;
		}
		if (textFill) subElStyle.fill = textFill;
		el.setBoundingRect(tSpanCreateBoundingRect2(subElStyle, token.contentWidth, token.contentHeight, usingDefaultStroke ? 0 : null));
	};
	ZRText.prototype._renderBackground = function(style, topStyle, x, y, width, height) {
		var textBackgroundColor = style.backgroundColor;
		var textBorderWidth = style.borderWidth;
		var textBorderColor = style.borderColor;
		var isImageBg = textBackgroundColor && textBackgroundColor.image;
		var isPlainOrGradientBg = textBackgroundColor && !isImageBg;
		var textBorderRadius = style.borderRadius;
		var self = this;
		var rectEl;
		var imgEl;
		if (isPlainOrGradientBg || style.lineHeight || textBorderWidth && textBorderColor) {
			rectEl = this._getOrCreateChild(Rect);
			rectEl.useStyle(rectEl.createStyle());
			rectEl.style.fill = null;
			var rectShape = rectEl.shape;
			rectShape.x = x;
			rectShape.y = y;
			rectShape.width = width;
			rectShape.height = height;
			rectShape.r = textBorderRadius;
			rectEl.dirtyShape();
		}
		if (isPlainOrGradientBg) {
			var rectStyle = rectEl.style;
			rectStyle.fill = textBackgroundColor || null;
			rectStyle.fillOpacity = retrieve2(style.fillOpacity, 1);
		} else if (isImageBg) {
			imgEl = this._getOrCreateChild(ZRImage);
			imgEl.onload = function() {
				self.dirtyStyle();
			};
			var imgStyle = imgEl.style;
			imgStyle.image = textBackgroundColor.image;
			imgStyle.x = x;
			imgStyle.y = y;
			imgStyle.width = width;
			imgStyle.height = height;
		}
		if (textBorderWidth && textBorderColor) {
			var rectStyle = rectEl.style;
			rectStyle.lineWidth = textBorderWidth;
			rectStyle.stroke = textBorderColor;
			rectStyle.strokeOpacity = retrieve2(style.strokeOpacity, 1);
			rectStyle.lineDash = style.borderDash;
			rectStyle.lineDashOffset = style.borderDashOffset || 0;
			rectEl.strokeContainThreshold = 0;
			if (rectEl.hasFill() && rectEl.hasStroke()) {
				rectStyle.strokeFirst = true;
				rectStyle.lineWidth *= 2;
			}
		}
		var commonStyle = (rectEl || imgEl).style;
		commonStyle.shadowBlur = style.shadowBlur || 0;
		commonStyle.shadowColor = style.shadowColor || "transparent";
		commonStyle.shadowOffsetX = style.shadowOffsetX || 0;
		commonStyle.shadowOffsetY = style.shadowOffsetY || 0;
		commonStyle.opacity = retrieve3(style.opacity, topStyle.opacity, 1);
	};
	ZRText.makeFont = function(style) {
		var font = "";
		if (hasSeparateFont(style)) font = [
			style.fontStyle,
			style.fontWeight,
			parseFontSize(style.fontSize),
			style.fontFamily || "sans-serif"
		].join(" ");
		return font && trim(font) || style.textFont || style.font;
	};
	return ZRText;
}(Displayable);
var VALID_TEXT_ALIGN = {
	left: true,
	right: 1,
	center: 1
};
var VALID_TEXT_VERTICAL_ALIGN = {
	top: 1,
	bottom: 1,
	middle: 1
};
var FONT_PARTS = [
	"fontStyle",
	"fontWeight",
	"fontSize",
	"fontFamily"
];
function parseFontSize(fontSize) {
	if (typeof fontSize === "string" && (fontSize.indexOf("px") !== -1 || fontSize.indexOf("rem") !== -1 || fontSize.indexOf("em") !== -1)) return fontSize;
	else if (!isNaN(+fontSize)) return fontSize + "px";
	else return "12px";
}
function setSeparateFont(targetStyle, sourceStyle) {
	for (var i = 0; i < FONT_PARTS.length; i++) {
		var fontProp = FONT_PARTS[i];
		var val = sourceStyle[fontProp];
		if (val != null) targetStyle[fontProp] = val;
	}
}
function hasSeparateFont(style) {
	return style.fontSize != null || style.fontFamily || style.fontWeight;
}
function normalizeTextStyle(style) {
	normalizeStyle(style);
	each$1(style.rich, normalizeStyle);
	return style;
}
function normalizeStyle(style) {
	if (style) {
		style.font = ZRText.makeFont(style);
		var textAlign = style.align;
		textAlign === "middle" && (textAlign = "center");
		style.align = textAlign == null || VALID_TEXT_ALIGN[textAlign] ? textAlign : "left";
		var verticalAlign = style.verticalAlign;
		verticalAlign === "center" && (verticalAlign = "middle");
		style.verticalAlign = verticalAlign == null || VALID_TEXT_VERTICAL_ALIGN[verticalAlign] ? verticalAlign : "top";
		if (style.padding) style.padding = normalizeCssArray$1(style.padding);
	}
}
function getStroke(stroke, lineWidth) {
	return stroke == null || lineWidth <= 0 || stroke === "transparent" || stroke === "none" ? null : stroke.image || stroke.colorStops ? "#000" : stroke;
}
function getFill(fill) {
	return fill == null || fill === "none" ? null : fill.image || fill.colorStops ? "#000" : fill;
}
function getTextXForPadding(x, textAlign, textPadding) {
	return textAlign === "right" ? x - textPadding[1] : textAlign === "center" ? x + textPadding[3] / 2 - textPadding[1] / 2 : x + textPadding[3];
}
function getStyleText(style) {
	var text = style.text;
	text != null && (text += "");
	return text;
}
function needDrawBackground(style) {
	return !!(style.backgroundColor || style.lineHeight || style.borderWidth && style.borderColor);
}
//#endregion
//#region node_modules/echarts/lib/util/number.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var RADIAN_EPSILON = 1e-4;
var TO_FIXED_SUPPORTED_PRECISION_MAX = 20;
function _trim(str) {
	return str.replace(/^\s+|\s+$/g, "");
}
var mathMin$2 = Math.min;
var mathMax$2 = Math.max;
var mathAbs$2 = Math.abs;
var mathRound = Math.round;
var mathFloor = Math.floor;
var mathCeil = Math.ceil;
var mathPow = Math.pow;
var mathLog = Math.log;
var mathLN10 = Math.LN10;
var mathPI = Math.PI;
var mathRandom = Math.random;
/**
* Linear mapping a value from domain to range
* @param  val
* @param  domain Domain extent domain[0] can be bigger than domain[1]
* @param  range  Range extent range[0] can be bigger than range[1]
* @param  clamp Default to be false
*/
function linearMap(val, domain, range, clamp) {
	var d0 = domain[0];
	var d1 = domain[1];
	var r0 = range[0];
	var r1 = range[1];
	var subDomain = d1 - d0;
	var subRange = r1 - r0;
	if (subDomain === 0) return subRange === 0 ? r0 : (r0 + r1) / 2;
	if (clamp) {
		if (subDomain > 0) {
			if (val <= d0) return r0;
			else if (val >= d1) return r1;
		} else if (val >= d0) return r0;
		else if (val <= d1) return r1;
	} else {
		if (val === d0) return r0;
		if (val === d1) return r1;
	}
	return (val - d0) / subDomain * subRange + r0;
}
/**
* Preserve the name `parsePercent` for backward compatibility,
* and it's effectively published as `echarts.number.parsePercent`.
*/
var parsePercent = parsePositionOption;
/**
* @see {parsePositionSizeOption} and also accept a string preset.
* @see {PositionSizeOption}
*/
function parsePositionOption(option, percentBase, percentOffset) {
	switch (option) {
		case "center":
		case "middle":
			option = "50%";
			break;
		case "left":
		case "top":
			option = "0%";
			break;
		case "right":
		case "bottom": option = "100%";
	}
	return parsePositionSizeOption(option, percentBase, percentOffset);
}
/**
* Accept number, or numeric string (`'123'`), or percentage ('100%'), as x/y/width/height pixel number.
* If null/undefined or invalid, return NaN.
* (But allow JS type coercion (`+option`) due to backward compatibility)
* @see {PositionSizeOption}
*/
function parsePositionSizeOption(option, percentBase, percentOffset) {
	if (isString(option)) {
		if (isOptionStringPercent(option)) return parseFloat(option) / 100 * percentBase + (percentOffset || 0);
		return parseFloat(option);
	}
	return option == null ? NaN : +option;
}
function isOptionStringPercent(option) {
	return !!_trim(option).match(/%$/);
}
function round(x, precision, returnStr) {
	if (isNaN(precision)) return returnStr ? "" + x : +x;
	precision = mathMin$2(mathMax$2(0, precision), TO_FIXED_SUPPORTED_PRECISION_MAX);
	x = (+x).toFixed(precision);
	return returnStr ? x : +x;
}
function roundLegacy(x, precision, returnStr) {
	if (precision == null) precision = 10;
	return round(x, precision, returnStr);
}
/**
* Inplacd asc sort arr.
* The input arr will be modified.
*/
function asc(arr) {
	arr.sort(function(a, b) {
		return a - b;
	});
	return arr;
}
/**
* Get precision.
* e.g. `getPrecisionSafe(100.123)` return `3`.
* e.g. `getPrecisionSafe(100)` return `0`.
*/
function getPrecision(val) {
	val = +val;
	if (isNaN(val)) return 0;
	if (val > 1e-14) {
		var e = 1;
		for (var i = 0; i < 15; i++, e *= 10) if (mathRound(val * e) / e === val) return i;
	}
	return getPrecisionSafe(val);
}
/**
* Get precision with slow but safe method
* e.g. `getPrecisionSafe(100.123)` return `3`.
* e.g. `getPrecisionSafe(100)` return `0`.
*/
function getPrecisionSafe(val) {
	var str = val.toString().toLowerCase();
	var eIndex = str.indexOf("e");
	var exp = eIndex > 0 ? +str.slice(eIndex + 1) : 0;
	var significandPartLen = eIndex > 0 ? eIndex : str.length;
	var dotIndex = str.indexOf(".");
	return mathMax$2(0, (dotIndex < 0 ? 0 : significandPartLen - 1 - dotIndex) - exp);
}
/**
* @deprecated Use `getAcceptableTickPrecision` instead. See bad case in `test/ut/spec/util/number.test.ts`
* NOTE: originally introduced in commit `ff93e3e7f9ff24902e10d4469fd3187393b05feb`
*
* Minimal discernible data precision according to a single pixel.
*/
function getPixelPrecision(dataExtent, pixelExtent) {
	var dataQuantity = mathFloor(mathLog(dataExtent[1] - dataExtent[0]) / mathLN10);
	var sizeQuantity = mathRound(mathLog(mathAbs$2(pixelExtent[1] - pixelExtent[0])) / mathLN10);
	var precision = mathMin$2(mathMax$2(-dataQuantity + sizeQuantity, 0), TO_FIXED_SUPPORTED_PRECISION_MAX);
	return !isFinite(precision) ? TO_FIXED_SUPPORTED_PRECISION_MAX : precision;
}
/**
* This method chooses a reasonable "data" precision that can be used in `round` method.
* A reasonable precision is suitable for display; it may cause cumulative error but acceptable.
*
* "data" is linearly mapped to pixel according to the ratio determined by `dataSpan` and `pxSpan`.
* The diff from the original "data" to the rounded "data" (with the result precision) should be
* equal or less than `pxDiffAcceptable`, which is typically `1` pixel.
* And the result precision should be as small as possible for a concise display.
*
* [NOTICE]: using arbitrary parameters is NOT preferable - a discernible misalign (e.g., over 1px)
*  may occur, especially when `splitLine` is displayed.
*
* PENDING: Only the linear case is addressed for now; other mapping methods (like logarithm) will
*  not be covered until necessary.
*/
function getAcceptableTickPrecision(dataExtent, pxSpan, pxDiffAcceptable) {
	var dataSpan = mathAbs$2(dataExtent[1] - dataExtent[0]);
	if (!isFinite(dataSpan) || dataSpan === 0) return NaN;
	var dataExp2 = mathLog(2 * mathAbs$2(pxDiffAcceptable || 1) * mathAbs$2(dataSpan)) / mathLN10;
	var pxExp = mathLog(mathAbs$2(pxSpan)) / mathLN10;
	var precision = mathMax$2(0, mathCeil(-dataExp2 + pxExp));
	if (!isFinite(precision)) precision = NaN;
	return precision;
}
/**
* Get a data of given precision, assuring the sum of percentages
* in valueList is 1.
* The largest remainder method is used.
* https://en.wikipedia.org/wiki/Largest_remainder_method
*
* @param valueList a list of all data
* @param idx index of the data to be processed in valueList
* @param precision integer number showing digits of precision
* @return percent ranging from 0 to 100
*/
function getPercentWithPrecision(valueList, idx, precision) {
	if (!valueList[idx]) return 0;
	return getPercentSeats(valueList, precision)[idx] || 0;
}
/**
* Get a data of given precision, assuring the sum of percentages
* in valueList is 1.
* The largest remainder method is used.
* https://en.wikipedia.org/wiki/Largest_remainder_method
*
* @param valueList a list of all data
* @param precision integer number showing digits of precision
* @return {Array<number>}
*/
function getPercentSeats(valueList, precision) {
	var sum = reduce(valueList, function(acc, val) {
		return acc + (isNaN(val) ? 0 : val);
	}, 0);
	if (sum === 0) return [];
	var digits = mathPow(10, precision);
	var votesPerQuota = map(valueList, function(val) {
		return (isNaN(val) ? 0 : val) / sum * digits * 100;
	});
	var targetSeats = digits * 100;
	var seats = map(votesPerQuota, function(votes) {
		return mathFloor(votes);
	});
	var currentSum = reduce(seats, function(acc, val) {
		return acc + val;
	}, 0);
	var remainder = map(votesPerQuota, function(votes, idx) {
		return votes - seats[idx];
	});
	while (currentSum < targetSeats) {
		var max = Number.NEGATIVE_INFINITY;
		var maxId = null;
		for (var i = 0, len = remainder.length; i < len; ++i) if (remainder[i] > max) {
			max = remainder[i];
			maxId = i;
		}
		++seats[maxId];
		remainder[maxId] = 0;
		++currentSum;
	}
	return map(seats, function(seat) {
		return seat / digits;
	});
}
/**
* Solve the floating point adding problem like 0.1 + 0.2 === 0.30000000000000004
* See <http://0.30000000000000004.com/>
*/
function addSafe(val0, val1) {
	var maxPrecision = mathMax$2(getPrecision(val0), getPrecision(val1));
	var sum = val0 + val1;
	return maxPrecision > TO_FIXED_SUPPORTED_PRECISION_MAX ? sum : round(sum, maxPrecision);
}
var MAX_SAFE_INTEGER = mathPow(2, 53) - 1;
/**
* To 0 - 2 * PI, considering negative radian.
*/
function remRadian(radian) {
	var pi2 = mathPI * 2;
	return (radian % pi2 + pi2) % pi2;
}
/**
* @param {type} radian
* @return {boolean}
*/
function isRadianAroundZero(val) {
	return val > -RADIAN_EPSILON && val < RADIAN_EPSILON;
}
var TIME_REG = /^(?:(\d{4})(?:[-\/](\d{1,2})(?:[-\/](\d{1,2})(?:[T ](\d{1,2})(?::(\d{1,2})(?::(\d{1,2})(?:[.,](\d+))?)?)?(Z|[\+\-]\d\d:?\d\d)?)?)?)?)?$/;
/**
* @param value valid type: number | string | Date, otherwise return `new Date(NaN)`
*   These values can be accepted:
*   + An instance of Date, represent a time in its own time zone.
*   + Or string in a subset of ISO 8601, only including:
*     + only year, month, date: '2012-03', '2012-03-01', '2012-03-01 05', '2012-03-01 05:06',
*     + separated with T or space: '2012-03-01T12:22:33.123', '2012-03-01 12:22:33.123',
*     + time zone: '2012-03-01T12:22:33Z', '2012-03-01T12:22:33+8000', '2012-03-01T12:22:33-05:00',
*     all of which will be treated as local time if time zone is not specified
*     (see <https://momentjs.com/>).
*   + Or other string format, including (all of which will be treated as local time):
*     '2012', '2012-3-1', '2012/3/1', '2012/03/01',
*     '2009/6/12 2:00', '2009/6/12 2:05:08', '2009/6/12 2:05:08.123'
*   + a timestamp, which represent a time in UTC.
* @return date Never be null/undefined. If invalid, return `new Date(NaN)`.
*/
function parseDate(value) {
	if (value instanceof Date) return value;
	else if (isString(value)) {
		var match = TIME_REG.exec(value);
		if (!match) return /* @__PURE__ */ new Date(NaN);
		if (!match[8]) return new Date(+match[1], +(match[2] || 1) - 1, +match[3] || 1, +match[4] || 0, +(match[5] || 0), +match[6] || 0, match[7] ? +match[7].substring(0, 3) : 0);
		else {
			var hour = +match[4] || 0;
			if (match[8].toUpperCase() !== "Z") hour -= +match[8].slice(0, 3);
			return new Date(Date.UTC(+match[1], +(match[2] || 1) - 1, +match[3] || 1, hour, +(match[5] || 0), +match[6] || 0, match[7] ? +match[7].substring(0, 3) : 0));
		}
	} else if (value == null) return /* @__PURE__ */ new Date(NaN);
	return new Date(mathRound(value));
}
/**
* Quantity of a number. e.g. 0.1, 1, 10, 100
*
* @param val
* @return
*/
function quantity(val) {
	return mathPow(10, quantityExponent(val));
}
/**
* Exponent of the quantity of a number
* e.g., 9876 equals to 9.876*10^3, so quantityExponent(9876) is 3
* e.g., 0.09876 equals to 9.876*10^-2, so quantityExponent(0.09876) is -2
*
* @param val non-negative value
* @return
*/
function quantityExponent(val) {
	if (val === 0) return 0;
	var exp = mathFloor(mathLog(val) / mathLN10);
	/**
	* exp is expected to be the rounded-down result of the base-10 log of val.
	* But due to the precision loss with Math.log(val), we need to restore it
	* using 10^exp to make sure we can get val back from exp. #11249
	*/
	if (val / mathPow(10, exp) >= 10) exp++;
	return exp;
}
/**
* find a “nice” number approximately equal to x. Round the number if 'round',
* take ceiling if 'round'. The primary observation is that the “nicest”
* numbers in decimal are 1, 2, and 5, and all power-of-ten multiples of these numbers.
*
* See "Nice Numbers for Graph Labels" of Graphic Gems.
*
* @param  val Non-negative value.
* @return Niced number
*/
function nice(val, mode) {
	var exponent = quantityExponent(val);
	var exp10 = mathPow(10, exponent);
	var f = val / exp10;
	var nf;
	if (mode === 2) nf = 1;
	else if (mode) {
		if (f < 1.5) nf = 1;
		else if (f < 2.5) nf = 2;
		else if (f < 4) nf = 3;
		else if (f < 7) nf = 5;
		else nf = 10;
	} else if (f < 1) nf = 1;
	else if (f < 2) nf = 2;
	else if (f < 3) nf = 3;
	else if (f < 5) nf = 5;
	else nf = 10;
	val = nf * exp10;
	return round(val, -exponent);
}
/**
* This code was copied from "d3.js"
* <https://github.com/d3/d3/blob/9cc9a875e636a1dcf36cc1e07bdf77e1ad6e2c74/src/arrays/quantile.js>.
* See the license statement at the head of this file.
* @param ascArr
*/
function quantile(ascArr, p) {
	var H = (ascArr.length - 1) * p + 1;
	var h = mathFloor(H);
	var v = +ascArr[h - 1];
	var e = H - h;
	return e ? v + e * (ascArr[h] - v) : v;
}
/**
* Order intervals asc, and split them when overlap.
* expect(numberUtil.reformIntervals([
*     {interval: [18, 62], close: [1, 1]},
*     {interval: [-Infinity, -70], close: [0, 0]},
*     {interval: [-70, -26], close: [1, 1]},
*     {interval: [-26, 18], close: [1, 1]},
*     {interval: [62, 150], close: [1, 1]},
*     {interval: [106, 150], close: [1, 1]},
*     {interval: [150, Infinity], close: [0, 0]}
* ])).toEqual([
*     {interval: [-Infinity, -70], close: [0, 0]},
*     {interval: [-70, -26], close: [1, 1]},
*     {interval: [-26, 18], close: [0, 1]},
*     {interval: [18, 62], close: [0, 1]},
*     {interval: [62, 150], close: [0, 1]},
*     {interval: [150, Infinity], close: [0, 0]}
* ]);
* @param list, where `close` mean open or close
*        of the interval, and Infinity can be used.
* @return The origin list, which has been reformed.
*/
function reformIntervals(list) {
	list.sort(function(a, b) {
		return littleThan(a, b, 0) ? -1 : 1;
	});
	var curr = -Infinity;
	var currClose = 1;
	for (var i = 0; i < list.length;) {
		var interval = list[i].interval;
		var close_1 = list[i].close;
		for (var lg = 0; lg < 2; lg++) {
			if (interval[lg] <= curr) {
				interval[lg] = curr;
				close_1[lg] = !lg ? 1 - currClose : 1;
			}
			curr = interval[lg];
			currClose = close_1[lg];
		}
		if (interval[0] === interval[1] && close_1[0] * close_1[1] !== 1) list.splice(i, 1);
		else i++;
	}
	return list;
	function littleThan(a, b, lg) {
		return a.interval[lg] < b.interval[lg] || a.interval[lg] === b.interval[lg] && (a.close[lg] - b.close[lg] === (!lg ? 1 : -1) || !lg && littleThan(a, b, 1));
	}
}
/**
* [Numeric is defined as]:
*     `parseFloat(val) == val`
* For example:
* numeric:
*     typeof number except NaN, '-123', '123', '2e3', '-2e3', '011', 'Infinity', Infinity,
*     and they rounded by white-spaces or line-terminal like ' -123 \n ' (see es spec)
* not-numeric:
*     null, undefined, [], {}, true, false, 'NaN', NaN, '123ab',
*     empty string, string with only white-spaces or line-terminal (see es spec),
*     0x12, '0x12', '-0x12', 012, '012', '-012',
*     non-string, ...
*
* @test See full test cases in `test/ut/spec/util/number.js`.
* @return Must be a typeof number. If not numeric, return NaN.
*/
function numericToNumber(val) {
	var valFloat = parseFloat(val);
	return valFloat == val && (valFloat !== 0 || !isString(val) || val.indexOf("x") <= 0) ? valFloat : NaN;
}
/**
* Definition of "numeric": see `numericToNumber`.
*/
function isNumeric(val) {
	return !isNaN(numericToNumber(val));
}
/**
* Use random base to prevent users hard code depending on
* this auto generated marker id.
* @return An positive integer.
*/
function getRandomIdBase() {
	return mathRound(mathRandom() * 9);
}
/**
* Get the greatest common divisor.
*
* @param {number} a one number
* @param {number} b the other number
*/
function getGreatestCommonDividor(a, b) {
	if (b === 0) return a;
	return getGreatestCommonDividor(b, a % b);
}
/**
* Get the least common multiple.
*
* @param {number} a one number
* @param {number} b the other number
*/
function getLeastCommonMultiple(a, b) {
	if (a == null) return b;
	if (b == null) return a;
	return a * b / getGreatestCommonDividor(a, b);
}
/**
* NOTICE: Assume the input `val` is number or null/undefined, no type check, no support of BitInt.
* Therefore, it is NOT suitable for processing user input, but sufficient for
* internal usage in most cases.
* For platform-agnosticism, `Number.isFinite` is not used.
*/
function isNullableNumberFinite(val) {
	return val != null && isFinite(val);
}
//#endregion
//#region node_modules/echarts/lib/util/log.js
var ECHARTS_PREFIX = "[ECharts] ";
var storedLogs = {};
var hasConsole = typeof console !== "undefined" && console.warn && console.log;
function outputLog(type, str, onlyOnce) {
	if (hasConsole) {
		if (onlyOnce) {
			if (storedLogs[str]) return;
			storedLogs[str] = true;
		}
		console[type](ECHARTS_PREFIX + str);
	}
}
function error(str, onlyOnce) {
	outputLog("error", str, onlyOnce);
}
function deprecateLog(str) {}
/**
* @throws Error
*/
function throwError(msg) {
	throw new Error(msg);
}
//#endregion
//#region node_modules/echarts/lib/util/model.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function interpolateNumber(p0, p1, percent) {
	return (p1 - p0) * percent + p0;
}
/**
* Make the name displayable. But we should
* make sure it is not duplicated with user
* specified name, so use '\0';
*/
var DUMMY_COMPONENT_NAME_PREFIX = "series\0";
var INTERNAL_COMPONENT_ID_PREFIX = "\0_ec_\0";
/**
* If value is not array, then translate it to array.
* @param  {*} value
* @return {Array} [value] or value
*/
function normalizeToArray(value) {
	return value instanceof Array ? value : value == null ? [] : [value];
}
/**
* Sync default option between normal and emphasis like `position` and `show`
* In case some one will write code like
*     label: {
*          show: false,
*          position: 'outside',
*          fontSize: 18
*     },
*     emphasis: {
*          label: { show: true }
*     }
*/
function defaultEmphasis(opt, key, subOpts) {
	if (opt) {
		opt[key] = opt[key] || {};
		opt.emphasis = opt.emphasis || {};
		opt.emphasis[key] = opt.emphasis[key] || {};
		for (var i = 0, len = subOpts.length; i < len; i++) {
			var subOptName = subOpts[i];
			if (!opt.emphasis[key].hasOwnProperty(subOptName) && opt[key].hasOwnProperty(subOptName)) opt.emphasis[key][subOptName] = opt[key][subOptName];
		}
	}
}
var TEXT_STYLE_OPTIONS = [
	"fontStyle",
	"fontWeight",
	"fontSize",
	"fontFamily",
	"rich",
	"tag",
	"color",
	"textBorderColor",
	"textBorderWidth",
	"width",
	"height",
	"lineHeight",
	"align",
	"verticalAlign",
	"baseline",
	"shadowColor",
	"shadowBlur",
	"shadowOffsetX",
	"shadowOffsetY",
	"textShadowColor",
	"textShadowBlur",
	"textShadowOffsetX",
	"textShadowOffsetY",
	"backgroundColor",
	"borderColor",
	"borderWidth",
	"borderRadius",
	"padding"
];
/**
* The method does not ensure performance.
* data could be [12, 2323, {value: 223}, [1221, 23], {value: [2, 23]}]
* This helper method retrieves value from data.
*/
function getDataItemValue(dataItem) {
	return isObject(dataItem) && !isArray(dataItem) && !(dataItem instanceof Date) ? dataItem.value : dataItem;
}
/**
* data could be [12, 2323, {value: 223}, [1221, 23], {value: [2, 23]}]
* This helper method determine if dataItem has extra option besides value
*/
function isDataItemOption(dataItem) {
	return isObject(dataItem) && !(dataItem instanceof Array);
}
/**
* Mapping to existings for merge.
*
* Mode "normalMege":
*     The mapping result (merge result) will keep the order of the existing
*     component, rather than the order of new option. Because we should ensure
*     some specified index reference (like xAxisIndex) keep work.
*     And in most cases, "merge option" is used to update partial option but not
*     be expected to change the order.
*
* Mode "replaceMege":
*     (1) Only the id mapped components will be merged.
*     (2) Other existing components (except internal components) will be removed.
*     (3) Other new options will be used to create new component.
*     (4) The index of the existing components will not be modified.
*     That means their might be "hole" after the removal.
*     The new components are created first at those available index.
*
* Mode "replaceAll":
*     This mode try to support that reproduce an echarts instance from another
*     echarts instance (via `getOption`) in some simple cases.
*     In this scenario, the `result` index are exactly the consistent with the `newCmptOptions`,
*     which ensures the component index referring (like `xAxisIndex: ?`) corrent. That is,
*     the "hole" in `newCmptOptions` will also be kept.
*     On the contrary, other modes try best to eliminate holes.
*     PENDING: This is an experimental mode yet.
*
* @return See the comment of <MappingResult>.
*/
function mappingToExists(existings, newCmptOptions, mode) {
	var isNormalMergeMode = mode === "normalMerge";
	var isReplaceMergeMode = mode === "replaceMerge";
	var isReplaceAllMode = mode === "replaceAll";
	existings = existings || [];
	newCmptOptions = (newCmptOptions || []).slice();
	var existingIdIdxMap = createHashMap();
	each$1(newCmptOptions, function(cmptOption, index) {
		if (!isObject(cmptOption)) {
			newCmptOptions[index] = null;
			return;
		}
	});
	var result = prepareResult(existings, existingIdIdxMap, mode);
	if (isNormalMergeMode || isReplaceMergeMode) mappingById(result, existings, existingIdIdxMap, newCmptOptions);
	if (isNormalMergeMode) mappingByName(result, newCmptOptions);
	if (isNormalMergeMode || isReplaceMergeMode) mappingByIndex(result, newCmptOptions, isReplaceMergeMode);
	else if (isReplaceAllMode) mappingInReplaceAllMode(result, newCmptOptions);
	makeIdAndName(result);
	return result;
}
function prepareResult(existings, existingIdIdxMap, mode) {
	var result = [];
	if (mode === "replaceAll") return result;
	for (var index = 0; index < existings.length; index++) {
		var existing = existings[index];
		if (existing && existing.id != null) existingIdIdxMap.set(existing.id, index);
		result.push({
			existing: mode === "replaceMerge" || isComponentIdInternal(existing) ? null : existing,
			newOption: null,
			keyInfo: null,
			brandNew: null
		});
	}
	return result;
}
function mappingById(result, existings, existingIdIdxMap, newCmptOptions) {
	each$1(newCmptOptions, function(cmptOption, index) {
		if (!cmptOption || cmptOption.id == null) return;
		var optionId = makeComparableKey(cmptOption.id);
		var existingIdx = existingIdIdxMap.get(optionId);
		if (existingIdx != null) {
			var resultItem = result[existingIdx];
			assert(!resultItem.newOption, "Duplicated option on id \"" + optionId + "\".");
			resultItem.newOption = cmptOption;
			resultItem.existing = existings[existingIdx];
			newCmptOptions[index] = null;
		}
	});
}
function mappingByName(result, newCmptOptions) {
	each$1(newCmptOptions, function(cmptOption, index) {
		if (!cmptOption || cmptOption.name == null) return;
		for (var i = 0; i < result.length; i++) {
			var existing = result[i].existing;
			if (!result[i].newOption && existing && (existing.id == null || cmptOption.id == null) && !isComponentIdInternal(cmptOption) && !isComponentIdInternal(existing) && keyExistAndEqual("name", existing, cmptOption)) {
				result[i].newOption = cmptOption;
				newCmptOptions[index] = null;
				return;
			}
		}
	});
}
function mappingByIndex(result, newCmptOptions, brandNew) {
	each$1(newCmptOptions, function(cmptOption) {
		if (!cmptOption) return;
		var resultItem;
		var nextIdx = 0;
		while ((resultItem = result[nextIdx]) && (resultItem.newOption || isComponentIdInternal(resultItem.existing) || resultItem.existing && cmptOption.id != null && !keyExistAndEqual("id", cmptOption, resultItem.existing))) nextIdx++;
		if (resultItem) {
			resultItem.newOption = cmptOption;
			resultItem.brandNew = brandNew;
		} else result.push({
			newOption: cmptOption,
			brandNew,
			existing: null,
			keyInfo: null
		});
		nextIdx++;
	});
}
function mappingInReplaceAllMode(result, newCmptOptions) {
	each$1(newCmptOptions, function(cmptOption) {
		result.push({
			newOption: cmptOption,
			brandNew: true,
			existing: null,
			keyInfo: null
		});
	});
}
/**
* Make id and name for mapping result (result of mappingToExists)
* into `keyInfo` field.
*/
function makeIdAndName(mapResult) {
	var idMap = createHashMap();
	each$1(mapResult, function(item) {
		var existing = item.existing;
		existing && idMap.set(existing.id, item);
	});
	each$1(mapResult, function(item) {
		var opt = item.newOption;
		assert(!opt || opt.id == null || !idMap.get(opt.id) || idMap.get(opt.id) === item, "id duplicates: " + (opt && opt.id));
		opt && opt.id != null && idMap.set(opt.id, item);
		!item.keyInfo && (item.keyInfo = {});
	});
	each$1(mapResult, function(item, index) {
		var existing = item.existing;
		var opt = item.newOption;
		var keyInfo = item.keyInfo;
		if (!isObject(opt)) return;
		keyInfo.name = opt.name != null ? makeComparableKey(opt.name) : existing ? existing.name : DUMMY_COMPONENT_NAME_PREFIX + index;
		if (existing) keyInfo.id = makeComparableKey(existing.id);
		else if (opt.id != null) keyInfo.id = makeComparableKey(opt.id);
		else {
			var idNum = 0;
			do
				keyInfo.id = "\0" + keyInfo.name + "\0" + idNum++;
			while (idMap.get(keyInfo.id));
		}
		idMap.set(keyInfo.id, item);
	});
}
function keyExistAndEqual(attr, obj1, obj2) {
	var key1 = convertOptionIdName(obj1[attr], null);
	var key2 = convertOptionIdName(obj2[attr], null);
	return key1 != null && key2 != null && key1 === key2;
}
/**
* @return return null if not exist.
*/
function makeComparableKey(val) {
	return convertOptionIdName(val, "");
}
function convertOptionIdName(idOrName, defaultValue) {
	if (idOrName == null) return defaultValue;
	return isString(idOrName) ? idOrName : isNumber(idOrName) || isStringSafe(idOrName) ? idOrName + "" : defaultValue;
}
function isNameSpecified(componentModel) {
	var name = componentModel.name;
	return !!(name && name.indexOf(DUMMY_COMPONENT_NAME_PREFIX));
}
/**
* @public
* @param {Object} cmptOption
* @return {boolean}
*/
function isComponentIdInternal(cmptOption) {
	return cmptOption && cmptOption.id != null && makeComparableKey(cmptOption.id).indexOf(INTERNAL_COMPONENT_ID_PREFIX) === 0;
}
function setComponentTypeToKeyInfo(mappingResult, mainType, componentModelCtor) {
	each$1(mappingResult, function(item) {
		var newOption = item.newOption;
		if (isObject(newOption)) {
			item.keyInfo.mainType = mainType;
			item.keyInfo.subType = determineSubType(mainType, newOption, item.existing, componentModelCtor);
		}
	});
}
function determineSubType(mainType, newCmptOption, existComponent, componentModelCtor) {
	return newCmptOption.type ? newCmptOption.type : existComponent ? existComponent.subType : componentModelCtor.determineSubType(mainType, newCmptOption);
}
/**
* @param payload Contains dataIndex (means rawIndex) / dataIndexInside / name
*                         each of which can be Array or primary type.
* @return dataIndex If not found, return undefined/null.
*/
function queryDataIndex(data, payload) {
	if (payload.dataIndexInside != null) return payload.dataIndexInside;
	else if (payload.dataIndex != null) return isArray(payload.dataIndex) ? map(payload.dataIndex, function(value) {
		return data.indexOfRawIndex(value);
	}) : data.indexOfRawIndex(payload.dataIndex);
	else if (payload.name != null) return isArray(payload.name) ? map(payload.name, function(value) {
		return data.indexOfName(value);
	}) : data.indexOfName(payload.name);
}
/**
* [CAVEAT]:
*  DO NOT use it in performance-sensitive scenarios.
*  Likely a hash map lookup; not inline-cache friendly.
*
* Enable property storage to any host object.
* Notice: Serialization is not supported.
*
* For example:
* let inner = makeInner();
*
* function some1(hostObj) {
*      inner(hostObj).someProperty = 1212;
*      ...
* }
* function some2() {
*      let fields = inner(this);
*      fields.someProperty1 = 1212;
*      fields.someProperty2 = 'xx';
*      ...
* }
*/
function makeInner() {
	var key = "__ec_inner_" + innerUniqueIndex++;
	return function(hostObj) {
		return hostObj[key] || (hostObj[key] = {});
	};
}
var innerUniqueIndex = getRandomIdBase();
/**
* The same behavior as `component.getReferringComponents`.
*/
function parseFinder(ecModel, finderInput, opt) {
	var _a = preParseFinder(finderInput, opt), mainTypeSpecified = _a.mainTypeSpecified, queryOptionMap = _a.queryOptionMap;
	var result = _a.others;
	var defaultMainType = opt ? opt.defaultMainType : null;
	if (!mainTypeSpecified && defaultMainType) queryOptionMap.set(defaultMainType, {});
	queryOptionMap.each(function(queryOption, mainType) {
		var queryResult = queryReferringComponents(ecModel, mainType, queryOption, {
			useDefault: defaultMainType === mainType,
			enableAll: opt && opt.enableAll != null ? opt.enableAll : true,
			enableNone: opt && opt.enableNone != null ? opt.enableNone : true
		});
		result[mainType + "Models"] = queryResult.models;
		result[mainType + "Model"] = queryResult.models[0];
	});
	return result;
}
function preParseFinder(finderInput, opt) {
	var finder;
	if (isString(finderInput)) {
		var obj = {};
		obj[finderInput + "Index"] = 0;
		finder = obj;
	} else finder = finderInput;
	var queryOptionMap = createHashMap();
	var others = {};
	var mainTypeSpecified = false;
	each$1(finder, function(value, key) {
		if (key === "dataIndex" || key === "dataIndexInside") {
			others[key] = value;
			return;
		}
		var parsedKey = key.match(/^(\w+)(Index|Id|Name)$/) || [];
		var mainType = parsedKey[1];
		var queryType = (parsedKey[2] || "").toLowerCase();
		if (!mainType || !queryType || opt && opt.includeMainTypes && indexOf(opt.includeMainTypes, mainType) < 0) return;
		mainTypeSpecified = mainTypeSpecified || !!mainType;
		var queryOption = queryOptionMap.get(mainType) || queryOptionMap.set(mainType, {});
		queryOption[queryType] = value;
	});
	return {
		mainTypeSpecified,
		queryOptionMap,
		others
	};
}
var SINGLE_REFERRING = {
	useDefault: true,
	enableAll: false,
	enableNone: false
};
function queryReferringComponents(ecModel, mainType, userOption, opt) {
	opt = opt || SINGLE_REFERRING;
	var indexOption = userOption.index;
	var idOption = userOption.id;
	var nameOption = userOption.name;
	var result = {
		models: null,
		specified: indexOption != null || idOption != null || nameOption != null
	};
	if (!result.specified) {
		var firstCmpt = void 0;
		result.models = opt.useDefault && (firstCmpt = ecModel.getComponent(mainType)) ? [firstCmpt] : [];
		return result;
	}
	if (indexOption === "none" || indexOption === false) {
		if (opt.enableNone) {
			result.models = [];
			return result;
		} else indexOption = -1;
	}
	if (indexOption === "all") {
		if (opt.enableAll) indexOption = idOption = nameOption = null;
		else indexOption = -1;
	}
	result.models = ecModel.queryComponents({
		mainType,
		index: indexOption,
		id: idOption,
		name: nameOption
	});
	return result;
}
/**
* `{{mainType}Id, {mainType}Index, {mainType}Name}` takes precedence if provided in `payload`;
* otherwise, query by `mainType`.
* `subType` performs futher filtering if provided.
*/
function makeQueryConditionKindA(payload, mainType, subType) {
	var query = {};
	query[mainType + "Id"] = payload[mainType + "Id"];
	query[mainType + "Index"] = payload[mainType + "Index"];
	query[mainType + "Name"] = payload[mainType + "Name"];
	var condition = {
		mainType,
		query
	};
	subType && (condition.subType = subType);
	return condition;
}
function setAttribute(dom, key, value) {
	dom.setAttribute ? dom.setAttribute(key, value) : dom[key] = value;
}
function getAttribute(dom, key) {
	return dom.getAttribute ? dom.getAttribute(key) : dom[key];
}
function getTooltipRenderMode(renderModeOption) {
	if (renderModeOption === "auto") return env.domSupported ? "html" : "richText";
	else return renderModeOption || "html";
}
/**
* Interpolate raw values of a series with percent
*
* @param data         data
* @param labelModel   label model of the text element
* @param sourceValue  start value. May be null/undefined when init.
* @param targetValue  end value
* @param percent      0~1 percentage; 0 uses start value while 1 uses end value
* @return             interpolated values
*                     If `sourceValue` and `targetValue` are `number`, return `number`.
*                     If `sourceValue` and `targetValue` are `string`, return `string`.
*                     If `sourceValue` and `targetValue` are `(string | number)[]`, return `(string | number)[]`.
*                     Other cases do not supported.
*/
function interpolateRawValues(data, precision, sourceValue, targetValue, percent) {
	var isAutoPrecision = precision == null || precision === "auto";
	if (targetValue == null) return targetValue;
	if (isNumber(targetValue)) {
		var value = interpolateNumber(sourceValue || 0, targetValue, percent);
		return round(value, isAutoPrecision ? Math.max(getPrecision(sourceValue || 0), getPrecision(targetValue)) : precision);
	} else if (isString(targetValue)) return percent < 1 ? sourceValue : targetValue;
	else {
		var interpolated = [];
		var leftArr = sourceValue;
		var rightArr = targetValue;
		var length_1 = Math.max(leftArr ? leftArr.length : 0, rightArr.length);
		for (var i = 0; i < length_1; ++i) {
			var info = data.getDimensionInfo(i);
			if (info && info.type === "ordinal") interpolated[i] = (percent < 1 && leftArr ? leftArr : rightArr)[i];
			else {
				var leftVal = leftArr && leftArr[i] ? leftArr[i] : 0;
				var rightVal = rightArr[i];
				var value = interpolateNumber(leftVal, rightVal, percent);
				interpolated[i] = round(value, isAutoPrecision ? Math.max(getPrecision(leftVal), getPrecision(rightVal)) : precision);
			}
		}
		return interpolated;
	}
}
(function() {
	function ListIterator() {}
	/**
	* The loop condition is `idx < end` if `step > 0`;
	* The loop condition is `idx >= end` if `step < 0`.
	*
	* @param end By default `list.length` if `step > 0`; `0` if `step < 0`.
	* @param step By default `1`.
	*/
	ListIterator.prototype.reset = function(list, start, end, step) {
		this._list = list;
		this._step = step = step || 1;
		this._idx = start;
		this._end = end != null ? end : step > 0 ? list.length : 0;
		this.item = null;
		this.key = NaN;
		return this;
	};
	ListIterator.prototype.next = function() {
		if (this._step > 0 ? this._idx < this._end : this._idx >= this._end) {
			this.item = this._list[this._idx];
			this.key = this._idx = this._idx + this._step;
			return true;
		}
		return false;
	};
	return ListIterator;
})();
function initExtentForUnion() {
	return [Infinity, -Infinity];
}
/**
* NOTICE:
*  - The input `val` must be a number - type checking is not performed.
*  - `extent` should be initialized as `initExtentForUnion()`.
*/
function unionExtentFromNumber(extent, val) {
	if (isValidNumberForExtent(val)) {
		val < extent[0] && (extent[0] = val);
		val > extent[1] && (extent[1] = val);
	}
}
/**
* NOTICE:
*  - The input `val` must be a number - type checking is not performed.
*  - `extent` should be initialized as `initExtentForUnion()`.
*/
function unionExtentStartFromNumber(extent, val) {
	if (isValidNumberForExtent(val) && val < extent[0]) extent[0] = val;
}
/**
* NOTICE:
*  - The input `val` must be a number - type checking is not performed.
*  - `extent` should be initialized as `initExtentForUnion()`.
*/
function unionExtentEndFromNumber(extent, val) {
	if (isValidNumberForExtent(val) && val > extent[1]) extent[1] = val;
}
/**
* NOTICE:
*  - `extent` should be initialized as `initExtentForUnion()`.
*/
function unionExtentFromExtent(tarExtent, srcExtent) {
	if (isValidBoundsForExtent(srcExtent[0], srcExtent[1])) {
		srcExtent[0] < tarExtent[0] && (tarExtent[0] = srcExtent[0]);
		srcExtent[1] > tarExtent[1] && (tarExtent[1] = srcExtent[1]);
	}
}
/**
* PENDING: `Infinity` from user data is not necessarily meaningless, but visualizing it requires
* special handling and it will not be supported until required. So we simply ignore it here.
*/
function isValidNumberForExtent(val) {
	return val != null && isFinite(val);
}
function isValidBoundsForExtent(start, end) {
	return isValidNumberForExtent(start) && isValidNumberForExtent(end) && start <= end;
}
/**
* `extent` should be initialized by `initExtentForUnion()`, and unioned by `unionExtent()`.
* `extent` may contain `Infinity` / `NaN`, but assume no `null`/`undefined`.
*/
function extentHasValue(extent) {
	var span = extent[1] - extent[0];
	return isFinite(span) && span >= 0;
}
/**
* NOTE: considered items are null/undefined/NaN - do nothing for this case.
*/
function ensureExtentAscSimply(extent) {
	if (isValidBoundsForExtent(extent[0], extent[1]) && extent[0] > extent[1]) extent[0] = extent[1];
}
/**
* A util for ensuring the callback is called only once.
* @usage
*  const callOnlyOnce = makeCallOnlyOnce(); // Should be static (ESM top level).
*  function someFunc(registers: EChartsExtensionInstallRegisters): void {
*      callOnlyOnce(registers, function () {
*          // Do something immediately and only once per registers.
*      }
*  }
*/
function makeCallOnlyOnce() {
	var hiddenKey = "__ec_once_" + onceUniqueIndex++;
	return function(hostObj, cb) {
		if (!hasOwn(hostObj, hiddenKey)) {
			hostObj[hiddenKey] = 1;
			cb();
		}
	};
}
var onceUniqueIndex = getRandomIdBase();
/**
* @usage
*  - The earlier item takes precedence for duplicate items.
*  - The input `arr` will be modified if `resolve` is null/undefined.
*  - Callers can use `resolve` to manually modify the `currItem`.
*    The input `arr` will not be modified if `resolve` is passed.
*    `resolve` will be called on every item.
*  - Callers need to handle null/undefined (if existing) in `getKey`.
*/
function removeDuplicates(arr, getKey, resolve) {
	var dupMap = createHashMap();
	var writeIdx = 0;
	each$1(arr, function(item) {
		var key = getKey(item);
		var count = dupMap.get(key) || 0;
		if (resolve) resolve(item, count);
		if (!count && !resolve) arr[writeIdx++] = item;
		dupMap.set(key, count + 1);
	});
	if (!resolve) arr.length = writeIdx;
}
function removeDuplicatesGetKeyFromValueProp(item) {
	return item.value + "";
}
function removeDuplicatesGetKeyFromItemItself(item) {
	return item + "";
}
function getIncrementalId(seriesModel, useIncremental) {
	return retrieve2(useIncremental, true) ? seriesModel.seriesIndex + 2 : 0;
}
function preparePipelineContext(seriesModel, view, pipeline) {
	var dataLen = seriesModel.getData().count();
	return {
		progressiveRender: pipeline.progressiveEnabled && view.incrementalPrepareRender && dataLen >= pipeline.threshold,
		large: seriesModel.get("large") && dataLen >= seriesModel.get("largeThreshold"),
		modDataCount: seriesModel.get("progressiveChunkMode") === "mod" ? seriesModel.getData().count() : null
	};
}
function createSimpleOverallStageHandler(seriesType, overallReset) {
	return {
		seriesType,
		overallReset
	};
}
function createSimpleOverallStageHandler2(overallReset) {
	return { overallReset };
}
//#endregion
//#region node_modules/echarts/lib/util/innerStore.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var getECData = makeInner();
var setCommonECData = function(seriesIndex, dataType, dataIdx, el) {
	if (el) {
		var ecData = getECData(el);
		ecData.dataIndex = dataIdx;
		ecData.dataType = dataType;
		ecData.seriesIndex = seriesIndex;
		ecData.ssrType = "chart";
		if (el.type === "group") el.traverse(function(child) {
			var childECData = getECData(child);
			childECData.seriesIndex = seriesIndex;
			childECData.dataIndex = dataIdx;
			childECData.dataType = dataType;
			childECData.ssrType = "chart";
		});
	}
};
//#endregion
//#region node_modules/echarts/lib/util/types.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var UNDEFINED_STR = "undefined";
var COMPONENT_MAIN_TYPE_SERIES = "series";
var VISUAL_DIMENSIONS = createHashMap([
	"tooltip",
	"label",
	"itemName",
	"itemId",
	"itemGroupId",
	"itemChildGroupId",
	"seriesName"
]);
var SOURCE_FORMAT_ORIGINAL = "original";
var SOURCE_FORMAT_ARRAY_ROWS = "arrayRows";
var SOURCE_FORMAT_OBJECT_ROWS = "objectRows";
var SOURCE_FORMAT_KEYED_COLUMNS = "keyedColumns";
var SOURCE_FORMAT_TYPED_ARRAY = "typedArray";
var SOURCE_FORMAT_UNKNOWN = "unknown";
var SERIES_LAYOUT_BY_COLUMN = "column";
//#endregion
//#region node_modules/echarts/lib/core/ExtensionAPI.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var availableMethods = [
	"getDom",
	"getZr",
	"getWidth",
	"getHeight",
	"getDevicePixelRatio",
	"dispatchAction",
	"isSSR",
	"isDisposed",
	"on",
	"off",
	"getDataURL",
	"getConnectedDataURL",
	"getOption",
	"getId",
	"updateLabelLayout"
];
var ExtensionAPI = function() {
	function ExtensionAPI(ecInstance) {
		each$1(availableMethods, function(methodName) {
			this[methodName] = bind(ecInstance[methodName], ecInstance);
		}, this);
	}
	return ExtensionAPI;
}();
function getViewOfComponentOrSeries(api, componentOrSeries) {
	return componentOrSeries.mainType === "series" ? api.getViewOfSeriesModel(componentOrSeries) : api.getViewOfComponentModel(componentOrSeries);
}
//#endregion
//#region node_modules/echarts/lib/util/states.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var _highlightNextDigit = 1;
var _highlightKeyMap = {};
var getSavedStates = makeInner();
var getComponentStates = makeInner();
var SPECIAL_STATES = [
	"emphasis",
	"blur",
	"select"
];
var DISPLAY_STATES = [
	"normal",
	"emphasis",
	"blur",
	"select"
];
var HIGHLIGHT_ACTION_TYPE = "highlight";
var DOWNPLAY_ACTION_TYPE = "downplay";
var SELECT_ACTION_TYPE = "select";
var UNSELECT_ACTION_TYPE = "unselect";
var TOGGLE_SELECT_ACTION_TYPE = "toggleSelect";
var SELECT_CHANGED_EVENT_TYPE = "selectchanged";
function hasFillOrStroke(fillOrStroke) {
	return fillOrStroke != null && fillOrStroke !== "none";
}
function doChangeHoverState(el, stateName, hoverStateEnum) {
	if (el.onHoverStateChange && (el.hoverState || 0) !== hoverStateEnum) el.onHoverStateChange(stateName);
	el.hoverState = hoverStateEnum;
}
function singleEnterEmphasis(el) {
	doChangeHoverState(el, "emphasis", 2);
}
function singleLeaveEmphasis(el) {
	if (el.hoverState === 2) doChangeHoverState(el, "normal", 0);
}
function singleEnterBlur(el) {
	doChangeHoverState(el, "blur", 1);
}
function singleLeaveBlur(el) {
	if (el.hoverState === 1) doChangeHoverState(el, "normal", 0);
}
function singleEnterSelect(el) {
	el.selected = true;
}
function singleLeaveSelect(el) {
	el.selected = false;
}
function updateElementState(el, updater, commonParam) {
	updater(el, commonParam);
}
function traverseUpdateState(el, updater, commonParam) {
	updateElementState(el, updater, commonParam);
	el.isGroup && el.traverse(function(child) {
		updateElementState(child, updater, commonParam);
	});
}
function setStatesFlag(el, stateName) {
	switch (stateName) {
		case "emphasis":
			el.hoverState = 2;
			break;
		case "normal":
			el.hoverState = 0;
			break;
		case "blur":
			el.hoverState = 1;
			break;
		case "select": el.selected = true;
	}
}
function getFromStateStyle(el, props, toStateName, defaultValue) {
	var style = el.style;
	var fromState = {};
	for (var i = 0; i < props.length; i++) {
		var propName = props[i];
		var val = style[propName];
		fromState[propName] = val == null ? defaultValue && defaultValue[propName] : val;
	}
	for (var i = 0; i < el.animators.length; i++) {
		var animator = el.animators[i];
		if (animator.__fromStateTransition && animator.__fromStateTransition.indexOf(toStateName) < 0 && animator.targetName === "style") animator.saveTo(fromState, props);
	}
	return fromState;
}
function createEmphasisDefaultState(el, stateName, targetStates, state) {
	var hasSelect = targetStates && indexOf(targetStates, "select") >= 0;
	var cloned = false;
	if (el instanceof Path) {
		var store = getSavedStates(el);
		var fromFill = hasSelect ? store.selectFill || store.normalFill : store.normalFill;
		var fromStroke = hasSelect ? store.selectStroke || store.normalStroke : store.normalStroke;
		if (hasFillOrStroke(fromFill) || hasFillOrStroke(fromStroke)) {
			state = state || {};
			var emphasisStyle = state.style || {};
			if (emphasisStyle.fill === "inherit") {
				cloned = true;
				state = extend({}, state);
				emphasisStyle = extend({}, emphasisStyle);
				emphasisStyle.fill = fromFill;
			} else if (!hasFillOrStroke(emphasisStyle.fill) && hasFillOrStroke(fromFill)) {
				cloned = true;
				state = extend({}, state);
				emphasisStyle = extend({}, emphasisStyle);
				emphasisStyle.fill = liftColor(fromFill);
			} else if (!hasFillOrStroke(emphasisStyle.stroke) && hasFillOrStroke(fromStroke)) {
				if (!cloned) {
					state = extend({}, state);
					emphasisStyle = extend({}, emphasisStyle);
				}
				emphasisStyle.stroke = liftColor(fromStroke);
			}
			state.style = emphasisStyle;
		}
	}
	if (state) {
		if (state.z2 == null) {
			if (!cloned) state = extend({}, state);
			var z2EmphasisLift = el.z2EmphasisLift;
			state.z2 = el.z2 + (z2EmphasisLift != null ? z2EmphasisLift : 10);
		}
	}
	return state;
}
function createSelectDefaultState(el, stateName, state) {
	if (state) {
		if (state.z2 == null) {
			state = extend({}, state);
			var z2SelectLift = el.z2SelectLift;
			state.z2 = el.z2 + (z2SelectLift != null ? z2SelectLift : 9);
		}
	}
	return state;
}
function createBlurDefaultState(el, stateName, state) {
	var hasBlur = indexOf(el.currentStates, stateName) >= 0;
	var currentOpacity = el.style.opacity;
	var fromState = !hasBlur ? getFromStateStyle(el, ["opacity"], stateName, { opacity: 1 }) : null;
	state = state || {};
	var blurStyle = state.style || {};
	if (blurStyle.opacity == null) {
		state = extend({}, state);
		blurStyle = extend({ opacity: hasBlur ? currentOpacity : fromState.opacity * .1 }, blurStyle);
		state.style = blurStyle;
	}
	return state;
}
function elementStateProxy(stateName, targetStates) {
	var state = this.states[stateName];
	if (this.style) {
		if (stateName === "emphasis") return createEmphasisDefaultState(this, stateName, targetStates, state);
		else if (stateName === "blur") return createBlurDefaultState(this, stateName, state);
		else if (stateName === "select") return createSelectDefaultState(this, stateName, state);
	}
	return state;
}
/**
* Set hover style (namely "emphasis style") of element.
* @param el Should not be `zrender/graphic/Group`.
* @param focus 'self' | 'selfInSeries' | 'series'
*/
function setDefaultStateProxy(el) {
	el.stateProxy = elementStateProxy;
	var textContent = el.getTextContent();
	var textGuide = el.getTextGuideLine();
	if (textContent) textContent.stateProxy = elementStateProxy;
	if (textGuide) textGuide.stateProxy = elementStateProxy;
}
function enterEmphasisWhenMouseOver(el, e) {
	!shouldSilent(el, e) && !el.__highByOuter && traverseUpdateState(el, singleEnterEmphasis);
}
function leaveEmphasisWhenMouseOut(el, e) {
	!shouldSilent(el, e) && !el.__highByOuter && traverseUpdateState(el, singleLeaveEmphasis);
}
function enterEmphasis(el, highlightDigit) {
	el.__highByOuter |= 1 << (highlightDigit || 0);
	traverseUpdateState(el, singleEnterEmphasis);
}
function leaveEmphasis(el, highlightDigit) {
	!(el.__highByOuter &= ~(1 << (highlightDigit || 0))) && traverseUpdateState(el, singleLeaveEmphasis);
}
function enterBlur(el) {
	traverseUpdateState(el, singleEnterBlur);
}
function leaveBlur(el) {
	traverseUpdateState(el, singleLeaveBlur);
}
function enterSelect(el) {
	traverseUpdateState(el, singleEnterSelect);
}
function leaveSelect(el) {
	traverseUpdateState(el, singleLeaveSelect);
}
function shouldSilent(el, e) {
	return el.__highDownSilentOnTouch && e.zrByTouch;
}
function allLeaveBlur(api) {
	var model = api.getModel();
	var leaveBlurredSeries = [];
	var allComponentViews = [];
	model.eachComponent(function(componentType, componentModel) {
		var componentStates = getComponentStates(componentModel);
		var view = getViewOfComponentOrSeries(api, componentModel);
		var isSeries = componentType === "series";
		!isSeries && allComponentViews.push(view);
		if (componentStates.isBlured) {
			view.group.traverse(function(child) {
				singleLeaveBlur(child);
			});
			isSeries && leaveBlurredSeries.push(componentModel);
		}
		componentStates.isBlured = false;
	});
	each$1(allComponentViews, function(view) {
		if (view && view.toggleBlurSeries) view.toggleBlurSeries(leaveBlurredSeries, false, model);
	});
}
function blurSeries(targetSeriesIndex, focus, blurScope, api) {
	var ecModel = api.getModel();
	blurScope = blurScope || "coordinateSystem";
	function leaveBlurOfIndices(data, dataIndices) {
		for (var i = 0; i < dataIndices.length; i++) {
			var itemEl = data.getItemGraphicEl(dataIndices[i]);
			itemEl && leaveBlur(itemEl);
		}
	}
	if (targetSeriesIndex == null) return;
	if (!focus || focus === "none") return;
	var targetSeriesModel = ecModel.getSeriesByIndex(targetSeriesIndex);
	var targetCoordSys = targetSeriesModel.coordinateSystem;
	if (targetCoordSys && targetCoordSys.master) targetCoordSys = targetCoordSys.master;
	var blurredSeries = [];
	ecModel.eachSeries(function(seriesModel) {
		var sameSeries = targetSeriesModel === seriesModel;
		var coordSys = seriesModel.coordinateSystem;
		if (coordSys && coordSys.master) coordSys = coordSys.master;
		if (!(blurScope === "series" && !sameSeries || blurScope === "coordinateSystem" && !(coordSys && targetCoordSys ? coordSys === targetCoordSys : sameSeries) || focus === "series" && sameSeries)) {
			api.getViewOfSeriesModel(seriesModel).group.traverse(function(child) {
				if (child.__highByOuter && sameSeries && focus === "self") return;
				singleEnterBlur(child);
			});
			if (isArrayLike(focus)) leaveBlurOfIndices(seriesModel.getData(), focus);
			else if (isObject(focus)) {
				var dataTypes = keys(focus);
				for (var d = 0; d < dataTypes.length; d++) leaveBlurOfIndices(seriesModel.getData(dataTypes[d]), focus[dataTypes[d]]);
			}
			blurredSeries.push(seriesModel);
			getComponentStates(seriesModel).isBlured = true;
		}
	});
	ecModel.eachComponent(function(componentType, componentModel) {
		if (componentType === "series") return;
		var view = api.getViewOfComponentModel(componentModel);
		if (view && view.toggleBlurSeries) view.toggleBlurSeries(blurredSeries, true, ecModel);
	});
}
function blurComponent(componentMainType, componentIndex, api) {
	if (componentMainType == null || componentIndex == null) return;
	var componentModel = api.getModel().getComponent(componentMainType, componentIndex);
	if (!componentModel) return;
	getComponentStates(componentModel).isBlured = true;
	var view = api.getViewOfComponentModel(componentModel);
	if (!view || !view.focusBlurEnabled) return;
	view.group.traverse(function(child) {
		singleEnterBlur(child);
	});
}
function blurSeriesFromHighlightPayload(seriesModel, payload, api) {
	var seriesIndex = seriesModel.seriesIndex;
	var data = seriesModel.getData(payload.dataType);
	if (!data) return;
	var dataIndex = queryDataIndex(data, payload);
	dataIndex = (isArray(dataIndex) ? dataIndex[0] : dataIndex) || 0;
	var el = data.getItemGraphicEl(dataIndex);
	if (!el) {
		var count = data.count();
		var current = 0;
		while (!el && current < count) el = data.getItemGraphicEl(current++);
	}
	if (el) {
		var ecData = getECData(el);
		blurSeries(seriesIndex, ecData.focus, ecData.blurScope, api);
	} else {
		var focus_1 = seriesModel.get(["emphasis", "focus"]);
		var blurScope = seriesModel.get(["emphasis", "blurScope"]);
		if (focus_1 != null) blurSeries(seriesIndex, focus_1, blurScope, api);
	}
}
function findComponentHighDownDispatchers(componentMainType, componentIndex, name, api) {
	var ret = {
		focusSelf: false,
		dispatchers: null
	};
	if (componentMainType == null || componentMainType === "series" || componentIndex == null || name == null) return ret;
	var componentModel = api.getModel().getComponent(componentMainType, componentIndex);
	if (!componentModel) return ret;
	var view = api.getViewOfComponentModel(componentModel);
	if (!view || !view.findHighDownDispatchers) return ret;
	var dispatchers = view.findHighDownDispatchers(name);
	var focusSelf;
	for (var i = 0; i < dispatchers.length; i++) if (getECData(dispatchers[i]).focus === "self") {
		focusSelf = true;
		break;
	}
	return {
		focusSelf,
		dispatchers
	};
}
function handleGlobalMouseOverForHighDown(dispatcher, e, api) {
	var ecData = getECData(dispatcher);
	var _a = findComponentHighDownDispatchers(ecData.componentMainType, ecData.componentIndex, ecData.componentHighDownName, api), dispatchers = _a.dispatchers, focusSelf = _a.focusSelf;
	if (dispatchers) {
		if (focusSelf) blurComponent(ecData.componentMainType, ecData.componentIndex, api);
		each$1(dispatchers, function(dispatcher) {
			return enterEmphasisWhenMouseOver(dispatcher, e);
		});
	} else {
		blurSeries(ecData.seriesIndex, ecData.focus, ecData.blurScope, api);
		if (ecData.focus === "self") blurComponent(ecData.componentMainType, ecData.componentIndex, api);
		enterEmphasisWhenMouseOver(dispatcher, e);
	}
}
function handleGlobalMouseOutForHighDown(dispatcher, e, api) {
	allLeaveBlur(api);
	var ecData = getECData(dispatcher);
	var dispatchers = findComponentHighDownDispatchers(ecData.componentMainType, ecData.componentIndex, ecData.componentHighDownName, api).dispatchers;
	if (dispatchers) each$1(dispatchers, function(dispatcher) {
		return leaveEmphasisWhenMouseOut(dispatcher, e);
	});
	else leaveEmphasisWhenMouseOut(dispatcher, e);
}
function toggleSelectionFromPayload(seriesModel, payload, api) {
	if (!isSelectChangePayload(payload)) return;
	var dataType = payload.dataType;
	var dataIndex = queryDataIndex(seriesModel.getData(dataType), payload);
	if (!isArray(dataIndex)) dataIndex = [dataIndex];
	seriesModel[payload.type === "toggleSelect" ? "toggleSelect" : payload.type === "select" ? "select" : "unselect"](dataIndex, dataType);
}
function updateSeriesElementSelection(seriesModel) {
	var allData = seriesModel.getAllData();
	each$1(allData, function(_a) {
		var data = _a.data, type = _a.type;
		data.eachItemGraphicEl(function(el, idx) {
			seriesModel.isSelected(idx, type) ? enterSelect(el) : leaveSelect(el);
		});
	});
}
function getAllSelectedIndices(ecModel) {
	var ret = [];
	ecModel.eachSeries(function(seriesModel) {
		var allData = seriesModel.getAllData();
		each$1(allData, function(_a) {
			_a.data;
			var type = _a.type;
			var dataIndices = seriesModel.getSelectedDataIndices();
			if (dataIndices.length > 0) {
				var item = {
					dataIndex: dataIndices,
					seriesIndex: seriesModel.seriesIndex
				};
				if (type != null) item.dataType = type;
				ret.push(item);
			}
		});
	});
	return ret;
}
/**
* Enable the function that mouseover will trigger the emphasis state.
*
* NOTE:
* This function should be used on the element with dataIndex, seriesIndex.
*
*/
function enableHoverEmphasis(el, focus, blurScope) {
	setAsHighDownDispatcher(el, true);
	traverseUpdateState(el, setDefaultStateProxy);
	enableHoverFocus(el, focus, blurScope);
}
function disableHoverEmphasis(el) {
	setAsHighDownDispatcher(el, false);
}
function toggleHoverEmphasis(el, focus, blurScope, isDisabled) {
	isDisabled ? disableHoverEmphasis(el) : enableHoverEmphasis(el, focus, blurScope);
}
function enableHoverFocus(el, focus, blurScope) {
	var ecData = getECData(el);
	if (focus != null) {
		ecData.focus = focus;
		ecData.blurScope = blurScope;
	} else if (ecData.focus) ecData.focus = null;
}
var OTHER_STATES = [
	"emphasis",
	"blur",
	"select"
];
var defaultStyleGetterMap = {
	itemStyle: "getItemStyle",
	lineStyle: "getLineStyle",
	areaStyle: "getAreaStyle"
};
/**
* Set emphasis/blur/selected states of element.
*/
function setStatesStylesFromModel(el, itemModel, styleType, getter) {
	styleType = styleType || "itemStyle";
	for (var i = 0; i < OTHER_STATES.length; i++) {
		var stateName = OTHER_STATES[i];
		var model = itemModel.getModel([stateName, styleType]);
		var state = el.ensureState(stateName);
		state.style = getter ? getter(model) : model[defaultStyleGetterMap[styleType]]();
	}
}
/**
*
* Set element as highlight / downplay dispatcher.
* It will be checked when element received mouseover event or from highlight action.
* It's in change of all highlight/downplay behavior of it's children.
*
* @param el
* @param el.highDownSilentOnTouch
*        In touch device, mouseover event will be trigger on touchstart event
*        (see module:zrender/dom/HandlerProxy). By this mechanism, we can
*        conveniently use hoverStyle when tap on touch screen without additional
*        code for compatibility.
*        But if the chart/component has select feature, which usually also use
*        hoverStyle, there might be conflict between 'select-highlight' and
*        'hover-highlight' especially when roam is enabled (see geo for example).
*        In this case, `highDownSilentOnTouch` should be used to disable
*        hover-highlight on touch device.
* @param asDispatcher If `false`, do not set as "highDownDispatcher".
*/
function setAsHighDownDispatcher(el, asDispatcher) {
	var disable = asDispatcher === false;
	var extendedEl = el;
	if (el.highDownSilentOnTouch) extendedEl.__highDownSilentOnTouch = el.highDownSilentOnTouch;
	if (!disable || extendedEl.__highDownDispatcher) {
		extendedEl.__highByOuter = extendedEl.__highByOuter || 0;
		extendedEl.__highDownDispatcher = !disable;
	}
}
function isHighDownDispatcher(el) {
	return !!(el && el.__highDownDispatcher);
}
/**
* Support highlight/downplay record on each elements.
* For the case: hover highlight/downplay (legend, visualMap, ...) and
* user triggered highlight/downplay should not conflict.
* Only all of the highlightDigit cleared, return to normal.
* @param {string} highlightKey
* @return {number} highlightDigit
*/
function getHighlightDigit(highlightKey) {
	var highlightDigit = _highlightKeyMap[highlightKey];
	if (highlightDigit == null && _highlightNextDigit <= 32) highlightDigit = _highlightKeyMap[highlightKey] = _highlightNextDigit++;
	return highlightDigit;
}
function isSelectChangePayload(payload) {
	var payloadType = payload.type;
	return payloadType === "select" || payloadType === "unselect" || payloadType === "toggleSelect";
}
function isHighDownPayload(payload) {
	var payloadType = payload.type;
	return payloadType === "highlight" || payloadType === "downplay";
}
function savePathStates(el) {
	var store = getSavedStates(el);
	store.normalFill = el.style.fill;
	store.normalStroke = el.style.stroke;
	var selectState = el.states.select || {};
	store.selectFill = selectState.style && selectState.style.fill || null;
	store.selectStroke = selectState.style && selectState.style.stroke || null;
}
//#endregion
//#region node_modules/zrender/lib/tool/transformPath.js
var CMD = PathProxy.CMD;
var points = [
	[],
	[],
	[]
];
var mathSqrt$2 = Math.sqrt;
var mathAtan2 = Math.atan2;
function transformPath(path, m) {
	if (!m) return;
	var data = path.data;
	var len = path.len();
	var cmd;
	var nPoint;
	var i;
	var j;
	var k;
	var p;
	var M = CMD.M;
	var C = CMD.C;
	var L = CMD.L;
	var R = CMD.R;
	var A = CMD.A;
	var Q = CMD.Q;
	for (i = 0, j = 0; i < len;) {
		cmd = data[i++];
		j = i;
		nPoint = 0;
		switch (cmd) {
			case M:
				nPoint = 1;
				break;
			case L:
				nPoint = 1;
				break;
			case C:
				nPoint = 3;
				break;
			case Q:
				nPoint = 2;
				break;
			case A:
				var x = m[4];
				var y = m[5];
				var sx = mathSqrt$2(m[0] * m[0] + m[1] * m[1]);
				var sy = mathSqrt$2(m[2] * m[2] + m[3] * m[3]);
				var angle = mathAtan2(-m[1] / sy, m[0] / sx);
				data[i] *= sx;
				data[i++] += x;
				data[i] *= sy;
				data[i++] += y;
				data[i++] *= sx;
				data[i++] *= sy;
				data[i++] += angle;
				data[i++] += angle;
				i += 2;
				j = i;
				break;
			case R:
				p[0] = data[i++];
				p[1] = data[i++];
				applyTransform$1(p, p, m);
				data[j++] = p[0];
				data[j++] = p[1];
				p[0] += data[i++];
				p[1] += data[i++];
				applyTransform$1(p, p, m);
				data[j++] = p[0];
				data[j++] = p[1];
		}
		for (k = 0; k < nPoint; k++) {
			var p_1 = points[k];
			p_1[0] = data[i++];
			p_1[1] = data[i++];
			applyTransform$1(p_1, p_1, m);
			data[j++] = p_1[0];
			data[j++] = p_1[1];
		}
	}
	path.increaseVersion();
}
//#endregion
//#region node_modules/zrender/lib/tool/path.js
var mathSqrt$1 = Math.sqrt;
var mathSin$1 = Math.sin;
var mathCos$1 = Math.cos;
var PI$1 = Math.PI;
function vMag(v) {
	return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
}
function vRatio(u, v) {
	return (u[0] * v[0] + u[1] * v[1]) / (vMag(u) * vMag(v));
}
function vAngle(u, v) {
	return (u[0] * v[1] < u[1] * v[0] ? -1 : 1) * Math.acos(vRatio(u, v));
}
function processArc(x1, y1, x2, y2, fa, fs, rx, ry, psiDeg, cmd, path) {
	var psi = psiDeg * (PI$1 / 180);
	var xp = mathCos$1(psi) * (x1 - x2) / 2 + mathSin$1(psi) * (y1 - y2) / 2;
	var yp = -1 * mathSin$1(psi) * (x1 - x2) / 2 + mathCos$1(psi) * (y1 - y2) / 2;
	var lambda = xp * xp / (rx * rx) + yp * yp / (ry * ry);
	if (lambda > 1) {
		rx *= mathSqrt$1(lambda);
		ry *= mathSqrt$1(lambda);
	}
	var f = (fa === fs ? -1 : 1) * mathSqrt$1((rx * rx * (ry * ry) - rx * rx * (yp * yp) - ry * ry * (xp * xp)) / (rx * rx * (yp * yp) + ry * ry * (xp * xp))) || 0;
	var cxp = f * rx * yp / ry;
	var cyp = f * -ry * xp / rx;
	var cx = (x1 + x2) / 2 + mathCos$1(psi) * cxp - mathSin$1(psi) * cyp;
	var cy = (y1 + y2) / 2 + mathSin$1(psi) * cxp + mathCos$1(psi) * cyp;
	var theta = vAngle([1, 0], [(xp - cxp) / rx, (yp - cyp) / ry]);
	var u = [(xp - cxp) / rx, (yp - cyp) / ry];
	var v = [(-1 * xp - cxp) / rx, (-1 * yp - cyp) / ry];
	var dTheta = vAngle(u, v);
	if (vRatio(u, v) <= -1) dTheta = PI$1;
	if (vRatio(u, v) >= 1) dTheta = 0;
	if (dTheta < 0) {
		var n = Math.round(dTheta / PI$1 * 1e6) / 1e6;
		dTheta = PI$1 * 2 + n % 2 * PI$1;
	}
	path.addData(cmd, cx, cy, rx, ry, theta, dTheta, psi, fs);
}
var commandReg = /([mlvhzcqtsa])([^mlvhzcqtsa]*)/gi;
var numberReg = /-?([0-9]*\.)?[0-9]+([eE]-?[0-9]+)?/g;
function createPathProxyFromString(data) {
	var path = new PathProxy();
	if (!data) return path;
	var cpx = 0;
	var cpy = 0;
	var subpathX = cpx;
	var subpathY = cpy;
	var prevCmd;
	var CMD = PathProxy.CMD;
	var cmdList = data.match(commandReg);
	if (!cmdList) return path;
	for (var l = 0; l < cmdList.length; l++) {
		var cmdText = cmdList[l];
		var cmdStr = cmdText.charAt(0);
		var cmd = void 0;
		var p = cmdText.match(numberReg) || [];
		var pLen = p.length;
		for (var i = 0; i < pLen; i++) p[i] = parseFloat(p[i]);
		var off = 0;
		while (off < pLen) {
			var ctlPtx = void 0;
			var ctlPty = void 0;
			var rx = void 0;
			var ry = void 0;
			var psi = void 0;
			var fa = void 0;
			var fs = void 0;
			var x1 = cpx;
			var y1 = cpy;
			var len = void 0;
			var pathData = void 0;
			switch (cmdStr) {
				case "l":
					cpx += p[off++];
					cpy += p[off++];
					cmd = CMD.L;
					path.addData(cmd, cpx, cpy);
					break;
				case "L":
					cpx = p[off++];
					cpy = p[off++];
					cmd = CMD.L;
					path.addData(cmd, cpx, cpy);
					break;
				case "m":
					cpx += p[off++];
					cpy += p[off++];
					cmd = CMD.M;
					path.addData(cmd, cpx, cpy);
					subpathX = cpx;
					subpathY = cpy;
					cmdStr = "l";
					break;
				case "M":
					cpx = p[off++];
					cpy = p[off++];
					cmd = CMD.M;
					path.addData(cmd, cpx, cpy);
					subpathX = cpx;
					subpathY = cpy;
					cmdStr = "L";
					break;
				case "h":
					cpx += p[off++];
					cmd = CMD.L;
					path.addData(cmd, cpx, cpy);
					break;
				case "H":
					cpx = p[off++];
					cmd = CMD.L;
					path.addData(cmd, cpx, cpy);
					break;
				case "v":
					cpy += p[off++];
					cmd = CMD.L;
					path.addData(cmd, cpx, cpy);
					break;
				case "V":
					cpy = p[off++];
					cmd = CMD.L;
					path.addData(cmd, cpx, cpy);
					break;
				case "C":
					cmd = CMD.C;
					path.addData(cmd, p[off++], p[off++], p[off++], p[off++], p[off++], p[off++]);
					cpx = p[off - 2];
					cpy = p[off - 1];
					break;
				case "c":
					cmd = CMD.C;
					path.addData(cmd, p[off++] + cpx, p[off++] + cpy, p[off++] + cpx, p[off++] + cpy, p[off++] + cpx, p[off++] + cpy);
					cpx += p[off - 2];
					cpy += p[off - 1];
					break;
				case "S":
					ctlPtx = cpx;
					ctlPty = cpy;
					len = path.len();
					pathData = path.data;
					if (prevCmd === CMD.C) {
						ctlPtx += cpx - pathData[len - 4];
						ctlPty += cpy - pathData[len - 3];
					}
					cmd = CMD.C;
					x1 = p[off++];
					y1 = p[off++];
					cpx = p[off++];
					cpy = p[off++];
					path.addData(cmd, ctlPtx, ctlPty, x1, y1, cpx, cpy);
					break;
				case "s":
					ctlPtx = cpx;
					ctlPty = cpy;
					len = path.len();
					pathData = path.data;
					if (prevCmd === CMD.C) {
						ctlPtx += cpx - pathData[len - 4];
						ctlPty += cpy - pathData[len - 3];
					}
					cmd = CMD.C;
					x1 = cpx + p[off++];
					y1 = cpy + p[off++];
					cpx += p[off++];
					cpy += p[off++];
					path.addData(cmd, ctlPtx, ctlPty, x1, y1, cpx, cpy);
					break;
				case "Q":
					x1 = p[off++];
					y1 = p[off++];
					cpx = p[off++];
					cpy = p[off++];
					cmd = CMD.Q;
					path.addData(cmd, x1, y1, cpx, cpy);
					break;
				case "q":
					x1 = p[off++] + cpx;
					y1 = p[off++] + cpy;
					cpx += p[off++];
					cpy += p[off++];
					cmd = CMD.Q;
					path.addData(cmd, x1, y1, cpx, cpy);
					break;
				case "T":
					ctlPtx = cpx;
					ctlPty = cpy;
					len = path.len();
					pathData = path.data;
					if (prevCmd === CMD.Q) {
						ctlPtx += cpx - pathData[len - 4];
						ctlPty += cpy - pathData[len - 3];
					}
					cpx = p[off++];
					cpy = p[off++];
					cmd = CMD.Q;
					path.addData(cmd, ctlPtx, ctlPty, cpx, cpy);
					break;
				case "t":
					ctlPtx = cpx;
					ctlPty = cpy;
					len = path.len();
					pathData = path.data;
					if (prevCmd === CMD.Q) {
						ctlPtx += cpx - pathData[len - 4];
						ctlPty += cpy - pathData[len - 3];
					}
					cpx += p[off++];
					cpy += p[off++];
					cmd = CMD.Q;
					path.addData(cmd, ctlPtx, ctlPty, cpx, cpy);
					break;
				case "A":
					rx = p[off++];
					ry = p[off++];
					psi = p[off++];
					fa = p[off++];
					fs = p[off++];
					x1 = cpx, y1 = cpy;
					cpx = p[off++];
					cpy = p[off++];
					cmd = CMD.A;
					processArc(x1, y1, cpx, cpy, fa, fs, rx, ry, psi, cmd, path);
					break;
				case "a":
					rx = p[off++];
					ry = p[off++];
					psi = p[off++];
					fa = p[off++];
					fs = p[off++];
					x1 = cpx, y1 = cpy;
					cpx += p[off++];
					cpy += p[off++];
					cmd = CMD.A;
					processArc(x1, y1, cpx, cpy, fa, fs, rx, ry, psi, cmd, path);
			}
		}
		if (cmdStr === "z" || cmdStr === "Z") {
			cmd = CMD.Z;
			path.addData(cmd);
			cpx = subpathX;
			cpy = subpathY;
		}
		prevCmd = cmd;
	}
	path.toStatic();
	return path;
}
var SVGPath = function(_super) {
	__extends(SVGPath, _super);
	function SVGPath() {
		return _super !== null && _super.apply(this, arguments) || this;
	}
	SVGPath.prototype.applyTransform = function(m) {};
	return SVGPath;
}(Path);
function isPathProxy(path) {
	return path.setData != null;
}
function createPathOptions(str, opts) {
	var pathProxy = createPathProxyFromString(str);
	var innerOpts = extend({}, opts);
	innerOpts.buildPath = function(path) {
		var beProxy = isPathProxy(path);
		if (beProxy && path.canSave()) {
			path.appendPath(pathProxy);
			var ctx = path.getContext();
			if (ctx) path.rebuildPath(ctx, 1);
		} else {
			var ctx = beProxy ? path.getContext() : path;
			if (ctx) pathProxy.rebuildPath(ctx, 1);
		}
	};
	innerOpts.applyTransform = function(m) {
		transformPath(pathProxy, m);
		this.dirtyShape();
	};
	return innerOpts;
}
function createFromString(str, opts) {
	return new SVGPath(createPathOptions(str, opts));
}
function extendFromString(str, defaultOpts) {
	var innerOpts = createPathOptions(str, defaultOpts);
	return function(_super) {
		__extends(Sub, _super);
		function Sub(opts) {
			var _this = _super.call(this, opts) || this;
			_this.applyTransform = innerOpts.applyTransform;
			_this.buildPath = innerOpts.buildPath;
			return _this;
		}
		return Sub;
	}(SVGPath);
}
function mergePath$1(pathEls, opts) {
	var pathList = [];
	var len = pathEls.length;
	for (var i = 0; i < len; i++) {
		var pathEl = pathEls[i];
		pathList.push(pathEl.getUpdatedPathProxy(true));
	}
	var pathBundle = new Path(opts);
	pathBundle.createPathProxy();
	pathBundle.buildPath = function(path) {
		if (isPathProxy(path)) {
			path.appendPath(pathList);
			var ctx = path.getContext();
			if (ctx) path.rebuildPath(ctx, 1);
		}
	};
	return pathBundle;
}
//#endregion
//#region node_modules/zrender/lib/graphic/Group.js
var Group = function(_super) {
	__extends(Group, _super);
	function Group(opts) {
		var _this = _super.call(this) || this;
		_this.isGroup = true;
		_this._children = [];
		_this.attr(opts);
		return _this;
	}
	Group.prototype.childrenRef = function() {
		return this._children;
	};
	Group.prototype.children = function() {
		return this._children.slice();
	};
	Group.prototype.childAt = function(idx) {
		return this._children[idx];
	};
	Group.prototype.childOfName = function(name) {
		var children = this._children;
		for (var i = 0; i < children.length; i++) if (children[i].name === name) return children[i];
	};
	Group.prototype.childCount = function() {
		return this._children.length;
	};
	Group.prototype.add = function(child) {
		if (child) {
			if (child !== this && child.parent !== this) {
				this._children.push(child);
				this._doAdd(child);
			}
		}
		return this;
	};
	Group.prototype.addBefore = function(child, nextSibling) {
		if (child && child !== this && child.parent !== this && nextSibling && nextSibling.parent === this) {
			var children = this._children;
			var idx = children.indexOf(nextSibling);
			if (idx >= 0) {
				children.splice(idx, 0, child);
				this._doAdd(child);
			}
		}
		return this;
	};
	Group.prototype.replace = function(oldChild, newChild) {
		var idx = indexOf(this._children, oldChild);
		if (idx >= 0) this.replaceAt(newChild, idx);
		return this;
	};
	Group.prototype.replaceAt = function(child, index) {
		var children = this._children;
		var old = children[index];
		if (child && child !== this && child.parent !== this && child !== old) {
			children[index] = child;
			old.parent = null;
			var zr = this.__zr;
			if (zr) old.removeSelfFromZr(zr);
			this._doAdd(child);
		}
		return this;
	};
	Group.prototype._doAdd = function(child) {
		if (child.parent) child.parent.remove(child);
		child.parent = this;
		var zr = this.__zr;
		if (zr && zr !== child.__zr) child.addSelfToZr(zr);
		zr && zr.refresh();
	};
	Group.prototype.remove = function(child) {
		var zr = this.__zr;
		var children = this._children;
		var idx = indexOf(children, child);
		if (idx < 0) return this;
		children.splice(idx, 1);
		child.parent = null;
		if (zr) child.removeSelfFromZr(zr);
		zr && zr.refresh();
		return this;
	};
	Group.prototype.removeAll = function() {
		var children = this._children;
		var zr = this.__zr;
		for (var i = 0; i < children.length; i++) {
			var child = children[i];
			if (zr) child.removeSelfFromZr(zr);
			child.parent = null;
		}
		children.length = 0;
		return this;
	};
	Group.prototype.eachChild = function(cb, context) {
		var children = this._children;
		for (var i = 0; i < children.length; i++) {
			var child = children[i];
			cb.call(context, child, i);
		}
		return this;
	};
	Group.prototype.traverse = function(cb, context) {
		for (var i = 0; i < this._children.length; i++) {
			var child = this._children[i];
			var stopped = cb.call(context, child);
			if (child.isGroup && !stopped) child.traverse(cb, context);
		}
		return this;
	};
	Group.prototype.addSelfToZr = function(zr) {
		_super.prototype.addSelfToZr.call(this, zr);
		for (var i = 0; i < this._children.length; i++) this._children[i].addSelfToZr(zr);
	};
	Group.prototype.removeSelfFromZr = function(zr) {
		_super.prototype.removeSelfFromZr.call(this, zr);
		for (var i = 0; i < this._children.length; i++) this._children[i].removeSelfFromZr(zr);
	};
	Group.prototype.getBoundingRect = function(includeChildren) {
		var tmpRect = new BoundingRect(0, 0, 0, 0);
		var children = includeChildren || this._children;
		var tmpMat = [];
		var rect = null;
		for (var i = 0; i < children.length; i++) {
			var child = children[i];
			if (child.ignore || child.invisible) continue;
			var childRect = child.getBoundingRect();
			var transform = child.getLocalTransform(tmpMat);
			if (transform) {
				BoundingRect.applyTransform(tmpRect, childRect, transform);
				rect = rect || tmpRect.clone();
				rect.union(tmpRect);
			} else {
				rect = rect || childRect.clone();
				rect.union(childRect);
			}
		}
		return rect || tmpRect;
	};
	return Group;
}(Element);
Group.prototype.type = "group";
//#endregion
//#region node_modules/zrender/lib/graphic/shape/Circle.js
var CircleShape = function() {
	function CircleShape() {
		this.cx = 0;
		this.cy = 0;
		this.r = 0;
	}
	return CircleShape;
}();
var Circle = function(_super) {
	__extends(Circle, _super);
	function Circle(opts) {
		return _super.call(this, opts) || this;
	}
	Circle.prototype.getDefaultShape = function() {
		return new CircleShape();
	};
	Circle.prototype.buildPath = function(ctx, shape) {
		ctx.moveTo(shape.cx + shape.r, shape.cy);
		ctx.arc(shape.cx, shape.cy, shape.r, 0, Math.PI * 2);
	};
	return Circle;
}(Path);
Circle.prototype.type = "circle";
//#endregion
//#region node_modules/zrender/lib/graphic/shape/Ellipse.js
var EllipseShape = function() {
	function EllipseShape() {
		this.cx = 0;
		this.cy = 0;
		this.rx = 0;
		this.ry = 0;
	}
	return EllipseShape;
}();
var Ellipse = function(_super) {
	__extends(Ellipse, _super);
	function Ellipse(opts) {
		return _super.call(this, opts) || this;
	}
	Ellipse.prototype.getDefaultShape = function() {
		return new EllipseShape();
	};
	Ellipse.prototype.buildPath = function(ctx, shape) {
		var k = .5522848;
		var x = shape.cx;
		var y = shape.cy;
		var a = shape.rx;
		var b = shape.ry;
		var ox = a * k;
		var oy = b * k;
		ctx.moveTo(x - a, y);
		ctx.bezierCurveTo(x - a, y - oy, x - ox, y - b, x, y - b);
		ctx.bezierCurveTo(x + ox, y - b, x + a, y - oy, x + a, y);
		ctx.bezierCurveTo(x + a, y + oy, x + ox, y + b, x, y + b);
		ctx.bezierCurveTo(x - ox, y + b, x - a, y + oy, x - a, y);
		ctx.closePath();
	};
	return Ellipse;
}(Path);
Ellipse.prototype.type = "ellipse";
//#endregion
//#region node_modules/zrender/lib/graphic/helper/roundSector.js
var PI = Math.PI;
var PI2 = PI * 2;
var mathSin = Math.sin;
var mathCos = Math.cos;
var mathACos = Math.acos;
var mathATan2 = Math.atan2;
var mathAbs$1 = Math.abs;
var mathSqrt = Math.sqrt;
var mathMax$1 = Math.max;
var mathMin$1 = Math.min;
var e = 1e-4;
function intersect(x0, y0, x1, y1, x2, y2, x3, y3) {
	var dx10 = x1 - x0;
	var dy10 = y1 - y0;
	var dx32 = x3 - x2;
	var dy32 = y3 - y2;
	var t = dy32 * dx10 - dx32 * dy10;
	if (t * t < e) return;
	t = (dx32 * (y0 - y2) - dy32 * (x0 - x2)) / t;
	return [x0 + t * dx10, y0 + t * dy10];
}
function computeCornerTangents(x0, y0, x1, y1, radius, cr, clockwise) {
	var x01 = x0 - x1;
	var y01 = y0 - y1;
	var lo = (clockwise ? cr : -cr) / mathSqrt(x01 * x01 + y01 * y01);
	var ox = lo * y01;
	var oy = -lo * x01;
	var x11 = x0 + ox;
	var y11 = y0 + oy;
	var x10 = x1 + ox;
	var y10 = y1 + oy;
	var x00 = (x11 + x10) / 2;
	var y00 = (y11 + y10) / 2;
	var dx = x10 - x11;
	var dy = y10 - y11;
	var d2 = dx * dx + dy * dy;
	var r = radius - cr;
	var s = x11 * y10 - x10 * y11;
	var d = (dy < 0 ? -1 : 1) * mathSqrt(mathMax$1(0, r * r * d2 - s * s));
	var cx0 = (s * dy - dx * d) / d2;
	var cy0 = (-s * dx - dy * d) / d2;
	var cx1 = (s * dy + dx * d) / d2;
	var cy1 = (-s * dx + dy * d) / d2;
	var dx0 = cx0 - x00;
	var dy0 = cy0 - y00;
	var dx1 = cx1 - x00;
	var dy1 = cy1 - y00;
	if (dx0 * dx0 + dy0 * dy0 > dx1 * dx1 + dy1 * dy1) {
		cx0 = cx1;
		cy0 = cy1;
	}
	return {
		cx: cx0,
		cy: cy0,
		x0: -ox,
		y0: -oy,
		x1: cx0 * (radius / r - 1),
		y1: cy0 * (radius / r - 1)
	};
}
function normalizeCornerRadius(cr) {
	var arr;
	if (isArray(cr)) {
		var len = cr.length;
		if (!len) return cr;
		if (len === 1) arr = [
			cr[0],
			cr[0],
			0,
			0
		];
		else if (len === 2) arr = [
			cr[0],
			cr[0],
			cr[1],
			cr[1]
		];
		else if (len === 3) arr = cr.concat(cr[2]);
		else arr = cr;
	} else arr = [
		cr,
		cr,
		cr,
		cr
	];
	return arr;
}
function buildPath$1(ctx, shape) {
	var _a;
	var radius = mathMax$1(shape.r, 0);
	var innerRadius = mathMax$1(shape.r0 || 0, 0);
	var hasRadius = radius > 0;
	if (!hasRadius && !(innerRadius > 0)) return;
	if (!hasRadius) {
		radius = innerRadius;
		innerRadius = 0;
	}
	if (innerRadius > radius) {
		var tmp = radius;
		radius = innerRadius;
		innerRadius = tmp;
	}
	var startAngle = shape.startAngle, endAngle = shape.endAngle;
	if (isNaN(startAngle) || isNaN(endAngle)) return;
	var cx = shape.cx, cy = shape.cy;
	var clockwise = !!shape.clockwise;
	var arc = mathAbs$1(endAngle - startAngle);
	var mod = arc > PI2 && arc % PI2;
	mod > e && (arc = mod);
	if (!(radius > e)) ctx.moveTo(cx, cy);
	else if (arc > PI2 - e) {
		ctx.moveTo(cx + radius * mathCos(startAngle), cy + radius * mathSin(startAngle));
		ctx.arc(cx, cy, radius, startAngle, endAngle, !clockwise);
		if (innerRadius > e) {
			ctx.moveTo(cx + innerRadius * mathCos(endAngle), cy + innerRadius * mathSin(endAngle));
			ctx.arc(cx, cy, innerRadius, endAngle, startAngle, clockwise);
		}
	} else {
		var icrStart = void 0;
		var icrEnd = void 0;
		var ocrStart = void 0;
		var ocrEnd = void 0;
		var ocrs = void 0;
		var ocre = void 0;
		var icrs = void 0;
		var icre = void 0;
		var ocrMax = void 0;
		var icrMax = void 0;
		var limitedOcrMax = void 0;
		var limitedIcrMax = void 0;
		var xre = void 0;
		var yre = void 0;
		var xirs = void 0;
		var yirs = void 0;
		var xrs = radius * mathCos(startAngle);
		var yrs = radius * mathSin(startAngle);
		var xire = innerRadius * mathCos(endAngle);
		var yire = innerRadius * mathSin(endAngle);
		var hasArc = arc > e;
		if (hasArc) {
			var cornerRadius = shape.cornerRadius;
			if (cornerRadius) _a = normalizeCornerRadius(cornerRadius), icrStart = _a[0], icrEnd = _a[1], ocrStart = _a[2], ocrEnd = _a[3];
			var halfRd = mathAbs$1(radius - innerRadius) / 2;
			ocrs = mathMin$1(halfRd, ocrStart);
			ocre = mathMin$1(halfRd, ocrEnd);
			icrs = mathMin$1(halfRd, icrStart);
			icre = mathMin$1(halfRd, icrEnd);
			limitedOcrMax = ocrMax = mathMax$1(ocrs, ocre);
			limitedIcrMax = icrMax = mathMax$1(icrs, icre);
			if (ocrMax > e || icrMax > e) {
				xre = radius * mathCos(endAngle);
				yre = radius * mathSin(endAngle);
				xirs = innerRadius * mathCos(startAngle);
				yirs = innerRadius * mathSin(startAngle);
				if (arc < PI) {
					var it_1 = intersect(xrs, yrs, xirs, yirs, xre, yre, xire, yire);
					if (it_1) {
						var x0 = xrs - it_1[0];
						var y0 = yrs - it_1[1];
						var x1 = xre - it_1[0];
						var y1 = yre - it_1[1];
						var a = 1 / mathSin(mathACos((x0 * x1 + y0 * y1) / (mathSqrt(x0 * x0 + y0 * y0) * mathSqrt(x1 * x1 + y1 * y1))) / 2);
						var b = mathSqrt(it_1[0] * it_1[0] + it_1[1] * it_1[1]);
						limitedOcrMax = mathMin$1(ocrMax, (radius - b) / (a + 1));
						limitedIcrMax = mathMin$1(icrMax, (innerRadius - b) / (a - 1));
					}
				}
			}
		}
		if (!hasArc) ctx.moveTo(cx + xrs, cy + yrs);
		else if (limitedOcrMax > e) {
			var crStart = mathMin$1(ocrStart, limitedOcrMax);
			var crEnd = mathMin$1(ocrEnd, limitedOcrMax);
			var ct0 = computeCornerTangents(xirs, yirs, xrs, yrs, radius, crStart, clockwise);
			var ct1 = computeCornerTangents(xre, yre, xire, yire, radius, crEnd, clockwise);
			ctx.moveTo(cx + ct0.cx + ct0.x0, cy + ct0.cy + ct0.y0);
			if (limitedOcrMax < ocrMax && crStart === crEnd) ctx.arc(cx + ct0.cx, cy + ct0.cy, limitedOcrMax, mathATan2(ct0.y0, ct0.x0), mathATan2(ct1.y0, ct1.x0), !clockwise);
			else {
				crStart > 0 && ctx.arc(cx + ct0.cx, cy + ct0.cy, crStart, mathATan2(ct0.y0, ct0.x0), mathATan2(ct0.y1, ct0.x1), !clockwise);
				ctx.arc(cx, cy, radius, mathATan2(ct0.cy + ct0.y1, ct0.cx + ct0.x1), mathATan2(ct1.cy + ct1.y1, ct1.cx + ct1.x1), !clockwise);
				crEnd > 0 && ctx.arc(cx + ct1.cx, cy + ct1.cy, crEnd, mathATan2(ct1.y1, ct1.x1), mathATan2(ct1.y0, ct1.x0), !clockwise);
			}
		} else {
			ctx.moveTo(cx + xrs, cy + yrs);
			ctx.arc(cx, cy, radius, startAngle, endAngle, !clockwise);
		}
		if (!(innerRadius > e) || !hasArc) ctx.lineTo(cx + xire, cy + yire);
		else if (limitedIcrMax > e) {
			var crStart = mathMin$1(icrStart, limitedIcrMax);
			var crEnd = mathMin$1(icrEnd, limitedIcrMax);
			var ct0 = computeCornerTangents(xire, yire, xre, yre, innerRadius, -crEnd, clockwise);
			var ct1 = computeCornerTangents(xrs, yrs, xirs, yirs, innerRadius, -crStart, clockwise);
			ctx.lineTo(cx + ct0.cx + ct0.x0, cy + ct0.cy + ct0.y0);
			if (limitedIcrMax < icrMax && crStart === crEnd) ctx.arc(cx + ct0.cx, cy + ct0.cy, limitedIcrMax, mathATan2(ct0.y0, ct0.x0), mathATan2(ct1.y0, ct1.x0), !clockwise);
			else {
				crEnd > 0 && ctx.arc(cx + ct0.cx, cy + ct0.cy, crEnd, mathATan2(ct0.y0, ct0.x0), mathATan2(ct0.y1, ct0.x1), !clockwise);
				ctx.arc(cx, cy, innerRadius, mathATan2(ct0.cy + ct0.y1, ct0.cx + ct0.x1), mathATan2(ct1.cy + ct1.y1, ct1.cx + ct1.x1), clockwise);
				crStart > 0 && ctx.arc(cx + ct1.cx, cy + ct1.cy, crStart, mathATan2(ct1.y1, ct1.x1), mathATan2(ct1.y0, ct1.x0), !clockwise);
			}
		} else {
			ctx.lineTo(cx + xire, cy + yire);
			ctx.arc(cx, cy, innerRadius, endAngle, startAngle, clockwise);
		}
	}
	ctx.closePath();
}
//#endregion
//#region node_modules/zrender/lib/graphic/shape/Sector.js
var SectorShape = function() {
	function SectorShape() {
		this.cx = 0;
		this.cy = 0;
		this.r0 = 0;
		this.r = 0;
		this.startAngle = 0;
		this.endAngle = Math.PI * 2;
		this.clockwise = true;
		this.cornerRadius = 0;
	}
	return SectorShape;
}();
var Sector = function(_super) {
	__extends(Sector, _super);
	function Sector(opts) {
		return _super.call(this, opts) || this;
	}
	Sector.prototype.getDefaultShape = function() {
		return new SectorShape();
	};
	Sector.prototype.buildPath = function(ctx, shape) {
		buildPath$1(ctx, shape);
	};
	Sector.prototype.isZeroArea = function() {
		return this.shape.startAngle === this.shape.endAngle || this.shape.r === this.shape.r0;
	};
	return Sector;
}(Path);
Sector.prototype.type = "sector";
//#endregion
//#region node_modules/zrender/lib/graphic/shape/Ring.js
var RingShape = function() {
	function RingShape() {
		this.cx = 0;
		this.cy = 0;
		this.r = 0;
		this.r0 = 0;
	}
	return RingShape;
}();
var Ring = function(_super) {
	__extends(Ring, _super);
	function Ring(opts) {
		return _super.call(this, opts) || this;
	}
	Ring.prototype.getDefaultShape = function() {
		return new RingShape();
	};
	Ring.prototype.buildPath = function(ctx, shape) {
		var x = shape.cx;
		var y = shape.cy;
		var PI2 = Math.PI * 2;
		ctx.moveTo(x + shape.r, y);
		ctx.arc(x, y, shape.r, 0, PI2, false);
		ctx.moveTo(x + shape.r0, y);
		ctx.arc(x, y, shape.r0, 0, PI2, true);
	};
	return Ring;
}(Path);
Ring.prototype.type = "ring";
//#endregion
//#region node_modules/zrender/lib/graphic/helper/smoothBezier.js
function smoothBezier(points, smooth, isLoop, constraint) {
	var cps = [];
	var v = [];
	var v1 = [];
	var v2 = [];
	var prevPoint;
	var nextPoint;
	var min$1;
	var max$1;
	if (constraint) {
		min$1 = [Infinity, Infinity];
		max$1 = [-Infinity, -Infinity];
		for (var i = 0, len = points.length; i < len; i++) {
			min(min$1, min$1, points[i]);
			max(max$1, max$1, points[i]);
		}
		min(min$1, min$1, constraint[0]);
		max(max$1, max$1, constraint[1]);
	}
	for (var i = 0, len = points.length; i < len; i++) {
		var point = points[i];
		if (isLoop) {
			prevPoint = points[i ? i - 1 : len - 1];
			nextPoint = points[(i + 1) % len];
		} else if (i === 0 || i === len - 1) {
			cps.push(clone(points[i]));
			continue;
		} else {
			prevPoint = points[i - 1];
			nextPoint = points[i + 1];
		}
		sub(v, nextPoint, prevPoint);
		scale(v, v, smooth);
		var d0 = distance(point, prevPoint);
		var d1 = distance(point, nextPoint);
		var sum = d0 + d1;
		if (sum !== 0) {
			d0 /= sum;
			d1 /= sum;
		}
		scale(v1, v, -d0);
		scale(v2, v, d1);
		var cp0 = add([], point, v1);
		var cp1 = add([], point, v2);
		if (constraint) {
			max(cp0, cp0, min$1);
			min(cp0, cp0, max$1);
			max(cp1, cp1, min$1);
			min(cp1, cp1, max$1);
		}
		cps.push(cp0);
		cps.push(cp1);
	}
	if (isLoop) cps.push(cps.shift());
	return cps;
}
//#endregion
//#region node_modules/zrender/lib/graphic/helper/poly.js
function buildPath(ctx, shape, closePath) {
	var smooth = shape.smooth;
	var points = shape.points;
	if (points && points.length >= 2) {
		if (smooth) {
			var controlPoints = smoothBezier(points, smooth, closePath, shape.smoothConstraint);
			ctx.moveTo(points[0][0], points[0][1]);
			var len = points.length;
			for (var i = 0; i < (closePath ? len : len - 1); i++) {
				var cp1 = controlPoints[i * 2];
				var cp2 = controlPoints[i * 2 + 1];
				var p = points[(i + 1) % len];
				ctx.bezierCurveTo(cp1[0], cp1[1], cp2[0], cp2[1], p[0], p[1]);
			}
		} else {
			ctx.moveTo(points[0][0], points[0][1]);
			for (var i = 1, l = points.length; i < l; i++) ctx.lineTo(points[i][0], points[i][1]);
		}
		closePath && ctx.closePath();
	}
}
//#endregion
//#region node_modules/zrender/lib/graphic/shape/Polygon.js
var PolygonShape = function() {
	function PolygonShape() {
		this.points = null;
		this.smooth = 0;
		this.smoothConstraint = null;
	}
	return PolygonShape;
}();
var Polygon = function(_super) {
	__extends(Polygon, _super);
	function Polygon(opts) {
		return _super.call(this, opts) || this;
	}
	Polygon.prototype.getDefaultShape = function() {
		return new PolygonShape();
	};
	Polygon.prototype.buildPath = function(ctx, shape) {
		buildPath(ctx, shape, true);
	};
	return Polygon;
}(Path);
Polygon.prototype.type = "polygon";
//#endregion
//#region node_modules/zrender/lib/graphic/shape/Polyline.js
var PolylineShape = function() {
	function PolylineShape() {
		this.points = null;
		this.percent = 1;
		this.smooth = 0;
		this.smoothConstraint = null;
	}
	return PolylineShape;
}();
var Polyline = function(_super) {
	__extends(Polyline, _super);
	function Polyline(opts) {
		return _super.call(this, opts) || this;
	}
	Polyline.prototype.getDefaultStyle = function() {
		return {
			stroke: "#000",
			fill: null
		};
	};
	Polyline.prototype.getDefaultShape = function() {
		return new PolylineShape();
	};
	Polyline.prototype.buildPath = function(ctx, shape) {
		buildPath(ctx, shape, false);
	};
	return Polyline;
}(Path);
Polyline.prototype.type = "polyline";
//#endregion
//#region node_modules/zrender/lib/graphic/shape/Line.js
var subPixelOptimizeOutputShape = {};
var LineShape = function() {
	function LineShape() {
		this.x1 = 0;
		this.y1 = 0;
		this.x2 = 0;
		this.y2 = 0;
		this.percent = 1;
	}
	return LineShape;
}();
var Line = function(_super) {
	__extends(Line, _super);
	function Line(opts) {
		return _super.call(this, opts) || this;
	}
	Line.prototype.getDefaultStyle = function() {
		return {
			stroke: "#000",
			fill: null
		};
	};
	Line.prototype.getDefaultShape = function() {
		return new LineShape();
	};
	Line.prototype.buildPath = function(ctx, shape) {
		var x1;
		var y1;
		var x2;
		var y2;
		if (this.subPixelOptimize) {
			var optimizedShape = subPixelOptimizeLine$1(subPixelOptimizeOutputShape, shape, this.style);
			x1 = optimizedShape.x1;
			y1 = optimizedShape.y1;
			x2 = optimizedShape.x2;
			y2 = optimizedShape.y2;
		} else {
			x1 = shape.x1;
			y1 = shape.y1;
			x2 = shape.x2;
			y2 = shape.y2;
		}
		var percent = shape.percent;
		if (percent === 0) return;
		ctx.moveTo(x1, y1);
		if (percent < 1) {
			x2 = x1 * (1 - percent) + x2 * percent;
			y2 = y1 * (1 - percent) + y2 * percent;
		}
		ctx.lineTo(x2, y2);
	};
	Line.prototype.pointAt = function(p) {
		var shape = this.shape;
		return [shape.x1 * (1 - p) + shape.x2 * p, shape.y1 * (1 - p) + shape.y2 * p];
	};
	return Line;
}(Path);
Line.prototype.type = "line";
//#endregion
//#region node_modules/zrender/lib/graphic/shape/BezierCurve.js
var out = [];
var BezierCurveShape = function() {
	function BezierCurveShape() {
		this.x1 = 0;
		this.y1 = 0;
		this.x2 = 0;
		this.y2 = 0;
		this.cpx1 = 0;
		this.cpy1 = 0;
		this.percent = 1;
	}
	return BezierCurveShape;
}();
function someVectorAt(shape, t, isTangent) {
	var cpx2 = shape.cpx2;
	var cpy2 = shape.cpy2;
	if (cpx2 != null || cpy2 != null) return [(isTangent ? cubicDerivativeAt : cubicAt)(shape.x1, shape.cpx1, shape.cpx2, shape.x2, t), (isTangent ? cubicDerivativeAt : cubicAt)(shape.y1, shape.cpy1, shape.cpy2, shape.y2, t)];
	else return [(isTangent ? quadraticDerivativeAt : quadraticAt)(shape.x1, shape.cpx1, shape.x2, t), (isTangent ? quadraticDerivativeAt : quadraticAt)(shape.y1, shape.cpy1, shape.y2, t)];
}
var BezierCurve = function(_super) {
	__extends(BezierCurve, _super);
	function BezierCurve(opts) {
		return _super.call(this, opts) || this;
	}
	BezierCurve.prototype.getDefaultStyle = function() {
		return {
			stroke: "#000",
			fill: null
		};
	};
	BezierCurve.prototype.getDefaultShape = function() {
		return new BezierCurveShape();
	};
	BezierCurve.prototype.buildPath = function(ctx, shape) {
		var x1 = shape.x1;
		var y1 = shape.y1;
		var x2 = shape.x2;
		var y2 = shape.y2;
		var cpx1 = shape.cpx1;
		var cpy1 = shape.cpy1;
		var cpx2 = shape.cpx2;
		var cpy2 = shape.cpy2;
		var percent = shape.percent;
		if (percent === 0) return;
		ctx.moveTo(x1, y1);
		if (cpx2 == null || cpy2 == null) {
			if (percent < 1) {
				quadraticSubdivide(x1, cpx1, x2, percent, out);
				cpx1 = out[1];
				x2 = out[2];
				quadraticSubdivide(y1, cpy1, y2, percent, out);
				cpy1 = out[1];
				y2 = out[2];
			}
			ctx.quadraticCurveTo(cpx1, cpy1, x2, y2);
		} else {
			if (percent < 1) {
				cubicSubdivide(x1, cpx1, cpx2, x2, percent, out);
				cpx1 = out[1];
				cpx2 = out[2];
				x2 = out[3];
				cubicSubdivide(y1, cpy1, cpy2, y2, percent, out);
				cpy1 = out[1];
				cpy2 = out[2];
				y2 = out[3];
			}
			ctx.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, x2, y2);
		}
	};
	BezierCurve.prototype.pointAt = function(t) {
		return someVectorAt(this.shape, t, false);
	};
	BezierCurve.prototype.tangentAt = function(t) {
		var p = someVectorAt(this.shape, t, true);
		return normalize(p, p);
	};
	return BezierCurve;
}(Path);
BezierCurve.prototype.type = "bezier-curve";
//#endregion
//#region node_modules/zrender/lib/graphic/shape/Arc.js
var ArcShape = function() {
	function ArcShape() {
		this.cx = 0;
		this.cy = 0;
		this.r = 0;
		this.startAngle = 0;
		this.endAngle = Math.PI * 2;
		this.clockwise = true;
	}
	return ArcShape;
}();
var Arc = function(_super) {
	__extends(Arc, _super);
	function Arc(opts) {
		return _super.call(this, opts) || this;
	}
	Arc.prototype.getDefaultStyle = function() {
		return {
			stroke: "#000",
			fill: null
		};
	};
	Arc.prototype.getDefaultShape = function() {
		return new ArcShape();
	};
	Arc.prototype.buildPath = function(ctx, shape) {
		var x = shape.cx;
		var y = shape.cy;
		var r = Math.max(shape.r, 0);
		var startAngle = shape.startAngle;
		var endAngle = shape.endAngle;
		var clockwise = shape.clockwise;
		var unitX = Math.cos(startAngle);
		var unitY = Math.sin(startAngle);
		ctx.moveTo(unitX * r + x, unitY * r + y);
		ctx.arc(x, y, r, startAngle, endAngle, !clockwise);
	};
	return Arc;
}(Path);
Arc.prototype.type = "arc";
//#endregion
//#region node_modules/zrender/lib/graphic/CompoundPath.js
var CompoundPath = function(_super) {
	__extends(CompoundPath, _super);
	function CompoundPath() {
		var _this = _super !== null && _super.apply(this, arguments) || this;
		_this.type = "compound";
		return _this;
	}
	CompoundPath.prototype._updatePathDirty = function() {
		var paths = this.shape.paths;
		var dirtyPath = this.shapeChanged();
		for (var i = 0; i < paths.length; i++) dirtyPath = dirtyPath || paths[i].shapeChanged();
		if (dirtyPath) this.dirtyShape();
	};
	CompoundPath.prototype.beforeBrush = function() {
		this._updatePathDirty();
		var paths = this.shape.paths || [];
		var scale = this.getGlobalScale();
		for (var i = 0; i < paths.length; i++) {
			if (!paths[i].path) paths[i].createPathProxy();
			paths[i].path.setScale(scale[0], scale[1], paths[i].segmentIgnoreThreshold);
		}
	};
	CompoundPath.prototype.buildPath = function(ctx, shape) {
		var paths = shape.paths || [];
		for (var i = 0; i < paths.length; i++) paths[i].buildPath(ctx, paths[i].shape, true);
	};
	CompoundPath.prototype.afterBrush = function() {
		var paths = this.shape.paths || [];
		for (var i = 0; i < paths.length; i++) paths[i].pathUpdated();
	};
	CompoundPath.prototype.getBoundingRect = function() {
		this._updatePathDirty.call(this);
		return Path.prototype.getBoundingRect.call(this);
	};
	return CompoundPath;
}(Path);
//#endregion
//#region node_modules/zrender/lib/graphic/Gradient.js
var Gradient = function() {
	function Gradient(colorStops) {
		this.colorStops = colorStops || [];
	}
	Gradient.prototype.addColorStop = function(offset, color) {
		this.colorStops.push({
			offset,
			color
		});
	};
	return Gradient;
}();
//#endregion
//#region node_modules/zrender/lib/graphic/LinearGradient.js
var LinearGradient = function(_super) {
	__extends(LinearGradient, _super);
	function LinearGradient(x, y, x2, y2, colorStops, globalCoord) {
		var _this = _super.call(this, colorStops) || this;
		_this.x = x == null ? 0 : x;
		_this.y = y == null ? 0 : y;
		_this.x2 = x2 == null ? 1 : x2;
		_this.y2 = y2 == null ? 0 : y2;
		_this.type = "linear";
		_this.global = globalCoord || false;
		return _this;
	}
	return LinearGradient;
}(Gradient);
//#endregion
//#region node_modules/zrender/lib/graphic/RadialGradient.js
var RadialGradient = function(_super) {
	__extends(RadialGradient, _super);
	function RadialGradient(x, y, r, colorStops, globalCoord) {
		var _this = _super.call(this, colorStops) || this;
		_this.x = x == null ? .5 : x;
		_this.y = y == null ? .5 : y;
		_this.r = r == null ? .5 : r;
		_this.type = "radial";
		_this.global = globalCoord || false;
		return _this;
	}
	return RadialGradient;
}(Gradient);
//#endregion
//#region node_modules/zrender/lib/core/OrientedBoundingRect.js
var mathMin = Math.min;
var mathMax = Math.max;
var mathAbs = Math.abs;
var _extent = [0, 0];
var _extent2 = [0, 0];
var _intersectCtx = createIntersectContext();
var _minTv = _intersectCtx.minTv;
var _maxTv = _intersectCtx.maxTv;
var OrientedBoundingRect = function() {
	function OrientedBoundingRect(rect, transform) {
		this._corners = [];
		this._axes = [];
		this._origin = [0, 0];
		for (var i = 0; i < 4; i++) this._corners[i] = new Point();
		for (var i = 0; i < 2; i++) this._axes[i] = new Point();
		if (rect) this.fromBoundingRect(rect, transform);
	}
	OrientedBoundingRect.prototype.fromBoundingRect = function(rect, transform) {
		var corners = this._corners;
		var axes = this._axes;
		var x = rect.x;
		var y = rect.y;
		var x2 = x + rect.width;
		var y2 = y + rect.height;
		corners[0].set(x, y);
		corners[1].set(x2, y);
		corners[2].set(x2, y2);
		corners[3].set(x, y2);
		if (transform) for (var i = 0; i < 4; i++) corners[i].transform(transform);
		Point.sub(axes[0], corners[1], corners[0]);
		Point.sub(axes[1], corners[3], corners[0]);
		axes[0].normalize();
		axes[1].normalize();
		for (var i = 0; i < 2; i++) this._origin[i] = axes[i].dot(corners[0]);
	};
	OrientedBoundingRect.prototype.intersect = function(other, mtv, opt) {
		var overlapped = true;
		var noMtv = !mtv;
		if (mtv) Point.set(mtv, 0, 0);
		_intersectCtx.reset(opt, !noMtv);
		if (!this._intersectCheckOneSide(this, other, noMtv, 1)) {
			overlapped = false;
			if (noMtv) return overlapped;
		}
		if (!this._intersectCheckOneSide(other, this, noMtv, -1)) {
			overlapped = false;
			if (noMtv) return overlapped;
		}
		if (!noMtv && !_intersectCtx.negativeSize) Point.copy(mtv, overlapped ? _intersectCtx.useDir ? _intersectCtx.dirMinTv : _minTv : _maxTv);
		return overlapped;
	};
	OrientedBoundingRect.prototype._intersectCheckOneSide = function(self, other, noMtv, inverse) {
		var overlapped = true;
		for (var i = 0; i < 2; i++) {
			var axis = self._axes[i];
			self._getProjMinMaxOnAxis(i, self._corners, _extent);
			self._getProjMinMaxOnAxis(i, other._corners, _extent2);
			if (_intersectCtx.negativeSize || _extent[1] < _extent2[0] || _extent[0] > _extent2[1]) {
				overlapped = false;
				if (_intersectCtx.negativeSize || noMtv) return overlapped;
				var dist0 = mathAbs(_extent2[0] - _extent[1]);
				var dist1 = mathAbs(_extent[0] - _extent2[1]);
				if (mathMin(dist0, dist1) > _maxTv.len()) {
					if (dist0 < dist1) Point.scale(_maxTv, axis, -dist0 * inverse);
					else Point.scale(_maxTv, axis, dist1 * inverse);
				}
			} else if (!noMtv) {
				var dist0 = mathAbs(_extent2[0] - _extent[1]);
				var dist1 = mathAbs(_extent[0] - _extent2[1]);
				if (_intersectCtx.useDir || mathMin(dist0, dist1) < _minTv.len()) {
					if (dist0 < dist1 || !_intersectCtx.bidirectional) {
						Point.scale(_minTv, axis, dist0 * inverse);
						if (_intersectCtx.useDir) _intersectCtx.calcDirMTV();
					}
					if (dist0 >= dist1 || !_intersectCtx.bidirectional) {
						Point.scale(_minTv, axis, -dist1 * inverse);
						if (_intersectCtx.useDir) _intersectCtx.calcDirMTV();
					}
				}
			}
		}
		return overlapped;
	};
	OrientedBoundingRect.prototype._getProjMinMaxOnAxis = function(dim, corners, out) {
		var axis = this._axes[dim];
		var origin = this._origin;
		var proj = corners[0].dot(axis) + origin[dim];
		var min = proj;
		var max = proj;
		for (var i = 1; i < corners.length; i++) {
			var proj_1 = corners[i].dot(axis) + origin[dim];
			min = mathMin(proj_1, min);
			max = mathMax(proj_1, max);
		}
		out[0] = min + _intersectCtx.touchThreshold;
		out[1] = max - _intersectCtx.touchThreshold;
		_intersectCtx.negativeSize = out[1] < out[0];
	};
	return OrientedBoundingRect;
}();
//#endregion
//#region node_modules/zrender/lib/graphic/IncrementalDisplayable.js
var m = [];
var IncrementalDisplayable = function(_super) {
	__extends(IncrementalDisplayable, _super);
	function IncrementalDisplayable() {
		var _this = _super !== null && _super.apply(this, arguments) || this;
		_this.notClear = true;
		_this.incremental = 1;
		_this._displayables = [];
		_this._temporaryDisplayables = [];
		_this._cursor = 0;
		return _this;
	}
	IncrementalDisplayable.prototype.traverse = function(cb, context) {
		cb.call(context, this);
	};
	IncrementalDisplayable.prototype.useStyle = function() {
		this.style = {};
	};
	IncrementalDisplayable.prototype._useHoverStyle = function() {
		this.__hoverStyle = null;
	};
	IncrementalDisplayable.prototype.getCursor = function() {
		return this._cursor;
	};
	IncrementalDisplayable.prototype.innerAfterBrush = function() {
		this._cursor = this._displayables.length;
	};
	IncrementalDisplayable.prototype.clearDisplaybles = function() {
		this._displayables = [];
		this._temporaryDisplayables = [];
		this._cursor = 0;
		this.markRedraw();
		this.notClear = false;
	};
	IncrementalDisplayable.prototype.clearTemporalDisplayables = function() {
		this._temporaryDisplayables = [];
	};
	IncrementalDisplayable.prototype.addDisplayable = function(displayable, notPersistent) {
		if (notPersistent) this._temporaryDisplayables.push(displayable);
		else this._displayables.push(displayable);
		this.markRedraw();
	};
	IncrementalDisplayable.prototype.addDisplayables = function(displayables, notPersistent) {
		notPersistent = notPersistent || false;
		for (var i = 0; i < displayables.length; i++) this.addDisplayable(displayables[i], notPersistent);
	};
	IncrementalDisplayable.prototype.getDisplayables = function() {
		return this._displayables;
	};
	IncrementalDisplayable.prototype.getTemporalDisplayables = function() {
		return this._temporaryDisplayables;
	};
	IncrementalDisplayable.prototype.eachPendingDisplayable = function(cb) {
		for (var i = this._cursor; i < this._displayables.length; i++) cb && cb(this._displayables[i]);
		for (var i = 0; i < this._temporaryDisplayables.length; i++) cb && cb(this._temporaryDisplayables[i]);
	};
	IncrementalDisplayable.prototype.update = function() {
		this.updateTransform();
		for (var i = this._cursor; i < this._displayables.length; i++) {
			var displayable = this._displayables[i];
			displayable.parent = this;
			displayable.update();
			displayable.parent = null;
		}
		for (var i = 0; i < this._temporaryDisplayables.length; i++) {
			var displayable = this._temporaryDisplayables[i];
			displayable.parent = this;
			displayable.update();
			displayable.parent = null;
		}
	};
	IncrementalDisplayable.prototype.getBoundingRect = function() {
		if (!this._rect) {
			var rect = new BoundingRect(Infinity, Infinity, -Infinity, -Infinity);
			for (var i = 0; i < this._displayables.length; i++) {
				var displayable = this._displayables[i];
				var childRect = displayable.getBoundingRect().clone();
				if (displayable.needLocalTransform()) childRect.applyTransform(displayable.getLocalTransform(m));
				rect.union(childRect);
			}
			this._rect = rect;
		}
		return this._rect;
	};
	IncrementalDisplayable.prototype.contain = function(x, y) {
		var localPos = this.transformCoordToLocal(x, y);
		if (this.getBoundingRect().contain(localPos[0], localPos[1])) {
			for (var i = 0; i < this._displayables.length; i++) if (this._displayables[i].contain(x, y)) return true;
		}
		return false;
	};
	return IncrementalDisplayable;
}(Displayable);
//#endregion
//#region node_modules/echarts/lib/animation/basicTransition.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var transitionStore = makeInner();
/**
* Return null if animation is disabled.
*/
function getAnimationConfig(animationType, animatableModel, dataIndex, extraOpts, extraDelayParams) {
	var animationPayload;
	if (animatableModel && animatableModel.ecModel) {
		var updatePayload = animatableModel.ecModel.getUpdatePayload();
		animationPayload = updatePayload && updatePayload.animation;
	}
	var animationEnabled = animatableModel && animatableModel.isAnimationEnabled();
	var isUpdate = animationType === "update";
	if (animationEnabled) {
		var duration = void 0;
		var easing = void 0;
		var delay = void 0;
		if (extraOpts) {
			duration = retrieve2(extraOpts.duration, 200);
			easing = retrieve2(extraOpts.easing, "cubicOut");
			delay = 0;
		} else {
			duration = animatableModel.getShallow(isUpdate ? "animationDurationUpdate" : "animationDuration");
			easing = animatableModel.getShallow(isUpdate ? "animationEasingUpdate" : "animationEasing");
			delay = animatableModel.getShallow(isUpdate ? "animationDelayUpdate" : "animationDelay");
		}
		if (animationPayload) {
			animationPayload.duration != null && (duration = animationPayload.duration);
			animationPayload.easing != null && (easing = animationPayload.easing);
			animationPayload.delay != null && (delay = animationPayload.delay);
		}
		if (isFunction(delay)) delay = delay(dataIndex, extraDelayParams);
		if (isFunction(duration)) duration = duration(dataIndex);
		return {
			duration: duration || 0,
			delay,
			easing
		};
	} else return null;
}
function animateOrSetProps(animationType, el, props, animatableModel, dataIndex, cb, during) {
	var isFrom = false;
	var removeOpt;
	if (isFunction(dataIndex)) {
		during = cb;
		cb = dataIndex;
		dataIndex = null;
	} else if (isObject(dataIndex)) {
		cb = dataIndex.cb;
		during = dataIndex.during;
		isFrom = dataIndex.isFrom;
		removeOpt = dataIndex.removeOpt;
		dataIndex = dataIndex.dataIndex;
	}
	var isRemove = animationType === "leave";
	if (!isRemove) el.stopAnimation("leave");
	var animationConfig = getAnimationConfig(animationType, animatableModel, dataIndex, isRemove ? removeOpt || {} : null, animatableModel && animatableModel.getAnimationDelayParams ? animatableModel.getAnimationDelayParams(el, dataIndex) : null);
	if (animationConfig && animationConfig.duration > 0) {
		var duration = animationConfig.duration;
		var animationDelay = animationConfig.delay;
		var animationEasing = animationConfig.easing;
		var animateConfig = {
			duration,
			delay: animationDelay || 0,
			easing: animationEasing,
			done: cb,
			force: !!cb || !!during,
			setToFinal: !isRemove,
			scope: animationType,
			during
		};
		isFrom ? el.animateFrom(props, animateConfig) : el.animateTo(props, animateConfig);
	} else {
		el.stopAnimation();
		!isFrom && el.attr(props);
		during && during(1);
		cb && cb();
	}
}
/**
* Update graphic element properties with or without animation according to the
* configuration in series.
*
* Caution: this method will stop previous animation.
* So do not use this method to one element twice before
* animation starts, unless you know what you are doing.
* @example
*     graphic.updateProps(el, {
*         position: [100, 100]
*     }, seriesModel, dataIndex, function () { console.log('Animation done!'); });
*     // Or
*     graphic.updateProps(el, {
*         position: [100, 100]
*     }, seriesModel, function () { console.log('Animation done!'); });
*/
function updateProps(el, props, animatableModel, dataIndex, cb, during) {
	animateOrSetProps("update", el, props, animatableModel, dataIndex, cb, during);
}
/**
* Init graphic element properties with or without animation according to the
* configuration in series.
*
* Caution: this method will stop previous animation.
* So do not use this method to one element twice before
* animation starts, unless you know what you are doing.
*/
function initProps(el, props, animatableModel, dataIndex, cb, during) {
	animateOrSetProps("enter", el, props, animatableModel, dataIndex, cb, during);
}
/**
* If element is removed.
* It can determine if element is having remove animation.
*/
function isElementRemoved(el) {
	if (!el.__zr) return true;
	for (var i = 0; i < el.animators.length; i++) if (el.animators[i].scope === "leave") return true;
	return false;
}
/**
* Remove graphic element
*/
function removeElement(el, props, animatableModel, dataIndex, cb, during) {
	if (isElementRemoved(el)) return;
	animateOrSetProps("leave", el, props, animatableModel, dataIndex, cb, during);
}
function fadeOutDisplayable(el, animatableModel, dataIndex, done) {
	el.removeTextContent();
	el.removeTextGuideLine();
	removeElement(el, { style: { opacity: 0 } }, animatableModel, dataIndex, done);
}
function removeElementWithFadeOut(el, animatableModel, dataIndex) {
	function doRemove() {
		el.parent && el.parent.remove(el);
	}
	if (!el.isGroup) fadeOutDisplayable(el, animatableModel, dataIndex, doRemove);
	else el.traverse(function(disp) {
		if (!disp.isGroup) fadeOutDisplayable(disp, animatableModel, dataIndex, doRemove);
	});
}
/**
* Save old style for style transition in universalTransition module.
* It's used when element will be reused in each render.
* For chart like map, heatmap, which will always create new element.
* We don't need to save this because universalTransition can get old style from the old element
*/
function saveOldStyle(el) {
	transitionStore(el).oldStyle = el.style;
}
//#endregion
//#region node_modules/echarts/lib/util/graphic.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var graphic_exports = /* @__PURE__ */ __exportAll({
	Arc: () => Arc,
	BezierCurve: () => BezierCurve,
	BoundingRect: () => BoundingRect,
	Circle: () => Circle,
	CompoundPath: () => CompoundPath,
	Ellipse: () => Ellipse,
	Group: () => Group,
	HOVER_LAYER_FOR_INCREMENTAL: () => 2,
	HOVER_LAYER_FROM_THRESHOLD: () => 1,
	HOVER_LAYER_NO: () => 0,
	Image: () => ZRImage,
	IncrementalDisplayable: () => IncrementalDisplayable,
	Line: () => Line,
	LinearGradient: () => LinearGradient,
	OrientedBoundingRect: () => OrientedBoundingRect,
	Path: () => Path,
	Point: () => Point,
	Polygon: () => Polygon,
	Polyline: () => Polyline,
	RadialGradient: () => RadialGradient,
	Rect: () => Rect,
	Ring: () => Ring,
	Sector: () => Sector,
	Text: () => ZRText,
	WH: () => WH,
	XY: () => XY,
	applyTransform: () => applyTransform,
	calcZ2Range: () => calcZ2Range,
	clipPointsByRect: () => clipPointsByRect,
	clipRectByRect: () => clipRectByRect,
	createIcon: () => createIcon,
	decomposeTransform: () => decomposeTransform,
	ensureCopyRect: () => ensureCopyRect,
	ensureCopyTransform: () => ensureCopyTransform,
	expandOrShrinkRect: () => expandOrShrinkRect,
	extendPath: () => extendPath,
	extendShape: () => extendShape,
	getCurrentCanvasPainter: () => getCurrentCanvasPainter,
	getShapeClass: () => getShapeClass,
	getTransform: () => getTransform,
	groupTransition: () => groupTransition,
	initProps: () => initProps,
	isBoundingRectAxisAligned: () => isBoundingRectAxisAligned,
	isElementRemoved: () => isElementRemoved,
	lineLineIntersect: () => lineLineIntersect,
	linePolygonIntersect: () => linePolygonIntersect,
	makeImage: () => makeImage,
	makePath: () => makePath,
	mergePath: () => mergePath,
	payloadDisableAnimation: () => payloadDisableAnimation,
	registerShape: () => registerShape,
	removeElement: () => removeElement,
	removeElementWithFadeOut: () => removeElementWithFadeOut,
	resizePath: () => resizePath,
	retrieveZInfo: () => retrieveZInfo,
	setTooltipConfig: () => setTooltipConfig,
	subPixelOptimize: () => subPixelOptimize,
	subPixelOptimizeLine: () => subPixelOptimizeLine,
	subPixelOptimizeRect: () => subPixelOptimizeRect,
	transformDirection: () => transformDirection,
	traverseElements: () => traverseElements,
	traverseUpdateZ: () => traverseUpdateZ,
	updateProps: () => updateProps
});
var _customShapeMap = {};
var XY = ["x", "y"];
var WH = ["width", "height"];
/**
* Extend shape with parameters
*/
function extendShape(opts) {
	return Path.extend(opts);
}
var extendPathFromString = extendFromString;
/**
* Extend path
*/
function extendPath(pathData, opts) {
	return extendPathFromString(pathData, opts);
}
/**
* Register a user defined shape.
* The shape class can be fetched by `getShapeClass`
* This method will overwrite the registered shapes, including
* the registered built-in shapes, if using the same `name`.
* The shape can be used in `custom series` and
* `graphic component` by declaring `{type: name}`.
*
* @param name
* @param ShapeClass Can be generated by `extendShape`.
*/
function registerShape(name, ShapeClass) {
	_customShapeMap[name] = ShapeClass;
}
/**
* Find shape class registered by `registerShape`. Usually used in
* fetching user defined shape.
*
* [Caution]:
* (1) This method **MUST NOT be used inside echarts !!!**, unless it is prepared
* to use user registered shapes.
* Because the built-in shape (see `getBuiltInShape`) will be registered by
* `registerShape` by default. That enables users to get both built-in
* shapes as well as the shapes belonging to themsleves. But users can overwrite
* the built-in shapes by using names like 'circle', 'rect' via calling
* `registerShape`. So the echarts inner featrues should not fetch shapes from here
* in case that it is overwritten by users, except that some features, like
* `custom series`, `graphic component`, do it deliberately.
*
* (2) In the features like `custom series`, `graphic component`, the user input
* `{tpye: 'xxx'}` does not only specify shapes but also specify other graphic
* elements like `'group'`, `'text'`, `'image'` or event `'path'`. Those names
* are reserved names, that is, if some user registers a shape named `'image'`,
* the shape will not be used. If we intending to add some more reserved names
* in feature, that might bring break changes (disable some existing user shape
* names). But that case probably rarely happens. So we don't make more mechanism
* to resolve this issue here.
*
* @param name
* @return The shape class. If not found, return nothing.
*/
function getShapeClass(name) {
	if (_customShapeMap.hasOwnProperty(name)) return _customShapeMap[name];
}
/**
* Create a path element from path data string
* @param pathData
* @param opts
* @param rect
* @param layout 'center' or 'cover' default to be cover
*/
function makePath(pathData, opts, rect, layout) {
	var path = createFromString(pathData, opts);
	if (rect) {
		if (layout === "center") rect = centerGraphic(rect, path.getBoundingRect());
		resizePath(path, rect);
	}
	return path;
}
/**
* Create a image element from image url
* @param imageUrl image url
* @param opts options
* @param rect constrain rect
* @param layout 'center' or 'cover'. Default to be 'cover'
*/
function makeImage(imageUrl, rect, layout) {
	var zrImg = new ZRImage({
		style: {
			image: imageUrl,
			x: rect.x,
			y: rect.y,
			width: rect.width,
			height: rect.height
		},
		onload: function(img) {
			if (layout === "center") {
				var boundingRect = {
					width: img.width,
					height: img.height
				};
				zrImg.setStyle(centerGraphic(rect, boundingRect));
			}
		}
	});
	return zrImg;
}
/**
* Get position of centered element in bounding box.
*
* @param  rect         element local bounding box
* @param  boundingRect constraint bounding box
* @return element position containing x, y, width, and height
*/
function centerGraphic(rect, boundingRect) {
	var aspect = boundingRect.width / boundingRect.height;
	var width = rect.height * aspect;
	var height;
	if (width <= rect.width) height = rect.height;
	else {
		width = rect.width;
		height = width / aspect;
	}
	var cx = rect.x + rect.width / 2;
	var cy = rect.y + rect.height / 2;
	return {
		x: cx - width / 2,
		y: cy - height / 2,
		width,
		height
	};
}
var mergePath = mergePath$1;
/**
* Resize a path to fit the rect
* @param path
* @param rect
*/
function resizePath(path, rect) {
	if (!path.applyTransform) return;
	var m = path.getBoundingRect().calculateTransform(rect);
	path.applyTransform(m);
}
/**
* Sub pixel optimize line for canvas
*/
function subPixelOptimizeLine(shape, lineWidth) {
	subPixelOptimizeLine$1(shape, shape, { lineWidth });
	return shape;
}
/**
* Sub pixel optimize rect for canvas
*/
function subPixelOptimizeRect(shape, style) {
	subPixelOptimizeRect$1(shape, shape, style);
	return shape;
}
/**
* Sub pixel optimize for canvas
*
* @param position Coordinate, such as x, y
* @param lineWidth Should be nonnegative integer.
* @param positiveOrNegative Default false (negative).
* @return Optimized position.
*/
var subPixelOptimize = subPixelOptimize$1;
/**
* Get transform matrix of target (param target),
* in coordinate of its ancestor (param ancestor)
*
* @param target
* @param [ancestor]
*/
function getTransform(target, ancestor) {
	var mat = identity([]);
	while (target && target !== ancestor) {
		mul(mat, target.getLocalTransform(), mat);
		target = target.parent;
	}
	return mat;
}
/**
* Apply transform to an vertex.
* @param target [x, y]
* @param transform Can be:
*      + Transform matrix: like [1, 0, 0, 1, 0, 0]
*      + {position, rotation, scale}, the same as `zrender/Transformable`.
* @param invert Whether use invert matrix.
* @return [x, y]
*/
function applyTransform(target, transform, invert$1) {
	if (transform && !isArrayLike(transform)) transform = Transformable.getLocalTransform(transform);
	if (invert$1) transform = invert([], transform);
	return applyTransform$1([], target, transform);
}
/**
* @param direction 'left' 'right' 'top' 'bottom'
* @param transform Transform matrix: like [1, 0, 0, 1, 0, 0]
* @param invert Whether use invert matrix.
* @return Transformed direction. 'left' 'right' 'top' 'bottom'
*/
function transformDirection(direction, transform, invert) {
	var hBase = transform[4] === 0 || transform[5] === 0 || transform[0] === 0 ? 1 : mathAbs$2(2 * transform[4] / transform[0]);
	var vBase = transform[4] === 0 || transform[5] === 0 || transform[2] === 0 ? 1 : mathAbs$2(2 * transform[4] / transform[2]);
	var vertex = [direction === "left" ? -hBase : direction === "right" ? hBase : 0, direction === "top" ? -vBase : direction === "bottom" ? vBase : 0];
	vertex = applyTransform(vertex, transform, invert);
	return mathAbs$2(vertex[0]) > mathAbs$2(vertex[1]) ? vertex[0] > 0 ? "right" : "left" : vertex[1] > 0 ? "bottom" : "top";
}
function isNotGroup(el) {
	return !el.isGroup;
}
function isPath(el) {
	return el.shape != null;
}
/**
* Apply group transition animation from g1 to g2.
* If no animatableModel, no animation.
*/
function groupTransition(g1, g2, animatableModel) {
	if (!g1 || !g2) return;
	function getElMap(g) {
		var elMap = {};
		g.traverse(function(el) {
			if (isNotGroup(el) && el.anid) elMap[el.anid] = el;
		});
		return elMap;
	}
	function getAnimatableProps(el) {
		var obj = {
			x: el.x,
			y: el.y,
			rotation: el.rotation
		};
		if (isPath(el)) obj.shape = clone$1(el.shape);
		return obj;
	}
	var elMap1 = getElMap(g1);
	g2.traverse(function(el) {
		if (isNotGroup(el) && el.anid) {
			var oldEl = elMap1[el.anid];
			if (oldEl) {
				var newProp = getAnimatableProps(el);
				el.attr(getAnimatableProps(oldEl));
				updateProps(el, newProp, animatableModel, getECData(el).dataIndex);
			}
		}
	});
}
function clipPointsByRect(points, rect) {
	return map(points, function(point) {
		var x = point[0];
		x = mathMax$2(x, rect.x);
		x = mathMin$2(x, rect.x + rect.width);
		var y = point[1];
		y = mathMax$2(y, rect.y);
		y = mathMin$2(y, rect.y + rect.height);
		return [x, y];
	});
}
/**
* Return a new clipped rect. If rect size are negative, return undefined.
*/
function clipRectByRect(targetRect, rect) {
	var x = mathMax$2(targetRect.x, rect.x);
	var x2 = mathMin$2(targetRect.x + targetRect.width, rect.x + rect.width);
	var y = mathMax$2(targetRect.y, rect.y);
	var y2 = mathMin$2(targetRect.y + targetRect.height, rect.y + rect.height);
	if (x2 >= x && y2 >= y) return {
		x,
		y,
		width: x2 - x,
		height: y2 - y
	};
}
function createIcon(iconStr, opt, rect) {
	var innerOpts = extend({ rectHover: true }, opt);
	var style = innerOpts.style = { strokeNoScale: true };
	rect = rect || {
		x: -1,
		y: -1,
		width: 2,
		height: 2
	};
	if (iconStr) return iconStr.indexOf("image://") === 0 ? (style.image = iconStr.slice(8), defaults(style, rect), new ZRImage(innerOpts)) : makePath(iconStr.replace("path://", ""), innerOpts, rect, "center");
}
/**
* Return `true` if the given line (line `a`) and the given polygon
* are intersect.
* Note that we do not count colinear as intersect here because no
* requirement for that. We could do that if required in future.
*/
function linePolygonIntersect(a1x, a1y, a2x, a2y, points) {
	for (var i = 0, p2 = points[points.length - 1]; i < points.length; i++) {
		var p = points[i];
		if (lineLineIntersect(a1x, a1y, a2x, a2y, p[0], p[1], p2[0], p2[1])) return true;
		p2 = p;
	}
}
/**
* Return `true` if the given two lines (line `a` and line `b`)
* are intersect.
* Note that we do not count colinear as intersect here because no
* requirement for that. We could do that if required in future.
*/
function lineLineIntersect(a1x, a1y, a2x, a2y, b1x, b1y, b2x, b2y) {
	var mx = a2x - a1x;
	var my = a2y - a1y;
	var nx = b2x - b1x;
	var ny = b2y - b1y;
	var nmCrossProduct = crossProduct2d(nx, ny, mx, my);
	if (nearZero(nmCrossProduct)) return false;
	var b1a1x = a1x - b1x;
	var b1a1y = a1y - b1y;
	var q = crossProduct2d(b1a1x, b1a1y, mx, my) / nmCrossProduct;
	if (q < 0 || q > 1) return false;
	var p = crossProduct2d(b1a1x, b1a1y, nx, ny) / nmCrossProduct;
	if (p < 0 || p > 1) return false;
	return true;
}
/**
* Cross product of 2-dimension vector.
*/
function crossProduct2d(x1, y1, x2, y2) {
	return x1 * y2 - x2 * y1;
}
function nearZero(val) {
	return val <= 1e-6 && val >= -1e-6;
}
/**
* NOTE:
*  A negative-width/height rect (due to negative margins) is not supported;
*  it will be clampped to zero width/height.
*  Although negative-width/height rects can be defined reasonably following the
*  similar sense in CSS, but they are rarely used, hard to understand and complicated.
*
* @param rect Assume its width/height >= 0 if existing.
*  x/y/width/height is allowed to be NaN,
*  for the case that only x/width or y/height is intended to be computed.
* @param delta
*  If be `number[]`, should be `[top, right, bottom, left]`,
*      which can be used in padding or margin case.
*      @see `normalizeCssArray` in `util/format.ts`
*  If be `number`, it means [delta, delta, delta, delta],
*      which can be used in lineWidth (borderWith) case,
*      [NOTICE]: commonly pass lineWidth / 2, following the convention that border is
*      half inside half outside of the rect.
* @param shrinkOrExpand
*  `true` - shrink if `delta[i]` is positive, commmonly used in `padding` case.
*  `false` - expand if `delta[i]` is positive, commmonly used in `margin` case. (default)
* @param noNegative
*  `true` - negative `delta[i]` will be clampped to 0.
*  `false` - No clamp to `delta`. (default).
* @return The input `rect`.
*/
function expandOrShrinkRect(rect, delta, shrinkOrExpand, noNegative, minSize) {
	if (delta == null) return rect;
	else if (isNumber(delta)) _tmpExpandRectDelta[0] = _tmpExpandRectDelta[1] = _tmpExpandRectDelta[2] = _tmpExpandRectDelta[3] = delta;
	else {
		_tmpExpandRectDelta[0] = delta[0];
		_tmpExpandRectDelta[1] = delta[1];
		_tmpExpandRectDelta[2] = delta[2];
		_tmpExpandRectDelta[3] = delta[3];
	}
	if (noNegative) {
		_tmpExpandRectDelta[0] = mathMax$2(0, _tmpExpandRectDelta[0]);
		_tmpExpandRectDelta[1] = mathMax$2(0, _tmpExpandRectDelta[1]);
		_tmpExpandRectDelta[2] = mathMax$2(0, _tmpExpandRectDelta[2]);
		_tmpExpandRectDelta[3] = mathMax$2(0, _tmpExpandRectDelta[3]);
	}
	if (shrinkOrExpand) {
		_tmpExpandRectDelta[0] = -_tmpExpandRectDelta[0];
		_tmpExpandRectDelta[1] = -_tmpExpandRectDelta[1];
		_tmpExpandRectDelta[2] = -_tmpExpandRectDelta[2];
		_tmpExpandRectDelta[3] = -_tmpExpandRectDelta[3];
	}
	expandRectOnOneDimension(rect, _tmpExpandRectDelta, "x", "width", 3, 1, minSize && minSize[0] || 0);
	expandRectOnOneDimension(rect, _tmpExpandRectDelta, "y", "height", 0, 2, minSize && minSize[1] || 0);
	return rect;
}
var _tmpExpandRectDelta = [
	0,
	0,
	0,
	0
];
function expandRectOnOneDimension(rect, delta, xy, wh, ltIdx, rbIdx, minSize) {
	var deltaSum = delta[rbIdx] + delta[ltIdx];
	var oldSize = rect[wh];
	rect[wh] += deltaSum;
	minSize = mathMax$2(0, mathMin$2(minSize, oldSize));
	if (rect[wh] < minSize) {
		rect[wh] = minSize;
		rect[xy] += delta[ltIdx] >= 0 ? -delta[ltIdx] : delta[rbIdx] >= 0 ? oldSize + delta[rbIdx] : mathAbs$2(deltaSum) > 1e-8 ? (oldSize - minSize) * delta[ltIdx] / deltaSum : 0;
	} else rect[xy] -= delta[ltIdx];
}
function setTooltipConfig(opt) {
	var itemTooltipOption = opt.itemTooltipOption;
	var componentModel = opt.componentModel;
	var itemName = opt.itemName;
	var itemTooltipOptionObj = isString(itemTooltipOption) ? { formatter: itemTooltipOption } : itemTooltipOption;
	var mainType = componentModel.mainType;
	var componentIndex = componentModel.componentIndex;
	var formatterParams = {
		componentType: mainType,
		name: itemName,
		$vars: ["name"]
	};
	formatterParams[mainType + "Index"] = componentIndex;
	var formatterParamsExtra = opt.formatterParamsExtra;
	if (formatterParamsExtra) each$1(keys(formatterParamsExtra), function(key) {
		if (!hasOwn(formatterParams, key)) {
			formatterParams[key] = formatterParamsExtra[key];
			formatterParams.$vars.push(key);
		}
	});
	var ecData = getECData(opt.el);
	ecData.componentMainType = mainType;
	ecData.componentIndex = componentIndex;
	ecData.tooltipConfig = {
		name: itemName,
		option: defaults({
			content: itemName,
			encodeHTMLContent: true,
			formatterParams
		}, itemTooltipOptionObj)
	};
}
function traverseElement(el, cb) {
	var stopped;
	if (el.isGroup) stopped = cb(el);
	if (!stopped) el.traverse(cb);
}
function traverseElements(els, cb) {
	if (els) {
		if (isArray(els)) for (var i = 0; i < els.length; i++) traverseElement(els[i], cb);
		else traverseElement(els, cb);
	}
}
/**
* After a boundingRect applying a `transform`, whether to be still parallel screen X and Y.
*/
function isBoundingRectAxisAligned(transform) {
	return !transform || mathAbs$2(transform[1]) < AXIS_ALIGN_EPSILON && mathAbs$2(transform[2]) < AXIS_ALIGN_EPSILON || mathAbs$2(transform[0]) < AXIS_ALIGN_EPSILON && mathAbs$2(transform[3]) < AXIS_ALIGN_EPSILON;
}
var AXIS_ALIGN_EPSILON = 1e-5;
/**
* Create or copy to the existing bounding rect to avoid modifying `source`.
*
* @usage
*  out.rect = ensureCopyRect(out.rect, sourceRect);
*/
function ensureCopyRect(target, source) {
	return target ? BoundingRect.copy(target, source) : source.clone();
}
/**
* Create or copy to the existing transform to avoid modifying `source`.
*
* [CAUTION]: transform is `NullUndefined` if no transform, following convention of zrender,
*  and enable to bypass some unnecessary calculation, since in most cases there is no transform.
*
* @usage
*  out.transform = ensureCopyTransform(out.transform, sourceTransform);
*/
function ensureCopyTransform(target, source) {
	return source ? copy(target || create(), source) : void 0;
}
function retrieveZInfo(model) {
	return {
		z: model.get("z") || 0,
		zlevel: model.get("zlevel") || 0
	};
}
/**
* Assume all of the elements has the same `z` and `zlevel`.
*/
function calcZ2Range(el) {
	var max = -Infinity;
	var min = Infinity;
	traverseElement(el, function(el) {
		visitEl(el);
		visitEl(el.getTextContent());
		visitEl(el.getTextGuideLine());
	});
	function visitEl(el) {
		if (!el || el.isGroup) return;
		var currentStates = el.currentStates;
		if (currentStates.length) for (var idx = 0; idx < currentStates.length; idx++) calcZ2(el.states[currentStates[idx]]);
		calcZ2(el);
	}
	function calcZ2(entity) {
		if (entity) {
			var z2 = entity.z2;
			if (z2 > max) max = z2;
			if (z2 < min) min = z2;
		}
	}
	if (min > max) min = max = 0;
	return {
		min,
		max
	};
}
function traverseUpdateZ(el, z, zlevel) {
	doUpdateZ(el, z, zlevel, -Infinity);
}
function doUpdateZ(el, z, zlevel, maxZ2) {
	if (el.ignoreModelZ) return maxZ2;
	var label = el.getTextContent();
	var labelLine = el.getTextGuideLine();
	if (el.isGroup) {
		var children = el.childrenRef();
		for (var i = 0; i < children.length; i++) maxZ2 = mathMax$2(doUpdateZ(children[i], z, zlevel, maxZ2), maxZ2);
	} else {
		el.z = z;
		el.zlevel = zlevel;
		maxZ2 = mathMax$2(el.z2 || 0, maxZ2);
	}
	if (label) {
		label.z = z;
		label.zlevel = zlevel;
		isFinite(maxZ2) && (label.z2 = maxZ2 + 2);
	}
	if (labelLine) {
		var textGuideLineConfig = el.textGuideLineConfig;
		labelLine.z = z;
		labelLine.zlevel = zlevel;
		isFinite(maxZ2) && (labelLine.z2 = maxZ2 + (textGuideLineConfig && textGuideLineConfig.showAbove ? 1 : -1));
	}
	return maxZ2;
}
function payloadDisableAnimation(payload) {
	payload.animation = { duration: 0 };
	return payload;
}
/**
* Decompose an affine matrix to
* x/y/scaleX/scaleY/rotation/skewX/skewY
*/
function decomposeTransform(out, mt) {
	mt ? copy(tmpDTR.transform, mt) : identity(tmpDTR.transform);
	tmpDTR.decomposeTransform();
	copyTransform(out, tmpDTR);
	return out;
}
var tmpDTR = new Transformable();
tmpDTR.transform = create();
/**
* If not canvas painter, return null/undefined.
*/
function getCurrentCanvasPainter(api) {
	var painter = api.getZr().painter;
	return painter.getType() === "canvas" ? painter : null;
}
registerShape("circle", Circle);
registerShape("ellipse", Ellipse);
registerShape("sector", Sector);
registerShape("ring", Ring);
registerShape("polygon", Polygon);
registerShape("polyline", Polyline);
registerShape("rect", Rect);
registerShape("line", Line);
registerShape("bezierCurve", BezierCurve);
registerShape("arc", Arc);
//#endregion
//#region node_modules/echarts/lib/label/labelStyle.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var EMPTY_OBJ = {};
function setLabelText(label, labelTexts) {
	for (var i = 0; i < SPECIAL_STATES.length; i++) {
		var stateName = SPECIAL_STATES[i];
		var text = labelTexts[stateName];
		var state = label.ensureState(stateName);
		state.style = state.style || {};
		state.style.text = text;
	}
	var oldStates = label.currentStates.slice();
	label.clearStates(true);
	label.setStyle({ text: labelTexts.normal });
	label.useStates(oldStates, true);
}
function getLabelText(opt, stateModels, interpolatedValue) {
	var labelFetcher = opt.labelFetcher;
	var labelDataIndex = opt.labelDataIndex;
	var labelDimIndex = opt.labelDimIndex;
	var normalModel = stateModels.normal;
	var baseText;
	if (labelFetcher) baseText = labelFetcher.getFormattedLabel(labelDataIndex, "normal", null, labelDimIndex, normalModel && normalModel.get("formatter"), interpolatedValue != null ? { interpolatedValue } : null);
	if (baseText == null) baseText = isFunction(opt.defaultText) ? opt.defaultText(labelDataIndex, opt, interpolatedValue) : opt.defaultText;
	var statesText = { normal: baseText };
	for (var i = 0; i < SPECIAL_STATES.length; i++) {
		var stateName = SPECIAL_STATES[i];
		var stateModel = stateModels[stateName];
		statesText[stateName] = retrieve2(labelFetcher ? labelFetcher.getFormattedLabel(labelDataIndex, stateName, null, labelDimIndex, stateModel && stateModel.get("formatter")) : null, baseText);
	}
	return statesText;
}
function setLabelStyle(targetEl, labelStatesModels, opt, stateSpecified) {
	opt = opt || EMPTY_OBJ;
	var isSetOnText = targetEl instanceof ZRText;
	var needsCreateText = false;
	for (var i = 0; i < DISPLAY_STATES.length; i++) {
		var stateModel = labelStatesModels[DISPLAY_STATES[i]];
		if (stateModel && stateModel.getShallow("show")) {
			needsCreateText = true;
			break;
		}
	}
	var textContent = isSetOnText ? targetEl : targetEl.getTextContent();
	if (needsCreateText) {
		if (!isSetOnText) {
			if (!textContent) {
				textContent = new ZRText();
				targetEl.setTextContent(textContent);
			}
			if (targetEl.stateProxy) textContent.stateProxy = targetEl.stateProxy;
		}
		var labelStatesTexts = getLabelText(opt, labelStatesModels);
		var normalModel = labelStatesModels.normal;
		var showNormal = !!normalModel.getShallow("show");
		var normalStyle = createTextStyle(normalModel, stateSpecified && stateSpecified.normal, opt, false, !isSetOnText);
		normalStyle.text = labelStatesTexts.normal;
		if (!isSetOnText) targetEl.setTextConfig(createTextConfig(normalModel, opt, false));
		for (var i = 0; i < SPECIAL_STATES.length; i++) {
			var stateName = SPECIAL_STATES[i];
			var stateModel = labelStatesModels[stateName];
			if (stateModel) {
				var stateObj = textContent.ensureState(stateName);
				var stateShow = !!retrieve2(stateModel.getShallow("show"), showNormal);
				if (stateShow !== showNormal) stateObj.ignore = !stateShow;
				stateObj.style = createTextStyle(stateModel, stateSpecified && stateSpecified[stateName], opt, true, !isSetOnText);
				stateObj.style.text = labelStatesTexts[stateName];
				if (!isSetOnText) {
					var targetElEmphasisState = targetEl.ensureState(stateName);
					targetElEmphasisState.textConfig = createTextConfig(stateModel, opt, true);
				}
			}
		}
		textContent.silent = !!normalModel.getShallow("silent");
		if (textContent.style.x != null) normalStyle.x = textContent.style.x;
		if (textContent.style.y != null) normalStyle.y = textContent.style.y;
		textContent.ignore = !showNormal;
		textContent.useStyle(normalStyle);
		textContent.dirty();
		if (opt.enableTextSetter) labelInner(textContent).setLabelText = function(interpolatedValue) {
			var labelStatesTexts = getLabelText(opt, labelStatesModels, interpolatedValue);
			setLabelText(textContent, labelStatesTexts);
		};
	} else if (textContent) textContent.ignore = true;
	targetEl.dirty();
}
function getLabelStatesModels(itemModel, labelName) {
	labelName = labelName || "label";
	var statesModels = { normal: itemModel.getModel(labelName) };
	for (var i = 0; i < SPECIAL_STATES.length; i++) {
		var stateName = SPECIAL_STATES[i];
		statesModels[stateName] = itemModel.getModel([stateName, labelName]);
	}
	return statesModels;
}
/**
* Set basic textStyle properties.
*/
function createTextStyle(textStyleModel, specifiedTextStyle, opt, isNotNormal, isAttached) {
	var textStyle = {};
	setTextStyleCommon(textStyle, textStyleModel, opt, isNotNormal, isAttached);
	specifiedTextStyle && extend(textStyle, specifiedTextStyle);
	return textStyle;
}
function createTextConfig(textStyleModel, opt, isNotNormal) {
	opt = opt || {};
	var textConfig = {};
	var labelPosition;
	var labelRotate = textStyleModel.getShallow("rotate");
	var labelDistance = retrieve2(textStyleModel.getShallow("distance"), isNotNormal ? null : 5);
	var labelOffset = textStyleModel.getShallow("offset");
	labelPosition = textStyleModel.getShallow("position") || (isNotNormal ? null : "inside");
	labelPosition === "outside" && (labelPosition = opt.defaultOutsidePosition || "top");
	if (labelPosition != null) textConfig.position = labelPosition;
	if (labelOffset != null) textConfig.offset = labelOffset;
	if (labelRotate != null) {
		labelRotate *= Math.PI / 180;
		textConfig.rotation = labelRotate;
	}
	if (labelDistance != null) textConfig.distance = labelDistance;
	textConfig.outsideFill = textStyleModel.get("color") === "inherit" ? opt.inheritColor || null : "auto";
	if (opt.autoOverflowArea != null) textConfig.autoOverflowArea = opt.autoOverflowArea;
	if (opt.layoutRect != null) textConfig.layoutRect = opt.layoutRect;
	return textConfig;
}
/**
* The uniform entry of set text style, that is, retrieve style definitions
* from `model` and set to `textStyle` object.
*
* Never in merge mode, but in overwrite mode, that is, all of the text style
* properties will be set. (Consider the states of normal and emphasis and
* default value can be adopted, merge would make the logic too complicated
* to manage.)
*/
function setTextStyleCommon(textStyle, textStyleModel, opt, isNotNormal, isAttached) {
	opt = opt || EMPTY_OBJ;
	var ecModel = textStyleModel.ecModel;
	var globalTextStyle = ecModel && ecModel.option.textStyle;
	var richItemNames = getRichItemNames(textStyleModel);
	var richResult;
	if (richItemNames) {
		richResult = {};
		var richInheritPlainLabelOptionName = "richInheritPlainLabel";
		var richInheritPlainLabel = retrieve2(textStyleModel.get(richInheritPlainLabelOptionName), ecModel ? ecModel.get(richInheritPlainLabelOptionName) : void 0);
		for (var name_1 in richItemNames) if (richItemNames.hasOwnProperty(name_1)) {
			var richTextStyle = textStyleModel.getModel(["rich", name_1]);
			setTokenTextStyle(richResult[name_1] = {}, richTextStyle, globalTextStyle, textStyleModel, richInheritPlainLabel, opt, isNotNormal, isAttached, false, true);
		}
	}
	if (richResult) textStyle.rich = richResult;
	var overflow = textStyleModel.get("overflow");
	if (overflow) textStyle.overflow = overflow;
	var lineOverflow = textStyleModel.get("lineOverflow");
	if (lineOverflow) textStyle.lineOverflow = lineOverflow;
	var labelTextStyle = textStyle;
	var minMargin = textStyleModel.get("minMargin");
	if (minMargin != null) {
		minMargin = !isNumber(minMargin) ? 0 : minMargin / 2;
		labelTextStyle.margin = [
			minMargin,
			minMargin,
			minMargin,
			minMargin
		];
		labelTextStyle.__marginType = LabelMarginType.minMargin;
	} else {
		var textMargin = textStyleModel.get("textMargin");
		if (textMargin != null) {
			labelTextStyle.margin = normalizeCssArray$1(textMargin);
			labelTextStyle.__marginType = LabelMarginType.textMargin;
		}
	}
	setTokenTextStyle(textStyle, textStyleModel, globalTextStyle, null, null, opt, isNotNormal, isAttached, true, false);
}
function getRichItemNames(textStyleModel) {
	var richItemNameMap;
	while (textStyleModel && textStyleModel !== textStyleModel.ecModel) {
		var rich = (textStyleModel.option || EMPTY_OBJ).rich;
		if (rich) {
			richItemNameMap = richItemNameMap || {};
			var richKeys = keys(rich);
			for (var i = 0; i < richKeys.length; i++) {
				var richKey = richKeys[i];
				richItemNameMap[richKey] = 1;
			}
		}
		textStyleModel = textStyleModel.parentModel;
	}
	return richItemNameMap;
}
var TEXT_PROPS_WITH_GLOBAL = [
	"fontStyle",
	"fontWeight",
	"fontSize",
	"fontFamily",
	"textShadowColor",
	"textShadowBlur",
	"textShadowOffsetX",
	"textShadowOffsetY"
];
var TEXT_PROPS_SELF = [
	"align",
	"lineHeight",
	"width",
	"height",
	"tag",
	"verticalAlign",
	"ellipsis"
];
var TEXT_PROPS_BOX = [
	"padding",
	"borderWidth",
	"borderRadius",
	"borderDashOffset",
	"backgroundColor",
	"borderColor",
	"shadowColor",
	"shadowBlur",
	"shadowOffsetX",
	"shadowOffsetY"
];
function setTokenTextStyle(textStyle, textStyleModel, globalTextStyle, plainTextModel, richInheritPlainLabel, opt, isNotNormal, isAttached, isBlock, inRich) {
	globalTextStyle = !isNotNormal && globalTextStyle || EMPTY_OBJ;
	var inheritColor = opt && opt.inheritColor;
	var fillColor = textStyleModel.getShallow("color");
	var strokeColor = textStyleModel.getShallow("textBorderColor");
	var opacity = retrieve2(textStyleModel.getShallow("opacity"), globalTextStyle.opacity);
	if (fillColor === "inherit" || fillColor === "auto") {
		if (inheritColor) fillColor = inheritColor;
		else fillColor = null;
	}
	if (strokeColor === "inherit" || strokeColor === "auto") {
		if (inheritColor) strokeColor = inheritColor;
		else strokeColor = null;
	}
	if (!isAttached) {
		fillColor = fillColor || globalTextStyle.color;
		strokeColor = strokeColor || globalTextStyle.textBorderColor;
	}
	if (fillColor != null) textStyle.fill = fillColor;
	if (strokeColor != null) textStyle.stroke = strokeColor;
	var textBorderWidth = retrieve2(textStyleModel.getShallow("textBorderWidth"), globalTextStyle.textBorderWidth);
	if (textBorderWidth != null) textStyle.lineWidth = textBorderWidth;
	var textBorderType = retrieve2(textStyleModel.getShallow("textBorderType"), globalTextStyle.textBorderType);
	if (textBorderType != null) textStyle.lineDash = textBorderType;
	var textBorderDashOffset = retrieve2(textStyleModel.getShallow("textBorderDashOffset"), globalTextStyle.textBorderDashOffset);
	if (textBorderDashOffset != null) textStyle.lineDashOffset = textBorderDashOffset;
	if (!isNotNormal && opacity == null && !inRich) opacity = opt && opt.defaultOpacity;
	if (opacity != null) textStyle.opacity = opacity;
	if (!isNotNormal && !isAttached) {
		if (textStyle.fill == null && opt.inheritColor) textStyle.fill = opt.inheritColor;
	}
	for (var i = 0; i < TEXT_PROPS_WITH_GLOBAL.length; i++) {
		var key = TEXT_PROPS_WITH_GLOBAL[i];
		var val = richInheritPlainLabel !== false && plainTextModel ? retrieve3(textStyleModel.getShallow(key), plainTextModel.getShallow(key), globalTextStyle[key]) : retrieve2(textStyleModel.getShallow(key), globalTextStyle[key]);
		if (val != null) textStyle[key] = val;
	}
	for (var i = 0; i < TEXT_PROPS_SELF.length; i++) {
		var key = TEXT_PROPS_SELF[i];
		var val = textStyleModel.getShallow(key);
		if (val != null) textStyle[key] = val;
	}
	if (textStyle.verticalAlign == null) {
		var baseline = textStyleModel.getShallow("baseline");
		if (baseline != null) textStyle.verticalAlign = baseline;
	}
	if (!isBlock || !opt.disableBox) {
		for (var i = 0; i < TEXT_PROPS_BOX.length; i++) {
			var key = TEXT_PROPS_BOX[i];
			var val = textStyleModel.getShallow(key);
			if (val != null) textStyle[key] = val;
		}
		var borderType = textStyleModel.getShallow("borderType");
		if (borderType != null) textStyle.borderDash = borderType;
		if ((textStyle.backgroundColor === "auto" || textStyle.backgroundColor === "inherit") && inheritColor) textStyle.backgroundColor = inheritColor;
		if ((textStyle.borderColor === "auto" || textStyle.borderColor === "inherit") && inheritColor) textStyle.borderColor = inheritColor;
	}
}
function getFont(opt, ecModel) {
	var gTextStyleModel = ecModel && ecModel.getModel("textStyle");
	return trim([
		opt.fontStyle || gTextStyleModel && gTextStyleModel.getShallow("fontStyle") || "",
		opt.fontWeight || gTextStyleModel && gTextStyleModel.getShallow("fontWeight") || "",
		(opt.fontSize || gTextStyleModel && gTextStyleModel.getShallow("fontSize") || 12) + "px",
		opt.fontFamily || gTextStyleModel && gTextStyleModel.getShallow("fontFamily") || "sans-serif"
	].join(" "));
}
var labelInner = makeInner();
function setLabelValueAnimation(label, labelStatesModels, value, getDefaultText) {
	if (!label) return;
	var obj = labelInner(label);
	obj.prevValue = obj.value;
	obj.value = value;
	var normalLabelModel = labelStatesModels.normal;
	obj.valueAnimation = normalLabelModel.get("valueAnimation");
	if (obj.valueAnimation) {
		obj.precision = normalLabelModel.get("precision");
		obj.defaultInterpolatedText = getDefaultText;
		obj.statesModels = labelStatesModels;
	}
}
/**
* PENDING: Temporary impl. unify them?
* @see {LabelCommonOption['textMargin']}
* @see {LabelCommonOption['minMargin']}
*/
var LabelMarginType = {
	minMargin: 1,
	textMargin: 2
};
//#endregion
//#region node_modules/echarts/lib/model/mixin/textStyle.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var PATH_COLOR = ["textStyle", "color"];
var textStyleParams = [
	"fontStyle",
	"fontWeight",
	"fontSize",
	"fontFamily",
	"padding",
	"lineHeight",
	"rich",
	"width",
	"height",
	"overflow"
];
var tmpText = new ZRText();
var TextStyleMixin = function() {
	function TextStyleMixin() {}
	/**
	* Get color property or get color from option.textStyle.color
	*/
	TextStyleMixin.prototype.getTextColor = function(isEmphasis) {
		var ecModel = this.ecModel;
		return this.getShallow("color") || (!isEmphasis && ecModel ? ecModel.get(PATH_COLOR) : null);
	};
	/**
	* Create font string from fontStyle, fontWeight, fontSize, fontFamily
	* @return {string}
	*/
	TextStyleMixin.prototype.getFont = function() {
		return getFont({
			fontStyle: this.getShallow("fontStyle"),
			fontWeight: this.getShallow("fontWeight"),
			fontSize: this.getShallow("fontSize"),
			fontFamily: this.getShallow("fontFamily")
		}, this.ecModel);
	};
	TextStyleMixin.prototype.getTextRect = function(text) {
		var style = {
			text,
			verticalAlign: this.getShallow("verticalAlign") || this.getShallow("baseline")
		};
		for (var i = 0; i < textStyleParams.length; i++) style[textStyleParams[i]] = this.getShallow(textStyleParams[i]);
		tmpText.useStyle(style);
		tmpText.update();
		return tmpText.getBoundingRect();
	};
	return TextStyleMixin;
}();
//#endregion
//#region node_modules/echarts/lib/model/mixin/lineStyle.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var LINE_STYLE_KEY_MAP = [
	["lineWidth", "width"],
	["stroke", "color"],
	["opacity"],
	["shadowBlur"],
	["shadowOffsetX"],
	["shadowOffsetY"],
	["shadowColor"],
	["lineDash", "type"],
	["lineDashOffset", "dashOffset"],
	["lineCap", "cap"],
	["lineJoin", "join"],
	["miterLimit"]
];
var getLineStyle = makeStyleMapper(LINE_STYLE_KEY_MAP);
var LineStyleMixin = function() {
	function LineStyleMixin() {}
	LineStyleMixin.prototype.getLineStyle = function(excludes) {
		return getLineStyle(this, excludes);
	};
	return LineStyleMixin;
}();
//#endregion
//#region node_modules/echarts/lib/model/mixin/itemStyle.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var ITEM_STYLE_KEY_MAP = [
	["fill", "color"],
	["stroke", "borderColor"],
	["lineWidth", "borderWidth"],
	["opacity"],
	["shadowBlur"],
	["shadowOffsetX"],
	["shadowOffsetY"],
	["shadowColor"],
	["lineDash", "borderType"],
	["lineDashOffset", "borderDashOffset"],
	["lineCap", "borderCap"],
	["lineJoin", "borderJoin"],
	["miterLimit", "borderMiterLimit"]
];
var getItemStyle = makeStyleMapper(ITEM_STYLE_KEY_MAP);
var ItemStyleMixin = function() {
	function ItemStyleMixin() {}
	ItemStyleMixin.prototype.getItemStyle = function(excludes, includes) {
		return getItemStyle(this, excludes, includes);
	};
	return ItemStyleMixin;
}();
//#endregion
//#region node_modules/echarts/lib/model/Model.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var Model = function() {
	function Model(option, parentModel, ecModel) {
		this.parentModel = parentModel;
		this.ecModel = ecModel;
		this.option = option;
	}
	Model.prototype.init = function(option, parentModel, ecModel) {
		var rest = [];
		for (var _i = 3; _i < arguments.length; _i++) rest[_i - 3] = arguments[_i];
	};
	/**
	* Merge the input option to me.
	*/
	Model.prototype.mergeOption = function(option, ecModel) {
		merge(this.option, option, true);
	};
	Model.prototype.get = function(path, ignoreParent) {
		if (path == null) return this.option;
		return this._doGet(this.parsePath(path), !ignoreParent && this.parentModel);
	};
	Model.prototype.getShallow = function(key, ignoreParent) {
		var option = this.option;
		var val = option == null ? option : option[key];
		if (val == null && !ignoreParent) {
			var parentModel = this.parentModel;
			if (parentModel) val = parentModel.getShallow(key);
		}
		return val;
	};
	Model.prototype.getModel = function(path, parentModel) {
		var hasPath = path != null;
		var pathFinal = hasPath ? this.parsePath(path) : null;
		var obj = hasPath ? this._doGet(pathFinal) : this.option;
		parentModel = parentModel || this.parentModel && this.parentModel.getModel(this.resolveParentPath(pathFinal));
		return new Model(obj, parentModel, this.ecModel);
	};
	/**
	* If model has option
	*/
	Model.prototype.isEmpty = function() {
		return this.option == null;
	};
	Model.prototype.restoreData = function() {};
	Model.prototype.clone = function() {
		var Ctor = this.constructor;
		return new Ctor(clone$1(this.option));
	};
	Model.prototype.parsePath = function(path) {
		if (typeof path === "string") return path.split(".");
		return path;
	};
	Model.prototype.resolveParentPath = function(path) {
		return path;
	};
	Model.prototype.isAnimationEnabled = function() {
		if (!env.node && this.option) {
			if (this.option.animation != null) return !!this.option.animation;
			else if (this.parentModel) return this.parentModel.isAnimationEnabled();
		}
	};
	Model.prototype._doGet = function(pathArr, parentModel) {
		var obj = this.option;
		if (!pathArr) return obj;
		for (var i = 0; i < pathArr.length; i++) {
			if (!pathArr[i]) continue;
			obj = obj && typeof obj === "object" ? obj[pathArr[i]] : null;
			if (obj == null) break;
		}
		if (obj == null && parentModel) obj = parentModel._doGet(this.resolveParentPath(pathArr), parentModel.parentModel);
		return obj;
	};
	return Model;
}();
enableClassExtend(Model);
enableClassCheck(Model);
mixin(Model, LineStyleMixin);
mixin(Model, ItemStyleMixin);
mixin(Model, AreaStyleMixin);
mixin(Model, TextStyleMixin);
//#endregion
//#region node_modules/echarts/lib/data/helper/sourceHelper.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var BE_ORDINAL = {
	Must: 1,
	Might: 2,
	Not: 3
};
var innerGlobalModel = makeInner();
/**
* MUST be called before mergeOption of all series.
*/
function resetSourceDefaulter(ecModel) {
	innerGlobalModel(ecModel).datasetMap = createHashMap();
}
/**
* [The strategy of the arrengment of data dimensions for dataset]:
* "value way": all axes are non-category axes. So series one by one take
*     several (the number is coordSysDims.length) dimensions from dataset.
*     The result of data arrengment of data dimensions like:
*     | ser0_x | ser0_y | ser1_x | ser1_y | ser2_x | ser2_y |
* "category way": at least one axis is category axis. So the the first data
*     dimension is always mapped to the first category axis and shared by
*     all of the series. The other data dimensions are taken by series like
*     "value way" does.
*     The result of data arrengment of data dimensions like:
*     | ser_shared_x | ser0_y | ser1_y | ser2_y |
*
* @return encode Never be `null/undefined`.
*/
function makeSeriesEncodeForAxisCoordSys(coordDimensions, seriesModel, source) {
	var encode = {};
	var datasetModel = querySeriesUpstreamDatasetModel(seriesModel);
	if (!datasetModel || !coordDimensions) return encode;
	var encodeItemName = [];
	var encodeSeriesName = [];
	var ecModel = seriesModel.ecModel;
	var datasetMap = innerGlobalModel(ecModel).datasetMap;
	var key = datasetModel.uid + "_" + source.seriesLayoutBy;
	var baseCategoryDimIndex;
	var categoryWayValueDimStart;
	coordDimensions = coordDimensions.slice();
	each$1(coordDimensions, function(coordDimInfoLoose, coordDimIdx) {
		var coordDimInfo = isObject(coordDimInfoLoose) ? coordDimInfoLoose : coordDimensions[coordDimIdx] = { name: coordDimInfoLoose };
		if (coordDimInfo.type === "ordinal" && baseCategoryDimIndex == null) {
			baseCategoryDimIndex = coordDimIdx;
			categoryWayValueDimStart = getDataDimCountOnCoordDim(coordDimInfo);
		}
		encode[coordDimInfo.name] = [];
	});
	var datasetRecord = datasetMap.get(key) || datasetMap.set(key, {
		categoryWayDim: categoryWayValueDimStart,
		valueWayDim: 0
	});
	each$1(coordDimensions, function(coordDimInfo, coordDimIdx) {
		var coordDimName = coordDimInfo.name;
		var count = getDataDimCountOnCoordDim(coordDimInfo);
		if (baseCategoryDimIndex == null) {
			var start = datasetRecord.valueWayDim;
			pushDim(encode[coordDimName], start, count);
			pushDim(encodeSeriesName, start, count);
			datasetRecord.valueWayDim += count;
		} else if (baseCategoryDimIndex === coordDimIdx) {
			pushDim(encode[coordDimName], 0, count);
			pushDim(encodeItemName, 0, count);
		} else {
			var start = datasetRecord.categoryWayDim;
			pushDim(encode[coordDimName], start, count);
			pushDim(encodeSeriesName, start, count);
			datasetRecord.categoryWayDim += count;
		}
	});
	function pushDim(dimIdxArr, idxFrom, idxCount) {
		for (var i = 0; i < idxCount; i++) dimIdxArr.push(idxFrom + i);
	}
	function getDataDimCountOnCoordDim(coordDimInfo) {
		var dimsDef = coordDimInfo.dimsDef;
		return dimsDef ? dimsDef.length : 1;
	}
	encodeItemName.length && (encode.itemName = encodeItemName);
	encodeSeriesName.length && (encode.seriesName = encodeSeriesName);
	return encode;
}
/**
* Work for data like [{name: ..., value: ...}, ...].
*
* @return encode Never be `null/undefined`.
*/
function makeSeriesEncodeForNameBased(seriesModel, source, dimCount) {
	var encode = {};
	if (!querySeriesUpstreamDatasetModel(seriesModel)) return encode;
	var sourceFormat = source.sourceFormat;
	var dimensionsDefine = source.dimensionsDefine;
	var potentialNameDimIndex;
	if (sourceFormat === "objectRows" || sourceFormat === "keyedColumns") each$1(dimensionsDefine, function(dim, idx) {
		if ((isObject(dim) ? dim.name : dim) === "name") potentialNameDimIndex = idx;
	});
	var idxResult = function() {
		var idxRes0 = {};
		var idxRes1 = {};
		var guessRecords = [];
		for (var i = 0, len = Math.min(5, dimCount); i < len; i++) {
			var guessResult = doGuessOrdinal(source.data, sourceFormat, source.seriesLayoutBy, dimensionsDefine, source.startIndex, i);
			guessRecords.push(guessResult);
			var isPureNumber = guessResult === BE_ORDINAL.Not;
			if (isPureNumber && idxRes0.v == null && i !== potentialNameDimIndex) idxRes0.v = i;
			if (idxRes0.n == null || idxRes0.n === idxRes0.v || !isPureNumber && guessRecords[idxRes0.n] === BE_ORDINAL.Not) idxRes0.n = i;
			if (fulfilled(idxRes0) && guessRecords[idxRes0.n] !== BE_ORDINAL.Not) return idxRes0;
			if (!isPureNumber) {
				if (guessResult === BE_ORDINAL.Might && idxRes1.v == null && i !== potentialNameDimIndex) idxRes1.v = i;
				if (idxRes1.n == null || idxRes1.n === idxRes1.v) idxRes1.n = i;
			}
		}
		function fulfilled(idxResult) {
			return idxResult.v != null && idxResult.n != null;
		}
		return fulfilled(idxRes0) ? idxRes0 : fulfilled(idxRes1) ? idxRes1 : null;
	}();
	if (idxResult) {
		encode.value = [idxResult.v];
		var nameDimIndex = potentialNameDimIndex != null ? potentialNameDimIndex : idxResult.n;
		encode.itemName = [nameDimIndex];
		encode.seriesName = [nameDimIndex];
	}
	return encode;
}
/**
* @return If return null/undefined, indicate that should not use datasetModel.
*/
function querySeriesUpstreamDatasetModel(seriesModel) {
	if (!seriesModel.get("data", true)) return queryReferringComponents(seriesModel.ecModel, "dataset", {
		index: seriesModel.get("datasetIndex", true),
		id: seriesModel.get("datasetId", true)
	}, SINGLE_REFERRING).models[0];
}
/**
* @return Always return an array event empty.
*/
function queryDatasetUpstreamDatasetModels(datasetModel) {
	if (!datasetModel.get("transform", true) && !datasetModel.get("fromTransformResult", true)) return [];
	return queryReferringComponents(datasetModel.ecModel, "dataset", {
		index: datasetModel.get("fromDatasetIndex", true),
		id: datasetModel.get("fromDatasetId", true)
	}, SINGLE_REFERRING).models;
}
/**
* The rule should not be complex, otherwise user might not
* be able to known where the data is wrong.
* The code is ugly, but how to make it neat?
*/
function guessOrdinal(source, dimIndex) {
	return doGuessOrdinal(source.data, source.sourceFormat, source.seriesLayoutBy, source.dimensionsDefine, source.startIndex, dimIndex);
}
function doGuessOrdinal(data, sourceFormat, seriesLayoutBy, dimensionsDefine, startIndex, dimIndex) {
	var result;
	var maxLoop = 5;
	if (isTypedArray(data)) return BE_ORDINAL.Not;
	var dimName;
	var dimType;
	if (dimensionsDefine) {
		var dimDefItem = dimensionsDefine[dimIndex];
		if (isObject(dimDefItem)) {
			dimName = dimDefItem.name;
			dimType = dimDefItem.type;
		} else if (isString(dimDefItem)) dimName = dimDefItem;
	}
	if (dimType != null) return dimType === "ordinal" ? BE_ORDINAL.Must : BE_ORDINAL.Not;
	if (sourceFormat === "arrayRows") {
		var dataArrayRows = data;
		if (seriesLayoutBy === "row") {
			var sample = dataArrayRows[dimIndex];
			for (var i = 0; i < (sample || []).length && i < maxLoop; i++) if ((result = detectValue(sample[startIndex + i])) != null) return result;
		} else for (var i = 0; i < dataArrayRows.length && i < maxLoop; i++) {
			var row = dataArrayRows[startIndex + i];
			if (row && (result = detectValue(row[dimIndex])) != null) return result;
		}
	} else if (sourceFormat === "objectRows") {
		var dataObjectRows = data;
		if (!dimName) return BE_ORDINAL.Not;
		for (var i = 0; i < dataObjectRows.length && i < maxLoop; i++) {
			var item = dataObjectRows[i];
			if (item && (result = detectValue(item[dimName])) != null) return result;
		}
	} else if (sourceFormat === "keyedColumns") {
		var dataKeyedColumns = data;
		if (!dimName) return BE_ORDINAL.Not;
		var sample = dataKeyedColumns[dimName];
		if (!sample || isTypedArray(sample)) return BE_ORDINAL.Not;
		for (var i = 0; i < sample.length && i < maxLoop; i++) if ((result = detectValue(sample[i])) != null) return result;
	} else if (sourceFormat === "original") {
		var dataOriginal = data;
		for (var i = 0; i < dataOriginal.length && i < maxLoop; i++) {
			var item = dataOriginal[i];
			var val = getDataItemValue(item);
			if (!isArray(val)) return BE_ORDINAL.Not;
			if ((result = detectValue(val[dimIndex])) != null) return result;
		}
	}
	function detectValue(val) {
		var beStr = isString(val);
		if (val != null && isFinite(Number(val)) && val !== "") return beStr ? BE_ORDINAL.Might : BE_ORDINAL.Not;
		else if (beStr && val !== "-") return BE_ORDINAL.Must;
	}
	return BE_ORDINAL.Not;
}
//#endregion
//#region node_modules/echarts/lib/data/Source.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var SourceImpl = function() {
	function SourceImpl(fields) {
		this.data = fields.data || (fields.sourceFormat === "keyedColumns" ? {} : []);
		this.sourceFormat = fields.sourceFormat || "unknown";
		this.seriesLayoutBy = fields.seriesLayoutBy || "column";
		this.startIndex = fields.startIndex || 0;
		this.dimensionsDetectedCount = fields.dimensionsDetectedCount;
		this.metaRawOption = fields.metaRawOption;
		var dimensionsDefine = this.dimensionsDefine = fields.dimensionsDefine;
		if (dimensionsDefine) for (var i = 0; i < dimensionsDefine.length; i++) {
			var dim = dimensionsDefine[i];
			if (dim.type == null) {
				if (guessOrdinal(this, i) === BE_ORDINAL.Must) dim.type = "ordinal";
			}
		}
	}
	return SourceImpl;
}();
function isSourceInstance(val) {
	return val instanceof SourceImpl;
}
/**
* Create a source from option.
* NOTE: Created source is immutable. Don't change any properties in it.
*/
function createSource(sourceData, thisMetaRawOption, sourceFormat) {
	sourceFormat = sourceFormat || detectSourceFormat(sourceData);
	var seriesLayoutBy = thisMetaRawOption.seriesLayoutBy;
	var determined = determineSourceDimensions(sourceData, sourceFormat, seriesLayoutBy, thisMetaRawOption.sourceHeader, thisMetaRawOption.dimensions);
	return new SourceImpl({
		data: sourceData,
		sourceFormat,
		seriesLayoutBy,
		dimensionsDefine: determined.dimensionsDefine,
		startIndex: determined.startIndex,
		dimensionsDetectedCount: determined.dimensionsDetectedCount,
		metaRawOption: clone$1(thisMetaRawOption)
	});
}
/**
* Wrap original series data for some compatibility cases.
*/
function createSourceFromSeriesDataOption(data) {
	return new SourceImpl({
		data,
		sourceFormat: isTypedArray(data) ? SOURCE_FORMAT_TYPED_ARRAY : SOURCE_FORMAT_ORIGINAL
	});
}
/**
* Clone source but excludes source data.
*/
function cloneSourceShallow(source) {
	return new SourceImpl({
		data: source.data,
		sourceFormat: source.sourceFormat,
		seriesLayoutBy: source.seriesLayoutBy,
		dimensionsDefine: clone$1(source.dimensionsDefine),
		startIndex: source.startIndex,
		dimensionsDetectedCount: source.dimensionsDetectedCount
	});
}
/**
* Note: An empty array will be detected as `SOURCE_FORMAT_ARRAY_ROWS`.
*/
function detectSourceFormat(data) {
	var sourceFormat = SOURCE_FORMAT_UNKNOWN;
	if (isTypedArray(data)) sourceFormat = SOURCE_FORMAT_TYPED_ARRAY;
	else if (isArray(data)) {
		if (data.length === 0) sourceFormat = SOURCE_FORMAT_ARRAY_ROWS;
		for (var i = 0, len = data.length; i < len; i++) {
			var item = data[i];
			if (item == null) continue;
			else if (isArray(item) || isTypedArray(item)) {
				sourceFormat = SOURCE_FORMAT_ARRAY_ROWS;
				break;
			} else if (isObject(item)) {
				sourceFormat = SOURCE_FORMAT_OBJECT_ROWS;
				break;
			}
		}
	} else if (isObject(data)) {
		for (var key in data) if (hasOwn(data, key) && isArrayLike(data[key])) {
			sourceFormat = SOURCE_FORMAT_KEYED_COLUMNS;
			break;
		}
	}
	return sourceFormat;
}
/**
* Determine the source definitions from data standalone dimensions definitions
* are not specified.
*/
function determineSourceDimensions(data, sourceFormat, seriesLayoutBy, sourceHeader, dimensionsDefine) {
	var dimensionsDetectedCount;
	var startIndex;
	if (!data) return {
		dimensionsDefine: normalizeDimensionsOption(dimensionsDefine),
		startIndex,
		dimensionsDetectedCount
	};
	if (sourceFormat === "arrayRows") {
		var dataArrayRows = data;
		if (sourceHeader === "auto" || sourceHeader == null) arrayRowsTravelFirst(function(val) {
			if (val != null && val !== "-") {
				if (isString(val)) startIndex ?? (startIndex = 1);
				else startIndex = 0;
			}
		}, seriesLayoutBy, dataArrayRows, 10);
		else startIndex = isNumber(sourceHeader) ? sourceHeader : sourceHeader ? 1 : 0;
		if (!dimensionsDefine && startIndex === 1) {
			dimensionsDefine = [];
			arrayRowsTravelFirst(function(val, index) {
				dimensionsDefine[index] = val != null ? val + "" : "";
			}, seriesLayoutBy, dataArrayRows, Infinity);
		}
		dimensionsDetectedCount = dimensionsDefine ? dimensionsDefine.length : seriesLayoutBy === "row" ? dataArrayRows.length : dataArrayRows[0] ? dataArrayRows[0].length : null;
	} else if (sourceFormat === "objectRows") {
		if (!dimensionsDefine) dimensionsDefine = objectRowsCollectDimensions(data);
	} else if (sourceFormat === "keyedColumns") {
		if (!dimensionsDefine) {
			dimensionsDefine = [];
			each$1(data, function(colArr, key) {
				dimensionsDefine.push(key);
			});
		}
	} else if (sourceFormat === "original") {
		var value0 = getDataItemValue(data[0]);
		dimensionsDetectedCount = isArray(value0) && value0.length || 1;
	} else if (sourceFormat === "typedArray") {}
	return {
		startIndex,
		dimensionsDefine: normalizeDimensionsOption(dimensionsDefine),
		dimensionsDetectedCount
	};
}
function objectRowsCollectDimensions(data) {
	var firstIndex = 0;
	var obj;
	while (firstIndex < data.length && !(obj = data[firstIndex++]));
	if (obj) return keys(obj);
}
function normalizeDimensionsOption(dimensionsDefine) {
	if (!dimensionsDefine) return;
	var nameMap = createHashMap();
	return map(dimensionsDefine, function(rawItem, index) {
		rawItem = isObject(rawItem) ? rawItem : { name: rawItem };
		var item = {
			name: rawItem.name,
			displayName: rawItem.displayName,
			type: rawItem.type
		};
		if (item.name == null) return item;
		item.name += "";
		if (item.displayName == null) item.displayName = item.name;
		var exist = nameMap.get(item.name);
		if (!exist) nameMap.set(item.name, { count: 1 });
		else item.name += "-" + exist.count++;
		return item;
	});
}
function arrayRowsTravelFirst(cb, seriesLayoutBy, data, maxLoop) {
	if (seriesLayoutBy === "row") for (var i = 0; i < data.length && i < maxLoop; i++) cb(data[i] ? data[i][0] : null, i);
	else {
		var value0 = data[0] || [];
		for (var i = 0; i < value0.length && i < maxLoop; i++) cb(value0[i], i);
	}
}
function shouldRetrieveDataByName(source) {
	var sourceFormat = source.sourceFormat;
	return sourceFormat === "objectRows" || sourceFormat === "keyedColumns";
}
//#endregion
//#region node_modules/echarts/lib/data/helper/dataProvider.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var _a;
var _b;
var _c;
var _d;
var providerMethods;
var mountMethods;
/**
* If normal array used, mutable chunk size is supported.
* If typed array used, chunk size must be fixed.
*/
var DefaultDataProvider = function() {
	function DefaultDataProvider(sourceParam, dimSize) {
		var source = !isSourceInstance(sourceParam) ? createSourceFromSeriesDataOption(sourceParam) : sourceParam;
		this._source = source;
		var data = this._data = source.data;
		var sourceFormat = source.sourceFormat;
		source.seriesLayoutBy;
		if (sourceFormat === "typedArray") {
			this._offset = 0;
			this._dimSize = dimSize;
			this._data = data;
		}
		mountMethods(this, data, source);
	}
	DefaultDataProvider.prototype.getSource = function() {
		return this._source;
	};
	DefaultDataProvider.prototype.count = function() {
		return 0;
	};
	DefaultDataProvider.prototype.getItem = function(idx, out) {};
	DefaultDataProvider.prototype.appendData = function(newData) {};
	DefaultDataProvider.prototype.clean = function() {};
	DefaultDataProvider.protoInitialize = function() {
		var proto = DefaultDataProvider.prototype;
		proto.pure = false;
		proto.persistent = true;
	}();
	DefaultDataProvider.internalField = function() {
		var _a;
		mountMethods = function(provider, data, source) {
			var sourceFormat = source.sourceFormat;
			var seriesLayoutBy = source.seriesLayoutBy;
			var startIndex = source.startIndex;
			var dimsDef = source.dimensionsDefine;
			var methods = providerMethods[getMethodMapKey(sourceFormat, seriesLayoutBy)];
			extend(provider, methods);
			if (sourceFormat === "typedArray") {
				provider.getItem = getItemForTypedArray;
				provider.count = countForTypedArray;
				provider.fillStorage = fillStorageForTypedArray;
			} else {
				var rawItemGetter = getRawSourceItemGetter(sourceFormat, seriesLayoutBy);
				provider.getItem = bind(rawItemGetter, null, data, startIndex, dimsDef);
				var rawCounter = getRawSourceDataCounter(sourceFormat, seriesLayoutBy);
				provider.count = bind(rawCounter, null, data, startIndex, dimsDef);
			}
		};
		var getItemForTypedArray = function(idx, out) {
			idx = idx - this._offset;
			out = out || [];
			var data = this._data;
			var dimSize = this._dimSize;
			var offset = dimSize * idx;
			for (var i = 0; i < dimSize; i++) out[i] = data[offset + i];
			return out;
		};
		var fillStorageForTypedArray = function(start, end, storage, extent) {
			var data = this._data;
			var dimSize = this._dimSize;
			for (var dim = 0; dim < dimSize; dim++) {
				var dimExtent = extent[dim];
				var min = dimExtent[0] == null ? Infinity : dimExtent[0];
				var max = dimExtent[1] == null ? -Infinity : dimExtent[1];
				var count = end - start;
				var arr = storage[dim];
				for (var i = 0; i < count; i++) {
					var val = data[i * dimSize + dim];
					arr[start + i] = val;
					val < min && (min = val);
					val > max && (max = val);
				}
				dimExtent[0] = min;
				dimExtent[1] = max;
			}
		};
		var countForTypedArray = function() {
			return this._data ? this._data.length / this._dimSize : 0;
		};
		providerMethods = (_a = {}, _a[SOURCE_FORMAT_ARRAY_ROWS + "_" + SERIES_LAYOUT_BY_COLUMN] = {
			pure: true,
			appendData: appendDataSimply
		}, _a[SOURCE_FORMAT_ARRAY_ROWS + "_row"] = {
			pure: true,
			appendData: function() {
				throw new Error("Do not support appendData when set seriesLayoutBy: \"row\".");
			}
		}, _a[SOURCE_FORMAT_OBJECT_ROWS] = {
			pure: true,
			appendData: appendDataSimply
		}, _a[SOURCE_FORMAT_KEYED_COLUMNS] = {
			pure: true,
			appendData: function(newData) {
				var data = this._data;
				each$1(newData, function(newCol, key) {
					var oldCol = data[key] || (data[key] = []);
					for (var i = 0; i < (newCol || []).length; i++) oldCol.push(newCol[i]);
				});
			}
		}, _a[SOURCE_FORMAT_ORIGINAL] = { appendData: appendDataSimply }, _a[SOURCE_FORMAT_TYPED_ARRAY] = {
			persistent: false,
			pure: true,
			appendData: function(newData) {
				this._data = newData;
			},
			clean: function() {
				this._offset += this.count();
				this._data = null;
			}
		}, _a);
		function appendDataSimply(newData) {
			for (var i = 0; i < newData.length; i++) this._data.push(newData[i]);
		}
	}();
	return DefaultDataProvider;
}();
var validateSimply = function(rawData) {
	if (!isArray(rawData)) error("series.data or dataset.source must be an array.");
};
_a = {}, _a[SOURCE_FORMAT_ARRAY_ROWS + "_" + SERIES_LAYOUT_BY_COLUMN] = validateSimply, _a[SOURCE_FORMAT_ARRAY_ROWS + "_row"] = validateSimply, _a[SOURCE_FORMAT_OBJECT_ROWS] = validateSimply, _a[SOURCE_FORMAT_KEYED_COLUMNS] = function(rawData, dimsDef) {
	for (var i = 0; i < dimsDef.length; i++) if (dimsDef[i].name == null) error("dimension name must not be null/undefined.");
}, _a[SOURCE_FORMAT_ORIGINAL] = validateSimply;
var getItemSimply = function(rawData, startIndex, dimsDef, idx) {
	return rawData[idx];
};
var rawSourceItemGetterMap = (_b = {}, _b[SOURCE_FORMAT_ARRAY_ROWS + "_" + SERIES_LAYOUT_BY_COLUMN] = function(rawData, startIndex, dimsDef, idx) {
	return rawData[idx + startIndex];
}, _b[SOURCE_FORMAT_ARRAY_ROWS + "_row"] = function(rawData, startIndex, dimsDef, idx, out) {
	idx += startIndex;
	var item = out || [];
	var data = rawData;
	for (var i = 0; i < data.length; i++) {
		var row = data[i];
		item[i] = row ? row[idx] : null;
	}
	return item;
}, _b[SOURCE_FORMAT_OBJECT_ROWS] = getItemSimply, _b[SOURCE_FORMAT_KEYED_COLUMNS] = function(rawData, startIndex, dimsDef, idx, out) {
	var item = out || [];
	for (var i = 0; i < dimsDef.length; i++) {
		var dimName = dimsDef[i].name;
		var col = dimName != null ? rawData[dimName] : null;
		item[i] = col ? col[idx] : null;
	}
	return item;
}, _b[SOURCE_FORMAT_ORIGINAL] = getItemSimply, _b);
function getRawSourceItemGetter(sourceFormat, seriesLayoutBy) {
	return rawSourceItemGetterMap[getMethodMapKey(sourceFormat, seriesLayoutBy)];
}
var countSimply = function(rawData, startIndex, dimsDef) {
	return rawData.length;
};
var rawSourceDataCounterMap = (_c = {}, _c[SOURCE_FORMAT_ARRAY_ROWS + "_" + SERIES_LAYOUT_BY_COLUMN] = function(rawData, startIndex, dimsDef) {
	return Math.max(0, rawData.length - startIndex);
}, _c[SOURCE_FORMAT_ARRAY_ROWS + "_row"] = function(rawData, startIndex, dimsDef) {
	var row = rawData[0];
	return row ? Math.max(0, row.length - startIndex) : 0;
}, _c[SOURCE_FORMAT_OBJECT_ROWS] = countSimply, _c[SOURCE_FORMAT_KEYED_COLUMNS] = function(rawData, startIndex, dimsDef) {
	var dimName = dimsDef[0].name;
	var col = dimName != null ? rawData[dimName] : null;
	return col ? col.length : 0;
}, _c[SOURCE_FORMAT_ORIGINAL] = countSimply, _c);
function getRawSourceDataCounter(sourceFormat, seriesLayoutBy) {
	return rawSourceDataCounterMap[getMethodMapKey(sourceFormat, seriesLayoutBy)];
}
var getRawValueSimply = function(dataItem, dimIndex, property) {
	return dataItem[dimIndex];
};
var rawSourceValueGetterMap = (_d = {}, _d[SOURCE_FORMAT_ARRAY_ROWS] = getRawValueSimply, _d[SOURCE_FORMAT_OBJECT_ROWS] = function(dataItem, dimIndex, property) {
	return dataItem[property];
}, _d[SOURCE_FORMAT_KEYED_COLUMNS] = getRawValueSimply, _d[SOURCE_FORMAT_ORIGINAL] = function(dataItem, dimIndex, property) {
	var value = getDataItemValue(dataItem);
	return !(value instanceof Array) ? value : value[dimIndex];
}, _d[SOURCE_FORMAT_TYPED_ARRAY] = getRawValueSimply, _d);
function getRawSourceValueGetter(sourceFormat) {
	return rawSourceValueGetterMap[sourceFormat];
}
function getMethodMapKey(sourceFormat, seriesLayoutBy) {
	return sourceFormat === "arrayRows" ? sourceFormat + "_" + seriesLayoutBy : sourceFormat;
}
function retrieveRawValue(data, dataIndex, dim) {
	if (!data) return;
	var dataItem = data.getRawDataItem(dataIndex);
	if (dataItem == null) return;
	var store = data.getStore();
	var sourceFormat = store.getSource().sourceFormat;
	if (dim != null) {
		var dimIndex = data.getDimensionIndex(dim);
		var property = store.getDimensionProperty(dimIndex);
		return getRawSourceValueGetter(sourceFormat)(dataItem, dimIndex, property);
	} else {
		var result = dataItem;
		if (sourceFormat === "original") result = getDataItemValue(dataItem);
		return result;
	}
}
//#endregion
//#region node_modules/echarts/lib/data/helper/dataValueHelper.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* Convert raw the value in to inner value in List.
*
* [Performance sensitive]
*
* [Caution]: this is the key logic of user value parser.
* For backward compatibility, do not modify it until you have to!
*/
function parseDataValue(value, opt) {
	var dimType = opt && opt.type;
	if (dimType === "ordinal") return value;
	if (dimType === "time" && !isNumber(value) && value != null && value !== "-") value = +parseDate(value);
	return value == null || value === "" ? NaN : Number(value);
}
createHashMap({
	"number": function(val) {
		return parseFloat(val);
	},
	"time": function(val) {
		return +parseDate(val);
	},
	"trim": function(val) {
		return isString(val) ? trim(val) : val;
	}
});
var ORDER_COMPARISON_OP_MAP = {
	lt: function(lval, rval) {
		return lval < rval;
	},
	lte: function(lval, rval) {
		return lval <= rval;
	},
	gt: function(lval, rval) {
		return lval > rval;
	},
	gte: function(lval, rval) {
		return lval >= rval;
	}
};
(function() {
	function FilterOrderComparator(op, rval) {
		if (!isNumber(rval)) throwError("");
		this._opFn = ORDER_COMPARISON_OP_MAP[op];
		this._rvalFloat = numericToNumber(rval);
	}
	FilterOrderComparator.prototype.evaluate = function(lval) {
		return isNumber(lval) ? this._opFn(lval, this._rvalFloat) : this._opFn(numericToNumber(lval), this._rvalFloat);
	};
	return FilterOrderComparator;
})();
var SortOrderComparator = function() {
	/**
	* @param order by default: 'asc'
	* @param incomparable by default: Always on the tail.
	*        That is, if 'asc' => 'max', if 'desc' => 'min'
	*        See the definition of "incomparable" in [SORT_COMPARISON_RULE].
	*/
	function SortOrderComparator(order, incomparable) {
		var isDesc = order === "desc";
		this._resultLT = isDesc ? 1 : -1;
		if (incomparable == null) incomparable = isDesc ? "min" : "max";
		this._incomparable = incomparable === "min" ? -Infinity : Infinity;
	}
	SortOrderComparator.prototype.evaluate = function(lval, rval) {
		var lvalFloat = isNumber(lval) ? lval : numericToNumber(lval);
		var rvalFloat = isNumber(rval) ? rval : numericToNumber(rval);
		var lvalNotNumeric = isNaN(lvalFloat);
		var rvalNotNumeric = isNaN(rvalFloat);
		if (lvalNotNumeric) lvalFloat = this._incomparable;
		if (rvalNotNumeric) rvalFloat = this._incomparable;
		if (lvalNotNumeric && rvalNotNumeric) {
			var lvalIsStr = isString(lval);
			var rvalIsStr = isString(rval);
			if (lvalIsStr) lvalFloat = rvalIsStr ? lval : 0;
			if (rvalIsStr) rvalFloat = lvalIsStr ? rval : 0;
		}
		return lvalFloat < rvalFloat ? this._resultLT : lvalFloat > rvalFloat ? -this._resultLT : 0;
	};
	return SortOrderComparator;
}();
(function() {
	function FilterEqualityComparator(isEq, rval) {
		this._rval = rval;
		this._isEQ = isEq;
		this._rvalTypeof = typeof rval;
		this._rvalFloat = numericToNumber(rval);
	}
	FilterEqualityComparator.prototype.evaluate = function(lval) {
		var eqResult = lval === this._rval;
		if (!eqResult) {
			var lvalTypeof = typeof lval;
			if (lvalTypeof !== this._rvalTypeof && (lvalTypeof === "number" || this._rvalTypeof === "number")) eqResult = numericToNumber(lval) === this._rvalFloat;
		}
		return this._isEQ ? eqResult : !eqResult;
	};
	return FilterEqualityComparator;
})();
/**
* @usage
*  const filterParsed = parseSanitizationFilter(filter);
*  for( ... ) {
*      const val = ...;
*      if (!filter || passesFilter(filterParsed, val)) {
*          // normal handling
*      }
*  }
*/
function parseSanitizationFilter(filter) {
	var filterKey = "";
	var filterG = -Infinity;
	var filterGE = -Infinity;
	var filterL = Infinity;
	var filterLE = Infinity;
	if (filter) {
		if (filter.g != null) {
			filterKey += "G" + filter.g;
			filterG = filter.g;
		}
		if (filter.ge != null) {
			filterKey += "GE" + filter.ge;
			filterGE = filter.ge;
		}
		if (filter.l != null) {
			filterKey += "L" + filter.l;
			filterL = filter.l;
		}
		if (filter.le != null) {
			filterKey += "LE" + filter.le;
			filterLE = filter.le;
		}
	}
	return {
		key: filterKey,
		g: filterG,
		ge: filterGE,
		l: filterL,
		le: filterLE
	};
}
function passesSanitizationFilter(filterParsed, value) {
	return value > filterParsed.g && value >= filterParsed.ge && value < filterParsed.l && value <= filterParsed.le;
}
//#endregion
//#region node_modules/echarts/lib/data/DataStore.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var CtorUint32Array = typeof Uint32Array === "undefined" ? Array : Uint32Array;
var CtorUint16Array = typeof Uint16Array === "undefined" ? Array : Uint16Array;
var CtorInt32Array = typeof Int32Array === "undefined" ? Array : Int32Array;
var CtorFloat64Array = typeof Float64Array === "undefined" ? Array : Float64Array;
/**
* Multi dimensional data store
*/
var dataCtors = {
	"float": CtorFloat64Array,
	"int": CtorInt32Array,
	"ordinal": Array,
	"number": Array,
	"time": CtorFloat64Array
};
var defaultDimValueGetters;
function getIndicesCtor(rawCount) {
	return rawCount > 65535 ? CtorUint32Array : CtorUint16Array;
}
function cloneChunk(originalChunk) {
	var Ctor = originalChunk.constructor;
	return Ctor === Array ? originalChunk.slice() : new Ctor(originalChunk);
}
function prepareStore(store, dimIdx, dimType, end, append) {
	var DataCtor = dataCtors[dimType || "float"];
	if (append) {
		var oldStore = store[dimIdx];
		var oldLen = oldStore && oldStore.length;
		if (!(oldLen === end)) {
			var newStore = new DataCtor(end);
			for (var j = 0; j < oldLen; j++) newStore[j] = oldStore[j];
			store[dimIdx] = newStore;
		}
	} else store[dimIdx] = new DataCtor(end);
}
/**
* Basically, DataStore API keep immutable.
*/
var DataStore = function() {
	function DataStore() {
		this._chunks = [];
		this._rawExtent = [];
		this._extent = [];
		this._count = 0;
		this._rawCount = 0;
		this._calcDimNameToIdx = createHashMap();
	}
	/**
	* Initialize from data
	*/
	DataStore.prototype.initData = function(provider, inputDimensions, dimValueGetter) {
		this._provider = provider;
		this._chunks = [];
		this._indices = null;
		this.getRawIndex = this._getRawIdxIdentity;
		var source = provider.getSource();
		var defaultGetter = this.defaultDimValueGetter = defaultDimValueGetters[source.sourceFormat];
		this._dimValueGetter = dimValueGetter || defaultGetter;
		this._rawExtent = [];
		shouldRetrieveDataByName(source);
		this._dimensions = map(inputDimensions, function(dim) {
			return {
				type: dim.type,
				property: dim.property
			};
		});
		this._initDataFromProvider(0, provider.count());
	};
	DataStore.prototype.getProvider = function() {
		return this._provider;
	};
	/**
	* Caution: even when a `source` instance owned by a series, the created data store
	* may still be shared by different sereis (the source hash does not use all `source`
	* props, see `sourceManager`). In this case, the `source` props that are not used in
	* hash (like `source.dimensionDefine`) probably only belongs to a certain series and
	* thus should not be fetch here.
	*/
	DataStore.prototype.getSource = function() {
		return this._provider.getSource();
	};
	/**
	* @caution Only used in dataStack.
	*/
	DataStore.prototype.ensureCalculationDimension = function(dimName, type) {
		var calcDimNameToIdx = this._calcDimNameToIdx;
		var dimensions = this._dimensions;
		var calcDimIdx = calcDimNameToIdx.get(dimName);
		if (calcDimIdx != null) {
			if (dimensions[calcDimIdx].type === type) return calcDimIdx;
		} else calcDimIdx = dimensions.length;
		dimensions[calcDimIdx] = { type };
		calcDimNameToIdx.set(dimName, calcDimIdx);
		this._chunks[calcDimIdx] = new dataCtors[type || "float"](this._rawCount);
		this._rawExtent[calcDimIdx] = initExtentForUnion();
		return calcDimIdx;
	};
	DataStore.prototype.collectOrdinalMeta = function(dimIdx, ordinalMeta) {
		var chunk = this._chunks[dimIdx];
		var dim = this._dimensions[dimIdx];
		var rawExtents = this._rawExtent;
		var offset = dim.ordinalOffset || 0;
		var len = chunk.length;
		if (offset === 0) rawExtents[dimIdx] = initExtentForUnion();
		var dimRawExtent = rawExtents[dimIdx];
		for (var i = offset; i < len; i++) {
			var val = chunk[i] = ordinalMeta.parseAndCollect(chunk[i]);
			if (!isNaN(val)) {
				dimRawExtent[0] = Math.min(val, dimRawExtent[0]);
				dimRawExtent[1] = Math.max(val, dimRawExtent[1]);
			}
		}
		dim.ordinalMeta = ordinalMeta;
		dim.ordinalOffset = len;
		dim.type = "ordinal";
	};
	DataStore.prototype.getOrdinalMeta = function(dimIdx) {
		return this._dimensions[dimIdx].ordinalMeta;
	};
	DataStore.prototype.getDimensionProperty = function(dimIndex) {
		var item = this._dimensions[dimIndex];
		return item && item.property;
	};
	/**
	* Caution: Can be only called on raw data (before `this._indices` created).
	*/
	DataStore.prototype.appendData = function(data) {
		var provider = this._provider;
		var start = this.count();
		provider.appendData(data);
		var end = provider.count();
		if (!provider.persistent) end += start;
		if (start < end) this._initDataFromProvider(start, end, true);
		return [start, end];
	};
	DataStore.prototype.appendValues = function(values, minFillLen) {
		var chunks = this._chunks;
		var dimensions = this._dimensions;
		var dimLen = dimensions.length;
		var rawExtent = this._rawExtent;
		var start = this.count();
		var end = start + Math.max(values.length, minFillLen || 0);
		for (var i = 0; i < dimLen; i++) {
			var dim = dimensions[i];
			prepareStore(chunks, i, dim.type, end, true);
		}
		var emptyDataItem = [];
		for (var idx = start; idx < end; idx++) {
			var sourceIdx = idx - start;
			for (var dimIdx = 0; dimIdx < dimLen; dimIdx++) {
				var dim = dimensions[dimIdx];
				var val = defaultDimValueGetters.arrayRows.call(this, values[sourceIdx] || emptyDataItem, dim.property, sourceIdx, dimIdx);
				chunks[dimIdx][idx] = val;
				var dimRawExtent = rawExtent[dimIdx];
				val < dimRawExtent[0] && (dimRawExtent[0] = val);
				val > dimRawExtent[1] && (dimRawExtent[1] = val);
			}
		}
		this._rawCount = this._count = end;
		return {
			start,
			end
		};
	};
	DataStore.prototype._initDataFromProvider = function(start, end, append) {
		var provider = this._provider;
		var chunks = this._chunks;
		var dimensions = this._dimensions;
		var dimLen = dimensions.length;
		var rawExtent = this._rawExtent;
		var dimNames = map(dimensions, function(dim) {
			return dim.property;
		});
		for (var i = 0; i < dimLen; i++) {
			var dim = dimensions[i];
			if (!rawExtent[i]) rawExtent[i] = initExtentForUnion();
			prepareStore(chunks, i, dim.type, end, append);
		}
		if (provider.fillStorage) provider.fillStorage(start, end, chunks, rawExtent);
		else {
			var dataItem = [];
			for (var idx = start; idx < end; idx++) {
				dataItem = provider.getItem(idx, dataItem);
				for (var dimIdx = 0; dimIdx < dimLen; dimIdx++) {
					var dimStorage = chunks[dimIdx];
					var val = this._dimValueGetter(dataItem, dimNames[dimIdx], idx, dimIdx);
					dimStorage[idx] = val;
					var dimRawExtent = rawExtent[dimIdx];
					val < dimRawExtent[0] && (dimRawExtent[0] = val);
					val > dimRawExtent[1] && (dimRawExtent[1] = val);
				}
			}
		}
		if (!provider.persistent && provider.clean) provider.clean();
		this._rawCount = this._count = end;
		this._extent = [];
	};
	DataStore.prototype.count = function() {
		return this._count;
	};
	/**
	* Get value. Return NaN if idx is out of range.
	*/
	DataStore.prototype.get = function(dim, idx) {
		if (!(idx >= 0 && idx < this._count)) return NaN;
		var dimStore = this._chunks[dim];
		return dimStore ? dimStore[this.getRawIndex(idx)] : NaN;
	};
	DataStore.prototype.getValues = function(dimensions, idx) {
		var values = [];
		var dimArr = [];
		if (idx == null) {
			idx = dimensions;
			dimensions = [];
			for (var i = 0; i < this._dimensions.length; i++) dimArr.push(i);
		} else dimArr = dimensions;
		for (var i = 0, len = dimArr.length; i < len; i++) values.push(this.get(dimArr[i], idx));
		return values;
	};
	/**
	* @param dim concrete dim
	*/
	DataStore.prototype.getByRawIndex = function(dim, rawIdx) {
		if (!(rawIdx >= 0 && rawIdx < this._rawCount)) return NaN;
		var dimStore = this._chunks[dim];
		return dimStore ? dimStore[rawIdx] : NaN;
	};
	/**
	* Get sum of data in one dimension
	*/
	DataStore.prototype.getSum = function(dim) {
		var dimData = this._chunks[dim];
		var sum = 0;
		if (dimData) for (var i = 0, len = this.count(); i < len; i++) {
			var value = this.get(dim, i);
			if (!isNaN(value)) sum += value;
		}
		return sum;
	};
	/**
	* Get median of data in one dimension
	*/
	DataStore.prototype.getMedian = function(dim) {
		var dimDataArray = [];
		this.each([dim], function(val) {
			if (!isNaN(val)) dimDataArray.push(val);
		});
		asc(dimDataArray);
		var len = this.count();
		return len === 0 ? 0 : len % 2 === 1 ? dimDataArray[(len - 1) / 2] : (dimDataArray[len / 2] + dimDataArray[len / 2 - 1]) / 2;
	};
	/**
	* Retrieve the index with given raw data index.
	*/
	DataStore.prototype.indexOfRawIndex = function(rawIndex) {
		if (rawIndex >= this._rawCount || rawIndex < 0) return -1;
		if (!this._indices) return rawIndex;
		var indices = this._indices;
		var rawDataIndex = indices[rawIndex];
		if (rawDataIndex != null && rawDataIndex < this._count && rawDataIndex === rawIndex) return rawIndex;
		var left = 0;
		var right = this._count - 1;
		while (left <= right) {
			var mid = (left + right) / 2 | 0;
			if (indices[mid] < rawIndex) left = mid + 1;
			else if (indices[mid] > rawIndex) right = mid - 1;
			else return mid;
		}
		return -1;
	};
	DataStore.prototype.getIndices = function() {
		var newIndices;
		var indices = this._indices;
		if (indices) {
			var Ctor = indices.constructor;
			var thisCount = this._count;
			if (Ctor === Array) {
				newIndices = new Ctor(thisCount);
				for (var i = 0; i < thisCount; i++) newIndices[i] = indices[i];
			} else newIndices = new Ctor(indices.buffer, 0, thisCount);
		} else {
			var Ctor = getIndicesCtor(this._rawCount);
			newIndices = new Ctor(this.count());
			for (var i = 0; i < newIndices.length; i++) newIndices[i] = i;
		}
		return newIndices;
	};
	/**
	* [NOTICE]: Performance-sensitive for large data.
	*/
	DataStore.prototype.filter = function(dims, cb) {
		if (!this._count) return this;
		var newStore = this.clone();
		var count = newStore.count();
		var newIndices = new (getIndicesCtor(newStore._rawCount))(count);
		var value = [];
		var dimSize = dims.length;
		var offset = 0;
		var dim0 = dims[0];
		var chunks = newStore._chunks;
		for (var i = 0; i < count; i++) {
			var keep = void 0;
			var rawIdx = newStore.getRawIndex(i);
			if (dimSize === 0) keep = cb(i);
			else if (dimSize === 1) {
				var val = chunks[dim0][rawIdx];
				keep = cb(val, i);
			} else {
				var k = 0;
				for (; k < dimSize; k++) value[k] = chunks[dims[k]][rawIdx];
				value[k] = i;
				keep = cb.apply(null, value);
			}
			if (keep) newIndices[offset++] = rawIdx;
		}
		if (offset < count) newStore._indices = newIndices;
		newStore._count = offset;
		newStore._extent = [];
		newStore._updateGetRawIdx();
		return newStore;
	};
	/**
	* Select data in range. (For optimization of filter)
	* (Manually inline code, support 5 million data filtering in data zoom.)
	*/
	DataStore.prototype.selectRange = function(range) {
		var newStore = this.clone();
		var len = newStore._count;
		if (!len) return this;
		var dims = keys(range);
		var dimSize = dims.length;
		if (!dimSize) return this;
		var originalCount = newStore.count();
		var newIndices = new (getIndicesCtor(newStore._rawCount))(originalCount);
		var offset = 0;
		var dim0 = dims[0];
		var min = range[dim0][0];
		var max = range[dim0][1];
		var storeArr = newStore._chunks;
		var quickFinished = false;
		if (!newStore._indices) {
			var idx = 0;
			if (dimSize === 1) {
				var dimStorage = storeArr[dims[0]];
				for (var i = 0; i < len; i++) {
					var val = dimStorage[i];
					if (val >= min && val <= max || isNaN(val)) newIndices[offset++] = idx;
					idx++;
				}
				quickFinished = true;
			} else if (dimSize === 2) {
				var dimStorage = storeArr[dims[0]];
				var dimStorage2 = storeArr[dims[1]];
				var min2 = range[dims[1]][0];
				var max2 = range[dims[1]][1];
				for (var i = 0; i < len; i++) {
					var val = dimStorage[i];
					var val2 = dimStorage2[i];
					if ((val >= min && val <= max || isNaN(val)) && (val2 >= min2 && val2 <= max2 || isNaN(val2))) newIndices[offset++] = idx;
					idx++;
				}
				quickFinished = true;
			}
		}
		if (!quickFinished) {
			if (dimSize === 1) for (var i = 0; i < originalCount; i++) {
				var rawIndex = newStore.getRawIndex(i);
				var val = storeArr[dims[0]][rawIndex];
				if (val >= min && val <= max || isNaN(val)) newIndices[offset++] = rawIndex;
			}
			else for (var i = 0; i < originalCount; i++) {
				var keep = true;
				var rawIndex = newStore.getRawIndex(i);
				for (var k = 0; k < dimSize; k++) {
					var dimk = dims[k];
					var val = storeArr[dimk][rawIndex];
					if (val < range[dimk][0] || val > range[dimk][1]) keep = false;
				}
				if (keep) newIndices[offset++] = newStore.getRawIndex(i);
			}
		}
		if (offset < originalCount) newStore._indices = newIndices;
		newStore._count = offset;
		newStore._extent = [];
		newStore._updateGetRawIdx();
		return newStore;
	};
	/**
	* Data mapping to a new List with given dimensions
	*/
	DataStore.prototype.map = function(dims, cb) {
		var target = this.clone(dims);
		this._updateDims(target, dims, cb);
		return target;
	};
	/**
	* @caution Danger!! Only used in dataStack.
	*/
	DataStore.prototype.modify = function(dims, cb) {
		this._updateDims(this, dims, cb);
	};
	DataStore.prototype._updateDims = function(target, dims, cb) {
		var targetChunks = target._chunks;
		var tmpRetValue = [];
		var dimSize = dims.length;
		var dataCount = target.count();
		var values = [];
		var rawExtent = target._rawExtent;
		for (var i = 0; i < dims.length; i++) rawExtent[dims[i]] = initExtentForUnion();
		for (var dataIndex = 0; dataIndex < dataCount; dataIndex++) {
			var rawIndex = target.getRawIndex(dataIndex);
			for (var k = 0; k < dimSize; k++) values[k] = targetChunks[dims[k]][rawIndex];
			values[dimSize] = dataIndex;
			var retValue = cb && cb.apply(null, values);
			if (retValue != null) {
				if (typeof retValue !== "object") {
					tmpRetValue[0] = retValue;
					retValue = tmpRetValue;
				}
				for (var i = 0; i < retValue.length; i++) {
					var dim = dims[i];
					var val = retValue[i];
					var rawExtentOnDim = rawExtent[dim];
					var dimStore = targetChunks[dim];
					if (dimStore) dimStore[rawIndex] = val;
					if (val < rawExtentOnDim[0]) rawExtentOnDim[0] = val;
					if (val > rawExtentOnDim[1]) rawExtentOnDim[1] = val;
				}
			}
		}
	};
	/**
	* Large data down sampling using largest-triangle-three-buckets
	* @param {string} valueDimension
	* @param {number} targetCount
	*/
	DataStore.prototype.lttbDownSample = function(valueDimension, rate) {
		var target = this.clone([valueDimension], true);
		var dimStore = target._chunks[valueDimension];
		var len = this.count();
		var sampledIndex = 0;
		var frameSize = Math.floor(1 / rate);
		var currentRawIndex = this.getRawIndex(0);
		var maxArea;
		var area;
		var nextRawIndex;
		var newIndices = new (getIndicesCtor(this._rawCount))(Math.min((Math.ceil(len / frameSize) + 2) * 2, len));
		newIndices[sampledIndex++] = currentRawIndex;
		for (var i = 1; i < len - 1; i += frameSize) {
			var nextFrameStart = Math.min(i + frameSize, len - 1);
			var nextFrameEnd = Math.min(i + frameSize * 2, len);
			var avgX = (nextFrameEnd + nextFrameStart) / 2;
			var avgY = 0;
			for (var idx = nextFrameStart; idx < nextFrameEnd; idx++) {
				var rawIndex = this.getRawIndex(idx);
				var y = dimStore[rawIndex];
				if (isNaN(y)) continue;
				avgY += y;
			}
			avgY /= nextFrameEnd - nextFrameStart;
			var frameStart = i;
			var frameEnd = Math.min(i + frameSize, len);
			var pointAX = i - 1;
			var pointAY = dimStore[currentRawIndex];
			maxArea = -1;
			nextRawIndex = frameStart;
			var firstNaNIndex = -1;
			var countNaN = 0;
			for (var idx = frameStart; idx < frameEnd; idx++) {
				var rawIndex = this.getRawIndex(idx);
				var y = dimStore[rawIndex];
				if (isNaN(y)) {
					countNaN++;
					if (firstNaNIndex < 0) firstNaNIndex = rawIndex;
					continue;
				}
				area = Math.abs((pointAX - avgX) * (y - pointAY) - (pointAX - idx) * (avgY - pointAY));
				if (area > maxArea) {
					maxArea = area;
					nextRawIndex = rawIndex;
				}
			}
			if (countNaN > 0 && countNaN < frameEnd - frameStart) {
				newIndices[sampledIndex++] = Math.min(firstNaNIndex, nextRawIndex);
				nextRawIndex = Math.max(firstNaNIndex, nextRawIndex);
			}
			newIndices[sampledIndex++] = nextRawIndex;
			currentRawIndex = nextRawIndex;
		}
		newIndices[sampledIndex++] = this.getRawIndex(len - 1);
		target._count = sampledIndex;
		target._indices = newIndices;
		target.getRawIndex = this._getRawIdx;
		return target;
	};
	/**
	* Large data down sampling using min-max
	* @param {string} valueDimension
	* @param {number} rate
	*/
	DataStore.prototype.minmaxDownSample = function(valueDimension, rate) {
		var target = this.clone([valueDimension], true);
		var targetStorage = target._chunks;
		var frameSize = Math.floor(1 / rate);
		var dimStore = targetStorage[valueDimension];
		var len = this.count();
		var newIndices = new (getIndicesCtor(this._rawCount))(Math.ceil(len / frameSize) * 2);
		var offset = 0;
		for (var i = 0; i < len; i += frameSize) {
			var minIndex = i;
			var minValue = dimStore[this.getRawIndex(minIndex)];
			var maxIndex = i;
			var maxValue = dimStore[this.getRawIndex(maxIndex)];
			var thisFrameSize = frameSize;
			if (i + frameSize > len) thisFrameSize = len - i;
			for (var k = 0; k < thisFrameSize; k++) {
				var value = dimStore[this.getRawIndex(i + k)];
				if (value < minValue) {
					minValue = value;
					minIndex = i + k;
				}
				if (value > maxValue) {
					maxValue = value;
					maxIndex = i + k;
				}
			}
			var rawMinIndex = this.getRawIndex(minIndex);
			var rawMaxIndex = this.getRawIndex(maxIndex);
			if (minIndex < maxIndex) {
				newIndices[offset++] = rawMinIndex;
				newIndices[offset++] = rawMaxIndex;
			} else {
				newIndices[offset++] = rawMaxIndex;
				newIndices[offset++] = rawMinIndex;
			}
		}
		target._count = offset;
		target._indices = newIndices;
		target._updateGetRawIdx();
		return target;
	};
	/**
	* Large data down sampling on given dimension
	* @param sampleIndex Sample index for name and id
	*/
	DataStore.prototype.downSample = function(dimension, rate, sampleValue, sampleIndex) {
		var target = this.clone([dimension], true);
		var targetStorage = target._chunks;
		var frameValues = [];
		var frameSize = Math.floor(1 / rate);
		var dimStore = targetStorage[dimension];
		var len = this.count();
		var rawExtentOnDim = target._rawExtent[dimension] = initExtentForUnion();
		var newIndices = new (getIndicesCtor(this._rawCount))(Math.ceil(len / frameSize));
		var offset = 0;
		for (var i = 0; i < len; i += frameSize) {
			if (frameSize > len - i) {
				frameSize = len - i;
				frameValues.length = frameSize;
			}
			for (var k = 0; k < frameSize; k++) {
				var dataIdx = this.getRawIndex(i + k);
				frameValues[k] = dimStore[dataIdx];
			}
			var value = sampleValue(frameValues);
			var sampleFrameIdx = this.getRawIndex(Math.min(i + sampleIndex(frameValues, value) || 0, len - 1));
			dimStore[sampleFrameIdx] = value;
			if (value < rawExtentOnDim[0]) rawExtentOnDim[0] = value;
			if (value > rawExtentOnDim[1]) rawExtentOnDim[1] = value;
			newIndices[offset++] = sampleFrameIdx;
		}
		target._count = offset;
		target._indices = newIndices;
		target._updateGetRawIdx();
		return target;
	};
	/**
	* Data iteration
	* @param ctx default this
	* @example
	*  list.each(0, function (x, idx) {});
	*  list.each([0, 1], function (x, y, idx) {});
	*  list.each(function (idx) {})
	*/
	DataStore.prototype.each = function(dims, cb) {
		if (!this._count) return;
		var dimSize = dims.length;
		var chunks = this._chunks;
		for (var i = 0, len = this.count(); i < len; i++) {
			var rawIdx = this.getRawIndex(i);
			switch (dimSize) {
				case 0:
					cb(i);
					break;
				case 1:
					cb(chunks[dims[0]][rawIdx], i);
					break;
				case 2:
					cb(chunks[dims[0]][rawIdx], chunks[dims[1]][rawIdx], i);
					break;
				default:
					var k = 0;
					var value = [];
					for (; k < dimSize; k++) value[k] = chunks[dims[k]][rawIdx];
					value[k] = i;
					cb.apply(null, value);
			}
		}
	};
	DataStore.prototype.getDataExtent = function(dim, filter) {
		var dimData = this._chunks[dim];
		var initialExtent = initExtentForUnion();
		if (!dimData) return initialExtent;
		var currEnd = this.count();
		if (!this._indices && !filter) return this._rawExtent[dim].slice();
		var thisExtent = this._extent;
		var dimExtentRecord = thisExtent[dim] || (thisExtent[dim] = {});
		var filterParsed = parseSanitizationFilter(filter);
		var filterKey = filterParsed.key;
		var dimExtent = dimExtentRecord[filterKey];
		if (dimExtent) return dimExtent.slice();
		var min = initialExtent[0];
		var max = initialExtent[1];
		for (var i = 0; i < currEnd; i++) {
			var value = dimData[this.getRawIndex(i)];
			if (!filter || passesSanitizationFilter(filterParsed, value)) {
				if (value < min) min = value;
				if (value > max) max = value;
			}
		}
		return dimExtentRecord[filterKey] = [min, max];
	};
	/**
	* Get raw data item
	*/
	DataStore.prototype.getRawDataItem = function(idx) {
		var rawIdx = this.getRawIndex(idx);
		if (!this._provider.persistent) {
			var val = [];
			var chunks = this._chunks;
			for (var i = 0; i < chunks.length; i++) val.push(chunks[i][rawIdx]);
			return val;
		} else return this._provider.getItem(rawIdx);
	};
	/**
	* Clone shallow.
	*
	* @param clonedDims Determine which dims to clone. Will share the data if not specified.
	*/
	DataStore.prototype.clone = function(clonedDims, ignoreIndices) {
		var target = new DataStore();
		var chunks = this._chunks;
		var clonedDimsMap = clonedDims && reduce(clonedDims, function(obj, dimIdx) {
			obj[dimIdx] = true;
			return obj;
		}, {});
		if (clonedDimsMap) for (var i = 0; i < chunks.length; i++) target._chunks[i] = !clonedDimsMap[i] ? chunks[i] : cloneChunk(chunks[i]);
		else target._chunks = chunks;
		this._copyCommonProps(target);
		if (!ignoreIndices) target._indices = this._cloneIndices();
		target._updateGetRawIdx();
		return target;
	};
	DataStore.prototype._copyCommonProps = function(target) {
		target._count = this._count;
		target._rawCount = this._rawCount;
		target._provider = this._provider;
		target._dimensions = this._dimensions;
		target._extent = clone$1(this._extent);
		target._rawExtent = clone$1(this._rawExtent);
	};
	DataStore.prototype._cloneIndices = function() {
		if (this._indices) {
			var Ctor = this._indices.constructor;
			var indices = void 0;
			if (Ctor === Array) {
				var thisCount = this._indices.length;
				indices = new Ctor(thisCount);
				for (var i = 0; i < thisCount; i++) indices[i] = this._indices[i];
			} else indices = new Ctor(this._indices);
			return indices;
		}
		return null;
	};
	DataStore.prototype._getRawIdxIdentity = function(idx) {
		return idx;
	};
	DataStore.prototype._getRawIdx = function(idx) {
		if (idx < this._count && idx >= 0) return this._indices[idx];
		return -1;
	};
	DataStore.prototype._updateGetRawIdx = function() {
		this.getRawIndex = this._indices ? this._getRawIdx : this._getRawIdxIdentity;
	};
	DataStore.internalField = function() {
		function getDimValueSimply(dataItem, property, dataIndex, dimIndex) {
			return parseDataValue(dataItem[dimIndex], this._dimensions[dimIndex]);
		}
		defaultDimValueGetters = {
			arrayRows: getDimValueSimply,
			objectRows: function(dataItem, property, dataIndex, dimIndex) {
				return parseDataValue(dataItem[property], this._dimensions[dimIndex]);
			},
			keyedColumns: getDimValueSimply,
			original: function(dataItem, property, dataIndex, dimIndex) {
				var value = dataItem && (dataItem.value == null ? dataItem : dataItem.value);
				return parseDataValue(value instanceof Array ? value[dimIndex] : value, this._dimensions[dimIndex]);
			},
			typedArray: function(dataItem, property, dataIndex, dimIndex) {
				return dataItem[dimIndex];
			}
		};
	}();
	return DataStore;
}();
//#endregion
//#region node_modules/echarts/lib/data/helper/SeriesDataSchema.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var inner$3 = makeInner();
var dimTypeShort = {
	float: "f",
	int: "i",
	ordinal: "o",
	number: "n",
	time: "t"
};
/**
* Represents the dimension requirement of a series.
*
* NOTICE:
* When there are too many dimensions in dataset and many series, only the used dimensions
* (i.e., used by coord sys and declared in `series.encode`) are add to `dimensionDefineList`.
* But users may query data by other unused dimension names.
* In this case, users can only query data if and only if they have defined dimension names
* via ec option, so we provide `getDimensionIndexFromSource`, which only query them from
* `source` dimensions.
*/
var SeriesDataSchema = function() {
	function SeriesDataSchema(opt) {
		this.dimensions = opt.dimensions;
		this._dimOmitted = opt.dimensionOmitted;
		this.source = opt.source;
		this._fullDimCount = opt.fullDimensionCount;
		this._updateDimOmitted(opt.dimensionOmitted);
	}
	SeriesDataSchema.prototype.isDimensionOmitted = function() {
		return this._dimOmitted;
	};
	SeriesDataSchema.prototype._updateDimOmitted = function(dimensionOmitted) {
		this._dimOmitted = dimensionOmitted;
		if (!dimensionOmitted) return;
		if (!this._dimNameMap) this._dimNameMap = ensureSourceDimNameMap(this.source);
	};
	/**
	* @caution Can only be used when `dimensionOmitted: true`.
	*
	* Get index by user defined dimension name (i.e., not internal generate name).
	* That is, get index from `dimensionsDefine`.
	* If no `dimensionsDefine`, or no name get, return -1.
	*/
	SeriesDataSchema.prototype.getSourceDimensionIndex = function(dimName) {
		return retrieve2(this._dimNameMap.get(dimName), -1);
	};
	/**
	* @caution Can only be used when `dimensionOmitted: true`.
	*
	* Notice: may return `null`/`undefined` if user not specify dimension names.
	*/
	SeriesDataSchema.prototype.getSourceDimension = function(dimIndex) {
		var dimensionsDefine = this.source.dimensionsDefine;
		if (dimensionsDefine) return dimensionsDefine[dimIndex];
	};
	SeriesDataSchema.prototype.makeStoreSchema = function() {
		var dimCount = this._fullDimCount;
		var willRetrieveDataByName = shouldRetrieveDataByName(this.source);
		var makeHashStrict = !shouldOmitUnusedDimensions(dimCount);
		var dimHash = "";
		var dims = [];
		for (var fullDimIdx = 0, seriesDimIdx = 0; fullDimIdx < dimCount; fullDimIdx++) {
			var property = void 0;
			var type = void 0;
			var ordinalMeta = void 0;
			var seriesDimDef = this.dimensions[seriesDimIdx];
			if (seriesDimDef && seriesDimDef.storeDimIndex === fullDimIdx) {
				property = willRetrieveDataByName ? seriesDimDef.name : null;
				type = seriesDimDef.type;
				ordinalMeta = seriesDimDef.ordinalMeta;
				seriesDimIdx++;
			} else {
				var sourceDimDef = this.getSourceDimension(fullDimIdx);
				if (sourceDimDef) {
					property = willRetrieveDataByName ? sourceDimDef.name : null;
					type = sourceDimDef.type;
				}
			}
			dims.push({
				property,
				type,
				ordinalMeta
			});
			if (willRetrieveDataByName && property != null && (!seriesDimDef || !seriesDimDef.isCalculationCoord)) dimHash += makeHashStrict ? property.replace(/\`/g, "`1").replace(/\$/g, "`2") : property;
			dimHash += "$";
			dimHash += dimTypeShort[type] || "f";
			if (ordinalMeta) dimHash += ordinalMeta.uid;
			dimHash += "$";
		}
		var source = this.source;
		return {
			dimensions: dims,
			hash: [
				source.seriesLayoutBy,
				source.startIndex,
				dimHash
			].join("$$")
		};
	};
	SeriesDataSchema.prototype.makeOutputDimensionNames = function() {
		var result = [];
		for (var fullDimIdx = 0, seriesDimIdx = 0; fullDimIdx < this._fullDimCount; fullDimIdx++) {
			var name_1 = void 0;
			var seriesDimDef = this.dimensions[seriesDimIdx];
			if (seriesDimDef && seriesDimDef.storeDimIndex === fullDimIdx) {
				if (!seriesDimDef.isCalculationCoord) name_1 = seriesDimDef.name;
				seriesDimIdx++;
			} else {
				var sourceDimDef = this.getSourceDimension(fullDimIdx);
				if (sourceDimDef) name_1 = sourceDimDef.name;
			}
			result.push(name_1);
		}
		return result;
	};
	SeriesDataSchema.prototype.appendCalculationDimension = function(dimDef) {
		this.dimensions.push(dimDef);
		dimDef.isCalculationCoord = true;
		this._fullDimCount++;
		this._updateDimOmitted(true);
	};
	return SeriesDataSchema;
}();
function isSeriesDataSchema(schema) {
	return schema instanceof SeriesDataSchema;
}
function createDimNameMap(dimsDef) {
	var dataDimNameMap = createHashMap();
	for (var i = 0; i < (dimsDef || []).length; i++) {
		var dimDefItemRaw = dimsDef[i];
		var userDimName = isObject(dimDefItemRaw) ? dimDefItemRaw.name : dimDefItemRaw;
		if (userDimName != null && dataDimNameMap.get(userDimName) == null) dataDimNameMap.set(userDimName, i);
	}
	return dataDimNameMap;
}
function ensureSourceDimNameMap(source) {
	var innerSource = inner$3(source);
	return innerSource.dimNameMap || (innerSource.dimNameMap = createDimNameMap(source.dimensionsDefine));
}
function shouldOmitUnusedDimensions(dimCount) {
	return dimCount > 30;
}
//#endregion
//#region node_modules/echarts/lib/core/CoordinateSystem.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* FIXME:
* `nonSeriesBoxCoordSysCreators` and `_nonSeriesBoxMasterList` are hardcoded implementations.
* Regarding "coord sys layout based on another coord sys", currently we only experimentally support one level
* dependency, such as, "grid(cartesian)s can be laid out based on matrix/calendar coord sys."
* But a comprehensive implementation may need to support:
*  - Recursive dependencies. e.g., a matrix coord sys lays out based on another matrix coord sys.
*    That requires in the implementation `create` and `update` of coord sys are called by a dependency graph.
*    (@see enableTopologicalTravel in `util/component.ts`)
*/
var nonSeriesBoxCoordSysCreators = {};
var normalCoordSysCreators = {};
var CoordinateSystemManager = function() {
	function CoordinateSystemManager() {
		this._normalMasterList = [];
		this._nonSeriesBoxMasterList = [];
	}
	/**
	* Typically,
	*  - in `create`, a coord sys lays out based on a given rect;
	*  - in `update`, update the pixel and data extent of there axes (if any) based on processed `series.data`.
	* After that, a coord sys can serve (typically by `dataToPoint`/`dataToLayout`/`pointToData`).
	* If the coordinate system do not lay out based on `series.data`, `update` is not needed.
	*/
	CoordinateSystemManager.prototype.create = function(ecModel, api) {
		this._nonSeriesBoxMasterList = dealCreate(nonSeriesBoxCoordSysCreators, true);
		this._normalMasterList = dealCreate(normalCoordSysCreators, false);
		function dealCreate(creatorMap, canBeNonSeriesBox) {
			var coordinateSystems = [];
			each$1(creatorMap, function(creator, type) {
				var list = creator.create(ecModel, api);
				coordinateSystems = coordinateSystems.concat(list || []);
			});
			return coordinateSystems;
		}
	};
	/**
	* @see CoordinateSystem['create']
	*/
	CoordinateSystemManager.prototype.update = function(ecModel, api) {
		each$1(this._normalMasterList, function(coordSys) {
			coordSys.update && coordSys.update(ecModel, api);
		});
	};
	CoordinateSystemManager.prototype.getCoordinateSystems = function() {
		return this._normalMasterList.concat(this._nonSeriesBoxMasterList);
	};
	CoordinateSystemManager.register = function(type, creator) {
		if (type === "matrix" || type === "calendar") {
			nonSeriesBoxCoordSysCreators[type] = creator;
			return;
		}
		normalCoordSysCreators[type] = creator;
	};
	CoordinateSystemManager.get = function(type) {
		return normalCoordSysCreators[type] || nonSeriesBoxCoordSysCreators[type];
	};
	return CoordinateSystemManager;
}();
function canBeNonSeriesBoxCoordSys(coordSysType) {
	return !!nonSeriesBoxCoordSysCreators[coordSysType];
}
/**
* @see_also `createBoxLayoutReference`
* @see_also `injectCoordSysByOption`
*/
function registerLayOutOnCoordSysUsage(opt) {
	coordSysUseMap.set(opt.fullType, { getCoord2: void 0 }).getCoord2 = opt.getCoord2;
}
var coordSysUseMap = createHashMap();
/**
* @return Be an object, but never be NullUndefined.
*/
function getCoordForCoordSysUsageKindBox(model) {
	var coord = model.getShallow("coord", true);
	var from = 1;
	if (coord == null) {
		var store = coordSysUseMap.get(model.type);
		if (store && store.getCoord2) {
			from = 2;
			coord = store.getCoord2(model);
		}
	}
	return {
		coord,
		from
	};
}
function decideCoordSysUsageKind(model, printError) {
	var coordSysType = model.getShallow("coordinateSystem");
	var coordSysUsageOption = model.getShallow("coordinateSystemUsage", true);
	var kind = 0;
	if (coordSysType) {
		var isSeries = model.mainType === "series";
		if (coordSysUsageOption == null) coordSysUsageOption = isSeries ? "data" : "box";
		if (coordSysUsageOption === "data") {
			kind = 1;
			if (!isSeries) kind = 0;
		} else if (coordSysUsageOption === "box") {
			kind = 2;
			if (!isSeries && !canBeNonSeriesBoxCoordSys(coordSysType)) kind = 0;
		}
	}
	return {
		coordSysType,
		kind
	};
}
/**
* These cases are considered:
*  (A) Most series can use only "COORD_SYS_USAGE_KIND_DATA", but "COORD_SYS_USAGE_KIND_BOX" is not applicable:
*    - e.g., series.heatmap, series.line, series.bar, series.scatter, ...
*  (B) Some series and most components can use only "COORD_SYS_USAGE_KIND_BOX", but "COORD_SYS_USAGE_KIND_DATA"
*    is not applicable:
*    - e.g., series.pie, series.funnel, ...
*    - e.g., grid, polar, geo, title, ...
*  (C) Several series can use both "COORD_SYS_USAGE_KIND_BOX" and "COORD_SYS_USAGE_KIND_DATA", even at the same time:
*    - e.g., series.graph, series.map
*      - If graph or map series use "COORD_SYS_USAGE_KIND_BOX", it creates a internal coord sys as
*        "COORD_SYS_USAGE_KIND_DATA" to lay out its data.
*      - Graph series can use matrix coord sys as either the "COORD_SYS_USAGE_KIND_DATA" (each item layout
*        on one cell) or "COORD_SYS_USAGE_KIND_BOX" (the entire series are layout within one cell).
*    - To achieve this effect,
*      `series.coordinateSystemUsage: 'box'` needs to be specified explicitly.
*
* Check these echarts option settings:
*  - If `series: {type: 'bar'}`:
*      COORD_SYS_USAGE_KIND_DATA: "cartesian2d",
*      COORD_SYS_USAGE_KIND_BOX: "none".
*      (since `coordinateSystem: 'cartesian2d'` is the default option in bar.)
*  - If `grid: {coordinateSystem: 'matrix'}`
*      COORD_SYS_USAGE_KIND_DATA: "none",
*      COORD_SYS_USAGE_KIND_BOX: "matrix".
*  - If `series: {type: 'pie', coordinateSystem: 'matrix'}`:
*      COORD_SYS_USAGE_KIND_DATA: "none",
*      COORD_SYS_USAGE_KIND_BOX: "matrix".
*      (since `coordinateSystemUsage: 'box'` is the default option in pie.)
*  - If `series: {type: 'graph', coordinateSystem: 'matrix'}`:
*      COORD_SYS_USAGE_KIND_DATA: "matrix",
*      COORD_SYS_USAGE_KIND_BOX: "none"
*  - If `series: {type: 'graph', coordinateSystem: 'matrix', coordinateSystemUsage: 'box'}`:
*      COORD_SYS_USAGE_KIND_DATA: "an internal view",
*      COORD_SYS_USAGE_KIND_BOX: "the internal view is laid out on a matrix"
*  - If `series: {type: 'map'}`:
*      COORD_SYS_USAGE_KIND_DATA: "a internal geo",
*      COORD_SYS_USAGE_KIND_BOX: "none"
*  - If `series: {type: 'map', coordinateSystem: 'geo', geoIndex: 0}`:
*      COORD_SYS_USAGE_KIND_DATA: "a geo",
*      COORD_SYS_USAGE_KIND_BOX: "none"
*  - If `series: {type: 'map', coordinateSystem: 'matrix'}`:
*      not_applicable
*  - If `series: {type: 'map', coordinateSystem: 'matrix', coordinateSystemUsage: 'box'}`:
*      COORD_SYS_USAGE_KIND_DATA: "an internal geo",
*      COORD_SYS_USAGE_KIND_BOX: "the internal geo is laid out on a matrix"
*
* @usage
* For case (A) & (B),
*  call `injectCoordSysByOption({coordSysType: 'aaa', ...})` once for each series/components.
* For case (C),
*  call `injectCoordSysByOption({coordSysType: 'aaa', ...})` once for each series/components,
*  and then call `injectCoordSysByOption({coordSysType: 'bbb', ..., isDefaultDataCoordSys: true})`
*  once for each series/components.
*/
function injectCoordSysByOption(opt) {
	var targetModel = opt.targetModel, coordSysType = opt.coordSysType, coordSysProvider = opt.coordSysProvider, isDefaultDataCoordSys = opt.isDefaultDataCoordSys;
	opt.allowNotFound;
	var _a = decideCoordSysUsageKind(targetModel, true), kind = _a.kind, declaredType = _a.coordSysType;
	if (isDefaultDataCoordSys && kind !== 1) {
		kind = 1;
		declaredType = coordSysType;
	}
	if (kind === 0 || declaredType !== coordSysType) return 0;
	var coordSys = coordSysProvider(coordSysType, targetModel);
	if (!coordSys) return 0;
	if (kind === 1) targetModel.coordinateSystem = coordSys;
	else targetModel.boxCoordinateSystem = coordSys;
	return kind;
}
//#endregion
//#region node_modules/echarts/lib/data/helper/dataStackHelper.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* Note that it is too complicated to support 3d stack by value
* (have to create two-dimension inverted index), so in 3d case
* we just support that stacked by index.
*
* Stack is calculated in `src/processor/dataStack.ts`.
*
* @param seriesModel
* @param dimensionsInput The same as the input of <module:echarts/data/SeriesData>.
*        The input will be modified.
* @param opt
* @param opt.stackedCoordDimension Specify a coord dimension if needed.
* @param opt.byIndex=false
* @return calculationInfo
* {
*     stackedDimension: string
*     stackedByDimension: string
*     isStackedByIndex: boolean
*     stackedOverDimension: string
*     stackResultDimension: string
* }
*/
function enableDataStack(seriesModel, dimensionsInput, opt) {
	opt = opt || {};
	var byIndex = opt.byIndex;
	var stackedCoordDimension = opt.stackedCoordDimension;
	var dimensionDefineList;
	var schema;
	var store;
	if (isLegacyDimensionsInput(dimensionsInput)) dimensionDefineList = dimensionsInput;
	else {
		schema = dimensionsInput.schema;
		dimensionDefineList = schema.dimensions;
		store = dimensionsInput.store;
	}
	var mayStack = !!(seriesModel && seriesModel.get("stack"));
	var stackedByDimInfo;
	var stackedDimInfo;
	var stackResultDimension;
	var stackedOverDimension;
	var allDimTypesAreNotOrdinalAndTime = true;
	function dimTypeIsNotOrdinalAndTime(dimensionInfo) {
		return dimensionInfo.type !== "ordinal" && dimensionInfo.type !== "time";
	}
	each$1(dimensionDefineList, function(dimensionInfo, index) {
		if (isString(dimensionInfo)) dimensionDefineList[index] = dimensionInfo = { name: dimensionInfo };
		if (!dimTypeIsNotOrdinalAndTime(dimensionInfo)) allDimTypesAreNotOrdinalAndTime = false;
	});
	each$1(dimensionDefineList, function(dimensionInfo, index) {
		if (mayStack && !dimensionInfo.isExtraCoord) {
			if (!byIndex && !stackedByDimInfo && dimensionInfo.ordinalMeta) stackedByDimInfo = dimensionInfo;
			if (!stackedDimInfo && dimTypeIsNotOrdinalAndTime(dimensionInfo) && (!allDimTypesAreNotOrdinalAndTime || dimensionInfo.coordDim !== "x" && dimensionInfo.coordDim !== "angle") && (!stackedCoordDimension || stackedCoordDimension === dimensionInfo.coordDim)) stackedDimInfo = dimensionInfo;
		}
	});
	if (stackedDimInfo && !byIndex && !stackedByDimInfo) byIndex = true;
	if (stackedDimInfo) {
		stackResultDimension = "__\0ecstackresult_" + seriesModel.id;
		stackedOverDimension = "__\0ecstackedover_" + seriesModel.id;
		if (stackedByDimInfo) stackedByDimInfo.createInvertedIndices = true;
		var stackedDimCoordDim_1 = stackedDimInfo.coordDim;
		var stackedDimType = stackedDimInfo.type;
		var stackedDimCoordIndex_1 = 0;
		each$1(dimensionDefineList, function(dimensionInfo) {
			if (dimensionInfo.coordDim === stackedDimCoordDim_1) stackedDimCoordIndex_1++;
		});
		var stackedOverDimensionDefine = {
			name: stackResultDimension,
			coordDim: stackedDimCoordDim_1,
			coordDimIndex: stackedDimCoordIndex_1,
			type: stackedDimType,
			isExtraCoord: true,
			isCalculationCoord: true,
			storeDimIndex: dimensionDefineList.length
		};
		var stackResultDimensionDefine = {
			name: stackedOverDimension,
			coordDim: stackedOverDimension,
			coordDimIndex: stackedDimCoordIndex_1 + 1,
			type: stackedDimType,
			isExtraCoord: true,
			isCalculationCoord: true,
			storeDimIndex: dimensionDefineList.length + 1
		};
		if (schema) {
			if (store) {
				stackedOverDimensionDefine.storeDimIndex = store.ensureCalculationDimension(stackedOverDimension, stackedDimType);
				stackResultDimensionDefine.storeDimIndex = store.ensureCalculationDimension(stackResultDimension, stackedDimType);
			}
			schema.appendCalculationDimension(stackedOverDimensionDefine);
			schema.appendCalculationDimension(stackResultDimensionDefine);
		} else {
			dimensionDefineList.push(stackedOverDimensionDefine);
			dimensionDefineList.push(stackResultDimensionDefine);
		}
	}
	return {
		stackedDimension: stackedDimInfo && stackedDimInfo.name,
		stackedByDimension: stackedByDimInfo && stackedByDimInfo.name,
		isStackedByIndex: byIndex,
		stackedOverDimension,
		stackResultDimension
	};
}
function isLegacyDimensionsInput(dimensionsInput) {
	return !isSeriesDataSchema(dimensionsInput.schema);
}
function isDimensionStacked(data, stackedDim) {
	return !!stackedDim && stackedDim === data.getCalculationInfo("stackedDimension");
}
function getStackedDimension(data, targetDim) {
	return isDimensionStacked(data, targetDim) ? data.getCalculationInfo("stackResultDimension") : targetDim;
}
//#endregion
//#region node_modules/echarts/lib/util/component.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var base = Math.round(Math.random() * 10);
/**
* @public
* @param {string} type
* @return {string}
*/
function getUID(type) {
	return [type || "", base++].join("_");
}
/**
* Implements `SubTypeDefaulterManager` for `target`.
*/
function enableSubTypeDefaulter(target) {
	var subTypeDefaulters = {};
	target.registerSubTypeDefaulter = function(componentType, defaulter) {
		var componentTypeInfo = parseClassType(componentType);
		subTypeDefaulters[componentTypeInfo.main] = defaulter;
	};
	target.determineSubType = function(componentType, option) {
		var type = option.type;
		if (!type) {
			var componentTypeMain = parseClassType(componentType).main;
			if (target.hasSubTypes(componentType) && subTypeDefaulters[componentTypeMain]) type = subTypeDefaulters[componentTypeMain](option);
		}
		return type;
	};
}
/**
* Implements `TopologicalTravelable<any>` for `entity`.
*
* Topological travel on Activity Network (Activity On Vertices).
* Dependencies is defined in Model.prototype.dependencies, like ['xAxis', 'yAxis'].
* If 'xAxis' or 'yAxis' is absent in componentTypeList, just ignore it in topology.
* If there is circular dependencey, Error will be thrown.
*/
function enableTopologicalTravel(entity, dependencyGetter) {
	/**
	* @param targetNameList Target Component type list.
	*                       Can be ['aa', 'bb', 'aa.xx']
	* @param fullNameList By which we can build dependency graph.
	* @param callback Params: componentType, dependencies.
	* @param context Scope of callback.
	*/
	entity.topologicalTravel = function(targetNameList, fullNameList, callback, context) {
		if (!targetNameList.length) return;
		var result = makeDepndencyGraph(fullNameList);
		var graph = result.graph;
		var noEntryList = result.noEntryList;
		var targetNameSet = {};
		each$1(targetNameList, function(name) {
			targetNameSet[name] = true;
		});
		while (noEntryList.length) {
			var currComponentType = noEntryList.pop();
			var currVertex = graph[currComponentType];
			var isInTargetNameSet = !!targetNameSet[currComponentType];
			if (isInTargetNameSet) {
				callback.call(context, currComponentType, currVertex.originalDeps.slice());
				delete targetNameSet[currComponentType];
			}
			each$1(currVertex.successor, isInTargetNameSet ? removeEdgeAndAdd : removeEdge);
		}
		each$1(targetNameSet, function() {
			throw new Error("");
		});
		function removeEdge(succComponentType) {
			graph[succComponentType].entryCount--;
			if (graph[succComponentType].entryCount === 0) noEntryList.push(succComponentType);
		}
		function removeEdgeAndAdd(succComponentType) {
			targetNameSet[succComponentType] = true;
			removeEdge(succComponentType);
		}
	};
	function makeDepndencyGraph(fullNameList) {
		var graph = {};
		var noEntryList = [];
		each$1(fullNameList, function(name) {
			var thisItem = createDependencyGraphItem(graph, name);
			var availableDeps = getAvailableDependencies(thisItem.originalDeps = dependencyGetter(name), fullNameList);
			thisItem.entryCount = availableDeps.length;
			if (thisItem.entryCount === 0) noEntryList.push(name);
			each$1(availableDeps, function(dependentName) {
				if (indexOf(thisItem.predecessor, dependentName) < 0) thisItem.predecessor.push(dependentName);
				var thatItem = createDependencyGraphItem(graph, dependentName);
				if (indexOf(thatItem.successor, dependentName) < 0) thatItem.successor.push(name);
			});
		});
		return {
			graph,
			noEntryList
		};
	}
	function createDependencyGraphItem(graph, name) {
		if (!graph[name]) graph[name] = {
			predecessor: [],
			successor: []
		};
		return graph[name];
	}
	function getAvailableDependencies(originalDeps, fullNameList) {
		var availableDeps = [];
		each$1(originalDeps, function(dep) {
			indexOf(fullNameList, dep) >= 0 && availableDeps.push(dep);
		});
		return availableDeps;
	}
}
function inheritDefaultOption(superOption, subOption) {
	return merge(merge({}, superOption, true), subOption, true);
}
//#endregion
//#region node_modules/zrender/lib/core/fourPointsTransform.js
var LN2 = Math.log(2);
function determinant(rows, rank, rowStart, rowMask, colMask, detCache) {
	var cacheKey = rowMask + "-" + colMask;
	var fullRank = rows.length;
	if (detCache.hasOwnProperty(cacheKey)) return detCache[cacheKey];
	if (rank === 1) {
		var colStart = Math.round(Math.log((1 << fullRank) - 1 & ~colMask) / LN2);
		return rows[rowStart][colStart];
	}
	var subRowMask = rowMask | 1 << rowStart;
	var subRowStart = rowStart + 1;
	while (rowMask & 1 << subRowStart) subRowStart++;
	var sum = 0;
	for (var j = 0, colLocalIdx = 0; j < fullRank; j++) {
		var colTag = 1 << j;
		if (!(colTag & colMask)) {
			sum += (colLocalIdx % 2 ? -1 : 1) * rows[rowStart][j] * determinant(rows, rank - 1, subRowStart, subRowMask, colMask | colTag, detCache);
			colLocalIdx++;
		}
	}
	detCache[cacheKey] = sum;
	return sum;
}
function buildTransformer(src, dest) {
	var mA = [
		[
			src[0],
			src[1],
			1,
			0,
			0,
			0,
			-dest[0] * src[0],
			-dest[0] * src[1]
		],
		[
			0,
			0,
			0,
			src[0],
			src[1],
			1,
			-dest[1] * src[0],
			-dest[1] * src[1]
		],
		[
			src[2],
			src[3],
			1,
			0,
			0,
			0,
			-dest[2] * src[2],
			-dest[2] * src[3]
		],
		[
			0,
			0,
			0,
			src[2],
			src[3],
			1,
			-dest[3] * src[2],
			-dest[3] * src[3]
		],
		[
			src[4],
			src[5],
			1,
			0,
			0,
			0,
			-dest[4] * src[4],
			-dest[4] * src[5]
		],
		[
			0,
			0,
			0,
			src[4],
			src[5],
			1,
			-dest[5] * src[4],
			-dest[5] * src[5]
		],
		[
			src[6],
			src[7],
			1,
			0,
			0,
			0,
			-dest[6] * src[6],
			-dest[6] * src[7]
		],
		[
			0,
			0,
			0,
			src[6],
			src[7],
			1,
			-dest[7] * src[6],
			-dest[7] * src[7]
		]
	];
	var detCache = {};
	var det = determinant(mA, 8, 0, 0, 0, detCache);
	if (det === 0) return;
	var vh = [];
	for (var i = 0; i < 8; i++) for (var j = 0; j < 8; j++) {
		vh[j] ?? (vh[j] = 0);
		vh[j] += ((i + j) % 2 ? -1 : 1) * determinant(mA, 7, i === 0 ? 1 : 0, 1 << i, 1 << j, detCache) / det * dest[i];
	}
	return function(out, srcPointX, srcPointY) {
		var pk = srcPointX * vh[6] + srcPointY * vh[7] + 1;
		out[0] = (srcPointX * vh[0] + srcPointY * vh[1] + vh[2]) / pk;
		out[1] = (srcPointX * vh[3] + srcPointY * vh[4] + vh[5]) / pk;
	};
}
//#endregion
//#region node_modules/zrender/lib/core/dom.js
var EVENT_SAVED_PROP = "___zrEVENTSAVED";
var _calcOut = [];
function transformLocalCoord(out, elFrom, elTarget, inX, inY) {
	return transformCoordWithViewport(_calcOut, elFrom, inX, inY, true) && transformCoordWithViewport(out, elTarget, _calcOut[0], _calcOut[1]);
}
function transformLocalCoordClear(elFrom, elTarget) {
	elFrom && dealClear(elFrom);
	elTarget && dealClear(elTarget);
	function dealClear(el) {
		var saved = el[EVENT_SAVED_PROP];
		if (saved) {
			saved.clearMarkers && saved.clearMarkers();
			delete el[EVENT_SAVED_PROP];
		}
	}
}
function transformCoordWithViewport(out, el, inX, inY, inverse) {
	if (el.getBoundingClientRect && env.domSupported && !isCanvasEl(el)) {
		var saved = el[EVENT_SAVED_PROP] || (el[EVENT_SAVED_PROP] = {});
		var transformer = preparePointerTransformer(prepareCoordMarkers(el, saved), saved, inverse);
		if (transformer) {
			transformer(out, inX, inY);
			return true;
		}
	}
	return false;
}
function prepareCoordMarkers(el, saved) {
	var markers = saved.markers;
	if (markers) return markers;
	markers = saved.markers = [];
	var propLR = ["left", "right"];
	var propTB = ["top", "bottom"];
	for (var i = 0; i < 4; i++) {
		var marker = document.createElement("div");
		var stl = marker.style;
		var idxLR = i % 2;
		var idxTB = (i >> 1) % 2;
		stl.cssText = [
			"position: absolute",
			"visibility: hidden",
			"padding: 0",
			"margin: 0",
			"border-width: 0",
			"user-select: none",
			"width:0",
			"height:0",
			propLR[idxLR] + ":0",
			propTB[idxTB] + ":0",
			propLR[1 - idxLR] + ":auto",
			propTB[1 - idxTB] + ":auto",
			""
		].join("!important;");
		el.appendChild(marker);
		markers.push(marker);
	}
	saved.clearMarkers = function() {
		each$1(markers, function(marker) {
			marker.parentNode && marker.parentNode.removeChild(marker);
		});
	};
	return markers;
}
function preparePointerTransformer(markers, saved, inverse) {
	var transformerName = inverse ? "invTrans" : "trans";
	var transformer = saved[transformerName];
	var oldSrcCoords = saved.srcCoords;
	var srcCoords = [];
	var destCoords = [];
	var oldCoordTheSame = true;
	for (var i = 0; i < 4; i++) {
		var rect = markers[i].getBoundingClientRect();
		var ii = 2 * i;
		var x = rect.left;
		var y = rect.top;
		srcCoords.push(x, y);
		oldCoordTheSame = oldCoordTheSame && oldSrcCoords && x === oldSrcCoords[ii] && y === oldSrcCoords[ii + 1];
		destCoords.push(markers[i].offsetLeft, markers[i].offsetTop);
	}
	return oldCoordTheSame && transformer ? transformer : (saved.srcCoords = srcCoords, saved[transformerName] = inverse ? buildTransformer(destCoords, srcCoords) : buildTransformer(srcCoords, destCoords));
}
function isCanvasEl(el) {
	return el.nodeName.toUpperCase() === "CANVAS";
}
var replaceReg = /([&<>"'])/g;
var replaceMap = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;",
	"'": "&#39;"
};
function encodeHTML(source) {
	return source == null ? "" : (source + "").replace(replaceReg, function(str, c) {
		return replaceMap[c];
	});
}
//#endregion
//#region node_modules/echarts/lib/i18n/langEN.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* Language: English.
*/
var langEN_default = {
	time: {
		month: [
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December"
		],
		monthAbbr: [
			"Jan",
			"Feb",
			"Mar",
			"Apr",
			"May",
			"Jun",
			"Jul",
			"Aug",
			"Sep",
			"Oct",
			"Nov",
			"Dec"
		],
		dayOfWeek: [
			"Sunday",
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday"
		],
		dayOfWeekAbbr: [
			"Sun",
			"Mon",
			"Tue",
			"Wed",
			"Thu",
			"Fri",
			"Sat"
		]
	},
	legend: { selector: {
		all: "All",
		inverse: "Inv"
	} },
	toolbox: {
		brush: { title: {
			rect: "Box Select",
			polygon: "Lasso Select",
			lineX: "Horizontally Select",
			lineY: "Vertically Select",
			keep: "Keep Selections",
			clear: "Clear Selections"
		} },
		dataView: {
			title: "Data View",
			lang: [
				"Data View",
				"Close",
				"Refresh"
			]
		},
		dataZoom: { title: {
			zoom: "Zoom",
			back: "Zoom Reset"
		} },
		magicType: { title: {
			line: "Switch to Line Chart",
			bar: "Switch to Bar Chart",
			stack: "Stack",
			tiled: "Tile"
		} },
		restore: { title: "Restore" },
		saveAsImage: {
			title: "Save as Image",
			lang: ["Right Click to Save Image"]
		}
	},
	series: { typeNames: {
		pie: "Pie chart",
		bar: "Bar chart",
		line: "Line chart",
		scatter: "Scatter plot",
		effectScatter: "Ripple scatter plot",
		radar: "Radar chart",
		tree: "Tree",
		treemap: "Treemap",
		boxplot: "Boxplot",
		candlestick: "Candlestick",
		k: "K line chart",
		heatmap: "Heat map",
		map: "Map",
		parallel: "Parallel coordinate map",
		lines: "Line graph",
		graph: "Relationship graph",
		sankey: "Sankey diagram",
		funnel: "Funnel chart",
		gauge: "Gauge",
		pictorialBar: "Pictorial bar",
		themeRiver: "Theme River Map",
		sunburst: "Sunburst",
		custom: "Custom chart",
		chart: "Chart"
	} },
	aria: {
		general: {
			withTitle: "This is a chart about \"{title}\"",
			withoutTitle: "This is a chart"
		},
		series: {
			single: {
				prefix: "",
				withName: " with type {seriesType} named {seriesName}.",
				withoutName: " with type {seriesType}."
			},
			multiple: {
				prefix: ". It consists of {seriesCount} series count.",
				withName: " The {seriesId} series is a {seriesType} representing {seriesName}.",
				withoutName: " The {seriesId} series is a {seriesType}.",
				separator: {
					middle: "",
					end: ""
				}
			}
		},
		data: {
			allData: "The data is as follows: ",
			partialData: "The first {displayCnt} items are: ",
			withName: "the data for {name} is {value}",
			withoutName: "{value}",
			separator: {
				middle: ", ",
				end: ". "
			}
		}
	}
};
//#endregion
//#region node_modules/echarts/lib/i18n/langZH.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var langZH_default = {
	time: {
		month: [
			"一月",
			"二月",
			"三月",
			"四月",
			"五月",
			"六月",
			"七月",
			"八月",
			"九月",
			"十月",
			"十一月",
			"十二月"
		],
		monthAbbr: [
			"1月",
			"2月",
			"3月",
			"4月",
			"5月",
			"6月",
			"7月",
			"8月",
			"9月",
			"10月",
			"11月",
			"12月"
		],
		dayOfWeek: [
			"星期日",
			"星期一",
			"星期二",
			"星期三",
			"星期四",
			"星期五",
			"星期六"
		],
		dayOfWeekAbbr: [
			"日",
			"一",
			"二",
			"三",
			"四",
			"五",
			"六"
		]
	},
	legend: { selector: {
		all: "全选",
		inverse: "反选"
	} },
	toolbox: {
		brush: { title: {
			rect: "矩形选择",
			polygon: "圈选",
			lineX: "横向选择",
			lineY: "纵向选择",
			keep: "保持选择",
			clear: "清除选择"
		} },
		dataView: {
			title: "数据视图",
			lang: [
				"数据视图",
				"关闭",
				"刷新"
			]
		},
		dataZoom: { title: {
			zoom: "区域缩放",
			back: "区域缩放还原"
		} },
		magicType: { title: {
			line: "切换为折线图",
			bar: "切换为柱状图",
			stack: "切换为堆叠",
			tiled: "切换为平铺"
		} },
		restore: { title: "还原" },
		saveAsImage: {
			title: "保存为图片",
			lang: ["右键另存为图片"]
		}
	},
	series: { typeNames: {
		pie: "饼图",
		bar: "柱状图",
		line: "折线图",
		scatter: "散点图",
		effectScatter: "涟漪散点图",
		radar: "雷达图",
		tree: "树图",
		treemap: "矩形树图",
		boxplot: "箱型图",
		candlestick: "K线图",
		k: "K线图",
		heatmap: "热力图",
		map: "地图",
		parallel: "平行坐标图",
		lines: "线图",
		graph: "关系图",
		sankey: "桑基图",
		funnel: "漏斗图",
		gauge: "仪表盘图",
		pictorialBar: "象形柱图",
		themeRiver: "主题河流图",
		sunburst: "旭日图",
		custom: "自定义图表",
		chart: "图表"
	} },
	aria: {
		general: {
			withTitle: "这是一个关于“{title}”的图表。",
			withoutTitle: "这是一个图表，"
		},
		series: {
			single: {
				prefix: "",
				withName: "图表类型是{seriesType}，表示{seriesName}。",
				withoutName: "图表类型是{seriesType}。"
			},
			multiple: {
				prefix: "它由{seriesCount}个图表系列组成。",
				withName: "第{seriesId}个系列是一个表示{seriesName}的{seriesType}，",
				withoutName: "第{seriesId}个系列是一个{seriesType}，",
				separator: {
					middle: "；",
					end: "。"
				}
			}
		},
		data: {
			allData: "其数据是——",
			partialData: "其中，前{displayCnt}项是——",
			withName: "{name}的数据是{value}",
			withoutName: "{value}",
			separator: {
				middle: "，",
				end: ""
			}
		}
	}
};
//#endregion
//#region node_modules/echarts/lib/core/locale.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var LOCALE_ZH = "ZH";
var LOCALE_EN = "EN";
var DEFAULT_LOCALE = LOCALE_EN;
var localeStorage = {};
var localeModels = {};
var SYSTEM_LANG = !env.domSupported ? DEFAULT_LOCALE : function() {
	return (document.documentElement.lang || navigator.language || navigator.browserLanguage || DEFAULT_LOCALE).toUpperCase().indexOf(LOCALE_ZH) > -1 ? LOCALE_ZH : DEFAULT_LOCALE;
}();
function registerLocale(locale, localeObj) {
	locale = locale.toUpperCase();
	localeModels[locale] = new Model(localeObj);
	localeStorage[locale] = localeObj;
}
function createLocaleObject(locale) {
	if (isString(locale)) {
		var localeObj = localeStorage[locale.toUpperCase()] || {};
		if (locale === LOCALE_ZH || locale === LOCALE_EN) return clone$1(localeObj);
		else return merge(clone$1(localeObj), clone$1(localeStorage[DEFAULT_LOCALE]), false);
	} else return merge(clone$1(locale), clone$1(localeStorage[DEFAULT_LOCALE]), false);
}
function getLocaleModel(lang) {
	return localeModels[lang];
}
function getDefaultLocaleModel() {
	return localeModels[DEFAULT_LOCALE];
}
registerLocale(LOCALE_EN, langEN_default);
registerLocale(LOCALE_ZH, langZH_default);
//#endregion
//#region node_modules/echarts/lib/scale/break.js
var _impl = null;
function getScaleBreakHelper() {
	return _impl;
}
function simplyParseBreakOption(scale, opt) {
	var scaleBreakHelper = getScaleBreakHelper();
	var breakOption = opt.breakOption;
	var breakParsed = opt.breakParsed;
	if (!breakParsed && scaleBreakHelper) breakParsed = scaleBreakHelper.parseAxisBreakOption(breakOption, scale);
	return breakParsed;
}
function getBreaksUnsafe(scale) {
	var brk = scale.brk;
	return brk ? brk.breaks : [];
}
function hasBreaks(scale) {
	var brk = scale.brk;
	return brk ? brk.hasBreaks() : false;
}
//#endregion
//#region node_modules/echarts/lib/util/time.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var ONE_SECOND = 1e3;
var ONE_MINUTE = ONE_SECOND * 60;
var ONE_HOUR = ONE_MINUTE * 60;
var ONE_DAY = ONE_HOUR * 24;
var ONE_YEAR = ONE_DAY * 365;
var primaryTimeUnitFormatterMatchers = {
	year: /({yyyy}|{yy})/,
	month: /({MMMM}|{MMM}|{MM}|{M})/,
	day: /({dd}|{d})/,
	hour: /({HH}|{H}|{hh}|{h})/,
	minute: /({mm}|{m})/,
	second: /({ss}|{s})/,
	millisecond: /({SSS}|{S})/
};
var defaultFormatterSeed = {
	year: "{yyyy}",
	month: "{MMM}",
	day: "{d}",
	hour: "{HH}:{mm}",
	minute: "{HH}:{mm}",
	second: "{HH}:{mm}:{ss}",
	millisecond: "{HH}:{mm}:{ss} {SSS}"
};
var defaultFullFormatter = "{yyyy}-{MM}-{dd} {HH}:{mm}:{ss} {SSS}";
var fullDayFormatter = "{yyyy}-{MM}-{dd}";
var fullLeveledFormatter = {
	year: "{yyyy}",
	month: "{yyyy}-{MM}",
	day: fullDayFormatter,
	hour: fullDayFormatter + " " + defaultFormatterSeed.hour,
	minute: fullDayFormatter + " " + defaultFormatterSeed.minute,
	second: fullDayFormatter + " " + defaultFormatterSeed.second,
	millisecond: defaultFullFormatter
};
var primaryTimeUnits = [
	"year",
	"month",
	"day",
	"hour",
	"minute",
	"second",
	"millisecond"
];
var timeUnits = [
	"year",
	"half-year",
	"quarter",
	"month",
	"week",
	"half-week",
	"day",
	"half-day",
	"quarter-day",
	"hour",
	"minute",
	"second",
	"millisecond"
];
function parseTimeAxisLabelFormatter(formatter) {
	return !isString(formatter) && !isFunction(formatter) ? parseTimeAxisLabelFormatterDictionary(formatter) : formatter;
}
/**
* The final generated dictionary is like:
*  generated_dict = {
*      year: {
*          year: ['{yyyy}', ...<higher_levels_if_any>]
*      },
*      month: {
*          year: ['{yyyy} {MMM}', ...<higher_levels_if_any>],
*          month: ['{MMM}', ...<higher_levels_if_any>]
*      },
*      day: {
*          year: ['{yyyy} {MMM} {d}', ...<higher_levels_if_any>],
*          month: ['{MMM} {d}', ...<higher_levels_if_any>],
*          day: ['{d}', ...<higher_levels_if_any>]
*      },
*      ...
*  }
*
* In echarts option, users can specify the entire dictionary or typically just:
*  {formatter: {
*      year: '{yyyy}', // Or an array of leveled templates: `['{yyyy}', '{bold1|{yyyy}}', ...]`,
*                      // corresponding to `[level0, level1, level2, ...]`.
*      month: '{MMM}',
*      day: '{d}',
*      hour: '{HH}:{mm}',
*      second: '{HH}:{mm}',
*      ...
*  }}
*  If any time unit is not specified in echarts option, the default template is used,
*  such as `['{yyyy}', {primary|{yyyy}']`.
*
* The `tick.level` is only used to read string from each array, meaning the style type.
*
* Let `lowerUnit = getUnitFromValue(tick.value)`.
* The non-break axis ticks only use `generated_dict[lowerUnit][lowerUnit][level]`.
* The break axis ticks may use `generated_dict[lowerUnit][upperUnit][level]`, because:
*  Consider the case: the non-break ticks are `16th, 23th, Feb, 7th, ...`, where `Feb` is in the break
*  range and pruned by breaks, and the break ends might be in lower time unit than day. e.g., break start
*  is `Jan 25th 18:00`(in unit `hour`) and break end is `Feb 6th 18:30` (in unit `minute`). Thus the break
*  label prefers `Jan 25th 18:00` and `Feb 6th 18:30` rather than only `18:00` and `18:30`, otherwise it
*  causes misleading.
*  In this case, the tick of the break start and end will both be:
*      `{level: 1, lowerTimeUnit: 'minute', upperTimeUnit: 'month'}`
*  And get the final template by `generated_dict[lowerTimeUnit][upperTimeUnit][level]`.
*  Note that the time unit can not be calculated directly by a single tick value, since the two breaks have
*  to be at the same time unit to avoid awkward appearance. i.e., `Jan 25th 18:00` is in the time unit "hour"
*  but we need it to be "minute", following `Feb 6th 18:30`.
*/
function parseTimeAxisLabelFormatterDictionary(dictOption) {
	dictOption = dictOption || {};
	var dict = {};
	var canAddHighlight = true;
	each$1(primaryTimeUnits, function(lowestUnit) {
		canAddHighlight && (canAddHighlight = dictOption[lowestUnit] == null);
	});
	each$1(primaryTimeUnits, function(lowestUnit, lowestUnitIdx) {
		var upperDictOption = dictOption[lowestUnit];
		dict[lowestUnit] = {};
		var lowerTpl = null;
		for (var upperUnitIdx = lowestUnitIdx; upperUnitIdx >= 0; upperUnitIdx--) {
			var upperUnit = primaryTimeUnits[upperUnitIdx];
			var upperDictItemOption = isObject(upperDictOption) && !isArray(upperDictOption) ? upperDictOption[upperUnit] : upperDictOption;
			var tplArr = void 0;
			if (isArray(upperDictItemOption)) {
				tplArr = upperDictItemOption.slice();
				lowerTpl = tplArr[0] || "";
			} else if (isString(upperDictItemOption)) {
				lowerTpl = upperDictItemOption;
				tplArr = [lowerTpl];
			} else {
				if (lowerTpl == null) lowerTpl = defaultFormatterSeed[lowestUnit];
				else if (!primaryTimeUnitFormatterMatchers[upperUnit].test(lowerTpl)) lowerTpl = dict[upperUnit][upperUnit][0] + " " + lowerTpl;
				tplArr = [lowerTpl];
				if (canAddHighlight) tplArr[1] = "{primary|" + lowerTpl + "}";
			}
			dict[lowestUnit][upperUnit] = tplArr;
		}
	});
	return dict;
}
function pad(str, len) {
	str += "";
	return "0000".substr(0, len - str.length) + str;
}
function getPrimaryTimeUnit(timeUnit) {
	switch (timeUnit) {
		case "half-year":
		case "quarter": return "month";
		case "week":
		case "half-week": return "day";
		case "half-day":
		case "quarter-day": return "hour";
		default: return timeUnit;
	}
}
function isPrimaryTimeUnit(timeUnit) {
	return timeUnit === getPrimaryTimeUnit(timeUnit);
}
function getDefaultFormatPrecisionOfInterval(timeUnit) {
	switch (timeUnit) {
		case "year":
		case "month": return "day";
		case "millisecond": return "millisecond";
		default: return "second";
	}
}
function format(time, template, isUTC, lang) {
	var date = parseDate(time);
	var y = date[fullYearGetterName(isUTC)]();
	var M = date[monthGetterName(isUTC)]() + 1;
	var q = Math.floor((M - 1) / 3) + 1;
	var d = date[dateGetterName(isUTC)]();
	var e = date["get" + (isUTC ? "UTC" : "") + "Day"]();
	var H = date[hoursGetterName(isUTC)]();
	var h = (H - 1) % 12 + 1;
	var m = date[minutesGetterName(isUTC)]();
	var s = date[secondsGetterName(isUTC)]();
	var S = date[millisecondsGetterName(isUTC)]();
	var a = H >= 12 ? "pm" : "am";
	var A = a.toUpperCase();
	var timeModel = (lang instanceof Model ? lang : getLocaleModel(lang || SYSTEM_LANG) || getDefaultLocaleModel()).getModel("time");
	var month = timeModel.get("month");
	var monthAbbr = timeModel.get("monthAbbr");
	var dayOfWeek = timeModel.get("dayOfWeek");
	var dayOfWeekAbbr = timeModel.get("dayOfWeekAbbr");
	return (template || "").replace(/{a}/g, a + "").replace(/{A}/g, A + "").replace(/{yyyy}/g, y + "").replace(/{yy}/g, pad(y % 100 + "", 2)).replace(/{Q}/g, q + "").replace(/{MMMM}/g, month[M - 1]).replace(/{MMM}/g, monthAbbr[M - 1]).replace(/{MM}/g, pad(M, 2)).replace(/{M}/g, M + "").replace(/{dd}/g, pad(d, 2)).replace(/{d}/g, d + "").replace(/{eeee}/g, dayOfWeek[e]).replace(/{ee}/g, dayOfWeekAbbr[e]).replace(/{e}/g, e + "").replace(/{HH}/g, pad(H, 2)).replace(/{H}/g, H + "").replace(/{hh}/g, pad(h + "", 2)).replace(/{h}/g, h + "").replace(/{mm}/g, pad(m, 2)).replace(/{m}/g, m + "").replace(/{ss}/g, pad(s, 2)).replace(/{s}/g, s + "").replace(/{SSS}/g, pad(S, 3)).replace(/{S}/g, S + "");
}
function leveledFormat(tick, idx, formatter, lang, isUTC) {
	var template = null;
	if (isString(formatter)) template = formatter;
	else if (isFunction(formatter)) {
		var extra = {
			time: tick.time,
			level: tick.time ? tick.time.level : 0
		};
		var scaleBreakHelper = getScaleBreakHelper();
		if (scaleBreakHelper) scaleBreakHelper.makeAxisLabelFormatterParamBreak(extra, tick["break"]);
		template = formatter(tick.value, idx, extra);
	} else {
		var tickTime = tick.time;
		if (tickTime) {
			var leveledTplArr = formatter[tickTime.lowerTimeUnit][tickTime.upperTimeUnit];
			template = leveledTplArr[Math.min(tickTime.level, leveledTplArr.length - 1)] || "";
		} else {
			var unit = getUnitFromValue(tick.value, isUTC);
			template = formatter[unit][unit][0];
		}
	}
	return format(new Date(tick.value), template, isUTC, lang);
}
function getUnitFromValue(value, isUTC) {
	var date = parseDate(value);
	var M = date[monthGetterName(isUTC)]() + 1;
	var d = date[dateGetterName(isUTC)]();
	var h = date[hoursGetterName(isUTC)]();
	var m = date[minutesGetterName(isUTC)]();
	var s = date[secondsGetterName(isUTC)]();
	var isSecond = date[millisecondsGetterName(isUTC)]() === 0;
	var isMinute = isSecond && s === 0;
	var isHour = isMinute && m === 0;
	var isDay = isHour && h === 0;
	var isMonth = isDay && d === 1;
	if (isMonth && M === 1) return "year";
	else if (isMonth) return "month";
	else if (isDay) return "day";
	else if (isHour) return "hour";
	else if (isMinute) return "minute";
	else if (isSecond) return "second";
	else return "millisecond";
}
/**
* e.g.,
* If timeUnit is 'year', return the Jan 1st 00:00:00 000 of that year.
* If timeUnit is 'day', return the 00:00:00 000 of that day.
*
* @return The input date.
*/
function roundTime(date, timeUnit, isUTC) {
	switch (timeUnit) {
		case "year": date[monthSetterName(isUTC)](0);
		case "month": date[dateSetterName(isUTC)](1);
		case "day": date[hoursSetterName(isUTC)](0);
		case "hour": date[minutesSetterName(isUTC)](0);
		case "minute": date[secondsSetterName(isUTC)](0);
		case "second": date[millisecondsSetterName(isUTC)](0);
	}
	return date;
}
function fullYearGetterName(isUTC) {
	return isUTC ? "getUTCFullYear" : "getFullYear";
}
function monthGetterName(isUTC) {
	return isUTC ? "getUTCMonth" : "getMonth";
}
function dateGetterName(isUTC) {
	return isUTC ? "getUTCDate" : "getDate";
}
function hoursGetterName(isUTC) {
	return isUTC ? "getUTCHours" : "getHours";
}
function minutesGetterName(isUTC) {
	return isUTC ? "getUTCMinutes" : "getMinutes";
}
function secondsGetterName(isUTC) {
	return isUTC ? "getUTCSeconds" : "getSeconds";
}
function millisecondsGetterName(isUTC) {
	return isUTC ? "getUTCMilliseconds" : "getMilliseconds";
}
function fullYearSetterName(isUTC) {
	return isUTC ? "setUTCFullYear" : "setFullYear";
}
function monthSetterName(isUTC) {
	return isUTC ? "setUTCMonth" : "setMonth";
}
function dateSetterName(isUTC) {
	return isUTC ? "setUTCDate" : "setDate";
}
function hoursSetterName(isUTC) {
	return isUTC ? "setUTCHours" : "setHours";
}
function minutesSetterName(isUTC) {
	return isUTC ? "setUTCMinutes" : "setMinutes";
}
function secondsSetterName(isUTC) {
	return isUTC ? "setUTCSeconds" : "setSeconds";
}
function millisecondsSetterName(isUTC) {
	return isUTC ? "setUTCMilliseconds" : "setMilliseconds";
}
//#endregion
//#region node_modules/echarts/lib/util/format.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* Add a comma each three digit.
*/
function addCommas(x) {
	if (!isNumeric(x)) return isString(x) ? x : "-";
	var parts = (x + "").split(".");
	return parts[0].replace(/(\d{1,3})(?=(?:\d{3})+(?!\d))/g, "$1,") + (parts.length > 1 ? "." + parts[1] : "");
}
function toCamelCase(str, upperCaseFirst) {
	str = (str || "").toLowerCase().replace(/-(.)/g, function(match, group1) {
		return group1.toUpperCase();
	});
	if (upperCaseFirst && str) str = str.charAt(0).toUpperCase() + str.slice(1);
	return str;
}
var normalizeCssArray = normalizeCssArray$1;
/**
* Make value user readable for tooltip and label.
* "User readable":
*     Try to not print programmer-specific text like NaN, Infinity, null, undefined.
*     Avoid to display an empty string, which users can not recognize there is
*     a value and it might look like a bug.
*/
function makeValueReadable(value, valueType, useUTC) {
	var USER_READABLE_DEFUALT_TIME_PATTERN = "{yyyy}-{MM}-{dd} {HH}:{mm}:{ss}";
	function stringToUserReadable(str) {
		return str && trim(str) ? str : "-";
	}
	function isNumberUserReadable(num) {
		return isNullableNumberFinite(num);
	}
	var isTypeTime = valueType === "time";
	var isValueDate = value instanceof Date;
	if (isTypeTime || isValueDate) {
		var date = isTypeTime ? parseDate(value) : value;
		if (!isNaN(+date)) return format(date, USER_READABLE_DEFUALT_TIME_PATTERN, useUTC);
		else if (isValueDate) return "-";
	}
	if (valueType === "ordinal") return isStringSafe(value) ? stringToUserReadable(value) : isNumber(value) ? isNumberUserReadable(value) ? value + "" : "-" : "-";
	var numericResult = numericToNumber(value);
	return isNumberUserReadable(numericResult) ? addCommas(numericResult) : isStringSafe(value) ? stringToUserReadable(value) : typeof value === "boolean" ? value + "" : "-";
}
var TPL_VAR_ALIAS = [
	"a",
	"b",
	"c",
	"d",
	"e",
	"f",
	"g"
];
var wrapVar = function(varName, seriesIdx) {
	return "{" + varName + (seriesIdx == null ? "" : seriesIdx) + "}";
};
/**
* Template formatter
* @param {Array.<Object>|Object} paramsList
*/
function formatTpl(tpl, paramsList, encode) {
	if (!isArray(paramsList)) paramsList = [paramsList];
	var seriesLen = paramsList.length;
	if (!seriesLen) return "";
	var $vars = paramsList[0].$vars || [];
	for (var i = 0; i < $vars.length; i++) {
		var alias = TPL_VAR_ALIAS[i];
		tpl = tpl.replace(wrapVar(alias), wrapVar(alias, 0));
	}
	for (var seriesIdx = 0; seriesIdx < seriesLen; seriesIdx++) for (var k = 0; k < $vars.length; k++) {
		var val = paramsList[seriesIdx][$vars[k]];
		tpl = tpl.replace(wrapVar(TPL_VAR_ALIAS[k], seriesIdx), encode ? encodeHTML(val) : val);
	}
	return tpl;
}
function getTooltipMarker(inOpt, extraCssText) {
	var opt = isString(inOpt) ? {
		color: inOpt,
		extraCssText
	} : inOpt || {};
	var color = opt.color;
	var type = opt.type;
	extraCssText = opt.extraCssText;
	var renderMode = opt.renderMode || "html";
	if (!color) return "";
	if (renderMode === "html") return type === "subItem" ? "<span style=\"display:inline-block;vertical-align:middle;margin-right:8px;margin-left:3px;border-radius:4px;width:4px;height:4px;background-color:" + encodeHTML(color) + ";" + (extraCssText || "") + "\"></span>" : "<span style=\"display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:" + encodeHTML(color) + ";" + (extraCssText || "") + "\"></span>";
	else return {
		renderMode,
		content: "{" + (opt.markerId || "markerX") + "|}  ",
		style: type === "subItem" ? {
			width: 4,
			height: 4,
			borderRadius: 2,
			backgroundColor: color
		} : {
			width: 10,
			height: 10,
			borderRadius: 5,
			backgroundColor: color
		}
	};
}
/**
* @deprecated Use `time/format` instead.
* ISO Date format
* @param {string} tpl
* @param {number} value
* @param {boolean} [isUTC=false] Default in local time.
*           see `module:echarts/scale/Time`
*           and `module:echarts/util/number#parseDate`.
* @inner
*/
function formatTime(tpl, value, isUTC) {
	if (tpl === "week" || tpl === "month" || tpl === "quarter" || tpl === "half-year" || tpl === "year") tpl = "MM-dd\nyyyy";
	var date = parseDate(value);
	var getUTC = isUTC ? "getUTC" : "get";
	var y = date[getUTC + "FullYear"]();
	var M = date[getUTC + "Month"]() + 1;
	var d = date[getUTC + "Date"]();
	var h = date[getUTC + "Hours"]();
	var m = date[getUTC + "Minutes"]();
	var s = date[getUTC + "Seconds"]();
	var S = date[getUTC + "Milliseconds"]();
	tpl = tpl.replace("MM", pad(M, 2)).replace("M", M).replace("yyyy", y).replace("yy", pad(y % 100 + "", 2)).replace("dd", pad(d, 2)).replace("d", d).replace("hh", pad(h, 2)).replace("h", h).replace("mm", pad(m, 2)).replace("m", m).replace("ss", pad(s, 2)).replace("s", s).replace("SSS", pad(S, 3));
	return tpl;
}
/**
* Capital first
* @param {string} str
* @return {string}
*/
function capitalFirst(str) {
	return str ? str.charAt(0).toUpperCase() + str.substr(1) : str;
}
/**
* @return Never be null/undefined.
*/
function convertToColorString(color, defaultColor) {
	defaultColor = defaultColor || "transparent";
	return isString(color) ? color : isObject(color) ? color.colorStops && (color.colorStops[0] || {}).color || defaultColor : defaultColor;
}
//#endregion
//#region node_modules/echarts/lib/util/layout.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var each = each$1;
/**
* @public
*/
var LOCATION_PARAMS = [
	"left",
	"right",
	"top",
	"bottom",
	"width",
	"height"
];
/**
* @public
*/
var HV_NAMES = [[
	"width",
	"left",
	"right"
], [
	"height",
	"top",
	"bottom"
]];
function boxLayout(orient, group, gap, maxWidth, maxHeight) {
	var x = 0;
	var y = 0;
	if (maxWidth == null) maxWidth = Infinity;
	if (maxHeight == null) maxHeight = Infinity;
	var currentLineMaxSize = 0;
	group.eachChild(function(child, idx) {
		var rect = child.getBoundingRect();
		var nextChild = group.childAt(idx + 1);
		var nextChildRect = nextChild && nextChild.getBoundingRect();
		var nextX;
		var nextY;
		if (orient === "horizontal") {
			var moveX = rect.width + (nextChildRect ? -nextChildRect.x + rect.x : 0);
			nextX = x + moveX;
			if (nextX > maxWidth || child.newline) {
				x = 0;
				nextX = moveX;
				y += currentLineMaxSize + gap;
				currentLineMaxSize = rect.height;
			} else currentLineMaxSize = Math.max(currentLineMaxSize, rect.height);
		} else {
			var moveY = rect.height + (nextChildRect ? -nextChildRect.y + rect.y : 0);
			nextY = y + moveY;
			if (nextY > maxHeight || child.newline) {
				x += currentLineMaxSize + gap;
				y = 0;
				nextY = moveY;
				currentLineMaxSize = rect.width;
			} else currentLineMaxSize = Math.max(currentLineMaxSize, rect.width);
		}
		if (child.newline) return;
		child.x = x;
		child.y = y;
		child.markRedraw();
		orient === "horizontal" ? x = nextX + gap : y = nextY + gap;
	});
}
/**
* VBox or HBox layouting
* @param {string} orient
* @param {module:zrender/graphic/Group} group
* @param {number} gap
* @param {number} [width=Infinity]
* @param {number} [height=Infinity]
*/
var box = boxLayout;
curry(boxLayout, "vertical");
curry(boxLayout, "horizontal");
function getBoxLayoutParams(boxLayoutModel, ignoreParent) {
	return {
		left: boxLayoutModel.getShallow("left", ignoreParent),
		top: boxLayoutModel.getShallow("top", ignoreParent),
		right: boxLayoutModel.getShallow("right", ignoreParent),
		bottom: boxLayoutModel.getShallow("bottom", ignoreParent),
		width: boxLayoutModel.getShallow("width", ignoreParent),
		height: boxLayoutModel.getShallow("height", ignoreParent)
	};
}
function getViewRectAndCenterForCircleLayout(seriesModel, api) {
	var layoutRef = createBoxLayoutReference(seriesModel, api, { enableLayoutOnlyByCenter: true });
	var boxLayoutParams = seriesModel.getBoxLayoutParams();
	var viewRect;
	var center;
	if (layoutRef.type === BoxLayoutReferenceType.point) {
		center = layoutRef.refPoint;
		viewRect = getLayoutRect(boxLayoutParams, {
			width: api.getWidth(),
			height: api.getHeight()
		});
	} else {
		var centerOption = seriesModel.get("center");
		var centerOptionArr = isArray(centerOption) ? centerOption : [centerOption, centerOption];
		viewRect = getLayoutRect(boxLayoutParams, layoutRef.refContainer);
		center = layoutRef.boxCoordFrom === 2 ? layoutRef.refPoint : [parsePercent(centerOptionArr[0], viewRect.width) + viewRect.x, parsePercent(centerOptionArr[1], viewRect.height) + viewRect.y];
	}
	return {
		viewRect,
		center
	};
}
function getCircleLayout(seriesModel, api) {
	var _a = getViewRectAndCenterForCircleLayout(seriesModel, api), viewRect = _a.viewRect, center = _a.center;
	var radius = seriesModel.get("radius");
	if (!isArray(radius)) radius = [0, radius];
	var width = parsePercent(viewRect.width, api.getWidth());
	var height = parsePercent(viewRect.height, api.getHeight());
	var size = Math.min(width, height);
	var r0 = parsePercent(radius[0], size / 2);
	var r = parsePercent(radius[1], size / 2);
	return {
		cx: center[0],
		cy: center[1],
		r0,
		r,
		viewRect
	};
}
/**
* Parse position info.
*/
function getLayoutRect(positionInfo, containerRect, margin) {
	margin = normalizeCssArray(margin || 0);
	var containerWidth = containerRect.width;
	var containerHeight = containerRect.height;
	var left = parsePercent(positionInfo.left, containerWidth);
	var top = parsePercent(positionInfo.top, containerHeight);
	var right = parsePercent(positionInfo.right, containerWidth);
	var bottom = parsePercent(positionInfo.bottom, containerHeight);
	var width = parsePercent(positionInfo.width, containerWidth);
	var height = parsePercent(positionInfo.height, containerHeight);
	var verticalMargin = margin[2] + margin[0];
	var horizontalMargin = margin[1] + margin[3];
	var aspect = positionInfo.aspect;
	if (isNaN(width)) width = containerWidth - right - horizontalMargin - left;
	if (isNaN(height)) height = containerHeight - bottom - verticalMargin - top;
	if (aspect != null) {
		if (isNaN(width) && isNaN(height)) {
			if (aspect > containerWidth / containerHeight) width = containerWidth * .8;
			else height = containerHeight * .8;
		}
		if (isNaN(width)) width = aspect * height;
		if (isNaN(height)) height = width / aspect;
	}
	if (isNaN(left)) left = containerWidth - right - width - horizontalMargin;
	if (isNaN(top)) top = containerHeight - bottom - height - verticalMargin;
	switch (positionInfo.left || positionInfo.right) {
		case "center":
			left = containerWidth / 2 - width / 2 - margin[3];
			break;
		case "right": left = containerWidth - width - horizontalMargin;
	}
	switch (positionInfo.top || positionInfo.bottom) {
		case "middle":
		case "center":
			top = containerHeight / 2 - height / 2 - margin[0];
			break;
		case "bottom": top = containerHeight - height - verticalMargin;
	}
	left = left || 0;
	top = top || 0;
	if (isNaN(width)) width = containerWidth - horizontalMargin - left - (right || 0);
	if (isNaN(height)) height = containerHeight - verticalMargin - top - (bottom || 0);
	var rect = new BoundingRect((containerRect.x || 0) + left + margin[3], (containerRect.y || 0) + top + margin[0], width, height);
	rect.margin = margin;
	return rect;
}
var BoxLayoutReferenceType = {
	rect: 1,
	point: 2
};
/**
* Uniformly calculate layout reference (rect or center) based on either:
*  - viewport:
*      - Get `refContainer` as `{x: 0, y: 0, width: api.getWidth(), height: api.getHeight()}`
*  - coordinate system, which can serve in several ways:
*      - Use `dataToPoint` to get the `refPoint`, such as, in cartesian2d coord sys.
*      - Use `dataToLayout` to get the `refContainer`, such as, in matrix coord sys.
*/
function createBoxLayoutReference(model, api, opt) {
	var refContainer;
	var refPoint;
	var layoutRefType;
	var boxCoordSys = model.boxCoordinateSystem;
	var boxCoordFrom;
	if (boxCoordSys) {
		var _a = getCoordForCoordSysUsageKindBox(model), coord = _a.coord, from = _a.from;
		if (boxCoordSys.dataToLayout) {
			layoutRefType = BoxLayoutReferenceType.rect;
			boxCoordFrom = from;
			var result = boxCoordSys.dataToLayout(coord);
			refContainer = result.contentRect || result.rect;
		} else if (opt && opt.enableLayoutOnlyByCenter && boxCoordSys.dataToPoint) {
			layoutRefType = BoxLayoutReferenceType.point;
			boxCoordFrom = from;
			refPoint = boxCoordSys.dataToPoint(coord);
		}
	}
	if (layoutRefType == null) layoutRefType = BoxLayoutReferenceType.rect;
	if (layoutRefType === BoxLayoutReferenceType.rect) {
		if (!refContainer) refContainer = {
			x: 0,
			y: 0,
			width: api.getWidth(),
			height: api.getHeight()
		};
		refPoint = [refContainer.x + refContainer.width / 2, refContainer.y + refContainer.height / 2];
	}
	return {
		type: layoutRefType,
		refContainer,
		refPoint,
		boxCoordFrom
	};
}
function fetchLayoutMode(ins) {
	var layoutMode = ins.layoutMode || ins.constructor.layoutMode;
	return isObject(layoutMode) ? layoutMode : layoutMode ? { type: layoutMode } : null;
}
/**
* Consider Case:
* When default option has {left: 0, width: 100}, and we set {right: 0}
* through setOption or media query, using normal zrUtil.merge will cause
* {right: 0} does not take effect.
*
* @example
* ComponentModel.extend({
*     init: function () {
*         ...
*         let inputPositionParams = layout.getLayoutParams(option);
*         this.mergeOption(inputPositionParams);
*     },
*     mergeOption: function (newOption) {
*         newOption && zrUtil.merge(thisOption, newOption, true);
*         layout.mergeLayoutParam(thisOption, newOption);
*     }
* });
*
* @param targetOption
* @param newOption
* @param opt
*/
function mergeLayoutParam(targetOption, newOption, opt) {
	var ignoreSize = opt && opt.ignoreSize;
	!isArray(ignoreSize) && (ignoreSize = [ignoreSize, ignoreSize]);
	var hResult = merge(HV_NAMES[0], 0);
	var vResult = merge(HV_NAMES[1], 1);
	copy(HV_NAMES[0], targetOption, hResult);
	copy(HV_NAMES[1], targetOption, vResult);
	function merge(names, hvIdx) {
		var newParams = {};
		var newValueCount = 0;
		var merged = {};
		var mergedValueCount = 0;
		var enoughParamNumber = 2;
		each(names, function(name) {
			merged[name] = targetOption[name];
		});
		each(names, function(name) {
			hasOwn(newOption, name) && (newParams[name] = merged[name] = newOption[name]);
			hasValue(newParams, name) && newValueCount++;
			hasValue(merged, name) && mergedValueCount++;
		});
		if (ignoreSize[hvIdx]) {
			if (hasValue(newOption, names[1])) merged[names[2]] = null;
			else if (hasValue(newOption, names[2])) merged[names[1]] = null;
			return merged;
		}
		if (mergedValueCount === enoughParamNumber || !newValueCount) return merged;
		else if (newValueCount >= enoughParamNumber) return newParams;
		else {
			for (var i = 0; i < names.length; i++) {
				var name_1 = names[i];
				if (!hasOwn(newParams, name_1) && hasOwn(targetOption, name_1)) {
					newParams[name_1] = targetOption[name_1];
					break;
				}
			}
			return newParams;
		}
	}
	function hasValue(obj, name) {
		return obj[name] != null && obj[name] !== "auto";
	}
	function copy(names, target, source) {
		each(names, function(name) {
			target[name] = source[name];
		});
	}
}
/**
* Retrieve 'left', 'right', 'top', 'bottom', 'width', 'height' from object.
*/
function getLayoutParams(source) {
	return copyLayoutParams({}, source);
}
/**
* Retrieve 'left', 'right', 'top', 'bottom', 'width', 'height' from object.
* @param {Object} source
* @return {Object} Result contains those props.
*/
function copyLayoutParams(target, source) {
	source && target && each(LOCATION_PARAMS, function(name) {
		hasOwn(source, name) && (target[name] = source[name]);
	});
	return target;
}
//#endregion
//#region node_modules/echarts/lib/model/Component.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var inner$2 = makeInner();
var ComponentModel = function(_super) {
	__extends(ComponentModel, _super);
	function ComponentModel(option, parentModel, ecModel) {
		var _this = _super.call(this, option, parentModel, ecModel) || this;
		_this.uid = getUID("ec_cpt_model");
		return _this;
	}
	ComponentModel.prototype.init = function(option, parentModel, ecModel) {
		this.mergeDefaultAndTheme(option, ecModel);
	};
	ComponentModel.prototype.mergeDefaultAndTheme = function(option, ecModel) {
		var layoutMode = fetchLayoutMode(this);
		var inputPositionParams = layoutMode ? getLayoutParams(option) : {};
		var themeModel = ecModel.getTheme();
		merge(option, themeModel.get(this.mainType));
		merge(option, this.getDefaultOption());
		if (layoutMode) mergeLayoutParam(option, inputPositionParams, layoutMode);
	};
	ComponentModel.prototype.mergeOption = function(option, ecModel) {
		merge(this.option, option, true);
		var layoutMode = fetchLayoutMode(this);
		if (layoutMode) mergeLayoutParam(this.option, option, layoutMode);
	};
	/**
	* Called immediately after `init` or `mergeOption` of this instance called.
	*/
	ComponentModel.prototype.optionUpdated = function(newCptOption, isInit) {};
	/**
	* [How to declare defaultOption]:
	*
	* (A) If using class declaration in typescript (since echarts 5):
	* ```ts
	* import {ComponentOption} from '../model/option.js';
	* export interface XxxOption extends ComponentOption {
	*     aaa: number
	* }
	* export class XxxModel extends Component {
	*     static type = 'xxx';
	*     static defaultOption: XxxOption = {
	*         aaa: 123
	*     }
	* }
	* Component.registerClass(XxxModel);
	* ```
	* ```ts
	* import {inheritDefaultOption} from '../util/component.js';
	* import {XxxModel, XxxOption} from './XxxModel.js';
	* export interface XxxSubOption extends XxxOption {
	*     bbb: number
	* }
	* class XxxSubModel extends XxxModel {
	*     static defaultOption: XxxSubOption = inheritDefaultOption(XxxModel.defaultOption, {
	*         bbb: 456
	*     })
	*     fn() {
	*         let opt = this.getDefaultOption();
	*         // opt is {aaa: 123, bbb: 456}
	*     }
	* }
	* ```
	*
	* (B) If using class extend (previous approach in echarts 3 & 4):
	* ```js
	* let XxxComponent = Component.extend({
	*     defaultOption: {
	*         xx: 123
	*     }
	* })
	* ```
	* ```js
	* let XxxSubComponent = XxxComponent.extend({
	*     defaultOption: {
	*         yy: 456
	*     },
	*     fn: function () {
	*         let opt = this.getDefaultOption();
	*         // opt is {xx: 123, yy: 456}
	*     }
	* })
	* ```
	*/
	ComponentModel.prototype.getDefaultOption = function() {
		var ctor = this.constructor;
		if (!isExtendedClass(ctor)) return ctor.defaultOption;
		var fields = inner$2(this);
		if (!fields.defaultOption) {
			var optList = [];
			var clz = ctor;
			while (clz) {
				var opt = clz.prototype.defaultOption;
				opt && optList.push(opt);
				clz = clz.superClass;
			}
			var defaultOption = {};
			for (var i = optList.length - 1; i >= 0; i--) defaultOption = merge(defaultOption, optList[i], true);
			fields.defaultOption = defaultOption;
		}
		return fields.defaultOption;
	};
	/**
	* Notice: always force to input param `useDefault` in case that forget to consider it.
	* The same behavior as `modelUtil.parseFinder`.
	*
	* @param useDefault In many cases like series refer axis and axis refer grid,
	*        If axis index / axis id not specified, use the first target as default.
	*        In other cases like dataZoom refer axis, if not specified, measn no refer.
	*/
	ComponentModel.prototype.getReferringComponents = function(mainType, opt) {
		var indexKey = mainType + "Index";
		var idKey = mainType + "Id";
		return queryReferringComponents(this.ecModel, mainType, {
			index: this.get(indexKey, true),
			id: this.get(idKey, true)
		}, opt);
	};
	ComponentModel.prototype.getBoxLayoutParams = function() {
		return getBoxLayoutParams(this, false);
	};
	/**
	* If developers don't configure zlevel. We will assign zlevel to series based on the key, if provided.
	* For example, lines with trail effect is expected to be in an individual zlevel.
	*
	* @tutorial [GET_ZLEVEL_KEY_FOR_PROGRESSIVE]
	* Regarding "progressive rendering", zrender can automatically assign a dedicated "incremental layer"
	* for `el.incremental` per zlevel. But there is a trade-off:
	*  - If we do not provide different zlevelKey for different series here, all incremental elements from
	*    different series will be assigned to one incremental layer, which causes them to cover each other
	*    in an order depending on progressive steps.
	*      i.e., seriesA_el1 -covered_by-> seriesB_el1 -covered_by-> seriesC_el1 -> seriesA_el2 -> seriesB_el2 ...
	*    This order may causes an unexpected visual result: series with small data are likely to be completely
	*    covered by series with large data. (like in test/scatter-weibo.html)
	*  - If we assign a different zlevelKey to each series, the "covering issue" above can be resolved,
	*    but having one HTML Canvas per series may be excessively memory-consuming.
	*  Therefore, we only automatically assign zlevelKey on `ScatterSeries` and `LinesSeries` for backward
	*  compatibility, and not to other series. Users can explicitly assign zlevel if they encouter above
	*  "covering issue".
	*/
	ComponentModel.prototype.getZLevelKey = function() {
		return "";
	};
	ComponentModel.prototype.setZLevel = function(zlevel) {
		this.option.zlevel = zlevel;
	};
	ComponentModel.protoInitialize = function() {
		var proto = ComponentModel.prototype;
		proto.type = "component";
		proto.id = "";
		proto.name = "";
		proto.mainType = "";
		proto.subType = "";
		proto.componentIndex = 0;
	}();
	return ComponentModel;
}(Model);
mountExtend(ComponentModel, Model);
enableClassManagement(ComponentModel);
enableSubTypeDefaulter(ComponentModel);
enableTopologicalTravel(ComponentModel, getDependencies);
function getDependencies(componentType) {
	var deps = [];
	each$1(ComponentModel.getClassesByMainType(componentType), function(clz) {
		deps = deps.concat(clz.dependencies || clz.prototype.dependencies || []);
	});
	deps = map(deps, function(type) {
		return parseClassType(type).main;
	});
	if (componentType !== "dataset" && indexOf(deps, "dataset") <= 0) deps.unshift("dataset");
	return deps;
}
//#endregion
//#region node_modules/echarts/lib/model/mixin/palette.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var innerColor = makeInner();
makeInner();
var PaletteMixin = function() {
	function PaletteMixin() {}
	PaletteMixin.prototype.getColorFromPalette = function(name, scope, requestNum) {
		var defaultPalette = normalizeToArray(this.get("color", true));
		var layeredPalette = this.get("colorLayer", true);
		return getFromPalette(this, innerColor, defaultPalette, layeredPalette, name, scope, requestNum);
	};
	PaletteMixin.prototype.clearColorPalette = function() {
		clearPalette(this, innerColor);
	};
	return PaletteMixin;
}();
function getNearestPalette(palettes, requestColorNum) {
	var paletteNum = palettes.length;
	for (var i = 0; i < paletteNum; i++) if (palettes[i].length > requestColorNum) return palettes[i];
	return palettes[paletteNum - 1];
}
/**
* @param name MUST NOT be null/undefined. Otherwise call this function
*             twise with the same parameters will get different result.
* @param scope default this.
* @return Can be null/undefined
*/
function getFromPalette(that, inner, defaultPalette, layeredPalette, name, scope, requestNum) {
	scope = scope || that;
	var scopeFields = inner(scope);
	var paletteIdx = scopeFields.paletteIdx || 0;
	var paletteNameMap = scopeFields.paletteNameMap = scopeFields.paletteNameMap || {};
	if (paletteNameMap.hasOwnProperty(name)) return paletteNameMap[name];
	var palette = requestNum == null || !layeredPalette ? defaultPalette : getNearestPalette(layeredPalette, requestNum);
	palette = palette || defaultPalette;
	if (!palette || !palette.length) return;
	var pickedPaletteItem = palette[paletteIdx];
	if (name) paletteNameMap[name] = pickedPaletteItem;
	scopeFields.paletteIdx = (paletteIdx + 1) % palette.length;
	return pickedPaletteItem;
}
function clearPalette(that, inner) {
	inner(that).paletteIdx = 0;
	inner(that).paletteNameMap = {};
}
//#endregion
//#region node_modules/echarts/lib/model/mixin/dataFormat.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var DIMENSION_LABEL_REG = /\{@(.+?)\}/g;
var DataFormatMixin = function() {
	function DataFormatMixin() {}
	/**
	* Get params for formatter
	*/
	DataFormatMixin.prototype.getDataParams = function(dataIndex, dataType) {
		var data = this.getData(dataType);
		var rawValue = this.getRawValue(dataIndex, dataType);
		var rawDataIndex = data.getRawIndex(dataIndex);
		var name = data.getName(dataIndex);
		var itemOpt = data.getRawDataItem(dataIndex);
		var style = data.getItemVisual(dataIndex, "style");
		var color = style && style[data.getItemVisual(dataIndex, "drawType") || "fill"];
		var borderColor = style && style.stroke;
		var mainType = this.mainType;
		var isSeries = mainType === "series";
		var userOutput = data.userOutput && data.userOutput.get();
		return {
			componentType: mainType,
			componentSubType: this.subType,
			componentIndex: this.componentIndex,
			seriesType: isSeries ? this.subType : null,
			seriesIndex: this.seriesIndex,
			seriesId: isSeries ? this.id : null,
			seriesName: isSeries ? this.name : null,
			name,
			dataIndex: rawDataIndex,
			data: itemOpt,
			dataType,
			value: rawValue,
			color,
			borderColor,
			dimensionNames: userOutput ? userOutput.fullDimensions : null,
			encode: userOutput ? userOutput.encode : null,
			$vars: [
				"seriesName",
				"name",
				"value"
			]
		};
	};
	/**
	* Format label
	* @param dataIndex
	* @param status 'normal' by default
	* @param dataType
	* @param labelDimIndex Only used in some chart that
	*        use formatter in different dimensions, like radar.
	* @param formatter Formatter given outside.
	* @return return null/undefined if no formatter
	*/
	DataFormatMixin.prototype.getFormattedLabel = function(dataIndex, status, dataType, labelDimIndex, formatter, extendParams) {
		status = status || "normal";
		var data = this.getData(dataType);
		var params = this.getDataParams(dataIndex, dataType);
		if (extendParams) params.value = extendParams.interpolatedValue;
		if (labelDimIndex != null && isArray(params.value)) params.value = params.value[labelDimIndex];
		if (!formatter) formatter = data.getItemModel(dataIndex).get(status === "normal" ? ["label", "formatter"] : [
			status,
			"label",
			"formatter"
		]);
		if (isFunction(formatter)) {
			params.status = status;
			params.dimensionIndex = labelDimIndex;
			return formatter(params);
		} else if (isString(formatter)) return formatTpl(formatter, params).replace(DIMENSION_LABEL_REG, function(origin, dimStr) {
			var len = dimStr.length;
			var dimLoose = dimStr;
			if (dimLoose.charAt(0) === "[" && dimLoose.charAt(len - 1) === "]") dimLoose = +dimLoose.slice(1, len - 1);
			var val = retrieveRawValue(data, dataIndex, dimLoose);
			if (extendParams && isArray(extendParams.interpolatedValue)) {
				var dimIndex = data.getDimensionIndex(dimLoose);
				if (dimIndex >= 0) val = extendParams.interpolatedValue[dimIndex];
			}
			return val != null ? val + "" : "";
		});
	};
	/**
	* Get raw value in option
	*/
	DataFormatMixin.prototype.getRawValue = function(idx, dataType) {
		return retrieveRawValue(this.getData(dataType), idx);
	};
	/**
	* Should be implemented.
	* @param {number} dataIndex
	* @param {boolean} [multipleSeries=false]
	* @param {string} [dataType]
	*/
	DataFormatMixin.prototype.formatTooltip = function(dataIndex, multipleSeries, dataType) {};
	return DataFormatMixin;
}();
/**
* For backward compat, normalize the return from `formatTooltip`.
*/
function normalizeTooltipFormatResult(result) {
	var markupText;
	var markupFragment;
	if (isObject(result)) {
		if (result.type) markupFragment = result;
	} else markupText = result;
	return {
		text: markupText,
		frag: markupFragment
	};
}
//#endregion
//#region node_modules/echarts/lib/core/task.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* @param {Object} define
* @return See the return of `createTask`.
*/
function createTask(define) {
	return new Task(define);
}
var Task = function() {
	function Task(define) {
		define = define || {};
		this._reset = define.reset;
		this._plan = define.plan;
		this._count = define.count;
		this._onDirty = define.onDirty;
		this._dirty = true;
	}
	/**
	* @param step Specified step.
	* @param skip Skip customer perform call.
	* @param modBy Sampling window size.
	* @param modDataCount Sampling count.
	* @return whether unfinished.
	*/
	Task.prototype.perform = function(performArgs) {
		var upTask = this._upstream;
		var skip = performArgs && performArgs.skip;
		if (this._dirty && upTask) {
			var context = this.context;
			context.data = context.outputData = upTask.context.outputData;
		}
		if (this.__pipeline) this.__pipeline.currentTask = this;
		var planResult;
		if (this._plan && !skip) planResult = this._plan(this.context);
		var lastModBy = normalizeModBy(this._modBy);
		var lastModDataCount = this._modDataCount || 0;
		var modBy = normalizeModBy(performArgs && performArgs.modBy);
		var modDataCount = performArgs && performArgs.modDataCount || 0;
		if (lastModBy !== modBy || lastModDataCount !== modDataCount) planResult = "reset";
		function normalizeModBy(val) {
			!(val >= 1) && (val = 1);
			return val;
		}
		var forceFirstProgress;
		if (this._dirty || planResult === "reset") {
			this._dirty = false;
			forceFirstProgress = this._doReset(skip);
		}
		this._modBy = modBy;
		this._modDataCount = modDataCount;
		var step = performArgs && performArgs.step;
		if (upTask) this._dueEnd = upTask._outputDueEnd;
		else this._dueEnd = this._count ? this._count(this.context) : Infinity;
		if (this._progress) {
			var start = this._dueIndex;
			var end = Math.min(step != null ? this._dueIndex + step : Infinity, this._dueEnd);
			if (!skip && (forceFirstProgress || start < end)) {
				var progress = this._progress;
				if (isArray(progress)) for (var i = 0; i < progress.length; i++) this._doProgress(progress[i], start, end, modBy, modDataCount);
				else this._doProgress(progress, start, end, modBy, modDataCount);
			}
			this._dueIndex = end;
			var outputDueEnd = this._settedOutputEnd != null ? this._settedOutputEnd : end;
			this._outputDueEnd = outputDueEnd;
		} else this._dueIndex = this._outputDueEnd = this._settedOutputEnd != null ? this._settedOutputEnd : this._dueEnd;
		return this.unfinished();
	};
	/**
	* @tutorial [EC_TASK_DIRTY]
	*  Task `dirty()` calls typically originate from a trigger of EC_FULL_UPDATE_CYCLE and
	*  EC_PARTIAL_UPDATE_CYCLE) (See comments in EC_CYCLE. Generally, task dirty propagates
	*  to downstream tasks.
	*  Task dirty leads to the `StageHandler['reset']` or `StageHandler['overallReset']` call,
	*  which discards the previous result and starts over the processing.
	*/
	Task.prototype.dirty = function() {
		this._dirty = true;
		this._onDirty && this._onDirty(this.context);
	};
	Task.prototype._doProgress = function(progress, start, end, modBy, modDataCount) {
		iterator.reset(start, end, modBy, modDataCount);
		this._callingProgress = progress;
		this._callingProgress({
			start,
			end,
			count: end - start,
			next: iterator.next
		}, this.context);
	};
	Task.prototype._doReset = function(skip) {
		this._dueIndex = this._outputDueEnd = this._dueEnd = 0;
		this._settedOutputEnd = null;
		var progress;
		var forceFirstProgress;
		if (!skip && this._reset) {
			progress = this._reset(this.context);
			if (progress && progress.progress) {
				forceFirstProgress = progress.forceFirstProgress;
				progress = progress.progress;
			}
			if (isArray(progress) && !progress.length) progress = null;
		}
		this._progress = progress;
		this._modBy = this._modDataCount = null;
		var downstream = this._downstream;
		downstream && downstream.dirty();
		return forceFirstProgress;
	};
	Task.prototype.unfinished = function() {
		return this._progress && this._dueIndex < this._dueEnd;
	};
	/**
	* @param downTask The downstream task.
	* @return The downstream task.
	*/
	Task.prototype.pipe = function(downTask) {
		if (this._downstream !== downTask || this._dirty) {
			this._downstream = downTask;
			downTask._upstream = this;
			downTask.dirty();
		}
	};
	Task.prototype.dispose = function() {
		if (this._disposed) return;
		this._upstream && (this._upstream._downstream = null);
		this._downstream && (this._downstream._upstream = null);
		this._dirty = false;
		this._disposed = true;
	};
	Task.prototype.getUpstream = function() {
		return this._upstream;
	};
	Task.prototype.getDownstream = function() {
		return this._downstream;
	};
	Task.prototype.setOutputEnd = function(end) {
		this._outputDueEnd = this._settedOutputEnd = end;
	};
	return Task;
}();
var iterator = function() {
	var end;
	var current;
	var modBy;
	var modDataCount;
	var winCount;
	var it = { reset: function(s, e, sStep, sCount) {
		current = s;
		end = e;
		modBy = sStep;
		modDataCount = sCount;
		winCount = Math.ceil(modDataCount / modBy);
		it.next = modBy > 1 && modDataCount > 0 ? modNext : sequentialNext;
	} };
	return it;
	function sequentialNext() {
		return current < end ? current++ : null;
	}
	function modNext() {
		var dataIndex = current % winCount * modBy + Math.ceil(current / winCount);
		var result = current >= end ? null : dataIndex < modDataCount ? dataIndex : current;
		current++;
		return result;
	}
}();
//#endregion
//#region node_modules/echarts/lib/data/helper/transform.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* TODO: disable writable.
* This structure will be exposed to users.
*/
var ExternalSource = function() {
	function ExternalSource() {}
	ExternalSource.prototype.getRawData = function() {
		throw new Error("not supported");
	};
	ExternalSource.prototype.getRawDataItem = function(dataIndex) {
		throw new Error("not supported");
	};
	ExternalSource.prototype.cloneRawData = function() {};
	/**
	* @return If dimension not found, return null/undefined.
	*/
	ExternalSource.prototype.getDimensionInfo = function(dim) {};
	/**
	* dimensions defined if and only if either:
	* (a) dataset.dimensions are declared.
	* (b) dataset data include dimensions definitions in data (detected or via specified `sourceHeader`).
	* If dimensions are defined, `dimensionInfoAll` is corresponding to
	* the defined dimensions.
	* Otherwise, `dimensionInfoAll` is determined by data columns.
	* @return Always return an array (even empty array).
	*/
	ExternalSource.prototype.cloneAllDimensionInfo = function() {};
	ExternalSource.prototype.count = function() {};
	/**
	* Only support by dimension index.
	* No need to support by dimension name in transform function,
	* because transform function is not case-specific, no need to use name literally.
	*/
	ExternalSource.prototype.retrieveValue = function(dataIndex, dimIndex) {};
	ExternalSource.prototype.retrieveValueFromItem = function(dataItem, dimIndex) {};
	ExternalSource.prototype.convertValue = function(rawVal, dimInfo) {
		return parseDataValue(rawVal, dimInfo);
	};
	return ExternalSource;
}();
function createExternalSource(internalSource, externalTransform) {
	var extSource = new ExternalSource();
	var data = internalSource.data;
	var sourceFormat = extSource.sourceFormat = internalSource.sourceFormat;
	var sourceHeaderCount = internalSource.startIndex;
	var errMsg = "";
	if (internalSource.seriesLayoutBy !== "column") throwError(errMsg);
	var dimensions = [];
	var dimsByName = {};
	var dimsDef = internalSource.dimensionsDefine;
	if (dimsDef) each$1(dimsDef, function(dimDef, idx) {
		var name = dimDef.name;
		var dimDefExt = {
			index: idx,
			name,
			displayName: dimDef.displayName
		};
		dimensions.push(dimDefExt);
		if (name != null) {
			var errMsg_1 = "";
			if (hasOwn(dimsByName, name)) throwError(errMsg_1);
			dimsByName[name] = dimDefExt;
		}
	});
	else for (var i = 0; i < internalSource.dimensionsDetectedCount || 0; i++) dimensions.push({ index: i });
	var rawItemGetter = getRawSourceItemGetter(sourceFormat, SERIES_LAYOUT_BY_COLUMN);
	if (externalTransform.__isBuiltIn) {
		extSource.getRawDataItem = function(dataIndex) {
			return rawItemGetter(data, sourceHeaderCount, dimensions, dataIndex);
		};
		extSource.getRawData = bind(getRawData, null, internalSource);
	}
	extSource.cloneRawData = bind(cloneRawData, null, internalSource);
	var rawCounter = getRawSourceDataCounter(sourceFormat, SERIES_LAYOUT_BY_COLUMN);
	extSource.count = bind(rawCounter, null, data, sourceHeaderCount, dimensions);
	var rawValueGetter = getRawSourceValueGetter(sourceFormat);
	extSource.retrieveValue = function(dataIndex, dimIndex) {
		return retrieveValueFromItem(rawItemGetter(data, sourceHeaderCount, dimensions, dataIndex), dimIndex);
	};
	var retrieveValueFromItem = extSource.retrieveValueFromItem = function(dataItem, dimIndex) {
		if (dataItem == null) return;
		var dimDef = dimensions[dimIndex];
		if (dimDef) return rawValueGetter(dataItem, dimIndex, dimDef.name);
	};
	extSource.getDimensionInfo = bind(getDimensionInfo, null, dimensions, dimsByName);
	extSource.cloneAllDimensionInfo = bind(cloneAllDimensionInfo, null, dimensions);
	return extSource;
}
function getRawData(upstream) {
	var sourceFormat = upstream.sourceFormat;
	if (!isSupportedSourceFormat(sourceFormat)) throwError("");
	return upstream.data;
}
function cloneRawData(upstream) {
	var sourceFormat = upstream.sourceFormat;
	var data = upstream.data;
	if (!isSupportedSourceFormat(sourceFormat)) throwError("");
	if (sourceFormat === "arrayRows") {
		var result = [];
		for (var i = 0, len = data.length; i < len; i++) result.push(data[i].slice());
		return result;
	} else if (sourceFormat === "objectRows") {
		var result = [];
		for (var i = 0, len = data.length; i < len; i++) result.push(extend({}, data[i]));
		return result;
	}
}
function getDimensionInfo(dimensions, dimsByName, dim) {
	if (dim == null) return;
	if (isNumber(dim) || !isNaN(dim) && !hasOwn(dimsByName, dim)) return dimensions[dim];
	else if (hasOwn(dimsByName, dim)) return dimsByName[dim];
}
function cloneAllDimensionInfo(dimensions) {
	return clone$1(dimensions);
}
var externalTransformMap = createHashMap();
function registerExternalTransform(externalTransform) {
	externalTransform = clone$1(externalTransform);
	var type = externalTransform.type;
	var errMsg = "";
	if (!type) throwError(errMsg);
	var typeParsed = type.split(":");
	if (typeParsed.length !== 2) throwError(errMsg);
	var isBuiltIn = false;
	if (typeParsed[0] === "echarts") {
		type = typeParsed[1];
		isBuiltIn = true;
	}
	externalTransform.__isBuiltIn = isBuiltIn;
	externalTransformMap.set(type, externalTransform);
}
function applyDataTransform(rawTransOption, sourceList, infoForPrint) {
	var pipedTransOption = normalizeToArray(rawTransOption);
	var pipeLen = pipedTransOption.length;
	var errMsg = "";
	if (!pipeLen) throwError(errMsg);
	for (var i = 0, len = pipeLen; i < len; i++) {
		var transOption = pipedTransOption[i];
		sourceList = applySingleDataTransform(transOption, sourceList, infoForPrint, pipeLen === 1 ? null : i);
		if (i !== len - 1) sourceList.length = Math.max(sourceList.length, 1);
	}
	return sourceList;
}
function applySingleDataTransform(transOption, upSourceList, infoForPrint, pipeIndex) {
	var errMsg = "";
	if (!upSourceList.length) throwError(errMsg);
	if (!isObject(transOption)) throwError(errMsg);
	var transType = transOption.type;
	var externalTransform = externalTransformMap.get(transType);
	if (!externalTransform) throwError(errMsg);
	var extUpSourceList = map(upSourceList, function(upSource) {
		return createExternalSource(upSource, externalTransform);
	});
	var resultList = normalizeToArray(externalTransform.transform({
		upstream: extUpSourceList[0],
		upstreamList: extUpSourceList,
		config: clone$1(transOption.config)
	}));
	return map(resultList, function(result, resultIndex) {
		var errMsg = "";
		if (!isObject(result)) throwError(errMsg);
		if (!result.data) throwError(errMsg);
		if (!isSupportedSourceFormat(detectSourceFormat(result.data))) throwError(errMsg);
		var resultMetaRawOption;
		var firstUpSource = upSourceList[0];
		/**
		* Intuitively, the end users known the content of the original `dataset.source`,
		* calucating the transform result in mind.
		* Suppose the original `dataset.source` is:
		* ```js
		* [
		*     ['product', '2012', '2013', '2014', '2015'],
		*     ['AAA', 41.1, 30.4, 65.1, 53.3],
		*     ['BBB', 86.5, 92.1, 85.7, 83.1],
		*     ['CCC', 24.1, 67.2, 79.5, 86.4]
		* ]
		* ```
		* The dimension info have to be detected from the source data.
		* Some of the transformers (like filter, sort) will follow the dimension info
		* of upstream, while others use new dimensions (like aggregate).
		* Transformer can output a field `dimensions` to define the its own output dimensions.
		* We also allow transformers to ignore the output `dimensions` field, and
		* inherit the upstream dimensions definition. It can reduce the burden of handling
		* dimensions in transformers.
		*
		* See also [DIMENSION_INHERIT_RULE] in `sourceManager.ts`.
		*/
		if (firstUpSource && resultIndex === 0 && !result.dimensions) {
			var startIndex = firstUpSource.startIndex;
			if (startIndex) result.data = firstUpSource.data.slice(0, startIndex).concat(result.data);
			resultMetaRawOption = {
				seriesLayoutBy: SERIES_LAYOUT_BY_COLUMN,
				sourceHeader: startIndex,
				dimensions: firstUpSource.metaRawOption.dimensions
			};
		} else resultMetaRawOption = {
			seriesLayoutBy: SERIES_LAYOUT_BY_COLUMN,
			sourceHeader: 0,
			dimensions: result.dimensions
		};
		return createSource(result.data, resultMetaRawOption, null);
	});
}
function isSupportedSourceFormat(sourceFormat) {
	return sourceFormat === "arrayRows" || sourceFormat === "objectRows";
}
//#endregion
//#region node_modules/echarts/lib/data/helper/sourceManager.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* [REQUIREMENT_MEMO]:
* (0) `metaRawOption` means `dimensions`/`sourceHeader`/`seriesLayoutBy` in raw option.
* (1) Keep support the feature: `metaRawOption` can be specified both on `series` and
* `root-dataset`. Them on `series` has higher priority.
* (2) Do not support to set `metaRawOption` on a `non-root-dataset`, because it might
* confuse users: whether those props indicate how to visit the upstream source or visit
* the transform result source, and some transforms has nothing to do with these props,
* and some transforms might have multiple upstream.
* (3) Transforms should specify `metaRawOption` in each output, just like they can be
* declared in `root-dataset`.
* (4) At present only support visit source in `SERIES_LAYOUT_BY_COLUMN` in transforms.
* That is for reducing complexity in transforms.
* PENDING: Whether to provide transposition transform?
*
* [IMPLEMENTAION_MEMO]:
* "sourceVisitConfig" are calculated from `metaRawOption` and `data`.
* They will not be calculated until `source` is about to be visited (to prevent from
* duplicate calcuation). `source` is visited only in series and input to transforms.
*
* [DIMENSION_INHERIT_RULE]:
* By default the dimensions are inherited from ancestors, unless a transform return
* a new dimensions definition.
* Consider the case:
* ```js
* dataset: [{
*     source: [ ['Product', 'Sales', 'Prise'], ['Cookies', 321, 44.21], ...]
* }, {
*     transform: { type: 'filter', ... }
* }]
* dataset: [{
*     dimension: ['Product', 'Sales', 'Prise'],
*     source: [ ['Cookies', 321, 44.21], ...]
* }, {
*     transform: { type: 'filter', ... }
* }]
* ```
* The two types of option should have the same behavior after transform.
*
*
* [SCENARIO]:
* (1) Provide source data directly:
* ```js
* series: {
*     encode: {...},
*     dimensions: [...]
*     seriesLayoutBy: 'row',
*     data: [[...]]
* }
* ```
* (2) Series refer to dataset.
* ```js
* series: [{
*     encode: {...}
*     // Ignore datasetIndex means `datasetIndex: 0`
*     // and the dimensions defination in dataset is used
* }, {
*     encode: {...},
*     seriesLayoutBy: 'column',
*     datasetIndex: 1
* }]
* ```
* (3) dataset transform
* ```js
* dataset: [{
*     source: [...]
* }, {
*     source: [...]
* }, {
*     // By default from 0.
*     transform: { type: 'filter', config: {...} }
* }, {
*     // Piped.
*     transform: [
*         { type: 'filter', config: {...} },
*         { type: 'sort', config: {...} }
*     ]
* }, {
*     id: 'regressionData',
*     fromDatasetIndex: 1,
*     // Third-party transform
*     transform: { type: 'ecStat:regression', config: {...} }
* }, {
*     // retrieve the extra result.
*     id: 'regressionFormula',
*     fromDatasetId: 'regressionData',
*     fromTransformResult: 1
* }]
* ```
*/
var SourceManager = function() {
	function SourceManager(sourceHost) {
		this._sourceList = [];
		this._storeList = [];
		this._upstreamSignList = [];
		this._versionSignBase = 0;
		this._dirty = true;
		this._sourceHost = sourceHost;
	}
	/**
	* Mark dirty.
	*/
	SourceManager.prototype.dirty = function() {
		this._setLocalSource([], []);
		this._storeList = [];
		this._dirty = true;
	};
	SourceManager.prototype._setLocalSource = function(sourceList, upstreamSignList) {
		this._sourceList = sourceList;
		this._upstreamSignList = upstreamSignList;
		this._versionSignBase++;
		if (this._versionSignBase > 9e10) this._versionSignBase = 0;
	};
	/**
	* For detecting whether the upstream source is dirty, so that
	* the local cached source (in `_sourceList`) should be discarded.
	*/
	SourceManager.prototype._getVersionSign = function() {
		return this._sourceHost.uid + "_" + this._versionSignBase;
	};
	/**
	* Always return a source instance. Otherwise throw error.
	*/
	SourceManager.prototype.prepareSource = function() {
		if (this._isDirty()) {
			this._createSource();
			this._dirty = false;
		}
	};
	SourceManager.prototype._createSource = function() {
		this._setLocalSource([], []);
		var sourceHost = this._sourceHost;
		var upSourceMgrList = this._getUpstreamSourceManagers();
		var hasUpstream = !!upSourceMgrList.length;
		var resultSourceList;
		var upstreamSignList;
		if (isSeries(sourceHost)) {
			var seriesModel = sourceHost;
			var data = void 0;
			var sourceFormat = void 0;
			var upSource = void 0;
			if (hasUpstream) {
				var upSourceMgr = upSourceMgrList[0];
				upSourceMgr.prepareSource();
				upSource = upSourceMgr.getSource();
				data = upSource.data;
				sourceFormat = upSource.sourceFormat;
				upstreamSignList = [upSourceMgr._getVersionSign()];
			} else {
				data = seriesModel.get("data", true);
				sourceFormat = isTypedArray(data) ? SOURCE_FORMAT_TYPED_ARRAY : SOURCE_FORMAT_ORIGINAL;
				upstreamSignList = [];
			}
			var newMetaRawOption = this._getSourceMetaRawOption() || {};
			var upMetaRawOption = upSource && upSource.metaRawOption || {};
			var seriesLayoutBy = retrieve2(newMetaRawOption.seriesLayoutBy, upMetaRawOption.seriesLayoutBy) || null;
			var sourceHeader = retrieve2(newMetaRawOption.sourceHeader, upMetaRawOption.sourceHeader);
			var dimensions = retrieve2(newMetaRawOption.dimensions, upMetaRawOption.dimensions);
			resultSourceList = seriesLayoutBy !== upMetaRawOption.seriesLayoutBy || !!sourceHeader !== !!upMetaRawOption.sourceHeader || dimensions ? [createSource(data, {
				seriesLayoutBy,
				sourceHeader,
				dimensions
			}, sourceFormat)] : [];
		} else {
			var datasetModel = sourceHost;
			if (hasUpstream) {
				var result = this._applyTransform(upSourceMgrList);
				resultSourceList = result.sourceList;
				upstreamSignList = result.upstreamSignList;
			} else {
				resultSourceList = [createSource(datasetModel.get("source", true), this._getSourceMetaRawOption(), null)];
				upstreamSignList = [];
			}
		}
		this._setLocalSource(resultSourceList, upstreamSignList);
	};
	SourceManager.prototype._applyTransform = function(upMgrList) {
		var datasetModel = this._sourceHost;
		var transformOption = datasetModel.get("transform", true);
		var fromTransformResult = datasetModel.get("fromTransformResult", true);
		if (fromTransformResult != null) {
			var errMsg = "";
			if (upMgrList.length !== 1) doThrow(errMsg);
		}
		var sourceList;
		var upSourceList = [];
		var upstreamSignList = [];
		each$1(upMgrList, function(upMgr) {
			upMgr.prepareSource();
			var upSource = upMgr.getSource(fromTransformResult || 0);
			var errMsg = "";
			if (fromTransformResult != null && !upSource) doThrow(errMsg);
			upSourceList.push(upSource);
			upstreamSignList.push(upMgr._getVersionSign());
		});
		if (transformOption) sourceList = applyDataTransform(transformOption, upSourceList, { datasetIndex: datasetModel.componentIndex });
		else if (fromTransformResult != null) sourceList = [cloneSourceShallow(upSourceList[0])];
		return {
			sourceList,
			upstreamSignList
		};
	};
	SourceManager.prototype._isDirty = function() {
		if (this._dirty) return true;
		var upSourceMgrList = this._getUpstreamSourceManagers();
		for (var i = 0; i < upSourceMgrList.length; i++) {
			var upSrcMgr = upSourceMgrList[i];
			if (upSrcMgr._isDirty() || this._upstreamSignList[i] !== upSrcMgr._getVersionSign()) return true;
		}
	};
	/**
	* @param sourceIndex By default 0, means "main source".
	*                    In most cases there is only one source.
	*/
	SourceManager.prototype.getSource = function(sourceIndex) {
		sourceIndex = sourceIndex || 0;
		var source = this._sourceList[sourceIndex];
		if (!source) {
			var upSourceMgrList = this._getUpstreamSourceManagers();
			return upSourceMgrList[0] && upSourceMgrList[0].getSource(sourceIndex);
		}
		return source;
	};
	/**
	*
	* Get a data store which can be shared across series.
	* Only available for series.
	*
	* @param seriesDimRequest Dimensions that are generated in series.
	*        Should have been sorted by `storeDimIndex` asc.
	*/
	SourceManager.prototype.getSharedDataStore = function(seriesDimRequest) {
		var schema = seriesDimRequest.makeStoreSchema();
		return this._innerGetDataStore(schema.dimensions, seriesDimRequest.source, schema.hash);
	};
	SourceManager.prototype._innerGetDataStore = function(storeDims, seriesSource, sourceReadKey) {
		var sourceIndex = 0;
		var storeList = this._storeList;
		var cachedStoreMap = storeList[sourceIndex];
		if (!cachedStoreMap) cachedStoreMap = storeList[sourceIndex] = {};
		var cachedStore = cachedStoreMap[sourceReadKey];
		if (!cachedStore) {
			var upSourceMgr = this._getUpstreamSourceManagers()[0];
			if (isSeries(this._sourceHost) && upSourceMgr) cachedStore = upSourceMgr._innerGetDataStore(storeDims, seriesSource, sourceReadKey);
			else {
				cachedStore = new DataStore();
				cachedStore.initData(new DefaultDataProvider(seriesSource, storeDims.length), storeDims);
			}
			cachedStoreMap[sourceReadKey] = cachedStore;
		}
		return cachedStore;
	};
	/**
	* PENDING: Is it fast enough?
	* If no upstream, return empty array.
	*/
	SourceManager.prototype._getUpstreamSourceManagers = function() {
		var sourceHost = this._sourceHost;
		if (isSeries(sourceHost)) {
			var datasetModel = querySeriesUpstreamDatasetModel(sourceHost);
			return !datasetModel ? [] : [datasetModel.getSourceManager()];
		} else return map(queryDatasetUpstreamDatasetModels(sourceHost), function(datasetModel) {
			return datasetModel.getSourceManager();
		});
	};
	SourceManager.prototype._getSourceMetaRawOption = function() {
		var sourceHost = this._sourceHost;
		var seriesLayoutBy;
		var sourceHeader;
		var dimensions;
		if (isSeries(sourceHost)) {
			seriesLayoutBy = sourceHost.get("seriesLayoutBy", true);
			sourceHeader = sourceHost.get("sourceHeader", true);
			dimensions = sourceHost.get("dimensions", true);
		} else if (!this._getUpstreamSourceManagers().length) {
			var model = sourceHost;
			seriesLayoutBy = model.get("seriesLayoutBy", true);
			sourceHeader = model.get("sourceHeader", true);
			dimensions = model.get("dimensions", true);
		}
		return {
			seriesLayoutBy,
			sourceHeader,
			dimensions
		};
	};
	return SourceManager;
}();
function isSeries(sourceHost) {
	return sourceHost.mainType === "series";
}
function doThrow(errMsg) {
	throw new Error(errMsg);
}
//#endregion
//#region node_modules/echarts/lib/visual/tokens.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var tokens = {
	color: {},
	darkColor: {},
	size: {}
};
var color = tokens.color = {
	theme: [
		"#5070dd",
		"#b6d634",
		"#505372",
		"#ff994d",
		"#0ca8df",
		"#ffd10a",
		"#fb628b",
		"#785db0",
		"#3fbe95"
	],
	neutral00: "#fff",
	neutral05: "#f4f7fd",
	neutral10: "#e8ebf0",
	neutral15: "#dbdee4",
	neutral20: "#cfd2d7",
	neutral25: "#c3c5cb",
	neutral30: "#b7b9be",
	neutral35: "#aaacb2",
	neutral40: "#9ea0a5",
	neutral45: "#929399",
	neutral50: "#86878c",
	neutral55: "#797b7f",
	neutral60: "#6d6e73",
	neutral65: "#616266",
	neutral70: "#54555a",
	neutral75: "#48494d",
	neutral80: "#3c3c41",
	neutral85: "#303034",
	neutral90: "#232328",
	neutral95: "#17171b",
	neutral99: "#000",
	accent05: "#eff1f9",
	accent10: "#e0e4f2",
	accent15: "#d0d6ec",
	accent20: "#c0c9e6",
	accent25: "#b1bbdf",
	accent30: "#a1aed9",
	accent35: "#91a0d3",
	accent40: "#8292cc",
	accent45: "#7285c6",
	accent50: "#6578ba",
	accent55: "#5c6da9",
	accent60: "#536298",
	accent65: "#4a5787",
	accent70: "#404c76",
	accent75: "#374165",
	accent80: "#2e3654",
	accent85: "#252b43",
	accent90: "#1b2032",
	accent95: "#121521",
	transparent: "rgba(0,0,0,0)",
	highlight: "rgba(255,231,130,0.8)"
};
extend(color, {
	primary: color.neutral80,
	secondary: color.neutral70,
	tertiary: color.neutral60,
	quaternary: color.neutral50,
	disabled: color.neutral20,
	border: color.neutral30,
	borderTint: color.neutral20,
	borderShade: color.neutral40,
	background: color.neutral05,
	backgroundTint: "rgba(234,237,245,0.5)",
	backgroundTransparent: "rgba(255,255,255,0)",
	backgroundShade: color.neutral10,
	shadow: "rgba(0,0,0,0.2)",
	shadowTint: "rgba(129,130,136,0.2)",
	axisLine: color.neutral70,
	axisLineTint: color.neutral40,
	axisTick: color.neutral70,
	axisTickMinor: color.neutral60,
	axisLabel: color.neutral70,
	axisSplitLine: color.neutral15,
	axisMinorSplitLine: color.neutral05
});
for (var key in color) if (color.hasOwnProperty(key)) {
	var hex = color[key];
	if (key === "theme") tokens.darkColor.theme = color.theme.slice();
	else if (key === "highlight") tokens.darkColor.highlight = "rgba(255,231,130,0.4)";
	else if (key.indexOf("accent") === 0) tokens.darkColor[key] = modifyHSL(hex, null, function(s) {
		return s * .5;
	}, function(l) {
		return Math.min(1, 1.3 - l);
	});
	else tokens.darkColor[key] = modifyHSL(hex, null, function(s) {
		return s * .9;
	}, function(l) {
		return 1 - Math.pow(l, 1.5);
	});
}
tokens.size = {
	xxs: 2,
	xs: 5,
	s: 10,
	m: 15,
	l: 20,
	xl: 30,
	xxl: 40,
	xxxl: 50
};
//#endregion
//#region node_modules/echarts/lib/component/tooltip/tooltipMarkup.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var TOOLTIP_LINE_HEIGHT_CSS = "line-height:1";
function getTooltipLineHeight(textStyle) {
	var lineHeight = textStyle.lineHeight;
	if (lineHeight == null) return TOOLTIP_LINE_HEIGHT_CSS;
	else return "line-height:" + encodeHTML(lineHeight + "") + "px";
}
function getTooltipTextStyle(textStyle, renderMode) {
	var nameFontColor = textStyle.color || tokens.color.tertiary;
	var nameFontSize = textStyle.fontSize || 12;
	var nameFontWeight = textStyle.fontWeight || "400";
	var valueFontColor = textStyle.color || tokens.color.secondary;
	var valueFontSize = textStyle.fontSize || 14;
	var valueFontWeight = textStyle.fontWeight || "900";
	if (renderMode === "html") return {
		nameStyle: "font-size:" + encodeHTML(nameFontSize + "") + "px;color:" + encodeHTML(nameFontColor) + ";font-weight:" + encodeHTML(nameFontWeight + ""),
		valueStyle: "font-size:" + encodeHTML(valueFontSize + "") + "px;color:" + encodeHTML(valueFontColor) + ";font-weight:" + encodeHTML(valueFontWeight + "")
	};
	else return {
		nameStyle: {
			fontSize: nameFontSize,
			fill: nameFontColor,
			fontWeight: nameFontWeight
		},
		valueStyle: {
			fontSize: valueFontSize,
			fill: valueFontColor,
			fontWeight: valueFontWeight
		}
	};
}
var HTML_GAPS = [
	0,
	10,
	20,
	30
];
var RICH_TEXT_GAPS = [
	"",
	"\n",
	"\n\n",
	"\n\n\n"
];
function createTooltipMarkup(type, option) {
	option.type = type;
	return option;
}
function isSectionFragment(frag) {
	return frag.type === "section";
}
function getBuilder(frag) {
	return isSectionFragment(frag) ? buildSection : buildNameValue;
}
function getBlockGapLevel(frag) {
	if (isSectionFragment(frag)) {
		var gapLevel_1 = 0;
		var subBlockLen = frag.blocks.length;
		var hasInnerGap_1 = subBlockLen > 1 || subBlockLen > 0 && !frag.noHeader;
		each$1(frag.blocks, function(subBlock) {
			var subGapLevel = getBlockGapLevel(subBlock);
			if (subGapLevel >= gapLevel_1) gapLevel_1 = subGapLevel + +(hasInnerGap_1 && (!subGapLevel || isSectionFragment(subBlock) && !subBlock.noHeader));
		});
		return gapLevel_1;
	}
	return 0;
}
function buildSection(ctx, fragment, topMarginForOuterGap, toolTipTextStyle) {
	var noHeader = fragment.noHeader;
	var gaps = getGap(getBlockGapLevel(fragment));
	var subMarkupTextList = [];
	var subBlocks = fragment.blocks || [];
	assert(!subBlocks || isArray(subBlocks));
	subBlocks = subBlocks || [];
	var orderMode = ctx.orderMode;
	if (fragment.sortBlocks && orderMode) {
		subBlocks = subBlocks.slice();
		var orderMap = {
			valueAsc: "asc",
			valueDesc: "desc"
		};
		if (hasOwn(orderMap, orderMode)) {
			var comparator_1 = new SortOrderComparator(orderMap[orderMode], null);
			subBlocks.sort(function(a, b) {
				return comparator_1.evaluate(a.sortParam, b.sortParam);
			});
		} else if (orderMode === "seriesDesc") subBlocks.reverse();
	}
	each$1(subBlocks, function(subBlock, idx) {
		var valueFormatter = fragment.valueFormatter;
		var subMarkupText = getBuilder(subBlock)(valueFormatter ? extend(extend({}, ctx), { valueFormatter }) : ctx, subBlock, idx > 0 ? gaps.html : 0, toolTipTextStyle);
		subMarkupText != null && subMarkupTextList.push(subMarkupText);
	});
	var subMarkupText = ctx.renderMode === "richText" ? subMarkupTextList.join(gaps.richText) : wrapBlockHTML(toolTipTextStyle, subMarkupTextList.join(""), noHeader ? topMarginForOuterGap : gaps.html);
	if (noHeader) return subMarkupText;
	var displayableHeader = makeValueReadable(fragment.header, "ordinal", ctx.useUTC);
	var nameStyle = getTooltipTextStyle(toolTipTextStyle, ctx.renderMode).nameStyle;
	var tooltipLineHeight = getTooltipLineHeight(toolTipTextStyle);
	if (ctx.renderMode === "richText") return wrapInlineNameRichText(ctx, displayableHeader, nameStyle) + gaps.richText + subMarkupText;
	else return wrapBlockHTML(toolTipTextStyle, "<div style=\"" + nameStyle + ";" + tooltipLineHeight + ";\">" + encodeHTML(displayableHeader) + "</div>" + subMarkupText, topMarginForOuterGap);
}
function buildNameValue(ctx, fragment, topMarginForOuterGap, toolTipTextStyle) {
	var renderMode = ctx.renderMode;
	var noName = fragment.noName;
	var noValue = fragment.noValue;
	var noMarker = !fragment.markerType;
	var name = fragment.name;
	var useUTC = ctx.useUTC;
	var valueFormatter = fragment.valueFormatter || ctx.valueFormatter || function(value) {
		value = isArray(value) ? value : [value];
		return map(value, function(val, idx) {
			return makeValueReadable(val, isArray(valueTypeOption) ? valueTypeOption[idx] : valueTypeOption, useUTC);
		});
	};
	if (noName && noValue) return;
	var markerStr = noMarker ? "" : ctx.markupStyleCreator.makeTooltipMarker(fragment.markerType, fragment.markerColor || tokens.color.secondary, renderMode);
	var readableName = noName ? "" : makeValueReadable(name, "ordinal", useUTC);
	var valueTypeOption = fragment.valueType;
	var readableValueList = noValue ? [] : valueFormatter(fragment.value, fragment.rawDataIndex);
	var valueAlignRight = !noMarker || !noName;
	var valueCloseToMarker = !noMarker && noName;
	var _a = getTooltipTextStyle(toolTipTextStyle, renderMode), nameStyle = _a.nameStyle, valueStyle = _a.valueStyle;
	return renderMode === "richText" ? (noMarker ? "" : markerStr) + (noName ? "" : wrapInlineNameRichText(ctx, readableName, nameStyle)) + (noValue ? "" : wrapInlineValueRichText(ctx, readableValueList, valueAlignRight, valueCloseToMarker, valueStyle)) : wrapBlockHTML(toolTipTextStyle, (noMarker ? "" : markerStr) + (noName ? "" : wrapInlineNameHTML(readableName, !noMarker, nameStyle)) + (noValue ? "" : wrapInlineValueHTML(readableValueList, valueAlignRight, valueCloseToMarker, valueStyle)), topMarginForOuterGap);
}
/**
* @return markupText. null/undefined means no content.
*/
function buildTooltipMarkup(fragment, markupStyleCreator, renderMode, orderMode, useUTC, toolTipTextStyle) {
	if (!fragment) return;
	return getBuilder(fragment)({
		useUTC,
		renderMode,
		orderMode,
		markupStyleCreator,
		valueFormatter: fragment.valueFormatter
	}, fragment, 0, toolTipTextStyle);
}
function getGap(gapLevel) {
	return {
		html: HTML_GAPS[gapLevel],
		richText: RICH_TEXT_GAPS[gapLevel]
	};
}
function wrapBlockHTML(textStyle, encodedContent, topGap) {
	var clearfix = "<div style=\"clear:both\"></div>";
	var marginCSS = "margin: " + topGap + "px 0 0";
	var tooltipLineHeight = getTooltipLineHeight(textStyle);
	return "<div style=\"" + marginCSS + ";" + tooltipLineHeight + ";\">" + encodedContent + clearfix + "</div>";
}
function wrapInlineNameHTML(name, leftHasMarker, style) {
	var marginCss = leftHasMarker ? "margin-left:2px" : "";
	return "<span style=\"" + style + ";" + marginCss + "\">" + encodeHTML(name) + "</span>";
}
function wrapInlineValueHTML(valueList, alignRight, valueCloseToMarker, style) {
	var alignCSS = alignRight ? "float:right;margin-left:" + (valueCloseToMarker ? "10px" : "20px") : "";
	valueList = isArray(valueList) ? valueList : [valueList];
	return "<span style=\"" + alignCSS + ";" + style + "\">" + map(valueList, function(value) {
		return encodeHTML(value);
	}).join("&nbsp;&nbsp;") + "</span>";
}
function wrapInlineNameRichText(ctx, name, style) {
	return ctx.markupStyleCreator.wrapRichTextStyle(name, style);
}
function wrapInlineValueRichText(ctx, values, alignRight, valueCloseToMarker, style) {
	var styles = [style];
	var paddingLeft = valueCloseToMarker ? 10 : 20;
	alignRight && styles.push({
		padding: [
			0,
			0,
			0,
			paddingLeft
		],
		align: "right"
	});
	return ctx.markupStyleCreator.wrapRichTextStyle(isArray(values) ? values.join("  ") : values, styles);
}
function retrieveVisualColorForTooltipMarker(series, dataIndex) {
	var color = series.getData().getItemVisual(dataIndex, "style")[series.visualDrawType];
	return convertToColorString(color);
}
function getPaddingFromTooltipModel(model, renderMode) {
	var padding = model.get("padding");
	return padding != null ? padding : renderMode === "richText" ? [8, 10] : 10;
}
/**
* The major feature is generate styles for `renderMode: 'richText'`.
* But it also serves `renderMode: 'html'` to provide
* "renderMode-independent" API.
*/
var TooltipMarkupStyleCreator = function() {
	function TooltipMarkupStyleCreator() {
		this.richTextStyles = {};
		this._nextStyleNameId = getRandomIdBase();
	}
	TooltipMarkupStyleCreator.prototype._generateStyleName = function() {
		return "__EC_aUTo_" + this._nextStyleNameId++;
	};
	TooltipMarkupStyleCreator.prototype.makeTooltipMarker = function(markerType, colorStr, renderMode) {
		var markerId = renderMode === "richText" ? this._generateStyleName() : null;
		var marker = getTooltipMarker({
			color: colorStr,
			type: markerType,
			renderMode,
			markerId
		});
		if (isString(marker)) return marker;
		else {
			this.richTextStyles[markerId] = marker.style;
			return marker.content;
		}
	};
	/**
	* @usage
	* ```ts
	* const styledText = markupStyleCreator.wrapRichTextStyle([
	*     // The styles will be auto merged.
	*     {
	*         fontSize: 12,
	*         color: 'blue'
	*     },
	*     {
	*         padding: 20
	*     }
	* ]);
	* ```
	*/
	TooltipMarkupStyleCreator.prototype.wrapRichTextStyle = function(text, styles) {
		var finalStl = {};
		if (isArray(styles)) each$1(styles, function(stl) {
			return extend(finalStl, stl);
		});
		else extend(finalStl, styles);
		var styleName = this._generateStyleName();
		this.richTextStyles[styleName] = finalStl;
		return "{" + styleName + "|" + text + "}";
	};
	return TooltipMarkupStyleCreator;
}();
//#endregion
//#region node_modules/echarts/lib/component/tooltip/seriesFormatTooltip.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function defaultSeriesFormatTooltip(opt) {
	var series = opt.series;
	var dataIndex = opt.dataIndex;
	var multipleSeries = opt.multipleSeries;
	var data = series.getData();
	var tooltipDims = data.mapDimensionsAll("defaultedTooltip");
	var tooltipDimLen = tooltipDims.length;
	var value = series.getRawValue(dataIndex);
	var isValueArr = isArray(value);
	var markerColor = retrieveVisualColorForTooltipMarker(series, dataIndex);
	var inlineValue;
	var inlineValueType;
	var subBlocks;
	var sortParam;
	if (tooltipDimLen > 1 || isValueArr && !tooltipDimLen) {
		var formatArrResult = formatTooltipArrayValue(value, series, dataIndex, tooltipDims, markerColor);
		inlineValue = formatArrResult.inlineValues;
		inlineValueType = formatArrResult.inlineValueTypes;
		subBlocks = formatArrResult.blocks;
		sortParam = formatArrResult.inlineValues[0];
	} else if (tooltipDimLen) {
		var dimInfo = data.getDimensionInfo(tooltipDims[0]);
		sortParam = inlineValue = retrieveRawValue(data, dataIndex, tooltipDims[0]);
		inlineValueType = dimInfo.type;
	} else sortParam = inlineValue = isValueArr ? value[0] : value;
	var seriesNameSpecified = isNameSpecified(series);
	var seriesName = seriesNameSpecified && series.name || "";
	var itemName = data.getName(dataIndex);
	var inlineName = multipleSeries ? seriesName : itemName;
	return createTooltipMarkup("section", {
		header: seriesName,
		noHeader: multipleSeries || !seriesNameSpecified,
		sortParam,
		blocks: [createTooltipMarkup("nameValue", {
			markerType: "item",
			markerColor,
			name: inlineName,
			noName: !trim(inlineName),
			value: inlineValue,
			valueType: inlineValueType,
			rawDataIndex: data.getRawIndex(dataIndex)
		})].concat(subBlocks || [])
	});
}
function formatTooltipArrayValue(value, series, dataIndex, tooltipDims, colorStr) {
	var data = series.getData();
	var isValueMultipleLine = reduce(value, function(isValueMultipleLine, val, idx) {
		var dimItem = data.getDimensionInfo(idx);
		return isValueMultipleLine = isValueMultipleLine || dimItem && dimItem.tooltip !== false && dimItem.displayName != null;
	}, false);
	var inlineValues = [];
	var inlineValueTypes = [];
	var blocks = [];
	tooltipDims.length ? each$1(tooltipDims, function(dim) {
		setEachItem(retrieveRawValue(data, dataIndex, dim), dim);
	}) : each$1(value, setEachItem);
	function setEachItem(val, dim) {
		var dimInfo = data.getDimensionInfo(dim);
		if (!dimInfo || dimInfo.otherDims.tooltip === false) return;
		if (isValueMultipleLine) blocks.push(createTooltipMarkup("nameValue", {
			markerType: "subItem",
			markerColor: colorStr,
			name: dimInfo.displayName,
			value: val,
			valueType: dimInfo.type
		}));
		else {
			inlineValues.push(val);
			inlineValueTypes.push(dimInfo.type);
		}
	}
	return {
		inlineValues,
		inlineValueTypes,
		blocks
	};
}
//#endregion
//#region node_modules/echarts/lib/model/Series.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var inner$1 = makeInner();
function getSelectionKey(data, dataIndex) {
	return data.getName(dataIndex) || data.getId(dataIndex);
}
var SeriesModel = function(_super) {
	__extends(SeriesModel, _super);
	function SeriesModel() {
		var _this = _super !== null && _super.apply(this, arguments) || this;
		_this._selectedDataIndicesMap = {};
		return _this;
	}
	SeriesModel.prototype.init = function(option, parentModel, ecModel) {
		this.seriesIndex = this.componentIndex;
		this.dataTask = createTask({
			count: dataTaskCount,
			reset: dataTaskReset
		});
		this.dataTask.context = { model: this };
		this.mergeDefaultAndTheme(option, ecModel);
		(inner$1(this).sourceManager = new SourceManager(this)).prepareSource();
		var data = this.getInitialData(option, ecModel);
		wrapData(data, this);
		this.dataTask.context.data = data;
		inner$1(this).dataBeforeProcessed = data;
		autoSeriesName(this);
		this._initSelectedMapFromData(data);
	};
	/**
	* Util for merge default and theme to option
	*/
	SeriesModel.prototype.mergeDefaultAndTheme = function(option, ecModel) {
		var layoutMode = fetchLayoutMode(this);
		var inputPositionParams = layoutMode ? getLayoutParams(option) : {};
		var themeSubType = this.subType;
		if (ComponentModel.hasClass(themeSubType)) themeSubType += "Series";
		merge(option, ecModel.getTheme().get(this.subType));
		merge(option, this.getDefaultOption());
		defaultEmphasis(option, "label", ["show"]);
		this.fillDataTextStyle(option.data);
		if (layoutMode) mergeLayoutParam(option, inputPositionParams, layoutMode);
	};
	SeriesModel.prototype.mergeOption = function(newSeriesOption, ecModel) {
		newSeriesOption = merge(this.option, newSeriesOption, true);
		this.fillDataTextStyle(newSeriesOption.data);
		var layoutMode = fetchLayoutMode(this);
		if (layoutMode) mergeLayoutParam(this.option, newSeriesOption, layoutMode);
		var sourceManager = inner$1(this).sourceManager;
		sourceManager.dirty();
		sourceManager.prepareSource();
		var data = this.getInitialData(newSeriesOption, ecModel);
		wrapData(data, this);
		this.dataTask.dirty();
		this.dataTask.context.data = data;
		inner$1(this).dataBeforeProcessed = data;
		autoSeriesName(this);
		this._initSelectedMapFromData(data);
	};
	SeriesModel.prototype.fillDataTextStyle = function(data) {
		if (data && !isTypedArray(data)) {
			var props = ["show"];
			for (var i = 0; i < data.length; i++) if (data[i] && data[i].label) defaultEmphasis(data[i], "label", props);
		}
	};
	/**
	* Init a data structure from data related option in series
	* Must be overridden.
	*/
	SeriesModel.prototype.getInitialData = function(option, ecModel) {};
	/**
	* Append data to list
	*/
	SeriesModel.prototype.appendData = function(params) {
		this.getRawData().appendData(params.data);
	};
	/**
	* Consider some method like `filter`, `map` need make new data,
	* We should make sure that `seriesModel.getData()` get correct
	* data in the stream procedure. So we fetch data from upstream
	* each time `task.perform` called.
	*/
	SeriesModel.prototype.getData = function(dataType) {
		var task = getCurrentTask(this);
		if (task) {
			var data = task.context.data;
			return dataType == null || !data.getLinkedData ? data : data.getLinkedData(dataType);
		} else return inner$1(this).data;
	};
	SeriesModel.prototype.getAllData = function() {
		var mainData = this.getData();
		return mainData && mainData.getLinkedDataAll ? mainData.getLinkedDataAll() : [{ data: mainData }];
	};
	SeriesModel.prototype.setData = function(data) {
		var task = getCurrentTask(this);
		if (task) {
			var context = task.context;
			context.outputData = data;
			if (task !== this.dataTask) context.data = data;
		}
		inner$1(this).data = data;
	};
	SeriesModel.prototype.getEncode = function() {
		var encode = this.get("encode", true);
		if (encode) return createHashMap(encode);
	};
	SeriesModel.prototype.getSourceManager = function() {
		return inner$1(this).sourceManager;
	};
	SeriesModel.prototype.getSource = function() {
		return this.getSourceManager().getSource();
	};
	/**
	* Get data before processed
	*/
	SeriesModel.prototype.getRawData = function() {
		return inner$1(this).dataBeforeProcessed;
	};
	SeriesModel.prototype.getColorBy = function() {
		return this.get("colorBy") || "series";
	};
	SeriesModel.prototype.isColorBySeries = function() {
		return this.getColorBy() === "series";
	};
	/**
	* Get base axis if has coordinate system and has axis.
	* By default use coordSys.getBaseAxis();
	* Can be overridden for some chart.
	* @return {type} description
	*/
	SeriesModel.prototype.getBaseAxis = function() {
		var coordSys = this.coordinateSystem;
		return coordSys && coordSys.getBaseAxis && coordSys.getBaseAxis();
	};
	/**
	* Retrieve the index of nearest value in the view coordinate.
	* Data position is compared with each axis's dataToCoord.
	*
	* @param axisDim axis dimension
	* @param dim data dimension
	* @param value
	* @param [maxDistance=Infinity] The maximum distance in view coordinate space
	* @return If and only if multiple indices has
	*         the same value, they are put to the result.
	*/
	SeriesModel.prototype.indicesOfNearest = function(axisDim, dim, value, maxDistance) {
		var data = this.getData();
		var coordSys = this.coordinateSystem;
		var axis = coordSys && coordSys.getAxis(axisDim);
		if (!coordSys || !axis) return [];
		var targetCoord = axis.dataToCoord(value);
		if (maxDistance == null) maxDistance = Infinity;
		var nearestIndices = [];
		var minDist = Infinity;
		var minDiff = -1;
		var nearestIndicesLen = 0;
		var dimIdx = data.getDimensionIndex(dim);
		var store = data.getStore();
		for (var idx = 0, len = store.count(); idx < len; idx++) {
			var dimValue = store.get(dimIdx, idx);
			var diff = targetCoord - axis.dataToCoord(dimValue);
			var dist = Math.abs(diff);
			if (dist <= maxDistance) {
				if (dist < minDist || dist === minDist && diff >= 0 && minDiff < 0) {
					minDist = dist;
					minDiff = diff;
					nearestIndicesLen = 0;
				}
				if (diff === minDiff) nearestIndices[nearestIndicesLen++] = idx;
			}
		}
		nearestIndices.length = nearestIndicesLen;
		return nearestIndices;
	};
	/**
	* Default tooltip formatter
	*
	* @param dataIndex
	* @param multipleSeries
	* @param dataType
	* @param renderMode valid values: 'html'(by default) and 'richText'.
	*        'html' is used for rendering tooltip in extra DOM form, and the result
	*        string is used as DOM HTML content.
	*        'richText' is used for rendering tooltip in rich text form, for those where
	*        DOM operation is not supported.
	* @return formatted tooltip with `html` and `markers`
	*        Notice: The override method can also return string
	*/
	SeriesModel.prototype.formatTooltip = function(dataIndex, multipleSeries, dataType) {
		return defaultSeriesFormatTooltip({
			series: this,
			dataIndex,
			multipleSeries
		});
	};
	SeriesModel.prototype.isAnimationEnabled = function() {
		var ecModel = this.ecModel;
		if (env.node && !(ecModel && ecModel.ssr)) return false;
		var animationEnabled = this.getShallow("animation");
		if (animationEnabled) {
			if (this.getData().count() > this.getShallow("animationThreshold")) animationEnabled = false;
		}
		return !!animationEnabled;
	};
	SeriesModel.prototype.restoreData = function() {
		this.dataTask.dirty();
	};
	SeriesModel.prototype.getColorFromPalette = function(name, scope, requestColorNum) {
		var ecModel = this.ecModel;
		var color = PaletteMixin.prototype.getColorFromPalette.call(this, name, scope, requestColorNum);
		if (!color) color = ecModel.getColorFromPalette(name, scope, requestColorNum);
		return color;
	};
	/**
	* Use `data.mapDimensionsAll(coordDim)` instead.
	* @deprecated
	*/
	SeriesModel.prototype.coordDimToDataDim = function(coordDim) {
		return this.getRawData().mapDimensionsAll(coordDim);
	};
	/**
	* Get progressive rendering count each step
	*/
	SeriesModel.prototype.getProgressive = function() {
		return this.get("progressive");
	};
	/**
	* Get progressive rendering count each step
	*/
	SeriesModel.prototype.getProgressiveThreshold = function() {
		return this.get("progressiveThreshold");
	};
	SeriesModel.prototype.select = function(innerDataIndices, dataType) {
		this._innerSelect(this.getData(dataType), innerDataIndices);
	};
	SeriesModel.prototype.unselect = function(innerDataIndices, dataType) {
		var selectedMap = this.option.selectedMap;
		if (!selectedMap) return;
		var selectedMode = this.option.selectedMode;
		var data = this.getData(dataType);
		if (selectedMode === "series" || selectedMap === "all") {
			this.option.selectedMap = {};
			this._selectedDataIndicesMap = {};
			return;
		}
		for (var i = 0; i < innerDataIndices.length; i++) {
			var dataIndex = innerDataIndices[i];
			var nameOrId = getSelectionKey(data, dataIndex);
			selectedMap[nameOrId] = false;
			this._selectedDataIndicesMap[nameOrId] = -1;
		}
	};
	SeriesModel.prototype.toggleSelect = function(innerDataIndices, dataType) {
		var tmpArr = [];
		for (var i = 0; i < innerDataIndices.length; i++) {
			tmpArr[0] = innerDataIndices[i];
			this.isSelected(innerDataIndices[i], dataType) ? this.unselect(tmpArr, dataType) : this.select(tmpArr, dataType);
		}
	};
	SeriesModel.prototype.getSelectedDataIndices = function() {
		if (this.option.selectedMap === "all") return [].slice.call(this.getData().getIndices());
		var selectedDataIndicesMap = this._selectedDataIndicesMap;
		var nameOrIds = keys(selectedDataIndicesMap);
		var dataIndices = [];
		for (var i = 0; i < nameOrIds.length; i++) {
			var dataIndex = selectedDataIndicesMap[nameOrIds[i]];
			if (dataIndex >= 0) dataIndices.push(dataIndex);
		}
		return dataIndices;
	};
	SeriesModel.prototype.isSelected = function(dataIndex, dataType) {
		var selectedMap = this.option.selectedMap;
		if (!selectedMap) return false;
		var data = this.getData(dataType);
		return (selectedMap === "all" || selectedMap[getSelectionKey(data, dataIndex)]) && !data.getItemModel(dataIndex).get(["select", "disabled"]);
	};
	SeriesModel.prototype.isUniversalTransitionEnabled = function() {
		if (this["__universalTransitionEnabled"]) return true;
		var universalTransitionOpt = this.option.universalTransition;
		if (!universalTransitionOpt) return false;
		if (universalTransitionOpt === true) return true;
		return universalTransitionOpt && universalTransitionOpt.enabled;
	};
	SeriesModel.prototype._innerSelect = function(data, innerDataIndices) {
		var _a, _b;
		var option = this.option;
		var selectedMode = option.selectedMode;
		var len = innerDataIndices.length;
		if (!selectedMode || !len) return;
		if (selectedMode === "series") option.selectedMap = "all";
		else if (selectedMode === "multiple") {
			if (!isObject(option.selectedMap)) option.selectedMap = {};
			var selectedMap = option.selectedMap;
			for (var i = 0; i < len; i++) {
				var dataIndex = innerDataIndices[i];
				var nameOrId = getSelectionKey(data, dataIndex);
				selectedMap[nameOrId] = true;
				this._selectedDataIndicesMap[nameOrId] = data.getRawIndex(dataIndex);
			}
		} else if (selectedMode === "single" || selectedMode === true) {
			var lastDataIndex = innerDataIndices[len - 1];
			var nameOrId = getSelectionKey(data, lastDataIndex);
			option.selectedMap = (_a = {}, _a[nameOrId] = true, _a);
			this._selectedDataIndicesMap = (_b = {}, _b[nameOrId] = data.getRawIndex(lastDataIndex), _b);
		}
	};
	SeriesModel.prototype._initSelectedMapFromData = function(data) {
		if (this.option.selectedMap) return;
		var dataIndices = [];
		if (data.hasItemOption) data.each(function(idx) {
			var rawItem = data.getRawDataItem(idx);
			if (rawItem && rawItem.selected) dataIndices.push(idx);
		});
		if (dataIndices.length > 0) this._innerSelect(data, dataIndices);
	};
	SeriesModel.registerClass = function(clz) {
		return ComponentModel.registerClass(clz);
	};
	SeriesModel.protoInitialize = function() {
		var proto = SeriesModel.prototype;
		proto.type = "series.__base__";
		proto.seriesIndex = 0;
		proto.ignoreStyleOnData = false;
		proto.hasSymbolVisual = false;
		proto.defaultSymbol = "circle";
		proto.visualStyleAccessPath = "itemStyle";
		proto.visualDrawType = "fill";
	}();
	return SeriesModel;
}(ComponentModel);
mixin(SeriesModel, DataFormatMixin);
mixin(SeriesModel, PaletteMixin);
mountExtend(SeriesModel, ComponentModel);
/**
* MUST be called after `prepareSource` called
* Here we need to make auto series, especially for auto legend. But we
* do not modify series.name in option to avoid side effects.
*/
function autoSeriesName(seriesModel) {
	var name = seriesModel.name;
	if (!isNameSpecified(seriesModel)) seriesModel.name = getSeriesAutoName(seriesModel) || name;
}
function getSeriesAutoName(seriesModel) {
	var data = seriesModel.getRawData();
	var dataDims = data.mapDimensionsAll("seriesName");
	var nameArr = [];
	each$1(dataDims, function(dataDim) {
		var dimInfo = data.getDimensionInfo(dataDim);
		dimInfo.displayName && nameArr.push(dimInfo.displayName);
	});
	return nameArr.join(" ");
}
function dataTaskCount(context) {
	return context.model.getRawData().count();
}
function dataTaskReset(context) {
	var seriesModel = context.model;
	seriesModel.setData(seriesModel.getRawData().cloneShallow());
	return dataTaskProgress;
}
function dataTaskProgress(param, context) {
	if (context.outputData && param.end > context.outputData.count()) context.model.getRawData().cloneShallow(context.outputData);
}
function wrapData(data, seriesModel) {
	each$1(concatArray(data.CHANGABLE_METHODS, data.DOWNSAMPLE_METHODS), function(methodName) {
		data.wrapMethod(methodName, curry(onDataChange, seriesModel));
	});
}
function onDataChange(seriesModel, newList) {
	var task = getCurrentTask(seriesModel);
	if (task) task.setOutputEnd((newList || this).count());
	return newList;
}
function getCurrentTask(seriesModel) {
	var scheduler = (seriesModel.ecModel || {}).scheduler;
	var pipeline = scheduler && scheduler.getPipeline(seriesModel.uid);
	if (pipeline) {
		var task = pipeline.currentTask;
		if (task) {
			var agentStubMap = task.agentStubMap;
			if (agentStubMap) task = agentStubMap.get(seriesModel.uid);
		}
		return task;
	}
}
//#endregion
//#region node_modules/echarts/lib/util/symbol.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* Triangle shape
* @inner
*/
var Triangle = Path.extend({
	type: "triangle",
	shape: {
		cx: 0,
		cy: 0,
		width: 0,
		height: 0
	},
	buildPath: function(path, shape) {
		var cx = shape.cx;
		var cy = shape.cy;
		var width = shape.width / 2;
		var height = shape.height / 2;
		path.moveTo(cx, cy - height);
		path.lineTo(cx + width, cy + height);
		path.lineTo(cx - width, cy + height);
		path.closePath();
	}
});
/**
* Map of path constructors
*/
var symbolCtors = {
	line: Line,
	rect: Rect,
	roundRect: Rect,
	square: Rect,
	circle: Circle,
	diamond: Path.extend({
		type: "diamond",
		shape: {
			cx: 0,
			cy: 0,
			width: 0,
			height: 0
		},
		buildPath: function(path, shape) {
			var cx = shape.cx;
			var cy = shape.cy;
			var width = shape.width / 2;
			var height = shape.height / 2;
			path.moveTo(cx, cy - height);
			path.lineTo(cx + width, cy);
			path.lineTo(cx, cy + height);
			path.lineTo(cx - width, cy);
			path.closePath();
		}
	}),
	pin: Path.extend({
		type: "pin",
		shape: {
			x: 0,
			y: 0,
			width: 0,
			height: 0
		},
		buildPath: function(path, shape) {
			var x = shape.x;
			var y = shape.y;
			var w = shape.width / 5 * 3;
			var h = Math.max(w, shape.height);
			var r = w / 2;
			var dy = r * r / (h - r);
			var cy = y - h + r + dy;
			var angle = Math.asin(dy / r);
			var dx = Math.cos(angle) * r;
			var tanX = Math.sin(angle);
			var tanY = Math.cos(angle);
			var cpLen = r * .6;
			var cpLen2 = r * .7;
			path.moveTo(x - dx, cy + dy);
			path.arc(x, cy, r, Math.PI - angle, Math.PI * 2 + angle);
			path.bezierCurveTo(x + dx - tanX * cpLen, cy + dy + tanY * cpLen, x, y - cpLen2, x, y);
			path.bezierCurveTo(x, y - cpLen2, x - dx + tanX * cpLen, cy + dy + tanY * cpLen, x - dx, cy + dy);
			path.closePath();
		}
	}),
	arrow: Path.extend({
		type: "arrow",
		shape: {
			x: 0,
			y: 0,
			width: 0,
			height: 0
		},
		buildPath: function(ctx, shape) {
			var height = shape.height;
			var width = shape.width;
			var x = shape.x;
			var y = shape.y;
			var dx = width / 3 * 2;
			ctx.moveTo(x, y);
			ctx.lineTo(x + dx, y + height);
			ctx.lineTo(x, y + height / 4 * 3);
			ctx.lineTo(x - dx, y + height);
			ctx.lineTo(x, y);
			ctx.closePath();
		}
	}),
	triangle: Triangle
};
var symbolShapeMakers = {
	line: function(x, y, w, h, shape) {
		shape.x1 = x;
		shape.y1 = y + h / 2;
		shape.x2 = x + w;
		shape.y2 = y + h / 2;
	},
	rect: function(x, y, w, h, shape) {
		shape.x = x;
		shape.y = y;
		shape.width = w;
		shape.height = h;
	},
	roundRect: function(x, y, w, h, shape) {
		shape.x = x;
		shape.y = y;
		shape.width = w;
		shape.height = h;
		shape.r = Math.min(w, h) / 4;
	},
	square: function(x, y, w, h, shape) {
		var size = Math.min(w, h);
		shape.x = x;
		shape.y = y;
		shape.width = size;
		shape.height = size;
	},
	circle: function(x, y, w, h, shape) {
		shape.cx = x + w / 2;
		shape.cy = y + h / 2;
		shape.r = Math.min(w, h) / 2;
	},
	diamond: function(x, y, w, h, shape) {
		shape.cx = x + w / 2;
		shape.cy = y + h / 2;
		shape.width = w;
		shape.height = h;
	},
	pin: function(x, y, w, h, shape) {
		shape.x = x + w / 2;
		shape.y = y + h / 2;
		shape.width = w;
		shape.height = h;
	},
	arrow: function(x, y, w, h, shape) {
		shape.x = x + w / 2;
		shape.y = y + h / 2;
		shape.width = w;
		shape.height = h;
	},
	triangle: function(x, y, w, h, shape) {
		shape.cx = x + w / 2;
		shape.cy = y + h / 2;
		shape.width = w;
		shape.height = h;
	}
};
var symbolBuildProxies = {};
each$1(symbolCtors, function(Ctor, name) {
	symbolBuildProxies[name] = new Ctor();
});
var SymbolClz = Path.extend({
	type: "symbol",
	shape: {
		symbolType: "",
		x: 0,
		y: 0,
		width: 0,
		height: 0
	},
	calculateTextPosition: function(out, config, rect) {
		var res = calculateTextPosition(out, config, rect);
		var shape = this.shape;
		if (shape && shape.symbolType === "pin" && config.position === "inside") res.y = rect.y + rect.height * .4;
		return res;
	},
	buildPath: function(ctx, shape, inBundle) {
		var symbolType = shape.symbolType;
		if (symbolType !== "none") {
			var proxySymbol = symbolBuildProxies[symbolType];
			if (!proxySymbol) {
				symbolType = "rect";
				proxySymbol = symbolBuildProxies[symbolType];
			}
			symbolShapeMakers[symbolType](shape.x, shape.y, shape.width, shape.height, proxySymbol.shape);
			proxySymbol.buildPath(ctx, proxySymbol.shape, inBundle);
		}
	}
});
function symbolPathSetColor(color, innerColor) {
	if (this.type !== "image") {
		var symbolStyle = this.style;
		if (this.__isEmptyBrush) {
			symbolStyle.stroke = color;
			symbolStyle.fill = innerColor || tokens.color.neutral00;
			symbolStyle.lineWidth = 2;
		} else if (this.shape.symbolType === "line") symbolStyle.stroke = color;
		else symbolStyle.fill = color;
		this.markRedraw();
	}
}
/**
* Create a symbol element with given symbol configuration: shape, x, y, width, height, color
*/
function createSymbol(symbolType, x, y, w, h, color, keepAspect) {
	var isEmpty = symbolType.indexOf("empty") === 0;
	if (isEmpty) symbolType = symbolType.substr(5, 1).toLowerCase() + symbolType.substr(6);
	var symbolPath;
	if (symbolType.indexOf("image://") === 0) symbolPath = makeImage(symbolType.slice(8), new BoundingRect(x, y, w, h), keepAspect ? "center" : "cover");
	else if (symbolType.indexOf("path://") === 0) symbolPath = makePath(symbolType.slice(7), {}, new BoundingRect(x, y, w, h), keepAspect ? "center" : "cover");
	else symbolPath = new SymbolClz({ shape: {
		symbolType,
		x,
		y,
		width: w,
		height: h
	} });
	symbolPath.__isEmptyBrush = isEmpty;
	symbolPath.setColor = symbolPathSetColor;
	if (color) symbolPath.setColor(color);
	return symbolPath;
}
function normalizeSymbolSize(symbolSize) {
	if (!isArray(symbolSize)) symbolSize = [+symbolSize, +symbolSize];
	return [symbolSize[0] || 0, symbolSize[1] || 0];
}
function normalizeSymbolOffset(symbolOffset, symbolSize) {
	if (symbolOffset == null) return;
	if (!isArray(symbolOffset)) symbolOffset = [symbolOffset, symbolOffset];
	return [parsePercent(symbolOffset[0], symbolSize[0]) || 0, parsePercent(retrieve2(symbolOffset[1], symbolOffset[0]), symbolSize[1]) || 0];
}
//#endregion
//#region node_modules/echarts/lib/chart/helper/createRenderPlanner.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* @return {string} If large mode changed, return string 'reset';
*/
function createRenderPlanner() {
	var inner = makeInner();
	return function(seriesModel) {
		var fields = inner(seriesModel);
		var pipelineContext = seriesModel.pipelineContext;
		var originalLarge = !!fields.large;
		var originalProgressive = !!fields.progressiveRender;
		var large = fields.large = !!(pipelineContext && pipelineContext.large);
		var progressive = fields.progressiveRender = !!(pipelineContext && pipelineContext.progressiveRender);
		return !!(originalLarge !== large || originalProgressive !== progressive) && "reset";
	};
}
//#endregion
//#region node_modules/echarts/lib/view/Chart.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var inner = makeInner();
var renderPlanner = createRenderPlanner();
var ChartView = function() {
	function ChartView() {
		this.group = new Group();
		this.uid = getUID("viewChart");
		this.renderTask = createTask({
			plan: renderTaskPlan,
			reset: renderTaskReset
		});
		this.renderTask.context = { view: this };
	}
	ChartView.prototype.init = function(ecModel, api) {};
	ChartView.prototype.render = function(seriesModel, ecModel, api, payload) {};
	/**
	* Highlight series or specified data item.
	*/
	ChartView.prototype.highlight = function(seriesModel, ecModel, api, payload) {
		var data = seriesModel.getData(payload && payload.dataType);
		if (!data) return;
		toggleHighlight(data, payload, "emphasis");
	};
	/**
	* Downplay series or specified data item.
	*/
	ChartView.prototype.downplay = function(seriesModel, ecModel, api, payload) {
		var data = seriesModel.getData(payload && payload.dataType);
		if (!data) return;
		toggleHighlight(data, payload, "normal");
	};
	/**
	* `remove` only occurs when series is filtered out, typically by legend.
	* And theirafter the view can only be rendered again via
	* `ChartView['render']` or `ChartView['incrementalPrepareRender']`.
	*/
	ChartView.prototype.remove = function(ecModel, api) {
		this.group.removeAll();
	};
	/**
	* Dispose self.
	*/
	ChartView.prototype.dispose = function(ecModel, api) {};
	ChartView.prototype.updateView = function(seriesModel, ecModel, api, payload) {
		this.render(seriesModel, ecModel, api, payload);
	};
	ChartView.prototype.updateVisual = function(seriesModel, ecModel, api, payload) {
		this.render(seriesModel, ecModel, api, payload);
	};
	/**
	* Traverse the new rendered elements.
	*
	* It will traverse the new added element in progressive rendering.
	* And traverse all in normal rendering.
	*/
	ChartView.prototype.eachRendered = function(cb) {
		traverseElements(this.group, cb);
	};
	ChartView.markUpdateMethod = function(payload, methodName) {
		inner(payload).updateMethod = methodName;
	};
	ChartView.protoInitialize = function() {
		var proto = ChartView.prototype;
		proto.type = "chart";
	}();
	return ChartView;
}();
/**
* Set state of single element
*/
function elSetState(el, state, highlightDigit) {
	if (el && isHighDownDispatcher(el)) (state === "emphasis" ? enterEmphasis : leaveEmphasis)(el, highlightDigit);
}
function toggleHighlight(data, payload, state) {
	var dataIndex = queryDataIndex(data, payload);
	var highlightDigit = payload && payload.highlightKey != null ? getHighlightDigit(payload.highlightKey) : null;
	if (dataIndex != null) each$1(normalizeToArray(dataIndex), function(dataIdx) {
		elSetState(data.getItemGraphicEl(dataIdx), state, highlightDigit);
	});
	else data.eachItemGraphicEl(function(el) {
		elSetState(el, state, highlightDigit);
	});
}
enableClassExtend(ChartView, ["dispose"]);
enableClassManagement(ChartView);
function renderTaskPlan(context) {
	return renderPlanner(context.model);
}
function renderTaskReset(context) {
	var seriesModel = context.model;
	var ecModel = context.ecModel;
	var api = context.api;
	var payload = context.payload;
	var progressiveRender = seriesModel.pipelineContext.progressiveRender;
	var view = context.view;
	var updateMethod = payload && inner(payload).updateMethod;
	var methodName = progressiveRender ? "incrementalPrepareRender" : updateMethod && view[updateMethod] ? updateMethod : "render";
	if (methodName !== "render") view[methodName](seriesModel, ecModel, api, payload);
	return progressMethodMap[methodName];
}
var progressMethodMap = {
	incrementalPrepareRender: { progress: function(params, context) {
		context.view.incrementalRender(params, context.model, context.ecModel, context.api, context.payload);
	} },
	render: {
		forceFirstProgress: true,
		progress: function(params, context) {
			context.view.render(context.model, context.ecModel, context.api, context.payload);
		}
	}
};
//#endregion
//#region node_modules/echarts/lib/scale/Scale.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var Scale = function() {
	function Scale() {}
	/**
	* When axis extent depends on data and no data exists,
	* axis ticks should not be drawn, which is named 'blank'.
	*
	* @final NEVER override!
	*/
	Scale.prototype.isBlank = function() {
		return this._isBlank;
	};
	/**
	* When axis extent depends on data and no data exists,
	* axis ticks should not be drawn, which is named 'blank'.
	*
	* @final NEVER override!
	*/
	Scale.prototype.setBlank = function(isBlank) {
		this._isBlank = isBlank;
	};
	return Scale;
}();
enableClassManagement(Scale);
//#endregion
//#region node_modules/echarts/lib/data/OrdinalMeta.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var uidBase = 0;
var OrdinalMeta = function() {
	/**
	* PENDING - Regarding forcibly converting to string:
	*  In the early days, the underlying hash map impl used JS plain object and converted the key to
	*  string; later in https://github.com/ecomfe/zrender/pull/966 it was changed to a JS Map (in supported
	*  platforms), which does not require string keys. But consider any input that `scale/Ordinal['parse']`
	*  is involved, a number input represents an `OrdinalNumber` (i.e., an index), and affect the query
	*  behavior:
	*    - If forcbily converting to string:
	*      pros: users can use numeric string (such as, '123') to query the raw data (123), tho it's probably
	*      still confusing.
	*      cons: NaN/null/undefined in data will be equals to 'NaN'/'null'/'undefined', if simply using
	*      `val + ''` to convert them, like currently `getName` does.
	*    - Otherwise:
	*      pros: see NaN/null/undefined case above.
	*      cons: users cannot query the raw data (123) any more.
	*  There are two inconsistent behaviors in the current impl:
	*    - Force conversion is applied on the case `xAxis{data: ['aaa', 'bbb', ...]}`,
	*      but no conversion applied to the case `xAxis{data: [{value: 'aaa'}, ...]}` and
	*      the case `dataset: {source: [['aaa', 123], ['bbb', 234], ...]}`.
	*    - behaves differently according to whether JS Map is supported (the polyfill is simply using JS
	*      plain object) (tho it seems rare platform that do not support it).
	*  Since there's no sufficient good solution to offset cost of the breaking change, we preserve the
	*  current behavior, until real issues is reported.
	*/
	function OrdinalMeta(opt) {
		this.categories = opt.categories || [];
		this._needCollect = opt.needCollect;
		this._deduplication = opt.deduplication;
		this.uid = ++uidBase;
		this._onCollect = opt.onCollect;
	}
	OrdinalMeta.createByAxisModel = function(axisModel) {
		var option = axisModel.option;
		var data = option.data;
		var categories = data && map(data, getName);
		return new OrdinalMeta({
			categories,
			needCollect: !categories,
			deduplication: option.dedplication !== false
		});
	};
	OrdinalMeta.prototype.getOrdinal = function(category) {
		return this._getOrCreateMap().get(category);
	};
	/**
	* @return The ordinal. If not found, return NaN.
	*/
	OrdinalMeta.prototype.parseAndCollect = function(category) {
		var index;
		var needCollect = this._needCollect;
		if (!isString(category) && !needCollect) return category;
		if (needCollect && !this._deduplication) {
			index = this.categories.length;
			this.categories[index] = category;
			this._onCollect && this._onCollect(category, index);
			return index;
		}
		var map = this._getOrCreateMap();
		index = map.get(category);
		if (index == null) {
			if (needCollect) {
				index = this.categories.length;
				this.categories[index] = category;
				map.set(category, index);
				this._onCollect && this._onCollect(category, index);
			} else index = NaN;
		}
		return index;
	};
	OrdinalMeta.prototype._getOrCreateMap = function() {
		return this._map || (this._map = createHashMap(this.categories));
	};
	return OrdinalMeta;
}();
function getName(obj) {
	if (isObject(obj) && obj.value != null) return obj.value;
	else return obj + "";
}
var SCALE_MAPPER_METHOD_NAMES = keys({
	needTransform: 1,
	normalize: 1,
	scale: 1,
	transformIn: 1,
	transformOut: 1,
	contain: 1,
	getExtent: 1,
	getExtentUnsafe: 1,
	setExtent: 1,
	setExtent2: 1,
	getFilter: 1,
	sanitize: 1,
	getDefaultStartValue: 1,
	freeze: 1
});
function initBreakOrLinearMapper(mapper, breakParsed, initialExtent) {
	var brk;
	mapper = mapper || {};
	var scaleBreakHelper = getScaleBreakHelper();
	if (scaleBreakHelper) {
		var brkMapper_1 = scaleBreakHelper.createBreakScaleMapper(breakParsed, initialExtent);
		if (brkMapper_1.hasBreaks()) {
			each$1(SCALE_MAPPER_METHOD_NAMES, function(methodName) {
				if (brkMapper_1[methodName]) mapper[methodName] = bind(brkMapper_1[methodName], brkMapper_1);
			});
			brk = brkMapper_1;
		}
	}
	if (brk == null) initLinearScaleMapper(mapper, initialExtent);
	return {
		brk,
		mapper
	};
}
function decorateScaleMapper(host, decoratedMapperMethods) {
	each$1(SCALE_MAPPER_METHOD_NAMES, function(methodName) {
		host[methodName] = decoratedMapperMethods[methodName];
	});
}
function enableScaleMapperFreeze(host, subMapper) {
	host.freeze = noop;
}
function getScaleExtentForTickUnsafe(mapper) {
	return mapper.getExtentUnsafe(0, 2);
}
function getScaleExtentForMappingUnsafe(mapper, depth) {
	return mapper.getExtentUnsafe(1, depth) || mapper.getExtentUnsafe(0, depth);
}
function getScaleLinearSpanForMapping(mapper) {
	var extent = getScaleExtentForMappingUnsafe(mapper, 3);
	return extent[1] - extent[0];
}
function getScaleLinearSpanEffective(mapper) {
	var extent = mapper.getExtentUnsafe(0, 3);
	return extent[1] - extent[0];
}
function initLinearScaleMapper(mapper, initialExtent) {
	var linearMapper = mapper || {};
	var extendList = [];
	linearMapper._extents = extendList;
	extendList[0] = initialExtent ? initialExtent.slice() : initExtentForUnion();
	extend(linearMapper, linearScaleMapperMethods);
	return linearMapper;
}
var linearScaleMapperMethods = {
	needTransform: function() {
		return false;
	},
	normalize: function(val) {
		var extent = this._extents[1] || this._extents[0];
		if (extent[1] === extent[0]) return .5;
		return (val - extent[0]) / (extent[1] - extent[0]);
	},
	scale: function(val) {
		var extent = this._extents[1] || this._extents[0];
		return val * (extent[1] - extent[0]) + extent[0];
	},
	transformIn: function(val) {
		return val;
	},
	transformOut: function(val) {
		return val;
	},
	contain: function(val) {
		var extent = getScaleExtentForMappingUnsafe(this, null);
		return val >= extent[0] && val <= extent[1];
	},
	getExtent: function() {
		return this._extents[0].slice();
	},
	getExtentUnsafe: function(kind) {
		return this._extents[kind];
	},
	setExtent: function(start, end) {
		writeExtent(this._extents, 0, start, end);
	},
	setExtent2: function(kind, start, end) {
		var extentList = this._extents;
		if (!extentList[kind]) extentList[kind] = extentList[0].slice();
		writeExtent(extentList, kind, start, end);
	},
	freeze: function() {}
};
function writeExtent(extentList, kind, start, end) {
	if (isValidBoundsForExtent(start, end)) {
		extentList[kind][0] = start;
		extentList[kind][1] = end;
	}
}
//#endregion
//#region node_modules/echarts/lib/scale/helper.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* See also method `nice` in `src/util/number.ts`.
*/
function isIntervalOrLogScale(scale) {
	return isIntervalScale(scale) || isLogScale(scale);
}
function isIntervalScale(scale) {
	return scale.type === "interval";
}
function isTimeScale(scale) {
	return scale.type === "time";
}
function isLogScale(scale) {
	return scale.type === "log";
}
function isOrdinalScale(scale) {
	return scale.type === "ordinal";
}
/**
* The input `niceInterval` should be generated
* from `nice` method in `src/util/number.ts`, or
* from `increaseInterval` itself.
*/
function increaseInterval(niceInterval) {
	var exponent = quantityExponent(niceInterval);
	var exp10 = mathPow(10, exponent);
	var f = mathRound(niceInterval / exp10);
	if (!f) f = 1;
	else if (f === 2) f = 3;
	else if (f === 3) f = 5;
	else f *= 2;
	return round(f * exp10, -exponent);
}
function getIntervalPrecision(niceInterval) {
	return getPrecision(niceInterval) + 2;
}
/**
* NOTE:
*  - If `val` is `NaN`, return `NaN`.
*  - If `val` is `0`, return `-Infinity`.
*  - If `val` is negative, return `NaN`.
*
* @see {DataStore#getDataExtent} It handles non-positive values for logarithm scale.
*/
function logScaleLogTick(val, base) {
	return mathLog(val) / mathLog(base);
}
/**
* Cumulative rounding errors cause the logarithm operation to become non-invertible by simply exponentiation.
*  - `Math.pow(10, integer)` itself has no rounding error. But,
*  - If `linearTickVal` is generated internally by `calcNiceTicks`, it may be still "not nice" (not an integer)
*    when it is `extent[i]`.
*  - If `linearTickVal` is generated outside (e.g., by `scaleCalcAlign`) and set by `setExtent`,
*    `logScaleLogTick` may already have introduced rounding errors even for "nice" values.
* But invertible is required when the original `extent[i]` need to be respected, or "nice" ticks need to be
* displayed instead of something like `5.999999999999999`, which is addressed in this function.
* See also `#4158`.
*
* [CAUTION]:
*  Monotonicity may be broken on extent ends - callers must make sure it does not matter.
*/
function logScalePowTick(linearTickVal, base, opt) {
	var lookup = opt && opt.lookup;
	if (lookup) {
		for (var i = 0; i < lookup.from.length; i++) if (linearTickVal === lookup.from[i]) return lookup.to[i];
	}
	return mathPow(base, linearTickVal);
}
/**
* For `IntervalScale`, convert `rawExtent` to:
*  - Be no non-finite number.
*  - Be `extent[0] < extent[1]`- no equal; otherwise, additional handling is required
*    in "nice" and "align" ticks.
*/
function intervalScaleEnsureValidExtent(rawExtent, fixMinMax, rawExtentResult) {
	var extent = rawExtent.slice();
	if (extent[0] === extent[1]) {
		var containShapeRequired = rawExtentResult && rawExtentResult.ctnShp;
		if (extent[0] !== 0) {
			var expandSize = mathAbs$2(extent[0]);
			if (!fixMinMax[1]) {
				extent[1] += expandSize / 2;
				extent[0] -= expandSize / 2;
			} else extent[0] -= expandSize / 2;
		} else if (containShapeRequired) {
			extent[0] = -1;
			extent[1] = 1;
		} else extent[1] = 1;
	}
	if (!isValidNumberForExtent(extent[0]) || !isValidNumberForExtent(extent[1])) {
		extent[0] = 0;
		extent[1] = 1;
	}
	if (extent[1] < extent[0]) extent.reverse();
	return extent;
}
function extentDiffers(extent1, extent2) {
	return [extent1[0] !== extent2[0], extent1[1] !== extent2[1]];
}
function ensureValidSplitNumber(rawSplitNumber, defaultSplitNumber) {
	rawSplitNumber = rawSplitNumber || defaultSplitNumber;
	return mathRound(mathMax$2(rawSplitNumber, 1));
}
/**
* NOTE: The result can have only one item, e.g., when `extent[0] === extent[1]`
* and `categoryInterval === 0`.
*/
function ordinalScaleCreateTicks(ordinalScale, categoryInterval, addItem) {
	var extent = getScaleExtentForTickUnsafe(ordinalScale);
	var startTick = extent[0];
	var tickCount = ordinalScale.count();
	var step = Math.max((categoryInterval || 0) + 1, 1);
	if (startTick !== 0 && step > 1 && tickCount / step > 2) startTick = Math.round(Math.ceil(startTick / step) * step);
	if (startTick !== extent[0]) addItemInternally(extent[0], true, true);
	var tickValue = startTick;
	for (; tickValue <= extent[1]; tickValue += step) addItemInternally(tickValue, false, tickValue === extent[0] || tickValue === extent[1]);
	if (tickValue - step !== extent[1]) addItemInternally(extent[1], true, true);
	function addItemInternally(tickValue, offInterval, isExtentBoundary) {
		addItem({
			value: tickValue,
			offInterval
		}, isExtentBoundary);
	}
}
//#endregion
//#region node_modules/echarts/lib/scale/Ordinal.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* Linear continuous scale
* http://en.wikipedia.org/wiki/Level_of_measurement
*/
var OrdinalScale = function(_super) {
	__extends(OrdinalScale, _super);
	function OrdinalScale(setting) {
		var _this = _super.call(this) || this;
		_this.type = "ordinal";
		_this.parse = OrdinalScale.parse;
		decorateScaleMapper(_this, OrdinalScale.decoratedMethods);
		var ordinalMeta = setting.ordinalMeta;
		if (!ordinalMeta) ordinalMeta = new OrdinalMeta({});
		if (isArray(ordinalMeta)) ordinalMeta = new OrdinalMeta({ categories: map(ordinalMeta, function(item) {
			return isObject(item) ? item.value : item;
		}) });
		_this._ordinalMeta = ordinalMeta;
		var res = initBreakOrLinearMapper(null, null, setting.extent || [0, ordinalMeta.categories.length - 1]);
		_this._mapper = res.mapper;
		enableScaleMapperFreeze(_this, res.mapper);
		return _this;
	}
	OrdinalScale.parse = function(val) {
		if (val == null) val = NaN;
		else if (isString(val)) {
			val = this._ordinalMeta.getOrdinal(val);
			if (val == null) val = NaN;
		} else val = mathRound(val);
		return val;
	};
	/**
	* PENDING: currently this method is not used.
	* `makeCategoryTicks` is effectively used.
	*/
	OrdinalScale.prototype.getTicks = function() {
		var ticks = [];
		ordinalScaleCreateTicks(this, 0, function(tick) {
			ticks.push(tick);
		});
		return ticks;
	};
	OrdinalScale.prototype.getMinorTicks = function(splitNumber) {};
	/**
	* @see `Ordinal['_ordinalNumbersByTick']`
	*/
	OrdinalScale.prototype.setSortInfo = function(info) {
		if (info == null) {
			this._ordinalNumbersByTick = this._ticksByOrdinalNumber = null;
			return;
		}
		var infoOrdinalNumbers = info.ordinalNumbers;
		var ordinalsByTick = this._ordinalNumbersByTick = [];
		var ticksByOrdinal = this._ticksByOrdinalNumber = [];
		var tickNum = 0;
		var allCategoryLen = this._ordinalMeta.categories.length;
		for (var len = mathMin$2(allCategoryLen, infoOrdinalNumbers.length); tickNum < len; ++tickNum) {
			var ordinalNumber = ordinalsByTick[tickNum] = infoOrdinalNumbers[tickNum];
			ticksByOrdinal[ordinalNumber] = tickNum;
		}
		var unusedOrdinal = 0;
		for (; tickNum < allCategoryLen; ++tickNum) {
			while (ticksByOrdinal[unusedOrdinal] != null) unusedOrdinal++;
			ordinalsByTick[tickNum] = unusedOrdinal;
			ticksByOrdinal[unusedOrdinal] = tickNum;
		}
	};
	OrdinalScale.prototype._getTickNumber = function(ordinal) {
		var ticksByOrdinalNumber = this._ticksByOrdinalNumber;
		return ticksByOrdinalNumber && ordinal >= 0 && ordinal < ticksByOrdinalNumber.length ? ticksByOrdinalNumber[ordinal] : ordinal;
	};
	/**
	* @usage
	* ```js
	* const ordinalNumber = ordinalScale.getRawOrdinalNumber(tick.value);
	* // case0
	* const rawOrdinalValue = axisModel.getCategories()[ordinalNumber];
	* // case1
	* const rawOrdinalValue = this._ordinalMeta.categories[ordinalNumber];
	* // case2
	* const coord = axis.dataToCoord(ordinalNumber);
	* ```
	*
	* value may be out of range, e.g., when axis max is larger than `ordinalMeta.categories.length`,
	* where ordinal numbers are used as tick value directly.
	*/
	OrdinalScale.prototype.getRawOrdinalNumber = function(tickValue) {
		var ordinalNumbersByTick = this._ordinalNumbersByTick;
		return ordinalNumbersByTick && tickValue >= 0 && tickValue < ordinalNumbersByTick.length ? ordinalNumbersByTick[tickValue] : tickValue;
	};
	/**
	* Get item on tick
	*/
	OrdinalScale.prototype.getLabel = function(tick) {
		if (!this.isBlank()) {
			var ordinalNumber = this.getRawOrdinalNumber(tick.value);
			var category = this._ordinalMeta.categories[ordinalNumber];
			return category == null ? "" : category + "";
		}
	};
	/**
	* NOTICE: This is different from `.getOrdinalMeta().length` when extent
	* is specified by `xxxAxis.min/max` or by `dataZoom`.
	*/
	OrdinalScale.prototype.count = function() {
		var extent = getScaleExtentForTickUnsafe(this._mapper);
		return extent[1] - extent[0] + 1;
	};
	OrdinalScale.prototype.getOrdinalMeta = function() {
		return this._ordinalMeta;
	};
	OrdinalScale.type = "ordinal";
	OrdinalScale.decoratedMethods = {
		needTransform: function() {
			return this._mapper.needTransform();
		},
		contain: function(val) {
			return this._mapper.contain(this._getTickNumber(val)) && val >= 0 && val < this._ordinalMeta.categories.length;
		},
		normalize: function(val) {
			return this._mapper.normalize(this._getTickNumber(val));
		},
		scale: function(val) {
			return this.getRawOrdinalNumber(mathRound(this._mapper.scale(val)));
		},
		transformIn: function(val, opt) {
			return this._mapper.transformIn(this._getTickNumber(val), opt);
		},
		transformOut: function(val, opt) {
			return this.getRawOrdinalNumber(this._mapper.transformOut(val, opt));
		},
		getExtent: function() {
			return this._mapper.getExtent();
		},
		getExtentUnsafe: function(kind, depth) {
			return this._mapper.getExtentUnsafe(kind, depth);
		},
		/**
		* NOTICE: OrdinalScale extent should always originates from
		* `[0, ordinalMeta.categories.length - 1]`, regardless of min/max of `series.data`.
		* But settings like `xxxAxis.min/max` can still modify the extent.
		* It is handled by constructor of `ScaleRawExtentInfo`.
		*/
		setExtent: function(start, end) {
			return this._mapper.setExtent(start, end);
		},
		setExtent2: function(kind, start, end) {
			return this._mapper.setExtent2(kind, start, end);
		}
	};
	return OrdinalScale;
}(Scale);
Scale.registerClass(OrdinalScale);
//#endregion
//#region node_modules/echarts/lib/scale/minorTicks.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function getMinorTicks(scale, splitNumber, breaks, scaleInterval) {
	var ticks = scale.getTicks({ expandToNicedExtent: true });
	var minorTicks = [];
	var extent = scale.getExtent();
	for (var i = 1; i < ticks.length; i++) {
		var nextTick = ticks[i];
		var prevTick = ticks[i - 1];
		if (prevTick["break"] || nextTick["break"]) continue;
		var count = 0;
		var minorTicksGroup = [];
		var minorInterval = (nextTick.value - prevTick.value) / splitNumber;
		var minorIntervalPrecision = getIntervalPrecision(minorInterval);
		while (count < splitNumber - 1) {
			var minorTick = round(prevTick.value + (count + 1) * minorInterval, minorIntervalPrecision);
			if (minorTick > extent[0] && minorTick < extent[1]) minorTicksGroup.push(minorTick);
			count++;
		}
		var scaleBreakHelper = getScaleBreakHelper();
		scaleBreakHelper && scaleBreakHelper.pruneTicksByBreak("auto", minorTicksGroup, breaks, function(value) {
			return value;
		}, scaleInterval, extent);
		minorTicks.push(minorTicksGroup);
	}
	return minorTicks;
}
//#endregion
//#region node_modules/echarts/lib/scale/Interval.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var IntervalScale = function(_super) {
	__extends(IntervalScale, _super);
	function IntervalScale(setting) {
		var _this = _super.call(this) || this;
		_this.type = "interval";
		_this.parse = IntervalScale.parse;
		setting = setting || {};
		_this.brk = initBreakOrLinearMapper(_this, simplyParseBreakOption(_this, setting), null).brk;
		_this._cfg = {
			interval: 0,
			intervalPrecision: 2,
			intervalCount: void 0,
			niceExtent: void 0
		};
		return _this;
	}
	IntervalScale.parse = function(val) {
		return val == null || val === "" ? NaN : Number(val);
	};
	IntervalScale.prototype.getConfig = function() {
		return clone$1(this._cfg);
	};
	IntervalScale.prototype.setConfig = function(cfg) {
		var extent = getScaleExtentForTickUnsafe(this);
		this._cfg = cfg = clone$1(cfg);
		if (cfg.niceExtent == null) cfg.niceExtent = extent.slice();
		if (cfg.intervalPrecision == null) cfg.intervalPrecision = getIntervalPrecision(cfg.interval);
	};
	/**
	* In ascending order.
	*/
	IntervalScale.prototype.getTicks = function(opt) {
		opt = opt || {};
		var cfg = this._cfg;
		var interval = cfg.interval;
		var extent = getScaleExtentForTickUnsafe(this);
		var niceExtent = cfg.niceExtent;
		var intervalPrecision = cfg.intervalPrecision;
		var scaleBreakHelper = getScaleBreakHelper();
		var brk = this.brk;
		var brkAvailable = scaleBreakHelper && brk;
		var ticks = [];
		if (!interval) return ticks;
		if (opt.breakTicks === "only_break" && brkAvailable) {
			scaleBreakHelper.addBreaksToTicks(ticks, brk.breaks, extent);
			return ticks;
		}
		var safeLimit = 3e3;
		if (extent[0] < niceExtent[0]) ticks.push({ value: opt.expandToNicedExtent ? round(niceExtent[0] - interval, intervalPrecision) : extent[0] });
		var estimateNiceMultiple = function(tickVal, targetTick) {
			return mathRound((targetTick - tickVal) / interval);
		};
		var intervalCount = cfg.intervalCount;
		for (var tick = niceExtent[0], niceTickIdx = 0;; niceTickIdx++) {
			if (intervalCount == null) {
				if (tick > niceExtent[1] || !isFinite(tick) || !isFinite(niceExtent[1])) break;
			} else {
				if (niceTickIdx > intervalCount) break;
				tick = mathMin$2(tick, niceExtent[1]);
				if (niceTickIdx === intervalCount) tick = niceExtent[1];
			}
			ticks.push({ value: tick });
			tick = round(tick + interval, intervalPrecision);
			if (brk) {
				var moreMultiple = brk.calcNiceTickMultiple(tick, estimateNiceMultiple);
				if (moreMultiple >= 0) tick = round(tick + moreMultiple * interval, intervalPrecision);
			}
			if (ticks.length > 0 && tick === ticks[ticks.length - 1].value) break;
			if (ticks.length > safeLimit) return [];
		}
		var lastNiceTick = ticks.length ? ticks[ticks.length - 1].value : niceExtent[1];
		if (extent[1] > lastNiceTick) ticks.push({ value: opt.expandToNicedExtent ? round(lastNiceTick + interval, intervalPrecision) : extent[1] });
		if (brkAvailable) scaleBreakHelper.pruneTicksByBreak(opt.pruneByBreak, ticks, brk.breaks, function(item) {
			return item.value;
		}, cfg.interval, extent);
		if (brkAvailable && opt.breakTicks !== "none") scaleBreakHelper.addBreaksToTicks(ticks, brk.breaks, extent);
		return ticks;
	};
	IntervalScale.prototype.getMinorTicks = function(splitNumber) {
		return getMinorTicks(this, splitNumber, getBreaksUnsafe(this), this._cfg.interval);
	};
	IntervalScale.prototype.getLabel = function(tick, opt) {
		if (tick == null) return "";
		var precision = opt && opt.precision;
		if (precision == null) precision = getPrecision(tick.value) || 0;
		else if (precision === "auto") precision = this._cfg.intervalPrecision;
		return addCommas(round(tick.value, precision, true));
	};
	IntervalScale.type = "interval";
	return IntervalScale;
}(Scale);
Scale.registerClass(IntervalScale);
//#endregion
//#region node_modules/echarts/lib/scale/Time.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var bisect = function(a, x, lo, hi) {
	while (lo < hi) {
		var mid = lo + hi >>> 1;
		if (a[mid][1] < x) lo = mid + 1;
		else hi = mid;
	}
	return lo;
};
var TimeScale = function(_super) {
	__extends(TimeScale, _super);
	function TimeScale(setting) {
		var _this = _super.call(this) || this;
		_this.type = "time";
		_this.parse = TimeScale.parse;
		_this._locale = setting.locale;
		_this._useUTC = setting.useUTC;
		_this._interval = 0;
		_this.brk = initBreakOrLinearMapper(_this, simplyParseBreakOption(_this, setting), null).brk;
		return _this;
	}
	/**
	* Get label is mainly for other components like dataZoom, tooltip.
	*/
	TimeScale.prototype.getLabel = function(tick) {
		return format(tick.value, fullLeveledFormatter[getDefaultFormatPrecisionOfInterval(getPrimaryTimeUnit(this._minLevelUnit))] || fullLeveledFormatter.second, this._useUTC, this._locale);
	};
	TimeScale.prototype.getFormattedLabel = function(tick, idx, labelFormatter) {
		return leveledFormat(tick, idx, labelFormatter, this._locale, this._useUTC);
	};
	TimeScale.prototype.getTicks = function(opt) {
		opt = opt || {};
		var interval = this._interval;
		var extent = getScaleExtentForTickUnsafe(this);
		var scaleBreakHelper = getScaleBreakHelper();
		var brk = this.brk;
		var brkAvailable = scaleBreakHelper && brk;
		var ticks = [];
		if (!interval) return ticks;
		var useUTC = this._useUTC;
		if (brkAvailable && opt.breakTicks === "only_break") {
			getScaleBreakHelper().addBreaksToTicks(ticks, brk.breaks, extent);
			return ticks;
		}
		ticks = createIntervalTicks(this._minLevelUnit, this._approxInterval, useUTC, extent, getScaleLinearSpanEffective(this), brk);
		var upperUnitIndex = primaryTimeUnits.length - 1;
		var maxLevel = 0;
		each$1(ticks, function(tick) {
			if (tick.time) {
				upperUnitIndex = Math.min(upperUnitIndex, indexOf(primaryTimeUnits, tick.time.upperTimeUnit));
				maxLevel = Math.max(maxLevel, tick.time.level);
			}
		});
		if (brkAvailable) getScaleBreakHelper().pruneTicksByBreak(opt.pruneByBreak, ticks, brk.breaks, function(item) {
			return item.value;
		}, this._approxInterval, extent);
		if (brkAvailable && opt.breakTicks !== "none") getScaleBreakHelper().addBreaksToTicks(ticks, brk.breaks, extent, function(trimmedBrk) {
			var lowerBrkUnitIndex = Math.max(indexOf(primaryTimeUnits, getUnitFromValue(trimmedBrk.vmin, useUTC)), indexOf(primaryTimeUnits, getUnitFromValue(trimmedBrk.vmax, useUTC)));
			var upperBrkUnitIndex = 0;
			for (var unitIdx = 0; unitIdx < primaryTimeUnits.length; unitIdx++) if (!isPrimaryUnitValueAndGreaterSame(primaryTimeUnits[unitIdx], trimmedBrk.vmin, trimmedBrk.vmax, useUTC)) {
				upperBrkUnitIndex = unitIdx;
				break;
			}
			var upperIdx = Math.min(upperBrkUnitIndex, upperUnitIndex);
			return {
				level: maxLevel,
				lowerTimeUnit: primaryTimeUnits[Math.max(upperIdx, lowerBrkUnitIndex)],
				upperTimeUnit: primaryTimeUnits[upperIdx]
			};
		});
		return ticks;
	};
	TimeScale.prototype.getMinorTicks = function(splitNumber) {
		return getMinorTicks(this, splitNumber, getBreaksUnsafe(this), this._interval);
	};
	TimeScale.prototype.setTimeInterval = function(opt) {
		this._interval = opt.interval;
		this._approxInterval = opt.approxInterval;
		this._minLevelUnit = opt.minLevelUnit;
	};
	TimeScale.parse = function(val) {
		return isNumber(val) ? Math.round(val) : +parseDate(val);
	};
	TimeScale.type = "time";
	return TimeScale;
}(Scale);
/**
* This implementation was originally copied from "d3.js"
* <https://github.com/d3/d3/blob/b516d77fb8566b576088e73410437494717ada26/src/time/scale.js>
* with some modifications made for this program.
* See the license statement at the head of this file.
*/
var scaleIntervals = [
	["second", ONE_SECOND],
	["minute", ONE_MINUTE],
	["hour", ONE_HOUR],
	["quarter-day", ONE_HOUR * 6],
	["half-day", ONE_HOUR * 12],
	["day", ONE_DAY * 1.2],
	["half-week", ONE_DAY * 3.5],
	["week", ONE_DAY * 7],
	["month", ONE_DAY * 31],
	["quarter", ONE_DAY * 95],
	["half-year", ONE_YEAR / 2],
	["year", ONE_YEAR]
];
function isPrimaryUnitValueAndGreaterSame(unit, valueA, valueB, isUTC) {
	return roundTime(new Date(valueA), unit, isUTC).getTime() === roundTime(new Date(valueB), unit, isUTC).getTime();
}
function getDateInterval(approxInterval, daysInMonth) {
	approxInterval /= ONE_DAY;
	return approxInterval > 16 ? 16 : approxInterval > 7.5 ? 7 : approxInterval > 3.5 ? 4 : approxInterval > 1.5 ? 2 : 1;
}
function getMonthInterval(approxInterval) {
	var APPROX_ONE_MONTH = 30 * ONE_DAY;
	approxInterval /= APPROX_ONE_MONTH;
	return approxInterval > 6 ? 6 : approxInterval > 3 ? 3 : approxInterval > 2 ? 2 : 1;
}
function getHourInterval(approxInterval) {
	approxInterval /= ONE_HOUR;
	return approxInterval > 12 ? 12 : approxInterval > 6 ? 6 : approxInterval > 3.5 ? 4 : approxInterval > 2 ? 2 : 1;
}
function getMinutesAndSecondsInterval(approxInterval, isMinutes) {
	approxInterval /= isMinutes ? ONE_MINUTE : ONE_SECOND;
	return approxInterval > 30 ? 30 : approxInterval > 20 ? 20 : approxInterval > 15 ? 15 : approxInterval > 10 ? 10 : approxInterval > 5 ? 5 : approxInterval > 2 ? 2 : 1;
}
function getMillisecondsInterval(approxInterval) {
	return mathMax$2(nice(approxInterval, true), 1);
}
function getFirstTimestampOfUnit(timestamp, unitName, isUTC) {
	var upperUnitIdx = Math.max(0, indexOf(primaryTimeUnits, unitName) - 1);
	return roundTime(new Date(timestamp), primaryTimeUnits[upperUnitIdx], isUTC).getTime();
}
function createEstimateNiceMultiple(setMethodName, dateMethodInterval) {
	var tmpDate = /* @__PURE__ */ new Date(0);
	tmpDate[setMethodName](1);
	var tmpTime = tmpDate.getTime();
	tmpDate[setMethodName](1 + dateMethodInterval);
	var approxTimeInterval = tmpDate.getTime() - tmpTime;
	return function(tickVal, targetValue) {
		return Math.max(0, Math.round((targetValue - tickVal) / approxTimeInterval));
	};
}
function createIntervalTicks(bottomUnitName, approxInterval, isUTC, extent, innermostSpan, brk) {
	var safeLimit = 3e3;
	var unitNames = timeUnits;
	var iter = 0;
	function addTicksInSpan(interval, minTimestamp, maxTimestamp, getMethodName, setMethodName, isDate, out) {
		var estimateNiceMultiple = createEstimateNiceMultiple(setMethodName, interval);
		var dateTime = minTimestamp;
		var date = new Date(dateTime);
		while (dateTime < maxTimestamp && dateTime <= extent[1]) {
			out.push({ value: dateTime });
			if (iter++ > safeLimit) break;
			date[setMethodName](date[getMethodName]() + interval);
			dateTime = date.getTime();
			if (brk) {
				var moreMultiple = brk.calcNiceTickMultiple(dateTime, estimateNiceMultiple);
				if (moreMultiple > 0) {
					date[setMethodName](date[getMethodName]() + moreMultiple * interval);
					dateTime = date.getTime();
				}
			}
		}
		out.push({
			value: dateTime,
			notAdd: dateTime > extent[1]
		});
	}
	function addLevelTicks(unitName, lastLevelTicks, levelTicks) {
		var newAddedTicks = [];
		var isFirstLevel = !lastLevelTicks.length;
		if (isPrimaryUnitValueAndGreaterSame(getPrimaryTimeUnit(unitName), extent[0], extent[1], isUTC)) return;
		if (isFirstLevel) lastLevelTicks = [{ value: getFirstTimestampOfUnit(extent[0], unitName, isUTC) }, { value: extent[1] }];
		for (var i = 0; i < lastLevelTicks.length - 1; i++) {
			var startTick = lastLevelTicks[i].value;
			var endTick = lastLevelTicks[i + 1].value;
			if (startTick === endTick) continue;
			var interval = void 0;
			var getterName = void 0;
			var setterName = void 0;
			var isDate = false;
			switch (unitName) {
				case "year":
					interval = Math.max(1, Math.round(approxInterval / ONE_DAY / 365));
					getterName = fullYearGetterName(isUTC);
					setterName = fullYearSetterName(isUTC);
					break;
				case "half-year":
				case "quarter":
				case "month":
					interval = getMonthInterval(approxInterval);
					getterName = monthGetterName(isUTC);
					setterName = monthSetterName(isUTC);
					break;
				case "week":
				case "half-week":
				case "day":
					interval = getDateInterval(approxInterval, 31);
					getterName = dateGetterName(isUTC);
					setterName = dateSetterName(isUTC);
					isDate = true;
					break;
				case "half-day":
				case "quarter-day":
				case "hour":
					interval = getHourInterval(approxInterval);
					getterName = hoursGetterName(isUTC);
					setterName = hoursSetterName(isUTC);
					break;
				case "minute":
					interval = getMinutesAndSecondsInterval(approxInterval, true);
					getterName = minutesGetterName(isUTC);
					setterName = minutesSetterName(isUTC);
					break;
				case "second":
					interval = getMinutesAndSecondsInterval(approxInterval, false);
					getterName = secondsGetterName(isUTC);
					setterName = secondsSetterName(isUTC);
					break;
				case "millisecond":
					interval = getMillisecondsInterval(approxInterval);
					getterName = millisecondsGetterName(isUTC);
					setterName = millisecondsSetterName(isUTC);
			}
			if (endTick >= extent[0] && startTick <= extent[1]) addTicksInSpan(interval, startTick, endTick, getterName, setterName, isDate, newAddedTicks);
			if (unitName === "year" && levelTicks.length > 1 && i === 0) levelTicks.unshift({ value: levelTicks[0].value - interval });
		}
		for (var i = 0; i < newAddedTicks.length; i++) levelTicks.push(newAddedTicks[i]);
	}
	var levelsTicks = [];
	var currentLevelTicks = [];
	var tickCount = 0;
	var lastLevelTickCount = 0;
	for (var i = 0; i < unitNames.length; ++i) {
		var primaryTimeUnit = getPrimaryTimeUnit(unitNames[i]);
		if (!isPrimaryTimeUnit(unitNames[i])) continue;
		addLevelTicks(unitNames[i], levelsTicks[levelsTicks.length - 1] || [], currentLevelTicks);
		if (primaryTimeUnit !== (unitNames[i + 1] ? getPrimaryTimeUnit(unitNames[i + 1]) : null)) {
			if (currentLevelTicks.length) {
				lastLevelTickCount = tickCount;
				currentLevelTicks.sort(function(a, b) {
					return a.value - b.value;
				});
				var levelTicksRemoveDuplicated = [];
				for (var i_1 = 0; i_1 < currentLevelTicks.length; ++i_1) {
					var tickValue = currentLevelTicks[i_1].value;
					if (i_1 === 0 || currentLevelTicks[i_1 - 1].value !== tickValue) {
						levelTicksRemoveDuplicated.push(currentLevelTicks[i_1]);
						if (tickValue >= extent[0] && tickValue <= extent[1]) tickCount++;
					}
				}
				var targetTickNum = innermostSpan / approxInterval;
				if (tickCount > targetTickNum * 1.5 && lastLevelTickCount > targetTickNum / 1.5) break;
				levelsTicks.push(levelTicksRemoveDuplicated);
				if (tickCount > targetTickNum || bottomUnitName === unitNames[i]) break;
			}
			currentLevelTicks = [];
		}
	}
	var levelsTicksInExtent = filter(map(levelsTicks, function(levelTicks) {
		return filter(levelTicks, function(tick) {
			return tick.value >= extent[0] && tick.value <= extent[1] && !tick.notAdd;
		});
	}), function(levelTicks) {
		return levelTicks.length > 0;
	});
	var maxLevel = levelsTicksInExtent.length - 1;
	var ticks = [];
	for (var i = 0; i < levelsTicksInExtent.length; ++i) {
		var levelTicks = levelsTicksInExtent[i];
		for (var k = 0; k < levelTicks.length; ++k) {
			var unit = getUnitFromValue(levelTicks[k].value, isUTC);
			ticks.push({
				value: levelTicks[k].value,
				time: {
					level: maxLevel - i,
					upperTimeUnit: unit,
					lowerTimeUnit: unit
				}
			});
		}
	}
	removeDuplicates(ticks, removeDuplicatesGetKeyFromValueProp, null);
	ticks.sort(function(a, b) {
		return a.value - b.value;
	});
	var currMinTick = ticks[0];
	var currMaxTick = ticks[ticks.length - 1];
	var extent0Unit = getUnitFromValue(extent[0], isUTC);
	var extent1Unit = getUnitFromValue(extent[1], isUTC);
	if (!currMinTick || currMinTick.value > extent[0]) ticks.unshift({
		value: extent[0],
		time: {
			level: 0,
			upperTimeUnit: extent0Unit,
			lowerTimeUnit: extent0Unit
		},
		notNice: true
	});
	if (!currMaxTick || currMaxTick.value < extent[1]) ticks.push({
		value: extent[1],
		time: {
			level: 0,
			upperTimeUnit: extent1Unit,
			lowerTimeUnit: extent1Unit
		},
		notNice: true
	});
	return ticks;
}
var calcNiceForTimeScale = function(scale, opt) {
	var extent = scale.getExtent();
	if (extent[0] === extent[1]) {
		extent[0] -= ONE_DAY;
		extent[1] += ONE_DAY;
	}
	if (extent[1] === -Infinity && extent[0] === Infinity) {
		var d = /* @__PURE__ */ new Date();
		extent[1] = +new Date(d.getFullYear(), d.getMonth(), d.getDate());
		extent[0] = extent[1] - ONE_DAY;
	}
	scale.setExtent(extent[0], extent[1]);
	var splitNumber = ensureValidSplitNumber(opt.splitNumber, 10);
	var approxInterval = getScaleLinearSpanEffective(scale) / splitNumber;
	var minInterval = opt.minInterval;
	var maxInterval = opt.maxInterval;
	if (minInterval != null && approxInterval < minInterval) approxInterval = minInterval;
	if (maxInterval != null && approxInterval > maxInterval) approxInterval = maxInterval;
	var scaleIntervalsLen = scaleIntervals.length;
	var idx = Math.min(bisect(scaleIntervals, approxInterval, 0, scaleIntervalsLen), scaleIntervalsLen - 1);
	var interval = scaleIntervals[idx][1];
	var minLevelUnit = scaleIntervals[Math.max(idx - 1, 0)][0];
	scale.setTimeInterval({
		approxInterval,
		interval,
		minLevelUnit
	});
};
Scale.registerClass(TimeScale);
//#endregion
//#region node_modules/echarts/lib/scale/Log.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var LOOKUP_IDX_EXTENT_START = 0;
var LOOKUP_IDX_EXTENT_END = 1;
var LOOKUP_IDX_BREAK_START = 2;
/**
* @final NEVER inherit me!
*/
var LogScale = function(_super) {
	__extends(LogScale, _super);
	function LogScale(setting) {
		var _this = _super.call(this) || this;
		_this.type = "log";
		_this.parse = IntervalScale.parse;
		_this.base = setting.logBase || 10;
		var lookupFrom = [];
		var lookupTo = [];
		var lookup = _this._lookup = {
			from: lookupFrom,
			to: lookupTo
		};
		lookupFrom[LOOKUP_IDX_EXTENT_START] = lookupFrom[LOOKUP_IDX_EXTENT_END] = lookupTo[LOOKUP_IDX_EXTENT_START] = lookupTo[LOOKUP_IDX_EXTENT_END] = NaN;
		decorateScaleMapper(_this, LogScale.mapperMethods);
		var scaleBreakHelper = getScaleBreakHelper();
		var breakOption = setting.breakOption;
		var out = { lookup };
		if (scaleBreakHelper) scaleBreakHelper.parseAxisBreakOptionInwardTransform(breakOption, _this, { noNegative: true }, LOOKUP_IDX_BREAK_START, out);
		_this.powStub = new IntervalScale({ breakParsed: out.original });
		_this.intervalStub = new IntervalScale({ breakParsed: out.transformed });
		enableScaleMapperFreeze(_this, _this.intervalStub);
		return _this;
	}
	LogScale.prototype.getTicks = function(opt) {
		var base = this.base;
		var powStub = this.powStub;
		var scaleBreakHelper = getScaleBreakHelper();
		var intervalStub = this.intervalStub;
		var powOpt = { lookup: {
			from: intervalStub.getExtent(),
			to: powStub.getExtent()
		} };
		return map(intervalStub.getTicks(opt || {}), function(tick) {
			var val = tick.value;
			var powVal = logScalePowTick(val, base, powOpt);
			var vBreak;
			if (scaleBreakHelper) {
				var brkPowResult = scaleBreakHelper.getTicksBreakOutwardTransform(this, tick, getBreaksUnsafe(powStub), this._lookup);
				if (brkPowResult) {
					vBreak = brkPowResult.vBreak;
					powVal = brkPowResult.tickVal;
				}
			}
			return {
				value: powVal,
				"break": vBreak
			};
		}, this);
	};
	LogScale.prototype.getMinorTicks = function(splitNumber) {
		return getMinorTicks(this, splitNumber, getBreaksUnsafe(this.powStub), this.intervalStub.getConfig().interval);
	};
	LogScale.prototype.getLabel = function(data, opt) {
		return this.intervalStub.getLabel(data, opt);
	};
	LogScale.type = "log";
	LogScale.mapperMethods = {
		needTransform: function() {
			return true;
		},
		normalize: function(val) {
			return this.intervalStub.normalize(logScaleLogTick(val, this.base));
		},
		scale: function(val) {
			return logScalePowTick(this.intervalStub.scale(val), this.base, null);
		},
		transformIn: function(val, opt) {
			val = logScaleLogTick(val, this.base);
			return opt && opt.depth === 2 ? val : this.intervalStub.transformIn(val, opt);
		},
		transformOut: function(val, opt) {
			var depth = opt ? opt.depth : null;
			tmpTransformOutOpt1.depth = depth;
			tmpTransformOutOpt2.lookup = this._lookup;
			return logScalePowTick(depth === 2 ? val : this.intervalStub.transformOut(val, tmpTransformOutOpt1), this.base, tmpTransformOutOpt2);
		},
		contain: function(val) {
			return this.powStub.contain(val);
		},
		/**
		* NOTICE: The caller should ensure `start` and `end` are both non-negative.
		*/
		setExtent: function(start, end) {
			this.setExtent2(0, start, end);
		},
		setExtent2: function(kind, start, end) {
			if (!isValidBoundsForExtent(start, end) || start <= 0 || end <= 0) return;
			var lookupTo = tmpNotUsedArr;
			var lookupFrom = tmpNotUsedArr;
			if (kind === 0) {
				var lookup = this._lookup;
				lookupTo = lookup.to;
				lookupFrom = lookup.from;
			}
			this.powStub.setExtent2(kind, lookupTo[LOOKUP_IDX_EXTENT_START] = start, lookupTo[LOOKUP_IDX_EXTENT_END] = end);
			var base = this.base;
			this.intervalStub.setExtent2(kind, lookupFrom[LOOKUP_IDX_EXTENT_START] = logScaleLogTick(start, base), lookupFrom[LOOKUP_IDX_EXTENT_END] = logScaleLogTick(end, base));
		},
		getFilter: function() {
			return { g: 0 };
		},
		sanitize: function(value, dataExtent) {
			if (isValidBoundsForExtent(dataExtent[0], dataExtent[1]) && isNullableNumberFinite(value) && value <= 0) value = dataExtent[0];
			return value;
		},
		getDefaultStartValue: function() {
			return 1;
		},
		getExtent: function() {
			return this.powStub.getExtent();
		},
		getExtentUnsafe: function(kind, depth) {
			return depth === null ? this.powStub.getExtentUnsafe(kind, null) : this.intervalStub.getExtentUnsafe(kind, depth);
		}
	};
	return LogScale;
}(Scale);
Scale.registerClass(LogScale);
var tmpTransformOutOpt1 = {};
var tmpTransformOutOpt2 = {};
var tmpNotUsedArr = [];
//#endregion
//#region node_modules/echarts/lib/coord/axisCommonTypes.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var AXIS_TYPES = {
	value: 1,
	category: 1,
	time: 1,
	log: 1
};
//#endregion
//#region node_modules/echarts/lib/coord/axisHelper.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var axisInner$1 = makeInner();
function determineAxisType(model) {
	var type = model.get("type");
	if (type == null || !hasOwn(AXIS_TYPES, type) && !Scale.getClass(type)) type = "value";
	return type;
}
function createScaleByModel(model, type, coordSysSupportAxisBreaks) {
	var breakHelper = getScaleBreakHelper();
	var breakOption;
	if (breakHelper) breakOption = retrieveAxisBreaksOption(model, type, coordSysSupportAxisBreaks);
	switch (type) {
		case "category": return new OrdinalScale({
			ordinalMeta: model.getOrdinalMeta ? model.getOrdinalMeta() : model.getCategories(),
			extent: initExtentForUnion()
		});
		case "time": return new TimeScale({
			locale: model.ecModel.getLocaleModel(),
			useUTC: model.ecModel.get("useUTC"),
			breakOption
		});
		case "log": return new LogScale({
			logBase: model.get("logBase"),
			breakOption
		});
		case "value": return new IntervalScale({ breakOption });
		default: return new ((Scale.getClass(type)) || IntervalScale)({});
	}
}
/**
* Check if the axis cross a specific value.
*/
function getScaleValuePositionKind(scale, value, considerMappingExtent) {
	var dataExtent = considerMappingExtent ? getScaleExtentForMappingUnsafe(scale, null) : scale.getExtentUnsafe(0, null);
	var min = dataExtent[0];
	var max = dataExtent[1];
	return !isValidBoundsForExtent(min, max) ? 3 : min === value || max === value ? 2 : min < value && max > value ? 1 : 3;
}
function discourageOnAxisZero(axis) {
	axisInner$1(axis).noOnMyZero = true;
}
/**
* `true`: Prevent orthoganal axes from positioning at the zero point of this axis.
*/
function isOnAxisZeroDiscouraged(axis) {
	return axisInner$1(axis).noOnMyZero;
}
/**
* @param axis
* @return Label formatter function.
*         param: {number} tickValue,
*         param: {number} idx, the index in all ticks.
*                         If category axis, this param is not required.
*         return: {string} label string.
*/
function makeLabelFormatter(axis) {
	var labelFormatter = axis.getLabelModel().get("formatter");
	if (axis.type === "time") {
		var parsed_1 = parseTimeAxisLabelFormatter(labelFormatter);
		return function(tick, idx) {
			return axis.scale.getFormattedLabel(tick, idx, parsed_1);
		};
	} else if (isString(labelFormatter)) return function(tick) {
		var label = axis.scale.getLabel(tick);
		return labelFormatter.replace("{value}", label != null ? label : "");
	};
	else if (isFunction(labelFormatter)) {
		if (axis.type === "category") return function(tick, idx) {
			return labelFormatter(getAxisRawValue(axis, tick), tick.value - axis.scale.getExtent()[0], null);
		};
		var scaleBreakHelper_1 = getScaleBreakHelper();
		return function(tick, idx) {
			var extra = null;
			if (scaleBreakHelper_1) extra = scaleBreakHelper_1.makeAxisLabelFormatterParamBreak(extra, tick["break"]);
			return labelFormatter(getAxisRawValue(axis, tick), idx, extra);
		};
	} else return function(tick) {
		return axis.scale.getLabel(tick);
	};
}
function getAxisRawValue(axis, tick) {
	var scale = axis.scale;
	return isOrdinalScale(scale) ? scale.getLabel(tick) : tick.value;
}
/**
* @param model axisLabelModel or axisTickModel
*/
function getOptionCategoryInterval(model) {
	var interval = model.get("interval");
	return interval == null ? "auto" : interval;
}
/**
* Set `categoryInterval` as 0 implicitly indicates that
* show all labels regardless of overlap.
* @param {Object} axis axisModel.axis
*/
function shouldShowAllLabels(axis) {
	return axis.type === "category" && getOptionCategoryInterval(axis.getLabelModel()) === 0;
}
function getDataDimensionsOnAxis(data, axisDim) {
	var dataDimMap = {};
	each$1(data.mapDimensionsAll(axisDim), function(dataDim) {
		dataDimMap[getStackedDimension(data, dataDim)] = true;
	});
	return keys(dataDimMap);
}
function isNameLocationCenter(nameLocation) {
	return nameLocation === "middle" || nameLocation === "center";
}
function shouldAxisShow(axisModel) {
	return axisModel.getShallow("show");
}
function retrieveAxisBreaksOption(model, axisType, coordSysSupportAxisBreaks) {
	var option = model.get("breaks", true);
	if (option != null) {
		if (!getScaleBreakHelper()) return;
		if (!coordSysSupportAxisBreaks || !isAxisTypeSupportAxisBreak(axisType)) return;
		return option;
	}
}
function isAxisTypeSupportAxisBreak(axisType) {
	return axisType !== "category";
}
function updateIntervalOrLogScaleForNiceOrAligned(scale, fixMinMax, oldIntervalExtent, newIntervalExtent, oldOutermostExtent, cfg) {
	var isTargetLogScale = isLogScale(scale);
	var intervalStub = isTargetLogScale ? scale.intervalStub : scale;
	intervalStub.setExtent(newIntervalExtent[0], newIntervalExtent[1]);
	if (isTargetLogScale) {
		var powStub = scale.powStub;
		var opt = { depth: 2 };
		var minPow = scale.transformOut(newIntervalExtent[0], opt);
		var maxPow = scale.transformOut(newIntervalExtent[1], opt);
		var extentChanged = extentDiffers(oldIntervalExtent, newIntervalExtent);
		if (fixMinMax[0] && !extentChanged[0]) minPow = oldOutermostExtent[0];
		if (fixMinMax[1] && !extentChanged[1]) maxPow = oldOutermostExtent[1];
		powStub.setExtent(minPow, maxPow);
	}
	intervalStub.setConfig(cfg);
}
function getTickValueOutermost(scale, tick) {
	return isOrdinalScale(scale) ? scale.getRawOrdinalNumber(tick.value) : tick.value;
}
function isAxisOnBand(scale, axisModel) {
	return isOrdinalScale(scale) && !!axisModel.get("boundaryGap");
}
//#endregion
//#region node_modules/echarts/lib/coord/axisTickLabelBuilder.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var modelInner = makeInner();
var axisInner = makeInner();
var AxisTickLabelComputingKind = {
	estimate: 1,
	determine: 2
};
function createAxisLabelsComputingContext(kind) {
	return {
		out: { noPxChangeTryDetermine: [] },
		kind
	};
}
/**
* CAUTION: Do not modify the result.
*/
function createAxisLabels(axis, ctx) {
	var custom = axis.getLabelModel().get("customValues");
	if (custom) {
		var scale_1 = axis.scale;
		return { labels: map(parseTickLabelCustomValues(custom, scale_1), function(tick, index) {
			return {
				formattedLabel: makeLabelFormatter(axis)(tick, index),
				rawLabel: scale_1.getLabel(tick),
				tick
			};
		}) };
	}
	return axis.type === "category" ? makeCategoryLabels(axis, ctx) : makeRealNumberLabels(axis);
}
/**
* CAUTION: Do not modify the result.
*
* @param tickModel For example, can be axisTick, splitLine, splitArea.
*/
function createAxisTicks(axis, tickModel, opt) {
	var scale = axis.scale;
	var custom = axis.getTickModel().get("customValues");
	if (custom) return { ticks: parseTickLabelCustomValues(custom, scale) };
	return axis.type === "category" ? makeCategoryTicks(axis, tickModel) : { ticks: scale.getTicks(opt) };
}
function parseTickLabelCustomValues(customValues, scale) {
	var extent = scale.getExtent();
	var tickNumbers = [];
	each$1(customValues, function(val) {
		val = scale.parse(val);
		if (val >= extent[0] && val <= extent[1]) tickNumbers.push(val);
	});
	removeDuplicates(tickNumbers, removeDuplicatesGetKeyFromItemItself, null);
	asc(tickNumbers);
	return map(tickNumbers, function(tickVal) {
		return { value: tickVal };
	});
}
function makeCategoryLabels(axis, ctx) {
	var labelModel = axis.getLabelModel();
	var result = makeCategoryLabelsActually(axis, labelModel, ctx);
	return !labelModel.get("show") || axis.scale.isBlank() ? { labels: [] } : result;
}
function makeCategoryLabelsActually(axis, labelModel, ctx) {
	var labelsCache = ensureCategoryLabelCache(axis);
	var optionLabelInterval = getOptionCategoryInterval(labelModel);
	var isEstimate = ctx.kind === AxisTickLabelComputingKind.estimate;
	if (!isEstimate) {
		var result_1 = axisCacheGet(labelsCache, optionLabelInterval);
		if (result_1) return result_1;
	}
	var labels;
	var numericLabelInterval;
	if (isFunction(optionLabelInterval)) labels = makeTicksLabelsByCategoryIntervalNumOrCb(axis, optionLabelInterval, false);
	else {
		numericLabelInterval = optionLabelInterval === "auto" ? makeAutoCategoryInterval(axis, ctx) : optionLabelInterval;
		labels = makeTicksLabelsByCategoryIntervalNumOrCb(axis, numericLabelInterval, false);
	}
	var result = {
		labels,
		labelCategoryInterval: numericLabelInterval
	};
	if (!isEstimate) axisCacheSet(labelsCache, optionLabelInterval, result);
	else ctx.out.noPxChangeTryDetermine.push(function() {
		axisCacheSet(labelsCache, optionLabelInterval, result);
		return true;
	});
	return result;
}
function makeCategoryTicks(axis, tickModel) {
	var ticksCache = ensureCategoryTickCache(axis);
	var optionTickInterval = getOptionCategoryInterval(tickModel);
	var result = axisCacheGet(ticksCache, optionTickInterval);
	if (result) return result;
	var ticks;
	var tickCategoryInterval;
	if (!tickModel.get("show") || axis.scale.isBlank()) ticks = [];
	if (isFunction(optionTickInterval)) ticks = makeTicksLabelsByCategoryIntervalNumOrCb(axis, optionTickInterval, true);
	else if (optionTickInterval === "auto") {
		var labelsResult = makeCategoryLabelsActually(axis, axis.getLabelModel(), createAxisLabelsComputingContext(AxisTickLabelComputingKind.determine));
		tickCategoryInterval = labelsResult.labelCategoryInterval;
		ticks = map(labelsResult.labels, function(labelItem) {
			return labelItem.tick;
		});
	} else {
		tickCategoryInterval = optionTickInterval;
		ticks = makeTicksLabelsByCategoryIntervalNumOrCb(axis, tickCategoryInterval, true);
	}
	return axisCacheSet(ticksCache, optionTickInterval, {
		ticks,
		tickCategoryInterval
	});
}
function makeRealNumberLabels(axis) {
	var ticks = axis.scale.getTicks();
	var labelFormatter = makeLabelFormatter(axis);
	return { labels: map(ticks, function(tick, idx) {
		return {
			formattedLabel: labelFormatter(tick, idx),
			rawLabel: axis.scale.getLabel(tick),
			tick
		};
	}) };
}
var ensureCategoryTickCache = initAxisCacheMethod("axisTick");
var ensureCategoryLabelCache = initAxisCacheMethod("axisLabel");
/**
* PENDING: refactor to JS Map? Because key can be a function or more complicated object, and
* cache size always is small, and currently no JS Map object key polyfill, we use a simple
* array cache instead of plain object hash.
*/
function initAxisCacheMethod(prop) {
	return function ensureCache(axis) {
		return axisInner(axis)[prop] || (axisInner(axis)[prop] = { list: [] });
	};
}
function axisCacheGet(cache, key) {
	for (var i = 0; i < cache.list.length; i++) if (cache.list[i].key === key) return cache.list[i].value;
}
function axisCacheSet(cache, key, value) {
	cache.list.push({
		key,
		value
	});
	return value;
}
function makeAutoCategoryInterval(axis, ctx) {
	if (ctx.kind === AxisTickLabelComputingKind.estimate) {
		var result_2 = axis.calculateCategoryInterval(ctx);
		ctx.out.noPxChangeTryDetermine.push(function() {
			axisInner(axis).autoInterval = result_2;
			return true;
		});
		return result_2;
	}
	var result = axisInner(axis).autoInterval;
	return result != null ? result : axisInner(axis).autoInterval = axis.calculateCategoryInterval(ctx);
}
/**
* Calculate interval for category axis ticks and labels.
* Use a strategy to try to avoid overlapping.
* To get precise result, at least one of `getRotate` and `isHorizontal`
* should be implemented in axis.
*/
function calculateCategoryInterval(axis, ctx) {
	var kind = ctx.kind;
	var params = fetchAutoCategoryIntervalCalculationParams(axis);
	var labelFormatter = makeLabelFormatter(axis);
	var rotation = (params.axisRotate - params.labelRotate) / 180 * Math.PI;
	var ordinalScale = axis.scale;
	var ordinalExtent = ordinalScale.getExtent();
	var tickCount = ordinalScale.count();
	if (ordinalExtent[1] - ordinalExtent[0] < 1) return 0;
	var step = 1;
	var maxCount = 40;
	if (tickCount > maxCount) step = Math.max(1, Math.floor(tickCount / maxCount));
	var tickValue = ordinalExtent[0];
	var unitSpan = axis.dataToCoord(tickValue + 1) - axis.dataToCoord(tickValue);
	var unitW = Math.abs(unitSpan * Math.cos(rotation));
	var unitH = Math.abs(unitSpan * Math.sin(rotation));
	var maxW = 0;
	var maxH = 0;
	for (; tickValue <= ordinalExtent[1]; tickValue += step) {
		var width = 0;
		var height = 0;
		var rect = getBoundingRect(labelFormatter({ value: tickValue }), params.font, "center", "top");
		width = rect.width * 1.3;
		height = rect.height * 1.3;
		maxW = Math.max(maxW, width, 7);
		maxH = Math.max(maxH, height, 7);
	}
	var dw = maxW / unitW;
	var dh = maxH / unitH;
	isNaN(dw) && (dw = Infinity);
	isNaN(dh) && (dh = Infinity);
	var interval = Math.max(0, Math.floor(Math.min(dw, dh)));
	if (kind === AxisTickLabelComputingKind.estimate) {
		ctx.out.noPxChangeTryDetermine.push(bind(calculateCategoryIntervalTryDetermine, null, axis, interval, tickCount));
		return interval;
	}
	var lastInterval = calculateCategoryIntervalDealCache(axis, interval, tickCount);
	return lastInterval != null ? lastInterval : interval;
}
function calculateCategoryIntervalTryDetermine(axis, interval, tickCount) {
	return calculateCategoryIntervalDealCache(axis, interval, tickCount) == null;
}
function calculateCategoryIntervalDealCache(axis, interval, tickCount) {
	var cache = modelInner(axis.model);
	var axisExtent = axis.getExtent();
	var lastAutoInterval = cache.lastAutoInterval;
	var lastTickCount = cache.lastTickCount;
	if (lastAutoInterval != null && lastTickCount != null && Math.abs(lastAutoInterval - interval) <= 1 && Math.abs(lastTickCount - tickCount) <= 1 && lastAutoInterval > interval && cache.axisExtent0 === axisExtent[0] && cache.axisExtent1 === axisExtent[1]) return lastAutoInterval;
	else {
		cache.lastTickCount = tickCount;
		cache.lastAutoInterval = interval;
		cache.axisExtent0 = axisExtent[0];
		cache.axisExtent1 = axisExtent[1];
	}
}
function fetchAutoCategoryIntervalCalculationParams(axis) {
	var labelModel = axis.getLabelModel();
	return {
		axisRotate: axis.getRotate ? axis.getRotate() : axis.isHorizontal && !axis.isHorizontal() ? 90 : 0,
		labelRotate: labelModel.get("rotate") || 0,
		font: labelModel.getFont()
	};
}
function makeTicksLabelsByCategoryIntervalNumOrCb(axis, categoryInterval, onlyTick) {
	var labelFormatter = makeLabelFormatter(axis);
	var ordinalScale = axis.scale;
	var result = [];
	var categoryIntervalIsCb = isFunction(categoryInterval);
	ordinalScaleCreateTicks(ordinalScale, categoryIntervalIsCb ? 0 : categoryInterval, function(tickObj, isExtentBoundary) {
		var tickLabel = ordinalScale.getLabel(tickObj);
		if (categoryIntervalIsCb) {
			var isOnInterval = !!categoryInterval(tickObj.value, tickLabel);
			tickObj.offInterval = !isOnInterval;
			if (!isOnInterval && !isExtentBoundary) return;
		}
		result.push(onlyTick ? tickObj : {
			formattedLabel: labelFormatter(tickObj),
			rawLabel: tickLabel,
			tick: tickObj
		});
	});
	return result;
}
//#endregion
//#region node_modules/echarts/lib/util/cycleCache.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var ecModelCacheInner = makeInner();
/**
* CAVEAT: Can only be called by `echarts.ts`
*/
function resetCachePerECPrepare(ecModel) {
	ecModelCacheInner(ecModel).prepare = {};
}
/**
* CAVEAT: Can only be called by `echarts.ts`
*/
function resetCachePerECFullUpdate(ecModel) {
	ecModelCacheInner(ecModel).fullUpdate = {};
}
/**
* The cache is auto cleared at the beginning of EC_PREPARE.
* See also comments in EC_CYCLE.
*
* NOTICE:
*  - EC_PREPARE is not necessarily executed before each EC_FULL_UPDATE performing.
*    Typically, `setOption` trigger EC_PREPARE, but `dispatchAction` does not.
*  - It is not cleared in EC_PARTIAL_UPDATE and EC_PROGRESSIVE_CYCLE.
*
*/
function getCachePerECPrepare(ecModel) {
	return ecModelCacheInner(ecModel).prepare;
}
/**
* @usage
*  ```js
*  const cycleCache = makeInner<{
*      prop1: number;
*      prop2: string;
*  }, GlobalModelCachePerECFullUpdate>();
*  function doSomthing(ecModel: GlobalModel): void {
*      cycleCache(getCachePerECFullUpdate(ecModel)).prop1 = 123;
*      cycleCache(getCachePerECFullUpdate(ecModel)).prop2;
*  }
*  ```
*
* The cache is auto cleared at the beginning of EC_FULL_UPDATE.
* See also comments in EC_CYCLE.
*
* NOTICE:
*  - It is not cleared in EC_PARTIAL_UPDATE and EC_PROGRESSIVE_CYCLE.
*  - The cache should NOT be written before EC_FULL_UPDATE started, such as:
*      - should NOT in `getTargetSeries` methods of data processors.
*      - should NOT in `init`/`mergeOption`/`optionUpdated`/`getData` methods of component/series models.
*  - See `getCachePerECPrepare` for details.
*/
function getCachePerECFullUpdate(ecModel) {
	return ecModelCacheInner(ecModel).fullUpdate;
}
//#endregion
//#region node_modules/echarts/lib/coord/axisStatistics.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var callOnlyOnce = makeCallOnlyOnce();
var ecModelCacheFullUpdateInner = makeInner();
var ecModelCachePrepareInner = makeInner();
function getAxisStatPerKeyPerAxis(axis, axisStatKey) {
	var axisModel = axis.model;
	var keyed = ecModelCacheFullUpdateInner(getCachePerECFullUpdate(axisModel.ecModel)).keyed;
	var perKey = keyed && keyed.get(axisStatKey);
	return perKey && perKey.get(axisModel.uid);
}
function getAxisStat(axis, axisStatKey) {
	return wrapStatResult(getAxisStatPerKeyPerAxis(axis, axisStatKey));
}
function getAxisStatBySeries(axis, seriesList) {
	var result = [];
	eachKeyEachAxis(axis.model.ecModel, function(perKeyPerAxis) {
		for (var idx = 0; idx < seriesList.length; idx++) if (seriesList[idx] && perKeyPerAxis.serByIdx[seriesList[idx].seriesIndex]) result.push(wrapStatResult(perKeyPerAxis));
	});
	return result;
}
function eachKeyEachAxis(ecModel, cb) {
	var keyed = ecModelCacheFullUpdateInner(getCachePerECFullUpdate(ecModel)).keyed;
	keyed && keyed.each(function(perKey, axisStatKey) {
		perKey.each(function(perKeyPerAxis, axisModelUid) {
			cb(perKeyPerAxis, axisStatKey, axisModelUid);
		});
	});
}
function wrapStatResult(record) {
	return { liPosMinGap: record ? record.liPosMinGap : void 0 };
}
function eachSeriesOnAxis(axis, cb) {
	var ecModel = axis.model.ecModel;
	var seriesOnAxisMap = ecModelCacheFullUpdateInner(getCachePerECFullUpdate(ecModel)).axSer;
	seriesOnAxisMap && eachSeriesDealForAxisStat(ecModel, seriesOnAxisMap.get(axis.model.uid), cb);
}
/**
* NOTE:
*  - series declaration order is respected (some ec option precedence matters, e.g., bar series).
*  - series filtered out are excluded.
*/
function eachSeriesOnAxisOnKey(axis, axisStatKey, cb) {
	var perKeyPerAxis = getAxisStatPerKeyPerAxis(axis, axisStatKey);
	perKeyPerAxis && eachSeriesDealForAxisStat(axis.model.ecModel, perKeyPerAxis.sers, cb);
}
function eachSeriesDealForAxisStat(ecModel, seriesList, cb) {
	if (!seriesList) return;
	for (var i = 0; i < seriesList.length; i++) {
		var seriesModel = seriesList[i];
		if (!ecModel.isSeriesFiltered(seriesModel)) cb(seriesModel);
	}
}
/**
* NOTICE: Available after `CoordinateSystem['create']` (not included).
*
* Query all axes that have at least one associated series (via `associateSeriesWithAxis`)
* by the given key.
*/
function eachAxisOnKey(ecModel, axisStatKey, cb) {
	var keyed = ecModelCacheFullUpdateInner(getCachePerECFullUpdate(ecModel)).keyed;
	var perKey = keyed && keyed.get(axisStatKey);
	perKey && perKey.each(function(perKeyPerAxis) {
		cb(perKeyPerAxis.axis);
	});
}
/**
* NOTICE: Available after `CoordinateSystem['create']` (not included).
*
* Query all `AxisStatKey`s that have at least one associated series (via `associateSeriesWithAxis`)
* by the given axis.
*/
function eachKeyOnAxis(axis, cb) {
	var model = axis.model;
	var keysByAxisModelUid = ecModelCacheFullUpdateInner(getCachePerECFullUpdate(model.ecModel)).keys;
	keysByAxisModelUid && each$1(keysByAxisModelUid.get(model.uid), function(axisStatKey) {
		cb(axisStatKey);
	});
}
/**
* NOTICE: this processor may be omitted - it is registered only if required.
*/
function performAxisStatisticsOnOverallReset(ecModel) {
	var ecPrepareCache = ecModelCachePrepareInner(getCachePerECPrepare(ecModel));
	var ecPrepareCacheKeyed = ecPrepareCache.keyed || (ecPrepareCache.keyed = createHashMap());
	eachKeyEachAxis(ecModel, function(perKeyPerAxis, axisStatKey, axisModelUid) {
		var ecPrepareCachePerKey = ecPrepareCacheKeyed.get(axisStatKey) || ecPrepareCacheKeyed.set(axisStatKey, createHashMap());
		var ecPreparePerKeyPerAxis = ecPrepareCachePerKey.get(axisModelUid) || ecPrepareCachePerKey.set(axisModelUid, {});
		if (perKeyPerAxis.metrics.liPosMinGap) _metricImpl.liPosMinGap(ecModel, perKeyPerAxis, ecPreparePerKeyPerAxis);
	});
}
function registerMetricImpl(metricType, impl) {
	_metricImpl[metricType] = impl;
}
var _metricImpl = {};
/**
* NOTICE:
*  - It must be called in `CoordinateSystem['create']`, before series filtering.
*  - It must be called in `seriesIndex` ascending order (series declaration order).
*    i.e., iterated by `ecModel.eachSeries`.
*  - Every <axis, series> pair can only call this method once.
*
* @see scaleRawExtentInfoCreate in `scaleRawExtentInfo.ts`
*/
function associateSeriesWithAxis(axis, seriesModel, coordSysType) {
	if (!axis) return;
	var ecModel = seriesModel.ecModel;
	var ecFullUpdateCache = ecModelCacheFullUpdateInner(getCachePerECFullUpdate(ecModel));
	var axisModelUid = axis.model.uid;
	var seriesOnAxisMap = ecFullUpdateCache.axSer || (ecFullUpdateCache.axSer = createHashMap());
	(seriesOnAxisMap.get(axisModelUid) || seriesOnAxisMap.set(axisModelUid, [])).push(seriesModel);
	var seriesType = seriesModel.subType;
	var isBaseAxis = seriesModel.getBaseAxis() === axis;
	var client = clientsForLookup.get(makeClientLookupKey(seriesType, isBaseAxis, coordSysType)) || clientsForLookup.get(makeClientLookupKey(seriesType, isBaseAxis, null));
	if (!client) return;
	var keyed = ecFullUpdateCache.keyed || (ecFullUpdateCache.keyed = createHashMap());
	var keys = ecFullUpdateCache.keys || (ecFullUpdateCache.keys = createHashMap());
	var axisStatKey = client.key;
	var perKey = keyed.get(axisStatKey) || keyed.set(axisStatKey, createHashMap());
	var perKeyPerAxis = perKey.get(axisModelUid);
	if (!perKeyPerAxis) {
		perKeyPerAxis = perKey.set(axisModelUid, {
			axis,
			sers: [],
			serByIdx: []
		});
		perKeyPerAxis.metrics = client.getMetrics(axis);
		(keys.get(axisModelUid) || keys.set(axisModelUid, [])).push(axisStatKey);
	}
	perKeyPerAxis.sers.push(seriesModel);
	perKeyPerAxis.serByIdx[seriesModel.seriesIndex] = seriesModel;
}
/**
* NOTE: Currently, the scenario is simple enough to look up clients by hash map.
* Otherwise, a caller-provided `filter` may be an alternative if more complex requirements arise.
*/
function makeClientLookupKey(seriesType, isBaseAxis, coordSysType) {
	return seriesType + "|&" + retrieve2(isBaseAxis, true) + "|&" + (coordSysType || "");
}
/**
* NOTICE: Can only be called in "install" stage.
*
* See `axisSnippets.ts` for some commonly used clients.
*/
function requireAxisStatistics(registers, client) {
	var clientKey = makeClientLookupKey(client.seriesType, client.baseAxis, client.coordSysType);
	clientsForLookup.set(clientKey, client);
	callOnlyOnce(registers, function() {
		registers.registerProcessor(registers.PRIORITY.PROCESSOR.AXIS_STATISTICS, { overallReset: performAxisStatisticsOnOverallReset });
	});
}
var clientsForLookup = createHashMap();
//#endregion
//#region node_modules/echarts/lib/coord/axisBand.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var FALLBACK_BAND_WIDTH_RATIO = .8;
/**
* NOTICE:
*  - Require the axis pixel extent and the scale extent as inputs. But they
*    can be not precise for approximation.
*  - Can only be called after "data processing" stage.
*
* PENDING:
*  Currently `bandWidth` can not be specified by users explicitly. But if we
*  allow that in future, these issues must be considered:
*    - Can only allow specifying a band width in data scale rather than pixel.
*    - LogScale needs to be considered - band width can only be specified on linear
*      (but before break) scale, similar to `axis.interval`.
*
* A band is required on:
*  - series group band width in bar/boxplot/candlestick/...;
*  - tooltip axisPointer type "shadow";
*  - etc.
*/
function calcBandWidth(axis, opt) {
	opt = opt || {};
	var out = {
		w: NaN,
		w2: NaN
	};
	var scale = axis.scale;
	var fromStat = opt.fromStat;
	var min = opt.min;
	var scaleLinearSpan = getScaleLinearSpanForMapping(scale);
	if (!isNullableNumberFinite(scaleLinearSpan)) scaleLinearSpan = NaN;
	var axisExtent = axis.getExtent();
	var pxSpan = mathAbs$2(axisExtent[1] - axisExtent[0]);
	if (isOrdinalScale(scale)) calcBandWidthForCategoryAxis(out, axis, scaleLinearSpan, pxSpan);
	else if (fromStat) calcBandWidthForNumericAxis(out, axis, scaleLinearSpan, pxSpan, fromStat);
	else if (min == null) {}
	if (min != null) out.w = isNullableNumberFinite(out.w) ? mathMax$2(min, out.w) : min;
	return out;
}
function calcBandWidthForCategoryAxis(out, axis, scaleLinearSpan, pxSpan) {
	var onBand = axis.onBand;
	var len = scaleLinearSpan + (onBand ? 1 : 0);
	len === 0 && (len = 1);
	out.w = pxSpan / len;
	if (!onBand && scaleLinearSpan && pxSpan) out.w2 = out.w * scaleLinearSpan / pxSpan;
}
function calcBandWidthForNumericAxis(out, axis, scaleLinearSpan, pxSpan, fromStat) {
	var onlySingular = false;
	var bandWidthInData = -Infinity;
	each$1(fromStat.key ? [getAxisStat(axis, fromStat.key)] : getAxisStatBySeries(axis, fromStat.sers || []), function(stat) {
		var liPosMinGap = stat.liPosMinGap;
		if (liPosMinGap != null) {
			if (liPosMinGap > 0) {
				if (liPosMinGap > bandWidthInData) bandWidthInData = liPosMinGap;
				onlySingular = false;
			} else if (liPosMinGap === -2) onlySingular = true;
		}
	});
	if (isNullableNumberFinite(scaleLinearSpan) && scaleLinearSpan > 0 && isNullableNumberFinite(bandWidthInData)) {
		out.w = pxSpan / scaleLinearSpan * bandWidthInData;
		out.w2 = bandWidthInData;
	} else if (onlySingular) {
		out.w = pxSpan * FALLBACK_BAND_WIDTH_RATIO;
		out.w2 = out.w * scaleLinearSpan / pxSpan;
	}
}
//#endregion
//#region node_modules/echarts/lib/coord/scaleRawExtentInfo.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
/**
* NOTICE: Can be only used in `ensureScaleStore(axisLike)`.
*
* In most cases the instances of `Axis` and `Scale` are one-to-one mapping and share the same lifecycle.
* But in some external usage (such as echarts-gl), axis instance does not necessarily exist, and only
* scale instance and axisModel are used. Therefore we store the internal info on scale instance directly.
*/
var scaleInner = makeInner();
var AXIS_EXTENT_INFO_BUILD_FROM_EMPTY = 3;
var ScaleRawExtentInfo = function() {
	function ScaleRawExtentInfo(scale, model, dataExtent, requireStartValue, requireContainShape) {
		var isOrdinal = isOrdinalScale(scale);
		var axisDataLen = isOrdinal ? model.getCategories().length : null;
		var categoryAxisModelDataIsEmptyArray;
		if (isOrdinal) {
			var axisModelDataArray = model.getCategories(true);
			categoryAxisModelDataIsEmptyArray = axisModelDataArray && !axisModelDataArray.length;
		}
		var dataMM = dataExtent.slice();
		if (isIntervalScale(scale) || isLogScale(scale) || isTimeScale(scale)) {
			unionExtentStartFromNumber(dataMM, parseAxisModelMinMax(scale, model.get("dataMin", true)));
			unionExtentEndFromNumber(dataMM, parseAxisModelMinMax(scale, model.get("dataMax", true)));
		}
		if (!extentHasValue(dataMM)) dataMM[0] = dataMM[1] = NaN;
		var noZoomEffMM = [];
		var fixMM = [false, false];
		var modelMinRaw = model.get("min", true);
		if (modelMinRaw === "dataMin") {
			noZoomEffMM[0] = dataMM[0];
			fixMM[0] = true;
		} else {
			noZoomEffMM[0] = parseAxisModelMinMax(scale, isFunction(modelMinRaw) ? modelMinRaw({
				min: dataMM[0],
				max: dataMM[1]
			}) : modelMinRaw);
			fixMM[0] = noZoomEffMM[0] != null;
		}
		var modelMaxRaw = model.get("max", true);
		if (modelMaxRaw === "dataMax") {
			noZoomEffMM[1] = dataMM[1];
			fixMM[1] = true;
		} else {
			noZoomEffMM[1] = parseAxisModelMinMax(scale, isFunction(modelMaxRaw) ? modelMaxRaw({
				min: dataMM[0],
				max: dataMM[1]
			}) : modelMaxRaw);
			fixMM[1] = noZoomEffMM[1] != null;
		}
		var boundaryGap = parseBoundaryGapOption(scale, model);
		var span = !isOrdinal ? dataMM[1] - dataMM[0] || Math.abs(dataMM[0]) : null;
		if (noZoomEffMM[0] == null) noZoomEffMM[0] = isOrdinal ? categoryAxisModelDataIsEmptyArray ? dataMM[0] : axisDataLen ? 0 : NaN : dataMM[0] - boundaryGap[0] * span;
		if (noZoomEffMM[1] == null) noZoomEffMM[1] = isOrdinal ? categoryAxisModelDataIsEmptyArray ? dataMM[1] : axisDataLen ? axisDataLen - 1 : NaN : dataMM[1] + boundaryGap[1] * span;
		!isValidNumberForExtent(noZoomEffMM[0]) && (noZoomEffMM[0] = NaN);
		!isValidNumberForExtent(noZoomEffMM[1]) && (noZoomEffMM[1] = NaN);
		var isBlank = categoryAxisModelDataIsEmptyArray || eqNaN(noZoomEffMM[0]) || eqNaN(noZoomEffMM[1]) || isOrdinal && !axisDataLen;
		var needIncludeZeroApplicable = isIntervalScale(scale);
		var needIncludeZero = needIncludeZeroApplicable && model.needIncludeZero && model.needIncludeZero();
		if (needIncludeZero) {
			if (noZoomEffMM[0] > 0 && noZoomEffMM[1] > 0 && !fixMM[0]) noZoomEffMM[0] = 0;
			if (noZoomEffMM[0] < 0 && noZoomEffMM[1] < 0 && !fixMM[1]) noZoomEffMM[1] = 0;
		}
		var needToggleAxisInverse = false;
		if (noZoomEffMM[0] > noZoomEffMM[1]) {
			noZoomEffMM.reverse();
			needToggleAxisInverse = true;
		}
		var startValue = parseAxisModelMinMax(scale, model.get("startValue", true));
		var startValueSpecified = startValue != null;
		if (!isNullableNumberFinite(startValue) && requireStartValue) startValue = scale.getDefaultStartValue ? scale.getDefaultStartValue() : 0;
		if (isNullableNumberFinite(startValue) && (startValueSpecified || !needIncludeZeroApplicable || needIncludeZero)) {
			if (startValue < noZoomEffMM[0] && !fixMM[0]) {
				noZoomEffMM[0] = startValue;
				fixMM[0] = true;
			} else if (startValue > noZoomEffMM[1] && !fixMM[1]) {
				noZoomEffMM[1] = startValue;
				fixMM[1] = true;
			}
		}
		sanitizeExtent(this._i = {
			scale,
			dataMM,
			noZoomEffMM,
			zoomMM: [],
			fixMM,
			zoomFixMM: [false, false],
			startValue,
			isBlank,
			incl0: needIncludeZero,
			tggAxInv: needToggleAxisInverse,
			ctnShp: requireContainShape
		}, noZoomEffMM);
	}
	ScaleRawExtentInfo.prototype.makeNoZoom = function() {
		return this._i.noZoomEffMM.slice();
	};
	ScaleRawExtentInfo.prototype.makeFinal = function() {
		var internal = this._i;
		var zoomMM = internal.zoomMM;
		var noZoomEffMM = internal.noZoomEffMM;
		var zoomFixMM = internal.zoomFixMM;
		var fixMM = internal.fixMM;
		var result = {
			fixMM,
			zoomFixMM,
			isBlank: internal.isBlank,
			incl0: internal.incl0,
			tggAxInv: internal.tggAxInv,
			ctnShp: internal.ctnShp,
			effMM: noZoomEffMM.slice()
		};
		var effMM = result.effMM;
		if (zoomMM[0] != null) {
			effMM[0] = zoomMM[0];
			fixMM[0] = zoomFixMM[0] = true;
		}
		if (zoomMM[1] != null) {
			effMM[1] = zoomMM[1];
			fixMM[1] = zoomFixMM[1] = true;
		}
		sanitizeExtent(internal, effMM);
		return result;
	};
	ScaleRawExtentInfo.prototype.makeRenderInfo = function() {
		return { startValue: this._i.startValue };
	};
	/**
	* NOTICE:
	*  - Do not set them if the percent are 0% or 100%. (See `AxisProxy['reset']`.)
	*  - The caller must ensure `start <= end` and the range is equal or less then `noZoomEffMM`.
	*    (See `AxisProxy['calculateDataWindow']`.)
	*  - The outcome `_zoomMM` may have both `NullUndefined` and a finite value, like `[undefined, 123]`.
	*/
	ScaleRawExtentInfo.prototype.setZoomMM = function(idxMinMax, val) {
		this._i.zoomMM[idxMinMax] = val;
	};
	return ScaleRawExtentInfo;
}();
/**
* Should be called when a new extent is created or modified.
*/
function sanitizeExtent(internal, mm) {
	var scale = internal.scale;
	var dataMM = internal.dataMM;
	if (scale.sanitize) {
		mm[0] = scale.sanitize(mm[0], dataMM);
		mm[1] = scale.sanitize(mm[1], dataMM);
		ensureExtentAscSimply(mm);
	}
}
function parseAxisModelMinMax(scale, minMax) {
	return minMax == null ? null : eqNaN(minMax) ? NaN : scale.parse(minMax);
}
function parseBoundaryGapOption(scale, model) {
	var boundaryGapOptionArr;
	if (isOrdinalScale(scale)) boundaryGapOptionArr = [0, 0];
	else {
		var boundaryGap = model.get("boundaryGap");
		if (typeof boundaryGap === "boolean") boundaryGap = null;
		boundaryGapOptionArr = isArray(boundaryGap) ? boundaryGap : [boundaryGap, boundaryGap];
	}
	return [parseBoundaryGapOptionItem(boundaryGapOptionArr[0]), parseBoundaryGapOptionItem(boundaryGapOptionArr[1])];
}
function parseBoundaryGapOptionItem(opt) {
	return parsePercent$1(typeof opt === "boolean" ? 0 : opt, 1) || 0;
}
/**
* NOTE: `associateSeriesWithAxis` is not necessarily called, e.g., when
* an axis is not used by any series.
*/
function ensureScaleStore(axisLike) {
	var store = scaleInner(axisLike.scale);
	if (!store.extent) store.extent = initExtentForUnion();
	return store;
}
/**
* This supports union extent on case like: pie (or other similar series)
* lays out on cartesian2d.
* @see scaleRawExtentInfoCreate
*/
function scaleRawExtentInfoEnableBoxCoordSysUsage(axisLike, coordSysDimIdxMap) {
	ensureScaleStore(axisLike).dimIdxInCoord = coordSysDimIdxMap.get(axisLike.dim);
}
/**
* @usage
*  class SomeCoordSys {
*      static create() {
*          ecModel.eachSeries(function (seriesModel) {
*              associateSeriesWithAxis(axis1, seriesModel, ...);
*              associateSeriesWithAxis(axis2, seriesModel, ...);
*              // ...
*          });
*      }
*      update() {
*          scaleRawExtentInfoCreate(axis1);
*          scaleRawExtentInfoCreate(axis2);
*      }
*  }
*  class AxisProxy {
*      reset() {
*          scaleRawExtentInfoCreate(axis1);
*      }
*  }
*
* NOTICE:
*  - `associateSeriesWithAxis`(in `axisStatistics.ts`) should be called in:
*    - Coord sys create method.
*  - `scaleRawExtentInfoCreate` should be typically called in:
*    - `dataZoom` processor. It requires processing like:
*      1. Filter series data by dataZoom1;
*      2. Union the filtered data and init the extent of the orthogonal axes, which is the 100% of dataZoom2;
*      3. Filter series data by dataZoom2;
*      4. ...
*    - Coord sys update method, for other axes that not covered by `dataZoom`.
*      NOTE: If a `dataZoom` covers this series, this data and its extent has been dataZoom-filtered.
*      Therefore this handling should not before `dataZoom`.
*  - The callback of `min`/`max` in ec option should NOT be called multiple times,
*    therefore, we initialize `ScaleRawExtentInfo` uniformly in `scaleRawExtentInfoCreate`.
*
* @see SCALE_EXTENT_CONSTRUCTION for the full processing flow.
*/
function scaleRawExtentInfoCreate(axis, from) {
	var scale = axis.scale;
	var model = axis.model;
	var axisDim = axis.dim;
	if (scale.rawExtentInfo) return;
	scaleRawExtentInfoCreateDeal(scale, axis, axisDim, model, from);
}
function scaleRawExtentInfoCreateDeal(scale, axis, axisDim, model, from) {
	var scaleStore = ensureScaleStore(axis);
	var extent = scaleStore.extent;
	var requireStartValue = false;
	eachSeriesOnAxis(axis, function(seriesModel) {
		if (seriesModel.boxCoordinateSystem) {
			var coord = getCoordForCoordSysUsageKindBox(seriesModel).coord;
			var dimIdx = scaleStore.dimIdxInCoord;
			if (!(dimIdx >= 0)) {} else if (isArray(coord)) {
				var coordItem = coord[dimIdx];
				if (coordItem != null && !isArray(coordItem)) unionExtentFromNumber(extent, scale.parse(coordItem));
			}
		} else if (seriesModel.coordinateSystem) {
			var data_1 = seriesModel.getData();
			if (data_1) {
				var filter_1 = scale.getFilter ? scale.getFilter() : null;
				each$1(getDataDimensionsOnAxis(data_1, axisDim), function(dim) {
					unionExtentFromExtent(extent, data_1.getApproximateExtent(dim, filter_1));
				});
			}
			if (seriesModel.__requireStartValue && seriesModel.__requireStartValue(axis)) requireStartValue = true;
		}
	});
	var requireContainShape = determineRequireContainShape(scale, axis, model);
	injectScaleRawExtentInfo(scale, new ScaleRawExtentInfo(scale, model, extent, requireStartValue, requireContainShape), from);
	scaleStore.extent = null;
}
/**
* `rawExtentInfo` may not be created in some cases, such as no series declared or extra useless
* axes declared in ec option. In this case we still create a default one for that empty axis.
*/
function scaleRawExtentInfoBuildDefault(axisLike, dataExtent) {
	var scale = axisLike.scale;
	injectScaleRawExtentInfo(scale, new ScaleRawExtentInfo(scale, axisLike.model, dataExtent, false, false), AXIS_EXTENT_INFO_BUILD_FROM_EMPTY);
}
function injectScaleRawExtentInfo(scale, scaleRawExtentInfo, from) {
	scale.rawExtentInfo = scaleRawExtentInfo;
	scaleRawExtentInfo.from = from;
}
/**
* See `axisSnippets.ts` for some commonly used handlers.
*
* FIXME:
*  `boundaryGap: true` (i.e., `onBand: true` in code) has long been supported on category axis.
*  And it is implemented in different code and not merged to this implementation yet.
*/
function registerAxisContainShapeHandler(axisStatKey, handler) {
	axisContainShapeHandlerMap.set(axisStatKey, handler);
}
var axisContainShapeHandlerMap = createHashMap();
/**
* Prepare axis scale extent before "nice".
* Item of returned array can only be number (including Infinity and NaN).
*/
function adoptScaleRawExtentInfoAndPrepare(scale, model, ecModel, axis, externalDataExtent) {
	if (!scale.rawExtentInfo) scaleRawExtentInfoBuildDefault({
		scale,
		model
	}, externalDataExtent || initExtentForUnion());
	var rawExtentResult = scale.rawExtentInfo.makeFinal();
	var effectiveMinMax = rawExtentResult.effMM;
	scale.setExtent(effectiveMinMax[0], effectiveMinMax[1]);
	scale.setBlank(rawExtentResult.isBlank);
	if (axis && rawExtentResult.tggAxInv && ecModel && !ecModel.get("legacyMinMaxDontInverseAxis")) axis.inverse = !axis.inverse;
	return rawExtentResult;
}
function determineRequireContainShape(scale, axis, model) {
	var onBand = isAxisOnBand(scale, model);
	var modelContainShape = model.get("containShape", true);
	if (modelContainShape == null && !onBand) modelContainShape = true;
	if (!modelContainShape) return false;
	var requireContainShape = false;
	eachKeyOnAxis(axis, function(axisStatKey) {
		requireContainShape = !!axisContainShapeHandlerMap.get(axisStatKey) || requireContainShape;
	});
	return requireContainShape;
}
/**
* This implements ec option `someAxis.containShape`. That is, expand scale extent slightly to
* ensure shapes of specific series are fully contained in the axis extent without overflow.
*
* NOTICE:
*  Scale extent (data extent) and axis pixel extent (pixel extent) and are required as inputs.
*    - See BAND_WIDTH_USED_SCALE_LINEAR_SPAN.
*    - Axis pixel extent has been set outside, though it may be modified later (e.g., via `outerBounds`).
*
* @tutorial [AXIS_CONTAIN_SHAPE_PROCESSING_ORDER]
*  This is a trade-off between the following 2 approaches:
*    - Steps: (the current implementation)
*        1. Process `dataZoom` based on a full window `noZoomEffMM`.
*        2. Perform "nice" or "align" scale, where `intervalScaleEnsureValidExtent`-ish may be performed to
*           expand extent to avoid `extent[0] === extent[1]`.
*        3. Calculate linear supplement of containShape based on the final result.
*      Cons:
*        - Abrupt changes occur when zooming away from 0% or 100%.
*        - Edge shapes are clipped in "dataZoom shadow".
*    - Steps: (discarded)
*        1. Calculate linear supplement of containShape based on `noZoomEffMM` and
*           `intervalScaleEnsureValidExtent`-ish.
*        2. Process `dataZoom` based on a full window `noZoomEffMM + linearSupplement`.
*        3. Perform "nice"/"align" scale.
*      Cons:
*        - Input `startValue: 0` (in ec option or action) does not corresponds to `0%`, which is unacceptable.
*        - Not easy to perform `intervalScaleEnsureValidExtent`-ish before "nice"/"align" processing.
*
* @see SCALE_EXTENT_CONSTRUCTION for the full processing flow.
*/
function adoptScaleExtentKindMapping(axis, scale, rawExtentResult, ecModel) {
	if (!rawExtentResult.ctnShp) return;
	var linearSupplement;
	eachKeyOnAxis(axis, function(axisStatKey) {
		var handler = axisContainShapeHandlerMap.get(axisStatKey);
		if (handler) {
			var singleLinearSupplement = handler(axis, ecModel);
			if (singleLinearSupplement) {
				linearSupplement = linearSupplement || [0, 0];
				unionExtentStartFromNumber(linearSupplement, singleLinearSupplement[0]);
				unionExtentEndFromNumber(linearSupplement, singleLinearSupplement[1]);
				discourageOnAxisZero(axis);
			}
		}
	});
	if (!linearSupplement) return;
	var scaleExtent = scale.getExtent();
	if (isOrdinalScale(scale)) {
		if (!axis.onBand) scale.setExtent2(1, mathMin$2(scaleExtent[0], scaleExtent[0] + linearSupplement[0]), mathMax$2(scaleExtent[1], scaleExtent[1] + linearSupplement[1]));
	} else {
		var scaleExtentExpanded = scaleExtent.slice();
		if (!rawExtentResult.zoomFixMM[0]) scaleExtentExpanded[0] = mathMin$2(scaleExtentExpanded[0], scale.transformOut(scale.transformIn(scaleExtentExpanded[0], null) + linearSupplement[0], null));
		if (!rawExtentResult.zoomFixMM[1]) scaleExtentExpanded[1] = mathMax$2(scaleExtentExpanded[1], scale.transformOut(scale.transformIn(scaleExtentExpanded[1], null) + linearSupplement[1], null));
		if (scaleExtentExpanded[0] < scaleExtent[0] || scaleExtentExpanded[1] > scaleExtent[1]) scale.setExtent2(1, scaleExtentExpanded[0], scaleExtentExpanded[1]);
	}
}
//#endregion
//#region node_modules/echarts/lib/util/throttle.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
var ORIGIN_METHOD = "\0__throttleOriginMethod";
var RATE = "\0__throttleRate";
var THROTTLE_TYPE = "\0__throttleType";
/**
* @public
* @param {(Function)} fn
* @param {number} [delay=0] Unit: ms.
* @param {boolean} [debounce=false]
*        true: If call interval less than `delay`, only the last call works.
*        false: If call interval less than `delay, call works on fixed rate.
* @return {(Function)} throttled fn.
*/
function throttle(fn, delay, debounce) {
	var currCall;
	var lastCall = 0;
	var lastExec = 0;
	var timer = null;
	var diff;
	var scope;
	var args;
	var debounceNextCall;
	delay = delay || 0;
	function exec() {
		lastExec = (/* @__PURE__ */ new Date()).getTime();
		timer = null;
		fn.apply(scope, args || []);
	}
	var cb = function() {
		var cbArgs = [];
		for (var _i = 0; _i < arguments.length; _i++) cbArgs[_i] = arguments[_i];
		currCall = (/* @__PURE__ */ new Date()).getTime();
		scope = this;
		args = cbArgs;
		var thisDelay = debounceNextCall || delay;
		var thisDebounce = debounceNextCall || debounce;
		debounceNextCall = null;
		diff = currCall - (thisDebounce ? lastCall : lastExec) - thisDelay;
		clearTimeout(timer);
		if (thisDebounce) timer = setTimeout(exec, thisDelay);
		else if (diff >= 0) exec();
		else timer = setTimeout(exec, -diff);
		lastCall = currCall;
	};
	/**
	* Clear throttle.
	* @public
	*/
	cb.clear = function() {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
	};
	/**
	* Enable debounce once.
	*/
	cb.debounceNextCall = function(debounceDelay) {
		debounceNextCall = debounceDelay;
	};
	return cb;
}
/**
* Create throttle method or update throttle rate.
*
* @example
* ComponentView.prototype.render = function () {
*     ...
*     throttle.createOrUpdate(
*         this,
*         '_dispatchAction',
*         this.model.get('throttle'),
*         'fixRate'
*     );
* };
* ComponentView.prototype.remove = function () {
*     throttle.clear(this, '_dispatchAction');
* };
* ComponentView.prototype.dispose = function () {
*     throttle.clear(this, '_dispatchAction');
* };
*
*/
function createOrUpdate(obj, fnAttr, rate, throttleType) {
	var fn = obj[fnAttr];
	if (!fn) return;
	var originFn = fn[ORIGIN_METHOD] || fn;
	var lastThrottleType = fn[THROTTLE_TYPE];
	if (fn[RATE] !== rate || lastThrottleType !== throttleType) {
		if (rate == null || !throttleType) return obj[fnAttr] = originFn;
		fn = obj[fnAttr] = throttle(originFn, rate, throttleType === "debounce");
		fn[ORIGIN_METHOD] = originFn;
		fn[THROTTLE_TYPE] = throttleType;
		fn[RATE] = rate;
	}
	return fn;
}
/**
* Clear throttle. Example see throttle.createOrUpdate.
*/
function clear(obj, fnAttr) {
	var fn = obj[fnAttr];
	if (fn && fn[ORIGIN_METHOD]) {
		fn.clear && fn.clear();
		obj[fnAttr] = fn[ORIGIN_METHOD];
	}
}
//#endregion
//#region node_modules/echarts/lib/legacy/dataSelectAction.js
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
function createLegacyDataSelectAction(seriesType, ecRegisterAction) {
	function getSeriesIndices(ecModel, payload) {
		var seriesIndices = [];
		ecModel.eachComponent({
			mainType: "series",
			subType: seriesType,
			query: payload
		}, function(seriesModel) {
			seriesIndices.push(seriesModel.seriesIndex);
		});
		return seriesIndices;
	}
	each$1([
		[seriesType + "ToggleSelect", "toggleSelect"],
		[seriesType + "Select", "select"],
		[seriesType + "UnSelect", "unselect"]
	], function(eventsMap) {
		ecRegisterAction(eventsMap[0], function(payload, ecModel, api) {
			payload = extend({}, payload);
			api.dispatchAction(extend(payload, {
				type: eventsMap[1],
				seriesIndex: getSeriesIndices(ecModel, payload)
			}));
		});
	});
}
function handleSeriesLegacySelectEvents(type, eventPostfix, ecIns, ecModel, payload) {
	var legacyEventName = type + eventPostfix;
	if (!ecIns.isSilent(legacyEventName)) ecModel.eachComponent({
		mainType: "series",
		subType: "pie"
	}, function(seriesModel) {
		var seriesIndex = seriesModel.seriesIndex;
		var selectedMap = seriesModel.option.selectedMap;
		var selected = payload.selected;
		for (var i = 0; i < selected.length; i++) if (selected[i].seriesIndex === seriesIndex) {
			var data = seriesModel.getData();
			var dataIndex = queryDataIndex(data, payload.fromActionPayload);
			ecIns.trigger(legacyEventName, {
				type: legacyEventName,
				seriesId: seriesModel.id,
				name: isArray(dataIndex) ? data.getName(dataIndex[0]) : data.getName(dataIndex),
				selected: isString(selectedMap) ? selectedMap : extend({}, selectedMap)
			});
		}
	});
}
function handleLegacySelectEvents(messageCenter, ecIns, api) {
	messageCenter.on("selectchanged", function(params) {
		var ecModel = api.getModel();
		if (params.isFromClick) {
			handleSeriesLegacySelectEvents("map", "selectchanged", ecIns, ecModel, params);
			handleSeriesLegacySelectEvents("pie", "selectchanged", ecIns, ecModel, params);
		} else if (params.fromAction === "select") {
			handleSeriesLegacySelectEvents("map", "selected", ecIns, ecModel, params);
			handleSeriesLegacySelectEvents("pie", "selected", ecIns, ecModel, params);
		} else if (params.fromAction === "unselect") {
			handleSeriesLegacySelectEvents("map", "unselected", ecIns, ecModel, params);
			handleSeriesLegacySelectEvents("pie", "unselected", ecIns, ecModel, params);
		}
	});
}
//#endregion
export { createSymbol as $, parsePercent as $i, IncrementalDisplayable as $n, SINGLE_REFERRING as $r, CtorInt32Array as $t, isAxisOnBand as A, MAX_SAFE_INTEGER as Ai, extendPath as An, getAllSelectedIndices as Ar, getScaleBreakHelper as At, getIntervalPrecision as B, isNullableNumberFinite as Bi, registerShape as Bn, setStatesFlag as Br, getUID as Bt, createAxisLabelsComputingContext as C, queryReferringComponents as Ci, applyTransform as Cn, blurComponent as Cr, formatTime as Ct, getAxisRawValue as D, unionExtentFromNumber as Di, ensureCopyRect as Dn, enterEmphasis as Dr, toCamelCase as Dt, determineAxisType as E, setComponentTypeToKeyInfo as Ei, createIcon as En, enterBlur as Er, normalizeCssArray as Et, shouldShowAllLabels as F, getPercentSeats as Fi, groupTransition as Fn, isSelectChangePayload as Fr, encodeHTML as Ft, isLogScale as G, mathCeil as Gi, traverseElements as Gn, ExtensionAPI as Gr, CoordinateSystemManager as Gt, intervalScaleEnsureValidExtent as H, isRadianAroundZero as Hi, retrieveZInfo as Hn, toggleHoverEmphasis as Hr, enableDataStack as Ht, updateIntervalOrLogScaleForNiceOrAligned as I, getPercentWithPrecision as Ii, isBoundingRectAxisAligned as In, leaveBlur as Ir, isCanvasEl as It, getScaleExtentForMappingUnsafe as J, mathMin$2 as Ji, isElementRemoved as Jn, SOURCE_FORMAT_TYPED_ARRAY as Jr, SeriesDataSchema as Jt, isOrdinalScale as K, mathFloor as Ki, traverseUpdateZ as Kn, COMPONENT_MAIN_TYPE_SERIES as Kr, injectCoordSysByOption as Kt, AXIS_TYPES as L, getPixelPrecision as Li, makeImage as Ln, leaveEmphasis as Lr, transformCoordWithViewport as Lt, isOnAxisZeroDiscouraged as M, asc as Mi, getShapeClass as Mn, handleGlobalMouseOverForHighDown as Mr, SYSTEM_LANG as Mt, retrieveAxisBreaksOption as N, getAcceptableTickPrecision as Ni, getTransform as Nn, isHighDownDispatcher as Nr, createLocaleObject as Nt, getScaleValuePositionKind as O, deprecateLog as Oi, ensureCopyTransform as On, enterSelect as Or, format as Ot, shouldAxisShow as P, getLeastCommonMultiple as Pi, graphic_exports as Pn, isHighDownPayload as Pr, registerLocale as Pt, createRenderPlanner as Q, parseDate as Qi, updateProps as Qn, setCommonECData as Qr, shouldOmitUnusedDimensions as Qt, calcNiceForTimeScale as R, getPrecision as Ri, makePath as Rn, leaveSelect as Rr, transformLocalCoord as Rt, createAxisLabels as S, queryDataIndex as Si, XY as Sn, allLeaveBlur as Sr, convertToColorString as St, createScaleByModel as T, setAttribute as Ti, clipRectByRect as Tn, enableHoverEmphasis as Tr, getTooltipMarker as Tt, isIntervalOrLogScale as U, linearMap as Ui, setTooltipConfig as Un, toggleSelectionFromPayload as Ur, getStackedDimension as Ut, increaseInterval as V, isNumeric as Vi, resizePath as Vn, setStatesStylesFromModel as Vr, inheritDefaultOption as Vt, isIntervalScale as W, mathAbs$2 as Wi, subPixelOptimizeLine as Wn, updateSeriesElementSelection as Wr, isDimensionStacked as Wt, OrdinalMeta as X, nice as Xi, removeElementWithFadeOut as Xn, VISUAL_DIMENSIONS as Xr, ensureSourceDimNameMap as Xt, getScaleLinearSpanEffective as Y, mathRound as Yi, removeElement as Yn, UNDEFINED_STR as Yr, createDimNameMap as Yt, ChartView as Z, numericToNumber as Zi, saveOldStyle as Zn, getECData as Zr, isSeriesDataSchema as Zt, requireAxisStatistics as _, mappingToExists as _i, getLabelStatesModels as _n, SELECT_ACTION_TYPE as _r, getLayoutParams as _t, throttle as a, remRadian as aa, getAttribute as ai, createSourceFromSeriesDataOption as an, BezierCurve as ar, createTooltipMarkup as at, AxisTickLabelComputingKind as b, preParseFinder as bi, setLabelValueAnimation as bn, TOGGLE_SELECT_ACTION_TYPE as br, addCommas as bt, registerAxisContainShapeHandler as c, ZRText as ca, getTooltipRenderMode as ci, guessOrdinal as cn, Polygon as cr, registerExternalTransform as ct, calcBandWidth as d, enableClassExtend as da, isComponentIdInternal as di, resetSourceDefaulter as dn, Ellipse as dr, PaletteMixin as dt, parsePositionSizeOption as ea, TEXT_STYLE_OPTIONS as ei, DataStore as en, OrientedBoundingRect as er, normalizeSymbolOffset as et, associateSeriesWithAxis as f, enableClassManagement as fa, isDataItemOption as fi, Model as fn, Circle as fr, ComponentModel as ft, registerMetricImpl as g, makeQueryConditionKindA as gi, createTextStyle as gn, HIGHLIGHT_ACTION_TYPE as gr, getCircleLayout as gt, eachSeriesOnAxisOnKey as h, makeInner as hi, LabelMarginType as hn, DOWNPLAY_ACTION_TYPE as hr, fetchLayoutMode as ht, createOrUpdate as i, reformIntervals as ia, defaultEmphasis as ii, retrieveRawValue as in, Arc as ir, buildTooltipMarkup as it, isNameLocationCenter as j, addSafe as ji, extendShape as jn, handleGlobalMouseOutForHighDown as jr, hasBreaks as jt, getTickValueOutermost as k, throwError as ki, expandOrShrinkRect as kn, findComponentHighDownDispatchers as kr, roundTime as kt, scaleRawExtentInfoCreate as l, Rect as la, initExtentForUnion as li, makeSeriesEncodeForAxisCoordSys as ln, Ring as lr, createTask as lt, eachSeriesDealForAxisStat as m, makeCallOnlyOnce as mi, LINE_STYLE_KEY_MAP as mn, DISPLAY_STATES as mr, createBoxLayoutReference as mt, handleLegacySelectEvents as n, quantity as na, createSimpleOverallStageHandler as ni, passesSanitizationFilter as nn, LinearGradient as nr, SeriesModel as nt, adoptScaleExtentKindMapping as o, round as oa, getDataItemValue as oi, isSourceInstance as on, Line as or, getPaddingFromTooltipModel as ot, eachAxisOnKey as p, parseClassType as pa, isNameSpecified as pi, ITEM_STYLE_KEY_MAP as pn, Group as pr, box as pt, isTimeScale as q, mathMax$2 as qi, initProps as qn, SOURCE_FORMAT_ORIGINAL as qr, registerLayOutOnCoordSysUsage as qt, clear as r, quantityExponent as ra, createSimpleOverallStageHandler2 as ri, DefaultDataProvider as rn, CompoundPath as rr, TooltipMarkupStyleCreator as rt, adoptScaleRawExtentInfoAndPrepare as s, roundLegacy as sa, getIncrementalId as si, BE_ORDINAL as sn, Polyline as sr, tokens as st, createLegacyDataSelectAction as t, quantile as ta, convertOptionIdName as ti, parseSanitizationFilter as tn, RadialGradient as tr, normalizeSymbolSize as tt, scaleRawExtentInfoEnableBoxCoordSysUsage as u, makeStyleMapper as ua, interpolateRawValues as ui, makeSeriesEncodeForNameBased as un, Sector as ur, normalizeTooltipFormatResult as ut, resetCachePerECFullUpdate as v, normalizeToArray as vi, labelInner as vn, SELECT_CHANGED_EVENT_TYPE as vr, getLayoutRect as vt, createAxisTicks as w, removeDuplicates as wi, clipPointsByRect as wn, blurSeriesFromHighlightPayload as wr, formatTpl as wt, calculateCategoryInterval as x, preparePipelineContext as xi, WH as xn, UNSELECT_ACTION_TYPE as xr, capitalFirst as xt, resetCachePerECPrepare as y, parseFinder as yi, setLabelStyle as yn, SPECIAL_STATES as yr, mergeLayoutParam as yt, ensureValidSplitNumber as z, getPrecisionSafe as zi, mergePath as zn, savePathStates as zr, transformLocalCoordClear as zt };
