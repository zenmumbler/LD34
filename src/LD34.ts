// LD34 - Growing / 2-button Controls
// (c) 2015 by Arthur Langereis — @zenmumbler

import { loadAssets } from "./assets";


function init() {
	// -- create managers
	const canvas = <HTMLCanvasElement>document.getElementById("stage");
	const rctx = render.makeRenderContext(canvas)!;
	const actx = audio.makeAudioContext()!;

	// -- begin
	loadAssets().then(() => {
		const trackCtl = new TrackScene(rctx, actx);
		// assets.menuCtl = new MenuScene(rctx, actx);
		sd.defaultRunLoop.sceneController = trackCtl;
		sd.defaultRunLoop.start();
	});

}

window.onload = init;
