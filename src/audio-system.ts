export function makeAudioBufferFromData(ac: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
	return new Promise<AudioBuffer>((resolve, reject) => {
		ac.decodeAudioData(
			data,
			audioData => {
				resolve(audioData);
			},
			() => {
				reject("invalid audio data");
			}
		);
	});
}


export function loadAudioFile(actx: AudioContext, path: string): Promise<AudioBuffer> {
	return fetch(path).then(r => r.arrayBuffer()).then(ab => makeAudioBufferFromData(actx, ab));
}


export function makeAudioContext(): AudioContext {
	return new AudioContext({ latencyHint: "interactive" });
}
