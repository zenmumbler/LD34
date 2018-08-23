// LD34 - Growing / 2-button Controls
// (c) 2015 by Arthur Langereis — @zenmumbler

import { loadAssets } from "./assets";
import { TrackScene } from "./TrackScene";


function init() {
	// -- create managers
	const canvas = <HTMLCanvasElement>document.getElementById("stage");
	const rctx = render.makeRenderContext(canvas)!;
	const actx = audio.makeAudioContext()!;

	// -- begin
	loadAssets().then(() => {
		const trackCtl = new TrackScene(rctx, actx);
		// assets.menuCtl = new MenuScene(rctx, actx);
		defaultRunLoop.sceneController = trackCtl;
		defaultRunLoop.start();
	});

}

window.onload = init;
