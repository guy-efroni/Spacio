export const VIEWPORT_BACKGROUND_COLOR = 0x1a1a2e;
export const VIEWPORT_GRID_SIZE = 20;
export const VIEWPORT_GRID_DIVISIONS = 40;
export const VIEWPORT_GRID_COLOR_CENTER_LINE = 0x3d3d5c;
export const VIEWPORT_GRID_COLOR_GRID = 0x2a2a4a;

export const VIEWPORT_CAMERA_FOV = 50;
export const VIEWPORT_CAMERA_NEAR = 0.1;
export const VIEWPORT_CAMERA_FAR = 1000;
export const VIEWPORT_CAMERA_POSITION = { x: 5, y: 3, z: 8 } as const;
export const VIEWPORT_CAMERA_LOOK_AT = { x: 0, y: 0, z: 0 } as const;

export const VIEWPORT_AMBIENT_LIGHT_COLOR = 0xffffff;
export const VIEWPORT_AMBIENT_LIGHT_INTENSITY = 0.5;
export const VIEWPORT_DIRECTIONAL_LIGHT_COLOR = 0xffffff;
export const VIEWPORT_DIRECTIONAL_LIGHT_INTENSITY = 1.2;
export const VIEWPORT_DIRECTIONAL_LIGHT_POSITION = { x: 5, y: 10, z: 7 } as const;

export const VIEWPORT_FLOOR_COLOR = 0x1e1e3a;
export const VIEWPORT_FLOOR_ROUGHNESS = 0.8;
export const VIEWPORT_FLOOR_METALNESS = 0.0;
export const VIEWPORT_FLOOR_SIZE = 20;

export const VIEWPORT_MAX_POLAR_ANGLE = Math.PI / 2 - 0.01;
export const VIEWPORT_MIN_DISTANCE = 2;
export const VIEWPORT_MAX_DISTANCE = 50;
export const VIEWPORT_GRID_SNAP = 0.5;

export const VIEWPORT_PREVIEW_LINE_COLOR = 0x7aa2ff;
export const VIEWPORT_PREVIEW_LINE_OPACITY = 0.9;
export const VIEWPORT_PREVIEW_LINE_HEIGHT_OFFSET = 0.02;

export const VIEWPORT_RENDERER_POWER_PREFERENCE: WebGLPowerPreference = 'high-performance';
export const VIEWPORT_MAX_PIXEL_RATIO = 2;
export const VIEWPORT_TONE_MAPPING_EXPOSURE = 1.0;
export const VIEWPORT_CONTROLS_DAMPING_FACTOR = 0.05;

export const VIEWPORT_SHADOW_MAP_SIZE = 2048;
export const VIEWPORT_SHADOW_CAMERA_NEAR = 0.5;
export const VIEWPORT_SHADOW_CAMERA_FAR = 50;
export const VIEWPORT_SHADOW_CAMERA_EXTENT = 15;
export const VIEWPORT_SHADOW_BIAS = -0.0005;

export const WALL_PLACEMENT_EPSILON = 0.0001;
export const ESCAPE_KEY = 'Escape';
export const DELETE_KEY = 'Delete';
export const BACKSPACE_KEY = 'Backspace';
export const PRIMARY_POINTER_BUTTON = 0;
