const Terrarium = require('./terrarium');
const OSM3D = require('./osm3d');

let terrarium, osm3d;

window.onload = function() {
    let lastTime = 0;
    let first = true;

    const parts = window.location.href.split('?');     
    const get = {  };     

    if(parts.length==2) {         
        if(parts[1].endsWith('#')) {             
            parts[1] = parts[1].slice(0, -1);         
        }         
        var params = parts[1].split('&');         
        for(var i=0; i<params.length; i++) {   
            var param = params[i].split('=');             
            get[param[0]] = param[1];         
        }     
    }    

    terrarium = new Terrarium({
        url: 'proxy.php?x={x}&y={y}&z={z}',
        zoom: 13
    });
    osm3d = new OSM3D('https://hikar.org/fm/ws/tsvr.php?x={x}&y={y}&z={z}&way=highway');
    if(get.lat && get.lon) {
        getData(parseFloat(get.lon), parseFloat(get.lat), true);
    } else {
        window.addEventListener('gps-camera-update-position', async(e)=> {
            const curTime = new Date().getTime();
            if(first==true && curTime - lastTime > 10000) {
                lastTime = curTime;
                first = false;
                getData(e.detail.position.longitude, e.detail.position.latitude);
            }
        });
    }
}

async function getData(lon, lat, simulated=false) {
    const results = await terrarium.setPosition(lon, lat);
    const camera = document.querySelector("a-camera");
    const position = camera.getAttribute("position");
    position.y = results.elevation;
    console.log(`ELEVATION: ${results.elevation}`);
    first = false;
    if(simulated) {
        camera.setAttribute('gps-projected-camera', {
            simulateLatitude: lat,
            simulateLongitude: lon
        });
    }
    camera.setAttribute("position", position);
    const osmResults = await osm3d.loadDem(results.demData);
    window.dispatchEvent(new CustomEvent('vector-ways-loaded', { detail: { features: osmResults } } ));
}
