import type {
	RbxDocument,
	RbxNode,
	RbxPropertyValue,
} from '@towerlab/dom-schema'

export type { RbxDocument, RbxNode, RbxPropertyValue }

const BASE_PART_CLASSES = new Set([
	'Part',
	'MeshPart',
	'WedgePart',
	'CornerWedgePart',
	'TrussPart',
	'Seat',
	'VehicleSeat',
	'SpawnLocation',
	'SkateboardPlatform',
	'Platform',
	'FlagStand',
	'UnionOperation',
	'NegateOperation',
	'IntersectOperation',
	'PartOperation',
	'TriangleMeshPart',
])

const CLIENT_OBJECT_CONTAINERS = new Set([
	'clientobject',
	'clientobjects',
	'clientsided',
	'clientsidedobjects',
])

const FRAME_CONTAINERS = new Set([
	'frame',
	'frames',
	/*'section',
	'sections',
	'stage',
	'stages',
	'floor',
	'floors',
	'towersection',
	'towersections',*/
])

const OBBY_CONTAINERS = new Set(['obby'])

export interface DocumentStats {
	instances: number
	/** BaseParts anywhere in the file. */
	parts: number
	/** BaseParts under the shallowest Obby folder/model. */
	obbyParts: number
	/** BaseParts under the shallowest ClientSidedObjects folder/model. */
	clientObjectParts: number
	/** BaseParts under the shallowest Frame folder, including nested sections. */
	frameParts: number
	/** Models/folders under ClientSidedObjects. */
	clientObjects: number
	/** Floors under Frame. */
	floors: number
	/** Number of music zones. */
	musicZones: number
	/** Number of unique music used. */
	uniqueMusic: number
}

export interface RbxTreeNode {
	id: string
	className: string
	name: string
	properties: Record<string, RbxPropertyValue>
	children: RbxTreeNode[]
}

// What the file is, detected from its contents
export type SourceKit = 'etoh-6' | 'jtoh-5.5' | 'tower-creator' | 'unknown'

// What we can write to. Derived, so the type enforces that TC is read-only
export type TargetKit = Exclude<SourceKit, 'tower-creator' | 'unknown'>

// What shape the output takes, matching the file extension
export type OutputShape = 'place' | 'model'

export function indexNodes(document: RbxDocument): Map<string, RbxNode> {
	return new Map(document.nodes.map((node) => [node.id, node]))
}
