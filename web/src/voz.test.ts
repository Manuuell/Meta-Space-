import test from 'node:test';
import assert from 'node:assert/strict';
import { bytesABase64, grabarVoz, soltarMicro } from './voz.ts';

test('bytesABase64 admite un WAV de varios segundos sin desbordar la pila', () => {
  const bytes = new Uint8Array(192_044);
  for (let i = 0; i < bytes.length; i++) bytes[i] = i & 255;
  const encoded = bytesABase64(bytes);
  assert.equal(atob(encoded).length, bytes.length);
});

test('parar funciona aunque se pulse antes de conceder el micrófono', async (t) => {
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const recorderDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'MediaRecorder');
  t.after(() => {
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    else Reflect.deleteProperty(globalThis, 'navigator');
    if (recorderDescriptor) Object.defineProperty(globalThis, 'MediaRecorder', recorderDescriptor);
    else Reflect.deleteProperty(globalThis, 'MediaRecorder');
  });

  class FakeMediaRecorder {
    static isTypeSupported() { return true; }
    state = 'inactive';
    mimeType = 'audio/webm';
    ondataavailable = null;
    onstop = null;
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      queueMicrotask(() => this.onstop?.());
    }
  }

  let trackStopped = false;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async () => ({ getTracks: () => [{ stop: () => { trackStopped = true; } }] }),
      },
    },
  });
  Object.defineProperty(globalThis, 'MediaRecorder', {
    configurable: true,
    value: FakeMediaRecorder,
  });

  const recording = grabarVoz(1000);
  recording.parar();
  const blob = await recording.promesa;

  assert.equal(blob.type, 'audio/webm');
  assert.equal(trackStopped, false, 'el micrófono sigue abierto para la siguiente frase');
  await soltarMicro();
  assert.equal(trackStopped, true);
});
