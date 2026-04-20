import { GPUContext } from '../gpu/device';
import { createStorageBuffer, createPingPong, createUniformBuffer, readBuffer, writeBuffer, swap, PingPongBuffer } from '../gpu/buffers';
import { writeSimUniforms, writeSeasonUniforms, SIM_UNIFORMS_SIZE, SEASON_UNIFORMS_SIZE } from '../gpu/uniforms';
import { WORLD_WIDTH, WORLD_ATMO_HEIGHT, MAX_PLANTS, WORKGROUP_SIZE, GENOME_LENGTH } from '../config/constants';
import { SimulationConfig } from '../config/defaults';
import { generateTerrain, packTerrainBuffer } from './terrain/generate';
import { createRandomGenome } from './plants/genome';
import { RNG } from '../core/rng';

// Import shaders
import hydrologyShader from './soil/hydrology.wgsl';
import nutrientsShader from './soil/nutrients.wgsl';
import surfaceFlowShader from './water/surface-flow.wgsl';
import advectionShader from './atmosphere/advection.wgsl';
import moistureShader from './atmosphere/moisture.wgsl';
import precipitationShader from './atmosphere/precipitation.wgsl';
import growthShader from './plants/growth.wgsl';
import competitionShader from './plants/competition.wgsl';
import reproductionShader from './plants/reproduction.wgsl';
import deathShader from './plants/death.wgsl';

export class SimManager {
  private device: GPUDevice;
  private config: SimulationConfig;

  // Buffers
  terrainBuffer!: GPUBuffer;
  soilBuffers!: PingPongBuffer;
  waterBuffers!: PingPongBuffer;
  atmoBuffers!: PingPongBuffer;
  plantBuffer!: GPUBuffer;
  detritusBuffer!: GPUBuffer;
  lightFieldBuffer!: GPUBuffer;
  precipBuffer!: GPUBuffer;
  seedBankBuffer!: GPUBuffer;

  // Uniforms
  simUniformBuffer!: GPUBuffer;
  seasonUniformBuffer!: GPUBuffer;

  // Pipelines
  private hydrologyPipeline!: GPUComputePipeline;
  private nutrientsPipeline!: GPUComputePipeline;
  private surfaceFlowPipeline!: GPUComputePipeline;
  private advectionPipeline!: GPUComputePipeline;
  private moisturePipeline!: GPUComputePipeline;
  private precipPipeline!: GPUComputePipeline;
  private growthPipeline!: GPUComputePipeline;
  private competitionPipeline!: GPUComputePipeline;
  private reproductionPipeline!: GPUComputePipeline;
  private deathPipeline!: GPUComputePipeline;

  // Bind groups (recreated on swap)
  private tick = 0;

  constructor(gpu: GPUContext, config: SimulationConfig) {
    this.device = gpu.device;
    this.config = config;
  }

  async init() {
    const device = this.device;
    const w = this.config.worldWidth;
    const h = this.config.atmoHeight;

    // Create buffers
    this.terrainBuffer = createStorageBuffer(device, w * 3 * 4, 'terrain');
    this.soilBuffers = createPingPong(device, w * 18 * 4, 'soil');
    this.waterBuffers = createPingPong(device, w * 2 * 4, 'water');
    this.atmoBuffers = createPingPong(device, w * h * 6 * 4, 'atmo');
    this.plantBuffer = createStorageBuffer(device, MAX_PLANTS * (10 + GENOME_LENGTH) * 4, 'plants');
    this.detritusBuffer = createStorageBuffer(device, w * 4, 'detritus');
    this.lightFieldBuffer = createStorageBuffer(device, w * 4, 'light_field');
    this.precipBuffer = createStorageBuffer(device, w * 4, 'precip');
    this.seedBankBuffer = createStorageBuffer(device, w * 4, 'seed_bank');
    this.simUniformBuffer = createUniformBuffer(device, SIM_UNIFORMS_SIZE, 'sim_uniforms');
    this.seasonUniformBuffer = createUniformBuffer(device, SEASON_UNIFORMS_SIZE, 'season_uniforms');

    // Initialize terrain
    const terrain = generateTerrain(this.config);
    const terrainData = packTerrainBuffer(terrain);
    device.queue.writeBuffer(this.terrainBuffer, 0, terrainData);

    // Initialize soil with some baseline moisture and nutrients
    const soilData = new Float32Array(w * 18);
    for (let x = 0; x < w; x++) {
      for (let layer = 0; layer < 3; layer++) {
        const base = x * 18 + layer * 6;
        soilData[base + 0] = 0.2 + Math.random() * 0.1; // water
        soilData[base + 1] = 0.3 + Math.random() * 0.1; // N
        soilData[base + 2] = 0.2 + Math.random() * 0.05; // P
        soilData[base + 3] = 0.25 + Math.random() * 0.05; // K
        soilData[base + 4] = 0.1; // organic
        soilData[base + 5] = this.config.baseTemperature; // temp
      }
    }
    device.queue.writeBuffer(this.soilBuffers.a, 0, soilData);
    device.queue.writeBuffer(this.soilBuffers.b, 0, soilData);

    // Initialize atmosphere
    const atmoData = new Float32Array(w * h * 6);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 6;
        const heightNorm = y / h;
        atmoData[idx + 0] = this.config.baseTemperature - heightNorm * 20; // temp
        atmoData[idx + 1] = this.config.baseHumidity * (1 - heightNorm * 0.5); // humidity
        atmoData[idx + 2] = (Math.random() - 0.5) * 2; // wind_x
        atmoData[idx + 3] = 0; // wind_y
        atmoData[idx + 4] = 0; // cloud
        atmoData[idx + 5] = 1.0 - heightNorm * 0.3; // pressure
      }
    }
    device.queue.writeBuffer(this.atmoBuffers.a, 0, atmoData);
    device.queue.writeBuffer(this.atmoBuffers.b, 0, atmoData);

    // Initialize plants
    const rng = new RNG(this.config.seed + 1000);
    const plantData = new Float32Array(MAX_PLANTS * (10 + GENOME_LENGTH));
    for (let i = 0; i < this.config.initialPlantCount; i++) {
      const col = Math.floor(rng.range(20, w - 20));
      const genome = createRandomGenome(rng);
      const base = i * (10 + GENOME_LENGTH);
      const view = new Uint32Array(plantData.buffer);
      view[base + 0] = 1; // alive
      view[base + 1] = col; // column
      plantData[base + 2] = 0; // age
      plantData[base + 3] = 0.1; // biomass
      plantData[base + 4] = 0.1; // root_depth
      plantData[base + 5] = 0.2; // height
      plantData[base + 6] = 0.2; // canopy_width
      plantData[base + 7] = 0; // water_stress
      plantData[base + 8] = 0; // nutrient_stress
      plantData[base + 9] = 0; // seed_timer
      for (let g = 0; g < GENOME_LENGTH; g++) {
        plantData[base + 10 + g] = genome[g];
      }
    }
    device.queue.writeBuffer(this.plantBuffer, 0, plantData);

    // Initialize light field (full light)
    const lightData = new Float32Array(w).fill(1.0);
    device.queue.writeBuffer(this.lightFieldBuffer, 0, lightData);

    // Create compute pipelines
    this.advectionPipeline = this.createComputePipeline(advectionShader, 'advection', [
      { type: 'uniform' }, { type: 'uniform' },
      { type: 'read-only-storage' }, { type: 'storage' }, { type: 'read-only-storage' }
    ]);

    this.moisturePipeline = this.createComputePipeline(moistureShader, 'moisture', [
      { type: 'uniform' }, { type: 'uniform' },
      { type: 'storage' }, { type: 'read-only-storage' }
    ]);

    this.precipPipeline = this.createComputePipeline(precipitationShader, 'precipitation', [
      { type: 'uniform' }, { type: 'storage' }, { type: 'storage' }
    ]);

    this.surfaceFlowPipeline = this.createComputePipeline(surfaceFlowShader, 'surface_flow', [
      { type: 'uniform' }, { type: 'read-only-storage' },
      { type: 'read-only-storage' }, { type: 'storage' }, { type: 'read-only-storage' }
    ]);

    this.hydrologyPipeline = this.createComputePipeline(hydrologyShader, 'hydrology', [
      { type: 'uniform' }, { type: 'uniform' },
      { type: 'read-only-storage' }, { type: 'read-only-storage' },
      { type: 'storage' }, { type: 'read-only-storage' }
    ]);

    this.nutrientsPipeline = this.createComputePipeline(nutrientsShader, 'nutrients', [
      { type: 'uniform' }, { type: 'uniform' },
      { type: 'read-only-storage' }, { type: 'storage' }, { type: 'read-only-storage' }
    ]);

    this.competitionPipeline = this.createComputePipeline(competitionShader, 'competition', [
      { type: 'uniform' }, { type: 'read-only-storage' },
      { type: 'storage' }, { type: 'read-only-storage' }
    ]);

    this.growthPipeline = this.createComputePipeline(growthShader, 'growth', [
      { type: 'uniform' }, { type: 'uniform' },
      { type: 'storage' }, { type: 'read-only-storage' }, { type: 'read-only-storage' }
    ]);

    this.deathPipeline = this.createComputePipeline(deathShader, 'death', [
      { type: 'uniform' }, { type: 'storage' }, { type: 'storage' }
    ]);

    this.reproductionPipeline = this.createComputePipeline(reproductionShader, 'reproduction', [
      { type: 'uniform' }, { type: 'uniform' },
      { type: 'storage' }, { type: 'read-only-storage' },
      { type: 'read-only-storage' }, { type: 'storage' }
    ]);
  }

  private createComputePipeline(
    shader: string,
    label: string,
    entries: { type: GPUBufferBindingType }[]
  ): GPUComputePipeline {
    const bindGroupLayout = this.device.createBindGroupLayout({
      label: `${label}_layout`,
      entries: entries.map((e, i) => ({
        binding: i,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: e.type },
      })),
    });

    const pipelineLayout = this.device.createPipelineLayout({
      label: `${label}_pipeline_layout`,
      bindGroupLayouts: [bindGroupLayout],
    });

    return this.device.createComputePipeline({
      label: `${label}_pipeline`,
      layout: pipelineLayout,
      compute: {
        module: this.device.createShaderModule({ code: shader, label: `${label}_shader` }),
        entryPoint: 'main',
      },
    });
  }

  private createBindGroup(pipeline: GPUComputePipeline, buffers: GPUBuffer[]): GPUBindGroup {
    return this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: buffers.map((buffer, i) => ({
        binding: i,
        resource: { buffer },
      })),
    });
  }

  step() {
    const w = this.config.worldWidth;
    const h = this.config.atmoHeight;

    // Update uniforms
    writeSimUniforms(this.device, this.simUniformBuffer, this.tick, this.config.seed);
    writeSeasonUniforms(
      this.device, this.seasonUniformBuffer, this.tick,
      this.config.yearDurationTicks, this.config.baseTemperature, this.config.temperatureAmplitude
    );

    const encoder = this.device.createCommandEncoder({ label: 'sim_step' });

    // 1. Atmosphere advection
    {
      const pass = encoder.beginComputePass({ label: 'advection' });
      pass.setPipeline(this.advectionPipeline);
      pass.setBindGroup(0, this.createBindGroup(this.advectionPipeline, [
        this.simUniformBuffer, this.seasonUniformBuffer,
        readBuffer(this.atmoBuffers), writeBuffer(this.atmoBuffers),
        this.terrainBuffer,
      ]));
      pass.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8));
      pass.end();
    }

    // Swap atmo
    swap(this.atmoBuffers);

    // 2. Atmosphere moisture (in-place on current atmo buffer)
    {
      const pass = encoder.beginComputePass({ label: 'moisture' });
      pass.setPipeline(this.moisturePipeline);
      pass.setBindGroup(0, this.createBindGroup(this.moisturePipeline, [
        this.simUniformBuffer, this.seasonUniformBuffer,
        readBuffer(this.atmoBuffers), readBuffer(this.waterBuffers),
      ]));
      pass.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8));
      pass.end();
    }

    // 3. Precipitation
    {
      const pass = encoder.beginComputePass({ label: 'precipitation' });
      pass.setPipeline(this.precipPipeline);
      pass.setBindGroup(0, this.createBindGroup(this.precipPipeline, [
        this.simUniformBuffer,
        readBuffer(this.atmoBuffers),
        this.precipBuffer,
      ]));
      pass.dispatchWorkgroups(Math.ceil(w / WORKGROUP_SIZE));
      pass.end();
    }

    // 4. Surface water flow
    {
      const pass = encoder.beginComputePass({ label: 'surface_flow' });
      pass.setPipeline(this.surfaceFlowPipeline);
      pass.setBindGroup(0, this.createBindGroup(this.surfaceFlowPipeline, [
        this.simUniformBuffer, this.terrainBuffer,
        readBuffer(this.waterBuffers), writeBuffer(this.waterBuffers),
        this.precipBuffer,
      ]));
      pass.dispatchWorkgroups(Math.ceil(w / WORKGROUP_SIZE));
      pass.end();
    }
    swap(this.waterBuffers);

    // 5. Soil hydrology
    {
      const pass = encoder.beginComputePass({ label: 'hydrology' });
      pass.setPipeline(this.hydrologyPipeline);
      pass.setBindGroup(0, this.createBindGroup(this.hydrologyPipeline, [
        this.simUniformBuffer, this.seasonUniformBuffer,
        this.terrainBuffer, readBuffer(this.soilBuffers),
        writeBuffer(this.soilBuffers), readBuffer(this.waterBuffers),
      ]));
      pass.dispatchWorkgroups(Math.ceil(w / WORKGROUP_SIZE));
      pass.end();
    }
    swap(this.soilBuffers);

    // 6. Soil nutrients
    {
      const pass = encoder.beginComputePass({ label: 'nutrients' });
      pass.setPipeline(this.nutrientsPipeline);
      pass.setBindGroup(0, this.createBindGroup(this.nutrientsPipeline, [
        this.simUniformBuffer, this.seasonUniformBuffer,
        readBuffer(this.soilBuffers), writeBuffer(this.soilBuffers),
        this.detritusBuffer,
      ]));
      pass.dispatchWorkgroups(Math.ceil(w / WORKGROUP_SIZE));
      pass.end();
    }
    swap(this.soilBuffers);

    // 7. Plant competition (builds light field)
    {
      const pass = encoder.beginComputePass({ label: 'competition' });
      pass.setPipeline(this.competitionPipeline);
      pass.setBindGroup(0, this.createBindGroup(this.competitionPipeline, [
        this.simUniformBuffer, this.plantBuffer,
        this.lightFieldBuffer, readBuffer(this.atmoBuffers),
      ]));
      pass.dispatchWorkgroups(Math.ceil(w / WORKGROUP_SIZE));
      pass.end();
    }

    // 8. Plant growth
    {
      const pass = encoder.beginComputePass({ label: 'growth' });
      pass.setPipeline(this.growthPipeline);
      pass.setBindGroup(0, this.createBindGroup(this.growthPipeline, [
        this.simUniformBuffer, this.seasonUniformBuffer,
        this.plantBuffer, readBuffer(this.soilBuffers), this.lightFieldBuffer,
      ]));
      pass.dispatchWorkgroups(Math.ceil(MAX_PLANTS / WORKGROUP_SIZE));
      pass.end();
    }

    // 9. Plant death
    {
      const pass = encoder.beginComputePass({ label: 'death' });
      pass.setPipeline(this.deathPipeline);
      pass.setBindGroup(0, this.createBindGroup(this.deathPipeline, [
        this.simUniformBuffer, this.plantBuffer, this.detritusBuffer,
      ]));
      pass.dispatchWorkgroups(Math.ceil(MAX_PLANTS / WORKGROUP_SIZE));
      pass.end();
    }

    // 10. Plant reproduction
    {
      const pass = encoder.beginComputePass({ label: 'reproduction' });
      pass.setPipeline(this.reproductionPipeline);
      pass.setBindGroup(0, this.createBindGroup(this.reproductionPipeline, [
        this.simUniformBuffer, this.seasonUniformBuffer,
        this.plantBuffer, readBuffer(this.soilBuffers),
        readBuffer(this.atmoBuffers), this.seedBankBuffer,
      ]));
      pass.dispatchWorkgroups(Math.ceil(MAX_PLANTS / WORKGROUP_SIZE));
      pass.end();
    }

    this.device.queue.submit([encoder.finish()]);
    this.tick++;
  }

  getTick(): number {
    return this.tick;
  }

  reset() {
    this.tick = 0;
  }
}
