// TrackGen - part of LD34 game
// (c) 2015 by Arthur Langereis — @zenmumbler

import { Float3, Float4 } from "@stardazed/array";
import { deg2rad } from "@stardazed/math";
import { vec2, vec3, quat } from "@stardazed/vector";

export const TrackWidth = 16;
export const TrackTorchOffset = 32;
export const TrackWallHeight = 5;

export interface TrackSection {
	incline: number;     // angle of rotation over X in deg
	direction: number;   // angle of rotation over Y in deg
	tilt: number;        // angle of rotation over Z in deg

	length: number;      // length of track section in m (rotation from previous rot will be applied over entire section)
}


export type TrackSpec = TrackSection[];


export interface TrackGenState {
	origin: Float3;      // vec3
	orientation: Float4; // quat
	resolution: number;         // m
	uvCoordV: number;           // track V coordinate of texture map over steps
	nextTorch: number;			// m until next torch placement
}


const enum Incline {
	Flat = 2,
	Gradual = 5,
	Medium = 10,
	Steep = 15,
	Cliff = 25,

	Bump = 35
}


export interface TrackSectionSegment {
	center: Float3;
	left: Float3;
	leftRear: Float3;
	rightRear: Float3;
	leftFront: Float3;
	rightFront: Float3;
	halfWidth: number;

	direction: Float3;
	normal: Float3;
}


export interface TorchLoc {
	lightPos: Float3;
	leftWallPos: Float3;
	rightWallPos: Float3;
}


export interface TrackSectionData {
	position: Float3;
	bounds: AABB;
	floorMeshData: meshdata.MeshData;
	wallMeshData: meshdata.MeshData;
	segments: TrackSectionSegment[];
	torches: TorchLoc[];

	floorModel: world.StdModelInstance;
	wallModel: world.StdModelInstance;
}


export function genTrackSectionData(section: TrackSection, genState: TrackGenState): TrackSectionData {
	var steps = (section.length / genState.resolution) | 0; // length must be a multiple of resolution
	var halfSectionWidth = (TrackWidth / 2) | 0; // width must be a multiple of 2

	// each section defines its final orientation in absolute rotation over X, Y and Z in degrees
	var targetOrientation = quat.fromEuler(deg2rad(section.tilt), deg2rad(section.direction), deg2rad(section.incline));


	// make floor mesh and get attribute views
	var md = new meshdata.MeshData();
	var vb = new meshdata.VertexBuffer(meshdata.AttrList.Pos3Norm3UV2());
	md.vertexBuffers.push(vb);
	var triangleCount = 2 * steps * TrackWidth;
	vb.allocate(triangleCount * 3);
	var posAttr = new meshdata.VertexBufferAttributeView(vb, vb.attrByRole(meshdata.VertexAttributeRole.Position)!);
	var normAttr = new meshdata.VertexBufferAttributeView(vb, vb.attrByRole(meshdata.VertexAttributeRole.Normal)!);
	var uvAttr = new meshdata.VertexBufferAttributeView(vb, vb.attrByRole(meshdata.VertexAttributeRole.UV)!);


	// make walls mesh and get views
	var wallMD = new meshdata.MeshData();
	var wallVB = new meshdata.VertexBuffer(meshdata.AttrList.Pos3Norm3UV2());
	wallMD.vertexBuffers.push(wallVB);
	var wallTriangleCount = 2 * 2 * steps; // 2 tris * 2 sides * steps
	wallVB.allocate(wallTriangleCount * 3);
	var wallPosAttr = new meshdata.VertexBufferAttributeView(wallVB, wallVB.attrByRole(meshdata.VertexAttributeRole.Position)!);
	var wallNormAttr = new meshdata.VertexBufferAttributeView(wallVB, wallVB.attrByRole(meshdata.VertexAttributeRole.Normal)!);
	var wallUVAttr = new meshdata.VertexBufferAttributeView(wallVB, wallVB.attrByRole(meshdata.VertexAttributeRole.UV)!);


	var result: TrackSectionData = {
		position: vec3.clone(genState.origin),
		bounds: new AABB(),
		floorMeshData: md,
		wallMeshData: wallMD,
		segments: [],
		torches: [],
		wallModel: 0,
		floorModel: 0
	};

	// coordinate space definition and per-step calculation
	var forwardVec = [0, 0, 1];
	var upVec = [0, 1, 0];

	var calcSpace = (orientation: Float4) => {
		var direction = vec3.normalize([], vec3.transformQuat([], forwardVec, orientation));
		var normal = vec3.normalize([], vec3.transformQuat([], upVec, orientation));
		var left = vec3.normalize([], vec3.cross([], normal, direction));

		return {
			direction: direction,
			normal: normal,
			left: left
		};
	};

	var baseVertex = 0;
	var wallBaseVertex = 0;

	var stepOrigin = [0, 0, 0];

	for (var step = 0; step < steps; ++step) {
		// calc orientations for top and bottom of this step
		var tBottom = step / steps;
		var tTop = (step + 1) / steps;
		var bottomOrientation = quat.slerp([], genState.orientation, targetOrientation, tBottom);
		var topOrientation = quat.slerp([], genState.orientation, targetOrientation, tTop);

		// calc the relevant directional vectors for top and bottom
		var spaceBottom = calcSpace(bottomOrientation);
		var spaceTop = calcSpace(topOrientation);

		// calc the corners of the next discrete quad of the section
		var bottomStripWidth = (step & 1) ? halfSectionWidth : halfSectionWidth - .1;
		var topStripWidth = (step & 1) ? halfSectionWidth - .1 : halfSectionWidth;

		var bottomLeft = vec3.scaleAndAdd([], stepOrigin, spaceBottom.left, bottomStripWidth);
		var bottomRight = vec3.scaleAndAdd([], stepOrigin, spaceBottom.left, -bottomStripWidth);

		var topOrigin = vec3.scaleAndAdd([], stepOrigin, spaceBottom.direction, genState.resolution);
		var topLeft = vec3.scaleAndAdd([], topOrigin, spaceTop.left, topStripWidth);
		var topRight = vec3.scaleAndAdd([], topOrigin, spaceTop.left, -topStripWidth);

		// update this segments bounds
		if (step == 0) {
			result.bounds.encapsulatePoint(vec3.add([], bottomLeft, genState.origin));
			result.bounds.encapsulatePoint(vec3.add([], bottomRight, genState.origin));
		}
		result.bounds.encapsulatePoint(vec3.add([], topLeft, genState.origin));
		result.bounds.encapsulatePoint(vec3.add([], topRight, genState.origin));

		// the horizontal resolution of each step quad is 1m
		for (var horiz = 0; horiz < TrackWidth; ++horiz) {
			var tHorizL = horiz / TrackWidth;
			var tHorizR = (horiz + 1) / TrackWidth;

			// calc the corners of this 1m wide quad inside the full section width
			var ptBottomL = vec3.lerp([], bottomLeft, bottomRight, tHorizL);
			var ptBottomR = vec3.lerp([], bottomLeft, bottomRight, tHorizR);
			var ptTopL = vec3.lerp([], topLeft, topRight, tHorizL);
			var ptTopR = vec3.lerp([], topLeft, topRight, tHorizR);

			// gen vertex data, positions (2 ccw triangles)
			vec3.copy(posAttr.refItem(baseVertex + 0), ptTopL);
			vec3.copy(posAttr.refItem(baseVertex + 1), ptBottomR);
			vec3.copy(posAttr.refItem(baseVertex + 2), ptTopR);

			vec3.copy(posAttr.refItem(baseVertex + 3), ptTopL);
			vec3.copy(posAttr.refItem(baseVertex + 4), ptBottomL);
			vec3.copy(posAttr.refItem(baseVertex + 5), ptBottomR);

			// normals for bottom and top lines
			vec3.copy(normAttr.refItem(baseVertex + 0), spaceTop.normal);
			vec3.copy(normAttr.refItem(baseVertex + 1), spaceBottom.normal);
			vec3.copy(normAttr.refItem(baseVertex + 2), spaceTop.normal);
			vec3.copy(normAttr.refItem(baseVertex + 3), spaceTop.normal);
			vec3.copy(normAttr.refItem(baseVertex + 4), spaceBottom.normal);
			vec3.copy(normAttr.refItem(baseVertex + 5), spaceBottom.normal);

			// UV coords are set to 0..1 over width and increases with resolution per step
			var texVBottom = genState.uvCoordV;
			var texVTop = texVBottom + genState.resolution / TrackWidth;
			vec2.set(uvAttr.refItem(baseVertex + 0), tHorizL, texVTop);
			vec2.set(uvAttr.refItem(baseVertex + 1), tHorizR, texVBottom);
			vec2.set(uvAttr.refItem(baseVertex + 2), tHorizR, texVTop);
			vec2.set(uvAttr.refItem(baseVertex + 3), tHorizL, texVTop);
			vec2.set(uvAttr.refItem(baseVertex + 4), tHorizL, texVBottom);
			vec2.set(uvAttr.refItem(baseVertex + 5), tHorizR, texVBottom);

			baseVertex += 6;
		}


		// -- LEFT wall
		var wallHeight = vec3.fromValues(0, TrackWallHeight, 0);

		var leftWallBottomLeft = vec3.copy([], bottomLeft);
		var leftWallBottomRight = vec3.copy([], topLeft);
		var leftWallTopLeft = vec3.add([], bottomLeft, wallHeight);
		var leftWallTopRight = vec3.add([], topLeft, wallHeight);

		var leftWallNormalLeft = vec3.negate([], spaceBottom.left);
		var leftWallNormalRight = vec3.negate([], spaceTop.left);

		vec3.copy(wallPosAttr.refItem(wallBaseVertex + 0), leftWallTopRight);
		vec3.copy(wallPosAttr.refItem(wallBaseVertex + 1), leftWallBottomLeft);
		vec3.copy(wallPosAttr.refItem(wallBaseVertex + 2), leftWallTopLeft);

		vec3.copy(wallPosAttr.refItem(wallBaseVertex + 3), leftWallTopRight);
		vec3.copy(wallPosAttr.refItem(wallBaseVertex + 4), leftWallBottomRight);
		vec3.copy(wallPosAttr.refItem(wallBaseVertex + 5), leftWallBottomLeft);

		vec3.copy(wallNormAttr.refItem(wallBaseVertex + 0), leftWallNormalRight);
		vec3.copy(wallNormAttr.refItem(wallBaseVertex + 1), leftWallNormalLeft);
		vec3.copy(wallNormAttr.refItem(wallBaseVertex + 2), leftWallNormalLeft);
		vec3.copy(wallNormAttr.refItem(wallBaseVertex + 3), leftWallNormalRight);
		vec3.copy(wallNormAttr.refItem(wallBaseVertex + 4), leftWallNormalRight);
		vec3.copy(wallNormAttr.refItem(wallBaseVertex + 5), leftWallNormalLeft);

		// UV coords increase with resolution per step
		var texVBottom = genState.uvCoordV;
		var texVTop = texVBottom + genState.resolution / TrackWidth;
		vec2.set(wallUVAttr.refItem(wallBaseVertex + 0), texVTop, 0);
		vec2.set(wallUVAttr.refItem(wallBaseVertex + 1), texVBottom, 1);
		vec2.set(wallUVAttr.refItem(wallBaseVertex + 2), texVBottom, 0);
		vec2.set(wallUVAttr.refItem(wallBaseVertex + 3), texVTop, 0);
		vec2.set(wallUVAttr.refItem(wallBaseVertex + 4), texVTop, 1);
		vec2.set(wallUVAttr.refItem(wallBaseVertex + 5), texVBottom, 1);

		wallBaseVertex += 6;


		// -- RIGHT wall
		var rightWallBottomLeft = vec3.copy([], topRight);
		var rightWallBottomRight = vec3.copy([], bottomRight);
		var rightWallTopLeft = vec3.add([], topRight, wallHeight);
		var rightWallTopRight = vec3.add([], bottomRight, wallHeight);

		var rightWallNormalLeft = spaceBottom.left;
		var rightWallNormalRight = spaceTop.left;

		vec3.copy(wallPosAttr.refItem(wallBaseVertex + 0), rightWallTopRight);
		vec3.copy(wallPosAttr.refItem(wallBaseVertex + 1), rightWallBottomLeft);
		vec3.copy(wallPosAttr.refItem(wallBaseVertex + 2), rightWallTopLeft);

		vec3.copy(wallPosAttr.refItem(wallBaseVertex + 3), rightWallTopRight);
		vec3.copy(wallPosAttr.refItem(wallBaseVertex + 4), rightWallBottomRight);
		vec3.copy(wallPosAttr.refItem(wallBaseVertex + 5), rightWallBottomLeft);

		vec3.copy(wallNormAttr.refItem(wallBaseVertex + 0), rightWallNormalRight);
		vec3.copy(wallNormAttr.refItem(wallBaseVertex + 1), rightWallNormalLeft);
		vec3.copy(wallNormAttr.refItem(wallBaseVertex + 2), rightWallNormalLeft);
		vec3.copy(wallNormAttr.refItem(wallBaseVertex + 3), rightWallNormalRight);
		vec3.copy(wallNormAttr.refItem(wallBaseVertex + 4), rightWallNormalRight);
		vec3.copy(wallNormAttr.refItem(wallBaseVertex + 5), rightWallNormalLeft);

		// UV coords increase with resolution per step
		var texVBottom = genState.uvCoordV;
		var texVTop = texVBottom + genState.resolution / TrackWidth;
		vec2.set(wallUVAttr.refItem(wallBaseVertex + 0), texVBottom, 0);
		vec2.set(wallUVAttr.refItem(wallBaseVertex + 1), texVTop, 1);
		vec2.set(wallUVAttr.refItem(wallBaseVertex + 2), texVTop, 0);
		vec2.set(wallUVAttr.refItem(wallBaseVertex + 3), texVBottom, 0);
		vec2.set(wallUVAttr.refItem(wallBaseVertex + 4), texVBottom, 1);
		vec2.set(wallUVAttr.refItem(wallBaseVertex + 5), texVTop, 1);

		wallBaseVertex += 6;


		// torches?
		genState.nextTorch -= genState.resolution;
		if (genState.nextTorch <= 0) {
			genState.nextTorch += TrackTorchOffset;
			let torchPos = vec3.lerp([], leftWallBottomLeft, leftWallBottomRight, 0.5);
			torchPos[1] = 2.5;
			let torchLeftPos = vec3.scaleAndAdd([], torchPos, leftWallNormalLeft, TrackWidth * .05);
			let torchCenterPos = vec3.scaleAndAdd([], torchPos, leftWallNormalLeft, TrackWidth * .5);
			let torchRightPos = vec3.scaleAndAdd([], torchPos, leftWallNormalLeft, TrackWidth * .95);

			result.torches.push({
				leftWallPos: vec3.add(torchLeftPos, torchLeftPos, genState.origin),
				lightPos: vec3.add(torchCenterPos, torchCenterPos, genState.origin),
				rightWallPos: vec3.add(torchRightPos, torchCenterPos, genState.origin)
			});
		}


		// create segment info for collision and motion
		result.segments.push({
			center: vec3.add([], vec3.scaleAndAdd([], stepOrigin, spaceBottom.direction, genState.resolution / 2), genState.origin),
			left: spaceTop.left,

			leftFront: vec3.add([], bottomLeft, genState.origin),
			rightFront: vec3.add([], bottomRight, genState.origin),
			leftRear: vec3.add([], topLeft, genState.origin),
			rightRear: vec3.add([], topRight, genState.origin),

			halfWidth: TrackWidth / 2,

			direction: spaceTop.direction,
			normal: spaceTop.normal
		});

		// advance genState to next step
		vec3.copy(stepOrigin, topOrigin);
		genState.uvCoordV += genState.resolution / TrackWidth;
	}

	vec3.add(genState.origin, genState.origin, stepOrigin);
	genState.orientation = targetOrientation;

	md.primitiveGroups.push({ type: meshdata.PrimitiveType.Triangle, fromElement: 0, elementCount: triangleCount * 3, materialIx: 0 });
	wallMD.primitiveGroups.push({ type: meshdata.PrimitiveType.Triangle, fromElement: 0, elementCount: wallTriangleCount * 3, materialIx: 0 });

	return result;
}


// ------

export function defineTrack(): TrackSpec {
	var track: TrackSpec = [];

	// -- initial straight
	track.push({
		incline: Incline.Flat,
		direction: 0,
		tilt: 0,

		length: 24
	});

	// -- curve and straight
	track.push({
		incline: Incline.Flat,
		direction: 45,
		tilt: -10,

		length: 16
	});
	track.push({
		incline: Incline.Flat,
		direction: 45,
		tilt: 0,

		length: 8
	});
	track.push({
		incline: Incline.Flat,
		direction: 45,
		tilt: 0,

		length: 16
	});

	track.push({
		incline: Incline.Flat,
		direction: 0,
		tilt: 20,

		length: 16
	});
	track.push({
		incline: Incline.Flat,
		direction: 0,
		tilt: 0,

		length: 16
	});
	track.push({
		incline: Incline.Medium,
		direction: 0,
		tilt: 0,

		length: 24
	});

	// -- valley
	track.push({
		incline: Incline.Steep,
		direction: 45,
		tilt: 10,

		length: 24
	});
	track.push({
		incline: Incline.Cliff,
		direction: 80,
		tilt: 5,

		length: 20
	});
	track.push({
		incline: Incline.Medium,
		direction: 80,
		tilt: 0,

		length: 12
	});
	track.push({
		incline: -Incline.Steep,
		direction: 80,
		tilt: 0,

		length: 8
	});
	track.push({
		incline: Incline.Flat,
		direction: 80,
		tilt: 0,

		length: 8
	});


	// -- grand turn 1
	track.push({
		incline: Incline.Steep,
		direction: 0,
		tilt: 10,

		length: 32
	});
	track.push({
		incline: Incline.Steep,
		direction: -45,
		tilt: 10,

		length: 32
	});
	track.push({
		incline: Incline.Steep,
		direction: -45,
		tilt: 0,

		length: 16
	});
	track.push({
		incline: Incline.Flat,
		direction: -45,
		tilt: 0,

		length: 16
	});


	// -- twister
	track.push({
		incline: Incline.Flat,
		direction: -120,
		tilt: 5,

		length: 24
	});
	track.push({
		incline: Incline.Gradual,
		direction: -120,
		tilt: 0,

		length: 16
	});
	track.push({
		incline: Incline.Gradual,
		direction: -45,
		tilt: -5,

		length: 24
	});
	track.push({
		incline: Incline.Gradual,
		direction: -45,
		tilt: 0,

		length: 16
	});
	track.push({
		incline: Incline.Steep,
		direction: -120,
		tilt: 5,

		length: 24
	});
	track.push({
		incline: -Incline.Steep,
		direction: -120,
		tilt: 0,

		length: 8
	});


	// -- valley
	track.push({
		incline: Incline.Bump,
		direction: -120,
		tilt: 0,

		length: 32
	});
	track.push({
		incline: Incline.Gradual,
		direction: -120,
		tilt: 0,

		length: 16
	});
	track.push({
		incline: Incline.Gradual,
		direction: 0,
		tilt: 5,

		length: 24
	});


	// -- saw
	track.push({
		incline: Incline.Gradual,
		direction: 0,
		tilt: 10,

		length: 16
	});
	track.push({
		incline: Incline.Gradual,
		direction: 0,
		tilt: -10,

		length: 16
	});
	track.push({
		incline: Incline.Gradual,
		direction: 0,
		tilt: 10,

		length: 16
	});
	track.push({
		incline: Incline.Gradual,
		direction: 0,
		tilt: -10,

		length: 16
	});


	// -- final turn
	track.push({
		incline: Incline.Medium,
		direction: 90,
		tilt: -10,

		length: 32
	});
	track.push({
		incline: Incline.Medium,
		direction: 0,
		tilt: 10,

		length: 32
	});
	track.push({
		incline: Incline.Medium,
		direction: -90,
		tilt: 10,

		length: 32
	});
	track.push({
		incline: Incline.Flat,
		direction: -90,
		tilt: 0,

		length: 32
	});
	track.push({
		incline: Incline.Steep,
		direction: -180,
		tilt: 10,

		length: 32
	});


	// -- final stretch
	track.push({
		incline: Incline.Gradual,
		direction: -180,
		tilt: 0,

		length: 8
	});
	track.push({
		incline: Incline.Flat,
		direction: -180,
		tilt: 0,

		length: 32
	});
	track.push({
		incline: -Incline.Flat,
		direction: -180,
		tilt: 0,

		length: 32
	});
	track.push({
		incline: 0,
		direction: -180,
		tilt: 0,

		length: 32
	});
	track.push({
		incline: -85,
		direction: -180,
		tilt: 0,

		length: 4
	});
	track.push({
		incline: -85,
		direction: -180,
		tilt: 0,

		length: 16
	});


	return track;
}
