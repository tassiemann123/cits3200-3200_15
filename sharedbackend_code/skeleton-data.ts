/**
 * CITS3200 - Professional Computing - Group 15:
 *  Ruan van Zyl (23784316),
 *  Hogan Tan (23644329)
 *  Ivy Qi (24270483)
 *  Suhrid Mahmood Pushan (24306853)
 *  Tasveer Mann (23585984) 
 *  Wenbo Zhong (24247407)
 *  
 * Skeleton Data file:
 *  The file sets the default coordinates for the skeleton before any data is input and defines the structures/interfaces used for the skeleton
 */

// Types and Interfaces
// Vec3 defines the default vector structure for use in describing a joints coordinates
export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

// Locks the string use as a Joints Name
export type JointName = string;

// Bone Defnintion interface defines the structure of a bone in the program for rendering and following the parent-child format
export interface BoneDefinition {
    name: string;
    startJoint: JointName;
    endJoint: JointName;
}

// Constants
// The default joints structure sets values for the joints to present a default joined skeleton

// NOTE FOR SYSTEM COORDINATES: In the app we are working with an individual skeleton so we zero its coordinates starting from the manubrium and use units of millimetres,
// When it comes to the desktop app we will then use a spatial coordinate system where the grave is set and the centre point is zeroed, so all
// skeletons added to the grave will need to be placed in reference to the spatial zero location via an additional reference vector (some 
// distance and angle from the spatial zero) such that the skeletons dont all attempt to overlap on the spatial zero when we import their coordinates.
export const DEFAULT_JOINTS: Record<JointName, Vec3> = {
    // Head and Neck joints
    head_proximal: {x: 0, y: 0, z: 0},
    centre_of_head: {x: 0, y: 0, z: 0},
    chin: {x: 0, y: 0, z: 0},
    manubrium: {x: 0, y: 0, z: 0},

    // Spine base
    sacral_promontory: {x: 0, y: 0, z: 0},

    // Left arm
    left_shoulder: {x: 0, y: 0, z: 0},
    left_elbow: {x: 0, y: 0, z: 0},
    left_wrist: {x: 0, y: 0, z: 0},
    left_fingertips: {x: 0, y: 0, z: 0},

    // Right arm
    right_shoulder: {x: 0, y: 0, z: 0},
    right_elbow: {x: 0, y: 0, z: 0},
    right_wrist: {x: 0, y: 0, z: 0},
    right_fingertips: {x: 0, y: 0, z: 0},

    // Left pelvis and leg
    left_ilium_superior: {x: 0, y: 0, z: 0},
    left_acetabulum: {x: 0, y: 0, z: 0},
    left_ischium: {x: 0, y: 0, z: 0},
    left_knee: {x: 0, y: 0, z: 0},
    left_ankle: {x: 0, y: 0, z: 0}, 
    left_toes: {x: 0, y: 0, z: 0},

    // Right pelvis and leg
    right_ilium_superior: {x: 0, y: 0, z: 0},
    right_acetabulum: {x: 0, y: 0, z: 0},
    right_ischium: {x: 0, y: 0, z: 0},
    right_knee: {x: 0, y: 0, z: 0},
    right_ankle: {x: 0, y: 0, z: 0}, 
    right_toes: {x: 0, y: 0, z: 0}

};

// The default bone structure defines the parent-child relationship between all of the bones and their joints
export const DEFAULT_BONES: BoneDefinition[] = [
    // Head and neck chain
    {name: "neck", startJoint: "manubrium", endJoint: "chin"},
    {name: "lower_skull", startJoint: "chin", endJoint: "centre_of_head"},
    {name: "upper_skull", startJoint: "centre_of_head", endJoint: "head_proximal"},

    // Spine
    {name: "spine", startJoint: "manubrium", endJoint: "sacral_promontory"},

    // Left arm
    {name: "left_clavicle ", startJoint: "manubrium", endJoint: "left_shoulder"},
    {name: "left_humerus", startJoint: "left_shoulder", endJoint: "left_elbow"},
    {name: "left_forearm", startJoint: "left_elbow", endJoint: "left_wrist"},
    {name: "left_hand", startJoint: "left_wrist", endJoint: "left_fingertips"},

    // Right arm
    {name: "right_clavicle", startJoint: "manubrium", endJoint: "right_shoulder"},
    {name: "right_humerus", startJoint: "right_shoulder", endJoint: "right_elbow"},
    {name: "right_forearm", startJoint: "right_elbow", endJoint: "right_wrist"},
    {name: "right_hand", startJoint: "right_wrist", endJoint: "right_fingertips"},

    // Left pelvis and leg
    {name: "left_ilium", startJoint: "sacral_promontory", endJoint: "left_ilium_superior"},
    {name: "left_hip_socket", startJoint: "left_ilium_superior", endJoint: "left_acetabulum"},
    {name: "left_ischium_bone", startJoint: "left_acetabulum", endJoint: "left_ischium"},
    {name: "left_femur", startJoint: "left_acetabulum", endJoint: "left_knee"},
    {name: "left_tibia", startJoint: "left_knee", endJoint: "left_ankle"},
    {name: "left_foot", startJoint: "left_ankle", endJoint: "left_toes"},

    // Right pelvis and leg
    {name: "right_ilium", startJoint: "sacral_promontory", endJoint: "right_ilium_superior"},
    {name: "right_hip_socket", startJoint: "right_ilium_superior", endJoint: "right_acetabulum"},
    {name: "right_ischium_bone", startJoint: "right_acetabulum", endJoint: "right_ischium"},
    {name: "right_femur", startJoint: "right_acetabulum", endJoint: "right_knee"},
    {name: "right_tibia", startJoint: "right_knee", endJoint: "right_ankle"},
    {name: "right_foot", startJoint: "right_ankle", endJoint: "right_toes"},
];
