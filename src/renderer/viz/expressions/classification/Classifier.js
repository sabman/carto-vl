import BaseExpression from '../base';
import { number } from '../../expressions';

import { checkType, checkNumber } from '../utils';
import CartoValidationError, { CartoValidationErrorTypes } from '../../../../errors/carto-validation-error';
import ClassifierGLSLHelper from './ClassifierGLSLHelper';

export const DEFAULT_HISTOGRAM_SIZE = 1000;

let classifierUID = 0;
export default class Classifier extends BaseExpression {
    constructor (children) {
        super(children);
        this.classifierUID = classifierUID++;
        this.type = 'category';

        this._GLSLhelper = new ClassifierGLSLHelper(this);
    }

    get value () {
        return this.eval();
    }

    eval (feature) {
        const inputValue = this.input.eval(feature);
        const breakpoint = this.breakpoints.findIndex((breakpoint) => {
            return inputValue <= breakpoint.value;
        });

        const divisor = this.numCategories - 1 || 1;
        const index = breakpoint === -1 ? 1 : breakpoint / divisor;

        return index;
    }

    toString () {
        return `${this.expressionName}(${this.input.toString()}, ${this.numCategories})`;
    }

    _resolveAliases (aliases) {
        super._resolveAliases(aliases);

        this._bucketsInitialization();
    }

    _bucketsInitialization () {
        this._validateBucketsIsProperNumber();

        const buckets = this.buckets.value;
        this.numCategories = buckets;
        this.numCategoriesWithoutOthers = buckets;

        this._initBreakpointsChildren(buckets);
    }

    _initBreakpointsChildren (buckets) {
        this.breakpoints = this._breakpointsWithZeros(buckets);

        const breakpointsChildren = this.breakpoints.reduce((children, current, index) => {
            children[`arg${index}`] = current;
            return children;
        }, {});
        this._initializeChildren(breakpointsChildren);
    }

    _breakpointsWithZeros (buckets) {
        const breakpoints = [];
        for (let i = 0; i < buckets - 1; i++) {
            breakpoints.push(number(0));
        }
        return breakpoints;
    }

    _validateBucketsIsProperNumber () {
        const buckets = this.buckets.value;
        checkNumber(this.expressionName, 'buckets', 1, buckets);
        if (buckets <= 1) {
            throw new CartoValidationError(
                `The number of 'buckets' must be >=2, but ${buckets} was used`,
                CartoValidationErrorTypes.INCORRECT_VALUE
            );
        }
    }

    _bindMetadata (metadata) {
        super._bindMetadata(metadata);

        this._validateInputIsNumericProperty();
    }

    _validateInputIsNumericProperty () {
        checkType(this.expressionName, 'input', 0, 'number', this.input);
    }

    _getBreakpointList () {
        this._genBreakpoints();
        return this.breakpoints.map(breakpoint => breakpoint.value);
    }

    _genBreakpoints () { }

    _applyToShaderSource (getGLSLforProperty) {
        return this._GLSLhelper ? this._GLSLhelper.applyToShaderSource(getGLSLforProperty) : null;
    }

    _preDraw (program, drawMetadata, gl) {
        this._genBreakpoints();
        super._preDraw(program, drawMetadata, gl);
    }

    getLegendData () {
        const breakpoints = this._getBreakpointList();
        const breakpointsLength = breakpoints.length;
        const legendMin = this.min.value;
        const legendMax = this.max.value;
        const data = [];

        for (let i = 0; i <= breakpointsLength; i++) {
            const min = breakpoints[i - 1] === 0 ? 0 : breakpoints[i - 1] || legendMin;
            const max = breakpoints[i] === 0 ? 0 : breakpoints[i] || legendMax;
            const key = [min, max];
            const value = i / breakpointsLength;
            data.push({ key, value });
        }

        return { name: this.toString(), data };
    }
}
