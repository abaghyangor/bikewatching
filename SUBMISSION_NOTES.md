# Lab 7 submission notes

## Short demo outline

1. Show the Boston and Cambridge bike-lane map and zoom or pan it.
2. Point out that every circle is a Bluebike station and that circle area uses a
   square-root scale to represent total arrivals plus departures.
3. Hover or focus a circle to show its station name and trip counts.
4. Move the time slider from **Any time** to a specific time. The map updates to
   trips within one hour before or after that time.
5. Explain the color legend: blue means more departures, orange means more
   arrivals, and the middle color means the station is roughly balanced.

## Interesting things I learned

- Geographic coordinates cannot be placed directly in an SVG. The map's
  projection converts longitude and latitude into screen coordinates, and those
  coordinates must be recalculated whenever the map moves or zooms.
- A square-root radius scale makes circle *area* proportional to traffic. Using a
  linear radius would visually exaggerate busy stations because circle area grows
  with the square of the radius.
- Grouping rides into minute buckets once makes the time slider much faster than
  scanning the full trip dataset on every input event.
- Comparing departures with arrivals adds a second data dimension without adding
  another chart: marker size shows traffic volume while color shows direction.
