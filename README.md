# Bikewatching

An interactive Mapbox and D3 visualization of Boston and Cambridge bike lanes,
Bluebike station traffic, and arrival/departure patterns from March 2024.

Serve this directory over HTTP rather than opening `index.html` directly:

```sh
python3 -m http.server 4173
```

The project uses MapLibre GL JS with a token-free OpenFreeMap basemap by default.
To use the lab's Mapbox GL JS setup and Mapbox Streets instead, add
`?mapbox_token=YOUR_PUBLIC_TOKEN` to the page URL.
