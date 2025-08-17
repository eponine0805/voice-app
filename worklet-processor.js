class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    // 入力された音声をそのまま出力に渡す
    const input = inputs[0];
    const output = outputs[0];
    if (input.length > 0) {
      for (let channel = 0; channel < input.length; channel++) {
        output[channel].set(input[channel]);
      }
    }
    // trueを返してプロセッサをアクティブに保つ
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);