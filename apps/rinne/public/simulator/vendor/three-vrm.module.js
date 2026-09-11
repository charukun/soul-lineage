/*!
 * @pixiv/three-vrm v3.5.5
 * VRM file loader for three.js.
 *
 * Copyright (c) 2019-2026 pixiv Inc.
 * @pixiv/three-vrm is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 */
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// ../three-vrm-core/lib/three-vrm-core.module.js
import * as THREE from "./three.js";
import * as THREE4 from "./three.js";
import * as THREE2 from "./three.js";
import * as THREE3 from "./three.js";
import * as THREE5 from "./three.js";
import * as THREE6 from "./three.js";
import * as THREE7 from "./three.js";
import * as THREE8 from "./three.js";
import * as THREE11 from "./three.js";
import * as THREE9 from "./three.js";
import * as THREE10 from "./three.js";
import * as THREE13 from "./three.js";
import * as THREE12 from "./three.js";
import * as THREE14 from "./three.js";
import * as THREE15 from "./three.js";
import * as THREE16 from "./three.js";
var __async2 = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
var VRMExpression = class extends THREE.Object3D {
  constructor(expressionName) {
    super();
    this.weight = 0;
    this.isBinary = false;
    this.overrideBlink = "none";
    this.overrideLookAt = "none";
    this.overrideMouth = "none";
    this._binds = [];
    this.name = `VRMExpression_${expressionName}`;
    this.expressionName = expressionName;
    this.type = "VRMExpression";
    this.visible = false;
  }
  /**
   * Binds that this expression influences.
   */
  get binds() {
    return this._binds;
  }
  /**
   * A value represents how much it should override blink expressions.
   * `0.0` == no override at all, `1.0` == completely block the expressions.
   */
  get overrideBlinkAmount() {
    if (this.overrideBlink === "block") {
      return 0 < this.outputWeight ? 1 : 0;
    } else if (this.overrideBlink === "blend") {
      return this.outputWeight;
    } else {
      return 0;
    }
  }
  /**
   * A value represents how much it should override lookAt expressions.
   * `0.0` == no override at all, `1.0` == completely block the expressions.
   */
  get overrideLookAtAmount() {
    if (this.overrideLookAt === "block") {
      return 0 < this.outputWeight ? 1 : 0;
    } else if (this.overrideLookAt === "blend") {
      return this.outputWeight;
    } else {
      return 0;
    }
  }
  /**
   * A value represents how much it should override mouth expressions.
   * `0.0` == no override at all, `1.0` == completely block the expressions.
   */
  get overrideMouthAmount() {
    if (this.overrideMouth === "block") {
      return 0 < this.outputWeight ? 1 : 0;
    } else if (this.overrideMouth === "blend") {
      return this.outputWeight;
    } else {
      return 0;
    }
  }
  /**
   * An output weight of this expression, considering the {@link isBinary}.
   */
  get outputWeight() {
    if (this.isBinary) {
      return this.weight > 0.5 ? 1 : 0;
    }
    return this.weight;
  }
  /**
   * Add an expression bind to the expression.
   *
   * @param bind A bind to add
   */
  addBind(bind) {
    this._binds.push(bind);
  }
  /**
   * Delete an expression bind from the expression.
   *
   * @param bind A bind to delete
   */
  deleteBind(bind) {
    const index = this._binds.indexOf(bind);
    if (index >= 0) {
      this._binds.splice(index, 1);
    }
  }
  /**
   * Apply weight to every assigned blend shapes.
   * Should be called every frame.
   */
  applyWeight(options) {
    var _a;
    let actualWeight = this.outputWeight;
    actualWeight *= (_a = options == null ? void 0 : options.multiplier) != null ? _a : 1;
    if (this.isBinary && actualWeight < 1) {
      actualWeight = 0;
    }
    this._binds.forEach((bind) => bind.applyWeight(actualWeight));
  }
  /**
   * Clear previously assigned blend shapes.
   */
  clearAppliedWeight() {
    this._binds.forEach((bind) => bind.clearAppliedWeight());
  }
};
function extractPrimitivesInternal(gltf, nodeIndex, node) {
  var _a, _b;
  const json = gltf.parser.json;
  const schemaNode = (_a = json.nodes) == null ? void 0 : _a[nodeIndex];
  if (schemaNode == null) {
    console.warn(`extractPrimitivesInternal: Attempt to use nodes[${nodeIndex}] of glTF but the node doesn't exist`);
    return null;
  }
  const meshIndex = schemaNode.mesh;
  if (meshIndex == null) {
    return null;
  }
  const schemaMesh = (_b = json.meshes) == null ? void 0 : _b[meshIndex];
  if (schemaMesh == null) {
    console.warn(`extractPrimitivesInternal: Attempt to use meshes[${meshIndex}] of glTF but the mesh doesn't exist`);
    return null;
  }
  const primitiveCount = schemaMesh.primitives.length;
  const primitives = [];
  node.traverse((object) => {
    if (primitives.length < primitiveCount) {
      if (object.isMesh) {
        primitives.push(object);
      }
    }
  });
  return primitives;
}
function gltfExtractPrimitivesFromNode(gltf, nodeIndex) {
  return __async2(this, null, function* () {
    const node = yield gltf.parser.getDependency("node", nodeIndex);
    return extractPrimitivesInternal(gltf, nodeIndex, node);
  });
}
function gltfExtractPrimitivesFromNodes(gltf) {
  return __async2(this, null, function* () {
    const nodes = yield gltf.parser.getDependencies("node");
    const map = /* @__PURE__ */ new Map();
    nodes.forEach((node, index) => {
      const result = extractPrimitivesInternal(gltf, index, node);
      if (result != null) {
        map.set(index, result);
      }
    });
    return map;
  });
}
var VRMExpressionPresetName = {
  Aa: "aa",
  Ih: "ih",
  Ou: "ou",
  Ee: "ee",
  Oh: "oh",
  Blink: "blink",
  Happy: "happy",
  Angry: "angry",
  Sad: "sad",
  Relaxed: "relaxed",
  LookUp: "lookUp",
  Surprised: "surprised",
  LookDown: "lookDown",
  LookLeft: "lookLeft",
  LookRight: "lookRight",
  BlinkLeft: "blinkLeft",
  BlinkRight: "blinkRight",
  Neutral: "neutral"
};
function saturate(value) {
  return Math.max(Math.min(value, 1), 0);
}
var VRMExpressionManager = class _VRMExpressionManager {
  /**
   * Create a new {@link VRMExpressionManager}.
   */
  constructor() {
    this.blinkExpressionNames = ["blink", "blinkLeft", "blinkRight"];
    this.lookAtExpressionNames = ["lookLeft", "lookRight", "lookUp", "lookDown"];
    this.mouthExpressionNames = ["aa", "ee", "ih", "oh", "ou"];
    this._expressions = [];
    this._expressionMap = {};
  }
  get expressions() {
    return this._expressions.concat();
  }
  get expressionMap() {
    return Object.assign({}, this._expressionMap);
  }
  /**
   * A map from name to expression, but excluding custom expressions.
   */
  get presetExpressionMap() {
    const result = {};
    const presetNameSet = new Set(Object.values(VRMExpressionPresetName));
    Object.entries(this._expressionMap).forEach(([name, expression]) => {
      if (presetNameSet.has(name)) {
        result[name] = expression;
      }
    });
    return result;
  }
  /**
   * A map from name to expression, but excluding preset expressions.
   */
  get customExpressionMap() {
    const result = {};
    const presetNameSet = new Set(Object.values(VRMExpressionPresetName));
    Object.entries(this._expressionMap).forEach(([name, expression]) => {
      if (!presetNameSet.has(name)) {
        result[name] = expression;
      }
    });
    return result;
  }
  /**
   * Copy the given {@link VRMExpressionManager} into this one.
   * @param source The {@link VRMExpressionManager} you want to copy
   * @returns this
   */
  copy(source) {
    const expressions = this._expressions.concat();
    expressions.forEach((expression) => {
      this.unregisterExpression(expression);
    });
    source._expressions.forEach((expression) => {
      this.registerExpression(expression);
    });
    this.blinkExpressionNames = source.blinkExpressionNames.concat();
    this.lookAtExpressionNames = source.lookAtExpressionNames.concat();
    this.mouthExpressionNames = source.mouthExpressionNames.concat();
    return this;
  }
  /**
   * Returns a clone of this {@link VRMExpressionManager}.
   * @returns Copied {@link VRMExpressionManager}
   */
  clone() {
    return new _VRMExpressionManager().copy(this);
  }
  /**
   * Return a registered expression.
   * If it cannot find an expression, it will return `null` instead.
   *
   * @param name Name or preset name of the expression
   */
  getExpression(name) {
    var _a;
    return (_a = this._expressionMap[name]) != null ? _a : null;
  }
  /**
   * Register an expression.
   *
   * @param expression {@link VRMExpression} that describes the expression
   */
  registerExpression(expression) {
    this._expressions.push(expression);
    this._expressionMap[expression.expressionName] = expression;
  }
  /**
   * Unregister an expression.
   *
   * @param expression The expression you want to unregister
   */
  unregisterExpression(expression) {
    const index = this._expressions.indexOf(expression);
    if (index === -1) {
      console.warn("VRMExpressionManager: The specified expressions is not registered");
    }
    this._expressions.splice(index, 1);
    delete this._expressionMap[expression.expressionName];
  }
  /**
   * Get the current weight of the specified expression.
   * If it doesn't have an expression of given name, it will return `null` instead.
   *
   * @param name Name of the expression
   */
  getValue(name) {
    var _a;
    const expression = this.getExpression(name);
    return (_a = expression == null ? void 0 : expression.weight) != null ? _a : null;
  }
  /**
   * Set a weight to the specified expression.
   *
   * @param name Name of the expression
   * @param weight Weight
   */
  setValue(name, weight) {
    const expression = this.getExpression(name);
    if (expression) {
      expression.weight = saturate(weight);
    }
  }
  /**
   * Reset weights of all expressions to `0.0`.
   */
  resetValues() {
    this._expressions.forEach((expression) => {
      expression.weight = 0;
    });
  }
  /**
   * Get a track name of specified expression.
   * This track name is needed to manipulate its expression via keyframe animations.
   *
   * @example Manipulate an expression using keyframe animation
   * ```js
   * const trackName = vrm.expressionManager.getExpressionTrackName( 'blink' );
   * const track = new THREE.NumberKeyframeTrack(
   *   name,
   *   [ 0.0, 0.5, 1.0 ], // times
   *   [ 0.0, 1.0, 0.0 ] // values
   * );
   *
   * const clip = new THREE.AnimationClip(
   *   'blink', // name
   *   1.0, // duration
   *   [ track ] // tracks
   * );
   *
   * const mixer = new THREE.AnimationMixer( vrm.scene );
   * const action = mixer.clipAction( clip );
   * action.play();
   * ```
   *
   * @param name Name of the expression
   */
  getExpressionTrackName(name) {
    const expression = this.getExpression(name);
    return expression ? `${expression.name}.weight` : null;
  }
  /**
   * Update every expressions.
   */
  update() {
    const weightMultipliers = this._calculateWeightMultipliers();
    this._expressions.forEach((expression) => {
      expression.clearAppliedWeight();
    });
    this._expressions.forEach((expression) => {
      let multiplier = 1;
      const name = expression.expressionName;
      if (this.blinkExpressionNames.indexOf(name) !== -1) {
        multiplier *= weightMultipliers.blink;
      }
      if (this.lookAtExpressionNames.indexOf(name) !== -1) {
        multiplier *= weightMultipliers.lookAt;
      }
      if (this.mouthExpressionNames.indexOf(name) !== -1) {
        multiplier *= weightMultipliers.mouth;
      }
      expression.applyWeight({ multiplier });
    });
  }
  /**
   * Calculate sum of override amounts to see how much we should multiply weights of certain expressions.
   */
  _calculateWeightMultipliers() {
    let blink = 1;
    let lookAt = 1;
    let mouth = 1;
    this._expressions.forEach((expression) => {
      blink -= expression.overrideBlinkAmount;
      lookAt -= expression.overrideLookAtAmount;
      mouth -= expression.overrideMouthAmount;
    });
    blink = Math.max(0, blink);
    lookAt = Math.max(0, lookAt);
    mouth = Math.max(0, mouth);
    return { blink, lookAt, mouth };
  }
};
var VRMExpressionMaterialColorType = {
  Color: "color",
  EmissionColor: "emissionColor",
  ShadeColor: "shadeColor",
  MatcapColor: "matcapColor",
  RimColor: "rimColor",
  OutlineColor: "outlineColor"
};
var v0ExpressionMaterialColorMap = {
  _Color: VRMExpressionMaterialColorType.Color,
  _EmissionColor: VRMExpressionMaterialColorType.EmissionColor,
  _ShadeColor: VRMExpressionMaterialColorType.ShadeColor,
  _RimColor: VRMExpressionMaterialColorType.RimColor,
  _OutlineColor: VRMExpressionMaterialColorType.OutlineColor
};
var _color = new THREE2.Color();
var _VRMExpressionMaterialColorBind = class _VRMExpressionMaterialColorBind2 {
  constructor({
    material,
    type,
    targetValue,
    targetAlpha
  }) {
    this.material = material;
    this.type = type;
    this.targetValue = targetValue;
    this.targetAlpha = targetAlpha != null ? targetAlpha : 1;
    const color = this._initColorBindState();
    const alpha = this._initAlphaBindState();
    this._state = { color, alpha };
  }
  applyWeight(weight) {
    const { color, alpha } = this._state;
    if (color != null) {
      const { propertyName, deltaValue } = color;
      const target = this.material[propertyName];
      if (target != void 0) {
        target.add(_color.copy(deltaValue).multiplyScalar(weight));
      }
    }
    if (alpha != null) {
      const { propertyName, deltaValue } = alpha;
      const target = this.material[propertyName];
      if (target != void 0) {
        this.material[propertyName] += deltaValue * weight;
      }
    }
  }
  clearAppliedWeight() {
    const { color, alpha } = this._state;
    if (color != null) {
      const { propertyName, initialValue } = color;
      const target = this.material[propertyName];
      if (target != void 0) {
        target.copy(initialValue);
      }
    }
    if (alpha != null) {
      const { propertyName, initialValue } = alpha;
      const target = this.material[propertyName];
      if (target != void 0) {
        this.material[propertyName] = initialValue;
      }
    }
  }
  _initColorBindState() {
    var _a, _b, _c;
    const { material, type, targetValue } = this;
    const propertyNameMap = this._getPropertyNameMap();
    const propertyName = (_b = (_a = propertyNameMap == null ? void 0 : propertyNameMap[type]) == null ? void 0 : _a[0]) != null ? _b : null;
    if (propertyName == null) {
      console.warn(
        `Tried to add a material color bind to the material ${(_c = material.name) != null ? _c : "(no name)"}, the type ${type} but the material or the type is not supported.`
      );
      return null;
    }
    const target = material[propertyName];
    const initialValue = target.clone();
    const deltaValue = new THREE2.Color(
      targetValue.r - initialValue.r,
      targetValue.g - initialValue.g,
      targetValue.b - initialValue.b
    );
    return { propertyName, initialValue, deltaValue };
  }
  _initAlphaBindState() {
    var _a, _b, _c;
    const { material, type, targetAlpha } = this;
    const propertyNameMap = this._getPropertyNameMap();
    const propertyName = (_b = (_a = propertyNameMap == null ? void 0 : propertyNameMap[type]) == null ? void 0 : _a[1]) != null ? _b : null;
    if (propertyName == null && targetAlpha !== 1) {
      console.warn(
        `Tried to add a material alpha bind to the material ${(_c = material.name) != null ? _c : "(no name)"}, the type ${type} but the material or the type does not support alpha.`
      );
      return null;
    }
    if (propertyName == null) {
      return null;
    }
    const initialValue = material[propertyName];
    const deltaValue = targetAlpha - initialValue;
    return { propertyName, initialValue, deltaValue };
  }
  _getPropertyNameMap() {
    var _a, _b;
    return (_b = (_a = Object.entries(_VRMExpressionMaterialColorBind2._propertyNameMapMap).find(([distinguisher]) => {
      return this.material[distinguisher] === true;
    })) == null ? void 0 : _a[1]) != null ? _b : null;
  }
};
_VRMExpressionMaterialColorBind._propertyNameMapMap = {
  isMeshStandardMaterial: {
    color: ["color", "opacity"],
    emissionColor: ["emissive", null]
  },
  isMeshBasicMaterial: {
    color: ["color", "opacity"]
  },
  isMToonMaterial: {
    color: ["color", "opacity"],
    emissionColor: ["emissive", null],
    outlineColor: ["outlineColorFactor", null],
    matcapColor: ["matcapFactor", null],
    rimColor: ["parametricRimColorFactor", null],
    shadeColor: ["shadeColorFactor", null]
  }
};
var VRMExpressionMaterialColorBind = _VRMExpressionMaterialColorBind;
var VRMExpressionMorphTargetBind = class {
  constructor({
    primitives,
    index,
    weight
  }) {
    this.primitives = primitives;
    this.index = index;
    this.weight = weight;
  }
  applyWeight(weight) {
    this.primitives.forEach((mesh) => {
      var _a;
      if (((_a = mesh.morphTargetInfluences) == null ? void 0 : _a[this.index]) != null) {
        mesh.morphTargetInfluences[this.index] += this.weight * weight;
      }
    });
  }
  clearAppliedWeight() {
    this.primitives.forEach((mesh) => {
      var _a;
      if (((_a = mesh.morphTargetInfluences) == null ? void 0 : _a[this.index]) != null) {
        mesh.morphTargetInfluences[this.index] = 0;
      }
    });
  }
};
var _v2 = new THREE3.Vector2();
var _VRMExpressionTextureTransformBind = class _VRMExpressionTextureTransformBind2 {
  constructor({
    material,
    scale,
    offset
  }) {
    var _a, _b;
    this.material = material;
    this.scale = scale;
    this.offset = offset;
    const propertyNames = (_a = Object.entries(_VRMExpressionTextureTransformBind2._propertyNamesMap).find(
      ([distinguisher]) => {
        return material[distinguisher] === true;
      }
    )) == null ? void 0 : _a[1];
    if (propertyNames == null) {
      console.warn(
        `Tried to add a texture transform bind to the material ${(_b = material.name) != null ? _b : "(no name)"} but the material is not supported.`
      );
      this._properties = [];
    } else {
      this._properties = [];
      propertyNames.forEach((propertyName) => {
        var _a2;
        const texture = (_a2 = material[propertyName]) == null ? void 0 : _a2.clone();
        if (!texture) {
          return null;
        }
        material[propertyName] = texture;
        const initialOffset = texture.offset.clone();
        const initialScale = texture.repeat.clone();
        const deltaOffset = offset.clone().sub(initialOffset);
        const deltaScale = scale.clone().sub(initialScale);
        this._properties.push({
          name: propertyName,
          initialOffset,
          deltaOffset,
          initialScale,
          deltaScale
        });
      });
    }
  }
  applyWeight(weight) {
    this._properties.forEach((property) => {
      const target = this.material[property.name];
      if (target === void 0) {
        return;
      }
      target.offset.add(_v2.copy(property.deltaOffset).multiplyScalar(weight));
      target.repeat.add(_v2.copy(property.deltaScale).multiplyScalar(weight));
    });
  }
  clearAppliedWeight() {
    this._properties.forEach((property) => {
      const target = this.material[property.name];
      if (target === void 0) {
        return;
      }
      target.offset.copy(property.initialOffset);
      target.repeat.copy(property.initialScale);
    });
  }
};
_VRMExpressionTextureTransformBind._propertyNamesMap = {
  isMeshStandardMaterial: [
    "map",
    "emissiveMap",
    "bumpMap",
    "normalMap",
    "displacementMap",
    "roughnessMap",
    "metalnessMap",
    "alphaMap"
  ],
  isMeshBasicMaterial: ["map", "specularMap", "alphaMap"],
  isMToonMaterial: [
    "map",
    "normalMap",
    "emissiveMap",
    "shadeMultiplyTexture",
    "rimMultiplyTexture",
    "outlineWidthMultiplyTexture",
    "uvAnimationMaskTexture"
  ]
};
var VRMExpressionTextureTransformBind = _VRMExpressionTextureTransformBind;
var POSSIBLE_SPEC_VERSIONS = /* @__PURE__ */ new Set(["1.0", "1.0-beta"]);
var _VRMExpressionLoaderPlugin = class _VRMExpressionLoaderPlugin2 {
  get name() {
    return "VRMExpressionLoaderPlugin";
  }
  constructor(parser) {
    this.parser = parser;
  }
  afterRoot(gltf) {
    return __async2(this, null, function* () {
      gltf.userData.vrmExpressionManager = yield this._import(gltf);
    });
  }
  /**
   * Import a {@link VRMExpressionManager} from a VRM.
   *
   * @param gltf A parsed result of GLTF taken from GLTFLoader
   */
  _import(gltf) {
    return __async2(this, null, function* () {
      const v1Result = yield this._v1Import(gltf);
      if (v1Result) {
        return v1Result;
      }
      const v0Result = yield this._v0Import(gltf);
      if (v0Result) {
        return v0Result;
      }
      return null;
    });
  }
  _v1Import(gltf) {
    return __async2(this, null, function* () {
      var _a, _b;
      const json = this.parser.json;
      const isVRMUsed = ((_a = json.extensionsUsed) == null ? void 0 : _a.indexOf("VRMC_vrm")) !== -1;
      if (!isVRMUsed) {
        return null;
      }
      const extension = (_b = json.extensions) == null ? void 0 : _b["VRMC_vrm"];
      if (!extension) {
        return null;
      }
      const specVersion = extension.specVersion;
      if (!POSSIBLE_SPEC_VERSIONS.has(specVersion)) {
        console.warn(`VRMExpressionLoaderPlugin: Unknown VRMC_vrm specVersion "${specVersion}"`);
        return null;
      }
      const schemaExpressions = extension.expressions;
      if (!schemaExpressions) {
        return null;
      }
      const presetNameSet = new Set(Object.values(VRMExpressionPresetName));
      const nameSchemaExpressionMap = /* @__PURE__ */ new Map();
      if (schemaExpressions.preset != null) {
        Object.entries(schemaExpressions.preset).forEach(([name, schemaExpression]) => {
          if (schemaExpression == null) {
            return;
          }
          if (!presetNameSet.has(name)) {
            console.warn(`VRMExpressionLoaderPlugin: Unknown preset name "${name}" detected. Ignoring the expression`);
            return;
          }
          nameSchemaExpressionMap.set(name, schemaExpression);
        });
      }
      if (schemaExpressions.custom != null) {
        Object.entries(schemaExpressions.custom).forEach(([name, schemaExpression]) => {
          if (presetNameSet.has(name)) {
            console.warn(
              `VRMExpressionLoaderPlugin: Custom expression cannot have preset name "${name}". Ignoring the expression`
            );
            return;
          }
          nameSchemaExpressionMap.set(name, schemaExpression);
        });
      }
      const manager = new VRMExpressionManager();
      yield Promise.all(
        Array.from(nameSchemaExpressionMap.entries()).map((_0) => __async2(this, [_0], function* ([name, schemaExpression]) {
          var _a2, _b2, _c, _d, _e, _f, _g;
          const expression = new VRMExpression(name);
          gltf.scene.add(expression);
          expression.isBinary = (_a2 = schemaExpression.isBinary) != null ? _a2 : false;
          expression.overrideBlink = (_b2 = schemaExpression.overrideBlink) != null ? _b2 : "none";
          expression.overrideLookAt = (_c = schemaExpression.overrideLookAt) != null ? _c : "none";
          expression.overrideMouth = (_d = schemaExpression.overrideMouth) != null ? _d : "none";
          (_e = schemaExpression.morphTargetBinds) == null ? void 0 : _e.forEach((bind) => __async2(this, null, function* () {
            var _a3;
            if (bind.node === void 0 || bind.index === void 0) {
              return;
            }
            const primitives = yield gltfExtractPrimitivesFromNode(gltf, bind.node);
            const morphTargetIndex = bind.index;
            if (!primitives.every(
              (primitive) => Array.isArray(primitive.morphTargetInfluences) && morphTargetIndex < primitive.morphTargetInfluences.length
            )) {
              console.warn(
                `VRMExpressionLoaderPlugin: ${schemaExpression.name} attempts to index morph #${morphTargetIndex} but not found.`
              );
              return;
            }
            expression.addBind(
              new VRMExpressionMorphTargetBind({
                primitives,
                index: morphTargetIndex,
                weight: (_a3 = bind.weight) != null ? _a3 : 1
              })
            );
          }));
          if (schemaExpression.materialColorBinds || schemaExpression.textureTransformBinds) {
            const gltfMaterials = [];
            gltf.scene.traverse((object) => {
              const material = object.material;
              if (material) {
                if (Array.isArray(material)) {
                  gltfMaterials.push(...material);
                } else {
                  gltfMaterials.push(material);
                }
              }
            });
            (_f = schemaExpression.materialColorBinds) == null ? void 0 : _f.forEach((bind) => __async2(this, null, function* () {
              const materials = gltfMaterials.filter((material) => {
                var _a3;
                const materialIndex = (_a3 = this.parser.associations.get(material)) == null ? void 0 : _a3.materials;
                return bind.material === materialIndex;
              });
              materials.forEach((material) => {
                expression.addBind(
                  new VRMExpressionMaterialColorBind({
                    material,
                    type: bind.type,
                    targetValue: new THREE4.Color().fromArray(bind.targetValue),
                    targetAlpha: bind.targetValue[3]
                  })
                );
              });
            }));
            (_g = schemaExpression.textureTransformBinds) == null ? void 0 : _g.forEach((bind) => __async2(this, null, function* () {
              const materials = gltfMaterials.filter((material) => {
                var _a3;
                const materialIndex = (_a3 = this.parser.associations.get(material)) == null ? void 0 : _a3.materials;
                return bind.material === materialIndex;
              });
              materials.forEach((material) => {
                var _a3, _b3;
                expression.addBind(
                  new VRMExpressionTextureTransformBind({
                    material,
                    offset: new THREE4.Vector2().fromArray((_a3 = bind.offset) != null ? _a3 : [0, 0]),
                    scale: new THREE4.Vector2().fromArray((_b3 = bind.scale) != null ? _b3 : [1, 1])
                  })
                );
              });
            }));
          }
          manager.registerExpression(expression);
        }))
      );
      return manager;
    });
  }
  _v0Import(gltf) {
    return __async2(this, null, function* () {
      var _a;
      const json = this.parser.json;
      const vrmExt = (_a = json.extensions) == null ? void 0 : _a.VRM;
      if (!vrmExt) {
        return null;
      }
      const schemaBlendShape = vrmExt.blendShapeMaster;
      if (!schemaBlendShape) {
        return null;
      }
      const manager = new VRMExpressionManager();
      const schemaBlendShapeGroups = schemaBlendShape.blendShapeGroups;
      if (!schemaBlendShapeGroups) {
        return manager;
      }
      const blendShapeNameSet = /* @__PURE__ */ new Set();
      yield Promise.all(
        schemaBlendShapeGroups.map((schemaGroup) => __async2(this, null, function* () {
          var _a2;
          const v0PresetName = schemaGroup.presetName;
          const v1PresetName = v0PresetName != null && _VRMExpressionLoaderPlugin2.v0v1PresetNameMap[v0PresetName] || null;
          const name = v1PresetName != null ? v1PresetName : schemaGroup.name;
          if (name == null) {
            console.warn("VRMExpressionLoaderPlugin: One of custom expressions has no name. Ignoring the expression");
            return;
          }
          if (blendShapeNameSet.has(name)) {
            console.warn(
              `VRMExpressionLoaderPlugin: An expression preset ${v0PresetName} has duplicated entries. Ignoring the expression`
            );
            return;
          }
          blendShapeNameSet.add(name);
          const expression = new VRMExpression(name);
          gltf.scene.add(expression);
          expression.isBinary = (_a2 = schemaGroup.isBinary) != null ? _a2 : false;
          if (schemaGroup.binds) {
            schemaGroup.binds.forEach((bind) => __async2(this, null, function* () {
              var _a3;
              if (bind.mesh === void 0 || bind.index === void 0) {
                return;
              }
              const nodesUsingMesh = [];
              (_a3 = json.nodes) == null ? void 0 : _a3.forEach((node, i) => {
                if (node.mesh === bind.mesh) {
                  nodesUsingMesh.push(i);
                }
              });
              if (nodesUsingMesh.length === 0) {
                console.warn(
                  `VRMExpressionLoaderPlugin: ${schemaGroup.name} attempts to bind a morph target to the mesh #${bind.mesh} but the mesh is not found or not used in the scene. Ignoring the bind.`
                );
                return;
              }
              const morphTargetIndex = bind.index;
              yield Promise.all(
                nodesUsingMesh.map((nodeIndex) => __async2(this, null, function* () {
                  var _a4;
                  const primitives = yield gltfExtractPrimitivesFromNode(gltf, nodeIndex);
                  if (!primitives.every(
                    (primitive) => Array.isArray(primitive.morphTargetInfluences) && morphTargetIndex < primitive.morphTargetInfluences.length
                  )) {
                    console.warn(
                      `VRMExpressionLoaderPlugin: ${schemaGroup.name} attempts to index ${morphTargetIndex}th morph but not found.`
                    );
                    return;
                  }
                  expression.addBind(
                    new VRMExpressionMorphTargetBind({
                      primitives,
                      index: morphTargetIndex,
                      weight: 0.01 * ((_a4 = bind.weight) != null ? _a4 : 100)
                      // narrowing the range from [ 0.0 - 100.0 ] to [ 0.0 - 1.0 ]
                    })
                  );
                }))
              );
            }));
          }
          const materialValues = schemaGroup.materialValues;
          if (materialValues && materialValues.length !== 0) {
            materialValues.forEach((materialValue) => {
              if (materialValue.materialName === void 0 || materialValue.propertyName === void 0 || materialValue.targetValue === void 0) {
                return;
              }
              const materials = [];
              gltf.scene.traverse((object) => {
                if (object.material) {
                  const material = object.material;
                  if (Array.isArray(material)) {
                    materials.push(
                      ...material.filter(
                        (mtl) => (mtl.name === materialValue.materialName || mtl.name === materialValue.materialName + " (Outline)") && materials.indexOf(mtl) === -1
                      )
                    );
                  } else if (material.name === materialValue.materialName && materials.indexOf(material) === -1) {
                    materials.push(material);
                  }
                }
              });
              const materialPropertyName = materialValue.propertyName;
              materials.forEach((material) => {
                if (materialPropertyName === "_MainTex_ST") {
                  const scale = new THREE4.Vector2(materialValue.targetValue[0], materialValue.targetValue[1]);
                  const offset = new THREE4.Vector2(materialValue.targetValue[2], materialValue.targetValue[3]);
                  offset.y = 1 - offset.y - scale.y;
                  expression.addBind(
                    new VRMExpressionTextureTransformBind({
                      material,
                      scale,
                      offset
                    })
                  );
                  return;
                }
                const materialColorType = v0ExpressionMaterialColorMap[materialPropertyName];
                if (materialColorType) {
                  expression.addBind(
                    new VRMExpressionMaterialColorBind({
                      material,
                      type: materialColorType,
                      targetValue: new THREE4.Color().fromArray(materialValue.targetValue),
                      targetAlpha: materialValue.targetValue[3]
                    })
                  );
                  return;
                }
                console.warn(materialPropertyName + " is not supported");
              });
            });
          }
          manager.registerExpression(expression);
        }))
      );
      return manager;
    });
  }
};
_VRMExpressionLoaderPlugin.v0v1PresetNameMap = {
  a: "aa",
  e: "ee",
  i: "ih",
  o: "oh",
  u: "ou",
  blink: "blink",
  joy: "happy",
  angry: "angry",
  sorrow: "sad",
  fun: "relaxed",
  lookup: "lookUp",
  lookdown: "lookDown",
  lookleft: "lookLeft",
  lookright: "lookRight",
  // eslint-disable-next-line @typescript-eslint/naming-convention
  blink_l: "blinkLeft",
  // eslint-disable-next-line @typescript-eslint/naming-convention
  blink_r: "blinkRight",
  neutral: "neutral"
};
var VRMExpressionLoaderPlugin = _VRMExpressionLoaderPlugin;
var VRMExpressionOverrideType = {
  None: "none",
  Block: "block",
  Blend: "blend"
};
var _VRMFirstPerson = class _VRMFirstPerson2 {
  /**
   * Create a new VRMFirstPerson object.
   *
   * @param humanoid A {@link VRMHumanoid}
   * @param meshAnnotations A {@link VRMFirstPersonMeshAnnotation}
   */
  constructor(humanoid, meshAnnotations) {
    this._firstPersonOnlyLayer = _VRMFirstPerson2.DEFAULT_FIRSTPERSON_ONLY_LAYER;
    this._thirdPersonOnlyLayer = _VRMFirstPerson2.DEFAULT_THIRDPERSON_ONLY_LAYER;
    this._initializedLayers = false;
    this.humanoid = humanoid;
    this.meshAnnotations = meshAnnotations;
  }
  /**
   * Copy the given {@link VRMFirstPerson} into this one.
   * {@link humanoid} must be same as the source one.
   * @param source The {@link VRMFirstPerson} you want to copy
   * @returns this
   */
  copy(source) {
    if (this.humanoid !== source.humanoid) {
      throw new Error("VRMFirstPerson: humanoid must be same in order to copy");
    }
    this.meshAnnotations = source.meshAnnotations.map((annotation) => ({
      meshes: annotation.meshes.concat(),
      type: annotation.type
    }));
    return this;
  }
  /**
   * Returns a clone of this {@link VRMFirstPerson}.
   * @returns Copied {@link VRMFirstPerson}
   */
  clone() {
    return new _VRMFirstPerson2(this.humanoid, this.meshAnnotations).copy(this);
  }
  /**
   * A camera layer represents `FirstPersonOnly` layer.
   * Note that **you must call {@link setup} first before you use the layer feature** or it does not work properly.
   *
   * The value is {@link DEFAULT_FIRSTPERSON_ONLY_LAYER} by default but you can change the layer by specifying via {@link setup} if you prefer.
   *
   * @see https://vrm.dev/en/univrm/api/univrm_use_firstperson/
   * @see https://threejs.org/docs/#api/en/core/Layers
   */
  get firstPersonOnlyLayer() {
    return this._firstPersonOnlyLayer;
  }
  /**
   * A camera layer represents `ThirdPersonOnly` layer.
   * Note that **you must call {@link setup} first before you use the layer feature** or it does not work properly.
   *
   * The value is {@link DEFAULT_THIRDPERSON_ONLY_LAYER} by default but you can change the layer by specifying via {@link setup} if you prefer.
   *
   * @see https://vrm.dev/en/univrm/api/univrm_use_firstperson/
   * @see https://threejs.org/docs/#api/en/core/Layers
   */
  get thirdPersonOnlyLayer() {
    return this._thirdPersonOnlyLayer;
  }
  /**
   * In this method, it assigns layers for every meshes based on mesh annotations.
   * You must call this method first before you use the layer feature.
   *
   * This is an equivalent of [VRMFirstPerson.Setup](https://github.com/vrm-c/UniVRM/blob/73a5bd8fcddaa2a7a8735099a97e63c9db3e5ea0/Assets/VRM/Runtime/FirstPerson/VRMFirstPerson.cs#L295-L299) of the UniVRM.
   *
   * The `cameraLayer` parameter specifies which layer will be assigned for `FirstPersonOnly` / `ThirdPersonOnly`.
   * In UniVRM, we specified those by naming each desired layer as `FIRSTPERSON_ONLY_LAYER` / `THIRDPERSON_ONLY_LAYER`
   * but we are going to specify these layers at here since we are unable to name layers in Three.js.
   *
   * @param cameraLayer Specify which layer will be for `FirstPersonOnly` / `ThirdPersonOnly`.
   */
  setup({
    firstPersonOnlyLayer = _VRMFirstPerson2.DEFAULT_FIRSTPERSON_ONLY_LAYER,
    thirdPersonOnlyLayer = _VRMFirstPerson2.DEFAULT_THIRDPERSON_ONLY_LAYER
  } = {}) {
    if (this._initializedLayers) {
      return;
    }
    this._firstPersonOnlyLayer = firstPersonOnlyLayer;
    this._thirdPersonOnlyLayer = thirdPersonOnlyLayer;
    this.meshAnnotations.forEach((item) => {
      item.meshes.forEach((mesh) => {
        if (item.type === "firstPersonOnly") {
          mesh.layers.set(this._firstPersonOnlyLayer);
          mesh.traverse((child) => child.layers.set(this._firstPersonOnlyLayer));
        } else if (item.type === "thirdPersonOnly") {
          mesh.layers.set(this._thirdPersonOnlyLayer);
          mesh.traverse((child) => child.layers.set(this._thirdPersonOnlyLayer));
        } else if (item.type === "auto") {
          this._createHeadlessModel(mesh);
        }
      });
    });
    this._initializedLayers = true;
  }
  _excludeTriangles(triangles, bws, skinIndex, exclude) {
    let count = 0;
    if (bws != null && bws.length > 0) {
      for (let i = 0; i < triangles.length; i += 3) {
        const a = triangles[i];
        const b = triangles[i + 1];
        const c = triangles[i + 2];
        const bw0 = bws[a];
        const skin0 = skinIndex[a];
        if (bw0[0] > 0 && exclude.includes(skin0[0])) continue;
        if (bw0[1] > 0 && exclude.includes(skin0[1])) continue;
        if (bw0[2] > 0 && exclude.includes(skin0[2])) continue;
        if (bw0[3] > 0 && exclude.includes(skin0[3])) continue;
        const bw1 = bws[b];
        const skin1 = skinIndex[b];
        if (bw1[0] > 0 && exclude.includes(skin1[0])) continue;
        if (bw1[1] > 0 && exclude.includes(skin1[1])) continue;
        if (bw1[2] > 0 && exclude.includes(skin1[2])) continue;
        if (bw1[3] > 0 && exclude.includes(skin1[3])) continue;
        const bw2 = bws[c];
        const skin2 = skinIndex[c];
        if (bw2[0] > 0 && exclude.includes(skin2[0])) continue;
        if (bw2[1] > 0 && exclude.includes(skin2[1])) continue;
        if (bw2[2] > 0 && exclude.includes(skin2[2])) continue;
        if (bw2[3] > 0 && exclude.includes(skin2[3])) continue;
        triangles[count++] = a;
        triangles[count++] = b;
        triangles[count++] = c;
      }
    }
    return count;
  }
  _createErasedMesh(src, erasingBonesIndex) {
    const dst = new THREE5.SkinnedMesh(src.geometry.clone(), src.material);
    dst.name = `${src.name}(erase)`;
    dst.frustumCulled = src.frustumCulled;
    dst.layers.set(this._firstPersonOnlyLayer);
    const geometry = dst.geometry;
    const skinIndexAttr = geometry.getAttribute("skinIndex");
    const skinIndexAttrArray = skinIndexAttr instanceof THREE5.GLBufferAttribute ? [] : skinIndexAttr.array;
    const skinIndex = [];
    for (let i = 0; i < skinIndexAttrArray.length; i += 4) {
      skinIndex.push([
        skinIndexAttrArray[i],
        skinIndexAttrArray[i + 1],
        skinIndexAttrArray[i + 2],
        skinIndexAttrArray[i + 3]
      ]);
    }
    const skinWeightAttr = geometry.getAttribute("skinWeight");
    const skinWeightAttrArray = skinWeightAttr instanceof THREE5.GLBufferAttribute ? [] : skinWeightAttr.array;
    const skinWeight = [];
    for (let i = 0; i < skinWeightAttrArray.length; i += 4) {
      skinWeight.push([
        skinWeightAttrArray[i],
        skinWeightAttrArray[i + 1],
        skinWeightAttrArray[i + 2],
        skinWeightAttrArray[i + 3]
      ]);
    }
    const index = geometry.getIndex();
    if (!index) {
      throw new Error("The geometry doesn't have an index buffer");
    }
    const oldTriangles = Array.from(index.array);
    const count = this._excludeTriangles(oldTriangles, skinWeight, skinIndex, erasingBonesIndex);
    const newTriangle = [];
    for (let i = 0; i < count; i++) {
      newTriangle[i] = oldTriangles[i];
    }
    geometry.setIndex(newTriangle);
    if (src.onBeforeRender) {
      dst.onBeforeRender = src.onBeforeRender;
    }
    dst.bind(new THREE5.Skeleton(src.skeleton.bones, src.skeleton.boneInverses), new THREE5.Matrix4());
    return dst;
  }
  _createHeadlessModelForSkinnedMesh(parent, mesh) {
    const eraseBoneIndexes = [];
    mesh.skeleton.bones.forEach((bone, index) => {
      if (this._isEraseTarget(bone)) eraseBoneIndexes.push(index);
    });
    if (!eraseBoneIndexes.length) {
      mesh.layers.enable(this._thirdPersonOnlyLayer);
      mesh.layers.enable(this._firstPersonOnlyLayer);
      return;
    }
    mesh.layers.set(this._thirdPersonOnlyLayer);
    const newMesh = this._createErasedMesh(mesh, eraseBoneIndexes);
    parent.add(newMesh);
  }
  _createHeadlessModel(node) {
    if (node.type === "Group") {
      node.layers.set(this._thirdPersonOnlyLayer);
      if (this._isEraseTarget(node)) {
        node.traverse((child) => child.layers.set(this._thirdPersonOnlyLayer));
      } else {
        const parent = new THREE5.Group();
        parent.name = `_headless_${node.name}`;
        parent.layers.set(this._firstPersonOnlyLayer);
        node.parent.add(parent);
        node.children.filter((child) => child.type === "SkinnedMesh").forEach((child) => {
          const skinnedMesh = child;
          this._createHeadlessModelForSkinnedMesh(parent, skinnedMesh);
        });
      }
    } else if (node.type === "SkinnedMesh") {
      const skinnedMesh = node;
      this._createHeadlessModelForSkinnedMesh(node.parent, skinnedMesh);
    } else {
      if (this._isEraseTarget(node)) {
        node.layers.set(this._thirdPersonOnlyLayer);
        node.traverse((child) => child.layers.set(this._thirdPersonOnlyLayer));
      }
    }
  }
  _isEraseTarget(bone) {
    if (bone === this.humanoid.getRawBoneNode("head")) {
      return true;
    } else if (!bone.parent) {
      return false;
    } else {
      return this._isEraseTarget(bone.parent);
    }
  }
};
_VRMFirstPerson.DEFAULT_FIRSTPERSON_ONLY_LAYER = 9;
_VRMFirstPerson.DEFAULT_THIRDPERSON_ONLY_LAYER = 10;
var VRMFirstPerson = _VRMFirstPerson;
var POSSIBLE_SPEC_VERSIONS2 = /* @__PURE__ */ new Set(["1.0", "1.0-beta"]);
var VRMFirstPersonLoaderPlugin = class {
  get name() {
    return "VRMFirstPersonLoaderPlugin";
  }
  constructor(parser) {
    this.parser = parser;
  }
  afterRoot(gltf) {
    return __async2(this, null, function* () {
      const vrmHumanoid = gltf.userData.vrmHumanoid;
      if (vrmHumanoid === null) {
        return;
      } else if (vrmHumanoid === void 0) {
        throw new Error(
          "VRMFirstPersonLoaderPlugin: vrmHumanoid is undefined. VRMHumanoidLoaderPlugin have to be used first"
        );
      }
      gltf.userData.vrmFirstPerson = yield this._import(gltf, vrmHumanoid);
    });
  }
  /**
   * Import a {@link VRMFirstPerson} from a VRM.
   *
   * @param gltf A parsed result of GLTF taken from GLTFLoader
   * @param humanoid A {@link VRMHumanoid} instance that represents the VRM
   */
  _import(gltf, humanoid) {
    return __async2(this, null, function* () {
      if (humanoid == null) {
        return null;
      }
      const v1Result = yield this._v1Import(gltf, humanoid);
      if (v1Result) {
        return v1Result;
      }
      const v0Result = yield this._v0Import(gltf, humanoid);
      if (v0Result) {
        return v0Result;
      }
      return null;
    });
  }
  _v1Import(gltf, humanoid) {
    return __async2(this, null, function* () {
      var _a, _b;
      const json = this.parser.json;
      const isVRMUsed = ((_a = json.extensionsUsed) == null ? void 0 : _a.indexOf("VRMC_vrm")) !== -1;
      if (!isVRMUsed) {
        return null;
      }
      const extension = (_b = json.extensions) == null ? void 0 : _b["VRMC_vrm"];
      if (!extension) {
        return null;
      }
      const specVersion = extension.specVersion;
      if (!POSSIBLE_SPEC_VERSIONS2.has(specVersion)) {
        console.warn(`VRMFirstPersonLoaderPlugin: Unknown VRMC_vrm specVersion "${specVersion}"`);
        return null;
      }
      const schemaFirstPerson = extension.firstPerson;
      const meshAnnotations = [];
      const nodePrimitivesMap = yield gltfExtractPrimitivesFromNodes(gltf);
      Array.from(nodePrimitivesMap.entries()).forEach(([nodeIndex, primitives]) => {
        var _a2, _b2;
        const annotation = (_a2 = schemaFirstPerson == null ? void 0 : schemaFirstPerson.meshAnnotations) == null ? void 0 : _a2.find((a) => a.node === nodeIndex);
        meshAnnotations.push({
          meshes: primitives,
          type: (_b2 = annotation == null ? void 0 : annotation.type) != null ? _b2 : "auto"
        });
      });
      return new VRMFirstPerson(humanoid, meshAnnotations);
    });
  }
  _v0Import(gltf, humanoid) {
    return __async2(this, null, function* () {
      var _a;
      const json = this.parser.json;
      const vrmExt = (_a = json.extensions) == null ? void 0 : _a.VRM;
      if (!vrmExt) {
        return null;
      }
      const schemaFirstPerson = vrmExt.firstPerson;
      if (!schemaFirstPerson) {
        return null;
      }
      const meshAnnotations = [];
      const nodePrimitivesMap = yield gltfExtractPrimitivesFromNodes(gltf);
      Array.from(nodePrimitivesMap.entries()).forEach(([nodeIndex, primitives]) => {
        const schemaNode = json.nodes[nodeIndex];
        const flag = schemaFirstPerson.meshAnnotations ? schemaFirstPerson.meshAnnotations.find((a) => a.mesh === schemaNode.mesh) : void 0;
        meshAnnotations.push({
          meshes: primitives,
          type: this._convertV0FlagToV1Type(flag == null ? void 0 : flag.firstPersonFlag)
        });
      });
      return new VRMFirstPerson(humanoid, meshAnnotations);
    });
  }
  _convertV0FlagToV1Type(flag) {
    if (flag === "FirstPersonOnly") {
      return "firstPersonOnly";
    } else if (flag === "ThirdPersonOnly") {
      return "thirdPersonOnly";
    } else if (flag === "Both") {
      return "both";
    } else {
      return "auto";
    }
  }
};
var VRMFirstPersonMeshAnnotationType = {
  Auto: "auto",
  Both: "both",
  ThirdPersonOnly: "thirdPersonOnly",
  FirstPersonOnly: "firstPersonOnly"
};
var _v3A = new THREE6.Vector3();
var _v3B = new THREE6.Vector3();
var _quatA = new THREE6.Quaternion();
var VRMHumanoidHelper = class extends THREE6.Group {
  constructor(humanoid) {
    super();
    this.vrmHumanoid = humanoid;
    this._boneAxesMap = /* @__PURE__ */ new Map();
    Object.values(humanoid.humanBones).forEach((bone) => {
      const helper = new THREE6.AxesHelper(1);
      helper.matrixAutoUpdate = false;
      helper.material.depthTest = false;
      helper.material.depthWrite = false;
      this.add(helper);
      this._boneAxesMap.set(bone, helper);
    });
  }
  dispose() {
    Array.from(this._boneAxesMap.values()).forEach((axes) => {
      axes.geometry.dispose();
      axes.material.dispose();
    });
  }
  updateMatrixWorld(force) {
    Array.from(this._boneAxesMap.entries()).forEach(([bone, axes]) => {
      bone.node.updateWorldMatrix(true, false);
      bone.node.matrixWorld.decompose(_v3A, _quatA, _v3B);
      const scale = _v3A.set(0.1, 0.1, 0.1).divide(_v3B);
      axes.matrix.copy(bone.node.matrixWorld).scale(scale);
    });
    super.updateMatrixWorld(force);
  }
};
var VRMHumanBoneList = [
  "hips",
  "spine",
  "chest",
  "upperChest",
  "neck",
  "head",
  "leftEye",
  "rightEye",
  "jaw",
  "leftUpperLeg",
  "leftLowerLeg",
  "leftFoot",
  "leftToes",
  "rightUpperLeg",
  "rightLowerLeg",
  "rightFoot",
  "rightToes",
  "leftShoulder",
  "leftUpperArm",
  "leftLowerArm",
  "leftHand",
  "rightShoulder",
  "rightUpperArm",
  "rightLowerArm",
  "rightHand",
  "leftThumbMetacarpal",
  "leftThumbProximal",
  "leftThumbDistal",
  "leftIndexProximal",
  "leftIndexIntermediate",
  "leftIndexDistal",
  "leftMiddleProximal",
  "leftMiddleIntermediate",
  "leftMiddleDistal",
  "leftRingProximal",
  "leftRingIntermediate",
  "leftRingDistal",
  "leftLittleProximal",
  "leftLittleIntermediate",
  "leftLittleDistal",
  "rightThumbMetacarpal",
  "rightThumbProximal",
  "rightThumbDistal",
  "rightIndexProximal",
  "rightIndexIntermediate",
  "rightIndexDistal",
  "rightMiddleProximal",
  "rightMiddleIntermediate",
  "rightMiddleDistal",
  "rightRingProximal",
  "rightRingIntermediate",
  "rightRingDistal",
  "rightLittleProximal",
  "rightLittleIntermediate",
  "rightLittleDistal"
];
var VRMHumanBoneName = {
  Hips: "hips",
  Spine: "spine",
  Chest: "chest",
  UpperChest: "upperChest",
  Neck: "neck",
  Head: "head",
  LeftEye: "leftEye",
  RightEye: "rightEye",
  Jaw: "jaw",
  LeftUpperLeg: "leftUpperLeg",
  LeftLowerLeg: "leftLowerLeg",
  LeftFoot: "leftFoot",
  LeftToes: "leftToes",
  RightUpperLeg: "rightUpperLeg",
  RightLowerLeg: "rightLowerLeg",
  RightFoot: "rightFoot",
  RightToes: "rightToes",
  LeftShoulder: "leftShoulder",
  LeftUpperArm: "leftUpperArm",
  LeftLowerArm: "leftLowerArm",
  LeftHand: "leftHand",
  RightShoulder: "rightShoulder",
  RightUpperArm: "rightUpperArm",
  RightLowerArm: "rightLowerArm",
  RightHand: "rightHand",
  LeftThumbMetacarpal: "leftThumbMetacarpal",
  LeftThumbProximal: "leftThumbProximal",
  LeftThumbDistal: "leftThumbDistal",
  LeftIndexProximal: "leftIndexProximal",
  LeftIndexIntermediate: "leftIndexIntermediate",
  LeftIndexDistal: "leftIndexDistal",
  LeftMiddleProximal: "leftMiddleProximal",
  LeftMiddleIntermediate: "leftMiddleIntermediate",
  LeftMiddleDistal: "leftMiddleDistal",
  LeftRingProximal: "leftRingProximal",
  LeftRingIntermediate: "leftRingIntermediate",
  LeftRingDistal: "leftRingDistal",
  LeftLittleProximal: "leftLittleProximal",
  LeftLittleIntermediate: "leftLittleIntermediate",
  LeftLittleDistal: "leftLittleDistal",
  RightThumbMetacarpal: "rightThumbMetacarpal",
  RightThumbProximal: "rightThumbProximal",
  RightThumbDistal: "rightThumbDistal",
  RightIndexProximal: "rightIndexProximal",
  RightIndexIntermediate: "rightIndexIntermediate",
  RightIndexDistal: "rightIndexDistal",
  RightMiddleProximal: "rightMiddleProximal",
  RightMiddleIntermediate: "rightMiddleIntermediate",
  RightMiddleDistal: "rightMiddleDistal",
  RightRingProximal: "rightRingProximal",
  RightRingIntermediate: "rightRingIntermediate",
  RightRingDistal: "rightRingDistal",
  RightLittleProximal: "rightLittleProximal",
  RightLittleIntermediate: "rightLittleIntermediate",
  RightLittleDistal: "rightLittleDistal"
};
var VRMHumanBoneParentMap = {
  hips: null,
  spine: "hips",
  chest: "spine",
  upperChest: "chest",
  neck: "upperChest",
  head: "neck",
  leftEye: "head",
  rightEye: "head",
  jaw: "head",
  leftUpperLeg: "hips",
  leftLowerLeg: "leftUpperLeg",
  leftFoot: "leftLowerLeg",
  leftToes: "leftFoot",
  rightUpperLeg: "hips",
  rightLowerLeg: "rightUpperLeg",
  rightFoot: "rightLowerLeg",
  rightToes: "rightFoot",
  leftShoulder: "upperChest",
  leftUpperArm: "leftShoulder",
  leftLowerArm: "leftUpperArm",
  leftHand: "leftLowerArm",
  rightShoulder: "upperChest",
  rightUpperArm: "rightShoulder",
  rightLowerArm: "rightUpperArm",
  rightHand: "rightLowerArm",
  leftThumbMetacarpal: "leftHand",
  leftThumbProximal: "leftThumbMetacarpal",
  leftThumbDistal: "leftThumbProximal",
  leftIndexProximal: "leftHand",
  leftIndexIntermediate: "leftIndexProximal",
  leftIndexDistal: "leftIndexIntermediate",
  leftMiddleProximal: "leftHand",
  leftMiddleIntermediate: "leftMiddleProximal",
  leftMiddleDistal: "leftMiddleIntermediate",
  leftRingProximal: "leftHand",
  leftRingIntermediate: "leftRingProximal",
  leftRingDistal: "leftRingIntermediate",
  leftLittleProximal: "leftHand",
  leftLittleIntermediate: "leftLittleProximal",
  leftLittleDistal: "leftLittleIntermediate",
  rightThumbMetacarpal: "rightHand",
  rightThumbProximal: "rightThumbMetacarpal",
  rightThumbDistal: "rightThumbProximal",
  rightIndexProximal: "rightHand",
  rightIndexIntermediate: "rightIndexProximal",
  rightIndexDistal: "rightIndexIntermediate",
  rightMiddleProximal: "rightHand",
  rightMiddleIntermediate: "rightMiddleProximal",
  rightMiddleDistal: "rightMiddleIntermediate",
  rightRingProximal: "rightHand",
  rightRingIntermediate: "rightRingProximal",
  rightRingDistal: "rightRingIntermediate",
  rightLittleProximal: "rightHand",
  rightLittleIntermediate: "rightLittleProximal",
  rightLittleDistal: "rightLittleIntermediate"
};
function quatInvertCompat(target) {
  if (target.invert) {
    target.invert();
  } else {
    target.inverse();
  }
  return target;
}
var _v3A2 = new THREE7.Vector3();
var _quatA2 = new THREE7.Quaternion();
var VRMRig = class {
  /**
   * Create a new {@link VRMHumanoid}.
   * @param humanBones A {@link VRMHumanBones} contains all the bones of the new humanoid
   */
  constructor(humanBones) {
    this.humanBones = humanBones;
    this.restPose = this.getAbsolutePose();
  }
  /**
   * Return the current absolute pose of this humanoid as a {@link VRMPose}.
   * Note that the output result will contain initial state of the VRM and not compatible between different models.
   * You might want to use {@link getPose} instead.
   */
  getAbsolutePose() {
    const pose = {};
    Object.keys(this.humanBones).forEach((vrmBoneNameString) => {
      const vrmBoneName = vrmBoneNameString;
      const node = this.getBoneNode(vrmBoneName);
      if (!node) {
        return;
      }
      _v3A2.copy(node.position);
      _quatA2.copy(node.quaternion);
      pose[vrmBoneName] = {
        position: _v3A2.toArray(),
        rotation: _quatA2.toArray()
      };
    });
    return pose;
  }
  /**
   * Return the current pose of this humanoid as a {@link VRMPose}.
   *
   * Each transform is a local transform relative from rest pose (T-pose).
   */
  getPose() {
    const pose = {};
    Object.keys(this.humanBones).forEach((boneNameString) => {
      const boneName = boneNameString;
      const node = this.getBoneNode(boneName);
      if (!node) {
        return;
      }
      _v3A2.set(0, 0, 0);
      _quatA2.identity();
      const restState = this.restPose[boneName];
      if (restState == null ? void 0 : restState.position) {
        _v3A2.fromArray(restState.position).negate();
      }
      if (restState == null ? void 0 : restState.rotation) {
        quatInvertCompat(_quatA2.fromArray(restState.rotation));
      }
      _v3A2.add(node.position);
      _quatA2.premultiply(node.quaternion);
      pose[boneName] = {
        position: _v3A2.toArray(),
        rotation: _quatA2.toArray()
      };
    });
    return pose;
  }
  /**
   * Let the humanoid do a specified pose.
   *
   * Each transform have to be a local transform relative from rest pose (T-pose).
   * You can pass what you got from {@link getPose}.
   *
   * @param poseObject A {@link VRMPose} that represents a single pose
   */
  setPose(poseObject) {
    Object.entries(poseObject).forEach(([boneNameString, state]) => {
      const boneName = boneNameString;
      const node = this.getBoneNode(boneName);
      if (!node) {
        return;
      }
      const restState = this.restPose[boneName];
      if (!restState) {
        return;
      }
      if (state == null ? void 0 : state.position) {
        node.position.fromArray(state.position);
        if (restState.position) {
          node.position.add(_v3A2.fromArray(restState.position));
        }
      }
      if (state == null ? void 0 : state.rotation) {
        node.quaternion.fromArray(state.rotation);
        if (restState.rotation) {
          node.quaternion.multiply(_quatA2.fromArray(restState.rotation));
        }
      }
    });
  }
  /**
   * Reset the humanoid to its rest pose.
   */
  resetPose() {
    Object.entries(this.restPose).forEach(([boneName, rest]) => {
      const node = this.getBoneNode(boneName);
      if (!node) {
        return;
      }
      if (rest == null ? void 0 : rest.position) {
        node.position.fromArray(rest.position);
      }
      if (rest == null ? void 0 : rest.rotation) {
        node.quaternion.fromArray(rest.rotation);
      }
    });
  }
  /**
   * Return a bone bound to a specified {@link VRMHumanBoneName}, as a {@link VRMHumanBone}.
   *
   * @param name Name of the bone you want
   */
  getBone(name) {
    var _a;
    return (_a = this.humanBones[name]) != null ? _a : void 0;
  }
  /**
   * Return a bone bound to a specified {@link VRMHumanBoneName}, as a `THREE.Object3D`.
   *
   * @param name Name of the bone you want
   */
  getBoneNode(name) {
    var _a, _b;
    return (_b = (_a = this.humanBones[name]) == null ? void 0 : _a.node) != null ? _b : null;
  }
};
var _v3A3 = new THREE8.Vector3();
var _quatA3 = new THREE8.Quaternion();
var _boneWorldPos = new THREE8.Vector3();
var VRMHumanoidRig = class _VRMHumanoidRig extends VRMRig {
  static _setupTransforms(modelRig) {
    const root = new THREE8.Object3D();
    root.name = "VRMHumanoidRig";
    const boneWorldPositions = {};
    const boneWorldRotations = {};
    const boneRotations = {};
    const parentWorldRotations = {};
    VRMHumanBoneList.forEach((boneName) => {
      var _a;
      const boneNode = modelRig.getBoneNode(boneName);
      if (boneNode) {
        const boneWorldPosition = new THREE8.Vector3();
        const boneWorldRotation = new THREE8.Quaternion();
        boneNode.updateWorldMatrix(true, false);
        boneNode.matrixWorld.decompose(boneWorldPosition, boneWorldRotation, _v3A3);
        boneWorldPositions[boneName] = boneWorldPosition;
        boneWorldRotations[boneName] = boneWorldRotation;
        boneRotations[boneName] = boneNode.quaternion.clone();
        const parentWorldRotation = new THREE8.Quaternion();
        (_a = boneNode.parent) == null ? void 0 : _a.matrixWorld.decompose(_v3A3, parentWorldRotation, _v3A3);
        parentWorldRotations[boneName] = parentWorldRotation;
      }
    });
    const rigBones = {};
    VRMHumanBoneList.forEach((boneName) => {
      var _a;
      const boneNode = modelRig.getBoneNode(boneName);
      if (boneNode) {
        const boneWorldPosition = boneWorldPositions[boneName];
        let currentBoneName = boneName;
        let parentBoneWorldPosition;
        while (parentBoneWorldPosition == null) {
          currentBoneName = VRMHumanBoneParentMap[currentBoneName];
          if (currentBoneName == null) {
            break;
          }
          parentBoneWorldPosition = boneWorldPositions[currentBoneName];
        }
        const rigBoneNode = new THREE8.Object3D();
        rigBoneNode.name = "Normalized_" + boneNode.name;
        const parentRigBoneNode = currentBoneName ? (_a = rigBones[currentBoneName]) == null ? void 0 : _a.node : root;
        parentRigBoneNode.add(rigBoneNode);
        rigBoneNode.position.copy(boneWorldPosition);
        if (parentBoneWorldPosition) {
          rigBoneNode.position.sub(parentBoneWorldPosition);
        }
        rigBones[boneName] = { node: rigBoneNode };
      }
    });
    return {
      rigBones,
      root,
      parentWorldRotations,
      boneRotations
    };
  }
  constructor(humanoid) {
    const { rigBones, root, parentWorldRotations, boneRotations } = _VRMHumanoidRig._setupTransforms(humanoid);
    super(rigBones);
    this.original = humanoid;
    this.root = root;
    this._parentWorldRotations = parentWorldRotations;
    this._boneRotations = boneRotations;
  }
  /**
   * Update this humanoid rig.
   */
  update() {
    VRMHumanBoneList.forEach((boneName) => {
      const boneNode = this.original.getBoneNode(boneName);
      if (boneNode != null) {
        const rigBoneNode = this.getBoneNode(boneName);
        const parentWorldRotation = this._parentWorldRotations[boneName];
        const invParentWorldRotation = _quatA3.copy(parentWorldRotation).invert();
        const boneRotation = this._boneRotations[boneName];
        boneNode.quaternion.copy(rigBoneNode.quaternion).multiply(parentWorldRotation).premultiply(invParentWorldRotation).multiply(boneRotation);
        if (boneName === "hips") {
          const boneWorldPosition = rigBoneNode.getWorldPosition(_boneWorldPos);
          boneNode.parent.updateWorldMatrix(true, false);
          const parentWorldMatrix = boneNode.parent.matrixWorld;
          const localPosition = boneWorldPosition.applyMatrix4(parentWorldMatrix.invert());
          boneNode.position.copy(localPosition);
        }
      }
    });
  }
};
var VRMHumanoid = class _VRMHumanoid {
  // TODO: Rename
  /**
   * @deprecated Deprecated. Use either {@link rawRestPose} or {@link normalizedRestPose} instead.
   */
  get restPose() {
    console.warn("VRMHumanoid: restPose is deprecated. Use either rawRestPose or normalizedRestPose instead.");
    return this.rawRestPose;
  }
  /**
   * A {@link VRMPose} of its raw human bones that is its default state.
   * Note that it's not compatible with {@link setRawPose} and {@link getRawPose}, since it contains non-relative values of each local transforms.
   */
  get rawRestPose() {
    return this._rawHumanBones.restPose;
  }
  /**
   * A {@link VRMPose} of its normalized human bones that is its default state.
   * Note that it's not compatible with {@link setNormalizedPose} and {@link getNormalizedPose}, since it contains non-relative values of each local transforms.
   */
  get normalizedRestPose() {
    return this._normalizedHumanBones.restPose;
  }
  /**
   * A map from {@link VRMHumanBoneName} to raw {@link VRMHumanBone}s.
   */
  get humanBones() {
    return this._rawHumanBones.humanBones;
  }
  /**
   * A map from {@link VRMHumanBoneName} to raw {@link VRMHumanBone}s.
   */
  get rawHumanBones() {
    return this._rawHumanBones.humanBones;
  }
  /**
   * A map from {@link VRMHumanBoneName} to normalized {@link VRMHumanBone}s.
   */
  get normalizedHumanBones() {
    return this._normalizedHumanBones.humanBones;
  }
  /**
   * The root of normalized {@link VRMHumanBone}s.
   */
  get normalizedHumanBonesRoot() {
    return this._normalizedHumanBones.root;
  }
  /**
   * Create a new {@link VRMHumanoid}.
   * @param humanBones A {@link VRMHumanBones} contains all the bones of the new humanoid
   * @param autoUpdateHumanBones Whether it copies pose from normalizedHumanBones to rawHumanBones on {@link update}. `true` by default.
   */
  constructor(humanBones, options) {
    var _a;
    this.autoUpdateHumanBones = (_a = options == null ? void 0 : options.autoUpdateHumanBones) != null ? _a : true;
    this._rawHumanBones = new VRMRig(humanBones);
    this._normalizedHumanBones = new VRMHumanoidRig(this._rawHumanBones);
  }
  /**
   * Copy the given {@link VRMHumanoid} into this one.
   * @param source The {@link VRMHumanoid} you want to copy
   * @returns this
   */
  copy(source) {
    this.autoUpdateHumanBones = source.autoUpdateHumanBones;
    this._rawHumanBones = new VRMRig(source.humanBones);
    this._normalizedHumanBones = new VRMHumanoidRig(this._rawHumanBones);
    return this;
  }
  /**
   * Returns a clone of this {@link VRMHumanoid}.
   * @returns Copied {@link VRMHumanoid}
   */
  clone() {
    return new _VRMHumanoid(this.humanBones, { autoUpdateHumanBones: this.autoUpdateHumanBones }).copy(this);
  }
  /**
   * @deprecated Deprecated. Use either {@link getRawAbsolutePose} or {@link getNormalizedAbsolutePose} instead.
   */
  getAbsolutePose() {
    console.warn(
      "VRMHumanoid: getAbsolutePose() is deprecated. Use either getRawAbsolutePose() or getNormalizedAbsolutePose() instead."
    );
    return this.getRawAbsolutePose();
  }
  /**
   * Return the current absolute pose of this raw human bones as a {@link VRMPose}.
   * Note that the output result will contain initial state of the VRM and not compatible between different models.
   * You might want to use {@link getRawPose} instead.
   */
  getRawAbsolutePose() {
    return this._rawHumanBones.getAbsolutePose();
  }
  /**
   * Return the current absolute pose of this normalized human bones as a {@link VRMPose}.
   * Note that the output result will contain initial state of the VRM and not compatible between different models.
   * You might want to use {@link getNormalizedPose} instead.
   */
  getNormalizedAbsolutePose() {
    return this._normalizedHumanBones.getAbsolutePose();
  }
  /**
   * @deprecated Deprecated. Use either {@link getRawPose} or {@link getNormalizedPose} instead.
   */
  getPose() {
    console.warn("VRMHumanoid: getPose() is deprecated. Use either getRawPose() or getNormalizedPose() instead.");
    return this.getRawPose();
  }
  /**
   * Return the current pose of raw human bones as a {@link VRMPose}.
   *
   * Each transform is a local transform relative from rest pose (T-pose).
   */
  getRawPose() {
    return this._rawHumanBones.getPose();
  }
  /**
   * Return the current pose of normalized human bones as a {@link VRMPose}.
   *
   * Each transform is a local transform relative from rest pose (T-pose).
   */
  getNormalizedPose() {
    return this._normalizedHumanBones.getPose();
  }
  /**
   * @deprecated Deprecated. Use either {@link setRawPose} or {@link setNormalizedPose} instead.
   */
  setPose(poseObject) {
    console.warn("VRMHumanoid: setPose() is deprecated. Use either setRawPose() or setNormalizedPose() instead.");
    return this.setRawPose(poseObject);
  }
  /**
   * Let the raw human bones do a specified pose.
   *
   * Each transform have to be a local transform relative from rest pose (T-pose).
   * You can pass what you got from {@link getRawPose}.
   *
   * If you are using {@link autoUpdateHumanBones}, you might want to use {@link setNormalizedPose} instead.
   *
   * @param poseObject A {@link VRMPose} that represents a single pose
   */
  setRawPose(poseObject) {
    return this._rawHumanBones.setPose(poseObject);
  }
  /**
   * Let the normalized human bones do a specified pose.
   *
   * Each transform have to be a local transform relative from rest pose (T-pose).
   * You can pass what you got from {@link getNormalizedPose}.
   *
   * @param poseObject A {@link VRMPose} that represents a single pose
   */
  setNormalizedPose(poseObject) {
    return this._normalizedHumanBones.setPose(poseObject);
  }
  /**
   * @deprecated Deprecated. Use either {@link resetRawPose} or {@link resetNormalizedPose} instead.
   */
  resetPose() {
    console.warn("VRMHumanoid: resetPose() is deprecated. Use either resetRawPose() or resetNormalizedPose() instead.");
    return this.resetRawPose();
  }
  /**
   * Reset the raw humanoid to its rest pose.
   *
   * If you are using {@link autoUpdateHumanBones}, you might want to use {@link resetNormalizedPose} instead.
   */
  resetRawPose() {
    return this._rawHumanBones.resetPose();
  }
  /**
   * Reset the normalized humanoid to its rest pose.
   */
  resetNormalizedPose() {
    return this._normalizedHumanBones.resetPose();
  }
  /**
   * @deprecated Deprecated. Use either {@link getRawBone} or {@link getNormalizedBone} instead.
   */
  getBone(name) {
    console.warn("VRMHumanoid: getBone() is deprecated. Use either getRawBone() or getNormalizedBone() instead.");
    return this.getRawBone(name);
  }
  /**
   * Return a raw {@link VRMHumanBone} bound to a specified {@link VRMHumanBoneName}.
   *
   * @param name Name of the bone you want
   */
  getRawBone(name) {
    return this._rawHumanBones.getBone(name);
  }
  /**
   * Return a normalized {@link VRMHumanBone} bound to a specified {@link VRMHumanBoneName}.
   *
   * @param name Name of the bone you want
   */
  getNormalizedBone(name) {
    return this._normalizedHumanBones.getBone(name);
  }
  /**
   * @deprecated Deprecated. Use either {@link getRawBoneNode} or {@link getNormalizedBoneNode} instead.
   */
  getBoneNode(name) {
    console.warn(
      "VRMHumanoid: getBoneNode() is deprecated. Use either getRawBoneNode() or getNormalizedBoneNode() instead."
    );
    return this.getRawBoneNode(name);
  }
  /**
   * Return a raw bone as a `THREE.Object3D` bound to a specified {@link VRMHumanBoneName}.
   *
   * @param name Name of the bone you want
   */
  getRawBoneNode(name) {
    return this._rawHumanBones.getBoneNode(name);
  }
  /**
   * Return a normalized bone as a `THREE.Object3D` bound to a specified {@link VRMHumanBoneName}.
   *
   * @param name Name of the bone you want
   */
  getNormalizedBoneNode(name) {
    return this._normalizedHumanBones.getBoneNode(name);
  }
  /**
   * Update the humanoid component.
   *
   * If {@link autoUpdateHumanBones} is `true`, it transfers the pose of normalized human bones to raw human bones.
   */
  update() {
    if (this.autoUpdateHumanBones) {
      this._normalizedHumanBones.update();
    }
  }
};
var VRMRequiredHumanBoneName = {
  Hips: "hips",
  Spine: "spine",
  Head: "head",
  LeftUpperLeg: "leftUpperLeg",
  LeftLowerLeg: "leftLowerLeg",
  LeftFoot: "leftFoot",
  RightUpperLeg: "rightUpperLeg",
  RightLowerLeg: "rightLowerLeg",
  RightFoot: "rightFoot",
  LeftUpperArm: "leftUpperArm",
  LeftLowerArm: "leftLowerArm",
  LeftHand: "leftHand",
  RightUpperArm: "rightUpperArm",
  RightLowerArm: "rightLowerArm",
  RightHand: "rightHand"
};
var POSSIBLE_SPEC_VERSIONS3 = /* @__PURE__ */ new Set(["1.0", "1.0-beta"]);
var thumbBoneNameMap = {
  leftThumbProximal: "leftThumbMetacarpal",
  leftThumbIntermediate: "leftThumbProximal",
  rightThumbProximal: "rightThumbMetacarpal",
  rightThumbIntermediate: "rightThumbProximal"
};
var VRMHumanoidLoaderPlugin = class {
  get name() {
    return "VRMHumanoidLoaderPlugin";
  }
  constructor(parser, options) {
    this.parser = parser;
    this.helperRoot = options == null ? void 0 : options.helperRoot;
    this.autoUpdateHumanBones = options == null ? void 0 : options.autoUpdateHumanBones;
  }
  afterRoot(gltf) {
    return __async2(this, null, function* () {
      gltf.userData.vrmHumanoid = yield this._import(gltf);
    });
  }
  /**
   * Import a {@link VRMHumanoid} from a VRM.
   *
   * @param gltf A parsed result of GLTF taken from GLTFLoader
   */
  _import(gltf) {
    return __async2(this, null, function* () {
      const v1Result = yield this._v1Import(gltf);
      if (v1Result) {
        return v1Result;
      }
      const v0Result = yield this._v0Import(gltf);
      if (v0Result) {
        return v0Result;
      }
      return null;
    });
  }
  _v1Import(gltf) {
    return __async2(this, null, function* () {
      var _a, _b;
      const json = this.parser.json;
      const isVRMUsed = ((_a = json.extensionsUsed) == null ? void 0 : _a.indexOf("VRMC_vrm")) !== -1;
      if (!isVRMUsed) {
        return null;
      }
      const extension = (_b = json.extensions) == null ? void 0 : _b["VRMC_vrm"];
      if (!extension) {
        return null;
      }
      const specVersion = extension.specVersion;
      if (!POSSIBLE_SPEC_VERSIONS3.has(specVersion)) {
        console.warn(`VRMHumanoidLoaderPlugin: Unknown VRMC_vrm specVersion "${specVersion}"`);
        return null;
      }
      const schemaHumanoid = extension.humanoid;
      if (!schemaHumanoid) {
        return null;
      }
      const existsPreviousThumbName = schemaHumanoid.humanBones.leftThumbIntermediate != null || schemaHumanoid.humanBones.rightThumbIntermediate != null;
      const humanBones = {};
      if (schemaHumanoid.humanBones != null) {
        yield Promise.all(
          Object.entries(schemaHumanoid.humanBones).map((_0) => __async2(this, [_0], function* ([boneNameString, schemaHumanBone]) {
            let boneName = boneNameString;
            const index = schemaHumanBone.node;
            if (existsPreviousThumbName) {
              const thumbBoneName = thumbBoneNameMap[boneName];
              if (thumbBoneName != null) {
                boneName = thumbBoneName;
              }
            }
            const node = yield this.parser.getDependency("node", index);
            if (node == null) {
              console.warn(`A glTF node bound to the humanoid bone ${boneName} (index = ${index}) does not exist`);
              return;
            }
            humanBones[boneName] = { node };
          }))
        );
      }
      const humanoid = new VRMHumanoid(this._ensureRequiredBonesExist(humanBones), {
        autoUpdateHumanBones: this.autoUpdateHumanBones
      });
      gltf.scene.add(humanoid.normalizedHumanBonesRoot);
      if (this.helperRoot) {
        const helper = new VRMHumanoidHelper(humanoid);
        this.helperRoot.add(helper);
        helper.renderOrder = this.helperRoot.renderOrder;
      }
      return humanoid;
    });
  }
  _v0Import(gltf) {
    return __async2(this, null, function* () {
      var _a;
      const json = this.parser.json;
      const vrmExt = (_a = json.extensions) == null ? void 0 : _a.VRM;
      if (!vrmExt) {
        return null;
      }
      const schemaHumanoid = vrmExt.humanoid;
      if (!schemaHumanoid) {
        return null;
      }
      const humanBones = {};
      if (schemaHumanoid.humanBones != null) {
        yield Promise.all(
          schemaHumanoid.humanBones.map((bone) => __async2(this, null, function* () {
            const boneName = bone.bone;
            const index = bone.node;
            if (boneName == null || index == null) {
              return;
            }
            if (index < 0) {
              console.warn(
                `A glTF node index for the humanoid bone ${boneName} is negative (${index}), ignoring this bone.`
              );
              return;
            }
            const node = yield this.parser.getDependency("node", index);
            if (node == null) {
              console.warn(`A glTF node bound to the humanoid bone ${boneName} (index = ${index}) does not exist`);
              return;
            }
            const thumbBoneName = thumbBoneNameMap[boneName];
            const newBoneName = thumbBoneName != null ? thumbBoneName : boneName;
            if (humanBones[newBoneName] != null) {
              console.warn(
                `Multiple bone entries for ${newBoneName} detected (index = ${index}), ignoring duplicated entries.`
              );
              return;
            }
            humanBones[newBoneName] = { node };
          }))
        );
      }
      const humanoid = new VRMHumanoid(this._ensureRequiredBonesExist(humanBones), {
        autoUpdateHumanBones: this.autoUpdateHumanBones
      });
      gltf.scene.add(humanoid.normalizedHumanBonesRoot);
      if (this.helperRoot) {
        const helper = new VRMHumanoidHelper(humanoid);
        this.helperRoot.add(helper);
        helper.renderOrder = this.helperRoot.renderOrder;
      }
      return humanoid;
    });
  }
  /**
   * Ensure required bones exist in given human bones.
   * @param humanBones Human bones
   * @returns Human bones, no longer partial!
   */
  _ensureRequiredBonesExist(humanBones) {
    const missingRequiredBones = Object.values(VRMRequiredHumanBoneName).filter(
      (requiredBoneName) => humanBones[requiredBoneName] == null
    );
    if (missingRequiredBones.length > 0) {
      throw new Error(
        `VRMHumanoidLoaderPlugin: These humanoid bones are required but not exist: ${missingRequiredBones.join(", ")}`
      );
    }
    return humanBones;
  }
};
var FanBufferGeometry = class extends THREE9.BufferGeometry {
  constructor() {
    super();
    this._currentTheta = 0;
    this._currentRadius = 0;
    this.theta = 0;
    this.radius = 0;
    this._currentTheta = 0;
    this._currentRadius = 0;
    this._attrPos = new THREE9.BufferAttribute(new Float32Array(65 * 3), 3);
    this.setAttribute("position", this._attrPos);
    this._attrIndex = new THREE9.BufferAttribute(new Uint16Array(3 * 63), 1);
    this.setIndex(this._attrIndex);
    this._buildIndex();
    this.update();
  }
  update() {
    let shouldUpdateGeometry = false;
    if (this._currentTheta !== this.theta) {
      this._currentTheta = this.theta;
      shouldUpdateGeometry = true;
    }
    if (this._currentRadius !== this.radius) {
      this._currentRadius = this.radius;
      shouldUpdateGeometry = true;
    }
    if (shouldUpdateGeometry) {
      this._buildPosition();
    }
  }
  _buildPosition() {
    this._attrPos.setXYZ(0, 0, 0, 0);
    for (let i = 0; i < 64; i++) {
      const t = i / 63 * this._currentTheta;
      this._attrPos.setXYZ(i + 1, this._currentRadius * Math.sin(t), 0, this._currentRadius * Math.cos(t));
    }
    this._attrPos.needsUpdate = true;
  }
  _buildIndex() {
    for (let i = 0; i < 63; i++) {
      this._attrIndex.setXYZ(i * 3, 0, i + 1, i + 2);
    }
    this._attrIndex.needsUpdate = true;
  }
};
var LineAndSphereBufferGeometry = class extends THREE10.BufferGeometry {
  constructor() {
    super();
    this.radius = 0;
    this._currentRadius = 0;
    this.tail = new THREE10.Vector3();
    this._currentTail = new THREE10.Vector3();
    this._attrPos = new THREE10.BufferAttribute(new Float32Array(294), 3);
    this.setAttribute("position", this._attrPos);
    this._attrIndex = new THREE10.BufferAttribute(new Uint16Array(194), 1);
    this.setIndex(this._attrIndex);
    this._buildIndex();
    this.update();
  }
  update() {
    let shouldUpdateGeometry = false;
    if (this._currentRadius !== this.radius) {
      this._currentRadius = this.radius;
      shouldUpdateGeometry = true;
    }
    if (!this._currentTail.equals(this.tail)) {
      this._currentTail.copy(this.tail);
      shouldUpdateGeometry = true;
    }
    if (shouldUpdateGeometry) {
      this._buildPosition();
    }
  }
  _buildPosition() {
    for (let i = 0; i < 32; i++) {
      const t = i / 16 * Math.PI;
      this._attrPos.setXYZ(i, Math.cos(t), Math.sin(t), 0);
      this._attrPos.setXYZ(32 + i, 0, Math.cos(t), Math.sin(t));
      this._attrPos.setXYZ(64 + i, Math.sin(t), 0, Math.cos(t));
    }
    this.scale(this._currentRadius, this._currentRadius, this._currentRadius);
    this.translate(this._currentTail.x, this._currentTail.y, this._currentTail.z);
    this._attrPos.setXYZ(96, 0, 0, 0);
    this._attrPos.setXYZ(97, this._currentTail.x, this._currentTail.y, this._currentTail.z);
    this._attrPos.needsUpdate = true;
  }
  _buildIndex() {
    for (let i = 0; i < 32; i++) {
      const i1 = (i + 1) % 32;
      this._attrIndex.setXY(i * 2, i, i1);
      this._attrIndex.setXY(64 + i * 2, 32 + i, 32 + i1);
      this._attrIndex.setXY(128 + i * 2, 64 + i, 64 + i1);
    }
    this._attrIndex.setXY(192, 96, 97);
    this._attrIndex.needsUpdate = true;
  }
};
var _quatA4 = new THREE11.Quaternion();
var _quatB = new THREE11.Quaternion();
var _v3A4 = new THREE11.Vector3();
var _v3B2 = new THREE11.Vector3();
var SQRT_2_OVER_2 = Math.sqrt(2) / 2;
var QUAT_XY_CW90 = new THREE11.Quaternion(0, 0, -SQRT_2_OVER_2, SQRT_2_OVER_2);
var VEC3_POSITIVE_Y = new THREE11.Vector3(0, 1, 0);
var VRMLookAtHelper = class extends THREE11.Group {
  constructor(lookAt) {
    super();
    this.matrixAutoUpdate = false;
    this.vrmLookAt = lookAt;
    {
      const geometry = new FanBufferGeometry();
      geometry.radius = 0.5;
      const material = new THREE11.MeshBasicMaterial({
        color: 65280,
        transparent: true,
        opacity: 0.5,
        side: THREE11.DoubleSide,
        depthTest: false,
        depthWrite: false
      });
      this._meshPitch = new THREE11.Mesh(geometry, material);
      this.add(this._meshPitch);
    }
    {
      const geometry = new FanBufferGeometry();
      geometry.radius = 0.5;
      const material = new THREE11.MeshBasicMaterial({
        color: 16711680,
        transparent: true,
        opacity: 0.5,
        side: THREE11.DoubleSide,
        depthTest: false,
        depthWrite: false
      });
      this._meshYaw = new THREE11.Mesh(geometry, material);
      this.add(this._meshYaw);
    }
    {
      const geometry = new LineAndSphereBufferGeometry();
      geometry.radius = 0.1;
      const material = new THREE11.LineBasicMaterial({
        color: 16777215,
        depthTest: false,
        depthWrite: false
      });
      this._lineTarget = new THREE11.LineSegments(geometry, material);
      this._lineTarget.frustumCulled = false;
      this.add(this._lineTarget);
    }
  }
  dispose() {
    this._meshYaw.geometry.dispose();
    this._meshYaw.material.dispose();
    this._meshPitch.geometry.dispose();
    this._meshPitch.material.dispose();
    this._lineTarget.geometry.dispose();
    this._lineTarget.material.dispose();
  }
  updateMatrixWorld(force) {
    const yaw = THREE11.MathUtils.DEG2RAD * this.vrmLookAt.yaw;
    this._meshYaw.geometry.theta = yaw;
    this._meshYaw.geometry.update();
    const pitch = THREE11.MathUtils.DEG2RAD * this.vrmLookAt.pitch;
    this._meshPitch.geometry.theta = pitch;
    this._meshPitch.geometry.update();
    this.vrmLookAt.getLookAtWorldPosition(_v3A4);
    this.vrmLookAt.getLookAtWorldQuaternion(_quatA4);
    _quatA4.multiply(this.vrmLookAt.getFaceFrontQuaternion(_quatB));
    this._meshYaw.position.copy(_v3A4);
    this._meshYaw.quaternion.copy(_quatA4);
    this._meshPitch.position.copy(_v3A4);
    this._meshPitch.quaternion.copy(_quatA4);
    this._meshPitch.quaternion.multiply(_quatB.setFromAxisAngle(VEC3_POSITIVE_Y, yaw));
    this._meshPitch.quaternion.multiply(QUAT_XY_CW90);
    const { target, autoUpdate } = this.vrmLookAt;
    if (target != null && autoUpdate) {
      target.getWorldPosition(_v3B2).sub(_v3A4);
      this._lineTarget.geometry.tail.copy(_v3B2);
      this._lineTarget.geometry.update();
      this._lineTarget.position.copy(_v3A4);
    }
    super.updateMatrixWorld(force);
  }
};
var _position = new THREE12.Vector3();
var _scale = new THREE12.Vector3();
function getWorldQuaternionLite(object, out) {
  object.matrixWorld.decompose(_position, out, _scale);
  return out;
}
function calcAzimuthAltitude(vector) {
  return [Math.atan2(-vector.z, vector.x), Math.atan2(vector.y, Math.sqrt(vector.x * vector.x + vector.z * vector.z))];
}
function sanitizeAngle(angle) {
  const roundTurn = Math.round(angle / 2 / Math.PI);
  return angle - 2 * Math.PI * roundTurn;
}
var VEC3_POSITIVE_Z = new THREE13.Vector3(0, 0, 1);
var _v3A5 = new THREE13.Vector3();
var _v3B3 = new THREE13.Vector3();
var _v3C = new THREE13.Vector3();
var _quatA5 = new THREE13.Quaternion();
var _quatB2 = new THREE13.Quaternion();
var _quatC = new THREE13.Quaternion();
var _quatD = new THREE13.Quaternion();
var _eulerA = new THREE13.Euler();
var _VRMLookAt = class _VRMLookAt2 {
  /**
   * Create a new {@link VRMLookAt}.
   *
   * @param humanoid A {@link VRMHumanoid}
   * @param applier A {@link VRMLookAtApplier}
   */
  constructor(humanoid, applier) {
    this.offsetFromHeadBone = new THREE13.Vector3();
    this.autoUpdate = true;
    this.faceFront = new THREE13.Vector3(0, 0, 1);
    this.humanoid = humanoid;
    this.applier = applier;
    this._yaw = 0;
    this._pitch = 0;
    this._needsUpdate = true;
    this._restHeadWorldQuaternion = this.getLookAtWorldQuaternion(new THREE13.Quaternion());
  }
  /**
   * Its current angle around Y axis, in degree.
   */
  get yaw() {
    return this._yaw;
  }
  /**
   * Its current angle around Y axis, in degree.
   */
  set yaw(value) {
    this._yaw = value;
    this._needsUpdate = true;
  }
  /**
   * Its current angle around X axis, in degree.
   */
  get pitch() {
    return this._pitch;
  }
  /**
   * Its current angle around X axis, in degree.
   */
  set pitch(value) {
    this._pitch = value;
    this._needsUpdate = true;
  }
  /**
   * @deprecated Use {@link getEuler} instead.
   */
  get euler() {
    console.warn("VRMLookAt: euler is deprecated. use getEuler() instead.");
    return this.getEuler(new THREE13.Euler());
  }
  /**
   * Get its yaw-pitch angles as an `Euler`.
   * Does NOT consider {@link faceFront}; it returns `Euler(0, 0, 0; "YXZ")` by default regardless of the faceFront value.
   *
   * @param target The target euler
   */
  getEuler(target) {
    return target.set(THREE13.MathUtils.DEG2RAD * this._pitch, THREE13.MathUtils.DEG2RAD * this._yaw, 0, "YXZ");
  }
  /**
   * Copy the given {@link VRMLookAt} into this one.
   * {@link humanoid} must be same as the source one.
   * {@link applier} will reference the same instance as the source one.
   * @param source The {@link VRMLookAt} you want to copy
   * @returns this
   */
  copy(source) {
    if (this.humanoid !== source.humanoid) {
      throw new Error("VRMLookAt: humanoid must be same in order to copy");
    }
    this.offsetFromHeadBone.copy(source.offsetFromHeadBone);
    this.applier = source.applier;
    this.autoUpdate = source.autoUpdate;
    this.target = source.target;
    this.faceFront.copy(source.faceFront);
    return this;
  }
  /**
   * Returns a clone of this {@link VRMLookAt}.
   * Note that {@link humanoid} and {@link applier} will reference the same instance as this one.
   * @returns Copied {@link VRMLookAt}
   */
  clone() {
    return new _VRMLookAt2(this.humanoid, this.applier).copy(this);
  }
  /**
   * Reset the lookAt direction (yaw and pitch) to the initial direction.
   */
  reset() {
    this._yaw = 0;
    this._pitch = 0;
    this._needsUpdate = true;
  }
  /**
   * Get its lookAt position in world coordinate.
   *
   * @param target A target `THREE.Vector3`
   */
  getLookAtWorldPosition(target) {
    const head = this.humanoid.getRawBoneNode("head");
    return target.copy(this.offsetFromHeadBone).applyMatrix4(head.matrixWorld);
  }
  /**
   * Get its lookAt rotation in world coordinate.
   * Does NOT consider {@link faceFront}.
   *
   * @param target A target `THREE.Quaternion`
   */
  getLookAtWorldQuaternion(target) {
    const head = this.humanoid.getRawBoneNode("head");
    return getWorldQuaternionLite(head, target);
  }
  /**
   * Get a quaternion that rotates the +Z unit vector of the humanoid Head to the {@link faceFront} direction.
   *
   * @param target A target `THREE.Quaternion`
   */
  getFaceFrontQuaternion(target) {
    if (this.faceFront.distanceToSquared(VEC3_POSITIVE_Z) < 0.01) {
      return target.copy(this._restHeadWorldQuaternion).invert();
    }
    const [faceFrontAzimuth, faceFrontAltitude] = calcAzimuthAltitude(this.faceFront);
    _eulerA.set(0, 0.5 * Math.PI + faceFrontAzimuth, faceFrontAltitude, "YZX");
    return target.setFromEuler(_eulerA).premultiply(_quatD.copy(this._restHeadWorldQuaternion).invert());
  }
  /**
   * Get its LookAt direction in world coordinate.
   *
   * @param target A target `THREE.Vector3`
   */
  getLookAtWorldDirection(target) {
    this.getLookAtWorldQuaternion(_quatB2);
    this.getFaceFrontQuaternion(_quatC);
    return target.copy(VEC3_POSITIVE_Z).applyQuaternion(_quatB2).applyQuaternion(_quatC).applyEuler(this.getEuler(_eulerA));
  }
  /**
   * Set its lookAt target position.
   *
   * Note that its result will be instantly overwritten if {@link VRMLookAtHead.autoUpdate} is enabled.
   *
   * If you want to track an object continuously, you might want to use {@link target} instead.
   *
   * @param position A target position, in world space
   */
  lookAt(position) {
    const headRotDiffInv = _quatA5.copy(this._restHeadWorldQuaternion).multiply(quatInvertCompat(this.getLookAtWorldQuaternion(_quatB2)));
    const headPos = this.getLookAtWorldPosition(_v3B3);
    const lookAtDir = _v3C.copy(position).sub(headPos).applyQuaternion(headRotDiffInv).normalize();
    const [azimuthFrom, altitudeFrom] = calcAzimuthAltitude(this.faceFront);
    const [azimuthTo, altitudeTo] = calcAzimuthAltitude(lookAtDir);
    const yaw = sanitizeAngle(azimuthTo - azimuthFrom);
    const pitch = sanitizeAngle(altitudeFrom - altitudeTo);
    this._yaw = THREE13.MathUtils.RAD2DEG * yaw;
    this._pitch = THREE13.MathUtils.RAD2DEG * pitch;
    this._needsUpdate = true;
  }
  /**
   * Update the VRMLookAtHead.
   * If {@link autoUpdate} is enabled, this will make it look at the {@link target}.
   *
   * @param delta deltaTime, it isn't used though. You can use the parameter if you want to use this in your own extended {@link VRMLookAt}.
   */
  update(delta) {
    if (this.target != null && this.autoUpdate) {
      this.lookAt(this.target.getWorldPosition(_v3A5));
    }
    if (this._needsUpdate) {
      this._needsUpdate = false;
      this.applier.applyYawPitch(this._yaw, this._pitch);
    }
  }
};
_VRMLookAt.EULER_ORDER = "YXZ";
var VRMLookAt = _VRMLookAt;
var VEC3_POSITIVE_Z2 = new THREE14.Vector3(0, 0, 1);
var _quatA6 = new THREE14.Quaternion();
var _quatB3 = new THREE14.Quaternion();
var _eulerA2 = new THREE14.Euler(0, 0, 0, "YXZ");
var VRMLookAtBoneApplier = class {
  /**
   * Create a new {@link VRMLookAtBoneApplier}.
   *
   * @param humanoid A {@link VRMHumanoid}
   * @param rangeMapHorizontalInner A {@link VRMLookAtRangeMap} used for inner transverse direction
   * @param rangeMapHorizontalOuter A {@link VRMLookAtRangeMap} used for outer transverse direction
   * @param rangeMapVerticalDown A {@link VRMLookAtRangeMap} used for down direction
   * @param rangeMapVerticalUp A {@link VRMLookAtRangeMap} used for up direction
   */
  constructor(humanoid, rangeMapHorizontalInner, rangeMapHorizontalOuter, rangeMapVerticalDown, rangeMapVerticalUp) {
    this.humanoid = humanoid;
    this.rangeMapHorizontalInner = rangeMapHorizontalInner;
    this.rangeMapHorizontalOuter = rangeMapHorizontalOuter;
    this.rangeMapVerticalDown = rangeMapVerticalDown;
    this.rangeMapVerticalUp = rangeMapVerticalUp;
    this.faceFront = new THREE14.Vector3(0, 0, 1);
    this._restQuatLeftEye = new THREE14.Quaternion();
    this._restQuatRightEye = new THREE14.Quaternion();
    this._restLeftEyeParentWorldQuat = new THREE14.Quaternion();
    this._restRightEyeParentWorldQuat = new THREE14.Quaternion();
    const leftEye = this.humanoid.getRawBoneNode("leftEye");
    const rightEye = this.humanoid.getRawBoneNode("rightEye");
    if (leftEye) {
      this._restQuatLeftEye.copy(leftEye.quaternion);
      getWorldQuaternionLite(leftEye.parent, this._restLeftEyeParentWorldQuat);
    }
    if (rightEye) {
      this._restQuatRightEye.copy(rightEye.quaternion);
      getWorldQuaternionLite(rightEye.parent, this._restRightEyeParentWorldQuat);
    }
  }
  /**
   * Apply the input angle to its associated VRM model.
   *
   * @param yaw Rotation around Y axis, in degree
   * @param pitch Rotation around X axis, in degree
   */
  applyYawPitch(yaw, pitch) {
    const leftEye = this.humanoid.getRawBoneNode("leftEye");
    const rightEye = this.humanoid.getRawBoneNode("rightEye");
    const leftEyeNormalized = this.humanoid.getNormalizedBoneNode("leftEye");
    const rightEyeNormalized = this.humanoid.getNormalizedBoneNode("rightEye");
    if (leftEye) {
      if (pitch < 0) {
        _eulerA2.x = -THREE14.MathUtils.DEG2RAD * this.rangeMapVerticalDown.map(-pitch);
      } else {
        _eulerA2.x = THREE14.MathUtils.DEG2RAD * this.rangeMapVerticalUp.map(pitch);
      }
      if (yaw < 0) {
        _eulerA2.y = -THREE14.MathUtils.DEG2RAD * this.rangeMapHorizontalInner.map(-yaw);
      } else {
        _eulerA2.y = THREE14.MathUtils.DEG2RAD * this.rangeMapHorizontalOuter.map(yaw);
      }
      _quatA6.setFromEuler(_eulerA2);
      this._getWorldFaceFrontQuat(_quatB3);
      leftEyeNormalized.quaternion.copy(_quatB3).multiply(_quatA6).multiply(_quatB3.invert());
      _quatA6.copy(this._restLeftEyeParentWorldQuat);
      leftEye.quaternion.copy(leftEyeNormalized.quaternion).multiply(_quatA6).premultiply(_quatA6.invert()).multiply(this._restQuatLeftEye);
    }
    if (rightEye) {
      if (pitch < 0) {
        _eulerA2.x = -THREE14.MathUtils.DEG2RAD * this.rangeMapVerticalDown.map(-pitch);
      } else {
        _eulerA2.x = THREE14.MathUtils.DEG2RAD * this.rangeMapVerticalUp.map(pitch);
      }
      if (yaw < 0) {
        _eulerA2.y = -THREE14.MathUtils.DEG2RAD * this.rangeMapHorizontalOuter.map(-yaw);
      } else {
        _eulerA2.y = THREE14.MathUtils.DEG2RAD * this.rangeMapHorizontalInner.map(yaw);
      }
      _quatA6.setFromEuler(_eulerA2);
      this._getWorldFaceFrontQuat(_quatB3);
      rightEyeNormalized.quaternion.copy(_quatB3).multiply(_quatA6).multiply(_quatB3.invert());
      _quatA6.copy(this._restRightEyeParentWorldQuat);
      rightEye.quaternion.copy(rightEyeNormalized.quaternion).multiply(_quatA6).premultiply(_quatA6.invert()).multiply(this._restQuatRightEye);
    }
  }
  /**
   * @deprecated Use {@link applyYawPitch} instead.
   */
  lookAt(euler) {
    console.warn("VRMLookAtBoneApplier: lookAt() is deprecated. use apply() instead.");
    const yaw = THREE14.MathUtils.RAD2DEG * euler.y;
    const pitch = THREE14.MathUtils.RAD2DEG * euler.x;
    this.applyYawPitch(yaw, pitch);
  }
  /**
   * Get a quaternion that rotates the world-space +Z unit vector to the {@link faceFront} direction.
   *
   * @param target A target `THREE.Quaternion`
   */
  _getWorldFaceFrontQuat(target) {
    if (this.faceFront.distanceToSquared(VEC3_POSITIVE_Z2) < 0.01) {
      return target.identity();
    }
    const [faceFrontAzimuth, faceFrontAltitude] = calcAzimuthAltitude(this.faceFront);
    _eulerA2.set(0, 0.5 * Math.PI + faceFrontAzimuth, faceFrontAltitude, "YZX");
    return target.setFromEuler(_eulerA2);
  }
};
VRMLookAtBoneApplier.type = "bone";
var VRMLookAtExpressionApplier = class {
  /**
   * Create a new {@link VRMLookAtExpressionApplier}.
   *
   * @param expressions A {@link VRMExpressionManager}
   * @param rangeMapHorizontalInner A {@link VRMLookAtRangeMap} used for inner transverse direction
   * @param rangeMapHorizontalOuter A {@link VRMLookAtRangeMap} used for outer transverse direction
   * @param rangeMapVerticalDown A {@link VRMLookAtRangeMap} used for down direction
   * @param rangeMapVerticalUp A {@link VRMLookAtRangeMap} used for up direction
   */
  constructor(expressions, rangeMapHorizontalInner, rangeMapHorizontalOuter, rangeMapVerticalDown, rangeMapVerticalUp) {
    this.expressions = expressions;
    this.rangeMapHorizontalInner = rangeMapHorizontalInner;
    this.rangeMapHorizontalOuter = rangeMapHorizontalOuter;
    this.rangeMapVerticalDown = rangeMapVerticalDown;
    this.rangeMapVerticalUp = rangeMapVerticalUp;
  }
  /**
   * Apply the input angle to its associated VRM model.
   *
   * @param yaw Rotation around Y axis, in degree
   * @param pitch Rotation around X axis, in degree
   */
  applyYawPitch(yaw, pitch) {
    if (pitch < 0) {
      this.expressions.setValue("lookDown", 0);
      this.expressions.setValue("lookUp", this.rangeMapVerticalUp.map(-pitch));
    } else {
      this.expressions.setValue("lookUp", 0);
      this.expressions.setValue("lookDown", this.rangeMapVerticalDown.map(pitch));
    }
    if (yaw < 0) {
      this.expressions.setValue("lookLeft", 0);
      this.expressions.setValue("lookRight", this.rangeMapHorizontalOuter.map(-yaw));
    } else {
      this.expressions.setValue("lookRight", 0);
      this.expressions.setValue("lookLeft", this.rangeMapHorizontalOuter.map(yaw));
    }
  }
  /**
   * @deprecated Use {@link applyYawPitch} instead.
   */
  lookAt(euler) {
    console.warn("VRMLookAtBoneApplier: lookAt() is deprecated. use apply() instead.");
    const yaw = THREE15.MathUtils.RAD2DEG * euler.y;
    const pitch = THREE15.MathUtils.RAD2DEG * euler.x;
    this.applyYawPitch(yaw, pitch);
  }
};
VRMLookAtExpressionApplier.type = "expression";
var VRMLookAtRangeMap = class {
  /**
   * Create a new {@link VRMLookAtRangeMap}.
   *
   * @param inputMaxValue The {@link inputMaxValue} of the map
   * @param outputScale The {@link outputScale} of the map
   */
  constructor(inputMaxValue, outputScale) {
    this.inputMaxValue = inputMaxValue;
    this.outputScale = outputScale;
  }
  /**
   * Evaluate an input value and output a mapped value.
   * @param src The input value
   */
  map(src) {
    return this.outputScale * saturate(src / this.inputMaxValue);
  }
};
var POSSIBLE_SPEC_VERSIONS4 = /* @__PURE__ */ new Set(["1.0", "1.0-beta"]);
var INPUT_MAX_VALUE_MINIMUM = 0.01;
var VRMLookAtLoaderPlugin = class {
  get name() {
    return "VRMLookAtLoaderPlugin";
  }
  constructor(parser, options) {
    this.parser = parser;
    this.helperRoot = options == null ? void 0 : options.helperRoot;
  }
  afterRoot(gltf) {
    return __async2(this, null, function* () {
      const vrmHumanoid = gltf.userData.vrmHumanoid;
      if (vrmHumanoid === null) {
        return;
      } else if (vrmHumanoid === void 0) {
        throw new Error("VRMLookAtLoaderPlugin: vrmHumanoid is undefined. VRMHumanoidLoaderPlugin have to be used first");
      }
      const vrmExpressionManager = gltf.userData.vrmExpressionManager;
      if (vrmExpressionManager === null) {
        return;
      } else if (vrmExpressionManager === void 0) {
        throw new Error(
          "VRMLookAtLoaderPlugin: vrmExpressionManager is undefined. VRMExpressionLoaderPlugin have to be used first"
        );
      }
      gltf.userData.vrmLookAt = yield this._import(gltf, vrmHumanoid, vrmExpressionManager);
    });
  }
  /**
   * Import a {@link VRMLookAt} from a VRM.
   *
   * @param gltf A parsed result of GLTF taken from GLTFLoader
   * @param humanoid A {@link VRMHumanoid} instance that represents the VRM
   * @param expressions A {@link VRMExpressionManager} instance that represents the VRM
   */
  _import(gltf, humanoid, expressions) {
    return __async2(this, null, function* () {
      if (humanoid == null || expressions == null) {
        return null;
      }
      const v1Result = yield this._v1Import(gltf, humanoid, expressions);
      if (v1Result) {
        return v1Result;
      }
      const v0Result = yield this._v0Import(gltf, humanoid, expressions);
      if (v0Result) {
        return v0Result;
      }
      return null;
    });
  }
  _v1Import(gltf, humanoid, expressions) {
    return __async2(this, null, function* () {
      var _a, _b, _c;
      const json = this.parser.json;
      const isVRMUsed = ((_a = json.extensionsUsed) == null ? void 0 : _a.indexOf("VRMC_vrm")) !== -1;
      if (!isVRMUsed) {
        return null;
      }
      const extension = (_b = json.extensions) == null ? void 0 : _b["VRMC_vrm"];
      if (!extension) {
        return null;
      }
      const specVersion = extension.specVersion;
      if (!POSSIBLE_SPEC_VERSIONS4.has(specVersion)) {
        console.warn(`VRMLookAtLoaderPlugin: Unknown VRMC_vrm specVersion "${specVersion}"`);
        return null;
      }
      const schemaLookAt = extension.lookAt;
      if (!schemaLookAt) {
        return null;
      }
      const defaultOutputScale = schemaLookAt.type === "expression" ? 1 : 10;
      const mapHI = this._v1ImportRangeMap(schemaLookAt.rangeMapHorizontalInner, defaultOutputScale);
      const mapHO = this._v1ImportRangeMap(schemaLookAt.rangeMapHorizontalOuter, defaultOutputScale);
      const mapVD = this._v1ImportRangeMap(schemaLookAt.rangeMapVerticalDown, defaultOutputScale);
      const mapVU = this._v1ImportRangeMap(schemaLookAt.rangeMapVerticalUp, defaultOutputScale);
      let applier;
      if (schemaLookAt.type === "expression") {
        applier = new VRMLookAtExpressionApplier(expressions, mapHI, mapHO, mapVD, mapVU);
      } else {
        applier = new VRMLookAtBoneApplier(humanoid, mapHI, mapHO, mapVD, mapVU);
      }
      const lookAt = this._importLookAt(humanoid, applier);
      lookAt.offsetFromHeadBone.fromArray((_c = schemaLookAt.offsetFromHeadBone) != null ? _c : [0, 0.06, 0]);
      return lookAt;
    });
  }
  _v1ImportRangeMap(schemaRangeMap, defaultOutputScale) {
    var _a, _b;
    let inputMaxValue = (_a = schemaRangeMap == null ? void 0 : schemaRangeMap.inputMaxValue) != null ? _a : 90;
    const outputScale = (_b = schemaRangeMap == null ? void 0 : schemaRangeMap.outputScale) != null ? _b : defaultOutputScale;
    if (inputMaxValue < INPUT_MAX_VALUE_MINIMUM) {
      console.warn(
        "VRMLookAtLoaderPlugin: inputMaxValue of a range map is too small. Consider reviewing the range map!"
      );
      inputMaxValue = INPUT_MAX_VALUE_MINIMUM;
    }
    return new VRMLookAtRangeMap(inputMaxValue, outputScale);
  }
  _v0Import(gltf, humanoid, expressions) {
    return __async2(this, null, function* () {
      var _a, _b, _c, _d;
      const json = this.parser.json;
      const vrmExt = (_a = json.extensions) == null ? void 0 : _a.VRM;
      if (!vrmExt) {
        return null;
      }
      const schemaFirstPerson = vrmExt.firstPerson;
      if (!schemaFirstPerson) {
        return null;
      }
      const defaultOutputScale = schemaFirstPerson.lookAtTypeName === "BlendShape" ? 1 : 10;
      const mapHI = this._v0ImportDegreeMap(schemaFirstPerson.lookAtHorizontalInner, defaultOutputScale);
      const mapHO = this._v0ImportDegreeMap(schemaFirstPerson.lookAtHorizontalOuter, defaultOutputScale);
      const mapVD = this._v0ImportDegreeMap(schemaFirstPerson.lookAtVerticalDown, defaultOutputScale);
      const mapVU = this._v0ImportDegreeMap(schemaFirstPerson.lookAtVerticalUp, defaultOutputScale);
      let applier;
      if (schemaFirstPerson.lookAtTypeName === "BlendShape") {
        applier = new VRMLookAtExpressionApplier(expressions, mapHI, mapHO, mapVD, mapVU);
      } else {
        applier = new VRMLookAtBoneApplier(humanoid, mapHI, mapHO, mapVD, mapVU);
      }
      const lookAt = this._importLookAt(humanoid, applier);
      if (schemaFirstPerson.firstPersonBoneOffset) {
        lookAt.offsetFromHeadBone.set(
          (_b = schemaFirstPerson.firstPersonBoneOffset.x) != null ? _b : 0,
          (_c = schemaFirstPerson.firstPersonBoneOffset.y) != null ? _c : 0.06,
          -((_d = schemaFirstPerson.firstPersonBoneOffset.z) != null ? _d : 0)
        );
      } else {
        lookAt.offsetFromHeadBone.set(0, 0.06, 0);
      }
      lookAt.faceFront.set(0, 0, -1);
      if (applier instanceof VRMLookAtBoneApplier) {
        applier.faceFront.set(0, 0, -1);
      }
      return lookAt;
    });
  }
  _v0ImportDegreeMap(schemaDegreeMap, defaultOutputScale) {
    var _a, _b;
    const curve = schemaDegreeMap == null ? void 0 : schemaDegreeMap.curve;
    if (JSON.stringify(curve) !== "[0,0,0,1,1,1,1,0]") {
      console.warn("Curves of LookAtDegreeMap defined in VRM 0.0 are not supported");
    }
    let xRange = (_a = schemaDegreeMap == null ? void 0 : schemaDegreeMap.xRange) != null ? _a : 90;
    const yRange = (_b = schemaDegreeMap == null ? void 0 : schemaDegreeMap.yRange) != null ? _b : defaultOutputScale;
    if (xRange < INPUT_MAX_VALUE_MINIMUM) {
      console.warn("VRMLookAtLoaderPlugin: xRange of a degree map is too small. Consider reviewing the degree map!");
      xRange = INPUT_MAX_VALUE_MINIMUM;
    }
    return new VRMLookAtRangeMap(xRange, yRange);
  }
  _importLookAt(humanoid, applier) {
    const lookAt = new VRMLookAt(humanoid, applier);
    if (this.helperRoot) {
      const helper = new VRMLookAtHelper(lookAt);
      this.helperRoot.add(helper);
      helper.renderOrder = this.helperRoot.renderOrder;
    }
    return lookAt;
  }
};
var VRMLookAtTypeName = {
  Bone: "bone",
  Expression: "expression"
};
function resolveURL(url, path) {
  if (typeof url !== "string" || url === "") return "";
  if (/^https?:\/\//i.test(path) && /^\//.test(url)) {
    path = path.replace(/(^https?:\/\/[^/]+).*/i, "$1");
  }
  if (/^(https?:)?\/\//i.test(url)) return url;
  if (/^data:.*,.*$/i.test(url)) return url;
  if (/^blob:.*$/i.test(url)) return url;
  return path + url;
}
var POSSIBLE_SPEC_VERSIONS5 = /* @__PURE__ */ new Set(["1.0", "1.0-beta"]);
var VRMMetaLoaderPlugin = class {
  get name() {
    return "VRMMetaLoaderPlugin";
  }
  constructor(parser, options) {
    var _a, _b, _c;
    this.parser = parser;
    this.needThumbnailImage = (_a = options == null ? void 0 : options.needThumbnailImage) != null ? _a : false;
    this.acceptLicenseUrls = (_b = options == null ? void 0 : options.acceptLicenseUrls) != null ? _b : ["https://vrm.dev/licenses/1.0/"];
    this.acceptV0Meta = (_c = options == null ? void 0 : options.acceptV0Meta) != null ? _c : true;
  }
  afterRoot(gltf) {
    return __async2(this, null, function* () {
      gltf.userData.vrmMeta = yield this._import(gltf);
    });
  }
  _import(gltf) {
    return __async2(this, null, function* () {
      const v1Result = yield this._v1Import(gltf);
      if (v1Result != null) {
        return v1Result;
      }
      const v0Result = yield this._v0Import(gltf);
      if (v0Result != null) {
        return v0Result;
      }
      return null;
    });
  }
  _v1Import(gltf) {
    return __async2(this, null, function* () {
      var _a, _b, _c;
      const json = this.parser.json;
      const isVRMUsed = ((_a = json.extensionsUsed) == null ? void 0 : _a.indexOf("VRMC_vrm")) !== -1;
      if (!isVRMUsed) {
        return null;
      }
      const extension = (_b = json.extensions) == null ? void 0 : _b["VRMC_vrm"];
      if (extension == null) {
        return null;
      }
      const specVersion = extension.specVersion;
      if (!POSSIBLE_SPEC_VERSIONS5.has(specVersion)) {
        console.warn(`VRMMetaLoaderPlugin: Unknown VRMC_vrm specVersion "${specVersion}"`);
        return null;
      }
      const schemaMeta = extension.meta;
      if (!schemaMeta) {
        return null;
      }
      const licenseUrl = schemaMeta.licenseUrl;
      const acceptLicenseUrlsSet = new Set(this.acceptLicenseUrls);
      if (!acceptLicenseUrlsSet.has(licenseUrl)) {
        throw new Error(`VRMMetaLoaderPlugin: The license url "${licenseUrl}" is not accepted`);
      }
      let thumbnailImage = void 0;
      if (this.needThumbnailImage && schemaMeta.thumbnailImage != null) {
        thumbnailImage = (_c = yield this._extractGLTFImage(schemaMeta.thumbnailImage)) != null ? _c : void 0;
      }
      return {
        metaVersion: "1",
        name: schemaMeta.name,
        version: schemaMeta.version,
        authors: schemaMeta.authors,
        copyrightInformation: schemaMeta.copyrightInformation,
        contactInformation: schemaMeta.contactInformation,
        references: schemaMeta.references,
        thirdPartyLicenses: schemaMeta.thirdPartyLicenses,
        thumbnailImage,
        licenseUrl: schemaMeta.licenseUrl,
        avatarPermission: schemaMeta.avatarPermission,
        allowExcessivelyViolentUsage: schemaMeta.allowExcessivelyViolentUsage,
        allowExcessivelySexualUsage: schemaMeta.allowExcessivelySexualUsage,
        commercialUsage: schemaMeta.commercialUsage,
        allowPoliticalOrReligiousUsage: schemaMeta.allowPoliticalOrReligiousUsage,
        allowAntisocialOrHateUsage: schemaMeta.allowAntisocialOrHateUsage,
        creditNotation: schemaMeta.creditNotation,
        allowRedistribution: schemaMeta.allowRedistribution,
        modification: schemaMeta.modification,
        otherLicenseUrl: schemaMeta.otherLicenseUrl
      };
    });
  }
  _v0Import(gltf) {
    return __async2(this, null, function* () {
      var _a;
      const json = this.parser.json;
      const vrmExt = (_a = json.extensions) == null ? void 0 : _a.VRM;
      if (!vrmExt) {
        return null;
      }
      const schemaMeta = vrmExt.meta;
      if (!schemaMeta) {
        return null;
      }
      if (!this.acceptV0Meta) {
        throw new Error("VRMMetaLoaderPlugin: Attempted to load VRM0.0 meta but acceptV0Meta is false");
      }
      let texture;
      if (this.needThumbnailImage && schemaMeta.texture != null && schemaMeta.texture !== -1) {
        texture = yield this.parser.getDependency("texture", schemaMeta.texture);
      }
      return {
        metaVersion: "0",
        allowedUserName: schemaMeta.allowedUserName,
        author: schemaMeta.author,
        commercialUssageName: schemaMeta.commercialUssageName,
        contactInformation: schemaMeta.contactInformation,
        licenseName: schemaMeta.licenseName,
        otherLicenseUrl: schemaMeta.otherLicenseUrl,
        otherPermissionUrl: schemaMeta.otherPermissionUrl,
        reference: schemaMeta.reference,
        sexualUssageName: schemaMeta.sexualUssageName,
        texture: texture != null ? texture : void 0,
        title: schemaMeta.title,
        version: schemaMeta.version,
        violentUssageName: schemaMeta.violentUssageName
      };
    });
  }
  _extractGLTFImage(index) {
    return __async2(this, null, function* () {
      var _a;
      const json = this.parser.json;
      const source = (_a = json.images) == null ? void 0 : _a[index];
      if (source == null) {
        console.warn(
          `VRMMetaLoaderPlugin: Attempt to use images[${index}] of glTF as a thumbnail but the image doesn't exist`
        );
        return null;
      }
      let sourceURI = source.uri;
      if (source.bufferView != null) {
        const bufferView = yield this.parser.getDependency("bufferView", source.bufferView);
        const blob = new Blob([bufferView], { type: source.mimeType });
        sourceURI = URL.createObjectURL(blob);
      }
      if (sourceURI == null) {
        console.warn(
          `VRMMetaLoaderPlugin: Attempt to use images[${index}] of glTF as a thumbnail but the image couldn't load properly`
        );
        return null;
      }
      const loader = new THREE16.ImageLoader();
      return yield loader.loadAsync(resolveURL(sourceURI, this.parser.options.path)).catch((error) => {
        console.error(error);
        console.warn("VRMMetaLoaderPlugin: Failed to load a thumbnail image");
        return null;
      });
    });
  }
};
var VRMCore = class {
  /**
   * Create a new VRM instance.
   *
   * @param params {@link VRMParameters} that represents components of the VRM
   */
  constructor(params) {
    this.scene = params.scene;
    this.meta = params.meta;
    this.humanoid = params.humanoid;
    this.expressionManager = params.expressionManager;
    this.firstPerson = params.firstPerson;
    this.lookAt = params.lookAt;
  }
  /**
   * **You need to call this on your update loop.**
   *
   * This function updates every VRM components.
   *
   * @param delta deltaTime
   */
  update(delta) {
    this.humanoid.update();
    if (this.lookAt) {
      this.lookAt.update(delta);
    }
    if (this.expressionManager) {
      this.expressionManager.update();
    }
  }
};
var VRMCoreLoaderPlugin = class {
  get name() {
    return "VRMC_vrm";
  }
  constructor(parser, options) {
    var _a, _b, _c, _d, _e;
    this.parser = parser;
    const helperRoot = options == null ? void 0 : options.helperRoot;
    const autoUpdateHumanBones = options == null ? void 0 : options.autoUpdateHumanBones;
    this.expressionPlugin = (_a = options == null ? void 0 : options.expressionPlugin) != null ? _a : new VRMExpressionLoaderPlugin(parser);
    this.firstPersonPlugin = (_b = options == null ? void 0 : options.firstPersonPlugin) != null ? _b : new VRMFirstPersonLoaderPlugin(parser);
    this.humanoidPlugin = (_c = options == null ? void 0 : options.humanoidPlugin) != null ? _c : new VRMHumanoidLoaderPlugin(parser, { helperRoot, autoUpdateHumanBones });
    this.lookAtPlugin = (_d = options == null ? void 0 : options.lookAtPlugin) != null ? _d : new VRMLookAtLoaderPlugin(parser, { helperRoot });
    this.metaPlugin = (_e = options == null ? void 0 : options.metaPlugin) != null ? _e : new VRMMetaLoaderPlugin(parser);
  }
  afterRoot(gltf) {
    return __async2(this, null, function* () {
      yield this.metaPlugin.afterRoot(gltf);
      yield this.humanoidPlugin.afterRoot(gltf);
      yield this.expressionPlugin.afterRoot(gltf);
      yield this.lookAtPlugin.afterRoot(gltf);
      yield this.firstPersonPlugin.afterRoot(gltf);
      const meta = gltf.userData.vrmMeta;
      const humanoid = gltf.userData.vrmHumanoid;
      if (meta && humanoid) {
        const vrmCore = new VRMCore({
          scene: gltf.scene,
          expressionManager: gltf.userData.vrmExpressionManager,
          firstPerson: gltf.userData.vrmFirstPerson,
          humanoid,
          lookAt: gltf.userData.vrmLookAt,
          meta
        });
        gltf.userData.vrmCore = vrmCore;
      }
    });
  }
};

// src/VRM.ts
var VRM = class extends VRMCore {
  /**
   * Create a new VRM instance.
   *
   * @param params {@link VRMParameters} that represents components of the VRM
   */
  constructor(params) {
    super(params);
    this.materials = params.materials;
    this.springBoneManager = params.springBoneManager;
    this.nodeConstraintManager = params.nodeConstraintManager;
  }
  /**
   * **You need to call this on your update loop.**
   *
   * This function updates every VRM components.
   *
   * @param delta deltaTime
   */
  update(delta) {
    super.update(delta);
    if (this.nodeConstraintManager) {
      this.nodeConstraintManager.update();
    }
    if (this.springBoneManager) {
      this.springBoneManager.update(delta);
    }
    if (this.materials) {
      this.materials.forEach((material) => {
        if (material.update) {
          material.update(delta);
        }
      });
    }
  }
};

// ../three-vrm-materials-mtoon/lib/three-vrm-materials-mtoon.module.js
import * as THREE52 from "./three.js";
import * as THREE22 from "./three.js";
import * as THREE17 from "./three.js";
import * as THREE42 from "./three.js";
import * as THREE32 from "./three.js";
var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __async3 = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
var colorSpaceEncodingMap = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "": 3e3,
  srgb: 3001
};
function setTextureColorSpace(texture, colorSpace) {
  if (parseInt(THREE17.REVISION, 10) >= 152) {
    texture.colorSpace = colorSpace;
  } else {
    texture.encoding = colorSpaceEncodingMap[colorSpace];
  }
}
var GLTFMToonMaterialParamsAssignHelper = class {
  get pending() {
    return Promise.all(this._pendings);
  }
  constructor(parser, materialParams) {
    this._parser = parser;
    this._materialParams = materialParams;
    this._pendings = [];
  }
  assignPrimitive(key, value) {
    if (value != null) {
      this._materialParams[key] = value;
    }
  }
  assignColor(key, value, convertSRGBToLinear) {
    if (value != null) {
      const color = new THREE22.Color().fromArray(value);
      if (convertSRGBToLinear) {
        color.convertSRGBToLinear();
      }
      this._materialParams[key] = color;
    }
  }
  assignTexture(key, schemaTexture, isColorTexture) {
    return __async3(this, null, function* () {
      const promise = (() => __async3(this, null, function* () {
        if (schemaTexture != null) {
          const texture = yield this._parser.assignTexture(this._materialParams, key, schemaTexture);
          if (texture == null) {
            console.warn(
              "GLTFMToonMaterialParamsAssignHelper: Failed to load texture. The rendering result may be wrong"
            );
            return;
          }
          if (isColorTexture) {
            setTextureColorSpace(texture, "srgb");
          }
        }
      }))();
      this._pendings.push(promise);
      return promise;
    });
  }
  assignTextureByIndex(key, textureIndex, isColorTexture) {
    return __async3(this, null, function* () {
      return this.assignTexture(key, textureIndex != null ? { index: textureIndex } : void 0, isColorTexture);
    });
  }
};
var mtoon_default = "// #define PHONG\n\nvarying vec3 vViewPosition;\n\n#ifndef FLAT_SHADED\n  varying vec3 vNormal;\n#endif\n\n#include <common>\n\n// #include <uv_pars_vertex>\n#ifdef MTOON_USE_UV\n  varying vec2 vUv;\n\n  // COMPAT: pre-r151 uses a common uvTransform\n  #if THREE_VRM_THREE_REVISION < 151\n    uniform mat3 uvTransform;\n  #endif\n#endif\n\n// #include <uv2_pars_vertex>\n// COMAPT: pre-r151 uses uv2 for lightMap and aoMap\n#if THREE_VRM_THREE_REVISION < 151\n  #if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )\n    attribute vec2 uv2;\n    varying vec2 vUv2;\n    uniform mat3 uv2Transform;\n  #endif\n#endif\n\n// #include <displacementmap_pars_vertex>\n// #include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\n\n#ifdef USE_OUTLINEWIDTHMULTIPLYTEXTURE\n  uniform sampler2D outlineWidthMultiplyTexture;\n  uniform mat3 outlineWidthMultiplyTextureUvTransform;\n#endif\n\nuniform float outlineWidthFactor;\n\nvoid main() {\n\n  // #include <uv_vertex>\n  #ifdef MTOON_USE_UV\n    // COMPAT: pre-r151 uses a common uvTransform\n    #if THREE_VRM_THREE_REVISION >= 151\n      vUv = uv;\n    #else\n      vUv = ( uvTransform * vec3( uv, 1 ) ).xy;\n    #endif\n  #endif\n\n  // #include <uv2_vertex>\n  // COMAPT: pre-r151 uses uv2 for lightMap and aoMap\n  #if THREE_VRM_THREE_REVISION < 151\n    #if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )\n      vUv2 = ( uv2Transform * vec3( uv2, 1 ) ).xy;\n    #endif\n  #endif\n\n  #include <color_vertex>\n\n  #include <beginnormal_vertex>\n  #include <morphnormal_vertex>\n  #include <skinbase_vertex>\n  #include <skinnormal_vertex>\n\n  // we need this to compute the outline properly\n  objectNormal = normalize( objectNormal );\n\n  #include <defaultnormal_vertex>\n\n  #ifndef FLAT_SHADED // Normal computed with derivatives when FLAT_SHADED\n    vNormal = normalize( transformedNormal );\n  #endif\n\n  #include <begin_vertex>\n\n  #include <morphtarget_vertex>\n  #include <skinning_vertex>\n  // #include <displacementmap_vertex>\n  #include <project_vertex>\n  #include <logdepthbuf_vertex>\n  #include <clipping_planes_vertex>\n\n  vViewPosition = - mvPosition.xyz;\n\n  #ifdef OUTLINE\n    float worldNormalLength = length( transformedNormal );\n    vec3 outlineOffset = outlineWidthFactor * worldNormalLength * objectNormal;\n\n    #ifdef USE_OUTLINEWIDTHMULTIPLYTEXTURE\n      vec2 outlineWidthMultiplyTextureUv = ( outlineWidthMultiplyTextureUvTransform * vec3( vUv, 1 ) ).xy;\n      float outlineTex = texture2D( outlineWidthMultiplyTexture, outlineWidthMultiplyTextureUv ).g;\n      outlineOffset *= outlineTex;\n    #endif\n\n    #ifdef OUTLINE_WIDTH_SCREEN\n      outlineOffset *= vViewPosition.z / projectionMatrix[ 1 ].y;\n    #endif\n\n    gl_Position = projectionMatrix * modelViewMatrix * vec4( outlineOffset + transformed, 1.0 );\n\n    gl_Position.z += 1E-6 * gl_Position.w; // anti-artifact magic\n  #endif\n\n  #include <worldpos_vertex>\n  // #include <envmap_vertex>\n  #include <shadowmap_vertex>\n  #include <fog_vertex>\n\n}";
var mtoon_default2 = "// #define PHONG\n\nuniform vec3 litFactor;\n\nuniform float opacity;\n\nuniform vec3 shadeColorFactor;\n#ifdef USE_SHADEMULTIPLYTEXTURE\n  uniform sampler2D shadeMultiplyTexture;\n  uniform mat3 shadeMultiplyTextureUvTransform;\n#endif\n\nuniform float shadingShiftFactor;\nuniform float shadingToonyFactor;\n\n#ifdef USE_SHADINGSHIFTTEXTURE\n  uniform sampler2D shadingShiftTexture;\n  uniform mat3 shadingShiftTextureUvTransform;\n  uniform float shadingShiftTextureScale;\n#endif\n\nuniform float giEqualizationFactor;\n\nuniform vec3 parametricRimColorFactor;\n#ifdef USE_RIMMULTIPLYTEXTURE\n  uniform sampler2D rimMultiplyTexture;\n  uniform mat3 rimMultiplyTextureUvTransform;\n#endif\nuniform float rimLightingMixFactor;\nuniform float parametricRimFresnelPowerFactor;\nuniform float parametricRimLiftFactor;\n\n#ifdef USE_MATCAPTEXTURE\n  uniform vec3 matcapFactor;\n  uniform sampler2D matcapTexture;\n  uniform mat3 matcapTextureUvTransform;\n#endif\n\nuniform vec3 emissive;\nuniform float emissiveIntensity;\n\nuniform vec3 outlineColorFactor;\nuniform float outlineLightingMixFactor;\n\n#ifdef USE_UVANIMATIONMASKTEXTURE\n  uniform sampler2D uvAnimationMaskTexture;\n  uniform mat3 uvAnimationMaskTextureUvTransform;\n#endif\n\nuniform float uvAnimationScrollXOffset;\nuniform float uvAnimationScrollYOffset;\nuniform float uvAnimationRotationPhase;\n\n#include <common>\n#include <packing>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n\n// #include <uv_pars_fragment>\n#if ( defined( MTOON_USE_UV ) && !defined( MTOON_UVS_VERTEX_ONLY ) )\n  varying vec2 vUv;\n#endif\n\n// #include <uv2_pars_fragment>\n// COMAPT: pre-r151 uses uv2 for lightMap and aoMap\n#if THREE_VRM_THREE_REVISION < 151\n  #if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )\n    varying vec2 vUv2;\n  #endif\n#endif\n\n#include <map_pars_fragment>\n\n#ifdef USE_MAP\n  uniform mat3 mapUvTransform;\n#endif\n\n// #include <alphamap_pars_fragment>\n\n#include <alphatest_pars_fragment>\n\n#include <aomap_pars_fragment>\n// #include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n\n#ifdef USE_EMISSIVEMAP\n  uniform mat3 emissiveMapUvTransform;\n#endif\n\n// #include <envmap_common_pars_fragment>\n// #include <envmap_pars_fragment>\n// #include <cube_uv_reflection_fragment>\n#include <fog_pars_fragment>\n\n// #include <bsdfs>\n// COMPAT: pre-r151 doesn't have BRDF_Lambert in <common>\n#if THREE_VRM_THREE_REVISION < 151\n  vec3 BRDF_Lambert( const in vec3 diffuseColor ) {\n    return RECIPROCAL_PI * diffuseColor;\n  }\n#endif\n\n#include <lights_pars_begin>\n\n#include <normal_pars_fragment>\n\n// #include <lights_phong_pars_fragment>\nvarying vec3 vViewPosition;\n\nstruct MToonMaterial {\n  vec3 diffuseColor;\n  vec3 shadeColor;\n  float shadingShift;\n};\n\nfloat linearstep( float a, float b, float t ) {\n  return clamp( ( t - a ) / ( b - a ), 0.0, 1.0 );\n}\n\n/**\n * Convert NdotL into toon shading factor using shadingShift and shadingToony\n */\nfloat getShading(\n  const in float dotNL,\n  const in float shadow,\n  const in float shadingShift\n) {\n  float shading = dotNL;\n  shading = shading + shadingShift;\n  shading = linearstep( -1.0 + shadingToonyFactor, 1.0 - shadingToonyFactor, shading );\n  shading *= shadow;\n  return shading;\n}\n\n/**\n * Mix diffuseColor and shadeColor using shading factor and light color\n */\nvec3 getDiffuse(\n  const in MToonMaterial material,\n  const in float shading,\n  in vec3 lightColor\n) {\n  #ifdef DEBUG_LITSHADERATE\n    return vec3( BRDF_Lambert( shading * lightColor ) );\n  #endif\n\n  vec3 col = lightColor * BRDF_Lambert( mix( material.shadeColor, material.diffuseColor, shading ) );\n\n  // The \"comment out if you want to PBR absolutely\" line\n  #ifdef V0_COMPAT_SHADE\n    col = min( col, material.diffuseColor );\n  #endif\n\n  return col;\n}\n\n// COMPAT: pre-r156 uses a struct GeometricContext\n#if THREE_VRM_THREE_REVISION >= 157\n  void RE_Direct_MToon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in MToonMaterial material, const in float shadow, inout ReflectedLight reflectedLight ) {\n    float dotNL = clamp( dot( geometryNormal, directLight.direction ), -1.0, 1.0 );\n    vec3 irradiance = directLight.color;\n\n    // directSpecular will be used for rim lighting, not an actual specular\n    reflectedLight.directSpecular += irradiance;\n\n    irradiance *= dotNL;\n\n    float shading = getShading( dotNL, shadow, material.shadingShift );\n\n    // toon shaded diffuse\n    reflectedLight.directDiffuse += getDiffuse( material, shading, directLight.color );\n  }\n\n  void RE_IndirectDiffuse_MToon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in MToonMaterial material, inout ReflectedLight reflectedLight ) {\n    // indirect diffuse will use diffuseColor, no shadeColor involved\n    reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n\n    // directSpecular will be used for rim lighting, not an actual specular\n    reflectedLight.directSpecular += irradiance;\n  }\n#else\n  void RE_Direct_MToon( const in IncidentLight directLight, const in GeometricContext geometry, const in MToonMaterial material, const in float shadow, inout ReflectedLight reflectedLight ) {\n    float dotNL = clamp( dot( geometry.normal, directLight.direction ), -1.0, 1.0 );\n    vec3 irradiance = directLight.color;\n\n    // directSpecular will be used for rim lighting, not an actual specular\n    reflectedLight.directSpecular += irradiance;\n\n    irradiance *= dotNL;\n\n    float shading = getShading( dotNL, shadow, material.shadingShift );\n\n    // toon shaded diffuse\n    reflectedLight.directDiffuse += getDiffuse( material, shading, directLight.color );\n  }\n\n  void RE_IndirectDiffuse_MToon( const in vec3 irradiance, const in GeometricContext geometry, const in MToonMaterial material, inout ReflectedLight reflectedLight ) {\n    // indirect diffuse will use diffuseColor, no shadeColor involved\n    reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n\n    // directSpecular will be used for rim lighting, not an actual specular\n    reflectedLight.directSpecular += irradiance;\n  }\n#endif\n\n#define RE_Direct RE_Direct_MToon\n#define RE_IndirectDiffuse RE_IndirectDiffuse_MToon\n#define Material_LightProbeLOD( material ) (0)\n\n#include <shadowmap_pars_fragment>\n// #include <bumpmap_pars_fragment>\n\n// #include <normalmap_pars_fragment>\n#ifdef USE_NORMALMAP\n\n  uniform sampler2D normalMap;\n  uniform mat3 normalMapUvTransform;\n  uniform vec2 normalScale;\n\n#endif\n\n// COMPAT: pre-r151\n// USE_NORMALMAP_OBJECTSPACE used to be OBJECTSPACE_NORMALMAP in pre-r151\n#if defined( USE_NORMALMAP_OBJECTSPACE ) || defined( OBJECTSPACE_NORMALMAP )\n\n  uniform mat3 normalMatrix;\n\n#endif\n\n// COMPAT: pre-r151\n// USE_NORMALMAP_TANGENTSPACE used to be TANGENTSPACE_NORMALMAP in pre-r151\n#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( TANGENTSPACE_NORMALMAP ) )\n\n  // Per-Pixel Tangent Space Normal Mapping\n  // http://hacksoflife.blogspot.ch/2009/11/per-pixel-tangent-space-normal-mapping.html\n\n  // three-vrm specific change: it requires `uv` as an input in order to support uv scrolls\n\n  // Temporary compat against shader change @ Three.js r126, r151\n  #if THREE_VRM_THREE_REVISION >= 151\n\n    mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {\n\n      vec3 q0 = dFdx( eye_pos.xyz );\n      vec3 q1 = dFdy( eye_pos.xyz );\n      vec2 st0 = dFdx( uv.st );\n      vec2 st1 = dFdy( uv.st );\n\n      vec3 N = surf_norm;\n\n      vec3 q1perp = cross( q1, N );\n      vec3 q0perp = cross( N, q0 );\n\n      vec3 T = q1perp * st0.x + q0perp * st1.x;\n      vec3 B = q1perp * st0.y + q0perp * st1.y;\n\n      float det = max( dot( T, T ), dot( B, B ) );\n      float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );\n\n      return mat3( T * scale, B * scale, N );\n\n    }\n\n  #else\n\n    vec3 perturbNormal2Arb( vec2 uv, vec3 eye_pos, vec3 surf_norm, vec3 mapN, float faceDirection ) {\n\n      vec3 q0 = vec3( dFdx( eye_pos.x ), dFdx( eye_pos.y ), dFdx( eye_pos.z ) );\n      vec3 q1 = vec3( dFdy( eye_pos.x ), dFdy( eye_pos.y ), dFdy( eye_pos.z ) );\n      vec2 st0 = dFdx( uv.st );\n      vec2 st1 = dFdy( uv.st );\n\n      vec3 N = normalize( surf_norm );\n\n      vec3 q1perp = cross( q1, N );\n      vec3 q0perp = cross( N, q0 );\n\n      vec3 T = q1perp * st0.x + q0perp * st1.x;\n      vec3 B = q1perp * st0.y + q0perp * st1.y;\n\n      // three-vrm specific change: Workaround for the issue that happens when delta of uv = 0.0\n      // TODO: Is this still required? Or shall I make a PR about it?\n      if ( length( T ) == 0.0 || length( B ) == 0.0 ) {\n        return surf_norm;\n      }\n\n      float det = max( dot( T, T ), dot( B, B ) );\n      float scale = ( det == 0.0 ) ? 0.0 : faceDirection * inversesqrt( det );\n\n      return normalize( T * ( mapN.x * scale ) + B * ( mapN.y * scale ) + N * mapN.z );\n\n    }\n\n  #endif\n\n#endif\n\n// #include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\n\n// == post correction ==========================================================\nvoid postCorrection() {\n  #include <tonemapping_fragment>\n  #include <colorspace_fragment>\n  #include <fog_fragment>\n  #include <premultiplied_alpha_fragment>\n  #include <dithering_fragment>\n}\n\n// == main procedure ===========================================================\nvoid main() {\n  #include <clipping_planes_fragment>\n\n  vec2 uv = vec2(0.5, 0.5);\n\n  #if ( defined( MTOON_USE_UV ) && !defined( MTOON_UVS_VERTEX_ONLY ) )\n    uv = vUv;\n\n    float uvAnimMask = 1.0;\n    #ifdef USE_UVANIMATIONMASKTEXTURE\n      vec2 uvAnimationMaskTextureUv = ( uvAnimationMaskTextureUvTransform * vec3( uv, 1 ) ).xy;\n      uvAnimMask = texture2D( uvAnimationMaskTexture, uvAnimationMaskTextureUv ).b;\n    #endif\n\n    float uvRotCos = cos( uvAnimationRotationPhase * uvAnimMask );\n    float uvRotSin = sin( uvAnimationRotationPhase * uvAnimMask );\n    uv = mat2( uvRotCos, -uvRotSin, uvRotSin, uvRotCos ) * ( uv - 0.5 ) + 0.5;\n    uv = uv + vec2( uvAnimationScrollXOffset, uvAnimationScrollYOffset ) * uvAnimMask;\n  #endif\n\n  #ifdef DEBUG_UV\n    gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );\n    #if ( defined( MTOON_USE_UV ) && !defined( MTOON_UVS_VERTEX_ONLY ) )\n      gl_FragColor = vec4( uv, 0.0, 1.0 );\n    #endif\n    return;\n  #endif\n\n  vec4 diffuseColor = vec4( litFactor, opacity );\n  ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n  vec3 totalEmissiveRadiance = emissive * emissiveIntensity;\n\n  #include <logdepthbuf_fragment>\n\n  // #include <map_fragment>\n  #ifdef USE_MAP\n    vec2 mapUv = ( mapUvTransform * vec3( uv, 1 ) ).xy;\n    vec4 sampledDiffuseColor = texture2D( map, mapUv );\n    #ifdef DECODE_VIDEO_TEXTURE\n      sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );\n    #endif\n    diffuseColor *= sampledDiffuseColor;\n  #endif\n\n  // #include <color_fragment>\n  #if ( defined( USE_COLOR ) && !defined( IGNORE_VERTEX_COLOR ) )\n    diffuseColor.rgb *= vColor;\n  #endif\n\n  // #include <alphamap_fragment>\n\n  #include <alphatest_fragment>\n\n  // #include <specularmap_fragment>\n\n  // #include <normal_fragment_begin>\n  float faceDirection = gl_FrontFacing ? 1.0 : -1.0;\n\n  #ifdef FLAT_SHADED\n\n    vec3 fdx = dFdx( vViewPosition );\n    vec3 fdy = dFdy( vViewPosition );\n    vec3 normal = normalize( cross( fdx, fdy ) );\n\n  #else\n\n    vec3 normal = normalize( vNormal );\n\n    #ifdef DOUBLE_SIDED\n\n      normal *= faceDirection;\n\n    #endif\n\n  #endif\n\n  #ifdef USE_NORMALMAP\n\n    vec2 normalMapUv = ( normalMapUvTransform * vec3( uv, 1 ) ).xy;\n\n  #endif\n\n  #ifdef USE_NORMALMAP_TANGENTSPACE\n\n    #ifdef USE_TANGENT\n\n      mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );\n\n    #else\n\n      mat3 tbn = getTangentFrame( - vViewPosition, normal, normalMapUv );\n\n    #endif\n\n    #if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )\n\n      tbn[0] *= faceDirection;\n      tbn[1] *= faceDirection;\n\n    #endif\n\n  #endif\n\n  #ifdef USE_CLEARCOAT_NORMALMAP\n\n    #ifdef USE_TANGENT\n\n      mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );\n\n    #else\n\n      mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );\n\n    #endif\n\n    #if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )\n\n      tbn2[0] *= faceDirection;\n      tbn2[1] *= faceDirection;\n\n    #endif\n\n  #endif\n\n  // non perturbed normal for clearcoat among others\n\n  vec3 nonPerturbedNormal = normal;\n\n  #ifdef OUTLINE\n    normal *= -1.0;\n  #endif\n\n  // #include <normal_fragment_maps>\n\n  // COMPAT: pre-r151\n  // USE_NORMALMAP_OBJECTSPACE used to be OBJECTSPACE_NORMALMAP in pre-r151\n  #if defined( USE_NORMALMAP_OBJECTSPACE ) || defined( OBJECTSPACE_NORMALMAP )\n\n    normal = texture2D( normalMap, normalMapUv ).xyz * 2.0 - 1.0; // overrides both flatShading and attribute normals\n\n    #ifdef FLIP_SIDED\n\n      normal = - normal;\n\n    #endif\n\n    #ifdef DOUBLE_SIDED\n\n      normal = normal * faceDirection;\n\n    #endif\n\n    normal = normalize( normalMatrix * normal );\n\n  // COMPAT: pre-r151\n  // USE_NORMALMAP_TANGENTSPACE used to be TANGENTSPACE_NORMALMAP in pre-r151\n  #elif defined( USE_NORMALMAP_TANGENTSPACE ) || defined( TANGENTSPACE_NORMALMAP )\n\n    vec3 mapN = texture2D( normalMap, normalMapUv ).xyz * 2.0 - 1.0;\n    mapN.xy *= normalScale;\n\n    // COMPAT: pre-r151\n    #if THREE_VRM_THREE_REVISION >= 151 || defined( USE_TANGENT )\n\n      normal = normalize( tbn * mapN );\n\n    #else\n\n      normal = perturbNormal2Arb( uv, -vViewPosition, normal, mapN, faceDirection );\n\n    #endif\n\n  #endif\n\n  // #include <emissivemap_fragment>\n  #ifdef USE_EMISSIVEMAP\n    vec2 emissiveMapUv = ( emissiveMapUvTransform * vec3( uv, 1 ) ).xy;\n    totalEmissiveRadiance *= texture2D( emissiveMap, emissiveMapUv ).rgb;\n  #endif\n\n  #ifdef DEBUG_NORMAL\n    gl_FragColor = vec4( 0.5 + 0.5 * normal, 1.0 );\n    return;\n  #endif\n\n  // -- MToon: lighting --------------------------------------------------------\n  // accumulation\n  // #include <lights_phong_fragment>\n  MToonMaterial material;\n\n  material.diffuseColor = diffuseColor.rgb;\n\n  material.shadeColor = shadeColorFactor;\n  #ifdef USE_SHADEMULTIPLYTEXTURE\n    vec2 shadeMultiplyTextureUv = ( shadeMultiplyTextureUvTransform * vec3( uv, 1 ) ).xy;\n    material.shadeColor *= texture2D( shadeMultiplyTexture, shadeMultiplyTextureUv ).rgb;\n  #endif\n\n  #if ( defined( USE_COLOR ) && !defined( IGNORE_VERTEX_COLOR ) )\n    material.shadeColor.rgb *= vColor;\n  #endif\n\n  material.shadingShift = shadingShiftFactor;\n  #ifdef USE_SHADINGSHIFTTEXTURE\n    vec2 shadingShiftTextureUv = ( shadingShiftTextureUvTransform * vec3( uv, 1 ) ).xy;\n    material.shadingShift += texture2D( shadingShiftTexture, shadingShiftTextureUv ).r * shadingShiftTextureScale;\n  #endif\n\n  // #include <lights_fragment_begin>\n\n  // MToon Specific changes:\n  // Since we want to take shadows into account of shading instead of irradiance,\n  // we had to modify the codes that multiplies the results of shadowmap into color of direct lights.\n\n  // COMPAT: pre-r156 uses a struct GeometricContext\n  #if THREE_VRM_THREE_REVISION >= 157\n    vec3 geometryPosition = - vViewPosition;\n    vec3 geometryNormal = normal;\n    vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );\n\n    vec3 geometryClearcoatNormal;\n\n    #ifdef USE_CLEARCOAT\n\n      geometryClearcoatNormal = clearcoatNormal;\n\n    #endif\n  #else\n    GeometricContext geometry;\n\n    geometry.position = - vViewPosition;\n    geometry.normal = normal;\n    geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );\n\n    #ifdef USE_CLEARCOAT\n\n      geometry.clearcoatNormal = clearcoatNormal;\n\n    #endif\n  #endif\n\n  IncidentLight directLight;\n\n  // since these variables will be used in unrolled loop, we have to define in prior\n  float shadow;\n\n  #if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )\n\n    PointLight pointLight;\n    #if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0\n    PointLightShadow pointLightShadow;\n    #endif\n\n    #pragma unroll_loop_start\n    for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {\n\n      pointLight = pointLights[ i ];\n\n      // COMPAT: pre-r156 uses a struct GeometricContext\n      #if THREE_VRM_THREE_REVISION >= 157\n        getPointLightInfo( pointLight, geometryPosition, directLight );\n      #else\n        getPointLightInfo( pointLight, geometry, directLight );\n      #endif\n\n      shadow = 1.0;\n      #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )\n      pointLightShadow = pointLightShadows[ i ];\n      // COMPAT: pre-r166\n      // r166 introduced shadowIntensity\n      #if THREE_VRM_THREE_REVISION >= 166\n        shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;\n      #else\n        shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;\n      #endif\n      #endif\n\n      // COMPAT: pre-r156 uses a struct GeometricContext\n      #if THREE_VRM_THREE_REVISION >= 157\n        RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, shadow, reflectedLight );\n      #else\n        RE_Direct( directLight, geometry, material, shadow, reflectedLight );\n      #endif\n\n    }\n    #pragma unroll_loop_end\n\n  #endif\n\n  #if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )\n\n    SpotLight spotLight;\n    // COMPAT: pre-r144 uses NUM_SPOT_LIGHT_SHADOWS, r144+ uses NUM_SPOT_LIGHT_COORDS\n    #if THREE_VRM_THREE_REVISION >= 144\n      #if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_COORDS > 0\n      SpotLightShadow spotLightShadow;\n      #endif\n    #elif defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0\n    SpotLightShadow spotLightShadow;\n    #endif\n\n    #pragma unroll_loop_start\n    for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {\n\n      spotLight = spotLights[ i ];\n\n      // COMPAT: pre-r156 uses a struct GeometricContext\n      #if THREE_VRM_THREE_REVISION >= 157\n        getSpotLightInfo( spotLight, geometryPosition, directLight );\n      #else\n        getSpotLightInfo( spotLight, geometry, directLight );\n      #endif\n\n      shadow = 1.0;\n      // COMPAT: pre-r144 uses NUM_SPOT_LIGHT_SHADOWS and vSpotShadowCoord, r144+ uses NUM_SPOT_LIGHT_COORDS and vSpotLightCoord\n      // COMPAT: pre-r166 does not have shadowIntensity, r166+ has shadowIntensity\n      #if THREE_VRM_THREE_REVISION >= 166\n        #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_COORDS )\n        spotLightShadow = spotLightShadows[ i ];\n        shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;\n        #endif\n      #elif THREE_VRM_THREE_REVISION >= 144\n        #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_COORDS )\n        spotLightShadow = spotLightShadows[ i ];\n        shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;\n        #endif\n      #elif defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )\n      spotLightShadow = spotLightShadows[ i ];\n      shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;\n      #endif\n\n      // COMPAT: pre-r156 uses a struct GeometricContext\n      #if THREE_VRM_THREE_REVISION >= 157\n        RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, shadow, reflectedLight );\n      #else\n        RE_Direct( directLight, geometry, material, shadow, reflectedLight );\n      #endif\n\n    }\n    #pragma unroll_loop_end\n\n  #endif\n\n  #if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )\n\n    DirectionalLight directionalLight;\n    #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0\n    DirectionalLightShadow directionalLightShadow;\n    #endif\n\n    #pragma unroll_loop_start\n    for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\n\n      directionalLight = directionalLights[ i ];\n\n      // COMPAT: pre-r156 uses a struct GeometricContext\n      #if THREE_VRM_THREE_REVISION >= 157\n        getDirectionalLightInfo( directionalLight, directLight );\n      #else\n        getDirectionalLightInfo( directionalLight, geometry, directLight );\n      #endif\n\n      shadow = 1.0;\n      #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )\n      directionalLightShadow = directionalLightShadows[ i ];\n      // COMPAT: pre-r166\n      // r166 introduced shadowIntensity\n      #if THREE_VRM_THREE_REVISION >= 166\n        shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n      #else\n        shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n      #endif\n      #endif\n\n      // COMPAT: pre-r156 uses a struct GeometricContext\n      #if THREE_VRM_THREE_REVISION >= 157\n        RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, shadow, reflectedLight );\n      #else\n        RE_Direct( directLight, geometry, material, shadow, reflectedLight );\n      #endif\n\n    }\n    #pragma unroll_loop_end\n\n  #endif\n\n  // #if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )\n\n  //   RectAreaLight rectAreaLight;\n\n  //   #pragma unroll_loop_start\n  //   for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {\n\n  //     rectAreaLight = rectAreaLights[ i ];\n  //     RE_Direct_RectArea( rectAreaLight, geometry, material, reflectedLight );\n\n  //   }\n  //   #pragma unroll_loop_end\n\n  // #endif\n\n  #if defined( RE_IndirectDiffuse )\n\n    vec3 iblIrradiance = vec3( 0.0 );\n\n    vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );\n\n    // COMPAT: pre-r156 uses a struct GeometricContext\n    // COMPAT: pre-r156 doesn't have a define USE_LIGHT_PROBES\n    #if THREE_VRM_THREE_REVISION >= 157\n      #if defined( USE_LIGHT_PROBES )\n        irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );\n      #endif\n    #else\n      irradiance += getLightProbeIrradiance( lightProbe, geometry.normal );\n    #endif\n\n    #if ( NUM_HEMI_LIGHTS > 0 )\n\n      #pragma unroll_loop_start\n      for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {\n\n        // COMPAT: pre-r156 uses a struct GeometricContext\n        #if THREE_VRM_THREE_REVISION >= 157\n          irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );\n        #else\n          irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry.normal );\n        #endif\n\n      }\n      #pragma unroll_loop_end\n\n    #endif\n\n  #endif\n\n  // #if defined( RE_IndirectSpecular )\n\n  //   vec3 radiance = vec3( 0.0 );\n  //   vec3 clearcoatRadiance = vec3( 0.0 );\n\n  // #endif\n\n  #include <lights_fragment_maps>\n  #include <lights_fragment_end>\n\n  // modulation\n  #include <aomap_fragment>\n\n  vec3 col = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;\n\n  #ifdef DEBUG_LITSHADERATE\n    gl_FragColor = vec4( col, diffuseColor.a );\n    postCorrection();\n    return;\n  #endif\n\n  // -- MToon: rim lighting -----------------------------------------\n  vec3 viewDir = normalize( vViewPosition );\n\n  #ifndef PHYSICALLY_CORRECT_LIGHTS\n    reflectedLight.directSpecular /= PI;\n  #endif\n  vec3 rimMix = mix( vec3( 1.0 ), reflectedLight.directSpecular, rimLightingMixFactor );\n\n  vec3 rim = parametricRimColorFactor * pow( saturate( 1.0 - dot( viewDir, normal ) + parametricRimLiftFactor ), parametricRimFresnelPowerFactor );\n\n  #ifdef USE_MATCAPTEXTURE\n    {\n      vec3 x = normalize( vec3( viewDir.z, 0.0, -viewDir.x ) );\n      vec3 y = cross( viewDir, x ); // guaranteed to be normalized\n      vec2 sphereUv = 0.5 + 0.5 * vec2( dot( x, normal ), -dot( y, normal ) );\n      sphereUv = ( matcapTextureUvTransform * vec3( sphereUv, 1 ) ).xy;\n      vec3 matcap = texture2D( matcapTexture, sphereUv ).rgb;\n      rim += matcapFactor * matcap;\n    }\n  #endif\n\n  #ifdef USE_RIMMULTIPLYTEXTURE\n    vec2 rimMultiplyTextureUv = ( rimMultiplyTextureUvTransform * vec3( uv, 1 ) ).xy;\n    rim *= texture2D( rimMultiplyTexture, rimMultiplyTextureUv ).rgb;\n  #endif\n\n  col += rimMix * rim;\n\n  // -- MToon: Emission --------------------------------------------------------\n  col += totalEmissiveRadiance;\n\n  // #include <envmap_fragment>\n\n  // -- Almost done! -----------------------------------------------------------\n  #if defined( OUTLINE )\n    col = outlineColorFactor.rgb * mix( vec3( 1.0 ), col, outlineLightingMixFactor );\n  #endif\n\n  #ifdef OPAQUE\n    diffuseColor.a = 1.0;\n  #endif\n\n  gl_FragColor = vec4( col, diffuseColor.a );\n  postCorrection();\n}\n";
var MToonMaterialDebugMode = {
  /**
   * Render normally.
   */
  None: "none",
  /**
   * Visualize normals of the surface.
   */
  Normal: "normal",
  /**
   * Visualize lit/shade of the surface.
   */
  LitShadeRate: "litShadeRate",
  /**
   * Visualize UV of the surface.
   */
  UV: "uv"
};
var MToonMaterialOutlineWidthMode = {
  None: "none",
  WorldCoordinates: "worldCoordinates",
  ScreenCoordinates: "screenCoordinates"
};
var encodingColorSpaceMap = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  3e3: "",
  // eslint-disable-next-line @typescript-eslint/naming-convention
  3001: "srgb"
};
function getTextureColorSpace(texture) {
  if (parseInt(THREE32.REVISION, 10) >= 152) {
    return texture.colorSpace;
  } else {
    return encodingColorSpaceMap[texture.encoding];
  }
}
var MToonMaterial = class extends THREE42.ShaderMaterial {
  constructor(parameters = {}) {
    var _a;
    super({ vertexShader: mtoon_default, fragmentShader: mtoon_default2 });
    this.uvAnimationScrollXSpeedFactor = 0;
    this.uvAnimationScrollYSpeedFactor = 0;
    this.uvAnimationRotationSpeedFactor = 0;
    this.fog = true;
    this.normalMapType = THREE42.TangentSpaceNormalMap;
    this._ignoreVertexColor = true;
    this._v0CompatShade = false;
    this._debugMode = MToonMaterialDebugMode.None;
    this._outlineWidthMode = MToonMaterialOutlineWidthMode.None;
    this._isOutline = false;
    if (parameters.transparentWithZWrite) {
      parameters.depthWrite = true;
    }
    delete parameters.transparentWithZWrite;
    parameters.fog = true;
    parameters.lights = true;
    parameters.clipping = true;
    this.uniforms = THREE42.UniformsUtils.merge([
      THREE42.UniformsLib.common,
      // map
      THREE42.UniformsLib.normalmap,
      // normalMap
      THREE42.UniformsLib.emissivemap,
      // emissiveMap
      THREE42.UniformsLib.fog,
      THREE42.UniformsLib.lights,
      {
        litFactor: { value: new THREE42.Color(1, 1, 1) },
        mapUvTransform: { value: new THREE42.Matrix3() },
        colorAlpha: { value: 1 },
        normalMapUvTransform: { value: new THREE42.Matrix3() },
        shadeColorFactor: { value: new THREE42.Color(0, 0, 0) },
        shadeMultiplyTexture: { value: null },
        shadeMultiplyTextureUvTransform: { value: new THREE42.Matrix3() },
        shadingShiftFactor: { value: 0 },
        shadingShiftTexture: { value: null },
        shadingShiftTextureUvTransform: { value: new THREE42.Matrix3() },
        shadingShiftTextureScale: { value: 1 },
        shadingToonyFactor: { value: 0.9 },
        giEqualizationFactor: { value: 0.9 },
        matcapFactor: { value: new THREE42.Color(1, 1, 1) },
        matcapTexture: { value: null },
        matcapTextureUvTransform: { value: new THREE42.Matrix3() },
        parametricRimColorFactor: { value: new THREE42.Color(0, 0, 0) },
        rimMultiplyTexture: { value: null },
        rimMultiplyTextureUvTransform: { value: new THREE42.Matrix3() },
        rimLightingMixFactor: { value: 1 },
        parametricRimFresnelPowerFactor: { value: 5 },
        parametricRimLiftFactor: { value: 0 },
        emissive: { value: new THREE42.Color(0, 0, 0) },
        emissiveIntensity: { value: 1 },
        emissiveMapUvTransform: { value: new THREE42.Matrix3() },
        outlineWidthMultiplyTexture: { value: null },
        outlineWidthMultiplyTextureUvTransform: { value: new THREE42.Matrix3() },
        outlineWidthFactor: { value: 0 },
        outlineColorFactor: { value: new THREE42.Color(0, 0, 0) },
        outlineLightingMixFactor: { value: 1 },
        uvAnimationMaskTexture: { value: null },
        uvAnimationMaskTextureUvTransform: { value: new THREE42.Matrix3() },
        uvAnimationScrollXOffset: { value: 0 },
        uvAnimationScrollYOffset: { value: 0 },
        uvAnimationRotationPhase: { value: 0 }
      },
      (_a = parameters.uniforms) != null ? _a : {}
    ]);
    this.setValues(parameters);
    this._uploadUniformsWorkaround();
    this.customProgramCacheKey = () => [
      ...Object.entries(this._generateDefines()).map(([token, macro]) => `${token}:${macro}`),
      this.matcapTexture ? `matcapTextureColorSpace:${getTextureColorSpace(this.matcapTexture)}` : "",
      this.shadeMultiplyTexture ? `shadeMultiplyTextureColorSpace:${getTextureColorSpace(this.shadeMultiplyTexture)}` : "",
      this.rimMultiplyTexture ? `rimMultiplyTextureColorSpace:${getTextureColorSpace(this.rimMultiplyTexture)}` : ""
    ].join(",");
    this.onBeforeCompile = (shader) => {
      const threeRevision = parseInt(THREE42.REVISION, 10);
      const defines = Object.entries(__spreadValues(__spreadValues({}, this._generateDefines()), this.defines)).filter(([token, macro]) => !!macro).map(([token, macro]) => `#define ${token} ${macro}`).join("\n") + "\n";
      shader.vertexShader = defines + shader.vertexShader;
      shader.fragmentShader = defines + shader.fragmentShader;
      if (threeRevision < 154) {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <colorspace_fragment>",
          "#include <encodings_fragment>"
        );
      }
    };
  }
  get color() {
    return this.uniforms.litFactor.value;
  }
  set color(value) {
    this.uniforms.litFactor.value = value;
  }
  get map() {
    return this.uniforms.map.value;
  }
  set map(value) {
    this.uniforms.map.value = value;
  }
  get normalMap() {
    return this.uniforms.normalMap.value;
  }
  set normalMap(value) {
    this.uniforms.normalMap.value = value;
  }
  get normalScale() {
    return this.uniforms.normalScale.value;
  }
  set normalScale(value) {
    this.uniforms.normalScale.value = value;
  }
  get emissive() {
    return this.uniforms.emissive.value;
  }
  set emissive(value) {
    this.uniforms.emissive.value = value;
  }
  get emissiveIntensity() {
    return this.uniforms.emissiveIntensity.value;
  }
  set emissiveIntensity(value) {
    this.uniforms.emissiveIntensity.value = value;
  }
  get emissiveMap() {
    return this.uniforms.emissiveMap.value;
  }
  set emissiveMap(value) {
    this.uniforms.emissiveMap.value = value;
  }
  get shadeColorFactor() {
    return this.uniforms.shadeColorFactor.value;
  }
  set shadeColorFactor(value) {
    this.uniforms.shadeColorFactor.value = value;
  }
  get shadeMultiplyTexture() {
    return this.uniforms.shadeMultiplyTexture.value;
  }
  set shadeMultiplyTexture(value) {
    this.uniforms.shadeMultiplyTexture.value = value;
  }
  get shadingShiftFactor() {
    return this.uniforms.shadingShiftFactor.value;
  }
  set shadingShiftFactor(value) {
    this.uniforms.shadingShiftFactor.value = value;
  }
  get shadingShiftTexture() {
    return this.uniforms.shadingShiftTexture.value;
  }
  set shadingShiftTexture(value) {
    this.uniforms.shadingShiftTexture.value = value;
  }
  get shadingShiftTextureScale() {
    return this.uniforms.shadingShiftTextureScale.value;
  }
  set shadingShiftTextureScale(value) {
    this.uniforms.shadingShiftTextureScale.value = value;
  }
  get shadingToonyFactor() {
    return this.uniforms.shadingToonyFactor.value;
  }
  set shadingToonyFactor(value) {
    this.uniforms.shadingToonyFactor.value = value;
  }
  get giEqualizationFactor() {
    return this.uniforms.giEqualizationFactor.value;
  }
  set giEqualizationFactor(value) {
    this.uniforms.giEqualizationFactor.value = value;
  }
  get matcapFactor() {
    return this.uniforms.matcapFactor.value;
  }
  set matcapFactor(value) {
    this.uniforms.matcapFactor.value = value;
  }
  get matcapTexture() {
    return this.uniforms.matcapTexture.value;
  }
  set matcapTexture(value) {
    this.uniforms.matcapTexture.value = value;
  }
  get parametricRimColorFactor() {
    return this.uniforms.parametricRimColorFactor.value;
  }
  set parametricRimColorFactor(value) {
    this.uniforms.parametricRimColorFactor.value = value;
  }
  get rimMultiplyTexture() {
    return this.uniforms.rimMultiplyTexture.value;
  }
  set rimMultiplyTexture(value) {
    this.uniforms.rimMultiplyTexture.value = value;
  }
  get rimLightingMixFactor() {
    return this.uniforms.rimLightingMixFactor.value;
  }
  set rimLightingMixFactor(value) {
    this.uniforms.rimLightingMixFactor.value = value;
  }
  get parametricRimFresnelPowerFactor() {
    return this.uniforms.parametricRimFresnelPowerFactor.value;
  }
  set parametricRimFresnelPowerFactor(value) {
    this.uniforms.parametricRimFresnelPowerFactor.value = value;
  }
  get parametricRimLiftFactor() {
    return this.uniforms.parametricRimLiftFactor.value;
  }
  set parametricRimLiftFactor(value) {
    this.uniforms.parametricRimLiftFactor.value = value;
  }
  get outlineWidthMultiplyTexture() {
    return this.uniforms.outlineWidthMultiplyTexture.value;
  }
  set outlineWidthMultiplyTexture(value) {
    this.uniforms.outlineWidthMultiplyTexture.value = value;
  }
  get outlineWidthFactor() {
    return this.uniforms.outlineWidthFactor.value;
  }
  set outlineWidthFactor(value) {
    this.uniforms.outlineWidthFactor.value = value;
  }
  get outlineColorFactor() {
    return this.uniforms.outlineColorFactor.value;
  }
  set outlineColorFactor(value) {
    this.uniforms.outlineColorFactor.value = value;
  }
  get outlineLightingMixFactor() {
    return this.uniforms.outlineLightingMixFactor.value;
  }
  set outlineLightingMixFactor(value) {
    this.uniforms.outlineLightingMixFactor.value = value;
  }
  get uvAnimationMaskTexture() {
    return this.uniforms.uvAnimationMaskTexture.value;
  }
  set uvAnimationMaskTexture(value) {
    this.uniforms.uvAnimationMaskTexture.value = value;
  }
  get uvAnimationScrollXOffset() {
    return this.uniforms.uvAnimationScrollXOffset.value;
  }
  set uvAnimationScrollXOffset(value) {
    this.uniforms.uvAnimationScrollXOffset.value = value;
  }
  get uvAnimationScrollYOffset() {
    return this.uniforms.uvAnimationScrollYOffset.value;
  }
  set uvAnimationScrollYOffset(value) {
    this.uniforms.uvAnimationScrollYOffset.value = value;
  }
  get uvAnimationRotationPhase() {
    return this.uniforms.uvAnimationRotationPhase.value;
  }
  set uvAnimationRotationPhase(value) {
    this.uniforms.uvAnimationRotationPhase.value = value;
  }
  /**
   * When this is `true`, vertex colors will be ignored.
   * `true` by default.
   */
  get ignoreVertexColor() {
    return this._ignoreVertexColor;
  }
  set ignoreVertexColor(value) {
    this._ignoreVertexColor = value;
    this.needsUpdate = true;
  }
  /**
   * There is a line of the shader called "comment out if you want to PBR absolutely" in VRM0.0 MToon.
   * When this is true, the material enables the line to make it compatible with the legacy rendering of VRM.
   * Usually not recommended to turn this on.
   * `false` by default.
   */
  get v0CompatShade() {
    return this._v0CompatShade;
  }
  /**
   * There is a line of the shader called "comment out if you want to PBR absolutely" in VRM0.0 MToon.
   * When this is true, the material enables the line to make it compatible with the legacy rendering of VRM.
   * Usually not recommended to turn this on.
   * `false` by default.
   */
  set v0CompatShade(v) {
    this._v0CompatShade = v;
    this.needsUpdate = true;
  }
  /**
   * Debug mode for the material.
   * You can visualize several components for diagnosis using debug mode.
   *
   * See: {@link MToonMaterialDebugMode}
   */
  get debugMode() {
    return this._debugMode;
  }
  /**
   * Debug mode for the material.
   * You can visualize several components for diagnosis using debug mode.
   *
   * See: {@link MToonMaterialDebugMode}
   */
  set debugMode(m) {
    this._debugMode = m;
    this.needsUpdate = true;
  }
  get outlineWidthMode() {
    return this._outlineWidthMode;
  }
  set outlineWidthMode(m) {
    this._outlineWidthMode = m;
    this.needsUpdate = true;
  }
  get isOutline() {
    return this._isOutline;
  }
  set isOutline(b) {
    this._isOutline = b;
    this.needsUpdate = true;
  }
  /**
   * Readonly boolean that indicates this is a {@link MToonMaterial}.
   */
  get isMToonMaterial() {
    return true;
  }
  /**
   * Update this material.
   *
   * @param delta deltaTime since last update
   */
  update(delta) {
    this._uploadUniformsWorkaround();
    this._updateUVAnimation(delta);
  }
  copy(source) {
    super.copy(source);
    this.map = source.map;
    this.normalMap = source.normalMap;
    this.emissiveMap = source.emissiveMap;
    this.shadeMultiplyTexture = source.shadeMultiplyTexture;
    this.shadingShiftTexture = source.shadingShiftTexture;
    this.matcapTexture = source.matcapTexture;
    this.rimMultiplyTexture = source.rimMultiplyTexture;
    this.outlineWidthMultiplyTexture = source.outlineWidthMultiplyTexture;
    this.uvAnimationMaskTexture = source.uvAnimationMaskTexture;
    this.normalMapType = source.normalMapType;
    this.uvAnimationScrollXSpeedFactor = source.uvAnimationScrollXSpeedFactor;
    this.uvAnimationScrollYSpeedFactor = source.uvAnimationScrollYSpeedFactor;
    this.uvAnimationRotationSpeedFactor = source.uvAnimationRotationSpeedFactor;
    this.ignoreVertexColor = source.ignoreVertexColor;
    this.v0CompatShade = source.v0CompatShade;
    this.debugMode = source.debugMode;
    this.outlineWidthMode = source.outlineWidthMode;
    this.isOutline = source.isOutline;
    this.needsUpdate = true;
    return this;
  }
  /**
   * Update UV animation state.
   * Intended to be called via {@link update}.
   * @param delta deltaTime
   */
  _updateUVAnimation(delta) {
    this.uniforms.uvAnimationScrollXOffset.value += delta * this.uvAnimationScrollXSpeedFactor;
    this.uniforms.uvAnimationScrollYOffset.value += delta * this.uvAnimationScrollYSpeedFactor;
    this.uniforms.uvAnimationRotationPhase.value += delta * this.uvAnimationRotationSpeedFactor;
    this.uniforms.alphaTest.value = this.alphaTest;
    this.uniformsNeedUpdate = true;
  }
  /**
   * Upload uniforms that need to upload but doesn't automatically because of reasons.
   * Intended to be called via {@link constructor} and {@link update}.
   */
  _uploadUniformsWorkaround() {
    this.uniforms.opacity.value = this.opacity;
    this._updateTextureMatrix(this.uniforms.map, this.uniforms.mapUvTransform);
    this._updateTextureMatrix(this.uniforms.normalMap, this.uniforms.normalMapUvTransform);
    this._updateTextureMatrix(this.uniforms.emissiveMap, this.uniforms.emissiveMapUvTransform);
    this._updateTextureMatrix(this.uniforms.shadeMultiplyTexture, this.uniforms.shadeMultiplyTextureUvTransform);
    this._updateTextureMatrix(this.uniforms.shadingShiftTexture, this.uniforms.shadingShiftTextureUvTransform);
    this._updateTextureMatrix(this.uniforms.matcapTexture, this.uniforms.matcapTextureUvTransform);
    this._updateTextureMatrix(this.uniforms.rimMultiplyTexture, this.uniforms.rimMultiplyTextureUvTransform);
    this._updateTextureMatrix(
      this.uniforms.outlineWidthMultiplyTexture,
      this.uniforms.outlineWidthMultiplyTextureUvTransform
    );
    this._updateTextureMatrix(this.uniforms.uvAnimationMaskTexture, this.uniforms.uvAnimationMaskTextureUvTransform);
    this.uniformsNeedUpdate = true;
  }
  /**
   * Returns a map object of preprocessor token and macro of the shader program.
   */
  _generateDefines() {
    const threeRevision = parseInt(THREE42.REVISION, 10);
    const useUvInVert = this.outlineWidthMultiplyTexture !== null;
    const useUvInFrag = this.map !== null || this.normalMap !== null || this.emissiveMap !== null || this.shadeMultiplyTexture !== null || this.shadingShiftTexture !== null || this.rimMultiplyTexture !== null || this.uvAnimationMaskTexture !== null;
    return {
      // Temporary compat against shader change @ Three.js r126
      // See: #21205, #21307, #21299
      THREE_VRM_THREE_REVISION: threeRevision,
      OUTLINE: this._isOutline,
      MTOON_USE_UV: useUvInVert || useUvInFrag,
      // we can't use `USE_UV` , it will be redefined in WebGLProgram.js
      MTOON_UVS_VERTEX_ONLY: useUvInVert && !useUvInFrag,
      V0_COMPAT_SHADE: this._v0CompatShade,
      USE_SHADEMULTIPLYTEXTURE: this.shadeMultiplyTexture !== null,
      USE_SHADINGSHIFTTEXTURE: this.shadingShiftTexture !== null,
      USE_MATCAPTEXTURE: this.matcapTexture !== null,
      USE_RIMMULTIPLYTEXTURE: this.rimMultiplyTexture !== null,
      USE_OUTLINEWIDTHMULTIPLYTEXTURE: this._isOutline && this.outlineWidthMultiplyTexture !== null,
      USE_UVANIMATIONMASKTEXTURE: this.uvAnimationMaskTexture !== null,
      IGNORE_VERTEX_COLOR: this._ignoreVertexColor === true,
      DEBUG_NORMAL: this._debugMode === "normal",
      DEBUG_LITSHADERATE: this._debugMode === "litShadeRate",
      DEBUG_UV: this._debugMode === "uv",
      OUTLINE_WIDTH_SCREEN: this._isOutline && this._outlineWidthMode === MToonMaterialOutlineWidthMode.ScreenCoordinates
    };
  }
  _updateTextureMatrix(src, dst) {
    if (src.value) {
      if (src.value.matrixAutoUpdate) {
        src.value.updateMatrix();
      }
      dst.value.copy(src.value.matrix);
    }
  }
};
var POSSIBLE_SPEC_VERSIONS6 = /* @__PURE__ */ new Set(["1.0", "1.0-beta"]);
var _MToonMaterialLoaderPlugin = class _MToonMaterialLoaderPlugin2 {
  get name() {
    return _MToonMaterialLoaderPlugin2.EXTENSION_NAME;
  }
  constructor(parser, options = {}) {
    var _a, _b, _c, _d;
    this.parser = parser;
    this.materialType = (_a = options.materialType) != null ? _a : MToonMaterial;
    this.renderOrderOffset = (_b = options.renderOrderOffset) != null ? _b : 0;
    this.v0CompatShade = (_c = options.v0CompatShade) != null ? _c : false;
    this.debugMode = (_d = options.debugMode) != null ? _d : "none";
    this._mToonMaterialSet = /* @__PURE__ */ new Set();
  }
  beforeRoot() {
    return __async3(this, null, function* () {
      this._removeUnlitExtensionIfMToonExists();
    });
  }
  afterRoot(gltf) {
    return __async3(this, null, function* () {
      gltf.userData.vrmMToonMaterials = Array.from(this._mToonMaterialSet);
    });
  }
  getMaterialType(materialIndex) {
    const v1Extension = this._getMToonExtension(materialIndex);
    if (v1Extension) {
      return this.materialType;
    }
    return null;
  }
  extendMaterialParams(materialIndex, materialParams) {
    const extension = this._getMToonExtension(materialIndex);
    if (extension) {
      return this._extendMaterialParams(extension, materialParams);
    }
    return null;
  }
  loadMesh(meshIndex) {
    return __async3(this, null, function* () {
      var _a;
      const parser = this.parser;
      const json = parser.json;
      const meshDef = (_a = json.meshes) == null ? void 0 : _a[meshIndex];
      if (meshDef == null) {
        throw new Error(
          `MToonMaterialLoaderPlugin: Attempt to use meshes[${meshIndex}] of glTF but the mesh doesn't exist`
        );
      }
      const primitivesDef = meshDef.primitives;
      const meshOrGroup = yield parser.loadMesh(meshIndex);
      if (primitivesDef.length === 1) {
        const mesh = meshOrGroup;
        const materialIndex = primitivesDef[0].material;
        if (materialIndex != null) {
          this._setupPrimitive(mesh, materialIndex);
        }
      } else {
        const group = meshOrGroup;
        for (let i = 0; i < primitivesDef.length; i++) {
          const mesh = group.children[i];
          const materialIndex = primitivesDef[i].material;
          if (materialIndex != null) {
            this._setupPrimitive(mesh, materialIndex);
          }
        }
      }
      return meshOrGroup;
    });
  }
  /**
   * Delete use of `KHR_materials_unlit` from its `materials` if the material is using MToon.
   *
   * Since GLTFLoader have so many hardcoded procedure related to `KHR_materials_unlit`
   * we have to delete the extension before we start to parse the glTF.
   */
  _removeUnlitExtensionIfMToonExists() {
    const parser = this.parser;
    const json = parser.json;
    const materialDefs = json.materials;
    materialDefs == null ? void 0 : materialDefs.map((materialDef, iMaterial) => {
      var _a;
      const extension = this._getMToonExtension(iMaterial);
      if (extension && ((_a = materialDef.extensions) == null ? void 0 : _a["KHR_materials_unlit"])) {
        delete materialDef.extensions["KHR_materials_unlit"];
      }
    });
  }
  _getMToonExtension(materialIndex) {
    var _a, _b;
    const parser = this.parser;
    const json = parser.json;
    const materialDef = (_a = json.materials) == null ? void 0 : _a[materialIndex];
    if (materialDef == null) {
      console.warn(
        `MToonMaterialLoaderPlugin: Attempt to use materials[${materialIndex}] of glTF but the material doesn't exist`
      );
      return void 0;
    }
    const extension = (_b = materialDef.extensions) == null ? void 0 : _b[_MToonMaterialLoaderPlugin2.EXTENSION_NAME];
    if (extension == null) {
      return void 0;
    }
    const specVersion = extension.specVersion;
    if (!POSSIBLE_SPEC_VERSIONS6.has(specVersion)) {
      console.warn(
        `MToonMaterialLoaderPlugin: Unknown ${_MToonMaterialLoaderPlugin2.EXTENSION_NAME} specVersion "${specVersion}"`
      );
      return void 0;
    }
    return extension;
  }
  _extendMaterialParams(extension, materialParams) {
    return __async3(this, null, function* () {
      var _a;
      delete materialParams.metalness;
      delete materialParams.roughness;
      const assignHelper = new GLTFMToonMaterialParamsAssignHelper(this.parser, materialParams);
      assignHelper.assignPrimitive("transparentWithZWrite", extension.transparentWithZWrite);
      assignHelper.assignColor("shadeColorFactor", extension.shadeColorFactor);
      assignHelper.assignTexture("shadeMultiplyTexture", extension.shadeMultiplyTexture, true);
      assignHelper.assignPrimitive("shadingShiftFactor", extension.shadingShiftFactor);
      assignHelper.assignTexture("shadingShiftTexture", extension.shadingShiftTexture, true);
      assignHelper.assignPrimitive("shadingShiftTextureScale", (_a = extension.shadingShiftTexture) == null ? void 0 : _a.scale);
      assignHelper.assignPrimitive("shadingToonyFactor", extension.shadingToonyFactor);
      assignHelper.assignPrimitive("giEqualizationFactor", extension.giEqualizationFactor);
      assignHelper.assignColor("matcapFactor", extension.matcapFactor);
      assignHelper.assignTexture("matcapTexture", extension.matcapTexture, true);
      assignHelper.assignColor("parametricRimColorFactor", extension.parametricRimColorFactor);
      assignHelper.assignTexture("rimMultiplyTexture", extension.rimMultiplyTexture, true);
      assignHelper.assignPrimitive("rimLightingMixFactor", extension.rimLightingMixFactor);
      assignHelper.assignPrimitive("parametricRimFresnelPowerFactor", extension.parametricRimFresnelPowerFactor);
      assignHelper.assignPrimitive("parametricRimLiftFactor", extension.parametricRimLiftFactor);
      assignHelper.assignPrimitive("outlineWidthMode", extension.outlineWidthMode);
      assignHelper.assignPrimitive("outlineWidthFactor", extension.outlineWidthFactor);
      assignHelper.assignTexture("outlineWidthMultiplyTexture", extension.outlineWidthMultiplyTexture, false);
      assignHelper.assignColor("outlineColorFactor", extension.outlineColorFactor);
      assignHelper.assignPrimitive("outlineLightingMixFactor", extension.outlineLightingMixFactor);
      assignHelper.assignTexture("uvAnimationMaskTexture", extension.uvAnimationMaskTexture, false);
      assignHelper.assignPrimitive("uvAnimationScrollXSpeedFactor", extension.uvAnimationScrollXSpeedFactor);
      assignHelper.assignPrimitive("uvAnimationScrollYSpeedFactor", extension.uvAnimationScrollYSpeedFactor);
      assignHelper.assignPrimitive("uvAnimationRotationSpeedFactor", extension.uvAnimationRotationSpeedFactor);
      assignHelper.assignPrimitive("v0CompatShade", this.v0CompatShade);
      assignHelper.assignPrimitive("debugMode", this.debugMode);
      yield assignHelper.pending;
    });
  }
  /**
   * This will do two processes that is required to render MToon properly.
   *
   * - Set render order
   * - Generate outline
   *
   * @param mesh A target GLTF primitive
   * @param materialIndex The material index of the primitive
   */
  _setupPrimitive(mesh, materialIndex) {
    const extension = this._getMToonExtension(materialIndex);
    if (extension) {
      const renderOrder = this._parseRenderOrder(extension);
      mesh.renderOrder = renderOrder + this.renderOrderOffset;
      this._generateOutline(mesh);
      this._addToMaterialSet(mesh);
      return;
    }
  }
  /**
   * Check whether the material should generate outline or not.
   * @param surfaceMaterial The material to check
   * @returns True if the material should generate outline
   */
  _shouldGenerateOutline(surfaceMaterial) {
    return typeof surfaceMaterial.outlineWidthMode === "string" && surfaceMaterial.outlineWidthMode !== "none" && typeof surfaceMaterial.outlineWidthFactor === "number" && surfaceMaterial.outlineWidthFactor > 0;
  }
  /**
   * Generate outline for the given mesh, if it needs.
   *
   * @param mesh The target mesh
   */
  _generateOutline(mesh) {
    const surfaceMaterial = mesh.material;
    if (!(surfaceMaterial instanceof THREE52.Material)) {
      return;
    }
    if (!this._shouldGenerateOutline(surfaceMaterial)) {
      return;
    }
    mesh.material = [surfaceMaterial];
    const outlineMaterial = surfaceMaterial.clone();
    outlineMaterial.name += " (Outline)";
    outlineMaterial.isOutline = true;
    outlineMaterial.side = THREE52.BackSide;
    mesh.material.push(outlineMaterial);
    const geometry = mesh.geometry;
    const primitiveVertices = geometry.index ? geometry.index.count : geometry.attributes.position.count / 3;
    geometry.addGroup(0, primitiveVertices, 0);
    geometry.addGroup(0, primitiveVertices, 1);
  }
  _addToMaterialSet(mesh) {
    const materialOrMaterials = mesh.material;
    const materialSet = /* @__PURE__ */ new Set();
    if (Array.isArray(materialOrMaterials)) {
      materialOrMaterials.forEach((material) => materialSet.add(material));
    } else {
      materialSet.add(materialOrMaterials);
    }
    for (const material of materialSet) {
      this._mToonMaterialSet.add(material);
    }
  }
  _parseRenderOrder(extension) {
    var _a;
    const enabledZWrite = extension.transparentWithZWrite;
    return (enabledZWrite ? 0 : 19) + ((_a = extension.renderQueueOffsetNumber) != null ? _a : 0);
  }
};
_MToonMaterialLoaderPlugin.EXTENSION_NAME = "VRMC_materials_mtoon";
var MToonMaterialLoaderPlugin = _MToonMaterialLoaderPlugin;

// ../three-vrm-materials-hdr-emissive-multiplier/lib/three-vrm-materials-hdr-emissive-multiplier.module.js
var __async4 = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
var _VRMMaterialsHDREmissiveMultiplierLoaderPlugin = class _VRMMaterialsHDREmissiveMultiplierLoaderPlugin2 {
  get name() {
    return _VRMMaterialsHDREmissiveMultiplierLoaderPlugin2.EXTENSION_NAME;
  }
  constructor(parser) {
    this.parser = parser;
  }
  extendMaterialParams(materialIndex, materialParams) {
    return __async4(this, null, function* () {
      const extension = this._getHDREmissiveMultiplierExtension(materialIndex);
      if (extension == null) {
        return;
      }
      console.warn(
        "VRMMaterialsHDREmissiveMultiplierLoaderPlugin: `VRMC_materials_hdr_emissiveMultiplier` is archived. Use `KHR_materials_emissive_strength` instead."
      );
      const emissiveMultiplier = extension.emissiveMultiplier;
      materialParams.emissiveIntensity = emissiveMultiplier;
    });
  }
  _getHDREmissiveMultiplierExtension(materialIndex) {
    var _a, _b;
    const parser = this.parser;
    const json = parser.json;
    const materialDef = (_a = json.materials) == null ? void 0 : _a[materialIndex];
    if (materialDef == null) {
      console.warn(
        `VRMMaterialsHDREmissiveMultiplierLoaderPlugin: Attempt to use materials[${materialIndex}] of glTF but the material doesn't exist`
      );
      return void 0;
    }
    const extension = (_b = materialDef.extensions) == null ? void 0 : _b[_VRMMaterialsHDREmissiveMultiplierLoaderPlugin2.EXTENSION_NAME];
    if (extension == null) {
      return void 0;
    }
    return extension;
  }
};
_VRMMaterialsHDREmissiveMultiplierLoaderPlugin.EXTENSION_NAME = "VRMC_materials_hdr_emissiveMultiplier";
var VRMMaterialsHDREmissiveMultiplierLoaderPlugin = _VRMMaterialsHDREmissiveMultiplierLoaderPlugin;

// ../three-vrm-materials-v0compat/lib/three-vrm-materials-v0compat.module.js
import * as THREE18 from "./three.js";
var __defProp2 = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols2 = Object.getOwnPropertySymbols;
var __hasOwnProp2 = Object.prototype.hasOwnProperty;
var __propIsEnum2 = Object.prototype.propertyIsEnumerable;
var __defNormalProp2 = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues2 = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp2.call(b, prop))
      __defNormalProp2(a, prop, b[prop]);
  if (__getOwnPropSymbols2)
    for (var prop of __getOwnPropSymbols2(b)) {
      if (__propIsEnum2.call(b, prop))
        __defNormalProp2(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __async5 = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
function gammaEOTF(e) {
  return Math.pow(e, 2.2);
}
var VRMMaterialsV0CompatPlugin = class {
  get name() {
    return "VRMMaterialsV0CompatPlugin";
  }
  constructor(parser) {
    var _a;
    this.parser = parser;
    this._renderQueueMapTransparent = /* @__PURE__ */ new Map();
    this._renderQueueMapTransparentZWrite = /* @__PURE__ */ new Map();
    const json = this.parser.json;
    json.extensionsUsed = (_a = json.extensionsUsed) != null ? _a : [];
    if (json.extensionsUsed.indexOf("KHR_texture_transform") === -1) {
      json.extensionsUsed.push("KHR_texture_transform");
    }
  }
  beforeRoot() {
    return __async5(this, null, function* () {
      var _a;
      const json = this.parser.json;
      const v0VRMExtension = (_a = json.extensions) == null ? void 0 : _a["VRM"];
      const v0MaterialProperties = v0VRMExtension == null ? void 0 : v0VRMExtension.materialProperties;
      if (!v0MaterialProperties) {
        return;
      }
      this._populateRenderQueueMap(v0MaterialProperties);
      v0MaterialProperties.forEach((materialProperties, materialIndex) => {
        var _a2, _b;
        const materialDef = (_a2 = json.materials) == null ? void 0 : _a2[materialIndex];
        if (materialDef == null) {
          console.warn(
            `VRMMaterialsV0CompatPlugin: Attempt to use materials[${materialIndex}] of glTF but the material doesn't exist`
          );
          return;
        }
        if (materialProperties.shader === "VRM/MToon") {
          const material = this._parseV0MToonProperties(materialProperties, materialDef);
          json.materials[materialIndex] = material;
        } else if ((_b = materialProperties.shader) == null ? void 0 : _b.startsWith("VRM/Unlit")) {
          const material = this._parseV0UnlitProperties(materialProperties, materialDef);
          json.materials[materialIndex] = material;
        } else if (materialProperties.shader === "VRM_USE_GLTFSHADER") {
        } else {
          console.warn(`VRMMaterialsV0CompatPlugin: Unknown shader: ${materialProperties.shader}`);
        }
      });
    });
  }
  _parseV0MToonProperties(materialProperties, schemaMaterial) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L, _M, _N, _O, _P, _Q, _R, _S, _T, _U, _V, _W, _X, _Y, _Z, __, _$, _aa;
    const isTransparent = (_b = (_a = materialProperties.keywordMap) == null ? void 0 : _a["_ALPHABLEND_ON"]) != null ? _b : false;
    const enabledZWrite = ((_c = materialProperties.floatProperties) == null ? void 0 : _c["_ZWrite"]) === 1;
    const transparentWithZWrite = enabledZWrite && isTransparent;
    const renderQueueOffsetNumber = this._v0ParseRenderQueue(materialProperties);
    const isCutoff = (_e = (_d = materialProperties.keywordMap) == null ? void 0 : _d["_ALPHATEST_ON"]) != null ? _e : false;
    const alphaMode = isTransparent ? "BLEND" : isCutoff ? "MASK" : "OPAQUE";
    const alphaCutoff = isCutoff ? (_g = (_f = materialProperties.floatProperties) == null ? void 0 : _f["_Cutoff"]) != null ? _g : 0.5 : void 0;
    const cullMode = (_i = (_h = materialProperties.floatProperties) == null ? void 0 : _h["_CullMode"]) != null ? _i : 2;
    const doubleSided = cullMode === 0;
    const textureTransformExt = this._portTextureTransform(materialProperties);
    const baseColorFactor = ((_k = (_j = materialProperties.vectorProperties) == null ? void 0 : _j["_Color"]) != null ? _k : [1, 1, 1, 1]).map(
      (v, i) => i === 3 ? v : gammaEOTF(v)
      // alpha channel is stored in linear
    );
    const baseColorTextureIndex = (_l = materialProperties.textureProperties) == null ? void 0 : _l["_MainTex"];
    const baseColorTexture = baseColorTextureIndex != null ? {
      index: baseColorTextureIndex,
      extensions: __spreadValues2({}, textureTransformExt)
    } : void 0;
    const normalTextureScale = (_n = (_m = materialProperties.floatProperties) == null ? void 0 : _m["_BumpScale"]) != null ? _n : 1;
    const normalTextureIndex = (_o = materialProperties.textureProperties) == null ? void 0 : _o["_BumpMap"];
    const normalTexture = normalTextureIndex != null ? {
      index: normalTextureIndex,
      scale: normalTextureScale,
      extensions: __spreadValues2({}, textureTransformExt)
    } : void 0;
    const emissiveFactor = ((_q = (_p = materialProperties.vectorProperties) == null ? void 0 : _p["_EmissionColor"]) != null ? _q : [0, 0, 0, 1]).map(
      gammaEOTF
    );
    const emissiveTextureIndex = (_r = materialProperties.textureProperties) == null ? void 0 : _r["_EmissionMap"];
    const emissiveTexture = emissiveTextureIndex != null ? {
      index: emissiveTextureIndex,
      extensions: __spreadValues2({}, textureTransformExt)
    } : void 0;
    const shadeColorFactor = ((_t = (_s = materialProperties.vectorProperties) == null ? void 0 : _s["_ShadeColor"]) != null ? _t : [0.97, 0.81, 0.86, 1]).map(
      gammaEOTF
    );
    const shadeMultiplyTextureIndex = (_u = materialProperties.textureProperties) == null ? void 0 : _u["_ShadeTexture"];
    const shadeMultiplyTexture = shadeMultiplyTextureIndex != null ? {
      index: shadeMultiplyTextureIndex,
      extensions: __spreadValues2({}, textureTransformExt)
    } : void 0;
    let shadingShiftFactor = (_w = (_v = materialProperties.floatProperties) == null ? void 0 : _v["_ShadeShift"]) != null ? _w : 0;
    let shadingToonyFactor = (_y = (_x = materialProperties.floatProperties) == null ? void 0 : _x["_ShadeToony"]) != null ? _y : 0.9;
    shadingToonyFactor = THREE18.MathUtils.lerp(shadingToonyFactor, 1, 0.5 + 0.5 * shadingShiftFactor);
    shadingShiftFactor = -shadingShiftFactor - (1 - shadingToonyFactor);
    const giIntensityFactor = (_A = (_z = materialProperties.floatProperties) == null ? void 0 : _z["_IndirectLightIntensity"]) != null ? _A : 0.1;
    const giEqualizationFactor = giIntensityFactor ? 1 - giIntensityFactor : void 0;
    const matcapTextureIndex = (_B = materialProperties.textureProperties) == null ? void 0 : _B["_SphereAdd"];
    const matcapFactor = matcapTextureIndex != null ? [1, 1, 1] : void 0;
    const matcapTexture = matcapTextureIndex != null ? {
      index: matcapTextureIndex
    } : void 0;
    const rimLightingMixFactor = (_D = (_C = materialProperties.floatProperties) == null ? void 0 : _C["_RimLightingMix"]) != null ? _D : 0;
    const rimMultiplyTextureIndex = (_E = materialProperties.textureProperties) == null ? void 0 : _E["_RimTexture"];
    const rimMultiplyTexture = rimMultiplyTextureIndex != null ? {
      index: rimMultiplyTextureIndex,
      extensions: __spreadValues2({}, textureTransformExt)
    } : void 0;
    const parametricRimColorFactor = ((_G = (_F = materialProperties.vectorProperties) == null ? void 0 : _F["_RimColor"]) != null ? _G : [0, 0, 0, 1]).map(
      gammaEOTF
    );
    const parametricRimFresnelPowerFactor = (_I = (_H = materialProperties.floatProperties) == null ? void 0 : _H["_RimFresnelPower"]) != null ? _I : 1;
    const parametricRimLiftFactor = (_K = (_J = materialProperties.floatProperties) == null ? void 0 : _J["_RimLift"]) != null ? _K : 0;
    const outlineWidthMode = ["none", "worldCoordinates", "screenCoordinates"][(_M = (_L = materialProperties.floatProperties) == null ? void 0 : _L["_OutlineWidthMode"]) != null ? _M : 0];
    let outlineWidthFactor = (_O = (_N = materialProperties.floatProperties) == null ? void 0 : _N["_OutlineWidth"]) != null ? _O : 0;
    outlineWidthFactor = 0.01 * outlineWidthFactor;
    const outlineWidthMultiplyTextureIndex = (_P = materialProperties.textureProperties) == null ? void 0 : _P["_OutlineWidthTexture"];
    const outlineWidthMultiplyTexture = outlineWidthMultiplyTextureIndex != null ? {
      index: outlineWidthMultiplyTextureIndex,
      extensions: __spreadValues2({}, textureTransformExt)
    } : void 0;
    const outlineColorFactor = ((_R = (_Q = materialProperties.vectorProperties) == null ? void 0 : _Q["_OutlineColor"]) != null ? _R : [0, 0, 0]).map(
      gammaEOTF
    );
    const outlineColorMode = (_T = (_S = materialProperties.floatProperties) == null ? void 0 : _S["_OutlineColorMode"]) != null ? _T : 0;
    const outlineLightingMixFactor = outlineColorMode === 1 ? (_V = (_U = materialProperties.floatProperties) == null ? void 0 : _U["_OutlineLightingMix"]) != null ? _V : 1 : 0;
    const uvAnimationMaskTextureIndex = (_W = materialProperties.textureProperties) == null ? void 0 : _W["_UvAnimMaskTexture"];
    const uvAnimationMaskTexture = uvAnimationMaskTextureIndex != null ? {
      index: uvAnimationMaskTextureIndex,
      extensions: __spreadValues2({}, textureTransformExt)
    } : void 0;
    const uvAnimationScrollXSpeedFactor = (_Y = (_X = materialProperties.floatProperties) == null ? void 0 : _X["_UvAnimScrollX"]) != null ? _Y : 0;
    let uvAnimationScrollYSpeedFactor = (__ = (_Z = materialProperties.floatProperties) == null ? void 0 : _Z["_UvAnimScrollY"]) != null ? __ : 0;
    if (uvAnimationScrollYSpeedFactor != null) {
      uvAnimationScrollYSpeedFactor = -uvAnimationScrollYSpeedFactor;
    }
    const uvAnimationRotationSpeedFactor = (_aa = (_$ = materialProperties.floatProperties) == null ? void 0 : _$["_UvAnimRotation"]) != null ? _aa : 0;
    const mtoonExtension = {
      specVersion: "1.0",
      transparentWithZWrite,
      renderQueueOffsetNumber,
      shadeColorFactor,
      shadeMultiplyTexture,
      shadingShiftFactor,
      shadingToonyFactor,
      giEqualizationFactor,
      matcapFactor,
      matcapTexture,
      rimLightingMixFactor,
      rimMultiplyTexture,
      parametricRimColorFactor,
      parametricRimFresnelPowerFactor,
      parametricRimLiftFactor,
      outlineWidthMode,
      outlineWidthFactor,
      outlineWidthMultiplyTexture,
      outlineColorFactor,
      outlineLightingMixFactor,
      uvAnimationMaskTexture,
      uvAnimationScrollXSpeedFactor,
      uvAnimationScrollYSpeedFactor,
      uvAnimationRotationSpeedFactor
    };
    return __spreadProps(__spreadValues2({}, schemaMaterial), {
      pbrMetallicRoughness: {
        baseColorFactor,
        baseColorTexture
      },
      normalTexture,
      emissiveTexture,
      emissiveFactor,
      alphaMode,
      alphaCutoff,
      doubleSided,
      extensions: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        VRMC_materials_mtoon: mtoonExtension
      }
    });
  }
  _parseV0UnlitProperties(materialProperties, schemaMaterial) {
    var _a, _b, _c, _d, _e;
    const isTransparentZWrite = materialProperties.shader === "VRM/UnlitTransparentZWrite";
    const isTransparent = materialProperties.shader === "VRM/UnlitTransparent" || isTransparentZWrite;
    const renderQueueOffsetNumber = this._v0ParseRenderQueue(materialProperties);
    const isCutoff = materialProperties.shader === "VRM/UnlitCutout";
    const alphaMode = isTransparent ? "BLEND" : isCutoff ? "MASK" : "OPAQUE";
    const alphaCutoff = isCutoff ? (_b = (_a = materialProperties.floatProperties) == null ? void 0 : _a["_Cutoff"]) != null ? _b : 0.5 : void 0;
    const textureTransformExt = this._portTextureTransform(materialProperties);
    const baseColorFactor = ((_d = (_c = materialProperties.vectorProperties) == null ? void 0 : _c["_Color"]) != null ? _d : [1, 1, 1, 1]).map(gammaEOTF);
    const baseColorTextureIndex = (_e = materialProperties.textureProperties) == null ? void 0 : _e["_MainTex"];
    const baseColorTexture = baseColorTextureIndex != null ? {
      index: baseColorTextureIndex,
      extensions: __spreadValues2({}, textureTransformExt)
    } : void 0;
    const mtoonExtension = {
      specVersion: "1.0",
      transparentWithZWrite: isTransparentZWrite,
      renderQueueOffsetNumber,
      shadeColorFactor: baseColorFactor,
      shadeMultiplyTexture: baseColorTexture
    };
    return __spreadProps(__spreadValues2({}, schemaMaterial), {
      pbrMetallicRoughness: {
        baseColorFactor,
        baseColorTexture
      },
      alphaMode,
      alphaCutoff,
      extensions: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        VRMC_materials_mtoon: mtoonExtension
      }
    });
  }
  /**
   * Create a glTF `KHR_texture_transform` extension from v0 texture transform info.
   */
  _portTextureTransform(materialProperties) {
    var _a, _b, _c, _d, _e;
    const textureTransform = (_a = materialProperties.vectorProperties) == null ? void 0 : _a["_MainTex"];
    if (textureTransform == null) {
      return {};
    }
    const offset = [(_b = textureTransform == null ? void 0 : textureTransform[0]) != null ? _b : 0, (_c = textureTransform == null ? void 0 : textureTransform[1]) != null ? _c : 0];
    const scale = [(_d = textureTransform == null ? void 0 : textureTransform[2]) != null ? _d : 1, (_e = textureTransform == null ? void 0 : textureTransform[3]) != null ? _e : 1];
    offset[1] = 1 - scale[1] - offset[1];
    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      KHR_texture_transform: { offset, scale }
    };
  }
  /**
   * Convert v0 render order into v1 render order.
   * This uses a map from v0 render queue to v1 compliant render queue offset which is generated in {@link _populateRenderQueueMap}.
   */
  _v0ParseRenderQueue(materialProperties) {
    var _a, _b;
    const isTransparentZWrite = materialProperties.shader === "VRM/UnlitTransparentZWrite";
    const isTransparent = ((_a = materialProperties.keywordMap) == null ? void 0 : _a["_ALPHABLEND_ON"]) != void 0 || materialProperties.shader === "VRM/UnlitTransparent" || isTransparentZWrite;
    const enabledZWrite = ((_b = materialProperties.floatProperties) == null ? void 0 : _b["_ZWrite"]) === 1 || isTransparentZWrite;
    let offset = 0;
    if (isTransparent) {
      const v0Queue = materialProperties.renderQueue;
      if (v0Queue != null) {
        if (enabledZWrite) {
          offset = this._renderQueueMapTransparentZWrite.get(v0Queue);
        } else {
          offset = this._renderQueueMapTransparent.get(v0Queue);
        }
      }
    }
    return offset;
  }
  /**
   * Create a map which maps v0 render queue to v1 compliant render queue offset.
   * This lists up all render queues the model use and creates a map to new render queue offsets in the same order.
   */
  _populateRenderQueueMap(materialPropertiesList) {
    const renderQueuesTransparent = /* @__PURE__ */ new Set();
    const renderQueuesTransparentZWrite = /* @__PURE__ */ new Set();
    materialPropertiesList.forEach((materialProperties) => {
      var _a, _b;
      const isTransparentZWrite = materialProperties.shader === "VRM/UnlitTransparentZWrite";
      const isTransparent = ((_a = materialProperties.keywordMap) == null ? void 0 : _a["_ALPHABLEND_ON"]) != void 0 || materialProperties.shader === "VRM/UnlitTransparent" || isTransparentZWrite;
      const enabledZWrite = ((_b = materialProperties.floatProperties) == null ? void 0 : _b["_ZWrite"]) === 1 || isTransparentZWrite;
      if (isTransparent) {
        const v0Queue = materialProperties.renderQueue;
        if (v0Queue != null) {
          if (enabledZWrite) {
            renderQueuesTransparentZWrite.add(v0Queue);
          } else {
            renderQueuesTransparent.add(v0Queue);
          }
        }
      }
    });
    if (renderQueuesTransparent.size > 10) {
      console.warn(
        `VRMMaterialsV0CompatPlugin: This VRM uses ${renderQueuesTransparent.size} render queues for Transparent materials while VRM 1.0 only supports up to 10 render queues. The model might not be rendered correctly.`
      );
    }
    if (renderQueuesTransparentZWrite.size > 10) {
      console.warn(
        `VRMMaterialsV0CompatPlugin: This VRM uses ${renderQueuesTransparentZWrite.size} render queues for TransparentZWrite materials while VRM 1.0 only supports up to 10 render queues. The model might not be rendered correctly.`
      );
    }
    Array.from(renderQueuesTransparent).sort().forEach((queue, i) => {
      const newQueueOffset = Math.min(Math.max(i - renderQueuesTransparent.size + 1, -9), 0);
      this._renderQueueMapTransparent.set(queue, newQueueOffset);
    });
    Array.from(renderQueuesTransparentZWrite).sort().forEach((queue, i) => {
      const newQueueOffset = Math.min(Math.max(i, 0), 9);
      this._renderQueueMapTransparentZWrite.set(queue, newQueueOffset);
    });
  }
};

// ../three-vrm-node-constraint/lib/three-vrm-node-constraint.module.js
import * as THREE19 from "./three.js";
import * as THREE33 from "./three.js";
import * as THREE23 from "./three.js";
import * as THREE43 from "./three.js";
import * as THREE53 from "./three.js";
var __async6 = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
var _v3A6 = new THREE19.Vector3();
var VRMNodeConstraintHelper = class extends THREE19.Group {
  constructor(constraint) {
    super();
    this._attrPosition = new THREE19.BufferAttribute(new Float32Array([0, 0, 0, 0, 0, 0]), 3);
    this._attrPosition.setUsage(THREE19.DynamicDrawUsage);
    const geometry = new THREE19.BufferGeometry();
    geometry.setAttribute("position", this._attrPosition);
    const material = new THREE19.LineBasicMaterial({
      color: 16711935,
      depthTest: false,
      depthWrite: false
    });
    this._line = new THREE19.Line(geometry, material);
    this.add(this._line);
    this.constraint = constraint;
  }
  updateMatrixWorld(force) {
    _v3A6.setFromMatrixPosition(this.constraint.destination.matrixWorld);
    this._attrPosition.setXYZ(0, _v3A6.x, _v3A6.y, _v3A6.z);
    if (this.constraint.source) {
      _v3A6.setFromMatrixPosition(this.constraint.source.matrixWorld);
    }
    this._attrPosition.setXYZ(1, _v3A6.x, _v3A6.y, _v3A6.z);
    this._attrPosition.needsUpdate = true;
    super.updateMatrixWorld(force);
  }
};
function decomposePosition(matrix, target) {
  return target.set(matrix.elements[12], matrix.elements[13], matrix.elements[14]);
}
var _v3A22 = new THREE23.Vector3();
var _v3B4 = new THREE23.Vector3();
function decomposeRotation(matrix, target) {
  matrix.decompose(_v3A22, target, _v3B4);
  return target;
}
function quatInvertCompat2(target) {
  if (target.invert) {
    target.invert();
  } else {
    target.inverse();
  }
  return target;
}
var VRMNodeConstraint = class {
  /**
   * @param destination The destination object
   * @param source The source object
   */
  constructor(destination, source) {
    this.destination = destination;
    this.source = source;
    this.weight = 1;
  }
};
var _v3A32 = new THREE33.Vector3();
var _v3B22 = new THREE33.Vector3();
var _v3C2 = new THREE33.Vector3();
var _quatA7 = new THREE33.Quaternion();
var _quatB4 = new THREE33.Quaternion();
var _quatC2 = new THREE33.Quaternion();
var VRMAimConstraint = class extends VRMNodeConstraint {
  /**
   * The aim axis of the constraint.
   */
  get aimAxis() {
    return this._aimAxis;
  }
  /**
   * The aim axis of the constraint.
   */
  set aimAxis(aimAxis) {
    this._aimAxis = aimAxis;
    this._v3AimAxis.set(
      aimAxis === "PositiveX" ? 1 : aimAxis === "NegativeX" ? -1 : 0,
      aimAxis === "PositiveY" ? 1 : aimAxis === "NegativeY" ? -1 : 0,
      aimAxis === "PositiveZ" ? 1 : aimAxis === "NegativeZ" ? -1 : 0
    );
  }
  get dependencies() {
    const set = /* @__PURE__ */ new Set([this.source]);
    if (this.destination.parent) {
      set.add(this.destination.parent);
    }
    return set;
  }
  constructor(destination, source) {
    super(destination, source);
    this._aimAxis = "PositiveX";
    this._v3AimAxis = new THREE33.Vector3(1, 0, 0);
    this._dstRestQuat = new THREE33.Quaternion();
  }
  setInitState() {
    this._dstRestQuat.copy(this.destination.quaternion);
  }
  update() {
    this.destination.updateWorldMatrix(true, false);
    this.source.updateWorldMatrix(true, false);
    const dstParentWorldQuat = _quatA7.identity();
    const invDstParentWorldQuat = _quatB4.identity();
    if (this.destination.parent) {
      decomposeRotation(this.destination.parent.matrixWorld, dstParentWorldQuat);
      quatInvertCompat2(invDstParentWorldQuat.copy(dstParentWorldQuat));
    }
    const a0 = _v3A32.copy(this._v3AimAxis).applyQuaternion(this._dstRestQuat).applyQuaternion(dstParentWorldQuat);
    const a1 = decomposePosition(this.source.matrixWorld, _v3B22).sub(decomposePosition(this.destination.matrixWorld, _v3C2)).normalize();
    const targetQuat = _quatC2.setFromUnitVectors(a0, a1).premultiply(invDstParentWorldQuat).multiply(dstParentWorldQuat).multiply(this._dstRestQuat);
    this.destination.quaternion.copy(this._dstRestQuat).slerp(targetQuat, this.weight);
  }
};
function traverseAncestorsFromRoot(object, callback) {
  const ancestors = [object];
  let head = object.parent;
  while (head !== null) {
    ancestors.unshift(head);
    head = head.parent;
  }
  ancestors.forEach((ancestor) => {
    callback(ancestor);
  });
}
var VRMNodeConstraintManager = class {
  constructor() {
    this._constraints = /* @__PURE__ */ new Set();
    this._objectConstraintsMap = /* @__PURE__ */ new Map();
  }
  get constraints() {
    return this._constraints;
  }
  addConstraint(constraint) {
    this._constraints.add(constraint);
    let objectSet = this._objectConstraintsMap.get(constraint.destination);
    if (objectSet == null) {
      objectSet = /* @__PURE__ */ new Set();
      this._objectConstraintsMap.set(constraint.destination, objectSet);
    }
    objectSet.add(constraint);
  }
  deleteConstraint(constraint) {
    this._constraints.delete(constraint);
    const objectSet = this._objectConstraintsMap.get(constraint.destination);
    objectSet.delete(constraint);
  }
  setInitState() {
    const constraintsTried = /* @__PURE__ */ new Set();
    const constraintsDone = /* @__PURE__ */ new Set();
    for (const constraint of this._constraints) {
      this._processConstraint(constraint, constraintsTried, constraintsDone, (constraint2) => constraint2.setInitState());
    }
  }
  update() {
    const constraintsTried = /* @__PURE__ */ new Set();
    const constraintsDone = /* @__PURE__ */ new Set();
    for (const constraint of this._constraints) {
      this._processConstraint(constraint, constraintsTried, constraintsDone, (constraint2) => constraint2.update());
    }
  }
  /**
   * Update a constraint.
   * If there are other constraints that are dependant, it will try to update them recursively.
   * It might throw an error if there are circular dependencies.
   *
   * Intended to be used in {@link update} and {@link _processConstraint} itself recursively.
   *
   * @param constraint A constraint you want to update
   * @param constraintsTried Set of constraints that are already tried to be updated
   * @param constraintsDone Set of constraints that are already up to date
   */
  _processConstraint(constraint, constraintsTried, constraintsDone, callback) {
    if (constraintsDone.has(constraint)) {
      return;
    }
    if (constraintsTried.has(constraint)) {
      throw new Error("VRMNodeConstraintManager: Circular dependency detected while updating constraints");
    }
    constraintsTried.add(constraint);
    const depObjects = constraint.dependencies;
    for (const depObject of depObjects) {
      traverseAncestorsFromRoot(depObject, (depObjectAncestor) => {
        const objectSet = this._objectConstraintsMap.get(depObjectAncestor);
        if (objectSet) {
          for (const depConstraint of objectSet) {
            this._processConstraint(depConstraint, constraintsTried, constraintsDone, callback);
          }
        }
      });
    }
    callback(constraint);
    constraintsDone.add(constraint);
  }
};
var _quatA22 = new THREE43.Quaternion();
var _quatB22 = new THREE43.Quaternion();
var VRMRotationConstraint = class extends VRMNodeConstraint {
  get dependencies() {
    return /* @__PURE__ */ new Set([this.source]);
  }
  constructor(destination, source) {
    super(destination, source);
    this._dstRestQuat = new THREE43.Quaternion();
    this._invSrcRestQuat = new THREE43.Quaternion();
  }
  setInitState() {
    this._dstRestQuat.copy(this.destination.quaternion);
    quatInvertCompat2(this._invSrcRestQuat.copy(this.source.quaternion));
  }
  update() {
    const srcDeltaQuat = _quatA22.copy(this._invSrcRestQuat).multiply(this.source.quaternion);
    const targetQuat = _quatB22.copy(this._dstRestQuat).multiply(srcDeltaQuat);
    this.destination.quaternion.copy(this._dstRestQuat).slerp(targetQuat, this.weight);
  }
};
var _v3A42 = new THREE53.Vector3();
var _quatA32 = new THREE53.Quaternion();
var _quatB32 = new THREE53.Quaternion();
var VRMRollConstraint = class extends VRMNodeConstraint {
  /**
   * The roll axis of the constraint.
   */
  get rollAxis() {
    return this._rollAxis;
  }
  /**
   * The roll axis of the constraint.
   */
  set rollAxis(rollAxis) {
    this._rollAxis = rollAxis;
    this._v3RollAxis.set(rollAxis === "X" ? 1 : 0, rollAxis === "Y" ? 1 : 0, rollAxis === "Z" ? 1 : 0);
  }
  get dependencies() {
    return /* @__PURE__ */ new Set([this.source]);
  }
  constructor(destination, source) {
    super(destination, source);
    this._rollAxis = "X";
    this._v3RollAxis = new THREE53.Vector3(1, 0, 0);
    this._dstRestQuat = new THREE53.Quaternion();
    this._invDstRestQuat = new THREE53.Quaternion();
    this._invSrcRestQuatMulDstRestQuat = new THREE53.Quaternion();
  }
  setInitState() {
    this._dstRestQuat.copy(this.destination.quaternion);
    quatInvertCompat2(this._invDstRestQuat.copy(this._dstRestQuat));
    quatInvertCompat2(this._invSrcRestQuatMulDstRestQuat.copy(this.source.quaternion)).multiply(this._dstRestQuat);
  }
  update() {
    const quatDelta = _quatA32.copy(this._invDstRestQuat).multiply(this.source.quaternion).multiply(this._invSrcRestQuatMulDstRestQuat);
    const n1 = _v3A42.copy(this._v3RollAxis).applyQuaternion(quatDelta);
    const quatFromTo = _quatB32.setFromUnitVectors(n1, this._v3RollAxis);
    const targetQuat = quatFromTo.premultiply(this._dstRestQuat).multiply(quatDelta);
    this.destination.quaternion.copy(this._dstRestQuat).slerp(targetQuat, this.weight);
  }
};
var POSSIBLE_SPEC_VERSIONS7 = /* @__PURE__ */ new Set(["1.0", "1.0-beta"]);
var _VRMNodeConstraintLoaderPlugin = class _VRMNodeConstraintLoaderPlugin2 {
  get name() {
    return _VRMNodeConstraintLoaderPlugin2.EXTENSION_NAME;
  }
  constructor(parser, options) {
    this.parser = parser;
    this.helperRoot = options == null ? void 0 : options.helperRoot;
  }
  afterRoot(gltf) {
    return __async6(this, null, function* () {
      gltf.userData.vrmNodeConstraintManager = yield this._import(gltf);
    });
  }
  /**
   * Import constraints from a GLTF and returns a {@link VRMNodeConstraintManager}.
   * It might return `null` instead when it does not need to be created or something go wrong.
   *
   * @param gltf A parsed result of GLTF taken from GLTFLoader
   */
  _import(gltf) {
    return __async6(this, null, function* () {
      var _a;
      const json = this.parser.json;
      const isConstraintsUsed = ((_a = json.extensionsUsed) == null ? void 0 : _a.indexOf(_VRMNodeConstraintLoaderPlugin2.EXTENSION_NAME)) !== -1;
      if (!isConstraintsUsed) {
        return null;
      }
      const manager = new VRMNodeConstraintManager();
      const threeNodes = yield this.parser.getDependencies("node");
      threeNodes.forEach((node, nodeIndex) => {
        var _a2;
        const schemaNode = json.nodes[nodeIndex];
        const extension = (_a2 = schemaNode == null ? void 0 : schemaNode.extensions) == null ? void 0 : _a2[_VRMNodeConstraintLoaderPlugin2.EXTENSION_NAME];
        if (extension == null) {
          return;
        }
        const specVersion = extension.specVersion;
        if (!POSSIBLE_SPEC_VERSIONS7.has(specVersion)) {
          console.warn(
            `VRMNodeConstraintLoaderPlugin: Unknown ${_VRMNodeConstraintLoaderPlugin2.EXTENSION_NAME} specVersion "${specVersion}"`
          );
          return;
        }
        const constraintDef = extension.constraint;
        if (constraintDef.roll != null) {
          const constraint = this._importRollConstraint(node, threeNodes, constraintDef.roll);
          manager.addConstraint(constraint);
        } else if (constraintDef.aim != null) {
          const constraint = this._importAimConstraint(node, threeNodes, constraintDef.aim);
          manager.addConstraint(constraint);
        } else if (constraintDef.rotation != null) {
          const constraint = this._importRotationConstraint(node, threeNodes, constraintDef.rotation);
          manager.addConstraint(constraint);
        }
      });
      gltf.scene.updateMatrixWorld();
      manager.setInitState();
      return manager;
    });
  }
  _importRollConstraint(destination, nodes, rollConstraintDef) {
    const { source: sourceIndex, rollAxis, weight } = rollConstraintDef;
    const source = nodes[sourceIndex];
    const constraint = new VRMRollConstraint(destination, source);
    if (rollAxis != null) {
      constraint.rollAxis = rollAxis;
    }
    if (weight != null) {
      constraint.weight = weight;
    }
    if (this.helperRoot) {
      const helper = new VRMNodeConstraintHelper(constraint);
      this.helperRoot.add(helper);
    }
    return constraint;
  }
  _importAimConstraint(destination, nodes, aimConstraintDef) {
    const { source: sourceIndex, aimAxis, weight } = aimConstraintDef;
    const source = nodes[sourceIndex];
    const constraint = new VRMAimConstraint(destination, source);
    if (aimAxis != null) {
      constraint.aimAxis = aimAxis;
    }
    if (weight != null) {
      constraint.weight = weight;
    }
    if (this.helperRoot) {
      const helper = new VRMNodeConstraintHelper(constraint);
      this.helperRoot.add(helper);
    }
    return constraint;
  }
  _importRotationConstraint(destination, nodes, rotationConstraintDef) {
    const { source: sourceIndex, weight } = rotationConstraintDef;
    const source = nodes[sourceIndex];
    const constraint = new VRMRotationConstraint(destination, source);
    if (weight != null) {
      constraint.weight = weight;
    }
    if (this.helperRoot) {
      const helper = new VRMNodeConstraintHelper(constraint);
      this.helperRoot.add(helper);
    }
    return constraint;
  }
};
_VRMNodeConstraintLoaderPlugin.EXTENSION_NAME = "VRMC_node_constraint";
var VRMNodeConstraintLoaderPlugin = _VRMNodeConstraintLoaderPlugin;

// ../three-vrm-springbone/lib/three-vrm-springbone.module.js
import * as THREE72 from "./three.js";
import * as THREE20 from "./three.js";
import * as THREE24 from "./three.js";
import * as THREE34 from "./three.js";
import * as THREE44 from "./three.js";
import * as THREE54 from "./three.js";
import * as THREE62 from "./three.js";
import * as THREE92 from "./three.js";
import * as THREE82 from "./three.js";
import * as THREE102 from "./three.js";
import * as THREE132 from "./three.js";
import * as THREE122 from "./three.js";
import * as THREE112 from "./three.js";
import * as THREE142 from "./three.js";
var __async7 = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
var VRMSpringBoneColliderShape = class {
};
var _v3A7 = new THREE20.Vector3();
var _v3B5 = new THREE20.Vector3();
var VRMSpringBoneColliderShapeCapsule = class extends VRMSpringBoneColliderShape {
  get type() {
    return "capsule";
  }
  constructor(params) {
    var _a, _b, _c, _d;
    super();
    this.offset = (_a = params == null ? void 0 : params.offset) != null ? _a : new THREE20.Vector3(0, 0, 0);
    this.tail = (_b = params == null ? void 0 : params.tail) != null ? _b : new THREE20.Vector3(0, 0, 0);
    this.radius = (_c = params == null ? void 0 : params.radius) != null ? _c : 0;
    this.inside = (_d = params == null ? void 0 : params.inside) != null ? _d : false;
  }
  calculateCollision(colliderMatrix, objectPosition, objectRadius, target) {
    _v3A7.setFromMatrixPosition(colliderMatrix);
    _v3B5.subVectors(this.tail, this.offset).applyMatrix4(colliderMatrix);
    _v3B5.sub(_v3A7);
    const lengthSqCapsule = _v3B5.lengthSq();
    target.copy(objectPosition).sub(_v3A7);
    const dot = _v3B5.dot(target);
    if (dot <= 0) {
    } else if (lengthSqCapsule <= dot) {
      target.sub(_v3B5);
    } else {
      _v3B5.multiplyScalar(dot / lengthSqCapsule);
      target.sub(_v3B5);
    }
    const length = target.length();
    const distance = this.inside ? this.radius - objectRadius - length : length - objectRadius - this.radius;
    if (distance < 0) {
      target.multiplyScalar(1 / length);
      if (this.inside) {
        target.negate();
      }
    }
    return distance;
  }
};
var _v3A23 = new THREE24.Vector3();
var _mat3A = new THREE24.Matrix3();
var VRMSpringBoneColliderShapePlane = class extends VRMSpringBoneColliderShape {
  get type() {
    return "plane";
  }
  constructor(params) {
    var _a, _b;
    super();
    this.offset = (_a = params == null ? void 0 : params.offset) != null ? _a : new THREE24.Vector3(0, 0, 0);
    this.normal = (_b = params == null ? void 0 : params.normal) != null ? _b : new THREE24.Vector3(0, 0, 1);
  }
  calculateCollision(colliderMatrix, objectPosition, objectRadius, target) {
    target.setFromMatrixPosition(colliderMatrix);
    target.negate().add(objectPosition);
    _mat3A.getNormalMatrix(colliderMatrix);
    _v3A23.copy(this.normal).applyNormalMatrix(_mat3A).normalize();
    const distance = target.dot(_v3A23) - objectRadius;
    target.copy(_v3A23);
    return distance;
  }
};
var _v3A33 = new THREE34.Vector3();
var VRMSpringBoneColliderShapeSphere = class extends VRMSpringBoneColliderShape {
  get type() {
    return "sphere";
  }
  constructor(params) {
    var _a, _b, _c;
    super();
    this.offset = (_a = params == null ? void 0 : params.offset) != null ? _a : new THREE34.Vector3(0, 0, 0);
    this.radius = (_b = params == null ? void 0 : params.radius) != null ? _b : 0;
    this.inside = (_c = params == null ? void 0 : params.inside) != null ? _c : false;
  }
  calculateCollision(colliderMatrix, objectPosition, objectRadius, target) {
    target.subVectors(objectPosition, _v3A33.setFromMatrixPosition(colliderMatrix));
    const length = target.length();
    const distance = this.inside ? this.radius - objectRadius - length : length - objectRadius - this.radius;
    if (distance < 0) {
      target.multiplyScalar(1 / length);
      if (this.inside) {
        target.negate();
      }
    }
    return distance;
  }
};
var _v3A43 = new THREE44.Vector3();
var ColliderShapeCapsuleBufferGeometry = class extends THREE44.BufferGeometry {
  constructor(shape) {
    super();
    this.worldScale = 1;
    this._currentRadius = 0;
    this._currentOffset = new THREE44.Vector3();
    this._currentTail = new THREE44.Vector3();
    this._shape = shape;
    this._attrPos = new THREE44.BufferAttribute(new Float32Array(396), 3);
    this.setAttribute("position", this._attrPos);
    this._attrIndex = new THREE44.BufferAttribute(new Uint16Array(264), 1);
    this.setIndex(this._attrIndex);
    this._buildIndex();
    this.update();
  }
  update() {
    let shouldUpdateGeometry = false;
    const radius = this._shape.radius / this.worldScale;
    if (this._currentRadius !== radius) {
      this._currentRadius = radius;
      shouldUpdateGeometry = true;
    }
    if (!this._currentOffset.equals(this._shape.offset)) {
      this._currentOffset.copy(this._shape.offset);
      shouldUpdateGeometry = true;
    }
    const tail = _v3A43.copy(this._shape.tail).divideScalar(this.worldScale);
    if (this._currentTail.distanceToSquared(tail) > 1e-10) {
      this._currentTail.copy(tail);
      shouldUpdateGeometry = true;
    }
    if (shouldUpdateGeometry) {
      this._buildPosition();
    }
  }
  _buildPosition() {
    _v3A43.copy(this._currentTail).sub(this._currentOffset);
    const l = _v3A43.length() / this._currentRadius;
    for (let i = 0; i <= 16; i++) {
      const t = i / 16 * Math.PI;
      this._attrPos.setXYZ(i, -Math.sin(t), -Math.cos(t), 0);
      this._attrPos.setXYZ(17 + i, l + Math.sin(t), Math.cos(t), 0);
      this._attrPos.setXYZ(34 + i, -Math.sin(t), 0, -Math.cos(t));
      this._attrPos.setXYZ(51 + i, l + Math.sin(t), 0, Math.cos(t));
    }
    for (let i = 0; i < 32; i++) {
      const t = i / 16 * Math.PI;
      this._attrPos.setXYZ(68 + i, 0, Math.sin(t), Math.cos(t));
      this._attrPos.setXYZ(100 + i, l, Math.sin(t), Math.cos(t));
    }
    const theta = Math.atan2(_v3A43.y, Math.sqrt(_v3A43.x * _v3A43.x + _v3A43.z * _v3A43.z));
    const phi = -Math.atan2(_v3A43.z, _v3A43.x);
    this.rotateZ(theta);
    this.rotateY(phi);
    this.scale(this._currentRadius, this._currentRadius, this._currentRadius);
    this.translate(this._currentOffset.x, this._currentOffset.y, this._currentOffset.z);
    this._attrPos.needsUpdate = true;
  }
  _buildIndex() {
    for (let i = 0; i < 34; i++) {
      const i1 = (i + 1) % 34;
      this._attrIndex.setXY(i * 2, i, i1);
      this._attrIndex.setXY(68 + i * 2, 34 + i, 34 + i1);
    }
    for (let i = 0; i < 32; i++) {
      const i1 = (i + 1) % 32;
      this._attrIndex.setXY(136 + i * 2, 68 + i, 68 + i1);
      this._attrIndex.setXY(200 + i * 2, 100 + i, 100 + i1);
    }
    this._attrIndex.needsUpdate = true;
  }
};
var ColliderShapePlaneBufferGeometry = class extends THREE54.BufferGeometry {
  constructor(shape) {
    super();
    this.worldScale = 1;
    this._currentOffset = new THREE54.Vector3();
    this._currentNormal = new THREE54.Vector3();
    this._shape = shape;
    this._attrPos = new THREE54.BufferAttribute(new Float32Array(6 * 3), 3);
    this.setAttribute("position", this._attrPos);
    this._attrIndex = new THREE54.BufferAttribute(new Uint16Array(10), 1);
    this.setIndex(this._attrIndex);
    this._buildIndex();
    this.update();
  }
  update() {
    let shouldUpdateGeometry = false;
    if (!this._currentOffset.equals(this._shape.offset)) {
      this._currentOffset.copy(this._shape.offset);
      shouldUpdateGeometry = true;
    }
    if (!this._currentNormal.equals(this._shape.normal)) {
      this._currentNormal.copy(this._shape.normal);
      shouldUpdateGeometry = true;
    }
    if (shouldUpdateGeometry) {
      this._buildPosition();
    }
  }
  _buildPosition() {
    this._attrPos.setXYZ(0, -0.5, -0.5, 0);
    this._attrPos.setXYZ(1, 0.5, -0.5, 0);
    this._attrPos.setXYZ(2, 0.5, 0.5, 0);
    this._attrPos.setXYZ(3, -0.5, 0.5, 0);
    this._attrPos.setXYZ(4, 0, 0, 0);
    this._attrPos.setXYZ(5, 0, 0, 0.25);
    this.translate(this._currentOffset.x, this._currentOffset.y, this._currentOffset.z);
    this.lookAt(this._currentNormal);
    this._attrPos.needsUpdate = true;
  }
  _buildIndex() {
    this._attrIndex.setXY(0, 0, 1);
    this._attrIndex.setXY(2, 1, 2);
    this._attrIndex.setXY(4, 2, 3);
    this._attrIndex.setXY(6, 3, 0);
    this._attrIndex.setXY(8, 4, 5);
    this._attrIndex.needsUpdate = true;
  }
};
var ColliderShapeSphereBufferGeometry = class extends THREE62.BufferGeometry {
  constructor(shape) {
    super();
    this.worldScale = 1;
    this._currentRadius = 0;
    this._currentOffset = new THREE62.Vector3();
    this._shape = shape;
    this._attrPos = new THREE62.BufferAttribute(new Float32Array(32 * 3 * 3), 3);
    this.setAttribute("position", this._attrPos);
    this._attrIndex = new THREE62.BufferAttribute(new Uint16Array(64 * 3), 1);
    this.setIndex(this._attrIndex);
    this._buildIndex();
    this.update();
  }
  update() {
    let shouldUpdateGeometry = false;
    const radius = this._shape.radius / this.worldScale;
    if (this._currentRadius !== radius) {
      this._currentRadius = radius;
      shouldUpdateGeometry = true;
    }
    if (!this._currentOffset.equals(this._shape.offset)) {
      this._currentOffset.copy(this._shape.offset);
      shouldUpdateGeometry = true;
    }
    if (shouldUpdateGeometry) {
      this._buildPosition();
    }
  }
  _buildPosition() {
    for (let i = 0; i < 32; i++) {
      const t = i / 16 * Math.PI;
      this._attrPos.setXYZ(i, Math.cos(t), Math.sin(t), 0);
      this._attrPos.setXYZ(32 + i, 0, Math.cos(t), Math.sin(t));
      this._attrPos.setXYZ(64 + i, Math.sin(t), 0, Math.cos(t));
    }
    this.scale(this._currentRadius, this._currentRadius, this._currentRadius);
    this.translate(this._currentOffset.x, this._currentOffset.y, this._currentOffset.z);
    this._attrPos.needsUpdate = true;
  }
  _buildIndex() {
    for (let i = 0; i < 32; i++) {
      const i1 = (i + 1) % 32;
      this._attrIndex.setXY(i * 2, i, i1);
      this._attrIndex.setXY(64 + i * 2, 32 + i, 32 + i1);
      this._attrIndex.setXY(128 + i * 2, 64 + i, 64 + i1);
    }
    this._attrIndex.needsUpdate = true;
  }
};
var _v3A52 = new THREE72.Vector3();
var VRMSpringBoneColliderHelper = class extends THREE72.Group {
  constructor(collider) {
    super();
    this.matrixAutoUpdate = false;
    this.collider = collider;
    if (this.collider.shape instanceof VRMSpringBoneColliderShapeSphere) {
      this._geometry = new ColliderShapeSphereBufferGeometry(this.collider.shape);
    } else if (this.collider.shape instanceof VRMSpringBoneColliderShapeCapsule) {
      this._geometry = new ColliderShapeCapsuleBufferGeometry(this.collider.shape);
    } else if (this.collider.shape instanceof VRMSpringBoneColliderShapePlane) {
      this._geometry = new ColliderShapePlaneBufferGeometry(this.collider.shape);
    } else {
      throw new Error("VRMSpringBoneColliderHelper: Unknown collider shape type detected");
    }
    const material = new THREE72.LineBasicMaterial({
      color: 16711935,
      depthTest: false,
      depthWrite: false
    });
    this._line = new THREE72.LineSegments(this._geometry, material);
    this.add(this._line);
  }
  dispose() {
    this._geometry.dispose();
  }
  updateMatrixWorld(force) {
    this.collider.updateWorldMatrix(true, false);
    this.matrix.copy(this.collider.matrixWorld);
    const matrixWorldElements = this.matrix.elements;
    this._geometry.worldScale = _v3A52.set(matrixWorldElements[0], matrixWorldElements[1], matrixWorldElements[2]).length();
    this._geometry.update();
    super.updateMatrixWorld(force);
  }
};
var SpringBoneBufferGeometry = class extends THREE82.BufferGeometry {
  constructor(springBone) {
    super();
    this.worldScale = 1;
    this._currentRadius = 0;
    this._currentTail = new THREE82.Vector3();
    this._springBone = springBone;
    this._attrPos = new THREE82.BufferAttribute(new Float32Array(294), 3);
    this.setAttribute("position", this._attrPos);
    this._attrIndex = new THREE82.BufferAttribute(new Uint16Array(194), 1);
    this.setIndex(this._attrIndex);
    this._buildIndex();
    this.update();
  }
  update() {
    let shouldUpdateGeometry = false;
    const radius = this._springBone.settings.hitRadius / this.worldScale;
    if (this._currentRadius !== radius) {
      this._currentRadius = radius;
      shouldUpdateGeometry = true;
    }
    if (!this._currentTail.equals(this._springBone.initialLocalChildPosition)) {
      this._currentTail.copy(this._springBone.initialLocalChildPosition);
      shouldUpdateGeometry = true;
    }
    if (shouldUpdateGeometry) {
      this._buildPosition();
    }
  }
  _buildPosition() {
    for (let i = 0; i < 32; i++) {
      const t = i / 16 * Math.PI;
      this._attrPos.setXYZ(i, Math.cos(t), Math.sin(t), 0);
      this._attrPos.setXYZ(32 + i, 0, Math.cos(t), Math.sin(t));
      this._attrPos.setXYZ(64 + i, Math.sin(t), 0, Math.cos(t));
    }
    this.scale(this._currentRadius, this._currentRadius, this._currentRadius);
    this.translate(this._currentTail.x, this._currentTail.y, this._currentTail.z);
    this._attrPos.setXYZ(96, 0, 0, 0);
    this._attrPos.setXYZ(97, this._currentTail.x, this._currentTail.y, this._currentTail.z);
    this._attrPos.needsUpdate = true;
  }
  _buildIndex() {
    for (let i = 0; i < 32; i++) {
      const i1 = (i + 1) % 32;
      this._attrIndex.setXY(i * 2, i, i1);
      this._attrIndex.setXY(64 + i * 2, 32 + i, 32 + i1);
      this._attrIndex.setXY(128 + i * 2, 64 + i, 64 + i1);
    }
    this._attrIndex.setXY(192, 96, 97);
    this._attrIndex.needsUpdate = true;
  }
};
var _v3A62 = new THREE92.Vector3();
var VRMSpringBoneJointHelper = class extends THREE92.Group {
  constructor(springBone) {
    super();
    this.matrixAutoUpdate = false;
    this.springBone = springBone;
    this._geometry = new SpringBoneBufferGeometry(this.springBone);
    const material = new THREE92.LineBasicMaterial({
      color: 16776960,
      depthTest: false,
      depthWrite: false
    });
    this._line = new THREE92.LineSegments(this._geometry, material);
    this.add(this._line);
  }
  dispose() {
    this._geometry.dispose();
  }
  updateMatrixWorld(force) {
    this.springBone.bone.updateWorldMatrix(true, false);
    this.matrix.copy(this.springBone.bone.matrixWorld);
    const matrixWorldElements = this.matrix.elements;
    this._geometry.worldScale = _v3A62.set(matrixWorldElements[0], matrixWorldElements[1], matrixWorldElements[2]).length();
    this._geometry.update();
    super.updateMatrixWorld(force);
  }
};
var VRMSpringBoneCollider = class extends THREE102.Object3D {
  constructor(shape) {
    super();
    this.colliderMatrix = new THREE102.Matrix4();
    this.shape = shape;
  }
  updateWorldMatrix(updateParents, updateChildren) {
    super.updateWorldMatrix(updateParents, updateChildren);
    updateColliderMatrix(this.colliderMatrix, this.matrixWorld, this.shape.offset);
  }
};
function updateColliderMatrix(colliderMatrix, matrixWorld, offset) {
  const me = matrixWorld.elements;
  colliderMatrix.copy(matrixWorld);
  if (offset) {
    colliderMatrix.elements[12] = me[0] * offset.x + me[4] * offset.y + me[8] * offset.z + me[12];
    colliderMatrix.elements[13] = me[1] * offset.x + me[5] * offset.y + me[9] * offset.z + me[13];
    colliderMatrix.elements[14] = me[2] * offset.x + me[6] * offset.y + me[10] * offset.z + me[14];
  }
}
var _matA = new THREE112.Matrix4();
function mat4InvertCompat(target) {
  if (target.invert) {
    target.invert();
  } else {
    target.getInverse(_matA.copy(target));
  }
  return target;
}
var Matrix4InverseCache = class {
  constructor(matrix) {
    this._inverseCache = new THREE122.Matrix4();
    this._shouldUpdateInverse = true;
    this.matrix = matrix;
    const handler = {
      set: (obj, prop, newVal) => {
        this._shouldUpdateInverse = true;
        obj[prop] = newVal;
        return true;
      }
    };
    this._originalElements = matrix.elements;
    matrix.elements = new Proxy(matrix.elements, handler);
  }
  /**
   * Inverse of given matrix.
   * Note that it will return its internal private instance.
   * Make sure copying this before mutate this.
   */
  get inverse() {
    if (this._shouldUpdateInverse) {
      mat4InvertCompat(this._inverseCache.copy(this.matrix));
      this._shouldUpdateInverse = false;
    }
    return this._inverseCache;
  }
  revert() {
    this.matrix.elements = this._originalElements;
  }
};
var IDENTITY_MATRIX4 = new THREE132.Matrix4();
var _v3A72 = new THREE132.Vector3();
var _v3B23 = new THREE132.Vector3();
var _worldSpacePosition = new THREE132.Vector3();
var _nextTail = new THREE132.Vector3();
var _matA2 = new THREE132.Matrix4();
var VRMSpringBoneJoint = class {
  /**
   * Create a new VRMSpringBone.
   *
   * @param bone An Object3D that will be attached to this bone
   * @param child An Object3D that will be used as a tail of this spring bone. It can be null when the spring bone is imported from VRM 0.0
   * @param settings Several parameters related to behavior of the spring bone
   * @param colliderGroups Collider groups that will be collided with this spring bone
   */
  constructor(bone, child, settings = {}, colliderGroups = []) {
    this._currentTail = new THREE132.Vector3();
    this._prevTail = new THREE132.Vector3();
    this._boneAxis = new THREE132.Vector3();
    this._worldSpaceBoneLength = 0;
    this._center = null;
    this._initialLocalMatrix = new THREE132.Matrix4();
    this._initialLocalRotation = new THREE132.Quaternion();
    this._initialLocalChildPosition = new THREE132.Vector3();
    var _a, _b, _c, _d, _e, _f;
    this.bone = bone;
    this.bone.matrixAutoUpdate = false;
    this.child = child;
    this.settings = {
      hitRadius: (_a = settings.hitRadius) != null ? _a : 0,
      stiffness: (_b = settings.stiffness) != null ? _b : 1,
      gravityPower: (_c = settings.gravityPower) != null ? _c : 0,
      gravityDir: (_e = (_d = settings.gravityDir) == null ? void 0 : _d.clone()) != null ? _e : new THREE132.Vector3(0, -1, 0),
      dragForce: (_f = settings.dragForce) != null ? _f : 0.4
    };
    this.colliderGroups = colliderGroups;
  }
  /**
   * Set of dependencies that need to be updated before this joint.
   */
  get dependencies() {
    const set = /* @__PURE__ */ new Set();
    const parent = this.bone.parent;
    if (parent) {
      set.add(parent);
    }
    for (let cg = 0; cg < this.colliderGroups.length; cg++) {
      for (let c = 0; c < this.colliderGroups[cg].colliders.length; c++) {
        set.add(this.colliderGroups[cg].colliders[c]);
      }
    }
    return set;
  }
  get center() {
    return this._center;
  }
  set center(center) {
    var _a;
    if ((_a = this._center) == null ? void 0 : _a.userData.inverseCacheProxy) {
      this._center.userData.inverseCacheProxy.revert();
      delete this._center.userData.inverseCacheProxy;
    }
    this._center = center;
    if (this._center) {
      if (!this._center.userData.inverseCacheProxy) {
        this._center.userData.inverseCacheProxy = new Matrix4InverseCache(this._center.matrixWorld);
      }
    }
  }
  get initialLocalChildPosition() {
    return this._initialLocalChildPosition;
  }
  /**
   * Returns the world matrix of its parent object.
   * Note that it returns a reference to the matrix. Don't mutate this directly!
   */
  get _parentMatrixWorld() {
    return this.bone.parent ? this.bone.parent.matrixWorld : IDENTITY_MATRIX4;
  }
  /**
   * Set the initial state of this spring bone.
   * You might want to call {@link VRMSpringBoneManager.setInitState} instead.
   */
  setInitState() {
    this._initialLocalMatrix.copy(this.bone.matrix);
    this._initialLocalRotation.copy(this.bone.quaternion);
    if (this.child) {
      this._initialLocalChildPosition.copy(this.child.position);
    } else {
      this._initialLocalChildPosition.copy(this.bone.position).normalize().multiplyScalar(0.07);
    }
    const matrixWorldToCenter = this._getMatrixWorldToCenter();
    this.bone.localToWorld(this._currentTail.copy(this._initialLocalChildPosition)).applyMatrix4(matrixWorldToCenter);
    this._prevTail.copy(this._currentTail);
    this._boneAxis.copy(this._initialLocalChildPosition).normalize();
  }
  /**
   * Reset the state of this bone.
   * You might want to call {@link VRMSpringBoneManager.reset} instead.
   */
  reset() {
    this.bone.quaternion.copy(this._initialLocalRotation);
    this.bone.updateMatrix();
    this.bone.matrixWorld.multiplyMatrices(this._parentMatrixWorld, this.bone.matrix);
    const matrixWorldToCenter = this._getMatrixWorldToCenter();
    this.bone.localToWorld(this._currentTail.copy(this._initialLocalChildPosition)).applyMatrix4(matrixWorldToCenter);
    this._prevTail.copy(this._currentTail);
  }
  /**
   * Update the state of this bone.
   * You might want to call {@link VRMSpringBoneManager.update} instead.
   *
   * @param delta deltaTime
   */
  update(delta) {
    if (delta <= 0) return;
    this._calcWorldSpaceBoneLength();
    const worldSpaceBoneAxis = _v3B23.copy(this._boneAxis).transformDirection(this._initialLocalMatrix).transformDirection(this._parentMatrixWorld);
    _nextTail.copy(this._currentTail).add(_v3A72.subVectors(this._currentTail, this._prevTail).multiplyScalar(1 - this.settings.dragForce)).applyMatrix4(this._getMatrixCenterToWorld()).addScaledVector(worldSpaceBoneAxis, this.settings.stiffness * delta).addScaledVector(this.settings.gravityDir, this.settings.gravityPower * delta);
    _worldSpacePosition.setFromMatrixPosition(this.bone.matrixWorld);
    _nextTail.sub(_worldSpacePosition).normalize().multiplyScalar(this._worldSpaceBoneLength).add(_worldSpacePosition);
    this._collision(_nextTail);
    this._prevTail.copy(this._currentTail);
    this._currentTail.copy(_nextTail).applyMatrix4(this._getMatrixWorldToCenter());
    const worldSpaceInitialMatrixInv = _matA2.multiplyMatrices(this._parentMatrixWorld, this._initialLocalMatrix).invert();
    this.bone.quaternion.setFromUnitVectors(this._boneAxis, _v3A72.copy(_nextTail).applyMatrix4(worldSpaceInitialMatrixInv).normalize()).premultiply(this._initialLocalRotation);
    this.bone.updateMatrix();
    this.bone.matrixWorld.multiplyMatrices(this._parentMatrixWorld, this.bone.matrix);
  }
  /**
   * Do collision math against every colliders attached to this bone.
   *
   * @param tail The tail you want to process
   */
  _collision(tail) {
    for (let cg = 0; cg < this.colliderGroups.length; cg++) {
      for (let c = 0; c < this.colliderGroups[cg].colliders.length; c++) {
        const collider = this.colliderGroups[cg].colliders[c];
        const dist = collider.shape.calculateCollision(collider.colliderMatrix, tail, this.settings.hitRadius, _v3A72);
        if (dist < 0) {
          tail.addScaledVector(_v3A72, -dist);
          tail.sub(_worldSpacePosition);
          const length = tail.length();
          tail.multiplyScalar(this._worldSpaceBoneLength / length).add(_worldSpacePosition);
        }
      }
    }
  }
  /**
   * Calculate the {@link _worldSpaceBoneLength}.
   * Intended to be used in {@link update}.
   */
  _calcWorldSpaceBoneLength() {
    _v3A72.setFromMatrixPosition(this.bone.matrixWorld);
    if (this.child) {
      _v3B23.setFromMatrixPosition(this.child.matrixWorld);
    } else {
      _v3B23.copy(this._initialLocalChildPosition);
      _v3B23.applyMatrix4(this.bone.matrixWorld);
    }
    this._worldSpaceBoneLength = _v3A72.sub(_v3B23).length();
  }
  /**
   * Create a matrix that converts center space into world space.
   */
  _getMatrixCenterToWorld() {
    return this._center ? this._center.matrixWorld : IDENTITY_MATRIX4;
  }
  /**
   * Create a matrix that converts world space into center space.
   */
  _getMatrixWorldToCenter() {
    return this._center ? this._center.userData.inverseCacheProxy.inverse : IDENTITY_MATRIX4;
  }
};
function traverseAncestorsFromRoot2(object, callback) {
  const ancestors = [];
  let head = object;
  while (head !== null) {
    ancestors.unshift(head);
    head = head.parent;
  }
  ancestors.forEach((ancestor) => {
    callback(ancestor);
  });
}
function traverseChildrenUntilConditionMet(object, callback) {
  object.children.forEach((child) => {
    const result = callback(child);
    if (!result) {
      traverseChildrenUntilConditionMet(child, callback);
    }
  });
}
function lowestCommonAncestor(objects) {
  var _a;
  const sharedAncestors = /* @__PURE__ */ new Map();
  for (const object of objects) {
    let current = object;
    do {
      const newValue = ((_a = sharedAncestors.get(current)) != null ? _a : 0) + 1;
      if (newValue === objects.size) {
        return current;
      }
      sharedAncestors.set(current, newValue);
      current = current.parent;
    } while (current !== null);
  }
  return null;
}
var VRMSpringBoneManager = class {
  constructor() {
    this._joints = /* @__PURE__ */ new Set();
    this._sortedJoints = [];
    this._hasWarnedCircularDependency = false;
    this._ancestors = [];
    this._objectSpringBonesMap = /* @__PURE__ */ new Map();
    this._isSortedJointsDirty = false;
    this._relevantChildrenUpdated = this._relevantChildrenUpdated.bind(this);
  }
  get joints() {
    return this._joints;
  }
  /**
   * @deprecated Use {@link joints} instead.
   */
  get springBones() {
    console.warn("VRMSpringBoneManager: springBones is deprecated. use joints instead.");
    return this._joints;
  }
  get colliderGroups() {
    const set = /* @__PURE__ */ new Set();
    this._joints.forEach((springBone) => {
      springBone.colliderGroups.forEach((colliderGroup) => {
        set.add(colliderGroup);
      });
    });
    return Array.from(set);
  }
  get colliders() {
    const set = /* @__PURE__ */ new Set();
    this.colliderGroups.forEach((colliderGroup) => {
      colliderGroup.colliders.forEach((collider) => {
        set.add(collider);
      });
    });
    return Array.from(set);
  }
  addJoint(joint) {
    this._joints.add(joint);
    let objectSet = this._objectSpringBonesMap.get(joint.bone);
    if (objectSet == null) {
      objectSet = /* @__PURE__ */ new Set();
      this._objectSpringBonesMap.set(joint.bone, objectSet);
    }
    objectSet.add(joint);
    this._isSortedJointsDirty = true;
  }
  /**
   * @deprecated Use {@link addJoint} instead.
   */
  addSpringBone(joint) {
    console.warn("VRMSpringBoneManager: addSpringBone() is deprecated. use addJoint() instead.");
    this.addJoint(joint);
  }
  deleteJoint(joint) {
    this._joints.delete(joint);
    const objectSet = this._objectSpringBonesMap.get(joint.bone);
    objectSet.delete(joint);
    this._isSortedJointsDirty = true;
  }
  /**
   * @deprecated Use {@link deleteJoint} instead.
   */
  deleteSpringBone(joint) {
    console.warn("VRMSpringBoneManager: deleteSpringBone() is deprecated. use deleteJoint() instead.");
    this.deleteJoint(joint);
  }
  setInitState() {
    this._sortJoints();
    for (let i = 0; i < this._sortedJoints.length; i++) {
      const springBone = this._sortedJoints[i];
      springBone.bone.updateMatrix();
      springBone.bone.updateWorldMatrix(false, false);
      springBone.setInitState();
    }
  }
  reset() {
    this._sortJoints();
    for (let i = 0; i < this._sortedJoints.length; i++) {
      const springBone = this._sortedJoints[i];
      springBone.bone.updateMatrix();
      springBone.bone.updateWorldMatrix(false, false);
      springBone.reset();
    }
  }
  update(delta) {
    this._sortJoints();
    for (let i = 0; i < this._ancestors.length; i++) {
      this._ancestors[i].updateWorldMatrix(i === 0, false);
    }
    for (let i = 0; i < this._sortedJoints.length; i++) {
      const springBone = this._sortedJoints[i];
      springBone.bone.updateMatrix();
      springBone.bone.updateWorldMatrix(false, false);
      springBone.update(delta);
      traverseChildrenUntilConditionMet(springBone.bone, this._relevantChildrenUpdated);
    }
  }
  /**
   * Sorts the joints ensuring they are updated in the correct order taking dependencies into account.
   *
   * This method updates {@link _sortedJoints} and {@link _ancestors}.
   * Make sure to call this before using them.
   */
  _sortJoints() {
    if (!this._isSortedJointsDirty) {
      return;
    }
    const springBoneOrder = [];
    const springBonesTried = /* @__PURE__ */ new Set();
    const springBonesDone = /* @__PURE__ */ new Set();
    const ancestors = /* @__PURE__ */ new Set();
    for (const springBone of this._joints) {
      this._insertJointSort(springBone, springBonesTried, springBonesDone, springBoneOrder, ancestors);
    }
    this._sortedJoints = springBoneOrder;
    const lca = lowestCommonAncestor(ancestors);
    this._ancestors = [];
    if (lca) {
      this._ancestors.push(lca);
      traverseChildrenUntilConditionMet(lca, (object) => {
        var _a, _b;
        if (((_b = (_a = this._objectSpringBonesMap.get(object)) == null ? void 0 : _a.size) != null ? _b : 0) > 0) {
          return true;
        }
        this._ancestors.push(object);
        return false;
      });
    }
    this._isSortedJointsDirty = false;
  }
  _insertJointSort(springBone, springBonesTried, springBonesDone, springBoneOrder, ancestors) {
    if (springBonesDone.has(springBone)) {
      return;
    }
    if (springBonesTried.has(springBone)) {
      if (!this._hasWarnedCircularDependency) {
        console.warn("VRMSpringBoneManager: Circular dependency detected");
        this._hasWarnedCircularDependency = true;
      }
      return;
    }
    springBonesTried.add(springBone);
    const depObjects = springBone.dependencies;
    for (const depObject of depObjects) {
      let encounteredSpringBone = false;
      let ancestor = null;
      traverseAncestorsFromRoot2(depObject, (depObjectAncestor) => {
        const objectSet = this._objectSpringBonesMap.get(depObjectAncestor);
        if (objectSet) {
          for (const depSpringBone of objectSet) {
            encounteredSpringBone = true;
            this._insertJointSort(depSpringBone, springBonesTried, springBonesDone, springBoneOrder, ancestors);
          }
        } else if (!encounteredSpringBone) {
          ancestor = depObjectAncestor;
        }
      });
      if (ancestor) {
        ancestors.add(ancestor);
      }
    }
    springBoneOrder.push(springBone);
    springBonesDone.add(springBone);
  }
  _relevantChildrenUpdated(object) {
    var _a, _b;
    if (((_b = (_a = this._objectSpringBonesMap.get(object)) == null ? void 0 : _a.size) != null ? _b : 0) > 0) {
      return true;
    }
    object.updateWorldMatrix(false, false);
    return false;
  }
};
var EXTENSION_NAME_EXTENDED_COLLIDER = "VRMC_springBone_extended_collider";
var POSSIBLE_SPEC_VERSIONS8 = /* @__PURE__ */ new Set(["1.0", "1.0-beta"]);
var POSSIBLE_SPEC_VERSIONS_EXTENDED_COLLIDERS = /* @__PURE__ */ new Set(["1.0"]);
var _VRMSpringBoneLoaderPlugin = class _VRMSpringBoneLoaderPlugin2 {
  get name() {
    return _VRMSpringBoneLoaderPlugin2.EXTENSION_NAME;
  }
  constructor(parser, options) {
    var _a;
    this.parser = parser;
    this.jointHelperRoot = options == null ? void 0 : options.jointHelperRoot;
    this.colliderHelperRoot = options == null ? void 0 : options.colliderHelperRoot;
    this.useExtendedColliders = (_a = options == null ? void 0 : options.useExtendedColliders) != null ? _a : true;
  }
  afterRoot(gltf) {
    return __async7(this, null, function* () {
      gltf.userData.vrmSpringBoneManager = yield this._import(gltf);
    });
  }
  /**
   * Import spring bones from a GLTF and return a {@link VRMSpringBoneManager}.
   * It might return `null` instead when it does not need to be created or something go wrong.
   *
   * @param gltf A parsed result of GLTF taken from GLTFLoader
   */
  _import(gltf) {
    return __async7(this, null, function* () {
      const v1Result = yield this._v1Import(gltf);
      if (v1Result != null) {
        return v1Result;
      }
      const v0Result = yield this._v0Import(gltf);
      if (v0Result != null) {
        return v0Result;
      }
      return null;
    });
  }
  _v1Import(gltf) {
    return __async7(this, null, function* () {
      var _a, _b, _c, _d, _e;
      const json = gltf.parser.json;
      const isSpringBoneUsed = ((_a = json.extensionsUsed) == null ? void 0 : _a.indexOf(_VRMSpringBoneLoaderPlugin2.EXTENSION_NAME)) !== -1;
      if (!isSpringBoneUsed) {
        return null;
      }
      const manager = new VRMSpringBoneManager();
      const threeNodes = yield gltf.parser.getDependencies("node");
      const extension = (_b = json.extensions) == null ? void 0 : _b[_VRMSpringBoneLoaderPlugin2.EXTENSION_NAME];
      if (!extension) {
        return null;
      }
      const specVersion = extension.specVersion;
      if (!POSSIBLE_SPEC_VERSIONS8.has(specVersion)) {
        console.warn(
          `VRMSpringBoneLoaderPlugin: Unknown ${_VRMSpringBoneLoaderPlugin2.EXTENSION_NAME} specVersion "${specVersion}"`
        );
        return null;
      }
      const colliders = (_c = extension.colliders) == null ? void 0 : _c.map((schemaCollider, iCollider) => {
        var _a2, _b2, _c2, _d2, _e2, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o;
        const node = threeNodes[schemaCollider.node];
        if (node == null) {
          console.warn(
            `VRMSpringBoneLoaderPlugin: The collider #${iCollider} attempted to reference a node #${schemaCollider.node} but not found. Skipping the collider`
          );
          return null;
        }
        const schemaShape = schemaCollider.shape;
        const schemaExCollider = (_a2 = schemaCollider.extensions) == null ? void 0 : _a2[EXTENSION_NAME_EXTENDED_COLLIDER];
        if (this.useExtendedColliders && schemaExCollider != null) {
          const specVersionExCollider = schemaExCollider.specVersion;
          if (!POSSIBLE_SPEC_VERSIONS_EXTENDED_COLLIDERS.has(specVersionExCollider)) {
            console.warn(
              `VRMSpringBoneLoaderPlugin: Unknown ${EXTENSION_NAME_EXTENDED_COLLIDER} specVersion "${specVersionExCollider}". Fallbacking to the ${_VRMSpringBoneLoaderPlugin2.EXTENSION_NAME} definition`
            );
          } else {
            const schemaExShape = schemaExCollider.shape;
            if (schemaExShape.sphere) {
              return this._importSphereCollider(node, {
                offset: new THREE142.Vector3().fromArray((_b2 = schemaExShape.sphere.offset) != null ? _b2 : [0, 0, 0]),
                radius: (_c2 = schemaExShape.sphere.radius) != null ? _c2 : 0,
                inside: (_d2 = schemaExShape.sphere.inside) != null ? _d2 : false
              });
            } else if (schemaExShape.capsule) {
              return this._importCapsuleCollider(node, {
                offset: new THREE142.Vector3().fromArray((_e2 = schemaExShape.capsule.offset) != null ? _e2 : [0, 0, 0]),
                radius: (_f = schemaExShape.capsule.radius) != null ? _f : 0,
                tail: new THREE142.Vector3().fromArray((_g = schemaExShape.capsule.tail) != null ? _g : [0, 0, 0]),
                inside: (_h = schemaExShape.capsule.inside) != null ? _h : false
              });
            } else if (schemaExShape.plane) {
              return this._importPlaneCollider(node, {
                offset: new THREE142.Vector3().fromArray((_i = schemaExShape.plane.offset) != null ? _i : [0, 0, 0]),
                normal: new THREE142.Vector3().fromArray((_j = schemaExShape.plane.normal) != null ? _j : [0, 0, 1])
              });
            }
          }
        }
        if (schemaShape.sphere) {
          return this._importSphereCollider(node, {
            offset: new THREE142.Vector3().fromArray((_k = schemaShape.sphere.offset) != null ? _k : [0, 0, 0]),
            radius: (_l = schemaShape.sphere.radius) != null ? _l : 0,
            inside: false
          });
        } else if (schemaShape.capsule) {
          return this._importCapsuleCollider(node, {
            offset: new THREE142.Vector3().fromArray((_m = schemaShape.capsule.offset) != null ? _m : [0, 0, 0]),
            radius: (_n = schemaShape.capsule.radius) != null ? _n : 0,
            tail: new THREE142.Vector3().fromArray((_o = schemaShape.capsule.tail) != null ? _o : [0, 0, 0]),
            inside: false
          });
        }
        console.warn(`VRMSpringBoneLoaderPlugin: The collider #${iCollider} has no valid shape. Skipping the collider`);
      });
      const colliderGroups = (_d = extension.colliderGroups) == null ? void 0 : _d.map(
        (schemaColliderGroup, iColliderGroup) => {
          var _a2;
          const cols = ((_a2 = schemaColliderGroup.colliders) != null ? _a2 : []).map((iCollider) => {
            const col = colliders == null ? void 0 : colliders[iCollider];
            if (col == null) {
              console.warn(
                `VRMSpringBoneLoaderPlugin: The collider group #${iColliderGroup} attempted to reference a collider #${iCollider} but not found. Skipping the collider`
              );
              return null;
            }
            return col;
          }).filter((col) => col != null);
          return {
            colliders: cols,
            name: schemaColliderGroup.name
          };
        }
      );
      (_e = extension.springs) == null ? void 0 : _e.forEach((schemaSpring, iSpring) => {
        var _a2;
        const schemaJoints = schemaSpring.joints;
        if (schemaJoints == null) {
          console.warn(`VRMSpringBoneLoaderPlugin: The spring #${iSpring} has no joints. Skipping the spring`);
          return;
        }
        const colliderGroupsForSpring = (_a2 = schemaSpring.colliderGroups) == null ? void 0 : _a2.map((iColliderGroup) => {
          const group = colliderGroups == null ? void 0 : colliderGroups[iColliderGroup];
          if (group == null) {
            console.warn(
              `VRMSpringBoneLoaderPlugin: The spring #${iSpring} attempted to reference a collider group #${iColliderGroup} but not found. Skipping the collider group`
            );
            return null;
          }
          return group;
        }).filter((group) => group != null);
        const center = schemaSpring.center != null ? threeNodes[schemaSpring.center] : void 0;
        let prevSchemaJoint;
        schemaJoints.forEach((schemaJoint) => {
          if (prevSchemaJoint) {
            const nodeIndex = prevSchemaJoint.node;
            const node = threeNodes[nodeIndex];
            const childIndex = schemaJoint.node;
            const child = threeNodes[childIndex];
            const setting = {
              hitRadius: prevSchemaJoint.hitRadius,
              dragForce: prevSchemaJoint.dragForce,
              gravityPower: prevSchemaJoint.gravityPower,
              stiffness: prevSchemaJoint.stiffness,
              gravityDir: prevSchemaJoint.gravityDir != null ? new THREE142.Vector3().fromArray(prevSchemaJoint.gravityDir) : void 0
            };
            const joint = this._importJoint(node, child, setting, colliderGroupsForSpring);
            if (center) {
              joint.center = center;
            }
            manager.addJoint(joint);
          }
          prevSchemaJoint = schemaJoint;
        });
      });
      manager.setInitState();
      return manager;
    });
  }
  _v0Import(gltf) {
    return __async7(this, null, function* () {
      var _a, _b, _c;
      const json = gltf.parser.json;
      const isVRMUsed = ((_a = json.extensionsUsed) == null ? void 0 : _a.indexOf("VRM")) !== -1;
      if (!isVRMUsed) {
        return null;
      }
      const extension = (_b = json.extensions) == null ? void 0 : _b["VRM"];
      const schemaSecondaryAnimation = extension == null ? void 0 : extension.secondaryAnimation;
      if (!schemaSecondaryAnimation) {
        return null;
      }
      const schemaBoneGroups = schemaSecondaryAnimation == null ? void 0 : schemaSecondaryAnimation.boneGroups;
      if (!schemaBoneGroups) {
        return null;
      }
      const manager = new VRMSpringBoneManager();
      const threeNodes = yield gltf.parser.getDependencies("node");
      const colliderGroups = (_c = schemaSecondaryAnimation.colliderGroups) == null ? void 0 : _c.map(
        (schemaColliderGroup, iColliderGroup) => {
          var _a2;
          const node = threeNodes[schemaColliderGroup.node];
          if (node == null) {
            console.warn(
              `VRMSpringBoneLoaderPlugin: The collider group #${iColliderGroup} attempted to reference a node #${schemaColliderGroup.node} but not found. Skipping the collider group`
            );
            return null;
          }
          const colliders = ((_a2 = schemaColliderGroup.colliders) != null ? _a2 : []).map((schemaCollider, iCollider) => {
            var _a3, _b2, _c2;
            const offset = new THREE142.Vector3(0, 0, 0);
            if (schemaCollider.offset) {
              offset.set(
                (_a3 = schemaCollider.offset.x) != null ? _a3 : 0,
                (_b2 = schemaCollider.offset.y) != null ? _b2 : 0,
                schemaCollider.offset.z ? -schemaCollider.offset.z : 0
                // z is opposite in VRM0.0
              );
            }
            return this._importSphereCollider(node, {
              offset,
              radius: (_c2 = schemaCollider.radius) != null ? _c2 : 0,
              inside: false
            });
          });
          return { colliders };
        }
      );
      schemaBoneGroups == null ? void 0 : schemaBoneGroups.forEach((schemaBoneGroup, iBoneGroup) => {
        const rootIndices = schemaBoneGroup.bones;
        if (!rootIndices) {
          return;
        }
        rootIndices.forEach((rootIndex) => {
          var _a2, _b2, _c2, _d;
          const root = threeNodes[rootIndex];
          if (root == null) {
            console.warn(
              `VRMSpringBoneLoaderPlugin: The spring bone group #${iBoneGroup} attempted to reference a node #${rootIndex} but not found. Skipping the node`
            );
            return;
          }
          const gravityDir = new THREE142.Vector3();
          if (schemaBoneGroup.gravityDir) {
            gravityDir.set(
              (_a2 = schemaBoneGroup.gravityDir.x) != null ? _a2 : 0,
              (_b2 = schemaBoneGroup.gravityDir.y) != null ? _b2 : 0,
              (_c2 = schemaBoneGroup.gravityDir.z) != null ? _c2 : 0
            );
          } else {
            gravityDir.set(0, -1, 0);
          }
          const center = schemaBoneGroup.center != null ? threeNodes[schemaBoneGroup.center] : void 0;
          const setting = {
            hitRadius: schemaBoneGroup.hitRadius,
            dragForce: schemaBoneGroup.dragForce,
            gravityPower: schemaBoneGroup.gravityPower,
            stiffness: schemaBoneGroup.stiffiness,
            gravityDir
          };
          const colliderGroupsForSpring = (_d = schemaBoneGroup.colliderGroups) == null ? void 0 : _d.map((iColliderGroup) => {
            const group = colliderGroups == null ? void 0 : colliderGroups[iColliderGroup];
            if (group == null) {
              console.warn(
                `VRMSpringBoneLoaderPlugin: The spring #${iBoneGroup} attempted to reference a collider group #${iColliderGroup} but not found. Skipping the collider group`
              );
              return null;
            }
            return group;
          }).filter((group) => group != null);
          root.traverse((node) => {
            var _a3;
            const child = (_a3 = node.children[0]) != null ? _a3 : null;
            const joint = this._importJoint(node, child, setting, colliderGroupsForSpring);
            if (center) {
              joint.center = center;
            }
            manager.addJoint(joint);
          });
        });
      });
      gltf.scene.updateMatrixWorld();
      manager.setInitState();
      return manager;
    });
  }
  _importJoint(node, child, setting, colliderGroupsForSpring) {
    const springBone = new VRMSpringBoneJoint(node, child, setting, colliderGroupsForSpring);
    if (this.jointHelperRoot) {
      const helper = new VRMSpringBoneJointHelper(springBone);
      this.jointHelperRoot.add(helper);
      helper.renderOrder = this.jointHelperRoot.renderOrder;
    }
    return springBone;
  }
  _importSphereCollider(destination, params) {
    const shape = new VRMSpringBoneColliderShapeSphere(params);
    const collider = new VRMSpringBoneCollider(shape);
    destination.add(collider);
    if (this.colliderHelperRoot) {
      const helper = new VRMSpringBoneColliderHelper(collider);
      this.colliderHelperRoot.add(helper);
      helper.renderOrder = this.colliderHelperRoot.renderOrder;
    }
    return collider;
  }
  _importCapsuleCollider(destination, params) {
    const shape = new VRMSpringBoneColliderShapeCapsule(params);
    const collider = new VRMSpringBoneCollider(shape);
    destination.add(collider);
    if (this.colliderHelperRoot) {
      const helper = new VRMSpringBoneColliderHelper(collider);
      this.colliderHelperRoot.add(helper);
      helper.renderOrder = this.colliderHelperRoot.renderOrder;
    }
    return collider;
  }
  _importPlaneCollider(destination, params) {
    const shape = new VRMSpringBoneColliderShapePlane(params);
    const collider = new VRMSpringBoneCollider(shape);
    destination.add(collider);
    if (this.colliderHelperRoot) {
      const helper = new VRMSpringBoneColliderHelper(collider);
      this.colliderHelperRoot.add(helper);
      helper.renderOrder = this.colliderHelperRoot.renderOrder;
    }
    return collider;
  }
};
_VRMSpringBoneLoaderPlugin.EXTENSION_NAME = "VRMC_springBone";
var VRMSpringBoneLoaderPlugin = _VRMSpringBoneLoaderPlugin;

// src/VRMLoaderPlugin.ts
var VRMLoaderPlugin = class {
  get name() {
    return "VRMLoaderPlugin";
  }
  constructor(parser, options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    this.parser = parser;
    const helperRoot = options == null ? void 0 : options.helperRoot;
    const autoUpdateHumanBones = options == null ? void 0 : options.autoUpdateHumanBones;
    this.expressionPlugin = (_a = options == null ? void 0 : options.expressionPlugin) != null ? _a : new VRMExpressionLoaderPlugin(parser);
    this.firstPersonPlugin = (_b = options == null ? void 0 : options.firstPersonPlugin) != null ? _b : new VRMFirstPersonLoaderPlugin(parser);
    this.humanoidPlugin = (_c = options == null ? void 0 : options.humanoidPlugin) != null ? _c : new VRMHumanoidLoaderPlugin(parser, {
      helperRoot,
      autoUpdateHumanBones
    });
    this.lookAtPlugin = (_d = options == null ? void 0 : options.lookAtPlugin) != null ? _d : new VRMLookAtLoaderPlugin(parser, { helperRoot });
    this.metaPlugin = (_e = options == null ? void 0 : options.metaPlugin) != null ? _e : new VRMMetaLoaderPlugin(parser);
    this.mtoonMaterialPlugin = (_f = options == null ? void 0 : options.mtoonMaterialPlugin) != null ? _f : new MToonMaterialLoaderPlugin(parser);
    this.materialsHDREmissiveMultiplierPlugin = (_g = options == null ? void 0 : options.materialsHDREmissiveMultiplierPlugin) != null ? _g : new VRMMaterialsHDREmissiveMultiplierLoaderPlugin(parser);
    this.materialsV0CompatPlugin = (_h = options == null ? void 0 : options.materialsV0CompatPlugin) != null ? _h : new VRMMaterialsV0CompatPlugin(parser);
    this.springBonePlugin = (_i = options == null ? void 0 : options.springBonePlugin) != null ? _i : new VRMSpringBoneLoaderPlugin(parser, {
      colliderHelperRoot: helperRoot,
      jointHelperRoot: helperRoot
    });
    this.nodeConstraintPlugin = (_j = options == null ? void 0 : options.nodeConstraintPlugin) != null ? _j : new VRMNodeConstraintLoaderPlugin(parser, { helperRoot });
  }
  beforeRoot() {
    return __async(this, null, function* () {
      yield this.materialsV0CompatPlugin.beforeRoot();
      yield this.mtoonMaterialPlugin.beforeRoot();
    });
  }
  loadMesh(meshIndex) {
    return __async(this, null, function* () {
      return yield this.mtoonMaterialPlugin.loadMesh(meshIndex);
    });
  }
  getMaterialType(materialIndex) {
    const mtoonType = this.mtoonMaterialPlugin.getMaterialType(materialIndex);
    if (mtoonType != null) {
      return mtoonType;
    }
    return null;
  }
  extendMaterialParams(materialIndex, materialParams) {
    return __async(this, null, function* () {
      yield this.materialsHDREmissiveMultiplierPlugin.extendMaterialParams(materialIndex, materialParams);
      yield this.mtoonMaterialPlugin.extendMaterialParams(materialIndex, materialParams);
    });
  }
  afterRoot(gltf) {
    return __async(this, null, function* () {
      yield this.metaPlugin.afterRoot(gltf);
      yield this.humanoidPlugin.afterRoot(gltf);
      yield this.expressionPlugin.afterRoot(gltf);
      yield this.lookAtPlugin.afterRoot(gltf);
      yield this.firstPersonPlugin.afterRoot(gltf);
      yield this.springBonePlugin.afterRoot(gltf);
      yield this.nodeConstraintPlugin.afterRoot(gltf);
      yield this.mtoonMaterialPlugin.afterRoot(gltf);
      const meta = gltf.userData.vrmMeta;
      const humanoid = gltf.userData.vrmHumanoid;
      if (meta && humanoid) {
        const vrm = new VRM({
          scene: gltf.scene,
          expressionManager: gltf.userData.vrmExpressionManager,
          firstPerson: gltf.userData.vrmFirstPerson,
          humanoid,
          lookAt: gltf.userData.vrmLookAt,
          meta,
          materials: gltf.userData.vrmMToonMaterials,
          springBoneManager: gltf.userData.vrmSpringBoneManager,
          nodeConstraintManager: gltf.userData.vrmNodeConstraintManager
        });
        gltf.userData.vrm = vrm;
      }
    });
  }
};

// src/VRMUtils/combineMorphs.ts
import * as THREE21 from "./three.js";
function collectMeshes(scene) {
  const meshes = /* @__PURE__ */ new Set();
  scene.traverse((obj) => {
    if (!obj.isMesh) {
      return;
    }
    const mesh = obj;
    meshes.add(mesh);
  });
  return meshes;
}
function combineMorph(positionAttributes, binds, morphTargetsRelative) {
  if (binds.size === 1) {
    const bind = binds.values().next().value;
    if (bind.weight === 1) {
      return positionAttributes[bind.index];
    }
  }
  const newArray = new Float32Array(positionAttributes[0].count * 3);
  let weightSum = 0;
  if (morphTargetsRelative) {
    weightSum = 1;
  } else {
    for (const bind of binds) {
      weightSum += bind.weight;
    }
  }
  for (const bind of binds) {
    const src = positionAttributes[bind.index];
    const weight = bind.weight / weightSum;
    for (let i = 0; i < src.count; i++) {
      newArray[i * 3 + 0] += src.getX(i) * weight;
      newArray[i * 3 + 1] += src.getY(i) * weight;
      newArray[i * 3 + 2] += src.getZ(i) * weight;
    }
  }
  const newAttribute = new THREE21.BufferAttribute(newArray, 3);
  return newAttribute;
}
function combineMorphs(vrm) {
  var _a;
  const meshes = collectMeshes(vrm.scene);
  const meshNameBindSetMapMap = /* @__PURE__ */ new Map();
  const expressionMap = (_a = vrm.expressionManager) == null ? void 0 : _a.expressionMap;
  if (expressionMap != null) {
    for (const [expressionName, expression] of Object.entries(expressionMap)) {
      const bindsToDeleteSet = /* @__PURE__ */ new Set();
      for (const bind of expression.binds) {
        if (bind instanceof VRMExpressionMorphTargetBind) {
          if (bind.weight !== 0) {
            for (const mesh of bind.primitives) {
              let nameBindSetMap = meshNameBindSetMapMap.get(mesh);
              if (nameBindSetMap == null) {
                nameBindSetMap = /* @__PURE__ */ new Map();
                meshNameBindSetMapMap.set(mesh, nameBindSetMap);
              }
              let bindSet = nameBindSetMap.get(expressionName);
              if (bindSet == null) {
                bindSet = /* @__PURE__ */ new Set();
                nameBindSetMap.set(expressionName, bindSet);
              }
              bindSet.add(bind);
            }
          }
          bindsToDeleteSet.add(bind);
        }
      }
      for (const bind of bindsToDeleteSet) {
        expression.deleteBind(bind);
      }
    }
  }
  for (const mesh of meshes) {
    const nameBindSetMap = meshNameBindSetMapMap.get(mesh);
    if (nameBindSetMap == null) {
      continue;
    }
    const originalMorphAttributes = mesh.geometry.morphAttributes;
    mesh.geometry.morphAttributes = {};
    const geometry = mesh.geometry.clone();
    mesh.geometry = geometry;
    const morphTargetsRelative = geometry.morphTargetsRelative;
    const hasPMorph = originalMorphAttributes.position != null;
    const hasNMorph = originalMorphAttributes.normal != null;
    const morphAttributes = {};
    const morphTargetDictionary = {};
    const morphTargetInfluences = [];
    if (hasPMorph || hasNMorph) {
      if (hasPMorph) {
        morphAttributes.position = [];
      }
      if (hasNMorph) {
        morphAttributes.normal = [];
      }
      let i = 0;
      for (const [name, bindSet] of nameBindSetMap) {
        if (hasPMorph) {
          morphAttributes.position[i] = combineMorph(originalMorphAttributes.position, bindSet, morphTargetsRelative);
        }
        if (hasNMorph) {
          morphAttributes.normal[i] = combineMorph(originalMorphAttributes.normal, bindSet, morphTargetsRelative);
        }
        expressionMap == null ? void 0 : expressionMap[name].addBind(
          new VRMExpressionMorphTargetBind({
            index: i,
            weight: 1,
            primitives: [mesh]
          })
        );
        morphTargetDictionary[name] = i;
        morphTargetInfluences.push(0);
        i++;
      }
    }
    geometry.morphAttributes = morphAttributes;
    mesh.morphTargetDictionary = morphTargetDictionary;
    mesh.morphTargetInfluences = morphTargetInfluences;
  }
}

// src/VRMUtils/combineSkeletons.ts
import * as THREE27 from "./three.js";

// src/utils/attributeGetComponentCompat.ts
import * as THREE25 from "./three.js";
function attributeGetComponentCompat(attribute, index, component) {
  if (attribute.getComponent) {
    return attribute.getComponent(index, component);
  } else {
    let value = attribute.array[index * attribute.itemSize + component];
    if (attribute.normalized) {
      value = THREE25.MathUtils.denormalize(value, attribute.array);
    }
    return value;
  }
}

// src/utils/attributeSetComponentCompat.ts
import * as THREE26 from "./three.js";
function attributeSetComponentCompat(attribute, index, component, value) {
  if (attribute.setComponent) {
    attribute.setComponent(index, component, value);
  } else {
    if (attribute.normalized) {
      value = THREE26.MathUtils.normalize(value, attribute.array);
    }
    attribute.array[index * attribute.itemSize + component] = value;
  }
}

// src/VRMUtils/combineSkeletons.ts
function combineSkeletons(root) {
  var _a;
  const skinnedMeshes = collectSkinnedMeshes(root);
  const geometries = /* @__PURE__ */ new Set();
  for (const mesh of skinnedMeshes) {
    if (geometries.has(mesh.geometry)) {
      mesh.geometry = shallowCloneBufferGeometry(mesh.geometry);
    }
    geometries.add(mesh.geometry);
  }
  const attributeUsedIndexSetMap = /* @__PURE__ */ new Map();
  for (const geometry of geometries) {
    const skinIndexAttr = geometry.getAttribute("skinIndex");
    const skinIndexMap = (_a = attributeUsedIndexSetMap.get(skinIndexAttr)) != null ? _a : /* @__PURE__ */ new Map();
    attributeUsedIndexSetMap.set(skinIndexAttr, skinIndexMap);
    const skinWeightAttr = geometry.getAttribute("skinWeight");
    const usedIndicesSet = listUsedIndices(skinIndexAttr, skinWeightAttr);
    skinIndexMap.set(skinWeightAttr, usedIndicesSet);
  }
  const meshBoneInverseMapMap = /* @__PURE__ */ new Map();
  for (const mesh of skinnedMeshes) {
    const boneInverseMap = listUsedBones(mesh, attributeUsedIndexSetMap);
    meshBoneInverseMapMap.set(mesh, boneInverseMap);
  }
  const groups = [];
  for (const [mesh, boneInverseMap] of meshBoneInverseMapMap) {
    let foundMergeableGroup = false;
    for (const candidate of groups) {
      const isMergeable = boneInverseMapIsMergeable(boneInverseMap, candidate.boneInverseMap);
      if (isMergeable) {
        foundMergeableGroup = true;
        candidate.meshes.add(mesh);
        for (const [bone, boneInverse] of boneInverseMap) {
          candidate.boneInverseMap.set(bone, boneInverse);
        }
        break;
      }
    }
    if (!foundMergeableGroup) {
      groups.push({ boneInverseMap, meshes: /* @__PURE__ */ new Set([mesh]) });
    }
  }
  const cache = /* @__PURE__ */ new Map();
  const skinIndexDispatcher = new ObjectIndexDispatcher();
  const skeletonDispatcher = new ObjectIndexDispatcher();
  const boneDispatcher = new ObjectIndexDispatcher();
  for (const group of groups) {
    const { boneInverseMap, meshes } = group;
    const newBones = Array.from(boneInverseMap.keys());
    const newBoneInverses = Array.from(boneInverseMap.values());
    const newSkeleton = new THREE27.Skeleton(newBones, newBoneInverses);
    const skeletonKey = skeletonDispatcher.getOrCreate(newSkeleton);
    for (const mesh of meshes) {
      const skinIndexAttr = mesh.geometry.getAttribute("skinIndex");
      const skinIndexKey = skinIndexDispatcher.getOrCreate(skinIndexAttr);
      const bones = mesh.skeleton.bones;
      const bonesKey = bones.map((bone) => boneDispatcher.getOrCreate(bone)).join(",");
      const key = `${skinIndexKey};${skeletonKey};${bonesKey}`;
      let newSkinIndexAttr = cache.get(key);
      if (newSkinIndexAttr == null) {
        newSkinIndexAttr = skinIndexAttr.clone();
        remapSkinIndexAttribute(newSkinIndexAttr, bones, newBones);
        cache.set(key, newSkinIndexAttr);
      }
      mesh.geometry.setAttribute("skinIndex", newSkinIndexAttr);
    }
    for (const mesh of meshes) {
      mesh.bind(newSkeleton, new THREE27.Matrix4());
    }
  }
}
function collectSkinnedMeshes(scene) {
  const skinnedMeshes = /* @__PURE__ */ new Set();
  scene.traverse((obj) => {
    if (!obj.isSkinnedMesh) {
      return;
    }
    const skinnedMesh = obj;
    skinnedMeshes.add(skinnedMesh);
  });
  return skinnedMeshes;
}
function listUsedIndices(skinIndexAttr, skinWeightAttr) {
  const usedIndices = /* @__PURE__ */ new Set();
  for (let i = 0; i < skinIndexAttr.count; i++) {
    for (let j = 0; j < skinIndexAttr.itemSize; j++) {
      const index = attributeGetComponentCompat(skinIndexAttr, i, j);
      const weight = attributeGetComponentCompat(skinWeightAttr, i, j);
      if (weight !== 0) {
        usedIndices.add(index);
      }
    }
  }
  return usedIndices;
}
function listUsedBones(mesh, attributeUsedIndexSetMap) {
  const boneInverseMap = /* @__PURE__ */ new Map();
  const skeleton = mesh.skeleton;
  const geometry = mesh.geometry;
  const skinIndexAttr = geometry.getAttribute("skinIndex");
  const skinWeightAttr = geometry.getAttribute("skinWeight");
  const skinIndexMap = attributeUsedIndexSetMap.get(skinIndexAttr);
  const usedIndicesSet = skinIndexMap == null ? void 0 : skinIndexMap.get(skinWeightAttr);
  if (!usedIndicesSet) {
    throw new Error(
      "Unreachable. attributeUsedIndexSetMap does not know the skin index attribute or the skin weight attribute."
    );
  }
  for (const index of usedIndicesSet) {
    boneInverseMap.set(skeleton.bones[index], skeleton.boneInverses[index]);
  }
  return boneInverseMap;
}
function boneInverseMapIsMergeable(toCheck, candidate) {
  for (const [bone, boneInverse] of toCheck.entries()) {
    const candidateBoneInverse = candidate.get(bone);
    if (candidateBoneInverse != null) {
      if (!matrixEquals(boneInverse, candidateBoneInverse)) {
        return false;
      }
    }
  }
  return true;
}
function remapSkinIndexAttribute(attribute, oldBones, newBones) {
  const boneOldIndexMap = /* @__PURE__ */ new Map();
  for (const bone of oldBones) {
    boneOldIndexMap.set(bone, boneOldIndexMap.size);
  }
  const oldToNew = /* @__PURE__ */ new Map();
  for (const [i, bone] of newBones.entries()) {
    const oldIndex = boneOldIndexMap.get(bone);
    oldToNew.set(oldIndex, i);
  }
  for (let i = 0; i < attribute.count; i++) {
    for (let j = 0; j < attribute.itemSize; j++) {
      const oldIndex = attributeGetComponentCompat(attribute, i, j);
      const newIndex = oldToNew.get(oldIndex);
      attributeSetComponentCompat(attribute, i, j, newIndex);
    }
  }
  attribute.needsUpdate = true;
}
function matrixEquals(a, b, tolerance) {
  tolerance = tolerance || 1e-4;
  if (a.elements.length != b.elements.length) {
    return false;
  }
  for (let i = 0, il = a.elements.length; i < il; i++) {
    const delta = Math.abs(a.elements[i] - b.elements[i]);
    if (delta > tolerance) {
      return false;
    }
  }
  return true;
}
var ObjectIndexDispatcher = class {
  constructor() {
    this._objectIndexMap = /* @__PURE__ */ new Map();
    this._index = 0;
  }
  get(obj) {
    return this._objectIndexMap.get(obj);
  }
  getOrCreate(obj) {
    let index = this._objectIndexMap.get(obj);
    if (index == null) {
      index = this._index;
      this._objectIndexMap.set(obj, index);
      this._index++;
    }
    return index;
  }
};
function shallowCloneBufferGeometry(geometry) {
  var _a, _b, _c, _d;
  const clone = new THREE27.BufferGeometry();
  clone.name = geometry.name;
  clone.setIndex(geometry.index);
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    clone.setAttribute(name, attribute);
  }
  for (const [key, morphAttributes] of Object.entries(geometry.morphAttributes)) {
    const attributeName = key;
    clone.morphAttributes[attributeName] = morphAttributes.concat();
  }
  clone.morphTargetsRelative = geometry.morphTargetsRelative;
  clone.groups = [];
  for (const group of geometry.groups) {
    clone.addGroup(group.start, group.count, group.materialIndex);
  }
  clone.boundingSphere = (_b = (_a = geometry.boundingSphere) == null ? void 0 : _a.clone()) != null ? _b : null;
  clone.boundingBox = (_d = (_c = geometry.boundingBox) == null ? void 0 : _c.clone()) != null ? _d : null;
  clone.drawRange.start = geometry.drawRange.start;
  clone.drawRange.count = geometry.drawRange.count;
  clone.userData = geometry.userData;
  return clone;
}

// src/VRMUtils/deepDispose.ts
function disposeMaterial(material) {
  Object.values(material).forEach((value) => {
    if (value == null ? void 0 : value.isTexture) {
      const texture = value;
      texture.dispose();
    }
  });
  if (material.isShaderMaterial) {
    const uniforms = material.uniforms;
    if (uniforms) {
      Object.values(uniforms).forEach((uniform) => {
        const value = uniform.value;
        if (value == null ? void 0 : value.isTexture) {
          const texture = value;
          texture.dispose();
        }
      });
    }
  }
  material.dispose();
}
function dispose(object3D) {
  const geometry = object3D.geometry;
  if (geometry) {
    geometry.dispose();
  }
  const skeleton = object3D.skeleton;
  if (skeleton) {
    skeleton.dispose();
  }
  const material = object3D.material;
  if (material) {
    if (Array.isArray(material)) {
      material.forEach((material2) => disposeMaterial(material2));
    } else if (material) {
      disposeMaterial(material);
    }
  }
}
function deepDispose(object3D) {
  object3D.traverse(dispose);
}

// src/VRMUtils/removeUnnecessaryJoints.ts
import * as THREE28 from "./three.js";
function removeUnnecessaryJoints(root, options) {
  var _a, _b;
  console.warn(
    "VRMUtils.removeUnnecessaryJoints: removeUnnecessaryJoints is deprecated. Use combineSkeletons instead. combineSkeletons contributes more to the performance improvement. This function will be removed in the next major version."
  );
  const experimentalSameBoneCounts = (_a = options == null ? void 0 : options.experimentalSameBoneCounts) != null ? _a : false;
  const skinnedMeshes = [];
  root.traverse((obj) => {
    if (obj.type !== "SkinnedMesh") {
      return;
    }
    skinnedMeshes.push(obj);
  });
  const attributeToBoneIndexMapMap = /* @__PURE__ */ new Map();
  let maxBones = 0;
  for (const mesh of skinnedMeshes) {
    const geometry = mesh.geometry;
    const attribute = geometry.getAttribute("skinIndex");
    if (attributeToBoneIndexMapMap.has(attribute)) {
      continue;
    }
    const oldToNew = /* @__PURE__ */ new Map();
    const newToOld = /* @__PURE__ */ new Map();
    for (let i = 0; i < attribute.count; i++) {
      for (let j = 0; j < attribute.itemSize; j++) {
        const oldIndex = attributeGetComponentCompat(attribute, i, j);
        let newIndex = oldToNew.get(oldIndex);
        if (newIndex == null) {
          newIndex = oldToNew.size;
          oldToNew.set(oldIndex, newIndex);
          newToOld.set(newIndex, oldIndex);
        }
        attributeSetComponentCompat(attribute, i, j, newIndex);
      }
    }
    attribute.needsUpdate = true;
    attributeToBoneIndexMapMap.set(attribute, newToOld);
    maxBones = Math.max(maxBones, oldToNew.size);
  }
  for (const mesh of skinnedMeshes) {
    const geometry = mesh.geometry;
    const attribute = geometry.getAttribute("skinIndex");
    const newToOld = attributeToBoneIndexMapMap.get(attribute);
    const bones = [];
    const boneInverses = [];
    const nBones = experimentalSameBoneCounts ? maxBones : newToOld.size;
    for (let newIndex = 0; newIndex < nBones; newIndex++) {
      const oldIndex = (_b = newToOld.get(newIndex)) != null ? _b : 0;
      bones.push(mesh.skeleton.bones[oldIndex]);
      boneInverses.push(mesh.skeleton.boneInverses[oldIndex]);
    }
    const skeleton = new THREE28.Skeleton(bones, boneInverses);
    mesh.bind(skeleton, new THREE28.Matrix4());
  }
}

// src/VRMUtils/removeUnnecessaryVertices.ts
import * as THREE29 from "./three.js";
import { BufferAttribute as BufferAttribute9 } from "./three.js";
function checkIsVertexUsed(attributes, originalIndex) {
  const vertexCount = attributes.position.count;
  const isVertexUsed = new Array(vertexCount);
  let verticesUsed = 0;
  const originalIndexArray = originalIndex.array;
  for (let i = 0; i < originalIndexArray.length; i++) {
    const index = originalIndexArray[i];
    if (!isVertexUsed[index]) {
      isVertexUsed[index] = true;
      verticesUsed++;
    }
  }
  return { isVertexUsed, vertexCount, verticesUsed };
}
function buildIndexMapsFromIsVertexUsed(isVertexUsed) {
  const originalIndexNewIndexMap = [];
  const newIndexOriginalIndexMap = [];
  let indexHead = 0;
  for (let i = 0; i < isVertexUsed.length; i++) {
    if (isVertexUsed[i]) {
      const newIndex = indexHead++;
      originalIndexNewIndexMap[i] = newIndex;
      newIndexOriginalIndexMap[newIndex] = i;
    }
  }
  return { originalIndexNewIndexMap, newIndexOriginalIndexMap };
}
function copyGeometryProperties(source, target) {
  var _a, _b, _c, _d;
  target.name = source.name;
  target.morphTargetsRelative = source.morphTargetsRelative;
  source.groups.forEach((group) => {
    target.addGroup(group.start, group.count, group.materialIndex);
  });
  target.boundingBox = (_b = (_a = source.boundingBox) == null ? void 0 : _a.clone()) != null ? _b : null;
  target.boundingSphere = (_d = (_c = source.boundingSphere) == null ? void 0 : _c.clone()) != null ? _d : null;
  target.setDrawRange(source.drawRange.start, source.drawRange.count);
  target.userData = source.userData;
}
function reorganizeIndexAttribute(newGeometry, originalIndex, originalIndexNewIndexMap) {
  const originalIndexArray = originalIndex.array;
  const newIndexArray = new originalIndexArray.constructor(originalIndexArray.length);
  for (let i = 0; i < originalIndexArray.length; i++) {
    const index = originalIndexArray[i];
    newIndexArray[i] = originalIndexNewIndexMap[index];
  }
  newGeometry.setIndex(new BufferAttribute9(newIndexArray, originalIndex.itemSize, originalIndex.normalized));
}
function remapAttributeArray(originalArray, newIndexOriginalIndexMap, stride) {
  const ArrayCtor = originalArray.constructor;
  const newArray = new ArrayCtor(newIndexOriginalIndexMap.length * stride);
  let isAllZero = true;
  for (let i = 0; i < newIndexOriginalIndexMap.length; i++) {
    const originalIndex = newIndexOriginalIndexMap[i];
    const srcBase = originalIndex * stride;
    const dstBase = i * stride;
    for (let j = 0; j < stride; j++) {
      const v = originalArray[srcBase + j];
      newArray[dstBase + j] = v;
      isAllZero = isAllZero && v === 0;
    }
  }
  return [newArray, isAllZero];
}
function collectGeometryAttributeGroups(attributes) {
  var _a;
  const interleavedBufferAttributeMap = /* @__PURE__ */ new Map();
  const nonInterleavedAttributes = [];
  for (const [attributeName, originalAttribute] of Object.entries(attributes)) {
    if (originalAttribute.isInterleavedBufferAttribute) {
      const interleavedAttribute = originalAttribute;
      const interleavedBuffer = interleavedAttribute.data;
      const group = (_a = interleavedBufferAttributeMap.get(interleavedBuffer)) != null ? _a : [];
      interleavedBufferAttributeMap.set(interleavedBuffer, group);
      group.push([attributeName, interleavedAttribute]);
    } else {
      const attribute = originalAttribute;
      nonInterleavedAttributes.push([attributeName, attribute]);
    }
  }
  return [interleavedBufferAttributeMap, nonInterleavedAttributes];
}
function reorganizeGeometryAttributes(newGeometry, attributes, newIndexOriginalIndexMap) {
  const [interleavedBufferAttributeMap, nonInterleavedAttributes] = collectGeometryAttributeGroups(attributes);
  for (const [interleavedBuffer, attributesInGroup] of interleavedBufferAttributeMap) {
    const originalInterleavedBufferArray = interleavedBuffer.array;
    const { stride } = interleavedBuffer;
    const [newInterleavedArray, _] = remapAttributeArray(
      originalInterleavedBufferArray,
      newIndexOriginalIndexMap,
      stride
    );
    const newInterleavedBuffer = new THREE29.InterleavedBuffer(newInterleavedArray, stride);
    newInterleavedBuffer.setUsage(interleavedBuffer.usage);
    for (const [attributeName, originalAttribute] of attributesInGroup) {
      const { itemSize, offset, normalized } = originalAttribute;
      const newAttribute = new THREE29.InterleavedBufferAttribute(newInterleavedBuffer, itemSize, offset, normalized);
      newGeometry.setAttribute(attributeName, newAttribute);
    }
  }
  for (const [attributeName, originalAttribute] of nonInterleavedAttributes) {
    const originalAttributeArray = originalAttribute.array;
    const { itemSize, normalized } = originalAttribute;
    const [newAttributeArray, _] = remapAttributeArray(originalAttributeArray, newIndexOriginalIndexMap, itemSize);
    newGeometry.setAttribute(attributeName, new BufferAttribute9(newAttributeArray, itemSize, normalized));
  }
}
function collectMorphAttributeGroups(morphAttributes) {
  var _a;
  const interleavedBufferAttributeMap = /* @__PURE__ */ new Map();
  const nonInterleavedAttributes = [];
  for (const [key, attributes] of Object.entries(morphAttributes)) {
    const attributeName = key;
    for (let iMorph = 0; iMorph < attributes.length; iMorph++) {
      const originalAttribute = attributes[iMorph];
      if (originalAttribute.isInterleavedBufferAttribute) {
        const interleavedAttribute = originalAttribute;
        const interleavedBuffer = interleavedAttribute.data;
        const group = (_a = interleavedBufferAttributeMap.get(interleavedBuffer)) != null ? _a : [];
        interleavedBufferAttributeMap.set(interleavedBuffer, group);
        group.push([attributeName, iMorph, interleavedAttribute]);
      } else {
        const attribute = originalAttribute;
        nonInterleavedAttributes.push([attributeName, iMorph, attribute]);
      }
    }
  }
  return [interleavedBufferAttributeMap, nonInterleavedAttributes];
}
function reorganizeMorphAttributes(newGeometry, morphAttributes, newIndexOriginalIndexMap) {
  var _a, _b;
  let allMorphsAreZero = true;
  const [interleavedBufferAttributeMap, nonInterleavedAttributes] = collectMorphAttributeGroups(morphAttributes);
  const newMorphAttributes = {};
  for (const [interleavedBuffer, attributesInGroup] of interleavedBufferAttributeMap) {
    const originalInterleavedBufferArray = interleavedBuffer.array;
    const { stride } = interleavedBuffer;
    const [newInterleavedArray, isAllZero] = remapAttributeArray(
      originalInterleavedBufferArray,
      newIndexOriginalIndexMap,
      stride
    );
    allMorphsAreZero = allMorphsAreZero && isAllZero;
    const newInterleavedBuffer = new THREE29.InterleavedBuffer(newInterleavedArray, stride);
    newInterleavedBuffer.setUsage(interleavedBuffer.usage);
    for (const [attributeName, morphIndex, attribute] of attributesInGroup) {
      const { itemSize, offset, normalized } = attribute;
      const newAttribute = new THREE29.InterleavedBufferAttribute(newInterleavedBuffer, itemSize, offset, normalized);
      (_a = newMorphAttributes[attributeName]) != null ? _a : newMorphAttributes[attributeName] = [];
      newMorphAttributes[attributeName][morphIndex] = newAttribute;
    }
  }
  for (const [attributeName, morphIndex, attribute] of nonInterleavedAttributes) {
    const originalAttribute = attribute;
    const originalAttributeArray = originalAttribute.array;
    const { itemSize, normalized } = originalAttribute;
    const [newAttributeArray, isAllZero] = remapAttributeArray(
      originalAttributeArray,
      newIndexOriginalIndexMap,
      itemSize
    );
    allMorphsAreZero = allMorphsAreZero && isAllZero;
    (_b = newMorphAttributes[attributeName]) != null ? _b : newMorphAttributes[attributeName] = [];
    newMorphAttributes[attributeName][morphIndex] = new BufferAttribute9(newAttributeArray, itemSize, normalized);
  }
  newGeometry.morphAttributes = allMorphsAreZero ? {} : newMorphAttributes;
}
function removeUnnecessaryVertices(root) {
  const geometryMap = /* @__PURE__ */ new Map();
  root.traverse((obj) => {
    if (!obj.isMesh) {
      return;
    }
    const mesh = obj;
    const geometry = mesh.geometry;
    const originalIndex = geometry.index;
    if (originalIndex == null) {
      return;
    }
    const newGeometryAlreadyExisted = geometryMap.get(geometry);
    if (newGeometryAlreadyExisted != null) {
      mesh.geometry = newGeometryAlreadyExisted;
      return;
    }
    const { isVertexUsed, vertexCount, verticesUsed } = checkIsVertexUsed(geometry.attributes, originalIndex);
    if (verticesUsed === vertexCount) {
      return;
    }
    const { originalIndexNewIndexMap, newIndexOriginalIndexMap } = buildIndexMapsFromIsVertexUsed(isVertexUsed);
    const newGeometry = new THREE29.BufferGeometry();
    copyGeometryProperties(geometry, newGeometry);
    geometryMap.set(geometry, newGeometry);
    reorganizeIndexAttribute(newGeometry, originalIndex, originalIndexNewIndexMap);
    reorganizeGeometryAttributes(newGeometry, geometry.attributes, newIndexOriginalIndexMap);
    reorganizeMorphAttributes(newGeometry, geometry.morphAttributes, newIndexOriginalIndexMap);
    mesh.geometry = newGeometry;
  });
  Array.from(geometryMap.keys()).forEach((originalGeometry) => {
    originalGeometry.dispose();
  });
}

// src/VRMUtils/rotateVRM0.ts
function rotateVRM0(vrm) {
  var _a;
  if (((_a = vrm.meta) == null ? void 0 : _a.metaVersion) === "0") {
    vrm.scene.rotation.y = Math.PI;
  }
}

// src/VRMUtils/index.ts
var VRMUtils = class {
  constructor() {
  }
};
VRMUtils.combineMorphs = combineMorphs;
VRMUtils.combineSkeletons = combineSkeletons;
VRMUtils.deepDispose = deepDispose;
VRMUtils.removeUnnecessaryJoints = removeUnnecessaryJoints;
VRMUtils.removeUnnecessaryVertices = removeUnnecessaryVertices;
VRMUtils.rotateVRM0 = rotateVRM0;
export {
  MToonMaterial,
  MToonMaterialDebugMode,
  MToonMaterialLoaderPlugin,
  MToonMaterialOutlineWidthMode,
  VRM,
  VRMAimConstraint,
  VRMCore,
  VRMCoreLoaderPlugin,
  VRMExpression,
  VRMExpressionLoaderPlugin,
  VRMExpressionManager,
  VRMExpressionMaterialColorBind,
  VRMExpressionMaterialColorType,
  VRMExpressionMorphTargetBind,
  VRMExpressionOverrideType,
  VRMExpressionPresetName,
  VRMExpressionTextureTransformBind,
  VRMFirstPerson,
  VRMFirstPersonLoaderPlugin,
  VRMFirstPersonMeshAnnotationType,
  VRMHumanBoneList,
  VRMHumanBoneName,
  VRMHumanBoneParentMap,
  VRMHumanoid,
  VRMHumanoidHelper,
  VRMHumanoidLoaderPlugin,
  VRMLoaderPlugin,
  VRMLookAt,
  VRMLookAtBoneApplier,
  VRMLookAtExpressionApplier,
  VRMLookAtHelper,
  VRMLookAtLoaderPlugin,
  VRMLookAtRangeMap,
  VRMLookAtTypeName,
  VRMMetaLoaderPlugin,
  VRMNodeConstraint,
  VRMNodeConstraintHelper,
  VRMNodeConstraintLoaderPlugin,
  VRMNodeConstraintManager,
  VRMRequiredHumanBoneName,
  VRMRollConstraint,
  VRMRotationConstraint,
  VRMSpringBoneCollider,
  VRMSpringBoneColliderHelper,
  VRMSpringBoneColliderShape,
  VRMSpringBoneColliderShapeCapsule,
  VRMSpringBoneColliderShapePlane,
  VRMSpringBoneColliderShapeSphere,
  VRMSpringBoneJoint,
  VRMSpringBoneJointHelper,
  VRMSpringBoneLoaderPlugin,
  VRMSpringBoneManager,
  VRMUtils
};
/*!
 * @pixiv/three-vrm-core v3.5.5
 * The implementation of core features of VRM, for @pixiv/three-vrm
 *
 * Copyright (c) 2019-2026 pixiv Inc.
 * @pixiv/three-vrm-core is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 */
/*!
 * @pixiv/three-vrm-materials-mtoon v3.5.5
 * MToon (toon material) module for @pixiv/three-vrm
 *
 * Copyright (c) 2019-2026 pixiv Inc.
 * @pixiv/three-vrm-materials-mtoon is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 */
/*!
 * @pixiv/three-vrm-materials-hdr-emissive-multiplier v3.5.5
 * Support VRMC_hdr_emissiveMultiplier for @pixiv/three-vrm
 *
 * Copyright (c) 2019-2026 pixiv Inc.
 * @pixiv/three-vrm-materials-hdr-emissive-multiplier is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 */
/*!
 * @pixiv/three-vrm-materials-v0compat v3.5.5
 * VRM0.0 materials compatibility layer plugin for @pixiv/three-vrm
 *
 * Copyright (c) 2019-2026 pixiv Inc.
 * @pixiv/three-vrm-materials-v0compat is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 */
/*!
 * @pixiv/three-vrm-node-constraint v3.5.5
 * Node constraint module for @pixiv/three-vrm
 *
 * Copyright (c) 2019-2026 pixiv Inc.
 * @pixiv/three-vrm-node-constraint is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 */
/*!
 * @pixiv/three-vrm-springbone v3.5.5
 * Spring bone module for @pixiv/three-vrm
 *
 * Copyright (c) 2019-2026 pixiv Inc.
 * @pixiv/three-vrm-springbone is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 */
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vdGhyZWUtdnJtLWNvcmUvc3JjL2V4cHJlc3Npb25zL1ZSTUV4cHJlc3Npb24udHMiLCAiLi4vLi4vdGhyZWUtdnJtLWNvcmUvc3JjL2V4cHJlc3Npb25zL1ZSTUV4cHJlc3Npb25Mb2FkZXJQbHVnaW4udHMiLCAiLi4vLi4vdGhyZWUtdnJtLWNvcmUvc3JjL3V0aWxzL2dsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlLnRzIiwgIi4uLy4uL3RocmVlLXZybS1jb3JlL3NyYy9leHByZXNzaW9ucy9WUk1FeHByZXNzaW9uUHJlc2V0TmFtZS50cyIsICIuLi8uLi90aHJlZS12cm0tY29yZS9zcmMvdXRpbHMvc2F0dXJhdGUudHMiLCAiLi4vLi4vdGhyZWUtdnJtLWNvcmUvc3JjL2V4cHJlc3Npb25zL1ZSTUV4cHJlc3Npb25NYW5hZ2VyLnRzIiwgIi4uLy4uL3RocmVlLXZybS1jb3JlL3NyYy9leHByZXNzaW9ucy9WUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvclR5cGUudHMiLCAiLi4vLi4vdGhyZWUtdnJtLWNvcmUvc3JjL2V4cHJlc3Npb25zL1ZSTUV4cHJlc3Npb25NYXRlcmlhbENvbG9yQmluZC50cyIsICIuLi8uLi90aHJlZS12cm0tY29yZS9zcmMvZXhwcmVzc2lvbnMvVlJNRXhwcmVzc2lvbk1vcnBoVGFyZ2V0QmluZC50cyIsICIuLi8uLi90aHJlZS12cm0tY29yZS9zcmMvZXhwcmVzc2lvbnMvVlJNRXhwcmVzc2lvblRleHR1cmVUcmFuc2Zvcm1CaW5kLnRzIiwgIi4uLy4uL3RocmVlLXZybS1jb3JlL3NyYy9leHByZXNzaW9ucy9WUk1FeHByZXNzaW9uT3ZlcnJpZGVUeXBlLnRzIiwgIi4uLy4uL3RocmVlLXZybS1jb3JlL3NyYy9maXJzdFBlcnNvbi9WUk1GaXJzdFBlcnNvbi50cyIsICIuLi8uLi90aHJlZS12cm0tY29yZS9zcmMvZmlyc3RQZXJzb24vVlJNRmlyc3RQZXJzb25Mb2FkZXJQbHVnaW4udHMiLCAiLi4vLi4vdGhyZWUtdnJtLWNvcmUvc3JjL2ZpcnN0UGVyc29uL1ZSTUZpcnN0UGVyc29uTWVzaEFubm90YXRpb25UeXBlLnRzIiwgIi4uLy4uL3RocmVlLXZybS1jb3JlL3NyYy9odW1hbm9pZC9oZWxwZXJzL1ZSTUh1bWFub2lkSGVscGVyLnRzIiwgIi4uLy4uL3RocmVlLXZybS1jb3JlL3NyYy9odW1hbm9pZC9WUk1IdW1hbkJvbmVMaXN0LnRzIiwgIi4uLy4uL3RocmVlLXZybS1jb3JlL3NyYy9odW1hbm9pZC9WUk1IdW1hbkJvbmVOYW1lLnRzIiwgIi4uLy4uL3RocmVlLXZybS1jb3JlL3NyYy9odW1hbm9pZC9WUk1IdW1hbkJvbmVQYXJlbnRNYXAudHMiLCAiLi4vLi4vdGhyZWUtdnJtLWNvcmUvc3JjL2h1bWFub2lkL1ZSTVJpZy50cyIsICIuLi8uLi90aHJlZS12cm0tY29yZS9zcmMvdXRpbHMvcXVhdEludmVydENvbXBhdC50cyIsICIuLi8uLi90aHJlZS12cm0tY29yZS9zcmMvaHVtYW5vaWQvVlJNSHVtYW5vaWRSaWcudHMiLCAiLi4vLi4vdGhyZWUtdnJtLWNvcmUvc3JjL2h1bWFub2lkL1ZSTUh1bWFub2lkLnRzIiwgIi4uLy4uL3RocmVlLXZybS1jb3JlL3NyYy9odW1hbm9pZC9WUk1SZXF1aXJlZEh1bWFuQm9uZU5hbWUudHMiLCAiLi4vLi4vdGhyZWUtdnJtLWNvcmUvc3JjL2h1bWFub2lkL1ZSTUh1bWFub2lkTG9hZGVyUGx1Z2luLnRzIiwgIi4uLy4uL3RocmVlLXZybS1jb3JlL3NyYy9sb29rQXQvaGVscGVycy9WUk1Mb29rQXRIZWxwZXIudHMiLCAiLi4vLi4vdGhyZWUtdnJtLWNvcmUvc3JjL2xvb2tBdC9oZWxwZXJzL3V0aWxzL0ZhbkJ1ZmZlckdlb21ldHJ5LnRzIiwgIi4uLy4uL3RocmVlLXZybS1jb3JlL3NyYy9sb29rQXQvaGVscGVycy91dGlscy9MaW5lQW5kU3BoZXJlQnVmZmVyR2VvbWV0cnkudHMiLCAiLi4vLi4vdGhyZWUtdnJtLWNvcmUvc3JjL2xvb2tBdC9WUk1Mb29rQXQudHMiLCAiLi4vLi4vdGhyZWUtdnJtLWNvcmUvc3JjL3V0aWxzL2dldFdvcmxkUXVhdGVybmlvbkxpdGUudHMiLCAiLi4vLi4vdGhyZWUtdnJtLWNvcmUvc3JjL2xvb2tBdC91dGlscy9jYWxjQXppbXV0aEFsdGl0dWRlLnRzIiwgIi4uLy4uL3RocmVlLXZybS1jb3JlL3NyYy9sb29rQXQvdXRpbHMvc2FuaXRpemVBbmdsZS50cyIsICIuLi8uLi90aHJlZS12cm0tY29yZS9zcmMvbG9va0F0L1ZSTUxvb2tBdEJvbmVBcHBsaWVyLnRzIiwgIi4uLy4uL3RocmVlLXZybS1jb3JlL3NyYy9sb29rQXQvVlJNTG9va0F0RXhwcmVzc2lvbkFwcGxpZXIudHMiLCAiLi4vLi4vdGhyZWUtdnJtLWNvcmUvc3JjL2xvb2tBdC9WUk1Mb29rQXRSYW5nZU1hcC50cyIsICIuLi8uLi90aHJlZS12cm0tY29yZS9zcmMvbG9va0F0L1ZSTUxvb2tBdExvYWRlclBsdWdpbi50cyIsICIuLi8uLi90aHJlZS12cm0tY29yZS9zcmMvbG9va0F0L1ZSTUxvb2tBdFR5cGVOYW1lLnRzIiwgIi4uLy4uL3RocmVlLXZybS1jb3JlL3NyYy9tZXRhL1ZSTU1ldGFMb2FkZXJQbHVnaW4udHMiLCAiLi4vLi4vdGhyZWUtdnJtLWNvcmUvc3JjL3V0aWxzL3Jlc29sdmVVUkwudHMiLCAiLi4vLi4vdGhyZWUtdnJtLWNvcmUvc3JjL1ZSTUNvcmUudHMiLCAiLi4vLi4vdGhyZWUtdnJtLWNvcmUvc3JjL1ZSTUNvcmVMb2FkZXJQbHVnaW4udHMiLCAiLi4vc3JjL1ZSTS50cyIsICIuLi8uLi90aHJlZS12cm0tbWF0ZXJpYWxzLW10b29uL3NyYy9NVG9vbk1hdGVyaWFsTG9hZGVyUGx1Z2luLnRzIiwgIi4uLy4uL3RocmVlLXZybS1tYXRlcmlhbHMtbXRvb24vc3JjL0dMVEZNVG9vbk1hdGVyaWFsUGFyYW1zQXNzaWduSGVscGVyLnRzIiwgIi4uLy4uL3RocmVlLXZybS1tYXRlcmlhbHMtbXRvb24vc3JjL3V0aWxzL3NldFRleHR1cmVDb2xvclNwYWNlLnRzIiwgIi4uLy4uL3RocmVlLXZybS1tYXRlcmlhbHMtbXRvb24vc3JjL01Ub29uTWF0ZXJpYWwudHMiLCAiLi4vLi4vdGhyZWUtdnJtLW1hdGVyaWFscy1tdG9vbi9zcmMvc2hhZGVycy9tdG9vbi52ZXJ0IiwgIi4uLy4uL3RocmVlLXZybS1tYXRlcmlhbHMtbXRvb24vc3JjL3NoYWRlcnMvbXRvb24uZnJhZyIsICIuLi8uLi90aHJlZS12cm0tbWF0ZXJpYWxzLW10b29uL3NyYy9NVG9vbk1hdGVyaWFsRGVidWdNb2RlLnRzIiwgIi4uLy4uL3RocmVlLXZybS1tYXRlcmlhbHMtbXRvb24vc3JjL01Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlLnRzIiwgIi4uLy4uL3RocmVlLXZybS1tYXRlcmlhbHMtbXRvb24vc3JjL3V0aWxzL2dldFRleHR1cmVDb2xvclNwYWNlLnRzIiwgIi4uLy4uL3RocmVlLXZybS1tYXRlcmlhbHMtaGRyLWVtaXNzaXZlLW11bHRpcGxpZXIvc3JjL1ZSTU1hdGVyaWFsc0hEUkVtaXNzaXZlTXVsdGlwbGllckxvYWRlclBsdWdpbi50cyIsICIuLi8uLi90aHJlZS12cm0tbWF0ZXJpYWxzLXYwY29tcGF0L3NyYy9WUk1NYXRlcmlhbHNWMENvbXBhdFBsdWdpbi50cyIsICIuLi8uLi90aHJlZS12cm0tbWF0ZXJpYWxzLXYwY29tcGF0L3NyYy91dGlscy9nYW1tYUVPVEYudHMiLCAiLi4vLi4vdGhyZWUtdnJtLW5vZGUtY29uc3RyYWludC9zcmMvaGVscGVycy9WUk1Ob2RlQ29uc3RyYWludEhlbHBlci50cyIsICIuLi8uLi90aHJlZS12cm0tbm9kZS1jb25zdHJhaW50L3NyYy9WUk1BaW1Db25zdHJhaW50LnRzIiwgIi4uLy4uL3RocmVlLXZybS1ub2RlLWNvbnN0cmFpbnQvc3JjL3V0aWxzL2RlY29tcG9zZVBvc2l0aW9uLnRzIiwgIi4uLy4uL3RocmVlLXZybS1ub2RlLWNvbnN0cmFpbnQvc3JjL3V0aWxzL2RlY29tcG9zZVJvdGF0aW9uLnRzIiwgIi4uLy4uL3RocmVlLXZybS1ub2RlLWNvbnN0cmFpbnQvc3JjL3V0aWxzL3F1YXRJbnZlcnRDb21wYXQudHMiLCAiLi4vLi4vdGhyZWUtdnJtLW5vZGUtY29uc3RyYWludC9zcmMvVlJNTm9kZUNvbnN0cmFpbnQudHMiLCAiLi4vLi4vdGhyZWUtdnJtLW5vZGUtY29uc3RyYWludC9zcmMvdXRpbHMvdHJhdmVyc2VBbmNlc3RvcnNGcm9tUm9vdC50cyIsICIuLi8uLi90aHJlZS12cm0tbm9kZS1jb25zdHJhaW50L3NyYy9WUk1Ob2RlQ29uc3RyYWludE1hbmFnZXIudHMiLCAiLi4vLi4vdGhyZWUtdnJtLW5vZGUtY29uc3RyYWludC9zcmMvVlJNUm90YXRpb25Db25zdHJhaW50LnRzIiwgIi4uLy4uL3RocmVlLXZybS1ub2RlLWNvbnN0cmFpbnQvc3JjL1ZSTVJvbGxDb25zdHJhaW50LnRzIiwgIi4uLy4uL3RocmVlLXZybS1ub2RlLWNvbnN0cmFpbnQvc3JjL1ZSTU5vZGVDb25zdHJhaW50TG9hZGVyUGx1Z2luLnRzIiwgIi4uLy4uL3RocmVlLXZybS1zcHJpbmdib25lL3NyYy9oZWxwZXJzL1ZSTVNwcmluZ0JvbmVDb2xsaWRlckhlbHBlci50cyIsICIuLi8uLi90aHJlZS12cm0tc3ByaW5nYm9uZS9zcmMvVlJNU3ByaW5nQm9uZUNvbGxpZGVyU2hhcGVDYXBzdWxlLnRzIiwgIi4uLy4uL3RocmVlLXZybS1zcHJpbmdib25lL3NyYy9WUk1TcHJpbmdCb25lQ29sbGlkZXJTaGFwZS50cyIsICIuLi8uLi90aHJlZS12cm0tc3ByaW5nYm9uZS9zcmMvVlJNU3ByaW5nQm9uZUNvbGxpZGVyU2hhcGVQbGFuZS50cyIsICIuLi8uLi90aHJlZS12cm0tc3ByaW5nYm9uZS9zcmMvVlJNU3ByaW5nQm9uZUNvbGxpZGVyU2hhcGVTcGhlcmUudHMiLCAiLi4vLi4vdGhyZWUtdnJtLXNwcmluZ2JvbmUvc3JjL2hlbHBlcnMvdXRpbHMvQ29sbGlkZXJTaGFwZUNhcHN1bGVCdWZmZXJHZW9tZXRyeS50cyIsICIuLi8uLi90aHJlZS12cm0tc3ByaW5nYm9uZS9zcmMvaGVscGVycy91dGlscy9Db2xsaWRlclNoYXBlUGxhbmVCdWZmZXJHZW9tZXRyeS50cyIsICIuLi8uLi90aHJlZS12cm0tc3ByaW5nYm9uZS9zcmMvaGVscGVycy91dGlscy9Db2xsaWRlclNoYXBlU3BoZXJlQnVmZmVyR2VvbWV0cnkudHMiLCAiLi4vLi4vdGhyZWUtdnJtLXNwcmluZ2JvbmUvc3JjL2hlbHBlcnMvVlJNU3ByaW5nQm9uZUpvaW50SGVscGVyLnRzIiwgIi4uLy4uL3RocmVlLXZybS1zcHJpbmdib25lL3NyYy9oZWxwZXJzL3V0aWxzL1NwcmluZ0JvbmVCdWZmZXJHZW9tZXRyeS50cyIsICIuLi8uLi90aHJlZS12cm0tc3ByaW5nYm9uZS9zcmMvVlJNU3ByaW5nQm9uZUNvbGxpZGVyLnRzIiwgIi4uLy4uL3RocmVlLXZybS1zcHJpbmdib25lL3NyYy9WUk1TcHJpbmdCb25lSm9pbnQudHMiLCAiLi4vLi4vdGhyZWUtdnJtLXNwcmluZ2JvbmUvc3JjL3V0aWxzL01hdHJpeDRJbnZlcnNlQ2FjaGUudHMiLCAiLi4vLi4vdGhyZWUtdnJtLXNwcmluZ2JvbmUvc3JjL3V0aWxzL21hdDRJbnZlcnRDb21wYXQudHMiLCAiLi4vLi4vdGhyZWUtdnJtLXNwcmluZ2JvbmUvc3JjL1ZSTVNwcmluZ0JvbmVMb2FkZXJQbHVnaW4udHMiLCAiLi4vLi4vdGhyZWUtdnJtLXNwcmluZ2JvbmUvc3JjL3V0aWxzL3RyYXZlcnNlQW5jZXN0b3JzRnJvbVJvb3QudHMiLCAiLi4vLi4vdGhyZWUtdnJtLXNwcmluZ2JvbmUvc3JjL3V0aWxzL3RyYXZlcnNlQ2hpbGRyZW5VbnRpbENvbmRpdGlvbk1ldC50cyIsICIuLi8uLi90aHJlZS12cm0tc3ByaW5nYm9uZS9zcmMvdXRpbHMvbG93ZXN0Q29tbW9uQW5jZXN0b3IudHMiLCAiLi4vLi4vdGhyZWUtdnJtLXNwcmluZ2JvbmUvc3JjL1ZSTVNwcmluZ0JvbmVNYW5hZ2VyLnRzIiwgIi4uL3NyYy9WUk1Mb2FkZXJQbHVnaW4udHMiLCAiLi4vc3JjL1ZSTVV0aWxzL2NvbWJpbmVNb3JwaHMudHMiLCAiLi4vc3JjL1ZSTVV0aWxzL2NvbWJpbmVTa2VsZXRvbnMudHMiLCAiLi4vc3JjL3V0aWxzL2F0dHJpYnV0ZUdldENvbXBvbmVudENvbXBhdC50cyIsICIuLi9zcmMvdXRpbHMvYXR0cmlidXRlU2V0Q29tcG9uZW50Q29tcGF0LnRzIiwgIi4uL3NyYy9WUk1VdGlscy9kZWVwRGlzcG9zZS50cyIsICIuLi9zcmMvVlJNVXRpbHMvcmVtb3ZlVW5uZWNlc3NhcnlKb2ludHMudHMiLCAiLi4vc3JjL1ZSTVV0aWxzL3JlbW92ZVVubmVjZXNzYXJ5VmVydGljZXMudHMiLCAiLi4vc3JjL1ZSTVV0aWxzL3JvdGF0ZVZSTTAudHMiLCAiLi4vc3JjL1ZSTVV0aWxzL2luZGV4LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBWUk1FeHByZXNzaW9uQmluZCB9IGZyb20gJy4vVlJNRXhwcmVzc2lvbkJpbmQnO1xuaW1wb3J0IHR5cGUgeyBWUk1FeHByZXNzaW9uT3ZlcnJpZGVUeXBlIH0gZnJvbSAnLi9WUk1FeHByZXNzaW9uT3ZlcnJpZGVUeXBlJztcbmltcG9ydCB0eXBlIHsgVlJNRXhwcmVzc2lvbk1hbmFnZXIgfSBmcm9tICcuL1ZSTUV4cHJlc3Npb25NYW5hZ2VyJztcblxuLy8gYW5pbWF0aW9uTWl4ZXIgXHUzMDZFXHU3NkUzXHU4OTk2XHU1QkZFXHU4QzYxXHUzMDZGXHUzMDAxU2NlbmUgXHUzMDZFXHU0RTJEXHUzMDZCXHU1MTY1XHUzMDYzXHUzMDY2XHUzMDQ0XHUzMDhCXHU1RkM1XHU4OTgxXHUzMDRDXHUzMDQyXHUzMDhCXHUzMDAyXG4vLyBcdTMwNURcdTMwNkVcdTMwNUZcdTMwODFcdTMwMDFcdTg4NjhcdTc5M0FcdTMwQUFcdTMwRDZcdTMwQjhcdTMwQTdcdTMwQUZcdTMwQzhcdTMwNjdcdTMwNkZcdTMwNkFcdTMwNDRcdTMwNTFcdTMwOENcdTMwNjlcdTMwMDFPYmplY3QzRCBcdTMwOTJcdTdEOTlcdTYyN0ZcdTMwNTdcdTMwNjYgU2NlbmUgXHUzMDZCXHU2Mjk1XHU1MTY1XHUzMDY3XHUzMDREXHUzMDhCXHUzMDg4XHUzMDQ2XHUzMDZCXHUzMDU5XHUzMDhCXHUzMDAyXG5leHBvcnQgY2xhc3MgVlJNRXhwcmVzc2lvbiBleHRlbmRzIFRIUkVFLk9iamVjdDNEIHtcbiAgLyoqXG4gICAqIE5hbWUgb2YgdGhpcyBleHByZXNzaW9uLlxuICAgKiBEaXN0aW5ndWlzaGVkIHdpdGggYG5hbWVgIHNpbmNlIGBuYW1lYCB3aWxsIGJlIGNvbmZsaWN0ZWQgd2l0aCBPYmplY3QzRC5cbiAgICovXG4gIHB1YmxpYyBleHByZXNzaW9uTmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBUaGUgY3VycmVudCB3ZWlnaHQgb2YgdGhlIGV4cHJlc3Npb24uXG4gICAqXG4gICAqIFlvdSB1c3VhbGx5IHdhbnQgdG8gc2V0IHRoZSB3ZWlnaHQgdmlhIHtAbGluayBWUk1FeHByZXNzaW9uTWFuYWdlci5zZXRWYWx1ZX0uXG4gICAqXG4gICAqIEl0IG1pZ2h0IGFsc28gYmUgY29udHJvbGxlZCBieSB0aGUgVGhyZWUuanMgYW5pbWF0aW9uIHN5c3RlbS5cbiAgICovXG4gIHB1YmxpYyB3ZWlnaHQgPSAwLjA7XG5cbiAgLyoqXG4gICAqIEludGVycHJldCB2YWx1ZXMgZ3JlYXRlciB0aGFuIDAuNSBhcyAxLjAsIG9ydGhlcndpc2UgMC4wLlxuICAgKi9cbiAgcHVibGljIGlzQmluYXJ5ID0gZmFsc2U7XG5cbiAgLyoqXG4gICAqIFNwZWNpZnkgaG93IHRoZSBleHByZXNzaW9uIG92ZXJyaWRlcyBibGluayBleHByZXNzaW9ucy5cbiAgICovXG4gIHB1YmxpYyBvdmVycmlkZUJsaW5rOiBWUk1FeHByZXNzaW9uT3ZlcnJpZGVUeXBlID0gJ25vbmUnO1xuXG4gIC8qKlxuICAgKiBTcGVjaWZ5IGhvdyB0aGUgZXhwcmVzc2lvbiBvdmVycmlkZXMgbG9va0F0IGV4cHJlc3Npb25zLlxuICAgKi9cbiAgcHVibGljIG92ZXJyaWRlTG9va0F0OiBWUk1FeHByZXNzaW9uT3ZlcnJpZGVUeXBlID0gJ25vbmUnO1xuXG4gIC8qKlxuICAgKiBTcGVjaWZ5IGhvdyB0aGUgZXhwcmVzc2lvbiBvdmVycmlkZXMgbW91dGggZXhwcmVzc2lvbnMuXG4gICAqL1xuICBwdWJsaWMgb3ZlcnJpZGVNb3V0aDogVlJNRXhwcmVzc2lvbk92ZXJyaWRlVHlwZSA9ICdub25lJztcblxuICAvKipcbiAgICogQmluZHMgdGhhdCB0aGlzIGV4cHJlc3Npb24gaW5mbHVlbmNlcy5cbiAgICovXG4gIHByaXZhdGUgX2JpbmRzOiBWUk1FeHByZXNzaW9uQmluZFtdID0gW107XG5cbiAgLyoqXG4gICAqIEJpbmRzIHRoYXQgdGhpcyBleHByZXNzaW9uIGluZmx1ZW5jZXMuXG4gICAqL1xuICBwdWJsaWMgZ2V0IGJpbmRzKCk6IHJlYWRvbmx5IFZSTUV4cHJlc3Npb25CaW5kW10ge1xuICAgIHJldHVybiB0aGlzLl9iaW5kcztcbiAgfVxuXG4gIG92ZXJyaWRlIHJlYWRvbmx5IHR5cGU6IHN0cmluZyB8ICdWUk1FeHByZXNzaW9uJztcblxuICAvKipcbiAgICogQSB2YWx1ZSByZXByZXNlbnRzIGhvdyBtdWNoIGl0IHNob3VsZCBvdmVycmlkZSBibGluayBleHByZXNzaW9ucy5cbiAgICogYDAuMGAgPT0gbm8gb3ZlcnJpZGUgYXQgYWxsLCBgMS4wYCA9PSBjb21wbGV0ZWx5IGJsb2NrIHRoZSBleHByZXNzaW9ucy5cbiAgICovXG4gIHB1YmxpYyBnZXQgb3ZlcnJpZGVCbGlua0Ftb3VudCgpOiBudW1iZXIge1xuICAgIGlmICh0aGlzLm92ZXJyaWRlQmxpbmsgPT09ICdibG9jaycpIHtcbiAgICAgIHJldHVybiAwLjAgPCB0aGlzLm91dHB1dFdlaWdodCA/IDEuMCA6IDAuMDtcbiAgICB9IGVsc2UgaWYgKHRoaXMub3ZlcnJpZGVCbGluayA9PT0gJ2JsZW5kJykge1xuICAgICAgcmV0dXJuIHRoaXMub3V0cHV0V2VpZ2h0O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gMC4wO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBIHZhbHVlIHJlcHJlc2VudHMgaG93IG11Y2ggaXQgc2hvdWxkIG92ZXJyaWRlIGxvb2tBdCBleHByZXNzaW9ucy5cbiAgICogYDAuMGAgPT0gbm8gb3ZlcnJpZGUgYXQgYWxsLCBgMS4wYCA9PSBjb21wbGV0ZWx5IGJsb2NrIHRoZSBleHByZXNzaW9ucy5cbiAgICovXG4gIHB1YmxpYyBnZXQgb3ZlcnJpZGVMb29rQXRBbW91bnQoKTogbnVtYmVyIHtcbiAgICBpZiAodGhpcy5vdmVycmlkZUxvb2tBdCA9PT0gJ2Jsb2NrJykge1xuICAgICAgcmV0dXJuIDAuMCA8IHRoaXMub3V0cHV0V2VpZ2h0ID8gMS4wIDogMC4wO1xuICAgIH0gZWxzZSBpZiAodGhpcy5vdmVycmlkZUxvb2tBdCA9PT0gJ2JsZW5kJykge1xuICAgICAgcmV0dXJuIHRoaXMub3V0cHV0V2VpZ2h0O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gMC4wO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBIHZhbHVlIHJlcHJlc2VudHMgaG93IG11Y2ggaXQgc2hvdWxkIG92ZXJyaWRlIG1vdXRoIGV4cHJlc3Npb25zLlxuICAgKiBgMC4wYCA9PSBubyBvdmVycmlkZSBhdCBhbGwsIGAxLjBgID09IGNvbXBsZXRlbHkgYmxvY2sgdGhlIGV4cHJlc3Npb25zLlxuICAgKi9cbiAgcHVibGljIGdldCBvdmVycmlkZU1vdXRoQW1vdW50KCk6IG51bWJlciB7XG4gICAgaWYgKHRoaXMub3ZlcnJpZGVNb3V0aCA9PT0gJ2Jsb2NrJykge1xuICAgICAgcmV0dXJuIDAuMCA8IHRoaXMub3V0cHV0V2VpZ2h0ID8gMS4wIDogMC4wO1xuICAgIH0gZWxzZSBpZiAodGhpcy5vdmVycmlkZU1vdXRoID09PSAnYmxlbmQnKSB7XG4gICAgICByZXR1cm4gdGhpcy5vdXRwdXRXZWlnaHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAwLjA7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFuIG91dHB1dCB3ZWlnaHQgb2YgdGhpcyBleHByZXNzaW9uLCBjb25zaWRlcmluZyB0aGUge0BsaW5rIGlzQmluYXJ5fS5cbiAgICovXG4gIHB1YmxpYyBnZXQgb3V0cHV0V2VpZ2h0KCk6IG51bWJlciB7XG4gICAgaWYgKHRoaXMuaXNCaW5hcnkpIHtcbiAgICAgIHJldHVybiB0aGlzLndlaWdodCA+IDAuNSA/IDEuMCA6IDAuMDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy53ZWlnaHQ7XG4gIH1cblxuICBjb25zdHJ1Y3RvcihleHByZXNzaW9uTmFtZTogc3RyaW5nKSB7XG4gICAgc3VwZXIoKTtcblxuICAgIHRoaXMubmFtZSA9IGBWUk1FeHByZXNzaW9uXyR7ZXhwcmVzc2lvbk5hbWV9YDtcbiAgICB0aGlzLmV4cHJlc3Npb25OYW1lID0gZXhwcmVzc2lvbk5hbWU7XG5cbiAgICAvLyB0cmF2ZXJzZSBcdTY2NDJcdTMwNkVcdTY1NTFcdTZFMDhcdTYyNEJcdTZCQjVcdTMwNjhcdTMwNTdcdTMwNjYgT2JqZWN0M0QgXHUzMDY3XHUzMDZGXHUzMDZBXHUzMDQ0XHUzMDUzXHUzMDY4XHUzMDkyXHU2NjBFXHU3OTNBXHUzMDU3XHUzMDY2XHUzMDRBXHUzMDRGXG4gICAgdGhpcy50eXBlID0gJ1ZSTUV4cHJlc3Npb24nO1xuXG4gICAgLy8gXHU4ODY4XHU3OTNBXHU3NkVFXHU3Njg0XHUzMDZFXHUzMEFBXHUzMEQ2XHUzMEI4XHUzMEE3XHUzMEFGXHUzMEM4XHUzMDY3XHUzMDZGXHUzMDZBXHUzMDQ0XHUzMDZFXHUzMDY3XHUzMDAxXHU4Q0EwXHU4Mzc3XHU4RUZEXHU2RTFCXHUzMDZFXHUzMDVGXHUzMDgxXHUzMDZCIHZpc2libGUgXHUzMDkyIGZhbHNlIFx1MzA2Qlx1MzA1N1x1MzA2Nlx1MzA0QVx1MzA0Rlx1MzAwMlxuICAgIC8vIFx1MzA1M1x1MzA4Q1x1MzA2Qlx1MzA4OFx1MzA4QVx1MzAwMVx1MzA1M1x1MzA2RVx1MzBBNFx1MzBGM1x1MzBCOVx1MzBCRlx1MzBGM1x1MzBCOVx1MzA2Qlx1NUJGRVx1MzA1OVx1MzA4Qlx1NkJDRVx1MzBENVx1MzBFQ1x1MzBGQ1x1MzBFMFx1MzA2RSBtYXRyaXggXHU4MUVBXHU1MkQ1XHU4QTA4XHU3Qjk3XHUzMDkyXHU3NzAxXHU3NTY1XHUzMDY3XHUzMDREXHUzMDhCXHUzMDAyXG4gICAgdGhpcy52aXNpYmxlID0gZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGFuIGV4cHJlc3Npb24gYmluZCB0byB0aGUgZXhwcmVzc2lvbi5cbiAgICpcbiAgICogQHBhcmFtIGJpbmQgQSBiaW5kIHRvIGFkZFxuICAgKi9cbiAgcHVibGljIGFkZEJpbmQoYmluZDogVlJNRXhwcmVzc2lvbkJpbmQpOiB2b2lkIHtcbiAgICB0aGlzLl9iaW5kcy5wdXNoKGJpbmQpO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZSBhbiBleHByZXNzaW9uIGJpbmQgZnJvbSB0aGUgZXhwcmVzc2lvbi5cbiAgICpcbiAgICogQHBhcmFtIGJpbmQgQSBiaW5kIHRvIGRlbGV0ZVxuICAgKi9cbiAgcHVibGljIGRlbGV0ZUJpbmQoYmluZDogVlJNRXhwcmVzc2lvbkJpbmQpOiB2b2lkIHtcbiAgICBjb25zdCBpbmRleCA9IHRoaXMuX2JpbmRzLmluZGV4T2YoYmluZCk7XG4gICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgIHRoaXMuX2JpbmRzLnNwbGljZShpbmRleCwgMSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFwcGx5IHdlaWdodCB0byBldmVyeSBhc3NpZ25lZCBibGVuZCBzaGFwZXMuXG4gICAqIFNob3VsZCBiZSBjYWxsZWQgZXZlcnkgZnJhbWUuXG4gICAqL1xuICBwdWJsaWMgYXBwbHlXZWlnaHQob3B0aW9ucz86IHtcbiAgICAvKipcbiAgICAgKiBNdWx0aXBsaWVzIGEgdmFsdWUgdG8gaXRzIHdlaWdodCB0byBhcHBseS5cbiAgICAgKiBJbnRlbmRlZCB0byBiZSB1c2VkIGZvciBvdmVycmlkaW5nIGFuIGV4cHJlc3Npb24gd2VpZ2h0IGJ5IGFub3RoZXIgZXhwcmVzc2lvbi5cbiAgICAgKiBTZWUgYWxzbzoge0BsaW5rIG92ZXJyaWRlQmxpbmt9LCB7QGxpbmsgb3ZlcnJpZGVMb29rQXR9LCB7QGxpbmsgb3ZlcnJpZGVNb3V0aH1cbiAgICAgKi9cbiAgICBtdWx0aXBsaWVyPzogbnVtYmVyO1xuICB9KTogdm9pZCB7XG4gICAgbGV0IGFjdHVhbFdlaWdodCA9IHRoaXMub3V0cHV0V2VpZ2h0O1xuICAgIGFjdHVhbFdlaWdodCAqPSBvcHRpb25zPy5tdWx0aXBsaWVyID8/IDEuMDtcblxuICAgIC8vIGlmIHRoZSBleHByZXNzaW9uIGlzIGJpbmFyeSwgdGhlIG92ZXJyaWRlIHZhbHVlIG11c3QgYmUgYWxzbyB0cmVhdGVkIGFzIGJpbmFyeVxuICAgIGlmICh0aGlzLmlzQmluYXJ5ICYmIGFjdHVhbFdlaWdodCA8IDEuMCkge1xuICAgICAgYWN0dWFsV2VpZ2h0ID0gMC4wO1xuICAgIH1cblxuICAgIHRoaXMuX2JpbmRzLmZvckVhY2goKGJpbmQpID0+IGJpbmQuYXBwbHlXZWlnaHQoYWN0dWFsV2VpZ2h0KSk7XG4gIH1cblxuICAvKipcbiAgICogQ2xlYXIgcHJldmlvdXNseSBhc3NpZ25lZCBibGVuZCBzaGFwZXMuXG4gICAqL1xuICBwdWJsaWMgY2xlYXJBcHBsaWVkV2VpZ2h0KCk6IHZvaWQge1xuICAgIHRoaXMuX2JpbmRzLmZvckVhY2goKGJpbmQpID0+IGJpbmQuY2xlYXJBcHBsaWVkV2VpZ2h0KCkpO1xuICB9XG59XG4iLCAiaW1wb3J0IHR5cGUgKiBhcyBWMFZSTSBmcm9tICdAcGl4aXYvdHlwZXMtdnJtLTAuMCc7XG5pbXBvcnQgdHlwZSAqIGFzIFYxVlJNU2NoZW1hIGZyb20gJ0BwaXhpdi90eXBlcy12cm1jLXZybS0xLjAnO1xuaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgR0xURiwgR0xURkxvYWRlclBsdWdpbiwgR0xURlBhcnNlciB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXIuanMnO1xuaW1wb3J0IHsgZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGUgfSBmcm9tICcuLi91dGlscy9nbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZSc7XG5pbXBvcnQgeyBWUk1FeHByZXNzaW9uIH0gZnJvbSAnLi9WUk1FeHByZXNzaW9uJztcbmltcG9ydCB7IFZSTUV4cHJlc3Npb25NYW5hZ2VyIH0gZnJvbSAnLi9WUk1FeHByZXNzaW9uTWFuYWdlcic7XG5pbXBvcnQgeyB2MEV4cHJlc3Npb25NYXRlcmlhbENvbG9yTWFwIH0gZnJvbSAnLi9WUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvclR5cGUnO1xuaW1wb3J0IHsgVlJNRXhwcmVzc2lvbk1hdGVyaWFsQ29sb3JCaW5kIH0gZnJvbSAnLi9WUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvckJpbmQnO1xuaW1wb3J0IHsgVlJNRXhwcmVzc2lvbk1vcnBoVGFyZ2V0QmluZCB9IGZyb20gJy4vVlJNRXhwcmVzc2lvbk1vcnBoVGFyZ2V0QmluZCc7XG5pbXBvcnQgeyBWUk1FeHByZXNzaW9uUHJlc2V0TmFtZSB9IGZyb20gJy4vVlJNRXhwcmVzc2lvblByZXNldE5hbWUnO1xuaW1wb3J0IHsgVlJNRXhwcmVzc2lvblRleHR1cmVUcmFuc2Zvcm1CaW5kIH0gZnJvbSAnLi9WUk1FeHByZXNzaW9uVGV4dHVyZVRyYW5zZm9ybUJpbmQnO1xuaW1wb3J0IHsgR0xURiBhcyBHTFRGU2NoZW1hIH0gZnJvbSAnQGdsdGYtdHJhbnNmb3JtL2NvcmUnO1xuXG4vKipcbiAqIFBvc3NpYmxlIHNwZWMgdmVyc2lvbnMgaXQgcmVjb2duaXplcy5cbiAqL1xuY29uc3QgUE9TU0lCTEVfU1BFQ19WRVJTSU9OUyA9IG5ldyBTZXQoWycxLjAnLCAnMS4wLWJldGEnXSk7XG5cbi8qKlxuICogQSBwbHVnaW4gb2YgR0xURkxvYWRlciB0aGF0IGltcG9ydHMgYSB7QGxpbmsgVlJNRXhwcmVzc2lvbk1hbmFnZXJ9IGZyb20gYSBWUk0gZXh0ZW5zaW9uIG9mIGEgR0xURi5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTUV4cHJlc3Npb25Mb2FkZXJQbHVnaW4gaW1wbGVtZW50cyBHTFRGTG9hZGVyUGx1Z2luIHtcbiAgcHVibGljIHN0YXRpYyByZWFkb25seSB2MHYxUHJlc2V0TmFtZU1hcDogeyBbdjBOYW1lIGluIFYwVlJNLkJsZW5kU2hhcGVQcmVzZXROYW1lXT86IFZSTUV4cHJlc3Npb25QcmVzZXROYW1lIH0gPSB7XG4gICAgYTogJ2FhJyxcbiAgICBlOiAnZWUnLFxuICAgIGk6ICdpaCcsXG4gICAgbzogJ29oJyxcbiAgICB1OiAnb3UnLFxuICAgIGJsaW5rOiAnYmxpbmsnLFxuICAgIGpveTogJ2hhcHB5JyxcbiAgICBhbmdyeTogJ2FuZ3J5JyxcbiAgICBzb3Jyb3c6ICdzYWQnLFxuICAgIGZ1bjogJ3JlbGF4ZWQnLFxuICAgIGxvb2t1cDogJ2xvb2tVcCcsXG4gICAgbG9va2Rvd246ICdsb29rRG93bicsXG4gICAgbG9va2xlZnQ6ICdsb29rTGVmdCcsXG4gICAgbG9va3JpZ2h0OiAnbG9va1JpZ2h0JyxcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uXG4gICAgYmxpbmtfbDogJ2JsaW5rTGVmdCcsXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvblxuICAgIGJsaW5rX3I6ICdibGlua1JpZ2h0JyxcbiAgICBuZXV0cmFsOiAnbmV1dHJhbCcsXG4gIH07XG5cbiAgcHVibGljIHJlYWRvbmx5IHBhcnNlcjogR0xURlBhcnNlcjtcblxuICBwdWJsaWMgZ2V0IG5hbWUoKTogc3RyaW5nIHtcbiAgICAvLyBXZSBzaG91bGQgdXNlIHRoZSBleHRlbnNpb24gbmFtZSBpbnN0ZWFkIGJ1dCB3ZSBoYXZlIG11bHRpcGxlIHBsdWdpbnMgZm9yIGFuIGV4dGVuc2lvbi4uLlxuICAgIHJldHVybiAnVlJNRXhwcmVzc2lvbkxvYWRlclBsdWdpbic7XG4gIH1cblxuICBwdWJsaWMgY29uc3RydWN0b3IocGFyc2VyOiBHTFRGUGFyc2VyKSB7XG4gICAgdGhpcy5wYXJzZXIgPSBwYXJzZXI7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgYWZ0ZXJSb290KGdsdGY6IEdMVEYpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBnbHRmLnVzZXJEYXRhLnZybUV4cHJlc3Npb25NYW5hZ2VyID0gYXdhaXQgdGhpcy5faW1wb3J0KGdsdGYpO1xuICB9XG5cbiAgLyoqXG4gICAqIEltcG9ydCBhIHtAbGluayBWUk1FeHByZXNzaW9uTWFuYWdlcn0gZnJvbSBhIFZSTS5cbiAgICpcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgcmVzdWx0IG9mIEdMVEYgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIF9pbXBvcnQoZ2x0ZjogR0xURik6IFByb21pc2U8VlJNRXhwcmVzc2lvbk1hbmFnZXIgfCBudWxsPiB7XG4gICAgY29uc3QgdjFSZXN1bHQgPSBhd2FpdCB0aGlzLl92MUltcG9ydChnbHRmKTtcbiAgICBpZiAodjFSZXN1bHQpIHtcbiAgICAgIHJldHVybiB2MVJlc3VsdDtcbiAgICB9XG5cbiAgICBjb25zdCB2MFJlc3VsdCA9IGF3YWl0IHRoaXMuX3YwSW1wb3J0KGdsdGYpO1xuICAgIGlmICh2MFJlc3VsdCkge1xuICAgICAgcmV0dXJuIHYwUmVzdWx0O1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBfdjFJbXBvcnQoZ2x0ZjogR0xURik6IFByb21pc2U8VlJNRXhwcmVzc2lvbk1hbmFnZXIgfCBudWxsPiB7XG4gICAgY29uc3QganNvbiA9IHRoaXMucGFyc2VyLmpzb24gYXMgR0xURlNjaGVtYS5JR0xURjtcblxuICAgIC8vIGVhcmx5IGFib3J0IGlmIGl0IGRvZXNuJ3QgdXNlIHZybVxuICAgIGNvbnN0IGlzVlJNVXNlZCA9IGpzb24uZXh0ZW5zaW9uc1VzZWQ/LmluZGV4T2YoJ1ZSTUNfdnJtJykgIT09IC0xO1xuICAgIGlmICghaXNWUk1Vc2VkKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBleHRlbnNpb24gPSBqc29uLmV4dGVuc2lvbnM/LlsnVlJNQ192cm0nXSBhcyBWMVZSTVNjaGVtYS5WUk1DVlJNIHwgdW5kZWZpbmVkO1xuICAgIGlmICghZXh0ZW5zaW9uKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBzcGVjVmVyc2lvbiA9IGV4dGVuc2lvbi5zcGVjVmVyc2lvbjtcbiAgICBpZiAoIVBPU1NJQkxFX1NQRUNfVkVSU0lPTlMuaGFzKHNwZWNWZXJzaW9uKSkge1xuICAgICAgY29uc29sZS53YXJuKGBWUk1FeHByZXNzaW9uTG9hZGVyUGx1Z2luOiBVbmtub3duIFZSTUNfdnJtIHNwZWNWZXJzaW9uIFwiJHtzcGVjVmVyc2lvbn1cImApO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgc2NoZW1hRXhwcmVzc2lvbnMgPSBleHRlbnNpb24uZXhwcmVzc2lvbnM7XG4gICAgaWYgKCFzY2hlbWFFeHByZXNzaW9ucykge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gbGlzdCBleHByZXNzaW9uc1xuICAgIGNvbnN0IHByZXNldE5hbWVTZXQgPSBuZXcgU2V0PHN0cmluZz4oT2JqZWN0LnZhbHVlcyhWUk1FeHByZXNzaW9uUHJlc2V0TmFtZSkpO1xuICAgIGNvbnN0IG5hbWVTY2hlbWFFeHByZXNzaW9uTWFwID0gbmV3IE1hcDxzdHJpbmcsIFYxVlJNU2NoZW1hLkV4cHJlc3Npb24+KCk7XG5cbiAgICBpZiAoc2NoZW1hRXhwcmVzc2lvbnMucHJlc2V0ICE9IG51bGwpIHtcbiAgICAgIE9iamVjdC5lbnRyaWVzKHNjaGVtYUV4cHJlc3Npb25zLnByZXNldCkuZm9yRWFjaCgoW25hbWUsIHNjaGVtYUV4cHJlc3Npb25dKSA9PiB7XG4gICAgICAgIGlmIChzY2hlbWFFeHByZXNzaW9uID09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gLy8gdHlwZXNjcmlwdFxuXG4gICAgICAgIGlmICghcHJlc2V0TmFtZVNldC5oYXMobmFtZSkpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFZSTUV4cHJlc3Npb25Mb2FkZXJQbHVnaW46IFVua25vd24gcHJlc2V0IG5hbWUgXCIke25hbWV9XCIgZGV0ZWN0ZWQuIElnbm9yaW5nIHRoZSBleHByZXNzaW9uYCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgbmFtZVNjaGVtYUV4cHJlc3Npb25NYXAuc2V0KG5hbWUsIHNjaGVtYUV4cHJlc3Npb24pO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHNjaGVtYUV4cHJlc3Npb25zLmN1c3RvbSAhPSBudWxsKSB7XG4gICAgICBPYmplY3QuZW50cmllcyhzY2hlbWFFeHByZXNzaW9ucy5jdXN0b20pLmZvckVhY2goKFtuYW1lLCBzY2hlbWFFeHByZXNzaW9uXSkgPT4ge1xuICAgICAgICBpZiAocHJlc2V0TmFtZVNldC5oYXMobmFtZSkpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICBgVlJNRXhwcmVzc2lvbkxvYWRlclBsdWdpbjogQ3VzdG9tIGV4cHJlc3Npb24gY2Fubm90IGhhdmUgcHJlc2V0IG5hbWUgXCIke25hbWV9XCIuIElnbm9yaW5nIHRoZSBleHByZXNzaW9uYCxcbiAgICAgICAgICApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIG5hbWVTY2hlbWFFeHByZXNzaW9uTWFwLnNldChuYW1lLCBzY2hlbWFFeHByZXNzaW9uKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIHByZXBhcmUgbWFuYWdlclxuICAgIGNvbnN0IG1hbmFnZXIgPSBuZXcgVlJNRXhwcmVzc2lvbk1hbmFnZXIoKTtcblxuICAgIC8vIGxvYWQgZXhwcmVzc2lvbnNcbiAgICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgIEFycmF5LmZyb20obmFtZVNjaGVtYUV4cHJlc3Npb25NYXAuZW50cmllcygpKS5tYXAoYXN5bmMgKFtuYW1lLCBzY2hlbWFFeHByZXNzaW9uXSkgPT4ge1xuICAgICAgICBjb25zdCBleHByZXNzaW9uID0gbmV3IFZSTUV4cHJlc3Npb24obmFtZSk7XG4gICAgICAgIGdsdGYuc2NlbmUuYWRkKGV4cHJlc3Npb24pO1xuXG4gICAgICAgIGV4cHJlc3Npb24uaXNCaW5hcnkgPSBzY2hlbWFFeHByZXNzaW9uLmlzQmluYXJ5ID8/IGZhbHNlO1xuICAgICAgICBleHByZXNzaW9uLm92ZXJyaWRlQmxpbmsgPSBzY2hlbWFFeHByZXNzaW9uLm92ZXJyaWRlQmxpbmsgPz8gJ25vbmUnO1xuICAgICAgICBleHByZXNzaW9uLm92ZXJyaWRlTG9va0F0ID0gc2NoZW1hRXhwcmVzc2lvbi5vdmVycmlkZUxvb2tBdCA/PyAnbm9uZSc7XG4gICAgICAgIGV4cHJlc3Npb24ub3ZlcnJpZGVNb3V0aCA9IHNjaGVtYUV4cHJlc3Npb24ub3ZlcnJpZGVNb3V0aCA/PyAnbm9uZSc7XG5cbiAgICAgICAgc2NoZW1hRXhwcmVzc2lvbi5tb3JwaFRhcmdldEJpbmRzPy5mb3JFYWNoKGFzeW5jIChiaW5kKSA9PiB7XG4gICAgICAgICAgaWYgKGJpbmQubm9kZSA9PT0gdW5kZWZpbmVkIHx8IGJpbmQuaW5kZXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHByaW1pdGl2ZXMgPSAoYXdhaXQgZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGUoZ2x0ZiwgYmluZC5ub2RlKSkhO1xuICAgICAgICAgIGNvbnN0IG1vcnBoVGFyZ2V0SW5kZXggPSBiaW5kLmluZGV4O1xuXG4gICAgICAgICAgLy8gY2hlY2sgaWYgdGhlIG1lc2ggaGFzIHRoZSB0YXJnZXQgbW9ycGggdGFyZ2V0XG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgIXByaW1pdGl2ZXMuZXZlcnkoXG4gICAgICAgICAgICAgIChwcmltaXRpdmUpID0+XG4gICAgICAgICAgICAgICAgQXJyYXkuaXNBcnJheShwcmltaXRpdmUubW9ycGhUYXJnZXRJbmZsdWVuY2VzKSAmJlxuICAgICAgICAgICAgICAgIG1vcnBoVGFyZ2V0SW5kZXggPCBwcmltaXRpdmUubW9ycGhUYXJnZXRJbmZsdWVuY2VzLmxlbmd0aCxcbiAgICAgICAgICAgIClcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICAgICAgYFZSTUV4cHJlc3Npb25Mb2FkZXJQbHVnaW46ICR7c2NoZW1hRXhwcmVzc2lvbi5uYW1lfSBhdHRlbXB0cyB0byBpbmRleCBtb3JwaCAjJHttb3JwaFRhcmdldEluZGV4fSBidXQgbm90IGZvdW5kLmAsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGV4cHJlc3Npb24uYWRkQmluZChcbiAgICAgICAgICAgIG5ldyBWUk1FeHByZXNzaW9uTW9ycGhUYXJnZXRCaW5kKHtcbiAgICAgICAgICAgICAgcHJpbWl0aXZlcyxcbiAgICAgICAgICAgICAgaW5kZXg6IG1vcnBoVGFyZ2V0SW5kZXgsXG4gICAgICAgICAgICAgIHdlaWdodDogYmluZC53ZWlnaHQgPz8gMS4wLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHNjaGVtYUV4cHJlc3Npb24ubWF0ZXJpYWxDb2xvckJpbmRzIHx8IHNjaGVtYUV4cHJlc3Npb24udGV4dHVyZVRyYW5zZm9ybUJpbmRzKSB7XG4gICAgICAgICAgLy8gbGlzdCB1cCBldmVyeSBtYXRlcmlhbCBpbiBgZ2x0Zi5zY2VuZWBcbiAgICAgICAgICBjb25zdCBnbHRmTWF0ZXJpYWxzOiBUSFJFRS5NYXRlcmlhbFtdID0gW107XG4gICAgICAgICAgZ2x0Zi5zY2VuZS50cmF2ZXJzZSgob2JqZWN0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBtYXRlcmlhbCA9IChvYmplY3QgYXMgYW55KS5tYXRlcmlhbCBhcyBUSFJFRS5NYXRlcmlhbCB8IFRIUkVFLk1hdGVyaWFsW10gfCB1bmRlZmluZWQ7XG4gICAgICAgICAgICBpZiAobWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkobWF0ZXJpYWwpKSB7XG4gICAgICAgICAgICAgICAgZ2x0Zk1hdGVyaWFscy5wdXNoKC4uLm1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBnbHRmTWF0ZXJpYWxzLnB1c2gobWF0ZXJpYWwpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBzY2hlbWFFeHByZXNzaW9uLm1hdGVyaWFsQ29sb3JCaW5kcz8uZm9yRWFjaChhc3luYyAoYmluZCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWxzID0gZ2x0Zk1hdGVyaWFscy5maWx0ZXIoKG1hdGVyaWFsKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsSW5kZXggPSB0aGlzLnBhcnNlci5hc3NvY2lhdGlvbnMuZ2V0KG1hdGVyaWFsKT8ubWF0ZXJpYWxzO1xuICAgICAgICAgICAgICByZXR1cm4gYmluZC5tYXRlcmlhbCA9PT0gbWF0ZXJpYWxJbmRleDtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBtYXRlcmlhbHMuZm9yRWFjaCgobWF0ZXJpYWwpID0+IHtcbiAgICAgICAgICAgICAgZXhwcmVzc2lvbi5hZGRCaW5kKFxuICAgICAgICAgICAgICAgIG5ldyBWUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvckJpbmQoe1xuICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwsXG4gICAgICAgICAgICAgICAgICB0eXBlOiBiaW5kLnR5cGUsXG4gICAgICAgICAgICAgICAgICB0YXJnZXRWYWx1ZTogbmV3IFRIUkVFLkNvbG9yKCkuZnJvbUFycmF5KGJpbmQudGFyZ2V0VmFsdWUpLFxuICAgICAgICAgICAgICAgICAgdGFyZ2V0QWxwaGE6IGJpbmQudGFyZ2V0VmFsdWVbM10sXG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIHNjaGVtYUV4cHJlc3Npb24udGV4dHVyZVRyYW5zZm9ybUJpbmRzPy5mb3JFYWNoKGFzeW5jIChiaW5kKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBtYXRlcmlhbHMgPSBnbHRmTWF0ZXJpYWxzLmZpbHRlcigobWF0ZXJpYWwpID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWxJbmRleCA9IHRoaXMucGFyc2VyLmFzc29jaWF0aW9ucy5nZXQobWF0ZXJpYWwpPy5tYXRlcmlhbHM7XG4gICAgICAgICAgICAgIHJldHVybiBiaW5kLm1hdGVyaWFsID09PSBtYXRlcmlhbEluZGV4O1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIG1hdGVyaWFscy5mb3JFYWNoKChtYXRlcmlhbCkgPT4ge1xuICAgICAgICAgICAgICBleHByZXNzaW9uLmFkZEJpbmQoXG4gICAgICAgICAgICAgICAgbmV3IFZSTUV4cHJlc3Npb25UZXh0dXJlVHJhbnNmb3JtQmluZCh7XG4gICAgICAgICAgICAgICAgICBtYXRlcmlhbCxcbiAgICAgICAgICAgICAgICAgIG9mZnNldDogbmV3IFRIUkVFLlZlY3RvcjIoKS5mcm9tQXJyYXkoYmluZC5vZmZzZXQgPz8gWzAuMCwgMC4wXSksXG4gICAgICAgICAgICAgICAgICBzY2FsZTogbmV3IFRIUkVFLlZlY3RvcjIoKS5mcm9tQXJyYXkoYmluZC5zY2FsZSA/PyBbMS4wLCAxLjBdKSxcbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgbWFuYWdlci5yZWdpc3RlckV4cHJlc3Npb24oZXhwcmVzc2lvbik7XG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgcmV0dXJuIG1hbmFnZXI7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIF92MEltcG9ydChnbHRmOiBHTFRGKTogUHJvbWlzZTxWUk1FeHByZXNzaW9uTWFuYWdlciB8IG51bGw+IHtcbiAgICBjb25zdCBqc29uID0gdGhpcy5wYXJzZXIuanNvbiBhcyBHTFRGU2NoZW1hLklHTFRGO1xuXG4gICAgLy8gZWFybHkgYWJvcnQgaWYgaXQgZG9lc24ndCB1c2UgdnJtXG4gICAgY29uc3QgdnJtRXh0ID0ganNvbi5leHRlbnNpb25zPy5WUk0gYXMgVjBWUk0uVlJNIHwgdW5kZWZpbmVkO1xuICAgIGlmICghdnJtRXh0KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBzY2hlbWFCbGVuZFNoYXBlID0gdnJtRXh0LmJsZW5kU2hhcGVNYXN0ZXI7XG4gICAgaWYgKCFzY2hlbWFCbGVuZFNoYXBlKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBtYW5hZ2VyID0gbmV3IFZSTUV4cHJlc3Npb25NYW5hZ2VyKCk7XG5cbiAgICBjb25zdCBzY2hlbWFCbGVuZFNoYXBlR3JvdXBzID0gc2NoZW1hQmxlbmRTaGFwZS5ibGVuZFNoYXBlR3JvdXBzO1xuICAgIGlmICghc2NoZW1hQmxlbmRTaGFwZUdyb3Vwcykge1xuICAgICAgcmV0dXJuIG1hbmFnZXI7XG4gICAgfVxuXG4gICAgY29uc3QgYmxlbmRTaGFwZU5hbWVTZXQgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgc2NoZW1hQmxlbmRTaGFwZUdyb3Vwcy5tYXAoYXN5bmMgKHNjaGVtYUdyb3VwKSA9PiB7XG4gICAgICAgIGNvbnN0IHYwUHJlc2V0TmFtZSA9IHNjaGVtYUdyb3VwLnByZXNldE5hbWU7XG4gICAgICAgIGNvbnN0IHYxUHJlc2V0TmFtZSA9XG4gICAgICAgICAgKHYwUHJlc2V0TmFtZSAhPSBudWxsICYmIFZSTUV4cHJlc3Npb25Mb2FkZXJQbHVnaW4udjB2MVByZXNldE5hbWVNYXBbdjBQcmVzZXROYW1lXSkgfHwgbnVsbDtcbiAgICAgICAgY29uc3QgbmFtZSA9IHYxUHJlc2V0TmFtZSA/PyBzY2hlbWFHcm91cC5uYW1lO1xuXG4gICAgICAgIGlmIChuYW1lID09IG51bGwpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oJ1ZSTUV4cHJlc3Npb25Mb2FkZXJQbHVnaW46IE9uZSBvZiBjdXN0b20gZXhwcmVzc2lvbnMgaGFzIG5vIG5hbWUuIElnbm9yaW5nIHRoZSBleHByZXNzaW9uJyk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZHVwbGljYXRpb24gY2hlY2tcbiAgICAgICAgaWYgKGJsZW5kU2hhcGVOYW1lU2V0LmhhcyhuYW1lKSkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICAgIGBWUk1FeHByZXNzaW9uTG9hZGVyUGx1Z2luOiBBbiBleHByZXNzaW9uIHByZXNldCAke3YwUHJlc2V0TmFtZX0gaGFzIGR1cGxpY2F0ZWQgZW50cmllcy4gSWdub3JpbmcgdGhlIGV4cHJlc3Npb25gLFxuICAgICAgICAgICk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgYmxlbmRTaGFwZU5hbWVTZXQuYWRkKG5hbWUpO1xuXG4gICAgICAgIGNvbnN0IGV4cHJlc3Npb24gPSBuZXcgVlJNRXhwcmVzc2lvbihuYW1lKTtcbiAgICAgICAgZ2x0Zi5zY2VuZS5hZGQoZXhwcmVzc2lvbik7XG5cbiAgICAgICAgZXhwcmVzc2lvbi5pc0JpbmFyeSA9IHNjaGVtYUdyb3VwLmlzQmluYXJ5ID8/IGZhbHNlO1xuICAgICAgICAvLyB2MCBkb2Vzbid0IGhhdmUgaWdub3JlIHByb3BlcnRpZXNcblxuICAgICAgICAvLyBCaW5kIG1vcnBoVGFyZ2V0XG4gICAgICAgIGlmIChzY2hlbWFHcm91cC5iaW5kcykge1xuICAgICAgICAgIHNjaGVtYUdyb3VwLmJpbmRzLmZvckVhY2goYXN5bmMgKGJpbmQpID0+IHtcbiAgICAgICAgICAgIGlmIChiaW5kLm1lc2ggPT09IHVuZGVmaW5lZCB8fCBiaW5kLmluZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBub2Rlc1VzaW5nTWVzaDogbnVtYmVyW10gPSBbXTtcbiAgICAgICAgICAgIGpzb24ubm9kZXM/LmZvckVhY2goKG5vZGUsIGkpID0+IHtcbiAgICAgICAgICAgICAgaWYgKG5vZGUubWVzaCA9PT0gYmluZC5tZXNoKSB7XG4gICAgICAgICAgICAgICAgbm9kZXNVc2luZ01lc2gucHVzaChpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGlmIChub2Rlc1VzaW5nTWVzaC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgICAgIGBWUk1FeHByZXNzaW9uTG9hZGVyUGx1Z2luOiAke3NjaGVtYUdyb3VwLm5hbWV9IGF0dGVtcHRzIHRvIGJpbmQgYSBtb3JwaCB0YXJnZXQgdG8gdGhlIG1lc2ggIyR7YmluZC5tZXNofSBidXQgdGhlIG1lc2ggaXMgbm90IGZvdW5kIG9yIG5vdCB1c2VkIGluIHRoZSBzY2VuZS4gSWdub3JpbmcgdGhlIGJpbmQuYCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBtb3JwaFRhcmdldEluZGV4ID0gYmluZC5pbmRleDtcblxuICAgICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgICAgICAgIG5vZGVzVXNpbmdNZXNoLm1hcChhc3luYyAobm9kZUluZGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcHJpbWl0aXZlcyA9IChhd2FpdCBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZShnbHRmLCBub2RlSW5kZXgpKSE7XG5cbiAgICAgICAgICAgICAgICAvLyBjaGVjayBpZiB0aGUgbWVzaCBoYXMgdGhlIHRhcmdldCBtb3JwaCB0YXJnZXRcbiAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAhcHJpbWl0aXZlcy5ldmVyeShcbiAgICAgICAgICAgICAgICAgICAgKHByaW1pdGl2ZSkgPT5cbiAgICAgICAgICAgICAgICAgICAgICBBcnJheS5pc0FycmF5KHByaW1pdGl2ZS5tb3JwaFRhcmdldEluZmx1ZW5jZXMpICYmXG4gICAgICAgICAgICAgICAgICAgICAgbW9ycGhUYXJnZXRJbmRleCA8IHByaW1pdGl2ZS5tb3JwaFRhcmdldEluZmx1ZW5jZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgICAgICAgICBgVlJNRXhwcmVzc2lvbkxvYWRlclBsdWdpbjogJHtzY2hlbWFHcm91cC5uYW1lfSBhdHRlbXB0cyB0byBpbmRleCAke21vcnBoVGFyZ2V0SW5kZXh9dGggbW9ycGggYnV0IG5vdCBmb3VuZC5gLFxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBleHByZXNzaW9uLmFkZEJpbmQoXG4gICAgICAgICAgICAgICAgICBuZXcgVlJNRXhwcmVzc2lvbk1vcnBoVGFyZ2V0QmluZCh7XG4gICAgICAgICAgICAgICAgICAgIHByaW1pdGl2ZXMsXG4gICAgICAgICAgICAgICAgICAgIGluZGV4OiBtb3JwaFRhcmdldEluZGV4LFxuICAgICAgICAgICAgICAgICAgICB3ZWlnaHQ6IDAuMDEgKiAoYmluZC53ZWlnaHQgPz8gMTAwKSwgLy8gbmFycm93aW5nIHRoZSByYW5nZSBmcm9tIFsgMC4wIC0gMTAwLjAgXSB0byBbIDAuMCAtIDEuMCBdXG4gICAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBCaW5kIE1hdGVyaWFsQ29sb3IgYW5kIFRleHR1cmVUcmFuc2Zvcm1cbiAgICAgICAgY29uc3QgbWF0ZXJpYWxWYWx1ZXMgPSBzY2hlbWFHcm91cC5tYXRlcmlhbFZhbHVlcztcbiAgICAgICAgaWYgKG1hdGVyaWFsVmFsdWVzICYmIG1hdGVyaWFsVmFsdWVzLmxlbmd0aCAhPT0gMCkge1xuICAgICAgICAgIG1hdGVyaWFsVmFsdWVzLmZvckVhY2goKG1hdGVyaWFsVmFsdWUpID0+IHtcbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgbWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbE5hbWUgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgICBtYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZSA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgICAgIG1hdGVyaWFsVmFsdWUudGFyZ2V0VmFsdWUgPT09IHVuZGVmaW5lZFxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBcdTMwQTJcdTMwRDBcdTMwQkZcdTMwRkNcdTMwNkVcdTMwQUFcdTMwRDZcdTMwQjhcdTMwQTdcdTMwQUZcdTMwQzhcdTMwNkJcdThBMkRcdTVCOUFcdTMwNTVcdTMwOENcdTMwNjZcdTMwNDRcdTMwOEJcdTMwREVcdTMwQzZcdTMwRUFcdTMwQTJcdTMwRUJcdTMwNkVcdTUxODVcdTMwNEJcdTMwODlcbiAgICAgICAgICAgICAqIG1hdGVyaWFsVmFsdWVcdTMwNjdcdTYzMDdcdTVCOUFcdTMwNTVcdTMwOENcdTMwNjZcdTMwNDRcdTMwOEJcdTMwREVcdTMwQzZcdTMwRUFcdTMwQTJcdTMwRUJcdTMwOTJcdTk2QzZcdTMwODFcdTMwOEJcdTMwMDJcbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBcdTcyNzlcdTVCOUFcdTMwNkJcdTMwNkZcdTU0MERcdTUyNERcdTMwOTJcdTRGN0ZcdTc1MjhcdTMwNTlcdTMwOEJcdTMwMDJcbiAgICAgICAgICAgICAqIFx1MzBBMlx1MzBBNlx1MzBDOFx1MzBFOVx1MzBBNFx1MzBGM1x1NjNDRlx1NzUzQlx1NzUyOFx1MzA2RVx1MzBERVx1MzBDNlx1MzBFQVx1MzBBMlx1MzBFQlx1MzA4Mlx1NTQwQ1x1NjY0Mlx1MzA2Qlx1OTZDNlx1MzA4MVx1MzA4Qlx1MzAwMlxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBjb25zdCBtYXRlcmlhbHM6IFRIUkVFLk1hdGVyaWFsW10gPSBbXTtcbiAgICAgICAgICAgIGdsdGYuc2NlbmUudHJhdmVyc2UoKG9iamVjdCkgPT4ge1xuICAgICAgICAgICAgICBpZiAoKG9iamVjdCBhcyBhbnkpLm1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsW10gfCBUSFJFRS5NYXRlcmlhbCA9IChvYmplY3QgYXMgYW55KS5tYXRlcmlhbDtcbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShtYXRlcmlhbCkpIHtcbiAgICAgICAgICAgICAgICAgIG1hdGVyaWFscy5wdXNoKFxuICAgICAgICAgICAgICAgICAgICAuLi5tYXRlcmlhbC5maWx0ZXIoXG4gICAgICAgICAgICAgICAgICAgICAgKG10bCkgPT5cbiAgICAgICAgICAgICAgICAgICAgICAgIChtdGwubmFtZSA9PT0gbWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbE5hbWUhIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG10bC5uYW1lID09PSBtYXRlcmlhbFZhbHVlLm1hdGVyaWFsTmFtZSEgKyAnIChPdXRsaW5lKScpICYmXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbHMuaW5kZXhPZihtdGwpID09PSAtMSxcbiAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtYXRlcmlhbC5uYW1lID09PSBtYXRlcmlhbFZhbHVlLm1hdGVyaWFsTmFtZSAmJiBtYXRlcmlhbHMuaW5kZXhPZihtYXRlcmlhbCkgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICBtYXRlcmlhbHMucHVzaChtYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWxQcm9wZXJ0eU5hbWUgPSBtYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZTtcbiAgICAgICAgICAgIG1hdGVyaWFscy5mb3JFYWNoKChtYXRlcmlhbCkgPT4ge1xuICAgICAgICAgICAgICAvLyBUZXh0dXJlVHJhbnNmb3JtQmluZFxuICAgICAgICAgICAgICBpZiAobWF0ZXJpYWxQcm9wZXJ0eU5hbWUgPT09ICdfTWFpblRleF9TVCcpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzY2FsZSA9IG5ldyBUSFJFRS5WZWN0b3IyKG1hdGVyaWFsVmFsdWUudGFyZ2V0VmFsdWUhWzBdLCBtYXRlcmlhbFZhbHVlLnRhcmdldFZhbHVlIVsxXSk7XG4gICAgICAgICAgICAgICAgY29uc3Qgb2Zmc2V0ID0gbmV3IFRIUkVFLlZlY3RvcjIobWF0ZXJpYWxWYWx1ZS50YXJnZXRWYWx1ZSFbMl0sIG1hdGVyaWFsVmFsdWUudGFyZ2V0VmFsdWUhWzNdKTtcblxuICAgICAgICAgICAgICAgIG9mZnNldC55ID0gMS4wIC0gb2Zmc2V0LnkgLSBzY2FsZS55O1xuXG4gICAgICAgICAgICAgICAgZXhwcmVzc2lvbi5hZGRCaW5kKFxuICAgICAgICAgICAgICAgICAgbmV3IFZSTUV4cHJlc3Npb25UZXh0dXJlVHJhbnNmb3JtQmluZCh7XG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLFxuICAgICAgICAgICAgICAgICAgICBzY2FsZSxcbiAgICAgICAgICAgICAgICAgICAgb2Zmc2V0LFxuICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vIE1hdGVyaWFsQ29sb3JCaW5kXG4gICAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsQ29sb3JUeXBlID0gdjBFeHByZXNzaW9uTWF0ZXJpYWxDb2xvck1hcFttYXRlcmlhbFByb3BlcnR5TmFtZV07XG4gICAgICAgICAgICAgIGlmIChtYXRlcmlhbENvbG9yVHlwZSkge1xuICAgICAgICAgICAgICAgIGV4cHJlc3Npb24uYWRkQmluZChcbiAgICAgICAgICAgICAgICAgIG5ldyBWUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvckJpbmQoe1xuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbCxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogbWF0ZXJpYWxDb2xvclR5cGUsXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoKS5mcm9tQXJyYXkobWF0ZXJpYWxWYWx1ZS50YXJnZXRWYWx1ZSEpLFxuICAgICAgICAgICAgICAgICAgICB0YXJnZXRBbHBoYTogbWF0ZXJpYWxWYWx1ZS50YXJnZXRWYWx1ZSFbM10sXG4gICAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc29sZS53YXJuKG1hdGVyaWFsUHJvcGVydHlOYW1lICsgJyBpcyBub3Qgc3VwcG9ydGVkJyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1hbmFnZXIucmVnaXN0ZXJFeHByZXNzaW9uKGV4cHJlc3Npb24pO1xuICAgICAgfSksXG4gICAgKTtcblxuICAgIHJldHVybiBtYW5hZ2VyO1xuICB9XG59XG4iLCAiaW1wb3J0IHR5cGUgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgdHlwZSB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcbmltcG9ydCB7IEdMVEYgYXMgR0xURlNjaGVtYSB9IGZyb20gJ0BnbHRmLXRyYW5zZm9ybS9jb3JlJztcblxuZnVuY3Rpb24gZXh0cmFjdFByaW1pdGl2ZXNJbnRlcm5hbChnbHRmOiBHTFRGLCBub2RlSW5kZXg6IG51bWJlciwgbm9kZTogVEhSRUUuT2JqZWN0M0QpOiBUSFJFRS5NZXNoW10gfCBudWxsIHtcbiAgY29uc3QganNvbiA9IGdsdGYucGFyc2VyLmpzb24gYXMgR0xURlNjaGVtYS5JR0xURjtcblxuICAvKipcbiAgICogTGV0J3MgbGlzdCB1cCBldmVyeSBwb3NzaWJsZSBwYXR0ZXJucyB0aGF0IHBhcnNlZCBnbHRmIG5vZGVzIHdpdGggYSBtZXNoIGNhbiBoYXZlLCwsXG4gICAqXG4gICAqIFwiKlwiIGluZGljYXRlcyB0aGF0IHRob3NlIG1lc2hlcyBzaG91bGQgYmUgbGlzdGVkIHVwIHVzaW5nIHRoaXMgZnVuY3Rpb25cbiAgICpcbiAgICogIyMjIEEgbm9kZSB3aXRoIGEgKG1lc2gsIGEgc2lnbmxlIHByaW1pdGl2ZSlcbiAgICpcbiAgICogLSBgVEhSRUUuTWVzaGA6IFRoZSBvbmx5IHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAqXG4gICAqXG4gICAqICMjIyBBIG5vZGUgd2l0aCBhIChtZXNoLCBtdWx0aXBsZSBwcmltaXRpdmVzKVxuICAgKlxuICAgKiAtIGBUSFJFRS5Hcm91cGA6IFRoZSByb290IG9mIHRoZSBtZXNoXG4gICAqICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICpcbiAgICogICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKDIpICpcbiAgICpcbiAgICogIyMjIEEgbm9kZSB3aXRoIGEgKG1lc2gsIG11bHRpcGxlIHByaW1pdGl2ZXMpIEFORCAoYSBjaGlsZCB3aXRoIGEgbWVzaCwgYSBzaW5nbGUgcHJpbWl0aXZlKVxuICAgKlxuICAgKiAtIGBUSFJFRS5Hcm91cGA6IFRoZSByb290IG9mIHRoZSBtZXNoXG4gICAqICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICpcbiAgICogICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKDIpICpcbiAgICogICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgYSBNRVNIIE9GIFRIRSBDSElMRFxuICAgKlxuICAgKiAjIyMgQSBub2RlIHdpdGggYSAobWVzaCwgbXVsdGlwbGUgcHJpbWl0aXZlcykgQU5EIChhIGNoaWxkIHdpdGggYSBtZXNoLCBtdWx0aXBsZSBwcmltaXRpdmVzKVxuICAgKlxuICAgKiAtIGBUSFJFRS5Hcm91cGA6IFRoZSByb290IG9mIHRoZSBtZXNoXG4gICAqICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICpcbiAgICogICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKDIpICpcbiAgICogICAtIGBUSFJFRS5Hcm91cGA6IFRoZSByb290IG9mIGEgTUVTSCBPRiBUSEUgQ0hJTERcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCBvZiB0aGUgY2hpbGRcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCBvZiB0aGUgY2hpbGQgKDIpXG4gICAqXG4gICAqICMjIyBBIG5vZGUgd2l0aCBhIChtZXNoLCBtdWx0aXBsZSBwcmltaXRpdmVzKSBCVVQgdGhlIG5vZGUgaXMgYSBib25lXG4gICAqXG4gICAqIC0gYFRIUkVFLkJvbmVgOiBUaGUgcm9vdCBvZiB0aGUgbm9kZSwgYXMgYSBib25lXG4gICAqICAgLSBgVEhSRUUuR3JvdXBgOiBUaGUgcm9vdCBvZiB0aGUgbWVzaFxuICAgKiAgICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICpcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAoMikgKlxuICAgKlxuICAgKiAjIyMgQSBub2RlIHdpdGggYSAobWVzaCwgbXVsdGlwbGUgcHJpbWl0aXZlcykgQU5EIChhIGNoaWxkIHdpdGggYSBtZXNoLCBtdWx0aXBsZSBwcmltaXRpdmVzKSBCVVQgdGhlIG5vZGUgaXMgYSBib25lXG4gICAqXG4gICAqIC0gYFRIUkVFLkJvbmVgOiBUaGUgcm9vdCBvZiB0aGUgbm9kZSwgYXMgYSBib25lXG4gICAqICAgLSBgVEhSRUUuR3JvdXBgOiBUaGUgcm9vdCBvZiB0aGUgbWVzaFxuICAgKiAgICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICpcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAoMikgKlxuICAgKiAgIC0gYFRIUkVFLkdyb3VwYDogVGhlIHJvb3Qgb2YgYSBNRVNIIE9GIFRIRSBDSElMRFxuICAgKiAgICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoIG9mIHRoZSBjaGlsZFxuICAgKiAgICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoIG9mIHRoZSBjaGlsZCAoMilcbiAgICpcbiAgICogLi4uSSB3aWxsIHRha2UgYSBzdHJhdGVneSB0aGF0IHRyYXZlcnNlcyB0aGUgcm9vdCBvZiB0aGUgbm9kZSBhbmQgdGFrZSBmaXJzdCAocHJpbWl0aXZlQ291bnQpIG1lc2hlcy5cbiAgICovXG5cbiAgLy8gTWFrZSBzdXJlIHRoYXQgdGhlIG5vZGUgaGFzIGEgbWVzaFxuICBjb25zdCBzY2hlbWFOb2RlID0ganNvbi5ub2Rlcz8uW25vZGVJbmRleF07XG4gIGlmIChzY2hlbWFOb2RlID09IG51bGwpIHtcbiAgICBjb25zb2xlLndhcm4oYGV4dHJhY3RQcmltaXRpdmVzSW50ZXJuYWw6IEF0dGVtcHQgdG8gdXNlIG5vZGVzWyR7bm9kZUluZGV4fV0gb2YgZ2xURiBidXQgdGhlIG5vZGUgZG9lc24ndCBleGlzdGApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgbWVzaEluZGV4ID0gc2NoZW1hTm9kZS5tZXNoO1xuICBpZiAobWVzaEluZGV4ID09IG51bGwpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIEhvdyBtYW55IHByaW1pdGl2ZXMgdGhlIG1lc2ggaGFzP1xuICBjb25zdCBzY2hlbWFNZXNoID0ganNvbi5tZXNoZXM/LlttZXNoSW5kZXhdO1xuICBpZiAoc2NoZW1hTWVzaCA9PSBudWxsKSB7XG4gICAgY29uc29sZS53YXJuKGBleHRyYWN0UHJpbWl0aXZlc0ludGVybmFsOiBBdHRlbXB0IHRvIHVzZSBtZXNoZXNbJHttZXNoSW5kZXh9XSBvZiBnbFRGIGJ1dCB0aGUgbWVzaCBkb2Vzbid0IGV4aXN0YCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBwcmltaXRpdmVDb3VudCA9IHNjaGVtYU1lc2gucHJpbWl0aXZlcy5sZW5ndGg7XG5cbiAgLy8gVHJhdmVyc2UgdGhlIG5vZGUgYW5kIHRha2UgZmlyc3QgKHByaW1pdGl2ZUNvdW50KSBtZXNoZXNcbiAgY29uc3QgcHJpbWl0aXZlczogVEhSRUUuTWVzaFtdID0gW107XG4gIG5vZGUudHJhdmVyc2UoKG9iamVjdCkgPT4ge1xuICAgIGlmIChwcmltaXRpdmVzLmxlbmd0aCA8IHByaW1pdGl2ZUNvdW50KSB7XG4gICAgICBpZiAoKG9iamVjdCBhcyBhbnkpLmlzTWVzaCkge1xuICAgICAgICBwcmltaXRpdmVzLnB1c2gob2JqZWN0IGFzIFRIUkVFLk1lc2gpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHByaW1pdGl2ZXM7XG59XG5cbi8qKlxuICogRXh0cmFjdCBwcmltaXRpdmVzICggYFRIUkVFLk1lc2hbXWAgKSBvZiBhIG5vZGUgZnJvbSBhIGxvYWRlZCBHTFRGLlxuICogVGhlIG1haW4gcHVycG9zZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIHRvIGRpc3Rpbmd1aXNoIHByaW1pdGl2ZXMgYW5kIGNoaWxkcmVuIGZyb20gYSBub2RlIHRoYXQgaGFzIGJvdGggbWVzaGVzIGFuZCBjaGlsZHJlbi5cbiAqXG4gKiBJdCB1dGlsaXplcyB0aGUgYmVoYXZpb3IgdGhhdCBHTFRGTG9hZGVyIGFkZHMgbWVzaCBwcmltaXRpdmVzIHRvIHRoZSBub2RlIG9iamVjdCAoIGBUSFJFRS5Hcm91cGAgKSBmaXJzdCB0aGVuIGFkZHMgaXRzIGNoaWxkcmVuLlxuICpcbiAqIEBwYXJhbSBnbHRmIEEgR0xURiBvYmplY3QgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXG4gKiBAcGFyYW0gbm9kZUluZGV4IFRoZSBpbmRleCBvZiB0aGUgbm9kZVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGUoZ2x0ZjogR0xURiwgbm9kZUluZGV4OiBudW1iZXIpOiBQcm9taXNlPFRIUkVFLk1lc2hbXSB8IG51bGw+IHtcbiAgY29uc3Qgbm9kZTogVEhSRUUuT2JqZWN0M0QgPSBhd2FpdCBnbHRmLnBhcnNlci5nZXREZXBlbmRlbmN5KCdub2RlJywgbm9kZUluZGV4KTtcbiAgcmV0dXJuIGV4dHJhY3RQcmltaXRpdmVzSW50ZXJuYWwoZ2x0Ziwgbm9kZUluZGV4LCBub2RlKTtcbn1cblxuLyoqXG4gKiBFeHRyYWN0IHByaW1pdGl2ZXMgKCBgVEhSRUUuTWVzaFtdYCApIG9mIG5vZGVzIGZyb20gYSBsb2FkZWQgR0xURi5cbiAqIFNlZSB7QGxpbmsgZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGV9IGZvciBtb3JlIGRldGFpbHMuXG4gKlxuICogSXQgcmV0dXJucyBhIG1hcCBmcm9tIG5vZGUgaW5kZXggdG8gZXh0cmFjdGlvbiByZXN1bHQuXG4gKiBJZiBhIG5vZGUgZG9lcyBub3QgaGF2ZSBhIG1lc2gsIHRoZSBlbnRyeSBmb3IgdGhlIG5vZGUgd2lsbCBub3QgYmUgcHV0IGluIHRoZSByZXR1cm5pbmcgbWFwLlxuICpcbiAqIEBwYXJhbSBnbHRmIEEgR0xURiBvYmplY3QgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZXMoZ2x0ZjogR0xURik6IFByb21pc2U8TWFwPG51bWJlciwgVEhSRUUuTWVzaFtdPj4ge1xuICBjb25zdCBub2RlczogVEhSRUUuT2JqZWN0M0RbXSA9IGF3YWl0IGdsdGYucGFyc2VyLmdldERlcGVuZGVuY2llcygnbm9kZScpO1xuICBjb25zdCBtYXAgPSBuZXcgTWFwPG51bWJlciwgVEhSRUUuTWVzaFtdPigpO1xuXG4gIG5vZGVzLmZvckVhY2goKG5vZGUsIGluZGV4KSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gZXh0cmFjdFByaW1pdGl2ZXNJbnRlcm5hbChnbHRmLCBpbmRleCwgbm9kZSk7XG4gICAgaWYgKHJlc3VsdCAhPSBudWxsKSB7XG4gICAgICBtYXAuc2V0KGluZGV4LCByZXN1bHQpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIG1hcDtcbn1cbiIsICIvKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb24gKi9cblxuZXhwb3J0IGNvbnN0IFZSTUV4cHJlc3Npb25QcmVzZXROYW1lID0ge1xuICBBYTogJ2FhJyxcbiAgSWg6ICdpaCcsXG4gIE91OiAnb3UnLFxuICBFZTogJ2VlJyxcbiAgT2g6ICdvaCcsXG4gIEJsaW5rOiAnYmxpbmsnLFxuICBIYXBweTogJ2hhcHB5JyxcbiAgQW5ncnk6ICdhbmdyeScsXG4gIFNhZDogJ3NhZCcsXG4gIFJlbGF4ZWQ6ICdyZWxheGVkJyxcbiAgTG9va1VwOiAnbG9va1VwJyxcbiAgU3VycHJpc2VkOiAnc3VycHJpc2VkJyxcbiAgTG9va0Rvd246ICdsb29rRG93bicsXG4gIExvb2tMZWZ0OiAnbG9va0xlZnQnLFxuICBMb29rUmlnaHQ6ICdsb29rUmlnaHQnLFxuICBCbGlua0xlZnQ6ICdibGlua0xlZnQnLFxuICBCbGlua1JpZ2h0OiAnYmxpbmtSaWdodCcsXG4gIE5ldXRyYWw6ICduZXV0cmFsJyxcbn0gYXMgY29uc3Q7XG5cbmV4cG9ydCB0eXBlIFZSTUV4cHJlc3Npb25QcmVzZXROYW1lID0gKHR5cGVvZiBWUk1FeHByZXNzaW9uUHJlc2V0TmFtZSlba2V5b2YgdHlwZW9mIFZSTUV4cHJlc3Npb25QcmVzZXROYW1lXTtcbiIsICIvKipcbiAqIENsYW1wIHRoZSBpbnB1dCB2YWx1ZSB3aXRoaW4gWzAuMCAtIDEuMF0uXG4gKlxuICogQHBhcmFtIHZhbHVlIFRoZSBpbnB1dCB2YWx1ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gc2F0dXJhdGUodmFsdWU6IG51bWJlcik6IG51bWJlciB7XG4gIHJldHVybiBNYXRoLm1heChNYXRoLm1pbih2YWx1ZSwgMS4wKSwgMC4wKTtcbn1cbiIsICJpbXBvcnQgeyBWUk1FeHByZXNzaW9uUHJlc2V0TmFtZSB9IGZyb20gJy4vVlJNRXhwcmVzc2lvblByZXNldE5hbWUnO1xuaW1wb3J0IHsgc2F0dXJhdGUgfSBmcm9tICcuLi91dGlscy9zYXR1cmF0ZSc7XG5pbXBvcnQgdHlwZSB7IFZSTUV4cHJlc3Npb24gfSBmcm9tICcuL1ZSTUV4cHJlc3Npb24nO1xuXG5leHBvcnQgY2xhc3MgVlJNRXhwcmVzc2lvbk1hbmFnZXIge1xuICAvKipcbiAgICogQSBzZXQgb2YgbmFtZSBvciBwcmVzZXQgbmFtZSBvZiBleHByZXNzaW9ucyB0aGF0IHdpbGwgYmUgb3ZlcnJpZGRlbiBieSB7QGxpbmsgVlJNRXhwcmVzc2lvbi5vdmVycmlkZUJsaW5rfS5cbiAgICovXG4gIHB1YmxpYyBibGlua0V4cHJlc3Npb25OYW1lcyA9IFsnYmxpbmsnLCAnYmxpbmtMZWZ0JywgJ2JsaW5rUmlnaHQnXTtcblxuICAvKipcbiAgICogQSBzZXQgb2YgbmFtZSBvciBwcmVzZXQgbmFtZSBvZiBleHByZXNzaW9ucyB0aGF0IHdpbGwgYmUgb3ZlcnJpZGRlbiBieSB7QGxpbmsgVlJNRXhwcmVzc2lvbi5vdmVycmlkZUxvb2tBdH0uXG4gICAqL1xuICBwdWJsaWMgbG9va0F0RXhwcmVzc2lvbk5hbWVzID0gWydsb29rTGVmdCcsICdsb29rUmlnaHQnLCAnbG9va1VwJywgJ2xvb2tEb3duJ107XG5cbiAgLyoqXG4gICAqIEEgc2V0IG9mIG5hbWUgb3IgcHJlc2V0IG5hbWUgb2YgZXhwcmVzc2lvbnMgdGhhdCB3aWxsIGJlIG92ZXJyaWRkZW4gYnkge0BsaW5rIFZSTUV4cHJlc3Npb24ub3ZlcnJpZGVNb3V0aH0uXG4gICAqL1xuICBwdWJsaWMgbW91dGhFeHByZXNzaW9uTmFtZXMgPSBbJ2FhJywgJ2VlJywgJ2loJywgJ29oJywgJ291J107XG5cbiAgLyoqXG4gICAqIEEgc2V0IG9mIHtAbGluayBWUk1FeHByZXNzaW9ufS5cbiAgICogV2hlbiB5b3Ugd2FudCB0byByZWdpc3RlciBleHByZXNzaW9ucywgdXNlIHtAbGluayByZWdpc3RlckV4cHJlc3Npb259XG4gICAqL1xuICBwcml2YXRlIF9leHByZXNzaW9uczogVlJNRXhwcmVzc2lvbltdID0gW107XG4gIHB1YmxpYyBnZXQgZXhwcmVzc2lvbnMoKTogVlJNRXhwcmVzc2lvbltdIHtcbiAgICByZXR1cm4gdGhpcy5fZXhwcmVzc2lvbnMuY29uY2F0KCk7XG4gIH1cblxuICAvKipcbiAgICogQSBtYXAgZnJvbSBuYW1lIHRvIGV4cHJlc3Npb24uXG4gICAqL1xuICBwcml2YXRlIF9leHByZXNzaW9uTWFwOiB7IFtuYW1lOiBzdHJpbmddOiBWUk1FeHByZXNzaW9uIH0gPSB7fTtcbiAgcHVibGljIGdldCBleHByZXNzaW9uTWFwKCk6IHsgW25hbWU6IHN0cmluZ106IFZSTUV4cHJlc3Npb24gfSB7XG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oe30sIHRoaXMuX2V4cHJlc3Npb25NYXApO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgbWFwIGZyb20gbmFtZSB0byBleHByZXNzaW9uLCBidXQgZXhjbHVkaW5nIGN1c3RvbSBleHByZXNzaW9ucy5cbiAgICovXG4gIHB1YmxpYyBnZXQgcHJlc2V0RXhwcmVzc2lvbk1hcCgpOiB7IFtuYW1lIGluIFZSTUV4cHJlc3Npb25QcmVzZXROYW1lXT86IFZSTUV4cHJlc3Npb24gfSB7XG4gICAgY29uc3QgcmVzdWx0OiB7IFtuYW1lIGluIFZSTUV4cHJlc3Npb25QcmVzZXROYW1lXT86IFZSTUV4cHJlc3Npb24gfSA9IHt9O1xuXG4gICAgY29uc3QgcHJlc2V0TmFtZVNldCA9IG5ldyBTZXQ8c3RyaW5nPihPYmplY3QudmFsdWVzKFZSTUV4cHJlc3Npb25QcmVzZXROYW1lKSk7XG5cbiAgICBPYmplY3QuZW50cmllcyh0aGlzLl9leHByZXNzaW9uTWFwKS5mb3JFYWNoKChbbmFtZSwgZXhwcmVzc2lvbl0pID0+IHtcbiAgICAgIGlmIChwcmVzZXROYW1lU2V0LmhhcyhuYW1lKSkge1xuICAgICAgICByZXN1bHRbbmFtZSBhcyBWUk1FeHByZXNzaW9uUHJlc2V0TmFtZV0gPSBleHByZXNzaW9uO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBIG1hcCBmcm9tIG5hbWUgdG8gZXhwcmVzc2lvbiwgYnV0IGV4Y2x1ZGluZyBwcmVzZXQgZXhwcmVzc2lvbnMuXG4gICAqL1xuICBwdWJsaWMgZ2V0IGN1c3RvbUV4cHJlc3Npb25NYXAoKTogeyBbbmFtZTogc3RyaW5nXTogVlJNRXhwcmVzc2lvbiB9IHtcbiAgICBjb25zdCByZXN1bHQ6IHsgW25hbWU6IHN0cmluZ106IFZSTUV4cHJlc3Npb24gfSA9IHt9O1xuXG4gICAgY29uc3QgcHJlc2V0TmFtZVNldCA9IG5ldyBTZXQ8c3RyaW5nPihPYmplY3QudmFsdWVzKFZSTUV4cHJlc3Npb25QcmVzZXROYW1lKSk7XG5cbiAgICBPYmplY3QuZW50cmllcyh0aGlzLl9leHByZXNzaW9uTWFwKS5mb3JFYWNoKChbbmFtZSwgZXhwcmVzc2lvbl0pID0+IHtcbiAgICAgIGlmICghcHJlc2V0TmFtZVNldC5oYXMobmFtZSkpIHtcbiAgICAgICAgcmVzdWx0W25hbWVdID0gZXhwcmVzc2lvbjtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IHtAbGluayBWUk1FeHByZXNzaW9uTWFuYWdlcn0uXG4gICAqL1xuICBwdWJsaWMgY29uc3RydWN0b3IoKSB7XG4gICAgLy8gZG8gbm90aGluZ1xuICB9XG5cbiAgLyoqXG4gICAqIENvcHkgdGhlIGdpdmVuIHtAbGluayBWUk1FeHByZXNzaW9uTWFuYWdlcn0gaW50byB0aGlzIG9uZS5cbiAgICogQHBhcmFtIHNvdXJjZSBUaGUge0BsaW5rIFZSTUV4cHJlc3Npb25NYW5hZ2VyfSB5b3Ugd2FudCB0byBjb3B5XG4gICAqIEByZXR1cm5zIHRoaXNcbiAgICovXG4gIHB1YmxpYyBjb3B5KHNvdXJjZTogVlJNRXhwcmVzc2lvbk1hbmFnZXIpOiB0aGlzIHtcbiAgICAvLyBmaXJzdCB1bnJlZ2lzdGVyIGFsbCB0aGUgZXhwcmVzc2lvbiBpdCBoYXNcbiAgICBjb25zdCBleHByZXNzaW9ucyA9IHRoaXMuX2V4cHJlc3Npb25zLmNvbmNhdCgpO1xuICAgIGV4cHJlc3Npb25zLmZvckVhY2goKGV4cHJlc3Npb24pID0+IHtcbiAgICAgIHRoaXMudW5yZWdpc3RlckV4cHJlc3Npb24oZXhwcmVzc2lvbik7XG4gICAgfSk7XG5cbiAgICAvLyB0aGVuIHJlZ2lzdGVyIGFsbCB0aGUgZXhwcmVzc2lvbiBvZiB0aGUgc291cmNlXG4gICAgc291cmNlLl9leHByZXNzaW9ucy5mb3JFYWNoKChleHByZXNzaW9uKSA9PiB7XG4gICAgICB0aGlzLnJlZ2lzdGVyRXhwcmVzc2lvbihleHByZXNzaW9uKTtcbiAgICB9KTtcblxuICAgIC8vIGNvcHkgcmVtYWluaW5nIG1lbWJlcnNcbiAgICB0aGlzLmJsaW5rRXhwcmVzc2lvbk5hbWVzID0gc291cmNlLmJsaW5rRXhwcmVzc2lvbk5hbWVzLmNvbmNhdCgpO1xuICAgIHRoaXMubG9va0F0RXhwcmVzc2lvbk5hbWVzID0gc291cmNlLmxvb2tBdEV4cHJlc3Npb25OYW1lcy5jb25jYXQoKTtcbiAgICB0aGlzLm1vdXRoRXhwcmVzc2lvbk5hbWVzID0gc291cmNlLm1vdXRoRXhwcmVzc2lvbk5hbWVzLmNvbmNhdCgpO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhIGNsb25lIG9mIHRoaXMge0BsaW5rIFZSTUV4cHJlc3Npb25NYW5hZ2VyfS5cbiAgICogQHJldHVybnMgQ29waWVkIHtAbGluayBWUk1FeHByZXNzaW9uTWFuYWdlcn1cbiAgICovXG4gIHB1YmxpYyBjbG9uZSgpOiBWUk1FeHByZXNzaW9uTWFuYWdlciB7XG4gICAgcmV0dXJuIG5ldyBWUk1FeHByZXNzaW9uTWFuYWdlcigpLmNvcHkodGhpcyk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIGEgcmVnaXN0ZXJlZCBleHByZXNzaW9uLlxuICAgKiBJZiBpdCBjYW5ub3QgZmluZCBhbiBleHByZXNzaW9uLCBpdCB3aWxsIHJldHVybiBgbnVsbGAgaW5zdGVhZC5cbiAgICpcbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvciBwcmVzZXQgbmFtZSBvZiB0aGUgZXhwcmVzc2lvblxuICAgKi9cbiAgcHVibGljIGdldEV4cHJlc3Npb24obmFtZTogVlJNRXhwcmVzc2lvblByZXNldE5hbWUgfCBzdHJpbmcpOiBWUk1FeHByZXNzaW9uIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX2V4cHJlc3Npb25NYXBbbmFtZV0gPz8gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhbiBleHByZXNzaW9uLlxuICAgKlxuICAgKiBAcGFyYW0gZXhwcmVzc2lvbiB7QGxpbmsgVlJNRXhwcmVzc2lvbn0gdGhhdCBkZXNjcmliZXMgdGhlIGV4cHJlc3Npb25cbiAgICovXG4gIHB1YmxpYyByZWdpc3RlckV4cHJlc3Npb24oZXhwcmVzc2lvbjogVlJNRXhwcmVzc2lvbik6IHZvaWQge1xuICAgIHRoaXMuX2V4cHJlc3Npb25zLnB1c2goZXhwcmVzc2lvbik7XG4gICAgdGhpcy5fZXhwcmVzc2lvbk1hcFtleHByZXNzaW9uLmV4cHJlc3Npb25OYW1lXSA9IGV4cHJlc3Npb247XG4gIH1cblxuICAvKipcbiAgICogVW5yZWdpc3RlciBhbiBleHByZXNzaW9uLlxuICAgKlxuICAgKiBAcGFyYW0gZXhwcmVzc2lvbiBUaGUgZXhwcmVzc2lvbiB5b3Ugd2FudCB0byB1bnJlZ2lzdGVyXG4gICAqL1xuICBwdWJsaWMgdW5yZWdpc3RlckV4cHJlc3Npb24oZXhwcmVzc2lvbjogVlJNRXhwcmVzc2lvbik6IHZvaWQge1xuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5fZXhwcmVzc2lvbnMuaW5kZXhPZihleHByZXNzaW9uKTtcbiAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICBjb25zb2xlLndhcm4oJ1ZSTUV4cHJlc3Npb25NYW5hZ2VyOiBUaGUgc3BlY2lmaWVkIGV4cHJlc3Npb25zIGlzIG5vdCByZWdpc3RlcmVkJyk7XG4gICAgfVxuXG4gICAgdGhpcy5fZXhwcmVzc2lvbnMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICBkZWxldGUgdGhpcy5fZXhwcmVzc2lvbk1hcFtleHByZXNzaW9uLmV4cHJlc3Npb25OYW1lXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIGN1cnJlbnQgd2VpZ2h0IG9mIHRoZSBzcGVjaWZpZWQgZXhwcmVzc2lvbi5cbiAgICogSWYgaXQgZG9lc24ndCBoYXZlIGFuIGV4cHJlc3Npb24gb2YgZ2l2ZW4gbmFtZSwgaXQgd2lsbCByZXR1cm4gYG51bGxgIGluc3RlYWQuXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGV4cHJlc3Npb25cbiAgICovXG4gIHB1YmxpYyBnZXRWYWx1ZShuYW1lOiBWUk1FeHByZXNzaW9uUHJlc2V0TmFtZSB8IHN0cmluZyk6IG51bWJlciB8IG51bGwge1xuICAgIGNvbnN0IGV4cHJlc3Npb24gPSB0aGlzLmdldEV4cHJlc3Npb24obmFtZSk7XG4gICAgcmV0dXJuIGV4cHJlc3Npb24/LndlaWdodCA/PyBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCBhIHdlaWdodCB0byB0aGUgc3BlY2lmaWVkIGV4cHJlc3Npb24uXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGV4cHJlc3Npb25cbiAgICogQHBhcmFtIHdlaWdodCBXZWlnaHRcbiAgICovXG4gIHB1YmxpYyBzZXRWYWx1ZShuYW1lOiBWUk1FeHByZXNzaW9uUHJlc2V0TmFtZSB8IHN0cmluZywgd2VpZ2h0OiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCBleHByZXNzaW9uID0gdGhpcy5nZXRFeHByZXNzaW9uKG5hbWUpO1xuICAgIGlmIChleHByZXNzaW9uKSB7XG4gICAgICBleHByZXNzaW9uLndlaWdodCA9IHNhdHVyYXRlKHdlaWdodCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlc2V0IHdlaWdodHMgb2YgYWxsIGV4cHJlc3Npb25zIHRvIGAwLjBgLlxuICAgKi9cbiAgcHVibGljIHJlc2V0VmFsdWVzKCk6IHZvaWQge1xuICAgIHRoaXMuX2V4cHJlc3Npb25zLmZvckVhY2goKGV4cHJlc3Npb24pID0+IHtcbiAgICAgIGV4cHJlc3Npb24ud2VpZ2h0ID0gMC4wO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhIHRyYWNrIG5hbWUgb2Ygc3BlY2lmaWVkIGV4cHJlc3Npb24uXG4gICAqIFRoaXMgdHJhY2sgbmFtZSBpcyBuZWVkZWQgdG8gbWFuaXB1bGF0ZSBpdHMgZXhwcmVzc2lvbiB2aWEga2V5ZnJhbWUgYW5pbWF0aW9ucy5cbiAgICpcbiAgICogQGV4YW1wbGUgTWFuaXB1bGF0ZSBhbiBleHByZXNzaW9uIHVzaW5nIGtleWZyYW1lIGFuaW1hdGlvblxuICAgKiBgYGBqc1xuICAgKiBjb25zdCB0cmFja05hbWUgPSB2cm0uZXhwcmVzc2lvbk1hbmFnZXIuZ2V0RXhwcmVzc2lvblRyYWNrTmFtZSggJ2JsaW5rJyApO1xuICAgKiBjb25zdCB0cmFjayA9IG5ldyBUSFJFRS5OdW1iZXJLZXlmcmFtZVRyYWNrKFxuICAgKiAgIG5hbWUsXG4gICAqICAgWyAwLjAsIDAuNSwgMS4wIF0sIC8vIHRpbWVzXG4gICAqICAgWyAwLjAsIDEuMCwgMC4wIF0gLy8gdmFsdWVzXG4gICAqICk7XG4gICAqXG4gICAqIGNvbnN0IGNsaXAgPSBuZXcgVEhSRUUuQW5pbWF0aW9uQ2xpcChcbiAgICogICAnYmxpbmsnLCAvLyBuYW1lXG4gICAqICAgMS4wLCAvLyBkdXJhdGlvblxuICAgKiAgIFsgdHJhY2sgXSAvLyB0cmFja3NcbiAgICogKTtcbiAgICpcbiAgICogY29uc3QgbWl4ZXIgPSBuZXcgVEhSRUUuQW5pbWF0aW9uTWl4ZXIoIHZybS5zY2VuZSApO1xuICAgKiBjb25zdCBhY3Rpb24gPSBtaXhlci5jbGlwQWN0aW9uKCBjbGlwICk7XG4gICAqIGFjdGlvbi5wbGF5KCk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBleHByZXNzaW9uXG4gICAqL1xuICBwdWJsaWMgZ2V0RXhwcmVzc2lvblRyYWNrTmFtZShuYW1lOiBWUk1FeHByZXNzaW9uUHJlc2V0TmFtZSB8IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIGNvbnN0IGV4cHJlc3Npb24gPSB0aGlzLmdldEV4cHJlc3Npb24obmFtZSk7XG4gICAgcmV0dXJuIGV4cHJlc3Npb24gPyBgJHtleHByZXNzaW9uLm5hbWV9LndlaWdodGAgOiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBldmVyeSBleHByZXNzaW9ucy5cbiAgICovXG4gIHB1YmxpYyB1cGRhdGUoKTogdm9pZCB7XG4gICAgLy8gc2VlIGhvdyBtdWNoIHdlIHNob3VsZCBvdmVycmlkZSBjZXJ0YWluIGV4cHJlc3Npb25zXG4gICAgY29uc3Qgd2VpZ2h0TXVsdGlwbGllcnMgPSB0aGlzLl9jYWxjdWxhdGVXZWlnaHRNdWx0aXBsaWVycygpO1xuXG4gICAgLy8gcmVzZXQgZXhwcmVzc2lvbiBiaW5kcyBmaXJzdFxuICAgIHRoaXMuX2V4cHJlc3Npb25zLmZvckVhY2goKGV4cHJlc3Npb24pID0+IHtcbiAgICAgIGV4cHJlc3Npb24uY2xlYXJBcHBsaWVkV2VpZ2h0KCk7XG4gICAgfSk7XG5cbiAgICAvLyB0aGVuIGFwcGx5IGJpbmRzXG4gICAgdGhpcy5fZXhwcmVzc2lvbnMuZm9yRWFjaCgoZXhwcmVzc2lvbikgPT4ge1xuICAgICAgbGV0IG11bHRpcGxpZXIgPSAxLjA7XG4gICAgICBjb25zdCBuYW1lID0gZXhwcmVzc2lvbi5leHByZXNzaW9uTmFtZTtcblxuICAgICAgaWYgKHRoaXMuYmxpbmtFeHByZXNzaW9uTmFtZXMuaW5kZXhPZihuYW1lKSAhPT0gLTEpIHtcbiAgICAgICAgbXVsdGlwbGllciAqPSB3ZWlnaHRNdWx0aXBsaWVycy5ibGluaztcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMubG9va0F0RXhwcmVzc2lvbk5hbWVzLmluZGV4T2YobmFtZSkgIT09IC0xKSB7XG4gICAgICAgIG11bHRpcGxpZXIgKj0gd2VpZ2h0TXVsdGlwbGllcnMubG9va0F0O1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5tb3V0aEV4cHJlc3Npb25OYW1lcy5pbmRleE9mKG5hbWUpICE9PSAtMSkge1xuICAgICAgICBtdWx0aXBsaWVyICo9IHdlaWdodE11bHRpcGxpZXJzLm1vdXRoO1xuICAgICAgfVxuXG4gICAgICBleHByZXNzaW9uLmFwcGx5V2VpZ2h0KHsgbXVsdGlwbGllciB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxjdWxhdGUgc3VtIG9mIG92ZXJyaWRlIGFtb3VudHMgdG8gc2VlIGhvdyBtdWNoIHdlIHNob3VsZCBtdWx0aXBseSB3ZWlnaHRzIG9mIGNlcnRhaW4gZXhwcmVzc2lvbnMuXG4gICAqL1xuICBwcml2YXRlIF9jYWxjdWxhdGVXZWlnaHRNdWx0aXBsaWVycygpOiB7XG4gICAgYmxpbms6IG51bWJlcjtcbiAgICBsb29rQXQ6IG51bWJlcjtcbiAgICBtb3V0aDogbnVtYmVyO1xuICB9IHtcbiAgICBsZXQgYmxpbmsgPSAxLjA7XG4gICAgbGV0IGxvb2tBdCA9IDEuMDtcbiAgICBsZXQgbW91dGggPSAxLjA7XG5cbiAgICB0aGlzLl9leHByZXNzaW9ucy5mb3JFYWNoKChleHByZXNzaW9uKSA9PiB7XG4gICAgICBibGluayAtPSBleHByZXNzaW9uLm92ZXJyaWRlQmxpbmtBbW91bnQ7XG4gICAgICBsb29rQXQgLT0gZXhwcmVzc2lvbi5vdmVycmlkZUxvb2tBdEFtb3VudDtcbiAgICAgIG1vdXRoIC09IGV4cHJlc3Npb24ub3ZlcnJpZGVNb3V0aEFtb3VudDtcbiAgICB9KTtcblxuICAgIGJsaW5rID0gTWF0aC5tYXgoMC4wLCBibGluayk7XG4gICAgbG9va0F0ID0gTWF0aC5tYXgoMC4wLCBsb29rQXQpO1xuICAgIG1vdXRoID0gTWF0aC5tYXgoMC4wLCBtb3V0aCk7XG5cbiAgICByZXR1cm4geyBibGluaywgbG9va0F0LCBtb3V0aCB9O1xuICB9XG59XG4iLCAiLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uICovXG5cbmV4cG9ydCBjb25zdCBWUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvclR5cGUgPSB7XG4gIENvbG9yOiAnY29sb3InLFxuICBFbWlzc2lvbkNvbG9yOiAnZW1pc3Npb25Db2xvcicsXG4gIFNoYWRlQ29sb3I6ICdzaGFkZUNvbG9yJyxcbiAgTWF0Y2FwQ29sb3I6ICdtYXRjYXBDb2xvcicsXG4gIFJpbUNvbG9yOiAncmltQ29sb3InLFxuICBPdXRsaW5lQ29sb3I6ICdvdXRsaW5lQ29sb3InLFxufSBhcyBjb25zdDtcblxuZXhwb3J0IHR5cGUgVlJNRXhwcmVzc2lvbk1hdGVyaWFsQ29sb3JUeXBlID1cbiAgKHR5cGVvZiBWUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvclR5cGUpW2tleW9mIHR5cGVvZiBWUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvclR5cGVdO1xuXG5leHBvcnQgY29uc3QgdjBFeHByZXNzaW9uTWF0ZXJpYWxDb2xvck1hcDogeyBba2V5OiBzdHJpbmddOiBWUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvclR5cGUgfCB1bmRlZmluZWQgfSA9IHtcbiAgX0NvbG9yOiBWUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvclR5cGUuQ29sb3IsXG4gIF9FbWlzc2lvbkNvbG9yOiBWUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvclR5cGUuRW1pc3Npb25Db2xvcixcbiAgX1NoYWRlQ29sb3I6IFZSTUV4cHJlc3Npb25NYXRlcmlhbENvbG9yVHlwZS5TaGFkZUNvbG9yLFxuICBfUmltQ29sb3I6IFZSTUV4cHJlc3Npb25NYXRlcmlhbENvbG9yVHlwZS5SaW1Db2xvcixcbiAgX091dGxpbmVDb2xvcjogVlJNRXhwcmVzc2lvbk1hdGVyaWFsQ29sb3JUeXBlLk91dGxpbmVDb2xvcixcbn07XG4iLCAiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHR5cGUgeyBWUk1FeHByZXNzaW9uQmluZCB9IGZyb20gJy4vVlJNRXhwcmVzc2lvbkJpbmQnO1xuaW1wb3J0IHR5cGUgeyBWUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvclR5cGUgfSBmcm9tICcuL1ZSTUV4cHJlc3Npb25NYXRlcmlhbENvbG9yVHlwZSc7XG5cbmNvbnN0IF9jb2xvciA9IG5ldyBUSFJFRS5Db2xvcigpO1xuXG5pbnRlcmZhY2UgQ29sb3JCaW5kU3RhdGUge1xuICBwcm9wZXJ0eU5hbWU6IHN0cmluZztcbiAgaW5pdGlhbFZhbHVlOiBUSFJFRS5Db2xvcjtcbiAgZGVsdGFWYWx1ZTogVEhSRUUuQ29sb3I7XG59XG5cbmludGVyZmFjZSBBbHBoYUJpbmRTdGF0ZSB7XG4gIHByb3BlcnR5TmFtZTogc3RyaW5nO1xuICBpbml0aWFsVmFsdWU6IG51bWJlcjtcbiAgZGVsdGFWYWx1ZTogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgQmluZFN0YXRlIHtcbiAgY29sb3I6IENvbG9yQmluZFN0YXRlIHwgbnVsbDtcbiAgYWxwaGE6IEFscGhhQmluZFN0YXRlIHwgbnVsbDtcbn1cblxuLyoqXG4gKiBBIGJpbmQgb2YgZXhwcmVzc2lvbiBpbmZsdWVuY2VzIHRvIGEgbWF0ZXJpYWwgY29sb3IuXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvckJpbmQgaW1wbGVtZW50cyBWUk1FeHByZXNzaW9uQmluZCB7XG4gIC8qKlxuICAgKiBNYXBwaW5nIG9mIHByb3BlcnR5IG5hbWVzIGZyb20gVlJNQy9tYXRlcmlhbENvbG9yQmluZHMudHlwZSB0byB0aHJlZS5qcy9NYXRlcmlhbC5cbiAgICogVGhlIGZpcnN0IGVsZW1lbnQgc3RhbmRzIGZvciBjb2xvciBjaGFubmVscywgdGhlIHNlY29uZCBlbGVtZW50IHN0YW5kcyBmb3IgdGhlIGFscGhhIGNoYW5uZWwuXG4gICAqIFRoZSBzZWNvbmQgZWxlbWVudCBjYW4gYmUgbnVsbCBpZiB0aGUgdGFyZ2V0IHByb3BlcnR5IGRvZXNuJ3QgZXhpc3QuXG4gICAqL1xuICAvLyBUT0RPOiBXZSBtaWdodCB3YW50IHRvIHVzZSB0aGUgYHNhdGlzZmllc2Agb3BlcmF0b3Igb25jZSB3ZSBidW1wIFRTIHRvIDQuOSBvciBoaWdoZXJcbiAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vcGl4aXYvdGhyZWUtdnJtL3B1bGwvMTMyMyNkaXNjdXNzaW9uX3IxMzc0MDIwMDM1XG4gIHByaXZhdGUgc3RhdGljIF9wcm9wZXJ0eU5hbWVNYXBNYXA6IHtcbiAgICBbZGlzdGluZ3Vpc2hlcjogc3RyaW5nXTogeyBbdHlwZSBpbiBWUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvclR5cGVdPzogcmVhZG9ubHkgW3N0cmluZywgc3RyaW5nIHwgbnVsbF0gfTtcbiAgfSA9IHtcbiAgICBpc01lc2hTdGFuZGFyZE1hdGVyaWFsOiB7XG4gICAgICBjb2xvcjogWydjb2xvcicsICdvcGFjaXR5J10sXG4gICAgICBlbWlzc2lvbkNvbG9yOiBbJ2VtaXNzaXZlJywgbnVsbF0sXG4gICAgfSxcbiAgICBpc01lc2hCYXNpY01hdGVyaWFsOiB7XG4gICAgICBjb2xvcjogWydjb2xvcicsICdvcGFjaXR5J10sXG4gICAgfSxcbiAgICBpc01Ub29uTWF0ZXJpYWw6IHtcbiAgICAgIGNvbG9yOiBbJ2NvbG9yJywgJ29wYWNpdHknXSxcbiAgICAgIGVtaXNzaW9uQ29sb3I6IFsnZW1pc3NpdmUnLCBudWxsXSxcbiAgICAgIG91dGxpbmVDb2xvcjogWydvdXRsaW5lQ29sb3JGYWN0b3InLCBudWxsXSxcbiAgICAgIG1hdGNhcENvbG9yOiBbJ21hdGNhcEZhY3RvcicsIG51bGxdLFxuICAgICAgcmltQ29sb3I6IFsncGFyYW1ldHJpY1JpbUNvbG9yRmFjdG9yJywgbnVsbF0sXG4gICAgICBzaGFkZUNvbG9yOiBbJ3NoYWRlQ29sb3JGYWN0b3InLCBudWxsXSxcbiAgICB9LFxuICB9O1xuXG4gIC8qKlxuICAgKiBUaGUgdGFyZ2V0IG1hdGVyaWFsLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IG1hdGVyaWFsOiBUSFJFRS5NYXRlcmlhbDtcblxuICAvKipcbiAgICogVGhlIHR5cGUgb2YgdGhlIHRhcmdldCBwcm9wZXJ0eSBvZiB0aGUgbWF0ZXJpYWwuXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgdHlwZTogVlJNRXhwcmVzc2lvbk1hdGVyaWFsQ29sb3JUeXBlO1xuXG4gIC8qKlxuICAgKiBUaGUgdGFyZ2V0IGNvbG9yLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IHRhcmdldFZhbHVlOiBUSFJFRS5Db2xvcjtcblxuICAvKipcbiAgICogVGhlIHRhcmdldCBhbHBoYS5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSB0YXJnZXRBbHBoYTogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBJdHMgYmluZGluZyBzdGF0ZS5cbiAgICogSWYgaXQgY2Fubm90IGZpbmQgdGhlIHRhcmdldCBwcm9wZXJ0eSBpbiB0aGUgY29uc3RydWN0b3IsIGVhY2ggcHJvcGVydHkgd2lsbCBiZSBudWxsIGluc3RlYWQuXG4gICAqL1xuICBwcml2YXRlIF9zdGF0ZTogQmluZFN0YXRlO1xuXG4gIHB1YmxpYyBjb25zdHJ1Y3Rvcih7XG4gICAgbWF0ZXJpYWwsXG4gICAgdHlwZSxcbiAgICB0YXJnZXRWYWx1ZSxcbiAgICB0YXJnZXRBbHBoYSxcbiAgfToge1xuICAgIC8qKlxuICAgICAqIFRoZSB0YXJnZXQgbWF0ZXJpYWwuXG4gICAgICovXG4gICAgbWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHR5cGUgb2YgdGhlIHRhcmdldCBwcm9wZXJ0eSBvZiB0aGUgbWF0ZXJpYWwuXG4gICAgICovXG4gICAgdHlwZTogVlJNRXhwcmVzc2lvbk1hdGVyaWFsQ29sb3JUeXBlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHRhcmdldCBjb2xvci5cbiAgICAgKi9cbiAgICB0YXJnZXRWYWx1ZTogVEhSRUUuQ29sb3I7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdGFyZ2V0IGFscGhhLlxuICAgICAqL1xuICAgIHRhcmdldEFscGhhPzogbnVtYmVyO1xuICB9KSB7XG4gICAgdGhpcy5tYXRlcmlhbCA9IG1hdGVyaWFsO1xuICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgdGhpcy50YXJnZXRWYWx1ZSA9IHRhcmdldFZhbHVlO1xuICAgIHRoaXMudGFyZ2V0QWxwaGEgPSB0YXJnZXRBbHBoYSA/PyAxLjA7XG5cbiAgICAvLyBpbml0IGJpbmQgc3RhdGVcbiAgICBjb25zdCBjb2xvciA9IHRoaXMuX2luaXRDb2xvckJpbmRTdGF0ZSgpO1xuICAgIGNvbnN0IGFscGhhID0gdGhpcy5faW5pdEFscGhhQmluZFN0YXRlKCk7XG4gICAgdGhpcy5fc3RhdGUgPSB7IGNvbG9yLCBhbHBoYSB9O1xuICB9XG5cbiAgcHVibGljIGFwcGx5V2VpZ2h0KHdlaWdodDogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb2xvciwgYWxwaGEgfSA9IHRoaXMuX3N0YXRlO1xuXG4gICAgaWYgKGNvbG9yICE9IG51bGwpIHtcbiAgICAgIGNvbnN0IHsgcHJvcGVydHlOYW1lLCBkZWx0YVZhbHVlIH0gPSBjb2xvcjtcblxuICAgICAgY29uc3QgdGFyZ2V0ID0gKHRoaXMubWF0ZXJpYWwgYXMgYW55KVtwcm9wZXJ0eU5hbWVdIGFzIFRIUkVFLkNvbG9yO1xuICAgICAgaWYgKHRhcmdldCAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGFyZ2V0LmFkZChfY29sb3IuY29weShkZWx0YVZhbHVlKS5tdWx0aXBseVNjYWxhcih3ZWlnaHQpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoYWxwaGEgIT0gbnVsbCkge1xuICAgICAgY29uc3QgeyBwcm9wZXJ0eU5hbWUsIGRlbHRhVmFsdWUgfSA9IGFscGhhO1xuXG4gICAgICBjb25zdCB0YXJnZXQgPSAodGhpcy5tYXRlcmlhbCBhcyBhbnkpW3Byb3BlcnR5TmFtZV0gYXMgbnVtYmVyO1xuICAgICAgaWYgKHRhcmdldCAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgKCh0aGlzLm1hdGVyaWFsIGFzIGFueSlbcHJvcGVydHlOYW1lXSBhcyBudW1iZXIpICs9IGRlbHRhVmFsdWUgKiB3ZWlnaHQ7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGNsZWFyQXBwbGllZFdlaWdodCgpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbG9yLCBhbHBoYSB9ID0gdGhpcy5fc3RhdGU7XG5cbiAgICBpZiAoY29sb3IgIT0gbnVsbCkge1xuICAgICAgY29uc3QgeyBwcm9wZXJ0eU5hbWUsIGluaXRpYWxWYWx1ZSB9ID0gY29sb3I7XG5cbiAgICAgIGNvbnN0IHRhcmdldCA9ICh0aGlzLm1hdGVyaWFsIGFzIGFueSlbcHJvcGVydHlOYW1lXSBhcyBUSFJFRS5Db2xvcjtcbiAgICAgIGlmICh0YXJnZXQgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRhcmdldC5jb3B5KGluaXRpYWxWYWx1ZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGFscGhhICE9IG51bGwpIHtcbiAgICAgIGNvbnN0IHsgcHJvcGVydHlOYW1lLCBpbml0aWFsVmFsdWUgfSA9IGFscGhhO1xuXG4gICAgICBjb25zdCB0YXJnZXQgPSAodGhpcy5tYXRlcmlhbCBhcyBhbnkpW3Byb3BlcnR5TmFtZV0gYXMgbnVtYmVyO1xuICAgICAgaWYgKHRhcmdldCAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgKCh0aGlzLm1hdGVyaWFsIGFzIGFueSlbcHJvcGVydHlOYW1lXSBhcyBudW1iZXIpID0gaW5pdGlhbFZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2luaXRDb2xvckJpbmRTdGF0ZSgpOiBDb2xvckJpbmRTdGF0ZSB8IG51bGwge1xuICAgIGNvbnN0IHsgbWF0ZXJpYWwsIHR5cGUsIHRhcmdldFZhbHVlIH0gPSB0aGlzO1xuXG4gICAgY29uc3QgcHJvcGVydHlOYW1lTWFwID0gdGhpcy5fZ2V0UHJvcGVydHlOYW1lTWFwKCk7XG4gICAgY29uc3QgcHJvcGVydHlOYW1lID0gcHJvcGVydHlOYW1lTWFwPy5bdHlwZV0/LlswXSA/PyBudWxsO1xuXG4gICAgaWYgKHByb3BlcnR5TmFtZSA9PSBudWxsKSB7XG4gICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgIGBUcmllZCB0byBhZGQgYSBtYXRlcmlhbCBjb2xvciBiaW5kIHRvIHRoZSBtYXRlcmlhbCAke1xuICAgICAgICAgIG1hdGVyaWFsLm5hbWUgPz8gJyhubyBuYW1lKSdcbiAgICAgICAgfSwgdGhlIHR5cGUgJHt0eXBlfSBidXQgdGhlIG1hdGVyaWFsIG9yIHRoZSB0eXBlIGlzIG5vdCBzdXBwb3J0ZWQuYCxcbiAgICAgICk7XG5cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IHRhcmdldCA9IChtYXRlcmlhbCBhcyBhbnkpW3Byb3BlcnR5TmFtZV0gYXMgVEhSRUUuQ29sb3I7XG5cbiAgICBjb25zdCBpbml0aWFsVmFsdWUgPSB0YXJnZXQuY2xvbmUoKTtcblxuICAgIC8vIFx1OENBMFx1MzA2RVx1NTAyNFx1MzA5Mlx1NEZERFx1NjMwMVx1MzA1OVx1MzA4Qlx1MzA1Rlx1MzA4MVx1MzA2QkNvbG9yLnN1Ylx1MzA5Mlx1NEY3Rlx1MzA4Rlx1MzA1QVx1MzA2Qlx1NURFRVx1NTIwNlx1MzA5Mlx1OEEwOFx1N0I5N1x1MzA1OVx1MzA4QlxuICAgIGNvbnN0IGRlbHRhVmFsdWUgPSBuZXcgVEhSRUUuQ29sb3IoXG4gICAgICB0YXJnZXRWYWx1ZS5yIC0gaW5pdGlhbFZhbHVlLnIsXG4gICAgICB0YXJnZXRWYWx1ZS5nIC0gaW5pdGlhbFZhbHVlLmcsXG4gICAgICB0YXJnZXRWYWx1ZS5iIC0gaW5pdGlhbFZhbHVlLmIsXG4gICAgKTtcblxuICAgIHJldHVybiB7IHByb3BlcnR5TmFtZSwgaW5pdGlhbFZhbHVlLCBkZWx0YVZhbHVlIH07XG4gIH1cblxuICBwcml2YXRlIF9pbml0QWxwaGFCaW5kU3RhdGUoKTogQWxwaGFCaW5kU3RhdGUgfCBudWxsIHtcbiAgICBjb25zdCB7IG1hdGVyaWFsLCB0eXBlLCB0YXJnZXRBbHBoYSB9ID0gdGhpcztcblxuICAgIGNvbnN0IHByb3BlcnR5TmFtZU1hcCA9IHRoaXMuX2dldFByb3BlcnR5TmFtZU1hcCgpO1xuICAgIGNvbnN0IHByb3BlcnR5TmFtZSA9IHByb3BlcnR5TmFtZU1hcD8uW3R5cGVdPy5bMV0gPz8gbnVsbDtcblxuICAgIGlmIChwcm9wZXJ0eU5hbWUgPT0gbnVsbCAmJiB0YXJnZXRBbHBoYSAhPT0gMS4wKSB7XG4gICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgIGBUcmllZCB0byBhZGQgYSBtYXRlcmlhbCBhbHBoYSBiaW5kIHRvIHRoZSBtYXRlcmlhbCAke1xuICAgICAgICAgIG1hdGVyaWFsLm5hbWUgPz8gJyhubyBuYW1lKSdcbiAgICAgICAgfSwgdGhlIHR5cGUgJHt0eXBlfSBidXQgdGhlIG1hdGVyaWFsIG9yIHRoZSB0eXBlIGRvZXMgbm90IHN1cHBvcnQgYWxwaGEuYCxcbiAgICAgICk7XG5cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmIChwcm9wZXJ0eU5hbWUgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgaW5pdGlhbFZhbHVlID0gKG1hdGVyaWFsIGFzIGFueSlbcHJvcGVydHlOYW1lXSBhcyBudW1iZXI7XG5cbiAgICBjb25zdCBkZWx0YVZhbHVlID0gdGFyZ2V0QWxwaGEgLSBpbml0aWFsVmFsdWU7XG5cbiAgICByZXR1cm4geyBwcm9wZXJ0eU5hbWUsIGluaXRpYWxWYWx1ZSwgZGVsdGFWYWx1ZSB9O1xuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0UHJvcGVydHlOYW1lTWFwKCk6XG4gICAgeyBbdHlwZSBpbiBWUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvclR5cGVdPzogcmVhZG9ubHkgW3N0cmluZywgc3RyaW5nIHwgbnVsbF0gfSB8IG51bGwge1xuICAgIHJldHVybiAoXG4gICAgICBPYmplY3QuZW50cmllcyhWUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvckJpbmQuX3Byb3BlcnR5TmFtZU1hcE1hcCkuZmluZCgoW2Rpc3Rpbmd1aXNoZXJdKSA9PiB7XG4gICAgICAgIHJldHVybiAodGhpcy5tYXRlcmlhbCBhcyBhbnkpW2Rpc3Rpbmd1aXNoZXJdID09PSB0cnVlO1xuICAgICAgfSk/LlsxXSA/PyBudWxsXG4gICAgKTtcbiAgfVxufVxuIiwgImltcG9ydCB0eXBlICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHR5cGUgeyBWUk1FeHByZXNzaW9uQmluZCB9IGZyb20gJy4vVlJNRXhwcmVzc2lvbkJpbmQnO1xuXG4vKipcbiAqIEEgYmluZCBvZiB7QGxpbmsgVlJNRXhwcmVzc2lvbn0gaW5mbHVlbmNlcyB0byBtb3JwaCB0YXJnZXRzLlxuICovXG5leHBvcnQgY2xhc3MgVlJNRXhwcmVzc2lvbk1vcnBoVGFyZ2V0QmluZCBpbXBsZW1lbnRzIFZSTUV4cHJlc3Npb25CaW5kIHtcbiAgLyoqXG4gICAqIFRoZSBtZXNoIHByaW1pdGl2ZXMgdGhhdCBhdHRhY2hlZCB0byB0YXJnZXQgbWVzaC5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBwcmltaXRpdmVzOiBUSFJFRS5NZXNoW107XG5cbiAgLyoqXG4gICAqIFRoZSBpbmRleCBvZiB0aGUgbW9ycGggdGFyZ2V0IGluIHRoZSBtZXNoLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGluZGV4OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIFRoZSB3ZWlnaHQgdmFsdWUgb2YgdGFyZ2V0IG1vcnBoIHRhcmdldC4gUmFuZ2luZyBpbiBbMC4wIC0gMS4wXS5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSB3ZWlnaHQ6IG51bWJlcjtcblxuICBwdWJsaWMgY29uc3RydWN0b3Ioe1xuICAgIHByaW1pdGl2ZXMsXG4gICAgaW5kZXgsXG4gICAgd2VpZ2h0LFxuICB9OiB7XG4gICAgLyoqXG4gICAgICogVGhlIG1lc2ggcHJpbWl0aXZlcyB0aGF0IGF0dGFjaGVkIHRvIHRhcmdldCBtZXNoLlxuICAgICAqL1xuICAgIHByaW1pdGl2ZXM6IFRIUkVFLk1lc2hbXTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBpbmRleCBvZiB0aGUgbW9ycGggdGFyZ2V0IGluIHRoZSBtZXNoLlxuICAgICAqL1xuICAgIGluZGV4OiBudW1iZXI7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd2VpZ2h0IHZhbHVlIG9mIHRhcmdldCBtb3JwaCB0YXJnZXQuIFJhbmdpbmcgaW4gWzAuMCAtIDEuMF0uXG4gICAgICovXG4gICAgd2VpZ2h0OiBudW1iZXI7XG4gIH0pIHtcbiAgICB0aGlzLnByaW1pdGl2ZXMgPSBwcmltaXRpdmVzO1xuICAgIHRoaXMuaW5kZXggPSBpbmRleDtcbiAgICB0aGlzLndlaWdodCA9IHdlaWdodDtcbiAgfVxuXG4gIHB1YmxpYyBhcHBseVdlaWdodCh3ZWlnaHQ6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMucHJpbWl0aXZlcy5mb3JFYWNoKChtZXNoKSA9PiB7XG4gICAgICBpZiAobWVzaC5tb3JwaFRhcmdldEluZmx1ZW5jZXM/Llt0aGlzLmluZGV4XSAhPSBudWxsKSB7XG4gICAgICAgIG1lc2gubW9ycGhUYXJnZXRJbmZsdWVuY2VzW3RoaXMuaW5kZXhdICs9IHRoaXMud2VpZ2h0ICogd2VpZ2h0O1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGNsZWFyQXBwbGllZFdlaWdodCgpOiB2b2lkIHtcbiAgICB0aGlzLnByaW1pdGl2ZXMuZm9yRWFjaCgobWVzaCkgPT4ge1xuICAgICAgaWYgKG1lc2gubW9ycGhUYXJnZXRJbmZsdWVuY2VzPy5bdGhpcy5pbmRleF0gIT0gbnVsbCkge1xuICAgICAgICBtZXNoLm1vcnBoVGFyZ2V0SW5mbHVlbmNlc1t0aGlzLmluZGV4XSA9IDAuMDtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuIiwgImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB0eXBlIHsgVlJNRXhwcmVzc2lvbkJpbmQgfSBmcm9tICcuL1ZSTUV4cHJlc3Npb25CaW5kJztcblxuY29uc3QgX3YyID0gbmV3IFRIUkVFLlZlY3RvcjIoKTtcblxuLyoqXG4gKiBBIGJpbmQgb2YgZXhwcmVzc2lvbiBpbmZsdWVuY2VzIHRvIHRleHR1cmUgdHJhbnNmb3Jtcy5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTUV4cHJlc3Npb25UZXh0dXJlVHJhbnNmb3JtQmluZCBpbXBsZW1lbnRzIFZSTUV4cHJlc3Npb25CaW5kIHtcbiAgcHJpdmF0ZSBzdGF0aWMgX3Byb3BlcnR5TmFtZXNNYXA6IHsgW2Rpc3Rpbmd1aXNoZXI6IHN0cmluZ106IHN0cmluZ1tdIH0gPSB7XG4gICAgaXNNZXNoU3RhbmRhcmRNYXRlcmlhbDogW1xuICAgICAgJ21hcCcsXG4gICAgICAnZW1pc3NpdmVNYXAnLFxuICAgICAgJ2J1bXBNYXAnLFxuICAgICAgJ25vcm1hbE1hcCcsXG4gICAgICAnZGlzcGxhY2VtZW50TWFwJyxcbiAgICAgICdyb3VnaG5lc3NNYXAnLFxuICAgICAgJ21ldGFsbmVzc01hcCcsXG4gICAgICAnYWxwaGFNYXAnLFxuICAgIF0sXG4gICAgaXNNZXNoQmFzaWNNYXRlcmlhbDogWydtYXAnLCAnc3BlY3VsYXJNYXAnLCAnYWxwaGFNYXAnXSxcbiAgICBpc01Ub29uTWF0ZXJpYWw6IFtcbiAgICAgICdtYXAnLFxuICAgICAgJ25vcm1hbE1hcCcsXG4gICAgICAnZW1pc3NpdmVNYXAnLFxuICAgICAgJ3NoYWRlTXVsdGlwbHlUZXh0dXJlJyxcbiAgICAgICdyaW1NdWx0aXBseVRleHR1cmUnLFxuICAgICAgJ291dGxpbmVXaWR0aE11bHRpcGx5VGV4dHVyZScsXG4gICAgICAndXZBbmltYXRpb25NYXNrVGV4dHVyZScsXG4gICAgXSxcbiAgfTtcblxuICAvKipcbiAgICogVGhlIHRhcmdldCBtYXRlcmlhbC5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBtYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWw7XG5cbiAgLyoqXG4gICAqIFRoZSB1diBzY2FsZSBvZiB0aGUgdGV4dHVyZS5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBzY2FsZTogVEhSRUUuVmVjdG9yMjtcblxuICAvKipcbiAgICogVGhlIHV2IG9mZnNldCBvZiB0aGUgdGV4dHVyZS5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBvZmZzZXQ6IFRIUkVFLlZlY3RvcjI7XG5cbiAgLyoqXG4gICAqIFRoZSBsaXN0IG9mIHRleHR1cmUgbmFtZXMgYW5kIGl0cyBzdGF0ZSB0aGF0IHNob3VsZCBiZSB0cmFuc2Zvcm1lZCBieSB0aGlzIGJpbmQuXG4gICAqL1xuICBwcml2YXRlIF9wcm9wZXJ0aWVzOiB7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIGluaXRpYWxPZmZzZXQ6IFRIUkVFLlZlY3RvcjI7XG4gICAgaW5pdGlhbFNjYWxlOiBUSFJFRS5WZWN0b3IyO1xuICAgIGRlbHRhT2Zmc2V0OiBUSFJFRS5WZWN0b3IyO1xuICAgIGRlbHRhU2NhbGU6IFRIUkVFLlZlY3RvcjI7XG4gIH1bXTtcblxuICBwdWJsaWMgY29uc3RydWN0b3Ioe1xuICAgIG1hdGVyaWFsLFxuICAgIHNjYWxlLFxuICAgIG9mZnNldCxcbiAgfToge1xuICAgIC8qKlxuICAgICAqIFRoZSB0YXJnZXQgbWF0ZXJpYWwuXG4gICAgICovXG4gICAgbWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHV2IHNjYWxlIG9mIHRoZSB0ZXh0dXJlLlxuICAgICAqL1xuICAgIHNjYWxlOiBUSFJFRS5WZWN0b3IyO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHV2IG9mZnNldCBvZiB0aGUgdGV4dHVyZS5cbiAgICAgKi9cbiAgICBvZmZzZXQ6IFRIUkVFLlZlY3RvcjI7XG4gIH0pIHtcbiAgICB0aGlzLm1hdGVyaWFsID0gbWF0ZXJpYWw7XG4gICAgdGhpcy5zY2FsZSA9IHNjYWxlO1xuICAgIHRoaXMub2Zmc2V0ID0gb2Zmc2V0O1xuXG4gICAgY29uc3QgcHJvcGVydHlOYW1lcyA9IE9iamVjdC5lbnRyaWVzKFZSTUV4cHJlc3Npb25UZXh0dXJlVHJhbnNmb3JtQmluZC5fcHJvcGVydHlOYW1lc01hcCkuZmluZChcbiAgICAgIChbZGlzdGluZ3Vpc2hlcl0pID0+IHtcbiAgICAgICAgcmV0dXJuIChtYXRlcmlhbCBhcyBhbnkpW2Rpc3Rpbmd1aXNoZXJdID09PSB0cnVlO1xuICAgICAgfSxcbiAgICApPy5bMV07XG5cbiAgICBpZiAocHJvcGVydHlOYW1lcyA9PSBudWxsKSB7XG4gICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgIGBUcmllZCB0byBhZGQgYSB0ZXh0dXJlIHRyYW5zZm9ybSBiaW5kIHRvIHRoZSBtYXRlcmlhbCAke1xuICAgICAgICAgIG1hdGVyaWFsLm5hbWUgPz8gJyhubyBuYW1lKSdcbiAgICAgICAgfSBidXQgdGhlIG1hdGVyaWFsIGlzIG5vdCBzdXBwb3J0ZWQuYCxcbiAgICAgICk7XG5cbiAgICAgIHRoaXMuX3Byb3BlcnRpZXMgPSBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcHJvcGVydGllcyA9IFtdO1xuXG4gICAgICBwcm9wZXJ0eU5hbWVzLmZvckVhY2goKHByb3BlcnR5TmFtZSkgPT4ge1xuICAgICAgICBjb25zdCB0ZXh0dXJlID0gKChtYXRlcmlhbCBhcyBhbnkpW3Byb3BlcnR5TmFtZV0gYXMgVEhSRUUuVGV4dHVyZSB8IHVuZGVmaW5lZCk/LmNsb25lKCk7XG4gICAgICAgIGlmICghdGV4dHVyZSkge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgKG1hdGVyaWFsIGFzIGFueSlbcHJvcGVydHlOYW1lXSA9IHRleHR1cmU7IC8vIGJlY2F1c2UgdGhlIHRleHR1cmUgaXMgY2xvbmVkXG5cbiAgICAgICAgY29uc3QgaW5pdGlhbE9mZnNldCA9IHRleHR1cmUub2Zmc2V0LmNsb25lKCk7XG4gICAgICAgIGNvbnN0IGluaXRpYWxTY2FsZSA9IHRleHR1cmUucmVwZWF0LmNsb25lKCk7XG4gICAgICAgIGNvbnN0IGRlbHRhT2Zmc2V0ID0gb2Zmc2V0LmNsb25lKCkuc3ViKGluaXRpYWxPZmZzZXQpO1xuICAgICAgICBjb25zdCBkZWx0YVNjYWxlID0gc2NhbGUuY2xvbmUoKS5zdWIoaW5pdGlhbFNjYWxlKTtcblxuICAgICAgICB0aGlzLl9wcm9wZXJ0aWVzLnB1c2goe1xuICAgICAgICAgIG5hbWU6IHByb3BlcnR5TmFtZSxcbiAgICAgICAgICBpbml0aWFsT2Zmc2V0LFxuICAgICAgICAgIGRlbHRhT2Zmc2V0LFxuICAgICAgICAgIGluaXRpYWxTY2FsZSxcbiAgICAgICAgICBkZWx0YVNjYWxlLFxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBhcHBseVdlaWdodCh3ZWlnaHQ6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMuX3Byb3BlcnRpZXMuZm9yRWFjaCgocHJvcGVydHkpID0+IHtcbiAgICAgIGNvbnN0IHRhcmdldCA9ICh0aGlzLm1hdGVyaWFsIGFzIGFueSlbcHJvcGVydHkubmFtZV0gYXMgVEhSRUUuVGV4dHVyZTtcbiAgICAgIGlmICh0YXJnZXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9IC8vIFRPRE86IHdlIHNob3VsZCBraWNrIHRoaXMgYXQgYGFkZE1hdGVyaWFsVmFsdWVgXG5cbiAgICAgIHRhcmdldC5vZmZzZXQuYWRkKF92Mi5jb3B5KHByb3BlcnR5LmRlbHRhT2Zmc2V0KS5tdWx0aXBseVNjYWxhcih3ZWlnaHQpKTtcbiAgICAgIHRhcmdldC5yZXBlYXQuYWRkKF92Mi5jb3B5KHByb3BlcnR5LmRlbHRhU2NhbGUpLm11bHRpcGx5U2NhbGFyKHdlaWdodCkpO1xuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGNsZWFyQXBwbGllZFdlaWdodCgpOiB2b2lkIHtcbiAgICB0aGlzLl9wcm9wZXJ0aWVzLmZvckVhY2goKHByb3BlcnR5KSA9PiB7XG4gICAgICBjb25zdCB0YXJnZXQgPSAodGhpcy5tYXRlcmlhbCBhcyBhbnkpW3Byb3BlcnR5Lm5hbWVdIGFzIFRIUkVFLlRleHR1cmU7XG4gICAgICBpZiAodGFyZ2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSAvLyBUT0RPOiB3ZSBzaG91bGQga2ljayB0aGlzIGF0IGBhZGRNYXRlcmlhbFZhbHVlYFxuXG4gICAgICB0YXJnZXQub2Zmc2V0LmNvcHkocHJvcGVydHkuaW5pdGlhbE9mZnNldCk7XG4gICAgICB0YXJnZXQucmVwZWF0LmNvcHkocHJvcGVydHkuaW5pdGlhbFNjYWxlKTtcbiAgICB9KTtcbiAgfVxufVxuIiwgIi8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvbiAqL1xuXG5leHBvcnQgY29uc3QgVlJNRXhwcmVzc2lvbk92ZXJyaWRlVHlwZSA9IHtcbiAgTm9uZTogJ25vbmUnLFxuICBCbG9jazogJ2Jsb2NrJyxcbiAgQmxlbmQ6ICdibGVuZCcsXG59IGFzIGNvbnN0O1xuXG5leHBvcnQgdHlwZSBWUk1FeHByZXNzaW9uT3ZlcnJpZGVUeXBlID0gKHR5cGVvZiBWUk1FeHByZXNzaW9uT3ZlcnJpZGVUeXBlKVtrZXlvZiB0eXBlb2YgVlJNRXhwcmVzc2lvbk92ZXJyaWRlVHlwZV07XG4iLCAiaW1wb3J0IHR5cGUgeyBWUk1GaXJzdFBlcnNvbk1lc2hBbm5vdGF0aW9uIH0gZnJvbSAnLi9WUk1GaXJzdFBlcnNvbk1lc2hBbm5vdGF0aW9uJztcbmltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB0eXBlIHsgVlJNSHVtYW5vaWQgfSBmcm9tICcuLi9odW1hbm9pZCc7XG5cbmV4cG9ydCBjbGFzcyBWUk1GaXJzdFBlcnNvbiB7XG4gIC8qKlxuICAgKiBBIGRlZmF1bHQgY2FtZXJhIGxheWVyIGZvciBgRmlyc3RQZXJzb25Pbmx5YCBsYXllci5cbiAgICpcbiAgICogQHNlZSB7QGxpbmsgZmlyc3RQZXJzb25Pbmx5TGF5ZXJ9XG4gICAqL1xuICBwdWJsaWMgc3RhdGljIHJlYWRvbmx5IERFRkFVTFRfRklSU1RQRVJTT05fT05MWV9MQVlFUiA9IDk7XG5cbiAgLyoqXG4gICAqIEEgZGVmYXVsdCBjYW1lcmEgbGF5ZXIgZm9yIGBUaGlyZFBlcnNvbk9ubHlgIGxheWVyLlxuICAgKlxuICAgKiBAc2VlIHtAbGluayB0aGlyZFBlcnNvbk9ubHlMYXllcn1cbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgREVGQVVMVF9USElSRFBFUlNPTl9PTkxZX0xBWUVSID0gMTA7XG5cbiAgLyoqXG4gICAqIEl0cyBhc3NvY2lhdGVkIHtAbGluayBWUk1IdW1hbm9pZH0uXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgaHVtYW5vaWQ6IFZSTUh1bWFub2lkO1xuICBwdWJsaWMgbWVzaEFubm90YXRpb25zOiBWUk1GaXJzdFBlcnNvbk1lc2hBbm5vdGF0aW9uW107XG5cbiAgcHJpdmF0ZSBfZmlyc3RQZXJzb25Pbmx5TGF5ZXIgPSBWUk1GaXJzdFBlcnNvbi5ERUZBVUxUX0ZJUlNUUEVSU09OX09OTFlfTEFZRVI7XG4gIHByaXZhdGUgX3RoaXJkUGVyc29uT25seUxheWVyID0gVlJNRmlyc3RQZXJzb24uREVGQVVMVF9USElSRFBFUlNPTl9PTkxZX0xBWUVSO1xuXG4gIHByaXZhdGUgX2luaXRpYWxpemVkTGF5ZXJzID0gZmFsc2U7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1GaXJzdFBlcnNvbiBvYmplY3QuXG4gICAqXG4gICAqIEBwYXJhbSBodW1hbm9pZCBBIHtAbGluayBWUk1IdW1hbm9pZH1cbiAgICogQHBhcmFtIG1lc2hBbm5vdGF0aW9ucyBBIHtAbGluayBWUk1GaXJzdFBlcnNvbk1lc2hBbm5vdGF0aW9ufVxuICAgKi9cbiAgcHVibGljIGNvbnN0cnVjdG9yKGh1bWFub2lkOiBWUk1IdW1hbm9pZCwgbWVzaEFubm90YXRpb25zOiBWUk1GaXJzdFBlcnNvbk1lc2hBbm5vdGF0aW9uW10pIHtcbiAgICB0aGlzLmh1bWFub2lkID0gaHVtYW5vaWQ7XG4gICAgdGhpcy5tZXNoQW5ub3RhdGlvbnMgPSBtZXNoQW5ub3RhdGlvbnM7XG4gIH1cblxuICAvKipcbiAgICogQ29weSB0aGUgZ2l2ZW4ge0BsaW5rIFZSTUZpcnN0UGVyc29ufSBpbnRvIHRoaXMgb25lLlxuICAgKiB7QGxpbmsgaHVtYW5vaWR9IG11c3QgYmUgc2FtZSBhcyB0aGUgc291cmNlIG9uZS5cbiAgICogQHBhcmFtIHNvdXJjZSBUaGUge0BsaW5rIFZSTUZpcnN0UGVyc29ufSB5b3Ugd2FudCB0byBjb3B5XG4gICAqIEByZXR1cm5zIHRoaXNcbiAgICovXG4gIHB1YmxpYyBjb3B5KHNvdXJjZTogVlJNRmlyc3RQZXJzb24pOiB0aGlzIHtcbiAgICBpZiAodGhpcy5odW1hbm9pZCAhPT0gc291cmNlLmh1bWFub2lkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1ZSTUZpcnN0UGVyc29uOiBodW1hbm9pZCBtdXN0IGJlIHNhbWUgaW4gb3JkZXIgdG8gY29weScpO1xuICAgIH1cblxuICAgIHRoaXMubWVzaEFubm90YXRpb25zID0gc291cmNlLm1lc2hBbm5vdGF0aW9ucy5tYXAoKGFubm90YXRpb24pID0+ICh7XG4gICAgICBtZXNoZXM6IGFubm90YXRpb24ubWVzaGVzLmNvbmNhdCgpLFxuICAgICAgdHlwZTogYW5ub3RhdGlvbi50eXBlLFxuICAgIH0pKTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBjbG9uZSBvZiB0aGlzIHtAbGluayBWUk1GaXJzdFBlcnNvbn0uXG4gICAqIEByZXR1cm5zIENvcGllZCB7QGxpbmsgVlJNRmlyc3RQZXJzb259XG4gICAqL1xuICBwdWJsaWMgY2xvbmUoKTogVlJNRmlyc3RQZXJzb24ge1xuICAgIHJldHVybiBuZXcgVlJNRmlyc3RQZXJzb24odGhpcy5odW1hbm9pZCwgdGhpcy5tZXNoQW5ub3RhdGlvbnMpLmNvcHkodGhpcyk7XG4gIH1cblxuICAvKipcbiAgICogQSBjYW1lcmEgbGF5ZXIgcmVwcmVzZW50cyBgRmlyc3RQZXJzb25Pbmx5YCBsYXllci5cbiAgICogTm90ZSB0aGF0ICoqeW91IG11c3QgY2FsbCB7QGxpbmsgc2V0dXB9IGZpcnN0IGJlZm9yZSB5b3UgdXNlIHRoZSBsYXllciBmZWF0dXJlKiogb3IgaXQgZG9lcyBub3Qgd29yayBwcm9wZXJseS5cbiAgICpcbiAgICogVGhlIHZhbHVlIGlzIHtAbGluayBERUZBVUxUX0ZJUlNUUEVSU09OX09OTFlfTEFZRVJ9IGJ5IGRlZmF1bHQgYnV0IHlvdSBjYW4gY2hhbmdlIHRoZSBsYXllciBieSBzcGVjaWZ5aW5nIHZpYSB7QGxpbmsgc2V0dXB9IGlmIHlvdSBwcmVmZXIuXG4gICAqXG4gICAqIEBzZWUgaHR0cHM6Ly92cm0uZGV2L2VuL3VuaXZybS9hcGkvdW5pdnJtX3VzZV9maXJzdHBlcnNvbi9cbiAgICogQHNlZSBodHRwczovL3RocmVlanMub3JnL2RvY3MvI2FwaS9lbi9jb3JlL0xheWVyc1xuICAgKi9cbiAgcHVibGljIGdldCBmaXJzdFBlcnNvbk9ubHlMYXllcigpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLl9maXJzdFBlcnNvbk9ubHlMYXllcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBBIGNhbWVyYSBsYXllciByZXByZXNlbnRzIGBUaGlyZFBlcnNvbk9ubHlgIGxheWVyLlxuICAgKiBOb3RlIHRoYXQgKip5b3UgbXVzdCBjYWxsIHtAbGluayBzZXR1cH0gZmlyc3QgYmVmb3JlIHlvdSB1c2UgdGhlIGxheWVyIGZlYXR1cmUqKiBvciBpdCBkb2VzIG5vdCB3b3JrIHByb3Blcmx5LlxuICAgKlxuICAgKiBUaGUgdmFsdWUgaXMge0BsaW5rIERFRkFVTFRfVEhJUkRQRVJTT05fT05MWV9MQVlFUn0gYnkgZGVmYXVsdCBidXQgeW91IGNhbiBjaGFuZ2UgdGhlIGxheWVyIGJ5IHNwZWNpZnlpbmcgdmlhIHtAbGluayBzZXR1cH0gaWYgeW91IHByZWZlci5cbiAgICpcbiAgICogQHNlZSBodHRwczovL3ZybS5kZXYvZW4vdW5pdnJtL2FwaS91bml2cm1fdXNlX2ZpcnN0cGVyc29uL1xuICAgKiBAc2VlIGh0dHBzOi8vdGhyZWVqcy5vcmcvZG9jcy8jYXBpL2VuL2NvcmUvTGF5ZXJzXG4gICAqL1xuICBwdWJsaWMgZ2V0IHRoaXJkUGVyc29uT25seUxheWVyKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuX3RoaXJkUGVyc29uT25seUxheWVyO1xuICB9XG5cbiAgLyoqXG4gICAqIEluIHRoaXMgbWV0aG9kLCBpdCBhc3NpZ25zIGxheWVycyBmb3IgZXZlcnkgbWVzaGVzIGJhc2VkIG9uIG1lc2ggYW5ub3RhdGlvbnMuXG4gICAqIFlvdSBtdXN0IGNhbGwgdGhpcyBtZXRob2QgZmlyc3QgYmVmb3JlIHlvdSB1c2UgdGhlIGxheWVyIGZlYXR1cmUuXG4gICAqXG4gICAqIFRoaXMgaXMgYW4gZXF1aXZhbGVudCBvZiBbVlJNRmlyc3RQZXJzb24uU2V0dXBdKGh0dHBzOi8vZ2l0aHViLmNvbS92cm0tYy9VbmlWUk0vYmxvYi83M2E1YmQ4ZmNkZGFhMmE3YTg3MzUwOTlhOTdlNjNjOWRiM2U1ZWEwL0Fzc2V0cy9WUk0vUnVudGltZS9GaXJzdFBlcnNvbi9WUk1GaXJzdFBlcnNvbi5jcyNMMjk1LUwyOTkpIG9mIHRoZSBVbmlWUk0uXG4gICAqXG4gICAqIFRoZSBgY2FtZXJhTGF5ZXJgIHBhcmFtZXRlciBzcGVjaWZpZXMgd2hpY2ggbGF5ZXIgd2lsbCBiZSBhc3NpZ25lZCBmb3IgYEZpcnN0UGVyc29uT25seWAgLyBgVGhpcmRQZXJzb25Pbmx5YC5cbiAgICogSW4gVW5pVlJNLCB3ZSBzcGVjaWZpZWQgdGhvc2UgYnkgbmFtaW5nIGVhY2ggZGVzaXJlZCBsYXllciBhcyBgRklSU1RQRVJTT05fT05MWV9MQVlFUmAgLyBgVEhJUkRQRVJTT05fT05MWV9MQVlFUmBcbiAgICogYnV0IHdlIGFyZSBnb2luZyB0byBzcGVjaWZ5IHRoZXNlIGxheWVycyBhdCBoZXJlIHNpbmNlIHdlIGFyZSB1bmFibGUgdG8gbmFtZSBsYXllcnMgaW4gVGhyZWUuanMuXG4gICAqXG4gICAqIEBwYXJhbSBjYW1lcmFMYXllciBTcGVjaWZ5IHdoaWNoIGxheWVyIHdpbGwgYmUgZm9yIGBGaXJzdFBlcnNvbk9ubHlgIC8gYFRoaXJkUGVyc29uT25seWAuXG4gICAqL1xuICBwdWJsaWMgc2V0dXAoe1xuICAgIGZpcnN0UGVyc29uT25seUxheWVyID0gVlJNRmlyc3RQZXJzb24uREVGQVVMVF9GSVJTVFBFUlNPTl9PTkxZX0xBWUVSLFxuICAgIHRoaXJkUGVyc29uT25seUxheWVyID0gVlJNRmlyc3RQZXJzb24uREVGQVVMVF9USElSRFBFUlNPTl9PTkxZX0xBWUVSLFxuICB9ID0ge30pOiB2b2lkIHtcbiAgICBpZiAodGhpcy5faW5pdGlhbGl6ZWRMYXllcnMpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5fZmlyc3RQZXJzb25Pbmx5TGF5ZXIgPSBmaXJzdFBlcnNvbk9ubHlMYXllcjtcbiAgICB0aGlzLl90aGlyZFBlcnNvbk9ubHlMYXllciA9IHRoaXJkUGVyc29uT25seUxheWVyO1xuXG4gICAgdGhpcy5tZXNoQW5ub3RhdGlvbnMuZm9yRWFjaCgoaXRlbSkgPT4ge1xuICAgICAgaXRlbS5tZXNoZXMuZm9yRWFjaCgobWVzaCkgPT4ge1xuICAgICAgICBpZiAoaXRlbS50eXBlID09PSAnZmlyc3RQZXJzb25Pbmx5Jykge1xuICAgICAgICAgIG1lc2gubGF5ZXJzLnNldCh0aGlzLl9maXJzdFBlcnNvbk9ubHlMYXllcik7XG4gICAgICAgICAgbWVzaC50cmF2ZXJzZSgoY2hpbGQpID0+IGNoaWxkLmxheWVycy5zZXQodGhpcy5fZmlyc3RQZXJzb25Pbmx5TGF5ZXIpKTtcbiAgICAgICAgfSBlbHNlIGlmIChpdGVtLnR5cGUgPT09ICd0aGlyZFBlcnNvbk9ubHknKSB7XG4gICAgICAgICAgbWVzaC5sYXllcnMuc2V0KHRoaXMuX3RoaXJkUGVyc29uT25seUxheWVyKTtcbiAgICAgICAgICBtZXNoLnRyYXZlcnNlKChjaGlsZCkgPT4gY2hpbGQubGF5ZXJzLnNldCh0aGlzLl90aGlyZFBlcnNvbk9ubHlMYXllcikpO1xuICAgICAgICB9IGVsc2UgaWYgKGl0ZW0udHlwZSA9PT0gJ2F1dG8nKSB7XG4gICAgICAgICAgdGhpcy5fY3JlYXRlSGVhZGxlc3NNb2RlbChtZXNoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICB0aGlzLl9pbml0aWFsaXplZExheWVycyA9IHRydWU7XG4gIH1cblxuICBwcml2YXRlIF9leGNsdWRlVHJpYW5nbGVzKHRyaWFuZ2xlczogbnVtYmVyW10sIGJ3czogbnVtYmVyW11bXSwgc2tpbkluZGV4OiBudW1iZXJbXVtdLCBleGNsdWRlOiBudW1iZXJbXSk6IG51bWJlciB7XG4gICAgbGV0IGNvdW50ID0gMDtcbiAgICBpZiAoYndzICE9IG51bGwgJiYgYndzLmxlbmd0aCA+IDApIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdHJpYW5nbGVzLmxlbmd0aDsgaSArPSAzKSB7XG4gICAgICAgIGNvbnN0IGEgPSB0cmlhbmdsZXNbaV07XG4gICAgICAgIGNvbnN0IGIgPSB0cmlhbmdsZXNbaSArIDFdO1xuICAgICAgICBjb25zdCBjID0gdHJpYW5nbGVzW2kgKyAyXTtcbiAgICAgICAgY29uc3QgYncwID0gYndzW2FdO1xuICAgICAgICBjb25zdCBza2luMCA9IHNraW5JbmRleFthXTtcblxuICAgICAgICBpZiAoYncwWzBdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4wWzBdKSkgY29udGludWU7XG4gICAgICAgIGlmIChidzBbMV0gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjBbMV0pKSBjb250aW51ZTtcbiAgICAgICAgaWYgKGJ3MFsyXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMFsyXSkpIGNvbnRpbnVlO1xuICAgICAgICBpZiAoYncwWzNdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4wWzNdKSkgY29udGludWU7XG5cbiAgICAgICAgY29uc3QgYncxID0gYndzW2JdO1xuICAgICAgICBjb25zdCBza2luMSA9IHNraW5JbmRleFtiXTtcbiAgICAgICAgaWYgKGJ3MVswXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMVswXSkpIGNvbnRpbnVlO1xuICAgICAgICBpZiAoYncxWzFdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4xWzFdKSkgY29udGludWU7XG4gICAgICAgIGlmIChidzFbMl0gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjFbMl0pKSBjb250aW51ZTtcbiAgICAgICAgaWYgKGJ3MVszXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMVszXSkpIGNvbnRpbnVlO1xuXG4gICAgICAgIGNvbnN0IGJ3MiA9IGJ3c1tjXTtcbiAgICAgICAgY29uc3Qgc2tpbjIgPSBza2luSW5kZXhbY107XG4gICAgICAgIGlmIChidzJbMF0gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjJbMF0pKSBjb250aW51ZTtcbiAgICAgICAgaWYgKGJ3MlsxXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMlsxXSkpIGNvbnRpbnVlO1xuICAgICAgICBpZiAoYncyWzJdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4yWzJdKSkgY29udGludWU7XG4gICAgICAgIGlmIChidzJbM10gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjJbM10pKSBjb250aW51ZTtcblxuICAgICAgICB0cmlhbmdsZXNbY291bnQrK10gPSBhO1xuICAgICAgICB0cmlhbmdsZXNbY291bnQrK10gPSBiO1xuICAgICAgICB0cmlhbmdsZXNbY291bnQrK10gPSBjO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gY291bnQ7XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVFcmFzZWRNZXNoKHNyYzogVEhSRUUuU2tpbm5lZE1lc2gsIGVyYXNpbmdCb25lc0luZGV4OiBudW1iZXJbXSk6IFRIUkVFLlNraW5uZWRNZXNoIHtcbiAgICBjb25zdCBkc3QgPSBuZXcgVEhSRUUuU2tpbm5lZE1lc2goc3JjLmdlb21ldHJ5LmNsb25lKCksIHNyYy5tYXRlcmlhbCk7XG4gICAgZHN0Lm5hbWUgPSBgJHtzcmMubmFtZX0oZXJhc2UpYDtcbiAgICBkc3QuZnJ1c3R1bUN1bGxlZCA9IHNyYy5mcnVzdHVtQ3VsbGVkO1xuICAgIGRzdC5sYXllcnMuc2V0KHRoaXMuX2ZpcnN0UGVyc29uT25seUxheWVyKTtcblxuICAgIGNvbnN0IGdlb21ldHJ5ID0gZHN0Lmdlb21ldHJ5O1xuXG4gICAgY29uc3Qgc2tpbkluZGV4QXR0ciA9IGdlb21ldHJ5LmdldEF0dHJpYnV0ZSgnc2tpbkluZGV4Jyk7XG4gICAgY29uc3Qgc2tpbkluZGV4QXR0ckFycmF5ID0gc2tpbkluZGV4QXR0ciBpbnN0YW5jZW9mIFRIUkVFLkdMQnVmZmVyQXR0cmlidXRlID8gW10gOiBza2luSW5kZXhBdHRyLmFycmF5O1xuICAgIGNvbnN0IHNraW5JbmRleCA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2tpbkluZGV4QXR0ckFycmF5Lmxlbmd0aDsgaSArPSA0KSB7XG4gICAgICBza2luSW5kZXgucHVzaChbXG4gICAgICAgIHNraW5JbmRleEF0dHJBcnJheVtpXSxcbiAgICAgICAgc2tpbkluZGV4QXR0ckFycmF5W2kgKyAxXSxcbiAgICAgICAgc2tpbkluZGV4QXR0ckFycmF5W2kgKyAyXSxcbiAgICAgICAgc2tpbkluZGV4QXR0ckFycmF5W2kgKyAzXSxcbiAgICAgIF0pO1xuICAgIH1cblxuICAgIGNvbnN0IHNraW5XZWlnaHRBdHRyID0gZ2VvbWV0cnkuZ2V0QXR0cmlidXRlKCdza2luV2VpZ2h0Jyk7XG4gICAgY29uc3Qgc2tpbldlaWdodEF0dHJBcnJheSA9IHNraW5XZWlnaHRBdHRyIGluc3RhbmNlb2YgVEhSRUUuR0xCdWZmZXJBdHRyaWJ1dGUgPyBbXSA6IHNraW5XZWlnaHRBdHRyLmFycmF5O1xuICAgIGNvbnN0IHNraW5XZWlnaHQgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNraW5XZWlnaHRBdHRyQXJyYXkubGVuZ3RoOyBpICs9IDQpIHtcbiAgICAgIHNraW5XZWlnaHQucHVzaChbXG4gICAgICAgIHNraW5XZWlnaHRBdHRyQXJyYXlbaV0sXG4gICAgICAgIHNraW5XZWlnaHRBdHRyQXJyYXlbaSArIDFdLFxuICAgICAgICBza2luV2VpZ2h0QXR0ckFycmF5W2kgKyAyXSxcbiAgICAgICAgc2tpbldlaWdodEF0dHJBcnJheVtpICsgM10sXG4gICAgICBdKTtcbiAgICB9XG5cbiAgICBjb25zdCBpbmRleCA9IGdlb21ldHJ5LmdldEluZGV4KCk7XG4gICAgaWYgKCFpbmRleCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVGhlIGdlb21ldHJ5IGRvZXNuJ3QgaGF2ZSBhbiBpbmRleCBidWZmZXJcIik7XG4gICAgfVxuICAgIGNvbnN0IG9sZFRyaWFuZ2xlcyA9IEFycmF5LmZyb20oaW5kZXguYXJyYXkpO1xuXG4gICAgY29uc3QgY291bnQgPSB0aGlzLl9leGNsdWRlVHJpYW5nbGVzKG9sZFRyaWFuZ2xlcywgc2tpbldlaWdodCwgc2tpbkluZGV4LCBlcmFzaW5nQm9uZXNJbmRleCk7XG4gICAgY29uc3QgbmV3VHJpYW5nbGU6IG51bWJlcltdID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICBuZXdUcmlhbmdsZVtpXSA9IG9sZFRyaWFuZ2xlc1tpXTtcbiAgICB9XG4gICAgZ2VvbWV0cnkuc2V0SW5kZXgobmV3VHJpYW5nbGUpO1xuXG4gICAgLy8gbXRvb24gbWF0ZXJpYWwgaW5jbHVkZXMgb25CZWZvcmVSZW5kZXIuIHRoaXMgaXMgdW5zdXBwb3J0ZWQgYXQgU2tpbm5lZE1lc2gjY2xvbmVcbiAgICBpZiAoc3JjLm9uQmVmb3JlUmVuZGVyKSB7XG4gICAgICBkc3Qub25CZWZvcmVSZW5kZXIgPSBzcmMub25CZWZvcmVSZW5kZXI7XG4gICAgfVxuICAgIGRzdC5iaW5kKG5ldyBUSFJFRS5Ta2VsZXRvbihzcmMuc2tlbGV0b24uYm9uZXMsIHNyYy5za2VsZXRvbi5ib25lSW52ZXJzZXMpLCBuZXcgVEhSRUUuTWF0cml4NCgpKTtcbiAgICByZXR1cm4gZHN0O1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlSGVhZGxlc3NNb2RlbEZvclNraW5uZWRNZXNoKHBhcmVudDogVEhSRUUuT2JqZWN0M0QsIG1lc2g6IFRIUkVFLlNraW5uZWRNZXNoKTogdm9pZCB7XG4gICAgY29uc3QgZXJhc2VCb25lSW5kZXhlczogbnVtYmVyW10gPSBbXTtcbiAgICBtZXNoLnNrZWxldG9uLmJvbmVzLmZvckVhY2goKGJvbmUsIGluZGV4KSA9PiB7XG4gICAgICBpZiAodGhpcy5faXNFcmFzZVRhcmdldChib25lKSkgZXJhc2VCb25lSW5kZXhlcy5wdXNoKGluZGV4KTtcbiAgICB9KTtcblxuICAgIC8vIFVubGlrZSBVbmlWUk0gd2UgZG9uJ3QgY29weSBtZXNoIGlmIG5vIGludmlzaWJsZSBib25lIHdhcyBmb3VuZFxuICAgIGlmICghZXJhc2VCb25lSW5kZXhlcy5sZW5ndGgpIHtcbiAgICAgIG1lc2gubGF5ZXJzLmVuYWJsZSh0aGlzLl90aGlyZFBlcnNvbk9ubHlMYXllcik7XG4gICAgICBtZXNoLmxheWVycy5lbmFibGUodGhpcy5fZmlyc3RQZXJzb25Pbmx5TGF5ZXIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBtZXNoLmxheWVycy5zZXQodGhpcy5fdGhpcmRQZXJzb25Pbmx5TGF5ZXIpO1xuICAgIGNvbnN0IG5ld01lc2ggPSB0aGlzLl9jcmVhdGVFcmFzZWRNZXNoKG1lc2gsIGVyYXNlQm9uZUluZGV4ZXMpO1xuICAgIHBhcmVudC5hZGQobmV3TWVzaCk7XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVIZWFkbGVzc01vZGVsKG5vZGU6IFRIUkVFLk9iamVjdDNEKTogdm9pZCB7XG4gICAgaWYgKG5vZGUudHlwZSA9PT0gJ0dyb3VwJykge1xuICAgICAgbm9kZS5sYXllcnMuc2V0KHRoaXMuX3RoaXJkUGVyc29uT25seUxheWVyKTtcbiAgICAgIGlmICh0aGlzLl9pc0VyYXNlVGFyZ2V0KG5vZGUpKSB7XG4gICAgICAgIG5vZGUudHJhdmVyc2UoKGNoaWxkKSA9PiBjaGlsZC5sYXllcnMuc2V0KHRoaXMuX3RoaXJkUGVyc29uT25seUxheWVyKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBwYXJlbnQgPSBuZXcgVEhSRUUuR3JvdXAoKTtcbiAgICAgICAgcGFyZW50Lm5hbWUgPSBgX2hlYWRsZXNzXyR7bm9kZS5uYW1lfWA7XG4gICAgICAgIHBhcmVudC5sYXllcnMuc2V0KHRoaXMuX2ZpcnN0UGVyc29uT25seUxheWVyKTtcbiAgICAgICAgbm9kZS5wYXJlbnQhLmFkZChwYXJlbnQpO1xuICAgICAgICBub2RlLmNoaWxkcmVuXG4gICAgICAgICAgLmZpbHRlcigoY2hpbGQpID0+IGNoaWxkLnR5cGUgPT09ICdTa2lubmVkTWVzaCcpXG4gICAgICAgICAgLmZvckVhY2goKGNoaWxkKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBza2lubmVkTWVzaCA9IGNoaWxkIGFzIFRIUkVFLlNraW5uZWRNZXNoO1xuICAgICAgICAgICAgdGhpcy5fY3JlYXRlSGVhZGxlc3NNb2RlbEZvclNraW5uZWRNZXNoKHBhcmVudCwgc2tpbm5lZE1lc2gpO1xuICAgICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobm9kZS50eXBlID09PSAnU2tpbm5lZE1lc2gnKSB7XG4gICAgICBjb25zdCBza2lubmVkTWVzaCA9IG5vZGUgYXMgVEhSRUUuU2tpbm5lZE1lc2g7XG4gICAgICB0aGlzLl9jcmVhdGVIZWFkbGVzc01vZGVsRm9yU2tpbm5lZE1lc2gobm9kZS5wYXJlbnQhLCBza2lubmVkTWVzaCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0aGlzLl9pc0VyYXNlVGFyZ2V0KG5vZGUpKSB7XG4gICAgICAgIG5vZGUubGF5ZXJzLnNldCh0aGlzLl90aGlyZFBlcnNvbk9ubHlMYXllcik7XG4gICAgICAgIG5vZGUudHJhdmVyc2UoKGNoaWxkKSA9PiBjaGlsZC5sYXllcnMuc2V0KHRoaXMuX3RoaXJkUGVyc29uT25seUxheWVyKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfaXNFcmFzZVRhcmdldChib25lOiBUSFJFRS5PYmplY3QzRCk6IGJvb2xlYW4ge1xuICAgIGlmIChib25lID09PSB0aGlzLmh1bWFub2lkLmdldFJhd0JvbmVOb2RlKCdoZWFkJykpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSBpZiAoIWJvbmUucGFyZW50KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLl9pc0VyYXNlVGFyZ2V0KGJvbmUucGFyZW50KTtcbiAgICB9XG4gIH1cbn1cbiIsICJpbXBvcnQgdHlwZSAqIGFzIFYwVlJNIGZyb20gJ0BwaXhpdi90eXBlcy12cm0tMC4wJztcbmltcG9ydCB0eXBlICogYXMgVjFWUk1TY2hlbWEgZnJvbSAnQHBpeGl2L3R5cGVzLXZybWMtdnJtLTEuMCc7XG5pbXBvcnQgdHlwZSB7IEdMVEYsIEdMVEZMb2FkZXJQbHVnaW4sIEdMVEZQYXJzZXIgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcbmltcG9ydCB0eXBlIHsgVlJNSHVtYW5vaWQgfSBmcm9tICcuLi9odW1hbm9pZC9WUk1IdW1hbm9pZCc7XG5pbXBvcnQgeyBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZXMgfSBmcm9tICcuLi91dGlscy9nbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZSc7XG5pbXBvcnQgeyBWUk1GaXJzdFBlcnNvbiB9IGZyb20gJy4vVlJNRmlyc3RQZXJzb24nO1xuaW1wb3J0IHR5cGUgeyBWUk1GaXJzdFBlcnNvbk1lc2hBbm5vdGF0aW9uIH0gZnJvbSAnLi9WUk1GaXJzdFBlcnNvbk1lc2hBbm5vdGF0aW9uJztcbmltcG9ydCB0eXBlIHsgVlJNRmlyc3RQZXJzb25NZXNoQW5ub3RhdGlvblR5cGUgfSBmcm9tICcuL1ZSTUZpcnN0UGVyc29uTWVzaEFubm90YXRpb25UeXBlJztcbmltcG9ydCB7IEdMVEYgYXMgR0xURlNjaGVtYSB9IGZyb20gJ0BnbHRmLXRyYW5zZm9ybS9jb3JlJztcblxuLyoqXG4gKiBQb3NzaWJsZSBzcGVjIHZlcnNpb25zIGl0IHJlY29nbml6ZXMuXG4gKi9cbmNvbnN0IFBPU1NJQkxFX1NQRUNfVkVSU0lPTlMgPSBuZXcgU2V0KFsnMS4wJywgJzEuMC1iZXRhJ10pO1xuXG4vKipcbiAqIEEgcGx1Z2luIG9mIEdMVEZMb2FkZXIgdGhhdCBpbXBvcnRzIGEge0BsaW5rIFZSTUZpcnN0UGVyc29ufSBmcm9tIGEgVlJNIGV4dGVuc2lvbiBvZiBhIEdMVEYuXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1GaXJzdFBlcnNvbkxvYWRlclBsdWdpbiBpbXBsZW1lbnRzIEdMVEZMb2FkZXJQbHVnaW4ge1xuICBwdWJsaWMgcmVhZG9ubHkgcGFyc2VyOiBHTFRGUGFyc2VyO1xuXG4gIHB1YmxpYyBnZXQgbmFtZSgpOiBzdHJpbmcge1xuICAgIC8vIFdlIHNob3VsZCB1c2UgdGhlIGV4dGVuc2lvbiBuYW1lIGluc3RlYWQgYnV0IHdlIGhhdmUgbXVsdGlwbGUgcGx1Z2lucyBmb3IgYW4gZXh0ZW5zaW9uLi4uXG4gICAgcmV0dXJuICdWUk1GaXJzdFBlcnNvbkxvYWRlclBsdWdpbic7XG4gIH1cblxuICBwdWJsaWMgY29uc3RydWN0b3IocGFyc2VyOiBHTFRGUGFyc2VyKSB7XG4gICAgdGhpcy5wYXJzZXIgPSBwYXJzZXI7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgYWZ0ZXJSb290KGdsdGY6IEdMVEYpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB2cm1IdW1hbm9pZCA9IGdsdGYudXNlckRhdGEudnJtSHVtYW5vaWQgYXMgVlJNSHVtYW5vaWQgfCB1bmRlZmluZWQ7XG5cbiAgICAvLyBleHBsaWNpdGx5IGRpc3Rpbmd1aXNoIG51bGwgYW5kIHVuZGVmaW5lZFxuICAgIC8vIHNpbmNlIHZybUh1bWFub2lkIG1pZ2h0IGJlIG51bGwgYXMgYSByZXN1bHRcbiAgICBpZiAodnJtSHVtYW5vaWQgPT09IG51bGwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9IGVsc2UgaWYgKHZybUh1bWFub2lkID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ1ZSTUZpcnN0UGVyc29uTG9hZGVyUGx1Z2luOiB2cm1IdW1hbm9pZCBpcyB1bmRlZmluZWQuIFZSTUh1bWFub2lkTG9hZGVyUGx1Z2luIGhhdmUgdG8gYmUgdXNlZCBmaXJzdCcsXG4gICAgICApO1xuICAgIH1cblxuICAgIGdsdGYudXNlckRhdGEudnJtRmlyc3RQZXJzb24gPSBhd2FpdCB0aGlzLl9pbXBvcnQoZ2x0ZiwgdnJtSHVtYW5vaWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEltcG9ydCBhIHtAbGluayBWUk1GaXJzdFBlcnNvbn0gZnJvbSBhIFZSTS5cbiAgICpcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgcmVzdWx0IG9mIEdMVEYgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXG4gICAqIEBwYXJhbSBodW1hbm9pZCBBIHtAbGluayBWUk1IdW1hbm9pZH0gaW5zdGFuY2UgdGhhdCByZXByZXNlbnRzIHRoZSBWUk1cbiAgICovXG5cbiAgcHJpdmF0ZSBhc3luYyBfaW1wb3J0KGdsdGY6IEdMVEYsIGh1bWFub2lkOiBWUk1IdW1hbm9pZCB8IG51bGwpOiBQcm9taXNlPFZSTUZpcnN0UGVyc29uIHwgbnVsbD4ge1xuICAgIGlmIChodW1hbm9pZCA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCB2MVJlc3VsdCA9IGF3YWl0IHRoaXMuX3YxSW1wb3J0KGdsdGYsIGh1bWFub2lkKTtcbiAgICBpZiAodjFSZXN1bHQpIHtcbiAgICAgIHJldHVybiB2MVJlc3VsdDtcbiAgICB9XG5cbiAgICBjb25zdCB2MFJlc3VsdCA9IGF3YWl0IHRoaXMuX3YwSW1wb3J0KGdsdGYsIGh1bWFub2lkKTtcbiAgICBpZiAodjBSZXN1bHQpIHtcbiAgICAgIHJldHVybiB2MFJlc3VsdDtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgX3YxSW1wb3J0KGdsdGY6IEdMVEYsIGh1bWFub2lkOiBWUk1IdW1hbm9pZCk6IFByb21pc2U8VlJNRmlyc3RQZXJzb24gfCBudWxsPiB7XG4gICAgY29uc3QganNvbiA9IHRoaXMucGFyc2VyLmpzb24gYXMgR0xURlNjaGVtYS5JR0xURjtcblxuICAgIC8vIGVhcmx5IGFib3J0IGlmIGl0IGRvZXNuJ3QgdXNlIHZybVxuICAgIGNvbnN0IGlzVlJNVXNlZCA9IGpzb24uZXh0ZW5zaW9uc1VzZWQ/LmluZGV4T2YoJ1ZSTUNfdnJtJykgIT09IC0xO1xuICAgIGlmICghaXNWUk1Vc2VkKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBleHRlbnNpb24gPSBqc29uLmV4dGVuc2lvbnM/LlsnVlJNQ192cm0nXSBhcyBWMVZSTVNjaGVtYS5WUk1DVlJNIHwgdW5kZWZpbmVkO1xuICAgIGlmICghZXh0ZW5zaW9uKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBzcGVjVmVyc2lvbiA9IGV4dGVuc2lvbi5zcGVjVmVyc2lvbjtcbiAgICBpZiAoIVBPU1NJQkxFX1NQRUNfVkVSU0lPTlMuaGFzKHNwZWNWZXJzaW9uKSkge1xuICAgICAgY29uc29sZS53YXJuKGBWUk1GaXJzdFBlcnNvbkxvYWRlclBsdWdpbjogVW5rbm93biBWUk1DX3ZybSBzcGVjVmVyc2lvbiBcIiR7c3BlY1ZlcnNpb259XCJgKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IHNjaGVtYUZpcnN0UGVyc29uID0gZXh0ZW5zaW9uLmZpcnN0UGVyc29uO1xuXG4gICAgY29uc3QgbWVzaEFubm90YXRpb25zOiBWUk1GaXJzdFBlcnNvbk1lc2hBbm5vdGF0aW9uW10gPSBbXTtcbiAgICBjb25zdCBub2RlUHJpbWl0aXZlc01hcCA9IGF3YWl0IGdsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlcyhnbHRmKTtcbiAgICBBcnJheS5mcm9tKG5vZGVQcmltaXRpdmVzTWFwLmVudHJpZXMoKSkuZm9yRWFjaCgoW25vZGVJbmRleCwgcHJpbWl0aXZlc10pID0+IHtcbiAgICAgIGNvbnN0IGFubm90YXRpb24gPSBzY2hlbWFGaXJzdFBlcnNvbj8ubWVzaEFubm90YXRpb25zPy5maW5kKChhKSA9PiBhLm5vZGUgPT09IG5vZGVJbmRleCk7XG5cbiAgICAgIG1lc2hBbm5vdGF0aW9ucy5wdXNoKHtcbiAgICAgICAgbWVzaGVzOiBwcmltaXRpdmVzLFxuICAgICAgICB0eXBlOiBhbm5vdGF0aW9uPy50eXBlID8/ICdhdXRvJyxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIG5ldyBWUk1GaXJzdFBlcnNvbihodW1hbm9pZCwgbWVzaEFubm90YXRpb25zKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgX3YwSW1wb3J0KGdsdGY6IEdMVEYsIGh1bWFub2lkOiBWUk1IdW1hbm9pZCk6IFByb21pc2U8VlJNRmlyc3RQZXJzb24gfCBudWxsPiB7XG4gICAgY29uc3QganNvbiA9IHRoaXMucGFyc2VyLmpzb24gYXMgR0xURlNjaGVtYS5JR0xURjtcblxuICAgIGNvbnN0IHZybUV4dCA9IGpzb24uZXh0ZW5zaW9ucz8uVlJNIGFzIFYwVlJNLlZSTSB8IHVuZGVmaW5lZDtcbiAgICBpZiAoIXZybUV4dCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgc2NoZW1hRmlyc3RQZXJzb246IFYwVlJNLkZpcnN0UGVyc29uIHwgdW5kZWZpbmVkID0gdnJtRXh0LmZpcnN0UGVyc29uO1xuICAgIGlmICghc2NoZW1hRmlyc3RQZXJzb24pIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IG1lc2hBbm5vdGF0aW9uczogVlJNRmlyc3RQZXJzb25NZXNoQW5ub3RhdGlvbltdID0gW107XG4gICAgY29uc3Qgbm9kZVByaW1pdGl2ZXNNYXAgPSBhd2FpdCBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZXMoZ2x0Zik7XG5cbiAgICBBcnJheS5mcm9tKG5vZGVQcmltaXRpdmVzTWFwLmVudHJpZXMoKSkuZm9yRWFjaCgoW25vZGVJbmRleCwgcHJpbWl0aXZlc10pID0+IHtcbiAgICAgIGNvbnN0IHNjaGVtYU5vZGUgPSBqc29uLm5vZGVzIVtub2RlSW5kZXhdO1xuXG4gICAgICBjb25zdCBmbGFnID0gc2NoZW1hRmlyc3RQZXJzb24ubWVzaEFubm90YXRpb25zXG4gICAgICAgID8gc2NoZW1hRmlyc3RQZXJzb24ubWVzaEFubm90YXRpb25zLmZpbmQoKGEpID0+IGEubWVzaCA9PT0gc2NoZW1hTm9kZS5tZXNoKVxuICAgICAgICA6IHVuZGVmaW5lZDtcblxuICAgICAgbWVzaEFubm90YXRpb25zLnB1c2goe1xuICAgICAgICBtZXNoZXM6IHByaW1pdGl2ZXMsXG4gICAgICAgIHR5cGU6IHRoaXMuX2NvbnZlcnRWMEZsYWdUb1YxVHlwZShmbGFnPy5maXJzdFBlcnNvbkZsYWcpLFxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gbmV3IFZSTUZpcnN0UGVyc29uKGh1bWFub2lkLCBtZXNoQW5ub3RhdGlvbnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29udmVydFYwRmxhZ1RvVjFUeXBlKGZsYWc6IHN0cmluZyB8IHVuZGVmaW5lZCk6IFZSTUZpcnN0UGVyc29uTWVzaEFubm90YXRpb25UeXBlIHtcbiAgICBpZiAoZmxhZyA9PT0gJ0ZpcnN0UGVyc29uT25seScpIHtcbiAgICAgIHJldHVybiAnZmlyc3RQZXJzb25Pbmx5JztcbiAgICB9IGVsc2UgaWYgKGZsYWcgPT09ICdUaGlyZFBlcnNvbk9ubHknKSB7XG4gICAgICByZXR1cm4gJ3RoaXJkUGVyc29uT25seSc7XG4gICAgfSBlbHNlIGlmIChmbGFnID09PSAnQm90aCcpIHtcbiAgICAgIHJldHVybiAnYm90aCc7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRoZSBkZWZhdWx0IHZhbHVlIGlzICdBdXRvJyBldmVuIGluIFZSTTBcbiAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3ZybS1jL1VuaVZSTS9ibG9iLzA3ZDk4ZTJmMWFiYzUyOGQzODdmODYwZDIyMjRkMDg1NWIwZDBiNTkvQXNzZXRzL1ZSTS9SdW50aW1lL0ZpcnN0UGVyc29uL1ZSTUZpcnN0UGVyc29uLmNzI0wxMTctTDExOVxuICAgICAgcmV0dXJuICdhdXRvJztcbiAgICB9XG4gIH1cbn1cbiIsICIvKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb24gKi9cblxuZXhwb3J0IGNvbnN0IFZSTUZpcnN0UGVyc29uTWVzaEFubm90YXRpb25UeXBlID0ge1xuICBBdXRvOiAnYXV0bycsXG4gIEJvdGg6ICdib3RoJyxcbiAgVGhpcmRQZXJzb25Pbmx5OiAndGhpcmRQZXJzb25Pbmx5JyxcbiAgRmlyc3RQZXJzb25Pbmx5OiAnZmlyc3RQZXJzb25Pbmx5Jyxcbn0gYXMgY29uc3Q7XG5cbmV4cG9ydCB0eXBlIFZSTUZpcnN0UGVyc29uTWVzaEFubm90YXRpb25UeXBlID1cbiAgKHR5cGVvZiBWUk1GaXJzdFBlcnNvbk1lc2hBbm5vdGF0aW9uVHlwZSlba2V5b2YgdHlwZW9mIFZSTUZpcnN0UGVyc29uTWVzaEFubm90YXRpb25UeXBlXTtcbiIsICJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBWUk1IdW1hbkJvbmUgfSBmcm9tICcuLi9WUk1IdW1hbkJvbmUnO1xuaW1wb3J0IHsgVlJNSHVtYW5vaWQgfSBmcm9tICcuLi9WUk1IdW1hbm9pZCc7XG5cbmNvbnN0IF92M0EgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuY29uc3QgX3YzQiA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5jb25zdCBfcXVhdEEgPSBuZXcgVEhSRUUuUXVhdGVybmlvbigpO1xuXG5leHBvcnQgY2xhc3MgVlJNSHVtYW5vaWRIZWxwZXIgZXh0ZW5kcyBUSFJFRS5Hcm91cCB7XG4gIHB1YmxpYyByZWFkb25seSB2cm1IdW1hbm9pZDogVlJNSHVtYW5vaWQ7XG4gIHByaXZhdGUgX2JvbmVBeGVzTWFwOiBNYXA8VlJNSHVtYW5Cb25lLCBUSFJFRS5BeGVzSGVscGVyPjtcblxuICBwdWJsaWMgY29uc3RydWN0b3IoaHVtYW5vaWQ6IFZSTUh1bWFub2lkKSB7XG4gICAgc3VwZXIoKTtcblxuICAgIHRoaXMudnJtSHVtYW5vaWQgPSBodW1hbm9pZDtcblxuICAgIHRoaXMuX2JvbmVBeGVzTWFwID0gbmV3IE1hcCgpO1xuXG4gICAgT2JqZWN0LnZhbHVlcyhodW1hbm9pZC5odW1hbkJvbmVzKS5mb3JFYWNoKChib25lKSA9PiB7XG4gICAgICBjb25zdCBoZWxwZXIgPSBuZXcgVEhSRUUuQXhlc0hlbHBlcigxLjApO1xuXG4gICAgICBoZWxwZXIubWF0cml4QXV0b1VwZGF0ZSA9IGZhbHNlO1xuXG4gICAgICAoaGVscGVyLm1hdGVyaWFsIGFzIFRIUkVFLk1hdGVyaWFsKS5kZXB0aFRlc3QgPSBmYWxzZTtcbiAgICAgIChoZWxwZXIubWF0ZXJpYWwgYXMgVEhSRUUuTWF0ZXJpYWwpLmRlcHRoV3JpdGUgPSBmYWxzZTtcblxuICAgICAgdGhpcy5hZGQoaGVscGVyKTtcblxuICAgICAgdGhpcy5fYm9uZUF4ZXNNYXAuc2V0KGJvbmUsIGhlbHBlcik7XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgZGlzcG9zZSgpOiB2b2lkIHtcbiAgICBBcnJheS5mcm9tKHRoaXMuX2JvbmVBeGVzTWFwLnZhbHVlcygpKS5mb3JFYWNoKChheGVzKSA9PiB7XG4gICAgICBheGVzLmdlb21ldHJ5LmRpc3Bvc2UoKTtcbiAgICAgIChheGVzLm1hdGVyaWFsIGFzIFRIUkVFLk1hdGVyaWFsKS5kaXNwb3NlKCk7XG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgdXBkYXRlTWF0cml4V29ybGQoZm9yY2U6IGJvb2xlYW4pOiB2b2lkIHtcbiAgICBBcnJheS5mcm9tKHRoaXMuX2JvbmVBeGVzTWFwLmVudHJpZXMoKSkuZm9yRWFjaCgoW2JvbmUsIGF4ZXNdKSA9PiB7XG4gICAgICBib25lLm5vZGUudXBkYXRlV29ybGRNYXRyaXgodHJ1ZSwgZmFsc2UpO1xuXG4gICAgICBib25lLm5vZGUubWF0cml4V29ybGQuZGVjb21wb3NlKF92M0EsIF9xdWF0QSwgX3YzQik7XG5cbiAgICAgIGNvbnN0IHNjYWxlID0gX3YzQS5zZXQoMC4xLCAwLjEsIDAuMSkuZGl2aWRlKF92M0IpO1xuICAgICAgYXhlcy5tYXRyaXguY29weShib25lLm5vZGUubWF0cml4V29ybGQpLnNjYWxlKHNjYWxlKTtcbiAgICB9KTtcblxuICAgIHN1cGVyLnVwZGF0ZU1hdHJpeFdvcmxkKGZvcmNlKTtcbiAgfVxufVxuIiwgIi8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvbiAqL1xuXG5pbXBvcnQgeyBWUk1IdW1hbkJvbmVOYW1lIH0gZnJvbSAnLi9WUk1IdW1hbkJvbmVOYW1lJztcblxuLyoqXG4gKiBUaGUgbGlzdCBvZiB7QGxpbmsgVlJNSHVtYW5Cb25lTmFtZX0uIERlcGVuZGVuY3kgYXdhcmUuXG4gKi9cbmV4cG9ydCBjb25zdCBWUk1IdW1hbkJvbmVMaXN0OiBWUk1IdW1hbkJvbmVOYW1lW10gPSBbXG4gICdoaXBzJyxcbiAgJ3NwaW5lJyxcbiAgJ2NoZXN0JyxcbiAgJ3VwcGVyQ2hlc3QnLFxuICAnbmVjaycsXG5cbiAgJ2hlYWQnLFxuICAnbGVmdEV5ZScsXG4gICdyaWdodEV5ZScsXG4gICdqYXcnLFxuXG4gICdsZWZ0VXBwZXJMZWcnLFxuICAnbGVmdExvd2VyTGVnJyxcbiAgJ2xlZnRGb290JyxcbiAgJ2xlZnRUb2VzJyxcblxuICAncmlnaHRVcHBlckxlZycsXG4gICdyaWdodExvd2VyTGVnJyxcbiAgJ3JpZ2h0Rm9vdCcsXG4gICdyaWdodFRvZXMnLFxuXG4gICdsZWZ0U2hvdWxkZXInLFxuICAnbGVmdFVwcGVyQXJtJyxcbiAgJ2xlZnRMb3dlckFybScsXG4gICdsZWZ0SGFuZCcsXG5cbiAgJ3JpZ2h0U2hvdWxkZXInLFxuICAncmlnaHRVcHBlckFybScsXG4gICdyaWdodExvd2VyQXJtJyxcbiAgJ3JpZ2h0SGFuZCcsXG5cbiAgJ2xlZnRUaHVtYk1ldGFjYXJwYWwnLFxuICAnbGVmdFRodW1iUHJveGltYWwnLFxuICAnbGVmdFRodW1iRGlzdGFsJyxcbiAgJ2xlZnRJbmRleFByb3hpbWFsJyxcbiAgJ2xlZnRJbmRleEludGVybWVkaWF0ZScsXG4gICdsZWZ0SW5kZXhEaXN0YWwnLFxuICAnbGVmdE1pZGRsZVByb3hpbWFsJyxcbiAgJ2xlZnRNaWRkbGVJbnRlcm1lZGlhdGUnLFxuICAnbGVmdE1pZGRsZURpc3RhbCcsXG4gICdsZWZ0UmluZ1Byb3hpbWFsJyxcbiAgJ2xlZnRSaW5nSW50ZXJtZWRpYXRlJyxcbiAgJ2xlZnRSaW5nRGlzdGFsJyxcbiAgJ2xlZnRMaXR0bGVQcm94aW1hbCcsXG4gICdsZWZ0TGl0dGxlSW50ZXJtZWRpYXRlJyxcbiAgJ2xlZnRMaXR0bGVEaXN0YWwnLFxuXG4gICdyaWdodFRodW1iTWV0YWNhcnBhbCcsXG4gICdyaWdodFRodW1iUHJveGltYWwnLFxuICAncmlnaHRUaHVtYkRpc3RhbCcsXG4gICdyaWdodEluZGV4UHJveGltYWwnLFxuICAncmlnaHRJbmRleEludGVybWVkaWF0ZScsXG4gICdyaWdodEluZGV4RGlzdGFsJyxcbiAgJ3JpZ2h0TWlkZGxlUHJveGltYWwnLFxuICAncmlnaHRNaWRkbGVJbnRlcm1lZGlhdGUnLFxuICAncmlnaHRNaWRkbGVEaXN0YWwnLFxuICAncmlnaHRSaW5nUHJveGltYWwnLFxuICAncmlnaHRSaW5nSW50ZXJtZWRpYXRlJyxcbiAgJ3JpZ2h0UmluZ0Rpc3RhbCcsXG4gICdyaWdodExpdHRsZVByb3hpbWFsJyxcbiAgJ3JpZ2h0TGl0dGxlSW50ZXJtZWRpYXRlJyxcbiAgJ3JpZ2h0TGl0dGxlRGlzdGFsJyxcbl07XG4iLCAiLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uICovXG5cbi8qKlxuICogVGhlIG5hbWVzIG9mIHtAbGluayBWUk1IdW1hbm9pZH0gYm9uZSBuYW1lcy5cbiAqXG4gKiBSZWY6IGh0dHBzOi8vZ2l0aHViLmNvbS92cm0tYy92cm0tc3BlY2lmaWNhdGlvbi9ibG9iL21hc3Rlci9zcGVjaWZpY2F0aW9uL1ZSTUNfdnJtLTEuMC9odW1hbm9pZC5tZFxuICovXG5leHBvcnQgY29uc3QgVlJNSHVtYW5Cb25lTmFtZSA9IHtcbiAgSGlwczogJ2hpcHMnLFxuICBTcGluZTogJ3NwaW5lJyxcbiAgQ2hlc3Q6ICdjaGVzdCcsXG4gIFVwcGVyQ2hlc3Q6ICd1cHBlckNoZXN0JyxcbiAgTmVjazogJ25lY2snLFxuXG4gIEhlYWQ6ICdoZWFkJyxcbiAgTGVmdEV5ZTogJ2xlZnRFeWUnLFxuICBSaWdodEV5ZTogJ3JpZ2h0RXllJyxcbiAgSmF3OiAnamF3JyxcblxuICBMZWZ0VXBwZXJMZWc6ICdsZWZ0VXBwZXJMZWcnLFxuICBMZWZ0TG93ZXJMZWc6ICdsZWZ0TG93ZXJMZWcnLFxuICBMZWZ0Rm9vdDogJ2xlZnRGb290JyxcbiAgTGVmdFRvZXM6ICdsZWZ0VG9lcycsXG5cbiAgUmlnaHRVcHBlckxlZzogJ3JpZ2h0VXBwZXJMZWcnLFxuICBSaWdodExvd2VyTGVnOiAncmlnaHRMb3dlckxlZycsXG4gIFJpZ2h0Rm9vdDogJ3JpZ2h0Rm9vdCcsXG4gIFJpZ2h0VG9lczogJ3JpZ2h0VG9lcycsXG5cbiAgTGVmdFNob3VsZGVyOiAnbGVmdFNob3VsZGVyJyxcbiAgTGVmdFVwcGVyQXJtOiAnbGVmdFVwcGVyQXJtJyxcbiAgTGVmdExvd2VyQXJtOiAnbGVmdExvd2VyQXJtJyxcbiAgTGVmdEhhbmQ6ICdsZWZ0SGFuZCcsXG5cbiAgUmlnaHRTaG91bGRlcjogJ3JpZ2h0U2hvdWxkZXInLFxuICBSaWdodFVwcGVyQXJtOiAncmlnaHRVcHBlckFybScsXG4gIFJpZ2h0TG93ZXJBcm06ICdyaWdodExvd2VyQXJtJyxcbiAgUmlnaHRIYW5kOiAncmlnaHRIYW5kJyxcblxuICBMZWZ0VGh1bWJNZXRhY2FycGFsOiAnbGVmdFRodW1iTWV0YWNhcnBhbCcsXG4gIExlZnRUaHVtYlByb3hpbWFsOiAnbGVmdFRodW1iUHJveGltYWwnLFxuICBMZWZ0VGh1bWJEaXN0YWw6ICdsZWZ0VGh1bWJEaXN0YWwnLFxuICBMZWZ0SW5kZXhQcm94aW1hbDogJ2xlZnRJbmRleFByb3hpbWFsJyxcbiAgTGVmdEluZGV4SW50ZXJtZWRpYXRlOiAnbGVmdEluZGV4SW50ZXJtZWRpYXRlJyxcbiAgTGVmdEluZGV4RGlzdGFsOiAnbGVmdEluZGV4RGlzdGFsJyxcbiAgTGVmdE1pZGRsZVByb3hpbWFsOiAnbGVmdE1pZGRsZVByb3hpbWFsJyxcbiAgTGVmdE1pZGRsZUludGVybWVkaWF0ZTogJ2xlZnRNaWRkbGVJbnRlcm1lZGlhdGUnLFxuICBMZWZ0TWlkZGxlRGlzdGFsOiAnbGVmdE1pZGRsZURpc3RhbCcsXG4gIExlZnRSaW5nUHJveGltYWw6ICdsZWZ0UmluZ1Byb3hpbWFsJyxcbiAgTGVmdFJpbmdJbnRlcm1lZGlhdGU6ICdsZWZ0UmluZ0ludGVybWVkaWF0ZScsXG4gIExlZnRSaW5nRGlzdGFsOiAnbGVmdFJpbmdEaXN0YWwnLFxuICBMZWZ0TGl0dGxlUHJveGltYWw6ICdsZWZ0TGl0dGxlUHJveGltYWwnLFxuICBMZWZ0TGl0dGxlSW50ZXJtZWRpYXRlOiAnbGVmdExpdHRsZUludGVybWVkaWF0ZScsXG4gIExlZnRMaXR0bGVEaXN0YWw6ICdsZWZ0TGl0dGxlRGlzdGFsJyxcblxuICBSaWdodFRodW1iTWV0YWNhcnBhbDogJ3JpZ2h0VGh1bWJNZXRhY2FycGFsJyxcbiAgUmlnaHRUaHVtYlByb3hpbWFsOiAncmlnaHRUaHVtYlByb3hpbWFsJyxcbiAgUmlnaHRUaHVtYkRpc3RhbDogJ3JpZ2h0VGh1bWJEaXN0YWwnLFxuICBSaWdodEluZGV4UHJveGltYWw6ICdyaWdodEluZGV4UHJveGltYWwnLFxuICBSaWdodEluZGV4SW50ZXJtZWRpYXRlOiAncmlnaHRJbmRleEludGVybWVkaWF0ZScsXG4gIFJpZ2h0SW5kZXhEaXN0YWw6ICdyaWdodEluZGV4RGlzdGFsJyxcbiAgUmlnaHRNaWRkbGVQcm94aW1hbDogJ3JpZ2h0TWlkZGxlUHJveGltYWwnLFxuICBSaWdodE1pZGRsZUludGVybWVkaWF0ZTogJ3JpZ2h0TWlkZGxlSW50ZXJtZWRpYXRlJyxcbiAgUmlnaHRNaWRkbGVEaXN0YWw6ICdyaWdodE1pZGRsZURpc3RhbCcsXG4gIFJpZ2h0UmluZ1Byb3hpbWFsOiAncmlnaHRSaW5nUHJveGltYWwnLFxuICBSaWdodFJpbmdJbnRlcm1lZGlhdGU6ICdyaWdodFJpbmdJbnRlcm1lZGlhdGUnLFxuICBSaWdodFJpbmdEaXN0YWw6ICdyaWdodFJpbmdEaXN0YWwnLFxuICBSaWdodExpdHRsZVByb3hpbWFsOiAncmlnaHRMaXR0bGVQcm94aW1hbCcsXG4gIFJpZ2h0TGl0dGxlSW50ZXJtZWRpYXRlOiAncmlnaHRMaXR0bGVJbnRlcm1lZGlhdGUnLFxuICBSaWdodExpdHRsZURpc3RhbDogJ3JpZ2h0TGl0dGxlRGlzdGFsJyxcbn0gYXMgY29uc3Q7XG5cbmV4cG9ydCB0eXBlIFZSTUh1bWFuQm9uZU5hbWUgPSAodHlwZW9mIFZSTUh1bWFuQm9uZU5hbWUpW2tleW9mIHR5cGVvZiBWUk1IdW1hbkJvbmVOYW1lXTtcbiIsICIvKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb24gKi9cblxuaW1wb3J0IHsgVlJNSHVtYW5Cb25lTmFtZSB9IGZyb20gJy4vVlJNSHVtYW5Cb25lTmFtZSc7XG5cbi8qKlxuICogQW4gb2JqZWN0IHRoYXQgbWFwcyBmcm9tIHtAbGluayBWUk1IdW1hbkJvbmVOYW1lfSB0byBpdHMgcGFyZW50IHtAbGluayBWUk1IdW1hbkJvbmVOYW1lfS5cbiAqXG4gKiBSZWY6IGh0dHBzOi8vZ2l0aHViLmNvbS92cm0tYy92cm0tc3BlY2lmaWNhdGlvbi9ibG9iL21hc3Rlci9zcGVjaWZpY2F0aW9uL1ZSTUNfdnJtLTEuMC9odW1hbm9pZC5tZFxuICovXG5leHBvcnQgY29uc3QgVlJNSHVtYW5Cb25lUGFyZW50TWFwOiB7IFtib25lIGluIFZSTUh1bWFuQm9uZU5hbWVdOiBWUk1IdW1hbkJvbmVOYW1lIHwgbnVsbCB9ID0ge1xuICBoaXBzOiBudWxsLFxuICBzcGluZTogJ2hpcHMnLFxuICBjaGVzdDogJ3NwaW5lJyxcbiAgdXBwZXJDaGVzdDogJ2NoZXN0JyxcbiAgbmVjazogJ3VwcGVyQ2hlc3QnLFxuXG4gIGhlYWQ6ICduZWNrJyxcbiAgbGVmdEV5ZTogJ2hlYWQnLFxuICByaWdodEV5ZTogJ2hlYWQnLFxuICBqYXc6ICdoZWFkJyxcblxuICBsZWZ0VXBwZXJMZWc6ICdoaXBzJyxcbiAgbGVmdExvd2VyTGVnOiAnbGVmdFVwcGVyTGVnJyxcbiAgbGVmdEZvb3Q6ICdsZWZ0TG93ZXJMZWcnLFxuICBsZWZ0VG9lczogJ2xlZnRGb290JyxcblxuICByaWdodFVwcGVyTGVnOiAnaGlwcycsXG4gIHJpZ2h0TG93ZXJMZWc6ICdyaWdodFVwcGVyTGVnJyxcbiAgcmlnaHRGb290OiAncmlnaHRMb3dlckxlZycsXG4gIHJpZ2h0VG9lczogJ3JpZ2h0Rm9vdCcsXG5cbiAgbGVmdFNob3VsZGVyOiAndXBwZXJDaGVzdCcsXG4gIGxlZnRVcHBlckFybTogJ2xlZnRTaG91bGRlcicsXG4gIGxlZnRMb3dlckFybTogJ2xlZnRVcHBlckFybScsXG4gIGxlZnRIYW5kOiAnbGVmdExvd2VyQXJtJyxcblxuICByaWdodFNob3VsZGVyOiAndXBwZXJDaGVzdCcsXG4gIHJpZ2h0VXBwZXJBcm06ICdyaWdodFNob3VsZGVyJyxcbiAgcmlnaHRMb3dlckFybTogJ3JpZ2h0VXBwZXJBcm0nLFxuICByaWdodEhhbmQ6ICdyaWdodExvd2VyQXJtJyxcblxuICBsZWZ0VGh1bWJNZXRhY2FycGFsOiAnbGVmdEhhbmQnLFxuICBsZWZ0VGh1bWJQcm94aW1hbDogJ2xlZnRUaHVtYk1ldGFjYXJwYWwnLFxuICBsZWZ0VGh1bWJEaXN0YWw6ICdsZWZ0VGh1bWJQcm94aW1hbCcsXG4gIGxlZnRJbmRleFByb3hpbWFsOiAnbGVmdEhhbmQnLFxuICBsZWZ0SW5kZXhJbnRlcm1lZGlhdGU6ICdsZWZ0SW5kZXhQcm94aW1hbCcsXG4gIGxlZnRJbmRleERpc3RhbDogJ2xlZnRJbmRleEludGVybWVkaWF0ZScsXG4gIGxlZnRNaWRkbGVQcm94aW1hbDogJ2xlZnRIYW5kJyxcbiAgbGVmdE1pZGRsZUludGVybWVkaWF0ZTogJ2xlZnRNaWRkbGVQcm94aW1hbCcsXG4gIGxlZnRNaWRkbGVEaXN0YWw6ICdsZWZ0TWlkZGxlSW50ZXJtZWRpYXRlJyxcbiAgbGVmdFJpbmdQcm94aW1hbDogJ2xlZnRIYW5kJyxcbiAgbGVmdFJpbmdJbnRlcm1lZGlhdGU6ICdsZWZ0UmluZ1Byb3hpbWFsJyxcbiAgbGVmdFJpbmdEaXN0YWw6ICdsZWZ0UmluZ0ludGVybWVkaWF0ZScsXG4gIGxlZnRMaXR0bGVQcm94aW1hbDogJ2xlZnRIYW5kJyxcbiAgbGVmdExpdHRsZUludGVybWVkaWF0ZTogJ2xlZnRMaXR0bGVQcm94aW1hbCcsXG4gIGxlZnRMaXR0bGVEaXN0YWw6ICdsZWZ0TGl0dGxlSW50ZXJtZWRpYXRlJyxcblxuICByaWdodFRodW1iTWV0YWNhcnBhbDogJ3JpZ2h0SGFuZCcsXG4gIHJpZ2h0VGh1bWJQcm94aW1hbDogJ3JpZ2h0VGh1bWJNZXRhY2FycGFsJyxcbiAgcmlnaHRUaHVtYkRpc3RhbDogJ3JpZ2h0VGh1bWJQcm94aW1hbCcsXG4gIHJpZ2h0SW5kZXhQcm94aW1hbDogJ3JpZ2h0SGFuZCcsXG4gIHJpZ2h0SW5kZXhJbnRlcm1lZGlhdGU6ICdyaWdodEluZGV4UHJveGltYWwnLFxuICByaWdodEluZGV4RGlzdGFsOiAncmlnaHRJbmRleEludGVybWVkaWF0ZScsXG4gIHJpZ2h0TWlkZGxlUHJveGltYWw6ICdyaWdodEhhbmQnLFxuICByaWdodE1pZGRsZUludGVybWVkaWF0ZTogJ3JpZ2h0TWlkZGxlUHJveGltYWwnLFxuICByaWdodE1pZGRsZURpc3RhbDogJ3JpZ2h0TWlkZGxlSW50ZXJtZWRpYXRlJyxcbiAgcmlnaHRSaW5nUHJveGltYWw6ICdyaWdodEhhbmQnLFxuICByaWdodFJpbmdJbnRlcm1lZGlhdGU6ICdyaWdodFJpbmdQcm94aW1hbCcsXG4gIHJpZ2h0UmluZ0Rpc3RhbDogJ3JpZ2h0UmluZ0ludGVybWVkaWF0ZScsXG4gIHJpZ2h0TGl0dGxlUHJveGltYWw6ICdyaWdodEhhbmQnLFxuICByaWdodExpdHRsZUludGVybWVkaWF0ZTogJ3JpZ2h0TGl0dGxlUHJveGltYWwnLFxuICByaWdodExpdHRsZURpc3RhbDogJ3JpZ2h0TGl0dGxlSW50ZXJtZWRpYXRlJyxcbn07XG4iLCAiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgcXVhdEludmVydENvbXBhdCB9IGZyb20gJy4uL3V0aWxzL3F1YXRJbnZlcnRDb21wYXQnO1xuaW1wb3J0IHR5cGUgeyBWUk1IdW1hbkJvbmUgfSBmcm9tICcuL1ZSTUh1bWFuQm9uZSc7XG5pbXBvcnQgdHlwZSB7IFZSTUh1bWFuQm9uZXMgfSBmcm9tICcuL1ZSTUh1bWFuQm9uZXMnO1xuaW1wb3J0IHR5cGUgeyBWUk1IdW1hbkJvbmVOYW1lIH0gZnJvbSÛ½5ïfòµë(š+myÔ¥CFu£tÕE„sFt”4t”4t”4ç¦”&µ¥u§&Õf´´4%eSfeS„%$S•…ETe”6¶t¦•–t´4%eFÄ¥DW„e$c”ÕC•ƒÄõ$Ue””GvuFÅdåƒåC&eDVÄ…4e&e•Vµ%D”6Æ6&”t”4t”4v34'fDW‡£&ƒS&†…¤s“4”Cv34'fDW‡£&ƒS&†…¤s“636v4&Dó‡T”4t”4t”4'¦tf¶#66u4&†$wvô”t£%¥t×”´4&¶„¦Å“5$ÖvFöD3S&„ç–×†ÄÄ4'•¥tæÆ…¦ÅS&†…¤s“4”6¶tµ4ô”vFÆDdæõ•u'fG–vv34'fDdæõ•u'fC†4g6v4&DÄ4'¦4s“DvÆæ…%Ftf¶#67V3&†…¤s“5EtguS&Ãe¥7vv34'fDW‡£&ƒS&†…¤s“4Æäæõ•u'fC§•„×4”„çv#5$ÖvFöDdæõ•u'fG“W¦tf¶#6E5•u'E„×4”…¥F4s“DvÆæ…$F##—•¤g6v4&D”6¶tö”„Æ¤u„sFt”4t”4t”4æÆ&Õ'¦Ç‡T”4t”4t“%g6u–u¤ufÖsVÅ¤6vuedäeƒä•U%c%T4”5–Ô”6vueSU5C„Õ%U&eDS•Tc”¥Fµ$et4„”SUeEc•ETS•Uƒ„¥#…Uƒä•U%cÖtµg‡T”4t”4v34'fDW‡£&ƒS&†…¤s“4”Cv34'fDW‡£&ƒS&†…¤s“636v4&Dó‡T”4t”4v3&†…¤s“4”Cu•w‡4´4&–FÕf¤Ö–vu¤vÇ•¥tãDvÆæ…VFÖÇ¦t§5¥7vv6Õf¥¥vÃ%¥dæõ•u'fG””6¶u”&å¥…%Ftf¶#66ô”„çv#5%Ftf¶#6Då•„&$”v¶u…7vv34'fDW‡£&ƒS&†…¤s“4Æäæõ•u'fC†4dçVÕW4”„çv#5$ÖvFöDdæõ•u'fG“W¦tf¶#6D6tg¤Ä4'¦4s“DvÆæ…%Ftf¶#67V3&†…¤s“5VÔf¶…g¤Ä4#%S4'fDdæõ•u'fCçf#4¦µw”'”ctµ4d”DWTÔGF6&”t”4t”4æÆ&Õ'¦Ç‡U„sFt”4t”4dÇ”$ECed”„'•¥3”ÕES$”…g¥¥„Öu•4'¦D„£“5u#%gf%uc6ÖÆ¥#—VDucFDg‡T”4t”4t“&ÆÔ”e$•Vµdeƒ¥5Ec•U4d¤e%c•5%e¤¥SÅF”µ4„åFF6&”t”4t”4uVµfe$vÇ•¥tã´4&¶„¦Å“5$ÖvFöD7vu£%gf%uc6æÅ#4çDvÇf&—vu£%gf%uc6æÄö#4§E•ww4”vFÆ##ÆD„£UfÖÆÆC'6—vu£%gf%uc6æÄF$uf†6Ôçe•…$ö#4§E•ww4”s†Dug–tg4Ä4'¦tf¶#674”„¦Å¦×†Å“5&Å¤W‡£&ƒ”6³u„sFt”4t”4¥¥w‡¥¥g‡T”4t”4t”4%5%c”V„¦Å“5ô”u'6Õf¦DW‡£&ƒÄ4&å¥s—E¥…'–U7vv%tc¥„§•ww4”„æõ•u'fG—vv6ÕfÖ$uf¦DufµDvÆæ…tµGF6&”t”4t”4æÆ&Õ'¦Ç‡U„sFt”4veg‡T”4t”4çv6Ôfæ%tVvEsW–#'‡5ƒ'‡f#4&e¥sVµ„sV6&”t“%gU¤vÆÕ„sV6&”t“&ÆÔ”6vuFÅdåƒ$¥VÃ”Õ5VD•ddÖu”t”6¶t¦•–u¤ufÖsVÅ¤6vuVµfe$vÇ•¥tã”6Æ6&Ç‡T”4t”U'6Õf¦DvÇf&Ôg5DvÆæ…u¤vÇ•¥tãs—U•w„ÖvFöDGF6&”t”4¦u–u¤ufÖsVÅ¤6vuedäeƒä•U%c%T4”5–Ô”SUeEc”U5d¦eDVÄ…4e&eS„%$S•…W”´”D&6&”t”4$V„¦Å“5'##V†$W‡£&ƒS&†…¤s“4”u'6Õf¦DvÇf&Ôg5DvÆæ…%Ftf¶#63u„sFt”4t“%gU¤vÆÕ„sV6&”t”4¦4„¦…£#„”…gV6Ó—6$c—6##—uƒ4ã•„£„sFt”4u¦Ó—””6vvsS”v¶u4t÷”'”GvuFÅdåƒ$¥VÃ”Õ5VD•ddÓt”v¶t·—6tµ4#u„sV6&”t”4t”u'6Õf¦DvÇf&Ôg5DvÆæ…u4&¶„¦Å“5'##V†$W‡£&ƒ36v4&Dó‡U„sFt”4t”4dÇ”$ECed”„'•¥3”ÕES$”…g¥¥„Öu•4'¦D„£“5u#%gf%uc6ÖÆ¥#—VDucFDg‡T”4t”4t“&ÆÔ”e$•Vµdeƒ¥5Ec•U4d¤e%c•5%e¤¥SÅF”µ4„åFF6&”t”4t”4u£%c$vÇ•¥tãs—U•w„ÖvFöDVÇU¦Ó†ô”u'6Õf¦DvÇf&Ôg5DvÆæ…4”u'6Õf¦DW‡£&ƒ”6³u„sFt”4t”4¥¥w‡¥¥g‡T”4t”4t”4&å¥…$V„¦Å“5'##V†$W‡£&ƒ5sVÖ'–vu¤vÇ•¥tãs—U•w„ÖvFöD7vu£%gf%uc6æ·4”u'6Õf¦DW‡£&ƒ”6³u„sFt”4t”4¥¥sV¶u¦6&Ç‡T”4t”4v3&†…¤s“4”CtÕ3Gtó‡T”4t”4t“&ÆÔ”u&Å¦ÖÇU¥uô”eeE%c•E4TdUCDådtµ4Ô¦”ô”edõV³”ÕDUdUƒ…C&e5STU%fvu4$õeSe$VÅ5ƒ„¥#…Uƒä•U%cÖtµg‡T”4t”4u¤vÇ•¥tãs—U•w„ÖvFöDdæõ•u'fG”””u'6Õf¦DvÇf&Ôg5DvÆæ…%Ftf¶#6G¥w”'”cu„sFt”4t”4dÇ”$ECed”„'•¥3”ÕE“%„sFt”4t”4dÇ”'”ÕE“$”vÇVD„§e¤…f¥¥uv3&†…¤s“55sS¥sW¦…#U„sFt”4t”4¦u–udV…5%UfefÄ¤åƒ$•Vµdeƒ¤ef¶ÅE5S”ô”CC””DS$æÇ‡T”4t”4t”4'¦tf¶#66u4&†$wvô”t£%¥t×”´4&¶„¦Å“5$ÖvFöD3S&„ç–×†ÄÄ4'•¥tæÆ…¦ÅS&†…¤s“4”6¶tµ4ô”vFÆDdæõ•u'fG–vu¤vÇ•¥tãs—U•w…Ftf¶#6Då•„&$”v¶u…7vu¤vÇ•¥tãs—U•w„ÖvFöDdæõ•u'fG“W¦tf¶#6Då•„%F‡ÄÄ4&¶„¦Å“5'##V†$W‡£&ƒS&†…¤s“4Æäæõ•u'fCÇVDugV3&ÃU7vu¤vÇ•¥tãs—U•w„ÖvFöDdæõ•u'fG“W¦tf¶#6D6tg¤Ä4&¶„¦Å“5'##V†$W‡£&ƒS&†…¤s“4Æäæõ•u'fC¦…¤vÃ7—vvFµ'6Õf¦DvÇf&Ôg5S&†…¤s“5#—f6Õ&$”v¶u…4”FötÕ3Gtó‡T”4t”4t“%g63%f6&”t”4t”4v3&†…¤s“4”Cu•w‡4´4&–FÕf¤Ö–vu¤vÇ•¥tãDvÆæ…VFÖÇ¦t§5¥7vv6Õf¥¥vÃ%¥dæõ•u'fG””6¶u”&å¥…%Ftf¶#66ô”u'6Õf¦DvÇf&Ôg5S&†…¤s“5Etguw”'”c4”u'6Õf¦DvÇf&Ôg5DvÆæ…%Ftf¶#67V3&†…¤s“5EtguS&Ãe¥7vu¤vÇ•¥tãs—U•w„ÖvFöDdæõ•u'fG“W¦tf¶#6D6tg¤Ä4&¶„¦Å“5'##V†$W‡£&ƒS&†…¤s“4Æäæõ•u'fC¦…¤vÃ7—vvFµ'6Õf¦DvÇf&Ôg5S&†…¤s“5#—f6Õ&$”v¶u…4”FötÕ3Gtó‡T”4t”4t“%gU¤vÆÕ„sFt”4t”4¥¥sV¶u¦6&Ç‡T”4t”4tÇ“†u”åTTeTö”'v6ÕWF6¤Sæ”#3%g¤”tVv35'–Etã”VFÆ##ÆD„§“çf&å&ÆT…&6&”t”4t”4ç¦”%U4d¤e%c•uV³edV…5%UfeVµeu5dä¥CFu£tÕES5„sFt”4t”4t”d¤eƒ'6Õf¦D6vu¤vÇ•¥tãDvÆæ…4”vFÆ##ÆD„£UTs—¦…'##G4”vFÆ##ÆD„£UFÓ—–%tg4Ä4&å¥s—E¥…'–Ue§¥†DV„—4”vFÆ##ÆD„£U'†Å•„¦¦#$cFÓ—–%tg4Ä4'E•…&Æ6ÖÆ†$7vv3&†…¤s“4Ä4'•¥u§5¥tã¥u$ÖvFöD4ó‡T”4t”4t“%g63%f6&”t”4t”4uVµfe$vÇ•¥tã´4&¶„¦Å“5$ÖvFöD7vu£%gf%uc6æ·4”s†Dug–tg4Ä4'¦tf¶#674”„¦Å¦×†Å“5&Å¤W‡£&ƒ”6³u„sFt”4t”4¥¥sV¶u¦6&Ç‡T”4t”ƒ6&”t”4¦4„¦…£#„”…gV6Ó—6$c—6##—uƒ%gU¤g‡U„sFt”4æÆ&Õ'¦Ç‡U„sFt”3‡d”4ç¦”ô”SUeEc•5%TåUƒe5%TfeDVÄ…4e%D”CFtÔ4”5–Ô”u&Å¦ÖÇU¥uô”d¤eƒ'6Õf¦Dc•5¥tã„¦Å•4„sV6&”tÇ“†t”4%5¥tã„¦Å•W‡£&ƒ”„¦Å“5$&6Õf…DvÆæ…u„sV6&”tÇ“†t”4¦4„¦…£#„”…gV6Ó—6$c—6##—uƒ4ã•„£„sFt”3‡d”4u¦Ó—””6vvsS”v¶u4t÷”'”GvuFÅdåƒ¤e&ed¤ec”Õ5VD•ddÓt”v¶t·—6tµ4#u„sV6&”tÇ“†t”4t”„¦Å“5$&6Õf…DvÆæ…u4'•¥tã„¦Å•W‡£&ƒ36v4&Dó‡T”4dÇ”t”4uVµfe$vÇ•¥tãƒ¦Å“5$&6Õf„´4'•¥tã„¦Å•W‡£&ƒÄ4&å¥s—E¥…'–U7vv%tc¥„§•ww4”„¦Å¦×†Å“5&Å¤W‡£&ƒ”6³u„sV6&”tÇ“†t”4#•„sFt”3‡d”4t“4'••vGE•4#&ä§f$w†f$s—f4c–Æ&Õ&6&Ç‡T”4dÇ”¥¥sV¶u¦6&Ç‡T”4¦u–u¤ufÖsVÅ¤6vuVµfe5sV¶„¦Å“5$Vu¦ÖE„æÄ”6Æ6&Ç‡T”4t”…¦Å—¤Övt§55„§••u'•sV¥¥4””…¦Å—¤Öô”DTÔ4ó‡U„sFt”4vFÕf¤×”'6ä¦…¤vÆ†&ÔæÄ”Cu£%cs–ugVDW‡£&ƒ5„§••u'•sV¥¥6vu•s–ugVDW‡£&ƒ#—6#4–tµGF6&Ç‡T”4t”3‡d”TåEd$%dFöv4„¦ÄÅ„—„åE–vE„æÆ7”&„”„ã6åf¦D4$…¥s—E¥…'–täF##S¥†ƒ„sFt”4tÇ“†u”åTTeTö”'v6ÕWF6¤Sæ”&¶#%g¦&–C”v††FÕVu•4&µ¥u§&ÕVuedäeƒ„¥#…Uƒ%5C¤eS‡T”4t”4ç¦”%U4d¤e%c•uV³edV…5%UfeVµeu5dä¥CFu£tÕES5„sFt”4t”4¦u–u¤ufÖsVÅ¤6vuedäeƒ„¥#…Uƒ%5C¤eW”„sFt”4t”4t”vÇ–6Ôf¶tgU“%Vt·£u£%cDvÆæ…%6Ó–•¥VÇ–6Ôf¶tgU“%Vô”w‡£&ƒT„§e–ÕW4”vFÆ##ÆD„£UFÓ—–%tg4”6³u„sFt”4t”4¥¥sV¶u¦6&”t”4¥¥w‡¥¥g‡T”4t”4v„§••u'•sV¥¥4%4&å¥…$ÖvFöDd'–#$¦Å5„§••u'•sV¥¥6vv$vÆæ…%6Ó–•¥7vu£%gf%uc6æ·V&Ó—–%tg4”6³u„sFt”4t“%gU¤vÆÕ„sV6&”t”4¦u–t´4$õeSe4Udå5c”Õ5VD•ddÖu”t”6Æ6&Ç‡T”4t”4t“4'••vGE•4#&ä§f$w†f$s—f4c—¦Dtg–Dg‡T”4t”4u¦Ó—””6vvsS”v¶u4t÷”'”GvuFÅdåƒ„eEVÆeDVÄ…4e%D÷”'”77$”6¶vS‡U„sFt”4t”4t”3‡d”TåEd$%dFöv4„¦ÄÅ„—„åE–vE„æÆ7”&„”„ã6åf¦D4$…¥s—E¥…'–täF##S¥†ƒ„sFt”4t”4t”4ç¦”%U4d¤e%c•uV³edV…5%UfeVµeu5dä¥CFu£tÕES5„sFt”4t”4t”4v„§••u'•sV¥¥4%4&å¥…$•¥s34&õ¥„¦ÅDvÆæ…$¦6ä¦…¤vÆ†&ÔæÄ´4&õ¥s34&õ¥„¦ÅDvÆæ…'¥w”'”c4”vFÆ##ÆD„£UFÓ—–%tg4”6³u„sFt”4t”4t”4æÆ$„æÅ„sFt”4t”4t”4v„§••u'•sV¥¥4%4&å¥…$•¥s34&õ¥„¦ÅDvÆæ…$¦6ä¦…¤vÆ†&ÔæÄ´4&õ¥s34&õ¥„¦ÅDvÆæ…'¥w”'”c4”vFÆ##ÆD„£TÆÓWf6Ó†$4ó‡T”4t”4t”4¥¥sV¶u¦6&Ç‡T”4t”4veg‡T”4t”4t“4'••vGE•4#&ä§f$w†f$s—f4c–Æ&Õ&6&Ç‡T”4t”4æÆ&Õ'¦Ç‡U„sFt”4æÆ&Õ'¦Ç‡U„sFt”3‡d”4ç¦”&µ¥u§&Õf´´4%5%c”¦&Õ'6Õf¦Ddçu¥tã$tg””6Æ6&Ç‡T”4dÇ”t”…¦Å—¤Öv6Ôf¶tgU“%Vu4#%¥t×¤´4tÆ¤tµGF6&”tÇ“†t”4#%¥t×¤”tç5¥tg•“#–†Dd¦…¤vÆ†&ÔæÄ”CvFÕf¤×–vtÔ3Gt”6³u„sV6&”tÇ“†t“%gU¤vÆÕ„sV6&”t“&ÇU“'ƒ¤uVuw‡£&ƒ3–Ö6Ôfæ%ugVDc—E•„'¥Ç‡T”4¦sV¦$…fµ¥4†$vÆæ…'¥ƒ%§••vGE¥sSƒ%gU¤CV6&Ç‡T”4dÇ”'F#%#$tcs—U„sFt”4ç&Ôç6Eu&Ä”G††##†4c–Ö6Ôfæ%ugVDCV6&Ç‡T”4#%¥t×¤”tçf$4””„¦Å¦×†Å“5&Å¤W‡£&ƒÆÕ'6Õf¦DU'¦Õ£3%Vt·”'•¥u§5¥tã¥u$ÖvFöD3W&Õ'6Õf¦DU'¦Õ£3%Su„sV6&”t“&ÆÕ¤ufÔ”U$eÅd…ƒ„¥ddä•U$eV´eU%g‡T”4t”vG5ƒ§••vDF#'‡f6”””…¦Å—¥ô”tçf$7vu¤vÆÕ¦åg¥¥Tçf$s—”ÆÔVtµGF6&”t”4'v#4ã#—–6Õf¦DvÇf&–wó‡T”4t”„¦ÆD…g–&§F6&”t“%gU¤vÆÕ„sV6&”tÇ“†tÅ3uEe'f##Cd”„§%4'6vFöDvÇU§”DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅg‡T”4#%¥t×¤”…§¥†DV„–u4'V#4§E•w‡VÕVô”…¥vuc5Ts—¦…'##FtµGF6&Ç‡T”4¦u§U¤ufÔ”d$•udä¥dÕDfÆe•5VµdEdc”Õ5VD•ddæ6&”t”4'•¥u§5¥tã¥u$ÖvFöD3V¶„¦Å“5%F4uf¦Ew††6”e4%5GF6&”t“%gU¤vÆÕ„sFt”…¦Å—¤Öv6ÖÇEEvÃD”Cv%vÃD´4#%¥t×¤´4„Æ¤tµ7vv6ÕfÖ$uf¦DufµDvÆæ…U¤vÇ•¥tãS4&Å“5g5•„—4”„§%W‡£&ƒsVåEvÃE&Ôf¦Ds—””6³u„sV6&”vFÕf¤×”'–su4'u•„¦†%uc6ÖÆ¥VÖÇE#—6#4¤u•tã#4–t¶”'v#66ô”„æ†D…g••…&Ä´4„Æ¤tÅ4&¶#5ô”…§¥†DV„—4”sWf6Ó†$4”76v4tg••sÆD„§“§%W‡¦å$u•tã#4–tµ7vv4tg••sÆD„§“§%U§•¥„çU¥w…#6FÆ6µ¦…“5'f6”ó‡U„sFt”4ç¦Õ&Å¦”%eSfeETeUedUe•dee5%g‡T”4t”‡F6&”t”4t”…¦Å—¤ÖvT4””sWf6Ó†$vÃe¥6vvFÕf¤×–vvFÖÆÆC'6“SdÄ4tÆ¤4”3&uc5$vÇ”Æævtµ4ó‡T”4t”4vFÕf¤×”#T”Cu“4§f34Öô”…§¥†DV„—4”†vtµG6tÇ“†u£5f†6ÔgVDufÅ¤4#'”&•¥4'V#4§E•w‡VÕfµ„sFt”4t”4#%¥t×””„çvug•¥ec$”CtÔ3C”76tÔ3C”6övFÕf¤Ö–vu¤s“´4#DÄ4'V#4§E•wvtµ7vtÅu'fD6vvU7vv&Ó—–%tg4”6¶tµGF6&”t”4t”„çvug•¥ec$”Ct´4'E•…&¥•„%U¥†ƒE„¦Åe…¥V6ÔgV3%§f6Ót¶”#%¥t×¤´4'¦4v†Æ6ÕefF—vtÕ4”6·VT†³u„sFt”4t”4#%¥t×¤”s†Dtæ†44””…&ÆT…#6ÕW•$6vv%tc“$guducFD…g•¥7vv34&õ¥„¦Åe…–tµ3W•£$“u„sFt”4t”4'–st·£v%tc“$gu&Ôf¦Ds—””6öv%tc“$gtó‡T”4t”ƒ6&”t“%gU¤vÆÕ„sV6&”t“&ÆÕ¤ufÔ”eeE%c•55SåeW…U5d$Õue$ete%eVµf6&”t”4#%¥t×””„§%S$…'4wƒUducFD…g•¥ec$”Ct´4'–sæEwƒ„'6Ue&ÆT…#6ÕefFÅ'••sW¥¦Ó—–%4”…¦Å—¤Öô”…c$Ä4„”6¶tµ3SFUGF6&”t”4'–st¶£vDucFD…g•¥D¤T´4'–sæEwƒ„'6Ue&ÆT…#6ÕW4”„§%S$…'4wƒUducFD…g•¥ec$”6·V6ÖF”ó‡T”4¥¥sV¶u¦6&Ç‡T”4&¦#'vt·£v6ÖÇEEvÃD”6öv6ÖÇDó‡U„sFt”3‡d”3D”SV##—Tö”$f%vÇ¦3&Çf&”DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅg‡T”4&¦#'vt·£vDs“•w„f%vÇ¦3&Ã%¥d¦…¤vÆ†&ÔæÄó‡U„sFt”3‡d”4ç&Ôç6Eu&Ä”G†Æ&å§E•„&e¦ä¦…£#Æ&åµ„sV6&”tÇ“†tÅ3uw‡F#4ã”u'f&ÕV„”3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3DÅ3E„sFt”4ç¦”&µ¥u§&Õf´´4%ee$Õ5STd”6Æ6&”t”4&¦#'vu4'fE…'6sVÅ#—6#4¤u•tã#4—V6ÖF””6öv%vÃD´4#%¥t×¤´4„Æ¤tµ7vu“#—4Ä4'fE…'6sVÅDvÆæ…'&ÖDæ†„u•tã#4–tµGF6&”t“%gU¤vÆÕ„sV6&”t“&ÆÕ¤ufÔ”S•dee%g‡T”4t”u'¦Õ£3%dF#'‡f6“V„”CtÕ3Gtó‡T”4¥¥sV¶u¦6&Ç‡T”4&æ$c”v6Ôfå#—6#4–u4#%¥tÓ´4&¦#'w4”u'¦Õ£3%dF#'‡f6“V„”6³u„sFt”„'f35$F#4§•¥tãs—T´6³u„sS•„sF”Ä4”Ç–öu¥„ç6sSÅu'3$f–$uVu…#V4ug¥“4§4…E¥„ç6sSÃ#V†%vÇU§“¦##S%¥sSs—T”6÷e„sV6&“‡¶Ç‡T”6öuS4&Å“&ÆÖug–7”'e¦”&µ¥t£§”'F#%&Ä”s–Ô”‡D$vÇV”$åds—f&³†Dug–tg6e3V6&”„sFt¶”%E¥uSd”‡D$vÇV”$åds—f&³†Dug–tg4ÆÕ&Å–åfåEs–µ¥ƒ6&”Ã‡U¥†‡v#4£”tçf&äã”SV##—UEtc¥„§•w„U¥t££e¤uVu4#u„sFt”3‡¶Ç‡T”4t¶”%5¥sVµ¥„–v&Ó—–%tg6$†·U„sFt”4Ã‡T”4$ö##VÄö”æ&Ó—U¥675„sV6&”tÇ–÷„sFt”4”e§35f†$vÃe¥4'V#4§E•w‡¤”s–Ô”…&õ¥4'¦E„¦Õ•tæÄÆÇ‡T”4t¶“–6&”uFÓ—–%tg4ö”æ&Ó—–%tg4§—†6&Ç‡T”4d¶—6&”t”6öufÖÇ¦Etg6‡Ä”w‡D3—¦tfµ¥4'e¦”#uVv35g•¦Ôf¥¥3V6&”t”6÷e„sFt”W‡Ddæõ•u&ÅVÔc¥Föt£'‡Ddæõ•u&ÅVÔc¥675„sV6&”tÇ–÷„sFt”4”e§35f†$vÃe¥4%ef”'e¦”#uVv35g•¦Ôf¥¥3V6&”t”6÷e„sFt”eetö”æE…–äÄg‡Ve4&†7”&¦##W¦DGF6&Ç‡U¥†‡v#4£”…#V4uVuEe'f##Tå•…&Æ6ÖÆ†$U&Å–åfåEs–µ¥4””6ƒU„&Æ#%–uEe'f##Tå•…&Æ6ÖÆ†$U&Å–åfåEs–µ¥6Æ&%cV#%–vD†Çu¥s–Ô”SV##—UEtc¥„§•w„U¥t££e¤ufDó‡T–—vt–“‡”ug¦$vÇVD3¶„æ…–×†Ä”T#U„&Æ3$ç–„#Åug¦$vÇVD3—U•s&Ö7E“#—VFÕgVDvÇf&”Ã‡U„sVÆT„'f6åu“#—V35uEe'f##Tå•…&Æ6ÖÆ†$S“Dw‡&Õe†u#Se¤uVu4#u„sFt”SWf&ÕSd”6GV##VÄ§—†6&”uc#—–$u$F##—•¤vÇU•…&Æ7¦öt£6Gf6×†µ#—f6Õ'&Ôc¥„ÖäÄg‡T”4%E“4¦Å¥sTF##—•¤vÇU•…&Æ7¦öt£4æ¦6ÕfÆ&´çf#4¦¶sV†Dug¤§—†6&ãu•„Öu“#—V35u„sV6&ÕcF4s—–D4#U„&Ä”SV##—UEtc¥„§•w…E…'6sVÅc&Æ¶Dv„æ#%&Ä”C6&”t´…#V4uge¦”$åds—f&³†Dug–tg5C5c$vÇU¥fG¤…&õEs–µ¥6Æ&%cV#%–vD†Çu¥s–Ô”SV##—UEtc¥„§•w…E…'6sVÅc&Æ¶Dv„æ#%&Å…GF6&”—4”4§%„'f6åt¶”&†7”%U4d¤e%4&Ö6Ó—D”6C„¦Å¥63u„sV6&Ôçf&äã”ugU“#–¶sVå#—6#4¥F4tf¥¥S†4FöuVÕf¦#4¦µtgVU7vt§–6vd4æ34¦å––2´”CvS‡T”4dÇ”&Æ3'‡&åE¤vÇ¥•t§5¥3U¥†ƒÅw‡&ÕVu…#V4ug¥“4§4…E¥„ç6sSÃ#V†%vÇU§“¦##S%¥sSs—U„sFt”D×tÔDd”66äÄg‡T”4dÇ”&Æ3'‡&åE¤vÇ¥•t§5¥3U¥†ƒÅw‡&ÕVu…#V4ug¥“4§4…E¥„ç6sSÃ#V†%vÇU§“¦##S%¥sSs—U„sFt”D×tÔDSd”6G¦6ÖF”§—†6&ãu„sV6&“‡¶Ç‡T”6öu4&¦##u•…u¦ågU“5'##FvDs†u£%c”…&ÆT…#6ÕVu“#—6#4–v34&…“%WU„sFt¶Ç‡T”6öu”åTTeTö”'v6ÕWF6¤SÖÇ‡T”6öuS5&†6å'&Ö6u¦ä§f%4%V„¦Å¥3W7”'”ÕEW”Ä4&vDucFD…g•¥3VÆ&Ôçe¤vÇU£$v„Öv6ÕgU•sÅ¤4#'”&vDucFD…g•¥3V¦#'‡f6Äçu•tæÅ”3V6&””e&ö„Öu¦ågU“5'##FvC&Ç6$4&õ•sV¶$uVvDv†Ä”tçf%tgvD3V6&”„sFt¶”$4tg••svDucFD…g•¥4%VuVvDucFD…g•¥4#V#5VvC$gVD4#'”&å¥…vDv†Ä”tçf$s—””„çu•tæÄ”u§–##6&”Ã‡U¥†‡v#4£”u£&Ôãs—T”vFÆDe&ÆT…#6ÕdF#'‡f6Äçu•tæÄ´…&ÆT…#6ÕSd”e$•VµddÆÅ&ÆT…#6ÕWö”ä§”#„”6G¦6ÖF”§”#u„sFt”vÆÔ”6‡u•„§¥¥VÇVD6…U4d¤e%3U5%e¤¥SÅF—vtÕD”CC””DSÖ–¶vS‡T”4t”„¦ÆD…g–&”#¥†ƒE„¦ÄÆÔçf$s—•S4&…“%Vu•„Öt§–6vd4æ34¦å––3u„sFt”ƒu¥w‡¥¥4#u„sFt”4v6ÕcE„§T”ugU“#–¶sVå#—6#4¥F4tf¥¥S†4g6öDucFD…g•¥4&†7”&†&æ·ÆÕgU“#–¶sVå…GF6&”veg‡Veg‡T–—vt–ÖÇF4s—–D4#t”VDÕdU¤Ö#$fµ¥„¥$…fæsG4”VDÕdU¥•„§¥¥„–ve4&Ö6Ó—D”6C„¦Å¥3–ÆTtgF4w†Æ7“—3#f$s–…¤ug–7“”…De$uDs–…¤ug”Æ×¤§§F6&ÖÇF4s—–D4”tg¤”V„UVµgF„ç¦…¦ÅE…g6DvÇv$vÆÆ6Äæ¦ugE•4&Ö6Ó—D”6D4vÃF…—fD†Çu¥„×FFä§E—“E•…&Æ6ÖÆ†$„×Fu'”ÅugF„ç¦…¦ÄÅs$…'4w‡¥„—DÕ3Gt§§F6&ÖÇF4s—–D4#t”VDÕdU–u•„Öu#…U&Äæ¦ugE•4#””u§–##t£&æ$…&ÔÅ…'••sW¥¦Ó—–%3–¦#4¦Ä§§F6&Ç‡U¥†‡v#4£”tç5•„ç¤”e¥5ES†Dug–tg63„UVµgF„ç¦…¦ÅE…g6DvÇv$vÆÆ6·‡e•u&Æ6Ä'6EvG&”'%„'5¥sÆ&å'¤”VDÕdU¤Ö#$fµ¥„¥$…fæsFvS‡T”4'vEt§6tÖv35&†DvÆ¤”Ue•dUdõSÅFÃ”õSd”Ct£¥5ETæf%tc¥„§•w‡¥ƒ&†¶6Ã–Æ%vÇ¦3&Ã%¥S$…'4w‡¥„–ä”tg¤”tçf&äãó‡U„sFt”„#–×‡—”'•¥tf¶##W6U4'u•„§¥¥„“d”VDÕdU¥•„§¥¥„“u„sV6&”v4…f–$vÆ¤”vFÆD4'U•sÄ´6³d”„ã6ÖÇU§”#u„sFt”4v6ÕcE„§T”e¥5ES†Dug–tg63„UVµgF„ç¦…¦ÅE…g6DvÇv$vÆÆ6·‡e•u&Æ6Ä'6EvG&“Tete$eFÄä¥CVeF´då%GF6&”veg‡U„sFt”„#–×‡—”&¦##W¦D„£“5'f6–‡u•„§¥¥„“d”VDÕdU¥•„§¥¥„—”‡F6&”t”4#vÇ¤Æä&†6äæÆ6”””„&†6äæÆ6§F6&”veg‡U„sFt”„#–×‡—”&†36ÇU—”&ÆT…&Æ&Õ$å•…&Æ6ÖÆ†$d&†6ÔgF7–‡E•…&Æ6ÖÆ†$VÇU¤ucDö”'VEs•¥„—4”s†Dug–tg5Ttg••s¤ö”#t”gG%¥†³d”„ã6ÖÇU£d”tgVU4#”µFöuT„§f%vÇ¥¥Gƒ&#&Æµ”#u„sFt”4u“#—V35u¥†ƒ¥sW¦s—T”CvDv‡7“Ve£%c4U%5%s34çFÕdæEwƒ„'6ug•%†ƒ¥sW¦s—T´s†Dug–tg55sVµ¥†wó‡T”4t”vÆÔ”6†ÆT…&Æ&äç##FuCv&åg6$6¶vS‡T”4t”4v6ÕcE„§Tó‡T”4t”ƒ6&Ç‡T”4t”3‡d”e&ö„Öu¥†ƒ¥sW¦s—T”vÇ¤”tg•“&‡FÕf´Æ”$f%vÃ”†F†6ÓW&ÖF6&”t”4dÇ”%E¥uSd”vƒD„'¤ö“‡e£&Ã…f”ÆÔçf%3“&6ÓE—““&6ÓF34&Å“&ÆÖtæ†DvÇf&“—vEw‡4Ç¤Ó4åg‡T”4t”tçf&äçf$uWVC$g–&–†6&”t”4t”6EuV³å•…&Æ6ÖÆ†$„ä•$d¤f%vÇ¦3&Ã%¥S$…'4w‡¥„¤Ö#$fµ¥„¥$…fæsCd”t%uV³Eƒ#†Dug–tg63–õ¤„¦e¥s34çFÕdæEwƒ„'6ug•”4'7”&†6Ôæö…¦Å¤3Fue„æÄ”t$Å4d¦f%tc¥„§•w‡¥ƒ%gF„ç¦…¦Åƒ4ã6ÕgU£5&õ”4'&äã¥tf´Æ–75„sFt”4tµGF6&Ç‡T”4t”tçf&äã”ugF„ç¦…¦ÅE…g6DvÇv$vÆÆ6”””ucFDugV3&Çf&“VÆ%vÇ¦3&Ã%¥S$…'4w‡¥„“u„sFt”4v%tc¥„§•w…•„¦†%„×U¥s34çFÕd¦&å&Æ&äçD†¶u4&Æ%vÇ¦3&Ã%¥S$…'4w‡¥„“u„sFt”ƒ6&Ç‡T”4'v6ÖÃ%•…&Ä”c–å¥…$•$d¤f%vÇ¦3&Ã%¥S$…'4w‡¥„¤fT…&Æ&äç##Fõ„sFt”4v%tc¥„§•w„¦&Õ&ÆTFöv&ågE–Õg”Äg‡T”4ö”$•$d¤f%vÇ¦3&Ã%¥S$…'4w‡¥„¥E“&†Æ%tWUfÄ¤å†Dug–tg63„UVµgF„ç¦…¦ÅE…g6DvÇv$vÆÆ6”#„”…gU¤ufÖsVÅ¤4#u„sFt”4u“#—V35v4tg–3%g””CvDv‡7“Wu•„§¥¥„“u„sFt”4u“#—V35väçf&”””„&†6äæÆ6“W3#—T”tg¤”VDÕdU¥E“&†Æ%tWU5VDÕdU“u„sV6&”t”4&¦##W¦D4'E•…&Æ6ÖÆ†$U&Å¦”””w¦##GV%tc¥„§•w‡¥“V&%tc¥„§•w„¦&Õ&ÆTcu„sV6&”t”4'¦”ö%tc¥„§•w„U¥u–uCv&åg6$6¶vS‡T”4t”4u“#—V3#—5¥3S5•„§T´g‡T”4t”4t”4&ufÄ¤åEtc¥„§•w‡¥4U%5%s34çFÕdæEwƒ„'6ug•Ds–…¤ug•Twƒ£&ÇTö”$&D…&Æ%„#”…'d”…g¥¥4'E•…&Æ6ÖÆ†$„æ$¤‡GE•…&Æ6ÖÆ†$VÇU¤ucFecv#%–u£'…U&”&–E…vDv†Ä”s†Dug–tg4”u'e¥„çT£5u¥†‡35&tÄg‡T”4t”4tµGF6&”t”4t”„¦ÆD…g–&”#&Õ&Å¦ÖÇU¥uu„sFt”4veg‡U„sFt”4u“#—V35u¥†ƒ¥sW¦s—T”Cv%tc¥„§•w„U¥u—U¥†ƒ¥sW¦s—V7£‡Us¥5ES†Dug–tg63„UVµgF„ç¦…¦ÅE…g6DvÇv$vÆÆ6·‡e•u&Æ6Ä'6EvG&“Tete$eFÄä¥CVeF´då%cu•„æ6&”t”4t”V„UVµgF„ç¦…¦ÅE…g6DvÇv$vÆÆ6Äæ¦ugE•3UuV³EEtc¥„§•w‡¥4U%5%s34çFÕdæEwƒ„'6ug””‡vvEsVµ¥u§&Õf´ó‡T”4t”vÆÔ”6†ÆT…&Æ&äç##FuCv&åg6$6¶vS‡T”4t”4v6ÕcE„§T”…gU¤ufÖsVÅ¤GF6&”t”4#•„sV6&”t”4'•¥…#6ÓFu¥†ƒ¥sW¦s—Tó‡T”4#•„sS•„sF”Ä4–sv#4£”6öu•„ÖudV…5%UVu¦ä§f%4æDv‡•¥uVäó‡Vsv#4£”‡6ufÄ¤ä”tg¤”e—ufÄ¤äÄ4$å•…&Æ6ÖÆ†$4&†7”%tÔS†Dug–tg4”ƒu¦ä§f%4å„'TvÃ$Ã5#V4ug¤Å…§–%3tÆ¤äó‡Vsv#4£”6öu•„Öuf¤dåds—f&Äæ¦ugE•4&Ö6Ó—D”6D4vÃF…—fD†Çu¥„×FFä§E—“E•…&Æ6ÖÆ†$„×F%…'f##GDÕ3Gt§§F6&ÖÇF4s—–D4#U„&Ä”‡6u#…U&·‡e•u&Æ6Ä'6EvG&—vu#…U&Ä&†6äæÆ6”#””u§–##t£5&ö6ÕfÄÃ%cE•sv$ug¤Ã'¦%3—6#$fµ¥„§¤ÃDÕdU¤Ö#$fµ¥„—VäÖäó‡Vsv#4£”‡6u£$gF%tdeC$t”ƒu¦ä§f%4äÆ““DvÇ67“–å•sE•UedU–äó‡Vsv#4£”‡6u#…U&”&†7”$…De$uS$æõ¥s„”ƒu¦ä§f%4åvG6Du—FD„¦†&äæÖ#4§DÃ$çf6ÕVäó‡U„sVÆT„'f6åu“'††34ÖufÄ¤åEtc¥„§•w‡¥f¤$F##u•…%$…fæsFvsv$ugE¥sS7”$…De$uDs–…¤ug•Twƒ£&ÇT”‡F6&”v4…f–$vÆ¤”„¦Å•u'f&×ƒT”„&†6äæÆ6¦öu#…U&Ä&†6äæÆ6§F6&Ç‡T”4d¶—6&”t”6öu4'E•„u¦ä§f%4#$Ô4'•¥sVµ¥„–v5…fÆEuVvDs†vF¤Vv6ÕgU¤ug””„c¥…fÄ”s–Õ¦äæÆD7vu¦Ó—””e'••sW¦4tg•¥sS”s†Dug–tg67“V6&”t”6÷e„sFt”„'–…¦†DuVv6Õf…¤s—V$†¶uƒ4¦Æ&Õ&Æ6Äc¥…fÅEtgud„¦†&äçu•„¦Æ&åd”S†4G‡VEs•¥„—4”sS%t¦Æ6£Cu„sV6&”tÇ–÷„sFt”4”TVv%tgt”u§–##vF¤v6ÕgU¤ug””„c¥…fÄ”…'d”…—„”„¦Æ&Õ&Æ6”'†Euc¥4'e¦Õ§¥¥…4”u§f6”%V6ÔgV34&†6ÕgVDg†6ÖÃ¥4'E•…&Æ6ÖÆ†$„×U„sFt”4Ã‡T”4'v6ÖÃ%•…&Ä”„¦Å•u'f&×ƒT”c—•¥sVµ¥„¥&Euc¥S†4e'••sW¦4tg•¥sSvÆG–…&Äö”$å•„†&ågE–Õg”Ä4'VEs•¥„’´ó‡U„sFt”„#–×‡—”&å¥…v&ÔgE¥6wö”'¦D„§&Ö6vS‡T”4t”„¦ÆD…g–&”åfÄ¤åEtc¥„§•w‡¥f¤$F##u•…%$…fæsFäó‡T”4#•„sV6&”v4…f–$vÆ¤”tçf&äã6åf¦Ds—”´„&†6äæÆ6¦öu#…U&Ä&†6äæÆ6–¶vS‡T”4t”…&ö„×V4tg–3%g””Cv4tg–3%g”ó‡U„sFt”4vDv‡7“Vf6ÕgU¤ug•U…fÆEudå•„%V6ÔgV34&†6ÕgVD4””sVÆG”$å•„ôµGF6&”t”4#vÇ¤ÆÃ—•¥sVµ¥„¥&Euc¥S†4e'••sW¦4tg•¥sSvÆG–…&Ä”Cv&Õc4”S†46wó‡U„sFt”4tÇ“†uc•53e5Cdõ$Föuu&´”WD•VÃ“¥†ƒE„¦Åƒ5'••sW¥¦Ó—–%4#'”&ÆT…&Æ&äç##W¥e„æÅ¤g‡T”4t”3‡d”VÃ”vÇ¤”…'f'”'5•…&Ä”…'d”tfµ¤4#vÇ¤”vÇT”t¦Å¦Ó—•¥d§f#5&6&”t”4&¦##W¦D4'3#—T”CvDv‡7“Wu•„§¥¥„—Väçf&”&†7”$…De$uS$æõ¥s„Æ¶Ä…De$tó‡U„sFt”4väçf&“VÆT…&Æ&äç##W¥e„æÅ¤4””w¦##GU¥†ƒ¥sW¦s—V3g¥¥uu£†usu„sFt”4vu–t´w¦##GU¥†ƒ¥sW¦s—V3g¥¥uVsVµ¥†…¦–vå3…5ƒ5&ÆT…#6ÕffD„¦†&äæÖ#4§D§–¶uC””3„µ4#u„sFt”4t”4'3#—TÆÕcFDugV3&Çf&äåf3%f´Æä#3&vô£D•VÃ“¥†ƒE„¦Åƒ5'••sW¥¦Ó—–%67ó‡T”4t”ƒ6&”veg‡U„sFt”„#–×‡—”&†36ÇU—”&•¥u§f6Õe6##“´6³d”d'–##3%S†FÓ—¤CFvS‡T”4t”tçf&äã”w¦##Fu4#vÇ¤Æä&†6äæÆ6“W3#—T”tg¤”VDÕdU¥E“&†Æ%tWU5VDÕdU“u„sV6&”t”4dÇ”&Å•„§6U4&…–Ó—–D4'¦”'D4&¶#%g¦&–C”…g¥¥4%tÔe¥5Eg‡T”4t”tçf&äã”…—ufÄ¤å%†ƒ¥sW¦s—T”Cväçf&“VÆT…&Æ&äç##W¥“V$£¥5E6FD”tg¤”e—ufÄ¤ä”‡vvEsVµ¥u§&Õf´ó‡T”4t”tçf&äã”…—uEtc¥„§•w…6Ó—u¥„£ug¤”CvF¤%uV³fT…&Æ&äç##BôÆÓ†Dug–tg5T„§f4ug–DvÆÆ7§F6&”t”4'¦”ô•…—uEtc¥„§•w…6Ó—u¥„£ug¤µ4#u„sFt”4t”4'•¥…#6ÓCu„sFt”4veg‡U„sFt”4tÇ“†v4s—vEw††DuVv6ÕgU¤ug””„c¥…fÄ”s†4g‡T”4t”…&ö„×Uƒ4'f4…g5•…&ÅVÕgU¤ug•U…fÆEudå•„öF¤$å•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×ó‡U„sFt”4tÇ“†u“#—VFÕg–D4%tÔ4'E•…&Æ6ÖÆ†$4'v6Ó—u¥„£ug¤”vÇVDs†uf¤Vu“#—F4tct§5¥4&Ö#4§E•…&6&”t”4#$ÔS†Dug–tg5T„§f4ug–DvÆÆ7“VÖ#4¤e•tæô´6‡E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×4”s†Dug–tg55sVµ¥†w”C´”‡F6&”t”4t”tçf&äã”s†Dug–tg5$ufÔ”Cväçf&“WE•…&Æ6ÖÆ†$„ÒôÆÇGE•…&Æ6ÖÆ†$VÇU¤ucE…GF6&Ç‡T”4t”4vu–t´s†Dug–tg5$ufÔ”C””sS$ww”‡F6&”t”4t”4u“#—V3#—5¥3S5•„§T´g‡T”4t”4t”4t”t%uV³å•…&Æ6ÖÆ†$„åtÔTçf%„&†Dd'6EvG&¦öu…#¥svD4#'”#3%Vv%tc¥„§•w‡¥w•#v%tc¥„§•w„¦&Õ&ÆTƒD”s–Ô”vG5dU–u–åc”…&õ¥4'E•…&Æ6ÖÆ†$4&¶#%g¦&–C”ucF„ã”7†6&”t”4t”4tµGF6&”t”4t”4v6ÕcE„§Tó‡T”4t”4veg‡U„sFt”4t”4'¦”ö%tc¥„§•w…6Ó—u¥„£ug¤Æäæõ•u&Æ6”•Ct£¥5E3”åds—f&–7”‡F6&”t”4t”4u“#—V35v%tc¥„§•wvu4#vÇ¤ÆÃ—u•„§¥¥e—uEe'f##U6Ó—u¥„£ug¤´s†Dug–tg5T„§f4ug–DvÆÆ7—vv%tc¥„§•w„U¥u—ó‡T”4t”4t”4'3#—TÆÓ†Dug–tg67”f&%tc¥„§•w„¦&Õ&ÆTcu4'E•…&Æ6ÖÆ†$GF6&”t”4t”ƒu¥w‡¥¥4'¦”ö%tc¥„§•w…6Ó—u¥„£ug¤Æäæõ•u&Æ6£‡V35&†6å'¥c&Ã6våfÄ¤äÃgV$vÃ§–·”‡F6&”t”4t”4u“#—V35v%tc¥„§•wvu4#vÇ¤ÆÃ—u•„§¥¥e—uesW6…%6Ó—u¥„£ug¤´s†Dug–tg5T„§f4ug–DvÆÆ7—vv%tc¥„§•w„U¥u—ó‡T”4t”4t”4'3#—TÆÓ†Dug–tg67”f&%tc¥„§•w„¦&Õ&ÆTcu4'E•…&Æ6ÖÆ†$GF6&”t”4t”ƒu¥w‡¥¥4'¦”ö%tc¥„§•w…6Ó—u¥„£ug¤Æäæõ•u&Æ6”•Ct£¥5Ec•eSfe#…U&Ää•U$eV–7”‡F6&”t”4t”4tÇ“†u”w¦##GV%tc¥„§•w‡¥s#†Dug–tg55sVµ¥††E”4'¦s“$uu–ÕVu•w‡•¥tf¶U4#%•w‡¤g‡T”4t”4ve4&Æ$„æÄ”‡F6&”t”4t”4u“#—V3#—5¥3S5•„§T´t%uV³å•…&Æ6ÖÆ†$„åtÔTçf%„&†Dd'6EvG&¦öuesW&&Ó“6&”'¦tfµ¥„“d”5#v%tc¥„§•w…6Ó—u¥„£ug¤Æäæõ•u&Æ6ãtµGF6&”t”4t”ƒ6&”t”4#”µGF6&”veg‡U„sFt”„'–…¦†DuVuƒ4&†6äæÅf¤$åds—f&Ä'–#4&Æ6å'¥„Öõ„sFt”4v%tc¥„§•w…6Ó—u¥„£ug¤ö”%tÔS†Dug–tg4Äg‡T”4t”„æ¦ugE•S†Dug–tg4ö”$…De$uS$æõ¥s„Æ¶Äå•…&Æ6ÖÆ†$7†6&”tµFöu#…U&Äæ¦ugE•3T¥Etc¥„§•wvvS‡T”4t”tçf&äã”vÇ¥d„¦†&äçu•„¦Æ&åu4'E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×V%cVC#—•¤S†4C‡Uw–FeW…4Td5DUdõ$c•F–FD”C‚ô”u¦†$„æÄó‡T”4t”tçf&äã”ugU•t§5¥u&c4§DuVu4'E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×U¦×‡e•…%6Ó—u¥„£ug¥“V$£–c4§DuVå…4•CtÕGF6&”t”4&¦##W¦D4#6ÔgV34&†6ÕgVDfGDv†c4§DuVu4&Æ&Ôf–$ufµvÆG–…&Ä”5–Ô”vÇ¥d„¦†&äçu•„¦Æ&åu„sV6&”t”4&¦##W¦D4'•¥sVµ¥„¥&Euc¥S–Õ¦äæÆDSS%t¦Æ6”””…&ö„×Uƒ5—uTtg–3%e5¥sVµ¥„¥&Euc¥6‡E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×ó‡U„sFt”4u“#—V35v„äFE…'e¦Õ–u4'E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×V%cVC#—•¤S†4C‡Uw–FeW…4TeU%dåUƒ”ô£u£†u¦Ôg63%Su„sFt”4u“#—V35u•w‡vtdæ#%&Ä”Cv„åV6ÔgV34&†6ÕgVD4ô”6D5DUdõ$66tö”'3ãDs–Õ¦”ô”6DådäÄ§”d”6ETTe%eUVäó‡T”4t”tçf&äã”tg64v†…5c#%¦Ô”Cv„äFE…'e¦Õ–u”ö%tc¥„§•w…6Ó—u¥„£ug¤ÆÕ§6#$cT„§f4ug–DvÆÆ7£‡Uw–Fe5c#%¦Ô£u£†tÔ3Cµ4d”…gU¤ufÖsVÅ¤GF6&Ç‡T”4t”tçf&äã”tã$w„æ#%&Ä”Cv%tc¥„§•w…6Ó—u¥„£ug¤ÆÕ§6#$cT„§f4ug–DvÆÆ7£‡Uw–Fe5g6$Se¤uVå…4õ””÷”dÇ”&Æ&ågDÄ4#t”S–Õ¦—vu&ä§f&å4”T¦…“'6veg‡T”4t”tçf&äã”u'fEt§5¥dç¤uf´”Cu“5g6$Se¤uVuC””Du„sV6&”t”4&¦##W¦D4#¥†ƒE„¦Åd„¦†&äæÖ#4§E%†ƒ”CvDv‡7“Vf4s—–De&ÆT…#6ÕeV6ÔgV3%§f6Óö%tc¥„§•w…6Ó—u¥„£ug¤µGF6&Ç‡T”4t”tçf&äã”t¦†3%dF#'‡f6µ¦…“5'f6”””6‡E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×VFÕf¦Ds—•T„§f4ug–DvÆÆ7£‡Uw–Fe#—6#4–å…4õ”&$Õ3GtÄ4„Æ¤4”DWTÔ7vtÕ3Gu…6·V%tgt´g‡T”4t”4t´…“d”sS%t¦Æ6—vvFöv&ågE–Õg”µ4•”ö4•Ct×”ô”…–tö”&å•sE•UedU–öF–·Ä4dÇ”&†$„&õ•4&¦tgV&Õg4”vÇ¤”„ã#4¦Å¤4'&”'6sVÅ•„¦6&”t”4ó‡T”4t”tçf&äã”t¦†3%dF#'‡f6Å&ÆT…#6Õd¦&Õ&ÆT4””s†Dug–tg5T„§f4ug–DvÆÆ7“S¥†ƒE„¦ÅT„§f4ug–DvÆÆ7£‡Uw–FeEtg&Å&ÆT6FDó‡T”4t”tçf&äã”t¦†3%dF#'‡f6Å&ÆT…#6ÕVug‡T”4t”4u–Ôg¥¥Tçf$s—•ducFD…g•¥VÇU¤ucD”4S””sS$w†6&”t”4t”4u”#u„sFt”4t”4t”4t”4'&Õ&ÆTFöu–Ôg¥¥Tçf$s—•ducFD…g•¥VÇU¤ucDÄg‡T”4t”4t”4t”4u¥†ƒ¥sW¦s—V7¦övS‡T”4t”4t”4t”4t”4TÆ“S¥†ƒE„¦Åd„¦†&äæÖ#4§E%†ƒÄg‡T”4t”4t”4t”4ve7†6&”t”4t”4t”4#•„sFt”4t”4t”FövEsVµ¥u§&Õf´ó‡U„sFt”4u“#—V35v&Ó—–%tg5ducFD…g•¥dæ¥•w†Ä”Cv%tc¥„§•w…6Ó—u¥„£ug¤ÆÕ§6#$cT„§f4ug–DvÆÆ7£‡Uw–FeågF4dæ¥•w†Ä£u£†tÕ3Gtó‡T”4t”tçf&äã”sWf6Ó†$e&ÆT…#6Õd¦&Õ&ÆT4””s†Dug–tg5T„§f4ug–DvÆÆ7“S¥†ƒE„¦ÅT„§f4ug–DvÆÆ7£‡Uw–FeågF4S†46FDó‡T”4t”tçf&äã”sWf6Ó†$e&ÆT…#6ÕVug‡T”4t”4v&Ó—–%tg5ducFD…g•¥VÇU¤ucD”4S””sS$w†6&”t”4t”4u”#u„sFt”4t”4t”4t”4'&Õ&ÆTFöv&Ó—–%tg5ducFD…g•¥VÇU¤ucDÄg‡T”4t”4t”4t”4v3$æ†$uSd”sWf6Ó†$e&ÆT…#6ÕeE“$g5¥7†6&”t”4t”4t”4t”ucFDugV3&Çf&äÓd”‡F6&”t”4t”4t”4t”4tÆ“GVDucFD…g•¥e'••sW¥¦Ó—–%UcFD7†6&”t”4t”4t”4t”ƒ5„sFt”4t”4t”4veg‡T”4t”4t”4d”…gU¤ufÖsVÅ¤GF6&Ç‡T”4t”tçf&äã”ugF„ç¦…¦Å&Ôf¦Ds—””Ct´s†Dug–tg5T„§f4ug–DvÆÆ7“S%¥tã#4¥6Ó—u¥„£ug¥“V$£”f%vÇ¦3&Çf&´çf$s—”£u£†uw¤TÔ7vtÔ3GtÄ4tÆ¤4”DWTÔcÆÓ†46†6&”t”4t”vF†%s…%S•U&—†6&”t”4ó‡T”4t”tçf&äã”ugF„ç¦…¦ÅducFD…g•¥VÇU¤ucD”Cv%tc¥„§•w…6Ó—u¥„£ug¤Æå&ÆT…#6Õe6Ó—u¥„£ug¥“V$£”f%vÇ¦3&Çf&³†46FDó‡T”4t”tçf&äã”ugF„ç¦…¦ÅducFD…g•¥4•„sFt”4t”4&Æ%vÇ¦3&Ã%¥e&ÆT…#6Õd¦&Õ&ÆT4…4'VEw‡5„sFt”4t”4t”C†vS‡T”4t”4t”4t”4vsVµ¥†sd”ugF„ç¦…¦ÅducFD…g•¥VÇU¤ucDÄg‡T”4t”4t”4t”4u¥†ƒ¥sW¦s—V7¦övS‡T”4t”4t”4t”4t”4TÆ“S¥†ƒE„¦Åd„¦†&äæÖ#4§E%†ƒÄg‡T”4t”4t”4t”4ve7†6&”t”4t”4t”4#•„sFt”4t”4t”FövEsVµ¥u§&Õf´ó‡U„sFt”4u“#—V35v3&†…¤udF#'‡f6µ¦…“5'f6”””6‡E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×VFÕf¦Ds—•T„§f4ug–DvÆÆ7£‡Uw–FeS&†…¤udF#'‡f6–FD”C‚ô”g7tÆ¦³4Ä4tÆ¦w„Ä4tÆ¦s$Ä4„Æ¤&Dµ3WE•„õ„sFt”4t”4&å•sE•UedU—5„sFt”4tµGF6&”t”4&¦##W¦D4'¦tfµ¥S$…'4wƒUducFD…g•¥VÇU¤ucD”Cv%tc¥„§•w…6Ó—u¥„£ug¤Æå&ÆT…#6Õe6Ó—u¥„£ug¥“V$£•Ftfµ¥e&ÆT…#6ÕVå…GF6&”t”4&¦##W¦D4'¦tfµ¥S$…'4wƒUducFD…g•¥4•„sFt”4t”4'¦tfµ¥S$…'4wƒUducFD…g•¥VÇU¤ucD”4S””sS$w†6&”t”4t”4u”#u„sFt”4t”4t”4t”4'&Õ&ÆTFöv3&†…¤udæEwƒ„'6Ue&ÆT…#6Õd¦&Õ&ÆT7†6&”t”4t”4t”4t”ucFDugV3&Çf&äÓd”‡F6&”t”4t”4t”4t”4tÆ“GVDucFD…g•¥e'••sW¥¦Ó—–%UcFD7†6&”t”4t”4t”4t”ƒ5„sFt”4t”4t”4veg‡T”4t”4t”4d”…gU¤ufÖsVÅ¤GF6&Ç‡T”4t”3‡d”3‡d”tçf&å¦Æ6åvF¤v3&†…¤uVv3&‡¦åtÇ”'¦tfµ¥4###—VUg‡T”4t”w†ÆD4'¦tf¶sVåS&‡¦å$u•tã#4–u4'E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×U¦×‡e•…%6Ó—u¥„£ug¥“V$£•Ftfµ¥dæöu££u£†tÔ3Gtó‡T”4t”w†ÆD4'¦tf¶sVåds—f&æÄu•tã#4–u4'E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×U¦×‡e•…%6Ó—u¥„£ug¥“V$£•Ftfµ¥e'f##ST£u£†tÔ3CTó‡T”4t”„æõ•u'&ÖEV##—VUU¦…“5'f6”””e$•VµddÆ³†Dv…fDvÇ67“W5¥„§t´„æõ•u'&ÖEV##—VUU¦…“5'f6—vtÕ3GtÄ4tÆ¥Vt·”tÆ¥Vt¶”'¦tf¶sVåS&‡¦å$u•tã#4—ó‡T”4t”„æõ•u'&ÖEFvÆÖDU¦…“5'f6”””3¦tf¶sVåS&‡¦å$u•tã#4–tÅ4ôÕ3Gt”3v3&†…¤vÇU£'f##SU&Ôf¦Ds—”µGF6&Ç‡T”4t”tçf&äã”vG5sS¥sW¦…#U&Ôf¦Ds—””Cv%tc¥„§•w…6Ó—u¥„£ug¤ÆÕ§6#$cT„§f4ug–DvÆÆ7£‡Uw–Fe5sV¶„¦Å“5$ÖvFöDVÇVDugV3&ÃU6FD”C‚ô”DTÕGF6&”t”4&¦##W¦D4&æUg†Etg6‡†DvÇf&µ¦…“5'f6”””vG5sS¥sW¦…#U&Ôf¦Ds—””C†tÕ3Gt”3u£&Ä¦&å&Æ&äçD†Äu•tã#4–tö”#&Õ&Å¦ÖÇU¥uu„sV6&”t”4&¦##W¦D4'E•…&¥•„%U¥†ƒE„¦Å5sVµ¥†vu4'E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×VDucFD…g•¥d'–#4&Æ6å'¥„ÒôÆÇ6åƒçvug•¥Tfµ¤6FDó‡T”4t”tçf&äã”s†Dtæ†4U¦…“5'f6”””s†Dtæ†4e&ÆT…#6Õd¦&Õ&ÆT4…4'VEw‡4”C†uw¤WTÔ7vtÕ3GtÄ4„Æ¤&D”FövEsVµ¥u§&Õf´ó‡T”4t”tçf&äã”s†Dtæ†4e&ÆT…#6ÕVug‡T”4t”4v%tc“$guducFD…g•¥VÇU¤ucD”4S””sS$w†6&”t”4t”4u”#u„sFt”4t”4t”4t”4'&Õ&ÆTFöv%tc“$guducFD…g•¥VÇU¤ucDÄg‡T”4t”4t”4t”ƒ6&”t”4t”4tö”#&Õ&Å¦ÖÇU¥uu„sV6&”t”4&¦##W¦D4'–sÖvFöDvÇU£TU¦…“5'f6”””s†Dug–tg5T„§f4ug–DvÆÆ7“VÖ$s–†Dd'–#4&Æ6å'¥„ÒôÆÇ6åƒ§%W‡£&ƒsVåEvÃD£u£†tÔ3Gtó‡T”4t”tçf&äã”„§%S$…'4wƒUducFD…g•¥VÇU¤ucD”Cv%tc¥„§•w…6Ó—u¥„£ug¤Æå&ÆT…#6Õe6Ó—u¥„£ug¥“V$£•6sU¥†ƒE„¦Ä£u„sFt”4u“#—V35v6ÖÇEE…g6DvÇv$†ÅU¥†ƒE„¦Ä”C6&”t”4t”„§%S$…'4wƒUducFD…g•¥VÇU¤ucD”4S””sS$w†6&”t”4t”4u”#u„sFt”4t”4t”4t”4'&Õ&ÆTFöv6ÖÇEE…g6DvÇv$†ÅU¥†ƒE„¦Å5sVµ¥†w5„sFt”4t”4t”4t”4&ÆT…&Æ&äç##W¤ö”#u„sFt”4t”4t”4t”4t”3GTÆå&ÆT…#6ÕeV6ÔgV3%§f6ÓfT…5„sFt”4t”4t”4t”4#”Äg‡T”4t”4t”4t”ƒ6&”t”4t”4tö”#&Õ&Å¦ÖÇU¥uu„sV6&”t”4&¦##W¦D4'u•„¦†%uc6ÖÆ¥VÖÇE#—6#4¤u•tã#4–u4ö%tc¥„§•w…6Ó—u¥„£ug¤Æå¦Å“5'f6Ä'–#4&Æ6å'¥„ÒôÆÇ6åƒ§%Tçf$s—”£u£†uw¤TÔ7vtÔ3GtÄ4tÆ¤4”DWTÔcÆÓ†46†6&”t”4t”vF†%s…%S•U&—†6&”t”4ó‡T”4t”tçf&äã”„&†6ÔgE¥…'–tå6sv6Õg¦&Õg5Ts“5¥„¤u•tã#4–u4'E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×U¦×‡e•…%6Ó—u¥„£ug¥“V$£•6sv6Õg¦&Õg5Ts“5¥„–å…4õ”„Æ¤u„sFt”4u“#—V35v4tg••sÆD„§“§%W‡¦å$u•tã#4–u4'E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×U¦×‡e•…%6Ó—u¥„£ug¥“V$£•6sÖu££u£†tÔ3Gtó‡U„sFt”4u“#—V35v#5c$vÇU¥fG¤…&õEs–µ¥4””g6æ&Ó—U¥674”6C6#4§5¤Tçf#4¦¶sV†Dug¤§—vt£4æ¦6ÕfÆ&´çf#4¦¶sV†Dug¤£%„sFt”4t”4'E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×U¦×‡e•…%6Ó—u¥„£ug¥“V$£•E…'6sVÅc&Æ¶Dv„æ#%&Ä£u£†tÔg‡T”4t”cu•„Öuf¤dåds—f&Äæ¦ugE•3Tå•…&Æ6ÖÆ†$„äåds—f&³“Dw‡&Õe†u#Se¤uSu„sV6&”t”4dÇ”dÇ”#$Ô4'fE…'6sVÅc&Æ¶Dv„u•tã#4–v„ÖvsFu“%gVDvÇE¥…&Æ6Ç‡T”4t”w†ÆD4'fE…'6sVÅc&Æ¶Dv„u•tã#4–u4'E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×U¦×‡e•…%6Ó—u¥„£ug¥“V$£•E…'6sVÅc&Æ¶Dvvå…4õ”tÆ¤u„sFt”4v#5c$vÇU¥fG¤…&õ&Ôf¦Ds—””CtÔ3GtÕ4”s“Dw‡&Õe†u#U¦…“5'f6§F6&Ç‡T”4t”tçf&äã”s“Dw‡&Õe†u#S$…'4wƒUducFD…g•¥VÇU¤ucD”Cv%tc¥„§•w…6Ó—u¥„£ug¤Æå&ÆT…#6Õe6Ó—u¥„£ug¥“V$£•E…'6sVÅc&Æ¶Dv…U¥†ƒE„¦Ä£u„sFt”4u“#—V35v#5c$vÇU¥fG¤…&õE…g6DvÇv$†ÅU¥†ƒE„¦Ä”C6&”t”4t”s“Dw‡&Õe†u#S$…'4wƒUducFD…g•¥VÇU¤ucD”4S””sS$w†6&”t”4t”4u”#u„sFt”4t”4t”4t”4'&Õ&ÆTFöv#5c$vÇU¥fG¤…&õE…g6DvÇv$†ÅU¥†ƒE„¦Å5sVµ¥†w5„sFt”4t”4t”4t”4&ÆT…&Æ&äç##W¤ö”#u„sFt”4t”4t”4t”4t”3GTÆå&ÆT…#6ÕeV6ÔgV3%§f6ÓfT…5„sFt”4t”4t”4t”4#”Äg‡T”4t”4t”4t”ƒ6&”t”4t”4tö”#&Õ&Å¦ÖÇU¥uu„sV6&”t”4&¦##W¦D4'fE…'6sVÅ#—6#4¤u•tã#4–u4ö%tc¥„§•w…6Ó—u¥„£ug¤Æå¦Å“5'f6Ä'–#4&Æ6å'¥„ÒôÆÇ6åƒ“Dw‡&ÕdF#'‡f6–FD”C‚ô”g7tÆ¤4”DTÔ7vtÔ3Gu…6·V%tgt´g‡T”4t”4u£$gF%tdeC$tÄg‡T”4t”6³u„sFt”4u“#—V35v#5c$vÇU¥Tçf$s—•Es–µ¥4””s†Dug–tg5T„§f4ug–DvÆÆ7“VÖ$s–†Dd'–#4&Æ6å'¥„ÒôÆÇ6åƒ“Dw‡&ÕdF#'‡f6³e¤uVå…4õ”t÷”dÇ”&Æ&ågDÄ4#t”U§Tuf´Ä4$æ††Å¤4#•„sFt”4u“#—V35v#5c$vÇU¥W‡£&ƒsVåEvÃE&Ôf¦Ds—””C6&”t”4t”s“Dw‡&ÕdF#'‡f6³e¤uVuC””DVu”ö%tc¥„§•w…6Ó—u¥„£ug¤ÆÕ§6#$cT„§f4ug–DvÆÆ7£‡Uw–FeC5c$vÇU¥W‡£&ƒsVåEvÃD£u£†tÕ3Gtµ4d”DTÔGF6&Ç‡T”4t”tçf&äã”…c%sW%tcs—UEtg¦&ÆT…#6Õd¦&Õ&ÆT4””s†Dug–tg5T„§f4ug–DvÆÆ7“S¥†ƒE„¦ÅT„§f4ug–DvÆÆ7£‡Uw–Fee…¤&&ÖÇEEtg¦&ÆT…#6ÕVå…GF6&”t”4&¦##W¦D4#F´gVs†DvÇf&³†3'EU¥†ƒE„¦Ä”C6&”t”4t”…c%sW%tcs—UEtg¦&ÆT…#6Õd¦&Õ&ÆT4…4'VEw‡5„sFt”4t”4t”C†vS‡T”4t”4t”4t”4vsVµ¥†sd”…c%sW%tcs—UEtg¦&ÆT…#6Õd¦&Õ&ÆT7†6&”t”4t”4t”4t”ucFDugV3&Çf&äÓd”‡F6&”t”4t”4t”4t”4tÆ“GVDucFD…g•¥e'••sW¥¦Ó—–%UcFD7†6&”t”4t”4t”4t”ƒ5„sFt”4t”4t”4veg‡T”4t”4t”4d”…gU¤ufÖsVÅ¤GF6&Ç‡T”4t”tçf&äã”…c%sW%tcs—US$ç–#'‡5tdçu¥ufµ&Ôf¦Ds—””Cv%tc¥„§•w…6Ó—u¥„£ug¤ÆÕ§6#$cT„§f4ug–DvÆÆ7£‡Uw–Fee…¤&&ÖÇES$ç–#'‡5t6FD”C‚ô”DTÔGF6&Ç‡T”4t”3‡d”…c%sW%tcs—US$ç–#'‡5udçu¥ufµ&Ôf¦Ds—””†G$wvu–ÕVv#4'v#4çDuVu–ÕcC%fÆ&”%tÔ4&†&Õuf¤f6&”t”4'5¥…vE…¤&&ÖÇE•…'##UE“4§f$w…¥S4&Å¥u$u•tã#4–u4'E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×U¦×‡e•…%6Ó—u¥„£ug¥“V$£•fF´gVsE“4§f$w…¤£u£†tÔ3Gtó‡T”4t”vÆÔ”6ƒF´gVs†DvÇf&Äæ¦6Ó—6$fÅF4ufÅ¤U¦…“5'f6”…4'VEw‡4µ4#u„sFt”4t”4#F´gVs†DvÇf&Äæ¦6Ó—6$fÅF4ufÅ¤U¦…“5'f6”””3F´gVs†DvÇf&Äæ¦6Ó—6$fÅF4ufÅ¤U¦…“5'f6§F6&”t”4#•„sV6&”t”4&¦##W¦D4#F´gVs†DvÇf&Ä§fDtcs—US4&Å¥u$u•tã#4–u4'E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×U¦×‡e•…%6Ó—u¥„£ug¥“V$£•fF´gVs6#5&†DvÇf&–FD”C‚ô”DTÔGF6&Ç‡T”4t”tçf&äã”s##—U%†ƒ¥sW¦s—Tö”%tÕSV##—US$æõ¥s„ÆÅ¥5ETäå•…&Æ6ÖÆ†$„äåds—f&”””‡F6&”t”4t”„çu¥tåu¥„§¦s—Tö”äÕ3Gt§—†6&”t”4t”…'••sW¦4tg•¥sSc&Ãg†6ÖÃ¥7†6&”t”4t”„¦Æ&Õ&Æ6Äc¥…fÅC%¦Ö3%cFågE–Õg”Äg‡T”4t”4v3&†…¤udF#'‡f6µ¦…“5'f6—†6&”t”4t”„æõ•u&ÅE…g6DvÇv$†ÅU¥†ƒE„¦ÄÄg‡T”4t”4v3&†…¤vÇU£æöu£&Ôf¦Ds—”Äg‡T”4t”4v3&†…¤vÇU£'f##SU&Ôf¦Ds—”Äg‡T”4t”4u£&Äf5…f†$vÃe•…'##Tu•tã#4—5„sFt”4t”4'E•…&¥•„$u•tã#4—5„sFt”4t”4'E•…&¥•„%U¥†ƒE„¦ÄÄg‡T”4t”4v6ÖÇEDvÆæ…'&ÖDæ†„u•tã#4—5„sFt”4t”4'–sæEwƒ„'6Ue&ÆT…#6ÕW5„sFt”4t”4'u•„¦†%uc6ÖÆ¥VÖÇE#—6#4¤u•tã#4—5„sFt”4t”4'u•„¦†%uc6ÖÆ¥VÖÇE&ä¦Æ3#VÆ$d'fC%g•&Ôf¦Ds—”Äg‡T”4t”4v4tg••sÆD„§“§%W‡¦å$u•tã#4—5„sFt”4t”4'fE…'6sVÅc&Æ¶Dv„æ#%&ÄÄg‡T”4t”4v#5c$vÇU¥fG¤…&õ&Ôf¦Ds—”Äg‡T”4t”4v#5c$vÇU¥fG¤…&õE…g6DvÇv$†ÅU¥†ƒE„¦ÄÄg‡T”4t”4v#5c$vÇU¥Tçf$s—•&Ôf¦Ds—”Äg‡T”4t”4v#5c$vÇU¥W‡£&ƒsVåEvÃE&Ôf¦Ds—”Äg‡T”4t”4vE…¤&&ÖÇE•…'##Tå•„ç%ducFD…g•¥7†6&”t”4t”…c%sW%tcs—US$ç–#'‡5tdçu¥ufµ&Ôf¦Ds—”Äg‡T”4t”4vE…¤&&ÖÇE•…'##UE“4§f$w…¥S4&Å¥u$u•tã#4—5„sFt”4t”4#F´gVs†DvÇf&Ä§fDtcs—US4&Å¥u$u•tã#4—5„sFt”4veGF6&Ç‡T”4t”„¦ÆD…g–&”#u„sFt”4t”4TÆ“W¥“&†Æ%tdå•…&Æ6ÖÆ†$7†6&Ç‡T”4t”4v4t§•Euc•w‡6tå6#5fæsVÆ34Ód”‡F6&”t”4t”4u–Ôg¥¥Tçf$s—•&Ôf¦Ds—”Äg‡T”4t”4t”4&••„æÅ#—6#4¥U¥†ƒE„¦ÄÄg‡T”4t”4ve7†6&”t”4t”sWf6Ó†$e&ÆT…#6ÕW5„sFt”4t”4&Æ%vÇ¦3&Ã%¥e&ÆT…#6ÕW5„sFt”4t”4&Æ%vÇ¦3&Ã%¥U¦…“5'f6—†6&”t”4t”tg64v†…Es–µ¥7†6&”t”4t”tg64v†…5c#%¦ÔÄg‡T”4t”4u¤s“–×†ÅS&Æµ¥u5„sFt”4t”4&ÆT…&Æ&äç##W¤ö”#u„sFt”4t”4t”3‡d”ug¦$vÇVD3¶„æ…–×†ÄÅsVÆT…F$vÇU¥4$D†Çu¥„æ¦6ÖÇvD3Æ3'‡&åf&ÔgFsVäÅtçf&å¦Æ&å'##V6&”t”4t”4ufÄ¤å—E•…&Æ6ÖÆ†$„æf%…'f##Cd”s##—U%†ƒ¥sW¦s—TÄg‡T”4t”4ve7†6&”t”4#”ó‡T”4#•„sV6&”v4„§FÔc¥4&f4tg–3%etÔegV$vÃT„§f4ug–DvÆÆ7–†6&”t”4'E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„Ód”e—uEtc¥„§•ww5„sFt”4v3$æõ¥s…Etc¥„§•wsd”VDÕdU¥E“&†Æ%tWU5S†Dug–tg4Äg‡T”4ö”$…De$uS$æõ¥s„Æ¶Äå•…&Æ6ÖÆ†$4#u„sFt”4u“#—V35v„åV6ÔgV34&†6ÕgVDg†6ÖÃ¥4””s†Dug–tg5T„§f4ug–DvÆÆ7“W¦tfµ¥„–uC””6EuV³eesW6…%V6ÔgV34&†6ÕgVDg†6ÖÃ¥63u„sFt”4u“#—V35v„åV6ÔgV34&†6ÕgVD4””s†Dug–tg5T„§f4ug–DvÆÆ7“W¦tfµ¥„–uC””6EuV³eesW6…%V6ÔgV34&†6ÕgVD66vd‡vv„åV6ÔgV34&†6ÕgVDg†6ÖÃ¥GF6&Ç‡T”4t”tçf&äã”„¦Æ&Õ&Æ6Äc¥…fÅC%¦Ö3%cFågE–Õg””CvDv‡7“VfF¤%•„§¥¥d¦Æ&Õ&Æ6Äc¥…fÄ´s†Dug–tg5T„§f4ug–DvÆÆ7–³u„sV6&”t”4&¦##W¦D4'3ãDs–Õ¦”””s†Dug–tg5T„§f4ug–DvÆÆ7“W¦tfµ¥„–uC””6EuV³eesW6…$FE…'fE…äó‡T”4t”tçf&äã”tg64v†…Es–µ¥4””vÇ¥d„¦†&äçu•„¦Æ&åu”å·„eFµä”Föv„äFE…'e¦Õ–u”åETeE7–6tö”åC$%Uedd§§F6&”t”4&¦##W¦D4&†$„&õ•TãDs–Õ¦”””vÇ¥5c#%¦Ô”C†t´s†Dug–tg5T„§f4ug–DvÆÆ7“VÖ$s–†Dd'–#4&Æ6å'¥„ÒôÆÇ6åƒãDs–Õ¦–FD”C‚ô”DTå6¶tö”#&Õ&Å¦ÖÇU¥uu„sV6&”t”4&¦##W¦D4#¥†ƒE„¦Åd„¦†&äæÖ#4§E%†ƒ”CvDv‡7“Vf4s—–De&ÆT…#6ÕeV6ÔgV3%§f6Óö%tc¥„§•w…6Ó—u¥„£ug¤µGF6&Ç‡T”4t”tçf&äã”t¦†3%dF#'‡f6µ¦…“5'f6”””6‡E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×VFÕf¦Ds—•T„§f4ug–DvÆÆ7£‡Uw–Fe#—6#4–å…4õ”&$Õ3GtÄ4„Æ¤4”DWTÔ7vtÕ3Gu…6·V%tgt´vF†%s…%S•U&–³u„sFt”4u“#—V35u–Ôg¥¥Tçf$s—•ducFD…g•¥VÇU¤ucD”Cv%tc¥„§•w…6Ó—u¥„£ug¤Æå&ÆT…#6Õe6Ó—u¥„£ug¥“V$£”å•vÇUducD£u„sFt”4u“#—V35u–Ôg¥¥Tçf$s—•ducFD…g•¥4•„sFt”4t”4&••„æÅ#—6#4¥U¥†ƒE„¦Å5sVµ¥†vt•Cv&åg6$g‡T”4t”4t”4ô”‡F6&”t”4t”4t”4t”vÇU¤ucDö”&••„æÅ#—6#4¥U¥†ƒE„¦Å5sVµ¥†w5„sFt”4t”4t”4t”4&ÆT…&Æ&äç##W¤ö”#u„sFt”4t”4t”4t”4t”3GTÆå&ÆT…#6ÕeV6ÔgV3%§f6ÓfT…5„sFt”4t”4t”4t”4#”Äg‡T”4t”4t”4t”ƒ6&”t”4t”4tö”#&Õ&Å¦ÖÇU¥uu„sV6&”t”4dÇ”#3%Vv%…'f##FvsW¦Duf…¤4'e¦”#&×‡D7vv3&ÇU“%VvDv†Æ6ÕVv%vÆæ…u–ÕVufÄ¤äÔ3Gt”„çu¥tç¦ÖÆ¤”u¦Å•…#6Õg¤”…&õ•…u•„¦Ä”sWfD4'¦E„'v#4£¥uu–æ¶u£'ƒ¦Ç‡T”4t”tçf&äã”s##—U%†ƒ¥sW¦s—Tö”%tÕSV##—US$æõ¥s„ÆÅ¥5ETäå•…&Æ6ÖÆ†$„äåds—f&”””‡F6&”t”4t”„çu¥tåu¥„§¦s—Tö”äÕ3Gt§—†6&”t”4t”…'••sW¦4tg•¥sSc&Ãg†6ÖÃ¥Föv„åV6ÔgV34&†6ÕgVDg†6ÖÃ¥7†6&”t”4t”„¦Æ&Õ&Æ6Äc¥…fÅC%¦Ö3%cFågE–Õg”Äg‡T”4t”4v3&†…¤udF#'‡f6µ¦…“5'f6¦öu–Ôg¥¥Tçf$s—•&Ôf¦Ds—”Äg‡T”4t”4v3&†…¤udæEwƒ„'6Ue&ÆT…#6ÕSd”t¦†3%dF#'‡f6Å&ÆT…#6ÕW5„sFt”4veGF6&Ç‡T”4t”„¦ÆD…g–&”#u„sFt”4t”4TÆ“W¥“&†Æ%tdå•…&Æ6ÖÆ†$7†6&Ç‡T”4t”4v4t§•Euc•w‡6tå6#5fæsVÆ34Ód”‡F6&”t”4t”4u–Ôg¥¥Tçf$s—•&Ôf¦Ds—”Äg‡T”4t”4t”4&••„æÅ#—6#4¥U¥†ƒE„¦ÄÄg‡T”4t”4ve7†6&”t”4t”tg64v†…Es–µ¥7†6&”t”4t”tg64v†…5c#%¦ÔÄg‡T”4t”4u¥†ƒ¥sW¦s—V7¦övS‡T”4t”4t”4dÇ”&Æ3'‡&åE¤vÇ¥•t§5¥3U¥†ƒÅw‡&ÕVu…#V4ug¥“4§4…E¥„ç6sSÃ#V†%vÇU§“¦##S%¥sSs—U„sFt”4t”4t”e¥5ETæf%tc¥„§•w‡¥ƒ###—Tö”'FDs—f&µcFDugV3&Çf&—†6&”t”4t”ƒ5„sFt”4veGF6&”veg‡U„sFt”3‡¶Ç‡T”4t¶”$F6Õf†DuVu•4&æ$e$t”t$Å4d¦fDucFD…g•¥c“6ÔgV3%§f6Ót”ucFDugV3&Çf&”&Ö6Ó—D”…—t”…&ÆT…#6ÕVvD„¦†&äæÖ#4§D”vÇU¦Ó‡U„sFt”4Ã‡T”4'v6ÖÃ%•…&Ä”c—v#4£ducFD…g•¥e'••sW¥¦Ó—–%6‡E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„Ód”e—uEtc¥„§•wwö”#t”gGU•sÄö”'¦D„§&ÖFDö”&†&æ¶ve4#u„sFt”4u“#—V35vDucFD…g•¥e'••sW¥¦Ó—–%4””s†Dug–tg5T„§f4ug–DvÆÆ7“S%¥tã#4¥6Ó—u¥„£ug¥“V$£”å•vÇUducD£u„sFt”4vu–t´…&ÆT…#6ÕeV6ÔgV3%§f6ÓuCv&åg6$6¶vS‡T”4t”4v6ÕcE„§T”‡C”ó‡T”4t”ƒ6&Ç‡T”4t”tçf&äã”s–Õ¦äæÆD4””gC¥†ƒE„¦Åd„¦†&äæÖ#4§E“V$Ôcu£†tÔ3GtÄ4#¥†ƒE„¦Åd„¦†&äæÖ#4§E“V$Õcu£†tÔ3Gu…GF6&”t”4&¦##W¦D4'¥“$g5¥4””gC¥†ƒE„¦Åd„¦†&äæÖ#4§E“V$ÖÃu£†tÕ3GtÄ4#¥†ƒE„¦Åd„¦†&äæÖ#4§E“V$Óu£†tÕ3Gu…GF6&Ç‡T”4t”s–Õ¦äæÆDg7……4””DWTÔ4D”„æ¥•w†Åw¤fD”3v#%¦Ö3%cw¤fDó‡U„sFt”4v6ÕcE„§T”‡F6&”t”4t”3‡d”ug¦$vÇVD3¶„æ…–×†ÄÅsVÆT…F$vÇU¥4$D†Çu¥„æ¦6ÖÇvD3Æ3'‡&åf&ÔgFsVäÅtçf&å¦Æ&å'##V6&”t”4t”WD•VÃ“¥†ƒE„¦Åƒ5'••sW¥¦Ó—–%FövW”'e¦Õ§¥¥…4”„æ¥•w†Ä”ƒ5„sFt”4veGF6&”veg‡U„sFt”3‡¶Ç‡T”4t¶”$F##S%¥„£”…—t”„¦Æ&Õ&Æ6”'f6Õ&Æ6”'&å'd”…—„”„¦Æ&Õ&Æ6”'f6Õ&Æ6“V6&”t”6öudv‡7”#3%g¤”tVv%tgt”u§–##vF¤v6ÕgU¤ug””„c¥…fÄ”…'d”…—„”tçf%„'6tgVD4'•¥sVµ¥„–v5…fÆEuVv#%¦Ö3%c”†Fötæô”vÇ¤”vFÆ&Õg••…&Å¤4'&”#uw‡&×6uƒ4'f4…g5•…&ÅVÕgU¤ug•U…fÆEudå•„#”ÆÇ‡T”4t¶“–6&”v4„§FÔc¥4&fF¤%•„§¥¥d¦Æ&Õ&Æ6Äc¥…fÄ´s†Dug–tg5T„§f4ug–DvÆÆ7¦öuf¤$å•…&Æ6ÖÆ†$6³d”sS%t¦Æ6”#u„sFt”4u“#—V35v„åV6ÔgV34&†6ÕgVDg†6ÖÃ¥4””s†Dug–tg5T„§f4ug–DvÆÆ7“W¦tfµ¥„–uC””6EuV³eesW6…%V6ÔgV34&†6ÕgVDg†6ÖÃ¥63u„sFt”4u“#—V35v„åV6ÔgV34&†6ÕgVD4•„sFt”4t”4'E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×V%cVC#—•¤S†4C‡Uw–FeW…4Td5DUdõ$c•F–FD”4S””…gU¤ufÖsVÅ¤4#†dg‡T”4t”4v%tc¥„§•w…6Ó—u¥„£ug¤Æäæõ•u&Æ6”•Ct£¥5E3•f&×‡De'••sW¦4tg•¥sS§”#†dg‡T”4t”4v„åV6ÔgV34&†6ÕgVDg†6ÖÃ¥GF6&”t”4&¦##W¦D4&Æ&Ôf–$ufµvÆG–…&Ä”Cv%tc¥„§•w…6Ó—u¥„£ug¤ÆÕ§6#$cT„§f4ug–DvÆÆ7£‡Uw–FevÆG–…&Ä£uC””DVvd‡vv„åV6ÔgV34&†6ÕgVDg†6ÖÃ¥GF6&Ç‡T”4t”w†ÆD4'e¦Õ§¥¥…u4tó‡U„sFt”4vu–t´vÇ¥d„¦†&äçu•„¦Æ&å”‡F6&”t”4t”tçf&äã”…—uU…fÆEuVu4'E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×V6ÕgU¤ug•U…fÆEuSu„sV6&”t”4t”vÆÔ”6ƒ$Ôdc¥…fÄ”4S””sS$ww”‡F6&”t”4t”4vu–t´ugU•t§5¥u&c4§DuW”‡F6&”t”4t”4t”4'e¦Õ§¥¥…u4#vÇ¤ÆÃ—•¥sVµ¥„¥&Euc¥S†4e'••sW¦4tg•¥sSvÆG–…&ÄÆÖFÆD6ƒ$Ôdc¥…fÄµ4Su„sFt”4t”4t”ƒu¥w‡¥¥4#u„sFt”4t”4t”4v#%¦Ö3%c”CvDv‡7“Vf6ÕgU¤ug•U…fÆEudå•„%V6ÔgV34&†6ÕgVD3Vå¥…öF¤%&Euc¥6¶„ó‡T”4t”4t”4#•„sFt”4t”4#•„sFt”4veg‡U„sFt”4v6ÕcE„§T”s–Õ¦äæÆDGF6&”veg‡U„sFt”3‡¶Ç‡T”4t¶”$F6Õf†DuVu•4'E•„vC&‡“&vv%tgv7”#$Ô4'•¥sVµ¥„–v5…fÆEuVvDs†vF¤Vu“#—F4w‡•sS”„¦Æ&Õ&Æ6”'†Euc¥4'e¦Õ§¥¥…U„sFt”4”e&ö„Öv$vÇ¦D„ÖvE„u•w‡4”„¦Æ&Õ&Æ6”'†Euc¥„ÖvDv†Ä”se¤ug4”…g¥¥4&†&Õu“4¦Å•…&Æ7”&„”s†44#'”'U¥†6v6ÕgU¤ug””„c¥…fÄ”s–Õ¦äæÆD„ÖvsFvDv†Ä”„æ†%uVv#4¦µ¥„—U„sFt”4Ã‡T”4'v6ÖÃ%•…&Ä”c—v#4#$tc¥d¦Æ&Õ&Æ6Äc¥…fÅEtgt´s†Dug–tg5T„§f4ug–DvÆÆ3‡35d”e—uEtc¥„§•w†%…6¶vS‡T”4t”3‡¶Ç‡T”4t”4”TVv3%c”s–Ô”…g¥¥uv6ÕgU¤ug””„c¥…fÆ7”'&”%V6ÔgV34&†6ÕgVD4'E•…&Æ6ÖÆ†$„×U„sFt”4t”6÷e„sFt”4u“#—V35v6ÕgU¤ug•U…fÆEug¥d„¦†&äçu•„¦Æ&åu4'U¥†6uS%csS%t¦Æ6£FôµGF6&Ç‡T”4t”3‡¶Ç‡T”4t”4”TVv3%c”s–Ô”…g¥¥uv6ÕgU¤ug””„c¥…fÆ7”'&”%V6ÔgV34&†6ÕgVDg†6ÖÃ¥4'E•…&Æ6ÖÆ†$„×U„sFt”4t”6÷e„sFt”4u“#—V35v6ÕgU¤ug•U…fÆEug¥d„¦†&äçu•„¦Æ&å&c4§DuVu4'U¥†6uS%csS%t¦Æ6£FôµGF6&Ç‡T”4t”3‡d”„'f4…g5•…&Ä”…&õ¥4'•¥sVµ¥„–v5…fÆEuVv3%c„sFt”4v%tc¥„§•w…6Ó—u¥„£ug¥DvÇ¦D3VÖ#4¤e•tæô´6‡E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×”C´”‡F6&”t”4t”tçf&äã”vÇ¥d„¦†&äçu•„¦Æ&å&c4§DuVu4'E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×V3&†…¤ug””C•4åfÄ¤äÃgV$vÃd„¦†&äçu•„¦Æ&å&c4§DuVäó‡T”4t”4u“#—V35v„åV6ÔgV34&†6ÕgVD4•„sFt”4t”4t”s†Dug–tg5T„§f4ug–DvÆÆ7“W%¥†Ã6#4¦µEtgu“V$£”%Dd$•T¤Õ%STUƒ”ô£t•CvEsVµ¥u§&Õf´”‡ƒ…„sFt”4t”4t”s†Dug–tg5T„§f4ug–DvÆÆ7“W¦tfµ¥„–uC””6EuV³eesW6…%V6ÔgV34&†6ÕgVD66vd‡†6&”t”4t”4v„åV6ÔgV34&†6ÕgVDg†6ÖÃ¥GF6&”t”4t”tçf&äã”ugU•t§5¥u&c4§DuVu4'E•…&Æ6ÖÆ†$d'–#4&Æ6å'¥„×U¦×‡e•…%6Ó—u¥„£ug¥“V$£–c4§DuVå…4•CtÕ4#†d4'3'••sW¦4tg•¥sSvÆG–…&Äó‡U„sFt”4t”4'¦”ö„åV6ÔgV34&†6ÕgVD6¶vS‡T”4t”4t”4&¦##W¦D4#$Ôdc¥…fÄ”Cv%tc¥„§•w…6Ó—u¥„£ug¤Æä¦Æ&Õ&Æ6Äc¥…fÄó‡U„sFt”4t”4t”vÆÔ”6ƒ$Ôdc¥…fÄ”4S””sS$ww”‡F6&”t”4t”4t”4'¦”õ¥sV…–×†Å¤g†6ÖÃ¥6¶vS‡T”4t”4t”4t”4v6ÕgU¤ug•U…fÆEug¥d„¦†&äçu•„¦Æ&å&c4§DuWU•u&´´…—uU…fÆEuWó‡T”4t”4t”4t”ƒu¥w‡¥¥4#u„sFt”4t”4t”4t”4'•¥sVµ¥„¥&Euc¥„åV6ÔgV34&†6ÕgVD3V…¤uöF¤%&Euc¥6³u„sFt”4t”4t”4veg‡T”4t”4t”4#•„sFt”4t”4#•„sFt”4ve6³u„sV6&”t”4dÇ”'¦s“4”tVvC$g–&ÖÇU§”'¦”#uVv%s–µ¥wvvE„æÆ7”#$Õ4'&Ôçf%„&†DvÆ–$uVv&ågE–Õg””s–Ô”„¦Æ&Õ&Æ6”'†Euc¥„æ6&”t”4'¦”ö6ÕgU¤ug•U…fÆEug¥d„¦†&äçu•„¦Æ&åV3&Ãe¥4´”DWtµ4#u„sFt”4t”4&¦##W¦#'†ÄÆæF†6ÓFõ„sFt”4t”4t”t%uV³å•…&Æ6ÖÆ†$„åtÔTçf%„&†Dd'6EvG&¦öudv‡7”%uV³vE„æÆ7”¶S4¦Æ&Õ&Æ6Äc¥…fÆ3'••sW¦4tg•¥sSÆäçVÕc””„¦Æ&Õ&Æ6”'†Euc¥„Öu¦Ó—””e'••sW¦4tg•¥sS”s†Dug–tg67”#6vÇ5¥4%uV³tÕ3Gt”s—V$†¶v35gv4s—–D„ÖvE„vDs†tÕDv6ÕgU¤ug””„c¥…fÆ7“Fudv†Ä”se¤ug4”s£&ƒ”sWfD4&•¥4'•¥sVµ¥„¦Å¤4&¦#4§•¥tã$†·U”7†6&”t”4t”6³u„sFt”4veg‡U„sFt”4vu–t´„¦Æ&Õ&Æ6Äc¥…fÆ3'••sW¦4tg•¥sSvÆG–…&ÄÆäçVÕVu”„Ô6¶vS‡T”4t”4u“#—V3#—5¥3S5•„§T´g‡T”4t”4t”4&ufÄ¤åEtc¥„§•w‡¥f¤$F##u•…%$…fæsCd”e&ö„ÖufÄ¤ä”…g¥¥„Öt¤‡G•¥sVµ¥„¥&Euc¥„åV6ÔgV34&†6ÕgVDg†6ÖÃ¥3W¦‡Æe4'•¥sVµ¥„–v5…fÆEug¤”u§f6”%V6ÔgV34&†6ÕgVDg†6ÖÃ¥4'E•…&Æ6ÖÆ†$„ÖvC&‡$uVufÄ¤ä”DWTÔ4'f&×ƒT”„ã4„'f6å'¤”…gt”…'d”DWt”„¦Æ&Õ&Æ6”'†Euc¥„×T”e&õ¥4'F#%&Æ$4'FvFöD4'V#5u–ÕVv6ÕgU¤ug•¥uu“#—–6Õf¦DwƒTÆÔ5„sFt”4t”4ó‡T”4t”ƒ6&Ç‡T”4t”3‡d”tç•¥tc¥4&„”s†44&Ö6Ó—D”…—t”„¦Æ&Õ&Æ6”'†Euc¥4#'”#$Õ4'•¥sVµ¥„–v5…fÆEuVv#%¦Ö3%c„sFt”4u„§••†·U¦ä§f%6‡•¥sVµ¥„¥&Euc¥„åV6ÔgV34&†6ÕgVD6Æ6&”t”4t”3W¦#4£´6Æ6&”t”4t”3VÖ#4¤e•tæô´6‡†Euc¥7vv6¶uCFvS‡T”4t”4t”4&¦##W¦D4'U¥†E&Euc¥S–Õ¦äæÆD4””S†DvwV%vÇT´S†DvwV%tcD´v¶tÅ4'•¥sVµ¥„¥&Euc¥„åV6ÔgV34&†6ÕgVD3W¦‡Ä”76tÕ7vtÅF·Ä4tµGF6&”t”4t”4vDv‡7“Vf6ÕgU¤ug•U…fÆEudå•„%V6ÔgV34&†6ÕgVD3W¥¥…ö5…fÆEuW4”sVÆCc¥…fÅC%¦Ö3%cµGF6&”t”4t”ƒó‡U„sFt”4u„§••†·U¦ä§f%6‡•¥sVµ¥„¥&Euc¥„åV6ÔgV34&†6ÕgVDg†6ÖÃ¥6Æ6&”t”4t”3W¦#4£´6Æ6&”t”4t”3VÖ#4¤e•tæô´6‡†Euc¥7vv6¶uCFvS‡T”4t”4t”4&¦##W¦D4'U¥†E&Euc¥S–Õ¦äæÆD4””S†DvwV%vÇT´S†DvwV%tcD´v·4”DÄ4TµGF6&”t”4t”4vDv‡7“Vf6ÕgU¤ug•U…fÆEudå•„%V6ÔgV34&†6ÕgVDg†6ÖÃ¥3W¥¥…ö5…fÆEuW4”sVÆCc¥…fÅC%¦Ö3%cµGF6&”t”4t”ƒó‡T”4#•„sS•„sF”Ä4•¥†‡v#4£”u£&Ôãs—T”vF†%s…%S•U&–†Äö”'VEs•¥„—ö”'VEs•¥„–vS‡T”4'•¥…#6ÓFuEtc3Wv#66õ¥7vtÖ“G”µGF6&ã6&”—4”4§%„'f6åt¶”&†7”%U4d¤e%4&Ö6Ó—D”6C„¦Å¥63u„sW%„'f6åvW”%uV³ö#%&Å#—V35'••vÇVD4#””u§–##t§“GTÃ¥5ESWe¤udF##W¦D„¦†sS§§F6&Ç‡U“#—V35uƒ5—¥4””sVÆG”%U4d¤e%3Uu¥tã#4—¤´6³u„sV6&ÕcF4s—–D4&¦$tg¦7”%uV³ö#%&Å#—V35'••vÇVDV†Æ$„&Æ6”&ÆT…&Æ&Õ'¤”e$•VµddÆ¶G–#5gt”‡F6&”v4…f–$vÆ¤”„¦Å•u'f&×ƒT”tçf&äã6Ôg&åd”e¥5ESWe¤udF##W¦D„¦†sSó‡T”4'v6ÖÃ%•…&Ä”c—6sVÄö”%U4d¤e%3TÖsVÄó‡T”4'v6ÖÃ%•…&Ä”c–†D…'•Ts—¦…'##Cd”e$•VµddÆ´£¦Õ¦Æ6´cD„§–åc¥GF6&Ç‡T”4'vEt§6tÖu“#—V35'–Etã#4–õ“#—V35'••vÇVDFöufÄ¤åFÓ–µ¥Tçf&äã6Ôg&å”‡F6&”t”4'¦E„&Æ6–wó‡U„sFt”4vDv‡7“Ve•…#6Ä'f3&Ãs—T”Cv&Õc4”e$•VµddÆ´£¦Õ¦Æ6´cD„§–åc¥6‡U¥†6u&×‡e•…¤Ö´g–6ÔcT´g7tÄ4tÄ4tÄ4tÄ4tÄ4u…6·4”D×ó‡T”4t”…&ö„×Uƒ$cD„¥#4çDvÇf&“W¥¥…%f3$få¥6…U4d¤e%3TVUsV†%vÆ¥$„¦†Cg¥•vFÄµGF6&Ç‡T”4t”tçf&äã”vFÆ##ÆD„£T”Cv&Õc4”e$•VµddÆ´£¦Õ¦Æ6¶FÆ##ÆD„£T´6³u„sFt”4u£%gf%uc6æ·V3%c…#6ÖÆ–E…&Ä´6Gv#4çDvÇf&–74”…&ö„×Uƒ$cD„¥#4çDvÇf&–³u„sV6&”t”4&¦##W¦D4'E•…&Æ6ÖÆ†$4””sVÆG”%U4d¤e%3TÖsVÅÔg¦täå•…&Æ6ÖÆ†$6ƒu„sFt”4t”4&¦#'‡f6¦ötÔ††Õ¦¤u¦Õ—5„sFt”4t”4&µ¥„#e&Æ35d”u¦†$„æÄÄg‡T”4t”4u¤ugvDv…†6ÖÃ¥Föu¦Ôg63%W5„sFt”4ve6³u„sV6&”t”4#vÇ¤ÆÃ—6sVÄ”Cv&Õc4”e$•VµddÆ·‡&ÕVõ£%gf%uc6æ·4”s†Dug–tg4µGF6&”t”4#vÇ¤ÆÔfµ¤6ƒvÇ¤ÆÃ—6sVÄµGF6&Ç‡T”4t”…&ö„×U“#—V35'••vÇVD4””tçf&äã6Ôg&åu„sFt”ƒ6&Ç‡T”4'vEt§6tÖvE„&µ•…&ÅEtc6ÖÃEc#—–$uõ¦Ó—•“%Rôö”&–##—5¥tgTµFövFÓ—¤4#u„sFt”4uƒ5—¥3W¥¥…$v6Ó—EEtc6ÖÃETs—¦…'##FöDv‡7“V¦##W¦D„¦†sSÆÕ&Æ35'&Ôcs—TÆÓ†D„§TfGf6×†´µGF6&”t”4#vÇ¤ÆÃ–†D…'•Ts—¦…'##GV3%ctfÆ´D4”c“$ÓWVT7vuƒ5—¥3STÄ4&fF¤ä$Ææ÷ó‡U„sFt”4vu–t´…&ö„×U“#—V35'••vÇVD3W¦#5g•“%W”‡F6&”t”4t”c“$ÓWV3%c&ä§f%S†D„§Td'f3&Ãs—T´…&ö„×U“#—V35'••vÇVD3W¦#5g•“%WV%tc6ÖÃEc#—–$uó‡T”4t”ƒ6&”t”4#vÇ¤ÆÃ–†D…'•Ts—¦…'##GV3%ctfÆ´DW4”c“$ÓWVT7vuƒ5—¥3STÄ4&fF¤ä$Ææ÷ó‡U„sFt”4vDv‡7“Ve•…#6Ä'f3&Ãs—TÆÓVÅ¥u'¥e„&µ•…&Ä”CvD„£¥GF6&Ç‡T”4t”„ã4ug”Æågu¤tc¥S†D„§TfGf6×†´´u§f6ÔæÄµGF6&”veg‡Veg‡T–—vt–ÖÇF4s—–D4”tg¤”e$•Vµdd”u§–##t£5&ö6ÕfÄ§§F6&ÖÇF4s—–D4#t”u&Å“#—F4s—¥¥d'f3&Ãs—T”ƒu¦ä§f%4äÆ““DvÇ67“–µ¥tçf%„'f3%e#4çDvÇf&–3u„sW%„'f6åvW”&µ¥tçf%„'f3%e6#5&†DvÇf&”#””u§–##t§“GfE…'$„×e¤uf¦##v#4æÅVÓ“•…'##Fäó‡Vsv#4£”‡6v5…f†DVÇVFÕg–DTçf%„&†D4#””u§–##t§“GfE…'$„×f5…f†DVÇVFÕg–DTçf%„&†D63u„sW%„'f6åvW”%uV³ö#%&Å#—V35'••vÇVD4#””u§–##t§“GefÄ¤åFÓ–µ¥Tçf&äã6Ôg&åäó‡U„sV¦##W¦D4&fF¤ä$”Cv&Õc4”e$•VµddÆÅ¦Å“5'f6¤ÖôµGF6&Ôçf&äã”c“$Ó–u4'U¥†6udV…5%UWUfÕf¦Ds—”×–wó‡U“#—V35uƒ5—¥”””sVÆG”%U4d¤e%3Uu¥tã#4—¤´6³u„sV¦##W¦D4&f5…f†DTVu4'U¥†6udV…5%UWUU…f†Dug–&ÖÇf&–wó‡U“#—V35uƒ4c•…$4”Cv&Õc4”e$•VµddÆÄc•…&Æ6ÓW##FôµGF6&Ôçf&äã”c—†Etc”””sVÆG”%U4d¤e%3U&Etc¥„§Vs—T´6³u„sV6&“‡¶Ç‡T”6öu4&¦##W¦D„¦†sS”…&õ•…v%tg%¥„Öv…v$s—f”&†D4&„”„çfE„¦¥¥4'e–×Å“5U„sFt¶Ç‡T”6öuS%fÄö”&öD…'v7¦÷dÃ&GDvƒ–“V¦##fFä§DÅt×fFä§DÅ„çu¥tç¦ÖÆ¥•…'##GfD„¦Å¥3—E•„ã¥„—f34&Å“&ÆÖtæ†DvÇf&“•uV³Eƒ#We¤ufe“#—V35'••vÇVD3„Æ¤&e–Õc•4ç–#'‡4Åtçf&äã6Ôg&å&6&”Ã‡U¥†‡v#4£”tç5•„ç¤”e¥5ETg%Tçf&äã6Ôg&åu¥†ƒ¥sV¶7”%uV³ö#%&Å#—V35'••vÇVD4#u„sFt”3‡¶Ç‡T”4t¶”%VuVu•vÇD”tcF„Öv#%–vDv†Ä”tçf&äã6Ôg&åU„sFt”4Ã‡T”4'vEt§6tÖu£%c”tg%TcF„ÖôµFöt£'f3&Ã…¦Åt66vd4åFÕfå•…'FÕe”§”#„”6E#4çDvÃ%¥f¶ä”‡vt£VÅ£$c…¦Åu66vd4åTs—¦…'FÕf§”#„”6Dõ¥vF†DvÃ%¥föä”‡F6&”t”4'•¥…#6ÓFvDv‡7“Ve•vÇE†‡7§F6&”veg‡U„sFt”3‡¶Ç‡T”4t¶”%VuVu•vÇD”tcF„Öv#%–vDv†Ä”tçf&äã6Ôg&åU„sFt”4Ã‡T”4'vEt§6tÖv3%c”tg%TcF„Öõ•vÇE†‡7¦öt£'f3&Ã…¦Åt66vd4åFÕfå•…'FÕe”§”#„”6E#4çDvÃ%¥f¶ä”‡vt£VÅ£$c…¦Åu66vd4åTs—¦…'FÕf§”#„”6Dõ¥vF†DvÃ%¥föäµ4#u„sFt”4vDv‡7“Ve•vÇE†‡7”””tg%TcF„Óu„sFt”4vDv‡7“VfF¤ä&s&TvÇ¤ÆäæÆD6†6&”t”4t”tg%TcF„ÖuC””6E#4çDvÃ%¥fvä”C†tÕ3Gt”Föu•vÇE†‡7”•Ct£VÅ£$c…¦Åt66u”DÕ3Gt”FötÔ3GtÄg‡T”4t”4u•vÇE†‡7”•Ct£'f3&Ã…¦Åu66u”„Æ¤tö”&†s&TvÇ¤”C•4åFÕfå•…'FÕe¤§”ô”3„Æ¤tö”tÆ¤5„sFt”4t”4&†s&TvÇ¤”C•4åTs—¦…'FÕf§”ô”DWTÔ4d”tg%TcF„ÖuC””6Dõ¥vF†DvÃ%¥föä”C†tÅDWTÔ4d”DTÔ7†6&”t”4ó‡T”4#•„sV6&”tÇ–÷„sFt”4”e&õ¥4&†su•†‡7”'e¦”#uVu“#—V35'••vÇVD3V6&”t”6÷e„sFt”„'–…¦†DuVuƒ$g%TcF„Ód”6E#4çDvÃ%¥fvä”‡vt£VÅ£$c…¦Åt66vd4åTs—¦…'FÕe¤§”#„”6Dõ¥vF†DvÃ%¥f¶ä”‡vt£'f3&Ã…¦Åv–6vd4åFÕfå•…'FÕf§§F6&Ç‡T”4d¶—6&”t”6öudv†Ä”‡D$vÇV”&e•vÇE†‡33u–åc”vÇT”tgT”tf¦D…f†$4%u¥tã#4—¤”u§f6ÓU„sFt”4Ã‡T”4'v6ÖÃ%•…&Ä”c“$Óg%TcF„Ód”e$•VµddÆÅ¦Å“5'f6¤Óu„sV6&”tÇ–÷„sFt”4”e&õ¥4'•¥„ã”„c•…&Æ6ÓW##Fv#%–vDv†Ä”‡D$vÇV”&µ¥„ãsV†DvÇf&ãU„sFt”4Ã‡T”4'v6ÖÃ%•…&Ä”c–¶35%5¥„ãU…f†DFöudV…5%UWUU…f†Dug–&ÖÇf&§F6&Ç‡T”4'vEt§6tÖu£%c”u&Æ4ugU¤ugU“&ÆÆ7–wö”%E¥……dV…5%UWUC$§¥tãÓ´”‡F6&”t”4&¦##W¦D4'¥¥…u4'U¥†6uS%ce$•VµddÆ³––Õf¦DDäU–†&Dv‡7“W¦#5g•“%fDµGF6&Ç‡T”4t”vÆÔ”6ƒvÇ¤ÆÕ&Æ35'&Ôcs—TÆä&†6ÕgVD6¶vS‡T”4t”4v3%cÆÔfµ¤6ƒvÇ¤ÆÕ&Æ35'&Ôcs—TÆä&†6ÕgVD6³u„sFt”4veg‡U„sFt”4v6ÕcE„§T”„æÆDGF6&”veg‡U„sFt”„#–×‡—”&¦##W¦D„£“5'f6–†µ¥„ãsV†DvÇf&¦öudV…5%UWUC$§¥tãÓ4”„çfE„¦¥¥FöudV…5%UWUC$§¥tãÓ”‡F6&”t”4'¦E„&Æ6–†µ¥„ãsV†DvÇf&—vv3#“6ÔæÄµGF6&Ç‡T”4t”…&ö„×Uƒ$g%TcF„Öu4åTs—¦…'FÕe”§§F6&”t”4#vÇ¤ÆÃ“$Óg%TcF„Öu4'U¥†6udV…5%UWUfÕf¦Ds—”×–w„Ä4tÄ4tµGF6&Ç‡T”4t”…&ö„×Uƒ%'¦Dd¦Æ35%&Etc”Cv&Õc4”e$•VµddÆÄc•…&Æ6ÓW##FôµGF6&”veg‡U„sFt”„#–×‡—”'¥¥…$¦&ÖÃS5&†DuVôµFövFÓ—¤4#u„sFt”4vDv‡7“Ve¤„ãVÕg¦Ddc•…U“#—vU6ƒvÇ¤ÆÕ&Æ35'&Ôcs—TÆäc•…&Æ6ÓW##Gó‡T”4#•„sV6&”v4…f–$vÆ¤”…gu¤tc¥6wö”#&#&Æ´”‡F6&”t”4dÇ”#4u&†DuVvC#—–$uv%tc6ÖÃD”s–Ô”u&Æ35'&Ôcs—T”tgU¤4'¦#5g•“%Vv%tgVEtg6$†Æ6&”t”4#vÇ¤ÆÕ&Æ35'&Ôcs—TÆågu¤tc¥fGf6×†µEtc6ÖÃD´…'–EuW4”u¦†$„æÄµGF6&”t”4#vÇ¤ÆäçfE„¦¥¥3S4u&†Due†#4§5¤S†D„§T6ƒ6åfÄÄ4&Õ•w‡¥¥6³u„sV6&”t”4dÇ”&å¥…vC#—–$uv5…f†Dug–&ÖÇf&”'e¦”#uVv4tg•¥sS”s–Ô”…&õ¥4&µ¥„ãsV†DvÇf&Ç‡T”4t”tçf&äã”u'¦Dd&†6ÕgVDfGf6×†µU…f†D4””c—†Etc3W¤ugVDvÃU6wó‡T”4t”tçf&äã”vÇVFµ'¦Dd&†6ÕgVDfGf6×†µU…f†D4””c—†Etc“W¤ugVDvÃU6wó‡T”4t”vÆÔ”6ƒvÇ¤ÆÕ&Æ35'&Ôcs—TÆä&†6ÕgVD6¶vS‡T”4t”4u¤uf¦##v#4æÅVÓ“•…'##FöDv‡7“Vµ¥„ãsV†DvÇf&“Wu•„¦Æ&åV%tc6ÖÃEc#—–$u4”u'¦Dd&†6ÕgVDfGf6×†µU…f†D6³u„sFt”4t”4'†Etc5sS%¥„£#—F4tc´vÇVFµ'¦Dd&†6ÕgVDfGf6×†µU…f†D3V¦#4#T´u'¦Dd&†6ÕgVDfGf6×†µU…f†D6·ó‡T”4t”ƒ6&Ç‡T”4t”3‡d”tæ†$tã$tc¥4&Ö6Ó—DÅ…'d”…¦Å“5'f6äÖvsFvC#—–$uu“#—f6Õ&6&”t”4&¦##W¦D4&„Ô4””c“$ÓWU“#—vU6ƒvÇ¤ÆÃ“$Óg%TcF„×ÆÔgv4wƒUU…f†Dug–&ÖÇf&–ƒvÇ¤ÆÃ–¶35%5¥„ãU…f†D6·U•„'v$†Å&Etc¥„§Vs—T´u'¦Dd&†6ÕgVDfGf6×†µU…f†D6³u„sFt”4u“#—V35u•DVu4&µ¥tçf%„'f3%e#4çDvÇf&–ƒvÇ¤ÆäçfE„¦¥¥3WE•…'–†…†#4§5¤7vuƒ5—¥–Æ6&”t”4t”3W¦Et–õ¤uf¦##v#4æÅTs—¦…'##FöDv‡7“Vµ¥„ãsV†DvÇf&“WE•…'–†…†#4§5¤7vuƒ5—¥–·„sFt”4t”4V&Ó—–%tg6‡Ä´6³u„sV6&”t”4dÇ”&¦6Õf†DuVu•4&Ö6Ó—DÅ…'d”„c•…&Æ6ÓW##G4”tçf&å¦Æ6åvDs†u¤ug¦DvÇU•…'##Fv$s–¥•wvu“#—f6Õ4”…&õ¥sFv%…g6DvÇv$†¶v6Õg¦D4'†Etc¥„§Vs—U„sFt”4u“#—V35vDtg•£%cU…f†D4””c—†Etc‡T”4t”4tÆäæÆDU§–##f&ÖÃfÕf¦Ds—–7–†„Ô7vu•DW„sFt”4t”4V4„¦Æ%…g6DvÇv$†¶ösS%$„ãTtg•¥sSc#—–$u%&Etcµg‡T”4t”4tÆÓ$…'4wƒT´u'¦Dd&†6ÕgVDfGf6×†µU…f†D6Æ6&”t”4t”3WFEwƒ„'6U6ƒvÇ¤ÆÃ–¶35%5¥„ãU…f†D6³u„sV6&”t”4dÇ”&–$ugU¤4#6…&ô”…&õ¥4'•¥„ã”„c•…&Æ6ÓW##FvE„ç&Ö6vC%g£&ƒ„sFt”4vDv‡7“Vµ¥„ãsV†DvÇf&“W†Etc¥„§Vs—TÆÔçf4†¶öDv‡7“Ve¤„ãVÕg¦Ddc•…Æäç5¥„§t´…&†6ÖFÆDdc•…4”…&ö„×VC%g£&ƒµGF6&”veg‡Veg‡T–—vt–ÖÇF4s—–D4”tg¤”e$•Vµdd”u§–##t£5&ö6ÕfÄ§§F6&Ç‡U¥†‡v#4£”u£&Ôãs—T”u&Å“#—F4s—¥¥d'f3&Ãs—Ueu¥†ƒ¥sV¶7”%U4d¤e%3Uu¥tã#4—¥–‡E•…'–†sd”e$•VµddÆ³†D„§TE4”…&†6ÖFÆDFöud6³d”evS‡T”4'•¥…#6ÓFvDtg•£%cÆäæÆD6‡E•…'–†wU¥w†Æ%ugVD„æ$ÕD¦DÄ4'E•…'–†wU¥w†Æ%ugVD„æ$ÕDæDÄ4'E•…'–†wU¥w†Æ%ugVD„æ$ÕE&DµGF6&ã6&”—4”4§%„'f6åt¶”&†7”%U4d¤e%4&Ö6Ó—D”6C„¦Å¥63u„sV6&Ôçf&äã”c“$ÓVu4'U¥†6udV…5%UWUfÕf¦Ds—”×–wó‡U“#—V35uƒ5—¥”””sVÆG”%U4d¤e%3Uu¥tã#4—¤´6³u„sV6&ÕcF4s—–D4&ÖEsV¦DvÇf&”&µ¥tçf%„'f3%e6#5&†DvÇf&§…T”ucFDugU¤„ÖudV…5%UWUU…f†Dug–&ÖÇf&£Fö%tc6ÖÃDö”%U4d¤e%3Tå•…'–†sÄ4#•„¦å¥…d”eö”%T”‡F6&”v%tc6ÖÃDÆÕ&Å“#—F4s—¥¥6†fF¤ä$Ä4#•„¦å¥…4”c“$Ó—ó‡T”4'•¥…#6ÓFvDtg•£%có‡Veg‡T–—vt–ÖÇF4s—–D4”tg¤”e$•Vµdd”u§–##t£5&ö6ÕfÄ§§F6&Ç‡TÇ–÷„sFt¶”$$”tçf%„&†D4&ÖEsV¦DvÇf&”&Ö#4–u”dc•…&Æ6ÓW##GVsS%¥„£´6Æt”3†u”dc•…&Æ6ÓW##GVsS%¥„§¥¥6w”3V6&””t%&Etc¥„§Vs—TÆÖÇVFÕg–D6w”4'7”'&å'–#%#“%f´”vÇT”„—„Ö¤Öu•sV´”t%&Etc¥„§Vs—TÆÖÇVFÕg–3%Vôµtu¥sD„Öu•4#5•„§VsVäÆÇ‡T”6öuc%Vu•„¦Ä”vGfsVä”…'d”…g¥¥4#vÇ¤”tçf%„&†D4&Ö#4–u•4#6vÇ5¥3V6&””T'u•„¦†%4#•„¦å¥…u4#•„¦å¥…v5…f†Dug–&ÖÇf&Ç‡T”6÷e„sVÆT„'f6åu¦ågU“5'##Fv5…f†DVÇVFÕg–DTçf%„&†DG…T”ucFDugU¤„ÖudV…5%UWUU…f†Dug–&ÖÇf&£FöDtg•£%cö”%TµFöud4#u„sFt”vÆÔ”6vöDtg•£%c”tg¤”tgVU6·VsS%¥„£µ4#u„sFt”4vDtg•£%cÆÖÇVFÕg–D6wó‡T”4#””ug63%VvS‡T”4t”6ƒ•„¦å¥…u•„Öu•sSTµ3W&å¦Æ6äæÄ´6³u„sFt”ƒ6&Ç‡T”4'•¥…#6ÓFvDtg•£%có‡Veg‡T–—vt–ÖÇF4s—–D4”tg¤”e$•Vµdd”u§–##t£5&ö6ÕfÄ§§F6&Ç‡TÇ–÷„sFt¶”$$”t¦†3%Vu“'††34Öv#%–ufÄ¤ä”tçf&äã6Ôg&åu“'††34æÆ7“V6&”Ã‡U¥†‡v#4£”tf–35'••tã”tç5•„ç¤”e¥5ESWe¤udF##W¦D„¦†sS”‡F6&”tÇ–÷„sFt”4”e&õ¥4'e–×Å“5u–Õg&Ö6u“#—V35'••vÇU¥uu–æ¶vDv†Ä”‡D$vÇV”'¦#5g•“%c”ÆÇ‡T”4t¶“–6&”v4…f–$vÆ¤”u&Æ35'&Ôcs—Tö”%U4d¤e%3U–×Å“5¥$GF6&Ç‡T”4d¶—6&”t”6öudv†Ä”s––Õf¦D4&¦##W¦D„¦†sW¤”…&õ¥4#uw‡&×6u¤ug¦DvÇU•…'##S”ÆÇ‡T”4t¶“–6&”v4…f–$vÆ¤”„çfE„¦¥¥FöudV…5%UWUC$§¥tãÓu„sV6&”tÇ–÷„sFt”4”e&õ¥4#5¥vÆæ…v#%–vDv†Ä”tçf&äã6Ôg&åU„sFt”4Ã‡T”4'vEt§6tÖvC%g£&ƒö”'VEs•¥„“u„sV6&”v4…f–$vÆ¤”tf–35'••tã”vFÆD4&µ¥„&Æ&Õ&Æ&Ôç¥„ÖôµFöuS%ce$•VµddÆ³––Õf¦DDäU§F6&Ç‡T”4d¶—6&”t”6öu„&†6ÔgD”u&Æ35'&Ôcs—T”e&õ¥4&µ¥„ãsV†DvÇf&”'e–×Å“5&6&”t”6öu„&†6ÔgD”„çfE„¦¥¥4%VuVv3#“6ÔæÄ”s––Õf¦Dg‡T”4t¶“–6&”v4…f–$vÆ¤”tçf&äã6åf¦Ds—”´u&Æ35'&Ôcs—Tö”%U4d¤e%3U–×Å“5¥$7vv3#“6ÔæÄö”%U4d¤e%3U–×Å“5¥$6¶vS‡T”4t”…&ö„×U¤ug¦DvÇU•…'##Fu4&µ¥„ãsV†DvÇf&§F6&”t”4#vÇ¤ÆäçfE„¦¥¥4””„çfE„¦¥¥GF6&Ç‡T”4t”…&ö„×VC%g£&ƒ”CtÕ3Gtó‡T”4#•„sV6&”tÇ–÷„sFt”4”dæÆD4'&ÖÃtg4”„ã•…&Ä”s–Ô”…&õ¥4&¦##W¦D„¦†sSÆÇ‡T”4t¶“–6&”v4…f–$vÆ¤”tf–35'••tã”„æÆDVÇV…%FDtc¥6wö”#&#&Æ´ó‡U„sFt”3‡¶Ç‡T”4t¶”%f4u&†DuVu•sV´”tgv4wƒT”…&õ¥4&¦##W¦D„¦†sSÆÇ‡T”4t¶“–6&”v4…f–$vÆ¤”tf–35'••tã”…gu¤tc¥6wö”#&#&Æ´ó‡Veg‡T–—vt–ÖÇF4s—–D4#U„&Ä”6öu•„ÖudV…5%UVu¦ä§f%4æDv‡•¥uVäó‡U„sGd¶—6&””e'••…¦Æ6äæÄ”tgU“%g¦Ds—–7”'e¦”&æ…¦Æ&”'e–×Å“5u•sV´”tæ†$wvu£&Ã%¥sFu“$g6$t¦…“'6u¦ä§f%4'–##“”„ç¤uWU„sFt¶”$¦D4#6w‡4”vÇU“'ƒ¤uVvDv†Ä”vGFÕgT”s––Õf¦D4'D„æÆ$u—U„sFt¶Ç‡T”6öu„&†6ÔgD”s––Õf¦D4%VuVv#$§¥tã”†ÇfE4#5•sS”…'d”…'••…¦Æ6äæÅ„sFt¶”$4tg••su“$g6$t¦…“'6udv†Ä”tæ†$wvu–Ôf¦”&ÖEsV¦DvÇf&”#tc”†G$wvu–ÕVu“$g6$uf´”u§f6”&Å•tæô”tgU“%g¦Ds—–3‡T”6÷e„sVÆT„'f6åu¦ågU“5'##FvD„¦†FÕg–3%d&&ÔæÆ35'f6ääv6Ó—EVÓ—fD6‡e–×Å“5d”e$•VµddÆ³––Õf¦DDäTÄ4&¥•w‡5–Ôf¦¦öt´s––Õf¦DFöudV…5%UWUC$§¥tãÓ”C´”…§fuö”#&#&Æ´”‡F6&”u“#—V35u•sV¥¥„ã#4§¤ö”%U4d¤e%3U–×Å“5¥$gFD”Cus#––Õf¦Dcu„sV6&”v$uc”v†Å•ud”e$•VµddÆ³––Õf¦DDäT”‡vv&åg6$4””s––Õf¦D3Wu•„¦Æ&åu„sFt”†Föw†Ä”6†õ¥tf´”4S•4'VEw‡4µ4#u„sFt”4u•sV¥¥„ã#4§¤ÆågV3&‡¦åöuf…¤6³u„sFt”4vuf…¤4””v†Å•uV4tg•¥sSó‡T”4#•„sV6&”u•sV¥¥„ã#4§¤ÆÕ§f6µf…“&vô´tgU“%g¦Ds—”µ4•”#u„sFt”4u“$g6$t¦…“'6õ•sV¥¥„ã#4—ó‡T”4#”µGF6&ã6&”—4”4§%„'f6åvD†Çu¥4”tg¤”e$•Vµdd”u§–##t£5&ö6ÕfÄ§§F6&ÖÇF4s—–D4#U„&Ä”‡6ufÄ¤åFÓ–µ¥Tçf&äã6Ôg&åve4&Ö6Ó—D”67TÃ¥5ESWe¤udF##W¦D„¦†sS§§F6&ÖÇF4s—–D4#t”…'••…¦Æ6äæÅsV¥¥„ã#4§¥&ä§f%d§f#5ve4&Ö6Ó—D”67TÃ5cw‡¤Ã5'••…¦Æ6äæÅsV¥¥„ã#4§¥&ä§f%d§f#5äó‡U„sVÆT„'f6åu“'††34ÖufÄ¤åFÓ–µ¥Tçf&äã6Ôg&å$å•sV…£%g””‡F6&”v4„§FÔc¥4&e“#—V35'••vÇVD„Öu4'U¥†6uS%ce¥5ESWe¤udF##W¦D„¦†sS–wó‡T”4'vEt§6tÖu£%c”tçf&äã6Ôg&å'¤´6³d”dæÆDG…uV³ö#%&Å#—V35'••vÇVDCFvS‡T”4t”„¦ÆD…g–&”#vÇ¤ÆÃ–¦##W¦D„¦†sS7§F6&”veg‡U„sFt”„'–…¦†DuVuƒ#––Õf¦DTçf&äã6Ôg&å'¥Etgt”Cv&Õc4”S†4G…U4d¤e%3U–×Å“5¥$7vuS%ce¥5ESWe¤udF##W¦D„¦†sS£FôµGF6&Ç‡T”4'vEt§6tÖu•u&µ#—V35'••vÇVD6†¦##W¦D„¦†sSö”%uV³ö#%&Å#—V35'••vÇVD6³d”…§fuvS‡T”4t”…&ö„×Uƒ$çf&äã6Ôg&å'¤ÆÔfµ¤6†¦##W¦D„¦†sSµGF6&Ç‡T”4t”w†ÆD4'e–×Å“5%E¥…u4#vÇ¤ÆÃ—e–×Å“5$F##W¦D„¦†sS3†43Vå¥…õ“#—V35'••vÇVD3Vµ¥„ãsV†DvÇf&–³u„sFt”4vu–t´s––Õf¦DdæÆD4•4'VEw‡4µ4#u„sFt”4t”4'e–×Å“5%E¥…u4'U¥†6uS%ce¥5ESWe¤udF##W¦D„¦†sS–wó‡T”4t”4vDv‡7“Vf#$§¥tã#—V35'••vÇVD„äå•„V3%c´tçf&äã6Ôg&åU¤ug¦DvÇU•…'##G4”s––Õf¦DdæÆD6³u„sFt”4veg‡T”4t”s––Õf¦DdæÆD3V…¤uõ“#—V35'••vÇVD6³u„sFt”ƒ6&Ç‡T”4'vEt§6tÖu¤ug5¥…&Å#—V35'••vÇVD6†¦##W¦D„¦†sSö”%uV³ö#%&Å#—V35'••vÇVD6³d”…§fuvS‡T”4t”…&ö„×Uƒ$çf&äã6Ôg&å'¤ÆÕ&Æ$uc¥6†¦##W¦D„¦†sSµGF6&Ç‡T”4t”tçf&äã”s––Õf¦DdæÆD4””…&ö„×Uƒ#––Õf¦DTçf&äã6Ôg&å'¥EtgtÆÖFÆD6†¦##W¦D„¦†sSÆÕ&Æ35'&Ôcs—Tµ4Su„sFt”4v#$§¥tãS%cÆÕ&Æ$uc¥6†¦##W¦D„¦†sSµGF6&”veg‡U„sFt”„#–×‡—”'¥¥…$¦&ÖÃS5&†DuVôµFövFÓ—¤4#u„sFt”4u“#—V35u“#—V35'••vÇVD„åV6ÖÆÅ¤4””sVÆG”%E¥……fÄ¤åFÓ–µ¥Tçf&äã6Ôg&å´´6³u„sFt”4u“#—V35u“#—V35'••vÇVD„äV##VÄ”Cv&Õc4”dæÆDG…uV³ö#%&Å#—V35'••vÇVDCFôµGF6&Ç‡T”4t”u§f6”õ“#—V35u“#—V35'••vÇVD4'e¦”#vÇ¤ÆÃ–¦##W¦D„¦†sS7–¶vS‡T”4t”4vDv‡7“Vf4„§e“%g¦3çf&äã6Ôg&åõ“#—V35'••vÇVD7vu“#—V35'••vÇVD„åV6ÖÆÅ¤7vu“#—V35'••vÇVD„äV##VÄÄ4õ“#—V35'••vÇVD6¶uCFu“#—V35'••vÇVD3W¥¥…$¦&ÖÃS5&†DuVôµ6³u„sFt”4veg‡T”4#•„sV6&”v4…f–$vÆ¤”…gu¤tc¥6wö”#&#&Æ´”‡F6&”t”4&¦##W¦D4&¦##W¦D„¦†sS3'–uf´”Cv&Õc4”dæÆDG…uV³ö#%&Å#—V35'••vÇVDCFôµGF6&”t”4&¦##W¦D4&¦##W¦D„¦†sS3'f&ÕVu4'U¥†6uS%ce¥5ESWe¤udF##W¦D„¦†sS–wó‡U„sFt”4u¦Ó—””6†¦##W¦D4&¦##W¦D„¦†sS”s–Ô”…&ö„×Uƒ$çf&äã6Ôg&å'¤µ4#u„sFt”4t”4#vÇ¤ÆÃ—v6Ó–¥¥„ç¥#—V35'••vÇVD6†¦##W¦D„¦†sSÄ4&¦##W¦D„¦†sS3'–uf´Ä4&¦##W¦D„¦†sS3'f&ÕW4”6†¦##W¦D„¦†sSµ4•”&¦##W¦D„¦†sSÆågu¤tc¥6wµGF6&”t”4#•„sFt”ƒ6&Ç‡T”4d¶—6&”t”6öue„&µ•…&Ä”tVu“#—V35'••vÇVD3V6&”t”6öu5u–vDv†Æ6ÕVu•„¦Ä”s“ug””tçf&äã6Ôg&å'¤”…&õ•…u•„¦Ä”u&Æ4ugU¤tgVD7vv…vC&Ç6$4#6æ¶vDs†vE„&µ•…&Ä”…&õ¥sv6Õf¦E„§¦…¦Æ$†·U„sFt”4”VÃ”s£&ƒ”…&ö6Ó“4”tgT”ug–6Ó—””vÆÔ”…&õ¥„¦Ä”tg•¥4&¦„¦¦Ew††6”&µ¥„&Æ&Õ&Æ&Ôç¥„×U„sFt”4„sFt”4”VÇVDugU¤uf´”…'d”t¦Ä”…g¥¥uvsFvS'6sW$”…gu¤tc¥ƒu•sV´”‡D$vÇV”&f4„§e“%g¦3çf&äã6Ôg&å#””vÃ3%g5¦”'•¥tã6äçFÕg6U3V6&”t”76&”t”6öu„&†6ÔgD”tçf&äã6Ôg&åu4&¦##W¦D„¦†sS”†ÇfE4#5•sS”…'d”…gu¤tc¥g‡T”4t¶”$4tg••su“#—V35'••vÇVD„åV6ÖÆÅ¤4%E¥…v#%–u“#—V35'••vÇVD„ÖvDv††D4&†6ÕVu•w‡•¥tf¶U4#6ÖÆÅ¤4#'”&•¥4#4u&†Dufµ„sFt”4”T'u•„¦†%4&¦##W¦D„¦†sS3'f&ÕVuS%c”s–Ô”tçf&äã6Ôg&å'¤”…&õ•…u•„¦Ä”tg66Õf…¤†¶vE„vDs†u¤tc¥g‡T”4t¶“–6&”v4„§FÔc¥4&f4„§e“%g¦3çf&äã6Ôg&åõ„sFt”4u“#—V35'••vÇVDFöufÄ¤åFÓ–µ¥Tçf&äã6Ôg&å5„sFt”4u“#—V35'••vÇVD„åV6ÖÆÅ¤FöuS%ce¥5ESWe¤udF##W¦D„¦†sS—†6&”t”4&¦##W¦D„¦†sS3'f&ÕSd”dæÆDG…uV³ö#%&Å#—V35'••vÇVDCG5„sFt”4u“$g6$t¦…“'3d”6†¦##W¦D„¦†sSö”%uV³ö#%&Å#—V35'••vÇVD6¶uCFvFÓ—¤7†6&”tµFövFÓ—¤4#u„sFt”4vu–t´tçf&äã6Ôg&å'¥$s—U¥3Võ•„Öõ“#—V35'••vÇVD6·”‡F6&”t”4t”„¦ÆD…g–&§F6&”t”4#•„sV6&”t”4'¦”õ“#—V35'••vÇVD„åV6ÖÆÅ¤3Võ•„Öõ“#—V35'••vÇVD6·”‡F6&”t”4t”…&ö6Ó“4”sVÆG”$f6ä§f6–våfÄ¤åFÓ–µ¥Tçf&äã6Ôg&å$å•sV…£%g”ö”$F„¦¦Ew††6”&µ¥„&Æ&Õ&Æ&ÔãT”u&ÆDuf¦Duf´”†Föw†Ä”…gu¤tcsVä”tçf&äã6Ôg&å'¤§–³u„sFt”4veg‡T”4t”tçf&äã6Ôg&å'¥d„§¥uU•u&´´tçf&äã6Ôg&åó‡U„sFt”4u“#—V35u¤uguC$§¥tã7”””tçf&äã6Ôg&åU¤ugu¥sVµ¥sV¦ug¤ó‡T”4t”u§f6”õ“#—V35u¤uguC$§¥tã”s–Ô”u&Æ4S––Õf¦D„×”‡F6&”t”4t”…'••…¦Æ6äæÅsV¥¥„ã#4§¥&ä§f%d§f#5õ¤uguC$§¥tãÄ4õ¤uguC$§¥tãsV¥¥„ã#4—”C´”‡F6&”t”4t”4u“#—V35v#$§¥tãS%c”CvDv‡7“Vf#$§¥tã#—V35'••vÇVD„äå•„U£%c´u&Æ4S––Õf¦DTgU“%g¦Ds—”µGF6&”t”4t”4vu–t´s––Õf¦DdæÆD6¶vS‡T”4t”4t”4t”u§f6”õ“#—V35u¤ugu#—V35'••vÇVD4'e¦”'e–×Å“5%E¥…”‡F6&”t”4t”4t”4t”…&ö„×Uƒ4'–#$æÆ34äF##W¦D„¦†sS´u&Æ4Tçf&äã6Ôg&å4”tçf&äã6Ôg&å'¥d„§¥u4”tçf&äã6Ôg&å'¥$s—U¥7vu“$g6$t¦…“'7ó‡T”4t”4t”4t”ƒ6&”t”4t”4veg‡T”4t”4ve6³u„sFt”4veg‡U„sFt”4u“$g6$t¦…“'6õ“#—V35'••vÇVD6³u„sV6&”t”4&¦##W¦D„¦†sS3'f&ÕWU•u&´´tçf&äã6Ôg&åó‡T”4#•„sS•„sF”Ä4–sv#4£”6öu•„ÖudV…5%UVu¦ä§f%4æDv‡•¥uVäó‡Vsv#4£”‡6v5…f†DVÇVFÕg–DTçf%„&†D4#””u§–##t§“GfE…'$„×f5…f†DVÇVFÕg–DTçf%„&†D63u„sW%„'f6åvW”%uV³ö#%&Å#—V35'••vÇVD4#””u§–##t§“GefÄ¤åFÓ–µ¥Tçf&äã6Ôg&åäó‡U„sV¦##W¦D4&f5…f†DTVu4'U¥†6udV…5%UWUU…f†Dug–&ÖÇf&–wó‡U“#—V35uƒ4c•…$4”Cv&Õc4”e$•VµddÆÄc•…&Æ6ÓW##FôµGF6&Ç‡TÇ–÷„sFt¶”$$”tçf&äã6Ôg&åvDv††D4#6ÔgV3%¦Æ6äÖu•4'–#5&†DvÇf&”&†6Ó“&Õv##VÄ”tcF„Öv#%–u•4'¦#5g•“%WU„sFt¶Ç‡T”6öuS%fÄö”&öD…'v7¦÷dÃ&GDvƒ–“V¦##fFä§DÅt×fFä§DÅ„çu¥tç¦ÖÆ¥•…'##GfD„¦Å¥3—E•„ã¥„—f34&Å“&ÆÖtæ†DvÇf&“•uV³Eƒ#We¤ufe“#—V35'••vÇVD3„Æ¤&e–Õc•4ç–#'‡4Åtçf&äã6Ôg&å&6&”Ã‡U¥†‡v#4£”tç5•„ç¤”e¥5Ed§fDtcs—U#—V35'••vÇVD4&ÆT…&Æ&Õ'¤”e¥5ESWe¤udF##W¦D„¦†sS”‡F6&”tÇ–÷„sFt”4”e&õ¥4'•¥„ã”„c•…&Æ6ÓW##Fv#%–vDv†Ä”‡D$vÇV”&µ¥„ãsV†DvÇf&ãU„sFt”4Ã‡T”4'v6ÖÃ%•…&Ä”c–¶35%5¥„ãU…f†DFöudV…5%UWUU…f†Dug–&ÖÇf&§F6&Ç‡T”4d¶—6&”t”6öudv†Ä”vÇVFÕg–3%Vv#%–vDv†Ä”„¦Æ35v5…f†Dug–&ÖÇf&”'e¦”#uVvS'6sW$”„çfE„¦¥¥ƒU„sFt”4Ã‡T”4'v6ÖÃ%•…&Ä”c—&å¥F6Ôå5¥„ãU…f†DFöudV…5%UWUU…f†Dug–&ÖÇf&§F6&Ç‡T”4'vEt§6tÖu£%c”u&Æ4ugU¤ugU“&ÆÆ7–wö”%E¥……dV…5%UWUC$§¥tãÓ´”‡F6&”t”4'•¥…#6ÓFv&Õc4”dæÆD6†&Dv‡7“W¦#5g•“%fDµGF6&”veg‡U„sFt”„#–×‡—”&¦##W¦D„£“5'f6–†µ¥„ãsV†DvÇf&¦öudV…5%UWUC$§¥tãÓ4”„çfE„¦¥¥FöudV…5%UWUC$§¥tãÓ”‡F6&”t”4'¦E„&Æ6–†µ¥„ãsV†DvÇf&—vv3#“6ÔæÄµGF6&Ç‡T”4t”…&ö„×Uƒ%'¦Dd¦Æ35%&Etc”Cv&Õc4”e$•VµddÆÄc•…&Æ6ÓW##FôµGF6&”t”4#vÇ¤ÆÃ—&å¥F6Ôå5¥„ãU…f†D4””sVÆG”%U4d¤e%3U&Etc¥„§Vs—T´6³u„sFt”ƒ6&Ç‡T”4'vEt§6tÖv3%c5sWDdã•…&Ä´6³d”…§fuvS‡T”4t”…&ö„×Uƒ%'¦Dd¦Æ35%&EtcÆÔçf4†¶öDv‡7“Vµ¥„ãsV†DvÇf&“W†Etc¥„§Vs—TµGF6&”t”4'†Etc5sS%¥„£#—F4tc´…&ö„×Uƒ&ÇVFÄç•“¦Æ35%&EtcÆÔçf4†¶öDv‡7“W¦#5g•“%WV5…f†Dug–&ÖÇf&–·ó‡T”4#•„sV6&”v4…f–$vÆ¤”…gu¤tc¥6wö”#&#&Æ´”‡F6&”t”4dÇ”&¥•w†¦Ew††DuVvDv†Ä”u&Æ$…&„”„§fDtcs—T”u§–##vDv†Ä”„¦Æ35u•t§fE…vDv†Ä”„çfE„¦¥¥g‡T”4t”tçf&äã”„ç•“&Æ$…&…U…f†D4””c—†Etc3V¦#4#T´…&ö„×Uƒ&ÇVFÄç•“¦Æ35%&Etcµ3WFEwƒ„'6U6ƒvÇ¤ÆäçfE„¦¥¥3W†Etc¥„§Vs—TµGF6&Ç‡T”4t”3‡d”s$…'4wƒT”…&õ¥4&µ¥wƒ•4#'”#uVv6Õg¦D4'e¦”#uVu¤ug¦DvÇU•…'##V6&”t”4&¦##W¦D4#•„¦å¥…%&Etc”Cuƒ4c•…$4ÆÔçf4†¶öDv‡7“Ve¤„ãVÕg¦Ddc•…ÆÓ$…'4wƒT´„ç•“&Æ$…&…U…f†D6³u„sV6&”t”4dÇ”&–$ugU¤4#6…&ô”…&õ¥4'•¥„ã”„c•…&Æ6ÓW##FvE„ç&Ö6vC%g£&ƒ„sFt”4vDv‡7“Vµ¥„ãsV†DvÇf&“W†Etc¥„§Vs—TÆÔçf4†¶öDv‡7“Ve¤„ãVÕg¦Ddc•…Æäç5¥„§t´…&†6ÖFÆDdc•…4”…&ö„×VC%g£&ƒµGF6&”veg‡Veg‡T–—vt–ÖÇF4s—–D4”tg¤”e$•Vµdd”u§–##t£5&ö6ÕfÄ§§F6&ÖÇF4s—–D4#t”„c•…$¦&å¦Æ6å$F##u•…ve4&Ö6Ó—D”67TÃ5cw‡¤Ã4c•…$¦&å¦Æ6å$F##u•…äó‡Vsv#4£”‡6ufÄ¤åFÓ–µ¥Tçf&äã6Ôg&åve4&Ö6Ó—D”67TÃ¥5ESWe¤udF##W¦D„¦†sS§§F6&Ç‡U“#—V35uƒ5—¥4””sVÆG”%U4d¤e%3Uu¥tã#4—¤´6³u„sV¦##W¦D4&f5…f†DTVu4'U¥†6udV…5%UWUU…f†Dug–&ÖÇf&–wó‡U“#—V35uƒ4c•…$4”Cv&Õc4”e$•VµddÆÄc•…&Æ6ÓW##FôµGF6&Ç‡TÇ–÷„sFt¶”$$”tçf&äã6Ôg&åvDv††D4#6ÔgV3%¦Æ6äÖu•4'–#5&†DvÇf&”&†6Ó“&Õv##VÄ”tcF„Öv#%–u•4'¦#5g•“%WU„sFt¶Ç‡T”6öuS%fÄö”&öD…'v7¦÷dÃ&GDvƒ–“V¦##fFä§DÅt×fFä§DÅ„çu¥tç¦ÖÆ¥•…'##GfD„¦Å¥3—E•„ã¥„—f34&Å“&ÆÖtæ†DvÇf&“•uV³Eƒ#We¤ufe“#—V35'••vÇVD3„Æ¤&e–Õc•4ç–#'‡4Åtçf&äã6Ôg&å&6&”Ã‡U¥†‡v#4£”tç5•„ç¤”e¥5Ed§f$w„F##W¦D„¦†sS”ucFDugU¤„ÖufÄ¤åFÓ–µ¥Tçf&äã6Ôg&åvS‡T”4d¶—6&”t”6öudv†Ä”„§f$wvu•†‡7”'e¦”#uVu“#—V35'••vÇVD3V6&”t”6÷e„sFt”„#–×‡—”&å¥…v6Ó—6$TcF„ÖôµFöt£vä”‡vt£¶ä”‡vt£öä”‡F6&”t”4'•¥…#6ÓFvDv‡7“Vf6Ó—6$TcF„Óu„sFt”ƒ6&Ç‡T”4d¶—6&”t”6öudv†Ä”„§f$wvu•†‡7”'e¦”#uVu“#—V35'••vÇVD3V6&”t”6÷e„sFt”„#–×‡—”'¥¥…v6Ó—6$TcF„Öö6Ó—6$TcF„Ód”6E”§”#„”6E¤§”#„”6F§–¶vS‡T”4t”…&ö„×Uƒ4§f$w„&TvÇ¤”Cv6Ó—6$TcF„Óu„sFt”4vDv‡7“VfF¤å6#'‡5†‡7“W¥¥…ö6Ó—6$TcF„ÖuC””6E”§”ô”DWTÔ4d”DTÔ7vv6Ó—6$TcF„ÖuC””6E¤§”ô”DWTÔ4d”DTÔ7vv6Ó—6$TcF„ÖuC””6F§”ô”DWTÔ4d”DTÔ6³u„sFt”ƒ6&Ç‡T”4d¶—6&”t”6öudv†Ä”„§f$wvu•†‡7”'e¦”#uVu“#—V35'••vÇVD3V6&”t”6÷e„sFt”„'–…¦†DuVuƒ4§f$w„&TvÇ¤ö”åt66vd4åu66vd4åv–3u„sV6&”tÇ–÷„sFt”4”e&õ¥4#uw‡&×6uƒ4§f$w„&TvÇ¦e4&–E…vsFu•sFu•tãEtg4”e¦Å“5'f6¤Öu¦Ó—–%3V6&”t”6÷e„sFt”„'–…¦†DuVuƒ5—¥VÓ—6$TcF„Ód”e$•VµddÆÅ¦Å“5'f6¤Óu„sV6&”tÇ–÷„sFt”4”e&õ¥4'•¥„ã”„c•…&Æ6ÓW##Fv#%–vDv†Ä”‡D$vÇV”&µ¥„ãsV†DvÇf&ãU„sFt”4Ã‡T”4'v6ÖÃ%•…&Ä”c–¶35%5¥„ãU…f†DFöudV…5%UWUU…f†Dug–&ÖÇf&§F6&Ç‡T”4d¶—6&”t”6öudv†Ä”vÇVFÕg–3%Vv#%–vDv†Ä”„¦Æ35v5…f†Dug–&ÖÇf&”'e¦”#uVvS'6sW$”u&Æ35'&Ôcs—Ve3V6&”t”6÷e„sFt”„'–…¦†DuVuƒ&ÇVFµ'¦Dd¦Æ35%&Etcö”%U4d¤e%3U&Etc¥„§Vs—Tó‡U„sFt”3‡¶Ç‡T”4t¶”&v34¦¥VÕg¦Ddc•…VsS%¥„£´6¶t¶”&¶35%5¥„ãU…f†DtU„sFt”4Ã‡T”4'v6ÖÃ%•…&Ä”c—&å¥F6Ôå5¥„ãU…f†DS$U'¦Dd¦Æ35%&Etcö”%U4d¤e%3U&Etc¥„§Vs—Tó‡U„sFt”„#–×‡—”&å¥…u¤ugu¥sVµ¥sV¦ug¤´6³d”dæÆDG…U4d¤e%3U–×Å“5¥$CFvS‡T”4t”„¦ÆD…g–&”'U¥†6uS%c´gCvÇ¤ÆäçfE„¦¥¥có‡T”4#•„sV6&”v4…f–$vÆ¤”tçf&äã6åf¦Ds—”´u&Æ35'&Ôcs—Tö”%U4d¤e%3U–×Å“5¥$7vv3#“6ÔæÄö”%U4d¤e%3U–×Å“5¥$6¶vS‡T”4t”„ã4ug”´u&Æ35'&Ôcs—TÄ4'¦#5g•“%Wó‡U„sFt”4vDv‡7“Vf6Ó—6$TcF„Öu4åt63u„sFt”4vDv‡7“VfF¤å6#'‡5†‡7”””sVÆG”%U4d¤e%3Uu¥tã#4—¤´DW4”D4”Dó‡U„sFt”4vDv‡7“Ve¤„ãVÕg¦Ddc•…u4'U¥†6udV…5%UWUU…f†Dug–&ÖÇf&–wó‡T”4t”…&ö„×Uƒ&ÇVFµ'¦Dd¦Æ35%&Etc”Cv&Õc4”e$•VµddÆÄc•…&Æ6ÓW##FôµGF6&”t”4#vÇ¤ÆÃ—&å¥F6Ôå5¥„ãU…f†DS$U'¦Dd¦Æ35%&Etc”Cv&Õc4”e$•VµddÆÄc•…&Æ6ÓW##FôµGF6&”veg‡U„sFt”„#–×‡—”'¥¥…$¦&ÖÃS5&†DuVôµFövFÓ—¤4#u„sFt”4vDv‡7“Ve¤„ãVÕg¦Ddc•…U“#—vU6ƒvÇ¤ÆÕ&Æ35'&Ôcs—TÆäc•…&Æ6ÓW##Gó‡T”4t”„c•…$¦&å¦Æ6å$F##u•…öDv‡7“VfsS%$„ãVÕg¦Ddc•…U“#—vU6ƒvÇ¤ÆÃ–¶35%5¥„ãU…f†D6·ó‡T”4t”„c•…$¦&å¦Æ6å$F##u•…öDv‡7“VfsS%S4¦¥VÕg¦Ddc•…$æEw„V35%5¥„ãU…f†D3V¦#4#T´…&ö„×V3#“6ÔæÄÆäc•…&Æ6ÓW##Gµ3WFEwƒ„'6U6ƒvÇ¤ÆÃ–¶35%5¥„ãU…f†D6³u„sFt”ƒ6&Ç‡T”4'vEt§6tÖvE„&µ•…&Ä´6³d”…§fuvS‡T”4t”3‡d”tæ†$tã$tc¥4#uVu¤ug6DtVv6Ó“•…'##Fu¦ä§f%4#uVv6Õg¦D4&…–Ó“D4#uVv3#“6ÔæÄÄ4#ugT”tçf&å¦Æ6åvDs†vDv†Ä”u&Æ35'&Ôcs—T”w‡e“$g4”tçf#4¦µ„sFt”4tÇ–÷„sFt”4t”6öuc&††D4#uVv5…f†DU&Æ$…&„”vÇ¤”vÇVDugU¤uf´”…'d”t¦ÄöÇ‡T”4t”4„sFt”4t”6öu”t&vD„æ6&”t”4t¶”&¦##W¦D4'†EtcS4¦¥$ug6DtVu4&f5…f†DTf6&”t”4t¶”t”3V¦#4#T´4#vÇ¤ÆÃ—&å¥F6Ôå5¥„ãU…f†D4„sFt”4t”6öt”4V%…g6DvÇv$†¶ô”…&ö„×V3#“6ÔæÄÆäc•…&Æ6ÓW##FtµGF6&”t”4t¶”&¦##W¦D4'†EtcS4¦¥$ug6Dtd¦&Ä&†6ÕgVD4””c—†EtcÇ‡T”4t”4”4tÆÔçf4†¶ô”…&ö„×Uƒ4ç•“¦Æ35%&Etc”6Æ6&”t”4t¶”t”3WFEwƒ„'6U6vv5…f†Ddç•“&Æ$…&„”6Æ6&”t”4t¶”t”3WFEwƒ„'6U6vvDv‡7“VfsS%S4¦¥VÕg¦Ddc•…tµGF6&”t”4t¶”&¦##W¦D4'†EtcS4¦¥$ug6Dtd¦&µ'¦D4””c—†Etcg‡T”4t”4”4tÆÔçf4†¶ô”…&ö„×Uƒ&ÇVFµ'¦Dd¦Æ35%&Etc”6Æ6&”t”4t¶”t”3WFEwƒ„'6U6vv5…f†Ddç•“&Æ$…&…5sU•„¦Æ&åtµg‡T”4t”4”4tÆÓ$…'4wƒT´4#vÇ¤ÆÃ–¶35%5¥„ãU…f†D4ó‡T”4t”4”t&u”g‡T”4t”4Ã‡T”4t”tçf&äã”„c•…$U¥wƒ•4””c—†Etcg‡T”4t”4tÆÔçf4†¶öDv‡7“VfsS%$„ãVÕg¦Ddc•…„sFt”4t”4V%…g6DvÇv$†¶öDv‡7“W¦#5g•“%WV5…f†Dug–&ÖÇf&–Æ6&”t”4t”3WFEwƒ„'6U6ƒvÇ¤ÆÃ—&å¥F6Ôå5¥„ãU…f†DS$U'¦Dd¦Æ35%&EtcµGF6&Ç‡T”4t”3‡d”tç•¥tc¥4&„”u§–##FDs†v5…f†Dug–&ÖÇf&Ç‡T”4t”tçf&äã”sG„”Cuƒ5—¥3V¦#4#T´…&ö„×Uƒ5—¥VÓ—6$TcF„×ÆÔgv4wƒUU…f†Dug–&ÖÇf&–‡†Etc$ug6DtWó‡U„sFt”4tÇ–÷„sFt”4t”6öuc&††D4#uVv5…f†DU§–##V'”'7”'&å&Æ&Õ&Å¤4#'”&•¥G6&”t”4t¶Ç‡T”4t”4”t&u”…'¥„sFt”4t”6öu“#—V35v5…f†DU§–##V'”””c—†Etc“W¥¥…$v6Ó—EesWDe¦Å“5'f6äÖô”…&ö„×Uƒ5—¥VÓ—6$TcF„×4”sG„”6·VsS%¥„§¥¥6wó‡T”4t”4”t&u”g‡T”4t”4Ã‡T”4t”tçf&äã”„c•…$v6Ó—Eds†u4&f5…f†DT—V3%c&ä§f%egV…%u¥tã#4§¤´sG„Ä4#vÇ¤ÆÃ“$Ó§f$w„&TvÇ¤µGF6&Ç‡T”4t”3‡d”„c•…$v6Ó—Eds†t¶”'†Etc$ug6DtVuCv6Ó—6$4&ÆT…'••tã¥uu¦ä§f%4'†Etc$ug6Dtf6&”t”4&¦##W¦D4#•„¦å¥…%&Etc”Cv5…f†DU§–##V'“Wv6ÕgFEwƒ„'6U6ƒvÇ¤ÆÃ–¶35%5¥„ãU…f†D6·V%…g6DvÇv$†¶ö5…f†DU&Æ$…&„µGF6&Ç‡T”4t”3‡d”t§5¥sV´”†GDvvvDv†Ä”„¦Æ35v5…f†Dug–&ÖÇf&”#3&ÇU§”#5¥vÆæ…&6&”t”4#vÇ¤ÆÕ&Æ35'&Ôcs—TÆäc•…&Æ6ÓW##GU“#—vU6ƒvÇ¤ÆÃ–¶35%5¥„ãU…f†D6·V3'†Æ6äöDtg•£%cU…f†D7vvDv‡7“S5¥vÆæ…ó‡T”4#•„sS•„sF”Ä4–sv#4£”…#V4uVt¶”&†7”$F##W¦D„¦†sSS$æõ¥s„”u§–##t£'v†‡F““U„&Æ7“&6Ó¤ÅsWe¤uWE“#—V35'••vÇVD3„Æ¤äó‡Vsv#4£”…#V4uVt¶”&†7”%U4d¤e%4&Ö6Ó—D”6C„¦Å¥63u„sW%„'f6åvD†Çu¥4#t”VDÕdU—4”VDÕdU¤Ö#$fµ¥„¥$…fæsG4”VDÕdU¥•„§¥¥„–ve4&Ö6Ó—D”6C„¦Å¥3–ÆTtgF4w†Æ7“—3#f$s–…¤ug–7“”…De$uDs–…¤ug”Æ×¤§§F6&ÖÇF4s—–D4#t”e¥5ESWe¤udF##W¦D„¦†sS4ug64ug””ƒu¦ä§f%4äÆ“–õ¥w‡u¥„§¤§§F6&ÖÇF4s—–D4#U„&Ä”‡6ufÄ¤åFÓ–µ¥Tçf&äã6Ôg&å$Ö#$fµ¥„¥$…fæsU4…'##W¤”ƒu¦ä§f%4äÆ“•uV³ö#%&Å#—V35'••vÇVDW‡e•u&Æ6Ä'6EvG&³—vDvÇf&äÖäó‡Vsv#4£”‡6ufÄ¤åFÓ–µ¥Tçf&äã6Ôg&å$å•sV…£%g””ƒu¦ä§f%4äÆ“•uV³ö#%&Å#—V35'••vÇVDS†&Ôfå¥„–äó‡Vsv#4£”‡6ufÄ¤åVÓ“•…'##TF##W¦D„¦†sS”ƒu¦ä§f%4äÆ“•uV³6#5&†DvÇf&´çf&äã6Ôg&åäó‡Vsv#4£”‡6u#…U&”&†7”$…De$uS$æõ¥s„”ƒu¦ä§f%4åvG6Du—FD„¦†&äæÖ#4§DÃ$çf6ÕVäó‡Vsv#4£”‡6ufÄ¤åvÇE#—V35'••vÇVD4#””u§–##t§“GefÄ¤åvÇE#—V35'••vÇVD63u„sW%„'f6åvW”%uV³6#'‡5#—V35'••vÇVD4#””u§–##t§“GefÄ¤åVÓ—6$Tçf&äã6Ôg&åäó‡U„sGd¶—6&””d'f34ç–×†Ä”„çu¥tÖvFÕg–3&Çf&äÖv…v6Õf¦#&GV‡Æ7“V6&”Ã‡U“#—V35uTS•ESÄ5DUfeS$e•u%d¥E5S”õW”””sVÆG”%E¥…õw–7„Æ¤äÄ4äÕ3GtÅt¦ÆDtVå…6³u„sV6&ÕcF4s—–D4&¦$tg¦7”%uV³ö#%&Å#—V35'••vÇVDW‡e•u&Æ6Ä'6EvG&”'%„'5¥sÆ&å'¤”VDÕdU¤Ö#$fµ¥„¥$…fæsFvS‡T”4'vEt§6tÖv35&†DvÆ¤”„¦Å•u'f&×ƒT”Ue•dUdõSÅFÃ”õSd”Ct£¥5ETæf&Ó–µ¥c–¦##W¦D„¦†sS§§F6&Ç‡T”4d¶—6&”t”6öuS4&Å“&ÆÖU4&†&”%–×Å“5¥$4#'”&…¤uvS'6sW$”e¥5ESWe¤udF##W¦D„¦†sS4ug64ug–e4'¤ÆÇ‡T”4t¶”$¥¦”'V#5v34&Å“&ÆÖuf´Ä4&õ¥w‡u¥„–vC&Ç6$4'V#5u–ÕVu“4¦Å•…&Å¤3V6&”t”6öu5u–u”„¦Æ&Õ&Æ6³—•¤ug•”4'7”'¥¥…vDs†vDv†Ä”„§f#54”v†Æ$„&Æ6äÖvC&Ç6$4&¦#4#T”…&õ¥4'¥•sÄ”t'•¥sVµ¥„¥6Õ&Æ6ÔtÆÇ‡T”4t¶“–6&”v4…f–$vÆ¤”v†Æ$„&Æ6Ä§f#5ôö”%U4d¤e%3U–×Å“5¥$GF6&Ç‡T”4'vEt§6tÖv6Õf…¤s—V$†¶v4tg–3%g”ö”$…De$uTtg–3%g”ó‡U„sFt”„#–×‡—”&å¥…v&ÔgE¥6wö”'¦D„§&Ö6vS‡T”4t”„¦ÆD…g–&”%uV³ö#%&Å#—V35'••vÇVDW‡e•u&Æ6Ä'6EvG&“Tete$eFÄä¥CVeF´då%GF6&”veg‡U„sFt”„#–×‡—”&¦##W¦D„£“5'f6–‡u•„§¥¥„“d”VDÕdU¥•„§¥¥„—4”s—vDvÇf&äÒôö”%uV³ö#%&Å#—V35'••vÇVDW‡e•u&Æ6Ä'6EvG&³—vDvÇf&ä×”‡F6&”t”4#vÇ¤Æä&†6äæÆ6”””„&†6äæÆ6§F6&Ç‡T”4t”…&ö„×Vug64ug•VÓ—fD4””s—vDvÇf&äÒôÆÖ†Æ$„&Æ6Ä§f#5u„sFt”ƒ6&Ç‡T”4'vEt§6tÖu•„ãV&ÔÖu•u£¥„¥6##“´vG6Du“d”VDÕdU—ö”%6Ó—F„æÅ…§fu´”‡F6&”t”4&æ$…&ÔÆåg¥¥„¤U•…&„Æå§–%SWe¤udF##W¦D„¦†sSEtgU•vFÆ6”””tc5•vÃ”…&ö„×Uƒ&ÇF4s—–D6†æ$…&ÔµGF6&”veg‡U„sFt”3‡¶Ç‡T”4t¶”$¦%„'f6åu“#—V35'••vÇVD„Öu¦ä§f%4&„”VDÕdU–u•sV´”„¦ÆD…g–&äÖu•4#uw‡&×6ufÄ¤åFÓ–µ¥Tçf&äã6Ôg&å$å•sV…£%g–e3V6&”t”6öu5…v%vÆæ…v6ÕcE„§T”t'VEw‡5”4'&äã¥tf´”†Fõ¥sFv…u¤s–Æ7”'V#5v&ÕfÅ¤4#'”&•¥4&¦6Õf†Duf´”s—””„çf%ucvÇU§”&æ'”#66Ó—U§“V6&”t”76&”t”6öu„&†6ÔgD”vG6Du–u4'u•„§¥¥uv6Õg¦Ewƒ”s–Ô”VDÕdU–vDtg%¥sFu¦ä§f%4$…De$uDs–…¤ug•„sFt”4Ã‡T”4'v6Ó“¥tã¥uu•„ãV&ÔÖuƒ&ÇF4s—–D6†æ$…&Ôö”$…De$tµFöuT„§f%vÇ¥¥G…uV³ö#%&Å#—V35'••vÇVDS†&Ôfå¥„–vd4'VEw‡5”#u„sFt”4u“#—V35väçf&”””…&ö„×V4tg–3%g”Æ×¦##Fu•„Öu#…U&Äæ¦ugE•3T¥#…U&§F6&Ç‡T”4t”3‡d”uf†6×ƒT”tf–#4£”vÆÔ”vÃ”u'e¥„çT£5vE„æÄ”tçf&äã6Ôg&å'¥„sFt”4u“#—V35v„äF##W¦D„¦†sS3g¥¥uu4'3#—TÆÕcFDugV3&Çf&äåf3%fµ“W&Õ&ÆTS–Ô´e¥5ESWe¤udF##W¦D„¦†sSDs–…¤ug•Twƒ£&ÇTÆµe•dUdõSÅFÃ”õSdµ4…CtÅDSu„sFt”4vu–t´4g3çf&äã6Ôg&å'¥e„æÅ¤6¶vS‡T”4t”4v6ÕcE„§T”sS$wsu„sFt”4veg‡U„sFt”4u“#—V35v%tgU•vFÆ6”””sVÆG”%uV³ö#%&Å#—V35'••vÇVDS†&Ôfå¥„–ôµGF6&”t”4&¦##W¦D4#„¦Å¥SWe¤ug¤ö”%U4d¤e%3U–×Å“5¥$gFD”Cu•†F†…vDv‡7“Wu•„§¥¥„—U£%c$ugu¥sVµ¥sV¦ug¤´6GV#%&Ä§–³u„sV6&”t”4dÇ”'%„'f6åu“#—V35'••vÇVD„Öu¦Ó—””uf…“&vv&Ó–µ¥„æ6&”t”4#„¦Å¥SWe¤ug¤ÆÕ§f6µf…“&vô´sWe¤uW4”sWe¤ud¦&Õ&ÆT6¶uCFvS‡T”4t”4u“#—V35v3$æõ¥s…FÓ–µ¥4””w¦##GV&Ó–µ¥„Ö…s#We¤ud¦&Õ&ÆTcu„sV6&”t”4t”3‡d”tæõ¥tç$”vÆÔ”…&õ¥4&ÆT…&Æ&äç##FvE„æÆ7”#uVu¥†ƒ¥sW¦s—U„sFt”4t”4&¦##W¦D4&ÆT…&Æ&äç##Fu4'¥“&†Æ%tdö#%&Å“VÆT…&Æ&äç##W¥“V%fÄ¤åFÓ–µ¥Tçf&äã6Ôg&å$Ö#$fµ¥„¥$…fæsGU%f…U%SUE5S”õƒT%EUfD”tg¥„sFt”4t”4t”Tçf&äã6Ôg&å%E“&†Æ%tWUfÄ¤åWe¤udF##W¦D„¦†sS”‡vvEsVµ¥u§&Õf´ó‡U„sFt”4t”4'¦”õ¥†ƒ¥sW¦s—T”C””sS$ww”‡F6&”t”4t”4v6ÕcE„§Tó‡T”4t”4veg‡U„sFt”4t”4&¦##W¦D4'¦4uf¥fÕg–3&Çf&”””ucFDugV3&Çf&“W¦4uf¥fÕg–3&Çf&§F6&”t”4t”vÆÔ”6v…TS•ESÄ5DUfeS$e•u%d¥E5S”õW“Võ•„Öö34&Å“¦Æ6äç##Gµ4#u„sFt”4t”4t”tçf&äçf$uWVC$g–&–†6&”t”4t”4t”4&ufÄ¤åFÓ–µ¥Tçf&äã6Ôg&å$Ö#$fµ¥„¥$…fæsCd”egV#WfC#Ft¤‡EuV³ö#%&Å#—V35'••vÇVDW‡e•u&Æ6Ä'6EvG&“Tete$eFÄä¥CVeF´då%ƒv34&Å“¦Æ6äç##Fu„4–¶S4çu¥tåu¥„§¦s—Vegv•”7†6&”t”4t”4tµGF6&”t”4t”4v6ÕcE„§Tó‡T”4t”4veg‡U„sFt”4t”4&¦##W¦D4&¦##W¦D„¦†sS$ufÔ”Cu¥†ƒ¥sW¦s—TÆÔçf&äã6Ôg&åu„sV6&”t”4t”3‡d”vÇF4s—–D4&¦##W¦D„¦†sS3‡T”4t”4vu–t´tçf&äã6Ôg&å$U¥u—V6Ó—6$4…4'VEw‡4µ4#u„sFt”4t”4t”tçf&äã”tçf&äã6Ôg&åu4#vÇ¤ÆÃ—%„'f6å%6#'‡5#—V35'••vÇVD6‡V#%&ÄÄ4#„¦Å¥SWe¤ug¤Ä4&¦##W¦D„¦†sS$ufÔÆä§f$wwó‡T”4t”4t”4'E•sV…£%g”ÆÔfµ¤Tçf&äã6Ôg&åõ“#—V35'••vÇVD6³u„sFt”4t”4#””ug63%Vvu–t´tçf&äã6Ôg&å$U¥u—U•vÇD”4S””sS$ww”‡F6&”t”4t”4u“#—V35u“#—V35'••vÇVD4””…&ö„×Uƒ&ÇF4s—–DTg%Tçf&äã6Ôg&åö&Ó–µ¥7vvDv‡•¥udö#%&Æ7—vu“#—V35'••vÇVDU&Å¦“V†só‡T”4t”4t”4'E•sV…£%g”ÆÔfµ¤Tçf&äã6Ôg&åõ“#—V35'••vÇVD6³u„sFt”4t”4#””ug63%Vvu–t´tçf&äã6Ôg&å$U¥u—V6Ó“•…'##Ft•Cv&åg6$6¶vS‡T”4t”4t”4&¦##W¦D4&¦##W¦D„¦†sS”CvDv‡7“Vfsv#4£VÓ“•…'##TF##W¦D„¦†sS´sWe¤uW4”…&ö6ÕfÅFÓ–µ¥„×4”tçf&äã6Ôg&å$U¥u—V6Ó“•…'##Gó‡T”4t”4t”4'E•sV…£%g”ÆÔfµ¤Tçf&äã6Ôg&åõ“#—V35'••vÇVD6³u„sFt”4t”4#•„sFt”4ve6³u„sV6&”t”4dÇ”'&ÖÃ”tçf&äã6Ôg&å'¥„sFt”4u£'ƒ¦“W¥“%gU¥3S4u&†Dudå•…'–†…†#4§5¤6wó‡T”4t”s†&Ôfå¥„—V3%c5sWDdã•…&Ä´6³u„sV6&”t”4'•¥…#6ÓFv%tgU•vFÆ6§F6&”veg‡U„sFt”„'–#5&Å“5&Å¤4&fsv#4£VÓ—6$Tçf&äã6Ôg&åõ„sFt”4u¤ug¦DvÇU•…'##Cd”e$•VµddÆ³––Õf¦DDäTÄg‡T”4t”sWe¤ug¤ö”%U4d¤e%3U–×Å“5¥$gFDÄg‡T”4t”„§f$w„F##W¦D„¦†sS$ufÔö”$F##W¦D„¦†sSS$æõ¥s„ÆÄ§f$w„F##W¦D„¦†sSÄg‡T”4ö”%uV³6#'‡5#—V35'••vÇVD4#u„sFt”4u“#—V35vW”'¦#5g•“%Sd”„çfE„¦¥¥VÇU¤ucDÄ4'–#'‡5†‡7—vvC%g£&ƒ”ƒu4'–#'‡5#—V35'••vÇVDU&Å¦§F6&”t”4&¦##W¦D4'¦#5g•“%Vu4'V#%&Æ3G¦#5g•“%d¦&Õ&ÆTcu„sFt”4u“#—V35u“#—V35'••vÇVD4””sVÆG”%uV³6#'‡5#—V35'••vÇVD6†µ¥„ãsV†DvÇf&—vv3#“6ÔæÄµGF6&Ç‡T”4t”vÆÔ”6‡–#'‡5†‡7”…4'VEw‡4µ4#u„sFt”4t”4&¦##W¦D„¦†sSÆä§f$w„&TvÇ¤”Cv6Ó—6$TcF„Óu„sFt”4veg‡T”4t”vÆÔ”6ƒ5¥vÆæ…t•Cv&åg6$6¶vS‡T”4t”4u“#—V35'••vÇVD3S5¥vÆæ…u4#5¥vÆæ…u„sFt”4veg‡U„sFt”4vu–t´…&ö„×Vug64ug•VÓ—fD6¶vS‡T”4t”4u“#—V35vug64ug””Cv&Õc4”e¥5ESWe¤udF##W¦D„¦†sS4ug64ug”´tçf&äã6Ôg&åó‡T”4t”4vDv‡7“Võ¥w‡u¥„¥6##“ÆÔfµ¤6†õ¥w‡u¥„—ó‡T”4t”ƒ6&Ç‡T”4t”„¦ÆD…g–&”&¦##W¦D„¦†sSó‡T”4#•„sV6&”v4„§fDuf¦Duf´”c—%„'f6å$&sF##W¦D„¦†sS´g‡T”4t”u&Æ35'&Ôcs—Tö”%U4d¤e%3U–×Å“5¥$7†6&”t”4'V#%&Æ7¦öudV…5%UWUC$§¥tãÓ&%…7†6&”t”4&†sF##W¦D„¦†sS$ufÔö”$F##W¦D„¦†sSS$æõ¥s„Æ´g%Tçf&äã6Ôg&å5„sFt”6³d”e¥5ETg%Tçf&äã6Ôg&åvS‡T”4t”tçf&äã”‡6v3#“6ÔæÄö”'¦#5g•“%d¦&Õ&ÆT7vu•vÇE†‡7—vvC%g£&ƒ”ƒu4&†sF##W¦D„¦†sS$ufÔó‡T”4t”tçf&äã”„çfE„¦¥¥4””sWe¤ug¥s4çfE„¦¥¥VÇU¤ucE…GF6&”t”4&¦##W¦D4&¦##W¦D„¦†sS”Cv&Õc4”e¥5ETg%Tçf&äã6Ôg&åõ¤ug¦DvÇU•…'##G4”„çfE„¦¥¥6³u„sV6&”t”4'¦”õ•vÇE†‡7”…4'VEw‡4µ4#u„sFt”4t”4&¦##W¦D„¦†sSÆÔg%TcF„Öu4&†s&TvÇ¤ó‡T”4t”ƒ6&”t”4'¦”öC%g£&ƒ”4S””sS$ww”‡F6&”t”4t”tçf&äã6Ôg&åVC%g£&ƒ”CvC%g£&ƒó‡T”4t”ƒ6&Ç‡T”4t”vÆÔ”6ƒvÇ¤ÆÖ†Æ$„&Æ6Ä§f#5”‡F6&”t”4t”tçf&äã”v†Æ$„&Æ6”””sVÆG”%uV³ö#%&Å#—V35'••vÇVDV†Æ$„&Æ6–†¦##W¦D„¦†sSµGF6&”t”4t”…&ö„×Vug64ug•VÓ—fD3V…¤uöug64ug”µGF6&”t”4#•„sV6&”t”4'•¥…#6ÓFu“#—V35'••vÇVDGF6&”veg‡U„sFt”„'–#5&Å“5&Å¤4&fsv#4£VÓ“•…'##TF##W¦D„¦†sS´g‡T”4t”u&Æ35'&Ôcs—Tö”%U4d¤e%3U–×Å“5¥$7†6&”t”4'V#%&Æ7¦öudV…5%UWUC$§¥tãÓ&%…7†6&”t”4'–#5&†DvÇf&´çf&äã6Ôg&å$U¥u“d”Tçf&äã6Ôg&å%E“&†Æ%tWUVÓ“•…'##TF##W¦D„¦†sSÄg‡T”4ö”%uV³6#5&†DvÇf&´çf&äã6Ôg&åvS‡T”4t”tçf&äã”‡6v3#“6ÔæÄö”'¦#5g•“%d¦&Õ&ÆT7vvC%g£&ƒ”ƒu4'–#5&†DvÇf&´çf&äã6Ôg&å$U¥u“u„sFt”4u“#—V35v3#“6ÔæÄ”Cv&Ó–µ¥„æ&3#“6ÔæÅ5sVµ¥††Dó‡T”4t”tçf&äã”tçf&äã6Ôg&åu4'U¥†6ufÄ¤åVÓ“•…'##TF##W¦D„¦†sS´u&Æ35'&Ôcs—TÄ4'¦#5g•“%Wó‡U„sFt”4vu–t´†FÆvFöD4…4'VEw‡4µ4#u„sFt”4t”4&¦##W¦D„¦†sSÆæFÆvFöD4””†FÆvFöDGF6&”t”4#•„sV6&”t”4'¦”öDv‡7“Võ¥w‡u¥„¥6##“µ4#u„sFt”4t”4&¦##W¦D4&õ¥w‡u¥„–u4'U¥†6ufÄ¤åFÓ–µ¥Tçf&äã6Ôg&å$•¥w‡u¥„–õ“#—V35'••vÇVD6³u„sFt”4t”4#vÇ¤ÆÖ†Æ$„&Æ6Ä§f#5U•u&´´v†Æ$„&Æ6–³u„sFt”4veg‡U„sFt”4v6ÕcE„§T”tçf&äã6Ôg&åu„sFt”ƒ6&ã6&”—4”4§%„'f6åt¶”&†7”%U4d¤e%4&Ö6Ó—D”6C„¦Å¥63u„sW%„'f6åvW”%uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„–ve4&Ö6Ó—D”67TÆ“•uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„–äó‡Vsv#4£”‡6ufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•S&††4udE•„'¦Ew†Ä”ƒu¦ä§f%4äÆ“GefÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•S&††4udE•„'¦Ew†Ä§§F6&ÖÇF4s—–D4#t”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6Äæõ•„&ÅTw††&ÕVve4&Ö6Ó—D”67TÆ“•uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„¥Ftgu¥d'5•sVÄ§§F6&ÖÇF4s—–D4#t”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6Äæõ•„&ÅS4&õ¥„¦Ä”ƒu¦ä§f%4äÆ“GefÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•S&††4ueF4v†Æ6ÕVäó‡Vsv#4£”‡6u#—6$vÆµ¥„¥Ftgu¥T£¦Õ¦Æ6¶FÆ##ÆD„£T”ƒu¦ä§f%4äÆ““DvÇ67“”F#'‡6u&Æ6Äæõ•„&ÅåfÕ¦Õg•#%gf%uc6æ¶äó‡Vsv#4£”‡6u#—6$vÆµ¥„¥Ftgu¥Tæ†4„ã$ud6Eu¦Õ¥„¤…¥s—E¥…'–U4#””u§–##t§“GfE…'$„×e#—6$vÆµ¥„¥Ftgu¥Tæ†4„ã$ud6Eu¦Õ¥„¤…¥s—E¥…'–U63u„sW%„'f6åvW”$F#'‡6u&Æ6Äæõ•„&ÅTw††&Õd6Eu¦Õ¥„¤…¥s—E¥…'–U4#””u§–##t§“GfE…'$„×e#—6$vÆµ¥„¥Ftgu¥d'5•sVÅåfÕ¦Õg•#%gf%uc6æ¶äó‡Vsv#4£”‡6u#—6$vÆµ¥„¥Ftgu¥dçvug•¥T£¦Õ¦Æ6¶FÆ##ÆD„£T”ƒu¦ä§f%4äÆ““DvÇ67“”F#'‡6u&Æ6Äæõ•„&ÅS4&õ¥„¦ÅåfÕ¦Õg•#%gf%uc6æ¶äó‡U„sV¦##W¦D4&fF¤ä$”Cv&Õc4”e$•VµddÆÅ¦Å“5'f6¤ÖôµGF6&Ç‡U¥†‡v#4£”tç5•„ç¤”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6¶†Æ$„&Æ6”&ÆT…&Æ&Õ'¤”e$•VµddÆ¶G–#5gt”‡F6&”v4…f–$vÆ¤”„¦Å•u'f&×ƒT”tçf$w‡¤ug”ö”%uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„“u„sFt”„'–…¦†DuVv6Õf…¤s—V$†¶uƒ&FÆ##ÆD„£Tö”$F#'‡6u&Æ6Äæõ•„&ÅåfÕ¦Õg•#%gf%uc6æ³u„sFt”„'–…¦†DuVv6Õf…¤s—V$†¶uƒ'‡&ÕSd”e$•VµddÆ·‡&ÕeE¥vGE¥sS7§F6&Ç‡T”4'vEt§6tÖu“#—V35'–Etã#4–õ“#—6$vÆµ¥„“d”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6–¶vS‡T”4t”„ã4ug”´6³u„sFt”4vDv‡7“WE•…'–†„&E…'ee„&µ•…&Ä”Cu¦Ôg63%Su„sV6&”t”4#vÇ¤ÆÔçf$w‡¤ug””Cu“#—6$vÆµ¥„“u„sV6&”t”4'¦”öDv‡7“V¦#'‡6u&Æ6“W¦tgu¥4'&äã•sV¥¥s–Ô”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6Äæõ•„&ÅS4&õ¥„¦Äµ4#u„sFt”4t”4#vÇ¤ÆÃ–å¥s—E¥…'–U4””sVÆG”$F#'‡6u&Æ6Äæõ•„&ÅS4&õ¥„¦ÅåfÕ¦Õg•#%gf%uc6æ¶öDv‡7“V¦#'‡6u&Æ6“W¦tgu¥6³u„sFt”4ve4&Æ$„æÄ”vÆÔ”6ƒvÇ¤ÆÔçf$w‡¤ug”Æäæõ•„&Ä”vÇV35&†&ÔæÆ#%–ufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•S&††4udE•„'¦Ew†Äµ4#u„sFt”4t”4#vÇ¤ÆÃ–å¥s—E¥…'–U4””sVÆG”$F#'‡6u&Æ6Äæõ•„&Å$gv35g5¥T£¦Õ¦Æ6¶FÆ##ÆD„£T´…&ö„×U“#—6$vÆµ¥„—V3&††4uWó‡T”4t”ƒu¥w‡¥¥4'¦”öDv‡7“V¦#'‡6u&Æ6“W¦tgu¥4'&äã•sV¥¥s–Ô”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6Äæõ•„&ÅTw††&ÕW”‡F6&”t”4t”…&ö„×Uƒ&FÆ##ÆD„£T”Cv&Õc4”Tçf$w‡¤ug•S&††4ue$tgU¥T£¦Õ¦Æ6¶FÆ##ÆD„£T´…&ö„×U“#—6$vÆµ¥„—V3&††4uWó‡T”4t”ƒu¥w‡¥¥4#u„sFt”4t”4#„§fG”'U¥†6u%„§–#4–ô£¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6¶†Æ$„&Æ6¦öuesW&&Ó“6&”&¦#'‡6u&Æ6”'¦tgu¥4#U„&Ä”u&ÆDuf¦Duf´§–³u„sFt”4veg‡U„sFt”4u“#—V35v%tc¥„§•wvu4'U¥†6udV…5%UWUDvÇU¥T¦†3&Æ¥Etc¥„§•wvöS‡T”4t”4u“#—6#4“d”D#E¦Õ—tÔu¦ÔÄg‡T”4t”4u¤ugvDv…U¥„ãö”&Õ•w‡¥¥7†6&”t”4t”u&Æ4…&õc4§DuSd”u¦†$„æÄÄg‡T”4t”ƒó‡U„sFt”4vDv‡7“Vf$vÇU¥4””sVÆG”%U4d¤e%3TÖsVÅS%fæ%ugVD„ÖöDv‡7“Ve£%gf%uc6æ·4”s†Dug–tg4µGF6&”t”4#vÇ¤ÆÔfµ¤6ƒvÇ¤ÆÃ—6sVÄµGF6&”veg‡U„sFt”„#–×‡—”&¶„çv#4æÄ´6³d”…§fuvS‡T”4t”…&ö„×Uƒ&FÆ##ÆD„£TÆÕ'34'f3%VôµGF6&”veg‡U„sFt”„#–×‡—”#4u&†Dudå•…'–†…†#4§5¤6†Ö#4¦¥¥Föu–Ó—f$uf†&–³d”…§fuvS‡T”4t”…&ö„×U“#—6$vÆµ¥„—VE„&µ•…&Åc#—–$u$å•…'–†vöD„£¥7vu¦Ôg63%Wó‡U„sFt”4vDv‡7“WE•…'–†wU“#—vU6ƒvÇ¤ÆÔçf$w‡¤ug”ÆÓ†D„§TfGf6×†´µGF6&Ç‡T”4t”tçf&äã”s†D„§TfGf6×†µ%w†Æ%ugVD„Öu4#vÇ¤ÆÓ†D„§T3VÆ$ugE¥sS7§F6&”t”4#vÇ¤ÆÃ–å¥s—E¥…'–U3S6#4§5¤dæ¥•w†Ä”Cuƒ5—¥g‡T”4t”4tÆäæÆD6‡E•…'–†…†#4§5¤Ug5¥sÆ&å'¥w¤&DÄ4'E•…'–†…†#4§5¤Ug5¥sÆ&å'¥w¤fDÄ4'E•…'–†…†#4§5¤Ug5¥sÆ&å'¥w¤¦Dµg‡T”4t”4tÆ×†Æ&ÖC6w÷”dÇ”&¥•w†¦Ew††DuVv3$æ†$uVv#%–vT4&¦##v##VÆ&å&6&Ç‡T”4t”…&ö„×Uƒ&FÆ##ÆD„£TÆågu¤tc¥6wó‡U„sFt”4v35gu¥„—VE„&µ•…&ÅEtc6ÖÃEc#—–$uõ¦Ó—•“%Wó‡T”4#•„sS•„sF”Ä4–sv#4£”6öu•„ÖudV…5%UVu¦ä§f%4æDv‡•¥uVäó‡Vsv#4£”‡6ufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•S&††4uVve4&Ö6Ó—D”67TÃ¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6Äæõ•„&Ä§§F6&Ç‡U“#—V35uƒ5—¥4””sVÆG”%U4d¤e%3Uu¥tã#4—¤´6³u„sV¦##W¦D4&fF¤ä4”Cv&Õc4”e$•VµddÆÅ¦Å“5'f6¤ÖôµGF6&Ç‡U¥†‡v#4£”tç5•„ç¤”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6Äæõ•„&Å$gv35g5¥4&ÆT…&Æ&Õ'¤”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6Äæõ•„&Ä”‡F6&”v4…f–$vÆ¤”vFÆD4#U„&Ä´6³d”6F¥•„'¦Ew†Ä§”#u„sFt”4v6ÕcE„§T”6F¥•„'¦Ew†Ä§§F6&”veg‡U„sFt”3‡¶Ç‡T”4t¶”%VuVv#%¦Ö3%c”s–Ô”…&õ¥4&¥•„'¦Ew†Ä”v†Å•uu¦ä§f%4#uVv#4§£&ÇT”vÇT”w‡e“$g4”„çu•tæÄÆÇ‡T”4t¶“–6&”v4…f–$vÆ¤”s–Õ¦äæÆDFöudV…5%UWUfÕf¦Ds—”×§F6&Ç‡T”4d¶—6&”t”6öudv†Ä”s–Õ¦äæÆD4'e¦”#uVu“$gv35g5¥4#•vÇ4”u§–##vDv†Ä”s—–vG&”'&”'6#$æ†$4'¦4tf¥¥3V6&”t”6÷e„sFt”„#–×‡—”#•vÇ4ö”%U4d¤e%3Uu¥tã#4—¤ó‡U„sFt”3‡¶Ç‡T”4t¶”%VuVv6Ôf¶…g¤”s–Ô”…&õ¥4&¥•„'¦Ew†ÄÆÇ‡T”4t¶“–6&”v4…f–$vÆ¤”„¦…¤vÃ7¦öv&ågE–Õg”ó‡U„sFt”3‡¶Ç‡T”4t¶”$¥¦”#6åfÄÄ4#uVu“#—6$vÆµ¥„–v4„¦ÆFÕgVD„Öv34'–sVä”t§f&Õg¤”u§–##u£#—&Ö6v#5c3&Æµ¥4'e¦”#uVu“$gv35g5¥4'&äã¥tf´ÆÇ‡T”4t¶“–6&”v4…f–$vÆ¤”vÇV3&Æµ¥Föu–Ó—f$uf†&§F6&Ç‡T”4'vEt§6tÖu“#—V35'–Etã#4–ö4tg••s¥¦övW”'••u'E„Òôö”'VEs•¥„“t”s–Õ¦äæÆDCƒd”e$•VµddÆÅ¦Å“5'f6¤Ót”…&†wrôö”%U4d¤e%3Uu¥tã#4—¤÷”'&äç¤uRôö”&–##—5¥tgT”ƒ”‡F6&”t”4'¦E„&Æ6–wó‡U„sFt”4vDv‡7“We¦Õ§¥¥…u4'u•„¦†%„ÒôÆÓ–Õ¦äæÆD4õ”'U¥†6udV…5%UWUfÕf¦Ds—”×–wtÆ¤4”DTÔ7vtÔ3GtµGF6&”t”4#vÇ¤Æå&†wvu4'u•„¦†%„ÒôÆå&†wvu£†v&Õc4”e$•VµddÆÅ¦Å“5'f6¤ÖôÔ3GtÄ4tÆ¤4”DTÔ6³u„sFt”4vDv‡7“W••u'E„Öu4'u•„¦†%„ÒôÆä¦…¤vÃ7”õ”tÆ¤u„sFt”4vDv‡7“W&äç¤uVu4'u•„¦†%„ÒôÆÖÇV3&Æµ¥4õ”&Õ•w‡¥¥GF6&”veg‡U„sFt”„#–×‡—”&¥•w†¦Ew††DudF#'‡6„ç##Fõ„sFt”4u“#—6$vÆµ¥„¤å•…'–†sd”e$•VµddÆ³†D„§TE5„sFt”4v#$§¥tãTs—¦…'##Cd”e$•VµddÆÅ¦Å“5'f6¤×5„sFt”4v#$§¥tãVÔf¶…g¤ö”'VEs•¥„—5„sFt”4vDtg•£%cö”%U4d¤e%3Uu¥tã#4—¤Äg‡T”4ö”'VEs•¥„–vS‡T”4t”c“$ÓWV3%c&ä§f%S†D„§Td'f3&Ãs—T´tçf$w‡¤ug•Etc6ÖÃDµG6tÇ“†vD„¦†&äæÖ#4§E¥uvuf…¤g‡T”4t”c“$Ó—V35f•fÕf¦Ds—–7–ƒvÇ¤Æå&†ww4”…&ö„×V#%¦Ö3%cµ3V†4„'6US†D„§TEõ“#—6$vÆµ¥„¤å•…'–†w÷”dÇ”#6ÔgV3%§f6ÓÅ¤4#•vÇ5„sFt”4uƒ5—¥“W¦Et–õƒ5—¥6³t”3‡d”u§–##vuf…¤4#'”#•vÇ5„sFt”4u“#—V35v$ugU£5&õS4dE•„'¦Ew†Ä”Cuƒ5—¥“W5¥sVæDv…F56wó‡U„sFt”4vDtg•£%cÆÔçf4†¶ö#$§¥tãTs—¦…'##GÆäã––†fF¤ä$µG6tÇ“†u¦ä§f%4&õ¥tf´”…'d”s––Õf¦Dg‡T”4t”tçf&äã”u'fD4””c“$Ó—U¤s“´…&†6ÖFÆD6³t”3‡d”u'fD4'v6Ó–¶Etã”s–Ô”s–Õ¦äæÆDe'edtg$4&†&Õv#%¦Ö3%cds•–×Å“5&6&Ç‡T”4t”vÆÔ”6†¶#5uCtÔ3Gtµ4#u„sFt”4t”4dÇ”'¦”'e–×Å“5v„Öv&Õf†6”&Ö6Ó—D”…&õ¥4&õ¥tfµ„sFt”4t”4dÇ”&¶'”'V#5&ösVäÄ4#3%VvDv†Ä”tã6ä¦Æ&åvFÔg6EuVu¤vÇ•¥tã$†Æ6&”t”4#””ug63%Vvu–t´w†Æ&ÖCdç…$gv35g5¥4…4&¶#5”‡F6&”t”4t”3‡d”vÆÔ”s––Õf¦D4'7”'U¥tg””u§–##vDv†Ä”…&†w†6&”t”4t”…&†6ÖFÆD3W¦Et–õƒ5—¥–³t”3‡d”u§–##vDtg$4#'”'e–×Å“5&6&”t”4#””ug63%VvS‡T”4t”4tÇ“†vu–v#$§¥tã”vÇ¤”t¦ÆD†FÅ¥sFvD†Gd”ugU¤„æ6&”t”4t”c“$Ó—V%…g6DvÇv$†ÅE“$g5•„–õ¤s“”3†v$ugU£5&õS4dE•„'¦Ew†ÄµG6tÇ“†u¦ä§f%4&õ¥tf´”…'d”…&õ¥4'U¥tg•¥„ã”„'fsS”s–Ô”…&õ¥4'¦tfÖDg‡T”4t”4vDtg•£%cÆäã––†fF¤ä4µG6tÇ“†u¦ä§f%4#uVv3&†…¦åv4s—&åvDs†v#$§¥tã„sFt”4veg‡U„sFt”4u“#—V35v$ugU£5&ô”CvDtg•£%cÆ×†Æ&ÖC6wó‡T”4t”tçf&äã”u'35&†&ÔæÄ”CvDv‡7“W&äç¤uVu”#vÇ¤Æä¦…¤vÃ7”D”s––Õf¦Dd¦…¤vÃ7”D”w†Æ&ÖC4d”w†Æ&ÖC4D”s––Õf¦Dd¦…¤vÃ7”D”…&ö„×V6Ôf¶…g¤ó‡U„sFt”4vu–t´u'35&†&ÔæÄ”GvtÔ6¶vS‡T”4t”4vDtg•£%cÆÓ$…'4wƒUS$æ†$tg”´DVtÇ”'5¥sVæDvw÷”dÇ”&¦##S%¥„£”…&õ¥4&µ¥wƒ•4#'”#uVu¤vÇ•¥tãs—U„sFt”4t”4'¦”öDv‡7“W&äç¤uW”‡F6&”t”4t”4vDtg•£%cÆÓVÅ£$c¥6w÷”dÇ”'¦”'&äç¤uW4”„¦ÆFÕg–3%VvDv†Ä”u'6Õf¦DvÇf&Ç‡T”4t”4veg‡T”4t”ƒ6&Ç‡T”4t”„¦ÆD…g–&”&¶„ã•sV¥¥GF6&”veg‡Veg‡T–—vt–ÖÇF4s—–D4#U„&Ä”6öu•„ÖudV…5%UVu¦ä§f%4æDv‡•¥uVäó‡U„sGd¶—6&””d¦Æ4„¦Æ3%gVD„Öu•4'¦tgu¥4'e¦”&„”tçf$w‡¤ug”ÆÇ‡T”6÷e„sVÆT„'f6åu•t§¦D„¦…“5u“'††34ÖufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•S&††4uVvS‡T”4d¶—6&”t”6öudv†Ä”…#V4uVv#%–vDv†Ä”„æõ•„&ÄÆÇ‡T”4t¶“–6&”v4…f–$vÆ¤”tf–35'••tã”vFÆD4#U„&Ä´6³d”„ã6ÖÇU§§F6&Ç‡T”4d¶—6&”t”6öudv†Ä”s–Õ¦äæÆD4#'”#uVv3&††4uWU„sFt”4Ã‡T”4'vEt§6tÖv#%¦Ö3%c¦öudV…5%UWUfÕf¦Ds—”×§F6&Ç‡T”4d¶—6&”t”6öu$g5“5g5•…&Ä”tVu¤vÇ¦DtgU“%Vu•sV´”tVu¤vÇ•¥tãs—T”u§–##vDv†Ä”tçf$w‡¤ug””…'d”tVvDtg•£%c”s––Õf¦D3V6&”t”6öu5…æ7”&ö…vu–vDv†Ä”u'35&†&ÔæÄ”vÇ¤”sVÅ£$c…¦ÄÆÇ‡T”4t¶”%VuVu¤vÇ•¥tãs—T”†G$wvu–ÕVu“#—VDtg&Õf´”vÇT”…&õ¥4&æ…¦Æ&”#•„¦å¥…vFÕf¦Ds—”ÆÇ‡T”4t¶Ç‡T”4t¶”$4tg••su“#—6$vÆµ¥„¤å•…'–†vu4'E•…'–†vv6Õgv6Õg¥¥sS7”#uVvD„¦†&äæÖ#4§D”s–Ô”…&õ¥4&¦#'‡6u&Æ6Ç‡T”4t¶”$4tg••sv#$§¥tãTs—¦…'##Fu4#%¥tã#4–v6Õgv6Õg¥¥sS7”#uVv4s—¦…'##Fv#%–vDv†Ä”…&†6ÖFÆD4'e–×Å“5&6&”t”6öu„&†6ÔgD”s––Õf¦Dd¦…¤vÃ7”%VuVv6Ôf¶…g¤”s–Ô”…&õ¥4'e–×Å“5&6&”t”6öu„&†6ÔgD”…&†6ÖFÆD4%VuVv6Õg¦Ewƒ”u'6Õf¦DvÇf&”#6w‡4”t¦Ä”tçf&å&†sVÅ¤4'&”#vÇ¤”…¦Å“5'f6Ç‡T”4t¶“–6&”v4…f–$vÆ¤”tf–35'••tã”tæ†$tã$tc¥Tçf$w‡3&Çf&–†6&”t”4&¦#'‡6u&Æ6³†D„§TFöudV…5%UWUEtc6ÖÃDä7†6&”t”4'e–×Å“5%#4çDvÇf&¦öudV…5%UWUfÕf¦Ds—”×—†6&”t”4'e–×Å“5%5•u'E„Ód”sS%t¦Æ6—†6&”t”4#•„¦å¥…d”e$•VµddÆÅ¦Å“5'f6¤×5„sFt”6³d”sS%t¦Æ6§F6&ã6&”—4”4§%„'f6åt¶”&†7”%U4d¤e%4&Ö6Ó—D”6C„¦Å¥63u„sW%„'f6åvW”%uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„¥Ftgu¥4#””u§–##t§“GefÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•S&††4uVäó‡U„sV¦##W¦D4&fF¤ä$”Cv&Õc4”e$•VµddÆÅ¦Å“5'f6¤ÖôµGF6&Ôçf&äã”c—E•…¥4””sVÆG”%U4d¤e%3Tå•…'–†w¤´6³u„sV6&ÕcF4s—–D4&¦$tg¦7”%uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„¥Ftgu¥d'5•sVÄ”ucFDugU¤„ÖufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•S&††4uVvS‡T”4'vEt§6tÖu£%c”…#V4uVôµFöt£4'5•sVÄ§”#u„sFt”4v6ÕcE„§T”6Gv$tgU¥63u„sFt”ƒ6&Ç‡T”4d¶—6&”t”6öudv†Ä”s–Õ¦äæÆD4'e¦”#uVv4w††&ÕVu¦ä§f%4#uVv#4§£&ÇT”vÇT”w‡e“$g4”„çu•tæÄÆÇ‡T”4t¶“–6&”v4…f–$vÆ¤”s–Õ¦äæÆDFöudV…5%UWUfÕf¦Ds—”×§F6&Ç‡T”4d¶—6&”t”6öudv†Ä”sWf6Ó†$4'e¦”#uVv4w††&ÕVvsFv$s–¥•wvv34&…“%WT”S35u–ÕVv&Ó—–%tg6‡Å¤3V6&”t”6÷e„sFt”„#–×‡—”'V#4§E•wsd”e$•VµddÆÅ¦Å“5'f6¤Óu„sV6&”v4…f–$vÆ¤”tçf&äã6åf¦Ds—”´„&†6ÔgF7£ƒd”‡6v#%¦Ö3%c¦öudV…5%UWUfÕf¦Ds—”×§6v&Ó—–%tg5¦öudV…5%UWUfÕf¦Ds—”×”#”µ4#u„sFt”4v35gu¥„–ôµGF6&Ç‡T”4t”…&ö„×V#%¦Ö3%c”Cv4tg••s¥“We¦Õ§¥¥…u£†v&Õc4”e$•VµddÆÅ¦Å“5'f6¤ÖôÔ3GtÄ4tÆ¤4”DTÔ6³u„sFt”4vDv‡7“WV#4§E•wvu4'u•„¦†%„ÒôÆÓWf6Ó†$4õ”'U¥†6udV…5%UWUfÕf¦Ds—”×–wtÆ¤4”DTÔ7vtÕ3GtµGF6&”veg‡U„sFt”„#–×‡—”&¥•w†¦Ew††DudF#'‡6„ç##Fõ„sFt”4u“#—6$vÆµ¥„¤å•…'–†sd”e$•VµddÆ³†D„§TE5„sFt”4v#$§¥tãTs—¦…'##Cd”e$•VµddÆÅ¦Å“5'f6¤×5„sFt”4v#$§¥tãVÔf¶…g¤ö”'VEs•¥„—5„sFt”4vDtg•£%cö”%U4d¤e%3Uu¥tã#4—¤Äg‡T”4ö”'VEs•¥„–vS‡T”4t”…&†6ÖFÆD3W¥¥…$v6Ó—EEtc6ÖÃETs—¦…'##Fõ“#—6$vÆµ¥„¤å•…'–†w÷”dÇ”#6ÔgV3%§f6ÓÅ¤4'e¦Õ§¥¥…&6&”t”4#•„¦å¥…V&Õfå•…&Ä´6·U•u&´´s––Õf¦Dd'f3&Ãs—TµG6tÇ“†u•4#%¥tã#4–u¦ä§f%4&¦#'‡6u&Æ6”&¥¥sS¥„–vDs†v#$§¥tã”„'f3&Ãs—U„sV6&”t”4&f%tcÓWU£%cFÓ—–%tg5Etc6ÖÃD´tçf$w‡¤ug•Etc6ÖÃDµG6tÇ“†u“#—VFÕg–D4#uVu“#—6$vÆµ¥„–v%tc6ÖÃD”…'d”…&õ¥4'V#4§E•wvv%tc6ÖÃE„sFt”4uƒ5—¥3V¦#4#T´…&ö„×V&Ó—–%tg4µ3V†4„'6USWf6Ó†$S†D„§T6†f%tcÓWÆÓWf6Ó†$vÃe¥6w÷”dÇ”#6ÔgV3%§f6ÓÅ¤4'V#4§E•w†6&”t”4&¦##W¦D4&¶„ã•sV¥¥4””…&†6ÖFÆD3V¶#5õƒ5—¥6¶tÅ4'e–×Å“5%5•u'E„Óu„sV6&”t”4#•„¦å¥…U“#—vU6†fF¤ä$µG6tÇ“†u“#—VFÕg–D4#uVu¤ug6DtVvDs†vDv†Ä”u'6Õf¦DvÇf&Ç‡U„sFt”4v6ÕcE„§T”u'35&†&ÔæÄó‡T”4#•„sS•„sF”Ä4–sv#4£”6öu•„ÖudV…5%UVu¦ä§f%4æDv‡•¥uVäó‡Vsv#4£”‡6ufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•S&††4uVve4&Ö6Ó—D”67TÃ¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6Äæõ•„&Ä§§F6&Ç‡U“#—V35uƒ5—¥4””sVÆG”%U4d¤e%3Uu¥tã#4—¤´6³u„sV6&ÕcF4s—–D4&¦$tg¦7”%uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„¥Ftgu¥dçvug•¥4&ÆT…&Æ&Õ'¤”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6Äæõ•„&Ä”‡F6&”v4…f–$vÆ¤”vFÆD4#U„&Ä´6³d”6G¦4v†Æ6ÕVä”‡F6&”t”4'•¥…#6ÓFt£4çvug•¥63u„sFt”ƒ6&Ç‡T”4d¶—6&”t”6öudv†Ä”s–Õ¦äæÆD4'e¦”#uVv34&õ¥„¦Ä”u§–##vDv†Ä”s—–vG&”'&”'6#$æ†$4'¦4tf¥¥3V6&”t”6÷e„sFt”„#–×‡—”'e¦Õ§¥¥…d”e$•VµddÆÅ¦Å“5'f6¤Óu„sV6&”tÇ–÷„sFt”4”e&õ¥4'••u'E„×U„sFt”4Ã‡T”4'vEt§6tÖv6Ôf¶…g¤ö”'VEs•¥„“u„sV6&”tÇ–÷„sFt”4”VÆÔ”…'–EuW4”…&õ¥4&¦#'‡6u&Æ6”'v6Õc%¥sS7”'¦4„§&Ö6u–Ó—U¥„Öu¦ä§f%4&æ#&ÇU§”'fE…'¦u&Ä”s–Ô”…&õ¥4'¦4v†Æ6ÕVvsW¦Duf…¤3V6&”t”6÷e„sFt”„#–×‡—”'&äç¤uSd”t§f#'†Å•sCu„sV6&”v4…f–$vÆ¤”tçf&äã6åf¦Ds—”´„&†6ÔgF7£ƒd”‡6v6Ôf¶…g¥¦öv&ågE–Õg”÷”'e¦Õ§¥¥…ôö”%U4d¤e%3Uu¥tã#4—¤÷”'&äç¤uRôö”&–##—5¥tgT”ƒ”‡F6&”t”4'¦E„&Æ6–wó‡U„sFt”4vDv‡7“We¦Õ§¥¥…u4'u•„¦†%„ÒôÆÓ–Õ¦äæÆD4õ”'U¥†6udV…5%UWUfÕf¦Ds—”×–wtÆ¤4”DTÔ7vtÔ3GtµGF6&”t”4#vÇ¤Æä¦…¤vÃ7”””„&†6ÔgF7£‡V6Ôf¶…g¤”C‚ô”DTÔGF6&”t”4#vÇ¤ÆÖÇV3&Æµ¥4””„&†6ÔgF7£‡VsW¦u&Ä”C‚ô”u¦†$„æÄó‡T”4#•„sV6&”v4…f–$vÆ¤”tæ†$tã$tc¥Tçf$w‡3&Çf&–†6&”t”4&¦#'‡6u&Æ6³†D„§TFöudV…5%UWUEtc6ÖÃDä7†6&”t”4'e–×Å“5%#4çDvÇf&¦öudV…5%UWUfÕf¦Ds—”×—†6&”t”4'e–×Å“5%5•u'E„Ód”sS%t¦Æ6—†6&”t”4#•„¦å¥…d”e$•VµddÆÅ¦Å“5'f6¤×5„sFt”6³d”sS%t¦Æ6”#u„sFt”4vDtg•£%cÆäã–Å¦Å“5'f6äÖö#$§¥tãTs—¦…'##G4”c“$ÓWV3%c&ä§f%S†D„§Td'f3&Ãs—T´tçf$w‡¤ug•Etc6ÖÃDµ6³u„sV6&”t”4&¦##W¦D4'5¥sVæDvvu4#•„¦å¥…V$ugU£5&ô´6³u„sFt”4u“#—V35u¤vÇ¦DtgU“%Vu4#vÇ¤ÆÖÇV3&Æµ¥4ô”…&ö„×V6Ôf¶…g¤”3v#$§¥tãVÔf¶…g¤”3v$ugU£5&ô”Föv$ugU£5&ô”3v#$§¥tãVÔf¶…g¤”3vDv‡7“W••u'E„Óu„sV6&”t”4'¦”õ¤vÇ¦DtgU“%Vu4tµ4#u„sFt”4t”4#•„¦å¥…V%…g6DvÇv$†ÅE“$g5•„–ôÕ4d”w†Æ&ÖC6³t”3‡d”tçf&å¦Æ6åvDv†Ä”u&Æ$…&„”…'d”…&õ¥4&¶„¦Å“5'##V6&”t”4t”vÆÔ”6ƒvÇ¤ÆÖÇV3&Æµ¥6¶vS‡T”4t”4t”4#•„¦å¥…V&Õfå•…&Ä´6³t”3‡d”vÆÔ”vÇV3&Æµ¥7vv6Õc%¥„§¥¥4#uVu¤vÇ•¥tãs—U„sFt”4t”4#•„sFt”4veg‡U„sFt”4v6ÕcE„§T”u'35&†&ÔæÄó‡T”4#•„sS•„sF”Ä4–sv#4£”6öu•„ÖudV…5%UVu¦ä§f%4æDv‡•¥uVäó‡Vsv#4£”‡6ufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•S&††4udE•„'¦Ew†Ä”ƒu¦ä§f%4äÆ“GdÆ“GefÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•S&††4udE•„'¦Ew†Ä§§F6&ÖÇF4s—–D4#t”Tçf$w‡¤ug•S&††4ud6Eu¦Õ¥„¤…¥s—E¥…'–U4#””u§–##t§“Ge#—6$vÆµ¥„¥Ftgu¥T£¦Õ¦Æ6¶FÆ##ÆD„£T§§F6&Ç‡U“#—V35uƒ5—¥4””sVÆG”%U4d¤e%3Uu¥tã#4—¤´6³u„sV6&ÕcF4s—–D4&¦$tg¦7”$F#'‡6u&Æ6Äæõ•„&Å$gv35g5¥T£¦Õ¦Æ6¶FÆ##ÆD„£T”ucFDugU¤„ÖudV…5%UWUåfÕ¦Õg•#%gf%uc6æ¶vsv$ugE¥sS7”$F#'‡6u&Æ6Äæõ•„&ÅåfÕ¦Õg•#%gf%uc6æ¶vS‡T”4'vEt§6tÖvC#—–$u%E“$g5¥4””DWTÔGF6&Ç‡T”4'v6ÖÃ%•…&Ä”„¦Å•u'f&×ƒT”c–†D…'•Ts—¤ö”%U4d¤e%3T6Eu¦Õ¥„¤&D…'–t£DuSu„sFt”„'–…¦†DuVv6Õf…¤s—V$†¶uƒ$cD„¤¦&Õ&ÆTFöudV…5%UWUåfÕ¦Õg•…#6ÖÆ–E…&Äó‡T”4'v6ÖÃ%•…&Ä”„¦Å•u'f&×ƒT”c—¦tgu¥FöufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•S&††4udE•„'¦Ew†Äó‡T”4'v6ÖÃ%•…&Ä”c–¦E„§•¥sSVÔf¶…g¤”CtÔGF6&”v4„§FÔc¥4'•¥tf¶##W6U4&e“5g–6ÕgVDS–Õ¦äæÆD4””sVÆG”%U4d¤e%3Uu¥tã#4—¤´6³u„sFt”„'–…¦†DuVv6Õf…¤s—V$†¶uƒ$ã6ä¦Æ&å%U•vÇ4”Cv&Õc4”e$•VµddÆÅ¦Å“5'f6¤ÖôµGF6&Ç‡T”4'vEt§6tÖu“#—V35'–Etã#4–ö3&††4uSd”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6Äæõ•„&Å$gv35g5¥6¶vS‡T”4t”„ã4ug”´6³u„sV6&”t”4#vÇ¤ÆÃ—¦tgu¥4””„æõ•„&Äó‡U„sFt”4vDv‡7“Ve•…#6Ä'f7”””sVÆG”%U4d¤e%3T6Eu¦Õ¥„¤&D…'–t£DuVö&Õc4”U§6#$c×¤¤&6ä¦†U6w¤õE—Ä4¤µGF6&”t”4#vÇ¤ÆäæÆDTcD„§–åc¥6væ4s—¦…'##FäÄ4#vÇ¤ÆÃ–†D…'•Ts—¤µGF6&Ç‡T”4t”…&ö„×Uƒ$cD„¤¦&Õ&ÆT4””sVÆG”%U4d¤e%3T6Eu¦Õ¥„¤&D…'–t£DuVö&Õc4”eg&å„æ´g–6ÔcT´D“$ä6·4”DWó‡T”4t”…&ö„×V3%c5sVµ¥†vöDv‡7“Ve•…#6¶ÇU¤ucDµGF6&Ç‡T”4t”…&ö„×Uƒ$£w†µ5sVµ¥†vôµGF6&”t”4#vÇ¤Æågu¤tc¥6wó‡T”4#•„sV6&”v4…f–$vÆ¤”…gu¤tc¥6wö”#&#&Æ´”‡F6&”t”4'5¥…v3&‡fEw†µe„&µ•…&Å#%gf%uc6æ¶u4&Õ•w‡¥¥GF6&Ç‡T”4t”tçf&äã”„¦…¤vÃ7”””…&ö„×Uƒ4æõ•„&ÄÆä¦…¤vÃ7”d”…&ö„×VC#—–$u%E“$g5¥GF6&”t”4'¦”öDv‡7“Ve“5g–6ÕgVDd¦…¤vÃ7”…Cv6Ôf¶…g¤µ4#u„sFt”4t”4#vÇ¤ÆÃ–¦E„§•¥sSVÔf¶…g¤”Cv6Ôf¶…g¤ó‡T”4t”4v3&‡fEw†µe„&µ•…&Å#%gf%uc6æ¶u4#6åfÄó‡T”4t”ƒ6&Ç‡T”4t”vÆÔ”6v†Dv‡7“Ve“5g–6ÕgVDS–Õ¦äæÆD3VÆ5…f†$„ÖöDv‡7“Vf3&††4uWV#%¦Ö3%cµ6¶vS‡T”4t”4vDv‡7“Ve“5g–6ÕgVDS–Õ¦äæÆD3V¦#4#T´…&ö„×Uƒ4æõ•„&ÄÆÓ–Õ¦äæÆD6³u„sFt”4t”4'¦s“$u%f4u&†Dud…¥s—E¥…'–U4””…'–EuSu„sFt”4veg‡U„sFt”4u“#—V35vDtg$4””c“$ÓWU“#—vU6ƒvÇ¤ÆÃ—¦tgu¥3S•vÇ4µ3V¶…§¤ueE“$g5•„–öDv‡7“S6#4§5¤dæ¥•w†ÄµGF6&”t”4'¦”öDv‡7“Ve“5g–6ÕgVDe&†wwU¤vÇ¦DtgU“%eV#ç†Etg•¥uöDtg$6¶u”…¥3„Ô6¶vS‡T”4t”4vDv‡7“Ve“5g–6ÕgVDe&†wwU“#—vU6ƒ•vÇ4µGF6&”t”4t”„æö#5g5¤egu¤tc¥VFÆ##ÆD„£T”CvD„£¥GF6&”t”4#•„sV6&”t”4'¦”ö3&‡fEw†µe„&µ•…&Å#%gf%uc6æ·”‡F6&”t”4t”…&ö„×Uƒ$£w†µTs—¦…'##FôµGF6&”t”4#•„sFt”ƒ6&Ç‡T”4'v6ÖÃ%•…&Ä”c––EvÇ5¤d'f3&Ãs—T´6³d”…§fuvS‡T”4t”c“$ÓWU“#—vU6ƒvÇ¤ÆÃ–¦E„§•¥sSdtg$6·V35f”´…&ö„×Uƒ$ã6ä¦Æ&å%¦Õ§¥¥…ó‡T”4t”tçf&äã”wvu4&fF¤ä$Æ×†Æ&ÖC6w”3†vDv‡7“Ve“5g–6ÕgVDd¦…¤vÃ7§F6&Ç‡T”4t”u§f6”ö$uc”v¶u4t÷”'”Gs””DS$÷”'·—7”‡F6&”t”4t”tçf&äã”…u4ö4d”DS$Æ¤”6öuEtc3U5GF6&Ç‡T”4t”4vDv‡7“Ve•…#6Ä'f7“W¥¥…%•uföö7vtÅS†DvwV3&ÇT´…Ä4EEtc3V¦#4ÖöD6·4”DTÔ6³u„sFt”4t”4#vÇ¤ÆÃ–†D…'•Ts—¤ÆäæÆDf…¥v–w„ç”$”v·4”wvt·”$å•…&ôÆäç&–ƒµ7vuEtc3V¦#4ÖöD6·4”DTÔ6³u„sFt”4t”4#vÇ¤ÆÃ–†D…'•Ts—¤ÆäæÆDf…¥v–w¤ä4$”v·4”3å•…&ôÆäç&–ƒµ7vtÔ3GtÄ4EEtc3V¦#4ÖöD6·ó‡T”4t”4vDv‡7“Ve•…#6Ä'f7“W¥¥…%•uföôåDVt·”'Ä4'4”76uEtc3W¦sFöD6·4”DTÔ7vuEtc3V¦#4ÖöD6·ó‡T”4t”ƒ6&Ç‡T”4t”u§f6”ö$uc”v¶u4t÷”'”Gvt×¤“t”v·$·–¶vS‡T”4t”4u“#—V35vD4””6‡”3†tÕE—TÔ6¶t¶”$å•…&ôÆÄ$¤ó‡T”4t”4vDv‡7“Ve•…#6Ä'f7“W¥¥…%•uföôæ¦vt·”'Ä4tÆ¤4”S†DvwV3&ÇT´…Ä4$å•…&ôÆÔçf7–ƒµ6³u„sFt”4t”4#vÇ¤ÆÃ–†D…'•Ts—¤ÆäæÆDf…¥v–w„ÔDt·”'Ä4'4Ä4$å•…&ôÆäç&–ƒµ7vuEtc3V¦#4ÖöD6·ó‡T”4t”ƒ6&Ç‡T”4t”tçf&äã”…&õ¥…&„”CuEtc3V†DtgTÖ–†fF¤ä$Ææ·4”S†DvwV34g–D6†fF¤ä$Æævt¶”&fF¤ä$Æævt·”&fF¤ä$Ææöt¶”&fF¤ä$Ææ÷µGF6&”t”4&¦##W¦D4'vv¶u4EEtc3V†DtgTÖ–†fF¤ä$Ææ÷4”c“$ÓWVT6³u„sV6&”t”4#vÇ¤Æä§fDtc¥fööDv†ÆDtWó‡T”4t”…&ö„×V6Ó“•…&Åu6‡vv·ó‡T”4t”…&ö„×V3$æ†$uVöDv‡7“Ve“5g–6ÕgVDd¦…¤vÃ7—vvDv‡7“Ve“5g–6ÕgVDd¦…¤vÃ7—vvDv‡7“Ve“5g–6ÕgVDd¦…¤vÃ7–³u„sFt”4vDv‡7“S6ÔgV3'††DuVöDv‡7“Ve“5g–6ÕgVDS–Õ¦äæÆD3SDÄ4#vÇ¤ÆÃ–¦E„§•¥sSC%¦Ö3%cÆæ·4”…&ö„×Uƒ$ã6ä¦Æ&å%¦Õ§¥¥…VV–³u„sV6&”t”4#vÇ¤ÆÃ–†D…'•Ts—¤ÆÓVÅ¥u'¥e„&µ•…&Ä”CvD„£¥GF6&”veg‡U„sFt”„'–…¦†DuVuƒ$£w†µ5sVµ¥†vôµFövFÓ—¤4#u„sFt”4u¦Ó—””6‡5¥…v4””Dt”v¶u4¤äG6v77$µ4#u„sFt”4t”4&¦##W¦D4'Õ4””6‡”76tÕ6¶t¥4¤äGF6&Ç‡T”4t”4vDv‡7“Ve•…#6¶ÇU¤ucDÆäæÆDf…¤´v¶t¶””Ä4'Ä4'Õ6³u„sFt”4t”4#vÇ¤ÆÃ–†D…'•5sVµ¥†wV3%ctf¶ôæ¦vt·”'”6ötÖ—vt×¥t·”'Ä4¤ä4$”v·„µGF6&”t”4#•„sV6&”t”4&Ö#4–t´w†ÆD4'”CtÔG6v4„”D×”÷”'·—7”‡F6&”t”4t”tçf&äã”v·„”Ct´v¶t·”„µ4Ä”D×”ó‡U„sFt”4t”4#vÇ¤ÆÃ–†D…'•5sVµ¥†wV3%ctf¶ôÕDÓ$”76v4”D—4”E“D”76v7vtæ¦vt·”'Õ6³u„sFt”4t”4#vÇ¤ÆÃ–†D…'•5sVµ¥†wV3%ctf¶ôÖ¤t”76v4”D—4”DWtÔ4$”v·4”DWtÔ4$”v·„µGF6&”t”4#•„sV6&”t”4#vÇ¤ÆÃ–†D…'•5sVµ¥†wV&ÕfÅ¤„åf4u&†DuVu4#6åfÄó‡T”4#•„sS•„sF”Ä4–sv#4£”6öu•„ÖudV…5%UVu¦ä§f%4æDv‡•¥uVäó‡Vsv#4£”‡6ufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•S&††4ue$tgU¥4#””u§–##t§“GTÇ“GTÃ¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6Äæõ•„&ÅTw††&ÕVäó‡Vsv#4£”‡6u#—6$vÆµ¥„¥Ftgu¥T£¦Õ¦Æ6¶FÆ##ÆD„£T”ƒu¦ä§f%4äÆ“”F#'‡6u&Æ6Äæõ•„&ÅåfÕ¦Õg•#%gf%uc6æ¶äó‡U„sVÆT„'f6åu“'††34Öu#—6$vÆµ¥„¥Ftgu¥d'5•sVÅåfÕ¦Õg•#%gf%uc6æ¶u¥†ƒ¥sV¶7”%U4d¤e%3T6Eu¦Õ¥„¤…¥s—E¥…'–U4'%„'5¥sÆ&å'¤”Tçf$w‡¤ug•S&††4ud6Eu¦Õ¥„¤…¥s—E¥…'–U4#u„sFt”„#–×‡—”#6#4§5¤dæ¥•w†Ä”CtÕ3Gtó‡U„sFt”„'–…¦†DuVv6Õf…¤s—V$†¶uƒ$cD„¥#4Ód”e$•VµddÆ´£¦Õ¦Æ6´cD„§–åc¥GF6&”v4„§FÔc¥4'•¥tf¶##W6U4&e•…#6¶ÇU¤ucDö”%U4d¤e%3T6Eu¦Õ¥„¤&D…'–t£DuSu„sFt”„'–…¦†DuVv6Õf…¤s—V$†¶uƒ4æõ•„&Äö”%uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„¥Ftgu¥d'5•sVÄó‡T”4'v6ÖÃ%•…&Ä”„¦Å•u'f&×ƒT”c–¦E„§•¥sSC%¦Ö3%c”Cv&Õc4”e$•VµddÆÅ¦Å“5'f6¤ÖôµGF6&”v4„§FÔc¥4'•¥tf¶##W6U4&e“5g–6ÕgVDSWf6Ó†$4””sVÆG”%U4d¤e%3Uu¥tã#4—¤´6³u„sV6&”v4…f–$vÆ¤”tçf&äã6åf¦Ds—”´„æõ•„&Äö”%uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„¥Ftgu¥d'5•sVÄµ4#u„sFt”4v35gu¥„–ôµGF6&Ç‡T”4t”…&ö„×Uƒ4æõ•„&Ä”Cv3&††4uSu„sV6&”t”4#vÇ¤ÆÃ–†D…'•Ts—¤”Cv&Õc4”e$•VµddÆ´£¦Õ¦Æ6´cD„§–åc¥6‡U¥†6u&×‡e•…¤Ö´g–6ÔcT´E–t¶”¤µ7vt×–³u„sFt”4vDv‡7“W¥¥…$&D…'–t£DuVô£4'f3&Ãs—T§—vvDv‡7“Ve•…#6Ä'f7–³u„sV6&”t”4#vÇ¤ÆÃ–†D…'•5sVµ¥†vu4'U¥†6udV…5%UWUåfÕ¦Õg•…#6ÖÆ–E…&Ä´sVÆG”%fsSÕE¤&6ä¦†U6w„Ô6·4”DWó‡T”4t”…&ö„×V3%c5sVµ¥†vöDv‡7“Ve•…#6¶ÇU¤ucDµGF6&Ç‡T”4t”…&ö„×Uƒ$£w†µ5sVµ¥†vôµGF6&”t”4#vÇ¤Æågu¤tc¥6wó‡T”4#•„sV6&”v4…f–$vÆ¤”…gu¤tc¥6wö”#&#&Æ´”‡F6&”t”4'5¥…v3&‡fEw†µe„&µ•…&Å#%gf%uc6æ¶u4&Õ•w‡¥¥GF6&Ç‡T”4t”vÆÔ”6v†Dv‡7“Ve“5g–6ÕgVDS–Õ¦äæÆD3VÆ5…f†$„ÖöDv‡7“Vf3&††4uWV#%¦Ö3%cµ6¶vS‡T”4t”4vDv‡7“Ve“5g–6ÕgVDS–Õ¦äæÆD3V¦#4#T´…&ö„×Uƒ4æõ•„&ÄÆÓ–Õ¦äæÆD6³u„sFt”4t”4'¦s“$u%f4u&†Dud…¥s—E¥…'–U4””…'–EuSu„sFt”4veg‡U„sFt”4vu–t´4cvÇ¤ÆÃ–¦E„§•¥sSFÓ—–%tg4ÆÕg†Etg67–ƒvÇ¤ÆÃ—¦tgu¥3WV#4§E•wwµ4#u„sFt”4t”4#vÇ¤ÆÃ–¦E„§•¥sSFÓ—–%tg4ÆÔçf4†¶öDv‡7“Vf3&††4uWV&Ó—–%tg4µGF6&”t”4t”„æö#5g5¤egu¤tc¥VFÆ##ÆD„£T”CvD„£¥GF6&”t”4#•„sV6&”t”4'¦”ö3&‡fEw†µe„&µ•…&Å#%gf%uc6æ·”‡F6&”t”4t”…&ö„×Uƒ$£w†µTs—¦…'##FôµGF6&”t”4#•„sFt”ƒ6&Ç‡T”4'v6ÖÃ%•…&Ä”c––EvÇ5¤d'f3&Ãs—T´6³d”…§fuvS‡T”4t”…&ö„×Uƒ$cD„¥#4×V3%ctfÆ´D4”3tÆ¥W4”3tÆ¥W4”Dó‡T”4t”…&ö„×Uƒ$cD„¥#4×V3%ctfÆ´DW4”DTå7vtÅDTå7vtÔ6³u„sFt”4vDv‡7“Ve•…#6Ä'f7“W¥¥…%•uföôÖ—vtÔ3CÄ4tÆ¥W4”Dó‡T”4t”…&ö„×Uƒ$cD„¥#4×V3%ctfÆ´D×4”3tÆ¥W4”DTå7vtÔ6³u„sFt”4vDv‡7“Ve•…#6Ä'f7“W¥¥…%•uföôä7vtÔ7vtÔ7vtÔ6³u„sFt”4vDv‡7“Ve•…#6Ä'f7“W¥¥…%•uföôå7vtÔ7vtÔ7vtÔ3G”å6³u„sV6&”t”4#vÇ¤Æå'••sW¦$tc¥6ƒvÇ¤ÆÃ–¦E„§•¥sSC%¦Ö3%cÆæw4”…&ö„×Uƒ$ã6ä¦Æ&å%¦Õ§¥¥…VU7vvDv‡7“Ve“5g–6ÕgVDS–Õ¦äæÆD3SdµGF6&”t”4#vÇ¤Æ×‡f#'D&D6ƒvÇ¤ÆÃ–¦E„§•¥sSFÓ—–%tg4µGF6&Ç‡T”4t”…&ö„×Uƒ$cD„¥#4×V&ÕfÅ¤„åf4u&†DuVu4#6åfÄó‡T”4#•„sV6&”v4„§FÔc¥4&e–åg$u$¦&Õ&ÆT6wö”#&#&Æ´”‡F6&”t”4#vÇ¤ÆÃ–†D…'•5sVµ¥†wV3%ctf¶ôÔ7vtÔ7vtÕ6³u„sFt”4vDv‡7“Ve•…#6¶ÇU¤ucDÆäæÆDf…¤´D—4”DW4”D—ó‡T”4t”…&ö„×Uƒ$cD„¤¦&Õ&ÆT3W¥¥…%•u6sÄ4”Ä4¤µGF6&”t”4#vÇ¤ÆÃ–†D…'•5sVµ¥†wV3%ctf¶ôæ—vt×—vtÔ6³u„sFt”4vDv‡7“Ve•…#6¶ÇU¤ucDÆäæÆDf…¤´Fw4”E4”EWó‡U„sFt”4vDv‡7“Ve•…#6¶ÇU¤ucDÆÓVÅ¥u'¥e„&µ•…&Ä”CvD„£¥GF6&”veg‡Veg‡T–—vt–ÖÇF4s—–D4”tg¤”e$•Vµdd”u§–##t£5&ö6ÕfÄ§§F6&ÖÇF4s—–D4#t”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6Äæõ•„&ÅS4&õ¥„¦Ä”ƒu¦ä§f%4äÆ“GdÆ“GefÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•S&††4ueF4v†Æ6ÕVäó‡Vsv#4£”‡6u#—6$vÆµ¥„¥Ftgu¥T£¦Õ¦Æ6¶FÆ##ÆD„£T”ƒu¦ä§f%4äÆ“”F#'‡6u&Æ6Äæõ•„&ÅåfÕ¦Õg•#%gf%uc6æ¶äó‡U„sVÆT„'f6åu“'††34Öu#—6$vÆµ¥„¥Ftgu¥dçvug•¥T£¦Õ¦Æ6¶FÆ##ÆD„£T”ucFDugU¤„ÖudV…5%UWUåfÕ¦Õg•#%gf%uc6æ¶vsv$ugE¥sS7”$F#'‡6u&Æ6Äæõ•„&ÅåfÕ¦Õg•#%gf%uc6æ¶vS‡T”4'vEt§6tÖvC#—–$u%E“$g5¥4””DWTÔGF6&Ç‡T”4'v6ÖÃ%•…&Ä”„¦Å•u'f&×ƒT”c–†D…'•Ts—¤ö”%U4d¤e%3T6Eu¦Õ¥„¤&D…'–t£DuSu„sFt”„'–…¦†DuVv6Õf…¤s—V$†¶uƒ$cD„¤¦&Õ&ÆTFöudV…5%UWUåfÕ¦Õg•…#6ÖÆ–E…&Äó‡T”4'v6ÖÃ%•…&Ä”„¦Å•u'f&×ƒT”c—¦tgu¥FöufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•S&††4ueF4v†Æ6ÕSu„sFt”„'–…¦†DuVuƒ$ã6ä¦Æ&å%5•u'E„Öu4tó‡T”4'v6ÖÃ%•…&Ä”„¦Å•u'f&×ƒT”c–¦E„§•¥sSC%¦Ö3%c”Cv&Õc4”e$•VµddÆÅ¦Å“5'f6¤ÖôµGF6&Ç‡T”4'vEt§6tÖu“#—V35'–Etã#4–ö3&††4uSd”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6Äæõ•„&ÅS4&õ¥„¦Äµ4#u„sFt”4v35gu¥„–ôµGF6&Ç‡T”4t”…&ö„×Uƒ4æõ•„&Ä”Cv3&††4uSu„sV6&”t”4#vÇ¤ÆÃ–†D…'•Ts—¤”Cv&Õc4”e$•VµddÆ´£¦Õ¦Æ6´cD„§–åc¥6‡U¥†6u&×‡e•…¤Ö´g–6ÔcT´D×””6öt×””D×Ä4¤µGF6&”t”4#vÇ¤ÆäæÆDTcD„§–åc¥6væ4s—¦…'##FäÄ4#vÇ¤ÆÃ–†D…'•Ts—¤µGF6&Ç‡T”4t”…&ö„×Uƒ$cD„¤¦&Õ&ÆT4””sVÆG”%U4d¤e%3T6Eu¦Õ¥„¤&D…'–t£DuVö&Õc4”eg&å„æ´g–6ÔcT´E“”6öt×–·4”DWó‡T”4t”…&ö„×V3%c5sVµ¥†vöDv‡7“Ve•…#6¶ÇU¤ucDµGF6&Ç‡T”4t”…&ö„×Uƒ$£w†µ5sVµ¥†vôµGF6&”t”4#vÇ¤Æågu¤tc¥6wó‡T”4#•„sV6&”v4…f–$vÆ¤”…gu¤tc¥6wö”#&#&Æ´”‡F6&”t”4'5¥…v3&‡fEw†µe„&µ•…&Å#%gf%uc6æ¶u4&Õ•w‡¥¥GF6&Ç‡T”4t”tçf&äã”„¦…¤vÃ7”””…&ö„×Uƒ4æõ•„&ÄÆä¦…¤vÃ7”d”…&ö„×VC#—–$u%E“$g5¥GF6&”t”4'¦”öDv‡7“Ve“5g–6ÕgVDd¦…¤vÃ7”…Cv6Ôf¶…g¤µ4#u„sFt”4t”4#vÇ¤ÆÃ–¦E„§•¥sSVÔf¶…g¤”Cv6Ôf¶…g¤ó‡T”4t”4v3&‡fEw†µe„&µ•…&Å#%gf%uc6æ¶u4#6åfÄó‡T”4t”ƒ6&Ç‡T”4t”vÆÔ”6v†Dv‡7“Ve“5g–6ÕgVDS–Õ¦äæÆD3VÆ5…f†$„ÖöDv‡7“Vf3&††4uWV#%¦Ö3%cµ6¶vS‡T”4t”4vDv‡7“Ve“5g–6ÕgVDS–Õ¦äæÆD3V¦#4#T´…&ö„×Uƒ4æõ•„&ÄÆÓ–Õ¦äæÆD6³u„sFt”4t”4'¦s“$u%f4u&†Dud…¥s—E¥…'–U4””…'–EuSu„sFt”4veg‡U„sFt”4vu–t´„æö#5g5¤egu¤tc¥VFÆ##ÆD„£Tµ4#u„sFt”4t”4#vÇ¤ÆÃ––EvÇ5¤d'f3&Ãs—T´6³u„sFt”4veg‡T”4#•„sV6&”v4„§FÔc¥4&e–åg$u%#4çDvÇf&–wö”#&#&Æ´”‡F6&”t”4&Ö#4–t´w†ÆD4'”CtÔG6v4„”D×”÷”'·—7”‡F6&”t”4t”tçf&äã”…u4ö4d”DS$Æ¤”6öuEtc3U5GF6&Ç‡T”4t”4vDv‡7“Ve•…#6Ä'f7“W¥¥…%•uföö7vuEtc3V¦#4ÖöD6·4”S†DvwV3&ÇT´…Ä4tÆ¤ó‡T”4t”4vDv‡7“Ve•…#6Ä'f7“W¥¥…%•uföô×¤–t·”'Ä4tÆ¤4”S†DvwU“#—¤´…Ä4$å•…&ôÆäç&–ƒµ6³u„sFt”4t”4#vÇ¤ÆÃ–†D…'•Ts—¤ÆäæÆDf…¥v–s$ä4$”v·4”S†DvwV3&ÇT´…Ä4tÆ¤4”S†DvwU“#—¤´…µGF6&”t”4#•„sV6&”t”4#vÇ¤Æäæ¥•w†Ä´…&ö„×Uƒ$ã6ä¦Æ&å%5•u'E„×4”…&ö„×Uƒ$ã6ä¦Æ&å%5•u'E„×4”…&ö„×Uƒ$ã6ä¦Æ&å%5•u'E„×ó‡T”4t”…&ö„×VD„¦†&äç5•…&Ä´…&ö„×Uƒ$ã6ä¦Æ&å%¦Õ§¥¥…VT7vvDv‡7“Ve“5g–6ÕgVDS–Õ¦äæÆD3STÄ4#vÇ¤ÆÃ–¦E„§•¥sSC%¦Ö3%cÆæ÷ó‡U„sFt”4vDv‡7“Ve•…#6Ä'f7“WU¥uf¶3gu¤tc¥4””…'–EuSu„sFt”ƒ6&Ç‡T”4'v6ÖÃ%•…&Ä”c––EvÇ5¤VÇU¤ucD´6³d”…§fuvS‡T”4t”u§f6”ö$uc”v¶u4t÷”'”Gvt×¤“t”v·$·–¶vS‡T”4t”4u“#—V35vDVu4ö4$”DW”5Vt×¤“u„sV6&”t”4t”…&ö„×Uƒ$cD„¤¦&Õ&ÆT3W¥¥…%•u6‡”6ötÖ—vv7vvDWó‡T”4t”4vDv‡7“Ve•…#6¶ÇU¤ucDÆäæÆDf…¤´E“”76v4”D—4”D×””76v7vt×¤–t·”'Õ6³u„sFt”4t”4#vÇ¤ÆÃ–†D…'•5sVµ¥†wV3%ctf¶ôÕD“D”76v4”D—4”E“”76v7vtæ¥t·”'Õ6³u„sFt”4veg‡U„sFt”4vDv‡7“Ve•…#6¶ÇU¤ucDÆÓVÅ¥u'¥e„&µ•…&Ä”CvD„£¥GF6&”veg‡Veg‡T–—vt–ÖÇF4s—–D4”tg¤”e$•Vµdd”u§–##t£5&ö6ÕfÄ§§F6&ÖÇF4s—–D4#t”e¥5Edçv6ÖÇU£§f&Õd¶#&ÇVD4#””u§–##t§“GTÃ¥5Edçv6ÖÇU£§f&Õd¶#&ÇVD63u„sW%„'f6åvW”%F4„§&ÖD6##VÅåfÕ¦Õg•#%gf%uc6æ¶ve4&Ö6Ó—D”67TÃ5cw‡¤Ãçv6ÖÇU£§f&Õd6Eu¦Õ¥„¤…¥s—E¥…'–U63u„sV6&Ôçf&äã”c“$ÓVu4'U¥†6udV…5%UWUfÕf¦Ds—”×–wó‡U„sVÆT„'f6åu“'††34ÖufÄ¤åS4'–sVåÓ—U¥WfsS4ug64ug””ucFDugU¤„ÖudV…5%UWU#4§fE„vS‡T”4'vEt§6tÖv6Õf…¤s—V$†¶v34'–sVåÓ—U¥FöufÄ¤åS4'–sVåÓ—U¥WfsSó‡T”4'v6ÖÃ%•…&Ä”„¦Å•u'f&×ƒT”c–å¥s—E¥…'–UFöuS4'–sVåÓ—U¥T£¦Õ¦Æ6¶FÆ##ÆD„£Tó‡T”4'v6ÖÃ%•…&Ä”„¦Å•u'f&×ƒT”c—6sVÄö”%U4d¤e%3TÖsVÅS%fæ%ugVD„Óu„sV6&”v4…f–$vÆ¤”tçf&äã6åf¦Ds—”´„çv6ÖÇU£§f&ÕSd”e¥5Edçv6ÖÇU£§f&Õd¶#&ÇVD6¶vS‡T”4t”„ã4ug”´6³u„sFt”4vDv‡7“WE•…'–†„&E…'ee„&µ•…&Ä”Cu¦Ôg63%Su„sV6&”t”4#vÇ¤Æäçv6ÖÇU£§f&ÕVu4'¦4„§&ÖD6##VÄó‡U„sFt”4vDv‡7“Ve£%gf%uc6æ¶u4'U¥†6uS4'–sVåÓ—U¥T£¦Õ¦Æ6¶FÆ##ÆD„£T´…&ö„×V34'–sVåÓ—U¥6³u„sV6&”t”4&¦##W¦D4'E•…&Æ6ÖÆ†$4””sVÆG”%U4d¤e%3TÖsVÅÔg¦täå•…&Æ6ÖÆ†$6ƒu„sFt”4t”4&¦#'‡f6¦ötÔ††Õ¦Õ¦ÔÔD5„sFt”4t”4&µ¥„#e&Æ35d”u¦†$„æÄÄg‡T”4t”4u¤ugvDv…†6ÖÃ¥Föu¦Ôg63%W5„sFt”4ve6³u„sV6&”t”4#vÇ¤ÆÃ—6sVÄ”Cv&Õc4”e$•VµddÆ·‡&ÕeE¥vGE¥sS7–ƒvÇ¤ÆÃ–å¥s—E¥…'–U7vv%tc¥„§•wwó‡T”4t”…&ö„×U•u&´´…&ö„×Uƒ'‡&ÕWó‡T”4#•„sV6&”v4…f–$vÆ¤”u'34'f3%VôµFövFÓ—¤4#u„sFt”4vDv‡7“Ve£%gf%uc6æ·U¤vÇ¦4s—¥¥6wó‡T”4#•„sV6&”v4…f–$vÆ¤”…gu¤tc¥S†D„§TfGf6×†´´u§f6ÔæÄö”&–##—5¥tgTµFövFÓ—¤4#u„sFt”4vDv‡7“W¦4„§&ÖD6##VÄÆÔ§f&ÕWVE„&µ•…&Åc#—–$u$å•…'–†vöD„£¥7vu¦Ôg63%Wó‡U„sFt”4vDv‡7“WE•…'–†wU“#—vU6ƒvÇ¤Æäçv6ÖÇU£§f&ÕWU–Ó—U¥3WE•…'–†…†#4§5¤6³u„sV6&”t”4&¦##W¦D4'E•…'–†…†#4§5¤Ug5¥sÆ&å'¤”CvDv‡7“WE•…'–†wU¥w†Æ%ugVD„Óu„sFt”4vDv‡7“Ve£%gf%uc6æ·VC#—–$u%E“$g5¥4””c“$Óf6&”t”4t”3W¥¥…ö%tc6ÖÃEc#—–$u$f$ugE¥sS37u…7vv%tc6ÖÃEc#—–$u$f$ugE¥sS37……7vv%tc6ÖÃEc#—–$u$f$ugE¥sS37•…6Æ6&”t”4t”3W5¥sVæDvvôµG6tÇ“†u“$g5“5g5•…&Ä”„æ¥•w†Ä”s–Ô”†vu“#—F4s—U¥sS„sV6&”t”4#vÇ¤ÆÃ–å¥s—E¥…'–U3S4u&†DuVôµGF6&Ç‡T”4t”„ã4ug”Æågu¤tc¥S†D„§TfGf6×†´´u§f6ÔæÄµGF6&”veg‡Veg‡T–—vt–ÖÇF4s—–D4”tg¤”e$•Vµdd”u§–##t£5&ö6ÕfÄ§§F6&ÖÇF4s—–D4#t”e¥5Edçv6ÖÇU£§f&Õd¶#&ÇVD4#””u§–##t§“GTÇ“GTÃ¥5Edçv6ÖÇU£§f&Õd¶#&ÇVD63u„sV6&ÕcF4s—–D4&¦$tg¦7”%F4„§&ÖD6##VÅåfÕ¦Õg•#%gf%uc6æ¶u¥†ƒ¥sV¶7”%U4d¤e%3T6Eu¦Õ¥„¤…¥s—E¥…'–U4#u„sFt”„#–×‡—”#6#4§5¤dæ¥•w†Ä”CtÕ3Gtó‡U„sFt”„'–…¦†DuVv6Õf…¤s—V$†¶uƒ$cD„¥#4Ód”e$•VµddÆ´£¦Õ¦Æ6´cD„§–åc¥GF6&”v4„§FÔc¥4'•¥tf¶##W6U4&e•…#6¶ÇU¤ucDö”%U4d¤e%3T6Eu¦Õ¥„¤&D…'–t£DuSu„sFt”„'–…¦†DuVv6Õf…¤s—V$†¶uƒ4çv6ÖÇU£§f&ÕSd”e¥5Edçv6ÖÇU£§f&Õd¶#&ÇVDGF6&”v4„§FÔc¥4&e“5g–6ÕgVDd¦…¤vÃ7”””Du„sFt”„'–…¦†DuVv6Õf…¤s—V$†¶uƒ$ã6ä¦Æ&å%U•vÇ4”Cv&Õc4”e$•VµddÆÅ¦Å“5'f6¤ÖôµGF6&Ç‡T”4'vEt§6tÖu“#—V35'–Etã#4–ö34'–sVåÓ—U¥FöufÄ¤åS4'–sVåÓ—U¥WfsSµ4#u„sFt”4v35gu¥„–ôµGF6&Ç‡T”4t”…&ö„×Uƒ4çv6ÖÇU£§f&ÕVu4'¦4„§&ÖD6##VÄó‡U„sFt”4vDv‡7“Ve•…#6Ä'f7”””sVÆG”%U4d¤e%3T6Eu¦Õ¥„¤&D…'–t£DuVö&Õc4”U§6#$c×¤¤&6ä¦†U6w”õEÄ4¤µGF6&”t”4#vÇ¤ÆäæÆDTcD„§–åc¥6væ4s—¦…'##FäÄ4#vÇ¤ÆÃ–†D…'•Ts—¤µGF6&Ç‡T”4t”…&ö„×Uƒ$cD„¤¦&Õ&ÆT4””sVÆG”%U4d¤e%3T6Eu¦Õ¥„¤&D…'–t£DuVö&Õc4”eg&å„æ´g–6ÔcT´DSTä6·4”DWó‡T”4t”…&ö„×V3%c5sVµ¥†vöDv‡7“Ve•…#6¶ÇU¤ucDµGF6&Ç‡T”4t”…&ö„×Uƒ$£w†µ5sVµ¥†vôµGF6&”t”4#vÇ¤Æågu¤tc¥6wó‡T”4#•„sV6&”v4…f–$vÆ¤”…gu¤tc¥6wö”#&#&Æ´”‡F6&”t”4'5¥…v3&‡fEw†µe„&µ•…&Å#%gf%uc6æ¶u4&Õ•w‡¥¥GF6&Ç‡T”4t”tçf&äã”„¦…¤vÃ7”””…&ö„×Uƒ4çv6ÖÇU£§f&ÕWV3%cDvÇU£4×VvÃVÔf¶…g¤”3†vDv‡7“S6#4§5¤dæ¥•w†Äó‡T”4t”vÆÔ”6ƒvÇ¤ÆÃ–¦E„§•¥sSVÔf¶…g¤”4S•4'••u'E„×”‡F6&”t”4t”…&ö„×Uƒ$ã6ä¦Æ&å%5•u'E„Öu4'••u'E„Óu„sFt”4t”4'¦s“$u%f4u&†Dud…¥s—E¥…'–U4””…'–EuSu„sFt”4veg‡U„sFt”4vu–t´4cvÇ¤ÆÃ–¦E„§•¥sSdtg$3VÆ5…f†$„ÖöDv‡7“Vf34'–sVåÓ—U¥3W&ÖÃtg5Ds–¥•w„FvÇ5¤d'f3&Ãs—Tµ6¶vS‡T”4t”4vDv‡7“Ve“5g–6ÕgVDe&†wwU“#—vU6ƒvÇ¤ÆÃ—¦4„§&ÖD6##VÄÆÖÇV…'•w„Ö#$æ†$Tæöw†µTs—¦…'##Gó‡T”4t”4v3&‡fEw†µe„&µ•…&Å#%gf%uc6æ¶u4#6åfÄó‡T”4t”ƒ6&Ç‡T”4t”vÆÔ”6‡¦s“$u%f4u&†Dud…¥s—E¥…'–U6¶vS‡T”4t”4vDv‡7“Ve–åg$u%#4çDvÇf&–wó‡T”4t”ƒ6&”veg‡U„sFt”„'–…¦†DuVuƒ$£w†µTs—¦…'##FôµFövFÓ—¤4#u„sFt”4u¦Ó—””6‡5¥…v4””Dt”v¶u4¤Ö§6v77$µ4#u„sFt”4t”4&¦##W¦D4#”Ct´v¶tÇ”„æ“Gtµ4”S†DvwUTV³u„sV6&”t”4t”…&ö„×Uƒ$cD„¥#4×V3%ctfÆ´v·4”S†DvwU“#—¤´…Ä4$å•…&ôÆäç&–ƒµ7vtÔ3GtµGF6&”t”4t”…&ö„×Uƒ$cD„¥#4×V3%ctfÆ´D×””76v7vtÔ3GtÄ4$å•…&ôÆÔçf7–ƒµ7vuEtc3W¦sFöD6·ó‡T”4t”4vDv‡7“Ve•…#6Ä'f7“W¥¥…%•uföôæ¥t·”'Ä4$å•…&ôÆäç&–ƒµ7vtÔ3GtÄ4$å•…&ôÆÔçf7–ƒµ6³u„sFt”4veg‡U„sFt”4vDv‡7“W¥“$g5¥6ƒvÇ¤ÆÃ–¦E„§•¥sSVÔf¶…g¤Ä4#vÇ¤ÆÃ–¦E„§•¥sSVÔf¶…g¤Ä4#vÇ¤ÆÃ–¦E„§•¥sSVÔf¶…g¤µGF6&”t”4#vÇ¤Æå'••sW¦$tc¥6ƒvÇ¤ÆÃ–¦E„§•¥sSdtg$3SDÄ4#vÇ¤ÆÃ–¦E„§•¥sSdtg$3STÄ4#vÇ¤ÆÃ–¦E„§•¥sSdtg$3SdµGF6&Ç‡T”4t”…&ö„×Uƒ$cD„¥#4×V3%ctfÆ´F³$Ä4tÄ4tÄ4tµGF6&”t”4#vÇ¤ÆÃ–†D…'•Ts—¤ÆäæÆDf…¥v–sTç—vvDv‡7“Ve“5g–6ÕgVDe&†wwVT7vvDv‡7“Ve“5g–6ÕgVDe&†wwVU7vvDv‡7“Ve“5g–6ÕgVDe&†wwVV–³u„sV6&”t”4#vÇ¤ÆÃ–†D…'•Ts—¤ÆÓVÅ¥u'¥e„&µ•…&Ä”CvD„£¥GF6&”veg‡U„sFt”„'–…¦†DuVuƒ$£w†µ5sVµ¥†vôµFövFÓ—¤4#u„sFt”4u¦Ó—””6‡5¥…v4””Dt”v¶u4¤Ö§6v77$µ4#u„sFt”4t”4&¦##W¦D4'Õ4””6‡”76tÕ6¶t¥4¤Ö§F6&Ç‡T”4t”4vDv‡7“Ve•…#6¶ÇU¤ucDÆäæÆDf…¤´v¶t¶””Ä4'Ä4'Õ6³u„sFt”4t”4#vÇ¤ÆÃ–†D…'•5sVµ¥†wV3%ctf¶ôæ¥t·”'”6ötÖ—vt×¤–t·”'Ä4¤Ö”$”v·„µGF6&”t”4t”…&ö„×Uƒ$cD„¤¦&Õ&ÆT3W¥¥…%•u6w„Ö¦vt·”'”6ötÖ—vtæ¥t·”'Ä4$ä4$”v·„µGF6&”t”4#•„sFt”4vDv‡7“Ve•…#6¶ÇU¤ucDÆäæÆDf…¤´DSTÖ—vtõE—4”F³4µGF6&Ç‡T”4t”…&ö„×Uƒ$cD„¤¦&Õ&ÆT3WU¥uf¶3gu¤tc¥4””…'–EuSu„sFt”ƒ6&ã6&”—4”4§%„'f6åt¶”&†7”%U4d¤e%4&Ö6Ó—D”6C„¦Å¥63u„sW%„'f6åvD†Çu¥4#t”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6Äæõ•„&Ä”ƒu¦ä§f%4äÆ“•uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„¥Ftgu¥63u„sV6&“‡¶Ç‡T”6öuVÕgv6Õg¥¥sS7”&„”tçf$w‡¤ug””s–Ô”tVv34'–sVä”t§f&ÕWU„sFt¶“–6&ÕcF4s—–D4&¦$tg¦7”%uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„–u¥†ƒ¥sV¶7”%U4d¤e%3U–×Å“5¥$4#u„sFt”3‡¶Ç‡T”4t¶”%VuVv3&††4uVv#%–vDv†Ä”tçf$w‡¤ug”ÆÇ‡T”4t¶“–6&”v4…f–$vÆ¤”„¦Å•u'f&×ƒT”„æõ•„&Äö”%uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„¥Ftgu¥GF6&Ç‡T”4d¶—6&”t”6öuc#—–$uv34&…“%Vv%tc6ÖÃD”u§f6”#uVu“#—6$vÆµ¥„–v3&††4uVvE„æÅ¤4'&”&¦#'‡6„ç##Fu“$g5“5g5•…'##W¤ÆÇ‡T”4t¶“–6&”v4…f–$vÆ¤”„¦Å•u'f&×ƒT”tçf$w‡¤ug•Etc6ÖÃD”Cv&Õc4”e$•VµddÆ³†D„§TEôµGF6&Ç‡T”4'vEt§6tÖu“#—V35'–Etã#4–ö3&††4uSd”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6Äæõ•„&Äµ4#u„sFt”4v35gu¥„–ôµGF6&Ç‡T”4t”…&ö„×V3&††4uVu4'¦tgu¥GF6&”veg‡U„sFt”„#–×‡—”#4u&†Due†#4§5¤S†D„§T6ƒ4u&†Due•„¦Æ&å'¤ö”&–##—5¥tgTÄ4#4u&†DudFvÇ5¤„¦Æ&¦öu–Ó—f$uf†&–³d”…§fuvS‡T”4t”„ã4ug”Æågu¤tc¥fGf6×†µEtc6ÖÃD´…gu¤tc¥d&†6ÕgVD„×4”…gu¤tc¥Tæöw†¶6ÕgTµGF6&Ç‡T”4t”…gu¤tc¥Tçf$w‡¤ug•Etc6ÖÃD´…&ö„×U“#—6$vÆµ¥„¤å•…'–†w4”…&ö„×V%tc6ÖÃEc#—–$u4”…&ö„×V3&††4uWV#%¦Ö3%cµGF6&”veg‡Veg‡U„sGd¶—6&””Tçf%„#Dug¤”…&õ¥4&¦#'‡6u&Æ6³†D„§T4&••„æÅ¤4'f&”&†&”'e¦Õ§¥¥…u•sV´”tVvC#—–$uv%tc6ÖÃDÆÇ‡T”6öu%„c…¦†$ugVD4#'”#uVu¦Ó—6$s“6sVä”tçe¤uVvC&†Æ&”'E•…'–†…†#4§5¤4'7”&†&”&…¦Õ§&ÕVv%tc6ÖÃDöÇ‡T”6öu”t&väæ6&””s“D3WE•wFÅd„¦†&äç5•…'##Fö#%¦Ö3%cµ3Wv6ÕgFEwƒ„'6U6‡E•…'–†…†#4§5¤6Æ6&””t&u”g‡T”76&””T'u•„¦†%4&¦#'‡6u&Æ6³†D„§T4%VuVvDtg•£%c”s†D„§T4#'”'¦Ds—•¥4#uVv6Õg¦Ewƒ”vÇTÆÇ‡T”6öu„&†6ÔgD”s†D„§TfGf6×†´”e&õ¥4#6#4§5¤4'E•…'–†vu¦Ó†vDv†Ä”tçf$w‡¤ug””s––Õf¦D3V6&””T'u•„¦†%4'e¦Õ§¥¥…uC4#s—U•wvv#%¦Ö3%c”…'d”…&õ¥4&¦#'‡6u&Æ6”'¦tgu¥3V6&”Ã‡U¦ågU“5'##FvE„&µ•…&Å#—6$vÆµ¥„¤å•…'–†võ“#—6$vÆµ¥„¤å•…'–†sd”e$•VµddÆ³†D„§TE4”s†D„§TfGf6×†´ö”%U4d¤e%3Tå•…'–†sÄ4'e¦Õ§¥¥…ôö”%U4d¤e%3Uu¥tã#4—¤µ4#u„sFt”tçf&äã”sÄ”Cv%tc6ÖÃEc#—–$uU¥w†Æ%ugVD„Óu„sV6&”u“#—6$vÆµ¥„¤å•…'–†wU“#—vU6‡E•…'–†…†#4§5¤6³u„sV6&”vu–t´s–Õ¦äæÆD6¶vS‡T”4t”tçf$w‡¤ug•Etc6ÖÃDÆÕg5¥sÆ&å'¥w¤W•…4””sÅw¤&D”6öv#%¦Ö3%cÆævt·”'E¥g3…4”s–Õ¦äæÆD3ST”76v%uf$ôct¶”'e¦Õ§¥¥…VV”$”sÅw¤W•…GF6&”t”4&¦#'‡6u&Æ6³†D„§T3VÆ$ugE¥sS37„Óu4'E¥g7……4”s–Õ¦äæÆD3SD”76v%uf$åct¶”'e¦Õ§¥¥…VU4$”sÅw¦ÆD”6öv#%¦Ö3%cÆæöt·”'E¥g7„Óu„sFt”4u“#—6$vÆµ¥„¤å•…'–†wU¥w†Æ%ugVD„æ$ÕE&D”Cv%uf$ÖÃt¶”'e¦Õ§¥¥…VT4$”sÅw¥¦D”6öv#%¦Ö3%cÆæ¶t·”'E¥g7„Ôct¶”'e¦Õ§¥¥…VV”$”sÅw¤S…GF6&”veg‡Veg‡T–—vt–ÖÇF4s—–D4”tg¤”e$•Vµdd”u§–##t£5&ö6ÕfÄ§§F6&ÖÇF4s—–D4#t”S†D„§TE$¦&å¦Æ6äæÅ$f¦uVve4&Ö6Ó—D”67TÃ5cw‡¤Ã†D„§TE$¦&å¦Æ6äæÅ$f¦uVäó‡Vsv#4£”…#V4uVvW”%uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„¤†6Ó“44#””u§–##t§“GefÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•#4§fE„äó‡Vsv#4£”…#V4uVvW”%uV³F4„§&ÖD6##VÅ6Ó—&å%E¥…#sVæ7”#””u§–##t§“GefÄ¤åS4'–sVåÓ—U¥WfsSS%cDvÇU£4Öäó‡TÇ“†u¥„ç6sSÅu'3$f–$uWF&ÕcFD36sVÄ”T#U„&Æ3$ç–„#Åug¦$vÇVD3—V'“&åg¥¥uFFÔg–3‡Vsv#4£”…#V4uVvW”%uV³F4„§&ÖD6##VÅEtgU•vFÆ6”#””u§–##t§“GefÄ¤åS4'–sVåÓ—U¥S†&Ôfå¥„–äó‡U„sGdÇ”&••„æÅ¤4'f&Ç‡TÇ“†v…#4F÷dÃ4§e“'FÆDw%„V3'G”Æ×tÃ5gV…#TÓ%dÕDTÃ‡TÇ“†v…#4„ÓdÇ“–æ…&öEt—U“#—DÃ%#5•sVæ'“•f&ÖÅuV³e–×‡e–“—E•„ã¥„—eS$ç–„#7“•F4„§&ÖD6##VÄÃ¥5Edçv6ÖÇU£§f&ÕWU“4æ6&Ç‡U“#—V35u5U$eFÅ$¥dfÆeETeUV¶Å”ä4””sVÆG”%U4d¤e%3Tå•…'–†s´6³u„sV6&“‡d”gƒôTWtôgƒã“TãƒäUW•$gƒ×¤%%gƒäUWtÔgƒæ¥“ÖÇƒäU¤U$gƒåT“ôgƒç¥W”ôgƒåF·tõgƒæ¥S4Ôgƒ&µ—tôgƒäUWtÔgƒåUd$æÇƒ×¤$$ägƒ×¤$tÓƒ×¤$4õgƒ×¤$5&Çƒ×¤$tÓƒ×¤$4õgƒ×¤TÖÇƒäU“ƒ×¤$Óƒ×¤&Çƒ×¤Dõgƒ×¤ÖÇƒ×¤$ôgƒ×¤%&ÇƒäU“5&Çƒ×¤ägƒåE¤U%gƒ×¤õgƒ&µ—tõg‡U“#—V35uƒ5—¥4””sVÆG”%U4d¤e%3Uu¥tã#4—¤´6³u„sV¦##W¦D4&fF¤ä4”Cv&Õc4”e$•VµddÆÅ¦Å“5'f6¤ÖôµGF6&Ç‡TÇ–÷„sFt¶”$$”…&Æ%„'f6Ôg–U4#%•„§•t§5¥4#6vÆ¦4'7”#3%f´”vÇT”t#4u&†Dufu„sFt¶“–6&Ôçf&äã”c“6#4§5¤dçu•tæÅTs—¦…'##Fu4'U¥†6udV…5%UWUfÕf¦Ds—”×–wó‡U„sGd¶—6&””TVvDugF4s—••„£T”…¦†6ÖÆ…–×†Ä”†Fötæô”vÇ¤”…g¥¥uvsFu”…gu¤tc¥t&6&”Ã‡U“#—V35uƒ#VÆT…%U•vÇ4”Cv&Õc4”e$•VµddÆÅ¦Å“5'f6¤ÖôµGF6&Ç‡U“#—V35uƒ#†DTVu4'U¥†6udV…5%UWUEtc6ÖÃDä6wó‡U„sGd¶—6&””TVu“'††34Öv6Õgv6Õg¥¥sS7”&„”„ç&ÖG5¥4'#&ÇVD4'e¦”&„”„çv6ÖÇU§”&–##VÄÆÇ‡T”6öu5…v3&‡fEw†´”t¦Ä”s†&Ôfå¥uu–æ¶u•4#uw‡&×6ufÄ¤åS4'–sVåÓ—U¥S†&Ôfå¥„£”ÆÇ‡T”6÷e„sVÆT„'f6åu“'††34ÖufÄ¤åS4'–sVåÓ—U¥WfsS”‡F6&”tÇ–÷„sFt”4”dæÆD…'&ÖG¤”s–Ô”…&õ¥4&–##VÄÆÇ‡T”4t¶“–6&”v4…f–$vÆ¤”„æÆD…'&ÖG¤ö”%uV³F4„§&ÖD6##VÅ6Ó—&å%E¥…#sVæ7§F6&Ç‡T”4d¶—6&”t”6öu#—6$vÆµ¥„–u£4§fE„'¤”tcDtf¦uf´”…'d”…&ö„Öu–Ó—U¥3V6&”t”6÷e„sFt”„#–×‡—”&¦#'‡6u&Æ6¶G–#5gv7¦öufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•#4§fE„&%…GF6&Ç‡T”4d¶—6&”t”6öusFuC$§¥tãÓu•…#•tæõ¥uvDs†vDv‡7”&–##VÄÆÇ‡T”4t¶“–6&”v4…f–$vÆ¤”„¦Å•u'f&×ƒT”t§f&ÕSd”e$•VµddÆ³––Õf¦DDäTó‡U„sFt”3‡¶Ç‡T”4t¶”$&&”%–×Å“5¥$4#tc”†G$wvu–ÕVvE„æÅ¤4&†7”&„”…&†wvv#%–vDv‡7”'¦4„§&Ö6u–Ó—U¥3V6&”t”6öu5…u“$gT”t¦Ä”sS$wvvC&†Æ&”#uVv34'–sVä”t§f&ÕVv„Övsv#4£¥uu¦ä§f%4%uV³tÔ3GtÆÇ‡T”4t¶“–6&”v4…f–$vÆ¤”„¦Å•u'f&×ƒT”tæöw†´ö”%U4d¤e%3U–×Å“5¥$4#„”sS$wsu„sV6&”tÇ–÷„sFt”4”Tã6ä¦Æ&åv4s—¦…'##Fv#%–u“&‡$uvDtg$7vvsFu“%gVDug””…gV…T”fG$wvu–ÕVvE„æÅ¤4&Ö#4–vFÕg–$uc”vÇVDufæ6Ôcs—TÆÇ‡T”4t¶“–6&”v4„§FÔc¥4&e“5g–6ÕgVDe&†wvu4'U¥†6udV…5%UWUfÕf¦Ds—”×–wó‡U„sFt”3‡¶Ç‡T”4t¶”%6Õc&s“7”'v#4çDvÇf&”'e¦”&¦vÇ5¤4#•vÇ4Ä4'&”&¥¥sS¥„–vEsWD3Fuc&Ç6$4&•¥4#3%f´”u§f6”#%¥„§5¥…vsS¥vG••…'##GU„sFt”4Ã‡T”4'v6ÖÃ%•…&Ä”c—v6Õc%dtg$4””sVÆG”%U4d¤e%3Uu¥tã#4—¤´6³u„sV6&”tÇ–÷„sFt”4”VÇV…'•wvu•†‡7”'e¦”#uVu–Ó—U¥7vvsFv$s–¥•wvvEsWD3V6&”t”6÷e„sFt”„'–…¦†DuVuƒ$§f&Õd&TvÇ¤”Cv&Õc4”e$•VµddÆÅ¦Å“5'f6¤ÖôµGF6&Ç‡T”4d¶—6&”t”6öuDugU£5&ô”s–Ô”…&õ¥4&–##VÄ”vÇT”†Gf6×†´”…gV…U„sFt”4”fG$wvu–ÕVvE„æÅ¤4&Ö#4–v&Ó—–%tg6‡†DvÇf&”'&”#4u&†DuVv$s—f47vvC&Ç6$4&•¥4#4u&†Duf´”t£T”‡D$vÇV”&e“$g5“Gf6×†µS4&…“%d6##VÅDugU£5&öe3V6&”t”76&”t”6öu5…æ7”'¥•sÄ”tg¤”w‡e“$g4”…gV…v$ugU£5&ô”…gV$ug¦7”#ug•¥4&†6ÕVv3$æ†$uVvD„¦†&äæÖ#4§E•…'##W¤”vÇT”…&õ¥4#6#4§5¤4'¦4tf¥¥3V6&”t”6÷e„sFt”„'–…¦†DuVuƒ6Gf6×†µS4&…“%d6##VÅDugU£5&ô”CtÔ3Gtó‡U„sFt”3‡¶Ç‡T”4t¶”%E¥…v#%–u¤ugu¥sVµ¥sV¦ug¤”…&õ•…v&ÕfÅ¤4#'”&•¥4#4u&†Duf´”t¦Å¦Ó—•¥4#vÇ¤”wfsSÆÇ‡T”4t¶“–6&”v4…f–$vÆ¤”vFÆD4&µ¥„&Æ&Õ&Æ&Ôç¥„ÖôµFöuS%ce$•VµddÆ³––Õf¦DDäU”#u„sFt”4u“#—V35v3%c”Cv&Õc4”dæÆDG…U4d¤e%3U–×Å“5¥$CFôµGF6&Ç‡T”4t”tçf&äã”„&†6ÕgVD4””…&ö„×U–Ó—U¥3Wu•„¦Æ&åu„sFt”4vu–t´„&†6ÕgVD6¶vS‡T”4t”4v3%cÆÔfµ¤6‡u•„¦Æ&åó‡T”4t”ƒ6&Ç‡T”4t”u§f6”ö$uc”tæä”CtÔG6u“&6u4#vÇ¤ÆÔçf$w‡¤ug•#4§fE„'¤Æ×†Æ&ÖCG6u“&7$·–¶vS‡T”4t”4u¦Ó—””6‡5¥…u—”””Dt”tÖu4#vÇ¤ÆÔçf$w‡¤ug•#4§fE„'¥s$æå…3V¦#'‡6u&Æ6ä×V$ugU£5&ô÷”&¤·—7”‡F6&”t”4t”4v3%cÆÔfµ¤6ƒvÇ¤ÆÔçf$w‡¤ug•#4§fE„'¥s$æå…3V¦#'‡6u&Æ6äæ%“ó‡T”4t”4veg‡T”4t”ƒ6&Ç‡T”4t”„¦ÆD…g–&”'¥¥…u„sFt”ƒ6&Ç‡T”4d¶—6&”t”6öudv‡7”'¦4„§&ÖF–##VÄ”†G$wvu–ÕVu“$g5“5g5•…&Å¤4&••„æÅ¤4'f&”#uVv34&…“%Vv6Õg5•…'FÕVu¦ä§f%4#vÇ¤”s––Õf¦D3V6&”t”6öu5u–vDv‡7”'7”&v&åg6$t4”„çv6ÖÇU£$§f&ÕVvC&Ç6$4&•¥4&¥•w†¦Ew††Duf´”vÇT”†Gf6×†´”„çu•tæÄÆÇ‡T”4t¶“–6&”v4„§FÔc¥4&e“%gVDug”ö”%U4d¤e%3U–×Å“5¥$4#„”sS$wvu4'VEw‡4ó‡T”4'vEt§6tÖu£%c”tæÆ&å&Æ6–wö”%U4d¤e%3U–×Å“5¥$4#„”sS$wvvS‡T”4t”„¦ÆD…g–&”#vÇ¤ÆÃ–¥¥sS¥„“u„sFt”ƒ6&”v4…f–$vÆ¤”„æÆD4&¥¥sS¥„–õ“%gVDug”ö”%U4d¤e%3U–×Å“5¥$4#„”sS$ww”‡F6&”t”4dÇ”#&ÖÇV35&†$wvvsS%¥„§¥¥4&¥•tæõ¥g‡T”4t”vÆÔ”6ƒvÇ¤ÆÃ–¥¥sS¥„’ôÆåg¥¥„¤U•…&„ÆÖÇVFÕg–3%dE•tæõ¥d'–#6ƒTµ4#u„sFt”4t”4öDv‡7“Ve“%gVDug”Æåg¥¥„¤U•…&„ÆÖÇVFÕg–3%dE•tæõ¥d'–#6ƒT”tg¤”S†D„§TE$¦&å¦Æ6äæÅ$f¦uWÆä¦ÆFÕg–D6wó‡T”4t”4u¤ug5¥…&Ä”…&ö„×Uƒ$æÆ&å&Æ6“S3%g•$tc•3W&å¦Æ6äæÅ$f¦ue6Ó“FUGF6&”t”4#•„sV6&”t”4dÇ”&¦tgU£%VvDv†Ä”tæÆ&å&Æ6Ç‡T”4t”…&ö„×Uƒ$æÆ&å&Æ6”””tæÆ&å&Æ6§F6&Ç‡T”4t”3‡d”vÇV35&†$wvvsS%¥„§¥¥4&¥•tæõ¥g‡T”4t”vÆÔ”6ƒvÇ¤ÆÃ–¥¥sS¥„—”‡F6&”t”4t”vÆÔ”6v†Dv‡7“Ve“%gVDug”Æåg¥¥„¤U•…&„ÆÖÇVFÕg–3%dE•tæõ¥d'–#6ƒTµ4#u„sFt”4t”4t”…&ö„×Uƒ$æÆ&å&Æ6“S3%g•$tc•3W&å¦Æ6äæÅ$f¦ue6Ó“FU4””sVÆG”$å•…'–†s5sS%¥„§¥¥Tæ…“&†Ä´…&ö„×Uƒ$æÆ&å&Æ6“WE•…'–†…†#4§5¤6³u„sFt”4t”4#•„sFt”4veg‡T”4#•„sV6&”tÇ–÷„sFt”4”VÇV…'•wvv35&†DuVv#%–vDv†Ä”w‡e“$g4”s†D„§T4'e¦”#uVu–Ó—U¥3V6&”t”6÷e„sFt”„'–…¦†DuVuƒ&ÇV…'•w„Ö#$æ†$S†D„§T4””sVÆG”%U4d¤e%3Tå•…'–†s´6³u„sV6&”tÇ–÷„sFt”4”VÇV…'•wvv35&†DuVv#%–vDv†Ä”„§fDtcs—T”s–Ô”…&õ¥4&–##VÄÆÇ‡T”4t¶“–6&”v4„§FÔc¥4&fsWDvÆ†$W‡e“$g5VÓ“•…'##Fu4'U¥†6udV…5%UWUU…f†Dug–&ÖÇf&–wó‡U„sFt”3‡¶Ç‡T”4t¶”$¦&ÖÃtg4”„ã•…&Ä”s–Ô”…&õ¥4'v#4çDvÇf&”'e¦”'D„Öu“&‡$uU„sFt”4Ã‡T”4'v6ÖÃ%•…&Ä”c—&ÖÃtg5Ds–¥•w„FvÇ5¤d'f3&Ãs—T”Cv&Õc4”e$•VµddÆÅ¦Å“5'f6¤ÖôµGF6&”v4…f–$vÆ¤”vFÆD4'&ÖÃtg5Ds–¥•w„FvÇ5¤d'f3&Ãs—T´6³d”e$•VµddÆÅ¦Å“5'f6¤ÖvS‡T”4t”„¦ÆD…g–&”#vÇ¤ÆÃ—&ÖÃtg5Ds–¥•w„FvÇ5¤d'f3&Ãs—Tó‡T”4#•„sV6&”tÇ–÷„sFt”4”d¦ÆD…g–&äÖvDv†Ä”†Gf6×†´”s†D„§T4'e¦”'D„Öv4tg•¥sS”s––Õf¦D3V6&”t”6öuFÓ“¥4#tc”vÃ”„¦ÆD…g–&äÖu•4'•¥u¦Æ6ÕgU“%VvDs†vDv†Ä”s†D„§T3Fu$s—T£5v%…c•…&Ä”…&ö„Öu¤vÇ•¥tã$†¶…„sFt”4Ã‡T”4'v6ÖÃ%•…&Ä”vFÆD4&f4tg•¥sSEtc6ÖÃEc#—–$uôµFöudV…5%UWUEtc6ÖÃDä4#u„sFt”4v6ÕcE„§T”…&ö„×U–Ó—U¥3Wu•„¦Æ&åu”#vÇ¤ÆÔ§f&ÕWV4tg•¥sSÆÓ†D„§TfGf6×†´”Föu5U$eFÅ$¥dfÆeETeUV¶Å”äGF6&”veg‡U„sFt”3‡¶Ç‡T”4t¶”$F6Õf†DuVu•4'U¥†6ufÄ¤åS4'–sVåÓ—U¥3V6&”t”76&”t”6öu„&†6ÔgD”t§f&ÕVusFuC$§¥tãÓvDv††D4#6w‡4”t¦Ä”tcDtf¦uf´”…'d”…&ö„Öu–Ó—U¥g‡T”4t¶”$4tg••su“&‡$uusFuC$§¥tãÓvDv††D4#6w‡4”t¦Ä”…g¥¥uu•„Öu•4#•vÇ4”s–Ô”…&ö„Öv34'–sVä”t§f&ÕWT”VÃ”tæ†&”&•¥4'VEw‡4”†Fõ¥sFvDv†Ä”„çv6ÖÇU§”&–##VÄ”vÇ¤”vÇF4s—–Duf´”u§–##ufÄ¤ä”DTÔg‡T”4t¶”$4tg••sv3%cDvÇU£4ÖuS%c%¥„¦†$4'u•„¦†%uc¥„§¤”„¦Æ$tc¥uvDs†u–Õfõ•…§#4–v#%–vDv†Ä”„çv6ÖÇU§”&–##VÅ„sFt”4”T'u•„¦†%4&¦#'‡6u&Æ6¶G–#5gv7”$F#'‡6u&Æ6”&æ6Ó“4„ÖvDv††D4#6w‡4”t¦Ä”tçf$w‡¤uf´”†GDvvvDv‡7”'¦4„§&Ö6u–Ó—U¥g‡T”4t¶“–6&”u“#—V35'–Etã#4–õ„sFt”4u–Ó—U¥FöudV…5%UWUC$§¥tãÓ5„sFt”4u“&‡$ud”e$•VµddÆ³––Õf¦DDäT”‡vv&åg6$7†6&”t”4'¥¥…#sVæ7¦öuTtg–DvÆ†$G…uV³F4„§&ÖD6##VÅ6Ó—&å%E¥…#sVæ7£Fu4#ve7†6&”t”4&¦#'‡6u&Æ6¶G–#5gv7¦öufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•#4§fE„&%…4””gFDÄg‡T”4”‡F6&”t”4#vÇ¤ÆÔ§f&ÕVu4&–##VÄ÷”dÇ”#&ÖÅuV³6ED×tæ¦F6ED×tæµVv4tg•¥sS„sFt”4vDv‡7“V–##VÄÆÓ†D„§TTcDs•f4u&†DuVu4&Õ•w‡¥¥G6tÇ“†vE„&µ•…&Å„…W¤ÔE¤5„…W¤ÔFsE„…W¤ÔF„%„…SEDE„…S5¦³5„…W¤ÔES„…W¤ÔF„E„…W¤ÔF„5„…W¤ÔE¤e„…W¤ÔE“6Dv‡•¥uWVäæ6EEW„ôEf6ED×tæ¦F6ED×tæµf6EFw…%Tf6EEW•$Ef6EEW…%E¦6EF3ÔE¦6ED×tæµ¦6EE$dÔU&6EFsTôDf6&Ç‡T”4t”…&ö„×U“&‡$uu4&¦vÇ5¤GF6&Ç‡T”4t”…&ö„×V3%cDvÇU£4Öu4#u„sFt”4t”4&ö…%5•u'E„Ód”„æÆD…'&ÖG¤ÆÖ‡Dd¦…¤vÃ7”õ”tÆ¤5„sFt”4t”4'¦DvÆÕ¦ÓVÆ34Ód”„æÆD…'&ÖG¤Æäãu¦Ö&Õg¦7”õ”„Æ¤5„sFt”4t”4&æ6Ôc&…#UTs“5¥„“d”„æÆD…'&ÖG¤ÆÖG••…§D†Å#6FÆ6”õ”tÆ¤5„sFt”4t”4&æ6Ôc&…#U$vÇ”ö”'¥¥…#sVæ7“Væ6Ôc&…#U$vÇ•“V¦$s—U¥6w”C‚ô”sVÆG”%U4d¤e%3Uu¥tã#4—¤´DTÔ7vtÅDWTÔ7vtÔ3Gtµ7†6&”t”4t”u'••vDv#4¦¥¥Föv3%cDvÇU£4×U¤„¦…£§f6ÔæÄ”C‚ô”DTä7†6&”t”4#”ó‡U„sFt”4vDv‡7“V¦#'‡6u&Æ6¶G–#5gv7”””tçf$w‡¤ug•#4§fE„'¤ó‡T”4#•„sV6&”tÇ–÷„sFt”4”dæÆD4#uVvsWDvÆ†$4'¦Dtc¥4'e¦”#vÇ¤”„çv6ÖÇU§”&–##VÄÆÇ‡T”4t¶”%¦#5Vv%vÆæ…vC$gVD4#'”&¥•w‡4”‡D$vÇV”%uV³F4„§&ÖD6##VÅEtgU•vFÆ6“W¥¥…$¦&ÖÃS5&†Duc””vÇV35&Å•uU„sFt”4Ã‡T”4'vEt§6tÖv3%c5sWDdã•…&Ä´6³d”…§fuvS‡T”4t”3‡d”„¦Æ%ugE–Õg””vÇV…'•wvv4s—¦…'##Fv#%–v…'¥¥w†Õ„sFt”4vDv‡7“VfsWDvÆ†$W‡e“$g5Etc6ÖÃDÆÔçf4†¶öDv‡7“V–##VÄÆÓ†D„§T6³u„sFt”4vDv‡7“VfsWDvÆ†$W‡e“$g5VÓ“•…'##GU“#—vU6ƒvÇ¤ÆÔ§f&ÕWV5…f†Dug–&ÖÇf&–³u„sV6&”t”4dÇ”'¥¥uVvsWDvÆ†$4'v#4çDvÇf&”'e¦”'D„Öv$s–¥•wvu“&‡$u&6&”t”4'¦”öDv‡7“V¦vÇ5¤6¶vS‡T”4t”4vDv‡7“VfsWDvÆ†$W‡e“$g5&‡$u%#4çDvÇf&“V¦#4#T´…&ö„×U“&‡$uV4s—¦…'##Gó‡T”4t”ƒu¥w‡¥¥4#u„sFt”4t”4dÇ”#&6Ót”„¦Æ5…g6Õg¤”tVtã$çD”u§Tuf´”t§f&ÕVv$ugU£5&ô”u§f6”#uVu¦ÖÇU•wvv&Ó–µ¥4'&”&„”tæõ•vÇU„sFt”4t”4dÇ”%E¥uSd”vƒD„'¤ö“‡e£&Ã…f”ÆÔçf%3“&6ÓE—““&6ÓF34&Å“&ÆÖtæ†DvÇf&““6ÕfÄÃ#†35&Æ6“—¦4uf¦u§“$cs—TÃ¥5ETæf34'–sVåÓ—U¥3„Æ¤¥•t§fE…F34'–sVäÅtçf&Õ§£5g••…'##V6&”t”4t”…&ö„×Uƒ&ÇV…'•w„Ö#$æ†$Tæöw†µTs—¦…'##GU“#—vU6ƒvÇ¤ÆÔ§f&ÕWV4s—¦…'##GÆÓWf6Ó†$vÃe¥6wÆÓ$…'4wƒUS$æ†$tg”´DTÔF7ó‡T”4t”ƒ6&Ç‡T”4t”3‡d”tçf4†¶vDv†Ä”tæöw†´”„'f3&Ãs—T”…'d”…&†w‡¥„sFt”4u“#—V35v%tc6ÖÃEc#—–$u%V#æÆ&å&Æ6”””…&ö„×Uƒ&FÆDS†D„§TfGf6×†µds”E¥sS¥„–ôµGF6&”t”4#vÇ¤ÆÔ§f&ÕWV$s–¥•w…V#Gf6×†´´…&ö„×Uƒ$ã6ä¦Æ&å%U•vÇ4ÆÔçf4†¶öDv‡7“VfsWDvÆ†$W‡e“$g5&‡$u%#4çDvÇf&–·ÆÔgv4wƒUEtc6ÖÃDä6‡E•…'–†…†#4§5¤e'e%gVDug”µGF6&”t”4#vÇ¤ÆÃ—v6Õc%dtg$3V¦#4#T´…&ö„×Uƒ$ã6ä¦Æ&å%U•vÇ4µGF6&Ç‡T”4t”3‡d”„æÆD4'&ÖÃtg4”„ã•…&Æ7”#tc”tg•¥4'•¥w††Duf´”…'d”w‡e“$g4”tæöw†´”„'f3&Ãs—U„sFt”4vDv‡7“Ve–Ó—U¥TcF„×U“#—vU6ƒvÇ¤ÆÃ—&ÖÃtg5Ds–¥•w„FvÇ5¤d'f3&Ãs—Tµ3WV#4§E•w‡VÕVôµGF6&”veg‡U„sFt”3‡¶Ç‡T”4t¶”%5¥„æÆD4#uVv35&†DuVv#%–vDv‡7”&–##VÄÆÇ‡T”4t¶”%¦#5Vv%vÆæ…vC$gVD4#'”&¥•w‡4”‡D$vÇV”%uV³F4„§&ÖD6##VÅEtgU•vFÆ6“W•¥„æÆDƒvsW¦Duf…¤3V6&”t”6÷e„sFt”„#–×‡—”'•¥„æÆD6wö”#&#&Æ´”‡F6&”t”4#vÇ¤ÆÔ§f&ÕWV5…f†Dug–&ÖÇf&“V¦#4#T´…&ö„×Uƒ&ÇV…'•w„Ö#$æ†$d§fDtcs—TµGF6&Ç‡T”4t”3‡d”fFÄ”sVÅ¥uvDs†vE„&µ•…&Ä”vÃ7”'E•…'–†…†#4§5¤4'E•sS•w‡6U7vv3&ÇU“%VvC%VvD†FÅ•wFÅ¤4#uVu–Ó—U¥4&–U4'fE„–vtgU¤g‡T”4t”…&ö„×U–Ó—U¥3S4u&†Dudå•…'–†vôµGF6&”t”4#vÇ¤ÆÔ§f&ÕWV%tc6ÖÃEc#—–$uV%…g6DvÇv$†Äå•…'–tæÆ7–ƒvÇ¤ÆÃ—u•„¦Æ&å$å•…'–†…†#4§5¤7vvDv‡7“V–##VÄÆÓ†D„§T6³u„sV6&”t”4dÇ”$&4„'6U4#4u&†Duf´”„'f3&Ãs—T”…'d”…&†wvv35&†Dug¥„sFt”4u“#—V35v%tc6ÖÃEc#—–$u%V#æÆ&å&Æ6”””…&ö„×Uƒ&FÆDS†D„§TfGf6×†µds”E¥sS¥„–ôµGF6&”t”4#vÇ¤ÆÔ§f&ÕWV$s–¥•w…V#Gf6×†´´…&ö„×Uƒ$ã6ä¦Æ&å%U•vÇ4ÆÔçf4†¶öDv‡7“VfsWDvÆ†$W‡e“$g5&‡$u%#4çDvÇf&–·ÆÔgv4wƒUEtc6ÖÃDä6‡E•…'–†…†#4§5¤e'e%gVDug”µGF6&”t”4#vÇ¤ÆÃ—v6Õc%dtg$3V¦#4#T´…&ö„×Uƒ$ã6ä¦Æ&å%U•vÇ4µGF6&”veg‡U„sFt”3‡¶Ç‡T”4t¶”%f4u&†DuVvDv†Ä”„ã•…&Ä”s–Ô”…&ö„Öu–Ó—U¥3V6&”t”6öuus“”s£&ƒ”†F†&åvDs†u“$g6$4#uw‡&×6ufÄ¤åS4'–sVåÓ—U¥S†&Ôfå¥„—VE„&µ•…&Æe4'&äã¥tf´ÆÇ‡T”4t¶Ç‡T”4t¶”$4tg••su¤ug6DtVu¤ug6DteVsÅ„sFt”4Ã‡T”4'vEt§6tÖvE„&µ•…&Ä´u&Æ$…&„ö”'VEs•¥„—ö”#&#&Æ´”‡F6&”t”4'¦”õ¤ug6DtVuCtÔ6¶v6ÕcE„§Tó‡U„sFt”4tÇ“†ue„&µ•…&Ä”…&õ¥4&fC#—–$u%F4tf¥¥T§f&ÕdÕ¥sVæDv†6&”t”4#vÇ¤ÆÃ–¥•w†¥c#—–$u%F4tf¥¥T§f&ÕdÕ¥sVæDvvôµGF6&Ç‡T”4t”3‡d”VFÆD4&–##VÅ†‡7”'&”#6#4§5¤4'¦4tf¥¥g‡T”4t”tçf&äã”†Gf6×†µS4&…“%d6##VÅ†‡7”””c“$Ó¦6&”t”4t”3V¦#4#T´…&ö„×Uƒ$§f&Õd&TvÇ¤µg‡T”4t”4tÆå'••sW¥¦Ó—–%U'6Õf¦DvÇf&–ƒvÇ¤ÆÃ—&ÖÃtg5Ds–¥•w„å•…'–†w„sFt”4t”4VD„¦†&äæÖ#4§E$vÇ•¥tãs—T´…&ö„×Uƒ4&†6ÕgVDS†D„§TfGf6×†´µGF6&Ç‡T”4t”3‡d”…¦Æ6×†ÆDgƒãS$gƒåD—tæÇƒ×¤$ãƒæ´—”Õgƒ×¤%%gƒäU“$gƒã“%%gƒ×¤TÖÇƒôTWtôgƒã“Tã‡T”4t”c—U¥†ƒdtg$g‡T”4t”4tÇ“†u$uc¥„§FsVÄ”vÇU¥„£tVvsFu“%gVDug””„çu•tæÅ„sFt”4t”4U“#—vU6ƒvÇ¤ÆÃ–¦E„§•¥sSdtg$6Æ6&”t”4t”3V…¤uõƒ5—¥3W¦Et¥u¥tã#4§¤´…&ö„×Uƒ$ã6ä¦Æ&å%U•vÇ4Ä4#vÇ¤ÆÃ—v6Õc%dtg$6·V%…g6DvÇv$†ÅE“$g5•„–ôÕ4D”…&ö„×V3%cDvÇU£4×U¤„¦…£§f6ÔæÄµ6¶tÇ“†u„…SÖ¥$U„…W¤ÔU„…W¤ÔUdE„…W¤ÔU¤E„…W¤ÔUWu„…W¤ÔE¤e„…S4õU¤5„…SÖµ„…W¤ÔF·•„…S5$F³U„…S5$FÄ%„…W¤ÔESU„…W¤ÔF„4´gƒæµW…ÇƒôFs4Ôgƒ×¤DÖÇƒ×¤ÖÇƒ×¤EÇƒ×¤Dô6Æ6&”t”4t”3‡d”Tçf&å¦Æ6åu“%gVDug””„çu•tæÄ”…'d”†Gf6×†´”„çu•tæÅ„sFt”4t”4U•„'v$†Äå•…'–†s´…&ö„×Uƒ&FÆDS†D„§TTæÆ&å&Æ6Å'ec#—–$uôµ6¶tÇ“†vDtg$gƒ×¤TÖæGf6×†´”„çu•tæÅ„…W¤ÔE¤5„…S$Ö¤ä5„…W¤ÔESU„sFt”4t”4dÇ”$&4„'6U4'¦DvÆÕ¦ÓVÆ34Öu•sV´”vG••…§D†¶vsFvC#—–$uv34&…“%f6&”t”4t”3V…¤u%E“$g5¥u%u¥tã#4–öC#—–$u%F4tf¥¥T§f&Õd&TvÇ¤Ä4#vÇ¤ÆäæÆD…'&ÖG¤Æäãu¦Ö&Õg¦7””u&Æ$…&„µ4dÇ”&6EFsUTf6ED×tæµf6EES%$Uf6EF„e%D¦6ED×tæ´¦6ED×tôF†6ED×tôT¦6EEd4åD&6ED×u$Tæ6ED×u&´æ6ED×u&¤æ6ED×tæµf6EF3U&´¦6EEW•$Ef6EF3%%Uf6EE¤$ÕFÆ6&”t”4t”3V…¤u%E“$g5¥u%u¥tã#4–öDv‡7“W¥¥…#sVæ7“Væ6Ôc&…#U$vÇ”Ä4#vÇ¤ÆäæÆD…'&ÖG¤ÆÖG••…§D†Å#6FÆ6””u&Æ$…&„µG6tÇ“†u„…SõDS%„…SÖ¦Ä5„…W¤ÔE¤5„…W¤ÔFsE„…W¤ÔF„5„…S4õU¤5„…SÖµ„…STÕTäu„sV6&”t”4dÇ”'V#4§E•w‡VÕVu–Ó—U¥4'5¥sVæDv†6&”t”4&fC#—–$u%F4tf¥¥d'f3&Ãs—TÆäæÆDU§–##å•…'–†…#4çDvÇf&–ƒvÇ¤ÆÔ§f&ÕWV%tc6ÖÃEc#—–$uó‡T”4t”c—U¥†ƒdtg$3W¦Et–õƒ6Gf6×†µS4&…“%e#4çDvÇf&–·V&Ó—–%tg6‡Ä´6·V%…g6DvÇv$†ÅE“$g5•„–öDv‡7“VfC#—–$u%F4tf¥¥T§f&ÕdÕ¥sVæDvwÆÔfµ¤6†fC#—–$u%F4tf¥¥d'f3&Ãs—TµGF6&Ç‡T”4t”3‡d”Tçf$w‡3&Çf&Çƒ×¤$ãƒç¦ÄuÇƒåD¤Tåg‡T”4t”…&ö„×Uƒ$çf$w‡3&Çf&–†f&ÕcFDe&†wwó‡U„sFt”4tÇ“†vE„&µ•…&Ä”„'•¥…¥U•vÇ4”tgU¤4&¦E„§•¥sSdtg$g‡T”4t”…&ö„×Uƒ4'•¥…¥U•vÇ4ÆÔçf4†¶öDv‡7“Ve“5g–6ÕgVDe&†wwó‡T”4t”…&ö„×Uƒ$ã6ä¦Æ&å%U•vÇ4ÆÔçf4†¶õƒ#VÆT…%U•vÇ4µ3V†4„'6US†D„§TEöDv‡7“Ve£%cEtc6ÖÃEc#—–$u%V#æÆ&å&Æ6–wµGF6&Ç‡T”4t”3‡d”Tgv4wƒT”„§fDtcs—TÄ4&¦##S%¥„£”…¦Å“5'f6¤ÖvDv‡&Ö6vsS'”&…“5#•wvv5…f†Dug–&ÖÇf&Ç‡T”4t”3‡d”S—–vG&Ôg4”egVe¥5E4'7”&¶#&ÇU§”&¥¥sS¥„–vEsWD4&¥•w†¦Ewƒ7”&†D4&õ¥„¦Ä”t£D4#5¥6G•¥4&æ##WU•4&¶'”#vÇ¤”s—T”w‡e“$g4”…gV…&6&”t”4&¦##W¦D4#6#4§5¤dçu•tæÅ5sWDvÆ†$S†D„§TVÇVF”””c—E•…$%„sFt”4t”4V%…g6DvÇv$†Äå•…'–tæÆ7–ƒvÇ¤ÆÃ—u•„¦Æ&å$å•…'–†…†#4§5¤7vvDv‡7“VfsWDvÆ†$W‡e“$g5Etc6ÖÃDµg‡T”4t”4tÆÖÇVFÕg–D6wó‡T”4t”…&ö„×U–Ó—U¥3W†Etc¥„§Vs—U„sFt”4t”4V3%c&ä§f%egV…%u¥tã#4§¤´…&ö„×Uƒ$§f&Õd&TvÇ¤Ä4&fF¤ä$ÆÔçf4†¶õƒ#VÆT…%U•vÇ4µ3V†4„'6US†D„§TEöC#—–$u%F4tf¥¥VÇV…'•w„å•…'–†„¦&å—ÆÓWf6Ó†$vÃe¥6wµg‡T”4t”4tÆä'•¥s$…'4wƒT´…&ö„×Uƒ&ÇV…'•w„Ö#$æ†$d§fDtcs—TµGF6&Ç‡T”4t”3‡d”fFÄ”sVÅ¥uvDs†vE„&µ•…&Ä”vÃ7”'E•…'–†…†#4§5¤4'E•sS•w‡6U7vv3&ÇU“%VvC%VvD†FÅ•wFÅ¤4#uVu–Ó—U¥4&–U4'fE„–vtgU¤g‡T”4t”…&ö„×U–Ó—U¥3S4u&†Dudå•…'–†vôµGF6&”t”4#vÇ¤ÆÔ§f&ÕWV%tc6ÖÃEc#—–$uV%…g6DvÇv$†Äå•…'–tæÆ7–ƒvÇ¤ÆÃ—u•„¦Æ&å$å•…'–†…†#4§5¤7vvDv‡7“V–##VÄÆÓ†D„§T6³u„sFt”ƒ6&Ç‡T”4d¶—6&”t”6öu$s†u“#—6$vÇ¦s—T”s†Dvvu•vF†sW¦D4&ÆFÕg–U4&¦#'‡6u&Æ6äÖu•…#•tæõ¥uvDs†vDv‡7”&–##VÄÆÇ‡T”4t¶Ç‡T”4t¶”$4tg••svDtg$4%VuVvDtg$4#V#5VvC$gVD4#'”'v6Ó–¥¥„ç¥„sFt”4Ã‡T”4'v6ÖÃ%•…&Ä”c–¦#'‡6„ç##FöDtg$FöudV…5%UWUfÕf¦Ds—”×–³d”…§fuvS‡T”4t”u§f6”ö$uc”tæä”CtÔG6u“&6u4#vÇ¤ÆÔçf$w‡¤ug•#4§fE„'¤Æ×†Æ&ÖCG6u“&7$·–¶vS‡T”4t”4u¦Ó—””6‡5¥…u—”””Dt”tÖu4#vÇ¤ÆÔçf$w‡¤ug•#4§fE„'¥s$æå…3V¦#'‡6u&Æ6ä×V$ugU£5&ô÷”&¤·—7”‡F6&”t”4t”4u“#—V35u“#—6$vÆµ¥„–u4#vÇ¤ÆÔçf$w‡¤ug•#4§fE„'¥s$æå…3V¦#'‡6u&Æ6äæ%“u„sFt”4t”4t”tçf&äã”u'35u4&¦#'‡6u&Æ6“W¦tgu¥3V¥•w†¦Ew††DudF#'‡6„ç##Fõ“#—6$vÆµ¥„—U“#—6$vÆµ¥„¤å•…'–†w4”…&†ww4”…&ö„×V3%cDvÇU£4×VvÃVÔf¶…g¤Ä4&fF¤ä$µGF6&Ç‡T”4t”4t”4'¦”õ¤vÇ¦D4„”DTÔ6¶vS‡T”4t”4t”4t”3‡d”v‡Dg‡T”4t”4t”4t”…&†wwU•u&µS$æ†$ufµfÕf¦Ds—”´c“$ÓW4”3¶„ãµGF6&Ç‡T”4t”4t”4t”3‡d”sWf6Ó†$vÃe¥4&–##VÄ”w†Æ&ÖCg‡T”4t”4t”4t”…&†wwV35f”´c“6#4§5¤dçu•tæÅTs—¦…'##Gó‡T”4t”4t”4t”tçf&äã”w†Æ&ÖC4””…&†wwV$ugU£5&ô´6³u„sFt”4t”4t”4vDtg$3WFEwƒ„'6Udæ¥•w††6–ƒvÇ¤ÆÃ“6#4§5¤dçu•tæÅÓ—U¥W†Æ&ÖC4d”w†Æ&ÖC6·U•u&´´c“6#4§5¤dçu•tæÅTs—¦…'##Gó‡T”4t”4t”4#•„sFt”4t”4#•„sFt”4veg‡T”4#•„sV6&”tÇ–÷„sFt”4”Tæ†$tã$tc¥4#uVvS'6sW$”c“6#4§5¤dçu•tæÅÓ—U¥W†Æ&ÖCƒU„sFt”4”VÇVDugU¤uf´”…'d”t¦Ä”…g¥¥uvsFvS'6sW$”…gu¤tc¥ƒU„sFt”4Ã‡T”4'v6ÖÃ%•…&Ä”c–¥•w†¥c#—–$u%F4tf¥¥T§f&ÕdÕ¥sVæDvvôµFövFÓ—¤4#u„sFt”4uƒ5—¥3W¥¥…$v6Ó—EEtc6ÖÃETs—¦…'##FöDv‡7“V–##VÄÆÓ†D„§TfGf6×†´µG6tÇ“†u£%c”†Gf6×†´”„'f3&Ãs—T”s–Ô”…&ö„×U–Ó—U¥g‡U„sFt”4vu–t´…&ö„×U“&‡$u”‡F6&”t”4t”c“$Ó—V3%c&ä§f%S†D„§Td'f3&Ãs—T´…&ö„×U“&‡$uV%tc6ÖÃEc#—–$u÷”dÇ”&å¥…vC#—–$uv4s—¦…'##Fv#%–vDv‡7“V¦vÇ5¤g‡T”4t”ƒu¥w‡¥¥4#u„sFt”4t”4&fF¤ä4ÆÔçf4†¶öDv‡7“VfsWDvÆ†$W‡e“$g5&‡$u%#4çDvÇf&–³u„sFt”4t”4&fF¤ä4ÆÔgv4wƒUEtc6ÖÃDä6ƒvÇ¤ÆÔ§f&ÕWV%tc6ÖÃEc#—–$uó‡T”4t”ƒ6&Ç‡T”4t”…&ö„×Uƒ6Gf6×†µS4&…“%d6##VÅDugU£5&ô”Cuƒ5—¥3W¦Et–õƒ5—¥–·V$ugU£5&ô´6³u„sFt”ƒ6&Ç‡T”4d¶—6&”t”6öu4¦Å•…&Ä”tVv%tc6ÖÃD”…&õ•…u“#—VFÕg–D„Öu“%gVDug””„çu•tæÄ”vÇVDs†vC#—–$uv34&…“%WU„sFt”4Ã‡T”4'v6ÖÃ%•…&Ä”c–å¥…$å•…'–†„E¥sS¥„¥V#Gf6×†´´6³d”e$•VµddÆ³†D„§TEvS‡T”4t”„¦ÆD…g–&”#vÇ¤ÆÃ–¥¥sS¥„–u”#vÇ¤ÆÃ–¥¥sS¥„—V%tc6ÖÃEc#—–$utö”$¥$UdõdVÅUuc”åe%55fsó‡T”4#•„sV6&”tÇ–÷„sFt”4”Tç•¥tc¥4&„”s†D„§T4#tc”tçf&å¦Æ6å'¤”†Gf6×†´”„çu•tæÄ”vÇVDs†u“%gVDug””„çu•tæÄÆÇ‡T”4t¶“–6&”v4„§FÔc¥4&e£%cEtc6ÖÃEc#—–$u%V#æÆ&å&Æ6–wö”%U4d¤e%3Tå•…'–†s”‡F6&”t”4'•¥…#6ÓFvDv‡7“Ve“%gVDug””C†t´…&ö„×Uƒ$æÆ&å&Æ6“S3%g•$tc•3W&å¦Æ6äæÅ$f¦ue6Ó“FU4&†7”$å•…'–†s5sS%¥„§¥¥Tæ…“&†Äµ3W&å¦Æ6äæÄ”Föu5U$eFÅ$¥dfÆeETeUV¶Å”äGF6&”veg‡Veg‡T–—vt–ÖÇF4s—–D4”tg¤”e$•Vµdd”u§–##t£5&ö6ÕfÄ§§F6&ÖÇF4s—–D4#t”s†DE$¦&å¦Æ6å$F##u•…ve4&Ö6Ó—D”67TÃ#†DE$¦&å¦Æ6å$F##u•…äó‡U„sVÆT„'f6åu“'††34ÖuEtc6ÖÃDäVÇVFÕg–3%dE•tæõ¥4#u„sFt”3‡¶Ç‡T”4t¶”%VuVvDtg•£%c”s†D„§T3V6&”t”6÷e„sFt”„#–×‡—”'•¥tf¶##W6U4'E•…'–†sd”e$•VµddÆ³†D„§TEu„sV6&”tÇ–÷„sFt”4”TVu“$f¦uVv#%–vsS%¥„§¥¥4'e¦”&¦E„§•¥sS”s†D„§T3V6&”t”6÷e„sFt”„'–…¦†DuVv6Õf…¤s—V$†¶uƒ&ÇVFÕg–3%dE•tæõ¥4””sVÆG”%U4d¤e%3Tå•…'–†s´6³u„sV6&”tÇ–÷„sFt”4”TVu¦×†…§”#tc”s†%g¤”vÃ”†F†&åvDs†v6Õf¥•w†¦Ew††DuVv…'¤”‡D$vÇV”&fsS%¥„§¥¥Tæ…“&†Æe3V6&”t”6öuc&Ç6$4&•¥4'¥¥…u”…'–Euft”†Fõ¥sFu”ug5¥sÆ&å'¥”4&†6ÕVv%…c•…&Å¤4&†&Õu–ÕVvE„æÅ¤4'&”&u£%c5sS%¥„§¥¥tU„sFt”4Ã‡T”4'v6ÖÃ%•…&Ä”c—¦s“$u%f4u&†Dud¦&å¦Æ6äæÄ”CvD„£¥GF6&Ç‡T”4d¶—6&”t”6öudv†Ä”s—–vG&Ôg4”s–Ô”t'E•…'–†wU¥w†Æ%ugVD„æu„sFt”4Ã‡T”4'v6ÖÃ%•…&Ä”„¦Å•u'f&×ƒT”c—f6ÖÆæsV†$Ug5¥sÆ&å'¤ö”%U4d¤e%3Tå•…'–†sd…gv$uSu„sV6&”tÇ–÷„sFt”4”VÇVFÕg–3%Vv#%–u£&Ã%¥sFv%tc6ÖÃDÆÇ‡T”4t¶”$ö#5&Ä”…&õ•…v…vC&Ç6$4'•¥…#6ÓFv…'¤”vÇVDug–&Ôg4”„'–…¦†DuVvsW¦DtgU“%WU„sFt”4”S†%Vv35g•¥4&¦#4#VsVä”…&ö„Öu–ÕfÖ#4¦Ä”sDtc¥4#vÇ¤ÆÇ‡T”4t¶“–6&”v4…f–$vÆ¤”vFÆD4'&å¦Æ6äæÄ´6³d”e$•VµddÆ³†D„§TEvS‡T”4t”vÆÔ”6ƒvÇ¤ÆÃ—¦s“$u%f4u&†Dud¦&å¦Æ6äæÄµ4#u„sFt”4t”4'E•…5sS%¥„£#—F4tc´…&ö„×Uƒ&ÇVFÕg–3%dE•tæõ¥3V¦#4#T´…&ö„×V%tc6ÖÃDµ6³u„sFt”4t”4#vÇ¤ÆÃ—¦s“$u%f4u&†Dud¦&å¦Æ6äæÄ”Cu¦Ôg63%Su„sFt”4veg‡U„sFt”4v6ÕcE„§T”…&ö„×Uƒ&ÇVFÕg–3%dE•tæõ¥GF6&”veg‡U„sFt”„#–×‡—”&¦##W¦D„£“5'f6–‡E•…'–†sd”e$•VµddÆ³†D„§TE”‡F6&”t”4#vÇ¤ÆÓ†D„§T4””s†D„§TGF6&Ç‡T”4t”tçf&äã”v††&Õ'5¥„“d”d'–#6ƒU4tgU¤w†Æ6§‡VEs•¥„¦%…CFu4#u„sFt”4t”4'¥¥…d”6‡e–Ö÷4”„'–#4d”tgVU7vv&Õc5fÔg4µ4•”#u„sFt”4t”4t”…&ö„×Uƒ4æö#5g5¤egu¤tc¥VÇVFÕg–3%Vu4#6åfÄó‡T”4t”4t”4'e–×&4„§f4cu4'U¥†Eu•wsu„sV6&”t”4t”4v6ÕcE„§T”…'–EuSu„sFt”4t”4#”Äg‡T”4t”ƒu„sV6&”t”4#vÇ¤ÆÃ—f6ÖÆæsV†$Ug5¥sÆ&å'¤”Cv%tc6ÖÃDÆÕg5¥sÆ&å'¤ó‡T”4t”s†D„§T3VÆ$ugE¥sS7”””sVÆG”%6Ó“FUG…U4d¤e%3Tå•…'–†sd…gv$uR´´s†D„§T3VÆ$ugE¥sS7—vvtgU¤w†Æ6–³u„sFt”ƒ6&Ç‡T”4'vEt§6tÖv6Õc%¥„£´6³d”…§fuvS‡T”4t”…&ö„×V%tc6ÖÃDÆÕg5¥sÆ&å'¤”CvDv‡7“Vf#4§£&ÇU•w„f$ugE¥sS7§F6&”veg‡Veg‡T–—vt–ÖÇF4s—–D4”tg¤”e$•Vµdd”u§–##t£5&ö6ÕfÄ§§F6&Ç‡U“#—V35uƒ#†DTVu4'U¥†6udV…5%UWUEtc6ÖÃDä6wó‡U„sGd¶—6&””TVu“#—F4tc”u£&Ôãs—T”u§f6”&uEtc6ÖÃDä3W&å¦Æ6åôµttÇ”&uEtc6ÖÃDä3Vå¥…$¦&å¦Æ6äæÄ´6ÆtÆÇ‡T”6öu”S†D„§TEVsS%¥„£´6Æt”vÇ¤”vÇVD„§e¤…f¥¥uvsFv6¤W”×”&†&Õu”S†D„§TEU£%c5sS%¥„§¥¥6w”4&Æ%vÃ7”&„”†F†6ÓW&Ö7U„sFt¶”%…¥4&†6ÕVu£#—&Ö6vDs†vE„æÄ”…&ö„Öu“#—F4tc”u§f6”&„”†Föw†ÄÆÇ‡T”6öu„&†6ÔgD”…&†6ÖFÆD4$$”…&†6ÖFÆD4'E•…'–††6&”Ã‡U¥†‡v#4£”u£&Ôãs—T”s†DE$¦&å¦Æ6å$F##u•……d4&ÆT…&Æ&Õ'¤”e$•VµddÆ³†D„§TE´´…&†6ÖFÆDFöud6³d”evS‡T”4'¦”ô´…&†6ÖFÆD4&†7”&†&æ·ÆÖÇVFÕg–D6¶vS‡T”4t”…&†6ÖFÆD3W&å¦Æ6åôµGF6&”ve4&Æ$„æÄ”‡F6&”t”4öDtg•£%c”tg¤”tgVU6·U£%c5sS%¥„§¥¥6†f%tc3V¦#4#T´…&†6ÖFÆD6·ó‡T”4#•„sV6&”v6ÕcE„§T”…&†6ÖFÆDGF6&ã6&”—4”4§%„'f6åvD†Çu¥4”tg¤”e—ufÄ¤ä”u§–##t£'v†‡F““U„&Æ7“&6ÓDÔ3Gt§§F6&ÖÇF4s—–D4#U„&Ä”6öu•„Öuf¤eF4„§&ÖD6##VÅS$æõ¥s„”u§–##t£'v†‡F““U„&Æ7“&6Ó¤Å„çv6ÖÇU£$§f&ÕWDÕ3Gt§§F6&ÖÇF4s—–D4#U„&Ä”6öu•„ÖuS4'–sVåÓ—U¥UcFDugU¤ufµ#—6$vÆµ¥„¥E“&†Æ%tVu¦ä§f%4å„'TvÃ$Ã5#V4ug¤Å…§–%t×F34'–sVå–Ó—U¥3ÆT…&Æ&Õ&Å¤3¦#'‡6u&Æ6“„Æ¤äó‡Vsv#4£”6öu•„ÖudV…5%UVu¦ä§f%4æDv‡•¥uVäó‡Vsv#4£”…#V4uVvW”$…De$tÄ4$…De$uDs–…¤ug•Twƒ£&ÇTÄ4$…De$uTtg–3%g””ƒu¦ä§f%4æDv‡•¥uWe¥†††%„'5¥„×fäçDÃ'‡e•u&Æ6ä×e#…U&·‡e•u&Æ6“W7–3u„sW%„'f6åvW”%uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„¤•¥w‡u¥„—4”e¥5Edçv6ÖÇU£§f&Õd¶#&ÇVDV†Æ$„&Æ6”#””u§–##t§“Gfug64ug–7–3u„sW%„'f6åvW”%uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„–ve4&Ö6Ó—D”67TÃ¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6–3u„sW%„'f6åvD†Çu¥4#t”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6¶G–#5gt”ƒu¦ä§f%4äÆ“•uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„¤†6Ó“463u„sW%„'f6åvW”%uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„¥Ftgu¥Tæ†4„ã$uVve4&Ö6Ó—D”67TÃ¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6Äæõ•„&Å$gv35g5¥63u„sW%„'f6åvW”%uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„¥Ftgu¥dçvug•¥4#””u§–##t§“GefÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•S&††4ueF4v†Æ6ÕVäó‡Vsv#4£”‡6ufÄ¤åS4'–sVåÓ—U¥WfsS”ƒu¦ä§f%4äÆ“•uV³F4„§&ÖD6##VÅ6Ó—&åäó‡Vsv#4£”…#V4uVvW”%uV³F4„§&ÖD6##VÅDs–…¤ug•Twƒ£&ÇUC4#s—V7”#””u§–##t§“GefÄ¤åS4'–sVåÓ—U¥W‡e•u&Æ6Ä'6EvG&³—vDvÇf&äÖäó‡Vsv#4£”‡6ufÄ¤åS4'–sVåÓ—U¥S†&Ôfå¥„–ve4&Ö6Ó—D”67TÃ¥5Edçv6ÖÇU£§f&Õdå•sV…£%g”§§F6&ÖÇF4s—–D4#U„&Ä”‡6ufÄ¤åS4'–sVåÓ—U¥WfsSS%cDvÇU£4Öve4&Ö6Ó—D”67TÃ¥5Edçv6ÖÇU£§f&Õd¶#&ÇVDdæÆD…'&ÖG¤§§F6&ÖÇF4s—–D4#t”VDÕdU–u•„Öu#…U&Äæ¦ugE•4#””u§–##t£&æ$…&ÔÅ…'••sW¥¦Ó—–%3–¦#4¦Ä§§F6&ÖÇF4s—–D4#t”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6Äæõ•„&ÅTw††&ÕVve4&Ö6Ó—D”67TÃ¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6Äæõ•„&ÅTw††&ÕVäó‡U„sV¦##W¦D4$ete$eFÄä¥CVeF´då%c”ete$eFµ$e$c”EC„Õ5U$eV”””6EuV³Eƒ4çv6ÖÇU£§f&Õfe¥†ƒ¥sVµ¥u&e“#—6$vÆµ¥„–äó‡U„sGd¶—6&””d'f34ç–×†Ä”„çu¥tÖvFÕg–3&Çf&äÖv…v6Õf¦#&GV‡Æ7“V6&”Ã‡U“#—V35uTS•ESÄ5DUfeS$e•u%d¥E5S”õW”””sVÆG”%E¥…õw–7„Æ¤äÄ4äÕ3GtÅt¦ÆDtVå…6³u„sV6&“‡¶Ç‡T”6öuTs—¦3&Æ–$uVv34&Å—”#%¥„§¦s—V7”'e¦”&ufÄ¤å—¦4„§&ÖD6##VÅƒ%cFDugU¤ufµƒ$çf$w‡¤ug•”4'D4'•¥tçe£#WVÕg¤ÆÇ‡T”6÷e„sV¦##W¦D4%CåE5T¤Õ%c•ETUdEƒ¤eVÄä¥CUEƒe•dUdõ$UdUƒåDW„¥$Ue5W”””sVÆG”%E¥…õw–7„Æ¤å…6³u„sV6&ÕcF4s—–D4&¦$tg¦7”%uV³F4„§&ÖD6##VÅDs–…¤ug•Twƒ£&ÇT”vÇF4w†Æ%ugVD„Öu#…U&·‡e•u&Æ6Ä'6EvG&”#u„sFt”„#–×‡—”'¦DtctÖv6Õf…¤s—V$†¶u%f…U%SUE5S”õƒT%EUVu4åfÄ¤å—¦4„§&ÖD6##VÄ§§F6&Ç‡T”4d¶—6&”t”6öuS4&Å“&ÆÖU4&†&”%–×Å“5¥$4#'”&…¤uvS'6sW$”e¥5Edçv6ÖÇU£§f&Õd¶#&ÇVDV†Æ$„&Æ6ãv7“V6&”t”6öu5u–v&Ó“”„çu¥tç¦ÖÆÅ¤7vvug64ug””†G$wvv&Ó“”t¦Ä”tç•¥tc¥uU„sFt”4”VÆÔ”t'•¥sVµ¥„¥6Õ&Æ6Ôv„Öv3%c”…'d”…&õ¥4'–##“Ä4&õ¥w‡u¥„§¤”†G$wvu“#—vU4#uVv3$gE¥4&v6ÕgU¤ug•C4¦µ¥„¦t”3V6&”t”6÷e„sFt”„#–×‡—”'#&ÇVDV†Æ$„&Æ6Ä§f#5ôö”%U4d¤e%3U–×Å“5¥$GF6&Ç‡T”4d¶—6&”t”6öuS4&Å“&ÆÖU4&†&”%–×Å“5¥$4#'”&…¤uvS'6sW$”e¥5Edçv6ÖÇU£§f&Õd¶#&ÇVDV†Æ$„&Æ6ãv7“V6&”t”6öu5u–v&Ó“”„çu¥tç¦ÖÆÅ¤7vvug64ug””†G$wvv&Ó“”t¦Ä”tç•¥tc¥uU„sFt”4”VÆÔ”t'•¥sVµ¥„¥6Õ&Æ6Ôv„Öv3%c”…'d”…&õ¥4'–##“Ä4&õ¥w‡u¥„§¤”†G$wvu“#—vU4#uVv3$gE¥4&v6ÕgU¤ug•C4¦µ¥„¦t”3V6&”t”6÷e„sFt”„#–×‡—”&¦#'‡6u&Æ6¶†Æ$„&Æ6Ä§f#5ôö”%U4d¤e%3U–×Å“5¥$GF6&Ç‡T”4d¶—6&”t”6öu5u–vD„£¥7vv$s–…¤4&¦#'‡6u&Æ6äÖu¤ufÖsVÅ¤4'&”&ufÄ¤å—¦4„§&ÖD6##VÅƒ%cFDugU¤ufµƒ$çf$w‡¤ug•”3V6&”t”6öuS%c”…'d”t&Õ•w‡¥¥tvDs†u¤vÇ¥•t§5¥4'6#$f¶sVä”ucFDugU¤uf´”tçf$w‡¤ug–7”&†&ÕvE„æÄ”…&õ¥4&Õ•w‡5–Ôf¦”&•¥v††FÖÇf6“V6&”t”6öu”…'–Euft”t£T”u&Å¦Ôc$…U„sFt”4Ã‡T”4'vEt§6tÖvE„æÅ%†ƒ¥sVµ¥u$F#'‡6u&Æ6äÓd”t§f#'†Å•sCu„sV6&”v4…f–$vÆ¤”„¦Å•u'f&×ƒT”„&†6äæÆ6¦öu#…U&Ä&†6äæÆ6§F6&Ç‡T”4'vEt§6tÖu£%c”sV†%uVôµFöv35'–sVä”‡F6&”t”4'•¥…#6ÓFufÄ¤åS4'–sVåÓ—U¥W‡e•u&Æ6Ä'6EvG&“Tete$eFÄä¥CVeF´då%GF6&”veg‡U„sFt”„#–×‡—”&¦##W¦D„£“5'f6–‡u•„§¥¥„“d”VDÕdU¥•„§¥¥„—4”s—vDvÇf&äÒôö”%uV³F4„§&ÖD6##VÅDs–…¤ug•Twƒ£&ÇUC4#s—V7–¶vS‡T”4t”…&ö„×V4tg–3%g””Cv4tg–3%g”ó‡U„sFt”4vDv‡7“W#&ÇVDV†Æ$„&Æ6Ä§f#5u4'f4…'##W¥“W#&ÇVDV†Æ$„&Æ6Ä§f#5u„sFt”4vDv‡7“V¦#'‡6u&Æ6¶†Æ$„&Æ6Ä§f#5u4'f4…'##W¥“V¦#'‡6u&Æ6¶†Æ$„&Æ6Ä§f#5u„sFt”4vDv‡7“S3%dfT…&Æ&Õ&Å¤Tçf$w‡¤ug–7”””s—vDvÇf&äÒôÆåg¥¥UcFDugU¤ufµ#—6$vÆµ¥„§¤”C‚ô”…'–EuSu„sFt”ƒ6&Ç‡T”4'vEt§6tÖu•„ãV&ÔÖu•u£¥„¥6##“´vG6Du“d”VDÕdU—ö”%6Ó—F„æÅ…§fu´”‡F6&”t”4&æ$…&ÔÆåg¥¥„¤U•…&„Æå§–%dçv6ÖÇU£§f&Õdå•sV…£%g””Cu•†F†…vDv‡7“Vfsv#4£´vG6Du—ó‡T”4#•„sV6&”tÇ–÷„sFt”4”VÇF4s—–D4'¦4„§&Ö6u–Ó—U¥„Öu¦ä§f%4&„”VDÕdU–u•sV´”„¦ÆD…g–&”&„”‡D$vÇV”%uV³F4„§&ÖD6##VÅEtgU•vFÆ6ãU„sFt”4”VÃ”s£&ƒ”„¦ÆD…g–&”&v&åg6$tvsW¦Duf…¤4#6ugT”vÃ”u'e¥„Öv&Ó“”sVÅ¥uvDs†u–ÕVu“4¦Å•…&Å¤4'f6”'¦##ÆDv‡&Ö6u£#†vC4§f&Ö7U„sFt”4„sFt”4”T'u•„¦†%4&æ$…&Ô”TVv4tg–3%f´”„¦Æ35g6D4'e¦”$…De$t”…&†%gT”u§–##u#…U&·‡e•u&Æ6Ç‡T”4t¶“–6&”v4„§FÔc¥4&†36ÇU—”&fsv#4£´vG6Du“d”VDÕdU—ö”%6Ó—F„æÅe¥5Edçv6ÖÇU£§f&Õdå•sV…£%g””‡vv&åg6$CFvS‡T”4t”tçf&äã”…—…VÕg¦Ewƒ”Cu•†F†…vDv‡7“VfF¤d¦%„'f6åõ£'ƒ¦–³u„sFt”4vu–t´…—…VÕg¦Ewƒ”4S””sS$ww”‡F6&”t”4t”„¦ÆD…g–&”#$Õd¦Æ35g6DGF6&”t”4#•„sV6&”t”4&¦##W¦D4#$Ôd¦Æ35g6D4””tc5•vÃ”…&ö„×Uƒ5—u5sv#4£´vG6Du—ó‡T”4t”vÆÔ”6ƒ$Ôd¦Æ35g6D4…4'VEw‡4µ4#u„sFt”4t”4'•¥…#6ÓFvF¤%5¥„ã$…u„sFt”4veg‡U„sFt”4v6ÕcE„§T”sS$wsu„sFt”ƒ6&Ç‡T”4'v6ÖÃ%•…&Ä”tg¦UsV¤”c“$ÕVÇF4s—–D6†æ$…&Ôö”$…De$tµFöuT„§f%vÇ¥¥G…uV³F4„§&ÖD6##VÅEtgU•vFÆ6”#„”sS$wr´”‡F6&”t”4&¦##W¦D4'3#—T”Cu£'ƒ¦“Wu•„§¥¥„—Väçf&”&†7”$…De$uS$æõ¥s„Æ¶Ä…De$tó‡U„sFt”4tÇ“†u¥tg–$†¶u•t§f6åvu–v…u¤s–Æ3#FæD4#3%Vv34'–sVä”t§f&Õg¥„sFt”4u“#—V35v„åF4„§&ÖD6##VÅe„æÅ¤4””w¦##GU¥†ƒ¥sW¦s—V3g¥¥uôÆÖÇU¤ucEC%–õfÄ¤åS4'–sVåÓ—U¥W‡e•u&Æ6Ä'6EvG&“Tete$eFÄä¥CVeF´då%6¶t•C””3„ó‡T”4t”vÆÔ”6v†„åF4„§&ÖD6##VÅe„æÅ¤6¶vS‡T”4t”4v6ÕcE„§T”sS$wsu„sFt”4veg‡U„sFt”4u“#—V35v%tgU•vFÆ6”””sVÆG”%uV³F4„§&ÖD6##VÅEtgU•vFÆ6–wó‡U„sFt”4u“#—V35vDv‡•¥udö#%&Æ7¦öudV…5%UWUC$§¥tãÓ&%…4””tc5•vÃ”vG6Du—V4tg–3%g”ÆÖFÆDU&Æ4ugU¤ugU“&ÆÆ7–væ&Ó–µ¥67ó‡U„sFt”4u“#—V35u¥†ƒ¥sW¦s—T”Cväçf&“VÆT…&Æ&äç##W¥“V%fÄ¤åS4'–sVåÓ—U¥W‡e•u&Æ6Ä'6EvG&“Tete$eFÄä¥CVeF´då%cu•„æ6&”t”4t”e—…S4'–sVåÓ—U¥dæ¦ugE•3UuV³ES4'–sVåÓ—U¥4#„”…gU¤ufÖsVÅ¤GF6&”t”4'¦”ô•ucFDugV3&Çf&–¶vS‡T”4t”4v6ÕcE„§T”sS$wsu„sFt”4veg‡U„sFt”4u“#—V35v34&Å“¦Æ6äç##Fu4&ÆT…&Æ&äç##GV34&Å“¦Æ6äç##Cu„sFt”4vu–t´4eCåE5T¤Õ%c•ETUdEƒ¤eVÄä¥CUDÆÖ††7–‡¦4uf¥fÕg–3&Çf&–·”‡F6&”t”4t”tçf&äçf$uWVC$g–&–†6&”t”4t”4u”e¥5Edçv6ÖÇU£§f&ÕdÖ#$fµ¥„¥$…fæsCd”egV#WfC#Ft¤‡EuV³F4„§&ÖD6##VÅDs–…¤ug•Twƒ£&ÇTÆµe•dUdõSÅFÃ”õSfe4'¦4uf¥fÕg–3&Çf&”&4–•#v34&Å“¦Æ6äç##S•„4¦tÄg‡T”4t”4tµGF6&”t”4t”„¦ÆD…g–&”'VEw‡4ó‡T”4t”ƒ6&Ç‡T”4t”tçf&äã”tçf$w‡¤ug–7”””ucFDugV3&Çf&“V¦#'‡6u&Æ6äÒôÆÓ†46vö3$æõ¥s…#—6$vÆµ¥„—4”vÄF#'‡6u&Æ6–¶uCFvS‡T”4t”4u“#—V35v&Ó–µ¥4””…&ö6ÕfÅFÓ–µ¥„æ&3$æõ¥s…#—6$vÆµ¥„—V&Ó–µ¥4fDó‡U„sFt”4t”4dÇ”%F##Ä”se¤ug67”'vE…u”3…”4#'”#uVv&Ó–µ¥4'&Õ&ÆT4'e¦”&¦#'‡6u&Æ6äæ6&”t”4t”vÆÔ”6‡V#%&Ä”C””sS$ww”‡F6&”t”4t”4u“#—V3#—5¥3S5•„§T´g‡T”4t”4t”4t”t%uV³F4„§&ÖD6##VÅDs–…¤ug•Twƒ£&ÇTö”%VuVu“#—6$vÆµ¥„–t—•#vTçf$w‡¤ug–e4&†D…&Æ%„#¥uvDs†v6ÕfÕ¥„¦Æ&ÔæÄ”tVv&Ó–µ¥4¤¤‡G¥“&†Æ%tdF#'‡6u&Æ6“WV#%&Æe4&–E…v&Ó“”u§fEsV´Æ”%F&Çv4vÇU§”#uVu“#—6$vÆµ¥„¦tÄg‡T”4t”4t”4ó‡T”4t”4t”4'•¥…#6ÓFv&åg6$GF6&”t”4t”ƒ6&Ç‡T”4t”4u“#—V35v3$æõ¥s…S&††4uVu4'¥“&†Æ%tdF#'‡6u&Æ6“W¦tgu¥4Su„sV6&”t”4t”3‡d”e%$Sƒd”„æÆ4tg••…&Ä”vÇVDs†v3%c%¥„¦†$4&ÖEsV¦DvÇf&äæ6&Ç‡T”4t”4u“#—V35v3$æõ¥s…%†„F#'‡6u&Æ6¦öuS4'–sVåÓ—U¥UcFDugU¤ufµ#—6$vÆµ¥„¥E“&†Æ%tWUfÄ¤åçv6ÖÇU£§f&ÕdfT…&Æ&Õ&Å¤Tçf$w‡¤ug””‡vvEsVµ¥u§&Õf´”C6&”t”4t”4v3$æõ¥s…#—6$vÆµ¥„—U¥†ƒ¥sW¦s—V7£‡Use•dUdõSÅFÃ”õSeƒe•dUdõ$UdUƒåDW„¥$Ue5…GF6&Ç‡T”4t”4vu–t´…&ö„×VE„æÅ%†ƒ¥sVµ¥u$F#'‡6u&Æ6äÖt¦•–v3$æõ¥s…%†„F#'‡6u&Æ6”…4'VEw‡4µ4#u„sFt”4t”4t”tçf&äã”„çu¥tåu¥„§¦s—U%†„F#'‡6u&Æ6”””„æ¦ugE•UcE#—6$vÆµ¥„—V34&Å“¦Æ6äç##Cu„sFt”4t”4t”vÆÔ”6v…TS•ESÄ5DUfeS$e•u%d¥E5S”õS”ete$eFµ$e$c”EC„Õ5U$eVÄ×Vtg¤´„çu¥tåu¥„§¦s—U%†„F#'‡6u&Æ6–·”‡F6&”t”4t”4t”4&¦##W¦#'†ÄÆæF†6ÓFõ„sFt”4t”4t”4t”4&ufÄ¤åS4'–sVåÓ—U¥W‡e•u&Æ6Ä'6EvG&¦öuesW&&Ó“6&”¶Se•dUdõSÅFÃ”õSeƒe•dUdõ$UdUƒåDW„¥$Ue6e4'¦4uf¥fÕg–3&Çf&”&4–•#v34&Å“¦Æ6äç##TfTTçf$w‡¤ug–egv”Æ”$u•w‡5–Ôf¦&ÇU§”#'”#uVt¤‡EuV³F4„§&ÖD6##VÅDs–…¤ug•Twƒ£&ÇTÆµe•dUdõSÅFÃ”õSfe4&µ¥u§&ÖÃs—U”7†6&”t”4t”4t”4ó‡T”4t”4t”4#””ug63%VvS‡T”4t”4t”4t”tçf&äã”„æ¦ugE•UcES&††4uVu4'¥“&†Æ%tdfTTçf$w‡¤ug”Æäæõ•„&Ä•GF6&”t”4t”4t”4'¦”ö3$æõ¥s…%†…Ftgu¥3W¦4v†Æ6ÕW”‡F6&”t”4t”4t”4t”„¦ÆD…g–&”#vÇ¤ÆÃ—%„'f6å%F4v†Æ6ÕdF#'‡6u&Æ6–‡V#%&ÄÄ4#u„sFt”4t”4t”4t”4t”s–Õ¦äæÆDFöv&Õc4”e$•VµddÆÅ¦Å“5'f6¤Öôµ3VÖ6Ó—E„§••†¶ö3$æõ¥s…%†…Ftgu¥3W¦4v†Æ6ÕWV#%¦Ö3%c”C‚ô”g7tÆ¤4”DTÔ7vtÔ3Gu…6·5„sFt”4t”4t”4t”4t”„¦…¤vÃ7¦öv3$æõ¥s…%†…Ftgu¥3W¦4v†Æ6ÕWV6Ôf¶…g¤”C‚ô”DTÔ7†6&”t”4t”4t”4t”4vsW¦u&Äö”'¥“&†Æ%tdfTdæõ•„&ÄÆäçvug•¥3W&äç¤uVu£†u¦Ôg63%W5„sFt”4t”4t”4t”4#”µGF6&”t”4t”4t”4#””ug63%Vvu–t´„æ¦ugE•UcES&††4uWU“$gv35g5¥6¶vS‡T”4t”4t”4t”4v6ÕcE„§T”…&ö„×Uƒ&ÇF4s—–DTæ†4„ã$udF#'‡6u&Æ6–‡V#%&ÄÄ4#u„sFt”4t”4t”4t”4t”s–Õ¦äæÆDFöv&Õc4”e$•VµddÆÅ¦Å“5'f6¤Öôµ3VÖ6Ó—E„§••†¶ö3$æõ¥s…%†…Ftgu¥3V¥•„'¦Ew†ÄÆÓ–Õ¦äæÆD4õ”&$Ô3GtÄ4tÆ¤4”DTÔcÄg‡T”4t”4t”4t”4t”4'••u'E„Ód”„æ¦ugE•UcES&††4uWU“$gv35g5¥3W••u'E„Öu£†tÔ3GtÄg‡T”4t”4t”4t”4t”4#•vÇ4ö”'U¥†6udV…5%UWUfÕf¦Ds—”×–wÆÕ§–##&6ä¦†U6‡¥“&†Æ%tdfTdæõ•„&ÄÆÔæ†4„ã$uWVDtg$4õ”&$Ô3GtÄ4tÆ¤4”DTÔcÄg‡T”4t”4t”4t”4t”4'&äç¤uSd”„æ¦ugE•UcES&††4uWU“$gv35g5¥3W&äç¤uVu£†u¦Ôg63%W5„sFt”4t”4t”4t”4#”µGF6&”t”4t”4t”4#””ug63%Vvu–t´„æ¦ugE•UcES&††4uWV4w††&ÕW”‡F6&”t”4t”4t”4t”„¦ÆD…g–&”#vÇ¤ÆÃ—%„'f6å%$tgU¥Tçf$w‡¤ug”´sWe¤uW4”‡F6&”t”4t”4t”4t”4v#%¦Ö3%cö”'U¥†6udV…5%UWUfÕf¦Ds—”×–wÆÕ§–##&6ä¦†U6‡¥“&†Æ%tdfTdæõ•„&ÄÆä'5•sVÄÆÓ–Õ¦äæÆD4õ”&$Ô3GtÄ4tÆ¤4”DTÔcÄg‡T”4t”4t”4t”4t”4'V#4§E•wsd”sVÆG”%U4d¤e%3Uu¥tã#4—¤´6·U¦ä§f%Tg–6ÔcT´„æ¦ugE•UcES&††4uWV4w††&ÕWV&Ó—–%tg4”C‚ô”g7tÆ¤4”DTÔ7vtÕ3Gu…6·5„sFt”4t”4t”4t”4#”µGF6&”t”4t”4t”4#•„sFt”4t”4t”ƒ6&”t”4t”ƒ6&Ç‡T”4t”4vu–t´„æ¦ugE•dæõ•„&ÄÆäçvug•¥6¶vS‡T”4t”4t”4'•¥…#6ÓFvDv‡7“Vfsv#4£S4&õ¥„¦Å#—6$vÆµ¥„–ö&Ó–µ¥7vvS‡T”4t”4t”4t”s–Õ¦äæÆDFöv&Õc4”e$•VµddÆÅ¦Å“5'f6¤Öôµ3VÖ6Ó—E„§••†¶ö3$æõ¥s…S&††4uWV34&õ¥„¦ÄÆÓ–Õ¦äæÆD4õ”&$Ô3GtÄ4tÆ¤4”DTÔcÄg‡T”4t”4t”4t”„¦…¤vÃ7¦öv3$æõ¥s…S&††4uWV34&õ¥„¦ÄÆä¦…¤vÃ7”õ”tÆ¤5„sFt”4t”4t”4vsW¦u&Äö”&Õ•w‡¥¥7†6&”t”4t”4ve6³u„sFt”4t”4#””ug63%Vvu–t´„æ¦ugE•dæõ•„&ÄÆÔæ†4„ã$uW”‡F6&”t”4t”4v6ÕcE„§T”…&ö„×Uƒ&ÇF4s—–DTæ†4„ã$udF#'‡6u&Æ6–‡V#%&ÄÄ4#u„sFt”4t”4t”4v#%¦Ö3%cö”'U¥†6udV…5%UWUfÕf¦Ds—”×–wÆÕ§–##&6ä¦†U6‡¥“&†Æ%teFtgu¥3V¥•„'¦Ew†ÄÆÓ–Õ¦äæÆD4õ”&$Ô3GtÄ4tÆ¤4”DTÔcÄg‡T”4t”4t”4t”„¦…¤vÃ7¦öv3$æõ¥s…S&††4uWU“$gv35g5¥3W••u'E„Öu£†tÔ3GtÄg‡T”4t”4t”4t”…&†wsd”sVÆG”%U4d¤e%3Uu¥tã#4—¤´6·U¦ä§f%Tg–6ÔcT´„æ¦ugE•dæõ•„&ÄÆÔæ†4„ã$uWVDtg$4õ”&$Ô3GtÄ4tÆ¤4”DTÔcÄg‡T”4t”4t”4t”vÇV3&Æµ¥Föu¦Ôg63%W5„sFt”4t”4t”ƒó‡T”4t”4veg‡U„sFt”4t”4&¦##W¦#'†ÄÆæF†6ÓFõ”e¥5Edçv6ÖÇU£§f&ÕdÖ#$fµ¥„¥$…fæsCd”e&õ¥4&¦#'‡6u&Æ6”¤¤‡G#—6$vÆµ¥„£””v††7”'V'”#%•w‡¤4'¦tgu¥3FuS'G4„'&Ö6vDv†Ä”tçf$w‡¤ug•”6³u„sFt”4ve6³u„sV6&”t”4&¦##W¦D4&¦#'‡6u&Æ6¶G–#5gv7”””ucFDugV3&Çf&“V¦#'‡6u&Æ6¶G–#5gv7£‡V%tgt´g‡T”4t”4t´„æ¦ugE•Tçf$w‡¤ug•#4§fE„4”vÄF#'‡6u&Æ6¶G–#5gtµFöufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•#4§fE„uCFvS‡T”4t”4t”4&¦##W¦D4&¦#'‡¤”Ct´„æ¦ugE•Tçf$w‡¤ug•#4§fE„U“#—6$vÆµ¥„§¤”C‚ô”gFDµg‡T”4t”4t”4t”3WE•„ô´vÄF#'‡6u&Æ6–¶uCFvS‡T”4t”4t”4t”4u“#—V35u“#—4”Cu“#—6$vÆµ¥„§¥“V&Tçf$w‡¤ug•…GF6&Ç‡T”4t”4t”4t”4vu–t´tçf$4•4'VEw‡4µ4#u„sFt”4t”4t”4t”4t”tçf&äçf$uWVC$g–&–†6&”t”4t”4t”4t”4t”4&ufÄ¤åS4'–sVåÓ—U¥W‡e•u&Æ6Ä'6EvG&¦öudv†Ä”tçf$w‡¤ug””vG–#5gt”4Ö¶S&ÄF#'‡6u&Æ6¶G–#5gve4&†D…&Æ%„#¥uvDs†v6ÕfÕ¥„¦Æ&ÔæÄ”tVu“#—6$vÆµ¥„–t—•#vTçf$w‡¤ug–e4&–E…v&Ó“”u§fEsV´Æ”%F&Çv4vÇU§”#uVu“#—6$vÆµ¥„¦tÄg‡T”4t”4t”4t”4t”4ó‡T”4t”4t”4t”4t”4'•¥…#6ÓFv&åg6$GF6&”t”4t”4t”4t”ƒ6&Ç‡T”4t”4t”4t”4v6ÕcE„§T”tçf$GF6&”t”4t”4t”4#”µg‡T”4t”4t”4t”3VÖwƒ¥„–ô´tçf$6³d”tçf$4'7”%uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„–uCFu“#—4”4S””sS$wwó‡U„sFt”4t”4t”„¦ÆD…g–&”#u„sFt”4t”4t”4u“#—6$vÆµ¥„§¤ö”&¦#'‡¤Äg‡T”4t”4t”4t”sV†%uSd”„æ¦ugE•Tçf$w‡¤ug•#4§fE„V&ÔgE¥7†6&”t”4t”4veGF6&”t”4t”ƒ5„sFt”4tµGF6&Ç‡T”4t”ucFDugV3&Çf&“W¦4„§&ÖG¥“VÖ#4¤e•tæô´6‡¥“&†Æ%teF4„§&Ö74”vÅF4„§&Ö7”C´”‡F6&”t”4t”tçf&äã”„æ¦ugE•WfsS7”””„æ¦ugE•dçv6ÖÇU§“W#&ÇVD„Óu„sFt”4t”4'¦”ö3$æõ¥s…6Ó—&å'¤”C””sS$ww”‡F6&”t”4t”4u“#—V3#—5¥3S5•„§T´t%uV³F4„§&ÖD6##VÅDs–…¤ug•Twƒ£&ÇTö”%VuVv34'–sVä”4Ö¶S&ÅF4„§&ÖC””v††7”'V'”'#&ÇVD„×T”dç&„'vsVä”…&õ¥4'¦4„§&ÖFtµGF6&”t”4t”4v6ÕcE„§Tó‡T”4t”4veg‡U„sFt”4t”4dÇ”'v6Õgu•„¦Ä”tçf$w‡¤ug–3‡T”4t”4u“#—V35u“#—6$vÆµ¥„¤†6Ó“4„äv#4¥F4„§&Ö6u4'¥“&†Æ%teF4„§&Ö7U“#—6$vÆµ¥„¤†6Ó“4„æ6&”t”4t”4u“WE•„ô´vÄF#'‡6u&Æ6¶G–#5gtµ4•”#u„sFt”4t”4t”4u“#—V35u£4§fE„u4&¦#'‡6u&Æ6¶G–#5gv7£‡Us&ÄF#'‡6u&Æ6¶G–#5gu…GF6&Ç‡T”4t”4t”4t”vÆÔ”6†æ6Ó“44•4'VEw‡4µ4#u„sFt”4t”4t”4t”4&¦##W¦#'†ÄÆæF†6ÓFõ„sFt”4t”4t”4t”4t”t%uV³F4„§&ÖD6##VÅDs–…¤ug•Twƒ£&ÇTö”%VuVv34'–sVä”4Ö¶S&ÅF4„§&ÖC””tcDugF4…&Å¤4#'”'•¥u¦Æ6ÕgU“%Vu•4&¦#'‡6u&Æ6”&æ6Ó“44¤¤‡G#—6$vÆµ¥„¤†6Ó“4ƒu–åc”sWfD4&Ö#5gU¤3FuS'G4„'&Ö6vDv†Ä”tçf$w‡¤ug””vG–#5gu”7†6&”t”4t”4t”4t”6³u„sFt”4t”4t”4t”4'•¥…#6ÓFv&åg6$GF6&”t”4t”4t”4#•„sV6&”t”4t”4t”4'•¥…#6ÓFu£4§fE„u„sFt”4t”4t”ƒ„sFt”4t”4t”3VÖwƒ¥„–ô´vG–#5gtµFöu£4§fE„v„ÖufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•#4§fE„uCFu£4§fE„t•Cv&åg6$6³u„sV6&”t”4t”tçf&äã”tæÆ&å&Æ6”””„æ¦ugE•dçv6ÖÇU§“V¥¥sS¥„–t•Cv&åg6$4ô”…&ö6ÕfÅFÓ–µ¥„æ&3$æõ¥s…S4'–sVäÆÔæÆ&å&Æ6Ãtö”#&Õ&Å¦ÖÇU¥uu„sV6&”t”4t”w†ÆD4'v6Õc%S$æõ¥s…6Ó—&åd”e—…S4'–sVåÓ—U¥dæ¦ugE•3UF4„§&ÖD6##VÅ6Ó—&åvd4#&Õ&Å¦ÖÇU¥uu„sFt”4t”4'¥“&†Æ%td¶#&ÇVD„×U¦Ó—•%tf¦6vö3$æõ¥s…6Ó—&å”C´”‡F6&”t”4t”4vu–t´„'•¥…¥E“&†Æ%td¶#&ÇVD6¶vS‡T”4t”4t”4t”3‡d”„'•¥„&†6ÕVv&Ó–µ¥g‡T”4t”4t”4t”tçf&äã”sWe¤ud¦&Õ&ÆT4””„'•¥…¥E“&†Æ%td¶#&ÇVD3WV#%&Äó‡T”4t”4t”4t”tçf&äã”sWe¤uVu4#„¦Å¥SWe¤ug¥s#We¤ud¦&Õ&ÆTcu„sFt”4t”4t”4u“#—V35u“&‡$u$¦&Õ&ÆT4””„æ¦ugE•WfsSÆÓWe¤uSu„sFt”4t”4t”4u“#—V35u“&‡$uu4#„¦Å¥SWe¤ug¥s$æöw†µ5sVµ¥††Dó‡U„sFt”4t”4t”4tÇ“†v4„¦Æ4tg•¥4'¥¥…#sVå„sFt”4t”4t”4u“#—V35v3%cDvÇU§¦öuTtg–DvÆ†$G…uV³F4„§&ÖD6##VÅ6Ó—&å%E¥…#sVæ7£Fu4#u„sFt”4t”4t”4t”4&ö…%5•u'E„Ód”„'•¥…¥E“&†Æ%td¶#&ÇVD3Vö…%5•u'E„×5„sFt”4t”4t”4t”4&¶6Ôfå&Ó—•“%Sd”„'•¥…¥E“&†Æ%td¶#&ÇVD3V¶6Ôfå&Ó—•“%W5„sFt”4t”4t”4t”4&æ6Ôc&…#UTs“5¥„“d”„'•¥…¥E“&†Æ%td¶#&ÇVD3Væ6Ôc&…#UTs“5¥„—5„sFt”4t”4t”4t”4'¦DvÆÕ¦ÓVÆ34Ód”„'•¥…¥E“&†Æ%td¶#&ÇVD3W¦DvÆÕ¦ÓVÆ34×5„sFt”4t”4t”4t”4&æ6Ôc&…#U$vÇ”öÇ‡T”4t”4t”4t”4t”4'v6Õc%S$æõ¥s…6Ó—&åU£4¦†FÖÃUU'6”…4'VEw‡5„sFt”4t”4t”4t”4t”4u”'U¥†6udV…5%UWUfÕf¦Ds—”×–wÆÕ§–##&6ä¦†U6‡v6Õc%S$æõ¥s…6Ó—&åU£4¦†FÖÃUU'6–Æ6&”t”4t”4t”4t”4t”4d”…gU¤ufÖsVÅ¤7†6&”t”4t”4t”4#”ó‡U„sFt”4t”4t”4tÇ“†u“4¦Å•…&Ä”„çv6ÖÇU§”&–##VÆ3‡T”4t”4t”4t”tçf&äã”wfsS”CvDv‡7“Vfsv#4£6Ó—&åö&Ó–µ¥7vu“&‡$u4”„æÆD…'&Ö74”tçf$w‡¤ug•#4§fE„'¥&Ó—•S4'–sVäµGF6&”t”4t”4t”4'¦”õ“%gVDug”µ4#u„sFt”4t”4t”4t”4'#&ÇVD3V¥¥sS¥„–u4&¥¥sS¥„“u„sFt”4t”4t”4veg‡U„sFt”4t”4t”4v%tgU•vFÆ6“V…¤u$¶#&ÇVD6‡#&ÇVD6³u„sFt”4t”4t”ƒ6&Ç‡T”4t”4t”4'v6Õc%S$æõ¥s…6Ó—&åu4'¥“&†Æ%td¶#&ÇVDGF6&”t”4t”ƒó‡T”4t”ƒó‡U„sFt”4tÇ“†vsWD4'¦4„§&Ö6u–Ó—U¥„æ6&”t”4'E•sV…£%g”ÆäæÆDVÇV…%FDtc¥6wó‡U„sFt”4v6ÕcE„§T”s†&Ôfå¥„“u„sFt”ƒ6&Ç‡T”4'v6ÖÃ%•…&Ä”tg¦UsV¤”c“$ÔVÇF4s—–D6†æ$…&Ôö”$…De$tµFöuT„§f%vÇ¥¥G…uV³F4„§&ÖD6##VÅEtgU•vFÆ6”#„”sS$wr´”‡F6&”t”4&¦##W¦D4'3#—T”Cu£'ƒ¦“Wu•„§¥¥„—Väçf&”&†7”$…De$uS$æõ¥s„Æ¶Ä…De$tó‡U„sFt”4tÇ“†u¥tg–$†¶u•t§f6åvu–v…u¤s–Æ3#FæD4#3%VvFä§E„sFt”4u“#—V35v„åuV³f3%f´”Cväçf&“VÆT…&Æ&äç##W¥e„æÅ¤C‡VsVµ¥†…¦–våfÄ¤ä§–¶t•C””3„ó‡T”4t”vÆÔ”6v†„åuV³f3%f´µ4#u„sFt”4t”4'•¥…#6ÓFv&åg6$GF6&”t”4#•„sV6&”t”4dÇ”&Å•„§6U4&…–Ó—–D4'¦”'D4&¶#%g¦&–C”v††FÕVu–Ó—U¥4&æ6Ó“4„æ6&”t”4&¦##W¦D4&ÆT…&Æ&äç##Fu4'3#—TÆÕcFDugV3&Çf&äÒôÆÇ6åfÄ¤ä£u•„Öuf¤%uV³UfÄ¤ä”‡vvEsVµ¥u§&Õf´ó‡T”4t”tçf&äã”„æ¦ugE•dæÅ“#—U¤tg–UTgVs†DvÇf&”””ucFDugV3&Çf&£‡V3%f¦##Vµ•„£UsW%tcs—Tó‡T”4t”vÆÔ”6v†3$æõ¥s…S%f¦##Vµ•„£UsW%tcs—Tµ4#u„sFt”4t”4'•¥…#6ÓFv&åg6$GF6&”t”4#•„sV6&”t”4&¦##W¦D4'¥“&†Æ%td6##VÅ#4§fE„'¤”Cv3$æõ¥s…S%f¦##Vµ•„£UsW%tcs—U“V–##VÅ#4§fE„'¤ó‡T”4t”vÆÔ”6v†3$æõ¥s…Ó—U¥VG–#5gv7–¶vS‡T”4t”4v6ÕcE„§T”sS$wsu„sFt”4veg‡U„sFt”4u“#—V35v%tgU•vFÆ6”””sVÆG”%uV³F4„§&ÖD6##VÅEtgU•vFÆ6–wó‡U„sFt”4u“#—V35vDv‡•¥udö#%&Æ7¦öudV…5%UWUC$§¥tãÓ&%…4””tc5•vÃ”vG6Du—V4tg–3%g”ÆÖFÆDU&Æ4ugU¤ugU“&ÆÆ7–væ&Ó–µ¥67ó‡U„sFt”4u“#—V35u“#—6$vÆµ¥„¤†6Ó“4„Öu4'¥“&†Æ%teE¥tçf&Õ&†6æÄ&&ÖÇE•…'##GU“#—6$vÆµ¥„¤†6Ó“4„ÒôÆÓ†46†6&”t”4t”6‡¥“&†Æ%tdF#'‡6u&Æ6¶G–#5gtÄ4'#—6$vÆµ¥„¤†6Ó“46³d”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6¶G–#5gt”‡vv&åg6$4•”#u„sFt”4t”4t”tçf&äã”sWe¤uVu4#„¦Å¥SWe¤ug¥s4æ¦ugE•Tçf$w‡¤ug•#4§fE„V&Ó–µ¥4fDó‡T”4t”4t”4'¦”ö&Ó–µ¥4•4'VEw‡4µ4#u„sFt”4t”4t”4u“#—V3#—5¥3S5•„§T´g‡T”4t”4t”4t”4u”e¥5Edçv6ÖÇU£§f&ÕdÖ#$fµ¥„¥$…fæsCd”e&õ¥4&¦#'‡6u&Æ6”&æ6Ó“44¤¤‡G#—6$vÆµ¥„¤†6Ó“4ƒu•…#¥svDuf´”…'d”„¦Å¦Õg•¥sV¥¥4&„”sWe¤uVt—•#v3$æõ¥s…#—6$vÆµ¥„¤†6Ó“43WV#%&Æe4&–E…v&Ó“”u§fEsV´Æ”%F&Çv4vÇU§”#uVu“#—6$vÆµ¥„–u£4§fE„&tÄg‡T”4t”4t”4t”6³u„sFt”4t”4t”4v6ÕcE„§T”sS$wsu„sFt”4t”4t”ƒ6&Ç‡T”4t”4t”4&¦##W¦D4&¦#'‡6u&Æ6äÖu4ö3$æõ¥s…#—6$vÆµ¥„¤†6Ó“43V¦#'‡6u&Æ6äÖu£†usÆÓ†46vö3$æõ¥s…#—6$vÆµ¥„—4”vÄF#'‡6u&Æ6–¶uCFvS‡T”4t”4t”4t”tçf&äã”s–Õ¦äæÆD4””sVÆG”%U4d¤e%3Uu¥tã#4—¤´DTÔ7vtÔ3GtÄ4tÆ¤ó‡T”4t”4t”4t”vÆÔ”6‡¥“&†Æ%tdF#'‡6u&Æ6“We¦Õ§¥¥…”‡F6&”t”4t”4t”4t”s–Õ¦äæÆD3W¥¥…õ„sFt”4t”4t”4t”4t”„æ¦ugE•Tçf$w‡¤ug”ÆÓ–Õ¦äæÆD3SD”C‚ô”DTÔ7†6&”t”4t”4t”4t”4v3$æõ¥s…#—6$vÆµ¥„—V#%¦Ö3%cÆæ¶u£†tÔ3GtÄg‡T”4t”4t”4t”4t”4'¥“&†Æ%tdF#'‡6u&Æ6“We¦Õ§¥¥…VV”ô”3¥“&†Æ%tdF#'‡6u&Æ6“We¦Õ§¥¥…VV”d”DTÔ7vtÇ“†vV”'7”'f4„'f3&Ã¥4'&”%uV³tÆ¤&6&”t”4t”4t”4t”6³u„sFt”4t”4t”4veg‡U„sFt”4t”4t”4v6ÕcE„§T”…&ö„×Uƒ&ÇF4s—–Ddçvug•¥Tçf$w‡¤ug”´sWe¤uW4”‡F6&”t”4t”4t”4t”s–Õ¦äæÆD7†6&”t”4t”4t”4t”„¦…¤vÃ7¦öv3$æõ¥s…#—6$vÆµ¥„—V6Ôf¶…g¤”C‚ô”DTÔ7†6&”t”4t”4t”4t”vÇV3&Æµ¥Föu¦Ôg63%W5„sFt”4t”4t”4ve6³u„sFt”4t”4t”ƒó‡U„sFt”4t”4t”„¦ÆD…g–&”#t”tçf$w‡¤ug–7”#”ó‡T”4t”4ve7†6&”t”4ó‡U„sFt”4tÇ“†vsv#4£”„çv6ÖÇU§”&–##VÆ7”&Ö#4–u¥tf¦4'¦4„§&Ö6u–Ó—U¥4&æ6Ó“4„æ6&”t”4'¥“&†Æ%td6##VÅ#4§fE„'¥“VÖ#4¤e•tæô´6‡¥“&†Æ%td6##VÅ#4§fE„4”vÄ6##VÅ#4§fE„”C´”‡F6&”t”4t”tçf&äã”„§f#5$¦&Õ'“%g¤”Cv3$æõ¥s…Ó—U¥VG–#5gtÆÔ§f&Õg¤ó‡T”4t”4vu–t´4g–##“5sV¶tæÆ7–¶vS‡T”4t”4t”4'•¥…#6ÓCu„sFt”4t”4#•„sV6&”t”4t”„§f#5$¦&Õ'“%g¤ÆÕ§f6µf…“&vô´„§f#5$¦&Õ&ÆT6¶uCFvS‡T”4t”4t”4&¦##W¦D4'–##“”CvDv‡•¥udö#%&Æ3G–##“5sVµ¥††Dó‡T”4t”4t”4'¦”ö6Ó—fD4•4'VEw‡4µ4#u„sFt”4t”4t”4u“#—V3#—5¥3S5•„§T´g‡T”4t”4t”4t”4u”e¥5Edçv6ÖÇU£§f&ÕdÖ#$fµ¥„¥$…fæsCd”e&õ¥4'¦4„§&Ö6u–Ó—U¥4&æ6Ó“44¤¤‡GÓ—U¥VG–#5gve4&†D…&Æ%„#¥uvDs†v6ÕfÕ¥„¦Æ&ÔæÄ”tVv&Ó–µ¥4¤¤‡G–##“5sVµ¥†ƒ””t£D4'V#5u¦Ó“&ÕT”dç&„'vsVä”…&õ¥4'V#%&Å”7†6&”t”4t”4t”4ó‡T”4t”4t”4t”„¦ÆD…g–&§F6&”t”4t”4veg‡U„sFt”4t”4t”3‡d”„'•¥„&†6ÕVv3%cDvÇU£‡T”4t”4t”4&¦##W¦D4&æ6Ôc&…#U$vÇ””Cv&Õc4”e$•VµddÆÅ¦Å“5'f6¤ÖôµGF6&”t”4t”4vu–t´„æ¦ugE•T§f&Õd†6Ó“43Væ6Ôc&…#U$vÇ”µ4#u„sFt”4t”4t”4u£4¦†FÖÃUU'6“W¥¥…õ„sFt”4t”4t”4t”4'¥“&†Æ%td6##VÅ#4§fE„U£4¦†FÖÃUU'6“SD”C‚ô”DTÔ7†6&”t”4t”4t”4t”„æ¦ugE•T§f&Õd†6Ó“43Væ6Ôc&…#U$vÇ”Ææ¶u£†tÔ3GtÄg‡T”4t”4t”4t”4v3$æõ¥s…Ó—U¥VG–#5gtÆÖG••…§D†ÄV„—VV”õ”tÆ¤5„sFt”4t”4t”4tµGF6&”t”4t”4ve4&Æ$„æÄ”‡F6&”t”4t”4t”4&æ6Ôc&…#U$vÇ”ÆäæÆD6wtÆ¤4”3„Æ¤4”DTÔ6³u„sFt”4t”4t”ƒ6&Ç‡T”4t”4t”4&¦##W¦D4&¥¥sS¥„–u4'¥“&†Æ%td6##VÅ#4§fE„U“%gVDug””4S””sS$wvu”#„¦Å¥SWe¤ug¥s4æ¦ugE•T§f&Õd†6Ó“43V¥¥sS¥„¦D”FövEsVµ¥u§&Õf´ó‡U„sFt”4t”4t”tçf&äã”„æÆD…'&Ö3d”d&†6å'•ws…fÄ¤åS4'–sVåÓ—U¥WfsSS%cDvÇU£4Ò´”CvS‡T”4t”4t”4t”v‡Dd¦…¤vÃ7¦öv3$æõ¥s…Ó—U¥VG–#5gtÆÖ‡Dd¦…¤vÃ7—†6&”t”4t”4t”4&¶6Ôfå&Ó—•“%Sd”„æ¦ugE•T§f&Õd†6Ó“43V¶6Ôfå&Ó—•“%W5„sFt”4t”4t”4u£4¦†FÖÃUd'fC%g”ö”'¥“&†Æ%td6##VÅ#4§fE„U£4¦†FÖÃUd'fC%g”Äg‡T”4t”4t”4t”„ãu¦Ö&Õg¦7¦öv3$æõ¥s…Ó—U¥VG–#5gtÆäãu¦ÖsVÆ34×5„sFt”4t”4t”4u£4¦†FÖÃUU'6—†6&”t”4t”4veGF6&Ç‡T”4t”4t”4dÇ”'v6Õgu•„¦Ä”tçf$w‡¤ug–3‡T”4t”4t”4&¦##W¦D4&¦#'‡6u&Æ6¶G–#5gv3§f6Äçv6ÖÇU§”””„æ¦ugE•T§f&Õd†6Ó“43V¦#'‡6u&Æ6¶G–#5gv3‡T”4t”4t”4t”C‡V%tgt´6‡#—6$vÆµ¥„¤†6Ó“46¶uCFvS‡T”4t”4t”4t”4u“#—V35u£4§fE„u4&¦#'‡6u&Æ6¶G–#5gv7£‡Us&ÄF#'‡6u&Æ6¶G–#5gu…GF6&Ç‡T”4t”4t”4t”4vu–t´vG–#5gt”C””sS$ww”‡F6&”t”4t”4t”4t”4u“#—V3#—5¥3S5•„§T´g‡T”4t”4t”4t”4t”4t”t%uV³F4„§&ÖD6##VÅDs–…¤ug•Twƒ£&ÇTö”%VuVv34'–sVä”4Ö¶S&Ä6##VÅ#4§fE„#””tcDugF4…&Å¤4#'”'•¥u¦Æ6ÕgU“%Vu•4&¦#'‡6u&Æ6”&æ6Ó“44¤¤‡G#—6$vÆµ¥„¤†6Ó“4ƒu–åc”sWfD4&Ö#5gU¤3FuS'G4„'&Ö6vDv†Ä”tçf$w‡¤ug””vG–#5gu”7†6&”t”4t”4t”4t”4tµGF6&”t”4t”4t”4t”4v6ÕcE„§T”sS$wsu„sFt”4t”4t”4t”4#•„sV6&”t”4t”4t”4t”„¦ÆD…g–&”&æ6Ó“4GF6&”t”4t”4t”4#”µg‡T”4t”4t”4t”3VÖwƒ¥„–ô´vG–#5gtµFöu£4§fE„v„ÖufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•#4§fE„uCFu£4§fE„t•Cv&åg6$6³u„sV6&”t”4t”4tÇ“†u“4¦Å•…&Ä”„çv6ÖÇU§”&–##VÆ3‡T”4t”4t”4'–##“Æå'••…¦Æ6äæÄ´6‡V#%&Äµ4•”#u„sFt”4t”4t”4u“#—V35u“&‡$ud”e$•VµddÆ³––Õf¦DDäT”‡vv&åg6$4””sWe¤uWU“&‡$u'•¥sV$Ôcu£†v&åg6$GF6&Ç‡T”4t”4t”4t”tçf&äã”wfsS”CvDv‡7“Vfsv#4£6Ó—&åö&Ó–µ¥7vu“&‡$u4”„æÆD…'&Ö74”tçf$w‡¤ug•#4§fE„'¥&Ó—•S4'–sVäµGF6&”t”4t”4t”4'¦”õ“%gVDug”µ4#u„sFt”4t”4t”4t”4'#&ÇVD3V¥¥sS¥„–u4&¥¥sS¥„“u„sFt”4t”4t”4veg‡U„sFt”4t”4t”4v%tgU•vFÆ6“V…¤u$¶#&ÇVD6‡#&ÇVD6³u„sFt”4t”4t”ƒó‡T”4t”4ve6³u„sFt”4ve6³u„sV6&”t”4dÇ”'&ÖÃ”„çv6ÖÇU§”&–##VÆ3‡T”4t”vG6Du—V3$æÆ&ÕWVE„&µ•…&ÅEtc6ÖÃEc#—–$uôµGF6&”t”4'E•sV…£%g”ÆäæÆDVÇV…%FDtc¥6wó‡U„sFt”4v6ÕcE„§T”s†&Ôfå¥„“u„sFt”ƒ6&Ç‡T”4'v6ÖÃ%•…&Ä”c—%„'f6å$¶#&ÇVD6†6&”t”4'V#%&Äö”%U4d¤e%3U–×Å“5¥$7†6&”t”4&¦vÇ5¤FöudV…5%UWUC$§¥tãÓ5„sFt”4v3%cDvÇU§£ƒd”d&†6å'•ws…fÄ¤åS4'–sVåÓ—U¥WfsSS%cDvÇU£4Ò´Äg‡T”4t”tçf$w‡¤ug•#4§fE„'¥&Ó—•S4'–sVå¦öufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•#4§fE„&%…7†6&”tµFöufÄ¤åS4'–sVåÓ—U¥WfsS”‡F6&”t”4&¦##W¦D4'¦4„§&ÖD6##VÄ”Cv&Õc4”e¥5Edçv6ÖÇU£§f&Õd¶#&ÇVD6‡V#%&ÄÄ4&¦vÇ5¤7vv3%cDvÇU§—vu“#—6$vÆµ¥„¤†6Ó“4„äv#4¥F4„§&Ö7ó‡U„sFt”4vu–t´…&ö„×VÓ—&å$•¥w‡u¥„¥6##“µ4#u„sFt”4t”4&¦##W¦D4&õ¥w‡u¥„–u4'U¥†6ufÄ¤åS4'–sVåÓ—U¥WfsS4ug64ug”´„çv6ÖÇU£§f&ÕWó‡T”4t”4vDv‡7“W#&ÇVDV†Æ$„&Æ6Ä§f#5U•u&´´v†Æ$„&Æ6–³u„sFt”4t”4&õ¥w‡u¥„—V6ÕgU¤ug•C4¦µ¥„–u4#vÇ¤Æ×fsS4ug64ug•VÓ—fD3W•¥sVµ¥„¥6Õ&Æ6§F6&”t”4#•„sV6&”t”4'•¥…#6ÓFv34'–sVåÓ—U¥GF6&”veg‡U„sFt”„'–…¦†DuVuƒ&ÇF4s—–Ddçvug•¥Tçf$w‡¤ug”´g‡T”4t”u&Æ35'&Ôcs—Tö”%U4d¤e%3U–×Å“5¥$7†6&”t”4'u•„¦†%„Ód”‡F6&”t”4t”s–Õ¦äæÆDFöudV…5%UWUfÕf¦Ds—”×§F6&”t”4t”„¦…¤vÃ7¦öv&ågE–Õg”ó‡T”4t”4vsW¦u&Äö”&–##—5¥tgTó‡T”4t”ƒ5„sFt”6³d”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6”#u„sFt”4u“#—V35v3&††4uVu4'U¥†6ufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•S&††4ueF4v†Æ6ÕVö4tg••s¤µGF6&Ç‡T”4t”tçf&äã”tçf$w‡¤ug””Cv&Õc4”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6–‡¦tgu¥6³u„sV6&”t”4&µ¥„ãsV†DvÇf&“V…¤uõ“#—6$vÆµ¥„—ó‡U„sFt”4vu–t´…&ö„×U“#—6$vÆµ¥„¤•¥w‡u¥„¥6##“µ4#u„sFt”4t”4&¦##W¦D4&õ¥w‡u¥„–u4'U¥†6ufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•4ug64ug”´tçf$w‡¤ug”µGF6&”t”4t”…&ö„×U“#—6$vÆµ¥„¤•¥w‡u¥„¥6##“ÆÔfµ¤6†õ¥w‡u¥„—ó‡T”4t”4vug64ug”Æä¦Æ&Õ&Æ6³—•¤ug””CvDv‡7“V¦#'‡6u&Æ6¶†Æ$„&Æ6Ä§f#5V6ÕgU¤ug•C4¦µ¥„“u„sFt”4veg‡U„sFt”4v6ÕcE„§T”tçf$w‡¤ug”ó‡T”4#•„sV6&”v4„§FÔc¥4&fsv#4£$gv35g5¥Tçf$w‡¤ug”´g‡T”4t”u&Æ35'&Ôcs—Tö”%U4d¤e%3U–×Å“5¥$7†6&”t”4'u•„¦†%„Ód”‡F6&”t”4t”s–Õ¦äæÆDFöudV…5%UWUfÕf¦Ds—”×§F6&”t”4t”„¦…¤vÃ7¦öv&ågE–Õg”ó‡T”4t”4vDtg$FöudV…5%UWUfÕf¦Ds—”×§F6&”t”4t”vÇV3&Æµ¥Föu–Ó—f$uf†&§F6&”t”4#”Äg‡T”4ö”%uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„–vS‡T”4t”tçf&äã”„æõ•„&Ä”Cv&Õc4”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6Äæõ•„&Å$gv35g5¥6‡u•„¦†%„×ó‡U„sFt”4u“#—V35u“#—6$vÆµ¥„–u4'U¥†6ufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug”´„æõ•„&ÄµGF6&Ç‡T”4t”u&Æ35'&Ôcs—TÆÔfµ¤6†¦#'‡6u&Æ6–³u„sV6&”t”4'¦”öDv‡7“V¦#'‡6u&Æ6¶†Æ$„&Æ6Ä§f#5”‡F6&”t”4t”tçf&äã”v†Æ$„&Æ6”””sVÆG”%uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„¤•¥w‡u¥„–õ“#—6$vÆµ¥„—ó‡T”4t”4vDv‡7“V¦#'‡6u&Æ6¶†Æ$„&Æ6Ä§f#5U•u&´´v†Æ$„&Æ6–³u„sFt”4t”4&õ¥w‡u¥„—V6ÕgU¤ug•C4¦µ¥„–u4#vÇ¤ÆÔçf$w‡¤ug•4ug64ug•VÓ—fD3W•¥sVµ¥„¥6Õ&Æ6§F6&”t”4#•„sV6&”t”4'•¥…#6ÓFu“#—6$vÆµ¥„“u„sFt”ƒ6&Ç‡T”4'v6ÖÃ%•…&Ä”c—%„'f6å%$tgU¥Tçf$w‡¤ug”´g‡T”4t”u&Æ35'&Ôcs—Tö”%U4d¤e%3U–×Å“5¥$7†6&”t”4'u•„¦†%„Ód”‡F6&”t”4t”s–Õ¦äæÆDFöudV…5%UWUfÕf¦Ds—”×§F6&”t”4t”sWf6Ó†$FöudV…5%UWUfÕf¦Ds—”×§F6&”t”4#”Äg‡T”4ö”%uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„–vS‡T”4t”tçf&äã”„æõ•„&Ä”Cv&Õc4”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6Äæõ•„&ÅTw††&ÕVö4tg••s¤µGF6&Ç‡T”4t”tçf&äã”tçf$w‡¤ug””Cv&Õc4”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6–‡¦tgu¥6³u„sV6&”t”4&µ¥„ãsV†DvÇf&“V…¤uõ“#—6$vÆµ¥„—ó‡U„sFt”4vu–t´…&ö„×U“#—6$vÆµ¥„¤•¥w‡u¥„¥6##“µ4#u„sFt”4t”4&¦##W¦D4&õ¥w‡u¥„–u4'U¥†6ufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•4ug64ug”´tçf$w‡¤ug”µGF6&”t”4t”…&ö„×U“#—6$vÆµ¥„¤•¥w‡u¥„¥6##“ÆÔfµ¤6†õ¥w‡u¥„—ó‡T”4t”4vug64ug”Æä¦Æ&Õ&Æ6³—•¤ug””CvDv‡7“V¦#'‡6u&Æ6¶†Æ$„&Æ6Ä§f#5V6ÕgU¤ug•C4¦µ¥„“u„sFt”4veg‡U„sFt”4v6ÕcE„§T”tçf$w‡¤ug”ó‡T”4#•„sS•„sF”Ä4–sv#4£”…#V4uVt¶”&†7”%U4d¤e%4&Ö6Ó—D”6C„¦Å¥63u„sV6&ÕcF4s—–D4&ÖEsV¦DvÇf&”#6Ôc%¥„§¥¥TgU“%g¦Ds—–3§–##6##“´s––Õf¦DFöudV…5%UWUC$§¥tãÓ4”tæ†$w†••tç$ö”ö#$§¥tãö”%U4d¤e%3U–×Å“5¥$6¶uCFvFÓ—¤6³d”…§fuvS‡T”4&¦##W¦D4&†&ÔæÆ35'f6äÓd”e$•VµddÆ³––Õf¦DDäUsu4&%…GF6&Ç‡T”4'5¥…vuf…¤FöudV…5%UWUC$§¥tãÓvd4'VEw‡4”Cv#$§¥tãó‡T”4#6vÇ5¥4öuf…¤4…Cv&åg6$6¶vS‡T”4t”tgU“%g¦Ds—–7“S&äæöu£´v†Å•uó‡T”4t”v†Å•uu4&õ¥tf´Æä&†6ÕgVDGF6&”veg‡U„sFt”tgU“%g¦Ds—–7“VÖ#4¤e•tæô´6††&ÔæÆ35'f6–¶uCFvS‡T”4t”tæ†$w†••tç$´tgU“%g¦Ds—”µGF6&”ve6³u„sS•„sF”Ä4–sv#4£”…#V4uVt¶”&†7”%U4d¤e%4&Ö6Ó—D”6C„¦Å¥63u„sV6&“‡¶Ç‡T”6öud„¦†FÕg–3%Vu“&‡$u'•¥sFv#%–u£&Ã%¥sFv#$§¥tã”tgU¤4&ÆTuf¦E…&Ä”vGFÕgT”tæ†$w†••tç$ÆÇ‡T”6öudv†Ä”vGFÕgT”s––Õf¦D4'D„æÆ$u–vC#—VD4&•¥4&æ…¦Æ&”#'”#uVu“$g6$t¦…“'7U„sFt¶”$¥¦”#uVv6ÕcE„§T”…¦†$…fÄ”s–Ô”…&õ¥4&¥•w‡5–Ôf¦”'7”&vD„£¥t4”vÃ”†G$wvvtg6D4#uVvD„¦†FÕg–3$g4”s–Ô”vÃ7”&¦vÇ5¤„¦Æ&“V6&””T'u•„¦†%4'e–×Å“5u4'–##“”s––Õf¦Dg‡T”6öu„&†6ÔgD”tæ†$w†••tç$”TVu“$g6$t¦…“'6u¦ågU“5'##Fu“$g6$uf´”u§f6”&Å•tæô”tæöw†¶6ÕgU„sFt¶“–6&ÕcF4s—–D4&ÖEsV¦DvÇf&”#6Ôc%¥„§¥¥Tæöw†¶6ÕgUesSw„F##V¶…'##Tå¥…õ„sFt”s––Õf¦DFöudV…5%UWUC$§¥tãÓ5„sFt”tæ†$w†••tç$ö”ö#$§¥tãö”%U4d¤e%3U–×Å“5¥$6¶uCFu–Ó—f$uf†&—†6&–³d”…§fuvS‡T”4'e–×Å“5U“&‡$u'•¥sGU¦Ó—•%tf¦6võ“&‡$u”C´”‡F6&”t”4&¦##W¦D4'•¥„ã$…u4&¥•w‡5–Ôf¦–†¦vÇ5¤6³u„sFt”4vu–t´4g•¥„ã$…”‡F6&”t”4t”…'••…¦Æ6äæÅ&‡$u'•¥sUf&å'$Tçf&Õ'DvÇf&³ÆD6†¦vÇ5¤7vu“$g6$t¦…“'7ó‡T”4t”ƒ6&”ve6³u„sS•„sF”Ä4–sv#4£”…#V4uVt¶”&†7”%U4d¤e%4&Ö6Ó—D”6C„¦Å¥63u„sV6&“‡¶Ç‡T”6öu&ÖÇU¤„ÖvDv†Ä”w‡fC%g¦D4&¦##F##Fu•sV¥¥„ã#4§¤”s–Ô”…&õ¥4&æ…¦Æ&”'e–×Å“5'¤Ä4'¦”'D4&ÆTvÇ¦D„×U„sFt¶”$4tg••sv#$§¥tã7”%VuVv#$§¥tã7”#'”&ÖsV´”…&õ¥4'6#6FÆ35u“#—F%s—T”tgU“%g¦Ds—””u§f6“V6&”Ã‡U¥†‡v#4£”u£&Ôãs—T”w‡fC%g¦DTçf%sf&´gU“%g¦Ds—”´s––Õf¦D„Ód”dæÆDG…U4d¤e%3U–×Å“5¥$CGö”%U4d¤e%3U–×Å“5¥$4#„”sS$wvvS‡T”4&¦##W¦D4'¦tg•¥u$&&ÔæÆ35'f6äÖu4'U¥†6uEtgue$•VµddÆ³––Õf¦DDäTÄ4'VEs•¥„’´´6³u„sFt”u§f6”õ“#—V35v#$§¥tã”s–Ô”s––Õf¦D„×”‡F6&”t”4'5¥…u“5g–6ÕgVDFöudV…5%UWUC$§¥tãÓvd4'VEw‡4”Cv#$§¥tãó‡T”4t”u'd”‡F6&”t”4t”tçf&äã”sVÆC¦†$…fÄ”Ct´„æõ•„¦Å¤TgU“%g¦Ds—–7“Vå¥…õ“5g–6ÕgVD6¶u£†tÔ6¶t·”„ó‡T”4t”4vu–t´sVÆC¦†$…fÄ”C•4'e–×Å“5'¤ÆäçVÕW”‡F6&”t”4t”4v6ÕcE„§T”tã6ä¦Æ&åu„sFt”4t”4#•„sFt”4t”4'¦tg•¥u$&&ÔæÆ35'f6ä×V3%c´tã6ä¦Æ&å4”sVÆC¦†$…fÄµGF6&”t”4t”tã6ä¦Æ&åu4&¦E„§•¥sSÆä&†6ÕgVDGF6&”t”4#””†Föw†Ä”6†¦E„§•¥sS”4S•4'VEw‡4µGF6&”veg‡T”4'•¥…#6ÓFv&åg6$GF6&ã6&”—4”4§%„'f6åvD†Çu¥4”tg¤”e$•Vµdd”u§–##t£5&ö6ÕfÄ§§F6&ÖÇF4s—–D4#U„&Ä”‡6ufÄ¤åS4'–sVåÓ—U¥WfsS”ƒu¦ä§f%4äÆ“•uV³F4„§&ÖD6##VÅ6Ó—&åVäÖäó‡Vsv#4£”‡6vD„¦†FÕg–3%d&&ÔæÆ35'f6ääv6Ó—EVÓ—fD4#””u§–##t§“GfE…'$„×fD„¦†FÕg–3%d&&ÔæÆ35'f6ääv6Ó—EVÓ—fD3W7–3u„sW%„'f6åvD†Çu¥4#t”e¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6”#””u§–##t§“GefÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug”Æ×¤§§F6&ÖÇF4s—–D4#U„&Ä”‡6ufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•#4§fE„ve4&Ö6Ó—D”67TÃ¥5Edçv6ÖÇU£§f&ÕdF#'‡6u&Æ6¶G–#5gtÆ×¤§§F6&ÖÇF4s—–D4#t”…'••…¦Æ6äæÅ&‡$u'•¥sUf&å'$Tçf&Õ'DvÇf&³ÆD4#””u§–##t§“GfE…'$„×fD„¦†FÕg–3%dFvÇ5¤„¦Æ&ÅgVDvÇ5#—U¤vÃs—UEucÆ×¤§§F6&ÖÇF4s—–D4#t”w‡fC%g¦DTçf%sf&´gU“%g¦Ds—””ƒu¦ä§f%4äÆ““DvÇ67“—6#6FÆ35$F##F##T&&ÔæÆ35'f6“W7–3u„sV6&ÕcF4s—–D4&¦$tg¦7”%uV³F4„§&ÖD6##VÅEtgU•vFÆ6”#u„sFt”„'–…¦†DuVuƒ'fsS7”””sVÆG”%E¥……fÄ¤åS4'–sVåÓ—U¥WfsS–wó‡T”4'v6ÖÃ%•…&Ä”c—¦#4£¥u$¶#&ÇVD„Ód”Tg–6ÔcUe¥5Edçv6ÖÇU£§f&Õd¶#&ÇVDCFu4&%…GF6&”v4„§FÔc¥4&ftg¥c$g–&Õfµ&Ç•“5g5•„¤U¥„&Æ&Õ&Æ&ÔãT”Cu¦Ôg63%Su„sV6&”tÇ–÷„sFt”4”TgT”s—•¤ug•¥uv$vÇ¦D4'e¦”&†&ÔæÆ35'f6äÖv#%–u•w‡4”…&õ¥4%F4„§&ÖD6##VÄ”wfsS7“FuÕfÖ#4¦Ä”…&õ¥g‡T”4t¶”%F4„§&ÖD6##VÄ”wfsS7”&¥•sFu–ÕVvE„&µ•…&Å¤7vvDv†Ä”†Gf6×†´”s†D„§“%g¤”s–Ô”…&õ¥„æÄ”tgU“%g¦Ds—–3‡T”4t¶”'FE„ã”t¦Ä”tæ†$tã$tc¥uT”e&õ¥4&Ö„§¦D4&Æ$ugE¥sS”vÇ¤”…&õ¥4'6#6FÆ35u“#—F%s—T”tgU“%g¦Ds—”Ä4&Ö#4¦6&”t”6övC&‡“&vv&Ó“”s—V$†¶v…'¤”†Gf6×†´”s†D„§T4&–E…v…'¤”tgU“%g¦Ds—–7–6vC#—–$uv%tc6ÖÆ¥¥„Öu•„¦Å„sFt”4”…gu¤tc¥uu•„ÖvC%g6$3V6&”t”6÷e„sFt”„'–…¦†DuVuƒ$gU“%g¦Ds—–7¦öudV…5%UWUC$§¥tãÓ&%…4””gFDó‡U„sFt”„#–×‡—”&å¥…vÓ—&å'¤´6³d”dæÆDG…uV³F4„§&ÖD6##VÅ6Ó—&å´”‡F6&”t”4'•¥…#6ÓFvDv‡7“VfÓ—&å'¤ó‡T”4#•„sV6&”tÇ–÷„sFt”4”T&µ¥„'•¥tæ†Duf´”eg¥¥4#uw‡&×6vÓ—&å'¦e4'&äã¥tf´ÆÇ‡T”4t¶“–6&”v4…f–$vÆ¤”vFÆD4'¦4„§&ÖD6##VÆ7–wö”%E¥……fÄ¤åS4'–sVåÓ—U¥WfsS”#u„sFt”4u“#—V3#—5¥3S5•„§T´6EuV³F4„§&ÖD6##VÅEtgU•vFÆ6¦öv34'–sVåÓ—U¥„Öv„Öu¤ugv6Õf¥•…&Å¤3FvE„æÄ”wfsS7”'&äã¥tf´Æ–7ó‡U„sFt”4v6ÕcE„§T”…&ö„×Uƒ'fsS7§F6&”veg‡U„sFt”„#–×‡—”&å¥…u“#—6$vÆµ¥„¤†6Ó“4„ÖôµFöufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•#4§fE„&%…4#u„sFt”4u“#—V35v3%c”Cv&Õc4”dæÆDG…uV³F4„§&ÖD6##VÅ#—6$vÆµ¥„¤†6Ó“4CFôµGF6&”t”4#vÇ¤ÆÃ—#&ÇVD„×U¦Ó—•%tf¦6vö34'–sVåÓ—U¥6¶uCFvS‡T”4t”4v34'–sVåÓ—U¥3V¦#'‡6u&Æ6¶G–#5gv7“VÖ#4¤e•tæô´6†¦#'‡6u&Æ6¶G–#5gtµ4•”#u„sFt”4t”4t”„æÆD3V…¤uõ“#—6$vÆµ¥„¤†6Ó“46³u„sFt”4t”4#”µGF6&”t”4#”µGF6&”t”4'•¥…#6ÓFu„§••†·U¦ä§f%6‡¥¥…ó‡T”4#•„sV6&”v4…f–$vÆ¤”vFÆD4&¦#'‡6u&Æ6äÖôµFöufÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•svS‡T”4t”tçf&äã”„æÆD4””sVÆG”%E¥……fÄ¤åS4'–sVåÓ—U¥Tçf$w‡¤ug•–wó‡T”4t”…&ö„×U“#—6$vÆµ¥„¤†6Ó“4„×U¦Ó—•%tf¦6võ“#—6$vÆµ¥„¤†6Ó“46¶uCFvS‡T”4t”4u“#—6$vÆµ¥„¤†6Ó“43V¦#'‡6u&Æ6ä×U¦Ó—•%tf¦6võ“#—6$vÆµ¥„—”C´”‡F6&”t”4t”4v3%cÆÔfµ¤6†¦#'‡6u&Æ6–³u„sFt”4t”4#”µGF6&”t”4#”µGF6&”t”4'•¥…#6ÓFu„§••†·U¦ä§f%6‡¥¥…ó‡T”4#•„sV6&”v4„§FÔc¥4&f#$§¥tãS4'–sVåÓ—U¥„äå•„u4'U¥†6uEtgue$•VµddÆ³––Õf¦DDäTÄ4%E¥……fÄ¤åS4'–sVåÓ—U¥WfsS£FôµGF6&”v4„§FÔc¥4&f„åF#4£¥u$¶#&ÇVD„äV„£U4””u¦†$„æÄó‡U„sFt”tçf&äã6åf¦Ds—”´6¶vS‡T”4t”…&ö„×Uƒ4¦Æ$uc%•sS&‡$u'•¥sUf4u&†Duf´”CvDv‡7“Vf6Õg5¥…¦†&å$FvÇ5¤„¦Æ&Ågu¤tc¥uU–ÖÇU¤6ƒvÇ¤µGF6&”veg‡U„sFt”„#–×‡—”&…¤u$¶#&ÇVD6‡#&ÇVDFöufÄ¤åS4'–sVåÓ—U¥WfsSµFövFÓ—¤4#u„sFt”4vDv‡7“VfÓ—&å'¤ÆÔfµ¤6‡#&ÇVD6³u„sV6&”t”4'5¥…v#$§¥tãS%c”CvDv‡7“Vf#$§¥tãS4'–sVåÓ—U¥„äå•„U£%c´wfsSÆÔ§f&ÕWó‡T”4t”vÆÔ”6‡e–×Å“5%E¥…uCv&åg6$6¶vS‡T”4t”4v#$§¥tãS%c”Cv&Õc4”dæÆDG…uV³F4„§&ÖD6##VÅ6Ó—&å´´6³u„sFt”4t”4#vÇ¤ÆÃ—e–×Å“5%F4„§&ÖD6##VÆ3†43W¥¥…öÓ—&åU–Ó—U¥7vv#$§¥tãS%cµGF6&”t”4#•„sFt”4v#$§¥tãS%cÆÔfµ¤6‡#&ÇVD6³u„sV6&”t”4#vÇ¤ÆÃ—3çf6å&Å¤WfsS3'6å#T”CvD„£¥GF6&”veg‡U„sFt”3‡¶Ç‡T”4t¶”$¤ugv6Õf¥•…&Å¤4%f3%VvS'6sW$”tfµ¤WfsSe4'&äã¥tf´ÆÇ‡T”4t¶“–6&”v4…f–$vÆ¤”tfµ¤dçv6ÖÇU£§f&ÕVöÓ—&åd”e¥5Edçv6ÖÇU£§f&Õd¶#&ÇVD6³d”…§fuvS‡T”4t”tçf&äçf$uWVC$g–&–våfÄ¤åS4'–sVåÓ—U¥S†&Ôfå¥„“d”tfµ¤dçv6ÖÇU£§f&ÕVôµ4'7”&µ¥„'•¥tæ†Duf´Æ”#3%Vu•u&µ6Ó—&åôµ4'&äã¥tf´Æ–7ó‡U„sFt”4vDv‡7“V…¤u$¶#&ÇVD6‡#&ÇVD6³u„sFt”ƒ6&Ç‡T”4'vEt§6tÖu¤ug5¥…&Å6Ó—&åöÓ—&åd”e¥5Edçv6ÖÇU£§f&Õd¶#&ÇVD6³d”…§fuvS‡T”4t”…&ö„×Uƒ'fsS7“Vµ¥w†ÆDuVöÓ—&åó‡U„sFt”4u“#—V35v#$§¥tãS%c”CvDv‡7“Vf#$§¥tãS4'–sVåÓ—U¥„äå•„U£%c´wfsSÆÔ§f&ÕW•GF6&”t”4'e–×Å“5%E¥…U¤ug5¥…&Ä´wfsSµGF6&Ç‡T”4t”…&ö„×Uƒ&Ç¥S#—–Dufµ6Ó—&å'¥$vÇ–D†¶u4#6åfÄó‡T”4#•„sV6&”tÇ–÷„sFt”4”T&µ¥„'•¥tæ†Duf´”eg¥¥4#uw‡&×6u¤ug5¥…&Å6Ó—&å#””vÇV35&Å•uU„sFt”4Ã‡T”4'vEt§6tÖu¤ug5¥…&ÅS4'–sVåÓ—U¥6‡#&ÇVDFöufÄ¤åS4'–sVåÓ—U¥WfsSµFövFÓ—¤4#u„sFt”4u“#—V3#—5¥3S5•„§T´6EuV³F4„§&ÖD6##VÅEtgU•vFÆ6¦öu¤ug5¥…&ÅS4'–sVåÓ—U¥6w”vÇ¤”u&Æ4„¦Å“$c¥uT”…g¥¥4&µ¥w†ÆDud¶#&ÇVD6w”vÇV35&Å•uT§–³u„sV6&”t”4#vÇ¤ÆÕ&Æ$uc¥WfsS´wfsSµGF6&”veg‡U„sFt”„#–×‡—”'¥¥…$¦&ÖÃS5&†DuVôµFövFÓ—¤4#u„sFt”4vDv‡7“Vf3#—–DWfsS7–wó‡U„sFt”4u¦Ó—””6‡5¥…v4””Dt”v¶u4#vÇ¤ÆÃ—¦#4£¥u$¶#&ÇVD„×V$ugU£5&ô÷”'·—7”‡F6&”t”4t”tçf&äã”„çv6ÖÇU£§f&ÕVu4#vÇ¤ÆÃ—¦#4£¥u$¶#&ÇVD„æ&cu„sFt”4t”4'¦4„§&ÖD6##VÄÆÔ§f&ÕWVE„&µ•…&ÅEtc6ÖÃD´6³u„sFt”4t”4'¦4„§&ÖD6##VÄÆÔ§f&ÕWVE„&µ•…&Åc#—–$u$å•…'–†võ¦Ôg63%W4”u¦†$„æÄµGF6&”t”4t”„çv6ÖÇU£§f&ÕWV3%c5sWDdã•…&Ä´6³u„sFt”4veg‡T”4#•„sV6&”v4…f–$vÆ¤”„¦Æ3%c´6³d”…§fuvS‡T”4t”…&ö„×Uƒ4çf6å$¶#&ÇVD„ÖôµGF6&Ç‡T”4t”u§f6”ö$uc”v¶u4t÷”'”GvvDv‡7“Vf3#—–Dufµ6Ó—&å'¤Æ×†Æ&ÖCG6v77$µ4#u„sFt”4t”4&¦##W¦D4'¦4„§&ÖD6##VÄ”CvDv‡7“Vf3#—–Dufµ6Ó—&å'¥s&ÆDó‡T”4t”4v34'–sVåÓ—U¥3V–##VÄÆågu¤tc¥S†D„§T6wó‡T”4t”4v34'–sVåÓ—U¥3V–##VÄÆågu¤tc¥fGf6×†µEtc6ÖÃD´u¦†$„æÄÄ4&Õ•w‡¥¥6³u„sFt”4t”4'¦4„§&ÖD6##VÄÆä¦Æ3%c´6³u„sFt”4veg‡T”4#•„sV6&”v4…f–$vÆ¤”…gu¤tc¥6†µ¥wƒ•Föv&ågE–Õg”µFövFÓ—¤4#u„sFt”4vDv‡7“Vf3#—–DWfsS7–wó‡U„sFt”4u¦Ó—””6‡5¥…v4””Dt”v¶u4#vÇ¤ÆÃ–†&ÔæÆ35'f6ä×V$ugU£5&ô÷”'·—7”‡F6&”t”4t”…&ö„×Uƒ$gU“%g¦Ds—–3G…3S4u&†Due†#4§5¤S†D„§T6‡”C•4tÄ4&Õ•w‡¥¥6³u„sFt”4veg‡U„sFt”4u¦Ó—””6‡5¥…v4””Dt”v¶u4#vÇ¤ÆÃ—¦#4£¥u$¶#&ÇVD„×V$ugU£5&ô÷”'·—7”‡F6&”t”4t”3‡d”…gu¤tc¥4#uVv34'–sVå–Ó—U¥g‡T”4t”4u“#—V35v34'–sVåÓ—U¥4””…&ö„×Uƒ4çf6å&Å¤WfsS3G…GF6&”t”4t”„çv6ÖÇU£§f&ÕWU–Ó—U¥3S4u&†Dudå•…'–†vôµGF6&”t”4t”„çv6ÖÇU£§f&ÕWU–Ó—U¥3S4u&†Due†#4§5¤S†D„§T6†Õ•w‡¥¥7vu¦Ôg63%Wó‡T”4t”4v34'–sVåÓ—U¥3S4u&†DuVõ¤ug6DtWó‡U„sFt”4t”4dÇ”#4u&†DuVu“&‡$u'•¥sFvC#—–$uv%tc6ÖÆ¥¥„æ6&”t”4t”3‡d”vÃ”vÇ¤”„¦Æ5…g6Õf´”†Fõ¥sFvDv†Ä”„çv6ÖÇU§”&–##VÄ”tæõ•vÇT”vÇ¤”„çu•„§¥¥g‡T”4t”4vD„¦†FÕg–3%dFvÇ5¤„¦Æ&ÅgVDvÇ5#—U¤vÃs—UEuc´„çv6ÖÇU£§f&ÕWU–Ó—U¥7vvDv‡7“Vf6Õg5¥…¦†&å$FvÇ5¤„¦Æ&Ågu¤tc¥uó‡T”4t”ƒ6&”veg‡U„sFt”3‡¶Ç‡T”4t¶”%F#4£7”#uVvÓ—&å'¤”ugV35g–sVä”…&õ¥†¶u•„¦Ä”…gu¤tc¥uvsFvDv†Ä”tçf6ä¦Å“5v#4¦µ¥„–vDtg&sVä”u&Æ4ugU¤ugU“&ÆÆ7”'&å'd”tf¥“#“&åU„sFt”4„sFt”4”e&ö„Öv%ucs–´”…gu¤tc¥„ÖvS'6sW$”c—¦#4£¥u$¶#&ÇVD„ã””tgU¤4#uw‡&×6uƒ$gU“%g¦Ds—–33U„sFt”4”S†%Vv35g•¥4#'”&¥•w‡4”…&ö„Öu–ÕfÖ#4¦Ä”…g¦sVä”…&õ¥sU„sFt”4Ã‡T”4'v6ÖÃ%•…&Ä”c—¦#4£6Ó—&å'¤´6¶vS‡T”4t”vÆÔ”6v†Dv‡7“Vf„åF#4£¥u$¶#&ÇVD„äV„£U6¶vS‡T”4t”4v6ÕcE„§Tó‡T”4t”ƒ6&Ç‡T”4t”tçf&äã”„çv6ÖÇU£§f&Õe6Õ&Æ6¦öu„§••†³…fÄ¤åS4'–sVåÓ—U¥WfsS”””gFDó‡T”4t”tçf&äã”„çv6ÖÇU£§f&Õg¥d„§¥uu4'U¥†6uS%ce¥5Edçv6ÖÇU£§f&Õd¶#&ÇVDCFôµGF6&”t”4&¦##W¦D4'¦4„§&ÖD6##VÆ3'f&ÕVu4'U¥†6uS%ce¥5Edçv6ÖÇU£§f&Õd¶#&ÇVDCFôµGF6&”t”4&¦##W¦D4&†&ÔæÆ35'f6äÖu4'U¥†6uS%ce$•VµddÆ³––Õf¦DDäU–wó‡U„sFt”4u¦Ó—””6†¦##W¦D4'¦4„§&ÖD6##VÄ”s–Ô”…&ö„×Uƒ'fsS7–¶vS‡T”4t”4vDv‡7“VfsW¥¥„£6Ó—&å%F#4£´„çv6ÖÇU£§f&ÕW4”„çv6ÖÇU£§f&Õg¥d„§¥u4”„çv6ÖÇU£§f&Õg¥$s—U¥7vv34'–sVåÓ—U¥S—•¤ug”Ä4&†&ÔæÆ35'f6ä×ó‡T”4t”ƒ6&”t”4#vÇ¤ÆÃ—¦#4£¥u$¶#&ÇVD„Öu4'¦4„§&ÖD6##VÅC4¦µ¥„“u„sV6&”t”4&¦##W¦D4'5“$Vu4'6#6FÆ35$F##F##T&&ÔæÆ35'f6–††&ÔæÆ35'f6ä×ó‡T”4t”…&ö„×Uƒ$gU“%g¦Ds—–7”””gFDó‡T”4t”vÆÔ”6‡5“$W”‡F6&”t”4t”…&ö„×Uƒ$gU“%g¦Ds—–7“WvE„æô´w†¥•6³u„sFt”4t”4#6Ôc%¥„§¥¥Tæöw†¶6ÕgUesSw„F##V¶…'##Tå¥…ö$tæ„Ä4ö#$§¥tãö”%U4d¤e%3U–×Å“5¥$6¶uCFvS‡T”4t”4t”4dÇ”'¦”#uVv#$§¥tã”v††7”&†D…&…“&†Å¤4'¦4„§&ÖF–##VÄÄ4&õ•wƒ”…&õ¥4#6Ôc%¥„§¥•w†6&”t”4t”4vu–t´6ƒvÇ¤ÆÃ—e–×Å“5%F4„§&ÖD6##VÆ3†43Vå¥…ö#$§¥tãµC‡V3&Ãe¥4õ”tµ4´”D”‡F6&”t”4t”4t”4'•¥…#6ÓFvD„£¥GF6&”t”4t”4veg‡T”4t”4t”4#vÇ¤ÆÃ–†&ÔæÆ35'f6ä×V4…g¦6‡e–×Å“5ó‡T”4t”4t”4'•¥…#6ÓFu¦Ôg63%Su„sFt”4t”4#”µGF6&”t”4#•„sV6&”t”4#vÇ¤ÆÃ—3çf6å&Å¤WfsS3'6å#T”Cu¦Ôg63%Su„sFt”ƒ6&Ç‡T”4'v6ÖÃ%•…&Ä”c—&äæÆ6å$¶#&ÇVDdçf6åõ„sFt”4v34'–sVåÓ—U¥FöufÄ¤åS4'–sVåÓ—U¥WfsSÄg‡T”4t”„çv6ÖÇU£§f&Õg¥d„§¥ud”dæÆDG…uV³F4„§&ÖD6##VÅ6Ó—&å´Äg‡T”4t”„çv6ÖÇU£§f&Õg¥$s—U¥FöuS%ce¥5Edçv6ÖÇU£§f&Õd¶#&ÇVDCG5„sFt”4v34'–sVåÓ—U¥S—•¤ug”ö”$&6ä¦†UG…uV³F4„§&ÖD6##VÅ6Ó—&å´Äg‡T”4t”tgU“%g¦Ds—–7¦öuS%ce$•VµddÆ³––Õf¦DDäU—†6&”tµ4#u„sFt”4vu–t´„çv6ÖÇU£§f&Õg¥$s—U¥3Võ•„Öö34'–sVåÓ—U¥6·”‡F6&”t”4t”„¦ÆD…g–&§F6&”t”4#•„sV6&”t”4'¦”ö34'–sVåÓ—U¥„åV6ÖÆÅ¤3Võ•„Öö34'–sVåÓ—U¥6·”‡F6&”t”4t”vÆÔ”6v†Dv‡7“Vftg¥c$g–&Õfµ&Ç•“5g5•„¤U¥„&Æ&Õ&Æ&ÔãTµ4#u„sFt”4t”4t”tçf&äçf$uWVC$g–&–våfÄ¤åS4'–sVåÓ—U¥S†&Ôfå¥„“d”Tç6Ôã$tg””u&Æ4ugU¤ugU“6¶u¤uc¥tã¥uäµGF6&”t”4t”4vDv‡7“Vftg¥c$g–&Õfµ&Ç•“5g5•„¤U¥„&Æ&Õ&Æ&ÔãT”CvD„£¥GF6&”t”4t”ƒ6&”t”4t”„¦ÆD…g–&§F6&”t”4#•„sV6&”t”4'¦4„§&ÖD6##VÆ3'–uf´ÆÔfµ¤6‡¦4„§&ÖD6##VÄµGF6&Ç‡T”4t”tçf&äã”u&Æ4S––Õf¦D„Öu4'¦4„§&ÖD6##VÄÆÕ&Æ4ugU¤ugU“&ÆÆ7§F6&”t”4&Ö#4–t´tçf&äã”u&Æ4S––Õf¦D4'e¦”&µ¥„%–×Å“5'¤µ4#u„sFt”4t”4'5¥…u¥sV¦#5gVDug•¥u%F4„§&ÖD6##VÄ”Cu¦Ôg63%Su„sFt”4t”4'5¥…u•sV¥¥„ã#4“d”e$•VµddÆ³––Õf¦DDäT”‡vv&åg6$4””sS$wsu„sFt”4t”4#6Ôc%¥„§¥¥TgU“%g¦Ds—–3§–##6##“´u&Æ4S––Õf¦D7vt´u&Æ4S––Õf¦DTgU“%g¦Ds—”µ4•”#u„sFt”4t”4t”tçf&äã”s––Õf¦DdæÆD4””…&ö„×Uƒ#––Õf¦Ddçv6ÖÇU£§f&Õg¥EtgtÆÖFÆD6†µ¥„%–×Å“5$&&ÔæÆ35'f6–³u„sFt”4t”4t”vÆÔ”6‡e–×Å“5%E¥…”‡F6&”t”4t”4t”4&Ö#4–t´tçf&äã”u&Æ4dçv6ÖÇU£§f&ÕVv#%–v#$§¥tãS%cµ4#u„sFt”4t”4t”4t”4&Æ&ÔçfEsS¥„¦Å¤dçv6ÖÇU£§f&ÕVu4#6åfÄó‡T”4t”4t”4t”4vDv‡7“VfsW¥¥„£6Ó—&å%F#4£´u&Æ4dçv6ÖÇU£§f&ÕW4”„çv6ÖÇU£§f&Õg¥d„§¥u4”„çv6ÖÇU£§f&Õg¥$s—U¥7vv34'–sVåÓ—U¥S—•¤ug”Ä4&†&ÔæÆ35'f6ä×ó‡T”4t”4t”4t”ƒ6&”t”4t”4ve4&Æ$„æÄ”vÆÔ”6v…¥sV¦#5gVDug•¥u%F4„§&ÖD6##VÄµ4#u„sFt”4t”4t”4tÇ“†udv‡7”'e–×Å“5v„Öu•sFu•sV¥¥„ã#4–v#%–u•4'¦4„§&Ö6u–Ó—U¥7vu–åc”vÇ¤”SUd4&„”„çu•„§¥¥4'V#%&Ä”vÇT”t¦ÆD†FÅ¥sFv34'–sVä”t§f&Õg¤ÆÇ‡T”4t”4t”4t”tgU“%g¦Ds—””Cu¤uguC$§¥tãsV¥¥„ã#4“u„sFt”4t”4t”ƒ6&”t”4t”ƒó‡T”4t”4vu–t´tgU“%g¦Ds—”µ4#u„sFt”4t”4t”tgU“%g¦Ds—–7“V…¤uõ•sV¥¥„ã#4—ó‡T”4t”4veg‡T”4t”ƒ6&Ç‡T”4t”„çv6ÖÇU£§f&Õe6Õ&Æ6“WvE„æô´„çv6ÖÇU£§f&ÕWó‡U„sFt”4v34'–sVåÓ—U¥„äV##VÄÆÔfµ¤6‡¦4„§&ÖD6##VÄµGF6&”veg‡U„sFt”„'–…¦†DuVuƒ4¦Æ$uc%•sS&‡$u'•¥sUf4u&†Duf´´s––Õf¦DFöudV…5%UWUC$§¥tãÓ”‡F6&”t”4dÇ”'¦”#uVv#$§¥tã”v††7”&†D…&…“&†Å¤4'¦4„§&ÖF–##VÄÄ4&õ•wƒ”…&õ¥4#6Ôc%¥„§¥•w†6&”t”4'¦”ô´…&ö„×Uƒ#––Õf¦Ddçv6ÖÇU£§f&Õg¥EtgtÆÖFÆD6‡e–×Å“5“W¦‡Ä”C‚ô”D”CFtÔ6¶vS‡T”4t”4v6ÕcE„§T”…'–EuSu„sFt”4veg‡U„sFt”4tÇ“†v#5&õ¥„£6„æÄ”…gu¤tc¥4'D„ÖvC#—–$uv%tc6ÖÃE„sFt”4v#$§¥tãÆågu¤tc¥fGf6×†µEtc6ÖÃD´u¦†$„æÄÄ4&Õ•w‡¥¥6³u„sFt”4v6ÕcE„§T”u¦†$„æÄó‡T”4#•„sS•„sF”Ä4–sv#4£”6öu•„ÖudV…5%UVu¦ä§f%4æDv‡•¥uVäó‡Vsv#4£”‡6u#…U&—vu#…U&·‡e•u&Æ6Ä'6EvG&—vu#…U&Ä&†6äæÆ6”#””u§–##t£5&ö6ÕfÄÃ%cE•sv$ug¤Ã'¦%3—6#$fµ¥„§¤ÃDÕdU¤Ö#$fµ¥„—VäÖäó‡Vsv#4£”‡F6&”ufÄ¤å%†‡v6Õg¦3&Çf&·‡e•u&Æ6Ä'6EvG&—†6&”ufÄ¤å&ÖÇ–35%¥„§¦##TÖ#$fµ¥„¥$…fæsG5„sFt”e¥5EVƒ%tgV#&Æ´Äg‡T”4%uV³–Es†&Ó—¤W‡e•u&Æ6Ä'6EvG&—†6&”ufÄ¤åDs—fcDs–…¤ug•Twƒ£&ÇTÄg‡T”4%uV³å¥…&„Äg‡T”4%uV³å¥…&…Ds–…¤ug•Twƒ£&ÇTÄg‡Ve4&Ö6Ó—D”6D4vÃF…—fDv‡•¥uWFFä§DÅtçf6ÕVäó‡Vsv#4£”‡6uEe'f##Tå•…&Æ6ÖÆ†$W‡e•u&Æ6Ä'6EvG&”#””u§–##t£'v†‡F““„¦Å¥3&6ÓF%tc¥„§•w‡¤Ås##—T§§F6&ÖÇF4s—–D4#t”e¥5ES†Dug–tg63„UVµgF„ç¦…¦ÅE…g6DvÇv$vÆÆ6·‡e•u&Æ6Ä'6EvG&”#””u§–##t£'v†‡F““„¦Å¥3&6ÓF%tc¥„§•w‡¤Åv†¶6“Æ%vÇ¦3&Ã%¥3FEwƒ„'6ug”§§F6&ÖÇF4s—–D4#t”e¥5ES†Dug–tg63—u#—F4tcTwƒ£&ÇT”ƒu¦ä§f%4å„'TvÃ$Ã5&ö6ÕfÄÅ…§–%3E•…&Æ6ÖÆ†$„×FF¤&¦##u•…äó‡Vsv#4£”‡6ufÄ¤åFÓ–µ¥Tçf&äã6Ôg&å$Ö#$fµ¥„¥$…fæsFve4&Ö6Ó—D”6D4vÃF…—fDv‡•¥uWFFä§DÅsWe¤uWE“#—V35'••vÇVD63u„sW%„'f6åvW”%uV³F4„§&ÖD6##VÅDs–…¤ug•Twƒ£&ÇT”ƒu¦ä§f%4å„'TvÃ$Ã5&ö6ÕfÄÅ…§–%3¦4„§&ÖF–##VÄ§§F6&ÖÇF4s—–D4#t”e¥5EW‡e•u&Æ6Ä'6EvG&³—vDvÇf&äÖve4&Ö6Ó—D”67TÃ¥5EW‡e•u&Æ6Ä'6EvG&³—vDvÇf&äÖäó‡Vsv#4£”‡6ufÄ¤ä”ƒu¦ä§f%4äÆ“•uV³äó‡U„sVÆT„'f6åu“'††34ÖufÄ¤åDs–…¤ug•Twƒ£&ÇT”vÇF4w†Æ%ugVD„Öu#…U&·‡e•u&Æ6Ä'6EvG&”#u„sFt”„#–×‡—”'•¥tf¶##W6U4'u•„§¥¥„“d”VDÕdU¥•„§¥¥„“u„sV6&”v4…f–$vÆ¤”„¦Å•u'f&×ƒT”ucF4„¦Æ34ç##U$…fæsCd”e¥5EUcF4„¦Æ34ç##TÖ#$fµ¥„¥$…fæsCu„sFt”„#–×‡—”'•¥tf¶##W6U4&Ö„§¦Dd&Æ6äçf&Ä'6EvG&¦öufÄ¤å&ÖÇ–35%¥„§¦##TÖ#$fµ¥„¥$…fæsCu„sFt”„#–×‡—”'•¥tf¶##W6U4&öEs†&Ó—¤d'6EvG&¦öufÄ¤å4…gE•sWfu$Ö#$fµ¥„¥$…fæsCu„sFt”„#–×‡—”'•¥tf¶##W6U4'6##—%…%$…fæsCd”e¥5EW‡f#'D&DW‡e•u&Æ6Ä'6EvG&§F6&”v4…f–$vÆ¤”„¦Å•u'f&×ƒT”sÆDte$…fæsCd”e¥5ESÆDtdÖ#$fµ¥„¥$…fæsCu„sFt”„#–×‡—”'•¥tf¶##W6U4'FDs—f&³†Dug–tg5Twƒ£&ÇTö”$åds—f&³†Dug–tg5Ds–…¤ug•Twƒ£&ÇTó‡T”4'vEt§6tÖv6Õf…¤s—V$†¶v%tc¥„§•w‡¥4U%5%s34çFÕdæEwƒ„'6ug•Twƒ£&ÇTö”%uV³å•…&Æ6ÖÆ†$„ä•$d¤f%vÇ¦3&Ã%¥S$…'4w‡¥„¤Ö#$fµ¥„¥$…fæsCu„sFt”„#–×‡—”'•¥tf¶##W6U4'E•…&Æ6ÖÆ†$„åtÔTçf%„&†Dd'6EvG&¦öufÄ¤åEtc¥„§•w‡¥f¤$F##u•…%$…fæsCu„sFt”„#–×‡—”'•¥tf¶##W6U4'¦4„§&ÖD6##VÅTwƒ£&ÇTö”%uV³F4„§&ÖD6##VÅDs–…¤ug•Twƒ£&ÇTó‡T”4'vEt§6tÖv6Õf…¤s—V$†¶v&Ó–µ¥Tçf&äã6Ôg&å%$…fæsCd”e¥5ESWe¤udF##W¦D„¦†sSDs–…¤ug•Twƒ£&ÇTó‡U„sFt”„#–×‡—”&å¥…v&ÔgE¥6wö”'¦D„§&Ö6vS‡T”4t”„¦ÆD…g–&”åfÄ¤åDs–…¤ug•Twƒ£&ÇT§§F6&”veg‡U„sFt”„#–×‡—”&¦##W¦D„£“5'f6–‡u•„§¥¥„“d”VDÕdU¥•„§¥¥„—4”s—vDvÇf&äÒôö”%uV³Ö#$fµ¥„¥$…fæsU4…'##W¤µ4#u„sFt”4vDv‡7“Wu•„§¥¥„–u4'u•„§¥¥„“u„sV6&”t”4&¦##W¦D4&õ¥w‡u¥„¥6##“”Cv#4#s—V7£‡Vug64ug•VÓ—fDGF6&”t”4&¦##W¦D4&†E…'ee„&µ•…&Å4…gE•sT6##VÆ7”””s—vDvÇf&äÒôÆÔcDs•f4u&†Dud–Es†&´§f&Õg¤ó‡U„sFt”4vDv‡7“VÆT„'•¥„ç¦s—UTwƒ£&ÇT”Cv#4#s—V7£‡U¥†‡v6Õg¦3&Çf&Ä'6EvG&”õ”'U¥†6ufÄ¤å%†‡v6Õg¦3&Çf&·‡e•u&Æ6Ä'6EvG&–‡u•„§¥¥„—ó‡T”4t”…&ö„×U¦ÖÇ–35%¥„§¦##U$…fæsFu4'f4…'##W¥“VÖ„§¦Dd&Æ6äçf&Ä'6EvG&”õ”'U¥†6ufÄ¤å&ÖÇ–35%¥„§¦##TÖ#$fµ¥„¥$…fæsFö4tg–3%g”µGF6&”t”4#vÇ¤ÆÖƒ%tgV#&ÆµTwƒ£&ÇT”C6&”t”4t”s—vDvÇf&äÒôÆÖƒ%tgV#&ÆµTwƒ£&ÇT”C‚õ„sFt”4t”4'U¥†6ufÄ¤å4…gE•sWfu$Ö#$fµ¥„¥$…fæsFö4tg–3%g”Ä4#u„sFt”4t”4t”v†Æ$„&Æ6Ä§f#55„sFt”4t”4t”tcDs•f4u&†Dud–Es†&´§f&Õg¤Äg‡T”4t”4ve6³u„sFt”4vDv‡7“W6##—%…%$…fæsFu4'f4…'##W¥“W6##—%…%$…fæsFu£†v&Õc4”e¥5EW‡f#'D&DW‡e•u&Æ6Ä'6EvG&–‡u•„§¥¥„—4”‡6vug64ug•VÓ—fD4#”µGF6&”t”4#vÇ¤ÆÓÆDte$…fæsFu4'f4…'##W¥“WE¥…&…Twƒ£&ÇT”C‚ô”sVÆG”%uV³å¥…&…Ds–…¤ug•Twƒ£&ÇT´„&†6äæÆ6–³u„sFt”4vDv‡7“WFDs—f&³†Dug–tg5Twƒ£&ÇT”Cv#4#s—V7£‡V%…'f##Tå•…&Æ6ÖÆ†$d'6EvG&”õ”'U¥†6uEe'f##Tå•…&Æ6ÖÆ†$W‡e•u&Æ6Ä'6EvG&–‡u•„§¥¥„—ó‡T”4t”…&ö„×V%tc¥„§•w‡¥4U%5%s34çFÕdæEwƒ„'6ug•Twƒ£&ÇT”C6&”t”4t”s—vDvÇf&äÒôÆÓ†Dug–tg63„UVµgF„ç¦…¦ÅE…g6DvÇv$vÆÆ6Ä'6EvG&”õ”'U¥†6ufÄ¤åEtc¥„§•w‡¥4U%5%s34çFÕdæEwƒ„'6ug•Ds–…¤ug•Twƒ£&ÇT´„&†6äæÆ6–³u„sFt”4vDv‡7“WE•…&Æ6ÖÆ†$„åtÔTçf%„&†Dd'6EvG&”””s—vDvÇf&äÒôÆÓ†Dug–tg63—u#—F4tcTwƒ£&ÇT”C‚ô”sVÆG”%uV³å•…&Æ6ÖÆ†$„åtÔTçf%„&†Dd'6EvG&–‡u•„§¥¥„—ó‡U„sFt”4vDv‡7“W¦4„§&ÖD6##VÅTwƒ£&ÇT”C6&”t”4t”s—vDvÇf&äÒôÆäçv6ÖÇU£§f&Õe$…fæsFu£–6&”t”4t”sVÆG”%uV³F4„§&ÖD6##VÅDs–…¤ug•Twƒ£&ÇT´„&†6äæÆ6—vvS‡T”4t”4t”4&¦#'‡6u&Æ6¶†Æ$„&Æ6Ä§f#5d”v†Æ$„&Æ6Ä§f#55„sFt”4t”4t”wfsS4ug64ug•VÓ—fDFövug64ug•VÓ—fD7†6&”t”4t”ƒó‡U„sFt”4vDv‡7“WV#%&Å#—V35'••vÇVDd'6EvG&”•„sFt”4t”4'f4…'##W¥“WV#%&Å#—V35'••vÇVDd'6EvG&”õ”'U¥†6ufÄ¤åFÓ–µ¥Tçf&äã6Ôg&å$Ö#$fµ¥„¥$…fæsFö4tg–3%g”Ä4#t”v†Æ$„&Æ6Ä§f#5ve6³u„sFt”ƒ6&Ç‡T”4'vEt§6tÖu•„ãV&ÔÖu–ÕfÖ#4¦ÅVÓ—fD6wö”%6Ó—F„æÅ…§fu´”‡F6&”t”4&†C$gD4#vÇ¤ÆÓ†Dug–tg63—u#—F4tcTwƒ£&ÇTÆÔ¦Å¦Ó—•¥d§f#5ôµGF6&”t”4&†C$gD4#vÇ¤ÆÓ##—UEtc¥„§•w…$…fæsGU–ÕfÖ#4¦ÅVÓ—fD6wó‡T”4#•„sV6&”v4…f–$vÆ¤”tg¦UsV¤”w‡e•u$å¥„æô´sÆ3&„¦&Õ&ÆTFöv&ågE–Õg”µFöuT„§f%vÇ¥¥G…U4d¤e%3T†6Ó“44#„”e$•VµddÆ³Æ3&vvd4%U4d¤e%3UF&ÇV&ÕfµEug¦CFvS‡T”4t”„¦ÆD…g–&”&†C$gD4#vÇ¤ÆÓ##—UEtc¥„§•w…$…fæsGV$s–…¤SÆ3&vö%ug¦VÇU¤ucDµGF6&”veg‡U„sFt”„#–×‡—”&å¥…$å•…&Æ6ÖÆ†$e#V4uVö%tc¥„§•w„¦&Õ&ÆTFöv&ågE–Õg”µFövD†Çu¥s–Ô”e$•VµddÆ³†Dug–tg4”‡vv&åg6$4#u„sFt”4u“#—V35v%…'f##UVU„&Ä”CvDv‡7“WFDs—f&³†Dug–tg5Twƒ£&ÇTÆÖFÆDS†Dug–tg5d†Çu¥6‡E•…&Æ6ÖÆ†$VÇU¤ucDµGF6&”t”4'¦”ö%…'f##UVU„&Ä”4S””sS$ww”‡F6&”t”4t”„¦ÆD…g–&”'FDs—f&Å#V4uSu„sFt”4veg‡U„sFt”4v6ÕcE„§T”sS$wsu„sFt”ƒ6&Ç‡T”4'vEt§6tÖu•„ãV&ÔÖu¥†ƒ¥sVµEtc¥„§•w…•„¦†%„Öö%tc¥„§•w„¦&Õ&ÆTFöv&ågE–Õg”Ä4'E•…&Æ6ÖÆ†$d&†6ÔgF7¦övW”&&%cTö”'¦D„§&ÖFDö”&†&æ¶ve6³d”d'–##3%S…•sSU”#u„sFt”4u•†F†…vDv‡7“WE•…&Æ6ÖÆ†$„ä•$d¤f%vÇ¦3&Ã%¥S$…'4w‡¥„¥$…fæsGU¥†ƒ¥sVµEtc¥„§•w…•„¦†%„Öö%tc¥„§•w„¦&Õ&ÆT7vv%tc¥„§•w…•„¦†%„×ó‡T”4t”tc5•vÃ”…&ö„×V%…'f##Tå•…&Æ6ÖÆ†$d'6EvG&“VÆT…&Æ&Õ$å•…&Æ6ÖÆ†$d&†6ÔgF7–‡E•…&Æ6ÖÆ†$VÇU¤ucDÄ4'E•…&Æ6ÖÆ†$d&†6ÔgF7–³u„sFt”ƒ6&Ç‡T”4'vEt§6tÖu•„ãV&ÔÖu•u£¥„¥6##“´vG6Du“d”VDÕdU—ö”%6Ó—F„æÅ…§fu´”‡F6&”t”4&†C$gD4#vÇ¤ÆÓÆDte$…fæsGU•u£¥„¥6##“´vG6Du—ó‡T”4t”tc5•vÃ”…&ö„×V…gE•sWfu%$…fæsGU•u£¥„¥6##“´vG6Du—ó‡T”4t”tc5•vÃ”…&ö„×U¥†‡v6Õg¦3&Çf&Ä'6EvG&“V…¦å&Æ6Ä§f#5õ£'ƒ¦–³u„sFt”4u•†F†…vDv‡7“W6##—%…%$…fæsGU•u£¥„¥6##“´vG6Du—ó‡T”4t”tc5•vÃ”…&ö„×U¦ÖÇ–35%¥„§¦##U$…fæsGU•u£¥„¥6##“´vG6Du—ó‡T”4t”tc5•vÃ”…&ö„×V34'–sVåÓ—U¥d'6EvG&“V…¦å&Æ6Ä§f#5õ£'ƒ¦–³u„sFt”4u•†F†…vDv‡7“WV#%&Å#—V35'••vÇVDd'6EvG&“V…¦å&Æ6Ä§f#5õ£'ƒ¦–³u„sFt”4u•†F†…vDv‡7“WFDs—f&³†Dug–tg5Twƒ£&ÇTÆÔfÖDug•VÓ—fD6†æ$…&ÔµGF6&Ç‡T”4t”tçf&äã”sÆDtVu4&æ$…&ÔÆåg¥¥„¤U•…&„Æå§–%SÆDtVu•„ÖufÄ¤åEuc•4#„”sS$wsu„sFt”4u“#—V35v…gE•sWfuu4&æ$…&ÔÆåg¥¥„¤U•…&„Æå§–%Vƒ%tgV#&Æ´”tg¤”e¥5EVƒ%tgV#&Æ´”‡vv&åg6$GF6&Ç‡T”4t”3‡d”sÆDtVu•sV´”vƒ%tgV#&Æ´”tg•¥4'•¥„c„¦Å¤4#'”&•¥4&„”e¥5E3V6&”t”4dÇ”$V##FæD4&¦6Õf†DuVufÄ¤ä”vÆÔ”…&õ¥†¶u•„¦Ä”sS$w†6&”t”4'¦”ö%uc•4Ô¦”&öEs†&Ó—¤6¶vS‡T”4t”4u“#—V35vFä§D”Cv&Õc4”e¥5E6ƒu„sFt”4t”4t”„æ¥¥sVÄö”&æ$…&ÔÆäæ¥¥sVÄÄg‡T”4t”4t”4&ÆT„'•¥„ç¦s—UEtgU•vFÆ6¦öu£'ƒ¦“S3%g•$tc•3S&6ÓfT„'•¥„ç¦s—UEtgU•vFÆ6—†6&”t”4t”4u¦ÖÇ–35%¥„§¦##Cd”vG6Du—VE„æÆ6µ&†DtWVFä§E&ÖÇ–35%¥„§¦##G5„sFt”4t”4t”vƒ%tgV#&Æ´Äg‡T”4t”4t”4'6##—%…d”vG6Du—VE„æÆ6µ&†DtWVFä§EDs—fcÄg‡T”4t”4t”4'E¥…&„Äg‡T”4t”4t”4'E•…&Æ6ÖÆ†$„Ód”vG6Du—VE„æÆ6µ&†DtWVFä§EEe'f##Tå•…&Æ6ÖÆ†$„×5„sFt”4t”4t”„çv6ÖÇU£§f&Õdå•sV…£%g”ö”&æ$…&ÔÆåg¥¥„¤U•…&„Æå§–%dçv6ÖÇU£§f&Õdå•sV…£%g”Äg‡T”4t”4t”4'V#%&Å#—V35'••vÇVDS†&Ôfå¥„“d”vG6Du—VE„æÆ6µ&†DtWVFä§EFÓ–µ¥Tçf&äã6Ôg&å$å•sV…£%g”Äg‡T”4t”4ve6³u„sV6&”t”4t”vG6Du—VE„æÆ6µ&†DtWVFä§D”CvFä§Dó‡T”4t”ƒ6&”veg‡Veg‡T–—vt–ÖÇF4s—–D4”tg¤”e$•Vµdd”u§–##t£5&ö6ÕfÄ§§F6&ÖÇF4s—–D4#t”e¥5ETçf6ÕW4”e¥5EUcF4„¦Æ34ç##Tæ#4§ve&†6ÖFÆDT§&Õve4&Ö6Ó—D”6D4vÃF…—fDv‡•¥uWFFä§DÅtçf6ÕVäó‡U„sGd¶—6&””e'••…¦Æ6äæÄ”tgT”ugVDvÇ•¥4#6ÕfÄ”tgU¤4&¦#'‡5¥tã”sÆ3&†Æ7“V6&”Ã‡U¦ågU“5'##Fu“#—6$uf¦DSÆ3&†Æ7–‡¥“%gU¥FöudV…5%UWU#4§fE„ö”%E¥……dV…5%UWUEug¦CFvS‡T”4&¦##W¦D4'E¥„æõ¥„Öu4'U¥†6uS%ce$•VµddÆ³Æ3&r´´6³u„sV6&”v3$æÆ&ÕWVD„¦†FÕg–3%Vô´s–––¶uCFvS‡T”4t”vÆÔ”6v„´s––”&†7”&†&æ·ÆÖÇ¥Eug¦6¶vS‡T”4t”4v6ÕcE„§Tó‡T”4t”ƒ6&Ç‡T”4t”tçf&äã”sÆ3&vu4'e–Ööu•„ÖudV…5%UWUEug¦GF6&”t”4'E¥„æõ¥„×U•u&´´sÆ3&wó‡T”4#”µGF6&Ç‡T”4'•¥…#6ÓFv%ug¦ug¤ó‡Veg‡U„sVÖEsV¦DvÇf&”&¦##–sVÅEs—–4vvõ„sFt”„'f3&Ãs—U…#6ÖÆ–E…&Æ7¦öt´e$•VµddÆ´£¦Õ¦Æ6´cD„§–åc¥4#„”e$•VµddÆ¶ÇVDug–$uf†FÕfµåfÕ¦Õg•…#6ÖÆ–E…&ÄµgFDÄg‡T”4&–sV¶7¦öuS%ce¥5EUcF4„¦Æ34ç##Tæ#4§ve&†6ÖFÆDT§&Õ´Äg‡T”4'F#4§ve&†6ÖFÆD„å5¥w††DvÃ%¥Föu–Ó—f$uf†&—†6&–³d”e$•VµddÆ´£¦Õ¦Æ6´cD„§–åc¥4#„”e$•VµddÆ¶ÇVDug–$uf†FÕfµåfÕ¦Õg•…#6ÖÆ–E…&Ä”‡F6&”tÇ“†vu–vDv†Æ6ÕVv„Öv##W6U4'f&ÕVv%s—–4vvvDtg•£%c”tgU¤4#uVvC%g£&ƒ”vÇ¤”DWTÔ7vvC%Vu“$gT”…g¥¥4#uVv#4§£&ÇU•wvu•„×F„æ6&”vu–t´t§&Õ'¤ÆäçVÕVuC””DW”‡F6&”t”4&¦##W¦D4&–sV´”Cu–ÖÇU¤„×VFÔg6Eug¤´6·V&ÕcFD6wÆå¦†$…fÄ•GF6&”t”4'¦”õ–ÖÇU¤3S5¥vÆæ…uC””DWTÔ6¶vS‡T”4t”4v6ÕcE„§T”„'f3&Ãs—U…#6ÖÆ–E…&Æ3F–sV´ÆÖÇU¤ucE…GF6&”t”4#•„sFt”ƒ6&Ç‡T”4&¦##W¦D4'U¥†D&6ä¦†U4””sVÆG”$v$s–†DD×•„§••†¶ö4s—¦…'##T&D…'–t£Dug¥w¤&DÆÔçfEsS”6öt×–³u„sFt”w†ÆD4#5¥vÆæ…%FEsu4tÆ¤u„sV6&”vu–t´sf6ä&õdtg•£%c3¦Æ$tc…¦Äµ4#u„sFt”4vC%g£&ƒS5gD”CtÕ3Gtó‡T”4#””ug63%VvS‡T”4t”u§f6”õ“#—V35u–ÖÇU¤4'e¦”&–sV¶7–¶vS‡T”4t”4vC%g£&ƒS5gD”73””t§&ÕVC%g£&ƒó‡T”4t”ƒ6&”veg‡U„sFt”u§f6”õ“#—V35u–ÖÇU¤4'e¦”&–sV¶7–¶vS‡T”4t”tçf&äã”„ç•—”””„'f3&Ãs—U…#6ÖÆ–E…&Æ3F–sV´ÆÖÇU¤ucE…GF6&”t”4&¦##W¦D4#5¥vÆæ…u4&–sV´ÆæFÆvFöD4d”†FÆvFöDdã%GF6&Ç‡T”4t”u§f6”ö$uc”v¶u4t÷”'”Gvv34¦¤ÆÔçfEsS÷”'·—7”‡F6&”t”4t”sVÆCg–6ÔcUs&¶t¶”¤”76tÔct·£v34¦¤ÆÖFÆDfvö6¶t¶”#5¥vÆæ…u„sFt”4t”4'U¥†D&6ä¦†UgG”6öt×”$”DfD”73””„ç•—“Vå¥…%¤´v·”6övC%g£&ƒó‡T”4t”4v&Õc5„§••†Æ&4”DÖt·”•…4%4'¦6Ô×U£%cv–‡µ4”†FÆvFöDGF6&”t”4#•„sFt”ƒ6&Ç‡T”4&¦##W¦D4'U¥†D&D…'–t£DuVu4'U¥†6udV…5%UWUåfÕ¦Õg•…#6ÖÆ–E…&Ä´sVÆCg–6ÔcTÄ4¤µGF6&”v6ÕcE„§T”sVÆCcD„§–åc¥GF6&ã6&Ç‡TÇ–÷„sFt¶”$$”s†44&Ö6Ó—D”ucF4„¦Æ34ç##Fv&ÔgE¥„ÖvDs†u•4'¥¥…v#%–v%s—–4vvvDtg•£%c”t§&Õ'¤ÆÇ‡T”6÷e„sSU„&Ä”SV†%ud6sVµS%cEtgt”CuEtgu„ã6ÖÇU§—vuS%ce¥5EUcF4„¦Æ34ç##Tæ#4§ve&†6ÖFÆDT§&Õµ§F6&Ç‡TÇ–÷„sFt¶”$F##–sVÄ”sf6ä&ô”…&†6ÖFÆD„Öu–æ¶ufÄ¤ä”ucF4„¦Æ34ç##W¤ÆÇ‡T”76&””e&ö„Öu¦ågU“5'##Fv4„¦ÆFÕgVD„Öu“4¦†3&†Æ7”&¥•…g¥¥uu–æ¶vDv†Ä”w‡%vÃ•…'##Fv#%–vDv†Ä”sS%t¦Æ6”'e¦”'F#4§v4#•„¦å¥…'¤Ä4&Æ34&Å“&Æ†$wƒT”s—T”se–ÖÇ5¥4&µ¥…§“%g¤ÆÇ‡T”76&””T'u•„¦†%4#&6Óudv†Ä”e¥5E4'&äã•sV¥¥g‡T”6÷e„sVÆT„'f6åu¦ågU“5'##Fu“#—E–ÖÇU¥Sf6ä&ö7–ƒ&6Ód”e¥5ETçf6ÕWö”#&#&Æ´”‡F6&”u“#—V35v%ug¦ug¤”Cu“#—6$uf¦DSÆ3&†Æ7–ƒ&6ÓV3$æÆ&ÕWó‡U„sFt”3‡d”VÃ¥„¦†DuVv#5¦Æ6”&†$wvu¥†‡v6Õg¦3&Çf&äÖu•sV´”tæõ¥tç$”†Fötæô”sf6ä&ô”…&†6ÖFÆD„Öu•„¦Ä”…g¥¥u&6&”u“#—V35v%ug¦SV†%ud6sVµS%cEtguEtgt”Cv&Õc4”S†4G…U4d¤e%3Tå¥„æôÄ4$õ•sÅÖÇU¤dæÆDS†4CFôµGF6&Ç‡T”4&¦##W¦D4&ÆT„'•¥„ç¦s—UEtgt”CvFä§DÆÕcF4„¦Æ34ç##Tå•sV…£%g•“VÆT„'•¥„ç¦s—UEtgtó‡T”4'¦”õ¥†‡v6Õg¦3&Çf&³†44…4'VEw‡4µ4#u„sFt”4u¦Ó—””6†¦##W¦D4&%¥†‡v6Õg¦3&Çf&³V†%uW4”ucF4„¦Æ34ç##VD”s–Ô”S––Õf¦D3VÆ&å'–ug¤´ucF4„¦Æ34ç##Tå•„µ4#u„sFt”4t”4&¦##W¦D4&–sV¶3'e$ug5¥…&ÅS%c”Cv&Õc4”dæÆDG…uV³fT„'•¥„ç¦s—UEs—–4v…U•„¦å¥…$6sVµ–wó‡T”4t”4u¦Ó—””6†¦##W¦D4&–sV´”s–Ô”ucF4„¦Æ34ç##GU–ÖÇU¤„×”‡F6&”t”4t”4vu–t´t§&ÕvsW¦DtgU“%ge¦”%uV³fT„'•¥„ç¦s—UEs—–4v…U•„¦å¥…$6sV´µ4#u„sFt”4t”4t”4vu–t´t§&ÕVC%g£&ƒ”4S•4tÆ¤”‡F6&”t”4t”4t”4t”u§f6”õ“#—V35v%ug¦4'e¦”&–sV´Æä'–sDvÃ%¥„×”‡F6&”t”4t”4t”4t”4v$uc”sV†%ud6sVµS%cEtgt”Cv%ug¦SV†%ud6sVµS%cEtguEtgtÆÖFÆD6‡E¥„æôµGF6&”t”4t”4t”4t”4vu–t´sV†%ud6sVµS%cEtgt”C””sS$ww”‡F6&”t”4t”4t”4t”4t”4'U•sÅÖÇU¤dæÆDS†44””sVÆG”$å•„ôµGF6&”t”4t”4t”4t”4t”4'E¥„æõFÔgE¥T§&Õ%E¥…$å•„$å•„V3%c´sÆ3&w4”sV†%ud6sVµS%cEtgtµGF6&”t”4t”4t”4t”4veg‡U„sFt”4t”4t”4t”4t”w†ÆD4&–sVµS%c”Cv&ÔgE¥T§&Õ%E¥…$å•„U£%c´ucF4„¦Æ34ç##Tõ•sÄµGF6&”t”4t”4t”4t”4vu–t´t§&Õ%E¥…uCv&åg6$6¶vS‡T”4t”4t”4t”4t”4t”t§&Õ%E¥…u4'U¥†6uS%c´6³u„sFt”4t”4t”4t”4t”4v&ÔgE¥T§&Õ%E¥…$å•„V3%c´ucF4„¦Æ34ç##Tõ•sÄÄ4&–sVµS%cµGF6&”t”4t”4t”4t”4veg‡U„sFt”4t”4t”4t”4t”t§&Õ%E¥…U•u&´´t§&Õó‡T”4t”4t”4t”4veg‡T”4t”4t”4t”ƒ6&”t”4t”4t”4&–sV¶3'e$ug5¥…&ÅS%cÆÔfµ¤6†–sV´µGF6&”t”4t”4veg‡T”4t”4veg‡U„sFt”4t”4&Ö#4–t´tçf&äã”t§&Õv#%–u–ÖÇU¤„åV#&Æ$uc¥dæÆD6¶vS‡T”4t”4t”4&ÆT„'•¥„ç¦s—TÆÕ&Æ$uc¥T§&Õõ–ÖÇU¤6³u„sFt”4t”4#•„sFt”4veg‡T”4#•„sV6&”tÇ“†u#—E–ÖÇU¥4'F#4§v„æ6&”u¦Ó—””6†¦##W¦D4'E¥„æô”s–Ô”sÆ3&†Æ7–¶vS‡T”4t”tçf&äã”sV†%ud6sVµS%cEtgt”Cv%ug¦SV†%ud6sVµS%cEtguEtgtÆÖFÆD6‡E¥„æôµGF6&”t”4'¦”ö&ÔgE¥T§&Õ%E¥…$å•„uCv&åg6$6¶vS‡T”4t”4u“#—VDvÇVEuSu„sFt”4veg‡U„sFt”4tÇ“†v4„¦ÆFÕgVD4&¦$s—VsVä”sf6ä&ô”tcD„§–åc¥„æ6&”t”4&¦##W¦D4'f6ÖÆæsV†$Sf6ä&õ…#6ÖÆ–E…&Æ7”””sÆ3&wU£%gf%uc6æ·V%s—–4v„&D…'–t£Dug¤ó‡T”4t”sÆ3&wU£%gf%uc6æ·V%s—–4v„&D…'–t£Dug¤”CvS3u„sV6&”t”4&¦##W¦D4&å¥s—E¥…'–U4””sÆ3&wU£%gf%uc6æ·U“'‡f&ÕVôµGF6&”t”4'E¥„æôÆÖFÆ##ÆD„£T”Cu£%gf%uc6æ³u„sFt”4u“#—V35v%s—–4v…U•„¦å¥…'¥VÕg5•…'FÕVu4&å¥s—E¥…'–U3WF#4§ve&†6ÖFÆD„å5¥w††DvÃ%¥GF6&Ç‡T”4t”tçf&äã”v††3$æ#4§v4””s—–vG&Ôg5Es—–4v„&D…'–t£Dug¤Æä'f3&Ãs—T”4S””sS$wsu„sFt”4u“#—V35vtg¥F³f6ä&ô”Cv#4§£&ÇU•w„æ#4§vTcD„§–åc¥„×V&Ó—–%tg4”4S””sS$wsu„sV6&”t”4&¦##W¦D4'F#4§vTcD„§–åc¥„Ód”…#V4uge¦”'f6ÖÆæsV†$Sf6ä&õ…#6ÖÆ–E…&Æ7”””‡C”ó‡T”4t”tçf&äã”sf6ä&õdtg•£%c$vÆ¦DvÇf&Ôg–UFövD†Çu¥s–Ô”sÆ3&wV%s—–4v…U•„¦å¥…$Vtãs—U•„£T”CvS3u„sFt”4u“#—V35v%s—–4v…U•„¦å¥…$¦&Õ§6EugU“%g¤ö”#U„&Æ#%–v%ug¦3WF#4§ve&†6ÖFÆDVÇU¦×ƒ¥sV¥¥„Öu4&%…GF6&Ç‡T”4t”vÆÔ”6†õ•„åEs—–4vvvd‡vvtg¥F³f6ä&ôµ4#u„sFt”4t”4'¦”ötg¥TSf6ä&ôµ4#u„sFt”4t”4t”sf6ä&õ…#6ÖÆ–E…&Æ7“Wv#4çDvÇf&”””gFDó‡T”4t”4veg‡T”4t”4vu–t´v††3Tæ#4§v6¶vS‡T”4t”4t”4'F#4§vTcD„§–åc¥„×V&Ó—–%tg4”Cusu„sFt”4t”4#•„sV6&”t”4t”w†ÆD4'”CtÔGF6&”t”4t”u§f6”õ“#—V35us#V†%uW4”t§&Õ%E¥…&D”s–Ô”sV†%ud6sVµS%cEtgtµ4#u„sFt”4t”4t”vÆÔ”6†õ•„åEs—–4vw”‡F6&”t”4t”4t”4'F#4§vTcD„§–åc¥„×V4s—¦…'##F…s&ÆD”Cu“#—E–ÖÇU¥Sf6ä&ô´s—–vG&Ôg5Es—–4v„&D…'–t£Dug¤Æä'f3&Ãs—T•7vu–ÖÇU¤dæÆD7vv%s—–4v…U•„¦å¥…'¥VÕg5•…'FÕWó‡T”4t”4t”4#•„sFt”4t”4t”vÆÔ”6†õ•„äõEs—–4vw”‡F6&”t”4t”4t”4'F#4§vTcD„§–åc¥„×V&Ó—–%tg4•gG…4””tçf%t§&Õdæ#4§v6‡f6ÖÆæsV†$Sf6ä&õ…#6ÖÆ–E…&Æ7“WV#4§E•wv„Ä4&–sVµS%cÄ4'F#4§ve&†6ÖFÆD„å5¥w††DvÃ%¥6³u„sFt”4t”4t”ƒ6&Ç‡T”4t”4t”4&ÆT„'•¥„ç¦s—UEtgu“V&&ÔgE¥cU•u&µÖÇU¤6†6&”t”4t”4t”4'U¥†6ufÄ¤å%†‡v6Õg¦3&Çf&³f6ä&õdtg•£%cÖÇU¤6ƒu„sFt”4t”4t”4t”4'&Õ&ÆTFöv7†6&”t”4t”4t”4t”†FÆvFöDFötÕ3GtÄg‡T”4t”4t”4t”4v4„§%vÃ…¦Æ7¦öus#Æ3&†DÄg‡T”4t”4t”4t”ƒÄg‡T”4t”4t”4ó‡U„sFt”4t”4t”sf6ä&õdtg•£%c$vÆ¦DvÇf&Ôg–UgGU•sÅ…4””v³u„sFt”4t”4t”sf6ä&õdtg•£%c5sVÖ$…fÆ&ÔæÆ7“WvE„æô´DTÔ6³u„sV6&”t”4t”4v77$ó‡T”4t”4veg‡T”4t”ƒ6&Ç‡T”4t”vFÆ##ÆD„£TÆÓf6ä&õ…#6ÖÆ–E…&Æ7”””sf6ä&õ…#6ÖÆ–E…&Æ7§F6&”t”4'E¥„æôÆÓf6ä&õdtg•£%c$vÆ¦DvÇf&Ôg–U4””sf6ä&õdtg•£%c$vÆ¦DvÇf&Ôg–UGF6&”t”4'E¥„æôÆÓf6ä&õdtg•£%c5sVÖ$…fÆ&ÔæÆ7”””sf6ä&õdtg•£%c5sVÖ$…fÆ&ÔæÆ7§F6&”veg‡Veg‡T–—vt–ÖÇF4s—–D4”tg¤”e$•Vµdd”u§–##t£5&ö6ÕfÄ§§F6&ÖÇF4s—–D4#t”tcD„§–åc¥VFÆDTçf%„'f&ÕgVDTçf%„&†D4#””u§–##t§“GTÃ5cw‡¤Ã$cD„§–åc¥VFÆDTçf%„'f&ÕgVDTçf%„&†D63u„sW%„'f6åvW”&†D…'–t£DueE¥…$F##v##VÆ&å$F##u•…ve4&Ö6Ó—D”67TÆ““DvÇ67“–†D…'–t£DueE¥…$F##v##VÆ&å$F##u•…äó‡U„sGd¶—6&””e'••…¦Æ6äæÆ7”#uVu£&Ã%¥sFv#$§¥tã”tgU¤4&¦##–sVÆ7”#uVv3'FÆ$uc##W¤”s–Ô”„ç&sWU¥uv%ug¦ug¤ÆÇ‡T”76&””Uf…“&vu¦ä¦†%uVvDv†Ä”t§f&ÕVv%tc6ÖÆ¥¥„Öu•„¦Ä”tçf%„#Duf´”u§f6”&ÆFÕg–U4'¦%g5¥…'f&“Fu#—E–ÖÇVsVä”„ç%¥w†ÆDs—V3‡T”6öv6Õf¶EtæÆ7”#uVv&ågE–Õg””s–Ô”tæ†$tã$tcs—V7”'U¥ufµ¥u4”vÇF4„§fFÖÇU§”'u¥„¦Ö#4§E•sV¥¥3V6&”„sFt¶”$4tg••sv6Ó—fD4%6##“”s––Õf¦D4#tc”†G$wvu–ÕVvD„¦†FÕg–3%fµ„sFt¶“–6&ÕcF4s—–D4&ÖEsV¦DvÇf&”&¦##–sVÅS'FÆ$uc##W¤´„§f#5d”e$•VµddÆ³––Õf¦DDäTµFövFÓ—¤4#u„sFt”tçf&äã”„ç&sWU¥u$å¥„æõ¥„Öu4&¦#'‡5¥tãS'G&ÓVÅ¤SÆ3&†Æ7–‡–##“µGF6&Ç‡T”4d¶–öu4'¥¥…v#%–u£%gf%uc6ÖÆÆ7”'&”#uVu£&Ã%¥sFvS'6sW$”„§f#5#”Æ”Ã‡T”4&¦##W¦D4&å¥s—E¥…'–ug¤”Cv&Õc4”dæÆDG…U4d¤e%3T6Eu¦Õ¥„¤…¥s—E¥…'–UCFôµGF6&”u¦Ó—””6†¦##W¦D4'E¥„æô”s–Ô”„ç&sWU¥u$å¥„æõ¥„×”‡F6&”t”4dÇ”'E¥„æõ¥„Öv3#—E¥…'%ug¤”„æõ•„¦Ä”…&õ¥4'¥•sÄ”vFÆ##ÆD„£U„sFt”4tÇ“†vC%Vu¤s—T£5vC$gVD4#'”##5f¦4#uVv3$gE¥4&†D…'–t£DuVvD†G“%W4”„çd”†FÄ”tç6##VÄ”…&õ¥4&å¥s—E¥…'–ug¥„sFt”4vu–t´vFÆ##ÆD„§¥„×Vtg¤´sÆ3&wU£%gf%uc6æ·µ4#u„sFt”4t”4'E¥„æôÆÖFÆ##ÆD„£T”Cv3&††$w‡fCç6##VÅåfÕ¦Õg•#%gf%uc6æ¶ö%ug¦3Vå¥s—E¥…'–U6³u„sFt”4veg‡U„sFt”4u£%gf%uc6ÖÆÆ7“V…¤uö%ug¦3Vå¥s—E¥…'–U6³u„sFt”ƒ6&Ç‡T”4dÇ”$Ö„ã”tg6$4#3%f´”„ç&sFvsV¶tæÆ7”&Ö#4–u¥tf¦4'¦&ÇT”vÇU¤ucD”tcD„§–åc¥g‡T”4d¶–öu4'E•„d”„ç&sFvsVµ¥†vu•…#6ÖÆ–E…&Ä”3´”„ç&sFvC%g£&ƒ”tcD„§–åc¥4E”#3%f´”vÇU¤ucD”„æÆD4Ã‡T”4&¦##W¦D4&†D…'–t£Duef3%fµ5sVµ¥†…E¥…$å•„u4'U¥†6uEtgug‡T”4t”e$•VµddÆ´£¦Õ¦Æ6´cD„§–åc¥4#„”e$•VµddÆ¶ÇVDug–$uf†FÕfµåfÕ¦Õg•…#6ÖÆ–E…&ÄÄg‡T”4t”S†4G…U4d¤e%3T6Eu¦Õ¥„¤&D…'–t£DuVvd4%U4d¤e%3T¦&å&Æ6×†Å•…¦Å¤T£¦Õ¦Æ6´cD„§–åc¥7vuS%csS%t¦Æ6£Bµ„sFt”CFôµGF6&Ç‡T”4&Ö#4–t´tçf&äã”vFÆ##ÆD„£T”s–Ô”vFÆ##ÆD„§¥„×”‡F6&”t”4&¦##W¦D4'¦&ÇU5sVµ¥†„&D…'””Cu£%gf%uc6æ·U£%c…#6ÖÆ–E…&Ä´6G¦&ÇU5sVµ¥†väµGF6&”t”4&¦##W¦D4'¦&ÇU5sVµ¥†„å•„u4&†D…'–t£Duef3%fµ5sVµ¥†…E¥…$å•„U£%c´„ç&sT¦&Õ&ÆTTcD„—”C‚ô”sVÆG”$å•„ôµGF6&”t”4&†D…'–t£Duef3%fµ5sVµ¥†…E¥…$å•„V3%c´„ç&sT¦&Õ&ÆTTcD„—4”„ç&sT¦&Õ&ÆTS†46³u„sV6&”t”4&¦##W¦D4'¦&ÇUc%g£&ƒ…#6”””vFÆ##ÆD„£TÆÖFÆDTcD„§–åc¥6væ3'G&ÆFÆvFöD67ó‡T”4t”tçf&äã”…g¥¥u$¦&Õ'“%g¥S%c”Cv$vÇ¦Deg¥¥u$¦&Õ'“%g¤´„ç&sT¦&Õ&ÆTTcD„—4”„ç&sU…¥vÆæ…$&D…'”µGF6&”t”4'¦&ÇU5sVµ¥†„å•„V3%c´„ç&sU…¥vÆæ…$&D…'”Ä4#3%fµ5sV¶tæÆ3æÆD6³u„sFt”ƒ6&Ç‡T”4dÇ”$Ö„ã”tg6$4&–##VÆ7”&†&Õu–Ó—U¥VÇVFÕg–3%g¤”u§f6”&Å•tæô”sÆ3&†Æ3‡T”4&¦##W¦D4'E¥„æõÓ—U¥VÇVFÕg–3%då•„$å•„u4'U¥†6uEtgue$•VµddÆÄç&sWU¥u$å¥„æôÄ4$å•„…dV…5%UWUÓ—U¥7vudV…5%UWUEtc6ÖÃDäCB´´6³u„sFt”u§f6”õ“#—V35v%ug¦4'e¦”'¦&ÇV&ÕfµEug¦ug¤µ4#u„sFt”4u“#—V35u–Ó—U¥VÇVFÕg–3%då•„u4'6„ãe„æÅ¤T§f&Õg¤´sÆ3&w4”tcD„§–åc¥eg¥¥u$¦&Õ&ÆTdæÆDS†46³u„sFt”4v%ug¦T§f&Õd¦&å¦Æ6äæÅEtguEtgtÆäæÆD6‡E¥„æôÄ4&–##VÅ5sS%¥„§¥¥S†46³u„sFt”ƒ6&Ç‡T”4dÇ”$†6Ó“44'E¥„æõ¥„Öu–æ¶u–Ó—U¥4'¥¥…'¥„sFt”tçf&äã”vG–#5gv7¦övW”&–##VÅ5sS%¥„§¥¥S†4FöuEtgue$•VµddÆ´§f&ÕW4”e$•VµddÆ³†D„§TE´÷”'E¥„æõ¥„Ód”dæÆDG…U4d¤e%3UF&ÇV&ÕfµEug¦CFvegFD”Cusu„sFt”u§f6”õ“#—V35us#Æ3&w4”t§f&Õd¦&å¦Æ6äæÅEtgu…4'e¦”'E¥„æõÓ—U¥VÇVFÕg–3%då•„$å•„”‡F6&”t”4'5¥…u¦Ó“&Õ$å¥„¦å¥tf–$ud†6Ó“44””u¦†$„æÄó‡T”4t”u§f6”õ“#—V35u“$gU¤vÆµ•…&Ä”s–Ô”vG–#5gv7–¶vS‡T”4t”4tÇ“†u“&†Å“'6vu–vDv†Ä”tæ†&Õ'¤tc¥4&æ6Ó“44'7”'E¥„¦å¥tf–$uf6&”t”4t”tçf&äã”vÇ¥Eug•£%f…–×†Ä”Cu–Ó—U¥VÇVFÕg–3%då•„$¦3Æ6ÖFÅ•t§5¥6†–##VÅ5sS%¥„§¥¥S†47vu“$gU¤vÆµ•…&ÄÆÔ§f&Õd¦&å¦Æ6äæÅEtgtµGF6&Ç‡T”4t”4tÇ“†vu–vC%Vu¦Ó“&Õu•4'E¥„¦å¥tf–$uVu£4§fE„4”tfµ¤4#uVv%ug¦4#'”#uVu£4§fE„&6&”t”4t”vÆÔ”6‡3Æ6ÖFÅ•t§5¥6¶vS‡T”4t”4t”4&Ö#5gU¤SÆ6ÖFÅ•t§5¥VG–#5gt”CvD„£¥GF6&”t”4t”4u“$gU¤vÆµ•…&ÄÆÓÆ3&†Æ7“V…¤uö%ug¦6³u„sV6&”t”4t”4tÇ“†u•u&´”w†…“'G&Ö6u–Ó—U¥„ÖvDs†vDv†Ä”vG–#5gu„sFt”4t”4t”u§f6”õ“#—V35us$§f&ÕW4”t§f&Õd¦&å¦Æ6äæÅ…4'e¦”&–##VÅ5sS%¥„§¥¥S†46¶vS‡T”4t”4t”4t”tæ†&Õ'¤tc¥3V–##VÅ5sS%¥„§¥¥S†43W¥¥…õ–Ó—U¥7vu–Ó—U¥VÇVFÕg–3%Wó‡T”4t”4t”4#•„sV6&”t”4t”4u–ä¦Å•w3u„sFt”4t”4#•„sFt”4veg‡U„sFt”4tÇ“†vu–vC%Vu“#“$u'T£5u¦ÖÇU¤4&„”sÆ6ÖFÅ•t§5¥4&æ6Ó“47vu“4¦Å•…&Ä”tVv&Õc4”vG–#5gu„sFt”4vu–t´4fÖ#5gU¤SÆ6ÖFÅ•t§5¥VG–#5gtµ4#u„sFt”4t”4&æ6Ó“4„×V4…g¦6ƒt”t§f&Õd¦&å¦Æ6äæÅEtgtÄ4'E¥„æõ¥„Ód”sVÆG”%E¥…õs#Æ3&†Dµ4#”µGF6&”t”4#•„sFt”ƒ6&Ç‡T”4dÇ”'v6Õgu•„¦Ä”sVÆG”'¦%g5¥…'f&äÖu¦Ó—””uf…“&vu£4§fE„4”tgU¤4&–sV´”…&õ¥svDs†vDv†Ä”sÆ3&†Æ3‡U„sFt”3‡d”…&õ¥4&¦##V¶…'##FvDs†vE„æÄ”…&õ¥4'¥•sÄ”„ç&sFvsVµ¥†vu•…#6ÖÆ–E…&ÄöÇ‡T”4dÇ”D”…&õ¥4'¥•sÄ”„ç&sFvsVµ¥†vu•…#6ÖÆ–E…&Å„sFt”3‡d”3u•sV´”…&õ¥4'¦%g5¥…'f&”'7”'¥•sÅ„sFt”3‡d”3u•sV´”…&õ¥4&–##VÄ”„æÆD4'7”'¥•sÅ„sFt”tçf&äã”tæ…“&†Ä”Cv&Õc4”S†4G‡¦D„§&Ö74”e$•VµddÆ´£¦Õ¦Æ6´cD„§–åc¥4#„”e$•VµddÆ¶ÇVDug–$uf†FÕfµåfÕ¦Õg•…#6ÖÆ–E…&Å–wó‡T”4&¦##W¦D4'¦&ÇU5sVµ¥†„V„çu•…&¦ug””Cv&Õc4”S––Õf¦DVÇU¤ucE$vÇ¦4tc“&†Æ6§…U4d¤e%3T6Eu¦Õ¥„¤&D…'–t£DuVvd4%U4d¤e%3T¦&å&Æ6×†Å•…¦Å¤T£¦Õ¦Æ6´cD„§–åc¥CFôµGF6&”u“#—V35v3'FÆ$uc##TV„çu•…&¦ug””Cv&Õc4”S––Õf¦DVÇU¤ucE$vÇ¦4tc“&†Æ6§…U4d¤e%3UF%g5¥…'f&£FôµGF6&”u“#—V35u–Ó—U¥U'34&†Dtæõ¥„–u4'U¥†6uC$§¥tã5sVµ¥†„V„çu•…&¦ug•e$•VµddÆ´§f&ÕR´´6³u„sV6&”u¦Ó—””6†¦##W¦D4&æ6Ó“44'e¦”&æ6Ó“4„×”‡F6&”t”4&¦##W¦D4#t”t§f&Õd¦&å¦Æ6äæÅEtgtÄ4'E¥„æõ¥„Öve4””vG–#5gtó‡U„sFt”4tÇ“†u“4¦Å•…&Ä”tVv&Õc4”„ç%¥w†ÆDs—U„sFt”4u“#—V35v&Õc5Ó—U¥„Öu4$&6ä¦†U3VÖ6Ó—D´t§f&Õd¦&å¦Æ6äæÅEtgtÆ×FÆU„Öôµ6³u„sFt”4u“#—V35v&Õc5Ó—U¥VÇVFÕg–3%g¤”Cu„§••†·U¦ä§f%6†–##VÅ5sS%¥„§¥¥S†43S%•wƒ¥„Öôµ6³u„sFt”4u“#—V35v&Õc5S'FÆ$uc##Fu4'U¥†6udV…5%UWUS'FÆ$uc##Fö&Õc5Ó—U¥„×4”sVÆC§f&Õd¦&å¦Æ6äæÆ7–³u„sFt”4u“#—V35v3'FÆ$uc##TÅ¥†¶u4'¦%g5¥…'f&µ'34&†Dtæõ¥„—U£%cC4¤F6Õf†DuVö&Õc5S'FÆ$uc##Gó‡U„sFt”4tÇ“†v6ÕgE•„v3'G&”'&Õ&ÆT4&†D…'–t£Duf6&”t”4&Ö#4–t´tçf&äã”sÆ3&vv#%–v%ug¦ug¤µ4#u„sFt”4t”4&¦##W¦D4'¦&ÇU5sVµ¥†„&D…'””Cv%ug¦3Vå¥s—E¥…'–U3Vå¥…$&D…'–t£DuVô£4ç&sT¦&Õ&ÆT67ó‡T”4t”4u“#—V35v3'G&¶ÇU¤ucE3%cT”Cv3'G&¶ÇU¤ucE$vÇ¦4tc“&†Æ6“Vå¥…%6´ç•¥tc¥6‡¦&ÇU5sVµ¥†„&D…'”µGF6&Ç‡T”4t”4u“#—V35u–Ó—U¥„Öu4'E¥„æôÆäç%¥w†ÆDs—TÆÔ§f&Õg¤ó‡T”4t”4u“#—V35u–Ó—U¥„äÅ¥†¶u4&–##VÆ7“WE•„ô´t§f&ÕW”C´”t§f&ÕdV„çu•…&¦ug”ÆÖFÆDS—•4¦Å•…&Ä´t§f&ÕWµ3W#&ÇT´674§–³u„sV6&”t”4t”3‡d”tç•¥tc¥4&„”wFÆU4&Ö6Ó—D”tçf&Õ'DvÇf&äÖu•sV´”tæõ¥tç$”vÆÔ”†FÄ”tg66Õf…¤†¶vtc%¥4&„”„¦Æ%tgv4uf´”„ç&sFvsVµ¥†vu•…#6ÖÆ–E…&Å„sFt”4t”4&¦##W¦D4'%¥†¶u4&t¤‡G¦&ÇU5sVµ¥†„Å¥†Ã”÷•#v3'FÆ$uc##TÅ¥†Ã”÷•#u–Ó—U¥„äÅ¥†Ã•”GF6&”t”4t”w†ÆD4'U¥†EF&ÇU5sVµ¥†„&D…'””Cu“$f¦uWU£%c´wFÆU6³u„sV6&”t”4t”3‡d”vÆÔ”†FÄ”u'f&–C”v††FÕVu•4'•¥s†4„&Å¤4'¦&ÇT”vÇU¤ucD”tcD„§–åc¥7vu“4¦Å•…&Ä”s—U¥g‡T”4t”4vu–t´sVÆCç&sT¦&Õ&ÆTTcD„–uCv&åg6$6¶vS‡T”4t”4t”4'U¥†EF&ÇU5sVµ¥†„&D…'””Cv3'G&¶ÇU¤ucE…#6“V¦$s—U¥6wó‡T”4t”4t”4'•¥s†4dç&sT¦&Õ&ÆTTcD„§–åc¥6‡U¥†EF&ÇU5sVµ¥†„&D…'”Ä4&–##VÆ7—vv&Õc5Ó—U¥„×ó‡T”4t”4t”4&¥•tæõ¥3W¥¥…ö%cTÄ4'U¥†EF&ÇU5sVµ¥†„&D…'”µGF6&”t”4t”ƒ6&Ç‡T”4t”4v%ug¦3Vå¥s—E¥…'–U3W¥¥…$&D…'–t£DuVô£4ç&sT¦&Õ&ÆT674”sVÆCç&sT¦&Õ&ÆTTcD„—ó‡T”4t”ƒ6&Ç‡T”4t”3‡d”t§&ÕvDv†Ä”sVÆG”'¦%g5¥…'f&”#'”#uVv%ug¦ug¥„sFt”4u¦Ó—””6†¦##W¦D4'E¥„æô”s–Ô”sÆ3&†Æ7–¶vS‡T”4t”4v%ug¦3V–sV´´sVÆCç%¥w†ÆDs—TÄ4'U¥†6udV…5%UWUEtc6ÖÃDä6wµGF6&”t”4#•„sFt”ƒ6&ã6&Ç‡TÇ–÷„sFt¶”%V6Ôc%¥„§¥¥4&†&”&Æ&å'6ÕVvD„¦Å¥4&†&Õu“#—6$uf¦D4'¦&ÇV&Õf´”sÆ3&†Æ7“V6&”Ã‡U¦ågU“5'##Fu“#—6$uf¦Ddç&sWU¥u$å¥„æõ¥„Öö3$æÆ&ÕSd”e$•VµddÆ³––Õf¦DDäTµFöuS%ce$•VµddÆÄç&sWU¥u$å¥„æõ”#u„sFt”tçf&äã”„ç&sWU¥u$å¥„æõ¥„Öu4'U¥†6uS%ce$•VµddÆÄç&sWU¥u$å¥„æõ–wó‡U„sFt”„æ¥¥sVÄÆå'••…¦Æ6äæÄ´6‡e–Ö÷”C´”‡F6&”t”4'¦”ô•6‡e–Ööu•„Öu•sSTµ3W3ç&sWU¥u$å¥„æôµ4#u„sFt”4t”4'•¥…#6ÓCu„sFt”4veg‡U„sFt”4u“#—V35v3'G&ÓVÅ¤SÆ3&vu4'e–Ööu•„ÖudV…5%UWUS'G&ÓVÅ¤SÆ3&su„sFt”4v3'G&ÓVÅ¤SÆ3&†Æ7“V…¤uö3'G&ÓVÅ¤SÆ3&wó‡T”4#”µGF6&Ç‡T”4'•¥…#6ÓFv3'G&ÓVÅ¤SÆ3&†Æ7§F6&ã6&Ç‡TÇ–÷„sFt¶”$Ö„ã”tg6$4'¦&ÇT”vÇU¤vÆ¥¥„ÖvE„æÅ¤4&–U4#uVu£&Ã%¥sFu£%gf%uc6æ·U„sFt¶”$¥¦”#uVv3'G&”#5¥vÆæ…v„ÖtÔ7vvDv†Ä”vÇU¤ucD”†Gf&–C”t¦Ä”tçf&äç¤ug•¥uu•„ÖvE„æÅ¤3V6&””T'u•„¦†%4'¦&ÇU5sVµ¥†„&D…'””e&õ¥4'¦&ÇT”vÇU¤ucD”tcD„§–åc¥4#'”'6„ã”…g¥¥uvsV¶tæÆ3‡T”6öu„&†6ÔgD”„ç&sU…¥vÆæ…$&D…'””e&õ¥4'¦&ÇT”†FÆvFöD4&†D…'–t£DuVu“#—–6Õg¦4s—U¤vÇU§”#'”#uVv3'G&”'&Õ&ÆT4&†D…'–t£Duf6&”Ã‡U¦ågU“5'##Fv$vÇ¦Deg¥¥u$¦&Õ'“%g¤´g‡T”4'¦&ÇU5sVµ¥†„&D…'”ö”%U4d¤e%3T6Eu¦Õ¥„¤&D…'–t£DuVvd4%U4d¤e%3T¦&å&Æ6×†Å•…¦Å¤T£¦Õ¦Æ6´cD„§–åc¥7†6&”v3'G&ÆFÆvFöDTcD„“d”e$•VµddÆ´£¦Õ¦Æ6´cD„§–åc¥4#„”e$•VµddÆ¶ÇVDug–$uf†FÕfµåfÕ¦Õg•…#6ÖÆ–E…&ÄÄg‡TµFöuS%csS%t¦Æ6£FvS‡T”4&¦##W¦D4#3%fµ5sV¶tæÆ7”””sVÆG”%E¥…†&ågE–Õg•–wó‡U„sFt”u§f6”ö$uc”v¶u4t÷”'”Gvv3'G&¶ÇU¤ucE…#6“V¦#5gVDG6v77$µ4#u„sFt”4u¦Ó—””6‡5¥…v”””Dt”vöu4'¦&ÇU5sVµ¥†„&D…'”ÆÖÃ¥sF‡Ä÷”'·—7”‡F6&”t”4t”tçf&äã”vÇU¤ucD”Cu•…#6ÖÆ–E…&Å#%c#—F4s—U¥sS#—F4tc´„ç&sT¦&Õ&ÆTTcD„—4”v·4”v÷ó‡T”4t”4u“#—V35vC%g£&ƒ”Cu•…#6ÖÆ–E…&Å#%c#—F4s—U¥sS#—F4tc´„ç&sU…¥vÆæ…$&D…'”Ä4'Ä4'µGF6&Ç‡T”4t”4vu–t´†FÆvFöD4…CtÔ6¶vS‡T”4t”4t”4#3%fµ5sV¶tæÆ7“V…¤uösVµ¥†wó‡T”4t”4veg‡T”4t”ƒ6&”veg‡U„sFt”„¦ÆD…g–&”#3%fµ5sV¶tæÆ7§F6&ã6&Ç‡TÇ–÷„sFt¶”$Ö„ã”tg6$4&–##VÆ7”#3%f´”t£T”…&õ¥4&æ…¦Æ&”'¦&ÇV&Õf´”sÆ3&wU„sFt¶”$4tg••sv%ug¦4%VuVv3'G&ÓVÅ¤4'E¥„æô”…'d”w‡35vE„æÅ¤4&–##VÆ3‡T”6öu„&†6ÔgD”tcD„§–åc¥eg¥¥u$¦&Õ&ÆTdæÆDS†44$$”s†44&Ö6Ó—D”„ç&sFvsVµ¥†vu•…#6ÖÆ–E…&Ä”…'d”…&õ¥4'¥¥…v#%–vE„æÅ¤4'¦&ÇT”vÇU¤vÆ¥¥„æ6&””T'•¥…#6ÓW¤”TVv%tgt”u§–##vE„æÅ¤4&–##VÄ”…'d”…&õ¥4&¦#4§•¥„çv##V¶sVä”t§f&ÕVvsS%¥„§¥¥4'E•…'–††6&”Ã‡U¦ågU“5'##Fv$vÇ¦Deg¥¥u$6##VÆ7–†6&”v%ug¦FöudV…5%UWUS'G&ÓVÅ¤SÆ3&w5„sFt”tcD„§–åc¥eg¥¥u$¦&Õ&ÆTdæÆDS†4FöuEtgug‡T”4t”e$•VµddÆ´£¦Õ¦Æ6´cD„§–åc¥4#„”e$•VµddÆ¶ÇVDug–$uf†FÕfµåfÕ¦Õg•…#6ÖÆ–E…&ÄÄg‡T”4t”S†4G…U4d¤e%3T6Eu¦Õ¥„¤&D…'–t£DuVvd4%U4d¤e%3T¦&å&Æ6×†Å•…¦Å¤T£¦Õ¦Æ6´cD„§–åc¥7vuS%csS%t¦Æ6£Bµ„sFt”CG5„sGö”$å•„…dV…5%UWUÓ—U¥7vudV…5%UWUEtc6ÖÃDäCFvS‡T”4&¦##W¦D4&–##VÅ5sS%¥„§¥¥S†44””sVÆG”$å•„…dV…5%UWUÓ—U¥7vudV…5%UWUEtc6ÖÃDäCFôµGF6&Ç‡T”4&¦##W¦D4'¦%g5¥…'f&”””sÆ3&wV3'FÆ$uc##Cu„sV6&”u“#—V35u£%gf%uc6æ¶u4'E¥„æôÆÖFÆ##ÆD„£Tó‡T”4&¦##W¦D4'¦&ÇU5sVµ¥†„&D…'””Cu£%gf%uc6æ·U£%c…#6ÖÆ–E…&Ä´6G¦&ÇU5sVµ¥†väµGF6&”u“#—V35v3'G&ÆFÆvFöDTcD„–u4&å¥s—E¥…'–U3Vå¥…$&D…'–t£DuVô£4ç&sU…¥vÆæ…äµGF6&”u“#—V35v3'G&¶ÇU¤ucEEtgt”Cu•…#6ÖÆ–E…&Åe„æÅ¤VÇU¤ucES%cEtgtÆÖFÆD6‡¦&ÇU5sVµ¥†„&D…'”µGF6&”u“#—V35vE„æÅ¤VÇU¤vÆ¥¥„åE¥…u4'¦&ÇU5sVµ¥†„å•„ôÆÖFÆD6‡¦&ÇUc%g£&ƒ…#6–³u„sV6&”vu–t´4c3%fµ5sV¶tæÆ3æÆD6¶vS‡T”4t”…&ö6Ó“4”sVÆG”$f6ä§f6–†6&”t”4t”6Ef&ä¦Å•tæõ•t§5¥3Fu•…#6ÖÆ–E…&Åe„æÅ¤VÇU¤ucES%cEtgt”u'e¥„Öv&Ó“”wGV#66vDv†Ä”„ç&sFvsVµ¥†vu•…#6ÖÆ–E…&Ä”s—””…&õ¥4'¦&ÇT”†FÆvFöD4&†D…'–t£DuWT§—†6&”t”4ó‡T”4#•„sV6&”u¦Ó—””6†¦##W¦D4'&Õ&ÆT4'e¦”#3%fµ5sV¶tæÆ3æÆD6¶vS‡T”4t”t§f&Õd¦&å¦Æ6äæÅEtgtÆäæÆD6‡¦%g5¥…'f&“V–##VÆ3G&Õ&ÆTc4”„ç%¥w†ÆDs—TÆÔ§f&Õd¦&å¦Æ6äæÆ3G&Õ&ÆTcó‡T”4#•„sV6&”v6ÕcE„§T”t§f&Õd¦&å¦Æ6äæÅEtgtó‡Veg‡U„sGd¶—6&””Tæõ¥tç$”vÆÔ”…&õ¥4&æ…¦Æ&”&–##VÄ”vÇVFÕg–3%Vv%tgt”vÇ¤”sÆ6ÖFÅ•t§5¥4#'”#uVu“$gU¤vÆµ•…&Ä”t§f&ÕVvsS%¥„§¥¥4'E•„U„sFt¶”$4tg••svDs”Fuf¦”%VuVu–Ó—U¥4'&å¦Æ6äæÄ”s†44#'”&¦uf¦‡T”6öu„&†6ÔgD”tæ†&Õ'¤tc¥4%VuVu“$gU¤vÆµ•…&Ä”t§f&ÕVvsS%¥„§¥¥4'E•„&6&””T'•¥…#6ÓW¤”e'–EuVvu–vDv†Ä”t§f&ÕVvsS%¥„§¥¥4'E•„v„Öv%ug•£%f…–×†Ä”…'d”…&õ¥4&¥•sV¶u&†DuVu–Ó—U¥4'&å¦Æ6äæÄ”s†4g‡T”6÷e„sVÖEsV¦DvÇf&”&–##VÅ5sS%¥„§¥¥S†4VÇ¥Eug•£%f…–×†Ä´g‡T”4##æõ¥tç$ö”$å•„…dV…5%UWUÓ—U¥7vudV…5%UWUEtc6ÖÃDäCG5„sFt”tæ†&Õ'¤tc¥FöuEtgue$•VµddÆ´§f&ÕW4”e$•VµddÆ³†D„§TE´Äg‡TµFöu–Ó—f$uf†&”#u„sFt”u§f6”õ“#—V35us$§f&ÕW4”t§f&Õd¦&å¦Æ6äæÅ…4'e¦”##æõ¥tç$ÆÕgVD„§¥„Öôµ6¶vS‡T”4t”3‡d”vÆÔ”…&õ¥4&–##VÄ”vÇ¤”vÇT”…&õ¥4&¥•sV¶u&†DuVu£4§fE„u•sV´”…&õ¥4&–##VÅ5sS%¥„§¥¥4'7”&¶u¦Õ¥„¦Æ&å4”vÃ£4Öv&Ó“”sÆ6ÖFÅ•t§5¥g‡T”4t”tçf&äã”tæ†&Õ'¤tc¥T§f&Õd¦&å¦Æ6äæÄ”Cu“$gU¤vÆµ•…&ÄÆÖFÆD6†–##VÄµGF6&”t”4'¦”õ“$gU¤vÆµ•…&ÅÓ—U¥VÇVFÕg–3%Vt•Cv&åg6$6¶vS‡T”4t”4vu–t´4gE•…'–†„f5…f†$„Öõ–Ó—U¥VÇVFÕg–3%W4”tæ†&Õ'¤tc¥T§f&Õd¦&å¦Æ6äæÄµ6¶vS‡T”4t”4t”4'•¥…#6ÓFu¦Ôg63%Su„sFt”4t”4#•„sFt”4veg‡T”4#•„sV6&”v6ÕcE„§T”…'–EuSu„sS•„sV6&“‡¶Ç‡T”6öuVÕgE•„vDv†Ä”„ç&sFvsVµ¥†vu•…#6ÖÆ–E…&Ä”u§–##v#'†´”t§f&Õg¤”…'d”sVÆG”&–##VÆ7“V6&””e&ö„Öu¦ågU“5'##Fv%s–¶u§¥„ÖvDv†Ä”vGFÕgT”tcD„§–åc¥4'&”'v$tf¥¥3V6&””T'u•„¦†%4&†D…'–t£DuVudv†Ä”„ç&sFvsVµ¥†vu•…#6ÖÆ–E…&Ä”…'d”„¦Æ%tgu„sFt¶”$4tg••sv#'†µÓ—U¥„Öudv†Ä”t§f&ÕVu•„§••†¶vDv††D4#uVu•…#6ÖÆ–E…&Ä”vÇ¤”tã6ä¦Æ&å'6U4#3&ÇU£‡T”6öu„&†6ÔgD”sVÆC§f&Õg¤”e&õ¥4&–##VÄ”tg–6ÔcT”…&õ•…vDv†Ä”tcD„§–åc¥4#6w‡4”t¦Ä”…g¦sVå„sFt¶“–6&Õ£&Ôãs—T”„¦Æ%tguS'G&¶ÇU¤ucE…#6ÖÆ–E…&Ä´g‡T”4&†D…'–t£DuSd”e$•VµddÆ´£¦Õ¦Æ6´cD„§–åc¥4#„”e$•VµddÆ¶ÇVDug–$uf†FÕfµåfÕ¦Õg•…#6ÖÆ–E…&ÄÄg‡T”4'f$u$6##VÆ7¦öudV…5%UWUÓ—U¥gFDÄg‡T”4'U¥†D6##VÆ7¦öudV…5%UWUÓ—U¥gFDÄg‡TµFövFÓ—¤4#u„sFt”3‡d”tVv%tgt”u§–##u–Ó—U¥4#'”'f$uvsVµ¥††6&”u“#—V35u–Ó—U¥S—5¤VÇU¤ucEEtgt”Cv&Õc4”S†4G…U4d¤e%3T6##VÄÄ4'VEs•¥„’´´6³u„sFt”u§f6”õ“#—V35u–Ó—U¥4'e¦”'f$u$6##VÆ7–¶vS‡T”4t”t§f&Õe$u$¦&Õ&ÆTS†43W¥¥…õ–Ó—U¥7vu–Ó—U¥S—5¤VÇU¤ucEEtgtÆäçVÕWó‡T”4#•„sV6&”tÇ“†u•4'E•„u¦ä§f%4'f$uv3'G&”'&Õ&ÆT4#'”'U¥†6v3'G&”'&Õ&ÆTg‡T”4&¦##W¦D4'f$u%V#VÆG”””sVÆG”$å•„†&ågE–Õg”Ä4'VEs•¥„’´´6³u„sFt”u§f6”õ“#—V35us&·4”t§f&ÕfD”s–Ô”sVÆC§f&Õg¤ÆÕgVD„§¥„Öôµ6¶vS‡T”4t”tçf&äã”s—5¤VÇU¤ucD”Cu–Ó—U¥S—5¤VÇU¤ucEEtgtÆÖFÆD6†–##VÄµ4Su„sFt”4v#'†µds”õ¥†7V3%c´s—5¤VÇU¤ucDÄ4'µGF6&”veg‡U„sFt”3‡d”„¦Æ4w†…“%VvDv†Ä”„ç&sFvsVµ¥†vu•…#6ÖÆ–E…&Ä”†GDvvv&Õc4”vÇU¤vÆ¥¥„æ6&”u¦Ó—””6‡5¥…v4””Dt”v¶u4&†D…'–t£DuWU“#“&åt”v·$·–¶vS‡T”4t”u§f6”ö$uc”vöu4t÷”'”Gvu•…#6ÖÆ–E…&ÄÆÖÃ¥sF‡Ä÷”'·—7”‡F6&”t”4t”tçf&äã”s—5¤VÇU¤ucD”Cu•…#6ÖÆ–E…&Å#%c#—F4s—U¥sS#—F4tc´tcD„§–åc¥7vv7vv–³u„sFt”4t”4&¦##W¦D4'U¥†D¦&Õ&ÆT4””s—5¤e'eFÕc4ÆÖFÆD6‡f$u$¦&Õ&ÆT6¶„ó‡T”4t”4u•…#6ÖÆ–E…&ÅS%c#—F4s—U¥sS#—F4tc´tcD„§–åc¥7vv7vv—vv&Õc55sVµ¥†wó‡T”4t”ƒ6&”veg‡U„sFt”tcD„§–åc¥3WU¥uf¶3gu¤tc¥4””…'–EuSu„sS•„sV6&“‡d”vƒD„'¤ö“‡e£&Ã…f”ÆÔçf%3—F6Õ'f#$—fDv‡•¥uWVä×e–×‡e–“—”ÕF7tÃ5&Æ35fEsWD3—¦6Ô×f%tc3”å•…'–†sÆå&Æ35'¤Æ×¤“w„ÖÇ‡U¦ågU“5'##Fv%tc6ÖÃE%„c•w‡¤´tSd”e$•VµddÆ³†D„§TE4”t“d”e$•VµddÆ³†D„§TE4”…'f$ug••sV¥¥Cƒd”sS%t¦Æ6–¶vS‡T”4##'†Æ6ÔgU“%Vu4##'†Æ6ÔgU“%Vvd‡vtÔ3GtÔD„ó‡T”4'¦”õ•3VÆ$ugE¥sS7“W5¥sVæDvvt•Cu–“VÆ$ugE¥sS7“W5¥sVæDvw”‡F6&”t”4'•¥…#6ÓFu¦Ôg63%Su„sFt”ƒ6&Ç‡T”4&Ö#4–t´w†ÆD4'”CtÔ7vvwvu4&„ÆÕg5¥sÆ&å'¤Æ×†Æ&ÖCG6v4„”vÇ4÷”'·—7”‡F6&”t”4&¦##W¦D4&µ¥wƒ•4””S†DvwU•t§¤´tWU¥w†Æ%ugVD„æ&ctÅ4&”ÆÕg5¥sÆ&å'¥s&ÆDµGF6&”t”4'¦”õ¤ug6DtVu”##'†Æ6ÔgU“%W”‡F6&”t”4t”„¦ÆD…g–&”&Õ•w‡¥¥GF6&”t”4#•„sFt”ƒ6&Ç‡T”4'•¥…#6ÓFvD„£¥GF6&ã6&Ç‡U“'††34ÖuC$§¥tã5sVµ¥†„V„çu•…&¦ug•e´”‡F6&”v4„§FÔc¥4&f#$§¥tã5sVµ¥†„å•„u4'U¥†6uEtgue4”sS%t¦Æ6£FôµGF6&”v4„§FÔc¥4&fsVµ¥†vu4tó‡U„sFt”„#–×‡—”&å¥…ö#$§ö”%TµFöv&ågE–Õg””‡vvEsVµ¥u§&Õf´”‡F6&”t”4'•¥…#6ÓFvDv‡7“Vf#$§¥tã5sVµ¥†„å•„U£%c´s–––³u„sFt”ƒ6&Ç‡T”4'vEt§6tÖu£%cC4¤F6Õf†DuVö#$§ö”%TµFöv&ågE–Õg””‡F6&”t”4'5¥…vsVµ¥†vu4#vÇ¤ÆÃ—e–×Å“5$¦&Õ&ÆTS†43Vå¥…ö#$§µGF6&”t”4'¦”ösVµ¥†vuCv&åg6$6¶vS‡T”4t”4vsVµ¥†vu4#vÇ¤ÆÃ—&Õ&ÆTGF6&”t”4t”…&ö„×Uƒ#––Õf¦DVÇU¤ucEEtgtÆäæÆD6‡e–Ö÷4”vÇU¤ucDµGF6&”t”4t”…&ö„×Uƒ&ÇU¤ucD·—3u„sFt”4veg‡U„sFt”4v6ÕcE„§T”vÇU¤ucDó‡T”4#•„sS•„sV6&“‡¶Ç‡T”6öuS&††$w‡fG”&¦$s—U¥4&„”t£¦Õ¦Æ6”&å¥s—E¥…'–U3V6&””t$6Eu¦Õ¥„¤…¥s—E¥…'–U4æ¦$s—U¥tu¤s–Æ7”&„”u&Å¥„u“'‡f&ÕVvDv††D4&†$„çd”tçf4vÆÆ7”#uVu•…#6ÖÆ–E…&Æ7“V6&””fFÄ”†F†&åvDs†v3&††$w‡fG”&¦$s—U¥4#uVu£%gf%uc6æ¶vDs†u•…§fuu“#—vUvÇU§”#uVu•…#6ÖÆ–E…&Æ7“V6&”„sFt¶”%E¥uSd”vƒD„'¤ö“‡e£&Ã…f”ÆÔçf%3—F6Õ'f#$—fDv‡•¥uWVä×e–×‡e–“—”ÕF3Ã4ç•—“–¦#4¦ÄÃ£¦Õ¦Æ6¶FÆ##ÆD„£TÆ×¤“w„×¤×u„sFt¶“–6&Õ£&Ôãs—T”„æõ•w‡6#6DF$s—U¥T£¦Õ¦Æ6¶FÆ##ÆD„£T´vFÆ##ÆD„£Tö”%U4d¤e%3T6Eu¦Õ¥„¤…¥s—E¥…'–U6³d”e$•VµddÆ´£¦Õ¦Æ6¶FÆ##ÆD„£T”‡F6&”u“#—V35u“'‡f&ÕVu4'U¥†6udV…5%UWUåfÕ¦Õg•#%gf%uc6æ¶ôµGF6&Ç‡T”4&¦$s—U¥3WU•sÄ”Cu£%gf%uc6æ·V&ÔgE¥GF6&Ç‡T”4&¦$s—U¥3W¥¥…$¦&Õ&ÆT6†å¥s—E¥…'–U3W&Õ&ÆT6³u„sV6&”u¦Ó—””6†¦##W¦D4&&&ÔgE¥7vu•…#6ÖÆ–E…&Å…4'e¦”%–×Å“5U¥sS6ÖÆÆ7–†å¥s—E¥…'–U3V†D…'–t£Dug¤µ6¶vS‡T”4t”tç6##VÄÆäæÆDTcD„§–åc¥6‡U•sÄÄ4&†D…'–t£DuWó‡T”4#•„sV6&”u¦Ó—””6†¦##W¦D4&&%cTÄ4'F#4§vTcD„§–åc¥„æD”s–Ô”S––Õf¦D3VÆ&å'–ug¤´vFÆ##ÆD„£TÆÓf6ä&õ…#6ÖÆ–E…&Æ7–·”‡F6&”t”4&¦##W¦D4&†D…'–t£Dudõ•sÄ”Cv%cT”tg¤”wFÆUs–Ô”…#V4uge¦”&å¥s—E¥…'–U3WF#4§vTcD„§–åc¥„Óu„sFt”4u“'‡f&ÕWV%s—–4v„&D…'–t£Dug¥s$cD„§–åc¥SV†%ufD”Cv%s—–4v„&D…'–t£Dug¤ÆÔçf&Ôæ†D6wó‡T”4#•„sFt”tç6##VÄÆÓf6ä&õdtg•£%c3¦Æ$tc…¦Ä”Cu£%gf%uc6æ·V%s—–4v…U•„¦å¥…'¥VÕg5•…'FÕSu„sV6&”u“'‡f&ÕWU£4§fE„'¤”Cusu„sFt”u§f6”õ“#—V35u£4§fE„v#%–u£%gf%uc6æ·U£4§fE„'¤µ4#u„sFt”4u“'‡f&ÕWU•u&µ#4§fE„õ£4§fE„V35&†6å4”vG–#5gtÆÔçfEsSÄ4&æ6Ó“43WE•…&Æ6ÖÆ†$VÇU¤ucDµGF6&”veg‡U„sFt”tç6##VÄÆÔ§fEsV¶sVåS4&õ¥„¦Ä”Cu£%gf%uc6æ·U–Ó“&Õ'&ÖEF4v†Æ6ÕRôÆÔç6##VÄ´6¶u£†v&åg6$GF6&”u“'‡f&ÕWU–Ó“&Õ'&ÖD6#6vu4&å¥s—E¥…'–U3V–#5gU¤vÇU£§fTC‡U“'‡f&ÕVôµ4õ”'VEw‡4ó‡U„sFt”tç6##VÄÆÕ'••†E5•sVå¥3W¦Dtg–D4””vFÆ##ÆD„£TÆÕ'••†E5•sVå¥3W¦Dtg–DGF6&”u“'‡f&ÕWU¤„¦†C¦†&ÖFÄÆÔçfEsS”Cu£%gf%uc6æ·U¤„¦†C¦†&ÖFÄÆÔçfEsSó‡U„sFt”tç6##VÄÆåg¥¥„¤U•…&„”Cu£%gf%uc6æ·VE„æÆ6µ&†DtSu„sV6&”v6ÕcE„§T”tç6##VÄó‡Veg‡T–—vt–ÖÇF4s—–D4”tg¤”e$•Vµdd”u§–##t£5&ö6ÕfÄ§§F6&Ç‡TÇ“†u”åTTeTö”'v6ÕWF6¤Såg‡TÇ–÷„sFt¶”$$”tçf%„&†D4&ÖEsV¦DvÇf&”&Ö#4–u”T£¦Õ¦Æ6´cD„§–åc¥3Vå¥…$F##v##VÆ&åôµtU„sFt¶”&uåfÕ¦Õg•…#6ÖÆ–E…&ÄÆÖFÆDTçf%„'f&ÕgVD6w”4'7”'&å'–#%#“%f´”vÇT”„—„åEWU„sFt¶Ç‡T”6öuS%fÄö”&öD…'v7¦÷dÃ&GDvƒ–“V¦##f%„¦¶##–”Ã5&ö6ÕfÄÆ×¤Ã4#$wwdÖ¥ÕEf6&”Ã‡U¥†‡v#4£”u£&Ôãs—T”tcD„§–åc¥VFÆDTçf%„'f&ÕgVDTçf%„&†D6†6&”u•…#6ÖÆ–E…&Äö”%U4d¤e%3T6Eu¦Õ¥„¤&D…'–t£DuVvd4%U4d¤e%3T¦&å&Æ6×†Å•…¦Å¤T£¦Õ¦Æ6´cD„§–åc¥7†6&”vsVµ¥†sd”sS%t¦Æ6—†6&”u“#—F4s—U¥sSö”'VEs•¥„—5„sGö”'VEs•¥„–vS‡T”4'¦”ô´tcD„§–åc¥4&†7”&†&æ·ÆÖFÆDTçf%„'f&ÕgVD6¶vS‡T”4t”„¦ÆD…g–&”õ•…#6ÖÆ–E…&Ä”tg¤”tgVU6·U£%c#—F4s—U¥sS´vÇU¤ucDÄ4&¦##v##VÆ&åó‡T”4#””ug63%VvS‡T”4t”3‡d”d¦Å¦¦öv…#4„ÓdÇ“–æ…&öEt—U“#—DÃ#•¤s—e–““„¦Å¥3W7“—vEw‡4Ç¤“åDSÃ%§$ug¤“%'¦Õ—E¦ÕU–ÕTôD—tÖ¥••uTôu“4Õt“4Ö¥W¤åFw¤äuWtÖÔSåDu¥E4ôF†…¤E—•¥E—„ôtW„ç¤“×¥&”æ¦Æ…¦¤„Ó‡T”4t”w†ÆD4#%•wƒ¥4””tcD„§–åc¥3V†6ä¦†UgG&Õ&ÆT4”tcD„§–åc¥3WDugES&Ãe¥4$”tçf%„'f&ÕgVDcu„sFt”4vu–t´tcD„§–åc¥3WV#4§E•w‡VÕf´µ4#u„sFt”4t”4#%•wƒ¥4””e$•VµddÆ³†Dv…fDvÇ67“Vµ¥sWf6Ó†$vÃe¥6ƒ%•wƒ¥7vu•…#6ÖÆ–E…&ÄÆÔg–6ÔcT”tg¤”tgVU6³u„sFt”4veg‡T”4t”„¦ÆD…g–&”#%•wƒ¥GF6&”veg‡Veg‡T–—vt–ÖÇF4s—–D4”tg¤”e$•Vµdd”u§–##t£5&ö6ÕfÄ§§F6&Ç‡TÇ“†u”åTTeTö”'v6ÕWF6¤Såg‡TÇ–÷„sFt¶”$$”tçf%„&†D4&ÖEsV¦DvÇf&”&Ö#4–u”T£¦Õ¦Æ6´cD„§–åc¥3W¥¥…$F##v##VÆ&åôµtU„sFt¶”&uåfÕ¦Õg•…#6ÖÆ–E…&ÄÆäæÆDTçf%„'f&ÕgVD6w”4'7”'&å'–#%#“%f´”vÇT”„—„åEWU„sFt¶Ç‡T”6öuS%fÄö”&öD…'v7¦÷dÃ&GDvƒ–“V¦##f%„¦¶##–”Ã5&ö6ÕfÄÆ×¤Ã4#$wwdÖ¥ÕEf6&”Ã‡U¥†‡v#4£”u£&Ôãs—T”tcD„§–åc¥dæÆDTçf%„'f&ÕgVDTçf%„&†D6†6&”u•…#6ÖÆ–E…&Äö”%U4d¤e%3T6Eu¦Õ¥„¤&D…'–t£DuVvd4%U4d¤e%3T¦&å&Æ6×†Å•…¦Å¤T£¦Õ¦Æ6´cD„§–åc¥7†6&”vsVµ¥†sd”sS%t¦Æ6—†6&”u“#—F4s—U¥sSö”'VEs•¥„—5„sFt”…¦†$…fÄö”'VEs•¥„—5„sGö”#&#&Æ´”‡F6&”vu–t´6††D…'–t£DuVu•„Öu•sSTµ3W¥¥…$F##v##VÆ&å”‡F6&”t”4õ•…#6ÖÆ–E…&Ä”tg¤”tgVU6·V3%c#—F4s—U¥sS´vÇU¤ucDÄ4&¦##v##VÆ&å4”…¦†$…fÄµGF6&”ve4&Æ$„æÄ”‡F6&”t”4dÇ”%5¥u“d”vƒD„'¤ö“‡e£&Ã…f”ÆÔçf%3—F6Õ'f#$—fDv‡•¥uWVä×f4…g6$3‡”äEW„å3–Öw†Æ7”æ¶u¦ÔÅu¦´õt¦´õFw”ÔD“ÖÔf´õF†Ôç¤f”ç¤“×¥SD×¥&ÄÔD¦„äEWtÔuSç¦sE•u$ÖÕS$ÕF†„ÕF7”åDÓ–¥“U•u—tÕDæ6&”t”4'¦”õ•…#6ÖÆ–E…&ÄÆÓWf6Ó†$vÃe¥u”‡F6&”t”4t”…¦†$…fÄ”CudV…5%UWUEtcecw‡¤ÆÓWf6Ó†$vÃe¥6ƒ%•wƒ¥7vu•…#6ÖÆ–E…&ÄÆÔg–6ÔcT”tg¤”tgVU6³u„sFt”4veg‡T”4t”tcD„§–åc¥3V†6ä¦†UgG&Õ&ÆT4”tcD„§–åc¥3WDugES&Ãe¥4$”tçf%„'f&ÕgVDcu4#%•wƒ¥GF6&”veg‡Veg‡T–—vt–“‡d”dæÅ¥Föv…#4„ÓdÇ““„¦Å¥w¤ÆÓ—•§“–¶#$ç¤Ç”çE•sS•wwe¥sGfsS6Ó–¶Etãs—TÃ‡fG“'“¶„çv#4æÄÅs–ÔÅs––Õf¦D„æ6&Ç‡Vsv#4£”6öu•„ÖudV…5%UVu¦ä§f%4æDv‡•¥uVäó‡U„sVÖEsV¦DvÇf&”&¶„çv#4æÅEtc¥„§•wvö%tc¥„§•wsd”e$•VµddÆ³†Dug–tg4µFövFÓ—¤4#u„sFt”S––Õf¦D3S%•wƒ¥„Öö%tc¥„§•wwÆÕ§f6µf…“&vô´…¦†$…fÄµ4•”#u„sFt”4vu–t´…¦†$…fÅ“W3&ÆT…#6ÕW”‡F6&”t”4t”tçf&äã”…&ÆT…#6ÕVu4#%•wƒ¥4&†7”%U4d¤e%3UU¥†ƒE„¦Äó‡T”4t”4vDucFD…g•¥3V¶„çv#4æÄ´6³u„sFt”4veg‡T”4#”µGF6&Ç‡T”4'¦”ô´s†Dug–tg4”tg¤”tgVU6·V„åFtfµ¥„¤å•…&Æ6ÖÆ†$6¶vS‡T”4t”tçf&äã”…gVu§f6Ó¤ö”#t”gC&ÖÆÖ#4§Dö”'¦D„§&ÖFDö”%U4d¤e%3T¥esW¦Ó—–%G††&æ²´”ƒu4ö%tc¥„§•wvu•„Öu•sSTµ3S&ÖÆÖ#4§F7§F6&”t”4'¦”öEsW¦Ó—–%„×”‡F6&”t”4t”S––Õf¦D3S%•wƒ¥„ÖöEsW¦Ó—–%„×ÆÕ§f6µf…“&vô´…gVu§f6Ó”C´”‡F6&”t”4t”4u“#—V35vFÔg6EuVu4#&ÖÆÖ#4§DÆå¦†$…fÄó‡T”4t”4t”4'¦”öFÔg6EuRôÆÖÇ¥ducFD…g•¥6¶vS‡T”4t”4t”4t”tçf&äã”…&ÆT…#6ÕVu4#%•wƒ¥4&†7”%U4d¤e%3UU¥†ƒE„¦Äó‡T”4t”4t”4t”…&ÆT…#6ÕWU¤vÇ¦4s—¥¥6wó‡T”4t”4t”4#•„sFt”4t”4#”µGF6&”t”4#•„sFt”ƒ6&Ç‡T”4'E•…&Æ6ÖÆ†$3V¶„çv#4æÄ´6³u„sS•„sV6&Õ£&Ôãs—T”u'34'f3%Vö#$§¥tãÓd”e$•VµddÆ³––Õf¦DDäTµFövFÓ—¤4#u„sFt”tçf&äã”vFÆ##ÆD„£Tö”%U4d¤e%3T6Eu¦Õ¥„¤…¥s—E¥…'–U4#„”…gU¤ufÖsVÅ¤4””6‡e–×Å“5¥$4&†7”&†&æ·ÆÖFÆ##ÆD„£Tó‡T”4'¦”õ£%gf%uc6æ·”‡F6&”t”4&å¥s—E¥…'–U3V¶„çv#4æÄ´6³u„sFt”ƒ6&Ç‡T”4&¦##W¦D4'¦%g5¥…'f&¦öudV…5%UWUS'FÆ$uc##Fvd4#&Õ&Å¦ÖÇU¥uu4ö#$§¥tãÓu•„Öu•sSTµ3W¦%g5¥…'f&§F6&”vu–t´„ç%¥w†ÆDs—Tµ4#u„sFt”4v3'FÆ$uc##GU¤vÇ¦4s—¥¥6wó‡T”4#•„sV6&”u“#—V35v%tc¥„§•wsd”e$•VµddÆ³†Dug–tg4”‡vudV…5%UWUEtc¥„§•w†%…4#„”…gU¤ufÖsVÅ¤4””6‡e–×Å“5¥$4&†7”&†&æ·ÆÓ†Dug–tg4ó‡T”4'¦”ö%tc¥„§•ww”‡F6&”t”4'¦”õ„§••†·V„ä&6ä¦†U6‡E•…&Æ6ÖÆ†$6·”‡F6&”t”4t”s†Dug–tg4ÆÕ§f6µf…“&vô´s†Dug–tg4ö”%U4d¤e%3Tå•…&Æ6ÖÆ†$6¶uCFu¤vÇ¦4s—¥¥S†Dug–tg4´s†Dug–tg4µ6³u„sFt”4ve4&Æ$„æÄ”vÆÔ”6‡E•…&Æ6ÖÆ†$6¶vS‡T”4t”4u¤vÇ¦4s—¥¥S†Dug–tg4´s†Dug–tg4µGF6&”t”4#•„sFt”ƒ6&ã6&Ç‡U¥†‡v#4£”u£&Ôãs—T”u&Å¥„$V„çv#4æÄ´s––Õf¦DDäTö”%U4d¤e%3U–×Å“5¥$6³d”…§fuvS‡T”4'e–×Å“5¥$3S6Ôc%¥„§¥¥6†¶„çv#4æÄµGF6&ã6&”—4”4§%„'f6åt¶”&†7”%U4d¤e%4&Ö6Ó—D”6C„¦Å¥63u„sW%„'f6åvW”&†D…'–t£Dud…¥…$F##v##VÆ&å$F##u•…ve4&Ö6Ó—D”67TÆ““DvÇ67“–†D…'–t£Dud…¥…$F##v##VÆ&å$F##u•…äó‡Vsv#4£”‡6u•…#6ÖÆ–E…&ÅS%c#—F4s—U¥sS#—F4tc”ƒu¦ä§f%4äÆ“GfE…'$„×e•…#6ÖÆ–E…&ÅS%c#—F4s—U¥sS#—F4tc§§F6&Ç‡TÇ–÷„sFt¶”%V6Ôc%¥„§¥¥4#uVu£&Ã%¥sFv#$§¥tã”tgU¤4'•¥sfFÕVvEsWU¥tæÆ34æ†6ÖÇ6U4&–#5gU¤4'#&ÇVD„Öu¦ä§f%4&ÆFÕg–U4&udV…5%UWUS'G&ÓVÅ¤SÆ3&†tÆÇ‡T”76&””dçf%uVu¥sS&„§f&ÓÆ&å'¤”w‡%Vv%s––w†Ä”u&ÆFÖÆ¥¥„Övtc%¥4&„”w‡fC%g””w‡%vÃ”s–Ô”t§f&Õg¥„sFt¶”&†&Õv%vÆæ…u–ÕVvEsV…–×†Ä”…'d”„&Æ6Õ§f6Óv%ug¦4'¦&ÇV&ÖÇU§”#6…&ô”s†&æ¶u–Ó—U¥„×U„sFt¶”%VvÇ¤”u£&Ôãs—T”s£&ƒ”„¦Æ3#—6FÕVv35f¦4&†&”'34ã¥3V6&”„sFt¶”$&$„çdÄ4#vÇ¤”u£&Ôãs—T”s£&ƒ”„ç£#W¦ÖÆ¥•sS$†¶vsv6Ó“%¥4#uVv4ug•¦Ó—–%tgU“%Vv#%–v%ug¦4'¦&ÇV&ÖÇU§“V6&”„sFt¶”$4tg••sv6Ó—fD4%6##“”s––Õf¦D4#tc”†G$wvu–ÕVvD„¦†FÕg–3%fµ„sFt¶Ç‡T”6öuu&Æ4„¦Å“$c¥uu”„¦Æ%s“%¥egV&Õf¥¥„ç¥•„£U6Ó—&å'¥”4'7”&µ¥„'•¥tæ†Duf´Æ”%f3%Vu”tçf%t§&ÕeF%g5¥…'f&äæt”vÇV35&Å•uT”t&¦##–sVÅS'FÆ$uc##W¥”4&¦##S6ÖÆ–E…&Æ7”'F#4¦Ä”…'d”…&õ¥4'u¥„¦Ö#4§E•sV¥¥4'%„'–#5¦Æ%ugVD3Fudv‡7”&ÖEsV¦DvÇf&”#6w‡4”t¦Ä”„¦Æ%s“%¥uvsFvDv†Ä”sVÆT…v%tg#4–vFÕg–3&Çf&“V6&”Ã‡U¥†‡v#4£”u£&Ôãs—T”„¦Æ%s“%¥egV&Õf¥¥„ç¥•„£U6Ó—&å'¤´g‡T”4'–##“ö”%U4d¤e%3U–×Å“5¥$7†6&”v#4#s—V7£ƒd”‡F6&”t”4d¶—6&”t”4t¶”$¥¦”&vD„£¥t4”…&ö„Öu¦ågU“5'##FvC&Ç6$4&¦##u¥sW¥•…&Ä”„ç%¥w†ÆDs—V7”#6…&ô”u#%sT”t§f&Õg¤”…'d”wFÅ¥„vDv†Ä”t§f&ÕVu“#“&åv3$gE¥4&•¥…#5¥ugT”„ç%¥w†ÆDs—V7“V6&”t”4t¶Ç‡T”4t”4”e&ö„Öv#4#s—T”s£&ƒ”t¦Ä”ufÕ¦Õf¦DvÃ%¥4&Ö#4–vDv†Ä”„æõ•u&Æ6”&¦##vw††DvÇf&”'u¥„¦Ö#4§E•sV¥¥4#tc”s†D…&Æ6äÖvDs†vDv†Ä”vÇV…'•wvv6ÕgU¤ug–sVä”…'%uVvsFuc%f•#%eVÕgU¤ug•¥„—5„sFt”4t”6öu¥„çu¥tç•w‡6U4#6ugT”…&õ¥4'F#%&Æ$4'6#$fµ¥uvtg¤”s†&æ¶v%tc¥„§•w‡¤”tgU¤4#uVu¤ugu¥sVµ¥sS”t§f&ÕVu“#“&åv„Öu¤vÆÕ¦Õg•¥sS”t¦ÆD†FÅ¥sFvDv†Æ%3V6&”t”4t¶Ç‡T”4t”4”Tçf&äç¤ug””…&ö„Öv4tg••sÆDug””tg¤”ucF4ug–sÆ&å&†$3Fuc%Vv%vÆæ…v%s–¶u£T”s—””u&Æ$uc¥4#vÇ¤”Te54#6…&ö#5c”sWfDvÆ¥¥4'&”#uVu¦åcE„¦ÄÆÇ‡T”4t”4„sFt”4t”6öu”u¦†$„æÅ”4&–U4&µ¥u¦†EwƒÆÇ‡T”4t”4Ã‡T”4t”ucF4ug–sÆ&å&†$dæ†%ud6##VÅ#“&å'¥¦öu–Ó—f$uf†&§F6&”ve7†6&–³d”…§fuvS‡T”4&¦##W¦#'†ÄÆæF†6ÓFõ„sFt”4t£¥5Eecw‡¤Æä¦Æ%s“%¥egV&Õf¥¥„ç¥•„£U6Ó—&å'¤ö”'•¥sfFÕef&ÓVÅ“%g¦3$g–UWfsS7”'7”&µ¥„'•¥tæ†Duf´Æ”%f3%Vu“#—E–ÖÇU¥dç%¥w†ÆDs—V7”'&äã¥tf´Æ”&¦##–sVÅS'FÆ$uc##W¤”tçf&å'–t£Dug¤”sf6ÕVvDs†vDv†Ä”„&Æ6Õ§f6Ó†&ÔæÄ”vÇF4„§fFÕgE¥sSÆ”%VvÇ¤”u£&Ôãs—T”†G$wvu–ÕVv6ÕgF#5¦Å¤4'&”#uVv&ÕcFD4'E•wf6”#%¥„§¦s—TÆ–75„sFt”6³u„sV6&”u“#—V35u¥†‡u¥„§%ugVDtg5S$gE¥T§f&ÕdF#5gVD„Öu4'f4…'##W¥“VÆT„&Æ6ÖÇE¥sS•w…E•sÅÓ—U¥TçfEsS7”õ”&Õ•w‡¥¥GF6&Ç‡T”4dÇ”%V6Ôc%¥„§¥¥4&†&”&Æ&å'6ÕVvD„¦Å¥7vu•sV´”tçf$w†Å“5u•w‡4”„ç&sWU¥uv%ug¦ug¥„sFt”tçf&äã”„ç&sWU¥u$å¥„æõ¥„Ód”e$•VµddÆÄç&sWU¥u$å¥„æõsu4&%…GF6&Ç‡T”4'–##“Æå'••…¦Æ6äæÄ´6‡e–Ö÷”C´”‡F6&”t”4'¦”ö#$§Æå#V4uVt•C””6EF&ÇV&ÕfµEug¦67”‡F6&”t”4t”„¦ÆD…g–&§F6&”t”4#•„sV6&”t”4'¦&ÇV&ÕfµEug¦ug¤Æä#3&vö#$§”tg¤”e$•VµddÆÄç&sWU¥u$å¥„æôµGF6&”ve6³u„sV6&”tÇ“†u4'E•„u¦ä§f%4'E¥„æõ¥„ÖvDs†v&Õc4Å…'dÅs—5¤4&–##VÄ”vÇU¤ucD”s†4g‡T”4dÇ”'¦##Ä”sÆ3&†Æ7”'FvFöD4'¦tg•¥4&„”„æ†%uVv3'G&¶ÇU¤ucD”tcD„§–åc¥7vu•sV´”…&ö„Öv%tgt”tg63#†v4„¦ÆFÕgVD„ÖvDs†u“#—VFÕg–D4#uVu•…#6ÖÆ–E…&Ä”…#6tæÅ„sFt”tçf&äã”tcD„§–åc¥e'eÓ—U¥VÇU¤ucEEtguEtgtö”$å•„…„sFt”4udV…5%UWUåfÕ¦Õg•…#6ÖÆ–E…&Ä”‡vudV…5%UWU5sS¥„§5¥tc%¥u$6Eu¦Õ¥„¤&D…'–t£DuW5„sFt”4uEtgusS%t¦Æ6—vv&ågE–Õg•Ç‡T”4´”Cv&Õc4”S†46wó‡U„sFt”3‡d”TVv%tcFs%4'VEs•¥„–v#%–u–Ó—U¥„æ6&”v$uc”s†TT§f&Õg¤”CtÔGF6&Ç‡T”4dÇ”$¦Dug••…&Ä”s“%¥„–u•w‡4”„ç&sWU¥uv%ug¦ug¤”tgU¤4'•¥s†44&–##VÆ7”&Ö#4–u¥tf¦4'¦&ÇT”vÇU¤ucD”tcD„§–åc¥g‡T”4&Ö#4–t´tçf&äã”sÆ3&vv#%–v3'G&ÓVÅ¤SÆ3&†Æ7–¶vS‡T”4t”tçf&äã”vFÆ##ÆD„£T”Cv%ug¦3Vå¥s—E¥…'–UGF6&”t”4&¦##W¦D4&†D…'–t£DuVu4&å¥s—E¥…'–U3Vå¥…$&D…'–t£DuVô£4ç&sT¦&Õ&ÆT67ó‡U„sFt”4vu–t´tcD„§–åc¥e'eÓ—U¥VÇU¤ucEEtguEtgtÆÖ††7–††D…'–t£DuWµ4#u„sFt”4t”4&¦##SsS¥GF6&”t”4#•„sV6&”t”4&¦##W¦D4'f$u%V#VÆG”””sVÆG”$å•„†&ågE–Õg”Ä4'VEs•¥„’´´6³t”3‡d”s†44'e¦”'f$uu–Ó—U¥4'&Õ&ÆT4#&7“Fv&Õc4”t§f&ÕVvsVµ¥††6&”t”4&¦##W¦D4'U¥†EV#—5¤4””sVÆG”$å•„†&ågE–Õg”Ä4'VEs•¥„’´´6³t”3‡d”s†44'e¦”'U¥†6u–Ó—U¥4'&Õ&ÆT4#&7“Fv#'†´”t§f&ÕVvsVµ¥††6&Ç‡T”4t”3‡d”tç•¥tc¥4&„”sVÆG”&–##VÄ”s†4g‡T”4t”u§f6”ö$uc”v¶u4t÷”'”Gvu•…#6ÖÆ–E…&ÄÆÔçfEsS÷”'·—7”‡F6&”t”4t”u§f6”ö$uc”vöu4t÷”'”Gvu•…#6ÖÆ–E…&ÄÆÖÃ¥sF‡Ä÷”'·—7”‡F6&”t”4t”4u“#—V35v#'†µ5sVµ¥†vu4&†D…'–t£Dud…¥…$F##v##VÆ&å$F##u•…õ•…#6ÖÆ–E…&ÄÄ4'Ä4'µGF6&”t”4t”4v$uc”sVÆCÇU¤ucD”Cv#'†µds”õ¥†7U£%c´s—5¤VÇU¤ucDµGF6&Ç‡T”4t”4t”4dÇ”'U¥†6v3'G&¶ÇU¤ucD”t£¦Õ¦Æ6Ç‡T”4t”4t”4'¦”ö&Õc55sVµ¥†vuCv&åg6$6¶vS‡T”4t”4t”4t”sVÆCÇU¤ucD”Cv#'†µds”õ¥†7V3&Ãe¥GF6&”t”4t”4t”4'f$u%V#VÆG“W¥¥…ö#'†µ5sVµ¥†w4”sVÆCÇU¤ucDµGF6&”t”4t”4t”4'U¥†EV#—5¤3W¥¥…ö&Õc55sVµ¥†w4”s—5¤VÇU¤ucDµGF6&”t”4t”4veg‡U„sFt”4t”4t”tcD„§–åc¥dæÆDTçf%„'f&ÕgVDTçf%„&†D6††D…'–t£DuW4”v·4”v÷4”sVÆCÇU¤ucDµGF6&”t”4t”ƒ6&”t”4#•„sV6&”t”4dÇ”'•¥„'5•tæÄ”†GDvvv&Õc4”vÇU¤vÆ¥¥„æ6&”t”4&†D…'–t£DuWV&ÕfÅ¤„åf4u&†DuVu4#6åfÄó‡U„sFt”4tÇ“†vE„&µ•…&Ä”t§f&ÕdÖ„ã„sFt”4u•…#6ÖÆ–E…&Åds”6##VÅ5sVµ¥†„å•„$å•„V3%c´tcD„§–åc¥7vv&Õc5ds•$uó‡U„sFt”4tÇ“†vE„&µ•…&Ä”s†T4&–##VÆ7”&¦#5gVDg‡T”4t”s†TT§f&Õg¤”CuEtc3WE•†vö%tcEÓ—U¥„×4”s—5¤e'eFÕc4ÆäçVÕWó‡T”4#•„sV6&”tÇ“†uDuc£4Öu•tãEtg6$†¶v3%c”…&õ¥4'¦%g5¥…'f&äæ6&”u¦Ó—””6†¦##W¦D4'E¥„æô”s–Ô”„ç&sWU¥u$å¥„æõ¥„×”‡F6&”t”4&¦##W¦D4&å¥s—E¥…'–U4””sÆ3&wU£%gf%uc6æ³u„sFt”4u“#—V35u•…#6ÖÆ–E…&Ä”Cu£%gf%uc6æ·U£%c…#6ÖÆ–E…&Ä´6G¦&ÇU5sVµ¥†väµGF6&”t”4&¦##W¦D4'U¥†EV#—5¤4””tcD„§–åc¥e'eÓ—U¥VÇU¤ucEEtguEtgtÆÖFÆD6††D…'–t£DuW•GF6&Ç‡T”4t”tçf&äã”t§f&Õg¤ö”%U4d¤e%3T6##VÅsu4&%…GF6&”t”4&¦##W¦D4&–##VÅ5sS%¥„§¥¥„Ód”e$•VµddÆ³†D„§TE&%…4””gFDó‡U„sFt”4tÇ“†vu–u”ucF4ug–sÆ&å&†$dæ†%ud6##VÅ#“&å'¥”4'7”&vD„£¥t4”tçf%„&Æ&äæ†DuVv3'FÆ$uc##W¤”†GDvvu¤…gF%†¶u–Ó—U¥„ÖvDs†v%fÆ44#uVu–Ó—U¥4&¦#5gVD4'¥•sÄ”t¦ÆD†FÅ¥sFv3'FÆ$uc##W¥„sFt”4u“#—V35v&´§f&Õg¤”Cu¥†‡u¥„§%ugVDtg5S$gE¥T§f&ÕdF#5gVD„Öu”'E•†„6##VÆ7”d”sVÆC'eC'†´ÆäçVÕSu„sV6&”t”4&Ö#4–t´w†ÆD4'U¥†D¦&Õ&ÆT4””Dt”sVÆCÇU¤ucD”Gvv&´§f&Õg¤÷”'U¥†D¦&Õ&ÆT77$µ4#u„sFt”4t”4&¦##W¦D4'f$u$¦&Õ&ÆT4””sVÆC'eC'†´ÆÖFÆD6‡U¥†D¦&Õ&ÆT6¶u£†tÔGF6&Ç‡T”4t”4u–Ó—U¥„×V4…g¦6‡E¥„æôÆäç%¥w†ÆDs—TÆÔ§f&Õg¥s#—5¤VÇU¤ucE…6³u„sFt”4t”4&–##VÅ5sS%¥„§¥¥„×V4…g¦6‡E¥„æôÆäç%¥w†ÆDs—TÆÔ§f&Õd¦&å¦Æ6äæÆ3Gf$u$¦&Õ&ÆTcó‡T”4t”ƒ6&Ç‡T”4t”tçf&äã”„ç%¥w†ÆDs—T”Cv&Õc4”e$•VµddÆÄç%¥w†ÆDs—T´t§f&Õg¤Ä4&–##VÅ5sS%¥„§¥¥„×ó‡T”4t”sÆ3&wU–ÖÇU¤6‡¦%g5¥…'f&—vv&Õc4”e$•VµddÆ³†D„§TEôµ6³u„sFt”4tÇ“†t”4t”4t”4t”4t”4t”4&U†ÃVU†ÃVU†ÃVU†ÃVU†ÃVU†ÃVT”…'••sW¥¦Ó—–%4'e¦”'E¥„æõ¥„Öv3&‡fEw†´”t¦Ä”vÆæ&Ó—•¥u&6&”t”4dÇ”%E¥uSd”vƒD„'¤ö“‡e£&Ã…f”ÆÔçf%3”Æ„§f&Ó—¥#4§fE„e£'…U&““6ÕfÄÃ#†35&Æ6“—¦4uf¦u§“$cs—TÇ¤—TÔ4ç¦&ÇV3‡T”4#•„sS•„sF”Ä4–sv#4£”6öu•„ÖudV…5%UVu¦ä§f%4æDv‡•¥uVäó‡Vsv#4£”‡6uåfÕ¦Õg•…#6ÖÆ–E…&Ä”ƒu¦ä§f%4æDv‡•¥uVäó‡U„sGd¶—6&””Tæõ¥tç&7”#6vÆ¦4#%¥„£tæÆ7”&†6ÕVvE„æÅ¤4&–U4#uVvsVµ¥†vu•…#6ÖÆ–E…&ÄÆÇ‡T”6öu„&†6ÔgD”tcD„§–åc¥„Öu#%gf%uc6æ¶u•…#6ÖÆ–E…&Æ3‡T”6öu„&†6ÔgD”s—–vG&Ôg55sVµ¥†vuC4§£&ÇU•wvvsVµ¥†vu•…#6ÖÆ–E…&Å„sFt¶”$6ÕcE„§V7”%u¥„£¥†vvE„æ…£%Vv%tgt”tgU¤4&¦#5gVD„æ6&”Ã‡U¦ågU“5'##Fu“&†Å“'D¦3¦Æ6å&ÆTeg¥¥uõ„sFt”tcD„§–åc¥„Ód”e$•VµddÆ´£¦Õ¦Æ6¶FÆ##ÆD„£Uw–F†D…'–t£Dug¤£5„sFt”s—–vG&Ôg55sVµ¥†sd”e$•VµddÆ´£¦Õ¦Æ6´cD„§–åc¥7†6&–³d”‡F6&”v„åu¥„£¥†…f3%f´ö”&–##—5¥tgUsu„sFt”…¦Æ6å&ÆTTçfEsSö”'VEs•¥„“u„sFt”…¦Æ6å'“%g¥e„æÅ¤Föv&ågE–Õg”ó‡Ve4#u„sFt”3‡d”u&ÆDug–%vÇU¥4#6vÆ¦4#%¥„£tæÆ7”&†6ÕVvE„æÅ¤4'&”#uVu£%gf%uc6æÆ6&”u“#—V35vFÕg–DucE#“&åu4&†D…'–t£Dug¤Æä'f3&Ãs—TÆÔçfEsSó‡T”4&¦##W¦D4'3¦Æ6å&ÆTeg¥¥uu4'U¥†6u„§••†¶öFÕg–DucE#“&å”tg¤”t§f#'†Å•sV%…GF6&”v$uc”…¦Æ6å'“%g¥e„æÅ¤4””Du„sV6&”u“#—V35v#4§£&ÇU•w„¦&Õ&ÆTTg–6ÔcT”Cv#4§£&ÇU•w„¦&Õ&ÆT3V†6ä¦†UGF6&”u¦Ó—””6‡5¥…v4””Dt”v¶u4'f6ÖÆæsV†$VÇU¤ucE„§••†·V$ugU£5&ô÷”'·—7”‡F6&”t”4&¦##W¦D4'&Õ&ÆT4””s—–vG&Ôg55sVµ¥†„&6ä¦†UgG…GF6&”t”4'¦”ô•vÇ¥fÕg–DucEe„æÅ¤gG&Õ&ÆTc”‡F6&”t”4t”vÇ¥fÕg–DucEe„æÅ¤gG&Õ&ÆTcu4#6åfÄó‡T”4t”4vFÕg–DvÆ¥¥„åf3%f´·—3u„sFt”4veg‡T”4#•„sV6&”v6ÕcE„§T”‡6v„åu¥„£¥†…f3%f´Ä4#%¥„£¥†„F#5gVD7vvFÕg–DvÆ¥¥„åf3%f´”ƒu„sS•„sV6&“‡¶Ç‡T”6öuåg$u'¤”vÇU¤ucD”s†4„Öu¦ä§f%4#uVvFÕg–DucD”…g¥•vFÄ”s†43V6&””T'u•„¦†%4'3¦Æ6å&ÆTeg¥¥uufÕg–DucD”…g¥•vFÄ”s†4g‡T”6öu„¦ÆD…g–&äÖu5sVµ¥†vv%tgv3‡T”6÷e„sVÖEsV¦DvÇf&”&–EvÇ5¤VÇU¤ucEEtgv3§–##¦3¦Æ6å&ÆTeg¥¥uö„åu¥„£¥†…f3%f´ö”&–##—5¥tgUsö”#u„sFt”s—–vG&Ôg55sVµ¥†„õ¥†D¦&Õ&ÆTS†4Föv&ågE–Õg•su„sFt”sVÆCÇU¤ucEC4§£&ÇU•w„¦&Õ&ÆTS†4Föv&ågE–Õg•su„sS””‡F6&”tÇ–÷”u§–##v#4§£&ÇU•wvvsVµ¥†vvDs†v&Õc4”vÇU¤ucD”6÷e„sFt”tçf&äã”s—–vG&Ôg55sVµ¥†„õ¥†D¦&Õ&ÆTS†4Föv&ågE–Õg•su4&%…GF6&Ç‡T”4d¶–öu¦ä§f%4'U¥†6vsVµ¥†vvDs†v#4§£&ÇU•wvvsVµ¥†vt¶“–6&”u“#—V35v&Õc55sVµ¥†…6ÖÆæsV†$VÇU¤ucEEtgtö”'VEs•¥„¦%…4””gFDó‡U„sFt”3‡d”tg¦3&Ææ&”'U¥†6vsV¶tæÆ3‡T”4'5¥…vsVµ¥†„•¥tf´”CtÔGF6&”u¦Ó—””6‡5¥…v4””Dt”v¶u4'3¦Æ6å&ÆTeg¥¥uV$ugU£5&ô÷”'·—7”‡F6&”t”4'¦”ö„åu¥„£¥†…f3%fµs&ÆDµ4#u„sFt”4t”4&¦##W¦D4'U¥†D¦&Õ&ÆT4””vÇU¤ucE4uf…¤77$ó‡T”4t”4v#4§£&ÇU•w„¦&Õ&ÆTSVÆCÇU¤ucEEtgus&ÆD”Cv&Õc55sVµ¥†su„sFt”4t”4'U¥†D¦&Õ&ÆTS—–vG&Ôg55sVµ¥†„å•„&&&Õc55sVµ¥††D”CvGF6&”t”4#•„sFt”ƒ6&Ç‡T”4'•¥…#6ÓFvW”'f6ÖÆæsV†$VÇU¤ucEFÕc55sVµ¥†„å•„4”sVÆCÇU¤ucEC4§£&ÇU•w„¦&Õ&ÆTS†44#”ó‡Veg‡U„sGd¶—6&””Tçf4vÆÆ7”&å¥s—E¥…'–U4'v6Ó—u¥„£ug¤”…&õ•…u•„¦Ä”sWfD4'u•„£”s–Ô”tcD„§–åc¥„Öv#4–vsV¶tæÆ7“V6&””T'u•„¦†%4'¦#5g•“%VuS#“6ÔæÄ”vFÆ##ÆD„£U„sFt¶”$4tg••svDtg•£%c”e&†6ÖFÆD4&å¥s—E¥…'–Ug‡T”6÷e„sVÖEsV¦DvÇf&”&¦#4#U#%gf%uc6æÅ6Ó—u¥„£ug¤´„çfE„¦¥¥FöudV…5%UWUåfÕ¦Õg•#%gf%uc6æ·4”…&†6ÖFÆDFöudV…5%UWUåfÕ¦Õg•#%gf%uc6æ·ö”#&#&Æ´”‡F6&”tÇ“†uVÕfÔö”&öD…'v7¦÷dÃ&GDvƒ–“V¦##f%„¦¶##–”Ã5&ö6ÕfÄÆ×¤Ã$§6#$—dÕtW”äDfÅ¦¤WtÔEDç¦7u¤ES%¥D%¤E¦¥¤E¦„æ¥&¤ç¥¦¥—¦7”Ôu“Tå3—¦6Ô×e“#—•¥3”6Eu¦Õ¥„¤…¥s—E¥…'–U3W7”äÔÕD„Õg‡T”4#•„¦å¥…V&ÔgE¥4””„çfE„¦¥¥3WU•sÄó‡U„sFt”…&†6ÖFÆD3WF#4§ve&†6ÖFÆD„å5¥w††DvÃ%¥4””„çfE„¦¥¥3WF#4§ve&†6ÖFÆD„å5¥w††DvÃ%¥GF6&Ç‡T”4'¦#5g•“%WU£4§fE„'¤ÆÕ§f6µf…“&vô´vG–#5gtµ4•”#u„sFt”4vDtg•£%cÆÔfµ¤VG–#5gt´vG–#5gtÆäã•„£Ä4&æ6Ó“43V¦#5gVD7vu£4§fE„V%tc¥„§•w„¦&Õ&ÆT6³u„sFt”ƒó‡U„sFt”…&†6ÖFÆD3V–#5gU¤vÇU£§fT4””„çfE„¦¥¥3V–#5gU¤vÇU£§fTC‡U“'‡f&ÕVôµ4õ”'VEw‡4ó‡T”4#•„¦å¥…U–Ó“&Õ'&ÖEF4v†Æ6ÕVu4'¦#5g•“%WU–Ó“&Õ'&ÖEF4v†Æ6ÕRôÆÔç6##VÄ´6¶u£†v&åg6$GF6&Ç‡T”4#•„¦å¥…V3%c$„¦†C¦†&ÖFÄ´„çfE„¦¥¥3V¶6Ôc5VÔgU£%WV35&†6å4”„çfE„¦¥¥3V¶6Ôc5VÔgU£%WU“#“&åó‡U„sFt”…&†6ÖFÆD3S3%g•$tc•4””„çfE„¦¥¥3S3%g•$tc•GF6&ã6&Ç‡TÇ–÷„sFt¶”%5¥t£w†¶7”'&Õ&ÆT4&†D…'–t£DuVu–Ôg¥¥uv##FvDv†Ä”s—–vG&Ôg4Å…'dÅsVÆG”'&Õ&ÆT4'E•„U„sFt¶”$4tg••sv&Õc5#%gf%uc6æ¶uFÕc4”vFÆ##ÆD„£U„sFt¶”$4tg••sv#4§£&ÇU•w„¦&Õ&ÆT4%6ÖÆæsV†$4'&Õ&ÆT4&†D…'–t£Duf6&””T'u•„¦†%4'f6ÖÆæsV†$VÇU¤ucEFÕc55sVµ¥†„å•„uEtgt”u§–##v#4§£&ÇU•wvvsVµ¥†vvDs†v&Õc4”vÇU¤ucE„sFt¶“–6&Õ£&Ôãs—T”„¦Æ#4¦å•sWVÕd¦&Õ&ÆTTcD„§–åc¥6†6&”v&Õc5#%gf%uc6æ³d”e$•VµddÆ´£¦Õ¦Æ6¶FÆ##ÆD„£TÄg‡T”4'f6ÖÆæsV†$VÇU¤ucDö”%U4d¤e%3T6Eu¦Õ¥„¤&D…'–t£DuW5„sFt”s—–vG&Ôg55sVµ¥†„õ¥†D¦&Õ&ÆTS†4Föv&ågE–Õg•s5„sGö”#&#&Æ´”‡F6&”u“#—V35v#4§£&ÇU•w„¦&Õ&ÆTTg–6ÔcT”Cv#4§£&ÇU•w„¦&Õ&ÆT3V†6ä¦†UGF6&”u“#—V35v&Õc55sVµ¥†„&6ä¦†U4””sVÆG”ö#4§£&ÇU•w„¦&Õ&ÆTTg–6ÔcTÆÔçf&äã6åf¦Ds—””tg¤”tgVU6¶ö#4§£&ÇU•w„¦&Õ&ÆTTg–6ÔcTÆ×†Æ&ÖC6³u„sV6&”u¦Ó—””6‡5¥…v4””Dt”v¶u4'f6ÖÆæsV†$VÇU¤ucE„§••†·V$ugU£5&ô÷”'·—7”‡F6&”t”4&¦##W¦D4'&Õ&ÆT4””s—–vG&Ôg55sVµ¥†„&6ä¦†UgG…GF6&”t”4'U¥†D¦&Õ&ÆTTg–6ÔcUs&ÆD”Cv#4§£&ÇU•w„¦&Õ&ÆTSVÆCÇU¤ucEEtgus&ÇU¤ucE…GF6&”veg‡U„sFt”sVÆCFÆ##ÆD„£TÆäæÆDVÇU¤ucD´sVÆG”$6Eu¦Õ¥„¤&D…'–t£DuVö&Õc55sVµ¥†„&6ä¦†U7vv#4§£&ÇU•w„¦&Õ&ÆT3WDugES&Ãe¥7vv#4§£&ÇU•w„¦&Õ&ÆT3WV#4§E•w‡VÕf´µ6³u„sS•„sV6&“‡¶Ç‡T”6öu#—vug¤”…#V4uf´”tg–6ÔcT”u&†DtVu–æ¶v6ÕgE•„'vsVä”vÇU¤vÆ¥¥„×U„sFt¶”$4tg••sv#4§£&ÇU•w„&6ä¦†U4%F#5g•“%Vu•„§••†Æ6&””T'u•„¦†%4'U¥†D¦&Õ&ÆTS—–vG&Ôg55sVµ¥†„å•„uEtgt”u§–##v&Õc4”vÇU¤ucD”…'d”s—–vG&Ôg4”vÇU¤ucE„sFt¶”$4tg••sv35'–u&Ä”SS%t¦Æ6”'e¦”&¦##v##VÆ&å'¤”„&Æ6”#%¥„£¥†vvsFvDv†Ä”tg–6ÔcU„sFt¶”$6ÕcE„§V7”$õ¥†6u•„§••†¶vC&Ã4'•¥s†4„&Å¤4&µ•…&…„sFt¶“–6&Õ£&Ôãs—T”„¦Æ%tgu…#6ÖÆ–E…&Å„§••†¶õ„sFt”s—–vG&Ôg5„§••†³d”e$•VµddÆÅ#V4ufµ„§••†·5„sFt”sVÆCÇU¤ucEC4§£&ÇU•w„¦&Õ&ÆTS†4Föv&ågE–Õg•s5„sFt”„ã6ÖÆµ¥Föv&ågE–Õg”Äg‡TµFöus$•VµddÆÅ#V4ufµ„§••†·4”vÇ¥w‡5vÕg–'¦öu–Ó—f$uf†&ÃvS‡T”4dÇ”&Æ3'‡&åE¤vÇ¥•t§5¥3U¥†ƒÅw‡&ÕVu…#V4ug¥“4§4…E¥„ç6sSÃ#V†%vÇU§“¦##S%¥sSs—U„sFt”tçf&äã”Tg–6ÔcU5'f6”””s—–vG&Ôg5„§••†·U“#—V35'–Etã#4–u•„ÖudV…5%UWUd†Çu¥u$&6ä¦†UTçf&äã6åf¦Ds—”ó‡T”4&¦##W¦D4'U¥†D&6ä¦†U4””sVÆG”$&6ä¦†UTã#4–ö&Õc55sVµ¥†…6ÖÆæsV†$VÇU¤ucEEtgtÆ×†Æ&ÖC4”„ã6ÖÆµ¥6³u„sV6&”v$uc”vÇ¥w‡5vÕg–'”””…'–EuSu„sV6&”u¦Ó—””6‡5¥…v4””Dt”v¶u4'U¥†D¦&Õ&ÆTS—–vG&Ôg55sVµ¥†„å•„V$ugU£5&ô÷”'·—7”‡F6&”t”4&¦##W¦D4'f6ÖÆæsV†$VÇU¤ucD”Cv&Õc55sVµ¥†…6ÖÆæsV†$VÇU¤ucEEtgus&ÆDó‡T”4t”tçf&äã”„ç•“¦†3%Vu4'f6ÖÆæsV†$VÇU¤ucD”6öv35'–u&Äó‡T”4t”tçf&äã”u'¦DT¦†3%Vu4'”6öv35'–u&Äó‡T”4t”u§f6”ö$uc”vöu4t÷”'”Gvv35'–u&Ä÷”'·—7”‡F6&”t”4t”tçf&äã”…–u4'f6ÖÆæsV†$Tg–6ÔcUs4ç•“¦†3%Vt·”'…GF6&”t”4t”sVÆCg–6ÔcUs%'¦DT¦†3%Vt·”'…4””…“u„sFt”4t”4'3g6$gÆ6Ó†u4'3g6$gÆ6Ó†t¦•–vF”•CtÔGF6&”t”4#•„sFt”ƒ6&Ç‡T”4'•¥…#6ÓFus#VÆCg–6ÔcTÄ4'3g6$gÆ6Ó–Dó‡Veg‡U„sSU„&Ä”VFÆ##ÆD„£U5sS¥„§5¥tc%¥u$f&å'–U4””gGU•sÄö”'¦D„§&Ö74”tcD„§–åc¥FöudV…5%UWU5sS¥„§5¥tc%¥u$6Eu¦Õ¥„¤&D…'–t£DufDó‡VD†Çu¥4$…¥s—E¥…'–USWf&¶ÇVDug–$uf†FÕfµ%sS6æ¶u4&&&ÔgE¥Föv35'–sVäÄ4&†D…'–t£DuSd”e$•VµddÆ´£¦Õ¦Æ6´cD„§–åc¥cu„sV6&“‡¶Ç‡T”6öu#—6$uf¦D„Öu£%gf%uc6æ¶u•…#6ÖÆ–E…&Æ7“V6&””U§f6”'&å&Æ6×†Å•…¦Å¤4&†D…'–t£Dug¤Ä4&æ6Ó“44#ugD”vÆÔ”…&õ¥†¶v3&††6ÕVvDv†Ä”„æ†%uVu5sS¥„§5¥tc%¥u$6Eu¦Õ¥„—U„sFt¶”$v#4–v&Ó—TÅvÇVDug–$uf†FÕf´”tcD„§–åc¥„×4”w35u“#—6$uf¦D4#ugD”tg¤”vÇ¤ÆÇ‡T”6öu„&†6ÔgD”tcD„§–åc¥„ÖuC4§£&ÇU•wvu£%gf%uc6æ¶u•…#6ÖÆ–E…&Æ3‡T”6öu„¦ÆD…g–&äÖu#—6$uf¦Duf´”vFÆ##ÆD„£T”tcD„§–åc¥4&æ6Ó“4„æ6&”Ã‡U¦ågU“5'##Fu“#—6$uf¦DVFÆ##ÆD„£U…#6ÖÆ–E…&Å#4§fE„'¤´g‡T”4&†D…'–t£Dug¤ö”%U4d¤e%3T6Eu¦Õ¥„¤…¥s—E¥…'–Ug6å•…#6ÖÆ–E…&Æ7–FDÄg‡TµFöus‡T”4'&å&Æ6×†Å•…¦Å¤T£¦Õ¦Æ6´cD„§–åc¥S†4FöuEtgue$•VµddÆ¶ÇVDug–$uf†FÕfµåfÕ¦Õg”Ä4$…¥s—E¥…'–UVÇVDug–$uf†FÕfµ%sS6æÆ%…CG5„sFt”sWf&¶ÇVDug–$uf†FÕfµ…#6ÖÆ–E…&Æ7¦öu#%gf%uc6æÄö##T¦&å&Æ6×†Å•…¦Å¤UgVD„£Us5„sVD”‡F6&”u“#—V35vsS¥„§5¥tc%¥u$6Eu¦Õ¥„¤&D…'–t£Dudå•„u4'U¥†6uEtgue$•VµddÆ¶ÇVDug–$uf†FÕfµåfÕ¦Õg”Ä4$…¥s—E¥…'–UVÇVDug–$uf†FÕfµ%sS6æÆ%…CFôµGF6&”u“#—V35v&Ó—U5sS¥„§5¥tc%¥u$&D…'–t£Dug¤ö”$…¥s—E¥…'–USWf&¶ÇVDug–$uf†FÕfµ%sS6æÆ%…4””gFDó‡U„sFt”u§f6”õ“#—V35us$cD„§–åc¥SV†%uW4”s—–vG&Ôg5…#6ÖÆ–E…&Å…4'e¦”%–×Å“5U¥sS6ÖÆÆ7–††D…'–t£Dug¤µ6¶vS‡T”4t”vÆÔ”6vö#4§£&ÇU•w„&D…'–t£DuVu•„Öu•sSTµ3W3ÇVDug–$uf†FÕfµåfÕ¦Õg•…#6ÖÆ–E…&Äµ4#u„sFt”4t”4&¦##W¦D4'&å&Æ6×†Å•…¦Å¤TcD„§–åc¥4””s—–vG&Ôg5…#6ÖÆ–E…&Ä”tg¤”e$•VµddÆ¶ÇVDug–$uf†FÕfµåfÕ¦Õg•…#6ÖÆ–E…&Äó‡T”4t”4u“#—V35vsS¥„§5¥tc%¥u$6Eu¦Õ¥„–u4'&å&Æ6×†Å•…¦Å¤TcD„§–åc¥3Vµ•…&„ó‡T”4t”4u“#—V35u£4§fE„u4'&å&Æ6×†Å•…¦Å¤T£¦Õ¦Æ6´cD„§–åc¥S†43Vå¥…ösS¥„§5¥tc%¥u$6Eu¦Õ¥„—”C‚ô”gFDó‡T”4t”4vsS¥„§5¥tc%¥u$6Eu¦Õ¥„¤&D…'–t£Dudå•„V3%c´vÇVDug–$uf†FÕfµåfÕ¦Õg”Ä4&æ6Ó“46³u„sFt”4t”4&æ6Ó“43WvE„æô´gF†D…'–t£Dudõ•sÄÄ4'&å&Æ6×†Å•…¦Å¤TcD„§–åc¥có‡T”4t”ƒu¥w‡¥¥4#u„sFt”4t”4&¦##W¦D4&†D…'–t£DuVu4'f6ÖÆæsV†$TcD„§–åc¥4&†7”%U4d¤e%3T6Eu¦Õ¥„¤&D…'–t£DuSu„sFt”4t”4'V##T¦&å&Æ6×†Å•…¦Å¤TcD„§–åc¥„×V4…g¦6†%•…#6ÖÆ–E…&ÅFÔgE¥7vu•…#6ÖÆ–E…&Å…6³u„sFt”4veg‡T”4#•„sV6&”v6ÕcE„§T”gG&å&Æ6×†Å•…¦Å¤T£¦Õ¦Æ6´cD„§–åc¥S†47vv&Ó—U5sS¥„§5¥tc%¥u$&D…'–t£Dug¥…GF6&ã6&Ç‡TÇ–÷„sFt¶”%5¥t£w†¶7”&†$wvu£%gf%uc6æ¶u•…#6ÖÆ–E…&Æ7”&••„æÅ¤4'f&”#uVv&Õc4Å…'dÅs—–vG&Ôg4”vÇU¤ucD”s†43V6&””T'u•„¦†%4'U¥†D…¥s—E¥…'–U4$õ¥†6u£%gf%uc6æÆ6&””T'u•„¦†%4&†D…'–t£Dug¤”S—–vG&Ôg4”vFÆ##ÆD„£T”tcD„§–åc¥„æ6&””T'u•„¦†%4'U¥†D¦&Õ&ÆTS—–vG&Ôg55sVµ¥†„å•„uEtgt”u§–##v&Õc4”vÇU¤ucD”…'d”s—–vG&Ôg4”vÇU¤ucE„sFt¶“–6&Õ£&Ôãs—T”„¦Æ#4¦å•sWVÕd…¥s—E¥…'–UTcD„§–åc¥„Öõ„sFt”sVÆCFÆ##ÆD„£Tö”%U4d¤e%3T6Eu¦Õ¥„¤…¥s—E¥…'–U7†6&”u•…#6ÖÆ–E…&Æ7¦öudV…5%UWUåfÕ¦Õg•#%gf%uc6æÆ$£$cD„§–åc¥„Öå…7†6&”v&Õc55sVµ¥†…6ÖÆæsV†$VÇU¤ucEEtgtö”'VEs•¥„¦%…7†6&–³d”…§fuvS‡T”4dÇ”&¦#'‡5¥tã”vÇVDug–$uf†FÕf´”tgU¤4'V##GFsS¥„§5¥tc%¥uu•…#6ÖÆ–E…&Æ3‡T”4&¦##W¦D4&&sS¥„§5¥tc%¥u$6Eu¦Õ¥„¤&D…'–t£Dudå•„4”sWf&¶ÇVDug–$uf†FÕfµ…#6ÖÆ–E…&Æ3u4&¦#'‡5¥tã#%gf%uc6æÄ&D…'–t£Dud†6Ó“4„Öõ•…#6ÖÆ–E…&Æ7–³u„sV6&”tÇ“†v4„§e“%g¦7”'&å&Æ6×†Å•…¦Å¤4&†D…'–t£Dug¥„sFt”u§f6”õ“#—V35us&ÇVDug–$uf†FÕfµåfÕ¦Õg”Ä4&†D…'–t£Dug¥5sT†6Ó“4cv#%–vsS¥„§5¥tc%¥u$6Eu¦Õ¥„¤&D…'–t£Dudå•„”‡F6&”t”4dÇ”'•¥t£w†´”vÇVDug–$uf†FÕf´”t£¦Õ¦Æ6”&†6ä¦†Ug‡T”4t”tçf&äã”s—–vG&Ôg55sS¥„§5¥tc%¥u$6Eu¦Õ¥„¤&6ä¦†U4””vÇVDug–$uf†FÕfµåfÕ¦Õg”ÆÔg–6ÔcTó‡T”4t”tçf&äã”‡6v35'–u&Ä”ƒu4'&å&Æ6×†Å•…¦Å¤T£¦Õ¦Æ6§F6&”t”4&¦##W¦D4&&&Õc55sS¥„§5¥tc%¥u$&6ä¦†U7vuƒu4'•¥s†4TcD„§–åc¥Tg–6ÔcT´g‡T”4t”4v#4§£&ÇU•w„¦&å&Æ6×†Å•…¦Å¤T£¦Õ¦Æ6´g–6ÔcTÄg‡T”4t”4v&Õc55sVµ¥†…6ÖÆæsV†$VÇU¤ucEEtgtÄg‡T”4t”4v35'–u&ÄÄg‡T”4t”6³u„sV6&”t”4dÇ”'•¥t£w†´”vÇVDug–$uf†FÕf´”t£¦Õ¦Æ6Ç‡T”4t”tçf&äã”sVÆCÇVDug–$uf†FÕfµåfÕ¦Õg””Cv&Õc4”e$•VµddÆ¶ÇVDug–$uf†FÕfµåfÕ¦Õg”´sVÆCÇVDug–$uf†FÕfµ„§••†·4”„ã6ÖÆµ¥6³u„sFt”4v&Õc55sS¥„§5¥tc%¥u$6Eu¦Õ¥„—V3%ce„æ…£%VösS¥„§5¥tc%¥u$6Eu¦Õ¥„—VE„æ…£%Wó‡U„sFt”4tÇ“†v6Õf–EvÇ5¤4'&å&Æ6×†Å•…¦Å¤4&–Eu¦Õ¥„–u•…#6ÖÆ–E…&Æ3‡T”4t”u§f6”õ“#—V35us$cD„§–åc¥SV†%uW4”s—–vG&Ôg5…#6ÖÆ–E…&Å…4'e¦”&†D…'–t£Dug¥5sT†6Ó“46¶vS‡T”4t”4u“#—V35vW”'DugES&Ãe¥7vv#%¦Ö3%cÄ4'V#4§E•w‡VÕf´”ƒu4'f6ÖÆæsV†$TcD„§–åc¥GF6&”t”4t”tçf&äã”sVÆCcD„§–åc¥4””sVÆG”%U4d¤e%3T¦&å&Æ6×†Å•…¦Å¤T£¦Õ¦Æ6´cD„§–åc¥6‡U¥†D¦&å&Æ6×†Å•…¦Å¤T£¦Õ¦Æ6—vv…&Æ%dçVÕW4”s–Õ¦äæÆD7vv&Ó—–%tg6‡Å¤6³u„sFt”4t”4'U¥†D…¥s—E¥…'–U3W¥¥…$&D…'–t£DuVõ•…#6ÖÆ–E…&ÅFÔgE¥7vv&Õc5…#6ÖÆ–E…&ÄµGF6&”t”4#•„sFt”ƒ6&Ç‡T”4dÇ”'v6Ó–¥¥„ç¤”sWf&“&å&Æ6×†Å•…¦Å¤4&†D…'–t£Dug¥„sFt”u§f6”õ“#—V35us$cD„§–åc¥SV†%uW4”s—–vG&Ôg5…#6ÖÆ–E…&Å…4'e¦”'V##T¦&å&Æ6×†Å•…¦Å¤TcD„§–åc¥„×”‡F6&”t”4dÇ”'•¥t£w†´”tcD„§–åc¥4&†6ä¦†Ug‡T”4t”tçf&äã”s—–vG&Ôg5…#6ÖÆ–E…&Å„§••†¶u4'f6ÖÆæsV†$TcD„§–åc¥3V†6ä¦†UGF6&”t”4&¦##W¦D4#t”vÃ¥sF‡ÄÄ4'V#4§E•w‡VÕf´”ƒu4'f6ÖÆæsV†$TcD„§–åc¥GF6&”t”4&¦##W¦D4&&&Õc5…#6ÖÆ–E…&Å„§••†·4”c–D”Cv6ÕgE•„$&D…'–t£Dud&6ä¦†U6‡f6ÖÆæsV†$TcD„§–åc¥Tg–6ÔcTÄ4'U¥†D¦&Õ&ÆTS—–vG&Ôg55sVµ¥†„å•„4”vÃ¥sF‡ÄµGF6&Ç‡T”4t”3‡d”„¦Å–åg$uu–åfÕ¦Õg””tcD„§–åc¥g‡T”4t”sVÆCFÆ##ÆD„£TÆäæÆDTcD„§–åc¥6††D…'–t£Dudõ•sÄÄ4'U¥†6uåfÕ¦Õg•…#6ÖÆ–E…&Ä´sVÆCcD„§–åc¥Tg–6ÔcTÄ4'DugES&Ãe¥7vv&Ó—–%tg6‡Å¤6·ó‡T”4#•„sS•„sV6&å#V4uVuEs—–4v„&D…'–t£Dudõ•sÄ”Cv%cV#%–udV…5%UWUåfÕ¦Õg•#%gf%uc6æÆ$£#f6ä&õ…#6ÖÆ–E…&Æ7–FDó‡VD†Çu¥4$æ#4§vVÇVDug–$uf†FÕfµ%sS6æ¶u4&%„sFt”sV†%uSd”Sf6ä&õ…#6ÖÆ–E…&ÅFÔgE¥7†6&”v%s—–4v„¦&Õ&ÆTFöv&ågE–Õg”Äg‡T”4&†D…'–t£DuSd”e$•VµddÆ¶ÇVDug–$uf†FÕfµåfÕ¦Õg•…#6ÖÆ–E…&ÄÄg‡U…GF6&å#V4uVuEs—–4v„ö##T¦&å&Æ6×†Å•…¦Å¤UgVD„£T”Cus#V†%uSd”Sf6ä&õ…#6ÖÆ–E…&ÅFÔgE¥7vv%s—–4v„¦&Õ&ÆTFöv&ågE–Õg”Ä4&†D…'–t£DuSd”e$•VµddÆ´£¦Õ¦Æ6´cD„§–åc¥cu„sV6&“‡¶Ç‡T”6öu#—6$uf¦D„Öv%s—–4vvu•…#6ÖÆ–E…&Æ7“V6&””U§f6”'&å&Æ6×†Å•…¦Å¤4&†D…'–t£Dug¤Ä4&æ6Ó“44#ugD”vÆÔ”…&õ¥†¶v3&††6ÕVvDv†Ä”„æ†%uVu5sS¥„§5¥tc%¥u$6Eu¦Õ¥„—U„sFt¶”$v#4–v&Ó—TÅvÇVDug–$uf†FÕf´”tcD„§–åc¥„×4”w35u“#—6$uf¦D4#ugD”tg¤”vÇ¤ÆÇ‡T”6öu„&†6ÔgD”sf6ä&õ…#6ÖÆ–E…&Æ7”%6ÖÆæsV†$4'F#4§v4&†D…'–t£Dug¥„sFt¶”$6ÕcE„§V7”$F#'‡5¥tã¥uv%s—–4vvu•…#6ÖÆ–E…&Ä”vG–#5gv3‡T”6÷e„sVÖEsV¦DvÇf&”&¦#'‡5¥tãEs—–4v„&D…'–t£Dud†6Ó“4„Öõ„sFt”sf6ä&õ…#6ÖÆ–E…&Æ7¦öudV…5%UWUåfÕ¦Õg•#%gf%uc6æÆ$£#f6ä&õ…#6ÖÆ–E…&Æ7–FDÄg‡TµFöus‡T”4'&å&Æ6×†Å•…¦Å¤T£¦Õ¦Æ6´cD„§–åc¥S†4FöuEtgue$•VµddÆ¶ÇVDug–$uf†FÕfµåfÕ¦Õg”Ä4$æ#4§vVÇVDug–$uf†FÕfµ%sS6æÆ%…CG5„sFt”sWf&¶ÇVDug–$uf†FÕfµ…#6ÖÆ–E…&Æ7¦öuEs—–4v„ö##T¦&å&Æ6×†Å•…¦Å¤UgVD„£Us5„sVD”‡F6&”u“#—V35vsS¥„§5¥tc%¥u$6Eu¦Õ¥„¤&D…'–t£Dudå•„u4'U¥†6uEtgue$•VµddÆ¶ÇVDug–$uf†FÕfµåfÕ¦Õg”Ä4$æ#4§vVÇVDug–$uf†FÕfµ%sS6æÆ%…CFôµGF6&”u“#—V35v&Ó—U5sS¥„§5¥tc%¥u$&D…'–t£Dug¤ö”$æ#4§vSWf&¶ÇVDug–$uf†FÕfµ%sS6æÆ%…4””gFDó‡U„sFt”u§f6”õ“#—V35us'FÆU7vu•…#6ÖÆ–E…&Æ3v#%–uC$§¥tãÆÕgVD„§¥„Öö%s—–4v„&D…'–t£Dug¤µ6¶vS‡T”4t”tçf&äã”tcD„§–åc¥SV†%uVu4'%¥†¶u•„ÖuEs—–4v„&D…'–t£Dudõ•sÄó‡T”4t”u§f6”ö$uc”vÄæ#4§v4””Dt”vÄæ#4§v4„”tcD„§–åc¥„×V$ugU£5&ô÷”'Es—–4vw$·–¶vS‡T”4t”4u“#—V35v#4§£&ÇU•w„&D…'–t£DuVu4&†D…'–t£Dug¥s&Äæ#4§vcu•„ÖudV…5%UWUåfÕ¦Õg•…#6ÖÆ–E…&Ä”‡vudV…5%UWU5sS¥„§5¥tc%¥u$6Eu¦Õ¥„¤&D…'–t£DuSu„sV6&”t”4t”vÆÔ”6vö#4§£&ÇU•w„&D…'–t£DuVu•„Öu•sSTµ3W3ÇVDug–$uf†FÕfµåfÕ¦Õg•…#6ÖÆ–E…&Äµ4#u„sFt”4t”4t”tçf&äã”vÇVDug–$uf†FÕfµ…#6ÖÆ–E…&Ä”Cv#4§£&ÇU•w„&D…'–t£DuVu•„ÖudV…5%UWU5sS¥„§5¥tc%¥u$6Eu¦Õ¥„¤&D…'–t£DuSu„sFt”4t”4t”tçf&äã”vÇVDug–$uf†FÕfµåfÕ¦Õg””CvsS¥„§5¥tc%¥u$&D…'–t£DuWU¤tc•GF6&”t”4t”4u“#—V35u£4§fE„u4'&å&Æ6×†Å•…¦Å¤T£¦Õ¦Æ6´cD„§–åc¥S†43Vå¥…ösS¥„§5¥tc%¥u$6Eu¦Õ¥„—”C‚ô”gFDó‡T”4t”4t”4'&å&Æ6×†Å•…¦Å¤T£¦Õ¦Æ6´cD„§–åc¥S†43W¥¥…ösS¥„§5¥tc%¥u$6Eu¦Õ¥„—4”vG–#5gtµGF6&”t”4t”4u£4§fE„V4…g¦6†%•…#6ÖÆ–E…&ÅFÔgE¥7vvSf6ä&ôÄ4'&å&Æ6×†Å•…¦Å¤TcD„§–åc¥có‡T”4t”4ve4&Æ$„æÄ”‡F6&”t”4t”4u“#—V35u•…#6ÖÆ–E…&Ä”Cv#4§£&ÇU•w„&D…'–t£DuVu•„ÖudV…5%UWUåfÕ¦Õg•…#6ÖÆ–E…&Äó‡T”4t”4t”4'V##T¦&å&Æ6×†Å•…¦Å¤TcD„§–åc¥„×V4…g¦6†%•…#6ÖÆ–E…&ÅFÔgE¥7vvSf6ä&ôÄ4&†D…'–t£DufDµGF6&”t”4t”ƒ6&”t”4#•„sFt”ƒ6&Ç‡T”4'•¥…#6ÓFus&ÇVDug–$uf†FÕfµåfÕ¦Õg•…#6ÖÆ–E…&ÅEtgtÄ4'V##T¦&å&Æ6×†Å•…¦Å¤TcD„§–åc¥„æDó‡Veg‡U„sGd¶—6&””d¦Å–åg$u'¤”sf6ä&ô”tcD„§–åc¥„Öu–Ôg¥¥uv##FvDv†Ä”sVÆG“'“f6ÖÆæsV†$4'&Õ&ÆT4'E•„U„sFt¶”$¥¦”&†$wvv%s—–4vvu•…#6ÖÆ–E…&Ä”…¦†$…fÆ7”&†6ÕVvVÕg–'—vu•w‡4”sf6ä&ô”tcD„§–åc¥„ÖvC&Ç6$4&•¥4&¶„æ¥•„¦µ¥uU„sFt¶”$4tg••sv&Õc5#%gf%uc6æ¶uFÕc4”vFÆ##ÆD„£U„sFt¶”$4tg••sv%s—–4v„&D…'–t£Dug¤”S—–vG&Ôg4”sf6ä&ô”tcD„§–åc¥„æ6&””T'u•„¦†%4'U¥†D¦&Õ&ÆTS—–vG&Ôg55sVµ¥†„å•„uEtgt”u§–##v&Õc4”vÇU¤ucD”…'d”s—–vG&Ôg4”vÇU¤ucE„sFt¶“–6&Õ£&Ôãs—T”„¦Æ#4¦å•sWVÕdæ#4§vTcD„§–åc¥„Öõ„sFt”sVÆCFÆ##ÆD„£Tö”%U4d¤e%3T6Eu¦Õ¥„¤…¥s—E¥…'–U7†6&”v%s—–4v„&D…'–t£Dug¤ö”%U4d¤e%3T6Eu¦Õ¥„¤…¥s—E¥…'–Ug6æ%s—–4v„&D…'–t£Dug¤£5„sFt”sVÆCÇU¤ucEC4§£&ÇU•w„¦&Õ&ÆTS†4Föv&ågE–Õg•s5„sGö”#&#&Æ´”‡F6&”tÇ–÷”e'–EuVvu–u•w‡4”sf6ä&ô”tcD„§–åc¥4#%•wƒ¥„Öu•„¦Ä”‡Æ6Ó†t¶“–6&”v$uc”tg6$Sf6ä&ö3g•¥gÆ6Ó†u4#6åfÄó‡U„sFt”3‡d”tçf$w†Å“5vsS¥„§5¥tc%¥uu•sV´”sWf&“&å&Æ6×†Å•…¦Å¤4'F#4§v4&†D…'–t£Dug¥„sFt”tçf&äã”gG&å&Æ6×†Å•…¦Å¤T£¦Õ¦Æ6´cD„§–åc¥S†47vv&Ó—U5sS¥„§5¥tc%¥u$&D…'–t£Dug¥…4””tçf$w†Å“5$æ#4§vTcD„§–åc¥VG–#5gv7–‡F#4§vTcD„§–åc¥„×ó‡U„sFt”tçf&äã”sVÆCf6ä&õ…#6ÖÆ–E…&Æ7¦öudV…5%UWUåfÕ¦Õg•#%gf%uc6æÆ$£#f6ä&õ…#6ÖÆ–E…&Æ7–FD”CvS3u„sV6&”tÇ“†v4„§e“%g¦7”'&å&Æ6×†Å•…¦Å¤4'F#4§v4&†D…'–t£Dug¥„sFt”u§f6”õ“#—V35us&ÇVDug–$uf†FÕfµåfÕ¦Õg”Ä4&†D…'–t£Dug¥5sT†6Ó“4cv#%–vsS¥„§5¥tc%¥u$6Eu¦Õ¥„¤&D…'–t£Dudå•„”‡F6&”t”4dÇ”'•¥t£w†´”vÇVDug–$uf†FÕf´”t£¦Õ¦Æ6”&†6ä¦†Ug‡T”4t”tçf&äã”s—–vG&Ôg55sS¥„§5¥tc%¥u$6Eu¦Õ¥„¤&6ä¦†U4””vÇVDug–$uf†FÕfµåfÕ¦Õg”ÆÔg–6ÔcTó‡T”4t”tçf&äã”‡6v35'–u&Ä”ƒu4'&å&Æ6×†Å•…¦Å¤T£¦Õ¦Æ6§F6&”t”4&¦##W¦D4&&&Õc55sS¥„§5¥tc%¥u$&6ä¦†U7vv„ä&$w†¥„§e…4””„¦Æ%tgu…#6ÖÆ–E…&Å„§••†¶õ„sFt”4t”4'f6ÖÆæsV†$VÇVDug–$uf†FÕfµåfÕ¦Õg•„§••†·5„sFt”4t”4'U¥†D¦&Õ&ÆTS—–vG&Ôg55sVµ¥†„å•„5„sFt”4t”4'¦D„§¤uW5„sFt”4tµGF6&”t”4&†$w„æ#4§v„ä&6Õf¥„§d”Cu•w‡5Es—–4v‡¥„¦ÅvÕg–'”Ô¦”'3g6$gÆ6Óƒu„sV6&”t”4dÇ”'•¥t£w†´”vÇVDug–$uf†FÕf´”t£¦Õ¦Æ6Ç‡T”4t”tçf&äã”sVÆCÇVDug–$uf†FÕfµåfÕ¦Õg””Cv&Õc4”e$•VµddÆ¶ÇVDug–$uf†FÕfµåfÕ¦Õg”´sVÆCÇVDug–$uf†FÕfµ„§••†·4”„ã6ÖÆµ¥6³u„sFt”4v&Õc55sS¥„§5¥tc%¥u$6Eu¦Õ¥„—V3%ce„æ…£%VösS¥„§5¥tc%¥u$6Eu¦Õ¥„—VE„æ…£%Wó‡U„sFt”4tÇ“†v6Õf–EvÇ5¤4'&å&Æ6×†Å•…¦Å¤4&–Eu¦Õ¥„–u•…#6ÖÆ–E…&Æ3‡T”4t”u§f6”õ“#—V35us$cD„§–åc¥SV†%uW4”sf6ä&õ5sVµ¥†w4”tcD„§–åc¥cv#%–u•…#6ÖÆ–E…&Æ3ÇU#4§fE„”‡F6&”t”4t”tçf&äã”‡6v…&Æ%dçVÕW4”s–Õ¦äæÆD7vv&Ó—–%tg6‡Å¤4#””Cu•…#6ÖÆ–E…&Ä”tg¤”e$•VµddÆ¶ÇVDug–$uf†FÕfµåfÕ¦Õg•…#6ÖÆ–E…&Äó‡T”4t”4u“#—V35v&Õc5…#6ÖÆ–E…&Ä”Cv&Õc4”e$•VµddÆ¶ÇVDug–$uf†FÕfµåfÕ¦Õg•…#6ÖÆ–E…&Ä´sVÆCÇVDug–$uf†FÕfµåfÕ¦Õg”Ä4'DugES&Ãe¥7vv#%¦Ö3%cÄ4'V#4§E•w‡VÕf´µGF6&”t”4t”sVÆCf6ä&õ…#6ÖÆ–E…&Æ3F†D…'–t£Dudõ•sÅ…4õ£usu„sFt”4t”4'U¥†Dæ#4§vTcD„§–åc¥„æ%•…#6ÖÆ–E…&ÅFÔgE¥c&%s—–4v„¦&Õ&ÆTcu4'U¥†D&D…'–t£DuSu„sFt”4veg‡T”4#•„sV6&”tÇ“†v4„§e“%g¦7”'V##GFsS¥„§5¥tc%¥uv%s—–4vvu•…#6ÖÆ–E…&Æ3‡T”4&Ö#4–t´tçf&äã”gF†D…'–t£Dudõ•sÄÄ4'F#4§vVÇU¤ucDÄ4&†D…'–t£DufD”s–Ô”sWf&¶ÇVDug–$uf†FÕfµ…#6ÖÆ–E…&Æ7–¶vS‡T”4t”tçf&äã”s—–vG&Ôg5…#6ÖÆ–E…&Ä”Cu•…#6ÖÆ–E…&Ä”tg¤”e$•VµddÆ´£¦Õ¦Æ6´cD„§–åc¥GF6&”t”4&¦##W¦D4'f6ÖÆæsV†$TcD„§–åc¥Tg–6ÔcT”Cv#4§£&ÇU•w„&D…'–t£DuWU•„§••†³u„sFt”4u“#—V35vW”'DugES&Ãe¥7vv&Ó—–%tg6‡Å¤4#””Cv#4§£&ÇU•w„&D…'–t£DuSu„sFt”4u“#—V35us#VÆCcD„§–åc¥Tg–6ÔcTÄ4'3g6$gÆ6Ó–D”Cv6ÕgE•„$&D…'–t£Dud&6ä¦†U6†6&”t”4t”s—–vG&Ôg5…#6ÖÆ–E…&Å„§••†·5„sFt”4t”4'U¥†D¦&Õ&ÆTS—–vG&Ôg55sVµ¥†„å•„5„sFt”4t”4'DugES&Ãe¥7†6&”t”4ó‡T”4t”tg6$Sf6ä&ö3g•¥gÆ6Ó†u4&†$w„æ#4§v„ä&6Õf¥„§d”5–Ô”vÇ¥w‡5vÕg–'§F6&Ç‡T”4t”sVÆCf6ä&õ…#6ÖÆ–E…&Æ3F†D…'–t£Dudõ•sÅ…4õ£usu„sFt”4v&Õc5Es—–4v„&D…'–t£Dug¥s$cD„§–åc¥SV†%ufEs#f6ä&õ5sVµ¥††D”Cv&Õc4”T£¦Õ¦Æ6´cD„§–åc¥6‡U¥†D&D…'–t£Dud&6ä¦†U7vv…&Æ%dçVÕW4”sWf6Ó†$vÃe¥uó‡T”4#•„sV6&”tÇ“†u¤vÇ¥“$g•¤4'F#4§v4&†D…'–t£Dug¤”vÆÔ”tg6$4#%•wƒ¥„Öu•„¦Ä”‡Æ6Ó–6&”v&Õc5#%gf%uc6æ·V%s—–4v„&D…'–t£Dug¤”Cu•w‡5Es—–4v‡¥„¦ÅvÕg–'”ô”‡C””Föv&Õc5Es—–4v„&D…'–t£Dug¤ó‡Veg‡U„sGd¶—6&””e'••…¦Æ6äæÄ”vGFÕgT”s––Õf¦D4&†&Õv6ÕgF#5¦Ä”…gV&Õf¥¥„ç¥•„£T”…¦Æ6å'“%g¤”u§–##u¥…¦Æ6æ¶uåfÕ¦Õg•#%gf%uc6ÖÆÆ7“V6&””e&ö„Öv##W6U4'v6Ó–¥¥„ç¥¥„Öu–åfÕ¦Õg””vFÆ##ÆD„§¥„ÖvC&Ã4'&Õ&ÆT4&–Eu¦Õ¥„—U„sFt¶Ç‡T”6öu%g–Dtg&”'F#%&Æ$„Övtc%¥4#%¥„£tæÆ7”#tc”tg•¥4'V#5vE„æÅ¤4&–U4&†&æ¶u¦Ôf¥¥„×U„sFt¶”%V„¦Å¥3W7”&¦6Õf†Dug¤”sf6ä&ô”…&ÆT…#6Õg¤”u§f6”&Å•tæô”vFÆ##ÆD„§¥„Öu•sV´”vÃ”„çf%ucsÆ7”&¦##W¦EsÆ7”#&ÓVÅ“%g¦3$g–U4&†%s“&åv#%–ufÄ¤%E4&Ö#4–u“%g–Dtg&”'F#%&Æ$„×U„sFt¶”%VvÇ¤”u£&Ôãs—T”†G$wvv#4#sVÕVu£%gf%uc6ÖÆÆ7”#'”'•¥u#“%VvDv†Ä”„çVÕVv#%–v%s—–4vvvDucFD…g•¥3V6&””dæÅ¥Föv…#4„ÓdÇ“–æ…&öEt—U“#—DÃ#•¤s—e–““„¦Å¥3W7“—34ã¥„×dÖ¤×tõEf6&”„sFt¶”$4tg••sv6Ó—fD4%6##“”s––Õf¦D4#tc”†G$wvu–ÕVvD„¦†FÕg–3%fµ„sFt¶“–6&ÕcF4s—–D4&ÖEsV¦DvÇf&”'•¥sfFÕef&ÓVÅ“%g¦3$g–Ue¦Æ6å'“%g¤´„§f#5d”e$•VµddÆ³––Õf¦DDäTµFövFÓ—¤4#u„sFt”tçf&äã”vFÆ##ÆD„£UEtgt”Cv&Õc4”S†4G…U4d¤e%3T6Eu¦Õ¥„¤…¥s—E¥…'–U7vudV…5%UWUåfÕ¦Õg•#%gf%uc6æ²´´6³u„sV6&”tÇ“†ud„¦†FÕg–3%Vu•sFu¥sS„¦Ä”…'•¥uf6&”v6Ó—fD3S6Ôc%¥„§¥¥6vö#$§µ4•”#u„sFt”4vu–t´4Vö#$§”tg¤”tgVU6·V„äå¥„æôµ4#u„sFt”4t”4'•¥…#6ÓCu„sFt”4veg‡U„sFt”4u“#—V35v%ug¦4””s––”&†7”%U4d¤e%3Tå¥„æôó‡T”4t”tçf&äã”vFÆ##ÆD„£T”Cv%ug¦3Vå¥s—E¥…'–UGF6&Ç‡T”4t”3‡d”vÆÔ”…&õ¥4&å¥s—E¥…'–U4&¶#%g¤”sWfD4&õ•…¦Ä”tgT”vÇU¤ucD”t£¦Õ¦Æ6”'D4&¶#%g¤”sWfD4'U¥uf´”…'d”t¦Ä”„'–#$æÆ34æÅ¤g‡T”4t”tçf&äã”s—–vG&Ôg55sVµ¥†vu4&å¥s—E¥…'–U3W&Õ&ÆTGF6&”t”4'¦”ö#4§£&ÇU•w„¦&Õ&ÆT4•4'VEw‡4µ4#u„sFt”4t”4'•¥…#6ÓCu„sFt”4veg‡U„sFt”4tÇ“†vu–vDv†Ä”vFÆ##ÆD„£T”v††7”&†$„¦Å•u#T”t¦Å¥sFv4„§e“%g¦3%f´Ä4'•¥…g¥¥4'Dg‡T”4t”tçf&äã”sVÆCFÆ##ÆD„£Uw‡•¥tf¶UUcF„ã¥uu4&å¥s—E¥…'–US†43Vå¥…õ£%gf%uc6æ·ó‡T”4t”vÆÔ”6‡U¥†D…¥s—E¥…'–UTg66Õf…¤†ÄfTvÇ¦Duf´”4S””sS$ww”‡F6&”t”4t”sÆ3&wU£%gf%uc6æ¶u4'U¥†D…¥s—E¥…'–UTg66Õf…¤†ÄfTvÇ¦Duf´ó‡T”4t”4v6ÕcE„§Tó‡T”4t”ƒ6&Ç‡T”4t”3‡d”tæõ¥tç$”†Fötæô”…¦Æ6å'“%g¤”tg•¥4#3%fµ„sFt”4u“#—V35vW”'3¦Æ6å&ÆTeg¥¥u4”…¦Æ6å&ÆTTçfEsSÄ4#%¥„£tæÆ3g¥¥uve4””tæõ¥tç%5„åu¥„£¥†…f3%f´´vFÆ##ÆD„£TÆÔcD„§–åc¥„×4”s—–vG&Ôg55sVµ¥†wó‡U„sFt”4tÇ“†vu–u•w‡4”…¦Æ6å'“%g¤”tg•¥4#3%f´Ä4&¶'”'V#5&ösVå„sFt”4vu–t´…¦Æ6å'“%g¥e„æÅ¤4•CvFÕg–DucE#“&å”‡F6&”t”4t”„¦ÆD…g–&§F6&”t”4#•„sV6&”t”4dÇ”&–EvÇ5¤4'&Õ&ÆT4'E•„'¥„sFt”4u“#—V35vW”'f6ÖÆæsV†$VÇU¤ucEFÕc55sVµ¥†„å•„4”sVÆCÇU¤ucEC4§£&ÇU•w„¦&Õ&ÆTS†44#””Cu–åg$u$¦&Õ&ÆTS†4„äv6Ó—E5„åu¥„£¥†…f3%f´´vÇ¥fÕg–DucEe„æÅ¤6³u„sV6&”t”4dÇ”#vÇ¤”vÇ¤”…&õ¥4'U¥†6u£%gf%uc6æ¶vC%VvC&Ç6$4&–EvÇ5¤g‡T”4t”tçf&äã”sVÆCFÆ##ÆD„£T”Cv&Õc4”e$•VµddÆ´£¦Õ¦Æ6¶FÆ##ÆD„£T´6³u„sFt”4u“#—vUVFÆ##ÆD„£UT„§f4ug–DvÆÆ7–†å¥s—E¥…'–U7vv&Õc5#%gf%uc6æ·ó‡U„sFt”4tÇ“†v3%c”…'d”vFÆ##ÆD„£UEtgt”u§f6”'5•…&Æ6”'•¥…g¥¥g‡T”4t”vFÆ##ÆD„£UEtgtÆäæÆD6†å¥s—E¥…'–U7vv&Õc5#%gf%uc6æ·ó‡U„sFt”4tÇ“†v6Õgf6ÖF†&ÖÃe¥4'&Õ'“%g¤”tgU¤4&†D…'–t£Dug¥„sFt”4v6Õgf6ÖF†&ÖÃe¥VÇU¤ucE…#6ÖÆ–E…&Ä´sVÆCFÆ##ÆD„£TÄ4'f6ÖÆæsV†$VÇU¤ucDÄ4'f6ÖÆæsV†$VÇU¤ucEFÕc55sVµ¥†„å•„ó‡T”4t”„¦Æ#4¦å•sWVÕd…¥s—E¥…'–UTcD„§–åc¥„Öö&Õc5#%gf%uc6æ·4”vFÆ##ÆD„£TÆÔcD„§–åc¥„×4”sVÆCÇU¤ucEC4§£&ÇU•w„¦&Õ&ÆTS†46³u„sFt”4v6Õgf6ÖF†&ÖÃe¥Sf6ä&õ…#6ÖÆ–E…&Æ7–‡U¥†D…¥s—E¥…'–U7vu£%gf%uc6æ·V%s—–4v„&D…'–t£Dug¤Ä4'U¥†D¦&Õ&ÆTS—–vG&Ôg55sVµ¥†„å•„ó‡U„sFt”4tÇ“†u¦ÖÇU•w‡6U7vv3%c”…&õ¥4'U¥†6u£%gf%uc6æ¶vDs†vDv†Ä”sÆ3&†6&”t”4'E¥„æôÆÖFÆ##ÆD„£T”Cv&Õc5#%gf%uc6æ³u„sFt”ƒó‡U„sFt”Tg–6ÔcTÆÕ§–##õ£%gf%uc6æÄå•„V%cV7–wµ3VÖ#4¤e•tæô´6‡f6ÖÆæsV†$VFÆ##ÆD„£Tµ4•”#u„sFt”4v#4§£&ÇU•w„…¥s—E¥…'–U3V¶„çv#4æÄ´6³u„sFt”ƒó‡Veg‡T–—vt–ÖÇF4s—–D4#t”e¥5E4#””u§–##t§“GTÃ¥5E63u„sV6&“‡¶Ç‡T”6öu5u–vDv†Ä”vGFÕgT”e¥5E4'7”%uV³tÆ¤4”„§fDtc¥4#uVu”…§–%3W¥“%gU¥tu–æ¶tÕFwt”u&Å£4¦Å¥„Öu•„§fEsV´”…&õ¥4%¤”tcF„×U„sFt¶Ç‡T”6öu„&†6ÔgD”…§–%4%VuVvDtg•£%c”e¥5Eg‡T”6÷e„sVÆT„'f6åu¦ågU“5'##Fv6Ó“•…&ÅfÄ¤äÔ6ƒ&6Ód”e¥5E6³d”…§fuvS‡T”4'¦”öFä§DÆÓÆDtRôÆÓÆDteu¥„§¦s—T”C•4äÔ67”‡F6&”t”4#&6ÓV3$æÆ&ÕWV6Ó“•…'##GVU4””S†DvwUTV³u„sFt”ƒ6&ã6&”—4”4§%„'f6åvW”&¦##–sVÅEs—–4v‡¤”ƒu¦ä§f%4äÆ“–¦##–sVÅEs—–4v‡¤§§F6&ÖÇF4s—–D4#t”tçf%t§&ÕeF%g5¥…'f&äÖve4&Ö6Ó—D”67TÃ$çf%t§&ÕeF%g5¥…'f&äÖäó‡Vsv#4£”‡6u¤ufÆ4U'34'f3%Vve4&Ö6Ó—D”67TÃ%&Å¥„$V„çv#4æÄ§§F6&ÖÇF4s—–D4#t”„¦Æ%s“%¥egV&Õf¥¥„ç¥•„£U6Ó—&å'¤”ƒu¦ä§f%4äÆ“—•¥sfFÕef&ÓVÅ“%g¦3$g–UWfsS7–3u„sW%„'f6åvW”'•¥sfFÕef&ÓVÅ“%g¦3$g–Ue¦Æ6å'“%g¤”ƒu¦ä§f%4äÆ“—•¥sfFÕef&ÓVÅ“%g¦3$g–Ue¦Æ6å'“%g¤§§F6&ÖÇF4s—–D4#t”„§fDtc¥e¥5EDve4&Ö6Ó—D”67TÃ4§fDtc¥e¥5EDäó‡U„sVÆT„'f6åu“'††34ÖufÄ¤åe…'$„ÖvS‡T”4'v6ÖÃ%•…&Ä”tçf&äã6åf¦Ds—”´6¶vS‡T”4t”3‡d”…&ö„Öu“'††34Öv„Öv&Ó“”sÅ•sS”…'d”t¦Ä”vÇV35&†&å'•…&Å¤g‡T”4#•„sV6&”v4…f–$vÆ¤”„ã•…'—”&¦##–sVÅEs—–4v‡¤”Cu“#—E–ÖÇU¥Sf6ä&ö7§F6&”v4…f–$vÆ¤”„ã•…'—”&¦##–sVÅS'FÆ$uc##W¤”Cu“#—E–ÖÇU¥dç%¥w†ÆDs—V7§F6&”v4…f–$vÆ¤”„ã•…'—”&µ¥ugu$vÇ¦4s—¥¥4””u&Å¥„$V„çv#4æÄó‡T”4'vEt§6tÖv35&†DvÆ¤”„¦Æ%s“%¥egV&Õf¥¥„ç¥•„£U6Ó—&å'¤”Cv6ÕgF#5¦ÅesWU¥tæÆ34æ†6æÄ¶#&ÇVD„Óu„sFt”„#–×‡—”'¦DtctÖv6ÕgF#5¦ÅesWU¥tæÆ34æ†6æÅu¥„£tæÆ7”””„¦Æ%s“%¥egV&Õf¥¥„ç¥•„£UfÕg–DvÆ¥¥„Óu„sFt”„#–×‡—”'¦DtctÖv6Ó“•…&ÅfÄ¤äÔ4””„§fDtc¥e¥5EDu„sS•„sF•…7t´”4–%tgv4vÇU£4Ö”ö””÷§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3uTd%7…¥Te¤ÄfD%f3uTäfF´—5uTd%uTW5uTd%g§D%EU£%—…¥Te¥7…¥Te„óde…¤4ÄfÄ%fÄ$ÄfÄ%f3uUdFF´—5uTd%uTW5uTd%g§D%##%—…¥Te¥7…¥Te„ód¥…¤4ÄfÄ%fÄ$ÄfÄ%f3uUd&F´—5uTd%uTW5uTd%g§D%5Tc%—…¥Te¥7†…Te„ódE…¤4ÄfÄ%fÄ$ÄfÄ%f3uTä&F´—5uTd%uTW5•Td%g§D%c%—…¥Te¥7†…Te„ódE…¤4ÄfÄ%fÄ$Ätd%f3uVDFF´—5uTd%uTW5•Td%g§D%c%—…¥Te¥7†…Te„ód¥E…¤4ÄfÄ%fÄ$Ätd%f3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§D&4Tä&T—55Td%E7†å´d%F—†¥Tg%—†ÅTeDód&EVFõ$7…¥Te¤ÄvD5Tc5§D%Tç5—…eTdäód$ÕU¥4Ädä%S‡5Sd%W§D%WFõ—…ETeÄfD%f3uTdÆ$T—5Sd%G—†å´d$Ö´ÓuTdÆ$U5Sd%G—‡´d$äTÓuTdÆ&µ5Sd%G—†å´d$Ö´ÓuTdÆ$U5Sd%U7…ETSE—„ETdDód&%Ug•—…ETdÄÄS”%S‡6T¤%vÄ4Ätä%tÓuTdDÓ×5Sd%7—‡´d&T“uTd†DT—5Sd%7—…Teód%5f÷5Sd%7—…eTedód%'4÷§3tód&Fµd$ÄVÄ%f75UTd&3ÓuTdDÃ×5cd%G—„ÅTdÄód%%t÷§3tód%UTW55Td%g—‡¥´d$ôT“uTdFF´×5UTd%57„ÅTdÄÄwD5Tg%—…ETeDód%'„DÄtd%S‡55Td%E7„ÅTdÄÄud%uW55Td%EGD¥Tãe—……Te„ÄWD%W76¤%wD4Ädä%dÓuTdFV´×5•Td%G—„ÅTdÄóÄ%%5Cd%G§D%TäÔÄtd%Sƒu5TdEdGDeTät÷§3t÷§DeS$ÄVÄ%f76ET¤%7D4ód%6„DÄdd%V·53d%7—‡E´d&%T—5Sd%W§D%TçU—†…TeÄVÄ%S53d%7—†ÅTfÄÄVÄ%Su5TdFV´×5cd%g—„ÅTdÄÄs5TgE—…ETeDód%¤dDÄtd%S‡53d%7§D¥Tæ´ÄS”%SƒuTdED7†…TeóÄ%u%TdE&§3t÷§3u%Tdå7„¥Te„Ä„ä5TSE§D%Tã%—…%Td¤ÄWD%W76¤%wD4Ädä%dÓuTdF$T×5•Td%G—„¥TdäÄWD%W75¥Td%¥7„¥TdäóÄ%7DÄfD%f753d%7—‡%´d&—5Sd%W§D%Tãe—†…TeÄWD%W3u5TdE¤7…Teód%w5•Td%G§D¥TåTód%“t÷§3u%TdÅ7„¥Te„Äud%…d4ód%&„DÄdd%V·53d%7—…eTedód%'4Ätd%S‡53d%7—…ETeDÄS%S55Td%EGD¥TçU§D%Ud$ÄfD%S‡53d%7§DeTæ´÷§3t÷§3u%Tg…³‡5UTd%U7„åTW%§D%TÓ—…ETdÄÄS”%S‡53d%7—„¥Td¤ód%5¤4÷§3t÷§3u%TeG—……Te„ÄS%7D4ód%“”DÄed%S5UTd%U7„ÅTdÄÄS”%S‡5UTd%U7„¥Td¤ód%5$DÄdd%V·5Sd%W—„…Td„ód%%5cd%7—…TeÄS”%S‡5Cd%G—„ETdDóÄ%¦D4ód%“t÷§3tód%ES‡5uTd%u7…ES•tód$åW”Ädd%TSuTS%6¶·5UTd%57†ÅTfÄÄWD%W3uTdFTT—65T¤%vD4ÄWD%TW5cd%7…Td$Ädä%TW5UTd%W—†ÅTeTÄS”%TW53d&ET“uTd†F´×5UTd%57„ÅTdÄÄfÄ%f·5¥Td%¥7„…TdÄód%5¤DÄ„d5TfÄóÄ%'4ód%%TW5Sd%7—…TeÄdd%dW5d%—…ETeDÄWD%W75uTd%u7…¥Te¤ÄTä%TÓu%TdDõUt÷§3u%TdÅG—‡…´d$Ö´“uTdFT×5Sd%7—…TeÄdd%dW5d%—…ETeDÄWD%W76%T¤%s4ÄTä%TÓu%TdFVµuTdE&§D%%DdÅ7…ETeDÄD$5TWu—„åTe¤ÄfD%s4ÄS%D¤Dód%6¦D„ÄS%TW55Td%GD%WDdÄdd%S5Cd%G—„ÅTdÄÄS”%SƒuTg¥$‡4Ädd%S5“d%•7„ÅTd$ÄWD%W75eTd%D7…Td$Ädä%TW5#d%•7…ETd$ód%&„DÄS%V·5“d%——„åTdäód%5$4ÄfÄ%dW53d%7—‡E$Td&%U5Sd%W—‡¥d&3ÓuTdDÃ75cd%G§DeTåTód%%TW5UTd%E7…¥Te¤ÄfD%f3uTdDã—5ETd%57†…Tf„ÄS%SuTdF6´—5cd%G§DeTåTód%#W5UTd%E7†¥Tf„ÄWD%TW53d%7—……TdÔÄS”%TW5Sd%7„…Tf¤Ädä%TSuTdF´×5ETd%57†¥Tf¤ÄS%SuTdFDT—5uTd%U7„ÅTdÄÄs”UTge$7…ETeDÄ„äETg¥§D%Tæõ47……Teód%uTde7…%TdäÄvÄ5Tg—……Te„ÄfD%f3uTd„ã×5UTd%E7†…TW•—„ETdDód%'„DÄS”%W75Sd%W—„ETdDÄfD%f3uTdFTT—5UTd%57……Te„Ädä%d×5£¤%vD4ód%5$DÄed%W75Cd%¥7…%Te$ód%¤d4Äs5Te„ÄWD%W75ETd&#“uETdFDTÓu5TdE&§DeTätÄTä%TÓuTde$7…ETeód%uTe…7…ETg¥—sE´d$ôT—5ETd%u7……Tg$GD%Td$Ädä%TdDÄdä%TW5ETd%7„åTd$Ätd%TSuTdDÃ75eTd%E7…Tc—„åTdäÄWD%W75Cd%G—†¥Tf¤Ädd%dW5Sd%W§D%TÓU%7……TeÄD$5TWu—„åTdäÄfD%f755Td%5GDeTãE$7„ETd$ód%TSuTe…7…ETg¥—w%´d$³—5ETd%£uTd%7…ETd%7…ETd$ÄS%TW5ETd%7†…Td$ód%#T„Äed%S5UTd$ÔT—5ETd%E7„ÅTdÄÄS”%S‡5£¤%vD4ÄS%SuTdFTUW5eTd%E7„åTdäÄs”5Td¤ÄVÄ%D$4ód%%DdDÄed%S5UTd%U7„ETdDÄS%S5eTd%eGD%TÓ5—…¥TdäÄdä%d×4ÔT¤%D$4ÄS%S5Cd%G—„¥Td¤ód%¤dTÄed%V·5eTd%e7„åTdäód%'„4ÄfÄ%V·55Td%57…TeÄS%SuETdFF´“u5TdE&—„ETdDód%%U5cd%G§DeTåTÄTä%TSuTd%GD%¦D•G—„¥TdäÄD$5TWu§DeTç•—„¥Td¤ód%÷55Td%5GDeTä´ÄVÄ%V³u%TdE6—„¥Td¤ód%÷55Td%5GDeTä´ÄS”%Sƒu%TdET7…Teód%5Cd%G§DeTåÄWD%W3u%TdED7…ETeDód%5UTd%UGDeTå4ÄfD%f3u%TdEt7…eTedód%—5eTd%eGDeTåtÄfD%f3u%TdEt7……Te„ód%w5uTd%uGDeTæÄdä%dÓuTdEtGD%&„5G—…ETeDÄdä%d×5Cd&ET“uTdDõT×5Sd%G—„ÅTdÄÄVÄ%V·53d%7—„¥Td¤ÄS”%S‡5d%'—„…Td„ÄTä%V3uTdDÓÓuTä•G—„¥TdäÄ…d5TdôÄS%S63¤%„d4÷§3tód&3ce—†¥Tf¤ód&$Ug•—…ETeÄ…d5Tc—„ETdDÄdä%d×5•Td%•7…¥Te¤ód%3'dÄdä%S‡6C¤%†D4ÄTä%T×5uTd%u7†…Tf„Äed%eW5eTd%eGD%W35%7…ETeÄ…d5Tc—„ETdDÄS%S5ETd%E7„åTdäÄS%S55Td%5GD%S¥$7…ETe$Äud%vDDÄTä%TÓuTe&V´×5Sd%U7‡´d&#5d%§DeE$Dãu%TgU$TW55Td%g—†¥TW%§D%TãE—……TeÄWD%W75•Td%•7…Teód%'„Dód%ETW55Td%g—†å´d&%UuTdDåU5cd%G—…TeÄS”%S‡5d%—„…Td„ÄWD%W75“d%—§DeTÓU§3t÷§DeWD$ÄVÄ%f763¤%E¤dód%5$tÄed%S5Sd%£W5d%§D%Uc%%7…eTdäÄvD5Tfå—„¥Td¤ÄVÄ%f·5Cd%G—…TeÄ…d5Tc—„ETdDód%%EddÄfD%S‡5UTd%U7„ÅTdÄÄtä%t×5%Td%%7…%Te$ÄTä%T×5d%—„åTdäÄed%eW5ETd%EGD%Tç5%7…eTd¤Ätä%t×55Td%57„¥Td¤ÄVD%V3uTdDÓ—5¥Td%G—„¥TW%—„¥Td¤ó%¥dDóÄ%—5d%§D%UdTÄfD%Sƒu%TdEdG3t÷§DeWD$ÄVÄ%f763¤%†ÄTód%'„dÄed%S5Sd$äT×5d%§D%UgU$7…eTdäÄvD5Tfå—„¥Td¤ÄVÄ%f·5Cd%G—…TeÄ…d5Tc—„ETdDód%%EddÄfD%S‡5UTd%U7„ÅTdÄÄtä%t×5%Td%%7…%Te$ÄTä%T×5d%—„åTdäÄed%eW5ETd%EGD%Tç5%7…eTd¤ÄTä%T×5“d%——„¥Td¤ÄVÄ%V·5#d%'§D%TÓ—†ÅTeÄVÄ%V·55Td%5GDåTç§D¥TätÄTä%TÓuTde$7……Teód%t÷§3t÷§DetåÄWD%W75UTd&#ÓuTddõT×5eTd%E7†¥Tf¤ÄWD%W75•Td%•7…Teód%¦DDÄvD5Te¤Ädd%dW5d%—†ÅTfÄód%'„DÄfD%W765T¤%„d4Äed%eSu5TdFDT×5d%§D%VDTÄfD%S‡5•Td%•7…%Te$ÄTä%T×5¥Td%¥GD%T×…—……TdÄÄs5TgE—…eTedóÄ%4$DÄTä%TÓuTd…$7…ETdÄÄ…d5Tc—…TeÄ„d5Tg…—…Teód%“”TÄdä%W76C¤%†D4ÄS”%S‡63¤%„ä4ÄS”%SƒuTdFµW5Sd%7—ƒ´d&ET—5Cd%G—‡…´d&5T—5Cd%G§D%UWe$7……Teód%t÷§3tód%ES‡5UTd$ôT“uTdF&´×5cd%G—„¥Td¤Ä„ä5Tg…—„eTddÄWD%W755Td%5GDeTÓ5§3t÷§3t÷§DedeÄtä%t×5ETd$ôUuTg•4„¤tÄdd%TSuTg¥4V·5uTd%G—„ÅTd$ÄWD%W75¥Td%¥7„¥Td¤ÄS%†„4ÄS”%TW53d$æ´“u%TdFDTÓt÷§3t÷§DeS•Äs5TgE—…¥Tg§D%Tãe$7…ETdÄÄtd%tW53d%7—…eTedód%'DÄdä%W75¥Td%¥7……Te„Ätä%t×55Td%5GDeTçU$G3t÷§3tód%C‡65T¤%„d4ÄfÄ%vÄDód%¤äTÄed%S5UTd%U7„ÅTdÄÄtd%tW5UTd%U7…eTedód%'„TÄdd%V·5eTd%e7„¥Td¤ód%&„4Ätä%dW53d%7—‡E%Td&%USu5TdF$U“uTde7…ETdÄÄtd%tW5Cd%G—…TeÄTä%TÓuTdF´×5cd%G—„ÅTdÄÄud%uW5cd%g—†¥Tf¤ód%5$T÷§3t÷§3tód%US‡5Sd%W—„åTc$GD%†„¶VµW5UTd%GD%†Äµ57…eTdäÄtd%tW53d%7—†¥Tf¤ÄVÄ%V³uTdDÕT×5uTd%G—„ÅTd$Ätä%TW5Cd%7…ETd$ÄfD%f·5cd%v—…Td$ÄWD%„ä4ód%“”4÷§3t÷§3tód%US‡5Sd%W—„åTc5—…%Tg¥§D%TÓ%7…eTdäÄtd%tW53d%7—†¥Tf¤ÄVÄ%V³uTdDÕT×5UTd%57…¥Te¤ód%%6T¤%f75Sd%W—…ETeDÄS%Su5TdF6´Óu%TdE&§3t÷§DeWEÄtä%s”4ód%74Ädä%W75•Td%•7…%Te$ÄTä%T×5¥Td%¥GD%TãE—‡´d%g—…ETeDóÄ%5$4ÄTä%TÓu%TdE4G3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3tód$äT¥Ä…d5Tc—„åTc$GD%TçU&—…eTdäÄtd%tW53d%7—†¥Tf¤ÄVÄ%V³uTdDÕT×5cd%G—†…Tf„ÄVD%V75cd%g—„¥Td¤ÄfÄ%f³u%TdF4Ut÷§3u%TdÅG—…ETfÄód%%„$4Äed%S6#¤%s”4ÄWD%W74äT¤%E$4ód%'¤äTÄdä%W75•Td%•7…%Te$ÄTä%T×5¥Td%¥GD%TãE—‡´d%g—‡E´d&%T“u5TdFT×5d%§D%VDTÄdä%W75•Td%•7…%Te$ÄTä%T×5¥Td%¥GD%TãE—…eTd¤Ätd%tSuTdF´—5uTd%E7…TeÄfD%f3uTdfTT—5eTd%57„ÅTdÄÄ„d5Tg…—…%Te$ÄVÄ%V·5ETd%E7„¥Td¤ód%'„TÄ„ä5Tf¤ÄwD5Tg%§DåTç5§D%Ud$Äed%V·53d%7—‡¥´d&3—5UTd%U7„¥Td¤ÄS%S55Td%5GD%TçU$7‡¥´d%——‡%´d&“uETdF$TÓuTde7…eTd¤ÄWD%W765T¤%„d4Ädd%dW55Td%57„åTdäÄVÄ%V³uTdF$U63¤%t×6¤%wD4ó%'„Dód%%TW6T¤%f75uTd%u7„eTddÄfD%f75d%§D¥Tã%—„ETdDód%st÷§3u%TdÅU7sE´d¥F§D%Tä$Ädd%V·5UTd%UGD%TæÄdd%V·5Sd%W§D%Tæ”Ädd%V·5UTd%UGD%UfÄdä%W75•Td%•7…%Te$ÄTä%T×5¥Td%¥GD%TãE—†ÅTeDÄfD%f3uTdF4T—5£¤%eW5cd%g§D%Tç•—†ÅTeDÄfD%f3u5TdFDT—5d%§D%UdTÄfÄ%dW53d%7—„¥Td¤ÄVD%W753d%7§D%T×¥—†…TeDÄWD%W755Td%57„…TdÄÄS%SuTdDã—5uTd%U7„ÅTdÄÄVÄ%V·5#d%7—„ÅTdÄód%%Dä4ÄfD%S‡5%Td%%7…TeÄdd%dW5ETd%EGDeTæõ§D%TätódFVÄeÄVÄ%S6Tä%vÄDód%¥dDÄS”%Sƒu%TdET7†ÅTfÄód%%—5uTd%uGDeTæÄtd%tSu%TdE–—…eTedód%—5“d%—§D%Tæõ§D%WEÄVÄ%S4³¤%F„tód%7„Ädd%dW4³¤%7D4ód%5¤DÄvD5Tfå—w%´d$³“u%TdDÃ×5•Td%•7w%´d$³“u%TdDåT×5cd%g—w%´d$³“u%TdDÕT×5¥Td%¥7w%´d$³“uTdFUuTæõ´W55Td%E7…ETeDÄVÄ%eW5•Td%EGD%„ä6TT—55Td%E7‡%d%F—„åTdå—‡d$äUu%Tg¥$v„dÄfÄ%f³u5TdF´“u5TdEGD¥Tä$óÄ%Su%TdE&—„…s”5'§D%TäTÄdä%W75cd%g§D%Tæõ—…ETdÄÄS”%SƒuTdEv—…ETdÄÄtä%tÓuTdF&´—5Sd%7—†¥Tf¤Äud%TW5Cd%7†¥TfÄód%#'„DÄed%S5UTd%U7„ÅTdÄÄs”5Tge§D%Tã%—…eTdäÄdd%dW53d%7—‡e´d&#“uTdFF´×5Sd%7—…ETeDÄUd%UW5Cd%G—„åTdäód%“”4ód%%S‡5uTd%u7…%Tg¥§D%Tã%—…eTdäÄUd%UW5Cd%G—„åTdäÄVÄ%V·53d%7§D%USU—…%Td¤Ädä%d×5ETd%EGD%Tç—…¥TdäÄUd%UW5“d%——……Te„ÄVÄ%V³uTdf6´×5uTd%E7…ETedÄWD%W75Sd&T—5uTd%uGD%Tç5$7…eTd¤Äed%eW5UTd%g§D%Tã%—†ÅTeÄVÄ%V·5Cd%G—„ÅTdÄÄed%eW5%Td%%7†ÅTfÄÄS%S5d%§DåT×¥$GD¥Tätód%%TW5UTd%57…ETeDÄS%SuTdF´—5uTd%E7„eTddÄtä%t×5cd%g—„¥Td¤ód%%„¤DÄfÄ%S5Sd%e7„ÅTdÄÄdä%vÄ4ÄfÄ%f³uTdF$U5eTd%57…eTedÄdd%f3uTdF6´—5•Td%7—…ETg—…¥Te¤ÄWD%vD4Ätd%tSuETdF&µSu5TdE&§DeTätód%%S‡65T¤%D¤4ód%&„DÄed%S5%Td%%7…TeÄS%S55Td%57„ÅTdÄód%%FÄ4Ädd%V·5Sd%W—„åTdäód%'4ÄfÄ%S5%Td%%7†¥Tf¤Ätd%tW55Td%5GD%Uc%—…¥TdäÄdä%eW53d%7—…ETg—…¥Te¤ód%'„TÄed%V·5eTd%e7…%Te„ód%5¤4Äud%S‡53d%7—…¥Te¤ó%¤d4óÄ%“uTde7…%Td¤Ädä%d×5ETd%EGD%Tç—…¥TdäÄUd%UW5“d%——†…Tf„ÄVÄ%V³uTdfF´×5uTd%E7…ETedÄWD%W75Sd&T—5uTd%uGD%Tç5$7…eTd¤Äed%eW5UTd%g§D%Tç•—†…TdÄÄdä%vÄ4ÄfÄ%f·55Td%¥GDåTç•$GD¥Tätód%“u%TdeU7‡¥´d$æ´ÓuTg35¤TÄdd%TW55Td%7„¥Td$ód&D¤Äed%S5%Td%%7…eTedÄS%S5uTd%u7„¥Td¤ód%%†„DÄed%S6¤%wD4ÄWD%W76#¤%s”4ód%'TÄed%S5£¤%uW5ETd%7„ÅTd$Äs5Td$ÄS”%TW5Sd%7†å´d&—55Td%7„åTg5—…Td$Ädä%TW5#d$ÔT—5d%7„åTW…—…Td$ÄWD%vDDód%%„¤TÄdd%V·5£¤%vD4ÄS%SuTdFTT—5“d%UGE%TäôÄ…dUTädÄWD%TW5Sd%W—…ETeTÄS”%TW53d&T—5cdF&´—5“d%——„¥Td¤ó%4$4ód%%TW5•Td%G§D¥TåTód%%TW5eTd%E7…ETedÄdä%vÄ4ÄfÄ%f³uTddã×5eTd%E7†ÅTfÄÄS”%S‡5ETd%EGD%VG5—…eTdäÄtd%tW55Td%eGDåT×¥—…¥Te¤ÄVÄ%V·5•Td%•GDåTÓ5—…¥Te¤ÄVÄ%V·5•Td%•GDåTÓ5—…¥Te¤ÄVÄ%V·5•Td%•GD¥T×e§D%Ud$ÄfD%S‡5%Td%%7†¥Tf¤Ätä%t×5cd%g§DeTç5$GDeUe$Ä„ä5TS%§D%3”ÖFµ5UTd%7„¥Td$ÄVÄ%TSuTfåEV·5eTd%E7„eTddÄed%eW5ETd%E7…¥Te¤ÄVÄ%V³uTdfTT×5eTd%E7‡%´d&—53d%7—‡e´d&#“uTdFµ5eTd%E7†å´d%¥7„åTd$ÄWD%TW6%T¤%TW5Cd%7…ETd$ÄvD5Tg%—„¥Td$ÄS%w„4ÄS”%TW5Sd%7„…TWu—„ETd$ÄS%Dd4ÄS”%TW53d%£ÓuTdf6µ5UTd%57†å´d%£—5UTd%U7†å´d%£—5#d%7§D%T×e—†¥Te$ód%G6EU$%W53d%7…ETeDÄdä%e5Cd%7„ÅTg—……TçU—†¥Tf¤ÄVÄ%V³uETdF4T“uTde7†…TeóÄ%uTde7…%Td¤ÄvD5Tfå—„åTdäód%6„4Ätd%Sƒu5TdEdGD%Ud$Äed%S5¥Td%£—5Sd&T—5uTd%uGD%UgU$7…eTdäÄtd%tW5“d%—§D%Ug—……TeÄUd%UW5“d%——†¥Tf¤ÄfD%f3u%TdF$Uu%TdeU7‡¥´dFU“uTW¥F¤ätÄdd%TW55Td%GD%E$õ57…¥TädÄS%TW53d%7…TeÄdd%dd$ÄvÄETW%—‡E´d&%T—5%Td%%7„ÅTdÄÄTä%T×5d%—†…Tf„ÄS%SuTdDÓ—5•Td%U7„ÅTdÄÄdä%vÄ4Ätd%tW5ETd%EGD¥TçU$7„ETdDÄS%&µ5Cd%7…ETd$ÄVD%%W75d%7„åU¤ÔÄS”%TW53deg§DeUfÔód%“uTcEEtW5£ä%UV·63¤%%fsu%TdE&—ƒ5´d&C“u5TdFDT—5Cd%G—„ETdDÄdä%d×5Sd%W§D¥T×…—†ÅTfÄÄTä%T×5uTd%u7„¥Td¤ód%'„Dód%W65T¤%„d4óÄ%#T4ÄS”%S‡5d%—…ETeDÄdä%dÓu%TdDåT“u%TdE7‡´d&T“u5TdE¦—…TeÄTä%T×5Sd%W—…ETeDóÄ%¤d4Äud%uW5d%—…¥Te¤ÄVÄ%V³u5TdFT×5“d%——„ETdDÄ„ä5Tg¥—„¥Td¤óÄ%7DÄtd%tW5d%—†å´d%£—55Td%5GD¥Tç5—…eTedÄTä%T×4äT¤%E$4ÄVÄ%V³u5TdDÓ×5uTd%u7„ETdDÄs”5Tge—„¥Td¤ód%5¤Dód%“uTW…·755Td%E7‡d%F§D%4$57„¥TdäÄ7D5TdôÄS%vDdód%£“U$7…¥Te¤óÄ%'4óÄ%Su5TdEGDeTätÄVD%¥V3uTdE$7…ETdÄÄtd%tSuTdF$T—5Sd%7—…%Te$ód%$—5Sd%7—…ETeDód%&„4ód%%S‡5uTd%u7…%Tg¥§D%Tã%—…ETdÄÄfD%f75UTd%U7„ETdDÄdä%dÓuTfõ$…$DÄed%TSuTg$S5uTd%57„ÅTd$ÄWD%W74ÔT¤%Ww5Cd%7…ETd$ÄVD%E¤4ÄWD%W753d%7„åTedÄS%SuTdF4U5•Td%7—‡¥´d&3—53d%7—„ÅTdÄÄWD%W753d%7—…ETeDó%¤dTóÄ%—5d%§DeTä”ód%%S‡65T¤%D¤4ód%&„DÄdä%W75cd%g—…%Te$ÄTä%T×5Sd%W§D%†„VDT×5eTd%GD%†ÄUE7…¥Td¤ÄWD%TW53d%7—wu´d%D7…Td$Ädä%TW5#d$æ´—53d%7—„ÅTd$ÄS%eW5ETd%EGD%Tçu$7†…TdÄÄ„ä5Tg¥—„ÅTdÄÄWD%W755Td%5GDåT×¥§D¥TätÄTä%TÓu%TdE4GD%TätódDÓ$$ÄVÄ%S5ETd%E7„¥TedÄud%dSuTdÆF´—55Td%E7‡…d%F—„åTdå—‡ed$³u%Tg%$sTdÄfÄ%f³u5TdF´“u5TdEGD¥Tä$ód%—5#fÅ'§D%FDeD7…%Td$ÄVÄ%TSuTSE%V·5Sd%7—……Te„ód%&„4Ädä%W75UTd%UGD%Tæ”Ädä%W75Sd%W§D%Uf´Äed%S6T¤%vD4ÄWD%TW5Cd%G—…%Te%7‡ed&×6T¤%vÄ4ÄUd%USuETdFTU—5d%—„ETdDÄtd%tW5ETd%EGD%TçU—†ÅTe$Ädä%vÄ4Ätd%tW5ETd%EGDåTÓU§D¥TätÄS%6ää4ÄS”%TW5Sd%7„…VÇ5—„ETd$ód%%V÷5UTd%57‡´d&T—5ETd%EGD%Tãe—†¥Te$ód%G4ÔU$%W53d%7…ETeDÄdä%e5Cd%7„ÅTg—……TçU§DåTätód%%TW5cd%7—†¥Tf¤ÄTä%TÓu5TdFDT—5Cd%G§D%TäÔÄfD%W75“d%——„ETdDód%%„$4Äs”5Tf¤Ädd%dW5d%—‡´d&T“uTgU'¦ÄDÄfÄ%TdDód&#E$Ätä%S5cd%uTW5ETd%7…ETg—…¥Te¤ÄS%FD4ÄS”%TW5Sd%TW55Td$ôU5ETd%GD%Tæõ&—…¥Td¤ÄTä%T×5Sd%W§D%TæÄvÄ5Teód%uTde—‡´d&T—5uTd%u7„¥Td¤ód%%w„DÄtä%S5£¤%vD4Ädd%dW5Cd%G—„åTdäód%¤äDÄtä%S5¥Td%¥7…%Te$ÄS”%S‡5ETd%EGD%T×…—†¥TdäÄtä%t×5Cd%G—„åTdäÄUd%UW55Td%57†…Tf„ód%4$TÄtä%S5•Td%•7„åTdäÄS%S5%Td%%7„¥Td¤ÄfÄ%f³uTdfµ5•Td%7—…¥Te¤ÄWD%W3ueTdF4T—5ETd%EGEeTäôód%SueTdEGEeTä$ód%—5d%§DåTä”ÄTä%TÓu5TdE4GDeTätód%%S‡5uTd%u7…%Tg¥§D%Tã%—…ETdÄÄfÄ%f·5UTd%U7„ETdDÄtd%tSuTdF6´×5uTd%E7…ETedÄWD%W75Sd&T—5Sd%W—„¥Td¤ód%#TTÄed%V·5cd%g—…%Te„ód%6„4ó%“uTde7†…TeÄS”%S‡55Td%57„¥Td¤ÄWD%W75Sd%W—……Te„ÄUd%UW5¥Td%¥7„åTdäÄTä%TÓuTdFFµW5•Td%G—…TeÄVÄ%V·55Td%57„ÅTdÄÄdä%d×5eTd%e7„eTddÄud%uW5ETd%E7„ETdDóÄ%6„dÄTä%TÓu%TdE4GDeUeÄ„d5TW•§D%Tæõ—…ETdÄÄfÄ%f·5UTd%U7„ETdDÄtd%tSuTdF6´×5uTd%E7…ETedÄWD%W75Sd&T—5Sd%W—„¥Td¤ód%#TTÄed%V·5cd%g—…%Te„ód%6„4ó%“uTde7†…TeÄS”%S‡53d%7—…ETeDÄtd%tSuTdFV´×5•Td%G—…TeÄWD%W75Sd%W—…¥Te¤óÄ%¤dDÄTä%TÓu%TdE4GD%Tätód$ÕVÆ„ÄsETä¤Äs”5TW•$GDeTãE%7ƒ5´d&C“u5TdFDT“u5TdEGD¥Tä$óÄ%Su5TdEGD¥Tä$óÄ%Su5TdEGDeTätód%W65T¤%„d4ÄTä%T×5Cd%G—†ÅTfÄÄed%eSu%TdFDU6T¤%vÄ4óÄ%%“u5TdEGD¥Tä$óÄ%Su5TdEGD¥Tä$óÄ%Su%TdE&§D%Tätód&DT¤ÄÄVÄ%S6#ä%SCud¥ET7„¥TdäÄ†Ä5TcU—‡e´d%57„¥Td¤ÄTä%T×5Cd%G—…eTedÄTä%TÓuTdÆ&µ55Td%E7s%´d%F—„åTdå—s´d&3u%TcU×dÄVÄ%f75Cd%¥GD%UcE—……Teód%u%TdeG—…¥Te¤Ädd%s”4ód%4¤DÄdä%W75Sd%W§DeTæõ§DeUf„Äed%eW5ETd$Ö´“uTd%7……Td%6—…ETd$ÄS%TW5ETd%7†…Td$ód%&„TÄfD%W75Sd%W—ƒ´d&ET—5ETd%E7„ÅTdÄÄdd%dW55Td%5GD¥TÓU$7„ETd$ód%TSt÷§3t÷§DeS–¤Ädd%dW5ETd&uTd%7……Td%7…ETd$ÄS%TW5ETd%7†…Td$ód%5$dÄfÄ%S5cd%g—„åTdäÄWD%W75eTd%e7„¥Td¤ód%¤dDÄed%V·5eTd%eGD%TæÄud%SƒuETdEdGD%Ud$ÄfÄ%S5cd%g—„åTdäÄWD%W75eTd%e7„¥Td¤ód%¤dDÄed%V·5eTd%eGD%TæÄud%SƒuETdEdGD%Ud$Ätd%Sƒu5TdEd7„ETd$ód%TSu%Tde——…eTedÄS%wDTód%TW5cd%TW5Sd%7„åTd$ÄS%TW5•Td%GD%3”dåUW5eTd%7„¥Td$ód%£¤¤ÄfÄ%S5Cd%G—„ÅTdÄÄS”%SƒuTd†V´—5uTd%E7†¥Te¤ÄWD%TW53d%7—‡E´d%D7…Td$Ädä%TW5#d&5T—5UTd%U7…eTd$ÄS”%vD4ód%“”TÄed%V·5d%—……Te„ód%%5¥Td%G§DåTåTód%%TW5uTd%E7†…Te¤ÄWD%TW53d%7—†ÅTdÔÄS”%TW5Sd%7„…Tg%—…eTd$ód%4$DÄed%V·5d%—……Te„ód%%5¥Td%G§DåTåTód%%TW5uTd%E7†¥Tf¤Äed%eSuTdDõT—5eTd%57„ETdDÄ…d5Tc—„¥Td¤ÄfD%f75#d%'§D%TÓ—†å´d%U7„ÅTdÄÄE$UTS$7……Te„ÄVD%V3uTdFFµ—5¥Td%G§DåTåTód%%TW5uTd%E7‡e´d&#—5eTd%eGD%Tçu—…eTd¤ÄTä%T×6%T¤%s4ód%5$4Äud%SƒuETdEdGD%VD$ÄfÄ%S5£¤%vD4ÄVÄ%V·55Td%u7…TeÄS”%S‡6ET¤%…d4ÄTä%TÓuTdDåUW5uTd%E7wu´d$ÔT—6#¤%V·55Td&#ÓuTdfTUW5eTd%57‡%´d&—5eTd%e7„åTdäód%4$DÄud%S‡5UTd%U7‡%´d&—5ETd%E7„eTddÄdd%dW5d%—„ETdDÄS%S5£¤%vD4ÄS%SuTdDãW5“d%57‡e´d&#—5ETd%EGD%TÓ§EeTätód%%TW5“d%57„ETdDÄtä%t×55Td%57„¥Td¤ÄVD%V3uTdDåT—6#¤%dW53d%7—‡E$Td&%U55Td%57‡…d&5TÓuTdFV¶3ueTdE&§D%Ud$ÄwDETc5—„¥Td¤ÄS%S5£¤%vD4ód%4$TÄTä%TÓuETdE4GD%Ud$Äed%V·6¤%wD4Äed%eW5ETd%EGD%Tçu—†ÅTeÄdd%dW6¤%wD4ÄS%S5%Td%%7…%Te$ÄTä%T×5d%—„åTdäÄvD5Tfå—„åTdäód%¦DdÄtä%V·5“d%——„¥Td¤ÄVÄ%V·5#d%'§D%T×¥—‡e´d%UGF¥TäôÄ†ÄeTcU%7„¥Td¤óÄ%“”dód%SueTdE&§D%Ud$ÄwDETc5—„¥Td¤ÄS%S5£¤%vD4ód%4$TÄTä%TÓuETdE4GD%VD$ÄfÄ%S5eTd%e7„¥Td¤Ä„d5Tg…§D%VCe—…¥TdäÄdd%dSuUTdEv—„åTdäÄWD%W76C¤%†D4Ädd%dW5d%—„eTddÄVÄ%V·5d%G—…TS%´W5Sd%7„åTd$ÄTä%FD4ÄUd%TW5#d$æ´—5cd$ã—5d%—„åTdäÄvD5Tfå—„…Tdäód$ã³&—†¥Td%'—„ÅTd%%7„ÅTd$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TSuTSE5dW5£¤%S5•Td%•7„¥Td¤Ätä%t×55Td%5GD%Tãe—†ÅTdÄÄS%S55Td%57…eTedód%%‡4Ä„d5Te„ÄfÄ%fDtÄS%TW6T¤%vÄ4Ätd%w4ÄS”%Td$ÄS%E¤4ód%#TTÄ„d5Te„ÄvÄ5TfåµW5ETd%7‡´d&T—6¤%w4ÄS”%Td$ÄS%wDDód%¦DTÄ„d5Te„ÄwD5Tg—„ÅTd$ÄvÄ5Tg—‡E´d&´—5Cd%7„ÅTgE§D%T×e$7‡…´d%g—‡´d%£—53d%7‡´d&T—6¤%w4ÄS”%TW53d&ÓuTddã5cd%7„ÅTd$ÄvÄ5Tg—‡…´d&´—5Cd%7…ETd$ÄVD%sDÄdd%dW5d%G—…ETeED7…ETd$ÄS%TW5ETd%7†…Td$ód&DWU%7†å´d%V3uTc6ÅW5£¤%V·53d%7—…ETeDÄed%tW53d%7—…eTedÄdd%f3uTdFFµuuTdE&§D%Ud$ÄwD5TdäÄtd%t×5ETd%E7sE´d$ôT—5ETd%E7„ÅTdÄÄVÄ%V³uTdFFµW6¤%S6%T¤%s4ÄWD%W3uTd„õT—5£¤%W5d%—……Te„ó$ä%—5d%—†¥TäDÄS%S5UTd%U7…eTedÄ„d5Tg…—„ÅTÓ5—‡E´d&%T—5eTd%e7‡¥´d&3“uuTdFFµ5#dEGD%Tä$Ä„ä5Te$ó&D5TäôÄF„5TSE—‡´d&T—55Td%57s%´d$æ´—5£¤%vD4ó$ä%'„„ód%SuuTdE&§D%Ud$Ä…d5Te„ó$ä%55Td%57s%´d$æ´“u£¤%“”4ó&D5Tä$ÄS”%Sƒu£¤%5Sd%UTW5ETd%7„ÅTdÄÄfD%Ww5Cd%TW5ETd%¥GF¥Tãe—„ETdDóÄ%sueTdE&—„ETd$ÄTä%TSuTde7†¥Td¤ÄvÄ5Tg—‡¥´d&3—6T¤%vÄ4Ä…d5Tc§D%Ug&—‡%´d%E7†å´d&×5d%§D%Tãe—‡´d%7—„åTdäÄdä%d×5d%—……Te„ód%¦Ä4Äs”5TdäÄfD%f·5Cd%¥GD%Tç—‡%´d%57…eTedód%÷6#¤%V·5ETd%E7…%Te$Ädd%dW5#d%'§D%T×¥—†åd%——„ÅTdÄÄVD%V75UTd%UGFå´dFT×5Cd%G§D%TäÔÄvDETf¤ÄWD%W75UTd%UGFå´dDã“u“dE&§E¥TätÄTä%TÓuTde$7†…Td$ÄWD%TW6T¤%vÄ4Ä…d5Tg—…Td$Ädä%TW5#d&5T×5UTd%U7„ETeÄdä%dä”Ädä%TW5ETd%7„åTd$Ätd%TSuTdDÓ6#¤%S5uTd%u7†¥Tf¤ÄS”%S‡5d%—†…Tf„ód&4S%7‡e´d%V3uTg…Et×63¤%S6T¤%vD57„åTd$ÄWD%W75Cd%G—†…Tf„ÄVÄ%V·5UTd%U7„åTg•—…Td$Ädä%Td$ÄVÄ%†DDód%¦ÄTÄ…d5TeÄWD%W75•Td%•GF¥T×¥—„ETdDód%%U6C¤%eW5UTd%U7„ETdDÄtd%tSuTdDõT—4Ö´¤%f3v¤%55Td%57w%´d$³“v#¤%'Dó#”5Tä$ÄS%S53d%7§Ge´dEt7†…Tf„ÄVÄ%eW5•Td%E7„eTddÄed%eW53d%7—……Te„ó#”5Tãe$7†…Tf„ÄWD%W75uTd%u7„ETdDó'D5Tç—„ETdDó&D5Tä”ó$ä%—5d%§E¥Tä”ÄTä%TW5d%GD%Ud$Ätd%TW53d%7‡´d&T—4ÔT¤%w4ÄS”%TW5Sd%7„…Tc5—…%Te$ÄTä%S‡5Sd%Sw5Sd%7„åTd$ÄS%TW5•Td%GD%TÓU$7‡e´d%E7…¥Te¤Ätä%t×5Cd%G—„ETdDÄtd%tSuTcF×dÄs”5Td%'§D%…dõ——‡¥´d%E7‡´d%£¤$ÄS%TW53d%7—…TeÄtd%tW55Td%57…%Te$ÄS%„¤DÄS”%TW5Sd%TW55Td&CÓuTdDõU6ET¤%S‡53d%7—†…Tf„ó$ä%¤ä4ÄTä%TÓuTde$7ƒ5´d%e7…%Te$ÄTä%T×5•Td%•GD%DäôåT×6#¤%Td$ÄWD%Tddód$äSV¤ÄD¤5Te„ó'D5TåTÄVÄ%V·6ä%wDDó#”5Tçu§Ge´dE7…%Te$ÄVÄ%eW5¥Td%U7„eTddÄfD%edtÄS%TW53d%7—……TdÔÄS”%Td$ÄS%uW5d%—„…TdÄÄTä%V75d%§Ge´dDÃ5Cd%G—„¥TedÄud%dW5%Td%%7……Tee%7„åTd$ÄWD%W75eTd%D7…Td%7„åTf¤ÄTä%T×5#d%7—„ETd„ÄTä%TÓv¤%“”TÄTä%TÓu£¤%su“dE&—„ETdDóÄ%w5d%7„ETd$ód%“uTde7‡%´d%U7‡E´d&%T—5eTd%eGE%Tã%—„ETd$ÄTä%TÓuETdE4GD%Ud$Ätd%Sƒu5TdEd7„ETd$ód%TSu%Tde——…eTedÄS%wDTód%TW5cd%Ww5Sd%7„åTd$ÄS%TW5•Td%GD%FÅåUW5eTd%GD%7E57…¥TdäÄS”%S‡53d%7—…Teód%#74ÄfÄ%S5eTd%W—„ÅTd$ÄWD%W75¥Td%D7…Td$Ädä%TW5#d&T“uTdFT×5eTd%57„ETdDÄdd%dSuTdEt7†ÅTeó%uTde7…¥TdäÄs5TgE—…Teód%&„DÄed%V·5d%—‡%´d&“uTdF6´—5¥Td%G§DåTåTód%%TW5uTd%E7…eTedÄVÄ%V·65T¤%„d4ód%%‡DÄfÄ%S6UT¤%†Ä4ÄvÄ5Tg§D%Tæõ$7…eTd¤ÄTä%T×6C¤%†D4ód%¤ä4Äud%SƒuETdEdGD%Ud$ÄfÄ%S6#¤%s”4Äs”5Td¤ÄVÄ%f³uTddÕT×5uTd%E7…%Te$ód%÷6ET¤%…d4ÄVÄ%V·5d%G—†å´d%£¤$Ädä%TW5ETd%7„åTd$Ätd%TSuTcU†„TÄtä%Td„ód&Ede$ÄvD5TdäÄud%uW5uTd%uGD%Tç—†å´d%E7†ÅTä”ÄvD5Tfå—…%Te%—s´d$ÔT—6¤%wD4ÄfÄ%f·53d%EGD%Tãe&—†å´d%E7…TeÄvD5Td$ÄS”%TW5¥Td%£—5uTd%uGD%Uce—†¥Td¤Ädd%dW5ETd%EGD%Tæõ—‡e´d%U7„ÅTdÄÄD¤uTW•&§D%TãE'§EeTätód%#W5“d%57‡%´d&—55Td%57„¥Td¤ÄVD%V3uTdDÃ—6#¤%dSu“dEF—‡E$Td&%U5uTd%uGE¥Tç%GD%Tä$ód%“uTde7s´d&—55Td%57„¥Td¤ód%%Dd4ÄvD5TdäÄtd%tW55Td%57†¥Tf¤ÄVÄ%V³uTdFV´×5¥Td%7—„åTdäÄVÄ%V·5eTd%eGD%Uce—‡…´d%g—…¥Te…$7„åTd$ÄfÄ%f·5•Td%v—…Td%7„åTc5§D%V³U—†¥Td¤ÄfÄ%f·5Cd%G§D%Tç•—ƒ5´d%u7„åTdäÄdd%dW5d%G—…ETeE47…ETd$ÄS%TW5ETd%7†…Td$ód&&Äçu$7‡%´d%V3uTgeS·6¤%V·53d%7—…ETeDÄed%tW53d%7—…eTedÄdd%f3uTdFFµu“dE&§D%Ud$Äs”5TdäÄvÄ5TW•—„ETdDód%'„DÄud%Td$ÄS%TW53d%7—…eTdÔÄS”%TW5Sd%TW55Td%u7…%Te$ÄTä%T×5ETd%E7„åTdäód%“”4Äs”5Td¤ÄWD%W75Sd%W—„ÅTdÄÄS%SuTdDÓ—6Tä%uW53d%7—„ETdDó&D5Tã%§F¥TätÄTä%TSuTde7‡%´d%57†ÅTfÄÄfD%f75#d%'§D%T×e—ƒ5´d%UGG%´dEF—sE´d$ôT—5uTd%u7„¥Td¤ÄvÄUTg$7„ÅTdÄÄVÄ%V³u£¤%¤d„ód%Su“dE&§D%Ud$Äs”5TdäÄs5TgE—„ÅTdÄód%%FÄ4Äs”5TdäÄdd%dSu£¤%÷5¥Td%¥7„¥Td¤ÄTä%S‡5“d%“w5Sd%7„åTd$ÄS%TW5•Td%GD%‡VDU63¤%Td„ód$Ôe&å—ƒ5´d%E7†…Tf¤ÄS%S4ôT¤%F„4ÄS%S5Sd%W§D%VC%%7‡¥´dE%7„ETdDÄfD%f3v#¤%—5d%—†¥TäDÄS%S5UTd%U7…eTedÄ„d5Tg…—„ÅTÓ5—‡E´d&%T—5eTd%e7‡¥´d&3“v¤%5¤TÄVD%SuTdE7s´d%UGG¥´dEF—sE´d$ôT—5uTd%u7„¥Td¤Ä„ä5Tg¥—†å´d%£“v#¤%5$tód%Sv¤%“uTde7s%´d%g§Ge´dEd7„¥Td¤ÄE¤5TS%§G¥´dDÃ“v3¤%W5Cd%G§G¥´dET7…%Te$Ädä%dd$ÄS%TW53d%7—……TdÔÄS”%Td$ÄS%uStó#”5Tç—„ETdDó'D5Tä”ó&D5TätÄTä%TW5d%§F¥Tä”óÄ%—5d%7„ETdDód%suTd…7†å´d%E7‡´d&T—5uTd%uGD%TçU—†¥Td¤ÄwD5Tg%—†ÅTfÄÄfD%f75#d%'§D%Tç$7w•´d%¥7…%Te$ÄTä%T×6¤%wD4ód%6„DÄwD5TädÄtä%t×6T¤%vÄ4Äed%“”4Ätä%t×6T¤%vÄ4Äed%“”4Ätä%t×5£¤%vD4Ädd%¦Ä4ód%Su“dE&§D%dä$Äs”5TdäÄfÄ%F„4ÄTä%TÓuTdF6´×6%T¤%W75ETd%E7…ETeDÄTä%T×5cd%g§D%TÓU—‡e´d%7—…TfÄÄed%eSuTdDåT—6C¤%S5cd$³×5Cd%¥GD%Tçu%7‡¥´d%57„åTdäÄdd%dW5UTd%U7„…Td„ód%¤ä4ÄF„5Tedó4ä5Tå4ÄVD%V75Sd%W§C5´dEf—„ETdDÄdä%W55Td%57…ETeDÄtä%t×5£¤%¤d4ÄVÄ%V·5Sd%W—†¥Tf¤Äud%vD4ÄvÄ5TÓ5—…eTedÄdd%dW5#d%'—„åTdäó4ä5T×e§Ge´dE&§G%´dE&—……Te„Ädä%d×5Sd%W—†¥Tf¤ÄvD5Tfå—…eTedÄdd%dW5UTd%U7„åTdäÄVÄ%V³uTdDã—4ôT¤%eW53d%7—…%Te$ó'D5Tãe§Få´dE&§F¥TätÄTä%TÓuTde$7‡e´d%E7ƒ´d&ET—5“d%—§D%T×¥—ƒ5´d%e7…%Te$ÄTä%T×5•Td%•GD%USU—‡e´d%57ƒU´d&UT—5¥Td%¥GD%T×…—ƒ5´d%E7…%Te$ÄVÄ%eW5¥Td%U7†¥Tf¤ÄfÄ%tW5d%—„…Td„Ätä%t×5uTd%•7„ETdDÄTä%TÓuTdDåU—6C¤%S5Sd%W—„¥TedÄud%dW5“d%——…¥Tf„ÄTä%T×5#d%'—†¥Tf¤ÄfÄ%tW5d%—„ETdDód%%FDtÄ†Ä5TeÄVÄ%V·55Td%E7…TeÄVÄ%V·5ETd%EGD%Ug5—s%´d%g§Ge´dEd7„¥Td¤ÄwDETg%§G¥´dF4TÓv3¤%Sv3¤%Sv#¤%—5d%§G%´dE4GD%Ud$ó&D5Tätód%#W63¤%S6#¤%s”4ÄE¤5TS%—‡e´d&#“uTdDÓW6#¤%V·6%T¤%s4ód%4¤4ÄE¤5Te„ó#”5TåTÄVÄ%V·4³¤%7D4ó4ä5Tç§G¥´dE7„åTdäó4ä5TäôÄtd%tW55Td%e7†…TdäÄUd%UW5eTd%e7†¥Tf¤ÄfD%f³v3¤%#TdÄtd%tW5“d%——…¥Tf„ÄTä%TÓv#¤%¤äDÄTä%TÓv¤%suTdeGFå´dE&§D%Ud$Ä†D5Te$ÄWD%W76ET¤%…d4Äs5TgE§F¥Tãe$7„ETdDóÄ%w5d%§EeTä”ód%%TW6¤%dW6%T¤%s4Äed%eSuUTdFF´×5d%7„ETdDó%suTde7†…TeóÄ%5d%GDeTd$ód%“uTguvÔW4Ö´¤%·6#¤%D$tód%“”„ÄVD%V3u%TdE47„…Td„ód%w5#d%'§DeTä”ÄVD%V3u%TdE47„…Td„ód%w5Cd%G§DeTåÄWD%W3u%TdED7…Teód%5UTd%UGDeTå4ÄWD%W3u%TdED7…%Te$ód%—5eTd%eGDeTåtÄed%eSu%TdEf—……Te„÷§DeUe”Ädä%dÓtód%%e5Sd%W§DeTåTÄdä%dÓuTdEtGD%„¤57—„¥TdäÄE$5TdôóeF4T¤$ÄVÄ%S4äT¤%E$4ód%5¤DÄS%Su%TdEF—…Teód%5Cd%G§D%TåTódE&³‡55Td%E7‡%´d%F—„åTdå'—‡´d%¥G3t÷§3t÷§DevDF&´—5uTd%u7…eTc—‡´d&UuTe”Ó—5Sd%U7ƒ5´d&C¤$ÄvÄ5TfÄód%“”DÄdä%dW6C¤%†D57‡´d%¥GD%UWe—…ETe$Ä„d5Tg…§D%d×¥—…ETdÄÄfD%f3uTdFT—5Sd%7—‡%´d&“u%TdFV´“t÷§3t÷§3u%Te%G—„ÅTdÄÄdd%F„4ód%6„DÄdd%V·53d%7—†…Tf„ÄS”%S‡5eTd%eGD%Tç•—…¥TdäÄVÄ%V·5ETd%E7ƒ5$Td&Cu5TdDÕUSuTde7…ETdÄÄwD5Tg%—…TeÄvD5Tfå—„¥Td¤ÄTä%T×5£¤%vD4ó%'dÄdd%dW5cd%g—…TeÄS”%SƒuETdF´×5ETd%E7……Te„óÄ%#T4ÄUd%USuTde&—……Teód%t÷§3tód%ES‡5UTd&C“uTdDã—5cd%G—„¥Td¥7‡´d%¥7„ÅTdÄÄed%eW53d%7—†ÅTfÄÄUd%UW53d%7—„¥Td¤ód%¤dd÷§3t÷§3t÷§3tód%cW55Td%g—ƒ´d$³“uTdFTT×5cd%G—„ÅTdÄód%%t÷§3t÷§3t÷§3u%Te…7„¥Te„Ä…d5TW%§D%TãE—……TeÄWD%W3u%TdE¤G3t÷§3t÷§3t÷§3t÷§DetåÄS%Su5TdEt7ƒ´d&ET¤$ÄvÄ5TfÄóÄ%5$DÄ…d5Tc´W6T¤%uSu%TdFTT×55Td%57„ETdDÄVD%dÓuTdEv—…%Td¤ÄWD%W76#¤%s”4ód%¤ä4óÄ%“uTdE7…ETdÄÄ†D5Tc5§D%TÓ5—…ETdÄÄ†D5Tc5§D%US5—…ETdÄÄvD5Tfå—…%Te$ÄTä%T×5Sd%W§D%Tç•—……TdÄÄS”%S‡5UTd%U7„ETdDÄdä%dÓuTdDåT—5uTd%57„ÅTdÄÄdä%d×6%T¤%s4ód%#TDÄud%W75Cd%G—„¥Td¤ÄWD%W765T¤%„d4ód%¤dDÄud%W75Sd%W—„ETdDÄed%eW5ETd%E7…TeÄVÄ%V·53d%7—‡…´d&5T—5d%§E%Tã%%7……Te„ÄWD%W75Sd%W—‡E´d&%T“uTdDÕT×5¥Td%7—…TeÄVÄ%V·53d%7—‡…´d&5T“uTdDÕT×5¥Td%7—…ETeDÄTä%T×5eTd%e7„åTdäÄS”%S‡55Td%57„ÅTdÄÄ„d5Tg…—„ETdDód%5¤dÄfD%f753d%7—…ETeDÄdd%dSuTdDÃ—5¥Td%7—‡…´d&5T—55Td%5GE%Tæõ§DåTätÄTä%TÓu5TdE47„ETdDód%%U5Sd%7—‡…´d&5T“u%TdDåT“u%TdeU7‡%´d&—5cd&5T—53d&T—5cd&ET—5Sd$Ö´“uTdFVw5UTd%57…%Te$ód%÷5UTd%57…TeÄdd%dW55Td%57…ETeDÄVD%V3uTdF´×5¥Td%W—„¥Td¤ÄVD%V755Td%57…eTedÄdd%dW53d%7—„…Td„ód%¥dDÄtä%S55Td%57…eTedÄTä%TÓuTdF6´—5“d%E7„¥Td¤Äed%eW55Td%57„ETdDód%74Ätä%S55Td%57…eTedÄVÄ%V·5d%§D%Tãe—†¥TdäÄS%S55Td%57„ETdDód%'4Ätä%S5UTd%U7…eTedÄTä%TÓuTdfV´—5uTd%57„¥Td¤ÄTä%T×55Td%57„ÅTdÄÄdd%dW5Sd%W—„åTdäÄTä%T×5d%—„eTd„ód%¦ÄDÄfÄ%V·55Td%57„ETdDÄVÄ%V·53d%7—…%Te$Ädä%d×5ETd%E7„ETdDÄTä%T×5%Td%'§D%TÓU—…¥Td¤ÄVÄ%V·5d%—„¥Td¤ÄWD%W75UTd%U7…ETeDÄS%S5d%—„ETdDÄUd%V3uTdDõT×5uTd%57„¥Td¤ÄTä%T×55Td%57„ÅTdÄÄdd%dW5Sd%W—„åTdäÄTä%T×5d%—„eTd„ód%%FÄDÄtä%S5ETd%E7„¥Td¤ÄTä%TÓuTdF´—5“d%E7…%Te$Äed%eW5d%§D%Tãe—…¥Td¤ÄVÄ%V·5d%—„¥Td¤ÄWD%W75UTd%U7…ETeDÄS%S5d%—„ETdDÄUd%V3uTdDõT×5uTd%57„¥Td¤ÄTä%T×55Td%57„ÅTdÄÄdd%dW5Sd%W—„åTdäÄTä%T×5d%—„eTd„ód%¦ÄDÄfÄ%V·55Td%57„ETdDÄVÄ%V·53d%7—…%Te$Ädä%d×5ETd%E7„ETdDÄTä%T×5%Td%'§D%TÓU—…¥Td¤ÄVÄ%V·5d%—„¥Td¤ÄWD%W75UTd%U7…ETeDÄS%S5d%—„ETdDÄUd%V3uTddõT×5“d%E7„åTdäÄVÄ%V·5d%§D%Tç—†¥TdäÄdd%dW5eTd%e7„ETdDód%74ÄfÄ%V·55Td%57„ETdDÄVÄ%V·53d%7—…%Te$Ädä%d×5ETd%E7„ETdDÄTä%T×5%Td%'§D%TÓU—…¥Td¤ÄVÄ%V·5d%—„¥Td¤ÄWD%W75UTd%U7…ETeDÄS%S5d%—„ETdDÄUd%V3uTdDõT×5uTd%57„¥Td¤ÄTä%T×55Td%57„ÅTdÄÄdd%dW5Sd%W—„åTdäÄTä%T×5d%—„eTd„ód%¦ÄDÄfÄ%V·55Td%57„ETdDÄVÄ%V·53d%7—…%Te$Ädä%d×5ETd%E7„ETdDÄTä%T×5%Td%'§D%USU—‡%´d%e7…TeÄVÄ%V³uTdF6´—6¤%eW5Cd%G—„¥Td¤ód%4¤4ÄwD5TedÄS”%S‡55Td%5GDåTã%§D¥Tätód%W5cd%G§DeTåTód%%dW6¤%wD4ÄWD%†D4Äs5Tfå$GD%Tæõ'—…eTdäÄS%S55Td%e7‡E´d%u7„¥Td¤Ädä%d×5ETd%E7„…Td„ÄVÄ%V·5UTd%UGD%Tçu%7…%Td¤ÄS”%S‡5#d%'—„¥Td¤ÄVÄ%V³uTdFDT—5UTd%57†å´d%£—55Td%5GD%TãE—…%Td¤ÄS”%S‡55Td%57„ÅTdÄÄ„d5Tg…§D%Uce—…eTdäÄfD%f755Td%5GD%Ug•—…eTdäÄvD5Tfå—…ETeDÄtd%tW5cd%g§D%Tã%$7…eTdäÄ„d5Tg…—ƒU´d$³—4Ö´¤%s”4ÄTä%T×55Td%57†¥Tf¤ód%'„Äed%S5uTd%u7„ETdDód%#T4Ätd%d×55Td%57„…Td„ÄVÄ%V·6%T¤%s4Ädd%dW53d%7—„…Td„ód%4¤TÄvD5TedÄWD%W3uUTdE–—‡E´d&%T—5d%§E%Tçu—‡E´d&%T—55Td%57„ETdDód%6„4Äs5TgE—„¥Td¤ÄTä%TÓuUTdFTT—6%T¤%s4ÄVÄ%V·5d%§DåT×…—„ETdDóÄ%suTde7…eTdäÄvÄ5Tg—…ETeDÄtd%tW5uTd%uGD%Tãe$7…eTdäÄ„ä5Tg¥—wu´d%£×4Ö´¤%s”4ÄTä%T×55Td%57†ÅTfÄód%4$„Äed%S5•Td%•7„ETdDód%4$4Ätd%d×55Td%57„…Td„ÄVÄ%V·6#¤%s”4Ädd%dW53d%7—„…Td„ód%5$TÄvÄ5Te„ÄWD%W3uUTdE¤7‡e´d&#—5d%§E%Tç•—‡e´d&#—55Td%57„ETdDód%74Äs”5Tge—„¥Td¤ÄTä%TÓuUTdFV´—6#¤%s”4ÄVÄ%V·5d%§DåT×¥—„ETdDóÄ%suTde7…eTdäÄdd%dW5Sd%W—…ETeDód%&„DÄdd%V·5d%—…Teód%—5uTd%E7„¥Td¤ÄS%S4Ö´ä%D¤DóÄ%¦DTód%W5eTd%E7†ÅTfÄÄS%S53d%7—„åTdäÄWD%W3uTddÓ×5eTd%E7…%Te$ÄWD%W76¤%wD4Ätä%t×5uTd%u7……Te„ÄvÄ5Tg§D%T×¥&—…eTdäÄtä%†D4ÄTä%TÓuTdDÃ—5•Td%W—„¥Td¤ÄVD%V755Td%57…TeÄWD%W3uTdDõT—6¤%f·5d%—„¥Td¤Ätd%tW5d%§D¥Tç§D%Tä$Ätd%d×5Sd%W—……Te„ód%'¦D4Ädd%V·55Td%57†å´d%£“uTdFDT—5eTd%57‡´d&T—55Td%5GD¥T×¥§D%Tä$Ädd%V·53d%7—„¥TedÄvD5TeDÄVÄ%V·5Sd%W—…TeÄVÄ%V·5Sd%W—…¥Te¤ÄVD%V755Td%e7†ÅTe$ÄTä%TÓuTdDÃ—5cd%G§DeTåTód%%dW6%Tä%sDÄdd%†D4ÄS%7D4ód%&„„Äed%S6%T¤%E¤4ÄTä%TÓuTdF4T×5Sd%7—…ETeDÄS%S5UTd%U7„ETdDÄS%S5eTd%eGD%T×¥—…eTd¤ÄWD%W75¥Td%¥7„¥Td¤ÄUd%V76¤%vÄ4ÄWD%W753d%7§D¥TÓ$7„ETdDód%#5UTd%57„ETdDÄvÄ5Tg—…%Te$ód%¥d4ÄfD%W75Cd%G—…TeÄWD%W765T¤%„d4ód%¦DDÄfD%W75Cd%G—…TeÄWD%W765T¤%„d4ód%¦DDóÄ%“uTdE7…ETdÄÄS”%S‡55Td%57„ÅTdÄÄ„d5Tg…§D%T×…—…eTdäÄed%eW53d%7—‡%´d&—5ETd%E7†å´d%£“uTdDã5cd%G—„¥Td¤ÄS”%Sƒu%TdF4T“u%TdeU7‡…´d&5T—5ETd$äT“uTdFFµ5UTd%57„ÅTdÄÄdä%d×5Sd%W§D%Tãe—……TdÄÄS”%S‡55Td%57„ÅTdÄÄ„d5Tg…§D%T×…—…eTd¤ÄWD%W75¥Td%¥7„¥Td¤ÄVD%V3uTdDã—5•Td%7—…ETeDÄTä%T×5eTd%e7„åTdäÄS”%S‡55Td%57„ÅTdÄÄ„d5Tg…—„ETdDó%5¤dÄS”%SƒuTdED7†¥TdäÄdä%d×55Td%e7†…Tdäód%“”4Äud%S‡5Cd%G—†…Tf„ÄWD%W755Td%5GD%Tçu—†ÅTeÄS”%S‡55Td%57„ÅTdÄÄ„d5Tg…§D%TÓ—†…TdÄÄS”%dW55Td%57„åTdäód%5¤4Ätd%W75SdE&—…TeÄTä%T×5eTd%e7„åTdäÄdä%d×5•Td%•7„eTÓU—…%Te$ÄTä%T×5eTd%eGD%Tç5—†å´d%E7†¥Tf¤ód%4$4Äud%W76%Tä%sDÄdd%dW5cd%g§E%TÓ5$7„ETdDó%su5TdE&—……Te„ÄWD%W75Sd%W—†ÅTfÄód%5$DÄfÄ%S5“d%—§D%Tçu—……TdÄÄsETgE—„ÅTdÄÄdd%d×5cd%g§D¥TçU%7…Teód%w5eTd%57„ÅTdÄÄud%uW55Td%57„…Td„ód%¦D4Ätd%W75Cd%G—„¥Td¤ÄWD%W765T¤%„d4ód%¤dDÄtd%W75Sd%W—„ETdDÄed%eW5ETd%E7…TeÄVÄ%V·53d%7—‡…´d&5T—5d%§DåTã%%GD¥Tätód%“u%TdeU7†ÅTfÄÄS%7D4ód%4$TÄdd%V·5Sd%W—„ÅTdÄÄdä%d×5¥Td%¥7„åTdäÄVD%V3uTdFµ5•Td%G§D¥TåTÄfD%f75d%—„ÅTdÄÄdd%dSuTdFF´—5•Td%G§D¥TåTÄS”%SƒuTdED7†…TeÄWD%W75¥Td%¥7„ÅTdÄÄS%Su5TdFTTÓu%TdE&§D%Tätód&Ä¦„ÄvD5S¤ÄvÄETg§D%SC5—†å´f…u7‡d&TÓuTf–&µ55Td%E7‡´d%F§D%åÄVÄ%SDÄD$5TcU—‡e´d%57„¥Td¤ÄTä%T×5Cd%G—…eTedÄTä%TÓuTdÆ&µ55Td%E7s%´d%F—„åTS%$GDeVG5%7„¥Te„ÄS”%uSuTdfTT—5cd%G§DeTåTód%%S‡5uTd%u7…%Tge§D%Tç•—…ETdÄÄdä%dÓu%TdFT“u%Tde•7…eTedÄS%D¤4ód%TW5cd%d5Sd%7„åTd$ÄS%TW5•Td%GD%Tæõ$7…¥TdäÄtä%t×53d%7—…ETeDód%5w„DÄed%V·5£¤%vD4ÄS%SuTdFTT“uETdE&—……Te„ÄvD5Tfå—…%Te„ód%4$DÄtä%S55Td%5GEeTå4ód%“uETdE&§D%Ud$ÄfD%W75Sd%W—‡´d&T—5ETd%E7„ÅTdÄÄdd%dW5ETd%E7……Te„óÄ%4¤dÄTä%TSu%Td%G3t÷§3t÷§Dedæ¤Ädd%dW5ETd%u7…eTSE$GD%Td$ÄfD%Td$Ädä%TW5ETd%7„åTd$Ätd%TSuTdDõU—5eTd%57…¥Te¤ÄS%SuTdF4T—5¥Td%G§DåTåTód%%TW5uTd%E7……Te„ÄS%S53d%7—…eTedÄS%S5UTd%UGD%Tçu$7…eTd¤Äed%eSuTdEv—†ÅTeó%uTde7…¥TdäÄfD%f75ETd%E7„ÅTdÄÄed%eW5ETd%E7…%Te$ód%4$TÄed%V·5eTd%eGD%TæÄud%SƒuETdEdGD%Ud$Ätd%Sƒu5TdEd7„ETd$ód%TSu%Tde——…eTedÄS%f·5eTd&EUuTd%7……Td%7…ETd$ÄS%TW5ETd%7†…Td$ód&FµS5&—…eTd$ÄVÄ%TSuTc5%V·5uTd%E7…TeÄWD%W75Cd%G§D%VCe—…¥TdäÄtä%f·53d%7„ÅTdÄÄs5TdÔÄS”%TW5Sd%7„…Tg…—…%Te$Äed%TW5Cd%£“uTdDÃ5eTd%57„ETdDÄfD%f3uTdE¤7†ÅTeó%uTde7…¥TdäÄtd%f·53d%7„ÅTdÄÄud%Ww5Cd%7…ETd$ÄVD%wD4Äed%TSuTdF4T×5eTd%57„ETdDÄfD%f3uTdE¤7†ÅTeó%uTde7…¥TdäÄtä%t×5eTd%eGD%TÓU—…eTd¤ÄTä%TåÄ†D5Tc—„¥Td¤ÄfD%f75#d%'§D%TÓ—†å´d%U7„ÅTdÄÄE¤UTS%$7……Te„ÄVD%V3uTdFTU—5¥Td%G§DåTåTód%%TW5uTd%E7‡e´d&#—5eTd%eGD%Ugu—…¥TdäÄwD5Tg%$7„ETdDód%7TÄfÄ%S6#¤%s”4ÄS%S4³¤%7D4ÄVÄ%V³uTdF&µW5uTd%E7„ÅTdÄÄwD5Tg%—…%Te$ÄTä%T×5%Td%%7…%Te$ÄTä%T×5d%—……Te„Äed%eW5ETd%EGD%3”vµ—5uTd%V÷53d%USuTfå#5“d%E7†¥Tf…&—„åTd$Ä„d5Td$ÄS”%TW5Sd%7‡%´d&%T—6#¤%sT4ÄS”%TW5Sd%TW55Td&#×53d%7—„ETdDÄS%S5%Td%%7…ETeDÄdä%TSuTddõUW6C¤%vD4ÄWD%W3ueTdF&´—5UTd%UGEeTå4ÄS”%SdÄS%TW5“d%7…Td$Ädä%TW5cd%u7…ETfÄS”%Td$ÄS%s”4ód%¥d4ÄTä%TÓuETdE47„ETdDód%%U5•Td%G—„¥Td¤Äud%uW5eTd%e7†ÅTfÄóÄ%4¤TÄTä%TSu%Td%GDeUf¤Äed%eW5ETd%u7…eTc$GD%Td$ÄfD%TdÔÄdä%TW5ETd%7„åTd$Ätd%TSuTW¥'¦DtÄed%TSuTS#·5uTd%E7…TeÄWD%W75Cd%G§D%Uce—…¥TdäÄed%d×53d%7„ÅTdÄÄud%Ww5Cd%7…ETd$ÄVD%vÄ4ód%&„DÄed%V·5d%—…%Te$ód%w5¥Td%G§DåTåTód%%TW5uTd%E7‡e´d&%U5Cd%G§D%Tæõ%7…eTd¤ÄTä%T×6%T¤%s4ód%5$4Äud%SƒuETdEdGD%Ud$ÄfÄ%S6¤%wDTÄTä%TÓuTdFVµ5uTd%E7‡e´d&#—5ETd%E7w%´d$³—55Td%5GD%UgU%7…¥TdäÄWD%W76¤%wD4Ädd%dW5d%—„eTddÄdd%dW5d%—„ETdDÄfD%f75eTd%e7„åTdäód%¤ädÄtä%S5•Td%•7„ÅTdÄÄS%S‡5Sd%W§D%UcE—†¥TdäÄS”%S‡6¤%wD4ÄwD5T×¥—‡%´d&—5£¤%vD4ÄWD%W75d%—„åTdäÄUd%UW5Sd%W—……Te„ÄVÄ%V·55TdFTUSuTde6—ƒ5´d%£—53d%7§EeTçU—…%Te$ód%—5ETd%E7„ÅTdÄÄ…d5Tc—…%Td$ÄS”%TW5Sd%7„ÅTdäÄud%uSuUTdFVµ5d%§DåTä”ÄTä%TÓuTde$7†…TeÄVÄ%V·5¥Td%¥7…eTedÄud%uSu5TdF6µ5d%GDeTd$ód%%dW6ET¤%…d4ÄS%E$Tód%7tÄdd%V·5Sd%W—‡E´d&%T“uTdDõT—5•Td%G§D¥TåTÄfD%f75Sd%W—‡E´d&%T“uTdF6´×5•Td%G§D¥TåTÄfD%f75Sd%W—…%Te$ód%¤d4Ätd%Sƒu5TdEd7…Teód%#w5•Td%G§D¥TåTód%“uTdE&§D%5$µG—„¥TdäÄsETgE§DeTÓU—„åTdäód%G5ETd%EGDeTäôÄvÄ5Tg§DeTç—‡´d&T“uTdF&´“uTä•7„¥TdäÄS”%S‡55Td%e7†ÅTe$ód%“”4ÄVÄ%S5Cd%G—„¥TedÄud%dSuTdDÃ—55Td%E7…ETeDÄVÄ%eW6¤%f3uTddã—55Td%E7‡e´d%F—†¥Tg¥—†…Tdäód%5DdDÄfÄ%f·5eTd&ET“uTdFTT×5eTd%EGD%UdôÄdä%W75“d%—§D%UgU—…ETdÄÄud%uW6#¤%V·55Td%5GD%US—……TeÄS”%S‡5Sd%W—…eTedÄUd%UW5UTd%U7„ETdDÄdä%dÓuTdF&µ5uTd%E7…ETeDÄVÄ%eW6¤%f75d%'§D%Uc%—†…TeÄs5TgE§D%Uce—†…TeÄdä%E$4ÄfÄ%f³uTdDÃ×5•Td%G—…ETS—†…Tf„ód%%wTÄfD%W755Td%57„åTdäód%%u—5cd%7—†…Tf„ÄVÄ%V·5ETd%E7„åTdäóÄ%4$DÄTä%TÓu%TdE4GDeUeÄed%vD4ód%4¤4Äed%S53d%7—„ÅTdÄÄtd%tW5Cd%G—„ETdDÄUd%UW5UTd%U7„ETdDÄdä%dÓuTdFFµ5cd%7—…ETeDÄdd%dSuTdF6´—5cd%7—…ETS—…%Te$óÄ%¥dDÄTä%TÓu%TdE4GDeUeÄwD5Tg%—…Tg¥§D%TÓ5—…eTdäÄWD%W753d%7—†…Tf„Ädd%dW5d%—„eTddÄdd%dW5d%—„ETdDÄS%S55Td%57„åTdäód%&„dÄfD%W753d%7—‡%´d&—5ETd%E7„ÅTdÄód%%…¤DÄfD%W753d%7—…¥Te¤Äed%eW5ETd%E7…%Te$ÄVÄ%V³uTdf$U5uTd%E7…%Te$ÄWD%W755Td%57„ÅTdÄÄWD%W75#d%'—„eTddÄS”%S‡55Td%5GD%Tç$7……TdÄÄS”%S‡53d%7—„ÅTdÄÄWD%W75cd%g—„eTddÄS%S53d%7§D¥Tç•$7„ETdDód%%U5eTd%E7‡%´d&—53d%7§DeT×e§D%TätódDãåÄVÄ%S6%T¤%…dDód%'„Tód%Su%TdEGDeTä$ód%Su%TdeGDeTä$ód%Su%TdEGDeUd$ód%Su%TdEGDeTä$ód%%TSu%TdEGDeTä$ód%Su%TdeGDeTä$ód%Su%TdEGDeUd$ód%Su%TdEGDeTä$ód%%TSu%TdEGDeTä$ód%Su%TdEGDeTä$ód%Su%TdEGDeTä$ód%Su%TdEGDeTä$ód%Su%TdEGDeTä$ód%%TSu%TdEGDeTä$ód%Su%TdEGDeTä$ód%Su%TdEGDeTä$ód%Su%TdEGDeTä$ód%Su%TdEGDeTä$ód%“uT×e$S‡55Td%E7‡E´d&%T“u%TdDõT—5ETd%EGDeTäôÄS”%Sƒu%TdET7…Teód%5uTd%uGDeTæÄS%Su%TdeF—„åTdäód%G5Sd%W§DeTåTÄed%eSu%TdEf—„ÅTdÄód%%Ww5“d%—§DeTæ´Ätä%tÓu%TdE¤7…eTedód%—5eTd%eGDeUetÄud%uSu%TdE¦—†ÅTfÄód%%—5cd%g§DeTå”ÄfD%f3u%Tdet7†¥Tf¤ód%%5“d%—§DeTæ´Ätä%tÓu%TdE¤7…eTedód%%e—5¥Td%¥GDeTæÔÄud%uSu%TdE¦—†ÅTfÄód%%—5cd%g§DeUe”Ä„d5Tg…§DeTç•—‡E´d&%T“u%TdF&´—6T¤%vÄ4ód%'4Äs5TgE§DeTçU—ƒ´d&ET“u%TdFF´—6T¤%vÄ4ód%'4Äs”5Tge§DeTçu—ƒ5´d&C“u%TdFTT—6¤%wD4ód%'„4ÄwD5Tg%§DeTç5—‡¥´d&3“u%TdFDT—5£¤%vD4ód%&„4Äs”5Tge§DeTçu—ƒ5´d&C“u%TdFTT—6¤%wD4ód%%w„4Ä„ä5Tg¥§DeTã—‡e´d&#“u%TdF4T—6¤%wD4ód%'„4Äs”5Tge§DeTçu—ƒ5´d&C“u%TdFTT—6¤%wD4ód%'„4Ä„d5Tg…§DeTç•—ƒU´d&UT“u%TdFV´—6%T¤%s4ód%#T4Äs5TgE§DeTçU—ƒ´d&ET“u%TdFF´—6T¤%vÄ4ód%'4Ä„d5Tg…§DeTç•—ƒU´d&UT“u%TdFV´—6%T¤%s4ód%4¤4ódDã%ÄVÄ%S6C¤%vÄtód%¥dtÄS%Su%TdEF—…Teód%5Cd%G§DeTåÄfÄ%f³u%TdEv—„åTdäód%%SG5ETd%EGDeTäôÄdä%dÓu%TdEd7…eTedód%—53d%7§DeUdÔÄtä%tÓu%TdE¤7†¥Tf¤ód%%5eTd%eGDeTåtÄed%eSu%Tdef—†ÅTfÄód%%—5¥Td%¥GDeTæÔÄfD%f3u%TdEt7……Te„ód%%fw5“d%—§DeTæ´Ätä%tÓu%TdE¤7†¥Tf¤ód%%5eTd%eGDeUetÄud%uSu%TdE¦—†ÅTfÄód%%—5¥Td%¥GDeTæÔÄfD%f3u%Tdet7‡…´d&5T“u%TdF6´—6%T¤%s4ód%#T4ÄvÄ5Tg§DeTç—‡E´d&%T“u%TdF&´—6ET¤%…d4ód%5¤4ÄvÄ5Tg§DeTç—‡e´d&#“u%TdF4T—6C¤%†D4ód%6„4ÄwD5Tg%§DeTç5—‡%´d&“u%TdF$T—63¤%„ä4ód%5$4ÄvD5Tfå§DeTæõ—‡e´d&#“u%TdF4T—6C¤%†D4ód%6„4ÄwD5Tg%§DeUg5—‡¥´d&3“u%TdFDT—6#¤%s”4ód%4$4ÄwD5Tg%§DeTç5—‡e´d&#“u%TdF4T—6C¤%†D4ód%6„4ÄwD5Tg%§DeTç5—‡…´d&5T“u%TdF6´—6UT¤%†Ä4ód%74Äs5TgE§DeTçU—‡E´d&%T“u%TdF&´—6ET¤%…d4ód%5¤4ÄvÄ5Tg§DeTç—‡…´d&5T“u%TdF6´—6UT¤%†Ä4ód%74Äs5TgE§D%Tç•§D%%v„eG—…ETeDÄvÄ5TS%—…%Tf¤ód%7dÄS%W75Cd%¥7…%Te$ód%¤d4ÄfD%S‡5Cd%G§DeTæõ—…Teód%÷5cd%¥7…%Te$ód%¤d4ód%%TW5Sd%G§D%TåTódUdTW55Td%EdW5UTd%G—„¥TedÄud%dSuTdDÃ—55Td%ET×5eTd%W—„¥TedÄwD5Te„ód%7¦D4ÄVÄ%S5Sd%F—„åTf„÷§3t÷§DevÄ5t7…¥Te¤ÄfÄ%D¤4ód%¥dDÄdä%W75•Td%•GD%Ug5—…ETdÄÄfD%f753d%7—†å´d%£“u%TdFF´Ót÷§3t÷§DeS•ÄwD5TW•§D%Tæõ—…eTdäÄS”%S‡5d%§D%Uf´ÄfD%S‡53d%7—„ÅTdÄÄed%eW5%Td%%7…%Te$ÄTä%T×63¤%„ä4ód%¤dTÄfÄ%S5“d%—§D%Tçu—…¥TdäÄS”%S‡53d%7—…¥Te¤ÄfD%f3uTd†V´×5eTd%57„ETdDÄS%SuTdEdGDåTätód%#dTÄfÄ%W753d%7—„ÅTdÄÄdd%dSuTdFF´¤DÄtä%S‡53d%7—„ÅTdÄÄed%eSuTd„Ó—5cd%7—……Te„ÄVÄ%V³uUTdF$T—5eTd%eU5ETd%7—…%Te$ód%5¤4Äed%edDÄdd%S‡5UTd%UGDåT×¥§D¥TätÄTä%TÓuTde$7……Teód%t÷§3t÷§DeS•Äed%s4ód%6„4Äed%S5Cd%G—„ETdDód%%u5cd%G—„ÅTdÄÄWD%W75eTd%e7„eTddÄdd%dW5d%—‡E´d&%T“uTdFFµ5uTd%E7……Te„ód%'4ÄfÄ%S5Cd%G—„ÅTdÄÄfÄ%f·5UTd%UGD%VC—…eTd¤ÄTä%T×5ETd%EGD%TåTó%“uTd…U5uTd%7—„¥Td¤ÄVD%V75#d%'—„ETdDód%&„5—†¥TeÄdä%dÓuTdfT—5uTd%E7…¥Te¤ÄWD%W75Sd%W—…%Te$ód%6„DÄed%V·5•Td%7…Td$Ädä%TW5eTd%g—…eTedód%5¤5$7†¥TdÄÄed%eW5eTd%e7…%Te$ÄUd%UW5Cd%G§DåTÓ§D%Tä$Äed%V·5•Td%7…Td$Ädä%TW5eTd%g—…eTedód%5¤4Ä†Ä5Tg´×5UTd%G—…eTedÄed%eW5UTd%U7„ETdDó%5¤Tód%#dTÄfÄ%W755Td%57„ÅTdÄÄdd%dSuTdFDT¤DÄtä%S‡5uTd%u7„ÅTdÄÄed%eSuTd†$T×5cd%7—…%Te$ÄVÄ%V³uUTdE¦—…eTee$7„åTdÄÄdd%dSuUTdFF´—5eTd%eT×5UTd%G—…%Te$ó%¤ä4óÄ%—5d%§D%UdTÄfD%Sƒu%TdEdG3t÷§3t÷§3tód%eS‡5UTd%U7…¥TW•§D%TãE—……TeÄdd%dW5eTd%e7„eTddÄdd%dW5d%—„ETdDÄvD5Tfå—„ÅTdÄÄS%SuTdDõU5uTd%E7……Te„ód%'4ÄfÄ%S5Cd%G—„ÅTdÄÄfÄ%f·5UTd%UGD%VC—…eTd¤ÄTä%T×5ETd%EGD%TåTó%“uTde7…¥TdäÄfÄ%f·53d%7—…ETeDÄdd%dSuTdFTT×5eTd%57„ETdDÄfD%f3uTde¤GDåTätód%#W5eTd%57…ETd$ÄS”%TW5Sd%7„åTeÄed%eSuTdF&´—5•Td%7—…ETeDÄed%eW5ETd%E7…%Te$ód%%…$DÄfÄ%V·5eTd%e7…eTedód%5$4Äud%W75Sd%W—„¥Td¥$7„åTdÄÄed%eW5eTd%e7…%Te$ÄTä%TÓuUTdFDUuETdE&§D%Ud$Äed%V·5Sd%7…Td$Ädä%TW5ETd%G—…eTedód%#T4Ätd%W75cd%g—…eTedÄS%S5UTd%UGD%UcE—…¥Td¤Äed%eW5eTd%eGD%Tã—†ÅTdÄÄfD%f75Sd%S×5UTd%G—…eTedÄed%eW5UTd%U7„ETdDód%“”Tó%“u5TdE&—„ETdDód%st÷§3u%TdÅG—…¥Tg%§D%Tã%—……TeÄdd%dW53d%7—…%Te$ÄUd%UW5UTd%U7„ETdDÄTä%T×5eTd%e7„¥Td¤ÄS%SuTdDÕU5uTd%E7…TeÄWD%W75uTd%u7…%TS§D%UW…$7…eTd¤ÄTä%T×5ETd%EGD%TåTó%“uTde7…eTd¤Ädd%TW5Cd%7…ETd$ÄWD%S5eTd%eGD%Tç5—†…TdÄÄdä%d×5eTd%e7„ÅTdÄÄdd%dSuETdFF´ÓuTde7…eTd¤Ädd%TW5Cd%7…ETd$ÄWD%S5eTd%eGD%Tç5—†…TdÄÄfD%f75eTd%e7„ÅTdÄÄdd%dSuETdFV´Óu5TdE&—„ETdDód%st÷§3t÷§DeS•Ädd%dW5ETd&uTgUDsTdÄdd%TSuTgeDV·5uTd%G—„ÅTd$ÄWD%W75cd%g—„¥Td¤ÄS%„$4ÄS”%TW53d&UT“u%TdF$TÓt÷§3t÷§DeS•ÄfÄ%f·5ETd$³ÓuTSD„$dÄdd%TW55Td%GD%E¤Õ57…¥TeÄS%TW53d%7„ÅTdÄÄfD%f755Td%57„åTgu—…Td$Ädä%TW5#d&ET—5Sd&F´—5Cd%7„ÅTW%§DeTãE§D%TätódfV·„$ÄVÄ%STÄdd%S‡55Td%e7†ÅTe$ód%“”4ÄVÄ%SDÄed%d×55Td%e7‡%´d%g§D%Tçu—„¥TdäÄvD5Tfå—„¥TedÄud%dSuTdÆ´×55Td%E7‡´d%F—„åTdäÄ†D5Tc—…Teód%7DÄS”%vÄ4ÄvÄ5Tg—…eWFõ§D%Tä$Äed%S5Cd%G—„¥TedÄvD5TeDód%&„DÄdä%W75Cd%G§D%VFÄed%S65T¤%†ÄdÄTä%TÓuTdFU—5eTd%E7‡…´d$äUW5d%§D%TçU&—…eTdäÄvD5Tc%7„ETdDód%¦ÄdÄed%S6ET¤%F„dÄTä%TÓuTdf6µ—65T¤%vÄ4Ädd%dW5d%—†…Tf„ód$ã—¥—…eTd$ód$ôT¤äÄfÄ%S5cd%g—…ETeDÄfÄ%f·5UTd%UGD%USU—…eTd¤Äed%eSuTdEv—†¥TdäÄs”5Tge—„¥TedÄud%dSuTdDåT×5“d%E7‡e´d&#—55Td%e7‡%´d%g§D%UWe—‡´d%W—‡%´d&—5ETd%E7„ÅTdÄód%5$DÄvÄ5TeDÄfÄ%f·5eTd%e7‡E´d&%T—6%T¤%s5$7„ÅTd¤ód%%‡dÄD¤5TgE—…%Te$ÄVÄ%V³uTdDÃ—4Ö´¤%s4Ädd%dW55Td%5GD%T×e—‡¥´d%——…%Te$ÄVÄ%V·5Sd%W—……Te„ÄS%SuTdf4U5“d%E7‡¥´d&3—55Td%e7‡%´d%g§D%Tç$7…ETd$ÄWD%TW5Sd%W—……TeTÄS”%TW5Sd%7„…Tg—…¥Te¤Äed%ed$ÄS”%S65T¤%„d57„ÅTd%GD%Tç5%7s%´d&5T—5UTd%U7„¥Td¤ó%#TDóÄ%—5d%§D%VDTÄed%S5cd&%T×5d%§D%T×…—‡…´d&T—5UTd%U7„ETdDÄtd%tSuTgU$DäDÄed%TSuTge$S5uTd%E7……Te„Ädä%d×5uTd%u7…%Te$ód%%FÄDÄed%V·5eTd%eGD%TæÄtä%S6#¤%s”4Äs5TgE—…%Te$ód%#4¤TÄfÄ%V·6¤%D¤Dód%“”DÄfÄ%V³uTdE6—†ÅTeÄD¤5TW•—„åTdäód%5$DÄE$5Tg%—‡¥´d&3—5¥Td%¥GD%Tã%$7†¥Td¤Äs5TgE—„åTdäód%¤ä4ód%“uTdE7‡ed$ÔT—6%T¤%s4Äud%uSuUTdDõUuTd…7†¥TdäÄtä%t×55Td%e7†å´d%W§D%Tã%—‡e´d%u7…TeÄvD5Tfå—…ETeDód%%EdDÄtä%S6#¤%„d4Äs5Tg%—„ÅTd$Ädä%d×5¥Td%¥7„åTcE—…Td$Ädä%TW5#d$Ö´—5Cd%G§D%UWe%7wu´d&—55Td%57……Te„ód%'DÄs”5Te¤Ädä%d×53d%7—‡´d&T“uTdDÓ×5uTd%57ƒU´d&UT“uTdDÓ—63¤%f·5Sd%W—„¥Td¤Ä…d5Tc§E%Tç5$GD%Ud$ÄvÄ5TeDÄdd%dW55Td%57„eTddÄS%S5uTd%uGDåT×¥§D¥TätÄTä%TÓuTde$7……Teó%suETdEGDåTä$ó%Su5TdE&§DeTätód%C‡5uTd%u7…eTg%§D%TçU—…eTdäÄUd%UW5eTd%e7„åTdäÄ„ä5Tg¥—†¥Tf¤ÄVÄ%V·5£¤%uW6T¤%vÄ4Ädd%dSuTdfTV75eTd%E7…%Te$ód%%u5Sd%7—……Te„ód%&„4Ädä%W75Cd%G§D%TæÄdä%W76C¤%†D4ód%¦D4Ädä%W76T¤%vÄ4ód%6„4÷§3tód%3‡5Sd%¥GD%Tçu—‡…´d&T—5UTd%U7„ETdDÄtd%tSuTdF6´×5uTd%E7……Te„ÄWD%W75Sd%W—…¥Te¤Ädd%dSuTdf&µ5eTd%57…¥Te¤ÄS%SuTdF4T—5“d%E7†¥Tf¤ÄWD%W75uTd%u7…%Te$ód%¦DDÄtä%S63¤%„ä4ÄWD%W763¤%„ä4Ädd%dSuTdDÃ5“d%E7ƒU´d&UT¤DÄdd%S‡53d%7—‡E´d&%T—5%Td%%7…Teód%5¤dÄtä%S5¥Td%¥7„ÅTdÄÄud%uW5UTd%UGD%Ug$7‡´d%W—……TäôÄWD%W75uTd%u7…eTedÄUd%¤ä4Ädä%d×6%T¤%s4ÄUd%¥d4ÄfÄ%f·63¤%„ä4ÄUd%'„DÄdä%d×5uTd%uGD%VCE—…¥Td¤Ätd%tW5UTd%UGD%Tã%—†å´d%E7‡e´d&#—5uTd%u7‡´d&T—5•Td%•GD%Tçu%7‡E´d%W—…Te$ÄwD5Tg%—„åTdäÄWD%W3uTdDõT×5£¤%S6#¤%s”4Ädä%d×5Cd%UGD%T×¥—†å´d%E7†å´d%£—6¤%wD4Ätd%tW6¤%wD4ÄS”%S‡5d%§D%T×e%7‡E´d%W—…ETeDÄWD%W75•Td%•GE%Tã§DåTätóÄ%—5d%§DeTä”ód%“uT×e4S‡55Td%E7†¥TdôÄS%S5•Td%uG3t÷§3u%Tg¥å¤4ÄVÄ%f75cd&#“uTdDã—5uTd%U7„ÅTdÄÄE$uTS&§D%Uce'—……TeÄWD%W3u%TdE¤G3t÷§3u%Tdå7„¥Te„Ätä%…d4ód%&„DÄfD%S‡53d%7—†ÅTfÄód%¦D4÷§3t÷§DeS$ÄVÄ%f765T¤%F„4ód%5¤DÄfD%S‡53d%7—‡¥´d&3“u%TdF4TÓt÷§3u%TdÅ7„¥Te„Ätd%E$4ód%%„¤DÄfD%S‡53d%7—†ÅTfÄód%¦D4÷§3tód%3W55Td%g—†å´d$³“uTdFTT×5cd%G—„ÅTdÄÄud%uSu%TdDã“t÷§3u%TdÅ7„¥Te„Ä…d5Tg¥§D%T×e—……TeÄWD%W763¤%„ä4ód%4$D÷§3tód%3W55Td%g—w•´d$Ö´ÓuTdF4U5cd%G—„ÅTdÄÄ„ä5Tg¥§DeTçu§3t÷§3tód%C‡5uTd%u7…¥TW•—…ETSE§D%‡tõU—5UTd%GD%D$u57…ETdÄÄ†D5Tc—„ÅTd$ÄfD%TW5Cd%7…ETd$Ädd%d×6UT¤%e5Cd%7„ÅTg§D%TÓ5$7…ETdÄÄvÄ5Tg—„¥Td¤ÄS”%S‡5eTd%eGD%T×¥—…ETdÄÄ†D5Tc5—„¥Td¤Äud%uW53d%7—†¥Tf¤ód%4¤d÷§3t÷§3u%TeG—„ÅTdÄÄdd%D¤4ód%4¤DÄdä%W76ET¤%…d4ÄS”%SƒuTdF&´×5Sd%7—‡´d&T—55Td%57…TeÄS”%S‡5eTd%eGD%Tç5$7…ETdÄÄ†D5Tc5—„¥Td¤Äud%uW53d%7—†¥Tf¤ód%%sTdÄfD%Sƒu%TdEdG3t÷§3u%TdåG—…%Tg…§D%T×…—……TeÄVÄ%V·5•Td%u7„ÅTdÄÄfÄ%f·5%Td%%7‡¥´d&3—53d%7—‡…´d&5T—5d%—„eTddÄWD%W755Td%5GDeTãE'§3t÷§DeWEÄwD5TW•§D%Tæõ—…¥Te$ó%Cu5TdE&§D%Ud$ÄfD%S‡53d%7—‡E´d&%T“u%TdF´Ót÷§3t÷§DeS•Ä„d5TSE§D%TçU—……TeÄWD%W75¥Td%¥7†å´d%£“u%TdDãÓt÷§3t÷§DeS•ÄE$5Tg…§D%T×…—……TeÄWD%W763¤%„ä4ÄvD5Tfå§DeTçu$G3t÷§DeWEÄed%s4ód%6„4ÄfÄ%dW53d%7—w%&´d$³“uTddåV75cd%G—„ÅTdÄÄfD%f3u%TdFV´“t÷§3t÷§DeS•Ätd%„ä4ód%¤ä4ÄfD%S‡53d%7—†ÅTfÄÄdd%dSu%TdF6´Ót÷§3t÷§DeS•Äs”5TS%§D%Tç5—……TeÄWD%W763¤%„ä4Ädd%dSu%TdDåTÓt÷§3u%TdÅG—…%Te$ÄfÄ%D¤4ód%6„DÄfÄ%dW53d%7—w%&´d$³“uTddåV75cd%G—„ÅTdÄÄfD%f75eTd%eGDeTçU§3t÷§3t÷§3t÷§3u%Te¥G—……Te„ÄfÄ%D¤4ód%¤äDÄfD%S‡53d%7—†ÅTfÄÄdd%dW5eTd%eGDeT×e§3t÷§3t÷§3tód%eS‡6¤%wD4ÄfÄ%D¤4ód%'„TÄfD%S‡53d%7—‡¥´d&3—5UTd%U7…eTedód%5$T÷§3tód%3‡5uTd&“uTdFF´—5uTd%U7„ÅTdÄÄ„d…Tg…'§D%Ug547……TeÄWD%W75•Td%•GDeT×¥§3t÷§3tód%C‡5¥Td&5T“uTdDÕT—5cd%G—„ÅTdÄÄud%uW5eTd%eGDeTã%§3t÷§DeWEÄ„ä5TS§D%Tç—……TeÄWD%W763¤%„ä4Äed%eSu%TdDõTÓt÷§3u%TdÅG—…%Te$ÄS%wDTód%“”TÄfÄ%dW53d%7—w%&´d$³“uTddåV75cd%G—„ÅTdÄÄfD%f755Td%5GDeTÓ5§3t÷§3tód%C‡5cd%g—„åTg%$GD%Tç5%7……TeÄWD%W75¥Td%¥7…%Te$ÄVÄ%V³u%TdFV´Ót÷§3t÷§DeS•ÄwD5Tg%—„åTg%$GD%Tãe%7……TeÄWD%W763¤%„ä4Ädd%dW55Td%5GDeTæõ$G3t÷§DeWEÄfÄ%f·5ETd$³ÓuTdFUW5uTd%UGDåTäôóÄ%“uTde7……TeÄWD%W75¥Td%¥7„¥Td¤ód%'D÷§3t÷§3u%TeG—†ÅTfÄÄS%7DDód%#TdÄfD%S‡53d%7—†ÅTfÄÄfÄ%f·55Td%5GDeTÓ5§3t÷§3tód%C‡63¤%„ä4ÄS%7DDód%¤ddÄfD%S‡53d%7—‡¥´d&3—5uTd%u7„¥Td¤ód%4$T÷§3t÷§3u%TeG—…ETfÄód%4$4Ädd%V·53d%7—‡¥´d&3“uTdDã—5cd%7—‡¥´d&3—5Cd%G§D¥Tçu§DeTätód%“uTãES‡55Td%E7w•´d$Ö´“u%TdFDT×5ETd%EGDeTäôÄS”%Sƒu%TdET7„åTdäód%G5“d%—§DeTæ´Ätä%tÓu%TdE¤7…eTedód%—5¥Td%¥GDeTæÔÄud%uSu%TdE¦—……Te„ód%w5“d%—§DeTæ´Ätä%tÓu%TdE¤7…eTedód%—5¥Td%¥GDeTæÔÄud%uSu%TdE¦—……Te„ód%$“uTäµ7„¥Tdå&—wu´d&UT—6#¤%V·55Td%57„ETdDÄS”%S‡5eTd%e7„ETdDód%7¤dTÄVÄ%S6%T¤%„dtód%7tÄs5TgE§DeTçU—ƒ´d&ET“u%TdFF´—6#¤%s”4ód%4$4Ä†D5Tc5§D%T×…§D%WEÄVÄ%S4ÔT¤%SG5ETd$ÔUu%Te¤Ã55Td%g—…TfÄód%%†„4ÄfD%Sƒu%TdEdGDeUeÄfÄ%f·5UTd&#—5Sd$ÔTÓuTdDÃW5Sd%7—…ETeDód%%u5Sd%7—†…Tf„ÄfD%TW5Cd%7…ETd$Ädd%dÓuTdDÓ—5Sd%7—ƒ´d&ET—5cd%7…Td$Ädä%TW5UTd%W§DeTã%§DeUf„Äed%eW5ETd$Ö´“uTd%7……Td%T7…ETd$ÄS%TW5ETd%7†…Td$ód%&„TÄfD%W75Sd%W—†¥Tf¤ÄS%S53d%7—…%Te$ÄVÄ%V³u5TdF6µ5d%GDeTd$÷§3t÷§3u%Te——…%Te$ÄS%†ÄDód%TW5cd%TW5Sd%7„åTd$ÄS%TW5•Td%GD%TÓ5$7…¥TdäÄfD%f75ETd%E7„ÅTdÄÄed%eW55Td%5GD%T×…—…eTd¤Äed%eSuTdEv—†ÅTeó%uTde7…¥TdäÄfD%f75ETd%E7„ÅTdÄÄed%eW55Td%5GD%T×…—…eTd¤Äed%eSuTdEv—†ÅTeó%uTde7†…TeóÄ%5d%GDeTd$ód%%t×5eTd%e7„åTcU§D%Td$ÄfD%Td$Ädä%TW5ETd%7„åTd$Ätd%TSuTS%sTdÄed%TW55Td%GD%E¤e57…¥TdäÄS”%S‡53d%7—…Teód%#74ÄfÄ%S5“d%u7„ÅTd$ÄWD%W76%T¤%Ww5Cd%7…ETd$ÄVD%„d4Ädd%dW5eTd%7…Tfå§D%T×e$7…eTd¤ÄTä%T×5cd%g§D%Tæ´Äud%SƒuETdEdGD%Ud$ÄfÄ%S5•Td%u7„ÅTd$ÄWD%W75¥Td%D7…Td$Ädä%TW5#d&—5eTd%GD%Tçu—…eTd¤ÄTä%T×5cd%g§D%Tæ´Äud%SƒuETdEdGD%Ud$ÄfÄ%S5“d%——…eTedód%¦Ä4Äed%V·5d%‡6C¤%…d4ÄVÄ%V·5cd%g—„…Td„ód%¥dDÄvD5Te$ÄWD%W74ÔU$%D$TÄfD%f75#d%'§D%Tç•&—†ÅTeó%uTde7…¥TdäÄvÄ5Tg—…eTedód%'DÄed%V·5d%—†å´d%£“uTdF&´—5¥Td%G§DåTåTód%CW5uTd%E7wu´dE47†ÅTfÄÄfD%s4Ä†Ä5TcU—…%T×¥$7†ÅTfÄÄfD%s4ÄD$5TWu§D%UWe$7…¥TdäÄtd%„dDÄTä%TÓuTdDåT×5eTd%57†ÅTfÄÄtä%t×5ETd%EGD%Tç•—†¥TdäÄdd%dSueTdEv—…TeÄdd%dW5¥Td%¥7…eTedÄUd%UW55Td%57„ETeÄS”%„äET7…ETd$ÄS%TW5d&DT×5%Td%7„…Tg¥—……Tc—„ETdDÄvD5Tfå—†ÅTfÄÄVD%SuTdFVµ—5£¤%V·5cd%g§D%TæÔÄwD5TdäÄdd%dW5£¤%vD4ód%'¦Ä4ÄvD5Td¤Ä†Ä5TcU§D%T×¥—‡e´d%E7†å´d%£—6T¤%vÄ4Ädd%dSuTdDÃ×6¤%V·6T¤%vÄ4ÄS%SuTdFV´—4Ö´¤%f3u“dE–§E¥Tätód%%TW6¤%S5Cd%G—„åTdäÄWD%W75Cd%G—†¥Tf¤Ädd%dW53d%7§D%V7…$7†å´d%57…%Te$ÄS%SuTdFT—63¤%dW53d%7—wud$ÔT×5UTd%U7†…Tf„ÄWD%W76¤%wD4ód%#T„óÄ%“uTd…7ƒ´d%g—…%Te$ÄVÄ%V·5%Td%%7„ÅTdÄód%&„DÄTä%TW5d%§E%Tä”ó%“uTde7…¥TdäÄfD%f755Td%57…¥Te¤ÄWD%W74ÔT¤%D$4Äed%eW5#d%'§E%T×¥%7‡¥´d&3—53d%7§DåTÓ5—„ETdDód%5cd%7—„åTdäÄVÄ%V·5Sd%W—ƒ5´d&C“uTdfU5eTd%57„ÅTdÄÄfÄ%f³uTdF&´—5“d%E7…ETeDÄVÄ%V·6¤%wD4Ädd%dSuTdDã×5•Td%7—……Te„ÄVÄ%V·5ETd%EGD%T×…—†ÅTeÄtä%t×53d%7—……Te„ó%5¤Dód%%TW5•Td%G§D¥TåTÄTä%TSu%Td%GDeUf¤Äed%eW5ETd&UTÓuTd%7……Td%7…ETd$ÄS%TW5ETd%7†…Td$ód&V·U%7…eTd$ód$ÔW¤ÄfÄ%S5Cd%G—„ÅTdÄÄS”%SƒuTdfV´—5uTd%E7…eTeDÄWD%TW53d%7—†ÅTdÔÄS”%TW5Sd%7„…Tg§D%Tæõ—…eTd¤ÄTä%T×5UTd%UGD%Tå”Äud%SƒuETdEdGD%Ud$ÄfÄ%S6T¤%E¤DÄS”%SƒuTdDÕU5eTd%57„ETdDÄvD5Tfå§D%TçU—†ÅTeó%uTde7…¥TdäÄtd%„dDÄTä%TÓuTdDåT×5eTd%57†ÅTfÄÄtä%t×5ETd%EGD%Tç•—†¥TdäÄdd%dSueTdEv—†ÅTfÄÄfD%f755Td%57„ETeÄdä%dä$Ädä%TW5ETd%7„åTd$Ätd%TSuTdDåT×6¤%S5cd%g—„ÅTdÄód%5$4ÄwD5TdäÄdd%dW53d%7§D%UgU—†å´d%57…¥Te¤Ädd%dW5Sd%W—„åTdäód%4¤DóÄ%“uTd¥7†å´d%57…%Te$ÄVD%V3uTdE–—‡¥´d%UGFå´dEF—w•d$Ö´×5UTd%U7‡´d&T—53d%7§F¥T×¥%GD%Tä$óÄ%“uTde7‡%´d%E7…TeÄS%S53d%7—…TeÄtä%t×5UTd%U7„ÅTdÄód%'¤dTÄvD5Td¤Ädd%dW5ETd%EGD%Tæõ—‡¥´d%U7„ÅTdÄÄD$ETWu—…%Te$Ätd%tW53d%7—‡%´d&“uTdF&¶3uuTdE&§D%VD$ÄwD5TdäÄvD5Tfå—‡´d&T—5UTd%UGD%T×e—‡%´d%E7†¥TfÄÄvÄ5Td$ÄS”%TW5£¤%vÄ4ód%5…$DÄvD5Td¤ÄfD%f75cd%g—„ÅTdÄÄS%SuTdF&´×63¤%dSu£¤%G4æ´¤%E¤4ÄfD%f763¤%„ä4ÄWD%W3u“dF6µSuTdEGE¥Tätód%#W6ET¤%f75cd%g—„¥Td¤ÄUd%UW53d%7§EeTçU—„ETd$ÄTä%TÓuUTdE4GDåTätód%%TW5uTd%E7……Te„ÄVÄ%V·5uTd%u7„ÅTdÄÄD$5TWu—…eTedÄVD%V3uUTdDÓW63¤%„ä4ÄWD%W3uETdDã—5d%§D%TäTÄfD%W75ETd%E7„¥Td¤Ädä%d×6C¤%†D4ód%%v„TÄed%V·53d%7—…¥Te¤ód%#T4Ätä%S5Sd%W—„¥Td¤ÄwD5Tg%—…%Te$ód%¦DDÄtd%W75cd%g—„¥Td¤ÄS%SuTdDÕT—5¥Td%G—†¥Tf¤ÄWD%W75cd%g§DåTã%§D%Ud$Ätd%Sƒu5TdEd7„ETd$ód%TSt÷§3t÷§DeS•$ÄD$5TWu—…¥TgE$GD%UgU&—…eTdäÄ…d5Tc—…TeÄS”%S‡6C¤%†D4ÄUd%USuETdF&µW5d%—‡…´d&5T—5cd%g—†å´d%£—53d%7§D¥TãE$GD%VD$Ädd%V·65T¤%„d4Ädä%d×5#d%'§D%TçU—…¥TdäÄVÄ%V³uUTdEV—s%%Td$æµW65T¤%„d4ÄWD%W755Td%57„ETdDó%¦Ä„óÄ%“uTde7……Teód%uTdE&§D%%„¥G—„¥TdäÄs”5TdôÄtä%„äDÄ„ä5TfÄód%UsTTÄtä%tÓuTdF&´—5eTd%EGD%SU4Ädä%dW5£¤%vD4ód%6„4Ädä%dW6T¤%vÄ4ód%C5¤4Ädä%W75UTd%UGD%Tæ”Ädä%W75Sd%W§D%Tæ´Ädä%W75£¤%vD4ód%4¤4Ädä%W76T¤%vÄ4ód%%…$4Ädä%W75cd%g—„¥TedÄ…d5Tfå—„¥Td¤Ätd%tW53d%7—„ETdDÄVD%V75d%§D%Tç•%7…ETdÄÄtd%tW5uTd%u7„ÅTdÄÄdd%dSuTddÓ×5Sd%7—†…Tf„ÄVÄ%eW6ET¤%vD4ÄVÄ%V·5uTd%u7„¥Td¤ÄUd%UW5#d%'—„ETdDód%5$dÄdä%W75Sd%W—„ÅTdÄÄed%eSuTddã—5Sd%7—…¥Te¤ód%'4Ädä%W75Cd%G§DeTæ´ód%%S‡5Sd%¥GD%Tçu—…%Td¤Ä…d5Tc§D%UW¥—…%Td¤ÄWD%W76¤%wD4ÄWD%W75Cd%G§D%Tç•—……TdÄÄvD5Tfå—„ÅTdÄód%¤d4ÄE¤5Tc§D¥Tãe§D%Ud$Ädd%V·53d%7—‡E´d&%T—53d%7—…%Te$ód%5¤DÄfD%W76T¤%vÄ4ÄWD%W3uTdDÓ—4æ´¤%…d4óÄ%74ód%%TW5UTd%57‡¥´d&3“uTdFTT—5cd%7—†ÅTfÄóÄ%5$4ód%“u%TdeU7‡´d&ET“uTdDã—5Sd%7—…ETeDÄS”%S‡5#d%'—„…TdÄÄVD%W75d%'§D%Ug•—†…TeDÄVÄ%V·5#d%'—„¥Td¤ÄVÄ%V·53d%7§D%T×¥—…¥TdäÄVÄ%W755Td%57„ÅTe$ÄWD%W3uTddåT—5cd%7—…ETeDÄS”%S‡55Td%57„…Td„ÄWD%W76T¤%vÄ4ÄWD%W755Td%57„ETdDÄVD%V75#d%7—„ÅTdÄÄvÄ5Tg—„ÅTdÄÄVÄ%V·5d%—„ETdDóÄ%5¤„ód%%TW5Sd%7—…ETeDÄtä%tÓu%TdDõT“u%TdeU7†¥Tge§D%T×…—†…TeDÄVÄ%V·5#d%'—„¥Td¤ÄVÄ%V·53d%7§D%T×¥—……TdÄÄfD%f75Cd%G—„¥Td¤ÄVD%V75#d%'—„¥Td¤ÄVD%V755Td%57„ETdDóÄ%“”Dód%%TW5Sd%7—……Te„Ätä%tÓu%TdFTÓuTdE&§D%“”UG—„¥TdäÄF„5TdôÄtä%vDTÄ…d5TfÄód%UFDTÄtä%tÓuTdF&´—5eTd%EGD%UdôÄdä%W75Sd%W§D%Tæ´Ädä%W76T¤%vÄ4ód%%…$4Ädä%W75Cd%G—„¥TedÄvD5Te$ód%¦Ä4Ädä%W75¥Td%¥7„¥TedÄvD5Te$ód%%…$DÄdä%W75cd%g—„¥TedÄ†D5Tfå—„¥Td¤Ätd%tW5#d%'—„…Td„ÄTä%TÓuTdF$UW5Sd%7—†…Tf„ÄfÄ%f·53d%7—…%Te$ód%%DäDÄdä%W75•Td%•7„¥TedÄ†D5Tfå—„¥Td¤ÄfÄ%f·5#d%'—„…Td„ÄTä%TÓuTdF&µW5Sd%7—…ETeDÄWD%W75eTd%eGD%US5—…ETdÄÄfÄ%f³uTdF´—5Sd%7—…Teód%%u%TdeG—…ETfÄód%4$4Ädd%V·6ET¤%…d4ód%%Dä4Ädd%V·53d%7—‡E´d&%T—53d%7—…%Te$ód%5¤DÄfD%W76T¤%vÄ4ÄWD%W3uTdDÓ—4æ´¤%…d4óÄ%74ód%%TW5UTd%57„ETdDÄWD%W75•Td%•7…TeÄWD%W755Td%57„…Td„ód%6„DÄfD%W75•Td%•7„ÅTdÄÄWD%W755Td%5GD%Tæõ—s%´d&ET“u5TdFV´“uTde7…%Td¤Ä„ä5Tg¥§D%TãE—……TdÄÄud%uSu5TdFDT“u%TdE&§DeUe$ÄvÄ5Tc§D%TÓ5—†…TeDÄVÄ%V·5#d%'—„¥Td¤ÄVÄ%V·53d%7§D%T×¥—…¥TdäÄVÄ%W755Td%57„ÅTe$ÄWD%W3uTddåT—5cd%7—…ETeDÄS”%S‡5#d%'—„ÅTdÄÄVÄ%V·5d%—„…Td„ÄWD%W755Td%57„ETdDÄVD%V75d%'§D%Tç•$7……TdÄÄdä%d×5Cd%G—„ÅTdÄÄVD%V75#d%7—„ÅTdÄÄVÄ%V·5d%—„…Td„ÄWD%W755Td%57„ETdDÄTä%TÓuTdDÕU5cd%7—…ETeDÄS”%S‡53d%7—„…Td„ÄWD%W755Td%57„ETdDÄVD%V75#d%7—„ÅTdÄÄVÄ%V·5d%—„ETdDóÄ%¥dTód%%TW5Sd%7—„åTdäÄWD%W75£¤%vD4ÄWD%W75£¤%vD4ÄWD%W75“d%—§D%TãE%7…ETdÄÄed%eW53d%7—†…Tf„ÄVD%V753d%7—†…Tf„ÄVD%V753d%7—†…Tf„ÄTä%TÓuTddåUW5Sd%7—…ETeDÄS”%S‡55Td%57„…Td„ÄVD%V75d%§D%Tæõ—…ETdÄÄdä%d×5Cd%G—„¥Td¤ÄWD%W75•Td%•7„…Td„ÄWD%W75•Td%•7„…Td„ÄWD%W75•Td%•7„ETdDód%%…$tÄdä%W75Sd%W—†¥Tf¤ód%¦Ä4ód%%dW5“d&#“uTdDÕT—5•Td%W—„¥Td¤ÄVD%V755Td%57„¥Td¤ÄWD%W3uTdDÓ—5uTd%E7„åTdäÄVÄ%V·53d%7§D%Ug•—……TdÄÄfD%f75ETd%E7„¥Td¤ÄVD%V75#d%'—„eTddód%'„DÄfD%W75cd%g—„åTdäÄWD%W755Td%57„…Td„ÄWD%W75#d%'—„ÅTdÄÄUd%USuTdFµ5cd%7—……Te„ÄS%S5ETd%E7„¥Td¤ÄVD%V753d%7—„…Td„ÄWD%W75%Td%%GD¥Tçu$GD%Tä$Ädä%W75cd%g—„åTdäÄWD%W755Td%57„eTddód%%wDÄdä%W75cd%g—†¥Tf¤ód%&„Dód%“uU£E%TW55Td%Ed×5eTd%W—„¥TedÄs5Te„ód%4$DÄVÄ%S5Sd%W—„¥TedÄs5Te„ód%4$DÄVÄ%STÄdd%S‡55Td%e7†å´d%UGD%T×e—„¥Tdå%7…%TeÄVÄ%eW5£¤%dSuTddÃ—55Td%E7†å´d%£—53d%7—„ÅTdÄÄTä%V755Td%5GD%Tã%—„¥TdäÄud%uW55Td%e7‡E´d%g—„…Td„ÄVD%V75d%—†ÅTfÄÄtd%tSuTdDãW55Td%E7‡%´d&—55Td%e7†å´d%U7„…TdÄÄVD%W75d%'§D%Ufõ$7„¥TdäÄwD5TdôÄtä%s”DÄtä%Su%TdæTT×5uTd%u7…%TgE§D%Tçu—…eTdäód%G5Sd%7—‡E´d&%T“uTdfTT—5Sd%7—…¥Te¤ód%%w4ód%W5uTd%E7……Te„ÄVÄ%V·6¤%wD4ód%5¤DÄud%d×5Sd%W§D%Ug5—…¥TdäÄfD%f755Td%e7wu´d&“uUTdDÓ×5Cd%G§E%TåÄtd%tSuUTdE–—…ETeDód%5ETd%uGE%TæÄfD%f3uUTdEt7…¥Te¤ó%%5d%§D%UdTÄfD%W75•Td%•7„¥TedÄtd%W75eTd%e7…%Te$ód%#TTÄfD%W755Td%57„ÅTdÄÄed%eSu5TdDÕT“uTdeGD%TädÄfÄ%S5cd%g—„¥Td¤ÄwD5Tg%§D%Tã%—†ÅTeDÄdä%dÓuTdf$T—5uTd%E7……Te„ÄVÄ%eW4ÔT¤%wD4ód%¤äDÄS”%SƒuUTdET7†…Tf„ód%$—5Sd%W§E%TåTÄS%f³uUTdEv—……Te„ód%w5uTd%uGDåTæ´ÄTä%TÓuTde$7……TdÄÄfD%f755Td%e7†…TdÄÄed%eW5UTd%UGD%Tç$7……TdÄÄVÄ%V·53d%7—…%Te$óÄ%6„4ód%%TSuTdE%7…¥TdäÄfD%f755Td%57s´d$äT“uTdFµ5¥Td%W—…ETeDód%%w„4ÄfÄ%S5cd%g—„¥TedÄD$5Tg%§E%T×¥—…Teód%5cd%g§E%Tå”ÄfÄ%f³uETdE¤7„ETdDód%%U5cd%7—†¥Tf¤ÄVÄ%eW65T¤%tW5eTd%e7…%Te$ód%¥dTÄfD%W75uTd%u7†å´d%£“uTdF´×5cd%7—„¥Td¤ÄWD%W75cd%g§D¥T×¥§DeTätód%%S‡5eTd%£“uTdF6´—5Sd%7—…ETeDÄdä%d×5UTd%UGD%T×e—…ETdÄÄdä%d×5Sd%W—…%Te$ód%%3”4Ädä%W75cd%g—…ETeDÄdd%dSuTdF´×5Sd%7—……Te„Ädä%d×5UTd%UGD%Ug—…ETdÄÄfÄ%f·5Sd%W—…%Te$ód%'„DÄdä%W75uTd%u7…ETeDÄdd%dSu%TdF4TÓu%TdeG—‡%´d&—5Cd&3“uTddã×5eTd%E7„åTe¤ÄwD5TedÄed%eW53d%7—…eTedód%4¤TÄdä%W75Sd%W—…ETeDÄdd%dSuTdDÃ—5Sd%7—…ETeDÄdä%d×5Cd%G§D%USU—…eTdäÄdd%t×6¤%eW5eTd%e7„ÅTdÄÄed%eSuTdFFµ5Sd%7—……Te„Ädä%d×5UTd%UGD%Tç—…ETdÄÄfD%f75Sd%W—…Teód%#&„DÄdä%W75eTd%e7ƒ´d&ET¤tÄWD%V³uTdDÕT×5Sd%7—…eTedÄ†Ä5TcU´×5Cd%EGD%V3UW5uTd%G—…ETeDÄWD%W75eTd%e7ƒ´d&ET—5ETd%E7„ETdDód%'¦DTÄdä%W75Sd%W—…ETeDÄWD%WDTÄWD%V³uTdFT×5Sd%7—…ETeDÄfD%f753d%3×5Cd%EGD%Ugu—…ETdÄÄfD%f75Sd%W—„ÅTdÅ$7„ÅTd¤ód%'„DÄdä%W75cd%g—……Te„ÄWD%WDDÄS”%SuTdFDT×5Sd%7—……Te„ÄfD%f75Sd%W—…TeÄvÄ5Tg—‡´d&T—5#d%'—„ETdDód%'tÄdä%W75cd%g—……Te„Ädä%d×5uTd%uGD%VFõ$7…eTdäÄUd%UW5UTd%U7……Te„ÄVÄ%V·53d%7§D%Tçu—…%Td¤Äed%eW5UTd%U7…¥Te¤ód%&„DÄtd%S‡6T¤%vÄ5—„ÅTd¤ÄUd%UW55Td%5U—53d%5GD%Tã—……TdÄÄfÄ%f·5Sd%W—„ÅTdÄÄWD%WDdÄWD%V³uTdFTT×5cd%7—…¥Te¤Ädä%d×5Cd%G§D%Tç—……TdÄÄfÄ%f·5Sd%W—„ÅTdÅ&—„ÅTd¤óÄ%4¤Dód%#W5eTd%E7‡%´d&—53d%7§DeT×e§D%Tätód¤Ó„$ÄVÄ%S5uTd%u7„¥TedÄvD5Te$ód%4$DÄVÄ%S5Sd%W—„¥TedÄvD5Te$ód%eDd4Ädä%d×6ET¤%…d4Ädd%†D4ÄWD%†ÄDód%5$„Ädä%S‡5uTd%u7…eTedÄfD%f753d%7—„åTdäód%#TTÄdä%SƒuTdEdGD%…Ädä%d×6#¤%s”4Ädd%E$Tód%¦ÄtÄdä%S‡5d%—„ÅTdÄÄS%S5d%—…TeÄVD%V75Cd%G—„ETdDÄVD%V753d%7—„åTdäÄS”%S‡5#d%'—„ÅTdÄÄWD%W75Cd%G—„¥Td¤ÄS”%S‡55Td%57…TeÄVÄ%V·5Cd%G—„ETdDÄTä%T×5d%§D%Tç•4GD%…Ädä%d×5“d%——…Tc§D%TçU$7…%TdäÄfÄ%f·53d%7—„åTdäÄdd%dW55Td%E7„ÅTdÄÄUd%USuTdF$U5Sd%G—…%Te$ÄVÄ%S53d%7—„ÅTdÄód%'Dód•DTW55Td%E7‡%´d&—55Td%e7†å´d%U7„…TdÄÄVD%W75d%'§D%Uc%$7„¥Tdå7…%TeÄVÄ%eW5£¤%dSuTdDÃ—55Td%EUW5UTd%G—„¥TedÄvD5Te$ód%“”4ÄVÄ%S5Cd%G—„¥TedÄvD5Te$ód%“”4ÄVÄ%STÄed%d×55Td%e7‡E´d%g§D%Tçu—„¥Tdå%7…eTeDÄVÄ%eW6%T¤%f3uTdF4T×55Td%E7…ETeDÄVÄ%eW6%T¤%f3uTdF4T×55Td%E7…ETeDÄVÄ%eW6%T¤%f3uTdF4T×55Td%E7…eTedÄVÄ%eW5“d%EGD%WCe—„¥TdäÄtd%SG5ETd%ET×5uTd%eG3t÷§3t÷§DeD$…¤7…¥Te¤Äed%…d4Ädä%D¤4ód&4VG•%7…ETeÄ„d5Tg…—„¥TedÄvD5Te$ód&“U—…ETeÄtd%tSuTfÆ4T—5Sd%G—…¥Te¤ÄVÄ%eW5£¤%dW5#d%7—„…TdÄÄTä%V3uTge%v„TÄdä%W75cd%g§D%Tæõ—…ETdÄÄed%eSuTde¦—…ETdÄÄS”%SƒuTdEv—…ETdÄÄdä%dÓuTdE¤7…ETdÄÄud%uSuTdf4T—5Sd%7—w•´d$Ö´—53d%7—ƒU´d&UT—55Td%e7‡E´d%g—„ETdDód%5$t÷§3tód&$Ud$ÄVÄ%f75ETd%—§D%Tã%—……TeÄWD%W3u%TdE¤G3t÷§DeWD$ÄVÄ%f755Td%57…TfÄód%¥d4Ädä%W75Cd%G§D%TæÄdä%W75¥Td%¥GDeTã§3t÷§Deed$ÄVÄ%f75UTd%£“uTdFV´—5cd%G—„ÅTdÄód%%t÷§3u%TdÅ7„¥Te„ÄS%S5Cd%¥GD%TÓU—…ETdÄÄdä%dÓuTdE¤7…ETdÄÄud%uSu%TdFDT“t÷§3u%TfÅ7„¥Te„Ädd%„d4ód%¦Ä4ÄfÄ%dW53d%7—ƒU$Td&UUuTdfDUW5cd%G—„ÅTdÄÄdä%d×55Td%e7†¥TdäÄTä%TÓu%TdFTTÓt÷§3t÷§3u%TcU³‡5Sd%W—…%Tg%§D%Tæõ$7……TeÄS”%S‡55Td%e7‡%´d%e7…eTedÄWD%W75UTd%——‡%´d%e7…eTedÄWD%W75ETd%E7„…TdÄÄWD%W3u%TdDÕV3t÷§3t÷§3tód%S‡53d%7—…%TcU§D%TçU—…%Td¤ÄWD%W75•Td%•7…TeÄed%eSuTdF6´×5uTd%E7„¥Td¤ÄS%S6%U$%sTóÄ%4¤dód%%TW5Sd%7—‡E´d&%T—53d%7—…TeÄwD5Tg%§D%Tã$7…ETdÄÄed%eW5Cd%G§D%Tã—…ETdÄÄtd%tW5Cd%G§D%Tãe—…ETdÄÄdä%d×5Cd%G§D%Tç•—…ETdÄÄed%eW53d%7—…TeÄdä%dÓuTdf4T×5cd%G§DeTåT÷§3t÷§3u%TeG—…%TgE§D%TãE—……TeÄVÄ%VÄ$ÄfÄ%eW53d%7—…eTedÄWD%W75Cd%G—„eTddÄWD%W755Td%5GDeTÓ5$G3t÷§DeWEÄdd%tÓuTdF&´—5Sd%7—…Teód%÷5Sd%7—…ETeDód%%5Sd%7—†ÅTfÄód%5$4÷§3t÷§3u%TeG—ƒ´d&ET—5UTd&3ÓuTdF$UW5eTd%E7…TeÄWD%W75Sd%W—†ÅTfÄÄS%SuTdfU5cd%G—…TeÄWD%W753d%7—‡%´d&—5%Td%%7†…Tf„ÄWD%W75cd%g§DeT×¥%G3t÷§3t÷§DedeÄ†Ä5TcU—…%TS§D%T×…%7…eTdäÄS”%S‡53d%7—…ETeDÄud%uW5ETd%EGD%Ufõ$7……TeÄ…d5Tc—„åTdäÄS%Su%TdDåTÓt÷§3t÷§DeS•Ä…d5Tc—…%TS§D%TãE%7…%Td¤ÄWD%W75eTd%e7‡%´d&—5¥Td%¥7„¥Td¤ÄS%SuTdDåU5•Td%G—…TeÄWD%W753d%7—ƒ5´d&C—5%Td%%7…TeóÄ%¤äTód%%TW5eTd%E7„ETdDÄwD5Tg%—‡´d&T—55Td%57‡e´d&#—53d%7—…ETeDód%&„tÄfÄ%dW55Td%57„…TdÄÄS%S53d%7—„ÅTdÄÄwD5Tg%—‡E´d&%T—53d%7§D%UW¥%7……TeÄS”%S‡5•Td%•7…TeÄUd%UW5uTd%u7…TeÄWD%W753d%7—ƒ5´d&C—5%Td%%7…TeÄTä%TÓu%TdF6¶3t÷§3t÷§DeS•Ä†D5Tc5—…%Tg¥§D%TçU%7…ETdÄÄ†Ä5TcUµ5Cd%EGD%Tçu—…ETdÄÄ…d5Tc—„åTdäód%%w„DÄfD%S‡5CdE6—„ÅTdÄÄud%uW5%TdF4T—5£¤%vD57…TdäÄUd%5$4ÄvD5Tfå—„åTdäÄUd%5$4ÄfD%f753d%7—…ETeDÄS”%S‡5d%§DeTã§3t÷§3t÷§3t÷§DefEÄS”%S‡5eTd$³“uTddÓ×5eTd%E7‡´d&T¤tÄdd%4$4ÄWD%W753d%7—ƒ5´d&C—5%TdF$T×5Sd%W—‡´d&T—53d%7—ƒU´d&UT¤dÄS”%S5d%—„ETdDód%#TdÄed%S5eTd%e7„ÅTdÄÄ…d5Tcµ53d%5GD%Tæõ$7…eTdäÄfÄ%f·53d%7—„ÅTdÄÄdd%dW5%Td%%7„¥Td¤ÄS”%S‡5%Td%%7†å´d%£—5“d%——„eTddÄed%eSuTd„ã—5eTd%E7„ETdDÄtd%tW5uTd%u7„¥Td¤Äs”5Tge—„ÅTdÄÄdä%dÓuTdFDUW5eTd%E7„ETdDÄfD%f75eTd%e7„¥Td¤Äs”5Tge—…ETeDód%¦DTÄed%S5ETd%E7†¥Tf¤ÄfÄ%f·5cd%g§D%Tç$7…eTdäÄdd%dW5“d%——†ÅTfÄÄed%eSuTd†6µ5Sd%7—…Tf„ÄwD5TedÄed%eSuTdFDT×5Sd%7—…ETfÄÄwD5TedÄed%eSuTdfTT×5Sd%7—†ÅTfÄód%5$4÷§3t÷§3tód%US‡5Cd%G—…Tg…§D%Tç—…%Td¤ÄWD%W75eTd%e7…%Te$ÄWD%W75uTd%uGD%T×…—……TdÄÄS”%S‡53d%7—…TeÄvÄ5Tgµ—53d%57„ETdDóÄ%&„Tód%%TW5UTd%57„ÅTdÄÄtä%tÓuTdF6´—5cd%7—†ÅTfÄód%%„$4ÄfD%W75UTd%U7†¥Tf¤ÄWD%W75ETd%E7„ÅTdÄÄS%Su5TdF&µu%TdE&§D%Tätód$ådf„ÄfD%·5“d%—§D%U&õ—„¥TdäÄfÄ%SCuVÆÕT7„¥Tdå7—‡E´d&—55Td%e7†å´d%U7„…TdÄÄVD%W75d%'§D%Uc%$7„¥Tdå6—…eTeDÄVÄ%eW6%T¤%f3uTdF4T×55Td%EUW5eTd%W—„¥TedÄs5Te„ód%4$DÄVÄ%S„ÄfD%eW55Td%e7†¥TdäÄVD%W75#d%7—„…TdÄÄWD%W3uTdäã×55Td%E7ƒ´d%F—„åTc$G3t÷§3t÷§3t÷§Desf6µ5uTdED7…eTä$Ä†Ä5Tä$Ä†Ä5Tä$Ä„ä5Tä$Äs”5Tä$ód%W5Sd%7—……Te„ód%%v„4Ädä%W74ÔT¤%D$4ód%“”4Ädä%W74ÔT¤%D$4ód%“”4Ädä%W76ET¤%…d4ód%¥d4Ädä%W765T¤%„d4ód%%Dd4Ädä%W75uTd%u7„¥TedÄvD5Te$ÄVD%W75#d%7—„ETd„ód%#&„TÄdä%W76%T¤%s4ÄVÄ%eW6%T¤%f3uTdDã×5Sd%7—‡e´d&#—55Td%e7‡E´d%g§D%TÓU—…ETdÄÄF„5TSE—„¥TedÄs5Te„ód%6„TÄdä%W74³¤%7D4ÄVÄ%eW6%T¤%f3uTdfVµ5eTd%E7…eTedÄWD%W75Sd%W—†ÅTfÄÄdä%dÓuTdFDU5eTd%E7……Te„ÄWD%W75Sd%W—†ÅTfÄÄed%eSuTdfTU5UTd%57…ETeDód%w5cd%7—‡´d&T—53d%7—…%Te$Äed%eSuTdDã×4æ´¤%…d4Ädd%dW5UTd%W—„ÅTdÄÄD¤5TW•§D¥T×…%GD%Ud$Ädd%V·5eTd%eGD%TæÄfD%W76¤%wD4ÄWD%W75Sd%W—…eTedód%“”DÄE¤5Tc—…ETeDÄdd%d×53d%7—s´d$äT“u5TdDåUSu%TdE&§3t÷§3t÷§DedeÄtä%t×53d%•7…Tg…§D%Tç•$7…eTdäÄed%eW53d%7—…ETeDÄud%uW5Sd%W§D%Tã$7…eTdäÄfD%f753d%7—…ETeDÄud%uW5eTd%eGD%TãE$7…eTdäÄs”5Tge—„ÅTdÄÄdä%d×63¤%„ä4Ädä%dÓuTdFFµW5eTd%E7‡…´d&5T—53d%7—…ETeDÄ„ä5Tg¥—…eTedód%%‡dÄdd%V·5Sd%W§D%Tå”Äed%V·5UTd%U7„…TdÄód%%¤$ÄvÄ5Te$ÄVÄ%V·5d%G—‡%´d%e7…eTedÄWD%W765T¤%„d4ÄVÄ%V·5d%—„ÅTdÄó%¦DdÄS”%SƒuTdEDTW6T¤%dW55Td%e7‡%´d%e7…eTedÄWD%W76%T¤%s4ÄVÄ%V·53d%7§DåTãe%GD%Ud$Äed%V·5ETd%E7„…TdÄód%$¤$ÄvÄ5Te$ÄVÄ%V·5d%G—‡%´d%e7…eTedÄWD%W76C¤%†D4ÄVÄ%V·5d%—„…Td„ó%¦ÄdÄS”%SƒuTdEDTW6T¤%dW55Td%e7‡%´d%e7…eTedÄWD%W76C¤%†D4ÄVÄ%V·5#d%'§DåTÓ%GD%Ud%D7†¥TeÄtd%tdÄÄdd%SƒuTdDÓ—5cd%7—ƒ´d&ET¤”ÄS”%SuTdÆ$T×6C¤%s4ÄfD%f753d%3W5Cd%E7„eTddÄdä%dätÄS”%S5%Td%%7…ETeE%7…%TeÄS”%S‡5d%§D%Ugu&µ—5“d%G—„ÅTdÄÄWD%W74Ö´¤%D¤4ód%5EdDÄtä%dW5cdED7„ÅTdÄÄwD5TgE—…eTedÄUd%'„DÄdä%dä$ÄS”%S5%TdE¦—…¥Te¥7…%TeÄS”%S‡5d%—„eT×¥—…ETeDÄWD%W75£¤%vD4óÄ%#TDód%#W5UTd%57…eTedód%÷5eTd%57…%Te$ÄVD%W3uTdE¦·76T¤%dW55Td%57„ETeÄwD5TedÄed%eW53d%7—‡…´d&5T—55Td%57„ETdDÄWD%W3uETdDãW5Cd%G§D%TäÕ7‡´d%U7„¥TedÄwD5TedÄed%eW53d%7—‡E´d&%T—55Td%57„ÅTdÄó%7dód%%TW5eTd%57„åTdäÄVD%W3uTdE–´W6T¤%dW55Td%57„ETeÄwD5TedÄed%eW53d%7—ƒ5´d&C—55Td%57„ETdDÄVD%V3uETdDõUW5Cd%G§D%TäÕ7‡´d%U7„¥TedÄwD5TedÄed%eW53d%7—ƒ5´d&C—55Td%57„…Td„ó%¥ddód%%TdÔÄtä%S‡5•Td%•W75UTd%G§D%T×¥—……TdÄÄ…d5Tc¶w5Cd%EGD%WG5—ƒU´d&#—5cd%g—„ÅTdÅ7…TdäÄUd%UW5Sd%S—5Cd%E7„eTddÄdä%dädÄdd%S‡5Cd%G—„ETdDód%%„¤u&—†¥TeÄWD%W753d%7—s´d$äT“uTd¤ã×5¥Td%W—……TäôÄWD%W76%T¤%s”4Äed%eW5%TdF&´×5Sd%SW5Cd%E7„eTæÔÄfÄ%fÄ$Ädd%S‡5Cd%G—„ETdDÄUd%¤ä4Ädä%d×53d%7—‡´d&T“u5TdF4TÓu%TdE&§3t÷§DeWEÄS”%S‡5Cd$ÔT“uTdFDT×5uTd%U7„ÅTdÄÄs”eTge%GD%Ug&—…eTdäÄS%f·6¤%eW5eTd%e7„åTdäód%¥dDÄed%S5UTd%——‡%´d%e7…eTedÄS%SuTddõT×5Sd%7—†¥Tf¤ÄWD%W753d%7§DeT×e§3t÷§3tód%CW6ET¤%…d4Ädd%E$Dód%7dÄdd%V·53d%7—…eTedÄwD5Tg%¶·5£¤%uW55Td%57„åTdäód%¥dTÄtd%S‡5Cd%G—…ETeDóÄ%74ód%%TW5eTd%E7„ETdDÄwD5Tg%—‡´d&T—55Td%57‡e´d&#—53d%7—…ETeDód%&„u—†…Te$ÄVÄ%V·5#d%7—„åTdäÄWD%W753d%7—‡%´d&—6%T¤%s4ÄWD%W3uTddÓW5cd%G—…TeÄtd%td$Ädd%Sƒu%TdF4TÓuTdE&§D%v„õ•7‡…´d¥u7…TeódEvç4ÄVÄ%S4æ´¤%SG5ETd$æµt÷§3t÷§3t÷§3u%TcU¤äTÄfÄ%w5•TdE7ƒU´dE7ƒU´dE7‡¥´dE7‡e´dEGD%Tä$Ädä%W75“d%—§D%UgU—…ETdÄÄD$5TWu§D%T×e—…ETdÄÄD$5TWu§D%T×e—…ETdÄÄ…d5Tc§D%TÓ—…ETdÄÄ„d5Tg…§DeTÓ§3t÷§3t÷§DedeÄtä%t×53d%•7…Tg…§D%Tç•$7…%Td¤Ädd%dW5#d%7§D%TæÔÄfD%W75uTd%u7…ETeDÄfÄ%f·5d%'§D%Tãe—……TdÄÄfÄ%f·5Sd%W—…eTedÄWD%W76%T¤%s4ÄVÄ%V·5d%—„ÅTdÄÄTä%TÓu5TdFVµW5Cd%G§D%TäÔÄfD%W75uTd%u7…ETeDÄed%eW5d%'§D%Tã%—……TdÄÄfÄ%f·5Sd%W—…¥Te¤ÄWD%W765T¤%„d4ÄVÄ%V·53d%7—„ETdDóÄ%¥ddód%%TW5UTd%57„åTdäÄVD%W3uTdE–—……TdÄÄfÄ%f·5Sd%W—…¥Te¤ÄTä%V3uTdFV´×5cd%7—…¥Te¤Ädä%d×5•Td%•7„ÅTdÄÄ†D5Tc5—„¥Td¤ÄTä%T×5#d%'—„ETdDóÄ%“”dÄS”%SƒuTdED7……TdÄÄfÄ%f·5Sd%W—†…Tf„ÄTä%V3uTdDÕT×5cd%7—…¥Te¤Ädä%d×5uTd%u7„ÅTdÄÄ†D5Tc5—„¥Td¤ÄVD%V75d%§D¥TÓ5%GDeTät÷§3tód%3‡5Cd%G—…TWu§D%Tã—…¥Te$ÄWD%W76#d%s”dód%%wtÄed%S5ETd%u7‡%´d%e7…eTedÄS%SuTdDåT×5eTd%E7…%Tf¤ÄwD5TedÄed%eW5ETd%EGD%USU—…ETdÄÄtä%t×53d%7—„ÅTdÄód%“”4ód%“uTW¥&ÔW4Ö´¤%5f·5Cd%G§D%ƒe—„¥TdäÄs”5TdôÄS%†D4÷§3t÷§3tód&£—…¥Te¤Äud%…d4Ätd%„d4ód%¦DTÄdä%W75£¤%vD4ód%4¤4Ädä%W75“d%—§DeTç•§3t÷§3u%TdåG—„¥Td¤ÄWD%„d4ód%¦Ä4ÄfD%S‡53d%7—†¥Tf¤Ädä%d×5ETd%E7„ÅTdÄÄtd%tSu%TdDãuTdE&§D%%$$ÄVÄ%SÄD$5TcU—‡e´d%57„¥Td¤ÄTä%T×5Cd%G—…eTedÄTä%TÓuTdäÕU55Td%E7wu´d$ÔT“uTdÆV´—55Td%E7ƒ5´d%F—„åTc5$GDeeS5$7„¥Te„ÄS”%uSuTdfTT—5cd%G§DeTåTód%%S‡5uTd%u7…%Tge—…ETc5§D%TÓ5%7…ETdÄÄdä%dÓuTde¤7…ETdÄÄtd%tW5cd%7…Td$Ädä%TW5UTd%W§DeTÓ5§DeUf„Äed%eW5ETd$Ö´“uTd%7……Td%T7…ETd$ÄS%TW5ETd%7†…Td$ód%&„TÄfÄ%S5“d%——„ÅTdÄÄdä%dÓuTd¦$T×5eTd%57†å´d%£—5ETd%EGD%TãE§DåTätÄfD%f75£¤%vD4Ädd%f3uTdF4T×5“d%E7„¥Td¤ÄS%S5£D%vD„ó%'„”ód%%TW5uTd%E7ƒ´d&ET—53d%7—…ETeDód%%DäDÄed%V·6UT¤%†Ä4ÄS%SuTdF´ÓuETdE&—……Te„Ä†Ä5TcU—…%Te„ód%¦DDÄtä%S55Td%5GEeTå4ód%“uETdE&§D%Ud$ÄfD%W75Sd%W—…¥Te¤ÄS%S53d%7—…%Te$ÄS%S5•Td%•7‡e´d&#“u5TdFDU—5d%GDeTd$÷§3t÷§3t÷§Dedæ¤Ädd%÷5ETdE7…eTä$Ätd%¤¤4ód%TW5cd%TW5Sd%7„åTd$ÄS%TW5•Td%GD%T×¥—…eTd¤ÄfÄ%f·5UTd%U7†ÅTfÄÄS%SuTdDÓ×5¥Td%G§DåTåTód%%TW5uTd%E7……Te„ÄS%S53d%7—…eTedÄS%S5eTd%e7……Te„ód%'dÄed%V·5eTd%eGD%TæÄud%SƒuETdEdGD%Ud$ÄfÄ%S5cd%g—„åTdäÄWD%W75eTd%e7„åTdäÄed%eW5cd%g§D%Tç%7…eTd¤Äed%eSuTdEv—†ÅTeó%uTde7†…TeóÄ%5d%GDeTd$ód%%t×5eTdEv—„åTä$Äed%W5•TdDÖ´“uTd%7……Td%7…ETd$ÄS%TW5ETd%7†…Td$ód$Ó7e—…eTd$ÄVÄ%TW55Td%GD%E$…57…¥TdäÄS”%S‡53d%7—…Teód%#74ÄfÄ%S5“d%u7„ÅTd$ÄWD%W76%T¤%Ww5Cd%7…ETd$ÄVD%„d4Ädd%dW5eTd%7…Tfå§D%T×e$7…eTd¤ÄTä%T×5cd%g§D%Tæ´Äud%SƒuETdEdGD%Ud$ÄfÄ%S5•Td%u7„ÅTd$ÄWD%W75¥Td%D7…Td$Ädä%TW5#d&—5eTd%GD%Tçu—…eTd¤ÄTä%T×5cd%g§D%Tæ´Äud%SƒuETdEdGD%Ud$ÄfÄ%S5“d%——…eTedód%¦Ä4Äed%V·5d%‡6C¤%…d4ÄVÄ%V·5cd%g—„…Td„ód%¥dDÄvD5Te$ÄWD%W76C$%†DTÄfD%f75#d%'§D%TçU&—†ÅTeó%uTde7…¥TdäÄud%uW5eTd%eGD%T×e—…eTd¤ÄTä%T×5“d%—§D%Tç—†ÅTeó%uTde7…¥TdäÄ„d5Tg…—†…Tf„Ädä%d×5¥Td%¥7„¥Tdäód%%…$dÄfÄ%S5UTd%U7„ÅTdÄÄwD5Tg%—†…Tf„Ä†Ä5TcU—‡%´d&“uTdDã—5uTd%E7…%Te$ÄWD%W76¤%wD4Ätd%tW6UT¤%†Ä4ÄwD5Tg%§D%TÓ5&—…¥TdäÄdd%dW53d%7—‡%´d&—5•Td%•7‡¥´d&3—6¤%wD4ód%¤dtÄfÄ%S5UTd%U7„ÅTdÄÄwD5Tg%—†…Tf„Äs”5Tge—‡%´d&“uTdfTU—5eTd%5GD%Ud´Äed%V·5•Td%•7…ETeDÄtä%tÓuTdFDT×6¤%eW55Td%57w•´d$Ö´—5•Td%•7…TeÄS”%S‡5Cd%G—„ÅTdÄó%'„tÄS”%SƒuTdED7‡%´d%e7„¥Td¤Ä„d5Tg…—…eTedÄS”%S‡5Cd%G—…TeÄWD%W3uETdFVµSuTde7…¥TdäÄdä%d×53d%7—†¥Tf¤Äed%eW5Cd%G§D%UgU$7†…TeÄs5TgE—……TedÄWD%TW5•Td%•7ƒ´d%–—…Td$ÄWD%sDÄTä%T×5#d%7—„åTdäÄTä%V75d%§D%Uc%&—†…TeóÄ%5d%GDeTd$ód%%dW6¤%G5£¤%W6#¤%#4ód$ã%—…%Td$ÄVÄ%TSuTSE6¶·5UTd%57‡´d%£—53d%7‡%´d%7…Td$Ädä%TW5¥Td%£—6¤%v„4ÄS”%TW53d&TÓuTdF6µ5eTd%E7†ÅTf¤ÄWD%TW6¤%TW5Cd%7…ETd$Äud%vD4ÄvD5Tfõ—…Td$ÄWD%7D4ód%3#TTÄdd%V·5£¤%vD4Ä†Ä5TcU§D%T×¥—†¥Te$ód%CuETdE&§D%Tä$Ä„ä5Tfå§D¥Tç5§D%Ud$ÄfD%S‡55Td%57‡%´d&—5¥Td%¥7……Te„ód%7Tód%%t×5eTdEv—„åTä$Äed%W5•TdDÖ´“uTd%7……Td%T7…ETd$ÄS%TW5ETd%7†…Td$ód&$Wwe—…eTd$ÄVÄ%TW55Td%7„¥Td$ód&%W„¤ÄfÄ%S5Cd%G—„ÅTdÄÄS”%SƒuTd†V´—5uTd%E7…eTeDÄWD%TW53d%7—†ÅTdÔÄS”%TW5Sd%7„…Tg§D%Tæõ—…eTd¤ÄTä%T×5UTd%UGD%Tå”Äud%SƒuETdEdGD%Ud$ÄfÄ%S6#¤%s”4ÄS”%SƒuTdF´×5eTd%57„ETdDÄs5TgE§D%Tã—†ÅTeó%uTde7…¥TdäÄ„d5Tg…—‡%´d&—6%T¤%s4Äud%uW55Td%EGD%Ug•&—…¥TdäÄdd%dW53d%7—‡E´d&%T—6¤%wD4Ä…d5Tc—‡%´d&“uTdF¶75uTd%E7…%Te$ÄWD%W76%T¤%s4ÄwD5Tg%—ƒ´d&ET—6¤%wD4ód%'„ÄfÄ%S5UTd%U7„ÅTdÄÄs5TgE—‡%´d&—6#¤%s”4ÄwD5Tg%§D%TÓU&—…¥TdäÄdd%dW53d%7—‡E´d&%T—6¤%wD4ÄwD5Tg%—‡%´d&“uTddåU—5eTd%5GD%Ud´Äed%V·6¤%wD4Äs5TgE—†¥Tf¤ód%4¤TÄwD5TedÄVÄ%V·4Ö´¤%D¤4Ätd%tW5Cd%G—…TeÄS”%S‡53d%7§DåTç5&—…Teód%w6¤%eW55Td%57‡…´d&5T—5eTd%e7…TeÄS”%S‡5Cd%G—„ÅTdÄó%7dód%%TW5uTd%E7…ETeDÄWD%W75“d%——…eTedÄS”%SƒuTdf&µ5eTd%57‡%´d&—6ET¤%…d4ód%¤äDÄud%S‡6%T¤%s4óD%6„4ÄWD%TW6¤%wD4Ä„ä5Tg¥—„åTcE—…Td$ÄWD%E¤DóD%¦DDÄWD%TW6¤%wD4Ä„ä5Tg¥—„åTcE—…Td$ÄWD%E¤Dód%¦DDÄVD%UW53d%7‡%´d&—63¤%„ä4ÄS%†„DÄS”%TW53d$æ´ÓuUTdFµuETdE&—…Teód%w5¥Td%G—‡E´d&%T—55Td%57„…TdÄÄS%S5d%'§DåTÓU§D%VD$Ätd%S‡5eTd%e7„¥Td¤ÄVD%W75#d%7—„eTd¤ód%%sTDÄed%V·6%T¤%s4Ä„ä5Tg¥§D%T×¥—†å´d%U7…eTedÄVÄ%V·5#d%7—„…TdÄÄUd%V³uETdFDTÓuTde7†…TeóÄ%5d%GDeTd$ód%%dW6%T¤%G6T¤%W6#¤%#4ód&TS“%—…%Td$ÄVÄ%TSuTcUC·5eTd%E7…%Te$Äs5Td$ÄS”%TW5Sd%7†å´d&T“uTdDÃ—5UTd%57„ÅTdÄÄed%eW53d%7—„åTdäÄ„d5Tg…§D%Tç$7†¥Te$ÄWD%W75£d%vDdóÄ%“”dód%%TW5UTd%57…eTeDÄWD%TW6%T¤%TW5Cd%7…ETd$ÄvD5Tg—……Tg—…Td$ÄWD%D¤4ód%6„DÄed%S5eTd%W—„ÅTd$Äs5Td$ÄS”%TW5Sd%7†å´d&T—5cd&´—5Cd%7„ÅTW•§D%W7…—…%Td¤Ädä%d×6UT¤%†Ä4ód%4$DÄtä%dW53d%7—†å#d%£3uTdDã75¥Td%W§D¥Tå”ód%%TW5cd%G—„¥Td¤ÄwD5Tg%—…%Te$ÄS%Su%TdDãÓu%TdeU7†¥Tf¤Äed%…d4Ädä%„äDód%'tÄed%S5Sd%W—„¥Td¤Äed%eW5eTd%e7…Teód%%FÄDÄdd%V·53d%7—…¥Te¤ód%#T4ÄfÄ%S5Sd%W—„¥Td¤ÄvD5Tfå—„åTdäód%7DÄfD%W75cd%g—„¥Td¤ÄS%SuTdDÕT—5•Td%G—†¥Tf¤ÄWD%W75cd%g§D¥Tã%§D%Ud$ÄfD%Sƒu%TdEdGD%TätódF$deÄVÄ%S6#¤%s”4ód%“”4ÄS%Su%TdEF—…¥Te¤ód%%uUdÕG—…ETeDÄfD%f753d%•7„åTg¥§D%US$7„åTd¤ÄS”%S‡5UTd%U7…¥Te¤Ädd%dW5#d%57…%Teód%#'„TÄS%V·5£¤%vD4ÄWD%W755Td%57„ÅTdÄÄS%S53d%7—„…Td„ÄVD%V3uTdFµ5cd%G—„ÅTdÄÄdd%dW4ÔT¤%D$4ÄVÄ%V³u%TdF4UuTd…7„åTd¤Äs5TgE—„ÅTdÄÄVD%V75%Td%'—…%Teód%#7DÄS%V·5£¤%vD4ÄWD%W75#d%'—„eTd„Ädd%SƒuTd†DT×5ETd%57†…Tf„ÄWD%W75#d%'—„eTd„Ädd%SƒuTd†&´×5Sd%G—…Teód%&„4ódUdTW55Td%ES‡4ÔT¤%†Ä4Äs”5Td¤ÄVÄ%V·5d%—…TeÄed%eW5d%§D%WGU$7„¥TdäÄ„ä5TdôÄS%„äTód&ET—¥$7„¥Te„ÄS”%uSuTdfTT—5cd%G§DeTåTód%%S‡5uTd%u7…%Tge—…ETg¥§D%3”DÃW5UTd%7„¥Td$ÄVÄ%TSuTfå$V·5Sd%7—…ETeDód%%u5Sd%7—‡¥´d&5T—53d%7……Td$ÄS”%TW5Sd%7…%TeDÄ…d5TeTÄS”%TW53d$³“uTdFVµ5Sd%7—‡…´d&#—53d%7……Td$ÄS”%TW5Sd%7…%TeDÄ„ä5TeTÄS”%TW53d$ôT—5d%—w%´d$³“uTdFFµ—5Sd%7—†å´d%¥7„ÅTd$ÄfD%TW5Cd%7…ETd$Ädd%d×6T¤%e5Cd%7„ÅTcU§DeT×e§DeUf„Äed%eW5ETd$Ö´“uTd%7……Td%T7…ETd$ÄS%TW5ETd%7†…Td$ód%&„TÄfD%W75Sd%W—…eTedÄS%S53d%7—…%Te$ÄVÄ%V³u5TdFµ5d%GDeTd$ód%%t×5UTd%U7„åTg…§D%Td$ÄfD%Td$Ädä%TW5ETd%7„åTd$Ätd%TSuTdFVµ5uTd%E7……Te„ÄS%S53d%7—…eTedÄVÄ%V³uTdDÕT×5eTd%57…¥Te¤ÄS%SuTdF4T—5¥Td%G§DåTåTód%%TW5uTd%E7……Te„ÄS%S53d%7—…eTedÄVÄ%V³uTdDÕT×5eTd%57…¥Te¤ÄS%SuTdF4T—5¥Td%G§DåTåTód%%TW5•Td%G§D¥TåTÄTä%TSu%Td%GDeUf¤Äed%eW5ETd&3ÓuTd%7……Td%7…ETd$ÄS%TW5ETd%7†…Td$ód&Vµfõ%7…eTd$ÄVÄ%TW55Td%GD%D$e57…¥TdäÄS”%S‡53d%7—…Teód%#74ÄfÄ%S5“d%u7„ÅTd$ÄWD%W76%T¤%Ww5Cd%7…ETd$ÄVD%„d4Ädd%dW5eTd%7…Tfå§D%T×e$7…eTd¤ÄTä%T×5cd%g§D%Tæ´Äud%SƒuETdEdGD%Ud$ÄfÄ%S5•Td%u7„ÅTd$ÄWD%W75¥Td%D7…Td$Ädä%TW5#d&—5eTd%GD%Tçu—…eTd¤Ätd%tW5ETd%EGD%Tç•—†ÅTeó%uTde7…¥TdäÄtä%t×5eTd%eGD%TÓU—…eTd¤ÄTä%TåÄ†D5Tc—„¥Td¤ÄfD%f75#d%'§D%TÓ—†å´d%U7„ÅTdÄÄ„äUTg¥$7……Te„ÄVD%V3uTdFµ—5¥Td%G§DåTåTód%%TW5uTd%E7†…Tf„Äed%eSuTdDã—5eTd%57„ETdDÄfÄ%f³uTdE¦—†ÅTeó%uTd…7…¥TdäÄtd%tW5cd%g§D%TÓU—…¥TdäÄ…d5Tc—„¥Td¤ÄVÄ%V·53d%7—‡´d&T“uTdDÓ5eTd%57„ETdDÄ„d5Tg…—„¥Td¤Äed%eW5#d%'§D%Tãe—†¥TdäÄVÄ%V·5ETd%E7ƒUd&UT×5eTd%e7‡E´d&%T“uETdFTU“uTde7…eTd¤ÄvÄ5TW%§D%TçU$7…eTd¤ÄWD%W763¤%„ä4ÄfD%f76¤%wD4ÄS%SuTdFUW4ÔT¤%wD4ÄWD%TW5ETd%E7„ÅTdÄÄwD5Tg%—……Te„Ätä%t×5ETd&DU5Cd%7„ÅTS$GDåTæõ&§D%Ud$Ätd%SƒuUTdED7†…Tf„ód%$—5ETd%E7……Te„ód%'4Ädä%d×5cd%g§E%Tçu—…ETeDÄfD%f3uUTdF4T—63¤%„ä4ÄfD%f3uUTdF´×6#¤%s”4ÄfD%f3uUTdDÃ—5uTd%u7……Te„ód%5¤4Äs”5Tge—……Te„ód%“”4ód%W5uTd%u7……Te„ód%5¤4ÄwD5Tg%—……Te„ód%¦D4ÄF„5TSE—……Te„ód%7DÄE¤5TS%—……Te„ód%6„DÄvÄ5Tg—……Te„ód%¥d4ÄvDETfå—……Te„ód%¤äDÄE$5TS—……Te„ód%5¤DÄvD5Tfå—……Te„ód%¤ä4Ä„d5Tg…—……Te„ód%&„DÄtä%t×5cd%g§E%Tãe—‡´d&T—5cd%g§DåTÓU§D¥TätÄTä%TSu%Td%GDeUf¤Äed%eW5ETd&3ÓuTd%7……Td%T7…ETd$ÄS%TW5ETd%7†…Td$ód&DVÆõ%7…eTd$ód&EVÄ¤ÄfÄ%S5Cd%G—„ÅTdÄÄS”%SƒuTd†V´—5uTd%E7…eTeDÄWD%TW53d%7—†ÅTdÔÄS”%TW5Sd%7„…Tg§D%Tæõ—…eTd¤ÄTä%T×5UTd%UGD%Tå”Äud%SƒuETdEdGD%Ud$ÄfÄ%S5•Td%•7…Teód%¤d4Äed%V·5d%—…¥Te¤ód%%—5¥Td%G§DåTåTód%#W5eTd%57„ETdDÄWD%W75“d%—§D%Tã—†¥TdäÄVÄ%V·5ETd%E7sE%Td$ôUSuETdFV3uTd…7…eTd¤ód%÷5eTd%57„ÅTdÄÄ„ä5Tg¥—……Te„ÄfD%f75UTd%U7……Te„ÄfÄ%f·55Td%5GD%Tã&—‡%´d%e7„åTdäÄWD%W75Cd%G—†¥Tf¤ÄfD%f75cd%g—…Teó%7dód%%TW5•Td%G§E%TäÔÄtd%tSuUTdE–—‡´d&T—5cd%g§E%TÓ—…%Te$ÄfD%f3uUTdF&´—63¤%„ä4ÄfD%f3uUTdF´×6#¤%s”4ÄfD%f3uUTdDÃ—5•Td%•7……Te„ód%6„4ÄvÄ5Tg—……Te„ód%¥d4Äs”5Tge—……Te„ód%“”4ÄfD%f75cd%g§E%Tã—‡%´d&—5cd%g§E%TÓ5—…ETeDÄfD%TW5Cd%7…eTe„ód%4$4ÄS”%S‡5cd%g§E%Tç5—…ETeDÄfD%f3uUTdF4T—6%T¤%s4ÄfD%f3uETdFTÓu5TdE&—„ETd$ód%TSu%Tde——‡%´d&—5Cd&UuTd%7……Td%7…ETd$ÄS%TW5ETd%7†…Td$ód&·‡U&—…eTd$ód&„¤ÄfÄ%S5Cd%G—„ÅTdÄÄS”%SƒuTdfV´—5uTd%E7…eTeDÄWD%TW53d%7—……TdÔÄS”%TW5Sd%7„…Tf¤ÄWD%TSuTddã—5eTd%57…eTedÄS%SuTdF$T—5£¤%dSueTdEF—sEd$ôT×53d%7§E%Tç•$GD%Tä$Äud%SƒuETdEdGD%WD$Äed%V·5uTd%£×5Cd%G§D%V7¥—…eTd¤ÄS”%S‡5“d%——„åTdäód%¦D4Ätä%S5•Td%•7„åTdäÄWD%W75Cd%G—†¥Tf¤Ätä%t×5Cd%G—…eTedód%'„tÄtä%S5Cd%G—„¥Td¤ÄWD%W75d%—…eTedÄVD%V75%Td%%7„åTdäÄS”%S‡5Sd%W—„ETdDód%¦DTÄs”5Te¤ÄVÄ%V·5£¤%vD4ÄVÄ%V³uETdFDTÓuTde7…eTd¤Ätd%tW5ETd%EGD%Tç•—†å´d%UGEeTäôÄF„ETSE—„ÅTdÄód%4¤Tód%W5¥Td%G§DåTåTód%%TW5uTd%E7…ETeDÄVÄ%eW6#¤%f³uTdF6´×5•Td%G—„åTdäÄS”%S‡5eTd%e7……Te„ÄfD%f·53d%7—…TfÄÄdd%dW55Td%57„ETdDÄUd%UW5ETd%E7„ETdDÄed%eSuTdFF¶75£¤%dW5ETd%E7„ÅTdÄód%#T4ÄvD5Te$ÄWD%W76EU$%…dTód%4$dÄud%SƒuETdEd7„ETdDóÄ%w5d%GDeTd$ód%“uUW¥ES‡55Td%E7…eTdôÄS%tÓt÷§3t÷§DeD¤Ev—…¥Te¤Ädd%D¤4ód%¥dDÄdä%W75UTd%U7…Teód%4$4Ädä%W75Cd%G—…Teód%#T4Ädä%W75cd%g—…Teód%5¤4Ädä%W76#¤%s”4ÄS”%SƒuTdFT×5Sd%7—†¥Tf¤ÄS”%SƒuTdDÕT—5Sd%7—…ETeDÄS”%Sƒu%TdFF´“t÷§3t÷§3tód%S‡5Cd%G—…Tg…§D%Tç—…ETdÄÄdä%d×5Cd%G§D%Ug•—…%Td¤ÄWD%W75UTd%UGD%TæÔÄfD%W75Cd%G—…TeÄWD%W3u5TdDÕT“uTde7…%Td¤ÄWD%W76%T¤%s4ód%¤d4ÄfD%W76¤%wD4ÄS”%Sƒu5TdFTÓu%TdE&§D%TätódFFµeÄVÄ%S63¤%SG5ETd&3u%TdDÓ55Td%g—…TfÄód%%†„4ÄfD%Sƒu%TdEdGDeeeÄfÄ%f·5UTd&#—5Sd&3ÓuTce“”dÄdd%TW55Td%7„¥Td$ÄVÄ%TW55Td%GD%D$557…ETdÄÄdä%dÓuTde¤7…eTdäÄtd%tW5cd%7…Td$Ädä%TW5UTd%W§D%TÓ—…eTdäÄ…d5Tc—……Td$ÄS”%TW5Sd%7…%TeDód%%…$DÄdä%W76#¤%s4ÄWD%TW5cd%7…Td$Ädä%TW5UTd%W—‡…´d%d7…Td$ÄWD%E¤4ÄVÄ%V·4ÔT¤%D$4ÄS%SuTdFVµ—5Sd%7—‡…´d&#—53d%7……Td$ÄS”%TW5Sd%7…%TeDÄ„ä5TeTÄS”%TW53d$ôT—55Td%57w•´d$Ö´—5ETd%EGD%TÓ&—…ETdÄÄwD5Tä”ÄWD%TW5cd%7…Td$Ädä%TW5UTd%W—‡E´d%d7…Td$ÄWD%D¤4ÄVÄ%V·6C¤%†D4Ädd%dW5%Td%%7…¥Te¤Ä„d5Tg…—„ETdDód%4¤„Ädä%W75£¤%uW53d%7……Td$ÄS”%TW5Sd%7…%TeDÄvÄ5TeTÄS”%TW53d&UT—55Td%57‡¥´d&3—5UTd%U7„eTddÄfD%f75d%§D%TÓ5&—…ETdÄÄtä%tW53d%7……Td$ÄS”%TW5Sd%7…%TeDÄud%e5Cd%7„ÅTc—„¥Td¤Äs”5Tge—„åTdäód%7dód%%tW5eTd%e7„åTW•§D%Td$ÄfD%Td$Ädä%TW5ETd%7„åTd$Ätd%TSuTdFU5uTd%E7„ÅTdÄÄfD%f75eTd%e7„¥Td¤ód%4$DÄfÄ%S53d%7—†ÅTfÄÄed%eW55Td%5GD%TãE—…¥TdäÄWD%W76T¤%vÄ4Äed%eW55Td%5GD%T×…—…¥TdäÄWD%W75•Td%•7…eTedÄVÄ%V³uTdFDT×5uTd%E7„ÅTdÄÄwD5Tg%—…eTedÄVÄ%V³uTddÓ×5uTd%E7…TeÄWD%W75Sd%W§D%T×¥—…¥TdäÄfD%f753d%7—…ETeDód%53”4Äed%V·5UTd%U7…eTedód%4$4Ätä%S5eTd%e7„¥Td¤Ädd%dSueTdDÕT—5Cd%G—„ÅTdÄód%÷6%T¤%s4ÄWD%W75Sd%W§EeTç—†…Tf„ÄWD%W75Sd%W§EeT×¥§EeTä$Ädd%dW53d%7—…ETeDód%5$4ód%—5d%§D%UdTÄtd%W75Sd%W—…eTedó%¤d4óÄ%—5d%GDeTd$ód%“t÷§D%5¤UG—„¥TdäÄS%SG5“d&—5UTd%UGD%Td$ód%TSuTd%GD%Td$ód%TSuTd%7„e†D6TT—5uTd%u7…%Tc§D%TãE—…eTdäÄS%SuTdev—…ETdÄÄfÄ%f·5Cd%G§D%TãE—…ETdÄÄs”5Tge—…Teód%&„DÄdä%W76C¤%†D4ÄS”%SƒuTd%7„eTã§D%Td$ód%TSuTd%GD%Td$ód%TSuTd%GD%Td$ód%TW5%TeEG—…TeÄS”%„d4ód%'DÄed%S5Cd%G—„ÅTdÄód%%w„4Ädd%V·53d%7—ƒ´d&ET“uTdDõT—5cd%7—‡¥´d&3—5Cd%G§D%Td$ÄVÄ%4$Dód%%TW5UTd%57„ÅTdÄÄs5TgE§D%T×…—……TdÄÄwD5Tg%—…TeÄWD%W3uTd%7„¥Tç•§D%Ud$Ädd%V·53d%7—……Te„ód%'„4ÄfD%W75eTd%e7…%Te$ÄTä%T×5•Td&“uTdFTT×5uTd%57…ETeDÄdd%dSuTdF&´—6%T¤%d×5Cd%G—„ÅTdÄód%TW5UTdFF´“uTd%7„åTätÄTä%TÓuTd%7„¥Tä”ód%TW5%TdE&§D%Tät÷§3uTçU%TW5uTd%uuW5•Td%g§D%c%—…¥Te¥7†…Te„ódE…¤4ÄfÄ%fÄ$Ätd%f3uTäfF´—5uTd%uTW5•Td%g§D%3£%—…¥Te¥7†…Te„÷§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3tódõ%…¤4ÄVÄ%S6C¤%wDT÷§DeUc$7„¥Td¤ód%÷5ETd%EGD%Tå4ód%uS‡5Sd%W—‡…´d&5T—5Sd&C—5uTd$³“uTdDÕU—5ETd%57…ETfÄÄwD5TedÄUd%UW53d%7—„ÅTdÄód%5¤DÄfÄ%dW5•Td%•GDeTã%—…Teód%÷5uTd%£—5cd%g—‡¥´d&3—5eTd%eGDeTÓU$GD%TätódU¤S‡55Td%E7‡¥d%F—„åTWu§DeW7e—„¥Te„Äed%E$4ód%4¤DÄfD%S‡5UTd%U7„¥Td¤ÄWD%W75Sd%W§DeTçU§DeUeÄfÄ%f·5UTd&#—5£¤%†ÄDód%¦ÄdÄdä%W75eTd%eGD%TæÔÄdä%W76¤%wD4ód%5¤4Ädä%W75uTd%u7„ETdDód%4$4ód%%S‡5£¤%†ÄTÄWD%dW5Cd&UTÓuTdDÃ75UTd%57…ETeDÄS%SuTdF´—5cd%7—†å´d%£—5#d%'—„¥Td¤óÄ%¦Ä4ód%“u%TdeG—…¥TäÔÄWD%W5CdE7‡…´dEEGD%TäôÄdd%V·5Sd%W—„åTdäód%'4ÄfÄ%S5UTd%U7„¥TedÄtä%S5%Td%%7…eTedÄWD%W3uTddÃ×5eTd%57‡…´d&5T“uTdFF´—5“d%E7‡e´d&#“uETdDåT“uTdE—……TdÄÄvD5Tc5—„…Td„ÄVÄ%V³u5TdFF´Óu%TdE&§DeUf„Ätä%w53dE7†ÅTä$ÄvD5TæÄód%TW5cd%T×5Sd%7„åTd$ÄS%TW5•Td%GD%TæÔÄfÄ%S5cd%g—„åTe¥7…ETd$ÄS%TW5ETd%7†…Td$ód%¤ä4ÄfÄ%V·6T¤%vÄ4ÄS%SuTdFV´—5£¤%S5eTd%e7„åTdäÄWD%W75UTd%U7†¥Tf¤ÄWD%W76T¤%vÄ4ÄWD%W75•Td%•GD%VCe&—†¥Td¤ÄfD%f75ETd%EGD%TçU—‡e´d%UGF¥TäôóÄ%“uTdEGEeTätód%%TW5“d%57†å´d%£“uTdF$T—6Tä%„d4Ädä%d×5ETd%EGEeTã§E%Tätó%—5d%7„…Td„ód%%Vw5cd%7—…eTedÄWD%W75Cd%G§D%UW¥—†…TeóÄ%5d%GDeTd$ód%%tW65T¤%w53dE7†¥Tä$ÄvD5TæÄód%TW5cd%TW5Sd%7„åTd$ÄS%TW5•Td%GD%TæÔÄtd%S‡53d%7—†¥Tf¤ÄWD%W75£¤%vD4ÄS”%S‡5%Td%%7…TeÄtd%tW55Td%57…%Te„Ätä%tÓu5TdDÓ75d%GDeTd$ód%“uVG&´W55Td%7†å´d%GD%d$ÄVÄ%TdDÄvÄ5Td$ódEC‡55Td%E7ƒU´d&UT“t÷§3u%Td¦4T×5ETd%EG3t÷§DeWDôÄdd%dSt÷§3u%TdÅV—†¥Tf¤÷§3tód%3%55Td%5GD%TäôódFV´¥ÄVÄ%S5£ä%vDDód%¤äDÄS%Su%TdEF—‡%´d&“u%TdF$T—6%T¤%s4ód%4¤4ódE6´W55Td%E7ƒ5´d&tód%%…$TÄWD%Stód%%SG5ETd%EGD%Tå4ód%c‡5Sd%W—‡…´d&5T—5Sd&5TÓuTdFTUW5ETd%57…ETfÄÄwD5TedÄUd%UW53d%7—„ÅTdÄód%5¤DÄfD%S‡5UTd%UGDeTç—…Teód%w5cd%G—‡¥´d&ET—5UTd%£—5UTd%UGDeTãE$GD%TätódÕV³‡55Td%E7†å´d%F—†¥Tg%—ƒ´d%¥GDe†E†DU5uTd%u7†…Tg¥—„ETdDÄVD%V3uTcEt†„TÄdd%TSuTcUtV·5eTd%E7„eTddÄtä%TW5¥Td%——†å´d%TW5¥Td%¥7„ETdDód&$VƒE—…ETeÄvDETfå§D%Tã%—…ETeÄvDETfå§D%Tã%—…ETeÄvÄETg§D%SE—…ETeÄS%SuTe–—…ETeÄvD5Tg¥§D%S5—…ETe$Ä„d5Tg…§D%uS5—…ETe$ÄvÄ5Tg§D%†D6V´—5Sd%U7†…Tg…—ƒ´d&ET“uTc5ä$dÄdä%dW6#¤%sTÄF„5TSE§D%fCe&—…ETe$Ätd%tSuTg¥ÓT4Ädd%V·5cd%g—ƒ´d&ET“uTdF4T×6T¤%f75•Td%•GD¥T×…§D%Tä$ÄfD%S‡5cd%g§D%VG5—†ÅTe„ÄS%SuTdF´—5¥Td%g—…ETeDód%4$4Äud%f75cd%g§D%VC—…ETdÄÄfD%vÄ4Ä„ä5Tf¤ÄS%SuETdF$T×6#¤%f³tó%÷6#¤%f³tó%÷6#¤%f³tó%÷6#¤%f³uETdEv—‡e´d%uGDåTç5§E%TädÄfD%f75%Td%%7…TeÄVÄ%eW5“d%E7„…TdÄÄVD%W75d%'—„eTddód%#TTÄvD5Tfå—„eTddÄS”%S‡55Td%e7†å´d%U7„eTddód%¦DDÄfÄ%f·5%Td%%7…TeÄUd%V³uUTdFV´—63¤%„ä4ÄUd%UW5Cd%G—„¥TedÄvD5Te$ÄUd%USuUTdF&µ6¤%wD4ÄUd%UW5Cd%G—„¥TedÄtä%S5#d%7—„…TdÄÄTä%V75%Td%%GE%T×…$7‡¥´d&3—5%Td%%7…TeÄWD%W3uUTdF4T×6Tä%vÄDÄUd%UW5Cd%G—„¥TedÄvD5Te$ÄUd%USuUTdDõU6#¤%s”4ÄUd%UW5Cd%G—„eTd¤ód%'DÄ„d5Tg…—„eTddÄS”%S‡53d%7§E%TçU—†åd%£×5%Td%%7…TeÄVÄ%eW5£¤%dW5%Td%%GE%TÓ5$7wu´d$ÔT—5%Td%%7…TeÄUd%V³uUTdFF´×6#¤%s”4ÄUd%UW5Cd%G—„¥Td¤ód%'DÄ„ä5Tg¥—„eTddÄS”%S‡55Td%5GE%TçU—†¥Tf¤ÄUd%UW5Cd%G—„¥TedÄtä%S5#d%7—„…TdÄÄTä%V75%Td%%GE%Tã$7†ÅTfÄÄUd%UW5Cd%G—„ÅTdÄód%¦D4ÄD$5TWu—„eTddÄS”%S‡55Td%e7†å´d%U7„eTddód%5¤TÄD$5TWu—„eTddÄS”%S‡55Td%e7†¥TdäÄVD%W75#d%7—„ETd„ÄUd%USuUTdF$UW6#¤%s”4ÄUd%UW5Cd%G—„ÅTdÄód%'„DÄ7D5TW%—„eTddÄS”%S‡55Td%e7†å´d%U7„eTddód%¥dTÄ„ä5Tg¥—„eTddÄS”%S‡5%Td%5GE%TçU—‡d&T×5%Td%%7…TeÄUd%V³uUTdDõT×6UT¤%†Ä4ÄUd%UW5Cd%G—„eTd¤ód%5$DÄed%eW5%Td%%7…TeÄVÄ%eW5“d%E7„…TdÄÄVD%W75d%'—„eTddód%'„TÄs5TgE—„eTddÄS”%S‡5%Td%5GE%Tæõ—ƒ5´d&C—5%Td%%7…TeÄVÄ%eW5£¤%dW5%Td%%GE%Tç•$7s%´d$æ´—5%Td%%7…TeÄWD%W3uUTdDÓ×6Cä%†DDÄUd%UW5Cd%G—„¥TedÄvD5Te$ÄUd%USuUTdF6µW6#¤%s”4ÄUd%UW5Cd%G—„eTd¤ód%'DÄs”5Tge—„eTddÄS”%S‡55Td%e7†¥TdäÄVD%W75#d%7—„ETd„ÄUd%USuUTdDåU4ÔT¤%D$4ÄUd%UW5Cd%G—„eTd¤ód%5¤DÄ†D5Tc5—„eTddÄS”%S‡53d%7§E%Tã—‡Ed&%T×5%Td%%7…TeÄVÄ%eW5£¤%dW5%Td%%GE%Tæõ%7wu´d$ÔT—5%Td%%7…TeÄUd%V³uUTdFF´×4ÔT¤%D$4ÄUd%UW5Cd%G—„eTd¤ód%5¤DÄD$5TWu—„eTddÄS”%S‡5%Td%5GDåTãe§ETä$ÄWD%TW5cd%g—†…Te”ÄS”%TW53d&ET—5d%§D¥T×…—„ETdDód%#5Sd%7—…eTedÄed%eSuTd†V´—5Sd%7—wu´d$ÔT“uTd„Ã—5Sd%7—ƒ5´d&C—5ETdDÓ“uETdE%7„…Td„ÄS”%S‡5UTd%U7„ÅTdÄÄvÄ5Tg—„ETdDÄUd%UW55Td%57„ETdDÄTä%T×5Cd%G—„ÅTdÄÄS%S5#d%'—„ÅTdÄÄVÄ%V·53d%7—„eTddó%5$tÄWD%W75£¤%vD4ÄD¤5TW•—‡…´d&5T—53d%7—†…Tf„ÄTä%T×53d%7§DåTÓ5&—„ÅTdÄÄ…d5TäTÄwDETg%—‡…´d&5T—53d%7—‡e´d&#—5d%—„ÅTç&§DåTä´ÄWD%W765T¤%„d4ÄvDETfå—‡…´d&5T—53d%7—‡%´d&—5d%—„ÅTdÄóÄ%¦Ä„ÄUd%UW53d%7—„…Td„ód%%f÷5Sd%7—‡%´d&—5d%—……Te„ód%'DÄfÄ%S5£¤%vD4Ädä%uW6¤%eW5%Td%%GD%Ug$7…¥TdäÄed%÷5Cd%G—…%Te$Äud%TW5¥Td%7„ETd$ÄVD%W753d%7—‡´d&T—5d%7„…TdäÄWD%W75Cd%7„ETeDÄUd%¤äTÄS”%S‡5d%—„ETdDÄS”%S‡53d%7—„åTdäÄTä%T×5d%—„ÅTdÄÄUd%'„DÄVÄ%V·5d%—„ETdDÄS”%S‡53d%7—„åTdäÄfD%f753d%7—„¥Td¤ÄWD%W75%Td%%7„eTçU$7„ÅTdÄÄVÄ%V·55Td%5GD%VG5—†…TeÄud%uW5eTd%e7…Teód%5¤DÄtd%S‡6T¤%vÄ4Äed%eW5Cd%G§D%Se—…eTd¤ÄvD5Tfå—„ÅTdÄód%5¤4Äud%S‡6T¤%vÄ4ÄS”%S‡5¥Td%¥GEeTÓ§EeTä$ód%“uETdE&§D¥Tätód%“u%Tg5•TW55Td%g—…%Tg…§D%TÓU—……TeÄWD%W75Sd%W—…eTedód%'Dód%W55Td%g—„åTdäÄS”%s”4ód%#TDÄdä%W75Sd%W—…eTedÄdd%dSu%TdF$TÓu%Tde7„¥Te„ÄS%E$4ód%4¤DÄfD%S‡53d%7—…ETeDÄVÄ%V³u%TdDÓ“u%TdE7„¥Te„ÄVÄ%V·5Cd$æ´“uTdDÕT×5Sd%7—…ETeDÄVÄ%V·5UTd%UGDeTÓ§DeUd$ÄVÄ%f75uTd&ÓuTdDÓ×5cd%G—„ÅTdÄÄdä%d×5eTd%eGDeTç§DeTä$ÄVÄ%f75eTd%e7…TS%§D%Tæõ$7…ETdÄÄdä%d×5eTd%e7…%Te$ód%'„Dód%%TW55Td%g—†¥TS%§D%Tã—……TeÄWD%W75Sd%W—…¥Te¤ód%#TDód%W55Td%g—…¥Te¤ÄS”%„ä4ód%¤äDÄdä%W75Sd%W—…¥Te¤Ädd%dSu%TdF4TÓu%Tde7„¥Te„ÄfD%†D4ód%'DÄfD%S‡53d%7—…ETeDÄdä%dÓu%TdFTÓu%TdE7„¥Te„Ädä%d×5Cd&#“uTdFDT×5Sd%7—…ETeDÄdä%d×5UTd%UGDeTç§DeUd$ÄVÄ%f76#¤%E$4ód%4¤DÄfD%S‡53d%7—…ETeDÄwD5Tg%§DeTãe§DeTä$ÄVÄ%f76¤%wD4ÄS”%uSuTdDÕT×5Sd%7—…ETeDÄwD5Tg%—…%Te$ód%¤dDód%%TW55Td%g—†¥Tge§D%TÓ5—……TeÄWD%W75Sd%W—…¥Te¤ód%#TDód%W55Td%g—…¥Te¤ÄS”%E¤4ód%'„TÄdä%W75Sd%W—…¥Te¤Ädd%dSu%TdF4TÓu%Tde7„¥Te„Äs5Tfå§D%Tãe—……TeÄWD%W75Sd%W—‡´d&T“u%TdFTTÓu%TdE7„¥Te„ÄvÄ5Tg—…Tge§D%TÓU—…ETdÄÄdä%d×6T¤%vÄ4Ädd%dSu%TdFV´Óu%Tde7„¥Te„Ä…d5TS%§D%Tã$7……TeÄWD%W75Sd%W—‡…´d&5T“u%TdDåTÓu%TdE7„¥Te„Ä„d5Tg…—…TS%§D%T×¥$7…ETdÄÄdä%d×65T¤%„d4Ädd%dSu%TdDãÓu%Tde7„¥Te„Ä„d5TS%§D%Tã—……TeÄWD%W75Sd%W—‡E´d&%T“u%TdDÕTÓu%TdE7„¥Te„Äs5TgE—…TfÄód%¤äDÄdä%W75Sd%W—‡E´d&%T—5UTd%UGDeT×¥§DeUd$ÄVÄ%f763¤%E$Dód%4¤TÄfD%S‡53d%7—…ETeDÄs”5Tge§DeT×¥§DeTä$ÄVÄ%f76#¤%s”4ÄS”%E¤4ód%¤dTÄdä%W75Sd%W—‡e´d&#—5UTd%UGDeTÓ§DeUd$ÄVÄ%f74Ö´¤%sDód%¥dDÄfD%S‡53d%7—…ETeDÄ†Ä5TcU§DeTæõ$GDeTä$ÄVÄ%f76UT¤%†Ä4ÄS”%uSuTdFµ5Sd%7—…ETeDÄ†Ä5TcU—…%Te$ód%'Tód%%TW55Td%g—‡…´d$æ´“uTdFDT×5cd%G—„ÅTdÄÄdä%d×6%T¤%s4ód%¤dDód%W55Td%g—‡E´d&%T—5Cd%¥GD%T×¥—…ETdÄÄdä%d×6%T¤%s4Ädd%dSu%TdDÓÓu%Tde7„¥Te„Ä…d5TW%§D%TãE—……TeÄWD%W75Sd%W—‡…´d&5T“u%TdDåTÓu%TdE7„¥Te„Ä„d5Tg…—…TfÄód%¦DDÄdä%W75Sd%W—‡…´d&5T—5UTd%UGDeTÓ5§DeUd$ÄVÄ%f75¥Td$äT“uTdF6´×5cd%G—„ÅTdÄÄdä%d×5•Td%•GDeTçu§DeTä$ÄVÄ%f75•Td%•7…Tge§D%T×…—…ETdÄÄdä%d×5•Td%•7…%Te$ód%4¤Dód%%TW55Td%g—†å´d&3ÓuTdDÃ×5cd%G—„ÅTdÄÄdä%d×5“d%—§DeTç•§DeTä$ÄVÄ%f75“d%——…TS%§D%Tçu$7…ETdÄÄdä%d×5“d%——…%Te$ód%5$Dód%%TW55Td%g—w•´d&CÓuTdFµ5cd%G—„ÅTdÄÄdä%d×6UT¤%†Ä4ód%&„Tód%W55Td%g—ƒU´d&UT—5Cd&#“uTdFDU5Sd%7—…ETeDÄ†Ä5TcU—…%Te$ód%'Tód%%TW55Td%g—‡…´d$Ö´ÓuTdF4U5cd%G—„ÅTdÄÄdä%d×6%T¤%s4ód%¤dDód%W55Td%g—‡E´d&%T—5Cd$æ´“uTdFVµ5Sd%7—…ETeDÄs5TgE—…%Te$ód%¤äDód%%TW55Td%g—ƒ´d$³“uTdFTT×5cd%G—„ÅTdÄÄdä%d×65T¤%„d4ód%¥dDód%W55Td%g—‡…´d&5T—5Cd%¥GD%TÓ5—…ETdÄÄdä%d×65T¤%„d4Ädd%dSu%TdDãÓu%Tde7„¥Te„ÄwDETWu§D%TçU$7……TeÄWD%W75Sd%W—†åd%£Óu%TdFFµu%TdE7„¥Te„ÄvDETfå—…TfÄód%6„TÄdä%W75Sd%W—†åd%£×5UTd%UGDeTãE$GDeUd$ÄVÄ%f74ÔT¤%wDDód%¤äDÄfD%S‡53d%7—…ETeDÄ†D5Tc5§DeT×e§DeTä$ÄVÄ%f76C¤%†D4ÄS”%uSuTdFU5Sd%7—…ETeDÄ†D5Tc5—…%Te$ód%&„Tód%%TW55Td%g—sE´d&#uTdDã5cd%G—„ÅTdÄÄdä%d×4äT¤%E$4ód%#TTód%W55Td%g—s´d$äT—5Cd$æ´“uTdF$UW5Sd%7—…ETeDÄE$5TS—…%Te$ód%4$Tód%%TW55Td%g—‡…´d$æ´“uTdFDT×5cd%G—„ÅTdÄÄdä%d×6%T¤%s4ód%¤dDód%W55Td%g—‡E´d&%T—5Cd%¥GD%T×¥—…ETdÄÄdä%d×6%T¤%s4Ädd%dSu%TdDÓÓu%Tde7„¥Te„Ä„d5Tg%§D%T×¥—……TeÄWD%W75Sd%W—‡E´d&%T“u%TdDÕTÓu%TdE7„¥Te„Äs5TgE—…Tge§D%Tæõ$7…ETdÄÄdä%d×6%T¤%s4Ädd%dSu%TdDÓÓu%Tde7„¥Te„ÄD¤5TgE§D%TÓ—……TeÄWD%W75Sd%W—ƒU´d&UT“u%TdFUu%TdE7„¥Te„Ä†Ä5TcU—…TfÄód%'TÄdä%W75Sd%W—ƒU´d&UT—5UTd%UGDeTç$GDeUd$ÄVÄ%f76UT¤%7DDód%6„TÄfD%S‡53d%7—…ETeDÄ…d5Tc§DeTÓU§DeTä$ÄVÄ%f76ET¤%…d4ÄS”%E¤4ód%¦DTÄdä%W75Sd%W—ƒ´d&ET—5UTd%UGDeT×e§DeUd$ÄVÄ%f74Ö´¤%sDód%¥dDÄfD%S‡53d%7—…ETeDÄ†Ä5TcU§DeTæõ$GDeTä$ÄVÄ%f76UT¤%†Ä4ÄS”%uSuTdFµ5Sd%7—…ETeDÄ†Ä5TcU—…%Te$ód%'Tód%%TW55Td%g—w•´d&%TÓuTdDåT×5cd%G—„ÅTdÄÄdä%d×6UT¤%†Ä4ód%&„Tód%W55Td%g—ƒU´d&UT—5Cd%¥GD%Tç$7…ETdÄÄdä%d×6UT¤%†Ä4Ädd%dSu%TdFµu%Tde7„¥Te„ÄD¤5TgE§D%TÓ—……TeÄWD%W75Sd%W—ƒU´d&UT“u%TdFUu%TdE7„¥Te„Ä†Ä5TcU—…TfÄód%'TÄdä%W75Sd%W—ƒU´d&UT—5UTd%UGDeTç$G3t÷§3u%TS%´W55Td%g—‡e´d$æ´“uTdFDT×5cd%G—„ÅTdÄód%%u%TdE7„¥Te„ÄwD5Tg%—…Tfå§D%T×¥—…ETdÄÄ„d5Tg…§D%UW…—…ETdÄÄtä%tÓu%TdF6´“t÷§3t÷§3u%Tee7„¥Td¤ÄvD5TcU§D%T×¥—……TeÄWD%W3u%TdE¤G3t÷§3t÷§Dedd$ÄVÄ%V·5“d%——„…Te¤ód%¥d4Ädä%W76T¤%vÄ4ód%%…$4Ädä%W75“d%—§DeTç•§3t÷§3t÷§Deed$ÄVÄ%V·5uTd&#ÓuTdFDT×5cd%G—„ÅTdÄód%%t÷§3t÷§3u%Te%7„¥Td¤Äed%eW5#d$Ö´“uTdFF´×5Sd%7—†…Tf„ód%%w„4Ädä%W75“d%—§DeTç•§DeVÄ$ÄVÄ%V·6%T¤%wDTód%4$TÄfD%S‡53d%7§DeTæ´ód%W55Td%57‡´d&T—5#d&ÓuTdF6µ5Sd%7—‡e´d&#“uTdfV´—5Sd%7—†¥Tf¤ód%4¤4ód%5TW55Td%57…¥Tg…§D%Tã%—……TeÄWD%W3u%TdE¤GDeTä$ÄVÄ%V·5eTd%e7„…Te¤ód%6„4Ädä%W75•Td%•GD%Ug5—…ETdÄÄtä%tÓu%TdF6´“t÷§3u%TdÅ7„¥Te„ÄwD5Tc5§D%Tç—……Teód%t÷§3t÷§De7D…G—…TeÄS”%„d4ód%'DÄdä%W74ÔT¤%D$4ód%“”4Ädä%W76%T¤%s4ÄWD%W3u%TdDÃ“u%TdeG—„ÅTdÄÄdd%s”4ód%¦Ä4Äed%S53d%7—„åTdäód%ew4Ädä%W75ETd%E7…Teód%'„4Ädä%W75uTd%u7…Teód%6„4Ädä%W75“d%——…Teód%¤d4Ädä%W76ET¤%…d4ÄS”%SƒuTdF&´×5Sd%7—‡¥´d&3—5Cd%G§D%Tç5—…ETdÄÄvD5Tfå—…Teód%¥d4Ädä%W765T¤%„d4ÄS”%SƒuTdF´×5Sd%7—sE´d$ôT—5Cd%G§D%T×…—…ETdÄÄ†Ä5TcU—…Teód%#4¤DÄdä%W75£¤%vD4ÄS”%SƒuTddåT—5Sd%7—†åd%£×5Cd%G§D%TÓ—…ETdÄÄvDETfå—…Teód%¥dDÄdä%W76Tä%vÄDÄS”%SƒuTddã×5Sd%7—‡e´d&#—5Cd%G§D%Ufõ—…ETdÄÄvD5Tfå—…Teód%¥d4Ädä%W75uTd%u7…Teód%6„4Ädä%W76%T¤%s4ÄS”%SƒuTddÃ—5Sd%7—…¥Te¤ÄS”%SƒuTd†TT—5Sd%7—†¥Tf¤ód%%sT4ÄfD%Sƒu%TdEdG3t÷§3tód%CW6%T¤%s4ÄS”%„d4ód%¦ÄDÄdä%W75Sd%W—ƒU´d&UT—5Sd%W—…%Te$ÄWD%W3uTdDã5Sd%7—…ETeDÄ†Ä5TcU—…ETeDÄdd%dW53d%7§D%TÓ5$7…ETdÄÄdä%d×6UT¤%†Ä4Ädä%d×5UTd%U7„ÅTdÄód%¦DTÄdä%W75Sd%W—…eTedÄdd%dW53d%7§D%Ug•—…ETdÄÄ„d5Tg…§DeTÓ§3t÷§3u%TdåU7s´d&ÓuTd¦TT×5Sd%7—…ETeDÄdd%dW5UTd%U7„ÅTdÄód%##TDÄdä%W765T¤%„d4ÄWD%W75Sd%W—„ÅTdÄÄWD%W75Sd%W—†¥Tf¤ód%7dÄdä%W765T¤%„d4ÄWD%W75Sd%W—……Te„ÄWD%W75Sd%W—‡e´d&#“uTdF6µ—5Sd%7—‡…´d&5T—53d%7—…ETeDÄtd%tW53d%7—…ETeDÄ„ä5Tg¥§D%Tãe&—…ETdÄÄ„d5Tg…—„ÅTdÄÄdä%d×63¤%„ä4ÄWD%W75Sd%W—w%´d$³“uTdDÓ75Sd%7—‡…´d&5T—53d%7—…ETeDÄ„d5Tg…—„ÅTdÄÄdä%d×4ôT¤%F„4ód%7„Ädä%W765T¤%„d4ÄWD%W75Sd%W—†ÅTfÄÄWD%W75Sd%W—ƒ5´d&C“uTdDã—5Sd%7—‡…´d&5T—53d%7—…ETeDÄs”5Tge—„ÅTdÄÄdä%d×4æ´¤%E¤4ód%5¤„Ädä%W3uETdE47„ÅTdÄÄdä%dÓuETdE¤7„ÅTdÄÄdä%dÓu5TdFT“uTdE7…ETdÄÄ„d5Tg…—„ÅTdÄÄdä%d×6C¤%†D4ÄWD%W75Sd%W—‡d&TÓuTddÃ75Sd%7—‡…´d&5T“u%TdDåT“t÷§3u%TdÅU7‡E´d&%USuTdFVµW5eTd%E7†å´d%£—5Sd%¥7‡%´d%e7„eTddód%%wTÄed%S5“d%——„ÅTdÄÄvDETfå§D%Tãe$7…eTdäÄtä%÷53d%7—…%Te$Ädd%$—53d%7—†¥Tf¤Ädd%#T4ÄWD%W75£¤%vD4Ädd%4¤4ÄWD%W76UT¤%†Ä4Ädd%¦Ä4ÄWD%W76C¤%†D4Ädd%¦D4ÄWD%W76ET¤%…d4Ädd%¥d4ÄWD%W74Ö´¤%D¤4ód%%w„DÄfD%Sƒt÷§DåVDÔÄD$5TWu§DåUW…—…ETeDÄWD%W3uETdE¤7†¥Tf¤Äud%uStó%¦D4Ä…d5Tc—†ÅTfÄÄTä%TÓuETdFF´×6T¤%vÄ4ÄWD%W3uETdFDT—4ÔT¤%D$4ÄWD%W76UT¤%†Ä4ó%6„TÄ†Ä5TcU—„ÅTdÄÄ†D5Tc5§DåTã$7‡E´d&%T—53d%7—‡%´d&“uETdDÕT×6C¤%†D4ÄWD%W76ET¤%…d4ó%4$TÄvÄETg—„ÅTdÄÄtä%t×53d%7—†åd%£ÓuETdFVµ—4äT¤%E$4ÄWD%W74Ö´¤%D¤4ó%¥dTÄ„d5Tg…—„ÅTdÄÄ…d5Tc§DåTç$7†¥Tf¤ÄWD%W75¥Td%¥GDåTç5—‡e´d&#—53d%7—†ÅTfÄó%6„DÄed%eW53d%7—†ÅTfÄó%¦Ä4Ä„ä5TädÄWD%W75“d%——„ÅTdÄÄ„ä5Tg¥—sE´d$ôT“u5TdFU“u%TdE&§DeUe$Ä„d5Tg…—„ÅTW•—„ÅTWu§D%Tæõ47…%Td¤ÄVÄ%V·5Cd%G§D%Tæ”Äed%V·55Td%57„åTdäÄwD5Tg%§D%TÓU—…¥Td¤ÄS%S5•Td%•GDåTãe§D%Ud$Äed%V·5ETd%E7„ÅTdÄÄVÄ%V·5ETd%E7„åTdäóÄ%'Dód%“uTdE&§D%43—5´W55Td%ET×4ÔT¤%†Ä4Äs”5Td¤ÄVÄ%V·5d%—…TeÄed%eW5d%§D%E¤6&µ55Td%E7s%´d%F—„åTdå—s´d&3u%TW%'dÄVÄ%f75Cd%¥GD%TãE—……Te7s´d$ÔT“u%TdF&´Óu%TdeG—…¥Te¤Ädd%s”4Äed%E$DÄTä%T×5#d%'§D%3”vVµ—5UTd%7„¥Td$ÄVÄ%TW55Td%GD%vD…57…ETdÄÄdä%dÓuTde¤7…ETdÄÄvD5TfÄÄWD%TW5UTd%U7‡´d%V—…Td$ÄWD%†D4ód%¥dDÄdä%W765T¤%s”4ÄWD%TW5UTd%U7‡¥´d%V—…Td$ÄWD%E¤4ód%5$TÄdä%W76T¤%vD4ÄWD%TW5UTd%U7‡%´d%V—…Td$ÄWD%†Ä4ód%¦ÄDÄdä%W75•Td%u7„ÅTd$Ädd%dW5“d%V—…Td$ÄWD%„d4ód%%…$DÄdä%W76#¤%s”4Äs”5Td¤ÄVÄ%V³u%TdF&´Óu%Tde•7†…TS§D%Td$ÄfD%Td”Ädä%TW5ETd%7„åTd$Ätd%TSuTdFF´×5cd%7—‡Ed&%TÓu5TdDÕT×5d%GDeTd$ód%%tW5eTd%e7„åTW•§D%Td$ÄfD%Td$Ädä%TW5ETd%7„åTd$Ätd%TSuTdFU5cd%7—…ETeDÄs”5Tge—„åTdäÄWD%W753d%7—‡´d&T“u5TdF6µW5d%GDeTd$ód%%S‡5£¤%vD4Äud%„dTód%¤ddÄed%S5“d%——„ÅTdÄÄs5TgE—†…Tf„ód%7TÄdd%V·5•Td%•GD%TæÔÄtd%S‡53d%7§D¥Tæ´ód%%TW5cd%G§DeTåTód%%S‡65T¤%„d4Äud%…d4ÄvD5TSE$GD%T×e'—…eTdäÄfÄ%f·53d%7—‡E´d&%T—5•Td%•GD%Tã%$7…%Td¤ÄfD%f3uTdE–—†…TeÄWD%W763¤%„ä4ÄfD%f75“d%—§D¥TÓ5$GD%Ud$ÄfD%Sƒu%TdEdGDeUf„Ädä%d×5cd$ÔUSuTd%7……Td%7…ETd$ÄS%TW5ETd%7†…Td$ód&4VÇ5'—…eTd$ód&5VÄ¤ÄfÄ%S5Sd%W—„ÅTdÄód%4$4ÄfÄ%S5Cd%G—…Teód%%„$4ÄfÄ%S5cd%e7„ÅTd$ÄWD%W75cd%D7…Td$Ädä%TW5#d%——…ETd$ód%%FÄ4Äed%V·5cd%g—„åTdäód%#T4Ätä%S55Td%5GEeTå4Äs”UTge$7…ETeDód%“”Tó%“uTde7…¥TdäÄvD5Tfå—…%Te$ód%%FÄ4ÄfÄ%S5“d%——„åTdäÄS”%S‡5Sd%W—…ETeDód%%sTTÄed%V·5“d%——……Te„ÄVD%V3uTdDõT—5“d%E7…Teód%$—5“d%E7†å´d%£—5“d%——„ETdDÄUd%USuTdfF´×5uTd%57‡´d&T—5ETd%EGD%Tãe—†ÅTdÄÄvD5Tfå—„åTdäÄtd%tSuUTdDÕTÓuETdE&—…Teód%w5“d%E7…%Te$ód%%6T¤%d×55Td%57„…Td„ÄVÄ%V·5“d%——…%Te$ÄWD%W3uTdDã×5£¤%S5Cd%G—„åTdäÄdä%d×5d%§D%TÓ5—†å´d%E7†å´d%£—5“d%——„ETdDÄUd%USuTdfF´×5“d%57‡´d&T—5ETd%EGD%Tãe—‡´d%7—†å´d%£—5ETd%E7†…Tf„ód%¤dDód%“uETdE&§D%Ud$Ätd%Sƒu5TdEd7„ETd$ód%TSt÷§3t÷§3u%Te%U7‡…d$Ö´ÓuTdFµ5eTd%E7…ETeDÄWD%W3uTdF4T—5eTd%E7…TeÄS”%SƒuTdf4T—5eTd%E7†ÅTfÄÄWD%W3uTdDÕT—6#¤%TW5Cd%7…ETd$Ätd%t×55Td%57„ETdDÄtd%tW5“d%—§D%„¤Ö$U5eTd%GD%„äÕE7…¥TdäÄfÄ%f·53d%7—‡E´d&%T—5Sd%W§D%UgU$7…eTd¤Äud%tW53d%7…¥Te¤Äud%f÷5Cd%7…ETd$ÄVD%†Ä4Ä„d5Td$ÄVÄ%†D4ód%&„dÄud%S‡5uTd%u7……Te„Ä„d5Tg…§DåTç•$GD¥TätÄTä%TSu%TdE&§DeUedÄs5TgE—†ÅTg…%GD%FÄÖ4V75UTd%7„¥Td$ód$³„¤Äed%S5Sd%W—„ÅTdÄód%4$4Äed%S5Cd%G—…Teód%%„$4Äed%S5¥Td%——„ÅTd$ÄWD%W75“d%D7…Td$Ädä%TW5#d&T—5•Td%GD%Ug•—…%Td¤Äud%uW5ETd%EGD%Tã%—†¥Te$ód%G6EU$%…dTÄtd%tSuETdFDUSuTdE7†…TeóÄ%uTde7…eTdäÄtd%f·53d%7…¥Te¤Äud%f÷5Cd%7…ETd$ÄVD%†Ä5'—s´d$ÔT—5“d%GD%Ug•%7…%Td¤Ätd%tW5ETd%EGD%Tç•—†…TeóÄ%uTde7…eTdäÄtä%t×5eTd%eGD%TÓU—…%Td¤ÄTä%TäTÄ†D5Tc—„¥Td¤ÄfD%f75#d%'§D%TÓ—†¥Te$ód%G63ä%„äE—s´d$ÔT—5“d%——‡´d&T—5cd%g§DåTÓ'§D%Tä$Ätd%Sƒu5TdEdGD%Ud$ÄfD%Sƒu%TdEdGDeUf¤Ä„ä5TæÄfD%W5£¤%%SuTd%7……Td%47…ETd$ÄS%TW5ETd%7†…Td$ód$ÃWU—…eTd$ód&S”¤Ätd%dW5¥Td&CuTdFUW5•Td%U7†ÅTc5$GD%Ufõ%7…¥TdäÄud%uW55Td%57‡ed&#×53d%7—…%Te$Ätä%tÓuTdfTU—6%T¤%tW5£¤%vD4Ä†Ä5TcU—…eTedÄ„d5Tg…§D%Tç•&—‡E´d%•7…¥Te¤Äs”5Tge—…eTedÄvD5Tfå§D%Tã%%7‡E´d%•7†¥Tf¤Ä†D5Tc5—…eTedÄ„ä5Tg¥—„¥Td¤ód%5¤tÄs5Tf„ÄvD5Tfå—‡¥´d&3—5eTd%e7‡%´d&“uTdDÃW6%T¤%tW5“d%——ƒ´d&ET—5eTd%e7‡…´d&5T—55Td%5GD%Tç•&—‡E´d%•7†å´d%£—4æ´¤%E$4ÄWD%TW5eTd%e7ƒ5´d%f—…Td$Ädä%TW5#d$³—53d%7§D%TÓ5&—‡E´d%•7†å´d%£—63¤%„ä4Äed%eW6¤%wD4ód%“”dÄs5Tf„ÄvD5Tfå—ƒ5´d&C—5eTd%e7‡e´d&#“uTdF&µ—6%T¤%tW5uTd%u7†å´d%£—5eTd%e7…¥Te¤ód%“”TÄs5Tf„Ätä%t×6T¤%vÄ4Äed%eW5¥Td%¥7„¥Td¤ód%7dÄs5Tf„ÄfÄ%f·4äT¤%E$4Äed%eW6C¤%†D4ód%5¤tÄs5Tf„Ätä%t×63¤%„ä4Äed%eW6#¤%s”4ÄVÄ%V³uTdF&µ—6%T¤%tW5£¤%vD4Ä†D5Tc5—…eTedÄs”5Tge§D%TçU&—‡E´d%•7†å´d%£—6%Tä%sDÄed%eW4³¤%7D4ód%7„Äs5Tf„ÄvD5Tfå—w•´d$Ö´—5eTd%e7ƒ´d&ET“uTdFVµ—6%T¤%tW5£¤%vD4Äs”5Tge—…eTedÄvD5Tg$GD%TÓ'—‡E´d%•7†å´d%£—63¤%„ä4Äed%eW6¤%wD4ód%“”dÄs5Tf„Ätä%t×4³¤%7D4Äed%eW4æ´¤%E¤4ÄWD%W3uTdFDV76%T¤%tW5uTd%u7‡¥´d&3—5eTd%e7‡%´d&“uTdDÓW6%T¤%tW5£¤%vD4ÄE$5TS—…eTedÄ†D5Tc5§D%T×¥&—‡E´d%•7†¥Tf¤ÄD$5TWu—…eTedÄ†D5Tc5—„ÅTdÄód%¥dtÄs5Tf„ÄvD5Tfå—‡d&T×5eTd%e7s%´d$æ´“uTdF6¶76%T¤%tW5£¤%vD4ÄvÄETg—…eTedÄE¤5TS%§D%Tç•'—‡E´d%•7†å´d%£—6ä%wDDÄed%eW4ôT¤%F„4ód%%…¤„Äs5Tf„ÄvD5Tfå—‡´d&T—53d%7—†…Tf„ód%&„dÄs5Tf„ÄvD5Tfå—†…Tf„ÄWD%W75Sd%W§D%UcE$7…¥TdäÄtd%tSu5TdF6´—5d%GDeTd$÷§3t÷§3t÷§3tód%cW5£¤%vD4ÄS%wD4Äud%E¤4ód%4¤dÄed%S5uTd%u7„ÅTdÄÄs5TgE—†…Tf„ód%5¤TÄdd%V·5cd%g§D%Tæ”ÄfÄ%S5“d%——„ÅTdÄÄwD5Tg%—…ETeDód%4$TÄfD%W75“d%——†¥Tf¤ÄWD%W3uTdfDT×5cd%7—‡´d&T—55Td%5GD%UW…—……TdÄÄwD5Tg%—„¥Td¤ód%%Dä4óÄ%“u%TdE&§3t÷§3tód%CW6ET¤%…d4ÄvÄ5TWu§D%VC%%7……TädÄS”%dW5£¤%†D4Ä„d5Tg…—…¥Tçu$7†å´d&C—65T¤%„d4Äed%¦ÄDÄS”%dW5£¤%†D4Ä…d5Tc—…¥Tã$7†å´d&C—65T¤%„d4ód%%w„T÷§3t÷§3u%TeU7‡´d&T—5ETd&C“uTeÃ×5eTd%E7‡%´d&—53d%7§D%TÓ5—…%Td¤ÄUd%UW4Ö´¤%vÄDÄs5Te„ód%&„TóÄ%“uTde7…%Td¤ÄTä%T×53d%7—ƒ´d&ET—5¥Td%¥7„…Td„ód%'TóÄ%“uTd…7…ETdÄÄfD%f75d%—†ÅTfÄód%#&„DÄed%S6¤%wD4ÄvD5Tfå—„åTdäód%¦ÄDÄs”5Tfå—…%Te$ód%5¤4Äs”5Tc5—…¥Te¤ód%4¤DÄs”5Tfå—…Tf„ód%¦D4Ädä%W75Sd%W—„ÅTdÄÄud%uSuTd†$T×5eTd%E7……Te„ÄWD%W3uTdFDT—5eTd%E7‡e´d&#—5Sd%W—…%Te$Ädä%d×5ETd%E7…%Te$Ädä%d×5cd%g—…ETeDÄdd%dSuTdFF¶75•Td%W—…ETeDÄVD%V76%T¤%s4ÄTä%TÓuTdFV´×5•Td%W—…ETeDÄVD%V76%T¤%s4ÄTä%TÓu%TdDÓÓu%TdeU7‡%´d&—5ETd&C“uTdFU5eTd%E7‡¥´d&3—53d%7§D%Tç—…eTdäÄtä%t×6#¤%V·55Td&#“uTddåT×5UTd%57„åTdäÄdd%dW6%T¤%s4ÄVD%V3uTdFDT×4ÔT¤%s”4Ädd%dW5d%—†…Tf„ÄfÄ%f·55Td%57…%Te$ÄTä%TÓu5TdF6µW5Cd%G§D%TäÔÄwD5Te¤ÄVÄ%V·6%T¤%s4óÄ%4¤Dód%%TW5¥Td%g—…¥Te¤Ätd%tSuTdF$T×5cd%7—‡%´d&—55Td%57…%Te$óÄ%4¤Dód%“u%TdeU7‡%´d&—5cd&5UuTgc'tÄdd%TSuTgec·5eTd%E7†å´d%£—5eTd%eGD%Tæõ—…¥Te$ÄvD5Tfå—„¥Td¤Ädd%S‡53d%7…eTedÄE$5TetÄS”%TW53d&5TÓu%TdDÕUSuTdE&§D%DåU•7w•´dE'—‡´d&T“uTdTÕT—55Td%E7s´d%F§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3udãEW55Td%E7‡$Td%F—„åTdå57†å$Td$ÔUSu%TdÆ6µ—55Td%g—…TfÄód%6„4ÄfD%S”$ÄvDUTSE§DeTã%$GDeUeÄfÄ%f·5UTd&#“uTdF6´×5Sd%7—…ETeDód%&„4ód%%tW65T¤%„d4Äud%…d4ÄvD5Tc$GD%Td$ÄfD%TdDÄdä%TW5ETd%7„åTd$Ätd%TSuTdDõV75uTd%E7…¥Te¤ÄWD%W76%Tä%sDÄtd%tSuTdFFµW5eTd%57†…Tf„ÄS%SuTdF6´“uETdE&§D%VÄ$Ätä%dSuUTdEF§DåTätód%%TW5uTd%E7‡…´d&5T—5eTd%eGD%Tç•—‡…´d%¥7‡e´d&#“u5TdF6´×5d%GDeTd$ód%%dW6%Tä%G5¥TdDäUSuTgU&„tÄdd%TW55Td%GD%s”E57…eTdäÄdä%d×53d%7§D%Tçu—…eTdäÄS”%S‡5Cd%G§D%Ugu—…eTdäÄud%t×53d%7„ÅTdÄÄtä%Ww5Cd%7…ETd$ÄVD%vÄ4Ätd%TSuTdf6´×5UTd%57†ÅTfÄÄS%SuTdFF´—5“d%UGE%TäôÄD¤eTW•%7†…Tf„ó%¤dtód%W5•Td%G§D¥TåTód%%TW5eTd%E7†…Te¤ÄWD%TW5uTd%u7†ÅTfÄS”%TW5Sd%7„…TcUµ5£$%F„DÄtä%TSuTdfVµ—5UTd%57†…Tf„ÄS%SuTdF6´—5•Td%G§D¥TåTód%%TW5cd%G§DeTåTód%“uTgu$tW4³ä%76T¤%vÄ4ód%$Dd4ÄVÄ%S5£$%SCt÷§D%ÄfÄ%fÄdÄtd%f3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3uTä&T—5Sd%W—…eTedÄVD%s4ód%¤äDÄdä%S‡53d%7—„¥Td¤ÄVD%V75#d%'§D%TãE§D%$WEÄVÄ%S4æ´¤%SG5ETd$æµu%Tf†$UW55Td%g—…TfÄód%6„4ÄfD%Sƒu%TdEdGDeUeÄfÄ%f·5UTd&#“uTcEçDÄdd%TSuTcU¶·5Sd%7—…ETeDód%%u5Sd%7—s%´d$æ´—6#¤%V·55Td%5GD%T×…—…ETdÄÄsETgE—‡e´d%57„¥Td¤ód%5v„TÄed%S5Cd%G—„ÅTdÄÄS”%SƒuTdfV´—5Sd%7—‡%´d&T—53d%7„ÅTdÄÄs5TdÔÄS”%TW53d&ET—5d%§D%TÓU—…%Td¤ÄWD%W75¥Td%¥7…%Te$Ä…d5Tc—„åTdäÄVÄ%V³uTdDÃ5cd%7—†ÅTfÄÄWD%W76ET¤%…d4óÄ%'„Tód%“u%Tde•7†…TS§D%Td$ÄfD%TdDÄdä%TW5ETd%7„åTd$Ätd%TSuTcE¤äDÄed%TSuTcU·5uTd%E7…TeÄWD%W75Cd%G§D%VCe—…¥TdäÄwD5Tg—„ÅTd$ÄWD%W75¥Td%D7…Td$Ädä%TW5#d&—53d%GD%Tãe—…¥TdäÄ…d5Tc—‡%´d%7…Td$Ädä%TW5¥Td%£“uTdDã×5eTd%57„ETdDÄ„ä5Tg¥§D%Tãe§DåTätód%#W5cd%7—ƒ5´d&C—6#¤%s”4ód%#'TÄD¤5Tg…—…%Te$ÄTä%T×6#¤%s”4ÄwD5Tg%§D%…$VTUW5uTd%T×53d%GD%…dUE7†¥TdäÄud%tä$ÄS%TW53d%7—†¥TdÔÄS”%TW5Sd%TW55Td&T—5•Td%GD%Ug•—…¥Td¤Äud%uW5ETd%EGD%Tã%—‡%´d%UGE¥TäôÄ†DUTc5$7†…Tf„ód%5¤dód%SuUTdE&§D%Ud$ÄfÄ%V·6%T¤%s4ÄfD%f75•Td%•GD%TÓ5—†å´d%E7……Te„ÄWD%W76C¤%†D4Äs”5Tge—……Te„ód%¦DdÄud%W75eTd%g—†…Tf„ÄVÄ%V³uUTdF&´×5uTd%g—„ÅTd$Äs5TgE—……TgU—…Td$Ädä%TW5#d$Ö´—5cd%g—……Td$ÄVD%tÓuTdDã5£¤%S5cd%g—„ÅTdÄÄ†D5Tc5—‡e´d&#—5cd%g§D%TÓ5%7†ÅTdÄÄed%f75•Td%•7„¥Td¤ód%#TDÄfD%f76%T¤%s4ÄfD%f763¤%„ä4ód%%3”TÄS”%SƒuTdED7‡%´d%U7„ÅTdÄÄ7DETW%—‡E´d&%T—5ETd%E7„eTddód%7tó%—5d%§D¥Tä”ÄTä%TSu%Td%GDeUe$Ä†D5TäôÄs”5Tä$ÄvD5Tç¥§D%wtÕT—5UTd%7„¥Td$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TW55Td%GD%wDu57…eTdäÄvÄ5Tfå—„åTd$ÄWD%TW6%T¤%s4Äud%sT4ÄS”%TW5Sd%7„…Tfå—†å´d%7„åTfõ—…Td$ÄWD%„dTód%¤ädÄed%S6¤%vD4ÄWD%TW6%T¤%s4Äs”5TgU—…Td$Ädä%TW5#d&5T×5Sd%7…TfÄód%¤ddÄed%S6C¤%†D4ÄvÄ5Tg§D%UWe—…eTdäÄD$5TWu—„ÅTdÄÄs”5Tge—‡%´d&“uTddÓW5eTd%E7…¥Te„ÄS%TW53d%7‡E´d&%T—5¥Td&&´—5Cd%7…ETd$ÄVD%vDDÄud%TW5ETd&T×5Cd%7„ÅTge$GD%Tç•%7…eTdäÄfÄ%f·5£¤%vD4Äed%eW5cd%g—…ETeDód%&„dÄed%S5“d%——…¥Te¤ÄS%TW53d%7‡E´d&%T—6#¤%sT4ÄS”%TW5Sd%7„…Tg…—…ETd$ÄS%„¤DÄS”%TW53d&%U5ETd%G§D%UW…&—…eTdäÄfÄ%f75ETd%7„ÅTd$Äs5TgE—‡e´d&&´—5Cd%7…ETd$ÄVD%„dDÄfD%TW5ETd&6´×5Cd%7„ÅTg…$GD%Tã%7…eTdäÄtä%t×5•Td%•GD%Ug—…eTdäÄ„ä5Tg¥—„ÅTdÄÄ„ä5Tg¥—‡%´d&“uTdfVµW5eTd%E7‡e´d&%T—5ETd%7„ÅTd$Äs5TgE—‡…´d&&´—5Cd%7…ETd$ÄVD%„äDÄdd%TW5ETd&DT×5Cd%7„ÅTgE$7„ETdDÄVD%W75#d%7—„…TdÄÄTä%V75#d%'§DåTæõ'—„ETdDÄVD%f75ETd%¥7„åTdäÄVÄ%V·55Td%57…eTedÄTä%TÓtóÄ%5$Tód%W5eTd%E7ƒU´d&C—53d%7‡E´d&%T—63¤%sT4ÄS”%TW5Sd%7„…Tc—…eTd$ód%4¤dÄed%S6%T¤%÷6UT¤%†Ä4ÄS”%4¤4ó%W5Cd%G§DåTåÄfÄ%fÄDÄvD5Td$ÄTä%TW5#dET7‡E´d%GD¥UeÄVÄ%SuTdeF—…eTdäÄ„ä5Tg…—„åTd$ÄWD%TW6%T¤%s4Äs”5TgU—…Td$Ädä%TW5#d&5T×5uTd%7„åTg•—…Td$ÄWD%„äTód%'tÄed%S63¤%„d4ÄWD%TW6%T¤%s4Ä„ä5TgU—…Td$Ädä%TW5#d&ET×5eTd%GD%Tç5%7…eTdäÄvD5Tä´Ä„ä5Tg¥—…Tç5§DåTädÄS”%SƒuETdET7…Teó%5uTd%uTW5£¤%TW5d%7„…TåÄs5Td$óÄ%%d55TdEGD%UdôÄed%S6%T¤%wD4ÄS%TW53d%7‡E´d&%T—65T¤%sT4ÄS”%TW5Sd%7„…Tg¥—†å´d%7„åTc—…Td$ÄWD%D¤TÄTä%T×5#d%7—„…TdÄÄVD%W75d%'—„…Td„ó%5¤„óÄ%“uTdE7…eTdäÄ†D5Tc—„ÅTd$Äs5TgE—‡¥´d&&´—5Cd%7…ETd$ÄVD%…dDÄtä%TSuTdF4UW5eTd%E7‡%´dE6—ƒ5´d&C—5CdF4T“uETdE%7…Teó%5uTd%uTW5£¤%TW5d%7„…TåÄs5Td$óÄ%%d55TdEGD%UdôÄed%S65T¤%s”4ÄS%TW53d%7‡E´d&%T—65T¤%sT4ÄS”%TW5Sd%7„…Tg¥—†…Td$ÄS%…$DÄS”%TW53d&C5d%—„åTdäÄS%S5ETd%E7„ETd„ÄVD%V3uETdFV¶3u5TdE&§D%Tä$Äed%S4æ´¤%E$4ÄWD%TW6%T¤%s4Ä„ä5TgU—…Td$Ädä%TW5#d&ET×5¥Td%GD%Tãe%7…eTdäÄ…d5Tä´ÄE¤5TS%—…Tãe§DåTädÄS”%SƒuETdET7…¥Te¥7†å´d%7„ETd$ÄVD%6%T¤%TSu5TdeT7„¥Tä$ód%#G5UTd%57‡¥´d&5T—5ETd%7„ÅTd$Äs5TgE—‡e´d&&´—5Cd%7…ETd$ÄVD%„dDÄtd%TW5ETd&6´×5Cd%7„ÅTc$GD%Tæõ&—…%Td¤Ä„ä5Tg…—„åTd$ÄWD%TW6%T¤%s4Äs”5TgU—…Td$Ädä%TW5#d&5T×5•Td%7„åTg•—…Td$ÄWD%…dTód%&„tÄ†Ä5TW•—‡%´d%e7„ÅTdÄÄs”5Tge—„…TdÄÄS%S5ETd%E7‡%´d&“uTdF¶76UT¤%„d4ÄTä%T×63¤%„ä4ÄVÄ%SuTdf$U5eTd%E7‡…´d&#—5ETd%7„ÅTd$Äs5TgE—‡e´d&&´—5Cd%7…ETd$ÄVD%„dDÄ†Ä5Td$ÄS%„¤DÄS”%TW53d&%USuTdDã—5eTd%E7ƒ´d&ET—6#¤%s”4ÄVÄ%S6#¤%s”4ód%%DädÄed%S63¤%„d4ÄWD%TW6%T¤%s4Ä„ä5TgU—…Td$Ädä%TW5#d&ET×5uTd%GD%Tç5%7…eTdäÄud%uW63¤%„ä4ÄS”%S‡5d%—„…TdÄÄVD%W75d%'—„¥Td¤ód%4$dÄed%S5£¤%÷63¤%„ä4ÄS”%'„4ó%W5Cd%G§D¥TåTÄVÄ%SuTdeF—…eTdäÄ†D5Tc—„åTd$ÄWD%TW6%T¤%s4Äs”5TgU—…Td$Ädä%TW5#d&5T×6T¤%TW5ETd&6´×5Cd%7„ÅTW•$GD%TãE&—…eTdäÄD¤5TWu—„ÅTd$Äs5TgE—‡¥´d&&´—5Cd%7…ETd$ÄVD%…dDÄtd%TSuTdFFµW5eTd%E7‡…´dE6—w•´d$Ö´—5CdFF´“uETdE%7…Teó%5uTd%uTW5£¤%TW5d%7„…TåÄs5Td$óÄ%%d55TdEGD%UdôÄed%S4æ´¤%E$4ÄS%TW53d%7‡E´d&%T—65T¤%sT4ÄS”%TW5Sd%7„…Tg¥—……Td$ÄS%…$DÄS”%TW53d&35d%—„…TdÄÄVD%W75#d%7—„ETd„ÄVD%V3uETdDåV3u5TdE&§D%Tä$Äed%S6%Tä%wDDÄS%TW53d%7‡E´d&%T—6#¤%sT4ÄS”%TW5Sd%7„…Tg…—‡%´d%7„åTg•—…Td$ÄWD%E$Tód%4$„Äed%S4Ö´¤%D$4ÄS%TW53d%7‡E´d&%T—6#¤%sT4ÄS”%TW5Sd%7„…Tg…—…eTd$ÄS%„¤DÄS”%TW53d&#uTdf4U—5eTd%E7‡E´d&%T—5d%—…%Te$Äs”5Tge—‡E´d&%T—5#dFFµW5ETd%7„ÅTd$Äs5TgE—‡e´d&&´—5Cd%7…ETd$ÄVD%„dDÄs5Td$ÄS%„¤DÄS”%TW53d$æµ5dDÃuTd…7…%Td¤Ä„ä5Tg…—„åTd$ÄWD%TW6%T¤%s4Äs”5TgU—…Td$Ädä%TW5#d&5T×5¥Td%7„åTg•—…Td$ÄWD%†ÄTód%'„tÄ†Ä5Tg…—…Teód%%Ed4Äed%S6#ä%sDÄWD%TW6%T¤%s4Ä„ä5TgU—…Td$Ädä%TW5#d&ET×63¤%TSuTdFU—5eTd%E7sE´dE6—‡ed&#×5CdFTÓuETdE%7…Teó%5uTd%uTW5£¤%TW5d%7„…TåÄs5Td$óÄ%%d55TdEGD%UdôÄed%S6ET¤%„ä4ÄS%TW53d%7‡E´d&%T—65T¤%sT4ÄS”%TW5Sd%7„…Tg¥—†ÅTd$ÄS%…$DÄS”%TW53d$ÔU5d%—„…TdÄÄVD%W75d%'—„…Td„ó%4¤„óÄ%“uTdE7…eTdäÄs”5TgE—„åTd$ÄWD%TW6%T¤%s4Äs”5TgU—…Td$Ädä%TW5#d&5T×6%T¤%TW5ETd&6´×5Cd%7„ÅTS%$GD%Tã&—…eTdäÄD¤5Tä´Ä„d5Tg…—„ÅTdÄÄS%TW53d%7‡E´d&%T—6#¤%sT4ÄS”%TW5Sd%7„…Tg…—‡…´d%7„åTg•—…Td$ÄWD%7DTÄVÄ%SƒuTdf$V75eTd%E7w%´d$ôT—53d%7‡E´d&%T—63¤%sT4ÄS”%TW5Sd%7„…Tc—‡e´d%GD%T×¥%7…eTdäÄ†Ä5Tä´Ä7D5TW%—…T×¥§DåTädÄS”%SƒuETdET7…¥Te¥7†å´d%7„ETd$ÄVD%6%T¤%TSu5TdeT7„¥Tä$ód%%SG5eTd%E7‡d%£×5ETd%7„ÅTd$Äs5TgE—‡e´d&&´—5Cd%7…ETd$ÄVD%„dDÄvD5Td$ÄS%„¤DÄS”%TW53d$ÔUuTd†V75UTd%57‡d%£×5ETd%7„ÅTd$Äs5TgE—‡e´d&&´—5Cd%7…ETd$ÄVD%„dDÄvD5Td$ÄS%„¤DÄS”%TW53d$ÔUuTdDõU—5UTd%57‡d&T×5ETd%EGD%Tãe—‡¥d%£×5d%§D¥TçU§D%Ud$Äed%S6ä%vÄDÄS”%TW53d%7‡E´d&%T—6#¤%sT4ÄS”%TW5Sd%7„…Tg…—‡´d%7„åTg•—…Td$ÄS%D¤Tód%%w„„Äed%S6T¤%sTó%5¤TÄtd%tSuETdE–§DåTä$ó%SuETdEGDåTä$ó%SuETdEGDåTä$ó%SuETdEGDåTä$ó%SuETdEGDåTä$ó%SuETdEGDåTä$ó%SuETdEGDåTä$ó%SuETdEGDåTä$óÄ%“uTde7……TeÄtä%Td$ÄvD5Td$ÄTä%TW5#dE&—†¥Td$ÄVD%$USuETd…D7‡¥´d&3“uUTdF4T“uUTdEGDåTätó%SuETdEGDåTä$ó%SuETdEGDåTä$ó%W5uTd%uG3uUTdef—‡¥´d&3“uETdFTT“u5TdE&—„ETd$ód%“u%TdeU7ƒ5´dEF—‡e´dE7†å´dF3“uTS5V¤d4Ädd%TW55Td%7„¥Td$ÄVÄ%TW55Td%GD%F…557…eTdäÄ„ä5Tg¥—‡E´d&%T—5cd%g§D%T×…$7…eTdäÄvD5Tfå—‡E´d&%T—5cd%g—wu´d$ÔT“uTddõUW5eTd%E7wu´d$ÔT—53d%7—‡e´d&#—6¤%wD4ód%%DädÄed%S5cd%g—‡E´d&%T—5cd%g§D%T×e—…eTdäÄfÄ%f·5£¤%vD4Äed%eW5cd%g—…ETeDód%&„dÄed%S5“d%——…¥Te¤ÄS%TW53d%7‡E´d&%T—6#¤%sT4ÄS”%TW5Sd%7„…Tg…—…ETd$ÄS%„¤DÄS”%TW53d&%U5ETd%G§D%UW…&—…eTdäÄ„ä5Tg¥—„ÅTdÄÄ„ä5Tg¥—‡%´d&“uTdfVµW5eTd%E7‡e´d&%T—5ETd%7„ÅTd$Äs5TgE—‡…´d&&´—5Cd%7…ETd$ÄVD%„äDÄdd%TW5ETd&DT×5Cd%7„ÅTgE$7„ETdDÄVD%W75#d%7—„…TdÄÄTä%V75#d%'—„¥Td¤Ädä%dÓuTdDÃ75eTd%E7ƒU´d&C—53d%7‡E´d&%T—63¤%sT4ÄS”%TW5Sd%7„…Tc—…eTd$ód%4¤dÄed%S6%T¤%÷6UT¤%†Ä4ÄS”%4¤4ó%W5Cd%G§DåTåÄfÄ%fÄ$ÄvD5Td$ÄTä%TW5#dET7‡E´d%GD¥UeÄVÄ%SuTd…F—…eTdäÄvÄ5TgE$GDåTã%$7†…Tf„ó%$—6ET¤%…d4ó%5¤4ó%W6¤%wD4ó%'„4Ä„ä5Tg¥§D¥TãE§D%Ud$ÄfD%S‡5“d%TW5£¤%TW5d%7„…TätÄtä%TW5#dU%GDåVDÔÄ„ä5Tg¥§E%Tçu§E%Tä$ó%“uETdEGDåTä$ó%W5uTd%uG3uUTdef—‡¥´d&3“uETdFTT“u5TdE&—„ETd$ód%“t÷§3u%TdÅU7‡¥´d&3—6#¤%†ÄTód&Å£e&—…%Td$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TSuTg%f¶·5eTd%E7‡e´d&%T—53d%7‡E´d&%T—65T¤%sT4ÄS”%TW5Sd%7„…Tg¥—…eTd$ód%“”TÄdd%V·6#¤%s”4ÄS%SuTdDåT—5•Td%G—„ETdDóÄ%“uTde7…eTdäÄdä%d×5%Td%—„ÅTd$Äs”5Td$ÄS”%TW5Sd%7‡´d&%T—5d%7„åTgU—…Td$ÄWD%†Ä4ÄVÄ%W753d%7‡e´d%7…Td$Ädä%TW6T¤%s4ÄTä%TW5ETd&&´—5Cd%7„ÅTcU—„ETd„ód%¤ddÄed%S5UTd%U7„eTdDÄWD%TW6#¤%TW5Cd%7…ETd$ÄvÄ5TgE—„ETd$ÄS%sT4ÄS”%TW53d&UT—55Td%7—„ÅTd$Äs”5Td$ÄS”%TW5Sd%7‡´d&%T—5d%7„åTgU—…Td$ÄWD%†Ä4ÄTä%V3uTdfVµW5cd%G—„ETdDÄVÄ%V·55Td%E7„åTdäÄTä%T×55Td%57…TeÄTä%TÓuTdf6´×5cd%G§3uETdeD7ƒ´d&ET—5%Td%%7…%Te$ÄS%Su5TdFV´Óu%TdE&§3t÷§3u%TdåU7‡e´d&#—6#¤%†DDód&DfC%7…%Td$ÄVÄ%TSuTcc·5eTd%E7‡¥´d&3—6%T¤%s4ÄfD%f3uTdDÕU5eTd%E7‡%´dE6—„ÅTd$Äs5TgE—†ÅTgU—…Td$Ädä%TW5#d%£×5£¤%TW5ETd&5T—5eTdF6µ6%T¤%s4ÄfD%f74ÔT¤%¦Ä4ód%—5eTd%E7‡%´d%£—53d%7‡E´d&%T—6#¤%sT4ÄS”%TW5Sd%7„…Tg…—…ETd$ÄS”%uW53d%7§D%UWe%7…%Td¤Ädä%dÓuTde–—…%Td¤Äud%uSuTdF´—5uTd%E7…eTedÄs5TgE§D%UgU—…eTd¤ÄfD%f75ETd%EGD%TçU—…¥Td¤Äud%uSuTdF´—6%T¤%d×53d%7—‡d&T×55Td%57…Teód%¥dTÄS”%SƒuTdED7‡E´d%W—„ÅTdÄÄD¤5TW•—„¥Td¤ÄS”%SƒuUTdFDUuETdE&§D¥Tätód%%TW5cd%G§DeTåT÷§3t÷§DeS$Ä†D5Tc5—ƒ5´d&3ÓuTd¦4UW5eTd%E7wu´d$ÔT—6#¤%V·55Td%uGD%WFõ$7…eTdäÄvDETfå—‡e´d%57„¥Te¤ód%#5$TÄD¤5Tc—…%Te$ÄTä%T×6ET¤%…d4ód$Ã·¥$7…eTd$ÄVÄ%TSuTfåv³5uTd%E7‡¥´d&3—6%T¤%s4ÄfD%f3uTdDÕU5uTd%E7‡%´dE6—„ÅTd$Äs5TgE—†ÅTgU—…Td$Ädä%TW5#d%£×5£¤%TW5ETd&5T—5eTdF6µ6%T¤%s4ÄfD%f74ÔT¤%¦Ä4ód%—5uTd%E7‡%´d%£—53d%7‡E´d&%T—6#¤%sT4ÄS”%TW5Sd%7„…Tg…—…ETd$ÄS”%uW53d%7§D%UWe%7…eTd¤Äud%uSuTdF´—5“d%E7…eTedÄs5TgE§D%UgU—…¥Td¤ÄfD%f75ETd%EGD%TçU—†¥Td¤Äud%uSuTdF´—4ÔTä%F„4ÄVÄ%V·5Cd%G§EeT×¥—…Teód%w6#ä%†D4ÄVÄ%V·5Cd%G§EeTç•§E%Tätó%“u5TdE&—„ETdDód%#5UTd%57ƒ5´d&C—5Cd%G—„¥Td¤ód%4¤DÄtä%dSuUTdEF—s%d$æ´×6C¤%†D4ÄVÄ%V³uETdDÓSu5TdE&§D%Ud$Ädd%V·4ôT¤%F„4ÄS”%S‡55Td%5GD%T×¥—†¥Te$ód%G4æ´ä%E¤DÄF„5TSE—„¥Td¤ó%'tóÄ%“uTd…7…eTdäÄWD%W76ET¤%…d4ÄUd%“”4ÄWD%W75%TdED7…%Te$ÄTä%T×5Cd%G—„åTdäód%4¤4ÄfÄ%S6T¤%vÄ4ÄWD%W755Td%57„ÅTdÄÄVÄ%V·55Td%57ƒ5´d&C—5Cd%G—„…Td„ÄUd%UW5#d%'—„ETdDód%4¤tÄfD%W74Ö´¤%D¤4ÄVÄ%V·5Cd%G—†¥Tf¤óÄ%¤äTÄTä%TÓuTde47…eTdäÄWD%W74æ´¤%E¤4ÄUd%4¤DÄWD%W75%TdED7…%Te$ÄTä%T×5Cd%G—„åTdäód%4¤4ÄfÄ%S6T¤%vÄ4ÄWD%W755Td%57„ÅTdÄÄVÄ%V·5#d%'—„ETdDÄVD%V75d%§D%Tç$7……TdÄÄvÄETg—„¥Td¤ÄS”%S‡5“d%—§D¥Tç%7„ETdDód%suTdE&§3tódftä$ÄfÄ%fÄDÄtd%f3uTä&F´—5uTd%uTW5•Td%g§D%%Tc%—…¥Te¥7†…Te„ódÅ…¤4ÄfÄ%fÄ$Ätd%f3uTä&F´—5uTd%uTW5•Td%g§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3tóeU#5¤4ÄVÄ%SDÄdd%S‡55Td%e7†å´d%UGD%UcE—„¥TdäÄD$5TdôÄtä%E$DÄtä%Su%TdÆU5uTd%u7…¥TW%§D%Tæõ$7…eTdäód%%SG5Sd%7—†å´d%£—55Td%e7ƒ5´d%£—55Td%57†…Tf„ÄTä%T×5#d%'—„…Td„ÄVD%V75#d%'—„…Td„ÄTä%T×5d%—„…Td„ÄTä%TÓuTdFDU—5Sd%7—†¥Tf¤Ädä%uW6C¤%vD4ód%%w„TÄed%S5cd%g—„¥TedÄ…d5TfÄód%¤dDÄtd%d×5•Td%•7…¥Te¤ÄWD%W75•Td%•GD%Ugu$7…eTdäÄfD%f755Td%e7wu´d&“uETdDÓ×5Cd%G§DåTåÄfD%f3uETdEt7…¥Te¤óÄ%%5d%§D%UdTÄdä%W75UTd%U7„¥TedÄtd%W75eTd%e7…%Te$ód%¦ÄDÄdä%W755Td%57„ÅTdÄÄWD%W3uTdf&´—5Sd%7—†…Tf„ód%4$4ód%%S‡6¤%wD4ÄS”%…d4ód%¦ÄDÄVÄ%Td$ÄS%W763¤%„ä4ÄWD%W75cd%g—…¥Te¤ÄfD%f3uTdF$UW5Sd%7—†¥Tf¤ÄS”%S‡5#d%#W5ETd%7—„…Td…7„åTdÄÄVD%VD$ÄS%W75d%§D%UgU$7…%Td¤ÄWD%W75cd%g—…%Te$ód%¤d4ÄS%Td$ÄS%W763¤%„ä4ÄWD%W75cd%g—…TeÄfD%f3u5TdDÃuTdE7…ETdÄÄtä%t×5Cd%G—„…Td…7„åTdÄÄVD%VD$ÄS%W75#d%#W5ETd%7—„ETdDód%%sTTÄdä%W75“d%——†¥Tf¤ód%%wDÄed%S6¤%wD4ÄWD%W3u%TdDÃ“uTdE&§D%%DdEG—…ETeDÄwD5TW•—…%Tc—…%Tf¤ód%¦ÄtÄdä%S‡5Cd%G—„¥Td¤ÄS”%S‡5Sd%W—„eTddÄVD%V75Cd%G—…ETeDÄUd%UW5#d%'—…TeÄdä%d×5%Td%%7„ETdDód%'tódE&´W55Td%ETW5Sd%G—„¥TedÄvD5Te$ód%“”4ÄVÄ%SDÄdd%S‡55Td%e7†å´d%UGD%UcE—…ETeDÄwD5TSE—…%Tc—…%Tf¤ód%'„Ädä%S‡5eTd%eU5UTd%E7…%Te%—„ÅTd¤ód%#TDÄdä%SƒuTdEdGD%eÄdä%däDÄwD5TS%—…%Tf¤ód%7dÄS%W75Cd%¥7…%Te$ód%¤d4ÄfD%S‡5Cd%G§DeTæõ—…Teód%÷5cd%¥7…%Te$ód%¤d4ód%%TW5Sd%G§D%TåTódEtS‡55Td%¥7‡e´d%¦—„åTg§3t÷§3u%Tg¥“”4ÄfÄ%f·5•Td$æ´—5UTd&C“uTdFDUW5Sd%7—†¥Tf¤ód%#T4Ädä%W75Sd%W§D%Uf´Ädä%W75Sd%W§DeTæõ§D%fDtód¶6´ä$ÄVÄ%StÄdä%S‡55Td%e7†å´d%UGD%T×e—„¥Tdå—…ETeÄVÄ%eW5£¤%dSuTdDÃ—55Td%EUW5UTd%G—„¥TedÄvD5Te$ód%“”4ÄVÄ%SDÄed%d×55Td%e7‡E´d%g§D%Tçu—„¥Tdå—…eTeDÄVÄ%eW6%T¤%f3uTdF4T×55Td%ET×5eTd%W—„¥TedÄs5Te„ód%G¦D4ÄVÄ%S6%T¤%SG5“d$³—6¤%wD4÷§3tód%5…$TÄVÄ%f75eTd$æµ“uTdFDV75cd%G—„ÅTdÄód%%t÷§3u%TdÅ7„¥Te„Ädd%dW5Sd$äU“uTdDã75Sd%7—……Te„ód%&„4Ädä%W75cd%g§DåTæ´ÄfÄ%f·5“d%——„¥TdäÄfÄ%f·5“d%——„ÅTeó%'dÄfÄ%f·5“d%——„¥TdäÄfÄ%f·5“d%——„ÅTeó%'dÄfÄ%f·5“d%——„¥TdäÄfÄ%f·5“d%——„ÅTeóÄ%#Tdód%“u%Tg´W55Td%g—†ÅTge§D%TÓ5—…eTdäÄS%S6#¤%V·55Td&#—5d%—„ÅTdÄÄS%S5d%§D%Ug$7…%Td¤ÄWD%W75uTd%u7…%Te$ód%¤ä4Äed%V·55Td%57„ÅTdÄÄfÄ%f·5ETd%EGD¥Tç§D%Ud$ÄfD%Sƒu%TdEdGDeUeÄfÄ%f·5•Td$æ´—5UTd&C“uTdFDUW5eTd%E7†…Tf„ÄS%SuTdfV´—5Sd%7—……Te„ód%&„4Ädä%W75•Td%•7„¥TedÄvD5Te$ÄVD%V75#d%'—„ETdDód%%DäDÄdä%W75¥Td%¥7„¥TedÄs5Te„ód%¤äDód%%S‡5¥Td&5T“uTdDÕT—5Sd%7—†…Tf„ÄWD%W753d%7—…¥Te¤Äed%eSu%TdF4Uu%TdeG—…ETfÄód%%„$4Ädä%W75uTd%u7‡%´d&—5ETd%E7„ÅTdÄód%¦ÄDÄdä%W75Cd%G—‡%´d&—5ETd%E7„ÅTdÄód%#7DÄed%S65T¤%„d5&—…%TeÄdä%dÓuTdDÓ×5eTd%E7ƒ5´d&C¤DÄdd%S‡5Sd%W§D%TÓU—…%Td¤ÄWD%W75uTd%u7…%Te$ód%¤ä4Ä†D5Tg%—„ÅTdÄÄfÄ%f·5Cd%G—†…Tf„ÄwD5Tg%§D%Tãe%7„åTd%47‡%´d&T—63¤%„ä4ÄWD%W76¤%wD4ÄTä%TÓu5TdFµSuTd…7…eTdäÄWD%WDtÄS”%W753d%7—„ÅTdÄÄed%eW5%Td%%7†å´d%£—53d%7—…¥Te¤ÄUd%UW5£¤%vD4ÄwD5Tg%§D%T×¥'—…eTdäÄWD%W76¤%wD4ÄWD%W75Cd%G—†…Tf…—„åTd¤ÄUd%5¤TÄVÄ%V·6¤%wD4ÄWD%W75uTd%u7†…Tf…%7„ÅTd¤ÄTä%T×5%TdFVµ5eTd%eGD%VF”Äed%S5•Td%•V75UTdFT—6%T¤%s4ÄVÄ%V·5%Td%%7„eTãe—…¥Te¤Ä„d5Tg…—„eTç—…ETeDÄwD5Tg%—„eT×¥—…ETeDÄWD%W75uTd%uGD%V35—…ETdÄÄfÄ%f·5cd%g—„ÅTdÄÄWD%W75uTd%u7„eTddÄS%S5uTd%u7„ÅTdÄÄS%Su%TdF&µ“uTdE&§D%3&„…G—…ETeDÄD$5TWu—…%Tc5—…eTg%$GD%Tç547…%TdäÄfÄ%F„4ÄTä%T×5ETd%EGD%UW¥—„åTd¤ÄS”%F„4ÄS”%SƒuTdFV´×5Sd%G—…ETeDÄS%SuTdF4T—5“d%e7…%Te$ÄVÄ%V³uTdFDT—5cd%G—„ÅTdÄód%%uTde7…¥TedÄdd%dW5d%—†…Tf„ód%¦Ä4Ätd%d×5UTd%UGDeTçU—„ETdDód%suTç³‡55Td%E7w•´d%F—„åTW%§DeTWe—†¥Td$ód%w5Sd%U7†ÅTfÄÄs”5Td¤ÄVÄ%…d4ód%3'„TÄdä%dW6C¤%†D4Äs”5Td¤ÄVÄ%E$Dód%TSu%Td¶U—55Td%g—†¥Tg¥§D%T×e—……TeÄWD%W3u%TdE¤GDeVÅÄtä%t×5uTd&5TÓuTdFTU5Sd%7—†…Tf„ÄVÄ%V·5eTd%eGD%Ufõ—…%Td¤ÄfÄ%f·53d%7—‡¥´d&3—55Td%57……Te„ÄfD%f3uTdF6µW5UTd%57†…Tf„ÄS%SuTdF6´—6¤%f·6#¤%V·55Td&ET“uTdFF´×5cd%7—‡¥´d&3—55Td%57……Te„Ätd%tW5Sd%W§D¥Tç5%GD%Tä$Ätä%eW55Td%57…eTedód%¤d4ód%%S‡6T¤%vÄ4ÄfÄ%„dDód%¤äTÄdä%W75•Td%•7…TeÄed%eSuTdf&´×5eTd%E7…¥Te¤ÄWD%W763¤%„ä4ÄVÄ%V·5cd%g—……Te„ód%5¤dÄtä%eW5Cd%G—…eTedód%¦D4ód%%S‡5¥Td&5T“uTdDÕT—5eTd%E7‡E´d&%T—6#¤%V·55Td&ET“uTdF4U5eTd%E7‡%´d&—6#¤%V·55Td&ET“uTdf&µ5¥Td%g—†¥Tf¤ÄWD%W75“d%—§D%T×…—……TdÄÄs5TgE—…¥Te¤ÄwD5Tg%—‡´d&T—5d%×5£¤%ud$ÄfÄ%f75•Td%•7„ETdDóÄ%'„”ód%“u%TdeG—…ETfÄód%4$4Äed%S6%T¤%s4Äs”5Td¤ÄVÄ%…d4ód%4$TÄed%S6¤%wD4Äs”5Td¤ÄVÄ%…d4ód%%sTTÄud%f75“d%——„ÅTdÄÄtä%tÓuTdDÕT×5cd%7—‡E´d&%T—5uTd%u7‡%´d&—6T¤%vÄ4ÄTä%Tä$ÄvD5TfÅ7…¥Te„ÄS”%S‡5d%§D¥TÓ'§DeTät÷§3t÷§3t÷§3t÷§3u%Tf…U7‡E´dEF—…¥Tä$ÄwD5Tä$ÄvÄ5Tä$Äed%uTdEF—…%Td¤ÄvD5Tfå—„¥Td¤Äed%eW5#d%'§D%TçU§D¥Tätód%%TW5UTd%57‡´d&T—55Td%57…eTedÄVD%V3uTdF4T×5uTd%E7„¥Td¤ÄS%S6%U¤%stóÄ%4¤„ód%W65T¤%vÄ4ÄVÄ%V·5eTd%eGD%UWe—…eTdäÄtd%tW5cd%g§D%TÓU—†ÅTe„Ätd%tW5uTd%uGD%Tç5—†åd$ÔT—5cd%g—„ETdDÄ„ä5Tg¥§D%T×…$7†¥TdäÄfÄ%f·53d%7—‡¥´d&3—55Td%57‡´d&T“uTdF$UW5uTd%57……Te„ód%$—65T¤%f76T¤%vÄ4ÄfD%f3uTdF6´×6T¤%W76%T¤%s4Äud%uW6¤%wD4ÄvÄ5Tg—…%Te$ód%4$tód%“uETdE&—„ETdDóÄ%suTde7†…TeDÄed%eSuTdf&´—6#¤%vD4ÄVÄ%V·5eTd%eGDeTæõ§D%TätódFDU¤$ÄVÄ%S”ÄfD%d×55Td%e7‡E´d%g§D%Tçu—„¥Tdå—……TeDÄVÄ%eW6%T¤%f3uTeã—55Td%E7ƒ5´d%F—†¥Tge—‡%´d&“u%Te„Ó55Td%g—†ÅTge§D%TÓ5—……TeÄs”5Td¤ÄVÄ%V·5d%—„ÅTdÄÄS%S5d%§DeTÓU§DeUeÄfÄ%f·5•Td$æ´—5UTd&C“uTdFDUW5eTd%E7†…Tf„ÄS%SuTdfV´—5Sd%7—†ÅTfÄÄVÄ%eW6%T¤%f3uTdFV´×5Sd%7—‡%´d&—55Td%e7‡E´d%g§DeTÓU§DeUeÄud%„d4ód%¤d4Ädä%W75•Td%•7„ÅTdÄÄWD%W75uTd%u7…eTedód%'„TÄVÄ%Td”ÄwD5Tg—„ÅTdÄÄvD5Tfå—„ÅTdÄÄWD%W75Cd%G—…eTedÄTä%TÓu%TdF4USu%TdeG—…ETfÄód%%„$4Äed%S5¥Td%¥UW5Sd%G—„ÅTdÄÄWD%W75¥Td%¥7„eTddÄdä%d×53d%7—…TeÄed%eSuTd†DU—5eTd%E7†…Tf…—…ETeÄWD%W753d%7—…¥Te¤ÄUd%UW5Sd%W—…¥Te¤ód%#5¤dÄdä%W75uTd%u7……Te„ÄWD%W753d%7—…¥Te¤ÄUd%UW5ETd%E7…¥Te¤ÄWD%W75ETd%EGDeTçU&§D%TätódDãä$ÄVÄ%SÔÄdä%S‡55Td%e7†å´d%UGD%T×e—„¥Tdå57……TeDÄVÄ%eW6%T¤%f3uTdF4T×55Td%ET×5cd%W—„¥TedÄs5Te„ód%G¦D4ÄVÄ%S6#¤%SG5“d%£×6¤%wD4÷§3tód%5…¤TÄVÄ%f75cd$äT“uTdF6´×5cd%G—„ÅTdÄód%%t÷§3u%TdÅ7„¥Te„Ädä%d×5eTd$Ö´“uTdDã×5Sd%7—…¥Te¤ód%'4Ädä%W75uTd%u7„¥Td¤Ätd%tW5ETd%E7„¥TdäÄVD%W75•Td%•7„åTdäÄVÄ%S5#d%7—†…Tf„ÄS%S55Td%E7„ETd„ód%“”„ód$Ö´¤$ÄVÄ%f75¥Td&#ÓuTdDã×5cd%G—‡e´d%57„¥Td¤ÄTä%T×53d%7—„åTdäÄTä%TÓu%TdDõT“u%TdeG—…¥Te¤Ätd%E¤4Ädd%†D4ód%5$dÄed%S5•Td%•7„åTdäód%%‡4Ädä%W75uTd%uGD%Tç—…ETdÄÄtä%t×55Td%e7†å´d%U7„…Td„ÄVD%V75d%§D%US—…ETdÄÄud%uW55Td%e7‡E´d%g§D%Tãe—…ETdÄÄwD5Tg%—„¥TedÄs5Te„ód%¥dDÄdä%W75£ä%vDDÄVÄ%eW6%T¤%f3u%TdDåUu%TdeG—†ÅTg…§D%T×…—…ETdÄÄtd%tW53d%7—„ÅTdÄÄfÄ%f·5eTd%eGD%Tç5$7„¥Td%47‡%´d&T—53d%7—†å´d%£—53d%7—„ÅTdÄÄfÄ%f·5d%§D%TÓ5$7„¥Td%7‡%´d&T—53d%7—sE´d$ôT—53d%7—„ÅTdÄÄS”%S‡5eTd%e7„ETdDÄUd%UW5Sd%W—„ÅTdÄÄfÄ%f³u%TdDõV3u%TdeG—…ETfÄód&%T§u—…eTdäÄfÄ%fÄdÄdä%%—53d%7—„ÅTdÄÄud%uW5%TdFV´—5Sd%W—„ÅTdÄÄS”%S‡5eTd%e7„eT×e—…ETeDÄWD%W74æ´¤%E¤4ód%'¦ÄDÄed%S53d%3÷5Cd%7—„ÅTdÄÄWD%W75cd%g—„eTddÄvD5Tfå—…ETeDód%S&„dÄed%S5•Td%•W75Sd%G—‡E´d&%T—55Td%57„ÅTdÄÄfD%f3uTd†µW5eTd%E7†…Tf„ÄfD%f75uTd%u7„ÅTdÄÄfÄ%f·5%Td%%7…ETeDÄdä%dÓuTd„ÃW5Sd%7—…¥Te¤ÄfD%f753d%7—„ÅTdÄÄfÄ%f·5%Td%%7„åTdäÄfÄ%f·53d%7—„åTdäód%#Ttód%“uTã%#W55Td%EV74ÔT¤%†Ä4Äs”5Td¤ÄVÄ%V·5d%—…TeÄed%eW5d%§D%UgU$7„¥TdäÄvÄETdôÄS%SDÄvDETWu$GDefÇ•%7„¥Te„ÄS”%uSuTdFTT—5cd%CW5£ä%F„4ód%5¤Dód%%S‡5uTd%u7…%Tge—…ETfå$GD%Tç•&—…ETdÄÄdä%dÓuTde¤7…ETdÄÄtd%tW5cd%7…Td$Ädä%TW5UTd%W§DeTÓ5§DeUf„Äed%eW5ETd$Ö´“uTd%7……Td%—…ETd$ÄS%TW5ETd%7†…Td$ód%&„TÄfD%W75Sd%W—w•´d$Ö´—5ETd%E7„ÅTdÄÄdd%dW55Td%5GD¥Tç5%7„ETd$ód%TSt÷§3t÷§3u%Te%£—5UTd%U7„åTg¥$GD%Td$ÄfD%Td$Ädä%TW5ETd%7„åTd$Ätd%TSuTfõ$v„tÄed%TSuTg$V·5uTd%E7…TeÄWD%W75Cd%G§D%VCe—…¥TdäÄ„ä5Tge—„ÅTd$ÄWD%W76%T¤%Ww5Cd%7…ETd$ÄVD%„d4Ädd%ddTÄvDETSE—†¥Td$ÄS”%s”4ód%7„Äed%V·5d%—‡E´d&%T“uTdFDT—5¥Td%G§DåTåTód%%TW5uTd%E7…eTedÄVÄ%V·6UT¤%†Ä4ód%¦DDÄfÄ%S5•Td$³—5ETd%E7„ÅTdÄÄS”%S‡5£¤%vD4ÄS%SuTd„ãW6T¤%f75UTd%U7„ETdDÄS%S5“d%—§D%FDTåT×5uTd%USuTSE$S5“d%E7†…Tf„ÄWD%W75ETd%G—…ETeDód%#6„DÄtä%S5•Td%uTW5ETd%7†¥Td$ÄS”%TW5Sd%7……Te¤Äud%f÷5Cd%7…ETd%7„¥TcUµ—5£ä%F„4Ätä%TSuTd†VµW5uTd%57†…Tf„ÄS%SuTdF6´“uUTdE&§D%Ud$Ätä%S5“d%——…eTedód%¦Ä4ÄfÄ%V·5d%6C¤%…d4ÄVÄ%V·5cd%g—„…Td„ód%¥dDÄwD5Te$óÄ%G4ÔTä%D$E—†åd$ôT—5“d%——‡´d&T—5cd%g§EeTçu4GD%Tä$ód%“uTde7†¥TdäÄvD5Tfå—…eTedód%#&„DÄfÄ%V·5“d%——…%Te$ÄS%SuTdDõT—5£¤%S5•Td%•7„ÅTdÄÄ„ä5Tg¥—„åTdäÄfÄ%f·5“d%——„¥Td¤ód%'„tÄwD5Te$Ätä%t×5eTd%eGE%Tç5—……Te„Ätä%t×5Cd%G—„åTdäód%4$DÄvD5TdäÄtd%tW53d%7—‡…´d&5T—5ETd%E7…¥Te¤Ätä%t×5#d%'§D%Tæõ&—‡%´d%U7†¥Tf¤Äed%eSuUTdF$T×5cd%g—†¥Tf¤ÄfÄ%f·5ETd%EGD%Tãe—†å´d%E7†…Tf„ÄWD%W74ÔT¤%D$4ÄS%S5uTd%u7†¥Tf¤Ädd%dSuTdDÕU—6¤%dW5“d%——…eTedód%'„Dó%—5d%§D%VDTÄfD%W75ETd%E7‡%´d&“uTdDã—5“d%U7†…Tf„ód%%„¤4Ätd%Sƒu5TdEd7„ETd$ód%TSu%Tdee7‡¥´dEV—†…Tä$ÄS”%W6%T¤%#4ód%#T4Äed%S5%Td%%7…%Te$Ätd%tW5eTd%e7…TeÄVÄ%V³uTdF$U5eTd%E7…ETeDÄS%S5cd%g§D%Tæõ—…eTdäÄtd%tW55Td%57‡%´d&—5•Td%•7„åTdäód%%EdTÄdd%V·5uTd%u7„åTdäód%4$4ÄvÄ5Te„ÄfD%f3u5TdFTT“uTdE7…%Td¤Äed%eW5ETd%EGD%Tç5—‡´d%g—…ETeDóÄ%5$4ód%%TW5UTd%57„ÅTdÄÄfÄ%f³uTdF&´—5uTd%E7…ETeDÄVÄ%V·6C¤%†D4Äed%eSuTdF6µ5cd%7—……Te„ÄVÄ%V·5ETd%EGD¥TÓ§D%Ud$ÄfD%Sƒu%TdEdGDeUedÄ„d5Tå4Ätd%W5CdE7‡%´dF“uTdF$T—5eTd%E7„eTddÄdd%dW5•Td%•7…ETeDÄS”%S‡55Td%5GD%Tç$7…eTdäÄdä%d×5ETd%E7……Te„ód%&„DÄed%S5•Td%•7„¥Td¤ÄvÄ5Tg—†…Tf„ÄS%SuTddÓ5UTd%57……Te„ÄS%SuTdF&´—6T¤%f75eTd%eGD¥Tã%§D%Tä$Ädd%V·5eTd%e7„åTdäód%'„4ÄvÄ5Te„Ädä%dÓu5TdFDT“uTde7…%Td¤ÄWD%W75uTd%uGD%TçU—…¥TdäÄdä%d×55Td%57ƒ5´d&C—5eTd%eGD%Tç•$7……TdÄÄfD%f755Td%57„åTdäóÄ%¥d4ód%%TW5cd%G§DeTåTód%%eW4ÔT¤%—5•TdE7…Tä$Ä…d5Tã§D%Tã%—…eTdäÄUd%UW5UTd%U7†…Tf„ÄS”%S‡55Td%5GD%TãE—…eTdäÄdä%d×5ETd%E7……Te„ód%&„DÄed%S5•Td%•7„¥Td¤Ä„ä5Tg¥—†…Tf„ÄS%SuTdfUW5UTd%57…eTedÄS%SuTdF$T—6T¤%f75Sd%W§D¥Tã§D%Ud$Ädd%V·53d%7—…¥Te¤ód%#T4ÄfÄ%S5Sd%W—„¥Td¤Ä†D5Tc5—…eTedód%4¤TÄfD%W75cd%g—„¥Td¤ÄS%Su5TdDåT“uTde7……Teód%uTdE&§D%Ddµ•7w%´dEu7‡´d&T“uTdV&´×55Td%E7†åd%F§3tódFT¥ÄfÄ%fÄ„Ätd%f3uTä&F´—5uTd%uTW5•Td%g§D%%Tc%—…¥Te¥7†…Te„ódE…¤4ÄfÄ%fÄ$Ätd%f3uTä&F´—5uTd%uTW5•Td%g§D%c%—…¥Te¥7†…Te„ódE…¤4ÄfÄ%fÄ$Ätd%f3uTä&F´—5uTd%uTW5•Td%g§D%c%—…¥Te¥7†…Te„ódE…¤4ÄfÄ%fÄ$Ätä%f3uTä&F´—5uTd%uTW5“d%g§D%c%—…¥Te¥7†¥Te„ódE…¤4ÄfÄ%fÄ$Ätä%f3uTä†F´—5uTd%uTW5“d%g§3t÷§3t÷§3t÷§3t÷§3t÷§3t÷§3tóf%v„4ÄVÄ%uW4æ´¤%u—5ETd$ÔTÓuTW•×TódTã¤$ÄVÄ%SDÄdd%S‡55Td%e7†å´d%UGD%T×e—„¥Tdå—…%TeÄVÄ%eW5£¤%dSuTdfTT—55Td%E7‡ed%F—†¥Tfå$7w•´d$Ö´“u%TdFU—55Td%g—…Tg%§D%T×¥—……Teód%u%Tg¥³‡5uTd%u7…%TSE&§D%3”6&¶w5UTd%7„¥Td$ÄVÄ%TW55Td%GD%vDE57…eTdäód%%SG5Sd%7—…eTeDÄWD%TW5eTd%7…Td$Ädä%TW5Cd%U7……Te4ÄS”%TW53d&—55Td%e7†å´d%U7„…TdÄÄVD%W75d%'§D%T×e$7…ETdÄÄdd%S‡53d%7…eTd$ÄS”%TW5Sd%7…Te$Ädä%d—5Cd%7„ÅTfå—„¥TedÄvD5Te$ÄVD%W75#d%7—„ETd„ód%¤äTÄdä%W75eTd%W—„ÅTd$Äed%TW5Cd%7…ETd$ÄS”%dW5cd%V—…Td$ÄWD%wD4ód%&„DÄdä%W75eTd%W—„ÅTd$Äed%TW5Cd%7…ETd$ÄS”%dW5cd%V—…Td$ÄWD%wD4ód%'„Dód%%S‡6%T¤%w5£¤%W5£¤%W5“dE7…%Tå$ód%—55Td%U5ETd%7—‡¥´d&3—5“d%—§D%Tãe—„¥Td%—„åTdÄÄfD%f753d%7—„åTdäÄWD%W75ETd%E7„eTddÄtd%tW5“d%—§D%TçU%7„¥Td%7„åTdÄÄVÄ%VÄTÄWD%V³uTdE–—…eTdäÄwD5Tg%´×5ETd%7—…ETeDód%%…$DÄfD%S‡53d%7—†¥Tf¤ÄUd%UW55Td%5U53d%5GD%Tçu—…eTdäÄS%SDÄS%W755Td%57„åTdäód%%Dä4Ädd%V·5Cd%G—„…TdÄóÄ%#&„4ÄfD%f76%T¤%s4ÄWD%W3uTdf´×5•Td%G—„¥Td¥7„ÅTd¤óÄ%'4ÄS”%SƒuTdeD7„åTd%7„åTdÄÄud%uW5ETd%E7†ÅTfÄód%7DÄtd%S‡55Td%5TW53d%5GD¥Tç§D%Ud$Äed%S5Sd%W—…TeÄS”%SƒuTdDã—5eTd%E7……Te„ÄWD%W75Sd%W—„ÅTdÄÄdä%d×5¥Td%¥7…ETeDÄdä%d×5¥Td%¥7„ÅTdÄód%%w„„Ädd%V·5cd%g—„…Td„ód%&„4Ätd%S‡5¥Td%¥7„¥Td¤ÄS%SuTdFT×5eTd%57„ÅTdÄÄdd%dSuTdE¦—†ÅTeÄS”%SƒuETdFT“u5TdE&§D%Ud$ÄfD%Sƒu%TdEdGD%TätóddÓd$ÄVÄ%STÄdä%S‡55Td%e7†å´d%UGD%T×e—„¥TdäÄdä%d×55Td%e7†å´d%UGD%UW…—„¥TdäÄwDETdôÄtä%F„DÄD¤5TW•§DeTÓU%7„¥Te„ÄS”%vD4ód%74ÄfD%Sƒu%TdEdGDefÅÄfÄ%f·5UTd$æµuTg•×„tÄdd%TW55Td%GD%„ä557…eTdäód%%SG5Sd%7—…eTeDÄWD%TW5eTd%7…Td$Ädä%TW5Cd%U7……Te4ÄS”%TW53d&—55Td%e7†å´d%U7„…TdÄÄVD%W75d%'§D%T×e$7…ETdÄÄed%d×53d%7…eTd$ÄS”%TW5Sd%7…Te$ÄfD%d—5Cd%7„ÅTg%—„¥TedÄvD5Te$ÄVD%W75#d%7—„ETd„ód%'dód%%S‡6%T¤%w5£¤%W5£¤%W5“dE7…%Tå$ód%—5cd%G—‡¥´d&3—5“d%—§D%T×¥—……TeÄS”%S‡5%Td%%7„¥Td¤Ätä%tÓuTdf$T×5cd%G—†å´d%£—5“d%—§D%Tç•W55Td%TW5Cd%7—„ÅTdÄÄWD%W75ETd%E7„eTddÄwD5Tg%—„åTdäÄUd%UW5eTd%eGD%T×¥$7…eTdäÄfD%f75Cd%G—„¥Td¥7„åTd¤ÄVÄ%V³uTdf4T×5cd%G—„ÅTdÅ7„åTd¤ód%%v„4ÄfD%Sƒu%TdEdGD%TätódDÕTä$ÄVÄ%S$Ädä%S‡55Td%e7†å´d%UGD%UcE—„¥TdäÄsETdôÄtä%7DDÄD¤5TW•§DeT×e%7„¥Te„ÄS”%vÄ4ód%¤d4ÄfD%Sƒu%TdEdGDevÄ5G—…¥Te¤Ädd%†Ddód&V´“5&—…%Td$ÄVÄ%TW55Td%GD%D$557…eTdäód%%SG5Sd%7—…eTeDÄWD%TW5eTd%7…Td$Ädä%TW5Cd%U7……Te4ÄS”%TW53d&—55Td%e7†å´d%U7„…TdÄÄVD%W75d%'§D%T×e$7…ETdÄÄed%d×53d%7…eTd$ÄS”%TW5Sd%7…Te$ÄfD%d—5Cd%7„ÅTg%§D%Tæõ—…ETdÄÄed%d×53d%7…eTd$ÄS”%TW5Sd%7…Te$ÄfD%d—5Cd%7„ÅTg%§DeTç5§DeUeÄs5TäÔÄvD5Tä$ÄvD5Tä$Ätä%W5UTdEUGD%Tå4ÄfD%S‡5cd%g—†å´d%£¤$ÄS”%W763¤%„ä4Ätä%t×5d%§D%US%7…eTdäÄdä%d×5Cd%G—…Teód%¦D4Äed%S5cd%g—„ÅTdÄÄdä%d×53d%7—…ETeDÄud%uW5Sd%W—…ETeDÄud%uW53d%7§D%Ug5'—…%Td¤ÄfD%f75#d%'§D%Tæõ—†…TeÄud%uW55Td%57„åTdäód%&„DÄed%V·53d%7—…%Te$ód%%—5¥Td%G—…Teó%&„4óÄ%“uTde7……Teód%uTdE&§D%'U7„¥Tdå7…ETeÄVÄ%eW5£¤%dSuTdfTT—55Td%E7‡…d%F—†¥Tc$7ƒ´d&3u%TedÓ75uTd%u7…TWu§D%T×¥$7…eTdäód%fÄ—5Sd%G—†…Tf„ód%34$4Ädä%dW6T¤%vÄ4ód%74Ädä%vÄ4ÄvÄ5Tg—„¥TedÄvD5Te$ód%4$TÄdä%vÄ4Äud%uW55Td%e7†å´d%UGD%WFõ$7…ETdÄÄdä%dÓuTde¤7…ETdÄÄfD%f755Td%e7ƒ5´d%£—55Td%57†…Tf„ÄVD%V75#d%'—„ETdDód%'„dÄdä%W75•Td%•7…¥Te¤ÄWD%W75UTd%UGD%UW¥—…ETdÄÄtd%tW55Td%e7ƒ5´d%£—55Td%57…¥Te¤ÄVD%V75#d%'—„ETdDód%#TdÄdä%W75Sd%W—„ÅTdÄÄed%eSuTddã—5Sd%7—…¥Te¤ód%'4Ädä%W75Cd%G§DeTæ´ód%%S‡5Sd%¥GD%Tçu—…%Td¤Ä…d5Tc§D%UW¥—…eTdäÄdä%d×53d%7—…TeÄdä%d×53d%7§D%Tãe—…%Td¤ÄWD%W76%T¤%s4Ädd%dSuTdF$T×5cd%7—‡´d&T“uTdFDT—4æ´¤%…d4óÄ%74ód%%TW5UTd%57„ETdDÄWD%W75¥Td%¥7…TeÄWD%W75Cd%G—„åTdäÄVD%V3uTdF&µ5cd%7—†ÅTfÄÄWD%W753d%7—…TeÄS%SuTdDÓ×4æ´¤%…d4óÄ%74ód%%TW5eTd%E7…Te7…TdÄÄWD%W753d%7—…TeÄVÄ%V·5%Td%%7†…Tf„ÄWD%W75eTd%eGD%Tç•%7…%Td¤ÄWD%W75•Td%•7‡%´d&—55Td%57„¥Td¤ÄS”%SƒuTdF6µ5cd%7—†…Tf„ÄWD%W755Td%5GD%T×¥—s%´d&ET“u5TdFV´“uTde7…%Td¤Ä„ä5Tg¥§D%TãE—……TdÄÄud%uSu5TdFDT“u%TdE&§DeUe$ÄvÄ5Tc§D%TÓ5´W55Td%TW5Cd%7—„ÅTdÄÄWD%W75uTd%u7„eTddÄVÄ%V·53d%7—†¥Tf¤ód%4$TÄed%S55Td%5TW5Cd%7—…TeÄVÄ%V·53d%7§D%UWe—†…TeDÄVÄ%V·5#d%'—„ÅTdÄÄVÄ%V·53d%7§D%TÓ—…¥TdäÄVÄ%W755Td%57„ÅTe$ÄWD%W3uTddåT—5cd%7—…ETeDÄS”%S‡5#d%'—„ETdDÄWD%W755Td%57„ETdDÄVD%V75d%—„ÅTdÄÄVÄ%V·5d%—„…Td„ÄTä%V3uTdFFµ5cd%7—…ETeDÄS”%S‡53d%7—„…Td„ÄVÄ%V·53d%7—„¥Td¤ÄTä%T×5#d%'—„ÅTdÄÄVÄ%V·5d%—„…Td„ÄTä%V3uTdDõU5cd%7—…ETeDÄS”%S‡53d%7—„…Td„ÄTä%T×53d%7—„¥Td¤ÄTä%T×5#d%'—„…TdÄÄTä%T×53d%7—„¥Td¤ÄTä%T×5d%§D%TÓ$7……TdÄÄdä%d×5Cd%G—„ÅTdÄÄVD%V755Td%57„ÅTdÄÄVÄ%V·5d%—„…Td„ÄVD%W753d%7—„¥Td¤ÄTä%T×5d%§D¥Tæõ%GD%Ud$Ätd%d×55Td%57„…Td„ÄVÄ%V·55Td%57„ÅTdÄód%¤ä4ÄfÄ%S55Td%7—„¥Td¤ÄWD%dW53d%7§D%TÓ—……TdÄÄdä%d×5Cd%G—„ÅTdÄÄVD%V75#d%7—„ÅTdÄÄVÄ%V·5d%—„…Td„ÄWD%W755Td%57„ETdDÄTä%TÓuTdDÕU5cd%7—…ETeDÄS”%S‡5ETd%E7„…Td„ÄVD%V753d%7—„¥Td¤ÄTä%T×5#d%'—„ÅTdÄÄVÄ%V·5d%—„ETdDóÄ%¤äTód%%TW5eTd%E7…%Te$ÄWD%W75ETd%ETW5Cd%7—„…Td„ÄWD%W753d%3W5Cd%7—„¥Td¥7…TdÄÄVÄ%VÄ$ÄS”%W755Td%5TW5Cd%7—„ETdDÄTä%TÓuTdDãW5eTd%E7„åTdäÄTä%T×53d%7—„åTdå7…TdÄÄVD%VD$ÄS”%W75d%§D%Uc—…ETdÄÄdd%dW53d%7§D%Tç5—…ETdÄÄdd%dW5#d%'§D%Tæõ—…ETdÄÄS%S53d%7—†å´d%£—53d%7—†å´d%£—53d%7—†¥Tf¤ód%6„dÄdä%W75eTd%e7„ÅTdÄÄud%uW5#d%'—„ÅTdÄÄud%uW5#d%'—„ÅTdÄÄud%uW5d%§D%Ug5&—…ETdÄÄdä%d×5“d%—§DeTÓU§DeUe$Ätä%s”4ód%¤d4Ätd%d×55Td%57„…Td„ÄVÄ%V·55Td%57„ÅTdÄód%¤ä4ÄfÄ%S5ETd%E7„¥Td¤ÄWD%W3uTdf6´—5cd%7—……Te„ÄS%S55Td%57„…Td„ÄVD%V75%Td%%GD%Tç5—……TdÄÄfD%f75ETd%E7„ÅTdÄÄVÄ%V·5#d%'—„ÅTdÄÄVD%V753d%7—„eTddóÄ%#TTód%%TW5•Td%W—„¥Td¤ÄVD%V755Td%57„¥Td¤ÄWD%W3uTdDÓ—5uTd%E7„åTdäÄVÄ%V·53d%7§D%Ug•—……TdÄÄfD%f75ETd%E7„åTdäÄVÄ%V·5#d%'—„ÅTdÄÄVD%V753d%7—„eTddód%'„TÄfD%W75cd%g—„åTdäÄS%S55Td%57„…Td„ÄS%S5#d%'—„åTdäÄUd%USu5TdFDUuTde7…ETdÄÄfD%f75“d%—§DeTæõ§D%TätódF&¶EÄVÄ%S6%Tä%SG5“d&5U6ET¤%„äTód%S7„ÄfÄ%f·5Cd&CÓuTdFVµ5eTd%EGD%e%4Ädä%S‡5•Td%•GD%WGu—…ETg—‡´d&T—55Td%e7†å´d%UGD%Tçu$7…ETg—‡´d&T—55Td%e7†å´d%UGD%WG5$7…ETdÄÄdä%dÓuTde¤7…ETdÄÄfD%f755Td%e7ƒ5´d%£—55Td%57†…Tf„ÄVÄ%V·5d%—„…Td„ÄTä%TÓuTdF4UW5Sd%7—†…Tf„ÄfÄ%f·53d%7—…%Te$ód%%DäDÄdä%W75•Td%•7„¥TedÄ†D5Tfå—„¥Td¤ÄfÄ%f·5%Td%%7„…Td„ÄTä%TÓuTdF$UW5Sd%7—…ETeDÄWD%W75eTd%eGD%US5—…ETdÄÄfÄ%f³uTdF´—5Sd%7—…Teód%%u%TdeG—…ETfÄód%4$4Ädd%V·6ET¤%…d4ód%%Dä4Ädd%V·5d%—„ÅTdÄÄud%uW5Cd%G—„ÅTdÄÄS”%S‡5ETd%E7„…Td„ód%#TTÄfD%W75¥Td%¥7„ÅTdÄÄWD%W75Cd%G—„åTdäód%¤äDÄE¤5Tc§D¥Tãe§D%Ud$Ädd%V·5d%—„ÅTdÄÄud%uW5Cd%G—„ÅTdÄÄS”%S‡5ETd%E7„…Td„ód%#TTÄfD%W75¥Td%¥7„ÅTdÄÄWD%W75Cd%G—„åTdäód%¤äDÄE¤5Tc§D¥Tãe§D%Ud$Ädd%V·63¤%„ä4ód%6„4ÄfD%W75¥Td%¥GD¥Tã§DeTätód%%dW6T¤%…d4ód%¦D4Ädä%W75Sd%W—…TeÄVD%V75ETd%E7„åTdäÄTä%TÓuTdF6´×5Sd%7—…ETeDÄS”%S‡5#d%'—„ÅTdÄÄS%S5d%§D%Tçu—…ETdÄÄdä%d×5Cd%G—„…Td„ÄWD%W753d%7—„ETdDód%#TDÄdä%W75Sd%W—…TeÄVD%V75ETd%E7„ÅTdÄÄTä%TÓuTdF4T×5Sd%7—…ETeDÄS”%S‡5#d%'—„…Td„ÄVD%V75d%§D%T×e—…ETdÄÄdä%d×5Cd%G—„…Td„ÄVD%V75#d%'—„¥Td¤ód%%w„DÄdä%W75eTd%e7„ÅTdÄÄud%uW5#d%'—„ÅTdÄÄud%uW5#d%'—„ÅTdÄÄud%uW5d%§D%Tç5&—…ETdÄÄS”%S‡53d%7—†¥Tf¤ód%%3”4Ädä%W75Sd%W—†¥Tf¤ód%¦Ä4ód%%dW5“d&#“uTdDÕT—5Sd%7—……Te„ÄS%S5#d%'—„…Td„ÄTä%TÓuTdDã—5Sd%7—……Te„ÄS%S5#d%'—„…Td„ÄTä%TÓuTdDã—5Sd%7—……Te„ÄS%S5#d%'—„…Td„ÄTä%TÓuTdDã—5Sd%7—……Te„ÄS%S5#d%'—„…Td„ÄTä%TÓuTdDã—5Sd%7—……Te„ÄS%S5#d%'—„…Td„ÄTä%TÓuTddã—5Sd%7—……Te„Ätä%tÓu%TdFTÓuTdE&§D%'eG—„¥TdäÄs”ETdôÄtä%„äTÄ…d5Tg¥$GDed×…'—…¥Te¤ÄS”%†ÄDód%¤dTÄed%SuTeUV—…ETeÄtd%tSuTdÆ4T—5Sd%U7‡´d&T“uTdFV´—5Sd&T—6T¤%vÄ4ÄVÄ%eW5£¤%dSuTdÆ$U5Sd%7—…ETeDód%%u5Sd%7—……Te„ÄVÄ%eW6C¤%vD4ÄVÄ%V·5•Td%•7„ÅTdÄÄVÄ%V·5d%—„…Td„ÄTä%TÓuTdFVµW5Sd%7—†…Tf„ÄfÄ%f·53d%7—…%Te$ód%%DäDÄdä%W75•Td%•7„¥TedÄ†D5Tfå—„¥Td¤ÄfÄ%f·53d%7—„ETdDÄVD%V75d%§D%Tã%7…ETdÄÄdä%d×53d%7—…eTedód%%FD4Ädä%W75uTd%uGD%Tç—…ETdÄÄS”%Sƒu%TdE¤GDeUeÄdä%uSuTdF4T—5UTd%57ƒ´d&ET“uTddÓ—5eTd%E7…ETeDÄWD%W75Cd%G—…ETeDÄWD%W3uTdFV´×5UTd%57„ÅTdÄÄs5TgE—…%Te$ód%'„DÄfD%W76T¤%vÄ4ód%5$4ÄE¤5Tc§D¥Tãe§D%Ud$Ädd%V·5d%—„ÅTdÄÄud%uW5Cd%G—„ÅTdÄÄS”%S‡5ETd%E7„…Td„ód%#TTÄfD%W75¥Td%¥7„ÅTdÄÄWD%W75Cd%G—„åTdäód%¤äDÄE¤5Tc§D¥Tãe§D%Ud$Ädd%V·63¤%„ä4ód%6„4ÄfD%W75¥Td%¥GD¥Tã§DeTätód%%dW6T¤%…d4ód%¦D4Ätd%d×55Td%57„…Td„ÄVÄ%V·55Td%57„ÅTdÄód%¤ä4ÄfÄ%S55Td%7—„¥Td¤ÄWD%dW53d%7§D%US—……TdÄÄdä%d×5Cd%G—„…Td„ÄWD%W755Td%57„ETdDÄVD%V753d%7—„¥Td¤ÄTä%T×5#d%'—„ETd„ód%4¤TÄfD%W75Sd%W—…TeÄWD%W75#d%'—„…TdÄÄWD%W755Td%57„ETdDÄVD%V753d%7—„¥Td¤ÄTä%T×5d%§D%T×…$7……TdÄÄdä%d×5Cd%G—„ÅTdÄÄVD%V753d%7—„¥Td¤ÄTä%T×5#d%'—„…TdÄÄWD%W755Td%57„ETdDÄTä%TÓu5TdDåUuTde7…ETdÄÄS%S53d%7—†å´d%£—53d%7—†å´d%£—53d%7—†¥Tf¤ód%6„dÄdä%W75eTd%e7„ÅTdÄÄud%uW5#d%'—„ÅTdÄÄud%uW5#d%'—„ÅTdÄÄud%uW5d%§D%Ug5&—…ETdÄÄdä%d×5“d%—§DeTÓU§DeUe$Ätä%s”4ód%¤d4Ätd%d×55Td%57„…Td„ÄVÄ%V·55Td%57„ÅTdÄód%¤ä4ÄfÄ%S5ETd%E7„¥Td¤ÄWD%W3uTdf6´—5cd%7—……Te„ÄS%S55Td%57„…Td„ÄVD%V75%Td%%GD%Tç5—……TdÄÄfD%f75ETd%E7„ÅTdÄÄVÄ%V·5#d%'—„ÅTdÄÄVD%V753d%7—„eTddód%'TÄfD%W75cd%g—„åTdäÄS%S55Td%57„…Td„ÄWD%W75#d%'—„ÅTdÄÄUd%USu5TdF4UuTde7…ETdÄÄfD%f75“d%—§DeTæõ§D%TätóeÃ$$ÄVÄ%S$Ädä%S‡55Td%e7†å´d%UGD%UcE—„¥TdäÄF„5TdôÄtä%vDTÄtä%Su%TdÆ4U5uTd%u7…eTg§D%Tç5$7…eTdäód%G5Sd%7—‡E´d&%T“uTdfTT—5Sd%7—……Te„ód%%v„4Ädd%V·53d%7—…ETeDÄvÄ5Tg—‡%d&ÓuTdF&µW5cd%7—…¥Te¤ÄVÄ%V·6ä%wDDÄWD%W75Sd%W—„ÅTdÄóÄ%¥ddÄfD%f753d%7—…ETeDÄvÄ5Tg—‡Ed&%TÓuTdDÓW5cd%7—…¥Te¤ÄVÄ%V·6%Tä%sDÄWD%W75Sd%W—„ÅTdÄóÄ%¦DdÄfD%f753d%7—…ETeDÄvÄ5Tg—‡d&TÓuTdFVµW5cd%7—…¥Te¤ÄVÄ%V·6Tä%vÄDÄWD%W75Sd%W—„ÅTdÄóÄ%¤ädÄS”%SƒuTdED7…¥TdäÄVÄ%V·5ETd%E7‡E%Td&%USu5TdF6µ“uTde7…eTdäÄfD%f755Td%e7wu´d&“uETdDÓ×5Cd%G§DåTåÄfD%f3uETdEt7…¥Te¤óÄ%%5d%§D%UdTÄdä%W75UTd%U7„¥TedÄ„d5Tf„ÄWD%W75cd%g—…%Te$ód%¥dTÄdä%W755Td%57„ÅTdÄÄWD%W3u%TdF6´“u%TdeG—…eTfå§D%Tç•—…ETdÄÄed%eW5UTd%UGDeTãe§DeUeÄwD5Tg%—…Tg¥§D%TÓ5—…ETdÄÄdä%d×6¤%wD4ÄS%S53d%7§D%UW¥—…ETdÄÄS”%S‡53d%7—„ÅTdÄÄdä%d×5cd%g§D%UW…—…eTdäÄ„ä5Tg¥—„ÅTdÄÄS”%SƒuTdFTT×5Sd%7—…eTedÄtd%td$ÄS”%74ÄVÄ%V·6#¤%s”4ÄTä%T×5#d%'—‡e´d&#—5d%—„…Td„Äs”5Tge—„ETdDÄTä%T×5%TdDÕUW5Cd%G§D%UetÄdä%W75eTd%e7…Teód%%…$4Äed%S6¤%wD4ÄWD%W3u%TdDÃ“uTdE&§D%W¤dUG—„¥TdäÄD¤5TdôÄtä%E¤DÄ…d5TfÄód%W¤dTÄfÄ%f·5uTd%£ÓuTdFµ5eTd%EGD%e%4Ädä%S‡5•Td%•GD%WGu—…ETe$ÄvÄ5Tg§D%Tãe—…ETg—†ÅTfÄÄVÄ%eW5£¤%dSuTdÆU5Sd%7—†¥Tf¤ód%%sT4Ädä%W75cd%g—„¥TedÄ†D5Tfå—„¥Td¤Ätd%tW5#d%'—„…Td„ÄTä%TÓuTdF$UW5Sd%7—†…Tf„ÄfÄ%f·53d%7—…%Te$ód%%DäDÄdä%W75•Td%•7„¥TedÄ†D5Tfå—„¥Td¤ÄfÄ%f·5#d%'—„…Td„ÄTä%TÓuTdF&µW5Sd%7—…ETeDÄWD%W75eTd%eGD%US5—…ETdÄÄfÄ%f³uTdF´—5Sd%7—…Teód%%u%TdeG—…ETfÄód%4$4Ädd%V·6ET¤%…d4ód%%Dä4Äed%S5Sd%W—„ÅTdÄÄfÄ%f·5Sd%W—…¥Te¤ÄWD%W3uTdDÕU5UTd%57„ÅTdÄÄs5TgE—…%Te$ód%'„DÄfD%W76T¤%vÄ4ód%5$4ÄE¤5Tc§D¥Tãe§D%Ud$Ädd%V·5d%—„ÅTdÄÄtd%tW5Cd%G—„ÅTdÄÄfÄ%f·6UT¤%†Ä4ÄVD%V3uTdFVµW5cd%7—†…Tf„ÄWD%W753d%7—…¥Te¤Ä†Ä5TcU§D%Tç%7s%´d&ET“u5TdFV´“uTde7…%Td¤Ä„ä5Tg¥§D%TãE—……TdÄÄud%uSu5TdFDT“u%TdE&§DeUe$ÄvÄ5Tc§D%TÓ5—†…TeDÄVÄ%V·5#d%'—„¥Td¤ÄVÄ%V·53d%7§D%T×¥—…¥TdäÄVÄ%W755Td%57„ÅTe$ÄWD%W3uTddåT—5cd%7—…ETeDÄS”%S‡5#d%'—„ÅTdÄÄVÄ%V·5d%—„…Td„ÄWD%W755Td%57„ETdDÄVD%V75d%'§D%Tç•$7……TdÄÄdä%d×5Cd%G—„ÅTdÄÄVD%V75#d%7—„ÅTdÄÄVÄ%V·5d%—„…Td„ÄWD%W755Td%57„ETdDÄTä%TÓuTdDÕU5cd%7—…ETeDÄS”%S‡53d%7—„…Td„ÄWD%W755Td%57„ETdDÄVD%V75#d%7—„ÅTdÄÄVÄ%V·5d%—„ETdDóÄ%¥dTód%%TW5Sd%7—„åTdäÄWD%W75£¤%vD4ÄWD%W75£¤%vD4ÄWD%W75“d%—§D%TãE%7…ETdÄÄed%eW53d%7—†…Tf„ÄVD%V753d%7—†…Tf„ÄVD%V753d%7—†…Tf„ÄTä%TÓuTddåUW5Sd%7—…ETeDÄS”%S‡55Td%57„…Td„ÄVD%V75d%§D%Tæõ—…ETdÄÄdä%d×5Cd%G—„¥Td¤ÄWD%W75•Td%•7„…Td„ÄWD%W75•Td%•7„…Td„ÄWD%W75•Td%•7„ETdDód%%…$tÄdä%W75Sd%W—†¥Tf¤ód%¦Ä4ód%%dW5“d&#“uTdDÕT—5•Td%W—„¥Td¤ÄVD%V755Td%57„¥Td¤ÄWD%W3uTdDÓ—5uTd%E7„åTdäÄVÄ%V·53d%7§D%Ug•—……TdÄÄfD%f75ETd%E7„¥Td¤ÄVD%V75#d%'—„eTddód%'„DÄfD%W75cd%g—„åTdäÄWD%W755Td%57„…Td„ÄWD%W75#d%'—„ÅTdÄÄUd%USuTdFµ5cd%7—……Te„ÄS%S5ETd%E7„¥Td¤ÄVD%V753d%7—„…Td„ÄWD%W75%Td%%GD¥Tçu$GD%Tä$Ädä%W75cd%g—„åTdäÄWD%W755Td%57„eTddód%%wDÄdä%W75cd%g—†¥Tf¤ód%&„Dód%“uU#E%TW55Td%ETW5Sd%G—„¥TedÄvD5Te$ód%%†„4ÄVÄ%S4Ö´¤%SG5“d$æ´×5“d%EGDeWG$7…¥Te¤ÄfÄ%vDDód%'TÄed%SuTdEF—…ETdÄÄs5TgE§D%UcE—…ETdÄÄtd%tSuTdf$T—5Sd%7—…¥Te¤ÄVÄ%V·6UT¤%†Ä4ÄWD%W75eTd%eGD%US5$7…eTdäÄfD%f755Td%e7wu´d&“uETdDÓ×5Cd%G§DåTåÄfD%f3uETdEt7…¥Te¤óÄ%%5d%§D%UdTÄdä%W75UTd%U7„¥TedÄ„d5Tf„ÄWD%W75cd%g—…%Te$ód%¥dTÄdä%W755Td%57„ÅTdÄÄWD%W3u%TdF6´“u%TdeG—…eTfå§D%Tç•—…ETdÄÄed%eW5UTd%UGDeTãe§DeUeÄwD5Tg%—…Tg¥§D%TÓ5—…ETdÄÄfD%f753d%7—‡%´d&—5ETd%E7„ÅTdÄód%%w„TÄdä%W75Cd%G—„ÅTdÄÄWD%W75cd%g—„ÅTdÄÄfD%f3uTdfµ5eTd%E7‡¥´d&3—53d%7—…Teód%6„DÄdä%W75eTd%e7†…Tf…7…Tãe—„¥Td¤Äs”5Tge—„ETdDÄVD%V76#¤%s”4ÄTä%T×5#d%'—‡e´d&#—5d%—„ETdDÄUd%¤ddÄS”%SƒuTdef—…ETdÄÄed%eW5Cd%G§D%Uc—…eTdäÄwD5Tg%—„ÅTdÄód%“”4ód%“uUce‡55Td%E7ƒ5´d%F—†¥TWu—‡%´d%W§DefG$7…¥Te¤ÄS”%sDód%4$TÄed%SuTd•V—…ETfå—‡´d&T—55Td%e7‡´d%UGD%WG$7…ETdÄÄdd%dSu%TdE¦§DeUeÄwD5Tg%—†ÅTc5—†å´d$³“uTdDõUW5eTd%E7‡%´d&—5¥Td%¥7†¥Tf¤ód%%„¤TÄ†Ä5Tg…—„ÅTdÄÄvD5Tfå—„ÅTdÄÄtd%tW53d%7—„åTdäÄS%Su%TdDÃSuTdE&§D%td$Ädä%d×65T¤%„d4ÄvD5TW%—†…TS—…%Tc5§D%T×e'—…%TdäÄWD%W75uTd%uGD%Uc%—‡´d%¥7„ÅTdÄÄfD%f3uTddÃ—5ETd%57…%Te$ód%—6%T¤%uW5Sd%W—„eTddÄVÄ%V·5#d%'—„ETdDÄVÄ%V·5Cd%G—„¥Td¤ÄVD%V75d%—„¥Td¤ÄS”%S‡55Td%57„…Td„ÄTä%T×55Td%57…TeÄVÄ%V·5#d%'—„eTddód%¥dtÄs5TfÄÄdä%d×5%Td%%7„¥Td¤ÄVD%V75d%—„¥Td¤ÄS”%S‡55Td%57„…Td„ÄTä%T×55Td%57…TeÄVÄ%V·5#d%'—„ETdDÄVÄ%V·5Cd%G—„¥Td¤ÄVD%V75%Td%%GD%TÓ&—‡E´d%¥7…ETeDÄUd%UW55Td%57„…Td„ÄTä%T×55Td%57…TeÄVÄ%V·5#d%'—„ETdDÄVÄ%V·5Cd%G—„¥Td¤ÄVD%V75%Td%%7„¥Td¤ÄS”%S‡55Td%57„…Td„ÄUd%USu%TdDÃ“uTdE&§D%#'U7„¥TdäÄdd%dW55Td%e7‡´d%UGD%dce—…ETeDÄvÄ5TWu—…%Tf¤ód%5$dÄS%W75Cd%¥7…%Te$ód%¤d4ÄfD%S‡5Cd%G§DeTæõ—…Teód%÷5cd%¥7……Te„ÄS%S53d%7—„åTdäÄTä%TÓu%TdDÃÓuTde7…ETeód%uU&ÕG—„¥TdäÄ„ä5TdôÄS%D$4ód&#ãE—…¥Te¤Ädd%…d4ód$Ó—…—…ETg—†å´d%£—55Td%e7‡´d%UGD%SU$7…ETe$Ä…d5Tc§D%„ä4ã—5Sd%7—…ETeDód%%u5eTd%E7…eTg%§DåTã—„ÅTdÄÄTä%T×53d%7—„åTe„ÄfD%f3uTdDÃ—5•Td%7—ƒ´d&ET“uTdDåT—5uTd%57„¥Td¤ÄVÄ%V³uTdev—†ÅTeó%u5TdE&§D%Ud$Ädä%W76#¤%s”4ÄS”%SƒuTdFT×5cd%G—……Te„ÄVÄ%V·5ETd$ÔT—5Cd%G—…eTedÄS”%Sƒu%TdDÕUSt÷§3t÷§De…¤57„¥Te„Äed%†Ä4ód%'„DÄdd%V·53d%7—‡¥´d&3“uTdDã—6ET¤%vÄ4ÄWD%W75“d%——„ÅTdÄÄWD%W75ETd%E7„ETdDód%4¤TÄfD%W76ET¤%…d4óÄ%¦Ä4ód%%TW5cd%G—„ÅTdÄód%%u%Tg%³‡5Sd%¥GD%Tçu—…ETdÄÄS”%S‡5cd%g—„ÅTdÄód%¦Ä4ód%“uUeW55Td%E7‡E´d&%T—55Td%e7‡´d%UGD%V7¥—„¥Tdå7…ETeÄVÄ%eW6T¤%dSuTdDÃ—55Td%ET×5Sd%G—„¥TedÄvÄ5Te$ód%7“”4ÄVÄ%S63¤%„ä4ÄVÄ%eW6T¤%dSuTdÄõT×55Td%E7…¥Te¤ÄVÄ%eW6T¤%dSuTdf4T×55Td%ET×5Sd%U7„¥TedÄvÄ5Te$ód%E‡4ÄVÄ%S65T¤%SG5ETd&UT“t÷§3t÷§3t÷§DeE¤”õT—5uTdE%7„åTä$ÄS”%W5cd%£5d%—„…Tç$7‡´d$³×5d%—„…Tæõ$GD%‡…&—…ETe$Äud%uW55Td%e7‡´d%UGD%WCe—…ETe$ÄfÄ%f·55Td%e7‡´d%UGD%WC—…ETe$ÄfÄ%f·55Td%e7‡´d%UGD%dc—…ETe$Ä†D5Tc5§D%D$6T×5Sd%U7…eTg§D%†Ä6V´×5Sd%U7‡¥´d&3—55Td%e7‡´d%UGD%WFõ$7…ETe$Ä†D5Tc5—„¥TedÄs”5Te„ód%34¤TÄdä%dW4æ´¤%E¤4ÄVÄ%eW6T¤%dSuTce5‡TÄdd%TW55Td%7„¥Td$ÄVÄ%TW55Td%7„¥Td$ód&#D¤Ädä%W75Cd%G§D%TæÄdä%W753d%7—‡E´d&%T“uTddã—5Sd%7—…%Te$ód%%t—5Sd%7—……Te„ó%%5uTd%g—„ÅTd$Ädä%d×5“d%d7…Td$ÄWD%„ä4ó%'DÄfÄ%f753d%7…ETeDÄtä%e5Cd%7„ÅTg¥§DåTç—†ÅTf¤ÄWD%TW5Sd%W—‡´d%d7…Td$ÄWD%†Ä4ó%5¤DÄtd%f·5ETd%7„ÅTd$Ädä%d×5¥Td%d7…Td$Ädä%TW5#d&5T—5ETd%7„åTg•—…Td$ÄWD%vDDÄVÄ%eW6T¤%dW5#d%7—„¥TdäÄTä%V3uETdDåUW5uTd%g—„ÅTd$Ädä%d×5“d%d7…Td$ÄWD%„ä4óÄ%#TDód%%TW5Sd%7—‡´d&T“u%TdFTT“t÷§3u%Tg#W55Td%g—†ÅTge§D%TÓ5—…eTdäÄS%S6#¤%V·55Td&#“uTdf4T×5eTd%E7…ETeDÄWD%W753d%7§D%Tãe—…%Td¤Ädd%dSuTdEf—…eTd¤ÄVÄ%V·5ETd%EGD¥Tæõ§D%Ud$Ätd%d×53d%7—„…Td„ÄWD%W753d%7—†ÅTfÄÄdd%dW5ETd%EGD%Tã$7†ÅTeDÄVÄ%V·5#d%'—„¥Td¤ÄWD%W75¥Td%¥7„eTddÄUd%UW5eTd%e7…%Te$ÄWD%W3uTdFµW5uTd%57„¥Td¤ÄWD%W75¥Td%¥7„eTddÄUd%UW5eTd%e7„ETdDÄTä%TÓuETdDõTÓu5TdE&§D%Ud$ÄfD%Sƒu%TdEdGDeS”$ÄVÄ%f75Sd%£ÓuTdFV´×5cd%G—„ÅTdÄód%%u%TdE7„¥Te„ÄS”%S‡5UTd$³“uTW…##TTÄdd%TSuTS#·5Sd%57„ÅTd$ÄWD%W75uTd%D7…Td$Ädä%TW5#d%——…ETeDÄs5TgE§D%T×¥—……TdÄÄdd%dW5Sd%W—‡%´d$ÔT×5Cd%G§D%TãE%7†…TeÄWD%W75UTd%U7…ETeDóÄ%“”4ód%#W5Sd%7—…eTedód%#%—5UTd%57„ÅTdÄÄdä%dÓuTdFT—5eTd%57„ETdDÄWD%W75UTd%U7…ETeDÄs5TgE§D%TÓ—†…TdÄÄdd%dW5Sd%W—‡e´d&#—55Td%57‡e´d&#—53d%7—…%Te$ÄfD%f3uETdDåU“u5TdE&§DeTätód%£¤$ÄVÄ%f74äT¤%D¤Dód%4$TÄfD%S‡53d%7§DeTæ´÷§3t÷§DeS$ÄVÄ%f·65T¤%s”Dód%¦ÄDÄfD%S‡53d%7—„ÅTdÄÄdä%d×53d%7—„ÅTdÄÄS”%S‡5“d%—§DeT×¥$G3t÷§3u%Tge‡5¥Td&5T“uTddÕT—5Sd%7—‡e´d&#—53d%7—„ÅTdÄÄWD%W75ETd%EGD%TÓU—…ETdÄÄ„ä5Tg¥—„ÅTdÄÄWD%W753d%7—…eTedód%#4$TÄdd%V·53d%7—…Teód%%5cd%7—w•´d$Ö´—53d%7—„ÅTdÄÄS%S5UTd%UGD¥T×…$7…Teód%#w5cd%7—w•´d$Ö´—53d%7—„ÅTdÄÄWD%W75UTd%U7„eTddÄed%eW5%Td%%7†ÅTfÄÄVÄ%V³u5TdDÕU“uTd…7…eTdäÄ„ä5Tg¥—„ÅTdÄÄ†D5Tc5§D%Tãe$7…ETdÄÄWD%W75•Td%•7„ÅTdÄÄtd%tW53d%7—„ÅTdÄÄD$5TWu—„ETdDÄUd%UW5•Td%•7‡E´d&%T“uTdFVw5Sd%7—…eTedÄWD%W753d%7—…¥Te¤ód%#4¤DÄdä%W75eTd%e7„ÅTdÄÄWD%W74ÔT¤%D$4ÄUd%UW5eTd%eGDeTç%G3t÷§3u%TdåG—…%Tf¤ód%#T4Ädä%W753d%7—……Te„ÄWD%W753d%7—‡…´d&5T“uTd†4U5Sd%7—„ÅTdÄÄtd%tSuTdFF´—5Sd%7—„ÅTdÄÄfÄ%f·6T¤%vÄ4ÄWD%W76#¤%s”4ÄWD%W753d%7—„åTdäód%#&„tÄed%S63¤%„ä4ÄWD%W76C¤%†D4ód%7TÄdä%W753d%7—†…Tf„ÄWD%W75•Td%•7„ÅTdÄÄWD%W74ÔT¤%D$4ÄTä%T×5%Td%%7†…Tf„Äs5TgE§D%Tæõ47…ETdÄÄed%eW53d%7—„ÅTdÄÄfÄ%f³u%TdFF´Ót÷§3t÷§3u%Te%G—…TeÄS”%„d4ód%'DÄdd%V·5Sd%W—„eTd„ód%#&„4Ädä%W74ÔT¤%D$4ód%'“”4Äed%S65T¤%„d5$7…TãE—„ÅTdÄÄWD%W75Sd%W—„eTçU—‡E´d&%T—53d%7—‡E´d&%T—5%TdDÓ×6%T¤%s4ÄWD%W76¤%wD4ód%'¦DDÄtä%%V753d%7—„ÅTdÄÄfÄ%f·5%TdFDT—55Td%5U5Cd%7—……Te„ÄWD%W75“d%——„ÅTdÄÄdä%d×5%Td%%7†ÅTfÄÄVÄ%V·53d%7—…ETeDÄdä%d×5d%—„eUg5'—†…Tf„ÄWD%W76C¤%†D4ÄTä%T×5%TddÓ×5£¤%vD4Äs”5Tge—„ÅTdÄÄdä%d×5uTd%u7„ÅTdÄÄUd%#TdÄvD5Tfå—„ÅTdÄÄdä%d×5uTd%u7„ÅTdÄÄdä%d×5¥Td%¥7„ÅTdÄód%'“”dÄ†D5Tge—‡¥´d&3—53d%7—„ÅTdÄÄfD%f3uTdDÃ5“d%e7„¥Td¤Äs5TgE—„eTddÄed%eW5%Td%%7†ÅTfÄÄWD%W765T¤%„d4ÄUd%UW55Td%57‡E´d&%T“uTd†¶w5Sd%7—……Te„Ädä%dÓuTd†V´—5Sd%7—…eTedÄWD%W753d%7—…¥Te¤ód%4¤DÄdä%W75•Td%•7„ÅTdÄÄdä%d×5%Td%%7†…Tf„ÄWD%W76C¤%†D4ÄTä%TÓuTd¤ãW5eTd%E7s%´d$æ´¤dÄS”%&„DÄvÄ5Tg—„ÅTdÄÄs”5Tge—„ÅTdÄÄs5TgE—„eTç5%7…Teód%—5Sd%7—„ÅTdÄÄfD%6%T¤%s4ÄWD%W75cd%c—5Cd%7—„ÅTdÄÄdä%d×5%Td%%7†…Tf„ÄD$5TWu—„eTddÄed%eW5d%—„eTÓ'—…¥Te¤ÄWD%W765T¤%„d4ód%#7DÄdä%W753d%7—†…Tf„ód%5¤4Ädä%W753d%7—…¥Te¤ÄvÄ5Tg—„ÅTdÄÄs”5Tge—„ÅTdÄÄWD%W75ETd%EGDeTç5&§3t÷§3tód%CW5cd%g—„åTW•§D%TÓ—†…TeDÄWD%W75#d%'—„ÅTdÄÄWD%W75¥Td%¥7…%Te$ÄS%SuTdFDU5¥Td%W—„¥Td¤ÄVD%V755Td%57„ÅTdÄÄud%uW5%Td%%7„eTddÄed%eW5UTd%U7„ÅTdÄód%'dÄtä%S5cd%g—„ÅTdÄÄud%uW5%Td%%7„eTddÄed%eW5d%§D%Tçu$7†¥TdäÄS”%S‡5Sd%W—„åTdäÄs5TgE—…ETeDÄvD5Tfå—„åTdäÄWD%W75Sd%W—……Te…7„åTd¤ód%%Dä„ÄfÄ%V·5Cd%G—„…TdÄód%%u5¥Td%7—†å´d%£¤$Ädd%S5d%—„¥Td¤ód%#&„DÄud%W755Td%57‡E´d&%T“uTdDåT—5£¤%S5Sd%W—„ÅTdÄÄS”%SƒuTdDÓ—5¥Td%7—†ÅTfÄÄWD%W76C¤%†D4ÄS%S5%Td%%7„¥Td¤Äs5TgE§E%Tç5&§DåTätóÄ%“u%TdE&§3t÷§3u%TdåU7s´d&ÓuTdFTTä$ÄVÄ%Td$ÄS”%W763¤%„ä4ÄWD%W753d%7—……Te„ód%%v„TÄdd%V·53d%7—…Teód%%$DÄS%Td$ÄS”%W763¤%„ä4ÄWD%W75ETd%E7……Te„óÄ%#TTÄS”%SƒuTdEDTW5ETd%TW5Cd%7—„ÅTdÄÄWD%W74ÔT¤%D$4ód%7E7„åTd%7…TdÄÄtd%tW53d%7—„ÅTdÄÄfD%f3u5TdFV´ÓuTde7…ETdÄÄ†D5Tc5µ5Cd%7—„¥Td¥—„åTd¤ÄUd%UW5Cd%G§DeTç•$G3t÷§DeWE$ÄD$5TcU§D%T×e—……TeÄWD%W75eTd%e7„ÅTdÄÄdd%dW5“d%—§DeTçU$G3t÷§DeWE$ÄD$5TcU§D%T×e—……TeÄWD%W75eTd%g—„ÅTdÄÄdd%dW5Sd%W—‡%´d$ÔT×5eTd%eGDeTçU'§D%Tätód¤ÕeeÄdä%dädÄD¤5TWu—…%Tc5—…eTg%$GD%Tç547…%TdäÄfÄ%F„4ÄTä%TÓuTdf6´×5ETd%57…TSE§D%Tç5—…ETeÄdä%d×5ETd%EGD%Tçu—†¥TedÄdd%dW55Td%5GD%Tã—……TeÄWD%W3u%TdE¤GD%Ud$ÄfÄ%eW5UTd%U7„ETdDÄtd%tSuTdDõT—5•Td%W—…%Te$ód%#T4ÄTä%TÓuTdE4GD%…Ädä%d×6ä%%5UTdE7…eTääód%G5Sd%G—…ETeDÄdd%dW5d%—…eTedód%'DÄed%S5Sd%W—…ETeDÄWD%W3uTdDã—5UTd%57„ETdDÄdd%dSuTdEt7ƒ5d&×5Cd%G—…%Te$óÄ%#TTód%—5d%§D%Tä”ódE–³‡5Sd%W—‡…´d&5T—5Sd&5UuTdôÕU—5ETd%GD%S”dÄdd%S6¤%wD4Äs”5Td¤ÄVÄ%E$4ód%6„TÄtd%f75eTd%e7…ETeDód%¥d4Ädd%V·5eTd&TÓuTdF6´×5Cd%'§D%TäTÄfÄ%S5•Td%u7„ÅTd$ÄvD5Tfå—„¥Td¤ÄS”%S‡5ETd$Ó—5Cd%7„ÅTfå—„ÅTdÄód%5¤TÄed%V·5•Td%•7…%Te$ÄS%SuTdDã—5¥Td%G§DåTåTód%W63¤%vD4ÄVÄ%V·5Sd%W—…%Te$ód%4¤DÄvD5TedÄdd%dSu5TdF4T—5Sd%W—…¥Te¤ód%5¤4ód%W5Sd%G§D%TåTódEv³‡55Td%E7ƒ´d%F—„åTW•§DewDVT×5“d%—§D%wU¤7…ETe$Äed%eW6#¤%V·55Td&C“uTdDõT×5Sd%U7†å´d$Ö´×5d%§D%Tçu$7…ETe$Ä7D5TW%§D%dã%—…ETe$Ätd%7D4ÄTä%TÓuTgE6„DÄdä%dW6C¤%†D4Äs”5Td¤ÄVÄ%E¤Dód%'tÄdä%dW6ET¤%…d4ód%'¦D4Ädä%W74Ö´¤%D¤4ÄWD%W76UT¤%†Ä4ÄWD%W755Td%5GDeTãe%GDe…$E7„¥Te„Ädä%wDDód%¤äDÄfD%S‡53d%7§DeTæ´÷§3tód%3W55Td%g—†¥Tc§D%Tæõ$7…¥Te$ÄWD%W763d%„ädód%%sTtÄfD%S‡53d%7§DeTæ´ód%%TW55Td%g—‡´d$³ÓuTdFTU5eTd%E7„åTdäÄs”5Td¤ÄVÄ%vDDód%&„TÄdä%W75UTd%U7…%Te$ÄTä%T×5¥Td%¥GD%TçU—‡´d%g—†ÅTfÄÄdd%dW5d%—‡%´d&“uTdF&µ5uTd%57„¥Td¤Ätd%tSuETdFF´—5d%§D¥Tä”ÄTä%TÓuTdE$7……TeÄS%S53d%7—„…Td„ód%5¤4ód%%TW55Td%g—…¥Tg…§D%TÓU—…eTdäÄS%S6#¤%V·55Td$Ö´“uTdDÓ×5Sd%7—†ÅTfÄÄdd%dW5d%—‡%´d&“uTdDã×6#¤%t×5eTd%e7…%Te$ÄTä%T×5•Td%•GD%TÓ—…¥Td¤ÄVÄ%V·5UTd%UGDåTç5—„ETdDóÄ%w5d%§D%TäTÄfD%S‡5ETd%E7„ÅTdÄÄVD%V3u%TdFF´“u%TeEG—…ETeDÄS”%vÄDód%“”DÄdä%W75UTd%U7„¥Td¤ÄWD%W3uTdfDT—5UTd%57…¥Te¤ÄWD%W763¤%„ä4ÄVÄ%V·5ETd%E7„¥Td¤ód%7TÄdd%V·5•Td%•7„åTdäód%4¤4ÄwD5Te¤Äs”5Td¤ÄVÄ%†D4ód%6„DÄfD%W763¤%„ä4ÄVÄ%V·5ETd%E7„åTdäÄdä%dÓu5TdFDUuTdE7†¥TedÄVÄ%V·53d%7§D%UgU—…ETdÄÄ…d5Tc§DeTÓU§3t÷§DeWEÄtä%t×5Cd&TÓuTdF4U5uTd%U7„ÅTdÄÄF„eTSE%GD%UW¥&—…ETdÄÄdä%d×53d%7§DeTç•§DeUeÄfÄ%f·5Cd&TÓuTdF$U5Sd%7—…%Te$ÄS”%S‡53d%7§D%Uce—…eTdäÄfÄ%f·53d%7—‡¥´d&3—55Td%57„åTdäÄVÄ%V³uTdDÓ5“d%e7…TeÄWD%W3uTdfDT—5Sd%7—ƒ´d&ET“u%TdDõT“t÷§3u%TdÅG—‡´d&T—5Cd&TÓuTdFFµ5uTd%U7„ÅTdÄÄs”uTge&§D%Ug'—…ETdÄÄfÄ%f·53d%7§DeTãE§DeUeÄud%„d4ód%¤d4Ädä%W75uTd%uGD%Ug—†…TeDÄVÄ%V·5#d%'—„¥Td¤ÄWD%W75“d%——…%Te$ÄWD%W3uTdF$U5uTd%E7†…Tf„ÄWD%W75“d%——„ETdDód%5¤DÄvÄ5Te„ÄWD%W75•Td%•GD%TÓ5—‡´d%g—„ÅTdÄÄwD5Tg%—…TeÄWD%W3uTdDõT×6T¤%f75•Td%•GD¥T×…§DeTätód%%S‡5UTd%—§D%TçU—…ETdÄÄfÄ%f³uTdf´—5•Td%W—„¥Td¤ÄVD%V755Td%57„ÅTdÄÄtä%t×5UTd%U7„ÅTdÄód%'„TÄfÄ%S5•Td%•7„ÅTdÄÄtä%t×5d%§D%Tã%—‡´d%g—„ÅTdÄÄtd%tSuTdDã—6T¤%f753d%7—‡%´d&—5Cd%G—„ÅTdÄód%¦ÄDÄvÄ5Te„ÄS%Su5TdF&´“u%TdE&§DeUeÄS”%S‡5Cd&5T“uTdF´×5Sd%7—…¥Te¤ód%%w4Ätd%d×55Td%57„…Td„ÄVÄ%V·53d%7—……Te„Ädd%dW53d%7§D%T×e—……TdÄÄfD%f75d%—„eTddÄwD5Tg%—„åTdäÄVD%V753d%7§D¥Tç•$GD%Ud$Ätd%d×55Td%57„…Td„ÄVÄ%V·53d%7—†¥Tf¤Ädd%dW53d%7§D%Ug5$7…¥TdäÄtd%tW53d%7—†¥Tf¤ÄTä%TÓuTdFF´×6T¤%f753d%7—†…Tf„ód%¦D4ÄvÄ5Te„ÄWD%W76¤%wD4ÄS”%S‡53d%7§D%TÓU—‡´d%g—…TeÄWD%W3uTd¦F´—6Cä%wDDÄfD%f75ETd%E7„ÅTdÄÄ†D5Tc5§D¥Tç5&§DeTät÷§3t÷§3tód%UdW5“d%—§D%Tçu—…%Td¤ÄTä%T×53d%7—‡¥´d&3“uTdDõT“u5TdE&§D%Ud$Äed%S6¤%E¤DÄTä%TÓuTdF4U5eTd%E7‡E´d&%T—6#¤%V·55Td&C“uTdF6µ5eTd%E7‡%´d&—6#¤%V·55Td&C“uTdF4U5eTd%E7…¥Te¤Äs”5Td¤ÄVÄ%s”4ód%%DdDÄud%f75“d%——„ÅTdÄÄdä%dÓuTdF6´×5cd%7—‡´d&T—5uTd%u7‡%´d&—6T¤%vÄ4ÄvÄ5Tg—…ETeDóÄ%'„ód%W5Sd%7—†å´d%£“uTdf6´—5eTd%E7„åTdäÄ„d5Tg…—…ETeDód%¤dDÄdä%W75•Td%•7„ETdDód%#T4Ädd%V·53d%7§D%TåÄfD%W75cd%g—„ÅTdÄÄVD%V3uTdFTT—6Cä%wDDÄWD%W75d%—……TW•§D%‡ÆVµW5uTd%7„¥Td$ód$Ö·E$Ätä%W75ETd%7„ÅTd$ÄWD%W763¤%„ä4ÄVÄ%V·5ETd%E7„åTg•—…Td$Ädä%TW5#d&C×5Sd&TT×5Cd%7„ÅTfå$7„ÅTdÄÄVD%V3uTdDÓ6T¤%SƒuUTdEdGD%Tä$Ätd%W75cd%g—„ÅTdÄÄS%SuTdDÓ—5¥Td%G§DåTåTÄTä%TÓu5TdE4GD%Ud$Ädä%W76ET¤%…d4ód%¦Ä4ód%%dW6T¤%G5uTdE7‡%´dE7‡´dE7‡´dE7……Tä$ód%W5UTd%57†å´d%£—55Td%57…eTedÄVD%V3uTdF&´Óu5TdE&§D%Ud$Ädd%V·6T¤%vÄ4ÄVÄ%V·5eTd%e7„…Td„ód%4$DÄed%V·5d%—„ÅTdÄÄF„5TSE§D%Tã—†å´d%U7„ÅTdÄÄs”UTge$GD%Tç%7†…TdÄÄ7D5TW%§DåTã§D%Tä$óÄ%“uTde7‡…´d&T—55Td%57…eTedód%%3”4Äed%S5•Td%•7……Te„ód%¦Ä4Äud%f75•Td%•7…¥Te¤ód%'„DÄed%V·6C¤%†D4ód%¥d4Äed%V·5cd&ÓuTdFDT×5ETd%TW4Ö´¤%D$4ÄfD%f75d%—‡¥´d&3“uTdDÕU5“d%E7…¥Te¤ÄWD%W763¤%„ä4ÄVÄ%V·6T¤%vÄ4ód%'„dÄfÄ%V·5cd%g§D%Tæ”Ä„d5Te„ÄvÄ5Tg—……Te„ód%4¤DÄs”ETc5§D%TãE—‡´d%7—‡´d&T—5¥Td%¥7‡%´d&—6T¤%vÄ4ÄvÄ5Tg—…ETeDód%4$„ód%—5cd%g—„ETdDÄ…d5Tc§D%Ug—‡…´d%g§E%Tæ”ó%—5d%§D%TäTÄed%V·5eTd%eGD%TæÄwD5TedÄVÄ%V·5UTd%UGDåTãE§D¥Tätód%%TW6#¤%vD4ÄWD%W75eTd%eGD%UWe—‡e´d%£—55Td%57…eTedód%&„Dód%%dW6UT¤%†Ä4Ädd%†D4ód&6³‡¥$7…%Td$ÄVÄ%TSuTcC·5eTd%7—„åTd$ÄWD%TW53d%7—‡¥´d&3—55Td%57„åTdäÄS%„¤DÄS”%TW5Sd%7„…Tc5—…ETcE—…Td$ÄWD%vDTÄWD%W75#d%'§D%T×¥$7†…TeóÄ%uTd…7……TeÄwD5Tg%—…TeÄWD%W3uTdF6´×5cd%G§DeTåTód%“uVóUF´W55Td%E7‡Ed&%TÓuTdÆV´×55Td%ET×4ÔT¤%†Ä4Äs”5Td¤ÄVÄ%V·5d%—…TeÄed%eW5d%§D%W7…$7„¥TdäÄE$ETS—‡e´d%57„¥Td¤ÄTä%T×53d%7—„ETdDód%%DdTÄVÄ%S4æ´¤%SG5ETd%ET×4äT¤%„äTód$ÔT§%7„¥Te„ÄS”%uSuTdFTT—5cd%CW4äT¤%D$4ód%#TDód%%S‡5uTd%u7…%Tge—…ETS§D%DäV6µ—5UTd%GD%E$U57…ETdÄÄdä%dÓuTde¤7…ETdÄÄwD5Tg%—……Td$ÄS”%TW5Sd%7…%TeDód%&„DÄdä%W765T¤%„d4ÄfD%TW5Cd%7…ETd$Ädd%dÓuTdF&´×5Sd%7—ƒ5´d&ET—53d%7……Td$ÄS”%TW5Sd%7…%TeDÄ†Ä5TeTÄS”%TW53d&TÓu%TdDÃu%Tde•7…eTedÄS%D¤4ód%TW5cd%T×5Sd%7„åTd$ÄS%TW5•Td%GD%Tæõ$7……TdÄÄdä%d×6ET¤%…d4ÄS%S53d%7—…%Te$ÄVÄ%V³u5TdDõU5d%GDeTd$÷§3t÷§3tód%Ut×5UTd%U7„åTg%$GD%Td$ÄfD%Td$Ädä%TW5ETd%7„åTd$Ätd%TSuTdFDUW5uTd%E7……Te„ÄS%S53d%7—…eTedÄVÄ%V³uTdDÕT×5eTd%57…¥Te¤ÄS%SuTdF4T—5¥Td%G§DåTåTód%%TW5uTd%E7……Te„ÄS%S53d%7—…eTedÄVÄ%V³uTdDÕT×5eTd%57…¥Te¤ÄS%SuTdF4T—5¥Td%G§DåTåTód%%TW5•Td%G§D¥TåTÄTä%TSu%Td%GDeUf¤Äed%eW5ETd&uTd%7……Td%7…ETd$ÄS%TW5ETd%7†…Td$ód$Ó“%7…eTd$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TSuTS&¶·5uTd%E7…TeÄWD%W75Cd%G§D%VCe—…¥TdäÄ„d5TgE—„ÅTd$ÄWD%W76%T¤%Ww5Cd%7…ETd$ÄVD%„d4Ädd%ddTÄE$5TWu—†¥Td$ÄS”%s”4ód%4$„Äed%V·5d%—‡%´d&“uTdF6´—5¥Td%G§DåTåTód%%TW5uTd%E7…eTedÄVÄ%V·65T¤%„d4ód%%‡DÄfÄ%S5•Td$³—5ETd%E7„ÅTdÄÄS”%S‡5£¤%vD4ÄS%SuTddãW5uTd%E7†…Te¤ÄWD%TW53d%7—†ÅTdÔÄS”%TW5Sd%7„…Tg%´W4äT¤%D$4Ätä%TSuTddõU5eTd%57„ETdDÄfD%f3uTdE¤7†ÅTeó%uTde7…¥TdäÄtä%t×5eTd%eGD%TÓU—…eTd¤ÄTä%TäTÄ†D5Tc—„¥Td¤ÄfD%f75#d%'§D%TÓ—†å´d%UGEeTäôÄ„äETg¥×4äT¤%D$4Ätä%t×6T¤%vÄ4ÄfD%f3uUTdDåV3uTdE7†ÅTeó%uTde7…¥TdäÄtd%f·53d%7…eTedÄtä%e—5Cd%7…ETd$ÄVD%„d4ÄVÄ%V·5d%—†å´d%£—5“d%—§D%…$”õUW5uTd%UW53d%T×53d%T×53d%T×53d%T×53d%7„¥Td$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TW55Td%7„¥Td$ÄVÄ%TW55Td%GD%…d•E7†¥TdäÄS”%S‡5cd%g—†ÅTfÄÄVÄ%W3uTd„åT×5uTd%57…%Te$ÄS%SuTdFT—6¤%dSuuTdEF—sd$äT×5Sd%W—‡Ed&%T×5¥Td%¥7„¥Td¤ód%¦D„ód%W6T¤%SƒuUTdEdGD%Ud$Ätä%S5“d%——†ÅTfÄód%5sTDÄtä%S6#¤%´ÄS%TW5¥Td%¥7†ÅTfÔÄS”%TW5Sd%TW55Td$äT—5£ä%TSuTddõT—5uTd%57„ÅTdÄÄ†D5Tc5—‡e´d&#—5ETd%EGD%Tãe$7†å´d%E7ƒ5´d&C—6T¤%vÄ4ód%“”DÄtä%V·5d%—wud$ÔT×55Td%57‡…´d&5T—5#d%'§D%Tãe%7‡e´d%UGF¥TäôÄ„äETg¥—†åd%£×6T¤%vÄ4Ä„d5Tg…—ƒU´d&UT¤tÄE$5TWu—†¥Tf¤óÄ%“”Äód%—5Cd%G§D%TäÔÄwD5TdäÄvD5Tfå—‡´d&T“uTdFF´×5£¤%V·5“d%——…%Te$ód%6„4Ä„d5TeÄWD%W763¤%„ä4ÄS%Su£¤%5$DÄdd%dW55Td%e7‡´d%U7„eTddÄfD%ed„ÄS%TW5“d%——…TeÄfD%„¤4ÄS”%Td$ÄS%7D4ÄTä%T×5#d%7—„…TdÄÄTä%V75d%§Få´dF4U—5Sd%UT×5ETd%7†¥Tf¤ÄS”%S‡5cd&6´—5Cd%TW5ETd$³“u£¤%5¤DÄdä%ddDÄS%TW5“d%——…TeÄfD%„¤4ÄS”%Td$ÄS%7D4ó$ä%7DÄTä%TÓuuTdE47……Te„Ätä%t×5Sd%W§D%Tæõ—‡…´d%G—„ÅTdÄÄ…d5Tc—„åTdäó&D5Tã%—…%Te$ÄVÄ%eW6T¤%dW5%Td%%7……Tee—„åTd$Ätä%t×5UTd%U7……Tc—…Td%7„åTfå—„ETdDÄVD%W75#d%7—„ETd„ÄTä%TÓu£¤%4¤tÄdä%dW53d%7†¥Tf¤Ädd%dW5cd&DT—5Cd%7„ÅTfå§Få´dFTT×5ETd%E7„¥TedÄvÄ5Te$ÄUd%UW5cd%e7„ÅTd$Ätä%t×5UTd%U7…ETc—…Td$ÄWD%F„4ÄTä%T×5#d%7—„…TdÄÄTä%V75d%§Få´dFµ—5Sd%U7„ÅTd$Ätä%t×5UTd%U7……Tc—…Td$ÄWD%vDDó$ä%¤dDÄTä%TÓuuTdE47……Te„Ätä%t×5Cd%G§D%TÓU—‡…´d%G—„ÅTdÄÄ„d5Tg…—„åTdäó&D5Tç•—…%Te$ÄVÄ%eW6T¤%dW5%Td%%7……TedÄWD%TW5“d%——„åTdäÄfD%„$4ÄS”%TW53d$ôT—5d%—„…TdÄÄVD%W75d%'—„ETdDó&D5TçU&—…%Te$ÄVÄ%eW6T¤%dW5%Td%%7……TedÄWD%TW5“d%——„åTdäÄfD%„$4ÄS”%TW53d$ôT—5d%—„…TdÄÄVD%W75d%'—„ETdDó$ä%4¤tÄTä%TÓuuTdE4GEeTätód%“uTde7…¥Td¤ÄfÄ%f·5UTd%UGD%Tã—‡´d%G—„ÅTdÄÄ„ä5Tg¥—„åTdäóÄ%5$DÄdd%dW55Td%e7‡´d%U7„eTddÄfD%eW53d%7…¥Te¤ÄS”%S‡5cd&&´—5Cd%7„ÅTS%—„ETdDÄVD%W75#d%7—„ETd„ÄTä%TÓuuTdF$U—5Sd%U7„ÅTd$ÄfÄ%f·5Cd%G—……TgU—…Td$ÄWD%E¤4óÄ%4¤DÄdd%dSueTdEf—„ETdDód%w5cd%g—…¥Te¤Ädä%dÓuTdDõT—6T¤%S‡53d%7—ƒ´d&ET—5ETd%EGE¥Tã%—…%Te$ÄVÄ%eW6T¤%dW5%Td%%7……TedÄWD%TW5uTd%u7…%Te$ÄfD%„$4ÄS”%TW53d$ôT—5d%—„…TdÄÄVD%W75d%'—„ETdDóÄ%#TtÄdä%dW53d%7…¥Te¤Ädd%dW5cd&4T—5Cd%7„ÅTSE§E¥Tã—„åTdäÄVÄ%eW6T¤%dW5%Td%%7……TedÄWD%TW5uTd%u7…%Te$Ädä%„$4ÄS”%TW53d$äT—5d%—„…TdÄÄVD%W75d%'—„ETdDóÄ%“”dÄdd%dSueTdEf—„ETdDód%suTde7†å´d%U7„ÅTdÄÄE$ETS—…ETeDÄE$ETS§DåTæõ47„ETd$ód%%TW5uTd%E7‡%´d&T—53d%7…eTedÄs5TetÄS”%TW5Sd%7„…TWu§E%T×e—„ETdDÄ„d5Tg…—‡E´d$³ÓuTceDDädÄtä%Td´ód$ÔW…$ÄvD5TdäÄdä%dd$ÄS%TW6#¤%s”4Ätä%„$4ÄS”%Td$ÄS%vÄDÄTä%T×5#dDã×55Td%57„ETdDÄtä%tÓuTdF$T—6¤%S5ETd%E7†…Td$ÄS”%TW5Sd%7…eTe¤Ädä%TSuTdfTT—5£¤%V·5Cd%G—„åTdäód%%—63¤%dSu£¤%G6$%wDTÄtä%t×6ETä%…dDÄdä%dÓu“dF$VsuTdE7‡…´d%G§E¥TåTód%%TW6%T¤%SƒueTdEd7„ETdDÄUd%W5Cd%G—„ETdDÄdd%„äDÄS”%S‡55Td%5GD%US$7‡´d%G§E¥TäÔÄfD%f3uuTdEt7„åTdäÄs”5Tge§EeTÓ§E%Tätó%TSuTd…&—…Td$ÄWD%TW5eTd%e7…¥TetÄS”%TW5Sd%7„…TgE—…%Te$ÄTä%T×5“d%——…¥Te¤ód&SG…$7…¥Td%GD%vÄõE7†¥TdäÄud%uW5•Td%•GD%Tç5—…¥Td¤ÄvD5Tfå—„åTdäód%6„4ÄwD5Te$ÄWD%W74ÔTä%D$DÄS”%S‡65Tä%„dDód%#T„ód%“uTd…7†¥TdäÄD¤5TWu´W5ETd%7†…Tf„Äs5Tf”ÄS”%TW5Sd%TW55TdDåT—55Td%57„ETdDÄs5TgE§D%TãE—†å´d%E7…%Te$ÄwD5Td$ÄS”%TW5Sd%7†ÅTg—†¥Td$ód%%3”4Ätä%V·5Sd%W—„åTdäód%'4Äs”5Te$ó$ä%G4ÔTä%D$DÄS”%S‡4æ´ä%E¤DÄtä%tÓuuTdDõV3uTdE7‡E´d%G§EeTåTód%%TW6T¤%SƒuUTdEd7„ETd$ÄUd%×5Cd%G—„ETdDÄed%7DDÄdä%d×55Td%GD%UgU%7†¥TdäÄdä%d×5•Td%•7…eTedÄS”%S‡5cd%g—†…Tf„ÄS%S55Td%5GD%UWe%7…¥Td¤ód%÷65T¤%tW5UTd%U7„ETdDÄvD5Tfå§D%Tçu—†¥Td¤ÄvÄ5Tg§D%UgU—‡%´d%E7…¥Te¤ÄvD5Tfå§D%Tç5—‡%´d%E7…TeÄfD%f75Sd%W§D%Tç—‡%´d%E7†…Tf„ÄfÄ%f³uTdDÃ—6¤%S5UTd%U7……Te„Äed%eSuTd†&´×6¤%S5eTd$³Óu“dF&µ5cd%g—†å´d%£“u“dDÓ—5cd%g—†å´d%£“u“dDÓ—5“d%——†å´d%£“u“dDõT—5cd%g—†å´d%£“u“dDÓ—5uTdE%7†å´d%£—5“d%——…T×…—„¥TedÄvÄ5Te$ÄUd%UW5eTd%e7†å´d%£—5eTd%e7„¥TãE$GE¥Tå4ód%#W6¤%S5UTd%U7„ÅTdÄÄtd%tW5ETd%E7…TeÄdä%d×6ET¤%…d4ód%¦DdÄvD5Td¤Ädd%dSuTdEf—‡e´d%E7…ETeDóÄ%'4ód%%TW6#¤%dW5Sd%W—„ÅTdÄód%6„4ód%%TW4äT¤%wD4ód%4$4ÄTä%TÓuETdE47„ETd$ód%#W5“d%U7†…Tf„ód%%„¤4Ätd%Sƒu5TdEd7„ETd$ód%TSu%Tde——…eTedÄS%wDTód%TW5cd%U5Sd%7„åTd$ÄS%TW5•Td%GD%w4åUW5eTd%7„¥Td$ÄVÄ%TSuTg%V¶·5uTd%E7…TeÄWD%W75Cd%G§D%VCe—…¥TdäÄtä%f·53d%7„ÅTdÄÄs5TdÔÄS”%TW5Sd%7„…Tg…—…%Te$ÄWD%TW5Cd%g§D%T×…$7…eTd¤ÄTä%T×5cd%g§D%Tæ´Äud%SƒuETdEdGD%VD$ÄfÄ%S5•Td%u7„ÅTd$ÄWD%W75¥Td%D7…Td$Ädä%TW5#d&—53d%GD%Tçu—…¥TdäÄD¤5TW•—†…Td$ÄS”%TW5Sd%7…eTe„ód%¥dDÄed%V·5d%—wu´d$ÔT“uTdDã—5¥Td%G§DåTåTód%%TW5uTd%E7‡E´d&%T—4äT¤%TW5Cd%7…ETd$Ä†Ä5TWu§D%TçU$7…eTd¤ÄTä%T×6¤%wD4ód%4¤4Äud%SƒuETdEdGD%Ud$ÄfÄ%S5eTd%e7„¥Td¤Ä„d5Tg…§D%Uce—…¥TdäÄtd%7D4ÄS%S53d%7—…TeÄvD5Tfå—„åTdäód%%FDdÄfÄ%S6¤%vÄ4ÄWD%TW6UT¤%†Ä4Äs5Tce—…Td$Ädä%TW5#d&UTÓuUTdDõU5d%—‡…´d&5T—6%T¤%„äTód$Óç5&—†¥Td%§D%E%EU7†å´d%E7…TeÄfD%f76#¤%s”4ÄVÄ%W3uTdFµ5“d%57…%Te$ÄS%SuTdFT—6#¤%dSu“dEF—‡%$Td&5“d%——‡Ed&%T×6#¤%s”4ÄVÄ%V³uuTdDãsuTdE7‡E´d%G§EeTåTód%%TW5£¤%S5“d%•TW5ETd%7‡e´d&#—5“d&4T—5Cd%TW5ETd&T×5d%—„…Td„ÄVÄ%V·5d%—†å´d%£—5“d%—§D%„%V&¶75£¤%Td$ÄWD%TdDÄWD%TdDód&5e%dÄwD5TdäÄdä%d×55Td%e7‡´d%U7„…TdÄÄVD%W75d%'§D%TÓU—†å´d%57†ÅTfÄÄdd%dSuTdFV´—65T¤%SƒvT¤%„tÄS%TW5¥Td%¥7…TeÄS%…$4ÄS”%Td$ÄS%D¤4ó&Ä5T×¥´×5ETd%7†ÅTfÄÄS”%S‡5ETd&DT—5Cd%TW5ETd$Ö´“u£¤%¤ä4Äud%uW5Cd%G—„¥Td¤ÄTä%T×5¥Td%¥7…TeÄVÄ%V³tó$ä%5¤TóÄ%“uTde7‡E´d%G—„ÅTdÄÄ„ä5Tg¥—„åTdäó$ä%5$Dó$ä%W5Sd%UT×5ETd%7†ÅTfÄÄfD%u—5Cd%TW5ETd&UT“u“dF´×5UTd%UGE¥TåtÄTä%TÓueTdE47„ETdDód%%U6T¤%S‡5%Td%%7…eTedód%4¤4ó%TSuTd¥&—wu´d%7…Td$Ädä%TW6T¤%wD4Ädd%dW5d%—‡´d&T—5¥Td%¥GD%Tãe$7†¥TdäÄtä%t×5£¤%vD4ód%4$DÄfÄ%V·5d%—†…Tf„ód%&„4ód%“uTde7‡e´d%u7…%Te$ÄTä%T×5“d%—§D%v…vV´×5“d%U—53d%T×53d%T×53d%GD%vÅuU7†å´d%E7…TeÄfD%f75Sd%W§D%Tç—†¥Td¤Ädd%dW5ETd%EGD%Tæõ—‡e´d%UGF¥TäôÄ„dUTg…$7…eTedÄsETgE—…ETeDóÄ%¦D„ód%SueTdE&§D%VD$ÄvD5TdäÄtd%tW55Td%e7‡´d%UGD%Tç•—†¥Td¤ÄvD5Tfå—…¥Te¤ód%¦Ä4Ä…d5Te„ó%d%$tÄS%TW5£¤%vD4ÄfD%f75ETd$Ó—5Cd%TW5ETd%£Óu¥TdFTäDÄS%TW5£¤%vD4ÄfD%f75ETd$Ó—5Cd%TW5ETd%£Óu¥TdFTäDÄS%TW5£¤%vD4ÄfD%f75ETd$Ó—5Cd%TW5ETd%£ÓuuTdF$TÓueTdE&—…Teód%w6ET¤%f755Td%57„…TdÄÄVÄ%S5d%'§EeT×e§D%Ud$ÄvD5TdäÄdä%d×5£¤%vD4Äed%eW5Cd%G—……Te„ÄvD5Tfå—„åTdäÄVÄ%V³uTdf6µ—5£¤%S5eTd$³ÓuuTdF&µ5cd%g—†å´d%£“uuTdDÓ—5cd%g—†å´d%£“uuTdDÓ—5“d%——†å´d%£“uuTdDõT—5cd%g—†å´d%£“uuTdDÓ“ueTdE&§D%VD$ÄvD5TdäÄD¤5TWu—„ÅTd$ÄvD5Tfå—‡E´d&T—5Cd%7…ETd$ÄVD%¥d4ÄVÄ%V·5d%—‡E´d&%T“uTdFTT—6¤%S5UTd%U7‡%´d%7…Td$Ädä%TW5¥Td&T—5“d%GD%UWe—†å´d%57…ETeDÄS%SuTdF´—63¤%dSu£¤%G4ÔTä%D$DÄed%eW4æ´ä%E¤DÄtä%tÓu“dF¶suTdE7‡…´d%G§E¥TåTód%%TW6%T¤%SƒueTdEd7„ETd$ÄUd%×5Cd%G—„ETdDÄed%7DDÄdä%d×55Td%GD%VGU%7†ÅTdÄÄdä%d×5d%—…ETeDód&fÆõ—†å´d%U“uTgueW6¤%S5Sd$³¤$ÄS%TW53d%7—…ETeDÄTä%T×5ETd%¦—…Td%7„åTge§D%Uce$7‡%´d%E7…%Te$ÄWD%W75•Td%•7„åTdäÄS”%S‡5Sd%W—ƒ´d&ET“uTdDãW5£¤%V·5UTd%UGD%TåtÄs”5TdäÄdä%dÓuuTdF´“uTde7‡e´d%U7…ETeDÄWD%W3ueTdFTT—5d%§E%Tä”ÄTä%TÓuETdE47„ETd$ód%#W5cd%7—„åTdäÄwD5Tg%§D%TÓ5—†¥Te$Ätd%tSuTdf6´—5•Td%G§D¥TåTÄTä%TSu%Td%GDeUe$Ätd%G5ETdE7…Tä$Ädä%W6UT¤%#”4ód%4$4Äed%S5•Td%•7„¥Td¤Äs5TgE—„åTdäÄS”%S‡5Sd%W—ƒ´d&ET“uTdfFµ—5UTd%57„ÅTdÄÄvÄ5Tg§D%TãE—…¥TdäÄdä%d×55Td%57ƒU´d&UT—5eTd%eGD%Tã$7……TdÄÄvD5Tfå—„¥Td¤ÄS%SuTdDÃ—5•Td%G—†¥Tf¤ÄWD%W75£¤%vD4óÄ%¥dDód%%TW5cd%G§DeTåTód%%dW63¤%G5•TdE7…%WC§D%Tã%—…eTdäÄdd%dW55Td%57‡d&T×5ETd%EGD%Uce$7…eTdäÄfD%f755Td%57‡¥´d&3—53d%7§D%Ufõ$7†å´d%u7„¥Td¤Ädd%dSuTdfTT—5UTd%57„ÅTdÄÄs”5Tge§D%T×¥—…¥TdäÄdä%d×55Td%57s´d$äT—5UTd%UGD%Tã%$7……TdÄÄs5TgE—„¥Td¤ÄS%SuTdF$T×5•Td%G—†¥Tf¤ÄWD%W76%T¤%s4óÄ%“”Dód%%TW5cd%G§DeTåTód%%dW6ET¤%G5•TdE7…%S§D%Tã%—…eTdäÄdd%dW55Td%57‡%d&×5ETd%EGD%UW…$7…eTdäÄfD%f755Td%57‡¥´d&3—53d%7§D%Ufõ$7†å´d%u7„¥Td¤Ädd%dSuTdfTT—5UTd%57„ÅTdÄÄs”5Tge§D%T×¥—…¥TdäÄdä%d×55Td%57s´d$äT—5UTd%UGD%Tã%$7……TdÄÄs5TgE—„¥Td¤ÄS%SuTdF$T×5•Td%G—†¥Tf¤ÄWD%W76%T¤%s4óÄ%“”Dód%%TW5cd%G§DeTåTód%%dW65T¤%G5•TdE7…%VÃ§D%Tã%—…eTdäÄdd%dW55Td%57†åd%£×5ETd%EGD%UcE$7…eTdäÄfD%f755Td%57‡¥´d&3—53d%7§D%Ufõ$7†å´d%u7„¥Td¤Ädd%dSuTdfTT—5UTd%57„ÅTdÄÄs”5Tge§D%T×¥—…¥TdäÄdä%d×55Td%57s´d$äT—5UTd%UGD%Tã%$7……TdÄÄs5TgE—„¥Td¤ÄS%SuTdF$T×5•Td%G—†¥Tf¤ÄWD%W76%T¤%s4óÄ%“”Dód%%TW5cd%G§DeTåTód%“uTS“$W4Ö´¤%·6T¤%vÄ4ód%$sTDÄVÄ%S4äT¤%SCt÷§D%3¤$ÄVÄ%S6¤%SG5ETd&uTd%7„etã%$7„¥Te„ÄS”%uSuTdFTT—5cd%G§D%Td$ÄUd%uTd%7„eUeÄfÄ%f·5UTd&#—5Sd&ÓuTg•¤ädód&3ä¤Ädä%W75Sd%W§D%Uf´Äed%S5•Td%•7‡Ed%W§D%TÓ—…eTdäÄ…d5Tc—‡Ed%W§D%Uc—…ETdÄÄs”5TgE—ƒ5d%W—‡…´d%d7…¥TS%—„¥Td¤ÄD$5TWu—„åTdäód%7tÄdä%W765T¤%s”4Ä†DETeDÄ„ä5TeTÄfÄ%F„4ÄVÄ%V·4Ö´¤%D¤4ÄS%SuTdDåU—5Sd%7—‡%´dE47ƒ5d%W—‡E´d%d7…¥Tä$ÄVÄ%V·6C¤%†D4Ädd%dSuTd%7„åTç5§D%Td$ÄS%SuTd%7„¥TätÄTä%TÓuTdE47…ETdÄÄvD5TfÄÄ†DETeDÄvÄ5TeTÄfÄ%†Ä4ÄVÄ%V·63¤%„ä4Ädd%dW5%Td%%7……Te„ÄTä%TÓuTdDã—5Sd%7—†¥Tf„Ä†DETeDÄud%e5uTd&ET—55Td%57‡e´d&#—5ETd%EGD%Tã%%7…ETdÄÄ…d5Tg¥—ƒ5d%W—ƒ5´d%d7…¥Tfå—„¥Td¤ÄD$5TWu—„åTdäód%“”tÄdä%W76Cä%w6Cä%d×6UTä%e5uTd&U55Td%57sEd$ôT×5ETd%EGD%T×¥'—…ETdÄÄD¤5TWu—ƒ5d%W—s´d%d7…¥Tge—„¥Td¤ÄD¤5TW•—„åTdäód%%†„„Ädä%W76#¤%w6Cä%d×65T¤%e5uTdE7„¥Td¤ÄD$5TWu—…%Te$ód%TW5ETdF4T×6#¤%s”4ód%TW5ETdF4T—6T¤%vÄ4ód%TW55TdF&´—5d%§D%Ud”Ädä%W76C¤%w6Cä%d×6UT¤%e5uTd&T×55Td%57sE´d$ôT—5UTd%U7„eTddÄfD%f75d%§D%Td$ÄUd%¦Dtód%TW5%Tde•7†…TS§D%Td$ód%5¤DÄfÄ%S53d%7—ƒ5´d&C—5cd%g§D%TÓU—…¥TdäÄWD%W76#¤%s”4ÄfD%f3uTd%7„¥TÓ§D%Td$ód%TW5%Tde•7…ETeDÄfD%D$dód%TSuTdDõU—5•Td%G—„åTdäÄWD%W76#¤%s”4Ädä%d×5Sd%W§D%Td$ÄVÄ%¤dTód%TSuTd%7„eUeÄvD5Tfå—†ÅTg…$GD%T×…%7…eTdäÄfÄ%f·53d%7—‡e´d&#—5£¤%vD4Ätd%tSuTdFTUW5UTd%57†…Tf„ÄS%SuTdF6´—5•Td%G§D%Td$ÄVÄ%uTde7……Teód%TW5%TdEdGD%Td$ÄUd%%tW65T¤%„d4Äud%…d4ÄvD5Tg¥$GD%Td$ód%¦D„ÄfÄ%S53d%7—‡…d&5T×65T¤%„d4Äud%uW5“d%—§D%Tç5'—…¥TdäÄWD%W76#¤%s”4Ä„d5Tg…—†ÅTfÄÄtä%tÓuTd%7„¥TçU&§D%Td$ód%TW5%Tde•7…eTedÄS%D¤4ód%TSuTdFU5uTd%E7„ÅTdÄÄfD%f75eTd%e7„¥Td¤ód%4$DÄfÄ%S53d%7—†ÅTfÄÄed%eW55Td%5GD%TãE—…¥TdäÄWD%W76T¤%vÄ4Äed%eW55Td%5GD%T×…—…¥TdäÄWD%W75•Td%•7…eTedÄVÄ%V³uTdFDT×5uTd%E7„ÅTdÄÄwD5Tg%—…eTedÄVÄ%V³uTdDÓ×5uTd%E7„ÅTdÄÄvÄ5Tg—…eTedÄVÄ%V³uTdDÕT×5uTd%E7„ÅTdÄÄ„d5Tg…—…eTedÄVÄ%V³uTdDõT×5uTd%E7„ÅTdÄÄs”5Tge—…eTedÄVÄ%V³uTddã×5uTd%E7…TeÄWD%W75Sd%W§D%T×¥—…¥TdäÄfD%f753d%7—…ETeDód%53”4Äed%V·5UTd%U7…eTedód%4$4Ätä%S5ETd%E7„¥Td¤ÄVÄ%V³uTd%7…eTç5—…TeÄWD%W3uTd%7…eTæÄs5TgE—„ÅTdÄÄdä%dÓuTd%7…eTç—†…Tf„ÄWD%W75Sd%W§D%Td$Äed%¤ä4ód%TW5eTdE7…%Te$ÄWD%W75Sd%W§D%Td$Äed%5$4ód%TW5eTdE7……Te„ÄWD%W75Sd%W§D%Td$Äed%74Äs5TgE—„ÅTdÄÄdä%dÓuTd%7…eTç—ƒ´d&ET—53d%7—…ETeDód%TW5UTdFF´×5d%§D%UdTÄtd%W75Sd%W—„åTdäód%TW5ETdFDT“uTd%7„¥Tätód%TSuTdE&§3tódDÓ„$ÄfÄ%fÄÄÄtd%f3uTdæF´—5Sd%W—†¥Tf¤ÄS”%„dDód%¤dTÄdd%S5Sd%W—‡e´d%57„¥Tfå§D%UgU—…%TdäÄdä%d×5d%—…%Te$ód%5$4Ädd%V·5d%%7„¥Te¤Ädd%dSuTdFTT“uTd%7„¥Tätód%%TW5eTd%E7…Teód%$—5cd%G—„¥Td¤ÄVÄ%V³uTd%7„eTç—„ETdDód%%U5Sd%G§D%TåTód%%TW5Sd%W—†…TåÄs”5Tä$ÄS”%W63¤%¤$Tód%%DdTÄS%V·5ETd%E7…ETeDÄVD%V3uTdF4T—5eTd%E7…TeÄS%S5Cd%G—„eTddÄWD%W75%Td%%GD%TçU—…%Td¤ÄWD%W75cd%g—„…TdÄód%5¤4Ätd%S‡6%T¤%s4ÄWD%W753d%7§D%Td$ÄVÄ%5$Dód%TW5%TdE&§D%Ud$Ädd%S5cd%g—„¥Td¤Ätd%tW6%T¤%s4ÄTä%T×5%Td%%7…%Te$ÄTä%TÓuTdFµW5ETd%57…¥Te¤ód%%v„4ÄS%V·63¤%„ä4ód%6„4ÄvD5Te¤ód%TW5%TdE¤7…Teód%w5¥Td%g—…%Te$ÄS”%SƒuTdFTT—6%T¤%tW53d%7§D%Td$ÄVÄ%4$4ód%TW5%TdE&§D%Ud$Ätd%f75UTd%U7…Teód%6„4Äed%S5ETd%E7‡E´d&%T—53d%7—„ÅTdÄód%7DÄed%S5Sd%W—„ÅTdÄÄdä%dÓuTddã—5•Td%W—„¥Td¤ÄVD%V755Td%57„¥Td¤ÄS”%S‡53d%7§D%Tç5—†ÅTeDÄVÄ%V·55Td%57„ETdDÄWD%W755Td%57„ÅTdÄÄTä%T×55Td%5GD%Tç•—†ÅTeDÄVÄ%V·55Td%57„ETdDÄWD%W755Td%57„ÅTdÄÄTä%T×55Td%5GD%Tç•—†ÅTeDÄVÄ%V·55Td%57„ETdDÄWD%W755Td%57„ÅTdÄÄTä%T×55Td%5GD%Td$ÄVÄ%5¤Dód%TW5%TdE&§D%Ud$Ädd%S5¥Td%¥7„¥TedÄ†D5Tfå—…eTedÄTä%TÓuTdDÕU5Sd%G§D%TåTód%“‡5Sd%W—†¥Tf¤ÄWD%s”4ód&TUg5$GD%†Äe%7…%TdäÄdä%d×5“d%——„¥Td¤ÄWD%W3uTd†DT×5UTd%E7ƒ5´d&C—6#¤%V·55Td%£ÓuTdf$UW5UTd%E7‡´d%£—5Sd%57‡¥´d%6—‡E´d&ET“uTdDã×5ETd%57‡´d&T—5ETd%EGD%Tãe—†ÅTe„ÄTä%T×5£¤%vD4Äed%eW53d%7—…TeÄdd%dW5•Td%•7„…Td„ód%6„dÄfÄ%S6%T¤%s4Äs”5Td¤ÄVÄ%wDDód%“”TÄvÄ5Te„Ädd%dW5cd%g—…Teód%#TDÄfÄ%V·5£¤%vD4ÄF„5TSE§D%Tæõ$7†¥Td¤ÄWD%W75cd%g—„…TdÄód%5¤4Ä…d5Te„Ädd%dW53d%7—…¥Te¤ód%'„DÄwD5Td¤ÄvÄ5Tg—‡¥´d&3—55Td%57„¥Td¤ód%#TTÄwD5Td¤ÄwD5Tg%—„åTdäód%¤d4ÄvÄETg—‡e´d%57„¥Td¤ód%74Ä„äETg¥—„¥Td¤ÄS%S5“d%—§D%Td$Ätä%&„Tód%%TW6¤%V·5eTd%e7†ÅTfÄÄVÄ%V·5“d%—§D%T×e—‡%´d%57……Te„ÄS%SuTdF&´—4ÔT¤%eW6#¤%V·55Td%5GD%Tç5—w%´d%¥7„¥Td¤ÄvD5Tfå—…Teód%TW5“dDåTÓuTde7‡¥´d%U7„¥Td¤ÄVÄ%V³uTd%7…¥Tç5§D%Td$Äed%“uTdE7w•´d&T—55Td%57„¥Td¤ód%TW5UTdDÓ“uTd%7„åTätód%%TW6T¤%f75UTd%U7‡%´d&“uTdF&´×6%T¤%f75cd%g—„¥Td¤ód%TW5ETdDåT“uTd%7„¥Tätód%TW5%TdE&§D%VD$Ätd%f75UTd%U7…%Te$ód%74Äed%S6T¤%vÄ4Ä„ä5Tg¥—„¥Td¤ÄVÄ%V³uTdF6µ5UTd%57‡%´d&—5ETd%EGD%T×…§D%Td$ÄVÄ%“uTd…7…eTdäÄD$5TWu—„ÅTdÄÄdä%dÓuTdDõT×5Sd%7—…ETeDÄwD5Tg%—„ETdDód%%wDÄed%S5cd%g—„ÅTdÄÄdä%d×5ETd%EGD%Tç•—…ETdÄÄfD%f3uTdFT—5eTd%E7ƒ´d&ET—5Sd%W§D%Uc—…eTdäÄfÄ%f·6C¤%†D4ÄfÄ%f³uTdFDU5eTd%E7…¥Te¤Ä†D5Tc5—…eTedód%%„$TÄed%S6¤%wDTÄTä%TÓuTdFVµ5eTd%E7ƒ5´d$Öµ5d%§D%Tç5%7…eTdäÄ†D5TW•$7„ETdDód%%w„dÄdd%V·5•Td%•7……Te„ód%¤d4Äed%V·5cd%g§D%Tæ”Ä†D5Tfå—……Te„ÄTä%TÓuTd%7„åTÓU§D%Tä$Äed%V·5cd%g§D%Tæ”Ä†D5Tfå—…ETeDÄTä%TÓuTd%7„åTÓ§D%Ud$Äed%V·55Td%5GD%Tå4ÄvÄ5Te„ÄTä%T×5ETd%E7…TeÄWD%W75£¤%vD4ód%¥dDÄfÄ%V·5cd%g§D%Tæ”ÄD$5Tfå—…ETedÄTä%T×55Td%57†…Tf„Ä†D5Tc5—…eTe„Ädä%d×6#¤%s”4ód%TW5UTdDõV3uTdE7…¥Td¤ÄfD%f3uTdE–—wu´d%£—5Cd%U7„ETdDÄVÄ%V·5•Td%•7ƒ5´d&C—5UTd%W—…ETeDÄs”5Tge§D%Td$Ädd%¤d„ód%%TW6EU$%vD4ÄS%SuTd%7…eTçu—„¥Td¤ÄE¤5TS%§D%Td$ÄfÄ%“”4ÄS”%SƒuTd%7…¥TåÄdd%dSuTd%7…¥Tå4ÄfÄ%f·5d%—„¥Td¤ód%TW5eTdF&´—5d%§D%Td$ód%#w4ôT¤%„ä4ÄVÄ%V·55Td%5GD%TÓU—sE´d&3—53d%7—„ETd„ód%%FÄ4ód%TW5ETdE&§D%Td$ÄVÄ%“uTde7†…TeDÄwD5Tg%§D%T×¥—…ETdÄÄ†D5Tc5§D%TÓ5—…ETdÄÄ†D5Tc5§D%Td$ÄUd%“”4ód%“t÷§D%7Å7…¥Te¥—†…Te„÷§3uTä&F´—5uTd%uT×5•Td%g§D%dæõ—…ETeDÄE$5Tæ´ÄfD%W5CdE7……Tå$ód%—5ETd%7—…eTg%—†¥Tf¤ód%#TDÄfD%dW5eTd&—5•Td%•7…TeÄdä%dÓuTd%7„eTãe$7…Teód%%Ww5UTd%57…%Te$Äed%eW5ETd%E7…%Te$Äed%eW5cd%g—…ETeDód%'„dÄdd%V·5eTd%e7…¥Te¤ód%6„4Ätä%t×6¤%eW5uTd%u7…TeÄed%eW53d%uGD%Td$ÄVÄ%#Tdód%W5cd%G§D%Td$ÄUd%uTdE&§3tódFTT¤$ÄfÄ%fÄDÄtd%f3uTeFT—5Sd%W—s´dE¤7……Tä$ÄS”%W5cdE7…Tääód%G5ETd%7—…eTg%—†¥Tf¤ód%#TDÄVÄ%T×5eTd&—5•Td%•7…TeÄfD%f753d%7§D%Td$ÄUd%7TÄS”%SƒuTdeD7…%Td¤Äed%eW5uTd%uGD%TãE—†¥Tf¤ÄwD5TedÄed%eW5Cd%G—…eTedÄWD%f³uTd%7„¥Tç%GD%Tä$Ätä%eW5ETd%E7…%Te$Äed%eW5cd%g—…ETeDÄVÄ%V³uTd%7„eTÓ$GD%Tät÷§3uU¦G—…ETeDÄvÄ5Tg—„åTS§D%fó5$GD%tddÄdd%S5£¤%vD4Ä„d5Tg…—„¥Td¤ód%'“”DÄdd%S5•Td%•7‡e´d%57„¥TWu§D%Tç$7†…Te„Ädd%dW5¥Td%¥GD%VFõ—…%Td¤ÄfD%f755Td%57„ÅTdÄÄdd%dW5#d%'§D%Tç—……TdÄÄfD%f74Ö´¤%D¤4ÄWD%W75UTd%UGD%Td$ÄVÄ%¤dTód%%TW5¥Td%g—„¥Td¤ÄWD%W75UTd%UGD%Td$ÄUd%¦Ä4ód%5TW5UTd%E7w•´d$Ö´—6#¤%V·55Td†&´ÓuTde&—†…Te„ÄfÄ%f·5uTd%uGD%Tç—…eTdäÄvD5Tfå—…ETeDÄtd%tW5cd%g§D%Tã%$7…eTdäÄvD5TfÄÄF„5TcU—„¥Td¤Ätd%tW5ETd$ÕT×5uTd$³×6#¤%V·55Td%5GD%TÓ%7s%´d&UT—55Td%57†ÅTfÄÄfÄ%f³uTdfTU5eTd%E7‡´d&T—5Sd%W—†…Tf„ÄfÄ%f³uTdFVµ5eTd%E7‡´d&T—5£¤%vD4Äud%uW5“d%—§D%Tçu%7‡´d%•7„¥Td¤ÄvD5Tfå—†¥Tf¤ód%TW5%TdFµuTd…7…%TdäÄ†D5Tc5—‡e´d%57„¥Tc$GD%Tãe&—†…Te„Ädd%dW5¥Td%¥GD%Tæõ—…eTdäÄvÄ5Tg—†¥Tf¤ÄS%S6C¤%†D4ód%#TdÄD$5Tg¥—„¥Td¤ÄS%S5“d%—§D%Td$ÄUd%&„Tód%#W5UTd%E7…ETW%&—„ETdDód%5$„Ätd%f75d%—„åTdäÄtä%t×53d%7—ƒ´d&ET“uTdDÕU5UTd%57‡¥´d&3“uTdDÕT—5¥Td%g—†…Tf„Ädd%dSuTddõT—5uTd%E7†¥Tf¤ÄD$5TWu—†å´d%£—5eTd%e7†¥Tf¤ód%#5$tÄed%V·5•Td%•GD%TæÔÄF„5Tg¥§D%Tã—‡%´d%e7…TeÄVÄ%V·55Td%5GD%VCe—‡E´d%g—„ETdDÄS%S5cd%g—„ÅTdÄÄvD5Tfå§D%Tæõ$7‡e´d%e7†ÅTfÄÄVÄ%V·5ETd%E7……Te„ód%TW5UTdFUuTdeGD%Td$ÄS%“uTd%7„¥Tätód%#W5UTd%57„ETdDÄ„d5Tg…§D%TãE—†…TeÄWD%W75%Td%%7†å´d%£—5UTd%U7‡e´d%57„¥Td¤ÄTä%T×55Td%57„ETdDÄUd%UW5d%§D%Td$ÄVÄ%7Tód%TW5%TdE&§D%dd$Ädd%S5UTd%U7‡e´d%57„¥Tg¥%GD%TãE&—…%TdäÄ„ä5Tg¥—„¥Td¤Ä„ä5Tfå&§D%Tæõ47…%TdäÄ„d5Tg…—„¥Td¤Ä„ä5Tg¥§D%Tç•%7…%TdäÄvÄ5Tg—„¥Td¤Ä„ä5Tg%§D%US5$7†…Te„Ädä%d×5UTd%UGD%T×…—…eTdäÄUd%UW5£¤%vD4ÄS”%S‡55Td%5GD%VGU—…eTdäÄfD%f75ETd%E7„ÅTdÄÄud%uW53d%7—„ETdDód%'TÄed%S6¤%wD4ÄS%S53d%7—†ÅTfÄÄS”%S‡5d%§D%T×…$7…eTdäÄtä%t×55Td%e7‡´d%W—…eTedÄud%uSuTdFUW5eTd%E7†¥Tf¤Äs5TgE—…¥Te¤ÄfD%f3uTd„õU5¥Td%g—…%Te$Ädd%dSuTdFV´—5uTd%E7†å´d%£—53d%7—…ETeDÄtd%tW5cd%g§D%TÓ$7…¥TdäÄud%uW6#¤%s”4ÄfÄ%f·5•Td%•GD%Ug5%7…¥TdäÄdd%dW53d%7—…ETeDód%¥d4ÄfÄ%S5cd%g—„åTdäÄVÄ%V·5d%—…ETeDÄud%uW5uTd%u7„¥Td¤ÄTä%T×5%Td%%7„ÅTdÄÄVD%V3uTd„ÃW5uTd%E7„åTdäÄVD%V75uTd%u7„¥Td¤ÄfD%f755Td%57…%Te$ód%5$TÄed%V·6%T¤%s4ÄS%S55Td%57„…Td„ód%#4$DÄed%V·6#¤%s”4ÄS%SuTdDåT—4Ö´¤%s4Ätä%t×5ETd%EGD%Tã%—†åd&C—6¤%wD4ÄS”%S‡5UTd%UGD%Tãe$7†¥TdäÄVÄ%V·53d%7—†å´d%£“uTd%7„åTç§D%Ud$ÄfD%W75Sd%W—†…Tf„Ätd%tW5£¤%vD4ód%TW55TdDÕUuTd…7†ÅTe„Ädd%dW5UTd%UGD%Tãe—……TdÄÄWD%W75•Td%•7„¥TedÄvD5Te$ÄTä%TÓuTd%7„¥TÓ§D%Td$ÄUd%“uTdE&§D%WD$Ädä%d×65T¤%„d4ÄS”%7DDód%¤ädÄdd%S5£¤%vD4Äs”5Td¤ÄVÄ%…d4ód%%wTÄdd%S5Sd%W—„ETdDÄdd%dSuTdFDT—5UTd%57„ETddÄVÄ%f·5¥Td%¥GD%T×e§D%Td$ÄVÄ%“uTde7…eTdäÄtä%tÓuTdF4T—6¤%t×55Td%57……Te„ód%TW5%TdDÃ—5d%§D%UdTÄdä%SƒuTdEdGD%dd$Ädä%d×5£¤%5¥TdE7†å´dE•GD%Tæ”Ädd%S5“d%——‡e´d%57„¥Te¤ód%%„$DÄfD%d×55Td%57„…Td„ÄVÄ%V·5“d%——…TeÄWD%W3uTdDåT×5•Td%W—„¥Td¤ÄVD%V755Td%57†¥Tf¤Äed%eW53d%7§D%T×e—…¥TdäÄdd%dW4äT¤%E$4Äud%uW5#d%'—„ETdDód%¦DTÄfÄ%S5Sd%W—s´d$äT—5£¤%vD4ÄVD%V75d%§D%UWe$7…eTd¤ÄfD%f75#d%'§D%Tæõ—‡e´d%u7„¥Td¤ÄWD%W3uTd%7„åTã%§D%Td$ÄVÄ%“uTd%7„eTätód%%TW5Sd%G§D%TåTód%UTW5Sd%W—†¥TåÄS%W4ÔT¤%5vDDód%&„DÄdd%S6T¤%vÄ4Äs”5Td¤ÄVÄ%7D4ód%%DdTÄdd%S5cd%g—„ÅTdÄód%%…$4Ädd%S5cd%g—„ÅTdÄód%5$4Ädd%S5£¤%vD4Ädä%d×5•Td%•7……Te„ód%5¤TÄdd%S6T¤%vÄ4Ädä%d×5•Td%•7…¥Te¤ód%7TÄdd%S5¥Td%¥7ƒU´d&UT—55Td%57†…Tf„ód%“”TÄdd%S6T¤%vÄ4ÄE¤ETf¤ÄVÄ%V³uTdfV´×5ETd%57„ETdDÄvD5Tfå§D%TçU—…eTdäÄVÄ%V³uTd%7„åTå4ód%TW55TdE&§D%Td$ÄUd%“uTde7†…Te„Ädä%d×5£¤%vD4ód%'„DÄs5TfÄÄVÄ%V·5Sd%W—„åTdäÄWD%W75#d%'—…ETeDÄtd%tW53d%7—„ETdDód%TW5%TdFTUSuTde7…ETeód%uTe%7…ETeDÄD$5TåÄdä%W5cdEW§D%TåTÄtd%f75d%—„åTdäÄfD%f753d%7—…%Te$Ädd%dW5#d%'§D%UgU$7…eTdäÄ…d5Tc—…eTedÄVÄ%V·55Td%5GD%T×e—…%Td¤Ä†D5Tc5—„åTdäód%&„DÄed%V·5d%—†…Tf„Ätd%tW6#¤%s”4ÄVD%V3uTdF4U5¥Td%G§D%Td$ÄS%uTd%7„¥Tätód%TW5%TdE&§D%Ud$Ädä%SƒuTdEdGD%dä$Ädä%d×6C¤%5cdE7…eTä$Äed%uTdeF—…%TdäÄwD5Tg%—‡e´d%57„¥Tc5§D%Tçu$7†…Te„Ädd%dW5eTd%eGD%T×¥—‡e´d%£—55Td%57„åTdäÄvD5Tfå—„¥Td¤ód%TW5%TdFUuTd…7…%TdäÄfD%f76#¤%V·55Td&#“uTdFV´×5•Td%g—„ETdDÄVD%V755Td%57„ÅTdÄÄdä%d×5UTd%U7„…Td„ód%¤dDÄed%S5cd%g—†å´d%£—55Td%57„¥Td¤ód%7DÄtd%d×55Td%57…eTedÄTä%TÓuTd%7„eT×…§D%VD$ÄfD%d×55Td%57„…Td„ÄVÄ%V·5eTd%e7…TeÄWD%W3uTdFTT×5•Td%W—„¥Td¤ÄVD%V755Td%57…eTedÄed%eW53d%7§D%T×¥—…¥TdäÄfD%f74äT¤%E$4ÄfD%f75#d%'—„ETdDód%¥dTÄfÄ%S5cd%g—…ETeDÄVÄ%V·5UTd%UGD%Tã—‡%d$äT—5cd%g—„…Td„ÄVD%V75UTd%UGD%Td$ÄVÄ%5¤Tód%TW5%TdE&§D%Ud$ÄfÄ%eW5“d%—§D%T×…§D%VD$Ädä%d×5•Td%•7„…Tg%—„…Tg%—……Tge§D%TÓ%7†¥Te¤Ätd%tSuTdFV´—5ETd%57„eTddÄdä%d×5eTd%e7„eTddÄdä%d×5UTd%UGD%T×…—……Teód%TW5%TdEdGD%Ud$ÄfD%d×55Td%57„…Td„ÄWD%W75%Td%%7…ETeDÄdd%dW55Td%57„¥Td¤ÄWD%W3uTdF&µ5eTd%E7…%Te$ÄWD%W755Td%57„eTddÄdä%d×5d%—„¥Td¤ÄUd%UW5Sd%W—„ETdDÄTä%TÓuTdF4U5UTd%57…%Te$ÄfD%f3uTdF6´—5•Td%G§D%Td$ÄVÄ%uTd%7„eTätód%%TW5Sd%G§D%TåTód%%TW55Td%E7ƒ5´d%F—„åTW%§D%Td$ÄUd%3”4ód%W5Sd%U7‡%´d&—6#¤%V·55Td%¥GD%TÓ5—…ETe$Ädä%dÓuTd%GD%Td$ÄUd%%e—55Td%57„ÅTS§D%Tç•—……TeÄWD%W75£¤%vD4ÄVÄ%V·5#d%'§D%Td$ÄUd%4¤Dód%TW5%TdeG—…¥Te¤ÄWD%vD4ód%'DÄdd%V·5UTd%U7„ÅTdÄÄvD5Tfå—„¥Td¤ÄVD%V3uTdFTT×5UTd%57…ETeDÄS%SuTdF´—5“d%U7„ÅTdÄód%$—5cd%7—†å´d%£—55Td%57„ÅTdÄÄWD%W3uTdF&´×5cd%7§D%Td$ÄVÄ%uTde7……Teód%TW5%TdEdGD%Tätód%SW5Sd%W—w•´d$Ö´—5eTd&3uTcEdDdtód&Ue$dÄdd%S5UTd%U7„¥TedÄ…d5TfÄód%%…¤DÄdd%S5Cd%G—…ETeDód%%…$4Ädd%S5Sd%W—…ETeDÄWD%W3uTddã—5•Td%g—„ETdDÄS%S5Sd%W—„ÅTdÄÄS”%S‡5UTd%U7…ETeDÄed%eW5#d%'§D%TçU%7…eTdäÄtd%tW5ETd%E7…ETeDód%TW5%TdF4TÓuTde7†…Te„ÄTä%T×53d%7—†ÅTfÄÄWD%W75Cd%G—…%Te$Ädä%d×5¥Td%¥7„…Td„ód%¦DdÄed%S5£¤%vD4ód%5$4Äed%S5£¤%vD4Ätd%tW55Td%57†å´d%£—5Cd%G§D%Td$ÄUd%&„dód%W5UTd%E7ƒ´d&ET—5Sd%W§D%Uc—…%TdäÄdä%d×5d%§D%Tæõ—†…Te„Ädä%d×5Sd%W—…%Te$ód%#TDÄed%S5Sd%W—„åTdäÄS”%S‡5ETd%E7…TeÄS%S5•Td%•GD%Td$ÄUd%¦ÄTód%%TW5UTd%E7‡%´d&T—6#¤%d×6%T¤%e6%T¤%†Ä4ÄfÄ%‡4ÄfÄ%s”Dód%¤äTÄdd%S5¥Td%——‡e´d%W—†å´d%d7‡E´d&3—5uTd&DT—5uTd&TÓuTdf6µ5UTd%E7…eTedÄdd%dW5Sd%W—…eTedód%¤äDÄdd%S5eTd%e7…%Te$Ädä%d×5eTd%eGD%UW¥—…%TdäÄfD%f75Sd%W§D%UW…—…ETeód%t÷§D%##Uu7…ETeDÄvD5Tfå—…eTfå§D%Tã%$7…ETeÄS”%S‡5UTd%U7„eTddÄdd%dW5d%—…eTedód%7DÄdd%V·4³¤%S‡5cd%g§D%Tçu—…¥TdäÄed%eSuTdFT—5“d%U7…%Te$ód%TW55TdF$T“uTd%7„eTätÄTä%TÓuTde$7„åTdÄÄdä%vÄ4ÄwD5Tg%§D%Tã—…eTdäÄfD%†DTÄdä%vÄ4ód%“”dÄdd%V·5eTd%eGD%TæÄtd%S‡5Cd%G—…%Te$ÄUd%UW5UTd%U7„ETdDÄfÄ%f³uTdDÓ×5“d%E7…%Te$Ädd%dSuTdFDT—5uTd%57w%´d%G—……Te„ód%4$4ÄvD5TdäÄed%eSuTdFT—6¤%dW5UTd%UGD%Td$Ädd%'„4ód%TW5ETdE&—„ETdDód%TW55TdE4GD%Td$ÄUd%“uTde7……TeDÄdd%dSuTdF&´“uTde7…ETeDÄdd%dW5eTd%£ÓuTdDÃ×5UTd%E7……TSE—…ETg§D%Tç•%7„åTd¤Äed%eSuTdEv—†…TeDÄdd%dSuTd%7„eTçU§D%Ud$Ädd%S5cd&C×5Sd&T“uTdDÃ5ETd%57…eTedód%÷5•Td%W—…%Te$ód%TW5%TdF&´“uTde7…%TdäÄfD%D¤TÄdä%vÄ4ód%'„tÄS%V·5eTd%eGD%TæÄdd%V·5ETd%E7…%Te$Ädd%dW5#d%'§D%T×¥—†ÅTeDÄdd%dW5d%×5“d$æ´—5£¤%vD57…ETe$ÄTä%TÓuTd%7„¥T×…%7……Te„Äed%eSuTdF&´—63¤%vD4Ädd%dSuTd%7„¥T×…§D%Td$ÄUd%“uTdE&§D%UeÄdä%d×5uTd%u7…eTfå§D%T×…$7……TeDÄdä%d×5Cd%G§D%T×¥§3tódF&µ$$ÄfÄ%fÄDÄtd%f3uTgÖ„4Ädä%d×6C¤%%5ETdE7…Etdäód&Tå4ód&TädÄed%dSuTd%7„¥Täôód%TW5%TdE&§D%Ud$Ädd%S4ôT¤%E¤4Ä†DETeDÄ7D5TeTÄfÄ%…dDód%'¤ddÄdd%S5£¤%„dDÄTä%TÓuTddåT×5Cd%7—…ETeDÄTä%T×5UTd%UGD%Tç•—…%Td¤ÄVÄ%V·5Sd%W—†ÅTfÄód%¦Ä4ód%TW55TdE&§D%Ud$ÄwD5Tf¤ÄWD%W75#d&C“uTd%7„eTÓ5—„ETdDód%5U5UTd%E7s%´d…&—‡e´d%57„¥Td¤ód%#÷5ETd%57……Te„ód%#%—5•Td%g—…%Te$Äud%uSuTdFT×5eTd%E7……Te„ÄWD%W3uTdFDT—5eTd%E7…¥Te¤Ädä%d×5•Td%•7……Te„ód%%sTTÄdd%V·4Ö´¤%D¤4ÄVÄ%V·5Sd%W—„…Td„ód%¦DDód%TW55TdE&§D%Ud$Äed%S5cd%g—‡e´d%57„¥Tge§D%Tãe—…eTdäÄfD%f76#¤%V·55Td&#“uTd†V´×5•Td%W—„¥Td¤ÄVD%V755Td%57…eTedÄS”%S‡53d%7§D%TãE—†ÅTeDÄVÄ%V·5#d%'—„¥Td¤Äed%eW5eTd%e7„ÅTdÄód%¤äDÄtä%S5cd%g—s´d$äT—5cd%g—„…Td„ÄTä%TÓuTdDåU5uTd%57……Te„Ädä%d×55Td%57…%Te$ód%#4$DÄfÄ%V·5uTd%u7„åTdäód%4$4Ä„d5Te„Ädä%dÓuTdF4T—6%T¤%d×55Td%57…eTedÄdd%dSuTdDÃ—6%T¤%d×55Td%57…eTedÄdd%dSuTd%7…%Tç§D%Ud$Äs”ETS—……Te„ÄVD%V75#d%'—…%Te$ód%TW5ETdFFµuTd%7„¥Tätód%#W5“d%e7†¥Tf¤ód%#6„4Ä7D5TW•—„¥Td¤ÄfD%f75UTd%UGD%VG5$7†ÅTe„ÄWD%W755Td%57…eTedÄdä%d×55Td%5GD%Td$ÄUd%¦DDód%#W5•Td%g—…%Te$Äud%uSuTdFT×5eTd%E7……Te„ÄWD%W3uTdFDT—5eTd%E7…¥Te¤Ädä%d×5•Td%•7……Te„ód%#TTÄed%S5cd%g—w•´d$Ö´—55Td%57…ETeDód%%‡TÄed%S5UTd&3—5d%§D%TÓ5—…eTdäÄud%vDDÄTä%TÓuTd†F´×5eTd%E7…ETeDÄE¤5TS%—……Te„Ädä%dÓuTdfUW5•Td%W—……Te„ÄVD%V75cd%g—…%Te$ÄfÄ%f³uTdF4U5uTd%E7…¥Te„Ätä%d×55Td%57…%Te$ÄS%„¤4ÄfÄ%D$4ód%%DäDÄfÄ%S53d%7—„ÅTdÄÄdä%d×5ETd%E7…%Te$ÄTä%TÓuTdFTT×6%T¤%tW53d%7—„ÅTdÄÄdä%d×5•Td%•7…%Te$ÄTä%TÓuTd%7„¥TãE$GD%Ud$Äed%S5cd%g—„¥TedÄvÄ5TeDÄS”%S‡5uTd%uGD%Tã%$7…ETdÄÄWD%W75eTd%e7„¥TedÄvD5Te$ÄTä%TÓuTd%7„eVCe§D%Tät÷§3uT×¥4TW5uTd%uT×5•Td%g§D%Tã%—…ETeDÄs5Td%—ƒ5´d&ET“uTe&T×5Sd%W—‡%´dET7…¥Tä$Äud%3SuTde7…%TdäÄtä%t×5cd%g—…ETeDód%6„DÄdd%S5¥Td%¥7„¥Td¤ÄS%S5cd%g§D%T×…—„åTd¤Äud%uSuTdf&´—5UTd%E7‡…´d&5T—5“d%—§D%Tãe—……TeDÄVÄ%V·5#d%'—„¥Td¤Äs5TgE—…%Te$ÄWD%W3uTdF$U5eTd%E7…%Te$Äs5TgE—„ETdDód%'„DÄdd%V·5d%—†…Tf„ÄWD%W75#d%'§D%TãE—‡E´d%•7„ÅTdÄÄVÄ%V³uTdFDT“uTd%7„¥Tätód%TW5%TdE&§D%Ud$Ädä%S‡5%Td%%7†¥Tf¤Ätd%tW5•Td%•GD%TçU$GD%S”$Ädä%d×4³¤%7D4Ätä%#5$Dód%%TW5UTd%E7w•´d&5T×5d%§D%V3—…%TdäÄD¤5Tg…—„ETdDód%'¥dDÄS%V·5uTd%uGD%Tæõ—……TeDÄVÄ%V·5#d%'—„¥Td¤Ätd%tW5UTd%U7„ÅTdÄód%¥dDÄdd%V·5•Td%•7„ETdDÄVD%V3uTdF&´—5uTd%E7……Te„ód%'4Ä7D5TcU—„ETdDÄVÄ%V³uTdDõT—4³¤%†Ä4Ädd%dW55Td%5GD%Td$ÄVÄ%5¤Dód%TW5%TdE&§D%Ud$Ädä%S‡5%Td%%7wu´d$ÔT—6UT¤%†Ä4ód%¦ÄTód%CW5Sd%W—ƒ´d&ET—5UTd$ôT—5UTd&#ÓuTgU%w„„ód&5UddÄdä%S‡5Cd%G—…Teód%%„¤4Ädä%S‡6ET¤%…d4ÄS”%SƒuTdf6´×5Sd%G—…TeÄdd%dW5d%—…eTedód%“”4ÄfD%S‡5Sd%W—„åTdäÄS”%S‡5ETd%E7…TeÄS%S5•Td%•GD%Td$ÄUd%“”TÄTä%TÓuTde$7…ETeÄud%t×6¤%S‡5£¤%d6%T¤%s”4ÄfÄ%„$4ÄfÄ%7D4ód%4$TÄdä%S‡6¤%vÄ4ÄwD5TeÄs5TeÄs5Tc—…¥Tc%—…¥Tg%§D%UW…$7…ETeÄtd%tW5Cd%G—…eTedÄS”%S‡5Cd%G—…eTedÄWD%W3uTdf$UW5Sd%G—……Te„ÄS”%SƒuTdDÓ“uTe%7…ETeDÄ†Ä5TåÄtd%W5¥TdE7wu´dEEGD%TäôÄdd%S65T¤%„d4Ätä%tÓuTdFV´×5UTd%E7†å´d%£—55Td%7—‡E´d&%T—5uTd&#—6%T¤%s4ÄS%SuTddÓ—5cd%W—„¥Td¤ÄVD%V755Td%57‡E´d&%T—5UTd%U7„ÅTdÄód%'„TÄed%S5UTd%U7‡E´d&%T—5d%§D%Tç5—‡%´d%——„ETdDÄVÄ%V·6UT¤%†Ä4ÄWD%W3uTd%7„eTçU$GD%Ud$Ätä%f·5Sd%W—„¥Td¥7‡´d%£—5¥Td%¥7†¥Tf¤Äed%eW5“d%——…eTedÄTä%TÓuTdDÓ3uTeE7…ETeDÄs”5TåÄud%W4ÔT¤%W5UTdFCÓuTdfTT×5UTd%E7…¥Te¤Ätä%tÓuTdFT×5UTd%E7……Te„ÄVÄ%V·5eTd%e7ƒU´d&UT—5Sd%W—„åTdäód%%…¤dÄS%V·5uTd%uGD%Ufõ—……TeDÄVÄ%V·5#d%'—„¥Td¤Ä†Ä5TcU—…%Te$ÄWD%W3uTdFTU5eTd%E7†å´d%£—6UT¤%†Ä4ÄTä%TÓuTdFU5eTd%E7…eTedÄvD5Tfå§D%Tæõ—…eTdäÄed%eW55Td%5GD%Tçu—†…TeDÄVÄ%V·5#d%'—„¥Td¤Ädd%dW53d%7§D%T×e—…¥TdäÄVÄ%V·5“d%——…eTedÄTä%TÓuTdF&´×5¥Td%W—…eTedÄTä%T×55Td%5GD%TãE—‡%´d%u7†…Tf„ÄS%SuTd%7„¥Tç§D%Td$ÄUd%“uTde7…ETeÄTä%T×5eTd%e7…ETeDód%¦D4ód%uTW5Sd%W—w%´dET7…¥VÄ$ód$ÕWtód$Ö·dÄdd%S5£ä%vDDÄs”5Td¤ÄVÄ%†ÄTód%#T„Ädd%S4Ö´¤%D$TÄTä%TÓuTdfµW5•Td%g—„ETdDÄud%uW6T¤%vÄ4ÄWD%W75Cd%G—…%Te$Äed%eW5#d%'§D%T×¥%7…%TdÄÄwD5TWu—sE´d$ôT“uTdDÓ5uTd%E7ƒ´d&ET“uTdDã—5uTd%E7‡e´d&#—65T¤%„d4ód%“”DÄfÄ%S5Sd%U7‡Ed$ôT—55Td%57‡´d&T—5ETd&&µ5uTd&C5d%§D%Tã%%7‡ed$ôT—55Td%57‡E´d&%T—53d%7§D%T×…$7…¥TdäÄWD%W75d%—†ÅTfÄÄs”5Tge—„ETdDód%TW55TdF$U5Cd%G§D%TäÔÄfÄ%S5uTd%uGD%Tç5—w%´d&UT—53d%7—„ETdDÄud%uW5Sd%W—„ETdDód%TW55TdDÕUuTd%7„eTätód%%TW5Sd%G—„ETdDÄ7D5TW%—ƒ5´d&C“uTdFµSuTe%7…ETeDÄE¤5TåÄtd%W5uTdE7wu´dEEGD%UdôÄdd%S5d%—w%´d$³—6C¤%†D4ÄVÄ%V·4³¤%7D4Äed%eSuTd„Ó75•Td%g—„ETdDÄs5TgE—‡´d&T—53d%7—w%´d$³“uTdf$U—5eTd%E7‡d&T×6¤%wD4ód%7TÄed%S5%Td%%7…TeÄVÄ%V³uTdF&´—5eTd%E7„ETdDÄ„d5Tg…—„ETdDÄVÄ%V³uTd%7„åT×e§D%Td$ÄS%SuTd%7„åTä$ód%TW55TdE&§D%VD$Äed%S6ET¤%…d4ÄVÄ%eW4ÔT¤%wD4Ä„d5Tg…—„åTdäód%4$tÄ†Ä5Tg…—…ETeDÄwD5Tg%—„ÅTdÄód%#4¤TÄud%f75d%—†ÅTfÄÄvÄ5Tg—„ÅTdÄÄs5TgE§D%Tç5%7…¥TdäÄUd%UW5eTd%e7…%Te$ÄfD%f755Td%5GD%Tãe—…¥TdäÄud%uW55Td%e7‡Ed$Ö´—63¤%„ä4Äed%eW5UTd%U7…eTedód%¥d„ÄwD5Te¤Ätd%tW5¥Td%¥7…¥Te¤ód%TW55TdFDUuTd%7„eTätód%#W5•Td%g—„ETdDÄud%uW6T¤%vÄ4ÄWD%W74ÔT¤%D$4ód%%‡dÄed%S6UT¤%†Ä4ÄwD5Tg%§D%Tç$7…eTdäÄUd%UW5eTd%e7……Te„ÄVÄ%V³uTdF´×5eTd%E7„ETdDÄs5TgE—„ETdDÄVÄ%V·6#¤%s”4Ä†D5Tc5—wu´d$ÔT—5UTd%UGD%V35'—†å´d%u7†…Tf„Äud%uW55Td%5TW6T¤%vD4Äs5TgE—…eTedÄed%eW5d%§D%Td$ÄUd%5$„ód%“uTg´W5Sd%W—s´dET7‡´d¥GD%sU&§D%s•%7…%TdäÄvDETfå—‡e´d%57„¥Tg¥$GD%Tæõ'—…%TdäÄD¤5Tc$7„ETdDód%%FÄTÄtd%f75d%—„ÅTdÄÄed%eW53d%7—…TeÄdd%dW5¥Td%¥7„…Td„ód%“”TÄed%S5£¤%vD4ód%5$4Ätd%d×5Sd%W—„…Td„Ädä%d×5cd%g—…%Te$Äed%eSuTdFVµ5uTd%E7‡e´d&#—5cd%g—„åTdäód%%DäDÄed%W76¤%D$4ÄF„5TSE§D%T×¥$7†¥TdäÄ…d5Tc§D%TÓ5—†¥TdäÄs”5Tge—‡…´d&5T“uTdDÃ×5“d%E7…ETe$ÄsETSE—„¥Td¤ÄvÄ5Tg—„åTgU$7…¥Tc5$7„ETdDód%5¤dÄ„äETSE—„¥Td¤Äs5TgE—„ÅTdÄód%¤dTÄtä%S53d%7—„ETdDÄud%uW5UTd%U7‡e´d&#—5d%§D%Td$ÄS%¤dTÄS”%SƒuTdED7†¥TdäÄfÄ%f³uTdF$T—6Tä%†Ä4ÄWD%W75d%—†ÅTfÄÄdd%dW5Sd%W—„ETdDód%TW5ETdF$USuTd%7„¥Tätód%TW5%TdE&§D%Ud$Ädä%S‡5d%—w%´d$³—6C¤%†D4ód%'dód%SW5Sd%W—wu´dET7†…Tä$ÄvÄ5Tä$ÄD$5Tääód&FÄ¥4ód&Ud¤dÄS%V·6%T¤%s4ód%#5¤4Ädd%S5d%—w%´d$³—6C¤%†D4ÄVÄ%V·4äT¤%E$4Äud%uSuTddã75UTd%E7‡…´d$ôU5d%§D%VG•%7†…Te„ÄTä%T×6%T¤%s4ÄvÄ5Tg—„ÅTdÄÄ7D5TW%§D%Ug5&—…eTdäÄvÄETg—‡%´d&“uTdFVµ5eTd%E7„eTddÄS”%S‡55Td%5GD%TçU—…eTdäÄTä%T×65T¤%„d4Ädä%d×55Td%5GD%Td$ÄS%5¤Dód%TW5ETdEGD%Td$ÄS%SuTd%7„¥Tätód%W6ET¤%s4Äs”5Tge§D%VC%—…eTdäÄ…d5Tc—„¥TedÄD$5Tg%—‡…´d&5T—5ETd%EGD%Tçu&—ƒU´d&5T—5Sd%W—‡%´d&—53d%7§D%VG•$7†ÅTe„ÄTä%T×5¥Td%¥7…¥Te¤Ädä%d×53d%7—‡E´d&%T“uTdFDUW5uTd%E7„eTddÄed%eW5UTd%U7……Te„ÄVÄ%V³uTdFV´×5uTd%E7†ÅTfÄÄVÄ%eW6%Tä%D¤4Ä„ä5Tg¥—…eTedÄdd%dW5eTd%eGD%TÓ'—‡%#d&3×5d%§D%Tã%—ƒU´d&%T—5•Td%•7„eTddÄed%eW55Td%5GD%Td$ÄVÄ%'„Tód%TW5%TdE&§D%VD$Ätd%f75d%—†ÅTfÄÄfÄ%f·5Sd%W—„ÅTdÄÄD$5TWu§D%TÓ5%7…eTdäÄs”5Tge§D%T×…—…eTdäÄ†Ä5TcU—‡%´d&“uTdFµ5eTd%E7„eTddÄed%eW5cd%g—„¥Td¤ód%'DÄed%S5d%—‡E´d&%T—5Sd%W—„¥Td¤ód%TW5ETdF6´ÓuTd%7„åTä$ód%TW5ETdEGD%Td$ÄVÄ%“uTdE7ƒ´d&%T—6#¤%s”4ód%%…¤DÄvD…Tg¥—„ETdDód%5¤DÄ…d5TgE—†…Tf„ÄUd%UW5eTd%e7„¥Td¤ÄVÄ%VÄ$ÄvÄ5Tfå—‡E´d&%T—5eTd%e7…eTedód%TW5%TdDã3uTd…7†¥Te¤ÄwD5Tg%—‡E´d&%T—5d%—„¥Td¤ód%6„Tód%•S‡5Sd%W—wu´d$ÔT—5ETd$äT“uTdF4UW5UTd%E7†¥Tf¤Äs”5Td¤ÄVÄ%vDTód%#6„dÄS”%W75Sd%W—„ETdDÄdd%dSuTdF6´—5UTd%57„ETddÄVÄ%f·5UTd%UGD%TãE§D%Td$ÄVÄ%“uTde7…eTdäÄS”%SƒuTdE–—…eTdäÄfD%f753d%7§D%VC—…eTdäÄvD5Tfå—…ETeDód%“”4Ädd%V·6T¤%vÄ4ÄS%SuTdFV´“uTd%7„¥Tätód%#W5eTd%E7s´d$äT—5uTd%u7„¥Td¤Ädd%dSuTdDÕU5UTd%57s%´d$æ´—5ETd%EGD%Tç•—……TdÄÄfD%f3uTdFT“uTd%7„¥Tätód%#W5eTd%E7„eTddÄtä%t×5•Td%•7†…Tf„ÄVÄ%V·6¤%wD4Ädä%d×5uTd%u7†…Tf„ód%#6„„Ädd%V·6T¤%vÄ4Ätd%tSuTdFTÓuTd%7„¥Tätód%#W5eTd%E7„eTddÄD$5TWu—ƒU´d&UT—55Td%57w%´d$³—5uTd%uGD%V7…'—…eTdäÄtä%t×55Td%e7ƒ´d%¥GD%TÓ5—w•´d&ET—5eTd%e7……Te„ód%'¥dDÄvD5Te¤ÄVÄ%V·5eTd%e7……Te„ód%#4¤DÄE¤5TcU—†…Tf„Äud%uW6C¤%†D4ód%¦DdÄvÄETS%—†…Tf„Ädä%d×5uTd%u7ƒ5´d&C“uTdFFµ—4ôT¤%D$4Ätd%tW5Sd%W—‡´d&T—6C¤%†D4ód%#7tÄdä%W75cd%g§D%Td$ÄUd%'„4ÄTä%TÓuTde$7…%TdäÄWD%W75uTd%u7„ÅTdÄÄTä%T×5%Td%%7…%Te$ÄTä%T×65T¤%„d4ód%¤äTÄ„d5Tg—…%Te$ód%TW5%TdDÓ—5d%§D%Tä”÷§3uTãEuS‡5Sd%W—……Te„ÄWD%vD4ód%TDäDód%UUW5UTd%57…ETd¤Ädä%V÷6%T¤%eW6T¤%vD4ÄWD%W3uTdF´×5UTd%57„åTdäÄdä%d×55Td%57„ÅTdÄód%TW5%TdDõT“uTdE&§3tódE6³‡55Td%E7……TdôÄS%uSuTd%7„eTæÄtä%tÓuTd%7„eUc§D%ddtód%ttW5SdÅ'—†å´d%£“uTdÖ&´—5Sdå'—‡E´d&%T“uTdöDT—5Se'—†¥Tf¤ód%Tw4Ädä%UV74ÔT¤%D$4ód%V¦D4Ädä%S74äT¤%E$4ód%d3”4Ädä%eV75•Td%•G6”Äöt”4§U•sÆ7”“d”g6•dV…5%UV”Ä4•ƒ–†36ÇU—”—4”4¦efÄ¤å%†‡v6Õg¦3&Çf&³†Dug–tg5#—6#4¤6sV´–—vt–Ã•uV³fT„'•¥„ç¦s—UducFD…g•¥e'••sW¥¦Ó—–%T§&Õ”Ä4•ƒ$V”Ä4•ƒ¥5EUcF4„¦Æ34ç##TÖ#$fµ¥„¥$…fæsF”Ä4•ƒ$–”Ä4•ƒ¥5EU§6äãTug–3#—T–—vt–Ä%Sä¥·„eƒå%Tæefµe5SÅFÄÖ”Ä4•ƒ5—¥4—4”4¦f5…f†DTV”Ä4•ƒ5—¥”—4”4¦f5…f†DT–”Ä4•ƒ¥5EW‡f#'D&D4—4”4¥u%T×¥ƒ%SÅU5e¤eƒö”Ä4•ƒ%c$ug•4—4”4¥U4d¤e%4—4”4¦eƒ$g¦UsV¤–—vt–Ó##—Uƒ%&Å¦Ôc$…”Ä4•TS•ESÄ5DUfeS$e•u%d¥E5S”õW”—4”4¦eEe'f##Tå•…&Æ6ÖÆ†$W‡e•u&Æ6Ä'6EvG&”—4”4¦efÄ¤åEtc¥„§•w‡¥4U%5%s34çFÕdæEwƒ„'6ug•Ds–…¤ug•Twƒ£&ÇT–—vt–Ã–e•„ãV&ÔÖ”Ä4•dV…5%UV”Ä4•ƒ–†36ÇU—”—4”4¦e•4—4”4¦eƒ4çv6Õf…¤e¦†$…fÆ7”—4”4¥U4d¤e%4—4”4¦fF¤ä$–—vt–Ã“$Ó–”Ä4–5…f†DVÇVFÕg–DTçf%„&†D4—4”4¦fF¤äD–—vt–Ã—†Etc4—4”4¦f5…f†DT–”Ä4•ƒ4c•…$D–—vt–Ôçf&äã6Ôg&å”Ä4•TS•ESÄ5DUfeS$e•u%d¥E5S”õW”—4”4¦efÄ¤åFÓ–µ¥Tçf&äã6Ôg&å$Ö#$fµ¥„¥$…fæsF”Ä4•ƒ–†36ÇU—”—4”4¦e•4—4”4¥U4d¤e%4—4”4¦fF¤ä$–—vt–Ã“$Ó–”Ä4•ƒ#†DTV”Ä4–D„¦†FÕg–3%d&&ÔæÆ35'f6ääv6Ó—EVÓ—fD4—4”4¥CåE5T¤Õ%c•ETUdEƒ¤eVÄä¥CUD–—vt–Ã•uV³F4„§&ÖD6##VÅDs–…¤ug•Twƒ£&ÇT–—vt–Ã–e•„ãV&ÔÖ”Ä4•ƒ$V”Ä4•ƒ$–”Ä4•ƒ$Ö”Ä4•ƒ%”Ä4•ƒ%V”Ä4•dV…5%UV”Ä4•dV…5%UV”Ä4•dV…5%UV”Ä4•dV…5%UV”Ä4–%tc¥„§•wv”Ä4•dV…5%UV”Ä4•dV…5%UV”Ä4•åfÕ¦Õg•…#6ÖÆ–E…&Ä–Ã¶eóÐ 