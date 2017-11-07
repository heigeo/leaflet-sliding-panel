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
        this.setFeatureGroup(options.featureGroup || null);
        this.setState(options.state || 'closed');
    },
    'open': function() {
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
            this._updateNav();
        }
    },
    'setContent': function(content) {
        if (!L.Util.isArray(content)) {
            content = [content];
        }
        this._content = content;
        this._updateContent();
    },
    'setFeatureGroup': function(featureGroup) {
        this._featureGroup = featureGroup;
        this._updateNav();
        featureGroup.getLayers().forEach(function(layer, i) {
            layer.on('click', function() {
                this.navigateTo(i);
            }, this);
        }, this);
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
        return this;
    },
    'remove': function() {
        if (!this._map) {
            return;
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
        L.DomEvent.on(container, 'dblclick', function() {
            if (this._state == 'full') {
                this.setState('minimal');
            } else {
                this.expand();
            }
        }, this);

        var hr = L.DomUtil.create('hr', 'lsp-handle', container);
        L.DomEvent.on(hr, 'click', this.expand, this);
        var button = L.DomUtil.create('button', 'lsp-button lsp-close', container);
        button.type = 'button';
        button.innerText = 'X';
        this._navRight = L.DomUtil.create(
            'button', 'lsp-button lsp-nav lsp-right', container
        );
        this._navRight.innerHTML = '&#10095';
        this._navLeft = L.DomUtil.create(
            'button', 'lsp-button lsp-nav lsp-left', container
        );
        this._navLeft.innerHTML = '&#10094';

        L.DomEvent.on(button, 'click', this.close, this);
        L.DomEvent.on(this._navRight, 'click', this.navRight, this);
        L.DomEvent.on(this._navLeft, 'click', this.navLeft, this);
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
    '_updateNav': function() {
        if (!this._navRight || !this._navLeft || !this._contentNode) {
            return;
        }
        var index = this._currentIndex || 0,
            content = this._content || [];
        this._navRight.style.display = (index < content.length - 1) ? 'block' : 'none';
        this._navLeft.style.display = index > 0 ? 'block' : 'none';
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
    'openPanel': function(content, featureGroup, options) {
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
            this._panel.setFeatureGroup(featureGroup);
        } else {
            this._panel = new SlidingPanel(L.Util.extend(
                {
                    "content": content,
                    "featureGroup": featureGroup
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
