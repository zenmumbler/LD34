// MenuScene - part of LD34 game
// (c) 2015 by zenmumbler

import * as dom from "@zenmumbler/mini-dom";
import { RenderDeviceWebGL } from "stardazed/render";
import { Quaternion, Vector3, Vector4 } from "stardazed/vector";
import type { SceneController } from "./game-scene";
import { assets } from "./assets";

export class MenuScene implements SceneController {
	private camTarget = Vector3.forward;
	private camAngle = 0;

	private mode = "wait";
	private modeStartTime = 0;
	private nextModeTime = 0;

	constructor(private rc: RenderDeviceWebGL, private ac: AudioContext) {
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
		// play initial sound on user action to resume audiocontext
		this.ac.resume().then(() => {
			const source = this.ac.createBufferSource();
			source.buffer = assets.orchHitSample!;
			const gain = this.ac.createGain();
			gain.connect(this.ac.destination);
			gain.gain.value = 0.65;
			source.connect(gain);
			source.start(0);
		});
	}


	renderFrame(_timeStep: number) {
		this.rc.state.setClearColour(Vector4.zero);

		/*
		const rpdMain = render.makeRenderPassDescriptor();
		rpdMain.clearMask = render.ClearMask.ColourDepth;

		var camera: world.ProjectionSetup = {
			projectionMatrix: mat4.perspective([], deg2rad(60), this.rc.gl.drawingBufferWidth / this.rc.gl.drawingBufferHeight, 1, 100),
			viewMatrix: mat4.lookAt([], [0, 0, 0], this.camTarget, [0, 1, 0])
		};

		render.runRenderPass(this.rc, this.scene_.meshMgr, rpdMain, null, (renderPass) => {
			// -- STANDARD MODELS
			this.scene_.stdModelMgr.draw(this.scene_.stdModelMgr.all(), renderPass, camera, null, null, world.RenderMode.Forward);

			// -- SKYBOX
			this.skybox_.draw(renderPass, camera);
		});
		*/
	}


	simulationStep(timeStep: number) {
		this.camAngle += 180 * timeStep * .01;
		Quaternion.applyToVector(Quaternion.euler(0, this.camAngle, 0), this.camTarget);
	
		if (this.mode == "blink") {
			const now = performance.now();
			if (now > this.nextModeTime) {
				this.mode = "wait";
				// defaultRunLoop.sceneController = assets.trackCtl!;
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
