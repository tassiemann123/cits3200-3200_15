/**
 * A deliberately schematic prototype, not a validated anatomical reconstruction.
 * Axial skeleton, shoulder girdle, forearm, lower leg, hand and foot are grouped
 * elements. Survey coordinates are metres: X/Y horizontal, Z up. No skull-centre
 * measurement is created. Optional pelvic landmarks do not determine presence.
 */
export type Vec3 = [number, number, number];
export type Coordinate = [number | null, number | null, number | null];
export type BoneStatus = 'present' | 'absent' | 'unrecorded';
export interface Joint {
  id: string;
  label: string;
  region: string;
  endpoints: { boneId: string; label: string; coordinate: Coordinate }[];
  linked: boolean;
}
export interface Bone {
  id: string;
  label: string;
  status: BoneStatus;
  from: { jointId: string; endpointIndex: number };
  to: { jointId: string; endpointIndex: number };
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
}
export type Scenario = 'articulated' | 'disarticulated' | 'missing-femur';
export type RenderableBone = { id: string; label: string; from: Vec3; to: Vec3; status: BoneStatus };

const copy = <T>(value: T): T => structuredClone(value);
const complete = (value: Coordinate | undefined): value is Vec3 => !!value && value.every((axis) => typeof axis === 'number' && Number.isFinite(axis));

function makeIndividual(id: string, color: string, offsetX: number): Individual {
  const joints: Joint[] = [];
  const bones: Bone[] = [];
  const labels: Record<string, string> = {
    spine: 'Axial skeleton', shoulder_girdle: 'Shoulder girdle', pelvis: 'Pelvis',
    left_humerus: 'Left humerus', right_humerus: 'Right humerus',
    left_forearm: 'Left forearm', right_forearm: 'Right forearm',
    left_hand: 'Left hand', right_hand: 'Right hand',
    left_femur: 'Left femur', right_femur: 'Right femur',
    left_lower_leg: 'Left lower leg', right_lower_leg: 'Right lower leg',
    left_foot: 'Left foot', right_foot: 'Right foot',
  };
  const joint = (jointId: string, label: string, region: string, coordinate: Vec3, owners: string[], optional = false) => {
    joints.push({ id: jointId, label, region, linked: owners.length === 2,
      endpoints: owners.map((boneId) => ({ boneId, label: labels[boneId], coordinate: optional ? [null, null, null] : [Number((coordinate[0] + offsetX).toFixed(3)), coordinate[1], coordinate[2]] })) });
  };
  joint('head_proximal', 'Head Proximal', 'Head & torso', [0, 0, 1.73], ['spine']);
  joint('chin', 'Chin', 'Head & torso', [0, .05, 1.62], ['spine'], true);
  joint('manubrium', 'Manubrium', 'Head & torso', [0, .02, 1.40], ['spine'], true);
  joint('sacral_promontory', 'Sacral Promontory', 'Pelvis', [0, 0, 1.04], ['spine', 'pelvis']);
  for (const [side, direction] of [['left', 1], ['right', -1]] as const) {
    const title = side[0].toUpperCase() + side.slice(1);
    joint(`${side}_shoulder`, `${title} Shoulder`, `${title} arm`, [.23 * direction, 0, 1.48], ['shoulder_girdle', `${side}_humerus`]);
    joint(`${side}_elbow`, `${title} Elbow`, `${title} arm`, [.32 * direction, .025, 1.18], [`${side}_humerus`, `${side}_forearm`]);
    joint(`${side}_wrist`, `${title} Wrist`, `${title} arm`, [.39 * direction, .045, .93], [`${side}_forearm`, `${side}_hand`]);
    joint(`${side}_fingertips`, `${title} Fingertips`, `${title} arm`, [.43 * direction, .05, .78], [`${side}_hand`]);
    joint(`${side}_acetabulum`, `${title} Acetabulum`, 'Pelvis', [.12 * direction, 0, .94], ['pelvis', `${side}_femur`]);
    joint(`${side}_knee`, `${title} Knee`, `${title} leg`, [.14 * direction, .025, .51], [`${side}_femur`, `${side}_lower_leg`]);
    joint(`${side}_ankle`, `${title} Ankle`, `${title} leg`, [.15 * direction, 0, .09], [`${side}_lower_leg`, `${side}_foot`]);
    joint(`${side}_toes`, `${title} Toes`, `${title} leg`, [.16 * direction, .18, .04], [`${side}_foot`]);
    joint(`${side}_ilium_superior`, `${title} Ilium Superior`, 'Pelvis', [.18 * direction, 0, 1.08], ['pelvis'], true);
    joint(`${side}_ischium`, `${title} Ischium`, 'Pelvis', [.10 * direction, -.02, .85], ['pelvis'], true);
  }
  const bone = (boneId: string, fromId: string, toId: string) => {
    const ref = (jointId: string) => ({ jointId, endpointIndex: joints.find((j) => j.id === jointId)!.endpoints.findIndex((e) => e.boneId === boneId) });
    bones.push({ id: boneId, label: labels[boneId], status: 'present', from: ref(fromId), to: ref(toId) });
  };
  bone('spine', 'head_proximal', 'sacral_promontory');
  bone('shoulder_girdle', 'left_shoulder', 'right_shoulder');
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
  const first = makeIndividual('IND-001', '#6a8d77', -.62);
  const second = makeIndividual('IND-002', '#b6925c', .62);
  return { version: 1, name: 'Skeletal recording · Demo collection', updatedAt: new Date().toISOString(), individuals: [first, second] };
}

/** Empty recording workspace: presence defaults match the mobile recorder. */
export function createBlankProject(): Project {
  const example = createDemoProject();
  const person = example.individuals[0];
  return { ...example, name: 'Skeletal Model Workspace', individuals: [{ ...person,
    id: 'IND-001', name: 'Skeleton 1', accession: '', color: '#355c7d', notes: '',
    joints: person.joints.map(j => ({ ...j, endpoints: j.endpoints.map(e => ({ ...e, coordinate: [null, null, null] })) })),
    bones: person.bones.map(b => ({ ...b, status: 'present' })),
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
  const endpoint = (ref: Bone['from']) => individual.joints.find((j) => j.id === ref.jointId)?.endpoints[ref.endpointIndex]?.coordinate;
  return individual.bones.flatMap((bone) => {
    if (bone.status !== 'present') return [];
    const from = endpoint(bone.from);
    const to = endpoint(bone.to);
    if (!complete(from) || !complete(to)) return [];
    // Pelvis is a schematic body anchored by all three essential landmarks.
    // Optional ilium/ischium records deliberately have no bearing on this rule.
    if (bone.id === 'pelvis' && !['sacral_promontory', 'left_acetabulum', 'right_acetabulum'].every((id) =>
      complete(individual.joints.find((j) => j.id === id)?.endpoints.find((e) => e.boneId === 'pelvis')?.coordinate))) return [];
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
  const individuals: Individual[] = array(root.individuals, 'Individuals', 100).map((entry, index) => {
    const person = object(entry, `Individual ${index + 1}`);
    const bones: Bone[] = array(person.bones, 'Bones', 200).map((entry) => {
      const bone = object(entry, 'Bone');
      const status = bone.status;
      if (status !== 'present' && status !== 'absent' && status !== 'unrecorded') throw new Error('Invalid bone inventory status.');
      const ref = (value: unknown): Bone['from'] => {
        const record = object(value, 'Bone reference');
        if (!Number.isInteger(record.endpointIndex) || (record.endpointIndex as number) < 0 || (record.endpointIndex as number) > 1) throw new Error('Invalid endpoint index.');
        return { jointId: id(record.jointId, 'Joint reference'), endpointIndex: record.endpointIndex as number };
      };
      return { id: id(bone.id, 'Bone ID'), label: string(bone.label, 'Bone label'), status, from: ref(bone.from), to: ref(bone.to) };
    });
    unique(bones.map((b) => b.id), 'Bones');
    const joints: Joint[] = array(person.joints, 'Joints', 300).map((entry) => {
      const joint = object(entry, 'Joint');
      const jointId = id(joint.id, 'Joint ID');
      if (['centre_of_head', 'centre_of_skull', 'skull_centre'].includes(jointId)) throw new Error('Skull-centre points are excluded from this desktop schema.');
      const endpoints = array(joint.endpoints, 'Joint endpoints', 2).map((entry) => {
        const endpoint = object(entry, 'Endpoint');
        if (!Array.isArray(endpoint.coordinate) || endpoint.coordinate.length !== 3 || !endpoint.coordinate.every((axis) => axis === null || (typeof axis === 'number' && Number.isFinite(axis)))) throw new Error('Coordinates must contain three finite numbers or null values.');
        const boneId = id(endpoint.boneId, 'Endpoint owner');
        if (!bones.some((b) => b.id === boneId)) throw new Error(`Endpoint references unknown bone ${boneId}.`);
        return { boneId, label: string(endpoint.label, 'Endpoint label'), coordinate: [...endpoint.coordinate] as Coordinate };
      });
      unique(endpoints.map((e) => e.boneId), 'Joint endpoint owners');
      const linked = bool(joint.linked, 'Linked coordinates');
      if (linked && (endpoints.length !== 2 || !endpoints[0].coordinate.every((axis, i) => axis === endpoints[1].coordinate[i]))) throw new Error('Linked endpoints must contain matching coordinates.');
      if ((jointId === 'head_proximal' || /_(fingertips|toes)$/.test(jointId)) && endpoints.length !== 1) throw new Error('Terminal landmarks have one endpoint.');
      return { id: jointId, label: string(joint.label, 'Joint label'), region: string(joint.region, 'Region'), linked, endpoints };
    });
    unique(joints.map((j) => j.id), 'Joints');
    bones.forEach((bone) => [bone.from, bone.to].forEach((ref) => {
      const endpoint = joints.find((j) => j.id === ref.jointId)?.endpoints[ref.endpointIndex];
      if (!endpoint || endpoint.boneId !== bone.id) throw new Error(`Invalid bone-owned endpoint reference for ${bone.label}.`);
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
    if (!['sacral_promontory', 'left_acetabulum', 'right_acetabulum'].every((key) => joints.find((j) => j.id === key)?.endpoints.some((e) => e.boneId === 'pelvis'))) throw new Error('Pelvis must own all three essential landmarks.');
    const color = string(person.color, 'Individual colour', 7);
    if (!/^#[a-fA-F0-9]{6}$/.test(color)) throw new Error('Individual colour must be a six-digit hex colour.');
    return { id: id(person.id, 'Individual ID'), name: string(person.name, 'Individual name'), accession: string(person.accession, 'Accession'), color,
      visible: bool(person.visible, 'Individual visibility'), notes: string(person.notes, 'Notes', 10000), joints, bones };
  });
  unique(individuals.map((person) => person.id), 'Individuals');
  return { version: 1, name, updatedAt, individuals };
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
    rows.push([person.id, person.accession, joint.id, endpoint.boneId, person.bones.find((b) => b.id === endpoint.boneId)?.status ?? 'unrecorded', ...endpoint.coordinate, joint.linked]);
  })));
  return rows.map((row) => row.map(cell).join(',')).join('\r\n');
}
