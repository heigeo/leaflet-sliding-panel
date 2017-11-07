/*!
 * leaflet-sliding-panel
 * A mobile-friendly Leaflet popup alternative
 * (c) 2017, Houston Engineering, Inc.
 * MIT LICENSE
 */

(function (factory) {
    // Module systems magic dance, Leaflet edition
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['leaflet'], factory);
    } else if (typeof module !== 'undefined') {
        // Node/CommonJS
        module.exports = factory(require('leaflet'));
    } else {
        // Browser globals
        if (typeof this.L === 'undefined')
            throw 'Leaflet must be loaded first!';
        factory(this.L);
    }
}(function (L) {

// var SlidingPanel = L.Evented.extend({  // Leaflet 1.0
var SlidingPanel = L.Class.extend({
    'includes': L.Mixin.Events,

    'options': {
        'parentElement': null,
        'threshold': 50,
        'doubleThreshold': 200,
        'activeFeatureColor': 'cyan',
        'inactiveFeatureColor': 'blue'
    },
    'initialize': function(options) {
        L.Util.setOptions(this, options);
        this.on('swipeup', function(evt) {
            if (evt.value > this.options.doubleThreshold) {
                this.full();
            } else {
                this.expand();
            }
        });
        this.on('swipedown', function(evt) {
            if (evt.value > this.options.doubleThreshold) {
                this.close();
            } else {
                this.shrink();
            }
        });
        this.on('swipeleft', function(evt) {
            this.navRight();
        });
        this.on('swiperight', function(evt) {
            this.navLeft();
        });
        this.setContent(options.content || []);
        this.setFeatures(options.features || []);
        this.setState(options.state || 'closed');
    },
    'open': function() {
        this.setState('minimal');
    },
    'minimize': function() {
        this.setState('minimal');
    },
    'full': function() {
        this.setState('full');
    },
    'close': function() {
        this.setState('closed');
    },
    'expand': function() {
        this.setState(this._expandMap[this._state]);
    },
    'shrink': function() {
        this.setState(this._shrinkMap[this._state]);
    },
    'setState': function(state) {
        if (this._state && this._container) {
            L.DomUtil.removeClass(this._container, 'lsp-' + this._state);
        }
        this._state = state;
        if (this._container) {
            L.DomUtil.addClass(this._container, 'lsp-' + state);
        }
        if (state != 'closed' && this._map) {
            this._map.once('click', function(evt) {
                this.close();
            }, this);
        }
        if (state == 'closed') {
            this._currentIndex = 0;
            if (this._featureGroup) {
                this._featureGroup.clearLayers();
            }
        }
        this._updateNav();
    },
    'setContent': function(content) {
        if (!L.Util.isArray(content)) {
            content = [content];
        }
        this._content = content;
        this._updateContent();
    },
    'setFeatures': function(features) {
        if (!features) {
            features = [];
        } else if (features && features.type && features.features) {
            features = features.features;
        }
        this._features = features;
        this._initFeatureGroup();
        this._featureGroup.clearLayers().addData(features);
        this._featureGroup.getLayers().forEach(function(layer, i) {
            layer.on('click', function() {
                this.navigateTo(i);
            }, this);
        }, this);
        this._updateNav();
    },
    '_initFeatureGroup': function() {
        if (!this._featureGroup) {
            this._featureGroup = L.geoJson(null, {
                'pointToLayer': function (feature, latlng) {
                    return L.circleMarker(latlng, {
                        'radius': 8
                    });
                }
            });
        }
        if (this._map) {
            if (this._featureGroup._map !== this._map) {
                this._featureGroup.addTo(this._map);
            }
        }
    },
    'addTo': function(map) {
        // c.f. L.Control.onAdd
        this.remove();
        this._map = map;
        this._container = this.onAdd(map);
        L.DomEvent.disableClickPropagation(this._container);
        this._contentNode = L.DomUtil.create(
            'div', 'lsp-content', this._container
        );
        L.DomEvent.on(this._contentNode, 'touchstart', this._startSwipe, this);
        L.DomEvent.on(this._contentNode, 'touchend', this._endSwipe, this);
        this._updateContent();
        var parentElement = this.options.parentElement || map._container;
        parentElement.appendChild(this._container);
        if (this._state) {
            this.setState(this._state);
        }
        if (this._features) {
            this.setFeatures(this._features);
        }
        return this;
    },
    'remove': function() {
        if (!this._map) {
            return;
        }
        if (this._featureGroup) {
            this._map.removeLayer(this._featureGroup);
        }
        this._map = null;

        // L.DomUtil.remove(this._container);  // Leaflet 1.0
        var parentNode = this._container.parentNode;
        if (parentNode) {
            parentNode.removeChild(this._container);
        }

        return this;
    },
    'onAdd': function(map) {
        var container = L.DomUtil.create('div', 'lsp-container');
        if (L.Browser.touch) {
            L.DomUtil.addClass(container, 'lsp-touch');
        }

        var hr = L.DomUtil.create('hr', 'lsp-handle', container);
        L.DomEvent.on(hr, 'click', this.expand, this);

        var navbar = L.DomUtil.create('div', 'lsp-nav', container);

        this._createButton('close', '&times;', navbar);
        this._createButton('minimize', '&mdash;', navbar);
        this._createButton('full', '&#9633;', navbar); // Future: &#128470;
        this._createButton('navRight', '&#10095;', navbar);
        this._createButton('navLeft', '&#10094;', navbar);

        this._updateNav();

        return container;
    },
    'navRight': function() {
        this._navigate(1);
    },
    'navLeft': function() {
        this._navigate(-1);
    },
    '_updateContent': function() {
        if (!this._contentNode || !this._content) {
             return;
        }

        // L.DomUtil.empty(this._contentNode);  // Leaflet 1.0
        this._contentNode.innerHTML = '';

        this._content.forEach(function(content) {
            var html;
            if (content.title || content.content) {
                html = L.Util.template(
                    "<h3 class=lsp-header>{title}</h3>" +
                    "<div class=lsp-body>{content}</div>",
                    content
                );
            } else {
                html = content;
            }
            var node = L.DomUtil.create(
                'div', 'lsp-card', this._contentNode
            );
            node.innerHTML = html;
        }, this);
        this._currentIndex = 0;
        this._updateNav();
    },
    '_createButton': function(name, text, container) {
        var button = L.DomUtil.create('button', 'lsp-' + name, container);
        button.type = 'button';
        button.innerHTML = text;
        L.DomEvent.on(button, 'click', this[name], this);
        this._buttons = this._buttons || {};
        this._buttons[name] = button;
        return button;
    },
    '_updateNav': function() {
        if (!this._buttons || !this._contentNode) {
            return;
        }

        var index = this._currentIndex || 0,
            content = this._content || [],
            buttons = this._buttons;

        if (this._state != 'closed') {
            showButton('navRight', (index < content.length - 1));
            showButton('navLeft', (index > 0));
            showButton('minimize', (
                !L.Browser.touch && this._state != 'minimal'
            ));
            showButton('full', (
                !L.Browser.touch && this._state != 'full'
            ));
        }

        function showButton(name, show) {
            buttons[name].style.display = show ? 'block': 'none';
        }

        Array.prototype.forEach.call(this._contentNode.children, function(el) {
            el.style.transform = (
                'translate(' + (-100 * index) + '%, 0px)'
            );
        });

        if (this._featureGroup) {
            this._featureGroup.getLayers().forEach(function(layer, i) {
                var color;
                if (i == this._currentIndex) {
                    color = this.options.activeFeatureColor;
                } else {
                    color = this.options.inactiveFeatureColor;
                }
                layer.setStyle({
                    'color': color
                });
            }, this);
        }
    },
    'navigateTo': function(index) {
        this._currentIndex = index;
        this._navigate(0);
    },
    '_navigate': function(direction) {
        var index = this._currentIndex || 0;
        index += direction;
        if (index < 0) {
            index = 0;
        }
        if (index >= this._content.length) {
            index = this._content.length - 1;
        }
        this._currentIndex = index;
        this._updateNav();
    },
    '_expandMap': {
        'closed': 'minimal',
        'minimal': 'medium',
        'medium': 'full',
        'full': 'full'
    },
    '_shrinkMap': {
        'closed': 'closed',
        'minimal': 'closed',
        'medium': 'minimal',
        'full': 'medium'
    },
    '_startSwipe': function(evt) {
        var touch = evt.touches && evt.touches[0];
        if (!touch || !this._map) {
            return;
        }
        this._startPoint = this._map.mouseEventToContainerPoint(touch);
        L.DomEvent.preventDefault(evt);
    },
    '_endSwipe': function(evt) {
        var touch = evt.changedTouches && evt.changedTouches[0];
        if (!touch || !this._startPoint || !this._map) {
            return;
        }
        var endPoint = this._map.mouseEventToContainerPoint(touch);
        var diff = endPoint.subtract(this._startPoint),
            absX = Math.abs(diff.x),
            absY = Math.abs(diff.y);
        this._startPoint = null;

        if (absX < this.options.threshold && absY < this.options.threshold) {
            // Not enough distance
            return;
        }
        if (absX / absY > 0.5 && absX / absY < 2) {
            // Unclear direction
            return;
        }
        var direction, value;

        if (absX > absY) {
            value = absX;
            if (diff.x < 0) {
                direction = 'left';
            } else {
                direction = 'right';
            }
        } else {
            value = absY;
            if (diff.y < 0) {
                direction = 'up';
            } else {
                direction = 'down';
            }
        }
        this.fire('swipe' + direction, {
            'direction': direction,
            'value': value
        });
    }
});

function slidingPanel(content) {
   return new SlidingPanel(content);
}

L.Map.include({
    'openPanel': function(content, features, options) {
        if (!options) {
             options = {};
        }
        var state = options.state;
        delete options.state;

        if (content instanceof SlidingPanel) {
            this.removePanel();
            this._panel = content.addTo(this);
        } else if (this._panel) {
            this._panel.setContent(content);
            this._panel.setFeatures(features);
        } else {
            this._panel = new SlidingPanel(L.Util.extend(
                {
                    "content": content,
                    "features": features
                },
                options
            )).addTo(this);
        }
        // Delay open until next tick to ensure CSS animation works
        var panel = this._panel;
        setTimeout(function() {
            if (state) {
                panel.setState(state);
            } else {
                panel.open();
            }
        }, 0);
    },
    'closePanel': function() {
        if (!this._panel) {
            return;
        }
        this._panel.close();
    },
    'removePanel': function() {
        if (!this._panel) {
            return;
        }
        this.closePanel();
        this._panel.remove();
        delete this._panel;
    }
});


L.SlidingPanel = slidingPanel.SlidingPanel = SlidingPanel;
L.slidingPanel = slidingPanel;

return slidingPanel;

}));
