/**
 * CITS3200 - Professional Computing - Group 15:
 *  Ruan van Zyl (23784316),
 *  Hogan Tan (23644329)
 *  Ivy Qi (24270483)
 *  Suhrid Mahmood Pushan (24306853)
 *  Tasveer Mann (23585984) 
 *  Wenbo Zhong (24247407)
 *  
 * Skeleton State file:
 *  The file defines the current physical instance of a skeleton based on the user input of coordinates
 */

// Imports
import type {
    Vec3,
    JointName,
    BoneDefinition,
} from "./skeleton-data";

import {
    DEFAULT_JOINTS,
    DEFAULT_BONES,
} from "./skeleton-data";

// Mutable skeleton state for adjustment on runtime via other functions
// allows for modifications to the joint coordinates and confirms joints follow the programs name structure for the import functions later
export class SkeletonState {
    joints: Record<JointName, Vec3>;
    bones: BoneDefinition[];

    // Position of skeleton local origin relative to the grave spatial coords
    position: Vec3;
    // Orientation of skeleton relative to the grave spatial coords
    rotation: Vec3;
    
    constructor (
        joints: Record<JointName, Vec3> = DEFAULT_JOINTS,
        bones: BoneDefinition[] = DEFAULT_BONES
    ) {
        this.joints = {...joints};
        this.bones = [...bones];
        this.position = {x: 0, y: 0, z: 0};
        this.rotation = {x: 0, y: 0, z: 0};
    }

    // Function to update a single joint position and checking names
    setJoint(name: JointName, position: Vec3): void {
        if (!(name in this.joints)) {
            throw new Error(`Unknown joint: "${name}"`);
        }
        this.joints[name] = position;
    }
}