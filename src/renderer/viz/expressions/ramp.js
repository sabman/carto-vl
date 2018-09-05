import BaseExpression from './base';
import { implicitCast, checkExpression, checkType, clamp, checkInstance, checkMaxArguments, mix } from './utils';

import { interpolateRGBAinCieLAB, sRGBToCielab } from '../colorspaces';
import NamedColor from './color/NamedColor';
import Buckets from './buckets';
import Property from './basic/property';
import Classifier from './classification/Classifier';
import ImageList from './ImageList';
import Linear from './linear';
import Top from './top';
import CIELabGLSL from './color/CIELab.glsl';
import CategoryIndex from './CategoryIndex';

const DEFAULT_OTHERS_NAME = 'CARTOVL_OTHERS';
const MAX_SAMPLES = 100;
const DEFAULT_SAMPLES = 10;

const DEFAULT_OPTIONS = {
    defaultOthers: DEFAULT_OTHERS_NAME,
    samples: DEFAULT_SAMPLES
};

const paletteTypes = {
    PALETTE: 'palette',
    COLOR_ARRAY: 'color-array',
    NUMBER_ARRAY: 'number-array',
    IMAGE_LIST: 'image-list'
};

const rampTypes = {
    COLOR: 'color',
    NUMBER: 'number'
};

const inputTypes = {
    NUMBER: 'number',
    CATEGORY: 'category'
};

const COLOR_ARRAY_LENGTH = 256;
const MAX_BYTE_VALUE = 255;

/**
* Create a ramp: a mapping between an input (a numeric or categorical expression) and an output (a color palette or a numeric palette, to create bubble maps)
*
* Categories to colors
* Categorical expressions can be used as the input for `ramp` in combination with color palettes. If the number of categories exceeds the number of available colors in the palette new colors will be generated by
* using CieLAB interpolation.
*
* Categories to numeric
* Categorical expression can be used as the input for `ramp` in combination with numeric palettes. If the number of input categories doesn't match the number of numbers in the numeric palette, linear interpolation will be used.
*
* Numeric expressions to colors
* Numeric expressions can be used as the input for `ramp` in combination with color palettes. Colors will be generated by using CieLAB interpolation.
*
* Numeric expressions to numeric
* Numeric expressions can be used as the input for `ramp` in combination with numeric palettes. Linear interpolation will be used to generate intermediate output values.
*
* @param {Number|Category} input - The input expression to give a color
* @param {Palette|Color[]|Number[]} palette - The color palette that is going to be used
* @return {Number|Color}
*
* @example <caption>Mapping categories to colors and numbers</caption>
* const s = carto.expressions;
* const viz = new carto.Viz({
*   width: s.ramp(s.buckets(s.prop('dn'), [20, 50, 120]), [1, 4, 8])
*   color: s.ramp(s.buckets(s.prop('dn'), [20, 50, 120]), s.palettes.PRISM)
* });
*
* @example <caption>Mapping categories to colors and numbers (String)</caption>
* const viz = new carto.Viz(`
*   width: ramp(buckets($dn, [20, 50, 120]), [1, 10,4])
*   color: ramp(buckets($dn, [20, 50, 120]), prism)
* `);
*
*
* @example <caption>Mapping numeric expressions to colors and numbers</caption>
* const s = carto.expressions;
* const viz = new carto.Viz({
*   width: s.ramp(s.linear(s.prop('dn'), 40, 100), [1, 8])
*   color: s.ramp(s.linear(s.prop('dn'), 40, 100), s.palettes.PRISM)
* });
*
* @example <caption>Mapping numeric expressions to colors and numbers (String)</caption>
* const viz = new carto.Viz(`
*   width: ramp(linear($dn, 40, 100), [1, 10,4])
*   color: ramp(linear($dn, 40, 100), prism)
* `);
*
* @memberof carto.expressions
* @name ramp
* @function
* @api
*/
export default class Ramp extends BaseExpression {
    constructor (input, palette) {
        checkMaxArguments(arguments, 2, 'ramp');

        input = implicitCast(input);
        palette = implicitCast(palette);

        checkExpression('ramp', 'input', 0, input);
<<<<<<< HEAD
        checkLooseType('ramp', 'input', 0, Object.values(inputTypes), input);
        checkLooseType('ramp', 'palette', 1, Object.values(paletteTypes), palette);

        if (palette.type === paletteTypes.IMAGE) {
            checkInstance('ramp', 'palette', 1, ImageList, palette);
            checkLooseType('ramp', 'input', 0, inputTypes.CATEGORY, input);
        }

        if (palette.type !== paletteTypes.NUMBER_ARRAY) {
            palette = _calcPaletteValues(palette);
        }
=======
        checkExpression('ramp', 'palette', 1, palette);
>>>>>>> master

        super({ input, palette });
        this.palette = palette;
        this.defaultOthersColor = new NamedColor('gray');
    }

    loadImages () {
        return Promise.all([this.input.loadImages(), this.palette.loadImages()]);
    }

    _setUID (idGenerator) {
        super._setUID(idGenerator);
        this.palette._setUID(idGenerator);
    }

    eval (feature) {
        const index = this._getIndex(feature);

        if (this.palette.type === paletteTypes.NUMBER_ARRAY) {
            return this._evalNumberArray(feature, index);
        }

        if (this.palette.type === paletteTypes.IMAGE) {
            return this.palette[`image${index}`].eval();
        }

        const texturePixels = this._computeTextureIfNeeded();
        const { min, max } = this._getMinMax(feature);

        this.palette = this._calcPaletteValues(this.palette);

        const m = (index - min) / (max - min);
        const numValues = texturePixels.length - 1;

        const color = this.type === rampTypes.NUMBER
            ? this._getValue(texturePixels, numValues, m)
            : this._getColorValue(texturePixels, m);

        if (Number.isNaN(color.r) ||
            Number.isNaN(color.g) ||
            Number.isNaN(color.b) ||
            Number.isNaN(color.a)) {
            return null;
        }

        return color;
    }

    _getFeatureIndex (feature) {
        return this.input.eval(feature);
    }

    _getMinMax (feature) {
        const max = this.input.type === inputTypes.CATEGORY
            ? this.input.numCategories - 1
            : 1;

        if (this.input.isA(Linear)) {
            const name = Object.keys(feature)[0];
            const featureMin = _buildFeature(name, this.input.min.eval());
            const featureMax = _buildFeature(name, this.input.max.eval());

            return {
                min: this.input.eval(featureMin),
                max: this.input.eval(featureMax)
            };
        }

        // FIXME
        return { min: 0, max };
    }

    _getIndex (feature) {
        if (this.input.isA(Property)) {
            return this.input.getPropertyId(feature);
        }

        if (this.input.isA(Top)) {
            return this.input.property.getPropertyId(feature);
        }

        return this.input.eval(feature);
    }
    /**
     * Get the value associated with each category
     *
     * @param {object} config - Optional configuration
     * @param {string} config.defaultOthers - Name for other category values. Defaults to 'Others'.
     * @param {number} config.samples - Number of samples for numeric values to be returned. Defaults to 10. The maximum number of samples is 100.
     * @return {object} - { type, data }. 'type' could be category or number. Data is an array of { key, value } objects. 'key' depends on the expression type. 'value' is the result evaluated by the ramp. There is more information in the examples.
     *
     * @example <caption>Get the color associated with each category</caption>
     * const s = carto.expressions;
     * const viz = new carto.Viz({
     *   color: s.ramp(s.prop('vehicles'), s.palettes.PRISM)
     * });
     *
     * layer.on('loaded', () => {
     *   const legend = layer.viz.color.getLegend();
     *   // legend = {
     *   //    type: 'category',
     *   //    data: [
     *   //       { key: 'Bicycle', value: { r: 95, g: 70, b: 144, a: 1 } },
     *   //       { key: 'Car', value: { r: 29, g: 105, b: 150, a: 1 ] },
     *   //       { key: 'Bus', value: { r: 56, g: 166, b: 165, a: 1 ] },
     *   //       { key: 'Others', value: { r: 15, g: 133, b: 84, a: 1 ] }
     *   //     ]
     *   // }
     * });
     *
     * @example <caption>Get the color associated with each category (String)</caption>
     * const viz = new carto.Viz(`
     *   color: ramp($vehicles, PRISM)
     * ´);
     *
     * layer.on('loaded', () => {
     *   const legend = layer.viz.color.getLegend();
     *   // legend = {
     *   //    type: 'category',
     *   //    data: [
     *   //       { key: 'Bicycle', value: { r: 95, g: 70, b: 144, a: 1 } },
     *   //       { key: 'Car', value: { r: 29, g: 105, b: 150, a: 1 ] },
     *   //       { key: 'Bus', value: { r: 56, g: 166, b: 165, a: 1 ] },
     *   //       { key: 'Others', value: { r: 15, g: 133, b: 84, a: 1 ] }
     *   //     ]
     *   // }
     * });
     *
     * @example <caption>Get the image url associated with each category</caption>
     * const s = carto.expressions;
     * const viz = new carto.Viz({
     *   symbol: s.ramp(s.prop('vehicles'), s.imageList([s.BICYCLE, s.CAR, s.BUS]))
     * });
     *
     * layer.on('loaded', () => {
     *   const legend = layer.viz.symbol.getLegend();
     *   // legend = {
     *   //    type: 'category',
     *   //    data: [
     *   //       { key: 'Bicycle', value: bicycleImageUrl },
     *   //       { key: 'Car', value: carImageUrl },
     *   //       { key: 'Bus', value: bicycleImageUrl },
     *   //       { key: 'Others', value:  ''}
     *   //     ]
     *   // }
     * });
     *
     * @example <caption>Get the image url associated with each category (String)</caption>
     * const viz = new carto.Viz(`
     *   symbol: ramp('$vehicles'), imageList([BICYCLE, CAR, BUS]))
     * `);
     *
     * layer.on('loaded', () => {
     *   const legend = layer.viz.symbol.getLegend();
     *   // legend = {
     *   //    type: 'category',
     *   //    data: [
     *   //       { key: 'Bicycle', value: bicycleImageUrl },
     *   //       { key: 'Car', value: carImageUrl },
     *   //       { key: 'Bus', value: bicycleImageUrl },
     *   //       { key: 'Others', value:  ''}
     *   //     ]
     *   // }
     * });
     *
     * @example <caption>Get the top 3 categories and set default category name</caption>
     * const s = carto.expressions;
     * const viz = new carto.Viz({
     *   color: s.ramp(s.top(s.prop('vehicles')), s.palettes.PRISM)
     * });
     *
     * layer.on('loaded', () => {
     *   const legend = layer.viz.color.getLegend({
     *      defaultOthers: 'Other Vehicles'
     *   });
     *
     *   // legend = {
     *   //    type: 'category',
     *   //    data: [
     *   //       { key: 'Bicycle', value: { r: 95, g: 70, b: 144, a: 1 } },
     *   //       { key: 'Car', value: { r: 29, g: 105, b: 150, a: 1 ] },
     *   //       { key: 'Bus', value: { r: 56, g: 166, b: 165, a: 1 ] },
     *   //       { key: 'Other Vehicles', value: { r: 15, g: 133, b: 84, a: 1 ] }
     *   //     ]
     *   // }
     * });
     *
     * @example <caption>Get the top 3 categories and set default category name (String)</caption>
     * const viz = new carto.Viz(`
     *   color: ramp(top($vehicles, 5), PRISM)
     * `);
     *
     * layer.on('loaded', () => {
     *   const legend = layer.viz.color.getLegend({
     *      defaultOthers: 'Other Vehicles'
     *   });
     *
     *   // legend = {
     *   //    type: 'category',
     *   //    data: [
     *   //       { key: 'Bicycle', value: { r: 95, g: 70, b: 144, a: 1 } },
     *   //       { key: 'Car', value: { r: 29, g: 105, b: 150, a: 1 ] },
     *   //       { key: 'Bus', value: { r: 56, g: 166, b: 165, a: 1 ] },
     *   //       { key: 'Other Vehicles', value: { r: 15, g: 133, b: 84, a: 1 ] }
     *   //     ]
     *   // }
     * });
     *
     * @example <caption>Get 4 samples for a linear color ramp</caption>
     * const s = carto.expressions;
     * const viz = new carto.Viz({
     *   color: s.ramp(s.linear(s.prop('numvehicles'), 1, 100), s.palettes.PRISM)
     * });
     *
     * layer.on('loaded', () => {
     *   const legend = layer.viz.color.getLegend({
     *       samples: 4
     *   });
     *
     *   // legend = {
     *   //    type: 'number',
     *   //    name: 'numvehicles',
     *   //    data: [
     *   //       { key: 25, value: { r: 95, g: 70, b: 144, a: 1 } },
     *   //       { key: 50, value: { r: 29, g: 105, b: 150, a: 1 ] },
     *   //       { key: 75, value: { r: 56, g: 166, b: 165, a: 1 ] },
     *   //       { key: 100, value: { r: 15, g: 133, b: 84, a: 1 ] }
     *   //     ]
     *   // }
     * });
     *
     * @example <caption>Get 4 samples for a linear color ramp (String)</caption>
     * const viz = new carto.Viz(`
     *   color: ramp(linear($numvehicles, 1, 100), PRISM)
     * `);
     *
     * layer.on('loaded', () => {
     *   const legend = layer.viz.color.getLegend({
     *       samples: 4
     *   });
     *
     *   // legend = {
     *   //    type: 'number',
     *   //    name: 'numvehicles',
     *   //    data: [
     *   //       { key: 25, value: { r: 95, g: 70, b: 144, a: 1 } },
     *   //       { key: 50, value: { r: 29, g: 105, b: 150, a: 1 ] },
     *   //       { key: 75, value: { r: 56, g: 166, b: 165, a: 1 ] },
     *   //       { key: 100, value: { r: 15, g: 133, b: 84, a: 1 ] }
     *   //     ]
     *   // }
     * });
     *
     * @memberof carto.expressions.Ramp
     * @name getLegend
     * @instance
     * @api
     */
    getLegend (options) {
        const config = Object.assign({}, DEFAULT_OPTIONS, options);
        const type = this.input.type;

        if (config.samples > MAX_SAMPLES) {
            throw new Error(`The maximum number of samples for a legend is ${MAX_SAMPLES}`);
        }

        if (this.input.type === inputTypes.NUMBER) {
            const { data, min, max } = this._getLegendNumeric(config);
            return { type, min, max, data };
        }

        if (this.input.type === inputTypes.CATEGORY) {
            const data = this._getLegendCategories(config);
            return { type, data };
        }
    }

    _getLegendNumeric (config) {
        const name = this.input.getPropertyName();
        const min = this.input.min.eval();
        const max = this.input.max.eval();
        const INC = (max - min) / config.samples;
        const data = [];

        for (let i = min; i < max; i += INC) {
            const feature = _buildFeature(name, i);
            const key = i;
            const value = this.eval(feature);

            data.push({ key, value });
        }

        return { data, min, max };
    }

    _getLegendCategories (config) {
        const name = this.input.getPropertyName();
        const categories = this._metadata.properties[name].categories;
        const maxNumCategories = this.input.numCategories - 1;
        const legend = [];

        for (let i = 0; i <= maxNumCategories; i++) {
            const category = categories[i];

            if (category) {
                const feature = Object.defineProperty({},
                    name,
                    { value: category.name }
                );

                const key = category.name && i < maxNumCategories
                    ? category.name
                    : config.defaultOthers;

                const value = this.eval(feature);
                legend.push({ key, value });
            }
        }

        return legend;
    }

    _evalNumberArray (feature, index) {
        const max = this.input.type === inputTypes.CATEGORY
            ? this.input.numCategories - 1
            : 1;

        const m = index / max;

        for (let i = 0; i < this.palette.elems.length - 1; i++) {
            const rangeMin = i / (this.palette.elems.length - 1);
            const rangeMax = (i + 1) / (this.palette.elems.length - 1);

            if (m > rangeMax) {
                continue;
            }

            const rangeM = (m - rangeMin) / (rangeMax - rangeMin);
            const a = this.palette.elems[i].eval(feature);
            const b = this.palette.elems[i + 1].eval(feature);
            return mix(a, b, clamp(rangeM, 0, 1));
        }

        throw new Error('Unexpected condition on ramp._evalNumberArray()');
    }

    _getValue (texturePixels, numValues, m) {
        const lowIndex = clamp(Math.floor(numValues * m), 0, numValues);
        const highIndex = clamp(Math.ceil(numValues * m), 0, numValues);
        const fract = numValues * m - Math.floor(numValues * m);
        const low = texturePixels[lowIndex];
        const high = texturePixels[highIndex];

        return Math.round(fract * high + (1 - fract) * low);
    }

    _getColorValue (texturePixels, m) {
        const index = _calcColorValueIndex(m);

        return {
            r: Math.round(texturePixels[index * 4 + 0]),
            g: Math.round(texturePixels[index * 4 + 1]),
            b: Math.round(texturePixels[index * 4 + 2]),
            a: Math.round(texturePixels[index * 4 + 3]) / MAX_BYTE_VALUE
        };
    }

    _bindMetadata (metadata) {
        super._bindMetadata(metadata);

<<<<<<< HEAD
        if (this.input.isA(Property)) {
            this.input = this.input.type === inputTypes.NUMBER
                ? new Linear(this.input)
                : new CategoryIndex(this.input);

=======
        this.type = this.palette.type === paletteTypes.NUMBER_ARRAY ? rampTypes.NUMBER : rampTypes.COLOR;
        if (this.palette.type === 'image-list') {
            this.type = 'image';
        }

        if (this.palette.type !== 'number-array') {
            this.palette = _calcPaletteValues(this.palette);
        }

        if (this.input.isA(Property) && this.input.type === inputTypes.NUMBER) {
            this.input = new Linear(this.input);
>>>>>>> master
            this.input._bindMetadata(metadata);
        }

        checkType('ramp', 'input', 0, Object.values(inputTypes), this.input);

        if (this.palette.type === paletteTypes.IMAGE_LIST) {
            checkType('ramp', 'input', 0, inputTypes.CATEGORY, this.input);
            checkInstance('ramp', 'palette', 1, ImageList, this.palette);
        }

        this._properties = metadata.properties;
        this._texCategories = null;
        this._GLtexCategories = null;
        this._metadata = metadata;
    }

    _applyToShaderSource (getGLSLforProperty) {
        if (this.palette.type === paletteTypes.IMAGE_LIST) {
            return this._applyToShaderSourceImage(getGLSLforProperty);
        }

        const input = this.input._applyToShaderSource(getGLSLforProperty);
        let inline = '';
        let preface = `
            uniform float rampMax${this._uid};`;

        if (this.palette.type === paletteTypes.NUMBER_ARRAY) {
            const GLSLNums = this.palette.elems.map(elem => elem._applyToShaderSource(getGLSLforProperty));
            const inlineGLSLNums = GLSLNums.map(num => num.inline);
            const GLSLBlend = this._generateGLSLBlend(inlineGLSLNums);

            // the ramp_num function looks up the numeric array this.palette and performs linear interpolation to retrieve the final result
            // For example:
            //   with this.palette.elems=[10,20] ram_num(0.4) will return 14
            //   with this.palette.elems=[0, 10, 30] ramp_num(0.75) will return 20
            //   with this.palette.elems=[0, 10, 30] ramp_num(0.5) will return 10
            //   with this.palette.elems=[0, 10, 30] ramp_num(0.25) will return 5

            // With numeric arrays we use a combination of `mix` to allow for property-dependant values
            inline = `ramp_num${this._uid}(${input.inline})`;
            preface += `
                ${GLSLNums.map(num => num.preface).join('\n')}
    
                float ramp_num${this._uid}(float x){
                    return ${GLSLBlend};
                }`;
        } else {
            const colors = this._getColorsFromPalette(this.input, this.palette);
            const cielabColors = colors.map(color => sRGBToCielab({
                r: color.r / MAX_BYTE_VALUE,
                g: color.g / MAX_BYTE_VALUE,
                b: color.b / MAX_BYTE_VALUE,
                a: color.a
            }));
            const GLSLColors = cielabColors.map(color => `vec4(${color.l.toFixed(20)}, ${color.a.toFixed(20)}, ${color.b.toFixed(20)}, ${color.alpha.toFixed(20)})`);
            const GLSLBlend = this._generateGLSLBlend(GLSLColors);

            inline = `cielabToSRGBA(ramp_color${this._uid}(${input.inline}))`;
            preface += `
                ${CIELabGLSL}
                vec4 ramp_color${this._uid}(float x){
                    return ${GLSLBlend};
            }`;
        }

        return { preface: this._prefaceCode(input.preface + preface), inline };
    }

    _generateGLSLBlend (list, index = 0) {
        const currentColor = list[index];

        if (index === list.length - 1) {
            return currentColor;
        }

        const nextBlend = this._generateGLSLBlend(list, index + 1);

        return _mixClampGLSL(currentColor, nextBlend, index, list.length);
    }

    _applyToShaderSourceImage (getGLSLforProperty) {
        const input = this.input._applyToShaderSource(getGLSLforProperty);
        const images = this.palette._applyToShaderSource(getGLSLforProperty);
        return {
            preface: input.preface + images.preface,
            inline: `${images.inline}(imageUV, ${input.inline})`
        };
    }

    _getColorsFromPalette (input, palette) {
        if (palette.type === paletteTypes.IMAGE_LIST) {
            return palette.eval();
        }

        return palette.type === paletteTypes.PALETTE
            ? _getColorsFromPaletteType(input, palette, this.input.numCategories, this.defaultOthersColor.eval())
            : _getColorsFromColorArrayType(input, palette, this.input.numCategories, this.defaultOthersColor.eval());
    }

    _postShaderCompile (program, gl) {
        if (this.palette.type === paletteTypes.IMAGE_LIST) {
            this.palette._postShaderCompile(program, gl);
            super._postShaderCompile(program, gl);
            return;
        }

        this.palette._postShaderCompile(program, gl);
        this.input._postShaderCompile(program, gl);
        this._getBinding(program).rampMaxLoc = gl.getUniformLocation(program, `rampMax${this._uid}`);
    }

    _computeTextureIfNeeded () {
        if (this._cachedTexturePixels && !this.palette.isAnimated()) {
            return this._cachedTexturePixels;
        }

        this._texCategories = this.input.numCategories;
        this._cachedTexturePixels = this.type === rampTypes.COLOR
            ? this._computeColorRampTexture()
            : this._computeNumericRampTexture();

        return this._cachedTexturePixels;
    }

    _calcPaletteValues (palette) {
        return _calcPaletteValues(palette);
    }

    _computeColorRampTexture () {
        if (this.palette.isAnimated()) {
            this.palette = this._calcPaletteValues(this.palette);
        }

        const texturePixels = new Uint8Array(4 * COLOR_ARRAY_LENGTH);
        const colors = this._getColorsFromPalette(this.input, this.palette);

        for (let i = 0; i < COLOR_ARRAY_LENGTH; i++) {
            const vColorARaw = colors[Math.floor(i / (COLOR_ARRAY_LENGTH - 1) * (colors.length - 1))];
            const vColorBRaw = colors[Math.ceil(i / (COLOR_ARRAY_LENGTH - 1) * (colors.length - 1))];
            const vColorA = [vColorARaw.r / (COLOR_ARRAY_LENGTH - 1), vColorARaw.g / (COLOR_ARRAY_LENGTH - 1), vColorARaw.b / (COLOR_ARRAY_LENGTH - 1), vColorARaw.a];
            const vColorB = [vColorBRaw.r / (COLOR_ARRAY_LENGTH - 1), vColorBRaw.g / (COLOR_ARRAY_LENGTH - 1), vColorBRaw.b / (COLOR_ARRAY_LENGTH - 1), vColorBRaw.a];
            const m = i / (COLOR_ARRAY_LENGTH - 1) * (colors.length - 1) - Math.floor(i / (COLOR_ARRAY_LENGTH - 1) * (colors.length - 1));
            const v = interpolateRGBAinCieLAB({ r: vColorA[0], g: vColorA[1], b: vColorA[2], a: vColorA[3] }, { r: vColorB[0], g: vColorB[1], b: vColorB[2], a: vColorB[3] }, m);

            texturePixels[4 * i + 0] = Math.round(v.r * MAX_BYTE_VALUE);
            texturePixels[4 * i + 1] = Math.round(v.g * MAX_BYTE_VALUE);
            texturePixels[4 * i + 2] = Math.round(v.b * MAX_BYTE_VALUE);
            texturePixels[4 * i + 3] = Math.round(v.a * MAX_BYTE_VALUE);
        }

        return texturePixels;
    }

    _computeNumericRampTexture () {
        const texturePixels = new Float32Array(COLOR_ARRAY_LENGTH);
        const floats = this.palette.floats;

        for (let i = 0; i < COLOR_ARRAY_LENGTH; i++) {
            const vColorARaw = floats[Math.floor(i / (COLOR_ARRAY_LENGTH - 1) * (floats.length - 1))];
            const vColorBRaw = floats[Math.ceil(i / (COLOR_ARRAY_LENGTH - 1) * (floats.length - 1))];
            const m = i / (COLOR_ARRAY_LENGTH - 1) * (floats.length - 1) - Math.floor(i / (COLOR_ARRAY_LENGTH - 1) * (floats.length - 1));
            texturePixels[i] = ((1.0 - m) * vColorARaw + m * vColorBRaw);
        }

        return texturePixels;
    }

    _computeGLTextureIfNeeded (gl) {
        const texturePixels = this._computeTextureIfNeeded();
        const isAnimatedPalette = this.palette.isAnimated();

        if (this._GLtexCategories !== this.input.numCategories || isAnimatedPalette) {
            this._GLtexCategories = this.input.numCategories;
            this.texture = gl.createTexture();
            this._bindGLTexture(gl, texturePixels);
        }
    }

    _bindGLTexture (gl, texturePixels) {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        if (this.type === rampTypes.COLOR) {
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, COLOR_ARRAY_LENGTH, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, texturePixels);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        } else {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, COLOR_ARRAY_LENGTH, 1, 0, gl.ALPHA, gl.FLOAT, texturePixels);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        }

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    _preDraw (program, drawMetadata, gl) {
        const max = this.input.type === inputTypes.CATEGORY
            ? this.input.numCategories - 1
            : 1;

        this.input._preDraw(program, drawMetadata, gl);

        if (this.palette.type === paletteTypes.IMAGE_LIST) {
            this.palette._preDraw(program, drawMetadata, gl);
            return;
        }

        this.palette._preDraw(program, drawMetadata, gl);
        gl.uniform1f(this._getBinding(program).rampMaxLoc, max);
        super._preDraw(program, drawMetadata, gl);
    }
}

function _getColorsFromPaletteType (input, palette, numCategories, defaultOthersColor) {
    switch (true) {
        case input.isA(Buckets):
            return _getColorsFromPaletteTypeBuckets(palette, numCategories, defaultOthersColor);
        case input.isA(Top):
            return _getColorsFromPaletteTypeTop(palette, numCategories, defaultOthersColor);
        default:
            return _getColorsFromPaletteTypeDefault(input, palette, defaultOthersColor);
    }
}

function _getColorsFromPaletteTypeBuckets (palette, numCategories, defaultOthersColor) {
    let colors = _getSubPalettes(palette, numCategories);

    if (palette.isQuantitative()) {
        colors.push(defaultOthersColor);
    }

    if (palette.isQualitative()) {
        defaultOthersColor = colors[numCategories];
    }

    return _avoidShowingInterpolation(numCategories, colors, defaultOthersColor);
}

function _getColorsFromPaletteTypeTop (palette, numCategories, defaultOthersColor) {
    let colors = _getSubPalettes(palette, numCategories);

    if (palette.isQualitative()) {
        defaultOthersColor = colors[colors.length - 1];
    }

    return _avoidShowingInterpolation(numCategories, colors, defaultOthersColor);
}

function _getColorsFromPaletteTypeDefault (input, palette, defaultOthersColor) {
    let colors = _getSubPalettes(palette, input.numCategories);

    if (palette.isQualitative()) {
        colors.pop();
        defaultOthersColor = colors[input.numCategories];
    }

    if (input.numCategories === undefined) {
        return colors;
    }

    return _avoidShowingInterpolation(input.numCategories, colors, defaultOthersColor);
}

function _getSubPalettes (palette, numCategories) {
    return palette.subPalettes[numCategories]
        ? palette.subPalettes[numCategories]
        : palette.getLongestSubPalette();
}

function _getColorsFromColorArrayType (input, palette, numCategories, defaultOthersColor) {
    return input.type === inputTypes.CATEGORY
        ? _getColorsFromColorArrayTypeCategorical(input, numCategories, palette.colors, defaultOthersColor)
        : palette.colors;
}

function _getColorsFromColorArrayTypeCategorical (input, numCategories, colors, defaultOthersColor) {
    switch (true) {
        case input.isA(Classifier) && numCategories < colors.length:
            return colors;
        case input.isA(Property):
            return colors;
        case numCategories < colors.length:
            return _avoidShowingInterpolation(numCategories, colors, colors[numCategories]);
        case numCategories > colors.length:
            return _addOthersColorToColors(colors, defaultOthersColor);
        default:
            colors = _addOthersColorToColors(colors, defaultOthersColor);
            return _avoidShowingInterpolation(numCategories, colors, defaultOthersColor);
    }
}

// function _getColorsFromColorArrayTypeNumeric (numCategories, colors) {
//     let othersColor;

//     if (numCategories < colors.length) {
//         othersColor = colors[numCategories];
//         return _avoidShowingInterpolation(numCategories, colors, othersColor);
//     }

//     if (numCategories === colors.length) {
//         othersColor = colors[colors.length - 1];
//         return _avoidShowingInterpolation(numCategories, colors, othersColor);
//     }

//     return colors;
// }

function _addOthersColorToColors (colors, othersColor) {
    return [...colors, othersColor];
}

function _avoidShowingInterpolation (numCategories, colors, defaultOthersColor) {
    const colorArray = [];

    for (let i = 0; i < colors.length; i++) {
        if (i < numCategories) {
            colorArray.push(colors[i]);
        } else if (i === numCategories) {
            colorArray.push(defaultOthersColor);
        }
    }

    return colorArray;
}

function _calcPaletteValues (palette) {
    try {
        if (palette.type === paletteTypes.NUMBER_ARRAY) {
            palette.floats = palette.eval();
        } else if (palette.type === paletteTypes.COLOR_ARRAY) {
            palette.colors = palette.eval();
        }
    } catch (error) {
        throw new Error('Palettes must be formed by constant expressions, they cannot depend on feature properties');
    }

    return palette;
}

function _buildFeature (name, value) {
    const enumerable = true;

    return Object.defineProperty({}, name, { value, enumerable });
}

function _calcColorValueIndex (m) {
    if (Number.isNaN(m) || m === Number.NEGATIVE_INFINITY) {
        return 0;
    }

    if (m === Number.POSITIVE_INFINITY || m > 1) {
        return COLOR_ARRAY_LENGTH - 1;
    }

    return Math.round(m * MAX_BYTE_VALUE);
}

function _mixClampGLSL (currentColor, nextBlend, index, listLength) {
    const min = (index / (listLength - 1)).toFixed(20);
    const max = (1 / (listLength - 1)).toFixed(20);
    const clamp = `clamp((x - ${min})/${max}, 0., 1.)`;

    return `mix(${currentColor}, ${nextBlend}, ${clamp})`;
}
