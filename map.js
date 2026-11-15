import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const params = new URLSearchParams(window.location.search);
const mapboxToken = params.get('mapbox_token');
const mapEngineUrl = mapboxToken
  ? 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm'
  : 'https://cdn.jsdelivr.net/npm/maplibre-gl@5.6.2/+esm';
const { default: mapboxgl } = await import(mapEngineUrl);

if (mapboxToken) mapboxgl.accessToken = mapboxToken;

const STATIONS_URL = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
const TRIPS_URL = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
const BOSTON_LANES_URL =
  'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?outSR=%7B%22latestWkid%22%3A3857%2C%22wkid%22%3A102100%7D';
const CAMBRIDGE_LANES_URL =
  'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson';

const departuresByMinute = Array.from({ length: 1440 }, () => []);
const arrivalsByMinute = Array.from({ length: 1440 }, () => []);
const svg = d3.select('#map').select('svg');
const status = document.getElementById('map-status');
const timeSlider = document.getElementById('time-slider');
const selectedTime = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time');
const stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

let circles = svg.selectAll('circle');
let stations = [];
let radiusScale;

const map = new mapboxgl.Map({
  container: 'map-canvas',
  style: mapboxToken
    ? 'mapbox://styles/mapbox/streets-v12'
    : 'https://tiles.openfreemap.org/styles/liberty',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function formatTime(minutes) {
  const normalizedMinutes = minutes % 1440;
  const date = new Date(0, 0, 0, 0, normalizedMinutes);
  return date.toLocaleString('en-US', { timeStyle: 'short' });
}

function filterByMinute(tripsByMinute, minute) {
  if (minute === -1) return tripsByMinute.flat();

  const trips = [];
  for (let offset = -60; offset <= 60; offset += 1) {
    const index = (minute + offset + 1440) % 1440;
    trips.push(...tripsByMinute[index]);
  }
  return trips;
}

function computeStationTraffic(stationData, timeFilter = -1) {
  const departures = d3.rollup(
    filterByMinute(departuresByMinute, timeFilter),
    (trips) => trips.length,
    (trip) => trip.start_station_id,
  );
  const arrivals = d3.rollup(
    filterByMinute(arrivalsByMinute, timeFilter),
    (trips) => trips.length,
    (trip) => trip.end_station_id,
  );

  return stationData.map((station) => {
    const id = station.short_name;
    station.arrivals = arrivals.get(id) ?? 0;
    station.departures = departures.get(id) ?? 0;
    station.totalTraffic = station.arrivals + station.departures;
    return station;
  });
}

function getCoords(station) {
  const point = new mapboxgl.LngLat(Number(station.lon), Number(station.lat));
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

function updatePositions() {
  circles
    .attr('cx', (station) => getCoords(station).cx)
    .attr('cy', (station) => getCoords(station).cy);
}

function updateCircleTitles(selection) {
  selection.select('title').text(
    (station) =>
      `${station.name}: ${station.totalTraffic.toLocaleString()} trips ` +
      `(${station.departures.toLocaleString()} departures, ` +
      `${station.arrivals.toLocaleString()} arrivals)`,
  );
}

function updateScatterPlot(timeFilter) {
  const filteredStations = computeStationTraffic(stations, timeFilter);
  radiusScale.range(timeFilter === -1 ? [0, 25] : [3, 50]);

  circles = circles
    .data(filteredStations, (station) => station.short_name)
    .join('circle')
    .attr('class', 'station')
    .attr('r', (station) => radiusScale(station.totalTraffic))
    .attr('tabindex', 0)
    .attr('aria-label', (station) => `${station.name}, ${station.totalTraffic} trips`)
    .style('--departure-ratio', (station) =>
      station.totalTraffic
        ? stationFlow(station.departures / station.totalTraffic)
        : 0.5,
    );

  circles.selectAll('title').remove();
  circles.append('title');
  updateCircleTitles(circles);
  updatePositions();
}

function updateTimeDisplay() {
  const timeFilter = Number(timeSlider.value);

  if (timeFilter === -1) {
    selectedTime.textContent = '';
    anyTimeLabel.hidden = false;
  } else {
    selectedTime.textContent = formatTime(timeFilter);
    anyTimeLabel.hidden = true;
  }

  updateScatterPlot(timeFilter);
}

function addBikeLaneLayers() {
  const lanePaint = {
    'line-color': '#21a366',
    'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 16, 6],
    'line-opacity': 0.65,
  };

  map.addSource('boston-routes', {
    type: 'geojson',
    data: BOSTON_LANES_URL,
  });
  map.addLayer({
    id: 'boston-bike-lanes',
    type: 'line',
    source: 'boston-routes',
    paint: lanePaint,
  });

  map.addSource('cambridge-routes', {
    type: 'geojson',
    data: CAMBRIDGE_LANES_URL,
  });
  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge-routes',
    paint: lanePaint,
  });
}

map.on('load', async () => {
  try {
    addBikeLaneLayers();
    status.textContent = 'Loading 260,000 Bluebike trips...';

    const [stationJson] = await Promise.all([
      d3.json(STATIONS_URL),
      d3.csv(TRIPS_URL, (trip) => {
        trip.started_at = new Date(trip.started_at);
        trip.ended_at = new Date(trip.ended_at);
        departuresByMinute[minutesSinceMidnight(trip.started_at)].push(trip);
        arrivalsByMinute[minutesSinceMidnight(trip.ended_at)].push(trip);
        return trip;
      }),
    ]);

    stations = computeStationTraffic(stationJson.data.stations);
    radiusScale = d3
      .scaleSqrt()
      .domain([0, d3.max(stations, (station) => station.totalTraffic)])
      .range([0, 25]);

    circles = svg
      .selectAll('circle')
      .data(stations, (station) => station.short_name)
      .join('circle')
      .attr('class', 'station');

    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);
    map.on('moveend', updatePositions);

    timeSlider.disabled = false;
    timeSlider.addEventListener('input', updateTimeDisplay);
    updateTimeDisplay();
    status.hidden = true;
  } catch (error) {
    console.error('Unable to load bike data:', error);
    status.textContent = 'Unable to load bike data. Please refresh and try again.';
  }
});
