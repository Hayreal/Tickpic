# Black Window Shell Design

## Goal

Remove the light outer canvas and card-style frame so the app content becomes the actual Electron window boundary, then simplify the UI to a black-first shell with a lightly separated sidebar.

## Scope

- Change the Electron window background color to a dark value to avoid light flashes or edges.
- Replace the `WindowFrame` outer beige background and rounded card shell with a full-window dark container.
- Restyle the left sidebar to a darker segmented panel while keeping a subtle separation from the main workspace.
- Keep the existing feature layouts and interactions intact.

## Visual Direction

- Overall shell: near-black background.
- Sidebar: slightly lighter black/charcoal than the content area.
- Dividers: thin, low-contrast dark gray borders.
- Remove the current cream background, blur blobs, frosted-card border, and oversized rounded outer frame.

## Notes

- This is a focused shell/theme correction, not a product redesign.
- Existing purple accents can remain where they communicate selection or actions; the main change is removing the light outer frame and simplifying the shell to black.
