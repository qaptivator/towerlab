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

// instance class similar to roblox's api
export interface RbxTreeNode {
	id: string
	className: string
	name: string
	properties: Record<string, RbxPropertyValue>
	children: RbxTreeNode[]
}

// our own middleman format for client objects
export interface KitClientObject {
	id: string
	className: string
	name: string
	properties: Record<string, RbxPropertyValue>
	children: RbxTreeNode[]
}

// what the file is, detected from its contents
export type SourceKit = 'etoh-6' | 'jtoh-5.5' | 'tower-creator' | 'unknown'

// what we can write to. Derived, so the type enforces that TC is read-only
export type TargetKit = Exclude<SourceKit, 'tower-creator' | 'unknown'>

// what shape the output takes, matching the file extension
export type OutputShape = 'place' | 'model'

export function indexNodes(document: RbxDocument): Map<string, RbxNode> {
	return new Map(document.nodes.map((node) => [node.id, node]))
}

export function isBasePart(className: string): boolean {
	return BASE_PART_CLASSES.has(className)
}

/** nested view of a document, or of one selected instance and its descendants. */
export function documentTree(
	document: RbxDocument,
	rootIds: string[] = document.rootIds
): RbxTreeNode[] {
	const byId = indexNodes(document)
	const build = (id: string, trail: Set<string>): RbxTreeNode | null => {
		if (trail.has(id)) return null
		const node = byId.get(id)
		if (!node) return null
		const next = new Set(trail)
		next.add(id)
		const children: RbxTreeNode[] = []
		for (const childId of node.childIds) {
			const child = build(childId, next)
			if (child) children.push(child)
		}
		return {
			id: node.id,
			className: node.className,
			name: node.name,
			properties: node.properties,
			children,
		}
	}

	const trees: RbxTreeNode[] = []
	for (const id of rootIds) {
		const tree = build(id, new Set())
		if (tree) trees.push(tree)
	}
	return trees
}
