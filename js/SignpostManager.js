const JunctionRouter = require('./JunctionRouter');
const GoogleProjection = require('jsfreemaplib').GoogleProjection;
const turfDistance = require('@turf/distance').default;
const turfPoint = require('turf-point');
const turfBearing = require('@turf/bearing').default;


class SignpostManager {
    constructor(options = {}) {
        this.jr = new JunctionRouter({ distThreshold: 0.02 });
        this.sphMerc = new GoogleProjection();
        this.signposts = { };
        this.lastPos = [-181, -91];
        this.juncDetectDistChange = options.juncDetectDistChange || 0.005;
    }

    update(ways, pois) {
        console.log('SignpostManager.update()');
        const unprojWays = {
            type: 'FeatureCollection'
        };
        unprojWays.features = ways.map ( f => { 
            return {
                type: 'Feature',
                properties: Object.assign({}, f.properties),
                geometry: {
                    type: 'LineString',
                    coordinates: f.geometry.coordinates.map ( coord => this.sphMerc.unproject(coord).concat(coord[2]))
                }
            }
        });
        this.pois = pois.map ( f => {
            return {
                properties: Object.assign({}, f.properties),
                lon: this.sphMerc.googleToLon(f.geometry[0]),
                lat: this.sphMerc.googleToLat(f.geometry[2])
            };
        });
        this.jr.update(unprojWays, this.pois);
    }

    updatePos(p, options = {}) {
        const tp = turfPoint(p);
        // Only try to detect a junction if we've moved a certain distance
        if(!this.jr.hasData() || turfDistance(tp, turfPoint(this.lastPos)) < this.juncDetectDistChange) {
            return null;
        } 
        this.lastPos = [p[0], p[1]];
        const j = this.jr.isJunction(p);
        if(j) {
            const jKey = `${j[0][0].toFixed(5)},${j[0][1].toFixed(5)}`;
            console.log(`**** JUNCTION **** key=${jKey}`);
            if(this.signposts[jKey]) {
                console.log('This junction already exists - not doing anything else');
                return null; // existing signpost present 
            } else {
                if(options.onStartProcessing) {
                    options.onStartProcessing();
                }
                const nearestPois = this.pois.filter ( poi => {
                    const dist = turfDistance(turfPoint([poi.lon, poi.lat]), tp);
                     return dist <= 3 || (dist <= 5 && poi.properties.amenity === undefined  && poi.properties.place !== 'locality');
                });
                const groupedPois = this.jr.route(
                    j[0],     
                    nearestPois, { 
                        snapToJunction: false, 
                        snapPois: true     
                    } );
                //console.log('**** groupedPOIs: ****');
                //console.log(groupedPois);

                const curPoint = turfPoint(j[0]);
                const signpost = { };
                //console.log(JSON.stringify(Object.keys(j[1])));
                Object.keys(j[1])
                    .filter (k => j[1][k].properties.isAccessiblePath == true)
                    .forEach ( k => {
                        let bearing = Math.round(turfBearing(curPoint,turfPoint(
                            j[1][k].coords[1]
                        )));
                        if(bearing < 0) bearing += 360;
                        signpost[bearing] = { 
                            properties: j[1][k].properties,
                            pois: [ ]
                        };
                });
                groupedPois
                    .filter ( group => signpost[group.bearing] !== undefined)
                    .forEach ( group => {    
                        signpost[group.bearing].pois = group.pois
                            .slice(0)
                            .sort( (a,b) => a.dist * this._getWeighting(a.properties) - b.dist * this._getWeighting(b.properties) );
                });
                console.log('FINAL SIGNPOST (SORTED!)');
                console.log(signpost);
                this.signposts[jKey] = signpost;
                return Object.keys(signpost).length > 0 ? {
                    signpost: signpost, // created a signpost - return it  
                    position: j[0]
                } : null;
            }
        }
        return null; // not a junction
    }

    _getWeighting(tags) {
        if(["city", "town"].indexOf(tags["place"]) >= 0) {
            return 0.75;
        } else if (tags["place"] == "village") {
            return 1.0;
        } else if (tags["natural"] == "peak" && tags["peak"] == "minor") {
            return 2.0;
        } else if (tags["natural"] == "peak") {
            return 1.25;
        } else if (["alpine_hut", "hostel"].indexOf(tags["tourism"]) >= 0) {
            return 1.25;
        } else if (tags["tourism"] == "camp_site") {
            return 1.5;
        } else if (["hamlet", "suburb"].indexOf(tags["place"]) >= 0) {
            return 1.5;
        } else if (["pub", "cafe"].indexOf(tags["amenity"]) >= 0) {
            return 2.0;
        } else if (["restaurant"].indexOf(tags["amenity"]) >= 0) {
            return 3.0;
        } else if (tags["place"]) {
            return 2.0;
        } else if (tags["tourism"] == "viewpoint") {
            return 2.0;
        } else if (tags["railway"] == "station") {
            return 1.25;
        }
        return 10.0; 
    }
}

module.exports = SignpostManager;
