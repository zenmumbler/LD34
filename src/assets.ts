

export interface Assets {
	snowMaterial?: asset.Material;
	rockMaterial?: asset.Material;
	pebbleMaterial?: asset.Material;

	tophat?: asset.Model;
	carrot?: asset.Model;

	// skyTexture?: render.Texture;

	// snowLoop?: AudioBuffer;
	// music?: AudioBuffer;
	// count1Sample?: AudioBuffer;
	// count2Sample?: AudioBuffer;
	// pickupSample?: AudioBuffer;
	// wallHitSample?: AudioBuffer;
	// orchHitSample?: AudioBuffer;
	// fanfareSample?: AudioBuffer;
	// slamSample?: AudioBuffer;
}

export const assets: Assets = {};

export function loadAssets() {
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

	return Promise.all(resources);
}
