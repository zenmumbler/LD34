/*

// MenuScene - part of LD34 game
// (c) 2015 by Arthur Langereis — @zenmumbler

class MenuScene implements sd.SceneController {
	private scene_: world.Scene;
	private skybox_: world.Skybox;
	private camTarget = new Float32Array(3);
	private camAngle = 0;

	private mode = "wait";
	private modeStartTime = 0;
	private nextModeTime = 0;

	constructor(private rc: render.RenderContext, private ac: audio.AudioContext) {
		var scene = this.scene_ = new world.Scene(rc);

		var sbEnt = scene.entityMgr.create();
		this.skybox_ = new world.Skybox(this.rc, scene.transformMgr, scene.meshMgr, assets.skyTexture!);
		this.skybox_.setEntity(sbEnt);

		dom.on("#start", "click", (evt) => {
			if (this.mode == "wait") {
				this.playStartSound();
				this.mode = "blink";
				this.modeStartTime = performance.now();
				this.nextModeTime = this.modeStartTime + (1000 * 1);
			}

			evt.stopPropagation();
			evt.preventDefault();
		});
	}


	private playStartSound() {
		if (! this.ac) {
			return;
		}

		// play initial sound on user action to unmute audio on iOS
		// https://paulbakaus.com/tutorials/html5/web-audio-on-ios/
		var source = this.ac.ctx.createBufferSource();
		source.buffer = assets.orchHitSample!;
		const gain = this.ac.ctx.createGain();
		gain.connect(this.ac.ctx.destination);
		gain.gain.value = 0.75;
		source.connect(gain);
		source.start(0);
	}


	renderFrame(_timeStep: number) {
		var rpdMain = render.makeRenderPassDescriptor();
		rpdMain.clearMask = render.ClearMask.ColourDepth;

		var camera: world.ProjectionSetup = {
			projectionMatrix: mat4.perspective([], math.deg2rad(60), this.rc.gl.drawingBufferWidth / this.rc.gl.drawingBufferHeight, 1, 100),
			viewMatrix: mat4.lookAt([], [0, 0, 0], this.camTarget, [0, 1, 0])
		};

		render.runRenderPass(this.rc, this.scene_.meshMgr, rpdMain, null, (renderPass) => {
			// -- STANDARD MODELS
			this.scene_.stdModelMgr.draw(this.scene_.stdModelMgr.all(), renderPass, camera, null, null, world.RenderMode.Forward);

			// -- SKYBOX
			this.skybox_.draw(renderPass, camera);
		});
	}


	simulationStep(timeStep: number) {
		this.camAngle += Math.PI * timeStep * .01;
		vec3.rotateY(this.camTarget, vec3.normalize([], [0, .3, 1]), vec3.zero(), this.camAngle);

		if (this.mode == "blink") {
			var now = performance.now();
			if (now > this.nextModeTime) {
				this.mode = "wait";
				sd.defaultRunLoop.sceneController = assets.trackCtl!;
			}

			var sinceClick = now - this.modeStartTime;
			if (sinceClick % 500 < 250) {
				dom.hide("#start");
			}
			else {
				dom.show("#start", "");
			}
		}
	}


	resume() {
		this.mode = "wait";
		dom.show("#start", "");
	}

	suspend() {
		this.mode = "wait";
		dom.show("#start", "");
	}

	focus() {
		dom.show("#menuOverlay");
	}

	blur() {
		dom.hide("#menuOverlay");
	}
}
*/