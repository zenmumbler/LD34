// TrackScene - part of LD34 game
// (c) 2015 by zenmumbler

import { Vector2, Vector3, Quaternion, Matrix } from "stardazed/vector";
import { deg2rad, clampf } from "stardazed/core";

import { defineTrack, TrackWidth, TrackSectionData, TrackSectionSegment, TrackSpec, TrackGenState, genTrackSectionData } from "./TrackGen";
import { SFX, SFXType } from "./sound";
import { assets } from "./assets";

const enum AttachmentType {
	Carrot,
	Pebble,
	Tophat
}


interface AttachmentSpec {
	type: AttachmentType;
	mesh: world.MeshInstance;
	material: asset.Material;
	size: Float3; // vec3
}


interface AttachmentInstance {
	ent: world.Entity;
	tx: world.TransformInstance;
	model: world.StdModelInstance;
	staticPos: Float3;
	bounds: AABB;
	spec: AttachmentSpec;
	attached: boolean;
}


class Attachments {
	private specs_: AttachmentSpec[] = [];

	private instances: AttachmentInstance[] = [];

	private sectionMap: Map<number, AttachmentInstance[]>;

	private hoverT = 0;

	constructor(private scene: world.Scene) {
		const pebbleMD = meshdata.gen.generate(new meshdata.gen.Sphere({ radius: .1, rows: 8, segs: 16 }));
		meshdata.scale(pebbleMD, [1, 0.25, 1]);
		const pebbleMesh = this.scene.meshMgr.create({ name: "pebble", meshData: pebbleMD });
		const carrotMesh = this.scene.meshMgr.create({ name: "carrot", meshData: assets.carrot!.mesh!.meshData });
		const tophatMesh = this.scene.meshMgr.create({ name: "hat", meshData: assets.tophat!.mesh!.meshData });

		// --

		this.specs_.push({
			type: AttachmentType.Carrot,
			mesh: carrotMesh,
			material: assets.carrot!.materials![0],
			size: [1, 1.5, 1]
		});

		this.specs_.push({
			type: AttachmentType.Pebble,
			mesh: pebbleMesh,
			material: assets.pebbleMaterial!,
			size: [1, .5, 1]
		});

		this.specs_.push({
			type: AttachmentType.Tophat,
			mesh: tophatMesh,
			material: assets.tophat!.materials![0],
			size: [1.0, .7, 1.2]
		});
	}


	allocate(count: number) {
		for (let ix = 0; ix < count; ++ix) {
			var chance = Math.random();

			// -- get a random attachment with a .5, .3, .2 distribution of chance
			var type: AttachmentType;
			if (chance < 0.5)
				type = AttachmentType.Pebble;
			else if (chance < 0.8)
				type = AttachmentType.Carrot;
			else
				type = AttachmentType.Tophat;
			var spec = this.specs_[<number>type];

			var ent = this.scene.entityMgr.create();
			var tx = this.scene.transformMgr.create(ent);
			this.scene.meshMgr.linkToEntity(spec.mesh, ent);
			var model = this.scene.stdModelMgr.create(ent, { materials: [spec.material] });

			this.instances.push({
				ent: ent,
				tx: tx,
				model: model,
				spec: spec,
				staticPos: [0, 0, 0],
				bounds: new AABB(),
				attached: false
			});
		}
	}


	disperseOverTrack(track: Track) {
		this.sectionMap = new Map<number, AttachmentInstance[]>();

		var sections = track.sections;
		var sectionsLeft = sections.length - 4;
		var attachmentsLeft = this.instances.length;
		var attachmentIndex = 0;

		this.instances.sort((_a, _b) => { var r = Math.random(); return r < .5 ? 1 : -1; });

		for (let si = 1; si < sections.length - 3; ++si) {
			let section = sections[si];
			let segCount = section.segments.length - 2;
			let attInSection = Math.round(attachmentsLeft / sectionsLeft);
			let sectionAttList: AttachmentInstance[] = [];

			for (let ai = 0; ai < attInSection; ++ai) {
				let segIx = (Math.random() * segCount) | 0;
				let segment = section.segments[segIx];
				let segHorizPos = ((TrackWidth - 4) * Math.random()) - ((TrackWidth - 4) / 2);
				let staticPos = vec3.scaleAndAdd([], segment.center, segment.left, segHorizPos);
				vec3.add(staticPos, staticPos, [0, .35, 0]);

				var instance = this.instances[attachmentIndex];
				this.detach(instance);
				sectionAttList.push(instance);
				vec3.copy(instance.staticPos, staticPos);
				instance.bounds = AABB.fromCenterAndSize(staticPos, instance.spec.size);

				++attachmentIndex;
				--attachmentsLeft;
			}

			this.sectionMap.set(si, sectionAttList);

			--sectionsLeft;
		}
	}


	attachmentsInSectionIx(sectionIx: number) {
		return this.sectionMap.get(sectionIx);
	}


	attach(inst: AttachmentInstance, player: Player) {
		if (inst.attached) {
			return;
		}
		inst.attached = true;

		var txm = this.scene.transformMgr;
		var position = vec3.normalize([], vec3.sub([], txm.worldPosition(inst.tx), txm.worldPosition(player.transform)));
		vec3.transformQuat(position, position, quat.invert([], txm.localRotation(player.transform)));
		txm.setParent(inst.tx, player.transform);
		var rot = quat.rotationTo([], [0, 1, 0], position);
		txm.setPositionAndRotation(inst.tx, position, rot);
	}


	detach(inst: AttachmentInstance) {
		if (! inst.attached) {
			return;
		}
		inst.attached = false;

		var txm = this.scene.transformMgr;
		txm.setParent(inst.tx, 0);
		txm.setScale(inst.tx, [1, 1, 1]);
		txm.setPositionAndRotation(inst.tx, inst.staticPos, quat.create());
	}


	get attachedCount() {
		var count = 0;
		for (let inst of this.instances) {
			if (inst.attached)
				++count;
		}
		return count;
	}


	get attached(): AttachmentInstance[] {
		var items: AttachmentInstance[] = [];
		for (let inst of this.instances) {
			if (inst.attached) {
				items.push(inst);
			}
		}
		return items;
	}


	attachedCountOfType(type: AttachmentType) {
		var count = 0;
		for (let inst of this.instances) {
			if (inst.attached && inst.spec.type == type)
				++count;
		}
		return count;
	}


	update(dt: number, player: Player) {
		this.hoverT += dt;
		var yDelta = 0.3 * Math.sin(this.hoverT * Math.PI / 1.5);
		var rotY = this.hoverT * Math.PI / 2;
		var txm = this.scene.transformMgr;

		var invScale = 1 / player.radius;

		for (var inst of this.instances) {
			if (inst.attached) {
				txm.setScale(inst.tx, [invScale, invScale, invScale]);
			}
			else {
				var pos = vec3.add([], inst.staticPos, [0, yDelta, 0]);
				txm.setPositionAndRotation(inst.tx, pos, quat.setAxisAngle([], [0, 1, 0], rotY));
			}
		}
	}
}


class Player {
	private transform_: world.TransformInstance;
	private model_: world.StdModelInstance;
	private body_: world.RigidBodyInstance;

	private radius_: number;

	constructor(private scene: world.Scene) {
		const ent = scene.entityMgr.create();
		this.transform_ = scene.transformMgr.create(ent);

		const ball = meshdata.gen.generate(new meshdata.gen.Sphere({ radius: 1, rows: 16, segs: 32 }));
		const ballMesh = this.scene.meshMgr.create({ name: "ball", meshData: ball });
		this.scene.meshMgr.linkToEntity(ballMesh, ent);
		this.model_ = scene.stdModelMgr.create(ent, { materials: [assets.snowMaterial!] });
		this.radius_ = 0.25;

		this.body_ = scene.rigidBodyMgr.create(ent, { mass: 10 });
	}


	bounds() {
		return AABB.fromCenterAndSize(this.position, [this.radius_, this.radius_, this.radius_]);
	}

	get position() {
		return this.scene.transformMgr.localPosition(this.transform_);
	}

	get velocity() {
		return this.scene.rigidBodyMgr.velocity(this.body_);
	}

	move(delta: Float3) {
		this.scene.transformMgr.translate(this.transform_, delta);
	}

	moveTo(pos: Float3) {
		this.scene.transformMgr.setPosition(this.transform_, pos);
	}

	get radius() {
		return this.radius_;
	}

	grow(by: number) {
		this.radius_ += by;
		this.scene.transformMgr.translate(this.transform_, [0, by, 0]);
		this.scene.transformMgr.setScale(this.transform_, [this.radius_, this.radius_, this.radius_]);
	}

	set radius(newRadius: number) {
		this.radius_ = newRadius;
		this.scene.transformMgr.setScale(this.transform_, [newRadius, newRadius, newRadius]);
	}

	get body() {
		return this.body_;
	}

	get transform() {
		return this.transform_;
	}

	get model() {
		return this.model_;
	}
}


class Camera implements world.ProjectionSetup {
	pos = new Float32Array(3);
	target = new Float32Array(3);
	speed = new Float32Array(3);
	xzFallback = 3;

	playerSectionIx_ = -1;
	playerSegmentIx = -1;

	aspectRatio: number;
	projectionMatrix: Float32Array;
	viewMatrix: Float32Array;


	constructor(rc: render.RenderContext, private player_: Player, private track_: Track) {
		this.projectionMatrix = mat4.create();
		this.viewMatrix = mat4.create();

		var w = rc.gl.drawingBufferWidth;
		var h = rc.gl.drawingBufferHeight;
		this.aspectRatio = w / h;

		mat4.perspective(this.projectionMatrix, deg2rad(60), this.aspectRatio, 0.1, 150.0);

		this.setPlayerTrackLocation(0, 0);
		this.pos[1] = this.track_.sections[this.playerSectionIx_].segments[this.playerSegmentIx].center[1] + 1.5;
	}

	setPlayerTrackLocation(sectionIx: number, segmentIx: number) {
		this.playerSectionIx_ = sectionIx;
		this.playerSegmentIx = segmentIx;
	}

	update(dt: number) {
		var playerSection = this.track_.sections[this.playerSectionIx_];
		var playerSegment = playerSection.segments[this.playerSegmentIx];

		var curPos = vec3.clone(this.pos);
		var nextPos = vec3.scaleAndAdd([], this.player_.position, playerSegment.direction, -(this.xzFallback + this.player_.radius));
		nextPos[1] = this.player_.position[1] + 1 + this.player_.radius; // playerSegment.center[1] + 1.5;

		for (var dim = 0; dim < 3; ++dim) {
			var diff = nextPos[dim] - curPos[dim];
			if (Math.abs(diff) > 0.2) {
				this.speed[dim] = 10 * dt * diff;
			}
			else {
				this.speed[dim] *= 0.5;
			}
		}

		vec3.add(this.pos, curPos, this.speed);
		vec3.scaleAndAdd(this.target, this.player_.position, playerSegment.direction, 2);

		mat4.lookAt(this.viewMatrix, this.pos, this.target, [0, 1, 0]);
	}
}


interface Torch {
	pos: Float3;
	transform: world.TransformInstance;
	light: world.LightInstance;
}


interface TrackLocationInfo {
	sectionIx: number;
	segmentIx: number;

	section: TrackSectionData;
	segment: TrackSectionSegment;

	segLineFront: Float3;
	segLineRear: Float3;

	segLine: Float3;

	segHorizPos: number;
	segRelHorizPos: number;
	segRelVertPos: number;

	trackYAtPos: number;
}


class Track {
	private trackMaterial_: asset.Material;
	private wallMaterial_: asset.Material;

	private sections_: TrackSectionData[] = [];
	private sectionMeshes_: world.MeshInstance[] = [];

	private torches_: Torch[] = [];

	get sections() { return this.sections_; }

	constructor(private scene_: world.Scene, spec: TrackSpec) {
		this.trackMaterial_ = assets.snowMaterial!;
		this.wallMaterial_ = assets.rockMaterial!;

		// --

		var genState: TrackGenState = {
			orientation: quat.create(),
			origin: vec3.zero(),
			resolution: .5,
			uvCoordV: 0,
			nextTorch: 12
		};

		for (var section of spec) {
			var sectionData = genTrackSectionData(section, genState);
			//console.info(sectionData);
			this.sections_.push(sectionData);

			// -- section floor
			// var mdesc = render.makeMeshDescriptor(sectionData.floorMeshData);
			// mdesc.primitiveType = meshdata.PrimitiveType.Triangle;
			var sectionMesh = this.scene_.meshMgr.create({ name: "section_" + this.sections_.length, meshData: sectionData.floorMeshData });
			this.sectionMeshes_.push(sectionMesh);

			let mdlEnt = this.scene_.entityMgr.create();
			this.scene_.transformMgr.create(mdlEnt, { position: sectionData.position });
			this.scene_.meshMgr.linkToEntity(sectionMesh, mdlEnt);
			sectionData.floorModel = this.scene_.stdModelMgr.create(mdlEnt, { materials: [this.trackMaterial_] });

			// -- section walls
			// var wmdesc = render.makeMeshDescriptor(sectionData.wallMeshData);
			// wmdesc.primitiveType = meshdata.PrimitiveType.Triangle;
			var sectionWallMesh = this.scene_.meshMgr.create({ name: "sectionwalls_" + this.sections_.length, meshData: sectionData.wallMeshData });

			let wallEnt = this.scene_.entityMgr.create();
			this.scene_.transformMgr.create(wallEnt, { position: sectionData.position });
			this.scene_.meshMgr.linkToEntity(sectionWallMesh, wallEnt);
			sectionData.wallModel = this.scene_.stdModelMgr.create(wallEnt, { materials: [this.wallMaterial_] });

			for (var torch of sectionData.torches) {
				let torchEnt = this.scene_.entityMgr.create();
				let torchTX = this.scene_.transformMgr.create(torchEnt, { position: torch.lightPos });
				let torchLight = this.scene_.lightMgr.create(torchEnt, {
					name: `torch_${torchTX}`,
					type: asset.LightType.Point,
					intensity: .6,
					colour: [255 / 255, 247 / 255, 94 / 255],
					range: 12
				});
				this.torches_.push({
					pos: torch.lightPos,
					transform: torchTX,
					light: torchLight
				});
			}
		}
	}


	findObject(bounds: AABB, pos: Float3): TrackLocationInfo | null {
		for (let sectionIx = 0; sectionIx < this.sections_.length; ++sectionIx) {
			var section = this.sections_[sectionIx];

			if (bounds.intersectsAABB(section.bounds)) {
				for (let segmentIx = 0; segmentIx < section.segments.length; ++segmentIx) {
					var segment = section.segments[segmentIx];

					// normalized position along center line of segment
					var objectRelPos = vec3.sub([], pos, segment.center);
					var segHorizPos = segment.halfWidth - vec3.dot(objectRelPos, segment.left);
					var segRelHorizPos = segHorizPos / (2 * segment.halfWidth);

					if (segRelHorizPos < -0.02 || segRelHorizPos > 1.02) {
						continue;
					}

					var objectSegLineFront = vec3.lerp([], segment.leftFront, segment.rightFront, segRelHorizPos);
					var objectSegLineRear = vec3.lerp([], segment.leftRear, segment.rightRear, segRelHorizPos);
					var objectSegLine = vec3.subtract([], objectSegLineRear, objectSegLineFront);
					var objectSegLineLength2 = vec3.sqrLen(objectSegLine);
					var objectRelVertPos = vec3.sub([], pos, objectSegLineFront);

					var segRelVertPos = vec3.dot(objectRelVertPos, objectSegLine) / objectSegLineLength2;

					if (segRelVertPos >= -0.02 && segRelVertPos <= 1.02) {
						return {
							sectionIx: sectionIx,
							segmentIx: segmentIx,

							section: section,
							segment: segment,

							segLineFront: objectSegLineFront,
							segLineRear: objectSegLineRear,

							segLine: objectSegLine,

							segHorizPos: segHorizPos,
							segRelHorizPos: segRelHorizPos,
							segRelVertPos: segRelVertPos,

							trackYAtPos: objectSegLineFront[1] + ((objectSegLineRear[1] - objectSegLineFront[1]) * segRelVertPos)
						};
					}
				}
			}
		}

		return null;
	}


	findClosestTorches(pos: Float3, limit: number) {
		// torches are sorted linearly along the track, so find the closest and return that + limit-1 next
		var nearestTorch = -1;
		var torchDistSq = 999999;
		for (let tix = 0; tix < this.torches_.length; ++tix) {
			let torch = this.torches_[tix];
			let dsq = vec3.sqrDist(torch.pos, pos);
			if (dsq < torchDistSq) {
				nearestTorch = tix;
				torchDistSq = dsq;
			}
		}

		var torchesAvail = clamp(nearestTorch > -1 ? (this.torches_.length - nearestTorch) : 0, 0, limit);
		var result: Torch[] = [];
		while (torchesAvail--) {
			result.push(this.torches_[nearestTorch++]);
		}

		return result;
	}
}


const enum CameraMode {
	Normal,
	Bird
}


export class TrackScene {
	private scene_: world.Scene;

	private player_: Player;
	private track_: Track;
	private camera_: Camera;
	private attachments: Attachments;
	private sfx: SFX;

	private skybox_: world.Skybox;
	private fixedLights_: world.LightInstance[];

	private mode_ = "";
	private nextMode_ = 0;
	private endStep_ = 0;
	private nextEndStep_ = 0;
	private cameraMode_ = CameraMode.Normal;

	private timeLeft_ = 0;
	private onFloor_ = true;
	private deviceTilt = 0;

	private playerTrackPos: TrackLocationInfo | null = null;

	constructor(private rc: render.RenderContext, ac: audio.AudioContext) {
		const scene = this.scene_ = new world.Scene(rc);

		const sun1 = scene.makeEntity({
			light: {
				name: "sun",
				type: asset.LightType.Directional,
				colour: vec3.scale([], [1, 1, 1], 1.0),
				intensity: 0.4
			}
		});
		scene.lightMgr.setDirection(sun1.light!, [-.8, -.7, -.4]);

		const sun2 = this.scene_.makeEntity({
			light: {
				name: "sun2",
				type: asset.LightType.Directional,
				colour: vec3.scale([], [1, 1, 1], 1.0),
				intensity: 0.25
			}
		});
		scene.lightMgr.setDirection(sun2.light!, [.8, -.55, .4]);

		this.fixedLights_ = [sun1.light!, sun2.light!];

		var sbEnt = this.scene_.entityMgr.create();
		this.skybox_ = new world.Skybox(this.rc, this.scene_.transformMgr, this.scene_.meshMgr, assets.skyTexture!);
		this.skybox_.setEntity(sbEnt);

		// --

		this.track_ = new Track(scene, defineTrack());

		this.player_ = new Player(scene);
		this.player_.moveTo([0, this.player_.radius, 2]);

		this.camera_ = new Camera(rc, this.player_, this.track_);

		this.attachments = new Attachments(scene);
		this.attachments.allocate(40);

		this.sfx = new SFX(ac);

		dom.on(window, "deviceorientation", (evt: DeviceOrientationEvent) => {
			this.deviceTilt = evt.beta * Math.sign(evt.gamma!);
		});

		// dom.on("#title", "click", (_evt) => {
		// 	defaultRunLoop.sceneController = assets.menuCtl!;
		// });
		dom.on("#again", "click", (_evt) => {
			this.reset();
		});
	}


	trackStuffToDraw(maxCount: number): world.StdModelSet {
		if (! this.playerTrackPos) {
			return new world.InstanceSet<world.StdModelManager>();
		}

		var stuff: world.StdModelInstance[] = [];

		var maxSegIx = this.track_.sections.length;
		var fromSecIx = Math.max(0, this.playerTrackPos.sectionIx - 1);
		var toSecIx = Math.min(maxSegIx, this.playerTrackPos.sectionIx + maxCount - 1);

		for (var seci = fromSecIx; seci < toSecIx; ++seci) {
			let section = this.track_.sections[seci];
			stuff.push(section.floorModel, section.wallModel);
			var attArr = this.attachments.attachmentsInSectionIx(seci);
			attArr && attArr.forEach(att => {
				stuff.push(att.model);
			});
		}

		var stuffSet = new world.InstanceSet<world.StdModelManager>();
		stuffSet.addArray(stuff);
		return stuffSet;
	}


	private debugCanvas?: HTMLCanvasElement;

	fark(outBounds: Rect, center: Float3, range: number, projectionViewportMatrix: Float4x4) {
		// if the camera is inside the range of the point light, just apply it to the full screen
		if (vec3.length(center) <= range * 1.3) { // apply some fudge factors because I'm tired
			outBounds.left = 0;
			outBounds.top = 5000;
			outBounds.right = 5000;
			outBounds.bottom = 0;
			return;
		}

		const cx = center[0];
		const cy = center[1];
		const cz = center[2];

		const vertices: number[][] = [
			[cx - range, cy - range, cz - range, 1.0],
			[cx - range, cy - range, cz + range, 1.0],
			[cx - range, cy + range, cz - range, 1.0],
			[cx - range, cy + range, cz + range, 1.0],
			[cx + range, cy - range, cz - range, 1.0],
			[cx + range, cy - range, cz + range, 1.0],
			[cx + range, cy + range, cz - range, 1.0],
			[cx + range, cy + range, cz + range, 1.0]
		];

		const min = [Float.max, Float.max];
		const max = [-Float.max, -Float.max];
		const sp = [0, 0, 0, 0];

		for (let vix = 0; vix < 8; ++vix) {
			vec4.transformMat4(sp, vertices[vix], projectionViewportMatrix);
			vec4.scale(sp, sp, 1.0 / sp[3]);
			vec2.min(min, min, sp);
			vec2.max(max, max, sp);
		}

		outBounds.left = min[0];
		outBounds.top = max[1];
		outBounds.right = max[0];
		outBounds.bottom = min[1];
	}

	drawLightSSBs(projection: world.ProjectionSetup, camDir: Float3) {
		// debugger;
		if (! this.debugCanvas) {
			const c = document.createElement("canvas");
			c.id = "debugCanvas";
			c.width = this.rc.gl.drawingBufferWidth;
			c.height = this.rc.gl.drawingBufferHeight;
			this.rc.gl.canvas.parentElement!.appendChild(c);
			this.debugCanvas = c;
		}

		const ctx2D = this.debugCanvas.getContext("2d")!;
		ctx2D.strokeStyle = "#ff0000";
		ctx2D.clearRect(0, 0, ctx2D.canvas.width, ctx2D.canvas.height);

		const viewport = viewportMatrix(0, 0, this.rc.gl.drawingBufferWidth, this.rc.gl.drawingBufferHeight, 0, 1);
		const ssb: Rect = { left: 0, top: 0, right: 0, bottom: 0 };
		const ssb2: Rect = { left: 0, top: 0, right: 0, bottom: 0 };

		const lm = this.scene_.lightMgr;
		const txm = this.scene_.transformMgr;
		const PVM = mat4.multiply([], projection.projectionMatrix, projection.viewMatrix);
		const VPP = mat4.multiply([], viewport, projection.projectionMatrix);

		const txx = this.track_.findClosestTorches(this.player_.position, 1);
		if (txx.length === 0) {
			return;
		}
		const t1 = txx[0].light as number;

		for (let lix = t1; lix <= t1 + 4; ++lix) {
			if (lm.type(lix) == asset.LightType.Point) {
				const lpos = txm.worldPosition(lm.transform(lix));
				const lcpos = lm.positionCameraSpace(lix);
				const halfRange = lm.range(lix);

				screenSpaceBoundsForWorldCube(ssb, lpos, halfRange, camDir, projection.viewMatrix, PVM, viewport);
				this.fark(ssb2, lcpos, halfRange, VPP);

				ssb.left = clamp(ssb.left, 0, 9999);
				ssb.right = clamp(ssb.right, -9999, 1136);
				ssb.top = clamp(640 - ssb.top, 0, 9999);
				ssb.bottom = clamp(640 - ssb.bottom, -9999, 640);

				ssb2.left = clamp(ssb2.left, 0, 9999);
				ssb2.right = clamp(ssb2.right, -9999, 1136);
				ssb2.top = clamp(640 - ssb2.top, 0, 9999);
				ssb2.bottom = clamp(640 - ssb2.bottom, -9999, 640);

				ctx2D.strokeStyle = "#ff0000";
				// ctx2D.strokeRect(ssb.left, ssb.top, ssb.right - ssb.left, ssb.bottom - ssb.top);
				// ctx2D.strokeText("" + lix, ssb.left + 4 + ((lix - 4) * 10), ssb.bottom - 4);
				// ctx2D.strokeStyle = "#00ff00";
				ctx2D.strokeRect(ssb2.left, ssb2.top, ssb2.right - ssb2.left, ssb2.bottom - ssb2.top);
				ctx2D.strokeText("" + lix, ssb2.left + 4, ssb2.bottom - 4);
			}
		}
	}


	renderFrame(_timeStep: number) {
		var rpdMain = render.makeRenderPassDescriptor();
		rpdMain.clearMask = render.ClearMask.ColourDepth;
		rpdMain.clearColour = [121 / 255, 226 / 255, 253 / 255, 1];

		// -- track debug
		// if (io.keyboard.pressed(io.Key.C)) {
		// 	this.cameraMode_ = this.cameraMode_ == CameraMode.Normal ? CameraMode.Bird : CameraMode.Normal;
		// }
		var projection: world.ProjectionSetup = this.camera_;
		const camDir = vec3.normalize([], vec3.sub([], this.camera_.target, this.camera_.pos));

		if (this.cameraMode_ == CameraMode.Bird) {
			projection = {
				projectionMatrix: mat4.perspective([], deg2rad(60), this.camera_.aspectRatio, 0.1, 300.0),
				viewMatrix: mat4.lookAt([], [50, 65, 175], this.player_.position, [-1, 0, 0]) // 100, 55, 110
			};
			vec3.normalize(camDir, vec3.sub([], this.player_.position, [50, 65, 175]));
		}
		// -- end track debug

		render.runRenderPass(this.rc, this.scene_.meshMgr, rpdMain, null, (renderPass) => {
			// lights
			const lights = new world.InstanceSet<world.LightManager>();
			lights.addArray(this.fixedLights_);
			lights.addArray(this.track_.findClosestTorches(this.player_.position, 5).map(torch => torch.light));
			this.scene_.lightMgr.prepareLightsForRender(lights, projection, renderPass.viewport()!);

			// light viz
			// this.drawLightSSBs(projection, camDir);

			// -- stuff
			var stuff = this.trackStuffToDraw(9);
			this.attachments.attached.forEach(att => {
				if (! stuff.has(att.model)) {
					stuff.add(att.model);
				}
			});
			stuff.add(this.player_.model);
			// this.scene_.stdModelMgr.draw(this.scene_.stdModelMgr.all(), renderPass, projection, null, null, world.RenderMode.Forward);
			this.scene_.stdModelMgr.draw(stuff, renderPass, projection, null, null, world.RenderMode.Forward);

			// -- SKYBOX
			this.skybox_.draw(renderPass, projection);
		});

		// -- stat counters
		var attached = this.attachments.attachedCount;
		dom.$1("#stat-items")!.textContent = "" + attached;
		dom.$1("#stat-time")!.textContent = "" + Math.max(0, Math.ceil(this.timeLeft_));

		if (this.playerTrackPos && this.player_.velocity) {
			let playerDir3D = this.player_.velocity;
			let playerDir2D = [playerDir3D[0], playerDir3D[2]];
			let playerSpeedWorld = vec2.length(playerDir2D);

			if (playerSpeedWorld > 0) {
				let trackDir3D = this.playerTrackPos.segment.direction;
				let trackDir2D = vec2.normalize([], [trackDir3D[0], trackDir3D[2]]);

				let playerSpeed = playerSpeedWorld * vec2.dot(vec2.normalize([], playerDir2D), trackDir2D);
				let speedStat = Math.round(playerSpeed * 3.6);

				dom.$1("#stat-speed")!.textContent = "" + speedStat;
			}
		}

		// -- countdown
		if (this.mode_ != "play") {
			var c3 = dom.$1(".count-3");
			var c2 = dom.$1(".count-2");
			var c1 = dom.$1(".count-1");
			var cgo = dom.$1(".count-go");
			var now = performance.now();

			if (this.mode_ == "countdown") {
				this.mode_ = "count-3";
				c3.style.display = "block";
				setTimeout(() => { c3.classList.add("fade") }, 1);
				this.sfx.play(SFXType.Count1);
				this.nextMode_ = now + 1000;
			}
			else if (this.mode_ == "count-3") {
				if (now > this.nextMode_) {
					this.mode_ = "count-2";
					c3.style.display = "none";
					c3.classList.remove("fade");
					c2.style.display = "block";
					setTimeout(() => { c2.classList.add("fade") }, 1);
					this.sfx.play(SFXType.Count1);
					this.nextMode_ = now + 1000;
				}
			}
			else if (this.mode_ == "count-2") {
				if (now > this.nextMode_) {
					this.mode_ = "count-1";
					c2.style.display = "none";
					c2.classList.remove("fade");
					c1.style.display = "block";
					setTimeout(() => { c1.classList.add("fade") }, 1);
					this.sfx.play(SFXType.Count1);
					this.nextMode_ = now + 1000;
				}
			}
			else if (this.mode_ == "count-1") {
				if (now > this.nextMode_) {
					this.mode_ = "play";
					c1.style.display = "none";
					c1.classList.remove("fade");
					cgo.style.display = "block";
					setTimeout(() => { cgo.classList.add("fade") }, 1);
					this.sfx.play(SFXType.Count2);

					setTimeout(() => {
						cgo.style.display = "none";
						cgo.classList.remove("fade");
					}, 1000);

					this.sfx.startMusic(0);
					this.sfx.startSnow();
				}
			}
		}
	}


	achievementTitle(pebbles: number, carrots: number, tophats: number) {
		var total = pebbles + carrots + tophats;
		var title = "Meh";

		// -- base titles
		if (total == 0) {
			title = "Clean Slate";
		}
		else if (total < 10) {
			title = "Lightweight";
		}
		else if (total < 17) {
			title = "Hodge Podge";
		}
		else if (total < 23) {
			title = "Packrat";
		}
		else if (total < 28) {
			title = "Hoarder";
		}
		else {
			title = "Item Magnet";
		}

		// -- special achievements
		if (pebbles == 0 && carrots == 0 && tophats == 1) {
			title = "Gentleman";
		}
		else if (pebbles == 0 && carrots == 1 && tophats == 0) {
			title = "Visionary";
		}
		else if (pebbles == 1 && carrots == 0 && tophats == 0) {
			title = "The Rock";
		}
		else if (pebbles == 1 && carrots == 1 && tophats == 1) {
			title = "Curator";
		}
		else if (pebbles > 3 && carrots == 1 && tophats == 1) {
			title = "True Snowman";
		}
		else if (pebbles > 4 && carrots == 0 && tophats == 0) {
			title = "Zen Garden";
		}
		else if (pebbles == 0 && carrots > 4 && tophats == 0) {
			title = "Vegetarian";
		}
		else if (pebbles == 0 && carrots == 0 && tophats > 4) {
			title = "King of New York";
		}

		// -- distance based
		if (this.camera_.playerSectionIx_ > 37) {
			if (total > 15)
				title = "Expert";
			else
				title = "Speed Racer";
		}

		return title;
	}


	handleEndSteps() {
		var now = performance.now();

		if (now > this.nextEndStep_) {
			this.endStep_++;

			let pebbles = this.attachments.attachedCountOfType(AttachmentType.Pebble);
			let carrots = this.attachments.attachedCountOfType(AttachmentType.Carrot);
			let tophats = this.attachments.attachedCountOfType(AttachmentType.Tophat);

			if (this.endStep_ == 1) {
				dom.$1("#stat-pebbles").textContent = "" + pebbles;
				dom.show("#resultOverlay .stat-left");
				dom.hide("#resultOverlay .stat-center");
				dom.hide("#resultOverlay .stat-right");
				dom.hide("#resultOverlay .start-holder");
				dom.hide(".rank");

				dom.show("#resultOverlay");
				this.sfx.play(SFXType.Slam);
				this.nextEndStep_ = now + 1000;
			}
			else if (this.endStep_ == 2) {
				dom.$1("#stat-carrots").textContent = "" + carrots;
				dom.show("#resultOverlay .stat-center");
				this.sfx.play(SFXType.Slam);
				this.nextEndStep_ = now + 1000;
			}
			else if (this.endStep_ == 3) {
				dom.$1("#stat-hats").textContent = "" + tophats;
				dom.show("#resultOverlay .stat-right");
				this.sfx.play(SFXType.Slam);
				this.nextEndStep_ = now + 2000;
			}
			else if (this.endStep_ == 4) {
				dom.$1("#rank-name").textContent = this.achievementTitle(pebbles, carrots, tophats);
				dom.show(".rank");
				dom.show("#resultOverlay .start-holder");
				this.sfx.play(SFXType.Fanfare);
			}

		}
	}


	simulationStep(timeStep: number) {
		const scene = this.scene_;
		// timeStep *= 0.333;

		if (io.keyboard.pressed(io.Key.R)) {
			this.reset();
			return;
		}

		var playerBounds = this.player_.bounds();
		playerBounds.min[1] = -1000;
		playerBounds.max[1] = 1000;
		var playerPos = this.player_.position;

		var playerTrackPos = this.track_.findObject(playerBounds, playerPos);
		if (playerTrackPos) {
			this.playerTrackPos = playerTrackPos;
		}

		if (this.mode_ == "play") {
			let timeLeftOld = this.timeLeft_;
			this.timeLeft_ -= timeStep;
			let tlo = timeLeftOld | 0;
			let tln = this.timeLeft_ | 0;
			if (tln < 4 && tlo != tln) {
				this.sfx.play(SFXType.Count1);
			}

			if (this.timeLeft_ <= 0) {
				this.mode_ = "end";
				this.endStep_ = 0;
				this.nextEndStep_ = performance.now() + 2000;

				this.sfx.play(SFXType.Count2);
				this.sfx.stopSnow();
				this.scene_.rigidBodyMgr.stop(this.player_.body);

				dom.$1("#stat-speed")!.textContent = "0";
			}
		}
		else if (this.mode_ == "end") {
			if (this.endStep_ < 5)
				this.handleEndSteps();
		}


		if (this.mode_ != "play" && this.mode_ != "end") {
			playerTrackPos = null;
		}

		var playerVelocity = scene.rigidBodyMgr.velocity(this.player_.body);
		var playerSpeed = vec3.length(playerVelocity);
		var playerRadius = this.player_.radius;
		var playerMass = scene.rigidBodyMgr.mass(this.player_.body);


		if (playerTrackPos) {
			this.camera_.setPlayerTrackLocation(playerTrackPos.sectionIx, playerTrackPos.segmentIx);

			let curSegment = playerTrackPos.segment;

			// -- user controls left and right speed
			if (this.mode_ == "play") {
				let userSideForce = 0;
				if (io.keyboard.down(io.Key.LEFT)) {
					userSideForce = playerMass * 700;
				}
				else if (io.keyboard.down(io.Key.RIGHT)) {
					userSideForce = playerMass * -700;
				}
				else if (this.deviceTilt != 0) {
					userSideForce = playerMass * clamp(this.deviceTilt, -15, 15) * 40;
				}
				scene.rigidBodyMgr.addForce(this.player_.body, vec3.scale([], curSegment.left, userSideForce * timeStep));

				// -- auto-regulate forward speed
				if (playerSpeed < 10) {
					scene.rigidBodyMgr.addForce(this.player_.body, vec3.scale([], curSegment.direction, 150 * playerMass * timeStep));
				}
				else if (playerSpeed > 15) {
					scene.rigidBodyMgr.addForce(this.player_.body, vec3.scale([], curSegment.direction, -150 * playerMass * timeStep));
				}

				// -- rotate based on speed and direction in the XZ-plane
				let rot = quat.fromEuler(playerVelocity[0] / -80, 0, playerVelocity[2] / 80);
				scene.transformMgr.rotateRelWorld(this.player_.transform, rot);
			}
			else {
				scene.rigidBodyMgr.setAngVelocity(this.player_.body, [.2, -.15, .3]);
			}


			// -- collide with segment walls
			if (playerTrackPos.segHorizPos < playerRadius) {
				const pushOut = playerRadius - playerTrackPos.segHorizPos + 0.05;
				this.player_.move(vec3.scale([], curSegment.left, -pushOut));
				const velOut = vec3.scale([], vec3.reflect([], playerVelocity, vec3.negate([], curSegment.left)), 0.6);
				playerPos = this.player_.position;
				playerVelocity = velOut;
				scene.rigidBodyMgr.setVelocity(this.player_.body, velOut);
				scene.rigidBodyMgr.addForce(this.player_.body, [0, playerMass * 60, 0]);
				this.sfx.play(SFXType.WallHit);
			}

			if (playerTrackPos.segHorizPos > TrackWidth - playerRadius) {
				const pushOut = playerTrackPos.segHorizPos - (TrackWidth - playerRadius) + 0.05;
				this.player_.move(vec3.scale([], curSegment.left, pushOut));
				const velOut = vec3.scale([], vec3.reflect([], playerVelocity, curSegment.left), 0.6);
				playerPos = this.player_.position;
				playerVelocity = velOut;
				scene.rigidBodyMgr.setVelocity(this.player_.body, velOut);
				scene.rigidBodyMgr.addForce(this.player_.body, [0, playerMass * 60, 0]);
				this.sfx.play(SFXType.WallHit);
			}


			// -- collide with segment floor
			var segYAtPlayer = playerTrackPos.trackYAtPos;
			this.onFloor_ = (playerPos[1] - playerRadius) < (segYAtPlayer + 0.05);

			if (playerPos[1] - playerRadius < segYAtPlayer) {
				this.player_.moveTo([playerPos[0], segYAtPlayer + playerRadius, playerPos[2]]);
				playerPos = this.player_.position;

				var relDownSpeed = -vec3.dot(playerVelocity, curSegment.normal);
				if (relDownSpeed > 1) {
					const velOut = vec3.reflect([], playerVelocity, curSegment.normal);
					scene.rigidBodyMgr.setVelocity(this.player_.body, [velOut[0], velOut[1] * 0.01, velOut[2]]);
				}
				else {
					scene.rigidBodyMgr.setVelocity(this.player_.body, [playerVelocity[0], 0, playerVelocity[2]]);
				}
			}


			// -- collide with attachments
			if (this.mode_ == "play") {
				var sectionAttList = this.attachments.attachmentsInSectionIx(playerTrackPos.sectionIx);
				if (sectionAttList) {
					for (let att of sectionAttList) {
						if (!att.attached) {
							if (att.bounds.intersectsAABB(playerBounds)) {
								this.attachments.attach(att, this.player_);
								this.sfx.play(SFXType.Pickup);
							}
						}
					}
				}
			}
		}

		// -- add gravity and simulate objects
		if (this.mode_ == "play" || this.mode_ == "end") {
			if (this.mode_ == "play") {
				scene.rigidBodyMgr.addForce(this.player_.body, vec3.scale([], [0, -9.8065, 0], playerMass));
			}
			this.scene_.rigidBodyMgr.simulate(this.scene_.rigidBodyMgr.all(), timeStep);
		}

		if (this.mode_ == "play") {
			this.player_.grow(.02 * timeStep);
		}

		this.sfx.setPlayerInfo(this.onFloor_, playerSpeed);

		this.attachments.update(timeStep, this.player_);
		this.camera_.update(timeStep);
		this.skybox_.setCenter(this.camera_.pos);
	}

	reset() {
		this.attachments.disperseOverTrack(this.track_);

		this.timeLeft_ = 60;
		this.mode_ = "countdown";
		this.player_.radius = .25;
		this.player_.moveTo([0, this.player_.radius, 2]);
		var bounds = this.player_.bounds();
		bounds.max[1] = 1000;
		bounds.min[1] = -1000;
		var trkInfo = this.track_.findObject(bounds, this.player_.position);
		if (trkInfo) {
			this.camera_.setPlayerTrackLocation(trkInfo.sectionIx, trkInfo.segmentIx);
		}
		vec3.set(this.camera_.pos, 0, 0, 0);
		this.scene_.rigidBodyMgr.stop(this.player_.body);
		this.nextMode_ = performance.now() + 1000;

		this.sfx.stopMusic();
		this.sfx.stopSnow();

		dom.hide("#resultOverlay");
	}


	resume() {
		if (this.mode_ == "play") {
			this.sfx.startSnow();
			this.sfx.startMusic(60 - this.timeLeft_);
		}
	}

	suspend() {
		this.sfx.stopSnow();

		if (this.mode_ == "play") {
			this.sfx.stopMusic();
		}
	}

	focus() {
		dom.show("#trackOverlay");
		this.reset();
	}

	blur() {
		dom.hide("#trackOverlay");
		dom.hide("#resultOverlay");
	}
}
