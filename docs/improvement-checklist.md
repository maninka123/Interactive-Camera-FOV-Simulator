# Explorer improvement checklist

Completed **35 of 35** items from the supplied audit on 9 October 2026.

- [x] 1. Complete 2D diagrams in comparison panes and on phones: responsive viewBoxes, with no minimum SVG width.
- [x] 2. Readable wide-angle and telephoto rays: separated sensor, lens and target; relative labels; minimum sensor height. Drawing scales are explicitly schematic.
- [x] 3. Aperture preview without static letterbox bars: correct 9:5 aspect ratio, full image and at least 100 px height in laptop comparison.
- [x] 4. Small-sensor coverage: scale follows the actual geometry; a magnified detail appears when the image circle dwarfs the sensor.
- [x] 5. Full screen includes the header actions and notifications.
- [x] 6. Matching image-circle presets for all ten sensor formats, including 7.8 mm for 1/2.3 inch; incomplete coverage cannot round to 100%.
- [x] 7. All interface light readouts use f/2.8 as their reference.
- [x] 8. One authoritative Camera only / Camera + lens switch, independently maintained for A and B.
- [x] 9. Both configuration-B reset paths restore 50 mm.
- [x] 10. Custom preset selection clears after committed numeric or slider changes, allowing a matching preset to appear again.
- [x] 11. Shared preset names with mismatched dimensions become editable Custom sensors.
- [x] 12. Correct right-handed axes in help and documentation: looking along +Z with +Y up, +X points left.
- [x] 13. The target object is square and uses the same physical scale for width and height.
- [x] 14. Infinite or out-of-view depth of field uses a continuation arrow, without a fictitious far boundary or infinity metres.
- [x] 15. Target explanations, comparison captions and the mobile configuration bar use the current formatted settings.
- [x] 16. Close-focus framing warnings appear directly in the results panel.
- [x] 17. Aperture live announcements use committed settings rather than animation frames.
- [x] 18. Optical rays and depth of field have distinct icons.
- [x] 19. All ten formats are available as overlays, with stable colours independent of selection order.
- [x] 20. SVG filenames include the view and active A/B configuration; exported theme colours and fonts are self-contained.
- [x] 21. Public landing-page source link points to this public repository.
- [x] 22. MIT licence added, as selected by the repository owner.
- [x] 23. The parent project's `.gitignore` excludes `/camera-lens-explorer/`, keeping the standalone repository out of accidental gitlinks.
- [x] 24. 3D bundle reduced by replacing the React Three Fiber/Drei layer with an on-demand native Three.js renderer.
- [x] 25. CSS consolidated around shared palette variables and layout breakpoints; drawing-coordinate attribute selectors removed.
- [x] 26. Pages preparation validates and clears its generated output before copying the new build.
- [x] 27. Image preview darkens regions outside the centred image circle when coverage is incomplete.
- [x] 28. 3D width, height and distance labels have collision-aware placement and leaders; optional near/far depth-of-field planes are available.
- [x] 29. Near, focus, far and hyperfocal values are labelled directly on the depth-of-field chart.
- [x] 30. Blurred aperture background extends beyond the image boundaries.
- [x] 31. Comparison always shows A/B horizontal fields of view and a scene-width difference when both lenses are enabled.
- [x] 32. Results include a depth-of-field card with near/far limits, focus and hyperfocal distance.
- [x] 33. Light/dark themes use the same shared variables across the interface and diagrams; the selected theme persists.
- [x] 34. Shared links restore the active view, with a safe fallback for unknown views.
- [x] 35. Crop factor and diagonal 35 mm equivalent focal length appear in results and exports.

## Validation

- TypeScript type checking and production build passed.
- 30 calculation tests and 20 Playwright browser tests passed.
- Browser checks cover 390 px phones, tablet layouts, laptop workbenches at 1366 x 768 and 1440 x 900, and 1920 x 1080 desktops.
- Responsive checks inspect every diagram text bounding box, extreme-focal-length spacing, square target geometry, full-screen containment, shared state, dark-theme exports, stable overlay colours, 3D label collisions and live-announcement frequency.
- A stale-file sentinel was removed by Pages preparation; exactly one current Frustum bundle remained.
- Production Frustum bundle: **492.45 kB / 123.96 kB gzip**, down from approximately 907 kB / 245 kB gzip (46% / 49% smaller).
- Existing screenshots refreshed to show the updated interface. README text was unchanged.

Optical assumptions and drawing limitations are documented in [optical-models.md](optical-models.md).
