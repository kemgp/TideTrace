# ReactBits sources

GradientWaves, RotatingText, and SpotlightCard are vendored from the official
https://github.com/DavidHDev/react-bits/tree/main/src/content sources, retrieved
2026-10-16. See LICENSE.md for upstream terms.

Local changes: RotatingText imports from the equivalent framer-motion package;
styles are scoped to .tt-home; SpotlightCard skips browser observers when unavailable.

StrokeText and MetaBalls are custom React implementations of the supplied reference's
headline and two-color scalar-field effect. Noise uses the reference's static SVG
texture. Scroll reveals use IntersectionObserver with cleanup.

Impact totals use the existing live community-summary hook, including loading, error, and retry states.
