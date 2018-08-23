import { assets } from "./assets";

export const enum SFXType {
	Count1,
	Count2,
	Pickup,
	WallHit,
	Fanfare,
	Slam
}


export class SFX {
	private musicSource: AudioBufferSourceNode | null = null;
	private snowSource: AudioBufferSourceNode | null = null;
	private curSource: AudioBufferSourceNode | null = null;

	private musicGain: GainNode;
	private snowGain: GainNode;
	private fxGain: GainNode;

	constructor(private ac: audio.AudioContext) {
		if (!ac) {
			return;
		}

		this.snowGain = ac.ctx.createGain();
		this.snowGain.connect(ac.ctx.destination);

		this.musicGain = ac.ctx.createGain();
		this.musicGain.connect(ac.ctx.destination);
		this.musicGain.gain.value = 0.8;

		this.fxGain = ac.ctx.createGain();
		this.fxGain.connect(ac.ctx.destination);
		this.fxGain.gain.value = 0.6;

		this.setPlayerInfo(false, 0);
	}

	startSnow() {
		if (!this.snowSource) {
			this.snowSource = this.ac.ctx.createBufferSource();
			this.snowSource.buffer = assets.snowLoop!;
			this.snowSource.loop = true;
			this.snowSource.loopEnd = assets.snowLoop!.duration;
			this.snowSource.connect(this.snowGain!);

			this.snowSource.start();
		}
	}

	stopSnow() {
		if (this.snowSource) {
			this.snowSource.stop();
			this.snowSource = null;
		}
	}

	startMusic(timePassed: number) {
		if (timePassed > assets.music!.duration - 0.1) {
			return;
		}

		if (!this.musicSource) {
			this.musicSource = this.ac.ctx.createBufferSource();
			this.musicSource.buffer = assets.music!;
			this.musicSource.connect(this.musicGain!);

			this.musicSource.start(0, timePassed);
		}
	}

	stopMusic() {
		if (this.musicSource) {
			this.musicSource.stop();
			this.musicSource = null;
		}
	}

	setPlayerInfo(floor: boolean, speed: number) {
		if (!this.ac) {
			return;
		}

		var relSpeed = clamp01((speed | 0) / 12);
		var maxVol = .35 * relSpeed * relSpeed;
		this.snowGain.gain.value = floor ? maxVol : 0.05;
	}

	play(what: SFXType) {
		if (!this.ac) {
			return;
		}

		if (this.curSource) {
			this.curSource.stop();
		}

		var buffer: AudioBuffer | null;
		var volume = 0;
		switch (what) {
			case SFXType.Count1: buffer = assets.count1Sample!; volume = 1; break;
			case SFXType.Count2: buffer = assets.count2Sample!; volume = 1; break;
			case SFXType.Pickup: buffer = assets.pickupSample!; volume = .5; break;
			case SFXType.WallHit: buffer = assets.wallHitSample!; volume = .5; break;
			case SFXType.Fanfare: buffer = assets.fanfareSample!; volume = .4; break;
			case SFXType.Slam: buffer = assets.slamSample!; volume = .7; break;
			default: buffer = null;
		}

		if (!buffer)
			return;

		var bufferSource: AudioBufferSourceNode | null = this.ac.ctx.createBufferSource();
		bufferSource.buffer = buffer;
		if (what == SFXType.Pickup || what == SFXType.WallHit) {
			bufferSource.playbackRate.value = 1.0 + ((Math.random() - 0.5) * .2);
		}
		bufferSource.connect(this.fxGain!);
		bufferSource.start(0);
		this.fxGain.gain.value = volume;

		this.curSource = bufferSource;

		bufferSource.onended = () => {
			if (this.curSource == bufferSource) {
				this.curSource = null;
			}

			bufferSource!.disconnect();
			bufferSource = null;
		};

	}
}
