export interface SceneController {
	renderFrame(timeStep: number): void;
	simulationStep(timeStep: number): void;

	resume(): void;
	suspend(): void;
	focus(): void;
	blur(): void;
}
