// Optical format names are historical labels, never physical inch measurements.
// Sources and preset limitations are documented in docs/optical-models.md.
export const SENSORS = [
  { name: '1/4"', width: 3.2, height: 2.4, pixelsX: 1600, pixelsY: 1200 },
  { name: '1/3"', width: 4.8, height: 3.6, pixelsX: 1920, pixelsY: 1440 },
  { name: '1/2.8"', width: 5.568, height: 3.132, pixelsX: 1920, pixelsY: 1080 },
  { name: '1/2.3"', width: 6.2, height: 4.7, pixelsX: 4000, pixelsY: 3000 },
  { name: '1/1.8"', width: 7.2, height: 5.4, pixelsX: 2560, pixelsY: 1920 },
  { name: '2/3"', width: 8.8, height: 6.6, pixelsX: 2560, pixelsY: 1920 },
  { name: '1"', width: 13.2, height: 8.8, pixelsX: 5472, pixelsY: 3648 },
  {
    name: "Micro Four Thirds",
    width: 17.3,
    height: 13,
    pixelsX: 5184,
    pixelsY: 3888,
  },
  { name: "APS-C", width: 23.5, height: 15.6, pixelsX: 6000, pixelsY: 4000 },
  { name: "Full Frame", width: 36, height: 24, pixelsX: 6000, pixelsY: 4000 },
];
export const FOCALS = [2.1, 2.8, 3.5, 4, 6, 8, 12, 16, 25, 35, 50, 85, 100];
export const APERTURES = [1, 1.2, 1.4, 1.8, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
export const OVERLAY_COLORS = [
  "#9964b9",
  "#c48b20",
  "#15959b",
  "#5a80ac",
  "#c65791",
  "#559243",
  "#bf6844",
  "#7560c1",
  "#327e95",
  "#8b6b3f",
];
export const CIRCLES = [
  { name: '1/4" equivalent', value: 4 },
  { name: '1/3" equivalent', value: 6 },
  { name: '1/2.8" equivalent', value: 6.4 },

  { name: '1/2.3" equivalent', value: 7.8 },
  { name: '1/1.8" equivalent', value: 9 },
  { name: '2/3" equivalent', value: 11 },
  { name: '1" equivalent', value: 16 },
  { name: "Micro Four Thirds equivalent", value: 22 },
  { name: "APS-C equivalent", value: 29 },
  { name: "Full Frame equivalent", value: 44 },
];
