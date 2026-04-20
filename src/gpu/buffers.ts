export interface PingPongBuffer {
  a: GPUBuffer;
  b: GPUBuffer;
  current: 0 | 1;
}

export function createStorageBuffer(device: GPUDevice, size: number, label?: string): GPUBuffer {
  return device.createBuffer({
    size,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    label,
  });
}

export function createPingPong(device: GPUDevice, size: number, label?: string): PingPongBuffer {
  return {
    a: createStorageBuffer(device, size, `${label}_A`),
    b: createStorageBuffer(device, size, `${label}_B`),
    current: 0,
  };
}

export function readBuffer(pp: PingPongBuffer): GPUBuffer {
  return pp.current === 0 ? pp.a : pp.b;
}

export function writeBuffer(pp: PingPongBuffer): GPUBuffer {
  return pp.current === 0 ? pp.b : pp.a;
}

export function swap(pp: PingPongBuffer) {
  pp.current = pp.current === 0 ? 1 : 0;
}

export function createUniformBuffer(device: GPUDevice, size: number, label?: string): GPUBuffer {
  return device.createBuffer({
    size: Math.ceil(size / 16) * 16, // 16-byte alignment
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    label,
  });
}

export function createStagingBuffer(device: GPUDevice, size: number, label?: string): GPUBuffer {
  return device.createBuffer({
    size,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    label,
  });
}
