import { GPUContext } from '../gpu/device';
import { SimManager } from '../sim/sim-manager';
import { WORLD_WIDTH, MAX_PLANTS } from '../config/constants';
import { readBuffer } from '../gpu/buffers';

import terrainShader from './passes/terrain.wgsl';
import waterShader from './passes/water.wgsl';
import plantShader from './passes/plants.wgsl';
import atmosphereShader from './passes/atmosphere.wgsl';
import lightShader from './passes/light.wgsl';

interface RenderUniforms {
  viewOffsetX: number;
  viewOffsetY: number;
  viewScaleX: number;
  viewScaleY: number;
  worldWidth: number;
  time: number;
}

export class Renderer {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private format: GPUTextureFormat;
  private sim: SimManager;

  private terrainPipeline!: GPURenderPipeline;
  private waterPipeline!: GPURenderPipeline;
  private plantPipeline!: GPURenderPipeline;
  private atmoPipeline!: GPURenderPipeline;
  private lightPipeline!: GPURenderPipeline;

  private renderUniformBuffer!: GPUBuffer;
  private seasonRenderBuffer!: GPUBuffer;

  // Camera state
  viewOffsetX = 0;
  viewOffsetY = 0;
  viewScaleX = 1;
  viewScaleY = 1;
  private time = 0;

  private depthTexture!: GPUTexture;

  constructor(gpu: GPUContext, sim: SimManager) {
    this.device = gpu.device;
    this.context = gpu.context;
    this.format = gpu.format;
    this.sim = sim;
  }

  init() {
    const device = this.device;

    // Uniform buffer for render passes
    this.renderUniformBuffer = device.createBuffer({
      size: 32, // 8 floats
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'render_uniforms',
    });

    this.seasonRenderBuffer = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'season_render',
    });

    // Create depth texture
    const canvas = this.context.getCurrentTexture();
    this.depthTexture = device.createTexture({
      size: [canvas.width, canvas.height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      label: 'depth',
    });

    this.createTerrainPipeline();
    this.createWaterPipeline();
    this.createPlantPipeline();
    this.createAtmoPipeline();
    this.createLightPipeline();
  }

  private createTerrainPipeline() {
    const device = this.device;
    const module = device.createShaderModule({ code: terrainShader, label: 'terrain_shader' });

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
      ],
    });

    this.terrainPipeline = device.createRenderPipeline({
      label: 'terrain_pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module, entryPoint: 'vs_main' },
      fragment: {
        module, entryPoint: 'fs_main',
        targets: [{ format: this.format }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  private createWaterPipeline() {
    const device = this.device;
    const module = device.createShaderModule({ code: waterShader, label: 'water_shader' });

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
      ],
    });

    this.waterPipeline = device.createRenderPipeline({
      label: 'water_pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module, entryPoint: 'vs_main' },
      fragment: {
        module, entryPoint: 'fs_main',
        targets: [{
          format: this.format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  private createPlantPipeline() {
    const device = this.device;
    const module = device.createShaderModule({ code: plantShader, label: 'plant_shader' });

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    });

    this.plantPipeline = device.createRenderPipeline({
      label: 'plant_pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module, entryPoint: 'vs_main' },
      fragment: {
        module, entryPoint: 'fs_main',
        targets: [{ format: this.format }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  private createAtmoPipeline() {
    const device = this.device;
    const module = device.createShaderModule({ code: atmosphereShader, label: 'atmo_shader' });

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });

    this.atmoPipeline = device.createRenderPipeline({
      label: 'atmo_pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module, entryPoint: 'vs_main' },
      fragment: {
        module, entryPoint: 'fs_main',
        targets: [{
          format: this.format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  private createLightPipeline() {
    const device = this.device;
    const module = device.createShaderModule({ code: lightShader, label: 'light_shader' });

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
      ],
    });

    this.lightPipeline = device.createRenderPipeline({
      label: 'light_pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module, entryPoint: 'vs_main' },
      fragment: {
        module, entryPoint: 'fs_main',
        targets: [{
          format: this.format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
            alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  render(dt: number) {
    this.time += dt;

    // Update render uniforms
    const uniforms = new Float32Array([
      this.viewOffsetX, this.viewOffsetY,
      this.viewScaleX, this.viewScaleY,
      WORLD_WIDTH, this.time,
      0, 0, // padding
    ]);
    this.device.queue.writeBuffer(this.renderUniformBuffer, 0, uniforms);

    const encoder = this.device.createCommandEncoder({ label: 'render' });
    const textureView = this.context.getCurrentTexture().createView();

    // Background clear
    const colorAttachment: GPURenderPassColorAttachment = {
      view: textureView,
      clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1.0 },
      loadOp: 'clear',
      storeOp: 'store',
    };

    // === Terrain Pass ===
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [colorAttachment],
        label: 'terrain_pass',
      });
      pass.setPipeline(this.terrainPipeline);
      pass.setBindGroup(0, this.device.createBindGroup({
        layout: this.terrainPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.renderUniformBuffer } },
          { binding: 1, resource: { buffer: this.sim.terrainBuffer } },
          { binding: 2, resource: { buffer: readBuffer(this.sim.soilBuffers) } },
        ],
      }));
      pass.draw(6, WORLD_WIDTH); // 6 verts per column quad
      pass.end();
    }

    // Subsequent passes load (don't clear)
    colorAttachment.loadOp = 'load';

    // === Water Pass ===
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [colorAttachment],
        label: 'water_pass',
      });
      pass.setPipeline(this.waterPipeline);
      pass.setBindGroup(0, this.device.createBindGroup({
        layout: this.waterPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.renderUniformBuffer } },
          { binding: 1, resource: { buffer: this.sim.terrainBuffer } },
          { binding: 2, resource: { buffer: readBuffer(this.sim.waterBuffers) } },
        ],
      }));
      pass.draw(6, WORLD_WIDTH);
      pass.end();
    }

    // === Plant Pass ===
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [colorAttachment],
        label: 'plant_pass',
      });
      pass.setPipeline(this.plantPipeline);
      pass.setBindGroup(0, this.device.createBindGroup({
        layout: this.plantPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.renderUniformBuffer } },
          { binding: 1, resource: { buffer: this.sim.plantBuffer } },
          { binding: 2, resource: { buffer: this.sim.terrainBuffer } },
          { binding: 3, resource: { buffer: this.sim.seasonUniformBuffer } },
        ],
      }));
      pass.draw(6, MAX_PLANTS);
      pass.end();
    }

    // === Atmosphere Pass ===
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [colorAttachment],
        label: 'atmo_pass',
      });
      pass.setPipeline(this.atmoPipeline);
      pass.setBindGroup(0, this.device.createBindGroup({
        layout: this.atmoPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.renderUniformBuffer } },
          { binding: 1, resource: { buffer: readBuffer(this.sim.atmoBuffers) } },
          { binding: 2, resource: { buffer: this.sim.seasonUniformBuffer } },
        ],
      }));
      pass.draw(3); // fullscreen triangle
      pass.end();
    }

    // === Volumetric Light Pass ===
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [colorAttachment],
        label: 'light_pass',
      });
      pass.setPipeline(this.lightPipeline);
      pass.setBindGroup(0, this.device.createBindGroup({
        layout: this.lightPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.renderUniformBuffer } },
          { binding: 1, resource: { buffer: this.sim.seasonUniformBuffer } },
          { binding: 2, resource: { buffer: readBuffer(this.sim.atmoBuffers) } },
        ],
      }));
      pass.draw(3);
      pass.end();
    }

    this.device.queue.submit([encoder.finish()]);
  }

  resize(width: number, height: number) {
    if (this.depthTexture) {
      this.depthTexture.destroy();
    }
    this.depthTexture = this.device.createTexture({
      size: [width, height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }
}
