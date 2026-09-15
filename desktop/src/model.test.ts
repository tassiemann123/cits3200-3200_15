import { describe, expect, it } from 'vitest';
import {
  applyScenario, createBlankProject, createDemoProject, getRenderableBones, setBoneStatus,
  setJointLinked, toCoordinateCsv, updateCoordinate, validateProject,
} from './model';

const first = () => createDemoProject().individuals[0];
const knee = (individual = first()) => individual.joints.find((joint) => joint.id === 'left_knee')!;

describe('bone-owned desktop coordinates', () => {
  it('starts with two independent individuals, paired joint coordinates and single terminal points', () => {
    const project = createDemoProject();
    expect(project.individuals.map((person) => person.id)).toEqual(['IND-001', 'IND-002']);
    const person = project.individuals[0];
    expect(knee(person).endpoints.map((e) => e.boneId)).toEqual(['left_femur', 'left_lower_leg']);
    expect(knee(person).endpoints[0].coordinate).toEqual(knee(person).endpoints[1].coordinate);
    expect(knee(person).endpoints[0].coordinate).not.toBe(knee(person).endpoints[1].coordinate);
    for (const joint of person.joints.filter((j) => j.id === 'proximal_skull' || /_(fingertips|toes)$/.test(j.id))) {
      expect(joint.endpoints).toHaveLength(1);
      expect(joint.linked).toBe(false);
    }
    expect(person.joints.some((j) => /centre|center/.test(j.id))).toBe(false);
  });

  it('duplicates linked changes only within the edited joint, without changing input', () => {
    const person = first();
    const original = structuredClone(person);
    const edited = updateCoordinate(person, 'left_knee', 0, 0, 2.7);
    expect(knee(edited).endpoints.map((e) => e.coordinate[0])).toEqual([2.7, 2.7]);
    expect(edited.joints.filter((j) => j.id !== 'left_knee')).toEqual(person.joints.filter((j) => j.id !== 'left_knee'));
    expect(person).toEqual(original);
  });

  it('keeps split endpoints independent and renders each bone from its own endpoint', () => {
    const person = applyScenario(first(), 'disarticulated');
    expect(knee(person).linked).toBe(false);
    const changed = updateCoordinate(person, 'left_knee', 1, 0, 2.8);
    expect(knee(changed).endpoints[0].coordinate).toEqual(knee(person).endpoints[0].coordinate);
    const rendered = getRenderableBones(changed);
    expect(rendered.find((b) => b.id === 'left_femur')!.to).toEqual(knee(changed).endpoints[0].coordinate);
    expect(rendered.find((b) => b.id === 'left_lower_leg')!.from[0]).toBe(2.8);
    expect(getRenderableBones(changed).find((b) => b.id === 'left_femur')!.to).not.toEqual(getRenderableBones(changed).find((b) => b.id === 'left_lower_leg')!.from);
  });

  it('relinks explicitly by copying the first coordinate and cannot link a terminal', () => {
    const person = applyScenario(first(), 'disarticulated');
    const relinked = setJointLinked(person, 'left_knee', true);
    expect(knee(relinked).endpoints[1].coordinate).toEqual(knee(person).endpoints[0].coordinate);
    expect(knee(person).linked).toBe(false);
    expect(setJointLinked(person, 'proximal_skull', true).joints.find((j) => j.id === 'proximal_skull')!.linked).toBe(false);
  });

  it('does not invent a missing femur when neighbouring pelvic and leg coordinates exist', () => {
    const original = first();
    const missing = applyScenario(original, 'missing-femur');
    const ids = getRenderableBones(missing).map((bone) => bone.id);
    expect(ids).not.toContain('left_femur');
    expect(ids).toContain('left_lower_leg');
    expect(ids).toContain('pelvis');
    expect(ids).toContain('right_femur');
    expect(missing.joints).toEqual(original.joints);
    expect(knee(missing).endpoints.every((e) => e.coordinate.every((c) => c !== null))).toBe(true);
  });

  it('distinguishes unrecorded coordinates from absent inventory', () => {
    const unrecorded = updateCoordinate(first(), 'left_knee', 0, 2, null);
    expect(unrecorded.bones.find((b) => b.id === 'left_femur')!.status).toBe('present');
    expect(getRenderableBones(unrecorded).some((b) => b.id === 'left_femur')).toBe(false);
    const statusUnknown = setBoneStatus(first(), 'left_femur', 'unrecorded');
    expect(getRenderableBones(statusUnknown).some((b) => b.id === 'left_femur')).toBe(false);
    expect(knee(statusUnknown).endpoints[0].coordinate.every((v) => v !== null)).toBe(true);
  });

  it('keeps pelvis rendered without optional ilium/ischium measurements', () => {
    let person = first();
    expect(person.joints.filter((j) => /ilium|ischium/.test(j.id)).every((j) => j.endpoints[0].coordinate.every((v) => v === null))).toBe(true);
    expect(getRenderableBones(person).some((b) => b.id === 'pelvis')).toBe(true);
    person = updateCoordinate(person, 'left_ilium_superior', 0, 0, 4);
    expect(getRenderableBones(person).some((b) => b.id === 'pelvis')).toBe(true);
    person = updateCoordinate(person, 'sacral_promontory', 1, 0, null);
    expect(getRenderableBones(person).some((b) => b.id === 'pelvis')).toBe(false);
    expect(person.bones.find((b) => b.id === 'pelvis')!.status).toBe('present');
  });

  it('makes each demo scenario repeatable rather than accumulating displacements', () => {
    const split = applyScenario(first(), 'disarticulated');
    expect(applyScenario(split, 'disarticulated')).toEqual(split);
    expect(knee(applyScenario(split, 'articulated')).linked).toBe(true);
  });

  it('rejects invalid runtime coordinate edits', () => {
    expect(() => updateCoordinate(first(), 'left_knee', 0, 0, Infinity)).toThrow();
    expect(() => updateCoordinate(first(), 'left_knee', 0, 3, 1)).toThrow();
    expect(() => updateCoordinate(first(), 'left_knee', 5, 0, 1)).toThrow();
  });
});

describe('project import and export', () => {
  it('round-trips split, missing and null values through JSON with no aliases', () => {
    const project = createDemoProject();
    project.individuals[0] = applyScenario(project.individuals[0], 'disarticulated');
    const validated = validateProject(JSON.parse(JSON.stringify(project)));
    expect(validated).toEqual(project);
    validated.individuals[0].joints[0].endpoints[0].coordinate[0] = 99;
    expect(project.individuals[0].joints[0].endpoints[0].coordinate[0]).not.toBe(99);
  });

  it('rejects unknown inventory status, nonfinite coordinates and mismatched linked values', () => {
    const status = createDemoProject();
    (status.individuals[0].bones[0] as { status: string }).status = 'maybe';
    expect(() => validateProject(status)).toThrow(/status/);
    const nonfinite = createDemoProject();
    knee(nonfinite.individuals[0]).endpoints[0].coordinate[0] = NaN;
    expect(() => validateProject(nonfinite)).toThrow(/finite/);
    const mismatch = createDemoProject();
    knee(mismatch.individuals[0]).endpoints[1].coordinate[0] = 123;
    expect(() => validateProject(mismatch)).toThrow(/matching/);
  });

  it('rejects duplicate IDs, unknown owners and wrong bone endpoint ownership', () => {
    const duplicate = createDemoProject();
    duplicate.individuals[1].id = duplicate.individuals[0].id;
    expect(() => validateProject(duplicate)).toThrow(/duplicate/);
    const owner = createDemoProject();
    knee(owner.individuals[0]).endpoints[0].boneId = 'imaginary';
    expect(() => validateProject(owner)).toThrow(/unknown bone/);
    const reference = createDemoProject();
    reference.individuals[0].bones.find((b) => b.id === 'left_femur')!.to.endpointIndex = 1;
    expect(() => validateProject(reference)).toThrow(/bone-owned/);
  });

  it('rejects malformed top level data and drops unknown imported properties', () => {
    expect(() => validateProject(null)).toThrow();
    expect(() => validateProject({ version: 2 })).toThrow(/version/);
    const project = createDemoProject();
    expect(validateProject({ ...project, externalResource: 'https://example.invalid' })).toEqual(project);
    expect(() => validateProject({ ...project, updatedAt: 'yesterday' })).toThrow(/date/);
  });

  it('exports one row per bone-owned endpoint, including missing inventory and blank coordinates', () => {
    const project = createDemoProject();
    const csv = toCoordinateCsv(project);
    expect(csv.split('\r\n')).toHaveLength(1 + project.individuals.reduce((n, p) => n + p.joints.reduce((m, j) => m + j.endpoints.length, 0), 0));
    expect(csv).toContain('"left_femur","absent"');
    expect(csv).toContain('"pelvis","present","","",""');
    project.individuals[0].accession = '=1+1';
    expect(toCoordinateCsv(project)).toContain('"\'=1+1"');
  });
});


describe('empty recording workspace', () => {
  it('starts without any measured coordinates or rendered bones and remains restorable', () => {
    const project = createBlankProject();
    expect(project.individuals).toHaveLength(1);
    expect(project.individuals[0].joints.every(j => j.endpoints.every(e => e.coordinate.every(v => v === null)))).toBe(true);
    expect(getRenderableBones(project.individuals[0])).toEqual([]);
    expect(validateProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
  });
  it('reveals only the completed bone after entry, and respects explicit absence', () => {
    let person = createBlankProject().individuals[0];
    [0, 0, .5].forEach((value, axis) => { person = updateCoordinate(person, 'left_knee', 0, axis, value); });
    expect(getRenderableBones(person)).toEqual([]);
    [0, 0, .1].forEach((value, axis) => { person = updateCoordinate(person, 'left_ankle', 0, axis, value); });
    expect(getRenderableBones(person).map(b => b.id)).toEqual(['left_lower_leg']);
    expect(getRenderableBones(setBoneStatus(person, 'left_lower_leg', 'absent'))).toEqual([]);
  });
});
