
export default class SimpleMap {

    constructor(options) {
        options = options || {};

        if (typeof options.container === 'string') {
            const container = window.document.getElementById(options.container);
            if (!container) {
                throw new Error(`Container '${options.container}' not found.`);
            } else {
                this._container = container;
            }
        } else if (options.container instanceof HTMLElement) {
            this._container = options.container;
        } else {
            throw new Error('Invalid type: \'container\' must be a String or HTMLElement.');
        }

        this._canvas = this._createCanvas();
        this._container.appendChild(this._canvas);

        this._gl = this._canvas.getContext('webgl') || this._canvas.getContext('experimental-webgl');
        this._paintCallback = null;

        // Repaint: true
        setInterval(() => {
            this.update();
        }, 100);
    }

    addLayer(paintCallback) {
        this._paintCallback = paintCallback;
    }

    update() {
        const { width, height } = this._containerDimensions();
        this._resizeCanvas(width, height);

        // Draw background
        this._gl.viewport(0, 0, this._gl.drawingBufferWidth, this._gl.drawingBufferHeight);
        this._gl.clearColor(0.5, 0.5, 0.5, 1.0);
        this._gl.clear(this._gl.COLOR_BUFFER_BIT);

        if (this._paintCallback) {
            this._paintCallback();
        }
    }

    _createCanvas() {
        const canvas = window.document.createElement('canvas');

        canvas.className = 'canvas';
        canvas.style.position = 'absolute';

        return canvas;
    }

    _containerDimensions() {
        let width = 0;
        let height = 0;

        if (this._container) {
            width = this._container.offsetWidth || 400;
            height = this._container.offsetHeight || 300;
        }

        return { width, height };
    }

    _resizeCanvas(width, height) {
        const pixelRatio = window.devicePixelRatio || 1;

        this._canvas.width = pixelRatio * width;
        this._canvas.height = pixelRatio * height;

        this._canvas.style.width = `${width}px`;
        this._canvas.style.height = `${height}px`;
    }
}
