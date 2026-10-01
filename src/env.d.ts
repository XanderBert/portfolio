declare module '*.slang' {
  const shader: {
    wgsl: string;
    vert: string;
    frag: string;
    bindings: { binding: number; kind: 'uniform' | 'texture' | 'sampler' }[];
  };
  export default shader;
}
