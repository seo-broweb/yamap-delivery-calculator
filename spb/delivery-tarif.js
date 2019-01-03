function DeliveryTarif(options) {
    this._options = options;
    this.events = new ymaps.event.Manager();
}

DeliveryTarif.prototype = {
    constructor: DeliveryTarif,
    getCoordinates: function () {
        $.ajax({
            url: this._options.url,
            dataType: 'json',
            success: $.proxy(this._onCoordinatesReceived, this)
        });

        return this;
    },
    _onCoordinatesReceived: function (json) {
        this.geometry = (new ymaps.GeoObject({ geometry: json })).geometry;
        this.events.fire('ready', {
            target: this
        });
    },
    _createPolyline: function (path) {
        this._polyline = new ymaps.Polyline(path, {
            hintContent: this._options.label
        }, {
            strokeColor: this._options.color,
            strokeWidth: 3
        });
    },
    _contains: function (leg_or_step) {
        if (this._options.id === 'no_spb') {
            return !this.geometry.contains(leg_or_step.start_location) ||
                !this.geometry.contains(leg_or_step.end_location)
        }

        return this.geometry.contains(leg_or_step.start_location) ||
            this.geometry.contains(leg_or_step.end_location);
    },
    _getPathFilter : function (point, i, points) {
        if (this._options.id === 'no_spb') {
            return !this.geometry.contains(point) ||
                (points[i - 1] && !this.geometry.contains(points[i - 1]));
        }

        return this.geometry.contains(point) ||
            (points[i - 1] && this.geometry.contains(points[i - 1]));
    },
    _getPath: function (route) {
        var flatten = function (a, b) { return a.concat(b); },
            steps = route.legs
                .filter(this._contains, this)
                .map(function (leg) {
                    return leg.steps;
                }),
            path = steps.length? steps
                .reduce(flatten)
                .filter(this._contains, this)
                .map(function (step) {
                    return step.path;
                })
                .reduce(flatten)
                .filter(function (point, i, points) {
                    return this._getPathFilter(point, i, points);
                }, this) : [];

        return path;
    },
    _getDistance: function (path) {
        var coordSystem = this._map.options.get('projection').getCoordSystem();

        return path.reduce(function (distance, point, index, points) {
            return distance + coordSystem.getDistance(points[index - 1] || point, point);
        }, 0);
    },

    _getDistanceCost: function (distance) {
        var cost = distance / 1000 * this._options.cost
        if (this._options.id === 'no_spb') {
            var cost_no_spb_5_km = 300;
            var cost_no_spb_more_5_km = 60;

            if (distance == 0) {
                cost = 0
            } else if (distance / 1000 <= 5) {
                cost = cost_no_spb_5_km
            } else {
                cost = cost_no_spb_5_km + (distance - 5000)/1000 * cost_no_spb_more_5_km
            }
        }
        return Math.floor(cost)
    },
    setMap: function (map) {
        this._map = map;
        this.geometry.setMap(map);
        this.geometry.options.setParent(map.options);

        return this;
    },
    calculate: function (route) {
        var path = this._getPath(route),
            distance = this._getDistance(path);

        this._createPolyline(path);

        return ymaps.util.extend({
            distance: Math.floor(distance),
            value: this._getDistanceCost(distance)
        }, this._options);
    },
    render: function (path) {
        if(this._map) {
            this._map.geoObjects.add(this._polyline);
        }
    },
    clear: function () {
        if(this._map && this._polyline) {
            this._map.geoObjects.remove(this._polyline);
        }
    }
}
