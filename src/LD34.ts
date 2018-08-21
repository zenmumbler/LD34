// LD34 - Growing / 2-button Controls
// (c) 2015 by Arthur Langereis — @zenmumbler



function init() {
	// -- create managers
	const canvas = <HTMLCanvasElement>document.getElementById("stage");
	const rctx = render.makeRenderContext(canvas)!;
	const actx = audio.makeAudioContext()!;


	// -- begin
	Promise.all<{}>(resources).then(() => {
		assets.trackCtl = new TrackScene(rctx, actx);
		assets.menuCtl = new MenuScene(rctx, actx);
		sd.defaultRunLoop.sceneController = assets.menuCtl;
		sd.defaultRunLoop.start();
	});

}

dom.on(window, "load", init);
