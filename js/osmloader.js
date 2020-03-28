const OsmWay = require('./osmway');

class OsmLoader {
    constructor(system) {
        this.system = system;
        this.drawProps = { 'footway' : {  color:'#00ff00', width: 5 },
             'path' : {  color: '#00ff00', width: 5 },
             'steps' : { color: '#00ff00', width: 5 },
             'bridleway' : {  color: '#ffc000', width: 5 },
             'byway' : { color: '#ff0000', width: 10 },
            'track' :  { color: '#ff8080', width: 10 },
            'cycleway' : { color: '#00ffff', width: 5 },
            'residential' : { width: 10 },
            'unclassified' : { width: 15 },
            'tertiary' :  { width: 15 },
            'secondary' : { width: 20 },
            'primary' : { width : 30 },
            'trunk' : { width: 30 },
            'motorway' : { width: 60 }
        };
    }

    loadOsm(osmData, tileid, dem=null) {
        const features = [];
        osmData.features.forEach  ( (f,i)=> {
            const line = [];
            if(f.geometry.type=='LineString' && f.geometry.coordinates.length >= 2) {
                f.geometry.coordinates.forEach (coord=> {
            
                        const h = 
                            dem? dem.getHeight(coord[0], coord[1]) + 4: 0;
                       line.push([coord[0], h, -coord[1]]);
               });
                    
                
                const g = this.makeWayGeom(line,     
                       
                        (this.drawProps[f.properties.highway] ? 
                            (this.drawProps[f.properties.highway].width || 5) :
                         5));

               const color = this.drawProps[f.properties.highway] ?
                    (this.drawProps[f.properties.highway].color||'#ffffff'):
                    '#ffffff';
               features.push({
                    geometry: g, 
                    properties: {
                        id: `${tileid}:${f.properties.osm_id}`,
                        color: color
                    }
               }); 

            }  
        }); 
        return features;
    }

    makeWayGeom(vertices, width=1) {
        return new OsmWay(vertices, width).geometry;
    }
}

module.exports = OsmLoader;