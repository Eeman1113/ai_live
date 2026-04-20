# ai_live

A vertical slice of a living ecosystem. Watch grass grow from seed, push roots through soil, and spread across terrain — all in your browser.

Built on top of [Little Guys](https://github.com/crow-fisher/little-guys) by crow-fisher, an incredible ecosystem simulator with real plant growth, soil physics, water dynamics, and weather. This fork focuses the experience into an auto-generating vertical cross-section view: open it and you immediately see terrain, soil layers, roots, and grass growing automatically.

---

## What you see

When you open the app, a terrain cross-section is auto-generated with:

- **Soil layers** — topsoil, subsoil, and bedrock with varying composition (sand/silt/clay)
- **Rock formations** — increasing density with depth
- **Grass** — seeds are scattered across the surface and sprout automatically
- **Roots** — visible growing downward through the soil cross-section
- **Water** — small puddles form in terrain depressions
- **Weather** — clouds, rain, wind, and day/night cycles all run in the background

The simulation runs continuously. Grass grows, reproduces, competes for light, and evolves over generations.

---

## Running locally

```bash
git clone <this-repo>
cd ecosystem-sim
npm install
npx vite
```

Open the URL shown in your terminal. Works in any modern browser (no WebGPU required — uses Canvas 2D).

---

## Controls

- Click and interact with the world using the toolbar (press top-left menu to show)
- All the original Little Guys controls work — place soil, water, seeds manually
- The vertical cross-section view is the default on first load

---

## Credits

This project is built on top of **[Little Guys](https://github.com/crow-fisher/little-guys)** by **crow-fisher**. The core simulation engine, plant growth system, soil physics, water dynamics, climate system, lighting, and rendering are all from Little Guys. This fork adds:

- Auto-generated terrain on first load (rolling hills with soil layers and bedrock)
- Auto-planted grass seeds that grow immediately
- Vertical cross-section (Normal view) as the default view mode
- Clean startup with hidden toolbars for an immersive view

All credit for the simulation, plant biology, growth planning, rendering, and UI systems goes to the original Little Guys project.

---

## License

See the original [Little Guys](https://github.com/crow-fisher/little-guys) repository for license information.
