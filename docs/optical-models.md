# Models, units and preset sources

All views use `src/lib/optics.ts`. Sensor dimensions, focal length, image circle, entrance pupil and circle of confusion are in **mm**. Target/focus distances and object widths are in **m**. Displayed angles are in **degrees**; pixel pitches use **µm**.

## Nominal field of view

For sensor dimension `q` and focal length `f`, `θ = 2 atan(q / (2f))`. Horizontal and vertical angles use width/height; diagonal FOV uses `sqrt(width² + height²)`. A perpendicular target plane at distance `d` has width `d × width / f` and height `d × height / f`. This rectilinear, infinity-focus approximation excludes distortion and focus breathing. See [Edmund Optics’ imaging parameter calculator](https://www.edmundoptics.com/knowledge-center/tech-tools/imaging-system-parameter-calculator/).

The ray diagram uses separate distance scales for the sensor and scene while preserving the boundary-ray slopes. The 3D observer can orbit independently of the simulated camera. Its coordinate axes are +X right, +Y up, +Z forward. The scene is scaled uniformly to fit the observer view.

For finite thin-lens focus at `s`, image distance is `v = fs / (s − f)`. A notice appears when `v/f > 1.05`; nominal FOV is still based on `f`. The focus distance must exceed `f`.

## Centred image-circle intersection

Let `r = imageCircle/2`, `a = min(width/2, r)`, `b = height/2`, and `x₀ = min(a, sqrt(max(0, r²−b²)))`. With `F(x) = [x sqrt(r²−x²) + r² asin(x/r)]/2`, the covered area is `4[b x₀ + F(a) − F(x₀)]`. Fully contained rectangles and disks use their exact areas directly. Coverage divides this intersection by sensor area.

Status labels are geometric: **fully covered** when diameter reaches the sensor diagonal; **partially covered** below that but at least the shorter sensor dimension; **insufficient coverage** when the disk diameter is smaller than both dimensions. These labels do not predict lens quality. Image-circle presets are illustrative diameters, not measured specifications for all lenses of a nominal format. See [Sunex’s image-circle explanation](https://sunex.com/2026/03/26/image-circle-and-sensor-format/).

## Aperture

Entrance pupil diameter is `f/N`, area is `π(f/(2N))²`, and relative irradiance versus f/1 is `1/N²` under equal exposure and transmission. Ratios between f-numbers use their inverse squares. Rounded full-stop labels are approximate. The illustrated iris uses a regular polygon; it is not a mechanical simulation, and its area does not replace the circular entrance-pupil calculation. F-number is geometric; T-stop includes transmission losses. No aperture change modifies nominal FOV.

## Pixel sampling

Physical pitch is `1000 × sensor dimension / physical pixel count`. For scaled output resolution, physical pitch is unavailable. Mean angular sampling is `FOV / pixel count`; central angular sampling is `2 atan(sensor width/(2f × horizontal pixels))`. These differ because rectilinear angular sampling is nonuniform.

Target-plane sampling is `pixels / scene dimension`. Object projection is `object width × horizontal pixels / scene width`, assuming a centred object on the target plane. An object larger than the frame has an unclipped projection larger than the pixel array. These quantities measure sampling, not actual optical resolving power.

## Thin-lens depth of field

For aperture `N`, blur criterion `c` and focus distance `s` in mm, let `K = f²/(Nc)` and `H = K + f`. Near focus is `Ks/(K+s−f)`; far focus is `Ks/(K−s+f)` if `s < H`, otherwise infinity. This educational model neglects pupil magnification, aberrations and diffraction; acceptable sharpness depends on the chosen criterion. The app keeps circle of confusion explicit rather than silently selecting it from format. Exports encode unbounded values as `"Infinity"` in JSON and `Infinity` in CSV.

## Fixed-scene preview

Every scene vertex projects as `x = fX/Z`, `y = f(Y−1.6)/Z`, with a fixed camera height of 1.6 m. Sensor dimensions map these coordinates to the frame without stretching. Buildings, trees and people have fixed world positions at several depths. Sky/ground are procedural, with no limited source photograph. Target-distance settings describe the separate measurement plane; they do not move the preview camera or its scene. The reference frame is 36 × 24 mm at 35 mm. No exposure, blur, distortion or image-circle masking is simulated in the preview; use the coverage view to inspect compatibility.

## Sensor presets

Inch names are optical-format labels, never literal physical dimensions. Active dimensions vary with manufacturer, pixel array and crop. The presets are representative and may be overridden; resolution values are editable examples rather than guaranteed specifications for a format. Some example arrays imply slightly nonsquare pixels, which is why horizontal and vertical pitches are shown separately.

| Format            | Active width × height (mm) | Reference                                                                                                                                           |
| ----------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1/4"              | 3.2 × 2.4                  | [Edmund Optics sensor chart](https://www.edmundoptics.com/media/lyhnwjrw/cameras-1v3.svg)                                                           |
| 1/3"              | 4.8 × 3.6                  | Edmund Optics chart above                                                                                                                           |
| 1/2.8"            | 5.568 × 3.132              | [Sony IMX290](https://www.sony-semicon.com/files/62/flyer_security/IMX290_178_226_Flyer.pdf): 1920 × 1080 recording region at 2.9 µm                |
| 1/2.3"            | 6.2 × 4.7                  | [Entaniya sensor dimensions](https://products.entaniya.co.jp/en/full-circle-fisheye-image/) (dimensions only; this app uses rectilinear projection) |
| 1/1.8"            | 7.2 × 5.4                  | Edmund Optics chart above                                                                                                                           |
| 2/3"              | 8.8 × 6.6                  | Edmund Optics chart above                                                                                                                           |
| 1"                | 13.2 × 8.8                 | [Sony RX100 specifications](https://www.sony.com/electronics/support/compact-cameras-dsc-rx-series/dsc-rx100/specifications)                        |
| Micro Four Thirds | 17.3 × 13.0                | [Official LUMIX GH7 specifications](https://www.four-thirds.org/en/body/lumix-gh7/)                                                                 |
| APS-C             | 23.5 × 15.6                | [Nikon D3500 specifications](https://www.nikonusa.com/p/d3500/D3500/overview)                                                                       |
| Full Frame        | 36 × 24                    | [Nikon format explanation](https://www.nikonusa.com/learn-and-explore/c/tips-and-techniques/dx-nikkor-lenses)                                       |

For the historical naming convention and sensor-size caveats, see [Edmund Optics’ camera guide](https://www.edmundoptics.com/knowledge-center/application-notes/imaging/camera-types-and-interfaces-for-machine-vision-applications/).
