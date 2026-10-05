/**
 * A deliberately schematic prototype, not a validated anatomical reconstruction.
 * Bone and joint naming follows the shared mobile/desktop CSV:
 *   skeleton_id, joint_name, bone, x, y, z, present
 *
 * - Landmarks (head, chin, sacral promontory, fingertips, toes, ilium, ischium)
 *   have no bone: their endpoint has no boneId and the CSV bone column is blank.
 * - A joint can have 1-3 endpoints (the manubrium has sternum + both clavicles).
 * - Endpoint `label` is exactly the text used in the CSV "bone" column.
 * Survey coordinates are metres: X/Y horizontal, Z up. No skull-centre
 * measurement is created.
 */
export type Vec3 = [number, number, number];
export type Coordinate = [number | null, number | null, number | null];
export type BoneStatus = 'present' | 'absent' | 'unrecorded';
export interface Endpoint {
  /** Owning bone. Undefined for landmark endpoints (blank bone column in the CSV). */
  boneId?: string;
  /** Text written to / matched from the CSV "bone" column. */
  label: string;
  coordinate: Coordinate;
}
export interface Joint {
  id: string;
  label: string;
  region: string;
  endpoints: Endpoint[];
  linked: boolean;
}
export interface BoneRef { jointId: string; endpointIndex: number }
export interface Bone {
  id: string;
  label: string;
  status: BoneStatus;
  from: BoneRef;
  /** Omitted for bones with no shaft to draw (the sternum). */
  to?: BoneRef;
}
export interface Individual {
  id: string;
  name: string;
  accession: string;
  graveyardId?: string;
  color: string;
  visible: boolean;
  notes: string;
  joints: Joint[];
  bones: Bone[];
}
export interface Project {
  version: 1;
  name: string;
  updatedAt: string;
  individuals: Individual[];
  graveyards?: { id: string; name: string }[];
}
export type Scenario = 'articulated' | 'disarticulated' | 'missing-femur';
export type RenderableBone = { id: string; label: string; from: Vec3; to: Vec3; status: BoneStatus };

const copy = <T>(value: T): T => structuredClone(value);
const complete = (value: Coordinate | undefined): value is Vec3 => !!value && value.every((axis) => typeof axis === 'number' && Number.isFinite(axis));

type Owner = [boneId: string | undefined, endpointLabel: string];

function makeIndividual(id: string, color: string, offsetX: number): Individual {
  const joints: Joint[] = [];
  const bones: Bone[] = [];
  const labels: Record<string, string> = {
    sternum: 'Sternum', pelvis: 'Pelvis',
    left_clavicle: 'Left clavicle', right_clavicle: 'Right clavicle',
    left_humerus: 'Left upper arm', right_humerus: 'Right upper arm',
    left_forearm: 'Left forearm', right_forearm: 'Right forearm',
    left_hand: 'Left hand', right_hand: 'Right hand',
    left_femur: 'Left thigh', right_femur: 'Right thigh',
    left_lower_leg: 'Left shin', right_lower_leg: 'Right shin',
    left_foot: 'Left foot', right_foot: 'Right foot',
  };
  // Demo coordinates are centred on x = 0 and shifted by offsetX.
  const joint = (jointId: string, label: string, region: string, coordinate: Vec3, owners: Owner[]) => {
    const placed: Coordinate = [Number((coordinate[0] + offsetX).toFixed(3)), coordinate[1], coordinate[2]];
    joints.push({
      id: jointId, label, region, linked: owners.length > 1,
      endpoints: owners.map(([boneId, endpointLabel]) => ({ ...(boneId ? { boneId } : {}), label: endpointLabel, coordinate: [...placed] as Coordinate })),
    });
  };
  const none: Owner[] = [[undefined, '']];

  joint('head_proximal', 'Head Proximal', 'Head & torso', [0, 0, 2], none);
  joint('chin', 'Chin', 'Head & torso', [0, -.1, 1.85], none);
  joint('manubrium', 'Manubrium', 'Head & torso', [0, 0, 1.65],
    [['sternum', 'Sternum'], ['left_clavicle', 'Left clavicle (proximal)'], ['right_clavicle', 'Right clavicle (proximal)']]);
  joint('sacral_promontory', 'Sacral Promontory', 'Pelvis', [0, 0, 1.1], none);
  for (const [side, d] of [['left', 1], ['right', -1]] as const) {
    const title = side[0].toUpperCase() + side.slice(1);
    joint(`${side}_shoulder`, `${title} Shoulder`, `${title} arm`, [.45 * d, 0, 1.6],
      [[`${side}_clavicle`, 'Clavicle (distal) / shoulder blade'], [`${side}_humerus`, 'Upper arm (proximal)']]);
    joint(`${side}_elbow`, `${title} Elbow`, `${title} arm`, [.7 * d, 0, 1.3],
      [[`${side}_humerus`, 'Upper arm (distal)'], [`${side}_forearm`, 'Forearm (proximal)']]);
    joint(`${side}_wrist`, `${title} Wrist`, `${title} arm`, [.85 * d, 0, 1],
      [[`${side}_forearm`, 'Forearm (distal)'], [`${side}_hand`, 'Hand']]);
    joint(`${side}_fingertips`, `${title} Fingertips`, `${title} arm`, [1 * d, -.05, .95], none);
    joint(`${side}_ilium_superior`, `${title} Ilium Superior`, 'Pelvis', [.25 * d, 0, 1.2], none);
    joint(`${side}_ischium`, `${title} Ischium`, 'Pelvis', [.25 * d, 0, .9], none);
    joint(`${side}_acetabulum`, `${title} Acetabulum`, 'Pelvis', [.25 * d, 0, 1.05],
      [['pelvis', 'Pelvis'], [`${side}_femur`, 'Thigh (proximal)']]);
    joint(`${side}_knee`, `${title} Knee`, `${title} leg`, [.35 * d, 0, .6],
      [[`${side}_femur`, 'Thigh (distal)'], [`${side}_lower_leg`, 'Shin (proximal)']]);
    joint(`${side}_ankle`, `${title} Ankle`, `${title} leg`, [.45 * d, 0, .15],
      [[`${side}_lower_leg`, 'Shin (distal)'], [`${side}_foot`, 'Foot']]);
    joint(`${side}_toes`, `${title} Toes`, `${title} leg`, [.55 * d, -.15, .1], none);
  }

  // A landmark end of a bone (fingertips, toes) has no owner, so it falls back to endpoint 0.
  const bone = (boneId: string, fromId: string, toId?: string) => {
    const ref = (jointId: string): BoneRef => {
      const index = joints.find((j) => j.id === jointId)!.endpoints.findIndex((e) => e.boneId === boneId);
      return { jointId, endpointIndex: index >= 0 ? index : 0 };
    };
    bones.push({ id: boneId, label: labels[boneId], status: 'present', from: ref(fromId), ...(toId ? { to: ref(toId) } : {}) });
  };
  bone('sternum', 'manubrium');
  bone('left_clavicle', 'manubrium', 'left_shoulder');
  bone('right_clavicle', 'manubrium', 'right_shoulder');
  bone('pelvis', 'left_acetabulum', 'right_acetabulum');
  for (const side of ['left', 'right']) {
    bone(`${side}_humerus`, `${side}_shoulder`, `${side}_elbow`);
    bone(`${side}_forearm`, `${side}_elbow`, `${side}_wrist`);
    bone(`${side}_hand`, `${side}_wrist`, `${side}_fingertips`);
    bone(`${side}_femur`, `${side}_acetabulum`, `${side}_knee`);
    bone(`${side}_lower_leg`, `${side}_knee`, `${side}_ankle`);
    bone(`${side}_foot`, `${side}_ankle`, `${side}_toes`);
  }
  return { id, name: id, accession: 'DEMO-2026', color, visible: true,
    notes: 'Synthetic demonstration coordinates. Not the BP002 field record.', joints, bones };
}

export function createDemoProject(): Project {
  const first = makeIndividual('IND-001', '#6a8d77', -1.4);
  const second = makeIndividual('IND-002', '#b6925c', 1.4);
  return { version: 1, name: 'Skeletal recording · Demo collection', updatedAt: new Date().toISOString(), individuals: [first, second], graveyards: [{ id: 'GY-001', name: 'Graveyard 1' }] };
}

/** Empty recording workspace: presence defaults match the mobile recorder. */
export function createBlankProject(): Project {
  const example = createDemoProject();
  const person = example.individuals[0];
  return { ...example, name: 'Skeletal Model Workspace', individuals: [{ ...person,
    id: 'IND-001', name: 'Skeleton 1', accession: '', color: '#355c7d', notes: '',
    joints: person.joints.map(j => ({ ...j, endpoints: j.endpoints.map(e => ({ ...e, coordinate: [null, null, null] as Coordinate })) })),
    bones: person.bones.map(b => ({ ...b, status: 'present' as BoneStatus })),
  }] };
}

/** Linked coordinates propagate only within this joint, never along a limb. */
export function updateCoordinate(individual: Individual, jointId: string, endpointIndex: number, axisIndex: number, value: number | null): Individual {
  if (!Number.isInteger(axisIndex) || axisIndex < 0 || axisIndex > 2 || (value !== null && !Number.isFinite(value))) throw new Error('Enter a finite coordinate or leave it unrecorded.');
  const next = copy(individual);
  const joint = next.joints.find((j) => j.id === jointId);
  if (!joint || !Number.isInteger(endpointIndex) || !joint.endpoints[endpointIndex]) throw new Error('Unknown joint endpoint.');
  joint.endpoints.forEach((endpoint, index) => { if (joint.linked || index === endpointIndex) endpoint.coordinate[axisIndex] = value; });
  return next;
}

/** Relinking is an explicit action: the first coordinate becomes the source. */
export function setJointLinked(individual: Individual, jointId: string, linked: boolean): Individual {
  const next = copy(individual);
  const joint = next.joints.find((j) => j.id === jointId);
  if (!joint) throw new Error('Unknown joint.');
  joint.linked = joint.endpoints.length > 1 && linked;
  if (joint.linked) joint.endpoints.forEach((endpoint) => { endpoint.coordinate = [...joint.endpoints[0].coordinate]; });
  return next;
}

/** CSV has coordinates rather than a link flag; only identical endpoints (2 or 3) can be linked. */
export function linkMatchingImportedEndpoints(individual: Individual): Individual {
  return {
    ...individual,
    joints: individual.joints.map(joint => ({
      ...joint,
      linked: joint.endpoints.length > 1 &&
        joint.endpoints.every(endpoint => endpoint.coordinate.every(value => value !== null)) &&
        joint.endpoints.every(endpoint => endpoint.coordinate.every((value, axis) => value === joint.endpoints[0].coordinate[axis])),
    })),
  };
}

/** Inventory changes preserve the recorded coordinates, including absent bones. */
export function setBoneStatus(individual: Individual, boneId: string, status: BoneStatus): Individual {
  if (!['present', 'absent', 'unrecorded'].includes(status)) throw new Error('Unknown bone status.');
  if (!individual.bones.some((bone) => bone.id === boneId)) throw new Error('Unknown bone.');
  return { ...individual, bones: individual.bones.map((bone) => bone.id === boneId ? { ...bone, status } : bone) };
}

/** Scenarios change the left knee/femur example; all other observations survive. */
export function applyScenario(individual: Individual, scenario: Scenario): Individual {
  if (!['articulated', 'disarticulated', 'missing-femur'].includes(scenario)) throw new Error('Unknown demonstration scenario.');
  let next = setJointLinked(individual, 'left_knee', true);
  next = setBoneStatus(next, 'left_femur', scenario === 'missing-femur' ? 'absent' : 'present');
  next = setBoneStatus(next, 'left_lower_leg', 'present');
  if (scenario === 'disarticulated') {
    next = setJointLinked(next, 'left_knee', false);
    const source = next.joints.find((j) => j.id === 'left_knee')!.endpoints[0].coordinate;
    const displacement = [.12, .08, -.045];
    for (let axis = 0; axis < 3; axis++) {
      const value = source[axis];
      next = updateCoordinate(next, 'left_knee', 1, axis, value === null ? null : Number((value + displacement[axis]).toFixed(3)));
    }
  }
  return next;
}

export function getRenderableBones(individual: Individual): RenderableBone[] {
  const endpoint = (ref: BoneRef) => individual.joints.find((j) => j.id === ref.jointId)?.endpoints[ref.endpointIndex]?.coordinate;
  return individual.bones.flatMap((bone) => {
    if (bone.status !== 'present' || !bone.to) return [];
    const from = endpoint(bone.from);
    const to = endpoint(bone.to);
    if (!complete(from) || !complete(to)) return [];
    // Pelvis is a schematic body anchored by both acetabula and the sacral promontory.
    // Optional ilium/ischium records deliberately have no bearing on this rule.
    if (bone.id === 'pelvis' && !complete(individual.joints.find((j) => j.id === 'sacral_promontory')?.endpoints[0]?.coordinate)) return [];
    return [{ id: bone.id, label: bone.label, from: [...from] as Vec3, to: [...to] as Vec3, status: bone.status }];
  });
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
function object(value: unknown, context: string): Record<string, unknown> {
  if (!isObject(value)) throw new Error(`${context}: expected an object.`);
  return value;
}
function string(value: unknown, context: string, max = 250): string {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${context}: expected text (maximum ${max} characters).`);
  return value;
}
function id(value: unknown, context: string): string {
  const result = string(value, context, 80);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(result)) throw new Error(`${context}: invalid identifier.`);
  return result;
}
function array(value: unknown, context: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max || value.length === 0) throw new Error(`${context}: expected 1–${max} entries.`);
  return value;
}
function bool(value: unknown, context: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${context}: expected true or false.`);
  return value;
}
function unique(values: string[], context: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${context}: duplicate identifier.`);
}

/** Validate and reconstruct only known properties before importing a project. */
export function validateProject(input: unknown): Project {
  const root = object(input, 'Project');
  if (root.version !== 1) throw new Error('Unsupported project version. Expected version 1.');
  const name = string(root.name, 'Project name');
  const updatedAt = string(root.updatedAt, 'Updated date', 60);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(updatedAt) || !Number.isFinite(Date.parse(updatedAt))) throw new Error('Invalid project update date.');
  const graveyards = Array.isArray(root.graveyards) ? root.graveyards.filter(value => isObject(value) && typeof value.id === 'string' && typeof value.name === 'string') : [{ id: 'GY-001', name: 'Graveyard 1' }];
  const individuals: Individual[] = array(root.individuals, 'Individuals', 100).map((entry, index) => {
    const person = object(entry, `Individual ${index + 1}`);
    const bones: Bone[] = array(person.bones, 'Bones', 200).map((entry) => {
      const bone = object(entry, 'Bone');
      const status = bone.status;
      if (status !== 'present' && status !== 'absent' && status !== 'unrecorded') throw new Error('Invalid bone inventory status.');
      const ref = (value: unknown): BoneRef => {
        const record = object(value, 'Bone reference');
        if (!Number.isInteger(record.endpointIndex) || (record.endpointIndex as number) < 0 || (record.endpointIndex as number) > 2) throw new Error('Invalid endpoint index.');
        return { jointId: id(record.jointId, 'Joint reference'), endpointIndex: record.endpointIndex as number };
      };
      const to = bone.to === undefined || bone.to === null ? undefined : ref(bone.to);
      return { id: id(bone.id, 'Bone ID'), label: string(bone.label, 'Bone label'), status, from: ref(bone.from), ...(to ? { to } : {}) };
    });
    unique(bones.map((b) => b.id), 'Bones');
    const joints: Joint[] = array(person.joints, 'Joints', 300).map((entry) => {
      const joint = object(entry, 'Joint');
      const jointId = id(joint.id, 'Joint ID');
      if (['centre_of_head', 'centre_of_skull', 'skull_centre'].includes(jointId)) throw new Error('Skull-centre points are excluded from this desktop schema.');
      const endpoints: Endpoint[] = array(joint.endpoints, 'Joint endpoints', 3).map((entry) => {
        const endpoint = object(entry, 'Endpoint');
        if (!Array.isArray(endpoint.coordinate) || endpoint.coordinate.length !== 3 || !endpoint.coordinate.every((axis) => axis === null || (typeof axis === 'number' && Number.isFinite(axis)))) throw new Error('Coordinates must contain three finite numbers or null values.');
        // Landmark endpoints have no owning bone.
        const boneId = endpoint.boneId === undefined || endpoint.boneId === null ? undefined : id(endpoint.boneId, 'Endpoint owner');
        if (boneId && !bones.some((b) => b.id === boneId)) throw new Error(`Endpoint references unknown bone ${boneId}.`);
        return { ...(boneId ? { boneId } : {}), label: string(endpoint.label, 'Endpoint label'), coordinate: [...endpoint.coordinate] as Coordinate };
      });
      unique(endpoints.flatMap((e) => e.boneId ? [e.boneId] : []), 'Joint endpoint owners');
      const linked = bool(joint.linked, 'Linked coordinates');
      if (linked && (endpoints.length < 2 || !endpoints.every((e) => e.coordinate.every((axis, i) => axis === endpoints[0].coordinate[i])))) throw new Error('Linked endpoints must contain matching coordinates.');
      if ((jointId === 'head_proximal' || /_(fingertips|toes)$/.test(jointId)) && endpoints.length !== 1) throw new Error('Terminal landmarks have one endpoint.');
      return { id: jointId, label: string(joint.label, 'Joint label'), region: string(joint.region, 'Region'), linked, endpoints };
    });
    unique(joints.map((j) => j.id), 'Joints');
    bones.forEach((bone) => [bone.from, bone.to].forEach((ref) => {
      if (!ref) return;
      const endpoint = joints.find((j) => j.id === ref.jointId)?.endpoints[ref.endpointIndex];
      // A bone may end on a landmark endpoint (fingertips, toes) that has no owner.
      if (!endpoint || (endpoint.boneId !== undefined && endpoint.boneId !== bone.id)) throw new Error(`Invalid bone-owned endpoint reference for ${bone.label}.`);
    }));
    // Scenario controls and the pelvis rule depend on this minimal prototype map.
    for (const key of ['left_knee', 'head_proximal', 'sacral_promontory', 'left_acetabulum', 'right_acetabulum']) {
      if (!joints.some((j) => j.id === key)) throw new Error(`Required prototype landmark is missing: ${key}.`);
    }
    for (const key of ['left_femur', 'left_lower_leg', 'pelvis']) {
      if (!bones.some((b) => b.id === key)) throw new Error(`Required prototype bone is missing: ${key}.`);
    }
    const knee = joints.find((j) => j.id === 'left_knee')!;
    if (knee.endpoints[0]?.boneId !== 'left_femur' || knee.endpoints[1]?.boneId !== 'left_lower_leg') throw new Error('Left knee must contain femur and lower-leg endpoints in that order.');
    if (!['left_acetabulum', 'right_acetabulum'].every((key) => joints.find((j) => j.id === key)?.endpoints.some((e) => e.boneId === 'pelvis'))) throw new Error('Pelvis must own both acetabulum endpoints.');
    const color = string(person.color, 'Individual colour', 7);
    if (!/^#[a-fA-F0-9]{6}$/.test(color)) throw new Error('Individual colour must be a six-digit hex colour.');
    const graveyardId = person.graveyardId === undefined ? undefined : id(person.graveyardId, 'Graveyard ID');
  return { id: id(person.id, 'Individual ID'), name: string(person.name, 'Individual name'), accession: string(person.accession, 'Accession'), color,
    visible: bool(person.visible, 'Individual visibility'), notes: string(person.notes, 'Notes', 10000), graveyardId, joints, bones };
  });
  unique(individuals.map((person) => person.id), 'Individuals');
  return { version: 1, name, updatedAt, individuals, graveyards };
}

/** Long-form CSV keeps ownership and inventory alongside every endpoint. */
export function toCoordinateCsv(project: Project): string {
  const cell = (value: unknown) => {
    const text = value === null ? '' : String(value);
    const safe = /^[=+@\t\r]/.test(text) || (/^-/.test(text) && !Number.isFinite(Number(text))) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const rows: unknown[][] = [['Individual', 'Accession', 'Joint', 'Bone', 'Inventory status', 'X (m)', 'Y (m)', 'Z (m)', 'Coordinates linked']];
  project.individuals.forEach((person) => person.joints.forEach((joint) => joint.endpoints.forEach((endpoint) => {
    const status = endpoint.boneId ? person.bones.find((b) => b.id === endpoint.boneId)?.status ?? 'unrecorded' : 'present';
    rows.push([person.id, person.accession, joint.id, endpoint.label, status, ...endpoint.coordinate, joint.linked]);
  })));
  return rows.map((row) => row.map(cell).join(',')).join('\r\n');
}