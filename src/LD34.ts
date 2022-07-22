// LD34 - Growing / 2-button Controls
// (c) 2015 by zenmumbler

import { RenderDeviceWebGL } from "stardazed/render";
import { loadAssets } from "./assets";
import { makeAudioContext } from "./audio-system";
import type { SceneController } from "./game-scene";
import { MenuScene } from "./MenuScene";

import "../ld34.css";

function runScene(scene: SceneController) {
	scene.resume();
	scene.focus();

	const frame = (dt: number) => {
		scene.simulationStep(dt);
		scene.renderFrame(dt);

		requestAnimationFrame(frame);
	};

	frame(0);
}

function init() {
	// -- create managers
	const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
	const rctx = new RenderDeviceWebGL(canvas);
	const actx = makeAudioContext();

	// -- begin
	loadAssets(rctx, actx).then(() => {
		const menu = new MenuScene(rctx, actx);
		runScene(menu);
	});
}

init();
