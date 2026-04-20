// Season computation - this is primarily done in JS (writeSeasonUniforms)
// but this shader is available for GPU-side season-dependent logic

struct SeasonUniforms {
  day_of_year: f32,      // 0..1 normalized year progress
  solar_angle: f32,      // -1..1 sun elevation
  day_length: f32,       // fraction of 24h that has light
  base_temp: f32,        // current baseline temperature (C)
  solar_intensity: f32,  // W/m^2 at ground level
  rain_probability: f32, // 0..1 probability of rain events
  _pad0: f32,
  _pad1: f32,
}

// Seasonal progression:
// day_of_year = 0.00 -> Winter solstice (shortest day, coldest)
// day_of_year = 0.25 -> Spring equinox (warming, moderate rain)
// day_of_year = 0.50 -> Summer solstice (longest day, warmest)
// day_of_year = 0.75 -> Autumn equinox (cooling, peak rain)
