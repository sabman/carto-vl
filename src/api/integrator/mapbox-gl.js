import * as R from '../../core/renderer';
import * as util from '../util';

let uid = 0;

// TODO This needs to be separated by each mgl map to support multi map pages
let integrator = null;
export default function getMGLIntegrator(map) {
    if (!integrator) {
        integrator = new MGLIntegrator(map);
    }
    return integrator;
}


/**
 * Responsabilities, keep all MGL integration state and functionality that lies outside Layer
 */
class MGLIntegrator {
    constructor(map) {
        this.renderer = new R.Renderer();
        this.map = map;
        this.invalidateWebGLState = null;

        map.on('movestart', this.move.bind(this));
        map.on('move', this.move.bind(this));
        map.on('moveend', this.move.bind(this));
        map.on('resize', this.move.bind(this));

        this.moveObservers = {};

        this._layers = [];
    }
    _registerMoveObserver(observerName, observerCallback) {
        this.moveObservers[observerName] = observerCallback;
    }
    _unregisterMoveObserver(observerName) {
        delete this.moveObservers[observerName];
    }
    addLayer(layer, beforeLayerID) {
        const callbackID = `_cartoGL_${uid++}`;
        const layerId = layer.getId();
        this._registerMoveObserver(callbackID, layer.requestData.bind(layer));
        this.map.repaint = true; // FIXME: add logic to manage repaint flag
        this.map.setCustomWebGLDrawCallback(layerId, (gl, invalidate) => {
            if (!this.invalidateWebGLState) {
                this.invalidateWebGLState = invalidate;
                this.notifyObservers();
                this.renderer._initGL(gl);
                layer.initCallback();
            }
            layer.paintCallback();
            invalidate();
        });
        this.map.addLayer({
            id: layerId,
            type: 'custom-webgl'
        }, beforeLayerID);
        this._layers.push(layerId);
        this.move();
    }
    needRefresh() {
        this.map.repaint = true; // FIXME: add logic to manage repaint flag
    }
    move() {
        var c = this.map.getCenter();
        // TODO create getCenter method
        this.renderer.setCenter(c.lng / 180., util.projectToWebMercator(c).y / util.WM_R);
        this.renderer.setZoom(this.getZoom());
        this.notifyObservers();
    }
    notifyObservers() {
        Object.keys(this.moveObservers).map(id => this.moveObservers[id]());
    }
    getZoom() {
        var b = this.map.getBounds();
        var c = this.map.getCenter();
        var nw = b.getNorthWest();
        var sw = b.getSouthWest();
        var z = (util.projectToWebMercator(nw).y - util.projectToWebMercator(sw).y) / util.WM_2R;
        this.renderer.setCenter(c.lng / 180., util.projectToWebMercator(c).y / util.WM_R);
        return z;
    }
}