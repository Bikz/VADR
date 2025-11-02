function decodeSample(muLaw: number): number {
  const MULAW_MAX = 0x1FFF;
  const MULAW_BIAS = 0x84;

  muLaw = ~muLaw & 0xff;
  const sign = muLaw & 0x80;
  const exponent = (muLaw >> 4) & 0x07;
  const mantissa = muLaw & 0x0f;
  let sample = ((mantissa << 4) + 0x08) << (exponent + 3);
  sample -= MULAW_BIAS;

  if (sign !== 0) {
    sample = -sample;
  }

  return Math.max(-MULAW_MAX, Math.min(MULAW_MAX, sample)) / MULAW_MAX;
}

export function decodeMulaw(base64Payload: string): Float32Array | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const binary = window.atob(base64Payload);
    const length = binary.length;
    const pcm = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      const muLaw = binary.charCodeAt(i);
      pcm[i] = decodeSample(muLaw);
    }
    return pcm;
  } catch (error) {
    console.error('[audio] failed to decode mu-law payload', error);
    return null;
  }
}
