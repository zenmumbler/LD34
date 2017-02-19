// LD34 - Growing / 2-button Controls
// (c) 2015 by Arthur Langereis — @zenmumbler

/// <reference path="../../stardazed-tx/dist/stardazed-tx.d.ts" />

import io = sd.io;
import math = sd.math;
import world = sd.world;
import render = sd.render;
import meshdata = sd.meshdata;
import dom = sd.dom;
import audio = sd.audio;
import asset = sd.asset;

import vec2 = veclib.vec2;
import vec3 = veclib.vec3;
import vec4 = veclib.vec4;
import quat = veclib.quat;
import mat3 = veclib.mat3;
import mat4 = veclib.mat4;

interface Assets {
	snowMaterial?: asset.Material;
	rockMaterial?: asset.Material;
	pebbleMaterial?: asset.Material;

	tophat?: asset.Model;
	carrot?: asset.Model;

	skyTexture?: render.Texture;

	snowLoop?: AudioBuffer;
	music?: AudioBuffer;
	count1Sample?: AudioBuffer;
	count2Sample?: AudioBuffer;
	pickupSample?: AudioBuffer;
	wallHitSample?: AudioBuffer;
	orchHitSample?: AudioBuffer;
	fanfareSample?: AudioBuffer;
	slamSample?: AudioBuffer;

	trackCtl?: TrackScene;
	menuCtl?: MenuScene;
}
const assets: Assets = {};


function init() {
	// -- create managers
	const canvas = <HTMLCanvasElement>document.getElementById("stage");
	const rctx = render.makeRenderContext(canvas)!;
	const actx = audio.makeAudioContext()!;

	const assetBaseURL: string = (<any>window)["assetBaseURL"] || document.baseURI!;
	const library = new asset.AssetLibrary();
	library.addRoot("data", new URL("data/", assetBaseURL));

	// -- load resources
	const resources = [
		asset.loadOBJFile(library.resolvePath("data/models/carrot.obj")).then(group => {
			assets.carrot = group.models[0];
			const cmesh = assets.carrot.mesh!.meshData;
			meshdata.transform(cmesh, { rotate: quat.fromEuler(0, 0, Math.PI / 2), translate: [0, .6, 0], scale: [1.5, 1.5, 1.5] });
		}),
		asset.loadOBJFile(library.resolvePath("data/models/tophat.obj")).then(group => {
			console.info("hatg", group);
			assets.tophat = group.models[0]!;
			const hmesh = assets.tophat.mesh!.meshData;
			meshdata.scale(hmesh, [.8, .8, .8]);

			return asset.resolveTextures(rctx, group.textures).then(texa => texa.map(tex => { if (tex) tex.texture = new render.Texture(rctx, tex.descriptor!); return tex; }));
		}),
		asset.loadMTLFile(library.resolvePath("data/models/common.mtl")).then(group => {
			for (const mat of group.materials) {
				if (mat.name === "snow") assets.snowMaterial = mat;
				else if (mat.name === "cliff") assets.rockMaterial = mat;
				else if (mat.name === "pebble") assets.pebbleMaterial = mat;
			}

			return asset.resolveTextures(rctx, group.textures).then(texa => texa.map(tex => { if (tex) tex.texture = new render.Texture(rctx, tex.descriptor!); return tex; }));
		}),

		asset.loadSoundFile(actx, assetBaseURL + "data/sound/snowloop.mp3").then((buf) => {
			assets.snowLoop = buf;
		}),
		asset.loadSoundFile(actx, assetBaseURL + "data/sound/B-Roll-incompetech.mp3").then((buf) => {
			assets.music = buf;
		}),
		asset.loadSoundFile(actx, assetBaseURL + "data/sound/count1.wav").then((buf) => {
			assets.count1Sample = buf;
		}),
		asset.loadSoundFile(actx, assetBaseURL + "data/sound/count2.wav").then((buf) => {
			assets.count2Sample = buf;
		}),
		asset.loadSoundFile(actx, assetBaseURL + "data/sound/wallhit.wav").then((buf) => {
			assets.wallHitSample = buf;
		}),
		asset.loadSoundFile(actx, assetBaseURL + "data/sound/pickup.wav").then((buf) => {
			assets.pickupSample = buf;
		}),
		asset.loadSoundFile(actx, assetBaseURL + "data/sound/orch.wav").then((buf) => {
			assets.orchHitSample = buf;
		}),
		asset.loadSoundFile(actx, assetBaseURL + "data/sound/fanfare.mp3").then((buf) => {
			assets.fanfareSample = buf;
		}),
		asset.loadSoundFile(actx, assetBaseURL + "data/sound/slam.wav").then((buf) => {
			assets.slamSample = buf;
		}),

		render.loadCubeTexture(rctx, render.makeCubeMapPaths(assetBaseURL + "data/texCube/alpine/", ".jpg")).then((texture) => {
			assets.skyTexture = texture;
		})
	];

	// -- begin
	Promise.all<{}>(resources).then(() => {
		assets.trackCtl = new TrackScene(rctx, actx);
		assets.menuCtl = new MenuScene(rctx, actx);
		sd.defaultRunLoop.sceneController = assets.menuCtl;
		sd.defaultRunLoop.start();
	});

}

dom.on(window, "load", init);
