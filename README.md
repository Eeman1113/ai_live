# ai_live

A tiny world that runs itself.

This is a browser-based ecosystem simulator where dirt, water, air, and plants all talk to each other on your GPU at 20 ticks per second. You press play, hand it a random seed, and watch an entire basin develop weather patterns, grow forests, evolve species, and cycle nutrients — without a single hardcoded biome or scripted event.

Everything emerges. Clouds form because humidity hits a cold pocket. Rain falls because clouds get too heavy. Soil darkens because water seeps in. Plants grow toward light and dig roots toward moisture. They reproduce by dropping seeds into the wind. They die when the drought outlasts their tolerance. Their corpses feed the next generation.

I built this because I wanted to see natural selection happen in real time in a browser tab.

**Live demo:** https://eeman1113.github.io/ai_live/

(Requires Chrome 113+ or any browser with WebGPU. If yours doesn't have it, the page will tell you nicely.)

---

## What's actually happening

The simulation runs 10 interleaved GPU compute passes every tick:

1. Wind and heat move through the atmosphere (semi-Lagrangian advection)
2. Humidity condenses into clouds when the air can't hold it anymore
3. Clouds drop rain when they get thick enough and updrafts weaken
4. Surface water flows downhill across the terrain
5. Water infiltrates soil, drains between layers, diffuses laterally
6. Dead plant matter decomposes into mineral nutrients (faster when warm and wet)
7. Plants compete for light — tallest canopy wins, understory gets shade
8. Each plant photosynthesizes, respires, and allocates carbon to height/roots/leaves
9. Stressed or old plants die and dump biomass into the detritus pool
10. Surviving plants scatter seeds on the wind, offspring inherit mutated genomes

Every plant carries a 16-float genome encoding traits like growth rate, root depth bias, drought tolerance, shade tolerance, seed dispersal distance, and max height. Mutation is a small Gaussian perturbation each generation. There are no species labels — "species" are just clusters of similar genomes that emerge from reproductive isolation by distance and habitat.

The rendering pipeline draws terrain cross-sections with moisture-darkened soil, semi-transparent surface water, instanced plant billboards colored by their genome, ray-marched clouds, and volumetric god rays. It runs at whatever frame rate your GPU can push, decoupled from the fixed-rate simulation.

---

## Running locally

```bash
git clone https://github.com/Eeman1113/ai_live.git
cd ai_live
npm install
npm run dev
```

Open `localhost:5173` in Chrome. That's it.

---

## Controls

- **Space** — pause / unpause
- **D** — toggle debug overlay panel
- Speed buttons in the top-left: pause, 0.25x, 1x, 4x, 16x
- **Reseed** — blow everything up and start a new world from a different random seed

The info panel on the right shows temperature, solar angle, day length, and what year you're in. Debug overlays let you visualize soil moisture, cloud density, wind, light availability, and nutrients as colored heatmaps.

---

## The tech

- **WebGPU** for everything — compute shaders run the physics, render pipelines draw the scene, no fallback
- **Vite + TypeScript + React** for the app shell and UI chrome
- **WGSL shaders** for all simulation kernels and render passes
- **Deterministic PRNG** (xoshiro128**) — same seed, same world, same history
- **Three clocks** — simulation at fixed 20Hz, rendering at variable refresh, UI updates at 8Hz
- **Ping-pong buffers** for all grid state so compute shaders never read what they just wrote
- **Zero runtime dependencies** beyond React

The whole thing is about 265KB bundled. No Three.js, no Babylon, no physics engine. Just raw WebGPU and math.

---

## Architecture at a glance

```
src/
  config/       Constants and tunable parameters
  core/         RNG, clock manager, main loop, shared types
  gpu/          WebGPU device init, buffer factory, uniform writers
  sim/
    terrain/    Procedural basin heightmap generation
    soil/       Hydrology + nutrient cycling compute shaders
    water/      Surface runoff and pooling
    atmosphere/ Wind, temperature, humidity, clouds, rain
    plants/     Growth, competition, reproduction, death
    season/     Solar forcing and seasonal progression
  render/
    passes/     Terrain, water, plant, atmosphere, volumetric light shaders
    shared/     Noise functions, fullscreen quad utility
  ui/           React components, hooks, debug overlays
  utils/        Math and color helpers
```

---

## Things I think are cool about this

- Clouds form and dissipate based on actual thermodynamics (well, simplified thermodynamics, but still)
- Plants literally evolve — leave it running for 50 in-sim years and the population genome drifts measurably toward whatever the local conditions select for
- The water table rises and falls realistically based on rainfall vs drainage
- Dead plants turn into soil nutrients on a temperature/moisture-dependent schedule, which feeds the next generation of plants that killed the previous one by shading them out
- Wind carries seeds further when it's blowing hard, and heavier seeds go less far — so there's actually selective pressure on dispersal strategy
- Every single bit of this is deterministic from one integer seed

---

## What's not done yet (phase 2 someday)

- Fire propagation
- Advanced erosion and sediment transport
- Fungi/decomposer visualization
- Mobile fauna
- Save/load world state
- Local storage replay from seed + tick count

---

## License

Do whatever you want with it. MIT if you need a name for that.
